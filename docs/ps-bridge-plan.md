# PS Bridge (`apps/ps-bridge/`): plan (revised with the engineer's decisions of 2026-11-12)

**Status:** approved direction (engineer, 2026-11-12, decisions PS-1 to PS-14 below). Phases 1–3 are being built as small PRs; the girder library and auto-design wait for the engineer's standard sheets. This plan supersedes `docs/prestressed-rebuild-plan.md` (2026-11-02, `apps/prestressed/`, module-by-module rewrite); that plan's §9 (saved data, "From old app") and §9.4 (hand-off table) are reused here.

**Rules:** CLAUDE.md §1–§9. Code basis: AASHTO LRFD 10th Ed. (2024); MBE 4th Ed. (2026) (label change in its own PR, below). Every assumption is a note in its tab and in the Report; every value is worked and linked (§6).

**In one paragraph:** a new folder app `apps/ps-bridge/` that **looks and works like the Steel Bridge app everywhere** (input and result tabs, check-summary column, splitter, Summary, Report, Drawings, 3D, written the steel app's way: plain classic-script JS, one `window.PSB*` namespace per file, graphics in the steel app's style). **Only the prestressed calculation code moves in unchanged**, and it is proven identical to today's `Prestressed Bridge Design.html` (PSBD) in Node. The old React/Babel tabs are **not** carried over: every PS graphic (strand pattern, stress diagrams, losses, camber, …) is redrawn in the steel style. The bridge level (girders × spans, unequal bays, the steel app's DC2/DW distribution) is new and is a §4 change against the old app where it applies.

---

## 1. Inventory (anchors read at `origin/main` @ `2590738`; line numbers approximate)

### 1.1 Steel Bridge app (`apps/steel-bridge/`, SBD2) — the pattern
- `index.html`: shell CSS (two scrolling panels, `#sbDashCol` check summary from 1200 px, `#sbSplit` splitter from 900 px, stacked below 900 px), the inline UI controller; scripts written by a `document.write` loop with a `?v=<lastModified>` cache-buster (CBUST, `:20-113`). Libraries: KaTeX 0.16.9 (cdnjs), three.js r128 + OrbitControls 0.128.0 (`:91-92`). No React, Babel or Plotly.
- `engine/` (no DOM): `model.js` (`sbd2.project` v1, `KEYS` `:145`, `validate`/`migrate`/`importJSON`/`save`/`load` with backup of an unreadable project `:441-478`), `library.js`, `legacy.js`, `loads.js` (DC2/DW distribution), `lldf.js` (adapter to `shared/lldf.js`), `analysis.js`, `autodesign.js`, `drawings.js`, `sheets.js` (`shared/dxf.js`), …
- `ui/`: one file per output tab; `dash.js`, `splitter.js`, `sub.js`, `inputcheck.js`, `summary.js`, `handoffs.js`, `bridgexfer.js`; graphics kit `graphics.js`, `vizkit.js`, `gfxdet.js`, `vizalong.js`, `alonggfx.js`, `gfxa.js`; `view3d.js`, `detail3d.js`. `report/`: `data.js`, `builders.js`, `summary.js` on `shared/report.js` + `shared/steps.js`.
- Input tabs (`index.html:372`): Project · Bridge layout · Cross-section · Girders & plates · Materials · Framing & bracing · Loads · Stiffeners · Fatigue & studs · Splices · Auto design. Output tabs: Summary · Section properties · Flexure · Loads & LLDF · … · Report · Drawings · Auto design · 3D view.
- Tests: `tests/engine/run.mjs`, `harness.mjs` `loadShared()` (classic scripts in a Node vm, page order); parity against the old app's own code from its HTML text (`gd-source.mjs`).
- Listed in `tools.html` from its first PR (#465) as "(new, in development)", "Not for design use yet".

### 1.2 Prestressed Bridge Design (`Prestressed Bridge Design.html`, PSBD, 9,759 lines)
- Libraries: React 18.2.0, Babel-standalone 7.23.5, Plotly 2.27.0, KaTeX 0.16.9. Shared: `steps.js`, `report.js`, `list-input.js`, `projects*.js`, `github-sync.js`, `bridge-suite-projects.js`.
- Plain scripts: bridge-suite bootstrap blocks `:514-1852` (BridgeBeam, MCT demands, `geometryChanges`, BridgeProjects, BridgeApps, BridgeLocks, BridgeXfer, `superReactions` glue; duplicated in `index.html` and `lldf.html`, CLAUDE.md §3); **`window.PBD` `:1901-2421`** (bridge model `psbeam.bridge.v1`, `applyBridge` `:2015`, `withSpans` `:2029`, `MODS` `:1931`, `sgBeam`/`threeMoment` `:2237`/`contFE` `:2257`/`restraint` `:2287`, `OWN_RULES` `~:2300-2378` incl. `hd.max` `:2347-2350`, `ownLoads` `:2379-2420`).
- Babel block, **engine part `:2429-4629`** (no JSX, no DOM): `GIRDERS` `:2430`, `STRANDS` `:2472`, `DEFAULTS` `:2489` (`harp:{n,yEnd,yMid,frac:0.40}`, `cont`, `loads`, `opt`, …), section `:2537-2773`, `strandSys` `:2775` (harp `:2786`, `frac·L`), `losses` `:2873`, `hl93` `:2917`, `negMomentHL93` `:2944`, `handlingCalc` `:2967`, deck `:3026-3160`, `distFactors` `:3161`, `flexure` `:3242`, `buildExternal` `:3300`, `bxSuperRxPayload` `:3370`, `contUnit` `:3420`, **`computeAll` `:3428-4508`** (release `:4385-4387`, Service III `:4391`, flexure `:4393`, shear `:4395`, hold-down `F_hd = 2 n_h f_pbt A_b sin α ≤ 0.75 W` `:4438-4446`, rating `~:4271`), `psbReportVals` `:4509`, `optimizeStrands` `:4575`, `sweepDesign` `:4611`.
- UI part `:4630-9751` (JSX; **not carried over**, used only as the reference for what each tab shows): `PSB_TABN`/`psbGoto` `:4752-4805`, `CrossSection` `:4915`, `Elevation` `:5057`, `Rebar3D` `:5127`, `InputsTab` `:5634`, result tabs `SectionTab` `:6489` … `DiagramsTab` `:8035`, report `psrModel` `:8210` (MBE "edition: verify" `:8596`), persistence `:8742-8800` (`mergeInputs` `:8798`), `App` `:9073`.
- Keys (read only for the new app): `psbeam.inputs.v1`, `psbeam.bridge.v1`, `psbeam.ui.v1`, `psbeam.inputTab.v1`, `psbeam.fold.*`, `psbeam.projects.v1`, slices `psbeam`/`psbeamBridge` of `bridgeSuite.v1.projects`, `psbeam.redirect.offered.v1`.
- Hand-offs (app id `psbeam`): receives `lldf`, `dlLoads`, MCT demands, `designBeam`/`beamRoster`, `geometryChanges`; sends `lldfGeom`, `psSection`, `capacity`, `superReactions` (+`by.psbeam`), `projectMeta`.
- Tests: `tests/ps-compare.mjs` (browser A/B, 38 cases: `defaults` + `tests/projects/ps/*.json`, baseline `tests/baselines/ps.json`). Fixlog: `fixlog/Prestressed Bridge Design.md`.

---

## 2. Target app

### 2.1 Files
- `apps/ps-bridge/index.html`: the SBD2 shell, the CBUST `document.write` loader, KaTeX 0.16.9 and three.js r128 at the steel app's pins (no new library).
- `engine/` (no DOM): `model.js` (`psb2.project`), `library.js`, `legacy.js` ("From old app"), `bridge.js` (girders × spans, phase 3), `autodesign.js`; **`pbd-*.js`: the PSBD engine moved in unchanged** (§3).
- `ui/`: steel-style input panes and one file per output tab; `dash.js`, `splitter.js`, `inputcheck.js`, `summary.js`; the graphics kit copied from the steel app (`vizkit.js`, `gfxdet.js`, `vizalong.js`, …) and the PS graphics drawn with it; `view3d.js`.
- `report/`: steel-style builders over `shared/report.js` + `shared/steps.js`.
- Namespaces: new code `window.PSB*` (one per file); the moved engine keeps its own globals (`computeAll`, `GIRDERS`, …) and `window.PBD`, exactly as in the old page.
- Steel pieces are **copied, to move to `shared/` later** (CLAUDE.md §3), each with a header naming its source; listed in each PR and in `fixlog/ps-bridge.md`.

### 2.2 Input tabs
| Tab | Contents |
|---|---|
| Project | Save and open, title block, assumptions list, hand-offs card (at switch-over) |
| Bridge layout | spans, continuity (simple / made continuous for composite loads, PS-7), skews, age at continuity, plan |
| Cross-section | girder count, **bay widths (unequal allowed, PS-9)**, overhangs, deck t_s, haunch, b_eff, barriers, sidewalks, DW |
| Girders & strands | per span: shape (same for all girders of a span), interior and exterior design (PS-8), optional per-girder override; strand rows, **draped strands** (n, y_end, y_mid, hold-down at frac × L, PS-5/PS-13), debonding; stirrups, confinement, splitting and release steel, pier top bars; strand-pattern graphic |
| Materials | f′ci, f′c, w_c, H, ages, strand grade, jacking, loss method |
| Diaphragms / deck | diaphragms entered once (PS-14), deck design on/off (strip method as today, PS-14) |
| Loads | DC2/DW (steel distribution, PS-9), LLDF, live load, MIDAS/external demands (by file before switch-over), rating vehicles, handling |
| Owner rules | owner (AASHTO / MassDOT / CTDOT / RIDOT), η, release limit factor, exposure, **hold-down check box (PS-10)** |
| Auto design | settings and Run (§4) |

### 2.3 Output tabs (steel style, each with worked steps and § links)
Summary · Section properties · Loads & LLDF · Analysis (M/V envelopes, continuity, restraint) · Losses · Stresses · Flexure · Shear · End zone & hold-down · Camber & deflection · Handling · Deck · Rating · Report · Drawings · Auto design · 3D view.

### 2.4 Saved data (CLAUDE.md §5)
```
{ schema:'psb2.project', version:1,
  project:{ name, number, owner, designer, checker, date, notes },
  spans:{ lengths:[ft], continuity:'simple'|'composite' },          // 'composite' = today's cont.on (5.12.3.3)
  xs:{ nb, bays:[ft], ohL, ohR, skews:[deg] },                        // SBD2 field names
  base:{ <a psbeam inputs object, DEFAULTS shape> }                    // PR 2a on
  groups / cells:{ 'G<g>/S<s>':{ ovr, locks } }, autodesign, legacy }  // PR 3a on
```
- Keys: `psb2.project.current`, `psb2.project.unreadable.<ISO time>`, `psb2.ui`, `psb2.lib.index`, `psb2.lib.p.<id>`, `psb2.lib.current`, per-browser UI keys `psb2.splitRatio_v1`, `psb2.dashCollapsed_v1`. `psb2.` is unused elsewhere in the repo.
- Every `psbeam.*` key is read only ("From old app"), never written or deleted.
- One mapping feeds the engine: `cellInputs(P, g, s) = mergeInputs(base ⊕ cell override)`, then the bridge-driven fields (L, S, nGirders, position, continuity, DC2/DW, DF) are set by `engine/bridge.js`. The engine only ever sees today's input format.

---

## 3. Engine move (PR 2a): moved, not rewritten
1. Text slices of PSBD at a pinned commit become classic scripts, **byte for byte**, each with a header naming its source range: `pbd-model.js` (`:1901-2421`), `pbd-library.js` (`:2429-2536`), `pbd-section.js` (`:2537-2773`), `pbd-strands.js` (`:2774-2871`), `pbd-losses-ll.js` (`:2872-2965`), `pbd-handling-deck.js` (`:2966-3160`), `pbd-lldf-flexure.js` (`:3161-3295`), `pbd-external.js` (`:3296-3427`), `pbd-compute.js` (`:3428-4571`), `pbd-optimize.js` (`:4572-4629`). A verbatim test asserts each body equals its slice.
2. **Node parity harness A** (`tests/engine/psbridge-parity.test.mjs`): context A = today's PSBD from `git show <pin>:…`, Babel block transpiled with `tests/libs/babel-standalone@7.23.5` (presets env + react, as the page does); context B = the `pbd-*.js` files by `loadShared()`. Compared per case with **tolerance 0** (NaN, ±∞, −0 kept): `computeAll` result, checks, warnings, error, `psbReportVals`, `bxSuperRxPayload` (time stamps normalised), `optimizeStrands`/`sweepDesign` (subset), `PBD.contFE`/`restraint`/`migrate`/`applyBridge`. Cases: the 38 recorded + about 600 seeded (every shape × spans, interior/exterior, losses method, 4 owners, continuity 2–4 spans with/without restraint, draped n_h 0–16, frac 0.30–0.50, debonding, release steel, MIDAS, rating vehicles, handling, deck) + edge cases.
3. Known non-identity to prove, not assume: today runs Babel ES5 output (`**` → `Math.pow`, `const` → `var`, spread → `_objectSpread`); the new app runs the text natively. Any difference is reported with its cause, not "fixed".
4. From PR 2a on, the old PSBD is **frozen** (bug fixes only on request, PS-14); the pin moves only with a harness rerun.
5. **Done in PR 2a (2026-11-12, PR #1448):** pin `8fe8650275b7fc7377fdb87685d3bf0d669a4aa8` (PSBD blob `00a3a34`, last changed in #916). Slices as in 1., with the window.PBD body at `:1902-2420` (inside its tags) and one more, `pbd-merge.js` = `mergeInputs` `:8796-8813` (for `model.base`). Pin and slices: `tests/engine/psbridge-source.mjs`; tests `psbridge-verbatim.test.mjs`, `psbridge-parity.test.mjs` (cases `psbridge-cases.mjs`: 38 recorded + 600 seeded + 20 edge): **0 differences**, also with the moved files run in strict mode as the Babel output is. **The old app is frozen from this PR on** (PS-14 g; `fixlog/Prestressed Bridge Design.md`).

**Tabs and graphics (PRs 2b–2e):** every number on a new tab comes from `computeAll` (no second calculation); the worked steps substitute those values and a test asserts each step's result equals the engine value. A browser harness B (`tests/psbridge-compare.mjs`, `ps-compare.mjs` style) compares, case by case, the values shown on each new tab and the Report with the old app's values for the same inputs, and checks every `psbeam.*` key is byte-identical before and after the new app opens.

---

## 4. Auto design (PR 5; draped strands; PS-1, PS-5, PS-10–PS-12)
- Per design group (interior / exterior per span, PS-8), section fixed; the same `computeAll` as the tabs (a test asserts equal ratios). Locked fields (`pattern`, `draped`, `fci`, `fc`) are never overwritten; Apply writes unlocked fields, with Undo.
- **Step 1, strand count:** all straight, at the entered f′c/f′ci; add strands in **symmetric pairs** unless the sheet's fill order says otherwise (PS-12) until Service III tension and Strength I flexure pass everywhere; grid full → "section too small".
- **Step 2, draping for release stresses:** convert harpable web positions to draped strands (n_h = 2, 4, …); two symmetric hold-down points at frac × L measured from ℄ bearing (PS-13), frac searched **0.33–0.45, default 0.40** (PS-5); y_end on the grid. Constraint **F_hd = 2 n_h f_pbt A_b sin α ≤ 0.75 W**: MassDOT 3.7.2.2 / CTDOT V2 5.9.1.6 always; **AASHTO / RIDOT: optional box, default ON, limit 75 % of beam weight editable** (PS-10). Preference: fewest draped strands, then lowest F_hd/limit, then frac nearest 0.40. Rerun step 1 after draping.
- **Step 3, f′ci then f′c:** lowest values passing release, then service/strength, in **0.5 ksi steps** from the entered f′c; f′ci ≤ f′c; cap = owner max or 10 ksi; editable plant f′ci max (PS-11). Full rerun per change; steps 1–3 iterate at most 3 times.
- **Debonding: never added** by auto-design; entered debonding kept (PS-12).
- Output (tab and Report "Auto design basis"): per group N, n_h, y_end, y_mid, frac, F_hd/limit, f′ci, f′c, governing check and ratio, trial log, § links; every assumption as a note.

---

## 5. Phases and PRs
Every PR: `fixlog/ps-bridge.md` entry, tests, only `apps/ps-bridge/` + its tests/docs until switch-over (old app unchanged).

| # | PR | Gate / notes |
|---|---|---|
| 1 | **Skeleton:** folder, shell (panels, check-summary column, splitter, stacked phone layout), input tabs and output tabs with placeholders, `engine/model.js` (`psb2.project` v1: project, spans, xs; validate/migrate/save/load with backup), model test, `tools.html` card "(new, in development)" | no calculation |
| 2a | **Engine moved in** (`pbd-*.js` verbatim) + verbatim test + Node parity harness A (38 + ~600 cases); `model.base` = `DEFAULTS` via `mergeInputs`; `computeAll` time measured | 0 differences |
| 2b | Input tabs wired to `base` (one design), input checks; Section properties, Loads & LLDF and Analysis tabs, steel style | values = engine values |
| 2c | Losses, Stresses, Flexure, Shear tabs; strand-pattern and stress graphics in the steel style | harness B values. **Done: 2c-1 (#1456: Losses, Stresses, strand pattern, chips; harness B `tests/psbridge-compare.mjs`) and 2c-2 (Flexure incl. pier section and positive moment connection, Shear)** |
| 2d | End zone & hold-down, Camber & deflection, Handling, Deck, Rating tabs | harness B values. **2d-1 (#1458: End zone & hold-down, Camber & deflection, chips) and 2d-2 (Handling, Deck, Rating, chips; Rating keeps the old app's MBE labels, the MBE 4th Ed. labels are PR 6) done**; **2d-3 the PS-10 hold-down check for AASHTO / RIDOT done** (engine addition `engine/holddown.js`, §4; `base.opt.hdCheck` / `hdFrac`, default on / 0.75) |
| 2e | Report (steel builders; every value = `psrModel` value) + browser harness B on all cases | harness B report. **Done (PR 2e): the Report tab (`report/fromtab.js`, `data.js`, `builders.js`, `ui/report.js` on `shared/report.js`): summary of checks, project / basis / assumptions, every result tab's cards and worked steps; harness B on the Report and the old app's own report, 0 differences on 16 designs**. Display (engineer, 2026-11-13): the owner material limits (f′c, f′ci) as the check-summary chip "Materials (owner limits)", counted in the totals, opening the Owner rules table; Report §1 counts the same. Report graphics (2026-11-13): each result tab's graphics in its section, drawn by the tab's own code, numbered Figure n.m, printed at the page width |
| 2f | **From old app**: `engine/legacy.js` reads `psbeam.inputs.v1`, `psbeam.bridge.v1` (every cell), old Export JSON, Bridge Suite slices — read only | old keys untouched (test) |
| 3a | **Bridge level:** girders × spans, interior/exterior groups per span + per-girder override (PS-8), continuity as today (PS-7), **unequal bays and the steel app's DC2/DW distribution and LLDF fed through the engine's existing inputs (S, DC2/DW, DF) — §4 callouts with worked check cases where results differ from the old app (PS-9)**; parity with old 'pl' mode where the inputs are the same | §4 PR |
| 3b | Summary tab and check-summary chips (girder × span grid), run all (chunked, Stop) | display |
| 3c | 3D view (three.js r128, steel `view3d` pattern) | display |
| 4 | Girder library from the engineer's sheets (NEBT/NEDBT/NEXT/box: properties, strand grid, harpable positions, fill order), additive to `GIRDERS` | **waits for sheets** (PS-2); §4 (new data) |
| 5 | Auto design (§4) | waits for 4 |
| 6 | MBE 4th Ed. (2026) citation labels | §4 (labels) |
| 7 | Drawings + DXF (girder sheet, strand and draping schedule with hold-down from ℄ bearing and from the girder end (PS-13), camber table) | after 5 |
| 8 | Bridge-suite bootstrap moved to `shared/` (planned §3 work; before hand-offs) | all three copies |
| 9 | Hand-offs at switch-over (app id `psbeam`): bearings → elastomeric, every-girder `superReactions` → SubLoads, others unchanged | cross-tool |
| 10 | Comparison document (`docs/ps-bridge-comparison.md`: harness A/B + the engineer's real projects), then **switch-over** (PSBD → redirect, `psbeam.html` → new app, data offer as PBD-C3) | engineer approval |

---

## 6. Decisions (engineer, 2026-11-12)
| # | Decision | Resolves |
|---|---|---|
| PS-1 | End stress control by **harping (draping)**, hold-down limit checked | — |
| PS-2 | Girder library from the engineer's standard sheets (NEBT/NEDBT/NEXT/box), uploaded to `structural_references` | PR 4 |
| PS-3 | Steel Bridge app as the basis (folder app, bridge-level tabs, auto-design, report, drawings) + the PS engine for every PS check | — |
| PS-4 | Plan first, then phases 1–3; library/auto-design wait for the sheets | §5 |
| PS-5 | Two hold-down points; auto-design may move them between 0.33 L and 0.45 L, default 0.40 L | §4 |
| PS-6 | Supersede the 2026-11-02 plan. `apps/ps-bridge/` looks and works like the Steel Bridge app everywhere (screens, graphics, Report, Drawings, 3D); PS graphics redrawn in the steel style; only the PS calculation code moves, verified identical. **The old React tabs are not kept** | old Q1, Q2 |
| PS-7 | Continuity as today (5.12.3.3: DC1 simple; DC2/DW/LL continuous; restraint moments, switchable) | old Q3 |
| PS-8 | Interior + exterior design per span, same shape per span, optional per-girder override | old Q4, Q5 |
| PS-9 | Unequal bays and the steel app's DL distribution from the start (bridge-level step); results differ from the old app where they apply (§4 callouts) | old Q6, Q7 |
| PS-10 | Hold-down for AASHTO/RIDOT: optional box, default ON, 75 % of beam weight, editable | old Q12 |
| PS-11 | f′ci/f′c in 0.5 ksi steps, f′ci ≤ f′c, cap owner max or 10 ksi, editable plant f′ci max, start at the entered f′c | old Q14 |
| PS-12 | Strands in symmetric pairs unless the sheet's fill order says otherwise; auto-design never adds debonding (manual allowed) | old Q15, Q16 |
| PS-13 | Hold-down measured from ℄ bearing as frac × L_span (as today); drawings also show the distance from the girder end | old Q13 |
| PS-14 | Accepted: (a) deck/haunch/strip method as today; (b) diaphragms once; (c) bearings → elastomeric and `superReactions` → SubLoads after switch-over; (d) DXF after auto-design; (e) MBE 4th label in its own PR; (f) own project library + read-only import of the old data; (g) old app frozen; (h) bootstrap to `shared/` first | old Q8–Q11, Q17–Q22 |

## 7. Open items
1. **Real projects (old Q23):** 5–10 of the engineer's prestressed jobs (simple and continuous, each owner) for the switch-over comparison — requested.
2. **Girder sheets (PS-2):** NEBT, NEDBT, NEXT D/F, box section properties, strand grid, harpable web positions, fill order — awaited; PRs 4–5 wait for them.
3. To confirm in PR 3a: how the steel distribution maps onto the engine's inputs (S per girder from the adjacent bays, DC2/DW per girder, DF override) — shown with worked check cases before merge.
4. Old Q18 (no hand-offs from the new app before switch-over, so two apps never publish as `psbeam`) is read as part of PS-14 (c); the skeleton and phases 2–3 follow it. Confirm.
5. Risks carried: Babel-ES5 vs native numerics (harness A, report not fix); `computeAll` run time × cells × trials (measure in 2a, chunked runs); the steel app still changing (copies pinned, listed for `shared/`); two apps sharing Chrome/Edge storage before switch-over (new app writes `psb2.*` only, sends nothing).
