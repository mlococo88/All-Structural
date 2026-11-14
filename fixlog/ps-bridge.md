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

## 2026-11-13 — PS-25: the Report works every girder type — the full worked sections (§3–§14, figures included) once per girder type on its governing line, numbered per type, the type and line in each heading; a Report-tab choice "Worked sections: each type's governing line (default) | every girder line" (display only; no calculation change)
PR #1530: https://github.com/mlococo88/All-Structural/pull/1530
### Request
- Engineer decision PS-25 (2026-11-13), answering the 3b question (#1529):
  - The Report prints the full worked sections (§3–§14, figures included) once per girder type, for that type's governing (worst) line.
  - They are numbered per type (e.g. Interior §3–§14, Exterior §15–§26), with the type and line in each section heading.
  - Other lines stay as summary rows in §1, with "see §n" pointing to their type's sections.
  - A Report-tab choice "Worked sections: each type's governing line (default) | every girder line"; every-line mode prints the full set per type × line.
  - The choice is kept in the existing psb2.ui key.
  - Single-type projects: the Report is identical, apart from headings if anything.
  - The 8-cell chunk threshold of 3b stays.
### What changed
- `report/data.js`:
  - New `units(P, B, mode)`: the type × line results to work. Mode 'gov' (default) takes, per type, the line with the largest check ratio; on a tie, the next largest ratio decides, and so on; on a full tie, the first line. Mode 'all' takes every type × line.
  - These are the same input and result objects as the Summary's (B.all). Each unit gets its own worked steps (`worked()` plus the DC2 / DW steps of its line, `PSBBridgeDL.withSteps` with P.design = that line).
  - `compute(P, rc, mode)` sets `B.mode`, `B.units`, and `B.multi` (true unless the one unit is the girder shown).
- `report/builders.js`:
  - New `multiSecs` (when `B.multi`):
    - §1 has the tables of every type and line (`allSub`, the 3b block moved into a function). Their "see §n" go to the unit that works that type (that line in every-line mode).
    - §1 then has each unit's design checks, key quantities and warnings.
    - §2 is printed once. Its owner-rules table and its references to a result section use the first unit.
    - Then §3–§14 for each unit in order, each heading "<section>: <type> on G<g>, span <s>".
  - Each unit's step anchors get the scope `u<i>` and its section keys `rs.<tab>@u<i>`. `scopeU` moves the [[references]] made inside a unit to that unit's keys.
  - Each recorded value carries `u` (its unit) and comes from that unit's result (`X.R`).
  - A section left out is left out for every unit; references into it say "(section not included)", as before.
  - The title block names "every girder type on its governing line (n)" or "every girder line (n)". `refsOf` was factored out (unchanged text).
- `ui/report.js`:
  - The radio choice "Worked sections" is kept in `ctx.opts.worked` (the page's `psb2.ui` → `rpt.worked`; no new key). It is shown when there is more than one type × line.
  - Each unit's graphics are drawn with its own result.
  - The cache key includes the choice.
- One worked girder that is the girder shown (every single-line project, e.g. the 17 harness B designs): `B.multi` is false and the Report is built exactly as before.
### Saved data (CLAUDE.md §5)
- No new key or field: `rpt.worked` ('gov' / 'all') sits inside the existing `psb2.ui` object (UI state, as `rpt.inc`). The project is unchanged.
### Governing provisions
- None changed (display only; every value is the engine's).
### Check case (new project: Interior S1 on G2–G4, Exterior S1 on G1, G5)
- Default: 26 sections.
  - §3–§14 "…: Interior S1 on G2, span 1": all interior lines have the same ratios; the full tie keeps G2.
  - §15–§26 "…: Exterior S1 on G1, span 1".
  - §1 grid row G5 → "Exterior S1: 1.276 FAIL (1), End zone & hold-down (see §22)".
- Every girder line: 62 sections, in the order Interior on G2, G3, G4, then Exterior on G1, G5.
- Unequal bays 8, 10, 10, 8 ft: Interior is worked on G3 (S = 10 ft). The hold-down ratio 1.276 is the same on every line; as are confinement 1.000, release compression 0.944 and splitting 0.838; the next ratio, Flexure 0.749 on G3 vs 0.711 on G2, decides.
- Before (3b): one girder (the girder shown) worked in §3–§14.
### How verified
- **One-girder report identical**: Node probe of origin/main 03cf154 vs this branch, `model()` JSON of 20 projects (the 17 harness B designs, one type on one line, one type on five lines with the governing line shown) is byte-identical.
  - The only difference is one type on five lines with a line other than the governing one shown (G2). That Report now works the governing line, with headings (Decision PS25-D1).
  - Harness B: normal 17 designs, 0 with differences, exit 0 (the Report comparison included); `--import` 17 designs imported, 0 with differences, exit 0; `--control` 17 with differences, exit 1; `--import --control` 17 with differences, exit 1.
- **`tests/engine/psbridge-summary.test.mjs` +2 tests** (22 projects × both modes):
  - the units (independent governing line, tie rule);
  - several units unless the one unit is the girder shown;
  - every [[reference]] resolves;
  - one-girder reports are unchanged;
  - 2 + 12 n sections, each heading naming its unit, numbered per unit;
  - every recorded value = its unit's engine value;
  - §1 grid "see" goes to that type's (that line's) section;
  - a section left out is gone for every unit.
  - The 3b §1 test accepts the unit keys.
- `node tests/engine/run.mjs psbridge tex project-registry`: 16 files, 144 passed, 0 failed. `check-syntax` passes.
- **`ps-bridge-skeleton.mjs`** (its first project has two types): sections per type, values = each unit's computeAll, figures per unit, the handling elevation in both stages per unit, §1 "see" to a step, section left out (24), §1 = the column (unit 0's table), print (the whole report, every step and figure) and Ctrl+P, phone 390 px: 252 checks, 0 failed.
- **`ps-bridge-types.mjs`**: §6 (unequal bays: Interior worked on G3, §3–§14) and new §10: the default (26 sections, numbering, the §1 G5 link → §22), every girder line (62 sections in order), the choice in psb2.ui only (the project text unchanged, psb2.* keys only), after a reload, Print report (62 headings, every step, every figure, the report alone), one type on one line (14 sections, no headings, no choice), 0 console errors: 103 checks, 0 failed.
### Decisions (pending engineer review)
- PS25-D1. Governing line of a type = the line with the largest check ratio. On a tie the next largest ratio decides, and so on; on a full tie, the first line. With one type on several lines, the Report works that line even when another line is shown above the tabs; the Report is unchanged where the line shown is the governing one.
- PS25-D2. §2 is printed once. Its owner-rules table shows the first worked unit's engine values; its references to a result section ("see §n" in the assumptions) go to the first unit's sections.
- PS25-D3. §1 group table: each type's row points to the section of that type's worked line (default mode), also when the group's worst line is another line (named in the row).
- PS25-D4. §1 lists each unit's design-check table, key quantities and warnings (one after another, after the tables of every type and line).
### Open items
- §1 "Key quantities" refers to `[[ld.dfm]]`, a step id that is not in the Loads & LLDF steps (an older dangling reference, also in the one-girder report; display only, not changed here).
### Other copies
- None (ui/report.js and report/builders.js are this app's adapted copies of the steel files; steel not changed).
### Before / after (exact)
```diff
diff --git a/apps/ps-bridge/report/builders.js b/apps/ps-bridge/report/builders.js
index fac40f8..fc6b5ce 100644
--- a/apps/ps-bridge/report/builders.js
+++ b/apps/ps-bridge/report/builders.js
@@ -75,15 +75,23 @@
     // the weights per line, per type and the bridge total (SB-6)
-    if (B.all && B.all.n > 1 && window.PSBSummaryUI) {
+    if (B.all && B.all.n > 1 && window.PSBSummaryUI) subs.splice(1, 0, allSub(B, X, null));
+    if ((R.warns || []).length) subs.push(sub('warn', `Design warnings of the engine (${R.warns.length})`, R.warns.map(w => note(plain(w), true))));
+    return { title: 'Summary of checks', subs };
+  }
+
+  /* the Report's tables of every girder type and line (PR 3b): the girder × span grid, the governing ratio of each check group per type,
+     the weights. M (PS-25, several worked units) = { sec(tab, k, g) -> the section key that works that type × line's group, shown, works,
+     worked: texts }; null: one worked girder (the sections rs.<tab>) */
+  function allSub(B, X, M) {
       const SM = window.PSBSummaryUI.model(B.P, B.all), fx = (v, d) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—');
-      const ref = gp => (gp.input ? (X.ownKey ? `see [[${X.ownKey}]]` : '—') : `see [[rs.${gp.tab}]]`);
-      const shown = B.cell ? `girder type ${plain(B.P.types[B.cell.k].label)} on line G${B.cell.g}, span ${B.cell.s}` : 'the girder shown';
+      const sk = (tab, k, g) => (M ? M.sec(tab, k, g) : 'rs.' + tab), ref = (gp, k, g) => (gp.input ? (X.ownKey ? `see [[${X.ownKey}]]` : '—') : `see [[${sk(gp.tab, k, g)}]]`);
+      const shown = M ? M.shown : B.cell ? `girder type ${plain(B.P.types[B.cell.k].label)} on line G${B.cell.g}, span ${B.cell.s}` : 'the girder shown';
       const gRows = SM.grid.map((row, i) => [`G${i + 1}`, ...row.map(z => (!z ? { t: 'no type: not checked', cls: 'ng' } : z.err ? { t: `${plain(z.c.label)}: engine error`, cls: 'ng' } : !z.gov ? `${plain(z.c.label)}: no check`
-        : { t: `${plain(z.c.label)}: ${fx(z.gov.q.r, 3)} ${z.nF ? `FAIL (${z.nF})` : 'PASS'}, ${z.gov.gp.name} (${ref(z.gov.gp)})`, cls: z.nF ? 'ng' : 'ok' }))]);
+        : { t: `${plain(z.c.label)}: ${fx(z.gov.q.r, 3)} ${z.nF ? `FAIL (${z.nF})` : 'PASS'}, ${z.gov.gp.name} (${ref(z.gov.gp, z.c.k, z.c.g)})`, cls: z.nF ? 'ng' : 'ok' }))]);
       const trs = []; SM.types.forEach(T => { SM.used.forEach(gp => { const z = T.groups[gp.id]; if (!z) return;
-        trs.push({ cells: [plain(T.label), String(T.span), gp.name, plain(z.q.n), `G${z.g}`, { t: fx(z.q.r, 3), n: true, cls: z.q.pass ? 'ok' : 'ng' }, { t: z.q.pass ? 'PASS' : 'FAIL', cls: z.q.pass ? 'ok' : 'ng' }, ref(gp)], cls: z.q.pass ? '' : 'gov' }); });
-        if (T.rf) trs.push([plain(T.label), String(T.span), 'Rating (RF, not a check)', plain(T.rf.n), `G${T.rf.g}`, { t: fx(T.rf.v, 3), n: true, cls: T.rf.v < 1 ? 'ng' : 'ok' }, T.rf.v >= 1 ? 'RF ≥ 1' : 'RF < 1', 'see [[rs.rt]]']); });
+        trs.push({ cells: [plain(T.label), String(T.span), gp.name, plain(z.q.n), `G${z.g}`, { t: fx(z.q.r, 3), n: true, cls: z.q.pass ? 'ok' : 'ng' }, { t: z.q.pass ? 'PASS' : 'FAIL', cls: z.q.pass ? 'ok' : 'ng' }, ref(gp, T.k, z.g)], cls: z.q.pass ? '' : 'gov' }); });
+        if (T.rf) trs.push([plain(T.label), String(T.span), 'Rating (RF, not a check)', plain(T.rf.n), `G${T.rf.g}`, { t: fx(T.rf.v, 3), n: true, cls: T.rf.v < 1 ? 'ng' : 'ok' }, T.rf.v >= 1 ? 'RF ≥ 1' : 'RF < 1', `see [[${sk('rt', T.k, T.rf.g)}]]`]); });
       const wrs = SM.types.map(T => [plain(T.label), String(T.span), T.lines.map(z => `G${z.c.g} ${fx(z.c.W, 1)}`).join(', '), { t: fx(T.W, 1), n: true }]);
       wrs.push({ cells: ['Bridge total', '', `${SM.n} lines`, { t: fx(SM.W, 1), n: true }], cls: '' });
-      subs.splice(1, 0, sub('all', 'Every girder type and line', [
-        note(`${B.all.types.length} girder types on ${B.all.n} girder lines (every span): ${SM.nF ? `FAIL: ${SM.nF} check${SM.nF > 1 ? 's' : ''} of the girder types do not pass` : 'PASS: every check of every girder type passes'} (counted once per girder type and check, its worst line, SB-5; ${SM.nP} PASS). Each type is checked on every line assigned to it with that line's span, spacing, position, overhang and skew; the worst line governs. This report works ${shown} (the summary above and every section below); the other types and lines are worked the same way on the result tabs (choose the type and line above them) and listed on the [[tab:sum|Summary tab]].`, SM.nF > 0),
+      return sub('all', 'Every girder type and line', [
+        note(`${B.all.types.length} girder types on ${B.all.n} girder lines (every span): ${SM.nF ? `FAIL: ${SM.nF} check${SM.nF > 1 ? 's' : ''} of the girder types do not pass` : 'PASS: every check of every girder type passes'} (counted once per girder type and check, its worst line, SB-5; ${SM.nP} PASS). Each type is checked on every line assigned to it with that line's span, spacing, position, overhang and skew; the worst line governs. ${M ? M.works : `This report works ${shown} (the summary above and every section below); the other types and lines are worked the same way on the result tabs (choose the type and line above them) and listed on the [[tab:sum|Summary tab]].`}`, SM.nF > 0),
         tbl(['Line', ...B.P.spans.lengths.map((L, j) => `Span ${j + 1} (L = ${fx(+L, 2)} ft)`)], gRows, { wide: true }),
@@ -91,9 +99,6 @@
         tbl(['Girder type', 'Span', 'Check group', 'Governing check', 'Line', 'Ratio', 'Status', 'Worked'], trs, { wide: true }),
-        note(`Each check group: the check with the largest ratio over the girder type's lines, the line named (SB-5). Worked: the section of this report that works the group, for ${shown}; for another type or line the same steps are on the result tab with that type and line chosen. Rating: the lowest HL-93 inventory rating factor (not a check, not counted).`),
+        note(`Each check group: the check with the largest ratio over the girder type's lines, the line named (SB-5). ${M ? M.worked : `Worked: the section of this report that works the group, for ${shown}; for another type or line the same steps are on the result tab with that type and line chosen.`} Rating: the lowest HL-93 inventory rating factor (not a check, not counted).`),
         tbl(['Girder type', 'Span', 'Weight per line (kip)', 'Weight (kip)'], wrs),
-        note('Weight: w$_{sw}$ (L + 2 e$_{end}$/12) per line, the weight W of the hold-down check (see [[rs.end]]); a girder type\'s weight the sum over its lines, the bridge total the sum over every checked line (SB-6).')]));
-    }
-    if ((R.warns || []).length) subs.push(sub('warn', `Design warnings of the engine (${R.warns.length})`, R.warns.map(w => note(plain(w), true))));
-    return { title: 'Summary of checks', subs };
-  }
+        note(`Weight: w$_{sw}$ (L + 2 e$_{end}$/12) per line, the weight W of the hold-down check (see [[${sk('end', null, null)}]]); a girder type\'s weight the sum over its lines, the bridge total the sum over every checked line (SB-6).`)]);
+      }
 
@@ -147,2 +152,72 @@
 
+  const refsOf = B => [['AASHTO LRFD', 'AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): articles as cited at each step'], ['MBE', 'AASHTO Manual for Bridge Evaluation, LRFR (Section 6, Part A): article numbers as the old app'],
+    ['PCI', 'PCI Bridge Design Manual and the Mast method (handling stability screening), as the moved engine'], ...(B.inp.owner && B.inp.owner !== 'AASHTO' && window.PBD ? [[B.inp.owner, window.PBD.OWN_RULES.owners[B.inp.owner].manual]] : [])];
+
+  /* ---------- PS-25: several worked units ----------
+     Engineer decision PS-25 (2026-11-13): the worked sections (§3–§14, figures included) are printed once per girder type for its governing
+     line (report/data.js units: the line with the largest governing ratio), numbered per type (Interior §3–§14, Exterior §15–§26, …), the
+     type and line in each section heading; or (the Report tab's choice "every girder line") once per girder type × line. §1 lists each
+     unit's design checks and key quantities and the tables of every type and line, whose "see §n" point to the unit that works that type
+     (that line in "every line"); §2 once. One unit that is the girder shown: the report of one girder as before (no headings changed).
+     Each unit's step anchors get the scope 'u<i>' and its section keys 'rs.<tab>@u<i>'; the [[key]] references made inside a unit's text
+     are moved to that unit's keys (scopeU). Every number is the unit's engine result (X.R), recorded with u = its index. */
+  const uTitle = U => `${plain(U.label)} on G${U.g}, span ${U.s}`;
+  /* scopeU(subs, keys, i): the unit's references [[k]] (k one of its step ids or section keys) -> its scoped keys; steps items -> scope u<i> */
+  function scopeU(subs, keys, i) {
+    const map = k => (keys.steps.has(k) ? `u${i}/${k}` : keys.secs.has(k) ? `${k}@u${i}` : k);
+    const fixT = t => (typeof t === 'string' ? t.replace(/\[\[([^\]|]+)\]\]/g, (m, k) => `[[${map(k)}]]`) : t);
+    const fixC = c => (c && typeof c === 'object' ? { ...c, t: fixT(c.t), ...(c.key ? { key: map(c.key) } : {}) } : fixT(c));
+    subs.forEach(q => { q.items = q.items.map(it => {
+      if (it.type === 'steps') return { ...it, scope: `u${i}` };
+      if (it.type === 'note') return { ...it, text: fixT(it.text) };
+      if (it.type === 'kv') return { ...it, rows: it.rows.map(r => r.map((x, j) => (j === 2 && x ? map(x) : fixT(x)))) };
+      if (it.type === 'table') return { ...it, head: it.head.map(fixC), rows: it.rows.map(r => (Array.isArray(r) ? r.map(fixC) : { ...r, cells: r.cells.map(fixC) })) };
+      return it; }); });
+    return subs;
+  }
+  function multiSecs(B, X, opt, on, secs, dropped) {
+    const vals = X.vals, U = B.units, figs = Array.isArray(opt.figures) ? opt.figures : [];
+    const Bu = u => ({ P: u.P, inp: u.inp, R: u.R, W: u.W, sel: { g: u.g, s: u.s }, cell: { k: u.k, g: u.g, s: u.s }, all: null });
+    const fail = (k, e) => ({ title: (SECTIONS.find(q => q[0] === k) || [k, k])[1], subs: [sub('n', 'Not available', [note('Report error: ' + (e && e.message), true)])] });
+    // the worked sections of each unit (built first: their step ids are the unit's keys)
+    const unitSecs = U.map((u, i) => {
+      X.u = i; X.R = u.R; X.figs = figs[i] || null; const out = [], keys = { steps: new Set(), secs: new Set(Object.keys(TABS).map(t => 'rs.' + t)) };
+      SECTIONS.forEach(([k]) => { if (!TABS[k]) return;
+        X.cur = k; const n0 = vals.length; let s; try { s = tabSec(Bu(u), k, X); } catch (e) { s = fail(k, e); }
+        vals.slice(n0).forEach(v => { v.sec = k; v.u = i; });
+        s.subs.forEach(q => q.items.forEach(it => { if (it.type === 'steps') it.steps.forEach(t => keys.steps.add(String(t.id))); }));
+        out.push({ k, s, n0, n1: vals.length }); });
+      return { u, out, keys };
+    });
+    const secKey = (tab, k, g) => { const j = U.findIndex(u => u.k === k && (B.mode !== 'all' || u.g === g)); return `rs.${tab}@u${j >= 0 ? j : 0}`; };
+    // §1: the tables of every type and line, then each unit's design checks, key quantities and warnings
+    X.cur = 'sum'; let s1;
+    try {
+      const subs = [];
+      U.forEach((u, i) => { X.u = i; X.R = u.R; const n0 = vals.length; const s = summary(Bu(u), X); vals.slice(n0).forEach(v => { v.sec = 'sum'; v.u = i; });
+        scopeU(s.subs, unitSecs[i].keys, i).forEach(q => subs.push({ ...q, id: q.id + i, title: q.id === 'kq' ? `Key quantities: ${uTitle(u)}` : q.id === 'warn' ? `${q.title}: ${uTitle(u)}` : q.title })); });
+      X.u = null; X.R = null;
+      const range = i => { const ks = SECTIONS.filter(([k]) => TABS[k] && on(k)).map(([k]) => `rs.${k}@u${i}`); return ks.length ? `[[${ks[0]}]]–[[${ks[ks.length - 1]}]]` : '(sections not included)'; };
+      const list = U.map((u, i) => `${uTitle(u)} (${range(i)})`).join('; ');
+      const M = { sec: (tab, k, g) => (k == null ? `rs.${tab}@u0` : secKey(tab, k, g)), shown: B.mode === 'all' ? 'each girder type on each of its lines' : 'each girder type on its governing line',
+        works: `This report works ${B.mode === 'all' ? 'every girder type on every line' : 'each girder type on its governing line (the line with its largest check ratio; on a tie, the next largest)'}: ${list}. ${B.mode === 'all' ? '' : 'The other lines are the rows of the tables below, each pointing to its type\'s sections; their steps are on the result tabs with that type and line chosen (the [[tab:sum|Summary tab]] lists them).'}`,
+        worked: `Worked: the section of this report that works the group for that girder type (${B.mode === 'all' ? 'on the line named' : 'on its governing line'}).` };
+      subs.unshift(allSub(B, X, M));
+      s1 = { title: 'Summary of checks', subs };
+    } catch (e) { X.u = null; X.R = null; s1 = fail('sum', e); }
+    if (on('sum')) secs.push({ id: 'sum', key: 'rs.sum', ...s1 }); else { dropped.push({ key: 'rs.sum', ...s1 }); for (let j = vals.length - 1; j >= 0; j--) if (vals[j].sec === 'sum') vals.splice(j, 1); }
+    // §2 once (the bridge, basis, assumptions; the owner rules table with the first unit's engine values)
+    X.cur = 'proj'; X.u = 0; X.R = U[0].R; { const n0 = vals.length; let s; try { s = proj(Object.assign(Bu(U[0]), { P: B.P }), X); s.subs = s.subs.map(q => q.id !== 'b' ? q : { ...q, title: 'Bridge and the worked girders', items: q.items.map(it => it.type !== 'kv' ? it
+        : { ...it, rows: it.rows.map(r => r[0] !== 'Design girder' ? r : ['Worked girders', U.map((u, i) => `${uTitle(u)}: ${plain(u.inp.girder)}, L = ${OK().fx(u.R.L, 2)} ft, S = ${OK().fx(+u.inp.S, 3)} ft, ${u.inp.loads.pos === 'exterior' ? 'exterior' : 'interior'} (see [[rs.sec@u${i}]])`).join('; ')]) }) }); } catch (e) { s = fail('proj', e); }
+      vals.slice(n0).forEach(v => { v.sec = 'proj'; v.u = 0; }); scopeU(s.subs, unitSecs[0].keys, 0);   // §2's references to a result section: the first unit's
+      if (on('proj')) secs.push({ id: 'proj', key: 'rs.proj', ...s }); else { dropped.push({ key: 'rs.proj', ...s }); vals.splice(n0); } }
+    X.u = null; X.R = null; X.figs = null;
+    // the worked sections, unit by unit, each heading naming its type and line
+    const gone = [];
+    unitSecs.forEach(({ u, out, keys }, i) => out.forEach(({ k, s, n0, n1 }) => {
+      const t = { ...s, title: `${s.title}: ${uTitle(u)}`, subs: scopeU(s.subs, keys, i) };
+      if (on(k)) secs.push({ id: `${k}-u${i}`, key: `rs.${k}@u${i}`, ...t }); else { dropped.push({ key: `rs.${k}@u${i}`, ...t }); for (let j = n0; j < n1; j++) gone.push(vals[j]); } }));
+    for (let j = vals.length - 1; j >= 0; j--) if (gone.includes(vals[j])) vals.splice(j, 1);
+  }
+
   function model(B, opt) {
@@ -153,5 +228,6 @@
     const X = { vals, inReport: t => !!TABS[t] && on(t), ownKey: own && on('proj') ? 'rs.own' : null, figs: opt.figures || null };   // rs.own: the owner rules subsection of §2
-    X.V = (path, d, div) => { const v = at(R, path), text = OK().fx(div ? v / div : v, d); vals.push({ sec: X.cur, path, d, div: div || 0, text }); return text; };
+    X.V = (path, d, div) => { const v = at(X.R || R, path), text = OK().fx(div ? v / div : v, d); vals.push({ sec: X.cur, path, d, div: div || 0, text, ...(X.u != null ? { u: X.u } : {}) }); return text; };   // PS-25: X.R / X.u = the worked unit's result
     const secs = [], dropped = [];
-    SECTIONS.forEach(([k]) => {
+    if (B.multi) multiSecs(B, X, opt, on, secs, dropped);   // PS-25: the worked sections once per girder type (or per line)
+    else SECTIONS.forEach(([k]) => {
       X.cur = k; const n0 = vals.length;
@@ -180,2 +256,10 @@
     const d = B.sel, gid = (B.cell ? `type ${plain(B.P.types[B.cell.k].label)}, ` : '') + plain(B.inp.proj && B.inp.proj.girderId);   // PR 3a-2: the girder type named
+    if (B.multi) {   // PS-25: every girder type (its governing line) or every girder line
+      const what = B.mode === 'all' ? `every girder line (${B.units.length})` : `every girder type on its governing line (${B.units.length})`;
+      return { title: 'Prestressed Bridge Design', subtitle: `Calculation report: ${what}${p.name ? ', ' + p.name : ''}`,
+        code: `${ED}; MBE (LRFR load rating). Each girder type's results on ${B.mode === 'all' ? 'each of its lines' : 'its governing line'}, as on the result tabs.`,
+        info: [['Project No', p.number], ['Computed by', p.designer], ['Date', p.date], ['Project', p.name], ['Checked by', p.checker], ['Girders', what]],
+        head: { left: `${p.name || 'Prestressed Bridge Design'}${p.number ? ' (' + p.number + ')' : ''}\nWorked: ${what}`, right: `Computed by: ${p.designer || '—'}  Date: ${p.date || '—'}\nChecked by: ${p.checker || '—'}`, foot: `Prestressed Bridge Design (new, in development), ${ED}` },
+        refs: refsOf(B), sections: secs, vals };
+    }
     return { title: 'Prestressed Bridge Design', subtitle: `Calculation report: design girder ${gid}, span ${d.s}${p.name ? ', ' + p.name : ''}`,
@@ -184,4 +268,3 @@
       head: { left: `${p.name || 'Prestressed Bridge Design'}${p.number ? ' (' + p.number + ')' : ''}\nDesign girder ${gid}, span ${d.s}`, right: `Computed by: ${p.designer || '—'}  Date: ${p.date || '—'}\nChecked by: ${p.checker || '—'}`, foot: `Prestressed Bridge Design (new, in development), ${ED}` },
-      refs: [['AASHTO LRFD', 'AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): articles as cited at each step'], ['MBE', 'AASHTO Manual for Bridge Evaluation, LRFR (Section 6, Part A): article numbers as the old app'],
-        ['PCI', 'PCI Bridge Design Manual and the Mast method (handling stability screening), as the moved engine'], ...(B.inp.owner && B.inp.owner !== 'AASHTO' && window.PBD ? [[B.inp.owner, window.PBD.OWN_RULES.owners[B.inp.owner].manual]] : [])],
+      refs: refsOf(B),
       sections: secs, vals };
diff --git a/apps/ps-bridge/report/data.js b/apps/ps-bridge/report/data.js
index d6a18c9..bb5fa2d 100644
--- a/apps/ps-bridge/report/data.js
+++ b/apps/ps-bridge/report/data.js
@@ -6,4 +6,5 @@
 
-   compute(P, rc) -> bundle { P, inp, R, W, sel, err, all, cell }; rc = { inp, R, W, all } (index.html result()) or null. PR 3a-2: all = every
-   girder type × line (PSBBridge.results), cell = the type and line reported (PSBBridge.shown).
+   compute(P, rc, mode) -> bundle { P, inp, R, W, sel, err, all, cell, mode, units, multi }; rc = { inp, R, W, all } (index.html result()) or
+   null. PR 3a-2: all = every girder type × line (PSBBridge.results), cell = the type and line reported (PSBBridge.shown). PS-25: mode 'gov'
+   (default) | 'all', units = the type × line results worked in full (units()), multi = the report works them (not one girder shown).
    worked(inp, R) -> the worked steps of every result tab (the list index.html result() makes). */
@@ -18,3 +19,19 @@
   }
-  function compute(P, rc) {
+  /* units(P, B, mode): PS-25 (engineer decision 2026-11-13): the girder type × line results the Report works in full: each girder type on
+     its governing line (mode 'gov', the default: the line whose largest check ratio is the largest; on a tie the next largest ratio
+     decides, and so on; a full tie: the first line) or every girder type × line (mode 'all'), in the order of the types and lines; each with its engine inputs and result (the same
+     objects as the Summary's, B.all) and its worked steps (worked(), + the DC2 / DW steps of its line). A cell with an engine error is left
+     out (§1 lists it). */
+  function units(P, B, mode) {
+    const SU = W().PSBSummaryUI; if (!B.all || !SU) return null;
+    // the governing line of a type: the largest check ratio; on a tie (a check that does not depend on the line, e.g. the hold-down force)
+    // the next largest, and so on (the ratios of each line sorted from the largest); a full tie: the first line
+    const SM = SU.model(P, B.all), desc = z => z.c.R.checks.map(q => q.r).filter(r => typeof r === 'number' && !isNaN(r)).sort((a, b) => b - a);
+    const better = (z, b) => { if (!b) return true; const x = desc(z), y = desc(b); for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
+    const cs = mode === 'all' ? [].concat(...SM.types.map(T => T.lines.filter(z => !z.err))) : SM.types.map(T => T.lines.filter(z => !z.err).reduce((b, z) => (better(z, b) ? z : b), null)).filter(Boolean);
+    return cs.map(z => { const c = z.c, PV = Object.assign({}, P, { design: { g: c.g, s: c.s } }), Wk = worked(c.inp, c.R);
+      if (W().PSBBridgeDL) W().PSBBridgeDL.withSteps(Wk.loads, PV);
+      return { k: c.k, g: c.g, s: c.s, label: c.label, P: PV, inp: c.inp, R: c.R, W: Wk }; });
+  }
+  function compute(P, rc, mode) {
     const sel = W().PSBDesign.sel(P), B = { P, sel, inp: null, R: null, W: null, err: '' };
@@ -26,2 +43,7 @@
     B.cell = BR && BR.hasTypes(P) ? BR.shown(P) : null;
+    // PS-25: the worked units; several (or one that is not the girder shown): the report works each (report/builders.js multiSecs)
+    B.mode = mode === 'all' ? 'all' : 'gov';
+    try { B.units = units(P, B, B.mode); } catch (e) { B.units = null; B.err = 'The worked girders of the report: ' + (e && e.message); return B; }
+    const one = () => B.units.length === 1 && B.cell && B.units[0].k === B.cell.k && B.units[0].g === B.cell.g;
+    B.multi = !!(B.units && B.units.length && !one());
     if (rc && rc.R && rc.W && !rc.R.error) { B.inp = rc.inp; B.R = rc.R; B.W = rc.W; return B; }
@@ -32,3 +54,3 @@
   }
-  window.PSBReportData = { compute, worked };
+  window.PSBReportData = { compute, worked, units };
 })();
diff --git a/apps/ps-bridge/ui/report.js b/apps/ps-bridge/ui/report.js
index 990a696..2f04f1b 100644
--- a/apps/ps-bridge/ui/report.js
+++ b/apps/ps-bridge/ui/report.js
@@ -27,5 +27,9 @@
   const incOf = o => { const inc = {}; window.PSBReportBuild.SECTIONS.forEach(([k]) => { inc[k] = !(o.inc && o.inc[k] === false); }); return inc; };
-  function controls(o) {
-    const inc = incOf(o);
-    return `<div class="rp-chips" role="group" aria-label="Report sections">${window.PSBReportBuild.SECTIONS.map(([k, t]) => `<label class="rp-chip"><input type="checkbox" data-rpinc="${k}"${inc[k] ? ' checked' : ''}>${esc(t)}</label>`).join('')}</div>`;
+  /* PS-25 (engineer decision 2026-11-13): "Worked sections: each type's governing line (default) | every girder line", kept in ctx.opts.worked
+     (the page's psb2.ui object, as the section chips); shown when the project has more than one girder type × line */
+  const modeOf = o => (o.worked === 'all' ? 'all' : 'gov');
+  function controls(o, B) {
+    const inc = incOf(o), m = modeOf(o);
+    const ch = B && B.all && B.all.n > 1 ? `<div class="rp-chips" role="radiogroup" aria-label="Worked sections" id="rpWorked"><span class="rp-chip" style="border:0;padding-left:0"><b>Worked sections:</b></span>${[['gov', "each type's governing line"], ['all', 'every girder line']].map(([v, t]) => `<label class="rp-chip"><input type="radio" name="rpWorked" data-rpworked="${v}"${m === v ? ' checked' : ''}>${t}</label>`).join('')}</div>` : '';
+    return ch + `<div class="rp-chips" role="group" aria-label="Report sections">${window.PSBReportBuild.SECTIONS.map(([k, t]) => `<label class="rp-chip"><input type="checkbox" data-rpinc="${k}"${inc[k] ? ' checked' : ''}>${esc(t)}</label>`).join('')}</div>`;
   }
@@ -92,11 +96,13 @@
     if (!window.SharedReport) { box.innerHTML = '<div class="alert err">shared/report.js is not loaded.</div>'; return null; }
-    const B = window.PSBReportData.compute(ctx.P, ctx.rc);
+    const B = window.PSBReportData.compute(ctx.P, ctx.rc, modeOf(o));
     if (B.err) { box.innerHTML = `<div class="alert err" role="alert">The report cannot be built: ${esc(B.err)}</div>`; return null; }
-    const inc = incOf(o), wScr = Math.round(box.clientWidth || 0), narrow = wScr > 0 && wScr < PW - 40, key = JSON.stringify([ctx.rc && ctx.rc.key, ctx.rc && ctx.rc.allKey, inc, narrow ? wScr : 0]);
+    const inc = incOf(o), wScr = Math.round(box.clientWidth || 0), narrow = wScr > 0 && wScr < PW - 40, key = JSON.stringify([ctx.rc && ctx.rc.key, ctx.rc && ctx.rc.allKey, inc, narrow ? wScr : 0, modeOf(o)]);
     // the model is kept while the inputs, the sections chosen and the figure width are the same (the result object of the page is the same)
-    if (S.key !== key || !S.M) { let figs = {}; try { figs = figures(B, inc, narrow ? wScr : 0); } catch (e) { console.warn(e); }
+    // PS-25: several worked units: each unit's graphics drawn with its own result (an array, one per unit)
+    if (S.key !== key || !S.M) { let figs = {}; try { figs = B.multi ? B.units.map(u => figures({ P: u.P, inp: u.inp, R: u.R, W: u.W }, inc, narrow ? wScr : 0)) : figures(B, inc, narrow ? wScr : 0); } catch (e) { console.warn(e); }
       S.M = window.PSBReportBuild.model(B, { include: inc, figures: figs }); S.key = key; }
     const tb = document.getElementById('tabBar');
-    const V = window.SharedReport.mount(box, S.M, { controls: controls(o), closed: S.closed, stick: tb ? tb.offsetHeight : 0, spy: true,
+    const V = window.SharedReport.mount(box, S.M, { controls: controls(o, B), closed: S.closed, stick: tb ? tb.offsetHeight : 0, spy: true,
       onGoto: t => { if (/^in:/.test(t)) { if (ctx.goin) ctx.goin(t.slice(3)); } else if (ctx.goto) ctx.goto(t); } });
+    box.querySelectorAll('[data-rpworked]').forEach(el => el.addEventListener('change', () => { if (!el.checked) return; o.worked = el.dataset.rpworked; if (ctx.save) ctx.save(); render(host, ctx); }));
     box.querySelectorAll('[data-rpinc]').forEach(el => el.addEventListener('change', () => { o.inc = o.inc || {}; o.inc[el.dataset.rpinc] = el.checked; if (ctx.save) ctx.save(); render(host, ctx); }));
```

## 2026-11-13 — PS-26: Report §2 Owner rules table — one "Applied here" column per girder type where the types' values differ; §1 Key quantities DF link checked (display only; no calculation change)
PR #1531: https://github.com/mlococo88/All-Structural/pull/1531
### Request
- Engineer decision PS-26 (2026-11-13): the Report §2 Owner rules table shows one value + status column per girder type: each type's own owner checks (f′c, f′ci, girder age at continuity, …) on its governing line where relevant. One type, or the same values for every type: a single column exactly as before. Each column's "see §" points to that type's sections. The in-app Owner rules tab: leave it if it shows only the type shown; check consistency.
- Fix the dead link in §1 "Key quantities" (`[[ld.dfm]]`, PS-25 open item).
### What changed
- `report/builders.js`:
  - New `ownTypes(B, U, range, scope)` (called by `multiSecs` before §2): per girder type of the project (Summary model order), its governing line for the owner checks = the line with the largest ratio of the check summary's "Owner limits" checks (ui/dash.js GROUPS id 'mat'); a tie or no such check: the line the report works for the type (`B.units`). It returns the line's engine result, `P` with `design` = that line, the unit that works it (`u`, or null), and the column title "<type> on G<g>, span <s> (see §a–§b)" (the type's worked sections, the same `range()` as §1's list).
  - New `ownCols(ownSubs, X, o, nv0)` (called by `proj` when `X.ownT` has more than one type): for each type, the Owner rules tab card (`PSBInputsUI.cards('own', P_type, R_type)`, the same HTML as the tab) is converted (report/fromtab.js). If every type's "Applied here" column is the same, **nothing changes** (return before any change). Otherwise the table keeps Section / Requirement / Kind and gets one column per type "Applied here: <type> on G<g>, span <s> (see §a–§b)", `wide`, with a note under it; the §2 owner values recorded (`X.vals`) are replaced by each type's (tagged `u` = its unit, or `cell` = 'k|g' for a line not worked in full). References inside a type's cells are scoped to that type's unit.
  - `multiSecs`: `range()` moved out of the §1 `try` (same text); `X.ownT` set before §2 and cleared after; §2 values keep a `u`/`cell` already set (`if (v.u == null && v.cell == null) v.u = 0`, the same result as before for every value it set before).
  - One-girder reports (`B.multi` false) never reach this code.
- Item 2 (`[[ld.dfm]]`): **no app change needed.** The reference is correct and resolves in the app: `ld.dfm` is the "Moment distribution factor" step (DF_M = r_M g_M, topic "Distribution factors used", 4.6.2.2.2e) of the Loads & LLDF steps, in the one-girder report (`ld.dfm`) and in each unit (`u<i>/ld.dfm`, scoped by `scopeU`). The PS-25 open item came from `tests/engine/psbridge-summary.test.mjs` loading the app without `ui/bridgedl.js`: in Node the Loads & LLDF section of every girder-type report failed ("Cannot read properties of undefined (reading 'lineTable')", shown as "Not available"), so the step was missing there only. The browser smoke (`ps-bridge-types.mjs` §10) already found no unresolved reference. Fixed in the test: `ui/bridgedl.js` loaded, the `ld.dfm` exemption removed.
- In-app Owner rules tab (`ui/inputs.js` ownerCard): unchanged; it shows one "Applied here" column, for the girder type and line shown above the output tabs (the page's R). Its cell equals that type's column in the Report (Node test and smoke). Column counts: the PASS / FAIL cells of the Report's per-type columns = the check summary column's Owner limits entries (one per girder type per check, its worst line; `PSBDashUI.grp`), tested. In the one-column case the single column stands for every type (the same values), so it has one status per row, not one per type.
### Saved data (CLAUDE.md §5)
- None: no key, no field, no format.
### Governing provisions
- None changed (display only; every value is the engine's, as on the Owner rules tab).
### Check case (new project, RIDOT, Exterior S1's own f′c = 9.0 ksi; base f′c 8.5 ksi)
- Before: §2 Owner rules, one column "Applied here" (unit 0 = Interior S1): RIDOT 5.2.1 row "f′c = 8.50 ksi; governing minimum 5.00 ksi; ratio = 5.00 / 8.50 = 0.588 PASS".
- After: columns "Applied here: Interior S1 on G2, span 1 (see §3–§14)" → 5.00 / 8.50 = 0.588 PASS, and "Applied here: Exterior S1 on G1, span 1 (see §15–§26)" → 5.00 / 9.00 = 0.556 PASS; every other row the same text in both columns; the Exterior heading's link jumps to §15.
- Same project with f′c 8.5 ksi for both types: one column, byte-identical to before.
### How verified
- **Byte-identical where nothing should change**: Node probe, `model()` JSON of origin/main b38dc51's `report/builders.js` vs this branch's, 88 projects × 2 modes = 176 reports (the 17 harness B designs, a new project, one type on every line, three types with own inputs, three continuous spans, two spans with a line not checked — each as built and under RIDOT, CTDOT and MassDOT): 170 identical; the 6 that differ are exactly "three types, own inputs, unequal bays" under RIDOT / CTDOT / MassDOT × 2 modes (the types' f′c differ: the per-type columns).
- `tests/engine/psbridge-summary.test.mjs`:
  - `ui/bridgedl.js` loaded; the `ld.dfm` exemption removed; values tagged `cell` resolved;
  - new "Report, PS-26": every project above (+ the three-type project under CTDOT with one type's f′ci 6.8 ksi, a FAIL in one column) × both modes: one column when the types' Owner rules tab cells are the same, and then §2 equal to §2 built with no per-type columns; otherwise 3 + n columns, each heading the type, a line of it, its own sections; each column = that type's Owner rules tab cells; no line of the type with a larger owner ratio; PASS / FAIL counts = the check summary column's; every §2 value = its type's engine value;
  - new "Report links": every [[…]] and step-note "§id" reference of every report above resolves (`SharedReport.build().unresolved` empty, no "§?"), no duplicate anchor; each §1 Key quantities DF link → the "Moment distribution factor" step of its unit's Loads & LLDF section; each section left out in turn: no [[…]] reference dangles.
- `node tests/engine/run.mjs psbridge tex project-registry`: 16 files, 146 passed, 0 failed. `node tests/check-syntax.mjs`: all scripts pass.
- `tests/smoke/ps-bridge-types.mjs` §10 (+3 checks): the RIDOT two-type project: §2 table 5 columns, both f′c cells, no unresolved link, the Exterior heading's link → §15; §1 both DF links → "Moment distribution factor"; the Owner rules tab: one column, its f′c cell = the type's Report column. 106 checks, 0 failed. `ps-bridge-skeleton.mjs`: 252 checks, 0 failed.
- Harness B: normal 17 designs, 0 with differences, exit 0; `--import` 17 imported, 0 with differences, exit 0; `--control` 17 with differences, exit 1; `--import --control` 17 with differences, exit 1.
### Decisions (pending engineer review)
- PS26-D1. "Governing line" of a type for its owner checks = the line with the largest Owner limits ratio; a tie (the owner rules use type inputs, so every line ties today) keeps the line the report works for the type. The heading names that line.
- PS26-D2. Per-type columns are shown only in the multi-unit report (PS-25), when at least one row's "Applied here" text differs between types; otherwise one column, as before.
- PS26-D3. Each column heading's "see §a–§b" points to the range of that type's worked sections (the type's unit; in "every girder line" mode the unit of that line).
### Open items
- Pre-existing, not changed: with a section left out (e.g. Section properties), a worked step's own engine note "§<step id>" that names a step of that section (the Loads & LLDF step note "§sec.g.wsw") has no target and the shared viewer shows "§?" (one-girder and per-type reports alike; on origin/main too). Fixing it means changing the engine step notes or shared/report.js; not done here. The new link test pins it as the only kind of dangling reference.
- §1 Key quantities "DF_M / DF_V (see §)" links to the DF_M step only (DF_V is the next step in the same topic); unchanged.
### Other copies
- None.
### Before / after (exact)
```diff
diff --git a/apps/ps-bridge/report/builders.js b/apps/ps-bridge/report/builders.js
index fc6b5ce..ef8084a 100644
--- a/apps/ps-bridge/report/builders.js
+++ b/apps/ps-bridge/report/builders.js
@@ -115,7 +115,8 @@
     const ownR = window.PBD && window.PBD.OWN_RULES && window.PBD.OWN_RULES.owners[own];
     const o = { tab: 'proj', X, sec: 'proj', inReport: X.inReport };
     const asm = IN ? FT.cards(IN.cards('proj', P), o).subs.find(s => /Assumptions/.test(s.title)) : null;
-    const ownSubs = IN ? FT.cards(IN.cards('own', P, B.R), o).subs.filter(s => s.items.length) : [];   // R: the owner's material checks in the rules table
+    const nv0 = X.vals.length, ownSubs = IN ? FT.cards(IN.cards('own', P, B.R), o).subs.filter(s => s.items.length) : [];   // R: the owner's material checks in the rules table
+    if (IN && X.ownT && X.ownT.length > 1) ownCols(ownSubs, X, o, nv0);   // PS-26: one "Applied here" column per girder type (when they differ)
     const subs = [
       sub('p', 'Project', [kv([['Project', p.name || '—'], ['Project No', p.number || '—'], ['Client / owner', p.owner || (ownR ? ownR.manual : own)], ['Computed by', p.designer || '—'], ['Checked by', p.checker || '—'], ['Date', p.date || '—']]),
         p.notes ? note(plain(p.notes)) : null]),
@@ -130,6 +131,29 @@
     return { title: 'Project, basis and assumptions', subs };
   }
   const V0 = (X, p, d, div) => X.V(p, d, div);
+  /* ownCols(ownSubs, X, o, nv0): PS-26 (engineer decision 2026-11-13): several girder types (the report of PS-25): the Owner rules table of §2
+     gets one "Applied here" column per girder type, each the type's own owner checks (the Owner rules tab's cell, ui/inputs.js ownerCard, made
+     with that type's inputs and engine result) on its governing line (X.ownT, made by multiSecs), the column heading naming the type and
+     line and pointing to the sections that work that type. Where every type's column is the same (or one type), nothing changes: the
+     single column as before. The values of the replaced column are replaced by each type's (recorded with u = its unit, or cell = 'k|g' for
+     a line the report does not work in full). Display only: the cells are those of the Owner rules tab. */
+  function ownCols(ownSubs, X, o, nv0) {
+    const IN = window.PSBInputsUI, FT = window.PSBReportTab, isT = it => it.type === 'table' && /^Applied here/.test(String(it.head[it.head.length - 1]));
+    const q0 = ownSubs.find(q => q.items.some(isT)); if (!q0) return;
+    const cols = X.ownT.map(T => { const vals = [], q = FT.cards(IN.cards('own', T.P, T.R), { ...o, X: { vals } }).subs.find(s => s.items.some(isT)); return q ? { T, vals, q } : null; });
+    if (cols.some(c => !c)) return;
+    const rowsOf = tb => tb.rows.map(r => (Array.isArray(r) ? r : r.cells)), tbOf = c => c.q.items.find(isT);
+    const last = c => JSON.stringify(rowsOf(tbOf(c)).map(r => r[r.length - 1])), lead = c => JSON.stringify([tbOf(c).head, rowsOf(tbOf(c)).map(r => r.slice(0, -1))]);
+    if (cols.every(c => last(c) === last(cols[0]))) return;   // the same values for every girder type: one column, as before
+    if (cols.some(c => lead(c) !== lead(cols[0]))) return;   // (the rules are the owner's, the same for every type: a guard)
+    cols.forEach(c => c.T.scope([c.q]));   // a reference in a type's cell: to that type's sections
+    const t0 = tbOf(cols[0]), nh = t0.head.length, i0 = q0.items.findIndex(isT);
+    const rows = t0.rows.map((r, i) => { const cells = [...rowsOf(t0)[i].slice(0, -1), ...cols.map(c => { const rr = rowsOf(tbOf(c))[i]; return rr[rr.length - 1]; })]; return Array.isArray(r) ? cells : { ...r, cells }; });
+    q0.items.splice(i0, 1, { ...t0, head: [...t0.head.slice(0, -1), ...cols.map(c => `${t0.head[nh - 1]}: ${c.T.title}`)], rows, wide: true },
+      note('One "Applied here" column per girder type: the type\'s owner checks and values on its governing line (the line with its largest owner-limit ratio), with the sections that work the type. Where every girder type has the same values, the table has one column.'));
+    X.vals.splice(nv0);
+    cols.forEach(c => c.vals.forEach(v => X.vals.push({ ...v, ...(c.T.u != null ? { u: c.T.u } : { cell: `${c.T.k}|${c.T.g}` }) })));
+  }
   /* deNote(P): PS-23 (engineer decision 2026-11-13): the entered d_e that differs from the d_e computed from the cross-section (PS-20), the
      same rows as the Loads & LLDF tab's notice, listed in the assumptions always (also after the notice is dismissed); none where they match */
   function deNote(P) { const DS = window.PSBDesign, D = DS && DS.deDiff ? DS.deDiff(P) : { rows: [] }; return D.rows.length ? [note(`• ${DS.deText(D, t => `$_{${t}}$`)} (see [[rs.lds]])`)] : []; }
@@ -175,6 +199,22 @@
       return it; }); });
     return subs;
   }
+  /* ownTypes(B, U, range, scope): PS-26: the girder types of §2's Owner rules columns, in the order of the types: each type's governing line
+     for its owner checks (the line with the largest ratio of the check summary's Owner limits checks; a tie, or none: the line the report
+     works for the type, its first in "every line"), its engine result, the unit that works it (u; null for a line not worked in full) and
+     the unit whose sections the column points to (the type's, that line's in "every line") */
+  function ownTypes(B, U, range, scope) {
+    const SU = window.PSBSummaryUI, DU = window.PSBDashUI; if (!SU || !B.all) return null;
+    const gp = (DU && DU.GROUPS || []).find(g => g.id === 'mat'), isOwn = n => !!gp && gp.checks.some(([cn]) => cn === n);
+    const top = z => z.c.R.checks.filter(q => isOwn(q.n) && typeof q.r === 'number' && !isNaN(q.r)).reduce((a, q) => Math.max(a, q.r), -Infinity);
+    return SU.model(B.P, B.all).types.map(T => {
+      const ls = T.lines.filter(z => !z.err), ju = U.findIndex(u => u.k === T.k); if (!ls.length || ju < 0) return null;
+      const b = ls.reduce((b, z) => (top(z) > top(b) ? z : b), ls.find(z => z.c.g === U[ju].g) || ls[0]), c = b.c;
+      const u = U.findIndex(q => q.k === T.k && q.g === c.g), j = u >= 0 ? u : ju;
+      return { k: T.k, g: c.g, s: c.s, u: u >= 0 ? u : null, P: Object.assign({}, B.P, { design: { g: c.g, s: c.s } }), R: c.R,
+        title: `${plain(c.label)} on G${c.g}, span ${c.s} (see ${range(j)})`, scope: subs => scope(subs, j) };
+    }).filter(Boolean);
+  }
   function multiSecs(B, X, opt, on, secs, dropped) {
     const vals = X.vals, U = B.units, figs = Array.isArray(opt.figures) ? opt.figures : [];
     const Bu = u => ({ P: u.P, inp: u.inp, R: u.R, W: u.W, sel: { g: u.g, s: u.s }, cell: { k: u.k, g: u.g, s: u.s }, all: null });
@@ -189,6 +229,7 @@
         out.push({ k, s, n0, n1: vals.length }); });
       return { u, out, keys };
     });
+    const range = i => { const ks = SECTIONS.filter(([k]) => TABS[k] && on(k)).map(([k]) => `rs.${k}@u${i}`); return ks.length ? `[[${ks[0]}]]–[[${ks[ks.length - 1]}]]` : '(sections not included)'; };
     const secKey = (tab, k, g) => { const j = U.findIndex(u => u.k === k && (B.mode !== 'all' || u.g === g)); return `rs.${tab}@u${j >= 0 ? j : 0}`; };
     // §1: the tables of every type and line, then each unit's design checks, key quantities and warnings
     X.cur = 'sum'; let s1;
@@ -197,7 +238,6 @@
       U.forEach((u, i) => { X.u = i; X.R = u.R; const n0 = vals.length; const s = summary(Bu(u), X); vals.slice(n0).forEach(v => { v.sec = 'sum'; v.u = i; });
         scopeU(s.subs, unitSecs[i].keys, i).forEach(q => subs.push({ ...q, id: q.id + i, title: q.id === 'kq' ? `Key quantities: ${uTitle(u)}` : q.id === 'warn' ? `${q.title}: ${uTitle(u)}` : q.title })); });
       X.u = null; X.R = null;
-      const range = i => { const ks = SECTIONS.filter(([k]) => TABS[k] && on(k)).map(([k]) => `rs.${k}@u${i}`); return ks.length ? `[[${ks[0]}]]–[[${ks[ks.length - 1]}]]` : '(sections not included)'; };
       const list = U.map((u, i) => `${uTitle(u)} (${range(i)})`).join('; ');
       const M = { sec: (tab, k, g) => (k == null ? `rs.${tab}@u0` : secKey(tab, k, g)), shown: B.mode === 'all' ? 'each girder type on each of its lines' : 'each girder type on its governing line',
         works: `This report works ${B.mode === 'all' ? 'every girder type on every line' : 'each girder type on its governing line (the line with its largest check ratio; on a tie, the next largest)'}: ${list}. ${B.mode === 'all' ? '' : 'The other lines are the rows of the tables below, each pointing to its type\'s sections; their steps are on the result tabs with that type and line chosen (the [[tab:sum|Summary tab]] lists them).'}`,
@@ -206,12 +246,13 @@
       s1 = { title: 'Summary of checks', subs };
     } catch (e) { X.u = null; X.R = null; s1 = fail('sum', e); }
     if (on('sum')) secs.push({ id: 'sum', key: 'rs.sum', ...s1 }); else { dropped.push({ key: 'rs.sum', ...s1 }); for (let j = vals.length - 1; j >= 0; j--) if (vals[j].sec === 'sum') vals.splice(j, 1); }
-    // §2 once (the bridge, basis, assumptions; the owner rules table with the first unit's engine values)
+    // §2 once (the bridge, basis, assumptions; the owner rules table with the first unit's engine values, or PS-26 one column per girder type)
+    X.ownT = ownTypes(B, U, range, (subs, j) => scopeU(subs, unitSecs[j].keys, j));
     X.cur = 'proj'; X.u = 0; X.R = U[0].R; { const n0 = vals.length; let s; try { s = proj(Object.assign(Bu(U[0]), { P: B.P }), X); s.subs = s.subs.map(q => q.id !== 'b' ? q : { ...q, title: 'Bridge and the worked girders', items: q.items.map(it => it.type !== 'kv' ? it
         : { ...it, rows: it.rows.map(r => r[0] !== 'Design girder' ? r : ['Worked girders', U.map((u, i) => `${uTitle(u)}: ${plain(u.inp.girder)}, L = ${OK().fx(u.R.L, 2)} ft, S = ${OK().fx(+u.inp.S, 3)} ft, ${u.inp.loads.pos === 'exterior' ? 'exterior' : 'interior'} (see [[rs.sec@u${i}]])`).join('; ')]) }) }); } catch (e) { s = fail('proj', e); }
-      vals.slice(n0).forEach(v => { v.sec = 'proj'; v.u = 0; }); scopeU(s.subs, unitSecs[0].keys, 0);   // §2's references to a result section: the first unit's
+      vals.slice(n0).forEach(v => { v.sec = 'proj'; if (v.u == null && v.cell == null) v.u = 0; }); scopeU(s.subs, unitSecs[0].keys, 0);   // §2's references to a result section: the first unit's
       if (on('proj')) secs.push({ id: 'proj', key: 'rs.proj', ...s }); else { dropped.push({ key: 'rs.proj', ...s }); vals.splice(n0); } }
-    X.u = null; X.R = null; X.figs = null;
+    X.u = null; X.R = null; X.figs = null; X.ownT = null;
     // the worked sections, unit by unit, each heading naming its type and line
     const gone = [];
     unitSecs.forEach(({ u, out, keys }, i) => out.forEach(({ k, s, n0, n1 }) => {
```

## 2026-11-14 — PS-27: the NEXT strands drawn in the two stems (strand pattern, Section properties and Stresses graphics; the Report's figures) — the old app's strand positions ported (display only; no calculation change)
PR #1532: https://github.com/mlococo88/All-Structural/pull/1532
### Request
- Engineer report (2026-11-13): "Look at the graphic for the NEXT beam section and make sure the strands are actually within the beam webs. This was correct in the psgirder app."
### Problem
- Every section graphic of the new app placed each strand row centred on the girder ℄ on a 2 in grid, whatever the shape. For the NEXT F double tee (two stems at 60 in c/c, each B = 13.0–13.75 in wide) the strands were drawn in the empty gap between the stems (x within ±9 in of the ℄; the stems' inner faces are at ±23.1 to ±23.5 in). The old app (`strandXY`, "Prestressed Bridge Design.html" @ 8fe8650 :4877-4914) splits each row between the two stems.
- Graphics affected (all three drawing functions; the Report draws its figures with the same functions): `ui/strands.js` `section()` (strand pattern at ℄ bearing and at midspan: Girders & strands input tab, Losses tab, Report §Losses), `ui/section.js` `figure()` (Section properties tab, Report), `ui/stresses.js` `secFig()` (Stresses tab, Report). Not affected: the elevations (strand profile, end zone, hold-down: rows by y only), the Loads & LLDF cross-section (girder rectangles, no strands), the Flexure pier section (no strands), the Deck tab.
- Other shapes (I-girders, bulb tees, boxes, deck beams) were already drawn at the old app's straight-strand positions; two smaller differences from the old app, also corrected by the port: the Section properties graphic stacked the draped strands upward from y_mid (`y_mid + 2i`) instead of centring them on y_mid (12 draped at y_mid = 8 in: drawn 8–18 in; old app and now: 3–13 in), and drew 2·round(n_h/2) of them (an odd n_h one too many); the strand pattern and Stresses graphics drew the last strand of an odd n_h at x = 0 (old app: x = −1 in).
- The engine is not involved: it uses only each row's y and count (`strandSys`, `tensionSideArea` uses the outline and voids only), the same in the old and the new app (verbatim slices, harness A). No calculation difference was found between the apps for NEXT strands.
### What changed
- `ui/strands.js`: new `xy(R, cg)`: a port of the old app's `strandXY` (positions, row index, debonded flags; the draped strands about their centroid `cg`), the one source of the drawn positions; `pattern(R, end)` now maps it; `rowBox` / `drapedBox` (the point-at regions and the "draped" callout follow the drawn strands); `debondedSlot` removed (the port's own "outermost first" order is the same set); exported `xy`, `rowBox`, `drapedBox`, `section` (tests); caption: "each row split between the two stems about each stem's ℄" and "draped strands in a row in each stem" for NEXT.
- `ui/section.js` `figure()`: the strands drawn from `PSBStrandGfx.pattern(R, false)` (midspan) instead of its own loop; `figure` exported (tests).
- `ui/stresses.js` `secFig()`: the strands drawn from `PSBStrandGfx.xy(R, yh)` (the draped centroid at the station, as before) instead of its own loop; `secFig` exported (tests).
### Saved data (CLAUDE.md §5)
- None: no key, no field, no format.
### Governing provisions
- None changed (display only). Engine values unchanged (harness B below).
### Check case (the engineer's NEXT 36F; S = 8 ft → flange 96 in; L = 60 ft; rows 10 @ 2 in, 10 @ 4 in, 6 @ 6 in with 2 debonded 8 ft; 4 draped, y_end 24 in, y_mid 10 in)
- Stems: ℄ at ±stemCC/2 = ±30 in, B = 13.0 in (faces ±23.5 and ±36.5 in); columns per stem = floor((13.0 − 4)/2) + 1 = 5 on a 2 in grid.
- Before: rows 1–2 at x = −9, −7, …, +9 in; row 3 at −5 … +5 in; draped at ±1 in — all in the 47 in gap between the stems (|x| < 23.5 in).
- After (= old app): rows 1–2: 5 per stem at x = ±30 + {−4, −2, 0, 2, 4} in (outermost 34 in: 2.5 in from the outer face, 2.5 in from the inner face at 26 in); row 3: 3 per stem at ±30 + {−2, 0, 2}; debonded (2): −32 and +28 in (each stem's first outermost column, as the old app); draped: 2 per stem at ±30 ± 1 in, y = y_mid (midspan) or y_end (℄ bearing).
- Strand centroid at midspan 4.53 in, at ℄ bearing 6.43 in: the same before and after (engine values).
### How verified
- New `tests/engine/psbridge-strandgfx.test.mjs` (27 tests): every library shape (AASHTO I–VI, PCI BT-54/63/72, NEXT 24F–36F at the 96 in and 144 in flange, AASHTO BI–BIV boxes, the four deck slabs) × three strand patterns ("raw": the app's default pattern as is; "default": cut to what fits; "full": every 2 in row from the soffit filled to what fits, two strands of the bottom row debonded, draped strands where they fit; "fits" = every strand centre inside the girder outline (halfPolygon, the drawing data) at least 2 in from its edges and 2 in clear of a void, as the old app draws it). Each of the three graphics is drawn with the app's drawing kit and its strand circles recorded: (1) each graphic draws exactly `xy`'s strands (count = the engine's N per row + n_h; Stresses at three stations); (2) `xy` = the old app's `strandXY` run from its own text at the pin (positions and debonded strands, at ℄ bearing and midspan); (3) default / full: every drawn strand inside the concrete with the 2 in cover; no strand of a NEXT between the stems; (4) the engine's strand values (N, cgs, e, `ss.at`, checks) the same before and after drawing. Hand check of the case above; PS27-D1 (odd counts). Mutation check: with the NEXT branch of `xy` disabled the 8 NEXT tests and the two NEXT hand checks fail.
- `node tests/engine/run.mjs psbridge tex project-registry`: 17 files, 173 passed, 0 failed. `node tests/check-syntax.mjs`: all scripts pass.
- Harness B (`tests/psbridge-compare.mjs`): normal 17 designs, 0 with differences, exit 0; `--import` 0 with differences, exit 0; `--control` 17 with differences, exit 1; `--import --control` 17 with differences, exit 1 (the engine values every tab and the Report show are unchanged).
- Smokes: `ps-bridge-skeleton.mjs` 252 checks, 0 failed; `ps-bridge-types.mjs` 106 checks, 0 failed.
- Screenshots (headless Chromium, file://): the old app's "SECTION A–A" at midspan and at the end vs the new app's strand pattern before and after; Section properties, Stresses and Losses graphics before / after.
### Decisions (pending engineer review)
- PS27-D1. An odd strand count in a NEXT row (straight, debonded or draped) is drawn ⌈n/2⌉ in the left stem and ⌊n/2⌋ in the right, each stem centred on its own count. The old app drew round(n/2) in each stem (one strand more than entered: 7 drawn as 8). Even counts: the old app's positions exactly.
- PS27-D2. The Stresses graphic keeps the draped strands at their centroid at the station (interpolated between y_end and y_mid, as before); the old app's stress section drew them at y_end within L/4 of a bearing and at y_mid elsewhere. Only their x positions follow the old app.
- PS27-D3. Debonded strands stay drawn hollow at ℄ bearing only (as before); which strands are debonded follows the old app (outermost first; NEXT: per stem).
### Open items (not changed; display, for the engineer)
- A strand pattern that does not fit the shape is drawn as entered, outside the concrete, as the old app drew it (e.g. the app's default rows of 10 strands on an AASHTO Type I, or the default draped strands at y_end = 60 in on a shallower girder, which the input check stops when y_end ≥ h). The engine warns only when a row exceeds the strands that fit the bottom width ("≈N that fit … with 2″ edge cover"); a row inside a box void (e.g. y = 6 in on a BI-36, whose void starts 5 in above the soffit) is not warned. Should the input check warn for strands outside the outline or in a void?
- Box beam voids: the new app draws the void where the engine places it (`sectionVoids`: on the bottom wall, y = wall … wall + voidH); the old app's section graphic drew it centred on the depth ((h − voidH)/2 …). Not changed.
- Flexure tab, pier section of a NEXT: the negative-moment compression block is drawn across b_bf = 2B centred on the ℄ (between the stems); the engine's b_bf for NEXT is 2B (both stems). Display only; not changed here.
### Other copies
- None (the old app is frozen; its `strandXY` is the reference, unchanged).
### Before / after (exact)
```diff
diff --git a/apps/ps-bridge/ui/section.js b/apps/ps-bridge/ui/section.js
index 1e69915..bc9935b 100644
--- a/apps/ps-bridge/ui/section.js
+++ b/apps/ps-bridge/ui/section.js
@@ -47,10 +47,13 @@
     sectionVoids(G).forEach(v => { if (v.type === 'rect') S.rect(v.x - v.w / 2, v.y - v.h / 2, v.x + v.w / 2, v.y + v.h / 2, 'dt-cc', { fill: '#fff' }); else S.circ(v.x, v.y, v.d / 2, 'dt-cc', { fill: '#fff' }); });
     if (th > 0) S.rect(-G.btf / 2, G.h, G.btf / 2, G.h + th, 'dt-cc', { op: 0.85 });
     if (ts > 0) { S.rect(-cp.beff / 2, G.h + th, cp.beff / 2, G.h + th + ts, 'dt-cc'); S.region(-cp.beff / 2, G.h + th, cp.beff / 2, G.h + th + ts, `Deck: b_eff = ${V.fx(cp.beff, 1)} in, t_s = ${V.fx(ts, 2)} in, n = ${V.fx(cp.n, 3)}`); }
-    // straight strands on a 2 in grid (display), the draped strands at midspan
-    ss.rows.forEach(r => { for (let i = 0; i < r.n; i++) S.circ((i - (r.n - 1) / 2) * 2, r.y, ss.st.db / 2, 'dt-bar'); S.region(-(r.n - 1) - 1, r.y - 1, (r.n - 1) + 1, r.y + 1, `${r.n} strands at y = ${r.y} in${r.nd ? `, ${r.nd} debonded ${r.dbnd} ft` : ''}`); });
-    if (ss.nh > 0) { const n2 = Math.max(1, Math.round(ss.nh / 2)); for (let i = 0; i < n2; i++) { S.circ(-1, +ss.hp.yMid + i * 2, ss.st.db / 2, 'dt-bolt'); S.circ(1, +ss.hp.yMid + i * 2, ss.st.db / 2, 'dt-bolt'); }
-      S.region(-2, +ss.hp.yMid - 1, 2, +ss.hp.yMid + n2 * 2, `${ss.nh} draped strands, centroid y_mid = ${ss.hp.yMid} in at midspan (y_end = ${ss.hp.yEnd} in)`); }
+    // straight strands on a 2 in grid (display), the draped strands at midspan: the positions of the strand-pattern graphic (PSBStrandGfx.xy, the
+    // old app's strandXY; NEXT: in the two stems, PS-27)
+    const SG = window.PSBStrandGfx, pts = SG.pattern(R, false);
+    pts.forEach(q => S.circ(q.x, q.y, ss.st.db / 2, q.kind === 'h' ? 'dt-bolt' : 'dt-bar'));
+    ss.rows.forEach((r, ri) => { const [x0, x1] = SG.rowBox(pts, ri); S.region(x0, r.y - 1, x1, r.y + 1, `${r.n} strands at y = ${r.y} in${r.nd ? `, ${r.nd} debonded ${r.dbnd} ft` : ''}`); });
+    if (ss.nh > 0) { const [x0, x1, y0, y1] = SG.drapedBox(pts);
+      S.region(x0, y0, x1, y1, `${ss.nh} draped strands, centroid y_mid = ${ss.hp.yMid} in at midspan (y_end = ${ss.hp.yEnd} in)`); }
     const xr = Math.max(G.bbf || 0, G.btf || 0, cp.beff || 0) / 2 + 4;
     const cl = (y, txt, cls) => { S.line(-xr, y, xr, y, cls || 'dt-cl'); S.text(xr, y, txt, { dx: 4, vc: true, sz: 11 }); };
     cl(G.yb, `y_b = ${V.fx(G.yb, 2)} in (girder)`); cl(cp.ybc, `y_bc = ${V.fx(cp.ybc, 2)} in (composite)`, 'dt-hid'); cl(ss.cgsMid, `y_ps = ${V.fx(ss.cgsMid, 2)} in (strands, midspan)`, 'dt-tf');
@@ -69,5 +72,5 @@
       draw: W => figure(ctx, W), hint: 'Point at the deck or a strand row for its values.',
       cap: '<p class="vk-cap">Shape as the engine uses it (outline and voids of the shape library); straight strands drawn on a 2 in grid, draped strands at midspan. Display only.</p>' });
   }
-  window.PSBUiSection = { output, after, TOPICS };
+  window.PSBUiSection = { output, after, TOPICS, figure };   // figure: also for tests/engine/psbridge-strandgfx.test.mjs (PS-27)
 })();
diff --git a/apps/ps-bridge/ui/strands.js b/apps/ps-bridge/ui/strands.js
index 91146ee..23bea5a 100644
--- a/apps/ps-bridge/ui/strands.js
+++ b/apps/ps-bridge/ui/strands.js
@@ -5,24 +5,62 @@
      Elevation (vertical scale exaggerated): ℄ bearings, girder ends (overhang opt.endOh), the straight rows (debonded lengths dashed),
        the draped strands labelled "draped" with the two hold-down points at frac × L_span from ℄ bearing (PS-13), dimensioned.
      Cross-sections at the girder end (℄ bearing) and at midspan: the outline and voids of the shape library, straight strands on a 2 in grid
-       (debonded ones hollow at the end), draped strands as pairs on a 2 in grid about their centroid (y_end at the end, y_mid at midspan).
+       (debonded ones hollow at the end), draped strands as pairs on a 2 in grid about their centroid (y_end at the end, y_mid at midspan);
+       NEXT: each row split between the two stems (xy below, the old app's strandXY; PS-27, 2026-11-13).
    mount(slot, ctx, o) -> the detCard; ctx = { R, inp }; o = { id, title, compact } (compact: the input panel). */
 (function () {
   'use strict';
   const VK = () => window.PSBVizKit;
   const BAR = '#8A5A44', DRP = '#B45309', DB = '#DC6B2F';
   const fx = (v, d) => VK().fx(v, d);
-  /* positions of the strands of the section at the end (end true) or at midspan: [{ x, y, kind: 's' | 'd' (debonded at the end) | 'h' (draped) }] */
+  /* xy(R, cg): the drawn position of every strand, in girder coordinates (in; x from the girder ℄, y up from the soffit):
+     [{ x, y, h (draped), ri (row), db (debonded), slot }], the draped strands about their centroid cg (in).
+     PS-27 (engineer report 2026-11-13: "make sure the strands are actually within the beam webs; this was correct in the psgirder app"):
+     a port of the old app's strandXY ("Prestressed Bridge Design.html" @ 8fe8650, :4877-4914), the reference for the drawn positions:
+       NEXT (two stems at stemCC c/c, width B): each row's strands split between the two stems, on a 2 in grid about each stem's ℄
+         (at most floor((B - 4) / 2) + 1 columns a stem, 2 in edge cover; more wrap onto the same columns, as the old app), the outermost
+         columns of each stem debonded first; the draped strands in one row in each stem about its ℄ at y = cg;
+       every other shape: each row centred on the girder ℄ on a 2 in grid, the outermost strands debonded first; the draped strands two
+         a row (x = ∓1 in), the rows 2 in apart about cg.
+     One change from the old code (PS27-D1, pending engineer review): an odd count in a NEXT row (straight, debonded or draped) is drawn as
+     ⌈n/2⌉ in the left stem and ⌊n/2⌋ in the right, each stem centred on its own count; the old app drew round(n/2) in each stem (one
+     strand more than entered). Even counts: the old app's positions exactly. Display only: the engine uses only each row's y and count. */
+  function xy(R, cg) {
+    const pts = [], g = R.g, ss = R.ss;
+    if (g.isNext && g.next) {
+      const sCL = g.next.stemCC / 2, B = g.next.B, perStemCols = Math.max(1, Math.floor((B - 4) / 2) + 1);   // 2 in grid, 2 in edge cover
+      const split = n => [Math.ceil(n / 2), Math.floor(n / 2)];   // [left stem, right stem] (PS27-D1)
+      ss.rows.forEach((r, ri) => {
+        const nd = r.dbnd > 0 ? Math.min(r.nd || 0, r.n) : 0, hs = split(r.n), ds = split(nd);
+        [-sCL, sCL].forEach((stemX, k) => {
+          const half = hs[k], w = (Math.min(half, perStemCols) - 1) / 2;
+          const order = [...Array(half).keys()].map(i => ({ i, x: stemX + (i % perStemCols - w) * 2 })).sort((a, b) => Math.abs(b.x - stemX) - Math.abs(a.x - stemX));   // outermost columns debonded first
+          const dbSet = new Set(order.slice(0, ds[k]).map(o => o.i));
+          for (let i = 0; i < half; i++) pts.push({ x: stemX + (i % perStemCols - w) * 2, y: r.y, h: false, ri, db: dbSet.has(i), slot: k * half + i });
+        });
+      });
+      if (ss.nh > 0) { const hs = split(ss.nh);
+        [-sCL, sCL].forEach((stemX, k) => { for (let i = 0; i < hs[k]; i++) pts.push({ x: stemX + (i - (hs[k] - 1) / 2) * 2, y: cg, h: true }); }); }
+      return pts;
+    }
+    ss.rows.forEach((r, ri) => {
+      const n = r.n, xs = [...Array(n)].map((_, i) => (i - (n - 1) / 2) * 2), nd = r.dbnd > 0 ? Math.min(r.nd || 0, r.n) : 0;
+      const order = xs.map((x, i) => ({ x, i })).sort((a, b) => Math.abs(b.x) - Math.abs(a.x));   // outermost strands debonded first
+      const dbSet = new Set(order.slice(0, nd).map(o => o.i));
+      xs.forEach((x, i) => pts.push({ x, y: r.y, h: false, ri, db: dbSet.has(i), slot: i }));
+    });
+    if (ss.nh > 0) { const n = ss.nh, rows = Math.ceil(n / 2);
+      for (let i = 0; i < n; i++) { const row = Math.floor(i / 2), col = i % 2; pts.push({ x: (col - 0.5) * 2, y: cg + (row - (rows - 1) / 2) * 2, h: true }); } }
+    return pts;
+  }
+  /* positions of the strands of the section at the end (end true) or at midspan: [{ x, y, kind: 's' | 'd' (debonded at the end) | 'h' (draped), ri }] (xy) */
   function pattern(R, end) {
-    const ss = R.ss, out = [];
-    ss.rows.forEach(r => { const nd = end && r.dbnd > 0 ? r.nd : 0;
-      for (let i = 0; i < r.n; i++) out.push({ x: (i - (r.n - 1) / 2) * 2, y: r.y, kind: nd > 0 && debondedSlot(i, r.n, nd) ? 'd' : 's' }); });
-    if (ss.nh > 0) { const yc = end ? +ss.hp.yEnd : +ss.hp.yMid, np = Math.ceil(ss.nh / 2);
-      for (let j = 0; j < np; j++) { const y = yc + (j - (np - 1) / 2) * 2, two = 2 * j + 1 < ss.nh; out.push({ x: two ? -1 : 0, y, kind: 'h' }); if (two) out.push({ x: 1, y, kind: 'h' }); } }
-    return out;
+    const ss = R.ss, cg = ss.nh > 0 ? (end ? +ss.hp.yEnd : +ss.hp.yMid) : 0;
+    return xy(R, cg).map(p => ({ x: p.x, y: p.y, kind: p.h ? 'h' : end && p.db ? 'd' : 's', ri: p.ri }));
   }
-  /* the debonded strands of a row drawn symmetrically from the outside in (display; the engine needs only their number) */
-  function debondedSlot(i, n, nd) { const ord = []; for (let k = 0; ord.length < n; k++) { ord.push(k); if (n - 1 - k !== k && ord.length < n) ord.push(n - 1 - k); } return ord.slice(0, nd).indexOf(i) >= 0; }
+  /* rowBox(pts, ri) / drapedBox(pts): the extent of a row's (or the draped strands') drawn positions, for the point-at regions: [x0, x1, y0, y1] */
+  function box(q) { return q.length ? [Math.min(...q.map(p => p.x)) - 1, Math.max(...q.map(p => p.x)) + 1, Math.min(...q.map(p => p.y)) - 1, Math.max(...q.map(p => p.y)) + 1] : [-1, 1, -1, 1]; }
+  const rowBox = (pts, ri) => box(pts.filter(p => p.kind !== 'h' && !p.h && p.ri === ri)), drapedBox = pts => box(pts.filter(p => p.kind === 'h' || p.h === true));
   function section(R, end, W) {
     const V = VK(), S = V.scene(), G = R.g, ss = R.ss;
     const half = halfPolygon(G), poly = half.concat(half.slice().reverse().map(p => [-p[0], p[1]]));
@@ -31,11 +69,11 @@
     const rr = Math.max(ss.st.db / 2, 0.25), pts = pattern(R, end);
     pts.forEach(p => S.circ(p.x, p.y, rr, 'dt-bar', p.kind === 'h' ? { fill: DRP } : p.kind === 'd' ? { fill: '#fff', stroke: DB, sw: 1.2 } : {}));
     const xr = Math.max(G.bbf || 0, G.btf || 0) / 2;
-    ss.rows.forEach(r => S.region(-r.n - 1, r.y - 1, r.n + 1, r.y + 1, `${r.n} straight strands at y = ${fx(r.y, 2)} in${r.nd && r.dbnd ? `, ${r.nd} debonded ${fx(r.dbnd, 2)} ft from each end` : ''}`));
+    ss.rows.forEach((r, ri) => { const [x0, x1] = rowBox(pts, ri); S.region(x0, r.y - 1, x1, r.y + 1, `${r.n} straight strands at y = ${fx(r.y, 2)} in${r.nd && r.dbnd ? `, ${r.nd} debonded ${fx(r.dbnd, 2)} ft from each end` : ''}`); });
     if (ss.nh > 0) {
-      const yc = end ? +ss.hp.yEnd : +ss.hp.yMid, np = Math.ceil(ss.nh / 2), top = yc + (np - 1);
-      S.callout(1.2, top, 34, -14, [`draped (${ss.nh})`, `${end ? 'y_end' : 'y_mid'} = ${fx(yc, 2)} in`], { sz: 11 });
-      S.region(-2, yc - np, 2, yc + np, `${ss.nh} draped strands, centroid at ${end ? '℄ bearing y_end' : 'midspan y_mid'} = ${fx(yc, 2)} in`);
+      const yc = end ? +ss.hp.yEnd : +ss.hp.yMid, [dx0, dx1, dy0, dy1] = drapedBox(pts);
+      S.callout(dx1 + 0.2, dy1 - 1, 34, -14, [`draped (${ss.nh})`, `${end ? 'y_end' : 'y_mid'} = ${fx(yc, 2)} in`], { sz: 11 });
+      S.region(dx0 - 1, dy0 - 1, dx1 + 1, dy1 + 1, `${ss.nh} draped strands, centroid at ${end ? '℄ bearing y_end' : 'midspan y_mid'} = ${fx(yc, 2)} in`);
     }
     const nDb = end ? ss.rows.reduce((a, r) => a + (r.dbnd > 0 ? r.nd : 0), 0) : 0;
     S.dimV(0, G.h, -xr, -14, `h = ${fx(G.h, 1)} in`, { sz: 11 });
@@ -84,7 +122,7 @@
     const { R } = ctx, ss = R.ss, dr = ss.nh > 0;
     return V.detCard(slot, { id: o.id || 'strandFig', title: o.title || 'Strand pattern', sub: `${ctx.inp.girder}: ${ss.Ntot} strands (${ss.Nbond} straight${ss.Ndebond ? `, ${ss.Ndebond} debonded` : ''}${dr ? `, ${ss.nh} draped` : ''}), ${ctx.inp.str.size}`,
       draw: W => draw(ctx, W, !!o.compact), hint: 'Point at (or tap) a strand row or the draped strands for their values.',
-      cap: `<p class="vk-cap">Elevation: vertical scale exaggerated. ${dr ? `Draped strands: straight from ℄ bearing (y<sub>end</sub>) to the two hold-down points at frac × L<sub>span</sub> = ${fx(+ss.hp.frac, 3)} × ${fx(R.L, 2)} ft = ${fx(ss.hp.frac * R.L, 2)} ft from ℄ bearing (PS-13), level between them (y<sub>mid</sub>). ` : 'No draped strands. '}Sections: straight strands on a 2 in grid; ${dr ? 'draped strands as pairs on a 2 in grid about their centroid; ' : ''}debonded strands hollow at the end (which strands of a row are debonded is not an input: drawn from the outside in). Display only.</p>` });
+      cap: `<p class="vk-cap">Elevation: vertical scale exaggerated. ${dr ? `Draped strands: straight from ℄ bearing (y<sub>end</sub>) to the two hold-down points at frac × L<sub>span</sub> = ${fx(+ss.hp.frac, 3)} × ${fx(R.L, 2)} ft = ${fx(ss.hp.frac * R.L, 2)} ft from ℄ bearing (PS-13), level between them (y<sub>mid</sub>). ` : 'No draped strands. '}Sections: straight strands on a 2 in grid${R.g.isNext ? ', each row split between the two stems about each stem\'s ℄' : ''}; ${dr ? (R.g.isNext ? 'draped strands in a row in each stem at their centroid; ' : 'draped strands as pairs on a 2 in grid about their centroid; ') : ''}debonded strands hollow at the end (which strands of a row are debonded is not an input: drawn from the outside in). Display only.</p>` });
   }
-  window.PSBStrandGfx = { mount, pattern, draw };
+  window.PSBStrandGfx = { mount, pattern, draw, xy, rowBox, drapedBox, section };
 })();
diff --git a/apps/ps-bridge/ui/stresses.js b/apps/ps-bridge/ui/stresses.js
index b3bbd3d..211cb2b 100644
--- a/apps/ps-bridge/ui/stresses.js
+++ b/apps/ps-bridge/ui/stresses.js
@@ -84,9 +84,10 @@
     S.poly(poly, 'dt-cc'); sectionVoids(G).forEach(v => { if (v.type === 'rect') S.rect(v.x - v.w / 2, v.y - v.h / 2, v.x + v.w / 2, v.y + v.h / 2, 'dt-cc', { fill: '#fff' }); else S.circ(v.x, v.y, v.d / 2, 'dt-cc', { fill: '#fff' }); });
     // strands at the station (straight rows; the draped strands at their centroid at x)
     const xm = Math.min(r.x, R.L - r.x), a = +ss.hp.frac * R.L, yh = ss.nh > 0 ? (xm >= a ? +ss.hp.yMid : +ss.hp.yEnd + (+ss.hp.yMid - +ss.hp.yEnd) * xm / a) : 0;
-    ss.rows.forEach(q => { for (let j = 0; j < q.n; j++) S.circ((j - (q.n - 1) / 2) * 2, q.y, Math.max(ss.st.db / 2, 0.25), 'dt-bar'); });
-    if (ss.nh > 0) { const np = Math.ceil(ss.nh / 2); for (let j = 0; j < np; j++) { const y = yh + (j - (np - 1) / 2) * 2; S.circ(-1, y, ss.st.db / 2, 'dt-bar', { fill: '#B45309' }); if (2 * j + 1 < ss.nh) S.circ(1, y, ss.st.db / 2, 'dt-bar', { fill: '#B45309' }); }
-      S.callout(1.2, yh + np - 1, 30, -12, [`draped (${ss.nh})`], { sz: 10.5 }); }
+    // the drawn positions of the strand-pattern graphic (PSBStrandGfx.xy, the old app's strandXY; NEXT: in the two stems, PS-27), the draped ones about yh
+    const pts = window.PSBStrandGfx.xy(R, yh);
+    pts.forEach(q => S.circ(q.x, q.y, q.h ? ss.st.db / 2 : Math.max(ss.st.db / 2, 0.25), 'dt-bar', q.h ? { fill: '#B45309' } : undefined));
+    if (ss.nh > 0) { const [, dx1, , dy1] = window.PSBStrandGfx.drapedBox(pts); S.callout(dx1 + 0.2, dy1 - 1, 30, -12, [`draped (${ss.nh})`], { sz: 10.5 }); }
     // the stress profile beside the section (linear between the two fibres; + compression to the right)
     const lims = stage === 'rel' ? [[lim.relC, `${V.fx(lim.relCfac, 2)} f′_ci`], [-lim.relT, 'tension limit']] : stage === 's1' ? [[lim.srvC1, '0.45 f′_c'], [-lim.srvT, 'tension limit']] : [[lim.srvC2, '0.60 f′_c'], [-lim.srvT, 'tension limit']];
     const fmax = Math.max(Math.abs(fT), Math.abs(fB), ...lims.map(q => Math.abs(q[0])), 0.05), xr = Math.max(G.bbf || 0, G.btf || 0) / 2, X0 = xr + 0.55 * h, kx = 0.28 * h / fmax, X = f => X0 + kx * f;
@@ -138,5 +139,5 @@
     const ge = el.querySelector('#o_stGov'); if (ge) ge.addEventListener('click', () => { ui.stSel = null; if (ctx.redraw) ctx.redraw(); });
   }
   function onOutChange(e, ui) { if (e.target.id === 'o_stSel') { ui.stSel = +e.target.value; return true; } return false; }
-  window.PSBUiStresses = { output, after, onOutChange, TOPICS, CHECKS };
+  window.PSBUiStresses = { output, after, onOutChange, TOPICS, CHECKS, secFig };   // secFig: also for tests/engine/psbridge-strandgfx.test.mjs (PS-27)
 })();
```

## 2026-11-14 — PR 3c: the 3D view tab — the bridge in three.js (girder lines by type with their library shapes, deck, haunch, barriers, diaphragms, supports and skews, continuity, the strands of the type shown), the Steel Bridge app's 3D view pattern (display only; no calculation change)
PR #1533: https://github.com/mlococo88/All-Structural/pull/1533
### Request
- docs/ps-bridge-plan.md §5 row 3c ("3D view (three.js r128, steel `view3d` pattern) | display"), §2.3 (output tab "3D view"), PS-3 / PS-6 (looks and works like the Steel Bridge app).
### What changed
- New `apps/ps-bridge/ui/view3d.js` (`window.PSB3DUI`: `render`, `geom`, `camera`, `LAY`, `state`). These parts are copied from `apps/steel-bridge/ui/view3d.js` (`SBD3DUI`): `label`, `init` (renderer, lights, OrbitControls with damping and touch), `saveCam`, `loop`, `resize`, the camera home at the end of `build`, `css`, and the `render` frame (the "Loading the 3D library…" wait for the deferred three.js, the no-library and no-WebGL messages, layer toggles, Reset view, Save PNG). They are to move to `shared/` later (CLAUDE.md §3). The steel files are not changed.
- `geom(P)` (no DOM, no three.js) reads the project and the moved engine's pure geometry functions only:
  - each girder type × line cell (`PSBBridge.cells`) with its engine inputs (`PSBDesign.cellInputs`) and its shape (`girderGross`, `halfPolygon`, `sectionVoids`; NEXT flange from that line's S);
  - line offsets from the bays;
  - bearings on the skewed support lines: x = support station + (z − z_mid) tan θ, the Steel Bridge framing rule;
  - the girder past ℄ bearing by `opt.endOh` at the abutments;
  - deck t_s, haunch t_h (none for box / deck beams, as the engine), barriers and sidewalks (`P.xs.dl`);
  - diaphragms (`loads.diaph`, a from each line's left bearing);
  - continuity diaphragms on the pier lines when the spans are made continuous;
  - bearing pads (`opt.Lpad`; NEXT: one per stem), seats and caps;
  - the strands of the girder type shown above the output tabs, on each of its lines. Positions come from `PSBStrandGfx.xy` (PS-27), y = the soffit + the row's engine y. Debonded lengths are drawn in their own colour. Draped strands run from y_end at ℄ bearing to y_mid at frac × L from each ℄ bearing (PS-13).
- `render(host, ctx)` draws `geom` with three.js:
  - girders extruded from the outline with the voids as holes, coloured by type with a key (type: shape, span, lines); the type shown is see-through so its strands show;
  - the deck as a skewed prism, plus haunch, barriers, diaphragms, pads, seats and caps;
  - strands as line segments;
  - sprite labels G1…Gn, Abut. 1 / Pier k / Abut. 2, and "Span s: L = … ft (continuous | simple)";
  - a summary note of the bridge.
  - Phone layout: the controls wrap; the canvas is min(68vh, 680 px) high, at least 320 px; the home camera is set farther back on a narrow canvas.
- `index.html`: `ui/view3d.js` added to the script list; the 3D view placeholder is replaced by the tab (`#v3dHost`, `PSB3DUI.render`, only when there is no input error). The three.js r128 + OrbitControls 0.128.0 tags were already in the page at the steel app's pins (no new library, no version change).
### Saved data (CLAUDE.md §5)
- No new key. The layer choices and the camera are kept in the page's ui state `psb2.ui` (field `v3d: { lay, cam }`), as the steel app keeps them in `sbd2.ui`. The project format is unchanged.
### Governing provisions
- None (display only; no engineering value is computed; the engine is not called). Harness B unchanged (below).
### Check case (new project: one 120 ft span, 5 PCI BT-72 at 9.0 ft, overhangs 3.0 ft, no skew, t_s 8 in, t_h 2 in)
- Girders: z = 0, 108, 216, 324, 432 in (G1–G5). Bearings at x = 0 and 1440 in (120 ft × 12). Depth 72 in. Deck soffit at 72 + 2 = 74 in above the girder soffits; deck top at 82 in. Deck width (3 + 36 + 3) × 12 = 504 in from z = −36 to 468 in.
- 25° skew (110 ft span, the same bays): G1's bearings at x = (0 + (0 − 18) tan 25°) × 12 = −100.7 in and 1320 − 100.7 = 1219.3 in. Bearing to bearing = 1320 in = the span. Diaphragms at a = 36.67 ft: x = G1's bearing + 440 in, on each of the 4 bays.
### How verified
- New `tests/engine/psbridge-view3d.test.mjs` (5 tests). Bridges covered:
  - a new project;
  - two simple spans with a different shape in span 2, unequal bays and endOh 9 in;
  - NEXT 36F adjacent;
  - 25° skew with diaphragms, and unequal skews 10° / 20°;
  - three spans made continuous at 10° skew, and the same as simple spans.
- For every cell the test checks:
  - z = the line's offset;
  - bearings on the support lines; bearing to bearing = span, or span + (z − z_mid)(tan θ₂ − tan θ₁); the engine's L = span;
  - endOh at the abutments only;
  - outline and voids = the library's; haunch;
  - deck width and t_s;
  - strands: one line per strand on the lines of the type shown, at `xy`'s positions; draped strands at ℄ bearing and at frac × L; NEXT strands inside the stems;
  - diaphragm and continuity-diaphragm positions.
- New `tests/smoke/ps-bridge-3d.mjs` (101 checks, 0 failed). Five bridges (new, multi-type, NEXT, skewed, continuous) at 1400 and 390 px, headless Chromium from file://. It checks:
  - the WebGL canvas is drawn (not blank);
  - the build's counts = `geom` of the stored project;
  - one girder per cell; strands are drawn;
  - the key lists every type;
  - continuity diaphragms at both piers; 8 diaphragms on the skewed bridge; the NEXT pads per stem;
  - no sideways scroll; 0 console errors; nothing blocked;
  - a layer toggle and the camera are kept in `psb2.ui` and restored on reload;
  - only `psb2.*` keys are written.
- `tests/engine/psbridge-model.test.mjs`: the page's script list now includes `ui/view3d.js`.
- `node tests/engine/run.mjs psbridge tex project-registry`: 18 files, 178 passed, 0 failed. `node tests/check-syntax.mjs`: all scripts pass.
- Smokes: `ps-bridge-skeleton.mjs` 252 checks, 0 failed; `ps-bridge-types.mjs` 106 checks, 0 failed. Harness B: normal 17 designs, 0 with differences, exit 0; `--import` 0 with differences, exit 0; `--control` 17 with differences, exit 1; `--import --control` 17 with differences, exit 1.
- Screenshots: the five bridges at 1400 and 390 px; a rotated view with the deck layer off.
### Decisions (pending engineer review)
- PS3c-D1. Only girder lines with a girder type are drawn (a line with no type is listed on the Girders & strands tab, not drawn).
- PS3c-D2. Barrier height is 32 in (schematic: the Cross-section tab enters only its width). Sidewalk height = its entered thickness.
- PS3c-D3. Diaphragms are entered per girder type as a point load at a from the left ℄ bearing (no size). They are drawn in each bay next to a line whose type has one, parallel to the supports: 10 in thick, 0.75 × the shallower girder's depth, hung from the girder tops. None where the clear gap between adjacent units is 1 in or less (adjacent NEXT, boxes, deck beams).
- PS3c-D4. Spans made continuous for composite loads: one continuity diaphragm on each pier line, 24 in thick, from the deepest girder soffit to the deck soffit, between the exterior girder lines (schematic). Simple spans: none.
- PS3c-D5. Bearing pads are L_pad (opt.Lpad) long, the bottom width wide (NEXT: one per stem, B wide), 3 in thick. Seats and pier caps are 42 × 42 in along the support lines, as in the steel view.
- PS3c-D6. Girder ends are square to the girder at the ℄ bearing, extended by opt.endOh at the abutments only. At a pier, the girders of the two spans meet at the support line (the model's spans are ℄ bearing to ℄ bearing).
- PS3c-D7. The deck is drawn with the largest t_s of the girder types (the types share one deck).
- PS3c-D8. With unequal skews at a span's two supports, each line is drawn between its own bearings on the skewed support lines (its length differs from the span by (z − z_mid)(tan θ₂ − tan θ₁)). The engine designs every line with L = the span (unchanged; noted here only).
- PS3c-D9. Strands are shown for the girder type shown above the output tabs, on each of its lines. That type's girders are drawn see-through.
### Other copies
- `apps/steel-bridge/ui/view3d.js`: the copied pieces listed above (to move to `shared/` later; the steel file is not changed).
### Before / after (exact)
- New file `apps/ps-bridge/ui/view3d.js` (the whole file is new). `apps/ps-bridge/index.html`:
```diff
diff --git a/apps/ps-bridge/index.html b/apps/ps-bridge/index.html
index 435c64f..004eb8c 100644
--- a/apps/ps-bridge/index.html
+++ b/apps/ps-bridge/index.html
@@ -87,6 +87,7 @@
     'ui/rating.js',      // PR 2d-2: Rating tab
     'ui/report.js',      // PR 2e: Report tab (adapted copy of apps/steel-bridge/ui/report.js)
     'ui/dash.js',     // the check summary column (adapted copy of apps/steel-bridge/ui/dash.js)
+    'ui/view3d.js',   // PR 3c: the 3D view tab (the Steel Bridge app's 3D view pattern, apps/steel-bridge/ui/view3d.js; three.js r128 below)
     'ui/summary.js',  // PR 3b: the Summary tab (adapted copy of apps/steel-bridge/ui/summary.js): verdict, girder × span grid, type × check table
     'ui/splitter.js'  // the splitter between the input and output panels (copy of apps/steel-bridge/ui/splitter.js)
   ].forEach(function (s) { document.write('<script src="' + s + '?v=' + v + '"><\/script>'); });
@@ -469,8 +470,7 @@
   /* ---------- outputs (placeholders; docs/ps-bridge-plan.md §2.3, §5) ---------- */
   const OUT = {
     dwg: ['7', ['girder sheet, strand and draping schedule (hold-down from ℄ bearing and from the girder end, PS-13), camber table; DXF']],
-    ad: ['5', ['the auto-design proposal per design group and its trial log (Run on the Auto design input tab)']],
-    '3d': ['3c', ['the bridge in 3D (three.js, as the Steel Bridge app)']]
+    ad: ['5', ['the auto-design proposal per design group and its trial log (Run on the Auto design input tab)']]
   };
   /* the design's engine results (PR 2b-2): computeAll of the design inputs (engine/design.js), kept while the inputs are the same; the worked
      steps of the three result tabs (engine/worked.js) made once per result. Only when there is no input error. */
@@ -564,6 +564,8 @@
       if (!errs.length) h += window.PSBSummaryUI.html({ P, A: ok ? allResults() : null, run: runState(), shown: (ok ? card(`Design girder: ${esc(rc.inp.proj.girderId)}, span ${window.PSBDesign.sel(P).s}`, `<div class="kv"><div><span>Section</span><span>${esc(rc.inp.girder)}, ${rc.R.ss.Ntot} strands</span></div><div><span>Composite I<sub>c</sub></span><span>${fmt(rc.R.cp.Ic, 0)} in⁴ <a href="#" data-gotab="sec">Section properties</a></span></div>
             <div><span>DF<sub>M</sub> / DF<sub>V</sub></span><span>${fmt(rc.R.dfm, 3)} / ${fmt(rc.R.dfv, 3)} <a href="#" data-gotab="lds">Loads &amp; LLDF</a></span></div><div><span>M<sub>u</sub> at midspan</span><span>${fmt(rc.R.diagrams.reduce((b, r) => Math.abs(r.x - rc.R.L / 2) < Math.abs(b.x - rc.R.L / 2) ? r : b).M_StrI_pos, 0)} kip-ft <a href="#" data-gotab="an">Analysis</a></span></div></div>
             ${rc.R.warns.length ? `<div class="alert"><b>Design warnings of the engine (${rc.R.warns.length})</b><ul>${rc.R.warns.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '<p class="note">No design warnings.</p>'}`) : '') });
+    } else if (ui.otab === '3d') {
+      if (!errs.length) h += '<div id="v3dHost"></div>';   // PR 3c: the 3D view (ui/view3d.js), mounted below
     } else if (ui.otab === 'rpt') {
       if (ok) h += '<div id="rptHost"></div>';   // PR 2e: the Report (ui/report.js), mounted below
     } else { const o = OUT[ui.otab]; h += ph(esc(name), o[0], o[1]); }
@@ -573,6 +575,8 @@
     if (ui.otab === 'rpt' && ok && $('rptHost')) { ui.rpt = ui.rpt || {};
       try { window.PSBReportUI.render($('rptHost'), { P, rc, opts: ui.rpt, save: saveUi, goto: t => gotoOut(t), goin: t => { ui.itab = t; saveUi(); drawInputs(); $('inputPanel').scrollTop = 0; } }); }
       catch (e) { $('rptHost').innerHTML = `<div class="alert err" role="alert">Report error: ${esc(e && e.message)}</div>`; console.warn(e); } }
+    // PR 3c: the 3D view of the bridge (display only; its layer and camera choices kept in ui.v3d, psb2.ui)
+    if (ui.otab === '3d' && $('v3dHost')) { try { window.PSB3DUI.render($('v3dHost'), { P, ui, saveUi }); } catch (e) { $('v3dHost').innerHTML = `<div class="alert err" role="alert">3D view error: ${esc(e && e.message)}</div>`; console.warn(e); } }
     if (window.PSBDashUI) window.PSBDashUI.refresh();
   }
   const gotoOut = t => { ui.otab = t; saveUi(); drawOut(); $('outputPanel').scrollTop = 0; };
```

## 2026-11-14 — PS-28: a strand pattern that does not fit the girder shape is a blocking input error naming its row (input validation; no calculation change)
PR #1535: https://github.com/mlococo88/All-Structural/pull/1535
### Request
- Engineer decision PS-28 (2026-11-14), the open item of PS-27: strands drawn outside the concrete, in a void, or too close to an edge become an input error naming the row; results are blocked until it is fixed (the same style as the other input errors: message, field outlined, check summary, Report blocked). Patterns that fit: identical results.
### Problem
- The engine places strands by row y and count only; nothing stopped a pattern that cannot be built: e.g. the default rows of 10 strands on an AASHTO Type I (16 in bottom flange: x = ±9 in is outside it), a row at y = 6 in in an AASHTO BI-36 (inside the void, which starts 5 in above the soffit), or a NEXT draped row wider than a stem. The engine's own warning covers only the row count against the bottom width ("≈N that fit … with 2″ edge cover"), not voids, tapers or the draped strands.
### What changed
- `apps/ps-bridge/engine/inputcheck.js`:
  - New `fitOf(b, L, S, E)`, called from `inputsOf` for the base inputs and for each girder type's own inputs (so a type with its own shape is checked on that shape, its error named for the type, in its scope).
  - New helpers `misfit`, `insidePoly`, `edgeDist`, `COVER = 2`; `misfit` and `COVER` exported for the tests.
  - `inputsOf(P, b, L, E)` gets a fifth argument `S`: the girder spacing of a line of those inputs, which sets the NEXT flange width. `collect` passes `PSBDesign.lineS` of the design girder line for the base, and of the type's first line for a type.
  - Positions: `PSBStrandGfx.xy` (ui/strands.js), the single source of the drawn positions (PS-27, the old app's `strandXY`). It is evaluated on the engine's own `girderGross` (NEXT flange from S) and `strandSys` of the inputs. Each row is placed on its own (positions do not depend on the other rows). The draped strands are placed about y_end (℄ bearing) and about y_mid (midspan), the two sections the graphic draws.
- Criterion. A strand fits when its centre is:
  1. inside the concrete outline (`halfPolygon` mirrored about the ℄);
  2. not inside a void (`sectionVoids`);
  3. at least 2 in from every edge of the outline;
  4. at least 2 in from the edge of every void.

  Each distance is measured from the strand **centre**, with no half strand diameter taken off. This is the PS-27 test's `fitsAt` (tests/engine/psbridge-strandgfx.test.mjs) and the engine's "2″ grid with 2″ edge cover" (row capacity floor((b − 4)/2) + 1). Exactly 2 in fits (1e-9 in tolerance).
- Error per straight row. The path is `base.rows.<i>.y` when one strand of the row does not fit at that y (NEXT: one in each stem), else `base.rows.<i>.n`. The cell is the row. The message names the row, the count, y, the shape, the first strand that does not fit (x) and why, and the rule. Example: "Straight strand rows, row 1: 10 strands at y = 2 in do not fit the AASHTO Type I: the strand at x = -9 in is outside the concrete outline; each strand centre must be inside the concrete, outside the voids and at least 2 in from the edges of the concrete and of the voids (the positions the strand pattern draws)."
- Draped strands: one error at `base.harp.yEnd` and/or `base.harp.yMid`. The message names n_h, the centroid and the strand (x, y).
- Not checked:
  - a row or draped centroid that already has its own error (not a whole count, y blank or ≥ h);
  - a row of 0 strands;
  - a Custom shape (PS28-D1).
- Only inputs are read; no project field is written. A design that does not fit (an imported old-app design too) is kept as entered and opens with the error. The import summary lists it with the other input errors (legacy.js already lists `collect`'s errors).
- `tests/engine/psbridge-tab-cases.mjs`: two of harness B's 17 designs did not fit, so they are now input errors. Their strand rows were changed to patterns that fit, keeping what each case tests:
  - "flanged flexure (thin deck, 46 strands)": rows 16 / 16 / 14 at y = 2 / 4 / 6 in drew strands at x = ±15 in, outside the BT-72's 26 in bottom flange. Now 12 / 12 / 8 / 2 at y = 2 / 4 / 6 / 8 in plus the 12 draped = 46 strands. Still flanged: at midspan rect = false, a = 12.77 in (before 16.96 in) against h_f = 7 in.
  - "box BIII-36 with a 6 in topping": a row of 8 at y = 4 in was 1 in from the void. Now 16 at y = 2 in.
  
  Harness B compares the new app with the old app for the same inputs, so both cases are still compared value for value.
### Saved data (CLAUDE.md §5)
- None changed: no key, no field, no format. Nothing is written by the check; stored projects and imported old designs keep their strands as entered.
### Governing provisions
- None changed. No engineering formula, factor, unit or reference changes; no computed value changes (the engine files are not touched; see How verified). The 2 in centre-to-edge criterion is the engineer's PS-28 decision, the same rule as the PS-27 test and as the engine's row-capacity warning.
### Check cases (hand)
- AASHTO Type I (b_bf = 16 in, x = ±8 in; d = [4, 3, 5, 5]), one row of 10 at y = 2 in:
  - Positions on the 2 in grid about the ℄: x = ±1, ±3, …, ±9 in; ±9 > 8 → outside → error on the count (`base.rows.0.n`), "the strand at x = -9 in is outside the concrete outline".
  - 7 strands: x = ±6, 8 − 6 = 2 in ≥ 2 → fits (no error).
  - 8 strands: x = ±7, 1 in → error "is 1 in from the edge of the concrete".
  - Before: no error, results shown.
- AASHTO BI-36 (36 × 12 in, wall 5 in, void 26 × 5 in, y = 5 to 10 in): rows 10 @ 2 in, 4 @ 6 in:
  - Row 2 at x = ±1, ±3 in, y = 6 in is inside the void → error on y (`base.rows.1.y`), "the strand at x = -3 in is inside a void".
  - At y = 3 in: 5 − 3 = 2 in to the void → fits.
  - Before: no error.
- AASHTO Type II girder type in span 2 (b_bf 18 in, taper (9, 6) to (3, 12)) with the base's 10 / 10 / 8 rows:
  - Rows 1–2 at x = ±9 → 0 in from the side;
  - row 3 at (±7, 6): 2 sin 45° = 1.41 in from the taper → three errors, "Girder type Interior S2: …", scope T3.
### How verified
- New `tests/engine/psbridge-strandfit.test.mjs` (7 tests):
  1. The criterion at hand-picked points (Type I, BI-36, voided slab).
  2. `collect`'s verdict = an independent copy of the PS-27 test's `fitsAt` over `xy`, for every library shape (NEXT at 96 and 144 in flanges), every row count up to two more than the engine's row capacity, y = 1…11 in and every 4 in above, and draped strands (n_h 2–12, four y_end, four y_mid). Over 1 500 cases, over 300 of them not fitting; the field chosen (n or y) is checked too.
  3. The two hand checks above.
  4. The defaults fit: a new project, the default project (the old app's DEFAULTS of pbd-library.js on its PCI BT-72), and the 17 designs of harness B.
  5. The girder type's own shape (scoped error).
  6. An old-app Export JSON (Type I, 10 @ 2 in) through `PSBLegacy.fromText` / `convert`: the error, the rows / harp / `legacy.inputs` kept as read, the import summary naming it, the same after export and import of the project.
  7. Nothing written; `computeAll` identical with and without the check loaded (all 17 designs + the default); the page loads `ui/strands.js`.

  Mutation check: with the `fitOf` call commented out, tests 2, 3, 5 and 6 fail.
- `tests/smoke/ps-bridge-skeleton.mjs` (PS-28 part, on the page):
  - 16 strands in row 1 of the BT-72: the count outlined with its message;
  - counted on the Girders & strands tab (1) and listed in the check summary;
  - the entered 16 kept in `psb2.project.current`;
  - the Report tab shows "Results not shown" with the error, no Report;
  - 10 again: no errors.
- Results: `node tests/engine/run.mjs psbridge tex project-registry`: 19 files, 185 passed, 0 failed. `node tests/check-syntax.mjs`: all scripts pass. Smokes: `ps-bridge-skeleton.mjs` 257 checks, 0 failed (5 new PS-28 checks); `ps-bridge-types.mjs` 106 checks, 0 failed; `ps-bridge-3d.mjs` 101 checks, 0 failed. Harness B (`tests/psbridge-compare.mjs`, 17 designs): normal 0 with differences, exit 0; `--import` 0 with differences, exit 0; `--control` 17 with differences, exit 1; `--import --control` 17 with differences, exit 1. Identical results for patterns that fit: the engine files are not changed (only engine/inputcheck.js, which reads inputs); test 7 above computes the 17 designs and the default with and without the check loaded: `computeAll` the same; harness B: the values shown = the old app's for all 17 designs.
- Information (not changed; for the engineer): of the 658 old-app designs of parity harness A imported through "From the old app", 228 now open with a PS-28 error:
  - 8 of the 38 recorded designs (`tests/projects/ps/shape_*`: the four boxes with a second row at y = 4 in, 1 in from the void; AASHTO Type I and II with 6 / 8 strands at y = 6 in in the flange taper; the two voided deck slabs with 10 strands at y = 4 in, 1.2 in from the round voids);
  - 219 of the 600 seeded designs;
  - 1 of the 20 edge cases.

  Their data is kept; they show the error until fixed.
### Decisions (pending engineer review)
- PS28-D1. A Custom shape is not checked: its outline is drawn with the default flange thicknesses d = [4, 3, 5, 5] (not entered), so a real flange could be thicker than drawn and the check would flag strands that fit.
- PS28-D2. The draped strands are checked at ℄ bearing (about y_end) and at midspan (about y_mid), the two sections drawn; not in between (in the library's shapes a path between two sections that fit stays in the concrete: the draped strands sit at x = ±1 in (NEXT: in the stems), and in a box they fit only in the bottom wall, the top walls being 2 in thick; the voided slabs' voids are at x = ±12 in or wider).
- PS28-D3. The field outlined for a straight row is y when a single strand of the row (NEXT: one in each stem) does not fit at that y (the row's height is the problem), else the count n; for the draped strands y_end or y_mid (the section that does not fit).
- PS28-D4. Strands overlapping each other (e.g. a draped strand 1 in from a straight strand at midspan) are not part of the criterion (concrete fit only, as the PS-27 test).
### Other copies
- None.
### Before / after (exact)
```diff
diff --git a/apps/ps-bridge/engine/inputcheck.js b/apps/ps-bridge/engine/inputcheck.js
index eebf31a..da4ab5f 100644
--- a/apps/ps-bridge/engine/inputcheck.js
+++ b/apps/ps-bridge/engine/inputcheck.js
@@ -46,24 +46,26 @@
     if (BR && P.xs && P.spans) { const c = BR.checks(P); c.errors.forEach(e => E(e.path, e.msg, 'types')); c.warnings.forEach(w => warnings.push({ path: w.path, msg: w.msg, src: 'types' })); }
     if (window.PSBBridgeDL && P.xs) window.PSBBridgeDL.checks(P).forEach(e => E(e.path, e.msg, 'dl'));   // PR 3a-3: the DC2 / DW distribution inputs
     const Ls = s => P.spans && Array.isArray(P.spans.lengths) ? P.spans.lengths[s - 1] : NaN;
-    inputsOf(P, P.base, Ls(window.PSBDesign ? window.PSBDesign.sel(P).s : 1), E);
+    const lS = g => (window.PSBDesign && P.xs ? window.PSBDesign.lineS(P, g) : NaN);   // PS-28: the girder spacing of a line (a NEXT flange width)
+    inputsOf(P, P.base, Ls(window.PSBDesign ? window.PSBDesign.sel(P).s : 1), E, lS(window.PSBDesign ? window.PSBDesign.sel(P).g : 1));
     /* PR 3a-1: each girder type's own inputs (the base with its overrides, on its span's length) checked by the same rules; an error the base
        does not already have is the type's: its message names the type, scope = the type's id (the page shows the field in that type's
        scope). */
     if (BR && BR.hasTypes(P)) {
       const seen = new Set(errors.map(e => e.path + '|' + e.msg));
       P.types.forEach((T, k) => {
-        if (!BR.typeLines(P, k).length) return;
+        const tl = BR.typeLines(P, k); if (!tl.length) return;
         const Pv = Object.assign({}, P, { base: BR.effBase(P, k) });
         inputsOf(Pv, Pv.base, Ls(T.span), (path, msg, src, cell) => { if (seen.has(path + '|' + msg)) return;
-          const e = { path, msg: `Girder type ${T.label}: ${msg}`, src, scope: T.id }; if (cell != null) e.cell = cell; errors.push(e); seen.add(path + '|' + msg); });
+          const e = { path, msg: `Girder type ${T.label}: ${msg}`, src, scope: T.id }; if (cell != null) e.cell = cell; errors.push(e); seen.add(path + '|' + msg); }, lS(tl[0]));
       });
     }
     return { errors, warnings };
   }
-  /* inputsOf(P, b, L, E): the field, table and location rules on the inputs object b (P.base, or a girder type's effective inputs), with the
-     span length L of the design (PR 2b; moved into a function in PR 3a-1, the rules unchanged) */
-  function inputsOf(P, b, L, E) {
+  /* inputsOf(P, b, L, E, S): the field, table and location rules on the inputs object b (P.base, or a girder type's effective inputs), with the
+     span length L of the design (PR 2b; moved into a function in PR 3a-1, the rules unchanged); S: the girder spacing of a line of these
+     inputs (ft; the NEXT flange width of the strand fit, PS-28) */
+  function inputsOf(P, b, L, E, S) {
     const get = F().get, plain = F().plain;
     // the fields of the input cards (engine/fields.js), where shown
     F().CARDS.forEach(c => {
@@ -98,11 +100,76 @@
       if (+b.harp.n > 0) ['yEnd', 'yMid'].forEach(k => { const y = b.harp[k]; if (isNum(y) && y >= h) E(`base.harp.${k}`, `Draped strand centroid y_${k === 'yEnd' ? 'end' : 'mid'} = ${y} in is not inside the girder (h = ${h} in).`, 'geometry'); });
       if (b.ovr && b.ovr.on && isNum(+b.ovr.yb) && b.ovr.yb !== '' && +b.ovr.yb >= h) E('base.ovr.yb', `y_b (override) = ${b.ovr.yb} in is not inside the girder (h = ${h} in).`, 'geometry');
     }
+    fitOf(b, L, S, E);   // PS-28: every strand of the pattern inside the concrete of the shape
     if (b.girder === 'Custom' && b.cust && isNum(b.cust.yb) && isNum(b.cust.h) && b.cust.yb >= b.cust.h) E('base.cust.yb', `Custom section: y_b = ${b.cust.yb} in must be less than h = ${b.cust.h} in.`, 'geometry');
     if (isNum(L) && Array.isArray(b.loads && b.loads.diaph)) b.loads.diaph.forEach((d, i) => { if (isNum(d.a) && d.a > L) E(`base.loads.diaph.${i}.a`, `Diaphragms, row ${i + 1}: a = ${d.a} ft is beyond the span (L = ${L} ft).`, 'geometry', i); });
     const m = b.mat || {};
     if (isNum(m.ti) && isNum(m.td) && m.td <= m.ti) E('base.mat.td', `Age at deck placement t_d (${m.td} days) must be later than the age at release t_i (${m.ti} days).`, 'geometry');
     if (isNum(m.td) && isNum(m.tfin) && m.tfin <= m.td) E('base.mat.tfin', `Final age t_f (${m.tfin} days) must be later than the age at deck placement t_d (${m.td} days).`, 'geometry');
   }
-  window.PSBInputCheck = { collect, ruleMsg, depthOf };
+  /* PS-28 (engineer decision 2026-11-14): a strand pattern that does not fit the girder shape is a blocking input error naming its row.
+     The positions are the drawn ones: PSBStrandGfx.xy (ui/strands.js, the single source of the drawn strand positions: the old app's
+     strandXY, PS-27) of the engine's own girder (girderGross, NEXT flange width from S) and strand system (strandSys) of these inputs.
+     A strand fits when its centre is
+       (1) inside the concrete outline (halfPolygon mirrored about the girder ℄),
+       (2) not inside a void (sectionVoids),
+       (3) at least COVER = 2 in from every edge of the outline, and
+       (4) at least COVER = 2 in from the edge of every void,
+     each distance measured from the strand CENTRE (not from its surface; no half strand diameter taken off): the engine's "2″ grid with
+     2″ edge cover" of its row-capacity warning (pbd-compute.js: floor((b − 4)/2) + 1 strands across a width b) and the criterion of
+     tests/engine/psbridge-strandgfx.test.mjs (PS-27, fitsAt). Equal to 2 in fits (1e-9 in tolerance).
+     Checked: each straight row at its y (an error per row: the field y when a single strand of the row (NEXT: one in each stem) does not
+     fit at that y, else the count n); the draped strands about y_end (at ℄ bearing) and about y_mid (midspan; the hold-down points), the
+     two sections the graphic draws (an error each: y_end, y_mid). Only where the other rules of the row pass (a whole count, y a number
+     inside the depth): those have their own messages. Not checked: a Custom shape (its outline is drawn with the library's default flange
+     thicknesses, not entered: PS28-D1, pending engineer review). Only inputs are read: nothing is written, so a pattern that does not fit
+     (an imported old-app design too) is kept as entered and shows this error until it is fixed. */
+  const COVER = 2;
+  const fx = v => { const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };
+  function insidePoly(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j];
+    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
+  function edgeDist(poly, x, y) { let d = Infinity; for (let i = 0; i < poly.length; i++) { const a = poly[i], q = poly[(i + 1) % poly.length], dx = q[0] - a[0], dy = q[1] - a[1], L2 = dx * dx + dy * dy;
+    const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0; d = Math.min(d, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)); } return d; }
+  /* misfit(g, poly, q): '' when the strand centre q fits (1)-(4), else why it does not */
+  function misfit(g, poly, q) {
+    if (!insidePoly(poly, q.x, q.y)) return 'is outside the concrete outline';
+    const vs = sectionVoids(g);
+    if (vs.some(v => v.type === 'rect' ? Math.abs(q.x - v.x) < v.w / 2 && Math.abs(q.y - v.y) < v.h / 2 : Math.hypot(q.x - v.x, q.y - v.y) < v.d / 2)) return 'is inside a void';
+    const de = edgeDist(poly, q.x, q.y); if (de < COVER - 1e-9) return `is ${fx(de)} in from the edge of the concrete (less than ${COVER} in)`;
+    const dv = vs.reduce((m, v) => Math.min(m, v.type === 'rect' ? Math.hypot(Math.max(Math.abs(q.x - v.x) - v.w / 2, 0), Math.max(Math.abs(q.y - v.y) - v.h / 2, 0)) : Math.hypot(q.x - v.x, q.y - v.y) - v.d / 2), Infinity);
+    if (dv < COVER - 1e-9) return `is ${fx(dv)} in from a void (less than ${COVER} in)`;
+    return '';
+  }
+  /* fitOf(b, L, S, E): the PS-28 errors of the inputs b (span L ft, line spacing S ft) */
+  function fitOf(b, L, S, E) {
+    const SG = window.PSBStrandGfx;
+    if (!SG || typeof GIRDERS === 'undefined' || typeof STRANDS === 'undefined' || typeof girderGross !== 'function' || typeof strandSys !== 'function') return;
+    const raw = b && b.girder !== 'Custom' ? GIRDERS[b.girder] : null; if (!raw || raw.custom) return;
+    if (raw.next && !(isNum(S) && S > 0)) return;
+    if (!b.str || !STRANDS[b.str.size] || !b.mat) return;
+    const h = +raw.h, base = Object.assign({}, b, { S, L: isNum(L) && L > 0 ? L : 100 });
+    let g, poly; try { g = girderGross(base); const hp = halfPolygon(g); poly = hp.concat(hp.slice().reverse().map(p => [-p[0], p[1]])); } catch (e) { return; }
+    const pos = (rows, harp, cg) => { const inp = Object.assign({}, base, { rows, harp }); return SG.xy({ g, ss: strandSys(inp, g) }, cg); };
+    const bad = pts => { for (const q of pts) { const w = misfit(g, poly, q); if (w) return { q, w }; } return null; };
+    const at = q => (q.h ? `(x, y) = (${fx(q.x)}, ${fx(q.y)}) in` : `x = ${fx(q.x)} in`);
+    const RULE = `each strand centre must be inside the concrete, outside the voids and at least ${COVER} in from the edges of the concrete and of the voids (the positions the strand pattern draws)`;
+    const noHarp = { n: 0, yEnd: 0, yMid: 0, frac: 0.4 };
+    (Array.isArray(b.rows) ? b.rows : []).forEach((r, i) => {
+      if (!r || !(Number.isInteger(r.n) && r.n > 0 && isNum(r.y) && r.y > 0 && r.y < h)) return;
+      try {
+        const f = bad(pos([{ n: r.n, y: r.y, dbnd: 0, nd: 0 }], noHarp, 0)); if (!f) return;
+        const one = bad(pos([{ n: Math.min(r.n, raw.next ? 2 : 1), y: r.y, dbnd: 0, nd: 0 }], noHarp, 0));
+        E(`base.rows.${i}.${one ? 'y' : 'n'}`, `Straight strand rows, row ${i + 1}: ${r.n} strand${r.n === 1 ? '' : 's'} at y = ${fx(r.y)} in do not fit the ${b.girder}: the strand at ${at(f.q)} ${f.w}; ${RULE}.`, 'geometry', i);
+      } catch (e) { /* the engine could not place them: other rules report the inputs */ }
+    });
+    const hp = b.harp || {}, n = hp.n;
+    if (Number.isInteger(n) && n > 0) ['yEnd', 'yMid'].forEach(k => {
+      const y = hp[k]; if (!(isNum(hp.yEnd) && isNum(hp.yMid) && isNum(y) && y > 0 && y < h)) return;
+      try {
+        const f = bad(pos([], { n, yEnd: hp.yEnd, yMid: hp.yMid, frac: isNum(+hp.frac) && +hp.frac > 0 ? +hp.frac : 0.4 }, y).filter(q => q.h)); if (!f) return;
+        E(`base.harp.${k}`, `Draped strands: the ${n} draped strands about y_${k === 'yEnd' ? 'end' : 'mid'} = ${fx(y)} in (${k === 'yEnd' ? 'at ℄ bearing' : 'at midspan'}) do not fit the ${b.girder}: the strand at ${at(f.q)} ${f.w}; ${RULE}.`, 'geometry');
+      } catch (e) { /* as above */ }
+    });
+  }
+  window.PSBInputCheck = { collect, ruleMsg, depthOf, COVER, misfit };
 })();
diff --git a/tests/engine/psbridge-tab-cases.mjs b/tests/engine/psbridge-tab-cases.mjs
index a30b678..63db1bf 100644
--- a/tests/engine/psbridge-tab-cases.mjs
+++ b/tests/engine/psbridge-tab-cases.mjs
@@ -16,8 +16,10 @@ export const TAB_CASES = base => ({
     P.base.opt.corrosion = 'severe'; P.base.opt.relBondedReinf = true; P.base.opt.relAs = 2; P.base.loads.fatM = 0.45; P.base.opt.dfpSSauto = false; P.base.opt.dfpSS = 1.5; return P; })(),
   'cracked under Service III (few strands), continuous with top steel, two spans': (() => { const P = base(); P.base.rows = [{ n: 10, y: 2, nd: 0, dbnd: 0 }, { n: 8, y: 4, nd: 0, dbnd: 0 }]; P.base.harp.n = 4;
     P.spans = { lengths: [120, 120], continuity: 'composite' }; P.xs.skews = [0, 0, 0]; P.base.cont.restraint = true; P.base.cont.AsTop = 3; return P; })(),
+  // PS-28 (2026-11-14): the strand rows fit the BT-72 (16 / 16 / 14 at y = 2 / 4 / 6 in drew strands outside its 26 in bottom flange, now an
+  // input error): 12 / 12 / 8 / 2 at y = 2 / 4 / 6 / 8 in + the 12 draped = 46 strands; the section is still flanged (b1 c > h_f)
   'flanged flexure (thin deck, 46 strands), two spans, young girder (positive restraint), positive moment connection steel': (() => { const P = base(); P.base.ts = 5; P.xs.bays = [6, 6, 6, 6];
-    P.base.rows = [{ n: 16, y: 2, nd: 0, dbnd: 0 }, { n: 16, y: 4, nd: 0, dbnd: 0 }, { n: 14, y: 6, nd: 0, dbnd: 0 }]; P.spans = { lengths: [120, 120], continuity: 'composite' }; P.xs.skews = [0, 0, 0];
+    P.base.rows = [{ n: 12, y: 2, nd: 0, dbnd: 0 }, { n: 12, y: 4, nd: 0, dbnd: 0 }, { n: 8, y: 6, nd: 0, dbnd: 0 }, { n: 2, y: 8, nd: 0, dbnd: 0 }]; P.spans = { lengths: [120, 120], continuity: 'composite' }; P.xs.skews = [0, 0, 0];
     P.base.cont.AsPos = 4; P.base.cont.restraint = true; P.base.mat.td = 10; return P; })(),
   // PR 2d-1: the owner hold-down and debonded-share checks (CTDOT), debonded rows on an I-girder, diaphragms (camber), the girder end past ℄ bearing
   'CTDOT, debonded rows, diaphragms, girder end 9 in past the bearing': (() => { const P = base(); P.base.owner = 'CTDOT';
@@ -32,8 +34,9 @@ export const TAB_CASES = base => ({
     P.base.deck.on = true; P.base.deck.xnegAuto = false; P.base.deck.xneg = 9; P.base.tsSeparate = true; P.base.tsDL = 8.5;
     P.base.handling.on = true; P.base.handling.aLift = 8; P.base.handling.aHaul = 10; P.base.handling.theta_i = 0.06; P.base.rateVeh = [{ name: 'Type 3', M: 1500, V: 70, W: 25 }]; return P; })(),
   // PR 2d-2: deck on a box beam with a topping (closed box: the design section at the face of the support), girder spacing below Table A4-1
+  // PS-28 (2026-11-14): the strand rows fit the 5 in bottom wall (8 strands at y = 4 in were 1 in from the void, now an input error): 16 at y = 2 in
   'box BIII-36 with a 6 in topping, deck on (S below 4 ft), handling on': (() => { const P = base(); P.base.girder = 'AASHTO BIII-36 (27in)'; P.base.ts = 6; P.base.harp.n = 0;
-    P.base.rows = [{ n: 14, y: 2, nd: 0, dbnd: 0 }, { n: 8, y: 4, nd: 0, dbnd: 0 }]; P.xs.bays = [3, 3, 3, 3]; P.spans.lengths = [60]; P.base.deck.on = true; P.base.handling.on = true; return P; })(),
+    P.base.rows = [{ n: 16, y: 2, nd: 0, dbnd: 0 }]; P.xs.bays = [3, 3, 3, 3]; P.spans.lengths = [60]; P.base.deck.on = true; P.base.handling.on = true; return P; })(),
   // PR 2d-3 (PS-10): the hold-down check for RIDOT with an edited limit (0.90 W) and the girder end past the bearing; AASHTO with the box off
   'RIDOT, draped strands, hold-down limit 0.90 W, girder end 6 in past the bearing': (() => { const P = base(); P.base.owner = 'RIDOT'; P.base.opt.hdFrac = 0.9; P.base.opt.endOh = 6; P.base.harp.n = 8; P.base.harp.yEnd = 50; return P; })(),
   'AASHTO, PS-10 hold-down box off': (() => { const P = base(); P.base.opt.hdCheck = false; return P; })(),
```

## 2026-11-14 — Flexure tab, pier section of a NEXT: the negative-moment compression block drawn in the two stems (display only; no calculation change)
PR #1536: https://github.com/mlococo88/All-Structural/pull/1536
### Request
- Open item of PS-27 (orchestrated fix list 2026-11-14): on the Flexure tab's pier section (negative moment at the pier of a span made continuous) of a NEXT, the compression block was drawn 2B wide centred on the girder ℄, i.e. in the empty gap between the two stems. Draw it in the two stems (the bottom of each stem), consistent with the width the engine uses; display only; report, do not change, the engine's compression width if it looks wrong.
### Problem
- `ui/flexure.js` `pierFig` drew one rectangle from x = −b_bf/2 to +b_bf/2 for every shape. For a NEXT, `girderGrossBase` sets b_bf = 2B (the two stems' bottom width), so the block was a 2B-wide rectangle on the ℄ (NEXT 36F: −13 to +13 in), where there is no concrete (the stems' inner faces are at ±23.5 in).
- The engine (pbd-compute.js, the pier section): a = A_s f_y / (0.85 f′c b_bf), with b_bf = 2B for a NEXT. That is the two stems' bottom width, so the compression zone is the bottom of each stem, B wide. The drawing now shows that.
### What changed
- `ui/flexure.js`:
  - New `blocks(G)`: the x ranges of the block. For a NEXT, one per stem: x = ±stemCC/2 ± B/2. For every other shape, as before: [−b_bf/2, b_bf/2].
  - `pierFig` draws a rectangle (and a point-at region) for each range, height min(a, h) as before.
  - The callout says "in each stem (b = 2 × B in)" for a NEXT, and the region text gives "b_bf = 2 stems × B".
  - The caption adds "(NEXT: at the bottom of each of the two stems, b_bf = 2B, the width the engine uses)".
  - `pierFig` and `blocks` are exported for the test.
- I-girders, bulb tees, boxes and deck beams: drawn exactly as before.
### Saved data (CLAUDE.md §5)
- None.
### Governing provisions
- None changed. Display only: AASHTO LRFD 10th Ed. 5.12.3.3 / 5.6.3 values (a, c, φM_n) unchanged.
### Check case (NEXT 36F, S = 9 ft (default bays), two 80 ft spans made continuous, deck bars A_s = 16 in², f_y = 60 ksi, girder f′c = 8.5 ksi)
- Stems: ℄ at ±30 in, B = 13 in, so b_bf = 2 × 13 = 26 in. a = 16 × 60 / (0.85 × 8.5 × 26) = 960 / 187.85 = 5.110 in (the engine: 5.110).
- Before: one block from x = −13 to +13 in, 5.11 in high (between the stems).
- After: two blocks, x = −36.5 to −23.5 in and +23.5 to +36.5 in, each 5.11 in high; total width 26 in = the engine's b_bf.
### How verified
- New `tests/engine/psbridge-pierfig.test.mjs` (6 tests). The block rectangles of `pierFig` (class dt-ng, recorded from the drawing kit) are checked for:
  - NEXT 36F and NEXT 24F: two blocks, one at each stem, none between the stems;
  - PCI BT-72, AASHTO Type IV, AASHTO BIII-36: one block, b_bf wide on the ℄;
  - every shape: total width = the engine's b_bf, height = the engine's a;
  - the engine's a, c, φM_n and Mu/φM_n the same before and after drawing;
  - the NEXT 36F hand check above.

  Mutation check: with the NEXT branch of `blocks` disabled, the 3 NEXT tests fail.
- Results: Batched with the void note in one PR (engineer speed policy 2026-11-14: display only, reduced verification). `node tests/check-syntax.mjs`: all scripts pass. `node tests/engine/run.mjs psbridge tex project-registry`: 21 files, 195 passed, 0 failed. `ps-bridge-skeleton.mjs`: 257 checks, 0 failed. Harness B normal (17 designs): 0 with differences, exit 0 (no value changes). `--import` and the controls not run (display-only policy).
### Open items (not changed; engine, for the engineer)
- NEXT pier section, the a ≤ t_bf check (`cont.aOK`, pbd-compute.js `tbf = g.isNext ? g.next.ft : g.d[2]`). For a NEXT, t_bf is the flange thickness (8 in), and that flange is the deck flange at the top. In negative moment the compression is at the bottom of the stems, where there is no bottom flange. The rectangular block of width 2B stays valid while a ≤ the stem depth h − ft (NEXT 36F: 28 in), with B the stems' bottom width (the stems widen upward, so 2B is conservative). The check compares a with the wrong element. The compression width itself (2B) looks right.
- Box beams, the same check (seen while checking the other shapes): `g.d` is [0, 0, 0, 0] for boxes and deck beams, so t_bf = 0. `aOK` is always false, and every continuous box design carries the warning "Negative-moment compression block a = … exceeds the bottom-flange thickness (0.0″)". For AASHTO BIII-36, two 80 ft spans made continuous, A_s = 16 in²: a = 3.69 in against the 5 in bottom wall. The engine's b_bf for a box is the full width w (36 in); the bottom wall is 36 in wide, so that width is consistent. Should t_bf be the box wall (`box.wall`) and, for a NEXT, the stem depth?
### Other copies
- None. The Report draws the tab's own figure (ui/report.js figure slots), so it shows the same blocks.
### Before / after (exact)
```diff
diff --git a/apps/ps-bridge/ui/flexure.js b/apps/ps-bridge/ui/flexure.js
index 496c609..2f7ab16 100644
--- a/apps/ps-bridge/ui/flexure.js
+++ b/apps/ps-bridge/ui/flexure.js
@@ -56,7 +56,11 @@
     h += k.card('Worked steps: flexure', `<p class="note">AASHTO LRFD 10th Ed. (2024). Every result is the engine's value. f<sub>pe</sub>: <a href="#st-ls.fpe" data-gotab="loss">Losses tab</a>; h<sub>c</sub>, b<sub>eff</sub>: <a href="#st-sec.hc" data-gotab="sec">Section properties tab</a>; moments: <a href="#st-an.MuS" data-gotab="an">Analysis tab</a>.</p>${k.steps(ctx.W.flexure.steps, TOPICS, OPEN)}`);
     return h;
   }
-  /* the pier section: girder, deck with the bars in tension, the compression block in the bottom flange */
+  /* the pier section: girder, deck with the bars in tension, the compression block in the bottom flange.
+     NEXT (2026-11-14, display only): the block is drawn at the bottom of each of the two stems, B wide each (x = ±stemCC/2 ± B/2), the
+     width the engine uses for the compression zone (pbd-compute.js: a = A_s f_y / (0.85 f′c b_bf), b_bf = 2B for NEXT, girderGrossBase);
+     before, one block 2B wide centred on the girder ℄, i.e. in the gap between the stems. blocks(G): [[x0, x1]] of the block(s). */
+  const blocks = G => (G.isNext && G.next ? [-1, 1].map(s => [s * G.next.stemCC / 2 - G.next.B / 2, s * G.next.stemCC / 2 + G.next.B / 2]) : [[-G.bbf / 2, G.bbf / 2]]);
   function pierFig(R, inp, W) {
     const V = VK(), S = V.scene(), G = R.g, cp = R.cp, c = R.cont, ts = +inp.ts, th = (G.isBox || G.isDeck) ? 0 : +inp.th, bE = Math.min(cp.beff, Math.max(G.btf, G.bbf) * 2.2);
     const half = halfPolygon(G), poly = half.concat(half.slice().reverse().map(p => [-p[0], p[1]]));
@@ -65,11 +69,12 @@
     if (ts > 0) S.rect(-bE / 2, G.h + th, bE / 2, G.h + th + ts, 'dt-cc');
     const yb = c.dN, nb = 9; for (let i = 0; i < nb; i++) S.circ(-bE / 2 + 2 + i * (bE - 4) / (nb - 1), yb, 0.45, 'dt-bar');
     S.callout(bE / 2 - 2, yb, 26, -16, [`deck bars A_s = ${V.fx(c.As, 2)} in², f_y = ${V.fx(c.fyr, 0)} ksi`], { sz: 10.5 });
-    S.rect(-G.bbf / 2, 0, G.bbf / 2, Math.min(c.aN, G.h), 'dt-ng', { op: 0.9 });
-    S.callout(G.bbf / 2, c.aN / 2, 26, 10, [`compression block a = ${V.fx(c.aN, 2)} in (t_bf = ${V.fx(c.tbf, 1)} in)`], { sz: 10.5, gov: !c.aOK });
+    const bk = blocks(G), xr = bk[bk.length - 1][1];
+    bk.forEach(([x0, x1]) => S.rect(x0, 0, x1, Math.min(c.aN, G.h), 'dt-ng', { op: 0.9 }));
+    S.callout(xr, c.aN / 2, 26, 10, [`compression block a = ${V.fx(c.aN, 2)} in${G.isNext ? ` in each stem (b = 2 × ${V.fx(G.next.B, 2)} in)` : ''} (t_bf = ${V.fx(c.tbf, 1)} in)`], { sz: 10.5, gov: !c.aOK });
     S.dimV(0, yb, -Math.max(G.bbf, G.btf) / 2, -16, `d = ${V.fx(c.dN, 2)} in`, { sz: 10.5 });
     if (cp.beff > bE + 0.01) S.text(0, G.h + th + ts, `deck drawn ${V.fx(bE, 0)} in wide (b_eff = ${V.fx(cp.beff, 1)} in)`, { a: 'middle', dy: -8, sz: 10, cls: 'dt-m' });
-    S.region(-G.bbf / 2, 0, G.bbf / 2, Math.max(c.aN, 1), `a = A_s f_y / (0.85 f'c b_bf) = ${V.fx(c.aN, 3)} in, c = ${V.fx(c.cN, 3)} in`);
+    bk.forEach(([x0, x1]) => S.region(x0, 0, x1, Math.max(c.aN, 1), `a = A_s f_y / (0.85 f'c b_bf) = ${V.fx(c.aN, 3)} in, c = ${V.fx(c.cN, 3)} in${G.isNext ? `; b_bf = 2 stems × B = 2 × ${V.fx(G.next.B, 2)} = ${V.fx(G.bbf, 2)} in` : ''}`));
     return { html: S.render({ W: Math.min(W, 640), maxH: 330, label: 'Pier section, negative moment' }).svg, nar: W < 560 };
   }
   const HIDE = { cmp: { sw: true, dc1: true, dc2: true, dw: true, llp: true, lln: true } };
@@ -98,7 +103,7 @@
     }
     const sp = el.querySelector('#gfx_fxpier');
     if (sp && c && VK() && VK().detCard) VK().detCard(sp, { id: 'fxPierFig', title: 'Pier section (negative moment)', sub: `${k.esc(ctx.inp.girder)} with the deck; girder f′c ${k.fx(+ctx.inp.mat.fc, 2)} ksi`, draw: W => pierFig(R, ctx.inp, W), hint: 'Point at the compression block for its values.',
-      cap: '<p class="vk-cap">Deck bars (A<sub>s</sub> within b<sub>eff</sub>) in tension, the rectangular compression block in the girder bottom flange; bar positions drawn for display. Display only.</p>' });
+      cap: `<p class="vk-cap">Deck bars (A<sub>s</sub> within b<sub>eff</sub>) in tension, the rectangular compression block in the girder bottom flange${R.g.isNext ? ' (NEXT: at the bottom of each of the two stems, b<sub>bf</sub> = 2B, the width the engine uses)' : ''}; bar positions drawn for display. Display only.</p>` });
   }
-  window.PSBUiFlexure = { output, after, TOPICS };
+  window.PSBUiFlexure = { output, after, TOPICS, pierFig, blocks };   // pierFig, blocks: also for tests/engine/psbridge-pierfig.test.mjs
 })();
```

## 2026-11-14 — Box beam and voided deck slab voids: drawn where the engine places them, and the Section properties tab and the Report's assumptions say so (display only; decision pending engineer review)
PR #1536: https://github.com/mlococo88/All-Structural/pull/1536
### Request
- Open item of PS-27 (fix list 2026-11-14): the new app draws the box void where the engine's `sectionVoids` places it (on the bottom wall), while the old app's section graphic centred it on the depth. Keep the graphics consistent with the engine, confirm it, and note it in the Section tab / Report assumptions. If the engine's position disagrees with the girder library's published void position, report it; do not change calculations.
### Findings (confirmed)
- The engine (`sectionVoids`, pbd-section.js, verbatim from the old app at 8fe8650 :2648-2649) puts the box cell on the bottom wall: y = wall … wall + voidH (wall = 5 in for every library box). The top wall is h − wall − voidH = 2 in for all four boxes (BI-36: void 5–10 in in a 12 in depth).
- The old app's section graphic (`Prestressed Bridge Design.html` :4998, `bot=(g.h-vh)/2;  // void centered vertically`) drew it centred: walls (h − voidH)/2 = 3.5 in top and bottom.
- Every graphic of the new app draws `sectionVoids` (ui/section.js, ui/strands.js, ui/stresses.js, ui/flexure.js, ui/view3d.js), and so does the PS-28 strand fit. Voided deck slabs: round voids on mid-depth in both apps.
- What the void position is used for in the engine: only `tensionSideArea` (A_ct, the concrete below h/2 for the shear ε_s recompute when ε_s < 0, 5.7.3.4.2, pbd-compute.js `const Act=tensionSideArea(g)`). The gross A, I and y_b are the library's published values (`girderGrossBase`), not computed from the outline. `weakAxisAndJ` (handling) uses the void width and height but not its vertical position.
- **The library's published values disagree with its own outline and void (reported, not changed):**

  | Box | Published A (in²) | Published I (in⁴) | Published y_b (in) | Outline − void A (in²) | I, void on the bottom wall (in⁴) | y_b, void on the bottom wall (in) | I, void centred (in⁴) | y_b, void centred (in) |
  |---|---|---|---|---|---|---|---|---|
  | BI-36 (12 in) | 560 | 12 897 | 6.00 | 302 | 4 495 | 5.35 | 4 913 | 6.00 |
  | BII-36 (18 in) | 693 | 36 434 | 9.00 | 362 | 13 460 | 7.81 | 14 612 | 9.00 |
  | BIII-36 (27 in) | 812 | 97 756 | 13.14 | 452 | 39 200 | 11.77 | 41 716 | 13.50 |
  | BIV-48 (33 in) | 1 097 | 200 631 | 16.11 | 596 | 82 183 | 14.01 | 88 091 | 16.50 |

  - The published A is larger than the outline's (BI-36: 560 in² against a solid 36 × 12 = 432 in²).
  - The published I is 2.3 to 2.9 times the outline's.
  - The published y_b of BI-36 and BII-36 is h/2, i.e. a symmetric section (a centred void, or none). BIII-36 and BIV-48 are between the two positions.

  The library has no void position of its own (only voidW, voidH, wall). Its gross properties match neither placement of the drawn void. They look like the properties of other sections, e.g. the standard AASHTO BI-36 of 27 in depth has A = 560.5 in². This needs the engineer: which box sections are meant, with which properties and void.
- Effect of the void position on A_ct (BI-36, below h/2 = 6 in): engine (void 5–10 in) 36 × 6 − 26 × 1 = 190 in²; centred (3.5–8.5 in) 36 × 6 − 26 × 2.5 = 151 in². Not changed.
### What changed
- `ui/section.js`: new `voidNote(G)` (exported), shown under the gross-section card (`#sec-void-note`) for a box beam or a voided deck slab. It gives:
  - where the void is (box: the cell size, y = wall to wall + voidH above the soffit, the bottom and top walls; voided slab: the count, the diameter, mid-depth);
  - that it is where the engine places it (sectionVoids) and as drawn, and that the old app's graphic centred the box void;
  - that A, I, y_b are the library's published values, not computed from the outline;
  - what the void position is used for (A_ct in 5.7.3.4.2, the PS-28 strand fit, the graphics).

  The Report's §3 Section properties shows the tab's card, so the note is there too.
- `report/builders.js`: new `voidNotes(B)` in §2 Assumptions: the same note for each shape with voids (the design girder and every girder type on a line), with "(see §3 …)" (`[[rs.sec]]`).
### Saved data (CLAUDE.md §5)
- None.
### Governing provisions
- None changed. Display only: no computed value changes; the engine's void position (sectionVoids) is kept.
### Check case (AASHTO BI-36 (12in): h = 12, w = 36, wall = 5, voidW = 26, voidH = 5 in)
- Note: "Void: one 26.0 × 5.0 in cell on the bottom wall, y = 5.0 to 10.0 in above the soffit (bottom wall 5.0 in, top wall h − wall − void = 2.0 in) …".
- The Section properties graphic draws the void rectangle from (−13, 5) to (13, 10) in. The old app: (−13, 3.5) to (13, 8.5).
- Before / after: no value changes (A = 560 in², I = 12 897 in⁴, y_b = 6.00 in, as published).
### How verified
- New `tests/engine/psbridge-voidnote.test.mjs` (4 tests):
  1. the note's numbers = the library's and `sectionVoids`' for every box and voided slab; no note for any other shape;
  2. the Section properties graphic draws the BI-36 void at (−13, 5)–(13, 10);
  3. the tab card and the Report §2 carry the note (with its link, resolved) for BIII-36 and the 21 in voided slab, and not for the BT-72; R is unchanged;
  4. a bridge with a BT-72 span and a BIII-36 span (girder types; Report on each type's governing line): the box note once, no BT-72 note, every link resolved.
- Results: Batched with the void note in one PR (engineer speed policy 2026-11-14: display only, reduced verification). `node tests/check-syntax.mjs`: all scripts pass. `node tests/engine/run.mjs psbridge tex project-registry`: 21 files, 195 passed, 0 failed. `ps-bridge-skeleton.mjs`: 257 checks, 0 failed. Harness B normal (17 designs): 0 with differences, exit 0 (no value changes). `--import` and the controls not run (display-only policy).
### Decisions (pending engineer review)
- PSV-D1. The graphics keep the engine's void position (on the bottom wall), not the old app's centred drawing: the drawing shows the void that A_ct and the PS-28 strand fit use.
### Open items (not changed; for the engineer)
- The box library's A, I, y_b disagree with its outline and void (table above). Which sections are meant, with which properties and void position? A change would be a calculation change (CLAUDE.md §4) in the verbatim library slice.
### Other copies
- None.
### Before / after (exact)
```diff
diff --git a/apps/ps-bridge/report/builders.js b/apps/ps-bridge/report/builders.js
index ef8084a..329443d 100644
--- a/apps/ps-bridge/report/builders.js
+++ b/apps/ps-bridge/report/builders.js
@@ -126,7 +126,7 @@
         ['Owner', ownR ? `${own} (${ownR.manual})` : own]]), note('Entered values (Project, Bridge layout, Cross-section and Girders & strands tabs); the engine inputs of the design girder are those of the [[tab:in:gird|Girders & strands tab]].')]),
       sub('c', 'Basis', [kv([['Design specification', ED], ['Load rating', 'AASHTO Manual for Bridge Evaluation (MBE), LRFR; article numbers as the old app'], ['Owner manual', ownR && !ownR.none ? `${ownR.manual} (AASHTO LRFD ${ownR.aashto} basis); its rules as listed below` : 'none (AASHTO only)'],
         ['Units', 'in, kip, ksi, ft, klf, kip-ft'], ['Sign convention', 'stresses + compression, − tension; moments + sagging']])]),
-      sub('a', 'Assumptions', [...(asm ? asm.items : []), ...ASSUME.map(t => note('• ' + t)), ...deNote(P)])];
+      sub('a', 'Assumptions', [...(asm ? asm.items : []), ...ASSUME.map(t => note('• ' + t)), ...deNote(P), ...voidNotes(B)])];
     ownSubs.forEach((s, j) => subs.push({ ...sub('o' + j, `Owner rules: ${s.title}`, s.items), ...(j === 0 ? { key: X.ownKey } : {}) }));
     return { title: 'Project, basis and assumptions', subs };
   }
@@ -158,6 +158,19 @@
      same rows as the Loads & LLDF tab's notice, listed in the assumptions always (also after the notice is dismissed); none where they match */
   function deNote(P) { const DS = window.PSBDesign, D = DS && DS.deDiff ? DS.deDiff(P) : { rows: [] }; return D.rows.length ? [note(`• ${DS.deText(D, t => `$_{${t}}$`)} (see [[rs.lds]])`)] : []; }
 
+  /* voidNotes(B): 2026-11-14 (decision pending engineer review): for each shape of the report with voids (a box beam, a voided deck slab: the
+     design girder and every girder type on a line), where the void is (the Section properties tab's note, ui/section.js voidNote: the
+     engine's sectionVoids position, as drawn); none for shapes without voids */
+  function voidNotes(B) {
+    const SU = window.PSBUiSection, BR = window.PSBBridge, DS = window.PSBDesign; if (!SU || !SU.voidNote) return [];
+    const gs = [[B.inp.girder, B.R.g]];
+    if (BR && BR.hasTypes(B.P) && DS) BR.types(B.P).forEach((T, k) => { const l = BR.typeLines(B.P, k); if (!l.length) return;
+      try { const i = DS.cellInputs(B.P, k, l[0]); gs.push([i.girder, girderGross(i)]); } catch (e) { /* its own input errors */ } });
+    const seen = new Set();
+    return gs.filter(([n]) => !seen.has(n) && seen.add(n)).map(([n, g]) => [n, SU.voidNote(g)]).filter(([, t]) => t)
+      .map(([n, t]) => note(`• ${plain(n)}: ${t.replace(/<sub>(.*?)<\/sub>/g, '$_{$1}$').replace(/&lt;/g, '<')} (see [[rs.sec]])`));
+  }
+
   /* ---------- 3–14. the result tabs ---------- */
   function tabSec(B, k, X) {
     const [ui, wk] = TABS[k], U = window[ui], FT = window.PSBReportTab;
diff --git a/apps/ps-bridge/ui/section.js b/apps/ps-bridge/ui/section.js
index bc9935b..f6b657e 100644
--- a/apps/ps-bridge/ui/section.js
+++ b/apps/ps-bridge/ui/section.js
@@ -12,6 +12,15 @@
     { key: 'ec', title: 'Moduli of elasticity and modular ratio', ref: 'AASHTO LRFD 10th Ed. 5.4.2.4', ids: /^sec\.(Ecg|Ecd|n)$/, res: /^sec\.n$/ },
     { key: 'comp', title: 'Composite section (transformed deck)', ref: 'AASHTO LRFD 10th Ed. 4.6.2.6', ids: /^sec\.(beff|Ad|yd|Ah|Ac|ybc|Ic|hc|Sbc|Stg|Std)$/, res: /^sec\.Ic$/ },
     { key: 'str', title: 'Prestressing strands', ref: 'AASHTO LRFD 10th Ed. 5.9.4.3.1', ids: /^sec\./, res: /^sec\.eMid$/ }];
+  /* voidNote(G): 2026-11-14 (decision pending engineer review, PS28/void note): where the void of a box beam or a voided deck slab is, as the
+     engine places it (sectionVoids, pbd-section.js) and every graphic draws it; '' for a shape without voids. The old app's section graphic
+     centred the box void on the depth; the engine (and so every value that uses the void position) puts it on the bottom wall. */
+  function voidNote(G) {
+    const b = G && G.box, f = v => K().fx(v, 1); if (!b) return '';
+    if (G.isBox && b.voidW > 0 && b.voidH > 0) return `Void: one ${f(b.voidW)} × ${f(b.voidH)} in cell on the bottom wall, y = ${f(b.wall)} to ${f(b.wall + b.voidH)} in above the soffit (bottom wall ${f(b.wall)} in, top wall h − wall − void = ${f(G.h - b.wall - b.voidH)} in), where the engine places it (sectionVoids) and as drawn here; the old app's section graphic centred it on the depth. A, I and y<sub>b</sub> above are the library's published values, not computed from the outline: the void position is used for the concrete area on the tension side A<sub>ct</sub> (shear, 5.7.3.4.2, when ε<sub>s</sub> &lt; 0), the strand fit of the input check (PS-28) and the graphics.`;
+    if (G.isDeck && b.voids > 0 && b.voidD > 0) return `Voids: ${b.voids} round voids of ${f(b.voidD)} in diameter on mid-depth (y = ${f(G.h / 2)} in), evenly spaced across the width, where the engine places them (sectionVoids) and as drawn here. A, I and y<sub>b</sub> above are the library's published values, not computed from the outline: the void positions are used for A<sub>ct</sub> (shear, 5.7.3.4.2, when ε<sub>s</sub> &lt; 0), the strand fit of the input check (PS-28) and the graphics.`;
+    return '';
+  }
   function output(ctx) {
     const { R, inp } = ctx, k = K(), ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, G = R.g, ss = R.ss;
     const kind = G.isNext ? 'NEXT F double tee' : G.isBox ? 'adjacent box beam' : G.isDeck ? 'adjacent deck beam' : 'I-girder / bulb tee';
@@ -20,7 +29,8 @@
       ['Shape', `${k.esc(inp.girder)} (${kind})${G.ovr && G.ovr.any ? ', with overrides' : ''}`], ['Depth h', ev('g.h', 2, 'in')], ['Area A', ev('g.A', 1, 'in²')], ['Moment of inertia I', ev('g.I', 0, 'in⁴')],
       ['y<sub>b</sub> (centroid above the soffit)', ev('g.yb', 3, 'in')], ['y<sub>t</sub>', `${ev('g.yt', 3, 'in')} ${wk('sec.g.yt')}`], ['S<sub>b</sub>', `${ev('g.Sb', 0, 'in³')} ${wk('sec.g.Sb')}`], ['S<sub>t</sub>', `${ev('g.St', 0, 'in³')} ${wk('sec.g.St')}`],
       ['Web width b<sub>w</sub>', ev('g.bw', 2, 'in')], ['Top / bottom flange width', `${ev('g.btf', 2)} / ${ev('g.bbf', 2, 'in')}`], ['Self-weight w<sub>g</sub>', `${ev('g.wsw', 4, 'klf')} ${wk('sec.g.wsw')}`]])
-      + `<p class="note">Gross properties of the shape library (the old app's GIRDERS${G.isNext ? '; NEXT: interpolated on the flange width' : ''})${G.ovr && G.ovr.any ? '; overridden values as entered (Girders &amp; strands tab)' : ''}.</p>`, 'card-gross');
+      + `<p class="note">Gross properties of the shape library (the old app's GIRDERS${G.isNext ? '; NEXT: interpolated on the flange width' : ''})${G.ovr && G.ovr.any ? '; overridden values as entered (Girders &amp; strands tab)' : ''}.</p>`
+      + (voidNote(G) ? `<p class="note" id="sec-void-note">${voidNote(G)}</p>` : ''), 'card-gross');
     h += k.card('Composite section', k.kv([
       ['E<sub>c</sub> girder', `${ev('cp.Ecg', 0, 'ksi')} ${wk('sec.Ecg')}`], ['E<sub>c</sub> deck', `${ev('cp.Ecd', 0, 'ksi')} ${wk('sec.Ecd')}`], ['Modular ratio n', `${ev('cp.n', 4)} ${wk('sec.n')}`],
       ['Effective flange width b<sub>eff</sub>', `${ev('cp.beff', 2, 'in')} ${wk('sec.beff')}`], ['A<sub>c</sub>', `${ev('cp.Ac', 1, 'in²')} ${wk('sec.Ac')}`], ['y<sub>bc</sub>', `${ev('cp.ybc', 3, 'in')} ${wk('sec.ybc')}`],
@@ -72,5 +82,5 @@
       draw: W => figure(ctx, W), hint: 'Point at the deck or a strand row for its values.',
       cap: '<p class="vk-cap">Shape as the engine uses it (outline and voids of the shape library); straight strands drawn on a 2 in grid, draped strands at midspan. Display only.</p>' });
   }
-  window.PSBUiSection = { output, after, TOPICS, figure };   // figure: also for tests/engine/psbridge-strandgfx.test.mjs (PS-27)
+  window.PSBUiSection = { output, after, TOPICS, figure, voidNote };   // figure: also for tests/engine/psbridge-strandgfx.test.mjs (PS-27); voidNote: the Report §2 assumptions
 })();
```

## 2026-11-14 — PS-29: "f_pe with the permanent gains" — Δf_pSS not counted twice; the Losses tab and its worked step state where Δf_pSS is (display only; no check result changes)
PR #1538: https://github.com/mlococo88/All-Structural/pull/1538
### Request
- Engineer decision PS-29 (2026-11-14): "f_pe with permanent gains" must not count the deck shrinkage gain Δf_pSS twice, in either loss method. Refined: show f_pe + the elastic gains only (DC1 on the girder + DC2/DW on the composite section) and state "Δf_pSS = x ksi is already in the long-term loss (5.9.3.4.3)". Approximate: do not credit Δf_pSS, and say so. The value the checks use is unchanged.
### Problem (old app, frozen)
- `Prestressed Bridge Design.html` (frozen; not changed), Losses tab, Elastic Gains card (:6660, :6663): "f_pe with permanent gains credited = f_pe + (gains.permanent + gains.deckShr)", and the "Permanent gains" total row adds gains.deckShr too; the strand-stage note (:6691) says "add ≈ gains.permanent + gains.deckShr". In the refined method the long-term loss already subtracts Δf_pSS (`finishRefined`, pbd-losses-ll.js: `total = dfSR + dfCR + dfR1 + dfSD + dfCD + dfR2 − dfSS`, AASHTO LRFD 10th Ed. Eq. 5.9.3.4.1-1 / 5.9.3.4.3d), so f_pe already contains it: counted twice. In the approximate method (5.9.3.3) there is no Δf_pSS term, so adding it credits a gain the method does not have.
- Old report worked step 'gPerm' (:8468, `terms.gainPerm` of :4563 = pbd-compute.js:1144): f_pe + (gains.permanent + inp.opt.dfpSS). It adds the *entered* Δf_pSS field (0 by default) even when Δf_pSS is computed: double count when entered (refined), credit without a loss term (approximate), and nothing when computed.
- New app before this PR: the Losses tab note and its worked step `ls.gain.fpe` already showed the engine's `fpeGain` = f_pe + Δf_p,DC1 + Δf_p,SD (since PR 2c-1; the open item of that entry asked the engineer to confirm the old double count). `terms.gainPerm` is not used by the new app. What was missing: the statement of where Δf_pSS is. The old note said "The deck shrinkage gain Δf_pSS is part of the refined Δf_pLT" only when refined and |Δf_pSS| > 0.005, without its value, and nothing in the approximate method.
### What changed
- `apps/ps-bridge/ui/losses.js` `output`, Elastic gains card (`card-gain`), anchor `The checks use f<sub>pe</sub> without gains (conservative); the gains show the margin.`: the conditional sentence replaced by `<span id="gain-ss-note">`, always shown:
  - refined: "Δf_pSS = x ksi is already in the long-term loss Δf_pLT (refined method, 5.9.3.4.3: it reduces the loss) [worked step ls.ss.dfSS], so it is not added again here." (x = `gains.deckShr`, a data-ev value);
  - approximate: "Δf_pSS (x ksi) is not credited: the approximate method (5.9.3.3) has no deck shrinkage term, and it is not added as a gain here."
- `apps/ps-bridge/engine/worked-stress.js` `losses`, step `gain.fpe` ("Effective prestress with the permanent elastic gains credited"): its note gets the same statement (plain text, value to 2 decimals). Equation, substitution and value unchanged (f_pe + Δf_p,perm, Δf_p,perm = Δf_p,DC1 + Δf_p,SD).
- `tests/psbridge-compare.mjs` (harness B): the PS-29 comparison (see How verified).
- Not changed: the engine (pbd-*.js verbatim, `fpeGain = fpe + gains.permanent`, `terms.gainPerm`), every check, the gains table rows (the deck shrinkage row already says "in Δf_pLT (refined)" / "not in Δf_pLT (approximate)", and the total row is DC1 + DC2 + DW), the loss graphics (they plot `fpeGain`).
### Governing provisions (§4 callout)
- AASHTO LRFD 10th Ed. (2024) Eq. 5.9.3.4.1-1 and Art. 5.9.3.4.3d (Δf_pSS is a term of the refined Δf_pLT); Art. 5.9.3.3 (approximate method: no Δf_pSS); C5.9.3.4.3 (elastic gains).
- Displayed "f_pe with the permanent gains", before (old app display) → after (both apps' engine value, now the only one shown):
  - refined: f_pe + Δf_p,DC1 + Δf_p,SD + Δf_pSS → f_pe + Δf_p,DC1 + Δf_p,SD (Δf_pSS stated as already in Δf_pLT);
  - approximate: f_pe + Δf_p,DC1 + Δf_p,SD + Δf_pSS → f_pe + Δf_p,DC1 + Δf_p,SD (Δf_pSS stated as not credited).
- No formula, factor, unit or check changes: the checks use f_pe without gains (and `fpeGain` where used is unchanged).
### Check cases (hand)
- Default design (PCI BT-72, L = 120 ft, refined, Δf_pSS computed): f_pe = 202.50 − 23.01 − 24.810 = 154.68 ksi, where Δf_pLT = 5.300 + 16.605 + 1.129 + 1.956 − 0.052 + 1.129 − **1.257** (Δf_pSS) = 24.810 ksi. Gains: Δf_p,DC1 = 7.556, Δf_p,SD = 2.974, Δf_p,perm = 10.530 ksi.
  - Old app display: 154.68 + (10.530 + 1.257) = **166.47 ksi** (Δf_pSS a second time).
  - New: 154.68 + 10.530 = **165.21 ksi**; note "Δf_pSS = 1.26 ksi is already in the long-term loss Δf_pLT (refined method, 5.9.3.4.3 …)". Difference 1.26 ksi = Δf_pSS.
- Harness B design "approximate losses, transformed release, …" (approximate, Δf_pSS entered 1.50 ksi): f_pe = 154.71, Δf_p,perm = 7.556 + 2.974 = 10.530 ksi.
  - Old display (hint and the old report step gPerm): 154.71 + 10.530 + 1.500 = **166.74 ksi**.
  - New: 154.71 + 10.530 = **165.24 ksi**; note "Δf_pSS (1.50 ksi) is not credited: the approximate method (5.9.3.3) has no deck shrinkage term …".
### Saved data (CLAUDE.md §5)
- None changed.
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry`: 21 files, 195 passed, 0 failed (the step `gain.fpe` still = `fpeGain` exactly; its TeX parses).
- `node tests/check-syntax.mjs`: all scripts pass. `node tests/smoke/ps-bridge-skeleton.mjs`: 257 checks, 0 failed (every data-ev on the Losses tab = computeAll on the page, including the new Δf_pSS value).
- Harness B (`tests/psbridge-compare.mjs`, 17 designs). New PS-29 part: on each design the Losses tab's shown "f_pe with the permanent gains" must equal f_pe + Δf_p,DC1 + Δf_p,SD worked by the harness from the old app's own components (old `R.fpe`, `R.gains.precast`, `R.gains.composite`, formatted as shown), and the `#gain-ss-note` must state the method's sentence and Δf_pSS (old `R.gains.deckShr`) as shown; the harness lists, as the intended documented difference, every design where the old display (f_pe + Δf_p,perm + Δf_pSS) differs. `--control` also shifts the expected value by 0.01 ksi.
  - Normal: 17 designs, 43,555 shown values + 7,650 step values, 0 with differences, exit 0; PS-29: 17 designs equal to the hand value, 16 intended differences from the old display (the one without one: the box BIII-36 without topping, Δf_pSS = 0).
  - `--import`: 17 designs (autosave 5, shared 4, older 4, file 4), 0 with differences, exit 0.
  - `--control`: 17 with differences (each design also reports the PS-29 shift), exit 1; `--import --control`: 17 with differences, exit 1.
### Other copies
- None (the Report renders the tab's worked steps, so `gain.fpe`'s note appears there too). The old app is frozen and keeps its display.
### Open items
- None for PS-29. Old-app code `terms.gainPerm` (pbd-compute.js:1144) remains in the verbatim engine, unused by the new app.
### Before / after (exact)
```diff
diff --git a/apps/ps-bridge/engine/worked-stress.js b/apps/ps-bridge/engine/worked-stress.js
index 601ed33..46fd766 100644
--- a/apps/ps-bridge/engine/worked-stress.js
+++ b/apps/ps-bridge/engine/worked-stress.js
@@ -113,7 +113,10 @@
     const MllG = epc !== 0 ? gn.live * Ecf * cp.Ic / (Ep * epc) : NaN;
     add({ id: 'gain.ll', label: 'Elastic gain from LL+IM on the composite section (transient)', sym: '\\Delta f_{p,LL}', eq: '\\frac{E_{p}}{E_{c}}\\frac{M_{LL+IM}\\,e_{pc}}{I_{c}}', sub: `\\frac{${n(Ep, 0)}}{${n(Ecf, 0)}}\\frac{${g(MllG, 0)}(${n(epc, 3)})}{${g(cp.Ic, 0)}}`, value: gn.live, unit: 'ksi', d: 3, note: 'M_LL+IM: the engine\'s live-load envelope at midspan (kip-in). Credited only in combinations with live load; not used by the checks.' }, undefined, 'gains.live');
     add({ id: 'gain.perm', label: 'Permanent elastic gains', sym: '\\Delta f_{p,perm}', eq: '\\Delta f_{p,DC1} + \\Delta f_{p,SD}', sub: `${n(gn.precast, 3)} + ${n(gn.composite, 3)}`, value: gn.permanent, unit: 'ksi', d: 3 }, gn.precast + gn.composite, 'gains.permanent');
-    add({ id: 'gain.fpe', label: 'Effective prestress with the permanent elastic gains credited', sym: 'f_{pe,gain}', eq: 'f_{pe} + \\Delta f_{p,perm}', sub: `${n(R.fpe, 2)} + ${n(gn.permanent, 3)}`, value: R.fpeGain, unit: 'ksi', d: 2, note: 'The margin the gains give: the service checks use f_pe without gains (conservative).' }, R.fpe + gn.permanent, 'fpeGain');
+    const fx2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);   // PS-29: plain-text value in the step's note
+    add({ id: 'gain.fpe', label: 'Effective prestress with the permanent elastic gains credited', sym: 'f_{pe,gain}', eq: 'f_{pe} + \\Delta f_{p,perm}', sub: `${n(R.fpe, 2)} + ${n(gn.permanent, 3)}`, value: R.fpeGain, unit: 'ksi', d: 2, note: 'The margin the gains give: the service checks use f_pe without gains (conservative). ' + (inp.opt.lossMethod === 'refined'
+        ? `The deck shrinkage gain Δf_pSS = ${fx2(gn.deckShr)} ksi is already in the long-term loss Δf_pLT (refined method, 5.9.3.4.3) and is not added again.`
+        : `The deck shrinkage gain Δf_pSS (${fx2(gn.deckShr)} ksi) is not credited: the approximate method (5.9.3.3) has no deck shrinkage term.`) }, R.fpe + gn.permanent, 'fpeGain');
     // stages of one strand row (the table covers every row)
     const S = R.strandStages, r0 = S.rows[0];
     if (r0) {
diff --git a/apps/ps-bridge/ui/losses.js b/apps/ps-bridge/ui/losses.js
index 8161f8a..68c3ef3 100644
--- a/apps/ps-bridge/ui/losses.js
+++ b/apps/ps-bridge/ui/losses.js
@@ -32,7 +32,9 @@
       ${gRow('DC1 (deck, haunch, diaphragms)', 'girder', 'precast', 'permanent', 'ls.gain.pc')}${gRow('DC2 + DW', 'composite', 'composite', 'permanent', 'ls.gain.cmp')}${gRow('LL + IM', 'composite', 'live', 'transient', 'ls.gain.ll')}
       ${dss ? gRow(`Deck shrinkage (${inp.opt.dfpSSauto ? 'computed' : 'entered'})`, 'composite', 'deckShr', refd ? 'in Δf<sub>pLT</sub> (refined)' : 'not in Δf<sub>pLT</sub> (approximate)', 'ls.ss.dfSS') : ''}
       <tr><td class="lft"><b>Permanent gains (DC1 + DC2 + DW)</b></td><td></td><td><b>${ev('gains.permanent', 2)}</b></td><td>${k.fx(gn.permanent * ss.Aps, 0)}</td><td></td><td>${wk('ls.gain.perm')}</td></tr></tbody></table></div>
-      <p class="note">Δf<sub>p</sub> = (E<sub>p</sub>/E<sub>c</sub>) M e / I on the section that carries each load; + = a gain. f<sub>pe</sub> with the permanent gains credited = ${ev('fpe', 2)} + ${ev('gains.permanent', 2)} = <b>${ev('fpeGain', 2, 'ksi')}</b> ${wk('ls.gain.fpe')}. The live-load gain applies only in combinations with live load. The checks use f<sub>pe</sub> without gains (conservative); the gains show the margin.${dss && refd ? ' The deck shrinkage gain Δf<sub>pSS</sub> is part of the refined Δf<sub>pLT</sub> (it reduces the loss).' : ''}</p>`, 'card-gain');
+      <p class="note">Δf<sub>p</sub> = (E<sub>p</sub>/E<sub>c</sub>) M e / I on the section that carries each load; + = a gain. f<sub>pe</sub> with the permanent gains credited = ${ev('fpe', 2)} + ${ev('gains.permanent', 2)} = <b>${ev('fpeGain', 2, 'ksi')}</b> ${wk('ls.gain.fpe')}. The live-load gain applies only in combinations with live load. The checks use f<sub>pe</sub> without gains (conservative); the gains show the margin. <span id="gain-ss-note">${refd
+        ? `Δf<sub>pSS</sub> = ${ev('gains.deckShr', 2, 'ksi')} is already in the long-term loss Δf<sub>pLT</sub> (refined method, 5.9.3.4.3: it reduces the loss) ${wk('ls.ss.dfSS')}, so it is not added again here.`
+        : `Δf<sub>pSS</sub> (${ev('gains.deckShr', 2, 'ksi')}) is not credited: the approximate method (5.9.3.3) has no deck shrinkage term, and it is not added as a gain here.`}</span></p>`, 'card-gain');
     const S = R.strandStages;
     h += k.card('Strand force and stress by row and stage', `<div class="tscroll"><table class="tbl"><thead><tr><th rowspan="2">Row y<br>in</th><th rowspan="2">e<br>in</th><th rowspan="2">n</th><th colspan="2">At release</th><th colspan="2">Transfer to deck</th><th colspan="2">Permanent (final)</th></tr>
       <tr><th>f<sub>pt</sub> ksi</th><th>P kip</th><th>f<sub>pD</sub> ksi</th><th>P kip</th><th>f<sub>pe</sub> ksi</th><th>P kip</th></tr></thead><tbody>
```

## 2026-11-14 — PS-30 / PS-31 / PS-32: the box beams and voided deck slabs from the CTDOT Bridge Design Manual plates (properties and drawn outline from one table); old projects migrated on open with a notice (CALCULATION CHANGE, §4; SAVED DATA, §5)
PR #1540: https://github.com/mlococo88/All-Structural/pull/1540
### Request
- Engineer decisions 2026-11-14 on the box / slab library audit:
  - PS-30: box library = CTDOT BDM plate 5.2.1b (AASHTO BI–BIV, 36 and 48 series, depths 27 / 33 / 39 / 42 in, actual widths 35.5 / 47.5 in, 5½ in top and bottom slabs, webs per plate, void centred). A, I, y_b from the plate; the drawn outline from the same dimensions, its A / I / y_b within ~2.5 % of the plate (tested); a plate entry that does not agree is flagged, not invented.
  - PS-32: voided slabs = the CTDOT standard voided slabs of plates 5.1.1a–c / 5.1.2a–c, 36 and 48 series, outline and properties from the plate; the solid slabs stay; the wrong 21×48 and 27×48 entries retired (21×48 → SIV-48).
  - PS-31 (§5 + §4): a saved / imported project with an old name migrates on open to the corrected section of the same name (27 in voided slab: the nearest standard depth within ±3 in, else an input error naming it); a loud notice "section corrected: old A / I / y_b → new" per type; the Report states it in its assumptions; the old values kept in the project (P.legacySection).
### Problem (audit 2026-11-14)
- The old library's four boxes ('AASHTO BI-36 (12in)', 'BII-36 (18in)', 'BIII-36 (27in)', 'BIV-48 (33in)') had depths that are not AASHTO box depths, a 5 in bottom wall with the void on it and a 2 in top wall, and published A / I / y_b that match neither the drawn outline nor any one standard section. Every published I exceeded the I of the SOLID h × w rectangle (BI-36: 12,897 in⁴ against 5,184 in⁴ for a solid 36 × 12): impossible. The two voided slabs ('Deck slab 21×48 (voided)': I 41,058 > the solid 37,044; '27×48': 83,743 > 78,732) likewise. Every box / voided-slab result of the app (and of the old app) used these values.
### What changed
- New `apps/ps-bridge/engine/sections.js` (`window.PSBSections`), loaded right after the moved engine (`index.html` script list, after `engine/pbd-merge.js`). The moved engine files are NOT edited (verbatim and parity tests unchanged); this file changes the engine's own table object in place:
  - `install()`: GIRDERS rebuilt in the same order with the six old entries removed and the 8 CTDOT boxes (after the NEXT beams) and 6 CTDOT voided slabs (after the solid slabs) added. Engine fields: box `{ box, h, w (actual), A, I, yb, bw: 2 t_w, wall: 5.5, voidW: w − 2 t_w, voidH: h − 11 }` (the engine puts the void on `wall`, so `voidH = h − 11` centres it between the 5½ in slabs); slab `{ deck, h, w, A, I, yb, bw: w − Σd, voids, voidD: max d }`; the plate data in `src` (not read by the engine).
  - `sectionVoids` wrapped (`window.sectionVoids`, the engine's global function; calls from the engine's `tensionSideArea` and from every graphic go through it): a standard voided slab (found by h, w, voids, voidD) returns the plate's voids (x, d); every other shape the engine's own result. Needed for SIV-48 (Ø12, Ø10, Ø12: the engine draws equal voids) and the plate void spacing.
  - `LEGACY` (the six old entries byte for byte, test-checked against the frozen slice), `MAP` (old → new name), `migrate(P)`, `withLegacy(fn)` (the old entries back in GIRDERS while `fn` runs: the old app's results of an imported design), `items`, `text`, `retiredMsg`, `sig`, `outline`, `stdOf`.
- `engine/model.js` `importJSON`: after `PSBLegacy.restore`, `PSBSections.migrate(p)` (its note joins the load notes). Header documents the optional `legacySection` field.
  - Anchor: `if (BR && typeof window !== 'undefined' && window.PSBLegacy && p.legacy) { const n = window.PSBLegacy.restore(p); …`
  - Added after it: `if (typeof window !== 'undefined' && window.PSBSections) { const n = window.PSBSections.migrate(p); if (n) notes.push(n); }`
- `engine/legacy.js` `verify` and `restore` (per cell): `computeAll` of the old inputs and of the imported inputs run inside `PSBSections.withLegacy` (so the import is still compared value for value, with the old app's section values; the correction is applied after).
  - Before: `const Ro = computeAll(clone(c.old)), inp = window.PSBDesign.inputs(c.project), Rn = computeAll(clone(inp));`
  - After: `const WL = fn => (window.PSBSections ? window.PSBSections.withLegacy(fn) : fn()); const Ro = WL(() => computeAll(clone(c.old))), inp = …, Rn = WL(() => computeAll(clone(inp)));` (the same in `restore`: `Ro = WL(() => computeAll(clone(oldInp))); Rn = WL(() => computeAll(clone(inp)));`).
- `index.html`: the import's `replace` runs `PSBSections.migrate(Q)` after `PSBLegacy.restore(Q)`; new `secNotice()` (an inline banner at the top of every output tab, `#secNotice`, the PS-22 notice style with a red bar: "Girder section corrected (PS-31). <per base design / type text> Girders & strands tab; Section properties.", Close stores `P.notices.sec` = the closed items' signature; another corrected item shows it again); its Close handler on `#out`.
- `engine/inputcheck.js` (field rule `sel`): for `base.girder` an old name with no standard (`Deck slab 27×48 (voided)`) gets `retiredMsg` instead of "choose one of the options".
- `ui/legacy.js` `summaryHtml`: below the verdict, when the project has legacySection items, `#lgSec` "Section corrected after the import (PS-31): the results of this project differ from the old app's. The comparison above is of the import, with the old app's section values. <text>".
- `ui/section.js`: `voidNote(G)` for a standard section: the void(s), the plate and PDF page, and the drawn outline's A, I, y_b against the plate's (± %); the gross card's source note names the plate (`stdSrc`).
- `report/builders.js`: new `secNotes(B)` in §2 Assumptions: one line per migrated item (the banner's text, "(see §3 …)").
- `tests/engine/psbridge-tab-cases.mjs`: the two box designs use 'AASHTO BIII-36 (39in)' (were 'AASHTO BIII-36 (27in)'); the old-name path is tested by the migration tests and harness B `--import`.
### The library (plate vs drawn outline)
Boxes, CTDOT BDM plate 5.2.1b (issue 10/03, PDF p. 327); outline plate 5.2.1a (p. 326). Drawn outline = rectangle w × h less a rectangular void (w − 2 t_w) × (h − 11) centred (shear keys, ¾ in chamfers and the 3 × 3 in void chamfers not drawn).

| Name | h | w act. | t_w | Plate A / I / y_b | Outline A / I / y_b | Δ A / I / y_b | Plate S_b / S_t | I / y_b, I / y_t | Plate wt / A·150/144 |
|---|---|---|---|---|---|---|---|---|---|
| AASHTO BI-36 (27in) | 27 | 35.5 | 5 | 554.6 / 49,495 / 13.35 | 550.5 / 49,525 / 13.50 | −0.74 / +0.06 / +1.12 % | 3,709 / 3,625 | 3,707 / 3,626 | 578 / 577.7 |
| AASHTO BI-48 (27in) | 27 | 47.5 | 5 | 686.6 / 65,085 / 13.38 | 682.5 / 65,112 / 13.50 | −0.60 / +0.04 / +0.90 % | 4,886 / 4,777 | 4,864 / 4,779 | 715 / 715.2 |
| AASHTO BII-36 (33in) | 33 | 35.5 | 5 | 614.6 / 83,834 / 16.30 | 610.5 / 83,687 / 16.50 | −0.67 / −0.18 / +1.23 % | 5,144 / 5,019 | 5,143 / 5,020 | 640 / 640.2 |
| AASHTO BII-48 (33in) | 33 | 47.5 | 5 | 746.6 / 109,127 / 16.33 | 742.5 / 108,976 / 16.50 | −0.55 / −0.14 / +1.04 % | 6,681 / 6,548 | 6,683 / 6,546 | 778 / 777.7 |
| AASHTO BIII-36 (39in) | 39 | 35.5 | 6 | 730.6 / 132,895 / 19.28 | 726.5 / 132,496 / 19.50 | −0.56 / −0.30 / +1.14 % | 6,894 / 6,738 | 6,893 / 6,739 | 761 / 761.0 |
| AASHTO BIII-48 (39in) | 39 | 47.5 | 6 | 862.6 / 170,267 / 19.31 | 858.5 / 169,863 / 19.50 | −0.48 / −0.24 / +0.98 % | 8,817 / 8,648 | 8,818 / 8,647 | 899 / 898.5 |
| AASHTO BIV-36 (42in) | 42 | 35.5 | 6 | 766.6 / 161,387 / 20.76 | 762.5 / 160,836 / 21.00 | −0.53 / −0.34 / +1.16 % | 7,773 / 7,599 | 7,774 / 7,598 | 799 / 798.5 |
| AASHTO BIV-48 (42in) | 42 | 47.5 | 6 | 898.6 / 205,690 / 20.80 | 894.5 / 205,133 / 21.00 | −0.46 / −0.27 / +0.96 % | 9,890 / 9,701 | 9,889 / 9,702 | 936 / 936.0 |

Voided slabs, plates 5.1.1c (36 in, PDF p. 314) and 5.1.2c (48 in, p. 317); outlines 5.1.1a / 5.1.1b (p. 312 / 313), 5.1.2a / 5.1.2b (p. 315 / 316). Drawn outline = rectangle less round voids on mid-depth.

| Name | h | w act. | Voids (x: Ø) | Plate A / I / y_b | Outline A / I / y_b | Δ A / I / y_b | Plate S_b / S_t | I / y_b, I / y_t | Plate wt / A·150/144 |
|---|---|---|---|---|---|---|---|---|---|
| AASHTO SII-36 (15in) | 15 | 35.5 | ±8: Ø8 | 438 / 9,728 / 7.44 | 432.0 / 9,582 / 7.50 | −1.38 / −1.50 / +0.81 % | 1,309 / 1,287 | 1,308 / 1,287 | 457 / 456.3 |
| AASHTO SIII-36 (18in) | 18 | 35.5 | ±8: Ø10 | 473 / 16,034 / 8.92 | 481.9 / 16,271 / 9.00 | +1.89 / +1.48 / +0.90 % | 1,798 / 1,766 | 1,798 / 1,766 | 493 / 492.7 |
| AASHTO SIV-36 (21in) | 21 | 35.5 | ±8: Ø12 | 511 / 24,987 / 10.40 | 519.3 / 25,361 / 10.50 | +1.63 / +1.50 / +0.96 % | 2,403 / 2,358 | 2,403 / 2,357 | 532 / 532.3 |
| AASHTO SII-48 (15in) | 15 | 47.5 | 0, ±14: Ø8 | 553 / 12,622 / 7.45 | 561.7 / 12,756 / 7.50 | +1.57 / +1.06 / +0.67 % | 1,695 / 1,672 | 1,694 / 1,672 | 576 / 576.0 |
| AASHTO SIII-48 (18in) | 18 | 47.5 | 0, ±14: Ø10 | 611 / 21,376 / 8.94 | 619.4 / 21,612 / 9.00 | +1.37 / +1.11 / +0.67 % | 2,393 / 2,359 | 2,391 / 2,359 | 636 / 636.5 |
| AASHTO SIV-48 (21in) | 21 | 47.5 | ±14: Ø12, 0: Ø10 | 684 / 33,759 / 10.43 | 692.8 / 34,131 / 10.50 | +1.28 / +1.10 / +0.67 % | 3,238 / 3,193 | 3,237 / 3,194 | 713 / 712.5 |

- The engine computes S = I / y from the plate's I and y_b (it does not read the plate's S); the plate S agree within 0.5 % (BI-48 S_b: plate 4,886, I / y_b 4,864, −0.45 %: the plate's own rounding). Self-weight = A / 144 × w_c,load as for every shape (plate weights = A × 150 / 144).
- Web thickness per beam: the plate shows "5″ / 6″" without saying which beam has which. From the plate's own areas: A = w h − (w − 2 t_w)(h − 11) + 18 (four 3 × 3 in void chamfers) − 13.9 (shear keys and ¾ in chamfers) reproduces all 12 listed areas to 0.1 in² with t_w = 5 in for BI / BII (and BI Mod.) and 6 in for BIII / BIV (and BIV Mod.), consistent with plates 5.2.2 (BI, BII: one column of draped strands) and 5.2.3 (BIII, BIV: two columns). Test-checked for the 8 entries.
### Saved data (CLAUDE.md §5)
- New optional field within schema version 1: `P.legacySection = { decision: 'PS-31 (engineer 2026-11-14)', items: [{ where: 'base' | 'type:<id>', label, from, to, old: { h, w, A, I, yb }, now: { h, w, A, I, yb } | null }] }` and `P.notices.sec` (the banner closed). Nothing reads them for a calculation.
- Migration (PS-31) on open (importJSON: the stored project, Import JSON, and the old-app import after its comparison): `base.girder` and each girder type's `ovr.girder` with an old name → the new name (MAP below); the old library values recorded in `legacySection` (idempotent: an item is recorded once). The stored text is not rewritten by reading it; the next autosave stores the migrated project with `legacySection`. The old app's data and the import record (`P.legacy.inputs`, `.bridge`) keep the old names as read.

| Old name (old A / I / y_b, h) | New name | New A / I / y_b, h |
|---|---|---|
| AASHTO BI-36 (12in) (560 / 12,897 / 6.00, 12 in) | AASHTO BI-36 (27in) | 554.6 / 49,495 / 13.35, 27 in |
| AASHTO BII-36 (18in) (693 / 36,434 / 9.00, 18 in) | AASHTO BII-36 (33in) | 614.6 / 83,834 / 16.30, 33 in |
| AASHTO BIII-36 (27in) (812 / 97,756 / 13.14, 27 in) | AASHTO BIII-36 (39in) | 730.6 / 132,895 / 19.28, 39 in |
| AASHTO BIV-48 (33in) (1,097 / 200,631 / 16.11, 33 in) | AASHTO BIV-48 (42in) | 898.6 / 205,690 / 20.80, 42 in |
| Deck slab 21×48 (voided) (807 / 41,058 / 10.50, 21 in) | AASHTO SIV-48 (21in) | 684 / 33,759 / 10.43, 21 in |
| Deck slab 27×48 (voided) (1,041 / 83,743 / 13.50, 27 in) | none: no standard voided slab within ±3 in (15, 18, 21 in) | kept; input error "Girder section "Deck slab 27×48 (voided)" was removed from the library (PS-31): …; choose a section." |
### Governing provisions (CLAUDE.md §4)
- Source of the section properties changed: old library ("gross properties per PCI/AASHTO", no table, edition or page named) → CTDOT Bridge Design Manual (2024 issue in the reference folder), plates 5.2.1a / 5.2.1b (box beams, issue 10/03) and 5.1.1a–c, 5.1.2a–c (deck slabs, issue 10/03, rev. 01/05). No formula, factor, unit or AASHTO article changes; every check uses the new A, I, y_b, h, w (and the outline for A_ct, 5.7.3.4.2, and the strand fit, PS-28).
### Check cases (hand; before = the old entry, after = the plate entry; same engine)
- Harness B "box BIII-36 with a 6 in topping, deck on (S below 4 ft), handling on" (tests/engine/psbridge-tab-cases.mjs: the default project, 60 ft simple span, 16 strands 0.6 in at y = 2 in, no draped strands, 5 girders at 3 ft): 'AASHTO BIII-36 (27in)' → 'AASHTO BIII-36 (39in)'.
  - h 27 → 39 in; A 812 → 730.6 in²; I 97,756 → 132,895 in⁴; y_b 13.14 → 19.28 in.
  - S_b = I / y_b: 97,756 / 13.14 = 7,439.6 → 132,895 / 19.28 = 6,892.9 in³; S_t = I / (h − y_b): 97,756 / 13.86 = 7,053.1 → 132,895 / 19.72 = 6,739.1 in³.
  - w_g = A / 144 × 0.155 kcf (w_c,load): 0.8740 → 0.7864 klf; M_g at midspan = w L² / 8: 393.3 → 353.9 k-ft; its bottom stress M_g × 12 / S_b: 0.634 → 0.616 ksi.
  - e_m = y_b − y_ps (y_ps = 2.00 in): 11.14 → 17.28 in. Total loss 24.54 → 31.78 ksi; f_pe 177.96 → 170.72 ksi.
  - Composite (6 in topping, b_eff = w: 36.0 → 35.5 in): I_c 140,227 → 207,226 in⁴; y_bc 16.20 → 23.73 in; S_bc 8,654 → 8,734 in³. DF_M 0.3818 → 0.3945.
  - φM_n (midspan) 1,983.6 → 2,900.3 k-ft (d_p larger with h 39 in); M_u 1,915.3 → 1,894.2 k-ft (lighter girder).
  - Key stresses (ksi, + compression): release top (Release tens) −0.109 → −0.675 (limit −0.626: 0.174 → 1.078 FAIL); release compression 1.732 → 2.458 (limit 4.420); service compression, permanent 0.932 → 0.398, full 1.409 → 0.871; service top tension 0 → −0.400 (limit −0.554, 0.721); Service III bottom −0.101 → 0 (0.182 → 0.000); deck 0.918 → 0.805.
  - Other ratios (before → after): Flexure 0.967 → 0.654; Min reinf 1.045 FAIL → 0.869; Shear 0.817 → 0.336; Long. reinf 0.775 → 0.167; Interface shear 0.389 → 0.274; Splitting 0.365 → 0.357; Fatigue strand 0.120 → 0.122, concrete 0.214 → 0.304; LL deflection 0.518 → 0.362; Release tension steel (5.9.2.3.1b) 0.169 → 5.407 FAIL; Lifting stress 0.396 → 1.287 FAIL; Lifting FS 0.525 → 0.141; Hauling FS 0.131 → 0.051; Deck −M 0.323 → 0.325. The design had been set up on the wrong 27 in section; on the real 39 in box the bottom row's eccentricity is 6.1 in larger, so the release top tension governs. Harness B logs the same before / after (its 17 designs: 0 differences against the old app's engine with the plate entry).
- Default-strand BI-36 (the default project's rows 10 @ 2 + 10 @ 4 + 8 @ 6 in, no draped, 6 in topping, 60 ft, 5 girders at 3 ft): 'AASHTO BI-36 (12in)' → 'AASHTO BI-36 (27in)': h 12 → 27 in; A 560 → 554.6 in²; I 12,897 → 49,495 in⁴; y_b 6.00 → 13.35 in; S_b = S_t 2,149.5 → 3,707.5 / 3,626.0 in³; y_ps = (10 × 2 + 10 × 4 + 8 × 6) / 28 = 3.857 in, e_m 2.14 → 9.49 in; w_g 0.6028 → 0.5970 klf; I_c 24,483 → 87,344 in⁴; φM_n 706 → 2,459 k-ft; M_u 1,657 → 1,725 k-ft; release compression 2.939 → 4.664 ksi (0.665 → 1.055 FAIL), release top −0 → −0.733 (1.171 FAIL); Srv III bottom −1.929 → 0 (3.482 FAIL → 0); Flexure 2.351 FAIL → 0.702; Shear 1.704 FAIL → 0.477; LL deflection 2.623 FAIL → 0.802. (These default rows do not fit the real 27 in box: the 6 in row is inside its void, an input error in the app; the values are for the comparison only.)
### How verified
- New `tests/engine/psbridge-sections.test.mjs` (7 tests): the library = the plates (A, I, y_b, h, w; plate S within 0.5 % of I / y; weight within 1 lb/ft), the old entries removed (kept byte for byte in `LEGACY`), every other GIRDERS entry unchanged, the order; the box webs from the plate areas; the drawn outline (engine halfPolygon + sectionVoids, integrated) within 2.5 % of A, I, y_b for all 14; the box void centred; SIV-48 voids and A_ct by hand; migration of every old name (base and a type), idempotent, the stored text unchanged, results computed; the 27×48 input error and notice; the old-app import (compared with the old entries, then corrected, GIRDERS clean after); the Section note and the Report §2 assumption; the check cases above (printed).
- Tests updated for the new library: strandfit (PS-28 hand points on BI-36 27 in and SIV-48), strandgfx (SII-48 has no centred row with PS-28's 2 in to voids: noted, PS-33 next), voidnote, pierfig, legacy (harness A old designs computed with the old entries), verbatim and model (the script list), the tab cases (box designs on 'AASHTO BIII-36 (39in)').
- `node tests/engine/run.mjs psbridge tex project-registry`: 22 files, 210 passed, 0 failed. `node tests/check-syntax.mjs`: all pass.
- Smokes: `ps-bridge-skeleton.mjs` 265 checks, 0 failed (new 3n: PS-31 in the browser); `ps-bridge-types.mjs` 106 / 0; `ps-bridge-3d.mjs` 101 / 0 (a first run under load had 6 timing failures in "multitype"; clean alone).
- Harness B (`tests/psbridge-compare.mjs`; box designs compared with the old app's engine computing the plate entry, see its header): normal 17 designs, 0 differences, exit 0; `--import` 17 designs (box designs imported with the old name; `#lgSec` checked), 0 differences, exit 0; `--control` and `--import --control` on the box design: exit 1.
### Decisions (pending engineer review)
- PS30-D1. Library depths: BI–BIV at 27 / 33 / 39 / 42 in, 36 and 48 series (8 entries), as decided; the plate's "Mod." sections (BI Mod. 24 in, BIV Mod. 45 in) are not added. The plate's BIV-48 Mod. A = 834.6 in² is a misprint (its weight 974 lb/ft gives 974 × 144 / 150 = 935 in²; the wall formula above gives 934.6 in²): flagged, not used.
- PS30-D2. Width = the plate's actual width (35.5 / 47.5 in) for the outline, the composite topping width (b_eff = w) and the bottom width at the pier (b_bf = w); the old entries used the nominal 36 / 48 in. The plate's properties are of the actual section.
- PS30-D3. The drawn outline leaves out the shear keys, the ¾ in corner chamfers and the 3 × 3 in void chamfers (the engine draws a rectangle and a rectangular void). Outline within 1.9 % (A), 1.5 % (I), 1.23 % (y_b) of the plate for all 14 entries. The void without its chamfers is larger than the real one: conservative for the strand fit (PS-28) and for A_ct (5.7.3.4.2, smaller A_ct).
- PS32-D1. Void spacing of the voided slabs: not dimensioned on plates 5.1.1a/b, 5.1.2a/b. Scaled from the plate drawings (the outline's 35.5 / 47.5 in as the scale, cross-checked with the void diameters): centres ±7.9 in (36 series), 0 and ±13.8 in (48 series); taken as ±8 in and 0, ±14 in. A, I, y_b do not depend on it (voids on mid-depth); it moves only the drawn voids and the strand fit.
- PS32-D2. The solid slabs stay as they are ('Deck slab 12×48 (solid)', '18×48 (solid)': nominal 48 in rectangles); the plates' SI-36 / SI-48 (solid 12 in, actual width) are not added.
- PS31-D1. Migration renames the girder (old name kept in legacySection), so a migrated project computes with the plate section and never with the old values; the old-app import still compares the import value for value with the old app's section values (withLegacy) and then states the correction (#lgSec) — "Results: the same as the old app" there refers to the import before the correction.
- PS31-D2. The 27×48 voided slab has no standard within ±3 in: the girder name is kept as saved (not replaced by a guess) and the project shows an input error naming it until another section is chosen.
### Open items
- The CTDOT plates' BIV-48 Mod. area misprint (above). SII-36: the plate A (438 in²) is 6 in² above rectangle-less-voids (432 in²) although its keys and chamfers should make it smaller (the other five slabs: plate 8–9 in² below): within the 2.5 % tolerance; noted for the engineer.
- Not changed (engine, §4 "don't fix while in there"): adjacent boxes / slabs use the I-girder LLDF type (k) equations with K_g / (12 L t_s³); with no topping (t_s = 0, guarded to 1e-6) the term grows without bound (BI-36, 60 ft, no topping: DF_M 1.77 → 2.02). For the engineer: the AASHTO type (f)/(g) adjacent-box equations (4.6.2.2.2b, b, I, J) are not used.
- PS-28's 2 in centre clearance to a void face rejects the standard box pattern's 4 in row (1.5 in from the void in the 5½ in slab) and the SII slabs' 2 in row (1.5 in below the Ø8 voids): next PR (PS-33).
### Other copies
- `Prestressed Bridge Design.html` (the old app, frozen since PR 2a) keeps the wrong box / voided slab table (its `GIRDERS`, line ~2470); not fixed (frozen). Noted in `fixlog/Prestressed Bridge Design.md`. Harness B computes the expected values of box designs with the old app's engine and the plate's entry put in its GIRDERS.
- `lldf.html` has its own BI–BIV box choices (separate data); not touched.

## 2026-11-14 — PS-33 / PS-34: the strand fit measures 1.5 in to a void face (exterior faces 2 in); the pier compression block checked against each family's own thickness (input validation and a warning; no calculation change)
PR #1541: https://github.com/mlococo88/All-Structural/pull/1541
### Request
- Engineer decisions 2026-11-14:
  - PS-33: strand-fit (PS-28) clearance to VOID faces = 1.5 in to the strand centre (exterior faces stay 2 in), for boxes and voided slabs; the CTDOT box standard pattern rows at 2 in and 4 in in the 5½ in slab must then fit (plates 5.2.2 / 5.2.3, PDF p. 328 / 329, as far as the contiguous-row model represents them).
  - PS-34: the pier a ≤ t_bf warning uses the family thickness: NEXT = the stem depth (h − top flange); box = the bottom slab; voided slab = the concrete below the voids; solid slab = h; I-girders / bulb tees unchanged. App-side module; warning only.
  - Row model ("use your judgment"): keep the contiguous centred rows; state on the Girders & strands tab (box / voided slab) that the standard gapped rows and web columns are entered as the nearest contiguous rows and that the results use only row height and count; a plan item for per-row strand positions (future PR, not built).
### Problem
- PS-28 measured 2 in from a strand centre to a void face as to an exterior face. The CTDOT standard box pattern's second row at 4 in is 1.5 in below the void (5½ in bottom slab), and the SII slabs' 2 in row is 1.5 in below the Ø8 voids: the standard patterns were input errors.
- The engine's pier check `tbf = g.isNext ? g.next.ft : g.d[2]` (pbd-compute.js, verbatim) uses the NEXT top flange (the block is in the stems) and 0 for every box / slab (`girderGrossBase` returns `d: [0, 0, 0, 0]`): every continuous box / slab design got "a = … exceeds the bottom-flange thickness (0.0″)".
### What changed
- `engine/inputcheck.js` (`misfit`, the PS-28 rule):
  - Before: `const COVER = 2;` … `if (dv < COVER - 1e-9) return \`is ${fx(dv)} in from a void (less than ${COVER} in)\`;`
  - After: `const COVER = 2, VOID = 1.5;` … `if (dv < VOID - 1e-9) return \`is ${fx(dv)} in from a void (less than ${VOID} in)\`;`; the message rule "…outside the voids, at least 2 in from the edges of the concrete and at least 1.5 in from the edges of the voids…"; `VOID` exported. Exterior faces (`edgeDist`) unchanged.
- `ui/inputs.js`: the Straight strand rows card gets `#rowsFitNote` (the fit rule, every shape) and, for a box beam or a deck slab, `rowModelNote(b)`: "Box beam: the standard strand patterns (CTDOT BDM plates 5.2.2 / 5.2.3) have strands in vertical columns in the webs; enter them as the nearest contiguous rows (same height and count). The results use only each row's height y and count n (the strand centroid and area); the drawn positions are used for the fit check and the graphics only." (slab: "…plates 5.1.3–5.1.6) have rows with strands only between and outside the voids…").
- New `engine/pierblock.js` (`window.PSBPierBlock`, loaded after `engine/holddown.js`): `family(g)` → NEXT `{ t: h − next.ft, 'the stem depth h − t_f' }`, box `{ t: box.wall, 'the bottom slab' }`, voided slab `{ t: min(void y − d/2) over sectionVoids, 'the concrete below the voids' }`, solid slab `{ t: h, 'the slab depth h' }`, else null; `apply(inp, R)` (continuity on, `R.cont.aN` a number): `R.ps34 = { t, what, aN, aOK: aN ≤ t, engT: cont.tbf, engOK: cont.aOK }` and the engine's warning (regex `^Negative-moment compression block a = `) removed when a ≤ t, else replaced by "Negative-moment compression block a = X″ exceeds <what> (t″, PS-34) — rectangular-block assumption is unconservative; refine.". `cont.tbf`, `cont.aOK` and every other value are the engine's, unchanged.
- `engine/holddown.js`: `compute = inp => { const R = compute0(inp); return window.PSBPierBlock ? window.PSBPierBlock.apply(inp, R) : R; }` (compute0 = the former compute).
- `ui/flexure.js`: the pier card row "a against <what> (PS-34)" with `ps34.t` (else the engine's t_bf row as before); the figure's callout names the thickness. `engine/worked-strength.js` (`fx.pier.a` note): "a ≤ <what> = t in (PS-34)".
- `docs/ps-bridge-plan.md` §5: item 4b "Per-row strand positions (between voids / in webs)" (future PR).
- Tests: `psbridge-strandfit.test.mjs`, `psbridge-strandgfx.test.mjs` (the reference criterion `fitsAt`: void clearance 1.5 in), new `psbridge-ps33.test.mjs`; `pierblock` in the test loaders; harness B (`ps34.*` values compared with the thickness worked from the old app's girder).
### Saved data (CLAUDE.md §5)
- None: no key, field or format. Nothing is written.
### Governing provisions
- None changed: no capacity, factor or formula. PS-33 is an input-validation rule (fabrication clearance, the engineer's decision, checked against the CTDOT standard patterns). PS-34 changes which warning is shown (the rectangular-block assumption of the pier section, AASHTO LRFD 10th Ed. 5.6.3.2 / 5.6.2.2); φM_n at the pier is the engine's, unchanged.
### Check cases (hand)
- PS-33, AASHTO BI-36 (27in) (void 25.5 × 16 in, y = 5.5 to 21.5 in): rows 16 @ 2 in + 14 @ 4 in (plate 5.2.2). Strand (0, 4): 5.5 − 4 = 1.5 in to the void. Before: error "Straight strand rows, row 2: 14 strands at y = 4 in do not fit …: the strand at x = -13 in is 1.5 in from a void (less than 2 in)". After: fits (1.5 ≥ 1.5). Strand (13, 4): to the void corner (12.75, 5.5): √(0.25² + 1.5²) = 1.52 in ≥ 1.5: fits. Row of 18 @ 2 in: x = ±17, 17.75 − 17 = 0.75 in from the face: error (2 in to exterior faces kept).
- PS-33, AASHTO SII-48 (15in) (Ø8 voids at x = 0, ±14, y = 7.5; bottom 3.5 in): row 22 @ 2 in (plate 5.1.6 pattern's 2 in row): strand (1, 2): to the centre void √(1 + 5.5²) − 4 = 1.59 in; (13, 2): √(1 + 5.5²) − 4 = 1.59 in. Before: error (< 2 in). After: fits.
- PS-34, BIII-36 (39in), two 80 ft spans continuous, deck A_s = 16 in², f_y = 60 ksi, f′c = 8.5 ksi, b_bf = 35.5 in: a = 16 × 60 / (0.85 × 8.5 × 35.5) = 960 / 256.49 = 3.743 in. Before: t_bf = 0 → warning "a = 3.7″ exceeds the bottom-flange thickness (0.0″)". After: t = 5.5 in (bottom slab), 3.743 ≤ 5.5: no warning. With A_s = 40 in²: a = 9.357 in > 5.5: "… exceeds the bottom slab (5.5″, PS-34) …".
- PS-34, NEXT 36F, the same: b_bf = 2 × 13 = 26 in, a = 960 / (0.85 × 8.5 × 26) = 5.110 in; t = 36 − 8 = 28 in (engine: 8 in): no warning either way. SIV-48: a = 960 / (0.85 × 8.5 × 47.5) = 2.797 in, t = 10.5 − 6 = 4.5 in (below the Ø12 voids): no warning (before: 0.0″, warned).
- Every computed value (cont.*, φM_n at the pier, all checks) is the same before and after (test: R without ps34 / warns identical).
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry`: 23 files, 215 passed, 0 failed (new `psbridge-ps33.test.mjs`: the plate box patterns on all 8 boxes, the slab 2 in rows on all 6 slabs, the gapped-row / web-column limitation, the tab note, PS-34 per family with no other value changed, the Flexure row and step). `check-syntax`: all pass. Smokes: skeleton 265 / 0, types 106 / 0, 3d 101 / 0.
- Harness B: normal and `--import` 17 designs, 0 differences, exit 0; `--control` and `--import --control` exit 1. `ps34.*` values compared with the thickness worked from the old app's girder (no harness design is continuous on a NEXT / box / slab: checked in the browser with a scratch run — BIII-36 A_s 16 / 40, NEXT 36F, SIV-48, BT-72 on two 80 ft continuous spans: shown 5.50 / 28.00 / 4.50 in, the BT-72 row unchanged, the warning only for a = 9.36 > 5.5 in, 0 console errors).
### Decisions (pending engineer review)
- PS33-D1. Row model kept (contiguous centred rows); the tab states the limitation (above). The standard box web columns and the slabs' gapped 4 in rows are not representable; a contiguous row there is an input error (it would put strands in a void), as tested.
- PS34-D1. The voided-slab thickness is the concrete below the LOWEST void bottom (SIV-48: 4.5 in under the Ø12 voids, not 5.5 in under the Ø10), conservative.
- PS34-D2. The engine's `cont.tbf` / `cont.aOK` are kept unchanged in R (the verbatim engine's values); the app shows and warns on `R.ps34`.
### Open items
- Per-row strand positions (plan item 4b).
- The I-girder taper question of the audit (2 in measured perpendicular to the 45° taper; Type I / II rows at 6 in) is not changed.
### Other copies
- `Prestressed Bridge Design.html` (frozen): still the 0.0″ warning for boxes / slabs and the NEXT top flange; not fixed.

## 2026-11-14 — PR A: "to be confirmed" note for the CTDOT box beams and voided slabs (Girders & strands tab, Report assumptions); harness B: a BIII-36 design that passes (display and tests only; no calculation change)
PR #1542: https://github.com/mlococo88/All-Structural/pull/1542
### Request
- Engineer, 2026-11-14 (explicitly asked for; an exception to the usual rule of no "pending" text in the app): wherever a CTDOT box beam or standard voided slab is selected on the Girders & strands tab, and in the Report's assumptions for those sections, state that the section properties come from CTDOT BDM plate 5.2.1b (boxes) or 5.1.1c / 5.1.2c (slabs), that they replace the old app's box library (found inconsistent: the old "BIII-36 (27in)" gave I = 97,756 in⁴, more than a solid 36 × 27 in rectangle at 59,049 in⁴), and that the replacement is to be confirmed by the engineer against the DOT reference sheets; for the voided slabs, that the void spacing (±8 in; 0, ±14 in) is scaled from the plate, not dimensioned, and is to be confirmed.
- Harness B: keep the failing "box BIII-36 with a 6 in topping" design (it checks the failure reporting) and add a BIII-36 design that passes on the real 39 in section with the CTDOT plate strand pattern.
### What changed
- `engine/sections.js`: new `tbcNote(name)` (exported on `window.PSBSections`): the note for a standard entry of `STD` ('' for any other shape). Text: "To be confirmed: A, I and y<sub>b</sub> of this box beam | voided slab are taken from CTDOT BDM plate <5.2.1b | 5.1.1c | 5.1.2c> (PDF p. <327 | 314 | 317>). They replace the old app's box beam and voided slab library, which was found inconsistent (e.g. the old "BIII-36 (27in)" gave I = 97,756 in⁴, more than a solid 36 × 27 in rectangle at 59,049 in⁴). The replacement is to be confirmed by the engineer against the DOT reference sheets." + for a slab " The void spacing (void centres at ±8 | 0, ±14 in from the ℄) is scaled from the plate drawing, not dimensioned on it, and is to be confirmed."
  - Anchor: `const src = n => (STD[n] ? STD[n].src : null);` — the function added after it; `tbcNote` added to the export list after `src`.
- `ui/inputs.js` `cards()`: the shape card (`c.id === 'shape'`) gets `<p class="note" id="secTbcNote"><b>…</b></p>` when `tbcNote(P.base.girder)` is not empty (the base design, or a girder type's own inputs when "Entered values for" is a type: `cards('gird', V)`).
  - Before: `h += card(c.id, c.title, c.ref, body + (c.note ? \`<p class="note">${c.note(P.base, P)}</p>\` : ''));`
  - After: `const tbc = c.id === 'shape' && window.PSBSections && window.PSBSections.tbcNote ? window.PSBSections.tbcNote(P.base.girder) : '';` then `h += card(c.id, c.title, c.ref, body + (c.note ? … : '') + (tbc ? \`<p class="note" id="secTbcNote"><b>${tbc}</b></p>\` : ''));`
- `report/builders.js`: new `tbcNotes(B)` (each standard shape of the report once: the design girder and every girder type on a line, as `voidNotes`), "• <name>: <note> (see [[rs.sec]])"; added to §2 Assumptions after `voidNotes(B)`.
  - Before: `...voidNotes(B), ...secNotes(B)])];` After: `...voidNotes(B), ...tbcNotes(B), ...secNotes(B)])];`
- `tests/engine/psbridge-tab-cases.mjs`: new design "box BIII-36 (39in), CTDOT plate rows 16 + 16 strands and 4 top strands, 6 in topping, 80 ft, 10 boxes: passes" (used by `psbridge-tabs.test.mjs` and harness B).
- Tests: `psbridge-sections.test.mjs` new test "PR A" (the note of all 14 standard sections, none for other shapes, on the shape card and in the Report §2); `tests/smoke/ps-bridge-skeleton.mjs` 3n: the note on the Girders & strands tab and in the Report.
### The new harness B design (CTDOT BDM plate 5.2.3, PDF p. 329)
- AASHTO BIII-36 (39in), 6 in topping, one 80 ft simple span, ten boxes at 3 ft (ohL = ohR = 1.5 ft), interior G5; strands (0.6 in, the default): 16 @ y = 2 in (4 debonded 10 ft) + 16 @ y = 4 in (4 debonded 6 ft: the terminations staggered, 5.9.4.3.3(B)) on the plate's 2 in grid (plate 5.2.3: 15 spaces @ 2 in for the 2′-11½″ beam), + 4 top strands at y = 37 in (2 in below the top, 3.5 in above the void); DC1 additional 0 (no forms), DC2 0.10 klf, DW 0.075 klf; the rest the default project.
- Every check passes (largest ratio: Release comp 0.901; the engine's only warning: midspan in the φ transition zone, ε_t = 4.22‰, φ = 0.935).
- Layouts tried that do not pass: the two 16-strand rows alone fail the release tension at the ends (Release tens 1.86–1.93 and 5.9.2.3.1b at 50–90 ft: no self-weight moment there); with debonding only (up to 7 + 7 strands) 5.9.2.3.1b still fails; the plate's draped web columns (6 draped, y 31 / 9 in) cannot be entered (the draped group is drawn centred, inside the void: an input error; PS33-D1).
### Saved data (CLAUDE.md §5)
- None: no key, field or format.
### Governing provisions
- None changed (display text and tests only).
### Check cases (hand)
- Solid 36 × 27 in rectangle: I = b h³ / 12 = 36 × 27³ / 12 = 36 × 19,683 / 12 = 59,049 in⁴ < 97,756 in⁴ (the old entry).
- The note's plates and pages are those of `STD[n].src` (PS-30 / PS-32 table above); slab spacings ±8 in (36 series) and 0, ±14 in (48 series) as PS32-D1.
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry`: 23 files, 219 passed, 0 failed (new PR A test in `psbridge-sections.test.mjs`; the harness B design counts 17 → 18 in `psbridge-legacy`, `psbridge-strandfit`, `psbridge-types` and descriptions).
- `node tests/check-syntax.mjs`: all scripts pass (168 files).
- Smokes: `ps-bridge-skeleton.mjs` 267 checks, 0 failed (3n: the note on the Girders & strands tab and in the Report); `ps-bridge-types.mjs` 106 / 0; `ps-bridge-3d.mjs` 101 / 0.
- Harness B: normal, 18 designs, 45,960 shown values and 8,020 step values, 0 differences, exit 0; `--control` on the new design: exit 1; `--import` on the new design: 0 differences, exit 0.
### Decisions (pending engineer review)
- PRA-D1. The harness B passing design adds 4 top strands (y = 37 in) and debonding (4 strands 10 ft, 4 strands 6 ft) to the plate's two 16-strand rows: with the two rows alone the release tension at the ends fails at every span tried (50–90 ft), and the plate's draped web columns cannot be entered with the contiguous-row model (PS33-D1). Top strands are not on plate 5.2.3; they stand in for the draped strands' release-tension relief.
### Open items
- None.
### Other copies
- None.

## 2026-11-14 — PS-35: adjacent box beams and voided slabs get the AASHTO type (f) / (g) live-load distribution factors (app-side override of the frozen distFactors; J from the drawn outline or entered) (CALCULATION CHANGE, §4)
PR #1543: https://github.com/mlococo88/All-Structural/pull/1543
### Request
- Engineer decision 2026-11-14 (PS-35): box beams and voided slabs use their own superstructure type of AASHTO LRFD 10th Ed. Table 4.6.2.2.1-1, (f) precast boxes with shear keys and a cast-in-place overlay, (g) the same with an integral concrete deck: interior moment Table 4.6.2.2.2b-1 (k = 2.5 N_b^−0.2 ≥ 1.5, b, L, I, J), exterior moment 4.6.2.2.2d-1, interior shear 4.6.2.2.3a-1, exterior shear 4.6.2.2.3b-1, the skew corrections 4.6.2.2.2e / 4.6.2.2.3c for (f)/(g). App-side override of the frozen distFactors (engine/rigid.js the precedent); I-girders, NEXT and the solid slabs unchanged. Out-of-range N_b, b, L, I, J: computed, flagged on the tab, the input tab and the Report. J computed from the drawn outline (boxes: 4 A₀² / Σ s/t on the wall midlines; voided slabs: a defensible method, cited), worked; a J override per girder type ("user/DOT value"); a library J (DOT sheets, later) over the computed one.
### Problem
- The moved engine (`distFactors`, pbd-lldf-flexure.js, verbatim) gives every shape but NEXT the I-girder type (k) equations with K_g / (12 L t_s³); for adjacent beams with no topping t_s = 0 is guarded to 1e-6 (t_s³), so (K_g / 12 L t_s³)^0.1 is about 10× too large: BI-36, 60 ft: DF_M 2.0175 (should be about 0.26). With a topping the factors are type (k) values for a beam that is not type (k). The old app does the same (frozen).
### What changed
- New `apps/ps-bridge/engine/lldf-fg.js` (`window.PSBLldfFG`), loaded after `engine/rigid.js` (index.html script list). `run(inp, inner)` calls `inner(inp)` with the global `distFactors` wrapped for that call (restored after; the rigid.js pattern): for a box beam or a VOIDED deck slab (`isFG(g)`: girderGross `isBox`, or `isDeck` with voids and not `solid`) the engine's result is replaced by `compute(inp, g, cp, df0)`; every other shape gets the engine's own object (byte-identical results, tested). After the call, an out-of-range warning is added to `R.warns`.
  - Equations (cited, not copied): k = max(2.5 N_b^−0.2, 1.5); g_M1 = k (b / 33.3 L)^0.5 (I / J)^0.25; g_M2 = k (b / 305)^0.6 (b / 12 L)^0.2 (I / J)^0.06; g_V1 = (b / 130 L)^0.15 (I / J)^0.05; g_V2 = (b / 156)^0.4 (b / 12 L)^0.1 (I / J)^0.05 max(b / 48, 1); exterior e_M1 = max(1.125 + d_e / 30, 1), e_M2 = max(1.04 + d_e / 25, 1), e_V1 = max(1.25 + d_e / 20, 1), e_V2 = max(1 + ((d_e + b / 12 − 2) / 40)^0.5, 1) (root of a negative argument taken as 0), shear two lanes × min(48 / b, 1); interior g = max(one, two or more), exterior max(e₁ g₁, e₂ g₂); no lever rule, no rigid-section check; r_M = min(1.05 − 0.25 tan θ_M, 1); c_V = 1 + (12 L / 90 d) (tan θ)^0.5, θ ≤ 60°.
  - Mapping to the engine's fields: `m1, m2, v1, v2` (the (f)/(g) interior values), `skM = r_M`, `skV = c_V`, `eM = e_M2`, `eV = e_V2`, `lever = 0`, `rigid = 0`, `rigid1 = e_M1 g_M1` (the engine's exterior fatigue factor is max(lever, rigid1) / 1.2), `dfmRaw, dfvRaw, dfm, dfv`; the working in `df.fg` (type, b, L, N_b, d, I and its source, J and its source, the outline working `jw`, k, e's, ranges `out`, the engine's own type (k) values in `fg.engine`).
- `engine/holddown.js`: `compute0` runs the engine through `PSBLldfFG.run`.
  - Before: `const compute0 = inp => apply(inp, window.PSBRigid ? window.PSBRigid.run(inp) : computeAll(inp));`
  - After: `const engine = inp => (window.PSBRigid ? window.PSBRigid.run(inp) : computeAll(inp));` `const compute0 = inp => apply(inp, window.PSBLldfFG ? window.PSBLldfFG.run(inp, engine) : engine(inp));`
- `engine/rigid.js` `adjust`: no rigid-section terms for (f)/(g).
  - Before: `if (!df || !df.ext || df.isNext || !q || !Array.isArray(q.x)) return df;` After: `if (!df || !df.ext || df.isNext || df.fg || !q || !Array.isArray(q.x)) return df;`
- `engine/design.js` `one()`: a box beam / voided slab whose span has unequal support skews also gets `loads.skewLo` (the smaller |θ|), for the moment reduction (4.6.2.2.2e: only where the two skews differ by 10° or less). Added after the `skew:` line: `if (Math.abs(Math.abs(+k[0] || 0) - Math.abs(+k[1] || 0)) > 1e-9 && window.PSBLldfFG && window.PSBLldfFG.isFGInputs(o)) o.loads = Object.assign({}, o.loads, { skewLo: Math.min(…) });` Equal skews and every other shape: the inputs unchanged (tested).
- `engine/sections.js`: `DOT_J = {}` and `dotJ(name)` (a library J per standard section from the DOT sheets; none yet), exported.
- `engine/fields.js`: new Loads input card `fglldf` "Box beam / voided slab live load distribution (types f / g)" (shown for a box / voided slab), field `base.loads.Jfg` ('opt', > 0), note `PSBLldfFG.inputNote(b, P)` (type, I, J and its source, the out-of-range limits; a link to the Loads & LLDF tab); `dfAuto` option text "AASHTO equations (type k; box beams and voided slabs types f / g)".
- `engine/worked.js` `loads()`: `if (df.fg) fgSteps(add, inp, R); else { …the type (k) steps as before… }`; new `fgSteps`: I, the outline J (t_w, t_b, t_t, with a topping t_top = t_t + n t_s and its midline, b₀, h₀, A₀, Σ s/t, J_outline, Eq. C4.6.2.2.1-3), the J used (computed / library / user), I / J (with the Table 4.6.2.2.1-3 simplified value for comparison, not used), k, g_M1, g_M2, g_V1, g_V2, exterior e's and 48/b, g_M, g_V, r_M, c_V. Each step's value is the engine's and its substituted expression reproduces it (test).
- `engine/worked-stress.js`: the exterior fatigue DF step for (f)/(g): DF_fat = e_M1 g_M1 / 1.2.
- `ui/loads.js`: the (f)/(g) card "Live load distribution factors: interior | exterior box beam | voided slab, type (f | g) (PS-35)" with the range alert `#fgRange`; TOPICS `fgj` (I and J) and the new ids in `int` / `ext`; the solid-slab note reworded (type (k) as the old app, unchanged).
- `report/builders.js`: new `fgNotes(B)` in §2 Assumptions (after `tbcNotes`): "• Live-load distribution (PS-35): box beam | voided slab, AASHTO LRFD 10th Ed. cross-section type (f | g) of Table 4.6.2.2.1-1 (…), not the I-girder type (k) of the old app; I = … (composite section | girder), J = … (computed from outline | library (DOT) value | user/DOT value). [Outside the range of applicability: ….] (see [[rs.lds]])" (a warning note when out of range).
  - Before: `...voidNotes(B), ...tbcNotes(B), ...secNotes(B)])];` After: `...voidNotes(B), ...tbcNotes(B), ...fgNotes(B), ...secNotes(B)])];`
- `index.html`: the script; the input panel follows `data-gotab` links (the J note's link to the Loads & LLDF tab).
  - Added in the `inPanes` click handler after the `data-goin` line: `{ const gt = t.closest('[data-gotab]'); if (gt) { e.preventDefault(); gotoOut(gt.dataset.gotab); return; } }`
- Tests: new `tests/engine/psbridge-lldf-fg.test.mjs` (8 tests: the hand checks below, unchanged shapes byte-identical, skew, J precedence and saving per type, ranges and the input card, worked steps / tab / Report); `lldf-fg` in every test loader that loads `holddown`; `psbridge-model.test.mjs` script list; harness B (`tests/psbridge-compare.mjs`): a box / voided slab design is compared with the old app's engine with its distFactors wrapped by this module (the file added to the old page), its type (k) factors logged; `tests/smoke/ps-bridge-skeleton.mjs` 3n: the (f) card, the J override used / labelled / saved, the link.
### Saved data (CLAUDE.md §5)
- New optional field within schema version 1: `base.loads.Jfg` (in⁴; blank or absent = not entered), saved per girder type as `types[k].ovr['loads.Jfg']` (the existing override mechanism). No key, field or format changed; nothing migrated: a project without it reads, computes (J from the library / outline) and saves unchanged (tested: export → import → export identical). `loads.skewLo` is an engine input built on the fly (design.js), never saved.
### Governing provisions (CLAUDE.md §4)
- AASHTO LRFD 10th Ed. (2024): Table 4.6.2.2.1-1 (types f, g), 4.6.2.2.1 (I, J of the section traffic is applied to), Eq. C4.6.2.2.1-3 (closed thin-walled J), Tables 4.6.2.2.2b-1, 4.6.2.2.2d-1, 4.6.2.2.3a-1 (and 4.6.2.2.3a: I or J out of range), 4.6.2.2.3b-1, 4.6.2.2.2e-1 (and 4.6.2.2.2e: skews within 10°), 4.6.2.2.3c-1. Before: the same tables' type (a, e, k) rows (the engine), for every shape.
### Check cases (hand; before = the moved engine's type (k), after = (f)/(g))
See the PR for the full tables (inputs, J working, I, k, each term). Summary (default materials: f′c 8.5 ksi girder, 4.0 ksi deck, n = 0.8345; d_e = 2.0 ft; no skew):

| Design | Type | I (in⁴) | J (in⁴) | I / J | k | g_M1 / g_M2 | g_V1 / g_V2 | DF_M before → after | DF_V before → after |
|---|---|---|---|---|---|---|---|---|---|
| BI-36 (27in), 60 ft, no topping, N_b 5, interior | g | 49,495 | 87,352 | 0.56662 | 1.81195 | 0.2095 / 0.2639 | 0.4329 / 0.3979 | 2.0175 → 0.2639 | 0.4800 → 0.4329 |
| same, exterior G1 | g | | | | | e_M 1.1917 / 1.1200 | e_V 1.3500 / 1.2720 | 1.9968 → 0.2956 | 0.6000 → 0.5844 |
| BIII-36 (39in), 60 ft, 6 in topping, N_b 5, interior | f | 207,226 (composite) | 225,750 | 0.91794 | 1.81195 | 0.2364 / 0.2717 | 0.4435 / 0.4076 | 0.3945 → 0.2717 | 0.4800 → 0.4435 |
| SIV-48 (21in), 50 ft, no topping, N_b 6, interior | g | 33,759 (< 40,000: flagged) | 73,799 | 0.45744 | 1.74707 | 0.2427 / 0.3289 | 0.4598 / 0.4638 | 2.5894 → 0.3289 | 0.5203 → 0.4638 |

- BI-36 J: t_w = (35.5 − 25.5) / 2 = 5.0, t_b = t_t = 5.5; b₀ = 35.5 − 5 = 30.5; h₀ = 27 − 5.5 = 21.5; A₀ = 655.75 in²; Σ s/t = 2 × 30.5 / 5.5 + 2 × 21.5 / 5 = 19.6909; J = 4 × 655.75² / 19.6909 = 87,352 in⁴ (Table 4.6.2.2.1-3's simplified I / J: 0.54 × 27 / 35.5 + 0.16 = 0.5707, against 0.5666 here).
- SIV-48 J (one closed cell of the outer walls): t_w = 23.75 − 14 − 6 = 3.75; t_b = t_t = 10.5 − 6 = 4.5; b₀ = 43.75; h₀ = 16.5; A₀ = 721.88; Σ s/t = 2 × 43.75 / 4.5 + 2 × 16.5 / 3.75 = 28.2444; J = 73,799 in⁴.
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry`: 24 files, 227 passed, 0 failed. This includes the new `psbridge-lldf-fg.test.mjs` (8 tests):
  - the hand checks (1)–(3);
  - I-girders, NEXT and solid slabs byte-identical with and without the override (every non-box harness B design, plus a solid slab);
  - skew handling (smaller / larger skew, more than 10° apart; `skewLo` only for box and slab designs);
  - J precedence (user over library over outline), J saved per girder type, and an old project round-tripping unchanged;
  - the range flags in `R.warns` and on the Loads input card, and the input rule;
  - the worked steps: every derivation reproduces the engine value to 1e-9, plus the tab card, the Report section and the §2 assumption.
- `lldf-fg` was added to every test loader that loads `holddown`, and `psbridge-model` checks the script list.
- `node tests/check-syntax.mjs`: all scripts pass (169 files).
- Harness B `tests/psbridge-compare.mjs`:
  - normal: 18 designs, 45,966 shown values and 8,020 step values, **0 differences**, exit 0. The I-girder and NEXT designs are compared with the old app directly; the 3 box designs with the old engine wrapped by the module, and their DFs are logged before and after (table above).
  - `--import`: 18 designs, 0 differences, exit 0.
  - `--control` on a box design: exit 1. `--import --control`: exit 1.
  - After the Report change, `--case box` (4 designs) was rerun: 0 differences.
- Smokes:
  - `ps-bridge-skeleton.mjs`: 271 checks, 0 failed. New 3n checks: the type (f) card and the worked J on Loads & LLDF; the J override on the Loads input tab is used, labelled "user/DOT value" and saved; the note's link opens Loads & LLDF.
  - `ps-bridge-types.mjs`: 106 / 0.
  - `ps-bridge-3d.mjs`: 101 / 0.
### Decisions (pending engineer review)
- PS35-D1. Type (f) when the structural topping t_s > 0, (g) when t_s = 0 (the equations are the same; the type sets I and J).
- PS35-D2. I and J of the section to which traffic is applied (4.6.2.2.1, "usually the composite section"): with a topping, I = the composite I_c (the engine's, topping transformed by n) and J with the topping added to the top wall as n t_s at its own height; without, the girder's I and J. The composite I / J is larger than the precast-only I / J (BIII-36 with 6 in topping: 0.918 against 0.745), i.e. the larger (conservative) factors. A library (DOT) J or an entered J is used as given, with the same I.
- PS35-D3. Voided slab J: one closed thin-walled cell of the outer walls (Eq. C4.6.2.2.1-3: t_w the concrete outside the outermost void, t_b and t_t the thinnest concrete below / above the voids; the concrete between the voids is not counted). Smaller J than the section has (conservative, larger factors). Alternatives considered: the solid-section formula A⁴ / 40 I_p with net A and I_p (C4.6.2.2.1-2) gives J = 32,937 in⁴ for SIV-48 (I / J 1.025: g_M1 about 22 % and g_M2 about 5 % larger; physically too low: the voids take 30 % of the area but little torsional stiffness) and Table 4.6.2.2.1-3's simplified I / J (0.54 d / b + 0.16 = 0.399, J = 84,600 in⁴; needs the Owner's concurrence). For the boxes the cell J agrees with the simplified value within 1 % (BI-36 0.5666 / 0.5707; BIII-36 0.7448 / 0.7532).
- PS35-D4. I or J outside Table 4.6.2.2.3a-1 (25,000 ≤ J ≤ 610,000, 40,000 ≤ I ≤ 610,000 in⁴; every standard voided slab has I < 40,000): 4.6.2.2.3a lets the shear factor be taken as the moment factor; the LARGER of the shear equations and the moment factor is used (the equations stay where they give more), and the limit is flagged.
- PS35-D5. Skew: the moment reduction (Table 4.6.2.2.2e-1, any θ for (f)/(g)) with the SMALLER skew of the span's supports, none where they differ by more than 10° (4.6.2.2.2e); the shear correction with the larger (the engine's θ), over the whole span as the engine applies its own c_V; d = the precast depth h (the smaller d, the larger c_V). Unequal skews with the larger ≥ 30° remain the existing input error (design.js), unchanged.
- PS35-D6. Solid deck slabs ('Deck slab 12×48 / 18×48 (solid)') are unchanged (the brief): the old app and the engine give them type (k), with the same t_s = 0 blow-up; AASHTO lists precast solid boxes under (f)/(g) too. Open item. **Resolved by PS-36** (engineer 2026-11-14: the solid slabs get the type (f) / (g) override too; entry below).
- PS35-D7. d_e: as the engine takes it for every shape (from the girder centreline, deOf / entered), not from the exterior web centreline of the box (AASHTO's d_e for (f)/(g)): the larger d_e, the larger e (conservative).
- PS35-D8. Out of range (b, L, N_b, I, J, d_e > 2.0 ft, θ > 60°, d outside 17–60 in with a skew): computed all the same, listed on the Loads & LLDF tab (#fgRange), on the Loads input tab (#fgInNote) and as a design warning (R.warns: the check summary and the Report's warnings).
### Open items
- Solid deck slabs: type (k) with t_s = 0 (PS35-D6). Resolved by PS-36.
- The DOT sheets' J values: to be added to `DOT_J` (engine/sections.js) when the engineer provides them; whether they apply with a composite topping (PS35-D2).
- Found while checking PR A's design: CTDOT BDM plate 5.2.3 (BIII, BIV; PDF p. 329) shows ONE bottom row of 16 strands at 2 in plus the web columns; the two rows at 2 in and 4 in are plate 5.2.2 (BI, BII; p. 328). The PR A harness design's 4 in row is therefore not on the BIII plate (it fits the 5½ in slab under PS-33's 1.5 in void clearance).
### Other copies
- `Prestressed Bridge Design.html` (frozen) keeps type (k) for boxes and slabs; not changed. `lldf.html` has its own box choices (separate tool); not touched.

## 2026-11-14 — PS-36: the solid deck slabs get the type (f) / (g) live-load distribution factors too; J = A⁴ / (40 I_p) of the rectangle (CALCULATION CHANGE, §4)
PR #1544: https://github.com/mlococo88/All-Structural/pull/1544
### Request
- Engineer decision 2026-11-14 (answer to PS35-D6): the solid deck slabs ('Deck slab 12×48 (solid)', 'Deck slab 18×48 (solid)') switch to the PS-35 type (f) / (g) override. J of the solid rectangle from the AASHTO commentary expression (checked against the 10th Ed. PDF); with a topping, the PS35-D2 composite convention adapted; the same J override and order (entered → library → computed), the same labels, flags and display.
### Problem
- PS-35 left the solid slabs on the moved engine's type (k) equations, with (K_g / 12 L t_s³)^0.1 and t_s = 0 guarded to 1e-6: Deck slab 12×48 (solid), 30 ft, no topping: DF_M 2.6808.
### What changed
- `engine/lldf-fg.js`:
  - `isFG`: Before: `(!!g.isBox || (!!g.isDeck && !g.box.solid && (+g.box.voids || 0) > 0 && (+g.box.voidD || 0) > 0))` After: `(!!g.isBox || (!!g.isDeck && (!!g.box.solid || ((+g.box.voids || 0) > 0 && (+g.box.voidD || 0) > 0))))`.
  - `jOutline`: first, for a solid slab (`g.isDeck && g.box.solid`): h_J = h (no topping) or h + n t_s (topping); A = w h_J, I_x = w h_J³ / 12, I_y = h_J w³ / 12, I_p = I_x + I_y, J = A⁴ / (40 I_p); returns `{ kind: 'solid', h, w, n, ts, comp, hJ, A, Ix, Iy, Ip, J }`.
  - New `kindOf(g)` ('box beam' | 'solid slab' | 'voided slab'), used in the warning, the Loads & LLDF card title ("…, type (g) (PS-35, PS-36)") and the Report §2 note ("Live-load distribution (PS-35, PS-36): solid slab, …").
- `engine/worked.js` `fgSteps`: for `jw.kind === 'solid'` the J steps are `ld.JhJ` (with a topping: h + n t_s), `ld.JA`, `ld.JIx`, `ld.JIy`, `ld.JIp`, `ld.Jc` = A⁴ / (40 I_p) (ref Eq. C4.6.2.2.1-2), in place of the cell steps (`Jtw` … `Jst`), which are wrapped in `else { … }`.
- `ui/loads.js`: TOPICS `fgj` takes the new ids (title "Box beam / slab: I and J (types f / g)", ref Eqs. C4.6.2.2.1-2, C4.6.2.2.1-3); the card title via `kindOf`; the type (k) card's solid-slab sentence removed (no shape reaches it now).
- `engine/fields.js`: `fgShape` includes the solid slabs (the J override card on the Loads tab, "Box beam / deck slab live load distribution (types f / g)"); the J tooltip names both expressions; the dfAuto option "…box beams and deck slabs types f / g".
- `report/builders.js` `fgNotes`: the shape name via `kindOf`, "(PS-35, PS-36)" for a solid slab.
- Tests: `psbridge-lldf-fg.test.mjs` (PS-35 (4): I-girders and NEXT only; (7), (8) updated; new PS-36 (1), (2): the hand checks below, the J steps and pairs, the Report, the J override, the input card); harness B (`psbridge-tab-cases.mjs`): new design "solid deck slab 18×48 with a 5 in topping, 40 ft, 6 slabs" (an intended difference, compared as the PS-35 box designs: the old app's engine with its distFactors wrapped by lldf-fg.js); the harness B design counts 18 → 19 (legacy, strandfit, types, de, denotice, dl, rigid tests).
### Saved data (CLAUDE.md §5)
- None new: the PS-35 field `base.loads.Jfg` now also applies to a solid slab. No key or format changed.
### Governing provisions (CLAUDE.md §4)
- AASHTO LRFD 10th Ed. (2024) Eq. C4.6.2.2.1-2 (J = A⁴ / 40.0 I_p for stocky open and solid sections; checked in the PDF, p. 4-31: Eq. C4.6.2.2.1-1 is J = (1/3) Σ b t³ for thin-walled open sections; the 10th Ed. gives no β b t³ form), and the PS-35 tables (4.6.2.2.2b-1, 4.6.2.2.2d-1, 4.6.2.2.3a-1, 4.6.2.2.3b-1, 4.6.2.2.2e-1, 4.6.2.2.3c-1) in place of the type (k) rows for the solid slabs.
### Check cases (hand; n = 0.8345, d_e = 2.0 ft, no skew, b = 48 in)

| Design | Type | I (in⁴) | J (in⁴) | I / J (simplified 0.54 d/b + 0.16) | k | g_M1 / g_M2 | g_V1 / g_V2 | DF_M before → after | DF_V before → after |
|---|---|---|---|---|---|---|---|---|---|
| 12×48 solid, 30 ft, no topping, N_b 6, interior | g | 6,912 (< 40,000: flagged) | 23,419 (< 25,000: flagged) | 0.29514 (0.29500) | 1.74707 | 0.2823 / 0.3578 | 0.4864 / 0.4800 | 2.6808 → 0.3578 | 0.5203 → 0.4864 |
| 18×48 solid, 40 ft, 5 in topping, N_b 6, interior | f | 45,248 (composite) | 129,362 | 0.34977 (0.36250) | 1.74707 | 0.2550 / 0.3413 | 0.4699 / 0.4704 | 0.5019 → 0.3413 | 0.5203 → 0.4704 |
| same, exterior G1 (e_M 1.1917 / 1.1200; e_V 1.3500 / 1.3162) | f | | | | | | | 0.6000 → 0.3822 | 0.6000 → 0.6343 |

- 12×48: A = 576 in², I_x = 48 × 12³ / 12 = 6,912, I_y = 12 × 48³ / 12 = 110,592, I_p = 117,504 in⁴; J = 576⁴ / (40 × 117,504) = 23,419 in⁴. Terms: (b / 33.3 L)^0.5 = 0.21920, (I/J)^0.25 = 0.73707, g_M1 = 1.74707 × 0.21920 × 0.73707 = 0.2823; (b/305)^0.6 = 0.32973, (b / 12 L)^0.2 = 0.66833, (I/J)^0.06 = 0.92940, g_M2 = 0.3578; (b / 130 L)^0.15 = 0.51704, (I/J)^0.05 = 0.94081, g_V1 = 0.4864; (b/156)^0.4 = 0.62409, (b / 12 L)^0.1 = 0.81751, × 1.0, g_V2 = 0.4800; DF_V = max(0.4864, 0.4800, g_M 0.3578) = 0.4864 (J and I out of range: PS35-D4).
- 18×48 with 5 in topping: h_J = 18 + 0.8345 × 5 = 22.172 in; A = 1,064.28 in²; I_x = 43,601, I_y = 204,341, I_p = 247,942 in⁴; J = 129,362 in⁴. (I/J)^0.25 = 0.76904, (b / 33.3 L)^0.5 = 0.18983 → g_M1 = 0.2550; (b / 12 L)^0.2 = 0.63096, (I/J)^0.06 = 0.93892 → g_M2 = 0.3413; g_V1 = 0.49521 × 0.94883 = 0.4699; g_V2 = 0.62409 × 0.79433 × 0.94883 = 0.4704. Exterior: max(1.1917 × 0.2550, 1.12 × 0.3413) = 0.3822; max(1.35 × 0.4699, 1.3162 × 0.4704) = 0.6343 (higher than the type (k) lever rule's 0.6000: this exterior shear factor INCREASES).
### How verified
- `node tests/engine/run.mjs psbridge tex project-registry`: 24 files, 232 passed, 0 failed (`psbridge-lldf-fg.test.mjs` 10 tests). `node tests/check-syntax.mjs`: all pass.
- Harness B: normal 19 designs, 0 differences, exit 0 (the solid slab design an intended difference: DF_M 0.5019 → 0.3413, DF_V 0.5203 → 0.4704 logged); `--import` 19 designs, 0 differences; `--control` and `--import --control` on the solid slab design: exit 1.
- Smokes: skeleton 271 / 0, types 106 / 0, 3d 101 / 0.
### Decisions (pending engineer review)
- PS36-D1. J of the solid slab: Eq. C4.6.2.2.1-2, J = A⁴ / (40 I_p) of the w × h rectangle (the 10th Ed. has no β b t³ form; Eq. C4.6.2.2.1-1 is the thin-walled open (1/3) Σ b t³). Check: 12×48 gives I/J = 0.2951 against Table 4.6.2.2.1-3's 0.2950; the exact St. Venant value (β ≈ 0.281 for b/t = 4) is 23,307 in⁴ against 23,419 (0.5 %).
- PS36-D2. With a topping (type f): I = the composite I_c (as PS35-D2) and J of the rectangle w × (h + n t_s) (the topping transformed by n on its thickness over the slab width, as the box's top wall in PS35-D2). It gives I/J 0.350 for the 18×48 with 5 in topping (simplified 0.363 on the precast d/b; the slab alone 23,328 / 73,627 = 0.317): composite I/J larger than the slab alone, conservative as PS35-D2.
- PS36-D3. The solid slabs' library width is the nominal 48 in (b = 48 in, as the old library; not the CTDOT 47.5 in actual width). Unchanged.
### Open items
- None new (the DOT J values: PS-35 open item).
### Other copies
- `Prestressed Bridge Design.html` (frozen): type (k) for the solid slabs; not changed.

## 2026-11-14 — Stale "PR n" texts and the Summary's run-together label (display only)
PR #1545: https://github.com/mlococo88/All-Structural/pull/1545
### Request
- Review of 2026-11-14 (PS Bridge catch-up to the Steel Bridge app, item 1): texts that still say a feature "comes in PR 3a" (or another PR) for features that exist now; the Summary's project-overview grid printed "Continuitymade continuous" (label and value touching).
### What changed (text and CSS only; no value, key or format changed)
- `ui/inputs.js` `assumptions(P)` (the Project tab's assumptions, also the Report's §2):
  - Before: `'DC2 (barrier / superimposed) and DW are entered per girder (Loads tab); the Steel Bridge distribution to each girder comes in PR 3a (PS-9).'`
  - After: when `PSBBridgeDL.on(P)`: "DC2 (barriers, sidewalks, superimposed) and DW (wearing surface) are distributed to each girder line from the Cross-section tab by the Steel Bridge app's method (PS-9), shown per line on the Loads & LLDF tab."; else "DC2 (barrier / superimposed) and DW are entered per girder type (Loads tab; Cross-section tab: dead load distribution "Entered per girder type"); the Steel Bridge distribution to each girder line is the other choice there (PS-9)."
  - The no-types branch (a project whose girder types are unreadable): "Every girder × span … come with the bridge level, PR 3a." → "…: this project has no valid girder types. With girder types (Girders & strands tab, PS-8) every type is checked on every line assigned to it."; "One girder spacing and one skew per design until PR 3a: unequal bays and different skews … are input errors for now" → the rule the engine applies now (S = the adjacent bay / the mean of the two bays; the larger |θ|; engine/design.js since PR 3a-2).
- `ui/inputs.js` `designCard` (shown only without girder types): sub-title "one design until PR 3a" → "one design (no girder types)"; the girder tooltip and the note no longer promise PR 3a. `table('base.loads.diaph')` note: "apply to every girder from PR 3a" → "apply to every girder line".
- `index.html`:
  - the output banner `In development (PR 3a-2): … and the Report all of them.` → `In development: … chosen above them; the Summary, the check summary column and the Report cover every girder type on every line.` (the old-app link kept);
  - the Bridge layout tab's Plan placeholder `ph('Plan', '3a', …)` → `ph('Plan', 'planned', ['the framing plan of the girders and supports (not built yet)'])`; `ph()` shows "PR n" only for a number, else the text given.
- `ui/summary.js` `css()`: `#sum-project .kv div{gap:10px} #sum-project .kv div>span:last-child{text-align:right}` (anchor `.sum-gov{margin:8px 0 2px`); the "Not in the Summary" note: "the Drawings, Auto design and 3D view (later PRs)" → "the 3D view (its own tab), the Drawings and Auto design (later PRs, placeholders on their tabs)".
- `ui/section.js` strands card note: "The strand-pattern graphic in the steel style comes with PR 2c." → "The strands are drawn in the section figure above and in the strand-pattern graphic of the Losses tab."
- `ui/analysis.js` continuity card: "worked on the Flexure tab (PR 2c)." → a link `<a href="#" data-gotab="flex">Flexure tab</a>`. `ui/shear.js` worked-steps note: "End zone & hold-down tab (PR 2d)" → a link `data-gotab="end"`.
- `ui/types.js`: "the worst line governs (PR 3a-2)." → "the worst line governs.".
- `engine/fields.js` (tooltips and notes only): "(PR 3a-3, PS-9)" → "(PS-9)" (wBar, wDW, the dead-load note); the d_e note "saved before PR 3a-3" → "saved before the DC2 / DW distribution, 2026-11-13".
- `ui/loads.js` header comment: the DC2 / DW sentence brought up to date.
- Left as they are (genuine future items, labels checked against docs/ps-bridge-plan.md §5): Girder library (PR 4), Auto design (PR 5), Drawings (PR 7), Hand-offs (PR 9), MIDAS demands by file (later PR), the saved-projects sentence of the Project tab (being built in parallel).
### Governing provisions (CLAUDE.md §4)
- None: no formula, factor, unit or reference changed.
### How verified
- See the PR: check-syntax, the engine tests, the three PS Bridge smokes and harness B (normal) unchanged in counts; the Summary screenshot shows "Continuity" and its value apart.
### Decisions (pending engineer review)
- None.

## 2026-11-14 — Loads & LLDF cross-section and the Report's figure: the real girder sections, deck, barriers, traffic faces and d_e (display only)
PR #1547: https://github.com/mlococo88/All-Structural/pull/1547
### Request
- PS Bridge catch-up to the Steel Bridge app, item 2. Draw each line's actual section at its offset: I-girders, bulb-tees, NEXT (both stems), box beams with their voids, voided and solid slabs. Show the deck and haunch, the barriers and sidewalks of `xs.dl`, the traffic faces and d_e of each side, all dimensioned. Use true scale, and keep the Report's figure the same drawing.
### Problem
- `ui/loads.js` `figure()` drew a fixed 1.2 × 3 ft rectangle for every line, with a 0.7 ft deck slab and no barriers or d_e. The Report reuses the tab's drawing as its Figure 4.1.
### What changed
- New `ui/xsfig.js` (`window.PSBXsFig`; loaded after `ui/view3d.js` in index.html):
  - `model(P, s)` (no DOM): the girders of span s from `PSB3DUI.geom(P)`. That gives the cell's engine inputs, `girderGross`, `halfPolygon` and `sectionVoids`, i.e. the shape library's outline and voids. They are mirrored about each line's offset from the left deck edge (`PSBModel.girderOffsets`).
  - The deck t_s (the largest in the span) runs from edge to edge, with its soffit on the deepest girder + haunch. A haunch is drawn over each top flange; boxes and slabs get none, as the engine.
  - Barriers come from `xs.dl.barL/R.bw`, or from `base.deck.bBar` without `xs.dl`. Sidewalks are `xs.dl.swL/R` w × t, measured from the deck edge as `engine/bridge-dl.js dead()` takes them. Lines with no type in the span are listed.
  - Traffic faces and d_e use `PSBDesign.deOf(P, g)` when the project has the cross-section barriers, else the d_e entered for the type on that line.
  - `svg(P, s, W, o)` draws at one scale across and up. The span's sections get their type colours, the line shown is outlined, voids are white, and an absent line is a dashed ℄. Dimensions: the chain of overhangs and bays under the girders, d_e of each side to the dashed traffic face, the deck width, and a t_s / haunch callout. Every item has a hover read-out. `legend(m)` gives the caption.
- `ui/loads.js` `figure(ctx, W)`:
  - Before: `S.rect(0, 0, Wd, t, 'dt-cc'); off.forEach((x, i) => { S.rect(x - 0.6, -hg, x + 0.6, 0, …`
  - After: `const d = window.PSBDesign.sel(ctx.P), q = window.PSBXsFig.svg(ctx.P, d.s, W, { shown: d.g }); return { html: q.svg, nar: q.nar };`
  - The card's title, subtitle, hint and caption are updated; the caption links to the Cross-section and Girders & strands tabs. The Report's Figure 4.1 is the same drawing (`ui/report.js` figures() unchanged).
- Tests: `tests/engine/psbridge-xsfig.test.mjs` (5 tests) checks each outline point against halfPolygon, the voids, the offsets, the deck soffit and haunch, the faces at d_e = deOf, the entered d_e without `xs.dl`, NEXT, box, voided and solid slab, two spans with different shapes, and a missing line. New smoke `tests/smoke/ps-bridge-figures.mjs`: four bridges at 1400 and 390 px, the outlines, voids, the line shown, the d_e labels, the deck label, true scale, the caption, the Report figure, keys and console.
### Saved data (CLAUDE.md §5)
- None: no key or format; the figure reads the project only.
### Governing provisions (CLAUDE.md §4)
- None changed. d_e is shown as the engine takes it (AASHTO LRFD 10th Ed. Art. 4.6.2.2.1; PS-20); nothing is computed for a result.
### Check case
- New project (5 PCI BT-72 at 9 ft, overhangs 3 ft, barriers 1.75 ft): d_e = 3 − 1.75 = 1.25 ft at G1 and G5 (deOf). The deck is 42 ft by 8 in, the haunch 2 in over the 42 in top flange. The drawn deck's width / depth ratio is 42 × 12 / 8 = 63.0 (true scale).
- With a 6 ft × 12 in right sidewalk and a 3 ft overhang: the face is at the curb, 6 ft in, so d_e = 3 − 6 = −3.00 ft (the girder ℄ is outside the face). The figure shows it.
### Decisions (pending engineer review)
- XS-D1. The barrier height (32 in) and its profile (the inner face sloped) are schematic: the project stores only the width at the deck (= the traffic face). The caption says so.
- XS-D2. The section drawn is the span of the line shown on the output tabs (`PSBDesign.sel`), looking ahead. Other spans are drawn when another line is chosen.
- XS-D3. A sidewalk runs from the deck edge (x 0 … w), as `engine/bridge-dl.js` loads it, with the barrier drawn on top of it at the edge. The 3D view (ui/view3d.js) places the sidewalk inside the barrier instead. That is display only, and was left as it is (one tool per change; noted here).
### Other copies
- None.

## 2026-11-14 — Bridge layout: framing plan, span / skew / bay rows, equal spacing, girder type of each line (display and input only)
PR #1548: https://github.com/mlococo88/All-Structural/pull/1548
### Request
- PS Bridge catch-up to the Steel Bridge app, item 3:
  - a true-scale skewed framing Plan card in place of the placeholder, with a ×2 width option and links to the related tabs;
  - row inputs (shared/list-input.js) for the spans and skews in place of the comma text fields, with the saved format unchanged;
  - an equal-spacing mode (W_cc), with its worked step;
  - a "Girder type of each line" table on the Cross-section tab;
  - §5: a Node test that an old saved project round-trips unchanged.
### What changed
- New `ui/plan.js` (`window.PSBPlan`):
  - `model(P)` takes every position from `PSB3DUI.geom(P)` (the 3D view's numbers): girder lines from ℄ bearing to ℄ bearing (girder ends thinner), skewed support lines from deck edge to deck edge at x = station + (z − z_mid) tan θ, diaphragms at a from each line's left ℄ bearing (none between adjacent units), and continuity diaphragms on the pier lines of spans made continuous.
  - `svg(P, W, { vex })` draws one scale across and up. With "Width ×2" the angles are not to scale and θ labels the true skew. Labels: Abut. / Pier names, θ, "Span n: L ft", the bays (or the deck width where the bays are too close to label), and G1 … Gn (G1 and Gn only where the lines are too close).
  - `mount(slot, P)` is a detail card with True scale / Width ×2. The choice is kept for the page session only and is not saved, as Steel's.
  - `card(P)` holds the links to the Cross-section, Girders & strands, Diaphragms / deck, 3D view and Loads & LLDF tabs.
- New `ui/lists.js` (`window.PSBListsUI`), a COPY of apps/steel-bridge/ui/lists.js with this app's selectors: `[id="i_spans.lengths"]`, `[id="i_xs.skews"]`, `[id="i_xs.bays"]`.
  - The page's `<input data-kind="list">` stays, hidden, holding the text "a, b, c" that the page's own `parseList` reads, so the arrays are stored as before.
  - One change from the copy, in `bind()`'s focusout: when the page was redrawn before the deferred commit ran (a click on an input tab), the edit is committed through the input of the same id. Before, it was lost.
- `index.html`:
  - Scripts: `../../shared/list-input.js`, `ui/lists.js`, `ui/plan.js`.
  - Bridge layout tab: `ph('Plan', …)` → `planCard()`. The list notes say "One row per …". The list units are now in the table headers, so `list(…, '')`.
  - Cross-section tab: `sel('xs.spMode', 'Girder spacing', [individual, equal])`. In equal mode, `equalRows()` (W_cc, the step `xs.eqS` S = W_cc / (N_b − 1), the deck width out to out) replaces the bay list.
  - New card `lineTypeCard()`: a select per line and span (`data-lt="s|g"`) → `BR.assignLine(P, k, g)`, the same data as the Girders & strands line boxes. A line keeps a type once it has one, as the boxes.
  - Change handler: `xs.spMode` to equal sets `xs.Wcc` = Σ bays, then `M.applyEqual(P)` runs on every change.
  - `drawInputs()` mounts the plan on the Bridge layout tab.
- `engine/model.js`:
  - `equalSpacing(xs)`, a byte-for-byte COPY of apps/steel-bridge/engine/model.js equalSpacing;
  - `applyEqual(P)`;
  - `validate()`: `xs.spMode` must be individual / equal; in equal mode `xs.Wcc` > 0 and N_b ≥ 2;
  - the header documents `xs.spMode` / `xs.Wcc`.
- `ui/inputcheck.js`: the steel app's list handling (`isList`, `cellIn`). An error on `xs.bays.1` marks and focuses that row's cell of the table.
- Tests:
  - `tests/engine/psbridge-layout.test.mjs` (4 tests; see below). `psbridge-model.test.mjs` has the script list updated.
  - The skeleton and types smokes now set the three lists through their hidden input (`setList`). The skeleton smoke's "error link opens the field" now expects the bay's row cell of the table.
  - `ps-bridge-figures.mjs`: the plan (lines, continuity diaphragm, diaphragms, labels, ×2, not saved), a span typed into its row, + Add, equal spacing, back to individual, and the girder type of each line.
### Saved data (CLAUDE.md §5)
- The stored fields and formats are unchanged: `spans.lengths`, `xs.skews` and `xs.bays` stay arrays of numbers. The row tables write the same text into the page's input, and the page parses it as before.
- New optional fields `xs.spMode` ('individual' | 'equal') and `xs.Wcc` (ft). Absent means individual bays, today's behaviour. They change no result by themselves: in equal mode the page writes S into every `xs.bays` entry, which everything reads as before.
- No new key. The ×2 choice is not stored.
- Test (§5): an old project (no spMode / Wcc; two spans made continuous, unequal bays, different skews, girder types) gives the same text through save → load → export and import → export. The list tables give back the same arrays through the page's parser, and `applyEqual` changes nothing. There is no new input error, and every cell's engine inputs are the same.
### Governing provisions (CLAUDE.md §4)
- None changed. Equal spacing only writes the bays the engineer would otherwise type: S = W_cc / (N_b − 1), the Steel Bridge app's definition. No formula of a result changed.
### Check case
- N_b = 5, W_cc = 38 ft: S = 38 / 4 = 9.500 ft, so bays [9.5, 9.5, 9.5, 9.5]. With overhangs 3.5 / 3.0 ft, the deck is 44.50 ft out to out. N_b = 4, W_cc = 40 ft: S = 13.333 ft.
### Decisions (pending engineer review)
- LAY-D1. Plan diaphragms: drawn as the 3D view places them (at the entered a from each line's left ℄ bearing, parallel to the supports, across the bays next to a line whose type has one; none between adjacent boxes, slabs or NEXT beams). End diaphragms at the bearings are not drawn, because the project has no input for them.
- LAY-D2. "Width ×2" is always offered (Steel offers its exaggeration only for a long, thin plan). The choice is not saved, as Steel's.
- LAY-D3. Girder type of each line: a line that has a type can only be moved to another type of its span, not left without one, as the Girders & strands line boxes.
- LAY-D4. Equal spacing: back to individual keeps the bays as written. A change of N_b in equal mode rewrites every bay to the new S, as Steel.
### Other copies
- `ui/lists.js` and `engine/model.js` `equalSpacing` are copies of the Steel Bridge app's, to move to shared/ later (CLAUDE.md §3). The focusout fix in `ui/lists.js` is not in the steel copy, which has the same race; that tool was not changed.

## 2026-11-14 — Summary "Cross-section and plan" card; the Report's framing plan in §2 (display only)
PR #1549: https://github.com/mlococo88/All-Structural/pull/1549
### Request
- PS Bridge catch-up to the Steel Bridge app, item 4:
  - near the top of Summary, the whole-bridge cross-section (item 2) and the framing plan (item 3), stacked at full width with a height cap like Steel's;
  - each figure links to its input and output tabs;
  - the same figures in the Report where sensible, with a "see §" link.
### What changed
- `ui/summary.js`:
  - `gfxBox(o)`, written between the verdict and the project overview: card `#sum-gfx` "Cross-section and plan". Each figure has its caption links: Cross-section and Girders & strands input tabs and the Loads & LLDF output tab for the section; Bridge layout, Cross-section and Diaphragms / deck input tabs and the 3D view for the plan.
  - New `after(el, o)` draws them at the card's width: the section of the span shown (`PSBXsFig.svg`, G<line> outlined) as a detail card, and the plan through `PSBPlan.mount`, both with `maxH` = the steel Summary's cap `max(360, min(760, 0.8 × window height))`.
  - CSS for `#sum-gfx`.
- `index.html` `drawOut()`: after `$('out').innerHTML = h`, the Summary tab calls `PSBSummaryUI.after($('out'), { P })`.
- `ui/plan.js`:
  - `mount(slot, P, o)` passes `o.maxH` to `svg()`;
  - the bay labels: the bays are labelled when they all have room, and an overhang too short for its label gets the tick only (before: one short overhang dropped every bay label).
- Report:
  - `ui/report.js` `planFig(P, wScr)` draws the plan at 700 px, plus a copy at the screen width on a narrow screen, as the tabs' figures.
  - It goes to `PSBReportBuild.model(B, { …, planFig })`. `report/builders.js` `proj()`, subsection "Bridge and the design girder", gets the figure (Figure 2.1) and a note: the plan's legend, then "The cross-section of each worked girder's span, with the girder sections, barriers and d_e: see [[rs.lds]]" (the Loads & LLDF section's figure).
  - Nothing is added in Node (no drawing code). The section numbers and the numbers compared by harness B are unchanged.
- Tests: `tests/smoke/ps-bridge-figures.mjs` checks:
  - the card above the overview; one section per cell of the span and one plan line per cell; heights within the cap, full width;
  - the six links, the cross-section link opening Loads & LLDF with its figure, and the plan link opening the Bridge layout tab with its plan;
  - Report §2 has "Figure 2.1: Framing plan" with 10 lines and the "see §4" reference.
### Saved data (CLAUDE.md §5)
- None. The ×2 choice of the plan is shared with the Bridge layout tab's for the page session (not saved).
### Governing provisions (CLAUDE.md §4)
- None changed.
### Decisions (pending engineer review)
- SUMG-D1. The Summary's cross-section is the span of the line shown on the output tabs (as on Loads & LLDF). With several spans, the other spans are drawn when another type or line is chosen.
- SUMG-D2. The Report shows the plan once, in §2 (Project, basis and assumptions), and refers to the existing cross-section figure of the Loads & LLDF section (§4, one per worked girder) rather than drawing it twice.

## 2026-11-14 — Loads & LLDF: lanes, wheels and the lever-rule influence line, with an LLDF case switch (display only)
PR: (link below)
### Request
- PS Bridge catch-up to the Steel Bridge app, item 7:
  - on the Loads & LLDF sketch, a case switch like Steel's (lever rule one lane / multi-lane / rigid section, where the engine uses each);
  - the wheels placed by the lever-rule placement the engine uses;
  - a required Node test that the drawn ordinates and wheel positions reproduce the engine's lever value (with m as the engine applies it) for several layouts;
  - types (f) / (g): no wheels, with a note.
### What the engine does (read from engine/pbd-lldf-flexure.js distFactors, frozen; not edited)
- Exterior I-girder (`ld.pos === 'exterior'`), one lane:
  - `[de-2, de-8].forEach(x => { if (x > -S) R += 0.5*(S+x)/S; }); lever = 1.2*R`;
  - x is the wheel's distance outboard of the exterior girder ℄; the wheels are 2 ft and 8 ft inboard of the traffic face; S = the line's S (the adjacent bay).
- Rigid section: `e_j = Xext + de − 5 − 12 j`, `R = mpf[NL−1] (NL/Nb + Xext Σe/Σx²)`, the largest over NL = 1 … ld.NL. With unequal bays, PS-19 `engine/rigid.js` uses the real lines.
- Two or more lanes: `e_M g_M2` / `e_V g_V2` (equations: no wheel placement).
- Not used: interior lines (equations), NEXT (`isNext`: no lever, no rigid), box beams and slabs (`df.fg`, PS-35: neither).
### What changed
- `ui/xsfig.js`:
  - New `lldf(P, s, g, inp, df)`: the model of line g's cases from the engine's own inputs (`inp.S`, `inp.loads.de`) and results (`df.rigidNL`, `df.rigidX`):
    - lever case: the traffic face d_e outboard of the girder; wheels at 2 and 8 ft inboard of it; terms `{ xo, ord = (S + xo)/S if xo > −S else 0 }`; value = 1.2 Σ 0.5 ord;
    - rigid case: N_L = df.rigidNL lanes of 12 ft from the face; resultants 5 ft inside each lane; e_j from the girder centroid (the lines, or df.rigidX); value = m (N_L/N_b + X_ext Σe/Σx²);
    - kind 'int' / 'next' / 'fg' with a note and no case.
  - `svg(…, { ll })` + `drawLL()`: the lanes and wheels (arrows to the deck) above the barriers, with the d_e and deck dimensions moved up. For the lever case, the exterior girder's influence line under the chain (1.0 at the girder, 0 at the next girder, the ordinates at the wheels, a hover read-out each). For the rigid case, the lane resultants (brown ticks) and e in the lane labels. The Steel Bridge app's lldfSvg layout.
- `ui/loads.js`:
  - `after()`: the detail card gets the "LLDF case" switch (Lever rule, one lane / Rigid section, N lanes) for an exterior I-girder line. The choice is kept for the page session, not saved.
  - Caption `#ldLLNote`: the worked comparison, e.g. "g_lever = 1.2 × 0.5 × (1.0000 + 0.2941) = 0.7765 = the engine's 0.7765 §ld.lever"; for the rigid case, R with e, X_ext, Σx² against `df.rigid` §ld.rigid. For other lines, the note why there are no wheels.
- `ui/report.js`: `ALLSEG` adds `gfx_ld`. For an exterior unit the Report's Loads & LLDF section draws the cross-section in each case (Figure 4.1 lever rule, 4.2 rigid section). Interior units are unchanged.
- Tests:
  - New `tests/engine/psbridge-lldffig.test.mjs` (5 tests), checked against `PSBHoldDown.compute` of each line:
    - the face, the wheels (2 / 8 ft, 6 ft apart) and the next girder at S;
    - each ordinate, and m Σ 0.5 ord = df.lever with m = 1.2;
    - N_L = df.rigidNL, the resultants, and R from the drawn resultants = df.rigid.
  - Layouts: equal bays G1 and G5; unequal bays (PS-19) on both sides with N_L up to 3; a 6 ft × 12 in sidewalk (d_e = −3, the second wheel not counted); a 2.5 ft barrier; no cross-section barriers (the entered d_e) with N_L = 1; interior lines, NEXT and box beams (no case).
  - `ps-bridge-figures.mjs`: the switch, the wheels and influence line, the caption value = the engine's, the rigid lanes, G5 on the sidewalk side, interior G3 (no case), and Report §4 holding both cases.
### Saved data (CLAUDE.md §5)
- None.
### Governing provisions (CLAUDE.md §4)
- None changed. The figure draws the engine's own placement (AASHTO LRFD 10th Ed. 4.6.2.2.2d lever rule, m = 1.2 of Table 3.6.1.1.2-1; C4.6.2.2.2d rigid section). Its values are recomputed only to show that they equal the engine's, which the test checks.
### Check case (new project, 5 BT-72, bays 8.5 / 9.5 / 9.5 / 8.5 ft, overhang 3.5 ft, d_e = 2.00 ft, G1)
- Lever: x_w = 0.00 and −6.00 ft; ordinates (8.5 + 0)/8.5 = 1.0000 and (8.5 − 6)/8.5 = 0.2941; g_lever = 1.2 × 0.5 × 1.2941 = 0.7765 (the engine's 0.7765).
- Rigid, 2 lanes: e = 18 + 2 − 5 = 15.000 and 3.000 ft; Σx² = 2 × 18² + 2 × 9.5² = 828.50 ft²; R = 1.00 (2/5 + 18 × 18 / 828.5) = 0.7911 (the engine's 0.7911).
### Decisions (pending engineer review)
- LL-D1. No "multi-lane" lever case: the engine's two-or-more-lane exterior factor is e × g_interior (equations, Table 4.6.2.2.2d-1), with no wheel placement to draw. The switch offers only the cases the engine uses: lever (one lane) and rigid section (its governing N_L).
- LL-D2. In the rigid case the lanes are drawn from the traffic face with each lane resultant 5 ft inside its lane edge. This is the engine's e_j = X_ext + d_e − 5 − 12 j: the wheel pair 2 ft and 8 ft inside each lane. The engine places no wheels for it; the wheels drawn are those the resultant implies.
- LL-D3. The case choice is per page session (not saved). The Report shows both cases for an exterior unit.
- LL-D4. DXF download of the figure: not done (optional in the request). shared/dxf.js would need a second drawing of the same figure in CAD primitives.
