# shared/ — code used by more than one tool

Plan: `docs/REBUILD_PLAN.md` (§3). Rules: `CLAUDE.md` §1, §3, §7, §8.

## Conventions

- **Classic scripts.** Each file is loaded with a plain
  `<script src="shared/name.js"></script>` (or `../../shared/name.js` from
  `apps/<tool>/`). No `type="module"`, no `import`/`export`: browsers block
  modules from `file://`. Relative paths only.
- **One global namespace per file.** A file wraps its code in an IIFE and
  exposes exactly one object, e.g. `window.SharedMovingLoad`,
  `window.SharedVehicles`. No loose globals. If a file depends on another,
  it reads that namespace at call time and the page loads the dependency
  first.
- **No DOM access in engine files.** Engine files take plain inputs and return
  plain objects: no `document`, no `localStorage`, no reading form fields, no
  drawing. This keeps them runnable in Node (`tests/engine/`).
- **Data in `.js` files.** Tables (vehicles, shapes, …) are JavaScript objects
  in `.js` files, never `.json` loaded by `fetch`/XHR (blocked from `file://`).
- **Units** are stated in each function's header comment.

## Changing a shared file

- §4 change control applies: a pure refactor must not change any result;
  a calculation change needs before/after, the code section with edition, and
  a check case.
- Run `node tests/engine/run.mjs` and the tests of every tool that loads the
  file; list those tools in the PR.
- Log the change in `fixlog/shared-<name>.md` (e.g. `fixlog/shared-moving-load.md`).

## Files and the tools that load them

| File | Namespace | Loaded by |
|---|---|---|
| `vehicles.js` | `window.SharedVehicles` | `Moving Load Generator.html`, `apps/steel-bridge/index.html` (engine: `apps/steel-bridge/engine/analysis.js`) |
| `moving-load.js` | `window.SharedMovingLoad` | `Moving Load Generator.html`, `apps/steel-bridge/index.html` (engine: `apps/steel-bridge/engine/analysis.js`) |
| `units.js` | `window.SharedUnits` | `apps/steel-bridge/index.html` |
| `steps.js` | `window.SharedSteps` | `apps/steel-bridge/index.html` (engine: `apps/steel-bridge/engine/sections.js`); `Spread Footing.html` (Report tab); `elastomeric_design_module.html` (Report tab, `edrModel()`); `Timber Beam Check.html` (Report tab); `ACI Rebar Development Length.html` (Report tab); `Shear and Moment Diagrams.html` (Report view); `abutment_calculator.html` (Report tab, `abrModel()`); `Concrete Beam Capacity.html` (combined Report tab in the suite shell; Development & Splice tab); `lldf.html` (Report tab); `Stone Masonry Arch Load Rating.html` (Report tab); `Section Property Calculator.html` (Report tab); `Bridge Substructure Loading.html` (Report tab); `Retaining Wall Designer.html` (Report tab); `Steel Beam Design - AISC 15th.html` (Report tab); `Moving Load Generator.html` (Report tab); `ASCE7-16 Load Generator.html` (Report tab); `Prestressed Bridge Design.html` (Report (new) tab); `Pile Designer.html` (Report tab); `index.html` (Report step); `Gusset Plate Rating.html` (Report (shared viewer) tab); `BasePlateAnchorDesigner.html` (Report tab); `Light Pole and Sign Post.html` (Report tab) |
| `lldf.js` | `window.SharedLLDF` | `lldf.html`, `apps/steel-bridge/index.html` (adapter: `apps/steel-bridge/engine/lldf.js`). `SharedLLDF.steps`: the LLDF worked-step writer (shared/steps.js format, needs `SharedSteps` at call time), used by the Steel Bridge app (moved from its adapter 2026-11-01) and by `lldf.html`'s Report tab (`steps.other` for types f, g, b/c, d, slab) |
| `report.js` | `window.SharedReport` | `apps/steel-bridge/index.html` (Report tab: `apps/steel-bridge/ui/report.js`, model from `apps/steel-bridge/report/`); `Spread Footing.html` (Report tab, `sfrModel()`); `elastomeric_design_module.html` (Report tab, `edrModel()`); `Timber Beam Check.html` (Report tab, `tbrModel()`); `ACI Rebar Development Length.html` (Report tab, `rbrModel()`); `Shear and Moment Diagrams.html` (Report view, `smrModel()`); `abutment_calculator.html` (Report tab, `abrModel()`); `Concrete Beam Capacity.html` (combined Report tab: chapters from `cbcRptModel()`, `asdRptModel()`, `rbrModel()`; uses `section.part`); `lldf.html` (Report tab, `LLRP.model()`); `Stone Masonry Arch Load Rating.html` (Report tab, `archReportModel()`); `Section Property Calculator.html` (Report tab, `sprModel()`); `Bridge Substructure Loading.html` (Report tab, `slrModel()`; loads KaTeX 0.16.9); `Retaining Wall Designer.html` (Report tab, `rwrModel()`); `Steel Beam Design - AISC 15th.html` (Report tab, `sbrModel()`: the tabs read back); `Moving Load Generator.html` (Report tab, `mlrModel()`); `ASCE7-16 Load Generator.html` (Report tab, `a7Model()`); `Prestressed Bridge Design.html` (Report (new) tab, `psrModel()`); `Pile Designer.html` (Report tab, `pdrModel()`); `index.html` (Report step, `idxrModel()`); `Gusset Plate Rating.html` (Report (shared viewer) tab, `gprModel()`; uses `refs`, `subs[].ref` / `key`, `head.center` / `lines`); `BasePlateAnchorDesigner.html` (Report tab, `bprModel()`: the RPT-2 sheet read back; uses `opt.spy`, `api.go`); `Light Pole and Sign Post.html` (Report tab, `lprModel()`) |
| `dxf.js` | `window.SharedDxf` | `apps/steel-bridge/index.html` (engine: `apps/steel-bridge/engine/drawings.js`). DXF R12 writer (display list → DXF and SVG preview), `validate()`, `download()`. Future: Base Plate, Gusset, Section Properties, Bridge Geometry (`fixlog/shared-dxf.md`); `Spread Footing.html` (Drawings tab, `sfdwBuild()`); `Light Pole and Sign Post.html` (Drawings tab and the Geometry elevation, `lpdBuild()`) |
| `projects.js` | `window.SharedProjects` | `ASCE7-16 Load Generator.html` (PLIB, 2026-11-02); `Stone Masonry Arch Load Rating.html`, `Gusset Plate Rating.html`, `Retaining Wall Designer.html`, `BasePlateAnchorDesigner.html`, `Light Pole and Sign Post.html`, `Timber Beam Check.html`, `Moving Load Generator.html`, `Bridge Substructure Loading.html` (PLIB); `lldf.html` (PLIB: `history` and `undoRedo` only); `Spread Footing.html`, `Steel Beam Design - AISC 15th.html`, `Section Property Calculator.html`, `Shear and Moment Diagrams.html` (PLIB, dialog only); `Bridge Geometry.html` (PLIB: `mapStore` duplicate in its own library panel, `history` and `undoRedo`); `ACI Rebar Development Length.html` and its embedded copy in `Concrete Beam Capacity.html` (Development & Splice tab) (PLIB: dialog, `history` and `undoRedo`); `elastomeric_design_module.html` (PLIB: `mapStore` rename / duplicate in its own Projects dialog, `history` and `undoRedo`); `abutment_calculator.html` (PLIB: `mapStore` rename / duplicate in its own Projects dialog; `undoRedo` keys over its own Undo with the new Redo). Saved-project list over the tool's **own** key and item format (`mapStore`: rename and duplicate move / copy the stored item unchanged; a refused or full write leaves storage as it was; an unreadable list is never overwritten), storage use, Eastern time, and the undo / redo stack (`history`, whole-state snapshots, session only). No DOM. Tests: `node tests/engine/run.mjs projects` |
| `projects-ui.js` | `window.SharedProjectsUI` | `ASCE7-16 Load Generator.html` (PLIB, 2026-11-02); `Stone Masonry Arch Load Rating.html`, `Gusset Plate Rating.html`, `Retaining Wall Designer.html`, `BasePlateAnchorDesigner.html`, `Light Pole and Sign Post.html`, `Timber Beam Check.html`, `Moving Load Generator.html`, `Bridge Substructure Loading.html` (PLIB); `lldf.html` (PLIB: `history` and `undoRedo` only); `Spread Footing.html`, `Steel Beam Design - AISC 15th.html`, `Section Property Calculator.html`, `Shear and Moment Diagrams.html` (PLIB, dialog only); `Bridge Geometry.html` (PLIB: `mapStore` duplicate in its own library panel, `history` and `undoRedo`); `ACI Rebar Development Length.html` and its embedded copy in `Concrete Beam Capacity.html` (Development & Splice tab) (PLIB: dialog, `history` and `undoRedo`); `elastomeric_design_module.html` (PLIB: `mapStore` rename / duplicate in its own Projects dialog, `history` and `undoRedo`); `abutment_calculator.html` (PLIB: `mapStore` rename / duplicate in its own Projects dialog; `undoRedo` keys over its own Undo with the new Redo). The "Saved projects" dialog (Open / Rename / Duplicate / Delete, storage use), the Undo / Redo buttons and Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z (left to the browser while text is being typed in a field). Every element it adds has `data-sp`. Needs `projects.js` first. Browser test: `node tests/smoke/project-library.mjs --tool <key>` |
| `list-input.js` | `window.SharedListInput` | `Shear and Moment Diagrams.html` (Custom x, `bindInput` on `#iUX`; LIST, 2026-11-02); `Steel Beam Design - AISC 15th.html` (Output Stations, Custom stations x, `mount`; LIST); `Bridge Substructure Loading.html` (Bridge tab, span lengths and girder spacings, `bindInput`; LIST); `Bridge Geometry.html` (per-span girder offsets, `mountSlot`; survey-point paste box with its table, `mount`; LIST); `Gusset Plate Rating.html` (Members, Gage(s) g, `bindInput`; LIST); `Section Property Calculator.html` (library Tags and the Rename dialog's tags, `mount`; LIST); `index.html` (GFS floorbeam spacings and stringer offsets, AREMA girder spacings, `react`; LIST); `Stone Masonry Arch Load Rating.html` (survey points, depth overrides and SDL line items: paste boxes with their tables, `mount`; track offsets, `bindInput`; LIST); `Prestressed Bridge Design.html` (bridge bar spans, `react`; LIST); `BasePlateAnchorDesigner.html` (stacked hairpin depths, `bindInput`; LIST); `apps/steel-bridge/index.html` (spans, spacings, skews, field splices, stud-free splice stations, cross-frame x:P loads, pours, station windows: `ui/lists.js`, `bindInput`; LIST). Editable list tables in place of comma-separated boxes: one box per value (one per column for multi-column lists), "+ Add", "×" per row, Enter / paste from Excel split into rows, per-cell checks, accessible labels. Never stores anything: a list saved as text keeps its text format (`fromText` / `toText`, `bindInput` keeps the tool's own `<input>` hidden as the source), an array stays an array (`fromNumbers` / `toNumbers`). Plain DOM (`mount`), HTML-string tools (`slot` + `mountSlot`), React without JSX (`react(React)` → `ListTable`). Every element has `data-sli`. Tests: `node tests/engine/run.mjs list-input` (Node), `node tests/smoke/list-input.mjs` (browser) |

## Worked steps (`steps.js`)

Every engine function returns its values **and** the steps that work them out; the screen, the printed
report and the tests render those same steps (`docs/REBUILD_PLAN.md` §5, CLAUDE.md §6 "show the work").

A step is a plain object:

| Field | Meaning |
|---|---|
| `id` | Stable key, unique within one result, dotted (`sec.cn.yb`). In-app links (`#st-<id>`) and the report's "see §x.y" point to it. Never reuse an id for a different quantity. |
| `label` | What the step finds, in words. |
| `sym` | Symbol of the result. |
| `eq` | The equation in symbols (right-hand side). |
| `sub` | The same with the values substituted, numbers already formatted. |
| `value` | The result at full precision (a number), or a string for a non-numeric outcome (a case, yes/no). Never rounded. |
| `unit` | Unit of `value` (`in`, `in^{2}`, `kip-ft`, or empty). |
| `d` | Decimals to display `value` with (display only). |
| `ref` | Code reference with edition, e.g. `AASHTO LRFD 10th Ed. Eq. 6.10.1.10.1-1`; empty if none. |
| `note` | Optional remark (condition, why a case applies, a scope flag). |
| `ok` | Optional, for a test step: `true` / `false`. |

It renders as `label` over `sym = eq = sub = value unit`, with `ref` beside the label.

- **Notation** of `sym`, `eq`, `sub`, `unit`: a small TeX subset — `_{…}`, `^{…}`, `\frac{a}{b}`, `\bar{x}`,
  `\sqrt{x}`, `\text{…}`, Greek letters, `\sum`, `\cdot`, `\times`, `\le`, `\ge`, `\lt`, `\gt`,
  `\prime`, `\ell` (ℓ), `\tan`, `\circ` (°; `^{\circ}` is shown as a plain degree sign), `\,`. Every string must also be valid KaTeX (`\minus` is the one subset-only macro; it is given to
  KaTeX as a macro for `-`). `SharedSteps.toHTML()` renders with KaTeX (`katex.renderToString`, `throwOnError: false`,
  options `SharedSteps.katexOpt`) when the page has loaded it (`window.katex`; `apps/steel-bridge/index.html` loads
  KaTeX 0.16.9 from cdnjs), and with the built-in renderer otherwise (offline, CDN blocked), so the steps always show.
  Units go to KaTeX through `SharedSteps.unitTeX()` (words upright: `in^{2}` → `\text{in}^{2}`). `toText()` (the
  plain-text report) never uses KaTeX. `tests/engine/tex.test.mjs` parses every step string the engine tests make with
  KaTeX (the copy in `tests/libs`).
- **Collecting:** `const w = SharedSteps.work('sec.s'); const A = w.add({ id: 'A', … , value });` stores
  the step (id `sec.s.A`) and returns its value, so the value used downstream is the value shown.
  Results carry `steps: w.steps`; a composite result concatenates its parts' steps in order.
- **Formatting substitutions:** `SharedSteps.n(x, d)` (fixed decimals), `SharedSteps.g(x, d)` (thousands grouped).
- **Tests** compare `value`s, not strings; a hand-check test may also check a rendered line.

## Calculation report (`report.js`)

The Gusset-style report viewer: an app builds a report model (sections → subsections → items: worked steps, tables, SVG figures, notes,
key–value lists; format in the file header) and `SharedReport.mount(host, model, opt)` shows it with a navigation tree, numbering §n.m,
collapse / expand, search and Print (whole report, running header and page numbers). Steps render through `SharedSteps`. A step is anchored by
`scope/stepId`; `[[key]]` in text or a cell's `key` is a "see §x.y" link; a step note's "§<step id>" is linked too. `build(model)` lists
unresolved and duplicate keys: the app's tests assert both are empty. Any item may carry a `topic` heading (title, number, chip, one-line
result) with its own anchor and nav entry; a long table may be `lazy` (closed, rendered when opened, filled for print).
