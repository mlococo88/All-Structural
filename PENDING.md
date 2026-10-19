# PENDING.md — open items, decisions to verify, parked work

One list of everything that is not finished or not yet verified by the engineer. Details and check cases are in `ENGINEER_CHECKS.md` (item IDs below) and the fix logs. Update this file in the same PR whenever an item is added or closed.

Last updated: 2026-10-18 (deflection item removed: already decided, LL8).

## 1. Decisions for the engineer to verify (built with a default, results may depend on them)

| Priority | Item | Tool | What to confirm | Where |
|---|---|---|---|---|
| **1** | CTDOT dead load distributed equally (OWN41) | GirderDetail | **Less conservative.** Turns some fails into passes, e.g. xsA GS7 1.048 → 0.999, builtin 28° GS7 1.016 → 0.972. Keep, or use the MassDOT method for CTDOT? | ENGINEER_CHECKS GD68(i) |
| 2 | GS20 design load rating method | GirderDetail | Girder section locations only; fatigue rated at GS17's limit state (may be Fatigue II); legal/permit vehicles pending | GD48 |
| 3 | MassDOT utilities in ST-Girder | ST-Girder | Rating, shear direction, web fatigue and 1.3R_hM_y treatment of the utility loads | GD65 (a)–(d) |
| 4 | Suggest panel: ranking when the girder count varies | GirderDetail | How the objective ranks counts for Full design | GD66 (f) |
| 5 | Owner phase 3b part 1 readings | GirderDetail | Shipping limits as warnings; RIDOT T2 thickness ratios; transition saving as weld equivalent; MassDOT quarter-point splices; CTDOT girder count/spacing as warnings; RIDOT skew G13; CTDOT construction wind advisory and L/100 camber shown separately | GD67 (a)–(g) |
| 6 | Owner phase 3b part 2 readings | GirderDetail | RIDOT 40 in diaphragm rule and X/K by S/d; CTDOT web-depth rule and channel table; CTDOT 4 bolts as a warning; MassDOT 0.5d uses girder depth; fascia stiffener rule incl. connection plates; RIDOT stiffener minimums; RIDOT fatigue categories (warns on B′ and studs); RIDOT jacking includes m and η | GD68 (a)–(h) |

### AASHTO LRFD 10th Ed. gaps (inventory 2026-10-19; engineer decision "follow the owner, else 10th")
Labels relabelled where every cited article checked out: Bridge Geometry (#324), Section Property Calculator (#325). The tools below use provisions the 10th Ed. defines differently, so their labels were NOT changed; each needs an engineer decision (result changes). Some already say "10th Ed." while using the older provision.
- **Rebar development (ACI Rebar, CBC Development & Splice, abutment, Retaining Wall):** ℓdb = 2.4 db fy/√f′c and hook 38 db fy/(60√f′c) are 9th Ed.; the 10th has a new ℓdb equation (5.10.8.2.1a), new λrc bounds (5.10.8.2.1c), new hook ℓdh (5.10.8.2.4), f′c up to 15 ksi; compression development renumbered to 5.10.8.2.2.
- **ST-Girder studs:** done 2026-10-19 (#335, engineer approved): 10th Ed. Qn = 0.70AscFu, φsc 1.00, Zr = (ΔF)n·Asc (Condition 9.2), studs on their own Fatigue I/II crossover, renumbers, owner edition statement (fix log A10).
- **GirderDetail studs:** done 2026-10-19 (#338): Qn = 0.70AscFu, φsc 1.00, Fatigue II Zr = (A/N)^(1/5)Asc (Condition 9.2), h/d ≥ 5.0. Open: lightweight h/d 7.0; keep the "Qn entered" override?; bearing stiffener web strip Fyw/Fys only below 0.7Fys (10th: whenever Fyw < Fys); n table 6.6.1.2.5-1 has no 40 ft row (fixlog AASHTO10-SC).
- **index (MCT):** Lp = 1.0rt√(E/Fy) vs 10th 1.1rt; new Cb equation.
- **Bridge Substructure Loading:** renumbers and MassDOT 9th Ed. note merged (#329). Seismic per 10th Ed. (entered 22-period AASHTO-USGS Sa table, SD1 per 3.10.6, critical/recovery/ordinary, kh0 1.2As on rock): branch claude/aashto10-subloads-seismic (awaiting approval; older projects keep their 2009 values and get no EQ until the table is entered).
- **psbeam:** debonding limits 25 % total / 40 % per row vs 10th 45 % per row plus termination rules.
- **CBC Beam Capacity:** lightweight shear φ 0.80 vs 10th 0.90.
- **Pile Designer:** group efficiency reduces in more cases than 10.7.3.9 (conservative); φc default 0.80.
- **Spread Footing:** depth factors (option) Vesić vs 10th arctan form, dq ≤ 1.4, Nq term only.
- **Stone Arch:** 3.6.1.2.6a LLDF 1.15 for buried structures vs tool's rule.
- **abutment:** As cited to 3.10.4.2 (deleted in 10th); several renumbered articles.
- **elastomeric:** cover-layer limit (10th: greater of 0.7hri and 5/16 in) and 14.7.6.4 citation: done 2026-10-19 (engineer approved). Still open: Method B anchorage uses H ≤ P_min/5 labelled 14.7.5.4; the 10th Ed. 14.7.5.4 test is θs/n ≥ 3εa/Si (fixlog E10 open items).
- **Gusset:** decided 2026-10-19 (engineer): the LRFR rating keeps the MBE 3rd Ed. φ (0.90 / 1.00 / 0.85); citations corrected to MBE, LRFD 10th 6.5.4.2 design values (0.75 / 0.80 / 0.65) noted as not used; fillers renumbered to 6.13.6.1.4 (#327, fix log C19).
Full per-tool list (OK / renumbered / changed): agent inventory of 2026-10-19 (session scratchpad aashto-ed/inventory.md).

## 2. Blocked — reference documents not available

Items marked "pending reference" in the owner rules panel. Add the documents to `Structural_References` to unblock.

- MassDOT Bridge Manual **Part II**: plate and weld minimums, deck/overhang tables, barrier weights, camber values, haunch and diaphragm details.
- **RIDOT Bridge Standard Details**: cross-frame stagger pattern and details.
- **CTDOT standard details/sheets**: cross-frame and diaphragm details.

## 3. Parked features (agreed, not started)

- **D11** — calculation-sheet report (Gusset / ST-Girder format, with links to derivations per CLAUDE.md §6), one tool per PR, display only. Status 2026-10-18: done for Base Plate (#269/#270), Elastomeric (#273), Abutment (#274), Concrete Beam Capacity (#275, rebar tab synced #289), Shear & Moment (#276), Light Pole (#277), Stone Arch (#278), lldf (#279), psbeam (#280), Retaining Wall (#281), Pile (#282), index (#283), Spread Footing (#284), Timber (#285), Concrete Beam ASD (#286), Steel Beam (#287), ACI Rebar (#288), Section Property Calculator (#290), SubLoads (#291), Moving Load Generator (#292), ASCE7-16 Load Generator (#294). **D11 complete.** Engineer decisions raised in each PR's "Open items" section. Scope per tool decided 2026-10-18 (full / slim / refresh / none) — see AUDIT.md D11.
- **Suggest: steel grade options** — needs grade-dependent unit prices first (GD66 (e)).
- **MassDOT exterior sidewalk beam Case I / Case II** (3.5.3.11) — warning only today (GD63 (c)).
- **Low-priority owner items** from the manual reviews (mostly information-only notes).

## 4. Known limits (documented, no action planned)

- Base Plate & Anchor built-in PROFIS check tab: msa3a (φN_cbg −42%, φV_cbg +127%) and struct2v1 (φN_cbg +17%, φV_cbg +52%) differ from their PROFIS 3.1.34 targets on main; to be reviewed. The struct2 cases also predate the 3.1.36 open stand-off behaviour (BP-C1).
- PROFIS export (Base Plate & Anchor, closed by the engineer 2026-10-16): W shapes other than W10X15, plate/column steel grades and the stand-off nut and washer height are not mapped — the export dialog and the file's report notes list them as "select/check in PROFIS"; W columns need a 90° rotation in PROFIS (noted in the dialog).
- Design all summary lists GS5/GS6 under "Fails" without an "out of scope" label (saved format).
- Automatic refresh can override a module "Get demands" from a different source while an older project's open-time refresh is still running; wait for it to finish (about 25 s).
- The section exactly 1 ft before each support is not stored in the check arrays (support-face value governs; tables and hand-offs show it).

## 5. How changes are run (to keep simple fixes fast)

- Verification tiers (docs/AGENT_BRIEF.md): Tier 0 wording/citations, Tier 1 display only, Tier 2 one owner or module, Tier 3 shared code only.
- Small fixes (a few lines, one place) are made directly, not through a sub-agent, and use Tier 0–1: typically 10–30 minutes.
- `tests/compare.mjs` answers "did anything else move?" in one command.
