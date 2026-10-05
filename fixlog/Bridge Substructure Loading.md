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
