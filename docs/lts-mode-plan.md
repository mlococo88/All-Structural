# Light Pole and Sign Post: AASHTO LRFDLTS mode, plan (Phase A, revised A2 and B-0)

Tool: `Light Pole and Sign Post.html`. Status: **plan only; nothing in this document is implemented yet.** Written 2026-11-02 (US Eastern), revised the same day (Phase A2: owner amendments, §6; Phase B-0: basis set to the 1st Edition with the 2017 interim, provision map checked against the 2017 interim packet, pages still needed in §7), for the engineer's request "Start the LTS mode for the sign and pole app".

**Decisions so far** (engineer, 2026-11-01 / 2026-11-02, via the coordinator):
- Add an **AASHTO LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and Traffic Signals (LRFDLTS), 1st Edition (2015) with the 2017 Interim Revisions** mode alongside the existing IBC 2021 / ASCE 7-22 / AISC 360-16 / ACI 318-19 mode.
- **Design basis (engineer, 2026-11-02):** LRFDLTS **1st Edition (2015) with the 2017 Interim Revisions (LRFDLTS-1-I1)**, "the latest I have". It is not a 2nd Edition, and the later interims (2018–2022) are not applied. The engineer provided the 2017 interim packet; it holds only the replaced pages (§0.1). **Phase B is on hold for the First Edition pages listed in §7.**
- The existing mode stays exactly as it is (same results for every saved project).
- Nothing cable-related changes. Cables stay in the IBC mode only; the LTS mode does not support them and says so on screen.
- The anchor rods are designed in the Anchorage app (BasePlateAnchorDesigner). The LTS mode exports its own LTS combinations through the existing `bridgeSuite.v1.anchorGroup` hand-off (HANDOFF.md §4.11, #610).
- The base plate uses the LTS bending-line method already in the tool (b_eff = πD/n at the pole face, flagged "verify", LP-5 / #561, LP-15 / #604).

**Rules for this work.** CLAUDE.md §4 (every formula, factor and reference called out with before/after, provision with edition, hand check), §5 (saved data), §6 (every value worked, with links), §7 (one tool per PR), §8 (fixlog). No LRFDLTS text is copied into the repo: this plan and the tool **cite** articles and **paraphrase**.

---

## 0. Design basis (read first)

**Design basis: AASHTO LRFDLTS 1st Edition (2015) with the 2017 Interim Revisions (LRFDLTS-1-I1)** (engineer, 2026-11-02). The engineer has provided the 2017 interim. He says it is "the latest I have". The later interims (2018, 2019, 2020, 2022) are **not** part of the basis.
- The 2022 interim (LRFDLTS-1-I5) revised **Section 5 (steel)** and **Appendix C (fatigue)**, among others. The tool follows the 2017 text. On screen and in the report, the LTS mode will say so: "Basis: AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions. Later interims (2018–2022; the 2022 interim revised Section 5 and Appendix C) are not applied."
- Public check: FHWA's 2018 rule (Federal Register, 2018-11-01) incorporated the 1st Edition "with 2017 and 2018 Interim Revisions" into 23 CFR 625.4. So the 2017 interim is FHWA-approved; the 2018 interim is also approved but not used here. This bears on RIDOT §1.1.1 (§6.1, Q21).

### 0.1 What the provided document is

`AASHTO LRFD - Signs - Luminaires - Signals - 2017 Interim Revisions.pdf` (40 pages, © 2016, pub. code LRFDLTS-1-I1-OL), extracted to the scratchpad only.
- **It is the interim packet only: the replacement pages, not the full specification.** Its instruction page says the packet holds the revised pages that replace the corresponding pages of the First Edition binder.
- It lists the articles changed in 2017: 3.8.7 / C3.8.7; 5.3, 5.12.1 / C5.12.1; 10.4.2.1 / C10.4.2.1; 11.5.1, 11.7.2, C11.9.3, C11.9.3.1; 12.1 / C12.1; B.2.
- Because whole pages are replaced, it also contains the unchanged articles that share those pages.

| Spec pages in the packet | Articles on them (complete or partial) |
|---|---|
| 3-17 to 3-22 | 3.8.6 Gust effect factor (complete); 3.8.7 Drag coefficients with Table 3.8.7-1 and notes a–g (complete); commentary |
| 5-1, 5-2 | 5.1 Scope, 5.2 Definitions, 5.3 Notation (first page only; the notation index gives the article numbers of Section 5) |
| 5-33 to 5-36 | 5.11.3.1.2 (torsion, multi-sided), 5.11.3.2 (torsion, other shapes), **5.12.1 combined forces (complete, incl. the moment magnifier B)**, 5.12.2 (square/rect. diagonal bending), 5.13 cables, 5.14 welded connections, 5.15 bolted connections, 5.16 anchor bolt connections and 5.16.1 types (start) |
| 10-1, 10-2 | 10.1–10.4.2.2: **deflection limits (complete for vertical supports)** |
| 11-3, 11-4 | end of 11.3 notation, **11.4 applicable structure types**, 11.5 design criteria, 11.5.1, start of 11.6 (without Table 11.6-1) |
| 11-9 to 11-18 | 11.7.1.2 natural wind gust, 11.7.1.3 truck gust, **11.7.2 HMLT fatigue** with Table 11.7.2-1, 11.8, 11.9.1, 11.9.2 nominal stress, 11.9.3 resistance, 11.9.3.1 stress-concentration factors (start: Eq. 11.9.3.1-1, parameters) |
| 11-21, 11-22 | part of Table 11.9.3.1-1: details 3.2 (reinforced handholes) and 4.1–4.7 (groove-welded) |
| 11-27 | references |
| 12-1, 12-2 | 12.1–12.5.1 breakaway |
| B-1, B-2 | B.1 notation, **B.2 Table B.2-1 (approximate tube properties)** |

**Not in the packet** (needed from the engineer's First Edition book; list in §7):
- Section 3 except 3.8.6–3.8.7: load combinations Table 3.4-1, dead/live loads, ice, the wind pressure equation, K_z, K_d, the wind maps and MRIs.
- Section 4 (analysis; the magnifier B for non-prismatic members).
- Section 5.4–5.11.3.1.1: materials, resistance factors, details (5.6, incl. base plates 5.6.6), width-thickness (5.7), flexure (5.8), tension (5.9), compression (5.10), shear and round torsion (5.11.2, 5.11.3.1.1).
- 11.6 Table 11.6-1, 11.7.1.1 galloping, the rest of Table 11.9.3.1-1 and Table 11.9.3.1-2.
- Section 13 foundations; Section 2 (breakaway location rules).

**Consequence.** Phase B cannot start: wind pressure, load combinations and member resistances are all missing. This docs PR (B-0) records what the packet confirms, and §7 lists the pages needed.

### 0.2 "2nd Ed." references in the repo (change in Phase B, not now)

These on-screen texts and code comments still say "LRFDLTS 2nd Ed.". They change to "AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions" in the Phase B PR named against each. Each change is a display change with a fixlog entry. Fixlog entries already merged (LP0-1, LP5-1, LP15-1) are history and stay as written; the Phase B entry records the correction.

| File | Where (anchor) | Text now | Change in |
|---|---|---|---|
| `Light Pole and Sign Post.html` | masthead `id="lppScope"` (LP0-1), also on the report cover | "… AASHTO LRFDLTS 2nd Ed. highway supports are a separate mode (coming) …" | LTS-1 (the scope line becomes mode-dependent) |
| `Light Pole and Sign Post.html` | `const LPP_BP_VERIFY=` (LP15-1; base-plate worked block, Summary warnings, Report) | "VERIFY the base-plate method against AASHTO LRFDLTS 2nd Ed. — …" | **LTS-6**, with Art. 5.6.6.1 confirmed from the book pages |
| `Light Pole and Sign Post.html` | comment in `anchorBolts()` above the base-plate block | "… until the AASHTO LRFDLTS 2nd Ed. mode is added." | LTS-6 |
| `Light Pole and Sign Post.html` | `basePlateWorkedHTML()`, the `eq-why` line on the double-nut base | "… (and in the AASHTO LRFDLTS 2nd Ed. mode until that mode is added) …" | LTS-6 |
| `BasePlateAnchorDesigner.html` | circular base-plate step `ref:"AASHTO LRFDLTS 2nd Ed., …"` | worked-step reference | **Another tool**: its own one-tool PR (CLAUDE.md §7) after LTS-6 |

Confidence / status column key (§2):
- **Confirmed**: from the provided 2017 interim packet, with article / equation / table and spec page.
- **Index only**: the article number is confirmed by the Section 5 notation index (Art. 5.3, p. 5-2), but its content is not in the packet.
- **Not in the provided document**: my earlier recollection, kept for orientation. **The engineer must supply the page.**
- **Tool**: already in the tool and accepted by the engineer (fixlog reference).

---
## 1. Scope

### 1.1 Structures the LTS mode covers (Phase B)

| Structure | Tool geometry today | LTS mode |
|---|---|---|
| **Luminaire pole with arms** (roadway lighting, one or more davit/truss-type arms or a post-top luminaire) | Pole mode: height H; round tapered tube (top and base OD and wall), or square/rect HSS (prismatic); fixtures table: mounting height, azimuth θ, arm length a, EPA, ice EPA, weight, arm OD; arm wind and fixture torsion (LP-7) | **Yes.** Same geometry. Adds a **multi-sided (8-, 12-, 16-sided) tapered section** option (LTS member checks and C_d depend on it). Cables are hidden (see §1.3). |
| **Monopost sign** (ground-mounted roadside sign on one post) | Sign mode, 1 post: panel B × s, clearance, panel weight, post shape and size; Case A/B/C wind; torsion | **Yes.** LTS sign C_d replaces ASCE 7 Fig. 29.3-1 Cases A/B/C (LTS applies a single drag coefficient by aspect ratio; eccentric/torsion load case to be confirmed, Q7). |
| **Two-post sign** | Sign mode, 2 posts at spacing L_p, two shafts | **Yes.** Same statics split as the IBC mode. |

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
- **Can't (today):** multi-sided sections (added in Phase B); slip-fit or flange splices along the pole; a handhole (added as a detail input in Phase B for fatigue and the strength check); long arms as members; transformer bases; layered soil.

---

## 2. Provision map (status after the 2017 interim packet, 2026-11-02)

One row per computed check or value. Forms are paraphrased; coefficients are given only where the packet confirms them (needed to implement and to hand-check). "Was" records where my earlier recollection differed.

### 2.1 Design life, recurrence, wind speed

| # | Computed / value | Article | Form to implement | Default | Status |
|---|---|---|---|---|---|
| W1 | Design life and risk category | Section 3 (believed Art. 3.8 / table of design life and MRI) | User selects risk category; MRI shown | Typical | **Not in the provided document** |
| W2 | Basic wind speed V (3-s gust) by MRI | Art. 3.8.2 and the wind maps (believed) | **Input** V (map value), MRI shown; no maps in the tool | 130 mph placeholder | **Not in the provided document.** C3.8.7 (p. 3-17) confirms that the wind speeds are the ASCE/SEI 7-10-based extreme speeds ("typically 105 mph or greater"). |
| W3 | Service I wind speed | Section 3 (believed) | **Input** V_svc | placeholder | **Not in the provided document** |
| W4 | Yearly mean wind speed (fatigue) | Art. 11.7.1.2 (p. 11-9); Art. 11.7.2 and Fig. 11.7.2-1 (pp. 11-10, 11-11) | Natural-wind-gust pressure is based on V_mean = 11.2 mph, with an optional site-specific (V_mean/11.2)² form (Eq. C11.7.1.2-1). HMLT: V_mean from Fig. 11.7.2-1 | — | **Confirmed**, but **not used**: fatigue does not apply to the structures in scope (F1) |

### 2.2 Wind pressure

| # | Computed / value | Article | Form to implement | Default | Status |
|---|---|---|---|---|---|
| P1 | Design wind pressure P_z | Art. 3.8.1, Eq. 3.8.1-1 (believed) | P_z = 0.00256·K_z·K_d·G·V²·C_d (believed form) | — | **Not in the provided document** (only G and C_d are) |
| P2 | K_z | Art. 3.8.4 (believed) | from the book | — | **Not in the provided document** |
| P3 | K_d | Art. 3.8.5 (believed) | from the book | — | **Not in the provided document** |
| P4 | Gust effect factor G | **Art. 3.8.6** (p. 3-17) | G is taken as no less than 1.14. The commentary treats these structures as wind-sensitive; a rigorous ASCE 7 gust analysis is allowed only with the Owner's permission. The tool uses G = 1.14 (n₁ is still shown, for information). | 1.14 | **Confirmed.** Was "Art. 3.8.5". |
| P5 | Velocity conversion C_v for the C_d argument | **Art. 3.8.7** (p. 3-17) | C_v = 0.8 at the Extreme limit state, 1.0 otherwise; the Reynolds-type argument is C_v·V·d (mph·ft) | — | **Confirmed** (new to the plan) |
| P6 | C_d round (cylindrical) | **Table 3.8.7-1** (p. 3-20) | C_v·V·d ≤ 39: 1.10; 39 < C_v·V·d < 78: 129/(C_v·V·d)^1.3; ≥ 78: 0.45 | — | **Confirmed.** Was "≈ 0.45–0.5". |
| P7 | C_d 16-sided | Table 3.8.7-1 (p. 3-20) | r_c = corner radius / inscribed-circle radius. Low end 1.10. High end 0.83 − 1.08·r_c for 0 ≤ r_c < 0.26, 0.55 for r_c ≥ 0.26. Transition: the two published expressions in C_v·V·d. Note e: interpolation toward the round value between r_m = 0.26 and r_r = 0.63. | — | **Confirmed.** The transition expressions are garbled in the text extract; they are re-read from the PDF page image before LTS-2 (Q-B2). |
| P8 | C_d 12-sided | Table 3.8.7-1 (p. 3-20) | 1.20 / 10.8/(C_v·V·d)^0.6 / 0.79; note e: r_m 0.50, r_r 0.75 | — | **Confirmed** |
| P9 | C_d 8-sided | Table 3.8.7-1 (p. 3-20) | 1.20 constant; note e: r_m 0.75, r_r 1.00 | — | **Confirmed.** Was "≈ 1.2–1.4". |
| P10 | C_d square | Table 3.8.7-1 (p. 3-20) | 2.0 − 6r_s for r_s < 0.125, 1.25 for r_s ≥ 0.125 (r_s = corner radius / depth, wind normal to a face); diamond 1.70 / 1.90 | — | **Confirmed** (the r_s definition is from the table drawing; to confirm, Q-B2) |
| P11 | C_d flat members (plates, angles) | Table 3.8.7-1 | 1.70 | — | **Confirmed** |
| P12 | C_d sign panels | Table 3.8.7-1 (p. 3-19) | By L_sign/W_sign: 1.0 → 1.12; 2.0 → 1.19; 5.0 → 1.20; 10.0 → 1.23; 15.0 → 1.30. Linear interpolation between rows (Q-B3). Dynamic message signs 1.70. | — | **Confirmed.** Was "≈ 1.12 … ≈ 1.19". |
| P13 | Luminaires and attachments | Table 3.8.7-1 (p. 3-19) | Luminaires: 0.50 (rounded surfaces), 1.20 (flat-sided). Attachments: use the manufacturer's EPA (C_d × area) when given; otherwise C_d = 1.0. Traffic signals 1.20. | EPA | **Confirmed.** The tool's EPA input matches: F = P_z/C_d·EPA, i.e. q·EPA with C_d inside the EPA. |
| P14 | Elliptical members; two members in line | Table 3.8.7-1 | not used (no such members in scope) | — | Confirmed, not used |
| P15 | Wind directions | — | the 4 tool azimuths (as IBC mode) | — | **Not in the provided document** (any skew rule for signs is in Section 3) |

### 2.3 Ice, dead and live loads

| # | Item | Article | Status |
|---|---|---|---|
| I1 | Ice load | Section 3 (believed Art. 3.7) | **Not in the provided document** |
| I2 | Dead load | Section 3 (believed Art. 3.6) | **Not in the provided document** (self-weight as in the tool) |
| I3 | Live load | Section 3 | **Not in the provided document** (expected not applicable: no walkways) |

### 2.4 Load combinations and factors

| # | Item | Article | Status |
|---|---|---|---|
| C1–C4 | Strength I, Extreme I (wind; wind + ice), Service I load factors | **Table 3.4-1** (the number is confirmed by Arts. 11.5 and 12.4, pp. 11-3, 12-2) | Table **not in the provided document**. Was "Table 3.4.1-1". |
| C5 | Fatigue I | Table 3.4-1; Art. 11.5 / 11.5.1 (p. 11-3, 11-4): γ·Δf ≤ φ·ΔF with φ = 1.0 and γ from Table 3.4-1 | **Confirmed** (form and φ); γ not in the packet; fatigue not required in scope (F1) |
| C6 | Second-order effects | **Art. 5.12.1** (p. 5-34): moment magnifier B. Prismatic member in compression: B = 1/(1 − P_u/P_e), P_e = π²EA_g/(KL/r)² (Eqs. 5.12.1-10, -11). Tension: B = 1.0 (Eqs. 5.12.1-12, -13). **Non-prismatic (tapered) member in compression: B per Section 4.** | Prismatic form **Confirmed**. The tapered-pole method (Section 4) is **not in the provided document**. Until it is provided, the plan keeps the tool's present B₂ from the Rayleigh drift, flagged "verify against LRFDLTS Section 4". |

### 2.5 Member design (Section 5, 2017 text)

The notation index (Art. 5.3, p. 5-2) confirms the Section 5 article layout: 5.6 details (5.6.2, 5.6.3, 5.6.5 backing ring, **5.6.6.1** base plate), 5.7 width-thickness (5.7.2 tubes, 5.7.3 Table 5.7.3-1), 5.8 flexure (5.8.2 round/tubes), 5.9 tension, 5.10 compression (5.10.2.1–5.10.2.3, effective area for slender), 5.11 shear and torsion (5.11.2.1.1 round, 5.11.2.1.2 multi-sided, 5.11.2.2, 5.11.3.1.1 round, 5.11.3.1.2 multi-sided), 5.12 combined. E = 29,000 ksi.

| # | Check | Article | Form | Status |
|---|---|---|---|---|
| M1 | Resistance factors | Art. 5.5 (5.5.3) | — | **Index only**, not in the provided document |
| M2 | Width-thickness, round | Art. 5.7.2 | — | **Index only** |
| M3 | Width-thickness, multi-sided / square | Art. 5.7.2, 5.7.3 (Table 5.7.3-1) | — | **Index only** |
| M4 | Flexure round / multi-sided / square | Art. 5.8.2 (and 5.8.x) | — | **Index only** |
| M5 | Shear | Art. 5.11.2.1.1 (round), 5.11.2.1.2 (multi-sided), 5.11.2.2 (square/rect: shear buckling C_v) | — | **Index only** |
| M6 | Torsion, round | Art. 5.11.3.1.1 | — | **Index only** |
| M7 | Torsion, multi-sided | **Art. 5.11.3.1.2, Eq. 5.11.3.1.2-1** (p. 5-33) | F_nt = 0.6F_y (no buckling within the width-thickness limits) | **Confirmed** |
| M8 | Torsion, square/rect. | **Art. 5.11.3.2, Eq. 5.11.3.2-1** (p. 5-33) | F_nt = F_nv | **Confirmed** (F_nv from 5.11.2.2, not provided) |
| M9 | Axial resistance P_r | Art. 5.10 (compression), 5.9 (tension); P_r = φ_c·P_nc or φ_t·P_nt (Eqs. 5.12.1-8, -9) | | Forms of P_r **Confirmed**; P_n **Index only** |
| M10 | **Combined forces** | **Art. 5.12.1** (pp. 5-33, 5-34) | If T_u/T_r > 0.20: P_u/P_r + (B·M_u/M_r + V_u/V_r + T_u/T_r)² ≤ 1.0 (Eq. 5.12.1-1). If T_u/T_r ≤ 0.20, shear and torsion may be ignored: P_u/P_r ≥ 0.20 → P_u/P_r + (8/9)·B·M_u/M_r ≤ 1.0 (Eq. 5.12.1-2); P_u/P_r < 0.20 → P_u/(2P_r) + B·M_u/M_r ≤ 1.0 (Eq. 5.12.1-3). Vertical luminaire supports: P_u/(2P_r) may be approximated as 0.08. Round and multi-sided: M_u = √(M_ux² + M_uy²), V_u = √(V_ux² + V_uy²) (Eqs. 5.12.1-4, -5). Biaxial on principal axes (square/rect.): B_x·M_ux/M_rx + B_y·M_uy/M_ry, and V_u/V_r = the larger axis ratio (Eqs. 5.12.1-6, -7). | **Confirmed.** Was "Eq. 5.12.2-1, square of the whole sum". The torsion threshold and the AISC-style branches are new. |
| M11 | Square/rect. tubes, diagonal bending | **Art. 5.12.2, Eq. 5.12.2-1** (pp. 5-34, 5-35) | interaction with an exponent α (1.6 for compact, 1.0 for slender limits) under skewed loading | **Confirmed** (the α limits refer to 5.7 λ_r and λ_max, not provided) |
| M12 | Tube properties | Art. B.2, Table B.2-1 (p. B-2) | approximate I, S, A, Z/S, r for round, 16-, 12-, 8-sided, square tubes from R (mid-wall radius) and t (e.g. 8-sided I ≈ 3.50R³t, round 3.14R³t; Z/S 1.27 / 1.27 / 1.26 / 1.24 / 1.12) | **Confirmed.** The tool computes exact polygon properties and shows Table B.2-1 as a cross-check. |

### 2.6 Connections and welds

| # | Check | Article | Status |
|---|---|---|---|
| J1 | Base-plate thickness (double-nut) | **Art. 5.6.6.1** (number confirmed by the notation index; it uses D) | Content **not in the provided document**. The tool keeps the LP-5 method (b_eff = πD/n) flagged "verify" until the page is provided. |
| J2 | Minimum plate thickness | Art. 5.6.6 (believed) | **Not in the provided document** |
| J3 | Welds | **Art. 5.14** (p. 5-35): welding design and fabrication to AWS D1.1 (2010) and D1.4 (2011); fatigue in Section 11 | **Confirmed** (by reference). The weld strength rules are those of AWS D1.1, which is not in the library (Q-B5). |
| J4 | Backing ring (CJP) | Art. 5.6.5 (backing ring height H) | **Index only** |
| J5 | Handhole (strength) | Section 5.6 (believed) | **Not in the provided document** |
| J6 | Anchor bolts | **Art. 5.16, 5.16.1** (pp. 5-35, 5-36): new construction uses cast-in-place anchor bolts; headed by a forged head, nut, washer or plate; hooked bolts only with F_y ≤ 55 ksi; deformed bars allowed; **at least eight bolts for HMLTs**; anchorage design in Section 15 (Art. 5.1) | **Confirmed.** The tool's export sends headed cast-in rods (compliant). The Anchorage app designs them (per #616). New check note: hooked rods with F_y > 55 ksi are not permitted. |
| J7 | Bolted connections | **Art. 5.15**: per AASHTO LRFD BDS (current) | **Confirmed** (none in scope) |

### 2.7 Fatigue (Section 11)

| # | Item | Article | Status / effect |
|---|---|---|---|
| F1 | **Applicability** | **Art. 11.4** (p. 11-3): fatigue design is required for overhead cantilevered sign structures, overhead cantilevered traffic-signal structures, high-mast lighting towers, and overhead non-cantilevered sign and signal structures. C11.4: common lighting poles and roadside signs are not included (no fatigue history), except that square lighting poles are much more fatigue-prone and call for caution. **Art. 11.7.2** (p. 11-10): HMLTs are 55 ft or taller; luminaire supports under 55 ft need no fatigue design. | **Confirmed.** **Effect: no fatigue check for any structure in scope** (luminaire poles < 55 ft; ground-mounted monopost and two-post signs). The LTS mode states this, worked: "H = … ft < 55 ft and not an overhead structure → Art. 11.4 / 11.7.2: fatigue design not required". It warns at H ≥ 55 ft (HMLT, out of scope) and shows the C11.4 caution for square poles. Was a planned full fatigue PR (LTS-4); it becomes an applicability step in LTS-5. |
| F2 | Fatigue importance factor I_F | Art. 11.6, Tables 11.6-1 / 11.6-2 (p. 11-4) | Article confirmed; tables **not in the provided document**; not needed in scope |
| F3 | Galloping | Art. 11.7.1.1 | **Not in the provided document**; not applicable (no cantilever arms in scope) |
| F4 | Natural wind gust | **Art. 11.7.1.2, Eq. 11.7.1.2-1** (p. 11-9): P_NW = 5.2·C_d·I_F psf, applied to overhead sign and signal supports | **Confirmed**; not applicable in scope |
| F5 | Truck-induced gust | **Art. 11.7.1.3, Eq. 11.7.1.3-1** (pp. 11-9, 11-10): P_TG = 18.8·C_d·I_F psf, overhead sign supports, full up to 20 ft, linear to zero at 33 ft | **Confirmed**; not applicable in scope |
| F6 | HMLT combined wind | **Art. 11.7.2, Eq. 11.7.2-1, Table 11.7.2-1** (pp. 11-10, 11-11): P_CW = P_FLS·C_d; P_FLS 5.8–7.2 psf by V_mean and category; includes vortex shedding | **Confirmed**; HMLT out of scope |
| F7 | Vortex shedding (non-HMLT) | — | For HMLTs it is included in P_CW (p. 11-11). A separate article for other structures is **not in the provided document**; not needed in scope. |
| F8 | Infinite-life criterion | **Art. 11.5, 11.5.1, 11.9.3, Eq. 11.9.3-1** (pp. 11-3, 11-4, 11-14): γ·(Δf)_n ≤ φ·(ΔF)_TH, φ = 1.0, infinite life for new design | **Confirmed**; not needed in scope |
| F9 | Nominal stress rules (handholes K = 4.0 at the root, socket weld toe on the gross tube, …) | **Art. 11.9.2** (pp. 11-13, 11-14) | **Confirmed**; not needed in scope |
| F10 | Detail table and K_F/K_I | Table 11.9.3.1-1 (rows 3.2 and 4.1–4.7 in the packet); Eq. 11.9.3.1-1; Table 11.9.3.1-2 missing | Partly in the packet; not needed in scope |

### 2.8 Deflection (Section 10)

| # | Check | Article | Form | Status |
|---|---|---|---|---|
| D1 | **Luminaire supports** | **Art. 10.4.2.1** (p. 10-1) | Service I (dead load + wind): Δ_top ≤ **10 %** of the structure height. The 2017 interim changed it from 15 %. C10.4.2.1: computed with unit load factors, with second-order effects normally included. | **Confirmed.** Was "≈ 0.15H". |
| D2 | Vertical supports with transverse loads | Art. 10.4.2.1 | Service I: Δ_top ≤ 2.5 % of the height (C10.4.2.1: developed for strain-pole span-wire dead load) | **Confirmed.** Which structures it applies to in scope (signs?) is Q-B4. |
| D3 | Vertical supports with moment loads | Art. 10.4.2.1 | Service I: slope at the top ≤ 0.35 in/ft (≈ 1°40′; C10.4.2.1: single mast arm luminaire poles with an eccentric dead load) | **Confirmed.** Applied to poles with unbalanced arms (Q-B4). |
| D4 | Overhead / horizontal supports | Art. 10.4.1 (L/150), 10.4.2.2 | — | Confirmed; out of scope |
| D5 | Computation | Art. 10.4.2.1 | elastic deflection by the usual methods; the tool's tapered-pole deflection | **Confirmed** (method allowed) |

### 2.9 Breakaway (Section 12)

| # | Item | Article | Status |
|---|---|---|---|
| B1 | Requirement and testing | **Art. 12.1, 12.3, 12.4, 12.5.1** (pp. 12-1, 12-2): breakaway supports where the location guidelines of Section 2 require them. Breakaway devices meet MASH (2009) impact criteria. Structural adequacy is shown by the Manufacturer (load tests at least at the Extreme I loads when in question). | **Confirmed**. Checklist only, as planned. The location rule (Section 2) is not in the packet. |

### 2.10 Foundations (Section 13)

| # | Item | Status |
|---|---|---|
| G1–G5 | Drilled-shaft lateral (Broms), torsion, load and resistance factors, structural design, minimum embedment | **Not in the provided document**. The tool's Broms reference check cites C13.6.1.1 (accepted earlier); its status as a design method needs Section 13. Art. 5.1 places anchorage requirements in **Section 15**, also not provided. |

### 2.11 Export to the Anchorage app

| # | Item | Basis | Status |
|---|---|---|---|
| X1 | `bridgeSuite.v1.anchorGroup` in LTS mode | HANDOFF.md §4.11 (#610) | **Tool** (schema unchanged). The combinations come from Table 3.4-1, which is not in the packet. |

## 3. Inputs, saved data, UI, report, tests

### 3.1 Inputs

**Reused unchanged:** pole height, shape, top/base OD and wall, F_y, density; fixtures table (height, θ, a, EPA, weight, arm OD); sign B, s, clearance, weight, post spacing; shaft shape and size, f′c, f_y, cover, rebar; Broms soil inputs; anchor rods (sent to the Anchorage app); base plate D, F_y, t.

**New (LTS mode only; ids prefixed `lts`):**

| Id | Input | Default |
|---|---|---|
| `ltsEd` | Edition label (display only, not an input) | "AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions; later interims not applied" |
| `ltsOwner` | Owner: none / RIDOT / MassDOT / CTDOT (applies §6 rules: notes, defaults, checklist items) | none |
| `ltsRisk` | Risk category: Low / Typical / High | Typical |
| `ltsV` | Basic wind speed V for that MRI (mph) | 130 (placeholder, engineer to set) |
| `ltsVsvc` | Service wind speed (mph) | 76 (placeholder) |
| `ltsExpo` | Exposure (C; B/D if allowed) | C |
| `ltsKdMode` | K_d: table / override | table |
| `ltsIceMode` | Ice: LTS 3 psf rule / ASCE 7-22 Ch. 10 | per Q5 |
| `ltsEpaBasis` | Luminaire EPA basis: manufacturer (C_d incl.) / projected × C_d | manufacturer |
| `ltsSides` | Multi-sided: 8 / 12 / 16 (with shape "Multi-sided" added to `poleShape` **in LTS mode only**) | 16 |
| `ltsRc` | Multi-sided: corner radius / inscribed radius r_c (Table 3.8.7-1 note e); square: r_s | lowest reasonable value (C3.8.7: conservative when unknown) |
| `ltsBaseDet` | Pole-to-plate detail: socket fillet / CJP with backing ring (weld strength per Q-B5; no fatigue in scope) | socket fillet |
| `ltsWeldW` | Socket fillet size, in | 5/16 |
| `ltsFexx` | Weld F_EXX, ksi | 70 |
| `ltsHH` | Handhole: none / reinforced; height above base, size | reinforced, 1.5 ft, 4 × 6.5 in |
| `ltsDefLim` | Deflection limits: code (Art. 10.4.2.1: 10 % H luminaire; 2.5 % H / 0.35 in/ft per Q-B4) or a stricter user value | code |
| `ltsClearZone` | Breakaway checklist: in the clear zone? | no |
| `ltsPhiSoil` | Soil resistance factor for Broms | per Q19 |

### 3.2 Saved data (CLAUDE.md §5)

- **New top-level state field `codeMode`** (`'ibc'` | `'lts'`) in `captureState()`. `applyState()`: a save without `codeMode` opens as **`'ibc'`**, so every existing project and JSON file computes identically. No migration of any existing field.
- **New inputs** are appended to `INPUT_IDS` with their defaults applied in `applyState()` when absent (the existing pattern). The IBC inputs are never rewritten by the LTS mode; switching modes keeps both sets.
- **Storage keys unchanged:** `lpp_projects_v1`, `lpp_session_v1`, `lpp_activeTab_v1`, `lpp_inputTab_v1`. No new key. The JSON export stays `format:'lpp-project', version:1` (fields added; older files import as IBC).
- **Cables:** the `cables` array and `cablesEnabled` stay in the state untouched. In LTS mode they are ignored (not drawn, not loaded) and the cable card shows "Cables are not supported in the AASHTO LRFDLTS mode; switch to the IBC mode to design cabled poles. Your cable inputs are kept." If a project with cables enabled is switched to LTS, a warning says that the cables are ignored.
- **Hand-off:** `bridgeSuite.v1.anchorGroup` unchanged in schema; only `basis.combos` text and the combinations differ in LTS mode.
- **Tested:** every Phase B PR runs `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves` (IBC mode: results, cable values and text identical in all cases) and a new LTS case set.

### 3.3 UI

- **Mode selector:** a second segmented control in the mode card, above Light pole / Sign: **"IBC 2021 / ASCE 7-22"** (default) | **"AASHTO LRFDLTS"**. The masthead code tag and the scope line (LP0-1) change with the mode.
- **Inputs:** card 1 (wind) shows the LTS wind inputs instead of the ASCE ones; the ice card follows Q5; the cable card is replaced by the "not supported" note; a new card "Base weld & handhole"; the soil card makes Broms the design method (IBC soil class hidden).
- **Output tabs:** same tabs. Loading (LTS P_z worked per component, combinations table of Table 3.4-1); Post (Section 5 checks, combined-force equation, deflection and the fatigue-applicability step); Anchorage (export of LTS combos); Shaft (Broms design + torsion + ACI structural); Summary (LTS verdict list, with breakaway checklist and deflection); Report / Drawings (mode-dependent labels and notes; the Calc sheet was retired in #625, the Report is the one report).
- §6 links: every quoted value links to its worked block (in-app) and "see §x.y" in print, as now.

### 3.4 Report and drawings

- The Report (shared/report.js) gets an LTS section set: Design criteria (basis "1st Ed. 2015 with 2017 Interim Revisions; later interims not applied", risk category, MRI, V, V_svc), Loads (P_z per component), Combinations, Member, Base plate & weld, Fatigue applicability (Arts. 11.4, 11.7.2), Deflection (Art. 10.4.2.1), Foundation (Broms), Anchorage (pointer to the app), Breakaway checklist, Assumptions (incl. "cables not supported", "anchor rods designed in the Anchorage app", every "verify" flag still open).
- Drawings: general notes switch to the LTS references; the pole elevation adds the handhole and the base weld detail callout; no new sheets.

### 3.5 Test plan

- `tests/engine/lightpole.test.mjs` gains an LTS block per Phase B PR (the harness `tests/engine/lp-source.mjs` already loads the page's functions).
- Every PR: `node tests/check-syntax.mjs`; `node tests/engine/run.mjs lightpole`; `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves` (**IBC mode identical**, cable values identical); `tests/smoke/lightpole-anchor-handoff.mjs`; one page-load smoke check (0 console errors) and screenshots at 1280 / 390 px.
- **Hand-check cases** (computed by hand in Phase B, after the engineer's answers fix the coefficients; inputs fixed now):

**HC-1 Luminaire pole.** 40 ft round tapered steel pole, base OD 8.0 in, top OD 4.5 in (taper 0.0875 in/ft), wall 0.1793 in (7 ga), F_y 55 ksi; one 8 ft davit arm at 38 ft, OD 2.375 in; one luminaire at the arm tip, EPA 1.2 ft² (manufacturer, drag included), 55 lb; Risk Typical, V 130 mph, Exposure C, V_svc 76 mph; socket-fillet base weld 5/16 in E70; handhole reinforced at 1.5 ft; base plate D 15 in, t 1.25 in, F_y 36, 4 × 1 in rods on BC 13 in; round shaft 30 in, cohesionless φ = 30°, γ = 115 pcf. Hand values to produce: K_z at 5 ft strips and at 38 ft; C_d (round) at the base and the top, with C_v = 0.8 (Extreme) and 1.0 (Service); P_z; base V, M, T; B; λ and class at the base; φM_n, φV_n, φT_n, φP_n; T_u/T_r and the Art. 5.12.1 branch; combined ratio; t_req; weld stress; fatigue applicability (40 ft < 55 ft → not required); Δ_top (Service I) ≤ 0.10·H = 48 in and the top slope vs 0.35 in/ft (Q-B4); Broms embedment; export combination 1 values.

  Already computable from the packet: C_d at the base under Extreme I, with C_v·V·d = 0.8·130·(8/12) = 69.3 mph·ft, in the 39–78 range: C_d = 129/69.33^1.3 = 129/247.3 = 0.522. At the top (4.5 in): 0.8·130·0.375 = 39.0 → C_v·V·d ≤ 39, so the 1.10 branch applies: C_d = 1.10. (The middle-branch formula gives 129/117.05 = 1.102 at 39, so the table is very nearly continuous there.) Service I with V_svc = 76: base 1.0·76·0.667 = 50.67 → 129/164.5 = 0.784.

**HC-2 Monopost sign.** Panel 8 ft wide × 5 ft high, clearance 7 ft (top at 12 ft), panel 4 psf; round post 6.625 × 0.280 in (A500 Gr C, F_y 50; t_des per Q11), one post; Risk Typical, V 130 mph; base plate D 14 in, t 1.25 in, 4 × 1 in rods on BC 11 in; round shaft 30 in, cohesive c_u = 1,000 psf. Hand values: C_d (sign L/W = 8/5 = 1.6 → between 1.12 at 1.0 and 1.19 at 2.0; linear 1.12 + 0.6·0.07 = 1.162, per Q-B3), P_z at the panel centroid, F, torsion from any eccentric case (Q7), M, V, T at the base; post checks; t_req; Broms embedment and shaft torsion; fatigue applicability (roadside sign, Art. 11.4 → not required); deflection 2.5 % H (Q-B4).

---

## 4. Questions for the engineer: status after the 2017 interim packet

**Answered from the packet:**
- **Q0** Basis: 1st Ed. (2015) with the 2017 interim (engineer, 2026-11-02).
- **Q2 (part)** G = 1.14 minimum (Art. 3.8.6). The P_z equation itself is not in the packet.
- **Q6** C_d: Table 3.8.7-1 and C_v (Art. 3.8.7): round, 8/12/16-sided, square, flat, signs by L/W, luminaires 0.50/1.20, attachments by EPA or C_d = 1.0 (§2.2 P5–P13). The manufacturer's EPA includes C_d.
- **Q8 (part)** The table is Table 3.4-1 (its content is not in the packet). Second order: magnifier B per Art. 5.12.1 for prismatic members; Section 4 for tapered ones.
- **Q10 (part)** Combined-force equations, Art. 5.12.1 (§2.5 M10). Multi-sided torsion F_nt = 0.6F_y. The classes, M_n, V_n, round T_n and P_n are not in the packet.
- **Q12b (part)** Welds to AWS D1.1 (Art. 5.14).
- **Q13** Fatigue applicability: not required for luminaire poles < 55 ft or roadside signs (Arts. 11.4, 11.7.2); infinite life only (Art. 11.5).
- **Q14, Q15, Q16a, Q16b** Moot in scope (no fatigue). Q16b: the Anchorage app needs no fatigue check for these structures.
- **Q17** Deflection: luminaire supports 10 % H under Service I; 2.5 % H for transverse loads; 0.35 in/ft slope for moment loads (Art. 10.4.2.1).
- **Q18** Breakaway: checklist, with MASH and Manufacturer certification (Section 12).
- **Q21 (part)** FHWA incorporated the 1st Ed. with the 2017 and 2018 interims (Federal Register 2018-11-01), so the 2017 basis is FHWA-approved for RIDOT NHS work.

**Still open (need the book pages, §7):** Q1, Q2 (P_z equation), Q3, Q4, Q5, Q7, Q8 (Table 3.4-1), Q9, Q10 (rest), Q11, Q12a, Q12c, Q19, Q20, and the owner questions Q22–Q25.

**New questions from the packet:**
- **Q-B1.** Basis: OK that the tool states "1st Ed. (2015) with 2017 Interim Revisions; later interims not applied" on screen and in the report, even though FHWA also lists the 2018 interim and the 2022 interim revised Section 5 and Appendix C?
- **Q-B2.** The 16-sided C_d transition expressions (Table 3.8.7-1, p. 3-20) do not extract cleanly from the PDF. I will read them from the page image before LTS-2; please confirm against your book. Also confirm r_s for the square C_d (corner radius / depth?).
- **Q-B3.** Sign C_d between the tabulated L/W ratios: interpolate linearly, or take the next higher row?
- **Q-B4.** Deflection, Art. 10.4.2.1: should the 2.5 % (transverse load) and 0.35 in/ft (moment load) limits apply to ground-mounted signs and to luminaire poles with an unbalanced arm, in addition to the 10 % luminaire limit? The commentary describes them as dead-load aesthetic limits (strain poles; single-arm poles), while the article text says Service I.
- **Q-B5.** Base weld strength: Art. 5.14 points to AWS D1.1. Use the AWS D1.1 (or AISC 360-16 J2) fillet-weld strength with LTS φ, or leave weld strength to the fabricator's shop drawings and note it?
- **Q-B6.** Square luminaire poles: C11.4 cautions against them even with a fatigue design. Should the LTS mode warn (or block) square poles?

## 5. Phase B PR sequence (revised; on hold for the pages in §7)

0. **B-0 (this PR, docs):** packet inventory, provision-map status, revised questions.
1. **LTS-1** Mode switch (`codeMode`), LTS inputs, loads and the Table 3.4-1 combinations; cables hidden with the note; basis line "1st Ed. (2015) with 2017 Interim Revisions; later interims not applied". IBC mode identical. *Needs: Table 3.4-1, Section 3 dead/ice loads.*
2. **LTS-2** Wind: P_z, K_z, K_d (need Section 3), G = 1.14 (Art. 3.8.6), C_d and C_v (Art. 3.8.7, Table 3.8.7-1, confirmed); multi-sided shapes.
3. **LTS-3** Members: Section 5 classes and resistances (need 5.5, 5.7–5.11); combined forces Art. 5.12.1 (confirmed); B per Art. 5.12.1 / Section 4.
4. ~~LTS-4 Fatigue~~ **dropped**: not required in scope (Arts. 11.4, 11.7.2). It becomes the applicability step inside LTS-5.
5. **LTS-5** Deflection (Art. 10.4.2.1, confirmed), the fatigue-applicability step, the breakaway checklist (Section 12).
6. **LTS-6** Base plate (Art. 5.6.6.1, need the page) and welds (Art. 5.14 → AWS, Q-B5); the §0.2 "2nd Ed." texts corrected.
7. **LTS-7** Foundation (need Section 13).
8. **LTS-8** Export of the LTS combinations to the Anchorage app.
9. **LTS-9** Report, Drawings, Manual.

Each PR follows the same rules:
- CLAUDE.md §4 callouts: before/after, or "before: not checked" for a new check.
- The provision cited as "AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions, Art. x", with the page.
- A hand check (HC-1 / HC-2 parts).
- A fixlog entry.
- The IBC-identical compare.
- Screenshots.

LTS-5 is the only PR whose provisions are already all confirmed. It could go first, after LTS-1, but LTS-1 itself needs Table 3.4-1. So nothing can start until the §7 pages arrive.

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


## 7. Pages still needed from the engineer's First Edition (2015) book

The 2017 packet replaces only the pages listed in §0.1. To implement Phase B, I need these pages of the **First Edition (2015)** (scans or photos are fine; they stay in the private reference repo, cited only):

| Priority | Section / articles | For | Blocks |
|---|---|---|---|
| 1 | **Art. 3.4 with Table 3.4-1** (limit states, load factors), 3.5–3.6 (dead and live load) | combinations | LTS-1, LTS-8 |
| 1 | **Art. 3.8–3.8.5** (wind pressure equation, basic wind speed and MRI / risk category / design life, wind maps, K_z, K_d), plus any skew or eccentricity rule for signs | wind | LTS-2 |
| 1 | **Art. 3.7 / 3.9** (ice load and wind on ice), wherever the 1st Ed. puts them | ice combinations | LTS-1/2 |
| 1 | **Section 5: Arts. 5.4–5.11.3.1.1** (materials, resistance factors 5.5, details 5.6 incl. **5.6.6.1 base plates** and 5.6.5 backing rings, width-thickness 5.7 with Table 5.7.3-1, flexure 5.8, tension 5.9, compression 5.10, shear 5.11.2, round torsion 5.11.3.1.1) — i.e. book pages 5-3 to 5-32 | member checks, base plate | LTS-3, LTS-6 |
| 1 | **Section 4** (analysis; the magnifier for non-prismatic members referenced by Art. 5.12.1) | tapered poles | LTS-3 |
| 2 | **Section 13** (foundations: drilled shafts, Broms, torsion, resistance factors) and **Section 15** (anchorage, referenced by Art. 5.1) | foundation | LTS-7 |
| 3 | **Section 2** (breakaway location guidelines referenced by Art. 12.1) | checklist | LTS-5 |
| 3 | Art. 11.6 Tables 11.6-1/11.6-2, the full Table 11.9.3.1-1 and Table 11.9.3.1-2 | only if fatigue is ever wanted (HMLT, mast arms) | none now |

Also helpful: the 2018 interim, if available, since FHWA lists it. The 2022 interim is the one that revised Section 5.

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
- AASHTO, *LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and Traffic Signals, 1st Ed., 2017 Interim Revisions* (LRFDLTS-1-I1), the replaced pages only (§0.1).
