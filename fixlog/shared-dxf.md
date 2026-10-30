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
