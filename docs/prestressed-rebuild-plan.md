# Prestressed Bridge Design: rebuild plan (draft for the engineer, 2026-11-02)

**Planning only.** This document changes no tool, formula, test or saved data. Nothing below starts until you approve it (§13, Q14).

- **Request (engineer, 2026-11-02):** the Prestressed Bridge Design app is unfinished, and "I want to make sure it's similar to the new steel bridge design app".
- **Proposal:** rebuild it the way Steel Bridge Design was rebuilt (`docs/REBUILD_PLAN.md` §5, `apps/steel-bridge/`), as a folder app `apps/prestressed/`, module by module, each module proven equal to today's app in Node before it counts.
- **Rules that apply:** CLAUDE.md §1 (no build, `file://`, classic scripts), §2 (CDN libraries only, ask first), §3 (shared code), §4 (calculation change control), §5 (saved data), §6 (show the work and link), §7 (one tool per PR), §8 (fixlog), §9 (ask).
- **Code basis:** AASHTO LRFD 10th Ed. (2024); AASHTO MBE for rating (edition as the current app, see Q9); RIDOT BDM (April 2026), MassDOT LRFD Bridge Manual Part I, CTDOT BRSDM Release 1 (2024) Vol. 2 for the owner rules. Articles are cited, never quoted.
- **Sources read for this plan:** `docs/REBUILD_PLAN.md`, `docs/steel-bridge-comparison.md`, `fixlog/Prestressed Bridge Design.md` (2,186 lines; every entry from F1 to PSRP2), the PBD plan of 2026-10-22 (PRs 0–14), `HANDOFF.md`, `shared/README.md`, the Steel Bridge app (`apps/steel-bridge/` engine, ui, report, `index.html`) and its tests (`tests/engine/*`), and the current `Prestressed Bridge Design.html` (function list and the parts named below; not read whole).

---

## 1. Summary

| | Today (`Prestressed Bridge Design.html`) | Proposed (`apps/prestressed/`) |
|---|---|---|
| Form | One file, 0.85 MB. React 18 + Babel in the browser, Plotly for charts and 3D, KaTeX | Folder app: `engine/*.js` (pure functions, no DOM), `ui/*.js`, `report/`, loading `shared/*.js`. No React, Babel or Plotly. KaTeX stays; three.js for 3D (Q12) |
| Engine | `computeAll(inp)`: one ~1,080-line function (lines 3403–4484) computes every check at once; tabs re-derive their worked equations in JSX | One module per topic (§4), each returning values, capacity, ratio, the AASHTO article and the worked steps (`shared/steps.js`). Tabs, report, drawings, Auto design and tests use the same steps |
| Analysis | Closed-form HL-93 on a simple span (`hl93`, `negMomentHL93`), plus a copy of the steel app's FE beam (`sgBeam`, `PBD.contFE`, three-moment) for continuity | `shared/moving-load.js` for every live- and dead-load envelope, simple or continuous, by stage |
| Bridge | One girder line at a time; a bridge model (`psbeam.bridge.v1`) stores a design per girder × span | One project: spans, girders, sections per girder, every girder × span designed and checked; results grid |
| Tests | `tests/ps-compare.mjs`: a browser A/B harness on 37 recorded inputs (`tests/projects/ps/`) | Node tests per module (seconds), parity with today's `computeAll` in a Node vm, hand-check cases; one browser smoke test |
| Optimizer | Optimize (lightest strand pattern) and Compare (span / girder sweep) tabs | Auto design with Lock / Range / Auto per variable, compare view, Apply with Undo (§8) |
| Drawings | Plotly cross-section, elevation and 3D rebar view; no DXF | Drawings-style SVG graphics on every tab (zoom, pan), Drawings tab with sheets and DXF (`shared/dxf.js`), 3D view |
| Saved data | `psbeam.inputs.v1`, `psbeam.bridge.v1`, slices `psbeam` / `psbeamBridge` in `bridgeSuite.v1.projects` | New keys `psb2.*` only; the old data is imported read-only ("From old app", §9); nothing is changed or deleted |

**The old app stays the working tool until you approve the switch-over** (as with steel). At the switch-over `Prestressed Bridge Design.html` becomes a small redirect page and `psbeam.html` (already a redirect) points to the new app.

**Size:** about 31 PRs to the switch-over (§11, phases P0–P5), then about 12 more for the new features (P6). Sections that need your standard sheets (NEBT, NEDBT, NEXT D, PCEF, spread box) wait for the sheets (Q1).

---

## 2. What "similar to the steel app" means, feature by feature

Every feature of the new Steel Bridge app and what it becomes here. "Today" says whether the current Prestressed app has it.

| Steel Bridge app (`apps/steel-bridge/`) | Prestressed equivalent | Today |
|---|---|---|
| Folder app: `index.html` + `engine/` + `ui/` + `report/`, classic scripts, `../../shared/` | Same layout (§3) | No (one file, JSX) |
| Engine modules: pure functions, worked steps, no DOM; one namespace per file (`window.SBD*`) | `window.PSB*` per file (§4) | Partly: `window.PBD.*` holds the bridge model, owners and continuity; the rest is inside `computeAll` |
| Node tests, parity against the old tool (`tests/engine/gd-source.mjs` loads GirderDetail's own code in a vm) | `tests/engine/pbd-source.mjs` loads today's `computeAll` and helpers in a vm (§7) | Browser harness only |
| Two-panel layout: input tabs on the left, output tabs on the right, both scroll; works on a tablet and at 390 px | Same (§6) | Inputs is one tab among the output tabs, with sub-tabs |
| Grouped worked steps per topic, KaTeX (`SharedSteps.group`, `groupsHTML`), every value worked once, "Worked in: →" links and "see §x.y" in the report | Same; the step ids are the link targets (§6) | Worked equations exist on most tabs (JSX `Deriv`/`Step`), links added in D11; the equations are written separately from the calculation |
| Drawings-style graphics on every tab (`ui/graphics.js`, `ui/gfxa.js`), zoom and pan | Section with strands and stress diagram, elevation with strand profile and debonding, stress heat map, loss bars, M/V envelopes, shear and stirrup zones, camber and haunch profile, continuity diagram, handling sketch | Plotly charts and SVG; no zoom/pan standard |
| Drawings tab: sheets with border and title block, DXF R12 (`engine/sheets.js`, `shared/dxf.js`) | Girder sheet (elevation, sections, strand pattern table, debond schedule, stirrup schedule, camber table), framing plan, typical cross-section | No DXF (old plan PR 12, not done) |
| 3D view (three.js r128, `ui/view3d.js`) with moment/shear fences | Bridge 3D: girders, deck, diaphragms, bearings; one girder with strands, debond sheaths and stirrups | Plotly 3D rebar view (`Rebar3D`) |
| Analysis via `shared/moving-load.js` and `shared/vehicles.js` | Same, by stage (§5) | Own closed form + copied FE |
| Auto design: Lock / Range / Auto variables, ranked candidates, compare view, Apply + Undo, the same checks as the tabs | Same, prestressed variables (§8) | Optimize (strands only) and Compare (sweep) |
| Custom (entered) demands per module (`ui/demands.js`, `P.custom`, `P.demandSrc`) | Same for flexure, shear, interface shear, longitudinal reinforcement, stresses (service moments), fatigue, rating | Imported MIDAS envelopes only |
| External demand files (`engine/demandfile.js`) | `psbeam-external-demands` (MCT / MIDAS) as today; others refused with a message | Yes (MIDAS import) |
| Project library + undo/redo (`engine/library.js`, `sbd2.lib.*`) | `psb2.lib.*` library, session undo/redo, Export / Import JSON | Shared-project registry only (Open / Save / Save as / New, PBD-D2) |
| Owner rules in one module (`engine/owners.js`, the OWN_RULES table) | `engine/owners.js` with today's `PBD.OWN_RULES` (PBD-E/F/G rules), `ownApply`, `ownLoads` | Yes, in `window.PBD` |
| Load factors from one source (`factors()`, `tests/engine/factors-onesource.test.mjs`) | `PSBLoads.factors(owner)`: every γ, η and m_LL read from it; test that a changed source reaches every user | No: γ written inline in `computeAll` (1.25, 1.5, 1.75, 0.8 …) |
| Hand-offs `bridgeSuite.v1.*` (`ui/handoffs.js`, `ui/bridgexfer.js`) | Same channels and payloads as today (§9.4) | Yes |
| Report tab (`shared/report.js`, `report/data.js`, `report/builders.js`) | Same: the report model built from the modules' own steps | Yes, the shared viewer since PSRP2 (`psrModel`) |
| Results grid: every girder × every check, colored by ratio, click opens the derivation | Every girder × span × check | No (one design at a time) |
| Outdated results marked on input change instead of recomputing per keystroke | Same | Recomputes per change |

---

## 3. Target layout

```
apps/prestressed/
  index.html              shell: script tags, two panels, input tabs, output tab bar, project bar
  engine/
    model.js              project schema psb2.project v1, defaults, save/load (storage passed in), migrations
    library.js            saved-project list (psb2.lib.*)
    legacy.js             import of psbeam.inputs.v1 / psbeam.bridge.v1 / old JSON exports / shared-project slices (read only)
    demandfile.js         which demand files are accepted (psbeam-external-demands), the checks before applying one
    data-sections.js      section library data (from your standard sheets; §4.1) — data only
    data-strands.js       strand sizes and grades, strand grid templates per section — data only
    sections.js           gross, transformed and composite properties; NEXT width interpolation; Custom; drawing outline
    strands.js            pattern, rows, harping, debonding, transfer and development length, P/e at any x
    owners.js             owner rules table, defaults, η, m_LL, owner checks
    loads.js              DC1 / DC2 / DW per girder, tributary widths, diaphragms; factors() — the one source of γ, η, m_LL
    lldf.js               adapter to shared/lldf.js (types k, b/c, f, g, i/j)
    analysis.js           stages and envelopes on shared/moving-load.js (simple, made continuous), MIDAS / custom demands
    losses.js             5.9.3 losses, elastic gains, deck shrinkage, per-row strand stress by stage
    stresses.js           5.9.2.3 stresses at release / construction / service by stage and station; release tension steel
    flexure.js            5.6.3 approximate f_ps and strain compatibility (option); min reinforcement; pier −M
    shear.js              5.7.3 MCFT general procedure; critical section; 5.7.4 interface shear; 5.7.3.5 longitudinal reinforcement
    anchorage.js          5.9.4.4 splitting and confinement; 5.9.4.3.3 debonding rules; hold-down (owner)
    continuity.js         5.12.3.3 restraint moments, positive moment connection, service at the piers, age at continuity
    camber.js             camber and deflection by stage, haunch / screed profile, LL deflection
    fatigue.js            5.5.3 strand and concrete fatigue
    handling.js           lifting and hauling (screening today; PCI / Mast if approved, Q4)
    deck.js               deck slab and overhang (only if you want it, Q2)
    rating.js             MBE 6A load rating: Strength, Service III (prestressed), shear
    autodesign.js         Auto design search (§8)
    drawings.js, sheets.js   drawing geometry, sheets, DXF (display and export only)
  ui/                     one file per output tab (+ inputs, demands, library, handoffs, graphics, view3d)
  report/
    data.js, builders.js  report model from the modules' results and steps
shared/                   reused, unchanged where possible (§5)
tests/engine/
  pbd-source.mjs          today's computeAll and helpers in a Node vm (§7)
  psb-*.test.mjs          one test file per module: hand checks and parity
fixlog/prestressed.md     the new app's fixlog (CLAUDE.md §8, folder tool)
```

- **Name:** `apps/prestressed/` as asked. Window namespaces `PSB*` (e.g. `PSBLosses`), distinct from the old app's `PBD` so that both can be loaded side by side in a parity test.
- **Old file names** (CLAUDE.md §7): at the switch-over `Prestressed Bridge Design.html` becomes a redirect to `apps/prestressed/index.html` with the "Download my data" button (as `psbeam.html`, PBD-C3); `psbeam.html` keeps redirecting. Other tools that open the app by name (MCT `index.html`, `tools.html`, the `bridgeSuite.v1.appPaths` default) keep working through the redirect; their links are updated in the switch-over PR.

---

## 4. Engine modules

Each module: pure functions, units in the header comment, every computed value through `SharedSteps.work(…)` with its AASHTO LRFD 10th Ed. reference, results `{ value, capacity, ratio, ok, ref, steps }` per check. "Ported from" names today's function or the part of `computeAll` (anchor comment) the arithmetic is copied from, operation for operation, so that parity is exact.

### 4.1 Sections (`sections.js`, `data-sections.js`)

- **Library today (`GIRDERS`, line 2405):** AASHTO Types I–VI; PCI BT-54/63/72; NEXT 24F/28F/32F/36F (properties interpolated between 96 in and 144 in flange width); AASHTO box beams BI-36, BII-36, BIII-36, BIV-48; deck slabs 12×48 and 18×48 solid, 21×48 and 27×48 voided; Custom. The outline for drawings is built from a few dimensions (`d:[…]`, `halfPolygon`), and the published A, I, y_b are used (`withOverrides` lets the user override them).
- **To add (old plan PR 4):** NEBT (New England Bulb Tee) and NEDBT, NEXT D, PCEF, spread box beams, and the box and deck beams with your office's dimensions.
- **Property source: your standard sheets** (Q1). Each library entry stores the sheet's dimensions (full outline polygon with fillets and voids), the sheet's tabulated A, I, y_b, S_t, S_b, weight, and the sheet reference (sheet name, date). The engine computes the properties from the outline as well and the test asserts both agree within 0.5 % (a check that the outline was typed right). Which one the design uses: the tabulated values (as today), unless you prefer the computed ones (Q1).
- **Composite and transformed sections:** `compositeProps` (deck with the effective width of 4.6.2.6.1, haunch in or out as the owner rule says, modular ratio by stage), transformed strand area where today's app uses it, weak-axis I and torsion J (`weakAxisAndJ`, for the LLDF and handling).
- **Section types carry their family** (`I`, `bulbT`, `NEXT-F`, `NEXT-D`, `boxAdj`, `boxSpread`, `deckBeam`, `custom`) so that the LLDF type, the shear web width b_v, the deck design section, the strand grid and the drawings know what they are dealing with.

### 4.2 Strands (`strands.js`)

- Ported from `strandSys` (and `strandXY` for drawing): rows, strands per row, harped strands with hold-down points, debonded strands with lengths, partial and full transfer length (5.9.4.3.1), development length with κ (5.9.4.3.2, Eq. 5.9.4.3.2-1), the effective A_ps, centroid and eccentricity at any x (`ss.at(x)`).
- Strand data (`STRANDS`: 0.5, 0.6, 0.7 in, Grade 270 low-relaxation) in `data-strands.js`, with the strand grid template per section (2 in grid, the sheet's positions).
- Checks moved here: the 10th Ed. debonding rules of 5.9.4.3.3 as today's AE1 warnings (items A–D, G, I: 45 % per row, strands terminating per section, 60 d_b termination spacing, symmetry, debond length in simple spans, I-shape reminder), and the CTDOT 25 % of all strands (PBD-E6).

### 4.3 Loads, factors and owners (`loads.js`, `owners.js`)

- **Dead loads** (from `computeAll` "loads (klf)", W1): girder self-weight, deck (S·t_s for interior, S/2 + overhang for exterior), haunch, stay-in-place forms, non-composite superimposed, diaphragm point loads (DC1); barrier/SIDL (DC2) and wearing surface (DW); the LL & DL app's values through the `dlLoads` hand-off as today.
- **`factors(owner)`: the one source** of every load factor and modifier: Strength I (1.25 / 1.50 / 1.75), Service I, Service III γ_LL (0.8, Table 3.4.1-4, AE2), Fatigue I, the restraint-moment γ (1.0), the rating factors (MBE), with the owner's η = η_D·η_R·η_I and m_LL (PBD-E3, E4). Every module reads it; a test changes it once and checks every module follows (as `factors-onesource.test.mjs`).
- **Owners** (`PBD.OWN_RULES`, `ownRule`, `ownApply`, `ownLoads`, `ownDefaults`): moved as data and functions, unchanged, with the steel app's `owners.js` interface (`rules(o)`, `rule(o, id)`, `cite(r)`, `defaults()`), so that both apps read owner rules the same way. Both tables stay separate (different rules); a shared owner file is not proposed now.

### 4.4 Live load distribution (`lldf.js` adapter)

- I-girders and bulb tees: type (k) through `shared/lldf.js` (the verified lldf engine the steel app uses). Spread boxes: type (b)/(c). Adjacent boxes and deck beams: type (f) with a CIP deck, (g) otherwise.
- **NEXT beams (type (i)/(j)) are not in `shared/lldf.js`.** Today `distFactors` (line 3136) does NEXT itself, with the open items of PSB-O4 (no K_g with no topping, S = beam width, no exterior case, no range check). Proposal: add types (i)/(j) to `shared/lldf.js` in its own PR (shared-file rules, lldf.html and the steel app tests run) once you have answered Q3. Until then the adapter reproduces today's `distFactors` exactly (parity) and says "PSB-O4 open".
- The fatigue DF (exterior: lever rule / rigid section, one lane, ÷ 1.2, W2), the imported DF / MPF rules (blank = 1.0, 0 kept, T2/T4) and the LL & DL `lldf` pull/lock stay as today.

### 4.5 Analysis (`analysis.js`, on `shared/moving-load.js`)

- **Stages:** (1) girder self-weight on the simple span between the bearings at release and in storage (span = overall length, supports at the ends or the lifting points) and in service (span = bearing to bearing); (2) DC1 on the non-composite simple span; (3) DC2, DW, LL+IM on the composite section: simple spans, or the continuous unit when the spans are made continuous (5.12.3.3.1). This is today's staging (`computeAll` comments at "component force-effect functions" and "PBD-G"), made explicit.
- **Live load:** HL-93 (truck, tandem, lane, the 90 % two-truck case at the piers, 3.6.1.3.1), the fatigue truck (3.6.1.4.1), the deflection load (3.6.1.3.2), the rating vehicles (MBE, later: legal and permit trucks from `shared/vehicles.js`).
- **Parity risk:** today's simple-span envelope is closed form (`hl93`: each axle placed at x, both orientations, tandem, lane parabola). `shared/moving-load.js` steps the trucks along influence lines on a station grid. They should agree to round-off on a simple span if the stations coincide; any difference is found in P2 and reported with its cause before anything is accepted (§7.3). The continuous case already uses an FE beam copied from the steel app (`sgBeam`), which `shared/moving-load.js` replaced there with exact agreement.
- **Demand sources** per module (as the steel app): this project's analysis, an imported MIDAS envelope (`psbeam-external-demands`, today's `buildExternal` / `externalSpans`, W14 interior-pier warning), or custom (entered) demands.

### 4.6 Losses (`losses.js`)

- Ported from `losses()` (line 2848) and the per-row strand stresses by stage in `computeAll`:
  - elastic shortening 5.9.3.2.3a (iterated or by the alternative equation, as today);
  - approximate long-term losses 5.9.3.3 (γ_h, γ_st);
  - refined estimate 5.9.3.4: shrinkage, creep and relaxation before and after deck placement, the 10th Ed. time-development factor k_td (Eq. 5.4.2.3.2-5, F1), deck-shrinkage gain 5.9.3.4.3d;
  - elastic gains from the loads after transfer (C5.9.3.2.3a / 5.9.3.4.3), credited as today (permanent in every stage, LL gain only in LL combinations);
  - the stress of each row by its own eccentricity.
- PSB-O6a (Δf_cd omits the (Δf_pSR + Δf_pCR + Δf_pR1) term) stays as decided: reported, not changed (§4 change control).

### 4.7 Stresses (`stresses.js`)

- 5.9.2.3: release (0.65 f′ci default or the 0.70 option, W8, AE6), tension 0.0948√f′ci ≤ 0.2 ksi without bonded steel, 0.24√f′ci with it and the steel required (5.9.2.3.1b, at 0.5 f_y ≤ 30 ksi); after losses (permanent and total compression; Service III tension by exposure, W6, PBD-E1); the deck stresses; per station over the span (today's dense grid and the on-demand station query), at the transfer length, harp points, debond ends and midspan.
- Stages: release, lifting / storage (if the handling module is on), deck placement, final; the heat map from the same results.
- Continuity: the stations next to an interior support use 5.12.3.3.5 (moved to `continuity.js`, called from here).

### 4.8 Flexure (`flexure.js`)

- Ported from `flexure()` (line 3217) and the full-span envelope (`flexFull`, F5): f_ps by the approximate method (5.6.3.1.1, rectangular or flanged behaviour 5.6.3.2), φ by the net tensile strain (5.5.4.2), minimum reinforcement 5.6.3.3 (M_cr with f_r, γ1, γ2, γ3), the pier negative moment with the deck bars (today's "Neg flexure (pier)"), every station.
- **Strain compatibility (5.6.3.2.5, old plan PR 8):** a new, optional method (input: approximate / strain compatibility), layer-by-layer strands with the power formula for the stress–strain curve, the deck and girder concrete as a stress block. It is a new calculation: §4 callout with a hand check when it is added (P6), approximate stays the default.
- The capacity hand-off to MCT keeps saying which method it used (PBD-B1).

### 4.9 Shear (`shear.js`)

- Ported from the shear part of `computeAll` ("shear (general procedure 5.7.3.4.2) at stations"): d_v, b_v (web, box walls, NEXT stems), V_p from harping, the MCFT general procedure (ε_s with f_po ramped over the transfer length, β, θ), V_c, V_s, V_n ≤ 0.25 f′c b_v d_v + V_p, minimum and maximum spacing (5.7.2.5, 5.7.2.6), the critical section at d_v from the inside face of the bearing (W7), stations over the full span with a station at each stirrup spacing change (F4).
- Interface shear 5.7.4 over the full span, with the 0.210 ksi waiver (F3).
- Longitudinal reinforcement 5.7.3.5 (today's "Long. reinf (5.7.3.5)") at the bearing and along the span.
- Stirrup layout (zones, bar size, legs) as input; Auto design can size it (§8).

### 4.10 Anchorage zone (`anchorage.js`)

- Splitting resistance 5.9.4.4.1 (4 % of P_i within h/4, f_s ≤ 20 ksi), confinement 5.9.4.4.2 (#3 at 6 in over 1.5d, or the owner's), with today's diagram (`AnchDiagram`) as a Drawings-style graphic. Release tension steel (5.9.2.3.1b) is computed in `stresses.js` and shown here as today (`RelSteelBody`).
- Hold-down force (owner, PBD-E5) and the debonding rules (from `strands.js`) are listed here too, as "details at the girder end".

### 4.11 Continuity (`continuity.js`)

- Moved from `window.PBD` (`threeMoment`, `contFE`, `restraint`) and the PBD-G part of `computeAll`: composite-stage demands on the continuous unit (5.12.3.3.1); restraint moments from creep and deck shrinkage by C5.12.3.3.2 with the properties of 5.4.2.3 (5.12.3.3.3) and age at continuity t_d (5.12.3.3.4), included only where they add (5.12.3.3.2); positive moment connection (5.12.3.3.8a, RIDOT 1.2 M_cr with the deck/diaphragm f_r, PBD-F1); service at the interior supports (5.12.3.3.5); owner defaults (MassDOT, RIDOT restraint off; RIDOT age ≥ 90 days).
- The continuous analysis itself runs on `shared/moving-load.js` (the three-moment and FE copies retire once parity holds, §7).
- Temperature gradient (TG) is not computed today; it stays out unless you ask (Q11).

### 4.12 Camber and deflection (`camber.js`)

- Ported from "camber & deflections" in `computeAll` and `CamberTab`: camber at release and at erection (multipliers, MassDOT beam-seat camber rule), deflections of the deck and the superimposed loads, net camber, the haunch / screed elevation profile at tenth points, the LL deflection with the owner limits (L/800, MassDOT L/1000 with sidewalks, PBD-E8).
- Later (P6): the deflection by `shared/moving-load.js` `deflection()` for continuous units.

### 4.13 Fatigue (`fatigue.js`)

- 5.5.3: strand stress range (5.5.3.3) where the section is cracked under Fatigue I (5.5.3.1, the −0.095√f′c test, today's rule), concrete compression fatigue (5.5.3.1, W3), the exterior DF of W2.
- PSB-O3a (range at the bottom fiber, ×1.5 if cracked) is ported as is for parity; the cracked transformed-section strand stress is a calculation change you decide (Q6).

### 4.14 Handling (`handling.js`)

- Today: lifting and hauling FS against cracking, labelled "screening only — not PCI (2016) / Mast" (W12; `handlingCalc`, `computeZo`, `approxIy`). Ported as is.
- PCI (2016) / Mast (old plan PR 9): roll stiffness K_θ, tilt equilibrium, FS against cracking, failure and rollover, impact, superelevation. Only if you want it (Q4); L size.

### 4.15 Deck (`deck.js`, only if you want it)

- Today: transverse deck design by the strip method with Table A4-1 (`deckTableA4`, `deckCalc`, the design section by `deckDesignSection`), deck compression, the overhang. Old plan PR 10 adds A13.4 (barrier collision on the overhang) and owner tables.
- The steel rebuild dropped deck slab and overhang design on purpose (REBUILD_PLAN §8). The same choice is open here (Q2). If you keep it, it is ported as is (parity) in P4 and A13.4 is a P6 item; if you drop it, the old app is the only place it lives until a separate deck tool exists.

### 4.16 Rating (`rating.js`)

- Ported from "Load rating (LRFR, MBE)" in `computeAll` and `ratingDerivs`: HL-93 design load rating, inventory and operating, Strength I flexure at the governing station of the full span (W5), shear, Service III for prestressed members (MBE 6A.5.4.1, as today), φ_c·φ_s with the 0.85 floor (W4), the owner's rule that the design check rating is without m_LL (PBD-E3).
- The "RF × 36 tons" value stays removed (W13).
- Later (P6, old plan PR 11): legal and permit vehicles from `shared/vehicles.js`, owner target RFs.

### 4.17 Supporting modules

- **`model.js`:** schema `psb2.project` v1 (bridge: spans, continuity, girders, spacing, skew, owner, cross-section; per girder: section, strands, reinforcement, materials, ages; settings), defaults equal to today's `DEFAULTS` (line 2464) so the built-in example computes the same numbers, versioned migrations, a project that cannot be read is kept as a backup (as `SBDModel`).
- **`library.js`:** `psb2.lib.index`, `psb2.lib.p.<id>`, `psb2.lib.current` (as `SBDLibrary`); undo/redo in the session only.
- **`legacy.js`:** §9.
- **`demandfile.js`:** accepts `psbeam-external-demands` (today's import), refuses other schemas with a message, as the steel app does.
- **`drawings.js`, `sheets.js`:** display and export only; nothing feeds a result.

---

## 5. Shared files reused

| File | Used for | Change needed |
|---|---|---|
| `shared/moving-load.js` | Every LL envelope (HL-93, fatigue, deflection, rating vehicles), DL by stage, continuous units, reactions for `superReactions` | None expected. If a stage needs an option (e.g. supports at the lifting points), it is an additive option in its own shared-file PR (§3: Moving Load Generator and Steel Bridge tests run) |
| `shared/vehicles.js` | HL-93, fatigue truck; later legal/permit rating vehicles | None |
| `shared/lldf.js` (+ `SharedLLDF.steps`) | Types k, b/c, f, g | Types (i)/(j) for NEXT added after Q3, own PR (lldf.html and Steel Bridge tests run) |
| `shared/units.js` | Formatting, conversions | None |
| `shared/steps.js` | Worked steps, grouping by topic, KaTeX rendering | None |
| `shared/report.js` | Report tab | None (today's `psrModel` already uses it) |
| `shared/dxf.js` | Drawings tab DXF, SVG previews | None |
| `shared/anchor-geom.js` | Not used (concrete anchors) | — |

New shared files are **not** proposed now. Two candidates for later, when a second tool needs them: concrete material functions (E_c 5.4.2.4, k_td, f_r, λ — also in Concrete Beam Capacity) and the girder-section library (also useful to Section Property Calculator).

The steel app's own UI helpers (`ui/graphics.js` drawing kit, the two-panel CSS, the custom-demand table `ui/demands.js`, the library UI) are copied into `apps/prestressed/ui/` at first, and moved to `shared/` in a separate planned PR once both apps use them unchanged (CLAUDE.md §3: "moving duplicated code into shared/ is planned work"). Each copy is listed in both fixlogs until then.

---

## 6. User interface (mirrors the steel app)

**Layout:** project bar on top (project name, owner, Open / Save / Save as / New / library, Undo / Redo, Export / Import, From old app, hand-off buttons), girder × span selector, then two panels: inputs left, outputs right, each with its own tabs and scroll. At phone width the panels stack. Results are marked "outdated" after an input change until recomputed (Steel behaviour).

**Input tabs (left):**

| Tab | Contents (today's place) |
|---|---|
| Project | Title block, owner, owner questions (η, sidewalks), code options (corrosion exposure, release limit factor) (title block, PbdBridgeBar, Analysis Options) |
| Spans & girders | Spans, continuity (made continuous: yes/no, age at continuity, restraint), girder count, spacing, skew, overhangs, girder × span grid (PbdBridgeBar, Geometry) |
| Section | Family, section from the library or custom, per girder (Geometry) |
| Materials | f′ci, f′c, w_c, deck f′c, E, H, strand grade (Materials) |
| Strands | Strand size, pattern on the grid, harped / debonded strands, clicking a strand in the section drawing selects it (Strands, T3) |
| Cross-section & loads | Deck, haunch, barriers, wearing surface, utilities, diaphragms, LL & DL pull/lock (Loads) |
| Reinforcement | Stirrup zones, interface steel, confinement, deck bars over the piers, release tension steel (Reinforcement) |
| Construction | Ages (release, deck, continuity), handling inputs, deck design inputs if kept (Handling & Deck, Analysis Options) |

**Output tabs (right):** Section properties · Loads & LLDF · Analysis · Losses · Stresses · Flexure · Shear · Anchorage & ends · Continuity (when on) · Camber & deflection · Fatigue · Handling (when on) · Deck (when kept and on) · Rating · Results grid · Report · Drawings · Auto design · 3D view.

On every output tab:
- the governing ratios on top, with the check name, ratio, location and article;
- the Drawings-style graphic of the tab (zoom, pan, click a station to select it);
- the demand source selector (analysis / file / custom) where the module takes demands;
- the worked steps grouped by topic (e.g. Losses: elastic shortening, shrinkage, creep, relaxation, gains, totals), KaTeX, the governing station open and the others on demand;
- a value used here but worked on another tab links to it ("Worked in: → Losses · Relaxation"), and the report says "see §x.y".

Nomenclature (today a tab) becomes a report appendix and a help panel.

---

## 7. Parity strategy

The accuracy gate (REBUILD_PLAN §5): a module is done only when its hand-check cases pass and it matches today's app on the recorded projects. Any difference larger than round-off goes to you with its cause before it is accepted. Neither side is "fixed" in a parity PR (CLAUDE.md §4, §9).

### 7.1 Loading today's code in Node (`tests/engine/pbd-source.mjs`)

As `tests/engine/gd-source.mjs` does for GirderDetail:
1. Read `Prestressed Bridge Design.html` from the working tree (or a git ref: `git show <ref>:"Prestressed Bridge Design.html"`, so the reference can be pinned to a commit).
2. Run its plain `window.PBD` engine scripts (bridge model, owners, continuity) in a vm context with a stub `window`, `localStorage` and `document`.
3. Take the `text/babel` block, transpile it with the offline Babel in `tests/libs/babel-standalone@7.23.5` (the same version the page loads; the fixlog's F1, PBD-E and PBD-G checks already did this in scratch), and run it with React from `tests/libs/react@18.2.0` (needed only so the component definitions parse; nothing is rendered).
4. Export `computeAll`, `girderGross`, `compositeProps`, `strandSys`, `losses`, `distFactors`, `flexure`, `hl93`, `handlingCalc`, `deckCalc`, `bxSuperRxPayload`, `psbReportVals` and `DEFAULTS`/`mergeInputs`.

A test then calls today's function and the new module on the same inputs and compares every number. Because today's `computeAll` returns its intermediates in `R` (and `R.rv` since PSRF), each module can be compared on its own: e.g. the new `losses.js` gets the same section and strands and its totals are compared with `R.lo`, per row and per stage.

### 7.2 The parity set

| Set | Count | Source |
|---|---|---|
| Recorded inputs | 37 | `tests/projects/ps/*.json` (every library shape, approximate losses, continuity and restraint, 3-span continuous, deck + handling, exterior, debond + harp, NEXT with skew, MIDAS 3-span and DF 0, six owner cases) |
| Built-in project | 1 | `DEFAULTS` (PCI BT-72, L = 120 ft, 40 × 0.6 in, f′ci 6.8 / f′c 8.5 ksi; fixlog check cases PBD-E, PSRP) |
| Generated grid | ≈ 400 | each library shape × 3 spans in its range × interior/exterior × approximate/refined losses × AASHTO and the three owners, strands fitted so every check computes (a deterministic generator, recorded once as JSON) |
| Your projects | 5–10 | real designs, if you can provide them (Q8), as the 20 steel bridges were |

Every parity test reports cases, values compared and the largest difference. Target: exact or round-off (relative 1e-9) per value.

### 7.3 Expected differences (to bring to you, not to fix silently)

- **LL envelope:** closed-form `hl93` vs `shared/moving-load.js` (§4.5). If the stations differ, the module test compares at the old stations; a remaining difference is reported with its size.
- **Continuity analysis:** `PBD.contFE` / `threeMoment` vs `shared/moving-load.js`.
- **Per-girder bridge:** today each girder × span design is independent (a copy of inputs); the new project holds one bridge with per-girder sections. Import (§9) maps one to the other and the import test asserts the same results per cell.
- **Known open items** (PSB-O4, O3a, O6a, the composite-centroid display line) are ported as they are, so they do not show up as differences.

### 7.4 After the modules: the import path

As `tests/engine/final-compare.mjs` for steel: import each recorded `psbeam.inputs.v1` (and `psbeam.bridge.v1` with several cells) through "From old app", run every module, and compare with today's `computeAll` on the original inputs. This is the switch-over test (P5).

The browser harness `tests/ps-compare.mjs` stays for PRs on the old app (if any) and is not used for the new one.

---

## 8. Auto design for prestressed girders

Replaces today's Optimize (`optimizeStrands`: lightest passing strand layout on candidate bottom rows) and Compare (`sweepDesign`: span or girder sweep) and the old plan's PR 5 (preliminary design + Suggest). Same rules as the steel app's Auto design: it calls the same module functions the tabs call, so its ratios equal the tabs' ratios (a test asserts this for every module, the lesson from the steel app's Auto design live-load bug).

**Variables** (each Auto / Lock / Range, saved in `P.autodesign.vars`, as `SBDAutoDesign`):

| Group | Variable | Auto | Notes |
|---|---|---|---|
| Girder | Section family | Lock by default | The families you allow (e.g. NEBT and NEXT only) |
| Girder | Section / depth | Auto: the shallowest passing section of the family, or Range of depths | Owner span-to-depth guidance as a limit, not a rule (2.5.2.6.3 optional) |
| Bridge | Girder count / spacing | Auto: the current count ± 1 within the spacing limits; Range | Overhang closes to the same out-to-out width (as steel `nb`/`oh`) |
| Strands | Strand size | Lock (0.6 in default) | Range 0.5 / 0.6 / 0.7 in |
| Strands | Strand count | Auto: from the Service III bottom tension at midspan (a closed-form lower bound), then the full check | |
| Strands | Pattern | Auto: fill the grid from the bottom, row by row, symmetric | Lock keeps the entered pattern |
| Strands | End stress control | Auto: debond first, then harp (or as the owner prefers, Q10); Lock: as entered | 5.9.4.3.3 limits (as the AE1 warnings) and CTDOT 25 %, hold-down limit (owner) |
| Strands | Debond lengths | Auto: shortest lengths, in the stagger increment you set, that pass release tension | |
| Concrete | f′ci | Auto: the lowest that passes release compression and tension, in 0.1 ksi steps, within the owner limits (PBD-E7) | |
| Concrete | f′c | Auto / Range from the owner's mixes (e.g. 6.5, 8.0 ksi) | |
| Details | Stirrup zones (bar, spacing) | Auto: the widest spacing passing shear, interface shear and 5.7.2.6 per zone | |
| Details | Confinement, splitting steel | Auto: the 5.9.4.4 minimum | |

**Objective:** cost (price list: girder concrete per CY, strand per lb, mild steel per lb, girder per LF by section, deck per SF) or the lightest section; ranked list of candidates that pass every check.

**Compare view:** the current design and up to four candidates side by side (section, girders, strands, f′ci / f′c, governing ratio per module, cost), Apply with one-step Undo, as the steel app.

**Search:** sections in ascending depth; for each, the strand count from the lower bound upward until the full check passes; then end stresses by debonding / harping; then f′ci; stop at the first passing count per section. It runs a trial at a time on `setTimeout` (Stop button), as the steel tab.

---

## 9. Saved data and migration (CLAUDE.md §5)

### 9.1 Keys

- **New app writes only `psb2.*` keys:** `psb2.current` (autosave), `psb2.ui`, `psb2.lib.index`, `psb2.lib.p.<id>`, `psb2.lib.current`, backups `psb2.current.unreadable.<ts>`.
- **Old keys are read, never written or deleted:** `psbeam.inputs.v1` (the design on screen), `psbeam.bridge.v1` (bridge model: spans, girders, spacing, `designs: {'G<g>/S<s>': inputs}`), `psbeam.projects.v1` (legacy project list), the `psbeam` and `psbeamBridge` slices of `bridgeSuite.v1.projects`. UI-only keys (`psbeam.ui.v1`, `psbeam.inputTab.v1`, `psbeam.fold.*`) are not migrated.
- **Hand-off keys stay as they are** (§9.4).

### 9.2 "From old app" import (`engine/legacy.js`)

- Builds a `psb2.project` from `psbeam.bridge.v1` when present (every stored cell), else from `psbeam.inputs.v1` (one girder × one span), using the old app's own merge (`mergeInputs` onto `DEFAULTS`) so that the imported inputs are exactly what the old app computed with.
- Also imports an old Export JSON file and a shared-project entry.
- Every old input field is mapped or kept: fields the new app does not use yet are kept under `P.legacy` so that nothing is discarded (§5), and listed in the import message.
- The test: for every recorded input, `import → new modules` gives the same results as `computeAll(original)` (§7.4).

### 9.3 Browsers other than Chrome / Edge

In Chrome and Edge every `file://` page shares one localStorage, so the new app can read the old keys directly. In Firefox and Safari each file has its own storage, so the new app cannot see the old app's data. As for `psbeam.html` (PBD-C3), the redirect page offers "Download my data (JSON)", and the new app imports that file. The switch-over PR tests both paths.

### 9.4 Hand-offs (HANDOFF.md, keys and payloads unchanged)

| Channel | Direction | Today | New app |
|---|---|---|---|
| `lldf`, `lldfGeom` | from LL & DL | pull / lock | same receiver rules (T2, T4, LR1: `perFootStrip` refused) |
| `dlLoads` | from LL & DL | pull / lock | same |
| `superReactions` (+ `.by.psbeam`) | to Substructure Loading | one girder line | every girder (old plan PR 7); the payload format unchanged, `by.psbeam` copy shared with the old app during the transition (as steel's `by.girderdetail`) |
| `psSection`, `capacity`, `demands`, `geometryChanges` | with MCT (`index.html`) | yes | same payloads; MCT opens the new app by file name through the redirect |
| `designBeam`, `beamRoster` | with MCT / LL & DL | yes | same |
| `projectMeta`, `projects` | shared project info | yes | same; the new app's slice key is new (`prestressed`), the old slices are read only |

The shared `bridgeSuite.v1.*` bootstrap block (duplicated byte-identically in `index.html`, `lldf.html` and `Prestressed Bridge Design.html`, CLAUDE.md §3) is **not** copied a fourth time: the new app uses the steel app's `ui/bridgexfer.js` / `ui/handoffs.js` pattern. At the switch-over the old file's copy goes with the redirect, and the CLAUDE.md §3 list is updated in that PR.

---

## 10. Module-by-module map (today → new)

| Today (`Prestressed Bridge Design.html`) | New module | Tab |
|---|---|---|
| `GIRDERS`, `girderGross`, `girderGrossBase`, `withOverrides`, `halfPolygon`, `sectionWidthAt`, `sectionVoids`, `weakAxisAndJ`, `rectTorsionJ`, `approxIy`, `shapePayload` | `data-sections.js`, `sections.js` | Section properties |
| `compositeProps` | `sections.js` | Section properties |
| `STRANDS`, `strandSys`, `strandXY`, `tensionSideArea`, AE1 debond warnings | `data-strands.js`, `strands.js` | Strands input, Anchorage & ends |
| `Ec`, `ktdAASHTO`, `relCfacOf` | `losses.js` / `stresses.js` (materials helpers) | — |
| `computeAll` "loads (klf)", diaphragm loads, W1 tributary | `loads.js` | Loads & LLDF |
| inline γ, `PBD.ownLoads` (η, m_LL) | `loads.js factors()` | — |
| `PBD.OWN_RULES`, `ownRule`, `ownApply`, `ownDefaults`, `PbdOwnerCard` | `owners.js`, `ui/owners.js` | Project, report |
| `distFactors` (type k, NEXT i/j), `lldfResolveFor`, `LockAutoSync` | `lldf.js` adapter (+ `shared/lldf.js`), `ui/handoffs.js` | Loads & LLDF |
| `hl93`, `negMomentHL93`, LL envelopes in `computeAll`, `sgBeam`, `sgLLRow`, `sgFatRow`, `PBD.contFE`, `PBD.threeMoment`, `contUnit` | `analysis.js` on `shared/moving-load.js` | Analysis (today's Diagrams) |
| `buildExternal`, `externalSpans`, `extActiveOf`, W14 | `demandfile.js`, `analysis.js` | Analysis |
| `losses`, elastic gains, deck shrinkage, per-row stresses | `losses.js` | Losses |
| stress limits, station grid, release tension steel, `releaseTensionForce` | `stresses.js` | Stresses |
| `flexure`, `flexFull`, min reinforcement, pier −M | `flexure.js` | Flexure |
| shear stations, MCFT, interface shear, 5.7.3.5 | `shear.js` | Shear |
| splitting, confinement, `AnchDiagram`, `RelSteelBody`, hold-down | `anchorage.js` | Anchorage & ends |
| `PBD.restraint`, PBD-G block, positive moment connection, 5.12.3.3.5 | `continuity.js` | Continuity |
| camber, deflections, haunch profile, LL deflection | `camber.js` | Camber & deflection |
| fatigue (strand, concrete), `fatigueSteps` | `fatigue.js` | Fatigue |
| `handlingCalc`, `computeZo` | `handling.js` | Handling |
| `deckTableA4`, `deckDesignSection`, `deckCalc` | `deck.js` (if kept) | Deck |
| rating block, `ratingDerivs` | `rating.js` | Rating |
| `optimizeStrands`, `sweepDesign`, `OptimizeTab`, `CompareTab` | `autodesign.js`, `ui/autodesign.js` | Auto design |
| `CrossSection`, `Elevation`, `StressHeatmap`, `MiniDiagram`, `ReportGraphics`, `Fig` (Plotly) | `ui/graphics.js` (SVG), `drawings.js` | every tab, Drawings |
| `Rebar3D` (Plotly 3D) | `ui/view3d.js` (three.js) | 3D view |
| `psrModel`, `psrMore`, `psrPort`, `psbReportVals`, `SharedReportTab`, `PSB_CK` links | `report/data.js`, `report/builders.js`, `ui/report.js` | Report |
| `NomenclatureTab` | report appendix, help panel | Report |
| `PBD.migrate`, `PBD.select`, `PBD.edit`, `PbdBridgeBar`, `PbdOpenDlg`, `saveProjectAs`, `loadSaved`, `mergeInputs` | `model.js`, `library.js`, `legacy.js`, `ui/library.js` | project bar |
| `bxSuperRxPayload`, psSection / capacity senders, BridgeXfer bootstrap | `ui/handoffs.js` | project bar, Rating |
| input validation warnings at the top of `computeAll` | each module's input checks + `model.js validate()` | input tabs (dots), results |

---

## 11. Phases and PRs

Sizes: **S** one short PR; **M** one PR with tests; **L** a large PR or two. Each engine PR: module + its tab + report section + Node tests (hand check + parity) + fixlog entry (`fixlog/prestressed.md`). Parity numbers in each PR description.

### Switch-over blockers (P0–P5): today's app, feature for feature, proven equal

| # | PR | Size | Depends on |
|---|---|---|---|
| **P0 — set-up** | | | |
| 1 | `tests/engine/pbd-source.mjs` (today's code in Node) + generated parity set recorded + runner tag `ps` | M | — |
| 2 | `apps/prestressed/index.html` shell (two panels, tabs, project bar), `model.js` (schema, defaults = today's `DEFAULTS`), `fixlog/prestressed.md`, the CLAUDE.md §7 file-name list | M | — |
| **P1 — section, strands, loads** | | | |
| 3 | `data-sections.js` + `sections.js` with today's library (parity on every shape) | M | 1, 2 |
| 4 | `strands.js` (pattern, harp, debond, transfer, development; strand grid) + Strands input tab | M | 3 |
| 5 | `owners.js` (rules table moved), `loads.js` with `factors()` one source | M | 2 |
| 6 | `lldf.js` adapter (types k, f, g, b/c; NEXT reproduced as today) + Loads & LLDF tab | M | 3, 5 |
| **P2 — analysis** | | | |
| 7 | `analysis.js` on `shared/moving-load.js`: simple spans, stages, HL-93, fatigue, deflection load; parity with `hl93` | M–L | 5, 6 |
| 8 | Continuous units (5.12.3.3.1) on `shared/moving-load.js`; parity with `PBD.contFE` | M | 7 |
| 9 | `demandfile.js` (MIDAS import) + custom (entered) demands table | M | 7 |
| **P3 — girder checks** | | | |
| 10 | `losses.js` (approximate, refined, gains, per row) + Losses tab | L | 4, 7 |
| 11 | `stresses.js` (all stages and stations, release tension steel) + Stresses tab + heat map | L | 10 |
| 12 | `flexure.js` (approximate f_ps, min reinforcement, pier −M, full span) + Flexure tab | M | 10 |
| 13 | `shear.js` (MCFT, interface, 5.7.3.5) + Shear tab | L | 10 |
| 14 | `anchorage.js` + Anchorage & ends tab | S–M | 4, 11 |
| 15 | `continuity.js` (restraint, connection, 5.12.3.3.5, owner rules) + Continuity tab | M | 8, 10, 11 |
| 16 | `camber.js` + Camber & deflection tab | M | 10 |
| 17 | `fatigue.js` + Fatigue tab | S–M | 11 |
| **P4 — rest of today's features** | | | |
| 18 | `rating.js` (HL-93 flexure, shear, Service III) + Rating tab | M | 12, 13 |
| 19 | `handling.js` (today's screening) + Handling tab | S | 10 |
| 20 | `deck.js` (today's strip method), only if Q2 = keep | M | 5 |
| 21 | Report: `report/data.js`, `builders.js`, `ui/report.js` (everything today's report has; unresolved-link test empty) | M–L | 10–19 |
| 22 | Graphics on every tab (SVG kit, zoom/pan): section, elevation, envelopes, stresses, losses, shear zones, camber | L | 10–19 |
| 23 | 3D view (girder with strands and stirrups; bridge) | M | 22 |
| 24 | Auto design PR 1: strands, pattern, debond, f′ci for a given section (replaces Optimize) + compare view | L | 10–18 |
| 25 | Results grid (every girder × span × check) | S–M | 18 |
| **P5 — data, hand-offs, switch-over** | | | |
| 26 | `library.js` + undo/redo + Export/Import JSON | S–M | 2 |
| 27 | `legacy.js`: From old app (`psbeam.inputs.v1`, `psbeam.bridge.v1`, slices, files) + import test | M | 3–19 |
| 28 | Hand-offs (`lldf`, `dlLoads`, `superReactions` for every girder, `psSection`, `capacity`, `demands`, `designBeam`, `projectMeta`); cross-tool PR with MCT if a receiver changes | M | 18, 27 |
| 29 | Final comparison: import path on the whole parity set + your projects; every difference with its cause (as steel §d) | M–L | all above |
| 30 | Comparison document `docs/prestressed-comparison.md` (old vs new, as the steel one) for your decision | S | 29 |
| 31 | **Switch-over (after your approval):** `Prestressed Bridge Design.html` → redirect with data download; `psbeam.html` → new app; tools.html, MCT links, `appPaths` default, HANDOFF.md, CLAUDE.md §3/§7 lists | S–M | 30 + approval |

About 31 PRs (30 without the deck), plus 2–4 fix-up PRs for differences the comparison finds. P1–P3 modules can run two at a time (different files); the shell and model PRs come first.

### After switch-over (P6), in suggested order

| # | PR | Size | Needs |
|---|---|---|---|
| 32 | New sections from your sheets: NEBT, NEDBT, NEXT D, PCEF, spread box, office box/deck beams (data + outline check + LLDF type + drawings) | M per family | Q1 sheets |
| 33 | NEXT LLDF types (i)/(j) in `shared/lldf.js` (shared-file PR) | M | Q3 |
| 34 | Auto design PR 2: section family/depth, girder count/spacing, stirrups, price list, Lock/Range on every variable | L | 24, 32 |
| 35 | Strain-compatibility flexure (5.6.3.2.5) option | M | §4 callout |
| 36 | Drawings tab: girder sheet, framing plan, typical section, DXF | L | 22 |
| 37 | PCI (2016) / Mast handling | L | Q4 |
| 38 | Fatigue: cracked-section strand stress (PSB-O3a) | M | Q6 |
| 39 | Rating: legal / permit vehicles (`shared/vehicles.js`), owner target RFs | M–L | Q9 |
| 40 | Deck A13.4 overhang + owner tables | M | Q2 = keep |
| 41 | Bearings / every-girder reactions to Substructure Loading with the stage split | S–M | 28 |
| 42 | LL deflection and camber on continuous units via `deflection()` | S | 8 |
| 43 | Move the shared UI pieces (graphics kit, two-panel CSS, custom-demand table, library UI) into `shared/` (planned move, both apps' tests) | M | both apps stable |

---

## 12. What happens to the old PBD plan (PRs 0–14 of 2026-10-22)

Done: 0 (tests `--tool ps`), 1 (rename + redirect), 2 (shell, modes, bridge model), 3a/3b (owners), 6 (continuous 5.12.3.3), 13 (report, as the shared Report, PSRP/PSRF/PSRP2), 14 (MCT removal).

| Old PR | Proposal |
|---|---|
| 4 Shapes NEBT/NEDBT/NEXT D/F/PCEF/spread box/deck-box + span/depth | **Keep, in the new app** (P6 #32), from your sheets. Not added to the old app |
| 5 Preliminary + Suggest | **Replaced** by Auto design (#24, #34) |
| 7 Design all + every-girder superReactions + bearings | **Keep, in the new app**: the project is the whole bridge (#25, #28, #41) |
| 8 Strain-compatibility flexure | **Keep, new app** (#35) |
| 9 PCI / Mast handling | **Your call** (Q4) |
| 10 Deck A13.4 + owner tables | **Your call** (Q2) |
| 11 Rating vehicle library + owner targets | **Keep, new app** (#39) on `shared/vehicles.js` |
| 12 DXF + bridge 3D | **Keep, new app** (#23, #36) on `shared/dxf.js` and three.js |

**Old app from now on:** proposal: bug fixes only when you ask for them, no new features, so that the parity reference stays still (with steel you decided "never fix the old app"; Q7).

---

## 13. Questions for the engineer

1. **Section sheets (blocks #32).** Please provide your standard sheets (PDF or the drawing) for NEBT, NEDBT, NEXT D and F, PCEF, spread box beams, and any office versions of the AASHTO box and deck beams. Which values govern: the sheet's tabulated A, I, y_b (as today), or the properties computed from the outline? Which edition/date of each sheet? And please confirm what "PCEF" refers to so that it is named right in the library.
2. **Deck design: keep or drop?** Steel dropped deck slab and overhang design. Here: (a) port today's strip-method deck design as is and add A13.4 later, or (b) drop it from the new app (the old app keeps it until a deck tool exists)? Recommendation: (b), for the same reason as steel, unless you use it for prestressed jobs.
3. **NEXT F distribution (PSB-O4).** Type (i)/(j) per beam with S = beam width (today), or per stem with S = stem spacing? Which exterior rule (lever rule, or the interior DF × e)? Range-of-applicability checks: warn or refuse? NEXT D (no topping): K_g with the flange as the slab? Recommendation (as in the fixlog): type (i)/(j) acting as a unit, per beam, exterior by the lever rule, out-of-range warned.
4. **Handling (PSB-O1).** Implement PCI (2016) / Mast lifting and hauling (L), or keep the screening check?
5. **Strain compatibility:** wanted as an option (approximate f_ps stays the default)?
6. **Fatigue (PSB-O3a):** compute the strand stress range on the cracked transformed section at the strand centroid when the section is cracked under Fatigue I? (A calculation change, §4 callout.)
7. **Old app rule:** same as steel ("never fix the old app"; bug fixes only on your request)?
8. **Recorded projects:** can you provide 5–10 real prestressed projects (simple and continuous, different owners and sections) for the final comparison, as the 20 steel bridges?
9. **Rating:** which MBE edition, and do you want legal/permit vehicles and owner target RFs? Also the open φ_s-for-shear question (fixlog W4 / Needs engineer 5).
10. **Auto design:** debonding or harping first for end stresses (or per owner)? Owner-preferred strand size and f′c mixes (MassDOT 6.5 / 8.0 ksi)? A price list you want as the default?
11. **Continuity:** temperature gradient restraint (not computed today): keep out?
12. **Libraries (CLAUDE.md §2):** the new app drops React, Babel and Plotly and adds three.js r128 (the same pinned files the steel app uses) for the 3D view. OK?
13. **Edition labels (PSB-O8):** still to confirm against the printed 10th Ed. (fixlog "Needs engineer" 4); the new app cites 10th Ed. articles throughout.
14. **Approval of this plan:** layout `apps/prestressed/`, the phases, and the switch-over gate (P5 #29–#31) as for steel.

---

## 14. Uncertainty

- The PR count assumes the module boundaries of §4 hold. `computeAll` interleaves stages (gains feed stresses feed shear's f_po), so P3 modules may need a shared "state by stage" object; that is designed in PR #10.
- The closed-form HL-93 vs `shared/moving-load.js` agreement (§4.5) is expected, not yet checked.
- Today's tabs re-derive some worked values in JSX; where a tab shows a value `computeAll` does not return, the new module computes it and the test compares it with the tab's own expression (taken from the JSX in the vm).
- No calculation in this plan was run; the numbers quoted are from the fixlog.
