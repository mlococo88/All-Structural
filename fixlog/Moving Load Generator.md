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

## 2026-10-04 — PR: claude/conn-lldf-movingload (PR link added after merge)

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

## 2026-10-09 — PR: claude/tabs-movingload (PR link added after merge)

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
