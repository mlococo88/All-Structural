# Fix log — Stone Masonry Arch Load Rating.html

Governing basis used for fixes: AASHTO Standard Specifications for Highway Bridges, 17th Ed. (2002), Art. 6.4 (as cited by the tool); AASHTO Manual for Bridge Evaluation (MBE) Art. 6A.4.4.2.1 specialized hauling vehicles (SU4–SU7); MassDOT LRFD Bridge Manual Part I §7.2.7 (procedure, unchanged).

## 2026-10-04 — PR: claude/fix-stone-arch (PR #24: https://github.com/mlococo88/All-Structural/pull/24)

Default check model used below: the tool's default inputs (circular arch, span 40 ft, rise 10 ft, ring 24 in, fixed, tws 4 in, f_a = 250 psi), with crown fill cover set to 3.0 ft (H at the crown node = 3.333 ft including the wearing surface). Results come from loading the whole page in jsdom and calling the tool's own `readP()`, `ARCH.buildModel()`, `ARCH.nodalLL()` and `ARCH.rateVehicle()`.

### F1. SU6 and SU7 axle loads corrected to the MBE specialized hauling vehicles   [calc change] [LESS conservative for SU6/SU7 with the same spread basis]
- **Where:** `VEHICLES` (≈ line 2431). Anchor text: `{id:"SU6",`
- **Problem:** SU6 was coded 11.5, 8, 8, 11, 17, 17 k (72.5 k) and SU7 11.5, 8, 8, 11, 11, 17, 17 k (83.5 k). Neither matches its stated weight (34.75 t = 69.5 k; 38.75 t = 77.5 k), and the heavy tandem was moved to the rear. The applied load was 4% / 8% above the legal vehicle, and the reported tonnage (RF × tons) was not consistent with the load applied.
- **Governing provision:** AASHTO MBE Art. 6A.4.4.2.1 (Fig. 6A.4.4.2.1-2, SHVs). SU6: 11.5, 8, 8, 17, 17, 8 k at 10, 4, 4, 4, 4 ft (69.5 k = 34.75 t). SU7: 11.5, 8, 8, 17, 17, 8, 8 k at 10, 4, 4, 4, 4, 4 ft (77.5 k = 38.75 t). The sums now equal the `tons` already in the file. SU4 and SU5 were checked and are correct (54 k / 62 k).
- **Before:**
  ```js
   {id:"SU6",  name:"SU6",        tons:34.75,axles:[{x:0,P:11.5},{x:10,P:8},{x:14,P:8},{x:18,P:11},{x:22,P:17},{x:26,P:17}]},
   {id:"SU7",  name:"SU7",        tons:38.75,axles:[{x:0,P:11.5},{x:10,P:8},{x:14,P:8},{x:18,P:11},{x:22,P:11},{x:26,P:17},{x:30,P:17}]},
  ```
- **After:**
  ```js
   {id:"SU6",  name:"SU6",        tons:34.75,axles:[{x:0,P:11.5},{x:10,P:8},{x:14,P:8},{x:18,P:17},{x:22,P:17},{x:26,P:8}]},
   {id:"SU7",  name:"SU7",        tons:38.75,axles:[{x:0,P:11.5},{x:10,P:8},{x:14,P:8},{x:18,P:17},{x:22,P:17},{x:26,P:8},{x:30,P:8}]},
  ```
- **Check case:** default model, cover 3 ft. To isolate this fix, the old wheel-spread basis (tire patch + 1.75H, see F2) is used: SU6 RF 0.9954 → 1.0204 (34.6 t → 35.5 t); SU7 RF 0.9431 → 1.0776 (36.5 t → 41.8 t). Hand check of the weights: SU6 = 11.5 + 8 + 8 + 17 + 17 + 8 = 69.5 k = 34.75 t; SU7 = 69.5 + 8 = 77.5 k = 38.75 t.
- **How verified:** jsdom load of the full page, `ARCH.rateVehicle` before and after; axle sums printed from `ARCH.VEHICLES`.
- **Other copies of this code:** the AUDIT notes that `index.html`, `Moving Load Generator.html`, `Bridge Substructure Loading.html` and `Steel Bridge Beam Modules.html` have their own vehicle tables (not changed here, one tool per PR).

### F2. Wheel spread through fill ≥ 2 ft: Std. Spec. 6.4.2 literal 1.75H square is now the default; "tire patch + 1.75H" kept as an option   [calc change] [MORE conservative by default]
- **Where:** engine `deepTire()` (new, ≈ line 1637); `nodalLL()` (≈ line 1809, anchor `const dT=deepTire(model.p)`); `nodalLLByAxle()` (≈ line 1868, anchor `const dT=deepTire(p)`); ARCH export list (anchor `llRegime,deepTire`). Display and figures: `stateAt()` (anchor `const dT=shallow?`), transverse figure (anchor `const hw=(S.wt>0)`), `drawUmbrellas()` (anchor `const hfc=`), `liveLoadSection()` (anchor `const dTL=ARCH.deepTire`), `liveWorked()` (anchor `Ls=ARCH.deepTire(p).l+1.75*H; wid`), `rows()` (anchor `const Ls=rail?RS.Ls:(ARCH.deepTire`), `worked()` (anchor `const dTW=`), the nodal table headers, and the dashboard messages. Input: new select `deepSpread` (anchor `sel("deepSpread"`), default `deepSpread:"std"` in `F`, read in `readP()` (anchor `deepSpread:(g(`), added to the result fingerprint, kept on `F` across a rail/highway round trip.
- **Problem:** the tool cites Std. Spec. Art. 6.4 but, for fill of 2 ft or more, spread each wheel over (10 in + 1.75H) × (20 in + 1.75H), i.e. the tire patch plus 1.75H. Art. 6.4.2 distributes the wheel over "a square, the sides of which are equal to 1¾ times the depth of fill", with no tire dimensions. Adding the tire patch is the LRFD 3.6.1.2.6 form; it spreads the load further and lowers the pressure (by about 30% at H ≈ 3 ft, where it also makes the two wheel lines merge).
- **Governing provision:** AASHTO Std. Spec. 17th Ed. Art. 6.4.2.
- **Before (engine):**
  ```js
      const spreadL=TIRE_L+1.75*h, wtr=TIRE_W+1.75*h;
  ```
  ```js
        const spreadL=TIRE_L+1.75*H, wtr=TIRE_W+1.75*H;
  ```
- **After (engine):**
  ```js
  function deepTire(p){return (p&&p.deepSpread==="tire")?{l:TIRE_L,b:TIRE_W,tire:true}:{l:0,b:0,tire:false};}
  ```
  ```js
      const dT=deepTire(model.p), spreadL=dT.l+1.75*h, wtr=dT.b+1.75*h;
  ```
  ```js
        const dT=deepTire(p), spreadL=dT.l+1.75*H, wtr=dT.b+1.75*H;
  ```
  The overlap rule is unchanged: when w ≥ 6 ft gage the axle is spread over (gage + w)·L, otherwise each wheel over w·L. Every display location that printed `ARCH.TIRE_L+1.75*H` / `ARCH.TIRE_W+1.75*H` now uses `ARCH.deepTire(p).l/.b`, and the worked equations print `L_s=1.75H`, `w_t=1.75H` under the default and `L_s=\ell_t+1.75H`, `w_t=b_t+1.75H` under the tire option, so the report matches the solve. The shallow-fill (< 2 ft) credited spread is a separate, unchanged control that still grows from the tire patch. Its texts that claimed "continuous at 2 ft" now say so only under the tire basis.
  Input row added (highway mode, Live-load panel):
  ```js
        row("Wheel spread, fill 2 ft or more","Std. Spec. 6.4.2",
          sel("deepSpread",[["std","Std. Spec. 6.4.2 literal — 1.75H square (default)"],
            ["tire","Tire patch + 1.75H (10 in + 1.75H by 20 in + 1.75H) — less conservative"]])))+
  ```
- **Saved data:** new optional field `deepSpread` ("std" / "tire"). Old autosaves and project files have no such field, so they open on the **new default ("std")**. Their highway ratings with fill ≥ 2 ft will be **lower** than before. Select "Tire patch + 1.75H" to reproduce an old result exactly (verified: H20, HS20, Type 3 and SU4 RFs are identical to the old file to 4 decimals with that option).
- **Check case:** one 32 k axle at the crown node (H = 3.333 ft, tributary 4.979 ft):
  - Before (tire patch): L = 0.833 + 1.75·3.333 = 6.667 ft, w = 1.667 + 5.833 = 7.500 ft ≥ 6 → merged: p = 32/((6 + 7.5)·6.667) = 0.3556 ksf; nodal q = 1.770 k.
  - After (literal): L = w = 1.75·3.333 = 5.833 ft < 6 → separate: p = (32/2)/(5.833·5.833) = 0.4702 ksf; nodal q = 2.341 k (+32%).
  - Ratings (default model, cover 3 ft), before → after default: H20 1.2746 → 1.1026; HS20 1.1450 → 0.9937; Type 3 1.2828 → 1.1472; SU4 1.1186 → 0.9972; SU6 0.9954 → 0.9137; SU7 0.9431 → 0.9613 (SU6/SU7 include F1).
- **How verified:** jsdom (whole page) runs of `ARCH.nodalLL` and `ARCH.rateVehicle`; hand check above; every tab rendered without error under both options.
- **Other copies of this code:** none known.

### F3. Warning: only one truck is placed transversely   [display] [no result change]
- **Where:** dashboard checks (anchor `One truck placed transversely`) and `liveLoadSection()` (anchor `"One truck transversely"`).
- **Problem:** one vehicle (two wheel lines) is placed on the strip; no adjacent-lane truck is placed, so the overlap of spread areas from side-by-side trucks under deep fill (which Art. 6.4.2 combines) is not considered. This was not flagged.
- **Governing provision:** Std. Spec. Art. 6.4.2 (overlapping areas).
- **Before:** (no message)
- **After:**
  ```js
        add("wn","One truck placed transversely",
          "Each rating places a single vehicle (two wheel lines at 6 ft gage) on the strip. Side-by-side trucks in "+
          `adjacent lanes are not placed, so on a multi-lane barrel (this one is ${nfx(p.barrelW,1)} ft wide) the `+
          "overlap of their spread areas under deep fill, which Art. 6.4.2 combines, is not considered.","Std Spec 6.4.2");
  ```
  A matching warning box, and an info/warn box that states the 6.4.2 spread basis in use, were added at the top of the Live Load tab's distribution section. The dashboard also adds a "wn" entry whenever the tire-patch basis is selected.
- **Check case:** n/a (message).
- **How verified:** jsdom render.
- **Other copies of this code:** none known.

### F4. Barrel width ≤ 0 is an error instead of silently dropping the superimposed dead load   [robustness] [more conservative]
- **Where:** `readP()` (≈ line 9628, anchor `The barrel width is`); engine dead load (≈ line 1187, anchor `if(sdlLine>0&&`).
- **Problem:** `wSdl=(p.barrelW>0)?sdlLine/p.barrelW:0` removed every SDL line item (curbs, railings, spandrel walls) without warning when the width was blank or zero.
- **Governing provision:** MassDOT BM Pt. I §7.2.7.4B (SDL spread across the width).
- **Before:**
  ```js
    const wSdl=(p.barrelW>0)?sdlLine/p.barrelW:0;                    // k/ft² on the strip
  ```
- **After:**
  ```js
    if(sdlLine>0&&!(p.barrelW>0))throw new Error("Barrel width must be positive: it divides the superimposed dead load (§7.2.7.4B).");
    const wSdl=(p.barrelW>0)?sdlLine/p.barrelW:0;                    // k/ft² on the strip
  ```
  and in `readP()`, before the cover check:
  ```js
    if(!(n("barrelW")>0))throw new Error(
      `The barrel width is ${nfx(n("barrelW"),2)} ft. It must be positive: the superimposed dead loads `+
      `(curbs, railings, sidewalks, spandrel walls) are spread across it per §7.2.7.4B, and with a zero width `+
      `they would all be dropped from the rating. Enter the out-to-out width of the arch.`);
  ```
- **Check case:** barrel width blank: before, the SDL disappears from the rating with no message; after, the error above is shown and no rating is produced.
- **How verified:** jsdom (`readP()` with barrelW = 0 and blank).
- **Other copies of this code:** none known.

### F5. Span and rise validated (> 0) in idealized geometry   [robustness] [no result change for valid input]
- **Where:** `readP()` (≈ line 9585). Anchor: `Enter a positive clear span`
- **Problem:** with rise = 0, Rc = S²/(8R) + R/2 became Infinity, the geometry went to NaN and the page threw an uncaught `TypeError` (reproduced in jsdom with the old file).
- **Governing provision:** n/a.
- **Before:**
  ```js
    }else{S=n("span");Rr=n("rise");}
  ```
- **After:**
  ```js
    }else{S=n("span");Rr=n("rise");
      /* rise = 0 sends the circular radius S²/8R + R/2 to Infinity and the geometry to NaN */
      if(!(S>0))throw new Error(`The span is ${nfx(S,3)} ft. Enter a positive clear span.`);
      if(!(Rr>0))throw new Error(`The rise is ${nfx(Rr,3)} ft. Enter a positive rise; a rise of zero is a flat beam, not an arch.`);
    }
  ```
- **Check case:** rise = 0: before, an uncaught "Cannot read properties of undefined (reading 'C')"; after, the message "The rise is 0.000 ft…". span = −5 gives "The span is -5.000 ft…".
- **How verified:** jsdom.
- **Other copies of this code:** none known.

### F6. Storage notice text corrected   [display] [no result change]
- **Where:** storage status (≈ line 12059). Anchor: `shares one storage origin`
- **Problem:** the text said "Chrome treats each file opened from disk as its own origin". In Chromium every `file://` page shares one localStorage origin and quota.
- **Governing provision:** n/a.
- **Before:**
  ```js
        automatically and named projects will not persist.</span> Chrome treats each file opened from disk as its
        own origin; putting the app on a shared drive or a server, or using Export JSON after each session, keeps
        your work.`;
  ```
- **After:**
  ```js
        automatically and named projects will not persist.</span> Storage can be blocked by browser policy or a
        private window, and in Chrome and Edge every file opened from disk shares one storage origin and one quota
        with every other file opened the same way, so other tools can fill it. Using Export JSON after each
        session, or putting the app on a shared drive or a server, keeps your work.`;
  ```
- **Check case:** n/a. Storage keys (`stoneArchLR.*`) unchanged.
- **How verified:** syntax check; jsdom.
- **Other copies of this code:** none known.

## Open items (recorded 2026-10-04; status after the 2026-10-12 sweep: see "Earlier open items: status after this PR" at the end)
- O1. Railroad impact expression `IM = (1-(H-1.5)/8.5)*0.60` (coefficient changed from 0.40 by the author; source equation ambiguous). — Needs the governing AREMA Ch. 8 edition or the railroad owner's criteria. — Engineer to confirm.
- O2. Cooper E-80 trailing uniform load starts at the last axle; the standard diagram starts it 5 ft behind the last driver axle. Conservative. — Engineer to decide whether to match the diagram.
- O3. Rail mode carries the highway wearing-surface default (tws = 4 in), which adds dead load and shifts the cover datum used for rail spread and impact. — Engineer to decide (e.g. default tws = 0 in rail mode, or a warning).
- O4. AASHTO Type 3-3 legal vehicle is not in `VEHICLES`. — Needs MassDOT §7.2.4.1B confirmation of the required vehicle set.
- O5. Multi-lane placement is warned about (F3) but not modelled. A side-by-side lane placement (with Art. 6.4.2 overlap of areas) would be a new feature. — Recommendation: add an optional second truck at a user-set transverse offset.
- O6. The Verification tab narrative quotes SU4–SU7 and other RFs from a 2021 comparison run. That run used the shallow-fill (tire footprint, concentrated) branch, which this PR does not change, but the SU6/SU7 axle change may move those quoted numbers slightly. They were not re-run.
- O7. The figure-only cone in the elevation view now starts from the wheel point (literal basis) or the tire length (tire basis). It is a drawing; the solve does not use it.

## 2026-10-04 — PR: claude/step1-group2 (PR #31: https://github.com/mlococo88/All-Structural/pull/31)

### F7. "← All tools" link + shared project info (HANDOFF.md §4.1)   [feature (no result change)]

- **Type:** feature (no result change). No formulas, factors, units, code references, storage keys or saved-data formats were changed.
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, hidden in print), and two buttons, **Use shared project info** and **Share project info**, in the page header, under the title, beside the title block. Share publishes `bridgeSuite.v1.projectMeta` (`_schema:"bridge-project-meta"`) with the tool's own fields, and `""` for fields it lacks. Use reads it with `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm dialog listing each field that will be overwritten (old → new), writes only this tool's fields, never blanks a field when the shared value is blank, and writes through the tool's normal path (sets the input and dispatches a bubbling `input` event, so the tool's own handler updates its state and autosaves).
- **Field mapping (shared `fields` key → this tool's input):**

| shared field | this tool |
|---|---|
| `projectName` | `#tbProject` |
| `bridgeId` | — (not in this tool; shared as `""`, ignored on Use) |
| `jobNo` | — (not in this tool; shared as `""`, ignored on Use) |
| `client` | — (not in this tool; shared as `""`, ignored on Use) |
| `location` | — (not in this tool; shared as `""`, ignored on Use) |
| `preparedBy` | `#tbBy` |
| `checkedBy` | `#tbChk` |
| `date` | `#tbDate` |

- **Governing provision:** none (not a calculation change). Spec: HANDOFF.md §4.1 (channel) and §5 (helper).
- **Check case:** Share with Project name "Route 9 over Mill Brook", Job no. "J-4471", Prepared by "M. Lococo", Checked by "A. Checker", Date "2026-10-04"; then Use in another tool → the mapped fields show those values after one confirm; unmapped fields are unchanged. Calculation results before/after: identical (no calculation code touched).

**Edit 1 — link.** Where: `#hdr` → `#appTitle`, above the `<h1>`.
- Before:
```html
  <div id="appTitle">
    <h1>Stone Masonry Arch Load Rating</h1>
```
- After:
```html
  <div id="appTitle">
    <a class="bx-all-tools" href="tools.html" target="_top" title="Open the list of all tools">&larr; All tools</a>
    <h1>Stone Masonry Arch Load Rating</h1>
```

**Edit 2 — buttons.** Where: `#appTitle`, after the `.gov` line (beside the `#tblk` title block).
- Before:
```js
    <div class="gov">MassDOT BM Pt. I §7.2.7 &middot; AASHTO MBE 6A.9.1</div>
  </div>
```
- After:
```js
    <div class="gov">MassDOT BM Pt. I §7.2.7 &middot; AASHTO MBE 6A.9.1</div>
    <div class="bx-pm"><button type="button" id="bx-pm-use" title="Fill the title block from the project info shared by another tool">Use shared project info</button><button type="button" id="bx-pm-share" title="Share the title block with the other tools">Share project info</button></div>
  </div>
```

**Edit 3 — CSS.** Where: end of the first `<style>` block in `<head>` (inserted just before its `</style>`).
- Before: `</style>`
- After:
```css
/* "All tools" link + shared project info buttons */
.bx-all-tools{font-size:.85rem;color:var(--soft);text-decoration:none;}
.bx-all-tools:hover{text-decoration:underline;}
#appTitle .bx-pm{display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;}
#appTitle .bx-pm button{font-size:.85rem;padding:1px 8px;}
@media print{.bx-all-tools,#appTitle .bx-pm{display:none !important;}}
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
  var TOOL='Stone Masonry Arch Load Rating', FILE='Stone Masonry Arch Load Rating.html';
  var MAP={ projectName:'#tbProject', bridgeId:'', jobNo:'', client:'', location:'', preparedBy:'#tbBy', checkedBy:'#tbChk', date:'#tbDate' }; // shared field -> this tool's input ('' = this tool has no such field)
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

## 2026-10-09 — PR: claude/tabs-arch (PR #66: https://github.com/mlococo88/All-Structural/pull/66)

### T1. Input panel split into tabs   [UI only — no calculation change]

- **Date / type:** 2026-10-09, UI only (no result change). Engineer's request (2026-10-09): "make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel." Same approach as `Steel Beam Design - AISC 15th.html` T1: build every card exactly as before, then move the finished nodes into tab panes. The tab strip uses this tool's own output tab look (`#tabs`: band-coloured tabs, ink underline, Times).
- **How it works:** `inputPanel()` is unchanged and still returns the same HTML. At each of the four places that set `$("inPanel").innerHTML=inputPanel()` (`init`, the `loadMode` change handler in `bind`, `restore`, and the "Start a new calculation" button in `wireProject`) the new `archInputTabs($("inPanel"))` runs right after `UI.wire(...)` and **moves** the card nodes into one `div.inPane` per tab. Nothing is rebuilt, so every id, handler, value, collapse state and the `.vchk` checkboxes are untouched, and the loading mode still decides whether the Track and Tie Data card exists. A tab with no card is hidden (none is empty in either mode).
- **Tabs (in order) and the cards in each** (card id in brackets):

| Tab | Highway mode | Railroad mode |
|---|---|---|
| Geometry | Arch Geometry (`ip_geo`), Ring Depth (`ip_ring`, incl. the deterioration editor) | same |
| Fill & Dead Load | Roadway Grade & Fill (`ip_grade`), Superimposed Dead Load (`ip_sdl`) | same |
| Materials & Loads | Materials & Loads (`ip_mat`) | same (the shallow-fill rows are absent in rail mode, as before) |
| Vehicles | Rating Vehicles (`ip_veh`) | Rating Vehicles (`ip_veh`), Track and Tie Data (`ip_track`) |
| Project | Engineering Assumptions (`ip_assume`), Project Files (`ip_proj`) | same |

- **Error marker:** a red dot on a tab when (a) a number field in it cannot be parsed by the browser (`validity.badInput`), or (b) `render()` stopped on an input error (the "Input error" / "The model cannot be built" message) whose text names an input on that tab. `render()` passes the message to `archInTabMarks()` in both catch blocks and clears it after a successful build. Message → card map (`IN_ERR`): track offset → `ip_track`; superimposed load line / weight / barrel width → `ip_sdl`; cover / wearing surface thickness / grade line below extrados → `ip_grade`; modulus E / allowable f_a → `ip_mat`; ring depth / depth override / deterioration station / too many releases → `ip_ring`; measured points / span / rise / curve fit → `ip_geo`. "Cannot read the line …" goes to `ip_geo` when that line is in the measured-points box, otherwise `ip_ring` (overrides).
- **Programmatic focus:** the only input focus in the tool (Save with an empty name focuses `projName`) now calls `inTabReveal()` first. The output "jump" links go to output cards only and are unchanged.
- **Keyboard / accessibility:** `role="tablist"` (`aria-label="Input groups"`), `role="tab"` with `aria-selected`/`aria-controls` and roving `tabindex`, `role="tabpanel"` with `aria-labelledby`; ←/→ (and ↑/↓), Home, End.
- **New storage key:** `stoneArchLR.inputTab_v1` (localStorage, plain string `geo`, `fill`, `mat`, `veh` or `proj`), remembers the active input tab per browser. Reads and writes are in try/catch with an in-memory fallback. It is **not** in `snapshot()`, so `stoneArchLR.autosave`, `stoneArchLR.projects`, the JSON export/import and `bridgeSuite.v1.projectMeta` are unchanged. No existing key or format changed.
- **Print:** unchanged. Print hides `#wrap` (input and output panels) and prints the report built in `#rptHost`, which reads values by id, so hidden panes do not affect it.
- **Narrow screens:** the strip wraps (`flex-wrap`) and is sticky at the top of the scrolling input panel (below 1050 px, where the panel stops scrolling, it sticks to the top of the window).
- **Governing provision:** none (no engineering change).
- **Before / After** (file uses LF):
  1. CSS. Anchor (unchanged): `.tabpane{display:none;} .tabpane.on{display:block;}`. After it, inserted the block starting `/* ---------- input panel tabs (archInputTabs) — same look as the output #tabs ---------- */` through `.inTab[hidden],.inPane[hidden]{display:none !important;}` (12 lines: `#inTabs`, `.inTab`, `.inTabDot`, `.has-err`).
  2. New code inserted immediately before `/* ---------------- init ---------------- */` (anchor: `/* ---------------- input panel tabs (UI only) ----------------`): `IN_TABS`, `IN_SEC`, `IN_TAB_KEY`, `inTabGet`, `inTabSet`, `archInputTabs`, `setInTab`, `inTabKey`, `inTabReveal`, `IN_ERR`, `archInTabMarks` (copy from the file, from that comment down to the line before the init comment).
  3. `restore()`, `init()` and the `loadMode` branch of `bind`: after
     ```js
     $("inPanel").innerHTML=inputPanel();
     UI.wire($("inPanel"));
     ```
     added `archInputTabs($("inPanel"));` on the next line (three places).
  4. `wireProject()`, `bReset`: before `$("inPanel").innerHTML=inputPanel(); UI.wire($("inPanel"));` — after the same line with ` archInputTabs($("inPanel"));` appended.
  5. `wireProject()`, `bSave`: before `projMsg("Enter a project name first.",true);$("projName").focus();return;` — after `projMsg("Enter a project name first.",true);inTabReveal($("projName"));$("projName").focus();return;`.
  6. `render()`: `archInTabMarks(e.message);` added as the first line of the `readP()` catch block and after `M=null;` in the `buildModel` catch block; `archInTabMarks("");` added after the `buildModel` try/catch, before `results=[];`.
- **Check case:** n/a (no calculation change). Default arch (40 ft span, 10 ft rise, 24 in ring, HS20 etc.): every output tab's text identical before and after.
- **How verified:** `node --check` on all 15 inline scripts. Headless Chromium (Playwright), `origin/main` vs branch, with KaTeX 0.16.9 and Plotly 2.27.0 (the pinned versions) served locally: the text of all 13 output tabs and `snapshot()` identical for highway default, measured geometry typed/pasted into the survey box, grade by springing covers + depth override + SDL line items pasted + a deterioration row, after error states, railroad mode with track offsets pasted, and after save → change → load and page reload (autosave restore); saved-project JSON, exported JSON and the `bridgeSuite.v1.projectMeta` payload identical; the list of input/select/textarea/button ids, classes and checkbox values identical in both modes, each in exactly one pane; red dots checked for E = 0, a bad SDL line, a bad override line and an unparsable number; tab remembered across reload and when storage throws; arrow/Home/End keys; "Start a new calculation" gives the same state and output as before; no console errors. Screenshots of every tab at 1500 and 400 px. The only differences in output text were the Rating Summary's own run-time note ("Computed in x s", printed only when a sweep takes over 0.4 s), which varies from run to run. At 400 px the page is 534 px wide on both main and the branch. The cause is the existing header title block (`#tblk{min-width:420px}`), not the tab strip, and it was left alone.
- **Other copies:** none.
- **Open items:** none.

## 2026-10-12 — PR: claude/sweep-stonearch (open-item sweep; PR #163: https://github.com/mlococo88/All-Structural/pull/163)

Engineer's instruction (2026-10-12): work through every open item, use best judgment, and list what needs the engineer. Basis as at the top of this log (AASHTO Std. Spec. 17th Ed., MBE, MassDOT BM Pt. I §7.2.7). Provisions I could not confirm against the printed text are marked **verify**. Line numbers are approximate (after the fix). Default model = the tool's defaults (40 ft circular, 10 ft rise, 24 in ring, cover 2 ft + 4 in wearing surface, barrel 24 ft, f_a = 250 psi).

### W1. Side-by-side trucks on multi-lane barrels   [calc change] [**MORE conservative**; default changes results of highway ratings on barrels 20 ft wide or more] (open item O5)
- **Where (engine):** new block after `function stripLoadConc(` (≈ line 1804): `TRUCK_CLR`, `lanesOn`, `truckClr`, `multiPres`, `wheelLinesX`, `transDisp`, `transConc`, `sideBySide`, `sideBySideAt`; exported from `ARCH` (anchor `TIRE_L,TIRE_W,GAGE,sideBySide,sideBySideAt,lanesOn,TRUCK_CLR};`). `nodalLL()` (anchors `const kD=disp.length?sideBySide(`, `kC=sideBySide(model.p,E,true)`, `k2=sideBySide(model.p,wt2,false)`) and `nodalLLByAxle()` (three `*sideBySide(...).kappa` factors) multiply the one-truck pressure by κ.
- **Where (input / saved data):** `F` gains `lanes:"auto",truckClr:"4"`; two rows after the `deepSpread` select in the Materials & Loads card (highway only): select `lanes` (Auto / 1 / 2 / 3 / 4 lanes) and number `truckClr` (ft); `readP()` reads `lanes:g("lanes")||"auto",truckClr:n("truckClr")` and refuses a blank or negative gap in highway mode; result fingerprint gains `p.lanes,p.truckClr`; `bind` mirrors both to `F` (like `deepSpread`); `restore()` sets `F.lanes`/`F.truckClr` from the file or to the defaults when the file has none; "Start a new calculation" resets them.
- **Where (reports):** dashboard check (anchor `const sbC=ARCH.sideBySideAt(p,M.g.coverCrown+p.tws);`, replaces the F3 "One truck placed transversely" warning, which is kept for one lane); Live Load tab message (anchor `const nLanes=ARCH.lanesOn(p);`) and worked example (`const sbW=ARCH.sideBySide(p,wt,false), kW=sbW.kappa;`, κ step, κ in the p_i and concentrated w equations); distribution table and Nodal Results table get a "κ side-by-side trucks" column when more than one lane is on; node worked calculation (`const sbK=ARCH.sideBySide(p,wt,false), kW=sbK.kappa;`, κ step, κ in p_i).
- **Problem:** one vehicle was placed transversely. On a barrel wide enough for two or more lanes, trucks in adjacent lanes stand at the same station; under deep fill their spread areas overlap with the first truck's, and Art. 6.4.2 combines overlapping areas over their outside limits. Only a warning was given (F3).
- **Rule implemented:** identical trucks side by side, 6 ft gage, `truckClr` (default 4 ft: 10 ft trucks with the wheels 2 ft inside each edge, adjacent) between the wheel lines of adjacent trucks. For n = 1 … N loaded lanes, the peak strip line load per unit axle load is m_n·k·(1/2)/W over each merged group of k wheel lines of outside width W (6.4.2 merge where gap ≤ w; the concentrated 6.4.1 branch superimposes widths E where gap < E, as `stripLoadConc` does). m_n = 1.00 (1–2 lanes), 0.90 (3), 0.75 (4+). κ = max over n ÷ the one-truck value (κ ≡ 1 with one lane). N: `auto` = Art. 3.6.3 on the barrel width (W < 20 ft → 1; 20–24 ft → 2; otherwise ⌊W/12⌋), which is at least the roadway width and so errs toward more lanes; or the number selected.
- **Governing provision:** AASHTO Std. Spec. 17th Ed. Art. 6.4.2 (overlapping areas), 3.24.3.2, 3.12.1 (reduction in load intensity), 3.6.3 / 3.7 (lanes, truck width) (**verify** the 3.6.3 lane rule and the 4 ft spacing against the printed edition).
- **Before (engine, `nodalLL`):**
  ```js
      if(f>0)press += f*((wtr>=GAGE)? a.ax.P/((GAGE+wtr)*spreadL) : (a.ax.P/2)/(wtr*spreadL));
  ```
  ```js
      for(const a of conc)addConc(model,q,a.xa,stripLoadConc(a.ax.P,E));
  ```
- **After:**
  ```js
      const kD=disp.length?sideBySide(model.p,wtr,false).kappa:1;   // side-by-side trucks
      ...
      if(f>0)press += f*((wtr>=GAGE)? a.ax.P/((GAGE+wtr)*spreadL) : (a.ax.P/2)/(wtr*spreadL))*kD;
  ```
  ```js
      const E=shallowWidth(model.p), kC=sideBySide(model.p,E,true).kappa;
      for(const a of conc)addConc(model,q,a.xa,stripLoadConc(a.ax.P,E)*kC);
  ```
  (and `*k2` on the credited-spread branch; the same three factors in `nodalLLByAxle`, so the axle breakdown still reproduces `nodalLL`). Copy the helper block from the file (it is self-contained, ~60 lines).
- **Saved data:** two new optional fields `lanes`, `truckClr` in the project JSON (no new storage key). Old files and autosaves open on the **new default (Auto)**: their highway ratings on barrels ≥ 20 ft wide go down. Selecting "1 lane" reproduces the old result exactly (verified, default model: all ten ratings identical to main to 4 decimals).
- **Check case:** default model, 24 ft barrel → 2 lanes, gap 4 ft.
  - Crown, H = 2.333 ft, w = 1.75H = 4.083 ft < 6: one truck 0.5/4.083 = 0.12245 per kip; two trucks: inner wheels 4 ft apart merge (4 ≤ 4.083): 2 × 0.5/(4 + 4.083) = 0.12371 → κ = 1.0103.
  - A node with H = 8 ft, w = 14 ft: one truck merged 1/(6 + 14) = 0.0500; two trucks, all four wheels merge, 2/(16 + 14) = 0.0667 → κ = 1.333.
  - Ratings, main → branch (Auto): H20 0.8418 → 0.6896; HS20 0.7723 → 0.6259; Type 3 0.9985 → 0.8219; 3S2 1.1123 → 0.9015; SU4 0.8614 → 0.7046; SU5 0.8276 → 0.6754; SU6 0.7896 → 0.6378; SU7 0.8180 → 0.6564; EV2 0.7816 → 0.6382; EV3 0.5491 → 0.4507. They govern at the springings, where the cover is deep and κ approaches 4/3.
- **How verified:** jsdom (whole page) `ARCH.rateVehicle` main vs branch with Lanes = 1 (identical) and Auto (above); headless Chromium render of all 13 output tabs, highway and railroad, no console errors; screenshots of the input card and Live Load tab.
- **Not changed (noted):** the transverse figure on the Live Load tab still draws one truck (its pressure label is read back from the solver, so the value is right); Art. 6.4.2's limit that the distribution width may not exceed the slab (barrel) width is not applied, for one truck or several (see Remaining).
- **Other copies:** none.

### W2. Cooper E-80 trailing load starts 5 ft behind the last axle   [calc change] [LESS conservative, only where the trailing load reaches the section] (open item O2)
- **Where:** `RAIL_VEHICLES` E80 (anchor `trail:8,trailGap:5,`); `railNodeLoad()` (anchor `const tg=vehicle.trailGap||0, tailX=`); the two worked trailing-load steps (anchor `const tailX=(dir>0)?pos+maxOff+(veh.trailGap||0)`), the elevation figure (`const tL=Math.max(pos+lastX+(veh.trailGap||0),xlo);`), the animation figure (`const tailX=pos+lx+(veh.trailGap||0);`) and the vehicle diagram (`const x0=Math.min(X(L+(veh.trailGap||0))+6,W-40);`).
- **Problem:** the 8 k/ft uniform load started at the last axle; the standard Cooper E-80 diagram starts it 5 ft behind the last axle.
- **Governing provision:** AREMA Manual Ch. 8 (and Ch. 15), Cooper E-80 load diagram (**verify** edition).
- **Before:** `const tailX=(dir>0)?pos+maxOff:pos;`  **After:** `const tg=vehicle.trailGap||0, tailX=(dir>0)?pos+maxOff+tg:pos-tg;` (other vehicles have no `trailGap`, so 0 and unchanged).
- **Check case:** default model in railroad mode, t_ws = 0, crown node 5 (x = 20.80 ft, tributary 4.979 ft, W = 9.917 ft), last axle 3 ft left of the node: nodal load before 6.0316 k/ft, after 2.4101 k/ft; the difference 3.6215 = 8 × (22.80 − 18.31)/9.917 is the trailing load on the 4.49 ft of the tributary that now lies inside the 5 ft gap. E-80 rating factor on the default model unchanged (0.1144 at t_ws = 4 in): the axles govern there.
- **How verified:** jsdom (`ARCH.nodalLL`) main vs branch; Chromium render of the railroad tabs.

### W3. Railroad mode: wearing surface defaults to 0 and is flagged   [input default + message] [results change only for new rail projects switched from the untouched highway default; MORE conservative there] (open item O3)
- **Where:** `bind()` loadMode branch (anchor `/* A railroad has no pavement by default`), new global `let twsAuto=false;` (after `let unitMigrated=null, tieReverted=null;`), reset in `restore()` and "Start a new calculation"; dashboard: the "No wearing surface thickness entered" warning is highway only (`else if(p.tws<=0&&p.loadMode!=="rail")`), and a new rail warning "Wearing surface entered under railroad loading" when t_ws > 0.
- **Problem:** rail mode kept the highway t_ws = 4 in: about 47 psf of extra dead load, and a surface 4 in higher, which lengthens the tie spread and lowers the AREMA impact (cover is measured from that surface).
- **Rule:** switching to railroad sets t_ws to 0 only when it is exactly the untouched 4 in, and puts 4 back on the way to highway if it is still 0. Saved rail projects keep their t_ws and show the warning.
- **Check case:** default model switched to railroad: E-80 RF 0.1144 (t_ws = 4 in, main) → 0.1116 (t_ws = 0).
- **Governing provision:** MassDOT BM Pt. I §7.2.7.3B; AREMA (impact depth below the base of rail).

### W4. AASHTO Type 3-3 legal vehicle added   [new vehicle] (open item O4, in part)
- **Where:** `VEHICLES`, after `{id:"T3S2",` (anchor `{id:"T33",`).
- **After:** `{id:"T33",  name:"Type 3-3",   tons:40,   axles:[{x:0,P:12},{x:15,P:12},{x:19,P:12},{x:34,P:16},{x:50,P:14},{x:54,P:14}]},` — 12, 12, 12, 16, 14, 14 k at 15, 4, 15, 16, 4 ft, 80 k = 40 t (MBE Appendix D6A; matches `index.html`).
- New projects rate it by default (the vehicle list defaults to all); saved projects keep their own selection. Default model: Type 3-3 RF 1.2314 (one lane), 0.9981 (Auto).
- Whether MassDOT §7.2.4.1B requires it for posting is under Needs engineer.

### W5. User Manual: K-01-001 cross-check flagged as dated; §8 worked example re-run   [docs] (open item O6)
- **Where:** Manual §5.6 (anchors `Run on the reference package's own distribution assumption` and `The SU4–SU7 residual is a position sweep.`) and §8 (8.2 inputs, 8.3 expected results, 8.4 checks).
- **§5.6:** the K-01-001 project file is not in the repository, and an idealized 20 ft / 4 ft model does not reproduce the quoted figures (Type 3 1.31 against 1.243), so the "This program" column could not be re-run. The text now says those figures are from the 2021 run, lists the changes since (F1 SU6/SU7, F2 spread basis, W1 side-by-side trucks: 4 lanes on that 50 ft barrel), and asks for a re-run before quoting; the SU4–SU7 paragraph no longer claims the four must agree (after F1, SU6/SU7 carry trailing 8 k axles).
- **§8:** inputs restated in current units (ring 24 in, wearing surface 4 in, override depths in inches) and with the side-by-side setting; expected values re-run on this build: DL crown thrust 17.64 → 18.31 k/ft, crown moment −0.03 → −1.15 k·ft/ft (e 0.002 → 0.063 ft), springline moment −7.30 → −9.08 k·ft/ft; HS20 RF 1.33 (47.9 t) → 0.63 (22.5 t) at a springline (0.77 with one lane); pinned 1.77 → 1.28; crown override 0.24 → 0.44; Bernoulli: springline moment 9.08 → 9.24, RF 0.60. The old numbers predate several earlier releases.

### Earlier open items: status after this PR
- **O1** (rail impact coefficient 0.60): not changed; needs engineer.
- **O2:** fixed (W2). **O3:** fixed (W3). **O4:** vehicle added (W4); the required set needs the engineer. **O5:** fixed (W1). **O6:** addressed (W5); K-01-001 re-run needs the project file.
- **O7** (figure-only cone): closed, it is a drawing and the solver does not use it.

### Needs engineer
1. **O1, rail impact.** Confirm the AREMA Ch. 8 edition (or the railroad's criteria) for IM = [1 − (H − 1.5)/8.5] × 0.60 (60% at 1.5 ft to 0 at 10 ft). Recommendation: keep 0.60 (the conservative reading of the ambiguous typesetting) until checked.
2. **O4, vehicle set.** Does MassDOT §7.2.4.1B require Type 3-3 (and any other legal or SHV vehicles) for posting? Recommendation: keep Type 3-3 available and selected by default.
3. **O5, lanes.** Confirm rating with side-by-side trucks per Art. 3.6.3 / 6.4.2 / 3.12.1 for arch barrels under MassDOT §7.2.7, and the Auto rule (lanes from the barrel width). Recommendation: keep Auto, and set the lane count from the roadway width where it is known.
4. **O6, K-01-001.** Re-run the K-01-001 project file on this build and update Manual §5.6.

### Remaining open items
- Art. 6.4.2 "the total width of distribution shall not exceed the total width of the supporting slab": not applied (one or several trucks). Under very deep fill on a narrow barrel the merged width can exceed the barrel width, which understates the pressure. Recommendation: cap the merged width at the barrel width (a §4 calc change; not done here).
- The Live Load transverse figure draws one truck; it could draw the adjacent truck when κ > 1.

## 2026-10-18 — PR: claude/arch-d11-report (PR #278: https://github.com/mlococo88/All-Structural/pull/278)

### D11: calculation-sheet report in the Gusset Plate Rating / ST-Girder format (Tier 1, display only)
- **Engineer request:** 2026-10-14 / 2026-10-18 (AUDIT.md D11: "have a report builder, to be reviewed against the format").
- **Functions / anchors:**
  - New, immediately before `function buildReport(sel){` (anchor `/* D11 (2026-10-18): calculation-sheet report in the Gusset Plate Rating / ST-Girder format`): `ARCH_REFS`, `archPageCSS()`, `archApplyPageCSS()`, `archResultBlock()`, `archCalcSheet()`. To re-apply by hand, copy that block from this version.
  - `buildReport()`:
    - The `#rptHead` box is replaced by a cover section (anchor `/* D11 (2026-10-18): cover page with the title block`).
    - `sec()` takes an optional third argument, a target id written as `data-cid` on the `h2`. Before: `` const sec=(title,body)=>`<h2>${N()}. ${title}</h2>${body}`; `` After: `` const sec=(title,body,cid)=>`<h2${cid?` data-cid="${cid}"`:""}>${N()}. ${title}</h2>${body}`; ``. Ids passed: `"o_dash"` (Summary Dashboard), `"o_geo"` (Geometry), `"o_dl"` (Dead Load), `"rate"` (Rating — Vehicle by Vehicle), `"man"` (User Manual).
    - The per-vehicle `h3` gets `data-cid="veh_${r.id}"`. Before: `` body+=`<h3>${n+1}.${++sub} `` After: `` body+=`<h3 data-cid="veh_${r.id}">${n+1}.${++sub} ``.
    - Block "C3 — running header and footer" (filled `#runHead` / `#runFoot`) is replaced by `archApplyPageCSS();`.
    - Certification is appended inside the document. Before: `$("rptHost").insertAdjacentHTML("beforeend",sig);` After: `$("rptHost").querySelector(".rpt").insertAdjacentHTML("beforeend",sig);`.
    - Block "C5 — contents" (an unlinked table of the `h2` headings) is replaced by `archCalcSheet($("rptHost"));`.
  - `reportModal()`: the default-selection lines move into the new `rptSelDefaults()`, and the build goes through the new `archBuildReport(sel)`. Before: `window.__buildingReport=true; try{buildReport(sel);}finally{window.__buildingReport=false;}`. After: `archBuildReport(sel);`.
  - New `let renderSeq=0, rptBuiltSeq=-1;`, `archBuildReport()` and a `beforeprint` listener (after `rptSelDefaults`). `render()` gains `renderSeq++;` as its first line.
  - CSS:
    - The `@page{margin:1.25in 0.55in 1.15in;}` rule and the `@media print` block that showed `#runHead` / `#runFoot` as `position:fixed` bands are replaced by `#runHead,#runFoot{display:none !important;}` (anchor `/* D11 (2026-10-18): the running header and footer are now @page margin boxes`).
    - New rules after `#rptFoot{…}`: anchor `/* D11 calculation-sheet report (Gusset Plate Rating / ST-Girder format) */`.
- **Before:**
  - A title box on page 1 (Project, Subject, Task, Computed by, Date, Checked by, Date).
  - An unlinked "Contents" table of the 18 section headings, with no subsections.
  - Sections numbered 1–18 that ran on without page breaks. Inside them, the panels kept their own tab numbering ("1. Method", "2. Degrees of freedom …"), and only the rating section had "8.k" headings.
  - A running header "Project · Subject | Task · Stone Arch LR" and footer "Computed … · Checked … | Inventory level · Allowable Stress · MBE 6A.9.1". These were `position:fixed` bands without page numbers.
- **After:**
  - **Cover:**
    - Title, project (or "Untitled"), subject when entered, method and codes (railroad mode names AREMA Ch. 8), by-line.
    - The controlling result, with the same values as the dashboard ("EV3 (Inv basis), RF = 0.451 (19.4 tons) at section SL-L — at least one vehicle rates below 1.0").
    - The title block: Project / Project No. / Subject / Computed by / Date / Task / Checked by / Checked date / Program (Stone Arch LR build).
    - **Project No.:** the tool has no project-number field (title block: `tbProject`, `tbSubject`, `tbTask`, `tbBy`, `tbDate`, `tbChk`, `tbChkDate`). It prints "—", and no field was added.
  - **References table** (`ARCH_REFS`), listing only what the tool cites:
    - MassDOT BM Pt. I §7.2.7 (§7.2.7.2B–§7.2.7.12, Fig. 7.2.7-1), §7.2.4.1B and §7.2.4.6B;
    - AASHTO MBE 6A.9.1, 6B.5.2.6 and 6B.7;
    - AASHTO Std. Spec. 6.4 / 6.4.1 / 6.4.2, 3.8.2.3, 3.24.3 / 3.24.3.2 / 3.24.10 / 3.30, and 3.6.3 / 3.12.1;
    - AASHTO LRFD 3.6.1.2.6 (tire-patch option only);
    - AREMA Ch. 8 (railroad);
    - the two papers in Manual §9.2.
    - Every row says "Edition: verify". The tool states no edition (AUDIT.md inventory: "No editions stated."). The Std. Spec. row notes that this fix log works to the 17th Ed. (2002).
  - **Table of contents:** numbered, with links, listing sections and subsections.
  - **Numbered sections** (`section.cr-sec`, each starting on a new page, headings in the house style), unchanged in content and order:
    1. Input Echo;
    2. Summary Dashboard;
    3. Design Basis and Sign Conventions;
    4. Geometry, Restraint and Model Definition;
    5. Longitudinal Section;
    6. Dead Load;
    7. Live Load Distribution Through Fill;
    8. Rating — Vehicle by Vehicle;
    9. Rating Vehicle Configurations;
    10. Force Diagrams;
    11. Lateral Earth Pressure;
    12. Influence Line Development;
    13. Nodal Results;
    14. Independent Verification against Midas Civil;
    15. Rating Summary;
    16. Mesh Convergence;
    17. User Manual and Design Basis;
    18. Certification.
    - Deselected sections close up the numbering, as before.
  - **Subsections n.k:**
    - The top-level panels of a section (the panel's own number is replaced by n.k), the per-vehicle headings of §8, and the "Worked calculation — node …" heading of §13.
    - Where a section has none of those, its top-level `h4` headings (§3, §4, §6, §7).
    - The User Manual keeps its own chapter numbering and gets no n.k.
    - Worked equations (symbolic → substituted → result) are exactly as on screen; nothing is recomputed.
  - **Result lines** ("Results — Rating factors") at the end of §8, or of the Summary Dashboard when §8 is not printed. There is one line per rated vehicle: "<vehicle> rating factor: RF = x.xxx → tons [, E-number] (MassDOT BM Pt. I §7.2.7.12; MBE 6A.9.1; governs at <section>; §8.k) PASS/FAIL". PASS means RF ≥ 1.0, the dashboard's rule, and the values are the tool's `results`.
  - **Print:** `@page` letter with margin boxes, in `<style id="arch-page">` inside `@media print`, so they apply only while printing.
    - Top: "Project No: — / Description: <Subject, else Project>", "Computed By / Checked By", "Date / Date".
    - Bottom: "<project> (Stone Masonry Arch Load Rating)", with "Stone Arch LR <build> · Inventory level · Allowable Stress · MBE 6A.9.1" on a second line (kept from the old footer), and "Page X of Y".
    - The Task field, which was in the old running header, now prints on the cover only.
- **Fixed along the way (display only):**
  1. **Raw TeX.** Influence Lines tab, panel "Element stiffness — worked for one element", step "Axial and flexural rigidity" (screen and report). It printed "EI = 144000 kip\cdotpft²", because KaTeX has no text-mode "·". Anchor `EI=${num(E*I,0)}\\ \\text{kip`.
     - Before: `` res:`EA=${num(E*A,0)}\\ \\text{kip},\\ EI=${num(E*I,0)}\\ \\text{kip·ft²}`}) ``
     - After: `` res:`EA=${num(E*A,0)}\\ \\text{kip},\\ EI=${num(E*I,0)}\\ \\text{kip}\\cdot\\text{ft²}`}) ``
     - It now reads "kip⋅ft²". Same value.
  2. **Stale or empty print.** Ctrl+P (or the browser's Print) printed the report as last built. Before the first build that was an empty `#rptHost`: a blank sheet with only the running bands. After any input change it was a stale report. The `beforeprint` listener now rebuilds the report whenever `render()` has run since the last build, using the last report selection (all sections by default). The "Build report & print" button builds once and is not rebuilt.
  3. **Unlinked contents.** The old contents table had no links and no subsections. Subsection numbering mixed each tab's own "1., 2. …" with document numbers. All of this is now n.k as above.
- **Provision:** none. No formula, factor, unit, code reference or result changed.
- **Saved data:** none.
  - No key or format change: `stoneArchLR.autosave`, `stoneArchLR.projects`, `stoneArchLR.probe`, `stoneArchLR.inputTab_v1`, the JSON export and `bridgeSuite.v1.projectMeta` are untouched.
  - The report selection (`rptSel`) is in memory only, as before.
- **Check case:** default project, all report options on, title block blank.
  - 18 sections and 69 subsections; 167 letter pages (main: 165).
  - §8 result lines, equal to the dashboard: H20 0.690 FAIL, HS20 (V=14′) 0.626, Type 3 0.822, Type 3S2 0.901, Type 3-3 0.998, SU4 0.705, SU5 0.675, SU6 0.638, SU7 0.656, EV2 0.638 and EV3 0.451 (19.4 tons, governs at SL-L, §8.11), all FAIL. The full-precision RFs are 0.689613 … 0.450739.
  - Railroad mode (E80, F40PH, HSP46): the cover names AREMA Ch. 8. The result lines are "AREMA Cooper E-80 rating factor: RF = 0.114 → 4.6 tons, E9 … §8.1 FAIL", F40PH 0.196 and HSP-46 0.186.

### D11 links: quoted values link to the panel where they are worked (CLAUDE.md §6) (Tier 1, display only)
- **New global helper** `archWorkedIn(items)`, before the CALC module (anchor `/* ---- D11 links (CLAUDE.md §6, 2026-10-18)`). It returns `<div class="wkLink">Worked in: <a class="wkA" data-wtab data-wcard [data-wsub] data-txt>value → Tab · Panel</a></div>`.
- **New in the application layer** (before `function postRender(p){`): `archGoto(tab,card,sub)` and a document click handler for `a.wkA`. A click:
  - sets `activeTab` and re-renders;
  - expands the panel (also when it was collapsed);
  - scrolls the output panel, or the window on narrow screens, so the panel (or the `h4` / `h5` named by `sub`) sits just below the sticky tab bar;
  - flashes the panel.
- **"Worked in" lines added:**
  1. Summary Dashboard, "Controlling result" message: governing RF → Rating · <vehicle>. Anchor: after `"Cooper derives from that same 80 kip reference and is not a physical vehicle weight."`.
  2. Live Load tab, "Worked at the controlling case" message: governing position x → Rating · <governing vehicle>. Anchor `` `${gv.dir<0?", traveling right to left":""}.`+ ``.
  3. Live Load tab, "Influence line superposition at …": influence coefficients → Influence Lines · Influence coefficient table — moment (`il_tabM`).
  4. Vehicles tab, each vehicle panel (`vh_<id>`, title "… — RF x.xxx"): RF → Rating · <vehicle>. Anchor: first line of the `UI.pnl("vh_"+v.id,…)` body.
  5. Rating tab, every vehicle's "Dead load at this section, by component" table (`CALC.vehicleSection`): P_DL, M_DL at <section> → Dead Load · Dead load section forces (`o_dl`, sub-heading). Anchor `` `Share columns are blank where the total passes through zero.</div>`+ ``.
  6. Earth Pressure tab, "Sensitivity of the rating to K": reported RF → Rating · <governing vehicle>. Anchor `§7.2.7.5B. The prescribed value is shaded.</div>`+`.
  7. Nodal Results tab, "Influence line summary": moment influence ordinates → Influence Lines · Influence coefficient table — moment. Anchor `into the two numbers that tell you where load has to sit to hurt a given section.</div>`+`.
- **Calculation report:** `archCalcSheet` records each subsection's §n.k by panel id, `h3` `data-cid` and `<section cid>|<h4 title>`, and rewrites:
  - "Worked in" links to "<value>: see §n.k" (PDF links). A target left out of the printout reads "<value>: see the <Tab> tab (<Panel>; not in this printout)".
  - the dashboard's existing "<vehicle> rating factor" jumps (`a.jump[data-go]`, which work only on screen) get "(see §8.k)" after them, or "(worked section not in this printout)".
  - Links 2 and 3 are on panels that the report does not print, so they are in-app only.
- **Provision:** none. No result changed.
- **Check case (default project, all options):**
  - The report prints "RF 0.451: see §8.11" (dashboard); "(see §8.1)" … "(see §8.11)" in the dashboard rows; "P_DL, M_DL at SL-L: see §6.2" in each of the 11 vehicle sections; "RF 0.690: see §8.1" … in §9; "reported RF 0.451: see §8.11" in §11.6; and "moment influence ordinates: see §12.7" in §13.6.
  - The report DOM has 134 internal links, none broken.
  - With Dead Load and the EV3 detail deselected: "P_DL, M_DL at SL-L: see the Dead Load tab (Dead load section forces; not in this printout)", "RF 0.451: see the Rating tab (EV3 (Inv basis); not in this printout)", and the EV3 result line reads "worked section not in this printout".
- **Verification (both entries):**
  - `node tests/check-syntax.mjs "Stone Masonry Arch Load Rating.html"`: all 15 scripts pass.
  - `node tests/compare.mjs --tool page --file "Stone Masonry Arch Load Rating.html"`:
    - page.storage is the same;
    - page.text differs by exactly one line, the new "Worked in: RF 0.451 → Rating · EV3 (Inv basis)".
    - The kit does not route this tool's jsdelivr KaTeX / cdn.plot.ly URLs, so both sides run without libraries there.
  - **Main vs branch with KaTeX 0.16.9 and Plotly 2.27.0** (the pinned versions, files from `tests/libs`), routed for this tool's URLs.
    - Five cases:
      1. default;
      2. railroad mode (10 rail vehicles, t_ws 0);
      3. pinned + 2% grade + cover 3.5 ft + local impact + adverse-only placement + SDL items + 30 ft barrel;
      4. parabolic 30/6 ft, 18/30 in ring, one lane, tire-patch spread, Bernoulli, f_a 180, cover 1.5 ft, slab shallow-fill width, K 0.30;
      5. grade by springing covers 13/15 ft, shear check f_v 40, 16 ft barrel.
    - Identical in every case:
      - `ARCH.rateVehicle` for every selected vehicle at full precision (rf, tons, sec, pos, dir);
      - the model arrays (DL, ILM, ILC, ILV, depths, nodes, DL components);
      - `snapshot()`;
      - the `stoneArchLR.*` localStorage;
      - the text of all 13 output tabs (with the new "Worked in" lines removed).
    - The one exception is the Influence Lines tab line of fix 1, "kip\cdotpft²" → "kip⋅ft²". Normalising that line makes it identical too.
    - 0 console errors, no dialogs.
  - In-app click test (headless):
    - Each link type opens the right tab: dashboard, Vehicles, Rating DL, Earth Pressure and Live Load → Rating or Dead Load or Influence Lines, as listed above.
    - The EV3 panel, collapsed beforehand, opens and lands just below the sticky tab bar.
    - The DL link lands on the "Dead load section forces" heading.
    - At 420 px the target lands 6 px below the bar.
  - Print refresh: `beforeprint` with no report built builds one (cover and page CSS present). After changing the project name and f_a (250 → 300 psi), it rebuilt the report: the cover read RF 0.745 instead of 0.451, and the page CSS carried the new name.
  - Headless Chromium PDF (print media, `preferCSSPageSize`), with the title block blank and filled. Pages checked: cover; references and TOC; Summary Dashboard; §8.1; the §8 result block; §9.1; §12.1–12.2; Certification; the header and footer boxes. pdftotext shows no raw TeX after fix 1.
- **Other copies:** none. The report builder and the link helper are specific to this tool.
- **Open items (not changed):**
  - **Project No.** There is no field, so it prints "—" on the cover and in every page header. Add an optional `tbProjNo` (a new key in `snapshot().title`, absent in old files), or leave it as is? Engineer to decide.
  - **Live Load tab, panel "How the load spreads through the fill":**
    - It works the vehicle selected in the focus bar (`animVehId`) at the *governing vehicle's* position (`gv.pos`, `gv.dir`), and its message says "worked for <that vehicle> — the governing vehicle — at its governing position".
    - When the focus-bar vehicle is not the governing one, the label is wrong (another vehicle at a position found for the governing vehicle).
    - The printed report (§7) uses the governing vehicle and its own position, so it is consistent.
    - Screen wording or behaviour only; no rating uses it. Not changed. Which is intended?
  - **Dashboard jumps.** The existing "<vehicle> rating factor" jumps (`data-go`) still use `scrollIntoView`, so the panel header lands under the sticky tab bar. The new links avoid this. Not changed (existing behaviour); they could route through `archGoto`.
  - **Section order.** The report keeps its existing section order: Rating Summary (§15) prints after the Midas verification (§14), and Mesh Convergence after it.

## 2026-10-19 — PR: claude/aashto10-stone-arch (PR #332: https://github.com/mlococo88/All-Structural/pull/332)

Line numbers are approximate, as of this fix. Search for the anchor text.

### SA-A10: LRFD fill spread credit below 2 ft: 1.0H → 1.15H (AASHTO LRFD 10th Ed. Table 3.6.1.2.6a-1)   [calc change, optional input only] [less conservative where it acts]
- **Where:**
  1. `inputPanel()`, select `shallowRate` (≈ line 9718). Anchor: `sel("shallowRate",[`
  2. `restore()`, after the `shallowRule==="spread"` mapping (≈ line 12300). Anchor: `o.fields.shallowRate="1.75";`
  3. Notice flag (≈ line 9618). Anchor: `let unitMigrated=null, tieReverted=null`
  4. `showAutoInfo()`, new `sMsg` notice (≈ line 12426). Anchor: `const uMsg=unitMigrated`
  5. `liveLoadSection()`, shallow-fill steps' reference (≈ line 7954). Anchor: `label:"Longitudinal spread length, shallow fill"`
  6. `ARCH_REFS`, AASHTO LRFD row (≈ line 12709). Anchor: `["AASHTO LRFD",`
  7. Comments in `ARCH` (≈ lines 1775 and 1944). Anchors: `"tire"  The tire contact area grown at 1.75H`, `r = 0      no credit.`
- **Problem:** the option "1.0H both directions — LRFD 3.6.1.2.6 rate" used 1.0, an earlier LRFD rate for fill that is not select granular. In the 10th Ed., Table 3.6.1.2.6a-1 gives LLDF = 1.15 for all culverts and buried structures other than concrete pipe, with no fill-type distinction (1.15 to 1.75 applies only to concrete pipe, 2 ft to 8 ft diameter). The footprint grows from the tire patch, 20 in wide by 10 in long (Art. 3.6.1.2.5; w_t, l_t in Art. 3.6.1.2.6b), which the tool already uses (TIRE_W = 20/12, TIRE_L = 10/12). Where the option is selected and an axle lands over less than 2 ft of cover, the spread is now wider, so the pressure is lower: **less conservative**.
- **Governing provision:** AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): Art. 3.6.1.2.6a, Table 3.6.1.2.6a-1; Art. 3.6.1.2.6b, Eqs. 3.6.1.2.6b-1 to -6 (patch length and width, interaction depths); Art. 3.6.1.2.5 (tire contact area).
- **Before / After:**
  1. Select option. Before:
     ```js
               ["1","1.0H both directions — LRFD 3.6.1.2.6 rate"],
     ```
     After:
     ```js
               ["1.15","1.15H both directions — AASHTO LRFD 10th Ed. Table 3.6.1.2.6a-1 LLDF"],
     ```
     The option value is the rate itself (`shallowRate(p)` reads `+p.shallowRate`), so no other calculation code changes. The solver (`nodalLL`, shallow branch: `sL=TIRE_L+r*h, wt2=TIRE_W+r*h`) and every report that prints the rate (`nfx(rateSh,2)`) pick up 1.15.
  2. `restore()`, inserted after `o.fields.shallowRate="1.75";` (migration of saved data, CLAUDE.md §5):
     ```js
       rateUpdated=false;
       if(o.fields&&o.fields.shallowRate!=null&&String(o.fields.shallowRate).trim()!==""&&+o.fields.shallowRate===1){
         o.fields.shallowRate="1.15"; rateUpdated=true;
       }
     ```
     (with a comment). Without it, a saved "1" has no matching option, the select reads "", and the file would open with **no** credit (rate 0). Keys and file format are unchanged; only the value "1" is mapped to the option that replaced it.
  3. Before: `let unitMigrated=null, tieReverted=null;` After: `let unitMigrated=null, tieReverted=null, rateUpdated=false;`
  4. `showAutoInfo()`: new `const sMsg=rateUpdated ? '<div class="warn" …><b>Fill spread credit updated on opening.</b> …</div>' : "";` placed before `const uMsg=unitMigrated`, and both `e.innerHTML=rMsg+uMsg+…` lines become `e.innerHTML=rMsg+sMsg+uMsg+…`. The notice says the file used 1.0H, that it is now 1.15H per the 10th Ed. table, and to check the rating against the earlier one.
  5. Before: both shallow-fill steps had `ref:"credited dispersion"`. After: `const refSh=(Math.abs(rateSh-1.15)<1e-9)?"credited dispersion; LLDF 1.15, AASHTO LRFD 10th Ed. Table 3.6.1.2.6a-1":"credited dispersion";` and `ref:refSh` on both steps.
  6. Before: `["AASHTO LRFD","Art. 3.6.1.2.6, cited only for the optional \"tire patch + 1.75H\" spread basis. Edition: verify."],`
     After: `["AASHTO LRFD","AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): Art. 3.6.1.2.6a and Table 3.6.1.2.6a-1 (LLDF = 1.15 for culverts and buried structures other than concrete pipe: the optional 1.15H fill spread credit below 2 ft), Art. 3.6.1.2.5 (tire contact area 20 in wide by 10 in long), Art. 3.6.1.2.6b (wheel interaction: the wheel-line merge over the outside limits; axle interaction is not reached below 2 ft). The optional \"tire patch + 1.75H\" basis at 2 ft or more takes the LRFD tire-patch footprint form with the Std. Spec. 6.4.2 rate of 1.75, not the LRFD LLDF."],` (split over lines with `+`).
  7. Comments only: the "tire" deep basis is described as the LRFD tire-patch form at the Std. Spec. rate of 1.75 (not "the LRFD 3.6.1.2.6 form"); the `r = 1.0` line of the rate list becomes `r = 1.15` with the 10th Ed. citation, the migration, the D_i open item and the interaction-depth note.
- **Interaction depths (verified, no code change):** across the span, Eq. 3.6.1.2.6b-1 (H_int-t) is the depth at which adjacent wheel patches meet; the tool's merge of wheel lines over their outside limits once w_t reaches the gap (`transDisp`, `wt2>=GAGE`) is the same test: H ≥ (gap − 20/12)/1.15 = 3.77 ft for the 6 ft gage and 2.03 ft for the default 4 ft gap between trucks, so for default inputs it is not reached in the < 2 ft branch. Along the span, H_int-p = (s_a − 10/12)/1.15 ≥ 2.75 ft for the 4 ft minimum axle spacing of the tool's vehicles: not reached below 2 ft; the tool superposes axle patches (unchanged).
- **Unchanged:** the default (0, no credit); the 1.75H option; the Std. Spec. 6.4.2 branch at 2 ft or more (both "std" and "tire" bases); MBE, MassDOT, AREMA and Std. Spec. items; impact (Std. Spec. 3.8.2.3).
- **Check cases** (H20/HS20 legal loads; one wheel = 16 k of the 32 k axle; pressure without impact; t_ws = 0 so H is the fill):
  - **H = 1.5 ft (option acts).** Before (1.0H): L_s = 10/12 + 1.0 × 1.5 = 2.333 ft; w_t = 20/12 + 1.0 × 1.5 = 3.167 ft (< 6 ft gage, separate wheel lines); p = 16/(2.333 × 3.167) = 2.165 ksf. After (1.15H): L_s = 0.833 + 1.15 × 1.5 = 2.558 ft; w_t = 1.667 + 1.725 = 3.392 ft; p = 16/(2.558 × 3.392) = 16/8.677 = 1.844 ksf (−14.8 %). The Nodal Results row at the crown shows H 1.500, L_s 2.558, w_t 3.392, area 8.677, "6.4.1 at 1.15H".
  - Rating, span 20 ft, rise 5 ft, ring 12 in, crown cover 1.5 ft, springing cover 2.5 ft, otherwise defaults, option selected: H20 RF 0.3848 → 0.4327; HS20 0.3848 → 0.4333; Type 3, 3S2, 3-3, SU4, EV3 unchanged (their governing positions are not affected). Default 40/10 ft arch with 1.5 ft crown cover: all RF unchanged.
  - **H = 3 ft (option does not act).** The < 2 ft credit does not apply; the Std. Spec. 6.4.2 branch governs before and after: L_s = w_t = 1.75 × 3 = 5.25 ft (std basis), p = 16/5.25² = 0.580 ksf; all RF identical (H20 0.8342, HS20 0.7456 on the default arch). For reference only, the 10th Ed. form at 3 ft would be l_w = 0.833 + 3.45 = 4.283 ft, w_w = 1.667 + 3.45 = 5.117 ft (+ 0.06 D_i/12; H < H_int-t = 3.77 ft), p = 16/(4.283 × 5.117) = 0.730 ksf. Not implemented: the tool rates at 2 ft or more to Std. Spec. 6.4.2.
- **How verified:**
  - `node tests/check-syntax.mjs "Stone Masonry Arch Load Rating.html"`: all scripts pass.
  - `node tests/compare.mjs --tool page --file "Stone Masonry Arch Load Rating.html"`: page.text and page.storage identical (default rate 0).
  - Headless, main with "1" vs branch with "1.15", through `__restoreForTest`: crown H, branch, L_s, w_t and the wheel pressure above; `ARCH.rateVehicle` for H20, HS20, T3, T3S2, T33, SU4, EV3 at covers 1.5 ft and 3.0 ft (results above). Nodal Results and Live Load tab text read back (values above; the step reference shows the 10th Ed. table).
  - Migration: a snapshot with `shallowRate: "1"` restored on the branch: select "1.15", model rate 1.15, the next snapshot saves "1.15", the notice "Fill spread credit updated on opening" shows; H20/HS20 RF equal those of a fresh 1.15 run.
- **Other copies:** none.
- **Needs engineer:**
  1. **D_i term.** 10th Ed. Eqs. 3.6.1.2.6b-1 to -3 add 0.06 D_i/12 (D_i = clear span, in.) to the patch width. Not applied: it is a structural load-sharing width of the same kind as E = 4 + 0.06S, which this tool deliberately does not credit to an unreinforced ring. For a 20 ft span it would add 1.2 ft to w_t. Apply it with the 1.15H option, or not?
  2. **Fill under 1.0 ft.** 10th Ed. 3.6.1.2.6a applies the spread to nonconcrete culverts with 1.0 ft of fill or more. The option credits 1.15H at any cover below 2 ft, including under 1.0 ft. Limit it to H ≥ 1.0 ft?
  3. **"Tire patch + 1.75H" basis at 2 ft or more.** It combines the LRFD footprint form with the Std. Spec. rate; the 10th Ed. rate for this structure type would be 1.15 (with the interaction-depth merge and the D_i term). Left unchanged and relabelled. Should it stay as is?
  4. **Assumptions note "No article authorizes a spread at that depth"** (shown when a credit is taken below 2 ft): true for the Std. Spec. framework the tool rates to, but 10th Ed. 3.6.1.2.6a does give a spread for nonconcrete culverts with 1.0–2.0 ft of fill. Reword when the 1.15H option is selected?
- **Resolved 2026-10-19 (engineer):** 1 not applied; 2 limit to H ≥ 1.0 ft; 3 keep; 4 reword. Done in SA-A10b below.

## 2026-10-19 — PR: claude/aashto10-stone-arch-2 (PR #345: https://github.com/mlococo88/All-Structural/pull/345)

Line numbers are approximate, as of this fix. Search for the anchor text.

### SA-A10b: LRFD 1.15H credit only where the cover at the axle is ≥ 1.0 ft; D_i term and assumptions note stated   [calc change, 1.15H option only] [more conservative where it acts]
- **Engineer decisions (2026-10-19), on the open items of SA-A10:**
  1. Credit 1.15H only at H ≥ 1.0 ft (10th Ed. Art. 3.6.1.2.6a). Below that there is no spread, and the derivation says why.
  2. The 0.06 D_i/12 term is not applied; this is stated in the assumptions.
  3. The "tire patch + 1.75H" basis stays as it is.
  4. The note "No article authorizes a spread at that depth" is reworded for the 1.15H option.
- **Provision verified:** AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Art. 3.6.1.2.6a. The distribution procedure applies to all nonconcrete culverts with 1.0 ft of fill or more (and to the concrete culverts named in that article). LLDF is from Table 3.6.1.2.6a-1. The D_i term is in Eqs. 3.6.1.2.6b-1 to -3. For a nonconcrete culvert under less than 1.0 ft of fill, the article gives no spread.
- **Problem:** with the 1.15H option, SA-A10 spread every axle landing under 2 ft of cover, including under 1.0 ft, where the LRFD spread does not apply. Such an axle now takes no spread. It is carried exactly as with no credit: a concentrated strip load over the width E of the shallow-fill width selector (the tire width 20 in by default, or E = 4 + 0.06S). This is **more conservative** for axles over < 1.0 ft of cover. Nothing changes at 1.0 ft or more, with no credit, or with the 1.75H option.
- **Where / Before / After:**
  1. `ARCH`, after `function shallowRate(p){…}` (anchor `function shallowRate(p){`). Added:
     ```js
     const LRFD_RATE=1.15, LRFD_MIN_FILL=1.0;
     function isLrfdRate(r){return Math.abs(r-LRFD_RATE)<1e-9;}
     function rateAt(p,H){
       const r=shallowRate(p);
       return (isLrfdRate(r)&&H!=null&&H<LRFD_MIN_FILL)?0:r;
     }
     ```
     `rateAt`, `isLrfdRate` and `LRFD_MIN_FILL` are exported from `ARCH` (anchor `SHALLOW_FILL,slabWidthE,shallowWidth,shallowRate,`).
  2. `llRegime` (anchor `function llRegime(model,x){`).
     - Before: `const r=shallowRate(model.p);`
     - After: `const r=rateAt(model.p,H);` plus `const lrfdCut=isLrfdRate(shallowRate(model.p))&&H!=null&&H<LRFD_MIN_FILL;`, returned as `lrfdCut`. H is the cover where the axle lands, which is the station the regime is already decided at.
  3. `sideBySideAt` (anchor `function sideBySideAt(p,H){`).
     - Before: `const r=shallowRate(p);`
     - After: `const r=rateAt(p,H);`
  4. `nodalLL` (anchor `const disp=[],conc=[];`). Each 6.4.1 axle carries its own `r`.
     - Before:
       ```js
         (llRegime(model,xa).conc?conc:disp).push({ax,xa});
       …
         if(conc.length){
           const r=shallowRate(model.p);
           if(r<=0){ …addConc… }else{ …spread loop over conc… }
         }
       ```
     - After:
       ```js
         const rg=llRegime(model,xa);
         (rg.conc?conc:disp).push({ax,xa,r:rg.r});
       …
         const concPt=conc.filter(a=>a.r<=0), concSp=conc.filter(a=>a.r>0);
         if(concPt.length){ const E=shallowWidth(model.p), kC=sideBySide(model.p,E,true).kappa;
           for(const a of concPt)addConc(model,q,a.xa,stripLoadConc(a.ax.P,E)*kC); }
         if(concSp.length){ const r=concSp[0].r; …same spread loop over concSp… }
       ```
     - With all axles in one group (no credit, 1.75H, or 1.15H with every 6.4.1 axle on ≥ 1.0 ft), the arithmetic and its order are the same as before. `nodalLLByAxle` already decides per axle from `rg.r`, so it follows without a change; checked against `nodalLL` (below).
  5. Live Load figure, `stateAt` (anchor `if(rg.conc){shallow=true; rate=rg.r; Esh=rg.E; break;}`). Added `if(shallow&&H!=null&&ARCH.rateAt(p,H)<=0)rate=0;`, so a node under < 1.0 ft is drawn with the footprint, as the solver loads it.
  6. `validate()` assumptions note (anchor `credited below the ${nfx(ARCH.SHALLOW_FILL,1)} ft threshold, in both directions.`). With the 1.15H option, the sentence "No article authorizes a spread at that depth …" is replaced by text saying:
     - the Std. Spec. (the basis of this rating) has no spread below 2 ft;
     - 1.15H comes from LRFD 10th Ed. Table 3.6.1.2.6a-1 and applies at 1.0 ft or more (Art. 3.6.1.2.6a);
     - an axle over less takes no spread (and the least cover is named when it is below 1.0 ft);
     - the 0.06 D_i/12 term is omitted, as a load-sharing width like E = 4 + 0.06S;
     - an LRFD distribution inside a Std. Spec. / MBE rating is a stated choice.

     The other rates keep the old wording.
  7. `liveLoadSection()` (anchor `label:"Transverse spread width, shallow fill"`). With 1.15H:
     - the transverse-width note adds the D_i statement;
     - a new step, "Least fill for the LRFD spread" (H_ax ≥ 1.0 ft vs H_min, ref. AASHTO LRFD 10th Ed. Art. 3.6.1.2.6a), says why no spread is taken below 1.0 ft and names the width E used there;
     - the concentrated-axle equation and note (anchor `if(rateSh<=0){`) are now also shown when 1.15H is selected and part of the barrel is under 1.0 ft. Condition before: `rateSh<=0`. After: `rateSh<=0||(ARCH.isLrfdRate(rateSh)&&covMinH<ARCH.LRFD_MIN_FILL)`.
  8. Comment in the rate list (anchor `r = 1.15   AASHTO LRFD 10th Ed.`): the D_i item and the 1.0 ft limit are recorded as the engineer's decisions.
- **Saved data:** none changed (no key, no field, no option value).
- **Check cases** (H20/HS20 legal loads; one wheel = 16 k of the 32 k axle; pressure without impact; t_ws = 0; span 20 ft, rise 5 ft, 12 in ring, springing cover 2.5 ft; HS20 middle axle at the crown node, tributary length 2.489 ft; 1.15H option):
  - **H = 0.75 ft (changed).**
    - Before: L_s = 10/12 + 1.15 × 0.75 = 1.696 ft; w_t = 20/12 + 0.8625 = 2.529 ft; p = 16/(1.696 × 2.529) = 3.731 ksf over L_s. Strip load at the node = 3.731 × 1.696 = 16/2.529 = 6.326 kip.
    - After: no spread, so the concentrated strip load is w = (P_ax/2)/E = 16/1.667 = 9.600 kip (E = b_t = 20 in; E < 6 ft gage), on the crown node. Tool: q = 6.32619 → 9.6 kip at the crown; nodal pressure 2.5414 → 3.8566 ksf (9.6/2.489).
    - RF: H20 0.2493 → 0.1587; HS20 0.2493 → 0.1587; T3 0.3813 → 0.2846; T3S2 0.4182 → 0.3122; T33 0.463 → 0.3176; SU4 0.3813 → 0.2851; EV3 0.2091 → 0.1561. These equal neither the no-credit RF (H20 0.1302) nor the old 1.15H RF: axles over 1.0–2.0 ft of cover still take 1.15H.
    - With the slab width (E = 4 + 0.06 × 20 = 5.2 ft): w = 16/5.2 = 3.077 kip per wheel line; the 24 ft barrel carries 2 lanes, and the adjacent trucks' wheel lines 4 ft apart lie within E, so they superimpose (κ = 2): 6.154 kip. Crown q 6.326 → 6.154 kip; HS20 0.2493 → 0.2476, SU6 0.4519 → 0.4799 (the slab width shares more than the 1.15H spread, so some RF rise).
  - **H = 1.5 ft (unchanged).** L_s = 0.833 + 1.725 = 2.558 ft; w_t = 1.667 + 1.725 = 3.392 ft; p = 16/(2.558 × 3.392) = 1.844 ksf before and after. Tool crown pressure 1.844 ksf both; all RF identical (H20 0.4327, HS20 0.4333).
- **How verified:**
  - `node tests/check-syntax.mjs "Stone Masonry Arch Load Rating.html"`: all scripts pass.
  - `node tests/compare.mjs --tool page --file "Stone Masonry Arch Load Rating.html"`: page.text and page.storage identical.
  - Headless, main vs branch, through `__restoreForTest`; `ARCH.nodalLL` (HS20 at the crown) and `ARCH.rateVehicle` for all 11 highway vehicles:
    - Identical: default; default arch with 1.15H at 1.5 ft; 20/5 arch with 1.15H at 1.5 ft; 1.75H at 0.75 ft; no credit at 0.75 ft.
    - Different only as above: 1.15H at 0.75 ft, with the tire width and with the slab width.
  - `nodalLLByAxle` vs `nodalLL` at 0.75 ft with 1.15H, every vehicle, positions −40 to 30 ft at 0.7 ft steps, both directions: max |Σ axQ − q| = 2.2e−16.
  - Live Load tab text read back: the new step, the concentrated-axle equation and the D_i note. Summary assumptions text read back. The figure's "Spread at cut" at the crown reads w_t 1.67 ft (the footprint).
- **Other copies:** none.
- **Open items (noticed, not changed):**
  - **Live Load tab, "Worked example — node …, the most heavily loaded node"** (anchor `const reg=ARCH.llRegime(M,xa);` in `liveLoadSection`). Every axle with `reg.conc` is worked as a concentrated strip load, even when a spread credit (1.15H or 1.75H) is in force and the solver spreads it. Already so on main for any credit; this change does not affect it. The printed contributions can differ from the solver's nodal load when a credit is selected.
  - **Node worked calculation (Nodal Results), note on 6.4.1 axles** (anchor `axles land on cover shallower than`). It says those axles are "not dispersed through the fill" even when a credit spreads them. Wording only; already so on main.
  - **Live Load figure with mixed regimes:** the figure still takes the rate of the first 6.4.1 axle for the whole cut, now corrected only by the node's own cover (item 5).

## 2026-11-01 — PR: claude/rpt-stonearch — Report output tab in the shared report viewer (ARPT; display only, no calculation change) (PR #547: https://github.com/mlococo88/All-Structural/pull/547)

Line numbers are approximate; search for the anchor text. Every code site is tagged `ARPT`.

### ARPT. "Report" output tab (shared/report.js, shared/steps.js)   [display only]
- **Engineer request (2026-11-01, report rollout):** a Report output tab in the shared viewer used by the Steel Bridge app and Spread Footing: navigation tree to topic level, numbered sections §n.m, worked steps (equation → substituted values → result, CLAUDE.md §6), steps grouped by topic, "see §x.y" links and links back to the tabs, print with a title block (no owner cell), running header and page numbers.
- **Loads:** `<script src="shared/steps.js">` and `<script src="shared/report.js">` (classic scripts, relative path) after the CDN libraries. The tool now needs the `shared` folder next to it. Without it only the Report tab shows a message; every other tab is unaffected. KaTeX 0.16.9 (already loaded by the tool) sets the worked steps.
- **How the model is made (nothing recomputed):**
  - `R.step()` / `R.eqLine()` (anchor `function cap(o){`): while `window.__archRptCap` is an array (only while the Report tab builds), each call also records its own arguments (label, ref, sym, sub, res, units, note) and tags its div `data-cap="<index>"`. Otherwise the returned HTML is byte-for-byte as before.
  - `archReportModel(p)` calls `buildOutput(p)` once more (and `ratingSummary(p)`, which the Rating Summary tab builds on demand) with the recorder on, puts the panes in an off-screen box, draws the figures with the D11 report's own calls (`VEHTAB.draw`, `MODELFIG.draw`, `drawReportFigures`), and walks the panes in order: tab → section, top-level panel → subsection, h3/h4/h5 heading or nested panel → topic (an h5 directly over a table becomes the table's caption), step → `SharedSteps` step, table → table (more than 14 rows: closed, `lazy`), message box / note / paragraph / list → note, figure → SVG figure.
  - A step's value is the result exactly as the tab prints it (`res`): a plain number becomes the value with the same decimals; anything else (a pair, an inequality, text) stays in the substitution line, as on the tab. Units of a non-numeric result are written as the tab writes them.
  - "Worked in" links (`a.wkA`) and the dashboard's jump links become "see §x.y" (the first worked step of that panel, when it has one) plus a link back to the tab and panel (`archGoto`).
  - TeX in running text (notes, table cells, titles) goes through the SharedSteps built-in renderer (shared/report.js), so `arptTex()` writes the few commands outside its subset in it (`\dfrac`→`\frac`, `\mathbf{x}`→x, `\quad`→thin space, `\Phi`→Φ, …). Worked steps keep their TeX (KaTeX).
- **Sections:** 1 Project and inputs (the D11 input echo, `archInputRows`), 2 Summary, 3 Model, 4 Dead Load, 5 Live Load, 6 Vehicles, 7 Earth Pressure, 8 Diagrams, 9 Influence Lines, 10 Rating, 11 Rating Summary, 12 Nodal Results, 13 Verification, 14 References (`ARCH_REFS`). The Manual is not repeated (link to the Manual tab).
- **Refactor (no result change):** the input-echo rows of `buildReport` moved unchanged into `archInputRows(p)`; `buildReport` and the Report tab both call it. Checked: D11 print report text identical main vs branch on 4 projects.
- **Print:**
  - The viewer's "Print report" button prints the report alone: title block Project / Project No. (—, the tool has no such field) / Subject / Computed by / Date / Task / Checked by / Checked date / Program (no owner cell), cover, contents, running header "Project No. — — <subject>" / "Computed … · Checked …", footer and "Page X of Y".
  - Ctrl+P while the Report tab is shown prints the report too; `archRptWillPrint()` makes the D11 `beforeprint` handler stand aside, and the D11 `@page` style (`#arch-page`, if a D11 report was built earlier) is emptied for that print and restored after.
  - The "Print / PDF Report" button (report modal) still prints the D11 report, also from the Report tab (`window.__archD11Print`). From any other tab Ctrl+P prints the D11 report as before.
- **Saved data:** nothing new is saved. `activeTab` may now be `"rpt"` (saved in the existing `tab` field of the autosave / project file, as for any tab); an older copy of the tool opening such a file shows no tab selected until a tab is clicked. The viewer's collapsed sections are kept in memory only (`ARPT.closed`).
- **Shared file:** `shared/report.js` gains two backward-compatible options (see `fixlog/shared-report.md`, 2026-11-01): `topic` on any item, `lazy` on a table.
- **How verified (headless Chromium, pinned KaTeX 0.16.9 and Plotly 2.27.0 served locally):** see the PR description for the counts. Per project (default; pinned parabolic 60/12 ft, 20 elements, 2% grade, rating at each vehicle's own section; adverse influence + local impact + Bernoulli + 20/30 in ring + K = 0.4; railroad loading):
  - 0 unresolved or duplicate references, 0 KaTeX errors, no NaN / undefined in `SharedReport.text()`, 0 console errors;
  - the rating factor, rating in tons and gross weight of every vehicle, n_el, the number of load cases and n_dof in the report equal the app's (`results`, `secResults` at the selected section, `M`);
  - main vs branch: the text of every other tab is identical, also after the Report tab has been built; the D11 print report text is identical (the Rating Summary's "Computed in x s" timing note is masked: it depends on machine load);
  - Ctrl+P on the Report tab: `body.rp-printing`, the report alone, the shared running header, no D11 header (PDF checked).
  - `node tests/check-syntax.mjs "Stone Masonry Arch Load Rating.html"` passes; `node tests/engine/run.mjs report steps steps-groups report-wiring` passes.
- **Other copies:** none. `shared/README.md` lists the tool as a user of `steps.js` and `report.js`.
- **Open items:**
  - At 390 px the tool's two-panel layout does not stack, so the Report tab (like every tab) scrolls sideways; existing layout, not changed here (separate 390 px PR).
  - Building the report takes about 3 to 5 s (the panes are built a second time with the recorder on, ~2.4 MB of HTML); it is rebuilt on each input change only while the Report tab is shown.
  - Step values are the tab's printed results (rounded as printed), not full precision: the tool's `step()` receives formatted strings. Changing every call site to pass the number is a larger change; ask the engineer if wanted.
  - The tool's references carry "Edition: verify" for the MassDOT manual, MBE, Std. Spec. and AREMA (unchanged; listed in §14 of the report).

Diff (`Stone Masonry Arch Load Rating.html`, `git diff -U0` against origin/main):

```diff
diff --git a/Stone Masonry Arch Load Rating.html b/Stone Masonry Arch Load Rating.html
index 6ad01f0..62d34a2 100644
--- a/Stone Masonry Arch Load Rating.html	
+++ b/Stone Masonry Arch Load Rating.html	
@@ -9,0 +10,3 @@
+<!-- ARPT: shared worked steps and the shared report viewer (classic scripts, relative path: keep the shared folder next to this file) -->
+<script src="shared/steps.js"></script>
+<script src="shared/report.js"></script>
@@ -2755,0 +2759,8 @@ function setKatexReady(){katexReady=!!window.katex;}
+/* ARPT (2026-11-01): while the Report tab builds its model (window.__archRptCap is an array), every step and
+   equation line is also recorded as given (label, ref, sym, sub, res, units, note) and its div is tagged with the
+   record's index (data-cap), so the Report tab shows the same worked lines as the tabs. Otherwise nothing changes. */
+function cap(o){
+  const c=window.__archRptCap; if(!Array.isArray(c))return "";
+  c.push({label:o.label,ref:o.ref,sym:o.sym,sub:o.sub,res:o.res,units:o.units,note:o.note});
+  return ` data-cap="${c.length-1}"`;
+}
@@ -2774 +2785 @@ function step(o){
-  return `<div class="step">
+  return `<div class="step"${cap(o)}>
@@ -2782 +2793 @@ function eqLine(label,e,ref,note){
-  return `<div class="step">
+  return `<div class="step"${cap({label,sym:e,ref,note})}>
@@ -11449 +11460 @@ const TABS=[["sum","Summary"],["geo","Model"],["dl","Dead Load"],["ll","Live Loa
-            ["ver","Verification"],["man","Manual"]];
+            ["ver","Verification"],["rpt","Report"],["man","Manual"]];   /* rpt: ARPT Report tab */
@@ -11569,0 +11581 @@ function render(){
+  if(activeTab==="rpt")archRenderReport(p);   /* ARPT */
@@ -12651,0 +12664 @@ window.addEventListener("beforeprint",()=>{
+  if(archRptWillPrint())return;   /* ARPT: the Report tab prints itself (shared/report.js) */
@@ -12676,0 +12690 @@ function reportModal(){
+    window.__archD11Print=true;   /* ARPT: this print is the D11 report, also when the Report tab is shown */
@@ -12880,28 +12894,3 @@ function archCalcSheet(rh){
-function buildReport(sel){
-  const p=readP();
-  const t=id=>$(id)?esc($(id).value||"—"):"—";
-  let n=0; const N=()=>++n;
-  /* D11 (2026-10-18): cover page with the title block (it was the #rptHead box at the top of page 1).
-     The tool has no project-number field, so Project No. prints "—". The controlling line repeats the
-     dashboard's controlling result (same values). */
-  const gvC=results.length?results.reduce((a,b)=>a.rf<b.rf?a:b):null;
-  const vC=gvC?ARCH.ALL_VEHICLES.find(x=>x.id===gvC.id):null;
-  let h=`<section class="cr-cover"><div class="cr-cover-t">
-      <h1>Stone Masonry Arch Load Rating</h1>
-      <p>${$("tbProject")&&$("tbProject").value?esc($("tbProject").value):"Untitled"}</p>
-      ${$("tbSubject")&&$("tbSubject").value?`<p class="cr-cover-p">${esc($("tbSubject").value)}</p>`:""}
-      <p class="cr-cover-p">Allowable Stress Method, Inventory Level &middot; MassDOT Bridge Manual Part I §7.2.7 &middot;
-        AASHTO MBE Art. 6A.9.1 &middot; ${p.loadMode==="rail"?"AREMA Ch. 8 (railroad loading)":"AASHTO Std. Spec. Art. 6.4, 3.8.2.3"}
-        &middot; by Mario Lococo</p>`+
-    (gvC?`<p class="cr-cover-p">Controlling result: <b>${esc(vC.name)}, RF = ${nfx(gvC.rf,3)}</b>
-        (${nfx(gvC.tons,1)} tons${vC.eRef?`, E${(gvC.rf*vC.eRef).toFixed(0)}`:""}) at section ${esc(CALC.secTag(M,gvC.sec))}
-        &mdash; <b>${gvC.rf>=1?"all selected vehicles rate at or above 1.0":"at least one vehicle rates below 1.0"}</b></p>`:"")+
-    `</div>
-    <table class="cr-tb"><tr><td><b>Project:</b> ${t("tbProject")}</td><td><b>Project No.:</b> —</td><td><b>Subject:</b> ${t("tbSubject")}</td></tr>
-    <tr><td><b>Computed by:</b> ${t("tbBy")}</td><td><b>Date:</b> ${t("tbDate")}</td><td><b>Task:</b> ${t("tbTask")}</td></tr>
-    <tr><td><b>Checked by:</b> ${t("tbChk")}</td><td><b>Checked date:</b> ${t("tbChkDate")}</td><td><b>Program:</b> Stone Arch LR ${BUILD_ID}</td></tr></table>
-    </section><div class="rpt">`;
-
-  const sec=(title,body,cid)=>`<h2${cid?` data-cid="${cid}"`:""}>${N()}. ${title}</h2>${body}`;
-
-  if(sel.r_inputs){
+/* The input echo: one row per input as entered, {k, v, u} (moved unchanged from buildReport, ARPT 2026-11-01;
+   the D11 print report and the Report tab both call it). */
+function archInputRows(p){
@@ -13019,0 +13009,31 @@ function buildReport(sel){
+  return rows;
+}
+function buildReport(sel){
+  const p=readP();
+  const t=id=>$(id)?esc($(id).value||"—"):"—";
+  let n=0; const N=()=>++n;
+  /* D11 (2026-10-18): cover page with the title block (it was the #rptHead box at the top of page 1).
+     The tool has no project-number field, so Project No. prints "—". The controlling line repeats the
+     dashboard's controlling result (same values). */
+  const gvC=results.length?results.reduce((a,b)=>a.rf<b.rf?a:b):null;
+  const vC=gvC?ARCH.ALL_VEHICLES.find(x=>x.id===gvC.id):null;
+  let h=`<section class="cr-cover"><div class="cr-cover-t">
+      <h1>Stone Masonry Arch Load Rating</h1>
+      <p>${$("tbProject")&&$("tbProject").value?esc($("tbProject").value):"Untitled"}</p>
+      ${$("tbSubject")&&$("tbSubject").value?`<p class="cr-cover-p">${esc($("tbSubject").value)}</p>`:""}
+      <p class="cr-cover-p">Allowable Stress Method, Inventory Level &middot; MassDOT Bridge Manual Part I §7.2.7 &middot;
+        AASHTO MBE Art. 6A.9.1 &middot; ${p.loadMode==="rail"?"AREMA Ch. 8 (railroad loading)":"AASHTO Std. Spec. Art. 6.4, 3.8.2.3"}
+        &middot; by Mario Lococo</p>`+
+    (gvC?`<p class="cr-cover-p">Controlling result: <b>${esc(vC.name)}, RF = ${nfx(gvC.rf,3)}</b>
+        (${nfx(gvC.tons,1)} tons${vC.eRef?`, E${(gvC.rf*vC.eRef).toFixed(0)}`:""}) at section ${esc(CALC.secTag(M,gvC.sec))}
+        &mdash; <b>${gvC.rf>=1?"all selected vehicles rate at or above 1.0":"at least one vehicle rates below 1.0"}</b></p>`:"")+
+    `</div>
+    <table class="cr-tb"><tr><td><b>Project:</b> ${t("tbProject")}</td><td><b>Project No.:</b> —</td><td><b>Subject:</b> ${t("tbSubject")}</td></tr>
+    <tr><td><b>Computed by:</b> ${t("tbBy")}</td><td><b>Date:</b> ${t("tbDate")}</td><td><b>Task:</b> ${t("tbTask")}</td></tr>
+    <tr><td><b>Checked by:</b> ${t("tbChk")}</td><td><b>Checked date:</b> ${t("tbChkDate")}</td><td><b>Program:</b> Stone Arch LR ${BUILD_ID}</td></tr></table>
+    </section><div class="rpt">`;
+
+  const sec=(title,body,cid)=>`<h2${cid?` data-cid="${cid}"`:""}>${N()}. ${title}</h2>${body}`;
+
+  if(sel.r_inputs){
+    const rows=archInputRows(p);   /* ARPT: the input echo rows, shared with the Report tab (moved unchanged) */
@@ -13143,0 +13164,235 @@ function buildReport(sel){
+/* ================= Report tab (ARPT, 2026-11-01) =================
+   The calculation report in the shared viewer (shared/report.js: navigation tree, numbered sections §n.m, collapse /
+   expand, search, Print with a title block, running header and page numbers; worked steps through shared/steps.js).
+   Nothing is computed here. The model is read from what the tabs themselves show: buildOutput(p) is called once more
+   with window.__archRptCap set, so every step() / eqLine() records its own label, reference, symbolic form,
+   substitution, result, units and note (R.step, ARPT) and tags its div; the panes' HTML is then walked in order:
+     tab -> report section, top-level panel -> subsection, panel heading h4 / h5 / nested panel -> topic,
+     step -> SharedSteps step (value: the result as the tab prints it), table -> table (long ones closed, lazy),
+     message box / note / paragraph -> note, figure -> SVG figure (drawn by the same functions as the D11 report).
+   "Worked in" links become "see §x.y" links (when the panel has worked steps in the report) and links back to the tab.
+   Nothing is saved: the viewer's collapsed sections are kept in memory only (ARPT.closed). */
+const ARPT={closed:new Set(),api:null,doc:null};
+const ARPT_TABS=[["sum","Summary"],["geo","Model"],["dl","Dead Load"],["ll","Live Load"],["veh","Vehicles"],["lat","Earth Pressure"],
+  ["diag","Diagrams"],["il","Influence Lines"],["rate","Rating"],["rsum","Rating Summary"],["nodes","Nodal Results"],["ver","Verification"]];
+/* TeX for the report's running text (titles, notes, table cells): shared/report.js sets it with the SharedSteps built-in
+   renderer (a TeX subset), so the few commands outside that subset are written in it. Worked steps keep their TeX as is
+   (KaTeX). */
+function arptTex(t){
+  let s=String(t==null?"":t);
+  for(let k=0;k<3;k++)s=s.replace(/\\(?:mathbf|boldsymbol|mathit|bm)\{([^{}]*)\}/g,"$1").replace(/\\(?:mathrm|mathsf|textrm|textbf|textit|operatorname)\{([^{}]*)\}/g,"\\text{$1}")
+    .replace(/\\hat\{([^{}]*)\}/g,"$1̂").replace(/\\(?:tilde|vec|dot)\{([^{}]*)\}/g,"$1");
+  return s.replace(/\\[dt]frac/g,"\\frac").replace(/\\(?:q?quad|enspace|;|:|!)/g,"\\,").replace(/\\(?:big|Big|bigg|Bigg)[lr]?/g,"")
+    .replace(/\\neq\b/g,"\\ne").replace(/\\leq\b/g,"\\le").replace(/\\geq\b/g,"\\ge").replace(/\\Rightarrow\b/g,"\\to").replace(/\\rightarrow\b/g,"\\to")
+    .replace(/\\displaystyle|\\limits|\\nolimits/g,"").replace(/\\equiv\b/g,"≡").replace(/\\forall\b/g,"∀").replace(/\\int\b/g,"∫")
+    .replace(/\\(Phi|nu|kappa|xi|zeta|Gamma|Lambda|Omega|Pi|Theta|varphi|epsilon|varepsilon)\b/g,(m,x)=>({Phi:"Φ",nu:"ν",kappa:"κ",xi:"ξ",zeta:"ζ",Gamma:"Γ",Lambda:"Λ",Omega:"Ω",Pi:"Π",Theta:"Θ",varphi:"φ",epsilon:"ε",varepsilon:"ε"}[x]))
+    .replace(/\\%/g,"%").replace(/\$/g,"");
+}
+/* the text of an inline run: KaTeX back to $source$, <sub>/<sup> as _{…}/^{…}, "Worked in" links as § / tab links; no $ of its own */
+function arptInline(n,ctx){
+  if(n.nodeType===3)return n.textContent.replace(/\$/g,"").replace(/\[\[/g,"[ [");
+  if(n.nodeType!==1)return "";
+  const e=n, cl=e.classList;
+  if(cl.contains("katex")||cl.contains("katex-display")){const a=e.querySelector("annotation");return a?"$"+arptTex(a.textContent)+"$":e.textContent;}
+  if(cl.contains("noprint")||/^(SELECT|INPUT|BUTTON|TEXTAREA|SCRIPT|STYLE|SVG|svg)$/.test(e.tagName))return "";
+  if(e.tagName==="BR")return " ";
+  if(e.tagName==="SUB"||e.tagName==="SUP"){const t=e.textContent.replace(/[$\\{}]/g,"").trim();return t?"$"+(e.tagName==="SUB"?"_":"^")+"{\\text{"+t+"}}$":"";}
+  if(e.tagName==="A"&&cl.contains("wkA")){
+    const tab=e.getAttribute("data-wtab")||"", card=e.getAttribute("data-wcard")||"", txt=e.getAttribute("data-txt");
+    const lab=e.textContent.split(" → ").pop().replace(/[|\]\[]/g," ");
+    ctx.links.push(card);
+    return (txt?txt.replace(/[\[\]|]/g," ")+": ":"")+"⟦card:"+card+"⟧ [[tab:"+tab+"~"+card+"~"+(e.getAttribute("data-wsub")||"").replace(/[~|\]\[]/g," ")+"|"+lab+"]]";
+  }
+  if(e.tagName==="A"&&cl.contains("jump")&&e.getAttribute("data-go")){
+    const card=e.getAttribute("data-go"); ctx.links.push(card);
+    return [...e.childNodes].map(c=>arptInline(c,ctx)).join("")+" ⟦card:"+card+"⟧";
+  }
+  return [...e.childNodes].map(c=>arptInline(c,ctx)).join("");
+}
+const arptClean=s=>String(s||"").replace(/\s+/g," ").replace(/\$\s*\$/g,"").trim();
+const ARPT_INLINE=/^(B|I|EM|STRONG|SPAN|A|SUB|SUP|CODE|SMALL|U|BR|KBD|SAMP|ABBR|MARK|S|Q|LABEL)$/;
+/* a recorded step -> a SharedSteps step. The value is the result exactly as the tab prints it: a plain number becomes a
+   number shown with the same decimals; anything else (a pair, an inequality, text) stays in the substitution line. */
+function arptStep(o,id){
+  const res=o.res==null?"":String(o.res).trim(), num1=/^-?\d+(\.\d+)?$/.test(res);
+  let sub=o.sub==null?"":String(o.sub);
+  if(res&&!num1)sub=sub?sub+" = "+res:res;
+  const u=o.units?String(o.units).replace(/\\cdot\s*/g,"-").replace(/·/g,"-").replace(/\\;/g,",\\ "):"";
+  let sym=o.sym||"";
+  if(u&&!num1){if(sub)sub+="\\ \\text{"+u+"}";else sym+="\\ \\text{"+u+"}";}   /* units of a non-numeric result: as the tab writes them */
+  const d=num1?(res.split(".")[1]||"").length:2;
+  const nt=document.createElement("div"); nt.innerHTML=o.note||"";
+  return SharedSteps.step({id,label:String(o.label||"").trim()||"Step",sym,eq:"",sub,value:num1?+res:null,unit:num1?u:"",d,
+    ref:o.ref||"",note:arptClean(nt.textContent).replace(/§(?=[A-Za-z])/g,"§ ")});
+}
+const arptSlug=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,36)||"step";
+/* a table element -> a report table (header: the last header row; badges -> cell status) */
+function arptTable(t,ctx){
+  const cell=c=>{const o={t:arptClean(arptInline(c,ctx))};
+    if(c.classList.contains("num")||c.classList.contains("v"))o.n=true;
+    const bd=c.querySelector(".badge"); if(bd)o.cls=bd.classList.contains("b-ok")?"ok":bd.classList.contains("b-bad")?"ng":bd.classList.contains("b-wn")?"hi":"na";
+    if(c.colSpan>1)o.span=c.colSpan; return o;};
+  const hr=t.tHead?[...t.tHead.rows]:[], body=[...t.querySelectorAll(":scope>tbody>tr,:scope>tfoot>tr,:scope>tr")];
+  let head=hr.length?[...hr[hr.length-1].cells].map(cell):[], rows=[];
+  hr.slice(0,-1).forEach(r=>rows.push({cells:[...r.cells].map(cell),cls:"gov"}));
+  if(!head.length&&body.length&&[...body[0].cells].every(c=>c.tagName==="TH")){head=[...body.shift().cells].map(cell);}
+  body.forEach(r=>{if(r.classList.contains("noprint"))return;const cs=[...r.cells].map(cell);if(!cs.length)return;
+    rows.push(r.classList.contains("gv")||r.classList.contains("rsGovRow")||r.classList.contains("sel")?{cells:cs,cls:"gov"}:cs);});
+  if(!head.length&&!rows.length)return null;
+  const it={type:"table",head,rows,wide:(head.length||0)>4};
+  return it;
+}
+/* one panel body -> items; topics at h3 / h4 / h5 and nested panels */
+function arptItems(body,scope,cap,ctx){
+  const items=[], ids=new Map();
+  let buf="", run=null, pend=null, tp=null, no=0, last=null, capt="";
+  const push=it=>{if(pend){it.topic=pend;pend=null;}items.push(it);last=it;return it;};
+  const flushTxt=()=>{const t=arptClean(buf);buf="";if(t)push({type:"note",text:t});};
+  const endRun=()=>{run=null;};
+  const topic=title=>{flushTxt();endRun();const t=arptClean(title);if(!t)return;no++;tp={no,title:t,steps:[]};ctx.topics.push(tp);pend=tp;};
+  const addStep=div=>{
+    flushTxt();
+    const k=+div.getAttribute("data-cap"), o=cap[k]; if(!o)return;
+    const base=arptSlug(o.label), n=(ids.get(base)||0)+1; ids.set(base,n);
+    const st=arptStep(o,base+(n>1?"-"+n:""));
+    if(!run){run={type:"steps",scope,steps:[]};push(run);}
+    run.steps.push(st); if(tp)tp.steps.push(st);
+    if(!ctx.first)ctx.first=SharedReport.keyOf(scope,st.id);
+  };
+  const walk=el=>{
+    for(const n of [...el.childNodes]){
+      if(n.nodeType!==1){buf+=arptInline(n,ctx);continue;}
+      const e=n, cl=e.classList, tag=e.tagName;
+      if(cl.contains("noprint")||cl.contains("btnrow")||cl.contains("figbar")||/^(SELECT|INPUT|BUTTON|TEXTAREA|SCRIPT|STYLE)$/.test(tag))continue;
+      if(cl.contains("step")){addStep(e);continue;}
+      if(cl.contains("pnl")||cl.contains("sub")){const hd=e.querySelector(":scope>.hd"), sp=hd&&hd.children[1];
+        topic((sp?sp.textContent:hd?hd.textContent:"").replace(/^\d+(\.\d+)*\.\s*/,""));
+        const tg=hd&&hd.querySelector(".tag"); if(tg&&arptClean(tg.textContent)&&arptClean(tg.textContent)!=="—")buf+=arptClean(tg.textContent)+" ";
+        if(e.id)ctx.cards.push(e.id);
+        const bd=e.querySelector(":scope>.bd"); if(bd)walk(bd); flushTxt(); continue;}
+      if(/^H[56]$/.test(tag)&&e.nextElementSibling&&(e.nextElementSibling.tagName==="TABLE"||e.nextElementSibling.querySelector(":scope>table"))){flushTxt();endRun();capt=arptClean(arptInline(e,ctx));continue;}   /* a minor heading over a table: its caption */
+      if(/^H[3-6]$/.test(tag)){topic(arptInline(e,ctx));continue;}
+      if(tag==="TABLE"){flushTxt();endRun();const t=arptTable(e,ctx);if(t){if(capt){t.caption=capt;capt="";}if(t.rows.length>14){t.lazy=true;t.title=(t.caption||(tp?tp.title:"Table"))+" (table)";}push(t);}continue;}
+      if(tag==="FIGURE"){flushTxt();endRun();const sv=e.querySelector("svg"), fc=e.querySelector("figcaption");
+        if(sv&&sv.childNodes.length){const c=sv.cloneNode(true);c.removeAttribute("id");c.setAttribute("style","width:100%;height:auto");
+          push({type:"figure",svg:c.outerHTML,caption:fc?arptClean(arptInline(fc,ctx)):""});}
+        else if(fc)push({type:"note",text:"Figure (interactive, on the tab): "+arptClean(arptInline(fc,ctx))});
+        continue;}
+      if(cl.contains("msg")){flushTxt();endRun();const b=e.querySelector(":scope>b");let t="";
+        [...e.childNodes].forEach(c=>{t+=(c===b?arptInline(c,ctx)+": ":c.nodeType===1&&!ARPT_INLINE.test(c.tagName)?" "+arptInline(c,ctx)+" ":arptInline(c,ctx));});
+        t=arptClean(t).replace(/:\s*:/,":");if(t)push({type:"note",text:t,warn:cl.contains("m-err")||cl.contains("m-wrn")});continue;}
+      if(tag==="UL"||tag==="OL"){flushTxt();endRun();[...e.children].forEach((li,i)=>{const t=arptClean(arptInline(li,ctx));if(t)push({type:"note",text:(tag==="OL"?(i+1)+". ":"• ")+t});});continue;}
+      if(cl.contains("wkLink")){buf+=" "+arptInline(e,ctx).replace(/^\s*Worked in:\s*/,"Worked in: ")+" ";continue;}
+      if(ARPT_INLINE.test(tag)){buf+=arptInline(e,ctx);continue;}
+      if(tag==="P"||cl.contains("note")||tag==="PRE"||tag==="BLOCKQUOTE"){flushTxt();endRun();const t=arptClean(arptInline(e,ctx));if(t)push({type:"note",text:t});continue;}
+      flushTxt(); walk(e); flushTxt();
+    }
+  };
+  walk(body); flushTxt();
+  if(pend&&last){/* a heading with nothing under it */ }
+  return items;
+}
+/* the topic results (SharedSteps.group: the status chip and one-line result of its worked steps) */
+function arptTopics(ctx){
+  ctx.topics.forEach(t=>{if(!t.steps.length)return;
+    const g=SharedSteps.group(t.steps,[{key:"k",title:t.title,ids:()=>true}],{strip:false})[0];
+    t.res=g.res;t.chip=g.chip;t.cls=g.cls;delete t.steps;});
+  ctx.topics.forEach(t=>{delete t.steps;});
+}
+/* the panes of the tabs -> report sections (figures drawn as for the D11 report) */
+function archReportModel(p){
+  const cap=[];
+  let panes;
+  window.__archRptCap=cap;
+  try{panes=buildOutput(p);panes.rsum=ratingSummary(p);}finally{window.__archRptCap=null;}
+  const stage=document.createElement("div");
+  stage.setAttribute("aria-hidden","true");
+  stage.style.cssText="position:absolute;left:-12000px;top:0;width:1000px;visibility:hidden;";
+  document.body.appendChild(stage);
+  const secs=[], cardKey={}, ctxAll=[];
+  try{
+    stage.innerHTML=ARPT_TABS.map(t=>`<div data-arpt="${t[0]}">${panes[t[0]]||""}</div>`).join("");
+    /* figures: the same drawing calls as the D11 report (static SVG, no Plotly) */
+    stage.querySelectorAll("[id^='figVeh_']").forEach(sv=>{const v=ARCH.ALL_VEHICLES.find(q=>q.id===sv.id.replace("figVeh_",""));if(v){try{VEHTAB.draw(sv,v);}catch(e){}}});
+    stage.querySelectorAll("[id='figModel']").forEach(sv=>{try{const veh=ARCH.ALL_VEHICLES.find(v=>v.id===animVehId)||ARCH.vehiclesFor(M.p.loadMode)[0];
+      MODELFIG.draw(sv,M.p,M,{layers:mfLayers,veh,pos:(animPos!=null)?animPos:(results[0]?results[0].pos:M.g.xmin),ilSec:mfSec,dir:focusDir});}catch(e){}});
+    drawReportFigures(stage,p);
+    ARPT_TABS.forEach(([k,name])=>{
+      const box=stage.querySelector(`[data-arpt="${k}"]`); if(!box||!box.innerHTML.trim())return;
+      const subs=[]; let loose=document.createElement("div");
+      const flushLoose=()=>{if(!loose.childNodes.length)return;const ctx={links:[],cards:[],topics:[],first:null};
+        const items=arptItems(loose,k+".intro",cap,ctx);arptTopics(ctx);ctxAll.push(ctx);
+        if(items.length)subs.push({title:subs.length?"Notes":"Overview",items});loose=document.createElement("div");};
+      [...box.childNodes].forEach(n=>{
+        if(n.nodeType===1&&n.classList&&(n.classList.contains("pnl")||n.classList.contains("sub"))&&n.querySelector(":scope>.hd")){
+          flushLoose();
+          const hd=n.querySelector(":scope>.hd"), sp=hd.children[1], tg=hd.querySelector(".tag");
+          const title=arptClean((sp?sp.textContent:hd.textContent).replace(/^\d+(\.\d+)*\.\s*/,""));
+          const ctx={links:[],cards:[],topics:[],first:null};
+          const bd=n.querySelector(":scope>.bd"); const items=bd?arptItems(bd,k+"."+(n.id||"p"+subs.length),cap,ctx):[];
+          arptTopics(ctx); ctxAll.push(ctx);
+          const tag=tg?arptClean(tg.textContent):""; if(tag&&tag!=="—")items.unshift({type:"note",text:(/^(§|Std|MBE|AREMA|Check)/.test(tag)?"Reference: ":"")+tag});
+          [n.id].concat(ctx.cards).forEach(id=>{if(id&&ctx.first&&!cardKey[id])cardKey[id]=ctx.first;});
+          if(items.length)subs.push({title,items});
+        }else loose.appendChild(n);
+      });
+      flushLoose();
+      if(subs.length)secs.push({title:name,note:`On screen: the [[tab:${k}|${name} tab]].`,subs});
+    });
+  }finally{stage.remove();}
+  /* "Worked in" / jump links: "see §x.y" where the panel has worked steps here, the tab link always */
+  const fix=s=>String(s).replace(/⟦card:([^⟧]*)⟧/g,(m,c)=>cardKey[c]?"[["+cardKey[c]+"]]":"");
+  secs.forEach(s=>s.subs.forEach(q=>q.items.forEach(it=>{
+    if(it.type==="note")it.text=fix(it.text);
+    if(it.type==="figure")it.caption=fix(it.caption);
+    if(it.type==="table"){const c=x=>{if(x&&typeof x==="object")x.t=fix(x.t);};it.head.forEach(c);it.rows.forEach(r=>(Array.isArray(r)?r:r.cells).forEach(c));}
+  })));
+  /* 1. Project and inputs: the input echo of the D11 report (archInputRows) */
+  const ir=archInputRows(p);
+  secs.unshift({title:"Project and inputs",subs:[{title:"Input echo (all inputs as entered)",items:[
+    {type:"table",head:["Input","Value","Units"],rows:ir.map(r=>[String(r.k),String(r.v==null?"":r.v),String(r.u||"")]),wide:true},
+    {type:"note",text:"Units: kip, ft, psi unless noted; forces and moments are per foot of barrel width. Every value in this report is the value the tool shows on its tabs; the worked lines are the tabs' own. The User Manual is on the [[tab:man|Manual tab]]."}]}]});
+  secs.push({title:"References",subs:[{title:"Codes and references cited",items:[{type:"table",head:["Reference","Provisions used"],rows:ARCH_REFS.map(r=>[r[0],r[1]]),wide:true}]}]});
+  const v=id=>{const e=$(id);return e&&e.value?String(e.value).trim():"";};
+  const gv=results.length?results.reduce((a,b)=>a.rf<b.rf?a:b):null, vg=gv?ARCH.ALL_VEHICLES.find(x=>x.id===gv.id):null;
+  return {title:"Stone Masonry Arch Load Rating — Calculation Report",subtitle:v("tbProject")||"Untitled",
+    code:"Allowable Stress Method, Inventory Level · MassDOT Bridge Manual Part I §7.2.7 · AASHTO MBE Art. 6A.9.1 · "+(p.loadMode==="rail"?"AREMA Ch. 8 (railroad loading)":"AASHTO Std. Spec. Art. 6.4, 3.8.2.3")
+      +(gv?" · Controlling: "+vg.name+", RF = "+nfx(gv.rf,3)+" at "+CALC.secTag(M,gv.sec):""),
+    info:[["Project",v("tbProject")],["Project No.",""],["Subject",v("tbSubject")],["Computed by",v("tbBy")],["Date",v("tbDate")],["Task",v("tbTask")],
+      ["Checked by",v("tbChk")],["Checked date",v("tbChkDate")],["Program","Stone Arch LR "+BUILD_ID]],
+    head:{left:"Project No. — — "+(v("tbSubject")||v("tbProject")||"—").slice(0,40),right:"Computed: "+(v("tbBy")||"—")+" "+v("tbDate")+" · Checked: "+(v("tbChk")||"—")+" "+v("tbChkDate"),
+      foot:(v("tbProject")||"Untitled")+" (Stone Masonry Arch Load Rating) · Inventory level · Allowable Stress · MBE 6A.9.1"},
+    sections:secs, _cap:cap};
+}
+function archRenderReport(p){
+  const T=$("pane_rpt"); if(!T)return;
+  if(!window.SharedReport||!window.SharedSteps){T.innerHTML=msg("err","Report","shared/report.js or shared/steps.js is not loaded: keep the shared folder next to this file.");return;}
+  if(!M){T.innerHTML=msg("err","Report","No results: correct the input errors first.");ARPT.api=null;ARPT.doc=null;return;}
+  let mdl;
+  try{mdl=archReportModel(p);}catch(e){T.innerHTML=msg("err","Report error",esc(e&&e.message));ARPT.api=null;ARPT.doc=null;return;}
+  const top=$("outTop");
+  ARPT.api=SharedReport.mount(T,mdl,{closed:ARPT.closed,onGoto:archRptGoto,stick:top?top.offsetHeight:0});
+  ARPT.doc=ARPT.api.doc;
+}
+/* [[tab:name~card~heading|text]] links of the report: the tab, with the panel (archGoto) */
+function archRptGoto(name){const [tab,card,sub]=String(name).split("~");if(card)archGoto(tab,card,sub||null);else{activeTab=tab;render();autosave();const sc=$("outPanel");if(sc)sc.scrollTop=0;}}
+/* Ctrl+P while the Report tab is shown prints the report alone (shared/report.js print layout and running header); the
+   D11 report (Print / PDF Report button, or Ctrl+P on any other tab) is unchanged. */
+function archRptPrinting(){return document.body.classList.contains("rp-printing");}
+function archRptWillPrint(){return !window.__archD11Print&&(archRptPrinting()||!!(ARPT.doc&&activeTab==="rpt"));}
+let arptPageCss=null;
+window.addEventListener("beforeprint",()=>{
+  if(!archRptWillPrint())return;
+  const ap=document.getElementById("arch-page"); if(ap){arptPageCss=ap.textContent;ap.textContent="";}   /* the D11 page header would print over the report's */
+  if(archRptPrinting())return;
+  let box=document.getElementById("rp-print");if(!box){box=document.createElement("div");box.id="rp-print";document.body.appendChild(box);}
+  box.innerHTML='<div class="rp"><article class="rp-doc">'+SharedReport.html(ARPT.doc,{lazy:false})+'</article></div>';
+  document.body.classList.add("rp-printing");
+});
+window.addEventListener("afterprint",()=>{
+  if(arptPageCss!=null){const ap=document.getElementById("arch-page");if(ap)ap.textContent=arptPageCss;arptPageCss=null;}
+  window.__archD11Print=false;
+});
+window.__archRptForTest=()=>({doc:ARPT.doc,results,M,secResults:node=>secResults(M.p,M,node),focusNode,rateBasis});
+window.__archVehForTest=()=>ARCH.ALL_VEHICLES;   /* tests only (read-only) */
+
```

## 2026-11-02 — PR: claude/phone-print-arch — Phone layout, k_loc matrix row spacing, raw TeX in two report topic titles (PHN; display only, no calculation change)

Engineer-approved overnight job (2026-11-02): phone layout at 390 / 768 px and report print polish, one PR per tool. Every code site is tagged `PHN`.

### PHN-1. One column that never grows past the window (below 1050 px)   [display only]
- **Problem:** below the tool's own 1050 px breakpoint the panels stack, but the grid column was `1fr`, which grows to the widest table. Live Load, Vehicles, Earth Pressure, Influence Lines, Rating, Rating Summary and Nodal Results made both panels 988–1,711 px wide, so the page scrolled sideways: by 102–825 px at 900 px, 234–957 px at 768 px, and 612–1,335 px at 390 px. The title block (`#tblk{min-width:420px}`, four columns) also scrolled 144 px sideways at 390 px on every tab.
- **Where:** the `@media(max-width:1050px)` rule, anchor `#inPanel,#outPanel{height:auto;overflow:visible;}`.
- **Before:**
```css
@media(max-width:1050px){
  html,body{height:auto;overflow:visible;display:block;}
  #wrap{grid-template-columns:1fr;min-height:0;}
  #inPanel,#outPanel{height:auto;overflow:visible;}
}
```
- **After:**
```css
@media(max-width:1050px){
  html,body{height:auto;overflow:visible;display:block;}
  #wrap{grid-template-columns:1fr;min-height:0;}
  #inPanel,#outPanel{height:auto;overflow:visible;}
  /* PHN (2026-11-02): the one column never grows past the window (a wide table scrolls in its own box, below) */
  #wrap{grid-template-columns:minmax(0,1fr);}
  div.tw,.pnl>.bd{overflow-x:auto;}
}
@media(max-width:700px){
  #tblk{min-width:0;flex:1 1 100%;grid-template-columns:repeat(2,minmax(0,1fr));}
  #appTitle{min-width:0;}
}
```
- Wide tables (the Rating Summary matrix, influence-line and nodal tables) now scroll inside their panel. The page scrolls as one column, as before, and the panels never scroll by themselves, so the KaTeX page-scroll trap (#524) does not apply. Above 1050 px nothing changes. Between 900 and 1050 px only the seven tabs listed above change: on origin/main they scrolled sideways at 900 px; on this branch they do not.

### PHN-2. k_loc stiffness matrix: row spacing   [display only]
- **Problem (engineer):** in the "Local stiffness matrix, plane frame element" equation (Influence Lines tab, and the Report), the fraction rows were crowded: the L³ of one row touched the next row's numerator.
- **Where:** the `eqLine("Local stiffness matrix, plane frame element", …)` call, anchor `"\\mathbf{k}_{loc}=\\begin{bmatrix}"`.
- **Before:** each of rows 1–5 ends with `\\\\"+` (the TeX row break `\\`), e.g.
  `"0&\\frac{12EI}{L^3}&\\frac{6EI}{L^2}&0&-\\frac{12EI}{L^3}&\\frac{6EI}{L^2}\\\\"+`
- **After:** each of rows 1–5 ends with `\\\\[6pt]"+` (TeX `\\[6pt]`, 6 pt extra space below the row), e.g.
  `"0&\\frac{12EI}{L^3}&\\frac{6EI}{L^2}&0&-\\frac{12EI}{L^3}&\\frac{6EI}{L^2}\\\\[6pt]"+`
- The matrix entries are unchanged. The Report reads the same string. In print the step grows by about 0.4 in, and the end of §9 moves one page down (107 pages, was 106).

### PHN-3. Report: raw TeX in two topic titles   [display only]
- **Problem:** the topic headings "k$_{\text{loc}}$ for element 1, evaluated (kip, ft)" and "k$_{\text{glob}}$ for element 1 (kip, ft)" printed their TeX source. The report builder turns the tab's `<h4>k<sub>loc</sub> …</h4>` into `$_{\text{loc}}$`, but the shared viewer shows a topic title as plain text.
- **Where:** `arptItems`, anchor `if(/^H[3-6]$/.test(tag)){topic(arptInline(e,ctx));continue;}`.
- **After:**
```js
if(/^H[3-6]$/.test(tag)){topic(arptInline(e,ctx).replace(/\$([_^])\{\\text\{([^{}$]*)\}\}\$/g,"$1$2"));continue;}
```
  The titles now read "k_loc for element 1, evaluated (kip, ft)" and "k_glob for element 1 (kip, ft)". These were the only two topic titles with `$` or `\`, checked on the print box of the default project.

### Smoke test
- `tests/smoke/phone-layout.mjs` gains the key `arch` (5 input tabs + 14 output tabs). It fails on origin/main and passes on this branch.

### How verified (no computed result, saved key or hand-off changed)
- origin/main vs this branch, headless Chromium, file://, at 1280 px: the page text on load and on all 19 tabs is identical, except the Report tab's two topic titles above. The whole-document `textContent` differs only by the ten inserted `[6pt]` (five in the inline script source, five in the KaTeX annotation of the k_loc matrix). localStorage after load is identical.
- Screenshots at 1280 px are pixel-identical (0 differing pixels) on load and on all 19 tabs. At 900 px only the seven overflowing tabs differ (see PHN-1).
- Report print: 0 elements past the 7.5 in text width.

## 2026-11-02 — PR: [#665](https://github.com/mlococo88/All-Structural/pull/665) — PLIB: saved-project list (Open / Rename / Duplicate / Delete) and Undo / Redo   [display and storage only]
- **Before:** Project tab → Project Files: a list box with Save / Update, Load, Delete (`stoneArchLR.projects`), Export / Import JSON,
  "Start a new calculation". No rename, no duplicate, no undo.
- **Where:**
  - after `<script src="shared/report.js"></script>`: `<script src="shared/projects.js"></script>` and `<script src="shared/projects-ui.js"></script>`.
  - `autosave()`, anchor `try{localStorage.setItem(LSA,JSON.stringify(snapshot()));}catch(e){storageOK=false;showAutoInfo();}`: after it
    `if(PLIB&&PLIB.soon)PLIB.soon();   /* PLIB: one undo step per change (debounced) */` (400 ms debounce: typing a number is one step).
  - after `window.__restoreForTest=(o)=>{restore(o);render();};`: `var PLIB={}` and `function plibInit()` (anchor `/* PLIB (2026-11-02)`).
    History over `snapshot()` keeping only `fields`, `title`, `rateBasis`, `midas` (view / focus / chart / collapse fields and the time stamp
    are not part of a step); `set` = `restore(Object.assign(snapshot(), step)); render(); autosave();`. `mapStore(localStorage, LSK, { time: saved || ts })`
    (the tool's own key and format). Dialog: `open` selects the name in `#projSel` and clicks Load (the tool's own load path); a rename of
    the open project updates `curProj`, the name box and the autosave; a delete of the open project clears `curProj` as the Delete button
    does; the list box is redrawn after every change. Buttons Undo, Redo, Saved projects… in a new `.bx-pm` row under the title.
  - `boot()`: `plibInit();   /* PLIB */` after `init();`.
- **Saved data:** keys `stoneArchLR.autosave` and `stoneArchLR.projects` and their formats unchanged; no new key.
- **How verified:** `node tests/smoke/project-library.mjs --tool stonearch`: ALL PASS. The model (`__modelForTest()`, every computed
  value) and the Summary text are identical to origin/main on load and after an input change; the branch reopened on main's autosave and
  list equals main reopened on them, and main's saved project opens from the dialog with the same results (list byte-identical);
  Undo / Redo / Ctrl+Z / Ctrl+Y exact (an output-tab change is not a step); dialog rename / duplicate / delete byte-identical, quota
  refusal leaves storage byte-identical; 390 px; no console errors beyond main's. `node tests/check-syntax.mjs`: pass.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).

## 2026-11-02 — PR: claude/list-input-stonearch, PR #704: https://github.com/mlococo88/All-Structural/pull/704 — paste boxes show a table of what was read; track offsets are a table (LIST)   [display only]
- **Why:** engineer decision 2026-11-02: no comma-separated inputs; multi-line paste boxes stay, each with an editable table of
  what was read next to it (`shared/list-input.js`, `fixlog/shared-list-input.md`, #681).
- **Where (1):** script tags, anchor `<script src="shared/projects-ui.js"></script>`. **Added after it:** `<script src="shared/list-input.js"></script>`
- **Where (2):** the four places that rebuild the input panel (anchor `archInputTabs($("inPanel"));`): `listTables();` added after it.
- **Where (3):** new `pasteTable()` and `listTables()` before `function readP(){`:
  - `#measPts` (survey points): table "Survey points as read", x (ft), y (ft); each line split as `parsePairs()` splits it
    (`/[\s,;]+/`).
  - `#dOver` (ring-depth overrides): table "Depth overrides as read", Station (ft), Depth (in) (must be > 0, as `readOverrides()`).
  - `#sdlItems` (SDL line items): table "Line items as read", Description, Weight (plf); split at the LAST comma, as `readSdl()`.
  - The boxes stay visible and work as before. A table edit rewrites its box, one "a, b" line per row, and fires the box's
    `input` (render + autosave, as typing). Typing or pasting in the box refreshes the table; a script that sets the box's value
    (load, undo, unit change, mode switch) refreshes it too (the instance's value setter is wrapped).
  - `#tracks` (track centerline offsets, railroad): one box per track (`bindInput`, `rowSplit: /\n+/`, `rowSep: "\n"`); the
    textarea stays, hidden, as the text, one value per line.
  CSS: `.sliPaste{margin:4px 0 8px;}`.
- **Deterioration (`deter`):** unchanged; it already has its row editor (one labelled row per area) over the hidden field.
- **Saved data:** every field stays text in its own format, one entry per line: `measPts` / `dOver` "x, y" per line,
  `sdlItems` "description, weight" per line, `tracks` one value per line. A box is rewritten only when its table is edited
  (spaces / semicolons become ", "); the readers `parsePairs`, `readOverrides`, `readSdl`, `readTracks` are unchanged and read the
  same values (`tests/engine/list-input.test.mjs`, the readers copied verbatim).
- **Check case:** default project switched to Railroad; SDL "Sidewalks (2), 800 / Railings (2), 120" and override "18, 19" pasted
  into the tables, tracks -6 / 6 → the saved text is "Sidewalks (2), 800\nRailings (2), 120", "18, 19", "-6\n6", identical to
  typing the same text in the boxes on origin/main; every output tab identical.
- **How verified:** `node tests/smoke/list-input.mjs --part stonearch`: origin/main vs this branch, default project and the case
  above: the stored autosave and the text of every output tab (except the printed report tab; "Computed in x s" normalised)
  identical; 0 console errors; 390 px no sideways scroll; screenshots at 1400 and 390 px looked at.
  `node tests/check-syntax.mjs` passes.
- **Formulas, factors, units, code references:** none (§4 does not apply).

## 2026-11-03 — PR: claude/report-retire-stonearch, PR #729: https://github.com/mlococo88/All-Structural/pull/729 (ARX: the D11 print report ("Print / PDF Report" → "Report contents" dialog → `buildReport` → `#rptHost`) retired after porting what the Report tab lacked; Print / PDF Report, Ctrl+P and the browser's Print print the Report from every tab; display only, no result change)

### ARX-1. What the print report printed and the Report lacked, ported   [display] [no result change]
- **Engineer request (2026-11-03):** retire each tool's old print report by porting it in full into the Report tab (method of #685, #715, #718, #722, #724).
- **Compared:** the print report (every dialog choice on, the default; `#rptHost` in print media, KaTeX annotations as TeX) on origin/main against the Report (`#rp-print`, print media) on the branch. Cases (scratch scripts):
  - def: the default arch (40 ft circular, fixed);
  - c2: title block filled, parabolic 32 × 7 ft, pinned, cover 3.5 ft, 2 lanes;
  - c3: railroad loading (AREMA), 28 × 9 ft, ring 30 / 36 in, cover at each springing.
- **Missing before:** 292 / 809 / 930 of 2135 / 2021 / 2424 distinct numbers (def / c2 / c3):
  - "Rating — Vehicle by Vehicle": the print report worked each vehicle at its own governing section (`CALC.vehicleSection(p,M,v,r)`). The Rating tab, and so the Report, works it at the selected section when that differs.
  - "Nodal Results" and the worked node: the print report used the governing vehicle at its governing position and section. The tab uses its own vehicle / position / node selection.
  - The User Manual (`MANUAL.html(true)`).
  - The result line per vehicle, the controlling result of the cover, the longitudinal section at the governing position (with the thrust line), the certification block and the closing note.
- **Ported (anchor `ARX (2026-11-03): the D11 print report retired`, after the Report's `beforeprint` handler):**
  - `arxPanes(p)` (called while the steps are recorded, in `archReportModel`), each pane built by the print report's own calls:
    - `rvg`: each vehicle whose Rating-tab section differs from its own governing section, worked at its own section;
    - `llg`: the live load distribution for the governing vehicle at its governing position, when the Live Load tab shows another vehicle;
    - `ndg`: the nodal results and the worked node for the governing vehicle, position and section, when the Nodal Results tab shows another;
    - `manP`: the User Manual, one subsection per chapter.
    These are added after their tabs (`arxTabs`) and walked by `arptItems` like every tab (steps, tables, figures, links).
  - `arxAfter(secs, cardKey)`:
    - "Controlling result" under Project and inputs;
    - "Results — rating factors" (vehicle, RF, tons / E, reference and governing section, link to the worked vehicle, PASS / FAIL by RF ≥ 1.0) at the end of Rating;
    - "Longitudinal section at the governing position" (`schematic(…, {thrust:true})`) under Model;
    - the "Certification" section (signature table, "Not signed" warning, the engineer-of-record note and the print report's closing note).
  - Include boxes on the report bar (`arxControls` / `arxWire`): the dialog's sections (`RPT_SECTIONS`) and the per-vehicle detail.
    - They write `rptSel`, the dialog's selection, kept in memory for the session as before; the tool never saved it.
    - Each box leaves out its tab or panel (`arxPanelOn`, `ARX_TAB`, `ARX_PNL`) and, for Input echo, the echo table.
- **After:** in all three cases, every number of the print report is in the Report except the print report's section numbers.
  - This holds with KaTeX and without it (def, c2).
  - The Report holds 0 unresolved references and 0 duplicate keys.
  - Figures: 49 / 55 / 48 (the print report: 40 / 40 / 36).
- **Without KaTeX:** `arptStep` writes a step's TeX in the built-in renderer's subset (`arptTex`, as the running text already was). Before, offline steps showed `\dfrac` / `\kappa` as letters ("kappa=dfracmn…").

### ARX-2. Print report and dialog removed; Print prints the Report from every tab   [display]
- **Removed:**
  - `buildReport()`, `reportModal()`, `archBuildReport()` and the D11 `beforeprint` rebuild (`renderSeq` / `rptBuiltSeq`, `window.__archD11Print`);
  - `archPageCSS()`, `archApplyPageCSS()`, `archResultBlock()`, `archCalcSheet()`;
  - `#rptHost` and its styles;
  - the print rule that hid the page (`#hdr`, `#wrap`).
- **Kept:** `RPT_SECTIONS`, `rptSel`, `rptSelDefaults`, `drawReportFigures`, `ARCH_REFS`, `archInputRows`.
- **Changed:**
  - "Print / PDF Report" (tooltip added) → `arxPrintAny()`: shows the Report (`activeTab`, not saved) and prints it.
  - An inline `beforeprint` script before `shared/steps.js` calls `window.archPrintPrep` (Ctrl+P / the browser's Print from another tab).
  - `afterprint` brings the tab of before back.
  - `archRptWillPrint` no longer depends on the D11 flag.
- **Governing provision:** none changed. No formula, factor, unit, code reference or computed value changed (CLAUDE.md §4).
- **Saved data:** no key or format change (`stoneArchLR.autosave`, `stoneArchLR.projects`). The report selection was never saved and still is not.
- **How verified:**
  - `node tests/check-syntax.mjs`: pass.
  - origin/main vs branch, def / c2 / c3, with KaTeX:
    - the model (`__modelForTest`) and the results (JSON) identical;
    - the text of every tab identical, apart from the "Computed in 0.7 s" timing of Rating Summary;
    - localStorage identical, apart from the autosave time stamp `ts`, on load, after visiting every tab, and after showing and printing the Report;
    - no console errors.
  - Print routing from each of the 14 tabs, by `beforeprint` and by the button (28 paths per case): `#rp-print` holds the Report, `body.rp-printing` is set, and the tab of before comes back.
  - Include boxes (Nodal results, one vehicle, Input echo, User manual): each leaves out its part, with 0 unresolved references and no storage write.
  - `node tests/smoke/project-library.mjs --tool stonearch`: ALL PASS.
- **Other copies:** none.

## 2026-11-05 — PR: claude/github-sync-rollout (PR #811: https://github.com/mlococo88/All-Structural/pull/811) (GHS: saved projects copied to a private GitHub repository; storage only, no result change)
- **Engineer:** the same saved projects on every device (`docs/github-sync-setup.md`; shared code `shared/github-sync.js`, fix log `shared-github-sync.md`; pilot Spread Footing, PR #808).
- **Where:** after `<script src="shared/projects-ui.js"></script>`, new `<script src="shared/github-sync.js"></script>`; in the PLIB block, `SharedProjectsUI.libraryDialog({` gets a first property `cloud:{tool:'stone-arch-rating', …}` (anchor `GHS (2026-11-05): GitHub sync of this list`).
- **File on GitHub:** `projects/stone-arch-rating/<name>.json`: the stored item is the export (`snapshot()`), indent 2. **Download (fromFile):** an object with `fields`; Open then goes through the dialog's existing `open`.
- **Saved data:** `stoneArchLR.projects` and the autosave unchanged (key and format). With sync off nothing is written and no request is made.
- **How verified:** `node tests/smoke/project-library.mjs` for this tool (origin/main vs branch, sync off): ALL PASS. `node tests/smoke/github-sync-tools.mjs`: Save → file on GitHub; update with sha; a GitHub-only copy opened gives the same results as the saved project; 0 console errors.
- **Formulas, factors, units, code references:** none.

## 2026-11-05 — PR: claude/header-stonearch (PR #824: https://github.com/mlococo88/All-Structural/pull/824) (SAHD: compact header; title block and shared-info buttons moved to the Project input tab; display only, no result change)
- **Engineer:** clean up the top of the page: the title-block inputs and the shared-info buttons go into the Project input tab; the header keeps the title, a read-only project line and the global actions.
- **Where / before → after** (nodes moved, not copied: every id, handler and saved field is the same):
  - `#hdrIn`: before `#appTitle` (All tools, title, by-line, governing documents, `.bx-pm` Use / Share project info, then Undo / Redo / Saved projects… appended by `plibInit()`) and `#tblk` (7 inputs `tbProject` … `tbChkDate` and `#printBtn`). After: `#appTitle` (All tools, title, by-line, governing documents) and `<div id="hdrActs">` (`#hdrProj` "Project: <project> · <task>" link, `#printBtn`, Undo / Redo / Saved projects…).
  - New `<div id="saPrjHold" hidden><div id="saPrjPane">` after the header: "Title block" card (`#tblk`, 2 columns, hint) and "Shared project info" card (`.bx-pm` with `#bx-pm-use` / `#bx-pm-share`, hint).
  - `archInputTabs()` (anchor `/* SAHD: first card of the Project tab */`): `#saPrjPane` is inserted before `#ip_assume`; `IN_SEC` gets `saPrjPane:"proj"`. `inputPanel()` (anchor `/* SAHD: keep the title block out of the rebuild */`) first parks `#saPrjPane` back in `#saPrjHold`, so the four `$("inPanel").innerHTML=inputPanel()` rebuilds (restore, loading mode, Start a new calculation, init) never destroy the title inputs or their values.
  - `bind()`: inputs inside `#saPrjPane` are skipped by the generic input-panel listener (they keep only their `TB.forEach(... autosave)` listener, as when they were in the header, so typing a title does not re-render).
  - `plibInit()`: `const host=$("appTitle")` → `$("hdrActs")||$("appTitle")`.
  - New `saHdrProj()` (anchor `function saHdrProj(){`): `tbProject · tbTask` or "(untitled: enter it in the Project tab)"; called on `input` in `#tblk`, after `restore()` fills the title, after Start a new calculation and in `init()`. `#hdrProj` click: `setInTab("proj",true)`, focus Project (at 1050 px and below the input tabs are scrolled into view first).
  - CSS (anchor `/* SAHD (2026-11-05)`): `#hdrActs`, `#hdrProj`, `#saPrjPane` rules.
- **Decisions (pending engineer review):** the project line shows Project · Task (the tool has no project-number field).
- **Governing provision:** none (layout only).
- **Check case / how verified** (headless Chromium, origin/main vs branch, title typed "Route 6 Arch", "Load rating", "T-12", "MJL", "2026-11-05", "ABC", "2026-11-06"):
  - `results` and `M.p` (`__archRptForTest()`), every localStorage key (autosave `ts` normalised) and the Report document (`__archRptForTest().doc`): identical; every typed value in the Report.
  - Share project info: `bridgeSuite.v1.projectMeta` identical; Use shared project info fills the shared fields; reload of the autosave identical;
  - header shows "Project: Route 6 Arch · T-12"; the link opens the Project tab with Project focused (1920 and 390 px);
  - changing the loading mode to Railroad (input panel rebuilt) keeps the title block in the Project tab with its values; Start a new calculation clears it as before;
  - `phone-layout --tool arch`, `project-library --tool stonearch`, `github-sync-tools --tool stonearch`, `check-syntax`: pass; no sideways scroll on any input tab at 390 / 768 px; 0 console errors;
  - before / after screenshots at 1920 and 390 px looked at.
- **Saved data:** no change.

## 2026-11-06 — PR: claude/standard-save-stone-arch (PR #852: https://github.com/mlococo88/All-Structural/pull/852) (STDS) — the standard save: header chip + Save + Saved projects…, "Save and open" card first in the Project tab, Save as, Ctrl+S; the misleading autosave text fixed   [display / save controls only; no result change]
- **Why:** engineer decision 2026-11-05 (standard save roll-out after the Spread Footing pilot #837), including "fix Stone Arch's misleading autosave text". Uses `SharedProjectsUI.projectBar` (shared/projects-ui.js).
- **Header (`#hdrActs`):** before: `Project: <project> · <task>` (read-only link) · Print / PDF Report · Undo · Redo · Saved projects…. After: chip `Project: <open saved project> ● saved / unsaved changes / not saved` (+ GitHub badge with sync on) · Undo · Redo · **Save (Ctrl+S)** · Saved projects… · Print / PDF Report (the Undo / Redo row now goes before Print, the standard order). `#hdrProj` is hidden (`hidden`; `saHdrProj()` still fills it).
- **Project tab:** a new first card **"Save and open"** at the top of the persistent `#saPrjPane` (`#saSaveCard`; archInputTabs() already puts `#saPrjPane` first in the Project tab): status line; Save · Save as… · Saved projects… · New; Export JSON · Import JSON (they run the old `#bExp` / `#fImp` paths); the two hint lines.
- **"Project Files" panel (`ip_proj`, in `inputPanel()`) → "Autosave and charts":** keeps `#projMsg`, `#autoInfo`, Chart engine and the storage note. The Saved projects list `#projSel`, Name `#projName`, Save / Load / Delete (`<div hidden>`), "Start a new calculation" and Export / Import JSON (`.btnrow` with `hidden style="display:none"`) are kept hidden: `wireProject()` still wires them and the standard save drives Load (Open), `#bExp` and `#fImp`.
- **Autosave text (`showAutoInfo`, anchor `/* STDS (2026-11-06): was "Work is saved automatically`):** before ``Work is saved automatically as you go`` + `` under <b>${curProj}</b>`` / `` (unnamed — enter a name and press Save to keep a copy)`` + `.`. After ``The inputs on screen are autosaved in this browser while you work and come back when you reopen the tool. The autosave is not a saved project`` + ``: <b>${curProj}</b> changes only when you press Save`` / ``: use Save or Save as… to keep one`` + `.` (the restored-at sentence and the migration / storage warnings unchanged). The old text read as if the named project were kept up to date; only the session is.
- **wireProject split (anchor `function saNewCalc(){`):** the body of "Start a new calculation" (after its confirm) moved unchanged into `saNewCalc()` (the standard New); the rest of `wireProject()` (Save / Load / Delete / Export / Import wiring) moved unchanged into `wireProjectFiles()`, which `wireProject()` calls. `#fImp` onload: after `restore(...)`, `PLIB.pb.setCurrent(null)` (an imported file is not the open saved project; before, the file's own `project` name became the open project).
- **Code (`plibInit`, anchor `/* STDS (2026-11-06): the standard save`):** `projectBar({ store: mapStore(localStorage,'stoneArchLR.projects'), snapshot / snapOf: the inputs only (fields, title, rateBasis, midas: PLIB_KEEP, as Undo / Redo), current / setCurrent: curProj (kept in the autosave, as before), save(n): curProj = n; list[n] = snapshot() (the old Save), open: the old Load (#projSel + #bLoad), newProject: saNewCalc(), displayName: Title block Project, exportFile (Save as → File: the #bExp file named n), importFile: #fImp, header: the Undo / Redo row, deleted: as before, cloud: <unchanged GHS ctx.cloud> })`. `window.SAPL.pb`.
- **Behaviour changes (asked for):** Save saves to the open project (was: under the Name box, "Update" when it existed); with none open it is Save as. A new duplicate name at Save as is blocked ("Replace it"); Delete only in Saved projects…; Open / New / Import ask first on unsaved changes ("Start a new calculation" always asked); Ctrl+S / Ctrl+Shift+S.
- **Decision (pending engineer review):** the panel title "Project Files" → "Autosave and charts" (what is left in it). Tabs, chart focus, panels, the chart engine and the diagram settings are view settings, not "unsaved changes" (they are still saved with the project, as before).
- **Saved data (§5):** `stoneArchLR.projects` ({ name: snapshot() }), `stoneArchLR.autosave`, `stoneArchLR.inputTab_v1` unchanged; Export JSON / GitHub file format unchanged; no new key.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **How verified:** main vs branch after the same input change: model and summary identical (0 differences), `stoneArchLR.autosave` identical (time stamp aside), Export JSON text identical (1,955 chars, time stamp aside), Report tab text identical (813,013 chars; read after the Report's timed sweep table is done), no console errors. Probe: save → saved; change → unsaved; Ctrl+S saves with no dialog; every input tab, output tab and panel toggle leaves "saved"; Open, reload: saved; New → the defaults, not saved; the autosave text with and without an open project looked at. `project-library --tool stonearch` ALL PASS; `github-sync-tools --tool stonearch`, `standard-save` (8 / 8), `github-sync` (13 / 13), `home-projects`, `home-sync`: pass; `phone-layout --tool arch` (390, 768; 20 views) pass; `list-input --part stonearch` all passed; engine `project-registry`, `github-sync`, `projects` pass; `check-syntax` pass. 390 px: page 390 / 390, dialog 355 / 355; screenshots looked at.
## 2026-11-06 — PR: claude/hdrs-stonearch (PR #892: https://github.com/mlococo88/All-Structural/pull/892) (HDRS) — header: Save and Saved projects… removed (in the "Save and open" card only); the chip opens the Project tab   [display only; no result change]
- **Why:** engineer 2026-11-06: every app's header as in Spread Footing (#884): no Save (Ctrl+S) and Saved projects… buttons in the header; they stay in the "Save and open" card. The header keeps the project chip (click = the Project tab), Undo, Redo, the app's other global actions and Print. Ctrl+S and Ctrl+Shift+S work from anywhere. No "Recent projects" start strip (Spread Footing only).
- **Where:** the `SharedProjectsUI.projectBar({...})` call, right after the line `header:row,chipBefore:bu,card:$("saSaveCard"),` (a comment `/* HDRS (2026-11-06, …) */` and one line).
  Before: nothing. After:
  `headerSave:false, chipClick:()=>{ const a=document.getElementById("hdrProj"); if(a) a.click(); }, chipHint:"the Project tab (Save and open)",`
  Uses the projectBar options of `shared/projects-ui.js` (HDRS, #884; `fixlog/shared-projects.md`): `headerSave:false` (the chip only in the header), `chipClick`, `chipHint` (the chip tooltip's "Click: …").
- **Header before:** chip · Undo · Redo · Save · Saved projects…; chip click = Saved projects… dialog. **After:** chip · Undo · Redo; chip click = the Project input tab (the "Save and open" card on screen), through the click handler of the hidden header link `#hdrProj` (reused). The card's buttons are unchanged.
- **Problem:** none (layout request). **Governing provision:** none (§4 does not apply).
- **Check case:** default project, another tab open: click the chip → the Project tab, the "Save and open" card on screen, no dialog; Ctrl+S on another tab (nothing saved yet) → Save as dialog; Ctrl+Shift+S → Save as dialog.
- **How verified:** main vs branch on the default project: every localStorage key (0), page text (343735 chars), Export JSON (1933 chars identical) and the printed report text (print media, 415510 chars) identical (clock times normalised); 0 console errors; chip click → card on screen, no dialog; Ctrl+S / Ctrl+Shift+S → Save as; header at 1280 / 1400 / 1920 / 390 px (390: no sideways scroll), screenshots looked at. `node tests/check-syntax.mjs "Stone Masonry Arch Load Rating.html"`; `node tests/smoke/project-library.mjs --tool stonearch`; `node tests/smoke/github-sync-tools.mjs --tool stonearch`; `node tests/smoke/home-projects.mjs --tool stonearch`; `node tests/smoke/phone-layout.mjs --tool arch`: pass.
- **Saved data:** no key or format changed (§5).
- **Other copies:** none. **Open items:** none.

## 2026-11-07 — PR #1064: https://github.com/mlococo88/All-Structural/pull/1064 — Automatic mesh convergence: lowest RF of three meshes reported (MCV; review H-1, L-1)

### MCV-1. Every vehicle rated at n1, about 2·n1 and 4·n1 elements; the lowest RF is reported   [§4 result change]
- **Problem (review H-1):** the rating was reported from the §7.2.7.2B minimum mesh (10 elements at 40 ft). The straight chords carry the transverse fill load as beams, which a curved ring does not, so the minimum mesh is not reliably close to the converged answer and the error goes either way. Unconservative cases: 20 ft / 4 ft rise (HS20 0.419 at 10 el, 0.391 at 40), 30 ft / 6 ft (0.318 vs 0.278), 40 ft semicircle (0.262 vs 0.000, dead load alone overstresses the springing). The study on the Verification tab ran only on demand, and the dashboard row read "Compliant" / OK.
- **Where:** new `archConvMeshes`, `archConvRun`, `archConvTable` just after `function readPSafe()`; `render()`, anchor `archConvRun(p);   /* MCV (H-1)` right after the base-mesh `results` loop.
- **Before (render):**
```js
  for(const v of ARCH.vehiclesFor(p.loadMode)){
    if(!p.vehicles.includes(v.id))continue;
    const r=ARCH.rateVehicle(M,v,p.fa,p.impMode);
    r.id=v.id; results.push(r);
  }
  window.__impCmp=impCmp;
```
- **After (render):** the same loop, then `archConvRun(p);`. `archConvRun`:
  - meshes = unique of [n1, up4(2·n1), up4(4·n1)], up4(n) = min(120, 4·ceil(n/4)); n1 = the count in use (code minimum or the count entered);
  - builds `ARCH.buildModel({...p, nEl:n})` and rates every selected vehicle on each mesh (cached on `JSON.stringify(p)`, so tab changes and focus changes do not re-run it);
  - governing mesh gN = the mesh with the lowest controlling RF (the base mesh on a tie); `M` becomes that mesh's model and `results` its results;
  - for a vehicle whose lowest RF is on another mesh k, its result object is that mesh's (`r.nElR = k`, `r.Mo`, `r.secOwn`), with `r.sec = round(secOwn·gN/k)` (meshes are equal arc length, `buildGeometry` `s=Ltot*i/nEl`, so the mapping is exact when the counts nest);
  - spread = (max − min)/max of the controlling vehicle's three RFs; the model carries the study as a non-enumerable `M.conv` for `CALC.validate`.
- **Dashboard:** `validate()`, anchor `"Element count — convergence"`: REVIEW when the spread is over 3%, OK when within, FAIL only below the code minimum; lists the meshes, the three RFs and which vehicles were reported from a finer mesh, with a Worked-in link to the table. The old "Compliant" row remains only as a fallback when no study is attached.
- **Display:** Rating tab panel `rate_mcv` "Mesh convergence — every vehicle rated at …" (all vehicles × meshes, reported value and its mesh); it reaches the Report through the tab (§10). A vehicle reported from another mesh gets a note at the top of its panel (its RF and section on that mesh, and its RF on the worked mesh). The Verification tab's "Run the study" button is replaced by the same table; `MESHCONV` is kept (its `fingerprint` keys `secResults`).
- **Governing provision:** MassDOT Bridge Manual Part I §7.2.7.2B (minimum 10 elements or one per 4 ft of clear span: a minimum; finer meshes are compliant). Checked in the MassDOT PDF.
- **Decision (pending engineer review):** the lowest RF of the three meshes is reported per vehicle (conservative), not the finest-mesh value. On the default arch this keeps the code-minimum ratings (they are the lowest, about 30% below converged).
- **Check case (main → branch, headless, reported RFs):**

| Case | main | branch |
|---|---|---|
| Default 40/10 circular | HS20 0.626, EV3 0.451 (10 el) | unchanged (all vehicles lowest at 10; spread 25% shown) |
| 20/4, ring 20→23.4 in, cover 1.24 ft | H20/HS20 0.419, EV2 0.400, EV3 0.449, T3 0.819 | 0.391, 0.373, 0.415, 0.756 (all from 40 el) |
| 30/6, ring 18 in, cover 1.0 ft | H20/HS20 0.318, EV2 0.304, EV3 0.189 | H20/HS20 0.278 and EV2 0.266 (40 el); EV3 0.189 and the others unchanged (10 el lowest) |
| 40/20 semicircle | HS20 0.262, EV3 0.172 | all 0.000; dashboard "Dead load alone exceeds allowable", 257 psi at SL-R on 40 el (review's 120-el / independent value 261 psi) > 250 |
| 40/10, 4 ft cover; 40/10, 1 lane | — | unchanged (10 el lowest) |

  Hand check (20/4 case, HS20): 10 el 0.419, 20 el 0.396, 40 el 0.391 → reported min = 0.391; the review's independent frame (160 el) converges to the same trend (tool 120 el 0.386).
- **L-1 text:** Manual §1.3.6 ("about 5% below the converged value… slightly unconservative") rewritten with the measured behaviour and the three-mesh rule; the §7 verification note under the 10/20/40/80 table now limits the 5% figure to that load case; the `tribSpan` comment's "about 1.3% from the converged rating" is annotated (live-load station question only); the Model tab step note points to the convergence table.
- **Performance:** default render on an input change 1.15 s (main 1.04 s); 80 ft span 2.5 s (0.9), 120 ft 2.9 s (1.5). Tab changes use the cache (unchanged). The page stays synchronous so every displayed number belongs to one consistent state.
- **How verified:** `node tests/check-syntax.mjs` (all pass); `tests/smoke/phone-layout.mjs --tool arch` (pass); `tests/smoke/project-library.mjs --tool stonearch`: the only differences A vs B are the dashboard row text (the model JSON is identical on the default and after the test's input change); all 14 tabs on default / 30 ft / semicircle with 0 console errors; the table appears in the Report.
- **Saved data:** no key or format change; the study is not saved (recomputed on open).

## 2026-11-07 — PR #1072: https://github.com/mlococo88/All-Structural/pull/1072 — Wheel-load spread capped at the barrel width (BWC; review H-2)

### BWC-1. Merged 6.4.2 distribution width ≤ barrel width   [§4 result change, MORE conservative]
- **Problem (review H-2; open item of 2026-10-12, "Remaining", Art. 6.4.2 slab-width limit not applied):** under deep fill the merged distribution width exceeded the barrel, so part of each axle was spread onto ground beside the arch. One truck at the springing (H = 13.1 ft): 6 + 23 = 29 ft; two trucks at node 9 of the default (H = 9.43 ft): 16 + 16.5 = 32.5 ft, against a 24 ft barrel.
- **Where:** `transDisp` (anchor `width=Math.min(xs[j]-xs[i]+w,lim)`) and `sideBySide` (anchor `const cap=(!conc&&p&&+p.barrelW>0)?+p.barrelW:Infinity;`). Every highway 6.4.2 path (`nodalLL`, `nodalLLByAxle`, the credited-spread 6.4.1 path, `sideBySideAt` and the worked steps) goes through `sideBySide`, so the cap is in one place.
- **Before:**
```js
function transDisp(w,n,c){
  const xs=wheelLinesX(n,c); let best=0,bk=0,bw=0;
  for(let i=0;i<xs.length;){
    let j=i; while(j+1<xs.length&&xs[j+1]-xs[j]<=w)j++;
    const k=j-i+1, width=xs[j]-xs[i]+w, v=k*0.5/width;
...
  const one=f(w,1,c);
...
    const t=f(w,n,c), m=multiPres(n), v=m*t.v;
...
  best.kappa=(best.n===1)?1:best.v/one.v; ... best.one=one; ...
```
- **After:**
```js
function transDisp(w,n,c,cap){
  const xs=wheelLinesX(n,c); let best=0,bk=0,bw=0;
  const lim=(cap>0)?cap:Infinity;
  for(let i=0;i<xs.length;){
    let j=i; while(j+1<xs.length&&xs[j+1]-xs[j]<=w)j++;
    const k=j-i+1, width=Math.min(xs[j]-xs[i]+w,lim), v=k*0.5/width;
...
  const cap=(!conc&&p&&+p.barrelW>0)?+p.barrelW:Infinity;
  const one=f(w,1,c,cap), oneU=conc?one:f(w,1,c,Infinity);
...
    const t=f(w,n,c,cap), m=multiPres(n), v=m*t.v;
...
  best.kappa=(best.n===1&&best.v===oneU.v)?1:best.v/oneU.v; ... best.one=oneU; ...
  best.capW=cap; best.capped=(isFinite(cap)&&best.width>=cap-1e-9);
```
  κ stays relative to the **uncapped** one-truck value, because the callers multiply their one-truck pressure P/((s_g + w_t)·L_s) by κ; so the pressure is now P·m·k·0.5/(min(W, W_barrel)·L_s). With one truck under the cap, κ = 1 exactly as before. When the cap acts on one truck, κ > 1.
- **Not capped:** the 6.4.1 concentrated width E (≤ 7 ft), and rail mode (its own dashboard warning is unchanged).
- **Display:** the "Side-by-side trucks" step (Live Load tab worked example and the per-node worked calculation) is shown whenever the cap acts. Its equation reads min(W_n, W_barrel), and the note says when the barrel width limits the spread.
- **Governing provision:** AASHTO Std. Spec. 17th Ed. Art. 6.4.2 (total distribution width limited to the width of the supporting slab), applied to the arch barrel. **Verify (not in references).** MassDOT BM Pt. I §7.2.7.8B points to the Std. Spec. for the live-load distribution.
- **Check case (default model, node 9, H = 9.427 ft, w_t = 16.497 ft, two trucks):**
  - before: W = 32.497 ft, v = 2·0.5/32.497 = 0.03077, κ = 0.03077/(1/22.497) = 1.3846;
  - after: W = 24 ft, v = 2·0.5/24 = 0.04167, κ = 1.875.
- **Reported RFs, main → branch:**

| Case | main | branch |
|---|---|---|
| Default (10 el governs) | H20 0.690, HS20 0.626, T3 0.822, 3S2 0.901, 3-3 0.998, SU4 0.705, SU5 0.675, SU6 0.638, SU7 0.656, EV2 0.638, EV3 0.451 | 0.623, **0.554**, 0.732, 0.802, 0.888, 0.635, 0.606, 0.564, 0.574, 0.573, **0.401** (the review's §2.4 capped row, to 3 decimals) |
| 40/10, 4 ft cover | HS20 0.729, EV3 0.455 | 0.579, 0.366 |
| 30/6, 18 in ring | T3 0.345, SU7 0.451, EV3 0.189 (H20/HS20 0.278, EV2 0.266 unchanged) | 0.342, 0.442, 0.188 |
| 20/4 (Kingston variant), 40/20 semicircle, Lanes = 1 | — | unchanged |

- **Saved data:** no key or format change. Old projects open with the cap (more conservative). There is no option to switch it off, and no migration: this is a correction toward the provision, not a choice the user made.
- **How verified:** `node tests/check-syntax.mjs`; `tests/smoke/phone-layout.mjs --tool arch`; `tests/smoke/project-library.mjs --tool stonearch` (the only failures are the four A-vs-B identity checks, by design: live-load envelopes and ratings move; undo, dialog, quota and console checks pass); all 14 tabs with 0 console errors.
- **Open item closed:** the 2026-10-12 "Remaining" item (Art. 6.4.2 slab-width limit).

## 2026-11-07 — PR #1075: https://github.com/mlococo88/All-Structural/pull/1075 — Auto element count a multiple of 4; QP / CR labels only on the true nodes (MQN; review M-3)

### MQN-1. Auto count = §7.2.7.2B minimum rounded up to a multiple of 4   [§4 result change]
- **Problem (review M-3):** the auto count was max(10, ceil(S/4)), which is 10 at the 40 ft default. On a 10-element mesh, node 3 sits at 0.3 of the arc (x = 11.38 ft), not at the quarter point (arc 0.25, x ≈ 10.4 ft). §7.2.7.7B and §7.2.2.6 require influence lines and ratings at the quarter points at a minimum.
- **Where:** `readP()`, anchor `const auto=Math.ceil(Math.max(10,Math.ceil(S/4))/4)*4;`.
- **Before:** `const auto=Math.max(10,Math.ceil(S/4));`
- **After:** `const auto=Math.ceil(Math.max(10,Math.ceil(S/4))/4)*4;`. A count the user entered is kept as entered.
- **Governing provisions:** MassDOT BM Pt. I §7.2.7.2B (minimum count), §7.2.7.7B (influence lines at least at the springlines, crown and quarter points), §7.2.2.6 (crown, springlines and quarter points rated). Checked in the MassDOT PDF.
- **Decision (pending engineer review):** the auto count is rounded up rather than adding nodes at the quarter points, because the mesh stays equal arc length. Projects saved with "0 = auto" follow the new auto count; no migration, because auto is still the stored choice. A saved explicit count is unchanged.
- **Check case:** the 40 ft default.
  - Count: min = max(10, 40/4) = 10, and 4·ceil(10/4) = 12 elements.
  - Nodes: QP-L = node 3 at arc 0.25. Convergence meshes become 12, 24, 48 (were 10, 20, 40).
- **Reported RFs, main → branch (lowest of the three meshes, barrel cap in both):**

| Case | main (10/20/40) | branch (12/24/48) |
|---|---|---|
| Default | H20 0.623, HS20 0.554, T3 0.732, 3S2 0.802, 3-3 0.888, SU4 0.635, SU5 0.606, SU6 0.564, SU7 0.574, EV2 0.573, EV3 0.401 | 0.747, 0.677, 0.801, 0.878, 0.972, 0.707, 0.672, 0.628, 0.664, 0.670, 0.439 |
| 20/4 rise (from the finest mesh) | HS20 0.391, EV3 0.415 | 0.391, 0.413 |
| 30/6 rise | HS20 0.278, EV2 0.266, EV3 0.188 | 0.286, 0.273, 0.196 |
| 40/20 semicircle | all 0.000 (dead load overstress) | all 0.000 |
| 4 ft cover | HS20 0.579, EV3 0.366 | 0.643, 0.445 |
| Lanes = 1 | HS20 0.772, EV3 0.549 | 0.938, 0.607 |

  **Less conservative on the default.** The 10-element mesh was the lowest of the three only because of the chord artefact described in MCV-1. With the cap, the converged default is HS20 ≈ 0.78 at 40 el (review §2.4), so 0.677 is still below converged. On the 30/6 case HS20 goes from 0.278 (40 el) to 0.286 (48 el); the review's 120-el value is 0.276, about 3% below the new value. Flagged to the engineer.

### MQN-2. Section names: QP-L / CR / QP-R only on the true node   [display]
- **Where:** `secTag`, anchor `if(n%4===0){named[n/4]="QP-L";named[3*n/4]="QP-R";}`.
- **Before:** `const named={0:"SL-L",[Math.round(n*0.25)]:"QP-L",[Math.round(n*0.5)]:"CR",[Math.round(n*0.75)]:"QP-R",[n]:"SL-R"};`
- **After:** SL-L and SL-R always; CR only when n is even; QP-L / QP-R only when n is a multiple of 4. Any other node is "N<i>".
- **Dashboard:** "Quarter points are not nodes" (REVIEW) when the mesh in use is not a multiple of 4 (a user count). **Model tab:** a new step "Rounded up to a multiple of 4". **Input help:** the row and the manual table say so.
- **How verified:** `check-syntax` (all pass); `phone-layout --tool arch`; `project-library --tool stonearch` (the A-vs-B identity checks differ by design; the others pass); all 14 tabs with 0 console errors; a count of 13 shows the warning.

## 2026-11-07 — PR #1080: https://github.com/mlococo88/All-Structural/pull/1080 — Live Load tab worked nodal pressure built from the solver's per-axle split (LLW; review M-4; display only)

### LLW-1. p_i = f_i · p0 · κ from `nodalLLByAxle`   [display only, no result change]
- **Problem (review M-4):** the worked example on the Live Load tab chose its axles by point sampling: an axle counted, in full, when |x_node − x_axle| ≤ L_s/2. The solver (`nodalLL`) loads a node with the fraction f of its extrados tributary that the footprint covers (`coverFrac`). The printed "q_j = p·b·t_j" then substituted the sampled p but printed the solver's q. In the review's EV3 case (x = −8.75 ft, node QP-L, 10 el) it printed 0.3648 × 1.0 × 4.640 = 2.1014, while 0.3648 × 4.640 = 1.693, a 19% mismatch. SU7 was off by +20%. At some positions the tab said "no axle over this node" while the solver loaded it.
- **Where:** `liveLoadSection()`, contribution loop, anchor `const BA=ARCH.nodalLLByAxle(M,veh,pos,dir), TJ=ARCH.tribSpan(M,jm);`.
- **Before:**
```js
  for(const ax of veh.axles){
    const xa=(dir>0)?pos+ax.x:pos+maxOff-ax.x;
    const reg=ARCH.llRegime(M,xa);
    if(reg.conc){
      ...
    }else if(Math.abs(nd.x-xa)<=Ls/2)contrib.push({ax,xa,
      p:(merged?ax.P/((ARCH.GAGE+wt)*Ls):(ax.P/2)/(wt*Ls))*kW});
  }
```
- **After:**
```js
  const BA=ARCH.nodalLLByAxle(M,veh,pos,dir), TJ=ARCH.tribSpan(M,jm);
  for(const [ai,ax] of veh.axles.entries()){
    const xa=(dir>0)?pos+ax.x:pos+maxOff-ax.x;
    const reg=ARCH.llRegime(M,xa);
    if(reg.conc&&!(reg.r>0)){
      ... (concentrated 6.4.1 branch unchanged)
    }else{
      const cr=(reg.conc&&reg.r>0);
      const LsA=cr?ARCH.TIRE_L+reg.r*H:Ls, wtA=cr?ARCH.TIRE_W+reg.r*H:wt, mgA=(wtA>=ARCH.GAGE);
      const kA=cr?ARCH.sideBySide(p,wtA,false).kappa:kW;
      const f=ARCH.coverFrac(TJ,xa-LsA/2,xa+LsA/2), pp=BA.axP[ai][jm];
      if(pp>0)contrib.push({ax,xa,f,p:pp,Ls:LsA,wt:wtA,merged:mgA,kap:kA,cr,r:reg.r});
    }
  }
```
  The step now reads p_i = f_i · P/((s_g + w_t)L_s) · κ (or the separate-wheel form), with f_i substituted and the tributary limits in a note. An axle on the credited 6.4.1 spread (rate r > 0) is now worked as the spread it is in the solver, not as an interpolated concentrated load.
- **Governing provision:** unchanged (Std. Spec. 6.4.1 / 6.4.2, verify; MassDOT §7.2.7.7B). CLAUDE.md §6: the worked value must reproduce the computed one.
- **Check case (default after #1064 / #1072 / #1075, HS20 at its governing position, node QP-R, 12 el):**
  - p_1 = 0.9942 × 31/((6 + 9.071) × 9.071) × 1.2559 = 0.2831 ksf;
  - p_2 = 1.0000 × … = 0.2848 ksf;
  - Σp = 0.5679;
  - q = 0.5679 × 3.717 = 2.111 k/ft = the solver's 2.1111.
- **How verified:** `check-syntax`; `phone-layout --tool arch`; `project-library --tool stonearch` (results identical A vs B); all 14 tabs with 0 console errors; ratings unchanged (main vs branch, default).

## 2026-11-07 — PR #1087: https://github.com/mlococo88/All-Structural/pull/1087 — MS18 tonnage and MS equivalent for Items 64 / 66 (MS18; review M-2; reporting only)

### MS18-1. Summary panel "MassDOT Items 64 / 66 — MS18 (Allowable Stress Rating)"   [new reported value; no rating change]
- **Problem (review M-2):** MassDOT §7.1.7.2B requires, for stone masonry, the HS20 gross tonnage converted to MS18 with the factor 0.9, and an MS equivalent = MS18 / 1.8, for Items 64 and 66. The Summary of Bridge Rating table header is noted as Allowable Stress Rating. The tool reported only the HS20 tons.
- **Where:** `buildOutput`, right after the `o_dash` panel, anchor `UI.pnl("o_ms18"`.
- **Before:** no such panel.
- **After:** highway mode with HS20 selected shows three worked steps and an Items table:
  - T_HS20 = RF_HS20 × 36;
  - T_MS18 = 0.9 · T_HS20;
  - MS = T_MS18 / 1.8;
  - the table gives Items 64 and 66 the same values, as §7.2.7.11B requires (Inventory only);
  - a reporting note on the Allowable Stress Rating header, and a Worked-in link to the HS20 rating panel.
  The panel reaches the Report through the Summary tab.
- **Governing provision:** MassDOT BM Pt. I §7.1.7.2B (factor 0.9 instead of 0.907185; MS equivalent ÷ 1.8; Allowable Stress Rating header for timber and stone masonry), §7.2.4.2B (MS18 for Items 64/66) and §7.2.7.11B (Inventory only; the same values for both Items). Checked in the MassDOT PDF.
- **Check case:** current default.
  - Inputs: HS20 RF = 0.6765 (shown as 0.677).
  - T_HS20 = 24.35 tons.
  - MS18 = 0.9 × 24.35 = 21.92 t.
  - MS = 21.92 / 1.8 = 12.18.
  - Review's example (old default 22.53 t): 20.28 t and 11.27.
- **How verified:** `check-syntax`; `phone-layout --tool arch`; `project-library --tool stonearch` (only the Summary text differs, by the new panel; the model and ratings are identical); all 14 tabs with 0 console errors; the panel appears in the Report.

## 2026-11-07 — PR #1101: https://github.com/mlococo88/All-Structural/pull/1101 — H vehicles at 12 tons or less also rated with the lane loading (HLN; review M-1)

### HLN-1. Lane loading check, MassDOT §7.2.4.2B   [§4: new check; can only lower a reported rating]
- **Problem (review M-1):** MassDOT §7.2.4.2B (checked in the MassDOT PDF): lane loadings are not used for H20 / HS20 on spans under 200 ft, except that a component rated for an H vehicle at 12 tons or less must also be rated with the lane loading. The same paragraph says to use the Std. Spec. standard lane loading for H20 and HS20. The tool had no lane loading.
- **Where:** new `archLaneVeh`, `archLaneRun` (constants `LANE_W=0.64, LANE_P=18, LANE_DX=2`) before `archConvTable`. `render()`, anchor `archLaneRun(p);   /* HLN (M-1)`, called after `archConvRun`. Rating tab panel `rate_lane`; dashboard row "… lane loading"; vehicle panel note when the lane governs.
- **Before:** no lane rating.
- **After:**
  - **Trigger:** highway mode, and H20 or HS20 reported at 12 tons or less.
  - **Load trains:** the 18 kip concentrated load at the front, then 0.64 klf as 1.28 kip point loads at 2 ft centres. Four loaded lengths: ¼, ½, ¾ and 1 × the axis span, + 4 ft.
  - **Rating:** each train is rated with `ARCH.rateVehicle` (swept both directions, impact and side-by-side κ as for trucks). The worst train is worked in full (`CALC.vehicleSection`).
  - **Reported RF** for the vehicle = min(truck, lane), with `r.truckRF` and `r.laneGov` kept on the result.
- **Governing provisions:** MassDOT BM Pt. I §7.2.4.2B (12-ton rule; Std. Spec. lane loading for H20/HS20; checked). The lane values come from AASHTO Std. Spec. 17th Ed. Art. 3.7 (H20/HS20 lane: 0.64 klf + 18 kip for moment). **Verify (not in references).**
- **Decisions (pending engineer review):**
  1. "H vehicle" is taken as both H20 and HS20, which is conservative.
  2. The uniform load goes through the wheel-load distribution (6 ft gage). That is a narrower spread than a 10 ft lane, so it is conservative.
  3. Lane rating runs on the worked mesh only, not repeated over the three convergence meshes. This is for performance: one lane train costs about 15 trucks.
  4. The 18 kip load sits at the train end (front or back, by sweep direction), not inside the uniform load.
  5. The 26 kip shear concentrated load is not used: the rating is governed by compressive stress, and the optional shear check is off by default.
- **Check case (20/4 rise, ring 20→23.4 in, cover 1.24 ft):** H20 truck RF 0.390 (7.8 t ≤ 12 t), so the check is triggered.
  - Lane RF = 0.680, 0.681, 0.681, 0.681 for L = 9.3, 14.7, 20.0, 25.3 ft.
  - The truck governs, so the reported H20 RF of 0.390 is unchanged.
  - HS20 (14.1 t) is not triggered. On the default (H20 14.9 t) nothing changes.
- **How verified:** `check-syntax`; `phone-layout --tool arch`; `project-library --tool stonearch`: on load identical (not triggered); after the test's input change (H20 1.7 t) the only difference is the new dashboard lane row (truck governs, ratings identical); all 14 tabs on the 20/4 case with 0 console errors; the lane panel appears in the Report.

## 2026-11-07 — PR #1114: https://github.com/mlococo88/All-Structural/pull/1114 — Bed-joint sliding check, HS20 variable axle spacing, stated assumptions and scope (SLD / HSV / ASM; review S-2, L-5, L-3, S-4)

### SLD-1. Bed-joint sliding |V| ≤ μN at every section, reported with D/C   [§4: new advisory check; no rating factor changes]
- **Problem (review S-2):** the only joint check was the optional f_v·A shear rating (off by default), which takes no account of the thrust that actually resists sliding in a masonry joint. The dashboard carried an N/A row "Shear / radial joint sliding".
- **Where:**
  - engine: new `slideScan(model,vehicle,impMode,m,mu)` and `slideDL(model,mu)` just before the comment `/* Rating factor at EVERY section`, exported from `ARCH`;
  - render: new `archSlideRun(p)` before `/* the convergence table`, called in `render()` (anchor `archSlideRun(p);  /* SLD (S-2)`) after `archLaneRun`;
  - Rating tab panel `rate_slide` (after `rate_lane`); dashboard row "Bed-joint sliding |V| ≤ μN (advisory)" in `validate()`, replacing the N/A row "Shear / radial joint sliding";
  - input `mu` (Allowables panel, after f_v; default "0.6"; `readP` `mu:n("mu")`; `restore` and `saNewCalc` set `F.mu`).
- **Before:** `add("na","Shear / radial joint sliding","§7.2.7 rates stone masonry arches on combined compressive stress only. Shear is computed and reported for information but is not a rating check in this procedure.","§7.2.7.9B");`
- **After:** for each selected vehicle, on the mesh its reported rating comes from (`r.Mo` or the worked mesh), swept exactly as `rateVehicle` sweeps it (0.25 ft, both directions, same impact basis, adverse-only split when that option is on), with the live load at m = the reported RF:
  - D/C = |V_DL + m(1+I)V_LL| / (μ (N_DL + m(1+I)N_LL)), maximum over every node and position (N ≤ 0 gives ∞);
  - m at sliding = the largest multiplier with ±(V0 + m·VL) ≤ μ(N0 + m·NL) at every node and position (0 if dead load alone slides);
  - dead load alone: max |V_DL|/(μN_DL) over every node of all three convergence meshes.
  The dashboard row is OK when every D/C ≤ 1 and FAIL ("Friction is exceeded") otherwise. V and N are the section-normal values the stress check already uses (the radial joint at the node).
- **Basis:** not a MassDOT §7.2.7 requirement (§7.2.7 rates on compressive stress only; the MassDOT manual has no sliding provision for arches, checked). The Coulomb friction condition at a joint is the standard one in masonry-arch assessment (Heyman, *The Masonry Arch*, 1982, assumes sliding does not occur and recommends checking it; arch limit-analysis practice commonly takes μ ≈ 0.6 for stone or mortared joints). **Verify (not in references).** μ = 0.6 is the review's judgment value.
- **Decisions (pending engineer review):**
  1. Advisory only: a D/C over 1 is a dashboard FAIL, but the reported §7.2.7 rating is not reduced (the optional f_v rating is still the way to fold a shear limit into the RF).
  2. Load level = the reported RF of each vehicle (the load the rating says the arch carries). A vehicle whose rating is governed by the lane loading is scanned as the truck at that RF.
  3. Joint = section normal at the node; real bed joints may be inclined to it.
  4. Old files have no `mu`; they open on 0.6 (only this advisory check depends on it).
- **Check case (default, 12 el, governing joint SL-L, SU5 at RF 0.672, 1 + I = 1.10):**
  - V_DL = 3.455, V_LL(1+I) = 1.081, N_DL = 27.538, N_LL(1+I) = 2.229 (k/ft);
  - D/C = |3.455 + 0.672 × 1.081| / (0.60 × (27.538 + 0.672 × 2.229)) = 4.181 / 17.42 = **0.240**;
  - dead load alone: 3.455 / (0.60 × 27.538) = **0.209**;
  - other cases: 20/4 rise 0.335 (H20, 48 el), 30/6 rise 0.296, semicircle 0.231, 4 ft cover 0.178. No case slides.

### HSV-1. HS20 rear-axle spacing V = 14 to 30 ft   [§4: can only lower the reported HS20 rating]
- **Problem (review L-5):** HS20 was rated with V = 14 ft only. Std. Spec. Art. 3.7.6 varies V from 14 to 30 ft and uses the spacing that produces the maximum effect.
- **Where:** new `HSV_V`, `archHsvVeh`, `archHsvRun` before `/* the convergence table`; `render()` anchor `archHsvRun(p);    /* HSV (L-5)` between `archConvRun` and `archLaneRun` (so the 12-ton lane trigger and the MS18 panel see the final HS20 value); Rating tab panel `rate_hsv`; HS20 vehicle panel note when a longer V governs; dashboard row "HS20 rear-axle spacing V = 14 to 30 ft".
- **Before:** HS20 = `{x:0,P:8},{x:14,P:32},{x:28,P:32}` only.
- **After:** V = 16, 18 … 30 ft (`{x:0,P:8},{x:14,P:32},{x:14+V,P:32}`) rated with `ARCH.rateVehicle` on the mesh the reported HS20 comes from; reported HS20 RF = the lowest of the nine. A longer V governs only when lower by more than 5e-5. Vehicle ids and saved data unchanged.
- **Governing provision:** AASHTO Std. Spec. 17th Ed. Art. 3.7.6 (variable spacing 14 to 30 ft). **Verify (not in references).** MassDOT §7.2.4.1B lists HS20 for the rating vehicles (checked).
- **Decision (pending engineer review):** 2 ft steps; the longer spacings are rated on one mesh (the reported HS20 mesh), not over all three convergence meshes (performance: 0.15 to 0.9 s per input change).
- **Check case (20/4 rise, ring 20→23.4 in, cover 1.24 ft, 48 el):** V = 14: 0.3905; V = 16 to 30: 0.3900. At V ≥ 16 the rear 32 kip axle is off the 20 ft ring when the drive axle governs; with it on, its thrust helps. Reported HS20 0.391 → **0.390** (14.06 → 14.04 tons). Default: V = 14 governs (0.6765; V = 16: 0.7001, V ≥ 20: 0.7732): unchanged.

### ASM-1. Stated assumption: dead load on the extrados projection (review L-3)   [wording]
- **Where:** Summary `o_basis` panel, new "Stated assumptions" list; dashboard row "Load width measured on the extrados" (anchor `Stated deviation (review L-3)`).
- **After:** says that §7.2.7.3B calculates vertical dead loads along the horizontal length of each element, that this program uses the extrados projection, and by how much (default: 3.8% more surface load, extrados 43.197 ft against axis 41.599 ft); usually conservative, but not certainly, because more dead load also adds thrust. No computed value changes.

### ASM-2. Outside the scope of this model (review S-4)   [wording]
- **Where:** Summary `o_basis` panel "Outside the scope of this model" list and dashboard N/A row "Outside the scope of this model".
- **After:** spandrel walls (overturning, bulging, separation; participation neglected per §7.2.7.4B), passive restraint of the fill, 3-D effects (skew, transverse distribution, longitudinal cracking, edge strips), ring separation, abutments/piers/foundations/scour, and collapse-mechanism capacity.

### How verified
- `node tests/check-syntax.mjs` (all pass); `tests/smoke/phone-layout.mjs --tool arch` (pass); `tests/smoke/project-library.mjs --tool stonearch` (the four A-vs-B identity checks differ only by `M.p.mu` and the new Summary text; the other checks pass);
- headless main vs branch (Playwright, `tests/lib.mjs` `openPage`), reported RFs on seven cases: default, 30/6, semicircle, 4 ft cover, Lanes = 1, 80/16: identical; 20/4: HS20 0.391 → 0.390 only;
- all 14 tabs with 0 console errors on the default and the 20/4 case; the new panels appear in the Report.
- **Saved data:** one new field `mu` in the project file (old files open on 0.6); no key changed.

## 2026-11-07 — PR #1124: https://github.com/mlococo88/All-Structural/pull/1124 — Four-hinge collapse mechanism cross-check (MECH; review S-1; advisory)

### MECH-1. Mechanism load factor λ for every vehicle, beside the elastic rating   [§4: new advisory check; no rating factor changes]
- **Problem (review S-1):** the tool had no collapse-mechanism or thrust-line limit analysis. That check is independent of the elastic mesh, and commercial programs report it.
- **Where:**
  - Engine: new `mechanismSet(model)` and `mechanism(model,vehicle,impMode,mechs)`, placed just before the comment `/* Rating factor at EVERY section` and exported from `ARCH`.
  - Render: new `archMechRun(p)`, placed before `/* the convergence table`. `render()` calls it after `archSlideRun` (anchor `archMechRun(p);   /* MECH (S-1)`).
  - Rating tab: panel `rate_mech`, placed after `rate_slide`.
  - Dashboard: row "Collapse mechanism cross-check (advisory)", placed after the "Outside the scope of this model" row.
  - Text updated to say the factor is an advisory cross-check: the scope bullet in the Summary `o_basis` panel and the scope N/A row.
- **Before:** no mechanism check. The scope list said "collapse-mechanism capacity" was not modelled.
- **After (method):**
  - **Hinge grid:** the nodes of an n_H-element mesh, n_H = 4·ceil(max(24, n1)/4), at most 48. The tool reuses the convergence model when one has that count. The default is 24.
  - **Hinge positions:** each hinge sits on the intrados or the extrados, h = ∓d/2 from the axis along the outward normal. A pinned springing is an axis hinge, h = 0, and is always one of the four.
  - **Kinematics:** the four hinges form a four-bar chain. Block 1 rotates ω1 = 1 about A. ω2 and ω3 come from the velocity of C, which gives two linear equations. Δω = ω_right − ω_left. The mechanism is admissible when every hinge opens: Δω < 0 at an intrados hinge, Δω > 0 at an extrados hinge. Either running sense is tried.
  - **Work:** P = Σ Δω·m, with m = M − P·h, the moment of the elastic section forces about the hinge point. This holds for any set of section forces in equilibrium with the loads, because a self-stress does no work in a mechanism. Then λ = −P_D / P_L over the mechanisms with P_L > 0, with λ = 0 when P_D ≥ 0, i.e. when dead load alone drives the mechanism.
  - **Vehicle sweep:** every selected vehicle, at 0.5 ft steps in both directions. The wheel-load distribution and impact are the same as for the rating, applied as the same nodal loads (`nodalLL`, `llEffects`).
  - **Reported:**
    - a table of λ, the elastic RF, λ/RF and the hinges for each vehicle;
    - the worked mechanism for the vehicle that controls the elastic rating: hinge table, P_D, P_L and λ;
    - the dashboard row: OK when λ ≥ RF for every vehicle; REVIEW when λ < RF for any vehicle; FAIL when dead load alone forms a mechanism.
- **Basis:** rigid-block limit analysis after Heyman (*The Masonry Arch*, 1982): no tension, unlimited compressive strength, no sliding. **Verify (not in references).** It is not a MassDOT §7.2.7 procedure, and the §7.2.7 rating is unchanged.
- **Method check (in the tool, headless):** a semicircular ring under its own weight alone (40 ft span, no fill, no wearing surface, K = 0). Bisecting the ring depth finds the thickness at which a dead-load mechanism first appears:
  - t/R = 0.1062 on a 24-element mesh and 0.1067 on 48 elements (R = axis radius);
  - Heyman's approximate value is 0.106; the exact value usually quoted is 0.1075.
  The small difference comes from self weight lumped along the axis and from hinges only at the nodes. This confirms the signs, the admissibility rule and the kinematics.
- **Check case (default, EV3, which controls the elastic rating at RF 0.439; lead axle x = −4.50 ft, left to right; 24-element grid):**

| Hinge | face | h | Δω | m_D = M_D − P_D·h | m_L |
|---|---|---|---|---|---|
| SL-L | intrados | −1.0 | −1.0000 | −7.457 + 27.508 = 20.051 | −0.827 |
| N8 (x = 12.89) | extrados | +1.0 | 3.5571 | 1.318 − 18.850 = −17.532 | 6.433 |
| N16 (x = 28.71) | intrados | −1.0 | −4.6050 | 1.318 + 18.850 = 20.167 | −2.728 |
| SL-R | extrados | +1.0 | 2.0480 | −7.457 − 27.508 = −34.966 | 8.666 |

  - P_D = −20.051 − 62.363 − 92.871 − 71.610 = −246.895;
  - P_L = 0.827 + 22.882 + 12.564 + 17.749 = 54.022;
  - **λ = 246.895 / 54.022 = 4.570**, which is 10.4 × the elastic RF.
- **Other cases (λ of the controlling vehicle, elastic RF):**
  - 30/6 rise: EV3 1.27 vs 0.196.
  - 20/4 rise: EV2 16.46 vs 0.373.
  - Semicircle: EV3 1.33. Elastic RF 0: dead load overstresses in compression, but no dead-load mechanism forms.
  - 4 ft cover: EV3 7.81 vs 0.445.
  - Lanes = 1: EV3 5.35 vs 0.607.
  - 80/16: EV3 11.55. Elastic 0.
  - Pinned: EV3 2.25 vs 0.782.
  - λ > RF in every case.
- **Decisions (pending engineer review):**
  1. Advisory only; no rating factor changes.
  2. Live load includes the same impact and the same wheel-load spread as the rating. There is no extra spread through the fill and no passive restraint.
  3. Hinges are placed only at the nodes of the 24 to 48 element grid.
  4. Depth is the stress-check depth `dn`, so deterioration enters only through the reduced depth.
  5. The flag is raised only when λ < RF. No λ threshold (e.g. a factor of 2) is imposed.
- **What is missing (recorded as the review asked):**
  - finite compressive strength (crushing at hinges);
  - sliding in the mechanism (the separate SLD check covers sliding at the elastic forces);
  - fill passive pressure and dispersion beyond the wheel-load rules;
  - hinges between nodes;
  - multi-ring separation;
  - MEXE / modified MEXE screening (S-3).
- **Performance:** about 0.1 s per vehicle; 0.5 to 1.1 s per input change for 11 vehicles. It is cached on the inputs, so tab changes do not re-run it.
- **How verified:**
  - `node tests/check-syntax.mjs` (all pass);
  - `tests/smoke/phone-layout.mjs --tool arch` (pass);
  - `tests/smoke/project-library.mjs --tool stonearch`: the four A-vs-B identity checks differ only in the Summary text (the scope wording and the new dashboard row); the model and the ratings are identical, and the other checks pass;
  - headless main vs branch on eight cases (default, 20/4, 30/6, semicircle, 4 ft cover, Lanes = 1, 80/16, pinned): every reported RF identical;
  - all 14 tabs on the default and the semicircle with 0 console errors;
  - the panel appears in the Report.
- **Saved data:** no change.

## 2026-11-08 — PR: nl-arch-a (PR #1188: https://github.com/mlococo88/All-Structural/pull/1188) — Long notes as a bold lead and a list: dashboard checks and every output tab (ARNL-1; display only, no result change)

### ARNL-1. Long notes split into a lead line and a list   [display only] [no result change]
- **Request (engineer, 2026-11-07/08, approved for all apps):** "There are some sections that just have this block of text. Can we split this up into a numbered list or bullets or some other way so it's not just a text that will likely get overlooked because it's too long." Pattern as Spread Footing SFNL-1 / SFNL-2 (#1167). Part 1 of 2: the Summary dashboard checks and the notes of the Summary, Model, Dead Load, Live Load, Vehicles, Earth Pressure, Diagrams, Influence Lines, Rating, Rating Summary, Nodal Results and Verification tabs, and through them the Report. The Manual and the input panel are part 2 (ARNL-2).
- **Rule used:** a note is long if it is over ~300 characters, or has 3 or more sentences and is over ~200 characters, or carries several distinct facts in one paragraph. It becomes a one-line lead (or, in a callout, the callout title is the lead) and a list with bold lead words. Action items ("Check … before reading …", "Do not issue this run.", "Decision pending engineer review: …") are on their own warning-coloured line at the top. Every sentence, number, citation and link is kept, in the same order (an action line is moved first only when it has no digits). New lead words carry no digits, so the digit sequence of every tab and of the Report is unchanged.
- **New helper** (module `R`, before `function badge(`), anchor `/* ARNL (2026-11-08): a long note as a lead line and a list (R.arNL)`:
  ```js
  function arNL(lead,items,o){
    o=o||{}; const L=o.ol?"ol":"ul";
    const li=(items||[]).filter(Boolean).map(x=>"<li>"+(Array.isArray(x)?`<b class="arNLk">${x[0]}</b> ${x[1]}`:x)+"</li>").join("");
    return (o.act||[]).filter(Boolean).map(a=>`<div class="arNLa">${a}</div>`).join("")+
      (lead?`<div class="arNLl">${lead}</div>`:"")+(li?`<${L} class="arNLu">${li}</${L}>`:"");
  }
  ```
  exported as `R.arNL` (`return {step,eqLine,vars,dtab,msg,arNL,badge,…}`); in the application layer also `const arNL=R.arNL;` (the Rating Summary functions have a local `R`). A note `X. Y. Z.` becomes `R.arNL("X.",[["Lead:","Y."],["Lead:","Z."]])` inside the same `msg(…)`, `<div class="note">`, step `note:`, `figcaption` or dashboard detail cell. Items that are `null` are skipped (conditional sentences).
- **CSS** (after `.msg > b:first-child{display:block;}`), no new colours:
  ```css
  .arNLl{font-weight:700;margin:0 0 1px;}
  .arNLu{margin:2px 0 4px;padding-left:20px;}
  .arNLu>li{margin:1px 0;}
  .msg .arNLl{font-weight:400;}
  .arNLa{border-left:3px solid var(--warn);background:var(--warn-bg);padding:2px 8px;margin:2px 0 5px;font-style:normal;color:var(--ink);}
  @media print{.arNLu>li{break-inside:avoid;}}
  ```
- **Report (ARPT walker):**
  - new `arptHasNL(e)` / `arptNL(e,ctx,warn)` after `const arptClean=`: a `.msg`, `.note` or `<p>` holding an `.arNLu` / `.arNLl` / `.arNLa` part becomes Report notes in order — each action line (`warn`), the lead ("Title: lead"), one note per item "• Lead words text"; `warn` as the callout's. Hooked in `arptItems` before the `.msg` branch: `if((cl.contains("msg")||tag==="P"||cl.contains("note"))&&arptHasNL(e)){…arptNL(e,ctx,…).forEach(push);continue;}`.
  - `arptInline`: an `.arNLu>li` reads as " • …", an `.arNLl` / `.arNLa` part gets a trailing space (table cells, captions).
  - `arptStep`: a listed step note is one line ("lead • item • item").
  - `UL`/`OL` branch: the item text is read from the `<li>`'s children (`[...li.childNodes].map(c=>arptInline(c,ctx)).join("")`), same text as before for every existing list, and no double bullet for a nested `.arNLu`.
- **Notes changed** (anchor = the old opening text; each is now a lead plus items). Exact before / after: the PR diff (every changed site carries `/* ARNL */`).
  - Dashboard checks (`CALC.validate`): Element count (convergence and compliance), No fill anywhere, Fill runs out, No wearing surface, Fill spread credited below 2 ft, Shallow-cover distribution, Wheel spread tire patch + 1.75H, One truck transversely, Side-by-side trucks, Wearing surface under railroad loading, Track layout not entered, Cover threshold (rail), Cover at crown < 2 ft, Dead load exceeds / uses most of the allowable, No superimposed dead load, SDL implausibly small, Load width on the extrados, Fill column over the springing, Distribution reaches every table, Adverse influence only, Rail distribution, Transverse spread exceeds the barrel, Deterioration by node number, Ring implausibly thin, Deterioration deeper / implausibly thin, Section loss, Why a thinner ring can rate higher, Moment release, Governing position at the edge, Net tension, Quarter points, Deep elements, Shear rating (both), Stiffness self-check, Shear deformation off, Allowable stress range, Operating level, Bed-joint sliding (both; "(Decision pending engineer review)" is now the action line "Decision pending engineer review: how to treat the exceeded friction."), Outside the scope, Collapse mechanism, Midas verification (both); the Controlling result callout.
  - Summary: MS18 Reporting, Design Basis Method, sign convention "Moment is sagging-positive", stated assumption "Dead load on the extrados projection".
  - Model: elements note, modeled span ≠ clear span, Why this matters (measured), Idealized geometry, Fixed / Pinned springings, Figure 1 caption.
  - Dead Load: components callout, h_f note, SDL note, lateral pressure note, Why not lumped, frame solver callout.
  - Live Load: rail distribution, H note, L_s note, axle footprint note, What happens next (×2), Distribution through fill, 2 ft threshold, fill spread credit, LRFD least fill, Why the footprint, slab width selected, 6.4.1 note, rule switched off, spread basis, one truck, side-by-side, Figure transverse section caption, Why max eccentricity, These positions, coefficients on their own tab, Scope, rail impact, crown / local basis, railroad impact, nodal load, distribution table note, axle matrix "What this table is", adverse only, column totals check.
  - Vehicles: comparison note, unverified trailing loads, check against your figures (action line first), axle-by-axle note.
  - Earth Pressure: three things follow, z note, Δy note, element table note (1 945 characters, was the longest note of the tool), self-balancing load, separate solve note, pressure diagram caption, Why this is here.
  - Diagrams: What is plotted, adverse-only, kern figure caption, Why the stress climbs.
  - Influence Lines: verbatim requirement (now a list, sentence per item), program applies (was a `<p>`, now a `.note` div), Why no cases at the springings, element stiffness note, sign convention, How to read these tables, moment table note, Midas walk-through, walk-through table note, influence line caption, symmetry note.
  - Rating: Every vehicle worked in full, selected section callout and note, mesh convergence table note, lane loading, HS20 V, bed-joint sliding callout and note, mechanism callout, How it is worked, Not included, mesh-reported callout; per vehicle: selected section, axle train note, consist weight, How the position is found, dead load split note, earth dominates, Basis of this worked section, components note, sensitivity, utilization note, Why an iteration (the §7.2.7.12 text, sentence per item), convergence criterion, iteration note, Why not 1/(f/f_a), Outside §7.2.7, shear capacity, shear table note, EV reporting.
  - Rating Summary: How to read, table note, tonnage note, two sections close, mirror note, symmetry check.
  - Nodal Results: three depths, distribution note, component notes (moment, units), combined results note, thrust line note, worked node Scope, (n_x, n_y), axle footprint, t_j, 6.4.1 axles, z note, frame solve callout.
  - Verification: Purpose callout, Midas step 3, dead load cases, import format, import status, mesh study text; comparison block (shown only after a Midas import): sign mapping, agreement, scaling note, dead load components.
- **Not changed:** notes under ~200 characters; the RF ≥ / < 1.0 callouts; the "Worked in" lines; numbered list `{ol:true}` is supported by the helper but not used (an `<ol>` would put new digits "1. 2." in the Report text).
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data:** none (§5).
- **Check case:** default project, Earth Pressure tab, panel "Lateral pressure on each element": before one 1 945-character paragraph with `<br><br>` breaks; after the lead "How to read the table:" and seven items (Direction, Resultant, θ, p_h is the load., Midas, Everything here is on the arch axis., Vertical fill load), "θ near 90°", "bPROJ = YES" and "§7.2.7.5B" unchanged. Report §7.2: the same lead and seven "• " lines.
- **How verified:** headless Chromium, origin/main vs the branch, six cases (default; railroad; 60/12 pinned shallow cover with deterioration; 25/8 parabolic deep cover adverse-only; 50/14 cover 1.0 ft with shear and μ = 0; 30/10 deep fill K = 0.30 f_a = 300 3 lanes): every vehicle result (`results`, deep compare) and the model `M` identical; the digit sequence of every tab, the input panel and the Report text identical in all six (the run-time figures "rated in … s" / "Computed in … s" masked). 0 console errors, 0 KaTeX errors. Screenshots at 1440 and 390 px. Tests: see the PR.
- **Other copies:** none.

## 2026-11-08 — PR: nl-arch-b (PR #1192: https://github.com/mlococo88/All-Structural/pull/1192) — Long notes as a bold lead and a list: the User Manual and the input panel (ARNL-2; display only, no result change)

### ARNL-2. Manual and input-panel paragraphs as a lead and a list   [display only] [no result change]
- **Request:** as ARNL-1 (#1188), part 2 of 2. Uses the same helper and classes (`R.arNL`, `.arNLl`, `.arNLu`, `.arNLk`).
- **Input panel (`inputPanel`, `deterRender`):**
  - Ring Depth hint, anchor `One row per deteriorated area`: becomes a lead plus "Empty cell / Units / Face".
  - Deterioration editor hint, anchor `Stations are in feet along the span`: becomes a lead plus "Point or zone / Stays put".
  - Superimposed Dead Load note, anchor `§7.2.7.4B requires the dead load of sidewalks`: becomes three items.
- **Manual (`MANUAL.PARTS`, static HTML):** every `<p>` / `<li>` whose text is over 500 characters (45 paragraphs) is rewritten as follows:
  - a `<p>` becomes `<div class="arNLl">first sentence</div><ul class="arNLu"><li><b class="arNLk">Lead words</b> sentence(s)</li>…</ul>`;
  - an `<li>` keeps its first sentence and gains a nested `ul.arNLu`;
  - the long enumerations (1.1 MassDOT provisions, 2.2 Earth Pressure / Influence Lines contents) become one item per element.
  - Sentences are unchanged and in the same order; lead words carry no digits. Exact before / after: the PR diff.
- **CSS** (after `.manpart ul,.manpart ol{…}`): `.manpart .arNLl{font-size:.99rem;margin-top:6px;} .manpart .arNLu{margin:2px 0 8px;padding-left:22px;}`.
- **Decision (pending engineer review):** Manual paragraphs of 300 to 500 characters (about 50) are left as prose. The Manual is reference reading under numbered headings, and those paragraphs run 3–4 sentences. Say if they should be split too.
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data:** none.
- **Check case:** Manual §1.3.6, paragraph `§7.2.7.2B sets a minimum of 10 elements`. Before: one 930-character paragraph. After: the lead "§7.2.7.2B sets a minimum of 10 elements or one per 4 ft of clear span." followed by the items "Convergence testing / Why / Therefore", with the 27 %, 30 %, 15 % and 0.26 figures unchanged.
- **How verified:** headless Chromium, main (after #1188) against the branch, default and a deteriorated shallow case. Results, the model, the digit sequence of every tab (the Manual with all parts shown), the input panel and the Report are identical. 0 console errors.
## 2026-11-08 — PR: nl-arch-c (PR #1198: https://github.com/mlococo88/All-Structural/pull/1198) — Rating summary as a left column of check chips from 1200 px (ARDC; display only, no result change)

### ARDC. Left summary column   [display only]
- **Request (engineer, 2026-11-07/08):** add the left summary panel, as in Retaining Wall (#959, #984), Spread Footing (#988), Light Pole (#991, #994/#997) and Shear and Moment Diagrams (#1130). The panel has compact check chips, a « collapse with a per-tool key, and a chip click opens the working card. It is shown from 1200 px; below that nothing changes.
- **What changed (screen only):**
  - New `<aside id="arDashCol" class="noprint">` as the first child of `#wrap`, before `#inPanel`. Anchor: `<!-- ARDC (2026-11-08)`.
  - From 1200 px, `#wrap` gets three columns: `280px minmax(360px,0.9fr) 2.6fr`, with 240 px from 1200 to 1499.98 px.
  - Collapsed (`body.arDashColl`), the column is a 42 px strip showing the « / » button and the count badges.
  - Below 1200 px `#arDashCol` is `display:none` and the grid rules do not apply, so the tablet / phone layout and order are unchanged. It is hidden in print.
- **Chips** (`archDash(p,msg)`, called at the end of `render()` after `postRender(p)`; the two early returns pass a message):
  - one per rated vehicle: "RF · tons (· E-number) · governing section", PASS / FAIL → Rating · `veh_<id>`;
  - H lane loading, where rated: RF, PASS / FAIL → `rate_lane`;
  - MS18 (Items 64 / 66): metric t and MS, no status → Summary · `o_ms18`;
  - Mesh convergence: spread % and meshes, OK when ≤ 3 %, else REVIEW → `rate_mcv`;
  - Bed-joint sliding (advisory): worst D/C, OK / NG → `rate_slide`;
  - Collapse mechanism (advisory): λ against the elastic RF, REVIEW when a dead-load mechanism forms or λ < RF → `rate_mech`;
  - "Other dashboard checks": the number of FAIL and REVIEW rows of `checks` → Summary · `o_dash`.
  - Head: the count badges "n FAIL" / "no FAIL" and "n REVIEW".
  - Values come from the same expressions as the dashboard, with the same rounding.
  - A chip click calls `archGoto(tab, card)`: the tab opens, the card expands, scrolls under the sticky bar and flashes (§6).
- **Saved data (§5):** none changed. New per-browser UI key `stoneArchLR.dashCollapsed.v1` ('1' = strip), tool-prefixed. It is written only by the « / » button and is not in the project or the autosave.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **Decisions (pending engineer review):**
  1. The chips are the vehicle ratings plus the advisory and convergence results that have their own worked card. The other ~30 dashboard rows are summarised in one "Other dashboard checks" chip that opens the dashboard: most of them carry no single value.
  2. The column sits left of the input panel, as in Shear and Moment Diagrams; the inputs and the output keep their columns.
  3. The column scrolls on its own, like the two panels.
- **Check case (default project):**
  - Chips: H20 RF 0.747 · 14.9 t · SL‑L FAIL; … EV3 (Inv basis) (governs) RF 0.439 · 18.9 t · SL‑R FAIL; MS18 21.92 t · MS 12.18 (HS20 24.4 t × 0.9); Mesh convergence spread 18.7 % · 12, 24, 48 el REVIEW; sliding and mechanism lines; "Other dashboard checks".
  - Head: "11 FAIL", "2 REVIEW".
- **How verified:** headless Chromium at 1920 / 1440 / 1280 / 1024 / 390 px:
  - column 280 / 240 / 240 px, then not shown at 1024 and 390;
  - no sideways scroll;
  - a chip click opens Rating · H20;
  - « gives a 42 px strip and writes `'1'`;
  - 0 console errors;
  - origin/main against the branch: results, the model and every tab's text identical (see the PR).
- **Other copies:** none.

## 2026-11-08 — PR: claude/nl-arch (PR #1247: https://github.com/mlococo88/All-Structural/pull/1247) — Report: listed step notes as list notes (bold lead and bullets) instead of one line with "•" (ARNL-3; display only, no result change)
### ARNL-3. Report step notes written with arNL: shared list notes   [display only] [no result change]
- **Request:** the open item of `fixlog/shared-report.md` (SNL, PR #1240): the Report's worked steps whose note the tab writes with `R.arNL` (ARNL-1) were flattened to one italic line "lead • item • item" (`arptStep`, ARNL-1), 13 different notes, each over 300 characters. SNL made a step's note a list note `{ lead, items: [[lead, text] | text, …], action? }` (shared/steps.js), drawn by shared/report.js as a bold lead and bullets.
- **Where:** `arptStep(o,id)` (Report, anchor `function arptStep(o,id){`) and the new `arptNoteList(nt)` right after it (anchor `/* ARNL-3 (2026-11-08): a step note written with arNL`).
  - Before:
    ```js
    nt.querySelectorAll(".arNLl,.arNLa").forEach(x=>x.append(" ")); nt.querySelectorAll(".arNLu>li").forEach(li=>{li.prepend("• ");li.append(" ");});   /* ARNL: a listed step note on one line */
    …
        ref:o.ref||"",note:arptClean(nt.textContent).replace(/§(?=[A-Za-z])/g,"§ ")});
    ```
  - After:
    ```js
    const nl=arptNoteList(nt);   /* ARNL-3 … */
    nt.querySelectorAll(".arNLl,.arNLa").forEach(x=>x.append(" ")); nt.querySelectorAll(".arNLu>li").forEach(li=>{li.prepend("• ");li.append(" ");});   /* … (ARNL-3: now only a note arptNoteList does not take) */
    …
        ref:o.ref||"",note:nl||arptClean(nt.textContent).replace(/§(?=[A-Za-z])/g,"§ ")});
    ```
    `arptNoteList(nt)`: when the note's top-level parts are only `.arNLa` (action lines), `.arNLl` (lead) and `.arNLu` / ol lists (at least one list), it returns `{ lead, items, action? }`; else `null` (the one-line form, as before). Each piece is `arptClean(text).replace(/§(?=[A-Za-z])/g,"§ ")`, the same text the one-line form had. An item that starts with a bold lead word (`.arNLk`) ending in `:` `.` `?` `!` or `—` becomes `[lead, rest]` (bold lead word in the Report); any other item stays one plain string, so a lead word that starts the sentence ("h_f is the fill height …", "Near the crown Δy goes to zero …", "Here z = 13.399 ft …") gets no ": " after it.
- **Notes converted (default project; the first two are repeated per vehicle, 16 times each):** Convergence criterion; Utilization against the allowable; Elements used in this model; Vertical dead load intensity at a node; Superimposed dead load distributed across the barrel; Lateral earth pressure intensity; Equivalent nodal load; Lateral pressure at the arch axis; Total horizontal force on an element; Mirror symmetry of the tables; Radial direction of the section, from vertical; Depth to the arch axis, for the lateral pressure (13 different notes in 42 steps). Every other step note (203 steps) is a plain string, unchanged.
- **Governing provision:** none changed (the §7.2.7.x citations in the notes are the same text).
- **Check case:** default project, Report, step "Elements used in this model: n_el = 12". Before (plain text): `Elements used in this model: n_(el) = 12 (1.2× the code minimum. • Floor: The minimum is a compliance floor, not evidence of convergence. • Mesh study: Every vehicle is also rated at about two and four times the count in use and the lowest rating is reported; the worked steps use the mesh on which the controlling vehicle rates lowest (Rating tab, Mesh convergence).)`. After: `Elements used in this model: n_(el) = 12`, then the indented lines `1.2× the code minimum.`, `• Floor: The minimum is a compliance floor, not evidence of convergence.`, `• Mesh study: Every vehicle is also rated …`. On screen and in print: bold lead, bullets with bold "Floor:" / "Mesh study:".
- **How verified:** origin/main vs branch, headless Chromium, default project: `__archRptForTest().results` identical; the text of all 19 input and output tabs identical (the run-time lines "rated in x s" / "Computed in x s" masked); the Report `.rp-doc` textContent, `SharedReport.text(doc)` and `text(doc, { legacy: true })` with the same digit sequence; of the 393 `.rp-step` elements, 42 differ, each only in its note markup (`rp-nt rp-ntl`); 0 console errors, 0 KaTeX errors. Tests: `node tests/check-syntax.mjs`, `node tests/engine/run.mjs`, `tests/smoke/phone-layout.mjs --tool arch`, `tests/smoke/project-library.mjs --tool stonearch`.
- **Other copies:** none.
