# Light Pole and Sign Post: AASHTO LRFDLTS mode, plan (Phase A, revised A2)

Tool: `Light Pole and Sign Post.html`. Status: **plan only; nothing in this document is implemented yet.** Written 2026-11-02 (US Eastern), revised the same day (Phase A2: design basis corrected to the 1st Edition; owner amendments added, §6), for the engineer's request "Start the LTS mode for the sign and pole app".

**Decisions so far** (engineer, 2026-11-01 / 2026-11-02, via the coordinator):
- Add an **AASHTO LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and Traffic Signals (LRFDLTS), 1st Edition (2015) with interim revisions through 2022 (LRFDLTS-1-I5)** mode alongside the existing IBC 2021 / ASCE 7-22 / AISC 360-16 / ACI 318-19 mode.
- **Design basis (engineer, 2026-11-02, answering Q0):** LRFDLTS **1st Edition (2015) with the 2017, 2018, 2019, 2020 and 2022 interim revisions (LRFDLTS-1-I5)**. It is **not** a 2nd Edition. The engineer will upload the specification pages so every article and value can be confirmed. **Phase B does not start until they arrive.**
- The existing mode stays exactly as it is (same results for every saved project).
- Nothing cable-related changes. Cables stay in the IBC mode only; the LTS mode does not support them and says so on screen.
- The anchor rods are designed in the Anchorage app (BasePlateAnchorDesigner). The LTS mode exports its own LTS combinations through the existing `bridgeSuite.v1.anchorGroup` hand-off (HANDOFF.md §4.11, #610).
- The base plate uses the LTS bending-line method already in the tool (b_eff = πD/n at the pole face, flagged "verify", LP-5 / #561, LP-15 / #604).

**Rules for this work.** CLAUDE.md §4 (every formula, factor and reference called out with before/after, provision with edition, hand check), §5 (saved data), §6 (every value worked, with links), §7 (one tool per PR), §8 (fixlog). No LRFDLTS text is copied into the repo: this plan and the tool **cite** articles and **paraphrase**.

---

## 0. Design basis (read first)

**The design basis is LRFDLTS 1st Edition (2015) with interims through 2022 (LRFDLTS-1-I5)** (engineer, 2026-11-02). The first version of this plan was written against a "2nd Edition" that the engineer has now confirmed is not the basis. I had already noted that I could find no published 2nd Edition. Every reference in this plan now names the 1st Edition with interims. The public record agrees (2026-11-02):
- the **1st Edition (2015)**, item code LRFDLTS-1, with interim revisions 2017, 2018, 2019, 2020 and **2022 (LRFDLTS-1-I5)**. The 2022 interim revised Section 5 (steel), replaced Section 6 (aluminum), and revised Sections 14 and 15 and Appendix C (fatigue). Sources: the AASHTO Store listing of the 2022 interim revisions; the TRID record of LRFDLTS-1;
- **23 CFR 625.4** (FHWA's incorporation by reference) names "AASHTO LRFDLTS-1". Which interims FHWA has approved matters for RIDOT (§6.1, Q21);
- the calibration basis of the LRFD provisions is **NCHRP Report 796** (2014), *Development and Calibration of AASHTO LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and Traffic Signals* (public, National Academies Press).

**Article numbers and values are still unconfirmed.** Every article, table and equation number below is my recollection of the 1st Edition numbering, and the values are from memory unless a public source is named. They stay marked **"Memory — engineer must verify"** until checked against the pages the engineer uploads. Where the 2022 interim may have changed a Section 5 provision, the row says so. The code labels in the tool will be taken from the uploaded pages, not from this plan.

### 0.1 "2nd Ed." references in the repo (to change in Phase B, not now)

This PR is docs only. These on-screen texts and code comments still say "LRFDLTS 2nd Ed." They change to "LRFDLTS 1st Ed. (2015) with interims through 2022 (LRFDLTS-1-I5)" in the Phase B PR named against each. Each change is a display change with a fixlog entry. The fixlog entries already merged (LP0-1, LP5-1, LP15-1) are history and stay as written; the Phase B entry records the correction.

| File | Where (anchor) | Text now | Change in |
|---|---|---|---|
| `Light Pole and Sign Post.html` | masthead `id="lppScope"` (LP0-1), also printed on the report cover | "… AASHTO LRFDLTS 2nd Ed. highway supports are a separate mode (coming) …" | LTS-1 (mode switch; the scope line becomes mode-dependent) |
| `Light Pole and Sign Post.html` | `const LPP_BP_VERIFY=` (LP15-1; shown on the base-plate worked block, Summary warnings, Calc sheet and Report) | "VERIFY the base-plate method against AASHTO LRFDLTS 2nd Ed. — not yet verified: …" | **LTS-6** (base plate and welds), with the article confirmed from the uploaded pages |
| `Light Pole and Sign Post.html` | comment in `anchorBolts()` above the base-plate block: "This method is used in both modes until the AASHTO LRFDLTS 2nd Ed. mode is added." | code comment | LTS-6 |
| `Light Pole and Sign Post.html` | `basePlateWorkedHTML()`, the `eq-why` line about the double-nut base (shown on the base-plate worked block and in the Calc sheet) | "… This method is used in this mode (and in the AASHTO LRFDLTS 2nd Ed. mode until that mode is added). …" | LTS-6 |
| `BasePlateAnchorDesigner.html` | the circular base-plate step `ref:"AASHTO LRFDLTS 2nd Ed., base plates of double-nut connections …"` | worked-step reference | **Another tool**: its own one-tool PR (CLAUDE.md §7), after LTS-6 confirms the article. Listed here so it is not forgotten. |

Confidence column key:
- **Public**: confirmed from a public source named in the row.
- **Tool**: already in the tool and accepted by the engineer (fixlog reference given); the LTS article number is still to be confirmed.
- **Memory**: from memory. **The engineer must verify** the article, the form and the value.

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
| **High-mast lighting towers** (typically > 55 ft with a ring) | Out of scope for Phase B; the pole mode can model the geometry, but the fatigue rules (vortex shedding, natural wind gust on tall flexible poles) and the slip-joint/ring details need their own PR | Fatigue governs these; Phase B fatigue covers luminaire poles and signs only. |
| **Aluminum** poles (LTS Section 6), **prestressed concrete** poles (Section 8), **fiber-reinforced composite** (Section 9), **wood** (Section 7) | Out of scope | The tool designs steel tubes only. |
| **Breakaway** hardware (LTS Section 12) | Checklist only (no calculation) | Breakaway devices are crash-tested products; the tool can only flag the requirement. |
| **Cables / catenary spans** | **Not supported in the LTS mode** (engineer decision) | Shown on screen; the cable inputs are kept untouched in the saved state. |

### 1.3 What the tool's geometry can represent (and what it can't)

- **Can:** a vertical cantilever pole or post on a drilled shaft; tapered round tubes (linear taper); prismatic square/rect HSS; point masses and areas at heights (fixtures, arms as short members with projected area and weight); a flat sign panel with clearance; one or two posts; round or square shafts in one soil layer (IBC classes, or Broms cohesive/cohesionless for the reference check); a double-nut base plate (circle of n rods).
- **Can't (today):** multi-sided sections (added in Phase B); slip-fit or flange splices along the pole; a handhole (added as a detail input in Phase B for fatigue and the strength check); long arms as members; transformer bases; layered soil.

---

## 2. Provision map

One row per computed check or value. **Art.** = the LRFDLTS article / equation / table I believe governs (1st Ed. numbering unless stated). "Form" = what the tool will compute; symbols as in the tool. All forms are paraphrased; nothing is copied.

### 2.1 Design life, recurrence, wind speed

| # | Computed / value | Art. (believed) | Form to implement | Default | Confidence |
|---|---|---|---|---|---|
| W1 | Design life and risk category of the support | Art. 3.8 (Table 3.8-1, recommended minimum design life and MRI by risk category) | User selects risk category: Low / Typical / High. Design life shown (Typical: 50 yr). | Typical | Memory — engineer must verify |
| W2 | Basic wind speed V (3-second gust, mph) by mean recurrence interval | Art. 3.8.2; Figs. 3.8.2-1 to 3.8.2-3 (maps for MRI ≈ 300, 700, 1,700 yr, taken from the ASCE 7-10 maps) | **Input** V (map value for the selected risk category), with the MRI shown next to it. No map in the tool (map figures are not copied). Owner rules in §6 (CTDOT 120 mph statewide, Q22). | 130 mph (placeholder; the engineer gives the project's map value) | Memory — engineer must verify (map basis and figure numbers) |
| W3 | Service wind speed (for deflection) | Art. 3.8.2 / Section 10 (10-yr MRI map or V_service) | **Input** V_svc | from the map (placeholder 76 mph) | Memory — engineer must verify |
| W4 | Fatigue wind basis (yearly mean wind speed for natural wind gust) | Art. 11.7.1.2 | Not an input: the LTS fatigue pressures are given for a reference yearly mean speed (≈ 11.2 mph); an optional site yearly-mean speed V_mean scales the pressure by (V_mean/11.2)² | 11.2 mph (no scaling) | Memory — engineer must verify |

### 2.2 Wind pressure

| # | Computed / value | Art. (believed) | Form to implement | Default | Confidence |
|---|---|---|---|---|---|
| P1 | Design wind pressure | Art. 3.8.1, Eq. 3.8.1-1 | P_z = 0.00256 · K_z · K_d · G · V² · C_d (psf), on the projected area, per height strip (same strip integration as the IBC mode) | — | Memory — engineer must verify (form is consistent with NCHRP Report 796) |
| P2 | Height and exposure factor K_z | Art. 3.8.4, Eq. 3.8.4-1 / Table 3.8.4-1 | K_z = 2.01 (z/z_g)^(2/α), Exposure C α = 9.5, z_g = 900 ft (B and D if the edition allows), minimum height z_min ≈ 16 ft | Exposure C | Memory — engineer must verify (minimum height and whether B/D are permitted) |
| P3 | Directionality factor K_d | Art. 3.8.5, Table 3.8.5-1 | By structure type and shape: sign / luminaire / traffic-signal supports; round and multi-sided tubes | 0.85 signs; round/multi-sided tubes per table | Memory — engineer must verify (values) |
| P4 | Gust effect factor G | Art. 3.8.5 | G = 1.14 (constant; replaces the ASCE 7 G_f / n₁ calculation in this mode; n₁ still computed for fatigue/vortex screening) | 1.14 | Memory — engineer must verify |
| P5 | Importance / recurrence adjustment | — (LRFDLTS uses the MRI maps; no I_r factor) | No I_r factor: the recurrence is in V (W2). The 6th Ed. (ASD) I_r factor is **not** used. | — | Memory — engineer must verify |
| P6 | C_d round tubes | Art. 3.8.6, Table 3.8.6-1 | C_d as a function of the Reynolds-number parameter C_v·V·d (mph·ft): ≈ 1.10 below the lower limit, a power-law transition, ≈ 0.45–0.5 above the upper limit (exact limits and expression from the table) | from table | Memory — engineer must verify |
| P7 | C_d multi-sided tubes (8, 12, 16 sides) | Table 3.8.6-1 | As P6 with the shape's own limits/values (octagonal much less Reynolds-sensitive, ≈ 1.2–1.4 range) | from table | Memory — engineer must verify |
| P8 | C_d square/rect members | Table 3.8.6-1 | constant (≈ 1.7–2.0 by corner radius / aspect) | from table | Memory — engineer must verify |
| P9 | C_d sign panels | Table 3.8.6-1 | By aspect ratio L/W of the panel (≈ 1.12 for ≤ 2 rising to ≈ 1.2 and larger for long panels; ≈ 1.19 typical) | from table | Memory — engineer must verify |
| P10 | Luminaires | Table 3.8.6-1 and manufacturer EPA | Force = P_z(z_f)/C_d · EPA when the manufacturer's EPA includes drag (as the IBC mode's fixture C_f input); otherwise the LTS luminaire C_d × projected area. Input "EPA basis". | manufacturer EPA (C_d included) | Memory — engineer must verify |
| P11 | Wind on ice | Art. 3.9 (ice) / Table 3.4.1-1 | wind pressure on the iced projected area at the edition's concurrent wind speed (see I1) | — | Memory — engineer must verify |
| P12 | Wind directions examined | LRFDLTS Art. 3.8 (wind from any horizontal direction) and the tool's present 4-azimuth envelope (LP-1 warning for off-axis arms) | Same 4 azimuths as the IBC mode (0/90/180/270°), plus the normal and 45° cases where the edition requires a skewed wind on signs | 4 azimuths | Memory (the skew rule) — engineer must verify |

### 2.3 Ice, dead and live loads

| # | Computed / value | Art. (believed) | Form to implement | Default | Confidence |
|---|---|---|---|---|---|
| I1 | Ice load | Art. 3.7 | Option A (believed LRFDLTS rule): 3 psf on all faces of members and one face of sign panels (and luminaires). Option B: defer to ASCE 7-22 Ch. 10 (t_d(z), already in the tool, LP-6) with a note. The engineer chooses (Q5). | per Q5 | Memory — engineer must verify |
| I2 | Dead load DC | Art. 3.6 | Self-weight of the pole/post (tapered, steel 490 pcf, as now), arms, fixtures, sign panel and attachments | as IBC mode | Memory (article) — engineer must verify |
| I3 | Live load LL | Art. 3.6 / Table 3.4.1-1 | Applies only to walkways / maintenance platforms (sign bridges), which are out of scope. LL = 0 in this tool; shown as "not applicable". | 0 | Memory — engineer must verify |

### 2.4 Load combinations and factors

| # | Limit state | Art. (believed) | Form to implement | Confidence |
|---|---|---|---|---|
| C1 | Strength I | Table 3.4.1-1 | γ_DC,max·DC + 1.6·LL, γ_DC,max ≈ 1.25 (min 0.9). With LL = 0 this is a gravity-only check. | Memory — engineer must verify |
| C2 | Extreme I (wind) | Table 3.4.1-1 | γ_DC·DC + 1.0·W with γ_DC = 1.1 (max) and 0.9 (min) | Memory — engineer must verify |
| C3 | Extreme I (wind and ice) | Table 3.4.1-1 | γ_DC·DC + 1.0·IC + 1.0·W_ice (wind on ice at the edition's concurrent wind speed / pressure fraction) | Memory — engineer must verify |
| C4 | Service I | Table 3.4.1-1 / Section 10 | 1.0·DC + 1.0·W_svc (service wind V_svc) — deflection only | Memory — engineer must verify |
| C5 | Fatigue I | Table 3.4.1-1 / Section 11 | 1.0 × the fatigue load effect (stress range); not combined with DC | Memory — engineer must verify |
| C6 | Second-order effects | Art. 4.8 (approximate second-order analysis / moment magnification) | Strength and Extreme: M_u = B₂·M₁ (the tool's present B₂ = 1/(1 − ΣP/P_e,story) from the Rayleigh drift), or the LTS amplification form if the edition gives a different one (Q8) | Memory — engineer must verify |

### 2.5 Member design: round and multi-sided tapered tubes (Section 5, steel)

The 2022 interim revised Section 5 substantially; values below are 1st Ed. recollection.

| # | Check | Art. (believed) | Form to implement | Confidence |
|---|---|---|---|---|
| M1 | Resistance factors | Art. 5.5 (Table) | φ_f = 0.90 flexure, φ_v = 0.90 shear and torsion, φ_c = 0.90 compression, φ_t = 0.90 yield / 0.75 fracture | Memory — engineer must verify |
| M2 | Width-thickness classes, round | Art. 5.7.2 (Table 5.7.2-1) | λ = D/t vs λ_p ≈ 0.07E/F_y, λ_r ≈ 0.31E/F_y; slender above (limit ≈ 0.45E/F_y?) | Memory — engineer must verify |
| M3 | Width-thickness classes, multi-sided | Table 5.7.2-1 | flat width b/t (b = flat between bend lines, with the bend radius rule) vs λ_p, λ_r (≈ 1.12√(E/F_y) / ≈ 1.40√(E/F_y) style limits, by number of sides) | Memory — engineer must verify |
| M4 | Flexure M_n, round | Art. 5.10 (round tubes) | compact: M_n = M_p = F_y·Z; noncompact: AISC-like F8 form; slender: local-buckling stress | Memory — engineer must verify |
| M5 | Flexure M_n, multi-sided | Art. 5.10 (multi-sided tubes) | compact: M_p; noncompact/slender: F_n·S with the edition's linear reduction in b/t; properties of the polygon (exact flats + corners) | Memory — engineer must verify |
| M6 | Shear V_n | Art. 5.11 | V_n = F_cr·A/2 (round), F_n·A_w (multi-sided) | Memory — engineer must verify |
| M7 | Torsion T_n | Art. 5.11 | T_n = F_cr·C (round, AISC H3-1-like) | Memory — engineer must verify |
| M8 | Axial P_n | Art. 5.9 | E3-like column curve with K·L of a free-standing pole (K = 2.1 or the edition's value) and Q for slender | Memory — engineer must verify |
| M9 | Combined forces | Art. 5.12, Eq. 5.12.2-1 (believed) | P_u/φP_n + (M_u/φM_n + V_u/φV_n + T_u/φT_n)² ≤ 1.0 for round and multi-sided tubes (form recalled; the 2022 interim may have changed it) | Memory — engineer must verify |
| M10 | Check sections | — | Base (and the base-plate weld toe), the handhole, every 1 ft along the taper, as the IBC mode | Tool |

### 2.6 Connections and welds

| # | Check | Art. (believed) | Form to implement | Confidence |
|---|---|---|---|---|
| J1 | Base-plate thickness, double-nut | Art. 5.6.6 (1st Ed.; to confirm against the 2022 interim, which revised Section 5) | **Unchanged from the tool (LP-5):** t_req = √(4·P_rod·m / (φ_f·F_y·b_eff)), m = (BC − D)/2, b_eff = πD/n at the pole face, P_rod = max(tension, compression rod force), "VERIFY" box kept | Tool (fixlog LP5-1 / LP15-1); article and b_eff rule to verify |
| J2 | Minimum base-plate thickness | Art. 5.6.6 / Section 11 (fatigue detail notes) | t_bp ≥ the edition's minimum (believed: ≥ rod diameter for double-nut; a larger minimum for fatigue-sensitive pole-to-plate details, e.g. ≥ 2 in for some full-penetration details on high-mast poles) | Memory — engineer must verify |
| J3 | Pole-to-base-plate weld, socket (fillet) | Art. 5.14 (welded connections) | Fillet weld strength around the tube: φ_w·0.6F_EXX·0.707w per inch vs the resultant shear flow from M, V, T | Memory — engineer must verify |
| J4 | Pole-to-base-plate weld, CJP with backing ring | Art. 5.14 | CJP = base metal; no strength check beyond the tube; fatigue governs (F-rows) | Memory — engineer must verify |
| J5 | Handhole | Art. 5.6.? (openings) and Section 11 detail | Net section at the handhole (reinforced frame) for strength; detail category for fatigue (F5) | Memory — engineer must verify |
| J6 | Anchor rods | Art. 5.17 (anchor bolts) | **Not checked here.** Rod forces exported to the Anchorage app (X1). Anchor-rod fatigue (F7) stays here, because the Anchorage app has no fatigue check (Q16b). | Engineer decision (#610/#616) |

### 2.7 Fatigue (Section 11)

| # | Item | Art. (believed) | Form to implement | Confidence |
|---|---|---|---|---|
| F1 | Applicability by structure type | Art. 11.1 / 11.4 / Table 11.5-1 (1st Ed. with interims; Appendix C revised in 2022) | Luminaire poles: natural wind gust and vortex-shedding screening (round tubes with little taper); truck gust only for members over traffic (N/A here); monopost/two-post ground signs: generally **not required** for small roadside signs (owner may require). The tool states which loads apply and why. | Memory — engineer must verify |
| F2 | Fatigue importance category (Q14) | Art. 11.6 (Table 11.6-1) | Category I / II / III → fatigue importance factor I_F per load type (check whether the interims changed it) | Memory — engineer must verify |
| F3 | Galloping | Art. 11.7.1.1 | P_G ≈ 21·I_F psf vertical on the projected horizontal area of arms/signs/signals on cantilever arms. **N/A for the Phase B structures** (no cantilever mast arms); shown as N/A. | Memory — engineer must verify |
| F4 | Vortex shedding | Art. 11.7.1.? | Critical speed V_c = f_n·d/S_n (S_n ≈ 0.18 round, ≈ 0.15 multi-sided), P_VS = 0.00118·V_c²·C_d·I_F/(2β) with damping β; required for round/low-taper poles when V_c is in the range given | Memory — engineer must verify (whether the 1st Ed. with interims still requires it, and the form) |
| F5 | Natural wind gust | Art. 11.7.1.2 | P_NW ≈ 5.2·C_d·I_F psf (× (V_mean/11.2)² if the site mean is entered), applied horizontally on all exposed areas, any direction | Memory — engineer must verify |
| F6 | Truck-induced gust | Art. 11.7.1.3 | P_TG ≈ 18.8·C_d·I_F psf vertical, on members/attachments over the traffic lane, 65 mph trucks, reduced with height above 20 ft. **Applies to structures over traffic** (mast arms, overhead) → **N/A** for poles and roadside signs (shown with the reason) | Memory — engineer must verify |
| F7 | Detail categories | Table 11.9.3.1-1 (believed) | User picks the pole-to-plate detail (socket fillet / CJP with backing ring / stiffened), handhole detail, anchor rod (snug / pretensioned, double-nut); the tool assigns the category from the edition's table (no table text copied: only "Detail x.y → Category Z" pairs the engineer confirms) | Memory — engineer must verify (numbers and categories) |
| F8 | Constant-amplitude fatigue threshold (CAFT) | Table 11.9.3.1-? (CAFT by category) | Δf (nominal stress range from the fatigue pressure, with the stress concentration factor K_F/K_I where the edition gives one for the detail) ≤ (ΔF)_TH | CAFT values from memory: A 24, B 16, B′ 12, C 10, C′ 12, D 7, E 4.5, E′ 2.6, ET 1.2 ksi — Memory — engineer must verify |
| F9 | Stress range at the detail | Art. 11.9.2 / 11.9.3 | Δf = M_F·c/I (+ axial) at the weld toe section; for anchor rods Δf = (M_F·y/Σy²)/A_se | Memory — engineer must verify |
| F10 | Infinite-life vs finite-life | Art. 11.9.3 | Infinite life (Δf ≤ CAFT) only; finite life not offered (Q13) | Memory — engineer must verify |

### 2.8 Deflection / serviceability (Section 10)

| # | Check | Art. (believed) | Form to implement | Confidence |
|---|---|---|---|---|
| D1 | Luminaire support horizontal deflection | Art. 10.4.2.? | Δ_top (Service I) ≤ the edition's limit (believed: a fraction of the height, ≈ 0.15H in older editions; confirm the 1st Ed. value) | Memory — engineer must verify |
| D2 | Sign support deflection | Art. 10.4.2.? | Δ_top or rotation limit for ground-mounted sign supports, if any | Memory — engineer must verify |
| D3 | Camera / owner limits | owner | optional user limit (in or % of H) | engineer |
| D4 | Deflection calculation | Art. 10.4 / 4.8 | the tool's tapered-pole deflection (`poleDeflection`, Rayleigh drift) under Service I, at the top and at each fixture, with second-order amplification | Tool (method); article to verify |

### 2.9 Breakaway (Section 12)

| # | Item | Art. (believed) | Form | Confidence |
|---|---|---|---|---|
| B1 | Breakaway requirement and hardware | Section 12 (crash-tested per MASH / NCHRP 350; mass and stub-height limits) | **Checklist only:** "In the clear zone?" → note that breakaway hardware must be crash-tested and used per its approval (mass, height, stub height); no calculation | Memory — engineer must verify |

### 2.10 Foundations (Section 13)

| # | Check | Art. (believed) | Form to implement | Confidence |
|---|---|---|---|---|
| G1 | Drilled-shaft embedment, lateral | Art. 13.6.1, C13.6.1.1 (Broms) | **Broms becomes the design method** in the LTS mode (cohesive: 9c_u·b, cohesionless: 3K_p·γ·b·z), using the factored Extreme I M and V, with the soil resistance factor of Q19. The existing Broms code and worked block are reused (already in the tool as a reference check). The IBC §1807.3 method is not used in this mode. | Tool (Broms forms); the design-method status, φ and load factors — Memory, engineer must verify |
| G2 | Drilled-shaft torsion (signs) | Art. 13.6.1.? / C13.6.1 | Torsional resistance from side friction: T_r = φ·f_s·πb·d·(b/2) (+ base, if the edition allows), vs T_u (Case B eccentricity) | Memory — engineer must verify (open item N2 in the IBC mode) |
| G3 | Load factors on soil | Art. 13.6 / 3.4 | Factored Extreme I effects (no separate geotechnical combination), with φ from Q19 | Memory — engineer must verify |
| G4 | Shaft structural design | Art. 13.6.2 → AASHTO LRFD BDS Section 5 | **Kept on ACI 318-19** (the tool's P–M, shear, torsion threshold) with the LTS factored loads, unless the engineer wants AASHTO LRFD BDS Section 5 (Q19) | Engineer decision needed |
| G5 | Minimum embedment / geometry | Art. 13.6 | any edition minimum (e.g. shaft depth, cover) | Memory — engineer must verify |

### 2.11 Export to the Anchorage app

| # | Item | Basis | Form | Confidence |
|---|---|---|---|---|
| X1 | `bridgeSuite.v1.anchorGroup` payload in the LTS mode | HANDOFF.md §4.11 (#610) | Same schema, same `signConvention:'lightPole-v1'`, `basis:{factored:true, method:'LRFD', combos:'AASHTO LRFDLTS <ed.> Table 3.4.1-1: Strength I, Extreme I, Extreme I with ice', B2:'…'}`; combos = every LTS Strength/Extreme combination at 0/90/180/270°, M = B₂·M. Fatigue and Service combinations **not** sent (the Anchorage app does not do fatigue). `inputsHash` covers the mode, so switching modes marks the returned D/C "STALE". No receiver change needed (it validates `factored` and `LRFD` only). | Tool (schema) |

---

## 3. Inputs, saved data, UI, report, tests

### 3.1 Inputs

**Reused unchanged:** pole height, shape, top/base OD and wall, F_y, density; fixtures table (height, θ, a, EPA, weight, arm OD); sign B, s, clearance, weight, post spacing; shaft shape and size, f′c, f_y, cover, rebar; Broms soil inputs; anchor rods (sent to the Anchorage app); base plate D, F_y, t.

**New (LTS mode only; ids prefixed `lts`):**

| Id | Input | Default |
|---|---|---|
| `ltsEd` | Edition label (display only, not an input) | "AASHTO LRFDLTS 1st Ed. (2015) with interims through 2022 (LRFDLTS-1-I5)" |
| `ltsOwner` | Owner: none / RIDOT / MassDOT / CTDOT (applies §6 rules: notes, defaults, checklist items) | none |
| `ltsRisk` | Risk category: Low / Typical / High | Typical |
| `ltsV` | Basic wind speed V for that MRI (mph) | 130 (placeholder, engineer to set) |
| `ltsVsvc` | Service wind speed (mph) | 76 (placeholder) |
| `ltsExpo` | Exposure (C; B/D if allowed) | C |
| `ltsKdMode` | K_d: table / override | table |
| `ltsIceMode` | Ice: LTS 3 psf rule / ASCE 7-22 Ch. 10 | per Q5 |
| `ltsEpaBasis` | Luminaire EPA basis: manufacturer (C_d incl.) / projected × C_d | manufacturer |
| `ltsSides` | Multi-sided: 8 / 12 / 16 (with shape "Multi-sided" added to `poleShape` **in LTS mode only**) | 16 |
| `ltsBendR` | Bend radius (multi-sided), in | 4t |
| `ltsFatCat` | Fatigue importance category I / II / III | II (per Q14) |
| `ltsFatOn` | Fatigue: per Table (auto) / off (owner waiver) | auto |
| `ltsVmean` | Site yearly mean wind (mph), optional | 11.2 |
| `ltsBeta` | Damping ratio for vortex shedding | 0.005 |
| `ltsBaseDet` | Pole-to-plate detail: socket fillet / CJP with backing ring | socket fillet |
| `ltsWeldW` | Socket fillet size, in | 5/16 |
| `ltsFexx` | Weld F_EXX, ksi | 70 |
| `ltsHH` | Handhole: none / reinforced; height above base, size | reinforced, 1.5 ft, 4 × 6.5 in |
| `ltsDefLim` | Deflection limit (code / user value) | code |
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
- **Inputs:** card 1 (wind) shows the LTS wind inputs instead of the ASCE ones; the ice card follows Q5; the cable card is replaced by the "not supported" note; new cards "Fatigue (LTS Section 11)" and "Base weld & handhole"; the soil card makes Broms the design method (IBC soil class hidden).
- **Output tabs:** same tabs. Loading (LTS P_z worked per component, combinations table of Table 3.4.1-1); Post (Section 5 checks, combined-force equation); new **Fatigue** tab; Anchorage (export of LTS combos); Shaft (Broms design + torsion + ACI structural); Summary (LTS verdict list, with breakaway checklist and deflection); Report / Calc sheet / Drawings (mode-dependent labels and notes).
- §6 links: every quoted value links to its worked block (in-app) and "see §x.y" in print, as now.

### 3.4 Report and drawings

- The Report (shared/report.js) gets an LTS section set: Design criteria (edition, risk category, MRI, V, V_svc, fatigue category), Loads (P_z per component), Combinations, Member, Base plate & weld, Fatigue, Deflection, Foundation (Broms), Anchorage (pointer to the app), Breakaway checklist, Assumptions (incl. "cables not supported", "anchor rods designed in the Anchorage app", every "verify" flag still open).
- Drawings: general notes switch to the LTS references; the pole elevation adds the handhole and the base weld detail callout; no new sheets.

### 3.5 Test plan

- `tests/engine/lightpole.test.mjs` gains an LTS block per Phase B PR (the harness `tests/engine/lp-source.mjs` already loads the page's functions).
- Every PR: `node tests/check-syntax.mjs`; `node tests/engine/run.mjs lightpole`; `node tests/lightpole-compare.mjs --a origin/main` and `--old-saves` (**IBC mode identical**, cable values identical); `tests/smoke/lightpole-anchor-handoff.mjs`; one page-load smoke check (0 console errors) and screenshots at 1280 / 390 px.
- **Hand-check cases** (computed by hand in Phase B, after the engineer's answers fix the coefficients; inputs fixed now):

**HC-1 Luminaire pole.** 40 ft round tapered steel pole, base OD 8.0 in, top OD 4.5 in (taper 0.0875 in/ft), wall 0.1793 in (7 ga), F_y 55 ksi; one 8 ft davit arm at 38 ft, OD 2.375 in; one luminaire at the arm tip, EPA 1.2 ft² (manufacturer, drag included), 55 lb; Risk Typical, V 130 mph, Exposure C, V_svc 76 mph; socket-fillet base weld 5/16 in E70; handhole reinforced at 1.5 ft; base plate D 15 in, t 1.25 in, F_y 36, 4 × 1 in rods on BC 13 in; round shaft 30 in, cohesionless φ = 30°, γ = 115 pcf; fatigue category II. Hand values to produce: K_z at 5 ft strips and at 38 ft; C_d (round, C_v·V·d) at base and top; P_z; base V, M, T; B₂; λ and class at the base; φM_n, φV_n, φT_n, φP_n; combined ratio; t_req; weld stress; P_NW and Δf at the weld toe and the handhole vs CAFT; vortex-shedding V_c and stress; Δ_top (Service I) vs limit; Broms embedment; export combo 1 values.

**HC-2 Monopost sign.** Panel 8 ft wide × 5 ft high, clearance 7 ft (top at 12 ft), panel 4 psf; round post 6.625 × 0.280 in (A500 Gr C, F_y 50; t_des per Q11), one post; Risk Typical, V 130 mph; base plate D 14 in, t 1.25 in, 4 × 1 in rods on BC 11 in; round shaft 30 in, cohesive c_u = 1,000 psf. Hand values: C_d (sign aspect 1.6), P_z at the panel centroid, F, torsion from the eccentric case, M, V, T at the base; post checks; t_req; Broms embedment and shaft torsion; Fatigue applicability (expected: not required → stated).

---

## 4. Questions for the engineer (from his copy of LRFDLTS)

**Edition**
- **Q0. Answered (2026-11-02):** LRFDLTS 1st Edition (2015) with interims through 2022 (LRFDLTS-1-I5). The engineer will upload the specification pages. Owner amendments: from the owner manuals already in the reference library (§6; questions Q21–Q25).

**Wind**
- **Q1.** Risk categories and MRIs (Table 3.8-1?): the categories, their MRIs and the design life. Which map figure gives V for each, and is V the ASCE 7-10 map value or the ASCE 7-16/7-22 one?
- **Q2.** Wind-pressure equation (Eq. 3.8.1-1?): confirm P_z = 0.00256·K_z·K_d·G·V²·C_d, and G = 1.14 (any exceptions, e.g. flexible / high-mast).
- **Q3.** K_z: the equation or table number, the minimum height, and whether Exposures B and D are permitted.
- **Q4.** K_d values (Table 3.8.5-1?) for: luminaire supports, ground-mounted sign supports, round tubes, multi-sided tubes.
- **Q6.** C_d (Table 3.8.6-1?): the round-tube expression and its C_v·V·d limits; 8-, 12- and 16-sided values; sign panels by aspect ratio; luminaires (if no EPA). Is the manufacturer EPA used with C_d = 1 (drag included)?
- **Q7.** Signs: does the edition require an eccentric (torsion) wind case or a skewed wind direction on ground-mounted signs? If so, the eccentricity and angle.

**Ice and combinations**
- **Q5.** Ice: is it the 3 psf rule (Art. 3.7?) on all members and one face of signs, or does the edition refer to ASCE 7 Ch. 10? The wind-on-ice speed or pressure fraction.
- **Q8.** Table 3.4.1-1: the γ_DC (max/min) for Strength I and Extreme I, the ice and wind factors, Service I and Fatigue I. Second-order effects: Art. 4.8 form (B₂-type amplification or another), and is it applied to Extreme I only?

**Members (Section 5, after the 2022 interim)**
- **Q9.** Resistance factors φ (flexure, shear, torsion, compression, tension, weld) and their article.
- **Q10.** Width-thickness limits (Table 5.7.2-1?) for round and 8/12/16-sided tubes (and the flat-width definition with the bend radius); the M_n equations by class; V_n, T_n, P_n (K for a free-standing pole); and the combined-force equation (is it P/φP + (M/φM + V/φV + T/φT)² ≤ 1?).
- **Q11.** A500 posts: use t_des = 0.93 t_nom in this mode?

**Connections**
- **Q12a.** Base plate: the article for double-nut base plates, the effective-width rule at the bending line (is πD/n right, or a chord / 45° spread?), and the minimum plate thickness.
- **Q12b.** Base weld: socket fillet and CJP-with-backing-ring strength article; minimum socket weld size rules.
- **Q12c.** Handhole: strength check article (net section with frame) and its detail category.

**Fatigue (Section 11)**
- **Q13.** Applicability: which fatigue loads apply to (a) roadway luminaire poles with davit arms (what height limit?), (b) ground-mounted monopost and two-post signs? Infinite-life design only?
- **Q14.** Fatigue importance categories / factors (Table 11.6-1?) — still in the edition? Default category for your owners.
- **Q15.** The pressures: natural wind gust (≈ 5.2·C_d·I_F psf?), truck gust (≈ 18.8·C_d·I_F psf?), galloping (≈ 21·I_F?), vortex shedding form and Strouhal numbers — and whether vortex shedding is still required for round poles.
- **Q16a.** Detail table: the detail numbers and categories (and K_F stress concentration factors if any) for: socket-fillet pole-to-plate, CJP with backing ring, reinforced handhole, anchor rods (double-nut, pretensioned). CAFT for each category (my values: A 24, B 16, B′ 12, C 10, C′ 12, D 7, E 4.5, E′ 2.6, ET 1.2 ksi).
- **Q16b.** Anchor-rod fatigue stays in this tool (the Anchorage app has no fatigue check) — OK?

**Deflection, breakaway, foundation**
- **Q17.** Section 10 limits: luminaire pole top deflection (Service I) and any sign-support limit.
- **Q18.** Breakaway: is a checklist note enough (no calculation)?
- **Q19.** Foundation: Broms as the design method in this mode — with which soil resistance factor φ and which load combination (Extreme I factored)? Torsion of sign shafts: the method and φ. Shaft structural design: keep ACI 318-19, or AASHTO LRFD BDS Section 5 (which edition)?

**Scope**
- **Q20.** OK to add multi-sided (8/12/16) sections in the LTS mode only, and to leave mast arms, cantilever sign structures and high-mast towers for a later series?

**Owner amendments (§6)**
- **Q21. RIDOT** BDM §1.1.1 makes the latest FHWA-approved version govern on NHS projects (23 CFR 625.3(f)(2) / 625.4(d)). Does FHWA's current list include the 2022 interim (LRFDLTS-1-I5)? If it does not, should RIDOT NHS projects use only the interims FHWA lists, or the 2022 interim under a Project Exception?
- **Q22. CTDOT** BDM §14.1.3, §14.2.2.2 and §14.2.2.3 set **120 mph** for sign supports. That text cites the ASD *Standard Specifications*, and BRSDM C3.8.1.2.5CT says one wind speed is specified statewide for new sign structures. Is 120 mph the LRFDLTS basic wind speed V (the LTS map value for the risk category's MRI) for CTDOT ground-mounted signs and light poles, or an old Standard-Specifications speed that does not apply? Where is the current CTDOT statewide value given (a traffic standard or directive I don't have)?
- **Q23. MassDOT** Bridge Manual §3.12.3.2 and §3.12.3.3 (sign attachments to bridges) call for "the latest version, including current interims" and the LTS basic wind speed figure. Do you apply that to ground-mounted signs and light poles too? (§6.3.5.1 makes the Contractor design them unless they are pre-approved.)
- **Q24.** Do RIDOT, MassDOT or CTDOT set a **fatigue importance category**, a deflection limit, standard light-pole or sign foundations, or anchor-rod or base-plate rules for ground-mounted supports in documents other than these four manuals (traffic or lighting standard drawings, standard specifications, special provisions)? The four manuals I searched have none (§6.4).
- **Q25.** Should the tool get an "Owner" selector (none / RIDOT / MassDOT / CTDOT) that shows the owner's rules as notes and checklist items and sets defaults (e.g. the CTDOT wind speed after Q22)? Owner text would be cited, never copied.

---

## 5. Phase B PR sequence (after the answers)

0. **Before LTS-1:** the engineer's specification pages arrive; this plan's provision map is updated (articles, values, Confidence → "Confirmed from the engineer's copy") in a docs PR.
1. **LTS-1** Mode switch (`codeMode`), LTS inputs, loads (DC, LL = 0) and Table 3.4.1-1 combinations; cables hidden with the note. IBC mode identical.
2. **LTS-2** Wind (P_z, K_z, K_d, G, C_d per shape, EPA basis) and ice.
3. **LTS-3** Member checks (round + multi-sided; Section 5), second-order.
4. **LTS-4** Fatigue (Section 11) incl. anchor-rod fatigue (per Q16b).
5. **LTS-5** Deflection (Section 10) and the breakaway checklist.
6. **LTS-6** Base plate (LP-5 method; `LPP_BP_VERIFY` and the other §0.1 base-plate texts corrected to the 1st Ed. with the 2022 interim; minimum t) and welds / handhole.
7. **LTS-7** Foundation (Broms design, torsion, φ; shaft structural).
8. **LTS-8** Export of the LTS combinations to the Anchorage app.
9. **LTS-9** Report, Calc sheet, Drawings, Manual.

Each PR: §4 callouts (before/after; for new checks "before: not checked"), the provision with the edition (LRFDLTS 1st Ed. 2015 with interims through 2022) and the article confirmed from the uploaded pages, a hand check (HC-1 / HC-2 parts), the fixlog entry, the IBC-identical compare, screenshots.

---

## 6. Owner amendments (RIDOT, MassDOT, CTDOT)

**Source.** The owner manuals in the engineer's reference library, searched 2026-11-02 for sign supports, luminaires and light poles, traffic-signal structures, LRFDLTS, wind speed, fatigue importance category, standard poles and foundations, drilled shafts, base plates and anchor rods. They are cited by section only; no owner text is copied:
- **RIDOT** *Bridge Design Manual*, April 2026 (`Bridge Design Manual-2026.pdf`);
- **MassDOT** *Bridge Manual, Part I*, Hundredth Anniversary Edition (`MassDOT Bridge Manual - Hundredth Edition.pdf`);
- **CTDOT** *Bridge Design Manual*, 2024 revision (`CTDOT Bridge Design Manual 0224 (1).pdf`), and *Bridge and Roadway Structures Design Manual (BRSDM)*, Release 1 (`ctdot_brsdm_r1 (1).pdf`). The BRSDM replaces the BDM; where they differ, the BRSDM governs (Q22).

**Finding in short.** All three owners adopt LRFDLTS for highway sign, luminaire and traffic-signal supports. **None of the four manuals amends an LTS design provision** for ground-mounted poles or signs: there is no fatigue importance category, no deflection limit, no standard pole or foundation, and no base-plate or anchor-rod design rule. The owner rules found are a wind speed (CTDOT), the code version that governs (RIDOT, MassDOT), materials and galvanizing, a ban on adhesive anchors (CTDOT), who designs the support (MassDOT), and borings. The bridge-mounted sign-support rules (truss frames on fascias) are outside this tool's scope and are listed only for completeness.

### 6.1 RIDOT Bridge Design Manual (April 2026)

| Section | What it requires (paraphrased) | How the tool would apply it |
|---|---|---|
| §1.1.1 | The manual supplements AASHTO. On NHS projects, the latest version of each document approved by FHWA (23 CFR 625.3(f)(2), 625.4(d)) governs; a version FHWA has not yet approved needs a Project Exception. Deviations need a RIDOT waiver. | Report note in LTS mode with Owner = RIDOT: "edition per the FHWA-approved list; confirm the 2022 interim is approved or covered by a Project Exception" (Q21). No calculation change. |
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

These may be in the owners' traffic or lighting standard drawings, standard specifications or special provisions, which are not in the library (Q24). Until the engineer answers, the LTS mode uses the LRFDLTS defaults and asks for the fatigue category (§2.7 F2).

### 6.5 What this adds to Phase B

- **LTS-1:** the optional `ltsOwner` field (default "none"; saved; old saves open as none). It drives notes and checklist items only. The one possible default is the CTDOT V after Q22.
- **LTS-6:** CTDOT AWS D1.1 note on the base weld.
- **LTS-7:** MassDOT borings note; RIDOT galvanized-reinforcement note.
- **LTS-9:** the owner notes in the Report, Calc sheet and Drawings general notes, each citing the manual section.
- **Anchorage app (separate PR, its own tool):** CTDOT adhesive-anchor prohibition note for sign, signal and luminaire foundations.


## Sources (public)

- AASHTO Store, *LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and Traffic Signals, 1st Edition, 2022 Interim Revisions* (item LRFDLTS-1-I5): https://store.transportation.org/Item/PublicationDetail?ID=4738
- TRID record, LRFDLTS (1st Ed.): https://trid.trb.org/view/1366480
- 23 CFR 625.4 (FHWA standards incorporated by reference): https://www.ecfr.gov/current/title-23/chapter-I/subchapter-G/part-625/section-625.4
- NCHRP Report 796 (2014), *Development and Calibration of AASHTO LRFD Specifications for Structural Supports for Highway Signs, Luminaires, and Traffic Signals*: https://nap.nationalacademies.org/catalog/22240

## Owner manuals (engineer's reference library; cited by section, not copied)

- RIDOT, *Bridge Design Manual*, April 2026.
- MassDOT, *Bridge Manual, Part I*, Hundredth Anniversary Edition.
- CTDOT, *Bridge Design Manual* (2024 revision), and *Bridge and Roadway Structures Design Manual (BRSDM)*, Release 1.
