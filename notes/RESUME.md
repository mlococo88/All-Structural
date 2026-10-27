# Resume: Steel Bridge Design stage 2 (paused 2026-10-27 19:35 UTC)

Engineer's trigger phrase: "continue with the steel bridge design app".

## Done (on main)
S2-1 n exact (#428), S2-2 R_b/F_crw + k = 7.2 (#429), S2-3 load factors by sign (#453), S2-4 shear TFA (#455), S2-5 LLDF display (#426), S2-6 studs per zone (#456, 92f690b), S2-9 neg flexure / A6 (#454, 2d4ee31). Merge PRs #410-#414, cut-over #422.
Test-only: Babel ">500KB deoptimised styling" note filtered in compare/st-span/sbd-verify (landed with S2-6).

## Remaining, in this order (branches on origin)
1. S2-8 constructibility: `claude/sbd-s2-8-constr` @ 4e0e13e. **Unconservative today** (builtin G2 pier-1 bottom flange 0.353 ST vs 0.421 GD GS14).
   - Merge origin/main (take main's Babel filter; drop the branch's duplicate commit 4e0e13e if it conflicts).
   - st subset showed st.checks/st.rating diffs in 2-3 of 14 cases: run the subset against origin/main first (`--a origin/main`) to confirm they are stale S2-3/S2-4 baselines, not S2-8.
   - Then re-record gd.stPayloads (3 gd cases), st subset, 2 `s28_*` cases, 6 interior cases; fixlog via agentC/mkfix28.py drafts (scratchpad, may be gone: rewrite from the branch diff); PR + merge.
   - gdConBlock was shortened after the last test run: re-test.
2. S2-7 LL deflection + camber: `claude/sbd-s2-7-defl-camber` @ 2fa53ea (on 92f690b, before S2-9 payloads). Merge main, regenerate gd_* payloads with --save-st, subset, re-record, PR with fixlog §4 draft. Preview: no LL flips; 10 MassDOT exterior girders lose LL check (GD SA3 na); builtin G2 delta 0.704 -> 0.500 in vs 1.650.
3. Final full suite: re-record tests/baselines/st.json and st_interior.json fully (S2-3/S2-4 left stale cases); re-run sbd-verify. gd.dxf hash changes daily (date in revision table): fix the test to mask the date, not the tool.

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
