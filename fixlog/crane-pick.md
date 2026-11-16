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
PR: (this PR, link added after merge)
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
