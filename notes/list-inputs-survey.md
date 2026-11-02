Survey of multi-value text inputs (several values typed into one box). All paths are in /home/user/All-Structural and were read from origin/main after `git fetch` (origin/main is fd16fdc). Line numbers are approximate.

Scope: the 22 top-level *.html files plus apps/steel-bridge/. Excluded: tests, docs, the old "Steel Bridge Design.html", and redirect pages. Of the other apps/ entries, only apps/light-pole/lts-engine.js has any code, and it has no input fields.

I searched for splits on commas, semicolons, spaces and colons, `.join(', ')` in input values, placeholders with commas, and "comma/separated" wording. I then read each hit to confirm it is a real user input. Internal parsing (file import, labels, `.split('.')`) was ignored.

"Stored as" means what ends up in the saved project data. "string" means the raw text is saved and re-parsed on use. "array" means it is parsed on edit and the array is saved.

## Steel bridge (apps/steel-bridge/)

All of these are stored in the project object `P`.

| Input id / label | Values | Format | Stored as | Line |
|---|---|---|---|---|
| index.html `i_spans`, "Span lengths" | span lengths, ft | comma/semicolon/space list of numbers | `P.spans.lengths`, array | index.html:250, parsed at 293 |
| ui/loads.js `i_xs.bays`, "Girder spacings" | girder spacings left to right, ft | comma list of numbers (`data-kind="xlist"`) | `P.xs.bays`, array | loads.js:62 (built at 79), parsed at 95 |
| ui/loads.js `i_xs.skews`, "Support skews" | one skew per support line, degrees | comma list of numbers | `P.xs.skews`, array | loads.js:80, parsed at 95 |
| ui/framing.js `fr_spl`, "Field splices" | splice stations from the left end, ft | comma list of numbers, sorted and filtered to >0 | `P.framing.splices`, array | framing.js:48, parsed at 81 |
| ui/splices.js `i_splx`, "Stations" (Field splice stations, every girder) | the same splice stations, ft | comma list of numbers | `P.framing.splices`, array (same field as `fr_spl`) | splices.js:53, parsed at 77 |
| ui/analysis.js `an_l_xf`, "Cross-frame point loads" | cross-frame point loads as x:P, x in ft and P in kip | `x:P` pairs separated by commas or semicolons, e.g. `20:1.5, 40:1.5` | `girders[i].loadsManual.xf`, array of `{x, P}` objects, one per girder | analysis.js:37, parsed at 48 |
| ui/analysis.js `an_a_seqCustom`, "Pours (optional)" | deck pour ranges, ft | `a-b` ranges separated by commas, e.g. `0-80, 140-220`; blank means automatic | `P.analysis.seqCustom`, string (parsed at use, analysis engine ~340) | analysis.js:31 |
| ui/autodesign.js `nbList`, "Girder counts to study" (only in mode "new") | girder counts to try, whole numbers 2 or more | comma/semicolon/space list; the placeholder shows the automatic list | `P.autodesign.nbList`, string (parsed in engine/autodesign.js ~615) | autodesign.js:39 |
| ui/autodesign.js `ad_win`, "Station windows" (shown only for a variable in Range mode on a span-type variable; placeholder "e.g. 70-90, 135-150") | station windows where a variable may change, ft | `a-b` ranges separated by commas or semicolons; "to" is also accepted; blank means anywhere in the span | `P.autodesign.vars[<varId>].win`, string (parsed by `windows()` in engine/splplace.js:157) | autodesign.js:94 |
| ui/fatigue.js `studs.splX`, "Field splice stations (no studs over the plates)" | splice stations, ft | comma/semicolon/space list of numbers | `P.studs.splX`, string (parsed at fatigue.js:155) | fatigue.js:56 |

Steel bridge total: 10 inputs.

Not counted, because they are not a single box that is typed into and saved:
- engine/fatigue.js:99 `faRR` splits a string of eight R_R values (A, B, B′, C, C′, D, E, E′) for `fatigue.ev.rrE1`, `rrE2` and `rrMean`. I found no UI input for these. They appear only in the engine default (fatigue.js:93) and are probably set only by a hand-off or legacy file.
- ui/demands.js pastes tab-separated Excel rows into cell tables.
- Legacy import (engine/legacy.js) fills `seqCustom` and `splX` from older files.

## Tools outside apps/

| Tool file | Input id / label | Values | Format | Stored as | Line |
|---|---|---|---|---|---|
| **Bridge Substructure Loading.html** | `f_spans`, "Span lengths along CL bridge, CL bearing to CL bearing" (note: "Separate spans with commas") | span lengths, ft | comma or space list; must all be >0 | `P.br.spans`, array (`setK` after parsing, 1080-1087) | 910 |
| | `f_bays`, "Girder spacings, left to right looking ahead" | spacings, ft | comma or space list | `P.br.bays`, array | 914 |
| | `eq-paste`, "Paste the AASHTO-USGS Sa table for the site (22 periods, 0 to 10 s)" textarea | spectral acceleration table, period (s) and Sa | tab, comma or space rows, or 22 values in order; read by `parseSaTable` (2012) | parsed to an array of 22 Sa values; the pasted text is not saved | 2225 |
| **Prestressed Bridge Design.html** | "Spans (ft)" in the bridge bar (`PbdBridgeBar`) | span lengths, ft | comma/semicolon/space list, committed on blur; disabled when MIDAS demands are imported | `bridge.spans`, array (the text is only local state `spTxt`) | 9005-9020 |
| **Shear and Moment Diagrams.html** | `iUX`, "Custom x (ft)" (placeholder "2.5, 5") | extra result stations along the beam, in the beam's length unit | comma list of numbers; rewritten with `.join(', ')` when the units change (527) and when a marker is dragged (1849) | `userXs` in the saved data, string (1587, restored at 1601); parsed to the `userX` array at 739 | 424 |
| **Steel Beam Design - AISC 15th.html** | "Custom stations x" (`userX`, placeholder "e.g. 5, 12.5, 31"), in the "Output Stations" section | extra output stations, ft from span start | comma list of numbers, kept only if 0 to total length | `S.disp.userX`, string (parsed at 1257); loaded from `d.userXs` at 677, which also takes the Shear and Moment file field | 2493 |
| **Bridge Geometry.html** | per-span table input, "Girder offsets (ft) — blank uses global" (`data-f="girders"`, tooltip "comma-separated list, e.g. -18, -6, 6, 18") | girder offsets from the construction reference line, ft | comma list of numbers; blank means the global set | `SPAN_OV[span].girders`, array or null (saved in the snapshot at 4318) | 3284-3303 |
| | `map_ptsbox`, survey points textarea (placeholder "P1, 750123.45, 210987.65, control") | name, easting, northing, label | one point per line, comma or tab separated | held in `LPTS` for map plotting; not part of the saved data | 582, parsed at 3703 |
| **Gusset Plate Rating.html** | per-member "Gage(s) g" (`members.i.fast.g`, note "list") | fastener gage spacings between adjacent gage lines, in | one number or a comma/semicolon/space list; the last value repeats; `gageList()` at 1520 and 2458 | `members[i].fast.g`, string (the field is created at 3020) | 3020 |
| | `hpaste-i`, "Paste from Excel — two columns: along, across (tab or comma)" | hole centres along and across the member, in | rows of two numbers; header row optional | parsed to `members[i].holes`, an array of `[along, across]` pairs (`pattern='custom'`) | 3058 |
| **Stone Masonry Arch Load Rating.html** | `measPts`, "Intrados survey points — one x, y pair per line (ft)" (shown only in measured-geometry mode) | x, y of the intrados, ft | one `x, y` pair per line, separated by comma, semicolon or space | `fields.measPts`, string (parsed by `parsePairs`, 9863) | 9725 |
| | `dOver`, "Local overrides — station (ft), depth (in)" | ring-depth overrides | `station, depth` per line | `fields.dOver`, string | 9737 |
| | `sdlItems`, "Line items — description, weight (plf)" | superimposed dead load items | `description, weight` per line, split at the last comma | `fields.sdlItems`, string | 9768 |
| | `deter` (hidden input behind the "Deterioration, by station" row editor) | deterioration areas | one entry per line: `x 5.56, 7.8, 640[, capacity][ release]`, `x 4.0-7.0, d, fa`, or `n7, d, fa`; fields are station or range (ft), remaining depth (in), allowable stress | `fields.deter`, string (parsed by `readDeter`, 9910) | 9746, parser 9915 |
| | `tracks`, "Track centerline offsets" (one value per line, placeholder "0") | track offsets from the barrel centerline, ft | newline list, one number per line, not comma separated; borderline, included for completeness | `fields.tracks`, string | 9825 |
| **Section Property Calculator.html** | `lib_tags`, "Tags" (placeholder "optional, comma-separated"); the "Edit tags" prompt at 4622 has the same format | library entry tags (text labels, not numbers) | comma-separated words | library entry `tags`, array (split at 4473) | 4586 |
| **index.html** (MIDAS Civil MCT File Generator) | "Bay 1 — along Left girder", `NumberListInput` for `bay1Stations` (placeholder "e.g. 5, 12, 18, 12, 5") | floorbeam spacing increments, ft, cumulative from the start | comma or space list | `cfg.gfs.bay1Stations`, array (4590) | 4590 |
| | "Bay 2 — along Center girder" (three-girder case only), `bay2Stations` | floorbeam spacing increments, ft | comma or space list | `cfg.gfs.bay2Stations`, array | 4595 |
| | "Transverse offsets from Left girder (ft)", `stringerOffsets` (placeholder "e.g. 2.5, 5.5") | stringer line offsets, ft | comma or space list | `cfg.gfs.stringerOffsets`, array | 4607 |
| | "Bay 2 — Transverse offsets from Center girder (ft)", `stringerOffsets2` | stringer line offsets, ft | comma or space list | `cfg.gfs.stringerOffsets2`, array | 4612 |
| | "Girder Spacing (ft) — comma-separated" (placeholder "e.g., 6,6,5.5 or 6 (uniform)"), rating tab | girder spacings, ft: n−1 values, or one value for uniform | comma list; parsed at 12831 and again at 18135 | `R2.arema_spacings`, string (set by `setRating`) | 17370 |
| **BasePlateAnchorDesigner.html** | "Depths of the stacked pieces (optional)" for stacked hairpin rebar (`vDepths`, placeholder "auto: depth + k·spacing") | hairpin piece depths, top down, in (the display unit) | comma/semicolon/space list, e.g. "3, 6.5, 10"; blank means automatic | `S.vRebar.vDepths`, string (parsed at 5043) | 6068 (default at 1094) |
| | load-combination paste textarea, "Paste from Excel (tab or comma separated): Name, P, Vx, Vy, Mx, My [, T]" | load combinations; forces and moments in the unit selectors | one combination per line, 6 or 7 columns | parsed to the `S.combos` array of objects; the pasted text is not saved | 12534-12546 |

## Counts per tool

| Tool | Inputs | Of which |
|---|---|---|
| apps/steel-bridge | 10 | |
| Bridge Substructure Loading.html | 3 | 2 lists, 1 paste box |
| Prestressed Bridge Design.html | 1 | |
| Shear and Moment Diagrams.html | 1 | |
| Steel Beam Design - AISC 15th.html | 1 | |
| Bridge Geometry.html | 2 | 1 list, 1 survey-point paste box |
| Gusset Plate Rating.html | 2 | 1 list, 1 paste box |
| Stone Masonry Arch Load Rating.html | 5 | 4 line-based text areas, plus `tracks`, which is newline-separated |
| Section Property Calculator.html | 1 | |
| index.html | 5 | 4 `NumberListInput` fields, 1 string field |
| BasePlateAnchorDesigner.html | 2 | 1 list, 1 paste box |
| **Total** | **33** | **8 of them multi-line paste or text areas** |

## Checked and found to have none

- ACI Rebar Development Length.html
- ASCE7-16 Load Generator.html
- Concrete Beam ASD.html
- Concrete Beam Capacity.html
- Light Pole and Sign Post.html
- Moving Load Generator.html
- Pile Designer.html
- Retaining Wall Designer.html
- Spread Footing.html
- Timber Beam Check.html
- abutment_calculator.html
- elastomeric_design_module.html
- lldf.html
- psbeam.html
- tools.html

Notes on these:
- Their only text areas are free-text assumptions or notes.
- Pile Designer.html has LPILE file-import parsers (`parseLP12D`, `parseLP13O`) but no list field.
- Every `.join(', ')` hit in these files is report text.
- Bridge Geometry.html station fields (`s1`, `s2`, placeholder "e.g. 13+50.00") hold a single "sta+offset" value, not a list, so they are not counted.