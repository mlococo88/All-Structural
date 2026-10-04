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

## Open items (not changed)
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
