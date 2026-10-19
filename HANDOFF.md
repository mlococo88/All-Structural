# HANDOFF.md — How the tools pass data to each other

This file is the specification for every cross-tool data hand-off. Any tool that sends or receives data must follow it. If you change a channel, update this file in the same PR.

## 1. Transport

- Hand-offs go through **browser localStorage**, using keys under the existing namespace **`bridgeSuite.v1.`**.
- All tools share one storage origin in two situations:
  - Opened from the website (`https://mlococo88.github.io/All-Structural/…`): any browser, including phones.
  - Opened as files from one folder: Chrome or Edge only. Other browsers keep each file separate.
- **File fallback.** Every sending tool also offers **"Export hand-off (JSON)"**, and every receiving tool offers **"Import hand-off (JSON)"**. The file contains exactly the payload described below. This also lets a hand-off go into a calc package, or move between devices.

## 2. Common envelope (every channel)

```js
{
  _schema: "bridge-<channel>",      // fixed per channel, see §4
  schemaVersion: 1,                 // bump only for breaking changes
  producer: "<tool display name>",  // e.g. "Bridge Geometry"
  producerFile: "<file>.html",
  producedAt: "<ISO 8601 timestamp>",
  project: { name: "", bridgeId: "" }, // from the shared project info if available, else the tool's own title block
  units: { ... },                   // explicit units for every numeric field, see §4
  notes: [ "..." ],                 // free-text caveats the receiver must display
  /* channel payload fields */
}
```

- **Data key:** `bridgeSuite.v1.<channel>`.
- **Timestamp key:** `bridgeSuite.v1.<channel>.updatedAt`, holding the same `producedAt`.
- **Adoption marker:** `bridgeSuite.v1.<channel>.adopted.<receiverId>`, holding the `producedAt` of the last payload that receiver adopted. The receiver uses it to show "new data available".

## 3. Rules for senders and receivers

1. **The receiver decides when to pull.**
   - A receiver never changes its inputs without the user clicking **"Pull from <producer>"**, or an equivalent import.
   - Before applying anything, it shows the producer, the time, the project, and a summary of what will be overwritten.
2. **Check before using.**
   - The receiver checks `_schema` and `schemaVersion ≤ supported`. If either fails, it refuses with a clear message.
   - Every numeric field is validated (finite, sensible sign).
3. **Units and basis are explicit.**
   - Every payload states its units.
   - Every force/moment payload also states whether values are **factored**, and whether **dynamic load allowance (IM)**, **distribution factors (DF)** and **multiple presence** are included.
   - Receivers convert or refuse; they never guess.
4. **Record the source.** After adopting a payload, the receiver records its source (producer, producedAt) in its own saved state. It also prints that source in its report, e.g. "Spans from Bridge Geometry, 2026-10-05 14:02".
5. **No silent overwrite on load.** Opening a tool never auto-applies a hand-off. A banner such as "New data from X available" is fine.
6. **Additive only.** Existing storage keys and saved-project formats are not changed (CLAUDE.md §5). Hand-off state lives in new optional fields.
7. **Keep it simple.** Senders write their channel on an explicit **"Send to other tools"** button. Senders that already auto-publish (lldf, psbeam, stgirder) may keep doing so.
8. **Copy the shared helper.** Each tool carries its own copy of the shared helper (§5); per CLAUDE.md §3 it stays duplicated. List the files that contain it in the PR.

## 4. Channels

Fields marked *(existing)* already exist; their schemas are documented in `AUDIT.md` §1.3. They must not be changed incompatibly.

| Channel key (`bridgeSuite.v1.` + …) | `_schema` | Sender(s) | Receiver(s) |
|---|---|---|---|
| `projectMeta` | `bridge-project-meta` | any tool | every tool |
| `lldfGeom` *(existing)* | `bridge-lldf-geometry` | index (MCT), psbeam, stgirder, **Bridge Geometry** | lldf |
| `lldf` *(existing)* | `bridge-lldf-factors` | lldf | index, psbeam, stgirder, **Moving Load Generator**, **Steel Bridge Beam Modules** |
| `dlLoads` *(existing)* | `bridge-dl-loads` | lldf | index, psbeam, stgirder |
| `superReactions` | `bridge-super-reactions` | psbeam, stgirder, index (MCT) | Bridge Substructure Loading |
| `abutmentLoads` | `bridge-abutment-loads` | Bridge Substructure Loading | abutment_calculator |
| `foundationLoads` | `bridge-foundation-loads` | abutment_calculator, Bridge Substructure Loading | Pile Designer, Spread Footing |
| `buildingLoads` | `bridge-building-loads` | ASCE7-16 Load Generator | Steel Beam Design |
| `memberReactions` | `bridge-member-reactions` | Steel Beam Design | BasePlateAnchorDesigner, Spread Footing |
| `girderDemands` | `stgirder-external-demands` (ST-Girder's existing imported-demands schema, §4.9) | Steel Bridge Beam Modules (GirderDetail) | stgirder |

### 4.1 `projectMeta`

This matches the existing BridgeLocks "project" channel (`index.html`).

```js
{ ...envelope, _schema:"bridge-project-meta",
  fields: { projectName:"", bridgeId:"", jobNo:"", client:"", location:"",
            preparedBy:"", checkedBy:"", date:"" } }
```

- Each tool maps these fields onto its own title-block fields. Fields a tool doesn't have are ignored.
- Each tool offers **"Use shared project info"** (pull) and **"Share project info"** (publish).
- Steel Bridge Beam Modules / GirderDetail (since 2026-10-15) maps them onto its one project title block (top of the page): `projectName` → Project name, `bridgeId` → Bridge / structure No., `jobNo` → Project No., `preparedBy` → Computed by, `checkedBy` → Checked by, `date` → Date; `client` and `location` are not used. (Before, the same fields of each module's calculation header, without `bridgeId`.)
- Section Property Calculator (added 2026-10-10, receiver id `sectionProps`) maps `projectName` → Project, `jobNo` → Job #, `client` → Client, `preparedBy` → Prepared by, `checkedBy` → Checked by, `date` → Date; `bridgeId` and `location` are not used. It uses no other channel (Phase 1).
- Gusset Plate Rating (added 2026-10-05) has all eight fields: `projectName`, `bridgeId`, `jobNo`, `client`, `location`, `preparedBy`, `checkedBy` map to its Calculation header fields of the same names, and `date` maps to its "Date" (prepared) field. It uses no other channel.

### 4.2 `lldfGeom` (existing; Bridge Geometry becomes a sender)

- Bridge Geometry must write exactly the shape `lldf.html` already consumes. `lldf.html` is the reference: see `K_GEOM` and its reader. Span lengths, girder spacings and skew are in **feet** and **degrees**.
- Bridge Geometry sets `producer:"Bridge Geometry"` and adds `notes` stating that the spans are measured along the abutment-to-abutment chord, and how skew is defined.
- Shape Bridge Geometry writes (clarified when it became a sender):

  ```js
  { ...envelope, _schema:"bridge-lldf-geometry", producer:"Bridge Geometry", producerFile:"Bridge Geometry.html",
    project:{ name:"", bridgeId:"" },            // envelope object (§2); MCT / PS-Beam / ST-Girder still send a plain string
    units:{ spans:"ft", spacings:"ft", skew:"deg", OL:"ft", OR:"ft" },
    basis:{ spans:"chord, support centerlines"|"chord, bearing lines", skew:"moment"|"max"|"min"|"mean", girders:"global"|"<span no.>" },
    Nb:<girders>, de:null,                       // Nb only when spacings are sent; d_e is not sent
    inputs:{ spans:[ft…], spacings:[ft…, left to right], skew:<deg, ≥0>, OL:<ft>, OR:<ft>,
             ts:<in>, depth:<in> },              // ts / depth optional (Bridge Geometry #148)
    skewDetail:{ bySupport:[{name, skew:<deg, signed, as entered>}…], absMin, absMax, maxAdjacentDiff,
                 moment:<deg>, shear:<deg>, sent:<deg> } }   // optional, Bridge Geometry only
  ```

  - `basis.skew` says what the single `inputs.skew` is: `"moment"` (default) = the skew for moment DFs, i.e. the smallest |skew|, or 0 when adjacent supports differ by more than 10° (AASHTO LRFD Art. 4.6.2.2.2e); `"max"` = the largest |skew| (the shear value, Art. 4.6.2.2.3c); `"min"` / `"mean"` = the smallest / average |skew|.
  - `inputs.ts` (deck structural thickness) and `inputs.depth` (default beam depth, top to bottom of beam) are in **inches**, and are sent unless the engineer unticks them. `units` then also has `ts:"in"`, `depth:"in"`.
  - `skewDetail` (optional, additive): the per-support skews and the values for each action. `moment` = the moment value above; `shear` = the largest |skew|; `sent` = `inputs.skew`. **lldf reads it**: when `moment` and `shear` are valid numbers (|θ| < 90), lldf sets its θ = `moment` and its separate shear skew θ_V = `shear` (blank when equal), whichever single value was sent. So one hand-off gives both moment and shear DFs (fixlog/lldf.md 2026-10-12 SW3). A payload without a valid `skewDetail` (MCT, PS-Beam, ST-Girder, older Bridge Geometry) sets θ and clears θ_V. lldf does not save `skewDetail`; it saves only the resulting `skew` / `skewV` inputs.

  - `inputs` uses lldf's own input names. `OL`/`OR` are deck edge to exterior girder centerline. `spacings`, `OL`, `OR` and `Nb` are left out when Bridge Geometry has fewer than two girders, and the `notes` say so.
  - The engineer picks the `basis` choices in Bridge Geometry's send dialog; each choice is also stated in `notes`.
- lldf (receiver) accepts `project` as a string or an object, refuses any unit other than ft/deg, and validates every number. It has a **"Pull from <producer>"** button with a new-data dot and **"Import hand-off (JSON)"**. Both raise its existing prefill banner, which lists what will be overwritten and the sender's `notes`. It records the adopted source as the optional `geomSource` field in its saved state, and prints it below the title block.
- lldf's "Lock" (auto-follow) on this channel stays for MCT, PS-Beam and ST-Girder. It is **not** offered for, and never auto-applies, a Bridge Geometry payload (§3.5).

### 4.3 `lldf` (existing; new receivers)

- Receivers read the fields that `lldf.html` already publishes (`governing…`, `governingNeg…`, fatigue `fatM`/`fatV` where present).
- Moving Load Generator maps them to its per-span DF inputs. It must use the **fatigue** factors for the fatigue truck if it supports per-vehicle factors; otherwise it warns.
- Steel Bridge Beam Modules maps them to its DF module.
- Receivers must state whether multiple presence and skew are included; lldf includes both.
- Existing envelope differences (kept for the existing receivers): lldf writes the keys itself, not through `BridgeXfer.publish`. `producer` is `"LL & DL Distribution"`, there is no `producerFile`, and `project` is a **string** (lldf's project field), not `{name, bridgeId}`. Receivers must accept both shapes.
- Fields added for Moving Load Generator (additive; existing receivers ignore them):
  - `governingBySpan`: array, one entry per span (index *i* = span *i*+1), each with the same shape as `governing` (`interior`, `exterior`, `byBeam`), computed for that span alone (L = that span).
  - `units: { spans:"ft", S:"ft", skew:"deg", laneWidth:"ft", df:"lanes per girder (dimensionless)" }`. Payloads from before this field existed are also in ft/deg (lldf has no other unit system).
  - `multiplePresenceIncluded: true`, `skewIncluded: true` (they describe `gM`/`gV`). `fatM`/`fatV` are the one-lane DF ÷ 1.2 (no multiple presence), skew included.
- Optional fields added 2026-10-12 (lldf fixlog SW3 / SW6; absent otherwise, so other payloads are unchanged):
  - `skewShear` (deg): lldf's separate shear skew θ_V, sent only when one is entered. `skew` is then the **moment** θ. `gV`/`fatV` already include the shear correction at θ_V, and `gM`/`fatM` the moment reduction at θ. A receiver that compares or shows the skew must use `skewShear` for shear (or the larger of the two), not `skew`.
  - `perFootStrip: true`: sent for the cast-in-place slab type (`bridgeType:"slab"`). Then `gM`/`gV`/`fatM`/`fatV` are per **1-ft strip of slab width** (AASHTO LRFD 4.6.2.3), not per girder, although `units.df` still reads "lanes per girder". A receiver must not use them as a girder DF.
  - What each receiver does with them:
    - MCT Generator (index.html), PS-Beam, ST-Girder and Steel Bridge Beam Modules **refuse** a `perFootStrip` payload (nothing applied; a locked channel shows the warning state). They need girder factors and cannot convert a strip factor (no strip-to-girder width is defined).
    - Moving Load Generator **applies** a `perFootStrip` payload as sent, because a slab-strip line analysis is a valid use. The pull dialog, the DF source line, the printed report and the results warnings say that the results are per foot of slab width, not per girder. The saved `lldfSource` gets the optional `perFootStrip: true`.
    - Moving Load Generator shows `skewShear` in the pull dialog header. Steel Bridge Beam Modules compares `skewShear` (when present) with its bridge's largest skew. MCT, PS-Beam and ST-Girder do not read the payload skew; their DFs come in with the skew corrections already applied.
- lldf also offers **"Export DF hand-off (JSON)"**, which writes the same payload to a file.
- Steel Bridge Beam Modules / GirderDetail (receiver id `girderdetail`): its LLDF and DLs module computes its own factors from the bridge in Preliminary sizing, and those still feed Preliminary sizing. The hand-off fills the **existing** manual-factor inputs of the Structural analysis module (`sa.dfSrc = 'manual'`, `sa.dfm`) for the girder being analyzed; the "Live load distribution factors" select is the on/off switch (it stays "From the LLDF and DLs module" until the user confirms a pull). The user picks lldf's interior/exterior envelope for that girder's type (default) or lldf's beam with the same number (`byBeam`, only when both tools have the same number of girders). `governingBySpan[i]` `gM`/`gV`/`fatM`/`fatV` go to span *i* (`governing` for every span when the payload has no `governingBySpan`); `governingNeg.gM` goes to every pier region. A different span count is refused; different span lengths, girder count, skew or cross-section type are warned. The source is saved in the new optional field `sa.dfImport` and printed in the Structural analysis report.
- Moving Load Generator (receiver id `movingLoad`): the user picks interior, exterior or a single beam (`byBeam`), defaulting to lldf's design beam when present. `gM`/`gV` from `governingBySpan[i]` go to span *i* (or `governing` for every span when the span counts differ or the payload has no `governingBySpan`). `governingNeg.gM` goes to the one negative-moment DF. Spans are compared and only overwritten when the user ticks the option. `fatM`/`fatV` are shown and quoted in the fatigue-truck warning but not applied, because the tool has one DF set for all vehicles.

### 4.4 `superReactions`

```js
{ ...envelope, _schema:"bridge-super-reactions",
  units:{ force:"kip", length:"ft" },
  factored:false, imIncluded:false, dfIncluded:false, perGirder:true,
  supports:[ { id:"Abut 1"|"Pier 1"|…, x:<ft from start>,
               girders:[ { label:"G1", DC1:<kip>, DC2:<kip>, DW:<kip> } ] } ],
  liveLoad: null | { basis:"per lane, no IM, no DF", supports:[{id, Rmax:<kip>, Rmin:<kip>}] } }
```

- Unfactored dead-load reactions are given per girder, per support.
- Live load is optional and informational, because Substructure Loading computes its own LL.
- psbeam and stgirder model a single girder line: they send their girder, labelled by the design-beam selection, and say so in `notes`.
- **Clarifications (added with the psbeam/stgirder → Substructure Loading connection):**
  - *Two producers, one channel.* Each sender writes the channel key as usual and also keeps a copy of the same stamped payload at `bridgeSuite.v1.superReactions.by.<id>` (`psbeam`, `stgirder`, later `mct`). The receiver lists every valid copy, so the user can pick one when both girder apps have sent. `updatedAt` and `adopted.<receiverId>` stay on the channel key only.
  - *Support ids.* A sender that does not know the bridge's support names may use `"Support n"`, numbered from the start of its own model (a simple span is `Support 1`, `Support 2`; span *i* of an imported MIDAS model is `Support i`, `Support i+1`). The receiver maps ids to its own supports in the pull dialog.
  - *Optional fields.* `girderLine:{ label, position:"interior"|"exterior", beamIndex:<n>|null, source }`, `span:{ index:<n>|null, length:<ft> }`, `girders[].position`, and `liveLoad.vehicle` (text). Receivers must not require them.
  - *DC1 content.* DC1 is everything on the non-composite girder: girder self-weight, deck and haunch, other non-composite DC and diaphragm point loads. `notes` list the terms.
  - *Imported MIDAS demands.* When a sender works from imported MIDAS demands, its DC2/DW (and DC1 where imported) reactions are the imported shears at the two ends of the selected span, sign-corrected to + up. At an interior pier that is this span's share only, and `notes` say so; the receiver offers "add to the existing values" for the other span's share. `liveLoad` is `null` in that mode.
  - *Receiver id.* Bridge Substructure Loading uses `receiverId` `subloads`.

### 4.5 `abutmentLoads`

- The payload is the existing SubLoads `subloads-abutment-v1` export, wrapped in the envelope, with `_schema:"bridge-abutment-loads"`.
- The abutment calculator maps it onto its inputs, and lists every field it does not use.
- **Clarifications (added with the SubLoads → abutment calculator connection):**
  - *Shape.* The export's top-level fields (`schema:"subloads-abutment-v1"`, `app`, `exported`, `specification`, `bridge`, `abutments[]`) are kept as they are. The envelope `project` is `{ name, bridgeId }`; the export's own project block (`P.meta`) moves to `meta`. `units` is the export's `units` plus `bearingPad:"in"`, `shearModulus:"ksi"`, `unitWeight:"kcf"`, `windSpeed:"mph"`, `temperature:"degF"`, `angle:"deg"`, `elevation:"ft"`.
  - *Basis flags.* `factored:false`, `perGirder:true`, and for LL `imIncluded:true`, `dfIncluded:true`, `multiplePresenceIncluded:true`: the LL+IM values are total bearing reactions per girder from SubLoads' lane search, not per lane. `basis` states this and the sign convention in words (P + down; Vx + toward the span; Vy and y + left looking ahead station). Horizontal forces are already this abutment's stiffness share.
  - *Sender.* SubLoads' header has **"Send to Abutment Calculator"** (publishes) and **"Export hand-off (JSON)"**. Its "Export abutments" file is unchanged.
  - *Receiver.* `abutment_calculator.html` uses `receiverId` `abutment`. "Pull from SubLoads" (with a new-data marker) and "Import hand-off (JSON)" open one dialog. The import also reads a raw `subloads-abutment-v1` file. It accepts only kip / ft (pads in inches) and refuses `factored` ≠ `false`. The user picks the abutment, the transverse sign (as sent, or + left looking from the backfill toward the span), the LL set (concurrent for the maximum at the seat, or per-bearing maxima), the WS and WL cases, the TU case, and which groups to import. BR, TU and CR/SH default to **not** imported, because the calculator can compute them itself. When one is imported, its share is set to 100% and the calculator's own generator is switched off. Any imported WS/WL sets the shared WS share to 100%. The source is saved in the new optional field `S.subloadsSrc` and printed in the report.

### 4.6 `foundationLoads`

```js
{ ...envelope, _schema:"bridge-foundation-loads",
  units:{ force:"kip", moment:"kip-ft", length:"ft" },
  element:{ type:"abutment"|"pier"|"bent", label:"" },
  location:"<where the forces act, e.g. 'bottom of footing, centre'>",
  signConvention:"<axes and positive directions, stated in words>",
  cases:[ { name:"Strength I max", limitState:"Strength I", factored:true,
            P:<kip, +down>, Vx, Vy, Mx, My } ] }
```

- Factored and service cases are both allowed; each case says which it is.
- Receivers let the user pick cases. They map each case to their own load inputs, and flag any mismatch in convention.
- **Clarifications (added with the abutment calculator / SubLoads → Pile Designer / Spread Footing connection):**
  - *Moment convention (all senders).* Moments are defined by their effect, so receivers can map axes without a handedness question: **My + moves the resultant toward +x (e_x = My/P), Mx + moves it toward +y (e_y = Mx/P)**; P + = down; Vx, Vy + toward +x, +y. Each payload states its own x and y in words in `signConvention` and in the optional `axes:{ x:"<words>", y:"<words>" }`. Pile Designer's group workspace and Spread Footing use the same effect-based convention, so a receiver maps only the axes: receiver +x = ±hand-off x or ±hand-off y (user's choice, default identity); the moment about the receiver's other axis follows (e.g. receiver +x = hand-off −y gives Vx = −Vy and My = −Mx).
  - *Optional fields.* `reference:{ level:"topOfFooting"|"baseOfWall"|"bottomOfFooting"|"bottomOfPileCap"|"pointOfFixity", point:"footingCentre"|"pileGroupCentroid"|"unitCentre", … }` (machine-readable form of `location`); `includes:{ footingWeight, soilOverFooting, earthPressure }` (booleans); `element.unitIndex`; `geometry` (abutment footing B, length, thickness, ft). Per case: `id`, `governs` (which target the case maximises or minimises, e.g. "P max, My max") and `combination` (the load factors in words). Receivers must not require them; a receiver that needs the level reads `reference.level`, else the `location` text, else asks the user.
  - *Two producers, one channel.* As in §4.4: each sender writes the channel key and also keeps a copy at `bridgeSuite.v1.foundationLoads.by.<id>` (`abutment`, `subloads`). Receivers list every valid copy, newest first, and let the user pick. `updatedAt` and `adopted.<receiverId>` stay on the channel key only. Receiver ids: `pileDesigner`, `spreadFooting`.
  - *Abutment calculator (sender).* Toolbar **"Send foundation loads"** opens a dialog (limit states to send, preview) with **"Send to other tools"** and **"Export hand-off (JSON)"**. Cases come from its own permutation engine (`R.comboEffects` over `R.permutations`, γp max/min, with and without LL; the vertical LS over the heel included as in its bearing and pile checks). Per limit state it sends the permutations giving V max, V min, My max, My min and the largest horizontal resultant, plus in the pile branch the ones that govern its pile table ("pile P max", "pile P min"); identical sets are merged. Level: bottom of footing (spread) about the footing centre, or bottom of pile cap about the pile-group centroid (pile branch). x + toward the toe (toward the span), y + toward positive beam offsets. Strength, Extreme Event and the construction stage are `factored:true` (`limitState` "Strength I (construction stage)" for the latter); Service I is `factored:false`.
  - *SubLoads (sender).* Header **"Send foundation loads"** opens a dialog: unit, reference level (`top of footing`, `bottom of footing`, `base of wall` or `point of fixity`, whichever the unit has; default bottom of footing) and limit states, with a preview, **"Send to other tools"** and **"Export hand-off (JSON)"**. Per limit state it sends the concurrent sets of the Combinations tab (`comboEval` with a target sign) for P max/min, M_t max/min and M_l max/min at that level, identical sets merged. Mapping: Vx = V_l, Vy = V_t, Mx = M_t, My = M_l, with x normal to the bearing line + ahead station and y along the bearing line + left looking ahead station. Strength and Extreme Event are `factored:true`; Service I and IV are `factored:false`.
  - *Pile Designer (receiver).* "Loads & group" input tab (moved from the Project panel 2026-10-10, F15): **"Pull from Abutment / SubLoads"** (new-data marker) and **"Import hand-off (JSON)"**. Not shown in integral-abutment mode (the import is refused there). Target, the user's choice: (a) *Pile group workspace* (default): each case becomes one `groupCases` entry (type `strength`, `extreme` from an Extreme Event limit state, or `service` when `factored:false`) acting at one load location "Foundation hand-off" (`loadPoints`, z = 0) at the reference point, entered in pile coordinates (default: the centroid of the current pile layout); the dialog offers to turn on "Apply pile group to the design" and, when `includes.footingWeight`, to switch off the tool's own cap/stem self-weight. (b) *Single-pile LRFD case table*, only after the user confirms the loads act on one pile: STL = |P| (type `tension` when P < 0), lateral = √(Vx² + Vy²) (default) or one component, head moment 0 (default) or |M| in the same plane. Imported rows carry `_bx:{ ch:"foundationLoads", producer, producedAt, case }`; "replace" (default) removes only tagged rows. Source: new optional input field `I.foundationSrc`, shown in the Loads & group tab and in the report's input summary.
  - *Spread Footing (receiver).* **"Pull from Abutment / SubLoads"** (new-data marker) and **"Import hand-off (JSON)"**, on a second line under the memberReactions buttons. Its by-load-type rows take unfactored loads by type and are **never** filled from this channel. One **factored** case is imported into one pedestal's Direct factored set (`peds[i].direct`, applied at the top of the pedestal); service cases are listed but not importable. Cases at the bottom of the footing or pile cap, or at a point of fixity, are refused (the tool adds the footing weight, soil and V·(t + h) itself); an unknown level needs the user's confirmation. Options: case (default the factored case with the largest P), pedestal, axis mapping, "refer the moments to the top of the pedestal" (M − V·h, default on when h > 0 and the shear couple is on), "switch Load input mode to Direct factored" (default on), "set the other pedestals' direct loads to 0" (default off). Source: new optional field `state.bxSrc.foundationLoads`, shown under the title block and in the printed report header.
  - Both receivers accept force in kip or lb and moment in kip-ft, kip-in, lb-ft or lb-in, and length in ft, converting explicitly; anything else, a case without a boolean `factored`, or any non-finite P, Vx, Vy, Mx, My is refused.

### 4.7 `buildingLoads`

```js
{ ...envelope, _schema:"bridge-building-loads", code:"ASCE 7-16",
  units:{ pressure:"psf", seismic:"SDS and SD1 in g; Ie dimensionless; SDC a letter", length:"ft", angle:"deg" },
  factored:false,
  signConvention:"<in words: wind + toward the surface (down on a roof), − away (uplift); D, Lr, S down on the horizontal projection>",
  areaLoads:{ D:null|<psf>, L:null|<psf>, Lr:null|<psf>, S:<psf design balanced roof snow>,
              W:{ roofUplift:<psf, most negative roof pressure>, roofDown:<psf, most positive roof pressure>,
                  wall:null|<psf, magnitude ≥ 0>, wallPressure:null|<psf>, wallSuction:null|<psf>,
                  basis:{ roofUplift:"<case/zone/GCpi>", roofDown:"…", wall:"…", wallPressure:"…", wallSuction:"…" } },
              R:null },
  seismic:{ SDS:null|<g>, SD1:null|<g>, SDC:null|"A"…"F", Ie },
  info:{ snow:{ pfDes, ps, balanced, unbalanced:null|{windward, leewardUniform, leewardPeak, surchargeLength},
                drift:null|{location, peak, surcharge, width} },     // psf / ft, information only
         roof:{ type, slopeDeg }, qh, G, GCpi, enclosure } }
```

- Values are nominal (unfactored); `factored` is always `false`.
- **ASCE7-16 Load Generator (sender)** fills the fields from what it computes:
  - `D` and `Lr` are the roof dead and roof live loads entered in that tool (inputs, on the horizontal projection). `L` (floor live) and `R` (rain) are not computed, so they are `null`.
  - `S` is the design balanced roof snow load (`R.snow.balanced`: Sec. 7.3/7.4 with the Sec. 7.3.4 minimum and the Sec. 7.10 rain-on-snow surcharge where they apply). Unbalanced snow and drift are **not** in `S`; they are sent under `info.snow` and in `notes`, as information only.
  - Wind values are **MWFRS** pressures (Ch. 27 Part 1), net of internal pressure: `roofUplift`/`roofDown` are the most negative/positive roof pressures over all wind directions, zones and both GCpi signs (the dashboard's "Wind Pressure Envelope"). `wallPressure` is the largest windward-wall pressure at the mean roof height, `wallSuction` the most negative leeward or side-wall pressure, and `wall` the larger magnitude of the two. `basis` names the case, zone and GCpi sign of each. For an open canopy (free roof) the roof values are the net free-roof pressures and the wall fields are `null`. Components-and-cladding (Ch. 30) pressures are not computed, and `notes` says so.
  - `seismic` values are `null` when the tool has no tabulated site coefficient (site-specific analysis required).
- **Steel Beam Design (receiver)** converts them to uniform line loads, w (kip/ft) = p (psf) × TW (ft) / 1000, using a **tributary width entered by the user** in the pull dialog. The user also picks the load types (D, L, Lr, S, W), the target load case for each (defaults DL, LL, LR, SL, WL; a missing case is created), which wind pressure applies, all spans or selected spans, and "replace previously imported loads" or "add". Imported loads are tagged `ld.bx = { ch:"buildingLoads", type, psf, tw, producer, producedAt, wind? }`; only tagged loads are ever replaced. Accepted pressure units: `psf`, or `kPa` (converted at 1 kPa = 20.885434 psf); anything else is refused. Seismic values are shown, not imported.

### 4.8 `memberReactions`

```js
{ ...envelope, _schema:"bridge-member-reactions",
  units:{ force:"kip", moment:"kip-ft" },
  supports:[ { id:"A"|"B"|…, x:<ft>,
               byLoadType:{ D:{V, M}, L:{V, M}, Lr, S, W, E }, // unfactored, per load type
               factored:false } ] }
```

- Receivers (base plate, spread footing) let the user pick one support. They import its reactions as column load cases by type, and then apply their own combinations.
- Shape Steel Beam Design writes (clarified when the channel was built; all additions are optional for receivers):

  ```js
  { ...envelope, _schema:"bridge-member-reactions", producer:"Steel Beam Designer", producerFile:"Steel Beam Design - AISC 15th.html",
    project:{ name:"<the tool's project name>", bridgeId:"" },
    units:{ force:"kip", moment:"kip-ft", length:"ft" }, factored:false,
    signConvention:"<in words, see below>",
    member:{ section:"W18X50", grade:"A992", spans:[ft…], totalLength:<ft> },
    cases:[ { id:"DL", name:"Dead", type:"D"|"L"|"Lr"|"S"|"W"|"E"|null } ],   // every load case of the beam
    caseMap:{ DL:"D", LL:"L", … },                                          // same, as a map; null = "other"
    supports:[ { id:"A", node:0, x:<ft>, support:"pin"|"roller"|"fixed",
                 byLoadType:{ D:{V,M}, … },          // only the types that at least one case is assigned to
                 byCase:{ DL:{V,M,type,name}, … },   // every case, including "other" cases
                 factored:false } ] }
  ```

  - **Sign convention.** `V` + = downward force exerted by the beam on the support (compression into the column or pedestal below); uplift is negative. `M` = moment exerted by the beam on a **fixed** support, + = counter-clockwise in the beam elevation (x along the beam from the first support toward the last, y up); `M = 0` at pin and roller supports. Free (cantilever-tip) nodes are not supports and are not sent.
  - **Basis.** Each case is solved alone with factor 1.0 by the tool's own stiffness analysis (`solveFor({case:1})`), so values are unfactored. The user assigns each case to a load type in the send dialog (defaults from the case id/name: DL→D, LL→L, LR→Lr, SL→S, WL→W, EL/EQ→E; anything else "other"). Cases with the same type are **added** into `byLoadType` (stated in `notes`); "other" cases (e.g. pattern live cases) are sent only under `byCase`. The choice is remembered in Steel Beam's new optional field `S.bxSend.memberReactions`.
  - Only Beam mode has reactions; Member-check and Batch modes refuse to send.
- **BasePlateAnchorDesigner** (receiver id `basePlate`): fills `S.serviceLoads.cases[slot].P` of its ASCE 7-22 generator. Its internal convention is **P + = tension**, so **P = −V**. Default mapping: same type → same slot; all-zero types and "other" cases → not imported. Replace (default) or add to P. Shear and moment are not imported (beam reactions give column axial only; the moment at a fixed beam support is not a column-base moment); existing `Vx`/`Vy`/`Mx`/`My` are kept unless the user ticks "set to 0". Combinations are regenerated only if the user ticks that option. Its generator does not use slot S (Lr and S share the roof-live term), and the dialog warns. Source: new optional field `S.bxSrc.memberReactions`, shown in the header and the printed report.
- **Spread Footing** (receiver id `spreadFooting`): the user picks a support and a target pedestal; values go to that pedestal's by-load-type rows (`peds[i].loads[row]`, kips / kip-ft). P + = down in both tools, so **P = V**. Default mapping D/L/Lr/S → same row, W → Wx; E is not imported (the tool has no seismic type). A fixed-support `M` is applied as `My = ∓M` (beam toward footing ±x) or `Mx = ∓M` (±y), chosen by the user (default +x, i.e. `My = −M`), or not imported. Replace (default) or add; other components are kept unless the user ticks "set to 0". Source: new optional field `state.bxSrc.memberReactions`, shown under the title block and in the printed report header.
- Both receivers accept force in kip or lb, and moment in kip-ft, kip-in, lb-ft or lb-in, converting explicitly; anything else, `factored:true`, or a non-finite number is refused.

### 4.9 `girderDemands` (GirderDetail → ST-Girder; added 2026-10-13)

One girder's line-girder analysis results from GirderDetail (Steel Bridge Beam Modules, Structural analysis) for ST-Girder's checks and LRFR rating: GirderDetail's forces and geometry, not ST-Girder's own analysis. The payload uses ST-Girder's **existing** imported-demands schema (the MIDAS station format ST-Girder already reads with Import), extended only with optional fields, so the same JSON file loads with ST-Girder's existing **Import** button.

- **Transport.** Key `bridgeSuite.v1.girderDemands` (+ `.updatedAt`, `.adopted.stgirder`), written with `BridgeXfer.publish` on GirderDetail's **"Send to ST-Girder"**, and the same payload as a file with **"Export hand-off (JSON)"** (Structural analysis, "Girder and model" tab, section "Send to ST-Girder"). It is not written to the MCT hand-off map (`bridgeSuite.v1.handoffs` / `latestId`), because PS-Beam also reads that map (and auto-adopts it when its demands channel is locked); this channel is read by ST-Girder only. Opened as files, both tools must be in one folder and opened in Chrome or Edge (§1); otherwise use the file.
- **Envelope differences** (kept for the existing schema): `_schema` is `stgirder-external-demands`, not `bridge-…`; `project` is a **string** (the project name of GirderDetail's project title block; before 2026-10-15 the bridge name from Preliminary sizing, which the title block takes when it is created), as in the other external-demand files; `producer:"GirderDetail"`, `producerFile:"Steel Bridge Beam Modules.html"`.
- **Shape:**

  ```js
  { _schema:"stgirder-external-demands", schemaVersion:1, producer:"GirderDetail", producerFile:"Steel Bridge Beam Modules.html",
    producedAt, project:"<project name>", source:"GirderDetail Structural analysis, G2 (interior), staged, variable stiffness (steel / 3n / n)",
    liveLoadType:"HL-93",
    units:{ x:"ft", moment:"ft-kip", force:"kip", plate:"in", stress:"ksi", deck:"in", area:"in2", unitWeight:"kcf", spacing:"ft", Lb:"ft", skew:"deg" },
    factored:false, imIncluded:true, dfIncluded:true, multiplePresenceIncluded:true,
    liveLoadPerGirder:true,        // NEW (optional): LL+IM already distributed to this girder; the receiver must not apply DFs again
    fatigueIncluded:true, pedestrianInLL:<bool>, selfWeightExcluded:false,
    member:{ key:"G2", type:"steel I-girder", totalLength:<ft>, spans:[ft…], supports:[ft…] },
    section:{ zones:[ { startX, endX, web:{depth,thickness}, topFlange:{width,thickness}, botFlange:{width,thickness} } ] },  // in; existing format
    stations:[ { x:<ft>, M_DC1, V_DC1, M_DC2, V_DC2, M_DW, V_DW, M_LLpos, M_LLneg, V_LLpos, V_LLneg,   // existing fields
                 M_FATpos, M_FATneg, V_FATpos, V_FATneg,      // NEW (optional): fatigue envelopes
                 M_PLpos, M_PLneg, V_PLpos, V_PLneg,          // NEW (optional): pedestrian load alone, only when there is one
                 M_DC1steel, V_DC1steel, M_DC1wet, V_DC1wet,      // NEW 2026-10-13 (optional): DC1 split, M_DC1 = steel + wet (see Basis)
                 M_UT, V_UT, M_UF, V_UF } ],                      // NEW 2026-10-15 (optional, GD54c): MassDOT utilities, existing (UT) and future allowance (UF), only when the girder has them
    notes:[ "…" ],
    girderDetail:{                 // NEW (optional): design inputs of this girder
      girder:2, label:"G2", position:"interior"|"exterior", nGirders, spacing:<ft>, overhang:<ft>|null, analysis:"<model>",
      materials:{ Fyf, Fyw, Fu, gradeFlange, gradeWeb, Es, fc, wc, Ec, n },          // ksi, kcf
      deck:{ ts, haunch, beff, rebarPct, Ar, rebarAt:"deck mid-depth" },             // in, in², %
      bracing:{ Lb:<ft>|null, type, source },                                        // Cross-frames module input L_b
      skew:{ bySupport:[deg…], max },
      df:{ source, spans:[{span, gM, gV, fatM, fatV}], piers:[{pier, gM}] },         // the factors already in the LL and fatigue values
      im:{ truck:33, fatigue:15 },                                                    // %
      utilities:{ section:"noncomposite (steel)", cite,                               // NEW 2026-10-15 (optional, GD54c): only with M_UT/M_UF
        existing:{ w, strMax:1.50, strMin:0.65, service:1.0, camber:true, deckPlacement:false } | null,          // klf on this girder
        future:{ w, strMax:1.25, strMin:0, service:1.0, serviceRelieving:0, camber:false, deckPlacement:false } | null },
      loads:{ source:"LLDF and DLs module, G2", units:{…},                           // NEW 2026-10-19 (optional, GDL): the load INPUTS of this girder (display only)
        components:[ { id, name, category:"DC1"|"DC2"|"DW"|"UT"|"UF", section, w,    // w = klf on this girder (steel: length-weighted average; cross-frames: null, see points/Ptotal)
                       wTotal, x, width, thickness, unitWeight, psf, dist, distLabel, byMethod, overridden, source, … } ],   // basis fields only where they exist
        totals:{ DC1wet, DC1steelAvg, crossFramesKip, DC2, DW, UT, UF, PL, DC1otherRows },   // klf (kip for the cross-frames)
        distribution:{ method:"massdot"|"aashto"|"ridot", label, beamClass, note },
        deck:{ ts, tsac, tsDL, wc, haunch, overhangL, overhangR }, edges:{ L:{type:"barrier", w, width}|{type:"curb", …}|null, R:… },
        wearingSurface:{ psf, width, thickness?, unitWeight? }|null, construction:{ psf, width, w, source },
        liveLoad:{ vehicle:"HL-93", note, im:{truck, fatigue}, lanes, laneWidth, roadway, deflectionDF, dfIn:"girderDetail.df",
                   pedestrian:{ psf, widthL, widthR, w, inLL, rows:[…] }|null } } },
    ownerRules:{                   // NEW 2026-10-15 (optional, GD49): the bridge owner's load rules GirderDetail applies to its own checks
      owner:"RIDOT"|"MassDOT"|"CTDOT"|"AASHTO", manual, codeBasis,
      llMultiplier:{ m, cite, liveLoad:"HL-93 LL+IM only; not the pedestrian load", limitStates:["Strength I","Service I","Service II"], notApplied:[…] },
      eta:{ D, R, I, product, max, min, cite, limitStates:["Strength"], rule },   // max = max(D·R·I, 0.95), min = min(1/(D·R·I), 1.0)
      haunchInProperties:<bool>, haunchCite,                                      // false: haunch = 0 in every composite section property
      ratingTarget:{ kind, rf, fatigue, cite, basis } | null } }                    // the owner's design rating target (inventory RF)
  ```

- **Basis.** All values unfactored and per girder. DC1 = steel (with the detail allowance), deck, haunch and other noncomposite dead load on the steel section; DC2 and DW on the long-term composite section; LL+IM = HL-93 envelopes already multiplied by the girder's distribution factors (multiple presence and skew included; IM on the truck and tandem only; the 90% two-truck case in the pier regions). Fatigue = fatigue truck with IM 15% and the single-lane fatigue distribution factors (no multiple presence), γ not applied; range = `M_FATpos − M_FATneg`. When the bridge has a pedestrian load, GirderDetail's send dialog option (default on) adds it to `M_LL…`/`V_LL…` as GirderDetail does for its own design demands; `pedestrianInLL` says which, and `M_PL…` give it separately.
- **Utilities (added 2026-10-15, GD54c, optional; engineer decision GD54 "yes").** MassDOT projects with utility rows in GirderDetail's LLDF and DLs module (categories UT and UF, OWN16) send them as their own loads: `M_UT`/`V_UT` = existing utilities, `M_UF`/`V_UF` = future utility allowance (MassDOT Part I 3.5.5.2: 125 lb/ft per beam), unfactored, per girder, on the steel (noncomposite) section of the same staged model (Part I 3.5.5.4), shears in the schema's sign convention like the other dead-load shears. A field is present only when this girder carries that load. `M_DC1`/`V_DC1` never include them. `girderDetail.utilities` states the loads per foot and the factors GirderDetail applies: existing = DW (GD42): Strength 1.50η where they add to the effect, 0.65/η where they relieve it, Service 1.0, in the camber; future allowance: Strength 1.25η / 0, Service 1.0 where it adds and 0 where it relieves, not in the camber; neither at deck placement. Before 2026-10-15 the utilities were not sent (a note line listed them).
- **Stations.** One per analysis node (about 1 ft). Moments sagging +. Shears in the existing schema's MIDAS sign convention (gravity shear **negative** at the left end of a span: GirderDetail's shears are negated; ST-Girder negates them back); shear at a node is the element just right of it, and each interior support has one station 0.001 ft either side carrying the shear on that side. Values rounded to 0.001.
- **DC1 split (added 2026-10-13, optional).** `M_DC1steel`/`V_DC1steel` = the girder steel: flanges and web at 490 pcf × (1 + the Preliminary sizing detail allowance for stiffeners, connection plates and splices), plus (since 2026-10-13, XF1) the cross-frames or diaphragms as point loads at that girder's frames, half of each frame's weight per girder, from the Cross-frames module's member sizes (or entered weights, or none: LLDF and DLs setting). `M_DC1wet`/`V_DC1wet` = the rest of DC1: deck, haunch, SIP forms and any other DC1 rows of the LLDF and DLs module. Both are on the steel section of the same staged model as `M_DC1`, applied simultaneously (GirderDetail's deck-placement sequence is not sent). `M_DC1`/`V_DC1` are unchanged and equal steel + wet within the 0.001 rounding, so receivers that do not read the split are unaffected. ST-Girder uses `M_DC1steel` (and `M_DC1 − M_DC1steel` for the wet concrete) only for its Camber tab curves and table; without the fields it shows DC1 as one total. Same channel, key and `_schema`/`schemaVersion`.
- **ST-Girder (receiver id `stgirder`).** Header button **"Pull from GirderDetail"** (with a new-data dot) and the existing **Import** button (a file with `producer:"GirderDetail"` and `girderDetail` takes the same path). Both validate (stations finite, units ft / ft-kip / kip, `factored:false`, span layout) and show a confirm dialog with the producer, time, project, stations and spans, every design input that changes (old → new) and the sender's `notes`; nothing is applied until confirmed, and nothing on page load (except the open-now flag below). On OK: the payload becomes the imported envelope (`inp.external`, the existing field, which records `producer`/`producedAt`), span 1 is selected, plates are seeded from `section.zones` as for any import, and these existing inputs are set: `mat` (Fyf, Fyw, Fu, Es, hybrid; grade name = the list entry with the same Fy and Fu), `deck` (ts, haunch, f'c, w_c, b_eff fixed, overhang for an exterior girder), `negM` (As = Ar, dTop = ts/2, GirderDetail's rebar at the deck mid-depth), `geom` (S, nGirders, Lb), `loads` (pos, posAuto off, skew = largest support skew), `proj.girderId`. The span buttons of the imported-demands banner select the other spans (existing).
  - `liveLoadPerGirder:true`: the imported-LL DF and multiple-presence multipliers are not applied (1.0) and their inputs are hidden; the factors used by GirderDetail are listed instead.
  - Fatigue fields present: the Fatigue checks use them instead of the simple-span fatigue truck (fixlog/stgirder.md GD2). Without them (MCT/MIDAS imports) nothing changes.
  - **Open now (added 2026-10-13).** After a successful "Send to ST-Girder", GirderDetail asks "Open ST-Girder now with this girder loaded?". OK opens ST-Girder in a new tab as `stgirder.html#gdpull=<producedAt>` (the file name from `bridgeSuite.v1.appPaths` for GirderDetail's folder, read only, else `stgirder.html` next to it; a blocked tab falls back to the message and an alert to use Pull from GirderDetail); Cancel keeps the previous behaviour. On load ST-Girder reads the flag once, removes it from the address (`history.replaceState`; a refresh does not re-import) and, one render after its saved session is loaded, applies the stored payload through the same path as Pull from GirderDetail without the confirm dialog (the engineer confirmed in GirderDetail), only if the payload's `producedAt` equals the flag and it passes the same validation; the change summary is shown in a dismissable "Loaded from GirderDetail" banner and the autosave stores it as after a manual pull. Missing, mismatched or invalid: nothing changes and a banner says why (tools opened the same way: both from the website, or both as files in one folder, in Chrome or Edge; else Export hand-off (JSON) and Import). No key, channel or schema changed.
  - **Owner load rules (`ownerRules`, added 2026-10-15, GD49, optional).** GirderDetail adds the field whenever its bridge publishes load rules (Preliminary sizing's `bridge.lf`; every owner including AASHTO). The forces stay unfactored. ST-Girder validates it (positive factors, boolean haunch flag) and, while these demands are in use, applies it to its own girder checks as GirderDetail does: Strength I maximum load factors γ_DC = 1.25·max, γ_DW = 1.50·max, γ_LL = 1.75·max·m (ST-Girder uses maximum factors only, so `min` does not arise); Service II γ_LL = 1.30·m; with `pedestrianInLL:true` and `M_PL…`/`V_PL…`, LL+IM used = (LL+IM+PL) − PL + PL/m (m not on the pedestrian load); `haunchInProperties:false` → haunch 0 in the elastic (n, 3n), cracked and plastic section properties (the drawing keeps the entered haunch; the dead loads are the imported ones); live-load deflection, fatigue, constructibility and the load rating use neither η nor m; `ratingTarget.rf` is compared with the inventory RF on the Rating tab and in the report (reported only). Shown in a banner on every tab, the pull confirm/"Loaded from GirderDetail" summary, and the report (1. Objectives, 2. Input parameters "Owner load rules (from GirderDetail)" with the factors worked, Demands "Load combinations (owner load rules …)", Rating). The same Strength I factors (1.25·max, 1.50·max, 1.75·max·m) also apply to ST-Girder's transverse Deck design (Table A4-1 and overhang wheel moments; engineer decision 2026-10-15, stgirder GD49-D; the deck has no Service check there). A payload without `ownerRules` (sent before 2026-10-15, or any other producer) behaves exactly as before (AASHTO factors, haunch as entered).
  - **Utilities (`M_UT`, `V_UT`, `M_UF`, `V_UF`, added 2026-10-15, GD54c, optional).** ST-Girder applies them as GirderDetail does: their own load components on the steel section, each factor chosen by whether the load adds to the effect checked. Strength I: +M_u and −M_u add γ_UT·M_UT + γ_UF·M_UF (γ_UT = 1.50η adding / 0.65/η relieving; γ_UF = 1.25η / 0); V_u = |γ_DC(V_DC1+V_DC2) + γ_DW·V_DW + γ_UT·V_UT + γ_UF·V_UF| in the worse direction + γ_LL|V_LL+IM|. Strength flange stresses, the 1.3R_hM_y cap (M_D1 includes them) and Service II (1.0; the future allowance 0 where it relieves) on the steel section. Camber: the existing utilities only. Constructibility (deck placement): neither (DC1 only). Web special fatigue (6.10.5.3): permanent shear + V_UT + V_UF where it adds, at 1.0. Load rating (default chosen, engineer to confirm, ENGINEER_CHECKS GD65): both where they add (existing as DW 1.50, future allowance as DC 1.25, Service II 1.0), no relief taken. Shown in a banner on every tab, the Inputs tab card "MassDOT utilities (from GirderDetail)", Diagrams, Flexure, Stresses, Camber, Rating, the pull confirm / "Loaded from GirderDetail" summary and the report (2. Input parameters "MassDOT utilities (from GirderDetail)", Demands "Load combinations" and the load-effect tables). A payload without the fields behaves exactly as before.
  - **Load inputs (`girderDetail.loads`, added 2026-10-19, GDL, optional; engineer request 2026-10-19).** The loads GirderDetail applied to this girder, from the same Structural analysis run as the forces and its LLDF and DLs dead loads: every DC1 / DC2 / DW / utility component with its per-foot value on this girder (klf), its whole-load value, position, distribution rule (equal, pile-cap, two adjacent, RIDOT 60/40; `byMethod` when the row follows the method, `overridden` when an LLDF and DLs override applies) and source, plus the unit weights, thicknesses, psf and widths behind it where they exist (deck: t_s + sacrificial × w_c × tributary width; haunch × top flange width × w_c; SIP forms psf × clear bays; wearing surface psf × width); the girder steel as a length-weighted average (min, max, detail allowance) and the cross-frames as point loads (count, total kip); the construction live load (psf × effective width); the deck edges; the live load description (HL-93, IM, number of design lanes, lane width, roadway, live load deflection distribution factor, pedestrian psf, walkable widths and klf on this girder; the distribution factors stay in `df`). Totals equal the values that produced `M_DC1wet`, `M_DC2`, `M_DW`, `M_UT`, `M_UF`. **Display only: no force, factor or other field changes, and no receiver result reads it.** ST-Girder: when the imported demands are from GirderDetail and carry the field (validated: finite numbers), the Inputs tab's Loads card shows a box "Load inputs from GirderDetail (LLDF and DLs, G#)" with every component, and its DC1 (steel self-weight, deck + haunch, other DC1, cross-frames), DC2 and DW fields show GirderDetail's values locked (read-only, labelled "from GirderDetail (LLDF and DLs, G#)"); the live load section lists GirderDetail's live load; utilities and the pedestrian load are listed as read-only rows. ST-Girder's own load inputs are not changed (saved as before) and show again when the demands are cleared ("✕ use built-in simple-span analysis"). The outputs that still read ST-Girder's own load inputs while these demands are in use are kept as they were and listed in that box, next to the field, in the Deck card and in the report (engineer to decide, fixlog/stgirder.md GDL): constructibility (construction live load), live load deflection (number of design lanes N_L), the transverse deck design (future wearing surface, slab thickness for the dead load, barrier weight and base width, and the overhang of an interior girder). Also in the pull confirm / "Loaded from GirderDetail" summary and the report (2. Input parameters "Loads (per girder) from GirderDetail (LLDF and DLs, G#)" in place of ST-Girder's own load list). A payload without `loads` (sent before 2026-10-19), MIDAS/MCT imports and the built-in analysis show ST-Girder's own load inputs exactly as before.
  - A note "Forces from GirderDetail (G#, staged analysis); resistances by ST-Girder's own checks" with the known differences between the tools is shown in the imported-demands banner, the Rating tab and the Report tab.

## 5. Shared helper (copy into each tool that sends or receives)

A small IIFE, `window.BridgeXfer`, providing:
- `publish(channel, payload)`: stamps the envelope and writes the key and timestamp;
- `read(channel, schema, maxVersion)`: returns the payload, or an `{error}`;
- `markAdopted(channel, receiverId, producedAt)`;
- `isNew(channel, receiverId)`;
- `exportFile(channel)` and `importFile(file, schema)`.

The reference copy is below. Paste it **verbatim** inside a plain `<script>` tag in each tool, before the tool's own hand-off code. If it ever changes, update this file and every copy in the same PR.

```js
/* BridgeXfer v1 — cross-tool hand-off helper. Spec: HANDOFF.md. Duplicated verbatim in each tool that sends or receives (CLAUDE.md §3). */
(function(){
  if(window.BridgeXfer) return;
  var NS='bridgeSuite.v1.';
  function lsOK(){ try{ var k='__bx_t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }catch(e){ return false; } }
  function sharedProject(){
    try{ var m=JSON.parse(localStorage.getItem(NS+'projectMeta')||'null');
      if(m && m._schema==='bridge-project-meta' && m.fields) return { name:m.fields.projectName||'', bridgeId:m.fields.bridgeId||'' };
    }catch(e){}
    return null;
  }
  function stamp(channel, payload, producer, producerFile){
    var p={}; for(var k in payload) if(Object.prototype.hasOwnProperty.call(payload,k)) p[k]=payload[k];
    p.schemaVersion = p.schemaVersion || 1;
    p.producer = p.producer || producer || document.title;
    p.producerFile = p.producerFile || producerFile || decodeURIComponent((location.pathname.split('/').pop()||''));
    p.producedAt = new Date().toISOString();
    if(!p.project) p.project = sharedProject() || { name:'', bridgeId:'' };
    if(!p.notes) p.notes = [];
    return p;
  }
  function publish(channel, payload, producer, producerFile){
    if(!payload || !payload._schema) return { error:'payload has no _schema' };
    var p=stamp(channel, payload, producer, producerFile);
    if(!lsOK()) return { error:'Browser storage is not available. Use "Export hand-off (JSON)" instead.', payload:p };
    try{
      localStorage.setItem(NS+channel, JSON.stringify(p));
      localStorage.setItem(NS+channel+'.updatedAt', p.producedAt);
    }catch(e){ return { error:'Could not save hand-off (storage full?): '+e.message, payload:p }; }
    return { ok:true, payload:p };
  }
  function validate(p, schema, maxVersion){
    if(!p || typeof p!=='object') return 'not a hand-off object';
    if(p._schema!==schema) return 'wrong data type ('+(p._schema||'none')+'), expected '+schema;
    if(!(p.schemaVersion<= (maxVersion||1))) return 'newer format (v'+p.schemaVersion+') than this tool supports (v'+(maxVersion||1)+')';
    return null;
  }
  function read(channel, schema, maxVersion){
    var raw=null;
    try{ raw=localStorage.getItem(NS+channel); }catch(e){ return { error:'Browser storage is not available.' }; }
    if(!raw) return { error:'Nothing has been sent on this channel yet.' , empty:true };
    var p; try{ p=JSON.parse(raw); }catch(e){ return { error:'Stored hand-off is corrupt.' }; }
    var err=validate(p, schema, maxVersion); if(err) return { error:err };
    return { ok:true, payload:p };
  }
  function markAdopted(channel, receiverId, producedAt){
    try{ localStorage.setItem(NS+channel+'.adopted.'+receiverId, producedAt||''); }catch(e){}
  }
  function isNew(channel, receiverId){
    try{
      var at=localStorage.getItem(NS+channel+'.updatedAt'); if(!at) return false;
      return at!==localStorage.getItem(NS+channel+'.adopted.'+receiverId);
    }catch(e){ return false; }
  }
  function exportFile(channel, payload){
    var p=payload; if(!p){ try{ p=JSON.parse(localStorage.getItem(NS+channel)); }catch(e){} }
    if(!p) return { error:'Nothing to export.' };
    var blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=(p._schema||channel)+'_'+(p.producedAt||'').slice(0,19).replace(/[:T]/g,'-')+'.json';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 60000);
    return { ok:true };
  }
  function importFile(file, schema, maxVersion, cb){
    var fr=new FileReader();
    fr.onload=function(){ var p; try{ p=JSON.parse(fr.result); }catch(e){ cb({ error:'File is not valid JSON.' }); return; }
      var err=validate(p, schema, maxVersion); cb(err? { error:err } : { ok:true, payload:p }); };
    fr.onerror=function(){ cb({ error:'Could not read file.' }); };
    fr.readAsText(file);
  }
  function describe(p){ return (p.producer||'?')+' — '+(p.producedAt? new Date(p.producedAt).toLocaleString():'?')+((p.project&&p.project.name)?' — '+p.project.name:''); }
  window.BridgeXfer={ NS:NS, publish:publish, read:read, validate:validate, markAdopted:markAdopted, isNew:isNew, exportFile:exportFile, importFile:importFile, describe:describe, sharedProject:sharedProject };
})();
```
