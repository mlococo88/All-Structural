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
| `steps.js` | `window.SharedSteps` | `apps/steel-bridge/index.html` (engine: `apps/steel-bridge/engine/sections.js`); `Spread Footing.html` (Report tab); `Timber Beam Check.html` (Report tab) |
| `lldf.js` | `window.SharedLLDF` | `lldf.html`, `apps/steel-bridge/index.html` (adapter: `apps/steel-bridge/engine/lldf.js`) |
| `report.js` | `window.SharedReport` | `apps/steel-bridge/index.html` (Report tab: `apps/steel-bridge/ui/report.js`, model from `apps/steel-bridge/report/`); `Spread Footing.html` (Report tab, `sfrModel()`); `Timber Beam Check.html` (Report tab, `tbrModel()`) |
| `dxf.js` | `window.SharedDxf` | `apps/steel-bridge/index.html` (engine: `apps/steel-bridge/engine/drawings.js`). DXF R12 writer (display list → DXF and SVG preview), `validate()`, `download()`. Future: Base Plate, Gusset, Section Properties, Bridge Geometry (`fixlog/shared-dxf.md`); `Spread Footing.html` (Drawings tab, `sfdwBuild()`) |

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
unresolved and duplicate keys: the app's tests assert both are empty.
