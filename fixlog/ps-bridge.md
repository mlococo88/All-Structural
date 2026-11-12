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
