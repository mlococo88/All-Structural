# Fix log — Stone Masonry Arch Load Rating.html

Governing basis used for fixes: AASHTO Standard Specifications for Highway Bridges, 17th Ed. (2002), Art. 6.4 (as cited by the tool); AASHTO Manual for Bridge Evaluation (MBE) Art. 6A.4.4.2.1 specialized hauling vehicles (SU4–SU7); MassDOT LRFD Bridge Manual Part I §7.2.7 (procedure, unchanged).

## 2026-10-04 — PR: claude/fix-stone-arch (PR link added after merge)

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

## 2026-10-04 — PR: claude/step1-group2 (PR link added after merge)

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

## 2026-10-09 — PR: claude/tabs-arch (PR link added after merge)

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

## 2026-10-12 — PR: claude/sweep-stonearch (open-item sweep; PR link added after merge)

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

## 2026-10-18 — PR: claude/arch-d11-report (PR link added after merge)

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

## 2026-10-19 — PR: claude/aashto10-stone-arch (PR link added after merge)

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
