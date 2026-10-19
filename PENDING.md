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
All inventory items were fixed and merged on 2026-10-19 (engineer approved; PRs #324–#349). Each tool now states AASHTO LRFD 10th Ed. (2024), with the owner manual's edition noted where the tool has an owner setting. Details and check cases are in each tool's fix log. Remaining open questions:
- **Pile Designer:** φc default kept at 0.80 (engineer, 2026-10-19). Still open: the S_u < 0.50 ksf "soft" limit for group efficiency; whether loose sand over clay counts as "soft".
- **Spread Footing:** depth-factor option keeps Vesić (building-footing tool, engineer 2026-10-19); the 10th Ed. arctan form is noted only.
- **Gusset:** the rating keeps the MBE 3rd Ed. φ (engineer); MBE article numbers still flagged "verify" (no MBE copy available).
- **Elastomeric:** with the MassDOT 0.03 rad tolerance the default pad needs restraint per 14.7.5.4 (accepted as is); n not increased for cover layers (conservative).
- **Rebar (ACI Rebar, CBC):** compression development does not divide by λ for lightweight concrete (notice shown); #14/#18 hooks flagged only; CBC γ3 option "0.76 — A615 Gr 75" names the wrong grade (10th: Gr 75 0.75, Gr 80 0.76).
- **Retaining Wall:** stem hook uses λrc from the stem bar's cover (straight ℓd shorter with the 0.3 floor); confirm.
- **abutment:** k_h0 = 1.2·A_s for Site Class A, B, B/C (11.6.5.2.1) not applied (Substructure Loading does apply it).
- **Substructure Loading:** 4.7.4.5 displacement amplification not implemented.
- **index (MCT):** old saved zones from rolled shapes read as welded until "Rolled shape" is ticked; Cb ≤ 3.0 cap applied only with Rm; §6 worked Fnc/Mnc still shown as a label.
- **ST-Girder:** RIDOT 6d minimum pitch not in the ownerRules hand-off; GirderDetail's example 7/8 × 4 in. studs fail h/d ≥ 5.0.
- **GirderDetail:** stud zones touching the 0.1L limit take n = 1.5 (inclusive edge); the Bearing stiffeners module has no flange grade / continuity input for the hybrid rule (note only).
- **Stone Arch:** Live Load tab worked example and node text treat axles under 2 ft as concentrated even when a spread credit is selected (display only).
Full per-tool inventory: session scratchpad aashto-ed/inventory.md.

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
