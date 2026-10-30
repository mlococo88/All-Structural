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
