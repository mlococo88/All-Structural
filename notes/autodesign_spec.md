# Auto design spec (engineer approved, 2026-10-29)

Auto design replaces Suggest, Optimize and the preliminary-sizing design helpers. Rename them to "Auto design" everywhere: UI, report and fixlog.

## Modes
1. **New design.** Start from the spans and cross-section, then choose:
   - the girder count;
   - plate sizes per zone;
   - flange transition locations;
   - splice locations.
2. **Refine current design.** Keep the layout; trim plate thicknesses and widths up or down. This replaces ST-Girder's Optimize.
3. **Check one change.** A what-if run, for example 7 girders, with the result compared against the current design.

## Inputs
One panel, saved in the project model under `autodesign`.

**Objective**, one of:
- lightest steel;
- shallowest depth;
- lowest cost.

The cost model is editable: $/lb of steel, $ per flange transition, $ per field splice, and $ per stiffener if cheap to add.

**Limits:**
- max web depth (and min if useful);
- plate thickness and width increments;
- minimum thicknesses and widths, including the owner minimums from `engine/owners.js`;
- the flange width-transition rules GirderDetail and Preliminary sizing enforce;
- stock and plate preferences, if GirderDetail has them.

**Locks:** pin any plate, zone or girder count; Auto design works around the locked items.

## Results
- A ranked list of the top N candidates (default 8). For each: weight, depth, girder count, number of transitions and splices, cost, governing ratio, and what governs (module, location and check id). Clicking a governing entry links to that check's steps.
- Compare any two candidates, or a candidate against the current design, side by side.
- **Apply** writes the candidate into the project. Undo is one click (keep the previous design snapshot).

## Engine
- `engine/autodesign.js` uses the same check modules as the final design: sections, analysis, flexure, shear, stiffeners, fatigue, studs, constructibility, cross-frames and splices. No separate simplified checks, so a candidate can never pass Auto design and then fail the real check.
- **Two stages:**
  1. A fast screen using the governing locations only (or a coarser station set).
  2. Full checks on the top candidates. A finalist that fails the full checks drops out and the next one replaces it.
- **Responsive UI:** run in chunks (`setTimeout` or `requestIdleCallback`), or in a Worker built from a Blob URL if that works from `file://`. Show progress and a Stop button.

## Parity and tests
Compare against GirderDetail's existing auto-design and Suggest functions (grep `runAutoDesign`, `suggest`, `PL` design/Alternatives) and ST-Girder's Optimize:
- On the recorded projects, Auto design in "match legacy" settings should find a design at least as good as the legacy one: equal or lower weight, with every check passing.
- Report the cases where it differs and why.

Also test that every candidate Auto design returns passes all modules on the full check.
