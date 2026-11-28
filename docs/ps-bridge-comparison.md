# PS Bridge: old app vs new app (switch-over comparison)

**Purpose:** the evidence for the switch-over (docs/ps-bridge-plan.md §5 row 10): what changes in the results when a design of the old **Prestressed Bridge Design.html** (frozen since PR 2a, #1448) is opened in the new app **apps/ps-bridge/index.html**. Every difference is listed with its cause and the decision or PR that made it. Nothing here changes a calculation.

**Date:** 2026-11-28, `origin/main` @ `656cbaca`. Code basis: AASHTO LRFD 10th Ed. (2024); MBE 4th Ed. (2026) for the rating along the girder.

**The engineer's own projects:** the engineer confirmed (2026-11-28) that no projects are saved in the old app, so there are none to compare. The comparison uses the built-in and test cases only.

---

## 1. Method

### 1.1 Cases (677)
| Set | Cases | What |
|---|---|---|
| recorded | 38 | the old app's first open (`defaults`) and every saved design of `tests/projects/ps/*.json` (the 38 cases of `tests/ps-compare.mjs`) |
| tab | 19 | the harness B designs (`tests/engine/psbridge-tab-cases.mjs`), as the old app saves them (`psbeam.inputs.v1`) |
| seeded | 600 | the seeded cases of parity harness A (`tests/engine/psbridge-cases.mjs`: every shape, spans, interior / exterior, loss method, the four owners, continuity with and without restraint, draped strands, debonding, release steel, MIDAS demands, rating vehicles, handling, deck) |
| edge | 20 | the edge cases of harness A (blank or out-of-range inputs) |

### 1.2 Each case is taken into the new app the way the engineer will take it
The old saved design goes through the Project tab's **From the old app** import (`engine/legacy.js` `convert`), then what the page does with an imported project (`index.html` `replace`: girder types, PS-31 section correction, demands), then the new app computes the girder shown as its page does (`PSBDesign.inputs`, `PSBHoldDown.compute`).

### 1.3 Four stages, so that each difference is placed where it first appears
| Stage | What is computed | A difference from the stage before means |
|---|---|---|
| **A** | the old app: its own Babel-compiled engine (`oldEngine`, the page text at the pin), `computeAll(mergeInputs(saved))` | — |
| **B** | the moved engine (`engine/pbd-*.js`) on the same old inputs, with the old library entries (`PSBSections.withLegacy`) | the moved engine is not the old one. **Result: none** (B = A in every case the old app can compute; harness A, `tests/engine/psbridge-parity.test.mjs`, proves the same with tolerance 0) |
| **C** | the moved engine with this app's library (`engine/sections.js`) on the imported project's inputs | the library corrections (PS-30, PS-31, PS-38 to PS-40) or the import |
| **D** | what the new app shows: `PSBHoldDown.compute` (the app's engine additions after `computeAll`) | an app engine addition; each difference is put on the module whose removal alone takes it back to C |

What the tabs and the Report show is the engine's value (browser harness B, `tests/psbridge-compare.mjs`: every shown value and worked step = the engine value, 0 differences), so comparing the engine results compares what the engineer sees.

Compared per case: every check (`R.checks`: ratio and PASS / FAIL), the governing HL-93 rating factors (inventory, operating), the shear rating, the vehicle ratings, and any error. A ratio counts as changed when it moves by more than 1 × 10⁻⁹ (relative).

Reproduce: `node tests/psbridge-oldnew.mjs --out <json> --md <table>` (Node only, about 70 s; the full table of §5 is its `--md` output).

---

## 2. Results in one table

| | Cases |
|---|---|
| Every result identical, old → new | 78 (77 seeded, 1 edge) |
| Some value differs | 599 |
| Overall verdict (every check passes) changed | 57 |
| The old app could not compute, the new app can | 3 (tab designs that use a section only in the new library) |

**Every one of the 599 differs only through one of the causes in §3.** No difference came from the moved engine (stage A → B: none), and none was left without a cause.

### 2.1 Verdict changes (57)
| Old → new | Cases | Cause |
|---|---|---|
| PASS → FAIL | 17 | the PS-10 hold-down check (new, §3.4) fails: AASHTO / RIDOT designs with draped strands whose hold-down force is above 75 % of the beam weight |
| PASS → FAIL | 18 | the old library's box beam / voided slab corrected on import (PS-31) or the NEXT 28F I corrected (PS-38) (§3.1); in 2 of them also the (f)/(g) distribution factors (PS-35) and in 1 the LLDF range check (AP-B) |
| FAIL → input error | 19 | the old "Deck slab 27×48 (voided)": removed from the library (PS-31, its published values are not possible for its shape); the new app shows an input error naming it until another section is chosen |
| error → FAIL / PASS | 3 | tab designs using a section the old library does not have (the old app throws; not old designs) |

The old app's `defaults` design (PCI BT-72, 120 ft, 12 draped strands) is one of the 17: it passes in the old app and fails the PS-10 hold-down check in the new one (worked in §4.1).

---

## 3. Every difference and its cause

### 3.1 Library corrections (stage B → C; 131 cases, all with a box beam, voided slab or NEXT 28F)
- **PS-30 / PS-31 / PS-32 (engineer 2026-11-14; fixlog/ps-bridge.md, entry "PS-30 / PS-31 / PS-32", PR #1540):** the old library's AASHTO box beams (BI-36 … BIV-48) and voided deck slabs had section properties that do not match the standard plates (CTDOT BDM plates 5.2.1b, 5.1.1c, 5.1.2c). A design that used one of these names is moved on import to the corrected standard section of the same name (`engine/sections.js` MAP; the old values are kept in the project, `P.legacySection`, and the page and Report say so). Every check of such a design changes (A, I, y_b, weight → stresses, flexure, shear, deflection, rating). 98 cases change girder name; 19 keep the name with corrected values; the 27×48 voided slab is removed (input error, §2.1).
- **PS-38 (engineer 2026-11-14, PR #1554):** NEXT 28F at 144 in width, I 88,218 → 92,836 in⁴ (MassDOT Bridge Manual Part II dwg 9.2.3, the value the sheet's S_b and S_t are printed with): 12 seeded NEXT 28F cases (release and service stresses). PS-39 / PS-40 (strand-to-void clearance, CTDOT voided slab void spacing) change the strand fit and the drawn voids, not these results.
- **Not a difference:** PS-37 adds the MassDOT sections, which no old design uses.

### 3.2 PS-35: type (f) / (g) live-load distribution for adjacent boxes and voided slabs (stage C → D, `engine/lldf-fg.js`; 105 cases)
The old engine's distribution factors for adjacent box beams and voided slabs are replaced by the AASHTO type (f) / (g) factors (AASHTO LRFD 10th Ed. Art. 4.6.2.2.2 and 4.6.2.2.3, with J from the drawn outline or entered), engineer decision PS-35 (2026-11-14; fixlog/ps-bridge.md entry "PS-35", PR #1543). Every live-load result of those designs changes (flexure, shear, service tension, fatigue, deflection, the HL-93 and vehicle ratings). It is the cause of most C → D rating changes; in 10 cases it turns a fatigue or a strength check from FAIL to PASS and in 10 a service tension (top) from PASS to FAIL.

### 3.3 EZX / EZN: release tension steel by parts (stage C → D, `engine/reltension.js`; 481 cases, very small)
The concrete tensile force of AASHTO LRFD 10th Ed. Art. 5.9.2.3.1b (release, top and bottom; and the top steel near an interior support, 5.12.3.3.5) is summed exactly by parts instead of the old engine's 240 strips (PR #1720, approved 2026-11-25), and for a NEXT only over its two stems (PR #1721, approved 2026-11-25). The ratio of "Release tens. steel (5.9.2.3.1b)" moves by up to about 2 % (defaults: 0.0319 → 0.0325); no verdict changes.

### 3.4 PS-10: hold-down force for AASHTO and RIDOT (stage C → D, `engine/holddown.js`; 221 cases, 139 of them fail)
A check the old app did not make for these owners (MassDOT 3.7.2.2 and CTDOT V2 5.9.1.6 were already checked by the old engine). Engineer decision PS-10 (2026-11-12): box on by default, limit 75 % of the beam weight, editable on the Owner rules tab (`base.opt.hdCheck`, `hdFrac`). It is the only cause of the 17 PASS → FAIL verdicts that are not a section correction. See §4.1.

### 3.5 E1 / E1-D4 / E1-D5: the load rating along the girder (stage C → D, `engine/rating-along.js`; 2 cases)
The HL-93 rating at every station, φ_s = 1.0 for shear, and in positive flexure the minimum dead-load factors where a part relieves the moment (AASHTO LRFD 10th Ed. Table 3.4.1-2; MBE 4th Ed. (2026) 6A.4.2.1; engineer decisions 2026-11-21, PR #1660). In the cases here it changes the governing rating by 0.7 % (a continuous MassDOT design) and the shear / Type 3S2 rating by 8.8 % (the tab design with φ_c φ_s floored).

### 3.6 AP-B: LLDF ranges of applicability (stage C → D, `engine/applicability.js`; 26 cases)
A new failing check "LLDF range of applicability (4.6.2.2)" when a girder is outside the range of the distribution factor equations (AASHTO LRFD 10th Ed. Art. 4.6.2.2.1; PR AP-B, 2026-11-23). In this set it never changes a verdict on its own.

### 3.7 Changes that do not show in this comparison (no old design uses their inputs)
These §4 changes were merged since the old app was frozen; an old design imported unchanged keeps the old behaviour for them, and they apply when the engineer uses the new inputs:
- **PS-9 / PR 3a-3:** unequal bays and the Steel Bridge app's DC2 / DW distribution to each girder line. An imported design keeps its entered DC2 / DW; the distribution is used only when switched on (Cross-section tab).
- **PS-19 / PS-20:** the exterior rigid section and d_e on the real girder lines: an imported design has one girder line and its entered d_e (no change found here).
- **PR 9 / BARG:** cross-section load items and barrier geometry; **PL-A:** pedestrian live load; **UT-N:** utilities; **LL-O:** the two LLDF options (off by default); **DD:** the deck distribution steel on the effective span (only with the deck design on; no tested old deck design changed its checks list); **PS-34:** pier compression block (a warning only).
- **NOMCT (2026-11-25):** the new app has no MCT input: an old design's MIDAS demands are converted to the custom demand table when exact, else kept read only (in this set the MIDAS cases computed the same values through the import).

### 3.8 Open §4 PRs (not merged, not in this comparison)
#1722 (haunch profile), #1723 (haunch hand-off), #1724 (DC1 haunch), #1726 (NEXT F LLDF per stem), #1728 (shear stirrup spacing), #1739 (camber tolerance), #1740 (NEXT F flange 4 in). Each lists its own result changes; they are the engineer's to approve separately.

---

## 4. Worked check cases

### 4.1 The old app's default design: PASS → FAIL by PS-10
PCI BT-72, L = 120 ft, AASHTO, 12 draped strands (0.6 in, A_b = 0.217 in²), y_end = 60 in, y_mid = 8 in, hold-down at frac = 0.40, f_pbt = 202.5 ksi, w_sw = 0.82559 klf, girder end at the bearing (L_g = 120 ft).
- tan α = (y_end − y_mid) / (12 · frac · L) = (60 − 8) / (12 · 0.40 · 120) = 52 / 576 = 0.090278 → α = 0.090034 rad, sin α = 0.089912
- F_str = f_pbt · A_b · sin α = 202.5 · 0.217 · 0.089912 = 3.951 kip
- F_hd = 2 · n_h · F_str = 2 · 12 · 3.951 = 94.82 kip
- W = w_sw · L_g = 0.82559 · 120 = 99.07 kip; limit = 0.75 W = 74.30 kip
- ratio = 94.82 / 74.30 = **1.276 > 1.0: FAIL** (old app: no such check for AASHTO, so the design passed).
- Every other check of this design is identical except "Release tens. steel (5.9.2.3.1b)": 0.0319 → 0.0325 (§3.3).

### 4.2 Release tension steel by parts (EZX), same design
The steel required for the tensile force over the tension zone at release (Art. 5.9.2.3.1b; top, 4 ft from the girder end): old engine (240 strips) 0.01976 in² → summed by parts 0.02018 in²; provided 0.62 in²; ratio 0.0319 → 0.0325, PASS both.

---

## 5. Full table (output of `tests/psbridge-oldnew.mjs`)
Stage AB: old app → moved engine; BC: → this app's library on the imported inputs; CD: → the app's engine additions (cause = the module whose removal alone takes the difference back). "Largest change" is the case with the largest relative change of the ratio.

| Stage | Item | Kind | Cause (C→D: the module whose removal takes it back) | Cases (recorded / tab / seeded / edge) | → FAIL | → PASS | Largest change (case: old → new) |
|---|---|---|---|---|---|---|---|
| AB | (error) | error |  | 3 (0 / 3 / 0 / 0) |  |  | box BIII-36, no topping, debonded row, diaphragm, RIDOT: Cannot read properties of undefined (reading 'next') → — |
| BC | Splitting steel (5.9.4.4) | ratio |  | 112 (5 / 0 / 107 / 0) |  |  | seed268:shape_AASHTO_BI_36_12in,ext,approx,MassDOT,cont2r: 0.6819 → 0.6388 (6.33 %) |
| BC | Fatigue I (strand) | ratio |  | 109 (5 / 0 / 104 / 0) |  |  | seed100:shape_AASHTO_BII_36_18in,approx,RIDOT,cont2: 0.5426 → 0.2908 (46.39 %) |
| BC | HL-93 rating RFinv | rating |  | 109 (5 / 0 / 104 / 0) |  |  | seed564:shape_AASHTO_BIV_48_33in,approx,CTDOT,cont2r,debond,rate: -0.0152 → 0.8308 (5567.83 %) |
| BC | HL-93 rating RFopr | rating |  | 109 (5 / 0 / 104 / 0) |  |  | seed564:shape_AASHTO_BIV_48_33in,approx,CTDOT,cont2r,debond,rate: -0.0197 → 1.0770 (5567.83 %) |
| BC | shear rating RFinv | rating |  | 107 (5 / 0 / 102 / 0) |  |  | seed136:shape_AASHTO_BI_36_12in,approx,MassDOT,debond,midas+,rate,hand,deck: -0.0534 → 1.2110 (2366.60 %) |
| BC | shear rating RFopr | rating |  | 107 (5 / 0 / 102 / 0) |  |  | seed136:shape_AASHTO_BI_36_12in,approx,MassDOT,debond,midas+,rate,hand,deck: -0.0693 → 1.5699 (2366.60 %) |
| BC | Deck comp | ratio |  | 106 (5 / 0 / 101 / 0) |  |  | seed400:shape_AASHTO_BI_36_12in,MassDOT,rate,hand: 4.7091 → 2.1144 (55.10 %) |
| BC | LL deflection | ratio |  | 106 (5 / 0 / 101 / 0) |  |  | seed235:shape_AASHTO_BI_36_12in,approx,cont3,debond,rate: 15.5974 → 4.2237 (72.92 %) |
| BC | Fatigue I (concrete, 5.5.3.1) | ratio |  | 103 (5 / 0 / 98 / 0) |  |  | seed298:shape_AASHTO_BII_36_18in,ext,approx,MassDOT,debond,hand: 0.2761 → 0.4205 (52.34 %) |
| BC | Srv comp (full) | ratio |  | 97 (5 / 0 / 92 / 0) |  |  | shape_AASHTO_BII_36_18in: 0.1731 → 0.0000 (100.00 %) |
| BC | Interface shear (5.7.4) | ratio |  | 95 (5 / 0 / 90 / 0) |  |  | seed004:shape_AASHTO_BI_36_12in,ext,CTDOT,debond,rate,deck: 0.4861 → 0.2278 (53.14 %) |
| BC | Srv comp (perm) | ratio |  | 94 (5 / 0 / 89 / 0) |  |  | shape_AASHTO_BIII_36_27in: 0.1505 → 0.0000 (100.00 %) |
| BC | Release comp | ratio |  | 93 (4 / 0 / 89 / 0) |  |  | seed331:shape_AASHTO_BII_36_18in,approx,cont2,debond,deck: 0.4149 → 0.6857 (65.26 %) |
| BC | Flexure | ratio |  | 93 (5 / 0 / 88 / 0) |  |  | seed499:shape_AASHTO_BI_36_12in,approx,CTDOT,cont2,debond,midas+: 7.7891 → 2.1722 (72.11 %) |
| BC | Long. reinf (5.7.3.5) | ratio |  | 93 (5 / 0 / 88 / 0) |  |  | seed034:shape_AASHTO_BII_36_18in,ext,CTDOT,deck: 0.7838 → 0.1830 (76.65 %) |
| BC | Shear | ratio |  | 89 (5 / 0 / 84 / 0) |  |  | seed268:shape_AASHTO_BI_36_12in,ext,approx,MassDOT,cont2r: 7.8083 → 1.7291 (77.86 %) |
| BC | Release tens | verdict |  | 74 (4 / 0 / 70 / 0) | 74 |  | seed532:shape_AASHTO_BI_36_12in,ext: 0.0000 → 4.8515 (485145607282493.75 %) |
| BC | Min reinf | ratio |  | 73 (5 / 0 / 68 / 0) |  |  | seed004:shape_AASHTO_BI_36_12in,ext,CTDOT,debond,rate,deck: 0.9341 → 0.2693 (71.17 %) |
| BC | Release tens. steel (5.9.2.3.1b) | verdict |  | 63 (4 / 0 / 59 / 0) | 63 |  | seed199:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont2,rate,hand: 0.0000 → 5.8869 (588692834095505.00 %) |
| BC | Srv tens (top) | ratio |  | 63 (1 / 0 / 62 / 0) |  |  | seed429:shape_AASHTO_BIII_36_27in,approx,CTDOT,rate: 0.0000 → 0.9927 (99267348022525.53 %) |
| BC | Srv III tens | ratio |  | 59 (0 / 0 / 59 / 0) |  |  | seed003:shape_AASHTO_BIV_48_33in,ext,debond,hand: 0.1392 → 0.0000 (100.00 %) |
| BC | Srv III top tens (pier, 5.12.3.3.5) | ratio |  | 43 (0 / 0 / 43 / 0) |  |  | seed036:shape_AASHTO_BIV_48_33in,ext,RIDOT,cont4: 1.7776 → 2.7895 (56.93 %) |
| BC | Min reinf | verdict |  | 39 (0 / 0 / 39 / 0) |  | 39 | seed532:shape_AASHTO_BI_36_12in,ext: 1.0307 → 0.3233 (68.63 %) |
| BC | Release tens | ratio |  | 38 (1 / 0 / 37 / 0) |  |  | seed067:shape_AASHTO_BII_36_18in,ext,RIDOT,cont2r: 0.0000 → 0.9775 (97750457995650.33 %) |
| BC | Neg flexure (pier) | ratio |  | 38 (0 / 0 / 38 / 0) |  |  | seed268:shape_AASHTO_BI_36_12in,ext,approx,MassDOT,cont2r: 4.9331 → 1.7698 (64.12 %) |
| BC | Release tens. steel (5.9.2.3.1b) | ratio |  | 37 (1 / 0 / 36 / 0) |  |  | seed499:shape_AASHTO_BI_36_12in,approx,CTDOT,cont2,debond,midas+: 18.9400 → 3.8942 (79.44 %) |
| BC | Srv tens (top) | verdict |  | 36 (4 / 0 / 32 / 0) | 36 |  | seed364:shape_AASHTO_BII_36_18in: 0.0000 → 2.5049 (250488988524251.75 %) |
| BC | Srv comp (bot, −M, 5.12.3.3.5) | ratio |  | 35 (0 / 0 / 35 / 0) |  |  | seed432:shape_AASHTO_BIV_48_33in,cont4,debond,hand: 0.6153 → 0.8406 (36.62 %) |
| BC | vehicle rating V1 | rating |  | 27 (0 / 0 / 27 / 0) |  |  | seed136:shape_AASHTO_BI_36_12in,approx,MassDOT,debond,midas+,rate,hand,deck: -0.0361 → 0.8007 (2319.92 %) |
| BC | Lifting FS (crack, screening) | ratio |  | 26 (0 / 0 / 26 / 0) |  |  | seed151:shape_Deck_slab_21_48_voided,ext,debond,hand: 0.0737 → 0.2598 (252.39 %) |
| BC | Hauling FS (crack, screening) | ratio |  | 25 (0 / 0 / 25 / 0) |  |  | seed151:shape_Deck_slab_21_48_voided,ext,debond,hand: 0.0222 → 0.0407 (83.77 %) |
| BC | Lifting stress | verdict |  | 24 (0 / 0 / 24 / 0) | 24 |  | seed400:shape_AASHTO_BI_36_12in,MassDOT,rate,hand: 0.0000 → 1.8512 (185116564122276.00 %) |
| BC | Release comp | verdict |  | 19 (1 / 0 / 18 / 0) | 19 |  | seed366:shape_AASHTO_BIV_48_33in,approx,CTDOT,cont4r,debond,deck: 0.7319 → 1.0685 (45.99 %) |
| BC | (error) | error |  | 19 (1 / 0 / 18 / 0) |  |  | shape_Deck_slab_27_48_voided: — → Cannot read properties of undefined (reading 'next') |
| BC | Shear | verdict |  | 19 (0 / 0 / 19 / 0) |  | 19 | seed136:shape_AASHTO_BI_36_12in,approx,MassDOT,debond,midas+,rate,hand,deck: 4.9701 → 0.9046 (81.80 %) |
| BC | Interface shear (5.7.4) | verdict |  | 17 (0 / 0 / 17 / 0) |  | 17 | seed331:shape_AASHTO_BII_36_18in,approx,cont2,debond,deck: 1.3500 → 0.4919 (63.56 %) |
| BC | Long. reinf (5.7.3.5) | verdict |  | 16 (0 / 0 / 16 / 0) |  | 16 | seed234:shape_AASHTO_BIV_48_33in,ext,cont3r,rate,hand: 1.0007 → 0.2873 (71.29 %) |
| BC | Flexure | verdict |  | 16 (0 / 0 / 16 / 0) |  | 16 | seed232:shape_AASHTO_BII_36_18in,RIDOT,rate,hand: 1.0388 → 0.3963 (61.85 %) |
| BC | Deck −M | ratio |  | 16 (0 / 0 / 16 / 0) |  |  | seed598:shape_AASHTO_BI_36_12in,RIDOT,deck: 0.7867 → 0.7904 (0.48 %) |
| BC | Srv comp (perm) | verdict |  | 14 (0 / 0 / 14 / 0) |  | 14 | seed268:shape_AASHTO_BI_36_12in,ext,approx,MassDOT,cont2r: 1.8880 → 0.7958 (57.85 %) |
| BC | vehicle rating V2 | rating |  | 14 (0 / 0 / 14 / 0) |  |  | seed564:shape_AASHTO_BIV_48_33in,approx,CTDOT,cont2r,debond,rate: -0.0110 → 2.2562 (20572.71 %) |
| BC | Srv comp (full) | verdict |  | 13 (0 / 0 / 13 / 0) |  | 13 | seed268:shape_AASHTO_BI_36_12in,ext,approx,MassDOT,cont2r: 1.9229 → 0.9319 (51.54 %) |
| BC | Release tens (+M, bot) | verdict |  | 10 (0 / 0 / 10 / 0) |  | 10 | seed067:shape_AASHTO_BII_36_18in,ext,RIDOT,cont2r: 3.4620 → 0.0000 (100.00 %) |
| BC | Top tens. steel (pier, 5.12.3.3.5) | ratio |  | 9 (0 / 0 / 9 / 0) |  |  | seed100:shape_AASHTO_BII_36_18in,approx,RIDOT,cont2: 3.1851 → 4.0189 (26.18 %) |
| BC | Lifting stress | ratio |  | 9 (0 / 0 / 9 / 0) |  |  | seed297:shape_AASHTO_BIII_36_27in,approx,MassDOT,midas+,hand,deck: 0.2305 → 0.9541 (313.82 %) |
| BC | Fatigue I (concrete, 5.5.3.1) | verdict |  | 9 (0 / 0 / 9 / 0) |  | 9 | seed268:shape_AASHTO_BI_36_12in,ext,approx,MassDOT,cont2r: 1.7815 → 0.9172 (48.51 %) |
| BC | Srv comp (bot, −M, 5.12.3.3.5) | verdict |  | 8 (0 / 0 / 8 / 0) | 6 | 2 | seed036:shape_AASHTO_BIV_48_33in,ext,RIDOT,cont4: 0.9888 → 1.3239 (33.90 %) |
| BC | LL deflection | verdict |  | 6 (0 / 0 / 6 / 0) |  | 6 | seed136:shape_AASHTO_BI_36_12in,approx,MassDOT,debond,midas+,rate,hand,deck: 2.0447 → 0.5541 (72.90 %) |
| BC | Deck comp | verdict |  | 6 (0 / 0 / 6 / 0) |  | 6 | seed136:shape_AASHTO_BI_36_12in,approx,MassDOT,debond,midas+,rate,hand,deck: 1.7398 → 0.7814 (55.09 %) |
| BC | Release tens (+M, bot) | ratio |  | 5 (0 / 0 / 5 / 0) |  |  | seed166:shape_AASHTO_BII_36_18in,MassDOT,cont2: 0.0827 → 0.0000 (100.00 %) |
| BC | Srv III tens | verdict |  | 5 (0 / 0 / 5 / 0) |  | 5 | seed561:shape_AASHTO_BIII_36_27in,ext,approx,MassDOT,hand: 2.0799 → 0.0000 (100.00 %) |
| BC | Neg flexure (pier) | verdict |  | 4 (0 / 0 / 4 / 0) |  | 4 | seed264:shape_AASHTO_BIII_36_27in,approx,RIDOT,cont3r,debond: 1.0268 → 0.6858 (33.21 %) |
| BC | Hauling FS (crack, screening) | verdict |  | 4 (0 / 0 / 4 / 0) |  | 4 | seed396:shape_AASHTO_BIII_36_27in,CTDOT,cont4r,hand,deck: 2.6942 → 0.8440 (68.67 %) |
| BC | Lifting FS (crack, screening) | verdict |  | 3 (0 / 0 / 3 / 0) |  | 3 | seed003:shape_AASHTO_BIV_48_33in,ext,debond,hand: 3.0794 → 0.9212 (70.09 %) |
| BC | Fatigue I (strand) | verdict |  | 3 (0 / 0 / 3 / 0) | 1 | 2 | seed367:shape_AASHTO_BI_36_12in,ext,RIDOT,cont2,debond: 1.6662 → 0.9705 (41.75 %) |
| CD | Release tens. steel (5.9.2.3.1b) | ratio | EZX / EZN release tension steel by parts (engine/reltension.js) | 481 (34 / 18 / 421 / 8) |  |  | seed005:cont_3span,ext,approx,MassDOT,h8@0.45,debond: 0.0000 → 0.0001 (11048203499.47 %) |
| CD | Hold-down force (PS-10) | added | PS-10 hold-down check (engine/holddown.js) | 221 (21 / 10 / 172 / 18) |  |  | defaults: — → 1.2762 |
| CD | HL-93 rating RFinv | rating | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 105 (7 / 4 / 94 / 0) |  |  | box BIII-36, no topping, debonded row, diaphragm, RIDOT: -0.1184 → -0.9171 (674.71 %) |
| CD | HL-93 rating RFopr | rating | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 105 (7 / 4 / 94 / 0) |  |  | box BIII-36, no topping, debonded row, diaphragm, RIDOT: -0.1535 → -1.1888 (674.71 %) |
| CD | shear rating RFinv | rating | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 105 (7 / 4 / 94 / 0) |  |  | seed184:shape_Deck_slab_21_48_voided,ext,approx,RIDOT,cont3,debond,deck: -0.0037 → 0.3824 (10380.11 %) |
| CD | shear rating RFopr | rating | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 105 (7 / 4 / 94 / 0) |  |  | seed184:shape_Deck_slab_21_48_voided,ext,approx,RIDOT,cont3,debond,deck: -0.0048 → 0.4957 (10380.11 %) |
| CD | Fatigue I (strand) | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 103 (7 / 3 / 93 / 0) |  |  | seed135:shape_AASHTO_BIV_48_33in,ext,CTDOT,cont2,deck: 0.6787 → 0.1551 (77.14 %) |
| CD | Interface shear (5.7.4) | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 102 (7 / 4 / 91 / 0) |  |  | seed004:shape_AASHTO_BI_36_12in,ext,CTDOT,debond,rate,deck: 0.2278 → 0.3311 (45.35 %) |
| CD | Flexure | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 99 (7 / 4 / 88 / 0) |  |  | box BIII-36, no topping, debonded row, diaphragm, RIDOT: 8.9593 → 2.6885 (69.99 %) |
| CD | Shear | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 99 (7 / 4 / 88 / 0) |  |  | seed004:shape_AASHTO_BI_36_12in,ext,CTDOT,debond,rate,deck: 0.2942 → 0.4458 (51.52 %) |
| CD | Deck comp | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 98 (7 / 4 / 87 / 0) |  |  | box BIII-36, no topping, debonded row, diaphragm, RIDOT: 6.6224 → 1.4940 (77.44 %) |
| CD | Long. reinf (5.7.3.5) | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 97 (7 / 4 / 86 / 0) |  |  | seed004:shape_AASHTO_BI_36_12in,ext,CTDOT,debond,rate,deck: 0.0845 → 0.1553 (83.82 %) |
| CD | LL deflection | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 96 (7 / 4 / 85 / 0) |  |  | box BIII-36, no topping, debonded row, diaphragm, RIDOT: 14.0069 → 1.8080 (87.09 %) |
| CD | Min reinf | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 95 (7 / 4 / 84 / 0) |  |  | seed034:shape_AASHTO_BII_36_18in,ext,CTDOT,deck: 0.6804 → 0.4060 (40.34 %) |
| CD | Srv tens (top) | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 84 (6 / 3 / 75 / 0) |  |  | box BIII-36 (39in), CTDOT plate rows 16 + 16 strands and 4 top strands, 6 in topping, 80 ft, 10 boxes: passes: 0.0000 → 0.0438 (4377536497477.25 %) |
| CD | Srv comp (full) | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 70 (3 / 4 / 63 / 0) |  |  | seed001:shape_AASHTO_BII_36_18in,ext,RIDOT: 0.0398 → 0.0000 (100.00 %) |
| CD | Top tens. steel (pier, 5.12.3.3.5) | ratio | EZX / EZN release tension steel by parts (engine/reltension.js) | 38 (1 / 1 / 36 / 0) |  |  | seed090:shape_NEXT_28F,approx,RIDOT,cont3,rate,hand: 2.9064 → 2.9066 (0.01 %) |
| CD | Srv III top tens (pier, 5.12.3.3.5) | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 36 (0 / 0 / 36 / 0) |  |  | seed496:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont4,debond,deck: 13.3159 → 8.1184 (39.03 %) |
| CD | Srv III tens | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 33 (0 / 1 / 32 / 0) |  |  | seed135:shape_AASHTO_BIV_48_33in,ext,CTDOT,cont2,deck: 0.0649 → 0.0000 (100.00 %) |
| CD | Neg flexure (pier) | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 28 (0 / 0 / 28 / 0) |  |  | seed199:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont2,rate,hand: 2.8354 → 1.3577 (52.12 %) |
| CD | Srv comp (bot, −M, 5.12.3.3.5) | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 25 (0 / 0 / 25 / 0) |  |  | seed496:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont4,debond,deck: 0.9791 → 0.6831 (30.24 %) |
| CD | Fatigue I (concrete, 5.5.3.1) | ratio | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 24 (0 / 0 / 24 / 0) |  |  | seed496:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont4,debond,deck: 0.9828 → 0.6363 (35.26 %) |
| CD | LLDF range of applicability (4.6.2.2) | added | AP-B LLDF ranges of applicability (engine/applicability.js) | 15 (0 / 0 / 9 / 6) |  |  | seed034:shape_AASHTO_BII_36_18in,ext,CTDOT,deck: — → 1.5000 |
| CD | LLDF range of applicability (4.6.2.2) | added | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) + AP-B LLDF ranges of applicability (engine/applicability.js) | 11 (0 / 0 / 11 / 0) |  |  | seed016:shape_Deck_slab_12_48_solid,approx,CTDOT,cont2r,debond: — → 1.4167 |
| CD | Srv tens (top) | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 10 (1 / 0 / 9 / 0) | 10 |  | seed199:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont2,rate,hand: 0.4669 → 1.0399 (122.70 %) |
| CD | Fatigue I (strand) | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 10 (0 / 1 / 9 / 0) |  | 10 | box BIII-36, no topping, debonded row, diaphragm, RIDOT: 2.9810 → 0.3495 (88.28 %) |
| CD | vehicle rating V1 | rating | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 9 (0 / 0 / 9 / 0) |  |  | seed199:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont2,rate,hand: 0.2830 → 1.0222 (261.25 %) |
| CD | Neg flexure (pier) | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 8 (0 / 0 / 8 / 0) |  | 8 | seed397:shape_AASHTO_BII_36_18in,RIDOT,cont4: 1.1527 → 0.8481 (26.43 %) |
| CD | Top tens. steel (pier, 5.12.3.3.5) | ratio |  | 8 (0 / 0 / 8 / 0) |  |  | seed135:shape_AASHTO_BIV_48_33in,ext,CTDOT,cont2,deck: 5.1891 → 3.4911 (32.72 %) |
| CD | Long. reinf (5.7.3.5) | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 8 (0 / 0 / 8 / 0) |  | 8 | seed199:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont2,rate,hand: 1.2970 → 0.3876 (70.11 %) |
| CD | LL deflection | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 7 (0 / 0 / 7 / 0) |  | 7 | seed135:shape_AASHTO_BIV_48_33in,ext,CTDOT,cont2,deck: 1.2467 → 0.5237 (57.99 %) |
| CD | Deck comp | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 7 (0 / 0 / 7 / 0) |  | 7 | seed199:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont2,rate,hand: 1.5840 → 0.7141 (54.92 %) |
| CD | Flexure | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 6 (0 / 0 / 6 / 0) |  | 6 | seed199:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont2,rate,hand: 1.6513 → 0.9487 (42.55 %) |
| CD | Shear | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 6 (0 / 0 / 6 / 0) |  | 6 | seed199:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont2,rate,hand: 2.4719 → 0.8688 (64.85 %) |
| CD | Fatigue I (concrete, 5.5.3.1) | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 4 (0 / 1 / 3 / 0) |  | 4 | box BIII-36, no topping, debonded row, diaphragm, RIDOT: 2.5259 → 0.8219 (67.46 %) |
| CD | Min reinf | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 3 (0 / 0 / 3 / 0) |  | 3 | seed018:shape_Deck_slab_18_48_solid,approx,RIDOT,debond: 1.0445 → 0.9070 (13.16 %) |
| CD | vehicle rating V2 | rating | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 3 (0 / 0 / 3 / 0) |  |  | seed429:shape_AASHTO_BIII_36_27in,approx,CTDOT,rate: 4.0643 → 4.2144 (3.69 %) |
| CD | Srv comp (full) | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 2 (0 / 0 / 2 / 0) |  | 2 | seed199:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont2,rate,hand: 1.2764 → 0.8350 (34.58 %) |
| CD | Srv III tens | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 2 (0 / 0 / 2 / 0) |  | 2 | seed199:shape_AASHTO_BII_36_18in,ext,approx,RIDOT,cont2,rate,hand: 5.1306 → 0.7056 (86.25 %) |
| CD | shear rating RFinv | rating | E1 / E1-D4 / E1-D5 load rating along the girder (engine/rating-along.js) | 1 (0 / 1 / 0 / 0) |  |  | handling and deck on, rating vehicles, φc φs floored: 1.2938 → 1.4076 (8.80 %) |
| CD | shear rating RFopr | rating | E1 / E1-D4 / E1-D5 load rating along the girder (engine/rating-along.js) | 1 (0 / 1 / 0 / 0) |  |  | handling and deck on, rating vehicles, φc φs floored: 1.6771 → 1.8246 (8.80 %) |
| CD | vehicle rating Type 3S2 | rating | E1 / E1-D4 / E1-D5 load rating along the girder (engine/rating-along.js) | 1 (0 / 1 / 0 / 0) |  |  | handling and deck on, rating vehicles, φc φs floored: 2.1129 → 2.2987 (8.80 %) |
| CD | Interface shear (5.7.4) | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 1 (0 / 0 / 1 / 0) | 1 |  | seed016:shape_Deck_slab_12_48_solid,approx,CTDOT,cont2r,debond: 0.9456 → 1.8000 (90.35 %) |
| CD | Srv comp (bot, −M, 5.12.3.3.5) | verdict | PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js) | 1 (0 / 0 / 1 / 0) |  | 1 | seed462:shape_AASHTO_BIII_36_27in,approx,RIDOT,cont2,debond,rate,deck: 1.0537 → 0.9958 (5.50 %) |
| CD | HL-93 rating RFinv | rating | E1 / E1-D4 / E1-D5 load rating along the girder (engine/rating-along.js) | 1 (0 / 0 / 1 / 0) |  |  | seed530:owner_MassDOT_cont,RIDOT,cont3r,h16@0.42,debond,midas+,rate: 2.7203 → 2.7008 (0.71 %) |
| CD | HL-93 rating RFopr | rating | E1 / E1-D4 / E1-D5 load rating along the girder (engine/rating-along.js) | 1 (0 / 0 / 1 / 0) |  |  | seed530:owner_MassDOT_cont,RIDOT,cont3r,h16@0.42,debond,midas+,rate: 3.5263 → 3.5010 (0.71 %) |
