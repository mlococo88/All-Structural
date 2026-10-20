# Fix log — Bridge Substructure Loading.html

Governing basis used for fixes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024)

## 2026-10-04 — PR: claude/fix-subloads (PR link added after merge)

### F1. Minimum support length: Zone 2 percentage 100% → 150%   [calc change] [more conservative]
- **Where:** function `supportLength` (≈ line 1945 at time of fix). Anchor text: `pct = Z === 1 ? (As < 0.05 ? 75 : 100)`
- **Problem:** Zone 2 used 100% of N. Table 4.7.4.4-1 requires 150% for Zones 2, 3 and 4. Zone 2 bridges were under-required by one third.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 4.7.4.4, Table 4.7.4.4-1 (Zone 1, As < 0.05: ≥ 75%; Zone 1, As ≥ 0.05: 100%; Zones 2, 3, 4: 150%).
- **Before:**
  ```js
  const Z = SM.site.zone, As = SM.site.As, pct = Z === 1 ? (As < 0.05 ? 75 : 100) : Z === 2 ? 100 : 150, D = MODEL.dist, out = [];
  ```
- **After:**
  ```js
  const Z = SM.site.zone, As = SM.site.As, pct = Z === 1 ? (As < 0.05 ? 75 : 100) : 150, D = MODEL.dist, out = [];
  ```
- **Check case:** abutment end of a 200 ft unit, average pier height H = 20 ft, skew 0°, Zone 2.
  N = (8 + 0.02·200 + 0.08·20)(1 + 0.000125·0²) = 13.60 in.
  Before: pct = 100, N_req = 13.60 in. After: pct = 150, N_req = 20.40 in.
  Zone 1 (As = 0.12) is unchanged at 100% (13.60 in); Zone 3 is unchanged at 150% (20.40 in).
- **How verified:** the actual `supportLength` function was extracted from the old and new files and run in node (`sl_test.js`) with stubbed `P`/`MODEL`. The numbers above are its output. `node --check` on the inline script.
- **Other copies of this code:** none. (`abutment_calculator.html` has its own support-length check; not touched here.)

### F2. Dynamic ice: F = min(Fb, Fc) only when w/t ≤ 6   [calc change] [more conservative]
- **Where:** function `iceCalc` (≈ line 1728). Anchor text: `Fb = al > 15 ? Cn * p * t * t : Infinity, F =`
- **Problem:** for noses inclined more than 15°, F was always taken as the lesser of Fc and Fb. Art. 3.9.2.2 allows the lesser value only when w/t ≤ 6.0; for w/t > 6.0, F = Fc. Wide piers with inclined noses were under-loaded.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 3.9.2.2 (Eqs. 3.9.2.2-1 to -5).
- **Before:**
  ```js
  const wd = up.we, Ca = Math.sqrt(5 * t / wd + 1), Fc = Ca * p * t * wd, Cn = al > 15 ? 0.5 / Math.tan(rad(al - 15)) : Infinity, Fb = al > 15 ? Cn * p * t * t : Infinity, F = al > 15 ? Math.min(Fb, Fc) : Fc;
  ```
- **After:**
  ```js
  const wd = up.we, Ca = Math.sqrt(5 * t / wd + 1), Fc = Ca * p * t * wd, Cn = al > 15 ? 0.5 / Math.tan(rad(al - 15)) : Infinity, Fb = al > 15 ? Cn * p * t * t : Infinity, F = al > 15 && wd / t <= 6 ? Math.min(Fb, Fc) : Fc;   // 3.9.2.2: lesser of Fc and Fb only for w/t <= 6; F = Fc for w/t > 6
  ```
  Display: a `w/t` row was added to the ice table in `iceHtml` (just above the "Dynamic ice force F" row), and the manual sentence "otherwise the lesser of F<sub>c</sub> and F<sub>b</sub> = C<sub>n</sub>pt²." now ends "… when w/t ≤ 6 (F = F<sub>c</sub> when w/t > 6)."
- **Check case:** t = 1.0 ft, p = 24 ksf, α = 45°.
  - w = 8 ft (w/t = 8): Ca = √(5·1/8 + 1) = 1.2748; Fc = 1.2748·24·1·8 = 244.75 kip; Cn = 0.5/tan 30° = 0.8660; Fb = 0.8660·24·1² = 20.78 kip. Before: F = 20.78 kip. After: F = 244.75 kip.
  - w = 5 ft (w/t = 5): Fc = 1.4142·24·1·5 = 169.71 kip, Fb = 20.78 kip. Before and after: F = 20.78 kip (unchanged).
- **How verified:** the actual `const wd = up.we, …` line was extracted from both files and run in node (`sl_test.js`). `node --check` on the inline script.
- **Other copies of this code:** none known.

### F3. At-rest earth pressure: EH load factors 1.35/0.90   [calc change] [less conservative for at-rest abutments with the default factors]
- **Where:** function `comboComps` (the live combination engine, ≈ line 2725). Anchor text: `const EH = ((P.units[k].earth || {}).method === 'atrest')`
- **Problem:** abutments set to "At rest, k₀" used the active EH factors 1.50/0.90. Table 3.4.1-2 gives 1.35/0.90 for at-rest earth pressure.
- **Governing provision:** AASHTO LRFD 10th Ed., Table 3.4.1-2 (EH: active 1.50/0.90; at-rest 1.35/0.90).
- **Before:**
  ```js
  const EH = [nz(br.ehMax) || 1.5, nz(br.ehMin) || 0.9], EV = [nz(br.evMax) || 1.35, nz(br.evMin) || 1.0], ES = [nz(br.esMax) || 1.5, nz(br.esMin) || 0.75];
  ```
- **After:**
  ```js
  const EH = ((P.units[k].earth || {}).method === 'atrest') ? [nz(br.ehAtMax) || 1.35, nz(br.ehAtMin) || 0.9] : [nz(br.ehMax) || 1.5, nz(br.ehMin) || 0.9] /* Table 3.4.1-2: EH at-rest 1.35/0.90, active 1.50/0.90 */, EV = [nz(br.evMax) || 1.35, nz(br.evMin) || 1.0], ES = [nz(br.esMax) || 1.5, nz(br.esMin) || 0.75];
  ```
  Supporting edits:
  - `defP` patch in `patchEarth`: added `ehAtMax: 1.35, ehAtMin: 0.90` after `ehMin: 0.90,`.
  - `paneBridge` patch: added inputs `fld('γ<sub>EH</sub> max, at rest', 'br.ehAtMax') + fld('γ<sub>EH</sub> min, at rest', 'br.ehAtMin')` after the `br.ehMin` field. The note now reads "(active EH; at-rest EH applies to abutments set to k₀)".
  - The earth-tab note `Load factors: EH …` shows the at-rest pair for an at-rest abutment.
  - The `basisExtra` "Backfill" row adds "(at rest x/y)" when any abutment uses k₀.
  - Saved data: the new `br.ehAtMax` / `br.ehAtMin` fields are optional. Old projects without them get 1.35/0.90 through the `|| 1.35` / `|| 0.9` fallback. No key or format change.
- **Check case:** one abutment unit, Strength I with LL off, unfactored DC = 150 kip, DW = 10, SH = 20, EH = 40 (all same sign).
  - Before (k₀): max = 1.25·150 + 1.50·10 + 20 + **1.50**·40 = 282.50; min = 0.90·150 + 0.65·10 + 20 + 0.90·40 = 197.50.
  - After (k₀): max = 187.5 + 15 + 20 + **1.35**·40 = 276.50; min = 197.50 (unchanged).
  - Rankine/Coulomb abutments: unchanged (282.50 / 197.50).
- **How verified:** `lfOf`, `comboComps` and `comboEval` were extracted from both files and run in node with stubbed loads (`sl_test.js`). `node --check` on the inline script.
- **Note:** the older `combine` wrapper in the "combinations" block of the earth section (`const pf = (v, gg, hi) => …`) still uses the active pair. That wrapper is superseded by the final `combine = function (k)` that calls `comboComps`, so it is not used. It was left unchanged, per the instruction not to refactor the `combine` monkey-patches.
- **Other copies of this code:** none.

### F4. Shrinkage load factor γSH option (0.5 with gross stiffness)   [calc change, opt-in] [no result change with the default]
- **Where:** function `comboComps` (≈ line 2733). Anchor text: `fix(p4.SH && sc(p4.SH,`
- **Problem:** SH was always combined at γ = 1.0. Table 3.4.1-3 gives γSH = 0.50 for substructures analysed with gross stiffness I_g, and 1.0 with I_effective. The tool's own column stiffness factor `br.Ifac` defaults to 1.0 (that is, gross I_g), but the analysis basis is the engineer's decision, so the default stays at 1.0 (old behaviour; conservative).
- **Governing provision:** AASHTO LRFD 10th Ed., Table 3.4.1-3 (substructures supporting non-segmental superstructures: CR, SH using I_g 0.50; using I_effective 1.00).
- **Before:**
  ```js
  perm(DC, L.dc, 'DC'); perm(D.DW, L.dw, 'DW'); fix(p4.SH, 'SH');
  ```
- **After:**
  ```js
  perm(DC, L.dc, 'DC'); perm(D.DW, L.dw, 'DW'); fix(p4.SH && sc(p4.SH, num(br.gSH) === 0.5 ? 0.5 : 1.0), 'SH');   // γSH, Table 3.4.1-3: 0.5 with I_g, 1.0 with I_eff
  ```
  New input in the Temperature section (after "Shrinkage + creep strain"):
  `fld('γ<sub>SH</sub> (Table 3.4.1-3)', 'br.gSH', '', 'sel', { options: [['1.0', '1.0 (substructure analysed with I_eff)'], ['0.5', '0.5 (substructure analysed with gross I_g)']] })`.
  The "Analysis options" basis row now prints `γSH = 1.00/0.50 (Table 3.4.1-3)`. The `br.gSH` field is optional; missing or blank = 1.0.
- **Check case:** same as F3 with k₀ and γSH = 0.5: max = 187.5 + 15 + 0.5·20 + 54 = 266.50 (was 276.50 with γSH = 1.0); min = 135 + 6.5 + 10 + 36 = 187.50 (was 197.50). With the default (blank / 1.0), the results are identical to before.
- **How verified:** node run of the extracted `comboComps` (`sl_test.js`).
- **Other copies of this code:** the superseded earlier `combine` versions (≈ lines 1761, 1961, 2093) add SH at 1.0. They are not used by the final engine and were left unchanged (no refactor of the monkey-patches).

## Open items (not changed)
- O1. **Service IV wind pair (0.75V with γWS = 1.00).** Line `const vLS = key => key === 'III' ? nz(P.br.V) : key === 'V' ? 80 : key === 'SI' ? 70 : 0.75 * nz(P.br.V);` and `c.gws = 1.0`. My understanding of the 8th Ed.+ framework (Table 3.8.1.1.2-1 Service IV = 0.75V; Table 3.4.1-1 Service IV γWS = 1.00) says this is consistent, so I did not change it. I could not open the 10th Ed. text from this environment. — Engineer to confirm against the 10th Ed. Table 3.8.1.1.2-1 and Table 3.4.1-1. The file's own PENDING item for this is left in place.
- O2. **γSH default.** The default stays at 1.0. Because `br.Ifac` defaults to 1.0 (gross I_g), Table 3.4.1-3 would give 0.5 for a default model. — Engineer to decide whether the default should follow `Ifac` (for example 0.5 when Ifac = 1.0).
- O3. **EE I EH factor (`gEHEQ`, default 1.0).** Table 3.4.1-1 lists γp for EH in EE I. Not changed (EOR judgment, review item 5).
- O4. The `combine` monkey-patch chain was not refactored (by instruction).

## 2026-10-04 — PR: claude/step1-group2 (PR link added after merge)

### F5. "← All tools" link + shared project info (HANDOFF.md §4.1)   [feature (no result change)]

- **Type:** feature (no result change). No formulas, factors, units, code references, storage keys or saved-data formats were changed.
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, hidden in print), and two buttons, **Use shared project info** and **Share project info**, in the Project tab. Share publishes `bridgeSuite.v1.projectMeta` (`_schema:"bridge-project-meta"`) with the tool's own fields, and `""` for fields it lacks. Use reads it with `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm dialog listing each field that will be overwritten (old → new), writes only this tool's fields, never blanks a field when the shared value is blank, and writes through the tool's normal path (sets the input and dispatches a bubbling `input` event, so the tool's own handler updates its state and autosaves).
- **Field mapping (shared `fields` key → this tool's input):**

| shared field | this tool |
|---|---|
| `projectName` | `#f_meta_name` |
| `bridgeId` | — (not in this tool; shared as `""`, ignored on Use) |
| `jobNo` | `#f_meta_num` |
| `client` | — (not in this tool; shared as `""`, ignored on Use) |
| `location` | — (not in this tool; shared as `""`, ignored on Use) |
| `preparedBy` | `#f_meta_by` |
| `checkedBy` | `#f_meta_chk` |
| `date` | `#f_meta_date` |

- **Governing provision:** none (not a calculation change). Spec: HANDOFF.md §4.1 (channel) and §5 (helper).
- **Check case:** Share with Project name "Route 9 over Mill Brook", Job no. "J-4471", Prepared by "M. Lococo", Checked by "A. Checker", Date "2026-10-04"; then Use in another tool → the mapped fields show those values after one confirm; unmapped fields are unchanged. Calculation results before/after: identical (no calculation code touched).

**Edit 1 — link.** Where: page `<header>` (after the `.brand` block; anchor `<div class="hdr-spacer"></div>` before `id="btn-open"`).
- Before:
```html
  </div>
  <div class="hdr-spacer"></div>
  <div class="hdr-group">
    <button type="button" class="btn" id="btn-open">Open</button>
```
- After:
```html
  </div>
  <a class="bx-all-tools" href="tools.html" target="_top" title="Open the list of all tools">&larr; All tools</a>
  <div class="hdr-spacer"></div>
  <div class="hdr-group">
    <button type="button" class="btn" id="btn-open">Open</button>
```

**Edit 2 — buttons.** Where: `paneProject()`; anchor `fld('Checked by', 'meta.chk', '', 'text'))`.
- Before:
```js
+ fld('Designed by', 'meta.by', '', 'text') + fld('Checked by', 'meta.chk', '', 'text'))
```
- After:
```js
+ fld('Designed by', 'meta.by', '', 'text') + fld('Checked by', 'meta.chk', '', 'text')
      + `<div class="fld full" style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn btn-sm" id="bx-pm-use" title="Fill these fields from the project info shared by another tool">Use shared project info</button><button type="button" class="btn btn-sm" id="bx-pm-share" title="Share these project fields with the other tools">Share project info</button></div>`)
```

**Edit 3 — CSS.** Where: end of the first `<style>` block in `<head>` (inserted just before its `</style>`).
- Before: `</style>`
- After:
```css
/* "All tools" link */
.bx-all-tools { font-size: .82rem; color: var(--muted); text-decoration: none; white-space: nowrap; }
.bx-all-tools:hover { color: var(--blue); text-decoration: underline; }
@media print { .bx-all-tools { display: none !important; } }
</style>
```

**Edit 4 — scripts.** Where: just before the first `</head>`.
- Before: `</head>`
- After:
```html
<script>
/* BridgeXfer v1 verbatim from HANDOFF.md §5 (not repeated here) */
</script>
<script>
/* Shared project info (HANDOFF.md §4.1, channel projectMeta): "Use shared project info" / "Share project info".
   Uses BridgeXfer v1 above. Writes only the fields this tool has, through the tool's normal input path. */
(function(){
  var TOOL='Bridge Substructure Loading', FILE='Bridge Substructure Loading.html';
  var MAP={ projectName:'#f_meta_name', bridgeId:'', jobNo:'#f_meta_num', client:'', location:'', preparedBy:'#f_meta_by', checkedBy:'#f_meta_chk', date:'#f_meta_date' }; // shared field -> this tool's input ('' = this tool has no such field)
  var LBL={ projectName:'Project name', bridgeId:'Bridge ID', jobNo:'Job / project no.', client:'Client', location:'Location', preparedBy:'Prepared by', checkedBy:'Checked by', date:'Date' };
  function el(k){ return MAP[k] ? document.querySelector(MAP[k]) : null; }
  function share(){
    var f={}; for(var k in LBL){ var e=el(k); f[k]=e ? String(e.value==null?'':e.value).trim() : ''; }
    var r=BridgeXfer.publish('projectMeta',{ _schema:'bridge-project-meta', project:{ name:f.projectName, bridgeId:f.bridgeId }, fields:f }, TOOL, FILE);
    alert(r.error ? 'Could not share project info: '+r.error : 'Project info shared. Other tools can load it with "Use shared project info".');
  }
  function use(){
    var r=BridgeXfer.read('projectMeta','bridge-project-meta',1);
    if(r.error){ alert(r.empty ? 'No shared project info yet. Click "Share project info" in a tool that has the project filled in.' : 'Cannot use shared project info: '+r.error); return; }
    var f=r.payload.fields||{}, todo=[], lines=[], skipped=[];
    for(var k in LBL){ var e=el(k); if(!e) continue;
      var v=f[k]==null ? '' : String(f[k]).trim(); if(!v) continue;
      if(e.type==='date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)){ skipped.push(LBL[k]+' "'+v+'" (not a YYYY-MM-DD date)'); continue; }
      if(v===e.value) continue;
      todo.push([k,v]); lines.push('  '+LBL[k]+': "'+(e.value||'')+'" -> "'+v+'"'); }
    var from='From: '+BridgeXfer.describe(r.payload);
    if(!todo.length){ alert('Shared project info has nothing new for this tool.\n\n'+from+(skipped.length?'\n\nNot used: '+skipped.join('; '):'')); return; }
    if(!confirm('Use shared project info?\n\n'+from+'\n\nThis will overwrite:\n'+lines.join('\n')+(skipped.length?'\n\nNot used: '+skipped.join('; '):'')+'\n\nBlank shared fields are left unchanged.')) return;
    todo.forEach(function(t){ var e=el(t[0]); if(!e) return; e.value=t[1]; e.dispatchEvent(new Event('input',{ bubbles:true })); });
  }
  document.addEventListener('click', function(ev){
    var b=ev.target && ev.target.closest ? ev.target.closest('#bx-pm-use,#bx-pm-share') : null; if(!b) return;
    if(b.id==='bx-pm-use') use(); else share();
  });
})();
</script>
</head>
```

- **How verified:**
  - `node --check` on every plain inline `<script>` of the old and new file: no failures in either (2 new scripts per file: helper + glue). The tool has no `text/babel` blocks.
  - jsdom load with CDN scripts not fetched: the same load errors as the original file (none new); `window.BridgeXfer` exists; the link has `href="tools.html" target="_top"`.
  - Share → Use run in jsdom between all six tools of this PR (30 pairs) with the localStorage entry copied across: every pair passed. The payload had `_schema:"bridge-project-meta"`, `schemaVersion:1`, all 8 `fields` keys, and `producedAt` equal to `bridgeSuite.v1.projectMeta.updatedAt`. Fields were written through the tool's own input handler and reached its saved state/autosave. A blank shared field never blanked a tool field; an empty channel and a wrong `_schema` gave a message and changed nothing.
  - Diff check: at most one line is removed, the line replaced at the button anchor where that anchor is inside a JS template string; everything else is additions. No calculation code, storage key or saved-data format was touched.
- **Other copies:** the BridgeXfer v1 helper is duplicated verbatim in every tool that uses it (CLAUDE.md §3; list in the PR). The glue block is the same in each tool of this PR except `TOOL`/`FILE` and the field map.
- **Open items:** none.

## 2026-10-04 — PR: claude/conn-reactions-subloads (PR link added after merge)

### F6. Pull superstructure reactions from PS-Beam / ST-Girder (HANDOFF.md §4.4, channel `superReactions`)   [feature: hand-off (no result change)]
- **Where:** new IIFE `patchRxHandoff()` in the main script, directly above `/* ---------- start ---------- */`. Anchor text: `(function patchRxHandoff() {`
- **Problem:** none (feature). Approved step 2 of the cross-tool work.
- **Governing provision:** n/a. No formula, factor, default or unit changed. The only change to results is through the reaction inputs the user confirms in the dialog.
- **What it does:**
  - Reactions tab: **Pull from PS-Beam / ST-Girder** and **Import hand-off (JSON)** buttons next to "Clear all", a "New data available: <producer>, <time>" marker (`BridgeXfer.isNew('superReactions','subloads')`) and a dot on the Reactions side tab. Nothing is applied on page load.
  - The dialog lists every valid payload (the channel key and the `.by.psbeam` / `.by.stgirder` / `.by.mct` copies) so the user can choose the producer; shows producer, file, time, project, girder line, basis and the producer's `notes`; and lets the user map each incoming support to a SubLoads support (or skip it), choose the bearing row (back / ahead) at an expansion joint, choose the girders (same position as the source [default], all, interior, exterior, the source beam number, or custom), and choose **Replace** (default) or **Add to** the existing values. It lists every cell it will change as "old → new" and needs **Apply**.
  - Validation: `_schema` and `schemaVersion ≤ 1` (BridgeXfer), `factored:false` required, `perGirder` not false, force unit kip (kN and lb converted explicitly; anything else refused), length ft (m converted), every DC1/DC2/DW a finite number, each support has girders. Negative (uplift) values are allowed but listed as a warning. Two source supports mapped to the same SubLoads row are refused.
  - Apply writes only the confirmed `P.rx.data[k][j]` cells (`dc1/dc2/dw`, or `dc1a/dc2a/dwa` for the ahead row at a joint), in kip, unfactored, then records a source record in the **new optional field `P.rxSrc`** (producer, producerFile, producedAt, project, girder, position, mode, via, adoptedAt, targets; last 20 kept) and calls `BridgeXfer.markAdopted('superReactions','subloads',producedAt)`. "Clear all" also clears `P.rxSrc` once every reaction is zero.
  - Source shown: a "Hand-off sources" note and a "from <producer>, <time>" tag on each support heading on the Reactions tab; a note on each unit's Dead load chapter; and a "From hand-off: …" line in the report's "Superstructure reactions" basis row.
- **Mapping:**

| Hand-off | SubLoads |
|---|---|
| `supports[i].id` ("Support n", "Abut 1/2", "Pier n", or a unit name) | support k: default "Support n" → unit n−1, "Abut 1" → first, "Abut 2" → last, "Pier n" → unit n; user can change or skip |
| first / last source support at a joint unit | default "ahead" / "back" bearing row (user choice) |
| `girders[label=L].DC1 / DC2 / DW` (kip) | `P.rx.data[k][j].dc1 / dc2 / dw` (or `…a` ahead row), for each chosen girder j |
| `girderLine.position` (or `girders[].position`) | default girder set: interior → G2…G(n−1); exterior → G1 and Gn |
| `producer`, `producedAt`, … | `P.rxSrc[]` (new optional field) |
| `liveLoad` | not used (SubLoads computes its own live load); shown only through `notes` |

- **Before:**
```js
/* ---------- start ---------- */
```
- **After:** this block inserted before that line:
```js
/* ---------- superstructure reactions hand-off (HANDOFF.md §4.4, channel superReactions) ----------
   Reactions tab: "Pull from PS-Beam / ST-Girder" (with a new-data marker) and "Import hand-off (JSON)".
   Nothing is applied on page load. The dialog shows the source and every cell it will overwrite, and
   the user maps the incoming girder line to SubLoads supports, bearing rows and girders. Only the
   confirmed P.rx.data cells change; the source is kept in the new optional field P.rxSrc and shown on
   the Reactions tab, the Dead load tab and the report. Values stay unfactored, in kip. */
(function patchRxHandoff() {
  const CH = 'superReactions', SCH = 'bridge-super-reactions', RID = 'subloads';
  const BY = ['psbeam', 'stgirder', 'mct'];
  const TOKIP = { kip: 1, kips: 1, k: 1, kn: 1 / 4.4482216152605, lb: 0.001, lbs: 0.001, lbf: 0.001 };   // force unit -> kip
  const TOFT = { ft: 1, feet: 1, m: 1 / 0.3048 };                                                          // length unit -> ft
  const LBL = { dc1: 'DC1', dc2: 'DC2', dw: 'DW' };
  const BX = () => window.BridgeXfer;
  const when = iso => { const d = new Date(iso); return isNaN(d) ? String(iso || '?') : d.toLocaleString(); };
  const r3 = v => Math.round(v * 1000) / 1000;
  let DLG = null;   // open dialog state

  /* every published payload on the channel: the latest, plus the per-producer copies */
  function candidates() {
    const out = [], seen = {}, errs = [];
    if (!BX()) return { list: out, errs: ['The hand-off helper is not available in this browser.'] };
    const add = (r, via) => { if (r.ok) { const p = r.payload, key = (p.producer || '') + '|' + (p.producedAt || ''); if (!seen[key]) { seen[key] = 1; out.push(p); } } else if (!r.empty) errs.push(`${via}: ${r.error}`); };
    add(BX().read(CH, SCH, 1), 'latest hand-off');
    BY.forEach(id => add(BX().read(`${CH}.by.${id}`, SCH, 1), `copy from ${id}`));
    out.sort((a, b) => String(b.producedAt || '').localeCompare(String(a.producedAt || '')));
    return { list: out, errs };
  }
  /* validate one payload and convert it to kip / ft; returns { err } or { sups, labels, warns } */
  function check(p) {
    const f = Number.isFinite;
    if (!p || p._schema !== SCH) return { err: `wrong data type (${(p && p._schema) || 'none'}), expected ${SCH}` };
    if (!(p.schemaVersion <= 1)) return { err: `newer format (v${p.schemaVersion}) than this tool supports (v1)` };
    if (p.factored !== false) return { err: p.factored === true ? 'the reactions are factored; SubLoads needs unfactored DC1, DC2 and DW' : 'the payload does not state that the reactions are unfactored (factored:false)' };
    if (p.perGirder === false) return { err: 'the reactions are not per girder' };
    const u = p.units || {}, kf = TOKIP[String(u.force || '').trim().toLowerCase()], lf = TOFT[String(u.length || 'ft').trim().toLowerCase()];
    if (!kf) return { err: `force unit "${u.force || 'not stated'}" is not one SubLoads converts (kip, kN, lb)` };
    if (!lf) return { err: `length unit "${u.length}" is not one SubLoads converts (ft, m)` };
    if (!Array.isArray(p.supports) || !p.supports.length) return { err: 'there are no supports in the hand-off' };
    const warns = [], labels = [], sups = [];
    if (kf !== 1) warns.push(`Forces converted from ${u.force} to kip (× ${kf.toFixed(6)}).`);
    for (let i = 0; i < p.supports.length; i++) {
      const s = p.supports[i] || {}, id = String(s.id == null ? `Support ${i + 1}` : s.id), x = s.x == null ? NaN : +s.x;
      if (s.x != null && !f(x)) return { err: `support ${id}: x is not a number` };
      if (!Array.isArray(s.girders) || !s.girders.length) return { err: `support ${id}: no girders` };
      const gs = [];
      for (const g of s.girders) {
        const lab = String((g && g.label) || 'girder'), v = {};
        for (const c of ['DC1', 'DC2', 'DW']) { const n = g ? g[c] : undefined; if (typeof n !== 'number' || !f(n)) return { err: `support ${id}, ${lab}: ${c} is not a valid number` }; v[c.toLowerCase()] = n * kf; }
        if (v.dc1 < 0 || v.dc2 < 0 || v.dw < 0) warns.push(`${id}, ${lab}: a negative (uplift) dead-load reaction is included.`);
        if (labels.indexOf(lab) < 0) labels.push(lab);
        gs.push({ label: lab, position: g.position || '', ...v });
      }
      sups.push({ id, x: f(x) ? x * lf : null, girders: gs });
    }
    return { sups, labels, warns };
  }
  /* default SubLoads support for a source support id; -1 = skip */
  function defTarget(id, i, n) {
    const s = String(id), nSup = P.units.length; let m;
    if ((m = /support\s*(\d+)/i.exec(s))) { const k = +m[1] - 1; return k >= 0 && k < nSup ? k : -1; }
    if ((m = /abut\w*\.?\s*(\d+)/i.exec(s))) return +m[1] === 1 ? 0 : nSup - 1;
    if ((m = /pier\s*(\d+)/i.exec(s))) { const k = +m[1]; return k > 0 && k < nSup - 1 ? k : -1; }
    const k = P.units.findIndex(u => u.name === s); return k >= 0 ? k : (i < nSup ? i : -1);
  }
  const isJoint = k => { const G = MODEL.G; return !!(G && G.sup && G.sup[k] && G.sup[k].joint); };
  const nb = () => ((P.rx.data || [])[0] || []).length;
  function presetGirders(preset, pos, idx) {
    const n = nb(), all = [...Array(n)].map((_, j) => j), ext = n > 1 ? [0, n - 1] : [0], int = all.filter(j => j > 0 && j < n - 1);
    if (preset === 'all') return all; if (preset === 'ext') return ext; if (preset === 'int') return int.length ? int : all;
    if (preset === 'one') return idx >= 1 && idx <= n ? [idx - 1] : [];
    return pos === 'exterior' ? ext : (int.length ? int : all);   // 'pos': girders of the same position
  }
  function gList(js) { return js.length ? js.map(j => `G${j + 1}`).join(', ') : 'none'; }

  /* ---------- dialog ---------- */
  function openDialog(list, via, errs) {
    const G = MODEL.G; if (!G || G.E.length || !(P.rx.data || []).length) { flash('Fix the bridge input errors on the Summary tab first.', 'fail'); return; }
    DLG = { list, via, errs: errs || [], pi: 0 }; pickSource(0);
    let m = $('#rxh-modal'); if (!m) { m = document.createElement('div'); m.className = 'modal'; m.id = 'rxh-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); document.body.appendChild(m); }
    m.hidden = false; renderDialog();
  }
  function pickSource(pi) {
    const p = DLG.list[pi], c = check(p);
    DLG.pi = pi; DLG.p = p; DLG.c = c; DLG.gl = 0;
    if (c.err) return;
    const gl = p.girderLine || {}, g0 = c.sups[0].girders[0];
    DLG.pos = gl.position || g0.position || 'interior'; DLG.idx = +gl.beamIndex || 0;
    DLG.preset = 'pos'; DLG.gir = presetGirders('pos', DLG.pos, DLG.idx); DLG.mode = 'replace';
    DLG.map = c.sups.map((s, i) => { const k = defTarget(s.id, i, c.sups.length); return { k, side: i === 0 && c.sups.length > 1 ? 'ahead' : 'back' }; });
  }
  function plan() {   // the cells that will change: [{k, side, j, key, old, val}]
    const c = DLG.c, out = [], lab = c.labels[DLG.gl], dup = {};
    let err = '';
    c.sups.forEach((s, i) => { const t = DLG.map[i]; if (t.k < 0) return; const side = isJoint(t.k) ? t.side : 'back', tag = `${t.k}.${side}`;
      if (dup[tag]) err = `${s.id} and ${dup[tag]} both map to ${P.units[t.k].name}${isJoint(t.k) ? ` (${side} row)` : ''}. Map each to a different support or row, or skip one.`; dup[tag] = s.id;
      const g = s.girders.find(x => x.label === lab); if (!g) return;
      DLG.gir.forEach(j => ['dc1', 'dc2', 'dw'].forEach(c0 => { const key = side === 'ahead' ? c0 + 'a' : c0, row = P.rx.data[t.k][j], old = nz(row[key]);
        out.push({ k: t.k, side, j, key, c0, old, val: r3(DLG.mode === 'add' ? old + g[c0] : g[c0]), src: s.id }); })); });
    if (!err && !out.length) err = 'Nothing selected: map at least one support and pick at least one girder.';
    return { cells: out, err };
  }
  function renderDialog() {
    const m = $('#rxh-modal'), D = DLG, p = D.p, c = D.c;
    const srcSel = D.list.length > 1 ? `<h3>Source</h3>${D.list.map((q, i) => `<label style="display:flex;gap:6px;align-items:center;font-size:.9rem"><input type="radio" name="rxh-src" data-rxh="src" value="${i}"${i === D.pi ? ' checked' : ''}> ${esc(BX().describe(q))}${q.girderLine && q.girderLine.label ? `, girder ${esc(q.girderLine.label)}` : ''}</label>`).join('')}` : '';
    let h = `<div class="modal-box" style="width:min(760px,96vw)"><h2>Pull superstructure reactions</h2>${srcSel}`;
    h += `<table class="mini-t" style="margin-top:8px"><tbody><tr><td class="lbl">Producer</td><td>${esc(p.producer || '?')}${p.producerFile ? ` (${esc(p.producerFile)})` : ''}</td></tr><tr><td class="lbl">Produced</td><td>${esc(when(p.producedAt))}</td></tr><tr><td class="lbl">Project</td><td>${esc([p.project && p.project.name, p.project && p.project.bridgeId].filter(Boolean).join(', ') || '(not stated)')}</td></tr>`;
    if (!c.err) h += `<tr><td class="lbl">Girder line</td><td>${esc((p.girderLine && p.girderLine.label) || c.labels.join(', '))}${D.pos ? ` (${esc(D.pos)})` : ''}</td></tr><tr><td class="lbl">Basis</td><td>Unfactored, kip, per girder; IM ${p.imIncluded ? 'included' : 'not included'}, DF ${p.dfIncluded ? 'included' : 'not included'}</td></tr>`;
    h += `</tbody></table>`;
    if (Array.isArray(p.notes) && p.notes.length) h += `<h3>Notes from ${esc(p.producer || 'the producer')}</h3><ul style="margin:0 0 0 18px;font-size:.88rem;color:var(--text-dim)">${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
    if (D.errs.length) h += `<p style="color:var(--warn);margin-top:6px">Not usable: ${esc(D.errs.join('; '))}</p>`;
    if (c.err) { h += `<p style="color:var(--fail);margin-top:10px"><b>Refused:</b> ${esc(c.err)}. Nothing will be changed.</p><div class="modal-foot"><button type="button" class="btn" id="rxh-cancel">Close</button></div></div>`; m.innerHTML = h; return; }
    if (c.warns.length) h += `<p style="color:var(--warn);margin-top:6px">${c.warns.map(esc).join('<br>')}</p>`;
    if (c.labels.length > 1) h += `<h3>Source girder</h3><select data-rxh="gl">${c.labels.map((l, i) => `<option value="${i}"${i === D.gl ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const opt = (k, sel) => `<option value="-1"${sel < 0 ? ' selected' : ''}>(skip)</option>` + P.units.map((u, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${esc(u.name)}</option>`).join('');
    h += `<h3>Supports</h3><table class="mini-t"><thead><tr><th>From</th><th>DC1</th><th>DC2</th><th>DW</th><th>To SubLoads support</th><th>Bearing row</th></tr></thead><tbody>`;
    const lab = c.labels[D.gl];
    c.sups.forEach((s, i) => { const g = s.girders.find(x => x.label === lab), t = D.map[i];
      h += `<tr><td class="lbl">${esc(s.id)}${s.x != null ? ` <small>(x = ${f2(s.x)} ft)</small>` : ''}</td>${g ? ['dc1', 'dc2', 'dw'].map(k => `<td style="text-align:right">${f2(g[k])}</td>`).join('') : '<td colspan="3">(no value for this girder)</td>'}<td><select data-rxh="k" data-i="${i}">${opt(i, t.k)}</select></td><td>${t.k >= 0 && isJoint(t.k) ? `<select data-rxh="side" data-i="${i}"><option value="back"${t.side === 'back' ? ' selected' : ''}>back (span behind)</option><option value="ahead"${t.side === 'ahead' ? ' selected' : ''}>ahead (span ahead)</option></select>` : '<span style="color:var(--muted)">single row</span>'}</td></tr>`; });
    h += `</tbody></table>`;
    const n = nb(), presets = [['pos', `Same position as the source (${D.pos === 'exterior' ? 'exterior: G1 and G' + n : 'interior: G2 to G' + (n - 1)})`], ['all', 'All girders'], ['int', 'Interior girders only'], ['ext', 'Exterior girders only (G1, G' + n + ')']].concat(D.idx >= 1 && D.idx <= n ? [['one', `Only G${D.idx} (the source beam number)`]] : []).concat([['custom', 'Custom (tick below)']]);
    h += `<h3>Girders</h3><select data-rxh="preset">${presets.map(([v, l]) => `<option value="${v}"${v === D.preset ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:6px">${[...Array(n)].map((_, j) => `<label style="display:flex;gap:4px;align-items:center;font-size:.9rem"><input type="checkbox" data-rxh="g" value="${j}"${D.gir.indexOf(j) >= 0 ? ' checked' : ''}> G${j + 1}</label>`).join('')}</div>`;
    h += `<h3>Existing values</h3><label style="display:flex;gap:6px;align-items:center;font-size:.9rem"><input type="radio" name="rxh-mode" data-rxh="mode" value="replace"${D.mode === 'replace' ? ' checked' : ''}> Replace them</label><label style="display:flex;gap:6px;align-items:center;font-size:.9rem"><input type="radio" name="rxh-mode" data-rxh="mode" value="add"${D.mode === 'add' ? ' checked' : ''}> Add to them (for example the other span's share at a continuous pier)</label>`;
    const pl = plan();
    h += `<h3>This will overwrite</h3>`;
    if (pl.err) h += `<p style="color:var(--fail)">${esc(pl.err)}</p>`;
    else { const grp = {}; pl.cells.forEach(x => { const t = `${P.units[x.k].name}${isJoint(x.k) ? ` (${x.side} row)` : ''}, G${x.j + 1}`; (grp[t] = grp[t] || []).push(`${LBL[x.c0]} ${f2(x.old)} → ${f2(x.val)}`); });
      const ks = Object.keys(grp); h += `<div style="max-height:180px;overflow:auto;font-family:var(--mono,monospace);font-size:.8rem;border:1px solid var(--line,#ccc);border-radius:6px;padding:6px 8px">${ks.map(t => `${esc(t)}: ${esc(grp[t].join(', '))}`).join('<br>')}</div><p style="font-size:.85rem">${pl.cells.length} values (kip, unfactored) in ${ks.length} girder rows. Every other reaction is kept.</p>`; }
    h += `<div class="modal-foot"><button type="button" class="btn" id="rxh-cancel">Cancel</button><button type="button" class="btn btn-primary" id="rxh-apply"${pl.err ? ' disabled' : ''}>Apply</button></div></div>`;
    m.innerHTML = h;
  }
  function closeDialog() { const m = $('#rxh-modal'); if (m) { m.hidden = true; m.innerHTML = ''; } DLG = null; }
  function applyDialog() {
    const D = DLG, pl = plan(); if (pl.err) { flash(pl.err, 'fail'); return false; }
    pl.cells.forEach(x => { P.rx.data[x.k][x.j][x.key] = x.val; });
    const tg = {}; pl.cells.forEach(x => { const t = `${x.k}.${x.side}`; (tg[t] = tg[t] || { k: x.k, support: P.units[x.k].name, row: isJoint(x.k) ? x.side : '', from: x.src, girders: [] }); if (tg[t].girders.indexOf(x.j + 1) < 0) tg[t].girders.push(x.j + 1); });
    const p = D.p, rec = { producer: p.producer || '', producerFile: p.producerFile || '', producedAt: p.producedAt || '', project: p.project || null,
      girder: D.c.labels[D.gl], position: D.pos, mode: D.mode, via: D.via, adoptedAt: new Date().toISOString(), targets: Object.values(tg) };
    P.rxSrc = (Array.isArray(P.rxSrc) ? P.rxSrc : []).concat([rec]).slice(-20);
    if (BX()) BX().markAdopted(CH, RID, p.producedAt || '');
    closeDialog(); buildSide(); recompute(); autosave();
    flash(`Reactions from ${rec.producer} applied: ${pl.cells.length} values.`);
    return true;
  }
  function pull() {
    const r = candidates();
    if (!r.list.length) { alert(r.errs.length ? `Cannot pull the reactions: ${r.errs.join('; ')}` : 'No superstructure reactions have been sent yet. In PS-Beam or ST-Girder click "Send reactions to Substructure Loading", then pull here.'); return; }
    openDialog(r.list, 'pull', r.errs);
  }
  function importFile(file) {
    if (!BX()) return;
    BX().importFile(file, SCH, 1, r => { if (r.error) { alert(`Cannot import ${file.name}: ${r.error}`); return; } openDialog([r.payload], 'file: ' + file.name, []); });
  }

  /* ---------- source records: text used by the Reactions tab, Dead load tab and report ---------- */
  function srcText(rec, k) {
    const t = (rec.targets || []).filter(x => k == null || x.k === k);
    const where = t.map(x => `${esc(x.support)}${x.row ? ` (${esc(x.row)} row)` : ''} G${(x.girders || []).join(', G')}`).join('; ');
    return `${esc(rec.producer)}${rec.producerFile ? ` (${esc(rec.producerFile)})` : ''}, produced ${esc(when(rec.producedAt))}, girder ${esc(rec.girder)}${rec.position ? ` (${esc(rec.position)})` : ''}, ${rec.mode === 'add' ? 'added to existing values' : 'replaced'}${where ? `: ${where}` : ''}`;
  }
  const recsFor = k => (Array.isArray(P.rxSrc) ? P.rxSrc : []).filter(r => (r.targets || []).some(x => x.k === k));
  const css = document.createElement('style'); css.textContent = `.itab.bx-new::after { content: ' \\2022'; color: var(--warn); } .rxh-new { color: var(--warn); font-size: .8rem; font-weight: 600; align-self: center; }`; document.head.appendChild(css);
  const pr = paneRx; paneRx = function () {
    let h = pr(); const isNew = BX() ? BX().isNew(CH, RID) : false; let latest = null;
    if (isNew) { const r = BX().read(CH, SCH, 1); if (r.ok) latest = r.payload; }
    const btns = `<button type="button" class="btn btn-sm" id="rx-pull" title="Pull the unfactored girder-line reactions sent by PS-Beam or ST-Girder (asks first)">Pull from PS-Beam / ST-Girder</button><button type="button" class="btn btn-sm" id="rx-hf-imp" title="Import a superReactions hand-off JSON file (asks first)">Import hand-off (JSON)</button><input type="file" id="rx-hf-in" accept=".json,application/json" hidden>${isNew ? `<span class="rxh-new">New data available${latest ? `: ${esc(latest.producer || '')}, ${esc(when(latest.producedAt))}` : ''}</span>` : ''}`;
    h = h.replace('id="rx-clear">Clear all</button>', 'id="rx-clear">Clear all</button>' + btns);
    const recs = Array.isArray(P.rxSrc) ? P.rxSrc : [];
    if (recs.length) h = h.replace(/(id="rx-hf-in"[^>]*>[\s\S]*?<\/div>)/, `$1<p class="note" style="padding:6px 0 0"><b>Hand-off sources</b> (values may have been edited since):<br>${recs.map(r => srcText(r)).join('<br>')}</p>`);
    let pos = 0; (P.units || []).forEach((u, k) => { const rs = recsFor(k), tag = `<div class="sec-h">${esc(u.name)}`; let i = h.indexOf(tag, pos);
      while (i >= 0 && !/[< ]/.test(h.charAt(i + tag.length))) i = h.indexOf(tag, i + 1);   // "Pier 1" must not match "Pier 10"
      if (i < 0) return; const e = h.indexOf('</div>', i); pos = e;
      if (!rs.length) return; const r = rs[rs.length - 1], ins = ` <small title="${esc(srcText(r, k).replace(/<[^>]+>/g, ''))}">from ${esc(r.producer)}, ${esc(when(r.producedAt))}</small>`; h = h.slice(0, e) + ins + h.slice(e); pos = e + ins.length; });
    return h;
  };
  const bs = buildSide; buildSide = function () { bs(); const t = document.querySelector('.itab[data-pane="rx"]'); if (t) { const n = BX() ? BX().isNew(CH, RID) : false; t.classList.toggle('bx-new', n); t.title = n ? 'New superstructure reactions are available to pull' : ''; } };
  const dh = dlHtml; dlHtml = function () { const h = dh(), rs = recsFor(P.ui.sel); if (!rs.length) return h;
    return h.replace('Superstructure loads at the bearings</h3>', `Superstructure loads at the bearings</h3><p class="note" style="padding:0 0 6px">Reactions hand-off: ${rs.map(r => srcText(r, P.ui.sel)).join('; ')}.</p>`); };
  const be = basisExtra; basisExtra = function () { const h = be(), recs = Array.isArray(P.rxSrc) ? P.rxSrc : []; if (!recs.length) return h;
    return h.replace(/(<td class="lbl">Superstructure reactions<\/td><td>[\s\S]*?)(<\/td><\/tr>)/, `$1<br>From hand-off: ${recs.map(r => srcText(r)).join('<br>')}$2`); };
  document.addEventListener('click', e => {
    const t = e.target.closest ? e.target.closest('button, input') : null; if (!t) return;
    if (t.id === 'rx-pull') pull();
    else if (t.id === 'rx-hf-imp') { const i = $('#rx-hf-in'); if (i) i.click(); }
    else if (t.id === 'rxh-cancel') closeDialog();
    else if (t.id === 'rxh-apply') applyDialog();
    else if (t.id === 'rx-clear') { setTimeout(() => { const any = (P.rx.data || []).some(r => r.some(x => Object.keys(x).some(c => nz(x[c]) !== 0))); if (!any && P.rxSrc) { delete P.rxSrc; buildSide(); autosave(); } }, 0); }
  });
  document.addEventListener('change', e => {
    const t = e.target; if (t.id === 'rx-hf-in' && t.files && t.files[0]) { importFile(t.files[0]); t.value = ''; return; }
    if (!DLG || !t.dataset || !t.dataset.rxh) return; const D = DLG, w = t.dataset.rxh;
    if (w === 'src') pickSource(+t.value);
    else if (w === 'gl') D.gl = +t.value;
    else if (w === 'k') D.map[+t.dataset.i].k = +t.value;
    else if (w === 'side') D.map[+t.dataset.i].side = t.value;
    else if (w === 'preset') { D.preset = t.value; if (t.value !== 'custom') D.gir = presetGirders(t.value, D.pos, D.idx); }
    else if (w === 'g') { const j = +t.value; D.gir = t.checked ? [...new Set(D.gir.concat([j]))].sort((a, b) => a - b) : D.gir.filter(x => x !== j); D.preset = 'custom'; }
    else if (w === 'mode') D.mode = t.value;
    renderDialog();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && DLG) closeDialog(); });
  window.addEventListener('storage', e => { if (e.key && e.key.indexOf('bridgeSuite.v1.' + CH) === 0 && P.ui.itab === 'rx') buildSide(); else if (e.key && e.key.indexOf('bridgeSuite.v1.' + CH) === 0) { const t = document.querySelector('.itab[data-pane="rx"]'); if (t) t.classList.toggle('bx-new', BX() ? BX().isNew(CH, RID) : false); } });
  window.SubLoadsRxHandoff = { candidates, check, openDialog, applyDialog, closeDialog, plan, pull, state: () => DLG, defTarget };   // used by tests; no effect on results
})();
```
- **Saved data:** `subloads_v1` and the project file format are unchanged; `rxSrc` is a new optional top-level field. Older files open unchanged (no `rxSrc`); `openProject()` and the start-up merge keep unknown top-level fields, so the field survives Save/Open and autosave (tested).
- **Check case:** PS-Beam default project → Abut. 1 and Pier 1, G2–G4: DC1 114.785, DC2 18.000, DW 15.000 kip (hand check in the PR: DC1 = (0.825590 + 1.087500)·120/2 = 114.785).
- **How verified:** `node --check` on every plain inline script (3). jsdom end-to-end run with a shared localStorage stub: real sender buttons in psbeam/stgirder, then this pull / import / apply code; 44 checks pass, including the refusals (wrong `_schema`, `schemaVersion` 2, corrupt file, corrupt stored payload, factored payload, non-numeric DC1, unknown force unit), the kN conversion, add mode, choosing between two producers, autosave and Save/Open. With no hand-off, every tab of every unit (64 renders) and the report basis rows are byte-identical to the old file (origin/main 6761b2f). `git diff` for this file is additions only.
- **Other copies:** none (receiver code is only in this tool). BridgeXfer v1 unchanged.
- **Open items:** the dialog's "Same position as the source" default applies one designed girder line to every girder of that position; the engineer decides whether that is appropriate (exterior girders usually carry different DC2/DW).

## 2026-10-05 — PR: claude/conn-subloads-abutment (PR link added after merge)

### F7. Send abutment loads to the abutment calculator (HANDOFF.md §4.5, channel `abutmentLoads`)   [feature: hand-off (no result change)]
- **Where:** main script, directly after the "Export abutments" click handler. Anchor text: `document.addEventListener('click', e => { if (e.target.id === 'btn-abx') exportAbutments(); });`
- **Problem:** none (feature). AUDIT S12 / D8: the `subloads-abutment-v1` export had no importer.
- **Governing provision:** n/a. No formula, factor, default or unit changed. `abutExportData()` and the "Export abutments" file are unchanged.
- **What it does:** two header buttons after "Export abutments": **Send to Abutment Calculator** (`BridgeXfer.publish('abutmentLoads', …)`) and **Export hand-off (JSON)** (`BridgeXfer.exportFile`). The payload is `abutExportData()` with its top-level fields kept and the envelope added: `_schema:"bridge-abutment-loads"`, `schemaVersion:1`, `producer:"Bridge Substructure Loading"`, `producerFile`, `project:{name, bridgeId}` (the export's `project` block moves to `meta`), `units` (the export's units plus `bearingPad:"in"`, `shearModulus:"ksi"`, `unitWeight:"kcf"`, `windSpeed:"mph"`, `temperature:"degF"`, `angle:"deg"`, `elevation:"ft"`), `factored:false`, `perGirder:true`, `imIncluded:true`, `dfIncluded:true`, `multiplePresenceIncluded:true`, `basis` and `notes` (the LL basis and the sign convention in words). Abutments that could not be exported are named in `notes`.
- **Before:**
```js
document.addEventListener('click', e => { if (e.target.id === 'btn-abx') exportAbutments(); });
```
- **After:** that line, followed by:
```js
/* ---------- abutment loads hand-off (HANDOFF.md §4.5, channel abutmentLoads) ----------
   "Send to Abutment Calculator" publishes the subloads-abutment-v1 export above (abutExportData, unchanged)
   wrapped in the BridgeXfer envelope; "Export hand-off (JSON)" writes the same payload to a file.
   The "Export abutments" file is unchanged. Nothing here changes a SubLoads result. */
function abutHandoffPayload() {
  const G = MODEL.G; if (!G || G.E.length) return { err: 'Fix the input errors on the Summary tab first.' };
  if (!P.units.some(u => u.type === 'abut')) return { err: 'This bridge has no abutment units to send.' };
  let j; try { j = abutExportData(); } catch (e) { return { err: 'The abutment export failed: ' + e.message }; }
  const good = j.abutments.filter(a => !a.error);
  if (!good.length) return { err: 'No abutment could be exported: ' + j.abutments.map(a => `${a.name}: ${a.error}`).join('; ') };
  const sp = window.BridgeXfer && BridgeXfer.sharedProject ? BridgeXfer.sharedProject() : null;
  const p = Object.assign({}, j, {
    _schema: 'bridge-abutment-loads', schemaVersion: 1, producer: 'Bridge Substructure Loading', producerFile: 'Bridge Substructure Loading.html',
    project: { name: P.meta.name || '', bridgeId: (sp && sp.bridgeId) || '' }, meta: j.project,
    units: Object.assign({}, j.units, { bearingPad: 'in', shearModulus: 'ksi', unitWeight: 'kcf', windSpeed: 'mph', temperature: 'degF', angle: 'deg', elevation: 'ft' }),
    factored: false, perGirder: true, imIncluded: true, dfIncluded: true, multiplePresenceIncluded: true,
    basis: { LL: 'LL+IM bearing reactions per girder from the SubLoads lane search (all loaded lanes, IM and multiple presence included); not per lane', horizontal: 'BR, TU, CR/SH, WS, WL, FR, EQ are this abutment\'s stiffness share, split equally among the girders', signs: 'P + down; Vx + toward the span (toward the toe); Vy + left looking ahead station; y + left looking ahead station' },
    notes: [
      'Unfactored loads in kip; lengths in ft unless the field name says otherwise.',
      'LL+IM values are total bearing reactions per girder with IM and multiple presence already included (not per lane).',
      'Vx is + toward the span (toward the toe); Vy and girder offsets y are + to the left looking ahead station; P is + downward.',
      'Horizontal forces are already this abutment\'s share (stiffness distribution in SubLoads), split equally among the girders.',
      'Earth pressure, soil and backfill properties are not sent: the abutment calculator computes them.'].concat(j.abutments.filter(a => a.error).map(a => `${a.name} was not exported: ${a.error}`)) });
  return { p, n: good.length };
}
(function patchAbxHandoff() {
  const g = document.querySelector('.hdr-group'), ax = document.getElementById('btn-abx');
  if (g && ax && !document.getElementById('btn-abx-send')) {
    const mk = (id, txt, tip) => { const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn'; bt.id = id; bt.textContent = txt; bt.title = tip; return bt; };
    const s = mk('btn-abx-send', 'Send to Abutment Calculator', 'Send to other tools: publish the abutment loads (channel abutmentLoads) for "Pull from SubLoads" in the abutment design calculator');
    const x = mk('btn-abx-hf', 'Export hand-off (JSON)', 'Write the abutmentLoads hand-off to a file, for "Import hand-off (JSON)" in the abutment design calculator');
    g.insertBefore(x, ax.nextSibling); g.insertBefore(s, x);
  }
})();
document.addEventListener('click', e => {
  const id = e.target && e.target.id; if (id !== 'btn-abx-send' && id !== 'btn-abx-hf') return;
  if (!window.BridgeXfer) return flash('The hand-off helper is not available in this browser.', 'fail');
  const b = abutHandoffPayload(); if (b.err) return flash(b.err, 'fail');
  if (id === 'btn-abx-hf') { const r = BridgeXfer.exportFile('abutmentLoads', Object.assign({}, b.p, { producedAt: new Date().toISOString() })); return r.error ? flash(r.error, 'fail') : flash(`Exported the abutment loads hand-off (${b.n} abutment${b.n > 1 ? 's' : ''}).`); }
  const r = BridgeXfer.publish('abutmentLoads', b.p, 'Bridge Substructure Loading', 'Bridge Substructure Loading.html');
  if (r.error) return flash(r.error, 'fail');
  flash(`Sent ${b.n} abutment${b.n > 1 ? 's' : ''} to the abutment calculator. Open it and click "Pull from SubLoads".`);
});
```
- **Mapping:** see `fixlog/abutment_calculator.md` F12 (receiver side).
- **Check case:** default project (three spans 110/140/110 ft, 5 girders, skew 15°), Abut. 1, G1: DC1 43.6 + DC2 13.5 = 57.1 kip, DW 8.2 kip, LL+IM (concurrent) 65.95 kip; Σ over 5 girders: DC 295.7, DW 41.0, LL+IM 300.73 kip.
- **How verified:** `node --check` on every plain inline script (3). jsdom with a shared localStorage stub: "Send" writes `bridgeSuite.v1.abutmentLoads` and `.updatedAt` (= `producedAt`); "Export hand-off (JSON)" writes the same `abutments`; `abutExportData()` and the "Export abutments" file are identical to the old file (apart from the `exported` time stamp). See abutment_calculator F12 for the end-to-end run.
- **Other copies:** BridgeXfer v1 (unchanged) is in both tools. The mapping code is only in the receiver.
- **Open items:** see the PR (seismic connection force, wind per limit state, `calculatorInput.beams.mode:"positions"` vs the calculator's `"position"`).

## 2026-10-05 — PR: claude/conn-foundation-loads (PR link added after merge)

### F8. Send foundation loads (HANDOFF.md §4.6, channel `foundationLoads`)   [feature: hand-off (no result change)]
- **Where:** main script, a new IIFE just before the start-up block; anchor text `/* ---------- start ---------- */` (the new code ends immediately before it). The header button is added by the IIFE (inserted before `#btn-dxf`).
- **Problem:** none (feature).
- **Governing provision:** n/a. No formula, factor, default or unit changed. The code only calls `unitRes`, `comboComps` and `comboEval` (the functions behind the Combinations tab's concurrent design sets) and writes nothing into `P`.
- **What it does:** header **Send foundation loads** opens a dialog: unit, reference level (the unit's `Resultant` levels among top of footing / bottom of footing / base of wall / point of fixity; default bottom of footing), limit states (default all that apply to the unit), sign convention and a preview. **Send to other tools** publishes (`BridgeXfer.publish`, plus a copy at `bridgeSuite.v1.foundationLoads.by.subloads`); **Export hand-off (JSON)** writes the same payload to a file. For each limit state the cases are `comboEval(k, c, q, ±1)` for q = P, M_t, M_l at the chosen level (the concurrent set for each extreme); identical sets are merged.
- **Mapping:**

| Payload field | SubLoads (`Resultant, <level>`) |
|---|---|
| `P` (kip, + down) | Axial |
| `Vx` (normal to the bearing line, + ahead station) | V_l |
| `Vy` (along the bearing line, + left looking ahead station) | V_t |
| `Mx` (+ moves the resultant toward +y) | M_t (about the centre of the cap length; abutment: about the abutment centreline) |
| `My` (+ moves the resultant toward +x) | M_l (about CL bearing line for piers; about the footing centre at abutment footing levels) |
| `factored` | `true` for Strength I–V, Extreme Event I/II and the construction stage; `false` for Service I, IV |
| `element` | `{ type: abutment / bent (multi-column, pile) / pier (hammerhead, wall), label: unit name, unitIndex }` |
| `includes` | `footingWeight` and `soilOverFooting` true at the bottom of the footing only; `earthPressure` true for abutments |

- **Before / After** (exact). Before: `/* ---------- start ---------- */` preceded by the end of the superReactions receiver IIFE (`})();`). After — inserted between them:
```js
/* ---------- foundation loads hand-off (HANDOFF.md §4.6, channel foundationLoads) ----------
   "Send foundation loads" opens a dialog: pick the unit, the level (reference point) and the limit states.
   For each limit state the payload carries the concurrent sets of the Combinations tab (comboEval with a
   target sign: P max/min, M_t max/min, M_l max/min, duplicates merged) at the chosen resultant level.
   SubLoads M_t -> Mx, M_l -> My, V_l -> Vx, V_t -> Vy (sign convention below). "Send to other tools"
   publishes; "Export hand-off (JSON)" writes the same payload to a file. Reads results only; nothing
   here changes a SubLoads result. Uses BridgeXfer v1 (top of this file). */
(function () {
  const CH = 'foundationLoads', SCH = 'bridge-foundation-loads', SID = 'subloads';
  const LEVELS = { 'top of footing': 'topOfFooting', 'bottom of footing': 'bottomOfFooting', 'base of wall': 'baseOfWall', 'point of fixity': 'pointOfFixity' };
  const ELT = { abut: 'abutment', mcb: 'bent', pile: 'bent', ham: 'pier', wall: 'pier' };
  const r3 = v => Math.round((+v || 0) * 1000) / 1000, strip = s => String(s).replace(/<[^>]+>/g, '');
  const SIGN = 'P + = downward (compression on the foundation). Axes are local to the unit: x is horizontal and normal to the bearing line, + ahead station; y is horizontal along the bearing line, + to the left looking ahead station. Vx, Vy = horizontal force on the foundation, + toward +x, +y (SubLoads V_l = Vx, V_t = Vy). Mx = moment about the x axis, + when it moves the resultant toward +y (more compression on the +y side), so e_y = Mx/P (SubLoads M_t). My = moment about the y axis, + when it moves the resultant toward +x, so e_x = My/P (SubLoads M_l).';
  function levels(k) {
    const r = unitRes(k); if (r.err) return [];
    return r.UM.defs.map(d => d.grp === 'Resultant' && (d.label.match(/^Axial, (.+)$/) || [])[1]).filter(l => l && LEVELS[l]);
  }
  function idx(defs, lev) { const f = lab => defs.findIndex(d => d.grp === 'Resultant' && d.label === `${lab}, ${lev}`); return { P: f('Axial'), Mt: f('M<sub>t</sub>'), Ml: f('M<sub>l</sub>'), Vt: f('V<sub>t</sub>'), Vl: f('V<sub>l</sub>') }; }
  function combos(k) { return COMBOS.filter(c => { try { return !!comboComps(k, c); } catch (e) { return false; } }); }
  const isFact = c => /^Str|^EE/.test(c.id);
  const lsName = c => c.id === 'StrC' ? 'Strength I (construction stage)' : c.name;
  function defLevel(k) { const L = levels(k); return L.includes('bottom of footing') ? 'bottom of footing' : L[0] || ''; }
  /* build the payload for unit k at level lev for the limit-state ids in ids */
  function build(k, lev, ids) {
    const G = MODEL.G; if (!G || G.E.length) return { err: 'Fix the input errors on the Summary tab first.' };
    const u = P.units[k]; if (!u) return { err: 'Pick a unit.' };
    const r = unitRes(k); if (r.err) return { err: `${u.name}: ${r.err}` };
    if (!LEVELS[lev] || !levels(k).includes(lev)) return { err: `${u.name} has no resultant at "${lev}".` };
    const q = idx(r.UM.defs, lev); if (Object.values(q).some(i => i < 0)) return { err: `${u.name}: the resultant at "${lev}" is incomplete.` };
    const cs = combos(k).filter(c => ids.includes(c.id)); if (!cs.length) return { err: 'Pick at least one limit state.' };
    const cases = [];
    cs.forEach(c => {
      const mine = [];
      [['P', 'P'], ['Mt', 'Mx (M_t)'], ['Ml', 'My (M_l)']].forEach(([key, lab]) => [1, -1].forEach(s => {
        const e = comboEval(k, c, q[key], s); if (!e) return; const v = e.v;
        const vals = { P: r3(v[q.P]), Vx: r3(v[q.Vl]), Vy: r3(v[q.Vt]), Mx: r3(v[q.Mt]), My: r3(v[q.Ml]) };
        const tag = `${lab} ${s > 0 ? 'max' : 'min'}`, same = mine.find(m => ['P', 'Vx', 'Vy', 'Mx', 'My'].every(f => m[f] === vals[f]));
        if (same) { same.governs.push(tag); return; }
        mine.push(Object.assign({ limitState: lsName(c), factored: isFact(c) }, vals, { governs: [tag], combination: e.used.join(' + ') }));
      }));
      mine.forEach(m => { m.governs = m.governs.join(', '); m.name = `${lsName(c)} — ${m.governs}`; m.id = `${c.id}:${m.governs}`; cases.push(m); });
    });
    if (!cases.length) return { err: 'No combination could be evaluated for this unit.' };
    const abut = u.type === 'abut', bot = lev === 'bottom of footing';
    const point = abut ? 'footing centre (moments about the footing centre)' : 'unit centre on the bearing line (centre of the cap length; the footing centre when the footing is centred under the unit)';
    const sp = window.BridgeXfer && BridgeXfer.sharedProject ? BridgeXfer.sharedProject() : null;
    const p = {
      _schema: SCH, schemaVersion: 1, producer: 'Bridge Substructure Loading', producerFile: 'Bridge Substructure Loading.html',
      project: { name: P.meta.name || '', bridgeId: (sp && sp.bridgeId) || '' },
      units: { force: 'kip', moment: 'kip-ft', length: 'ft' },
      element: { type: ELT[u.type] || 'pier', label: u.name, unitIndex: k },
      location: `${lev}, ${point}`,
      reference: { level: LEVELS[lev], point: abut ? 'footingCentre' : 'unitCentre' },
      includes: { footingWeight: bot, soilOverFooting: bot, earthPressure: abut },
      axes: { x: 'horizontal, normal to the bearing line, + ahead station' + (abut ? (k === 0 ? ' (toward the span for this abutment)' : ' (away from the span, toward the backfill, for this abutment)') : ''), y: 'horizontal, along the bearing line, + to the left looking ahead station' },
      signConvention: SIGN,
      cases,
      notes: [
        `${u.name} (${ELT[u.type] || u.type}), ${lev}. One case per limit state and target: the concurrent set that maximises or minimises P, M_t or M_l (Combinations tab, "Concurrent design sets"); identical sets are merged and their targets listed in "governs".`,
        'Strength and Extreme Event cases are factored (factored:true). Service cases have load factors of 1.0 (factored:false).',
        'LL+IM is included where the limit state has live load (lane search, multiple presence; IM dropped for footings below ground per 3.6.2.1).',
        bot ? 'Bottom of footing: includes the footing self-weight and the soil over the footing (EV)' + (abut ? ', and the earth loads at the footing level (virtual back plane).' : '.') : 'Top of footing: excludes the footing self-weight and the soil over the footing' + (abut ? '; includes the earth loads on the stem.' : '.'),
        abut ? 'Abutment: Mx is about the abutment centreline; My is about the footing centre.' : 'Mx is about the centre of the cap length; My is about the bearing line (CL pier).',
        'Load factors are SubLoads\' (editable per limit state; AASHTO LRFD 10th Ed. Table 3.4.1-1 defaults). Each case gives every load the same factor and arrangement (a concurrent set).'] };
    return { p, n: cases.length, unit: u.name };
  }
  let DLG = null;
  function close() { const m = document.getElementById('fdx-modal'); if (m) m.remove(); DLG = null; }
  function render() {
    const d = DLG, k = d.k, L = levels(k), cs = combos(k);
    if (!L.includes(d.lev)) d.lev = defLevel(k);
    if (!d.ids) d.ids = cs.map(c => c.id);
    const b = build(k, d.lev, d.ids); d.b = b;
    let m = document.getElementById('fdx-modal'); if (!m) { m = document.createElement('div'); m.id = 'fdx-modal'; m.className = 'modal'; document.body.appendChild(m); }
    const prev = b.err ? `<p style="color:var(--fail)">${esc(b.err)}</p>` : `<div class="tscroll" style="max-height:38vh;overflow:auto"><table class="tbl"><thead><tr><th>Case</th><th>Factored</th><th class="right">P (kip)</th><th class="right">Vx</th><th class="right">Vy</th><th class="right">Mx (kip-ft)</th><th class="right">My</th></tr></thead><tbody>${b.p.cases.map(c => `<tr><td title="${esc(c.combination)}">${esc(c.name)}</td><td>${c.factored ? 'yes' : 'no'}</td><td class="val">${f1(c.P)}</td><td class="val">${f1(c.Vx)}</td><td class="val">${f1(c.Vy)}</td><td class="val">${f0(c.Mx)}</td><td class="val">${f0(c.My)}</td></tr>`).join('')}</tbody></table></div>`;
    m.innerHTML = `<div class="modal-box" role="dialog" aria-label="Send foundation loads" style="width:min(860px,96vw)"><h2>Send foundation loads</h2>
      <p>Combined loads at the bottom of a substructure unit, per limit state, for Pile Designer and Spread Footing (channel foundationLoads).</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin:8px 0"><label>Unit <select id="fdx-unit">${P.units.map((x, i) => `<option value="${i}"${i === k ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label>Reference level <select id="fdx-lev">${L.map(l => `<option value="${esc(l)}"${l === d.lev ? ' selected' : ''}>${esc(l)}</option>`).join('') || '<option value="">(none)</option>'}</select></label></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${cs.map(c => `<label><input type="checkbox" data-fdx-ls="${c.id}"${d.ids.includes(c.id) ? ' checked' : ''}> ${esc(lsName(c))}</label>`).join('')}</div>
      <p class="note" style="margin-top:6px">${esc(SIGN)}</p>
      ${b.err ? '' : `<p class="note">${esc(b.p.location)}. ${esc(b.p.notes[3])}</p>`}
      ${prev}
      <div class="modal-foot"><button type="button" class="btn" id="fdx-cancel">Cancel</button><button type="button" class="btn" id="fdx-export"${b.err ? ' disabled' : ''}>Export hand-off (JSON)</button><button type="button" class="btn btn-primary" id="fdx-send"${b.err ? ' disabled' : ''}>Send to other tools</button></div></div>`;
    m.hidden = false;
  }
  function open() {
    const G = MODEL.G; if (!G || G.E.length) return flash('Fix the input errors on the Summary tab first.', 'fail');
    if (!window.BridgeXfer) return flash('The hand-off helper is not available in this browser.', 'fail');
    const k = Math.min(Math.max(P.ui.sel || 0, 0), P.units.length - 1);
    DLG = { k, lev: defLevel(k), ids: null }; render(); return DLG;
  }
  function send(how) {
    const b = DLG && DLG.b; if (!b || b.err) return;
    if (how === 'export') { const r = BridgeXfer.exportFile(CH, Object.assign({}, b.p, { producedAt: new Date().toISOString() })); if (r.error) return flash(r.error, 'fail'); close(); return flash(`Exported ${b.n} foundation load case${b.n > 1 ? 's' : ''} (${b.unit}).`); }
    const r = BridgeXfer.publish(CH, b.p, 'Bridge Substructure Loading', 'Bridge Substructure Loading.html');
    if (r.error) return flash(r.error, 'fail');
    try { localStorage.setItem('bridgeSuite.v1.' + CH + '.by.' + SID, JSON.stringify(r.payload)); } catch (e) { }
    close(); flash(`Sent ${b.n} foundation load case${b.n > 1 ? 's' : ''} (${b.unit}). Open Pile Designer or Spread Footing and pull them.`);
  }
  (function addButton() {
    const g = document.querySelector('.hdr-group'), dx = document.getElementById('btn-dxf');
    if (g && dx && !document.getElementById('btn-fdx')) { const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn'; bt.id = 'btn-fdx'; bt.textContent = 'Send foundation loads'; bt.title = 'Send to other tools: factored and service loads at the bottom of a unit, per limit state (channel foundationLoads), for Pile Designer and Spread Footing; or export them as a hand-off JSON file'; g.insertBefore(bt, dx); }
  })();
  document.addEventListener('click', e => {
    const id = e.target && e.target.id;
    if (id === 'btn-fdx') open();
    else if (id === 'fdx-cancel') close();
    else if (id === 'fdx-send') send('send');
    else if (id === 'fdx-export') send('export');
  });
  document.addEventListener('change', e => {
    if (!DLG || !e.target) return; const t = e.target;
    if (t.id === 'fdx-unit') { DLG.k = +t.value; DLG.lev = defLevel(DLG.k); DLG.ids = null; render(); }
    else if (t.id === 'fdx-lev') { DLG.lev = t.value; render(); }
    else if (t.dataset && t.dataset.fdxLs) { const c = t.dataset.fdxLs; DLG.ids = t.checked ? DLG.ids.concat([c]) : DLG.ids.filter(x => x !== c); render(); }
  });
  window.SubLoadsFoundationHandoff = { build, levels, open, send, close, state: () => DLG };   // used by tests; no effect on results
})();
```
- **Check case:** default project, Pier 2 (hammerhead), top of footing, "Strength IV — P max, Mx (M_t) max, My (M_l) max":
  - P = 1.50 × (DC super 1094.100 + DC sub 329.121) + 1.50 × DW 145.700 = **2353.381 kip** (sent 2353.381).
  - My = TU + FR (rise) V_l × arm = 15.896 × 21.001 = **333.836 kip-ft** (sent 333.836); arm = bearing elevation 120.001 − top of footing 99.0 ft.
  - The "Strength I — P max" set equals the Combinations tab's concurrent set "Axial max" for the same location (P 2863.1, M_t 3449.7, M_l 333.8).
- **How verified:** `node --check` on every plain inline script of the four changed files (abutment 13, SubLoads 3, Pile Designer 4, Spread Footing 18 blocks; none is JSX — Pile Designer is pre-compiled `React.createElement`). End-to-end in jsdom with one shared localStorage stub (React UMD served locally): **79 of 79 assertions pass** — abutment default → Pile Designer; abutment pile branch → Pile Designer with the same pile layout; SubLoads Pier 2 top of footing → Spread Footing; SubLoads Pier 1 bottom of footing → Pile Designer (rotated axes); JSON export → import into both receivers; refusals (wrong `_schema`, `schemaVersion` 2 and 3, kN units, non-finite P, missing `factored`, corrupt JSON file, corrupt stored payload, nothing sent, service-only payload into the footing, integral-abutment mode). No-hand-off invariance against the pre-change files: abutment `computeAll()` (dashboard, every permutation table, Input ID); SubLoads `combine()` envelopes and `concurrentSets()` of every unit and `abutExportData()`; Spread Footing `computeAll()` + `computePhase2()` (by-type and Direct mode); Pile Designer `computeAll(DEFAULT_INPUTS)` and the rendered app text (identical apart from the two new buttons). The earlier e2e suites still pass on this branch: memberReactions (Steel Beam → BasePlate / Spread Footing, 56/56) and abutmentLoads (SubLoads → abutment, 57/57).
- **Other copies:** BridgeXfer v1 (unchanged). The sender code exists only here.
- **Open items:** individual footings of multi-column bents ("Footing i" groups have P and M but no shear) are not offered; service sets come from the same `comboEval` concurrency as the strength sets (the Combinations tab shows service as envelopes only).

## 2026-10-12 — PR: claude/sweep-subloads (PR link added after merge)

Open-item sweep of inventory section 19 (SUB-PEND, SUB-O1 to O4, SUB-F6, SUB-F8, SUB-USGS, SUB-XLSX). Basis: AASHTO LRFD 10th Ed. (2024). Article numbers marked "verify" were not checked against the printed 10th Ed. text.

### S1. SUB-PEND (seismic): R for pier foundations and pier bearings in Zones 2 to 4   [calc change] [more conservative; Zones 2 to 4 only; option to restore]
- **Where:**
  - `eqLoads` (≈ line 2039). Anchor text: `function eqLoads(G, k, SM`
  - new `eqCompR` and `eqFdnDef`, directly above `function phase5(k)`. Anchor text: `function eqCompR(k, zone)`
  - `phase5` (≈ line 2066). Anchor text: `const cr = eqCompR(k, SM.site.zone)`
- **Problem:** in Zones 2 to 4 every effect of a pier (columns, caps, bearings, footings) used the elastic force divided by the unit R of Table 3.10.7.1-1 (for example 5.0 for a multi-column bent). That R is too large for two kinds of output:
  - **Foundations.** Zone 2 uses R/2, not less than 1.0 (3.10.9.3). Zones 3 and 4 use R = 1.0, the modified design force of 3.10.9.4.2. 3.10.9.4.1 takes the lesser of that and the plastic hinging force of 3.10.9.4.3, which this tool does not compute, so R = 1.0 is the upper bound.
  - **Connections (bearings).** R = 0.8 (Table 3.10.7.1-2, through 3.10.7.1).

  Pier foundations and pier bearings were therefore unconservative by a factor of 2 (Zone 2 foundations) up to 6.25 (bearings of a multi-column bent). The in-file PENDING item ("Zone 2 uses elastic/R rather than the specific 3.10.9.3 provisions") recorded this.
- **Governing provision:** AASHTO LRFD 10th Ed.:
  - Art. 3.10.7.1, with Tables 3.10.7.1-1 and 3.10.7.1-2 (connections: superstructure to abutment 0.8; columns, piers or pile bents to cap beam or superstructure 0.8; columns or piers to foundations 0.8);
  - Art. 3.10.9.3 (Zone 2: foundations other than pile bents and retaining walls use R/2, not less than 1.0);
  - Art. 3.10.9.4.1 and 3.10.9.4.2 (Zones 3 and 4: modified design forces; R = 1.0 for foundations);
  - Art. 3.10.9.4.3 (plastic hinging forces, not computed).

  Verify all of these articles against the printed 10th Ed. text.
- **What changes:**
  - **Units affected:** only piers (not abutments, which already use R = 0.8 for the whole unit), only in Zones 2 to 4, and only when the new option `br.eqCompR` is blank or `'code'` (the default).
  - **Foundation effects** (`eqFdnDef`) use R_f = min(R, max(R/2, 1.0)) in Zone 2, or min(R, 1.0) in Zones 3 and 4. These effects are:
    - the "Footing i" groups;
    - every "…, bottom of footing" resultant;
    - the "…, top of footing" resultant of a multi-column bent, whose columns have their own groups.
  - **Bearings group** effects (row totals and the equal shares) use R_c = min(R, 0.8).
  - **Unit R kept:** columns, piles, pile bents ("including pile bents", 3.10.9.3), walls and caps. The top of footing of a hammerhead and the base of a wall pier also keep the unit R, because they are the column/wall base design forces. The "Send foundation loads" dialog shows a red note when Extreme Event I is sent at one of those levels.
  - **Scope:** only the EQ load vectors of `phase5` change, so the change flows to EE I in the envelopes, concurrent sets and the foundation hand-off. The "Design, long./trans." columns on the Seismic tab and the load diagrams still show the unit-R forces at the bearings, and the note says so.
- **Before:**
  ```js
  function eqLoads(G, k, SM) {   // design horizontal forces at the rows of unit k, bridge axes: zone 1 connection force, else elastic / R
  …
    return rows.map(r => { let L = Z === 1 ? (r.restrL ? r.cf * Nt(r) : 0) : r.FL / r.RL.R, T = Z === 1 ? (r.restrT ? r.cf * Nt(r) : 0) : r.FT / r.RT.R;
  ```
  and in `phase5`, after `const UMe = umEE(k, 'eq'), vL = …, vT = …; out.vL = vL; out.vT = vT;` nothing.
- **After:**
  ```js
  function eqLoads(G, k, SM, rf) {   // … ; rf (optional) maps the unit R to a component R (eqCompR)
  …
    return rows.map(r => { let L = Z === 1 ? (r.restrL ? r.cf * Nt(r) : 0) : r.FL / (rf ? rf(r.RL.R) : r.RL.R), T = Z === 1 ? (r.restrT ? r.cf * Nt(r) : 0) : r.FT / (rf ? rf(r.RT.R) : r.RT.R);
  ```
  ```js
  function eqCompR(k, zone) {
    const u = P.units[k]; if (!(zone >= 2) || !u || u.type === 'abut' || P.br.eqCompR === 'unit') return null;
    return { fdn: R => Math.min(R, zone === 2 ? Math.max(R / 2, 1) : 1), con: R => Math.min(R, 0.8) };
  }
  function eqFdnDef(u, d) { return /^Footing \d+$/.test(d.grp) || (d.grp === 'Resultant' && (/, bottom of footing$/.test(d.label) || (u.type === 'mcb' && /, top of footing$/.test(d.label)))); }
  ```
  ```js
      const cr = eqCompR(k, SM.site.zone); if (cr) {   // foundations and bearings with their own R (see eqCompR)
        const ev = rf => { const Lc = eqLoads(G, k, SM, rf), m = (fL, fT) => { const lc = { rows: S.rows.map(() => ({ Hn: 0, Ht: 0 })) }; Lc.forEach(q => { const FL = fL * q.dL, FT = fT * q.dT; lc.rows[q.ri].Hn += FL * S.c - FT * S.s; lc.rows[q.ri].Ht += FL * S.s + FT * S.c; }); return lc; }; return [UMe.evalCase(m(1, 0)), UMe.evalCase(m(0, 1))]; };
        const [fL, fT] = ev(cr.fdn), [cL, cT] = ev(cr.con), u = P.units[k];
        UMe.defs.forEach((d, q) => { if (eqFdnDef(u, d)) { vL[q] = fL[q]; vT[q] = fT[q]; } else if (d.grp === 'Bearings') { vL[q] = cL[q]; vT[q] = cT[q]; } });
        out.compR = { L: L.map(q => ({ ri: q.ri, fL: cr.fdn(q.RL.R), fT: cr.fdn(q.RT.R), cL: cr.con(q.RL.R), cT: cr.con(q.RT.R) })) }; }
  ```
- **Supporting edits (text and UI):**
  - Bridge tab, Seismic section, after `fld('γ<sub>EQ</sub> on live load', 'br.gEQ')`: the new select `fld('R for pier foundations and bearings, Zones 2 to 4', 'br.eqCompR', …)` with the options "By component (code)" (`code`, the default) and "Unit R for every effect" (`unit`). The title gives the provisions.
  - Seismic tab note (`eqHtml`): the text `Zone 2 connection forces follow 3.10.9.3.` / `Seismic Zones 3 and 4 also require capacity design …` is replaced by a sentence naming the R used for this unit's bearings and foundations, and a Zones 3/4 note that plastic hinging forces (which govern column shear) are not computed.
  - Manual "Design forces" bullet extended.
  - Report basis row "Analysis options": appends `; seismic R: pier foundations … , pier bearings 0.8 (Table 3.10.7.1-2)` (or `unit R for every effect`), only when the site is in Zone 2 to 4.
  - "Send foundation loads" dialog (`render`): the red note described above.
  - In-file PENDING list: the seismic item is reworded to the new state.
- **Saved data:** new optional field `P.br.eqCompR` (`'code'` | `'unit'`). It is not added to `defP`, so a default project saves exactly as before. Old files: a blank field means `'code'`, so **old Zone 2 to 4 projects now get the larger pier foundation and bearing forces**. Choose "Unit R for every effect" to reproduce the old numbers. No key, no hand-off key and no payload format changed. The `foundationLoads` values for EE I change, as intended.
- **Check case:** default example project (three spans 110/140/110 ft, skew 15°), site class D, PGA 0.15, S_s 0.35, S_1 0.10.
  - Site: F_v = 2.4, S_D1 = 0.240 → Zone 2.
  - Pier 1 (multi-column bent, operational class "other", R = 5.0): elastic F_L = 1086.34 kip, F_T = 655.25 kip.
  - Before: every effect uses L = 1086.34/5 = 217.27 kip and T = 655.25/5 = 131.05 kip. V_l at the bottom of footing, 100/30 case = 217.27·cos 15° + 0.3·131.05·sin 15° = 209.86 + 10.18 = **220.04 kip**.
  - After, foundations: R_f = max(5/2, 1) = 2.5 → L = 434.54, T = 262.10 → V_l,bottom of footing = **440.08 kip** (× 2.00). M_l,bottom of footing goes from 5,061 to 10,123 kip-ft.
  - After, bearings: R_c = 0.8 → L = 1357.93, T = 819.06 → H_n,row total = 1357.93·0.9659 + 0.3·819.06·0.2588 = **1375.26 kip** (was 220.04; × 6.25).
  - Pier 2 (hammerhead, single column, R = 3.0): foundations × 2.00 (R_f = 1.5); bearings × 3.75. The top of footing (the column base) is unchanged.
  - Zone 3 (PGA 0.30, S_s 0.70, S_1 0.20; S_D1 = 0.40): Pier 1 foundations × 5.00 (R_f = 1.0); Pier 2 foundations × 3.00; bearings × 6.25 / × 3.75.
  - Abutments, columns, piles, caps, and every non-EE limit state: unchanged. Zone 1 and no-ground-motion projects: unchanged.
- **How verified:** see "How verified (S1–S3)" below.
- **Other copies:** none.

### S2. SUB-O2: γSH 0.5 option no longer applied to steel pile bents; default stays 1.0   [calc change, only with the 0.5 option] [more conservative]
- **Where:** new function `gSHof(k)` directly above `function comboComps(k, c)`. Anchor text: `function gSHof(k)`. In `comboComps`, the anchor is `fix(p4.SH && sc(p4.SH,`.
- **Problem:** the γSH = 0.5 option was applied to every unit. Table 3.4.1-3 gives 0.5 (with I_g) only for substructures supporting non-segmental superstructures; "Steel Substructures" take 1.0. A steel H-pile bent therefore got half the code SH force when the option was chosen. Round piles are "pipe or concrete" in this tool, so they are treated as possibly steel.
- **Decision on the default (O2):** the default stays **1.0**. The AUDIT lists γSH among the "conservative-but-not-per-code items (each needs your sign-off)". 1.0 is conservative and is allowed with I_g. Setting 0.5 from `Ifac` automatically would lower results, so it is not done; it is listed under Needs engineer.
- **Governing provision:** AASHTO LRFD 10th Ed., Table 3.4.1-3 (CR, SH: substructures supporting non-segmental superstructures, using I_g 0.50, using I_effective 1.00; steel substructures 1.00).
- **Before:**
  ```js
  perm(DC, L.dc, 'DC'); perm(D.DW, L.dw, 'DW'); fix(p4.SH && sc(p4.SH, num(br.gSH) === 0.5 ? 0.5 : 1.0), 'SH');   // γSH, Table 3.4.1-3: 0.5 with I_g, 1.0 with I_eff
  ```
- **After:**
  ```js
  function gSHof(k) {   // γSH, Table 3.4.1-3: the 0.5 option (gross I_g) applies to concrete substructures; steel substructures take 1.0, so steel H-pile bents and round (pipe or concrete) pile bents stay at 1.0
    const u = P.units[k]; if (num(P.br.gSH) !== 0.5) return 1.0;
    return u && u.type === 'pile' && u.pile.shape !== 'square' ? 1.0 : 0.5;
  }
  …
  perm(DC, L.dc, 'DC'); perm(D.DW, L.dw, 'DW'); fix(p4.SH && sc(p4.SH, gSHof(k)), 'SH');   // γSH, Table 3.4.1-3: 0.5 with I_g, 1.0 with I_eff; steel substructures 1.0
  ```
- **Supporting edits:**
  - The option label changed from `'0.5 (substructure analysed with gross I_g)'` to `'0.5 (gross I_g; steel H-pile and round pile bents 1.0)'`.
  - The basis row now prints `γSH = 0.50 (1.00 for steel H-pile and round pile bents)` when the option is chosen.
  - New input check (in the checks list after `No ground motion entered: …`): a **warning** when γSH = 0.5 and `Ifac` < 1 ("γSH = 0.5 is for a substructure analysed with gross Ig …").
- **Check case:** default project, Pier 1 changed to a 7-pile steel H-pile bent; shrinkage + creep strain 0.0003; γSH option 0.5.
  - Unfactored SH at the bearing row: H_n = 6.834 kip.
  - Strength I H_n row total, max. Before: 13.915 + 0.5·6.834 = 17.332 kip. After: 13.915 + 1.0·6.834 = **20.749 kip**.
  - A square concrete pile bent, the multi-column bent and the hammerhead: unchanged (still 0.5). With the default (1.0): unchanged.
- **Other copies:** the superseded early `combine` versions (not used) still add SH at 1.0; not touched (O4).

### S3. SUB-F8: foundation hand-off limitations listed in the tool   [docs, no result change]
- **Where:** the final PENDING push in the open-items block. Anchor text: `['Owner requirements', 'RIDOT and CTDOT amendments are not yet selectable.']`
- **After:** one new item is added after it: `['Hand-offs', 'Send foundation loads offers the unit resultants only: the individual footings of multi-column bents ("Footing i", which have P and M but no shear) are not offered, and the Service cases use the same concurrent selection as the Strength cases.']`
- **Decision:** document (inventory default). Adding "Footing i" groups needs a shear per footing that the model does not split; do this on request.

### How verified (S1–S3)
- `node --check` on all three plain inline scripts. The tool has no JSX.
- Headless Chromium (Playwright, `/opt/pw-browsers/chromium`; three r128 / OrbitControls served locally), origin/main vs this branch. Sixteen scenarios: default; Zones 1, 2, 3 and 4; Zone 2 with the "unit R" option; Zone 2 with individual footings; Zone 2 with an H-pile Pier 1; SH strain with γSH 1.0 and 0.5 on H-pile, square-pile and round-pile bents; and γSH 0.5 with Ifac 0.5. For each unit the harness compared every `combine()` envelope, the EQ vectors, `concurrentSets()`, the foundation hand-off cases at every level, `abutExportData()`, `abutHandoffPayload()`, `JSON.stringify(P)`, the checks and `basisExtra()`. Every tab of every unit and the print report were also rendered as text in 5 scenarios.
  - Default, Zone 1, the "unit R" option, and γSH 1.0: every number is identical. The abutment exports and payloads are identical apart from the `exported` time stamp. The saved project is byte-identical.
  - Zones 2 to 4: only Pier 1 / Pier 2 Bearings, foundation resultants and Footing groups change, and only in EE I and the EQ vectors. The ratios are exactly 2.00 / 6.25 / 3.75 (Zone 2) and 5.00 / 3.00 / 6.25 / 3.75 (Zone 3), as in the check case. The H-pile Pier 1 changes only in Bearings (the piles keep R).
  - γSH 0.5: only the H-pile and round-pile Pier 1 change (SH at 1.0). The square pile bent and the other units are unchanged.
  - Text changes: only the Seismic-tab note, the Manual bullet, the open-items list, the basis row (Zone 2 to 4, or γSH 0.5) and the new warning.
- No console errors in either file. The option select was driven through the UI: changing it to "Unit R for every effect" restores the old values (Pier 1 bearing H_n 1375.26 → 220.04 kip).
- Screenshots of the Bridge tab Seismic section, the Seismic tab note and the foundation dialog note were checked.

### Closed / not changed in this sweep
- **SUB-PEND, item by item.** The source array has 23 entries. Later patches in the file already close, reword or drop most of them; the runtime list had 13 items before this PR.
  - **Already resolved in the file:**
    - soil over footings (EV), now carried;
    - the abutment reaction export (built; also the F7 hand-off);
    - pedestrian load (3.6.1.6), now with `plP`, and the export note was dropped;
    - concurrent sets, now built;
    - owner amendments (MassDOT built);
    - individual bearing shears, as equal shares;
    - pinned column base;
    - transverse loads through the deck as a beam (option);
    - wind by projected area (option);
    - per-unit friction μ;
    - static and vertical ice, as entered values;
    - Zone 1 connection force with γEQ·LL;
    - vehicle-collision direction (both offered);
    - DXF dimensions;
    - the 1.20 TU deformation column, which is reported on the Temperature tab.
  - **Decided earlier, kept as documented limitations:**
    - wind shielding and abutments not loaded by wind;
    - the 0.30 klf minimum on Strength III ("as decided");
    - thermal gradient not used (MassDOT 3.1.8.4);
    - scour entered;
    - soil over pier footings centred;
    - Service sets and cap sections as envelopes;
    - vessel amplification as a user factor.
  - **Seismic item:** partly fixed by S1, then reworded.
  - **Left as open items, needing the engineer or out of scope:** Strength II (permit vehicle), the load-factor defaults check, the remaining capacity design, vertical ground motion / multimode / Guide Spec / AASHTO-2023 data, the vessel Method II and barge-equation check, ice jams (3.9.4), MassDOT Guide-Spec seismic and the "High" SDC A provisions, and RIDOT/CTDOT.
- **SUB-O1 (Service IV wind 0.75V, γWS = 1.00):** not changed. My reading of the 8th Ed.+ framework is consistent with the code (Table 3.8.1.1.2-1 Service IV = 0.75V; Table 3.4.1-1 Service IV γWS = 1.00). It is still listed as a quick printed-text confirmation.
- **SUB-O3 (EE I γEH `gEHEQ` = 1.0):** not changed. Table 3.4.1-1 lists γp for EH in EE I, which would be 1.50/0.90 (Table 3.4.1-2) and more conservative. The abutment calculator uses the same 1.0 with "EOR confirm", and both tools should agree. Needs engineer.
- **SUB-O4 (`combine` monkey-patches):** closed, won't fix (code health only; refactoring risks results).
- **SUB-F6 (reaction pull, "same position as the source"):** not changed. The default applies one designed girder line to every girder of that position, and every overwritten cell is listed for confirmation. Needs engineer to confirm the default.
- **SUB-USGS:** not changed. The `aashto-2009` endpoints are tried in turn, and manual entry with a message is the fallback. The 2023 dataset waits for owner adoption (engineer).
- **SUB-XLSX:** not changed. SheetJS 0.18.5 is the last version on cdnjs. Note: it is used for the template download **and** for importing the user's own reaction workbook (the inventory said "export only"). The files are the engineer's own, so the risk stays low.

### Needs engineer (left as is)
1. **γSH default (O2).** Should γSH default to 0.5 when Ifac = 1.0 (gross I_g) for concrete units, per Table 3.4.1-3? Recommendation: yes for new projects only, if you accept the lower SH. The default stays at the conservative 1.0 until then.
2. **EE I EH factor (O3).** Use γp (1.50/0.90, Table 3.4.1-2) for the static EH in EE I instead of 1.0? Recommendation: γp per Table 3.4.1-1, changed in SubLoads and the abutment calculator together.
3. **Service IV wind (O1).** Confirm against the printed 10th Ed. Tables 3.8.1.1.2-1 and 3.4.1-1 that Service IV = 0.75V with γWS = 1.00. Recommendation: no change.
4. **Bearing R = 0.8 at piers (S1).** Confirm that you want the Table 3.10.7.1-2 connection R on the pier bearing forces (×6.25 for a multi-column bent with R = 5). The alternative is the plastic-hinging force of the columns (3.10.9.4.3), which the tool does not compute. Recommendation: keep 0.8.
5. **Reaction pull default (F6).** Keep "Same position as the source" as the default girder set? Recommendation: keep it; the dialog lists every cell.

### Remaining open items (recommendations)
- **Zones 3/4 column shear from plastic hinging.** Section 5 refers column shear to 3.10.9.4 (verify the 10th Ed. article). It would need column flexural overstrength, which needs reinforcement input. Recommendation: add a "column shear, R = 1.0" line for Zones 3/4 as an interim upper bound if Zones 3/4 work is expected.
- **Strength II** (owner permit vehicle), the vessel Method II, ice jams (3.9.4), vertical ground motion and multimode analysis, the Guide Specifications and the AASHTO-2023 hazard data: each needs an owner or engineer decision.
- **Foundation hand-off "Footing i" groups and service concurrency (F8):** add on request.

## 2026-10-12 — PR: claude/subloads-eeieh (PR link added after merge)

### S4. Extreme Event I static EH: γp max/min by default; fixed value kept as "agency policy" (SUB-O3)   [calc change] [MORE conservative for new projects and for files without the field]
- **Engineer's decision (2026-10-12):** use γp, and match `abutment_calculator` F25 (#147). This closes SUB-O3 and Needs-engineer item 2 of the claude/sweep-subloads entry.
- **Where:**
  - new `eqEHfixed()`, directly above `function gSHof(k)`;
  - `comboComps`, anchor `perm(ev('EH'), c.eq`;
  - new `migEHEQ(j)`, directly above `function openProject(j, file)`, and called in `openProject` and in the `start()` localStorage merge;
  - the earth-loads `defP` patch, anchor `hEQr: 0.6, gEHEQ: 1.0`;
  - the Bridge tab "Earth loads" section, anchor `fld('γ<sub>EH</sub> in Extreme Event I'`;
  - the SELECT rebuild regex in the `change` handler (adds `br\.ehEQmode$`);
  - the earth-tab note, anchor `plus wall and soil-block inertia (Extreme Event I,`;
  - the `basisExtra` "Backfill" row.
- **Problem:** EE I combined the static earth pressure EH with one fixed factor `br.gEHEQ` (default 1.0) for both max and min. Table 3.4.1-1 gives γp for EH in Extreme Event I, that is the Table 3.4.1-2 values: active 1.50 max / 0.90 min, at rest 1.35 / 0.90.
- **Governing provision:** AASHTO LRFD 10th Ed., Table 3.4.1-1 (Extreme Event I row, γp) and Table 3.4.1-2 (EH active 1.50/0.90, at rest 1.35/0.90).
- **Before:**
  ```js
  perm(ev('EH'), c.eq ? [nz(br.gEHEQ) || 1, nz(br.gEHEQ) || 1] : svc ? [1, 1] : EH, 'EH'); perm(ev('EV'), …
  ```
- **After:**
  ```js
  function eqEHfixed() { return P.br.ehEQmode === 'agency' ? (nz(P.br.gEHEQ) || 1) : null; }   // EE I γEH: null = γp max/min (Table 3.4.1-1 → 3.4.1-2); a number = the fixed "agency policy" value br.gEHEQ
  …
  perm(ev('EH'), c.eq && eqEHfixed() !== null ? [eqEHfixed(), eqEHfixed()] : svc ? [1, 1] : EH, 'EH'); perm(ev('EV'), …
  ```
  With γp, EE I uses the same `EH` pair as the Strength limit states (active or at rest by abutment; editable `br.ehMax/ehMin/ehAtMax/ehAtMin`). The permanent-load engine takes the max factor where EH increases the effect and the min factor where it reduces it.
- **Input:** "γEH in Extreme Event I" is now a select with two options:
  - "γp max/min (Table 3.4.1-1, -2)" (`br.ehEQmode = 'gp'`);
  - "Fixed value (agency policy)" (`'agency'`). The number field `br.gEHEQ` is shown only with this option.
- **Saved data (which rule applies to existing saves):**
  - The new optional field is `br.ehEQmode`. No key is renamed and no hand-off payload changes.
  - Every file saved since the earth-loads phase stores `br.gEHEQ`, because it has been in `defP` since then. That covers project files and the autosave. On Open or start-up, `migEHEQ` sets `ehEQmode = 'agency'` for these files, so they **keep their saved value (normally 1.00) and their results are unchanged**.
  - A file that has no `br.gEHEQ`, which means one saved before earth loads existed, gets `'gp'`.
  - New projects (`defP`) get `'gp'`.
  - Files saved by this version store `ehEQmode` and keep it.
  - This is the same rule as abutment_calculator F25.
- **Check case:** default example project, Abut. 1 (Rankine, active), no ground motion (EQ = 0). Extreme Event I.
  - Unfactored EH at the bottom of footing: V_l = 339.728 kip, M_l = 2264.854 kip-ft (both increase the effect at max).
  - V_l, bottom of footing, EE I. Before (γEH = 1.00): max = min = 1.00·339.728 = **339.728 kip**. After (γp): max = 1.50·339.728 = **509.592 kip**, min = 0.90·339.728 = **305.755 kip**.
  - M_l, bottom of footing, EE I = (other loads) + γEH·2264.854, with other loads = −1394.172 at max. Before: max = −1394.172 + 2264.854 = **870.682 kip-ft**. After: max = −1394.172 + 1.50·2264.854 = **2003.109 kip-ft**. The min goes from −182.001 to −182.001 − 0.10·2264.854 = **−408.486 kip-ft**.
  - Top of footing: V_l 245.454 → 368.180 / 220.908 kip; M_l 2252.309 → 2947.760 (max).
  - Abut. 2 mirrors this. Piers (no EH) and every non-EE limit state: unchanged.
  - "Fixed value (agency policy)" with 1.00 reproduces the old numbers exactly.
- **How verified:**
  - `node --check` on the three inline scripts.
  - Headless Chromium, origin/main (c378e4c) vs branch, 9 scenarios. Each compared every `combine()` envelope, the EQ vectors, the concurrent sets, the foundation hand-off cases, both abutment exports, the saved `P`, the checks and the basis rows.
    - Fresh project and fresh Zone 2: only abutment EE I resultants change (4 per abutment), as in the check case.
    - Fresh project with the agency option; an old save in localStorage (with and without Zone 2); and an old file opened with Open (Zone 2): every number is identical to main. The saved state differs only by the added `ehEQmode: 'agency'`.
    - An old file without `gEHEQ`, by Open and by localStorage: gets `'gp'`, and results equal the fresh-project case.
    - The abutment export is identical. The abutment hand-off differs only in its `exported` time stamp.
    - No console or page errors.
  - Screenshot of the Bridge tab with the select, and with the agency value field shown, checked.
- **Not changed:** the superseded early `combine` wrapper in the earth section (`const eh = c.eq ? [nz(br.gEHEQ) || 1, …`) is not used by the final engine and was left as is (O4).
- **Other copies:** `abutment_calculator.html` F25 has the same rule (separate code; no shared snippet).

## 2026-10-18 — PR: claude/subload-d11-report (PR link added after merge)

Line numbers are approximate; search for the anchor text.

### D11: calculation-sheet report in the Gusset Plate Rating / abutment calculator format (Tier 1, display only)
- **Engineer request:** AUDIT.md D11 (2026-10-14 / 2026-10-18).
- **What changes for the user:** the printout of **Print → Print** (the calculation package) changes as listed under "After". Ctrl+P without the Print button is unchanged (it prints a blank page, as on main; see Open items). On screen, only the "Worked in" lines are new (next entry). No new input, button or saved field.
- **Approach:** the package (`rptPrint`) already built its chapters from the tabs' own render functions (`summaryHtml`, `dlHtml`, … `comboHtml`, `concHtml`, `govSumHtml`), with the worked tables and equations. That is kept as it is; nothing is recomputed. The new `slReport()` runs right after `rptPrint` has built the package (before the print dialog opens) and completes it around the existing content.
- **Before (print):** a title line and a plain list of chapter names (no links, references or title block); chapters "n. Title" with unnumbered load sub-headings and cards; no result lines; no print header or footer (browser default margins).
- **After (print):**
  - **Cover:** "Bridge Substructure Loads: Calculation", the project name, spans and units, the codes (AASHTO LRFD 10th Ed. (2024), Section 3; plus MassDOT LRFD Bridge Manual Part I Ch. 3 (January 2025) when the owner is MassDOT), and a title block Project / Project No. / Calculated by / Date / Subject / Checked by / Checked date from `P.meta.name`, `num`, `by`, `date`, `chk`. The tool has no checked-date field, so it prints "—" (no field added).
  - **References** (`SL_REFS`): the AASHTO articles, tables and figures the tool cites (Section 3; Art. 4.7.4.3.2c, 4.7.4.4, 11.6.5), the MassDOT Manual sections (applied only for owner MassDOT), the USGS AASHTO-2009 service, and UF/FDOT 2010/68901 and the FHWA steel girder example ("edition: verify").
  - **Numbered contents with links:** chapters n and subsections n.k.
  - **Subsections n.k:** in each unit chapter, the load chapters (n.1 Dead load … n.12 Combinations); in Summary, Geometry and Force distribution, each card; in Governing design forces, each unit; in the Manual, each heading.
  - **Result lines** at the end of each unit chapter that prints its Combinations (`slResults`): one line per limit state, "P = max / min kip; M_t = max / min kip-ft; M_l = max / min kip-ft" at the unit's lowest resultant section (normally the bottom of footing), then a "Governing (Strength and Extreme Event)" line with the governing limit state of each extreme. The values are `combine(k)` (`C[id].max/min`, `C.env.max/min/gmx/gmn`) formatted with `fv`, exactly as the Load combinations table shows them. No PASS/FAIL: the tool makes no capacity checks. There are no lines when the Combinations tab itself shows no table (`needOK()`).
  - **Print header and footer** (`slPageCSS(true)` in `slReport`, cleared on `afterprint`): `@page` letter, margins 0.95 / 0.6 / 0.75 / 0.6 in. Top: "Project No / Description" (Description = project name), "Computed By / Checked By", "Date / Date" (checked date "—"). Bottom: "<project> (SubLoads: Bridge Substructure Loads)" and "Page X of Y".
  - Headings in the calculation-sheet style (Times; chapter titles underlined, upper case).
- **Fixed along the way (report display only):** the Concurrent design sets note says "Hover the limit state to see the loads and cases it uses." A tooltip does not print, so the report drops that sentence (screen unchanged).
- **Where (re-apply by hand):** one block inserted just before `/* ---------- start ---------- */`, from the anchor `D11 (2026-10-18): calculation-sheet report in the Gusset Plate Rating / abutment calculator format.` (with its `/* ====` line) to the end of `(function slCSS() {…})();`. It holds `SL_REFS`, `slPageCSS`, the D11 links (next entry), `slResults`, `slReport`, the wrapper `{ const rp = rptPrint; rptPrint = function () { rp(); try { slReport(); } catch (e) { console.warn('report layout', e); } }; }` and the CSS. Copy it from this version. No existing line was edited.
- **Provision:** none. No formula, factor, unit, code reference or result changed.
- **Saved data:** none. `subloads_v1`, the project JSON, `P.ui.rpt` and the `bridgeSuite.v1.*` hand-off payloads are unchanged; no new key.
- **Check case (default project, all chapters, all units):** 109 letter pages (main: 96). Contents: 1 Project and design basis; 2 Summary and input checks (2.1–2.4); 3 Governing design forces (3.1–3.4); 4 Geometry (4.1–4.6); 5 Force distribution (5.1); 6–9, one per unit (n.1–n.12). Abut. 1 result lines, e.g. "Strength I: P = 2,540.7 / 1,366.6 kip; M_t = 3,527 / -3,495 kip-ft; M_l = 4,148 / -1,248 kip-ft" and "Governing: P max 2,540.7 kip (Strength I), min 1,139.0 kip (Construction, Str. I); …". These equal the Combinations table (§6.12).

### D11 links: quoted values link to the card where they are worked (CLAUDE.md §6) (Tier 1, display only)
- **Helpers** (anchor `/* ---- D11 links (CLAUDE.md §6, 2026-10-18)`): `slTabName`, `slWk` ("Worked in: <value> → <Tab> · <card>"), `slIn` (an in-text link), `slAppend` (adds a line at the end of a card), `slGoto`, and one document click / Enter handler for `.sl-wk`. A click opens the tab, scrolls to the card and outlines it for 1.6 s.
- **Lines added** (render-function wrappers; the wrapped functions are not edited):
  1. `comboHtml`, end of "Load combinations: <unit>":
     - DC, DW → Dead load · Dead load effects;
     - EH, EV, ES, LS (abutments) or EV (piers with soil over the footing) → Earth loads;
     - LL + IM (plus PL with sidewalks over 2 ft) → Live load · Live load: <unit>;
     - BR, CE → Braking and centrifugal; WS, WL → Wind; TU, FR (plus SH) → Temperature;
     - WA, IC, EQ, CV, CT, only when the unit has them → Water and scour, Ice, Seismic, Vessel collision, Vehicle collision;
     - each of these goes to the tab's "Effects at <unit>" card.
  2. `dlHtml`, end of "Dead load effects": DC sub (self-weight by component) → Summary · Substructure self-weight.
  3. `brceHtml`, `tempHtml`, `eqHtml`: the in-text "(Force distribution tab)" becomes a link to Force distribution (text unchanged on screen).
  4. Report only: under each unit of Governing design forces, "Values (envelopes of the combination table): see §n.12".
- **In the report:** every link reads "<value>: see §n.k" (the in-text one: "Force distribution, §5.1") and is a PDF link. A target left out of the printout reads "… (not in this printout)".
- **Check case (default):**
  - "DC sub (self-weight by component): see §2.4"; "Force distribution, §5.1"; "Values …: see §6.12".
  - Abut. 1: "DC, DW: see §6.1 · EH, EV, ES, LS: see §6.2 · LL + IM: see §6.3 · BR, CE: see §6.4 · WS, WL: see §6.5 · TU, FR: see §6.6".
  - 117 internal links, none broken.
  - With water, ice and collision: Pier 1 "WA: see §7.7 · IC: see §7.8 · EQ: see §7.9 · CT: see §7.11"; Pier 2 "CV: see §8.10".

### How verified (both entries)
- `node tests/check-syntax.mjs "Bridge Substructure Loading.html"`: all scripts pass.
- `node tests/compare.mjs --tool page --file "Bridge Substructure Loading.html"`: page.text and page.storage identical, 0 console errors (three r128 and OrbitControls are in the kit).
- **Main vs branch, headless, six cases:**
  1. default;
  2. seismic (PGA 0.25, S_s 0.60, S_1 0.20, site D);
  3. water + ice and vehicle collision at Pier 1, water + barge collision at Pier 2, low seismic;
  4. MassDOT owner with a 6 ft sidewalk, γSH 0.5, at-rest Abut. 1, and title-block text with `"` and `\`;
  5. a chapter/unit subset;
  6. an input error (Fix).
  - In every case these are identical: `MODEL.C`, the force distribution, and per unit `unitRes`, `combine`, `concurrentSets`, `phase3`–`phase6` and `earthLoads`; the abutment hand-off payload (`abutHandoffPayload`, time stamp normalized); the foundation hand-off payload of every unit; localStorage.
  - Building the report changes none of them. The only change is the existing autosave of `P.ui.rpt`, the same on both sides.
  - The text of every tab of every unit differs only by the "Worked in" lines. 0 console errors.
- Every number printed in main's default package is also in the branch's (numeric-token counts of the two PDFs).
- **Headless Chromium PDF** (print media, `preferCSSPageSize`) of all six cases: no broken internal link, no leftover screen link, header and footer filled. Pages looked at:
  - the cover (default, and MassDOT with the quoted name); references and contents;
  - §1, §2.4, and §6.1 with its link;
  - §6.12 with its links and the result lines; the water case §7.12;
  - the subset contents.
- **In the app:** every link in the Combinations and Dead load tabs of Abut. 1 and Pier 1, and the Force distribution links of Braking and Temperature, were clicked (18 clicks). Each opens the right tab and card.
- **Other copies:** none (the report builder is specific to this tool).

### Open items (noticed, not changed)
- **Ctrl+P** without the Print button prints a blank page, on main and on this branch: the print CSS hides every tab panel unless the package (or the old `printReport`) marks one. Should Ctrl+P open the package dialog?
- **Concurrent design sets:** the loads and cases behind each row are only in a tooltip, so the printout does not show them (the sentence pointing to the tooltip is now dropped in print). Should they print as a column or a note?
- **Governing design forces** (§3) prints envelope values even when the Combinations tab shows "Fix the items marked Fix" (input error). Its links then point to a Combinations section without a table. Existing behaviour.
- "All units at the lowest section" can print "-0" for M_t of a symmetric unit (`f0` rounding of a tiny negative number). Cosmetic, existing.

### Needs engineer
- **Report length:** the default is 109 pages (was 96). The cover, references and contents add 3; the narrower print area adds the rest.
- **Description** in the print header is the project name (the tool has no description field). **Checked date** prints "—" (no field; none added).


## 2026-10-19 — PR: claude/stgirder-disconnect-others (STDISC: ST-Girder removed from the bridge suite on the other tools' side; engineer decision 2026-10-19; cross-tool PR with index.html, psbeam.html, lldf.html, Bridge Substructure Loading.html, tools.html, HANDOFF.md, AUDIT.md, CLAUDE.md §3; ST-Girder's side is claude/stgirder-disconnect; PR link added after merge)

### STDISC. Substructure Loading: ST-Girder no longer a reactions source   [no result change, Tier 0/1]
- **Engineer decision (2026-10-19):** ST-Girder (`stgirder.html`) is completely disconnected from every other bridge tool except GirderDetail (`Steel Bridge Beam Modules.html`): no MIDAS / MCT demands into ST-Girder, MCT's steel rating no longer uses ST-Girder's capacity (it falls back to MCT's own capacity inputs), ST-Girder removed from MCT's combined saved project, no ST-Girder links in the other tools; Substructure Loading reactions from GirderDetail are a later, separate change. CLAUDE.md §3 updated: the shared bootstrap block is now in index.html, lldf.html and psbeam.html only.
- **Changed in Bridge Substructure Loading.html (`patchRxHandoff`):** `BY = ['psbeam', 'mct']` (was with `'stgirder'`); new `isST(p)`; `candidates()` skips any payload from ST-Girder (the channel key or `superReactions.by.stgirder`) and returns them separately; `pull()` adds a short note when such a copy is stored ("A reactions hand-off from ST-Girder (sent …) is stored in this browser but is not offered. ST-Girder is no longer a source of superstructure reactions (engineer decision 2026-10-19: ST-Girder is connected to GirderDetail only)."); Import refuses a file sent by ST-Girder (nothing changed); the new-data marker (`newOK()`) ignores an ST-Girder payload; the Reactions tab shows "ST-Girder reactions in this browser are not offered" (with the note as tooltip) while an old copy is stored; the button reads "Pull from PS-Beam". Reactions already applied from ST-Girder stay in `P.rx.data` and their source records in `P.rxSrc` (saved data, unchanged).
- **Saved data:** none changed. **§4:** no formula, factor or result changed. Reactions from GirderDetail: separate, later PR (engineer decision 1).
- **How verified:** `node tests/check-syntax.mjs index.html psbeam.html lldf.html "Bridge Substructure Loading.html" tools.html` (all pass); `node tests/compare.mjs --tool page --file <each>` against main (bcbd913): psbeam, lldf, SubLoads and tools storage identical, page text differs only by the removed ST-Girder controls and the reworded ST-Girder mentions (psbeam: the "ST-Girder ↗" button; lldf: the "ST ↗" button and the self-weight notes; tools: the ST-Girder card), no console errors; index.html with a longer load timeout (scratch script): page text identical apart from the removed "🅢 Composite Steel Design App ↗" hand-off button, no console errors, the embedded-app bar lists only "PS-Beam →" / "LL & DL"; a saved ST-Girder capacity zone is replaced and the notice shown, a PS-Beam zone kept; lldf with an old ST-Girder `lldfGeom`: nothing offered; SubLoads with old ST-Girder copies: "Pull from PS-Beam" lists only PS-Beam, the short note is shown, no new-data marker for ST-Girder. ST-Girder's own checks: branch claude/stgirder-disconnect.
- **Diff (main → branch, `git diff -U0`; runs of more than 30 deleted lines and hunks that only delete are summarised by their first and last line):**
```diff
diff --git a/Bridge Substructure Loading.html b/Bridge Substructure Loading.html
index 4fe55e2..1be091f 100644
--- a/Bridge Substructure Loading.html	
+++ b/Bridge Substructure Loading.html	
@@ -3234 +3234,3 @@ async function rxImport(file) {
-   Reactions tab: "Pull from PS-Beam / ST-Girder" (with a new-data marker) and "Import hand-off (JSON)".
+   Reactions tab: "Pull from PS-Beam" (with a new-data marker) and "Import hand-off (JSON)". ST-Girder is
+   not a source since 2026-10-19 (engineer decision: it is connected to GirderDetail only; reactions from
+   GirderDetail are a later change): a payload from ST-Girder is not listed, adopted or imported.
@@ -3241 +3243,5 @@ async function rxImport(file) {
-  const BY = ['psbeam', 'stgirder', 'mct'];
+  const BY = ['psbeam', 'mct'];
+  const isST = p => !!p && (p.producer === 'ST-Girder' || p.producerFile === 'stgirder.html');
+  const ST_MSG = 'ST-Girder is no longer a source of superstructure reactions (engineer decision 2026-10-19: ST-Girder is connected to GirderDetail only).';
+  /* the latest payload on the channel is new for SubLoads, and not ST-Girder's */
+  const newOK = () => { if (!BX() || !BX().isNew(CH, RID)) return false; const r = BX().read(CH, SCH, 1); return !(r.ok && isST(r.payload)); };
@@ -3252,3 +3258,5 @@ async function rxImport(file) {
-    const out = [], seen = {}, errs = [];
-    if (!BX()) return { list: out, errs: ['The hand-off helper is not available in this browser.'] };
-    const add = (r, via) => { if (r.ok) { const p = r.payload, key = (p.producer || '') + '|' + (p.producedAt || ''); if (!seen[key]) { seen[key] = 1; out.push(p); } } else if (!r.empty) errs.push(`${via}: ${r.error}`); };
+    const out = [], seen = {}, errs = [], st = [];
+    if (!BX()) return { list: out, errs: ['The hand-off helper is not available in this browser.'], st };
+    const add = (r, via) => { if (r.ok) { const p = r.payload, key = (p.producer || '') + '|' + (p.producedAt || ''); if (seen[key]) return; seen[key] = 1;
+      if (isST(p)) { st.push(p); return; }   // ST-Girder: not offered (2026-10-19)
+      out.push(p); } else if (!r.empty) errs.push(`${via}: ${r.error}`); };
@@ -3256,0 +3265 @@ async function rxImport(file) {
+    add(BX().read(`${CH}.by.stgirder`, SCH, 1), 'old copy from ST-Girder');   // read only to say it is not offered
@@ -3258 +3267 @@ async function rxImport(file) {
-    return { list: out, errs };
+    return { list: out, errs, st };
@@ -3259,0 +3269,5 @@ async function rxImport(file) {
+  /* ST-Girder copies still stored in this browser (shown as a short note on the Reactions tab) */
+  const stOld = () => { if (!BX()) return []; const o = [], s = {};
+    [CH, `${CH}.by.stgirder`].forEach(k => { const r = BX().read(k, SCH, 1); if (r.ok && isST(r.payload) && !s[r.payload.producedAt]) { s[r.payload.producedAt] = 1; o.push(r.payload); } });
+    return o; };
+  const stNote = st => st.length ? `A reactions hand-off from ST-Girder (sent ${st.map(p => when(p.producedAt)).join(', ')}) is stored in this browser but is not offered. ${ST_MSG}` : '';
@@ -3378 +3392 @@ async function rxImport(file) {
-    if (!r.list.length) { alert(r.errs.length ? `Cannot pull the reactions: ${r.errs.join('; ')}` : 'No superstructure reactions have been sent yet. In PS-Beam or ST-Girder click "Send reactions to Substructure Loading", then pull here.'); return; }
+    if (!r.list.length) { alert((r.errs.length ? `Cannot pull the reactions: ${r.errs.join('; ')}` : 'No superstructure reactions have been sent yet. In PS-Beam click "Send reactions to Substructure Loading", then pull here.') + (r.st.length ? '\n\n' + stNote(r.st) : '')); return; }
@@ -3379,0 +3394 @@ async function rxImport(file) {
+    if (r.st.length) flash(stNote(r.st));
@@ -3383 +3398,3 @@ async function rxImport(file) {
-    BX().importFile(file, SCH, 1, r => { if (r.error) { alert(`Cannot import ${file.name}: ${r.error}`); return; } openDialog([r.payload], 'file: ' + file.name, []); });
+    BX().importFile(file, SCH, 1, r => { if (r.error) { alert(`Cannot import ${file.name}: ${r.error}`); return; }
+      if (isST(r.payload)) { alert(`Cannot import ${file.name}: it was sent by ST-Girder. ${ST_MSG} Nothing was changed.`); return; }
+      openDialog([r.payload], 'file: ' + file.name, []); });
@@ -3395 +3412 @@ async function rxImport(file) {
-    let h = pr(); const isNew = BX() ? BX().isNew(CH, RID) : false; let latest = null;
+    let h = pr(); const isNew = newOK(); let latest = null;
@@ -3397 +3414 @@ async function rxImport(file) {
-    const btns = `<button type="button" class="btn btn-sm" id="rx-pull" title="Pull the unfactored girder-line reactions sent by PS-Beam or ST-Girder (asks first)">Pull from PS-Beam / ST-Girder</button><button type="button" class="btn btn-sm" id="rx-hf-imp" title="Import a superReactions hand-off JSON file (asks first)">Import hand-off (JSON)</button><input type="file" id="rx-hf-in" accept=".json,application/json" hidden>${isNew ? `<span class="rxh-new">New data available${latest ? `: ${esc(latest.producer || '')}, ${esc(when(latest.producedAt))}` : ''}</span>` : ''}`;
+    const btns = `<button type="button" class="btn btn-sm" id="rx-pull" title="Pull the unfactored girder-line reactions sent by PS-Beam (asks first)">Pull from PS-Beam</button><button type="button" class="btn btn-sm" id="rx-hf-imp" title="Import a superReactions hand-off JSON file (asks first)">Import hand-off (JSON)</button><input type="file" id="rx-hf-in" accept=".json,application/json" hidden>${isNew ? `<span class="rxh-new">New data available${latest ? `: ${esc(latest.producer || '')}, ${esc(when(latest.producedAt))}` : ''}</span>` : ''}${stOld().length ? `<span class="rxh-new" title="${esc(stNote(stOld()))}">ST-Girder reactions in this browser are not offered</span>` : ''}`;
@@ -3407 +3424 @@ async function rxImport(file) {
-  const bs = buildSide; buildSide = function () { bs(); const t = document.querySelector('.itab[data-pane="rx"]'); if (t) { const n = BX() ? BX().isNew(CH, RID) : false; t.classList.toggle('bx-new', n); t.title = n ? 'New superstructure reactions are available to pull' : ''; } };
+  const bs = buildSide; buildSide = function () { bs(); const t = document.querySelector('.itab[data-pane="rx"]'); if (t) { const n = newOK(); t.classList.toggle('bx-new', n); t.title = n ? 'New superstructure reactions are available to pull' : ''; } };
diff --git a/tools.html b/tools.html
index e93548b..9f9a238 100644
--- a/tools.html
+++ b/tools.html
@@ -66 +66 @@ details.checks ul{margin:0;padding-left:20px}details.checks li{margin:3px 0}deta
-<a class="card" href="stgirder.html" target="_blank"><div class="name">ST-Girder</div><div class="desc">Steel plate girder design: flexure, shear, fatigue, stiffeners, studs, rating.</div><span class="tag">AASHTO LRFD Sec. 6</span></a>
+<a class="card" href="stgirder.html" target="_blank"><div class="name">ST-Girder</div><div class="desc">Steel plate girder design: flexure, shear, fatigue, stiffeners, studs, rating. Connected to GirderDetail only (demands from Steel Bridge Beam Modules); not linked to the MCT, PS-Girder, LL &amp; DL or Substructure tools.</div><span class="tag">AASHTO LRFD Sec. 6</span></a>
```

## 2026-10-19 — PR: claude/gd-superreactions (SRX: steel girder reactions for Bridge Substructure Loading from GirderDetail; engineer decision 2026-10-19; cross-tool PR with Steel Bridge Beam Modules.html, Bridge Substructure Loading.html, HANDOFF.md §4.4, AUDIT.md, tools.html, ENGINEER_CHECKS GD72; PR link added after merge)

### SRX. Reactions from GirderDetail (every girder, by number)   [RECEIVER CHANGE — PS-Beam and older payloads adopt exactly as before; §4 callout: steel reactions now from GirderDetail]
- **Engineer decision (2026-10-19):** steel girder reactions come from GirderDetail (Steel Bridge Beam Modules), replacing the ST-Girder source removed in STDISC.
- **Where (`patchRxHandoff`):** `BY` gains `'girderdetail'` (anchor `const BY = ['psbeam', 'mct', 'girderdetail'];`), so `superReactions.by.girderdetail` is listed with the others. New `ownSum` / `ownTxt` (optional `ownerRules`, validated: m, η max, η min finite and positive, else ignored). `pickSource`: `DLG.byN` when the payload has `allGirders` and G-numbered labels; then the girder preset is the new `'bynum'` (every SubLoads girder that has a source girder of the same number) and `plan()` takes, for each target girder Gj, the source girder labelled Gj (otherwise one source girder for every ticked girder, as before). Dialog: "Girder line … (every girder of the bridge)", an "Owner load rules" row (information only, not applied), a "Source girders" select (each girder to the same number / one source girder to the girders chosen below; a different girder count is warned), the source-girder select reads "Show the values of" in by-number mode. Source record `P.rxSrc[]`: optional `byNumber:true`, `ownerRules:{ owner, m, etaMax, etaMin, haunch0 }`, `girder` "G1, …, Gn, each to the girder with the same number"; `srcText` adds the owner rules when recorded. Button "Pull from PS-Beam / GirderDetail"; the "nothing sent yet" alert names GirderDetail. New: the Summary tab note under the substructure units table lists the recorded hand-off sources (wraps `summaryHtml`; also printed in the report's Summary chapter); nothing is added when no source is recorded.
- **Unchanged:** validation (`check`), unit conversion, support mapping (`defTarget`: "Abut. 1" → first unit, "Pier k" → unit k, "Abut. 2" → last unit), replace / add, ST-Girder refusal, the import path, the new-data marker, every load calculation. A payload without `allGirders` follows exactly the old path.
- **Saved data:** optional fields only (`P.rxSrc[].byNumber`, `P.rxSrc[].ownerRules`); old projects open unchanged; main reads the new records (unknown fields ignored).
- **§4 callout (steel reactions now from GirderDetail's continuous staged analysis instead of ST-Girder's copy):** no SubLoads formula or factor changes; the reactions adopted for a steel bridge change. Built-in GirderDetail project (owner MassDOT) into the SubLoads built-in bridge (same geometry, 110 / 140 / 110 ft, 5 girders at 9.5 ft), compared with what main before #309 did with the same bridge: ST-Girder at 71fbbaa fed with GirderDetail's G1 and G2 "Send to ST-Girder" payloads, its "Send reactions" for every span (the end shears of that span), pier shares added, G1 applied to G1/G5 and G2 to G2–G4 (position, the old default):

| Support, girder | Old (ST-Girder copy) DC1 / DC2 / DW | New (GirderDetail) DC1 / DC2 / DW |
|---|---|---|
| Abut. 1, G1 | 43.257 / 13.297 / 8.090 | 44.008 / 13.467 / 8.194 |
| Abut. 1, G2 | 51.592 / 9.771 / 8.093 | 52.639 / 9.896 / 8.197 |
| Abut. 1, G3 | 51.592 / 9.771 / 8.093 | 52.639 / 6.320 / 8.197 |
| Pier 1, G1 | 162.710 / 47.581 / 28.948 | 164.139 / 47.922 / 29.156 |
| Pier 1, G2 | 193.103 / 34.948 / 28.946 | 194.934 / 35.198 / 29.153 |
| Pier 1, G3 | 193.103 / 34.948 / 28.946 | 194.934 / 22.480 / 29.153 |

  Two reasons: (1) ST-Girder's copy was the element shear next to the support, without the load on the support node itself (half an element of uniform load and the end cross-frame point loads on the bearing line): e.g. G2 Abut. 1 DC1 51.592 + 2.094 klf × 0.5 ft = 52.639; Pier 1 DC2 17.412 + 17.536 = 34.948, + 0.251 = 35.198. (2) ST-Girder sent one interior girder (G2) for all interior girders; GirderDetail sends each girder, so G3 gets its own DC2 (MassDOT pile-cap distribution: 0.160 vs 0.251 klf). Governing results that change (SubLoads Summary "Governing design forces", Strength I; the others are unchanged):

| Unit, section | Old | New | Change |
|---|---|---|---|
| Abut. 1, bridge seat, P max (kip) | 960.6 | 963.6 | +0.31% |
| Abut. 1, bottom of footing, P max (kip) | 2541.8 | 2544.8 | +0.12% |
| Abut. 1, bottom of footing, M_l max / min (kip-ft) | 4149.8 / −1246.6 | 4153.6 / −1244.2 | +0.09% |
| Pier 1, bottom of footing, P max / min (kip) | 3506.6 / 1735.1 | 3504.5 / 1733.1 | −0.06% |
| Pier 2, bottom of footing, P max / min (kip) | 3358.0 / 1625.5 | 3355.9 / 1623.6 | −0.06% |
| Abut. 2, bridge seat, P max (kip) | 960.7 | 963.7 | +0.31% |
| Abut. 2, bottom of footing, M_l max / min (kip-ft) | 1441.5 / −4442.4 | 1439.1 / −4446.2 | −0.17% / +0.09% |

  At the piers the lower G3 DC2 (−12.5 kip per pier) outweighs the higher DC1 of every girder.
- **Hand check (built-in, G2 interior, Pier 1, DC2; staged model):** shear just left of the pier V_L = −17.536 kip, just right V_R = +17.412 kip (Structural analysis "Shears, unfactored", both sides of the pier), load on the pier node w·trib = 0.25053 klf × 1.0 ft = 0.251 kip: R = V_R − V_L + w·trib = 17.412 + 17.536 + 0.251 = **35.198 kip** = the sent value. Abut. 1: R = V + w·trib = 9.771 + 0.25053 × 0.5 = **9.896 kip**. Equilibrium: 2 × 9.896 + 2 × 35.198 = 90.19 kip = 0.25053 × 360 = 90.19 kip (check SA2).
- **Hand check (closed form, constant EI):** with the Structural analysis model set to "Constant EI" the same code gives DW (w = 0.2075 klf, every girder) 8.410 kip at the abutments and 28.940 kip at the piers. Three-moment equation, spans 110 / 140 / 110, symmetric: M₁(2(L₁ + L₂) + L₂) = −w(L₁³ + L₂³)/4 → M₁ = −w(1,331,000 + 2,744,000)/4/640 = −1591.8w; R₀ = wL₁/2 + M₁/L₁ = 55w − 14.471w = 40.529w = **8.410 kip**; R₁ = 180w − 40.529w = 139.471w = **28.940 kip**. The staged model (stiffer composite section over the piers) gives 8.194 / 29.156 kip, about 2.6% less at the abutments and 0.7% more at the piers.
- **How verified:** `node tests/check-syntax.mjs "Bridge Substructure Loading.html"`: all scripts pass. origin/main vs branch, headless, same seeded storage, Pull → default dialog → Apply: a real PS-Beam payload (PS-Beam's own button), a PS-Beam MIDAS-style payload (Support 2/3), an older two-girder payload on the `mct` copy, an old ST-Girder copy beside a PS-Beam payload, an ST-Girder payload on the channel key: dialog text, defaults, the cells written, `P.rx.data`, `P.rxSrc`, the Dead load tab and the report basis **identical**; the only differences are the button label and, after an adoption, the new source line on the Summary tab. ST-Girder refusal unchanged. `node tests/compare.mjs --tool page --file "Bridge Substructure Loading.html"` (see the PR). End to end with GirderDetail: Send → Pull → Apply, 60 / 60 values equal to the payload, the source on the Reactions tab, the Summary tab and the report basis, no console errors.
- **Other copies:** none (the receiver code exists only here). Sender: `fixlog/Steel Bridge Beam Modules.md` SRX.
- **Open items:** ENGINEER_CHECKS GD72 (utilities not carried; owner rules not applied; by-number default).

Diff (`Bridge Substructure Loading.html`, `git diff -U0`):

```diff
diff --git a/Bridge Substructure Loading.html b/Bridge Substructure Loading.html
index 1be091f..06e7a50 100644
--- a/Bridge Substructure Loading.html	
+++ b/Bridge Substructure Loading.html	
@@ -3234,3 +3234,5 @@ async function rxImport(file) {
-   Reactions tab: "Pull from PS-Beam" (with a new-data marker) and "Import hand-off (JSON)". ST-Girder is
-   not a source since 2026-10-19 (engineer decision: it is connected to GirderDetail only; reactions from
-   GirderDetail are a later change): a payload from ST-Girder is not listed, adopted or imported.
+   Reactions tab: "Pull from PS-Beam / GirderDetail" (with a new-data marker) and "Import hand-off (JSON)". ST-Girder is
+   not a source since 2026-10-19 (engineer decision: it is connected to GirderDetail only): a payload from ST-Girder is
+   not listed, adopted or imported. GirderDetail (Steel Bridge Beam Modules) sends every girder of the bridge
+   (optional field allGirders, SRX 2026-10-19): by default each source girder Gi goes to SubLoads girder Gi; its
+   optional ownerRules are shown and recorded for information, never applied (SubLoads uses its own load factors).
@@ -3243 +3245 @@ async function rxImport(file) {
-  const BY = ['psbeam', 'mct'];
+  const BY = ['psbeam', 'mct', 'girderdetail'];
@@ -3254,0 +3257,5 @@ async function rxImport(file) {
+  /* SRX (2026-10-19): optional ownerRules (GirderDetail): a short summary for display and the source record, or null when absent or not valid */
+  const ownSum = p => { const o = p && p.ownerRules; if (!o || typeof o !== 'object') return null; const m = o.llMultiplier && +o.llMultiplier.m, e = o.eta || {};
+    const pos = v => typeof v === 'number' && Number.isFinite(v) && v > 0; if (!pos(m) || !pos(+e.max) || !pos(+e.min)) return null;
+    return { owner: String(o.owner || ''), m, etaMax: +e.max, etaMin: +e.min, haunch0: o.haunchInProperties === false }; };
+  const ownTxt = o => `${o.owner || 'owner'}: design load multiplier m = ${o.m} on HL-93 LL+IM, load modifier η = ${o.etaMax} (max) / ${o.etaMin} (min factors)${o.haunch0 ? ', haunch 0 in composite section properties' : ''}`;
@@ -3316,0 +3324 @@ async function rxImport(file) {
+    if (preset === 'bynum') return all.filter(j => DLG && DLG.c && DLG.c.labels && DLG.c.labels.indexOf(`G${j + 1}`) >= 0);   // SRX: girders with a source of the same number
@@ -3334,0 +3343,3 @@ async function rxImport(file) {
+    // SRX (2026-10-19): a whole-bridge payload (allGirders, labels G1…Gn) goes by girder number by default
+    DLG.byN = !!p.allGirders && c.labels.length > 1 && c.labels.every(l => /^G\d+$/.test(l));
+    if (DLG.byN) { DLG.preset = 'bynum'; DLG.gir = presetGirders('bynum'); }
@@ -3342,3 +3353,4 @@ async function rxImport(file) {
-      const g = s.girders.find(x => x.label === lab); if (!g) return;
-      DLG.gir.forEach(j => ['dc1', 'dc2', 'dw'].forEach(c0 => { const key = side === 'ahead' ? c0 + 'a' : c0, row = P.rx.data[t.k][j], old = nz(row[key]);
-        out.push({ k: t.k, side, j, key, c0, old, val: r3(DLG.mode === 'add' ? old + g[c0] : g[c0]), src: s.id }); })); });
+      const g0 = s.girders.find(x => x.label === lab); if (!g0 && !DLG.byN) return;
+      DLG.gir.forEach(j => { const g = DLG.byN ? s.girders.find(x => x.label === `G${j + 1}`) : g0; if (!g) return;   // SRX: by number, Gi to Gi
+        ['dc1', 'dc2', 'dw'].forEach(c0 => { const key = side === 'ahead' ? c0 + 'a' : c0, row = P.rx.data[t.k][j], old = nz(row[key]);
+        out.push({ k: t.k, side, j, key, c0, old, val: r3(DLG.mode === 'add' ? old + g[c0] : g[c0]), src: s.id }); }); }); });
@@ -3353 +3365,2 @@ async function rxImport(file) {
-    if (!c.err) h += `<tr><td class="lbl">Girder line</td><td>${esc((p.girderLine && p.girderLine.label) || c.labels.join(', '))}${D.pos ? ` (${esc(D.pos)})` : ''}</td></tr><tr><td class="lbl">Basis</td><td>Unfactored, kip, per girder; IM ${p.imIncluded ? 'included' : 'not included'}, DF ${p.dfIncluded ? 'included' : 'not included'}</td></tr>`;
+    if (!c.err) h += `<tr><td class="lbl">Girder line</td><td>${esc((p.girderLine && p.girderLine.label) || c.labels.join(', '))}${p.allGirders && c.labels.length > 1 ? ' (every girder of the bridge)' : D.pos ? ` (${esc(D.pos)})` : ''}</td></tr><tr><td class="lbl">Basis</td><td>Unfactored, kip, per girder; IM ${p.imIncluded ? 'included' : 'not included'}, DF ${p.dfIncluded ? 'included' : 'not included'}</td></tr>`;
+    if (!c.err && ownSum(p)) h += `<tr><td class="lbl">Owner load rules</td><td>${esc(ownTxt(ownSum(p)))}. Information only: not in these unfactored reactions and not applied here; SubLoads applies its own load factors (Combinations tab).</td></tr>`;
@@ -3359 +3372,3 @@ async function rxImport(file) {
-    if (c.labels.length > 1) h += `<h3>Source girder</h3><select data-rxh="gl">${c.labels.map((l, i) => `<option value="${i}"${i === D.gl ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
+    if (p.allGirders && c.labels.length > 1 && c.labels.every(l => /^G\d+$/.test(l))) {   // SRX: whole-bridge payload
+      const n0 = nb(); h += `<h3>Source girders</h3><select data-rxh="byn"><option value="1"${D.byN ? ' selected' : ''}>Each girder to the girder with the same number (G1 → G1, G2 → G2, …)</option><option value="0"${D.byN ? '' : ' selected'}>One source girder to the girders chosen below</option></select>${c.labels.length !== n0 ? `<p style="color:var(--warn);margin-top:6px">${esc(p.producer || 'The producer')} sent ${c.labels.length} girders; this bridge has ${n0}. By number, girders without a source of the same number are not changed.</p>` : ''}`; }
+    if (c.labels.length > 1) h += `<h3>${D.byN ? 'Show the values of' : 'Source girder'}</h3><select data-rxh="gl">${c.labels.map((l, i) => `<option value="${i}"${i === D.gl ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
@@ -3366 +3381 @@ async function rxImport(file) {
-    const n = nb(), presets = [['pos', `Same position as the source (${D.pos === 'exterior' ? 'exterior: G1 and G' + n : 'interior: G2 to G' + (n - 1)})`], ['all', 'All girders'], ['int', 'Interior girders only'], ['ext', 'Exterior girders only (G1, G' + n + ')']].concat(D.idx >= 1 && D.idx <= n ? [['one', `Only G${D.idx} (the source beam number)`]] : []).concat([['custom', 'Custom (tick below)']]);
+    const n = nb(), presets = (D.byN ? [['bynum', 'Every girder with a source of the same number']] : []).concat([['pos', `Same position as the source (${D.pos === 'exterior' ? 'exterior: G1 and G' + n : 'interior: G2 to G' + (n - 1)})`], ['all', 'All girders'], ['int', 'Interior girders only'], ['ext', 'Exterior girders only (G1, G' + n + ')']].concat(D.idx >= 1 && D.idx <= n ? [['one', `Only G${D.idx} (the source beam number)`]] : []).concat([['custom', 'Custom (tick below)']]));
@@ -3383,0 +3399,2 @@ async function rxImport(file) {
+    if (D.byN) { rec.girder = `${D.c.labels.join(', ')}, each to the girder with the same number`; rec.position = ''; rec.byNumber = true; }   // SRX (optional fields)
+    const os = ownSum(p); if (os) rec.ownerRules = os;   // SRX: recorded for information only
@@ -3392 +3409 @@ async function rxImport(file) {
-    if (!r.list.length) { alert((r.errs.length ? `Cannot pull the reactions: ${r.errs.join('; ')}` : 'No superstructure reactions have been sent yet. In PS-Beam click "Send reactions to Substructure Loading", then pull here.') + (r.st.length ? '\n\n' + stNote(r.st) : '')); return; }
+    if (!r.list.length) { alert((r.errs.length ? `Cannot pull the reactions: ${r.errs.join('; ')}` : 'No superstructure reactions have been sent yet. In PS-Beam, or in GirderDetail (Steel Bridge Beam Modules, Structural analysis), click "Send reactions to Substructure Loading", then pull here.') + (r.st.length ? '\n\n' + stNote(r.st) : '')); return; }
@@ -3407 +3424 @@ async function rxImport(file) {
-    return `${esc(rec.producer)}${rec.producerFile ? ` (${esc(rec.producerFile)})` : ''}, produced ${esc(when(rec.producedAt))}, girder ${esc(rec.girder)}${rec.position ? ` (${esc(rec.position)})` : ''}, ${rec.mode === 'add' ? 'added to existing values' : 'replaced'}${where ? `: ${where}` : ''}`;
+    return `${esc(rec.producer)}${rec.producerFile ? ` (${esc(rec.producerFile)})` : ''}, produced ${esc(when(rec.producedAt))}, girder ${esc(rec.girder)}${rec.position ? ` (${esc(rec.position)})` : ''}, ${rec.mode === 'add' ? 'added to existing values' : 'replaced'}${where ? `: ${where}` : ''}${rec.ownerRules ? `; owner load rules ${esc(ownTxt(rec.ownerRules))} (information only, not applied here)` : ''}`;
@@ -3414 +3431 @@ async function rxImport(file) {
-    const btns = `<button type="button" class="btn btn-sm" id="rx-pull" title="Pull the unfactored girder-line reactions sent by PS-Beam (asks first)">Pull from PS-Beam</button><button type="button" class="btn btn-sm" id="rx-hf-imp" title="Import a superReactions hand-off JSON file (asks first)">Import hand-off (JSON)</button><input type="file" id="rx-hf-in" accept=".json,application/json" hidden>${isNew ? `<span class="rxh-new">New data available${latest ? `: ${esc(latest.producer || '')}, ${esc(when(latest.producedAt))}` : ''}</span>` : ''}${stOld().length ? `<span class="rxh-new" title="${esc(stNote(stOld()))}">ST-Girder reactions in this browser are not offered</span>` : ''}`;
+    const btns = `<button type="button" class="btn btn-sm" id="rx-pull" title="Pull the unfactored girder reactions sent by PS-Beam (one girder line) or GirderDetail (every girder) (asks first)">Pull from PS-Beam / GirderDetail</button><button type="button" class="btn btn-sm" id="rx-hf-imp" title="Import a superReactions hand-off JSON file (asks first)">Import hand-off (JSON)</button><input type="file" id="rx-hf-in" accept=".json,application/json" hidden>${isNew ? `<span class="rxh-new">New data available${latest ? `: ${esc(latest.producer || '')}, ${esc(when(latest.producedAt))}` : ''}</span>` : ''}${stOld().length ? `<span class="rxh-new" title="${esc(stNote(stOld()))}">ST-Girder reactions in this browser are not offered</span>` : ''}`;
@@ -3424,0 +3442,3 @@ async function rxImport(file) {
+  /* SRX (2026-10-19): the Summary tab (and the report's Summary chapter) names the hand-off sources under the units table; nothing when none is recorded */
+  const sh = summaryHtml; summaryHtml = function () { const h = sh(), recs = Array.isArray(P.rxSrc) ? P.rxSrc : []; if (!recs.length) return h;
+    return h.replace('DC and DW are the superstructure reactions summed over the girders (kip, unfactored).', `DC and DW are the superstructure reactions summed over the girders (kip, unfactored). Reactions hand-off (values may have been edited since; see the Reactions tab): ${recs.map(r => srcText(r)).join('; ')}.`); };
@@ -3441,0 +3462 @@ async function rxImport(file) {
+    else if (w === 'byn') { D.byN = t.value === '1'; D.preset = D.byN ? 'bynum' : 'pos'; D.gir = presetGirders(D.preset, D.pos, D.idx); }   // SRX
```

## 2026-10-19 — PR: claude/gd-superreactions-util (SRXU: MassDOT utilities carried from GirderDetail into Bridge Substructure Loading; engineer decision GD72a 2026-10-19; cross-tool PR with Steel Bridge Beam Modules.html, Bridge Substructure Loading.html, HANDOFF.md §4.4, AUDIT.md, ENGINEER_CHECKS GD72 closed; PR link added after merge)

### SRXU. MassDOT utilities from GirderDetail adopted as loads   [RESULT CHANGE for payloads with UT / UF — §4 callout; every other payload unchanged]
- **Engineer decision GD72a (2026-10-19):** UT as DW; UF as DC with 1.25 / 0 if representable, else as DC; shown as their own rows; if they cannot stay separate without a structural change, add them to DW / DC with a visible breakdown.
- **What was possible:** the combination code has DC (superstructure + substructure) and DW as its only permanent loads, with the factor pairs repeated in the Strength / Extreme / Service engines (several `pf(…, g, hi)` blocks and the combination patches). A separate UF load with 1.25 / 0 would be a structural change to every engine, so: the values are **stored and shown separately** (own keys, own table), and in the analysis UT is **added to DW** and UF **to DC2** (DC superstructure) at the bearings, with the breakdown stated on the Dead load tab and in the report. UF therefore takes the DC factors 1.25 max / **0.90 min** and Service 1.0 (GirderDetail: 1.25 / 0, Service 0 where it relieves): in minimum cases 0.90 UF is counted (less conservative there; 31.7 kip of P min at Pier 1 in the check case).
- **Where (`patchRxHandoff`):** `check()` reads optional `UT` / `UF` (finite, converted to kip) and returns `hasU`; `plan()` adds the cells `ut`, `uf` (`uta`, `ufa` on an ahead row; 0 where the source girder has none) only when `hasU`; the dialog shows UT / UF columns and a note; the source record gets `utilities:{ ut, uf }` and `srcText` states them. New block (anchor `/* ---------- SRXU (engineer decision 2026-10-19, GD72a)`): `utilTables` (table "MassDOT utilities from GirderDetail" under each support with the keys, editable inputs `rx.data.k.j.ut|uf|uta|ufa`, totals), a wrapper of `dlUnit` (UT added to `dw`, UF to `dc2`, then DC super and DW re-evaluated; returns the original result untouched when the support has no nonzero utility), a wrapper of `rxTotals` (Summary DC / DW include them), Dead load tab and report-basis breakdown text (`utTxt`), and a paste handler for the utilities table (the general one knows DC1, DC2, DW only).
- **Saved data:** new optional keys in `P.rx.data` rows (`ut`, `uf`, `uta`, `ufa`) and `P.rxSrc[].utilities`; additive. Old projects: unchanged. A project with them opened by main: the keys are ignored (the utilities are not carried there).
- **Check case (MassDOT util case, `tests/projects/gd/util.json`, owner MassDOT; GirderDetail payload pulled into the SubLoads built-in bridge with the defaults; before = main, which ignores the fields; after = this branch):**
  - Sent (kip, unfactored): G2 and G3 each UT 5.846 at each abutment and 21.154 at each pier, UF 4.872 / 17.628; G1, G4, G5 none. Sum check UT per girder: 2 × 5.85 + 2 × 21.15 = 54.0 = 0.150 klf × 360 ft; UF: 2 × 4.87 + 2 × 17.63 = 45.0 = 0.125 × 360. Both girders: UT 108.0, UF 90.0 kip (the source record).
  - Superstructure totals (sum of girders, Summary units table): Abut. 1 DC 299.0 → 308.7, DW 41.0 → 52.7; Pier 1 DC 1101.8 → 1137.1, DW 145.8 → 188.1 (Pier 1: UF 35.26, UT 42.31).
  - Governing results that change (Summary "Governing design forces"; Strength I unless noted):

| Unit, section, effect | Before | After |
|---|---|---|
| Abut. 1, bridge seat, P max (kip) | 963.6 | 993.3 |
| Abut. 1, bridge seat, M_t max / min (kip-ft) | 4173.9 / −4171.8 | 4320.1 / −4091.3 |
| Abut. 1, bottom of footing, P max (kip) | 2544.8 | 2574.5 |
| Abut. 1, bottom of footing, M_l max / min (kip-ft) | 4153.6 / −1244.2 | 4190.7 / −1223.7 |
| Pier 1, top of footing, P max / min (Str. III) (kip) | 2703.3 / 1149.3 | 2810.9 / 1208.5 |
| Pier 1, bottom of footing, P max / min (Str. III) (kip) | 3504.5 / 1733.1 | 3612.1 / 1792.3 |
| Pier 1, bottom of footing, M_t max / min (kip-ft) | 7429.5 / −7337.3 | 7958.3 / −7046.1 |
| Pier 1, bottom of footing, P Service I max (kip) | 2556.7 | 2634.3 |
| Pier 2, bottom of footing, P max / min (kip) | 3355.9 / 1623.6 | 3463.5 / 1682.8 |
| Abut. 2, bottom of footing, M_l max / min (kip-ft) | 1439.1 / −4446.2 | 1418.6 / −4483.3 |

  (Every resultant at the bridge seat, top and bottom of footing of every unit changes the same way; the full list is in the PR.) M_t grows because the utilities sit on G2 and G3, left of the bridge centerline.
  - **Hand check:** Abut. 1 bridge seat P max = previous + 1.50 × UT + 1.25 × UF = 963.6 + 1.50 × 11.69 + 1.25 × 9.74 = 963.6 + 17.54 + 12.18 = **993.3 kip** ✓. Pier 1 bottom of footing P max = 3504.5 + 1.50 × 42.31 + 1.25 × 35.26 = 3504.5 + 63.46 + 44.07 = **3612.0** (tool 3612.1, rounding) ✓. P min (Strength III, minimum factors) = 1733.1 + 0.65 × 42.31 + 0.90 × 35.26 = 1733.1 + 27.50 + 31.73 = **1792.3** ✓; with GirderDetail's 0 on UF it would be 1760.6 (the 31.7 kip counted in the minimum is the documented approximation). Service I = 2556.7 + 42.31 + 35.26 = **2634.3** ✓.
- **How verified:** `node tests/check-syntax.mjs "Bridge Substructure Loading.html"`: pass. origin/main (with SRX) vs branch, headless, Pull → defaults → Apply, then every text and value: real PS-Beam payload, PS-Beam MIDAS-style, older two-girder (`mct` copy), old ST-Girder copy beside PS-Beam, ST-Girder on the channel key, GirderDetail built-in (no utilities): **identical** in all six (dialog text, cells, `P.rx.data`, `P.rxSrc`, Summary, report basis, Dead load tab). `node tests/compare.mjs --tool page --file "Bridge Substructure Loading.html"`: identical. Util case: the before / after above (main vs branch, same payload); the utilities table, the Dead load breakdown and the report basis checked on screen (screenshots in the PR); 100 cells applied.
- **Other copies:** none. Sender: `fixlog/Steel Bridge Beam Modules.md` SRXU.
- **Open items:** none (GD72 closed). Noted: the Excel template / import (DC1, DC2, DW) does not include the utility columns.

Diff (`Bridge Substructure Loading.html`, `git diff -U0`):

```diff
diff --git a/Bridge Substructure Loading.html b/Bridge Substructure Loading.html
index 06e7a50..8a2a0af 100644
--- a/Bridge Substructure Loading.html	
+++ b/Bridge Substructure Loading.html	
@@ -3252 +3252 @@ async function rxImport(file) {
-  const LBL = { dc1: 'DC1', dc2: 'DC2', dw: 'DW' };
+  const LBL = { dc1: 'DC1', dc2: 'DC2', dw: 'DW', ut: 'UT', uf: 'UF' };
@@ -3292 +3292 @@ async function rxImport(file) {
-    const warns = [], labels = [], sups = [];
+    const warns = [], labels = [], sups = []; let hasU = false;
@@ -3302,0 +3303,2 @@ async function rxImport(file) {
+        for (const c of ['UT', 'UF']) { if (!g || g[c] == null) continue; const n = g[c];   // SRXU (2026-10-19): optional MassDOT utilities (GirderDetail)
+          if (typeof n !== 'number' || !f(n)) return { err: `support ${id}, ${lab}: ${c} is not a valid number` }; v[c.toLowerCase()] = n * kf; hasU = true; }
@@ -3308 +3310 @@ async function rxImport(file) {
-    return { sups, labels, warns };
+    return { sups, labels, warns, hasU };
@@ -3355,2 +3357,2 @@ async function rxImport(file) {
-        ['dc1', 'dc2', 'dw'].forEach(c0 => { const key = side === 'ahead' ? c0 + 'a' : c0, row = P.rx.data[t.k][j], old = nz(row[key]);
-        out.push({ k: t.k, side, j, key, c0, old, val: r3(DLG.mode === 'add' ? old + g[c0] : g[c0]), src: s.id }); }); }); });
+        (DLG.c.hasU ? ['dc1', 'dc2', 'dw', 'ut', 'uf'] : ['dc1', 'dc2', 'dw']).forEach(c0 => { const key = side === 'ahead' ? c0 + 'a' : c0, row = P.rx.data[t.k][j], old = nz(row[key]), gv = g[c0] || 0;   // SRXU: UT / UF (0 where the girder has none)
+        out.push({ k: t.k, side, j, key, c0, old, val: r3(DLG.mode === 'add' ? old + gv : gv), src: s.id }); }); }); });
@@ -3376 +3378,3 @@ async function rxImport(file) {
-    h += `<h3>Supports</h3><table class="mini-t"><thead><tr><th>From</th><th>DC1</th><th>DC2</th><th>DW</th><th>To SubLoads support</th><th>Bearing row</th></tr></thead><tbody>`;
+    const hu = !!c.hasU, uk = hu ? ['dc1', 'dc2', 'dw', 'ut', 'uf'] : ['dc1', 'dc2', 'dw'];   // SRXU
+    if (hu) h += `<p style="margin-top:6px"><b>MassDOT utilities from GirderDetail</b> are adopted as their own values (Reactions tab, under each support): UT (existing utilities) is carried as DW and UF (future utility allowance) as DC in the load cases; see the Dead load tab.</p>`;
+    h += `<h3>Supports</h3><table class="mini-t"><thead><tr><th>From</th><th>DC1</th><th>DC2</th><th>DW</th>${hu ? '<th>UT</th><th>UF</th>' : ''}<th>To SubLoads support</th><th>Bearing row</th></tr></thead><tbody>`;
@@ -3379 +3383 @@ async function rxImport(file) {
-      h += `<tr><td class="lbl">${esc(s.id)}${s.x != null ? ` <small>(x = ${f2(s.x)} ft)</small>` : ''}</td>${g ? ['dc1', 'dc2', 'dw'].map(k => `<td style="text-align:right">${f2(g[k])}</td>`).join('') : '<td colspan="3">(no value for this girder)</td>'}<td><select data-rxh="k" data-i="${i}">${opt(i, t.k)}</select></td><td>${t.k >= 0 && isJoint(t.k) ? `<select data-rxh="side" data-i="${i}"><option value="back"${t.side === 'back' ? ' selected' : ''}>back (span behind)</option><option value="ahead"${t.side === 'ahead' ? ' selected' : ''}>ahead (span ahead)</option></select>` : '<span style="color:var(--muted)">single row</span>'}</td></tr>`; });
+      h += `<tr><td class="lbl">${esc(s.id)}${s.x != null ? ` <small>(x = ${f2(s.x)} ft)</small>` : ''}</td>${g ? uk.map(k => `<td style="text-align:right">${f2(g[k] || 0)}</td>`).join('') : `<td colspan="${uk.length}">(no value for this girder)</td>`}<td><select data-rxh="k" data-i="${i}">${opt(i, t.k)}</select></td><td>${t.k >= 0 && isJoint(t.k) ? `<select data-rxh="side" data-i="${i}"><option value="back"${t.side === 'back' ? ' selected' : ''}>back (span behind)</option><option value="ahead"${t.side === 'ahead' ? ' selected' : ''}>ahead (span ahead)</option></select>` : '<span style="color:var(--muted)">single row</span>'}</td></tr>`; });
@@ -3400,0 +3405 @@ async function rxImport(file) {
+    if (D.c.hasU) rec.utilities = { ut: r3(pl.cells.filter(x => x.c0 === 'ut').reduce((a, x) => a + x.val, 0)), uf: r3(pl.cells.filter(x => x.c0 === 'uf').reduce((a, x) => a + x.val, 0)) };   // SRXU (optional)
@@ -3424 +3429 @@ async function rxImport(file) {
-    return `${esc(rec.producer)}${rec.producerFile ? ` (${esc(rec.producerFile)})` : ''}, produced ${esc(when(rec.producedAt))}, girder ${esc(rec.girder)}${rec.position ? ` (${esc(rec.position)})` : ''}, ${rec.mode === 'add' ? 'added to existing values' : 'replaced'}${where ? `: ${where}` : ''}${rec.ownerRules ? `; owner load rules ${esc(ownTxt(rec.ownerRules))} (information only, not applied here)` : ''}`;
+    return `${esc(rec.producer)}${rec.producerFile ? ` (${esc(rec.producerFile)})` : ''}, produced ${esc(when(rec.producedAt))}, girder ${esc(rec.girder)}${rec.position ? ` (${esc(rec.position)})` : ''}, ${rec.mode === 'add' ? 'added to existing values' : 'replaced'}${where ? `: ${where}` : ''}${rec.utilities ? `; MassDOT utilities from GirderDetail: UT ${f2(rec.utilities.ut)} kip (carried as DW), UF ${f2(rec.utilities.uf)} kip (carried as DC), as adopted` : ''}${rec.ownerRules ? `; owner load rules ${esc(ownTxt(rec.ownerRules))} (information only, not applied here)` : ''}`;
@@ -3439 +3444 @@ async function rxImport(file) {
-    return h;
+    return utilTables(h);
@@ -3440,0 +3446,34 @@ async function rxImport(file) {
+  /* ---------- SRXU (engineer decision 2026-10-19, GD72a): MassDOT utilities from GirderDetail ----------
+     Kept as their own values in P.rx.data rows (optional keys ut, uf; uta, ufa for the ahead row of an expansion joint) and shown as their own
+     table "MassDOT utilities from GirderDetail" under each support. In the analysis UT (existing utilities) is added to DW and UF (future utility
+     allowance) to DC (superstructure, with DC2): SubLoads has no separate permanent load type, so UF takes the DC factors (Strength 1.25 max /
+     0.90 min, Service 1.0) where GirderDetail uses 1.25 / 0 (Service 0 where it relieves). The Dead load tab and the report show the breakdown.
+     A support without these keys is computed exactly as before. */
+  const UK = ['ut', 'uf', 'uta', 'ufa'], hasUk = k => ((P.rx.data || [])[k] || []).some(r => r && UK.some(q => r[q] != null)), anyU = k => ((P.rx.data || [])[k] || []).some(r => r && UK.some(q => nz(r[q])));
+  function utilTables(h) { const G = MODEL.G; if (!G || G.E.length) return h; let pos = 0;
+    (P.units || []).forEach((u, k) => { const tag = `<div class="sec-h">${esc(u.name)}`; let i = h.indexOf(tag, pos);
+      while (i >= 0 && !/[< ]/.test(h.charAt(i + tag.length))) i = h.indexOf(tag, i + 1);
+      if (i < 0) return; const e = h.indexOf('</table>', i); if (e < 0) return; pos = e; if (!hasUk(k)) return;
+      const jt = !!(G.sup[k] && G.sup[k].joint), cols = jt ? [['ut', 'UT bk'], ['uf', 'UF bk'], ['uta', 'UT ah'], ['ufa', 'UF ah']] : [['ut', 'UT (as DW)'], ['uf', 'UF (as DC)']], row = P.rx.data[k];
+      const t = `</table><p class="note" style="padding:6px 0 2px"><b>MassDOT utilities from GirderDetail</b> (kip, unfactored; own values, not in the DC1, DC2, DW columns above). UT = existing utilities, carried as DW; UF = future utility allowance, carried as DC.</p><table class="mini-t"><thead><tr><th>Girder</th>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${row.map((r, j) => `<tr><td class="lbl">G${j + 1}</td>${cols.map(([c]) => `<td><input data-k="rx.data.${k}.${j}.${c}" data-kind="num" value="${esc(r && r[c] != null ? r[c] : 0)}"></td>`).join('')}</tr>`).join('')}<tr><td class="lbl">Total</td>${cols.map(([c]) => `<td style="text-align:right">${f1(row.reduce((a, r) => a + nz(r && r[c]), 0))}</td>`).join('')}</tr></tbody>`;
+      h = h.slice(0, e) + t + h.slice(e); pos = e + t.length; });
+    return h; }
+  // analysis: UT into DW, UF into DC2 (DC superstructure) at the bearings of every row; unchanged when the support has none
+  const dlu = dlUnit; dlUnit = function (G, UG, k, UM) { const r = dlu(G, UG, k, UM); if (!anyU(k)) return r;
+    const S = G.sup[k], d = (P.rx.data || [])[k] || [], nb = G.nb;
+    const L = key => S.rows.map((rw, ri) => { const a = new Float64Array(nb); for (let j = 0; j < nb; j++) { const c = d[j] || {}; a[j] = nz(ri === 1 ? c[key + 'a'] : c[key]); } return a; });
+    const add = (a, b) => a.map((rr, ri) => rr.map((v, j) => v + b[ri][j])), ut = L('ut'), uf = L('uf'), dc2 = add(r.dc2, uf), dw = add(r.dw, ut);
+    return { ...r, dc2, dw, ut, uf, DCs: UM.evalFn(add(r.dc1, dc2), false), DW: UM.evalFn(dw, false), has: true }; };
+  const rxt = rxTotals; rxTotals = function (G) { const t = rxt(G), d = P.rx.data || []; t.forEach((x, k) => (d[k] || []).forEach(r => { if (!r) return; const a = nz(r.uf) + nz(r.ufa), b = nz(r.ut) + nz(r.uta); if (a || b) { x.dc2 += a; x.dc += a; x.dw += b; } })); return t; };
+  const utTxt = k => { const d = (P.rx.data || [])[k] || [], sum = q => d.reduce((a, r) => a + nz(r && r[q]) + nz(r && r[q + 'a']), 0), by = q => d.map((r, j) => [j, nz(r && r[q]) + nz(r && r[q + 'a'])]).filter(x => x[1]).map(([j, v]) => `G${j + 1} ${f2(v)}`).join(', ');
+    return `MassDOT utilities from GirderDetail at ${esc(P.units[k].name)}: DW includes the existing utilities UT = ${f2(sum('ut'))} kip${by('ut') ? ` (${by('ut')})` : ''}; DC2 (DC superstructure) includes the future utility allowance UF = ${f2(sum('uf'))} kip${by('uf') ? ` (${by('uf')})` : ''}. UT takes the DW factors (Strength 1.50 / 0.65, as GirderDetail). UF takes the DC factors (Strength 1.25 max / 0.90 min, Service 1.0): GirderDetail uses 1.25 / 0 (Service 0 where it relieves), which SubLoads cannot represent without a separate load type, so where UF relieves (minimum cases) 0.90 UF is counted.`; };
+  { const dh0 = dlHtml; dlHtml = function () { const h = dh0(), k = P.ui.sel; if (!anyU(k)) return h;
+    return h.replace('Superstructure loads at the bearings</h3>', `Superstructure loads at the bearings</h3><p class="note" style="padding:0 0 6px">${utTxt(k)}</p>`); }; }
+  { const be0 = basisExtra; basisExtra = function () { const h = be0(), ks = (P.units || []).map((u, k) => k).filter(anyU); if (!ks.length) return h;
+    return h.replace(/(<td class="lbl">Superstructure reactions<\/td><td>[\s\S]*?)(<\/td><\/tr>)/, `$1<br>${ks.map(utTxt).join('<br>')}$2`); }; }
+  // paste into the utilities table: its own columns (the general paste handler knows DC1, DC2, DW only)
+  window.addEventListener('paste', e => { const t = e.target; if (!t || !t.dataset || !/^rx\.data\.\d+\.\d+\.(ut|uf|uta|ufa)$/.test(t.dataset.k || '')) return;
+    const txt = (e.clipboardData || window.clipboardData).getData('text'); if (!/[\t\n]/.test(txt.trim())) return;
+    e.preventDefault(); e.stopImmediatePropagation(); const [, , k, j0, c0] = t.dataset.k.split('.'), cols = ['ut', 'uf', 'uta', 'ufa'], ci = cols.indexOf(c0), row = P.rx.data[+k]; let n = 0;
+    txt.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '').forEach((l, a) => { const r = row[+j0 + a]; if (!r) return; l.split('\t').forEach((v, b) => { const c = cols[ci + b], x = num(v.replace(/,/g, '')); if (c && isFinite(x)) { r[c] = x; n++; } }); });
+    buildSide(); recompute(); autosave(); flash(`Pasted ${n} utility value${n === 1 ? '' : 's'} into ${esc(P.units[+k].name)}.`); }, true);
```

## 2026-10-19 — PR: claude/subloads-uf-loadtype (SRXF: the future utility allowance UF as its own permanent load, 1.25 / 0; engineer decision "merge, then fix UF min" after #312; PR link added after merge)

### SRXF. UF: own permanent load in the combinations   [RESULT CHANGE — §4 callout; projects without UF unchanged]
- **Engineer decision (2026-10-19, after #312):** give UF its own permanent load component: maximum factor where it adds, 0 where it relieves; Service 1.0 / 0; UT stays in DW (DW factors 1.50 / 0.65 already match GirderDetail).
- **Where the factors are applied:** one engine runs. `combine` is reassigned four times before the unified engine (`combine = function (k) {` after `function comboEval`, which replaces, not wraps, the earlier versions); the Combinations tab, the governing table (`govSumHtml`), the governing-effect lines, the DXF table, the concurrent sets (`concurrentSets` → `comboEval`) and the foundation / abutment hand-offs all go through `comboComps`. The earlier `combine` bodies (DC/DW `pf(…)` pairs) never run and are left as they are. Changed:
  - `comboComps` (anchor `if (D.UF) perm(D.UF, [L.dc[0], 0], 'UF')`): UF is a `perm` component with factors [the limit state's DC maximum (`lfOf(c).dc[0]`: Strength I, III, V and Extreme Event 1.25, Strength IV 1.50, Service I 1.0, follows a DC max override), 0]. The construction stage has no superstructure load, so no UF (as DC super).
  - `dlUnit` wrapper (SRXU block): `DC super` (`DCs`) is the original DC1 + DC2 without UF; new `D.UF` (only when a bearing has a nonzero UF). `dc2` / `dw` per bearing still include UF / UT (bearing table, seismic weight, abutment export: unfactored totals as before).
  - Dead load effects table: UF column and "DC + DW + UF" when the unit has UF; All units table: UF column when any unit has one. Combinations tab note: the UF factors. Breakdown note (Dead load tab, report basis): the 0.90 text replaced by the factors above.
- **Before (#312):** UF in DC super: Strength I 1.25 / **0.90**, Service I 1.0 / **1.0**, Strength IV 1.50 / 0.90. **After:** 1.25 / **0**, Service I 1.0 / **0**, Strength IV 1.50 / 0.
- **Governing provision:** MassDOT LRFD Bridge Manual Part I 3.5.5.2 (future utility allowance, not counted where it relieves), as GirderDetail's `utilities.future` (strMax 1.25, strMin 0, service 1.0, serviceRelieving 0); AASHTO LRFD 10th Ed. Tables 3.4.1-1, 3.4.1-2 for DC / DW.
- **Check case (util.json via GirderDetail into the SubLoads built-in bridge; before = main #312, after = this branch):** UF per pier 35.26 kip (G2 and G3 17.63 each; G2 at y = 9.84 ft, G3 at 0), per abutment 9.74 kip. Every maximum where UF adds is unchanged (e.g. Pier 1 bottom of footing P max 3612.1, Service I 2634.3; Abut. 1 seat P max 993.3). Changes, all where UF relieves:

| Unit, section, effect | Before (#312) | After |
|---|---|---|
| Pier 1, bottom of footing, P min (Strength III) | 1792.3 | **1760.6** |
| Pier 1, top of footing, P min (Strength III) | 1208.5 | 1176.8 |
| Pier 2, bottom of footing, P min (Strength III) | 1682.8 | 1651.1 |
| Pier 2, top of footing, P min (Strength III) | 1330.7 | 1299.0 |
| Pier 1, bottom of footing, M_t min (Strength I) | −7046.1 | −7202.1 |
| Pier 2, bottom of footing, M_t min | −6746.9 | −6902.9 |
| Abut. 1, bridge seat / bottom of footing, M_t min | −4091.3 / −3414.2 | −4134.4 / −3457.4 |
| Abut. 1, bottom of footing, M_l min | −1223.7 | −1234.7 |
| Abut. 2, bottom of footing, M_l max (Strength I) / Service I | 1418.6 / 557.5 | 1429.6 / 569.7 |
| Abut. 2, top of footing, M_l max (Strength V) / Service I | −1381.6 / −1298.2 | −1370.6 / −1286.0 |

  - **Hand check:** Pier 1 bottom of footing P min = (without utilities) 1733.1 + 0.65 × UT 42.31 + **0** × UF 35.26 = 1733.1 + 27.50 = **1760.6 kip** ✓ (before: + 0.90 × 35.26 = 31.73 → 1792.3). M_t min at Pier 1: UF moment about the bearing line center = 17.63 × 9.84 + 17.63 × 0 = 173.5 kip-ft; before 0.90 × 173.5 = 156.1 kip-ft relieved it, after 0: −7046.1 − 156.0 = **−7202.1** ✓.
- **How verified:** `node tests/check-syntax.mjs "Bridge Substructure Loading.html"`: pass. `node tests/compare.mjs --tool page --file "Bridge Substructure Loading.html"`: identical. origin/main vs branch, Pull → defaults → Apply: PS-Beam (real), PS-Beam MIDAS-style, older two-girder (`mct`), old ST-Girder copy, ST-Girder on the channel, GirderDetail built-in: identical (texts, cells, stored data). Every limit state's max / min array, the envelope and every concurrent set of every unit, numerically, main vs branch: identical for the built-in project and for the util payload with UF removed (UT only). Util payload: only the changes in the table above (every value compared).
- **Saved data:** none changed (UF already stored as `ut`/`uf` keys since SRXU).
- **Other copies:** none. GirderDetail unchanged.
- **Open items:** Strength IV takes UF at the DC maximum 1.50 (UF follows DC's γ_p; GirderDetail checks Strength I only, so its 1.25 does not say). Confirm, or fix UF's maximum at 1.25 in every Strength / Extreme limit state.

Diff (`Bridge Substructure Loading.html`, `git diff -U0`):

```diff
diff --git a/Bridge Substructure Loading.html b/Bridge Substructure Loading.html
index 8a2a0af..038486a 100644
--- a/Bridge Substructure Loading.html	
+++ b/Bridge Substructure Loading.html	
@@ -1468 +1468,2 @@ function dlHtml() {
-    ${respTable(r.UM.defs, [{ t: 'DC super' }, { t: 'DC sub' }, { t: 'DW' }, { t: 'DC + DW' }], (d, q) => [D.DCs[q], D.DCsub[q], D.DW[q], D.DCs[q] + D.DCsub[q] + D.DW[q]].map(v => `<td class="val">${fv(v, d.u)}</td>`).join(''))}
+    ${D.UF ? respTable(r.UM.defs, [{ t: 'DC super' }, { t: 'DC sub' }, { t: 'DW' }, { t: 'UF' }, { t: 'DC + DW + UF' }], (d, q) => [D.DCs[q], D.DCsub[q], D.DW[q], D.UF[q], D.DCs[q] + D.DCsub[q] + D.DW[q] + D.UF[q]].map(v => `<td class="val">${fv(v, d.u)}</td>`).join(''))   /* SRXF: future utility allowance, its own load */
+      : respTable(r.UM.defs, [{ t: 'DC super' }, { t: 'DC sub' }, { t: 'DW' }, { t: 'DC + DW' }], (d, q) => [D.DCs[q], D.DCsub[q], D.DW[q], D.DCs[q] + D.DCsub[q] + D.DW[q]].map(v => `<td class="val">${fv(v, d.u)}</td>`).join(''))}${D.UF ? '<p class="note" style="padding:6px 0 0">UF = future utility allowance (MassDOT utilities from GirderDetail), its own permanent load: DC super excludes it here; see the note above the bearing table.</p>' : ''}
@@ -1470,0 +1472 @@ function dlHtml() {
+  const anyUF = P.units.some((x, i) => { const rr = unitRes(i); return !rr.err && rr.DL && rr.DL.UF; });   // SRXF
@@ -1473,2 +1475,2 @@ function dlHtml() {
-    const Dl = rr.DL; return `<tr><td class="lbl">${esc(x.name)}</td><td>${lbl.charAt(0).toUpperCase() + lbl.slice(1)}</td><td class="val">${f1(Dl.DCs[qi])}</td><td class="val">${f1(Dl.DCsub[qi])}</td><td class="val">${f1(Dl.DW[qi])}</td><td class="val">${mt >= 0 ? f0(Dl.DCs[mt] + Dl.DCsub[mt] + Dl.DW[mt]) : '—'}</td></tr>`; }).join('');
-  h += `<div class="card"><div class="card-h"><h2>All units at the lowest section</h2><span class="sub">Unfactored axial (kip) and transverse moment of DC + DW (kip-ft)</span></div><div class="card-b tscroll"><table class="tbl"><thead><tr><th>Unit</th><th>Section</th><th class="right">DC super</th><th class="right">DC sub</th><th class="right">DW</th><th class="right">M<sub>t</sub>, DC + DW</th></tr></thead><tbody>${rowsAll}</tbody></table></div></div>`;
+    const Dl = rr.DL, uf = q => Dl.UF ? Dl.UF[q] : 0; return `<tr><td class="lbl">${esc(x.name)}</td><td>${lbl.charAt(0).toUpperCase() + lbl.slice(1)}</td><td class="val">${f1(Dl.DCs[qi])}</td><td class="val">${f1(Dl.DCsub[qi])}</td><td class="val">${f1(Dl.DW[qi])}</td>${anyUF ? `<td class="val">${f1(uf(qi))}</td>` : ''}<td class="val">${mt >= 0 ? f0(Dl.DCs[mt] + Dl.DCsub[mt] + Dl.DW[mt] + uf(mt)) : '—'}</td></tr>`; }).join('');
+  h += `<div class="card"><div class="card-h"><h2>All units at the lowest section</h2><span class="sub">Unfactored axial (kip) and transverse moment of DC + DW${anyUF ? ' + UF' : ''} (kip-ft)</span></div><div class="card-b tscroll"><table class="tbl"><thead><tr><th>Unit</th><th>Section</th><th class="right">DC super</th><th class="right">DC sub</th><th class="right">DW</th>${anyUF ? '<th class="right">UF</th>' : ''}<th class="right">M<sub>t</sub>, DC + DW${anyUF ? ' + UF' : ''}</th></tr></thead><tbody>${rowsAll}</tbody></table></div></div>`;
@@ -2917 +2919 @@ function comboComps(k, c) {
-  perm(DC, L.dc, 'DC'); perm(D.DW, L.dw, 'DW'); fix(p4.SH && sc(p4.SH, gSHof(k)), 'SH');   // γSH, Table 3.4.1-3: 0.5 with I_g, 1.0 with I_eff; steel substructures 1.0
+  perm(DC, L.dc, 'DC'); perm(D.DW, L.dw, 'DW'); if (D.UF) perm(D.UF, [L.dc[0], 0], 'UF'); fix(p4.SH && sc(p4.SH, gSHof(k)), 'SH');   // SRXF: future utility allowance (MassDOT), DC max factor where it adds, 0 where it relieves   // γSH, Table 3.4.1-3: 0.5 with I_g, 1.0 with I_eff; steel substructures 1.0
@@ -3448,3 +3450,3 @@ async function rxImport(file) {
-     table "MassDOT utilities from GirderDetail" under each support. In the analysis UT (existing utilities) is added to DW and UF (future utility
-     allowance) to DC (superstructure, with DC2): SubLoads has no separate permanent load type, so UF takes the DC factors (Strength 1.25 max /
-     0.90 min, Service 1.0) where GirderDetail uses 1.25 / 0 (Service 0 where it relieves). The Dead load tab and the report show the breakdown.
+     table "MassDOT utilities from GirderDetail" under each support. In the analysis UT (existing utilities) is added to DW; UF (future utility
+     allowance) is its own permanent load D.UF (SRXF, 2026-10-19), factored in comboComps with the limit state's DC maximum where it adds and 0
+     where it relieves (GirderDetail: 1.25 / 0, Service 1.0 / 0). The Dead load tab and the report show the breakdown.
@@ -3461,0 +3464,2 @@ async function rxImport(file) {
+  { const ch0 = comboHtml; comboHtml = function () { const h = ch0(), k = P.ui.sel; let D = null; try { D = unitRes(k).DL; } catch (e) { } if (!D || !D.UF) return h;   // SRXF
+      return h.replace('<p class="note" style="padding:8px 0 0">Load factors: ', '<p class="note" style="padding:8px 0 0">Load factors: UF (future utility allowance, MassDOT utilities from GirderDetail) in every limit state: the DC maximum factor where it adds, 0 where it relieves (MassDOT Part I 3.5.5.2, as GirderDetail); '); }; }
@@ -3465,2 +3469,3 @@ async function rxImport(file) {
-    const add = (a, b) => a.map((rr, ri) => rr.map((v, j) => v + b[ri][j])), ut = L('ut'), uf = L('uf'), dc2 = add(r.dc2, uf), dw = add(r.dw, ut);
-    return { ...r, dc2, dw, ut, uf, DCs: UM.evalFn(add(r.dc1, dc2), false), DW: UM.evalFn(dw, false), has: true }; };
+    const add = (a, b) => a.map((rr, ri) => rr.map((v, j) => v + b[ri][j])), ut = L('ut'), uf = L('uf'), dc2 = add(r.dc2, uf), dw = add(r.dw, ut), hasUF = uf.some(rr => rr.some(v => v));
+    // SRXF (engineer decision 2026-10-19): UF is its own permanent load (D.UF; factors in comboComps); DC super (r.DCs) excludes it. dc2 / dw keep the totals per bearing (tables, seismic weight, abutment export)
+    return { ...r, dc2, dw, ut, uf, ...(hasUF ? { UF: UM.evalFn(uf, false) } : {}), DW: UM.evalFn(dw, false), has: true }; };
@@ -3469 +3474 @@ async function rxImport(file) {
-    return `MassDOT utilities from GirderDetail at ${esc(P.units[k].name)}: DW includes the existing utilities UT = ${f2(sum('ut'))} kip${by('ut') ? ` (${by('ut')})` : ''}; DC2 (DC superstructure) includes the future utility allowance UF = ${f2(sum('uf'))} kip${by('uf') ? ` (${by('uf')})` : ''}. UT takes the DW factors (Strength 1.50 / 0.65, as GirderDetail). UF takes the DC factors (Strength 1.25 max / 0.90 min, Service 1.0): GirderDetail uses 1.25 / 0 (Service 0 where it relieves), which SubLoads cannot represent without a separate load type, so where UF relieves (minimum cases) 0.90 UF is counted.`; };
+    return `MassDOT utilities from GirderDetail at ${esc(P.units[k].name)}: DW includes the existing utilities UT = ${f2(sum('ut'))} kip${by('ut') ? ` (${by('ut')})` : ''}; the DC2 column of the bearing table below includes the future utility allowance UF = ${f2(sum('uf'))} kip${by('uf') ? ` (${by('uf')})` : ''}. UT takes the DW factors (Strength 1.50 / 0.65, as GirderDetail). In the load cases UF is its own permanent load (not in DC super): the limit state's DC maximum factor where it adds (Strength I 1.25, Service 1.0) and 0 where it relieves, as GirderDetail (MassDOT Part I 3.5.5.2); it is listed separately in the Dead load effects table.`; };
```

## 2026-10-19 — PR: claude/aashto10-substructure (AASHTO LRFD 10th Ed. renumbers and MassDOT edition note; wording only; PR link added after merge)

Basis: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024). Engineer decision 2026-10-19 ("follow the owner"): in MassDOT mode, state that the MassDOT manual is written to the AASHTO LRFD 9th Ed. and that the calculations follow the AASHTO LRFD 10th Ed. (2024). The seismic hazard method (3.10.2 to 3.10.4, site factors) is **not** changed here (engineer decision pending; separate PR).

### A10-1. Renumbered 10th Ed. tables and figures   [citation] [no result change]
Each number was looked up in the 10th Ed. text; the values the tool uses are the same as in the 10th Ed. tables.
- **Table 3.11.6.4-1 → Table 3.11.6.4.1-1** (h_eq for abutments perpendicular to traffic: 4.0 / 3.0 / 2.0 ft at H = 5 / 10 / ≥ 20 ft, the tool defaults `heq5: 4, heq10: 3, heq20: 2`). Table 3.11.6.4.1-2 is the retaining-wall table (walls parallel to traffic).
  - `earthHtml` fact, before: `<span>h<sub>eq</sub> (Table 3.11.6.4-1)</span>`; after: `<span>h<sub>eq</sub> (Table 3.11.6.4.1-1)</span>`.
  - Earth inputs note (anchor `balanced groundwater. h<sub>eq</sub> defaults are`), before: `h<sub>eq</sub> defaults are Table 3.11.6.4-1.</p>`; after: `h<sub>eq</sub> defaults are Table 3.11.6.4.1-1 (abutments; Table 3.11.6.4.1-2 is for walls parallel to traffic).</p>`.
- **Table 3.12.2.1.1-1 → Table 3.12.2.1-1** (Procedure A ranges; steel 0 to 120 °F moderate, −30 to 120 °F cold; concrete 10 to 80 °F, 0 to 80 °F; same as `TEMP_A`).
  - `TEMP_A` comment, before: `// Table 3.12.2.1.1-1, °F`; after: `// Table 3.12.2.1-1, °F`.
  - Temperature card subtitle (anchor `superstructure (Table 3.12.2.`), before: `(Table 3.12.2.1.1-1)`; after: `(Table 3.12.2.1-1)`.
  - Manual, Temperature item, before: `Procedure A uses the ranges of Table 3.12.2.1.1-1 by climate`; after: `… Table 3.12.2.1-1 by climate`.
- **Figures 3.12.2.2.1-1 to -4 → Figures 3.12.2.2-1 to -4** (T_MaxDesign / T_MinDesign contour maps).
  - Temperature card subtitle, before: `from Figures 3.12.2.2.1-1 to -4`; after: `from Figures 3.12.2.2-1 to -4`.
- References row (anchor `3.11.5, 3.11.6.4 (`), before: `3.11.6.4 (Table 3.11.6.4-1); 3.12.2 (Table 3.12.2.1.1-1);`; after: `3.11.6.4 (Tables 3.11.6.4.1-1, -2); 3.12.2 (Table 3.12.2.1-1, Figures 3.12.2.2-1 to -4);`.

### A10-2. MassDOT mode: manual written to the 9th Ed.; calculations 10th Ed.   [wording] [no result change]
- Manual, owner item, before: `<li><b>MassDOT</b> (Bridge Manual Part I, Chapter 3, January 2025):`; after: `<li><b>MassDOT</b> (Bridge Manual Part I, Chapter 3, January 2025; written to the AASHTO LRFD 9th Ed.; calculations per AASHTO LRFD 10th Ed. (2024)):`.
- Report design-basis row "Owner requirements" (anchor `rows.push(['Owner requirements'`), before: `'MassDOT LRFD Bridge Manual, Part I, Chapter 3 (January 2025): temperature,`; after: `'MassDOT LRFD Bridge Manual, Part I, Chapter 3 (January 2025; written to the AASHTO LRFD 9th Ed.; calculations per AASHTO LRFD 10th Ed. (2024)): temperature,`.
- References row `['MassDOT', …`, before: `(January 2025): 3.1.6,`; after: `(January 2025; written to the AASHTO LRFD 9th Ed.): 3.1.6,`.
- Report cover line (anchor `' · MassDOT LRFD Bridge Manual, Part I, Chapter 3 (January 2025`), before: `(January 2025)'`; after: `(January 2025; written to the AASHTO LRFD 9th Ed.)'`.
- DXF index sheet design basis, before: `' MassDOT Bridge Manual Part I, Chapter 3.'`; after: `' MassDOT Bridge Manual Part I, Chapter 3 (written to the AASHTO LRFD 9th Ed.).'`.

### Verification
- `node tests/check-syntax.mjs "Bridge Substructure Loading.html"`: all scripts pass.
- Headless Chromium, origin/main (12b90f7) vs branch, built-in project, four cases (owner AASHTO / MassDOT × temperature Procedure A / B): `MODEL.C` (every computed result) identical; every tab's text (except 3D) and the full printed report identical except the lines listed above; localStorage keys identical; no console errors.
- `node tests/compare.mjs --tool page --file "Bridge Substructure Loading.html"`: all sections identical.

### Open items (not changed)
- Seismic hazard (3.10.2 to 3.10.4, site factors, operational classes): pending engineer decision; separate PR.
- In MassDOT mode with Procedure B selected, the Temperature card subtitle reads "Procedure MassDOT 3.1.8, T_MaxDesign and T_MinDesign from Figures 3.12.2.2-1 to -4" (the figure text follows `T.proc !== 'A'`). Pre-existing display wording; the MassDOT ranges are what is used. Not changed.

## 2026-10-19 — PR: claude/aashto10-subloads-seismic (seismic ground motion per AASHTO LRFD 10th Ed. 3.10; engineer decision 2026-10-19, option (a); PR link added after merge)

Basis: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Art. 3.10.3.1 (Table 3.10.3.1-1), 3.10.4.1, 3.10.5, 3.10.6 (Table 3.10.6-1), 3.10.7.1 (Tables 3.10.7.1-1, -2), 3.10.9.1, 3.10.9.2, 11.6.5.2.1. Engineer decision 2026-10-19: the engineer enters the 22-period risk-targeted S_a table of the AASHTO-USGS database for the site; the AASHTO-2009 PGA / S_s / S_1 × F_pga / F_a / F_v method (Tables 3.10.3.2-1 to -3, three-point spectrum of 3.10.4.2) is removed. Neither article exists in the 10th Ed.

### EQ10-1. Ground motion from the entered S_a table   [calc change]
- **Where:** `eqSite()` (anchor `function eqSite() {`), constants above it (`SA_T`, `SC10`, `SC10_VSHI`, `SC10_VSLO`, `OPC`, `OPC_NAME`, `OPC_OLD`, `eqOpCat`), new `eqLnk`, new `parseSaTable`.
- **Before:**
  ```js
  const SF = {   // site factors, Tables 3.10.3.2-1 (F_pga, F_a) and -3 (F_v)
    a: { A: [0.8, 0.8, 0.8, 0.8, 0.8], B: [1, 1, 1, 1, 1], C: [1.2, 1.2, 1.1, 1.0, 1.0], D: [1.6, 1.4, 1.2, 1.1, 1.0], E: [2.5, 1.7, 1.2, 0.9, 0.9] },
    v: { A: [0.8, 0.8, 0.8, 0.8, 0.8], B: [1, 1, 1, 1, 1], C: [1.7, 1.6, 1.5, 1.4, 1.3], D: [2.4, 2.0, 1.8, 1.6, 1.5], E: [3.5, 3.2, 2.8, 2.4, 2.4] } };
  const sfAt = (tab, sc, x, xs) => { … };
  const R_TAB = { wall: [1.5, 1.5, 2.0], single: [1.5, 2.0, 3.0], multi: [1.5, 3.5, 5.0], pileC: [1.5, 2.0, 3.0], pileS: [1.5, 3.5, 5.0] };   // Table 3.10.7.1-1
  const OPI = { critical: 0, essential: 1, other: 2 };
  function eqSite() {
    const b = P.br, sc = b.siteClass || 'D', pga = num(b.pga), ss = num(b.ss), s1 = num(b.s1);
    const ok = isFinite(pga) && isFinite(ss) && isFinite(s1);
    const Fpga = isFinite(num(b.Fpga)) ? num(b.Fpga) : sfAt(SF.a, sc, pga, [0.1, 0.2, 0.3, 0.4, 0.5]);
    const Fa = isFinite(num(b.Fa)) ? num(b.Fa) : sfAt(SF.a, sc, ss, [0.25, 0.5, 0.75, 1.0, 1.25]);
    const Fv = isFinite(num(b.Fv)) ? num(b.Fv) : sfAt(SF.v, sc, s1, [0.1, 0.2, 0.3, 0.4, 0.5]);
    const As = Fpga * pga, SDS = Fa * ss, SD1 = Fv * s1, Ts = SD1 / SDS, T0 = 0.2 * Ts;
    const zone = !(SD1 >= 0) ? null : SD1 <= 0.15 ? 1 : SD1 <= 0.30 ? 2 : SD1 <= 0.50 ? 3 : 4;
    const Csm = T => !(T > 0) ? As : T < T0 ? As + (SDS - As) * T / T0 : T <= Ts ? SDS : SD1 / T;   // 3.10.4.2
    return { sc, pga, ss, s1, Fpga, Fa, Fv, As, SDS, SD1, Ts, T0, zone, Csm, ok: ok && isFinite(Fpga) && isFinite(Fa) && isFinite(Fv), op: b.opClass || 'other' };
  }
  ```
- **After** (R_TAB unchanged):
  ```js
  const SA_T = [0, 0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 7.5, 10];
  const SC10_VSHI = ['A', 'B', 'B/C', 'C'], SC10_VSLO = ['C/D', 'D', 'D/E', 'E'];
  const OPC = { critical: 0, recovery: 1, ordinary: 2 };
  const OPC_OLD = { critical: 'critical', essential: 'recovery', other: 'ordinary' };
  const eqOpCat = () => OPC[P.br.eqOpCat] != null ? P.br.eqOpCat : (OPC_OLD[P.br.opClass] || 'ordinary');
  function eqSite() {
    const b = P.br, sa = SA_T.map((T, i) => num((b.eqSa || [])[i])), sc = b.eqSiteClass || '', nOk = sa.filter(v => isFinite(v) && v >= 0).length;
    const legacy = ['pga', 'ss', 's1'].some(k => isFinite(num(b[k])));
    const vsAuto = b.eqVs !== 'gt' && b.eqVs !== 'le', vsHi = b.eqVs === 'gt' ? true : b.eqVs === 'le' ? false : SC10_VSHI.includes(sc) ? true : SC10_VSLO.includes(sc) ? false : null;
    const ok = nOk === 22 && !!sc && vsHi !== null, As = sa[0];
    const interp = T => { if (!(T > 0)) return { T: 0, i: 0, Sa: As }; if (!(T <= 10)) return { T, i: -1, Sa: NaN }; let i = 1; while (SA_T[i] < T) i++;
      const t0 = SA_T[i - 1], t1 = SA_T[i], s0 = sa[i - 1], s1 = sa[i]; return { T, i, t0, t1, s0, s1, Sa: T === t1 ? s1 : s0 + (s1 - s0) * (T - t0) / (t1 - t0) }; };
    const Csm = T => interp(T).Sa;
    const Tmax = vsHi ? 2 : 5, pts = SA_T.map((T, i) => ({ T, Sa: sa[i], TSa: T * sa[i] })).filter(p => p.T >= 1 && p.T <= Tmax);
    const pk = pts.reduce((a, p) => (p.TSa > a.TSa ? p : a), { T: NaN, TSa: -Infinity }), Sa1 = sa[SA_T.indexOf(1.0)];
    const SD1v = 0.9 * pk.TSa, SD1 = Math.max(SD1v, Sa1);
    const zone = !(SD1 >= 0) ? null : SD1 <= 0.15 ? 1 : SD1 <= 0.30 ? 2 : SD1 <= 0.50 ? 3 : 4;   // Table 3.10.6-1
    const kh0f = ['A', 'B', 'B/C'].includes(sc) ? 1.2 : 1.0, kh0 = kh0f * As;   // 11.6.5.2.1
    return { sc, sa, nOk, legacy, vsHi, vsAuto, Tmax, pts, pk, Sa1, SD1v, SD1, As, zone, kh0f, kh0, interp, Csm, ok, op: eqOpCat() };
  }
  ```
  (`SC10`, `OPC_NAME`, `eqLnk` and `parseSaTable`: copy from the file; anchors `const SC10 = [`, `const eqLnk =`, `function parseSaTable(txt)`.)
- **Provisions (10th Ed.):**
  - S_a at a period: the 22 listed values, linear between them; above 10 s site-specific (3.10.4.1).
  - A_s = S_a(T = 0) (3.10.4.1; notation list of Section 3).
  - S_D1 = max(0.90·max(T·S_a), S_a(1.0 s)), taking T·S_a at the listed periods from 1 to 2 s (v_s > 1,450 ft/s) or 1 to 5 s (v_s ≤ 1,450 ft/s) (3.10.6). The v_s range is an input: "From the site class" (A to C → > 1,450; C/D to E → ≤ 1,450, Table 3.10.3.1-1; F must be chosen) or entered.
  - Zone from S_D1, Table 3.10.6-1 (limits 0.15 / 0.30 / 0.50, unchanged).
  - The site class (Table 3.10.3.1-1, nine classes A to F) is a label: the database values already include it. It sets only k_h0 (EQ10-3) and the automatic v_s range.
- **`seismicModel`:** new line after the transverse period (anchor `CT = S0.Csm(TT), peT = CT * W / Ls;`): `if (TL > 10 || TT > 10) throw new Error(…)` (S_a beyond 10 s needs a site-specific analysis, 3.10.4.1).
- **Check case:** sample table (illustrative, not a real site), site class D:

  | T (s) | 0 | 0.01 | 0.02 | 0.03 | 0.05 | 0.075 | 0.1 | 0.15 | 0.2 | 0.25 | 0.3 | 0.4 | 0.5 | 0.75 | 1.0 | 1.5 | 2.0 | 3.0 | 4.0 | 5.0 | 7.5 | 10 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | S_a | 0.180 | 0.182 | 0.186 | 0.192 | 0.215 | 0.255 | 0.295 | 0.350 | 0.380 | 0.390 | 0.385 | 0.360 | 0.330 | 0.260 | 0.200 | 0.150 | 0.115 | 0.075 | 0.050 | 0.038 | 0.020 | 0.011 |

  - A_s = 0.180.
  - S_D1 (v_s ≤ 1,450 ft/s, 1 to 5 s): T·S_a = 0.200, 0.225, **0.230**, 0.225, 0.200, 0.190. 0.90 × 0.230 = 0.207 vs S_a(1.0) = 0.200, so S_D1 = 0.207 → Zone 2.
  - Built-in three-span example: T_L = 0.641 s → S_a = 0.330 + (0.260 − 0.330)(0.641 − 0.5)/(0.75 − 0.5) = 0.2905 (tool 0.29053). T_T = 0.242 s → 0.380 + (0.390 − 0.380)(0.242 − 0.2)/(0.25 − 0.2) = 0.3884 (tool 0.38838).
  - Before (old method, same bridge, PGA 0.15, S_s 0.30, S_1 0.08, class D):
    - F_pga = 1.5, F_a = 1.56, F_v = 2.4 → A_s = 0.225, S_DS = 0.468, S_D1 = 0.192 (Zone 2).
    - C_sm(0.641) = 0.192/0.641 = 0.2995; C_sm(0.242) = S_DS = 0.468.
  - Pier 1 elastic forces: long. 869.1 / trans. 576.4 kip before → 842.9 / 478.4 kip after (R = 3.5, so design 248.3 / 164.7 → 240.8 / 136.7 kip). Different inputs, so this shows the method, not a like-for-like comparison.

### EQ10-2. Operational categories critical / recovery / ordinary (3.10.5)   [rename; R unchanged]
- **Where:** `rOf`. Before: `const oi = OPI[P.br.opClass || 'other'];`. After: `const oi = OPC[eqOpCat()];`.
- Table 3.10.7.1-1 (10th Ed.) has the same R values under the new names (wall 1.5 / 1.5 / 2.0, single column 1.5 / 2.0 / 3.0, multiple column 1.5 / 3.5 / 5.0, pile bents 1.5 / 2.0 / 3.0 and 1.5 / 3.5 / 5.0), so `R_TAB` is unchanged. Table 3.10.7.1-2 is unchanged (0.8 superstructure to abutment).
- New input `br.eqOpCat` (select Ordinary / Recovery / Critical). Old `br.opClass` is kept in the file.

### EQ10-3. k_h0 = A_s, or 1.2·A_s for Site Class A, B or B/C (11.6.5.2.1)   [calc change on rock sites]
- **Where:** `earthLoads` (anchor `kh = S0.ok && !(isMass() && S0.zone === 1) ? nz(br.khR) *`).
- Before: `nz(br.khR) * S0.As`. After: `nz(br.khR) * S0.kh0`.
- `br.khR` is now the ratio k_h/k_h0. The value is unchanged (default 0.5, 11.6.5.2.2); the label changed from "Seismic k_h / A_s" to "Seismic k_h / k_h0".
- Check (sample table, A_s 0.180, k_h/k_h0 0.50):
  - Site class D: k_h = 0.50 × 0.180 = 0.090.
  - Site class B/C: k_h = 0.50 × 1.2 × 0.180 = 0.108 (tool 0.108).
  - Before (old method, PGA 0.15 class D): k_h = 0.5 × 0.225 = 0.1125.
- Unchanged and still using A_s: the Zone 1 connection force factor 0.15 / 0.25 (3.10.9.2), the single-span minimum A_s·N (3.10.9.1), the MassDOT "Low" SDC A rule (A_s < 0.05) and the support-length percentage of 4.7.4.4.

### EQ10-4. Input, migration of older files, display (§5, §6)   [UI / saved data]
- **Bridge tab, Seismic:**
  - inputs: site class (Table 3.10.3.1-1), v_s range for S_D1, latitude / longitude (record only);
  - a paste box with "Read pasted table" (`parseSaTable`) and "Clear table";
  - the 22-cell S_a table (`br.eqSa.0` to `.21`, typed values);
  - operational category, γ_EQ, R option;
  - a note with A_s, S_D1 and the zone, linked to the Seismic tab.
  - The parser accepts: period/value per line (tab, comma or spaces, header lines ignored, an index column allowed, a "PGA" line for T = 0), a period row with a value row, period/value pairs on one line, or the 22 values in period order. Anything else gives an error and changes nothing.
- **Removed:** the "Get from USGS" button and `usgsGet()` (the AASHTO-2009 web service), and the PGA / S_s / S_1 / F inputs.
- **Saved data:**
  - New `br.eqSa` (22 values), `br.eqSiteClass`, `br.eqVs`, `br.eqOpCat`.
  - Migration (wrapper on `migEHEQ`, anchor `const m0 = migEHEQ;`): a file with no `br.eqSa` gets a blank table, a blank site class, v_s "auto", and `eqOpCat` from `opClass` (essential → recovery, other → ordinary, critical → critical).
  - `pga`, `ss`, `s1`, `Fpga`, `Fa`, `Fv`, `siteClass`, `opClass`, `usgs`, `lat`, `lon` are kept as they are. Nothing is computed from them.
  - Such a file shows a notice on the Seismic tab and the Bridge tab, a warning in the Summary checks, and "not entered for the 10th Ed." in the report basis. Extreme Event I has no EQ until the table is entered.
- **Seismic tab (worked, §6):**
  - "Design response spectrum (3.10.4.1)": the 22 values, A_s, and the plot with the points.
  - "S_D1 and seismic zone (3.10.6)": T·S_a rows, the max, 0.90 × max, S_a(1 s), S_D1 = max(…), the Table 3.10.6-1 band → zone, the operational category, and k_h0 per 11.6.5.2.1.
  - "S_a at the computed periods (3.10.4.1)": T, the bracketing periods, the interpolation formula with values, and the result, for each segment and direction.
  - Links: Earth tab k_h0, report basis row and Bridge-tab note → the S_D1 card (`eqLnk`; "Seismic, §n.k" in the printed report).
- **Text:** report basis row, DXF index line (both copies), plan text, manual, references (3.10.2, 3.10.3.1, 3.10.4.1, 3.10.5, 3.10.6 …; 11.6.5.2.1; AASHTO-USGS database row replaces the USGS AASHTO-2009 row), in-tool open item.

### Verification
- `node tests/check-syntax.mjs "Bridge Substructure Loading.html"`: all scripts pass.
- **Headless Chromium, origin/main (a6570c0) vs branch:**
  - Built-in project with no seismic input: `MODEL.C`, every unit's EQ and Extreme Event I envelopes identical. Only the Seismic tab "no ground motion" text and the manual differ.
  - Main project with PGA 0.15 / S_s 0.30 / S_1 0.08 / D / essential, opened in the branch:
    - values kept (also after autosave), `eqOpCat` = recovery, not ok, no EQ;
    - notices shown on the Seismic tab, Bridge tab and Summary.
  - Sample table pasted through the UI (site class D):
    - A_s 0.180, S_D1 0.207, Zone 2;
    - C_sm at T_L / T_T equal to the hand interpolation (0.29053 / 0.38838);
    - k_h 0.090 (D) and 0.108 (B/C);
    - report shows the worked lines and "Zone 2 (Seismic, §6.9)".
  - Parser: 8 formats read correctly; a 3-number paste is refused. Typing a cell updates the table. No console errors.
- `compare.mjs --tool page`: `page.storage` differs only by the new `br.eq*` fields (blank table).

### Open items (not changed)
- **Abutment hand-off:** `subloads-abutment-v1` still sends `seismic.As` (now S_a(0) from the table). The abutment calculator applies its own k_h; it does not get the 1.2 factor for rock sites, and it still cites 3.10.4.2 (inventory).
- **MassDOT rules:** the MassDOT 3.4.4.x SDC A rules still map to Zone 1 / A_s < 0.05 as before; the MassDOT manual is written to the 9th Ed.
- **4.7.4.5 displacement amplification (S_DS = 0.90 × peak S_a):** not implemented, as before.

## 2026-10-20 — PR: claude/str4-subloads (STR4: Strength IV removed from the substructure combinations; engineer direction 2026-10-20 "accurate, not overly conservative"; same change as abutment_calculator #353 F44; PR link added after merge)

### STR4. Strength IV removed   [calc change] [less conservative only where Strength IV governed]
- **Provision:** AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Art. 3.4.1 (Strength IV: dead-load force effects in bridge superstructures) and C3.4.1 (not applicable to construction stages, substructures, earth-retaining systems or bearing design). Checked against the 10th Ed. text, p. 3-9. Every result of this tool is a substructure, bearing or foundation force, so Strength IV is removed everywhere.
- **Where:**
  - `COMBOS` (anchor `const COMBOS = [`): the entry `{ id: 'StrIV', name: 'Strength IV', dc: [1.50, 0.90], dw: [1.50, 0.65] }` is replaced by a comment.
  - TU factors by array position (anchor `Object.assign(COMBOS[0], { tu: 0.5 });`): Strength IV was index 2, so the positions move by one. Strength I, III, V keep 0.50; Service I, IV keep 1.00.
  - Extreme Event I insertion (anchor `COMBOS.splice(`): index 6 → 5, so EE I stays just before EE II (same order as before).
  - New `str4Old()` before `function lfOf(c)`: lists the numeric Strength IV overrides an older project has in `br.lf.StrIV`.
  - Bridge tab, "Load factors (Table 3.4.1-1)" note (anchor `Strength II (owner permit vehicle) is not included.`): says Strength IV is not included and why; if the project has saved Strength IV overrides, lists them as kept but not used.
  - Report basis, "Load factors" row (`basisExtra`, anchor `const ov = []; Object.entries(b.lf || {})`): Strength IV overrides are no longer listed as active overrides; the row says Strength IV is not used and lists any saved Strength IV overrides as kept, not used.
  - Plan text (anchor `combo: ['Strength I`): "Strength I to V" → "Strength I, III and V".
- **Before:** Strength IV (γDC 1.50 / 0.90, γDW 1.50 / 0.65, TU 0.50, no LL, no wind) entered the Strength / Extreme Event envelope, the concurrent design sets, the governing-forces table, the DXF tables and the foundation-loads hand-off. The future utility allowance UF (SRXF) took the limit state's DC maximum, i.e. 1.50 in Strength IV.
- **After:** no Strength IV anywhere. UF now takes 1.25 (Strength I, III, V, Extreme Event) or 1.0 (Service I) as its maximum; this closes SRXF's open item (UF at 1.50 in Strength IV) by removing the combination.
- **Saved data (§5):** no key or format change. An older project's `br.lf.StrIV` overrides are kept in the file (not moved to Strength I: a Strength IV DC factor is not a Strength I factor) and are shown on the Bridge tab and in the report basis as not used. Nothing else stored refers to Strength IV (the foundation-loads dialog selection is not saved).
- **Hand-off (HANDOFF.md §4.6, foundationLoads):** cases are built from `COMBOS`, so Strength IV cases are no longer sent. Format unchanged (schema 1). A payload already on the channel from an earlier version still carries them until the user sends again; Pile Designer and Spread Footing list whatever cases arrive.
- **Check case 1 (built-in project):** Strength IV governs no envelope value and no concurrent set: all 338 envelope values (169 effects, max and min), every other limit state's max / min and every concurrent set are identical (origin/main `2408b77` vs branch, headless Chromium). The foundation hand-off loses its Strength IV cases (32 over 4 units × 2 levels); every other case is identical.
- **Check case 2 (built-in project, every DC1 / DC2 / DW reaction × 6, DC/LL ≈ 12):** Pier 2, column axial at the base, unfactored DC (super + sub) = 6893.72 kip, DW = 874.20 kip, LL+IM max = 586.11 kip (BR, TU + FR, WA, EV = 0 at this section):
  - Before, Strength IV: 1.50 × 6893.72 + 1.50 × 874.20 = 10340.58 + 1311.30 = **11651.88 kip** (tool 11651.88), governing.
  - After, Strength I: 1.25 × 6893.72 + 1.50 × 874.20 + 1.75 × 586.11 = 8617.15 + 1311.30 + 1025.68 = **10954.14 kip** (tool 10954.14), governing (Strength V 10719.69, Strength III 9928.45).
  - 20 envelope values change in this case (all were Strength IV), e.g. Pier 1 bottom of footing P max 12338.29 → 11421.91, Pier 2 cap moment at column face min −51043.66 → −49702.11 kip-ft, Abut. 1 bottom of footing P max 4750.15 → 4696.36; 14 concurrent sets move from Strength IV to Strength I. All other values identical.
- **How verified:** `node tests/check-syntax.mjs "Bridge Substructure Loading.html"`: pass. `node tests/compare.mjs --tool page --file "Bridge Substructure Loading.html"`: page text and storage identical. Headless Chromium, origin/main vs branch, built-in and × 6 projects: every limit state's max / min array for every unit (Strength IV excluded) identical, the envelope differs only where Strength IV governed, concurrent sets ditto, hand-off cases identical except the dropped Strength IV cases. Combinations tab of each unit renders without Strength IV, no console errors. Older project with `br.lf.StrIV.dcMax = 1.6` and `br.lf.StrI.ll = 1.80`: opens, the Strength IV override is kept in storage and listed as not used on the Bridge tab and in the report basis; Strength I's override still applies.
- **Other copies:** abutment_calculator.html removed Strength IV in #353 (F44). No other copy of this code.
- **Open items:** none.

Diff (`Bridge Substructure Loading.html`, `git diff -U0` against origin/main `2408b77`):

```diff
diff --git a/Bridge Substructure Loading.html b/Bridge Substructure Loading.html
index 9d3d514..895aaeb 100644
--- a/Bridge Substructure Loading.html	
+++ b/Bridge Substructure Loading.html	
@@ -979 +979 @@ const PLAN = {
-  combo: ['Strength I to V, Extreme Event I and II, and Service I (Tables 3.4.1-1 and 3.4.1-2) with γ<sub>p</sub> maximum and minimum enveloped, γ<sub>EQ</sub>, and γ<sub>TU</sub>.', 'Factored forces at the bearings, top of cap, column top and base, and top and bottom of footing, with the governing combination for each force component.', 'Abutment bearing reactions exported as JSON for the earth-pressure app.'],
+  combo: ['Strength I, III and V, Extreme Event I and II, and Service I (Tables 3.4.1-1 and 3.4.1-2) with γ<sub>p</sub> maximum and minimum enveloped, γ<sub>EQ</sub>, and γ<sub>TU</sub>.', 'Factored forces at the bearings, top of cap, column top and base, and top and bottom of footing, with the governing combination for each force component.', 'Abutment bearing reactions exported as JSON for the earth-pressure app.'],
@@ -1670 +1670 @@ const COMBOS = [
-  { id: 'StrIV', name: 'Strength IV', dc: [1.50, 0.90], dw: [1.50, 0.65] },
+  // STR4 (2026-10-20): no Strength IV; per AASHTO LRFD 10th Ed. C3.4.1 it does not apply to substructures, earth-retaining systems or bearing design (old saves: br.lf.StrIV kept, unused)
@@ -1869 +1869 @@ function phase4(k) {
-Object.assign(COMBOS[0], { tu: 0.5 }); Object.assign(COMBOS[1], { tu: 0.5 }); Object.assign(COMBOS[2], { tu: 0.5 }); Object.assign(COMBOS[3], { tu: 0.5 }); Object.assign(COMBOS[4], { tu: 1.0 }); Object.assign(COMBOS[5], { tu: 1.0 });
+Object.assign(COMBOS[0], { tu: 0.5 }); Object.assign(COMBOS[1], { tu: 0.5 }); Object.assign(COMBOS[2], { tu: 0.5 }); Object.assign(COMBOS[3], { tu: 1.0 }); Object.assign(COMBOS[4], { tu: 1.0 });   // Strength I, III, V 0.50; Service I, IV 1.00
@@ -2118 +2118 @@ function supportLength(G, UG, SM) {   // 4.7.4.4
-COMBOS.splice(6, 0, { id: 'EEI', name: 'Extreme Event I', dc: [1.25, 0.90], dw: [1.50, 0.65], llEq: true, eq: true });
+COMBOS.splice(5, 0, { id: 'EEI', name: 'Extreme Event I', dc: [1.25, 0.90], dw: [1.50, 0.65], llEq: true, eq: true });
@@ -2948,0 +2949 @@ COMBOS.forEach(c => { if (c.ws && c.gws == null) c.gws = 1.0; });
+function str4Old() { const o = (P.br.lf || {}).StrIV || {}; return Object.entries(o).filter(([, v]) => String(v ?? '').trim() !== '' && isFinite(num(v))).map(([key, v]) => `${key} = ${v}`).join(', '); }   // STR4: Strength IV removed (C3.4.1); an older project's overrides stay in br.lf.StrIV, unused, and are listed
@@ -3027 +3028 @@ function concHtml(k) {
-      <p class="note">Blank uses the AASHTO value shown. Extreme Event I live load uses γ<sub>EQ</sub> (Seismic section); earth-load factors are under Earth loads. TU values are for force effects (0.50 Strength, 1.00 Service); movements are reported with 1.20 on the Temperature tab. Strength II (owner permit vehicle) is not included.</p>`; };
+      <p class="note">Blank uses the AASHTO value shown. Extreme Event I live load uses γ<sub>EQ</sub> (Seismic section); earth-load factors are under Earth loads. TU values are for force effects (0.50 Strength, 1.00 Service); movements are reported with 1.20 on the Temperature tab. Strength II (owner permit vehicle) is not included. Strength IV is not included: it does not apply to substructures (AASHTO LRFD 10th Ed. C3.4.1).${str4Old() ? ` <b>This project has saved Strength IV load factor overrides (${esc(str4Old())}): they are kept in the file but no longer used.</b>` : ''}</p>`; };
@@ -3154,2 +3155,2 @@ function basisExtra() { const b = P.br, G = MODEL.G, rows = [];
-  const ov = []; Object.entries(b.lf || {}).forEach(([id, o]) => Object.entries(o || {}).forEach(([key, v]) => { if (String(v ?? '').trim() !== '' && isFinite(num(v))) { const c = COMBOS.find(x => x.id === id); ov.push(`${c ? c.name : id} ${key} = ${v}`); } }));
-  rows.push(['Load factors', ov.length ? 'AASHTO Table 3.4.1-1 except: ' + ov.join('; ') : 'AASHTO Table 3.4.1-1 (no overrides)']);
+  const ov = []; Object.entries(b.lf || {}).forEach(([id, o]) => { if (id === 'StrIV') return; Object.entries(o || {}).forEach(([key, v]) => { if (String(v ?? '').trim() !== '' && isFinite(num(v))) { const c = COMBOS.find(x => x.id === id); ov.push(`${c ? c.name : id} ${key} = ${v}`); } }); });   // STR4: Strength IV overrides are reported apart (not used)
+  rows.push(['Load factors', (ov.length ? 'AASHTO Table 3.4.1-1 except: ' + ov.join('; ') : 'AASHTO Table 3.4.1-1 (no overrides)') + '. Strength IV is not used: it does not apply to substructures (AASHTO LRFD 10th Ed. C3.4.1)' + (str4Old() ? `; saved Strength IV overrides (${esc(str4Old())}) are kept in the file, not used` : '')]);
```
