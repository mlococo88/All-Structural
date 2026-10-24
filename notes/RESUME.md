# Resume: Steel Bridge Design stage 2 (paused 2026-10-23)

Engineer's trigger phrase: "continue with the steel bridge design app".

## Done (on main)
S2-1 n exact (#428), S2-2 R_b/F_crw + k = 7.2 (#429), S2-5 LLDF display (#426). Merge PRs #410–#414, cut-over #422.

## Remaining, in this order (branches on origin)
1. S2-3 load factors by sign: `claude/sbd-s2-3-loadfactors` (code + fixlog done; run tests, merge). **Unconservative today.**
2. S2-9 negative flexure / A6 (skew <= 20 deg enforced): `claude/sbd-s2-9-neg-flexure` (last commit has a PARTIAL st.json: re-record from runs).
3. S2-6 studs per zone: `claude/sbd-s2-6-studs-per-zone` (merge main, re-record st.json from runs).
4. S2-4 shear TFA: `claude/sbd-wip-s2-4` (draft stacked on old S2-3; rebuild on main after S2-3).
5. S2-8 constructibility (deck sequence, continuous CL, f_l via additive payload fields): `claude/sbd-s2-8-constructibility` (early draft). **Unconservative today.**
6. S2-7 LL deflection + camber from GD SA via payload fields: not started.

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
