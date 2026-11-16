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

## 2026-11-16 — C6: the trucking route (path, vehicle, kinematic swept path, overhead clearances, axle loads, haul road, posted bridges, staging)
PR #1614: https://github.com/mlococo88/All-Structural/pull/1614
### Where
- `apps/crane-pick/engine/route.js` (new, `window.CranePickRoute`, no DOM): the route's path (tangents + curves), the vehicle and load
  inputs with defaults, the kinematic simulation, the closed-form steady state, turns, site conflicts, overhead / power-line travel
  clearances, axle loads, haul-road tyre bearing, posted bridges, staging (C2 pick or C5 girder lift), the swept outlines for drawing.
- `apps/crane-pick/ui/route.js` (new, `window.CranePickRouteUI`): the Route input tab (draw tools: Route, Overhead clearance point / line,
  Haul road / mats, Posted bridge; the selected route's inputs and live card; the selected mark's inputs; the list), the map layers (the
  drawn line, the path with its curves, the swept path (union of the outlines every 2 ft, non-zero fill), the load's corner traces, the
  vehicle at the chosen position (default the stop), turn labels "T1 r 50 · OT 16.5 ft", flag markers), vertex handles (drag: the
  route is re-simulated once per animation frame at 1 ft steps and redrawn with the live card; one undo step at the end; "+" adds a
  vertex, a double-click removes one), the Route output tab (before Site) and Report §Route (figure, vehicle, flags, turns table and
  worked steps, conflicts, overhead table and steps, axle-load table and steps, haul road, posted bridges, staging).
- `engine/osha.js`: `travel()` — 29 CFR 1926.1411 Table T (new; Table A unchanged). `engine/model.js`: `normRoute`, `normRouteMark`,
  `routes: []`, `routeMarks: []` in the project. `index.html`: the two scripts, CSS (route labels; drawing-tool clicks pass through the
  route lines), the comment and the footer (v0.6).
- `tests/smoke/crane-draw.mjs` (first, separate fix): the smoke timed out waiting for `#itKind` on main (broken since C3-2, not C4).
  **Cause:** the test clicks fixed pixel offsets in the map up to y = 680 px (the utility line's second point at y = 650, the utility
  area at y = 680); C3-2 added the elevation dock under the map (67 px), so at the 860 px viewport the map is only 631 px tall: the
  clicks landed on the dock, the utility line got one point, was never finished, and `#itKind` never appeared. The app was right; the
  test now uses a 960 px viewport (map 731 px). Before / after: `vh: 860` → `vh: 960`. All 7 checks pass.
### Calculations (CLAUDE.md §4: new calculation; no existing formula changed; Decisions pending engineer review)
1. Path: the drawn points are the steer-axle centre's path. At each interior vertex a circular curve of radius r (per vertex, else the
   route default, 50 ft): Δ = atan2(û_in × û_out, û_in · û_out) (+ left), T = r tan(|Δ|/2); T limited to the available tangent (half of a
   segment between two curves, the whole of an end segment): r = T_avail / tan(|Δ|/2) (flagged warn).
2. Kinematic off-tracking (low speed, no tyre slip; standard tractor-semitrailer kinematics: SAE J695 "Turning Ability and Off Tracking
   — Motor Vehicles"; NCHRP Report 505 (2003) "Review of Truck Characteristics as Factors in Roadway Design", ch. 3; AASHTO Green Book,
   7th Ed. 2018, §2.1.4 design-vehicle turning paths; paraphrased): every unit's rear axle-group centre moves along the unit's axis
   (a steered axle along the axis turned by δ): dθ/ds = (v_H · n̂_δ) / (L cos δ); tractor: H = the steer axle on the path, δ = 0;
   kingpin e ahead of the drive-group centre; optional jeep (kingpin → jeep axle Lj, bolster ej ahead); body (trailer or the load itself)
   from the kingpin / bolster to the rear axle group or dolly pivot (L2). Rear dolly (types "steerable rear dolly", "jeep + dolly"):
   δ = −k γ, γ = articulation between the unit ahead and the body, |δ| ≤ δ_max (Decision: a proportional steering law with an effective
   ratio k standing for hydraulic / steerman steering; enter the dolly maker's ratio). RK4 every 0.25 ft (1 ft while dragging); the
   vehicle starts straight on the first tangent. Steady state (closed form): R_T² = R² − L1², R_K² = R_T² + e², (jeep R_J² = R_K² − Lj²,
   R_H² = R_J² + ej²), R_D² = R_H² − L2², OT = R − R_D; steered: o_x = −L2 − o_y tan δ, o_x² + o_y² = R_H², R_D = o_y / cos δ, δ = −k γ
   by iteration.
3. Swept path: outlines of the tractor (front overhang to rear overhang, width), jeep, trailer deck (or the rear dolly) and the load
   (front f = L − L2 − r ahead of the hitch, rear overhang r behind the rear group, width) every 1 ft. Per turn (curve start to one
   vehicle length past its end): OT_max (rear group / dolly pivot from the path), R_in (least distance from the curve centre to an outline
   in the curve's sector), R_out (largest, corners in the sector: the load's swing-out shows here), swept width R_out − R_in; r < R_min
   (the vehicle's minimum turning radius, input) → stop.
4. Conflicts: an outline meeting an obstruction, an exclusion zone or a crane footprint (C2 plan footprint) → stop; within a power line's
   Table A plan buffer → warn (the vertical check governs); over a buried utility → info (wheel loads on it not computed).
5. Overhead: H_top = h_deck + h_load. Marks reached by an outline: c = h − H_top < margin (default 1 ft) warn, < 0 stop, height not
   entered stop. Power lines: d_h = least plan distance outline → wire less the sway allowance; d_v = max(0, h_wire − sag − H_top);
   d = √(d_h² + d_v²); 29 CFR 1926.1411 Table T: up to 0.75 kV 4 ft; over 0.75 to 50 kV 6 ft; over 50 to 345 kV 10 ft; over 345 to 750
   kV 16 ft; over 750 to 1,000 kV 20 ft; over 1,000 kV as set by the utility owner/operator or an RPE (paraphrased; the value after "to"
   in its row); d < D_T stop; d < 20 ft warn: a dedicated spotter (1926.1411(b)(4)). Voltage not known: 20 ft. Source check: the
   official pages (ecfr.gov, osha.gov, govinfo.gov) could not be opened from this session (proxy); the values were confirmed in search
   results limited to ecfr.gov, osha.gov, govinfo.gov (CFR 2023 ed., title 29 vol. 8, § 1926.1411) and federalregister.gov (75 FR 47906,
   Aug. 9, 2010), as C1 did for Table A. **Engineer to confirm against the current eCFR text.**
6. Axle loads (statics, or entered): R_b = (W_tl x_tl + W_L x_L)/L2 (dolly types: W_L x_L / L2, the dolly tare W_d added at the pivot);
   R_H = W_tl + W_L − R_b; jeep: R_J = (R_H (Lj − ej) + W_j Lj)/Lj, R_K = R_H + W_j − R_J; tractor: R_drive = (W_tr x_t + R_K (L1 − e))/L1,
   R_steer = W_tr + R_K − R_drive; x_L = c_L − f. Per axle = group / n; per tyre = group / (n × tyres). An uplift is flagged.
7. Haul road (marks; a corridor of width w): the heaviest tyre through C4's `bearing()` (tyre area A as the equal-area round float
   f = √(4A/π), so a = √A; mat spread k : 1, mat weight, mat bending / shear); q_g vs q_a.
8. Posted bridges (marks; on the route when the steer-axle path is within w/2): gross (tons of 2,000 lb) vs the gross posting and the
   vehicle-type posting; the heaviest single axle vs the axle posting.
9. Staging: C5 girder lift linked: the girder's mid-length point c = H + (f − L/2) û and end-A→B heading at the stop vs the lift's pick
   pose (offset ≤ tolerance, 2 ft default; heading within 2°), and the C5 evaluation's first step (both cranes at the pick pose: % of
   chart; worked in the Girder lifts tab) — "Move the girder lift's pick pose to the girder on the truck" sets it. C2 pick linked: the
   load CG vs the pick point and the crane's chart at that radius (`evalAt`); "Move the pick point to the load". Turnaround: information
   (the tractor's outer front corner radius at R_min).
### Check cases (`tests/engine/crane-route.test.mjs`, hand-computed)
- Steady state: semi L1 20, e +1, L2 40, R 60: R_T = √3,200 = 56.5685, R_K = 56.5774, R_D = √1,601 = 40.0125, OT = 19.9875 ft; semi L1 15,
  e −1, L2 50: R_D = √876 = 29.5973, OT = 30.4027; jeep (18, 1, 12, 0.5, 90) at R 150: R_D = √13,933.25 = 118.0392, OT = 31.9608. The
  simulation on a circular path (72-gon whose curves form the circle, 3 laps) reaches these within 0.002 ft. Steered dolly (L2 100,
  k 0.5, R 150): simulation = fixed-point closed form (R_D 135.7758, δ −13.4887°); steering reduces OT by more than 5 ft.
- Axle loads, semi: tractor 20,000 lb at 8 ft, L1 20, e 1; trailer 15,000 lb at 25 ft, L2 40; load 50 ft, 40,000 lb, r 2: f = 8,
  x_L = 17; R_rear = 1,055,000/40 = 26,375; R_K = 28,625; R_drive = 703,875/20 = 35,193.75; R_steer = 13,431.25; gross 75,000.
  Jeep + dolly (jeep 8,000 lb, Lj 10, ej 0.5; dolly 12,000 lb; L2 90; load 100 ft, 80,000 lb, r 5): R_rear 52,000, R_J 46,000,
  R_drive 9,900, R_steer 12,100, gross 120,000.
- Overhead: load top 11.00; h 14.5 → c 3.50 OK; 11.5 → 0.50 warn; 10 → stop. Power line crossed, wire 20 ft, sag 1: d = 8.00: 13.8 kV
  (6 ft) spotter warn; 115 kV (10 ft) stop. A line 15 ft beside the route, wire 12 ft: d = √(10.75² + 1) = 10.7964 (warn, spotter).
- Posting: 37.50 t vs 40 OK, 36 stop; heaviest axle 8.7984 t vs 10 OK, 8 stop. Haul road: heaviest tyre 6,715.625 lb on 100 in² →
  9,670.50 psf vs 10,000 (0.967). Staging: straight route ending at x 300: load CG at x 264; C5 lift pose at 275, 270° → 11.00 ft, 0°.
- Curve fit: 90° between two 100 ft end segments, r 150 asked → r 100 (flagged).
### Saved data (§5)
New project fields only: `routes: [ … ]`, `routeMarks: [ … ]` (`normRoute`, `normRouteMark`; absent in older projects = []). No new
storage key.
### Decisions (pending engineer review)
- The drawn route is the steer-axle centre path; curves are circular arcs of the entered radius (no spirals; no automatic road routing);
  the vehicle approaches straight along the first tangent.
- Load inputs: length, weight, width, CG from the front, height above the deck and the rear overhang (behind the rear group / dolly
  pivot); the front position follows (f = L − L2 − r). With a C5 girder lift linked, L, W, width (pair: s + B), depth and CG come from
  its girder object; "end A toward the tractor / to the rear" chooses which way it rides.
- Rear dolly: proportional steering δ = −k γ with a limit δ_max (default 45°); the dolly's axles are lumped at its pivot.
- The tractor, jeep and dolly are assumed lower than the load top (the load top governs overhead).
- Overhead margin default 1 ft; staging tolerance default 2 ft and 2°.
- 29 CFR 1926.1411 Table T is applied to the haul vehicle and its load as instructed (2026-11-16); the section is written for cranes /
  derricks travelling without a load. Unknown voltage: 20 ft.
- Haul road: tyres one at a time (overlapping spread under adjacent tyres not combined); tyre area default 100 in².
- Defaults when not entered (shown as placeholders): tractor L1 20, e 1, front overhang 4, rear 3, width 8.5 ft; L2 40, width 8.5; deck
  3 / 4 ft ahead / behind; jeep 10 / 0; dolly 12 ft long; R_min 45 ft; deck height 5 ft; tractor 20,000 lb at 8 ft; trailer 15,000 lb at
  25 ft; jeep 8,000 lb; dolly 12,000 lb; axles 1 / 2 / 2 / 3, tyres 2 / 4 / 4 / 4; load 50 ft, 40,000 lb, 8 ft wide, r 2, 6 ft high.
### How verified
`node tests/engine/run.mjs crane-route` (9 tests incl. KaTeX of every step); `node tests/engine/run.mjs crane` (all crane tests);
`node tests/smoke/crane-route.mjs` (5 checks: route drawn by clicks, live card = engine; an obstruction in turn 1 → stop, the vertex drag
changes the swept path and the card mid-drag and clears it, one undo step; overhead line, posted bridge, power line (Table T, spotter);
Route tab tables and the turn link; C5 link and "move the pick pose"; Report §Route; reload; 390 px; 0 console errors);
`crane-draw` (7, fixed), `crane-shell` (11) and `crane-picks` (5) (their output-tab lists now include Route), `crane-tandem` (6), `crane-ground` (5), `crane-place` (9); `node tests/check-syntax.mjs`.

## 2026-11-16 — C7: lift-plan drawings (DXF), Summary tab, multi-lift summary, Report polish
PR #1615: https://github.com/mlococo88/All-Structural/pull/1615
### Where
- `apps/crane-pick/ui/drawset.js` (new, `window.CranePickDrawSet`, no DOM, Node-tested): `summary(P, ctx)` (one row per lift: single picks,
  girder lifts per crane, trucking routes), `notesModel(P, ctx)` (the general notes = Report §2 Basis), `build(P, ctx, opt)` (the drawing set
  as one `shared/dxf.js` display list): cover and sheet index (lift summary table, trucking routes, revisions), general notes, a lift plan
  per single pick (plan to scale: site items clipped to the view, plan-sheet outlines, power-line D_min buffers, the crane footprint,
  outrigger beams, floats, mats, tail swing, boom at the pick / set / governing point, swing path, P / S / G, 3D clearance flags F1…,
  north arrow, scale bar, State Plane grid ticks; elevations at the pick and the set to the same scale with the site items the section
  crosses; the lift data table, flags, notes, "REPORT SEC. x.y"), a lift plan per girder lift (both cranes, the girder at the pick and set
  poses, the path, waypoints, each crane's boom and hook at its governing step; the elevation at each crane's governing step) and its
  rigging / load-share sheet (girder, CG, lifting points, R1 / R2 and the hook loads, dimensions from end A, the engine's load-share
  steps as text, the rigging table), the ground sheet (one plan panel per setup with floats / tracks, mats and the largest loads; tables
  of float / track loads and bearing, the mat specification and allowable, stress at depth incl. both cranes summed), a route sheet per
  trucking route (C6: path, swept outlines, marks, the vehicle at the stop, turn labels outside the curves, the load CG; tables of turns,
  axle loads, overhead clearances, posted bridges; flags). The sheet frame and block-sheet code is an adapted COPY of
  `apps/ps-bridge/ui/sheets.js` (itself from the steel app; to move to `shared/` later, CLAUDE.md §3). `addSheets(fn)` for later modules.
- `apps/crane-pick/ui/drawings.js` (new): Drawings output tab (Paper D / B, sheet, preview zoom, Download DXF (validated first), Print sheet /
  Print all sheets (11 × 17; D half size), the sheet index with links to the input / output tabs and the Report §).
- `apps/crane-pick/ui/summary.js` (new): Summary output tab (every lift per crane and every route; links: map, worked, Report, drawing).
- `apps/crane-pick/report/builders.js`: §1 "Summary" (was "Project": title block, statement, the lift table with § links (and routes),
  notes); §2 "Basis" (the general notes, § links); the added sections ordered Site, Plan sheets, Site items, Cranes, Lifts, Tandem lifts,
  Ground, Route, Elevations, 3D view (`ORDER`); figures numbered "Figure n."; § links of §1 / §2 only to sections present; running
  header "Crane Pick Analyzer — LIFT-PLANNING AID" + "The crane manufacturer's charts, the lift plan and the site checks govern" on every
  printed page. Section ids / keys unchanged.
- `apps/crane-pick/ui/ground.js`: the Report note "Lift results: §Lifts (see the pick)" is now a § link to the pick.
- `apps/crane-pick/ui/route.js` (C6, coordinator's list): Report figure: swept outlines every max(2 ft, L / 150) (a long route's figure
  stays small; caption says the spacing); turn labels on the outside of each curve; a note after the staging steps with the § link to
  the girder lift (§Tandem lifts) or the pick it serves.
- `apps/crane-pick/index.html`: loads `shared/dxf.js` (unchanged) and the three scripts; notes; footer v0.7.
- Tests: `tests/engine/crane-dwg.test.mjs` (new), `tests/smoke/crane-drawings.mjs` (new); `crane-shell.mjs`, `crane-picks.mjs` (output tabs
  now Plan · Summary · Picks · Ground · Route · Site · Drawings · Report); `crane-library.mjs` (input tabs: + Girder lifts, Route — it
  failed on main since C5).
### Calculations
None (CLAUDE.md §4): every number on the sheets, in the Summary tab and in Report §1 / §2 is an engine value (engine/lift.js, elev.js,
clear3d.js, ground.js, tandem.js, route.js through the page's evalPick / evalT / evalRoute), formatted. New display rules (not
calculations): "closest clearance" = the power line / obstruction (known height) with the smallest margin over its requirement (as the
Picks tab's "Closest 3D"); "max float / track load" = the largest load on any float or track of the lift (tandem: either crane);
"bearing ratio" = the largest q_g / q_a; route "least overhead clearance" = the smallest of c (overhead) and d − D_T (power line).
**Check cases** (`tests/engine/crane-dwg.test.mjs`, fake crane): lift plan: P R 30.00 ft, C 39,000 lb, 56.4 %; S R 20.00 ft, 58,000 lb,
37.9 %; W 22,000 lb. Ground: front float 41.08 kip (C4 case A, hook 30 ft over the front at the pick; less on the swing to the set),
4 × 4 × 12 in timber mat: q_g = 41,083.33 / 14.231407 + 50 = 2,936.80 → "2,937" psf, ratio 0.73 (q_a 4,000). Tandem: R1 22,000,
R2 18,000, W1 24,000, W2 20,000 lb, governing step 0: R 36.06, C 27,000, 88.9 % / 74.1 %. Route: gross 20,000 + 15,000 + 40,000 =
75,000 lb (37.50 t). Each value found as text on its sheet; every sheet inside its border at a listed scale; DXF `SharedDxf.validate` OK.
### Saved data (§5)
No new key; `crane.ui` gains `dwg: { paper, sheet, z }` (per browser view state). Project format unchanged.
### Shared files
`shared/dxf.js`, `shared/report.js` loaded unchanged (no shared file changed).
### Decisions (pending engineer review)
- The drawing set is display only and is regenerated from the project every time (no stored drawing data); paper D default, B option;
  each sheet at the smallest standard scale at which it fits (lift / tandem plans from 1/4" = 1'-0", rigging from 1/2" = 1'-0").
- Lift plan layout: plan and elevations in one row at one scale, the data table, flags and notes below; elevations at the pick and the
  set (single pick) and at each crane's governing step (girder lift).
- Ground sheet: one panel per setup (not one site plan) so floats stay legible; the largest load per float / track over all the lifts of
  that setup (single picks and girder lifts).
- Report § references on the sheets as "REPORT SEC. x.y" (the § sign is not plain ASCII for DXF R12 text).
- The sheet-frame / block-sheet code is a third copy (ps-bridge, steel); moving it to `shared/` is planned work, not done here.
- Route tools on the Plan's Draw bar (coordinator's list): not added (the bar is rebuilt by ui/draw.js; a cross-module change better
  done on its own); the route tools stay on the Route tab.
- Engineer instruction 2026-11-16 (speed): one PR, lighter checks.
### How verified
`node tests/engine/run.mjs crane` (all crane engine tests incl. 6 new); `node tests/smoke/crane-drawings.mjs` (5 checks: Summary tab =
engine (56.4 %, 41.08 kip, 0.73; 88.9 % / 74.1 %; route 75,000 lb), its links; Drawings: 7 sheets render, index links, Download DXF valid,
Print all = 7 pages, Print sheet = 1, paper B; Report order, §1 / §2, figure numbers, staging link, no unresolved keys / NaN; 390 px;
0 console errors); `crane-shell` (11), `crane-picks` (5), `crane-ground` (5), `crane-tandem` (6), `crane-route` (5), `crane-place` (9),
`crane-clear3d` (8), `crane-elev` (7), `crane-3d` (7), `crane-sheets` (8), `crane-library` (9); `node tests/check-syntax.mjs`.

## 2026-11-16 — C8: preliminary terrain from USGS 3DEP (levelness, blocking, ground elevations, pad grading, route grades, contours)
PR: (link added after the PR is opened, same PR)
Engineer decision 2026-11-16: USGS 3DEP online ONLY for now (no survey import, no clicked spot elevations). Every terrain value is labelled
"preliminary terrain (USGS 3DEP, ~1–3 m)"; the Terrain tab and Report §Terrain state that it is not adequate to certify crane levelness
or grades — survey data governs.
### Where
- `apps/crane-pick/engine/terrain.js` (new, `window.CranePickTerrain`, no DOM): the request body and the answer parsers (getSamples, EPQS),
  the grid (`gridSpec`, `nodes`, `makeGrid`), `at` (bilinear), `grad`, `cellSlope`, `bilStep` (worked), `level` (levelness, blocking,
  badge), `padGrade` (cut / fill), `profile` (route grades, crests / sags, long-load ground clearance), `contours` (marching squares).
- `apps/crane-pick/ui/terrain.js` (new, `window.CranePickTerrainUI`): Terrain input tab (area: map view / site extent; grid spacing
  3.28 (≈ 1 m native) / 5 (default) / 10 / 20 ft; "Fetch terrain for this site"; source, fetch date, grid, native resolution, datum,
  cache state; "Use terrain for ground elevations"; contours (interval) and slope colours; per setup: level tolerance, blocking limit,
  levelling datum, grading pad; per route: maximum grade, grade base, load / deck underside height, clearance margin), Terrain output tab
  (before Site: levelness table, slopes, badge, blocking, pad cut / fill, route profile chart, segment grades, crests / sags, clearance,
  worked steps), the map (contours and slope cells on a canvas pane under the overlays; a level badge per crane that follows every drag;
  the ground elevation in the cursor coordinates box), Report §Terrain (after §Route by the C7 order rule).
- Changed existing code (each before → after):
  - `engine/elev.js` `padEl` / `el0`: before `const padEl = u => isNum(u && u.pad) ? u.pad : 0;` and
    `const el0 = k => Object.assign({ pg: null, … H: null }, k && k.elev || {});`; after: a terrain provider (`setTerrain(p)`, set by
    ui/terrain.js only while "use terrain" is on and a grid is loaded): `padEl(u)` = the entered pad, else the provider's pad (the
    levelling datum under the crane), else 0; `el0(k)` fills `pg` / `sg` from the provider's ground at the pick / set point when not
    entered and records `E.from` ('entered' | 'terrain'). The step notes say "USGS 3DEP preliminary terrain" where used. With the
    provider off (the default; every project saved before C8) the values are unchanged (tested: `EL.padEl({ pad: null })` = 0).
  - `engine/ground.js` `depthOf`: before `const pad = isNum(setup.pad) ? setup.pad : 0, z = pad - it.topEl;`; after: with the pad not
    entered and the provider on, `pad` = the lowest ground under the supports (the smallest depth: conservative), the note says so.
  - `ui/map.js` `showCoord`: appends `CranePickMap.coordExtra(ll)` (the terrain elevation) when set.
  - `ui/place.js` `evalPick0`: `ev.level = CranePickTerrainUI.levelOf(u)` and its flags appended (as C3 / C4).
  - `ui/picks.js`: Picks table column "Level (terrain)" (after Hook reach min; a link to the Terrain tab) and Report §Lifts summary column
    "Level / blocking (terrain)". `ui/summary.js` (C7): Summary column "Level (terrain)" per crane row and routes column "Max grade · ground
    clearance (terrain)".
  - `engine/model.js`: `terrain` (`normTerrain`), `setup.lvl` (`normLvl`), `route.grade` (`normGrade`), KEYS.terrainDb.
  - `index.html`: two scripts, CSS (badges, contour labels), comment, footer v0.8.
- Tests: `tests/engine/crane-terrain.test.mjs` (new), `tests/smoke/crane-terrain.mjs` (new); `crane-shell` / `crane-picks` (output tabs
  include Terrain), `crane-library` (input tabs include Terrain), `crane-clear3d` (the Picks column index of "Closest 3D" 17 → 18).
### Data (USGS) — endpoint and verification
- Used: USGS The National Map 3DEP Elevation ImageServer, `getSamples` (ArcGIS REST "Get Samples"), POST
  `https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples`, form body `geometry={"points":[[lon,lat],…],
  "spatialReference":{"wkid":4326}}&geometryType=esriGeometryMultipoint&returnFirstValueOnly=true&interpolation=RSP_BilinearInterpolation&f=json`
  (a CORS "simple" request: no preflight); answer `samples[{ location, locationId, value (string, metres), rasterId, resolution }]`, read
  by `locationId` (by order if absent); "NoData" → no data; `{ error }` → the message shown. 400 points per request (the service's
  documented default limit is about 1,000), 3 requests at a time, 45 s timeout, at most 10,000 points per fetch (the spacing grows by
  ×1.25 until it fits, and the app says so). Fallback for ≤ 60 points when getSamples fails: EPQS `https://epqs.nationalmap.gov/v1/json?
  x=<lon>&y=<lat>&wkid=4326&units=Feet&includeDate=false` (`value`, feet).
- NOT verified live: elevation.nationalmap.gov, epqs.nationalmap.gov and developers.arcgis.com were blocked from the build container
  (proxy 403 / not resolvable). The parameters and the answer format were taken from Esri's ArcGIS REST API "Get Samples" reference as
  found by web search (its mirrors on several agency servers) and the USGS service path; the EPQS v1 parameters from general knowledge
  (not confirmed). The parsers are tested against mocked answers in that format. **Engineer to try "Fetch terrain" once from the work
  laptop and the GitHub Pages copy** (CORS from `file://` sends `Origin: null`; ArcGIS servers normally answer `Access-Control-Allow-
  Origin: *`, not confirmed for this one). Offline / blocked → the message "Could not reach the USGS 3DEP elevation service …
  everything else in the app still works".
- Units and datum: 3DEP values are metres above NAVD 88 (CONUS); converted to US survey feet, 1 m = 3937/1200 ftUS = 3.280833 ftUS (the
  plan coordinates' unit; 2 ppm from the international foot, 0.0004 ft at 200 ft). With "use terrain" on, the pad / pick / set
  elevations not entered are NAVD 88 ftUS (said on the Terrain tab and in the Report).
- Cache: IndexedDB `crane.terrain.v1`, store `grid` (new; the 12 latest fetches kept); the project keeps only `terrain.src` (id, fetch
  date, service, grid geometry, counts, range, zone).
### Calculations (CLAUDE.md §4: new calculation; no existing formula changed — the elev / ground changes above only supply ground
elevations when the user turns terrain on; Decisions pending engineer review)
1. Grid: nodes on the multiples of the spacing s in the site frame (State Plane grid ftUS) covering the area; elevation anywhere by
   bilinear interpolation: t = (x − x_i)/s, u = (y − y_j)/s, z = (1 − t)(1 − u)z00 + t(1 − u)z10 + (1 − t)u z01 + t u z11 (null outside the
   grid or with a no-data corner).
2. Levelness (crane frame from C4 `supports()`): floats FL, FR, RL, RR at (x_F, ±b), (−x_R, ±b); crawler track ends (±L_t/2, ±g/2).
   s_L = 100[(z_front pair mean) − (z_rear pair mean)]/(x_F + x_R) (crawler L_t); s_T = 100[(z_left mean) − (z_right mean)]/(2b);
   s_max = √(s_L² + s_T²) — the steepest slope of the least-squares plane through the four points (for a rectangle the LS gradient is
   exactly these pair means); twist w = (z_FL + z_RR − z_FR − z_RL)/4 (information). Blocking b_i = z_datum − z_i, z_datum = the highest
   support (or an entered datum). Badge: green s_max ≤ tolerance; amber above it (or a datum below a support: cut); red when a blocking
   exceeds the blocking limit or terrain is missing under a support.
3. Use terrain: crane pad z_pad = z_datum (cribbing at the highest support not added); pick / set ground = z at the point; stress at depth
   z = lowest support ground − top el.
4. Pad grading (grid method): pad B × W on the carrier axis centred on the rotation centre (default: float rectangle + float + 4 ft;
   crawler L_t + 4 by g + s + 4); cells ≤ s and ≤ min(B, W)/10; z_i = bilinear at each cell centre; V_fill = Σ a max(z_pad − z_i, 0),
   V_cut = Σ a max(z_i − z_pad, 0); z_pad default = the mean ground (cut ≈ fill); cy = ft³/27; bank volumes, no shrink / swell, no slopes.
5. Route profile: the C6 steer-axle path every min(2, s/2) ft (≥ 0.5 ft); z(s) bilinear; grade g(s) = 100[z(s + ℓ_g/2) − z(s − ℓ_g/2)]/ℓ_g
   (ℓ_g default 20 ft, clipped at the ends); per path segment (tangent / curve) the steepest |g| vs the maximum grade (default 8 %);
   crests / sags at grade breaks A = g(s + ℓ_g/2) − g(s − ℓ_g/2), |A| ≥ 2 % (crest A < 0, sag A > 0), each run reported at its largest |A|.
6. Long-load ground clearance (rigid load / deck): stations behind the steer axle along the path: hitch H = L1 − e (+ Lj − ej with a
   jeep), rear support R = H + L2; underside line through z(s_R) + h_u and z(s_H) + h_u, extended over the front overhang f = L − L2 − r
   and the rear overhang r; c = line − z at every station from the rear tip to the front tip, for every vehicle position (the whole
   vehicle on the route), min reported with where (between the supports = crest; overhang = sag); c < 0 stop, c < margin (0.5 ft) warn.
   h_u default: deck height (dolly / jeep: the load spans the bolsters) or deck height − 1 ft (semi / stretch: deck structure, assumed).
   Off-tracking and suspension travel not included; the tractor and jeep not checked.
7. Map: contours by marching squares (saddles by the cell mean), every 5th interval heavier and labelled; slope cells coloured
   < 1 / 1–2 / 2–5 / 5–10 / ≥ 10 %.
### Check cases (`tests/engine/crane-terrain.test.mjs`, hand-computed)
- A: plane z = 100 + 0.02x − 0.01y reproduced exactly; a 2 ft bump on a node: 102.00 at the node, 101.00 half way, 100.50 at a cell centre.
- B: floats x_F 10, x_R 8, b 9, heading 0, z = 100 + 0.02x + 0.03y: FL 100.12, FR 100.48, RL 99.58, RR 99.94; s_L = 100(100.30 − 99.76)/18
  = 3.000 %; s_T = 100(99.85 − 100.21)/18 = −2.000 %; s_max = √13 = 3.6056 %; blocking FL 0.36, FR 0, RL 0.90, RR 0.54 ft; tolerance 1 %
  → amber; limit 0.5 ft → red (10.8 in); datum 100.00 → FR −0.48 (cut). Rotated crane: s_max √13 again. Crawler L_t 20, g 16, heading 90:
  s_L 2 %, s_T 3 %.
- C: z = 100 + 0.02x, pad 40 × 20 along x at el. 100: fill = cut = W s B²/8 = 20 × 0.02 × 1,600/8 = 80 ft³ (2.963 cy); el. 101: fill 800,
  cut 0; not entered: mean 100.00.
- D: route (0,0)→(300,0), semi L1 20, e 1, L2 40, load 50 ft, r 2 (f 8), deck 5 → h_u 4. Crest z = 107.5 − 0.05|x − 150|: max grade 5 %,
  crest at 150, c(a) = 4 − 0.1a + 0.0025a² → 3.00 ft at a = 20 (between the supports). Sag z = 100 + 0.05|x − 150|: sag at 150, front
  overhang c = 3.2 + 0.1a → 3.20 ft (rear overhang 3.8 + 0.1a). Max grade 4 % → flagged; margin 3.5 → warn; h_u 0.5 → stop.
- Mocked answers: by locationId, "NoData", order fallback, `{ error }` text, EPQS value; 30.48 m = 99.9998 ftUS; the request body.
### Saved data (§5)
New: project `terrain` (`normTerrain`: use, spacing, ext, contour, src), `setup.lvl`, `route.grade` (absent before C8 = defaults / null:
no migration); IndexedDB `crane.terrain.v1` (new database, prefixed); `crane.ui.trC` / `trS` (map layers, existing per-browser key).
No existing key or format changed.
### Decisions (pending engineer review)
- getSamples batches (no raster decoder library); 400 points per request, 10,000 per fetch; EPQS only for ≤ 60 points.
- Elevations in US survey feet (3937/1200 per metre), as the plan coordinates.
- Levelness from the four support points' plane (not the terrain inside the footprint); the level tolerance default 1 % ("enter the crane
  manual's requirement"); blocking limit default 24 in (assumed); datum default the highest support.
- With terrain on, z_pad = the levelling datum (the highest support ground; cribbing there not added); stress-at-depth z from the lowest
  support ground (conservative).
- Grading pad default size and elevation as above; route maximum grade default 8 %, grade base 20 ft, crest / sag break 2 %, clearance
  margin 0.5 ft, h_u defaults as above; the profile follows the steer-axle path (off-tracking ignored).
- Fetching turns "use terrain" on (the tab says so; it can be turned off); an entered pad / pick / set elevation always overrides.
### How verified
`node tests/engine/run.mjs crane` (all crane engine tests incl. 9 new: A–D, grid spec, contours, mocked answers, the elevation provider,
KaTeX of every step); `node tests/smoke/crane-terrain.mjs` (7 checks: offline message with the app still working; mocked getSamples →
grid = the made-up surface, contours and slope overlay drawn, cursor elevation; the level badge green on the flat and amber mid-drag onto a
5 % slope, Terrain tab = engine, pad = datum with "use terrain"; route profile chart, 5 % grade, sag at the grade break; Report §Terrain
statement, Picks and Summary columns; reload restores the grid from IndexedDB; 390 px; 0 console errors (the browser's own "Failed to load
resource" lines of the deliberate offline fetch excluded)); `crane-shell` (11), `crane-picks` (5), `crane-library` (9; its input-tab list
had failed on main since C5 — fixed by C7, Terrain added), `crane-drawings` (5), `crane-clear3d` (8), `crane-place` (9), `crane-ground` (5),
`crane-elev` (7), `crane-route` (5), `crane-tandem` (6); `node tests/check-syntax.mjs`.
