# Fix log — apps/crane-pick/ (Crane Pick Analyzer)

A new folder app (engineer decisions 2026-11-16): an interactive, graphics-driven lift-planning aid. The site is drawn on a map or on a
plan sheet; cranes, picks and sets (phase C2) are dragged on it and every result updates live. Built like the bridge apps
(`apps/steel-bridge/`, `apps/ps-bridge/`): `index.html`, `engine/` (no DOM, Node-tested), `ui/`, `report/`; classic scripts, opens from
`file://`. Phases: C1 shell / map / plan sheet / drawing tools; C2 crane library + drag placement + live capacity; C3 elevation /
clearance / 3D; C4 ground (outriggers, mats, bearing, Boussinesq); C5 rigging + tandem; C6 lift plan sheets, DXF, Report, multi-lift.
Tests: `node tests/engine/run.mjs crane`; `node tests/smoke/crane-shell.mjs`.

Libraries (engineer-approved 2026-11-16, CDN only, exact versions): Leaflet 1.9.4 (unpkg, `dist/leaflet.css` + `leaflet.js`), proj4js
2.11.0 (cdnjs `proj4js/2.11.0/proj4.js`): the versions and URLs `Bridge Geometry.html` already pins; pdf.js 3.11.174 (jsDelivr, as
`BasePlateAnchorDesigner.html`) from C1-2; three.js comes with C3. Offline copies for the tests: `tests/libs` (already there).

Labelling (engineer, 2026-11-16): "lift-planning aid" in the header and in the Report; no other disclaimers for now.

## 2026-11-16 — C1-1: the app shell, saved projects, the map (new files)
PR #1600: https://github.com/mlococo88/All-Structural/pull/1600
### Where (all new)
- `apps/crane-pick/index.html`: header (title, "LIFT-PLANNING AID" badge, units line, project chip, Undo / Redo), input panel (tabs
  Project, Site & map) and output panel (tabs Plan, Site, Report); below 900 px the output panel (the map, 62 vh, full width) comes first
  and the input panels below it. Loads Leaflet 1.9.4 and proj4js 2.11.0 (static tags, pinned), the app's scripts with `?v=<lastModified>`
  (the bridge apps' loader), and `shared/steps.js`, `report.js`, `projects.js`, `projects-ui.js`, `github-sync.js` (all unchanged).
- `engine/geo.js` (`window.CranePickGeo`): State Plane zones as proj4 strings, conversions, plane geometry (distance, azimuth, quadrant
  bearing, length, area (shoelace), perimeter, centroid, point–line distance, point in polygon, plan buffer rings), plan-sheet placement
  (pixel ↔ grid, 2-point scale calibration, 2-point georeference with rotation, rescale / rotate about a pixel, the move of items with a
  sheet), zone change (`reproject`), angle / number parsing.
- `engine/model.js` (`window.CranePickModel`): project v1 `{ schema: 'crane-pick.project', v: 1, title, notes, site: { zone }, view,
  sheets, items }`, `normalize`, `load` / `save` (autosave), the file `{ format: 'crane-pick.project', version: 1, project (, images) }`.
- `engine/worked.js` (`window.CranePickWorked`): worked steps (shared/steps.js format) of distances / bearings, lengths / areas, the sheet
  scale calibration and the georeference, and the power-line clearance.
- `engine/osha.js` (`window.CranePickOSHA`): 29 CFR 1926.1408 Table A lookup (used by the drawing tools in C1-3; values below).
- `ui/app.js` (controller: project, autosave, undo / redo, tabs, notices), `ui/project.js` (Save and open = `shared/projects-ui.js`
  `projectBar`, title block, notes), `ui/map.js` (Plan tab: Leaflet map), `ui/sitetab.js` (Site & map tab), `ui/site.js` (Site output
  tab), `report/builders.js` + `ui/report.js` (Report tab in `shared/report.js`).
### Coordinates (CLAUDE.md §4: no engineering formula changed; new code, stated here for review)
Positions are kept in the project's State Plane grid, US survey feet (a metre zone is shown / entered in metres; 1 ftUS = 1200/3937 m).
Distances and bearings are grid values (no combined scale or elevation factor). NAD 83 is shown on the web map as WGS 84 (≈1–1.5 m).
Zones (proj4 strings in `engine/geo.js`; EPSG parameters, ftUS false origins converted to metres as EPSG gives them):

| Zone | Projection | Parameters | False E / N |
|---|---|---|---|
| EPSG:2249 NAD83 / Massachusetts Mainland (ftUS) | LCC 2SP, GRS80 | φ1 42°41′, φ2 41°43′, φ0 41°00′, λ0 71°30′ W | 656,166.667 / 2,460,625 ftUS (200,000.0001016 / 750,000 m) |
| EPSG:26986 NAD83 / Massachusetts Mainland (m) | same | same | 200,000 / 750,000 m |
| EPSG:2234 NAD83 / Connecticut (ftUS) | LCC 2SP, GRS80 | φ1 41°52′, φ2 41°12′, φ0 40°50′, λ0 72°45′ W | 1,000,000 / 500,000 ftUS (304,800.6096 / 152,400.3048 m) |
| EPSG:3438 NAD83 / Rhode Island (ftUS) | TM, GRS80 | φ0 41°05′, λ0 71°30′ W, k0 0.99999375 | 328,083.3333 / 0 ftUS (99,999.99998984 m) |

`Bridge Geometry.html` carries the same 2249 / 2234 strings; its 3438 string has `x_0=100000` (the NGS metre definition) where this app
uses EPSG's ftUS value 99,999.99998984 m (0.01 mm apart).
**Check cases** (`tests/engine/crane-geo.test.mjs`): (1) proj4 reproduces Snyder, *Map Projections — A Working Manual*, USGS PP 1395
(1987): LCC ellipsoid example p. 296 (Clarke 1866, φ1 33°, φ2 45°, φ0 23°, λ0 96° W; 35° N 75° W → x 1,894,410.9 m, y 1,564,649.5 m;
proj4 1,894,410.898 / 1,564,649.478) and TM ellipsoid example p. 269 (k0 0.9996, λ0 75° W; 40°30′ N 73°30′ W → x 127,106.5 m,
y 4,484,124.4 m; proj4 127,106.467 / 4,484,124.434). (2) Each zone's grid origin maps to its false easting / northing (to 0.001 ft).
(3) Points across each zone agree with Snyder's formulas coded independently in the test with the zone parameters, to 1 mm.
(4) The m and ftUS MA variants agree; round trips to 1e-9°. Hand check: Boston City Hall plaza area (42.3601° N, 71.0589° W) shows
E 775,383.60, N 2,956,557.87 ftUS (= 236,337 / 901,159 m), inside the MA Mainland grid as expected.
### Saved data (§5)
New keys only, all prefixed `crane.`: `crane.project.current` (autosave), `crane.projects.v1` (saved projects, `shared/projects.js`
mapStore `{ name: project + savedAt }`), `crane.open` (the open saved project's name), `crane.ui` (tabs and base map, per browser).
GitHub sync (off until set up): tool `crane-pick`, files `projects/crane-pick/<name>.json` = `{ format, version, project }`.
### Shared files
Loaded unchanged: `shared/steps.js`, `report.js`, `projects.js`, `projects-ui.js`, `github-sync.js`. Changed: `shared/project-registry.js`
(one entry, `fixlog/shared-project-registry.md`). Home page card: `tools.html` (`fixlog/tools.md`), with the new tool per §7 practice.
### Decisions (pending engineer review)
- Map tiles: Esri World Imagery (attribution "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community")
  and OpenStreetMap (© OpenStreetMap contributors). OpenStreetMap's tile policy asks browser apps to send a Referer; a page opened from
  `file://` sends none, so OSM may refuse tiles there (Esri does not). The app then says tiles are not loading and offers "no base map".
- "Go to" by address is not offered (no geocoder): latitude / longitude (decimal or d m s) or a State Plane coordinate. A positive
  longitude above 60 without E/W is read as west (New England), and the message says so.
- KaTeX is not loaded (not on the approved list for this tool): worked steps use `shared/steps.js`'s built-in renderer; the strings are
  KaTeX-valid (tested) in case KaTeX is added later.
### How verified
`node tests/engine/run.mjs crane` (10 tests); `node tests/smoke/crane-shell.mjs` (11 checks); `node tests/engine/run.mjs project-registry
github-sync projects`; `node tests/smoke/home-projects.mjs`, `node tests/smoke/home-sync.mjs` (with the crane entry);
`node tests/check-syntax.mjs`.

## 2026-11-16 — C1-2: plan-sheet underlays (calibration, georeference, images in IndexedDB)
PR #1602: https://github.com/mlococo88/All-Structural/pull/1602
### Where
- `apps/crane-pick/ui/sheets.js` (new, `window.CranePickSheets`): the Plan sheets input tab; a PNG / JPG, or a PDF page rendered by pdf.js
  (page and resolution 3,000 / 5,000 / 7,000 px long side), placed at the map centre; move and rotate handles (drag, one undo step each,
  per-animation-frame updates); opacity, show, lock; scale calibration (two points picked on the map, real distance D); the plan's stated
  scale on a PDF's page size; georeference (two picked points, their State Plane coordinates; "move the items drawn on this sheet with it");
  rotation input; Replace / Reload image; Remove; Images in this browser (count, MB, include in Export JSON, Clean up unused). Site tab and
  Report sections (sheet table, worked steps).
- `apps/crane-pick/ui/sheetstore.js` (new, `window.CranePickSheetStore`): IndexedDB `crane.sheets.v1`, store `img` (one record per sheet
  id: `{ id, blob, type, name, w, h, size, at }`); in memory when IndexedDB is not available (the page says so).
- `engine/model.js` `normSheet`: new sheet fields `pageIn` (`{ w, h }` in, PDF page size), `planScale` (ft per in, a number), `basis`
  (`none | plan | cal | geo`, `BASIS`). Before: `planScale: str(s.planScale)` (text, unused); after: a number or null. No project was ever
  saved with a sheet before this PR (sheets could not be added), so no migration is needed.
- `engine/worked.js`: `planScale(sheet)` steps (below).
- `ui/map.js`: the map's status line is an overlay on the map (`#mbStatus`), so the map no longer moves while the user picks points (it
  sat in the bar above the map, whose height changed with the text); a ResizeObserver keeps Leaflet's size in step with its box.
- `ui/site.js`: `CranePickSite.steps(list)` (worked steps as the bridge apps show them, `shared/steps.js` `line()`).
- `index.html`: the two scripts, CSS (handles, sheet cards, chips, the status overlay).
### Formulas (new; CLAUDE.md §4: no existing formula changed)
- Calibration: s = D / d_px, d_px = √((p_x2 − p_x1)² + (p_y2 − p_y1)²); the placement is rescaled about the two points' midpoint (it keeps
  its grid position). Check case: points (600, 1200) and (1800, 1200), D = 100 ft → d_px = 1200, s = 0.083333 ft/px.
- Stated plan scale (PDF): s = S · W_in / W_px. Check case: 17 × 11 in page rendered 3,000 px wide, 1 in = 20 ft → s = 20 × 17 / 3000 =
  0.113333 ft/px. Valid only for a full-size PDF; the step's note says to check it against a known dimension.
- Georeference (two points): s = L_g / d_px, θ = atan2(ΔN, ΔE) − atan2(−Δp_y, Δp_x), origin from point 1 (`engine/geo.js` `georef`).
  Check case (`tests/engine/crane-geo.test.mjs`): a sheet at 0.2 ft/px rotated 30°, pixel (0, 0) at (5000, 6000): points (120, 80) and
  (2400, 1700) → d_px = 2,796.927, L_g = 559.385 ft, s = 0.2, θ = 30.0000°, origin (5000, 6000) recovered; with a calibration of 0.25 ft/px
  the check shows +25.00 %.
### Saved data (§5)
New: IndexedDB database `crane.sheets.v1` (prefixed per tool). The saved project keeps placement and calibration only (no pixels in
localStorage); Export JSON may add `images: { <sheet id>: data URL }` (option, on by default); the GitHub copy never has images.
### Decisions (pending engineer review)
- Images are kept per browser in IndexedDB, not in the saved-project list or on GitHub (localStorage is about 5 MB for every tool together).
  A project opened elsewhere shows each sheet's outline and asks for the file again; the calibration is kept. Export JSON with images
  carries everything in one file.
- Images are never deleted automatically (Undo of a Remove needs them); "Clean up unused images" removes those no saved project, autosave
  or open project uses (an unreadable saved-project list removes nothing).
- A replaced / reloaded image of a different pixel size keeps the sheet's ground size (s scales by the width ratio; picked points too).
- When a sheet is georeferenced, a later scale calibration is recorded as a check only (the georeference governs).
### How verified
`node tests/smoke/crane-sheets.mjs` (8 checks, below); `node tests/smoke/crane-shell.mjs` (11); `node tests/engine/run.mjs crane` (10);
`node tests/check-syntax.mjs`.

## 2026-11-16 — C1-3: site items (drawing, dragging, editing), OSHA power-line clearance, Site and Report sections
PR #1604: https://github.com/mlococo88/All-Structural/pull/1604
### Where
- `apps/crane-pick/ui/draw.js` (new, `window.CranePickDraw`): the Draw bar above the map and the "Site items" input tab. Tools:
  obstruction (area; height above grade, top elevation), power line (line; voltage, "not known, ≤ 350 kV", the utility / RPE clearance
  over 1,000 kV, lowest wire height for C3), utility line and utility area (kind utility / culvert / wall / other; depth to top, top
  elevation, size; for the C4 stress-at-depth checks), exclusion zone (area; reason), label (text, size), dimension (two points; distance
  and bearing, live while drawing). Drawing: clicks; double-click / Enter / Finish / a click on the first point ends; Backspace, Esc.
  Editing: click to select; vertex handles (drag; double-click removes), "+" handles (drag adds a point), ✥ handle, body drag (mouse),
  a selected label drags by its text; properties and vertex coordinates (zone units) in the tab; Delete key / ×. Every finished drag or
  edit is one undo step; drag redraws are throttled to one per animation frame (`CranePickMap.raf`) and the tab's computed values follow
  live. Site tab: one table per type with the computed values and the worked steps (links from the tab); Report: §"Site items" with a
  site-plan SVG figure (north up, scale bar, buffers), tables, the OSHA Table A note and the worked steps.
- `engine/osha.js` (added in C1-1, now loaded), `index.html` (the two scripts, CSS), `ui/app.js` (`itab` event), `ui/map.js` (a tool
  click is flagged so it does not clear the selection; while a tool is active the items let clicks through, class `crTool`; fractional
  zoom 0.25 so a fitted sheet fills the view), `ui/sheets.js` (the sheet's handles and blue outline only while the Plan sheets tab is open).
### OSHA values used (CLAUDE.md §4: new code reference; engineer to confirm)
29 CFR 1926.1408 Table A "Minimum Clearance Distances" (Cranes and Derricks in Construction, 75 FR 47906, Aug. 9, 2010; current eCFR):

| Voltage (nominal, kV, AC) | Minimum clearance (ft) |
|---|---|
| up to 50 | 10 |
| over 50 to 200 | 15 |
| over 200 to 350 | 20 |
| over 350 to 500 | 25 |
| over 500 to 750 | 35 |
| over 750 to 1,000 | 45 |
| over 1,000 | as established by the utility owner/operator or a registered professional engineer who is a qualified person with respect to electrical power transmission and distribution |

Table note: the value after "to" is included in its row ("over 50 to 200" includes 200 kV). Source check: the official eCFR / OSHA pages
could not be opened from this session (network); the values were confirmed against search results limited to osha.gov, ecfr.gov,
govinfo.gov (CFR 2012 / 2014 annual editions of § 1926.1408) and federalregister.gov (75 FR 47906), which agree with each other.
**Engineer to confirm against the current eCFR text before relying on it.**
Check cases (`tests/engine/crane-geo.test.mjs`, `tests/smoke/crane-draw.mjs`): 0.12 / 13.8 / 50 kV → 10 ft; 50.01 / 115 / 200 kV → 15 ft;
230 / 345 / 350 kV → 20 ft; 350.1 / 500 kV → 25 ft; 735 / 750 kV → 35 ft; 765 / 1,000 kV → 45 ft; 1,100 kV → not set until entered.
The plan buffer drawn around the line has radius D_min (tested: every point of a vertex circle at D_min from the vertex).
### Decisions (pending engineer review)
- Voltage not known: 50 ft (1926.1409's Option 2 distance for lines over 350 kV, conservative); 20 ft when the user ticks "the utility
  says 350 kV or less" (1926.1408(a)(2)(ii) Option 2). Table A only with an entered voltage (Option 3 needs the utility's voltage).
- The buffer is the horizontal (plan) distance only; the step note and the tab say the clearance applies in 3D to any part of the
  equipment, load line or load (checked in C3).
- "Items drawn on a sheet" (moved by a georeference) = items whose every point lies inside the sheet's footprint before the move.
- A click on the empty map clears the selection; a click that ends a drag, or that lands on a handle or label, does not.
### Tests
`node tests/smoke/crane-draw.mjs` (7 checks), `crane-sheets.mjs` (8), `crane-shell.mjs` (11); `node tests/engine/run.mjs crane` (10);
`node tests/check-syntax.mjs`.

## 2026-11-16 — C2-1: crane library (GitHub / files), project cranes, crane cards, crane editor (paste from Excel)
PR #1606: https://github.com/mlococo88/All-Structural/pull/1606
### Where
- `apps/crane-pick/engine/cranes.js` (new, `window.CranePickCranes`, no DOM): crane files of schema `crane-pick.crane.v1` (the private
  library's SCHEMA.md): `parse` (structure check: schema, make / model, grid shape (one row per radius, one value per boom length),
  numbers or null, radii increasing, boom lengths non-decreasing, zones, duplicate ids → errors; capacity increasing with radius, blanks
  between rated cells, preliminary, rating basis not found → warnings), `lookup` (below), `ratingBasis` (the % of tipping read from the
  config notes, or entered), `interpPermitted` (the notes mention interpolation and do not forbid it), `groups` / `zoneOf` / `chartFor`
  (zone charts, used by C2-2), `planDims` (the map symbol's dimensions from the file's dims, with the user's overrides), `hookBlocks`,
  `pasteChart` / `chartText` (Excel paste: radius rows × boom-length columns), `fingerprint` (FNV-1a of the crane without `app_inputs`).
- `apps/crane-pick/ui/cranes.js` (new): the Cranes input tab: "Load crane library from GitHub" (repository / branch / folder settings,
  defaults mlococo88/Structural_References, crane-charts, "Crane Load Charts/library/"; read with the Cloud sync token through
  `shared/github-sync.js` `client` (unchanged): token only in the Authorization header to api.github.com), "Load crane file(s)",
  the library list (Add to project, ×), the project's crane cards (source document, revision, date, pages, file, where it was loaded
  from, fingerprint, PRELIMINARY, terms, configs with the rating basis (entered where the notes do not state it), zone sectors, plan
  dimensions with what was assumed, the phase-4 inputs "for outrigger loads (phase 4)": upperworks weight and CG, carrier / carbody weight
  and CG, float / shoe size), "Use the library copy" when the chart data differ, Remove; the Cloud sync repository check; Report §Cranes.
- `apps/crane-pick/ui/craneedit.js` (new): the crane editor dialog (crane data, plan-dimension overrides, configs, the chart as
  tab-separated text with a checked preview; an edited chart is marked `app_inputs.edited`).
- `engine/model.js`: `P.cranes` (+ `normCrane`), keys below. `ui/project.js`: Save asks `CranePickCraneUI.beforeSave(name)` first
  (below). `index.html`: three scripts, CSS, footer v0.2. Tests: `tests/engine/crane-lib.test.mjs`, `crane-library-real.test.mjs`,
  `tests/smoke/crane-library.mjs`, fake cranes `tests/smoke/crane-fake-wheeled.json`, `crane-fake-crawler.json` (synthetic values);
  `tests/smoke/crane-draw.mjs` (the input-tab list now ends with Cranes).
### Chart data stays out of this repository
All-Structural is public; the manufacturer chart data (the engineer's extraction) is only in the private references repository
(branch crane-charts). Nothing numeric from it is committed: the tests use two synthetic cranes ("FAKECO … (FAKE TEST DATA)");
`crane-library-real.test.mjs` checks the real files' structure only, and only where `CRANE_LIB_DIR` points to a local copy (run
locally: every file loads; a file without charts loads with a warning).
Where chart data can end up once loaded: this browser's `crane.library.v1`; every project that uses a crane (`crane.project.current`,
`crane.projects.v1`, Export JSON files); the Cloud sync copy of a saved project (`projects/crane-pick/<name>.json` in the repository set
in Cloud sync); the Report (C2-2 on: the cells used).
**Sync-repository finding:** `shared/github-sync.js` copies saved projects to the repository the user typed in Cloud sync (owner / repo /
branch, default repository name `structural-projects`); nothing stops it from being `mlococo88/All-Structural` or another public
repository (the shared dialog's "Test connection" only warns when it is public). So this tool checks it: when the project holds cranes and
sync is set up, GET /repos/{owner}/{repo} (the same token, header only) records `private` in `crane.syncCheck`; the Cranes tab shows
where chart data go and warns when the repository is PUBLIC, unchecked, or named All-Structural; Save asks first (Cancel = not saved)
unless the repository was checked private or the name is held as "This browser only".
### Chart lookup (CLAUDE.md §4: new calculation; Decision pending engineer review)
Rule (conservative, as the engineer set it): **no interpolation**: C = chart cell at L_tab = the smallest tabulated boom length ≥ L and
R_tab = the smallest tabulated radius ≥ R. Not permitted: R below the smallest or above the largest tabulated radius, L above the longest
length, a blank cell (null), a cell the file marks "special equipment" (e.g. an over-rear-only value printed in a 360° chart).
Added for review (conservative): when L lies between two tabulated lengths and the next shorter length's cell at R_tab is rated and lower,
the lower value is used (one library chart's notes ask for "the lesser of adjacent boom lengths"); repeated columns at one length
(telescoping modes) give the lowest unless a mode is chosen. Optional (project setting, C2-2; only where the notes are read to permit it):
linear interpolation between the two tabulated radii in the L_tab column.
**Check cases** (fake crane `or-full-360`, `tests/engine/crane-lib.test.mjs`): L 50 ft, R 17 ft → L_tab 60, R_tab 20 → C = 58,000 lb
(the 40 ft cell, 60,000, is higher: not used); L 90, R 65 → L_tab 100, R_tab 70 → 10,500, the 80 ft cell 10,000 is lower → C = 10,000 lb;
L 60, R 5 / 70.5 / L 100.5 → not permitted; L 40, R 40 → blank → not permitted; with interpolation (notes permit): L 60, R 25 →
58,000 + (39,000 − 58,000)(25 − 20)/(30 − 20) = 48,500 lb (without: 39,000).
Rating basis: read from the notes by the pattern "NN % of (static) tipping" (where the extracted notes do not state it, the card asks
for it). Shown on each card and in the Report; not used in a calculation.
### Saved data (§5)
New keys only: `crane.library.v1` (the library: `{ v: 1, cranes: { <make-model>: { def, src, at, fp } } }`), `crane.libsrc` (the GitHub
library settings), `crane.syncCheck` (`{ owner, repo, private, at }`). Project: new field `cranes` (absent in older projects = none; no
migration). The Cloud sync settings key is read only (the token and, for the "This browser only" hold, the tool's sync state).
### Decisions (pending engineer review)
- The library is kept in localStorage (`crane.library.v1`, about 15–20 kB per crane), not IndexedDB: simple and synchronous; a full
  storage says so and the crane can still be added to the project.
- A project carries a full copy of each crane it uses (self-contained, as decided); "Use the library copy" replaces it when the library's
  chart data differ (the fingerprint shows it); the entered inputs (`app_inputs`) are kept.
- Zone sectors (over-front / over-rear half-angles) are inputs on the crane card (the files do not give the working-area diagram);
  not set = the zone chart is not used (the 360° or over-side chart applies), the conservative reading.
- Plan dimensions missing from a file are assumed and listed (carrier centred between the outrigger beams, crawler centred on rotation,
  gauge = width over tracks − shoe); display and plan clearances only.
- An edited chart is marked "edited here" on the card and in the Report; the library copy is changed only when the user ticks it.
### How verified
`node tests/engine/run.mjs crane` (27 tests, 0 failed); `CRANE_LIB_DIR=<local copy> node tests/engine/run.mjs crane-library-real`
(structure, local only); `node tests/smoke/crane-library.mjs` (9 checks: files, cards, inputs, Undo / Redo, mocked GitHub with the
token only in the Authorization header, the public-repository warning and Save question, the editor (paste, kip, edit, restore),
reload, Report, 390 px, 0 console errors); `crane-shell.mjs` (11), `crane-sheets.mjs` (8), `crane-draw.mjs` (7);
`node tests/check-syntax.mjs`.

## 2026-11-16 — C2-2: crane placement on the map, live capacity, plan clearances, Lifts tab
PR #1607: https://github.com/mlococo88/All-Structural/pull/1607
### Where
- `apps/crane-pick/engine/lift.js` (new, `window.CranePickLift`, no DOM): `evalAt` (radius, slew angle, zone, chart lookup through
  `engine/cranes.js`, % of chart, class), `evaluate` (total load, pick, set, swing path, governing point), `sweep` / `pathPoints`,
  `footprint` (carrier / carbody, crawler tracks, outrigger beams and floats at the chart's spread, tail swing), `clearances`
  (plan), `settingsOf`, `toGrid`, `minDist`.
- `apps/crane-pick/ui/place.js` (new): the map symbols and handles (✥ move, ↻ rotate the carrier, P / S points), boom lines, swing
  path coloured by the governing class, live labels at the hook (R, C, % of chart), updates once per animation frame
  (`CranePickMap.raf`) and one undo step per drag; the Lifts input tab: settings (caution / critical / limit %, interpolation where the
  notes permit), setups (chart group, boom length with the tabulated lengths listed, telescoping mode, support and spread drawn, heading,
  rotation E / N, picks), picks (load, rigging, hook block from the crane's list or entered, other deductions and what they are, the
  chart's deduction notes, swing shortest / clockwise / counter-clockwise, pick / set E / N) and the live card (pick / set / governing
  table, W, swing, R_max, thresholds, rating basis, not-permitted reasons, clearance flags, worked steps).
- `engine/model.js`: `P.setups`, `P.picks`, `P.lift` (+ `normSetup`, `normPick`, `normLift`). `engine/geo.js` `reproject`: setups
  (position and heading: a point 100 ft ahead is moved too) and pick / set points follow a zone change. `ui/cranes.js` (C2-1) shows
  "Place on the map" on each crane card. `index.html`: two scripts, CSS. Tests: `tests/engine/crane-lift.test.mjs`,
  `tests/smoke/crane-place.mjs`; `crane-library.mjs` (the input tabs now end with Lifts).
### Calculations (CLAUDE.md §4: new; Decisions pending engineer review)
- Radius: R = √(Δx² + Δy²) from the centre of rotation (the setup's point) to the hook (pick or set point), grid ft.
- Slew angle θ = α − α_front (azimuth of the hook from the rotation centre minus the carrier heading), −180° … 180°; zone: over front if
  |θ| ≤ the entered front half-angle, over rear if |θ| ≥ 180° − the rear half-angle, otherwise over side; a zone's own chart is used in
  its zone, else the 360° chart; no chart → not permitted. Only when the chosen chart group has zone charts; else the 360° chart.
- C = chart capacity at (L, R): C2-1 lookup (next longer boom, next larger radius; outside = not permitted).
- Total load W = W_load + W_rigging + W_hook + W_other (the charts are gross; the deduction notes of the chart are shown beside the inputs).
- %chart = W / C × 100. Classes: ≥ limit (default 100 %) over the chart; ≥ critical (default 75 %) critical lift; ≥ caution (default
  75 %) caution. Thresholds are project inputs (`P.lift`); the chart's rating basis (% of tipping) is shown with them.
- Swing path: from the pick to the set about the rotation centre, shortest way by default (a half turn: clockwise), the radius changing
  uniformly with the angle; checked every degree and on both sides of each zone boundary; R_max = max(R_pick, R_set); governing = the
  highest % of chart (any not-permitted point governs; a tie with an end is reported at that end).
- **Check case** (fake crane, outriggers full 360°, boom 60 ft, rotation E 1,000 N 2,000, heading 0): pick (1,030, 2,000): R = 30.00 ft →
  L_tab 60, R_tab 30 → C = 39,000 lb; W = 20,000 + 1,000 + 1,000 + 0 = 22,000 lb → 56.41 %; set (1,000, 2,020): R = 20.00 ft → 58,000 lb
  → 37.93 %; swing −90° (counter-clockwise), R_max = 30.00 ft, governing at the pick 56.4 % (within the chart). With W = 30,000 lb:
  76.9 % = critical lift. Set at 75 ft: beyond the largest radius → not permitted.
- Plan clearances (flags only; heights are C3): power line: distance in plan from the swept boom sector (rotation centre + swing path)
  and from the footprint to the line < D_min (C1-3 OSHA Table A value) → red flag (check: a 115 kV line 10 ft east of the pick → D_min
  15 ft, closest 10.0 ft → flagged; 13.8 kV (10 ft) → not flagged); exclusion zone: load path crosses it / boom swings over it /
  footprint or tail-swing circle in it → amber; obstruction: footprint overlaps it → red; tail-swing circle reaches it → amber; boom
  passes over it → note (height check in C3).
### Saved data (§5)
Project fields only, new: `setups`, `picks`, `lift` (absent in older projects = none / the defaults; no migration). No new storage key.
### Decisions (pending engineer review)
- The radius is measured from the rotation centre (the chart radius); the boom-foot offset is drawn only (the boom line starts at the
  rotation centre).
- The swing path assumes the radius changes uniformly with the swing angle (boom luffed steadily between the two radii). Other paths
  (luff first, then swing) can reach the larger radius earlier in the swing; the zone check uses R_max where the zones differ only through
  the check points, so a planner wanting the worst case should put the pick and the set at the larger radius.
- The tail-swing circle is checked as a full circle (the counterweight can be anywhere during the setup's work).
- Footprint uses the outrigger spread named by the chart's support (outriggers-full → "full"); "on rubber" draws no outriggers.
- The rotate handle sits 6 ft ahead of the carrier front and is drawn above the pick / set points.
### How verified
`node tests/engine/run.mjs crane` (35 tests: the check case, thresholds, swing directions, zones with sectors, footprint, clearances,
zone change, KaTeX of every step); `node tests/smoke/crane-place.mjs` (9 checks: place, hand check on the map labels and the live card,
pick dragged with the values following mid-drag and live updates ≤ frames, one undo step, crane moved and rotated, thresholds, not
permitted, interpolation, clockwise swing, chart group, power-line flag, steps, reload, 390 px, 0 console errors); `crane-library.mjs` (9),
`crane-shell.mjs` (11), `crane-sheets.mjs` (8), `crane-draw.mjs` (7); `node tests/check-syntax.mjs`.

## 2026-11-16 — C2-3: Picks tab, Report §Lifts
PR #1608: https://github.com/mlococo88/All-Structural/pull/1608
### Where
- `apps/crane-pick/ui/picks.js` (new): the Picks output tab (between Plan and Site): one row per pick (pick, crane setup, chart, boom,
  R pick / set / max, C pick / set, W, governing point and its capacity, % of chart, status, flags) with links (the pick: selected on the
  map; "worked": its flags and worked steps below the table; "Report": its § in the Report); the Report's §Lifts: Basis (the lookup rule,
  W, % of chart, thresholds, the swing-path and zone method, plan-only clearances, a § link to §Cranes), Summary of picks (§ link to each
  pick), a plan figure (setups to scale, tail-swing circles, boom lines, swing paths coloured by status, P / S with R and %, power-line
  D_min buffers, obstructions, exclusion zones), and one subsection per pick (inputs with a § link to its crane, result, flags,
  not-permitted reasons, worked steps of the total load, the pick, the set, the swing path and the governing point).
- `ui/app.js` `outTab`: optional `before` (the tab id it goes in front of; Picks before Site). `ui/place.js`: "worked: Report" link
  on the live card; settings labels. `ui/project.js`: the About text. `index.html`: the script, CSS. Tests:
  `tests/smoke/crane-picks.mjs` (new), `crane-shell.mjs` (the output tabs now Plan · Picks · Site · Report).
### Calculations
None new (CLAUDE.md §4): the values are engine/lift.js's (C2-2), shown again. Checked: the Picks tab's first row equals the C2-2 hand
check (R 30.00 / 20.00 ft, C 39,000 / 58,000 lb, W 22,000 lb, 56.4 %); every value in the tab is the engine's for the stored project.
### Saved data (§5)
None changed.
### How verified
`node tests/smoke/crane-picks.mjs` (5 checks: two fake cranes, three picks; the table against the engine; links to the map, the steps
and the Report; Report §Lifts with no unresolved or duplicate keys and no NaN, § links to the picks and the cranes; Undo updates the tab;
390 px; 0 console errors); `crane-place.mjs` (9), `crane-library.mjs` (9), `crane-shell.mjs` (11), `crane-sheets.mjs` (8),
`crane-draw.mjs` (7); `node tests/engine/run.mjs crane` (35); `node tests/check-syntax.mjs`. Locally (not committed): all ten real library
files load in the app and two real cranes place and compute with 0 console errors.

## 2026-11-16 — C3-1: heights (boom angle, boom tip, hook, load bottom, hook reach), crane elevation geometry, pick heights
PR #1609: https://github.com/mlococo88/All-Structural/pull/1609
### Where
- `apps/crane-pick/engine/elev.js` (new, `window.CranePickElev`, no DOM): `geomOf` (the crane's elevation geometry: entered / file /
  assumed), `chartAngle` (the config's printed boom-angle table), `angleAt`, `tipAt`, `point` (heights at the pick or the set with their
  steps), `evaluate` (pick, set, travel height, the hook reach along the swing, flags, geometry steps), `el0`, `padEl`, `FROM`.
- `engine/model.js`: `setup.pad` (crane pad elevation, ft), `pick.elev = { pg, ph, sg, sh, rig, blk, trav, L, W, H }` (`normElev`);
  the crane's `app_inputs.geom = { footH, head, boomW, cwBot, cwTop }` (kept as entered by `normCrane`).
- `ui/cranes.js` (card: "Elevation geometry" inputs with the file's values as placeholders and the assumptions listed; Report §Cranes:
  the geometry with where each value comes from), `ui/craneedit.js` (editor section "Elevation geometry"), `ui/place.js` (`evalPick` adds
  `ev.elev` and its flags; setup: "Crane pad elevation"; pick: "Heights" inputs; live card line `#lfHeights`; worked steps "Heights …"),
  `ui/picks.js` (Picks tab: columns θ pick / set, tip el. pick / set, hook reach min (after Flags); the worked steps; Report §Lifts: the
  basis note, a "Hook reach min" summary column, each pick's heights and steps; `gotoReport` jumps again at 160 / 420 ms because the
  shared viewer's lazy parts can move the target after the first jump), `index.html` (script, notes, footer v0.3).
- Tests: `tests/engine/crane-elev.test.mjs` (new), `tests/smoke/crane-elev.mjs` (new); the synthetic fake wheeled crane
  (`tests/smoke/crane-fake-wheeled.json`) gains made-up heights (boom-foot pin 8 ft, counterweight 4 / 10 ft, maximum boom angle 80°)
  and a made-up boom-angle table on `or-full-360` (geometric angle with e = 2 ft, rounded, minus 1°).
### Formulas (CLAUDE.md §4: new calculation; no existing formula changed)
- d_h = R − e (e: boom-foot pin ahead of the rotation centre); θ_g = acos(d_h / L); θ_c = the chart's printed (loaded) boom angle at
  (L, R) where the config prints a table and L is one of its columns (read at R, else linear between the two printed radii; telescoping
  modes without a mode: the lowest); θ = θ_c where available (both shown, an info flag when they differ by more than 0.5°), else θ_g.
  d_h > L: not reachable (red); θ above the file's maximum boom angle: red.
- z_tip = z_pad + h_f + L sin θ (tip plumb above the hook); z_lb = z_g + h_b; z_hk = z_lb + H + h_r; z_bk = z_hk + h_bk;
  m = z_tip − H_hd − z_bk ≥ 0 (hook reach / two-block; red when negative); ℓ = z_tip − z_bk.
- Travel: z_tr = entered, else max(z_lb,pick, z_lb,set); m_tr = min over the swing path (every degree) of z_tip(R) − H_hd − z_bk,tr.
**Check case** (fake crane, `tests/engine/crane-elev.test.mjs` and `tests/smoke/crane-elev.mjs`): L 60, e 2 (file), h_f 8 (file),
H_hd 3 (entered), z_pad 100. Pick R 30: d_h 28 → θ_g = acos(28/60) = 62.1819°, chart 61° → z_tip = 100 + 8 + 60 sin 61° = 160.4772;
ground 98 + 4 → z_lb 102.00; H 6, h_r 12, h_bk 5 → z_hk 120.00, z_bk 125.00; m = 160.4772 − 3 − 125 = 32.4772 ft. Set R 20: θ_g 72.5424°,
chart 72° → z_tip 165.0634; z_lb 120.00, z_hk 138.00, z_bk 143.00, m = 19.0634 ft. Travel 120.00 → z_bk,tr 143.00; lowest tip on the
swing at R 30 → m_tr = 14.4772 ft. R 25: θ_c = 72 + (61 − 72)(5/10) = 66.5° (θ_g 67.4597°). Set load bottom 60 ft → z_bk 183,
m = −20.9366 ft → red flag.
### Saved data (§5)
New fields only (`setup.pad`, `pick.elev`, `app_inputs.geom`); absent in older projects = not entered (the defaults below); no
migration, no new storage key.
### Decisions (pending engineer review)
- Missing crane geometry is assumed and listed on the card, in the Report and as an info flag on every pick: boom-foot pin 0 ft high
  and on the rotation centre, head allowance 0, boom width 0 (centre line), counterweight bottom 0, top not limited. These give the
  lowest boom: conservative for the hook reach and for anything under the boom, not for a power line above it (said where used).
- The chart's printed boom angle governs where present (as asked); the tip is placed plumb above the hook at that angle.
- No elevation entered = the crane pad is the datum 0.00; a pick / set ground not entered = the pad.
- Elevations are in ft whatever the zone's plan unit.
### How verified
`node tests/engine/run.mjs crane` (42 tests, 0 failed: the C2 tests unchanged, so no C2 result changed with the fixture additions);
`node tests/smoke/crane-elev.mjs` (7 checks), `crane-picks.mjs` (5), `crane-place.mjs` (9), `crane-library.mjs` (9), `crane-shell.mjs`
(11), `crane-sheets.mjs` (8), `crane-draw.mjs` (7); `node tests/check-syntax.mjs`.

## 2026-11-16 — C3-2: 3D clearances along the path, the path model setting, the elevation view
PR #1610: https://github.com/mlococo88/All-Structural/pull/1610
### Where
- `apps/crane-pick/engine/clear3d.js` (new, `window.CranePickClear`, no DOM): `segSeg3`, `cpPoly`, `ptPrism`, `discPrism`, `segPrism`,
  `spanRect`, `envelope` (the site item as prisms), `check` (every power line, obstruction and exclusion zone against the boom, load line,
  load and counterweight along the path; results with worked steps and flags).
- `engine/lift.js`: `pathPoints(setup, a, b, dir, model)` (new `model`: 'uniform' as C2, or 'luff'; returns `at(t)`, `tL`, `model`);
  `evaluate` passes `s.path`, zone-boundary points from `at`, the governing text "on the luff at the pick, R = …", a path-model step,
  `path.at / tL / model`, `govT`; `settingsOf` adds `path`, `obstClr` (2 ft); `cfgAt` (the config at a hook position without the lookup);
  `clearances(…, { skip3d })` leaves out the plan flags the 3D check replaces (power line vs the boom / load swing, exclusion zone vs the
  load path and the boom, obstruction vs the tail swing and the boom passing over); the footprint flags stay.
- `engine/elev.js`: the swing-reach loop uses `cfgAt`; no strings formatted in the quiet (path) calls (speed only; same values).
- `engine/model.js`: items `obst.gradeEl`, `power.gradeEl / sag / sway`; `lift.path`, `lift.obstClr`.
- `ui/draw.js`: the item inputs (grade elevation; power line: sag and sway allowances; "lowest wire" hint). `ui/place.js`: `evalPick`
  adds `ev.c3` (flags first), memoized per state (pick, setup, settings, a revision bumped by every other change); the map shows each
  red / amber 3D result as a marker at the closest point with a dashed line to the item; settings "Path model" and "Clearance to
  obstructions"; steps "3D clearance: <item>". `ui/picks.js`: column "Closest 3D"; Report: the 3D basis note, a table per pick and the
  steps. `ui/elev.js` (new): the elevation view (a dock under the map, live while dragging: at the pick / the set / the capacity governing
  point / the closest 3D clearance) and Report §Elevations (pick and set per pick). `index.html`: scripts, CSS, notes.
- Tests: `tests/engine/crane-clear3d.test.mjs` (new), `tests/smoke/crane-clear3d.mjs` (new); `crane-lift.test.mjs` (settings defaults),
  `crane-place.mjs` (the power-line flag is now the 3D one), `crane-picks.mjs` (the exclusion-zone text).
### Calculations (CLAUDE.md §4: new; the C2 plan flags they replace are listed above)
- Components: boom = segment foot pin (rotation centre + e along the slew, z_pad + h_f) → tip (plumb above the hook, z_tip), less
  b_w / 2; load line = vertical from the load top to the tip; load = vertical cylinder, radius √(L² + W²)/2, load bottom to top (the whole
  vertical travel while hoisting at the pick / lowering at the set); counterweight = tail-swing cylinder, z_pad + z_cb … z_pad + z_ct.
- Positions: hoisting at the pick, every path point (every degree; luff every 1 ft; zone boundaries), lowering at the set; the closest
  point refined by golden-section search between its neighbours (to 1e-6 of the path).
- Power line: per span a prism, plan = span ± s_h, height z_w − s_v … z_w, z_w = z_gr + h_w (grade: entered, else the pad); height not
  entered = a vertical plane (plan distance). D ≥ D_min (29 CFR 1926.1408 Table A, as C1-3) for every component; the true minimum and its
  component are reported (red below D_min, info otherwise).
- Obstruction: prism up to z_top (top elevation, else grade + height); contact red, below the project clearance (2 ft) amber; height not
  entered: amber only when within the clearance in plan. Exclusion zone: no height limit (plan): any component over it amber.
- Distances: segment–segment (Ericson, Real-Time Collision Detection, §5.1.9); point / segment to a prism (end points and the prism's
  edges, 0 when the segment meets it); cylinder to prism √(max(0, d_plan − r)² + Δz²).
**Check cases** (hand-computed, `tests/engine/crane-clear3d.test.mjs`): segments (0,0,0)-(10,0,0) to (5,5,−5)-(5,5,5) = 5,
(0,3,4)-(0,13,4) = 5, parallel 5, crossing 0; square prism 0…10 × 0…10 × 0…20: side 5, above 5, vertical edge 7/√2 = 4.9497, through 0;
cylinder (20,5) r 3 z 0…5 to the prism z 8…20: √58 = 7.6158. Lift (C3-1 hand check, pick R 30, tip 160.4772, foot pin (1,002, 2,000,
108)): 115 kV line at x = 1,040, wire el. 150: load line 10.00 ft < 15 → red; boom 13.76 ft (t = 0.92372); sway 3: 7.00; wire height not
entered: the 40 × 4 load (r 20.10) reaches the plane: 0. Obstruction 1,015…1,025 × 2,010…2,020, top 110: point load over it at travel
120: 10.00 ft; governing the counterweight √325 − 15 = 3.03 ft; top 125: contact. Wall 15 ft west, top 103 vs counterweight bottom 104:
1.00 ft amber. Paths: uniform 91 points; luff 10 + 91, tL = 10 / (10 + 10π) = 0.241453; an exclusion square crossed by the uniform path
(load 0) is 2.63 ft (√512 − 20) from the luff path.
### Decisions (pending engineer review)
- Path model default "uniform" (C2); "luff then swing" is a project setting. A "worst of both" option is not offered.
- Load: any orientation in plan (radius √(L² + W²)/2); counterweight: the full tail-swing circle at every slew angle (C2).
- Obstruction clearance 2 ft (setting); obstructions extend down without limit; the footprint vs power-line check stays in plan.
- Sag lowers the envelope from the lowest-wire height; sway widens it sideways (a box, conservative for a swinging wire).
- Engineer instruction 2026-11-16 (speed up): the elevation view joined this PR; lighter checks (syntax, crane engine tests, the crane
  smokes touched and one new smoke) instead of every crane smoke after each change.
### How verified
`node tests/engine/run.mjs crane` (48 tests, 0 failed); `node tests/smoke/crane-clear3d.mjs` (8 checks, incl. the elevation dock live
mid-drag and Report §Elevations), `crane-elev.mjs` (7), `crane-place.mjs` (9), `crane-picks.mjs` (5); `node tests/check-syntax.mjs`.

## 2026-11-16 — C3-3: the 3D view (three.js)
PR #1611: https://github.com/mlococo88/All-Structural/pull/1611
### Where
- `apps/crane-pick/ui/view3d.js` (new, `window.CranePickView3D`): three.js r128 + OrbitControls (engineer-approved for C3; the pinned
  files `apps/steel-bridge/index.html` uses: `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`,
  `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`), loaded when the 3D view is first opened (as
  `ui/sheets.js` loads pdf.js). The scene: plan sheets as the ground texture (else a grid), obstructions (prisms to their top; height
  not entered: a 30 ft wireframe), exclusion zones (translucent), power lines at the lowest-wire elevation with their D_min (+ sway)
  tubes (height not entered: a vertical plane), every setup (carrier / carbody, tracks, floats, outrigger beams, tail-swing circle), and
  for the selected pick: the boom at the chosen point (pick / set / capacity governing / closest 3D), the counterweight at that slew, the
  load line, hook block, rigging, load box (L along the boom), the swing envelope (the boom's swept surface; the tip path; the hook path
  at the travel height) and the red / amber 3D clearance flags (closest points). Orbit / pan / zoom; renders on demand; the camera is
  kept while the same pick is shown. WebGL not available or three.js not loaded: a message (the elevation view and every check work).
  Report: §"3D view", a snapshot of the view as last shown (a picture only; not saved with the project).
- `ui/elev.js`: the dock switches between "Elevation" and "3D" (`crane.ui.elev.mode`, per browser). `index.html`: the script, CSS,
  notes, footer. `tests/libs/MANIFEST.json`: three@0.128.0 `used_by` adds apps/crane-pick (the files were already there).
- Tests: `tests/smoke/crane-3d.mjs` (new).
### Calculations
None (CLAUDE.md §4): display of the values of engine/lift.js, elev.js, clear3d.js (checked: the boom's middle at x 16.00, el. +34.24
= ((2 + 30) / 2, (8 + 60.4772) / 2) from the rotation centre and the pad in the C3-1 hand check).
### Saved data (§5)
None in the project; the view mode in `crane.ui` (per browser).
### Decisions (pending engineer review)
- three.js is loaded on demand (no download for users who never open the 3D view; offline: a message), not as a static tag.
- Display-only simplifications: the carrier body is drawn to the counterweight bottom height (5 ft when not known), the counterweight as
  a block behind the rotation centre at the shown slew (the checks use the full tail-swing cylinder), the load box with L along the boom
  (the checks use any orientation).
- Engineer instruction 2026-11-16 (speed up): lighter checks (syntax, crane engine tests, the touched smokes, one new smoke).
### How verified
`node tests/smoke/crane-3d.mjs` (7 checks: three.js from tests/libs, scene contents, the canvas drawn, orbit, the boom following a plan
drag mid-drag, Undo / Redo, Report snapshot, 390 px, 0 console errors, WebGL-unavailable message), `crane-clear3d.mjs` (8);
`node tests/engine/run.mjs crane` (48); `node tests/check-syntax.mjs`.

## 2026-11-16 — C4: ground and supports (outrigger / track loads along the swing, mats, ground bearing, stress at depth)
PR #1612: https://github.com/mlococo88/All-Structural/pull/1612
### Where
- `apps/crane-pick/engine/ground.js` (new, `window.CranePickGround`, no DOM): `inputsOf` (weights / CGs and where each comes from; mode
  rigid / estimate / none), `supports` (floats FL FR RL RR at (x_F, ±b), (−x_R, ±b); crawler tracks), `parts` / `resultant`,
  `floatDist`, `trackP` / `trackDist`, `rigidAt`, `boundAt` / `boundCandidates` / `restBox` (estimate), `matOf` / `bearing` (mats and
  bearing), `evaluate` (every 1° of the swing path, the max per support with its slew angle, bearing, mats, stress at depth, flags,
  worked steps), `stressAt` / `depthOf`, `U` (unit conversions).
- `shared/boussinesq.js` is loaded by the app (unchanged; reused, not copied — §3: no shared file changed, so no Spread Footing re-test
  is needed; its tools: `Spread Footing.html`, now also `apps/crane-pick/index.html`).
- `apps/crane-pick/ui/ground.js` (new): Ground input tab (per setup: mat / plate type, B, L, t, F_b', F_v', E or F_y, unit weight,
  spread k, allowable bearing pressure in psf or ksf; per buried utility / culvert / wall: an optional allowable stress increase),
  Ground output tab (per pick: method label, per float / track load, governing slew angle, R, q_g, q_g/q_a, mat M/M_a and V/V_a,
  stress at depth, flags, worked steps), the map (pressure-coloured float / mat / track areas in their own pane; float-load labels that
  follow every drag), Report §Ground (basis with sources, summary, per pick tables and steps).
- `ui/place.js` `evalPick0`: `ev.ground` and its flags appended (as C3's results). `ui/cranes.js`: crane-card inputs boom weight,
  boom CG fraction, counterweight (override), counterweight CG radius, gross operating weight (`app_inputs.ph4.boomLb, boomCgF, cwLb,
  cwRad, grossLb`); Report §Cranes lists them. `engine/model.js`: `setup.ground` (`normSetupGround`), project `ground.caps`
  (`normGround`). `index.html`: three scripts, CSS, footer v0.4.
- Tests: `tests/engine/crane-ground.test.mjs` (new), `tests/smoke/crane-ground.mjs` (new); `crane-shell.mjs`, `crane-picks.mjs` (output
  tabs now Plan · Picks · Ground · Site · Report), `crane-library.mjs` (input tabs end with Ground; the card heading text).
### Calculations (CLAUDE.md §4: new calculation; no existing formula changed)
Crane frame: x forward, y left, θ from the carrier front + clockwise, boom direction û = (cos θ, −sin θ).
- Weights: carrier W_c at (x_c, 0); upperworks W_u at x_u·û; counterweight W_cw (chart configuration, or entered) at −r_cw·û (r_cw
  entered, else the tail-swing radius, assumed); boom W_b at (e + f_b(R − e))·û (e = boom-foot offset, C3-1; f_b entered, else 0.5);
  hook W at R·û. V = ΣW, X = ΣWx/V, Y = ΣWy/V (M = V·(X, Y) about the rotation centre).
- Floats (rigid body, plane of loads; standard statics, cf. CIRIA C703 (2003) "Crane stability on site", paraphrase): u = (X − x̄)/a,
  v = Y/b, x̄ = (x_F − x_R)/2, a = (x_F + x_R)/2; |u| + |v| ≤ 1: P = V/4 (1 ± u ± v); > 1: heaviest V(|u| + |v|)/2, same end
  V(1 − |v|)/2, same side V(1 − |u|)/2, opposite 0; |u| or |v| > 1: not stable (red flag).
- Tracks: V_L,R = V(1/2 ± Y/g); e = X on both tracks; |e| ≤ L_t/6: q = V_t/(sL_t)(1 ± 6|e|/L_t); else L_b = 3(L_t/2 − |e|),
  q_max = 2V_t/(sL_b) (eccentric bearing statics).
- Estimate: V = G + W_cw + W, crane-without-load CG anywhere in the rest box, resultant in (W·h + Q·box)/V ∩ supports, each support's
  worst value over it (floats: box corners, crossings with |u| ± |v| = 1, (±1, 0), (0, ±1); tracks: largest |Y| toward the track and
  largest |X|).
- Mats: a = f√π/2; B_e = min(B, a + 2kt), L_e = min(L, a + 2kt); q = P/A_e; q_g = q + γt; c = max(B_e − a, L_e − a)/2; M = qc²/2,
  V = qc per ft; timber M_a = F_b't²/6, V_a = 2F_v't/3; steel M_a = F_y t²/(4 × 1.67) (AISC 360-16 F11.1, ASD), V_a = 0.60F_y t/1.50
  (J4.2(a)); δ = qc⁴/(8EI) (information). Crawler mats: B_e = min(B, s + 2kt), q = q_max s/B_e, c = (B_e − s)/2. No mat:
  q_g = P/(πf²/4). Bearing ratio q_g/q_a.
- Stress at depth: `SharedBoussinesq` uniformRect (Newmark corner superposition, FHWA GEC 6 (2002) §5.3.2, Fig. 5-11) per float over its
  bearing area (mat effective area, else the equal-area square), `stress` (linear / triangular) per track; summed; at the governing slew
  of each support, the pick and the set; points along the item every max(z/3, 0.5) ft within 5z + 20 ft and the closest point to each
  support. z = depth to top, else pad el. − top el.
- Units: psf = lb/ft², ksf × 1000 = psf, kip × 1000 = lb, in / 12 = ft, psi × 144 = psf, ksi × 144,000 = psf.
**Check cases** (fake cranes; `tests/engine/crane-ground.test.mjs`): A symmetric (W_c 40,000 @ 0, W_u 30,000 @ 0, W_cw 20,000 @ r 10,
W_b 6,000, e 2, f_b 0.5, W 22,000 @ R 30, θ 0): V 118,000, X 4.711864, u 0.392655 → front 41,083.33, rear 17,916.67 lb each.
B eccentric (x_c 1.5, x_u −2, θ 60°): X 2.610169, Y −3.640242, u 0.217514, v −0.303354 → FL 26,967.74, FR 44,865.60, RL 14,134.40,
RR 32,032.26. C three floats (B with W 60,000): V 156,000, u 0.469017, v −0.756847 → FR 95,617.40, FL 18,965.93, RR 41,416.67, RL 0.
D crawler (L_t 26, g 18, s 3): W 60,000 → V 490,000, X 1.632653 (kern), q_max 4,324.46 / q_min 1,957.59 psf; W 150,000 → X 7.586207,
L_b 16.241379, q_max 11,903.75 psf. E mats (P 44,865.60, float 2 ft): timber 4 × 4 × 12 in → A_e 14.231407, q_g 3,202.58 psf,
M 1,576.29 vs 28,800, V 3,152.58 vs 14,400; steel 1 in, F_y 36 → q_g 11,972.58, M 41.43 vs 5,389.22, V_a 172,800; no mat 14,281.16 psf.
F stress at depth under FL (A, z 3 ft, no mat): q 13,077.23 psf, m = n = 0.295409, I 0.036362 → 1,902.14 psf. Newmark I(1, 1) =
0.1752. Estimate at θ 0 (G 76,000): FL bound 107,000 lb (u = 1, v = 0.813559).
### Saved data (§5)
New fields only: `setup.ground`, project `ground` (`caps`), `app_inputs.ph4.boomLb / boomCgF / cwLb / cwRad / grossLb`; `crane.ui.grMap`
(map layer on / off, per browser, existing key). Absent in older projects = not entered; no migration, no new storage key.
### Decisions (pending engineer review)
- Engineer instruction 2026-11-16 (speed): one PR, lighter checks.
- Estimate rest box: outriggers — the float rectangle (necessary for the unloaded crane to stand); crawlers — 70 % of the half track
  length and half gauge (stated assumption; without a limit the bound is infinite). For heavy crawler lifts the estimate can still reach
  the track end: it is then reported as unbounded (red flag: enter the weights and CGs); in the random test ~25 % of crawler cases.
- The estimate puts the counterweight with the rest of the crane (anywhere in the rest box); a gross weight that already includes the
  counterweight is double-counted (conservative).
- Tracks: the same eccentricity e = X on both tracks (≥ the plane-of-pressure value on the heavier track); crawler centred on rotation.
- Float = round, size = diameter (as drawn); bearing on πf²/4; mats and Boussinesq use the equal-area square.
- Mat spread k : 1 (default 1 : 1) from the float / shoe edge, limited by the mat; crawler mats: across the track only; shear checked at
  the face; the mat is treated as a solid section (timber) / plate (steel).
- Counterweight CG radius not entered: the tail-swing radius; boom CG fraction not entered: 0.5.
- Stress at depth: at the governing slew angle of every support and at the pick and the set (not every degree); in the estimate the
  per-support bounds are summed (each support at its own worst; conservative) and each track takes the worst of e = −, 0, + max|X|.
- On-rubber charts: no tyre loads (not computed, said so).
### How verified
`node tests/engine/run.mjs crane` (61 tests incl. 13 new: hand checks A–F, statics, 8,000 random bound ≥ rigid cases, dense-grid check
of the bound candidates, brute-force swing sweep, track pressure plane integration, KaTeX of every step); `node tests/engine/run.mjs
boussinesq` (13, the shared file unchanged); `node tests/smoke/crane-ground.mjs` (5 checks: card inputs, estimate label, hand check A
in the Ground tab with a timber mat and q_a 4 ksf, Δσ_z at a water main, steps; map areas and labels changing mid-drag, one undo step;
Report §Ground; reload; 390 px; 0 console errors), `crane-shell` (11), `crane-library` (9), `crane-place` (9), `crane-picks` (5),
`crane-elev` (7), `crane-clear3d` (8), `crane-3d` (7), `crane-sheets` (8); `node tests/check-syntax.mjs`. `crane-draw.mjs` times out at
`#itKind` on origin/main as well (not changed here; reported).

## 2026-11-16 — C5: girder lifts (one crane or two in tandem): load share, the girder path, per-step checks, ground per crane
PR #1613: https://github.com/mlococo88/All-Structural/pull/1613
### Where
- `apps/crane-pick/engine/tandem.js` (new, `window.CranePickTandem`, no DOM): `object` (the girder; paired girders with cross-frames as one
  object), `share` (load share and hook loads), `at` / `outline` / `hooks` (plan geometry of a pose), `path` (the steps), `evaluate` (each
  crane at every step: radius, zone, chart capacity by the C2 lookup rule (`engine/lift.js` `evalAt`), % of chart, the tandem limit,
  heights / hook reach (`engine/elev.js`), the governing step per crane, 3D clearances (`engine/clear3d.js` shapes, the girder as a box),
  crane to crane, girder level, ground per crane), `where`.
- `apps/crane-pick/ui/tandem.js` (new, `window.CranePickTandemUI`): input tab "Girder lifts" (project tandem limit; lifts list; the card:
  crane slots with "Place for crane i", girder, paired girders, hooks / rigging, pick and set poses, travel elevation, waypoints; the live
  result: load share, governing steps, scrubber with Play, the step's table, an elevation of both cranes, crane–crane, Ground, flags with
  links to their steps, worked steps); the map (girder at the pick (blue) and the set (green) to scale, the centre's path, the girder at
  the scrubbed step with each crane's boom line and a live label R / C / % chart, G1 / G2 governing-step rings, red / amber 3D clearance
  markers; handles when selected: P / S move, ↻ turn, ◆ CG, H1 / H2 lifting points, W1… waypoints; one undo step per drag); the Picks tab
  section "Girder lifts" (one row per crane per lift); Report §"Tandem lifts" (basis, summary, per lift: inputs, flags, load share,
  path, the steps table (≤ 40 rows + the ends and the governing steps), an elevation at crane 1's governing step, the governing steps'
  worked values per crane, girder level, crane–crane, clearances, ground per crane, stress at depth from both cranes).
- `engine/ground.js` `evaluate(crane, setup, pick, P, idp, o)`: new optional `o = { W, pts }` (the hook load and the hook positions in
  place of `LF.total(pick)` and the pick's swing path; without `o` nothing changes: the C4 tests pass unchanged); the governing-step label
  says "over the girder lift's steps" then. New `depthPair` (stress at depth from two setups summed) and `toGrid`.
- `ui/ground.js`: `CranePickGroundUI` also exports `supTable`, `depthTable`, `stepsHtml`, `modeChip`, `inputsNote`, `BASIS` (reused).
- `ui/elev.js`: the dock under the map shows the selected girder lift (both cranes at its step) while the Girder lifts tab is open (or
  when there is no pick); 3D then centres on the lift. `ui/view3d.js`: the lift (girder box, both booms, load lines, blocks, the
  centre's path) via `CranePickTandemUI.draw3d`. `ui/picks.js`: appends the Girder lifts rows. `ui/project.js`: About text.
  `engine/model.js`: `tandems`, `normTandem`, `lift.tandem`. `index.html`: scripts, CSS, footer v0.5.
- Tests: `tests/engine/crane-tandem.test.mjs` (new), `tests/smoke/crane-tandem.mjs` (new), `tests/smoke/crane-place.mjs` (the saved
  `lift` settings now include `tandem: 75`).
### Calculations (CLAUDE.md §4: new; no existing formula changed)
- Combined object: W_g = W_1 + W_2 + W_xf; x_cg = (W_1 x_1 + W_2 x_2 + W_xf x_xf)/W_g; t_cg = (W_1 (t_c − s/2) + W_2 (t_c + s/2))/W_g
  (girder 1 at −s/2, girder 2 at +s/2, cross-frames on the axis). One girder: W_g = W, x_cg entered (else L/2), t_cg = t_c.
- Load share, hooks plumb (statics; moments about lifting point 2): R_1 = W_g (x_2 − x_cg)/(x_2 − x_1), R_2 = W_g − R_1; each hook
  W_i = R_i + W_rig,i + W_hook,i + W_other,i (the chart capacities are gross). CG outside the lifting points (R < 0) or x_1 = x_2: red.
  One crane: the hook plumb above the CG, W = W_g + W_rig + W_hook + W_other.
- Hook i in plan: p = c + (x_i − L/2) â + t_cg n̂, â = (sin h, cos h), n̂ = (cos h, −sin h) (h = heading of end A → B, azimuth).
- Path: hoist at the pick pose (girder bottom z_pick → z_tr, every 1 ft), travel through the waypoints (each leg: the centre linear in
  plan, the heading linear the shorter way, at z_tr), lower at the set (z_tr → z_set, every 1 ft); z_tr entered, else max(z_pick, z_set);
  z not entered = crane 1's pad. Each leg in n = ceil(max over the cranes of (hook travel / 1 ft, slew / 1°)) equal steps (measured on
  48 sub-steps of the leg), at most 2,000 (a warning says when coarser).
- At every step, each crane: R, θ, zone, C (C2 rule), %chart = W_i/C × 100; tandem: over at %chart ≥ the tandem limit (project input,
  default 75 %, separate from the single-crane thresholds); one crane: the lift thresholds (C2). z_hk = z_b + H + h_r, z_bk = z_hk + h_bk,
  z_tip (C3-1), m = z_tip − H_hd − z_bk (red < 0). Governing step per crane: the highest %chart (any not-permitted step governs).
- Clearances (C3-2 shapes): each crane's boom (foot pin → tip, less b_w/2), load line (girder top → tip), counterweight (tail-swing
  cylinder), and the girder as a box (plan rectangle L × B, a pair L × (s + B), z_b … z_b + H): d = √(d_plan² + Δz²); power lines
  (D_min, 29 CFR 1926.1408 Table A as C1-3), obstructions (contact red, < the obstruction clearance amber), exclusion zones (amber).
- Crane–crane: the least 3D distance between crane 1's boom / load line and crane 2's (segment–segment, Ericson §5.1.9), less the boom
  half-widths; contact red, < the obstruction clearance (2 ft) amber. Girder level: Δz_hk = h_r,1 − h_r,2 (information).
- Ground (C4 method): each crane with its own W_i at its own hook at every step (rigid body or estimate as C4). Stress at depth from both
  cranes: Δσ_z(p) = Δσ_z,1(p) + Δσ_z,2(p) (superposition), the two cranes at the same step, at the union of both setups' sample points,
  at the steps where any support of either crane governs and the first and last step; each crane's loads at its own depth below its pad.
**Check cases** (`tests/engine/crane-tandem.test.mjs`, fake crane only):
- Load share: L 100, W 100,000, hooks 10 / 90: CG 50 → 50,000 / 50,000; CG 45 → R_1 = 100,000 (90 − 45)/80 = 56,250, R_2 = 43,750;
  + rigging 2,000, block 1,500, other 500 / rigging 1,200, block 1,000 → W_1 60,250, W_2 45,950; CG 95 → R_1 = −6,250 (red).
  Paired: W_1 80,000, W_2 60,000 (CG 50), cross-frames 10,000 at 30, s 8 → W_g 150,000, x_cg = 7,300,000/150,000 = 48.6667,
  t_cg = (80,000(−4) + 60,000(4))/150,000 = −0.5333; R_1 = 150,000 (90 − 48.6667)/80 = 77,500, R_2 = 72,500.
- Tandem path (80 ft boom, pad 100, cranes at (1,000, 2,000) / (1,100, 2,000)): L 60, W 40,000, CG 28, hooks 10 / 50 → R_1 = 40,000 ×
  22/40 = 22,000, R_2 = 18,000; + 2,000 each → W 24,000 / 20,000. Pick (1,050, 1,980) el. 105, set (1,050, 2,000) el. 120, heading 90°:
  15 hoist steps; travel: hook travel 20 ft, slew atan(20/30) = 33.69° → n = 34 → 50 steps. Set: R 30.00, C(80, 30) = 37,000 → 64.86 % /
  54.05 %. Pick: R = √(30² + 20²) = 36.06 → C(80, 40) = 27,000 → 88.89 % (≥ 75 %: over) / 74.07 %. Step 32 (travel step 17): hook 1
  (1,030, 1,990), R = √1,000 = 31.62 → 27,000 → 88.89 %. Governing: both at step 0. Heights at the set (H 6, h_r 10, h_bk 4): z_hk 136,
  z_bk 140, θ 69° (chart) → z_tip = 108 + 80 sin 69° = 182.686, m = 42.69. Tandem limit 90 %: no capacity flag.
- Crane–crane: symmetric cranes, tips at one height, 40.00 ft apart at every step (segment–segment hand case 40.00); hooks 1 ft apart →
  1.00 ft < 2 ft amber; rigging heights 10 / 12 → girder level 2.00 ft (information).
- Girder box: pier 10 × 10 ft, top 112, under the pick: the girder at 105 … 111 → contact (red); picked at 120 → 8.00 ft.
- Ground per crane (C4 weights of hand check A): crane 1 at the set, θ 90°, R 30, W 24,000: V 120,000, Y = −616,000/120,000 = −5.1333,
  v = −0.4278 → FL = RL = 17,166.67, FR = RR = 42,833.33 lb.
- Stress at depth, two setups: cranes at (1,000, 2,000) and (1,030, 2,000), heading 0, hooks 30 ft ahead (W 22,000: front floats
  41,083.33 lb), a pipe along x = 1,015 at depth 3 ft: at (1,015, 2,012), own front float q = 13,077.23 psf × 2 [I(1.295409, 0.295409) −
  I(0.704591, 0.295409)] = 13,077.23 × 2 (0.083359 − 0.067889) = 404.63 psf, + the crane's other floats → 404.69 psf per crane;
  both: 809.38 psf (one setup alone, as C4: 404.69). With an allowable of 700 psf: OK for one crane, over for both.
### Saved data (§5)
New fields only: project `tandems: [ … ]` (`normTandem`; absent in older projects = []) and `lift.tandem` (default 75). No new storage key.
### Decisions (pending engineer review)
- Hooks plumb (no sling angle, no hook drift); the girder rigid and carried level; the girder's vertical CG is information only (it does
  not change the load share with plumb hooks; lifting stability is not checked here).
- Rigging per hook is one weight (slings, spreader / lifting beam, hardware together) plus the hook block and "other deductions"; the
  spreader length is drawn only.
- At the tandem limit counts as over (%chart ≥ limit). A one-crane girder lift uses the C2 thresholds.
- Path: centre linear in plan and heading linear (shorter way) between poses / waypoints; vertical hoist at the pick and lowering at the
  set; travel elevation = the higher of pick and set unless entered; girder elevations not entered = crane 1's pad; at most 2,000 steps
  per leg (warned).
- Governing step = the highest %chart (the first of equal steps). Crane–crane clearance = the project's obstruction clearance (2 ft).
- Ground: each crane at its hook positions at the lift's steps (in place of the C2 swing path); the both-cranes stress at depth at the
  steps where a support governs and the first / last step (not every step); each crane's depth from its own pad. The map's float labels
  and the Ground tab still show the C2 picks only; girder lifts show their ground in the card and in Report §Tandem lifts.
- The elevation is the vertical plane through the two cranes' centres (one crane: through it and its hook).
### How verified
`node tests/engine/run.mjs crane` (70 tests, 0 failed; 9 new in crane-tandem incl. KaTeX of every step); `node tests/engine/run.mjs
boussinesq` (13, shared file unchanged); `node tests/smoke/crane-tandem.mjs` (6 checks: the hand case typed in, card = engine, map
labels; CG and lifting-point drags change both cranes' labels mid-drag, one undo step each, redo; scrubber steps 49 and 32, Play, the
dock's elevation and 3D; ground per crane and the both-cranes sum; Picks rows, Report §Tandem lifts, reload, 390 px, 0 console errors),
`crane-place` (9), `crane-picks` (5), `crane-ground` (5), `crane-3d` (7), `crane-clear3d` (8), `crane-elev` (7), `crane-shell` (11);
`node tests/check-syntax.mjs`.
