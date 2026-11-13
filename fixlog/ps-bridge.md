# Fix log — apps/ps-bridge/ (Prestressed Bridge Design, rebuild)

The rebuild of `Prestressed Bridge Design.html` as a folder app built like the Steel Bridge app (`docs/ps-bridge-plan.md`; engineer
decisions PS-1 to PS-14, 2026-11-12). Folder: `apps/ps-bridge/` (`index.html`, `engine/`, `ui/`, `report/`). Loads no `shared/` file yet.
Tests: `node tests/engine/run.mjs psbridge` (model, verbatim, parity harness A from PR 2a); `node tests/smoke/ps-bridge-skeleton.mjs`. The old `Prestressed Bridge Design.html` is
unchanged and stays the working tool until the switch-over.

## 2026-11-12 — PR 1: ps-bridge-skeleton — folder, shell, tabs (placeholders), project model psb2.project v1 (new files)
PR #1444: https://github.com/mlococo88/All-Structural/pull/1444
### Where
- `apps/ps-bridge/index.html` (new): the Steel Bridge shell (header, check summary column from 1200 px, input panel, splitter from
  900 px, output panel; stacked below 900 px), the CBUST `document.write` loader of classic scripts with `?v=<lastModified>`, KaTeX 0.16.9 and
  three.js r128 + OrbitControls 0.128.0 at the steel app's pinned URLs (no new library; used from PR 2b / 3c). Input tabs (plan §2.2):
  Project · Bridge layout · Cross-section · Girders & strands · Materials · Diaphragms / deck · Loads · Owner rules · Auto design. Output tabs
  (plan §2.3): Summary · Section properties · Loads & LLDF · Analysis · Losses · Stresses · Flexure · Shear · End zone & hold-down · Camber &
  deflection · Handling · Deck · Rating · Report · Drawings · Auto design · 3D view. Editable now: project information, spans and continuity,
  support skews, girder count, bays (unequal allowed), overhangs; every other card is a placeholder naming its contents and its PR. Export
  JSON (`<name>.psb2.json`), Import JSON, New. Input errors mark their field, count on their tab and are listed (with links) on the output
  panel and in the check summary column.
- `apps/ps-bridge/engine/model.js` (new, `window.PSBModel`): schema `psb2.project` v1 `{ project, spans{lengths, continuity 'simple' |
  'composite'}, xs{nb, bays, ohL, ohR, skews} }`; `defaultProject` (120 ft simple span, 5 girders at 9.0 ft, 3.0 ft overhangs, no skew: the
  old app's default L, S, girder count and overhang), `validate` (errors by path), `migrate` (none yet), `legacyKind` (an old Prestressed
  Bridge Design Export JSON / bridge file is recognised and refused with "imported in a later version"; nothing changed), `exportJSON`,
  `importJSON`, `save`, `load` (an unreadable saved project is copied to `psb2.project.unreadable.<ISO time>` first; if that copy fails,
  autosave stays off), `totalLength`, `girderOffsets` (display).
- `apps/ps-bridge/ui/dash.js` (new, `window.PSBDashUI`): the check summary column; each planned check group "not run" with its PR, or the
  input errors as links.
- `apps/ps-bridge/report/sections.js` (new, `window.PSBReportPlan`): the planned report sections, listed on the Report tab.
- `tools.html`: card "Prestressed Bridge Design (new, in development)", after the old app's card, "Not for design use yet" (the steel app's
  precedent, #465); entry in `fixlog/tools.md`.
### Copies from the Steel Bridge app (to move to shared/ later, CLAUDE.md §3)
- `apps/ps-bridge/ui/splitter.js` = `apps/steel-bridge/ui/splitter.js` at `d4e0d2b`, changed only in: namespace `PSBSplitUI`, UI key
  `psb2.splitRatio_v1`, event `psb2:panelresize`.
- The shell CSS in `apps/ps-bridge/index.html` = `apps/steel-bridge/index.html` `<style>` at `1c75fcc` without its tab-specific rules
  (the `.fRow:has(...)` steel field rules, the report, 3D bar, framing plan, hand-offs card and saved-projects dialog rules).
- `apps/ps-bridge/ui/dash.js`: adapted from `apps/steel-bridge/ui/dash.js` (head, « / » toggle, chip and error layout, same CSS classes).
- The page controller pattern (inline script: `num`/`sel`/`card` helpers, `panes()`, `drawInputs`, error marks and counts, `exportFile`)
  follows `apps/steel-bridge/index.html`; written for this app.
### Saved data (CLAUDE.md §5)
- New keys only: `psb2.project.current` (autosave), `psb2.project.unreadable.<ISO time>` (backup of an unreadable project), `psb2.ui` (tab
  choices), `psb2.splitRatio_v1`, `psb2.dashCollapsed_v1` (per-browser UI). Reserved in `KEYS` for a later PR: `psb2.lib.index`,
  `psb2.lib.p.<id>`, `psb2.lib.current`. `psb2.` was used by no tool (checked). No `psbeam.*`, `sbd2.*` or other key is read or written.
### Governing provisions
- None: no calculation. The continuity choice "made continuous for composite loads" names AASHTO LRFD 10th Ed. (2024) 5.12.3.3 as the old
  app's `cont.on` (PS-7); nothing uses it yet.
### Check case
- Default project: valid; total length 120 ft; girder lines 3, 12, 21, 30, 39 ft from the left deck edge (3 + 4 × 9); deck width 42 ft.
- Bays "9, -2, 9, 9": error "Bay 2 spacing must be a positive number." on `xs.bays.1`; spans "100, 125, 100": 4 support skews.
### How verified
- `node tests/engine/run.mjs psbridge-model`: 6 tests pass (defaults, validation by path, save/load with `psbeam.*`/`sbd2.*` keys
  untouched, unreadable backup and storage-full, export/import and old files refused, the page's script list / relative paths / CDN pins
  equal to the steel app's / no steel key or namespace in the code).
- `node tests/check-syntax.mjs` (all files) passes; `node tests/smoke/ps-bridge-skeleton.mjs`: 50 checks pass (1400 px layout and every
  tab, autosave and reload, only `psb2.*` keys written, seeded `psbeam.inputs.v1`/`sbd2.project.current` byte-identical, error mark and
  link, unreadable backup, 390 px stacked with no sideways scroll, 0 console errors). `tests/smoke/home-projects.mjs`, `tests/smoke/home-sync.mjs`,
  `tests/engine/project-registry.test.mjs` pass with the new card.
### Other copies
- The copied steel files above (listed for the `shared/` move). The old `Prestressed Bridge Design.html` is unchanged.
### Open items
- Next: PR 2a (engine moved in verbatim + Node parity harness, plan §3).

## 2026-11-12 — PR 2a: engine moved in unchanged (pbd-*.js) + Node parity harness A; project base design (model.base)
PR #1448: https://github.com/mlococo88/All-Structural/pull/1448
### Where
- `apps/ps-bridge/engine/pbd-*.js` (new): the old app's engine, moved unchanged (plan §3, PS-6). Each file = a header comment (source file,
  commit, lines, the global names it defines) + a `PBD-VERBATIM` marker line + the slice of `Prestressed Bridge Design.html` at commit
  `8fe8650275b7fc7377fdb87685d3bf0d669a4aa8` (blob `00a3a34e1421b28ad12c760d113f597f1a3a7c60`), byte for byte:
  | file | lines | contents |
  |---|---|---|
  | `pbd-model.js` | 1902-2420 | `window.PBD` (the whole plain `<script>` between its tags on 1901 and 2421) |
  | `pbd-library.js` | 2429-2536 | `GIRDERS`, `STRANDS`, `fmt`, `clamp`, `bridgeNav`, `sqrt`, `DEFAULTS` |
  | `pbd-section.js` | 2537-2773 | gross / composite section, overrides, `Ec`, `ktdAASHTO`, torsion |
  | `pbd-strands.js` | 2774-2871 | `strandSys`, `tensionSideArea` |
  | `pbd-losses-ll.js` | 2872-2965 | `losses`, `hl93`, `negMomentHL93` |
  | `pbd-handling-deck.js` | 2966-3160 | `handlingCalc`, Table A4-1, `deckCalc` |
  | `pbd-lldf-flexure.js` | 3161-3295 | `distFactors`, `flexure` |
  | `pbd-external.js` | 3296-3427 | `buildExternal`, `externalSpans`, `bxSuperRxPayload`, `contUnit` |
  | `pbd-compute.js` | 3428-4571 | `computeAll`, `Aps0`, `psbReportVals` |
  | `pbd-optimize.js` | 4572-4629 | `optimizeStrands`, `sweepDesign` |
  | `pbd-merge.js` | 8796-8813 | `mergeInputs` (from the old page's persistence part; for `model.base`) |
  2429-4629 is the whole engine part of the old page's `text/babel` block (2423-9750). Not moved: 2423-2427 (React hooks, BridgeLocks UI glue)
  and the UI part (4630-9750, JSX). Nothing outside the slices is referenced by them (checked: the files run alone in Node on every case).
- `apps/ps-bridge/index.html`: the 11 files added first to the CBUST `document.write` script list (source order, classic scripts), before
  `engine/model.js`; head comment. No UI change: nothing is shown from the engine yet (PR 2b on).
- `apps/ps-bridge/engine/model.js`: optional `base` within schema version 1 (plan §2.4): the base girder design, an inputs object of the old
  app's format, stored as `mergeInputs(base)` (a copy); `defaultProject()` carries `mergeInputs(null)` (= the old app's DEFAULTS: PCI BT-72,
  L 120 ft, S 9.0 ft); `importJSON` / `load` fill a missing `base` (a PR 1 project) with the defaults and merge a stored one onto DEFAULTS;
  `validate` refuses a `base` that is not an object (path `base`); `baseInputs(saved)` exported. Without the moved engine loaded (model.js
  alone) `base` is left as it is.
- Tests (new): `tests/engine/psbridge-source.mjs` (pin, slices, headers, the two Node contexts), `psbridge-verbatim.test.mjs`,
  `psbridge-cases.mjs`, `psbridge-parity.test.mjs`; `psbridge-model.test.mjs` updated (script list; the key-literal check leaves out the
  verbatim files, which name `psbeam.bridge.v1` as the old page does, and checks that no app file calls `PBD.load/save/select/edit` or
  `bridgeNav`; a base-design test).
- `docs/ps-bridge-plan.md` §3.5 and `fixlog/Prestressed Bridge Design.md`: the old app is frozen from this PR on (PS-14 g); that file is unchanged.
### Exception to the one-namespace-per-file rule (CLAUDE.md §1), planned later cleanup
- The moved files define the old page's top-level names as globals (51: `GIRDERS`, `DEFAULTS`, `computeAll`, `mergeInputs`, … each file's
  header lists its own), plus `window.PBD`. Wrapping them would edit the code, so they stay as on the old page (plan §2.1). Checked: no app
  file declares a top-level name (every other file is one IIFE), so nothing collides. Moving them under one namespace is a later PR.
### Governing provisions
- None changed: a pure move (§4). Proof that no computed result changed: the parity harness below, tolerance 0.
### Parity harness A (`node tests/engine/run.mjs psbridge-parity`)
- Old side: the pinned text (`git show`, or the working-tree file when its blob hash equals the pin's), its window.PBD script run as is and
  its `text/babel` block compiled with `tests/libs/babel-standalone@7.23.5` exactly as babel-standalone compiles a
  `data-presets="env,react"` script (presets env + react, its default plugins; ES5, strict mode) and run whole (React and the DOM stubbed).
  New side: the pbd-*.js files as classic scripts. Same stand-ins on both: empty localStorage, `BridgeBeam.get()`, `BridgeXfer.sharedProject()`.
- Compared per case, tolerance 0 (Object.is per number: NaN, ±∞, −0 kept; text exact; key order too; function-valued fields by their values
  at sample arguments): `mergeInputs`, the whole `computeAll` result (checks, warnings, error), `psbReportVals`, `bxSuperRxPayload`,
  `PBD.migrate` (both modes, time stamp normalised), `PBD.applyBridge`/`withSpans`/`valid` for three cells, `PBD.contFE`, `PBD.restraint`,
  `PBD.ownLoads`, console output; `optimizeStrands` and `sweepDesign` (span, girder, spacing) on 16 cases.
- Cases: the 38 of `tests/ps-compare.mjs` + 600 seeded (every shape; spans, spacing, interior/exterior, f′ci/f′c/H, strand size, loss
  method, the 4 owners with η and the LL multiplier, continuity 2-4 spans with/without restraint, draped n_h 0-16 at frac 0.30-0.50,
  debonding, release steel, MIDAS spans 1-3, rating vehicles, handling, deck, diaphragms, DF/LL overrides) + 20 edge cases = 658;
  14,972 checks and 1,284 warnings compared.
- **Result: 0 differences.** Also 0 with the moved files run in strict mode (118 cases; the old page's Babel output is strict code, the
  moved files run sloppy as classic scripts: no difference on any case), 0 on the optimizer and sweeps. Known non-identity examined, not
  assumed: Babel ES5 (`**` → `Math.pow`, spread → helpers, `const` → `var`, template literals → `concat`) gives the same numbers and text
  as the native code on every case. A control test shows the harness reports a 1e-9 change of one girder property and tells 0 from −0.
- `computeAll` time (Node 22, this machine): simple span, new (native) mean 5.6 ms, median 4.5, p95 15.4, max 20; old (Babel ES5) mean
  13.2, median 10.4, p95 45. Continuous unit: the first design of a span arrangement solves its FE model (`sgBeam`, cached per arrangement)
  in 1-2.7 s, later ones median 5 ms (old 10 ms). For PR 3b (run all girders × spans): one FE solution per arrangement, then ~5 ms per cell.
### Check case
- Default base design: `computeAll(mergeInputs(null))` (PCI BT-72, L 120 ft, S 9.0 ft, strand rows 10 / 10 / 8 at 2 / 4 / 6 in, harp.n 12, 0.6 in strands): no error,
  every check identical to the old app (case `defaults` of the harness).
### Saved data (CLAUDE.md §5)
- `psb2.project` v1 gains the optional `base`; a project saved by PR 1 reads with the defaults (nothing stored is changed by reading).
  No new key. No `psbeam.*` key is read or written (the moved `PBD.load`/`PBD.save` are not called, checked by test).
### How verified
- `node tests/engine/run.mjs` (all), `node tests/check-syntax.mjs` (all files), `node tests/smoke/ps-bridge-skeleton.mjs` (50 checks, 0
  console errors under file:// with the engine scripts loaded).
### Other copies
- The moved engine is a copy of the old page's engine until the switch-over (PR 10); the old page is frozen. The bridge-suite bootstrap
  copies are not touched.
### Open items
- Next: PR 2b (input tabs wired to `base`, input checks; Section properties, Loads & LLDF and Analysis tabs in the steel style, values =
  engine values).

## 2026-11-12 — PR 2b-1: input tabs wired to the base design (one design girder), input checks (new files; no calculation change)
PR #1450: https://github.com/mlococo88/All-Structural/pull/1450
### Where
- `apps/ps-bridge/engine/design.js` (new, `window.PSBDesign`): the one girder design until the bridge level (PR 3a). `P.design = { g, s }`
  (optional within schema v1; absent: G2, or G1 with one girder, in span 1). `inputs(P)` = the engine inputs: `PBD.applyBridge` (the old
  app's "Preliminary designer" bridge values, moved unchanged in PR 2a) on a copy of `P.base` with the bridge `{ spans: spans.lengths,
  nGirders: xs.nb, S: xs.bays[0], title }` (sets L = span s, S, nGirders, loads.pos exterior for G1 / G<nb>, cont.spans / cont.span, proj),
  then `cont.on` = made continuous with 2 or more spans, `loads.skew` = |skew| of the design span's supports, `deck.oh` = the overhang on
  the design girder's side (right for G<nb>, else left). `checks(P)`: blocking errors for the PR 2b limits — unequal bays (one S until PR
  3a, PS-9, plan §7 item 3), different skews at the two supports of the design span, fewer than 2 girders, a design girder / span out of
  range. `DRIVEN`: the base paths the bridge sets (not edited in base). `driven(P)`: those values for display.
- `apps/ps-bridge/engine/fields.js` (new, `window.PSBFields`): every engine input the old app's input cards expose, on its plan §2.2 tab,
  with label, unit, tooltip, rule and when-shown condition (labels from the old InputsTab at 8fe8650; "draped strands" (MassDOT / CTDOT
  wording, PS-5); "Hold-down point from ℄ bearing, frac × L_span" (PS-13)); the table inputs (strand rows, diaphragms, rating vehicles);
  `tabOf(path)`.
  | tab | inputs |
  |---|---|
  | Bridge layout | continuity card (made continuous only): restraint moments, deck A_s / d_top / f_y over the pier, A_s,pos, girder top near the pier |
  | Cross-section | t_s, haunch, b_eff automatic / entered, haunch in the section, separate dead-load deck thickness; d_e, N_L |
  | Girders & strands | design girder and span (+ the bridge values shown, linked); shape, Custom dimensions, property overrides; straight strand rows (n, y, debonded, length); draped strands n_h, y_end, y_mid, frac; stirrups; 5.7.3.5 tie bars, girder end past bearing, pad; release tension steel; girder top steel near the pier; splitting and confinement steel |
  | Materials | f′ci, f′c, f′c deck, the four unit weights; strand size, jacking ratio, E_p; H, V/S, t_i, t_d, t_f, loss method, Δf_pSS computed / entered; the PCI camber multipliers |
  | Diaphragms / deck | diaphragm point loads (table); deck design on/off and its inputs |
  | Loads | DC1 additional, DC2, DW per girder; LL automatic / entered, DF automatic / entered, fatigue DF; release stress section, γ_LL Service III; φ_c, φ_s; rating vehicles (table); handling on/off and its inputs; MIDAS import: placeholder (later PR) |
  | Owner rules | owner (the old `PBD.ownApply`: an input still at its default takes the new owner's default, an entered value is kept; the change listed in a message; `cont.on` stays the bridge's), η questions, HL-93 multiplier, sidewalk question, the owner's rules table; release compression factor, corrosion exposure; hold-down check (PS-10) placeholder, PR 2d |
  | Project | Assumptions card (the one design, the bridge values, the 2b limits, DC2/DW per girder until 3a, the moved engine, what is not yet in) |
  Not exposed (as in the old app's cards): str.fpu, str.lowlax, handling.sweep / fr / zo / ag / gFactor, deck.method, opt.splitFy; the MIDAS
  fields (external, loads.ext*) come with the MIDAS import (later PR). A test lists them.
- `apps/ps-bridge/engine/inputcheck.js` (new, `window.PSBInputCheck`, the steel app's `engine/inputcheck.js` pattern): `collect(P)` = model
  errors + design checks + every shown field against its rule (blank, sign, whole count, limits, an option) + table rows + locations
  (strand rows and draped centroids inside the girder depth, debonded ≤ strands of the row, debond length < L/2, diaphragms within the
  span, Custom y_b < h, override y_b < h) + ages in order (t_i < t_d < t_f). Design limits of the specification stay checks of the engine.
- `apps/ps-bridge/ui/inputs.js` (new, `window.PSBInputsUI`): draws the cards (tooltips on label and input, owner-default hints), the
  tables (add / delete; the last strand row cannot be deleted: the engine's mergeInputs reads an empty list as its default rows), the
  design girder card, the owner card, the assumptions; handles their input changes.
- `apps/ps-bridge/index.html`: loads the new files; the placeholders of these inputs replaced by the cards; the errors from
  `PSBInputCheck.collect` marked with their message beside the field, counted on their tab, listed with links on the output panel
  ("Results not shown: fix the inputs above") and in the check summary; the design girder / span follow a smaller girder or span count
  (as the old bridge bar); a message box for the owner change.
- `apps/ps-bridge/engine/model.js`: header documents the optional `design`. `ui/dash.js`: one sentence.
### Copies from the Steel Bridge app (to move to shared/ later, CLAUDE.md §3)
- `apps/ps-bridge/ui/inputcheck.js` = `apps/steel-bridge/ui/inputcheck.js` at `28e1605`, changed in: namespace `PSBInputCheckUI`, `fieldsOf`
  by data-path (then a row's inputs, then the nearest parent path), no steel list / output-tab fields, no `SBDInputCheck.NOTE`.
### Governing provisions
- None changed: no formula, factor or unit. The values the bridge gives the design are copied by the old app's own `PBD.applyBridge`
  (plus continuity, skew and overhang, which the old app took from its own boxes). Default project: every check identical to the old app's
  default design (test).
### Check case
- Spans 100, 125, 100 ft made continuous; 6 girders at 8.5 ft; overhangs 2.5 / 3.25 ft; skews 10, 20, 20, 10°; design G6 in span 2 →
  L = 125, S = 8.5, nGirders = 6, exterior, deck.oh = 3.25 ft, skew 20°, cont.on, cont.spans [100, 125, 100], span 2.
- Bays 9, 10, 9, 9 → error on xs.bays "Unequal bays … enter equal bays"; skews 0, 15 → "different skews"; row y = 80 in on a BT-72 →
  "not inside the girder (h = 72 in)".
### Saved data (CLAUDE.md §5)
- `psb2.project` v1 gains the optional `design`; the base design's fields are the old app's inputs format (unchanged). No new key; no
  `psbeam.*` key read or written (smoke test: seeded keys byte-identical after edits).
### How verified
- `node tests/engine/run.mjs psbridge` (new `psbridge-inputs.test.mjs`: defaults no error and identical checks, the bridge values,
  the limits, the field rules, every DEFAULTS input covered); `node tests/check-syntax.mjs`; `node tests/smoke/ps-bridge-skeleton.mjs`
  (65 checks: every tab, a base field saved, a blank f′c marked / counted / blocking, owner change to RIDOT sets H = 80 %, a strand row
  added / outside the girder / deleted, only psb2.* keys, 390 px with no sideways scroll on every input tab, 0 console errors).
### Open items
- Next: PR 2b-2 (Section properties, Loads & LLDF, Analysis output tabs with worked steps; values = engine values).

## 2026-11-12 — PR 2b-2: Section properties, Loads & LLDF and Analysis output tabs (steel style, worked steps; values = engine values)
PR #1452: https://github.com/mlococo88/All-Structural/pull/1452
### Where
- `apps/ps-bridge/engine/worked.js` (new, `window.PSBWorked`, no DOM): `section(inp, R)`, `loads(inp, R)`, `analysis(inp, R)` → `{ steps, pairs }`.
  Every step (shared/steps.js format: symbol → equation → values substituted → result) carries the engine's own value (R = computeAll of the
  design inputs); `pairs` = the step's expression evaluated from its substituted full-precision values against that engine value. Steps:
  gross section (y_t, S_b, S_t, w_g), E_c (Eq. 5.4.2.4-1), n, b_eff (4.6.2.6.1), transformed deck / haunch, A_c, y_bc, I_c, h_c, S_bc, S_tg,
  S_td, strands (N, A_ps, straight centroid, hold-down x = frac × L, draped slope, centroid and eccentricity at midspan, ℓ_t = 60 d_b);
  η and m, DC1 (self-weight, deck, haunch, total, diaphragms), DC2 / DW, HL-93 per lane (truck by search, tandem, lane, with IM; shears),
  e_g, K_g, g_M1/g_M2/g_V1/g_V2, exterior lever rule / e / rigid section, skew c_1 / r_M / shear correction, DF_M, DF_V, M_LL / V_LL per
  girder; moments at midspan (M_g, M_DC1 with diaphragms, M_DC2 / M_DW simple or w·M_w continuous, M_LL, M_DC, Strength I, Service I,
  Service III), shears at the support, the pier section (M_DC2,n, M_DW,n, M_LL,n, M_u,n) and the restraint moments (δ_1, δ_2, M_rc, M_res).
  These are the expressions of the moved engine written out for display: no new formula, nothing computed for a result.
- `apps/ps-bridge/ui/section.js`, `ui/loads.js`, `ui/analysis.js` (new; `PSBUiSection`, `PSBUiLoads`, `PSBUiAnalysis`): the three tabs in the
  steel app's layout (graphic card with stat tiles, key-value cards, tables, worked steps in topics with § links, links to the input tabs
  and between tabs). Section properties: the composite section graphic (the engine's outline and voids, haunch, deck, strands, the three
  centroids, read-out); Loads & LLDF: the bridge cross-section with the design girder, dead loads, HL-93 per lane, distribution factors;
  Analysis: moment and shear envelopes along the girder (the steel along-girder chart; station read-out and selection), the station table
  (every sixth engine station + the selected one), the selected station's effects, continuity (unit, pier moments, restraint table).
- `apps/ps-bridge/ui/outkit.js` (new, `PSBOutKit`): cards, `ev()` (every engine value on a tab is a `<span data-ev="R path">`), steps.
- `apps/ps-bridge/index.html`: loads `../../shared/steps.js` (first shared file of this app), the new files; `result()` = computeAll of
  `PSBDesign.inputs(P)` (cached by the inputs), shown only without input errors; an engine error blocks the tabs; Summary: the design
  girder's key values and the engine's design warnings; tab and step links.
### Copies from the Steel Bridge app (to move to shared/ later, CLAUDE.md §3)
- `apps/ps-bridge/ui/vizkit.js` = `apps/steel-bridge/ui/vizkit.js` at `28e1605`: namespace `PSBVizKit`, event `psb2:panelresize`,
  `PSBGraphics` (absent), detCard's Download DXF only when `o.dxf` is given (no DXF before PR 7).
- `apps/ps-bridge/ui/vizalong.js` = `apps/steel-bridge/ui/vizalong.js` at `28e1605`: namespaces `PSBVizAlong`, `PSBVizKit`, `PSBGraphics`,
  `PSBSub` (absent: text widths estimated, read-out as plain text), event `psb2:panelresize`.
### Shared files
- `shared/steps.js` is now loaded by `apps/ps-bridge/index.html` (unchanged; no shared file is changed by this PR).
### Governing provisions
- None changed (§4): the steps restate the moved engine's expressions; their values are the engine's. AASHTO LRFD 10th Ed. articles as
  cited on each step.
### Check case
- Default design (PCI BT-72, L = 120 ft, S = 9 ft, interior): b_eff = 12 × 9 = 108 in; A_d = 108 × 0.8345 × 8 = 721.0 in²; A_c = 767 + 721.0
  = 1488.0 in²; y_bc = (767 × 36.6 + 721.0 × 76.0) / 1488.0 = 55.691 in; I_c = 545,894 + 279,543 + 3,845 + 297,380 = 1,126,663 in⁴;
  DF_M = max(0.4904, 0.7191) = 0.7191; M_LL+IM = 0.7191 × 3652.4 = 2626.6 kip-ft; M_u (midspan) = 1.25(3983.6) + 1.50(450.0) + 1.75(2626.6)
  = 10,251.0 kip-ft (the screen values).
### How verified
- `node tests/engine/run.mjs psbridge-tabs` (new: 7 designs — simple / continuous with restraint, interior / exterior, skew 35°, haunch in
  the section, NEXT, box without topping, diaphragms, RIDOT / MassDOT, entered DF, entered LL — every step value finite, ids unique, every
  pair agrees to 1e-9; spot check that step values are R's numbers); `tex.test.mjs` parses every step's TeX with KaTeX.
- `node tests/smoke/ps-bridge-skeleton.mjs` (95 checks): on three designs every shown engine value (`data-ev`, ≥ 20 per tab) equals
  computeAll evaluated on the page; graphics and KaTeX steps drawn; a § link opens a step on another tab; the station choice; an input
  error blocks the three tabs; 390 px with no sideways scroll; 0 console errors under file://. `node tests/check-syntax.mjs`.
### Open items
- Next: PR 2c (Losses, Stresses, Flexure, Shear tabs; strand-pattern and stress graphics) with harness B against the old app.

## 2026-11-12 — PR 2c-1: Losses and Stresses output tabs, strand-pattern and stress graphics (steel style), check chips; browser harness B (no calculation change)
PR #1456: https://github.com/mlococo88/All-Structural/pull/1456
### Engineer-confirmed (2026-11-12, PS-15)
- The interim single design girder (`P.design`, engine/design.js, PR 2b-1) and the blocking errors for unequal bays and for different skews
  at the two supports of the design span stay until phase 3 (PR 3a). Recorded here as confirmed by the engineer; no change.
### Where
- `apps/ps-bridge/engine/worked-stress.js` (new, `window.PSBWorkedStress`, no DOM): `losses(inp, R)`, `stresses(inp, R)` → `{ steps, pairs, paths }`
  (shared/steps.js format; each step's value is the engine's; `pairs` = the expression evaluated from its substituted values against it;
  `paths` = where the value is in R). Losses: f_pbt, E_ci, M_g, the closed-form Δf_pES (Eq. C5.9.3.2.3a-1), f_pt, P_i, f_cgp; approximate
  (γ_h, γ_st, Eq. 5.9.3.3-1, Δf_pR) and refined (k_s, k_hs, k_hc, k_f, K_td, k_td^id/if/df, ε_bid, ε_bif, ψ_b ×3, K_id, Δf_pSR, Δf_pCR,
  Δf_pR1, e_pc, K_df, Δf_pSD, Δf_cd, Δf_pCD, Δf_pR2, Δf_pSS with its deck terms when computed, Σ) — both methods worked, the selected one
  used; total, %, f_pe; the elastic gains (C5.9.3.4.3) and f_pe with the permanent gains; the stages of strand row 1 (r_1, f_pt, f_pD, f_pe,
  forces). Stresses: the 5.9.2.3 limits; the fibre stress at the station where each check governs (release gross with P_i, or transformed
  with P at f_pbt (A_t, y_bt, I_t shown); Service top permanent / full, Service III bottom with γ_LL and m, deck top; restraint moment
  where the engine adds it) and each ratio; the 5.12.3.3.5 checks at an interior support (top tension Service III with the negative LL,
  T and A_s,req, bottom compression); Fatigue I (M_fat, DF_fat, M_fat,g, f_b,perm, Δf_b, f_b,min, 0.095√f′c, Δf_p, the concrete check);
  crack control (β_s, f_ss, s_max) when Service III cracks. Display intermediates the engine does not keep are named in their notes (the
  transformed section at a release station; ε_ddf, ψ_d, Δf_cdf of Δf_pSS; f_ss). No new formula: the expressions of the moved engine.
- `apps/ps-bridge/engine/worked.js`: `kit` records a step's R path (third argument of `add`); `kit`, `n`, `g`, `par` exported.
- `apps/ps-bridge/ui/losses.js` (new, `PSBUiLosses`): Losses tab — graphic card (tiles; loss components and strand stress through the
  stages, the steel bar chart), Prestress losses, Elastic gains, Strand force and stress by row and stage, Refined estimate, Approximate
  estimate, the strand pattern, worked steps in topics with § links. As the old app's Losses tab.
- `apps/ps-bridge/ui/stresses.js` (new, `PSBUiStresses`): Stresses tab — graphic card (tiles; release and service stresses along the
  girder with the limits and the governing stations, the steel along-girder chart; station choice), Governing stresses (every stress check
  with x, actual, limit, ratio, PASS / FAIL, § link), the selected station (choice; every fibre stress there) with the stress distribution
  on the girder section (stage Release / Service permanent / Service full; linear profile, neutral axis, limits, strands at the station),
  the tenth points table, the interior-support card (5.12.3.3.5), Fatigue I, Crack control, worked steps. As the old app's Stresses tab, plus
  the 5.12.3.3.5 checks the old app lists in its report.
- `apps/ps-bridge/ui/strands.js` (new, `PSBStrandGfx`): the strand-pattern graphic in the steel detail style — elevation (vertical scale
  exaggerated): ℄ bearings, girder ends, straight rows (debonded lengths dashed), the draped strands labelled "draped", the two hold-down
  points at frac × L_span from ℄ bearing, dimensioned (PS-5, PS-13); sections at ℄ bearing and at midspan (debonded strands hollow,
  draped strands as pairs about their centroid y_end / y_mid). On the Girders & strands input tab (replacing its placeholder) and the Losses tab.
- `apps/ps-bridge/ui/dash.js`: the check summary chips (the steel dash pattern): Release stresses, Service stresses, Fatigue I — each the
  governing engine ratio (R.checks c.r) of its checks with PASS / FAIL, ▸ lists each check; a chip or a check opens its tab and the worked
  step of the value; the head counts FAIL / PASS; the groups not built yet stay "not run" with their PR (Flexure, Shear: 2c-2).
- `apps/ps-bridge/index.html`: loads the new files; result() makes the Losses and Stresses steps; the two tabs replace their
  placeholders; the strand pattern on the Girders & strands tab; output-tab choices of every tab (`onOutChange`); the chips' step links.
### Copies from the Steel Bridge app (to move to shared/ later, CLAUDE.md §3)
- None new in this PR. Used: the copies of PR 2b-2 (`ui/vizkit.js`, `ui/vizalong.js` from `apps/steel-bridge/ui/` at `28e1605`) and the
  adapted `ui/dash.js` (chip markup and CSS of `apps/steel-bridge/ui/dash.js`).
### Shared files
- None changed. `shared/steps.js` loaded as before.
### Governing provisions
- None changed (§4): no formula, factor, unit or reference of the engine; the steps restate the moved engine's expressions with its values.
  AASHTO LRFD 10th Ed. articles as cited on each step (5.9.3, 5.9.2.3, 5.12.3.3.5, 5.5.3, 5.6.7).
### Check case
- Default design (PCI BT-72, L = 120 ft, 40 strands 0.6 in, refined losses), values on the tab: f_pbt = 0.750 × 270 = 202.50 ksi;
  E_ci = 120,000(1.0)(0.145)²(6.80)^0.33 = 4,749 ksi; M_g = 0.8256 × 120² / 8 × 12 = 17,833 kip-in; I_g + e_m²A_g = 545,894 + 31.5² × 767
  = 1,306,950 in⁴; Δf_pES = (8.680 × 202.50 × 1,306,950 − 31.5 × 17,833 × 767) / (8.680 × 1,306,950 + 767 × 545,894 × 4,749 / 28,500)
  = 23.01 ksi; Δf_pLT (refined) = 5.300 + 16.605 + 1.129 + 1.956 − 0.052 + 1.129 − 1.257 = 24.810 ksi; f_pe = 202.50 − 23.01 − 24.81 = 154.68 ksi.
  Release compression at x = 48.0 ft: 1558.0/767 + 1558.0 × 31.5/14,915 − 17,119/14,915 = 4.174 ksi ≤ 0.65 × 6.80 = 4.420 (ratio 0.944).
  Service III bottom at midspan: 1342.6/767 + 1342.6 × 31.5/14,915 − 41,323/14,915 − (11,880 + 0.80 × 31,519)/20,231 = −0.018 ksi (ratio 0.033).
### How verified
- `node tests/engine/run.mjs psbridge-tabs` (9 designs, cases now in `tests/engine/psbridge-tab-cases.mjs`: + approximate losses with the
  transformed release section, severe corrosion, bonded release steel, entered fatigue DF and Δf_pSS; + a cracked design made continuous
  with top steel): every pair agrees to 1e-9, every step with a path holds R's value exactly (Object.is); `tex.test.mjs` parses every step.
- **Harness B** (new, `node tests/psbridge-compare.mjs`): the 9 designs; the new app on each project, the old `Prestressed Bridge Design.html`
  (frozen) on the same engine inputs (its stored inputs read back equal on every design): **2,674 values shown on the Losses and Stresses
  tabs and 850 step values = the old app's computeAll values, 0 differences** (text as formatted, numbers exact); a seeded `psbeam.*` key
  byte-identical, only `psb2.*` keys written; 0 console errors. `--control` (a 1e-9 change) is reported as a difference.
- `node tests/smoke/ps-bridge-skeleton.mjs` (120 checks): on three designs every value shown on Losses and Stresses (data-ev) = computeAll
  on the page, ≥ 2 graphics, KaTeX steps; the chips' ratios = the engine's; a chip opens the step; the station and stage choices; the strand
  pattern on the input tab (draped, hold-down at 0.400 L); 390 px with no sideways scroll on both tabs and the strand pattern; 0 console
  errors under file://. `node tests/check-syntax.mjs`.
### Open items
- Old app display (frozen, not changed): its Losses tab shows "f_pe with permanent gains credited" as f_pe + Δf_p,perm + Δf_pSS, adding the
  deck shrinkage gain that the refined Δf_pLT already subtracts; the new tab shows the engine's `fpeGain` = f_pe + Δf_p,perm (DC1 + DC2/DW
  gains). No check uses either value. For the engineer: confirm the old display double-counts Δf_pSS (refined method).
- Old app display: the old stress derivation always wrote the gross-section release expression, also when the transformed section is used;
  the new steps write the transformed expression (A_t, y_bt, I_t) the engine uses.
- Next: PR 2c-2 (Flexure and Shear tabs, the pier negative-moment resistance and the positive moment connection; chips; harness B).

## 2026-11-12 — PR 2c-2: Flexure and Shear output tabs (pier negative-moment resistance, positive moment connection), check chips; harness B (no calculation change)
PR #1457: https://github.com/mlococo88/All-Structural/pull/1457
### Where
- `apps/ps-bridge/engine/worked-strength.js` (new, `window.PSBWorkedStrength`, no DOM): `flexure(inp, R)`, `shear(inp, R)` → `{ steps, pairs, paths }`.
  Flexure: M_u at midspan (η, m, restraint where added), β_1, d_p, c (rectangular Eq. 5.6.3.1.1-4 or flanged -3; developed tension where the
  strand is not developed), a, f_ps, M_n, ε_t, φ (Eq. 5.5.4.2-2), φM_n, the governing ratio; minimum reinforcement (f_r, f_cpe, M_cr Eq.
  5.6.3.3-1, min(M_cr, 1.33 M_u) at midspan and at the governing station, ratio). Made continuous: the pier's LL per lane (truck or tandem +
  lane, two trucks at 90 %, governing), M_LL,n = −DF_M M_LL,lane, M_u,n, d, a, β_1, c, ε_t, φ (Eq. 5.5.4.2-1), M_n, φM_n, ratio; the positive
  moment connection (M = M_res + M_DC2 + M_DW + m M_LL+, T = 0.9M/(0.9h_c), A_s,req = T/36, f_s and the ratio with A_s,pos entered).
  Shear at the critical section: x, d_p and a (the engine's flexure() at x: display intermediate), d_v, V_u (components; simple span:
  display intermediates), V_p, |M_u|, ε_s (Eq. 5.7.3.4.2-4; recomputed with E_cA_ct when negative), β, θ, V_c, V_s, V_n, the ratio, the
  governing ratio; v_u, s_max, s_Av,min, s_max,gov; the tie T and T_r (Eq. 5.7.3.5-1) and the governing ratio; interface v_ui, A_vf,req,
  A_vf,min, A_vf, the governing ratio; ℓ_t, ℓ_d bonded and debonded.
- `apps/ps-bridge/ui/flexure.js` (new, `PSBUiFlexure`): Flexure tab — graphic card (tiles; M_u against φM_n along the girder, −M_u and the
  pier −φM_n when continuous, the unfactored components on a second row (chips)), Strength I flexure, Minimum reinforcement, the flexure
  stations (twentieth points to midspan, † where not developed), Negative moment at the pier (with the pier section graphic: deck bars,
  compression block in the bottom flange), Positive moment connection (with the RIDOT 1.2 M_cr report item when the owner rule applies),
  worked steps. As the old app's Flexure tab plus the connection (old: Continuity input card and report).
- `apps/ps-bridge/ui/shear.js` (new, `PSBUiShear`): Shear tab — graphic card (tiles; V_u, φV_n, φ(V_c + V_p) along the girder, the design
  stations), governing values, Section-by-section design, the longitudinal tie table, Strand development, Interface shear table, worked
  steps. As the old app's Shear tab.
- `apps/ps-bridge/ui/dash.js`: the Flexure (flexure, minimum reinforcement, pier, connection) and Shear (shear, tie, interface) chips.
- `apps/ps-bridge/index.html`: loads the new files; result() makes the Flexure and Shear steps; the two tabs replace their placeholders.
### Copies from the Steel Bridge app (to move to shared/ later, CLAUDE.md §3)
- None new (the PR 2b-2 copies `ui/vizkit.js`, `ui/vizalong.js` of `apps/steel-bridge/ui/` at `28e1605` are used).
### Shared files
- None changed.
### Governing provisions
- None changed (§4). AASHTO LRFD 10th Ed. articles as cited on each step (5.6.3, 5.6.3.3, 5.5.4.2, 5.12.3.3, 5.12.3.3.8a, 5.7.2, 5.7.3,
  5.7.3.5, 5.7.4, 5.9.4.3).
### Check case
- Default design (PCI BT-72, L = 120 ft): M_u = 1.25(17,833 + 23,490 + 6,480) + 1.50(5,400) + 1.75(31,519) = 123,012 kip-in; c = 8.680 × 270 /
  (0.85 × 4.00 × 0.850 × 108 + 0.28 × 8.680 × 270/74.90) = 7.30 in; f_ps = 270(1 − 0.28 × 7.304/74.90) = 262.6 ksi; M_n = 8.680 × 262.63 ×
  (74.90 − 6.208/2) = 163,667 kip-in; φ = 1.0; ratio 0.752. Shear at x = 5.41 ft: d_v = max(61.06 − 4.285/2, 0.9 × 61.06, 0.72 × 80) = 58.92 in;
  V_u = 1.25(45.07 + 59.37 + 16.38) + 1.50(13.65) + 1.75(106.95) = 358.65 kip; V_p = 36.36 kip; ε_s = −0.000400 (recomputed, limited);
  β = 6.857, θ = 27.60°; V_c = 223.32, V_s = 450.78, V_n = 710.46 kip; V_u/φV_n = 0.561 (governing 0.721 at x = 30.0 ft).
### How verified
- `node tests/engine/run.mjs psbridge-tabs` (10 designs, + a flanged-flexure design made continuous with a positive restraint moment and
  connection steel): every pair to 1e-9, every path value exact; `tex.test.mjs`.
- **Harness B** (`node tests/psbridge-compare.mjs`, now Losses, Stresses, Flexure, Shear): 10 designs, **9,187 values shown and 1,474 step
  values = the old app's computeAll values, 0 differences**; `psbeam.*` untouched; 0 console errors.
- `node tests/smoke/ps-bridge-skeleton.mjs` (136 checks: Flexure and Shear on three designs, the pier graphic on the continuous one, the
  chips, 390 px), `node tests/check-syntax.mjs`.
### Open items
- Next: PR 2d (End zone & hold-down, Camber & deflection, Handling, Deck, Rating tabs; their chips; harness B on them).

## 2026-11-13 — PR 2d-1: End zone & hold-down and Camber & deflection output tabs, check chips; harness B (no calculation change)
PR #1458: https://github.com/mlococo88/All-Structural/pull/1458
### Where
- `apps/ps-bridge/engine/worked-end.js` (new, `window.PSBWorkedEnd`, no DOM): `endzone(inp, R)`, `camber(inp, R)` → `{ steps, pairs, paths }`.
  End zone: P_i, 0.04 P_i, A_s,req = 0.04 P_i/20, h/4 (h = overall height, or width of a slab), A_s,prov = n A_v, P_r = 20 A_s,prov, legs needed,
  the ratio (5.9.4.4.1); confinement d_b, the size / spacing / extent ratios, 1.5d, (n − 1)s, bars needed, governing (5.9.4.4.2; not for box and
  slab beams); the bonded release-tension steel f_s = min(0.5f_y, 30), T_top, T_bot (the engine's integration, named in the note), A_s,req, ratio
  (5.9.2.3.1b, where claimed); the draped-strand slope; where the owner rule applies (MassDOT 3.7.2.2, CTDOT V2 5.9.1.6) α, F_str = f_pbt A_b sin α,
  F_hd = 2 n_h F_str, L_g, W = w_sw L_g, 0.75 W and the ratio; debonding: ℓ_d (κ = 2.0), the owner share (CTDOT), and as display intermediates the
  share without an owner rule and the simple-span limit min(0.20L, L/2 − ℓ_d) of 5.9.4.3.3(G) (an engine warning). Camber: P_s, e_s, Δ_ps,s,
  P_h, e_hm, e_he, a, Δ_ps,h, Δ_ps, Δ_sw, Δ_dk, Δ_dia, Δ_sd, Δ_rel, Δ_erect, Δ_deck, Δ_seat, Δ_final (PCI multipliers), Δ_LL, L/800 (or the
  MassDOT L/1000 / L/800), the ratio, the haunch build-up at midspan. No new formula: the expressions of the moved engine (computeAll, psbReportVals).
- `apps/ps-bridge/ui/endzone.js` (new, `PSBUiEndZone`): End zone & hold-down tab — graphic card (tiles; the end-zone ratios against 1.0, the steel
  bar chart), Splitting / bursting, Confinement (table of the three limits), Bonded release-tension steel, Draped strands and the hold-down force
  (geometry; the owner check where it applies; for AASHTO / RIDOT the note that the optional PS-10 check comes in PR 2d-3; the engine's hold-down
  warnings) with the half-span hold-down graphic (force arrow n_h F_str where computed), Debonded strands (row table, ℓ_d, owner share, the
  5.9.4.3.3 warnings of the engine), the girder-end elevation (true scale: splitting legs within h/4, confinement bars and 1.5d, ℓ_t, strands,
  debonded lengths, ℄ bearing; steel detail kit), worked steps. As the old app's Anchorage Zone tab plus the hold-down and debonding
  (old: report and warnings).
- `apps/ps-bridge/ui/camber.js` (new, `PSBUiCamber`): Camber & deflection tab — graphic card (tiles; camber by stage and the elastic
  components, bar chart), Net camber by stage (what each is used for), Elastic components, Live-load deflection, camber and haunch build-up
  along the girder (steel along-girder chart), the tenth-point haunch / seat table, worked steps. As the old app's Camber tab.
- `apps/ps-bridge/ui/dash.js`: the End zone & hold-down chip (splitting, confinement, release steel, owner hold-down, owner debonded share)
  and the Camber & deflection chip (LL deflection).
- `apps/ps-bridge/index.html`: loads the new files; result() makes the two tabs' steps; the two tabs replace their placeholders.
### Copies from the Steel Bridge app (to move to shared/ later, CLAUDE.md §3)
- None new (the PR 2b-2 copies `ui/vizkit.js`, `ui/vizalong.js` are used).
### Shared files
- None changed.
### Governing provisions
- None changed (§4). AASHTO LRFD 10th Ed. 5.9.4.4.1, 5.9.4.4.2, 5.9.2.3.1b, 5.9.4.3.2, 5.9.4.3.3, 2.5.2.6.2; PCI Design Handbook camber
  multipliers; MassDOT 3.7.2.2 / CTDOT V2 5.9.1.6 (hold-down), CTDOT V2 5.9.4.3.3 (debonded share), MassDOT 3.5.6.1 (LL deflection) as in the
  moved engine's owner rules.
### Check case
- Default design (PCI BT-72, L = 120 ft, 40 strands 0.6 in, 12 draped): P_i = 8.680 × 179.49 = 1,558.0 kip; 0.04 P_i = 62.3 kip; A_s,req = 62.32/20
  = 3.12 in²; A_s,prov = 12 × 0.31 = 3.72 in²; P_r = 74.4 kip; ratio 0.838. Confinement No. 4 at 6.00 in, 19 bars: extent 108.0 in = 1.5 × 72.0,
  spacing ratio 1.000 (governing). Camber: Δ_ps = 4.388 in, Δ_sw = 1.486 in, Δ_dk = 1.818 in, Δ_sd = 0.446 in; Δ_erect = 1.80(4.388) − 1.85(1.486)
  = 5.150 in; Δ_deck = 5.150 − 1.818 = 3.332 in; Δ_seat = 2.886 in; Δ_final = 0.570 in; Δ_LL = 1.182 in ≤ L/800 = 1.800 in (0.657).
- MassDOT on the same design (the engine's owner check): tan α = (60 − 8)/(12 × 0.40 × 120) = 0.09028, α = 0.09003 rad, F_str = 202.50 × 0.217 ×
  sin α = 3.951 kip, F_hd = 2 × 12 × 3.951 = 94.8 kip; W = 0.82559 × 120.00 = 99.1 kip; 0.75 W = 74.3 kip; ratio 1.276 FAIL (as PENDING.md).
### How verified
- `node tests/engine/run.mjs psbridge-tabs` (11 designs, + CTDOT with debonded rows on an I-girder, diaphragms and the girder end past ℄ bearing;
  + the MassDOT hold-down spot check): every pair to 1e-9, every path value exact; `tex.test.mjs`; `psbridge` (model, verbatim, parity 0
  differences), `project-registry`.
- **Harness B** (`node tests/psbridge-compare.mjs`, now Losses, Stresses, Flexure, Shear, End zone & hold-down, Camber & deflection): 11 designs,
  **11,575 values shown and 2,086 step values = the old app's computeAll values, 0 differences**; `psbeam.*` untouched; 0 console errors.
- `node tests/smoke/ps-bridge-skeleton.mjs` (154 checks: the two tabs on three designs, ≥ 2 graphics and KaTeX each, the chips, a chip opens
  its step, 390 px without sideways scroll, file://, 0 console errors), `node tests/check-syntax.mjs`.
### Open items
- The hold-down limit for AASHTO / RIDOT (PS-10) is an engine addition: PR 2d-3 (own §4 callout).
- Next: PR 2d-2 (Handling, Deck, Rating tabs; their chips; harness B).

## 2026-11-13 — PR 2d-2: Handling, Deck and Rating output tabs, check chips; harness B (no calculation change)
PR #1460: https://github.com/mlococo88/All-Structural/pull/1460
### Where
- `apps/ps-bridge/engine/worked-hdr.js` (new, `window.PSBWorkedHDR`, no DOM): `handling(inp, R)`, `deck(inp, R)`, `rating(inp, R)` → `{ steps, pairs, paths }`
  (no steps for Handling / Deck when their module is off). Handling (handlingCalc): w, per stage (lifting, hauling) L_s = L − 2a, M_sup = −wa²/2,
  M_mid = wL_s²/8 − wa²/2, the four fibre stresses P/A ∓ Pe/S ± 12M/S (P = A_ps f_pi and e at midspan and at the support: display
  intermediates of the engine's strand profile), f_c,lim = c f′ci, f_t,lim = 0.24√f′ci, the lifting-stress ratio; I_y (flange and web
  rectangles), z_o (Mast form) for lifting and hauling, FS_cr,lift = y_t/(z_o + e_i), y_r,h = h_r + y_b (display), FS_cr,haul = y_r,h/(z_o,h + e_i +
  y_r,h θ_i), the two FS ratios 1/FS. Deck (deckCalc): w_DC, w_DW, M_DC/DW = wS²/11 and wS²/10, the design section x (4.6.2.1.6: b_tf/3 ≤ 15 in,
  closed box b/2, or entered; 0–24 in), M_LL,+ and M_LL,− interpolated in Table A4-1 (the engine's table rows and columns shown), M_u (η and the
  owner live-load multiplier where the owner sets them), for the bottom and top bars A_s, d, a, c (β_1 display), ε_t, φ (Eq. 5.5.4.2-1), M_n,
  φM_n, ratio; overhang X, 45 + 10X, M_DC,oh, M_DW,oh, M_LL,oh = 1.33(1.20)(16)X/(SW/12), M_u,oh, φM_n,oh, ratio; distribution % = min(220/√S, 67).
  Rating (computeAll): φ_cφ_s = min(max(φ_cφ_s, 0.85), 1.0); flexure at the governing station φM_n, M_DC = M_g + M_DC1 + M_DC2, M_DW, M_LL+IM,
  RF_inv (γ_LL 1.75), RF_opr (1.35), RF_inv at midspan; shear φV_n = φ_v V_n, V_DC, V_DW, V_LL+IM, RF_inv, RF_opr; Service III f_ps, f_DC, f_DW, f_LL,
  f_r, RF = (f_r + f_ps − f_DC − f_DW)/(0.8 f_LL); each entered vehicle RF_M, RF_V, RF, RT. No new formula: the expressions of the moved engine.
- `apps/ps-bridge/ui/handling.js` (new, `PSBUiHandling`): Handling tab — graphic card (tiles; the check ratios and the lifting / hauling fibre
  stresses, steel bar chart), Lifting and Hauling stress tables (moments, fibre stresses, limits), Lateral stability (screening) with the
  old app's "not PCI / Mast" warning, the girder-on-supports elevation with its moment (Lifting / Hauling switch; steel detail kit), worked steps.
  Off: a card linking to the Loads tab input.
- `apps/ps-bridge/ui/deck.js` (new, `PSBUiDeck`): Deck tab — graphic card (tiles; ratios, M_u against φM_n), interior-bay moments table, Strength I
  resistance table (positive, negative, overhang), Overhang, Distribution reinforcement, the deck section over the design girder (barrier, design
  wheel, design sections, bars; steel detail kit), worked steps. Off: a card linking to the Diaphragms / deck tab.
- `apps/ps-bridge/ui/rating.js` (new, `PSBUiRating`): Rating tab — graphic card (tiles; RF bars against 1.0), Condition and system factors, Flexure,
  Shear, Service III, Legal / permit vehicles table, the rated sections along the span, worked steps. MBE citations as the old app (article
  numbers, no edition) so that harness B compares like with like; **the MBE 4th Ed. (2026) labels are their own PR (plan PR 6, PS-14 e)**. The old
  tab's "Send capacity to MCT Rating" hand-off is not on this tab (cross-tool connections move with the switch-over).
- `apps/ps-bridge/ui/dash.js`: Handling and Deck chips (the engine's checks; "off" with a link to the input when the module is off) and a Rating
  chip (the lowest HL-93 inventory RF of flexure, shear and Service III; RF ≥ 1 / RF < 1; not an engine check and not counted in the totals).
- `apps/ps-bridge/index.html`: loads the new files; result() makes the three tabs' steps; the three tabs replace their placeholders; the dash
  "off" chip opens its input tab.
### Copies from the Steel Bridge app (to move to shared/ later, CLAUDE.md §3)
- None new (`ui/vizkit.js`, `ui/vizalong.js` of PR 2b-2 used).
### Shared files
- None changed.
### Saved data
- None changed (no new key or field; `psb2.*` only, `psbeam.*` untouched: harness B).
### Governing provisions
- None changed (§4). AASHTO LRFD 10th Ed. 5.9.2.3.1a, Table 5.9.2.3.1b-1, Table 5.9.2.3.2b-1, 4.6.2.1.6, Table A4-1, Table 4.6.2.1.3-1, 3.6.1.3.1,
  5.6.3, Eq. 5.5.4.2-1, 9.7.3.2, Table 3.4.1-1; MBE Eq. 6A.4.2.1-1, Eq. 6A.4.2.1-3, Table 6A.4.2.2-1, 6A.4.2.3, 6A.4.2.4, 6A.4.4, 6A.4.5, 6A.5.4.1, 6A.5.6
  (old app labels); PCI / Mast (screening) as the moved engine.
### Check case
- Default design (PCI BT-72, L = 120 ft, 40 strands 0.6 in, f′ci = 6.8 ksi), Handling and Deck on, vehicle Type 3S2 (M 1,800 kip-ft, V 90 kip, 36 ton):
  lifting a = 4 ft: L_s = 112 ft, M_mid = 0.8256(112)²/8 − 0.8256(4)²/2 = 1,287.9 kip-ft; P = 8.68 × 179.49 = 1,558.0 kip, e = 31.50 in;
  f_t,mid = 1,558.0/767 − 1,558.0(31.50)/15,421 + 12(1,287.9)/15,421 = −0.149 ksi; 0.24√6.8 = 0.626 ksi; ratio 0.238. I_y = 50,344 in⁴,
  z_o = 7.209 in, FS_lift = 35.40/(7.209 + 0.25) = 4.75. Deck S = 9 ft, t_s = 8 in: w_DC = 0.100 ksf, M_DC,+ = 0.100(81)/11 = 0.736, M_LL,+ = 6.29
  (Table A4-1, S = 9.0 ft), M_u,+ = 1.25(0.736) + 1.50(0.184) + 1.75(6.29) = 12.20 kip-ft/ft; No. 5 bars (0.31 in²) at 6 in: A_s = 0.62 in²/ft, d = 8 − 1
  − 0.628/2 = 6.686 in, a = 0.912 in, φ = 0.90, φM_n = 17.38 kip-ft/ft, ratio 0.702. Rating: x = 58.0 ft, RF_inv = (13,638.9 − 1.25 × 3,979.1 −
  1.50 × 449.5)/(1.75 × 2,628.7) = 1.737, RF_opr = 2.252; shear x = 30.01 ft RF_inv = 1.635; Service III RF = (0.554 + 4.586 − 3.091 − 0.267)/(0.8 ×
  1.558) = 1.430; Type 3S2: RF_V = (334.6 − 1.25 × 66.37 − 1.50 × 7.50)/90 = 2.670 (governs), RF_M = 4.436, rated 96.1 ton.
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry` (59 tests): tabs on 14 designs (+ Handling and Deck on with vehicles and φ_cφ_s floored;
  + MassDOT continuous exterior with an entered design section, a wide overhang and moved handling supports; + a box beam with a topping and
  S below Table A4-1): every pair to 1e-9, every path value exact (Object.is); model, verbatim, parity harness A 0 differences; every step parsed
  with KaTeX. `node tests/check-syntax.mjs`.
- **Harness B** (`node tests/psbridge-compare.mjs`, all nine tabs): 14 designs, **15,559 values shown and 3,125 step values = the old app's
  computeAll values, 0 differences**; `psbeam.*` untouched; 0 console errors.
- `node tests/smoke/ps-bridge-skeleton.mjs` (187 checks): Rating on four designs; Handling and Deck "off" (card, chip) until turned on, then
  ≥ 20 values = computeAll, ≥ 2 graphics, KaTeX; the chips (Rating = the lowest inventory RF); the Rating and Handling chips open their steps;
  the handling stage switch; blocked by an input error; 390 px without sideways scroll on all twelve result tabs; file://, 0 console errors.
### Open items
- Old app behaviour kept and stated on the tabs (engine unchanged, §4): no hauling stress check (stresses shown), no compression check in
  handling (limit shown), handling stresses on the span L (not the girder length with its ends past the bearings), the deck strip method and
  coefficients (PS-14 a), the rating at the governing positive-moment section only (no pier region, no restraint moments).
- MBE 4th Ed. (2026) citation labels: plan PR 6 (PS-14 e).
- Next: PR 2d-3 (PS-10 hold-down check for AASHTO / RIDOT, engine addition with a §4 callout).

## 2026-11-13 — PR 2d-3: PS-10 hold-down force check for AASHTO / RIDOT projects (ENGINE ADDITION, §4)
PR #1461: https://github.com/mlococo88/All-Structural/pull/1461
### §4 callout (a new check; no existing formula, factor or value changed)
- **Before:** AASHTO and RIDOT projects: **no hold-down force check** (the moved engine checks it only for MassDOT 3.7.2.2 and CTDOT V2
  5.9.1.6, `pbd-compute.js` "Hold-down force of all draped strands"). MassDOT / CTDOT: F_hd = 2·n_h·f_pbt·A_b·sin α ≤ 0.75 W (unchanged).
- **After:** AASHTO and RIDOT projects with draped strands: **2·n_h·f_pbt·A_b·sin α ≤ f·W**, f = `base.opt.hdFrac` (default **0.75**, editable),
  when the box `base.opt.hdCheck` is on (default **on**); α = atan((y_end − y_mid)/(12·frac·L)), f_pbt = jack × f_pu (at jacking, before
  transfer), W = w_sw·(L + 2 e_end/12). Check name "Hold-down force (PS-10)", PASS when the ratio ≤ 1.0001 (as every engine check).
- **Basis:** engineer decision PS-10 (2026-11-12, plan §6). AASHTO LRFD 10th Ed. (2024) sets **no** limit on the hold-down force; the 75 %
  of the beam weight is the rule of MassDOT LRFD Bridge Manual 3.7.2.2 and CTDOT Bridge Design Manual V2 5.9.1.6 (as cited by the moved
  engine's owner rules), applied here as an option.
- **Worked check case** (default project: PCI BT-72, L = 120 ft, AASHTO, 12 draped 0.6 in strands, y_end = 60 in, y_mid = 8 in, frac = 0.40,
  f_pbt = 0.75 × 270 = 202.50 ksi, A_b = 0.217 in², w_sw = 0.82559 klf, girder end at ℄ bearing):
  tan α = (60 − 8)/(12 × 0.40 × 120) = 0.090278, α = 0.090033 rad, sin α = 0.089911; F_str = 202.50 × 0.217 × 0.089911 = 3.9509 kip;
  F_hd = 2 × 12 × 3.9509 = **94.8 kip**; L_g = 120.00 ft, W = 0.82559 × 120 = 99.07 kip; limit 0.75 × 99.07 = **74.3 kip**; ratio 94.8/74.3 =
  **1.276 FAIL**. Before: no check (the default AASHTO design showed no hold-down failure); after: FAIL 1.276, the same numbers as the MassDOT
  owner check on this design (PENDING.md, "94.8 vs 74.3 kip", confirmed). With f = 0.90: limit 89.2 kip, ratio 1.063.
### Where
- `apps/ps-bridge/engine/holddown.js` (new, `window.PSBHoldDown`): `apply(inp, R)` after `computeAll` adds `R.ps10` and the check at the end of
  `R.checks` (the moved `pbd-*.js` files are not touched: verbatim and parity harness A unchanged); `compute(inp)`; used by `index.html`
  result(), the tab tests, the smoke test and harness B. No check when the owner has its own rule (MassDOT, CTDOT), when there are no draped
  strands, or when the box is off (`R.ps10 = { off: true }`).
- `apps/ps-bridge/engine/model.js` `baseInputs()`: fills `base.opt.hdCheck = true` and `base.opt.hdFrac = 0.75` when absent.
- `apps/ps-bridge/engine/fields.js`: Owner rules card "Hold-down force limit (PS-10)" (shown for AASHTO and RIDOT): the box and the fraction.
  `ui/inputs.js`: the PR 2d placeholder removed; the Project tab assumption updated.
- `apps/ps-bridge/engine/worked-end.js`, `ui/endzone.js`: the hold-down steps, card, tile and graphic from `R.ps10` for AASHTO / RIDOT (as for the
  owner check); with the box off the tab says the force is not checked. `ui/dash.js`: the check in the End zone & hold-down chip.
### Saved data (CLAUDE.md §5)
- New fields inside the psb2 project (no new storage key): `base.opt.hdCheck` (boolean), `base.opt.hdFrac` (number). **Migration:** a new
  project and every existing psb2 project read without them get the check **ON** at **0.75** (filled by `baseInputs` on import / load); a value
  the user saved is kept. Old app keys (`psbeam.*`) untouched.
### Before / after (code)
- `engine/model.js` baseInputs, anchor `JSON.parse(JSON.stringify(mergeInputs(`: before `return JSON.parse(JSON.stringify(mergeInputs(…)));`;
  after the same copy, then `if (b.opt.hdCheck === undefined) b.opt.hdCheck = true; if (b.opt.hdFrac === undefined) b.opt.hdFrac = 0.75;`.
- `index.html` result(), anchor `RC.key !== key`: before `R = computeAll(JSON.parse(key))`; after `R = window.PSBHoldDown.compute(JSON.parse(key))`.
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry`: the hand check above to 1e-12 and as shown (94.8, 99.1, 74.3, 1.276), the engine's own
  checks unchanged with one check appended, f = 0.90, RIDOT, box off, MassDOT / CTDOT keep their own rule only, no draped strands; migration
  (a project without the fields reads ON / 0.75; saved false / 0.6 kept; a PR 1 project); tabs on 16 designs (+ RIDOT with f = 0.90 and the girder
  end 6 in past the bearing; + AASHTO with the box off); parity harness A 0 differences; `node tests/check-syntax.mjs`.
- **Harness B** (`node tests/psbridge-compare.mjs`): 16 designs, all tabs: 17,800 shown values and 3,592 step values (144 of them PS-10); the PS-10 values compared with hand values worked in the
  harness from the inputs and the old app's f_pbt, A_b, w_sw (1e-12 and as shown), every other value with the old app exactly: 0 differences.
- `node tests/smoke/ps-bridge-skeleton.mjs` (191 checks): the box on by default (0.75), the check worked on the End zone tab and listed in its
  chip, the box off removes it and is saved; file://, 1400 and 390 px, 0 console errors.
### Open items
- The default project (BT-72, 12 draped strands) now shows the hold-down FAIL under AASHTO, as under MassDOT / CTDOT (real result; the default
  design is not changed). Auto-design (PR 5) uses this limit as a constraint (plan §4).

## 2026-11-13 — PR 2e: Report tab (steel-style report of every result tab, check summary, assumptions); harness B on the Report (no calculation change)
PR #1463: https://github.com/mlococo88/All-Structural/pull/1463
### Where
- `apps/ps-bridge/report/fromtab.js` (new, `window.PSBReportTab`, no DOM): reads the HTML a result tab's `output(ctx)` makes (the same function,
  inputs and engine result as on screen) with a small parser for the app's own HTML and turns its cards into `shared/report.js` items:
  `div.kv` → kv, `table.tbl` → table (header rows with rowspan / colspan joined per column), `p.note` / `.alert` → note; `<span data-ev>`
  → the value's text, recorded `{ sec, path, d, div, text }`; `a.wk` (a link to a worked step) → "(see §x.y)"; a link to another tab →
  an in-app link plus "(§n)" of that section; a link to an input tab → an in-app link; `<sub>` / `<sup>` → `$_{…}$` / `$^{…}$`. Skipped:
  graphics slots (`#gfx_…`), the controls (`.fRow`), and the tab's own worked-steps list (the builder puts the steps there).
- `apps/ps-bridge/report/data.js` (new, `window.PSBReportData`): `compute(P, rc)`: the page's own result (index.html `result()`: inputs,
  `PSBHoldDown.compute`, the worked steps of every tab) when given, else the same calls; an input error builds nothing.
- `apps/ps-bridge/report/builders.js` (new, `window.PSBReportBuild`): `model(B, { include })`, 14 numbered sections: 1 Summary of checks
  (every engine check `R.checks` with x, demand, limit, ratio, PASS / FAIL and "see §" to the step that works it, from the check-summary
  groups of `ui/dash.js`; the owner's material limits link to the Owner rules table of §2; the HL-93 inventory rating factors; key quantities
  as in the old report; the engine's warnings), 2 Project, basis and assumptions (title block data, the bridge and the design girder, the
  basis, the Project tab's assumptions plus the report's: handling, deck strip method, rating section and MBE labels, PS-10, continuity; the
  Owner rules cards), 3–14 the result tabs (Section properties, Loads & LLDF, Analysis, Prestress losses, Stresses, Flexure, Shear, End zone
  & hold-down incl. PS-10, Camber & deflection, Handling, Deck, Rating): each tab's cards (fromtab.js) and its worked steps (the same step
  objects as on the tab, in the tab's TOPICS). Step anchors use the step ids (unique across the app), so a step note "§id" of one tab
  finds its step in another. A section left out (chip) leaves "(section not included)" where another section linked into it. Every number
  the builder writes itself goes through `V(path, d, div)` = `PSBOutKit.fx` of the R value (the tabs' format) and is recorded in `model.vals`.
- `apps/ps-bridge/ui/report.js` (new, `window.PSBReportUI`): the Report tab: the shared viewer (`shared/report.js` mount: contents, numbered
  sections, search, expand / collapse, Print report), section chips; built when the tab opens and kept while the inputs and the chips are
  the same.
- `apps/ps-bridge/index.html`: loads `../../shared/report.js`, `report/fromtab.js`, `report/data.js`, `report/builders.js`, `ui/report.js`
  (the PR 1 placeholder `report/sections.js`, `window.PSBReportPlan`, removed); the Report tab mounts the report in `#rptHost` (anchor
  `ui.otab === 'rpt'`; before: the placeholder card "Planned sections"); CSS copied from the steel app (report sized to the output panel; Ctrl+P
  on the Report tab prints the report only) plus `#out>:not(#rptHost)` hidden in that print; the "In development" note names PR 2e.
- `apps/ps-bridge/ui/loads.js` (display): the "DC1 deck slab" row links to its step only when the step exists. Anchor `row('DC1 deck slab'`;
  before `wk('ld.wdeck')`; after `cp.wdkDeck > 0 || +inp.ts > 0 ? wk('ld.wdeck') : ''` (the step is made under that condition in
  `engine/worked.js`; a box beam without topping had a link to nothing on the tab, and a "§?" in the report).
### Copies from the Steel Bridge app (to move to shared/ later, CLAUDE.md §3)
- `report/builders.js`: adapted from `apps/steel-bridge/report/builders.js` at e02c618 (SECTIONS with the summary first, the item helpers, gsteps,
  model() with include and the dropped-section reference fix, title block / running header / footer).
- `ui/report.js`: adapted from `apps/steel-bridge/ui/report.js` at e02c618 (section chips kept in the page's UI state, viewer mount, tab links).
  Not copied: scope (every girder), detail (every station), demand source (hand-off file), Build button (the PS result is the page's own,
  computed once per input state).
- `report/data.js`: the pattern of `apps/steel-bridge/report/data.js` (each module's result from the function its tab uses); written for this app.
- `index.html` CSS: the steel app's Report rules (QA2) at e02c618.
### Shared files
- None changed. `shared/report.js` is now loaded by this app (also by the steel app and others; unchanged).
### Saved data (CLAUDE.md §5)
- No new key and no project field. The section chips are kept in the page's UI state `psb2.ui` (`ui.rpt.inc`, as the steel app keeps them
  in its UI key); absent → every section. `psbeam.*` untouched (harness B).
### Governing provisions
- None changed (§4). The Report quotes the tabs' citations (AASHTO LRFD 10th Ed. (2024); MBE article numbers as the old app; owner manuals).
### Check case
- Default project (PCI BT-72, L = 120 ft, 40 strands, AASHTO): §1 FAIL 1 of 20 checks, largest ratio 1.276 (Hold-down force (PS-10), x = 48.00 ft,
  F_hd = 94.823 kip vs 0.75 W = 74.303 kip, see §10.6); Release comp 4.174 / 4.420 ksi = 0.944; Flexure 10,250.992 / 13,638.909 k-ft = 0.752;
  Shear 241.190 / 334.550 kip = 0.721; key quantities: total loss 47.82 ksi (23.6 %), f_pe 154.68 ksi, DF_M / DF_V 0.719 / 0.884,
  φM_n / M_u 13,639 / 10,251 kip-ft, camber 2.90 / 0.57 in; inventory RF flexure 1.737, shear 1.635, Service III 1.430. The old app's own
  report (psrModel) shows the same numbers at its decimals ("47.82 ksi (23.6%)", Release comp 4.17 / 4.42, ratio 0.94); it has no PS-10 row
  (the check is new in PR 2d-3).
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry` (new `psbridge-report.test.mjs`, 19 tests): on the 16 tab designs, 14 sections, every
  "see §" resolves, no duplicate anchor, no NaN / undefined; every recorded number (≈1,370–1,600 per design) = the R value as the tabs format it;
  each tab section records exactly the values the tab shows and holds the tab's own step objects in its topics; every check in the summary with
  a link; the assumptions present; the $…$ notation parses in KaTeX (strict); a left-out section leaves no link; nothing in R, the inputs or the
  project changes. Also fixed: `psbridge-inputs.test.mjs` "default project …" compared `P.base` with the old defaults without the PS-10 fields
  that PR 2d-3 adds (failing on main since #1461; test only: the expected base now has `opt.hdCheck = true`, `opt.hdFrac = 0.75`).
- **Harness B** (`node tests/psbridge-compare.mjs`, all tabs + the Report): 16 designs, 40,826 shown values and 7,184 step values (the Report
  23,026 values and 3,592 step values; 327 PS-10 values with the hand values, the rest with the old app exactly) and 1,480 numbers of the old
  app's own report (psrModel "Design summary" and key quantities, at its decimals): **0 differences**; every Report number found in its rendered
  section, every step rendered, no KaTeX error; `psbeam.*` untouched. `--control` (one tab value, one step, one Report value, one Report step,
  one old-report number changed) reports each difference.
- `node tests/smoke/ps-bridge-skeleton.mjs` (202 checks): the Report's 14 sections, values = computeAll on the page, steps with KaTeX, a "see §"
  jump, a tab link, a section chip (kept in `psb2.ui`, not in the project), Print report (the report alone; print media emulated), Ctrl+P on the
  tab (no header, no notes, no bar), blocked by an input error, 390 px without sideways scroll; file://, 0 console errors.
  `node tests/check-syntax.mjs`.
### Open items
- The owner material-limit checks of the engine (girder f′c and release f′ci against the owner's range: RIDOT 5.2.1, MassDOT 3.7.2.1,
  CTDOT 5.9.1.2) are not on any result tab and not in the check-summary column (its groups do not list them); the Report lists them in §1 with
  a link to the Owner rules table. Example: the CTDOT tab design (f′ci = 6.8 ksi > 6.5 ksi) FAILs "Release strength f′ci (CTDOT 5.9.1.2)",
  ratio 1.046, while the check-summary column counts only its own groups. Whether to add them to the check-summary column (display) is for the engineer.
- No graphics in the Report yet (the tabs draw theirs after the HTML; the steel report has charts): a later display PR if wanted.

## 2026-11-13 — Owner material-limit checks in the check summary column ("Materials (owner limits)"); Report §1 consistent with the column (display only, no calculation change)
PR #1466: https://github.com/mlococo88/All-Structural/pull/1466
### Problem
- The engine checks the girder f′c and the release f′ci against the owner's limits (RIDOT 5.2.1, MassDOT 3.7.2.1, CTDOT V2 5.9.1.2; engine
  PBD-E, `pbd-compute.js` anchor `const rFcMin=rr('fc.min')`), but these checks were on no result tab and in no group of the check-summary
  column, so the column's PASS / FAIL totals did not count them (open item of PR 2e). Example: the CTDOT tab design FAILs "Release strength
  f′ci (CTDOT 5.9.1.2)" (6.8 > 6.5 ksi, ratio 1.046) while the column showed only the hold-down FAIL. Engineer's decision (2026-11-13): a chip
  "Materials (owner limits)", counted in the totals, that opens the Owner rules table.
### Where
- `apps/ps-bridge/ui/dash.js` GROUPS, anchor `{ id: 'deck', name: 'Deck'`: after it, a new group
  `{ id: 'mat', name: 'Materials (owner limits)', tab: 'own', input: true, checks: [['Girder f′c (RIDOT 5.2.1)', 'own-rule-fc.min'], ['Girder f′c (CTDOT 5.9.1.2)', 'own-rule-fc.range'], ['Release strength f′ci (MassDOT 3.7.2.1)', 'own-rule-fci.max'], ['Release strength f′ci (CTDOT 5.9.1.2)', 'own-rule-fci.range']] }`
  (the names are the engine's `OWN_RULES` `nm`). The totals, the verdict and the governing line take it like every group (no chip when the
  design has none of the checks, e.g. AASHTO). New helper `go(gp, st)`: a group with `input` links with `data-sdown="own|<row id>"` instead of
  `data-sdgo="<tab>|<step>"`; the click handler opens the input tab (`o.goin`), scrolls the row into view and marks it (`sdFlash`, 1.6 s).
  The governing line: before `data-sdgo="${tabOf(top.st)}|${top.st}"` (tabOf removed); after `${go(top.gp, top.st)}` (top keeps its group).
  The chip's tooltip names the Owner rules tab instead of "at x = 0.00 ft".
- `apps/ps-bridge/ui/inputs.js` ownerCard (anchor `const applied = r =>`): `cards(tab, P, R)` / `ownerCard(P, R)` take the design's engine result
  (optional); each rules row gets `id="own-rule-<rule id>"`; for the four material rules (`MAT`) "Applied here" was "Check of the design (output
  tabs)", now "Check of the design" + `matCell(r, R)`: f′c or f′ci = value, the governing minimum or maximum, "ratio = value / limit" (maximum) or
  "limit / value" (minimum; the engine's rule, chosen by which of the two equals the engine's ratio), the engine's ratio and PASS / FAIL, each
  number a `data-ev` of `checks.<i>.v / .lim / .r`; "(shown when the inputs have no error)" without a result.
- `apps/ps-bridge/index.html`: `own: IN.cards('own', P, ownRes())`, `ownRes()` = the page's `result()` when the inputs have no error; CSS
  `tr.sdFlash>td`.
- `apps/ps-bridge/report/builders.js` summary(): a check in a group with `input` links to `X.ownKey` (the Owner rules subsection of §2, `rs.own`;
  no link when §2 is left out) and its Group column reads "Materials (owner limits)" (before: "Owner rules", via the OWNG fallback, which is
  kept for any other owner check in no column group); the note says the groups and the totals are the column's, and a check outside the
  column (today only "Girder age at continuity (RIDOT 5.6.3.3)", RIDOT with continuity on) is named in a warning note, not counted by the
  column. §2's Owner rules table is built with `B.R` (the same values as the tab).
### Shared files
- None.
### Saved data (CLAUDE.md §5)
- No key, no project field, no format change.
### Governing provisions
- None changed (§4). The checks are the engine's, cited as before (RIDOT BDM 5.2.1, MassDOT LRFD BM 3.7.2.1, CTDOT BRSDM V2 5.9.1.2).
### Check case
- CTDOT tab design (PCI BT-72, f′c 8.5 ksi, f′ci 6.8 ksi, 40 strands): engine "Release strength f′ci (CTDOT 5.9.1.2)": limits 0.70 f′c = 5.95,
  0.80 f′c = 6.80, cap 6.5 ksi; ratios 5.95 / 6.8 = 0.875, 6.8 / 6.8 = 1.000, 6.8 / 6.5 = 1.046 → governing cap, ratio 1.046 FAIL.
  "Girder f′c (CTDOT 5.9.1.2)" 6.0–10.0 ksi: 6.0 / 8.5 = 0.706, 8.5 / 10.0 = 0.850 → 0.850 PASS. Before: column 1 FAIL + 20 PASS (hold-down
  only); after: the Materials chip FAIL 1.046, column 2 FAIL + 21 PASS = the engine's 23 checks; Report §1 "FAIL: 2 of 23 checks", both
  material rows in group "Materials (owner limits)", linked to the Owner rules table, which shows 6.80 / 6.50 = 1.046 FAIL.
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry` (100 tests; `psbridge-report.test.mjs` + 18: on the 16 tab designs every engine check
  is in a column group, §1 has the same groups and FAIL rows as the column, the material rows link to `rs.own`; the CTDOT case above, the RIDOT
  minimum (limit / value), AASHTO without a material check, the RIDOT continuity-age check named in §1 as outside the column).
- Harness B (`node tests/psbridge-compare.mjs`, new `own`): the Owner rules table values compared with the old app (30 values on 5 owner designs),
  the column totals = the engine's checks, Report §1 FAIL rows = the column's: 16 designs, 40,886 shown values and 7,184 step values,
  0 differences; `--control` still reports each planted difference.
- `node tests/smoke/ps-bridge-skeleton.mjs` (209 checks; + 7: no chip for AASHTO; CTDOT chip FAIL 1.046, totals, the chip opens the Owner rules
  tab at the f′ci row, the table values = computeAll, the chip lists both checks, Report §1 = the column); `node tests/check-syntax.mjs`.
### Open items
- "Girder age at continuity (RIDOT 5.6.3.3)" (RIDOT, continuity on) is still on no result tab and in no column group; §1 lists it and says
  so. Whether to add it to the column (e.g. to the Analysis group or the Materials chip) is for the engineer.

## 2026-11-13 — Report graphics: each result tab's graphics in its Report section, numbered "Figure n.m" (display only, no calculation change)
PR #1467: https://github.com/mlococo88/All-Structural/pull/1467
### Problem
- The Report (PR 2e) had no graphics: its sections are built from each tab's `output()` HTML, and the tabs draw their graphics afterwards in
  `after()` (open item of PR 2e). Engineer's decision (2026-11-13): put each tab's main graphic in its Report section, drawn by the tab's own
  code, sized to the page in print, readable labels, captions and numbering as the steel report's figures where sensible.
### Where
- `apps/ps-bridge/ui/report.js` (new functions `grab`, `figures`, constant `PW = 700`): `figures(B, inc, wScr)` draws each included result
  tab off screen (a hidden host 700 px wide, `U.output(ctx)` then `U.after(host, ctx)`, ctx = the report's `{ P, inp, R, W, ui: {} }`: the
  same defaults as the Report's cards) and takes each graphic card the tab mounts (`.vk.va-card` of `PSBVizAlong.mount`, `.vk.vk-det` of
  `PSBVizKit.detCard`) with the id of its slot `#gfx_…`: the drawn figure (`.vk-fig`, the read-out overlay `.va-hov` removed), the series chips as
  a static legend of the series shown, the tab's legend (`.va-leg`) and captions (`.vk-cap`), links as text; the caption = the card's title
  (sub-title in brackets) and, for a graphic with a state control, "shown: <control>: <state>" (e.g. the handling elevation "shown: Stage:
  Lifting", the stage last chosen on the Handling tab). On a screen narrower than 660 px (phone) each tab is drawn a second time at the report's
  width: that copy is shown on screen (`.rp-fig-scr`) and the 700 px one printed (`.rp-fig-prn`). `render()`: anchor
  `if (S.key !== key || !S.M)`: before `S.M = window.PSBReportBuild.model(B, { include: inc })`; after `figs = figures(B, inc, narrow ? wScr : 0)`
  then `model(B, { include: inc, figures: figs })`; the cache key also holds the narrow width. No drawing code is added or copied.
- `apps/ps-bridge/report/fromtab.js`: `cards(html, o)` / `blocks()`: a graphics slot `#gfx_…` (before: skipped) gives `o.figs[<slot id>]`
  (copies) at its place when given (a slot outside the cards goes to `top`); new `inline(html)` (a title as report text, sub / sup as $…$).
- `apps/ps-bridge/report/builders.js`: `tabSec()` passes `X.figs[k]` to `FT.cards` and puts the figures outside the cards in a first
  subsection "Graphics" (before: only notes, "Notes"); `model()` takes `opt.figures` and numbers every figure "Figure n.m: " + caption (n = the
  section's number among the sections shown, m = its order in the section).
- `apps/ps-bridge/index.html` CSS (anchor `.rp-fig .rp-vk`): the figure body without the card frame, svg max-width 100 %, the two-section
  rows of the strand pattern kept side by side (`flex-wrap:nowrap`), screen / print copies (`.rp-fig-scr`, `.rp-fig-prn`).
- Figures (default project, every module on): 3.1 composite section and strands, 4.1 cross-section and design girder, 5.1 moment and shear
  envelopes, 6.1 losses, 6.2 strand pattern (elevation and the two sections), 7.1 stresses along the span, 7.2 stress distribution on the section
  (stage shown), 8.1 moments and resistance (8.2 pier section when continuous), 9.1 shear, 10.1–10.3 end-zone checks, girder end, hold-down,
  11.1–11.2 camber, 12.1–12.2 handling checks and elevation (stage shown), 13.1–13.2 deck checks and deck section, 14.1–14.2 rating factors and
  rated sections. Handling and Deck have none when the module is off (the tab shows no graphic either).
### Shared files
- None changed (`shared/report.js` renders `{ type: 'figure', svg, caption }` items as before).
### Saved data (CLAUDE.md §5)
- No key, no project field, no format change.
### Governing provisions
- None (§4): no value is computed or recorded by the figures; `model.vals` are unchanged with and without figures (test).
### Check case
- Default project: the Report shows 16 figures (20 with Handling and Deck on and two continuous spans), Figure 3.1 to 14.2; the printed labels
  are 10.0–12.0 px (drawn at 700 px = 7.3 in, the letter page between the report's 0.6 in margins); before: no figure.
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry` (101 tests; `psbridge-report.test.mjs` + 1: figures at their slots (a top slot
  in "Graphics", the pier slot in its card), numbered by the sections shown (also with sections left out), the values unchanged, the handed-in
  figures not changed, `[Figure]` in the text).
- `node tests/smoke/ps-bridge-skeleton.mjs` (214 checks; + 5): every result section has its figures, numbered Figure n.m by its section,
  static (no button, read-out or control), the strand pattern, deck section, camber, rating and handling elevation (with its stage) present,
  every label ≥ 10 px on the printed page and no figure wider than the page; Print report prints every figure; 390 px: the figures drawn at the
  screen width, no sideways scroll, print uses the 700 px ones; file://, 0 console errors.
- Harness B (`node tests/psbridge-compare.mjs`): 16 designs, 0 differences (the Report's numbers and steps as before, with the figures in the
  rendered sections). `node tests/check-syntax.mjs`.
### Open items
- No dark mode in this app (none to support). In print, the shared report adds "see " before every § link, so a table cell that already says
  "(see §x)" prints "(see see §x)" (shared/report.js `.rp-see::before`, since PR 2e; the steel report has the same): not changed here.

## 2026-11-13 — Follow-ups of the Report: the RIDOT girder age at continuity in the check summary ("Owner limits"); the handling elevation in both stages in the Report; Report captions for a static figure (display only, no calculation change)
PR #1469: https://github.com/mlococo88/All-Structural/pull/1469
### Problem
- a) The engine check "Girder age at continuity (RIDOT 5.6.3.3)" (RIDOT, continuity on; engine `pbd-compute.js` anchor `const rAge=rr('cont.age')`,
  v = t_d, lim = 90 days, r = 90 / t_d) was on no result tab and in no group of the check-summary column, so the column's PASS / FAIL totals did
  not count it; Report §1 listed it with the note "Not in the check summary column and not counted in its totals" (open item of #1466).
- b) The Report's handling elevation (Figure 12.2) showed only the stage last chosen on the Handling tab ("shown: Stage: Lifting" or "Hauling").
- c) Report figure captions copied the tab's wording for the screen: "click a station to select it" (Analysis, Stresses), "Stage buttons select
  the stage and its governing station" (stress distribution), the series chips' label "Show" (Shear, Camber), and "the table above" (Analysis
  envelopes, the strand pattern title), where in the Report the section's tables follow the figure.
### Decisions (pending engineer review; the engineer said to use judgment)
- a) The age check joins the owner-rules group of the column (the Owner rules table holds its rule, row `own-rule-cont.age`); the chip
  "Materials (owner limits)" is renamed "Owner limits", because it now holds more than the materials (one chip, not a second "Owner rules"
  chip, so the column has one place for every owner limit and "Owner rules" stays the name of the input tab the chip opens). The chip's group
  id stays `mat` (internal only).
- b) The Report draws the handling elevation once per stage, Lifting then Hauling (Figures 12.2 and 12.3), whatever stage the tab last showed;
  the tab's own stage is put back. Only this graphic: the stress distribution (Figure 7.2) still shows the default stage (Release), as before.
- c) Reworded in the Report only (the tabs unchanged): "; click a station to select it." → "." ; "Click a station to select it." → removed;
  "Stage buttons select the stage and its governing station." → "Drawn at the governing station of the stage named in the caption."; chip
  label "Show" / "Also show" → "Shown:"; "the table above" → "the table in this section".
### Where
- `apps/ps-bridge/ui/dash.js` GROUPS, anchor `{ id: 'mat', name:`: before
  `{ id: 'mat', name: 'Materials (owner limits)', tab: 'own', input: true, checks: [[…f′c / f′ci…]] }`; after
  `{ id: 'mat', name: 'Owner limits', tab: 'own', input: true, checks: [[…the same four…], ['Girder age at continuity (RIDOT 5.6.3.3)', 'own-rule-cont.age']] }`.
  Totals, verdict, governing line and the click to the Owner rules row are the group's existing code.
- `apps/ps-bridge/ui/inputs.js` matCell (anchor `const MAT = [`): before `['fc.min', 'fc.range', 'fci.max', 'fci.range']`; after `+ 'cont.age'`;
  for `cont.age` the cell reads "t_d (girder age at continuity) = 60 days; governing minimum 90 days; ratio = 90 / 60 = 1.500 FAIL" (decimals 0,
  unit days; always a minimum: `isMin = age || (…)`); "(check summary: Materials (owner limits))" → "(check summary: Owner limits)". Before, the
  row said "Check of the design (output tabs)".
- `apps/ps-bridge/report/builders.js` summary(): the §1 note "the owner's material limits (group Materials (owner limits))" → "the owner's limits
  (group Owner limits: the material limits and, RIDOT with continuity, the girder age at continuity)". The "Not in the check summary column …"
  note is no longer made for any engine check (it stays, with the OWNG fallback, as a guard for an owner check in no group: none today).
- `apps/ps-bridge/ui/report.js`: new `ALLSEG = new Set(['gfx_hnel'])`, `STATIC` (the rewordings of c), `still()`, `chipLab()`, `one(card)` (the
  old body of `grab` for one card, plus `still` on title, sub-title and captions); `grab(host)`: for a slot in ALLSEG, clicks each button of the
  card's segmented control in order, takes `one(card)` after each, then clicks the button that was pressed (the tab's state back).
### Shared files
- None.
### Saved data (CLAUDE.md §5)
- No key, no project field, no format change. The Handling tab's stage (module state `ST.stage`, not saved) is the same after the Report.
### Governing provisions
- None changed (§4). The age check is the engine's (RIDOT BDM 5.6.3.3, minimum girder age 90 days), cited as before.
### Check case
- RIDOT, two continuous spans 110 + 110 ft, default BT-72, t_d = 60 days (new tab case): engine "Girder age at continuity (RIDOT 5.6.3.3)"
  v = 60, lim = 90 days, r = 90 / 60 = 1.500 FAIL (loc 110 ft). Engine: 25 checks, 3 FAIL (Neg flexure (pier) 1.075, the age check 1.500,
  Hold-down force (PS-10) 1.518). Before: column 2 FAIL + 22 PASS (24, the age check outside), §1 "FAIL: 3 of 25" with the "not in the column"
  note; after: the Owner limits chip FAIL 1.500 (the governing of its two checks: the RIDOT f′c minimum and the age), column 3 FAIL + 22 PASS =
  25, §1 row "Owner limits | Girder age at continuity (RIDOT 5.6.3.3) | 110.00 | 60.000 | 90.000 | days | 1.500 | FAIL | see §2.x", no note.
  t_d = 90 days (default): r = 90 / 90 = 1.000 PASS, shown "governing minimum 90 days".
- Report, default BT-72 with Handling on (tab left on Hauling): before Figure 12.2 "…; shown: Stage: Hauling" only; after 12.2 "…; shown:
  Stage: Lifting" and 12.3 "…; shown: Stage: Hauling", the Handling tab still on Hauling.
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry`: 105 passed (101 + the new tab case in the per-case loops, + 1 new test: the age
  check's values, its Owner rules cell, group, §1 row, no note, t_d 90 PASS as a minimum).
- Harness B (`node tests/psbridge-compare.mjs`): 17 designs (new: RIDOT, two continuous spans, continuity at a girder age of 60 days), 43,512
  shown values and 7,646 step values, 0 differences; its Owner rules row compared with the old app (own 10 values), the chip shown when a
  design has an owner-limit check, §1's Owner limits rows = the design's owner-limit checks, no "not in the column" note. `--control` reports
  each planted difference (exit 1).
- `node tests/smoke/ps-bridge-skeleton.mjs` (223 checks, + 9): handling elevation Lifting then Hauling (12.2, 12.3), the tab keeps Hauling; no
  figure wording of the screen controls or "table above"; RIDOT continuity t_d 60: Owner limits chip FAIL 1.500, totals, the chip list opens the
  Owner rules row (5 engine values = computeAll), §1 row, no note, 0 console errors. `node tests/check-syntax.mjs`.
### Open items
- matCell (unchanged for the material rules): when the value equals the limit (r = 1.000) it cannot tell a minimum from a maximum by the ratio
  and says "maximum"; the age check is fixed as a minimum, the f′c / f′ci rules are not changed here.
- The stress distribution figure (7.2) shows one stage (Release, the default) in the Report; all stages could be drawn as for handling, if wanted.

## 2026-11-13 — PR 2f: "From the old app" — read-only import of the old Prestressed Bridge Design's saved designs and Export JSON files (no calculation change)
PR #PRNUM: https://github.com/mlococo88/All-Structural/pull/PRNUM
### Where
- `apps/ps-bridge/engine/legacy.js` (new, `window.PSBLegacy`, no DOM): `scan(storage)` lists every design the old app keeps, reading with
  `getItem` only: the design on screen `psbeam.inputs.v1` with the bridge model the old app opens with it (the old `App()` rule:
  `psbeam.bridge.v1` when its `projId` is the open shared project `bridgeSuite.v1.currentProjectId`, else that project's `psbeamBridge` slice),
  every shared project of `bridgeSuite.v1.projects` with a `psbeam` or `psbeamBridge` slice, and the older list `psbeam.projects.v1`; an
  unreadable key is named and left as it is. `fromText(text, name)`: an old Export JSON (the inputs object) or a bridge model object; a MIDAS
  demands file, a psb2 file and other files are refused with their reason. `convert(src)`: a `psb2.project` from one old design (below).
  `verify(c)`: the old saved inputs (the old app's own `mergeInputs`) and the imported project's engine inputs (`PSBDesign.inputs`) computed
  with the same moved engine; every value, the warnings and the continuous-unit record compared exactly (Object.is per number), the result kept
  in the summary; the PS-10 check this app adds reported apart.
- Mapping (`convert`): base = `PSBModel.baseInputs(saved)` (= `mergeInputs`, + the PS-10 box on at 0.75 W as every psb2 project) without
  `external`; spans = the old continuous unit as the old engine's `contUnit` takes it (`cont.spans` with the design's L in span `cont.span`;
  continuity 'composite' when `cont.on`), else [L]; with MIDAS demands the imported member's spans (`PBD.extSpans`, as `PBD.migrate`);
  xs = `nGirders` girders, every bay `S`, both overhangs `deck.oh`, every skew `loads.skew`; design = G<n> of the old girder label when it
  agrees with the position, else G1 (exterior) / G2 (interior); title block name, by → designer, date, job → number. `P.legacy` (new optional
  field of schema v1, `engine/model.js` header) = `{ from, source, importedAt, inputs (as read), bridge (as read: every girder × span design),
  external (MIDAS demands), summary }`. Every engine input of the imported design is compared with the old one; any difference is listed.
- `apps/ps-bridge/ui/legacy.js` (new, `window.PSBLegacyUI`): the Project tab card "From the old app (Prestressed Bridge Design)": "Find the old
  app's designs" (a table: where, name, saved, contents and the key it was read from; one chosen with a radio button, "Import the chosen
  design"), "Import an old-app JSON file…"; the card "Imported from the old app" (while the project has `legacy`): the results verdict, Imported,
  the PS-10 addition (link to the End zone & hold-down tab), Differences from the old app, Input errors in this app, Kept in the project, not
  used yet, Read as the old app reads older saved designs, Notes, Not imported. Times in the viewer's local time.
- `apps/ps-bridge/index.html`: loads `engine/legacy.js` (after `engine/inputcheck.js`) and `ui/legacy.js` (after `ui/inputs.js`); the Project
  tab: the cards after "Save and open" (anchor `+ LGUI.card(P)`), the note no longer says "From old app" comes later; the click handler
  (anchor `if (LGUI.onClick(e, lgCtx)) return;`); Import JSON of an old file or an old MIDAS file goes to the old-app import (anchor
  `r.legacy || /"_schema"`). An import replaces the open project after a confirm, as Import JSON and New do.
- `apps/ps-bridge/engine/model.js`: header documents `legacy`; `legacyKind`'s refusal text, before `… files are imported in a later version of
  this app. The file was not changed.`, after `… file: import it with "From the old app" on the Project tab. The file was not changed.`
### Saved data (CLAUDE.md §5)
- No new key. Read only: `psbeam.inputs.v1`, `psbeam.bridge.v1`, `psbeam.projects.v1`, `bridgeSuite.v1.projects`,
  `bridgeSuite.v1.currentProjectId`; never written, renamed or deleted (tests: a storage stand-in that throws on any write; the smoke test and
  harness B compare every old key byte for byte after the import). Not read: `psbeam.ui.v1`, `psbeam.inputTab.v1`, `psbeam.fold.*`,
  `psbeam.redirect.offered.v1`, hand-off keys. `psb2.project` v1 gains the optional `legacy`; nothing reads it for a calculation.
### Decisions (pending engineer review)
- D1. One design at a time, into the open project (it replaces it after a confirm, "export it first to keep it"), as Import JSON does: the
  saved-projects list (`psb2.lib.*`) is a later PR, so several designs cannot be held at once yet.
- D2. MIDAS demands of an old design are kept in `P.legacy.external` and NOT used (base `external` = null): this app has no MIDAS import, inputs
  or display yet, and demands nobody can see should not drive the results. The design is computed with the built-in analysis on the member's
  spans; the summary says the results differ, and the verdict shows it.
- D3. An old design made continuous with one span entered (the old app assumed two equal spans [L, L], this girder in span 1, and warned) is
  imported as two spans of L, made continuous: every value the same; only the old warning and the record `cont.unit.src / assumed / Lbridge`
  differ (named in the verdict and a note). Likewise a bridge-bar span other than L (the old app used L and warned): imported with L.
- D4. Of an old bridge model only the design on screen (the selected cell; the saved design on screen when both exist, as the old app opens it)
  is imported now; every other girder × span design is kept in `P.legacy.bridge` and listed ("NOT designed yet", PR 3a).
- D5. The imported project has the PS-10 hold-down box on at 0.75 W (as every psb2 project, PS-10); for AASHTO / RIDOT with draped strands the
  summary names it as the one check added to the old app's list, with its ratio and a link to where it is worked.
- D6. What the bridge cannot give is imported with the difference listed and the results flagged (not refused): interior position with 2
  girders (every girder exterior), a negative skew (|θ| here), blank text where the bridge needs a number (also an input error).
- D7. Girder label: G<n> of the old label when it agrees with the position, else G1 / G2; a different label is noted; the old label kept in
  the record. Overhangs: `deck.oh` on both sides; skews: `loads.skew` at every support; bays: `S` everywhere.
- D8. The old data as read is kept whole in the project (`P.legacy.inputs`, `.bridge`), so nothing is discarded; unknown fields are also kept in
  the base design (the old `mergeInputs` keeps them) and listed.
### Governing provisions
- None changed (§4): no formula, factor or unit. The import copies inputs; the results are the moved engine's (PR 2a).
### Check case
- Old design on screen: AASHTO Type IV, L = 85 ft, 4 girders at S = 8.5 ft, exterior, skew 10°, label "G1 (Exterior)", bridge model with one
  more stored design G2/S1 → project span [85] simple, nb 4, bays 8.5 / 8.5 / 8.5, overhangs 3 ft, skews 10 / 10, design G1 in span 1; summary
  "Results: the same as the old app … (19 checks)", PS-10 "ratio 1.712 FAIL" (AASHTO), "1 other girder × span design (G2/S1) kept in the
  project, NOT designed yet"; the Flexure tab's values = `computeAll` of the old inputs.
- Old default design with `cont.on = true` and no spans: project spans [120, 120] made continuous; every value the same; record differs in
  `cont.unit.src` ('assumed' → 'bridge'), `assumed`, `Lbridge`, and the old warning "Continuity is on but the bridge has one span …".
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry`: 111 passed (new `psbridge-legacy.test.mjs`, 6 tests): the 17 harness B designs as
  the old app's inputs: engine inputs identical (but the girder label's source and the PS-10 box), `computeAll` identical (independent exact
  comparison), checks with PS-10 identical, `verify` same; the 658 harness A cases (38 recorded old saved designs, 600 seeded, 20 edge):
  552 identical, 57 MIDAS (named: not used), 48 one-span continuity (values identical, named), 1 blank text (named, with its input error) — none
  unnamed; scan / file / edge cases (missing fields filled as the old app, `opt.longAs`, unknown fields, labels, 2 girders interior, negative
  skew, an input error, JSON round trip keeps `legacy`); storage read only. `psbridge-model.test.mjs`: script list, `engine/legacy.js` the only
  file naming old keys and it writes none.
- Harness B `node tests/psbridge-compare.mjs --import`: the 17 designs imported through the Project tab (autosave + bridge model 5, shared
  project 4, older list 4, Export JSON file 4; 26 old keys / files each unchanged; 17 summaries "the same"): 43,512 shown values and 7,646 step
  values (the Report 24,544 + 3,823, the old app's own report 1,582 numbers), 0 differences. `--import --control` (f′c + 0.1 ksi in the old data,
  the old app on the unchanged inputs) reports the difference (exit 1). Without `--import`: 17 designs, 0 differences; `--control` exit 1.
- `node tests/smoke/ps-bridge-skeleton.mjs` (247 checks, + 24): the list (3 sources), asked first, summary, the saved project, Flexure values =
  the old inputs computed, an Export JSON through Import JSON, a MIDAS file refused, every old key unchanged, psb2.* only, 390 px without
  sideways scroll; file://, 0 console errors. `node tests/check-syntax.mjs`.
### Open items
- Several old designs at once (into the saved-projects list) when `psb2.lib.*` comes; the MIDAS demands from `P.legacy.external` when the MIDAS
  import comes; the other girder × span designs of `P.legacy.bridge` at PR 3a.
