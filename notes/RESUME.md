# Resume: Steel Bridge Design stage 2 (all 9 items merged 2026-10-27 21:55 UTC)

Engineer's trigger phrase: "continue with the steel bridge design app".

## Done (on main)
S2-1 #428, S2-2 #429, S2-3 #453, S2-4 #455, S2-5 #426, S2-6 #456, S2-7 #457, S2-8 #458 (b9bee9a), S2-9 #454. Each tested on the subset only.

## Remaining
- Full suite done and baselines re-recorded: #459 (1c8ac0c, 2026-10-28). Stage 2 complete.
- gd.dxf hash changes daily (run date in the DXF): mask the date in the test, not the tool.
- Review the shortened gdConBlock (S2-8) rendered text once.

## Pending (engineer, 2026-10-28): Stage 2 Parts 2-3, not started
Port ST-only features natively into GD (deck slab, LRFR Inv/Op rating, Optimize, camber, nomenclature, girder sheets), then retire the ST frame (drop React/Babel/KaTeX, ~500 KB). About 16-22 PRs. Plan: notes/STAGE2.md Part 2 and Part 3. Needs engineer decisions first: ST stand-alone mode, MIDAS/MCT import, sign-off on the rating changes. Do after the report-tab work.

## Open engineer questions (not blocking)
1. Should GD send the full stiffener layout (ST uses one d_o per span from rowsBy)?
2. Should Preliminary sizing (pl-src) also get the k = 7.2 F_crw case?
3. lambda_rw: R_b (rbFactor) and A6.2.2 still use 5.7 sqrt(E/F_yc); 10th Ed. 6.10.1.10.2 uses c_rw (4.6-5.7), which S2-9 already uses for the A6 permission. Switch?
4. ST -M load rating still uses its own F_nc: switch to GD's?
5. Shear connectors module uses one bridge-wide b_eff (exterior, 96 in): check each girder type? (builtin G2 at 114 in still passes, 0.84)
6. S2-8: V_DCc not sent (GD GS16 uses V_DC1); OH1-OH5 sent per girder may differ from the Deck overhang module's rows.

## How
- Method per item: notes/STAGE2.md (Part 1). Rules: notes/S2BRIEF.md (scratchpad paths in it are gone; AASHTO 10th text is in the private Structural_References repo).
- Engineer standing directives: accurate not over-conservative; merge each PR when tests pass, no need to ask; subset tests per PR, full suite at milestones.
- Machine: the container crashed (likely out of memory) with 3 agents x several Chromium runs. Run browser tests one at a time: `flock <lockfile> node tests/... --jobs 1`, commit + push WIP after every step. Prefer 1-2 agents.
- Prestressed Bridge Design: ON HOLD by the engineer (phase 1 done; shapes need the engineer's sheets).

## Queued for next week (engineer, 2026-10-24) — after the steel bridge work
1. In-app Report tab (D11 report shown in the app, Print = same content) for the tools that are print-only or open a separate window:
   - print-only (14): Elastomeric, Abutment, Concrete Beam Capacity (+ embedded ASD/rebar), Shear & Moment, Stone Arch, lldf, Pile Designer, Spread Footing, Timber, Concrete Beam ASD, Steel Beam, ACI Rebar, Section Property Calculator, SubLoads, ASCE7-16;
   - separate window: Retaining Wall, index (MCT), Moving Load Generator.
   - Model: BasePlateAnchorDesigner RPT-2 (#451): one builder feeds the tab and print; Gusset-style layout; no controls in the report. Already have tabs: Light Pole, Prestressed Bridge Design, Gusset, Steel Bridge Design, Base Plate. One tool per PR.
2. Base Plate open questions:
   - AISC 360 edition for J3.10 (report says 360-16);
   - tension n_eff note says "within 1.5·h_ef", but the check uses 0.5·h_ef (fix wording);
   - tie epoxy field: move to 7a?;
   - plate offset ignored in the hairpin/closed-tie reference-row search (and c_a1 limited by 17.7.2.1.2) — fix?;
   - per-anchor custom hairpin mode not built.
