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
PR #1489: https://github.com/mlococo88/All-Structural/pull/1489
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

## 2026-11-13 — PR 3a-1: the bridge level, part 1 — girder types on the girder lines of each span (model, inputs, the type / line shown; no result change)
PR #1496: https://github.com/mlococo88/All-Structural/pull/1496
### Request
- Plan §5 PR 3a; engineer decisions PS-8 (interior + exterior design per span, the same shape per span, optional per-girder override), PS-15
  (the interim one design girder until the bridge step), PS-17 (kept multi-design imports restored at 3a: PR 3a-4). Modelled on the Steel Bridge
  app's girder types (SB-2 #1451/#1454, SB-14/SB-15 #1486): copied as a pattern into `apps/ps-bridge/`, no steel file edited.
- Split (task direction): 3a-1 model + inputs (this PR, no result change); 3a-2 every type checked on every line, check summary / Summary /
  Report per type and line, unequal bays and different end skews allowed; 3a-3 the steel app's DC2/DW distribution (§4); 3a-4 restore the
  old app's kept designs as types (PS-17).
### Where
- `apps/ps-bridge/engine/bridge.js` (new, `window.PSBBridge`, no DOM): a girder type = `{ id, label, span, lines: [g…] (1-based), ovr: {
  '<engine path>': value } }`; `types`, `typeLines`, `lineTypes`, `typeAt`, `spanTypes`, `unassigned`, `cells`, `shown` (the cell the output tabs
  show: `P.design` when a type is on it, else the first cell), `effBase` (base ⊕ ovr, key order of the base kept), `diffOvr` / `setOvr` (the
  overrides = every leaf (a table as one value) that differs from the base; a value set back to the base's stops being an override),
  `sameShape` / `resetKey` (PS-8: `girder`, `cust.*`, `ovr.*` written to every type of the span), `ovrKeyOf`, `setLines`, `assignLine`,
  `addType`, `deleteType`, `fill` ("Assign every line"), `newTypes`, `migrate`, `syncSpans`, `renumber` (SB-14), `snapshot`, `checks` (SB-15:
  two types on one line; different shapes in a span; no checked line — blocking; lines with no type — warning).
- `apps/ps-bridge/engine/design.js`: anchor `function inputs(P) {` — with types `cellInputs(P, shown.k, shown.g)`, else `one(P)` (the PR 2b body,
  renamed, unchanged); new `cellInputs(P, k, g) = one({ …P, base: effBase(P, k), design: { g, s: T.span }, types: undefined })`; `sel(P)` with
  types = the shown cell; `checks`: the different-skew error for every span with a checked cell (the unequal-bay and skew errors stay until 3a-2).
- `apps/ps-bridge/engine/model.js`: header documents `types`; `newProject()` (defaultProject + `newTypes` + design G2/S1; defaultProject
  unchanged, the tests use it); `validate`: unreadable `types` → error `types`; `importJSON`: `PSBBridge.migrate(p)` (anchor `// PR 3a-1: girder
  types`), notes; `load`: nothing stored → `newProject()`.
- `apps/ps-bridge/engine/inputcheck.js`: `PSBBridge.checks` errors (src 'types'); the field / table / location rules moved unchanged into
  `inputsOf(P, b, L, E)`; each girder type's own inputs checked by the same rules on its span's length; an error the base does not have is
  the type's (`scope` = its id, message "Girder type <label>: …").
- `apps/ps-bridge/engine/fields.js` `tabOf`: `types.*` → Girders & strands.
- `apps/ps-bridge/ui/types.js` (new, `window.PSBTypesUI`): "Girder types" card (per span: name, the lines as check boxes (a line keeps a
  type: a ticked box is fixed unless the line has two types), own inputs, Edit its inputs, Copy, Delete (its lines go to the span's first
  other type, asked first); Add type to span; Assign every line; types of a span beyond the span count kept, listed); "Shown on the output
  tabs" card (the bridge values, as the PR 2b design card); the scope bar "Entered values for: every girder type (the base design) | <type>
  only" on Girders & strands, Materials, Loads (`psb2.ui.scope`); the bar "Results of girder type … on line …" above the result tabs and the
  Report (writes `P.design`); the field markers "● <type>" + reset (type scope) and "own value in: …" (base scope).
- `apps/ps-bridge/ui/inputs.js`: the design girder card only without types; the Assumptions with types.
- `apps/ps-bridge/index.html`: loads `engine/bridge.js` (after design.js), `ui/types.js` (after inputs.js); CSS `.tyScope`, `.tyOut`,
  `.tyMark`, `.tyRow`…; the type scope view (`viewOf`, edits → `BR.setOvr`); N_b change → `BR.renumber` and span-count change →
  `BR.syncSpans`, each with a notice (toast with Undo: the project text before the change); New → `newProject()`; an old-app import →
  `BR.migrate`; `cellR` (results of any cell by inputs, last 300) for the strand pattern of the type shown in scope.
### Saved data (CLAUDE.md §5)
- New optional field `types` within `psb2.project` v1, with a load migration (`PSBBridge.migrate`, run by `importJSON`): a project saved before
  this PR gets `types = [{ id: 'T1', label: '<Interior|Exterior> S<s>', span: s, lines: [g], ovr: {} }]` from its `P.design` (absent: G2/S1) —
  in memory; the stored text is rewritten only by the next edit (smoke test: opening does not rewrite it). Malformed stored `types` are kept
  as `typesBad`, never discarded. No new key; `psb2.ui.scope` is UI state in the existing per-tool key.
### Governing provisions
- None changed (§4): no formula, factor, unit or reference. Each cell's engine inputs are the PR 2b design's for that girder × span (the old
  app's `PBD.applyBridge` "Preliminary designer" values + continuity, skew, overhang).
### Proof that no result changed
- `tests/engine/psbridge-types.test.mjs` (new, 8 tests): the 17 harness B designs saved without types: migrated to T1, `PSBDesign.inputs` text
  (key order included) === PR 2b's `PSBDesign.one`, `computeAll` and `PSBHoldDown.compute` identical (independent exact comparison, Object.is
  per number), input errors identical, nothing else in the project changed; every girder line of every span of those designs as a type
  (`fill`): `cellInputs` === `one` of that girder × span (> 100 cells); a new project's shown cell === the old default design.
- Harness B (`node tests/psbridge-compare.mjs`, normal and `--import`, with `--control`): see the PR.
### Check case
- New project (5 girders at 9 ft, 120 ft): Interior S1 on G2–G4, Exterior S1 on G1, G5. Exterior S1 on G5: L = 120 ft, S = 9.0 ft, exterior,
  overhang 3.0 ft (right), girder label "G5 (Exterior)". Exterior S1's own f′c = 9.0 ksi: stored `types[1].ovr = { 'mat.fc': 9 }`, base 8.5;
  Exterior cells f′c 9.0, Interior 8.5. N_b 5 → 6: "S1 G5: Exterior S1 → Interior S1; S1 G6: no type → Exterior S1" (Undo restores).
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry`; `node tests/check-syntax.mjs`; `node tests/smoke/ps-bridge-skeleton.mjs` (the
  continuous design now chosen with the type / line bar); new `node tests/smoke/ps-bridge-types.mjs` (30 checks: new project's card and lines,
  the bar, Exterior on G5 values = computeAll on the page, a type's own f′c (stored, marked, reset), N_b notice and Undo, a project saved before
  3a opens as T1 with the PR 2b values and is not rewritten, Assign every line, 390 px, psb2.* keys only, 0 console errors).
### Decisions (pending engineer review)
- 3a1-D1. A type belongs to one span (PS-8 "per span"); spans added later get copies of the span before them; a span removed keeps its types in
  the file, not checked (as the steel app's first rule for lines beyond N_b).
- 3a1-D2. A project saved before 3a: its one design becomes one type on its one line; the other lines are not checked until assigned
  ("Assign every line": same-position type of the span, else a new type, a copy of the span's first type), as the steel app's SB-2 (never silently).
- 3a1-D3. Per-type values: any input of the Girders & strands, Materials and Loads tabs ("Edit its inputs"); the Cross-section deck inputs,
  diaphragms (PS-14 b), deck design, owner rules and the continuity steel stay bridge-wide. The steel app's per-LINE overrides (SB-7, SB-9,
  SB-10) are not built: the plan's "optional per-girder override" (PS-8) is a type on one line; DL and LLDF become per line through the bridge
  (3a-2, 3a-3).
- 3a1-D4. N_b change: the steel SB-14 rule per span (outer lines keep the old outer types; inner keep theirs or take the span's Interior type;
  a new Interior type, a copy of the old G1 type, where a span had none); notice with Undo.
- 3a1-D5. The output tabs' type / line choice is stored in the project as `P.design` (the PR 2b "design girder" field), so the Report, the
  harnesses and the check summary read the same cell.
### Open items
- Next: PR 3a-2 (each type on every line, worst line governs; check summary / Summary / Report per type and line; unequal bays, different skews).

## 2026-11-13 — PR 3a-2: the bridge level, part 2 — every girder type checked on every line (worst line governs), check summary / Summary / Report per type and line; unequal bays and different end skews allowed (S and θ per line: §4 callout, no existing result changed)
PR #1501: https://github.com/mlococo88/All-Structural/pull/1501
### Request
- Plan §5 PR 3a, §7 item 3 (how S maps onto the engine); PS-9 (unequal bays from the bridge step); PS-15 (the interim blocking errors end
  at the bridge step); SB-2 PR 2 #1454 (each type on every line, worst line governs), SB-5 (one count per type per check), SB-6 (weight per
  line, bridge total) as the pattern.
### §4 callout — the bridge values S and θ fed to the engine (inputs that were input errors before: no saved design changes)
- **S of a girder line** (`engine/design.js` `lineS`, used by `bridge(P)` for `PBD.applyBridge`): before `S = bays[0]` with unequal bays an
  input error; after: an exterior line (G1, G_Nb) the bay next to it, an interior line the mean of its two bays — the rule of
  `shared/lldf.js memberSpacing` that the Steel Bridge app uses; for an interior girder it equals its tributary width (AASHTO LRFD 10th Ed.
  Art. 4.6.2.6.1). The engine uses S, unchanged, for the distribution factors (Art. 4.6.2.2.2b-1 / 4.6.2.2.3a-1 interior; lever rule and
  e-factors exterior), b_eff (tributary) and the deck weight. Equal bays: S = the bay, as before (proved: inputs byte-identical).
- **θ of a span** (`one()`): before `|θ_left|` with different skews an input error; after `max(|θ_left|, |θ_right|)`. The engine's moment
  reduction is 1.0 below 30° (Table 4.6.2.2.2e-1: c1 = 0 for θ < 30°), so below 30° θ acts only in the shear correction (Table 4.6.2.2.3c-1),
  where the obtuse corner's (larger) θ is the conservative one. Different skews with the larger ≥ 30° and the DF computed stay a blocking
  input error (one θ cannot be both the smaller for the moment, Art. 4.6.2.2.2e, and the larger for shear); with the DF entered they are allowed.
- **Worked check case** (new project, 120 ft, BT-72, 5 girders, overhangs 3 ft; bays 8, 10, 10, 8 ft):
  - S: G1 = 8, G2 = (8 + 10)/2 = 9, G3 = (10 + 10)/2 = 10, G4 = 9, G5 = 8 ft.
  - G2: S = 9 ft = the 9-ft equal-bay design exactly (test: engine inputs and computeAll identical): DF_M = max(0.4904, 0.7191) = 0.7191.
  - G3: S = 10 ft. From the 9-ft case K-term (K_g/12Lt_s³)^0.1 = (0.7191 − 0.075)/[(9/9.5)^0.6 (9/120)^0.2] = 0.6441/0.57667 = 1.1169;
    g_M2 = 0.075 + (10/9.5)^0.6 (10/120)^0.2 × 1.1169 = 0.075 + 1.03125 × 0.60836 × 1.1169 = 0.7757 (engine 0.7758); g_V2 = 0.2 + 10/12 −
    (10/35)² = 0.9517 (engine 0.9517); b_eff = 12 × 10 = 120 in; deck DC1 1.0875 klf (9 ft: 0.9875); M_LL+IM 2833.5 kip-ft (9 ft: 2626.6);
    Flexure ratio 0.7891 (9 ft: 0.7516). The Interior type's flexure governs on G3 (test).
  - G1 (exterior): S = 8 ft (the bay next to it), lever rule 1.2 × R = 0.750, DF_M = 0.750.
  - Skews 10° / 20° in span 1: θ = 20°, every result = the 20°/20° design (test). 20° / 35°: input error "… the larger is 30° or more …".
### Where
- `engine/design.js`: `lineS`, `bridge()` S = `lineS(P, d.g)`, `one()` skew = the larger, `checks()` (the unequal-bay error removed; the skew
  rule above), `driven()` labels. `engine/bridge.js`: `results(P, resOf)` (every cell's inputs and result, each check's worst line per type,
  weights W = w_sw (L + 2 e_end/12) per line, type and bridge). `ui/dash.js`: `grp(R, gp, A)` (one entry per type and check, its worst line;
  the chips, verdict and lists name the type and line; Rating the lowest over every cell); a click shows that type and line (`o.pick`).
  `ui/types.js` `summaryCard` (Summary tab: a row per type, its worst line named, a row per line, weights, bridge total; each ratio opens its
  tab with that cell). `report/data.js` (`B.all`, `B.cell`), `report/builders.js` (§1 "Every girder type and line" table when there are 2 or
  more cells; titles name the type), `ui/report.js` (cache key with the cells). `index.html`: `allResults()`, `pick()`, the Summary card,
  `data-tycell` links, the dash `all`/`pick`. `ui/inputs.js`: Assumptions (S per line, θ rule, the rigid-section note below).
### Saved data (CLAUDE.md §5)
- None (no field or key). A project saved with equal bays and skews: every value identical (3a-1 proofs; harness B).
### How verified
- `tests/engine/psbridge-types.test.mjs` +3 tests (S per line; G2 of 8-10-10-8 = G2 of 9-9-9-9 exactly, G3 = the 10-ft design; skews;
  results = PSBHoldDown.compute per cell, worst lines, weights). Smoke `ps-bridge-types.mjs` §6 (unequal bays, chips over every cell, the
  Summary table, a ratio opens its cell, Report §1, skews); `ps-bridge-skeleton.mjs` expectations: chips and column totals over every type and
  line (the page's first project now has 2 types on 5 lines). Harness B normal / --import (one cell each): see the PR.
### Decisions (pending engineer review)
- 3a2-D1. S per line = the steel app's rule (exterior: adjacent bay; interior: mean of the two bays).
- 3a2-D2. θ per span = the larger |θ| below 30°; ≥ 30° with different skews and the DF computed: blocking input error.
- 3a2-D3. As the steel app: one verdict per type (its worst line), one count per type per check (SB-5); weight per line and bridge total (SB-6).
### Open items (raised, not changed)
- The engine's exterior rigid-section check (C4.6.2.2.2d, `distFactors`) places N_b girders at an equal spacing S (here the exterior bay);
  with unequal bays the actual Σx² differs. Question for the engineer: keep (noted in the Assumptions), or compute it from the actual girder
  positions (an engine change, §4)?
- `loads.de` (d_e for the exterior girder) is entered per type; with different left and right overhangs an exterior type on G1 and G_Nb uses one
  d_e for both (enter a type per side, or the larger d_e).

## 2026-11-13 — PR 3a-3: the bridge level, part 3 — DC2 and DW distributed to each girder line by the Steel Bridge app's method (CALCULATION CHANGE, §4, for projects that use it; projects saved before keep their entered values)
PR #1506: https://github.com/mlococo88/All-Structural/pull/1506
### Request
- Engineer decision PS-9 ("unequal bays + the steel app's DL distribution from the start; results differ from the old app where they
  apply, §4 callouts"); task: "Dead load distribution: use the steel app's DC2/DW distribution method"; plan §7 item 3.
### §4 callout
- **Before** (the old app and PRs 2a–3a-2): DC2 (`loads.wBar`, klf per girder) and DW (`loads.wDW`) were entered per girder design (default
  0.30 / 0.25 klf) and applied unchanged to every girder line.
- **After**, when the project distributes them (`P.xs.dl.mode = 'distributed'`, Cross-section tab; every NEW project): each girder line's
  DC2 and DW = the Steel Bridge app's `dead()` (apps/steel-bridge/engine/loads.js, copied verbatim into `engine/bridge-dl.js`) of the bridge's
  line loads, fed to the engine as that line's `loads.wBar` / `loads.wDW`; nothing else of the engine changes:
  - line loads: each barrier w (klf) at bw/2 from its deck edge (DC2); each sidewalk slab b × t/12 × w_c (DC2, deck concrete for loads);
    added line loads (DC2 or DW at x); the future wearing surface q × (deck width − both traffic faces) (DW);
  - distribution (`METHODS`): MassDOT Bridge Manual Part I 3.5.3 pile-cap P/N_b + max(0, P e c_i / Σc²) for DC2 (wearing surface equally);
    "Typical AASHTO" all loads equally (AASHTO LRFD 10th Ed. Art. 4.6.2.2.1: permanent loads of the deck may be distributed uniformly among
    the beams where the conditions of that article are met); RIDOT BDM 3.3.1 barriers and sidewalks 60 % to the fascia beams, 40 % evenly to
    the interior beams. Dead loads: AASHTO LRFD 10th Ed. Art. 3.5.1, Table 3.5.1-1.
  - **Not** changed: a project saved before this PR (no `xs.dl`) or set to "Entered per girder type" — DC2 / DW as entered, byte-identical
    engine inputs (test over the 17 harness B designs × every line); every old-app import (harness B `--import`: 0 differences).
- **Worked check case** (new project: 120 ft simple span, PCI BT-72, 5 girders at 9 ft, overhangs 3 ft, deck 42 ft; MassDOT pile-cap;
  barriers 0.30 klf × 1.5 ft each side; FWS 25 psf):
  - x̄ = 3 + (0 + 9 + 18 + 27 + 36)/5 = 21 ft; c = −18, −9, 0, 9, 18 ft; Σc² = 810 ft². Left barrier at x = 0.75 ft: e = −20.25 ft.
  - G1: 0.30/5 + 0.30(−20.25)(−18)/810 = 0.060 + 0.135 = 0.195 klf from the left barrier, + 0.060 from the right (its pile-cap term negative →
    0) = **DC2 0.255 klf**; G2: 0.060 + 0.30(20.25)(9)/810 = 0.0675 → 0.1275 + 0.060 = **0.1875**; G3: 0.060 + 0.060 = **0.120**; G4, G5 symmetric.
  - DW: 25 psf × (42 − 1.5 − 1.5) ft = 0.975 klf, equally: **0.195 klf** each line.
  - G2 (interior, the old default design): before DC2 0.30, DW 0.25 → M_DC2 = 0.30 × 120²/8 = 540.0, M_DW = 450.0 kip-ft, Strength I M_u =
    10,251.0 kip-ft, flexure ratio 0.7516; after DC2 0.1875, DW 0.195 → M_DC2 = 0.1875 × 1800 = 337.5, M_DW = 351.0 kip-ft, M_u = 10,251.0 −
    1.25 × 202.5 − 1.50 × 99.0 = **9,849.4 kip-ft** (engine 9,849.4), flexure ratio **0.7222**.
  - G1 (exterior): DC2 0.255 → M_DC2 459.0, M_u 10,430.3 → 10,180.6, flexure 0.7754 → 0.7568. G3: DC2 0.120 → M_u 9,697.5, flexure 0.7110.
  (For a project that entered 0.30 / 0.25 per girder these are less conservative; they follow the entered barrier and wearing-surface weights.)
### Where
- `apps/ps-bridge/engine/bridge-dl.js` (new, `window.PSBBridgeDL`): header (source, pin `58204bac99b576db79d1dc3ac8eed0b47cf70018`, lines 116-217,
  blob 108476a…), the constants dead() reads, the DEAD-VERBATIM slice, `defaults`, `on`, `checks`, `distribute`, `line`, `stepsFor`, `withSteps`.
- `engine/design.js` `one()`: anchor `// PR 3a-3 (PS-9, §4): DC2 and DW of this girder line` — `if (q) o.loads = Object.assign({}, o.loads, { wBar:
  q.DC2, wDW: q.DW });` (before: no such line; the entered values stayed).
- `engine/model.js`: `xs.dl` documented; `newProject()` sets `xs.dl = PSBBridgeDL.defaults(p)`. `engine/inputcheck.js`: the distribution
  checks. `engine/fields.js`: the Loads tab's DC2 / DW fields only when entered (`distOff`), the card note.
- `ui/bridgedl.js` (new, `window.PSBBridgeDLUI`): the Cross-section card (mode, method, barriers, sidewalks, wearing surface, added line
  loads, the per-line DC2 / DW table) and the Loads & LLDF line table (each load's share per line, the line shown marked, § links).
- `ui/loads.js`: topic "DC2 and DW distributed …" (steps dl.*), the dead-load rows say "distributed to G<g>" with links, the line table.
- `index.html`, `report/data.js`: the Loads & LLDF steps + the distribution steps of the line shown (`withSteps`), so the tab and the Report
  work them.
### Copies (CLAUDE.md §3; to move to shared/ later)
- `dead()` / `deadSteps()` of `apps/steel-bridge/engine/loads.js` (byte for byte, verbatim test) and its `ED`, `St`, `n2`–`n4`, `DIST`, `CLS`,
  `METHODS` constants. Keep the copies in step until the move.
### Saved data (CLAUDE.md §5)
- New optional `xs.dl` within `psb2.project` v1; absent = "entered" (the old behaviour; no migration needed, results unchanged). No new key.
### How verified
- `tests/engine/psbridge-dl.test.mjs` (new, 5 tests): verbatim slice; the same DC2 / DW / steps as the steel app's `SBDLoads.dead` (12 cases: 3
  methods × equal / unequal bays × sidewalk); every line's engine inputs take them; saved-before and "entered" byte-identical over the 17 harness
  B designs and every line; the check case above (hand values to 1e-12, M_u 10,251.0 → 9,849.4); input checks. Smoke `ps-bridge-types.mjs` §7.
### Engineer decision PS-21 (2026-11-13, added in this PR before merge)
- The distribution method of a NEW project follows its owner: AASHTO (no owner rule) → "Typical AASHTO" equal share (AASHTO LRFD 10th Ed.
  Art. 4.6.2.2.1); MassDOT → pile-cap (MassDOT Bridge Manual Part I 3.5.3); RIDOT → its 60/40 rule (RIDOT BDM 3.3.1, the steel app's owner
  rule); CTDOT → equal share (the steel app's CTDOT rule: no CTDOT method). A project keeps its stored method. `engine/bridge-dl.js`
  `OWNER_METHOD`, `ownerMethod`, `defaults` (method), `onOwner`; `ui/inputs.js` owner change: a method still at the old owner's default takes
  the new owner's (as the old app's owner defaults; a chosen method is kept), named in the owner-change message (decision pending review: the
  owner-change rule).
- **Check case, new AASHTO project (the default now):** DC2 = (0.30 + 0.30)/5 = **0.120 klf** on every line; DW 0.195 klf. G2: before (entered
  0.30 / 0.25) M_DC2 540.0, M_DW 450.0, M_u 10,251.0 kip-ft, flexure 0.7516 → after M_DC2 = 0.12 × 120²/8 = **216.0**, M_DW 351.0, M_u =
  10,251.0 − 1.25 (324.0) − 1.50 (99.0) = **9,697.5** kip-ft (engine 9,697.5), flexure **0.7110**. G1: M_u 10,430.3 → **9,876.8**, flexure
  0.7754 → **0.7343**. The pile-cap case above remains the check of that method (MassDOT projects).
### Decisions (pending engineer review)
- 3a3-D1. New projects distribute (method by owner, PS-21); saved projects and old-app imports keep their entered DC2 / DW until the user
  switches.
- 3a3-D2. Default barriers = the old app's own barrier (`deck.wBar` 0.30 klf, `deck.bBar` 18 in); FWS 25 psf (the old `deck.wsFut` and the
  steel default).
- 3a3-D3. Inputs offered now: barriers, sidewalk slabs, wearing surface, added line loads (DC2 / DW). Not yet: curbs and railings, fences,
  medians, overlays by thickness, beam-class and per-load overrides (the steel app has them).
- 3a3-D4. The deck design (Diaphragms / deck tab) keeps its own barrier weight and wearing surface (not tied to the distribution inputs).
### Open items
- None of this PR (the default-method question answered by PS-21).

## 2026-11-13 — PR 3a-4: the bridge level, part 4 — the old app's kept girder × span designs restored as girder types (PS-17; no formula change)
PR #1513: https://github.com/mlococo88/All-Structural/pull/1513
### Request
- Engineer decision PS-17 (2026-11-13): "Multi-design import: wait for bridge level 3a; kept designs restored automatically as girder
  types/spans at 3a." PS-18: MIDAS demands stay kept (restored when the MIDAS import arrives). Replaces 2f decision D4 ("kept, NOT designed yet").
### Where
- `apps/ps-bridge/engine/legacy.js` `restore(P, now)` (new, anchor `/* ---------- restore:`): for a project with `P.legacy.bridge` and no
  `P.legacy.restored`: every other stored cell `G<g>/S<s>` of the old model inside this bridge (g ≤ N_b, s ≤ spans) → its girder inputs (the
  old app's `mergeInputs` via `PSBModel.baseInputs`, MIDAS demands left out) minus the bridge-driven paths (`PSBDesign.DRIVEN`: L, S, N_b,
  position, skew, overhang, continuity, title) = its overrides of the base; cells of one span with the same position and overrides share a
  type; a cell with no override and the position of a span type with no override joins it (the old 'pl' cells shared the design's inputs);
  else a new type "<Interior|Exterior> S<s> (old G…)". Lines already typed, cells beyond the bridge and keys that are not cells are listed, not
  assigned. Each restored cell computed both ways: the old app's inputs of that cell (`PBD.applyBridge` on the old model in "Preliminary
  designer"; the stored design in "Design modules") and this project's `cellInputs` — every value compared (warnings and the continuous-unit
  record apart, as 2f's `verify`); the result and any input difference recorded in `P.legacy.restored` and a summary item.
- `engine/legacy.js` `convert`: the kept-cells text now "kept in the project and restored as girder types on their lines (PS-17; listed below)".
- `engine/model.js` `importJSON`: after `PSBBridge.migrate`, `PSBLegacy.restore` (a project imported before this PR is restored when it opens,
  with its notice in `notes`). `index.html`: an import from the old app restores before it opens (toast); the load notes are shown once (toast).
### Saved data (CLAUDE.md §5)
- No new key. `P.legacy.restored` (new optional field of the import record: what was restored, when, and the comparison); `P.types` gains the
  restored types. The old data as read (`P.legacy.inputs`, `P.legacy.bridge`) is never changed (test); restore runs once.
### Governing provisions
- None changed (§4): the restored cells' inputs are the old app's; the engine is the moved one.
### Check case
- Old model 'pl', 3 spans × 5 girders, S = 8 ft; on screen G2/S1; stored G1/S1 and G3/S1 (= the design), G4/S1 (f′c 9.0), G2/S2, G7/S1, a key
  "notes" → types Interior S1 on G2, G3; "Exterior S1 (old G1)" on G1; "Interior S1 (old G4)" on G4 with f′c 9.0; "Interior S2 (old G2)";
  not restored: G7/S1 (beyond 5 girders), "notes"; 4 of 4 compute the same as the old app (every value). 'mod' model with G3/S1 S = 9.5 ft:
  restored on this bridge's S = 8 ft, "0 of 1 compute the same … girder spacing S old 9.5, here 8".
### How verified
- `tests/engine/psbridge-legacy.test.mjs` + 1 test (the check case; computeAll of a restored cell = the old app's applyBridge cell exactly;
  restore once; old data untouched; on load with the notice; 'mod'). Smoke `ps-bridge-skeleton.mjs` 3m: the import restores G2/S1 as
  "Interior S1 (old G2)", "1 of 1 compute the same"; the notice is asserted, then closed (it lay over a button). Harness B `--import` (its
  extra stored cell 'G1/S1x' is not a valid cell key: listed, the design on screen unchanged): the restore notice now shown at import lies
  over the result tab bar (`#toast`, fixed top-right), so the harness's next tab click timed out (exit 1, no count). Harness fix
  (`tests/psbridge-compare.mjs`, after the import summary is read): the notice text must be exactly "The old bridge model's other designs
  were not restored: G1/S1x (not a girder × span cell)." for autosave / shared and none for older / file (a new difference otherwise), then
  closed with its Close button; no comparison changed. Separately, now and then (on main too, before this PR) one click of "Find the old app's
  designs" drew no list and the radio wait timed out (exit 1, no count; not reproduced in 4 reruns): the harness's `scanList` repeats that
  read-only click until the list is drawn (at most 3, logged). 0 differences.
### Decisions (pending engineer review)
- 3a4-D1. Restored cells take this project's bridge (spans, S, overhangs, skews of the imported design); in 'mod' models a cell's own L / S /
  position is not kept — the difference is named per cell and its results flagged.
- 3a4-D2. Stored lines of the old model with no design stay without a type (listed, "Assign every line"), never filled silently.
- 3a4-D3. A restored type whose shape differs from its span's other types stays as imported and is an input error (PS-8) for the user to resolve.

## 2026-11-13 — PS-19: the exterior girder's rigid cross-section factor on the real girder lines with unequal bays (ENGINE ADDITION, §4; equal bays unchanged)
PR #1518: https://github.com/mlococo88/All-Structural/pull/1518
### Request
- Engineer decision PS-19 (2026-11-13), answering the 3a-2 open item: "the exterior rigid-section check (C4.6.2.2.2d) uses the ACTUAL girder
  positions from the bays (Σx², X_ext from real positions). Identical for equal bays (prove). Keep the verbatim pbd-*.js untouched … in an
  app-side module like holddown.js."
### §4 callout
- **Before** (the moved engine, `distFactors` in `pbd-lldf-flexure.js`): X_ext = (N_b − 1) S/2 and Σx² = Σ(−X_ext + iS)², i.e. N_b girders at the
  one spacing S the line gets (3a-2: the exterior bay), R = m (N_L/N_b + X_ext Σe/Σx²), e_j = X_ext + d_e − 5 − 12j.
- **After** (unequal bays only): the same expression on the real girder lines: x_i from the bays, x̄ = Σx_i/N_b, X_ext = |x_ext − x̄|,
  Σx² = Σ(x_i − x̄)²; then g_M = max(e_M g_M2, g_lever, R), g_V = max(e_V g_V2, g_lever, R), × the skew factors, and the one-lane R for the fatigue
  DF, as the engine's following lines. AASHTO LRFD 10th Ed. Art. 4.6.2.2.2d, Eq. C4.6.2.2.2d-1 (and 4.6.2.2.3b for shear).
- **Equal bays:** nothing is added to the inputs (byte-identical inputs and results: test over the 17 harness B designs × every line; harness B
  0 differences); the real-position formula on equal spacing = the engine's R to 1e-12 (4 bridges).
- **Worked check case** (new project, 120 ft, BT-72, bays 8, 10, 10, 8 ft, G1, d_e 2.0 ft, N_L 2): x = 0, 8, 18, 28, 36 ft; x̄ = 18; X_ext = 18;
  Σx² = 18² + 10² + 0 + 10² + 18² = 848 ft². One lane: e = 18 + 2 − 5 = 15, R = 1.2 (1/5 + 18 × 15/848) = 0.6221; two lanes: Σe = 15 + 3 = 18,
  R = 1.0 (2/5 + 18 × 18/848) = **0.7821** (governs). Before (engine form at S = 8 ft): X_ext = 16, Σx² = 640, R = 0.4 + 16 × 14/640 = 0.7500.
  g_M = max(0.9898 × 0.6612 = 0.6545, lever 0.7500, R 0.7821) = **0.7821** (before 0.7500); g_V likewise 0.7821 (before 0.7500); M_LL+IM per
  girder 2,739.3 → **2,856.5 kip-ft**; flexure ratio 0.7063 → **0.7216**. Interior lines unchanged.
### Where
- `apps/ps-bridge/engine/rigid.js` (new, `window.PSBRigid`): `rigidOf`, `adjust`, `run` (computeAll with the global distFactors wrapped for that
  call when `inputs.rigidX` is given, restored after; the moved files are not edited).
- `engine/design.js` `one()`: anchor `// PS-19 (§4)` — `o.rigidX = { x, g }` only for an exterior line (G1, G_Nb) when the bays are unequal (interior lines and equal bays: inputs unchanged). `engine/holddown.js` `compute`:
  `PSBRigid.run(inp)` instead of `computeAll(inp)`. `index.html`: loads `engine/rigid.js` (before holddown.js).
- `engine/worked.js`: with `df.rigidX` the steps x̄, X_ext, Σx² and R with its substitution (the engine's equal-spacing R in the note);
  `ui/loads.js` topic ids.
### Saved data
- None (inputs.rigidX is computed, not saved).
### How verified
- `tests/engine/psbridge-rigid.test.mjs` (new, 2 tests): equal bays byte-identical; the formula = the engine's on equal spacing; the check case.
  Smoke `ps-bridge-types.mjs` §6: the steps on Loads & LLDF, values = the page's result. Harness A (verbatim, parity) unchanged.
- Harness B (`tests/psbridge-compare.mjs`, test only): the occasional `--import` time-out (on main too) caught in a run: the reloaded page's
  storage held none of the keys the harness had put (only the seed and `psb2.ui`; the browser storage of the page reset), so the old app's
  list had nothing. New `reloadKept(p, name, o, wait)` replaces the two `await nw.p.reload(); …` lines (normal mode: `psb2.project.current`;
  `--import`: the old keys of the design): after the reload each key must hold the value put, else the keys are put again and the page
  reloaded (at most 3, a `note` line in the log; an error after 3). PR 3a-4's `scanList` (a repeated "Find" click) is removed: a missed click
  was not the cause. No comparison changed.

## 2026-11-13 — PS-20: d_e of each exterior girder line from the bridge cross-section; each exterior line its own LLDF, the worst line governs (CALCULATION CHANGE, §4, for projects with the cross-section barriers; equal overhangs: both lines identical)
PR #1521: https://github.com/mlococo88/All-Structural/pull/1521
### Request
- Engineer decision PS-20 (2026-11-13), answering the 3a-2 open item: "d_e per exterior line computed from the bridge cross-section (that
  line's overhang minus barrier/curb width), each exterior line its own LLDF; worst line governs. Identical when overhangs equal (prove)."
### §4 callout
- **Before:** `loads.de` (the distance from the exterior web to the inside face of the barrier) entered once per girder type (default 2.0 ft) and
  used on both exterior lines (G1 and G_Nb), whatever their overhangs.
- **After** (`engine/design.js` `deOf`, a project with the cross-section barriers `xs.dl`, i.e. every project made since PR 3a-3): an exterior
  line's d_e = its side's overhang (girder ℄ to deck edge) − the traffic face from that edge: the barrier width, or a sidewalk 12 in or thicker
  that reaches farther in (its curb face; a thinner sidewalk is mountable, the steel app's `llFaces` rule). AASHTO LRFD 10th Ed. Art. 4.6.2.2.1
  (d_e: "distance from the exterior web of exterior beam to the interior edge of curb or traffic barrier"), used by the engine's lever rule,
  e = 0.77 + d_e/9.1 (Table 4.6.2.2.2d-1), e_V = 0.6 + d_e/10 (Table 4.6.2.2.3b-1) and the rigid section (C4.6.2.2.2d), unchanged. Each
  exterior line already has its own cell (3a-2): its own DF, the type's worst line governs.
- **Not changed:** a project without `xs.dl` (saved before PR 3a-3, old-app imports): d_e as entered (test: 17 harness B designs, every line;
  harness B 0 differences). Interior lines: d_e not used (left as entered).
- **Equal overhangs:** G1 and G_Nb get the same d_e and identical inputs and results (but the girder label and the side; test).
- **Worked check case** (new project, 5 girders at 9 ft, 120 ft, barriers 1.5 ft; overhangs **3 ft left, 4 ft right**; N_L 2):
  - d_e: G1 = 3 − 1.5 = **1.5 ft**; G5 = 4 − 1.5 = **2.5 ft** (before: 2.0 ft entered, both).
  - Lever rule (m 1.2; wheels at d_e − 2 and d_e − 8 ft from the exterior web): G1 1.2 × [0.5(9 − 0.5) + 0.5(9 − 6.5)]/9 = **0.7333**;
    G5 1.2 × [0.5(9 + 0.5) + 0.5(9 − 5.5)]/9 = **0.8667** (d_e 2.0: 0.8000).
  - e_M: G1 0.77 + 1.5/9.1 = 0.9348; G5 0.77 + 2.5/9.1 = 1.0447 → e_M g_M2 = 0.6723 / 0.7513.
  - Rigid, 2 lanes (X_ext 18, Σx² 810): G1 Σe = 14.5 + 2.5 = 17 → 0.4 + 18 × 17/810 = **0.7778**; G5 Σe = 19 → 0.8222.
  - DF_M: G1 max(0.6723, 0.7333, 0.7778) = **0.7778**; G5 max(0.7513, 0.8667, 0.8222) = **0.8667** (both 0.8000 before). M_LL+IM per girder
    2,921.9 kip-ft before → G1 **2,840.8**, G5 **3,165.4**; the Exterior type's flexure governs on G5.
### Where
- `engine/design.js`: `deOf(P, g)` (new), `one()` anchor `// PS-20 (§4)` (`o.loads.de = deOf(...)` when not null), `driven()` row.
- `engine/fields.js`: the d_e field only without the cross-section barriers; the card note gives each exterior line's d_e.
### Saved data
- None (computed from the saved cross-section).
### How verified
- `tests/engine/psbridge-de.test.mjs` (new, 3 tests): no barriers → as entered (17 designs, every line); equal overhangs → G1 = G5; the check case.
  `psbridge-dl` and `psbridge-rigid` tests: their entered-d_e expectations set the barriers or remove them. Smoke `ps-bridge-types.mjs` §6.
### Decisions (pending engineer review)
- PS20-D1. The traffic face: the barrier width, or a ≥ 12 in sidewalk's curb face (the steel app's rule); this app has no curb input yet.
- PS20-D2. d_e computed whenever the project has the cross-section barriers (also with DC2 / DW "entered").

## 2026-11-13 — PS-22: the app's notices as inline banners above the tab content (display only; no calculation, no saved data)
PR #1525: https://github.com/mlococo88/All-Structural/pull/1525
### Request
- Engineer decision PS-22 (2026-11-13, display): notices (the import / restore notice of 3a-4 and every other app notice) become an inline
  banner in the page flow above the tab content, pushing the content down, never covering the tab bar; they stay until closed.
### Where
- `apps/ps-bridge/index.html` only. The app's one notice mechanism is `toast(text, undo)` (callers unchanged: the owner change's inputs
  (`IN.takeNote`), the girder types re-assigned / new spans' types (with Undo), the type controls' notes (`typesDone`), the old app's designs
  restored (`lgCtx.replace`, PR 3a-4), the load notes `L.notes` (PR 3a-1 / 3a-4)). No other module draws a notice (no other fixed element).
- Markup: `<div id="toast" role="status" hidden></div>` (first child of `<body>`) removed; new `<div id="notices" role="status"
  aria-live="polite"></div>` in `#outputPanel` between `<div id="tabBar" role="tablist"></div>` and `<div id="out"></div>`.
- CSS, anchor `/* PS-22 (engineer decision`: before
  `#toast{position:fixed;right:14px;top:84px;max-width:min(520px,calc(100vw - 28px));max-height:60vh;overflow:auto;z-index:50;…}` and
  `#toast[hidden]{display:none;} #toast.err{…} #toast ul{…} #toast .tBtns{…} #toast .tFld{…} #toast .tArr{…}`; after
  `#notices:empty{display:none;} #notices{margin:6px 0 0;display:flex;flex-direction:column;gap:6px;}`,
  `#notices .notice{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px 10px;background:#fff;border:1px solid var(--slate-400);border-left:4px solid var(--navy-800);border-radius:6px;padding:7px 10px;font-family:var(--font-ui);font-size:9.5pt;}`,
  `#notices .notice>div:first-child{flex:1 1 240px;min-width:0;overflow-wrap:anywhere;} #notices .nBtns{display:flex;gap:6px;margin-left:auto;}`
  (no position: in the flow); print: `#toast` → `#notices` in the `@media print{ #hdrBtns,… {display:none!important;}` list (not printed, as before).
- `toast(text, undo)`, anchor `function toast(text, undo) {`: before
  ```js
  function toast(text, undo) { const t = $('toast'); t.className = ''; t.innerHTML = `<div>${esc(text)}</div><div class="tBtns">${undo ? '<button type="button" id="tUndo">Undo</button>' : ''}<button type="button" id="tClose">Close</button></div>`; t.hidden = false; $('tClose').onclick = () => { t.hidden = true; };
    if (undo) $('tUndo').onclick = () => { t.hidden = true; P = JSON.parse(undo); changed(); }; }
  ```
  after
  ```js
  function toast(text, undo) { const box = $('notices'), n = document.createElement('div');
    [...box.children].forEach(c => { if (c.dataset.text === String(text)) c.remove(); else { const u = c.querySelector('.nUndo'); if (u) u.remove(); } });
    n.className = 'notice'; n.dataset.text = String(text);
    n.innerHTML = `<div>${esc(text)}</div><div class="nBtns">${undo ? '<button type="button" class="nUndo">Undo</button>' : ''}<button type="button" class="nClose">Close</button></div>`;
    box.prepend(n); n.querySelector('.nClose').onclick = () => n.remove();
    if (undo) n.querySelector('.nUndo').onclick = () => { n.remove(); P = JSON.parse(undo); changed(); };
    const op = $('outputPanel'), top = n.offsetTop - $('tabBar').offsetHeight; if (op.scrollTop > top) op.scrollTop = Math.max(0, top); }   // brought into view below the sticky tab bar
  ```
  The banners live outside `#out`, so redrawing a tab or opening another keeps them; each goes only with its Close (or Undo).
### Saved data (CLAUDE.md §5)
- None (no key, no format; the notices are not stored, as before).
### Governing provisions
- None (display only; no value, formula or check changed).
### Check case
- New project, Owner rules tab, owner AASHTO → RIDOT: the banner "… mat.H 70 → 80 …" is drawn below the tab bar (its top ≥ the tab bar's
  bottom), in the flow (position static), `#out` below it; opening Loads & LLDF and Summary keeps it; Close removes it. Before: the same text
  in a box fixed at the top right over the result tabs, closed by Close or replaced by the next notice.
### How verified
- Smokes `ps-bridge-skeleton.mjs` (owner change: the banner's placement (inline, below the tab bar, `#out` pushed down, between `#tabBar` and
  `#out`), kept across tab clicks, Close removes it; the 3m import's restore notice inline below the tab bar; the selectors `#toast` /
  `#tClose` → `#notices` / `#notices .nClose`) and `ps-bridge-types.mjs` §3 (`#tUndo` → `#notices .nUndo`; Undo puts N_b and the lines back).
- Harness B (`tests/psbridge-compare.mjs`, test only): the `--import` restore notice is read from `#notices` (the same expected text,
  "… G1/S1x (not a girder × span cell).Close", or none); new: a notice not in the flow or above the tab bar's bottom is a difference (its text
  gets " [over the tab bar]"); every notice then closed with its Close button. No comparison changed or removed.
  Runs: normal 17 designs, 43,512 shown values + 7,646 step values, **0 differences** (exit 0); `--import` 17 designs (autosave 5, shared 4,
  older 4, file 4), 0 differences (exit 0); `--control` and `--import --control`: 17 with differences, exit 1 (the controls still bite).
- `node tests/check-syntax.mjs` (163 files); `tests/engine/psbridge-*.test.mjs` (11 files) pass; smokes skeleton 252 checks, types 52 checks, 0 failed.
### Decisions (pending engineer review)
- PS22-D1. The banners stack, newest first; the same text again replaces its open banner; Undo stays only on the newest (an older Undo
  would put back a project that has changed since; before, the next notice replaced the box and its Undo).
- PS22-D2. A new notice scrolls the output panel up just enough to show it below the sticky tab bar when the panel is scrolled past it
  (otherwise the scroll position is kept).

## 2026-11-13 — PS-23: a notice where the entered d_e differs from the d_e computed from the cross-section (PS-20); the Report lists it in its assumptions (display only; no calculation change)
PR #1526: https://github.com/mlococo88/All-Structural/pull/1526
### Request
- Engineer decision PS-23 (2026-11-13, display): when a project opens and the computed per-line d_e (PS-20, #1521) differs from the
  entered d_e, show a notice (inline banner, PS-22 style) on the Loads & LLDF tab naming each exterior line's entered vs computed d_e and
  that the distribution factors use the computed value; it stays until dismissed for that project (the dismissal in the psb2 project or
  the existing psb2.ui key, no new storage key); the Report always lists the same difference in its assumptions / notes.
### Where
- `apps/ps-bridge/engine/design.js` (new, after `deOf`, anchor `/* deDiff(P): PS-23`): `deDiff(P)` → `{ rows: [{ g, side, spans, entered,
  computed }], sig }`: for every checked cell (`PSBBridge.cells`) on an exterior line (G1, G_Nb) with the cross-section barriers (`P.xs.dl`),
  computed = `deOf(P, g)` (PS-20, unchanged), entered = `PSBBridge.effBase(P, k).loads.de` (the girder type's d_e on that line); a row where
  |entered − computed| > 1e-9 ft, one per line and entered value (spans named only where the row is not every span of the line); `sig` = the
  rows (`G1:2>1.5;G5:2>2.5`). `deText(D, sub)`: the text, with d_e's subscript as HTML or the Report's `$_{e}$`. Exported on `window.PSBDesign`.
- `apps/ps-bridge/index.html`: `deNotice()` (new, anchor `function deNotice()`): on the Loads & LLDF tab (`drawOut`, after `TY.outBar(P)`:
  `if (ui.otab === 'lds') h += deNotice();`) a banner `<div class="notice" id="deNotice">` with the text, a link to the Cross-section tab and
  a Close button (`data-dedismiss`), unless `P.notices.de === deDiff(P).sig`. The `#out` click handler: Close sets
  `P.notices = Object.assign({}, P.notices, { de: D.sig })` and `changed()` (autosaved with the project). CSS: the PS-22 banner rules extended
  to `#out .notice` (`#out .notice{margin:8px 0;}`).
- `apps/ps-bridge/report/builders.js` `proj()`: the Assumptions sub gets `...deNote(P)` (new `deNote(P)`: "• d$_{e}$ of the exterior girder
  lines (PS-20): … (see [[rs.lds]])" when deDiff has rows, else nothing).
- Before (all three files): no notice; the Report's Assumptions = the input-tab assumptions + the six ASSUME lines.
### Saved data (CLAUDE.md §5)
- No new storage key. The psb2 project gains an optional field `notices: { de: '<sig>' }`, written only when the user closes the notice
  (a project without it reads as "not dismissed"; old copies of the app keep and ignore it: `importJSON` / `exportJSON` pass unknown fields).
### Governing provisions
- None changed. d_e: AASHTO LRFD 10th Ed. Art. 4.6.2.2.1 as PS-20 computes it (#1521); the engine inputs and every result are unchanged.
### Check case
- New project, 5 girders at 9 ft, overhangs 3 ft left / 4 ft right, barriers 1.5 ft, entered d_e 2.0 ft (the default):
  G1 d_e = 3 − 1.5 = 1.5 ft; G5 = 4 − 1.5 = 2.5 ft → notice "G1: entered 2.0 ft, computed 1.5 ft (left overhang); G5: entered 2.0 ft,
  computed 2.5 ft (right overhang). The live-load distribution factors use the computed d_e."; the same sentence in the Report's
  Assumptions. Before: no notice, no note. Overhangs 3.5 / 3.5: 3.5 − 1.5 = 2.0 = entered → no notice, no note (identical to before).
### How verified
- `tests/engine/psbridge-denotice.test.mjs` (new, 3 tests): the check case (rows, sig, text; deDiff writes nothing; the cell inputs keep
  1.5 / 2.5, PS-20); where they match (3.5 / 3.5; within 1e-9) and the 17 harness B designs without barriers: no rows; three spans with
  span 2's exterior type entered 1.5 (= computed): rows for spans 1, 3 only, named; the key changes with the difference.
  `node tests/engine/run.mjs psbridge`: 12 files, 114 passed, 0 failed.
- Smoke `ps-bridge-types.mjs` §8 (new): ohR 4 → the banner on Loads & LLDF (inline, below the tab bar) with the check-case text; tab values
  = computeAll; not on another tab; the Report lists it; Close → `P.notices.de = 'G1:2>1.5;G5:2>2.5'`, gone after a reload, the Report still
  lists it; ohL 3.25 → shown again (G1 computed 1.75); 3.5 / 3.5 → no banner, no Report note; psb2.* keys only.
  Smokes: types 64 checks (52 + 12 new), skeleton 252 checks, 0 failed. Harness B (unchanged by this PR): normal 17 designs, 43,512 shown +
  7,646 step values, 0 differences (exit 0); `--import` 0 differences (exit 0); `--control` / `--import --control` 17 with differences, exit 1.
  `node tests/check-syntax.mjs` passes.
- Equality where they match (browser probe, origin/main 4cdcc75 vs this branch, the Loads & LLDF tab, the Report and the Summary tab's
  `#out` HTML and `#notices`): 23 projects — new projects with 3.5 / 3.5 overhangs; barriers 1.0 ft with 3.0 overhangs; three continuous
  spans; a 12 in sidewalk curb face (3.25 / 4 ft, barriers 1.25, sidewalk 2 ft: 2.0 both); DC2 / DW entered; G1 shown; and the 17 harness B
  designs (no barriers) — **23 of 23 byte-identical**, deDiff rows 0 in each.
### Decisions (pending engineer review)
- PS23-D1. The notice shows whenever the difference exists and is not dismissed (on opening the project and after an edit that makes it);
  a different difference (another overhang, barrier or entered d_e) shows it again; the dismissal is kept in the project (exported with it).
- PS23-D2. "Entered d_e" is the girder type's `loads.de` on that line (base or the type's own value); a line whose types differ by span
  names the spans.
### Open item (question for the engineer)
- Every new project shows the notice: its hidden entered d_e is the default 2.0 ft while the default cross-section (3.0 ft overhangs, 1.5 ft
  barriers) computes 1.5 ft. Keep it, or not count the default (unedited) entered value as "entered"?

## 2026-11-13 — PS-24: a new project's entered d_e = the d_e computed from its default cross-section (1.5 ft), so a fresh project shows no PS-23 notice (new projects only; results unchanged)
PR #1528: https://github.com/mlococo88/All-Structural/pull/1528
### Request
- Engineer decision PS-24 (2026-11-13), answering the PS-23 (#1526) open item: new PS Bridge projects set each girder type's entered d_e
  (loads.de) to the value computed from the default cross-section (1.5 ft for the default 3.0 ft overhangs / 1.5 ft barriers), so no d_e
  banner shows on a fresh project. Saved projects unchanged (prove). Results of new projects unchanged (they already use the computed value).
### Where
- `apps/ps-bridge/engine/model.js` `newProject()`, anchor `// PS-24 (engineer decision 2026-11-13)`. Before:
  ```js
    if (window.PSBBridgeDL) p.xs.dl = window.PSBBridgeDL.defaults(p);   // PR 3a-3: DC2 / DW distributed (PS-9)
    return p;
  ```
  After:
  ```js
    if (window.PSBBridgeDL) p.xs.dl = window.PSBBridgeDL.defaults(p);   // PR 3a-3: DC2 / DW distributed (PS-9)
    // PS-24 (…)
    const D = window.PSBDesign, de = D && p.xs.dl ? D.deOf(p, 1) : null;
    if (de != null && isFinite(de)) { p.base.loads.de = de; p.types.forEach(t => { if (t.ovr && 'loads.de' in t.ovr) t.ovr['loads.de'] = de; }); }
    return p;
  ```
  The new types carry no `loads.de` override, so every type's entered d_e is the base's 1.5 ft. `defaultProject()` (tests, harnesses) unchanged.
- Only `newProject()` changes: the page's first start with nothing stored, New project, and an unreadable stored project replaced by a new
  one (`load`). A saved or imported project is never passed through it.
### Saved data (CLAUDE.md §5)
- No key or format change; nothing rewritten on load. A project saved before PS-24 keeps its entered 2.0 ft (and its PS-23 notice).
### Governing provisions
- None changed. d_e: AASHTO LRFD 10th Ed. Art. 4.6.2.2.1, computed per exterior line by PS-20 (#1521); interior lines do not use d_e.
### Check case
- New project (5 girders at 9 ft, 120 ft, overhangs 3.0 / 3.0 ft, barriers 1.5 ft): entered d_e before 2.0 ft, after 3.0 − 1.5 = **1.5 ft**;
  computed G1 = G5 = 1.5 ft (unchanged); PS-23 notice before "G1: entered 2.0 ft, computed 1.5 ft …; G5: …", after none; Report note before
  listed, after none. Results of every cell (Interior S1 on G2–G4, Exterior S1 on G1, G5): byte-identical (the exterior inputs had d_e 1.5
  already; the interior inputs' loads.de 2.0 → 1.5 is not used by the engine).
### How verified
- Main (14198d9) vs this branch, Node probe: the new project's computeAll + PS-10 of all 5 cells **byte-identical**; 18 saved projects
  (a new project saved before PS-24 and the 17 harness B designs) load identically on both (project, engine inputs) and the stored text is
  not rewritten.
- `tests/engine/psbridge-denotice.test.mjs`: the PS-23 cases now model a project saved before PS-24 (entered 2.0 set explicitly); new test:
  a new project enters 1.5 on every type, no rows, every cell's inputs (exterior) and results byte-identical to the same project with 2.0
  entered. `node tests/engine/run.mjs psbridge`: 12 files, 115 passed, 0 failed.
- Smoke `ps-bridge-types.mjs` §8: a fresh project shows no d_e banner (entered 1.5); the PS-23 checks run on a project saved before PS-24
  (65 checks, 0 failed). Skeleton smoke 252 checks, 0 failed.
  Harness B: normal 17 designs 0 differences (exit 0); `--import` 0 differences (exit 0); `--control` / `--import --control` 17 with
  differences, exit 1. `node tests/check-syntax.mjs` passes.

## 2026-11-13 — PR 3b: the Summary tab — girder × span grid, governing ratio of each check group per girder type (worst line named), weights per line and bridge total, links to the worked steps; every girder type × line computed in chunks with Stop / Run all (display only; no calculation change)
PR #1529: https://github.com/mlococo88/All-Structural/pull/1529
### Request
- Plan §5 row 3b: "Summary tab and check-summary chips (girder × span grid), run all (chunked, Stop)", display. The Steel Bridge app's
  Summary as the pattern (`apps/steel-bridge/ui/summary.js`, SUMT #1271, DASH #1272, girder types SB-2 PR 2 #1454): the verdict and its
  counts, the governing check as a link, the run state ("Up to date" / running / Re-run all), the overview with the girder weight, the
  table with a row per girder type and per line, the governing check per column, the warnings. Engineer decisions SB-5 (one count per type
  per check, its worst line), SB-6 (weight per line, bridge total), PS-8 (types per span), CLAUDE.md §6 (every value linked to its work).
### What the Summary tab shows (`apps/ps-bridge/ui/summary.js`, new, `window.PSBSummaryUI`; adapted copy of the steel file's layout and CSS)
1. **Verdict**: PASS / FAIL badge; FAIL / PASS / off counts = the check summary column's (`PSBDashUI.grp`, one per girder type per check,
   its worst line); the governing check with its group, type, line and span, its ratio a link; the lowest HL-93 inventory RF (not counted);
   lines with no type (red); the run line ("Up to date: n girder type × line results of this project state (computed in t s)" / "Running
   … (i / n)" with Stop / "Stopped: i of n …" with Run all), Re-run all, a link to the Report.
2. **Project overview**: the entered values (as the PR 3a-2 Project card) and the girder weight per line, per type and the bridge total
   (engine/bridge.js `results` W = w_sw (L + 2 e_end/12) per line, SB-6) with a § link to the hold-down step W (End zone & hold-down).
3. **Girder × span grid** (`#sum-grid`): a row per girder line (exterior / interior), a column per span (L); each cell the girder type on
   it, its governing ratio (the largest of all its checks), the group, PASS or FAIL (n checks over 1.0); "not checked" where no type.
4. **Governing ratio of each check group, per girder type** (`#sum-table`, replaces PR 3a-2's `#card-tysum`): grouped by span; per type the
   group's largest ratio over its lines with PASS / FAIL and the line named (SB-5), a row per line, the lowest RF, the weight; footer the
   bridge total.
5. **Governing check of each group, per girder type** (`#sum-checks`, one `<details>` per type): check, line, x, demand, limit, unit,
   ratio, status.
6. The design girder card of PR 2b-2 (the type and line shown on the output tabs) — unchanged.
7. **Lines not checked, groups off (Handling, Deck: link to turn on), engine errors, the engine's design warnings per type (lines named).**
- Every value links (`data-sumgo="k|g|tab|step|input"`) to its tab with that girder type and line shown (P.design, as the check summary
  column's links) and its worked step opened (`gotoStep`); an owner limit opens the Owner rules tab at its row (as the column).
- Nothing is calculated in the UI: each number is an engine value (`R.checks[i].r / v / lim / loc`, `R.rating…`) of that cell's
  `PSBHoldDown.compute` (computeAll + PS-10), or a weight of engine/bridge.js; the UI only chooses the largest (RF: the smallest). Each
  number carries `data-sv="k|g|<R path>"` (weights `data-sw`) for the tests.
### Run all (chunked, Stop) — `apps/ps-bridge/index.html` `allResults(force)`, `runAll`, `runCtl`, `runState`
- Before: `allResults()` computed every girder type × line at once (`BR.results(P, cellR)`) whenever the project text changed.
- After: when more than 8 cells are not in the cell cache (`CELLS`, the PR 3a-1 cache of `PSBHoldDown.compute` by input text), they are
  computed one per timer tick (`runAll`: `cellR(inputs)`, progress written in place in `#sumRunMsg` and the check summary column), then
  `BR.results(P, cellR)` over the filled cache — **the same call on the same inputs, so the same values**; up to 8 at once as before. While
  it runs `allResults()` returns null: the check summary column shows the chips of the type and line shown with "Running every girder type
  × line (i / n)… [Stop]"; the Summary tab shows the run line. Stop keeps the cells computed; Run all goes on; Re-run all drops this
  project's cells from the cache and computes them again. The Report tab computes at once (`allResults(true)`). Memory only, nothing saved.
- Measured (headless Chromium, file://): about 8 ms per cell — 5 cells 0.04 s, 15 cells (3 spans) 0.25 s, 40 cells 0.30 s, 72 cells 0.59 s.
### Report (`apps/ps-bridge/report/builders.js` summary(), sub "Every girder type and line", several cells)
- Before: one table (type, span, worst line, governing check, ratio, status, weight; a row per line).
- After: the verdict sentence (FAIL / PASS counted as the Summary, SB-5); the **girder × span grid** (each cell type, ratio, PASS / FAIL,
  group and "see §n" of the section that works it); the **group table** (type, span, group, governing check, line, ratio, status, "see §n";
  the owner limits "see" the Owner rules subsection; the lowest RF "see §14"); the **weights** per line, per type and the bridge total
  (see §10 for W). The values are `PSBSummaryUI.model` of the same results (`B.all`). The report still works the type and line shown; the
  note says the other lines' steps are on the tabs with that type and line chosen.
### Other changes
- `ui/dash.js`: exports `grp` (the Summary's counts); `runTxt(o)` (the running / stopped line with Stop / Run all, `o.run`, `o.runCtl`).
- `ui/types.js`: `summaryCard` removed (moved into ui/summary.js as the group table).
- `index.html`: loads `ui/summary.js`; the Summary branch of `drawOut` (the Project card, design girder card, `TY.summaryCard` and the
  "PR 3b" placeholder replaced by `PSBSummaryUI.html`); `#out` click handler: `data-sumgo`, `data-sumrun`; dash init `run`, `runCtl`.
### Saved data (CLAUDE.md §5)
- None: no key, no field, no format change; the run state is memory only; the chosen type and line of a link is P.design (as PR 3a-2).
### Governing provisions
- None changed (display only). The checks, ratios and limits are the engine's as before (AASHTO LRFD 10th Ed. articles cited at each step).
### Check case (new project: 120 ft, 5 girders at 9 ft, BT-72, Interior S1 on G2–G4, Exterior S1 on G1, G5)
- Summary verdict FAIL, **2 FAIL / 38 PASS / 2 off** (the column's counts); governing "End zone & hold-down, girder type Interior S1 on G2
  (span 1): Hold-down force (PS-10) — ratio 1.276"; lowest RF Shear, inventory 1.735. Grid: every line 1.276 "End zone & hold-down · FAIL
  (1)". Weights 99.1 kip per line; Interior S1 297.2, Exterior S1 198.1, bridge total 495.4 kip. Before (3a-2) the same ratios and weights
  in the type table; after the same numbers plus the grid.
- Three spans 100 + 120 + 100 ft made continuous (6 types, 15 cells): chunked run, "Up to date: 15 … (0.13 s)"; Report §1 grid G1/S1
  "Exterior S1: 2.208 FAIL (3), End zone & hold-down (see §10)".
### How verified
- Results identical: no file under `apps/ps-bridge/engine/` changed; the chunked run fills the same cache that `BR.results` reads.
  Harness B (`tests/psbridge-compare.mjs`): normal 17 designs, 0 with differences, exit 0; `--import` 17 designs imported, 0 with differences, exit 0; `--control` 17 with differences, exit 1; `--import --control` 17 with differences, exit 1.
- New `tests/engine/psbridge-summary.test.mjs` (4 tests) over 22 projects (the 17 harness B designs migrated, a new project, one type on
  every line, three types with own inputs on unequal bays, three spans continuous, two spans with G5/S2 not checked): every Summary number
  (data-sv) = an independent PSBHoldDown.compute of that type × line, exactly; every weight; the grid, the type × group values, the RF and
  the verdict counts (= the column's) from the engine checks; every link names a type × line of the project and a worked step its tab shows
  for that cell (or the owner row); the Report's grid and group table carry the same ratios with "see §" references. Controls: a ratio
  shown × 1.001 fails test 1; the group choice made "first" instead of "largest" fails test 2.
- `node tests/engine/run.mjs psbridge tex project-registry`: 16 files, 142 passed, 0 failed; `psbridge-model.test.mjs` page script list + ui/summary.js.
- Smokes: `ps-bridge-types.mjs` §6 (the table now `#sum-table`, its line link) and new §9: five projects (new, single type, three types,
  three spans continuous, a line not checked) on file:// at 1400 px — values and weights = the page's computeAll per cell, counts = the
  column's, grid lines × spans and "not checked", a grid link opens its tab with that type, line and step shown, the tab's values = that
  cell's; Stop (no grid, the column says Stopped), Run all (the same values), the column during a run; §5 390 px Summary without sideways
  scroll; 0 console errors: 95 checks, 0 failed. `ps-bridge-skeleton.mjs`: 252 checks, 0 failed. `node tests/check-syntax.mjs` passes.
### Decisions (pending engineer review)
- 3b-D1. Chunked run threshold: more than 8 cells not yet computed run in chunks (one cell per tick); up to 8 at once (about 0.07 s). The
  Report tab computes at once. Stop keeps what was computed; a later input change starts a new run (as the steel Summary runs on a change).
- 3b-D2. Grid cell: the largest ratio of all the cell's checks (a ratio that is not a number first, as engine/bridge.js `gov`); its FAIL
  number counts that line's checks over 1.0 (information; the verdict counts once per type per check, SB-5).
- 3b-D3. The Summary's rating column / verdict line: the lowest HL-93 inventory RF per type (as the Rating chip), not a check, not counted.
- 3b-D4. Report §1 references each group to the section that works it for the reported type and line ("see §n"); the other lines are
  worked on the tabs, not repeated in the report.
- 3b-D5. While a run is in progress or stopped, the check summary column shows the chips of the type and line shown (not the last
  results as out of date, the steel column's way), with the running / stopped line.
### Other copies
- `ui/summary.js` is an adapted copy of `apps/steel-bridge/ui/summary.js` (layout, CSS, wording; to move to shared/ later, CLAUDE.md §3).
  apps/steel-bridge not changed.
### Open items
- None new.
### Before / after (exact; `ui/summary.js` and the test are new files)
```diff
diff --git a/apps/ps-bridge/index.html b/apps/ps-bridge/index.html
index 4ef7f84..435c64f 100644
--- a/apps/ps-bridge/index.html
+++ b/apps/ps-bridge/index.html
@@ -22,3 +22,5 @@
      DC2 and DW distributed to each girder line by the Steel Bridge app's method (engine/bridge-dl.js, ui/bridgedl.js; §4). PR 3a-4: an
-     imported old bridge model's other designs restored as girder types (engine/legacy.js restore, PS-17).
+     imported old bridge model's other designs restored as girder types (engine/legacy.js restore, PS-17). PR 3b: the Summary tab
+     (ui/summary.js: verdict, girder × span grid, type × check-group table, weights, links to the worked steps) and the run of every type
+     × line in chunks with Stop / Run all / Re-run all.
      The old Prestressed Bridge Design.html stays the working tool. -->
@@ -87,2 +89,3 @@
     'ui/dash.js',     // the check summary column (adapted copy of apps/steel-bridge/ui/dash.js)
+    'ui/summary.js',  // PR 3b: the Summary tab (adapted copy of apps/steel-bridge/ui/summary.js): verdict, girder × span grid, type × check table
     'ui/splitter.js'  // the splitter between the input and output panels (copy of apps/steel-bridge/ui/splitter.js)
@@ -477,3 +480,3 @@
     if (RC.key !== key) { let R; try { R = window.PSBHoldDown.compute(JSON.parse(key)); } catch (e) { R = { error: e.message }; } RC = { key, inp, R, W: null }; }
-    RC.all = allResults(); RC.allKey = ALL.key;   // PR 3a-2: the Report's table of every type and line
+    RC.all = allResults(ui.otab === 'rpt'); RC.allKey = ALL.key;   // PR 3a-2: the Report's table of every type and line (PR 3b: computed at once on the Report tab)
     if (!RC.R.error && !RC.W) { const PW = window.PSBWorked, PS = window.PSBWorkedStress; try { RC.W = { section: PW.section(RC.inp, RC.R), loads: PW.loads(RC.inp, RC.R), analysis: PW.analysis(RC.inp, RC.R),
@@ -492,5 +495,43 @@
   }
-  /* PR 3a-2: every girder type on every line (engine/bridge.js results over cellR), kept while the project text is the same */
-  let ALL = { key: '', A: null };
-  function allResults() { if (errs.length) return null; const key = JSON.stringify(P); if (ALL.key !== key) ALL = { key, A: BR.hasTypes(P) ? BR.results(P, cellR) : null }; return ALL.A; }
+  /* PR 3a-2: every girder type on every line (engine/bridge.js results over cellR), kept while the project text is the same.
+     PR 3b (docs/ps-bridge-plan.md §5 row 3b, "run all (chunked, Stop)"; the steel Summary's run, apps/steel-bridge/ui/summary.js start()):
+     when more than SYNC_N cells are not yet in the cell cache, the cells are computed one per timer tick (the page stays responsive; the
+     Summary tab and the check summary column show "Running … (i / n)" with Stop), then BR.results over the filled cache, the same call and
+     the same values as computed at once (only the time of computing changes). Until then allResults() returns null (the chips: the girder
+     type and line shown). The Report tab computes at once (force). Stop keeps the cells computed so far; Run all goes on; Re-run all
+     computes every cell of this project state again. Nothing is saved (memory only, as the steel Summary). */
+  const SYNC_N = 8;
+  let ALL = { key: '', A: null }, RUN = { key: '', busy: false, stopped: false, i: 0, n: 0, ms: null, gen: 0 };
+  const cellKeys = () => BR.cells(P).map(c => { try { return JSON.stringify(window.PSBDesign.cellInputs(P, c.k, c.g)); } catch (e) { return ''; } });
+  function allResults(force) {
+    if (errs.length) return null; const key = JSON.stringify(P); if (ALL.key === key) return ALL.A;
+    if (!BR.hasTypes(P)) { ALL = { key, A: null }; return null; }
+    if (RUN.key === key && (RUN.busy || RUN.stopped) && !force) return null;
+    const miss = cellKeys().filter(k => k && !CELLS.has(k));
+    if (force || miss.length <= SYNC_N) { const t0 = performance.now(); ALL = { key, A: BR.results(P, cellR) }; RUN = { key, busy: false, stopped: false, i: miss.length, n: miss.length, ms: performance.now() - t0, gen: RUN.gen + 1 }; return ALL.A; }   // gen + 1: a run of this state stops
+    runAll(key, miss); return null;
+  }
+  /* runAll(key, list): compute the cells of list (their engine inputs as text) one per tick; at the end the results of every cell */
+  function runAll(key, list) {
+    const gen = RUN.gen + 1, t0 = performance.now(); RUN = { key, busy: true, stopped: false, i: 0, n: list.length, ms: null, gen, list };
+    const step = () => {
+      if (RUN.gen !== gen || !RUN.busy) return;
+      if (JSON.stringify(P) !== key || errs.length) { RUN.busy = false; return; }   // the project changed: its own run was started by its redraw
+      if (RUN.i < RUN.n) { cellR(JSON.parse(RUN.list[RUN.i])); RUN.i++; runMsg(); setTimeout(step, 0); return; }
+      ALL = { key, A: BR.results(P, cellR) }; RUN.busy = false; RUN.ms = performance.now() - t0;
+      if (ui.otab === 'sum') drawOut(); else if (window.PSBDashUI) window.PSBDashUI.refresh();
+    };
+    setTimeout(step, 0);
+  }
+  /* the progress, in place (no redraw of the tab) */
+  function runMsg() { const el = $('sumRunMsg'); if (el && RUN.busy) el.lastChild.textContent = `Running every girder type × line (${RUN.i} / ${RUN.n})…`; if (window.PSBDashUI) window.PSBDashUI.refresh(); }
+  /* runCtl(what): the Stop / Run all / Re-run all buttons (Summary tab, check summary column) */
+  function runCtl(what) {
+    if (what === 'stop') { if (RUN.busy) { RUN.busy = false; RUN.stopped = true; RUN.gen++; } }
+    else if (what === 'run') { RUN.stopped = false; RUN.key = ''; ALL.key = ''; }
+    else if (what === 'rerun') { cellKeys().forEach(k => CELLS.delete(k)); RC.key = ''; ALL.key = ''; RUN.stopped = false; RUN.busy = false; RUN.gen++;
+      const key = JSON.stringify(P); if (!errs.length && BR.hasTypes(P)) runAll(key, cellKeys().filter(Boolean)); }
+    drawOut();
+  }
+  const runState = () => ({ busy: RUN.busy, stopped: RUN.stopped, i: RUN.i, n: RUN.n, ms: RUN.ms });
   /* pick(k, g): show girder type k on line g (the output tabs' choice, P.design) */
@@ -520,13 +561,7 @@
     } else if (ui.otab === 'sum') {
-      const off = M.girderOffsets(P);
-      h += errs.length ? '' : card('Project', `<div class="kv"><div><span>Project</span><span>${esc(P.project.name)}</span></div><div><span>Spans</span><span>${P.spans.lengths.map(x => fmt(x, 1)).join(' – ')} ft</span></div>
-          <div><span>Continuity</span><span>${P.spans.continuity === 'composite' ? 'made continuous for composite loads' : 'simple spans'}</span></div><div><span>Girders</span><span>${P.xs.nb}</span></div>
-          <div><span>Bays</span><span>${P.xs.bays.map(x => fmt(x, 2)).join(', ')} ft</span></div><div><span>Girder lines from the left deck edge</span><span>${off.map(x => fmt(x, 2)).join(', ')} ft</span></div>
-          ${BR.hasTypes(P) ? P.types.map((t, k) => `<div><span>Girder type ${esc(t.label)} (span ${t.span})</span><span>${BR.typeLines(P, k).map(g => 'G' + g).join(', ') || 'no line'}</span></div>`).join('') : ''}</div>
-          <p class="note">Entered values.${BR.hasTypes(P) && BR.unassigned(P).length ? ` <b style="color:var(--fail)">Not checked (no girder type): ${BR.unassigned(P).map(q => `G${q.g}/S${q.s}`).join(', ')}</b> (<a href="#" data-goin="gird">Girder types</a>).` : ''}</p>`)
-        + (ok ? card(`Design girder: ${esc(rc.inp.proj.girderId)}, span ${window.PSBDesign.sel(P).s}`, `<div class="kv"><div><span>Section</span><span>${esc(rc.inp.girder)}, ${rc.R.ss.Ntot} strands</span></div><div><span>Composite I<sub>c</sub></span><span>${fmt(rc.R.cp.Ic, 0)} in⁴ <a href="#" data-gotab="sec">Section properties</a></span></div>
+      // PR 3b: the Summary tab (ui/summary.js): verdict and run state, project overview and weights, girder × span grid, type × check-group
+      // table, the governing check per type, the girder type shown (the design girder card of PR 2b-2, unchanged), warnings
+      if (!errs.length) h += window.PSBSummaryUI.html({ P, A: ok ? allResults() : null, run: runState(), shown: (ok ? card(`Design girder: ${esc(rc.inp.proj.girderId)}, span ${window.PSBDesign.sel(P).s}`, `<div class="kv"><div><span>Section</span><span>${esc(rc.inp.girder)}, ${rc.R.ss.Ntot} strands</span></div><div><span>Composite I<sub>c</sub></span><span>${fmt(rc.R.cp.Ic, 0)} in⁴ <a href="#" data-gotab="sec">Section properties</a></span></div>
             <div><span>DF<sub>M</sub> / DF<sub>V</sub></span><span>${fmt(rc.R.dfm, 3)} / ${fmt(rc.R.dfv, 3)} <a href="#" data-gotab="lds">Loads &amp; LLDF</a></span></div><div><span>M<sub>u</sub> at midspan</span><span>${fmt(rc.R.diagrams.reduce((b, r) => Math.abs(r.x - rc.R.L / 2) < Math.abs(b.x - rc.R.L / 2) ? r : b).M_StrI_pos, 0)} kip-ft <a href="#" data-gotab="an">Analysis</a></span></div></div>
-            ${rc.R.warns.length ? `<div class="alert"><b>Design warnings of the engine (${rc.R.warns.length})</b><ul>${rc.R.warns.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '<p class="note">No design warnings.</p>'}`) : '')
-        + (ok && allResults() ? TY.summaryCard(allResults()) : '')   // PR 3a-2: every girder type and line
-        + ph('Summary', '3b', ['the girder × span grid coloured by ratio, run all (chunked, Stop)', 'the check summary column (left, screens 1200 px and wider) shows the same values']);
+            ${rc.R.warns.length ? `<div class="alert"><b>Design warnings of the engine (${rc.R.warns.length})</b><ul>${rc.R.warns.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '<p class="note">No design warnings.</p>'}`) : '') });
     } else if (ui.otab === 'rpt') {
@@ -549,2 +584,8 @@
     const a = e.target.closest('[data-icgo]'); if (a) { e.preventDefault(); gotoErr(+a.dataset.icgo); return; }
+    // PR 3b: a Summary value: its girder type and line shown, then its tab at the worked step (a group on an input tab: that tab and its row, as the
+    // check summary column); the run buttons
+    const sg = e.target.closest('[data-sumgo]'); if (sg) { e.preventDefault(); const [k, g, tab, st, inp] = sg.dataset.sumgo.split('|'); if (k !== '' && P.types && P.types[+k]) pick(+k, +g);
+      if (inp === '1') { ui.itab = tab; saveUi(); drawInputs(); const el = document.getElementById(st); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('sdFlash'); setTimeout(() => el.classList.remove('sdFlash'), 1600); } }
+      else gotoStep(tab, st); return; }
+    const sr = e.target.closest('[data-sumrun]'); if (sr) { e.preventDefault(); runCtl(sr.dataset.sumrun); return; }
     const tc = e.target.closest('[data-tycell]'); if (tc) { e.preventDefault(); const [k, g, tab] = tc.dataset.tycell.split('|'); P.design = { g: +g, s: P.types[+k].span }; if (autosave) autoFailed = !M.save(LS, P); gotoOut(tab); drawInputs(); return; }   // PR 3a-2
@@ -595,3 +636,3 @@
   if (L.notes && L.notes.length) toast(L.notes.join(' '));   // PR 3a-1 / 3a-4: what the load migrated or restored (stored with the next change)
-  if (window.PSBDashUI) window.PSBDashUI.init({ el: $('sbDashCol'), store, getP: () => P, errors: () => errs, result: () => { if (errs.length) return null; const rc = result(); return rc.R.error ? null : rc.R; }, all: allResults, pick, goto: gotoStep, fix: gotoErr, goin: t => { ui.itab = t; saveUi(); drawInputs(); $('inputPanel').scrollTop = 0; } });
+  if (window.PSBDashUI) window.PSBDashUI.init({ el: $('sbDashCol'), store, getP: () => P, errors: () => errs, result: () => { if (errs.length) return null; const rc = result(); return rc.R.error ? null : rc.R; }, all: allResults, run: runState, runCtl, pick, goto: gotoStep, fix: gotoErr, goin: t => { ui.itab = t; saveUi(); drawInputs(); $('inputPanel').scrollTop = 0; } });
 })();
diff --git a/apps/ps-bridge/report/builders.js b/apps/ps-bridge/report/builders.js
index d123fe5..fac40f8 100644
--- a/apps/ps-bridge/report/builders.js
+++ b/apps/ps-bridge/report/builders.js
@@ -71,12 +71,25 @@
     // PR 3a-2: every girder type on every line (several cells): each type's governing check, its worst line, and each line's; this report
-    // works the type and line chosen above the tabs (the others: choose them there; the same steps)
-    if (B.all && B.all.n > 1) {
-      const fx = (v, d) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—'), gv = cs => cs.reduce((b, q) => (!b || q.r > b.r ? q : b), null);
-      const trs = []; B.all.types.forEach(t => { const top = Object.values(t.gov).reduce((b, v) => (!b || v.c.r > b.c.r ? v : b), null), nF = Object.values(t.gov).filter(v => !v.c.pass).length;
-        trs.push({ cells: [plain(t.label), String(t.span), top ? `G${top.g}` : '—', top ? plain(top.c.n) : '—', { t: top ? fx(top.c.r, 3) : '—', n: true, cls: top && !top.c.pass ? 'ng' : 'ok' }, nF ? `FAIL (${nF})` : 'PASS', { t: fx(t.W, 1), n: true }], cls: nF ? 'gov' : '' });
-        if (t.cells.length > 1) t.cells.forEach(c => { const q = c.R && c.R.checks ? gv(c.R.checks) : null;
-          trs.push(['', '', `G${c.g}`, q ? plain(q.n) : (c.R && c.R.error ? 'engine error' : '—'), { t: q ? fx(q.r, 3) : '—', n: true, cls: q && !q.pass ? 'ng' : '' }, q ? (c.R.checks.some(z => !z.pass) ? 'FAIL' : 'PASS') : '—', { t: fx(c.W, 1), n: true }]); }); });
-      trs.push({ cells: ['Bridge total', '', `${B.all.n} lines`, '', '', '', { t: fx(B.all.W, 1), n: true }], cls: '' });
-      subs.splice(1, 0, sub('all', 'Every girder type and line', [note(`${B.all.types.length} girder types on ${B.all.n} girder lines (every span). Each type is checked on every line assigned to it with that line's span, spacing, position, overhang and skew; the worst line governs (its row first, then a row per line). This report works ${B.cell ? `girder type ${plain(B.P.types[B.cell.k].label)} on line G${B.cell.g}, span ${B.cell.s}` : 'the girder shown'} (the summary above and every section below); the other types and lines are worked the same way on the result tabs (choose the type and line above them) and listed on the [[tab:sum|Summary tab]]. Weight: w$_{sw}$ (L + 2 e$_{end}$/12) per line (see [[rs.end]] for W), the type's the sum over its lines.`),
-        tbl(['Girder type', 'Span', 'Line', 'Governing check', 'Ratio', 'Status', 'Weight (kip)'], trs, { wide: true })]));
+    // works the type and line chosen above the tabs (the others: choose them there; the same steps).
+    // PR 3b: the Summary tab's tables (ui/summary.js model: the same choices among the same engine values): the girder × span grid, the
+    // governing ratio of each check group per girder type with its line and a "see §" reference to the section that works the group, and
+    // the weights per line, per type and the bridge total (SB-6)
+    if (B.all && B.all.n > 1 && window.PSBSummaryUI) {
+      const SM = window.PSBSummaryUI.model(B.P, B.all), fx = (v, d) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—');
+      const ref = gp => (gp.input ? (X.ownKey ? `see [[${X.ownKey}]]` : '—') : `see [[rs.${gp.tab}]]`);
+      const shown = B.cell ? `girder type ${plain(B.P.types[B.cell.k].label)} on line G${B.cell.g}, span ${B.cell.s}` : 'the girder shown';
+      const gRows = SM.grid.map((row, i) => [`G${i + 1}`, ...row.map(z => (!z ? { t: 'no type: not checked', cls: 'ng' } : z.err ? { t: `${plain(z.c.label)}: engine error`, cls: 'ng' } : !z.gov ? `${plain(z.c.label)}: no check`
+        : { t: `${plain(z.c.label)}: ${fx(z.gov.q.r, 3)} ${z.nF ? `FAIL (${z.nF})` : 'PASS'}, ${z.gov.gp.name} (${ref(z.gov.gp)})`, cls: z.nF ? 'ng' : 'ok' }))]);
+      const trs = []; SM.types.forEach(T => { SM.used.forEach(gp => { const z = T.groups[gp.id]; if (!z) return;
+        trs.push({ cells: [plain(T.label), String(T.span), gp.name, plain(z.q.n), `G${z.g}`, { t: fx(z.q.r, 3), n: true, cls: z.q.pass ? 'ok' : 'ng' }, { t: z.q.pass ? 'PASS' : 'FAIL', cls: z.q.pass ? 'ok' : 'ng' }, ref(gp)], cls: z.q.pass ? '' : 'gov' }); });
+        if (T.rf) trs.push([plain(T.label), String(T.span), 'Rating (RF, not a check)', plain(T.rf.n), `G${T.rf.g}`, { t: fx(T.rf.v, 3), n: true, cls: T.rf.v < 1 ? 'ng' : 'ok' }, T.rf.v >= 1 ? 'RF ≥ 1' : 'RF < 1', 'see [[rs.rt]]']); });
+      const wrs = SM.types.map(T => [plain(T.label), String(T.span), T.lines.map(z => `G${z.c.g} ${fx(z.c.W, 1)}`).join(', '), { t: fx(T.W, 1), n: true }]);
+      wrs.push({ cells: ['Bridge total', '', `${SM.n} lines`, { t: fx(SM.W, 1), n: true }], cls: '' });
+      subs.splice(1, 0, sub('all', 'Every girder type and line', [
+        note(`${B.all.types.length} girder types on ${B.all.n} girder lines (every span): ${SM.nF ? `FAIL: ${SM.nF} check${SM.nF > 1 ? 's' : ''} of the girder types do not pass` : 'PASS: every check of every girder type passes'} (counted once per girder type and check, its worst line, SB-5; ${SM.nP} PASS). Each type is checked on every line assigned to it with that line's span, spacing, position, overhang and skew; the worst line governs. This report works ${shown} (the summary above and every section below); the other types and lines are worked the same way on the result tabs (choose the type and line above them) and listed on the [[tab:sum|Summary tab]].`, SM.nF > 0),
+        tbl(['Line', ...B.P.spans.lengths.map((L, j) => `Span ${j + 1} (L = ${fx(+L, 2)} ft)`)], gRows, { wide: true }),
+        note('Girder × span grid: each cell the girder type on that line, its governing ratio (the largest of its checks, demand / limit, the engine\'s), PASS or FAIL (the number of its checks over 1.0) and the check group, with the section that works it.'),
+        tbl(['Girder type', 'Span', 'Check group', 'Governing check', 'Line', 'Ratio', 'Status', 'Worked'], trs, { wide: true }),
+        note(`Each check group: the check with the largest ratio over the girder type's lines, the line named (SB-5). Worked: the section of this report that works the group, for ${shown}; for another type or line the same steps are on the result tab with that type and line chosen. Rating: the lowest HL-93 inventory rating factor (not a check, not counted).`),
+        tbl(['Girder type', 'Span', 'Weight per line (kip)', 'Weight (kip)'], wrs),
+        note('Weight: w$_{sw}$ (L + 2 e$_{end}$/12) per line, the weight W of the hold-down check (see [[rs.end]]); a girder type\'s weight the sum over its lines, the bridge total the sum over every checked line (SB-6).')]));
     }
diff --git a/apps/ps-bridge/ui/dash.js b/apps/ps-bridge/ui/dash.js
index b9587fb..9bee4e3 100644
--- a/apps/ps-bridge/ui/dash.js
+++ b/apps/ps-bridge/ui/dash.js
@@ -22,4 +22,8 @@
 
+   PR 3b (2026-11-13): o.run() = the page's run of every girder type × line ({ busy, i, n, stopped }); while it runs (chunked) or after
+   Stop, all() is null and the chips are those of the girder type and line shown, the line under the verdict says so with Stop / Run all
+   (o.runCtl('stop' | 'run')). grp is exported for the Summary tab (ui/summary.js), whose counts are these.
+
    init(o): o = { el, store (localStorage or null), getP(), errors() ([{ path, msg }]), result() (computeAll of the design or null),
-   all() (PR 3a-2, or absent), pick(k, g), goto(tab, step), fix(i) }; refresh() after the page draws. */
+   all() (PR 3a-2, or absent), run(), runCtl(what) (PR 3b), pick(k, g), goto(tab, step), fix(i) }; refresh() after the page draws. */
 (function () {
@@ -99,5 +103,13 @@
       + `<div class="sdVerd"><b class="sd-${verd}">${nF ? 'FAIL' : 'PASS'}</b>${top ? ` · max ratio ${fx(top.c.r, 3)}` : ''}</div>${top ? `<div class="sdGov">Governing: <a href="#" ${go(top.gp, top.st, top.cell)}>${esc(top.c.n + on(top))}: ${fx(top.c.r, 3)}</a></div>` : ''}
-        <div class="sdRun">${A ? `${A.types.length} girder type${A.types.length === 1 ? '' : 's'} on ${A.n} line${A.n === 1 ? '' : 's'} (every span); each counted once per check, its worst line.` : 'In development: the checks of the design girder only.'}</div>`
+        <div class="sdRun">${A ? `${A.types.length} girder type${A.types.length === 1 ? '' : 's'} on ${A.n} line${A.n === 1 ? '' : 's'} (every span); each counted once per check, its worst line.` : runTxt(o)}</div>`
       + `<div id="sbDash">${chips}</div><p class="sdNote">Each chip: the governing ratio of its checks${A && A.n > 1 ? ' over every girder type and line (the type and line named)' : ''} (demand / capacity, OK ≤ 1.0), the engine's value. Click: its tab with that type and line, and the worked step of the value. Summary tab: every type and line.</p>`;
   }
+  /* PR 3b: while every girder type × line is being computed (index.html, chunked) or after Stop, the chips are those of the girder type
+     and line shown (R); the line says so, with Stop / Run all (the Summary tab's buttons, o.runCtl) */
+  function runTxt(o) {
+    const r = o.run ? o.run() : null;
+    if (r && r.busy) return `Running every girder type × line (${r.i} / ${r.n})… Until then the chips are those of the girder type and line shown. <button type="button" data-sumrun="stop">Stop</button>`;
+    if (r && r.stopped) return `Stopped (${r.i} of ${r.n} girder type × line results): the chips are those of the girder type and line shown only. <button type="button" data-sumrun="run">Run all</button>`;
+    return 'In development: the checks of the design girder only.';
+  }
   /* the Rating chip (not a check): the lowest of the HL-93 inventory rating factors; 99 = not applicable */
@@ -121,2 +133,3 @@
       if (t.dataset.icgo != null) { if (o.fix) o.fix(+t.dataset.icgo); return; }
+      if (t.dataset.sumrun) { if (o.runCtl) o.runCtl(t.dataset.sumrun); return; }   // PR 3b: Stop / Run all
       if (t.dataset.sdx) { const k = t.dataset.sdx; if (D.open.has(k)) D.open.delete(k); else D.open.add(k); draw(); return; }
@@ -131,3 +144,3 @@
   }
-  window.PSBDashUI = { init, refresh: draw, KEY, GROUPS, RATING };
+  window.PSBDashUI = { init, refresh: draw, KEY, GROUPS, RATING, grp };   // PR 3b: grp for the Summary tab's counts (the same counts)
 })();
diff --git a/apps/ps-bridge/ui/types.js b/apps/ps-bridge/ui/types.js
index cf2e96f..56f91c4 100644
--- a/apps/ps-bridge/ui/types.js
+++ b/apps/ps-bridge/ui/types.js
@@ -129,21 +129,4 @@
   }
-  /* summaryCard(A): the Summary tab's table of every girder type and line (PR 3a-2; the steel app's type × check table, SB-2 PR 2): a row per
-     type (each check group's worst line, named) and a row per line; the girder weight per line, per type and the bridge total (SB-6).
-     A = PSBBridge.results. Each ratio links to its tab with that type and line (data-tycell). Display only: the engine's ratios. */
-  function summaryCard(A) {
-    const GR = (window.PSBDashUI && window.PSBDashUI.GROUPS) || [], fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—';
-    const used = GR.filter(gp => A.cells.some(c => c.R && c.R.checks && gp.checks.some(([n]) => c.R.checks.some(q => q.n === n))));
-    const worst = (checks, gp) => checks.filter(q => gp.checks.some(([n]) => n === q.n)).reduce((b, q) => !b || q.r > b.r ? q : b, null);
-    const cell = (q, k, g, tab, sub) => q ? `<td class="${q.pass ? 'ok' : 'ngt'}"><a href="#" data-tycell="${k}|${g}|${tab}" title="${esc(q.n)}${sub ? ' on G' + g : ''}">${fx(q.r, 3)}</a>${sub ? `<br><span class="note">G${g}</span>` : ''}</td>` : '<td>—</td>';
-    const rows = A.types.map(t => {
-      const top = `<tr class="tyTop"><td class="lft"><b>${esc(t.label)}</b> (span ${t.span})</td>${used.map(gp => { const z = Object.values(t.gov).filter(v => gp.checks.some(([n]) => n === v.c.n)).reduce((b, v) => !b || v.c.r > b.c.r ? v : b, null);
-        return z ? cell(z.c, t.k, z.g, gp.tab, true) : '<td>—</td>'; }).join('')}<td>${fx(t.W, 1)}</td></tr>`;
-      const lines = t.cells.length > 1 ? t.cells.map(c => `<tr><td class="lft">&nbsp;&nbsp;on line G${c.g}</td>${used.map(gp => cell(c.R && c.R.checks ? worst(c.R.checks, gp) : null, t.k, c.g, gp.tab, false)).join('')}<td>${fx(c.W, 1)}</td></tr>`).join('') : '';
-      return top + lines;
-    }).join('');
-    return box('tysum', 'Girder types and lines', 'every type on every line; the worst line governs', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Girder type / line</th>${used.map(gp => `<th>${esc(gp.name)}</th>`).join('')}<th>Weight (kip)</th></tr></thead><tbody>${rows}</tbody>
-      <tfoot><tr><td class="lft"><b>Bridge total (${A.n} girder${A.n === 1 ? '' : 's'})</b></td>${used.map(() => '<td></td>').join('')}<td><b>${fx(A.W, 1)}</b></td></tr></tfoot></table></div>
-      <p class="note">Each ratio: the largest of the group's checks (demand / limit, OK ≤ 1.0, the engine's), the type's row its worst line (named), then a row per line. Click: the tab of the group with that type and line. Weight: the girder's own weight on the line, w<sub>sw</sub> (L + 2 e<sub>end</sub>/12), the weight W of the hold-down check (End zone &amp; hold-down tab); the type's weight is the sum over its lines and the bridge total the sum over every checked line (lines with no type not counted).</p>`);
-  }
-  window.PSBTypesUI = { summaryCard, SCOPED, card, shownCard, scopeBar, outBar, mark, onChange, onClick, scopeOf, keyLabel };
+  /* summaryCard (PR 3a-2) moved to ui/summary.js (PR 3b: the Summary tab's type × check-group table, with the girder × span grid) */
+  window.PSBTypesUI = { SCOPED, card, shownCard, scopeBar, outBar, mark, onChange, onClick, scopeOf, keyLabel };
 })();
```
