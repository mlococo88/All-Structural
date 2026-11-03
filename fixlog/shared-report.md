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

## 2026-11-02 — PR: claude/phone-print-asce7 — print: a topic heading is not split from its one-line result (PHN; display only)

- **Problem:** printed, a topic heading (`.rp-top`: number, title, reference and the one-line result `.rp-tsum` inside it) could be split across a page: ASCE 7-16 Load Generator, Report, page 7 ended with "4. Seismic response coefficient and base shear", and its result line "Seismic base shear … V = 123.74 kip" and the steps were on page 8. `.rp-top` already has `break-after:avoid`, but nothing stopped a break inside it.
- **Where:** `CSS` string, `@media print` block, anchor `.rp-h1,.rp-h2,.rp-h3,.rp-cap{break-after:avoid;}`.
- **Added (one line after the anchor):**
  ```css
  .rp-top{break-inside:avoid;}   /* PHN (2026-11-02): a topic heading and its one-line result stay together … */
  ```
- Print only. The screen is unchanged, and so is any report without topics (`.rp-top` appears only with `topics` / `topic`). Backward compatible: no API, model or markup change.
- **Check case:** ASCE 7-16 Load Generator, default project, Report → Print report: before, the heading of topic 4 sits at the foot of page 7 and its result on page 8; after, page 8 starts with the whole heading (9 pages both).
- **Consumers (CLAUDE.md §3):** ACI Rebar Development Length, ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Substructure Loading, Concrete Beam Capacity, Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Pile Designer, Prestressed Bridge Design, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design - AISC 15th, Stone Masonry Arch Load Rating, Timber Beam Check, abutment_calculator, elastomeric_design_module, index, lldf (all .html) and apps/steel-bridge (index.html, ui/report.js, report/builders.js).
- **Verified:** `node tests/engine/run.mjs report steps steps-groups report-wiring`: 4 files, 14 passed, 0 failed.

## 2026-11-02 — PR: claude/phone-shared-report — phone: long tab links wrap; a step's result goes under its equation (PHN; display only)

- **Problem (390 px wide, Report tab of any tool):**
  - `.rp-go` (an in-app tab link such as "On screen: Lateral (p-y) tab, …") has `white-space:nowrap`. A long link ran 416–510 px wide and was cut off; seen in Pile Designer and Retaining Wall Designer. The viewer's subsections use content-visibility, which clips.
  - A step's result (`.rp-step .rp-r`, `white-space:nowrap`) sits in an auto-width column beside the equation. A long text result squeezed the equation, and the result was cut off. Example: ACI Rebar Development Length, "Class A eligibility: cannot be verified (A_s,req / A_s,prov not entered): Class B assumed", 388 px wide.
- **Where:** `CSS` string, after the rule with anchor `@media (max-width:1000px){.rp-body{grid-template-columns:minmax(0,1fr);} .rp-toc{…} .rp-doc{padding:14px;}}`.
- **Added:**
  ```css
  @media screen and (max-width:600px){.rp-go{white-space:normal;} .rp-step{grid-template-columns:minmax(0,1fr);grid-template-areas:"d" "m" "r" "n";} .rp-step .rp-r{white-space:normal;padding-left:0.25in;}}
  ```
- Screen and ≤ 600 px only. Desktop, tablet (768 px) and print are unchanged. No API, model or markup change.
- **Check case:** ACI Rebar Development Length at 390 px, Report, "Class A eligibility":
  - Before: the label column is squeezed to "Class / A / eligibility", and the result is cut off at "…not entere".
  - After: the label is on one line, and the result wraps underneath it in full.
  - Pile Designer at 390 px, Report: the two "On screen: …" links were cut off; now they wrap.
- **Consumers (CLAUDE.md §3):** ACI Rebar Development Length, ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Substructure Loading, Concrete Beam Capacity, Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Pile Designer, Prestressed Bridge Design, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design - AISC 15th, Stone Masonry Arch Load Rating, Timber Beam Check, abutment_calculator, elastomeric_design_module, index, lldf (all .html) and apps/steel-bridge (index.html, ui/report.js, report/builders.js).
- **Verified:** `node tests/engine/run.mjs report steps steps-groups report-wiring`: 4 files, 14 passed, 0 failed. Headless at 390 px: Pile Designer, ACI Rebar and Retaining Wall Designer Report tabs show no cut-off links or results. Because of the 600 px media query, wider screens and print cannot change.

## 2026-11-02 — PR: claude/shared-report-pagebreaks (PR #668: https://github.com/mlococo88/All-Structural/pull/668) — print: a section no longer forces a new page; it starts a new page only when less than ~25 % of the page is left (PGB; display only)

- **Engineer request (2026-11-02):** the printed report started every section on a new page, which left near-empty pages after short section tails (seen in abutment, Moving Load Generator, Steel Beam, Stone Arch and others). Change to: no forced break per section; break before a section only when fewer than ~25 % of the page remains; keep headings with their first content.
- **Where:** `CSS` string, `@media print` block.
  - anchor `.rp-sec{break-before:page;}` (the line that also holds `.rp-part{…}`):
    - **Before:** `.rp-sec{break-before:page;} .rp-part{break-before:page;break-after:avoid;} …`
    - **After:** `.rp-sec{break-before:auto;} .rp-part{break-before:page;break-after:avoid;} …` (rest of the line unchanged)
  - after the line `.rp-h1,.rp-h2,.rp-h3,.rp-cap{break-after:avoid;}`, **added:**
    ```css
    .rp-h1{break-inside:avoid;padding-bottom:2.35in;margin-bottom:-2.35in;}   /* PGB (2026-11-02): … */
    ```
- **How it works:** a section heading (`.rp-h1`) is an unbreakable box 2.35 in taller than its text (the bottom padding). It moves to the next page when that box does not fit, i.e. when less than 2.35 in of the 9.45 in page body (letter, @page margins 0.85 / 0.7 in) is left: 25 %. The negative bottom margin of the same size lets the section's content flow back up into the padding, so on the page the heading is followed by its content at the usual spacing. `break-after:avoid` (unchanged) keeps the heading with its first block; subsection headings (`.rp-h2`, `.rp-h3`, `.rp-cap`, `.rp-top`) were already kept with their first content and are unchanged. Unchanged on purpose: the contents page still ends with a page break (`.rp-ptoc`), and a chapter heading (`.rp-part`, the chapters of Concrete Beam Capacity) still starts a new page.
- Print only (the rules are inside `@media print`). Screen display, the report model, API and markup are unchanged. No calculation, saved-data or storage change.
- **Spacing:** the heading's own 8 pt bottom margin is replaced by −2.35 in, so the gap under a section heading is now the next block's top margin (e.g. 12 pt before a subsection heading, as before; 3 pt before a section note, was 8 pt).
- **Check case:** Moving Load Generator, default project, Report → Print report: before 11 pages: section 2 "Vehicle" filled only the top of page 3 (13 text lines), section 3 started page 4 and section 4 page 5; after 9 pages: sections 2 and 3 share page 3, and section 4 starts on page 4 right after the end of section 3.
- **Consumers (CLAUDE.md §3):** ACI Rebar Development Length, ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Substructure Loading, Concrete Beam Capacity, Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Pile Designer, Prestressed Bridge Design, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design - AISC 15th, Stone Masonry Arch Load Rating, Timber Beam Check, abutment_calculator, elastomeric_design_module, index, lldf (all .html) and apps/steel-bridge (index.html, ui/report.js, report/builders.js).
- **Verified:**
  - `node tests/engine/run.mjs report steps steps-groups report-wiring`: 4 files, 14 passed, 0 failed. `node tests/check-syntax.mjs shared/report.js`: pass.
  - Printed PDF (headless Chromium, the tool's default project, Report → Print report, print media, letter, `preferCSSPageSize`), origin/main → branch, all 21 consumer tools: pages ACI Rebar 12 → 8, ASCE 7-16 9 → 7, Base Plate 47 → 42, Bridge Substructure 46 → 42, Concrete Beam Capacity 35 → 30, Gusset 46 → 41, Light Pole 29 → 27, Moving Load Generator 11 → 9, Pile Designer 17 → 13, Prestressed 29 → 23, Retaining Wall 20 → 15, Section Property 9 → 8, Shear and Moment 5 → 3, Spread Footing 30 → 26, Steel Beam AISC 36 → 31, Stone Arch 107 → 101, Timber 14 → 11, abutment 25 → 21, elastomeric 12 → 9, index 6 → 3, lldf 25 → 22. Pages with fewer than 15 text lines (header and footer included): 55 → 13 over the 21 tools; those left are the last page of a report, the end of a Concrete Beam Capacity chapter (chapters still start a page) or a page whose next block is a large unbreakable figure or step.
  - No orphaned heading: no page of the branch PDFs ends with a section, subsection, topic or caption heading (the only matches are the entries of the contents pages, the same in both). On origin/main, Retaining Wall Designer page 5 ended with the heading "Heel design basis"; gone.
  - No clipped or lost content: every text line of each origin/main PDF is found in the branch PDF's text (whitespace ignored), apart from lines that pdftotext splits differently around KaTeX sub/superscripts or SVG labels, time stamps and a run time ("Computed in 0.5 s"); rendered pages checked by eye (Base Plate figure page, Moving Load Generator page 4).
  - apps/steel-bridge: `node tests/smoke/steel-bridge-report.mjs` passes (print 3221 steps, 313 pages, 0 console errors, 0 KaTeX errors).

## 2026-11-03 — PR: claude/report-print-overflow (PR #733: https://github.com/mlococo88/All-Structural/pull/733) — print: no table prints a scroll bar; a table wider than the page is scaled to fit instead of clipped (RPTW; display only)

- **Problem:** on screen each report table sits in a horizontal scroll box (`.rp-tw{overflow-x:auto;}`), and print kept it. A table wider than the 7.3 in page body printed with a scroll bar and its right-hand columns cut off (default projects, origin/main: Bridge Substructure Loading 4 tables, e.g. the limit-state envelope tables of §15 lost "Extreme Event II" … "Governs"; Stone Masonry Arch 20 tables; abutment_calculator 1). Spread Footing had a local fix (SFPR, #725: `overflow:visible`), so its two wide tables ran past the page edge and Chromium shrank the **whole** printout to about 89 % to fit them.
- **Where:** `CSS` string, `@media print` block, after `.rp-step .rp-m{overflow:visible;}`; new functions `fitTables`, `fitBox`, `watchBox`, `watchBody` before `function print(doc)`; `print(doc)`; the `beforeprint` listener at the end.
- **Added (print CSS):**
  ```css
  .rp-tw{overflow:visible;} .rp-tbl.rp-fit{zoom:var(--rp-fit,1);}
  ```
- **Added (script):** `fitTables(root)`: for each `.rp-tw>table.rp-tbl`, measures the table at `width:min-content` (its narrowest layout: text cells wrapped at word breaks, number cells `nowrap`) against the page body, `PAGE_W = 7.3 * 96` px less the table's indent. Only when it is still wider does it get class `rp-fit` and `--rp-fit = max(0.5, floor(avail / need × 980) / 1000)` (0.98 × the ratio). A table that fits is untouched and wraps as before. Closed (`.rp-closed`) or search-hidden (`.rp-hide`) parts of the live viewer print open, so they are opened for the measurement and restored. All tables are measured in one layout pass.
  `fitBox(box)` lays `#rp-print` out off screen (`position:absolute;left:-100000px;width:7.3in;visibility:hidden`), fits it, and restores the box's inline style. `print(doc)` calls it. Every tool's own Ctrl+P handler fills `#rp-print` itself after this file's `beforeprint` listener, so `watchBody`/`watchBox` (MutationObservers on `body` and on `#rp-print`, child list only) call `fitBox` when the box is created or filled. Observer callbacks are microtasks, so this runs before the browser lays out the print. The `beforeprint` listener also fits the live viewer (`fitTables(LIVE.art)`) when it prints itself.
- **Before (print(doc)):** `box.innerHTML = …; setPage(doc); …` **After:** `box.innerHTML = …; watchBox(box); fitBox(box); setPage(doc); …`
- **Before (beforeprint):** `… { fillLazy(LIVE.art, LIVE.doc); setPage(LIVE.doc); } });` **After:** `… { fillLazy(LIVE.art, LIVE.doc); setPage(LIVE.doc); try { fitTables(LIVE.art); } catch (e) { } } });` followed by the `watchBody` hook.
- Print only. Screen layout, the report model, the API and the markup are unchanged. No calculation, saved-data or storage change. Any error in the fitting leaves the table unscaled (try/catch).
- **Check case:** Bridge Substructure Loading, default project, Report → Print report. Before: §15 "Limit-state envelope" tables printed 7 of 11 columns with a scroll bar. After: all 11 columns, scaled 0.652 / 0.738. Stone Masonry Arch: "3. Results at every section" (19 columns), all shown at 0.754. Spread Footing: the resultant table (0.875) and the pedestal table (0.913) fit, and the rest of the report prints at full size again.
- **Consumers (CLAUDE.md §3):** ACI Rebar Development Length, ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Substructure Loading, Concrete Beam Capacity, Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Pile Designer, Prestressed Bridge Design, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design - AISC 15th, Stone Masonry Arch Load Rating, Timber Beam Check, abutment_calculator, elastomeric_design_module, index, lldf (.html), apps/steel-bridge.
- **Verified:** `node tests/check-syntax.mjs` (92 files pass); `node tests/engine/run.mjs report steps steps-groups report-wiring`: 12 passed, 2 failed, and the same 2 fail on origin/main (`steps-groups-tabs`: `apps/steel-bridge/ui/lists.js` uses `document` in Node; not related). `node tests/smoke/steel-bridge-report.mjs`: print 3221 steps, 313 pages, 0 console errors, 0 KaTeX errors. Printed PDF of all 21 page tools (headless Chromium, default project, Report → Print report, print media, letter): tables in a scroll box wider than the box, origin/main → branch, BSL 4 → 0, Stone Arch 20 → 0, abutment 1 → 0; tables past the page edge Spread Footing 2 → 0, all others 0 → 0. Pages: unchanged for 16 tools; BSL 137 → 129, Stone Arch 140 → 136, Timber 14 → 13 (a table no longer takes extra height; one fewer repeated header); Spread Footing 54 → 63 (main printed it shrunk to 89 %; now full size). Ctrl+P with every section collapsed gives the same page counts as the button (BSL, Stone Arch, abutment, Spread Footing), and the sections stay collapsed afterwards. Report text found in the PDF (whitespace ignored): BSL cells missing 420 → 29, Stone Arch 376 → 80; other differences are pdftotext artefacts (a hyphen at a line end dropped, superscripts joined). Pages checked by eye.
- **Open items:** a scaled table prints smaller type (smallest default case 0.652 × 9.5 pt ≈ 6.2 pt, Bridge Substructure §15); the floor is 0.5. If the engineer prefers, such tables could be split or turned instead.

## 2026-11-03 — PR: claude/report-print-split (PR #735: https://github.com/mlococo88/All-Structural/pull/735) — print: a wide table is never scaled below 0.80; one that needs more is split into column blocks (RPSP; display only)

- **Engineer decision (2026-11-03, on RPTW #733):** set a scaling floor of 0.80 (about 7.5 pt) and split any table that needs more scaling. Each block repeats the first column (the row label) and the header, and has a caption giving its columns. Print only; the screen and the data stay unchanged.
- **Where:** `fitTables` (the RPTW block before `function fitBox`), new helpers `fitOf`, `grid`, `colWidths`, `splitTable` after it; `CSS` string: the screen rule `#rp-print{display:none;}` and the `@media print` line after the RPTW rule.
- **Before (fitTables, last step):**
  ```js
  if (m && m[0] > m[1] + 0.5) { t.classList.add('rp-fit'); t.style.setProperty('--rp-fit', String(Math.max(0.5, Math.floor(m[1] / m[0] * 980) / 1000))); }
  ```
- **After:** `FIT_MIN = 0.8`. Tables are measured in the same single layout pass as before. If the zoom would be below `FIT_MIN` (`fitOf(avail, need) < FIT_MIN`), the column widths are read (`colWidths`, from one-column cells at `min-content`) and `splitTable` runs:
  - **Block widths:** each block holds column 1 plus columns a–b, and its width is at most `avail × 0.98 / FIT_MIN`. The block count is the smallest that allows this. Columns are shared out evenly by width: the narrowest limit, in 4 px steps from (column 1 + the rest ÷ k), that still gives k blocks.
  - **Building a block:** each block is a new `table.rp-tbl.rp-blk` (plus `rp-wide` if the source has it). Every row of the source is cloned, keeping `thead`/`tbody` and the row classes. A cell spanning several columns keeps the part of its span that falls in the block.
  - **Caption:** `p.rp-cap.rp-blkcap` reads "Columns 1–10 of 19" for the first block and "Columns 1 and 11–19 of 19 (column 1 repeated)" for the next.
  - **Second pass:** the blocks are measured in a second layout pass. A block that is still wider than the page gets the RPTW zoom; by construction that is 0.80 or more.
  - **Where the blocks go:** they are added after the table in `div.rp-split`, and the table gets `rp-splitsrc`. A new fit first removes old blocks.
  - **When there is no split:** a table with fewer than 3 columns, a column of unknown width, or column 1 plus one column too wide for 0.80 is not split. It keeps the RPTW zoom, floor 0.5, so it is never clipped; no default project has such a table. Otherwise the zoom is `max(FIT_MIN, fit)`.
- **CSS added:** screen `.rp-split{display:none;}` (after `#rp-print{display:none;}`). Print:
  ```css
  .rp-tbl.rp-splitsrc{display:none;} .rp-split{display:block;} .rp-blkcap{font-weight:400;font-style:italic;margin:6pt 0 1pt;}
  ```
- No calculation, model, API, saved-data or storage change. The screen viewer is unchanged: Bridge Substructure and Stone Arch Report tabs have the same text length and height before and after a Ctrl+P, the same as origin/main, and the blocks are never visible on screen.
- **Check case:** Bridge Substructure Loading, default project, §15.27 "Load combinations: Abut. 1 (table 1)", 11 columns. Before (RPTW): one table at 0.652 (about 6.2 pt). After: "Columns 1–6 of 11" (Effect, Strength I/III/V, Service I/IV) and "Columns 1 and 7–11 of 11 (column 1 repeated)" (Extreme Event I/II, Construction, envelope, Governs), both at full size. The "Bearings" / "Resultant" group rows span each block. Stone Arch §3 "Results at every section", 18 columns: before 0.754; after columns 1–10 and 1 + 11–18, full size.
- **Consumers (CLAUDE.md §3):** the same 21 tools and apps/steel-bridge as RPTW.
- **Verified:**
  - `node tests/check-syntax.mjs`: all pass.
  - `node tests/engine/run.mjs report steps steps-groups report-wiring`: 12 passed, 2 failed. The same 2 fail on origin/main (`steps-groups-tabs`, `apps/steel-bridge/ui/lists.js` under Node).
  - `node tests/smoke/steel-bridge-report.mjs`: print 3221 steps, 313 pages, 0 console errors, 0 KaTeX errors.
  - Printed PDF of all 21 page tools (default project, Report → Print report): pages unchanged except Bridge Substructure 129 → 134 (4 tables split in 2) and Stone Arch 136 → 144 (19 tables split in 2; one 0.901 zoom left). The other zooms (Light Pole 0.892, Spread Footing 0.875 / 0.913, abutment 0.975) are unchanged.
  - No table is past the page edge, and no zoom is below 0.80.
  - Every text cell of the origin/main report is found in the branch PDF, apart from time stamps and paragraphs broken across pages.
  - Ctrl+P with every section collapsed gives the same pages as the button (134, 144), and the sections stay collapsed.
  - BSL pp. 67–68 and Stone Arch pp. 15 and 43 were checked by eye.
