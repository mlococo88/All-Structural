# PENDING.md — open items, decisions to verify, parked work

One list of everything that is not finished or not yet verified by the engineer. Details and check cases are in `ENGINEER_CHECKS.md` (item IDs below) and the fix logs. Update this file in the same PR whenever an item is added or closed.

Last updated: 2026-10-16 (open stand-off question).

## 1. Decisions for the engineer to verify (built with a default, results may depend on them)

| Priority | Item | Tool | What to confirm | Where |
|---|---|---|---|---|
| **1** | CTDOT dead load distributed equally (OWN41) | GirderDetail | **Less conservative.** Turns some fails into passes, e.g. xsA GS7 1.048 → 0.999, builtin 28° GS7 1.016 → 0.972. Keep, or use the MassDOT method for CTDOT? | ENGINEER_CHECKS GD68(i) |
| 2 | GS20 design load rating method | GirderDetail | Girder section locations only; fatigue rated at GS17's limit state (may be Fatigue II); legal/permit vehicles pending | GD48 |
| 3 | MassDOT utilities in ST-Girder | ST-Girder | Rating, shear direction, web fatigue and 1.3R_hM_y treatment of the utility loads | GD65 (a)–(d) |
| 4 | Suggest panel: ranking when the girder count varies | GirderDetail | How the objective ranks counts for Full design | GD66 (f) |
| 5 | Owner phase 3b part 1 readings | GirderDetail | Shipping limits as warnings; RIDOT T2 thickness ratios; transition saving as weld equivalent; MassDOT quarter-point splices; CTDOT girder count/spacing as warnings; RIDOT skew G13; CTDOT construction wind advisory and L/100 camber shown separately | GD67 (a)–(g) |
| 6 | Owner phase 3b part 2 readings | GirderDetail | RIDOT 40 in diaphragm rule and X/K by S/d; CTDOT web-depth rule and channel table; CTDOT 4 bolts as a warning; MassDOT 0.5d uses girder depth; fascia stiffener rule incl. connection plates; RIDOT stiffener minimums; RIDOT fatigue categories (warns on B′ and studs); RIDOT jacking includes m and η | GD68 (a)–(h) |
| 7 | Open stand-off (no grout) in Base Plate & Anchor: anchor forces and clamped n | Base Plate & Anchor | PROFIS 3.1.36 examples 9/10: no concrete bearing (elastic bolt group, rods take compression: 0.5/−7/8/0.5 kip vs this tool 2.57/0/4.62/2.04) and n = 0 when clamped. The built-in PROFIS 3.1.34 cases (CB Plaza Struct 2, clamped) match concrete bearing and n = 0.5. Which applies? Change prepared (BP-C1), not merged | fixlog BP-C3; examples 9, 10 |

## 2. Blocked — reference documents not available

Items marked "pending reference" in the owner rules panel. Add the documents to `Structural_References` to unblock.

- MassDOT Bridge Manual **Part II**: plate and weld minimums, deck/overhang tables, barrier weights, camber values, haunch and diaphragm details.
- **RIDOT Bridge Standard Details**: cross-frame stagger pattern and details.
- **CTDOT standard details/sheets**: cross-frame and diaphragm details.

## 3. Parked features (agreed, not started)

- **D11** — calculation-sheet report (Gusset / ST-Girder format, with links to derivations per CLAUDE.md §6) in every other tool, one tool per PR, display only. Engineer: end of week. See AUDIT.md D11.
- **Suggest: steel grade options** — needs grade-dependent unit prices first (GD66 (e)).
- **MassDOT exterior sidewalk beam Case I / Case II** (3.5.3.11) — warning only today (GD63 (c)).
- **Low-priority owner items** from the manual reviews (mostly information-only notes).

## 4. Known limits (documented, no action planned)

- PROFIS export (Base Plate & Anchor, closed by the engineer 2026-10-16): W shapes other than W10X15, plate/column steel grades and the stand-off nut and washer height are not mapped — the export dialog and the file's report notes list them as "select/check in PROFIS"; W columns need a 90° rotation in PROFIS (noted in the dialog).
- Design all summary lists GS5/GS6 under "Fails" without an "out of scope" label (saved format).
- Automatic refresh can override a module "Get demands" from a different source while an older project's open-time refresh is still running; wait for it to finish (about 25 s).
- The section exactly 1 ft before each support is not stored in the check arrays (support-face value governs; tables and hand-offs show it).

## 5. How changes are run (to keep simple fixes fast)

- Verification tiers (docs/AGENT_BRIEF.md): Tier 0 wording/citations, Tier 1 display only, Tier 2 one owner or module, Tier 3 shared code only.
- Small fixes (a few lines, one place) are made directly, not through a sub-agent, and use Tier 0–1: typically 10–30 minutes.
- `tests/compare.mjs` answers "did anything else move?" in one command.
