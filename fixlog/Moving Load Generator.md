# Fix log — Moving Load Generator.html

Governing basis used for fixes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): Table 3.4.1-1 (load factors), Art. 3.6.1.4 / C3.6.1.1.2 (fatigue truck and its distribution). No formula, factor value or analysis result was changed in this PR.

## 2026-10-04 — PR: claude/fix-moving-load (PR #11: https://github.com/mlococo88/All-Structural/pull/11)

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

## 2026-10-04 — PR: claude/step1-group1 (PR #28: https://github.com/mlococo88/All-Structural/pull/28)

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

## 2026-10-04 — PR: claude/conn-lldf-movingload (PR #32: https://github.com/mlococo88/All-Structural/pull/32)

Feature: hand-off (no result change). Receiver for channel `bridgeSuite.v1.lldf` (`_schema` `bridge-lldf-factors` v1, HANDOFF.md §4.3) from lldf.html. No formula, factor, default, unit, storage key or saved format changed. One new optional field in the saved state: `lldfSource` (top level of the `movingLoadGen.autosave.v1` / Save JSON object). Old saves load unchanged; a save without the field has no source. New storage written: `bridgeSuite.v1.lldf.adopted.movingLoad` (adoption marker, HANDOFF.md §2). The file keeps its CRLF line endings. BridgeXfer v1 was already in the file (step 1) and is reused unchanged.

Mapping (lldf payload → this tool), for the girder chosen in the dialog (`interior` / `exterior` / `byBeam[n]`):

| lldf field | Moving Load input | Notes |
|---|---|---|
| `governingBySpan[i].<girder>.gM` | Span i+1 DF moment (`dfm<i>`) | When lldf and this tool have the same span count. Otherwise (or for an older payload with no `governingBySpan`) `governing.<girder>.gM` goes to every span. |
| `governingBySpan[i].<girder>.gV` | Span i+1 DF shear (`dfv<i>`) | Same rule. |
| `governingNeg.<girder>.gM` | Negative moment DF (`dfNeg`) | Optional (ticked by default). Left unchanged when lldf is single span. |
| `spans` (ft) | Number of spans, Span i (ft) (`nSpans`, `L<i>`) | Only when "Also set the spans here" is ticked (off by default; offered only when they differ by more than 0.01 ft, and only for 1–4 spans). |
| `governing.<girder>.fatM` / `fatV`, `governingNeg.<girder>.fatM` | not applied | Shown in the dialog and appended to the fatigue-truck warning ("use g_fat = …"). This tool has one DF set for all vehicles. |
| — | rail DFs | Not touched. |

Default girder: lldf's design beam (`designBeam.index`) if `byBeam` has it, otherwise interior.

### H1. Pull from LL & DL Distribution / Import hand-off (JSON)   [feature: hand-off (no result change)]
- **Where:** new `<script>` block at the very end of the file, after the shared-project-info glue. Anchor text: `Hand-off IN: distribution factors from LL & DL Distribution`. The buttons and the source line are inserted by that script after the hint `LRFD DFs already include multiple presence` in "Factors & Analysis"; the dialog `#lxModal` is appended to `<body>`. It wraps `mlgSnapshot`, `mlgApply`, `analyze` (warning text only) and `reportHTML` (one row), in the same way the file's existing add-on blocks wrap functions.
- **Problem:** none (feature). Approved cross-tool connection lldf → Moving Load Generator (HANDOFF.md §4.3).
- **Governing provision:** n/a; no calculation changed. The dialog states the basis of lldf's numbers: multiple presence included (LRFD 3.6.1.1.2), skew correction included (LRFD 4.6.2.2.2e / 4.6.2.2.3c), fatigue = one-lane ÷ 1.2 (LRFD 3.6.1.4.3b, C3.6.1.1.2).
- **Before:** (end of file)
  ```html
  })();
  </script>
  </body>
  </html>
  ```
- **After:** the same, with this block inserted between `</script>` and `</body>`:
  ```html
<script>
/* ═══════════ Hand-off IN: distribution factors from LL & DL Distribution (lldf.html) ═══════════
   HANDOFF.md §4.3, channel 'bridgeSuite.v1.lldf', _schema 'bridge-lldf-factors' v1. Receiver id 'movingLoad'.
   Fills ONLY the highway DF inputs: per-span DF moment/shear (dfm#, dfv#) and the negative-moment DF
   (dfNeg); optionally the spans when the user ticks it. Rail DFs are never touched. Fatigue DFs
   (fatM/fatV) are shown in the dialog and the fatigue-truck warning but never applied, because this
   tool has no per-vehicle DF. Never applies on page load. The source is kept in the saved state as
   the new optional field 'lldfSource'. Uses BridgeXfer (above). */
(function(){
  var CH='lldf', SCHEMA='bridge-lldf-factors', VER=1, RID='movingLoad';
  var DF_MAX=5, TOL=0.01;            // sanity bound (lanes per girder); span match tolerance (ft)
  var SRC=null, applying=false, CUR=null;
  function el(id){ return document.getElementById(id); }
  function h(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function fin(v){ return typeof v==='number' && isFinite(v); }
  function when(iso){ var d=new Date(iso); return isNaN(d.getTime())?String(iso||'?'):d.toLocaleString(); }
  function projOf(p){ var pr=p&&p.project; if(pr&&typeof pr==='object') return [pr.name,pr.bridgeId].filter(Boolean).join(' / '); return pr?String(pr):''; }
  function f4(v){ return fin(v)?String(+v.toFixed(4)):'—'; }

  /* ---- validation: every number this tool uses or shows ---- */
  function checkSet(s,path,errs){
    if(s==null) return;
    if(typeof s!=='object'){ errs.push(path+' is not an object'); return; }
    ['gM','gV','fatM','fatV'].forEach(function(k){ var v=s[k]; if(v==null) return;
      if(!fin(v)||!(v>0)||v>DF_MAX) errs.push(path+'.'+k+' = '+JSON.stringify(v)+' (must be a number > 0 and ≤ '+DF_MAX+')'); });
  }
  function checkEnv(e,path,errs){
    if(e==null) return;
    if(typeof e!=='object'){ errs.push(path+' is not an object'); return; }
    checkSet(e.interior,path+'.interior',errs); checkSet(e.exterior,path+'.exterior',errs);
    if(e.byBeam!=null){ if(typeof e.byBeam!=='object') errs.push(path+'.byBeam is not an object');
      else Object.keys(e.byBeam).forEach(function(k){ if(!/^\d+$/.test(k)) errs.push(path+'.byBeam key "'+k+'" is not a beam number'); checkSet(e.byBeam[k],path+'.byBeam.'+k,errs); }); }
  }
  function validate(p){
    var errs=[];
    var u=p.units||{};
    if(u.spans!=null && u.spans!=='ft') errs.push('spans are in "'+u.spans+'"; this tool needs ft (no conversion is defined)');
    if(u.skew!=null && u.skew!=='deg') errs.push('skew is in "'+u.skew+'"; expected deg');
    if(!Array.isArray(p.spans)||!p.spans.length) errs.push('no span lengths');
    else p.spans.forEach(function(L,i){ if(!fin(L)||!(L>0)) errs.push('span '+(i+1)+' length = '+JSON.stringify(L)); });
    if(p.skew!=null && (!fin(p.skew)||p.skew<0||p.skew>90)) errs.push('skew = '+JSON.stringify(p.skew));
    if(p.Nb!=null && (!fin(p.Nb)||p.Nb<1||Math.round(p.Nb)!==p.Nb)) errs.push('Nb = '+JSON.stringify(p.Nb));
    if(!p.governing||typeof p.governing!=='object') errs.push('no governing DFs');
    checkEnv(p.governing,'governing',errs);
    checkEnv(p.governingNeg,'governingNeg',errs);
    if(p.governingBySpan!=null){
      if(!Array.isArray(p.governingBySpan)) errs.push('governingBySpan is not a list');
      else { if(Array.isArray(p.spans)&&p.governingBySpan.length!==p.spans.length) errs.push('governingBySpan has '+p.governingBySpan.length+' entries for '+p.spans.length+' spans');
        p.governingBySpan.forEach(function(e,i){ checkEnv(e,'governingBySpan['+i+']',errs); }); }
    }
    return errs;
  }

  /* ---- girder choice ---- */
  function beamInfo(p,n){ var b=p.beamRoster&&p.beamRoster.beams; if(!Array.isArray(b)) return null;
    for(var i=0;i<b.length;i++) if(+b[i].i===+n) return b[i]; return null; }
  function choices(p){
    var g=p.governing||{}, out=[];
    if(g.interior) out.push({v:'interior',t:'Interior girder (governing of all interior beams)'});
    if(g.exterior) out.push({v:'exterior',t:'Exterior girder (governing of both exterior beams)'});
    var by=g.byBeam||{}, dsel=p.designBeam&&p.designBeam.index;
    Object.keys(by).sort(function(a,b){return a-b;}).forEach(function(k){
      var b=beamInfo(p,k), lab=(b&&b.label)||('B'+k), cls=(b&&(b.clsLabel||b.type))||'';
      out.push({v:'beam:'+k,t:'Beam '+lab+(cls?' — '+cls:'')+((+dsel===+k)?' (design beam selected in lldf)':'')});
    });
    return out;
  }
  function defChoice(p,ch){
    var d=p.designBeam&&p.designBeam.index;
    if(d!=null && ch.some(function(c){return c.v==='beam:'+d;})) return 'beam:'+d;
    return ch.length?ch[0].v:'';
  }
  function choiceLabel(p,c){ var x=choices(p).filter(function(o){return o.v===c;})[0]; return x?x.t:c; }
  function pick(env,c){
    if(!env) return null;
    if(c==='interior') return env.interior||null;
    if(c==='exterior') return env.exterior||null;
    if(c.indexOf('beam:')===0) return (env.byBeam||{})[c.slice(5)]||null;
    return null;
  }

  /* ---- what will change ---- */
  function curSpans(){ var n=+el('nSpans').value, a=[]; for(var i=0;i<n;i++) a.push(num('L'+i,100)); return a; }
  function makePlan(p,c,setSpans,setNeg){
    var errs=[], notes=[];
    var mine=curSpans(), ls=p.spans, nL=ls.length;
    var mismatch=(nL!==mine.length)||ls.some(function(L,i){ return Math.abs(L-mine[i])>TOL; });
    var canSet=nL>=1 && nL<=4;
    setSpans=!!(setSpans&&canSet&&mismatch);
    var n=setSpans?nL:mine.length;
    var perSpan=Array.isArray(p.governingBySpan) && p.governingBySpan.length===n && nL===n;
    if(!perSpan) notes.push(Array.isArray(p.governingBySpan)
      ? 'The span count differs, so lldf\'s governing envelope over all of its spans is applied to every span here.'
      : 'This hand-off has no per-span DFs (older lldf), so lldf\'s governing envelope over all spans is applied to every span.');
    var dfM=[], dfV=[];
    for(var i=0;i<n;i++){
      var s=pick(perSpan?p.governingBySpan[i]:p.governing,c);
      if(!s||!fin(s.gM)||!fin(s.gV)){ errs.push('lldf has no moment/shear DF for the chosen girder'+(perSpan?' in span '+(i+1):'')+'.'); break; }
      dfM.push(s.gM); dfV.push(s.gV);
    }
    var neg=null, ng=pick(p.governingNeg,c);
    if(setNeg){
      if(!p.governingNeg) notes.push('lldf has no interior supports (single span), so the negative-moment DF is left unchanged.');
      else if(!ng||!fin(ng.gM)) notes.push('lldf has no negative-region DF for this girder, so the negative-moment DF is left unchanged.');
      else neg=ng.gM;
    }
    var pos=pick(p.governing,c)||{};
    var fat={M:fin(pos.fatM)?pos.fatM:null, V:fin(pos.fatV)?pos.fatV:null, negM:(ng&&fin(ng.fatM))?ng.fatM:null};
    // overwrite list
    var ch=[], row=function(lab,from,to){ if(String(from)!==String(to)) ch.push([lab,from,to]); };
    if(setSpans){ row('Number of spans',mine.length,nL); ls.forEach(function(L,i){ row('Span '+(i+1)+' length (ft)',i<mine.length?mine[i]:'(new)',L); }); }
    for(var k=0;k<dfM.length;k++){
      var e1=el('dfm'+k), e2=el('dfv'+k);
      row('Span '+(k+1)+' DF moment',e1?e1.value:'(new)',dfM[k]); row('Span '+(k+1)+' DF shear',e2?e2.value:'(new)',dfV[k]);
    }
    if(neg!=null) row('Negative moment DF',el('dfNeg').value||'(blank = span DF)',neg);
    return {errs:errs,notes:notes,mismatch:mismatch,canSet:canSet,setSpans:setSpans,n:n,perSpan:perSpan,dfM:dfM,dfV:dfV,neg:neg,fat:fat,changes:ch,mine:mine};
  }

  /* ---- dialog ---- */
  document.body.insertAdjacentHTML('beforeend','<div id="lxModal" class="mdl hidden"><div class="mdlc">'+
    '<h3>Pull distribution factors from LL &amp; DL Distribution</h3>'+
    '<div id="lxHead" style="font-size:12px;color:#334155;line-height:1.6"></div>'+
    '<div class="f"><label>Girder to take the DFs for</label><select id="lxGirder"></select></div>'+
    '<label class="chk"><input type="checkbox" id="lxNeg" checked>Set the negative-moment DF from lldf\'s interior-support (negative-region) DF</label>'+
    '<div id="lxSpanWarn" class="warn hidden"></div>'+
    '<label class="chk" id="lxSpansF"><input type="checkbox" id="lxSpans"><span id="lxSpansT">Also set the spans here to lldf\'s spans</span></label>'+
    '<p class="hint" style="color:#475569">Basis: lldf\'s moment and shear DFs <b>include the multiple presence factor</b> (also in lever-rule cases, LRFD 3.6.1.1.2) <b>and the skew correction</b> (LRFD 4.6.2.2.2e / 4.6.2.2.3c). Do not apply either again. Units: lanes per girder, the same basis as the DF inputs here. Rail DF inputs are not changed.</p>'+
    '<div id="lxFat" style="font-size:12px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;padding:8px 10px;line-height:1.6"></div>'+
    '<div class="lbl">This will overwrite</div><div id="lxChanges" style="font-size:12px;line-height:1.6"></div>'+
    '<div id="lxNotes" class="hint" style="color:#475569"></div>'+
    '<div class="mdla"><button class="btn" id="lxCancel" type="button">Cancel</button><button class="btn pri" id="lxApply" type="button">Apply</button></div>'+
    '<input type="file" id="lxFile" accept=".json,application/json" style="display:none">'+
    '</div></div>');

  function fatHtml(fat,label){
    if(fat.M==null&&fat.V==null) return 'lldf sent no fatigue DFs for this girder.';
    return '<b>Fatigue truck DFs (not applied):</b> g<sub>fat</sub> = <b>'+f4(fat.M)+'</b> moment, <b>'+f4(fat.V)+'</b> shear'+
      (fat.negM!=null?', <b>'+f4(fat.negM)+'</b> negative moment at piers':'')+
      ' — '+h(label)+'. One-lane DF ÷ 1.2 (multiple presence removed, LRFD 3.6.1.4.3b / C3.6.1.1.2), skew included. '+
      'This tool has one DF set for all vehicles, so these are <b>not</b> written to the DF inputs; they are repeated in the fatigue-truck warning.';
  }
  function refresh(){
    var p=CUR&&CUR.p; if(!p) return;
    var c=el('lxGirder').value, P=makePlan(p,c,el('lxSpans').checked,el('lxNeg').checked);
    CUR.plan=P;
    var sw=el('lxSpanWarn');
    if(P.mismatch){
      sw.classList.remove('hidden');
      sw.innerHTML='⚠ Spans differ. lldf: <b>'+p.spans.map(f4).join(' + ')+' ft</b> ('+p.spans.length+' span'+(p.spans.length>1?'s':'')+'). Here: <b>'+P.mine.map(function(v){return String(v);}).join(' + ')+' ft</b>. '+
        'The DFs were computed for lldf\'s spans. Spans here are not changed unless you tick the box below.'+(P.canSet?'':' lldf has more than 4 spans, which this tool cannot model.');
    } else sw.classList.add('hidden');
    el('lxSpansF').classList.toggle('hidden',!P.mismatch);
    el('lxSpans').disabled=!P.canSet;
    el('lxSpansT').textContent='Also set the spans here to lldf\'s spans ('+p.spans.map(f4).join(' + ')+' ft)';
    el('lxNeg').disabled=!p.governingNeg;
    el('lxFat').innerHTML=fatHtml(P.fat,choiceLabel(p,c));
    el('lxChanges').innerHTML=P.errs.length?'<span style="color:#b91c1c">'+P.errs.map(h).join('<br>')+'</span>'
      : (P.changes.length?P.changes.map(function(r){ return h(r[0])+': '+h(r[1])+' → <b>'+h(r[2])+'</b>'; }).join('<br>')
                         :'Nothing — the inputs already match.');
    var nt=P.notes.slice(); if(P.perSpan&&P.n>1) nt.push('Per-span DFs: span i here gets lldf\'s positive-region DF for span i (L = that span).');
    if(p.governingNeg&&el('lxNeg').checked) nt.push('Negative-moment DF = lldf\'s governing negative-region DF over all interior supports (L = mean of the adjacent spans); this tool has one negative-moment DF.');
    if(p.note) nt.push('lldf note: '+p.note);
    (Array.isArray(p.notes)?p.notes:[]).forEach(function(s){ nt.push('lldf: '+s); });
    el('lxNotes').innerHTML=nt.map(h).join('<br>');
    el('lxApply').disabled=!!P.errs.length;
  }
  function openDlg(p,via){
    var errs=validate(p);
    if(errs.length){ alert('Cannot use this DF hand-off from '+(p.producer||'?')+':\n• '+errs.join('\n• ')); return false; }
    var ch=choices(p);
    if(!ch.length){ alert('The DF hand-off has no interior, exterior or per-beam DFs.'); return false; }
    CUR={p:p,via:via};
    el('lxHead').innerHTML='From: <b>'+h(p.producer||'?')+'</b> ('+h(p.producerFile||'lldf.html')+') · sent '+h(when(p.producedAt))+
      ' · project: '+h(projOf(p)||'(none)')+(via==='file'?' · from a JSON file':'')+
      '<br>Bridge type '+h(p.bridgeType||'?')+' · N<sub>b</sub> = '+h(p.Nb!=null?p.Nb:'?')+' · skew '+h(p.skew!=null?p.skew:'?')+'° · spans '+h(p.spans.join(' + '))+' ft'+
      (p.designLanes!=null?' · '+h(p.designLanes)+' design lanes':'');
    el('lxGirder').innerHTML=ch.map(function(o){ return '<option value="'+h(o.v)+'">'+h(o.t)+'</option>'; }).join('');
    el('lxGirder').value=defChoice(p,ch);
    el('lxSpans').checked=false; el('lxNeg').checked=!!p.governingNeg;
    refresh();
    el('lxModal').classList.remove('hidden');
    return true;
  }
  function apply(){
    var p=CUR&&CUR.p, P=CUR&&CUR.plan; if(!p||!P||P.errs.length) return false;
    var c=el('lxGirder').value;
    applying=true;
    try{
      if(P.setSpans){
        el('nSpans').value=String(p.spans.length); renderSpans();
        p.spans.forEach(function(L,i){ el('L'+i).value=String(L); });
        updateProps();
      }
      P.dfM.forEach(function(v,i){ el('dfm'+i).value=String(v); });
      P.dfV.forEach(function(v,i){ el('dfv'+i).value=String(v); });
      if(P.neg!=null) el('dfNeg').value=String(P.neg);
    } finally { applying=false; }
    SRC={producer:p.producer||'LL & DL Distribution', producerFile:p.producerFile||'lldf.html', producedAt:p.producedAt||'',
      project:projOf(p), via:CUR.via, girder:c, girderLabel:choiceLabel(p,c), perSpan:P.perSpan, spansSet:P.setSpans,
      negSet:P.neg!=null, multiplePresence:true, skew:true,
      fatM:P.fat.M, fatV:P.fat.V, fatNegM:P.fat.negM, adoptedAt:new Date().toISOString(), edited:false};
    if(window.BridgeXfer) BridgeXfer.markAdopted(CH,RID,p.producedAt);
    el('lxModal').classList.add('hidden'); CUR=null;
    syncVis(); paint(); run();      // run() also autosaves (wrapped in the save block)
    return true;
  }
  el('lxGirder').addEventListener('change',refresh);
  el('lxSpans').addEventListener('change',refresh);
  el('lxNeg').addEventListener('change',refresh);
  el('lxCancel').onclick=function(){ el('lxModal').classList.add('hidden'); CUR=null; };
  el('lxApply').onclick=apply;

  /* ---- sidebar buttons + source line ---- */
  var hint=[].slice.call(el('dfT').parentNode.querySelectorAll('p.hint')).filter(function(x){ return /multiple presence/.test(x.textContent); })[0];
  (hint||el('dfNeg').closest('.f')).insertAdjacentHTML('afterend',
    '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" id="lxPull" type="button" title="Fill the highway DF inputs from the distribution factors sent by LL &amp; DL Distribution (lldf). Shows what will change and asks first.">⇄ Pull from LL &amp; DL Distribution <span id="lxNew" class="hidden" style="background:#f59e0b;color:#fff;border-radius:8px;padding:0 6px;margin-left:3px;font-size:10px">new</span></button>'+
    '<button class="btn" id="lxImport" type="button" title="Load a DF hand-off JSON file exported from LL &amp; DL Distribution">Import hand-off (JSON)</button></div>'+
    '<div id="lxSrc" class="hint" style="color:#475569"></div>');
  function srcText(){
    if(!SRC) return '';
    return 'Highway DFs from '+SRC.producer+', '+when(SRC.producedAt)+(SRC.project?' ('+SRC.project+')':'')+' — '+SRC.girderLabel+
      (SRC.perSpan?', per span':', governing envelope over all spans')+(SRC.negSet?'; negative-moment DF from interior supports':'')+
      (SRC.spansSet?'; spans set from lldf':'')+'; multiple presence and skew included'+
      (SRC.edited?' — DF or span inputs edited after the pull':'');
  }
  function paint(){
    var n=el('lxNew'); if(n) n.classList.toggle('hidden',!(window.BridgeXfer&&BridgeXfer.isNew(CH,RID)));
    var s=el('lxSrc'); if(s) s.textContent=SRC?srcText():'';
  }
  el('lxPull').onclick=function(){
    if(!window.BridgeXfer){ alert('Hand-off is not available in this browser.'); return; }
    var r=BridgeXfer.read(CH,SCHEMA,VER);
    if(r.error){ alert('Cannot pull DFs from LL & DL Distribution: '+r.error+(r.empty?'\n\nIn lldf.html click "Send DFs to Design Apps" first, or use "Import hand-off (JSON)".':'')); return; }
    openDlg(r.payload,'storage');
  };
  el('lxImport').onclick=function(){ el('lxFile').click(); };
  el('lxFile').onchange=function(e){ var f=e.target.files&&e.target.files[0]; if(!f) return; e.target.value='';
    if(!window.BridgeXfer){ alert('Hand-off is not available in this browser.'); return; }
    BridgeXfer.importFile(f,SCHEMA,VER,function(r){ if(r.error){ alert('Cannot import the DF hand-off: '+r.error); return; } openDlg(r.payload,'file'); }); };
  window.addEventListener('storage',function(e){ if(!e.key||e.key.indexOf(BridgeXfer.NS+CH)===0) paint(); });
  window.addEventListener('focus',paint);

  /* manual edits after a pull are flagged in the source line */
  document.addEventListener('input',function(e){
    if(applying||!SRC||SRC.edited) return;
    var id=e.target&&e.target.id||'';
    if(/^(dfm\d|dfv\d|dfNeg|L\d|nSpans)$/.test(id)){ SRC.edited=true; paint(); }
  },true);

  /* ---- saved state: new optional field 'lldfSource' (old saves load unchanged) ---- */
  var _snap=mlgSnapshot; mlgSnapshot=function(){ var d=_snap(); if(SRC) d.lldfSource=SRC; return d; };
  var _apl=mlgApply; mlgApply=function(d){ _apl(d); SRC=(d&&d.lldfSource&&typeof d.lldfSource==='object')?d.lldfSource:null; paint(); };
  try{ var sv=JSON.parse(localStorage.getItem(MLG_KEY)||'null');
    if(sv&&sv.schema===MLG_SCHEMA&&sv.lldfSource&&typeof sv.lldfSource==='object') SRC=sv.lldfSource; }catch(e){}

  /* ---- fatigue-truck warning: name the lldf fatigue DFs ---- */
  function fatLine(){
    if(!SRC||(SRC.fatM==null&&SRC.fatV==null)) return '';
    return 'From '+SRC.producer+' ('+when(SRC.producedAt)+', '+SRC.girderLabel+'): use g_fat = '+f4(SRC.fatM)+' (moment) and '+f4(SRC.fatV)+' (shear)'+
      (SRC.fatNegM!=null?', '+f4(SRC.fatNegM)+' (negative moment at piers)':'')+
      ' — one-lane DF ÷ 1.2, skew included. They are NOT applied automatically; the DF inputs above hold lldf\'s strength DFs.';
  }
  var _an=analyze; analyze=function(m){
    var R=_an(m);
    try{ var t=(m&&m.short==='Fatigue'&&!m.rail)?fatLine():'';
      if(t){ var i=-1; R.warn.forEach(function(w,k){ if(i<0&&/^LRFD fatigue truck/.test(w)) i=k; });
        if(i>=0) R.warn[i]+=' '+t; else R.warn.push(t); } }catch(e){}
    return R;
  };

  /* ---- printed report: DF source row ---- */
  var _rh=reportHTML; reportHTML=function(out,o,base,dk){
    var x=_rh(out,o,base,dk); if(!SRC) return x;
    var row='<tr><td>Distribution factor source</td><td>'+h(srcText())+'</td></tr>';
    return x.split('<tr><td>Distribution factors</td>').join(row+'<tr><td>Distribution factors</td>');
  };

  paint();
  if(SRC) run();   // re-render so a restored fatigue warning shows the lldf g_fat (results unchanged)
  window.MLGlldf={ openDlg:openDlg, apply:apply, refresh:refresh, validate:validate, makePlan:makePlan, src:function(){ return SRC; }, srcText:srcText };
})();
</script>
  ```
- **Check case:** n/a for results (no formula change). Mapping check: lldf 2 spans 100 + 120 ft, skew 20°, 5 girders @ 9.75 ft → interior: span 1 DF moment 1.00 → 0.7598, DF shear 1.00 → 0.9898; span 2 1.00 → 0.7234 / 1.00 → 0.9929; negative moment DF (blank) → 0.7405. Then Strength I, span 1 at 0.4L: unfactored +M per lane with IM 2291.6 kip-ft × 1.75 × 0.7598 = 3047.1 kip-ft.
- **How verified:** `node --check` on every plain inline script of both files (no JSX in either). End-to-end in node/jsdom with one shared localStorage stub (64 checks, all pass): lldf.html loaded, set to 2 spans 100 + 120 ft, skew 20°, defaults otherwise (5 girders @ 9.75 ft, Kg = 1,255,067 in⁴), its real "Send DFs to Design Apps" button clicked; Moving Load Generator.html loaded on the same storage, real "Pull from LL & DL Distribution" → dialog → Apply. Inputs checked equal to the mapped values (interior: span 1 0.7598 / 0.9898, span 2 0.7234 / 0.9929, negative moment 0.7405); exterior and per-beam choices checked; spans only changed with the option ticked; rail DFs untouched; adopted marker written; `lldfSource` in the autosave and restored on reload; fatigue warning quotes g_fat 0.4352 / 0.6638 / 0.4208 and the analysis still uses the DF inputs; report has the source row. JSON export (lldf) → import (Moving Load) round trip. Refusals: wrong `_schema`, `schemaVersion` 2, corrupt JSON (storage and file), negative DF, DF as a string, non-finite span, `units.spans:"m"`. Hand check of span 1 interior: Table 4.6.2.2.2b-1, Kg/(12 L ts³) = 1,255,067 / (12 × 100 × 512) = 2.0428; g = 0.075 + (9.75/9.5)^0.6 (9.75/100)^0.2 (2.0428)^0.1 = 0.7598 (two lanes, governs over one lane 0.5222; skew 20° < 30° so no moment reduction); shear 0.2 + 9.75/12 − (9.75/35)² = 0.9349 × skew factor 1 + 0.20 (1/2.0428)^0.3 tan 20° = 1.0588 → 0.9898. Both match lldf and the values written into Moving Load. No result change: with no hand-off, Moving Load results (all 342 section/reaction extremes in the default, a 3-span and the fatigue configuration, plus the metric tiles and warnings) are byte-identical to the file before this change. lldf: the existing payload fields from the old and new files are identical (only timestamps differ).
- **Other copies:** BridgeXfer v1 is also in index.html, lldf.html, psbeam.html, stgirder.html and the other step-1 tools (unchanged here). The receiver block exists only in this file.
- **Open items:** (1) This tool has one negative-moment DF; lldf's `governingNeg` is the envelope over all interior supports, so for 3–4 spans the larger pier DF is used at every pier (conservative). (2) Fatigue DFs are not applied because the DFs are not per vehicle; a per-vehicle DF would be a separate change.

## 2026-10-09 — PR: claude/tabs-movingload (PR #61: https://github.com/mlococo88/All-Structural/pull/61)

### T1. Input panel split into tabs   [UI only — no calculation change]
- **Date / type:** 2026-10-09, UI only (no result change). Engineer's request of 2026-10-09: "Go through all the apps and make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel." Same approach as `Steel Beam Design - AISC 15th.html` T1: build every section exactly as before, then **move** the finished DOM nodes into tab panes.
- **Where:** one new `<script>` block inserted at the very end of the file, after the last existing `</script>` (the lldf hand-off receiver, anchor `window.MLGlldf={ openDlg:openDlg`) and before `</body>`. No existing line was edited.
- **How it works:** the scripts above still build all six `<details>` sections of the input panel (`<aside>`), including the Girder Section panel that is inserted after "Spans" at load. The new block then **moves** each `<details>` node into one tab pane (`div.mlgInPane` with `role="tabpanel"`) under a new tab strip (`#mlgInTabs`, `role="tablist"`). The section is identified by its `<summary>` text; a node not in the map stays with the section before it. Nothing is rebuilt or re-templated, so every id, `data-i` / `data-k`, value and handler is unchanged. The delegated `input` listeners on `<aside>` and the save selector `aside input[id], aside select[id]` still see every field, in the same document order (so the autosave and Save JSON are identical, key order included). The repeating blocks — axle rows (`#axles`), girder segment blocks (`#segList`) and the span / DF rows (`#spanInputs`, `#dfT`) — are re-rendered into their existing containers, which are inside their tab, so added axles / segments / spans land in the right tab. Each section keeps its own collapsible `<summary>` header. A tab with no inputs is hidden (none is, today: this tool has no modes that remove a whole section).
- **Tabs (in order) and the sections in each:**

| Tab | Section (`<summary>` text) | Inputs |
|---|---|---|
| Spans | Spans | number of spans, span lengths `L0..L3`, `Es` |
| Girder | Girder Section (`#secPanel`) | composite, deck (n, b_eff, t_s, haunch, haunch reference, include haunch), segment blocks (`data-i` / `data-k`), + Segment / − Last |
| Vehicle | Vehicle | preset, axle rows, + Axle / − Last axle |
| Rules | Load Model Rules | uniform load mode / w / gap / truncation, variable spacing, neglect axles, both directions, secondary vehicle, multi-vehicle case |
| Impact | Impact | method, multiplier, AREMA S / ballast / L basis / user L, impact on uniform load |
| Factors | Factors & Analysis | limit state, LLF, highway DFs, negative-moment DF, rail DFs / rail option, Pull from LL & DL Distribution / Import hand-off, position and spacing steps, refine option |

- **Error marker:** a red dot on a tab when (a) a number field in it holds text the browser cannot parse (`validity.badInput`), or (b) the tool's own warning box / analysis error names an input on it: `E steel …` / `Every span length …` → Spans; `Segment lengths reach …` / `A segment has invalid geometry …` → Girder; `One or more axles have zero …` → Vehicle; `Variable spacing …` / `The multi-vehicle case needs …` / `A uniform load mode is selected …` → Rules; `The impact multiplier …` → Impact; `One or more distribution factors …` → Factors. The advisory fatigue-truck note is not marked (it is shown for every fatigue run, whatever the inputs). Refreshed on every input and after every run (observer on `#status`). Reads `RES.warn` and `#status` only; nothing in the analysis was touched.
- **Keyboard / accessibility:** `role="tablist"` / `role="tab"` (`aria-selected`, `aria-controls`) / `role="tabpanel"` (`aria-labelledby`); roving `tabindex`; ←/→ (and ↑/↓), Home and End move between the visible tabs.
- **New storage key:** `movingLoadGen.inputTab.v1` (localStorage, plain string: `spans`, `girder`, `vehicle`, `rules`, `impact` or `factors`), same prefix as the existing autosave key `movingLoadGen.autosave.v1`. It remembers the active input tab per browser. Every read and write is in try/catch, with an in-memory copy when storage is blocked. It is **not** part of the autosave, the Save JSON file or any hand-off; no existing key or format changed.
- **Programmatic focus / scroll:** nothing in this tool focuses or scrolls to an input in the panel (the only `scrollIntoView` calls target result cards in `<main>`), and Open JSON / autosave restore / lldf pull only set values; so no tab switching is needed for them.
- **Print:** the printed report is a separate window built from data, unchanged. For a browser print of the page itself, `@media print` hides the tab strip and shows every pane, so the page prints all sections as before.
- **Narrow screens (≤ 900 px, panel above the results):** the tab strip wraps. The existing header has a fixed 54 px height and its buttons already spill below it at narrow widths (unchanged, see open item); so in this range the strip starts and sticks at the header's real height (`--mlgHdrH` = header `scrollHeight`, measured on load, resize and each run), and `aside` gets `overflow:visible` there so the strip can stick to the page. No horizontal page scroll at 400 px (document scroll width = 400). Desktop: sticky at the top of the scrolling panel, one row.
- **Governing provision:** none (no engineering change).
- **Before / After** (file uses CRLF; the inserted lines use CRLF):
  - Before (anchor, end of file, unchanged):
    ```html
      window.MLGlldf={ openDlg:openDlg, apply:apply, refresh:refresh, validate:validate, makePlan:makePlan, src:function(){ return SRC; }, srcText:srcText };
    })();
    </script>
    </body>
    </html>
    ```
  - After: the following block inserted between that `</script>` and `</body>`:
    ```html
    <script>
    /* ═══════════ INPUT PANEL TABS (UI only — no calculation change) ═══════════
       Every <details> section of the input panel (<aside>) is built exactly as before by the
       scripts above; this block then MOVES the finished section nodes into one tab pane per
       section. Nothing is rebuilt, so every id, data-i/data-k, handler and value is untouched;
       the delegated 'input' listeners on <aside> and the 'aside input[id]' save selector still
       see every field, in the same document order. Repeating blocks (axles, girder segments,
       span / DF rows) are re-rendered into their existing containers, so they stay in their tab.
       The active tab is remembered per browser in localStorage key 'movingLoadGen.inputTab.v1'
       (same prefix as the autosave key 'movingLoadGen.autosave.v1'); it is NOT part of the
       autosave, the Save JSON file or any hand-off. */
    (function(){
      var TABS=[['spans','Spans'],['girder','Girder'],['vehicle','Vehicle'],['rules','Rules'],['impact','Impact'],['factors','Factors']];
      var SEC={'Spans':'spans','Girder Section':'girder','Vehicle':'vehicle','Load Model Rules':'rules','Impact':'impact','Factors & Analysis':'factors'};
      /* the tool's own warnings / analysis errors, mapped to the tab holding the input they name */
      var MSG=[
        [/^E steel|^Every span length/,'spans'],
        [/^Segment lengths reach|^A segment has invalid geometry/,'girder'],
        [/^One or more axles have zero/,'vehicle'],
        [/^Variable spacing|^The multi-vehicle case needs|^A uniform load mode is selected/,'rules'],
        [/^The impact multiplier/,'impact'],
        [/^One or more distribution factors/,'factors']];
      var KEY='movingLoadGen.inputTab.v1', cur=null;
      function tget(){ if(cur) return cur; try{ return localStorage.getItem(KEY)||''; }catch(e){ return ''; } }
      function tset(t){ cur=t; try{ localStorage.setItem(KEY,t); }catch(e){} }
      var A=document.querySelector('aside'); if(!A) return;
      document.head.insertAdjacentHTML('beforeend','<style>'+
        '#mlgInTabs{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;background:#fff;border-bottom:1px solid #e2e8f0;padding:0 6px}'+
        '#mlgInTabs .mlgInTab{display:inline-flex;align-items:center;padding:10px 6px 8px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;cursor:pointer;font-family:inherit;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b}'+
        '#mlgInTabs .mlgInTab:hover{color:#334155;background:#f8fafc}'+
        '#mlgInTabs .mlgInTab[aria-selected="true"]{color:#4f46e5;border-bottom-color:#4f46e5;background:#eef2ff}'+
        '#mlgInTabs .mlgInTab:focus-visible{outline:2px solid #6366f1;outline-offset:-2px}'+
        '.mlgInDot{display:none;width:7px;height:7px;border-radius:50%;background:#dc2626;margin-left:5px;box-shadow:0 0 0 1.5px #fff}'+
        '.mlgInTab.has-err .mlgInDot{display:inline-block}'+
        '.mlgInTab[hidden],.mlgInPane[hidden]{display:none!important}'+
        '@media(max-width:900px){aside{overflow:visible}#mlgInTabs{top:var(--mlgHdrH,54px);margin-top:calc(var(--mlgHdrH,54px) - 54px)}}'+
        '@media print{#mlgInTabs{display:none!important}.mlgInPane[hidden]{display:block!important}}'+
        '</style>');
      var bar=document.createElement('div'); bar.id='mlgInTabs'; bar.setAttribute('role','tablist'); bar.setAttribute('aria-label','Input groups');
      var panes={};
      TABS.forEach(function(t){
        var b=document.createElement('button'); b.type='button'; b.className='mlgInTab'; b.id='mlgInTab_'+t[0]; b.dataset.pane=t[0];
        b.setAttribute('role','tab'); b.setAttribute('aria-controls','mlgInPane_'+t[0]);
        var s=document.createElement('span'); s.textContent=t[1]; b.appendChild(s);
        var d=document.createElement('span'); d.className='mlgInDot'; d.setAttribute('aria-hidden','true'); b.appendChild(d);
        b.addEventListener('click',function(){ setTab(t[0],true); });
        b.addEventListener('keydown',onKey);
        bar.appendChild(b);
        var p=document.createElement('div'); p.className='mlgInPane'; p.id='mlgInPane_'+t[0];
        p.setAttribute('role','tabpanel'); p.setAttribute('aria-labelledby','mlgInTab_'+t[0]);
        panes[t[0]]=p;
      });
      /* move the built nodes; a node not in the map stays with the section before it */
      var c='spans';
      Array.prototype.slice.call(A.childNodes).forEach(function(n){
        var sm=n.tagName==='DETAILS'&&n.querySelector('summary'), k=sm&&SEC[sm.textContent.trim()];
        if(k) c=k;
        panes[c].appendChild(n);
      });
      A.appendChild(bar);
      TABS.forEach(function(t){ A.appendChild(panes[t[0]]); document.getElementById('mlgInTab_'+t[0]).hidden=!panes[t[0]].querySelector('details,input,select'); });
      function setTab(t,remember){
        TABS.forEach(function(x){
          var b=document.getElementById('mlgInTab_'+x[0]), p=panes[x[0]], on=x[0]===t;
          b.setAttribute('aria-selected',on?'true':'false'); b.tabIndex=on?0:-1; p.hidden=!on;
        });
        if(remember){ tset(t); A.scrollTop=0; }
      }
      function onKey(e){
        var vis=TABS.map(function(x){ return document.getElementById('mlgInTab_'+x[0]); }).filter(function(b){ return !b.hidden; });
        var i=vis.indexOf(e.currentTarget), j=-1;
        if(e.key==='ArrowRight'||e.key==='ArrowDown') j=(i+1)%vis.length;
        else if(e.key==='ArrowLeft'||e.key==='ArrowUp') j=(i-1+vis.length)%vis.length;
        else if(e.key==='Home') j=0;
        else if(e.key==='End') j=vis.length-1;
        if(j<0) return;
        e.preventDefault(); setTab(vis[j].dataset.pane,true); vis[j].focus();
      }
      /* red dot: a number the browser cannot parse, or a warning / analysis error of the tool
         itself that names an input on that tab */
      function marks(){
        var bad={};
        A.querySelectorAll('.mlgInPane input').forEach(function(i){
          if(i.validity&&i.validity.badInput){ var p=i.closest('.mlgInPane'); if(p) bad[p.id.replace('mlgInPane_','')]=1; }
        });
        var st=(document.getElementById('status')||{}).textContent||'', msgs=[];
        if(/^Error: /.test(st)) msgs.push(st.slice(7));
        else if(typeof RES!=='undefined'&&RES&&RES.warn) msgs=RES.warn;
        msgs.forEach(function(w){ MSG.forEach(function(r){ if(r[0].test(w)) bad[r[1]]=1; }); });
        TABS.forEach(function(t){
          var b=document.getElementById('mlgInTab_'+t[0]);
          b.classList.toggle('has-err',!!bad[t[0]]);
          b.title=bad[t[0]]?'An input on this tab needs attention':'';
        });
      }
      /* narrow screens (<= 900 px, panel above the results): the header buttons can wrap below
         its fixed 54 px height, so the tab strip sticks (and starts) below the header's real height */
      var hdr=document.querySelector('.hdr');
      function hdrFit(){ if(hdr) A.style.setProperty('--mlgHdrH',Math.max(54,hdr.scrollHeight)+'px'); }
      window.addEventListener('resize',hdrFit);
      var stEl=document.getElementById('status');
      if(stEl&&window.MutationObserver) new MutationObserver(function(){ marks(); hdrFit(); }).observe(stEl,{childList:true,characterData:true,subtree:true});
      hdrFit();
      A.addEventListener('input',marks); A.addEventListener('change',marks);
      var t=tget(); if(!panes[t]||document.getElementById('mlgInTab_'+t).hidden) t='spans';
      setTab(t,false);
      marks();
    })();
    </script>
    ```
- **Check case:** n/a for results. Default (2 × 100 ft, HL-93 truck, Strength I, DF 1.00): Max +M 3932.2 kip-ft, Max −M −4049.2 kip-ft, Max +V 227.7 kips, Max −V −227.6 kips, Max reaction 365.4 kips — before and after. Set E steel = 0: status "Error: E steel = 0 ksi …", red dot on Spans. Set span 1 DF moment = 0: warning "One or more distribution factors are zero or blank.", red dot on Factors.
- **How verified:** `node --check` on all four inline scripts. Headless Chromium (Playwright), original file (origin/main) vs this branch, in the same sequence: default; all 13 presets (12 + Custom); 1, 3, 4, 2 spans; uniform load modes lane / trail / full / none; AREMA impact; multi-vehicle; + Segment; + Axle; E = 0 error; DF = 0 warning. For every step the whole results text of `<main>`, the status, the warning box, every results canvas (size + image data), `mlgSnapshot()` and the autosave JSON (`savedAt` removed) are **identical**. Save → load round trip (`mlgSnapshot` → `mlgApply` → `mlgSnapshot`) identical. FHWA benchmark and closed-form check text identical. Print Report (all presets, tenth-point tables) HTML identical. "Share project info" `bridgeSuite.v1.projectMeta` payload identical (timestamp removed). lldf hand-off: buttons present; pull + apply of a test payload gives identical results and saved state (`adoptedAt` removed). Input inventory (tag, id, name, class, `data-i`, `data-k`, type) of all 99 inputs / selects identical; all 71 in the panel are each in exactly one pane (Spans 4, Girder 23, Vehicle 9, Rules 14, Impact 7, Factors 14). Keyboard (→, End, → wraps, Home, ←), tab remembered after reload, red dots (above, plus typed "1e" in E → Spans), print media (tab strip hidden, all 6 panes shown) checked. No horizontal scroll at 1400 px or 400 px. Console errors: only the tool's own `console.error` for the deliberate E = 0 case, the same on main. Screenshots of every tab at 1400 px and 400 px inspected.
- **Other copies of this code:** none.
- **Open items:** (1) Pre-existing, not changed: at narrow widths (seen at 400 px) the header's buttons wrap beyond its fixed 54 px height; some spill below it and the top ones are cut off above the page. The tab strip is placed below the spill, but the header itself was left as it is. (2) The Spans hint still says the girder is defined "in the Girder Section panel below"; it is now on the Girder tab (text left unchanged).

## 2026-10-12 — PR: claude/sweep-movingload (PR #151: https://github.com/mlococo88/All-Structural/pull/151)

Open-item sweep (inventory section 5: MLG-O1 … O6, MLG-H1, MLG-T1). Engineer's instruction of 2026-10-12: work through every open item, use a defensible default, and list what needs the engineer. The file keeps its CRLF line endings. Exact before/after code of every hunk is in the `diff` blocks below (`-` = before, `+` = after); anchors are given for each.

**Results that change:** HS20 and H20 presets (lane loading now checked: MORE conservative), blank E or span (now an input error instead of a silent default). **Opt-in, no change unless selected or entered:** the Std. Spec. impact option, the fatigue truck DFs. **Unchanged:** every other preset and configuration (verified identical, see "How verified").

**Saved data (CLAUDE.md §5):** no key or format changed. New optional fields in `fields` of `movingLoadGen.autosave.v1` / Save JSON: `stdLane`, `slW`, `slPM`, `slPV`, `fDFm`, `fDFv`, `fDFn`; `impM` may now also hold `'std'`. New optional field in `lldfSource`: `fatSet`. An old save has none of them: the lane check stays **off** and the fatigue DFs stay blank, so an old project reloads with **identical results** (verified), and an HS20 / H20 project shows the warning "the AASHTO Std. Spec. lane loading is not checked". The new inputs are inside `<aside>`, so the existing save selector picks them up with no change to the save code.

### F6 (MLG-O1). HS20 / H20: AASHTO Std. Spec. lane loading added as a separate case   [calc — MORE conservative]
- **Where:** Load Model Rules panel (anchor `id="udlTrunc"`), presets `const HW=` / `'HS20':HW(` / `'H20':HW(`, `applyPreset`, `syncVis`, `readModel`, `analyze` (anchor `AASHTO Std. Spec. lane loading, separate case enveloped`), `modelFor`, `drawVehicle` (`vehInfo`), the governing-case formatters `G=g=>g?` (render, report ×2, CSV), a `jumpTo` wrapper (anchor `Std. Spec. lane case: no vehicle position`), `loadClosedForm`, tab error map (`MSG`).
- **Problem:** the HS20 / H20 presets modelled the truck only. Std. Spec. Art. 3.7.1.1 requires the truck **or** the lane loading, whichever governs; the lane loading governs negative moment and pier reactions of continuous spans from short spans on, and positive moment for long spans. Unconservative.
- **Governing provision:** AASHTO Standard Specifications for Highway Bridges, 17th Ed. (2002): Art. 3.7.1.1 and Fig. 3.7.6B (H20-44 / HS20-44 lane loading: 0.64 k/ft + 18 k concentrated load for moment, 26 k for shear); Art. 3.11.3 (continuous spans: for maximum negative moment a second, equal concentrated load in one other span; for positive moment one concentrated load); Art. 3.8.1 (impact applies to the lane loading). Article numbers from the 17th Ed.; verify against the printed edition.
- **Model:** a separate case, enveloped with the truck cases, per effect (each section M and V, each reaction):
  - max = I⁺ · (w · A⁺ + P · η_max), min = I⁻ · (w · A⁻ + P · η_min [+ P · η_min,other span]),
  - A⁺ / A⁻ = positive / negative influence-line area (the uniform load is patterned on the influence line, as the existing "Lane" mode does), η = influence ordinate; P = P moment (18 k) for moment effects, P shear (26 k) for shear **and reactions**; the second concentrated load is added only for the negative moment of a moment effect with 2 or more spans, at the most negative ordinate in a span other than the one holding the first load.
  - Impact: the effect's impact (constant, AREMA or the new Std. Spec. option) is applied to the whole lane case, whatever "Apply impact to uniform load" says (Std. Spec. 3.8.1).
  - Where it governs, the governing-case label reads `Std. lane 18k @x'` / `Std. lane 2×18k @x'` / `Std. lane 26k @x'` (x = first concentrated load). Clicking such a value explains that there is no vehicle position for step mode.
- **Defaults (and why):** the HS20 and H20 presets now switch the lane check **on** (0.64 / 18 / 26, the code values for both H20-44 and HS20-44), because the spec requires it. Every other preset switches it off. Preset keys are unchanged; the labels become "HS20 Truck + Std. Spec. lane loading" / "H20 Truck + Std. Spec. lane loading". The closed-form check (which loads HS20 and is a truck-only exact solution) switches the lane check off after loading the preset, so its results are unchanged.
- **Before / After:**
  ```diff
  -const HW=(label,axles,o={})=>Object.assign({label,axles,udl:{mode:'lane',w:0.64,gap:0,trunc:false},vary:NOV,neglect:true,secondary:'',multi:{on:false,scale:0.9,hmin:50,fixed:14},imp:{method:'const',val:1.33,onUdl:false}},o);
  +const NOSL={on:false,w:0.64,PM:18,PV:26}, SL20={on:true,w:0.64,PM:18,PV:26};   // AASHTO Std. Spec. 17th Ed. Fig. 3.7.6B (H20-44 / HS20-44 lane loading)
  +const HW=(label,axles,o={})=>Object.assign({label,axles,udl:{mode:'lane',w:0.64,gap:0,trunc:false},vary:NOV,neglect:true,secondary:'',multi:{on:false,scale:0.9,hmin:50,fixed:14},imp:{method:'const',val:1.33,onUdl:false},stdLane:NOSL},o);
  -  'HS20':HW('HS20 Truck — truck only (no Std. Spec. lane load)',[[8,0],[32,14],[32,14]],{udl:NOUDL,vary:{k:3,min:14,max:30},neglect:false,imp:{method:'const',val:1.30,onUdl:false}}),
  -  'H20':HW('H20 Truck — truck only (no Std. Spec. lane load)',[[8,0],[32,14]],{udl:NOUDL,neglect:false,imp:{method:'const',val:1.30,onUdl:false}}),
  +  'HS20':HW('HS20 Truck + Std. Spec. lane loading',[[8,0],[32,14],[32,14]],{udl:NOUDL,vary:{k:3,min:14,max:30},neglect:false,imp:{method:'const',val:1.30,onUdl:false},stdLane:SL20}),
  +  'H20':HW('H20 Truck + Std. Spec. lane loading',[[8,0],[32,14]],{udl:NOUDL,neglect:false,imp:{method:'const',val:1.30,onUdl:false},stdLane:SL20}),
  ```
  Load Model Rules, after `<label class="chk" id="truncF">…</label>`:
  ```diff
  +    <label class="chk"><input type="checkbox" id="stdLane">AASHTO Std. Spec. lane loading, checked as a separate case</label>
  +    <div id="stdLaneF" class="g3">
  +      <div class="f"><label>w (k/ft)</label><input id="slW" type="number" step="0.01" value="0.64"></div>
  +      <div class="f"><label>P moment (kips)</label><input id="slPM" type="number" step="0.5" value="18"></div>
  +      <div class="f"><label>P shear (kips)</label><input id="slPV" type="number" step="0.5" value="26"></div>
  +    </div>
  +    <p class="hint" id="stdLaneH">AASHTO Std. Spec. 17th Ed. Art. 3.7.1.1, Fig. 3.7.6B (H20 / HS20: 0.64 k/ft + 18 k for moment, 26 k for shear and reactions) and Art. 3.11.3 (negative moment in continuous spans: a second, equal P moment in one other span). The uniform load is patterned on the influence line. Enveloped with the truck (truck OR lane, not both); impact is applied to the lane case. DFs here are per lane: a Std. Spec. wheel-line DF (e.g. S/5.5) must be divided by 2.</p>
  ```
  `applyPreset` (after the `$('impM').value=p.imp.method;…` line), `syncVis`, `readModel`, `modelFor`:
  ```diff
  +  const sl=p.stdLane||NOSL; $('stdLane').checked=sl.on; $('slW').value=sl.w; $('slPM').value=sl.PM; $('slPV').value=sl.PV;
  +  $('stdLaneF').classList.toggle('hidden',!$('stdLane').checked);
  +    stdLane:$('stdLane').checked?{w:num('slW',NaN),PM:num('slPM',NaN),PV:num('slPV',NaN)}:null,
  -    imp:{...m.imp,method:p.imp.method,val:p.imp.val,onUdl:p.imp.onUdl}};
  +    imp:{...m.imp,method:p.imp.method,val:p.imp.val,onUdl:p.imp.onUdl},stdLane:p.stdLane&&p.stdLane.on?{w:p.stdLane.w,PM:p.stdLane.PM,PV:p.stdLane.PV}:null};
  ```
  `analyze`, input check (after the span checks) and the lane case (inserted before `const warn=[]; let segSum=0;`):
  ```diff
  +  if(m.stdLane&&![m.stdLane.w,m.stdLane.PM,m.stdLane.PV].every(v=>isFinite(v)&&v>=0)) throw new Error('Std. Spec. lane loading: w, P moment and P shear must be numbers ≥ 0.');
  +  // ── AASHTO Std. Spec. lane loading, separate case enveloped with the truck (17th Ed. 3.7.1.1, Fig. 3.7.6B, 3.11.3; impact 3.8.1) ──
  +  // max = I+(w*positive IL area + P*max ordinate); min = I-(w*negative IL area + P*min ordinate [+ P*min ordinate in one other span, negative moment, 2+ spans])
  +  if(m.stdLane){const SL=m.stdLane;
  +    effs.forEach((ef,ei)=>{
  +      const P1=ef.t==='M'?SL.PM:SL.PV, D=DER[ei], spMin=m.spans.map(()=>[0,0]);
  +      let hi=0,xh=0,lo=0,xl=0,kl=-1,k=0;
  +      for(let j=0;j<nn-1;j++){const [a,bb]=ends(ei,j),xm=(x[j]+x[j+1])/2;while(k<ns-1&&xm>sup[k+1])k++;
  +        [[a,x[j]],[bb,x[j+1]]].forEach(([v,xv])=>{if(v>hi){hi=v;xh=xv;}if(v<lo){lo=v;xl=xv;kl=k;}if(v<spMin[k][0])spMin[k]=[v,xv];});}
  +      let lo2=0,x2=null;
  +      if(ef.t==='M'&&ns>1&&kl>=0)spMin.forEach(([v,xv],s)=>{if(s!==kl&&v<lo2){lo2=v;x2=xv;}});
  +      const vMax=imArr[ei]*(SL.w*D.lp+P1*hi), vMin=imMinArr[ei]*(SL.w*D.ln+P1*(lo+lo2)), r=res[ei];
  +      const lab=`Std. lane ${P1}k`;
  +      if(vMax>r.max+1e-9){r.max=vMax;r.maxG={lab,p:xh,dir:1,pos:[xh],lane:true};}
  +      if(vMin<r.min-1e-9){r.min=vMin;r.minG={lab:x2!=null?`Std. lane 2×${P1}k`:lab,p:xl,dir:1,pos:x2!=null?[xl,x2]:[xl],lane:true};}
  +    });
  +  }
  ```
  Warnings (after the fatigue warning):
  ```diff
  +  if(m.stdLane)warn.push(`Std. Spec. lane loading (${m.stdLane.w} k/ft + ${m.stdLane.PM} k moment / ${m.stdLane.PV} k shear and reactions; a second ${m.stdLane.PM} k in one other span for negative moment) is checked as a separate case and enveloped with the vehicle, with impact. Where it governs, the case reads "Std. lane" and "@" is the concentrated-load position.`);
  +  else if(m.short==='HS20'||m.short==='H20')warn.push(`${m.short}: the AASHTO Std. Spec. lane loading is not checked (Load Model Rules). It can govern longer spans (Std. Spec. 17th Ed. Art. 3.7.1.1, Fig. 3.7.6B).`);
  ```
  Display only (governing-case text; same change in `render`, both `reportHTML` and the active `exportCsv=function`):
  ```diff
  -  const G=g=>g?`${g.lab} ${g.dir>0?'→':'←'} @${g.p.toFixed(1)}'`:'—';
  +  const G=g=>g?(g.lane?`${g.lab} @${g.p.toFixed(1)}'`:`${g.lab} ${g.dir>0?'→':'←'} @${g.p.toFixed(1)}'`):'—';
  -  const f1=v=>(+v).toFixed(1), G=g=>g?`${g.lab} ${g.dir>0?'→':'←'} lead axle @ ${g.p.toFixed(1)}'`:'—';
  +  const f1=v=>(+v).toFixed(1), G=g=>g?(g.lane?`${g.lab} @ ${g.p.toFixed(1)}'`:`${g.lab} ${g.dir>0?'→':'←'} lead axle @ ${g.p.toFixed(1)}'`):'—';
  -  const F=(ei,v)=>view==='f'?m.llf*R.dfOf(effs[ei],v)*v:v,G=g=>g?`${g.lab} ${g.dir>0?'->':'<-'} @${g.p.toFixed(1)}`:'';
  +  const F=(ei,v)=>view==='f'?m.llf*R.dfOf(effs[ei],v)*v:v,G=g=>g?(g.lane?`${g.lab} @${g.p.toFixed(1)}`:`${g.lab} ${g.dir>0?'->':'<-'} @${g.p.toFixed(1)}`):'';
  -  const G=g=>g?`${g.lab} ${g.dir>0?'→':'←'} lead axle @ ${g.p.toFixed(1)}'`:'—';
  +  const G=g=>g?(g.lane?`${g.lab} @ ${g.p.toFixed(1)}'`:`${g.lab} ${g.dir>0?'→':'←'} lead axle @ ${g.p.toFixed(1)}'`):'—';
  ```
  `drawVehicle` summary, the `jumpTo` wrapper (after the `$('rB').addEventListener('click',…)` block), `loadClosedForm`, tab error map:
  ```diff
  -… · Impact: ${m.imp.method==='const'?m.imp.val:'AREMA formula'}${m.imp.onUdl?' (incl. uniform load)':''}`+
  +… · Impact: ${m.imp.method==='const'?m.imp.val:m.imp.method==='std'?'Std. Spec. 50/(L+125) ≤ 0.30':'AREMA formula'}${m.imp.onUdl?' (incl. uniform load)':''}${m.stdLane?` · Std. Spec. lane ${m.stdLane.w} k/ft + ${m.stdLane.PM} k / ${m.stdLane.PV} k (separate case, with impact)`:''}`+
  +// Std. Spec. lane case: no vehicle position to load into step mode
  +{const _jt=jumpTo;jumpTo=function(ei,isMax){const r=RES&&RES.res[ei],g=r&&(isMax?r.maxG:r.minG);
  +  if(g&&g.lane){$('stepNote').textContent=`The governing ${isMax?'max':'min'} at x = ${RES.effs[ei].x.toFixed(2)}' is the AASHTO Std. Spec. lane loading case (${g.lab} at ${g.pos.map(v=>v.toFixed(1)+"'").join(' and ')} + patterned uniform load), not a vehicle position, so it cannot be shown in step mode.`;$('stepCard').scrollIntoView({behavior:'smooth',block:'start'});return;}
  +  return _jt(ei,isMax);};}
  -  $('preset').value='HS20';applyPreset('HS20');$('impM').value='const';$('impV').value=1;
  +  $('preset').value='HS20';applyPreset('HS20');$('stdLane').checked=false;$('impM').value='const';$('impV').value=1;
  -    [/^Variable spacing|^The multi-vehicle case needs|^A uniform load mode is selected/,'rules'],
  +    [/^Variable spacing|^The multi-vehicle case needs|^A uniform load mode is selected|^Std\. Spec\. lane loading: /,'rules'],
  ```
- **Check case (hand-checkable):** default inputs (2 × 100 ft, uniform section, DF 1.00, LLF 1.75, impact 1.30 constant), preset HS20.
  - −M at the pier. Before (truck only): −866.5 kip-ft per lane → × 1.75 = **−1516.4** kip-ft. After: uniform w on both spans: 0.125 · 0.64 · 100² = 800.0; concentrated loads at the peak ordinate of M_B, a = L/√3 = 57.7 ft: η = a(L² − a²)/(4L²) = 57.7 × 6,666.7 / 40,000 = 9.62 ft; two 18 k loads (Art. 3.11.3): 2 × 18 × 9.62 = 346.4; (800.0 + 346.4) × 1.30 = 1490.3 kip-ft per lane (tool 1490.25) → × 1.75 = **−2607.9** kip-ft.
  - Pier reaction B. Before: **161.8** kips. After: 0.64 × (1.25 × 100) + 26 × 1.0 = 106.0; × 1.30 = 137.8; × 1.75 = **241.1** kips (tool 241.1).
  - +M at 0.4L: 2803.4 kip-ft before and after (the truck governs).
  - 3 spans 150 + 200 + 150 ft: max −M −2909.7 → −6433.4, max +M 4852.7 → 5409.8, max reaction 163.2 → 360.6 kips.
  - **MORE conservative** (the envelope can only grow).

### F7 (MLG-O1). Impact option: AASHTO Std. Spec. I = 50/(L + 125) ≤ 0.30   [calc — opt-in; LESS conservative than the 1.30 constant when chosen]
- **Where:** Impact panel (`<select id="impM">`, new hint `#impSF`), `syncVis`, `analyze` (anchor `const stdL=(ef,isMax)=>`), the sweep (`act.push`, `for(const [ei,dMax,dMin,im,cutEl,cutL,imn] of act)`), `refineAt`, `laneMin`, CSV "Impact" row.
- **Problem:** HS20 / H20 used only a constant 1.30 (the Std. Spec. maximum), with no way to use the span-dependent value. Conservative, so the default is **unchanged**: the presets still load 1.30 and the new method is an option.
- **Governing provision:** AASHTO Std. Spec. 17th Ed. Art. 3.8.2.1 (I = 50/(L + 125), max 30 %) and Art. 3.8.2.2 (loaded length L).
- **L used (verify for continuous spans):** positive moment = span length (pier sections: mean of the adjacent spans, as before); negative moment = mean of the two spans next to the nearest interior support (3.8.2.2(d)); shear = loaded length from the section to the far reaction of its span (3.8.2.2(c)): +V → to the right support, −V → to the left support (+V is produced by loads to the right of the section in this tool; checked on the influence line); reactions = mean of the adjacent spans (end reactions: the end span). Step mode and deflection use the span-length value.
- **Engine change:** the impact can now differ between the max and the min of one effect, so a second array `imMinArr` is passed to the min term. For the constant and AREMA methods `imMinArr[i] === imArr[i]`, so their results are bit-for-bit unchanged (verified).
  ```diff
  -  const imOf=ef=>{if(m.imp.method==='const')return m.imp.val;
  +  // AASHTO Std. Spec. 17th Ed. 3.8.2.1: I = 50/(L+125) <= 0.30; L per 3.8.2.2 (isMax: + effect, else − effect)
  +  const stdL=(ef,isMax)=>{const S=m.spans,k=ef.spans[0];
  +    if(ef.t==='V'){const a=sup[k],b=sup[k+1];return isMax?b-ef.x:ef.x-a;}
  +    if(ef.t==='M'&&!isMax&&ns>1){if(ef.spans.length>1)return (S[ef.spans[0]]+S[ef.spans[1]])/2;
  +      const q=k===0?1:k===ns-1?ns-1:(ef.x-sup[k]<=sup[k+1]-ef.x?k:k+1);return (S[q-1]+S[q])/2;}
  +    return ef.spans.reduce((a,s)=>a+S[s],0)/ef.spans.length;};
  +  const imOf=(ef,isMax=true)=>{if(m.imp.method==='std')return 1+Math.min(0.30,50/(Math.max(0,stdL(ef,isMax))+125));
  +    if(m.imp.method==='const')return m.imp.val;
  -  const imArr=effs.map(imOf);
  +  const imArr=effs.map(ef=>imOf(ef,true)), imMinArr=effs.map((ef,i)=>m.imp.method==='std'?imOf(ef,false):imArr[i]);
  -  const laneMin=effs.map((ef,ei)=>{const uf=m.imp.onUdl?imArr[ei]:1;return m.udl.mode==='lane'?uf*uw*DER[ei].ln:uf*uw*DER[ei].end;});
  +  const laneMin=effs.map((ef,ei)=>{const uf=m.imp.onUdl?imMinArr[ei]:1;return m.udl.mode==='lane'?uf*uw*DER[ei].ln:uf*uw*DER[ei].end;});
  -    const act=[]; effs.forEach((ef,ei)=>{const s=cfg.sel(ef);if(s[0]||s[1])act.push([ei,s[0],s[1],imArr[ei],ef.t==='V'?ef.el:-1,ef.cutL]);});
  +    const act=[]; effs.forEach((ef,ei)=>{const s=cfg.sel(ef);if(s[0]||s[1])act.push([ei,s[0],s[1],imArr[ei],ef.t==='V'?ef.el:-1,ef.cutL,imMinArr[ei]]);});
  -        for(const [ei,dMax,dMin,im,cutEl,cutL] of act){
  +        for(const [ei,dMax,dMin,im,cutEl,cutL,imn] of act){
  -          const uf=m.imp.onUdl?im:1;
  -          const vMax=cfg.scale*(im*axMax+uf*uMax+laneMax[ei]), vMin=cfg.scale*(im*axMin+uf*uMin+laneMin[ei]);
  +          const uf=m.imp.onUdl?im:1, ufn=m.imp.onUdl?imn:1;
  +          const vMax=cfg.scale*(im*axMax+uf*uMax+laneMax[ei]), vMin=cfg.scale*(imn*axMin+ufn*uMin+laneMin[ei]);
  -      const ef=effs[ei],f=IL[ei],im=imArr[ei],cutEl=ef.t==='V'?ef.el:-1;let tot=0,ps=0,ng=0;
  +      const ef=effs[ei],f=IL[ei],im=imArr[ei],imn=imMinArr[ei],cutEl=ef.t==='V'?ef.el:-1;let tot=0,ps=0,ng=0;
  -      const uf=m.imp.onUdl?im:1,vMax=cfg.scale*(im*axMax+uf*uMax+laneMax[ei]),vMin=cfg.scale*(im*axMin+uf*uMin+laneMin[ei]),r=res[ei];
  +      const uf=m.imp.onUdl?im:1,ufn=m.imp.onUdl?imn:1,vMax=cfg.scale*(im*axMax+uf*uMax+laneMax[ei]),vMin=cfg.scale*(imn*axMin+ufn*uMin+laneMin[ei]),r=res[ei];
  ```
  HTML / UI:
  ```diff
  -      <select id="impM"><option value="const">Constant multiplier</option><option value="arema">AREMA steel (span-dependent)</option></select></div>
  +      <select id="impM"><option value="const">Constant multiplier</option><option value="arema">AREMA steel (span-dependent)</option><option value="std">AASHTO Std. Spec. 50/(L + 125) ≤ 0.30</option></select></div>
  +    <p class="hint" id="impSF">AASHTO Std. Spec. 17th Ed. Art. 3.8.2.1: I = 50/(L + 125) ≤ 0.30. L per Art. 3.8.2.2: positive moment = span length; negative moment = mean of the two spans adjacent to the nearest interior support; shear = loaded length from the section to the far reaction of its span (+V: to the right support, −V: to the left support); reactions = mean of the adjacent spans. Verify the shear and reaction L for continuous spans.</p>
  -  const um=$('udlMode').value, ar=$('impM').value==='arema';
  +  const um=$('udlMode').value, ar=$('impM').value==='arema', sd=$('impM').value==='std';
  -  $('impCF').classList.toggle('hidden',ar);
  +  $('impCF').classList.toggle('hidden',ar||sd);
  +  $('impSF').classList.toggle('hidden',!sd);
  -    ['Impact',m.imp.method==='const'?m.imp.val:'AREMA steel formula'],…
  +    ['Impact',m.imp.method==='const'?m.imp.val:m.imp.method==='std'?'AASHTO Std. Spec. 50/(L+125) <= 0.30':'AREMA steel formula'],…
  ```
- **Check case:** 2 × 100 ft, HS20, lane check off, DF 1.00, LLF 1.75. Constant 1.30 → Std. Spec. option:
  - +M at 0.4L: L = 100, I = 50/225 = 0.222 → 2803.4 × 1.222/1.30 = **2635.7** (tool 2635.7).
  - +V at 0.0L: loaded length 100 → 1.222: 144.8 → **136.2**. −V at 0.0L: loaded length 0 → capped 0.30 → −15.2 (unchanged).
  - +V at 0.4L: loaded length 60, I = 50/185 = 0.270 → 68.3 × 1.270/1.30 = **66.7**.
  - −M at the pier: mean of spans = 100 → 1.222: −1516.4 → **−1425.7**. With the lane check on: −2607.9 → **−2451.9**; reaction 241.1 → 226.7.
  - LESS conservative than the 1.30 constant, and only when the engineer picks the option. The presets keep 1.30.

### F8 (MLG-O2). LRFD fatigue truck: its own DF set   [calc — opt-in; LESS conservative when entered]
- **Where:** Factors & Analysis (new inputs `fDFm`, `fDFv`, `fDFn` after the hint `LRFD DFs already include multiple presence`), `applyFam` (anchor `LRFD fatigue truck: its own DF set`), the fatigue warning in `analyze`, report inputs table, and the lldf hand-off receiver (`makePlan`, `fatHtml`, `apply`, `fatLine`, edit flag).
- **Problem:** the fatigue truck was analysed with the strength (multi-lane) DFs; only a warning (F1) said so. The tool had no per-vehicle DF. Conservative.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.6.1.4.3b and C3.6.1.1.2 (fatigue: one-lane DF with the multiple presence factor removed, ÷ 1.2).
- **Fix:** three optional inputs "LRFD fatigue truck DFs" (moment, shear, negative moment). When the vehicle is the LRFD Fatigue Truck preset (main view and report): a moment DF > 0 replaces the span moment DFs on every span, and the negative-moment DF is the fatigue negative DF if given, else the fatigue moment DF; a shear DF > 0 replaces the span shear DFs; a blank input keeps the highway DF, **so with all three blank (the default, and every old save) results are unchanged**. The fatigue warning says which DFs were used. The lldf pull now writes lldf's `fatM` / `fatV` (and `fatM` of the negative region when "Set the negative-moment DF" is ticked) into these inputs, listed in "This will overwrite"; before, they were only shown.
  ```diff
  +    <div class="lbl" style="margin-top:4px">LRFD fatigue truck DFs (blank = use the highway DFs above)</div>
  +    <div class="g3"><div class="f"><label>DF moment</label><input id="fDFm" type="number" step="0.01" placeholder="Same"></div><div class="f"><label>DF shear</label><input id="fDFv" type="number" step="0.01" placeholder="Same"></div><div class="f"><label>Neg. M DF</label><input id="fDFn" type="number" step="0.01" placeholder="Fatigue M"></div></div>
  +    <p class="hint">Used only for the LRFD Fatigue Truck preset (here and in the report): one-lane DF ÷ 1.2, LRFD 3.6.1.4.3b and C3.6.1.1.2. They replace the span DFs for every span.</p>
  -  else{m.dfM=m.spans.map((_,i)=>num('dfm'+i,1));m.dfV=m.spans.map((_,i)=>num('dfv'+i,1));m.dfNeg=num('dfNeg',0);}
  +  else{m.dfM=m.spans.map((_,i)=>num('dfm'+i,1));m.dfV=m.spans.map((_,i)=>num('dfv'+i,1));m.dfNeg=num('dfNeg',0);
  +    // LRFD fatigue truck: its own DF set (one-lane DF / 1.2, LRFD 3.6.1.4.3b, C3.6.1.1.2); blank = highway DFs (as before)
  +    if(key==='Fatigue'){const fm=num('fDFm',0),fv=num('fDFv',0),fn=num('fDFn',0);
  +      if(fm>0){m.dfM=Array(n).fill(fm);m.dfNeg=fn>0?fn:0;}else if(fn>0)m.dfNeg=fn;
  +      if(fv>0)m.dfV=Array(n).fill(fv);
  +      if(fm>0||fv>0||fn>0)m.fatDF={M:fm>0?fm:null,V:fv>0?fv:null,N:fn>0?fn:null};}}
  ```
  Fatigue warning in `analyze`:
  ```diff
  -  if(m.short==='Fatigue'){const ll=m.llf,fl=Math.abs(ll-1.75)<1e-9||Math.abs(ll-0.80)<1e-9;
  -    warn.push(`LRFD fatigue truck: the distribution factors and live load factor entered (LLF = ${ll}) are applied exactly as given. … Table 3.4.1-1.${fl?'':' The current LLF is not a fatigue load factor.'}`);}
  +  if(m.short==='Fatigue'){const ll=m.llf,fl=Math.abs(ll-1.75)<1e-9||Math.abs(ll-0.80)<1e-9,fd=m.fatDF;
  +    if(fd&&!m.rail)warn.push(`LRFD fatigue truck: the fatigue DFs entered under Factors & Analysis are used for this vehicle (moment ${fd.M!=null?fd.M:'= highway span DFs'}, shear ${fd.V!=null?fd.V:'= highway span DFs'}, negative moment ${fd.N!=null?fd.N:fd.M!=null?fd.M:'= highway DF'}); they should be the ONE-LANE DF divided by 1.2 (LRFD 3.6.1.4.3b, C3.6.1.1.2). LLF = ${ll}: use γ = 1.75 (Fatigue I) or 0.80 (Fatigue II), Table 3.4.1-1.${fl?'':' The current LLF is not a fatigue load factor.'}`);
  +    else warn.push(`LRFD fatigue truck: the distribution factors and live load factor entered (LLF = ${ll}) are applied exactly as given. … Table 3.4.1-1.${fl?'':' The current LLF is not a fatigue load factor.'}${m.rail?'':' Enter the fatigue DFs under Factors & Analysis to apply them to this vehicle.'}`);}
  ```
  (the "…" text is unchanged from F1.) Report inputs table (after `['Results basis',unit]`):
  ```diff
  +  {const fm=num('fDFm',0),fv=num('fDFv',0),fn=num('fDFn',0);if(fm>0||fv>0||fn>0)inp.splice(5,0,['LRFD fatigue truck DFs (fatigue truck only)',`moment ${fm>0?fm:'= highway span DFs'}, shear ${fv>0?fv:'= highway span DFs'}, negative moment ${fn>0?fn:fm>0?fm:'= highway DF'}`]);}
  ```
  lldf receiver (`makePlan`, `fatHtml`, `apply`, edit flag, `fatLine`):
  ```diff
  +    var fatN=(setNeg&&fat.negM!=null)?fat.negM:null;   // fatigue negative-moment DF follows the negative-moment tick box
  +    if(fat.M!=null) row('Fatigue truck DF moment',el('fDFm').value||'(blank)',fat.M);
  +    if(fat.V!=null) row('Fatigue truck DF shear',el('fDFv').value||'(blank)',fat.V);
  +    if(fatN!=null) row('Fatigue truck neg. M DF',el('fDFn').value||'(blank)',fatN);
  -    return {…,neg:neg,fat:fat,changes:ch,mine:mine};
  +    return {…,neg:neg,fat:fat,fatN:fatN,changes:ch,mine:mine};
  -    return '<b>Fatigue truck DFs (not applied):</b> g<sub>fat</sub> = …
  +    return '<b>Fatigue truck DFs:</b> g<sub>fat</sub> = …
  -      'This tool has one DF set for all vehicles, so these are <b>not</b> written to the DF inputs; they are repeated in the fatigue-truck warning.';
  +      'They are written to the <b>fatigue truck DF</b> inputs (used only for the LRFD Fatigue Truck preset), not to the highway DFs.';
  +      if(P.fat.M!=null) el('fDFm').value=String(P.fat.M);
  +      if(P.fat.V!=null) el('fDFv').value=String(P.fat.V);
  +      if(P.fatN!=null) el('fDFn').value=String(P.fatN);
  -      fatM:P.fat.M, fatV:P.fat.V, fatNegM:P.fat.negM, adoptedAt:new Date().toISOString(), edited:false};
  +      fatM:P.fat.M, fatV:P.fat.V, fatNegM:P.fat.negM, fatSet:(P.fat.M!=null||P.fat.V!=null), adoptedAt:new Date().toISOString(), edited:false};
  -    if(/^(dfm\d|dfv\d|dfNeg|L\d|nSpans)$/.test(id)){ SRC.edited=true; paint(); }
  +    if(/^(dfm\d|dfv\d|dfNeg|fDF[mvn]|L\d|nSpans)$/.test(id)){ SRC.edited=true; paint(); }
  -      ' — one-lane DF ÷ 1.2, skew included. They are NOT applied automatically; the DF inputs above hold lldf\'s strength DFs.';
  +      ' — one-lane DF ÷ 1.2, skew included'+(SRC.fatSet?'; written to the fatigue truck DF inputs by the pull.':'. This pull was made before the fatigue DF inputs existed, so they were not written; enter them under Factors & Analysis.');
  ```
- **Check case:** 2 × 100 ft, preset LRFD Fatigue Truck, LLF 1.75, highway DFs 1.00. Fatigue DF moment 0.40, shear 0.60: max +M 2084.2 → 2084.2 × 0.40 = **833.7** kip-ft (tool 833.7); max +V 125.8 → 125.8 × 0.60 = **75.5** kips (tool 75.5); max −M −1220.7 → × 0.40 (negative DF = fatigue moment DF) = **−488.3**. With the inputs blank: 2084.2 / 125.8 / −1220.7, unchanged. lldf pull check: payload interior fatM 0.45, fatV 0.66, negative-region fatM 0.42 → the dialog lists the three fatigue rows, the inputs become 0.45 / 0.66 / 0.42, the highway DFs get the strength DFs as before, and the Fatigue preset max +M = 2084.2 × 0.45 = 937.9 (tool 937.9).
- **LESS conservative when entered** (code-correct); default unchanged.

### F9 (MLG-O4). Blank E or blank span length is an input error   [bug — result changes only for blank input]
- **Where:** `readModel` (anchors `spans.push(Math.max(1,num('L'+i,` and `E:num('Es',`), start of `analyze`.
- **Problem:** `num()` silently replaced a blank E with 29,000 ksi and a blank span with 100 ft, and the run reported "Solved".
- **Governing provision:** n/a.
  ```diff
  -  for(let i=0;i<ns;i++) spans.push(Math.max(1,num('L'+i,100)));
  +  for(let i=0;i<ns;i++) spans.push(Math.max(1,num('L'+i,NaN)));   // blank -> NaN -> input error in analyze (no silent 100 ft)
  -  return {spans,E:num('Es',29000),segs:sg,axles:axles.map(a=>[...a]),short:pk,
  +  return {spans,E:num('Es',NaN),segs:sg,axles:axles.map(a=>[...a]),short:pk,
  +  if(isNaN(m.E)) throw new Error('E steel is blank or not a number. Enter E in ksi.');
  +  if(m.spans.some(l=>isNaN(l))) throw new Error(`Every span length must be a number greater than 0; span ${m.spans.findIndex(l=>isNaN(l))+1} is blank or not a number.`);
  ```
  The messages start with "E steel" / "Every span length", so the existing F4 error display and the red dot on the Spans tab apply.
- **Check case:** E blank. Before: "Solved", +M 3932.2. After: "Error: E steel is blank or not a number. Enter E in ksi.", headline values "—", Spans tab marked. Span 2 blank: before "Solved" with 100 ft; after "Error: Every span length must be a number greater than 0; span 2 is blank or not a number." Valid inputs: identical results.

### F10 (MLG-O5). Code basis stated   [docs — no result change]
- **Where:** end of Factors & Analysis (new `<p class="hint" id="mlgBasis">`, after the `id="hStep"` row) and a "Code basis" row in the printed report's inputs table (anchor `['Results basis',unit]`).
  ```diff
  +    <p class="hint" id="mlgBasis">Basis: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): HL-93 and fatigue truck (Art. 3.6.1.2–3.6.1.4), load factors (Table 3.4.1-1), IM (Art. 3.6.2). HS20 / H20: AASHTO Standard Specifications for Highway Bridges, 17th Ed. (2002), Art. 3.7, 3.8, 3.11. Rail: AREMA Manual Ch. 8 / 15 (edition per owner).</p>
  -    ['Results basis',unit]];
  +    ['Results basis',unit],['Code basis',esc($('mlgBasis').textContent.replace(/^Basis: /,''))]];
  ```
- **Check case:** n/a (text only).

### F11 (MLG-T1). Header at narrow widths; Spans hint   [UI — no result change]
- **Where:** top `<style>` (anchor `@media(max-width:900px){.body{`), the girder-panel block (anchor `defined in the Girder Section panel below`), and the input-tabs block CSS (anchor `#mlgInTabs{top:`).
- **Problem:** at ≤ 900 px the fixed 54 px header could not hold the 9 header buttons: they spilled below it and the top ones were cut off above the page. The Spans hint pointed to a "Girder Section panel below", which is now the Girder tab.
- **Fix:** at ≤ 900 px only, the header grows with its content, wraps its buttons, and scrolls with the page (`position:static`, so a three-row header does not cover the screen); the input tab strip then sticks at the top of the viewport (`top:0`), and the old `margin-top` offset that made room for the spilled buttons is removed. Desktop (> 900 px) is unchanged (header height 54 px, checked).
  ```diff
  +@media(max-width:900px){.hdr{height:auto;min-height:54px;flex-wrap:wrap;gap:6px;padding:6px 12px;position:static}.hdr>div:last-child{display:flex;flex-wrap:wrap;align-items:center;gap:6px 0}}
  -    '@media(max-width:900px){aside{overflow:visible}#mlgInTabs{top:var(--mlgHdrH,54px);margin-top:calc(var(--mlgHdrH,54px) - 54px)}}'+
  +    '@media(max-width:900px){aside{overflow:visible}#mlgInTabs{top:0}}'+
  -  const h=first.querySelector('.hint');if(h)h.textContent='Pinned supports. Deck, girder segments, and flange transitions are defined in the Girder Section panel below.';
  +  const h=first.querySelector('.hint');if(h)h.textContent='Pinned supports. Deck, girder segments, and flange transitions are defined on the Girder tab.';
  ```
- **Check case:** 400 px: header 172 px tall with every button visible, no horizontal scroll (scroll width 400). 1400 px: header 54 px, unchanged.

### Closed without a code change
- **MLG-O3** (dfNeg applies to every negative moment, including reversal moments in positive-moment regions): checked in `dfOf` — `ef.t==='M'?(v<0&&m.dfNeg>0?m.dfNeg:…)`. The negative-moment DF is normally ≥ the span DF over the piers, and reversal moments in the positive region are small and do not govern design; using it there is conservative. Closed per the inventory default ("leave").
- **MLG-H1** (one negative-moment DF; lldf's envelope over all piers used at every pier): conservative for 3–4 spans (the larger pier DF is used at every pier). Closed per the inventory default ("leave").
- **MLG-O6** (dead code: the original `function exportCsv` near the end is replaced at run time by `exportCsv=function(){…}` in the batch block): confirmed — the function declaration is hoisted and the later assignment overrides it, so the old body never runs. Left in place (CLAUDE.md §7: minimal diffs); the F6 / F7 label changes were made only in the active version.

### How verified
- `node --check` on all four inline scripts.
- Headless Chromium (Playwright), origin/main vs this branch, 30 configurations (default; all 12 presets; 1, 3, 4 spans; uniform-load modes trail / full / none; AREMA impact; multi-vehicle off; negative-moment and per-span DFs; E = 0; DF = 0; E blank; span blank; HS20 3 × 150/200/150; HS20 lane off; HS20 Std. Spec. impact; Fatigue with fatigue DFs). Compared: the whole results text of `<main>`, the status line, the warning box and `mlgSnapshot()`.
  - **Identical** for the default, HL-93 truck / tandem, all 7 rail presets, every span count, uniform-load mode, AREMA, multi-vehicle, DF and E = 0 case.
  - **Fatigue preset (blank fatigue DFs):** results identical; the warning gains one sentence.
  - **HS20 / H20:** results change as in F6; with the lane check off, results identical to main (warning and label only).
  - E blank / span blank: error as in F9.
  - Saved state: the only differences are the 7 new fields (and `impM:'std'` when chosen).
- Closed-form check and FHWA benchmark: card text and the whole `<main>` text **identical** to main.
- Print report, all 13 presets (FHWA inputs, tenth-point tables, deflection): identical except the HS20 / H20 sections (lane case, as intended), the fatigue warning sentence, the preset labels, and the new "Code basis" row.
- Old save restore: an HS20 3-span project saved by the **main** file, restored in the new file, gives `<main>` text identical to the same save restored in the main file (except the new warning and the preset label); `stdLane` stays off, fatigue DFs stay blank.
- lldf hand-off: test payload pulled; dialog rows, written inputs and fatigue results as in the F8 check case; `lldfSource.fatSet` = true.
- Std. Spec. lane input blank → error, red dot on the Rules tab.
- Console errors: only the tool's own `console.error` for the deliberate E = 0 / blank cases (E = 0 is the same on main).
- Screenshots (Rules, Impact, Factors tabs at 1400 px and 400 px; header at 400 px before and after) inspected.

### Needs engineer
1. **Std. Spec. impact L for shear and reactions in continuous spans (F7):** I used the loaded length from the section to the far support **of its span** for shear, and the mean of the adjacent spans for reactions. Art. 3.8.2.2(c) says "from the point under consideration to the far reaction" without saying how that applies across continuous spans. Recommendation: keep it as is (it gives the 30 % cap near the near support and the span value at the far end). Is that the interpretation you use?
2. **Old HS20 / H20 projects (F6):** to keep saved data unchanged, a project saved before this change reloads with the lane check **off** (and a warning). Should old saves switch it on automatically instead? Recommendation: leave it off plus the warning, so an old calculation reproduces exactly.
3. **Std. Spec. lane patterning (F6):** the uniform lane load is patterned on the influence line (partial spans), which is slightly conservative compared with the Art. 3.11.3 wording "as many spans loaded uniformly as required". Recommendation: keep it.

## Open items (after the 2026-10-12 sweep)
- Inventory section 5 items MLG-O1, O2, O4, O5, T1 are fixed (F6–F11 above); O3, H1 and O6 are closed. Only the three "Needs engineer" questions above remain.

## 2026-10-12 — PR: claude/lldf-receivers (cross-tool: lldf DF payload `perFootStrip` / `skewShear` receivers; PR #166: https://github.com/mlococo88/All-Structural/pull/166)

Cross-tool connection PR (CLAUDE.md §7 exception): receivers of the `bridgeSuite.v1.lldf` payload honour lldf's new optional fields (fixlog/lldf.md 2026-10-12 SW3 `skewShear`, SW6 `perFootStrip`), and Bridge Geometry's skew note is softened. Tools changed: index.html, psbeam.html, stgirder.html, Moving Load Generator.html, Steel Bridge Beam Modules.html, Bridge Geometry.html; HANDOFF.md §4.2 / §4.3. The shared `bridgeSuite.v1.*` bootstrap blocks are not touched. No formula, factor, unit or code reference changed. Payloads without the new fields give the same results as before (checked).

### LR1. lldf DF pull: CIP slab (`perFootStrip`) applied with warnings; shear skew shown   [hand-off] [no result change]
- **Where:** the "Hand-off IN: distribution factors from LL & DL Distribution" script. Anchors: `p.skewShear!=null && (!fin(p.skewShear)`, `id="lxStrip"`, `el('lxStrip')`, `perFootStrip:(p.perFootStrip===true)`, `SRC.perFootStrip?'; CIP slab DFs per 1-ft strip`, `Highway DFs pulled from LL & DL are for a cast-in-place slab`.
- **After:**
  - `validate`: `if(p.skewShear!=null && (!fin(p.skewShear)||Math.abs(p.skewShear)>=90)) errs.push('skewShear = '+JSON.stringify(p.skewShear));`
  - Dialog header: `· skew 30° (moment), 40° (shear) ·` when `skewShear` is sent (was `· skew 30° ·`).
  - New dialog box `<div id="lxStrip" class="warn hidden">`, shown for `perFootStrip:true`: "⚠ Cast-in-place slab: these DFs are per 1-ft strip of slab width (AASHTO LRFD 4.6.2.3), not per girder. If you apply them, every "per girder" result here is per foot of slab width. Do not use them for a girder."
  - `apply()`: `SRC` gets `perFootStrip:(p.perFootStrip===true)`; saved in the existing optional `lldfSource` (new optional key, old saves load unchanged).
  - `srcText()` (sidebar source line and the printed report row) adds "; CIP slab DFs per 1-ft strip: results are per foot of slab width, not per girder".
  - `analyze` wrapper: for highway vehicles, when `SRC.perFootStrip`, pushes the warning "Highway DFs pulled from LL & DL are for a cast-in-place slab, per 1-ft strip of slab width: the factored results are per foot of slab width, not per girder."
- **Why applied, not refused:** this tool is a line analysis; a 1-ft slab strip analysed with the strip DF gives per-foot moments and shears, a valid use. Every place that shows the DF source now says so. The DF values are applied exactly as sent (no conversion).
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 4.6.2.3 (equivalent strip; force effects per unit width). No formula changed.
- **Check case:** lldf slab payload (1 span 120 ft, interior gM = gV = 0.076, fatM = fatV = 0.045) pulled into 2 spans × 100 ft: before and after the same DF inputs are written (dfm0 = dfv0 = 0.076; fatigue 0.045), so the results are identical; after, the dialog shows the slab box, the source line ends with the per-foot note, and the results show the per-foot warning (2 places). Girder payload θ = 30°, θ_V = 40°: same inputs and source line as before; the header now reads "skew 30° (moment), 40° (shear)".
- **How verified:** headless Chromium, main vs branch, `MLGlldf.openDlg(payload)` / `MLGlldf.apply()`; the per-foot text was found in 2 warning elements after the slab pull; screenshot `mlg_dialog_slab_br.png` looked at. No page errors.

## 2026-10-14 — PR: claude/mlg-absmax (absolute maxima per span; PR #212: https://github.com/mlococo88/All-Structural/pull/212)

Engineer request 2026-10-14. Display-only addition. No formula, factor, unit, code reference, existing output, export format or saved-data key changed.

### AM1. Absolute maxima per span (+M, −M, |V|) between the twentieth points   [display] [no result change]
- **Problem:** the envelope is computed only at the 1/20 points and plate transitions, so the absolute maximum between stations was not shown. Example: 100 ft simple span, design truck alone, per lane, no IM: 1,523.9 k-ft at 47.67 ft, but the table shows 1,520.0 at midspan.
- **Where:**
  1. `analyze`, mesh keys. Anchor: `if(m.scanKeys)m.scanKeys.forEach(` (after `sb.forEach(b=>{if(b[1]>1e-6&&b[1]<Lt-1e-6)key.push(b[1]);});`).
  2. `analyze`, right after the reaction effects are pushed. Anchor: `if(m.scanM||m.scanV){const spanAt=`.
  3. New block before `// ═══════════ CSV ═══════════`. Anchors: `id="absCard"`, `function absScan(R){`, `function absPaint(){`, `function absArm(){`, `const _render6=render;`.
- **Before (1, 2):**
  ```js
    sb.forEach(b=>{if(b[1]>1e-6&&b[1]<Lt-1e-6)key.push(b[1]);});
    key.sort((a,b)=>a-b); ...
  ...
    sup.forEach((s,q)=>effs.push({t:'R',node:supNodes[q],q,x:s,spans:q===0?[0]:q===ns?[ns-1]:[q-1,q],interior:q>0&&q<ns}));

    // Influence lines: unit downward load at every node
  ```
- **After (1, 2):**
  ```js
    sb.forEach(b=>{if(b[1]>1e-6&&b[1]<Lt-1e-6)key.push(b[1]);});
    if(m.scanKeys)m.scanKeys.forEach(v=>{if(v>1e-6&&v<Lt-1e-6)key.push(v);}); // absolute-maximum refinement pass only
    key.sort((a,b)=>a-b); ...
  ...
    sup.forEach((s,q)=>effs.push({t:'R',node:supNodes[q],q,x:s,spans:q===0?[0]:q===ns?[ns-1]:[q-1,q],interior:q>0&&q<ns}));
    // Absolute-maximum scan passes only (m.scanM / m.scanV / m.scanKeys; never set for the reported envelope results):
    // extra M sections at the mesh nodes nearest the m.scanM positions, and V just right of every node (m.scanV).
    if(m.scanM||m.scanV){const spanAt=v=>{let k=0;while(k<ns-1&&v>sup[k+1]-1e-9)k++;return k;};
      (m.scanM||[]).forEach(v=>{const i=idxOf(v);if(mKey[i]!==undefined||supNodes.includes(i))return;
        mKey[i]=effs.length;effs.push({t:'M',node:i,x:x[i],spans:[spanAt(x[i])],scan:true});});
      if(m.scanV)for(let e=0;e<nn-1;e++){if(vKey[e]!==undefined)continue;
        vKey[e]=effs.length;effs.push({t:'V',el:e,cutL:true,x:x[e],spans:[spanAt((x[e]+x[e+1])/2)],scan:true});}}

    // Influence lines: unit downward load at every node
  ```
  `m.scanKeys`, `m.scanM` and `m.scanV` are never set by `readModel`, `modelFor`, the report, the benchmarks or the sensitivity run, so every existing `analyze` call is unchanged. The extra sections are appended after the reactions, so the indices of the existing effects are unchanged even in the scan passes.
- **After (3), how it works:** after the normal results are shown and the inputs have been idle for 1 s, `absScan(RES)` runs two more `analyze` passes on copies of the model (the reported `RES` is not modified):
  - pass 1: the same mesh, with a moment section at every analysis node and a shear section just right of every node;
  - pass 2: mesh points added every 0.1 ft within one element length of each span's +M and −M candidates (factored and unfactored picks), with moment sections at those points.
  The per-span maximum +M, minimum −M and maximum |V| are taken over the original stations, pass 1 and pass 2, in the current view (factored per girder: LLF × DF as `dfOf`, or unfactored per lane), and shown in a new card "Absolute Maxima per Span" after the envelope table, with x, location (x/L, or support and side) and the governing case in the existing format. It is not added to the CSV, the printed report or the saved JSON (the report has no per-span force summary; the brief preferred display-only). Every input event restarts the 1 s delay, so typing is not slowed down.
- **Governing provision:** none changed. Loads and factors as already applied by the envelope (AASHTO LRFD 10th Ed. Art. 3.6.1.2–3.6.1.3, Table 3.4.1-1, etc.).
- **Check case (per lane, IM = 1.0, DF = 1, view "Unfactored"):** 100 ft simple span.
  - Design truck alone (14 ft spacing): hand check 72(47.667)²/100 − 8·14 = 1,523.9 k-ft at 47.67 ft. Tool: **1,523.9 at 47.70 ft** (0.1 ft grid). Table at 0.5L: 1,520.0 (unchanged).
  - Lane 0.64 klf alone: 0.64·100²/8 = 800.0 at 50.0 ft. Tool: **800.0 at 50.00 ft**.
  - Design tandem alone: 50·(100 − 49 − 2)/100·49 = 1,200.5 at 49.0 ft (or 51.0). Tool: **1,200.5 at 49.00 ft**.
  - HL-93 truck + lane (preset, IM = 1.0): brute-force hand check (truck positions every 0.01 ft + 0.32·x(100 − x)) gives 2,322.71 at 48.3–48.4 ft. Tool: **2,322.7 at 48.40 ft**; table at 0.5L: 2,320.0 (unchanged).
  - 3 spans 110-140-110, HL-93 preset, IM = 1.0: +M 2,200.5 at 47.60 ft (span 1), 2,314.1 at 179.20 ft (span 2), 2,200.5 at 312.40 ft (span 3); −M −2,449.2 at Supports B and C (multi-vehicle 0.9 × 2 trucks, same as the table); max |V| 113.7 / 117.4 / 113.7 at the piers.
- **How verified:** `node --check` on all four inline scripts. Headless Chromium, origin/main vs branch, 9 cases (default 2 × 100; the 100 ft simple-span cases above; 100 ft HL-93; 3-span HL-93 with IM 1.0 and 1.33; 2 × 100 HS20; 100 + 120 E80): metrics, warnings, envelope table, reactions, plate-transition table, influence-line info, CSV export (factored and unfactored) and printed report HTML are **byte-identical** (one SHA-256 over all of them matches). No page or console errors. As a cross-check, a full scan with moment sections at every node (no 0.1 ft refinement) gave per-span values ≤ the reported ones and within 0.9 k-ft of them in every case. Screenshot looked at.
- **Run time:** the extra passes take about 1–1.5 s for 1–2 spans and about 3–3.5 s for the 3-span case, after the main results are already shown; the page is busy during that time.
- **Other copies of this code:** none.

## 2026-10-14 — PR: claude/mlg-shear-jump (shear just left / just right of a section; PR #214: https://github.com/mlococo88/All-Structural/pull/214)

Engineer decision 2026-10-14. **Changes computed shear envelope values (V+ / V−) only**, always toward the exact influence-line value (larger V+, more negative V−). Moments, reactions, deflections, warnings, saved data and export formats are unchanged.

### VJ1. Axle standing exactly at a shear section counted on one side of the unit jump only   [calc] [results change: shear only, less conservative before]
- **Problem:** the shear influence line has a unit jump at the section. When an axle stood exactly at the section, `sweep` and `refineAt` used only one ordinate: for a section cut just right of a node (`cutL`, the 0.0L–0.95L rows) the right-side ordinate, and for a span-end section (1.0L, cut just left of the node) the right-side ordinate at an interior support or the left-side ordinate at the last support. The other side was reached only in the limit, at the nearest 0.1 ft refinement step, so V− (and V+ in the mirrored cases) was slightly low: by up to about 0.4 kip for HL-93 and up to 2.6 kip for the heavier rail vehicles in the test cases. Example: 100 ft simple span, 0.5L, per lane, no IM: V− = −37.21 kip vs exact −37.28 (truck −29.28 + lane −8.00). The Std. Spec. lane case and the uniform-load integrals already used both sides (`ends()`), and are unchanged.
- **Fix:** (a) an axle within 1e-6 ft of the cut is counted with the left-side or right-side ordinate, whichever gives the larger value for the maximum and the smaller for the minimum (the limit of the axle approaching from either side); (b) every vehicle configuration in `sweep` (each spacing, each headway, primary and secondary vehicle, both directions) is also evaluated with each axle placed exactly at each shear cut, so the exact candidate is always found and does not depend on the position step. (b) is needed because with (a) alone a configuration that happened to land on the cut could win before refinement and steer the 0.1 ft refinement away from a better one; with (b) no shear value moved in the wrong direction in any test case.
- **Where:** function `analyze`.
  1. New helper before `const cfgs=[];function sweep(cfg){`. Anchor: `const vJump=(cutEl,cutL,f,xp,P)=>`.
  2. `sweep`: anchors `XP=new Float64Array(nA)`, `on[a]=1;any=true;XP[a]=xp;`, `const vj=vJump(cutEl,cutL,f,XP[a],cfg.loads[a]);`, and the new loop at the end of `sweep`: `// Shear: also place each axle exactly at the cut`.
  3. `refineAt` changed from a `const` arrow function to a hoisted function declaration (so `sweep` can call it; body unchanged except the shear-jump lines). Anchors: `function refineAt(cfg,p,dir,list){`, `const vj=vJump(cutEl,ef.cutL,f,pos[a],Pa[a]);`.
- **Before:**
  ```js
    const cfgs=[];function sweep(cfg){cfgs.push(cfg);
      const nA=cfg.offs.length, Lv=cfg.offs[nA-1], tr=cfg.trail, ext=Lv+(tr?tr.gap:0)+m.step;
      const J=new Int32Array(nA),T=new Float64Array(nA),on=new Uint8Array(nA);
  ...
            on[a]=1;any=true;const lo=loc(xp);J[a]=lo;T[a]=Math.min(1,Math.max(0,(xp-x[lo])/(x[lo+1]-x[lo])));}
  ...
            const f=IL[ei]; let tot=0,ps=0,ng=0;
            for(let a=0;a<nA;a++){if(!on[a])continue;const j=J[a];let fa=f[j],fb=f[j+1];
              if(j===cutEl){if(cutL)fa+=1;else fb-=1;}
              const v=cfg.loads[a]*(fa+(fb-fa)*T[a]);tot+=v;if(v>0)ps+=v;else ng+=v;}
            const axMax=m.neglect?ps:tot, axMin=m.neglect?ng:tot;
  ...
            if(dMin&&vMin<r.min-1e-9){r.min=vMin;r.minG=gov(cfg,p,dir,on);}
          }
        }
      }
    }
  ...
    const refineAt=(cfg,p,dir,list)=>{
  ...
        const ef=effs[ei],f=IL[ei],im=imArr[ei],imn=imMinArr[ei],cutEl=ef.t==='V'?ef.el:-1;let tot=0,ps=0,ng=0;
        for(let a=0;a<J.length;a++){const j=J[a];let fa=f[j],fb=f[j+1];if(j===cutEl){if(ef.cutL)fa+=1;else fb-=1;}
          const v=Pa[a]*(fa+(fb-fa)*T[a]);tot+=v;if(v>0)ps+=v;else ng+=v;}
        const axMax=m.neglect?ps:tot,axMin=m.neglect?ng:tot;let uMax=0,uMin=0;
  ...
      });
    };
    if(!$('refineChk')||$('refineChk').checked){
  ```
- **After:**
  ```js
    // Axle standing exactly at a shear cut (the unit jump in the V influence line): the envelope is the limit of the
    // axle approaching from either side, so count it with the left-side ordinate or the right-side ordinate, whichever
    // gives the larger value for the maximum and the smaller for the minimum. Returns [vMin,vMax], or null if not at the cut.
    const vJump=(cutEl,cutL,f,xp,P)=>{const c=cutL?cutEl:cutEl+1;if(Math.abs(xp-x[c])>1e-6)return null;
      const oL=cutL?f[c]:f[c]-1,u=P*oL,w=P*(oL+1);return [Math.min(u,w),Math.max(u,w)];};
    const cfgs=[];function sweep(cfg){cfgs.push(cfg);
      const nA=cfg.offs.length, Lv=cfg.offs[nA-1], tr=cfg.trail, ext=Lv+(tr?tr.gap:0)+m.step;
      const J=new Int32Array(nA),T=new Float64Array(nA),on=new Uint8Array(nA),XP=new Float64Array(nA);
  ...
            on[a]=1;any=true;XP[a]=xp;const lo=loc(xp);J[a]=lo;T[a]=Math.min(1,Math.max(0,(xp-x[lo])/(x[lo+1]-x[lo])));}
  ...
            const f=IL[ei]; let tot=0,ps=0,ng=0,totN=0;
            for(let a=0;a<nA;a++){if(!on[a])continue;const j=J[a];let fa=f[j],fb=f[j+1];
              if(j===cutEl){if(cutL)fa+=1;else fb-=1;}
              const v=cfg.loads[a]*(fa+(fb-fa)*T[a]);
              if(cutEl>=0){const vj=vJump(cutEl,cutL,f,XP[a],cfg.loads[a]);if(vj){tot+=vj[1];totN+=vj[0];if(vj[1]>0)ps+=vj[1];if(vj[0]<0)ng+=vj[0];continue;}}
              tot+=v;totN+=v;if(v>0)ps+=v;else ng+=v;}
            const axMax=m.neglect?ps:tot, axMin=m.neglect?ng:totN;
  ...
            if(dMin&&vMin<r.min-1e-9){r.min=vMin;r.minG=gov(cfg,p,dir,on);}
          }
        }
      }
      // Shear: also place each axle exactly at the cut (the IL jump), so the limit from either side is always evaluated
      for(const dir of m.dirs)for(const [ei,dMax,dMin,,cutEl,cutL] of act){if(cutEl<0)continue;const xc=x[cutL?cutEl:cutEl+1];
        for(let a=0;a<nA;a++)refineAt(cfg,xc+dir*cfg.offs[a],dir,[[ei,dMax,dMin]]);}
    }
  ...
    function refineAt(cfg,p,dir,list){   // function declaration (hoisted): also used by sweep() for the shear-jump positions
  ...
        const ef=effs[ei],f=IL[ei],im=imArr[ei],imn=imMinArr[ei],cutEl=ef.t==='V'?ef.el:-1;let tot=0,ps=0,ng=0,totN=0;
        for(let a=0;a<J.length;a++){const j=J[a];let fa=f[j],fb=f[j+1];if(j===cutEl){if(ef.cutL)fa+=1;else fb-=1;}
          const v=Pa[a]*(fa+(fb-fa)*T[a]);
          if(cutEl>=0){const vj=vJump(cutEl,ef.cutL,f,pos[a],Pa[a]);if(vj){tot+=vj[1];totN+=vj[0];if(vj[1]>0)ps+=vj[1];if(vj[0]<0)ng+=vj[0];continue;}}
          tot+=v;totN+=v;if(v>0)ps+=v;else ng+=v;}
        const axMax=m.neglect?ps:tot,axMin=m.neglect?ng:totN;let uMax=0,uMin=0;
  ...
      });
    }
    if(!$('refineChk')||$('refineChk').checked){
  ```
  For an axle not at a cut, the arithmetic is identical to before (same terms in the same order), so moments and reactions are bit-identical. The absolute-maximum scan (`absScan`, #212) calls `analyze`, so its shear values get the same fix with no separate change. The jump candidates are added whether or not "Refine" is ticked.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.6.1.2.1–3.6.1.2.4 (design truck, tandem, lane) and 3.6.1.3.1 (extreme force effect: the vehicle positioned to produce the extreme effect, applied to the influence line); Art. 3.6.1.4 (fatigue truck). Loads, factors, impact and distribution are unchanged; only the application of the axle loads to the influence line at its discontinuity changes.
- **Check case:** 100 ft simple span, per lane, IM = 1.0, DF = 1. Closed form at section x (a = L − x): truck V+ = [32a + 32(a−14) + 8(a−28)]/L, tandem V+ = 25[a + (a−4)]/L, lane V+ = 0.64a²/(2L); V−(x) = −V+(L−x).
  - 0.5L: truck V− before −29.208, after **−29.280** (= −[32·50 + 32·36 + 8·22]/100); tandem before −23.950, after **−24.000**; lane −8.000 both; HL-93 before −37.208, after **−37.280**.
  - 0.1L: truck V− −3.168 → **−3.200** (= −32·10/100); tandem −3.950 → **−4.000**; HL-93 −4.270 → **−4.320** (tandem 4.00 + lane 0.32).
  - 0.9L: truck V− −58.008 → **−58.080**; tandem −43.950 → **−44.000**; HL-93 −83.928 → **−84.000**.
  - 0.0L and 1.0L, and every V+ in this case: unchanged (65.28, 49.00, 32.00, 97.28 at 0.0L; −65.28, −49.00, −32.00, −97.28 at 1.0L).
  - 3 spans 110-140-110, symmetric: max |V+(x) + V−(Lt − x)| over all twentieth points was 0.134 (HL-93), 0.251 (truck), 1.442 kip (E80) before; after ≤ 3e-8 kip in every case.
- **How verified:** `node --check` on all four inline scripts. Headless Chromium, origin/main vs branch, 22 cases (100 ft simple span: HL-93, truck, tandem, IM 1.33, axle-neglect off, fatigue, HS20 + Std. lane, E80; 110-140-110: HL-93, truck, tandem, IM 1.33, fatigue, HS20, H20, E80, E80-Alt, F40PH, 286K, ES44AC; 120-120 factored; 85-110-110-85 step 0.5) plus the FHWA and closed-form benchmark buttons: every moment and reaction (max, min, governing case and position), every deflection and every warning identical; only shear values changed, and every change is toward the exact value (V+ up, V− down; largest change 2.56 kip, F40PH); CSV export differs only in the +V, −V, |V| and governing-shear cells; the printed report only in shear cells; the absolute-maxima card only in "Max |V|" rows. No page or console errors. GirderDetail (`Steel Bridge Beam Modules.html`, exact engine) vs MLG at every 1 ft section, 9 cases (simple span, 3-span constant and variable EI; no IM, IM, fatigue): MLG V− vs GirderDetail before up to 0.67 kip; after ≤ 1e-6 kip in every case. Run time unchanged (analyze 0.3–0.9 s for 3 spans).
- **Other copies of this code:** none.

## 2026-10-18 — PR: claude/mlg-d11-report — D11: slim calculation-sheet report and §6 links (Tier 1, display only; PR #292: https://github.com/mlococo88/All-Structural/pull/292)

- **Engineer request:** AUDIT.md D11 (2026-10-14); scope decided 2026-10-18: **slim report** for this tool (inputs → worked results, no D/C section). CLAUDE.md §6 "show the work and link to it".
- **Provision:** none. No formula, factor, unit, code reference, analysis or computed result changed. No saved-data key or format changed (`movingLoadGen.autosave.v1`, `movingLoadGen.inputTab.v1`, the Save JSON format, `bridgeSuite.v1.*` and the lldf hand-off untouched); no input field added.

### D11-1. Printed report recast in the calculation-sheet format   [display] [no result change]
- **Where:** new last `<script>` block before `</body>`, anchor `/* ═══════════ D11 (2026-10-18): CALCULATION-SHEET REPORT, SLIM (display only)`. It is the outermost wrapper of `reportHTML` (`var prev=reportHTML; reportHTML=function(out,o,base,dk){…recast(h,out,o)…}`): it parses the finished report HTML of all earlier wrappers (`_reportHTML`, `_reportHTML2`, the lldf DF-source row) and rearranges it with DOMParser. Helpers in the block: `refs(out,o)`, `img()`, `recast()`, `CSS`. To re-apply by hand, copy the whole block. If the recast throws or the structure is not the expected one, the report is printed exactly as before (`console.warn` only).
- **Before:** `reportHTML` output: title "Bridge Moving Load Analysis Report", a Project / Computed by / Date / Vehicles table, `1. Structure & Analysis Inputs`, `2. Summary — …`, one section per vehicle (`3.` …) with the vehicle diagram, governing table, envelopes, reactions, transitions, deflection, tenth points; blue screen styling; no references, contents, page header or page numbers.
- **After (same values, same tables):**
  - **Cover:** "Bridge Moving Load Analysis", project, "Moving Load Generator (BridgeLoad Pro — Continuous) · Calculation Report", spans · vehicle count · results basis, the code line (`#mlgBasis`), title block Project / Project No / Calculated by / Date / Checked by / Checked date (Project = `rProj`, Calculated by = `rBy`, Date = the report date as before; the tool has no Project No / Checked fields: "—"), vehicles analysed.
  - **References** (`refs()`), only what the tool cites and only for the vehicles in the report: LRFD 10th Ed. (2024) Table 3.4.1-1; Art. 3.6.1.2 and 3.6.1.3.1 (HL-93 / custom highway); 3.6.1.1.2 (multiple presence, in the DFs); 3.6.1.4, 3.6.1.4.3b, C3.6.1.1.2 (fatigue truck); 3.6.2 (IM); 6.10.1.5 (stiffness); 2.5.2.6.2 and 3.6.1.3.2 (deflection, when included); 4.6.2.3 (lldf CIP-slab pull only); Std. Spec. 17th Ed. (2002) Art. 3.7.1.1 / Fig. 3.7.6B, 3.8.1–3.8.2, 3.11.3 (HS20 / H20 / Std. lane / Std. impact); AREMA Ch. 8 / 15, "edition: verify" (rail).
  - **Numbered table of contents** with links.
  - **Sections:** 1 Structure & Analysis Inputs (1.1 inputs table, 1.2 girder segments, 1.3 stiffness plot, 1.4 Analysis Model and Engine Check = the existing `R.check` text); 2 Vehicle Definitions (2.k per vehicle: the vehicle diagram and summary line moved here from the vehicle sections, plus an axle table echoed from `R.m.axles` and the neglect / direction rules); then, in the report's existing order, Results Summary (highway or all; rail summary when mixed, now numbered) and one "<vehicle> — Results" section per vehicle (n.1 Governing Results, n.2 Moment Envelope, n.3 Shear Envelope, n.4 Support Reactions, then Plate Transitions / Live Load Deflection / Tenth-Point Envelope when present).
  - **Worked factoring** under each n.1 table (factored reports only): `M⁺ = γLL · g · M⁺LL+IM = 1.75 × 0.6 × 2,786.96 = 2,925.3 kip-ft`, likewise M⁻, V⁺, V⁻, R⁺, R⁻, with which DF the tool applied (span, larger of adjacent spans, negative-moment DF, rail or fatigue set) and the section. The per-lane value is `R.res[ei].max/min`, g is `R.dfOf(ef,v)`, the result printed is the existing `X.*.v` (= `m.llf*R.dfOf(ef,v)*v`, the same expression as `envData`). Unfactored reports: a note instead.
  - Deflection: one note "Allowable = 12 · L / N; ratio = |δ| / allowable". The existing deflection table (with its ratio ✓/✗ column) is unchanged; no D/C result lines were added.
  - **Diagrams print-legible:** the moment, shear, deflection, stiffness and vehicle images are redrawn at 760 px wide (before 1,100 px / on-screen width) with the same `plot` / `drawEI` / `drawVehicle` and the same series; the vehicle canvas and `RES` are restored afterwards.
  - **Print:** `@page` letter with margin boxes in the report window's `<style id="mlg-cr">` (applies only when printing): top "Project No: — / Description: <project>", "Computed By: <rBy> / Checked By: —", "Date: <report date> / Date: —"; bottom "<project> (Moving Load Generator)" and "Page X of Y". The report window's Print / Save as PDF button and the header "🖨 Print Report" button are unchanged.
  - **Ctrl+P:** in the report window it now prints the new format; on the main tool page it is unchanged (the new link line is hidden in print).

### D11-2. §6 links   [display]
- **On screen:** one line under the headline result cards (`main > .mets`): "Worked in: Max ±M → Moment Envelope · Max ±V → Shear Envelope · Max reaction → Support Reactions (factored view) · governing vehicle positions → Envelope Table, Influence Line Viewer"; a click scrolls to that card and flashes it. `id="mlgWk"`, CSS `.mlgWk`, hidden in print.
- **In the report:** each Results Summary row links "see §n.1"; each results section links its vehicle definition (§2.k) and the inputs (§1.1); each factoring line links §1.4.

### Check case
- 1 span 100 ft, HL-93 truck as configured, DF 1, LLF 1.75, IM 1.33 (report "simple", 12 pages): §4.1 `M⁺ = 1.75 × 1 × 2,821.60 = 4,937.8 kip-ft` at x = 50.00 ft. Hand check: design truck, middle axle at midspan, 14 ft spacing, influence ordinates 25, 18, 18 ft: 32·25 + 32·18 + 8·18 = 1,520.0 k-ft; × 1.33 = 2,021.6 + lane 0.64·100²/8 = 800.0 → 2,821.6 × 1.75 = **4,937.8** (tenth-point table 0.5L: 4,937.8). `V⁺ = 1.75 × 1 × 118.82 = 207.9 kips` (truck 65.28 × 1.33 = 86.82 + lane 32.00).
- 3 spans 110-140-110, DF M 0.6 / V 0.8, negative-moment DF 0.65 (report "span3", 20 pages): `M⁻ = 1.75 × 0.65 × −2,916.48 = −3,317.5 kip-ft` at Support B, governing case "0.9×2 HL93-Truck H=73".
- Default project, all 12 presets (default report selection): **52 letter pages** (cover, references + contents 2 pages, §1–§16).

### How verified (Tier 1)
- `node tests/check-syntax.mjs "Moving Load Generator.html"`: all 5 scripts pass. `node tests/compare.mjs --tool page`: `page.storage` same; `page.text` differs only by the "Solved in … ms" time and the new link line (identical after removing both). No console errors.
- Headless Chromium (tests/lib.mjs `openPage`), origin/main vs branch, 5 cases (default 2 × 100 with all presets; 1 × 100 HL-93 + tandem with tenth points; 110-140-110 HL-93 / tandem / fatigue with fatigue DFs / HS20; 90 + 120 highway + E80 + 286K mixed; 2 × 80 custom 4-axle owner vehicle, unfactored): `RES.res` / warnings / engine check, the `<main>` text, `mlgSnapshot()`, localStorage, and every report vehicle's `R.res`, governing extremes, deflections and info line (captured from `genReport`'s `out`) are **identical**, before and after building the report. Every internal report link resolves; PDFs (print media, `preferCSSPageSize`) looked at page by page.

### Other copies
- None.

### Open items (not changed)
- D11-O1. **Title-block fields:** no Project No, Checked by or dates in the tool; they print "—". Optional tool-prefixed fields can be added if wanted.
- D11-O2. **Deflection ratio column** (δ / (L/N) with ✓/✗) is kept as the tool had it; under the slim scope you may prefer it shown without ✓/✗.
- D11-O3. **Absolute Maxima per Span** stays on screen only (AM1); it is not in the report (it would need extra analyze passes per vehicle, 1–3.5 s each).
- D11-O4. The IM split (truck × IM, lane without IM) is inside the per-lane envelope value and is not decomposed in the factoring lines; the tool does not hold the components separately.

## 2026-10-29 — PR: pilot-moving-load — engine moved to shared/moving-load.js and shared/vehicles.js (rebuild pilot, Phase 1; refactor, no result change)
### What moved (page keeps its file name, UI, inputs and saved data)
- The page now loads `<script src="shared/vehicles.js">` and `<script src="shared/moving-load.js">` just before its first inline `<script>` (anchor `const $=id=>document.getElementById(id);`). The repo folder must be copied whole; the page alone no longer works.
- **Presets** (anchor before: `const E80=[[40,0],[80,8]`, through the closing `};` of `const P={`): replaced by
  `const VEH=SharedVehicles.build(), P=VEH.presets, NOSL=VEH.NOSL;`. `P['Fatigue']=HW('LRFD Fatigue Truck (30 ft)',…)` became `P['Fatigue']=VEH.fatigue;` (same place, so the preset order is unchanged).
- **`props`, `luDecomp`, `luSolve`:** bodies moved; the page keeps one-line function declarations that call `SharedMovingLoad.*` (declarations, because the page wraps `props` later: `const _props=props; props=function…`).
- **`analyze(m)`:** body moved to `SharedMovingLoad.analyze(m,opt)`. The page keeps
  `function analyze(m){ return SharedMovingLoad.analyze(m,{Lb:$('aLb')?$('aLb').value:'span',aL:num('aL',100),refine:!$('refineChk')||$('refineChk').checked,vehicles:P}); }`
  — these are the only DOM reads the old body made (`$('aLb')`, `num('aL',100)`, `$('refineChk')`) plus the global preset table `P` (secondary vehicle, step case). The later wrappers (`var _an=analyze; analyze=function…` for the LL&DL pull warnings) are unchanged.
- **`deflAnalyze()`:** body moved to `SharedMovingLoad.deflection(R,opt)`; the page keeps `function deflAnalyze(){ return SharedMovingLoad.deflection(RES,{mode:$('dCase').value,DF:num('dDF',1),useIM:$('dIM').checked}); }` (the rail-DF / stiffness wrapper below it is unchanged).
- **`absScan(R)`:** body moved to `SharedMovingLoad.absScan(R,analyzeFn)`; the page keeps `function absScan(R){return SharedMovingLoad.absScan(R,analyze);}` so the scan still runs through the page's current (wrapped) `analyze`.
- To re-apply by hand: copy the old bodies into the shared files exactly, replacing only the DOM reads listed above with `opt.Lb`, `opt.aL`, `opt.refine!==false`, `opt.vehicles`, `opt.mode`, `opt.DF`, `opt.useIM`.

### Governing provision
- None changed. No formula, factor, unit, vehicle or code reference was changed (CLAUDE.md §4).

### Check case
- Default page (2 spans 100/100, HL-93, DF/LLF defaults): headline results before and after: +M 3932.2 kip-ft, −M −4049.2 kip-ft, ±V 227.7 kips, reaction 365.4 kips (factored), identical.
- 2 spans 100/120, HL-93 truck (unfactored per lane with impact): max +M 2850.258 kip-ft, max −M −2673.561 kip-ft, max |V| 138.148 kips, max R 223.225 kips — identical to the last bit before and after.

### How verified
- `node tests/engine/run.mjs moving-load`: 35 cases (1–4 spans, 1 and 3 segments and an Io override, all 12 vehicles, every impact method and AREMA L basis, lane/full/trailing uniform loads, Std. Spec. lane loading, secondary and multi-vehicle cases, refine off, finer steps, warnings, deflection modes). For each case the whole output (envelopes with governing positions, influence lines, effects/rows, warnings, engine check, step solver, deflection envelope, absolute-maximum scan) hashes identically (SHA-256 of canonical JSON) to the output of the ORIGINAL inline functions taken from b3dbddb; 4 cases are also compared value by value live against the original functions. **Bit-identical.**
- `node tests/compare.mjs --tool page --file "Moving Load Generator.html"` (headless Chromium): console errors 0 before and after; `page.storage` same; `page.text` identical apart from the "Solved in … ms" time.
- `node tests/check-syntax.mjs "Moving Load Generator.html"`: all scripts pass.

### Other copies
- None. Vehicle data in `index.html` and `Stone Masonry Arch Load Rating.html` is separate and was not touched.

### Open items (not changed)
- PL-O1. The engine-check block in `analyze` indexes theory values for 1–4 spans only (`{1:…,4:…}[ns]`); 5+ spans would throw there. The page allows 1–4 spans, so nothing changes today; see `fixlog/shared-moving-load.md`.

## 2026-11-01 — PR: claude/rpt-mlg — Report output tab in the shared report viewer (MLRP; display only, no calculation change) (PR #555: https://github.com/mlococo88/All-Structural/pull/555)

Line numbers are approximate; search for the anchor text. Every code site is tagged `MLRP`.

### MLRP. "Report" output tab (shared/report.js, shared/steps.js; KaTeX 0.16.9 optional)   [display only]
- **Engineer request (2026-11-01, report rollout):** a Report output tab in the shared viewer: navigation tree to topic level, numbered sections §n.m, worked steps grouped by topic, links back to the result cards, print with a title block (no owner cell), running header and page numbers. "Slim report grouped by topic" for this tool.
- **Engineer decision (2026-11-01):** KaTeX 0.16.9 is added for the Report tab (pinned, the same cdnjs files as `apps/steel-bridge/index.html`), with `defer` so the page never waits for it. The tool stays offline-capable: without the CDN the steps are set by the shared built-in renderer (checked: 0 KaTeX spans, steps readable, every other card unchanged; only the two blocked CDN files are logged by the browser).
- **Loads:** after `shared/moving-load.js`: `shared/steps.js`, `shared/report.js` (classic scripts, relative path).
- **UI:** a "Results | Report" tab bar at the top of the output column (`#mlgOutTabs`). Report hides the result cards (class `mlgRptOn` on `<main>`) and shows `#mlgReport`; Results shows the cards again and redraws the canvases. The multi-vehicle "Print Report" button (new window) is unchanged.
- **New code** (one `<script>` block at the end, anchor `REPORT TAB (MLRP`): `mlrModel()` (the report model), `mlrRender()`, `mlrGoto()` (links back to a result card), `mlrShow()`, a `run` wrapper (a new analysis rebuilds the report while it is shown), a `beforeprint` hook (Ctrl+P on the Report tab prints the report alone).
- **Values (nothing analysed or recomputed):** everything is read from `RES` / `DEF` or the tool's own functions:
  - governing effects: `extremes(R, envData(R,true).F)` (the print report's functions), the per-lane value `R.res[ei].max/min`, the factor `g = R.dfOf(ef, value)`; the step shows M⁺ = γ_LL · g · M⁺_LL+IM with those numbers and the value `b.v` the tool computed;
  - impact factor per span `R.imSpan[k]`, γ_LL `m.llf`, DFs `m.dfM`, `m.dfV`, `m.dfNeg`;
  - girder segment properties `props(s, deckRead())`; vehicle axles `m.axles`; vehicle picture and envelopes drawn by the tool's `drawVehicle()` / `offPlot()` (as PNG in an SVG figure);
  - the tenth-point envelope, plate-transition and reaction tables are the result cards' rows as shown (View selector: factored or per lane); the deflection steps take δ, the allowable and the ratio from the Live Load Deflection card's own cells (3 / 3 / 2 decimals as shown).
- **Sections:** 1 Structure and analysis inputs (settings, girder segments, engine check and warnings), 2 Vehicle, 3 Load factors and impact, 4 Governing live load effects (six topics, one per extreme), 5 Envelopes and reactions, 6 Live load deflection (one topic per span, with the L/N check), 7 References (the tool's basis line).
- **Title block:** Project and Computed by from the Print Report fields (`rProj`, `rBy`); the tool has no project number, date or checker fields, so those show "—" (no field added).
- **Saved data:** nothing new is saved; the Report / Results choice is not remembered. The viewer's collapsed sections are kept in memory (`MLRP.closed`).
- **How verified (headless Chromium; KaTeX served locally, and a second run with every CDN blocked):** 3 projects (default HL-93 2 × 100 ft; HS20 3 spans; Cooper E80 1 span, View = unfactored per lane):
  - 0 unresolved or duplicate references, 0 KaTeX errors (KaTeX used online; built-in renderer offline), no NaN / undefined in `SharedReport.text()`, 0 console errors online;
  - 25 / 26 / 24 report values equal the app's: the six governing factored values, their per-lane values and g, the impact factor per span, γ_LL, and the metric cards (Max ±M, ±V) against the governing steps;
  - the Results text is unchanged after opening the Report tab, and identical to origin/main;
  - Ctrl+P on the Report tab prints the report alone with the shared running header (PDF checked).
  - `node tests/check-syntax.mjs "Moving Load Generator.html"` passes.
- **Other copies:** none. `shared/README.md` lists the tool as a user of `steps.js` and `report.js`.
- **Open items:** at 390 px the report's result column runs past the right edge (the page layout is unchanged here; separate 390 px PR).

Diff (`Moving Load Generator.html`, `git diff -U0` against origin/main):

```diff
diff --git a/Moving Load Generator.html b/Moving Load Generator.html
index 5d77b0e..a819a1e 100644
--- a/Moving Load Generator.html	
+++ b/Moving Load Generator.html	
@@ -6,0 +7,4 @@
+<!-- MLRP: KaTeX 0.16.9 for the Report tab's worked steps (engineer-approved 2026-11-01; same pinned files as apps/steel-bridge/index.html).
+     Deferred, and optional: offline (CDN not reachable) the steps are set by the shared built-in renderer and the tool works as before. -->
+<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
+<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
@@ -271,0 +276,3 @@ tr.pier td{background:#f8fafc;font-weight:600}
+<!-- MLRP: shared worked steps and the shared report viewer (Report tab) -->
+<script src="shared/steps.js"></script>
+<script src="shared/report.js"></script>
@@ -2083,0 +2091,168 @@ initSelects(); renderSpans(); $('preset').value='HL93-Truck'; applyPreset('HL93-
+<script>
+// ═══════════ REPORT TAB (MLRP, 2026-11-01) ═══════════
+/* The calculation report of the current analysis (RES, DEF) in the shared viewer (shared/report.js: navigation tree,
+   numbered sections §n.m, collapse / expand, search, Print with a title block, running header and page numbers; worked
+   steps through shared/steps.js, grouped by topic with SharedSteps.group). Nothing is analysed or recomputed: values are
+   read from RES / DEF and the tool's own functions (extremes, envData, R.dfOf, props, offPlot), and the tables are the
+   result cards' own rows as shown (factored or per lane, as the "View" selector). KaTeX when the CDN is reachable, else
+   the SharedSteps built-in renderer (offline). Nothing is saved: the viewer's collapsed sections are kept in memory only
+   (MLRP.closed). The multi-vehicle Print Report (new window) is unchanged. */
+const MLRP={closed:new Set(),api:null,doc:null,on:false};
+document.head.insertAdjacentHTML('beforeend','<style>#mlgOutTabs{display:flex;gap:0;border-bottom:2px solid #1e293b;margin:0 0 12px}#mlgOutTabs button{border:1px solid #cbd5e1;border-bottom:none;background:#f1f5f9;color:#475569;font:600 13px Inter,Segoe UI,sans-serif;padding:7px 16px;cursor:pointer;border-radius:6px 6px 0 0;margin-right:3px}#mlgOutTabs button.on{background:#fff;color:#0f172a;border-color:#1e293b}main.mlgRptOn>:not(#mlgOutTabs):not(#mlgReport){display:none!important}#mlgReport{background:#fff;border-radius:10px;padding:4px 10px}@media print{#mlgOutTabs{display:none!important}}</style>');
+document.querySelector('main').insertAdjacentHTML('afterbegin','<div id="mlgOutTabs" role="tablist" aria-label="Output"><button type="button" role="tab" data-ot="res" class="on">Results</button><button type="button" role="tab" data-ot="rpt">Report</button></div>');
+document.querySelector('main').insertAdjacentHTML('beforeend','<div id="mlgReport" hidden></div>');
+function mlrShow(on){
+  MLRP.on=!!on; const mn=document.querySelector('main');
+  mn.classList.toggle('mlgRptOn',MLRP.on); $('mlgReport').hidden=!MLRP.on;
+  $('mlgOutTabs').querySelectorAll('button').forEach(b=>b.classList.toggle('on',(b.dataset.ot==='rpt')===MLRP.on));
+  if(MLRP.on)mlrRender(); else {const c=document.querySelector('main canvas');if(c&&RES)render();}   // the canvases were hidden: redraw at their size
+}
+$('mlgOutTabs').addEventListener('click',e=>{const b=e.target.closest('[data-ot]');if(b)mlrShow(b.dataset.ot==='rpt');});
+const mlrN=(x,d)=>SharedSteps.n(x,d==null?2:d);
+const mlrP=(x,d)=>(typeof x==='number'&&x<0)?'('+mlrN(x,d)+')':mlrN(x,d);
+const mlrTx=s=>String(s==null?'':s).replace(/[\\{}$&#%_^~]/g,'');
+/* a steps item, one topic per list entry (SharedSteps.group: status chip and one-line result) */
+function mlrTopics(scope,list,opt){
+  const L=list.filter(t=>t.steps&&t.steps.length), steps=[].concat(...L.map(t=>t.steps));
+  const topics=L.map(t=>{const g=SharedSteps.group(t.steps,[{key:'k',title:t.title,ref:t.ref,ids:()=>true}],{strip:false})[0];
+    return {title:t.title,ref:t.ref||'',n:t.steps.length,cls:g.cls,chip:g.chip,res:g.res};});
+  return Object.assign({type:'steps',scope,steps,topics},opt||{});
+}
+/* a result card's table as shown (header, rows, the text of each cell; numbers right-aligned) */
+function mlrDomTable(tb,caption){
+  if(!tb)return null; const t=tb.closest('table'); if(!t)return null;
+  const cell=c=>{const s=c.textContent.replace(/\s+/g,' ').trim();return {t:s.replace(/\$/g,'').replace(/\[\[/g,'[ ['),n:/^[−\-+]?[\d.,]+( [✓✗])?$/.test(s)};};
+  const head=t.tHead?[...t.tHead.rows[t.tHead.rows.length-1].cells].map(c=>c.textContent.trim()):[];
+  const rows=[...tb.rows].map(r=>{const cs=[...r.cells].map(cell);return r.classList.contains('pier')?{cells:cs,cls:'gov'}:cs;});
+  return rows.length?{type:'table',caption,head,rows,wide:true}:null;
+}
+/* a canvas plot of the tool (offPlot, the print report's own function) as an SVG figure */
+function mlrFig(series,o,w,h,caption){
+  try{const u=offPlot(series,o,w,h);return {type:'figure',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><image href="${u}" width="${w}" height="${h}"/></svg>`,caption};}
+  catch(e){return {type:'note',text:caption+' (figure not available: '+String(e&&e.message||e)+')'};}
+}
+function mlrModel(){
+  const R=RES, m=R.m, dk=deckRead(), view=$('viewMode').value, fac=view==='f';
+  const E=envData(R,true), X=extremes(R,E.F), Lt=R.Lt, secs=[];
+  const loc=x=>{const s=R.sup;let k=0;while(k<s.length-2&&x>s[k+1]+1e-6)k++;return `span ${k+1}, ${((x-s[k])/(s[k+1]-s[k])).toFixed(2)}L`;};
+  const G=g=>g?(g.lane?`${g.lab} @ ${g.p.toFixed(1)}'`:`${g.lab} ${g.dir>0?'→':'←'} lead axle @ ${g.p.toFixed(1)}'`):'—';
+  const vName=m.short==='Custom'?'Custom vehicle':(P[m.short]?P[m.short].label:m.short);
+  const basis=$('mlgBasis')?$('mlgBasis').textContent.replace(/^Basis:\s*/,''):'';
+  /* ---------- 1. Structure and analysis inputs ---------- */
+  {
+    const subs=[];
+    subs.push({title:'Spans, stiffness, factors and analysis settings',items:[{type:'kv',rows:[
+      ['Spans',`${m.spans.join(' + ')} = ${Lt} ft, pinned supports`],
+      ['Live load stiffness',dk.comp?`Uncracked short-term composite, n = ${dk.n}, b_eff = ${dk.beff} in, t_s = ${dk.ts} in, haunch ${dk.th} in (${dk.inclH?'included':'excluded'})`:'Steel section alone'],
+      ['E',`${m.E} ksi`],['Live load factor γ_LL',String(m.llf)+' ('+($('lls')&&$('lls').selectedOptions[0]?$('lls').selectedOptions[0].text:'')+')'],
+      ['Distribution factors',m.spans.map((_,k)=>`span ${k+1}: moment ${m.dfM[k]}, shear ${m.dfV[k]}`).join(' · ')+(m.dfNeg>0?` · negative moment ${m.dfNeg}`:'')],
+      ['Impact',m.imp.method==='const'?`constant ${m.imp.val}`:m.imp.method==='std'?'Std. Spec. 50/(L + 125) ≤ 0.30':`AREMA formula, S = ${m.imp.S} ft${m.imp.bal?', ballasted deck (90%)':''}, L basis: ${$('aLb')?$('aLb').selectedOptions[0].text:'span'}`],
+      ['Analysis',`position step ${m.step} ft, spacing / headway step ${m.hStep} ft, ${m.dirs.length>1?'both travel directions':'one travel direction'}`],
+      ['Tables in this report',fac?`factored per girder (γ_LL ${m.llf} × DF), as the View selector`:'unfactored per lane, including impact, as the View selector'],
+      ['Code basis',basis]]},
+      {type:'note',text:'Set in the input panel. The results on screen: [[tab:card:cM|Results]].'}]});
+    let c=0;
+    const segRows=m.segs.map((s,i)=>{const last=i===m.segs.length-1,len=last?Math.max(0,Lt-c):Math.max(0,Math.min(s.len,Lt-c)),p=props(s,dk),a=c;c+=len;
+      return [String(i+1),`${a.toFixed(1)}–${(a+len).toFixed(1)}`,`${s.bt} × ${s.tt}`,`${s.D} × ${s.tw}`,`${s.bb} × ${s.tb}`,{t:p.A.toFixed(1),n:true},{t:p.yb.toFixed(2),n:true},
+        {t:Math.round(s.Io>0?s.Io:p.I).toLocaleString()+(s.Io>0?' *':''),n:true},{t:p.Sbs.toFixed(0),n:true},{t:p.Sts.toFixed(0),n:true},{t:p.Sdk?p.Sdk.toFixed(0):'—',n:true}];});
+    subs.push({title:'Girder segments',items:[{type:'table',caption:'Segments from the left abutment (dimensions in inches; * = I override used for stiffness)',head:['#','x (ft)','Top flg b × t','Web D × t','Bot flg b × t','A (in²)','ȳ (in)','I (in⁴)','S bot stl (in³)','S top stl (in³)','S deck (in³)'],rows:segRows,wide:true},
+      {type:'note',text:'Section properties per AASHTO LRFD 10th Ed. Art. 6.10.1.5 (uncracked short-term composite for live load). Only relative stiffness affects V, M and R; absolute EI matters for deflection.'}]});
+    const ck=document.createElement('div'); ck.innerHTML=R.check||'';
+    subs.push({title:'Analysis model and engine check',items:[{type:'note',text:ck.textContent.replace(/\s+/g,' ').trim()||'—'}].concat((R.warn||[]).map(w=>({type:'note',warn:true,text:'Warning: '+String(w).replace(/<[^>]+>/g,'')})))});
+    secs.push({title:'Structure and analysis inputs',subs});
+  }
+  /* ---------- 2. Vehicle ---------- */
+  {
+    let off=0; const ax=m.axles.map((a,j)=>{off+=j?+a[1]:0;const vs=R.varOK&&j+1===m.vK;return [String(j+1),{t:(+a[0]).toFixed(2),n:true},{t:j?(vs?m.vMin+'–'+m.vMax+' (varies)':(+a[1]).toFixed(2)):'—',n:true},{t:vs?'—':off.toFixed(2),n:true}];});
+    const vi=document.createElement('div'); vi.innerHTML=$('vehInfo')?$('vehInfo').innerHTML:'';
+    let svg=''; try{drawVehicle();const u=$('cVeh').toDataURL('image/png'),w=$('cVeh').width,h=$('cVeh').height;svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><image href="${u}" width="${w}" height="${h}"/></svg>`;}catch(e){}
+    secs.push({title:'Vehicle',subs:[{title:vName,items:[svg?{type:'figure',svg,caption:'Vehicle as analyzed (axle 1 is the lead axle)'}:{type:'note',text:''},
+      {type:'note',text:vi.textContent.replace(/\s+/g,' ').trim()},
+      {type:'table',head:['Axle','Load (kips)','Spacing from previous (ft)','Distance from axle 1 (ft)'],rows:ax},
+      {type:'note',text:'Axles that do not contribute: '+(m.neglect?'neglected (AASHTO LRFD 10th Ed. Art. 3.6.1.3.1)':'always included')+' · travel: '+(m.dirs.length>1?'both directions':'one direction')+'. On screen: [[tab:card:cVeh|Vehicle Configuration]].'}]}]});
+  }
+  /* ---------- 3. Load factors and impact ---------- */
+  {
+    const T=[], ims=(R.imSpan||[]);
+    T.push({title:'Dynamic load allowance',ref:m.imp.method==='std'?'AASHTO Std. Spec. 17th Ed. Art. 3.8.2':m.imp.method==='const'?'AASHTO LRFD 10th Ed. Art. 3.6.2':'AREMA Ch. 15 (edition: verify)',steps:ims.map((v,k)=>SharedSteps.step({id:'im'+k,label:`Impact factor applied in span ${k+1} (L = ${m.spans[k]} ft)`,sym:'1 + IM',eq:'',sub:'',value:v,unit:'',d:3,
+      note:m.imp.method==='std'?'IM = 50/(L + 125) ≤ 0.30':m.imp.method==='const'?'constant entered':'AREMA steel formula, L basis as entered'}))});
+    T.push({title:'Load and distribution factors',ref:'AASHTO LRFD 10th Ed. Table 3.4.1-1; Art. 4.6.2.2',steps:[SharedSteps.step({id:'llf',label:'Live load factor (limit state selected)',sym:'\\gamma_{LL}',value:m.llf,unit:'',d:2})]
+      .concat(m.spans.map((_,k)=>SharedSteps.step({id:'gm'+k,label:`Moment distribution factor, span ${k+1}`,sym:'g_{M}',value:m.dfM[k],unit:'',d:3})))
+      .concat(m.spans.map((_,k)=>SharedSteps.step({id:'gv'+k,label:`Shear distribution factor, span ${k+1}`,sym:'g_{V}',value:m.dfV[k],unit:'',d:3})))
+      .concat(m.dfNeg>0?[SharedSteps.step({id:'gn',label:'Negative moment distribution factor',sym:'g_{M}^{\\minus}',value:m.dfNeg,unit:'',d:3})]:[])});
+    secs.push({title:'Load factors and impact',subs:[{title:'Factors used',items:[mlrTopics('fac',T),{type:'note',text:'Multiple presence is included in the distribution factors entered (AASHTO LRFD 10th Ed. Art. 3.6.1.1.2), not applied again.'}]}]});
+  }
+  /* ---------- 4. Governing live load effects ---------- */
+  {
+    const T=[], sf={M:'kip-ft',V:'kips',R:'kips'};
+    [['Mp','M','^{+}',1,'Maximum positive moment'],['Mn','M','^{\\minus}',0,'Maximum negative moment'],['Vp','V','^{+}',1,'Maximum positive shear'],['Vn','V','^{\\minus}',0,'Maximum negative shear'],
+     ['Rp','R','^{+}',1,'Maximum reaction'],['Rn','R','^{\\minus}',0,'Minimum reaction (uplift if negative)']].forEach(([k,s,sg,isMax,lab])=>{
+      const b=X[k]; if(!b)return; const ei=R.effs.indexOf(b.ef); if(ei<0)return;
+      const raw=isMax?R.res[ei].max:R.res[ei].min, g=R.dfOf(b.ef,raw), ef=b.ef, u=sf[s];
+      const where=ef.t==='R'?`Support ${'ABCDE'[ef.q]} (x = ${b.x.toFixed(1)} ft)`:`x = ${b.x.toFixed(2)} ft (${loc(b.x)})`;
+      const gl=ef.t==='M'?(raw<0&&m.dfNeg>0?'negative-moment DF':'moment DF, '+(ef.spans.length>1?'larger of spans '+ef.spans.map(z=>z+1).join(' and '):'span '+(ef.spans[0]+1))):'shear DF, '+(ef.spans.length>1?'larger of spans '+ef.spans.map(z=>z+1).join(' and '):'span '+(ef.spans[0]+1));
+      T.push({title:lab+' — '+where,ref:'AASHTO LRFD 10th Ed. Table 3.4.1-1, Art. 3.6.2',steps:[
+        SharedSteps.step({id:k+'.lane',label:'Envelope value per lane, including impact (influence-line envelope)',sym:s+sg+'_{LL+IM}',value:raw,unit:u,d:2,note:'Governing: '+G(b.g)}),
+        SharedSteps.step({id:k+'.g',label:'Distribution factor ('+gl+(m.rail?', rail set':'')+')',sym:'g',value:g,unit:'',d:4}),
+        SharedSteps.step({id:k,label:lab+', factored per girder',sym:s+sg,eq:'\\gamma_{LL}\\, g\\, '+s+sg+'_{LL+IM}',sub:mlrN(m.llf,2)+'\\cdot '+mlrN(g,4)+'\\cdot '+mlrP(raw,2),value:b.v,unit:u,d:1})]});
+    });
+    secs.push({title:'Governing live load effects',note:'The values of the metric cards at the top of the Results tab, worked: γ_LL · g · (envelope value per lane including impact).',
+      subs:[{title:'Governing results, factored per girder',items:[mlrTopics('gov',T),{type:'note',text:'On screen: [[tab:card:cM|Moment Envelope]], [[tab:card:cV|Shear Envelope]], [[tab:card:rB|Support Reactions]]. Each governing position can be loaded into step mode from the envelope table ([[tab:card:envB|Envelope Table]]).'}]}]});
+  }
+  /* ---------- 5. Envelopes and reactions ---------- */
+  {
+    const E2=envData(R,fac), lab=fac?'factored per girder':'per lane, including impact';
+    const items=[mlrFig(E2.M,{Lt,sup:R.sup,ylab:'Moment (kip-ft)'},1100,300,'Moment envelope, '+lab+' (red: max, blue: min)'),
+      mlrFig(E2.V,{Lt,sup:R.sup,ylab:'Shear (kips)'},1100,300,'Shear envelope, '+lab+' (purple: max, teal: min)')];
+    const et=mlrDomTable($('envB'),'Tenth points, '+lab+'; governing case, direction and lead axle position of each extreme'); if(et){et.lazy=true;et.title='Envelope table — tenth points';items.push(et);}
+    const tt=$('trCard')&&!$('trCard').classList.contains('hidden')?mlrDomTable($('trB'),'Results at plate transitions (segment boundaries), '+lab):null; if(tt)items.push(tt);
+    const rt=mlrDomTable($('rB'),'Support reactions, '+lab+' (upward positive; a negative minimum is uplift)'); if(rt)items.push(rt);
+    items.push({type:'note',text:'Tables as on the [[tab:card:envB|Results tab]] (View: '+($('viewMode').selectedOptions[0]||{}).text+'). The absolute maxima per span are on screen only.'});
+    secs.push({title:'Envelopes and reactions',subs:[{title:'Moment and shear envelopes, reactions',items}]});
+  }
+  /* ---------- 6. Live load deflection ---------- */
+  if(DEF&&$('dB')&&$('dB').rows.length){
+    const N=Math.max(1,num('dLim',800)), items=[mlrFig([{pts:DEF.secs.map((s,j)=>[s.x,DEF.res[j].dn]),color:'#2563eb',fill:'rgba(37,99,235,.1)',peak:-1},{pts:DEF.secs.map((s,j)=>[s.x,DEF.res[j].up]),color:'#0d9488',fill:'rgba(13,148,136,.1)',peak:1}],{Lt,sup:R.sup,ylab:'Deflection (in)'},1100,240,'Live load deflection (blue: max downward, teal: max upward)')];
+    const T=[...$('dB').rows].map((tr,k)=>{const c=[...tr.cells].map(x=>x.textContent.trim()), d=parseFloat(c[2]), al=parseFloat(c[4]), ra=parseFloat(c[5]);
+      return {title:`Span ${k+1} (L = ${c[1]} ft)`,ref:'AASHTO LRFD 10th Ed. Art. 2.5.2.6.2',steps:[
+        SharedSteps.step({id:'d'+k,label:'Maximum downward deflection (service, LLF not applied)',sym:'\\delta',value:d,unit:'in',d:3,note:'at x = '+c[3]+' ft; '+c[7]}),
+        SharedSteps.step({id:'a'+k,label:'Allowable deflection',sym:'\\delta_{allow}',eq:'\\frac{12\\, L}{N}',sub:'\\frac{12\\cdot '+mlrTx(c[1])+'}{'+N+'}',value:al,unit:'in',d:3}),
+        SharedSteps.step({id:'r'+k,label:'Deflection ratio',sym:'\\frac{|\\delta|}{\\delta_{allow}}',sub:'\\frac{'+mlrN(Math.abs(d),3)+'}{'+mlrN(al,3)+'}',value:ra,unit:'',d:2,ok:ra<=1+1e-9})]};});
+    items.push(mlrTopics('dfl',T),{type:'note',text:`Load case: ${$('dCase').selectedOptions[0].text}; deflection DF ${num('dDF',1)}; ${$('dIM').checked?'with':'without'} impact; limit L/${N}. Values as on the [[tab:card:dB|Live Load Deflection card]] (3 decimals).`});
+    secs.push({title:'Live load deflection',subs:[{title:'Deflection by span',items}]});
+  }
+  secs.forEach(sc=>sc.subs.forEach(q=>{q.items=q.items.filter(it=>!(it.type==='note'&&!String(it.text||'').trim()));}));   // no empty notes
+  /* ---------- 7. References ---------- */
+  secs.push({title:'References',subs:[{title:'Codes and references cited',items:[{type:'note',text:basis||'—'}]}]});
+  const pj=$('rProj')?$('rProj').value.trim():'', by=$('rBy')?$('rBy').value.trim():'';
+  return {title:'Moving Load Generator — Calculation Report',subtitle:(pj||'Untitled')+' · '+vName,code:'AASHTO LRFD 10th Ed. (2024) · AASHTO Std. Spec. 17th Ed. (2002) · AREMA (rail presets)',
+    info:[['Project',pj],['Project No.',''],['Computed by',by],['Date',''],['Checked by',''],['Checked date','']],
+    head:{left:'Project No. — — '+(pj||'—').slice(0,40),right:'Computed: '+(by||'—')+' · Checked: —',foot:(pj||'Untitled')+' (Moving Load Generator)'},sections:secs};
+}
+function mlrRender(){
+  const T=$('mlgReport'); if(!T||!MLRP.on)return;
+  if(!window.SharedReport||!window.SharedSteps){T.innerHTML='<div class="warn">shared/report.js or shared/steps.js is not loaded: keep the shared folder next to this file.</div>';return;}
+  if(!RES){T.innerHTML='<div class="warn">No results: press Run (or correct the input errors).</div>';MLRP.api=null;MLRP.doc=null;return;}
+  let M;
+  try{M=mlrModel();}catch(e){console.error(e);T.innerHTML='<div class="warn">Report error: '+esc(e&&e.message)+'</div>';MLRP.api=null;MLRP.doc=null;return;}
+  const hd=document.querySelector('header.hdr'), st=hd&&getComputedStyle(hd).position==='sticky'?hd.offsetHeight:0;
+  MLRP.api=SharedReport.mount(T,M,{closed:MLRP.closed,onGoto:mlrGoto,stick:st});
+  MLRP.doc=MLRP.api.doc;
+}
+/* [[tab:card:<id>|…]] links: back to the Results tab, at that card */
+function mlrGoto(name){
+  mlrShow(false);
+  const id=String(name).replace(/^card:/,''), t=$(id), c=t&&t.closest('.card'); if(!c)return;
+  setTimeout(()=>{c.scrollIntoView({behavior:'smooth',block:'start'});c.classList.add('mlgWkFlash');setTimeout(()=>c.classList.remove('mlgWkFlash'),1200);},30);
+}
+// a new analysis while the Report tab is shown rebuilds it
+{const _r=run; run=function(){_r.apply(this,arguments);if(MLRP.on)mlrRender();};}
+/* Ctrl+P while the Report tab is shown prints the report alone (shared/report.js print layout and running header) */
+window.addEventListener('beforeprint',()=>{
+  if(!MLRP.on||!MLRP.doc||document.body.classList.contains('rp-printing'))return;
+  let box=document.getElementById('rp-print');if(!box){box=document.createElement('div');box.id='rp-print';document.body.appendChild(box);}
+  box.innerHTML='<div class="rp"><article class="rp-doc">'+SharedReport.html(MLRP.doc,{lazy:false})+'</article></div>';
+  document.body.classList.add('rp-printing');
+});
+window.__mlrForTest=()=>({doc:MLRP.doc,RES,DEF,X:RES?extremes(RES,envData(RES,true).F):null});   /* tests only */
+</script>
```

## 2026-11-02 — PR: claude/phone-print-mlg — Report tables wrap: kv values and the last envelope column were off the page (PHN; display only, no calculation change)

Engineer-approved overnight job (2026-11-02): phone layout at 390 / 768 px and report print polish, one PR per tool. Code site tagged `PHN`.

### PHN-1. The Report's tables follow the shared viewer's wrapping   [display only]
- **Problem:** the tool's page-wide rules `th{…text-align:right;white-space:nowrap}` and `td{…text-align:right;…white-space:nowrap}` also applied to the tables of the Report tab (shared/report.js viewer). The settings table (§1.1, `rp-kv`) became one line per row, 1,845 px wide. On screen its values were off to the right at every window width. In print (Report → Print report) every value of §1.1 was cut off at the page edge: only the labels printed. The envelope table (§5.1, tenth points) was 778 px against the 720 px text width, so its last column, MAX |V|, was cut off.
- **Where:** after the rule `th:first-child,td:first-child{text-align:left}` (top `<style>`).
- **Added:**
```css
.rp td,.rp th{white-space:normal}.rp .rp-kv td{text-align:left}   /* PHN (2026-11-02): … */
```
- Only the Report viewer (`.rp`, on screen and in its print box) is affected. The tool's own tables (Results tab, inputs, the 🖨 Print Report document) keep their rules.
- **Check case:** default project → Report → Print report. Before: 10 pages, §1.1 labels only, envelope table without its MAX |V| column. After: 11 pages; §1.1 shows "Spans 100 + 100 = 200 ft, pinned supports" … "Code basis AASHTO LRFD … (edition per owner)." in full, and the envelope table shows all 11 columns (MAX |V| 197.2, 166.1, …).

### Phone layout
- Already correct: at 390 and 768 px the page does not scroll sideways on any input or output tab (the 900 px breakpoint stacks the panels, and the header and tab bars wrap). No change. `tests/smoke/phone-layout.mjs` gains the key `mlg` (6 input tabs + Results + Report).
- The 🖨 Print Report document (popup, all presets, 52 pages) was checked as well. Nothing was clipped and nothing was changed.

### How verified (no computed result, saved key or hand-off changed)
- origin/main vs this branch, headless Chromium, file://, at 1280 px: the page text on load and on all 8 tabs, the whole-document `textContent` (196,736 chars) and localStorage after load are identical. The run time ("Solved in … ms") is masked.
- Screenshots at 900 / 1280 px: every non-Report tab differs only in the "Solved in … ms" label (119–206 px). The Report tab differs because the §1.1 table now wraps.
