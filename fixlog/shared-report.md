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

## 2026-11-01 — PR: claude/rpt-timber — narrow screens: the document column no longer widens the page
- `CSS` (anchor `@media (max-width:1000px){.rp-body{`): `grid-template-columns:1fr` → `grid-template-columns:minmax(0,1fr)`.
  Before, the single grid column took the min-content width of its widest table, so on a phone (390 px) the whole report was wider than the screen and its right part was cut off; now the column is the screen width and a wide table scrolls inside its own box (`.rp-tw`, as on desktop).
- Display only; backward compatible (same markup, wide screens unchanged). Users: `apps/steel-bridge/index.html`, `Spread Footing.html`, `Timber Beam Check.html`.
- Verified: `node tests/engine/run.mjs report steps steps-groups report-wiring` 14 passed; Timber Beam Check Report tab at 390 px (screenshot).

## 2026-11-01 — PR: claude/rpt-cbc — optional chapter headings (`section.part`) for a report that joins several tabs (additive; models without it render as before)
### Where
- `shared/report.js`: header comment (model: `sections: [ { id, title, note?, part?, subs } ]`); `build()` (`sec.part = { title, id: 'rp-p<n>' }`); `html()` (an `<h1 class="rp-part">` before that section); `titleBlock()` (contents: a `li.rp-tp` line); `text()` (the chapter title in capitals); `mount()` (nav tree: an `a.rp-l0` entry); CSS `.rp-toc a.rp-l0`, `.rp-part`, `.rp-ptoc li.rp-tp`, print `.rp-part{break-before:page}` and `.rp-part+.rp-sec{break-before:auto}`.
### Why
- Engineer decision (2026-11-01): Concrete Beam Capacity.html has ONE combined Report tab with a chapter per embedded tab (Beam Capacity, ASD Beam Calcs, Development & Splice). The viewer had two heading levels (section, subsection); a chapter level above the numbered sections was missing. Section numbers run on through the chapters.
### Backward compatibility
- Only a section with `part` gets the new markup; every other path is unchanged (same HTML, text, nav, CSS rules for existing classes). `node tests/engine/run.mjs report steps steps-groups report-wiring` passes (Steel Bridge and Spread Footing report tests).
### Loaded by
- unchanged list, plus `Concrete Beam Capacity.html` (suite shell, combined Report tab) and its Development & Splice tab (the ACI Rebar app's Report tab).
## 2026-11-01 — PR: claude/rpt-stonearch — item topics and lazy tables (backward compatible)
- **Why:** the Stone Masonry Arch Load Rating Report tab maps the tool's own panels to the viewer; a panel's topics (its headings) hold tables and notes as well as worked steps, and the influence-coefficient and nodal tables are long.
- **`topic` on any item** (anchor `if (it.topic) { it._tp = 'rp-tp'`): `{ title, ref?, no?, chip?, cls?, res? }`. `build()` gives it an anchor (`rp-tp<n>`) and a nav entry under the subsection ("no. title"); `itemHtml()` puts the same sub-heading as a steps item's topic (`topHtml`, numbered `no`) before the item; `text()` prints a topic line; the topic title is scanned for references. `itemHtml` is split into `itemHtml` (topic) + `itemBody` (unchanged item HTML).
- **`lazy` on a table item** (anchor `if (it.type === 'table' && it.lazy)`): shown as a closed `<details class="rp-lz">` (summary: `title` or caption and the row count), rendered when opened, filled by `fillLazy` for print and by `jump`; the three lazy fill sites call `lazyBody(doc, it)` (steps or table). The table HTML moved unchanged into `tableHtml()`.
- Items without `topic` and tables without `lazy` render exactly as before.
- **How verified:** `node tests/engine/run.mjs report steps steps-groups report-wiring` (Steel Bridge and Spread Footing report tests): 4 files, 14 passed, 0 failed. Stone Arch Report tab in headless Chromium (topics, lazy tables, print with every lazy table filled).

## 2026-11-01 — PR: claude/rpt-gusset — options for the Gusset Plate Rating report (backward compatible)
- **Why:** the shared viewer is to reproduce the Gusset Plate Rating report (the viewer it was modelled on); these are the parts it lacked.
- `subs[].ref` (anchor `rp-sref`): a reference shown right of the subsection heading (screen and print; `text()` adds " [ref]").
- `sections[].key`, `subs[].key` (anchor `if (q.key) {`): put in the anchor index like a step key, so `[[key]]` prints "§n" / "§n.m" and `jump(key)` opens the heading; a repeated key is listed in `doc.dup`.
- `refs: [[label, text], …]` (anchor `rp-refs`): a References table in the front matter, after the cover and before the contents; `text()` prints it.
- `head.center` (top-centre running-header box) and `head.lines: true` (a '\n' in left / center / right is a new line, CSS `\A`; the top margin grows from 0.85 in to 0.95 in for two lines). Without `head.lines` a line break still prints as a space, as before (the Steel Bridge heads contain '\n' and are unchanged).
- Models that use none of these render exactly as before.
- **How verified:** `node tests/engine/run.mjs report steps steps-groups report-wiring` (Steel Bridge and Spread Footing report tests) passes; Gusset side-by-side comparison in headless Chromium (PR).
## 2026-11-01 — PR: claude/rpt-baseplate — `opt.spy` (scroll-spy) and `api.go(anchorId)` for the Base Plate migration (additive)
### Where
- `shared/report.js`: header comment of `mount`; `mount()`: when `opt.spy` is set, a passive scroll listener on the scrolling column that holds the viewer (else the window) marks the nav entry of the last heading above the reading area `.on` (the existing `.rp-toc a.on` style) and scrolls the tree to keep it in view; the returned API gains `go(anchorId)` (the existing internal `go`: opens collapsed parents, scrolls, flashes).
### Why
- BasePlateAnchorDesigner.html's RPT-3 Report tab had scroll-spy and "§ in report" jumps to a card (a subsection anchor, not a step key); the migration to the shared viewer must keep them (rollout item 9).
### Backward compatibility
- Without `opt.spy` nothing is added; `go` is a new property of the returned object. `node tests/engine/run.mjs report steps steps-groups report-wiring` passes.

## 2026-11-01 — PR: claude/shared-report-print-links — in-app tab links print as plain text (no more gaps in printed sentences)
- **Where:** `CSS`, `@media print` block (anchor `.rp-bar,.rp-toc`).
- **Before:**
  ```
    .rp-bar,.rp-toc,.rp-go{display:none!important;}
  ```
- **After:**
  ```
    .rp-bar,.rp-toc{display:none!important;}
    .rp-go{font-family:inherit;font-size:inherit;color:#000;text-decoration:none;white-space:normal;}
  ```
- **Why:** a `[[tab:name|label]]` link (`a.rp-go`) was hidden in print, so a sentence that names a tab printed with a hole ("On screen: .", "on the  tab", "( , , )"). It now prints its label in the surrounding text's font, black, not underlined; `text()` already printed the label. Screen display unchanged.
- Display only; no calculation, saved-data or markup change. Notes that are only a link (Retaining Wall Designer `onTab`: "On screen: Stability tab · …") now print that line instead of an empty note.
- **Check:** on any tool, Report tab → Print report: e.g. Moving Load Generator, Inputs: "… travel: both directions. On screen: ." → "… On screen: Vehicle Configuration."
- **Verified:** `node tests/engine/run.mjs report steps steps-groups report-wiring` 14 passed; printed-text check (headless Chromium, print media, "Print report") on 16 tools: links hidden in print 400 → 0; empty-gap fragments 61 → 20, the 20 left being the same in both (KaTeX math lines split by innerText in Base Plate and Concrete Beam Capacity, "axleLs()" in Stone Arch prose), i.e. link gaps 41 → 0.

## 2026-11-01 — PR: claude/shared-report-eq-wrap — on-screen equations: wrapped lines no longer overlap, tall fractions no longer clipped
- **Where:** `CSS` (anchor: the line before `#rp-print{display:none;}`).
- **Before:** (no rule) — `.rp-step .rp-m{grid-area:m;padding-left:0.25in;overflow-x:auto;}` only.
- **After:** added
  ```
  @media screen{.rp-step .rp-m{padding-top:2pt;padding-bottom:2pt;} .rp-step .rp-m .katex .base{margin:2pt 0;}}
  ```
- **Why:** `overflow-x:auto` on the equation box makes its vertical overflow scroll too, so the part of a tall fraction above the box top (or below its bottom) was cut off; and a KaTeX line that wraps (inline mode breaks between `.base` boxes) sat its next line close enough that a fraction numerator ran into the line above. The vertical margin on each `.base` (an inline-block) makes each line box taller, so wrapped lines clear each other; the padding keeps the fraction ink inside the scroll box. Screen only (`@media screen`): print already sets `overflow:visible` and is unchanged.
- Display only; no calculation, saved-data or markup change.
- **Check:** Steel Bridge Report at 390 px, "G2: deck slab (DC1)": before, the numerator of 8.50/12 on the wrapped line touches "w_deck =" above; after, clear.
- **Verified:** `node tests/engine/run.mjs report steps steps-groups report-wiring` 14 passed; headless Chromium, every step of the Steel Bridge, Spread Footing, Prestressed, Stone Arch and abutment reports at 1280 and 390 px: equation boxes whose content extends past the box 3,037 → 6 (none visible: Prestressed 2 per width by ≤1.4 px; Stone Arch 1 per width, the stiffness matrix, whose rendering is the same before and after), wrapped lines overlapping the line above 639 → 22 (Steel Bridge at 390, glyph boxes within 2.2 px, no visible ink overlap), equations overlapping the step label 1,401 → 0.
