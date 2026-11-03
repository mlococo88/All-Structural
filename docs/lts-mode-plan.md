# Light Pole and Sign Post: AASHTO LRFDLTS mode, plan (Phase A, revised A2, B-0 and B-0b)

Tool: `Light Pole and Sign Post.html`. Status: **plan only; nothing in this document is implemented yet.** Written 2026-11-02 (US Eastern), revised the same day (Phase A2: owner amendments, §6; Phase B-0: 2017 interim packet; B-0b: provision map completed from the full 1st Edition, §0.1 findings, decisions Q-B/Q-C), for the engineer's request "Start the LTS mode for the sign and pole app".

**Decisions so far** (engineer, 2026-11-01 / 2026-11-02, via the coordinator):
- Add an **AASHTO LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and Traffic Signals (LRFDLTS), 1st Edition (2015) with the 2017 Interim Revisions** mode alongside the existing IBC 2021 / ASCE 7-22 / AISC 360-16 / ACI 318-19 mode.
- **Design basis (engineer, 2026-11-02):** LRFDLTS **1st Edition (2015) with the 2017 Interim Revisions**; the full book and the interim packet are in the reference library (§0). Later interims are not applied.
- The existing mode stays exactly as it is (same results for every saved project).
- Nothing cable-related changes. Cables stay in the IBC mode only; the LTS mode does not support them and says so on screen.
- The anchor rods are designed in the Anchorage app (BasePlateAnchorDesigner). The LTS mode exports its own LTS combinations through the existing `bridgeSuite.v1.anchorGroup` hand-off (HANDOFF.md §4.11, #610).
- The base plate uses the LTS bending-line method already in the tool (b_eff = πD/n at the pole face, flagged "verify", LP-5 / #561, LP-15 / #604).

**Rules for this work.** CLAUDE.md §4 (every formula, factor and reference called out with before/after, provision with edition, hand check), §5 (saved data), §6 (every value worked, with links), §7 (one tool per PR), §8 (fixlog). No LRFDLTS text is copied into the repo: this plan and the tool **cite** articles and **paraphrase**.

---

## 0. Design basis (read first)

**Design basis: AASHTO LRFDLTS 1st Edition (2015) with the 2017 Interim Revisions (LRFDLTS-1-I1).** Where the 2017 interim revises an article, the interim page replaces the book page. The engineer provided both documents on 2026-11-02:
- `AASHTO LRFD - Signs - Luminaires - Signals.pdf`: the full 1st Edition, 411 pages;
- `AASHTO LRFD - Signs - Luminaires - Signals - 2017 Interim Revisions.pdf`: the replaced pages, 40 pages.

Both are in the private reference library. **They are cited and paraphrased here, never copied.** Coefficients appear only where they are needed to implement and hand-check.
- Later interims (2018, 2019, 2020, 2022) are **not** applied. The 2022 interim (LRFDLTS-1-I5) revised Section 5 (steel) and Appendix C (fatigue).
- **Coordinator decision Q-B1 (2026-11-02):** the LTS mode says on screen and in the report: "AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions; later interims not applied."
- FHWA's 2018 rule (Federal Register 2018-11-01) incorporated the 1st Edition with the 2017 and 2018 interims into 23 CFR 625.4, so the 2017 basis is an FHWA-approved version.

Page references below are spec page numbers ("p. 3-16"). Pages marked "(2017)" come from the interim packet. Every provision row in §2 has been checked against the page itself; equations were read from rendered page images.

### 0.1 Findings that change the earlier plan (read these)

1. **No ice-plus-wind combination; ice is not a separate load column.** Table 3.4-1 (p. 3-3) has Strength I (gravity; Arts. 3.5, 3.6, 3.7), Extreme I (wind), Service I, Service III, Fatigue I and II. C3.7 (p. 3-4) says the ice-and-wind combinations were removed because they do not control (NCHRP 796). Art. 3.7 lets atmospheric ice be applied around members (one face of sign panels), with the Owner specifying special icing. It gives no thickness.
   - **Plan:** ice is an optional, Owner-specified gravity load in Strength I, factored with DC at 1.25, with no wind on ice. Flagged "engineer to confirm" (Q-C1).
2. **Roadside sign supports use the 10-year MRI** (note to Table 3.8-1, p. 3-5), i.e. the Figure 3.8-4 speed, at Extreme I. Luminaire poles use 300, 700 or 1,700 years by risk category and ADT.
3. **Wind from any direction** (Art. 3.9.3, Table 3.9.3-1, pp. 3-23, 3-24) uses three load cases: full normal; full transverse; 0.75 × both at once. The tool's 4 azimuths cover cases 1 and 2. **Case 3 is added in the LTS mode** (the four diagonals, each 0.75·BL_n + 0.75·BL_t).
4. **Torsion for concentric attachments** (Art. 3.9.4.2, p. 3-25): for roadside signs on a single support, pole-top luminaires and high-level poles, the torsion is W × 0.15b (b = out-to-out width of the attachments). Non-concentric attachments use the net torque.
   - This replaces the IBC mode's ASCE 7 Case B (0.2B) on monoposts in the LTS mode.
   - Two-post signs are not "single supports", so no eccentric case is required. Decision: follow the article and flag it (Q-C2).
5. **Second-order effects, Art. 4.8.1 (p. 4-3), simplified method:** B₂ = 1/(1 − P_eq/P_Euler,bottom) ≥ 1.0, where
   - P_eq = (I_B/I_T)^(1/3)·P_T + 0.38·D_P;
   - P_Euler,bottom = π²EI_B/(kL)²;
   - k = 2.0, and r is taken at 0.5L (C4.8.1);
   - valid when kL/r ≥ 2π√(E/F_y); otherwise the detailed method (Art. 4.8.2) is required.
   
   This is the tapered-member magnifier that Art. 5.12.1 (2017) calls for. It replaces the tool's AISC App. 8 B₂ in the LTS mode.
6. **LRFDLTS 1st Ed. has no base-plate bending method.**
   - Art. 5.6.3 (p. 5-7) only says the base-plate thickness "shall be considered" in tube-to-plate connections. It sets minimum thicknesses (Table 5.6.3-1: 1.5 in for D ≤ 8 in, 2.0 in for D > 8 in) **only for supports designed for fatigue under Section 11**, which excludes everything in scope.
   - C5.16.3 (p. 5-37) allows AISC Design Guide 1 for anchor bolts. Section 15's references include Cook et al. (1995), *Design Procedure for Annular Base Plates*.
   - So the tool's "LTS bending-line method" (LP-5, #561) is **not an LRFDLTS article**. In LTS-6 the "VERIFY … 2nd Ed." note becomes "Method: bending line at the pole face (yield-line, as in AISC DG1 / Cook et al. 1995). LRFDLTS 1st Ed. (2017) Art. 5.6.3 requires the plate thickness to be considered but gives no method — engineer to confirm" (Q-C3).
7. **Welds:** Art. 5.14 (p. 5-35, 2017) refers to AWS D1.1 (2010) and gives no strength method. **Coordinator decision Q-B5:** check the base weld per AWS D1.1 / AISC 360-16 §J2 with LTS φ, with a note.
8. **Fatigue is not required in scope** (Art. 11.4, p. 11-3 (2017); Art. 11.7.2, p. 11-10 (2017)). Square cross-sections: Art. 5.6.2 (p. 5-6) requires tubular supports to be round or multi-sided, and C5.6.2 says square or rectangular sections should not be used for highway sign, signal and high-level luminaire supports. **Coordinator decision Q-B6:** warn (do not block), citing Art. 5.6.2 / C5.6.2 and C11.4.
9. **Foundations, Section 13** (pp. 13-1 to 13-5):
   - Design follows AASHTO LRFD BDS Section 10, the "preferred method".
   - Broms' procedures (C13.6.1.1) may be used "in lieu of more detailed procedures", with the **factored** groundline M_F and V_F from Section 3.
   - Shafts must resist the applied torsion (Art. 13.6), but no method is given.
   - **Structural design is per AASHTO LRFD BDS** (Art. 13.6.2), not ACI 318.
   - Details: 3 in minimum cover; diameters in 6 in increments (Art. 13.6.2.1).
   - So in the LTS mode the tool keeps its ACI 318-19 shaft check, flagged "LRFDLTS Art. 13.6.2 calls for AASHTO LRFD BDS; ACI 318-19 used — engineer to confirm" (Q-C4).
10. **Anchor bolts** (Art. 5.16, 2017 pages; Arts. 5.16.2–5.16.3, p. 5-37 of the book): F1554 Gr 36/55/105, A706 bars; anchorage design per ACI 318-11 App. D (C5.16.3). In the tool these are designed in the Anchorage app (ACI 318-19 Ch. 17) — noted.

### 0.2 "2nd Ed." references in the repo (corrected in Phase B)

| File | Where (anchor) | Text now | Change in |
|---|---|---|---|
| `Light Pole and Sign Post.html` | masthead `id="lppScope"` (LP0-1), report cover | "… AASHTO LRFDLTS 2nd Ed. highway supports are a separate mode (coming) …" | LTS-1: mode-dependent scope line with the Q-B1 basis text |
| `Light Pole and Sign Post.html` | `const LPP_BP_VERIFY=` | "VERIFY the base-plate method against AASHTO LRFDLTS 2nd Ed. — …" | LTS-6, per §0.1 item 6 |
| `Light Pole and Sign Post.html` | comment in `anchorBolts()` above the base-plate block | "… until the AASHTO LRFDLTS 2nd Ed. mode is added." | LTS-6 |
| `Light Pole and Sign Post.html` | `basePlateWorkedHTML()` `eq-why` line | "… (and in the AASHTO LRFDLTS 2nd Ed. mode until that mode is added) …" | LTS-6 |
| `BasePlateAnchorDesigner.html` | circular base-plate step `ref:"AASHTO LRFDLTS 2nd Ed., …"` | worked-step reference | another tool: its own PR after LTS-6 (CLAUDE.md §7) |

Status key for §2: **Confirmed** = read on the cited page. **Decision** = the provision leaves a choice; the choice is recorded, flagged "engineer to confirm" on screen, and listed in §4.

---
## 1. Scope

### 1.1 Structures the LTS mode covers (Phase B)

| Structure | Tool geometry today | LTS mode |
|---|---|---|
| **Luminaire pole with arms** (roadway lighting, one or more davit/truss-type arms or a post-top luminaire) | Pole mode: height H; round tapered tube (top and base OD and wall), or square/rect HSS (prismatic); fixtures table: mounting height, azimuth θ, arm length a, EPA, ice EPA, weight, arm OD; arm wind and fixture torsion (LP-7) | **Yes.** Same geometry. Multi-sided (8-, 12-, 16-sided) sections are added in LTS-3b. Square/rect. sections get a warning (Art. 5.6.2 / C5.6.2, Q-B6). Cables are hidden (see §1.3). |
| **Monopost sign** (ground-mounted roadside sign on one post) | Sign mode, 1 post: panel B × s, clearance, panel weight, post shape and size; Case A/B/C wind; torsion | **Yes.** LTS sign C_d (Table 3.8.7-1 by L/W) replaces ASCE 7 Fig. 29.3-1 Cases A/B/C; torsion T = W·0.15b (Art. 3.9.4.2); 10-yr MRI wind (Table 3.8-1 note). |
| **Two-post sign** | Sign mode, 2 posts at spacing L_p, two shafts | **Yes.** Equal split under normal wind (no eccentric case, Q-C2); 10-yr MRI wind. |

### 1.2 Later or out of scope

| Structure | Status | Why |
|---|---|---|
| Cantilever traffic-signal and luminaire **mast arms** (long horizontal arms with signal heads and signs) | **Later** (separate PR series after Phase B) | Needs an arm member (tapered tube with its own checks), an arm-to-pole flange connection, galloping and the vertical-deflection fatigue limit. The fixtures table models only short arms with a point load. |
| **Cantilever sign structures** (single or double arm, butterfly) | Later | Same as mast arms, plus sign torsion on the pole at the arm. |
| **Overhead sign bridges** (span trusses, monotubes), bridge-mounted signs | Out of scope (a separate tool if wanted) | Two supports, trusses, different load path. |
| **High-mast lighting towers** (typically > 55 ft with a ring) | Out of scope. HMLTs are 55 ft or taller (Art. 5.2, Art. 11.7.2) and need a fatigue design (Art. 11.4, 11.7.2) and at least eight anchor bolts (Art. 5.16). The LTS mode warns when H ≥ 55 ft. | Fatigue governs these; the structures in scope need no fatigue design (§2.7 F1). |
| **Aluminum** poles (LTS Section 6), **prestressed concrete** poles (Section 8), **fiber-reinforced composite** (Section 9), **wood** (Section 7) | Out of scope | The tool designs steel tubes only. |
| **Breakaway** hardware (LTS Section 12) | Checklist only (no calculation) | Breakaway devices are crash-tested products; the tool can only flag the requirement. |
| **Cables / catenary spans** | **Not supported in the LTS mode** (engineer decision) | Shown on screen; the cable inputs are kept untouched in the saved state. |

### 1.3 What the tool's geometry can represent (and what it can't)

- **Can:** a vertical cantilever pole or post on a drilled shaft; tapered round tubes (linear taper); prismatic square/rect HSS; point masses and areas at heights (fixtures, arms as short members with projected area and weight); a flat sign panel with clearance; one or two posts; round or square shafts in one soil layer (IBC classes, or Broms cohesive/cohesionless for the reference check); a double-nut base plate (circle of n rods).
- **Can't (today):** multi-sided sections (added in Phase B); slip-fit or flange splices along the pole; a handhole (LRFDLTS gives detailing rules only, Art. 5.6.6.1; not modelled); long arms as members; transformer bases; layered soil.

---

## 2. Provision map (AASHTO LRFDLTS 1st Ed. 2015 with 2017 Interim Revisions; checked 2026-11-02)

Forms are paraphrased; symbols as in the tool. Every row has been read on the cited page. "Was" notes where my earlier recollection differed.

### 2.1 Loads, limit states and wind speed

| # | Computed / value | Article / eq. / table (page) | Form to implement | Status |
|---|---|---|---|---|
| L1 | Limit states and load factors | **Table 3.4-1** (p. 3-3) | **Strength I** (gravity): 1.25·DC + 1.6·LL (refs. 3.5, 3.6, 3.7). **Extreme I** (wind): DC at 1.1 (max) and 0.9 (min) + 1.0·W, with V from Figs. 3.8-1/-2/-3. **Service I**: 1.0·DC + 1.0·W, with V from Fig. 3.8-4 (10-yr). Fatigue I: 1.0 × the Section 11 loads. Service III (prestressed concrete) and Fatigue II (evaluation) are not used. | Confirmed. Was "Table 3.4.1-1, with ice combinations". |
| L2 | Dead load DC | **Art. 3.5** (p. 3-4) | weight of the support, signs, luminaires, signals and permanent attachments (walkways included), applied at their centres of gravity; manufacturers' weights allowed | Confirmed |
| L3 | Live load LL | **Art. 3.6** (p. 3-4) | 0.5 kip over 2 ft, for walkway and platform members only → **not applicable** in scope (shown as N/A) | Confirmed |
| L4 | Ice | **Art. 3.7, C3.7** (p. 3-4) | Atmospheric ice may be applied around members, and on one face of sign panels; the Owner specifies special icing. No thickness or pressure is given, and there is no ice-plus-wind combination. **Decision (Q-C1):** an optional Owner-specified ice weight (input t_ice and density, or none) added to the Strength I gravity case at 1.25; no wind on ice. Default: none. | Confirmed; decision flagged |
| L5 | Wind MRI | **Art. 3.8, Table 3.8-1** (pp. 3-4, 3-5) | Risk category (Typical / High / Low) × ADT → MRI 300 / 700 / 1,700 yr. **Roadside sign supports: 10-yr MRI (Fig. 3.8-4).** The tool shows the MRI and asks for V. | Confirmed. Was "design life by risk category". |
| L6 | Basic wind speed V | **Art. 3.8.2** (p. 3-14); Figs. 3.8-1 to 3.8-4 (pp. 3-6 to 3-13): 3-s gust at 33 ft, Exposure C; Art. 3.8.2.1 elevated sites; Art. 3.8.3 special regions (never below the maps) | **Input** V (Extreme I) and V_svc (Service I, Fig. 3.8-4). No maps in the tool. | Confirmed |

### 2.2 Wind pressure

| # | Computed / value | Article / eq. / table (page) | Form to implement | Status |
|---|---|---|---|---|
| P1 | Design pressure | **Eq. 3.8.1-1** (p. 3-14) | P_z = 0.00256·K_z·K_d·G·V²·C_d (psf) | Confirmed |
| P2 | K_z | **Art. 3.8.4, Eq. 3.8.4-1** (p. 3-15); Table C3.8.4-1 (p. 3-16) | K_z = 2.0·(z/z_g)^(2/α), α = 9.5, z_g = 900 ft (Exposure C), z = the larger of the height and 16 ft. Other exposures only with the Owner's permission (C3.8.4). | Confirmed. Note: 2.0, not ASCE's 2.01. |
| P3 | K_d | **Table 3.8.5-1** (p. 3-16) | Poles (high-mast and pole): round 0.95, square 0.90, 8/12/16-sided 0.95. Traffic signal, dynamic message sign, overhead frame/truss, and supports with horizontal arms or members carrying signs/signals: 0.85. **Decision (Q-C5):** ground-mounted sign panels have no row; the tool uses the **pole value of the post shape for the whole sign structure** (0.95 round), which is conservative against 0.85. Flagged. | Confirmed; decision flagged |
| P4 | G | **Art. 3.8.6** (p. 3-17 (2017)) | G = 1.14 (minimum); a rigorous ASCE 7 gust analysis only with the Owner's permission | Confirmed |
| P5 | C_v | **Art. 3.8.7** (p. 3-17 (2017)) | 0.8 at Extreme, 1.0 otherwise (Service, Fatigue) | Confirmed |
| P6 | C_d round | **Table 3.8.7-1** (p. 3-20 (2017)) | C_v·V·d ≤ 39 mph·ft: 1.10; 39–78: 129/(C_v·V·d)^1.3; ≥ 78: 0.45 (d in ft) | Confirmed |
| P7 | C_d 16-sided | Table 3.8.7-1 (p. 3-20 (2017)), read from the page image | 0 ≤ r_c < 0.26: 1.10 / 1.37 + 1.08r_c − C_vVd/145 − C_vVd·r_c/36 / 0.83 − 1.08r_c. r_c ≥ 0.26: 1.10 / 0.55 + (78.2 − C_vVd)/71 / 0.55. Note e transition to round between r_m = 0.26 and r_r = 0.63. r_c = outside corner radius / inscribed-circle radius (Art. 3.3). | Confirmed |
| P8 | C_d 12-sided | Table 3.8.7-1 | 1.20 / 10.8/(C_vVd)^0.6 / 0.79; note e r_m 0.50, r_r 0.75 | Confirmed |
| P9 | C_d 8-sided | Table 3.8.7-1 | 1.20 throughout; note e r_m 0.75, r_r 1.00 | Confirmed |
| P10 | C_d square | Table 3.8.7-1 | 2.0 − 6r_s (r_s < 0.125); 1.25 (r_s ≥ 0.125); r_s = corner radius / depth (Art. 3.3, p. 3-2). Wind on the diagonal (diamond): 1.70 / 1.90. **Rectangular** tubes have no row. **Decision (Q-C6):** use the square value (2.0 − 6r_s, r_s from the corner radius) for both faces. Flagged. | Confirmed; decision flagged |
| P11 | C_d sign panels | Table 3.8.7-1 (p. 3-19 (2017)) | by L_sign/W_sign (longer/shorter side): 1.0 → 1.12, 2.0 → 1.19, 5.0 → 1.20, 10.0 → 1.23, 15.0 → 1.30. **Coordinator decision Q-B3:** linear interpolation between rows. Ratio > 15: 1.30. | Confirmed; decision recorded |
| P12 | Luminaires, attachments | Table 3.8.7-1 (p. 3-19 (2017)); **Art. 3.9.1** (p. 3-23) | When the EPA is given (= C_d × area), P_z is computed **without** C_d and multiplied by the EPA. Otherwise C_d = 0.50 (rounded) / 1.20 (flat-sided) for luminaires, 1.0 for other attachments. The tool's fixture input is the EPA. | Confirmed |
| P13 | Load cases for wind from any direction | **Art. 3.9.3, Table 3.9.3-1** (pp. 3-23, 3-24) | (1) 1.0·BL_n; (2) 1.0·BL_t; (3) 0.75·BL_n + 0.75·BL_t together. The tool runs 0/90/180/270° (cases 1 and 2, both senses) plus the four diagonal combinations of case 3. | Confirmed. Was "4 azimuths". |
| P14 | Unsymmetrical wind: torsion | **Art. 3.9.4.2, C3.9.4.2** (p. 3-25) | Concentric attachments on single-support roadside signs, pole-top luminaires and high-level poles: T = W·0.15b (b = out-to-out width of the attachments). Non-concentric (arm-mounted fixtures): net torque (the tool's LP-7 fixture torsion). Two-post signs: not named; **Decision (Q-C2):** no eccentric case, posts share equally under normal wind. Flagged. | Confirmed; decision flagged |
| P15 | Wind on the pole / post | Art. 3.9.3 (W_v) | strip integration of P_z(z)·d(z) with C_d(z) per P6–P10 (d changes with taper) | Confirmed (method as IBC mode) |

### 2.3 Analysis and second-order effects

| # | Item | Article (page) | Form | Status |
|---|---|---|---|---|
| A1 | Analysis | **Art. 4.5** (p. 4-1) | linear elastic analysis satisfying equilibrium and compatibility (the tool's statics) | Confirmed |
| A2 | Second order (pole-type) | **Arts. 4.6.1, 4.8, 4.8.1, Eq. 4.8.1-1** (pp. 4-2, 4-3) | B₂ = 1/(1 − P_eq/P_E,bot) ≥ 1.0; P_eq = (I_B/I_T)^(1/3)·P_T + 0.38·D_P (factored); P_E,bot = π²EI_B/(kL)², k = 2.0; r at 0.5L. Valid when kL/r ≥ 2π√(E/F_y); otherwise the detailed method (Art. 4.8.2) is required → the tool reports "B₂ simplified method not valid — detailed analysis required" and **fails the member check**. Prismatic posts: the same equation with I_B = I_T. Applied to bending in Eqs. 5.12.1-1 to -3 (B = B₂). Tension (net uplift): B = 1.0 (Eq. 5.12.1-12, -13). | Confirmed |

### 2.4 Member design (Section 5)

| # | Check | Article / eq. / table (page) | Form | Status |
|---|---|---|---|---|
| M1 | Resistance factors | **Art. 5.5.3.2** (p. 5-6); Art. 5.5.4 (same at Extreme) | φ_f 0.90, φ_v 0.90, **φ_t (torsion) 0.95**, φ_c 0.90, φ_u (net fracture) 0.75, φ_y (gross yield) 0.90 | Confirmed. Was "torsion 0.90". |
| M2 | Minimum thickness | **Art. 5.6.1** (p. 5-6) | pole-type members ≥ 0.125 in (10 % tolerance for gauge material); small roadside sign supports may be thinner → **warning** | Confirmed |
| M3 | Shape rules | **Art. 5.6.2, Eq. 5.6.2-1, C5.6.2** (pp. 5-6, 5-7) | round or multi-sided only; multi-sided n ≥ max(√(5D), 8), inside bend radius ≥ max(5t, 1 in); square/rect.: **warning** (coordinator decision Q-B6) | Confirmed |
| M4 | Width-thickness | **Art. 5.7.2, Table 5.7.2-1** (p. 5-14); b by Eq. 5.7.2-1/-2, C5.7.2 | Round D/t: λ_p 0.07E/F_y, λ_r 0.11E/F_y (compression) / 0.31E/F_y (flexure), λ_max 0.45E/F_y. 16-, 12-, 8-sided and square/rect. flanges b/t: λ_p 1.12√(E/F_y); λ_r 1.26 / 1.41 / 1.53 / 1.53 √(E/F_y); λ_max 2.14√(E/F_y). λ > λ_max is not permitted → fail. | Confirmed |
| M5 | Flexure | **Art. 5.8.1 (Eq. 5.8.1-1), 5.8.2, Table 5.8.2-1** (pp. 5-17, 5-18) | Compact: M_n = M_p = Z·F_y. Noncompact / slender as fractions of M_p: round M_p·[0.77 + 0.016(E/F_y)/(D/t)] / M_p·[0.25(E/F_y)/(D/t)]; 16-sided [2.59 − 1.43(b/t)/√(E/F_y)] / [1.12 − 0.26…]; 12-sided [1.77 − 0.69…] / [1.15 − 0.25…]; 8-sided [1.50 − 0.45…] / [1.14 − 0.22…]; square/rect. [1.37 − 0.33…] / [1.23 − 0.23…]. Multi-sided M_n ≤ that of a round tube of the flat-to-flat diameter. | Confirmed |
| M6 | Compression | **Art. 5.10.1, 5.10.2.1–5.10.2.3, C5.10.2.1** (pp. 5-27, 5-28) | P_nc = A_g·F_cr; F_cr = Q·0.658^(QF_y/F_e)·F_y when KL/r ≤ 4.71√(E/(QF_y)), else 0.877F_e; F_e = π²E/(KL/r)². Q = 1 when λ ≤ λ_r; round slender Q = 0.67 + 0.038(E/F_y)/(D/t) ≤ 1; multi-sided/square slender Q = A_eff/A_g with b_e = 1.92t√(E/f)[1 − 0.34/(b/t)·√(E/f)] ≤ b, f = F_cr at Q = 1. Cantilever K = 2.1 (C5.10.2.1); r at 0.5L for tapered. | Confirmed |
| M7 | Shear | **Art. 5.11.1, 5.11.2, 5.11.2.1.1, 5.11.2.1.2, 5.11.2.2** (pp. 5-30 to 5-32) | V_n = A_v·F_nv. Round: F_nv = the greater of 1.60E/[√(L_v/D)·(D/t)^(5/4)] and 0.78E/(D/t)^(3/2), ≤ 0.6F_y; A_v = A_g/2; L_v = distance from maximum to zero shear (cantilever: the shear span = the height to the resultant; **decision:** the full height L, which is conservative). Multi-sided: F_nv = 0.6F_y, A_v = A_g/2. Square/rect.: F_nv = 0.6F_y·C_v (k_v = 5; h/t limits 1.10 / 1.37 √(k_vE/F_y)), A_v = 2ht. | Confirmed |
| M8 | Torsion | **Art. 5.11.3, 5.11.3.1.1** (p. 5-32); 5.11.3.1.2, 5.11.3.2 (p. 5-33 (2017)); **Table B.3-1** (p. B-3) for C_t | T_n = C_t·F_nt. Round: F_nt = the greater of 1.23E/[√(L/D)·(D/t)^(5/4)] and 0.6E/(D/t)^(3/2), ≤ 0.6F_y, with C_t = 2πR²t (R mid-wall radius). Multi-sided: F_nt = 0.6F_y, C_t per Table B.3-1 (e.g. 8-sided 6.63R²t/k_t). Square/rect.: F_nt = F_nv. | Confirmed |
| M9 | Tension (uplift) | Art. 5.9 (p. 5-25) | P_r = φ_y·A_g·F_y (gross yield) | Confirmed |
| M10 | Combined forces | **Art. 5.12.1, Eqs. 5.12.1-1 to -13** (pp. 5-33, 5-34 (2017)) | T_u/T_r > 0.20: P_u/P_r + B·M_u/M_r + (V_u/V_r + T_u/T_r)² ≤ 1.0 (only the shear + torsion sum is squared; corrected 2026-11-02, LTSV-2: this row first read (B·M_u/M_r + V_u/V_r + T_u/T_r)², which is not what the PDF shows). T_u/T_r ≤ 0.20: P_u/P_r ≥ 0.20 → P_u/P_r + (8/9)·B·M_u/M_r ≤ 1.0; P_u/P_r < 0.20 → P_u/(2P_r) + B·M_u/M_r ≤ 1.0 (luminaire supports may use P_u/2P_r = 0.08; the tool computes it). Round/multi-sided: M_u, V_u as vector sums. Square/rect.: B_x·M_ux/M_rx + B_y·M_uy/M_ry; Art. 5.12.2 diagonal bending (Eq. 5.12.2-1) also checked. | Confirmed |
| M11 | Check sections | — | base, and every 1 ft up the taper, as the IBC mode (tapered properties) | Tool |
| M12 | Multi-sided geometry | Art. 5.7.2 / C5.7.2; Table B.2-1 (p. B-2 (2017)) | polygon properties computed exactly; Table B.2-1 shown as a cross-check | Confirmed (LTS-3b) |

### 2.5 Connections

| # | Check | Article (page) | Form | Status |
|---|---|---|---|---|
| J1 | Base-plate thickness | **Art. 5.6.3** (p. 5-7); Table 5.6.3-1 (p. 5-8), for fatigue-designed supports only; C5.16.3 (p. 5-37) | no LRFDLTS method → the tool's bending-line method is kept, labelled as **not an LRFDLTS article** (§0.1 item 6, Q-C3); Table 5.6.3-1 minimums shown as information (fatigue not required in scope) | Confirmed (absence); decision flagged |
| J2 | Base weld | **Art. 5.14** (p. 5-35 (2017)): AWS D1.1 (2010) | **Coordinator decision Q-B5:** fillet (socket) weld per AWS D1.1 / AISC 360-16 §J2.4 (φR_n = 0.75·0.60F_EXX·0.707w per unit length, LTS has no weld φ) against the peak weld force per inch from M, P, V, T on the weld ring; CJP: the base metal governs (no separate check). Note on screen. | Decision flagged |
| J3 | Handhole | **Art. 5.6.6.1** (p. 5-9): detailing (opening ≤ 40 % of D for Section 11 supports; corner radii); no strength rule | not checked; note | Confirmed |
| J4 | Anchor bolts | **Arts. 5.16, 5.16.1 (2017), 5.16.2, 5.16.3** (pp. 5-35 to 5-37): cast-in for new work; F1554 36/55/105, A706; hooked ≤ 55 ksi; ACI 318-11 App. D per C5.16.3 | designed in the Anchorage app (ACI 318-19 Ch. 17) from the exported LTS combinations; note | Confirmed |

### 2.6 Fatigue (Section 11)

| # | Item | Article (page) | Effect | Status |
|---|---|---|---|---|
| F1 | Applicability | **Art. 11.4, C11.4** (p. 11-3 (2017)); **Art. 11.7.2** (p. 11-10 (2017)); HMLT definition Art. 5.2 (p. 5-1 (2017)) | Fatigue design is required only for overhead cantilevered and non-cantilevered sign and signal structures and for high-mast lighting towers (≥ 55 ft). Luminaire supports under 55 ft and roadside signs are excluded. The LTS mode shows this as a worked step and warns at H ≥ 55 ft ("HMLT: fatigue design and ≥ 8 anchor bolts (Art. 5.16) required — outside this tool"). | Confirmed |
| F2–F10 | I_F, galloping, natural wind gust, truck gust, HMLT P_CW, CAFT, details | Arts. 11.6–11.9 | not needed in scope (see the B-0 rows kept in git history, #647) | Confirmed, not used |

### 2.7 Deflection (Section 10)

| # | Check | Article (page) | Form | Status |
|---|---|---|---|---|
| D1 | Luminaire supports | **Art. 10.4.2.1** (p. 10-1 (2017)) | Service I (DC + W at V_svc): Δ_top ≤ 0.10·H | Confirmed |
| D2 | Vertical supports with transverse loads | Art. 10.4.2.1 | Service I: Δ_top ≤ 0.025·H. **Coordinator decision Q-B4:** applied, as the article reads, to the vertical supports it names (street lighting poles, traffic-signal and sign structures) under Service I, i.e. to every structure in scope. Flagged "engineer to confirm" (the commentary describes it as a dead-load aesthetic limit for strain poles). | Confirmed; decision flagged |
| D3 | Vertical supports with moment loads | Art. 10.4.2.1 | Service I: slope at the top ≤ 0.35 in/ft. Applied when the support carries a moment load (arm-mounted fixtures with a net dead-load moment; eccentric sign attachments); otherwise shown as information (Q-B4). | Confirmed; decision flagged |
| D4 | Computation | Art. 10.4.2.1, C10.4.2.1 | elastic deflection of the tapered cantilever with unit load factors; second-order amplification by B₂ (C10.4.2.1: normally considered) | Confirmed |

### 2.8 Breakaway (Section 12, and Art. 2.5.2)

| # | Item | Article (page) | Form | Status |
|---|---|---|---|---|
| B1 | Breakaway checklist | **Arts. 12.1, 12.3, 12.4, 12.5.1** (pp. 12-1, 12-2 (2017)); **Art. 2.5.2** (breakaway supports in the clear zone), 2.5.2.1, 2.5.2.2 | Checklist (in the clear zone? breakaway hardware MASH-tested; Manufacturer certification; structural capacity at Extreme I; foundation and stub-height notes per 2.5.2.1/2.5.2.2). No calculation. | Confirmed |

### 2.9 Foundations (Section 13)

| # | Check | Article (page) | Form | Status |
|---|---|---|---|---|
| G1 | Lateral embedment | **Art. 13.6.1.1, C13.6.1.1, Eqs. C13.6.1.1-1 to -7** (pp. 13-3, 13-4) | Broms with **factored** groundline M_F, V_F (Extreme I envelope). Cohesive: L = 1.5D + q[1 + √(2 + (4H + 6D)/q)], H = M_F/V_F, q = V_F/(9cD). Cohesionless: L³ − 2V_F·L/(K_pγD) − 2M_F/(K_pγD) = 0, K_p = tan²(45° + φ/2), γ including load factors ("conservatively a unit load factor"). M_u in the shaft by Eq. C13.6.1.1-4 / -7. No resistance factor is stated. **Decision (Q-C7):** φ = 1.0 (as printed), with the tool's optional margin input kept. | Confirmed; decision flagged |
| G2 | Torsion | **Art. 13.6** (p. 13-2): shafts shall resist the applied torsion; no method | the IBC mode's torsion warning (open item N2) kept; T_u shown | Confirmed (no method) |
| G3 | Structural design | **Art. 13.6.2** (p. 13-5): AASHTO LRFD BDS | the tool's ACI 318-19 P–M, shear and torsion threshold with the LTS factored loads, flagged (Q-C4) | Confirmed; decision flagged |
| G4 | Details | **Art. 13.6.2.1** (p. 13-5) | cover ≥ 3 in (check); shaft diameter in 6-in increments (warning) | Confirmed |
| G5 | Soil data | **Art. 13.4** (p. 13-2) | note: geotechnical study required unless the waiver conditions apply | Confirmed |

### 2.10 Export to the Anchorage app

| # | Item | Basis | Form |
|---|---|---|---|
| X1 | `bridgeSuite.v1.anchorGroup` in LTS mode | HANDOFF.md §4.11 (#610); Table 3.4-1 | Same schema and sign convention. `basis.combos` = "AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions, Table 3.4-1: Extreme I (1.1DC + W, 0.9DC + W; load cases 1–3 of Table 3.9.3-1), Strength I (1.25DC)". M = B₂·M with B₂ per Art. 4.8.1. Service and Fatigue are not sent. |

## 3. Inputs, saved data, UI, report, tests

### 3.1 Inputs

**Reused unchanged:**
- the pole: height, shape, top/base OD and wall, F_y, density;
- the fixtures table (height, θ, a, EPA, weight, arm OD);
- the sign: B, s, clearance, weight, post spacing;
- the shaft: shape and size, f′c, f_y, cover, rebar;
- the Broms soil inputs (Broms becomes the design method in LTS mode);
- the anchor rods (sent to the Anchorage app);
- the base plate: D, F_y, t.

**New (LTS mode only; ids prefixed `lts`; each with a default applied in `applyState()` when absent):**

| Id | Input | Default |
|---|---|---|
| `ltsRisk` | Risk category: Typical / High / Low (Table 3.8-1) | Typical |
| `ltsAdt` | ADT band: < 100 / 100–1,000 / 1,000–10,000 / > 10,000 (Table 3.8-1) | 1,000–10,000 |
| `ltsV` | Basic wind speed V for the MRI shown (Figs. 3.8-1 to -3; Fig. 3.8-4 for roadside signs) | 130 mph (placeholder; the map value is the user's) |
| `ltsVsvc` | Service wind speed, 10-yr (Fig. 3.8-4) | 76 mph (placeholder) |
| `ltsIce` | Owner-specified ice (Art. 3.7): none / radial thickness t_ice, in (density 56 pcf, fixed, as the IBC mode; no density input), Strength I only | none |
| `ltsRc` | Corner radius ratio: r_c (multi-sided) or r_s (square) | 0 (square: 2.0 C_d), conservative |
| `ltsSides` | Multi-sided: 8 / 12 / 16 (LTS-3b; adds "Multi-sided" to `poleShape` in LTS mode only) | 16 |
| `ltsWeld` | Base weld: socket fillet w (in), F_EXX (ksi) / CJP | fillet 0.3125 in, 70 ksi |
| `ltsClearZone` | Breakaway checklist: in the clear zone? (Art. 2.5.2) | no |
| `ltsPhiSoil` | Broms resistance factor (Q-C7) | 1.00 |

The basis line is display only: "AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions; later interims not applied".

Note (2026-11-03, LTS-L2): this table said "density 57 pcf" for `ltsIce` until 2026-11-03. The engine has always used 56 pcf (`ICE_DEN` in `apps/light-pole/lts-engine.js`), and the engineer decided on 2026-11-03 that it stays 56 pcf. Only the plan text was corrected; no result changed.

**Not used in LTS mode** (kept in the saved state, untouched): the ASCE inputs (V, exposure, K_zt, K_d, G/β, ice basis, I_i, V_ice); IBC soil class, S₁ and q_allow; the cables.

### 3.2 Saved data (CLAUDE.md §5)

- **New top-level state field `codeMode`** (`'ibc'` | `'lts'`) in `captureState()`. `applyState()`: a save without `codeMode` opens as **`'ibc'`**, so every existing project and JSON file computes identically. No migration of any existing field.
- **New inputs** are appended to `INPUT_IDS` with their defaults applied in `applyState()` when absent (the existing pattern). The IBC inputs are never rewritten by the LTS mode; switching modes keeps both sets.
- **Storage keys unchanged:** `lpp_projects_v1`, `lpp_session_v1`, `lpp_activeTab_v1`, `lpp_inputTab_v1`. No new key. The JSON export stays `format:'lpp-project', version:1` (fields added; older files import as IBC).
- **Cables:** the `cables` array and `cablesEnabled` stay in the state untouched. In LTS mode they are ignored (not drawn, not loaded) and the cable card shows "Cables are not supported in the AASHTO LRFDLTS mode; switch to the IBC mode to design cabled poles. Your cable inputs are kept." If a project with cables enabled is switched to LTS, a warning says that the cables are ignored.
- **Hand-off:** `bridgeSuite.v1.anchorGroup` unchanged in schema; only `basis.combos` text and the combinations differ in LTS mode.
- **Tested:** every Phase B PR runs `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves` (IBC mode: results, cable values and text identical in all cases) and a new LTS case set.

### 3.3 UI

- **Mode selector:** a second segmented control in the mode card, above Light pole / Sign: **"IBC 2021 / ASCE 7-22"** (default) | **"AASHTO LRFDLTS"**. The masthead code tag and the scope line (LP0-1) change with the mode.
- **Inputs:** card 1 (wind) shows the LTS wind inputs instead of the ASCE ones; the ice input follows Q-C1 (Strength I gravity only); the cable card is replaced by the "not supported" note; a new card "Base weld & handhole"; the soil card makes Broms the design method (IBC soil class hidden).
- **Output tabs:** same tabs. Loading (LTS P_z worked per component, combinations table of Table 3.4-1); Post (Section 5 checks, combined-force equation, deflection and the fatigue-applicability step); Anchorage (export of LTS combos); Shaft (Broms design + torsion + ACI structural); Summary (LTS verdict list, with breakaway checklist and deflection); Report / Drawings (mode-dependent labels and notes; the Calc sheet was retired in #625, the Report is the one report).
- §6 links: every quoted value links to its worked block (in-app) and "see §x.y" in print, as now.

### 3.4 Report and drawings

- The Report (shared/report.js) gets an LTS section set: Design criteria (basis "1st Ed. 2015 with 2017 Interim Revisions; later interims not applied", risk category, MRI, V, V_svc), Loads (P_z per component), Combinations, Member, Base plate & weld, Fatigue applicability (Arts. 11.4, 11.7.2), Deflection (Art. 10.4.2.1), Foundation (Broms), Anchorage (pointer to the app), Breakaway checklist, Assumptions (incl. "cables not supported", "anchor rods designed in the Anchorage app", every "verify" flag still open).
- Drawings: general notes switch to the LTS references; the pole elevation adds the handhole and the base weld detail callout; no new sheets.

### 3.5 Test plan

- `tests/engine/lightpole.test.mjs` gains an LTS block per Phase B PR. The harness `tests/engine/lp-source.mjs` already loads the page's functions.
- Every PR runs:
  - `node tests/check-syntax.mjs`;
  - `node tests/engine/run.mjs lightpole`;
  - `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves`: **IBC mode identical**, cable values identical;
  - `tests/smoke/lightpole-anchor-handoff.mjs`;
  - one page-load smoke check (0 console errors) and screenshots at 1280 / 390 px.
- **Hand-check cases.** Inputs are fixed now; each PR works its part by hand in the fixlog and asserts it in the test.

**HC-1 Luminaire pole (LTS).**
- **Pole:** 40 ft round tapered steel, base OD 8.0 in, top OD 4.5 in (taper 0.0875 in/ft), wall 0.1793 in, F_y 55 ksi, 490 pcf.
- **Fixture:** one luminaire at 40 ft on a 6 ft arm at θ = 0°, EPA 1.2 ft² (manufacturer), 55 lb; arm OD 2.375 in.
- **Wind:** Typical risk, ADT 1,000–10,000 → MRI 700 yr; V 130 mph; V_svc 76 mph.
- **Base plate:** D 15 in, t 1.25 in, F_y 36; 4 × 1 in rods on a 13 in BC.
- **Base weld:** socket fillet 0.3125 in, E70.
- **Shaft:** round 30 in; cohesionless φ = 30°, γ = 115 pcf.
- **To produce by hand:** K_z at the strip mid-heights and at 40 ft; C_d (round) along the pole at C_v = 0.8 (Extreme) and 1.0 (Service); P_z; fixture force; base V, M and T for load cases 1–3 (Table 3.9.3-1); B₂ (Art. 4.8.1) and its validity limit; D/t and class at the base; φM_n, φV_n, φT_n and φP_nc; the Art. 5.12.1 branch and ratio; the 0.10H, 0.025H and slope checks; weld stress; Broms L; export combination 1.
- **Already worked** (§2 values): C_d at the base under Extreme I: C_v·V·d = 0.8·130·0.6667 = 69.33 → 129/69.33^1.3 = 129/247.3 = **0.522**. At the top: 0.8·130·0.375 = 39.0 → **1.10**. K_z(40 ft) = 2.0·(40/900)^(2/9.5) = 2.0·0.5190 = **1.038** (Table C3.8.4-1: 1.04 ✓).

**HC-2 Monopost sign (LTS).**
- **Sign:** 8 ft wide × 5 ft high panel, clearance 7 ft (top at 12 ft), 4 psf.
- **Post:** round 6.625 × 0.280 in, F_y 42 ksi (pipe).
- **Wind:** roadside sign → 10-yr MRI, V = V_svc = 76 mph.
- **Base plate:** D 14 in, t 1.25 in; 4 × 1 in rods on an 11 in BC.
- **Shaft:** round 30 in, cohesive c_u = 1,000 psf.
- **To produce by hand:** C_d (L/W = 1.6 → 1.12 + 0.6·(1.19 − 1.12) = **1.162**), K_z at the panel centroid (9.5 ft → z = 16 ft → K_z = 2.0·(16/900)^0.2105 = **0.856**), P_z, F, T = F·0.15·8 ft, base M, V, T; post checks; B₂; deflection; Broms L (cohesive); export.

---

## 4. Questions: answers from the book, decisions, and what is still open

**Answered from the book (articles in §2):**
- **Q0** Basis.
- **Q1** MRI by risk category and ADT, Table 3.8-1; roadside signs 10-yr; maps Figs. 3.8-1 to -4 (ASCE 7-10-based).
- **Q2** P_z equation; G = 1.14.
- **Q3** K_z with 2.0, α 9.5, z_g 900 ft, z ≥ 16 ft; Exposure C, others only with the Owner's permission.
- **Q4** K_d, Table 3.8.5-1.
- **Q5** Ice: Art. 3.7, no thickness, no ice-plus-wind.
- **Q6** C_d.
- **Q7** Torsion 0.15b for single-support signs, Art. 3.9.4.2; three load cases, Table 3.9.3-1.
- **Q8** Table 3.4-1; B₂ per Art. 4.8.1.
- **Q9** φ, Art. 5.5.3.2 (torsion 0.95).
- **Q10** Table 5.7.2-1, Table 5.8.2-1, Arts. 5.10, 5.11, 5.12.1.
- **Q12a** No base-plate method in LRFDLTS (Art. 5.6.3).
- **Q12b** AWS D1.1 (Art. 5.14).
- **Q12c** Handhole: detailing only (Art. 5.6.6.1).
- **Q13–Q16** Fatigue not required in scope.
- **Q17** Deflection limits.
- **Q18** Breakaway checklist.
- **Q19** Broms with factored loads; structural design per AASHTO LRFD BDS.
- **Q20** Multi-sided allowed (Art. 5.6.2); square sections discouraged (C5.6.2).

**Coordinator decisions (2026-11-02), each recorded and flagged "engineer to confirm" on screen where it affects a result:**
- **Q-B1** Basis text: "1st Ed. with 2017 Interim Revisions; later interims not applied", on screen and in the report.
- **Q-B3** Sign C_d interpolated linearly between rows.
- **Q-B4** 2.5 % H and 0.35 in/ft applied under Service I to the structure types Art. 10.4.2.1 names (vertical supports: street lighting poles, signal and sign structures); shown as information for any other type.
- **Q-B5** Base weld per AWS D1.1 / AISC 360-16 §J2, with a note (LRFDLTS gives no method).
- **Q-B6** Square luminaire poles: warning citing Art. 5.6.2 / C5.6.2 and C11.4.

**New items from the full book (my decisions, flagged on screen; please confirm):**
- **Q-C1** Ice (Art. 3.7): an optional Owner-specified ice weight in the Strength I gravity case at 1.25, no wind on ice. Default: none.
- **Q-C2** Two-post signs: no eccentric (torsion) case, since Art. 3.9.4.2 names only single-support signs.
- **Q-C3** Base plate: LRFDLTS gives no method; the bending-line method is kept and labelled as such.
- **Q-C4** Shaft structural design: kept on ACI 318-19 (Art. 13.6.2 points to AASHTO LRFD BDS).
- **Q-C5** K_d for ground-mounted signs: the pole value (0.95 for round posts) instead of 0.85; conservative.
- **Q-C6** Rectangular tubes: square C_d formula on both faces.
- **Q-C7** Broms resistance factor φ = 1.0 (none is printed); the optional margin input is kept.
- **Q-C8** Shear span L_v for round shear (Eq. 5.11.2.1.1-1): the full height (conservative).

**Engineer's answers (2026-11-02):**
- **Q-C1** Ice in Strength I only: OK.
- **Q-C2, Q-C5, Q-C6, Q-C7, Q-C8** and the pole-top fixture width b = √EPA (Art. 3.9.4.2): accepted. The "engineer to confirm" flags are removed (LTS-3); the citations stay.
- **Q-C3** Base plate: keep the bending-line method in the LTS mode, labelled "engineering method (common practice), not an LRFDLTS article". Art. 5.6.3 only requires the thickness to be considered. To be relabelled in LTS-6.
- **Q-C4** Shaft: Broms for the embedment and lateral soil resistance (as now). The shaft reinforcement stays on ACI 318-19 as in the IBC mode, with an on-screen note that LRFDLTS Art. 13.6.2 refers to the AASHTO LRFD BDS for the structural design (not applied) (LTS-7).

**New decisions in LTS-3 (flagged "engineer to confirm" on screen):**
- **Q-C9** Square/rect. tube flat width b = (larger wall) − 3t. The corner radius is not an input (as AISC 360-16 B4.1b). The same b/t is used for both axes, conservatively.
- **Q-C10** Square/rect. torsional constant C_t = 2(B − t)(H − t)t − 4.5(4 − π)t³ (AISC 360-16 §H3.1). LRFDLTS Table B.3-1 gives the square-tube stress formula with k_t, but no constant usable without the corner radius.

**Engineer's answers to Q-B4, Q-B5, Q-C9, Q-C10 (2026-11-02):** see §5.1.

**Still open (owner):** Q21–Q25 (§6).

## 5. Phase B PR sequence

Each PR follows the same rules:
- CLAUDE.md §4 callouts: before = "not checked / IBC mode only"; after = the LTS form, with article and page.
- Hand check (HC-1 / HC-2 parts).
- **IBC mode identical:** `tests/lightpole-compare.mjs --a origin/main` and `--old-saves`.
- Cables untouched.
- `codeMode` defaults to `'ibc'`.
- A fixlog entry with the PR link.

The PRs:
1. **LTS-1** (done, 2026-11-02) Mode switch (`codeMode`), the basis line, LTS inputs, MRI display, Table 3.4-1 combinations (Strength I, Extreme I max/min, Service I), the cable note, the scope line.
2. **LTS-2** (done, 2026-11-02) Wind: P_z with K_z, K_d, G, C_v, C_d per shape and along the taper, sign C_d and 0.15b torsion, EPA handling, the Table 3.9.3-1 load cases; ice weight (Q-C1).
3. **LTS-3** (done, 2026-11-02) Members, round and square/rect.:
   - Table 5.7.2-1 classes;
   - Table 5.8.2-1 M_n;
   - Arts. 5.10 and 5.11;
   - Art. 5.12.1 combined forces;
   - Art. 4.8.1 B₂;
   - shape and thickness warnings.
   
   **LTS-3b** adds multi-sided sections (geometry, C_d, classes).
4. **LTS-5** (done, 2026-11-02) Deflection (Art. 10.4.2.1); the fatigue-not-required step and the ≥ 55 ft warning; the breakaway checklist.
5. **LTS-6** (done, 2026-11-02) Base plate (label per Q-C3; the four "2nd Ed." texts corrected) and the base weld (Q-B5).
6. **LTS-7** (done, 2026-11-02; with the optional square-tube corner radius for Q-C9/Q-C10) Foundation: Broms with factored loads as the design check; ACI structural check with LTS loads (Q-C4); the 3 in cover check.
7. **LTS-8** (done, 2026-11-02) Export of the LTS combinations to the Anchorage app.
8. **LTS-9** (done, 2026-11-02) Report, drawings, manual.

### 5.1 Status after LTS-9 and the engineer's answers (2026-11-02)

All planned steps are merged (#649, #651, #652, #653, #654, #655, #656, #657). The engineer's answers of 2026-11-02 are applied, and the "in development — not for design" banner is removed (release PR):
- **Q-B4:** the 2.5 % H and 0.35 in/ft limits of Art. 10.4.2.1 are **information only** (shown, never a failure). The 10 % H limit for luminaire supports under Service I stays a check.
- **Q-B5:** the base weld check per AWS D1.1 / AISC 360-16 §J2.4 is accepted; the flag is removed.
- **Q-C9 / Q-C10:** both paths are accepted.
  - With an inside corner radius: Eq. 5.7.2-1, and the smaller of the Table B.3-1 and AISC torsional constants.
  - Without it: b = B − 3t and the AISC constant, with a short note.
- **Known limits (accepted; stated on screen and in the report, not as flags):**
  - the soil torsional resistance of the shaft is not checked;
  - the dimensioned drawings and DXF are IBC-only;
  - 8/12/16-sided sections are not built;
  - mast arms, high-mast towers (≥ 55 ft: warning) and fatigue design are out of scope.

## 6. Owner amendments (RIDOT, MassDOT, CTDOT)

**Source.** The owner manuals in the engineer's reference library, searched 2026-11-02 for sign supports, luminaires and light poles, traffic-signal structures, LRFDLTS, wind speed, fatigue importance category, standard poles and foundations, drilled shafts, base plates and anchor rods. They are cited by section only; no owner text is copied:
- **RIDOT** *Bridge Design Manual*, April 2026 (`Bridge Design Manual-2026.pdf`);
- **MassDOT** *Bridge Manual, Part I*, Hundredth Anniversary Edition (`MassDOT Bridge Manual - Hundredth Edition.pdf`);
- **CTDOT** *Bridge Design Manual*, 2024 revision (`CTDOT Bridge Design Manual 0224 (1).pdf`), and *Bridge and Roadway Structures Design Manual (BRSDM)*, Release 1 (`ctdot_brsdm_r1 (1).pdf`). The BRSDM replaces the BDM; where they differ, the BRSDM governs (Q22).

**Finding in short.** All three owners adopt LRFDLTS for highway sign, luminaire and traffic-signal supports. **None of the four manuals amends an LTS design provision** for ground-mounted poles or signs: there is no fatigue importance category, no deflection limit, no standard pole or foundation, and no base-plate or anchor-rod design rule. The owner rules found are a wind speed (CTDOT), the code version that governs (RIDOT, MassDOT), materials and galvanizing, a ban on adhesive anchors (CTDOT), who designs the support (MassDOT), and borings. The bridge-mounted sign-support rules (truss frames on fascias) are outside this tool's scope and are listed only for completeness.

### 6.1 RIDOT Bridge Design Manual (April 2026)

| Section | What it requires (paraphrased) | How the tool would apply it |
|---|---|---|
| §1.1.1 | The manual supplements AASHTO. On NHS projects, the latest version of each document approved by FHWA (23 CFR 625.3(f)(2), 625.4(d)) governs; a version FHWA has not yet approved needs a Project Exception. Deviations need a RIDOT waiver. | Report note in LTS mode with Owner = RIDOT: "basis: 1st Ed. with the 2017 interim; FHWA lists the 1st Ed. with the 2017 and 2018 interims (2018 rule); RIDOT §1.1.1 asks for the latest FHWA-approved version, so confirm the 2017 basis is acceptable" (Q21, Q-B1). No calculation change. |
| §1.1.3 (reference list) | Lists the AASHTO LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and Traffic Signals among the governing documents. | Confirms the LTS mode is the right basis for RIDOT highway supports. |
| §3.5 | Wind loads on sign structures, luminaires and traffic signals follow LRFDLTS (not the bridge wind of AASHTO LRFD BDS §3.8). | LTS mode wind (§2.1–2.2) as planned. No RIDOT-specific wind speed: V comes from the LTS map. |
| §5.2.2 | All reinforcement in sign-structure foundations and drilled shafts is galvanized (AASHTO M 31 Gr 60). | Drawings note and report note when Owner = RIDOT. No calculation change: f_y 60 ksi is unchanged; development of galvanized bars is not changed by galvanizing in ACI 318-19 (coating factor ψ_e applies to epoxy, not zinc). The engineer confirms. |
| §13.2.3 | Attachments (light standards, sign supports, etc.) to a MASH-compliant barrier that are not part of its tested details need State Bridge Engineer approval. | Checklist item (with the breakaway checklist, §2.9) when a support is mounted on a barrier. The tool designs ground-mounted shafts, so this is a note only. |
| Table 2-1 | Minimum vertical clearance under an overhead sign. | Overhead signs are out of scope. Not used. |

### 6.2 MassDOT Bridge Manual, Part I (Hundredth Anniversary Edition)

| Section | What it requires (paraphrased) | How the tool would apply it |
|---|---|---|
| §1.2.4.2 | Borings are required for high-mast lighting foundations and may be required for sign supports. | Foundation card note when Owner = MassDOT: the Broms soil inputs should come from borings. No calculation change. |
| §3.12.3.2–§3.12.3.3 | Sign attachments to bridges: design to the latest LTS specifications including current interims (the manual still uses the old "Standard Specifications" title); wind speed from the LTS basic wind speed figure. | Bridge-mounted signs are out of scope. For ground-mounted supports this supports using the current interims and the LTS map V (Q23). |
| §3.12.3.5–§3.12.3.7 | Bridge-mounted sign supports: AASHTO M 270 Gr 50 steel, galvanized, galvanized hardware; minimum angle and weld sizes; panel spacing. | Out of scope (bridge-mounted frames). Not used. |
| §6.1.3 (shop drawing categories) | "Steel and Aluminum Highway Structures" (signal and strain poles, highway and high-mast lighting poles, sign structures, with their anchorages) and precast light-pole and luminaire bases are shop-drawing items. | Report note only. |
| §6.3.5.1 | Unless pre-approved by MassDOT, overhead, cantilever and ground-mounted signs, light standards and traffic-signal assemblies are designed by the Contractor, with complete calculations (structure, foundations, connections) reviewed by the Designer. | The LTS-mode report already covers structure, foundation and connections; the anchor rods are covered by the Anchorage-app report. Report cover note when Owner = MassDOT: "Contractor design submittal: include the Anchorage-app report for the anchor rods." |
| §6.3.5.2 | Sign supports on bridges or walls are designed by the bridge or wall Designer. | Out of scope. |
| §6.3.5.3 | High-mast lighting: extra lowering-device requirements. | High-mast is out of scope. |

### 6.3 CTDOT Bridge Design Manual (2024 rev.) and BRSDM (Release 1)

| Section | What it requires (paraphrased) | How the tool would apply it |
|---|---|---|
| BDM §1.1.2; BRSDM Vol. 1 reference list and abbreviations | LRFDLTS ("LTS") is a governing document. | Confirms the basis. |
| BDM §14.1.3 | Structure-mounted sign supports: designed to the LTS specifications (cited by the old Standard Specifications title); **all sign support structures designed for 120 mph**. | **Q22** before any use. If the engineer confirms 120 mph applies to ground-mounted supports under LRFDLTS, Owner = CTDOT sets the default V = 120 mph, shown with the citation and editable. If it is an old Standard-Specifications value, the tool shows only a note. |
| BDM §14.1.4 | Structure-mounted sign supports: M 270 Gr 36 steel, minimum angle size, galvanizing (ASTM A123), bolts. | Out of scope (bridge-mounted frames). |
| BDM §14.2.1–§14.2.2.1 | Tubular and truss sign supports (overhead and cantilever) come from CTDOT traffic standard sheets, with standard foundations; no design needed when used as shown. | Out of scope (overhead / cantilever). Note: CTDOT standard sheets are not in the library (Q24). |
| BDM §14.2.2.2–§14.2.2.3 | Bridge-mounted and special sign supports are designed by the designer to LTS, at 120 mph adjusted for height. | As §14.1.3 (Q22). |
| BDM §7.1.4; BRSDM §6.13.3.1 and C6.13.3.1 | Welding of sign supports to AWS D1.1 (not D1.5); the commentary points to LTS for sign-support welding. | Report/drawings note on the base weld (LTS-6) when Owner = CTDOT. |
| BRSDM C3.8.1.2.5CT | Commentary contrast: one wind speed is specified for all new sign structures statewide (the value is not given in the BRSDM). | Supports Q22. |
| BRSDM §5.13.5.2CT and C5.13.5.2CT | Adhesive-bonded anchors may not connect sign, traffic-signal (mast arm and span pole) or luminaire structures to foundations, with limited exceptions (small single-post regulatory signs on concrete away from travelways; structure-mounted frames on parapets; luminaires on existing parapets; each with a minimum number of anchors). | The Anchorage-app export sends cast-in headed rods (heavy-hex nut), which comply. **Anchorage-app note** when Owner = CTDOT: adhesive anchors are not permitted for these structures (the Anchorage app's own PR; listed here for its owner). |
| BDM plates 6.2.5a/b, 6.2.6a/b, 6.2.7a | Standard details for sign anchorages and lighting-standard parapet reinforcement on bridges. | Out of scope (bridge-mounted). |

### 6.4 Searched for and not found in these four manuals

Not found anywhere in the four manuals:
- a fatigue importance category for sign, luminaire or signal supports;
- galloping, natural wind gust or truck gust amendments;
- a service deflection limit for poles or signs;
- standard light-pole or ground-mounted sign foundations (drilled-shaft size and depth tables);
- base-plate thickness or anchor-rod pretension rules for poles;
- a breakaway policy beyond the RIDOT barrier-attachment rule.

These may be in the owners' traffic or lighting standard drawings, standard specifications or special provisions, which are not in the library (Q24). Until the engineer answers, the LTS mode uses the LRFDLTS defaults. A fatigue category is not needed in scope, since fatigue design is not required (§2.7 F1).

### 6.5 What this adds to Phase B

- **LTS-1:** the optional `ltsOwner` field (default "none"; saved; old saves open as none). It drives notes and checklist items only. The one possible default is the CTDOT V after Q22.
- **LTS-6:** CTDOT AWS D1.1 note on the base weld.
- **LTS-7:** MassDOT borings note; RIDOT galvanized-reinforcement note.
- **LTS-9:** the owner notes in the Report and the Drawings general notes, each citing the manual section.
- **Anchorage app (separate PR, its own tool):** CTDOT adhesive-anchor prohibition note for sign, signal and luminaire foundations.


## 7. Source pages used

All are from the full 1st Edition, except the pages marked (2017), which come from the 2017 interim packet:
- Section 3: pp. 3-2 to 3-5, 3-14 to 3-17, 3-19 to 3-25.
- Section 4: pp. 4-1 to 4-4.
- Section 5:
  - pp. 5-1 (2017), 5-6 to 5-9, 5-13, 5-14, 5-17, 5-18, 5-25, 5-27 to 5-32;
  - pp. 5-33 to 5-35 (2017), 5-37.
- Section 10: pp. 10-1, 10-2 (2017).
- Section 11: pp. 11-3, 11-10 (2017).
- Section 12: pp. 12-1, 12-2 (2017).
- Section 13: pp. 13-1 to 13-5.
- Appendix B: pp. B-2 (2017), B-3.

Nothing further is needed from the engineer to implement Phase B.

## Sources (public)

- Federal Register, *Design Standards for Highways*, final rule, 2018-11-01 (incorporates LRFDLTS 1st Ed. with 2017 and 2018 interims): https://www.federalregister.gov/documents/2018/11/01/2018-23821/design-standards-for-highways
- AASHTO Store, *LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and Traffic Signals, 1st Edition, 2022 Interim Revisions* (item LRFDLTS-1-I5): https://store.transportation.org/Item/PublicationDetail?ID=4738
- TRID record, LRFDLTS (1st Ed.): https://trid.trb.org/view/1366480
- 23 CFR 625.4 (FHWA standards incorporated by reference): https://www.ecfr.gov/current/title-23/chapter-I/subchapter-G/part-625/section-625.4
- NCHRP Report 796 (2014), *Development and Calibration of AASHTO LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and Traffic Signals*: https://nap.nationalacademies.org/catalog/22240

## Owner manuals (engineer's reference library; cited by section, not copied)

- RIDOT, *Bridge Design Manual*, April 2026.
- MassDOT, *Bridge Manual, Part I*, Hundredth Anniversary Edition.
- CTDOT, *Bridge Design Manual* (2024 revision), and *Bridge and Roadway Structures Design Manual (BRSDM)*, Release 1.
- AASHTO, *LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and Traffic Signals*, 1st Ed. (2015), and its *2017 Interim Revisions* (LRFDLTS-1-I1).
