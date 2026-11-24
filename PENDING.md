# PENDING.md — open items, decisions to verify, parked work

One list of everything that is not finished or not yet verified by the engineer. Details and check cases are in `ENGINEER_CHECKS.md` (item IDs below) and the fix logs. Update this file in the same PR whenever an item is added or closed.

Last updated: 2026-10-22 (merge of GirderDetail and ST-Girder: PR 1 done, later steps listed in section 3).

## 1. Decisions for the engineer to verify (built with a default, results may depend on them)

| Priority | Item | Tool | What to confirm | Where |
|---|---|---|---|---|
| **1** | CTDOT dead load distributed equally (OWN41) | GirderDetail | **Less conservative.** Turns some fails into passes, e.g. xsA GS7 1.048 → 0.999, builtin 28° GS7 1.016 → 0.972. Keep, or use the MassDOT method for CTDOT? | ENGINEER_CHECKS GD68(i) |
| 2 | GS20 design load rating method | GirderDetail | Girder section locations only; fatigue rated at GS17's limit state (may be Fatigue II); legal/permit vehicles pending | GD48 |
| 3 | MassDOT utilities in ST-Girder | ST-Girder | Rating, shear direction, web fatigue and 1.3R_hM_y treatment of the utility loads | GD65 (a)–(d) |
| 4 | Suggest panel: ranking when the girder count varies | GirderDetail | How the objective ranks counts for Full design | GD66 (f) |
| 5 | Owner phase 3b part 1 readings | GirderDetail | Shipping limits as warnings; RIDOT T2 thickness ratios; transition saving as weld equivalent; MassDOT quarter-point splices; CTDOT girder count/spacing as warnings; RIDOT skew G13; CTDOT construction wind advisory and L/100 camber shown separately | GD67 (a)–(g) |
| 6 | Owner phase 3b part 2 readings | GirderDetail | RIDOT 40 in diaphragm rule and X/K by S/d; CTDOT web-depth rule and channel table; CTDOT 4 bolts as a warning; MassDOT 0.5d uses girder depth; fascia stiffener rule incl. connection plates; RIDOT stiffener minimums; RIDOT fatigue categories (warns on B′ and studs); RIDOT jacking includes m and η | GD68 (a)–(h) |
| 7 | Circular pier as an equivalent square — chord through the anchor row (BCSQ, 2026-11-18) | Base Plate & Anchor Designer | Interpretation of the sketch: s_d = 2√(R² − o_d²) for each edge, square concentric with the pier; shear toward an edge on that edge's square, tension / pryout / side-face blowout on the smallest; rectangular §17.6.2.1.2 for the squares (circHefReduce for the exact circle only); bearing, §17.9 and the pier cage on the true circle. **Finding:** the chord square can be larger than the pier (Ø36, anchors ±6: s² = 1152 > πR² = 1018 in²) and then gives a higher φN_cbg than the exact circle (50.29 vs 30.04 kip). Default stays "Exact circle". | fixlog/BasePlateAnchorDesigner.md BCSQ |
| 8 | Rolled-beam (W-shape) girders as three plates (ROLL, 2026-11-23) | Steel Bridge Design (apps/steel-bridge) | ROLL-D1 to D9: the shape checked as its three plates b_f × t_f and D = d − 2 t_f by t_w, fillets left out (A_3/A 0.973–1.000, I_3/I_x 0.959–1.000); ROLL-CAP (2026-11-24): for the 23 shapes whose three plates exceeded the tabulated A, I_x, S_x or Z_x (up to 0.5 % A, 0.7 % I_x: W18X234, W18X192) both flanges are taken thinner by 0.0002–0.0209 in so that none of the four exceeds the table (web D, t_w kept; saved projects migrated on load); web depth not reduced for the fillets (slenderness on the safe side; V_p uses D between the flanges); weight = tabulated lb/ft; one steel grade required; no flange-to-web weld checks; fatigue category left as entered (default B, base metal of a rolled shape is A); plate Auto design off for rolled types, W-shape search in its place; .lga export writes the three plates | fixlog/steel-bridge.md ROLL |

### AASHTO LRFD 10th Ed. gaps (inventory 2026-10-19; engineer decision "follow the owner, else 10th")
All inventory items were fixed and merged on 2026-10-19 (engineer approved; PRs #324–#349). Each tool now states AASHTO LRFD 10th Ed. (2024), with the owner manual's edition noted where the tool has an owner setting. Details and check cases are in each tool's fix log. Remaining open questions:
- **Pile Designer:** φc default kept at 0.80 (engineer, 2026-10-19). Still open: the S_u < 0.50 ksf "soft" limit for group efficiency; whether loose sand over clay counts as "soft".
- **Spread Footing:** ~~depth-factor option keeps Vesić (building-footing tool, engineer 2026-10-19); the 10th Ed. arctan form is noted only.~~ The depth-factor option now uses the 10th Ed. Eq. 10.6.3.1.2a-10 arctan form with d_q ≤ 1.4 (SFLW L6, #1062, 2026-11-07). Q-SF1–Q-SF4 decided 2026-11-12 (engineer; fix log SFDL): nothing open.
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
- **MassDOT Bridge Manual Part II** (abutment): abutment/backwall/footing/seat/cover/frost minimums and the standard approach slab detail; **CTDOT standard sheets 6.4.1–6.4.3** (approach slab details). Needed to turn the abutment's approach-slab inputs and geometry minimums into owner defaults.

## 3. Parked features (agreed, not started)

- **D11** — calculation-sheet report (Gusset / ST-Girder format, with links to derivations per CLAUDE.md §6), one tool per PR, display only. Status 2026-10-18: done for Base Plate (#269/#270), Elastomeric (#273), Abutment (#274), Concrete Beam Capacity (#275, rebar tab synced #289), Shear & Moment (#276), Light Pole (#277), Stone Arch (#278), lldf (#279), psbeam (#280), Retaining Wall (#281), Pile (#282), index (#283), Spread Footing (#284), Timber (#285), Concrete Beam ASD (#286), Steel Beam (#287), ACI Rebar (#288), Section Property Calculator (#290), SubLoads (#291), Moving Load Generator (#292), ASCE7-16 Load Generator (#294). **D11 complete.** Engineer decisions raised in each PR's "Open items" section. Scope per tool decided 2026-10-18 (full / slim / refresh / none) — see AUDIT.md D11.
- **Suggest: steel grade options** — needs grade-dependent unit prices first (GD66 (e)).
- **MassDOT exterior sidewalk beam Case I / Case II** (3.5.3.11) — warning only today (GD63 (c)).
- **Low-priority owner items** from the manual reviews (mostly information-only notes).
- **Prestressed Bridge Design (PS-Beam grown into a bridge-level app, engineer decisions 2026-10-22):** **rebuild under way (no longer on hold; engineer 2026-11-12, PS-1…PS-14):** new folder app `apps/ps-bridge/` like the Steel Bridge app, PS engine moved in unchanged; plan `docs/ps-bridge-plan.md` (supersedes `docs/prestressed-rebuild-plan.md`); phases 1–3 being built; girder library and auto-design wait for the engineer's standard girder sheets (NEBT/NEDBT/NEXT/box); 5–10 real projects requested for the switch-over comparison. Old app: phase 1 done 2026-10-22: harness (#413), capacity label (#415), rename with `psbeam.html` redirect (#417), shell (#418), owner rules (#419), RIDOT connection M_cr on the composite section with the deck/diaphragm f_r (#420), continuous analysis 5.12.3.3 with C5.12.3.3.2 restraint (#421), PS-Beam overlay removed from the MCT (#424). Remaining:
  - Standard shapes (NEBT/NEDBT/NEXT D/F, PCEF, spread box, deck-box) + span/depth: **blocked on the engineer's section-property and strand-grid sheets** (not in the Part I manuals).
  - Engineer to note: the default BT-72 fails MassDOT/CTDOT hold-down (94.8 vs 74.3 kip, 2·n_h·f_pbt·A_b·sin α ≤ 0.75 W, reading confirmed) and, with continuity + restraint on (AASHTO/CTDOT default), the pier check (1.136) and bottom compression near the pier (1.047) from the negative differential-shrinkage restraint. Real results; default design not changed.
  - Not yet built: deck bar crack control at the pier (5.6.7; needs bar spacing/exposure inputs); restraint moments in the MBE ratings; temperature-gradient and axial restraint; continuous-span LL deflection and fatigue (simple-span estimates today).
  - Later phases (PLAN): prelim + Suggest, design all + every-girder superReactions + bearings, strain-compatibility flexure option, handling (PCI/Mast), deck A13.4 + owner tables, rating vehicle library, DXF + bridge 3D, combined report.
- **Steel Bridge Design switch-over: done 2026-11-19.** The old single-file app is archived as `archive/Steel Bridge Design (archived 2026-11-19).html` (not maintained); `Steel Bridge Design.html` redirects to `apps/steel-bridge/index.html`, the only Steel Bridge Design. The item below describes the archived app.
- **Steel Bridge Design merge (GirderDetail + ST-Girder): done 2026-10-22** (#410 embed, #411 live link and Update banner, #412 one title block and report, #414 one project file and refactor, cut-over SBD6: stgirder.html removed, tools.html one card). Still open: (1) the calculation differences between the two parts (modular ratio n, load factors max/min, shear basis, constructibility, …; see the merge plan's overlap matrix) stay as they are until decided item by item (separate §4 PRs); (2) PLAN step 7 (optional): KaTeX → MathJax in ST-Girder, then a tab-by-tab port that drops React/Babel; (3) stage 2 unification of the differing checks is in progress (S2-1…S2-9; S2-5 LLDF display done #426). CLAUDE.md updated for the cut-over (#423).

- **Abutment calculator — open items (review 2026-10-20, see scratchpad abrev2/review.md):**
  - Approach slab module — done 2026-10-20 (#391, fixlog APS: LS removal per MassDOT 3.3.1.3 / CTDOT CT11.1 / AASHTO 3.11.6.5, slab DC+HL-93 reaction on a backwall shelf, shelf corbel 5.8.4.2, integral sliding friction, slab one-way design, EE inertia). DOT rules: CTDOT 11.14CT 16 ft × 1.25 ft, skew ≤ 35° follows skew, required on State highways; MassDOT 3.10.4 / RIDOT 11.3.2 required with integral abutments, sliding at the abutment.
  - Keeper blocks / anchor bolts / shear key (14.8.3); settlement (10.6.2.4) and global stability (11.6.3.7) beyond flags; scour cases (MassDOT EE II check flood, CTDOT Extreme Event III); CE, FR/PTFE, Strength II, WS on the substructure; pile group effects and batter piles; compaction pressure, water head, strip surcharge; stem bar cut-offs, pedestal design.
  - Hand-offs: SubLoads → abutment owner and site class (and CE/FR/BR couple); independent wingwall → Retaining Wall Designer.
- **Pile Designer — open items (review 2026-10-20, see scratchpad pdrev/review.md):** Nordlund/β/CPT/rock-socket static methods; neutral plane, downdrag settlement and group settlement (10.7.2.3); group uplift (10.7.3.11); battered piles; pipe, concrete-filled and prestressed piles; liquefaction/seismic; pier pile-cap design (no tool covers it); §6 work for H-pile modules 01/03–09; resistance-vs-depth and P-M figures; interactive figures like the abutment's.

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
