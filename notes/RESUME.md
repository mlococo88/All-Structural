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
