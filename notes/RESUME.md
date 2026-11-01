# Resume: Steel Bridge rebuild (paused 2026-10-30, engineer at 80% of the weekly limit)

The new app lives in `apps/steel-bridge`. The old `Steel Bridge Design.html` is still the working tool and has every fix applied.

## Merged
Pilot, foundation, and these modules:
- loads/LLDF (shared/lldf.js), analysis, flexure (composite and non-composite), shear and stiffeners, fatigue and studs, constructibility, framing and cross-frames, splices, welds, rating
- KaTeX, Report tab (shared/report.js), drawings/3D/DXF (shared/dxf.js), import of old projects
- Old-app fixes: c_rw, LLDF items 1–4, pier skew rule, |θ|, GS7 NaN

## In flight when paused
- consistency (f_l, braces, cache)
- Auto design PR1
- drawings DW5 plus wheel zoom
- URGENT: pedestrian load and owner η/m in the new app

## Next, in order
1. Presentation A: grouped worked steps on every tab. See notes/presentation_spec.md.
2. Presentation B: graphics on every tab in the Drawings-tab style, with wheel zoom, pan and pinch, split over 2 agents.
3. Auto design PR2: compare, locks, cost. See notes/autodesign_spec.md.
4. Switch-over: final full comparison, then `Steel Bridge Design.html` redirects to `apps/steel-bridge`; update tools.html.

Agent brief: notes/wave_common.md (copy it to the scratchpad). Use 2–4 agents, one PR each.

## Auto design PR1 merged (#494)
For PR2:
- compare view, locks and cost editor;
- the 15 pending parity rows;
- rerun ST via `tests/engine/st-source.mjs`;
- add Rating and Welds to the full check.

Decision SB2-AD8 (lead, 2026-10-30): the splice auto-design uses the owner's edge distance for end distances (CTDOT 2 in); Auto design treats cross-frame bolt count (CF11) as a sizing rule. Implement in PR2.
- Consistency PR #497 merged. Auto design PR2 must also take f_ℓ and brace points from `SBDFraming.design` (it currently uses f_ℓ = 0 during deck placement).
- Open UI item: allow an explicit f_ℓ = 0 override on skewed bridges. Today 0 means "none entered".

## All 4 in-flight PRs merged (2026-10-30, 1:15 PM ET)
- #496 pedestrian load and owner η/m: merged.

OPEN ISSUE, highest priority for next session (Opus, calculation):
- Auto design's `payloadOf` (engine/autodesign.js, #494) builds a payload with no `V_LL` fields and passes it to `SBDShearUI.build`. Shear, transverse-stiffener and bearing checks inside Auto design may therefore run without LL+IM. This is unverified: read from code, not run. Verify, then fix. Auto design must not return a design as "passing" if its shear checks lacked live load.
- Also: Auto design takes f_ℓ and brace points from `SBDFraming.design` (see the earlier note).

Model plan: Sonnet 5.5 for presentation and UI work (grouping, graphics, Auto design compare/locks UI, switch-over plumbing); Opus 5.5 for anything touching calculations.

## Graphics merged (#498, #499, #500, polish #501), 2026-10-30
Every output tab has a Drawings-style graphic with zoom/pan/DXF. Lead reviewed the screenshots; most is clean.

Open items (small):
- CALCULATION, Opus: analysis.js splits the deck-pour sequence where the sign of M_DC1 changes. At the abutment M_DC1(0) = -1.6e-11 (round-off) counts as negative, so a spurious 1 ft "pour 4" (0 to 1 ft) is created and placed after the positive pours. Add a small tolerance to the sign test. §4 callout with hand check; expect a negligible effect on M_DCc. Also compare against GirderDetail's pour sequence.
- Test: tests/smoke/steel-bridge-report.mjs expects 12 report sections, there are now 13 (load rating). It fails on main. Update the expectation.
- Constructibility graphic: the blue selected-station line runs through the whole figure including the table and legend text. Limit it to the elevation and the plots.
- Loads graphic: a dimension extension line runs through the "TRAFFIC FACE" note.
- Shear: the panel hatching is dense behind the web text. Consider lighter hatching or a thinner overlay.
- Phone width (390 px): graphic text is 4 to 8 px, so the phone relies on zoom.
- Skipped on purpose: the optional 3D extruded section view.

## Update 2026-10-31 (paused until Tuesday 2026-11-03 morning ET, weekly usage reset)
Merged since last note: #502 graphics fix-up, #503 first-pour sign tolerance, #504 Shear & stiffeners tab (solid colours, new elevation + details, grouped worked steps trial; engineer approved the grouping look).
Model rule (engineer): Sonnet for simple/presentation tasks, Opus for calculation work and when in doubt.
Next, in order, when the engineer says go:
1. Apply grouped steps (shared/steps.js group helpers, see ui/shear.js TOPICS) to every other tab + report (Sonnet).
2. Auto design: verify missing V_LL in payloadOf (Opus); f_l and brace points from SBDFraming.design; AD8 splice end distances; CF11 bolt sizing; compare view PR2.
3. Switch-over comparison vs old app (Opus), redirect, tools.html.
Open small items: old-app first-pour sliver fix (ask engineer; one-line, own PR); Fatigue stud zones still hatched; "See see §" doubled word in report; STA label tight against FS1 and BARRIER label on Loads; f_l=0 override on skewed bridges.

## Update 2026-10-31 (later)
Merged: #505 grouping all tabs, #506 Spans & framing combined tab, #507 graphics touch-ups, #508 paths test fix, #509 comparison doc (docs/steel-bridge-comparison.md), #510 Auto design LL + f_l fix.
Engineer decisions: do NOT fix the old app at all; paper-space DXF later; keep "Example" demand source; Welds summary headlines governing strength check with min-size/taper listed under it; imported cross-frame DC1 weight from Cross-frames module members.
In progress: Auto design finish (Opus): every sizable input Lock / Range / Auto, compare view, cost editor, Rating+Welds in full check, no-framing brace fallback, re-run stale parity records.
Remaining blockers after that: GS1-GS4, external demand imports (+selfWeightExcluded), bridgeSuite hand-offs, AD8/CF11, final comparison, redirect.

## Next week (engineer, 2026-10-31)
- Saved-project library in the new Steel Bridge app: save/open/rename/delete several bridges directly in the app (no export/import needed), like the engineer's other apps (check how those apps do it, e.g. their localStorage project lists, and follow the same pattern; keys prefixed sbd2.*; keep autosave and Export/Import JSON). Add Undo if cheap.
- Pending engineer confirmation: Auto design overhang minimum tied to barrier width (Auto took 1.5 ft under a 1.5 ft barrier).
- Not done yet: Welds summary display (headline governing strength check, min-size/taper under it).
- Custom (manually entered) demands in every check module (engineer, 2026-10-31): each module's "Demands" dropdown (today: this project's analysis / Example / hand-off file) gets a "Custom (entered)" option. The engineer enters the forces per location (x, plus the module's unfactored components by load case or factored values directly, e.g. M_DC1, M_DC2, M_DW, M_LL+IM, M_PL for flexure; V's for shear; stress ranges for fatigue; reactions for bearing stiffeners; splice forces; cross-frame forces), and the module checks against them with the full worked steps. Saved with the project (new sbd2 fields, defaults, old projects load unchanged). Opus (it feeds calculations). Consider one shared custom-demand table component used by every module.
- Welds tab load factors (engineer, 2026-10-31, next week, Opus): remove the Welds tab's own γ_DC, γ_DW, γ_LL (Strength I) and γ Fatigue I inputs (ui/welds.js ~line 105, P.welds.gam); use the project's load factors like every other module; show them read-only with a link; keep the saved P.welds.gam values in the file (§5) and warn when an old project's values differ from the project's. §4 callout with before/after (equal at defaults 1.25/1.50/1.75/1.75).
- Also: defaults button on the Project tab should list what it changed (it edits Cross-section & loads and Materials & deck values). Ask about an owner cell in the per-sheet title block.
- Engineer decisions 2026-11-01: NO owner cell in the per-sheet title block. Auto design overhang minimum = a fixed minimum the engineer enters (one input on the Auto design tab, saved with the project; default 2.5 ft proposed, engineer can change); Auto never goes below it; owner limits still apply on top. Next week, Opus (small, §4 callout).
- Spread Footing.html (separate tool PR, next week, Sonnet): (1) rebar input exists but hidden: "Footing Reinforcement (Phase 2)" section (sec-rebar, collapsed) on the Materials input tab; move to its own Reinforcement input tab (or open + rename), show A_s/ft and spacing per mat, link from the Footing design tab; no calc change; keep data-paths freinf.* (§5). (2) Add a Report output tab using shared/report.js (nav tree, grouped worked steps, see-§ links, print). Fixlog fixlog/Spread Footing.md.
- Spread Footing (next week, Opus, §4 calc change): load location on the pedestal may be off-center. Add per-pedestal load offsets e_x, e_y (from the pedestal centroid, top of pedestal, same axes/sign convention as the Pedestals & Applied Loads card), applied to P of each load type (or direct factored P). The offset adds P·e to M_x/M_y in the footing bearing/stability/design AND in the pedestal design (pedestal axial + biaxial moment, and punching/moment transfer). Warn if the offset puts the load outside the pedestal. Show it in the schematic and 3D. Saved-data: new fields default 0 so old projects give identical results (test). §4 callout with before/after and hand check.
- Spread Footing (next week): Drawings output tab like the Steel Bridge app: sheets previewed in the app (shared SVG viewer: wheel zoom/pan/pinch, Fit) and Download DXF via shared/dxf.js (classic <script src>, works from file://). Sheets: footing plan (outline, pedestals with their loads' offsets, dimensions, x/y axes), sections in x and y (footing, pedestal, top/bottom mats with bar size and spacing, cover, embedment/soil line), pedestal detail, reinforcement schedule, general notes (codes, f'c, f_y, cover, bearing pressure), title block (no owner cell). Sonnet for drawing work; geometry from the app's existing model only, no calc change.
- Model rule update (engineer, 2026-11-01): ALL graphics/drawings work uses Opus (Sonnet made errors earlier). Calculation work: Opus. Sonnet only for simple non-graphic UI/text/storage tasks.

## 2026-11-01 evening: large parallel batch running (all Opus)
- Spread Footing follow-ups (tie cover, barfit d_b, P–M ratio, phone layout, full dowels).
- Steel Bridge follow-ups (scroll check, CF replace mode, Fatigue I one source, splices factors, stale note).
- Steel Bridge switch-over blockers B1–B5 (ext demands, bridgeSuite hand-offs, GS1–GS4/GS22, AD8, final comparison; no redirect without engineer OK).
- Report tabs rollout: plan scratchpad/report_plan.md; agents A (elastomeric, abutment, subloads), B (retwall, pile), C (shared lldf steps, lldf, prestressed, index), D (stone arch, MLG, gusset), E (aci rebar, CBC combined, steel beam, base plate), F (timber, S&M, sec prop, ASCE7, retire Concrete Beam ASD).
- Light Pole: review in scratchpad/lightpole_review.md; fixes+presentation agent running. Engineer decisions: add LTS mode LRFDLTS 2nd Ed. LATER (separate agent after current batch); keep 4 wind directions + warning; auto C_f; real nut area; anchor reinf default None + check when Provided; base plate LTS bending lines double-nut; ice map value with ASCE 7 factors. Open: Fig 29.3-1 s/h=0.7 row, EPA drag, deflection limits, N2–N5, N8.
- Light Pole: engineer 2026-11-01: NO changes to anything cable-related (cable wind, pull, inputs, load cases, results; no cable wind-direction warning). Cable results must stay identical.
