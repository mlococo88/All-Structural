# Fix log — shared/dxf.js (window.SharedDxf)

One DXF R12 (AC1009) writer for the repo (docs/REBUILD_PLAN.md §3). Loaded by: `apps/steel-bridge/index.html` (engine:
`apps/steel-bridge/engine/drawings.js`). Tests: `node tests/engine/run.mjs drawings`.

Future users (not switched in this PR; each keeps its own copy until its next PR switches it, with that tool's tests):
- `BasePlateAnchorDesigner.html` `bpDxfWriter()` (DX-1, #436), the source of the file format here;
- `Gusset Plate Rating.html` `GPDXF.write`, from which Base Plate's writer was adapted;
- `Steel Bridge Design.html` (GirderDetail) `class DxfW` (its R12 export); its paper-space layouts use ezdxf in Pyodide and are replaced
  in the new app by this file;
- `Section Property Calculator.html`, `Bridge Geometry.html` (their DXF exports), as listed in REBUILD_PLAN §3.

## 2026-10-30 — PR: sbd2-drawings-3d — created (new file)
### Where
- `shared/dxf.js` (new), one namespace `window.SharedDxf`:
  - `drawing({ prefix })`: a display list with `layer`, `ltype` (CENTER / HIDDEN / DASHED / PHANTOM scaled to the drawing scale `D.k`),
    `line`, `pline`, `rect`, `circle`, `arc`, `text` (justification, rotation), linear dimensions `dim`, `dimH`, `dimV`, chained
    `chainH`, `chainV` (a run of equal spaces as one "n@s" dimension), `mark`, `bbox`, `move`, `toDXF()`.
  - `toSVG(D, { i0, i1 })`: the same entities as an SVG string (the app's previews are the file).
  - `str()` (text clean-up), `frac()`, `fmtIn()`, `fmtFtIn()`, `dimGeo()`, `parse()`, `validate()`, `download()`.
- Copied from (CLAUDE.md §3: the sources stay as they are):
  - `BasePlateAnchorDesigner.html`, anchor `function bpDxfWriter(){`: number format (`f8`: 6 decimals, trailing zeros removed, no "-0"),
    CRLF line ends, group codes right-aligned in 3 columns, HEADER ($ACADVER AC1009, $EXTMIN/$EXTMAX, $LTSCALE, $INSUNITS), LTYPE / LAYER /
    STYLE tables, LINE, POLYLINE … VERTEX … SEQEND, CIRCLE, TEXT, non-ASCII as `\U+XXXX`.
  - `Steel Bridge Design.html`, anchor `class DxfW {`: TEXT justification (72, 11/21/31) and rotation (50), scaled linetypes
    (`ltype`: pattern × k × 0.4), DIMENSION entities with an anonymous block `*Dn` holding their geometry (`_dimGeo`: extension lines,
    dimension line, 45° ticks, text) and a DIMSTYLE per scale, `_runs` (chained dimensions), `bbox`, `move`; anchors `function dxfStr(s)`,
    `function dxfFI(inch)`, `const dxfIn =` (text clean-up, feet-inches and inches to 1/8 in).
- New here: ARC (10/20/30, 40, 50, 51); `parse()` and `validate()` (structure checks: SECTION/ENDSEC pairs, HEADER first, $ACADVER
  AC1009, ENTITIES present, 0 EOF last, integer group codes in pairs, POLYLINE closed by SEQEND, every layer, linetype, dimension style and
  dimension block defined); `toSVG()`; `download()` (Blob + a[download], which works from file:// in Chrome, Edge and Firefox).
### Decisions
- File format details from Base Plate (CRLF, padded group codes) rather than GirderDetail's DxfW (LF, unpadded): both are valid R12; Base
  Plate's is the newer proven export (DX-1) and the one this file should replace first.
- `frac()` rounds to 1/16 by default (GirderDetail's `frac`, used for plate sizes such as 9/16); `fmtIn()` and `fmtFtIn()` round to 1/8 in
  (GirderDetail `dxfIn`, `dxfFI`, used for dimensions).
- A dimension's text is written as its override (group 1) in full, the same text as its block, so a viewer that does not regenerate dimensions
  shows the same value as one that does.
### Governing provision
- None (drawing output; no engineering value).
### Check case
- Sample drawing (tests/engine/drawings.test.mjs): one LINE, a closed POLYLINE on CENTER_12, a CIRCLE r 5, an ARC 30° to 120°, a TEXT
  "TOP FL. 16 × 3/4, 15°, ℄ BRG., Ø7/8, é" (centered, rotated 30°) → "TOP FL. 16 x 3/4, 15%%d, CL BRG., %%c7/8, \U+00E9", dimensions 100 in →
  `8'-4"`, a chain 0/25/50/75/100 → one `4@2'-1"`, 20 in → `D = 1'-8"`. CENTER_12 pattern 1.25, −0.25, 0.25, −0.25 × 0.4 × 12 = 6, −1.2, 1.2, −1.2.
- `frac(0.5625)` = 9/16; `fmtIn(0.5625)` = 5/8" (4.5 eighths rounds to 5); `fmtFtIn(148.5)` = 12'-4 1/2".
### How verified
- `node tests/engine/run.mjs drawings`: structure, values read back, broken files rejected; ezdxf 1.4.4 (Python, in this container) opens the
  sample and the Steel Bridge drawings (7 files) as AC1009 with no audit error and the same entity counts.
- Browser: the Steel Bridge Drawings tab downloads the file (Download DXF) from file://; validate() passes on the downloaded file.
### Other copies
- None yet (new file). The writers it was copied from are unchanged: `BasePlateAnchorDesigner.html` (bpDxfWriter), `Gusset Plate Rating.html`
  (GPDXF), `Steel Bridge Design.html` (DxfW).
### Open items
- Switch Base Plate, Gusset, Section Properties and Bridge Geometry to this file, one tool per PR, with their own DXF tests.
- Paper-space layouts (border, title block, viewports at a plot scale), which GirderDetail writes with ezdxf in Pyodide, are not in R12 from
  this writer; the drawings are model space at full size with the plot scale stated in each title.

## 2026-10-30 — PR: sb2-dwg-panzoom — SharedDxf.viewer: pan and zoom of the SVG preview (engineer's request)
No drawing, file or engineering value changes: a browser helper for the preview of toSVG().
### Where
- `shared/dxf.js`, new `viewer(host, svg, opt)` (anchor `function viewer(host, svg, opt) {`), exported as `SharedDxf.viewer`.
- The navigation changes the SVG `viewBox` only, so text and lines stay vector and sharp at any zoom.
  - Mouse wheel: zoom about the cursor (exp(−0.0015·deltaY) per event). `preventDefault` on the drawing, so the page does not scroll; at fit the wheel zooms in.
  - Drag: pan with the left or middle button, or one finger.
  - Two fingers: pinch zoom and pan about their midpoint.
  - Double-click or double-tap (two taps within 300 ms): fit.
  - On-canvas buttons: + (×1.5), − (÷1.5), Fit.
- Zoom range 0.5 to 64 × fit. `opt.onchange(level)` lets a page sync its own zoom control.
### Check case
- Smoke test: the FS1 sheet.
  - Four wheel steps zoom to over 200 %; the page does not scroll; the drawing point under the cursor stays put.
  - Dragging changes the viewBox. + multiplies the zoom by exactly 1.5. The drop-down set to 200 % gives a zoom of 2.
  - Double-click restores the original viewBox and the drop-down reads "Fit".
### How verified
- `tests/smoke/steel-bridge-drawings.mjs` (headless Chromium) checks the wheel, the drag, the + button, the drop-down and double-click fit.
- Pinch and double-tap are not driven by the headless test; they use the same zoom and pan functions as the wheel and the drag.
### Other copies
- None.

## 2026-10-31 — PR: sbd-stiffener-tab — SOLID entity (solid fills)
- `drawing()`: new `D.solid(l, pts)` (3 or 4 corners in polygon order); `write()`: DXF R12 `SOLID` with corners 1, 2, 4, 3 (a triangle repeats its third corner); `toSVG()`: solids drawn first, translucent (`opt.fill`, default 0.4), so lines and text stay on top. No change to existing entities or output of drawings without solids. Verified: `validate()` passes on every Shear & stiffeners graphic (tabgraphics-b test). Reason: the engineer found ratio hatching confusing.

## 2026-11-03 — PR: claude/dxf-print-sheets (PR #749: https://github.com/mlococo88/All-Structural/pull/749) — print the sheets to 11 × 17 pages at their plot scale (sheetSVG, printSheets; engineer's request)
No drawing, file or engineering value changes: a browser print path for the sheet previews, and an option of `toSVG()`.
### Where
- `toSVG(D, opt)`: new `opt.frame = [x0, y0, x1, y1]`: the viewBox is exactly that rectangle (pad ignored).
  - Before: `const pad = opt.pad != null ? opt.pad : 0.02 * Math.max(b[2] - b[0], b[3] - b[1]), x0 = b[0] - pad, y1 = b[3] + pad, W = b[2] - b[0] + 2 * pad, H = b[3] - b[1] + 2 * pad;`
  - After: `const pad = …, F = opt.frame;` then `const x0 = F ? F[0] : b[0] - pad, y1 = F ? F[3] : b[3] + pad, W = F ? F[2] - F[0] : b[2] - b[0] + 2 * pad, H = F ? F[3] - F[1] : b[3] - b[1] + 2 * pad;`
  - Without `frame` the output is the same string as before (600 random drawings × 3 option sets compared with origin/main's file: 0 different).
- New `sheetSVG(D, s, opt)`: `toSVG` of the sheet's entities `s.i0..s.i1` with `frame: [s.ox, 0, s.ox + s.W, s.H]` (the sheet's outer border;
  every tool draws its sheets side by side from x = ox, y = 0), `bg: '#fff'`, `title`.
- New `printSheets(items, opt)` (anchor `function printSheets(items, opt) {`), items = SVG strings or `{ svg, title }`, `opt.paper` = [w, h] in
  (default [17, 11]):
  - adds `<div id="sdx-print">` (one `.sdx-sheet` per item, each SVG set to width 17in, height 11in) at the end of body, the class
    `sdx-printing` on body and `<style id="sdx-print-css">` with `@page sdxsheet { size: 17in 11in !important; margin: 0 !important; every margin box content: none !important }`
    and, under `@media print` only, rules that hide every other child of body and give each sheet `page: sdxsheet`, 17 × 11 in, a page break after;
  - calls `window.print()`; on `afterprint` (and, where print() does not block, on the next click / key / focus after 0.5 s) removes the
    box, the style and the class. On `beforeprint` it moves its style last in the head.
  - A proportion check: a sheet whose viewBox is not 17:11 (±0.2 %) is printed to fit and a console warning says it is not at its scale.
- New `PRINT_NOTE`: the UI note (Tabloid / 11 × 17, Landscape, Margins None, Scale 100 %) for the tools to show next to the buttons.
### Decisions
- One page per sheet; the sheet's outer border is the page edge (the SVG viewBox is the border, the page has no margin), so a B-size sheet
  drawn at plot scale k prints at 1:k exactly: 1 in on paper = k in full size.
- Named page with `!important`, and the style moved last at beforeprint: headless Chromium 153 let a later unnamed `@page` (the Report's
  `#rp-page` letter page with its running header, added by a tool's beforeprint handler) override an earlier named page, which printed the
  sheets on letter paper with the Report's header. With `!important` the named page wins in either order (checked both).
- The tools' own beforeprint / afterprint handlers still run (a capture listener on window does not run before the earlier non-capture ones
  in Chromium for window-targeted events, so they cannot be stopped reliably). The print rules outrank shared/report.js's
  `body.rp-printing>*:not(#rp-print)` (`html body.sdx-printing>div#sdx-print#sdx-print`), so a tool preparing its Report print cannot take
  the pages over; its afterprint restores its own state as after any print.
- No library added. Nothing is stored.
### Governing provision
- None (drawing output; no engineering value).
### Check case
- Spread Footing default project, FOOTING PLAN at 1/2" = 1'-0" (k = 24): footing 10 × 8 ft = 120 × 96 in → 5 × 4 in = 360 × 288 pt on the
  PDF. Measured (pdftocairo -svg of the printed page): 360.00 × 288.00 pt. Page 1224 × 792 pt; the outer border at (0, 0)-(1224, 792) pt.
- `tests/engine/drawings.test.mjs` "sheetSVG / toSVG frame": a 17 × 11 sheet at k = 24 at x offset 500 → viewBox `0 0 408 264` even with a
  text past the border; a 120 × 96 rectangle → points `100,214 220,214 220,118 100,118`.
### How verified
- `node tests/smoke/dxf-print-sheets.mjs` (new): per tool, Print sheet → 1 page 17 × 11 in, border on the page edge, the known dimension
  to scale; Print all sheets → one 17 × 11 page per sheet; the print box removed afterwards; then the page's own print (no button) is the
  Report on letter pages without any sheet; 0 console errors. The PDFs were looked at.
- Tests of every tool that loads shared/dxf.js (CLAUDE.md §3): Spread Footing, Light Pole and Sign Post, apps/steel-bridge — see the PR.
### Other copies
- None.

## 2026-11-03 — PR: claude/dxf-sheet-inset (PR #754: https://github.com/mlococo88/All-Structural/pull/754) — the sheets' outer border 0.25 in inside the paper edge (SHEET_INSET, sheetBorder; engineer's decision)
No engineering value changes. The drawing geometry and the plot scales are unchanged; only the outer border line of each sheet moves.
### Where
- New `SHEET_INSET = 0.25` and `sheetBorder(D, l, ox, W, H, k)` (anchor `function sheetBorder(D, l, ox, W, H, k) {`):
  `D.rect(l, ox + 0.25 k, 0.25 k, ox + W - 0.25 k, H - 0.25 k)`.
- Used by the three tools that draw sheets, in place of their outer-border rect (before `rect(ox, 0, ox + W, H)`):
  `Spread Footing.html` (SFPS-2), `Light Pole and Sign Post.html` (LPPS-2), `apps/steel-bridge/engine/sheets.js` (SBPS-1),
  `Bridge Geometry.html` (BGDW-2) and `Section Property Calculator.html` (SPDW-2) (their Drawings tabs, #752 and #753).
- `sheetSVG` and `printSheets` are unchanged: the printed page is still the whole W × H sheet, so the sheet keeps its scale, and the outer
  border now prints 0.25 in (18 pt) inside the page edge.
### Decisions
- The engineer asked for the inset in print and in the DXF sheet. The border is moved in the DXF as well (one entity per sheet), so the file and
  the print match. The inner border, title block and drawing area are where they were.
- Steel Bridge D sheets (34 × 22) get the same 0.25 in on the full-size sheet. A half-size print of a D sheet on 11 × 17 puts it 0.125 in
  inside the page edge (the half-size print is the next PR; noted there).
### Governing provision
- None (drawing output).
### Check case
- Spread Footing FOOTING PLAN at k = 24: outer border before (0, 0)-(408, 264) model in, after (6, 6)-(402, 258); printed (18, 18)-(1206, 774) pt
  on the 1224 × 792 pt page; the 10 × 8 ft footing still measures 360 × 288 pt.
- Display lists origin/main vs branch (default projects): Spread Footing 502 entities, 7 sheets; Light Pole 276, 5; Steel Bridge 4014, 15, paper D
  and paper B; Bridge Geometry 1300, 9; Section Property Calculator (welded plate girder) 273, 2. Sheet scales and offsets identical; exactly one entity per sheet differs, the outer border, moved 0.25 k inward on every side.
### How verified
- See the PR (tests of every tool that loads this file).
### Other copies
- None.
