# Fix log — shared/report.js (window.SharedReport)

Loaded by: `apps/steel-bridge/index.html` (Report tab, `ui/report.js`). Tests: `node tests/engine/run.mjs report` (Node) and
`node tests/smoke/steel-bridge-report.mjs` (browser smoke and print emulation).

## 2026-10-30 — PR: sb2-report — created (new file): the shared calculation-report viewer
### Where
- New `shared/report.js` (`window.SharedReport`), planned in `docs/REBUILD_PLAN.md` §3 and §6 Phase 2 ("one viewer, not 17 copies of the
  Gusset pattern"). Look and behaviour follow `Gusset Plate Rating.html` (Report tab: `.crv-*` bar, chips, nav tree `.crv-toc`, calc sheet
  `.crv-doc`, title block `crTitleBlock()`, collapsible `cr-h1` / `cr-h2row`, `crPageCSS()` running header) and `BasePlateAnchorDesigner.html`
  (RPT-2/3 `buildPrintReport(target)`); the code is new, with no app-specific code.
- API: `build(model)` (numbering §n / §n.m, anchor index), `html(doc, { lazy })`, `text(doc)`, `mount(host, model, opt)` (bar with the
  app's controls, search, Expand all, Collapse all, Print report; nav tree; document), `print(doc)`, `ref(doc, key)`, `keyOf`, `css()`.
  The report model (sections → subsections → items: worked steps, table, SVG figure, note, key–value list) is documented in the file header.
- Anchors: the SharedSteps step ids. Key = `scope/stepId` (scope per location, '' for a list that appears once); the first occurrence of a
  key is its derivation. Text `[[key]]` and a cell's `key` render as an in-app link "§x.y" (print: "see §x.y"); `[[tab:name|text]]` is an
  in-app link to the app's tab (`opt.onGoto`). A step note's "§<step id>" (engine/shear.js "See §pan.Vn.", engine/stiffeners.js, engine/rating.js
  "see §fx.Mn") is resolved to a link: in `item.see` (another scope, e.g. the rating's capacity location) or in the item's own scope, an id
  relative to the engine's work prefix included (`v.Vn` → `pn.v.Vn`).
- Steps render through SharedSteps: the equation (`line()` without the value) and the result column (`line()` of the value and unit), so
  KaTeX is used when the page has it and the built-in renderer otherwise. Notation in titles, notes and table cells (`$…$`) is set by
  SharedSteps' built-in renderer (cached), not KaTeX: a report of every station has thousands of cells and KaTeX there made the page
  ~15 MB and ~30 s to show (measured in Chromium); with it, ~1.5 s after the calculation.
- Lazy step lists (`item.lazy`): a `<details>` filled when opened (or by a link into it); print fills every one.
- Print: `print(doc)` puts the whole report alone on the page (`#rp-print`, `body.rp-printing`), every section open, every lazy list filled,
  a printed contents list, each section on a new page, and `@page` margin boxes: project / girder top left, computed / checked by and date top
  right, title bottom left, "Page n of N" bottom right (Chromium-based browsers print margin boxes; others print without). Ctrl+P while the
  viewer shows also fills the lazy lists and sets the running header (`beforeprint`).
- Search: hides the subsections (and sections, and their nav entries) whose text does not contain every word typed.
- `content-visibility: auto` on subsections (screen only) keeps a long report responsive.
### Problem
- New shared file (Report tabs: one viewer for every app).
### Governing provision
- None (no engineering formula; display only). CLAUDE.md §6 "show the work and link to it".
### Check case
- `tests/engine/report.test.mjs`, hand-made model: sections 1 (1.1) and 2 (2.1, 2.2); `ref('s1/a.x')` = §2.1, `ref('q/b.z')` = §2.2; the note
  "Length [[s1/a.x]], ratio $r_{1}$ [[q/b.z]]" prints "Length §2.1, ratio r_1 §2.2"; the step note "See §x." of `a.y` prints "See §2.1."
  (relative id); "y: see §a.y." with `see: 's1'` prints "§2.1"; an unknown key prints "§?" and is listed in `doc.unresolved`; a repeated step
  is listed in `doc.dup`.
### How verified
- Node: `node tests/engine/run.mjs report` (the viewer and the full Steel Bridge report: every reference resolves).
- Browser: `node tests/smoke/steel-bridge-report.mjs`: 0 console errors, 0 `.katex-error`, a § link jumps to its step, collapse / expand,
  search, every-station lazy lists, print emulation (app hidden, nav and bar hidden, every step visible, running header, `page.pdf()`).
### Other copies
- None. The Gusset Plate Rating and Base Plate reports keep their own code until each moves to this viewer (one small PR per app).
### Open items
- None.

## 2026-10-31 — PR: sbd-stiffener-tab — topics in a steps item (presentation spec A)
- Steps item `topics: [{ title, ref, n, cls, chip, res }]` (n steps each, in step order): `stepsHtml` puts a sub-heading (`.rp-top`) before each topic's first step; `text()` a topic line; `build()` adds nav entries (`rp-l3` item, `rp-l4` topics) for items that are not lazy. Anchors and keys unchanged; items without topics render as before. Verified by `tests/engine/steps-groups.test.mjs` (no unresolved reference, one heading per topic).

## 2026-10-31 — PR: sbd-grouping-rest — no doubled "see" in step notes
- `noteOf` (anchor `a note that already says "See §x"`): when the text before a `§id` in a step note ends in "see" (engine notes: "See §p1.Vn.", "…see §fx.Mn"), the link gets class `rp-see rp-seen`; CSS `.rp-seen::before{content:none}` drops the "see " that `.rp-see` prints in front of every cross-reference (print). Before: "See see §3.2"; after: "See §3.2". Notes that do not say "see" are unchanged ("see §3.2" from the CSS). Text output unchanged. Verified by `tests/engine/steps-groups-tabs.test.mjs`.
