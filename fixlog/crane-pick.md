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
PR: link below once opened.
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
