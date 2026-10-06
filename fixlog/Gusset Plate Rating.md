# Fix log — Gusset Plate Rating.html

Governing basis: AASHTO MBE 3rd Ed. (with interims) Art. 6A.6.12.6 and AASHTO LRFD 10th Ed. (2024) Art. 6.13 and 6.14.2.8, with NCHRP Web-Only Document 197, for LRFR; AASHTO MBE 3rd Ed. Section 6B with FHWA-IF-09-014 (and AASHTO Standard Specifications 17th Ed. Art. 10.54, 10.56) for LFR.

**The reference documents were not available when this tool was written.** Every code coefficient is an editable parameter (Code parameters tab), each with its default, article reference and a "verify" badge. The values flagged "least certain" are listed under "Needs verification" below. The engineer must confirm all of them before using results.

## 2026-10-05 — PR: claude/gusset-phase1 (PR link added after merge)

### C1. New tool: Gusset Plate Rating (Phase 1: engine, 2D drawing, calc sheet)   [new tool]

- **Type:** new file `Gusset Plate Rating.html` (single file, no build step). CDN: MathJax 3.2.2 (pinned, `cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js`; already used by Steel Bridge Beam Modules), Google Fonts Barlow (as GirderDetail). No other libraries. three.js is not used yet (3D is Phase 2).
- **Look and feel:** CSS, header, binder-tab module bar, sidebar input tabs, status bar, cards, "where" tables, badges and the calculation-sheet report/print CSS are copied from `Steel Bridge Beam Modules.html` (GirderDetail) and stay duplicated (CLAUDE.md §3). The "where" table has an added source column.
- **Storage (new keys only):** `gussetRating.autosave.v1` (`{data, name}`), `gussetRating.projects.v1` (map name → project). Export/import JSON: `{ _schema:"gusset-rating-project", version:1, app:"Gusset Plate Rating", savedAt, data }`; import refuses another `_schema` or a newer version.
- **Hand-off:** the "← All tools" link, the BridgeXfer v1 helper (verbatim from HANDOFF.md §5) and "Use / Share project info" on channel `bridgeSuite.v1.projectMeta` (all eight fields mapped, see HANDOFF.md §4.1). No other channel.
- **Other copies:** the BridgeXfer v1 helper is duplicated verbatim in every tool that uses it; this file adds one more copy. The project-info glue is the same as in the other tools except `TOOL`/`FILE` and the field map.

#### Method as implemented (units kip, in, ksi; member forces tension +, unfactored, whole joint)

- **Geometry.** Origin at the work point (WP), +x along the chord, +y up. Plate = polygon of (x, y) vertices. Member i: work line at angle θ (from +x, CCW), unit vector u = (cos θ, sin θ), v = (−sin θ, cos θ). Fastener rows at s = e + k·p (k = 0 … n_r − 1; e = WP to the row nearest the WP); gage lines at t = cumulative gages centred on the work line + transverse offset. Hole d_h = d + 1/16 (standard) or per LRFD Table 6.13.2.4.2-1 (oversize). Net width per hole d_h + 1/16 (= d + 1/8, LRFD 6.8.3).
- **Whitmore section** (each web member): W = g_s + 2L tan 30°, with g_s = spread of the outer gage lines and L = (n_r − 1)p, placed perpendicular to the member at the row nearest the WP, centred on the fastener group; clipped at the plate polygon (the part inside the plate that contains the centre). Not clipped at adjacent members; a warning is given when it crosses another member's outline. Net width W_n = W_g − Σ(d_h + 1/16) over every hole (any member) whose centre is within d_h/2 of the section. Overridable.
- **L_mid:** average of L1, L2, L3 measured from the two ends and the middle of the clipped Whitmore section, parallel to the member toward the WP, to the nearest fastener-field outline of another member (a continuous chord's two fields count as one) or the plate edge (NCHRP W-197 / MBE 6A.6.12.6.8 as implemented). Overridable.
- **Block shear** (tension only): tension plane across the row nearest the WP between the outer gage lines (L_tg = g_s, L_tn = g_s − (n_ℓ − 1)(d_h + 1/16)); two shear planes along the outer gage lines from that row to the plate edge in the member direction (L_vg = L_v1 + L_v2 from the polygon, L_vn = L_vg − 2(n_r − 0.5)(d_h + 1/16)). Single-line patterns: N/A. Overridable.
- **Partial shear planes:** automatic planes through the top and bottom lines of chord fasteners (loaded side above / below), plus user planes through two points (loaded side: away from the WP, or left/right). L_g = total length of the line inside the polygon; L_n = L_g − Σ(d_h + 1/16) for holes on the line. Demand V = Σ F_i (u_i · e) over members whose fastener centroid is on the loaded side. Overridable.
- **Continuous chord:** the two chord members' fasteners together carry ΔF = Σ F_i (u_i · u_right) (fastener shear and bearing); long-joint length = overall length of the chord field. No Whitmore/block shear for the chord. "Spliced" mode checks each chord member like a web member (splice plates ignored, warning).
- **Summing plates:** plate resistances are computed per plate with its own thickness after section loss (uniform per plate) and added. Fastener shear planes N = (fasteners per plate) × N_p for single shear on each face, or × 2 when fasteners pass through both plates (`Ns = 2`).
- **Resistances (LRFR):** fastener shear φ_s N F_v A_b R_L R_F (rivets) or φ_s N (0.56 or 0.45) A_b F_ub R_L R_F (bolts); bearing φ_bb Σ_plates Σ_holes min(2.4 d t F_u, 1.2 L_c t F_u), L_c in the direction the fastener pushes on the plate (tension: away from the WP; compression: toward it), to the next hole of the same group or to the plate edge; Whitmore yield φ_y F_y W_g Σt; fracture φ_u F_u U min(W_n Σt, 0.85 W_g Σt); block shear φ_bs R_p (0.58 F_u A_vn + U_bs F_u A_tn) ≤ φ_bs R_p (0.58 F_y A_vg + U_bs F_u A_tn); buckling φ_c P_n with LRFD 6.9.4.1.1 (P_e = π²E A_g/(K L_mid/r)², r = t/√12, K = 0.5); shear yield φ_vy 0.58 F_y A_g Ω (Ω = 0.88); shear fracture φ_vu 0.58 F_u A_vn.
- **Resistances (LFR):** same geometry; fastener φF_v from Std. Spec. Table 10.56A; bearing min(1.8 d t F_u, 0.9 L_c t F_u) (φ included); compression φ_c A_s F_cr with Std. Spec. 10.54.1.1 column curve, K = 1.2; shear yield Ω = 0.74; other φ as LRFR. All flagged.
- **Rating:** LRFR RF = (φ_cφ_s C − γ_DC DC − γ_DW DW)/(γ_LL (LL+IM)), φ_cφ_s ≥ 0.85; LFR RF = (C − A1 D)/(A2 L(1+I)). Each live load column is rated where its sign matches the limit state (tension-only: WY, WF, BS; compression-only: WB; both: FS, BR, planes, chord). Dead load opposite to the live load uses γ_DC,min = 0.90, γ_DW,min = 0.65 (LRFR) or A1,min = 1.0 (LFR). Design columns → Inventory/Operating; legal/permit → column γ_LL (LRFR) or A2 operating (LFR).
- **Inputs:** project block; plates (number, t, steel presets incl. MBE Table 6A.6.2.1-1 unknown steels, F_y, F_u, loss per plate as thickness or %); polygon table with preview; members (any number; label, role, θ, section type and widths for the drawing, fastener type/grade/d/threads/hole size/hole making, rows × lines, pitch, gage list, WP-to-inner-row, offset, shear planes, filler); live load columns; forces typed, pasted from a spreadsheet (column mapping + preview) or pasted from a MIDAS truss force table (Elem/Load/Part/Axial; element → member and load case → DC/DW/LL mapping, summed, scale factor, preview).
- **Default model:** 5-member Warren-with-verticals lower-chord panel point L2: continuous chord L1-L2 / L2-L3 (4 lines × 6 rows, 4 in gage/pitch), diagonals at 130° and 50° (4 lines × 6 rows, 3.5 in gage, 3 in pitch, inner row 26 in from the WP), vertical at 90° (2 lines × 5 rows); 7/8 in rivets, pre-1936/unknown; two 1/2 in A36 plates.

#### Code parameters (defaults)

| Key | Method | Parameter | Default | Unit | Reference | Flag |
|---|---|---|---|---|---|---|
| `E` | Both | Modulus of elasticity of steel | 29000 | ksi | LRFD 10th Ed. 6.4.1 | verify |
| `thW` | Both | Whitmore spread angle, each side | 30 | deg | LRFD 10th Ed. 6.14.2.8 (C6.14.2.8); MBE 3rd Ed. 6A.6.12.6.7, 6A.6.12.6.8 | verify |
| `hStd` | Both | Standard hole: hole diameter minus fastener diameter | 0.0625 | in | LRFD 10th Ed. Table 6.13.2.4.2-1 | verify |
| `hOv78` | Both | Oversize hole allowance, d ≤ 7/8 in | 0.1875 | in | LRFD 10th Ed. Table 6.13.2.4.2-1 | verify |
| `hOv1` | Both | Oversize hole allowance, d = 1 in | 0.25 | in | LRFD 10th Ed. Table 6.13.2.4.2-1 | verify |
| `hOvL` | Both | Oversize hole allowance, d ≥ 1 1/8 in | 0.3125 | in | LRFD 10th Ed. Table 6.13.2.4.2-1 | verify |
| `dNet` | Both | Added to the hole diameter for net width (net width per hole = d_h + Δ) | 0.0625 | in | LRFD 10th Ed. 6.8.3 | verify |
| `fillT` | Both | Filler thickness at and above which the filler reduction applies | 0.25 | in | LRFD 10th Ed. 6.13.6.1.5 | verify |
| `fillRv` | Both | Apply the filler reduction to rivets (1 = yes, 0 = no) | 1 |  | LRFD 10th Ed. 6.13.6.1.5 (written for bolts) | verify — **least certain** |
| `U` | Both | Shear-lag factor on the Whitmore net section | 1 |  | LRFD 10th Ed. 6.13.5.2, 6.14.2.8; MBE 6A.6.12.6.7 | verify |
| `capAn` | Both | Upper limit on A_n/A_g for the Whitmore net section (connection element) | 0.85 |  | LRFD 10th Ed. 6.13.5.2 | verify — **least certain** |
| `Ubs` | Both | Block shear tension-stress factor | 1 |  | LRFD 10th Ed. 6.13.4 | verify |
| `RpD` | Both | Hole reduction factor, drilled or subpunched and reamed holes | 1 |  | LRFD 10th Ed. 6.13.4 | verify |
| `RpP` | Both | Hole reduction factor, holes punched full size | 0.9 |  | LRFD 10th Ed. 6.13.4 | verify |
| `phiSr` | LRFR | Rivets in shear | 0.8 |  | MBE 3rd Ed. 6A.6.12.6.2 | verify — **least certain** |
| `phiSb` | LRFR | High-strength bolts in shear | 0.8 |  | LRFD 10th Ed. 6.5.4.2 | verify |
| `phiBB` | LRFR | Bearing of fasteners on the gusset plate | 0.8 |  | LRFD 10th Ed. 6.5.4.2 | verify |
| `phiY` | LRFR | Tension yielding, Whitmore gross section | 0.95 |  | LRFD 10th Ed. 6.5.4.2 | verify |
| `phiU` | LRFR | Tension fracture, Whitmore net section | 0.8 |  | LRFD 10th Ed. 6.5.4.2 | verify |
| `phiBS` | LRFR | Block shear rupture | 0.8 |  | LRFD 10th Ed. 6.5.4.2 | verify |
| `phiC` | LRFR | Compression, Whitmore section | 0.9 |  | LRFD 10th Ed. 6.5.4.2 | verify |
| `phiVY` | LRFR | Shear yielding, gross plane | 1 |  | LRFD 10th Ed. 6.5.4.2; MBE 6A.6.12.6.6 | verify — **least certain** |
| `phiVU` | LRFR | Shear fracture, net plane | 0.8 |  | LRFD 10th Ed. 6.5.4.2; MBE 6A.6.12.6.6 | verify |
| `FvR0` | LRFR | Rivet nominal shear strength: built before 1936 or of unknown origin | 23 | ksi | MBE 3rd Ed. 6A.6.12.5.1, Table 6A.6.12.5.1-1 | verify — **least certain** |
| `FvR1` | LRFR | Rivet nominal shear strength: ASTM A502 Grade 1 | 29 | ksi | MBE 3rd Ed. Table 6A.6.12.5.1-1 | verify — **least certain** |
| `FvR2` | LRFR | Rivet nominal shear strength: ASTM A502 Grade 2 | 35 | ksi | MBE 3rd Ed. Table 6A.6.12.5.1-1 | verify — **least certain** |
| `cBx` | LRFR | Bolt shear coefficient, threads excluded (R_n = c A_b F_ub N_s) | 0.56 |  | LRFD 10th Ed. Eq. 6.13.2.7-1 | verify |
| `cBi` | LRFR | Bolt shear coefficient, threads included | 0.45 |  | LRFD 10th Ed. Eq. 6.13.2.7-2 | verify |
| `Fu325` | LRFR | Bolt tensile strength, F3125 Grade A325 | 120 | ksi | LRFD 10th Ed. 6.4.3.1 | verify |
| `Fu490` | LRFR | Bolt tensile strength, F3125 Grade A490 | 150 | ksi | LRFD 10th Ed. 6.4.3.1 | verify |
| `LjB` | LRFR | Bolts: connection length above which the long-joint factor applies | 38 | in | LRFD 10th Ed. 6.13.2.7 | verify |
| `RjB` | LRFR | Bolts: long-joint reduction factor | 0.83 |  | LRFD 10th Ed. 6.13.2.7 | verify |
| `LjR` | LRFR | Rivets: connection length above which the long-joint factor applies | 50 | in | MBE 3rd Ed. 6A.6.12.5.1 | verify — **least certain** |
| `RjR` | LRFR | Rivets: long-joint reduction factor | 0.8 |  | MBE 3rd Ed. 6A.6.12.5.1 | verify — **least certain** |
| `brA` | LRFR | Bearing coefficient on d t F_u | 2.4 |  | LRFD 10th Ed. Eq. 6.13.2.9-1 | verify |
| `brB` | LRFR | Bearing coefficient on L_c t F_u | 1.2 |  | LRFD 10th Ed. Eq. 6.13.2.9-2 | verify |
| `K` | LRFR | Effective length factor, Whitmore compression | 0.5 |  | LRFD 10th Ed. 6.14.2.8; MBE 3rd Ed. 6A.6.12.6.8; NCHRP W-197 | verify |
| `Om` | LRFR | Shear reduction factor, partial shear planes | 0.88 |  | MBE 3rd Ed. 6A.6.12.6.6; LRFD 10th Ed. 6.14.2.8; NCHRP W-197 | verify |
| `gDC` | LRFR | Dead load DC | 1.25 |  | MBE 3rd Ed. Table 6A.4.2.2-1 | verify |
| `gDW` | LRFR | Dead load DW | 1.5 |  | MBE 3rd Ed. Table 6A.4.2.2-1 | verify |
| `gDCmin` | LRFR | DC when it counteracts the live load effect | 0.9 |  | LRFD 10th Ed. Table 3.4.1-2 | verify — **least certain** |
| `gDWmin` | LRFR | DW when it counteracts the live load effect | 0.65 |  | LRFD 10th Ed. Table 3.4.1-2 | verify — **least certain** |
| `gInv` | LRFR | Live load, design load inventory | 1.75 |  | MBE 3rd Ed. Table 6A.4.2.2-1 | verify |
| `gOp` | LRFR | Live load, design load operating | 1.35 |  | MBE 3rd Ed. Table 6A.4.2.2-1 | verify |
| `phiCSmin` | LRFR | Lower limit on the product of condition and system factors | 0.85 |  | MBE 3rd Ed. Eq. 6A.4.2.1-3 | verify |
| `FvR0L` | LFR | Rivet design shear strength: built before 1936 or of unknown origin | 30 | ksi | FHWA-IF-09-014; AASHTO Std. Spec. 17th Ed. Table 10.56A | verify — **least certain** |
| `FvR1L` | LFR | Rivet design shear strength: ASTM A502 Grade 1 | 30 | ksi | AASHTO Std. Spec. 17th Ed. Table 10.56A | verify — **least certain** |
| `FvR2L` | LFR | Rivet design shear strength: ASTM A502 Grade 2 | 38 | ksi | AASHTO Std. Spec. 17th Ed. Table 10.56A | verify — **least certain** |
| `Fv325L` | LFR | Bolt design shear strength: A325, threads excluded | 46 | ksi | AASHTO Std. Spec. 17th Ed. Table 10.56A | verify — **least certain** |
| `Fv490L` | LFR | Bolt design shear strength: A490, threads excluded | 57 | ksi | AASHTO Std. Spec. 17th Ed. Table 10.56A | verify — **least certain** |
| `thrL` | LFR | Bolts with threads in the shear plane: factor on φF_v | 0.8 |  | AASHTO Std. Spec. 17th Ed. 10.56.1.3.2 | verify — **least certain** |
| `LjL` | LFR | Connection length above which the long-joint factor applies (rivets and bolts) | 50 | in | FHWA-IF-09-014 | verify — **least certain** |
| `RjL` | LFR | Long-joint reduction factor (rivets and bolts) | 0.8 |  | FHWA-IF-09-014 | verify — **least certain** |
| `brAL` | LFR | Bearing coefficient on d t F_u (φ included) | 1.8 |  | AASHTO Std. Spec. 17th Ed. 10.56.1.3.2 | verify — **least certain** |
| `brBL` | LFR | Bearing coefficient on L_c t F_u (φ included) | 0.9 |  | AASHTO Std. Spec. 17th Ed. 10.56.1.3.2 | verify — **least certain** |
| `phiYL` | LFR | Tension yielding, Whitmore gross section | 0.95 |  | FHWA-IF-09-014 | verify — **least certain** |
| `phiUL` | LFR | Tension fracture, Whitmore net section | 0.8 |  | FHWA-IF-09-014 | verify — **least certain** |
| `phiBSL` | LFR | Block shear rupture | 0.8 |  | FHWA-IF-09-014 | verify — **least certain** |
| `phiCL` | LFR | Compression (P_u = φ_c A_s F_cr) | 0.85 |  | AASHTO Std. Spec. 17th Ed. 10.54.1.1; FHWA-IF-09-014 | verify |
| `KL` | LFR | Effective length factor, Whitmore compression | 1.2 |  | FHWA-IF-09-014 | verify — **least certain** |
| `phiVYL` | LFR | Shear yielding, gross plane | 1 |  | FHWA-IF-09-014 | verify — **least certain** |
| `OmL` | LFR | Shear reduction factor, partial shear planes | 0.74 |  | FHWA-IF-09-014 | verify |
| `phiVUL` | LFR | Shear fracture, net plane | 0.8 |  | FHWA-IF-09-014 | verify — **least certain** |
| `A1` | LFR | Dead load factor | 1.3 |  | MBE 3rd Ed. 6B.4.3 | verify |
| `A2i` | LFR | Live load factor, inventory | 2.17 |  | MBE 3rd Ed. 6B.4.3 | verify |
| `A2o` | LFR | Live load factor, operating (also legal and permit loads) | 1.3 |  | MBE 3rd Ed. 6B.4.3 | verify |
| `A1min` | LFR | Dead load factor when dead load counteracts the live load effect | 1 |  | Judgment (not given in MBE 6B) | verify — **least certain** |

#### Needs verification (least certain defaults)

- **Rivet shear strengths, LRFR** (MBE Table 6A.6.12.5.1-1 as recalled): F_v = 23 ksi (before 1936 or unknown origin), 29 ksi (A502 Gr. 1), 35 ksi (A502 Gr. 2). The table, its row labels and any grip-length or long-joint adjustments must be checked. Rivet φ_s = 0.80.
- **Rivet long-joint reduction, LRFR:** 0.80 above 50 in (not certain the MBE applies one to rivets).
- **All LFR fastener values:** rivets φF_v = 30 ksi (unknown origin, taken equal to A502 Gr. 1), 30 (Gr. 1), 38 (Gr. 2); bolts 46 (A325), 57 (A490), × 0.80 with threads included; long-joint 0.80 above 50 in; bearing 1.8 d t F_u / 0.9 L_c t F_u.
- **LFR plate resistance factors** (φ_y 0.95, φ_u 0.80, φ_bs 0.80, φ_vy 1.00, φ_vu 0.80) and **LFR K = 1.2** for Whitmore buckling (FHWA-IF-09-014 as recalled). LFR Ω = 0.74 (FHWA) vs LRFR Ω = 0.88 (MBE/NCHRP W-197) are kept separate as the brief requires.
- **φ_vy = 1.00** for LRFR gross shear yielding of the partial plane.
- **A_n ≤ 0.85 A_g** applied to the Whitmore net section (LRFD 6.13.5.2); it governs the validation case. Since C4 (2026-10-05) a switch, code parameter `capAnOn` (default 1 = applied; 0 = A_n = W_n Σt); the ratio `capAn` remains.
- **Filler reduction applied to rivets** (LRFD 6.13.6.1.5 is written for bolts); γ is taken as t_filler / t_plate (thinnest gusset plate), an approximation of A_f/A_p.
- **Counteracting dead load factors:** γ_DC,min 0.90, γ_DW,min 0.65 (LRFR) and A1,min 1.0 (LFR) are judgment.
- **Condition and system factors** default 1.0; MBE Table 6A.4.2.4-1 lists φ_s = 0.90 for riveted members in truss bridges. Confirm what the owner applies to gusset plates.
- **Article numbers** of MBE 6A.6.12.6.x and LRFD 6.14.2.8.x sub-articles are cited as recalled.
- **Unknown-steel presets** (MBE Table 6A.6.2.1-1): before 1905 26/52, 1905–1936 30/60, 1936–1963 33/66, after 1963 36/66 ksi.

#### Confirmed

Moved here from "Needs verification" (engineer-confirmed 2026-10-05, see C4.4):

- **Whitmore section:** 30° spread from the first fastener row (the row farthest from the WP) to the row nearest the WP (code parameter `thW` now shows "engineer-confirmed 2026-10-05").
- **L_mid:** average of three lengths to the nearest fastener line of another member or the plate edge.
- **Block shear:** tension only (rectangular block).
- **Partial shear planes:** automatic planes through the top and bottom lines of chord fasteners (through the holes).
- **L_mid at a clipped Whitmore end** (C6.1 rule: closed plate outline; along the plate edge where the plate does not continue toward the WP): engineer-confirmed 2026-10-05 (see C7; closes O14).
- **L_mid along a plate edge stops at the other member's fastener field** (O18): engineer's decision 2026-10-05, implemented in C7. A field counts even when another field lies between it and the edge (engineer's decision 2026-10-05: rule kept; the tool warns in that case, C8).

#### Validation (hand checks)

Validation model (`GPR.validationModel()`, also on the Validation tab): one diagonal D at θ = 45°, 2 lines × 4 rows of 7/8 in A502 Gr. 1 rivets, gage 5 in, pitch 3 in, inner row 20 in from the WP (rows at s = 20, 23, 26, 29 in), drilled standard holes d_h = 15/16 in, net width per hole 1.000 in; two 1/2 in A36 plates (F_y 36, F_u 58 ksi); plate end edge perpendicular to the diagonal at s = 30.5 in; plate side edges at t = ±8.485 in; continuous two-line chord with holes at y = 0 and y = −5 in, x = ±1.5 … ±16.5 in; rectangular plate part x = ±20 in, y = ±8 in. Forces on D: DC = +40, DW = +6, HL-93 = +60 (LRFR), HS20 = +50 (LFR), HL-93 reversal = −40 kip. Default code parameters.

| Quantity | Hand calculation | Hand | Tool |
|---|---|---|---|
| A_b | π(0.875)²/4 | 0.6013 in² | 0.6013 |
| Fastener shear, LRFR | 0.80 × (8 × 2 = 16 planes) × 29 × 0.6013 × 1.0 × 1.0 | 223.21 kip | 223.21 |
| Fastener shear, LFR | 16 × 30 × 0.6013 | 288.63 kip | 288.63 |
| Bearing per hole | 2.4(0.875)(0.5)(58) = 60.90; end row (tension): L_c = 1.5 − 0.46875 = 1.03125 → 1.2(1.03125)(0.5)(58) = 35.89; interior L_c = 3 − 0.9375 = 2.0625 → 71.78 > 60.90 | | |
| Bearing, LRFR, tension | 0.80 × 2 plates × 2 lines × (3 × 60.90 + 35.89) | 699.48 kip | 699.48 |
| Bearing, LRFR, compression | 0.80 × 2 × 8 × 60.90 (L_c to the WP side is large) | 779.52 kip | 779.52 |
| Whitmore W_g | 5 + 2(3 × 3) tan 30° = 5 + 10.392 (not clipped) | 15.392 in | 15.392 |
| Whitmore W_n | 15.392 − 2 × 1.000 | 13.392 in | 13.392 |
| Whitmore yield, LRFR | 0.95 × 36 × 15.392 × (2 × 0.5) | 526.42 kip | 526.42 |
| Whitmore fracture, LRFR | A_n = min(13.392, 0.85 × 15.392 = 13.083) = 13.083 in²; 0.80 × 58 × 13.083 × 1.0 | 607.07 kip | 607.07 |
| Block shear, per plate | A_vg = 2(10.5)(0.5) = 10.5; A_vn = (21 − 2 × 3.5 × 1.0)(0.5) = 7.0; A_tn = (5 − 1.0)(0.5) = 2.0; 0.58(58)(7.0) + 58(2.0) = 351.48; cap 0.58(36)(10.5) + 116 = 335.24 | 335.24 kip | |
| Block shear, LRFR | 0.80 × 2 × 335.24 | 536.38 kip | 536.38 |
| L1, L2, L3 | Whitmore ends at y = 14.142 ∓ 5.442 = 8.700, 19.584; middle y = 14.142; distance to the chord top line y = 0 along the 45° line = y√2: 12.304, 20.000, 27.696 | | |
| L_mid | (12.304 + 20.000 + 27.696)/3 | 20.000 in | 20.000 |
| Buckling, LRFR | r = 0.5/√12 = 0.14434; KL/r = 0.5(20)/0.14434 = 69.28; A_g = 7.696 in²/plate; P_e/P_o = π²(29000)/69.28² / 36 = 1.6564 ≥ 0.44; P_n = 0.658^(1/1.6564)(36)(7.696) = 215.20/plate; 0.90 × 2 × 215.20 | 387.35 kip | 387.36 |
| Buckling, LFR | KL/r = 1.2(20)/0.14434 = 166.28 > C_c = √(2π²E/F_y) = 126.10; F_cr = π²E/(KL/r)² = 10.352 ksi; 0.85 × 2 × 7.696 × 10.352 | 135.44 kip | 135.44 |
| Shear plane (top chord line, y = 0) | L_g = 40.0 in; 12 chord holes → L_n = 40 − 12(1.0) = 28.0 in | | |
| Shear yield, LRFR | 1.00 × 0.58 × 36 × 40 × (2 × 0.5) × 0.88 | 734.98 kip | 734.98 |
| Shear fracture, LRFR | 0.80 × 0.58 × 58 × 28 × 1.0 | 753.54 kip | 753.54 |
| Plane demand, DC | members above y = 0: D only; 40 cos 45° | 28.284 kip | 28.284 |
| RF, LRFR Inventory (D-FS, governs) | (1.00 × 223.21 − 1.25 × 40 − 1.50 × 6)/(1.75 × 60) = 164.21/105 | 1.564 | 1.564 |
| RF, LFR Inventory (D-FS, governs) | (288.63 − 1.3 × 46)/(2.17 × 50) = 228.83/108.5 | 2.109 | 2.109 |
| RF, LRFR Inventory, reversal (D-WB) | LL = −40 (compression), dead load counteracts: (387.36 + 0.90 × 40 + 0.65 × 6)/(1.75 × 40) | 6.10 | 6.10 |

Hand values were computed independently with a short node script of the formulas above (not the tool engine); the Validation tab runs the engine on the same model and compares 17 quantities (all match within 0.05 %).

**Default 5-member model results** (default parameters): LRFR Inventory HL-93 RF = 1.17 (L2-U1/L2-U3 rivet shear), LRFR Operating 1.52; LFR Inventory HS20 1.40 (L2-U1 Whitmore buckling, K = 1.2), LFR Operating 2.34. Shear plane above the chord: LRFR Inventory 1.76.

- **How verified:**
  - `node --check` on every inline script of the file (5 blocks): no failures.
  - Engine run in node on the default and validation models; 17 validation quantities match the independent hand calculation.
  - jsdom load (CDN scripts not fetched): every main tab (Summary, Drawing, Checks, Rating, Code parameters, Validation, Report, Method) and every input tab renders with no runtime error; editing t = 7/16 in and Ω = 0.80 recomputes and autosaves under `gussetRating.autosave.v1`; add member / LL column / plane / vertex; spreadsheet paste (tab with header, unknown member reported, applied); MIDAS paste (Elem/Load/Part/Axial, J-end duplicates dropped, DC1 + DC2 summed into DC); Share project info → `bridgeSuite.v1.projectMeta`, then Use shared project info in a second window fills the fields through the input handler and reaches the autosave; Export JSON; Print report builds the calc sheet. The only jsdom message is its CSS parser not understanding the `@page` margin boxes (same code as GirderDetail; browsers accept it).
  - Parser unit tests in node: tab/comma/quoted CSV with thousands separators, header detection, row-order matching, non-numeric cells, MIDAS header detection and error, project export/import round trip (identical RFs), wrong `_schema` / newer version refused, invalid inputs reported.
  - Chromium (Playwright) with MathJax 3.2.2 served locally: all 172 equations on the Checks tab and the report typeset with no MathJax errors; screenshots reviewed.
- **Open items (Phase 2/3):**
  - O1. Chord splice check and combined shear/axial/moment on a plane (NCHRP W-197); spliced chord currently checked through the gusset only.
  - O2. Whitmore clipping at adjacent members (warning only now).
  - O3. Free-edge slenderness / edge buckling; localized section loss along specific planes (loss is uniform per plate now).
  - O4. Eccentric fastener groups; unequal force sharing between plates of different thickness.
  - O5. 3D view (three.js r128) — Phase 2. (Done: see C2 below.)
  - O6. Live load concurrency: shear-plane and chord ΔF demands treat the entered member LL forces as concurrent; envelope forces from different truck positions should be entered as separate columns. (Answered 2026-10-05: kept, note added; see C4.2.)
  - O7. MIDAS import supports the long table format (Elem, Load, Part, Axial); direct .mct/result-file import is not implemented.
  - O8. All items under "Needs verification".

## 2026-10-05 — PR: claude/gusset-phase2 (PR link added after merge)

### C2. 3D view of the connection (Phase 2)   [new feature; no calculation changes]

- **Type:** display only. New "3D" tab (after Drawing) and an optional "3D view (snapshot)" section in the Report (off by default). **No engineering formula, load factor, resistance factor, parameter default, unit or code reference was changed.** The engine `<script>` (`const GPR = (function () {` … `})();`) is byte-for-byte identical to Phase 1.
- **Library:** three.js **r128**, pinned: `https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js` and `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`. Loaded lazily (script tags added only when the 3D tab or the report snapshot needs them; 20 s timeout). If the CDN is unreachable the 3D tab shows "The 3D view could not be loaded … All other tabs work without it." with a "Try again" button; if WebGL is unavailable it says so. All other tabs work without three.js.
- **Storage (new key only):** `gussetRating.view3d.v1` = `{ layers: {plates, members, fasteners, fillers, work, whitmore, planes, lmid, labels, dc}, transp, opacity, stub, rpt }` (3D view options and the report-snapshot checkbox; per browser, not per project). `gussetRating.autosave.v1`, `gussetRating.projects.v1` and the project export/import JSON are unchanged (no new fields in the project data). The 3D tab's "D/C for" selector writes the existing `ui.dcCase` field, the same one as the Rating input tab. `ui.otab` may now hold `'3d'` (an older copy of the tool shows an empty panel for that value until another tab is clicked).
- **What is drawn** (inches; origin at the WP, +x along the chord, +y up in the plate plane, z out of plane), all from the model and the engine geometry (`R.G`, `R.poly`, `R.ts`, `R.planes`):
  - Gusset plates: the plate polygon extruded by each plate's thickness after section loss (`R.ts`). Inner faces at z = ±max(d2/2 + filler) over the members; plate 1 on +z, plate 2 on −z, extra plates stacked outward alternately; one plate: +z only. Transparent toggle and opacity slider.
  - Members: a stub from the member end (`cut`) to the last fastener row + stub length (view option, default 12 in, minimum 1.5 in), built from the section type and its two widths: box/channel pair = two channels with webs on the plates and flanges turned in (a cover plate on the upper side if the description contains "cover"; lacing lines if it contains "lac"); built-up H/I and rolled W = flanges on the plates, web at the work line; angle/double angle = one angle per face. Missing widths: plain box sized from the outer gage lines plus edge distance (and the widest entered member out of plane), with a note. Continuous chord: the two chord stubs meet at the WP; spliced chord: 1/4 in gap at the WP, with a note. Element thicknesses, flange widths and fastener head/nut/washer sizes are nominal drawing sizes (stated under the view).
  - Fasteners at every hole (`g.holes`): one shear plane per plate → plate(s) + member element on each face; two planes → through the whole member. Rivets: shank + button heads both ends; bolts: shank + hex head + washer + hex nut.
  - Fillers (`fast.tf` > 0) between the member face and the plate(s), over the fastener field.
  - Overlays (toggles), on the +z face just above the fastener heads: work lines + WP, Whitmore section (`W.A`–`W.B`) with the 30° spread lines, L1/L2/L3 arrows, partial shear planes (also as translucent bands through the plate stack), labels (member, live-load force of the selected case with T/C, DC, DW, governing D/C and check id; plate label; SP labels).
  - Colour by D/C for the rating case selected (same scale and colours `DCOL`/`dcCls` as the 2D drawing): members = all their checks (continuous chord: CH-FS, CH-BR); plates = Whitmore, block shear, shear planes; fastener groups = fastener shear and bearing. Legend under the view and in the PNG.
- **Controls:** orbit/pan/zoom (OrbitControls), Front / Top / Side / Iso / Fit, layer chips, transparent plates + opacity, member stub length, D/C case, Screenshot (PNG; labels and legend drawn into the image; `preserveDrawingBuffer: true`). The scene is rebuilt (geometries and materials disposed) only when the model changes **and** the 3D tab is shown (or a report snapshot is needed); rendering is on demand (no animation loop); ResizeObserver handles resizing.
- **Edits to existing code (UI script; anchors for re-applying by hand):**
  - CSS: block `/* 3D view (Phase 2) */` appended before `</style>` after `@media print { .gdwg { … } }`.
  - Header pill: `…6B (LFR), Phase 1</span>` → `…6B (LFR), Phase 2</span>`; report front page `Prepared with Gusset Plate Rating (Phase 1).` → `(Phase 2).`
  - Tab bar: after `data-tab="drawing">Drawing</button>` added `<button type="button" class="tab-btn" data-tab="3d">3D</button>`; panels: after `<div class="tab-panel" id="tab-drawing"></div>` added `<div class="tab-panel" id="tab-3d"></div>`.
  - New `<script>` defining `const GP3D = (function () { … })();` inserted immediately before the UI script (`Gusset Plate Rating: user interface`).
  - `recompute()`: `… DIRTY.add(t)); crMarkStale();` → `… DIRTY.add(t)); crMarkStale(); GP3D.markDirty();`
  - `renderTab(t)`: `report: renderReportTab }[t]; if (!f) return;` / `if (t === 'report') { f(); return; }` → `report: renderReportTab, '3d': GP3D.render }[t]; if (!f) return;` / `if (t === 'report' || t === '3d') { f(); return; }`
  - `renderErrors()`: `DIRTY.clear(); drawPreview(); }` → `DIRTY.clear(); GP3D.showErrors(); drawPreview(); }`
  - `SCOPE_OUT`: removed the last item `'3D view (Phase 2)'`.
  - `crOpts()`: `o.detail = r.detail || 'full'; return o; }` → `o.detail = r.detail || 'full'; o.view3d = GP3D.reportOn(); return o; }`
  - `buildReport(o)`: before `if (o.validation) {` added `if (o.view3d) body += GP3D.reportSection(H1);`
  - `renderReportTab()`: `${CR_OPTS.map(chip).join('')}</div>` → `${CR_OPTS.map(chip).join('')}${GP3D.reportChip()}</div>`
- **Governing provision:** none (display only).
- **Check case:** results unchanged. Default 5-member model: LRFR Inventory HL-93 RF = 1.172 (L2-U1-FS), Operating 1.519; LFR Inventory HS20 1.403 (L2-U1-WB), Operating 2.342 — before and after. Validation model: LRFR Inv 1.564 / Op 2.027, LFR Inv 2.109 / Op 3.521, reversal LRFR Inv 3.759 / Op 4.872 (all D-FS) — before and after; Validation tab 17 of 17 match.
- **How verified:**
  - `node --check` on every inline script (6 blocks): pass.
  - Engine in node (engine script extracted from the file) on the default and validation models, before and after: every check's capacity (both methods, both directions), every RF of every case, the governing RF per case, the warnings and the Whitmore/L_mid/block-shear geometry written to JSON and compared — identical (`cmp`). The engine script block is byte-identical.
  - jsdom with every external resource refused (THREE undefined): all 9 tabs render; the 3D tab shows the fallback message and "Try again" with no runtime error; layer chips, view buttons, Screenshot and Try again do nothing harmful; the 3D "D/C for" select updates `ui.dcCase` and the Rating-tab select; an input error shows on the 3D tab and clears when fixed; Report: the 3D chip is present and off by default; switching it on adds a "3D view" section that says the snapshot is unavailable; Print builds; autosave keys and `ui`/`ui.rpt` fields unchanged; only new key `gussetRating.view3d.v1`; reload with the 3D tab saved as current works.
  - Chromium (Playwright, three.js r128 and OrbitControls served locally by routing the two CDN URLs): default 5-member model (Iso, Front, Top, Side, opaque plates), validation model (Iso, Front), and a variant (spliced chord, 3 plates with loss on one, A325 bolts with two shear planes, A490 bolts with a 1 in filler, W, L and missing-dimension sections). Screenshots reviewed: members on their work lines on the correct side, fasteners at the hole positions of the 2D drawing, plates on both faces of the members, Whitmore/L_mid/shear-plane overlays in the same places as the 2D drawing. PNG download and the report snapshot (1500 × 950 image) work; no page errors.
- **Other copies:** none (the new code is only in this file).
- **Open items:**
  - O5 (3D view) closed by this entry.
  - O9. The 3D member stubs use nominal element thicknesses and flange widths because Phase 1 stores only the two outer widths and a description of each section. If true section dimensions are wanted in the 3D view, section fields would have to be added to the project data (a format change needing a migration) — not done.
  - O10. Members narrower than the clear space between the plates and without a filler are drawn with the gap (noted under the view); the tool does not check fit-up.

## 2026-10-05 — PR: claude/gusset-phase3 (PR link added after merge)

### C3. CAD exchange: DXF templates, export and import (Phase 3)   [new feature; no calculation changes]

- **Type:** geometry input/output only. New "CAD (DXF)" section on the Members input tab (after the "Add member / Load 5-member template" buttons): template select + **Download template**, **Export current model**, **Import DXF…**, and **Undo import** (shown after an import until the next edit). Import opens a modal with a preview (current model and the drawing as read, side by side, same scale), the warnings, a removal checkbox when members would be removed, and a table of every change (field, current, imported); **Apply** or **Cancel**.
- **No engineering formula, load factor, resistance factor, parameter default, unit or code reference was changed.** The engine `<script>` (`const GPR = (function () {` … `})();`), the 3D `<script>` (`const GP3D`) and the BridgeXfer `<script>` are byte-for-byte identical to Phase 2. No library added (the DXF writer and reader are written by hand).
- **Storage:** no new key; `gussetRating.autosave.v1`, `gussetRating.projects.v1`, the project export/import JSON and `gussetRating.view3d.v1` are unchanged (no new fields in the project data). The template choice and the undo snapshot are kept in memory only. Apply and Undo go through the normal `autosave()`; preview and Cancel do not write anything. `P.ui.col` may hold the new section id `in-sec-cad` (collapsed state, same mechanism as every other section).
- **What Apply changes:** the plate outline (`plates.poly`); per member `ang`, `fast.nR`, `fast.nL`, `fast.p`, `fast.g`, `fast.e`, `fast.off`, and `fast.d` only when it must be inferred (see below); plus any GP-DATA value given (list in the reference below). Members added in the drawing get the default member data of `normalize()` (box 12 × 12, rivet r0 7/8 in, etc.) unless GP-DATA gives them, and **zero forces** (warning "forces needed"); members missing from the drawing are removed **only after the removal checkbox is ticked** (Apply is refused otherwise). Not changed: member forces (DC, DW, LL), live load columns, code parameters, shear-plane definitions, condition/system factors, method, report and view settings, derived-geometry overrides (a warning is given when a member with overrides changes geometry). When a member's angle changes by more than 1°, a warning says its forces are kept as entered.
- **Hole pattern fit (import):** holes are transformed into member coordinates (s along the work line, t across it, + to the left). Gage lines = clusters of t (gap > 1/16 in starts a new one; centre = median); clusters with fewer than half the holes of the largest are not lines (their holes are assigned to the nearest line). Rows = clusters of s, same rule; pitch p from the first and last well-populated rows, `p = (s_last − s_first)/round((s_last − s_first)/median spacing)`, e = s_first; every hole is assigned to the nearest grid point (row k = round((s − e)/p)). Gages = differences between line centres (stored as one value if all equal within 1e-6, else a comma list); offset = mid-point of the outer lines. A hole more than 1/16 in from its grid point, a missing grid point or two holes at one grid point make the pattern irregular: the best-fit regular pattern is imported and **every difference is listed hole by hole** (with "the model has N holes where the drawing has M"); the preview marks such holes red and missing ones dashed. The model cannot store irregular patterns, so nothing is dropped silently.
- **Fastener diameter:** circle diameter = hole diameter. If GP-DATA gives `M<n>.D` it is used; otherwise the member's current `d` is kept when its hole diameter (d + Δ_std or oversize, current code parameters) matches the median circle within 1/64 in; otherwise d is inferred as hole − Δ_std (standard holes; for oversize holes the standard size whose oversize hole matches) and rounded to 1/16 in if within 0.002 in, with a warning. Any remaining mismatch between circles and d is warned.
- **Angle:** from the GP-M<n>-WL LINE (longest if several), direction from the end nearer the WP to the farther end, rounded to 0.01°, in [0°, 360°); an equivalent current angle (equal mod 360 within 0.005°) is kept. Warning when the line misses the WP by more than 1/16 in. Without a work line the angle is the principal axis of the holes (the one of the two axes nearer the direction to the hole centroid), with a warning.
- **Plate outline:** closed LWPOLYLINE/POLYLINE (bulges and ARCs segmented at ≤ 5°), or LINE/ARC pieces joined end to end (0.01 in) with a warning; the largest of several outlines (warning); duplicate and collinear points removed (0.001 in); made counterclockwise (first vertex kept). No outline → the current outline is kept (warning).
- **Reader:** ASCII DXF R12 and later, either line ending, group codes and values trimmed, UTF-8 or Windows-1252, `\U+XXXX` and `%%d/%%p/%%c` decoded. Entities: LINE, LWPOLYLINE (bulge → arc segments), POLYLINE/VERTEX/SEQEND (2D; meshes ignored), CIRCLE, ARC, TEXT, MTEXT (formatting codes stripped, `\P` = new line). OCS extrusion (0,0,−1) mirrored. Paper-space entities ignored. INSERT → "explode blocks before export"; other entity types counted and reported; entities on other layers counted by layer. Binary DXF ("AutoCAD Binary DXF" sentinel) and DWG ("AC10xx" header) → error "save as ASCII DXF". `$INSUNITS` 1 in, 2 ft, 4 mm, 5 cm, 6 m converted to inches (warning when not inches); absent or 0 → inches assumed with a warning; other codes → error.
- **Writer:** ASCII DXF R12 (`$ACADVER` AC1009), CRLF; HEADER (`$ACADVER`, `$INSBASE`, `$EXTMIN`, `$EXTMAX`, `$LTSCALE`, `$INSUNITS` = 1); TABLES (LTYPE CONTINUOUS, DASHED, CENTER; LAYER with colours; STYLE STANDARD); empty BLOCKS; ENTITIES with POLYLINE/VERTEX/SEQEND (closed flag 1), LINE, CIRCLE, TEXT. Coordinates to 8 decimals. Non-ASCII text written as `\U+XXXX`. Work line length = max(outer row, member end) + 12 in; member outline from the member end to the outer row + 6 in, width = width in the plate plane; filler outline = fastener field + 1.5 in (when TF > 0); splice line at x = 0 when the chord is spliced; title block / notes and a WP marker on GP-NOTES; GP-DATA block to the right of the drawing.
- **Templates** (`GPDXF.TEMPLATES`, data: member ids taken from `GPR.defaults()` plus an optional outline): 5 members (the "Load 5-member template" geometry: L1-L2, L2-L3, L2-U1, L2-U3, L2-U2, default outline); 4 members chord + 2 diagonals (L1-L2, L2-L3, L2-U1, L2-U3, default outline); 4 members chord + vertical + diagonal (L1-L2, L2-L3, L2-U2, L2-U3; outline (−24,−9) (24,−9) (24,9) (33.25,28.25) (22.125,37.625) (−8,37.625) (−24,9)); 3 members chord + vertical (L1-L2, L2-L3, L2-U2; outline (−24,−9) (24,−9) (24,9) (10,32) (−10,32) (−24,9)). A template's GP-DATA writes only CHORD and per member ROLE, W, CUT, D, HOLE; the other keys are written blank (blank = keep the current value), so a template does not overwrite the project's plate, material or names.
- **Edits to existing code (anchors for re-applying by hand):**
  - CSS: block `/* CAD (DXF) exchange (Phase 3) */` (10 rules) inserted before `</style>` (after `@media (max-width: 900px) { .v3-wrap { height: 60vh; } }`).
  - New `<script>` defining `const GPDXF = (function () { … })();` inserted between the 3D script and the UI script (`Gusset Plate Rating: user interface`).
  - Modal: before `<div id="calc-rpt" class="crdoc"></div>` added `<div class="modal" id="cad-modal" hidden>…</div>` (`#cad-title`, `#cad-sub`, `#cad-body`, `#cad-cancel`, `#cad-apply`).
  - `paneMembers()`: after `data-act="tpl5">Load 5-member template</button></div></div>` added `${secHd('sec-cad', 'CAD (DXF)')}<div class="sec-body one-col" id="sec-cad">${cadPane()}</div>`.
  - New UI block `/* ---------- CAD (DXF) exchange (Phase 3) … */` (`cadPane`, `cadMsg`, `cadEdited`, `cadDownload`, `cadShow`, `cadApply`, `cadUndo`, click/change listeners) inserted before `/* ---------- paste importers ---------- */`.
  - An edit ends the undo (`cadEdited()`): `onInput`: `if (!el.dataset || !el.dataset.k) return;` → `… return; cadEdited();`; ACT click listener: `if (r === false || r === 'norebuild') return; rebuild();` → `… return; cadEdited(); rebuild();`; `loadData`: `{ P = GPR.normalize(d);` → `{ cadEdited(); P = GPR.normalize(d);`; paste Apply: `r.list.forEach(x => { const m = P.members[x.idx];` → `cadEdited(); r.list.forEach(…`; method tabs: `() => { P.method = b.dataset.meth;` → `() => { cadEdited(); P.method = b.dataset.meth;`.
  - `methodHtml()`: before `<h3>Not included in Phase 1</h3>` added `<h3>CAD (DXF) exchange</h3>` with the layer scheme (below).
  - Header pill `…6B (LFR), Phase 2</span>` → `…Phase 3</span>`; report front page `(Phase 2).` → `(Phase 3).`
- **Governing provision:** none (geometry input/output only).
- **Check case:** results unchanged. Default 5-member model: LRFR Inventory HL-93 RF = 1.172 (L2-U1-FS), Operating 1.519; LFR Inventory HS20 1.403 (L2-U1-WB), Operating 2.342 — before and after. Validation model: LRFR Inv 1.564 / Op 2.027, LFR Inv 2.109 / Op 3.521, reversal LRFR Inv 3.759 / Op 4.872 (all D-FS) — before and after. Round trip: default model → DXF → import onto the default model → 0 changes, identical RFs.
- **How verified:**
  - `node --check` on every inline script (7 blocks): pass.
  - Engine in node before and after (every check capacity, every RF, warnings, Whitmore/L_mid/block-shear geometry for the default and validation models written to JSON): `cmp` identical. Engine, 3D and BridgeXfer script blocks byte-identical.
  - Round trip in node (export → parse → map onto the same model) for the default model, the validation model, each of the 4 templates and a variant (spliced chord, 3 plates, custom steel, A325 oversize punched holes with a gage list 3, 4.5, 3, offset 0.75 in, 2 shear planes, 3/8 in filler, a 49.37° member, a one-row member, non-ASCII text): 0 changes, every geometry field equal within 1e-6, member forces identical, every RF and capacity identical. Hole positions written = engine hole positions (max difference 0).
  - ezdxf 1.4.4: every exported file (`readfile` + `audit`): 0 errors, 0 fixes; a DXF written by ezdxf (R2010, LWPOLYLINE with a bulge corner, millimetres, MTEXT with formatting) imported correctly.
  - Hand-written test DXFs, each giving the expected result/warning: LWPOLYLINE with bulges and a collinear vertex; millimetres; MTEXT with formatting + `\U+2013` + `%%d` + an unknown key + a bad value + a non KEY=VALUE line; block INSERT, SPLINE/HATCH and another layer; missing work line (angle 130° recovered from the holes); irregular patterns (one hole missing + one hole 0.25 in off; staggered); extra member M6 with GP-DATA; binary DXF; DWG; exploded plate outline + 2 members removed + splice line on a continuous chord + outline width/end mismatch + FY with a preset steel + invalid values + no `$INSUNITS`; feet with an R12 POLYLINE plate, a second closed outline and an ARC on a WL layer; varying pitch; not a DXF.
  - jsdom (CDN blocked, no `TextDecoder` → fallback decoder exercised): CAD section and 4 templates render; template and export downloads (R12, CRLF) do not touch the autosave; re-importing the export shows "nothing would change" with Apply disabled; import preview (2 SVGs, change table, warnings) and Cancel leave the model and autosave unchanged; Apply adds the member (zero forces; forces, LL columns and code parameters kept) and autosaves; Undo restores the original exactly (autosaved data identical) and hides the button; removal refused without the tick, applied with it; an edit after an import clears the undo; binary DXF and DWG show their errors without Apply; all 9 tabs render; Method tab has the layer scheme; only key `gussetRating.autosave.v1` written; Phase 2 jsdom regression test passes unchanged.
  - Chromium (Playwright): screenshots of the import preview (irregular pattern, removed members, ezdxf R2010 file) and of the Drawing tab after Apply reviewed; no page errors (only the blocked Google Fonts request).
- **Other copies:** none (the new code is only in this file).
- **Open items:**
  - O11. Irregular fastener patterns (missing, staggered or unevenly pitched holes) can only be imported as the best-fit regular grid, because the model stores rows × gage lines at one pitch. The best fit may count holes that are not in the drawing (unconservative for fastener shear and bearing); the warning lists each one. Storing irregular patterns would need new project fields (a format change with a migration) — not done. (2026-10-05: Apply now needs a confirmation tick; see C4.3.)
  - O12. Non-ASCII text is written as `\U+XXXX` (AutoCAD shows it as the character; ezdxf leaves R12 text as written).
  - O13. Opening the exported R12 file in AutoCAD and MicroStation themselves was not possible here (checked with ezdxf and with this tool's own reader).

#### DXF layer scheme (reference)

Units: inches (the import converts ft, mm, cm, m from `$INSUNITS`). Origin = work point (WP), +x along the chord (to the right), +y up. Keep the WP at 0,0. Explode blocks; save as ASCII DXF (R12 or later).

| Layer | Contents | Import |
|---|---|---|
| `GP-PLATE` | One closed polyline: the plate outline | Plate outline (largest if several; lines/arcs joined; collinear points removed; counterclockwise) |
| `GP-M<n>-WL` | LINE from the WP outward: work line of member n (n = order on the Members tab) | Member angle θ (0.01°); missing → from the hole pattern, warning |
| `GP-M<n>-BOLT` | CIRCLEs: holes of member n, diameter = hole diameter | Rows, gage lines, pitch, gages, WP to inner row, offset (1/16 in tolerance; irregular → best fit + hole-by-hole warning); d if needed |
| `GP-M<n>-OUTL` | Member outline (member end to past the last row, width in the plate plane) | Check only (width, member end) |
| `GP-SPLICE` | Chord splice line | Information (warning if the chord is continuous) |
| `GP-FILL` | Filler outlines | Information |
| `GP-DATA` | TEXT/MTEXT `KEY=VALUE` (inches, ksi; blank = keep) | Values below |
| `GP-NOTES` | Title block, notes, WP marker | Ignored |
| other | — | Ignored (counted) |

GP-DATA keys: `FORMAT` (written, ignored), `PROJECT`, `BRIDGE`, `JOINT`, `NP` (plates), `T_PLATE`, `STEEL` (A36, u1905, u1936, u1963, u1964, A572, custom), `FY`, `FU` (only with STEEL=custom), `CHORD` (continuous, spliced); per member `M<n>.NAME`, `.ROLE` (chord, web), `.SECTION` (box, H, W, L), `.DESC`, `.W` (width in the plate plane), `.D2` (width out of plane), `.CUT` (member end from WP), `.FASTENER` (r0, r1, r2, A325, A490), `.D` (fastener diameter), `.HOLE` (standard, oversize; a number = hole diameter, checked only), `.PREP` (drilled, punched), `.THREADS` (excl, incl), `.NS` (1, 2), `.TF` (filler thickness). New member: add layers `GP-M<n>-WL` and `GP-M<n>-BOLT` with the next n.

## 2026-10-05 — PR: claude/gusset-followup1 (PR link added after merge)

### C4. Engineer's answers (2026-10-05): 0.85 A_g cap switch, live-load concurrency note, DXF best-fit confirmation, confirmed geometry conventions   [calculation option added; default results unchanged]

Four items from the engineer's answers to the Phase 1–3 open questions. φ_c = φ_s = 1.0 defaults are kept (engineer: keep).

#### C4.1 Whitmore net section: A_n ≤ 0.85 A_g made a switch (code parameter `capAnOn`, default 1 = applied)

- **Before:** the Whitmore net section was always capped: A_n = min(W_n Σt, capAn × W_g Σt) with capAn = 0.85 (editable ratio).
- **After:** new code parameter `capAnOn` (Code parameters tab, group "Material and geometry", directly below `capAn`): "Apply A_n ≤ 0.85 A_g to the Whitmore net section (1 = yes, 0 = no)", default **1**, reference LRFD 10th Ed. 6.13.5.2, "verify" + "least certain" badges (same as `capAn`). 1 (any value ≥ 0.5): A_n = min(W_n Σt, capAn × W_g Σt), exactly as before. 0: A_n = W_n Σt (net Whitmore area only). The `capAn` ratio is unchanged and is used only when the switch is on. The calc sheet (Checks tab and report) shows which branch was used: the equation is `A_n = min(W_n Σt, 0.85 W_g Σt)` or `A_n = W_n Σt`, and the "where" table has a new row A_n saying "limit applied: 0.85 W_g Σt governs (W_n Σt = …)" / "limit applied: W_n Σt governs (0.85 W_g Σt = …)" / "limit is not applied (code parameter switched off)". When the switch is off, `capAn` is no longer listed among the check's parameters (`keys`); `capAnOn` always is.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 6.13.5.2 (A_n ≤ 0.85 A_g for splice and connection elements in tension); the Whitmore section per LRFD 10th Ed. Art. 6.14.2.8 and MBE 3rd Ed. Art. 6A.6.12.6.7. Whether the 0.85 limit applies to gusset plates is the engineer's decision (switch).
- **Saved data:** no format change. Code parameters are stored only as overrides in `data.code` (a key is written only when its value differs from the default) and are merged over the defaults by `GPR.prm()` (`const o = { ...PDEF }; … o[k] = +code[k]`). A project, autosave (`gussetRating.autosave.v1`), saved project (`gussetRating.projects.v1`) or exported JSON written before this change has no `capAnOn` key and therefore gets the default 1 = cap on = old behaviour. Turning the cap off writes the additive key `data.code.capAnOn = 0`. An older copy of the tool ignores the unknown key (`prm()` only copies keys that exist in `PDEF`) and applies the cap. DXF GP-DATA does not carry code parameters (unchanged).
- **Where (anchors):**
  - `PARAMS` (engine, `const PARAMS = [`): new row inserted after the `capAn` row (anchor `'Set to 1.0 if the 0.85 A_g limit is not applied to gusset plates.'],`).

    Before:

    ```js
        ['capAn', 'both', 'Material and geometry', 'A_n/A_g', 'Upper limit on A_n/A_g for the Whitmore net section (connection element)', 0.85, '', 'LRFD 10th Ed. 6.13.5.2', 1, 'Set to 1.0 if the 0.85 A_g limit is not applied to gusset plates.'],
    ```

    After:

    ```js
        ['capAn', 'both', 'Material and geometry', 'A_n/A_g', 'Upper limit on A_n/A_g for the Whitmore net section (connection element)', 0.85, '', 'LRFD 10th Ed. 6.13.5.2', 1, 'Set to 1.0 if the 0.85 A_g limit is not applied to gusset plates.'],
        ['capAnOn', 'both', 'Material and geometry', '-', 'Apply A_n ≤ 0.85 A_g to the Whitmore net section (1 = yes, 0 = no)', 1, '', 'LRFD 10th Ed. 6.13.5.2', 1, 'Yes: A_n = min(W_n Σt, (A_n/A_g limit above) × W_g Σt). No: A_n = W_n Σt (net Whitmore area only).'],
    ```
  - `capWF()` (engine, anchor `function capWF(g, meth)`): the four lines of the function.

    Before:

    ```js
        function capWF(g, meth) { const lrfr = meth === 'lrfr', phi = lrfr ? p.phiU : p.phiUL, W = g.W, An0 = W.Wn * sumT, Ag = W.Wg * sumT, An = Math.min(An0, p.capAn * Ag), Rn = Fu * An * p.U, C = phi * Rn;
          return { C, phi, sym: T`\phi_uP_{nu} = \phi_u\,F_u\,A_n\,U, \quad A_n = \min\left(W_n\textstyle\sum t,\ ${f2(p.capAn)}\,W_g\sum t\right)`, subst: T`A_n = \min(${f3(W.Wn)}(${f4(sumT)}),\ ${f2(p.capAn)}(${f3(W.Wg)})(${f4(sumT)})) = ${f3(An)}\ \text{in}^2, \quad \phi_uP_{nu} = ${f2(phi)}(${f1(Fu)})(${f3(An)})(${f2(p.U)}) = ${f1(C)}\ \text{kip}`,
            where: [whitWhere(g), wr('W<sub>n</sub>', `Net Whitmore width: W<sub>g</sub> − Σ(d<sub>h</sub> + ${f4(p.dNet)}) for the ${W.cross.length} hole${W.cross.length === 1 ? '' : 's'} on the section${W.ovN != null ? ' (overridden)' : ''}`, f3(W.Wn), 'in', W.ovN != null ? 'Override' : 'LRFD 6.8.3'), wr('U', 'Shear-lag factor', f2(p.U), '', 'LRFD 6.13.5.2'), wr('φ<sub>u</sub>', 'Resistance factor, fracture', f2(phi), '', lrfr ? 'LRFD 6.5.4.2' : 'FHWA-IF-09-014'), ...plateWhere()],
            keys: ['thW', 'dNet', 'U', 'capAn', lrfr ? 'phiU' : 'phiUL'], An, An0 }; }
    ```

    After:

    ```js
        function capWF(g, meth) { const lrfr = meth === 'lrfr', phi = lrfr ? p.phiU : p.phiUL, W = g.W, An0 = W.Wn * sumT, Ag = W.Wg * sumT, capOn = p.capAnOn >= 0.5, An = capOn ? Math.min(An0, p.capAn * Ag) : An0, Rn = Fu * An * p.U, C = phi * Rn;
          return { C, phi, sym: capOn ? T`\phi_uP_{nu} = \phi_u\,F_u\,A_n\,U, \quad A_n = \min\left(W_n\textstyle\sum t,\ ${f2(p.capAn)}\,W_g\sum t\right)` : T`\phi_uP_{nu} = \phi_u\,F_u\,A_n\,U, \quad A_n = W_n\textstyle\sum t`, subst: (capOn ? T`A_n = \min(${f3(W.Wn)}(${f4(sumT)}),\ ${f2(p.capAn)}(${f3(W.Wg)})(${f4(sumT)})) = ${f3(An)}\ \text{in}^2` : T`A_n = ${f3(W.Wn)}(${f4(sumT)}) = ${f3(An)}\ \text{in}^2`) + T`, \quad \phi_uP_{nu} = ${f2(phi)}(${f1(Fu)})(${f3(An)})(${f2(p.U)}) = ${f1(C)}\ \text{kip}`,
            where: [whitWhere(g), wr('W<sub>n</sub>', `Net Whitmore width: W<sub>g</sub> − Σ(d<sub>h</sub> + ${f4(p.dNet)}) for the ${W.cross.length} hole${W.cross.length === 1 ? '' : 's'} on the section${W.ovN != null ? ' (overridden)' : ''}`, f3(W.Wn), 'in', W.ovN != null ? 'Override' : 'LRFD 6.8.3'), wr('A<sub>n</sub>', capOn ? `Net area, A<sub>n</sub> ≤ ${f2(p.capAn)} A<sub>g</sub> limit applied: ${An < An0 - 1e-9 ? `${f2(p.capAn)} W<sub>g</sub>Σt governs (W<sub>n</sub>Σt = ${f3(An0)} in²)` : `W<sub>n</sub>Σt governs (${f2(p.capAn)} W<sub>g</sub>Σt = ${f3(p.capAn * Ag)} in²)`}` : `Net area W<sub>n</sub>Σt; the A<sub>n</sub> ≤ ${f2(p.capAn)} A<sub>g</sub> limit is not applied (code parameter switched off)`, f3(An), 'in²', 'LRFD 6.13.5.2'), wr('U', 'Shear-lag factor', f2(p.U), '', 'LRFD 6.13.5.2'), wr('φ<sub>u</sub>', 'Resistance factor, fracture', f2(phi), '', lrfr ? 'LRFD 6.5.4.2' : 'FHWA-IF-09-014'), ...plateWhere()],
            keys: ['thW', 'dNet', 'U', ...(capOn ? ['capAn'] : []), 'capAnOn', lrfr ? 'phiU' : 'phiUL'], An, An0 }; }
    ```
- **Check case (validation model, `GPR.validationModel()`, default parameters otherwise):** diagonal D, 2 lines × 4 rows, gage 5 in, pitch 3 in; two 1/2 in A36 plates (Σt = 1.0 in, F_u = 58 ksi); φ_u = 0.80 (LRFR and LFR), U = 1.0.
  - W_g = 5 + 2(3 × 3) tan 30° = 5 + 10.392 = 15.392 in; W_n = 15.392 − 2(15/16 + 1/16) = 13.392 in.
  - **Switch on (default, = before):** W_n Σt = 13.392 in²; 0.85 W_g Σt = 0.85 × 15.392 × 1.0 = 13.083 in²; A_n = min(13.392, 13.083) = **13.083 in²** (0.85 A_g governs); φ_u P_nu = 0.80 × 58 × 13.083 × 1.0 = **607.07 kip** (303.54 kip per plate).
  - **Switch off:** A_n = W_n Σt = 13.392 × (0.5 + 0.5) = **13.392 in²** (6.696 in² per plate); φ_u P_nu = 0.80 × 58 × 13.392 × 1.0 = **621.40 kip** (310.70 kip per plate). Tool: 621.402945 kip.
  - D-WF rating factors (DC 40, DW 6, HL-93 60, HS20 50 kip): LRFR Inventory (607.07 − 1.25 × 40 − 1.50 × 6)/(1.75 × 60) = 548.07/105 = 5.220 → (621.40 − 59)/105 = 562.40/105 = **5.356**; LRFR Operating 548.07/81 = 6.766 → 562.40/81 = **6.943**; LFR Inventory (607.07 − 1.3 × 46)/(2.17 × 50) = 547.27/108.5 = 5.044 → 561.60/108.5 = **5.176**; LFR Operating 547.27/65 = 8.420 → 561.60/65 = **8.640**. Reversal columns: fracture not applicable (compression).
  - **Fracture does not govern any rating** in the validation model: governing remains D-FS (LRFR Inventory 1.564, Operating 2.027; LFR Inventory 2.109, Operating 3.521; reversal 3.759 / 4.872), switch on or off.
  - Default 5-member model: only L2-U2 (vertical) changes: W_g = 21.166 in, W_n = 19.166 in, Σt = 1.0 in; on: A_n = min(19.166, 0.85 × 21.166 = 17.991) = 17.991 in², φP = 0.80 × 58 × 17.991 = 834.78 kip; off: A_n = 19.166 in², φP = 889.29 kip; RF (LRFR Inv / Op, LFR Inv / Op) 8.06 / 10.45 / 8.93 / 14.90 → 8.63 / 11.18 / 9.56 / 15.95. The diagonals L2-U1 / L2-U3 are not affected (W_n/W_g = 22.547/26.547 = 0.849 < 0.85, so W_n governs either way: 1000.86 kip). Governing RFs unchanged (LRFR Inventory 1.172 L2-U1-FS, LFR Inventory 1.403 L2-U1-WB).

#### C4.2 Live-load concurrency: note only (no calculation change)

- **Decision (engineer, 2026-10-05):** keep the calculation. Forces in one live-load column are treated as one concurrent load position for the shear-plane demand V = Σ F_i (u_i · e) and the chord ΔF = Σ F_i (u_i · u_right), as in NCHRP Web-Only Document 197 / FHWA-IF-09-014 (concurrent member forces from the same loading).
- **Text added** (constant `CONC_NOTE`, defined after `demandHtml()`): "Forces in each live-load column are treated as concurrent (same load position). If envelope forces are entered, verify they are concurrent; envelopes of different load positions may be unconservative or conservative."
  - Forces input tab, `paneForces()`: after `<p class="note">Unfactored, total for the joint (both gusset plates). LL includes impact (IM) and distribution. Positive = tension.</p>` added `<p class="note">${CONC_NOTE} This applies to the shear-plane checks and the chord force difference ΔF.</p>`.
  - Calc sheet (Checks tab and report), `demandHtml(c)`: after the demand table, for checks without a member (`c.mem == null`: the chord ΔF checks CH-FS / CH-BR and every shear-plane check) added `<p class="note-p"><b>Live load concurrency.</b> ${CONC_NOTE}</p>`. Member checks are unchanged.
  - `demandHtml()` return line (anchor `return `<p class="note-p"><b>Demand.</b>`):

    Before:

    ```js
      return `<p class="note-p"><b>Demand.</b> ${what}.</p><div class="tscroll"><table class="tbl narrow"><thead><tr><th>Load</th><th class="right">Value (kip)</th></tr></thead><tbody><tr><td class="lbl">DC</td><td class="val">${f2(c.dem.DC)}</td></tr><tr><td class="lbl">DW</td><td class="val">${f2(c.dem.DW)}</td></tr>${P.ll.map((l, k) => `<tr><td class="lbl">${esc(l.name)} (LL+IM)</td><td class="val">${f2(c.dem.LL[k])}</td></tr>`).join('')}</tbody></table></div>`;
    }
    ```

    After:

    ```js
      return `<p class="note-p"><b>Demand.</b> ${what}.</p><div class="tscroll"><table class="tbl narrow"><thead><tr><th>Load</th><th class="right">Value (kip)</th></tr></thead><tbody><tr><td class="lbl">DC</td><td class="val">${f2(c.dem.DC)}</td></tr><tr><td class="lbl">DW</td><td class="val">${f2(c.dem.DW)}</td></tr>${P.ll.map((l, k) => `<tr><td class="lbl">${esc(l.name)} (LL+IM)</td><td class="val">${f2(c.dem.LL[k])}</td></tr>`).join('')}</tbody></table></div>${c.mem != null ? '' : `<p class="note-p"><b>Live load concurrency.</b> ${CONC_NOTE}</p>`}`;
    }
    const CONC_NOTE = 'Forces in each live-load column are treated as concurrent (same load position). If envelope forces are entered, verify they are concurrent; envelopes of different load positions may be unconservative or conservative.';
    ```
- **Governing provision:** none changed (text only). **Check case:** results unchanged (engine dump identical, see How verified).

#### C4.3 DXF import: irregular hole pattern needs a confirmation before Apply

- **Before:** an irregular pattern was imported as the best-fit regular grid with a hole-by-hole warning only; Apply was enabled whenever there were changes.
- **After:** `GPDXF.toModel()` returns `irregular: [{ n, tag }]`, one entry per member whose best-fit grid differs from the drawing (`fitPattern(...).issues` not empty: a hole moved off its grid position by more than 1/16 in, a grid position with no hole (added by the fit), or several holes at one grid position). The import dialog then shows a red box with the checkbox `#cad-fit-ok`: "I confirm the best-fit regular grid is acceptable for M3 (L2-U1), … (the model may count holes not in the drawing, which is unconservative for fastener shear and bearing). Required to apply." Apply stays disabled until it is ticked (`cadApplyState()`, re-evaluated on the checkbox `change`), and `cadApply()` itself refuses (alert "Tick the box to confirm the best-fit regular hole pattern, or Cancel.", model and autosave unchanged) when it is not ticked. The removed-members checkbox (`#cad-rm-ok`) is unchanged. Imports with regular patterns are unaffected.
- **Where (anchors):** `toModel()`: `const nm = P.members.length, newMembers = [], removed = [], added = [];` → `…, added = [], irregular = [];`; before `if (F.issues.length) W.push(` added `if (F.issues.length) irregular.push({ n, tag });`; `return { Q, changes, warnings: W, errors: E, removed, added, fits, raw, present };` → `… removed, added, irregular, fits, raw, present };` (and the comment above `function toModel`). UI below.
  - `cadShow()` / `cadApply()` / change listener:

    Before:

    ```js
      const pv = GPDXF.previewPair(P, res), ch = res.changes, W = res.warnings, rm = res.removed;
      $('#cad-apply').hidden = false; $('#cad-apply').disabled = !ch.length; $('#cad-modal').hidden = false;
    function cadApply() {
      const res = CAD_RES; if (!res || res.error) return;
    document.addEventListener('change', e => { if (e.target.id === 'cad-tpl') { CAD_TPL = e.target.value; return; } if (e.target.id !== 'cad-file') return; const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
    ```

    After:

    ```js
      const pv = GPDXF.previewPair(P, res), ch = res.changes, W = res.warnings, rm = res.removed, irr = res.irregular || [];
        ${irr.length ? `<div class="alert fail"><label class="ck-row" style="padding:0"><input type="checkbox" id="cad-fit-ok"><label for="cad-fit-ok">I confirm the best-fit regular grid is acceptable for <b>${irr.map(r => esc(r.tag)).join(', ')}</b> (the model may count holes not in the drawing, which is unconservative for fastener shear and bearing). Required to apply.</label></label></div>` : ''}
      $('#cad-apply').hidden = false; cadApplyState(); $('#cad-modal').hidden = false;
    /* Apply is enabled only with changes and, for an irregular hole pattern, the best-fit confirmation ticked */
    const cadFitOk = res => !(res.irregular || []).length || !!($('#cad-fit-ok') || {}).checked;
    function cadApplyState() { const res = CAD_RES, b = $('#cad-apply'); if (!b || !res || res.error) return; b.disabled = !res.changes.length || !cadFitOk(res); }
    function cadApply() {
      const res = CAD_RES; if (!res || res.error) return;
      if (!cadFitOk(res)) { alert('Tick the box to confirm the best-fit regular hole pattern, or Cancel.'); cadApplyState(); return; }
    document.addEventListener('change', e => { if (e.target.id === 'cad-tpl') { CAD_TPL = e.target.value; return; } if (e.target.id === 'cad-fit-ok') { cadApplyState(); return; } if (e.target.id !== 'cad-file') return; const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
    ```
  - The checkbox line is inserted directly after the removed-members `${rm.length ? `<div class="alert fail">…Required to apply.</label></label></div>` : ''}` line in `cadShow()`.
  - `methodHtml()`: "An irregular pattern is imported as the best-fit regular pattern and every difference is listed hole by hole." → "…hole by hole; Apply stays disabled until the box confirming the best-fit grid is ticked."
- **Governing provision:** none (input control; LRFD 10th Ed. 6.13.2.7 fastener shear and 6.13.2.9 bearing are the checks that would be unconservative with extra holes). **Check case:** test file `13_varying_pitch.dxf` (pitch 3.1 in with holes ±0.1–0.2 in off the grid on M3): checkbox for "M3 (L2-U1)", Apply disabled; `cadApply()` refused; ticked → enabled → applied. `06_irregular.dxf` (M4 one hole moved, one missing; M5 4 missing): checkbox for "M4 (L2-U3), M5 (L2-U2)"; Apply disabled (also no changes). `07_extra_member.dxf` (regular): no checkbox, Apply enabled.

#### C4.4 Geometry conventions confirmed by the engineer (2026-10-05)

- Confirmed: Whitmore 30° spread from the first fastener row (the row farthest from the WP, where the member force enters the plate) to the row nearest the WP; L_mid = average of three lengths to the nearest fastener line of another member or the plate edge; block shear for tension only; automatic shear planes through the top and bottom chord fastener lines. See "Confirmed" (under "Needs verification" in C1).
- In the tool only `thW` (Whitmore spread angle) carried a "verify" badge for these conventions. It now shows "engineer-confirmed 2026-10-05" (green badge) on the Code parameters tab and "engineer-confirmed 2026-10-05" in the Status column of the report's code-parameter table. The L_mid, block-shear and shear-plane conventions had no badge or "verify" note in the tool (only in this fix log), so nothing else in the tool changed. Every other parameter keeps its flags (rivet strengths, LFR K, LFR φ factors, fastener values and the rest remain "verify" / "least certain").
  - `PARAMS` row `thW` and the row mapping:

    Before:

    ```js
        ['thW', 'both', 'Material and geometry', '\\theta_W', 'Whitmore spread angle, each side', 30, 'deg', 'LRFD 10th Ed. 6.14.2.8 (C6.14.2.8); MBE 3rd Ed. 6A.6.12.6.7, 6A.6.12.6.8', 0, 'Spread from the outer fasteners of the row farthest from the work point to the row nearest it.'],
      ].map(r => ({ key: r[0], meth: r[1], grp: r[2], sym: r[3], desc: r[4], def: r[5], unit: r[6], ref: r[7], unc: !!r[8], note: r[9] }));
    ```

    After:

    ```js
        ['thW', 'both', 'Material and geometry', '\\theta_W', 'Whitmore spread angle, each side', 30, 'deg', 'LRFD 10th Ed. 6.14.2.8 (C6.14.2.8); MBE 3rd Ed. 6A.6.12.6.7, 6A.6.12.6.8', 0, 'Spread from the outer fasteners of the row farthest from the work point to the row nearest it.', 'engineer-confirmed 2026-10-05'],
      ].map(r => ({ key: r[0], meth: r[1], grp: r[2], sym: r[3], desc: r[4], def: r[5], unit: r[6], ref: r[7], unc: !!r[8], note: r[9], conf: r[10] || '' }));
    ```
  - `renderParams()`: `<td><span class="badge warn">verify</span>${p.unc ?` → `<td>${p.conf ? `<span class="badge pass" title="Convention confirmed by the engineer">${esc(p.conf)}</span>` : '<span class="badge warn">verify</span>'}${p.unc ?`
  - `crParams()`: `<td>verify${p.unc ? '; least certain' : ''}` → `<td>${p.conf ? esc(p.conf) : 'verify'}${p.unc ? '; least certain' : ''}`
- **Governing provision:** none changed (status label only; θ_W = 30° per LRFD 10th Ed. 6.14.2.8 / MBE 3rd Ed. 6A.6.12.6.7 unchanged).

#### How verified (C4)

- `node --check` on every inline script (7 blocks): pass.
- Engine dump in node, before (main 60b469a) and after, default and validation models, default parameters: every check capacity (both methods, both directions), every RF, warnings, shear-plane demands, Whitmore W_g / W_n / L_mid and block-shear lengths written to JSON: `cmp` identical. With `capAnOn = 0` the only differences are L2-U2-WF (default model) and D-WF (validation model), values as in the check case above; governing RFs and warnings unchanged.
- Old saved data (jsdom): main (60b469a) with the validation model and overrides `{Om: 0.8, capAn: 0.9, phiSr: 0.75}`: its autosave blob and its exported project JSON (no `capAnOn` key) loaded into the new file (autosave at boot; JSON through Import): `data.code` unchanged, `capAnOn` resolves to 1, every capacity, RF, warning and Whitmore / L_mid value identical to main; default model identical to main.
- jsdom UI: `capAnOn` row (value 1, LRFD 10th Ed. 6.13.5.2, verify + least certain); `thW` row shows "engineer-confirmed 2026-10-05" and no "verify" (only parameter so marked); D-WF calc sheet shows "limit applied … 0.85 W_g Σt governs", 607.1 kip; typing 0 stores `code.capAnOn = 0` (autosave format `{data, name}` unchanged), D-WF shows "not applied", 621.4 kip; concurrency note on the Forces tab, in SP1-Y and CH-FS calc sheets and in the report, not on member checks; DXF irregular-pattern tests as in C4.3; all other gp3 test DXFs: checkbox shown only when `irregular` is not empty.
- Phase 1–3 regression scripts re-run on the new file: Phase 3 jsdom CAD test (31 PASS, no runtime errors), DXF test cases and round trips (output identical to main), Phase 2 and Phase 1 jsdom smoke tests (every tab and input tab renders; validation 17 of 17 match; only differences are the expected page-size changes and paste timestamps).
- **Other copies:** none.
- **Open items:** O6 (live-load concurrency) is answered: kept as is, with the note (C4.2). O11 (irregular DXF patterns) is now guarded by the confirmation (C4.3); the model still cannot represent irregular patterns.

## 2026-10-05 — PR: claude/gusset-templates2 (PR link added after merge)

### C5. DXF templates: heel joint and upper-chord panel points   [new templates; no calculation changes]

- **Type:** template data and template builder only. Three entries added to `GPDXF.TEMPLATES` (CAD (DXF) section on the Members tab, Template select, now 7 entries; the existing four keep their order, labels and output):
  - `t2h` "2 members: heel joint, chord ends + end post": bottom chord **L0-L1** (role chord, 0°, copy of L2-L3: box 18 × 14, 6 rows × 4 lines, p = 4, g = 4, e = 1.5) and end post **L0-U1** (web, 50°, copy of L2-U3: box 14 × 12 "2 C12 laced", member end 24.5, 6 × 4, p = 3, g = 3.5, e = 26). **CHORD = spliced** (see "Heel joint: chord mode" below). Plate outline (−6, −9) (24, −9) (24, 9) (33.25, 28.25) (22.125, 37.625) (−6, 9): left edge 6 in left of the WP (7.5 in from the first chord row), top-right corner the same as the default diagonal's, left edge rising along the end post.
  - `t5u` "5 members: upper chord + vertical + two diagonals (members below)": U1-U2 (chord, 180°), U2-U3 (chord, 0°), U2-L1 (230°), U2-L3 (310°), U2-L2 (270°); copies of L1-L2, L2-L3, L2-U1, L2-U3, L2-U2. Outline = default outline mirrored about the chord, counterclockwise: (−24, 9) (−24, −9) (−33.25, −28.25) (−22.125, −37.625) (22.125, −37.625) (33.25, −28.25) (24, −9) (24, 9). Chord continuous.
  - `t4u` "4 members: upper chord + vertical + diagonal (Pratt, members below)": U1-U2 (180°), U2-U3 (0°), U2-L2 (270°), U2-L3 (310°); outline = the `t4v` outline mirrored: (−24, 9) (−24, −9) (−8, −37.625) (22.125, −37.625) (33.25, −28.25) (24, −9) (24, 9). Chord continuous.
- **Forces:** the existing templates take their members (with their forces) from `GPR.defaults()` by id; forces are not written to the DXF (no force keys in GP-DATA), so they only exist in `templateModel()`. Members of the new templates get **zero forces** (DC = DW = 0, every LL column 0); no balanced set is invented (a heel joint cannot be balanced by its two members without the bearing reaction).
- **No engineering formula, load factor, resistance factor, parameter default, unit or code reference was changed.** The engine `<script>` (`const GPR`), the 3D `<script>` (`const GP3D`), the BridgeXfer and project-info scripts are byte-identical to main (5c1a078). No storage key or saved-data format changed; no library added.
- **Where (anchors):**
  - `GPDXF.TEMPLATES` (anchor `const TEMPLATES = [`): after the `t3` entry (`… [-10, 32], [-24, 9]] }` → `… [-10, 32], [-24, 9]] },`) added the comment `/* templates with their own member list (mem): … */` and the three entries:

    ```js
        { key: 't2h', label: '2 members: heel joint, chord ends + end post', short: '2-member heel joint, chord ends at the joint + end post', file: 'gusset_template_2-member_heel.dxf', chord: 'spliced',
          mem: [{ from: 'L2-L3', id: 'L0-L1' }, { from: 'L2-U3', id: 'L0-U1' }], poly: [[-6, -9], [24, -9], [24, 9], [33.25, 28.25], [22.125, 37.625], [-6, 9]] },
        { key: 't5u', label: '5 members: upper chord + vertical + two diagonals (members below)', short: '5-member upper chord panel point, members below', file: 'gusset_template_5-member_upper_chord.dxf',
          mem: [{ from: 'L1-L2', id: 'U1-U2' }, { from: 'L2-L3', id: 'U2-U3' }, { from: 'L2-U1', id: 'U2-L1', ang: 230 }, { from: 'L2-U3', id: 'U2-L3', ang: 310 }, { from: 'L2-U2', id: 'U2-L2', ang: 270 }],
          poly: [[-24, 9], [-24, -9], [-33.25, -28.25], [-22.125, -37.625], [22.125, -37.625], [33.25, -28.25], [24, -9], [24, 9]] },
        { key: 't4u', label: '4 members: upper chord + vertical + diagonal (Pratt, members below)', short: '4-member upper chord panel point, vertical + diagonal below', file: 'gusset_template_4-member_upper_chord_vert_diag.dxf',
          mem: [{ from: 'L1-L2', id: 'U1-U2' }, { from: 'L2-L3', id: 'U2-U3' }, { from: 'L2-U2', id: 'U2-L2', ang: 270 }, { from: 'L2-U3', id: 'U2-L3', ang: 310 }],
          poly: [[-24, 9], [-24, -9], [-8, -37.625], [22.125, -37.625], [33.25, -28.25], [24, -9], [24, 9]] }
    ```
  - `templateModel()`:

    Before:

    ```js
        d.members = t.ids.map(id => d.members.find(m => m.id === id)); if (t.poly) d.plates.poly = t.poly.map(q => q.slice());
    ```

    After:

    ```js
        if (t.mem) { d.members = t.mem.map(o => { const { from, ...ov } = o; return GPR.deepMerge(JSON.parse(JSON.stringify(d.members.find(m => m.id === from))), { ...ov, F: { DC: 0, DW: 0, LL: d.ll.map(() => 0) } }); }); if (t.chord) d.chord = t.chord; }
        else d.members = t.ids.map(id => d.members.find(m => m.id === id)); if (t.poly) d.plates.poly = t.poly.map(q => q.slice());
    ```
  - Download file name (UI click listener, `if (id === 'cad-dl-tpl')`): ``cadDownload(GPDXF.exportTemplate(t.key).text, `gusset_template_${…}.dxf`)`` → ``cadDownload(GPDXF.exportTemplate(t.key).text, t.file || `gusset_template_${…}.dxf`)`` (the file names of the four existing templates are unchanged).
  - `methodHtml()`, "CAD (DXF) exchange": "download a template (3, 4 or 5 members), export" → "download a template (lower chord with 3, 4 or 5 members; upper chord with 4 or 5 members below the chord; heel joint with the chord ending at the joint, chord “spliced”), export".
- **Heel joint: chord mode.** "continuous" needs exactly two chord members (validation error with one), so the heel template uses the existing **"spliced"** mode: the single chord member is checked like a web member for its **full force** through the gusset plates (fastener shear and bearing on all its fasteners, Whitmore yielding / fracture / buckling, block shear), and there is no chord ΔF check. That is the correct load path for a chord that ends at the joint. Results checked (template geometry, test forces 100 kip): L0-L1 W_g = 25.633 (clipped at the bottom edge y = −9 and at the left sloping edge, (1.5, 16.633)); block shear L_vg = 2 × 22.5 = 45.0 (inner row x = 1.5 to the right plate edge x = 24, the chord pulls out to the right), L_tg = 12.0; L0-U1 W_g = 20.236 (clipped both sides), L_mid = (8.384 + 16.874 + 25.114)/3 = 16.790 (two ends stop at the chord fastener field, one at the left plate edge); SP1 (y = 6) carries only L0-U1, demand = F cos 50° = 0.643 F; SP2 (y = −6) has no member on its loaded side ("not applicable"). See open items O14–O17 for what the engineer should confirm.
- **Upper chord (members below).** Every check of `t5u` / `t4u` equals the corresponding check of `t5` / `t4v` (lower chord) with the same forces on corresponding members (all capacities, both methods and directions, all RFs, Whitmore W_g / W_n, L_mid, block-shear lengths), with the loaded shear plane being "below" (SP2) instead of "above" (SP1): automatic planes through the chord fastener lines, demand from the members below. 2D drawing and 3D view (plate below the chord, members pointing down, L_mid arrows up to the chord fastener field) checked in Chromium.
- **Governing provision:** none changed (LRFD 10th Ed. 6.14.2.8 Whitmore and MBE 3rd Ed. 6A.6.12.6.5–6A.6.12.6.8 block shear, partial shear planes and L_mid are applied by the unchanged engine).
- **Check case (hand check, `t5u`, member U2-L3 at 310°):** 6 rows × 4 lines, p = 3, g = 3.5, e = 26, 7/8 in rivets (d_h = 0.9375, d_h + 1/16 = 1.0). g_s = 3 × 3.5 = 10.5, L = 5 × 3 = 15; half width = 5.25 + 15 tan 30° = 13.910; centre c = 26(cos 310°, sin 310°) = (16.713, −19.917), across-member direction v = (0.766, 0.643). End A = c − 13.910 v = (6.057, −28.858) (inside); end B is clipped at the plate edge (24, −9)–(33.25, −28.25) at t = +11.659: B = (25.644, −12.422). **W_g = 13.910 + 11.659 = 25.570 in**, W_n = 25.570 − 4 × 1.0 = **21.570 in** (tool: 25.570 / 21.570). L_mid, direction toward the WP (−0.643, 0.766): from A to the U2-L2 fastener field edge x = 2.5: (6.057 − 2.5)/0.643 = 5.533 (y = −24.62, within −28 … −14); from the midpoint (15.851, −20.640) to the chord fastener field y = −6: (−6 + 20.640)/0.766 = 19.112; from B: (−6 + 12.422)/0.766 = 8.384; **L_mid = (5.533 + 19.112 + 8.384)/3 = 11.010 in** (tool: 11.010; lower-chord L2-U3 in `t5`: 11.010). Before/after: the four existing templates and the default and validation models are unchanged (see How verified).
- **How verified:**
  - `node --check` on every inline script (7 blocks): pass. Script blocks 0–4 (MathJax config, BridgeXfer, project info, `GPR`, `GP3D`) byte-identical to main.
  - Existing templates `t5`, `t4d`, `t4v`, `t3`: exported DXF and `templateModel()` JSON before (main 5c1a078) and after: `cmp` identical. Engine dump (every capacity, RF, warning, shear-plane demand, Whitmore / L_mid / block-shear geometry) for the default and validation models: `cmp` identical.
  - Round trip in node for all 7 templates and the default, validation and variant models (export → parse → `toModel` onto the same model): 0 changes, geometry equal within 1e-6, forces and every RF identical. Importing each new template onto the default 5-member model gives the expected removed-member list and "angle changes … forces kept" warnings (member names are blank in templates and keep the current names, as for the existing templates).
  - ezdxf 1.4.4 `readfile` + `audit` of all 7 template files: 0 errors, 0 fixes.
  - Mirror check in node: `t5` vs `t5u` (23 checks) and `t4v` vs `t4u` (17 checks), same forces: 0 differences after swapping SP1/SP2.
  - jsdom: Template select lists 7 templates; Download for each gives the expected file name and text identical to `GPDXF.exportTemplate()`; localStorage unchanged (only `gussetRating.autosave.v1`); Method tab text; no runtime errors. Phase 3 jsdom CAD test re-run: all pass except its "4 templates" count (now 7, expected).
  - Chromium (Playwright): Drawing tab and 3D view (iso, front) of each new template reviewed; no page errors (only the blocked Google Fonts request).
- **Other copies:** none.
- **Open items (engine behaviour found while checking; not changed, engineer to decide):**
  - O14. (Closed by C6.1, 2026-10-05; rule engineer-confirmed 2026-10-05, see C7.) L_mid at a Whitmore end that lies on the plate edge depends on the edge's orientation: on a bottom horizontal edge the ray runs along the edge (lower-chord L1-L2: 25.5 in), on a sloping edge it is 0 (heel L0-L1: L_mid = (7.5 + 7.5 + 0)/3 = 5.0 in), and on a **top horizontal edge it is NaN ("outside the plate")**. For a continuous chord this does not matter (the chord's Whitmore is not used). It does when the chord is "spliced" at an upper-chord joint: the default model mirrored to an upper chord with CHORD = spliced gives L1-L2-WB / L2-L3-WB capacity NaN and RF NaN, and a NaN RF is skipped when the governing check is picked (the lower-chord equivalent has L_mid = 10.833 in and a finite RF). Unconservative if that check would govern. The new templates do not trigger it (upper-chord templates are continuous; the heel template is a lower chord).
  - O15. (Partly done in C6.3: warning reworded.) Heel joint wording: the "spliced" mode is the right load path, but its texts speak of a splice: the warning "Chord spliced at the joint … any splice plates are ignored … The chord splice check is not in Phase 1", the 3D note "chord spliced at the joint; drawn with a small gap at the work point", and the DXF writer draws a GP-SPLICE line at x = 0 (information layer) in the heel template. Cosmetic; a "chord ends at the joint" option or wording would need a UI/engine change.
  - O16. (Note added in C6.3; no combined check.) Heel joint shear plane SP1 (top chord fastener line): the demand is the end post's horizontal component only. At a heel the vertical component (≈ 0.77 F of the end post) also crosses this plane as a normal force and is not balanced by another member (it goes to the bearing); the partial-shear-plane check (MBE 6A.6.12.6.6) does not combine shear with normal force (the NCHRP W-197 combined check is listed as out of scope). Engineer to confirm whether a combined check or another plane (e.g. vertical, between the chord end and the end post) is needed for heel joints.
  - O17. (Note added in C6.3.) Heel joint equilibrium: with real forces the joint-equilibrium note always shows a residual (the bearing reaction), as for a panel-point load. The chord member is drawn from the WP (member end ≥ 0 in the input), not from its actual end left of the WP.

## 2026-10-05 — PR: claude/gusset-lmid-fix (PR link added after merge)

### C6. L_mid at clipped Whitmore ends, checks that cannot be computed, heel-joint notes   [calculation change: L_mid at clipped Whitmore ends; default and validation results unchanged]

Engineer's decisions (2026-10-05) on open items O14, O16, O17 (see C5).

#### C6.1 L_mid: one rule for every Whitmore point (closes O14)

- **Problem:** the length from a Whitmore end clipped at the plate edge depended on the orientation of that edge. `rayExit()` used the even-odd test `pip()`, which treats a bottom edge as inside and a top edge as outside. Results: on a bottom horizontal edge the ray ran along the edge (lower chord, 25.5 in); on a top horizontal edge it was **NaN** ("outside the plate"); on a sloping edge with the ray pointing out of the plate it was **0** (heel chord: L_mid = (7.5 + 7.5 + 0)/3 = 5.0 in). The NaN made the Whitmore buckling capacity and RF NaN, and the NaN RF was **skipped** when the governing check was picked (unconservative). The 0 shortened L_mid (unconservative).
- **Rule chosen (Method tab and calc sheet):** each of the three points (both Whitmore ends, clipped or not, and the middle) is measured the same way, parallel to the member toward the WP, to the nearest fastener-field outline of another member (a continuous chord's field counts as one, unchanged) or the plate edge, with the plate taken as its **closed** outline:
  1. The plate edge that a clipped end lies on does not stop the line, and a line running along an edge stays in the plate (top and bottom edges now give the same length).
  2. If the plate does not continue from the end toward the WP at all (the end is on an edge or corner and the line would leave the plate at once), the length is measured **along the plate edge** from the end, over the consecutive edges that advance toward the WP, until a fastener-field outline is crossed or the edge turns away (no further advance). The length is the distance gained parallel to the member (projection), so it is comparable with the straight lengths. If neither direction along the edge advances, the length is 0.
  - Why this rule: rule 1 is the existing rule for unclipped ends applied to the closed plate, which removes the edge-orientation dependence without changing any unclipped length. Rule 2 measures the free length of plate beyond the Whitmore section in the member direction at the clipped end; the alternatives were 0 (unconservative, shorter L) or dropping the point from the average (changes the L_mid definition). In every model tested it gave a length no shorter than the old rule wherever the old rule gave a number, and the result depends only on the geometry relative to the point and the member direction, so a mirrored or rotated joint gives the same L_mid.
- **Governing provision (verify):** L_mid = average of L1, L2, L3 per NCHRP Web-Only Document 197 and MBE 3rd Ed. Art. 6A.6.12.6.8 (Whitmore compression, K = 0.5); LRFD 10th Ed. Art. 6.14.2.8 and 6.9.4.1.1 (P_n); LFR: Std. Spec. 17th Ed. Art. 10.54.1.1, FHWA-IF-09-014 (K = 1.2). The documents do not state how to measure from a Whitmore end that lies on the plate edge; the rule above is this tool's interpretation (verify). No formula, factor, K, φ or code reference was changed.
- **Before:** `L_i = rayExit(q, −u, poly)` (NaN when `rayExit` returned null), then the nearest fastener-field crossing.
- **After:** `L_i = lmidLen(q, −u, poly, fields of the other members)` (new geometry function, rules 1 and 2 above).
- **Results that change** (every other result of the 56 models tested is identical, see How verified):
  - Heel template `t2h`, chord L0-L1 (W_g = 25.633 in, both ends clipped): L1/L2/L3 = 7.5 / 7.5 / **0** → 7.5 / 7.5 / **7.5** (top end on the sloping left edge: along the edge to (−6, 9), gain 7.5 in); **L_mid 5.000 → 7.500 in**; L0-L1-WB φP_n LRFR 817.51 → **801.53 kip**, LFR 741.76 → **688.48 kip**.
  - Upper-chord templates `t5u` / `t4u` with CHORD = spliced, chords U1-U2 / U2-U3: the end on the top edge NaN → 25.5 in; **L_mid NaN → 10.833 in** (= lower chord); U1-U2-WB / U2-U3-WB φP_n NaN → **798.66 kip** LRFR, **605.13 kip** LFR.
  - `t5u` / `t4u` continuous: chord L_mid NaN → 18.333 in (= lower chord); not used by any check (no Whitmore checks for a continuous chord).
  - Default model, validation model and the four lower-chord templates (continuous and spliced): **no change** (every capacity, RF, warning, W_g, W_n, L1–L3, L_mid, block-shear length). Governing: default LRFR Inventory 1.172 (L2-U1-FS), LFR Inventory 1.403 (L2-U1-WB); validation 1.564 / 2.109 (D-FS). Validation tab: 17 of 17 match (no hand value changed).
- **Check case (a), heel template `t2h`, chord L0-L1** (0°, 6 rows × 4 lines, p = 4, g = 4, e = 1.5; two 1/2 in A36 plates, E = 29000 ksi): g_s = 12, L = 20, half width = 6 + 20 tan 30° = 17.547 in; Whitmore line x = 1.5, centre y = 0; bottom end clipped at y = −9; top end clipped at the left sloping edge (−6, 9)–(22.125, 37.625): y = 9 + 7.5 × 28.625/28.125 = 16.633; **W_g = 25.633 in**. L1 (bottom end, along the bottom edge y = −9 to x = −6) = 7.5; L2 (middle (1.5, 3.817) to the left edge x = −6) = 7.5; L3 (top end: the line toward −x leaves the plate at once; along the edge to the corner (−6, 9), where the next edge is vertical) gain = 1.5 − (−6) = 7.5. **Before L_mid = (7.5 + 7.5 + 0)/3 = 5.000; after (7.5 + 7.5 + 7.5)/3 = 7.500 in.**
  - LRFR per plate: A_g = 25.633 × 0.5 = 12.817 in², r = 0.5/√12 = 0.14434 in. Before: KL/r = 0.5 × 5.0/0.14434 = 17.32; P_e = π²(29000)(12.817)/17.32² = 12228 kip; P_o = 36 × 12.817 = 461.40; P_e/P_o = 26.50 ≥ 0.44 → P_n = 0.658^(1/26.50) × 461.40 = 454.17; φP_n = 0.90 × 2 × 454.17 = **817.51 kip**. After: KL/r = 25.98; P_e = 5434.6; P_e/P_o = 11.78; P_n = 445.29; φP_n = **801.53 kip**.
  - LFR: C_c = √(2π²E/F_y) = 126.10. Before: KL/r = 1.2 × 5.0/0.14434 = 41.57; F_cr = 36[1 − 36/(4π² × 29000) × 41.57²] = 34.044 ksi; C = 0.85 × 25.633 × 1.0 × 34.044 = **741.76 kip**. After: KL/r = 62.35; F_cr = 31.599; C = **688.48 kip**.
  - RF of L0-L1-WB with test forces (all members compression: DC −100, DW −10, HL-93 −100, HS20 −80 kip): LRFR Inv / Op 3.871 / 5.019 → **3.780 / 4.900**; LFR Inv / Op 3.449 / 5.757 → **3.142 / 5.245**. Governing unchanged: LRFR 2.235 / 2.897 (L0-L1-FS), LFR 0.632 / 1.054 (L0-U1-WB).
- **Check case (b), spliced upper chord** (`t5u`, CHORD = spliced, U1-U2 at 180°, same fasteners as L1-L2): Whitmore line x = −1.5, centre y = 0, ends y = ±17.547; top end clipped at the top edge y = +9: **W_g = 9 + 17.547 = 26.547 in**. L1 (top end, direction +x along the top edge y = 9 to the corner (24, 9)) = 25.5 (before: NaN); L2 (middle (−1.5, −4.274) to the U2-U3 fastener field x = 1.5) = 3.0; L3 (bottom end (−1.5, −17.547) to the U2-L2 field x = 2.5) = 4.0. **L_mid: before NaN; after (25.5 + 3.0 + 4.0)/3 = 10.833 in** (lower chord L1-L2 in `t5` spliced: 10.833, unchanged).
  - LRFR: A_g = 13.274 in²/plate; KL/r = 0.5 × 10.833/0.14434 = 37.53; P_e = 2697.6; P_o = 477.85; P_e/P_o = 5.645; P_n = 443.70; φP_n = 0.90 × 2 × 443.70 = **798.66 kip** (before NaN). LFR: KL/r = 90.07 ≤ 126.10; F_cr = 26.817 ksi; C = 0.85 × 26.547 × 1.0 × 26.817 = **605.13 kip** (before NaN).
  - RF (test forces as in (a)): before NaN (skipped); after LRFR 3.764 / 4.879, LFR 2.662 / 4.444. Governing (U2-L2-FS 0.464 / 0.602 / 1.255 / 2.094) unchanged because the WB check does not govern here; in main it was skipped, so it would not have been reported even if it governed.
- **Check case (c), default and validation models:** no Whitmore end of a member that has Whitmore checks lies on a plate edge with the ray leaving the plate or running along a top edge, so every L1–L3 is unchanged: default L2-U1 / L2-U3 5.533 / 19.112 / 8.384 → L_mid 11.010; L2-U2 8 / 8 / 8 → 8.000; validation D 12.304 / 20.000 / 27.696 → 20.000 (hand value unchanged). No capacity or RF changes; governing RFs as listed above.

#### C6.2 A check that applies but cannot be computed is an error, never skipped

- **Problem:** `gov` (engine), `minRF`, the status bar, Summary, Rating tab, rating matrix, D/C colours (2D and 3D) and the report all reduced RFs with `r.RF < best.r.RF`; a NaN RF never compares lower, so a NaN check was skipped (or, if met first, stuck as "governing" with a NaN shown as "—"). A Whitmore section whose centre is outside the plate dropped the WY/WF/WB checks with only a warning, and a block-shear gage line outside the plate was reported as "not applicable".
- **After:**
  - `rfOne()` returns `null` only when the check is legitimately not applicable for the case (live load effect zero, or of the sign the limit state does not apply to; a check marked `na`, e.g. a shear plane with no member on its loaded side, a single-gage-line block shear). When the check applies but the capacity, dead load demand, live load effect, live load factor, RF or D/C is not finite, or the check itself failed (`c.err`), it returns `{ err: reason }`.
  - Whitmore centre outside the plate: WY, WF and WB checks are created with `err` (the warning is kept). Block shear with an outer gage line outside the plate: `err` instead of `na` (single gage line stays `na`).
  - `gov[j]`: if any check that applies to case j has `err`, the case is **incomplete**: `gov[j] = { c, r, inc, low }` with `c, r` = the first failed check, `inc` = all failed checks, `low` = lowest computed RF (kept for information, not displayed as the rating). `R.incomplete` lists every failed check/case.
  - UI: status bar "Rating incomplete: N checks could not be computed" (error state, "!"), case chips "incomplete"; method tab label "error"; Summary head "Rating incomplete", Lowest rating factor "Incomplete — Not determined", per-case "incomplete" with the failed check ids, a red list of the failed checks with the reason and the cases; member table "error". Checks tab: "error" badge and "Could not be computed: <reason>" alert, error rows in the RF table; "Collapse all but RF < 1 and errors". Rating tab: governing "incomplete / Not determined; could not be computed: <ids>"; matrix cells "error", Governing row "incomplete". D/C colours: a failed check counts as D/C = ∞ (red), captions say "> 1.00 or could not be computed". Report: per-check "not determined … ERROR", Governing line "not determined, rating incomplete".
- **Governing provision:** none changed (MBE 3rd Ed. Eq. 6A.4.2.1-1 and 6B.4.1-1 unchanged; only how a non-number is reported).
- **Check case (1a only, 1b not applied, scratch build):** spliced upper chord `t5u` with the forces of (a)/(b). Main: governing LRFR Inv 0.464 / Op 0.602, LFR Inv 1.255 / Op 2.094 (U2-L2-FS) with U1-U2-WB / U2-U3-WB = NaN silently skipped. 1a alone: all four cases "incomplete (U1-U2-WB, U2-U3-WB): the buckling resistance is not a number (L_mid = not a number, W_g = 26.547 in)", no governing RF shown. 1a + 1b (this PR): 0.464 / 0.602 / 1.255 / 2.094 (U2-L2-FS), U1-U2-WB computed (3.764 / 4.879 / 2.662 / 4.444).
- Results of models with no failed check are unchanged (all 56 dumps: only C6.1 differences).

#### C6.3 Heel-joint notes (text only; closes O16, O17 as notes; O15 in part)

- Joint equilibrium (Forces tab note and Summary card): with one chord member: "The joint has one chord member (the chord ends at the joint, e.g. a heel joint): the residual is the bearing (support) reaction, not an input error."
- Shear planes through a chord fastener line (automatic "above"/"below") when there is one chord member, calc sheet (Checks tab and report): "Heel joint. Shear only. At a heel joint the end-post vertical component (F sin θ) also crosses this plane and is balanced by the bearing reaction; check combined effects separately if they may govern."
- Warning with CHORD = spliced and one chord member: "Chord ends at the joint (single chord member): the chord member is checked like a web member for its full force through the gusset plates (chord mode "spliced at the joint"); there is no chord force-difference (ΔF) check." (two or more chord members: old text). The stored chord value stays "spliced". The 3D note and the DXF GP-SPLICE line (O15) are unchanged.

#### Where (anchors) and exact code

All changes are in `Gusset Plate Rating.html`. Engine (`const GPR`): new `lmidLen()` after `raySeg()` (anchor `function segSeg(a, b, c, d) {`); `compute()` L_mid block (anchor `// L_mid: from the two ends`), block-shear `B.geoErr`, Whitmore-outside error checks (anchor `warn.push(\`Member ${nm}: ${g.W.err}\`)`), block-shear `err`/`na`, heel warning (anchor `P.chord === 'spliced' && chordIdx.length`), `gov` / `incomplete` (anchor `checks.forEach(c => { c.rf = CASES.map`); `capWB()` `why`; `rfOne()` split into `rfOne()` + `rfCalc()`. 3D (`const GP3D`): `govOf` and the colour caption. UI: `eqmNote()`, helpers after `rfBadge`, `minRF`, `chkStatus`, `renderStatus()`, `renderSummary()`, `dcOf()`, `svgDrawing()` (L_mid polyline), `renderDrawing()` caption, `demandHtml()`, `checkBody()`, `renderChecks()`, `ratingMatrix()`, `renderRating()`, `methodHtml()` (L_mid bullet), `buildReport()`.

Exact before/after (unified diff against main 3fd27e8, zero context lines):

```diff
@@ -1325,0 +1326,27 @@ const GPR = (function () {
+  /* L_mid length from a point q of the Whitmore section (an end, clipped or not, or the middle) along the unit direction d (toward the WP), to the nearest
+     fastener-field outline in `stops` or the plate edge. The plate is the closed outline, so the edge a clipped end lies on is not a stop and a ray running
+     along an edge stays in the plate. If the plate does not continue from q in direction d (q on an edge or corner, d pointing out of the plate), the length
+     is measured along the plate edge from q, over the edges that advance in direction d, and is the distance gained in direction d.
+     Orientation-independent: the result depends only on the geometry relative to q and d. */
+  function lmidLen(q, d, poly, stops) {
+    const n = poly.length, cand = [0, ...lineHits(q, d, poly)];
+    poly.forEach(v => { const w = sub(v, q); if (Math.abs(crs(d, w)) < 1e-7) cand.push(dot(w, d)); });
+    const u = []; cand.filter(t => t > -1e-7).sort((a, b) => a - b).forEach(t => { if (!u.length || t - u[u.length - 1] > 1e-7) u.push(t); });
+    let L = 0; for (let k = 0; k + 1 < u.length; k++) { if (!inside(add(q, mul(d, (u[k] + u[k + 1]) / 2)), poly)) break; L = u[k + 1]; }
+    if (L > 1e-7) { let what = 'plate edge';
+      stops.forEach(st => { const fd = st.poly; for (let k = 0; k < fd.length; k++) { const t = raySeg(q, d, fd[k], fd[(k + 1) % fd.length]); if (t != null && t < L - 1e-9) { L = t; what = `fastener line of ${st.name}`; } } });
+      return { L, what, end: add(q, mul(d, L)) }; }
+    // the plate does not continue from q in direction d: walk along the plate edge in both directions, keep the larger gain
+    let vi = poly.findIndex(v => vlen(sub(v, q)) < 1e-6), ei = vi < 0 ? poly.findIndex((a, k) => distSeg(q, a, poly[(k + 1) % n]) < 1e-6) : -1;
+    let best = { L: 0, what: 'plate edge (the plate does not extend toward the work point from this point)', end: q };
+    if (vi < 0 && ei < 0) return best;
+    [1, -1].forEach(s => { let idx = vi >= 0 ? vi + s : (s > 0 ? ei + 1 : ei), cur = q, hit = null; const path = [q];
+      for (let step = 0; step < n; step++) { const v = poly[((idx % n) + n) % n], e = sub(v, cur), le = vlen(e);
+        if (le < 1e-9) { idx += s; continue; }
+        if (dot(e, d) <= 1e-9 * le) break;   // this edge does not advance toward the work point
+        let tm = 1, w = null; stops.forEach(st => { const fd = st.poly; for (let k = 0; k < fd.length; k++) { const t = raySeg(cur, e, fd[k], fd[(k + 1) % fd.length]); if (t != null && t < tm) { tm = t; w = st.name; } } });
+        if (w) { hit = w; cur = add(cur, mul(e, tm)); path.push(cur); break; }
+        cur = v; path.push(cur); idx += s; }
+      const L = dot(sub(cur, q), d);
+      if (L > best.L + 1e-9) best = { L, what: hit ? `fastener line of ${hit}, measured along the plate edge` : 'plate edge, measured along the edge', end: cur, path }; });
+    return best; }
@@ -1474,5 +1501,3 @@ const GPR = (function () {
-        // L_mid: from the two ends and the middle of the Whitmore section, parallel to the member, toward the work point
-        const dir = mul(g.u, -1), pts = [['end 1', W.A], ['middle', add(W.A, mul(sub(W.B, W.A), 0.5))], ['end 2', W.B]];
-        W.L3 = pts.map(([nm, q]) => { let best = rayExit(q, dir, poly), what = 'plate edge'; if (best == null) { best = NaN; what = 'outside the plate'; }
-          stops.forEach(st => { if (st.j.includes(i)) return; const fd = st.poly; for (let k = 0; k < 4; k++) { const t = raySeg(q, dir, fd[k], fd[(k + 1) % 4]); if (t != null && t < best - 1e-9) { best = t; what = `fastener line of ${st.name}`; } } });
-          return { nm, q, L: best, what, end: add(q, mul(dir, best)) }; });
+        // L_mid: from the two ends (clipped or not) and the middle of the Whitmore section, parallel to the member, toward the work point (same rule for every point: lmidLen)
+        const dir = mul(g.u, -1), pts = [['end 1', W.A], ['middle', add(W.A, mul(sub(W.B, W.A), 0.5))], ['end 2', W.B]], other = stops.filter(st => !st.j.includes(i));
+        W.L3 = pts.map(([nm, q]) => ({ nm, q, ...lmidLen(q, dir, poly, other) }));
@@ -1486 +1511 @@ const GPR = (function () {
-        if (L1 == null || L2 == null) { B.ok = false; B.why = 'An outer gage line at the inner row is outside the plate.'; }
+        if (L1 == null || L2 == null) { B.ok = false; B.geoErr = true; B.why = 'An outer gage line at the inner row is outside the plate.'; }
@@ -1575 +1600 @@ const GPR = (function () {
-        where: [whitWhere(g), wr('L<sub>mid</sub>', `Average of L<sub>1</sub>, L<sub>2</sub>, L<sub>3</sub> from the Whitmore ends and middle toward the work point, parallel to the member: ${W.L3.map(z => `${f3(z.L)} (${escH(z.what)})`).join(', ')}${W.ovL != null ? ' (overridden)' : ''}`, f3(L), 'in', W.ovL != null ? 'Override' : 'NCHRP W-197; MBE 6A.6.12.6.8'),
+        where: [whitWhere(g), wr('L<sub>mid</sub>', `Average of L<sub>1</sub>, L<sub>2</sub>, L<sub>3</sub> from the Whitmore ends and middle toward the work point, parallel to the member: ${W.L3.map(z => `${f3(z.L)} (${escH(z.what)})`).join(', ')}${W.ovL != null ? ' (overridden)' : ''}${W.clipA || W.clipB ? `. Whitmore end clipped at the plate edge: measured by the same rule as an unclipped end; the plate edge the end lies on does not stop the line${W.L3.some(z => z.path) ? ', and where the plate does not continue toward the work point from that end the length is measured along the plate edge (distance gained parallel to the member)' : ''}` : ''}`, f3(L), 'in', W.ovL != null ? 'Override' : 'NCHRP W-197; MBE 6A.6.12.6.8'),
@@ -1577 +1602 @@ const GPR = (function () {
-        keys: ['thW', 'E', lrfr ? 'K' : 'KL', lrfr ? 'phiC' : 'phiCL'], per, Pn }; }
+        keys: ['thW', 'E', lrfr ? 'K' : 'KL', lrfr ? 'phiC' : 'phiCL'], per, Pn, ...(isFinite(C) ? {} : { why: `the buckling resistance is not a number (L_mid = ${isFinite(L) ? f3(L) + ' in' : 'not a number'}, W_g = ${isFinite(W.Wg) ? f3(W.Wg) + ' in' : 'not a number'})` }) }; }
@@ -1622 +1647,4 @@ const GPR = (function () {
-      } else warn.push(`Member ${nm}: ${g.W.err}`);
+      } else { warn.push(`Member ${nm}: ${g.W.err}`); const why = `${g.W.err} The Whitmore section could not be placed.`;
+        mk({ id: `${nm}-WY`, ls: 'wy', grp: 'Whitmore tension', mem: i, who: nm, title: `${nm}: Whitmore section, tension yielding`, dirs: '+', dem, err: why, cap: {} });
+        mk({ id: `${nm}-WF`, ls: 'wf', grp: 'Whitmore tension', mem: i, who: nm, title: `${nm}: Whitmore section, tension fracture`, dirs: '+', dem, err: why, cap: {} });
+        mk({ id: `${nm}-WB`, ls: 'wb', grp: 'Whitmore compression', mem: i, who: nm, title: `${nm}: Whitmore section, compression buckling`, dirs: '-', dem, err: why, cap: {} }); }
@@ -1624 +1652 @@ const GPR = (function () {
-      else mk({ id: `${nm}-BS`, ls: 'bs', grp: 'Block shear', mem: i, who: nm, title: `${nm}: block shear rupture (tension)`, dirs: '+', dem, na: g.B.why, cap: {} });
+      else mk({ id: `${nm}-BS`, ls: 'bs', grp: 'Block shear', mem: i, who: nm, title: `${nm}: block shear rupture (tension)`, dirs: '+', dem, ...(g.B.geoErr ? { err: g.B.why } : { na: g.B.why }), cap: {} });
@@ -1636 +1664,2 @@ const GPR = (function () {
-    } else if (P.chord === 'spliced' && chordIdx.length) warn.push('Chord spliced at the joint: each chord member is checked like a web member for its full force through the gusset plates only; any splice plates are ignored (conservative). The chord splice check is not in Phase 1.');
+    } else if (P.chord === 'spliced' && chordIdx.length === 1) warn.push('Chord ends at the joint (single chord member): the chord member is checked like a web member for its full force through the gusset plates (chord mode "spliced at the joint"); there is no chord force-difference (ΔF) check.');
+    else if (P.chord === 'spliced' && chordIdx.length) warn.push('Chord spliced at the joint: each chord member is checked like a web member for its full force through the gusset plates only; any splice plates are ignored (conservative). The chord splice check is not in Phase 1.');
@@ -1648,2 +1677,6 @@ const GPR = (function () {
-    const gov = CASES.map((cs, j) => { let best = null; checks.forEach(c => { const r = c.rf[j]; if (r && (!best || r.RF < best.r.RF)) best = { c, r }; }); return best; });
-    return { errors: [], warnings: warn, P, p, poly, ts, Np, Fy, Fu, G, holes, planes, checks, cases: CASES, gov, eqm, span, stops };
+    // governing check per case. A check that applies to the case but could not be computed (r.err) is never skipped: the case is then incomplete,
+    // gov[j] = { c, r } of the first failed check (r.err set), inc = every failed check, low = lowest computed RF (for information only).
+    const gov = CASES.map((cs, j) => { let best = null; const inc = []; checks.forEach(c => { const r = c.rf[j]; if (!r) return; if (r.err) { inc.push({ c, r }); return; } if (!best || r.RF < best.r.RF) best = { c, r }; });
+      return inc.length ? { c: inc[0].c, r: inc[0].r, inc, low: best } : best ? { ...best, inc } : null; });
+    const incomplete = checks.flatMap(c => c.rf.map((r, j) => r && r.err ? { c, j, err: r.err } : null).filter(Boolean));
+    return { errors: [], warnings: warn, P, p, poly, ts, Np, Fy, Fu, G, holes, planes, checks, cases: CASES, gov, incomplete, eqm, span, stops };
@@ -1658 +1691,3 @@ const GPR = (function () {
-  function rfOne(c, cs, p, fac) { const L = c.dem.LL[cs.k]; if (!isFinite(L) || Math.abs(L) < 1e-9) return null;
+  /* rating factor of check c for rating case cs: null = not applicable (no live load effect, or the limit state does not apply in its direction);
+     { err } = applies but could not be computed (non-finite capacity, demand, factor, RF or D/C, or the check itself failed: c.err) */
+  function rfOne(c, cs, p, fac) { const L = c.dem.LL[cs.k]; if (!isFinite(L)) return { err: `the live load effect (${cs.name}) is not a number` }; if (Math.abs(L) < 1e-9) return null;
@@ -1659,0 +1695 @@ const GPR = (function () {
+    if (c.err) return { err: c.err };
@@ -1660,0 +1697,4 @@ const GPR = (function () {
+    const r = rfCalc(c, cs, p, fac, cap, d, L), why = !isFinite(cap.C) ? (cap.why || `the resistance is not a number (C = ${cap.C})`) : !(isFinite(r.DC ?? r.D) && isFinite(r.DW ?? 0)) ? 'the dead load demand is not a number'
+      : !isFinite(cs.g) ? 'the live load factor is not a number' : !isFinite(r.RF) ? `the rating factor is not a number (RF = ${r.RF})` : !isFinite(r.DCr) ? `D/C is not a number (resistance C = ${f1(r.C)} kip)` : '';
+    return why ? { ...r, err: why } : r; }
+  function rfCalc(c, cs, p, fac, cap, d, L) {
@@ -1857 +1897 @@ const GP3D = (function () {
-    const govOf = pred => { let b = null; R.checks.forEach(c => { if (!pred(c)) return; const r = c.rf[j]; if (r && (!b || r.DCr > b.dc)) b = { dc: r.DCr, id: c.id }; }); return b; };
+    const govOf = pred => { let b = null; R.checks.forEach(c => { if (!pred(c)) return; const r = c.rf[j]; const dc = r && (r.err ? Infinity : r.DCr); if (r && (!b || dc > b.dc)) b = { dc, id: c.id }; }); return b; };   // could not be computed: Infinity (red)
@@ -2011 +2051 @@ const GP3D = (function () {
-    c.innerHTML = (V.useDC && cs ? `Colours: governing D/C for <b>${esc(cs.label)}</b> (members: all their limit states; plates: Whitmore, block shear and shear planes; fasteners: shear and bearing): <span style="color:${DCOL.pass}">■</span> ≤ 0.85, <span style="color:${DCOL.warn}">■</span> 0.85 to 1.00, <span style="color:${DCOL.fail}">■</span> &gt; 1.00, <span style="color:${DCOL.na}">■</span> not applicable for this case. ` : '')
+    c.innerHTML = (V.useDC && cs ? `Colours: governing D/C for <b>${esc(cs.label)}</b> (members: all their limit states; plates: Whitmore, block shear and shear planes; fasteners: shear and bearing): <span style="color:${DCOL.pass}">■</span> ≤ 0.85, <span style="color:${DCOL.warn}">■</span> 0.85 to 1.00, <span style="color:${DCOL.fail}">■</span> &gt; 1.00 or could not be computed, <span style="color:${DCOL.na}">■</span> not applicable for this case. ` : '')
@@ -2721 +2761,3 @@ function updateAuto() { $$('[data-auto]').forEach(el => { const [a, i, k] = el.d
-function eqmNote() { const bad = R.eqm.filter(e => e.rel > 0.02); return `<p class="hint${bad.length ? '' : ' static'}">Joint equilibrium of the member forces (ΣF): ${R.eqm.map(e => `${esc(e.name)} ${f1(e.R)} kip`).join(', ')}.${bad.length ? ' A residual can be an applied panel-point load (e.g. a floorbeam reaction); otherwise check the forces. Shear-plane demands use only the members on the loaded side.' : ''}</p>`; }
+const oneChord = () => P.members.filter(m => m.role === 'chord').length === 1;   // chord ends at the joint (heel joint)
+const HEEL_EQM = 'The joint has one chord member (the chord ends at the joint, e.g. a heel joint): the residual is the bearing (support) reaction, not an input error.';
+function eqmNote() { const bad = R.eqm.filter(e => e.rel > 0.02); return `<p class="hint${bad.length ? '' : ' static'}">Joint equilibrium of the member forces (ΣF): ${R.eqm.map(e => `${esc(e.name)} ${f1(e.R)} kip`).join(', ')}.${bad.length ? (oneChord() ? ' ' + HEEL_EQM + ' Shear-plane demands use only the members on the loaded side.' : ' A residual can be an applied panel-point load (e.g. a floorbeam reaction); otherwise check the forces. Shear-plane demands use only the members on the loaded side.') : ''}</p>`; }
@@ -2735,2 +2777,3 @@ const caseIdx = () => R.cases.map((c, j) => j);
-function minRF(c) { let b = null; c.rf.forEach((r, j) => { if (r && (!b || r.RF < b.r.RF)) b = { r, j }; }); return b; }
-function chkStatus(c) { if (c.na) return 'na'; const b = minRF(c); return b ? rfCls(b.r.RF) : 'na'; }
+/* lowest RF of a check over the cases; a case that applies but could not be computed (r.err) comes first and is never skipped */
+function minRF(c) { let b = null; c.rf.forEach((r, j) => { if (!r) return; if (r.err) { if (!b || !b.r.err) b = { r, j }; return; } if (b && b.r.err) return; if (!b || r.RF < b.r.RF) b = { r, j }; }); return b; }
+function chkStatus(c) { if (c.na) return 'na'; const b = minRF(c); return b ? rCls(b.r) : 'na'; }
@@ -2737,0 +2781,7 @@ const rfBadge = (rf, lbl) => rf == null ? '<span class="badge na">n/a</span>' :
+const ERR_BADGE = '<span class="badge fail" title="Could not be computed">error</span>';
+const rCls = r => r == null ? 'na' : r.err ? 'fail' : rfCls(r.RF);                 // class of one rating result (error = fail colour)
+const rTxt = r => r == null ? '—' : r.err ? 'error' : f2(r.RF);                    // text of one rating result
+const govInc = g => !!(g && g.inc && g.inc.length);                               // rating case incomplete (a check that applies could not be computed)
+const govTxt = g => !g ? '—' : govInc(g) ? 'incomplete' : f2(g.r.RF);
+const govIds = g => !g ? '' : govInc(g) ? g.inc.map(x => x.c.id).join(', ') : g.c.id;
+const incNote = () => { const n = new Set(R.incomplete.map(x => x.c.id)).size; return n ? `${n} check${n > 1 ? 's' : ''} could not be computed` : ''; };
@@ -2741,3 +2791,3 @@ function renderStatus() {
-  const low = R.gov.filter(Boolean), worst = low.slice().sort((a, b) => a.r.RF - b.r.RF)[0], nFail = low.filter(g => g.r.RF < 1).length;
-  const v = !worst ? { cls: 'pass', ico: '–', t: 'No live load effect to rate' } : nFail ? { cls: 'fail', ico: '✕', t: `${nFail} rating case${nFail > 1 ? 's' : ''} with RF < 1.00` } : { cls: 'pass', ico: '✓', t: 'All rating factors ≥ 1.00' };
-  const chips = R.cases.map((c, j) => { const g = R.gov[j]; return `<button type="button" class="chip ${g ? rfCls(g.r.RF) : ''}" data-goto="${g ? g.c.id : ''}" title="${esc(c.label)}${g ? ': ' + esc(g.c.title) : ''}"><b>${g ? f2(g.r.RF) : '—'}</b>${esc(c.meth.toUpperCase())} ${esc(c.lvl)}, ${esc(c.name)}</button>`; }).join('');
+  const low = R.gov.filter(g => g && !govInc(g)), worst = low.slice().sort((a, b) => a.r.RF - b.r.RF)[0], nFail = low.filter(g => g.r.RF < 1).length;
+  const v = R.incomplete.length ? { cls: 'fail', ico: '!', t: `Rating incomplete: ${incNote()}` } : !worst ? { cls: 'pass', ico: '–', t: 'No live load effect to rate' } : nFail ? { cls: 'fail', ico: '✕', t: `${nFail} rating case${nFail > 1 ? 's' : ''} with RF < 1.00` } : { cls: 'pass', ico: '✓', t: 'All rating factors ≥ 1.00' };
+  const chips = R.cases.map((c, j) => { const g = R.gov[j]; return `<button type="button" class="chip ${g ? rCls(g.r) : ''}" data-goto="${g ? g.c.id : ''}" title="${esc(c.label)}${g ? ': ' + (govInc(g) ? 'incomplete, could not be computed: ' + esc(govIds(g)) : esc(g.c.title)) : ''}"><b>${govTxt(g)}</b>${esc(c.meth.toUpperCase())} ${esc(c.lvl)}, ${esc(c.name)}</button>`; }).join('');
@@ -2745 +2795 @@ function renderStatus() {
-  ['both', 'lrfr', 'lfr'].forEach(m => { const el = document.querySelector(`.mtab-s[data-s="${m}"]`); if (!el) return; const gs = R.gov.filter((g, j) => g && (m === 'both' || R.cases[j].meth === m)); const mn = gs.length ? Math.min(...gs.map(g => g.r.RF)) : null; el.textContent = P.method === m && mn != null ? f2(mn) : ''; el.className = 'mtab-s' + (P.method === m && mn != null ? (mn < 1 ? ' fail' : mn < 1.2 ? ' warn' : ' pass') : ''); });
+  ['both', 'lrfr', 'lfr'].forEach(m => { const el = document.querySelector(`.mtab-s[data-s="${m}"]`); if (!el) return; const gs = R.gov.filter((g, j) => g && (m === 'both' || R.cases[j].meth === m)); if (gs.some(govInc)) { el.textContent = P.method === m ? 'error' : ''; el.className = 'mtab-s' + (P.method === m ? ' err' : ''); return; } const mn = gs.length ? Math.min(...gs.map(g => g.r.RF)) : null; el.textContent = P.method === m && mn != null ? f2(mn) : ''; el.className = 'mtab-s' + (P.method === m && mn != null ? (mn < 1 ? ' fail' : mn < 1.2 ? ' warn' : ' pass') : ''); });
@@ -2751,2 +2801,2 @@ function renderSummary() {
-  const low = R.gov.filter(Boolean), worst = low.slice().sort((a, b) => a.r.RF - b.r.RF)[0], nFail = low.filter(g => g.r.RF < 1).length;
-  const head = `<div class="sc"><div class="sc-head ${nFail ? 'fail' : 'pass'}"><div class="sc-verdict"><span class="sc-ico">${nFail ? '✕' : '✓'}</span><div><h2>${nFail ? `${nFail} of ${R.cases.length} rating case${R.cases.length > 1 ? 's' : ''} below 1.00` : low.length ? 'All rating factors are at least 1.00' : 'No rating cases'}</h2>
+  const low = R.gov.filter(g => g && !govInc(g)), worst = low.slice().sort((a, b) => a.r.RF - b.r.RF)[0], nFail = low.filter(g => g.r.RF < 1).length, nInc = R.gov.filter(govInc).length, inc = nInc > 0;
+  const head = `<div class="sc"><div class="sc-head ${nFail || inc ? 'fail' : 'pass'}"><div class="sc-verdict"><span class="sc-ico">${inc ? '!' : nFail ? '✕' : '✓'}</span><div><h2>${inc ? `Rating incomplete: ${incNote()} (${nInc} of ${R.cases.length} rating case${R.cases.length > 1 ? 's' : ''} affected)` : nFail ? `${nFail} of ${R.cases.length} rating case${R.cases.length > 1 ? 's' : ''} below 1.00` : low.length ? 'All rating factors are at least 1.00' : 'No rating cases'}</h2>
@@ -2754,2 +2804,2 @@ function renderSummary() {
-    <div class="sc-gov"><div class="k">Lowest rating factor</div><div class="v ${worst && worst.r.RF < 1 ? 'fail' : 'pass'}">${worst ? f2(worst.r.RF) : '—'}</div><div class="w">${worst ? `${esc(R.cases[R.gov.indexOf(worst)].label)}; ${esc(worst.c.id)}` : ''}</div></div></div>
-    <div class="kq">${R.cases.map((c, j) => { const g = R.gov[j]; return `<div><span>${esc(c.label)}</span><b class="${g ? 'n-' + rfCls(g.r.RF) : ''}">${g ? f2(g.r.RF) : '—'}</b> <small class="n-dim">${g ? esc(g.c.id) : ''}</small></div>`; }).join('')}</div></div>`;
+    <div class="sc-gov"><div class="k">Lowest rating factor</div>${inc ? `<div class="v fail">Incomplete</div><div class="w">Not determined: ${esc(incNote())}; see below.</div>` : `<div class="v ${worst && worst.r.RF < 1 ? 'fail' : 'pass'}">${worst ? f2(worst.r.RF) : '—'}</div><div class="w">${worst ? `${esc(R.cases[R.gov.indexOf(worst)].label)}; ${esc(worst.c.id)}` : ''}</div>`}</div></div>
+    <div class="kq">${R.cases.map((c, j) => { const g = R.gov[j]; return `<div><span>${esc(c.label)}</span><b class="${g ? 'n-' + rCls(g.r) : ''}">${govTxt(g)}</b> <small class="n-dim">${g ? esc(govIds(g)) : ''}</small></div>`; }).join('')}</div></div>`;
@@ -2756,0 +2807 @@ function renderSummary() {
+  const errC = R.incomplete.length ? `<div class="alert fail"><b>Rating incomplete. These checks apply but could not be computed; the governing rating factor of the affected cases is not determined.</b><ul class="err-list">${[...new Set(R.incomplete.map(x => x.c))].map(c => `<li><a href="#" data-goto="${esc(c.id)}">${esc(c.id)}</a> (${esc(c.title)}): could not be computed: ${esc(R.incomplete.find(x => x.c === c).err)}. Cases: ${R.incomplete.filter(x => x.c === c).map(x => esc(R.cases[x.j].label)).join('; ')}.</li>`).join('')}</ul></div>` : '';
@@ -2760 +2811 @@ function renderSummary() {
-  who.forEach(w => { const cs = R.checks.filter(c => c.who === w && !c.na); if (!cs.length) return; rows.push(`<tr><td class="lbl">${esc(w)}</td>${R.cases.map((cc, j) => { let b = null; cs.forEach(c => { const r = c.rf[j]; if (r && (!b || r.RF < b.r.RF)) b = { r, c }; }); const gov = b && R.gov[j] && R.gov[j].c === b.c; return `<td class="val${gov ? ' govc' : ''}">${b ? `<a href="#" data-goto="${b.c.id}" class="n-${rfCls(b.r.RF)}">${f2(b.r.RF)}</a> <small class="n-dim">${b.c.id.split('-').pop()}</small>` : '—'}</td>`; }).join('')}</tr>`); });
+  who.forEach(w => { const cs = R.checks.filter(c => c.who === w && !c.na); if (!cs.length) return; rows.push(`<tr><td class="lbl">${esc(w)}</td>${R.cases.map((cc, j) => { let b = null; cs.forEach(c => { const r = c.rf[j]; if (!r || (b && b.r.err)) return; if (r.err || !b || r.RF < b.r.RF) b = { r, c }; }); const gov = b && R.gov[j] && R.gov[j].c === b.c; return `<td class="val${gov ? ' govc' : ''}">${b ? `<a href="#" data-goto="${b.c.id}" class="n-${rCls(b.r)}">${rTxt(b.r)}</a> <small class="n-dim">${b.c.id.split('-').pop()}</small>` : '—'}</td>`; }).join('')}</tr>`); });
@@ -2762 +2813 @@ function renderSummary() {
-  const eqmC = card('sum-eqm', 'Joint equilibrium of the entered forces', '', `<table class="tbl narrow"><thead><tr><th>Load</th><th class="right">ΣF<sub>x</sub> (kip)</th><th class="right">ΣF<sub>y</sub> (kip)</th><th class="right">|ΣF| / max |F|</th></tr></thead><tbody>${R.eqm.map(e => `<tr><td class="lbl">${esc(e.name)}</td><td class="val">${f1(e.Rx)}</td><td class="val">${f1(e.Ry)}</td><td class="val">${f3(e.rel)}</td></tr>`).join('')}</tbody></table><p class="note-p">ΣF of the member forces acting on the joint (F u, with u pointing from the work point along each member). A residual is the applied panel-point load (for example a floorbeam reaction) or an inconsistency in the forces.</p>`);
+  const eqmC = card('sum-eqm', 'Joint equilibrium of the entered forces', '', `<table class="tbl narrow"><thead><tr><th>Load</th><th class="right">ΣF<sub>x</sub> (kip)</th><th class="right">ΣF<sub>y</sub> (kip)</th><th class="right">|ΣF| / max |F|</th></tr></thead><tbody>${R.eqm.map(e => `<tr><td class="lbl">${esc(e.name)}</td><td class="val">${f1(e.Rx)}</td><td class="val">${f1(e.Ry)}</td><td class="val">${f3(e.rel)}</td></tr>`).join('')}</tbody></table><p class="note-p">ΣF of the member forces acting on the joint (F u, with u pointing from the work point along each member). A residual is the applied panel-point load (for example a floorbeam reaction) or an inconsistency in the forces.${oneChord() ? ' ' + HEEL_EQM : ''}</p>`);
@@ -2764 +2815 @@ function renderSummary() {
-  $('#tab-summary').innerHTML = vfy + head + tbl + warns + eqmC + scope;
+  $('#tab-summary').innerHTML = vfy + head + errC + tbl + warns + eqmC + scope;
@@ -2771 +2822 @@ const dcCls = dc => dc == null ? 'na' : dc > 1 + 1e-9 ? 'fail' : dc > 0.85 ? 'wa
-function dcOf(ids) { const j = +P.ui.dcCase || 0; let mx = null; ids.forEach(id => { const c = R.checks.find(q => q.id === id); const r = c && c.rf[j]; if (r && (mx == null || r.DCr > mx)) mx = r.DCr; }); return mx; }
+function dcOf(ids) { const j = +P.ui.dcCase || 0; let mx = null; ids.forEach(id => { const c = R.checks.find(q => q.id === id); const r = c && c.rf[j]; const dc = r && (r.err ? Infinity : r.DCr); if (r && (mx == null || dc > mx)) mx = dc; }); return mx; }   // could not be computed: Infinity (red)
@@ -2796 +2847 @@ function svgDrawing(opt = {}) {
-    if (V.lmid && W.ok && W.L3) W.L3.forEach(z => { if (!isFinite(z.L)) return; h += `<line x1="${X(z.q[0])}" y1="${Y(z.q[1])}" x2="${X(z.end[0])}" y2="${Y(z.end[1])}" stroke="#7048e8" stroke-width="${sw * 0.8}" marker-end="url(#gp-arr)"><title>${esc(m.id)} ${z.nm}: ${f2(z.L)} in to ${esc(z.what)}</title></line>`; });
+    if (V.lmid && W.ok && W.L3) W.L3.forEach(z => { if (!isFinite(z.L)) return; h += z.path ? `<polyline points="${z.path.map(pt).join(' ')}" fill="none" stroke="#7048e8" stroke-width="${sw * 0.8}" marker-end="url(#gp-arr)"><title>${esc(m.id)} ${z.nm}: ${f2(z.L)} in to ${esc(z.what)}</title></polyline>` : `<line x1="${X(z.q[0])}" y1="${Y(z.q[1])}" x2="${X(z.end[0])}" y2="${Y(z.end[1])}" stroke="#7048e8" stroke-width="${sw * 0.8}" marker-end="url(#gp-arr)"><title>${esc(m.id)} ${z.nm}: ${f2(z.L)} in to ${esc(z.what)}</title></line>`; });
@@ -2815 +2866 @@ function renderDrawing() {
-    <p class="cap">${V.dc ? `Colours: D/C for <b>${cs ? esc(cs.label) : '—'}</b> (choose the case on the Rating input tab): <span style="color:${DCOL.pass}">■</span> ≤ 0.85, <span style="color:${DCOL.warn}">■</span> 0.85 to 1.00, <span style="color:${DCOL.fail}">■</span> &gt; 1.00, <span style="color:${DCOL.na}">■</span> not applicable for this case. ` : ''}Thick line: Whitmore section (clipped at the plate edge); thin dashed lines: 30° spread from the outer fasteners of the row farthest from the work point. Violet arrows: L<sub>1</sub>, L<sub>2</sub>, L<sub>3</sub> for L<sub>mid</sub>. Dotted: block-shear path. Dashed: partial shear planes. Scroll to zoom, drag to pan, hover for values.</p>`)
+    <p class="cap">${V.dc ? `Colours: D/C for <b>${cs ? esc(cs.label) : '—'}</b> (choose the case on the Rating input tab): <span style="color:${DCOL.pass}">■</span> ≤ 0.85, <span style="color:${DCOL.warn}">■</span> 0.85 to 1.00, <span style="color:${DCOL.fail}">■</span> &gt; 1.00 or could not be computed, <span style="color:${DCOL.na}">■</span> not applicable for this case. ` : ''}Thick line: Whitmore section (clipped at the plate edge); thin dashed lines: 30° spread from the outer fasteners of the row farthest from the work point. Violet arrows: L<sub>1</sub>, L<sub>2</sub>, L<sub>3</sub> for L<sub>mid</sub>. Dotted: block-shear path. Dashed: partial shear planes. Scroll to zoom, drag to pan, hover for values.</p>`)
@@ -2845 +2896 @@ function demandHtml(c) {
-  return `<p class="note-p"><b>Demand.</b> ${what}.</p><div class="tscroll"><table class="tbl narrow"><thead><tr><th>Load</th><th class="right">Value (kip)</th></tr></thead><tbody><tr><td class="lbl">DC</td><td class="val">${f2(c.dem.DC)}</td></tr><tr><td class="lbl">DW</td><td class="val">${f2(c.dem.DW)}</td></tr>${P.ll.map((l, k) => `<tr><td class="lbl">${esc(l.name)} (LL+IM)</td><td class="val">${f2(c.dem.LL[k])}</td></tr>`).join('')}</tbody></table></div>${c.mem != null ? '' : `<p class="note-p"><b>Live load concurrency.</b> ${CONC_NOTE}</p>`}`;
+  return `<p class="note-p"><b>Demand.</b> ${what}.</p><div class="tscroll"><table class="tbl narrow"><thead><tr><th>Load</th><th class="right">Value (kip)</th></tr></thead><tbody><tr><td class="lbl">DC</td><td class="val">${f2(c.dem.DC)}</td></tr><tr><td class="lbl">DW</td><td class="val">${f2(c.dem.DW)}</td></tr>${P.ll.map((l, k) => `<tr><td class="lbl">${esc(l.name)} (LL+IM)</td><td class="val">${f2(c.dem.LL[k])}</td></tr>`).join('')}</tbody></table></div>${c.mem != null ? '' : `<p class="note-p"><b>Live load concurrency.</b> ${CONC_NOTE}</p>`}${c.plane != null && oneChord() && ['above', 'below'].includes(R.planes[c.plane].kind) ? `<p class="note-p"><b>Heel joint.</b> ${HEEL_SP}</p>` : ''}`;
@@ -2846,0 +2898 @@ function demandHtml(c) {
+const HEEL_SP = 'Shear only. At a heel joint the end-post vertical component (F sin θ) also crosses this plane and is balanced by the bearing reaction; check combined effects separately if they may govern.';
@@ -2850 +2902,3 @@ function checkBody(c, opt = {}) {
-  let b = demandHtml(c);
+  const errs = R.cases.map((cs, j) => [cs, c.rf[j]]).filter(([cs, r]) => r && r.err);
+  if (c.err) return `<div class="alert fail"><b>Could not be computed:</b> ${esc(c.err)}${errs.length ? ` Rating cases affected (rating incomplete): ${errs.map(([cs]) => esc(cs.label)).join('; ')}.` : ' No rating case has a live load effect in the direction this limit state applies to.'}</div>` + demandHtml(c);
+  let b = (errs.length ? `<div class="alert fail"><b>Could not be computed</b> for ${errs.map(([cs, r]) => `${esc(cs.label)}: ${esc(r.err)}`).join('; ')}. The rating is incomplete for ${errs.length > 1 ? 'these cases' : 'this case'}.</div>` : '') + demandHtml(c);
@@ -2854 +2908 @@ function checkBody(c, opt = {}) {
-    const rows = R.cases.map((cs, j) => [cs, c.rf[j], j]).filter(([cs, r]) => cs.meth === meth && r);
+    const rowsAll = R.cases.map((cs, j) => [cs, c.rf[j], j]).filter(([cs, r]) => cs.meth === meth && r), rows = rowsAll.filter(([cs, r]) => !r.err), rowsErr = rowsAll.filter(([cs, r]) => r.err);
@@ -2855,0 +2910,2 @@ function checkBody(c, opt = {}) {
+    const errTr = rowsErr.map(([cs, r]) => `<tr><td class="lbl">${esc(cs.lvl)}, ${esc(cs.name)}</td><td class="val">${f1(r.C)}</td><td class="val">—</td><td class="val n-fail" title="${esc(r.err)}">error</td></tr>`).join('');
+    if (rowsErr.length && !rows.length) b += `<div class="tscroll"><table class="tbl narrow"><thead><tr><th>Rating case</th><th class="right">C (kip)</th><th class="right">D/C</th><th class="right">RF</th></tr></thead><tbody>${errTr}</tbody></table></div>`;
@@ -2859 +2915 @@ function checkBody(c, opt = {}) {
-      b += `<div class="tscroll"><table class="tbl narrow"><thead><tr><th>Rating case</th><th class="right">C (kip)</th><th class="right">D/C</th><th class="right">RF</th></tr></thead><tbody>${rows.map(([cs, r]) => `<tr class="${r === g[1] ? 'gov' : ''}"><td class="lbl">${esc(cs.lvl)}, ${esc(cs.name)}${r === g[1] && rows.length > 1 ? ' <span class="gov-tag">lowest</span>' : ''}</td><td class="val">${f1(r.C)}</td><td class="val">${f3(r.DCr)}</td><td class="val n-${rfCls(r.RF)}">${f2(r.RF)}</td></tr>`).join('')}</tbody></table></div>`; }
+      b += `<div class="tscroll"><table class="tbl narrow"><thead><tr><th>Rating case</th><th class="right">C (kip)</th><th class="right">D/C</th><th class="right">RF</th></tr></thead><tbody>${rows.map(([cs, r]) => `<tr class="${r === g[1] ? 'gov' : ''}"><td class="lbl">${esc(cs.lvl)}, ${esc(cs.name)}${r === g[1] && rows.length > 1 ? ' <span class="gov-tag">lowest</span>' : ''}</td><td class="val">${f1(r.C)}</td><td class="val">${f3(r.DCr)}</td><td class="val n-${rfCls(r.RF)}">${f2(r.RF)}</td></tr>`).join('')}${errTr}</tbody></table></div>`; }
@@ -2867 +2923 @@ function renderChecks() {
-  let h = `<div class="ctl-row"><button type="button" class="dg-btn" data-exp="checks">Expand all</button><button type="button" class="dg-btn" data-col="checks">Collapse all</button><button type="button" class="dg-btn" id="col-ok">Collapse all but RF &lt; 1</button></div>`;
+  let h = `<div class="ctl-row"><button type="button" class="dg-btn" data-exp="checks">Expand all</button><button type="button" class="dg-btn" data-col="checks">Collapse all</button><button type="button" class="dg-btn" id="col-ok">Collapse all but RF &lt; 1 and errors</button></div>`;
@@ -2869 +2925 @@ function renderChecks() {
-    R.checks.filter(c => c.who === w).forEach(c => { const m = minRF(c); h += card('chk-' + c.id, `<span class="cid">${esc(c.id)}</span>${esc(LSNAME[c.ls])}`, '', `<p class="rpt-jump"><a href="#" data-rptjump="cr-chk-${esc(c.id)}">Open in the report</a></p>` + checkBody(c), `${verifyBadge(c.unc)}${c.na ? '<span class="badge na">N/A</span>' : rfBadge(m ? m.r.RF : null, 'min')}`); }); });
+    R.checks.filter(c => c.who === w).forEach(c => { const m = minRF(c); h += card('chk-' + c.id, `<span class="cid">${esc(c.id)}</span>${esc(LSNAME[c.ls])}`, '', `<p class="rpt-jump"><a href="#" data-rptjump="cr-chk-${esc(c.id)}">Open in the report</a></p>` + checkBody(c), `${verifyBadge(c.unc)}${c.na ? '<span class="badge na">N/A</span>' : c.err || (m && m.r.err) ? ERR_BADGE : rfBadge(m ? m.r.RF : null, 'min')}`); }); });
@@ -2871 +2927 @@ function renderChecks() {
-  $('#col-ok').onclick = () => { R.checks.forEach(c => { const m = minRF(c); if (m && m.r.RF < 1) delete P.ui.col['chk-' + c.id]; else P.ui.col['chk-' + c.id] = true; }); applyCollapse(); autosave(); };
+  $('#col-ok').onclick = () => { R.checks.forEach(c => { const m = minRF(c); if (c.err || (m && (m.r.err || m.r.RF < 1))) delete P.ui.col['chk-' + c.id]; else P.ui.col['chk-' + c.id] = true; }); applyCollapse(); autosave(); };
@@ -2883,2 +2939,2 @@ function ratingMatrix(forReport) {
-  const body = live.map(c => `<tr><td>${forReport ? esc(c.id) : `<a href="#" class="cid-link" data-goto="${esc(c.id)}">${esc(c.id)}</a>`}</td><td class="lbl">${esc(c.who)}</td><td class="lbl">${esc(LSNAME[c.ls])}</td>${R.cases.map((cs, j) => { const r = c.rf[j], gov = R.gov[j] && R.gov[j].c === c; return `<td class="${forReport ? 'n' : 'val'}${gov ? ' govc' : ''}">${r ? `<span class="${forReport ? '' : 'n-' + rfCls(r.RF)}">${f2(r.RF)}</span>` : '—'}</td>`; }).join('')}</tr>`).join('');
-  const foot = `<tr class="tot"><td colspan="3">Governing</td>${R.cases.map((cs, j) => { const g = R.gov[j]; return `<td class="${forReport ? 'n' : 'val'}">${g ? `<b>${f2(g.r.RF)}</b><br><small>${esc(g.c.id)}</small>` : '—'}</td>`; }).join('')}</tr>`;
+  const body = live.map(c => `<tr><td>${forReport ? esc(c.id) : `<a href="#" class="cid-link" data-goto="${esc(c.id)}">${esc(c.id)}</a>`}</td><td class="lbl">${esc(c.who)}</td><td class="lbl">${esc(LSNAME[c.ls])}</td>${R.cases.map((cs, j) => { const r = c.rf[j], gov = R.gov[j] && R.gov[j].c === c && !govInc(R.gov[j]); return `<td class="${forReport ? 'n' : 'val'}${gov ? ' govc' : ''}">${r ? `<span class="${forReport ? '' : 'n-' + rCls(r)}"${r.err ? ` title="Could not be computed: ${esc(r.err)}"` : ''}>${r.err && forReport ? 'error (could not be computed)' : rTxt(r)}</span>` : '—'}</td>`; }).join('')}</tr>`).join('');
+  const foot = `<tr class="tot"><td colspan="3">Governing</td>${R.cases.map((cs, j) => { const g = R.gov[j]; return `<td class="${forReport ? 'n' : 'val'}">${g ? `<b${govInc(g) && !forReport ? ' class="n-fail"' : ''}>${govTxt(g)}</b><br><small>${esc(govInc(g) ? 'not computed: ' + govIds(g) : g.c.id)}</small>` : '—'}</td>`; }).join('')}</tr>`;
@@ -2888 +2944 @@ function renderRating() {
-  const caseRows = R.cases.map((c, j) => `<tr><td class="lbl">${esc(c.label)}</td><td>${c.meth === 'lrfr' ? `γ<sub>LL</sub> = ${f2(c.g)}${c.gKey ? '' : ' (column input)'}` : `A<sub>2</sub> = ${f2(c.g)}`}</td><td class="val">${R.gov[j] ? f2(R.gov[j].r.RF) : '—'}</td><td>${R.gov[j] ? `<a href="#" data-goto="${esc(R.gov[j].c.id)}">${esc(R.gov[j].c.title)}</a>` : ''}</td></tr>`).join('');
+  const caseRows = R.cases.map((c, j) => `<tr><td class="lbl">${esc(c.label)}</td><td>${c.meth === 'lrfr' ? `γ<sub>LL</sub> = ${f2(c.g)}${c.gKey ? '' : ' (column input)'}` : `A<sub>2</sub> = ${f2(c.g)}`}</td><td class="val${govInc(R.gov[j]) ? ' n-fail' : ''}">${govTxt(R.gov[j])}</td><td>${govInc(R.gov[j]) ? `Not determined; could not be computed: ${R.gov[j].inc.map(x => `<a href="#" data-goto="${esc(x.c.id)}">${esc(x.c.id)}</a>`).join(', ')}` : R.gov[j] ? `<a href="#" data-goto="${esc(R.gov[j].c.id)}">${esc(R.gov[j].c.title)}</a>` : ''}</td></tr>`).join('');
@@ -2952 +3008 @@ function methodHtml() { return `<div class="man-part active">
-  <li><b>L<sub>mid</sub>:</b> the average of the three lengths from the two ends and the middle of the Whitmore section, measured parallel to the member toward the WP, to the nearest fastener line of another member or the plate edge. A continuous chord's fastener field counts as one.</li>
+  <li><b>L<sub>mid</sub>:</b> the average of the three lengths from the two ends and the middle of the Whitmore section, measured parallel to the member toward the WP, to the nearest fastener line of another member or the plate edge. A continuous chord's fastener field counts as one. A Whitmore end clipped at the plate edge is measured by the same rule, with the plate taken as its closed outline: the edge the end lies on does not stop the line, and a line running along a plate edge stays in the plate. Where the plate does not continue from the end toward the WP (the end lies on an edge or corner and the line would leave the plate at once), the length is measured along the plate edge from the end, over the edges that advance toward the WP, to a fastener line or to where the edge turns away; it is the distance gained parallel to the member. The rule does not depend on the orientation of the joint: a mirrored (upper-chord) or rotated joint gives the same L<sub>mid</sub>.</li>
@@ -3103,2 +3159,2 @@ function buildReport(o) {
-  if (o.checks) { const ws = [...new Set(R.checks.map(c => c.who))]; ws.forEach(w => { body += `<section class="cr-sec">${H1(w)}`; R.checks.filter(c => c.who === w).forEach(c => { const m = minRF(c); body += `<div class="cr-sub">${H2(`${LSNAME[c.ls]} (${c.id})`, c.unc.length ? 'contains parameters to verify' : '', 'cr-chk-' + c.id)}<div class="cr-body">${checkBody(c, { gov: o.detail === 'gov' }).replace(/<span class="badge[^"]*"[^>]*>[^<]*<\/span>/g, '')}</div>${c.na ? '' : `<div class="cr-line cr-res"><div class="cr-d">Lowest rating factor:</div><div class="cr-m"><b>${m ? f2(m.r.RF) : '—'}</b>${m ? ` (${esc(R.cases[m.j].label)})` : ''}</div><div class="cr-r ${m && m.r.RF < 1 ? 'cr-st-fail' : ''}"><b>${m ? (m.r.RF < 1 ? 'RF < 1.00' : 'RF ≥ 1.00') : 'n/a'}</b></div></div>`}</div>`; }); body += `</section>`; }); }
-  if (o.rating) body += `<section class="cr-sec cr-break">${H1('Rating summary')}<div class="cr-body">${ratingMatrix(true)}</div><p class="cr-p cr-concl"><b>Governing:</b> ${R.cases.map((c, j) => `${esc(c.label)}: RF = ${R.gov[j] ? `${f2(R.gov[j].r.RF)} (${esc(R.gov[j].c.id)})` : '—'}`).join('; ')}.</p></section>`;
+  if (o.checks) { const ws = [...new Set(R.checks.map(c => c.who))]; ws.forEach(w => { body += `<section class="cr-sec">${H1(w)}`; R.checks.filter(c => c.who === w).forEach(c => { const m = minRF(c); body += `<div class="cr-sub">${H2(`${LSNAME[c.ls]} (${c.id})`, c.unc.length ? 'contains parameters to verify' : '', 'cr-chk-' + c.id)}<div class="cr-body">${checkBody(c, { gov: o.detail === 'gov' }).replace(/<span class="badge[^"]*"[^>]*>[^<]*<\/span>/g, '')}</div>${c.na ? '' : m && m.r.err ? `<div class="cr-line cr-res"><div class="cr-d">Lowest rating factor:</div><div class="cr-m"><b>not determined</b> (could not be computed for ${esc(R.cases[m.j].label)})</div><div class="cr-r cr-st-fail"><b>ERROR</b></div></div>` : `<div class="cr-line cr-res"><div class="cr-d">Lowest rating factor:</div><div class="cr-m"><b>${m ? f2(m.r.RF) : '—'}</b>${m ? ` (${esc(R.cases[m.j].label)})` : ''}</div><div class="cr-r ${m && m.r.RF < 1 ? 'cr-st-fail' : ''}"><b>${m ? (m.r.RF < 1 ? 'RF < 1.00' : 'RF ≥ 1.00') : 'n/a'}</b></div></div>`}</div>`; }); body += `</section>`; }); }
+  if (o.rating) body += `<section class="cr-sec cr-break">${H1('Rating summary')}<div class="cr-body">${ratingMatrix(true)}</div><p class="cr-p cr-concl"><b>Governing:</b> ${R.cases.map((c, j) => `${esc(c.label)}: RF = ${govInc(R.gov[j]) ? `not determined, rating incomplete (could not be computed: ${esc(govIds(R.gov[j]))})` : R.gov[j] ? `${f2(R.gov[j].r.RF)} (${esc(R.gov[j].c.id)})` : '—'}`).join('; ')}.</p></section>`;
```

#### How verified (C6)

- `node --check` on every inline script (7 blocks): pass.
- Engine dumps before (main 3fd27e8) and after for 56 models: default, validation, default spliced, all 7 templates (zero forces, all-tension and all-compression test forces), the four lower-chord and two upper-chord templates in spliced mode, mirrored models (default, default spliced, validation, heel, `t4v`/`t3`/`t4d` spliced) and rotated models (30°, 137°, 250°): every capacity, RF, governing check, warning, W_g, W_n, L1–L3, L_mid and block-shear length. Differences: only the C6.1 results listed above (heel L0-L1, upper-chord chord members, their mirrored/rotated variants) and the heel warning text (C6.3). Default and validation: identical.
- Mirror / rotation test (25 pairs, checks matched by member, mirrored planes matched): lower chord vs mirrored upper chord for default, default spliced, validation, `t5`/`t5u` and `t4v`/`t4u` (continuous and spliced, tension and compression forces), heel and mirrored heel, mirrored spliced `t4v`/`t3`/`t4d`; rotations of the default spliced, heel and mirrored default spliced: **all 25 identical after** (main: 20 of 25 differed).
- Independent hand calculation (node, no engine code) of check cases (a) and (b): matches the tool to 0.01 kip.
- jsdom (new test): heel and spliced-upper-chord projects saved by main (autosave and export JSON) load unchanged; only L0-L1-WB differs from main; heel notes (Forces tab, Summary, SP1-Y/SP1-U calc sheets, not on member checks), reworded warning, stored chord value unchanged; SP2-Y and tension-only WB still "n/a"; zero live load column → cases "—", not an error; L_mid along-edge polyline drawn; default model: every tab renders, status 1.17, Validation 17 of 17 match, Method text; error state for (i) Whitmore centre outside the plate (validation model, D inner row at 40 in) and (ii) NaN capacity (1a-only build): status bar, Summary (no lowest RF value), Checks badges and reasons, Rating tab and matrix, method label, report Governing line; no runtime errors.
- Regression: Phase 3 DXF round trips (all 7 templates, default, validation, variant) and hand-written DXF cases: output identical to main; Phase 3 CAD jsdom test, Phase 1 and 2 smoke tests and the C4 jsdom test: same results as main (only the known "4 templates" count and page-size / timestamp differences).
- Chromium (Playwright, MathJax served locally): Checks tab of the heel (L0-L1-WB, SP1-Y with the note, SP2-Y N/A) and the spliced upper chord (U1-U2-WB, L_mid 10.833), Drawing tab of both, and the 1a-only error state (Summary, U1-U2-WB, Rating) reviewed; no page errors.
- Saved data: no key or format change (`gussetRating.autosave.v1`, `gussetRating.projects.v1`, export JSON, DXF unchanged).
- **Other copies:** none.
- **Open items:**
  - O14: closed by C6.1. (2026-10-05: rule engineer-confirmed, see C7.)
  - O15: partly done (warning reworded for one chord member); the 3D note and the DXF GP-SPLICE line still say "splice".
  - O16: note added (C6.3); no combined shear + normal check (NCHRP W-197 combined check remains out of scope, O1).
  - O17: note added (C6.3); the chord member is still drawn from the WP.
  - O18 (new; closed by C7, 2026-10-05: the line now stops where the other member's fastener field starts). Along a free bottom/top edge the chord's end length runs under the other chord member's fastener field to the far plate edge (25.5 in in the default geometry), because the field outline is drawn through the hole centres and the edge is outside it. This is the existing rule (unchanged for the lower chord); the engineer may want the line stopped at the other member's outline instead.

## 2026-10-05 — PR: claude/gusset-o18 (PR link added after merge)

### C7. L_mid along a plate edge stops at the other member's fastener field (O18); clipped-end rule engineer-confirmed (O14)   [calculation change: L_mid of spliced chord members; default and validation results unchanged]

Engineer's decisions (2026-10-05):
1. The clipped-end L_mid rule of C6.1 is **confirmed** (closes O14). The Method tab shows "engineer-confirmed 2026-10-05" and the L_mid row of the buckling calc sheet says "(rule confirmed by the engineer 2026-10-05)". Moved to "Confirmed" (C1).
2. **O18: stop at the fastener.** A length measured along a plate edge (a free top or bottom edge on the straight line of rule 1, or the along-edge measurement of rule 2) that runs under or alongside another member's fastener field stops where that member's fastener field starts, not at the far plate edge. Same rule for every member (chord and web), lower and upper chord, straight line and along-edge measurement.

#### C7.1 Rule (as implemented)

- **Fastener field:** the same outline the ray stops already use (C6.1 rule 1): `G[j].field`, the outline through the outer hole centres of member j (a continuous chord's two members together count as one field). The member's own field is never a stop (unchanged).
- **Which part of a path:** only the parts that lie on the plate edge. For the straight line (rule 1) these are the parts collinear with a plate edge (e.g. a clipped end on a top or bottom edge with the line running along that edge). For the along-edge measurement (rule 2) every edge walked is on the plate edge. A line through the inside of the plate is unchanged (it stops only where it crosses a field outline, as before).
- **Stop:** project the other member's field outline onto the path line: [a, b] = min / max of (v − P0)·e over the outline vertices (P0 = start of the path segment, e = its unit direction). The path stops at the first point where it enters that projection: at a if a lies beyond the start of the edge part and within it; at the start of the edge part if the field is already alongside there (a ≤ s0 ≤ b), except at the point where the measurement starts (the Whitmore point q): a field whose projection already contains q does not stop the path (the path does not reach where that field starts; e.g. the vertical U2-L2 field above the chord Whitmore line). The nearest stop of all fields and of the existing crossings governs.
- **Touching:** a path collinear with a field outline edge stops where it first touches that edge (over the whole straight line or walked edge; for an edge starting at q it is not a stop, consistent with the above).
- **Length:** unchanged definition: straight line = distance along the member direction; along the edge = distance gained parallel to the member.
- Orientation independent: the stop depends only on the geometry relative to the path, so mirrored (upper-chord) and rotated joints give the same L_mid (25-pair test: all identical).

#### C7.2 §4 callout

- **Governing provision:** L_mid = average of L1, L2, L3 per NCHRP Web-Only Document 197 and AASHTO MBE 3rd Ed. Art. 6A.6.12.6.8 (Whitmore compression, K = 0.5); P_n per AASHTO LRFD 10th Ed. Art. 6.14.2.8 and 6.9.4.1.1; LFR per AASHTO Std. Spec. 17th Ed. Art. 10.54.1.1 and FHWA-IF-09-014 (K = 1.2). The documents do not say how to measure along a plate edge; the rule is this tool's interpretation, **engineer-confirmed 2026-10-05**. No formula, load factor, resistance factor, K, unit or code reference changed.
- **Before:** along a plate edge the length ran to the plate edge (or along-edge: to a field outline crossing or the turn of the edge); a field beside the edge was never crossed because its outline lies inside the plate. **After:** it stops where another member's fastener field starts alongside the edge (C7.1).
- **Direction of the change:** L_mid shorter → buckling capacity higher → RF higher (less conservative than before; per the engineer's decision).

**Check case (a): spliced upper chord U1-U2** (template `t5u`, CHORD = spliced; U1-U2 at 180°, 6 rows × 4 lines, p = 4, g = 4, inner row 1.5 in from the WP; two 1/2 in A36 plates, E = 29000 ksi; test forces all members DC −100, DW −10, HL-93 −100, HS20 −80 kip):
- Whitmore line x = −1.5; half width = 6 + 20 tan 30° = 17.547; top end clipped at the top edge y = +9; **W_g = 9 + 17.547 = 26.547 in**; middle (−1.5, −4.274); bottom end (−1.5, −17.547).
- Direction toward the WP: +x. Other fields: U2-U3 x = 1.5 … 21.5, y = −6 … 6; U2-L2 x = −2.5 … 2.5, y = −28 … −14; U2-L3 x = 12.691 … 30.376; U2-L1 behind (x < −12.7).
- L1 (top end, along the top edge y = 9): projections on the path from x = −1.5: U2-L2 [−2.5, 2.5] contains the start → passed; U2-U3 starts at x = 1.5; U2-L3 at 12.691. **Before 25.5 (to the corner (24, 9)); after 1.5 − (−1.5) = 3.0 in** ("fastener line of U2-U3 (where its fastener field starts alongside the plate edge)").
- L2 (middle) = 3.0 (crosses the U2-U3 outline at x = 1.5, unchanged); L3 (bottom end) = 4.0 (U2-L2 outline at x = 2.5, unchanged).
- **L_mid = (25.5 + 3 + 4)/3 = 10.833 → (3 + 3 + 4)/3 = 3.333 in.**
- LRFR, per plate: A_g = 26.547 × 0.5 = 13.274 in², r = 0.5/√12 = 0.14434 in, P_o = 36 × 13.274 = 477.85 kip.
  - Before: KL/r = 0.5 × 10.833/0.14434 = 37.53; P_e = π²(29000)(13.274)/37.53² = 2697.6 kip; P_e/P_o = 5.645 ≥ 0.44 → P_n = 0.658^(1/5.645) × 477.85 = 443.70; φP_n = 0.90 × 2 × 443.70 = **798.66 kip**.
  - After: KL/r = 0.5 × 3.333/0.14434 = 11.55; P_e = 28493 kip; P_e/P_o = 59.63; P_n = 0.658^(1/59.63) × 477.85 = 474.50; φP_n = 0.90 × 2 × 474.50 = **854.11 kip**.
- LFR (C_c = √(2π²E/F_y) = 126.10):
  - Before: KL/r = 1.2 × 10.833/0.14434 = 90.07; F_cr = 36[1 − 36/(4π² × 29000) × 90.07²] = 26.817 ksi; C = 0.85 × 26.547 × 1.0 × 26.817 = **605.13 kip**.
  - After: KL/r = 27.71; F_cr = 35.131 ksi; C = 0.85 × 26.547 × 1.0 × 35.131 = **792.72 kip**.
- RF of U1-U2-WB (LRFR (C − 1.25 × 100 − 1.50 × 10)/(γ_LL × 100), γ_LL 1.75 / 1.35; LFR (C − 1.3 × 110)/(A_2 × 80), A_2 2.17 / 1.3): before 3.764 / 4.879 / 2.662 / 4.444; **after 4.081 / 5.290 / 3.743 / 6.247**. U2-U3-WB: same. Governing unchanged: LRFR 0.464 / 0.602, LFR 1.255 / 2.094 (U2-L2-FS).

**Check case (b): lower-chord mirror, L1-L2 spliced** (template `t5`, CHORD = spliced, same forces): bottom end (−1.5, −9) on the bottom edge y = −9, direction +x; L2-L3 field starts at x = 1.5 → L = 3.0 (before 25.5); L2-U2 (y = 14 … 28, x = −2.5 … 2.5) contains the start → passed. L1/L2/L3 = 4.0 / 3.0 / 3.0 (before 4.0 / 3.0 / 25.5); **L_mid 10.833 → 3.333 in**; φP_n 798.66 → **854.11**, C 605.13 → **792.72 kip**; RF L1-L2-WB 3.764 / 4.879 / 2.662 / 4.444 → **4.081 / 5.290 / 3.743 / 6.247** (identical to (a)). Governing unchanged: 0.464 / 0.602 / 1.255 / 2.094 (L2-U2-FS).

**Check case (c): heel chord L0-L1** (template `t2h`): **unchanged**, L_mid 7.500 in. L1 (bottom end (1.5, −9), along the bottom edge toward −x to (−6, −9)): the only other field, L0-U1 (x = 12.691 … 30.376, y = 16.5 … 34.8), projects onto the path at x ≥ 12.691, behind the start → no stop; 7.5. L2 (middle): inside the plate, 7.5. L3 (top end on the sloping edge, along the edge to (−6, 9)): e = (−7.5, −7.633)/10.701; L0-U1 vertices project behind (dot < 0) → no stop; gain 7.5. φP_n 801.53 / C 688.48 kip, RF 3.780 / 4.900 / 3.142 / 5.245 (unchanged). L0-U1 unchanged (16.790).

**Default and validation models: no check result changes** (every capacity, RF, governing check, warning, W_g, W_n and block-shear length identical; default LRFR Inventory 1.172 (L2-U1-FS), LFR Inventory 1.403 (L2-U1-WB); validation 1.564 / 2.109 (D-FS); Validation tab 17 of 17, no hand value changed). Only the L_mid of the **continuous** chord members changes, which no check uses (a continuous chord has no Whitmore checks); it shows in the drawing's L_mid arrows and in the engine geometry:
- Default L1-L2 / L2-L3 (continuous): the end on the bottom edge 25.5 → 14.191 (stops at x = ±12.691 where the L2-U3 / L2-U1 field starts alongside the bottom edge; L2-U2 contains the start and is passed); L_mid 18.333 → 14.564 in.
- Validation CL (continuous): the end on the bottom edge (−1.5, −8), toward +x: 21.5 → 13.874 (D field starts at x = 12.374); L_mid 21.720 → 19.178 in. CR and D unchanged (D 12.304 / 20.000 / 27.696 → 20.000).

**Every result that changes (56-model engine dump, main 98dc651 vs this branch; governing check of every model unchanged):**

| Model (test forces) | Member | L_mid (in) | φP_n LRFR (kip) | C LFR (kip) | RF LRFR Inv / Op, LFR Inv / Op |
|---|---|---|---|---|---|
| `t5`, `t4v`, `t3` spliced, compression (`setF` −) | L1-L2 | 10.833 → 3.333 | 798.66 → 854.11 | 605.13 → 792.72 | 4.067 / 5.272 / 2.801 / 4.676 → 4.383 / 5.682 / 3.818 / 6.374 |
| same | L2-L3 | 10.833 → 3.333 | 798.66 → 854.11 | 605.13 → 792.72 | 3.797 / 4.922 / 2.573 / 4.294 → 4.099 / 5.313 / 3.533 / 5.898 |
| `t5u`, `t4u` spliced, compression | U1-U2 / U2-U3 | 10.833 → 3.333 | 798.66 → 854.11 | 605.13 → 792.72 | as L1-L2 / L2-L3 above |
| `t4d` spliced, compression | L1-L2 | 16.512 → 9.012 | 724.03 → 817.10 | 342.70 → 668.93 | 3.640 / 4.719 / 1.379 / 2.301 → 4.172 / 5.408 / 3.147 / 5.254 |
| same | L2-L3 | 16.512 → 9.012 | 724.03 → 817.10 | 342.70 → 668.93 | 3.391 / 4.395 / 1.229 / 2.051 → 3.897 / 5.052 / 2.899 / 4.840 |
| default spliced, the spliced templates with tension forces, mirrored / rotated default spliced | chord members | 10.833 → 3.333 (`t4d`: 16.512 → 9.012) | as above | as above | n/a (chord in tension: WB does not apply) |
| default, validation, `t5`, `t4d`, `t5u` continuous (both chord members); `t4v`, `t4u` continuous (L1-L2 / U1-U2 only) | chord members | 18.333 → 14.564 (`t4d` 24.012 → 20.243, validation CL 21.720 → 19.178) | not used | not used | not used |

- `t4d` spliced L1-L2: L1 = 21.037 (top end, inside the plate, to the L2-U3 field; unchanged), L2 = 3.0, L3 = 25.5 → 3.0: L_mid (21.037 + 3 + 25.5)/3 = 16.512 → (21.037 + 3 + 3)/3 = 9.012; hand check: KL/r 57.20 → 31.22, P_e 1161.1 → 3897.9, P_n 402.24 → 453.95 kip, φP_n 724.03 → 817.10; LFR KL/r 137.28 (> C_c, Euler) → 74.93, F_cr 15.187 → 29.645 ksi, C 342.70 → 668.93 kip. Its governing LFR check is L2-U3-WB (0.530 / 0.885), unchanged.
- Test forces "`setF` −" are those of the 56-model set (member i: DC −(60 + 10i), DW −(8 + i), LL −(100 − 15k + 5i)); the worked cases (a)–(c) use the C6 forces.
- The heel template `t2h` and every web member: unchanged.

#### Where (anchors) and exact code

All changes are in `Gusset Plate Rating.html`, engine (`const GPR`): new `edgeStop()` just before `lmidLen()` (anchor `function lmidLen(q, d, poly, stops) {`); in `lmidLen()` the straight-line branch (anchor `// parts of the line that run along a plate edge`) and the along-edge walk (anchor `const es = edgeStop(cur,`); the L_mid row of the Whitmore buckling calc sheet (anchor `(rule confirmed by the engineer 2026-10-05)`); `methodHtml()` L_mid bullet (anchor `engineer's decision 2026-10-05`). Calc-sheet / drawing text: a stop of this kind reads "fastener line of X (where its fastener field starts alongside the plate edge)"; results carry `edge: true` (computed only, not saved).

Exact before/after (unified diff against main 98dc651, zero context lines):

```diff
@@ -1330 +1330,17 @@ const GPR = (function () {
-     Orientation-independent: the result depends only on the geometry relative to q and d. */
+     Orientation-independent: the result depends only on the geometry relative to q and d.
+     Where the path runs along a plate edge, another member's fastener field also stops it where that field starts alongside the path (edgeStop). */
+  /* Stop along a plate edge (C7, O18): the path segment from P0 in unit direction e, of length len; edgeIv = the parts [s0, s1] of it that lie on the
+     plate edge. Another member's fastener field stops the path at the first point where the path enters the projection of the field outline onto the
+     path line ([a, b] = range of (v - P0).e over the outline vertices): at a if a > s0, or at s0 if the field is already alongside where the edge part
+     begins; except that a field whose projection already contains the point where the measurement starts (q, atStart) does not stop it (the path does
+     not reach where that field starts). Over the whole segment, a path collinear with a field outline edge stops where it first touches that edge.
+     Returns the nearest stop { t, name } with t <= len, or null. */
+  function edgeStop(P0, e, len, edgeIv, stops, atStart) {
+    let best = null; const take = (t, name) => { if (t <= len + 1e-9 && (!best || t < best.t - 1e-9)) best = { t: Math.max(0, t), name }; };
+    stops.forEach(st => { const fd = st.poly, pr = fd.map(v => dot(sub(v, P0), e)), a = Math.min(...pr), b = Math.max(...pr);
+      edgeIv.forEach(([s0, s1]) => { if (a > s0 + 1e-9) { if (a <= s1 + 1e-9) take(a, st.name); } else if (b >= s0 - 1e-9 && !(atStart && s0 <= 1e-9)) take(s0, st.name); });
+      for (let k = 0; k < fd.length; k++) { const A = fd[k], ab = sub(fd[(k + 1) % fd.length], A), la = vlen(ab);
+        if (la < 1e-12 || Math.abs(crs(e, ab)) > 1e-7 * la || Math.abs(crs(e, sub(A, P0))) > 1e-6) continue;   // not collinear with the path
+        const o = [dot(sub(A, P0), e), dot(sub(A, P0), e) + dot(ab, e)], o0 = Math.min(...o), o1 = Math.max(...o);
+        if (o0 > 1e-9) take(o0, st.name); else if (o1 >= -1e-9 && !atStart) take(0, st.name); } });
+    return best; }
@@ -1337,0 +1354,5 @@ const GPR = (function () {
+      // parts of the line that run along a plate edge (collinear with an edge), then the stop where another member's fastener field starts alongside
+      const edgeIv = []; poly.forEach((A, k) => { const ab = sub(poly[(k + 1) % n], A), la = vlen(ab); if (la < 1e-12 || Math.abs(crs(d, ab)) > 1e-7 * la || Math.abs(crs(d, sub(A, q))) > 1e-6) return;
+        const o = [dot(sub(A, q), d), dot(sub(A, q), d) + dot(ab, d)], o0 = Math.max(0, Math.min(...o)), o1 = Math.min(L, Math.max(...o)); if (o1 > o0 + 1e-7) edgeIv.push([o0, o1]); });
+      const es = edgeStop(q, d, L, edgeIv, stops, true);
+      if (es && es.t < L - 1e-9) return { L: es.t, what: `fastener line of ${es.name} (where its fastener field starts alongside the plate edge)`, end: add(q, mul(d, es.t)), edge: true };
@@ -1343 +1364 @@ const GPR = (function () {
-    [1, -1].forEach(s => { let idx = vi >= 0 ? vi + s : (s > 0 ? ei + 1 : ei), cur = q, hit = null; const path = [q];
+    [1, -1].forEach(s => { let idx = vi >= 0 ? vi + s : (s > 0 ? ei + 1 : ei), cur = q, hit = null, hitE = false; const path = [q];
@@ -1347,2 +1368,3 @@ const GPR = (function () {
-        let tm = 1, w = null; stops.forEach(st => { const fd = st.poly; for (let k = 0; k < fd.length; k++) { const t = raySeg(cur, e, fd[k], fd[(k + 1) % fd.length]); if (t != null && t < tm) { tm = t; w = st.name; } } });
-        if (w) { hit = w; cur = add(cur, mul(e, tm)); path.push(cur); break; }
+        let tm = 1, w = null, wE = false; stops.forEach(st => { const fd = st.poly; for (let k = 0; k < fd.length; k++) { const t = raySeg(cur, e, fd[k], fd[(k + 1) % fd.length]); if (t != null && t < tm) { tm = t; w = st.name; } } });
+        const es = edgeStop(cur, mul(e, 1 / le), le, [[0, le]], stops, cur === q); if (es && es.t / le < tm - 1e-12) { tm = es.t / le; w = es.name; wE = true; }   // field starts alongside the edge
+        if (w) { hit = w; hitE = wE; cur = add(cur, mul(e, tm)); if (tm * le > 1e-9) path.push(cur); break; }
@@ -1351 +1373 @@ const GPR = (function () {
-      if (L > best.L + 1e-9) best = { L, what: hit ? `fastener line of ${hit}, measured along the plate edge` : 'plate edge, measured along the edge', end: cur, path }; });
+      if (L > best.L + 1e-9) best = { L, what: hit ? `fastener line of ${hit}${hitE ? ' (where its fastener field starts alongside the plate edge)' : ''}, measured along the plate edge` : 'plate edge, measured along the edge', end: cur, path, ...(hitE ? { edge: true } : {}) }; });
@@ -1600 +1622 @@ const GPR = (function () {
-        where: [whitWhere(g), wr('L<sub>mid</sub>', `Average of L<sub>1</sub>, L<sub>2</sub>, L<sub>3</sub> from the Whitmore ends and middle toward the work point, parallel to the member: ${W.L3.map(z => `${f3(z.L)} (${escH(z.what)})`).join(', ')}${W.ovL != null ? ' (overridden)' : ''}${W.clipA || W.clipB ? `. Whitmore end clipped at the plate edge: measured by the same rule as an unclipped end; the plate edge the end lies on does not stop the line${W.L3.some(z => z.path) ? ', and where the plate does not continue toward the work point from that end the length is measured along the plate edge (distance gained parallel to the member)' : ''}` : ''}`, f3(L), 'in', W.ovL != null ? 'Override' : 'NCHRP W-197; MBE 6A.6.12.6.8'),
+        where: [whitWhere(g), wr('L<sub>mid</sub>', `Average of L<sub>1</sub>, L<sub>2</sub>, L<sub>3</sub> from the Whitmore ends and middle toward the work point, parallel to the member: ${W.L3.map(z => `${f3(z.L)} (${escH(z.what)})`).join(', ')}${W.ovL != null ? ' (overridden)' : ''}${W.clipA || W.clipB ? `. Whitmore end clipped at the plate edge: measured by the same rule as an unclipped end; the plate edge the end lies on does not stop the line${W.L3.some(z => z.path) ? ', and where the plate does not continue toward the work point from that end the length is measured along the plate edge (distance gained parallel to the member)' : ''} (rule confirmed by the engineer 2026-10-05)` : ''}${W.L3.some(z => z.edge) ? '. A length along the plate edge stops where the fastener field of another member starts alongside the edge, i.e. at the start of the projection of that member\'s fastener-field outline onto the edge (engineer\'s decision 2026-10-05)' : ''}`, f3(L), 'in', W.ovL != null ? 'Override' : 'NCHRP W-197; MBE 6A.6.12.6.8'),
@@ -3008 +3030 @@ function methodHtml() { return `<div class="man-part active">
-  <li><b>L<sub>mid</sub>:</b> the average of the three lengths from the two ends and the middle of the Whitmore section, measured parallel to the member toward the WP, to the nearest fastener line of another member or the plate edge. A continuous chord's fastener field counts as one. A Whitmore end clipped at the plate edge is measured by the same rule, with the plate taken as its closed outline: the edge the end lies on does not stop the line, and a line running along a plate edge stays in the plate. Where the plate does not continue from the end toward the WP (the end lies on an edge or corner and the line would leave the plate at once), the length is measured along the plate edge from the end, over the edges that advance toward the WP, to a fastener line or to where the edge turns away; it is the distance gained parallel to the member. The rule does not depend on the orientation of the joint: a mirrored (upper-chord) or rotated joint gives the same L<sub>mid</sub>.</li>
+  <li><b>L<sub>mid</sub>:</b> the average of the three lengths from the two ends and the middle of the Whitmore section, measured parallel to the member toward the WP, to the nearest fastener line of another member or the plate edge. A continuous chord's fastener field counts as one. A Whitmore end clipped at the plate edge is measured by the same rule, with the plate taken as its closed outline: the edge the end lies on does not stop the line, and a line running along a plate edge stays in the plate. Where the plate does not continue from the end toward the WP (the end lies on an edge or corner and the line would leave the plate at once), the length is measured along the plate edge from the end, over the edges that advance toward the WP, to a fastener line or to where the edge turns away; it is the distance gained parallel to the member. <span class="badge pass" title="Convention confirmed by the engineer">engineer-confirmed 2026-10-05</span> Where a length runs along a plate edge (a free top or bottom edge, or the measurement along the edge), it also stops where the fastener field of another member starts alongside it: at the first point where the line enters the projection of that member's fastener-field outline (the outline through the outer hole centres) onto the line. A field that is already alongside the point the length starts from does not stop it; a line that touches or runs along a fastener-field outline stops there. <span class="badge pass" title="Convention confirmed by the engineer">engineer's decision 2026-10-05</span> The rule does not depend on the orientation of the joint: a mirrored (upper-chord) or rotated joint gives the same L<sub>mid</sub>.</li>
```

#### How verified (C7)

- `node --check` on every inline script (7 blocks): pass.
- Engine dumps, main 98dc651 vs this branch, 56 models (as C6): only the L_mid of chord members whose Whitmore end lies on a free top / bottom edge changes (table above); no governing check, warning, W_g, W_n or block-shear length changes; default and validation check results identical.
- Mirror / rotation test (same 25 pairs as C6): all identical.
- Unit cases of `lmidLen()` on synthetic plates (field ahead along a top and a bottom edge, field alongside the start passed, field behind, interior line beside a field unchanged, interior line collinear with a field edge, 37° rotation, heel walk with and without a field along the sloping edge, two-edge walk stopped at the corner): all pass (main fails the 5 cases that need the new stop).
- Independent hand script (no engine code) for (a), (b) and `t4d`: matches the tool (854.11 / 792.72; 817.10 / 668.93; RFs 4.081 / 5.290 / 3.743 / 6.247).
- jsdom: heel autosave saved by main loads, every result identical; spliced upper-chord export JSON saved by main imports, only U1-U2-WB / U2-U3-WB differ (L_mid 10.833 → 3.333); calc sheet, drawing tooltip and report show the edge-stop text and the confirmation; Summary governing unchanged; default model: every tab renders, status 1.17, Validation 17 of 17; Method tab text and badges; no runtime errors.
- Chromium (Playwright): Drawing tab of the spliced upper chord (L_mid arrows of U1-U2 / U2-U3 run 3 in along the top edge and stop at the other chord's first fastener line), U1-U2-WB calc sheet, Method tab, lower-chord spliced drawing; reviewed; no page errors.
- DXF: Phase 3 round trips (`gp3/rt.js`) and hand-written DXF cases (`gp3/cases.js`): output identical to main.
- Saved data: no key or format change (`gussetRating.autosave.v1`, `gussetRating.projects.v1`, export JSON, DXF unchanged).
- **Other copies:** none.
- **Open items:**
  - O14: closed (rule engineer-confirmed 2026-10-05).
  - O18: closed by C7.
  - (Closed by C8, 2026-10-05: the engineer keeps the rule; the tool now warns when the stopping field is not directly beside the edge.) New, for the engineer (not changed): a field "alongside" is any other member's field whose projection on the edge path is ahead of the start, however far it is from the edge, also when another field lies in between (e.g. the continuous chord in the default model stops at the diagonal L2-U3, 14.191 in, although the chord's own field lies between the edge and the diagonal). This only affects continuous chords (L_mid not used) in the models tested. Say if a field should count only when nothing lies between it and the edge.

## 2026-10-05 — PR: claude/gusset-lmid-warn (PR link added after merge)

### C8. Warning when an L_mid length along a plate edge is stopped by a fastener field that is not directly beside the edge   [warning only; no calculation change]

Engineer's decision (2026-10-05), on the open item raised in C7: **keep the C7 rule unchanged** (no calculation change) and warn in the app when a length along a plate edge was stopped by a fastener field that is not directly beside the edge, so the engineer can judge it. Example: the default model's continuous chord, L1-L2 end 2 along the bottom edge, stops at the L2-U3 diagonal's field (14.191 in) although the chord's own field lies between the edge and the diagonal.

#### C8.1 Criterion (as implemented)

- **Which lengths:** only the L_1 / L_2 / L_3 lengths that C7 stopped along a plate edge (`edgeStop`, straight line along an edge or the along-edge walk; "where its fastener field starts alongside the plate edge"). Nothing else is examined.
- **Test:** at the stop point S, draw the line perpendicular to the edge path toward the stopping field (the side of the field outline's vertex centroid). h = distance from S along that line to the stopping field's outline (`G[j].field`, the same outline C7 uses). The field is **not directly beside the edge** when any other fastener field (any member's, the member's own included; a continuous chord's two members count as one field) lies on the segment from S to that point (the segment shortened by 1e-6 in at both ends, so fields that only touch S or the stopping field do not count). This is the "another field lies between" criterion; no distance threshold is used (h is reported for information).
- **Ordinary case, no warning:** a field directly beside the edge, e.g. a spliced chord stopping at the other chord's first fastener line (default spliced: S = (1.5, −9), h = 3.0 in to L2-L3's field, nothing between).
- **Length if ignored:** `lmidLen()` run again from the same point with the stopping field removed from the stops, i.e. to the next stop (which may be another field, the plate edge, or the turn of the edge). L_mid if ignored = average with each flagged length replaced by that value.
- **Orientation independent:** the test uses only the geometry relative to S and the edge direction; mirrored and rotated joints give the same flags (test below).

#### C8.2 Where it shows

- **Warnings list** (Summary "Warnings" card, status-bar count, report "Warnings:" list): one warning per member, e.g. "Member L1-L2, L_mid: L3 (end 2) stops along the plate edge where the fastener field of L2-U3 starts alongside the edge, but that field is 32.292 in from the edge at the stop and the fastener field of L1-L2 / L2-L3 (continuous chord) lies between; length used 14.191 in, 25.500 in if that field were ignored (to the plate edge). Automatic L_mid 14.564 in (18.333 in if ignored), not used in any check (continuous chord member, no Whitmore buckling check). Judge whether this stop applies (rule C7, engineer's decision 2026-10-05)." For a member with a WB check it says "used in the Whitmore buckling check <id>-WB"; with an L_mid override, "not used: L_mid is overridden".
- **Whitmore buckling calc sheet** (Checks tab and report), L_mid "where" row, appended: "Warning, stopping field not directly beside the edge: L3 (end 2) stops at the fastener field of …, which is … in from the edge at the stop, with the fastener field of … between; … in used, … in if that field were ignored (…); L_mid would be … in. Judge whether this stop applies". Only members with a WB check have this row.
- **Method tab**, L_mid item: one sentence stating the criterion.

#### C8.3 §4 statement: no calculation change

No formula, factor, unit, L_mid, capacity or rating changes. The engine only gains read-only information: `edgeStop()` also returns the stopping field object (`st`); `lmidLen()` also returns `stop` and `e` (unit edge direction at the stop) for edge stops; the new `farField()` and the warning are computed after `W.LmidAuto` / `W.Lmid` and do not feed back. Checked: 56-model engine dump (every capacity, RF, governing check, W_g, W_n, L_1–L_3, L_mid and block-shear length) identical to main e831071; only the warnings lists differ (below). Governing provision of the underlying rule unchanged: L_mid per NCHRP Web-Only Document 197 / AASHTO MBE 3rd Ed. Art. 6A.6.12.6.8, measurement along the plate edge per C7 (tool interpretation, engineer's decision 2026-10-05).

#### C8.4 Check case (hand)

Default model (continuous chord L1-L2 / L2-L3, 4 lines × 6 rows, 4 in gage / pitch, first row 1.5 in from the WP; bottom plate edge y = −9).
- Fields: chord (one field) x −21.5 … 21.5, y −6 … 6; L2-U3 corners (20.734, 16.543), (30.376, 28.033), (22.333, 34.782), (12.691, 23.292); L2-U2 x −2.5 … 2.5, y 14 … 28.
- L1-L2 end 2: q = (−1.5, −9), path along the bottom edge in +x. C7: L2-U3's projection on the edge starts at x = 12.691 → S = (12.691, −9), L_3 = 12.691 − (−1.5) = 14.191 in (unchanged).
- Perpendicular at S (x = 12.691, upward): reaches L2-U3's outline at its corner (12.691, 23.292): h = 23.292 − (−9) = 32.292 in. The segment x = 12.691, y −9 … 23.292 crosses the chord field (y −6 … 6, x −21.5 … 21.5) → flagged; L2-U2 (x ≤ 2.5) is not on it.
- Ignoring L2-U3: no other field starts alongside the bottom edge ahead of q (L2-U2 projects onto x −2.5 … 2.5, which already contains q.x = −1.5, so it does not stop the length, C7 rule) → plate edge x = 24: 24 − (−1.5) = 25.500 in.
- L_mid = (4.000 + 25.500 + 14.191)/3 = 14.564 in used; (4.000 + 25.500 + 25.500)/3 = 18.333 in if ignored. Continuous chord member: no WB check, not used.
- L2-L3 end 1 is the mirror image (L2-U1, 14.191 / 25.500 in).
- Ordinary case: chord spliced, L1-L2 end 2 stops at L2-L3's field at S = (1.5, −9), h = 3.0 in, the segment x = 1.5, y −9 … −6 crosses no field (L1-L2's own field ends at x = −1.5) → no warning.
- Member with a WB check (synthetic, test only): chord spliced and L2-L3 turned to 30°. L1-L2 end 2 now stops at L2-U3 (14.191 in) with L2-L3's rotated field between → warning "used in the Whitmore buckling check L1-L2-WB", L_mid 6.318 in used, 10.088 in if ignored; L2-L3 end 1 stops along the edge at L2-U2 (3.835 in, h = 23.0 in, own field between; 7.299 in if ignored, to L1-L2's field).

#### Models that now show the warning (56-model set)

19 models gain warnings, all for continuous chord members (L_mid not used in any check): `default`, `mirror_default`, `tpl_t5`, `tpl_t5_Fpos`, `tpl_t5_Fneg`, `tpl_t4d`, `tpl_t4d_Fpos`, `tpl_t4d_Fneg`, `tpl_t5u`, `tpl_t5u_Fpos`, `tpl_t5u_Fneg` (two warnings each: both chord members, 14.191 → 25.500 in; L_mid 14.564 → 18.333 in, `t4d` 20.243 → 24.012 in); `tpl_t4v`, `tpl_t4v_Fpos`, `tpl_t4v_Fneg`, `tpl_t4u`, `tpl_t4u_Fpos`, `tpl_t4u_Fneg` (one: L1-L2 / U1-U2); `validation`, `mirror_validation` (one: CL, 13.874 → 21.500 in, L_mid 19.178 → 21.720 in). No spliced, heel or rotated-spliced model is flagged. No member with a WB check is flagged in the 56 models.

#### Where (anchors) and exact code

All changes are in `Gusset Plate Rating.html`: engine (`const GPR`) `edgeStop()` (anchor `const take = (t, st) =>`), `lmidLen()` straight-line edge stop (anchor `edge: true, stop: es.st, e: d`) and along-edge walk (anchor `hitSt = null, hitU = null`), new `farField()` just before `function segSeg(`, the warning in `compute()` after `W.LmidAuto = ` (anchor `// C8 (warning only, no calculation change)`), the L_mid "where" row of `capWB()` (anchor `Warning, stopping field not directly beside the edge`), and the Method tab L_mid item (anchor `The tool warns (no change to L<sub>mid</sub>)`).

Exact before/after (unified diff against main e831071, zero context lines):

```diff
@@ -1337 +1337 @@ const GPR = (function () {
-     Returns the nearest stop { t, name } with t <= len, or null. */
+     Returns the nearest stop { t, name, st } with t <= len (st = the stopping field), or null. */
@@ -1339 +1339 @@ const GPR = (function () {
-    let best = null; const take = (t, name) => { if (t <= len + 1e-9 && (!best || t < best.t - 1e-9)) best = { t: Math.max(0, t), name }; };
+    let best = null; const take = (t, st) => { if (t <= len + 1e-9 && (!best || t < best.t - 1e-9)) best = { t: Math.max(0, t), name: st.name, st }; };
@@ -1341 +1341 @@ const GPR = (function () {
-      edgeIv.forEach(([s0, s1]) => { if (a > s0 + 1e-9) { if (a <= s1 + 1e-9) take(a, st.name); } else if (b >= s0 - 1e-9 && !(atStart && s0 <= 1e-9)) take(s0, st.name); });
+      edgeIv.forEach(([s0, s1]) => { if (a > s0 + 1e-9) { if (a <= s1 + 1e-9) take(a, st); } else if (b >= s0 - 1e-9 && !(atStart && s0 <= 1e-9)) take(s0, st); });
@@ -1345 +1345 @@ const GPR = (function () {
-        if (o0 > 1e-9) take(o0, st.name); else if (o1 >= -1e-9 && !atStart) take(0, st.name); } });
+        if (o0 > 1e-9) take(o0, st); else if (o1 >= -1e-9 && !atStart) take(0, st); } });
@@ -1358 +1358 @@ const GPR = (function () {
-      if (es && es.t < L - 1e-9) return { L: es.t, what: `fastener line of ${es.name} (where its fastener field starts alongside the plate edge)`, end: add(q, mul(d, es.t)), edge: true };
+      if (es && es.t < L - 1e-9) return { L: es.t, what: `fastener line of ${es.name} (where its fastener field starts alongside the plate edge)`, end: add(q, mul(d, es.t)), edge: true, stop: es.st, e: d };
@@ -1364 +1364 @@ const GPR = (function () {
-    [1, -1].forEach(s => { let idx = vi >= 0 ? vi + s : (s > 0 ? ei + 1 : ei), cur = q, hit = null, hitE = false; const path = [q];
+    [1, -1].forEach(s => { let idx = vi >= 0 ? vi + s : (s > 0 ? ei + 1 : ei), cur = q, hit = null, hitE = false, hitSt = null, hitU = null; const path = [q];
@@ -1368,3 +1368,3 @@ const GPR = (function () {
-        let tm = 1, w = null, wE = false; stops.forEach(st => { const fd = st.poly; for (let k = 0; k < fd.length; k++) { const t = raySeg(cur, e, fd[k], fd[(k + 1) % fd.length]); if (t != null && t < tm) { tm = t; w = st.name; } } });
-        const es = edgeStop(cur, mul(e, 1 / le), le, [[0, le]], stops, cur === q); if (es && es.t / le < tm - 1e-12) { tm = es.t / le; w = es.name; wE = true; }   // field starts alongside the edge
-        if (w) { hit = w; hitE = wE; cur = add(cur, mul(e, tm)); if (tm * le > 1e-9) path.push(cur); break; }
+        let tm = 1, w = null, wE = false, wSt = null; stops.forEach(st => { const fd = st.poly; for (let k = 0; k < fd.length; k++) { const t = raySeg(cur, e, fd[k], fd[(k + 1) % fd.length]); if (t != null && t < tm) { tm = t; w = st.name; } } });
+        const es = edgeStop(cur, mul(e, 1 / le), le, [[0, le]], stops, cur === q); if (es && es.t / le < tm - 1e-12) { tm = es.t / le; w = es.name; wE = true; wSt = es.st; }   // field starts alongside the edge
+        if (w) { hit = w; hitE = wE; if (wE) { hitSt = wSt; hitU = mul(e, 1 / le); } cur = add(cur, mul(e, tm)); if (tm * le > 1e-9) path.push(cur); break; }
@@ -1373 +1373 @@ const GPR = (function () {
-      if (L > best.L + 1e-9) best = { L, what: hit ? `fastener line of ${hit}${hitE ? ' (where its fastener field starts alongside the plate edge)' : ''}, measured along the plate edge` : 'plate edge, measured along the edge', end: cur, path, ...(hitE ? { edge: true } : {}) }; });
+      if (L > best.L + 1e-9) best = { L, what: hit ? `fastener line of ${hit}${hitE ? ' (where its fastener field starts alongside the plate edge)' : ''}, measured along the plate edge` : 'plate edge, measured along the edge', end: cur, path, ...(hitE ? { edge: true, stop: hitSt, e: hitU } : {}) }; });
@@ -1374,0 +1375,13 @@ const GPR = (function () {
+  /* Distant-field flag (C8, warning only; L_mid is not changed): for an L_mid length z stopped along a plate edge by another member's fastener field
+     (z.edge, z.stop = that field, z.end = stop point S, z.e = unit direction of the edge path at S), look from S perpendicular to the edge toward that
+     field. h = distance from S to the field outline along that perpendicular. The field is "not directly beside the edge" when any other fastener field
+     in `all` (including the member's own) lies on that perpendicular segment between S and the field. Returns { name, h, between, Lalt, altWhat } with
+     the length if the stopping field were ignored (lmidLen with that field removed from `stops`), or null in the ordinary case. */
+  function farField(z, q, d, poly, stops, all) {
+    if (!z.edge || !z.stop || !z.e || !isFinite(z.L)) return null;
+    const S = z.end, fd = z.stop.poly, cen = mul(fd.reduce((a, v) => add(a, v), [0, 0]), 1 / fd.length); let n = [-z.e[1], z.e[0]]; if (dot(sub(cen, S), n) < 0) n = mul(n, -1);
+    const hs = lineHits(S, n, fd).filter(t => t > -1e-7); if (!hs.length) return null; const h = hs[0]; if (h < 1e-6) return null;
+    const a = add(S, mul(n, 1e-6)), b = add(S, mul(n, h - 1e-6)), between = all.filter(st => st !== z.stop && segInPolyCross(a, b, st.poly)).map(st => st.name);
+    if (!between.length) return null;
+    const alt = lmidLen(q, d, poly, stops.filter(st => st !== z.stop));
+    return { name: z.stop.name, h, between, Lalt: alt.L, altWhat: alt.what }; }
@@ -1526,0 +1540,5 @@ const GPR = (function () {
+        // C8 (warning only, no calculation change): a length along the plate edge stopped by a fastener field that is not directly beside the edge
+        W.L3.forEach(z => { const ff = farField(z, z.q, dir, poly, other, stops); if (ff) z.far = ff; });
+        if (W.L3.some(z => z.far)) { W.LmidAlt = W.L3.reduce((s, z) => s + (z.far ? z.far.Lalt : z.L), 0) / 3;
+          const use = isChordCont(i) ? 'not used in any check (continuous chord member, no Whitmore buckling check)' : W.ovL != null ? `not used: L_mid is overridden (${f3(W.ovL)} in)` : `used in the Whitmore buckling check ${m.id}-WB`;
+          warn.push(`Member ${m.id}, L_mid: ${W.L3.map((z, k) => z.far ? `L${k + 1} (${z.nm}) stops along the plate edge where the fastener field of ${z.far.name} starts alongside the edge, but that field is ${f3(z.far.h)} in from the edge at the stop and the fastener field of ${z.far.between.join(', ')} lies between; length used ${f3(z.L)} in, ${f3(z.far.Lalt)} in if that field were ignored (to the ${z.far.altWhat})` : null).filter(Boolean).join('; ')}. Automatic L_mid ${f3(W.LmidAuto)} in (${f3(W.LmidAlt)} in if ignored), ${use}. Judge whether this stop applies (rule C7, engineer's decision 2026-10-05).`); }
@@ -1622 +1640 @@ const GPR = (function () {
-        where: [whitWhere(g), wr('L<sub>mid</sub>', `Average of L<sub>1</sub>, L<sub>2</sub>, L<sub>3</sub> from the Whitmore ends and middle toward the work point, parallel to the member: ${W.L3.map(z => `${f3(z.L)} (${escH(z.what)})`).join(', ')}${W.ovL != null ? ' (overridden)' : ''}${W.clipA || W.clipB ? `. Whitmore end clipped at the plate edge: measured by the same rule as an unclipped end; the plate edge the end lies on does not stop the line${W.L3.some(z => z.path) ? ', and where the plate does not continue toward the work point from that end the length is measured along the plate edge (distance gained parallel to the member)' : ''} (rule confirmed by the engineer 2026-10-05)` : ''}${W.L3.some(z => z.edge) ? '. A length along the plate edge stops where the fastener field of another member starts alongside the edge, i.e. at the start of the projection of that member\'s fastener-field outline onto the edge (engineer\'s decision 2026-10-05)' : ''}`, f3(L), 'in', W.ovL != null ? 'Override' : 'NCHRP W-197; MBE 6A.6.12.6.8'),
+        where: [whitWhere(g), wr('L<sub>mid</sub>', `Average of L<sub>1</sub>, L<sub>2</sub>, L<sub>3</sub> from the Whitmore ends and middle toward the work point, parallel to the member: ${W.L3.map(z => `${f3(z.L)} (${escH(z.what)})`).join(', ')}${W.ovL != null ? ' (overridden)' : ''}${W.clipA || W.clipB ? `. Whitmore end clipped at the plate edge: measured by the same rule as an unclipped end; the plate edge the end lies on does not stop the line${W.L3.some(z => z.path) ? ', and where the plate does not continue toward the work point from that end the length is measured along the plate edge (distance gained parallel to the member)' : ''} (rule confirmed by the engineer 2026-10-05)` : ''}${W.L3.some(z => z.edge) ? '. A length along the plate edge stops where the fastener field of another member starts alongside the edge, i.e. at the start of the projection of that member\'s fastener-field outline onto the edge (engineer\'s decision 2026-10-05)' : ''}${W.L3.some(z => z.far) ? `. <b>Warning, stopping field not directly beside the edge:</b> ${W.L3.map((z, k) => z.far ? `L<sub>${k + 1}</sub> (${z.nm}) stops at the fastener field of ${escH(z.far.name)}, which is ${f3(z.far.h)} in from the edge at the stop, with the fastener field of ${escH(z.far.between.join(', '))} between; ${f3(z.L)} in used, ${f3(z.far.Lalt)} in if that field were ignored (to the ${escH(z.far.altWhat)})` : null).filter(Boolean).join('; ')}; L<sub>mid</sub> would be ${f3(W.LmidAlt)} in. Judge whether this stop applies` : ''}`, f3(L), 'in', W.ovL != null ? 'Override' : 'NCHRP W-197; MBE 6A.6.12.6.8'),
@@ -3030 +3048 @@ function methodHtml() { return `<div class="man-part active">
-  <li><b>L<sub>mid</sub>:</b> the average of the three lengths from the two ends and the middle of the Whitmore section, measured parallel to the member toward the WP, to the nearest fastener line of another member or the plate edge. A continuous chord's fastener field counts as one. A Whitmore end clipped at the plate edge is measured by the same rule, with the plate taken as its closed outline: the edge the end lies on does not stop the line, and a line running along a plate edge stays in the plate. Where the plate does not continue from the end toward the WP (the end lies on an edge or corner and the line would leave the plate at once), the length is measured along the plate edge from the end, over the edges that advance toward the WP, to a fastener line or to where the edge turns away; it is the distance gained parallel to the member. <span class="badge pass" title="Convention confirmed by the engineer">engineer-confirmed 2026-10-05</span> Where a length runs along a plate edge (a free top or bottom edge, or the measurement along the edge), it also stops where the fastener field of another member starts alongside it: at the first point where the line enters the projection of that member's fastener-field outline (the outline through the outer hole centres) onto the line. A field that is already alongside the point the length starts from does not stop it; a line that touches or runs along a fastener-field outline stops there. <span class="badge pass" title="Convention confirmed by the engineer">engineer's decision 2026-10-05</span> The rule does not depend on the orientation of the joint: a mirrored (upper-chord) or rotated joint gives the same L<sub>mid</sub>.</li>
+  <li><b>L<sub>mid</sub>:</b> the average of the three lengths from the two ends and the middle of the Whitmore section, measured parallel to the member toward the WP, to the nearest fastener line of another member or the plate edge. A continuous chord's fastener field counts as one. A Whitmore end clipped at the plate edge is measured by the same rule, with the plate taken as its closed outline: the edge the end lies on does not stop the line, and a line running along a plate edge stays in the plate. Where the plate does not continue from the end toward the WP (the end lies on an edge or corner and the line would leave the plate at once), the length is measured along the plate edge from the end, over the edges that advance toward the WP, to a fastener line or to where the edge turns away; it is the distance gained parallel to the member. <span class="badge pass" title="Convention confirmed by the engineer">engineer-confirmed 2026-10-05</span> Where a length runs along a plate edge (a free top or bottom edge, or the measurement along the edge), it also stops where the fastener field of another member starts alongside it: at the first point where the line enters the projection of that member's fastener-field outline (the outline through the outer hole centres) onto the line. A field that is already alongside the point the length starts from does not stop it; a line that touches or runs along a fastener-field outline stops there. <span class="badge pass" title="Convention confirmed by the engineer">engineer's decision 2026-10-05</span> The tool warns (no change to L<sub>mid</sub>) when the stopping field is not directly beside the edge: another member's fastener field (the member's own included) lies on the line from the stop point perpendicular to the edge, between the edge and the stopping field. The warning gives the length used and the length if that field were ignored. The rule does not depend on the orientation of the joint: a mirrored (upper-chord) or rotated joint gives the same L<sub>mid</sub>.</li>
```

#### How verified (C8)

- `node --check` on every inline script (7 blocks): pass.
- Engine dumps, main e831071 vs this branch, 56 models: every capacity, RF, governing check, W_g, W_n, L_1–L_3, L_mid and block-shear length identical; only the warnings lists differ (19 models, listed above). Synthetic WB cases (chord spliced, L2-L3 at 20°, 30°, 35°, 40°): all checks, RFs and L_mid identical to main.
- Mirror / rotation: the 25 pairs of C6 / C7 (`gl/sym.js`): all identical; the new warnings, normalised for member ids and end 1 ↔ end 2, are identical over the same 25 pairs plus default / validation rotated 137° and 30°, default mirrored + rotated 250°, and the synthetic WB case mirrored and rotated (137°, 250°).
- jsdom: default model loaded from an autosave written by main: results identical; Warnings card (2), status bar "2 warnings", report Warnings list show the flag; Validation tab 17 of 17; Method tab sentence present; synthetic WB case: warnings name L1-L2-WB / L2-L3-WB, L1-L2-WB calc sheet L_mid row and report show the warning, L2-U1-WB does not; spliced default: no flag; all tabs render; no runtime errors.
- Chromium (Playwright): Summary Warnings card (default), L1-L2-WB calc sheet and report Warnings list (synthetic WB case); reviewed; no page errors.
- DXF: Phase 3 round trips (`gp3/rt.js`) and hand-written DXF cases (`gp3/cases.js`): output identical to main.
- Saved data: no key or format change (`gussetRating.autosave.v1`, `gussetRating.projects.v1`, export JSON, DXF unchanged); nothing new is saved.
- **Other copies:** none.
- **Open items:**
  - The C7 open item ("should a field count only when nothing lies between it and the edge?"): closed by C8 (engineer: keep the rule, warn).
  - None new.

### C9 — 2026-10-05 — Hide the distant-field L_mid warning when that L_mid is not used (warning display only)

- **Engineer's decision (2026-10-05):** hide the C8 warning when the L_mid it is about is not used in any check.
- **Where:** `GPR` engine, member geometry loop. Anchor: `// C8 (warning only, no calculation change): a length along the plate edge stopped by a fastener field that is not directly beside the edge`. Also `methodHtml()`, the L_mid item (anchor: `The warning gives the length used and the length if that field were ignored.`).
- **Before:**
  ```js
          warn.push(`Member ${m.id}, L_mid: ${W.L3.map(
  ```
- **After:**
  ```js
          // C9: warn only when this L_mid is used in a check (hidden for a continuous chord member or an overridden L_mid)
          if (!isChordCont(i) && W.ovL == null) warn.push(`Member ${m.id}, L_mid: ${W.L3.map(
  ```
  Method tab, appended after "…if that field were ignored.": `It is shown only when that L<sub>mid</sub> is used in a Whitmore buckling check (not for a continuous chord member or an overridden L<sub>mid</sub>).`
- **Problem:** the C8 warning appeared on every continuous chord member (default model 2 warnings, validation model 1), although a continuous chord has no Whitmore buckling check, so the flagged L_mid is never used.
- **Governing provision:** none changed (warning display only). L_mid per NCHRP W-197 / MBE 3rd Ed. 6A.6.12.6.8 with the C7 rule, unchanged.
- **Check case:**
  - Default model: L_mid warnings 2 → 0; every check result and L_mid identical.
  - Validation model: 1 → 0.
  - Synthetic WB case (chord spliced, L2-L3 at 30°): 2 → 2 (L1-L2-WB and L2-L3-WB still warn; the calc-sheet note is unchanged).
  - Same case with L1-L2 L_mid overridden to 10 in: only L2-L3 warns.
- **How verified:** `node --check` on all 7 inline scripts: pass. The synthetic WB cases at 20°, 30°, 35° and 40° have identical capacities, RFs and L_mid to main (`o19/wbcmp.js`). Default and synthetic models: identical RFs and L_mid, warning counts as above (`o19/c9chk.js`).
- **Other copies:** none.
- **Open items:** none.

## 2026-10-06 — PR: claude/gusset-custom-holes (PR link added after merge)

### C10. Custom (irregular) hole patterns: hole table, DXF import without best fit, limit states generalized to arbitrary holes (s²/4g)   [calculation change for custom patterns only; every grid member computes exactly as before]

Engineer's request (2026-10-06): "Make this more universal so that custom bolt patterns can be accepted." Until now a member's fasteners could only be a regular grid (rows × gage lines, pitch, gage list, offset), and an irregular DXF hole pattern was forced to a best-fit grid (C3 warning + C4 confirmation box). Engineer's decisions: (a) DXF import keeps the holes exactly as drawn; (b) a hole table per member (along, across), editable, add/delete, paste from Excel; holes drawn in 2D/3D exactly there; (c) stagger s²/4g (LRFD 10th Ed. 6.8.3) on every net section that crosses holes, searching the straight path and zig-zag paths and using the minimum net length; (d) Whitmore spread from the outer holes of the row farthest from the WP (convention confirmed again).

#### C10.1 Model and saved data (§5)

- **Member fields (additive):** `pattern: 'grid' | 'custom'` and `holes: [[along, across], ...]` (inches, member-local: along = from the WP along the work line, + outward; across = + to the left looking out along the member). `memberDef()` defaults them to `'grid'` and `[]`, so old projects, autosaves, named projects and JSON exports load unchanged and give identical results (verified, C10.6). One hole diameter per member, from the existing fastener fields (d, hole size).
- **Grid fields of a custom member:** kept filled with the best-fit grid (`GPDXF.fitPattern`, refreshed on every table edit). This copy does not use them; they exist only so that an older copy of the tool, which ignores `pattern`/`holes`, computes with the nearest grid rather than stale values.
- **JSON project files:** `SCHEMA_VERSION` 1 → 2. A file is written as **version 2 only when a member has a custom pattern**; grid-only projects are still written as version 1 and open in older copies. Older copies check `version <= 1` on import, so they **refuse** a version-2 file ("The project is version 2; this tool reads version 1.") instead of computing with the grid fields. This copy reads versions 1 and 2. `data.v` stays 1 (unused).
- **Browser storage** (`gussetRating.autosave.v1`, `gussetRating.projects.v1`): keys and format unchanged; members simply carry the two new fields. An older copy opening such an autosave/named project has no version check: it ignores the hole list and computes with the best-fit grid in the grid fields (verified: case 1 autosave opened in main gives L2-U1-FS LRFR 531.09 kip, the 24-hole best fit, instead of 486.83 kip). Noted in the PR.
- No migration is needed: absent `pattern` means grid; nothing is renamed or removed.

#### C10.2 Generalized rules (each documented in the Method tab and in the calc sheet "where" rows; checks of a custom member carry a "custom holes: verify" badge)

Rows = holes grouped by along offset, gage lines = grouped by across offset, 1/16 in tolerance (`groups1`, centre = median). sIn / sOut = row nearest / farthest from the WP. For a rectangular grid every rule below reduces to the previous grid formula; grid members still run the original code lines unchanged (`memberGeom` grid branch, block-shear grid formulas, no stagger search).

| Limit state | Grid (unchanged) | Custom (generalized) |
|---|---|---|
| Fastener shear | N = n_r n_ℓ × planes; L_j = (n_r − 1)p | N = number of holes × planes (`nf = g.holes.length`, identical integer for grids); L_j = sOut − sIn |
| Bearing | per hole, L_c to next hole in line or edge | same per-hole rule (`lcHoles`, unchanged code) with the actual neighbours |
| Whitmore gross | g_s + 2L tan θ_W, g_s = outer gage lines, L = (n_r − 1)p | g_s = across spread of the holes of the row farthest from the WP, centred on them; L = sOut − sIn; section through the row nearest the WP. Warning if a hole lies outside the spread lines |
| Whitmore net | W_g − Σ(d_h + Δ), holes within d_h/2 of the line (any member) | max of that deduction and the best staggered chain (below) through the member's own holes within the Whitmore ends and within s_b = 2√(W_g d_n) beyond the line, plus the holes on the line |
| Block shear | L_vn = L_vg − 2(n_r − 0.5)d_n; L_tg = g_s; L_tn = g_s − (n_ℓ − 1)d_n | same planes (tension across row sIn between the outer holes t_min…t_max of the whole pattern; shear along t_min and t_max to the edge). Each plane: holes with centre within d_h/2 counted (corner hole at sIn half), or a staggered chain within s_b = 2√(L d_n) if it deducts more; each plane minimized on its own (conservative). Missing corner hole → warning, rectangle still used |
| Partial shear planes | L_g − Σ(d_h + Δ) of holes within d_h/2 | when any member is custom: max of that and, per plate interval of the line, the best chain through the holes on the line plus custom members' holes within s_b = 2√(L d_n,max) |
| L_mid fields | rectangle through the outer hole centres | convex hull of the hole centres (`hull`), = that rectangle for a grid; continuous chord field unchanged (rectangle along the chord enclosing all chord holes) |
| Chord ΔF | N = Σ n_r n_ℓ; L_j from hole projections | N from actual holes; L_j unchanged (already hole based) |
| Drawing / 3D / DXF | grid holes | actual holes (`g.holes`); Whitmore spread drawn from `g.wo` = outer holes of the far row |

**Staggered chain (`chainDed`, LRFD 10th Ed. 6.8.3):** net = gross − Σ w + Σ s²/4g over consecutive holes of a path, s = offset perpendicular to the section line, g = spacing along it (consecutive holes must be more than 1/16 in apart along the line). Dynamic programming over the candidate holes sorted along the line gives the path with the largest deduction D = Σw − Σs²/4g; optional fixed end points (block-shear corners). The section uses D only when it exceeds the straight-line deduction by more than 1e-9 in. A path may run entirely through a nearby row (no stagger terms), so the net width is never taken larger than at a row within the band. **Band s_b = 2√(L d_n):** a single step of more than s_b from the line costs s²/4g ≥ s_b²/(4L) = d_n, i.e. at least one hole's deduction.

**Why grids cannot change:** for a rectangular grid's own holes every monotone path has at most one hole per gage line (or row) and every stagger term is ≥ 0, so no path deducts more than the straight line through a full row/line; in any case grid members never run the search (all-grid joints: partial planes skip it too).

**Inputs and warnings (no check changed):** errors — no holes, a hole without numbers, along offset ≤ 0, two holes within 1/16 in (`holeErrors`). Warnings — hole outside the plate (existing warning), spacing < 3d (LRFD 10th Ed. 6.13.2.6.1), hole outside the Whitmore spread, missing block-shear corner hole.

#### C10.3 §4 callouts

1. **Fastener count N** (`fsGroup`). Before: `nf = g.nR * g.nL`. After: `nf = g.holes.length`. Grid: identical integer. Custom: actual holes. MBE 3rd Ed. 6A.6.12.6.3 / LRFD 10th Ed. 6.13.2.7. Check: case 1, N = 22 × 2 = 44 planes, φR = 0.80(44)(23)(0.6013) = 486.83 kip (was 48 planes, 531.09 kip).
2. **Long-joint length L_j** (custom): sOut − sIn (grid (n_r − 1)p unchanged). LRFD 6.13.2.7, MBE 6A.6.12.5.1. Case 1: 41 − 26 = 15 in < 50 in, R_L = 1.0 (same as grid).
3. **Whitmore gross width** (custom): g_s from the far row only (convention C4, θ_W = 30°), L = sOut − sIn. LRFD 10th Ed. 6.14.2.8, MBE 6A.6.12.6.7. Case 2: far row = one hole (30.5, +1.5) → g_s = 0, W = 0 + 2(10.5) tan 30° = 12.124 in (grid validation diagonal: 5 + 2(9) tan 30° = 15.392 in).
4. **Net widths/lengths with s²/4g** (custom): before, holes within d_h/2 of the line only; after, max of that and the staggered chain. LRFD 10th Ed. 6.8.3 (s²/4g); applied to Whitmore (6.14.2.8, 6.13.5.2), block shear A_vn / A_tn (6.13.4), partial plane A_vn (6.13.5.3, MBE 6A.6.12.6.6). Case 2 Whitmore: 1.000 → 1.8125 in deduction, W_n 11.124 → 10.312 in.
5. **Block shear net lengths** (custom): counted per plane with half corner holes + chain. LRFD 10th Ed. 6.13.4. Case 1: L_tn 7.500 → 8.500 in (one interior hole of the row nearest the WP removed), φR 916.90 → 963.30 kip.
6. **L_mid fastener field** (custom): convex hull of hole centres. NCHRP W-197 / MBE 6A.6.12.6.8 with C7 rule. Case 1: L_mid 11.010 in (unchanged, the removed holes are inside the hull).

No load factor, resistance factor, unit, code parameter or edition changes. Grid members: no computed result changes (C10.6).

#### C10.4 Check cases (hand)

Default code parameters, two 1/2 in A36 plates (Σt = 1.0 in, F_y 36, F_u 58 ksi), 7/8 in rivets r0 (F_v 23 ksi LRFR, φ_s 0.80; 30 ksi LFR), d_h = 0.9375, d_n = d_h + 1/16 = 1.000 in.

**Case 1 — default model, M3 L2-U1 (6 rows × 4 lines, e = 26, p = 3, g = 3.5 → t = −5.25, −1.75, 1.75, 5.25) with row 1 / gage line 2 (26, −1.75) and row 3 / gage line 3 (32, 1.75) removed: 22 holes.** Before = what the original tool produced from a DXF with these 22 circles (C3/C4 best-fit grid: the full 6 × 4 grid, 24 holes, confirmation box); after = custom, exact holes (same result whether imported from that DXF or typed/pasted).

- Fastener shear LRFR: 0.80 × (22 × 2) × 23 × π(0.875)²/4 = 0.80 × 44 × 23 × 0.6013 = **486.83 kip** (before 0.80 × 48 × 23 × 0.6013 = 531.09). LFR: 44 × 30 × 0.6013 = 793.74 (before 865.90).
- Whitmore: g_s = 10.5 (far row complete), L = 15, W = 10.5 + 2(15) tan 30° = 27.821, clipped at the plate to W_g = 25.570 in (unchanged). Straight line at s = 26 crosses 3 holes → 3.000 in; the chain search finds the full row at s = 29 (4 holes, 3 in from the line, inside s_b = 2√(25.570 × 1.0) = 10.113 in, no stagger terms) → 4.000 in governs → W_n = 21.570 in (unchanged; the missing row-1 hole does not raise W_n because row 2 is complete).
- Block shear: L1 = 17.040, L2 = 17.018, L_vg = 34.058 in. Shear planes t = −5.25 and t = 5.25: 6 holes each, corner half → 5.5 + 5.5 = 11 → L_vn = 23.058 (unchanged). Tension plane at s = 26, t −5.25…5.25: holes at −5.25 (½), 1.75 (1), 5.25 (½) = 2 → L_tn = 10.5 − 2 = **8.500 in** (before 7.500). R_n = min(0.58(58)(23.058) + 58(8.5), 0.58(36)(34.058) + 58(8.5)) = min(1268.67, 1204.13); φR = 0.80 × 1204.13 = **963.30 kip** (before 0.80 × (711.13 + 435) = 916.90).
- Bearing LRFR: tension 2296.27 → 2101.39, compression 2338.56 → 2143.68 kip (2 fewer holes). WY 874.50, WF 1000.86, WB 767.40 / 576.32 kip, L_mid 11.010 in: unchanged.
- RFs (L2-U1 in compression, default forces): FS LRFR Inv / Op / LFR Inv / Op **1.1718 / 1.5189 / 2.5634 / 4.2789 → 1.0032 / 1.3004 / 2.2743 / 3.7963**; BR 8.06 / 10.44 / 7.88 / 13.15 → 7.32 / 9.48 / 7.15 / 11.93; WB unchanged 2.07 / 2.69 / 1.40 / 2.34. Governing: LRFR Inv **1.17 → 1.00 (L2-U1-FS)**, LRFR Op 1.52 → 1.30 (L2-U1-FS), LFR Inv 1.40 (L2-U1-WB, unchanged), LFR Op 2.34 (WB, unchanged). With the L2-U1 forces reversed (tension, test only): BS RF 2.64 / 3.42 / 2.77 / 4.62 → 2.82 / 3.65 / 2.95 / 4.93; WY, WF unchanged.
- The best-fit grid was therefore unconservative for fastener shear and bearing by 24/22 (9 %).

**Case 2 — staggered pattern: validation model, diagonal D (45°) with 2 lines at g = 3 in (t = −1.5, +1.5) staggered by s = 1.5 in: line A at s = 20, 23, 26, 29; line B at 21.5, 24.5, 27.5, 30.5 (8 holes).**

- Rows (1/16 in): 8 rows of one hole. Row nearest the WP: s = 20 (hole A1). Far row: s = 30.5 (one hole, t = +1.5) → g_s = 0, centre t = +1.5, L = 30.5 − 20 = 10.5. W = 0 + 2(10.5)(0.57735) = **12.124 in** (not clipped). Warning: holes A3 (26, −1.5) and A4 (29, −1.5) lie outside the spread lines (half-width at s = 29: 1.5 × tan 30° = 0.866 about t = 1.5).
- Whitmore net: straight line at s = 20 crosses A1 only → 1.000. Band s_b = 2√(12.124 × 1.0) = 6.964 in (holes up to s = 26.96). Best chain A1 (s = 20, t = −1.5) → B1 (21.5, +1.5): s = 1.5, g = 3.0, s²/4g = 2.25/12 = 0.1875; D = 2(1.000) − 0.1875 = **1.8125 in** (> 1.000) → W_n = 12.124 − 1.8125 = **10.312 in**. (Only two gage lines, so no path has more than two holes; equal-value chains A2→B2 etc. are not larger.)
- WY LRFR: 0.95 × 36 × 12.124 × 1.0 = **414.65 kip**. WF: A_n = min(10.312, 0.85 × 12.124 = 10.306) = 10.306 → 0.80 × 58 × 10.306 = **478.18 kip**.
- Block shear: t_min = −1.5, t_max = +1.5, L_tg = 3.0; corner (20, −1.5) has hole A1 (½), corner (20, +1.5) has none (warning). Tension: A1 ½ → L_tn = 3 − 0.5 = **2.5**; no intermediate holes. Shear t = −1.5: A1 ½ + A2, A3, A4 = 3.5; chain via line B costs 3²/(4 × 1.5) = 1.5 > 1.0 per hole, not used. Shear t = +1.5: B1…B4 = 4.0. L1 = L2 = 10.500, L_vg = 21.000, L_vn = 21.0 − 7.5 = **13.500**. R_n = min(0.58(58)(13.5) + 58(2.5), 0.58(36)(21.0) + 58(2.5)) = min(599.14, 583.48) → φR = 0.80 × 583.48 = **466.79 kip**.
- Fastener shear unchanged (8 holes): 223.21 kip LRFR. L_mid 21.500 in (field = hull of the 8 holes); WB LRFR 293.35 kip.
- RFs (validation forces): WY 3.39 / 4.39 / 3.27 / 5.46, WF 3.99 / 5.18 / 3.86 / 6.44, BS 3.88 / 5.03 / 3.75 / 6.26 (grid validation diagonal: WY 4.45, WF 5.22, BS 4.55 LRFR Inv); governing remains D-FS 1.56 / 2.03 / 2.11 / 3.52.
- Partial plane SP1 (chord top line): chain computed (12.000 in, the 12 chord holes on the line) equals the straight deduction → L_n = 28.000 in, unchanged.

**Case 3 — a custom pattern that is an exact grid gives the same results as the grid member.** Every member of the default, validation and default-spliced models converted to custom with its grid holes ("Convert to custom"): 132 + 82 + 188 capacities and RFs compared, maximum relative difference **0** (bit-identical); same governing checks; same warnings (no custom-only warnings). Converting back ("Grid") restores the grid fields; results identical.

#### C10.5 UI (§6: grid UI unchanged)

- Members tab, each member: "Fastener pattern: Grid | Custom" switch (the existing `.seg` control). Grid shows the existing fields unchanged. Custom = "Convert to custom" (copies the current grid holes into the table) and shows the hole table (along, across, fractions accepted, × to delete), "Add hole", count, "Paste from Excel" (two columns, tab or comma, header row optional; Replace the table / Add to the table), and validation (errors: duplicates, missing numbers, along ≤ 0; warnings: outside the plate, spacing < 3d). "Grid" converts back only when the holes form an exact regular grid (within 1/16 in); otherwise it is disabled with the reason in its tooltip and a note.
- Checks/report: "custom holes: verify" badge; W_n, A_vn, A_tn, A_vn (planes) "where" rows show the hole counts and any governing staggered path with its s²/4g terms; inputs section lists every hole of each custom member; Method tab section "Custom (irregular) hole patterns".
- DXF import: no best-fit and no confirmation checkbox (C4 checkbox path removed: `cadFitOk`, `#cad-fit-ok`, the "hole off the regular pattern / missing hole" legend); preview shows holes as read; the change table lists "Holes (pattern, count)" per member; an info box names the custom members. Export writes the actual holes. A custom member whose drawn holes equal its own stays custom unchanged (exact round trip).

#### C10.6 How verified

- `node --check` on all 7 inline scripts: pass.
- **Grid models:** 56-model set (`gl/models.js`: default, validation, all templates with ± forces, spliced, mirrored, rotated). Engine dump, main 381e299 vs this branch: rounded dump (`gl/dump.js`) byte-identical; full-precision dump (every capacity, RF, D/C, LaTeX substitution string, "where" rows, warnings, W_g, W_n, L_1–L_3, L_mid, block-shear lengths, plane lengths, L_mid stop polygons) **byte-identical**.
- Prior suites, main vs branch, identical output: `gl/sym.js` (25 mirror/rotation pairs), `o19/symw.js`, `o18/unit.js` (L_mid unit cases), `o19/hand.js`, `o19/c9chk.js`, `gp3/rt.js` (DXF round trips). `gp3/cases.js` (hand-written DXFs) differs only as intended: `06_irregular` and `13_varying_pitch` now import as custom (06: governing LRFR Inv 1.172 → 0.766, L2-U2-FS with the 6 drawn holes instead of the 10-hole best fit), and every import lists the new "Holes (pattern, count)" row.
- Mirror/rotation with custom members (`gch/symc.js`): 5 custom models vs their mirror images (holes [a, c] → [a, −c]) and 2 models rotated 30°, 137°, 250°: all identical.
- Custom DXF round trips (`gch/rtc.js`): case 1, case 2, an all-custom joint, a custom vertical with filler, an exact-grid custom member: export → import onto itself = 0 changes, holes identical, results identical; onto the all-grid model = custom with exactly the exported holes, results identical.
- Check cases 1–3 (`gch/cases.js`): numbers above; case 1 "before" taken from main importing the 22-hole DXF.
- jsdom (`gch/dom.js`, 45 checks): old autosave, old JSON (version 1) and old named project from main load with identical results; switch; Convert to custom (24 rows, results identical); delete; edit with a fraction; spacing/duplicate/outside-plate messages; paste with header (tab) and without (comma); autosave content; JSON version 2 / 1; main refuses version 2; DXF import of the 22-hole drawing (no checkbox, change row, Apply, autosave, Undo); 2D drawing 104 circles; badges; report hole list; Method text; every tab renders; Validation 17 of 17; no runtime errors.
- Chromium (Playwright): hole table and paste box, 2D drawing (case 1 zoom, case 2), 3D view, L2-U1-WF calc sheet, DXF import preview and change table; reviewed.

- **Other copies:** none (the DXF module's `memGeo` duplicates the engine layout inside this file; both updated).
- **Open items (questions for the engineer):**
  1. Whitmore for staggered patterns: with 1/16 in row grouping, the "row farthest from the WP" of a staggered pattern is a single hole (g_s = 0, case 2). Should the far "row" include holes within one stagger distance (e.g. the last two staggered rows) for the spread?
  2. Whitmore net width: a path through a nearby full row (within s_b) is allowed to govern (case 1 keeps W_n = 21.570 in). Confirm, or restrict paths to ones that cross the Whitmore line.
  3. Band s_b = 2√(L d_n) for the stagger search: confirm, or give a fixed band (e.g. one pitch).
  4. Block shear with a missing corner hole: the rectangle between the outer lines is used (warning). Should other block shapes (stepped / L-shaped) be searched?
  5. Bearing L_c "in line" test (centres offset < mean hole radius) for staggered holes offset between d_h/2 and d_h: those holes are not treated as in line (edge distance used instead). Keep?
  6. Older copies opening an autosave / named project with a custom member compute with the best-fit grid (no version check in browser storage). Acceptable, or should the custom member's grid fields be made invalid so older copies stop with an input error?

Exact before/after (unified diff against main 381e299, zero context lines; anchors are the hunk headers' function names and the comments containing "C10"):

```diff
@@ -101,0 +102,5 @@ header {
+.seg button:disabled { opacity: .45; cursor: not-allowed; }
+.pat-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
+.pat-row .pat-lbl { font-size: 12px; font-weight: 600; color: var(--text-dim); }
+.hole-box { display: grid; gap: 8px; }
+.hole-box .atbl input { padding: 0 22px 0 6px !important; }
@@ -1214 +1219,3 @@ const GPR = (function () {
-  const SCHEMA = 'gusset-rating-project', SCHEMA_VERSION = 1;
+  /* project file version: 1 = grid fastener patterns only; 2 (C10) = may contain custom hole patterns. A file is written as version 2 only when a member
+     has a custom pattern, so older copies of the tool (which read version 1 only) refuse it instead of computing with the grid fields. */
+  const SCHEMA = 'gusset-rating-project', SCHEMA_VERSION = 2;
@@ -1391,0 +1399,32 @@ const GPR = (function () {
+  /* ---------- C10: custom (irregular) hole patterns ---------- */
+  const TOLH = 1 / 16;   // holes of a custom pattern within 1/16 in along (across) the member form one row (gage line)
+  const medianOf = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
+  /* 1-D groups (a gap larger than tol starts a new group), ascending: c = group centres (median), of = group index of each value */
+  function groups1(vals, tol) { const o = vals.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), gs = [], of = [];
+    o.forEach(([x, i]) => { const g = gs[gs.length - 1]; if (g && x - g.last <= tol) { g.ix.push(i); g.last = x; } else gs.push({ ix: [i], last: x }); });
+    gs.forEach((g, k) => g.ix.forEach(i => { of[i] = k; })); return { c: gs.map(g => medianOf(g.ix.map(i => vals[i]))), of }; }
+  /* convex hull, counterclockwise (collinear points: the two extremes; one point: itself) */
+  function hull(pts) { const s = pts.map(q => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => crs(sub(a, o), sub(b, o)), lo = [], up = [];
+    if (s.length < 3) return s;
+    s.forEach(q => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 1e-9) lo.pop(); lo.push(q); });
+    for (let i = s.length - 1; i >= 0; i--) { const q = s[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 1e-9) up.pop(); up.push(q); }
+    lo.pop(); up.pop(); return lo.concat(up); }
+  /* Staggered holes on a net section (LRFD 10th Ed. 6.8.3): net length = gross length − Σ(d_h + Δ) + Σ s²/4g over consecutive holes of the path.
+     chainDed returns the path (chain) of holes that removes the most, ded = Σ w − Σ s²/(4g), with s = offset of consecutive holes perpendicular to
+     the section line and g = their spacing along it (consecutive holes must be more than 1/16 in apart along the line).
+     pts: [{ a: position along the line, c: perpendicular offset, w: deduction, h }]; A / B: points the chain must start / end at ({ a, c, w }), or null
+     (free end at the plate edge). Result: { v: deduction, chain: [pts], terms: [{ s, g, x: s²/4g }] }. */
+  function chainDed(pts, A, B) {
+    const q = pts.filter(x => (!A || x.a - A.a > TOLH) && (!B || B.a - x.a > TOLH)).sort((x, y) => x.a - y.a), n = q.length, val = [], prv = [];
+    const cost = (x, y) => (y.c - x.c) * (y.c - x.c) / (4 * (y.a - x.a)), ok = (x, y) => y.a - x.a > TOLH;
+    for (let i = 0; i < n; i++) { let best = A ? A.w - cost(A, q[i]) : 0, bp = -1;
+      for (let j = 0; j < i; j++) if (ok(q[j], q[i])) { const x = val[j] - cost(q[j], q[i]); if (x > best + 1e-9) { best = x; bp = j; } }   // ties: the first chain found
+      val[i] = q[i].w + best; prv[i] = bp; }
+    let bv, bi = -1;
+    if (B) { bv = A ? A.w - cost(A, B) : 0; for (let i = 0; i < n; i++) { const x = val[i] - cost(q[i], B); if (x > bv + 1e-9) { bv = x; bi = i; } } bv += B.w; }
+    else { bv = A ? A.w : 0; for (let i = 0; i < n; i++) if (val[i] > bv + 1e-9) { bv = val[i]; bi = i; } }
+    const chain = []; for (let i = bi; i >= 0; i = prv[i]) chain.unshift(q[i]);
+    const path = [...(A ? [A] : []), ...chain, ...(B ? [B] : [])], terms = [];
+    for (let k = 1; k < path.length; k++) { const s = path[k].c - path[k - 1].c, g = path[k].a - path[k - 1].a; if (Math.abs(s) > 1e-9) terms.push({ s, g, x: s * s / (4 * g) }); }
+    return { v: bv, chain, terms }; }
+
@@ -1393 +1432,4 @@ const GPR = (function () {
-  function memberDef(o) { return deepMerge({ id: 'M', role: 'web', ang: 0, sec: { type: 'box', w: 12, d2: 12, desc: '' }, cut: 0,
+  /* pattern (C10): 'grid' = rows × gage lines from the fast fields (absent in older files: grid); 'custom' = holes [[along, across], ...] in inches,
+     member-local (along from the WP, + outward; across + to the left looking out along the member). The grid fields of a custom member hold the
+     best-fit grid for older copies of the tool only; this copy does not use them. */
+  function memberDef(o) { return deepMerge({ id: 'M', role: 'web', ang: 0, sec: { type: 'box', w: 12, d2: 12, desc: '' }, cut: 0, pattern: 'grid', holes: [],
@@ -1398 +1440 @@ const GPR = (function () {
-      v: SCHEMA_VERSION,
+      v: 1,
@@ -1450,0 +1493 @@ const GPR = (function () {
+    if (m.pattern === 'custom') return customGeom(m, idx, p, u, v);
@@ -1460 +1503,16 @@ const GPR = (function () {
-      field: [P_(sIn, tmin), P_(sOut, tmin), P_(sOut, tmax), P_(sIn, tmax)], w, cut, body: (sEnd) => [P_(cut, -w / 2), P_(sEnd, -w / 2), P_(sEnd, w / 2), P_(cut, w / 2)] };
+      field: [P_(sIn, tmin), P_(sOut, tmin), P_(sOut, tmax), P_(sIn, tmax)], w, cut, body: (sEnd) => [P_(cut, -w / 2), P_(sEnd, -w / 2), P_(sEnd, w / 2), P_(cut, w / 2)],
+      custom: false, wo: [P_(sOut, tmin), P_(sOut, tmax)] };
+  }
+  /* C10: geometry of a custom pattern, with the same meaning as for a grid. Rows = holes grouped by the along offset (1/16 in), gage lines = grouped by
+     the across offset. sIn / sOut = the row nearest to / farthest from the WP; gS, tc = across extent and centre of the farthest row's holes (Whitmore spread);
+     Lc = sOut − sIn; tmin / tmax = outer holes of the whole pattern; field (L_mid stops) = convex hull of the hole centres; wo = Whitmore spread origins. */
+  function customGeom(m, idx, p, u, v) {
+    const f = m.fast, P_ = (s, t) => add(mul(u, s), mul(v, t)), d = num(f.d), dh = holeDia(f, p), dn = dh + p.dNet;
+    const hs = (m.holes || []).map(q => [num((q || [])[0]), num((q || [])[1])]), Rg = groups1(hs.map(q => q[0]), TOLH), Lg = groups1(hs.map(q => q[1]), TOLH);
+    const holes = hs.map(([s, t], k) => { const xy = P_(s, t); return { m: idx, row: Rg.of[k], line: Lg.of[k], s, t, x: xy[0], y: xy[1], d, dh, dn }; });
+    const ss = Rg.c, ts = Lg.c, nR = ss.length, nL = ts.length, sIn = ss[0], sOut = ss[nR - 1], tmin = Math.min(...hs.map(q => q[1])), tmax = Math.max(...hs.map(q => q[1]));
+    const t1st = holes.filter(h => h.row === nR - 1).map(h => h.t), t1 = Math.min(...t1st), t2 = Math.max(...t1st), n = hs.length;
+    const w = num(m.sec.w) || 0, cut = num(m.cut) || 0, cs = hs.reduce((a, q) => a + q[0], 0) / n, ct = hs.reduce((a, q) => a + q[1], 0) / n;
+    return { u, v, P: P_, nR, nL, pitch: NaN, e: sIn, off: (tmin + tmax) / 2, ts, ss, gl: ts.slice(1).map((t, j) => t - ts[j]), d, dh, dn, holes, tmin, tmax, tc: (t1 + t2) / 2, gS: t2 - t1, Lc: sOut - sIn, sIn, sOut,
+      centroid: P_(cs, ct), field: hull(holes.map(h => [h.x, h.y])), w, cut, body: (sEnd) => [P_(cut, -w / 2), P_(sEnd, -w / 2), P_(sEnd, w / 2), P_(cut, w / 2)],
+      custom: true, wo: [P_(sOut, t1), P_(sOut, t2)], t1, t2 };
@@ -1463,0 +1522,7 @@ const GPR = (function () {
+  /* C10: errors in a custom hole list (no holes, a hole without numbers, along offset not beyond the WP, two holes at the same position) */
+  function holeErrors(m) { const E = [], hs = Array.isArray(m.holes) ? m.holes : [], q = hs.map(h => [num((h || [])[0]), num((h || [])[1])]);
+    if (!hs.length) E.push('the custom fastener pattern has no holes.');
+    q.forEach(([a, c], k) => { if (!isFinite(a) || !isFinite(c)) E.push(`hole ${k + 1}: enter numbers for along and across.`); else if (!(a > 0)) E.push(`hole ${k + 1}: the along offset must be positive (beyond the work point).`); });
+    const dup = []; for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) if (Math.hypot(q[i][0] - q[j][0], q[i][1] - q[j][1]) <= TOLH) dup.push(`${i + 1} and ${j + 1}`);
+    if (dup.length) E.push(`holes ${dup.slice(0, 6).join(', ')}${dup.length > 6 ? ' and others' : ''} are at the same position (within 1/16 in); delete the duplicate.`);
+    return E; }
@@ -1478,0 +1544,2 @@ const GPR = (function () {
+      if (m.pattern === 'custom') { holeErrors(m).forEach(x => E.push(`${nm}: ${x}`)); }   // C10: custom pattern (the grid fields are not used)
+      else {
@@ -1481 +1548 @@ const GPR = (function () {
-      if (num(f.nL) > 1 && gageList(f.g, Math.round(num(f.nL))).some(g => !(g > 0))) E.push(`${nm}: gages must be positive numbers.`);
+      if (num(f.nL) > 1 && gageList(f.g, Math.round(num(f.nL))).some(g => !(g > 0))) E.push(`${nm}: gages must be positive numbers.`); }
@@ -1482,0 +1550 @@ const GPR = (function () {
+      if (m.pattern !== 'custom') {
@@ -1484 +1552 @@ const GPR = (function () {
-      if (!isFinite(num(f.off))) E.push(`${nm}: transverse offset must be a number.`);
+      if (!isFinite(num(f.off))) E.push(`${nm}: transverse offset must be a number.`); }
@@ -1512,0 +1581,6 @@ const GPR = (function () {
+    // C10, custom patterns (warnings only): spacing below 3d; holes outside the Whitmore spread lines from the row farthest from the WP
+    G.forEach((g, i) => { if (!g.custom) return; const id = P.members[i].id, hs = g.holes, close = [];
+      for (let a = 0; a < hs.length; a++) for (let b = a + 1; b < hs.length; b++) { const s = Math.hypot(hs[a].x - hs[b].x, hs[a].y - hs[b].y); if (s < 3 * g.d - 1e-9) close.push([s, a, b]); }
+      if (close.length) { close.sort((x, y) => x[0] - y[0]); warn.push(`Member ${id} (custom holes): ${close.length} pair${close.length > 1 ? 's' : ''} of holes closer than 3d = ${f3(3 * g.d)} in (closest: holes ${close[0][1] + 1} and ${close[0][2] + 1}, ${f3(close[0][0])} in apart); check the minimum spacing (LRFD 10th Ed. 6.13.2.6.1). Warning only; the checks are not changed.`); }
+      const tn = Math.tan(p.thW * PI / 180), out = hs.filter(h => Math.abs(h.t - g.tc) > g.gS / 2 + (g.sOut - h.s) * tn + 1e-6);
+      if (out.length) warn.push(`Member ${id} (custom holes): ${out.length} hole${out.length > 1 ? 's lie' : ' lies'} outside the ${f1(p.thW)}° Whitmore spread lines from the outer holes of the row farthest from the WP (hole${out.length > 1 ? 's' : ''} ${out.map(h => hs.indexOf(h) + 1).join(', ')}). The Whitmore section is still taken from that row (convention C4); verify it for this pattern.`); });
@@ -1525,0 +1600,19 @@ const GPR = (function () {
+    /* ----- C10: block shear lengths of a custom pattern. The same planes as for a grid: tension plane across the row nearest the WP (s = sIn) between
+       the outer lines of the pattern (t = tmin, tmax); shear planes along t = tmin and t = tmax from that row outward to the plate edge. Net length of each
+       plane: gross − Σ(d_h + Δ) of the member's holes on it (centre within d_h/2; a hole at a corner, where the planes meet, counts half), or the
+       staggered chain (s²/4g) through the member's holes within s_b = 2√(L d_n) of the plane that deducts more; each plane on its own (conservative).
+       For a rectangular grid this gives 2(n_r − 0.5) and (n_ℓ − 1) holes, as before. A missing corner hole is reported (verify). ----- */
+    function bsCustom(g, B, L1, L2) { const hs = g.holes, dn = g.dn, id = P.members[hs[0].m].id;
+      const corner = t => hs.find(h => Math.abs(h.s - g.sIn) <= TOLH && Math.abs(h.t - t) <= TOLH) || null, c1 = corner(g.tmin), c2 = corner(g.tmax);
+      const shear = (tk, ck, Lk) => { const on = hs.filter(h => Math.abs(h.t - tk) < h.dh / 2 - 1e-9 && h.s >= g.sIn - TOLH), K = on.length - (ck ? 0.5 : 0), band = 2 * Math.sqrt(Lk * dn);
+        const ch = chainDed(hs.filter(h => h !== ck && Math.abs(h.t - tk) <= band + 1e-9).map(h => ({ a: h.s - g.sIn, c: h.t - tk, w: dn, h })), { a: ck ? ck.s - g.sIn : 0, c: ck ? ck.t - tk : 0, w: ck ? dn / 2 : 0 }, null);
+        return { n: on.length, K, straight: K * dn, band, ...ch, used: ch.v > K * dn + 1e-9 }; };
+      const Ltg = g.tmax - g.tmin, on = hs.filter(h => Math.abs(h.s - g.sIn) < h.dh / 2 - 1e-9 && h.t >= g.tmin - TOLH && h.t <= g.tmax + TOLH), Kt = on.reduce((s, h) => s + (h === c1 || h === c2 ? 0.5 : 1), 0), bt = 2 * Math.sqrt(Ltg * dn);
+      const cht = chainDed(hs.filter(h => h !== c1 && h !== c2 && h.s - g.sIn <= bt + 1e-9).map(h => ({ a: h.t, c: h.s - g.sIn, w: dn, h })),
+        { a: c1 ? c1.t : g.tmin, c: c1 ? c1.s - g.sIn : 0, w: c1 ? dn / 2 : 0 }, { a: c2 ? c2.t : g.tmax, c: c2 ? c2.s - g.sIn : 0, w: c2 ? dn / 2 : 0 });
+      const s1 = shear(g.tmin, c1, L1), s2 = shear(g.tmax, c2, L2), t = { n: on.length, K: Kt, straight: Kt * dn, band: bt, ...cht, used: cht.v > Kt * dn + 1e-9 };
+      B.cust = { s1, s2, t, c1: !!c1, c2: !!c2 }; B.LvgAuto = L1 + L2;
+      B.LvnAuto = B.LvgAuto - (s1.used || s2.used ? Math.max(s1.v, s1.straight) + Math.max(s2.v, s2.straight) : (s1.K + s2.K) * dn);
+      B.LtgAuto = Ltg; B.LtnAuto = Ltg - (t.used ? t.v : Kt * dn);
+      if (!c1 || !c2) warn.push(`Member ${id} (custom holes), block shear: no hole at ${!c1 && !c2 ? 'either end' : 'one end'} of the row nearest the WP (at the outer line${!c1 && !c2 ? 's' : ''} t = ${[!c1 ? f3(g.tmin) : null, !c2 ? f3(g.tmax) : null].filter(x => x != null).join(' and ')} in). The block is taken as the rectangle between the outer lines of the pattern from that row to the plate edge; other block shapes are not searched (verify).`); }
+
@@ -1532,0 +1626,5 @@ const GPR = (function () {
+        // C10, custom pattern: staggered chains (s²/4g) through the member's own holes within the band s_b = 2√(W_g d_n) beyond the Whitmore line and
+        // within its ends, and the holes on the line; the larger deduction governs (a grid's own holes cannot give a larger one: no change for grids)
+        if (g.custom) { const ded0 = W.WgAuto - W.WnAuto, band = 2 * Math.sqrt(Math.max(0, W.WgAuto) * g.dn), loc = h => ({ a: dot(sub([h.x, h.y], c), g.v), c: dot(sub([h.x, h.y], c), g.u), w: h.dn, h });
+          const cand = [...new Set([...W.cross, ...g.holes.filter(h => { const q = loc(h); return q.a >= tA - 1e-9 && q.a <= tB + 1e-9 && Math.abs(q.c) <= band + 1e-9; })])];
+          const ch = chainDed(cand.map(loc), null, null); W.stag = { band, straight: ded0, ...ch, used: ch.v > ded0 + 1e-9 }; if (W.stag.used) W.WnAuto = W.WgAuto - ch.v; }
@@ -1553 +1651,3 @@ const GPR = (function () {
-        else { B.LvgAuto = L1 + L2; B.LvnAuto = B.LvgAuto - 2 * (g.nR - 0.5) * g.dn; B.LtgAuto = g.gS; B.LtnAuto = g.gS - (g.nL - 1) * g.dn;
+        else if (g.custom) bsCustom(g, B, L1, L2);   // C10: same planes, holes counted along each plane (corner hole half) with staggered chains
+        else { B.LvgAuto = L1 + L2; B.LvnAuto = B.LvgAuto - 2 * (g.nR - 0.5) * g.dn; B.LtgAuto = g.gS; B.LtnAuto = g.gS - (g.nL - 1) * g.dn; }
+        if (B.ok) {
@@ -1567 +1667 @@ const GPR = (function () {
-    function fsGroup(m, g, meth, Lj) { const f = m.fast, fd = FAST[f.grade], d = g.d, Ab = PI * d * d / 4, Ns = num(f.Ns) === 2 ? 2 : 1, nf = g.nR * g.nL, nfast = nf * (Ns === 2 ? 1 : Np), planes = nfast * Ns;
+    function fsGroup(m, g, meth, Lj) { const f = m.fast, fd = FAST[f.grade], d = g.d, Ab = PI * d * d / 4, Ns = num(f.Ns) === 2 ? 2 : 1, nf = g.holes.length, nfast = nf * (Ns === 2 ? 1 : Np), planes = nfast * Ns;
@@ -1579,0 +1680,5 @@ const GPR = (function () {
+    /* C10: text for a staggered (s²/4g) net-section deduction of a custom pattern; st = { v, straight, chain, terms, band, used } */
+    const stagTxt = st => { if (!st) return ''; if (!st.used) return `; custom holes: no staggered path (s²/4g) through holes within ${f3(st.band)} in of the line deducts more (rule C10, verify)`;
+      const sx = st.terms.reduce((s, q) => s + q.x, 0), nh = st.chain.length;
+      return st.terms.length ? `; custom holes: a staggered path through ${nh} hole${nh === 1 ? '' : 's'} governs: Σ(d<sub>h</sub> + Δ) − Σ s²/4g = ${f3(st.v + sx)} − (${st.terms.map(q => `${f3(Math.abs(q.s))}²/(4 × ${f3(q.g)})`).join(' + ')}) = ${f3(st.v)} in, more than ${f3(st.straight)} in on the straight line (LRFD 6.8.3; rule C10, verify)`
+        : `; custom holes: the path through the ${nh} holes of a nearby row (within ${f3(st.band)} in, no stagger) governs: Σ(d<sub>h</sub> + Δ) = ${f3(st.v)} in, more than ${f3(st.straight)} in on the straight line (rule C10, verify)`; };
@@ -1620 +1725 @@ const GPR = (function () {
-        where: [whitWhere(g), wr('W<sub>n</sub>', `Net Whitmore width: W<sub>g</sub> − Σ(d<sub>h</sub> + ${f4(p.dNet)}) for the ${W.cross.length} hole${W.cross.length === 1 ? '' : 's'} on the section${W.ovN != null ? ' (overridden)' : ''}`, f3(W.Wn), 'in', W.ovN != null ? 'Override' : 'LRFD 6.8.3'), wr('A<sub>n</sub>', capOn ? `Net area, A<sub>n</sub> ≤ ${f2(p.capAn)} A<sub>g</sub> limit applied: ${An < An0 - 1e-9 ? `${f2(p.capAn)} W<sub>g</sub>Σt governs (W<sub>n</sub>Σt = ${f3(An0)} in²)` : `W<sub>n</sub>Σt governs (${f2(p.capAn)} W<sub>g</sub>Σt = ${f3(p.capAn * Ag)} in²)`}` : `Net area W<sub>n</sub>Σt; the A<sub>n</sub> ≤ ${f2(p.capAn)} A<sub>g</sub> limit is not applied (code parameter switched off)`, f3(An), 'in²', 'LRFD 6.13.5.2'), wr('U', 'Shear-lag factor', f2(p.U), '', 'LRFD 6.13.5.2'), wr('φ<sub>u</sub>', 'Resistance factor, fracture', f2(phi), '', lrfr ? 'LRFD 6.5.4.2' : 'FHWA-IF-09-014'), ...plateWhere()],
+        where: [whitWhere(g), wr('W<sub>n</sub>', `Net Whitmore width: W<sub>g</sub> − Σ(d<sub>h</sub> + ${f4(p.dNet)}) for the ${W.cross.length} hole${W.cross.length === 1 ? '' : 's'} on the section${stagTxt(W.stag)}${W.ovN != null ? ' (overridden)' : ''}`, f3(W.Wn), 'in', W.ovN != null ? 'Override' : 'LRFD 6.8.3'), wr('A<sub>n</sub>', capOn ? `Net area, A<sub>n</sub> ≤ ${f2(p.capAn)} A<sub>g</sub> limit applied: ${An < An0 - 1e-9 ? `${f2(p.capAn)} W<sub>g</sub>Σt governs (W<sub>n</sub>Σt = ${f3(An0)} in²)` : `W<sub>n</sub>Σt governs (${f2(p.capAn)} W<sub>g</sub>Σt = ${f3(p.capAn * Ag)} in²)`}` : `Net area W<sub>n</sub>Σt; the A<sub>n</sub> ≤ ${f2(p.capAn)} A<sub>g</sub> limit is not applied (code parameter switched off)`, f3(An), 'in²', 'LRFD 6.13.5.2'), wr('U', 'Shear-lag factor', f2(p.U), '', 'LRFD 6.13.5.2'), wr('φ<sub>u</sub>', 'Resistance factor, fracture', f2(phi), '', lrfr ? 'LRFD 6.5.4.2' : 'FHWA-IF-09-014'), ...plateWhere()],
@@ -1622 +1727 @@ const GPR = (function () {
-    function whitWhere(g) { const W = g.W; return wr('W<sub>g</sub>', `Gross Whitmore width: g<sub>s</sub> + 2L tan θ<sub>W</sub> = ${f3(g.gS)} + 2(${f3(g.Lc)})tan ${f1(p.thW)}° = ${f3(W.Wfull)}${W.clipA || W.clipB ? `, clipped at the plate edge to ${f3(W.WgAuto)}` : ''}${W.ovG != null ? ' (overridden)' : ''}`, f3(W.Wg), 'in', W.ovG != null ? 'Override' : 'LRFD 6.14.2.8'); }
+    function whitWhere(g) { const W = g.W; return wr('W<sub>g</sub>', `Gross Whitmore width: g<sub>s</sub> + 2L tan θ<sub>W</sub> = ${f3(g.gS)} + 2(${f3(g.Lc)})tan ${f1(p.thW)}° = ${f3(W.Wfull)}${W.clipA || W.clipB ? `, clipped at the plate edge to ${f3(W.WgAuto)}` : ''}${W.ovG != null ? ' (overridden)' : ''}${g.custom ? '. Custom holes: g<sub>s</sub> = spread of the holes of the row farthest from the WP, L = distance from that row to the row nearest the WP (rule C10, verify)' : ''}`, f3(W.Wg), 'in', W.ovG != null ? 'Override' : 'LRFD 6.14.2.8'); }
@@ -1628,3 +1733,3 @@ const GPR = (function () {
-          wr('A<sub>vn</sub>', `Net shear area: [L<sub>vg</sub> − 2(n<sub>r</sub> − 0.5)(d<sub>h</sub> + Δ)]Σt, n<sub>r</sub> = ${g.nR}`, `${f3(B.Lvn)} × ${f4(sumT)} = ${f3(Avn)}`, 'in²', 'LRFD 6.8.3'),
-          wr('A<sub>tg</sub>', 'Gross tension area: spread of the outer gage lines × Σt', `${f3(B.Ltg)} × ${f4(sumT)} = ${f3(Atg)}`, 'in²', 'Geometry'),
-          wr('A<sub>tn</sub>', `Net tension area: [g<sub>s</sub> − (n<sub>ℓ</sub> − 1)(d<sub>h</sub> + Δ)]Σt, n<sub>ℓ</sub> = ${g.nL}`, `${f3(B.Ltn)} × ${f4(sumT)} = ${f3(Atn)}`, 'in²', 'LRFD 6.8.3'),
+          wr('A<sub>vn</sub>', B.cust ? `Net shear area: [L<sub>vg</sub> − Σ(d<sub>h</sub> + Δ)]Σt; custom holes on the two planes: ${B.cust.s1.n} and ${B.cust.s2.n} (${[B.cust.c1, B.cust.c2].filter(Boolean).length ? 'the hole at the row nearest the WP counts half' : 'no hole at the corners'})${B.cust.s1.used || B.cust.s2.used ? [B.cust.s1, B.cust.s2].map((q, k) => q.used ? stagTxt(q).replace('; custom holes: a', `; plane ${k + 1}: a`) : '').join('') : stagTxt(B.cust.s1)}` : `Net shear area: [L<sub>vg</sub> − 2(n<sub>r</sub> − 0.5)(d<sub>h</sub> + Δ)]Σt, n<sub>r</sub> = ${g.nR}`, `${f3(B.Lvn)} × ${f4(sumT)} = ${f3(Avn)}`, 'in²', 'LRFD 6.8.3'),
+          wr('A<sub>tg</sub>', `Gross tension area: spread of the outer gage lines × Σt${B.cust ? ' (custom holes: outer holes of the whole pattern)' : ''}`, `${f3(B.Ltg)} × ${f4(sumT)} = ${f3(Atg)}`, 'in²', 'Geometry'),
+          wr('A<sub>tn</sub>', B.cust ? `Net tension area: [L<sub>tg</sub> − Σ(d<sub>h</sub> + Δ)]Σt; custom holes on the plane: ${B.cust.t.n} (holes at the ends count half)${stagTxt(B.cust.t)}` : `Net tension area: [g<sub>s</sub> − (n<sub>ℓ</sub> − 1)(d<sub>h</sub> + Δ)]Σt, n<sub>ℓ</sub> = ${g.nL}`, `${f3(B.Ltn)} × ${f4(sumT)} = ${f3(Atn)}`, 'in²', 'LRFD 6.8.3'),
@@ -1650 +1755 @@ const GPR = (function () {
-        where: [wr('A<sub>vn</sub>', `Net area of the plane: [L<sub>g</sub> − Σ(d<sub>h</sub> + Δ)]Σt, ${pl.cross.length} hole${pl.cross.length === 1 ? '' : 's'} on the plane${pl.ovN != null ? ' (length overridden)' : ''}`, `${f3(pl.Ln)} × ${f4(sumT)} = ${f3(An)}`, 'in²', 'LRFD 6.8.3'), wr('φ<sub>vu</sub>', 'Resistance factor, shear fracture', f2(phi), '', lrfr ? 'LRFD 6.5.4.2' : 'FHWA-IF-09-014'), ...plateWhere()], keys: ['dNet', lrfr ? 'phiVU' : 'phiVUL'] }; }
+        where: [wr('A<sub>vn</sub>', `Net area of the plane: [L<sub>g</sub> − Σ(d<sub>h</sub> + Δ)]Σt, ${pl.cross.length} hole${pl.cross.length === 1 ? '' : 's'} on the plane${stagTxt(pl.stag)}${pl.ovN != null ? ' (length overridden)' : ''}`, `${f3(pl.Ln)} × ${f4(sumT)} = ${f3(An)}`, 'in²', 'LRFD 6.8.3'), wr('φ<sub>vu</sub>', 'Resistance factor, shear fracture', f2(phi), '', lrfr ? 'LRFD 6.5.4.2' : 'FHWA-IF-09-014'), ...plateWhere()], keys: ['dNet', lrfr ? 'phiVU' : 'phiVUL'] }; }
@@ -1660 +1765,8 @@ const GPR = (function () {
-      const cross = holes.filter(h => segs.some(([A, B]) => distSeg([h.x, h.y], A, B) < h.dh / 2 - 1e-9)), LnAuto = LgAuto - cross.reduce((s, h) => s + h.dn, 0);
+      const cross = holes.filter(h => segs.some(([A, B]) => distSeg([h.x, h.y], A, B) < h.dh / 2 - 1e-9)); let LnAuto = LgAuto - cross.reduce((s, h) => s + h.dn, 0), stag = null;
+      // C10: with custom patterns in the joint, staggered chains (s²/4g) along each part of the line inside the plate, through the holes on the line and the
+      // holes of custom patterns within s_b = 2√(L d_n) of it; the larger deduction governs (no change when every member is a grid)
+      if (G.some(g => g.custom)) { const ded0 = LgAuto - LnAuto, dnx = Math.max(...holes.map(h => h.dn)), loc = h => ({ a: dot(sub([h.x, h.y], a), e), c: crs(e, sub([h.x, h.y], a)), w: h.dn, h }); let v = 0, bmax = 0; const terms = [], chain = [];
+        segs.forEach(([A, B], k) => { const band = 2 * Math.sqrt((iv[k][1] - iv[k][0]) * dnx); bmax = Math.max(bmax, band);
+          const ch = chainDed(holes.filter(h => { const q = loc(h); return distSeg([h.x, h.y], A, B) < h.dh / 2 - 1e-9 || (G[h.m].custom && q.a >= iv[k][0] - 1e-9 && q.a <= iv[k][1] + 1e-9 && Math.abs(q.c) <= band + 1e-9); }).map(loc), null, null);
+          v += ch.v; terms.push(...ch.terms); chain.push(...ch.chain); });
+        stag = { band: bmax, straight: ded0, v, terms, chain, used: v > ded0 + 1e-9 }; if (stag.used) LnAuto = LgAuto - v; }
@@ -1671 +1783 @@ const GPR = (function () {
-      planes.push({ qi, nm, kind: q.kind, a, e, iv, segs, LgAuto, LnAuto, Lg, Ln, ovG, ovN, cross, mem, comp, dem, sign });
+      planes.push({ qi, nm, kind: q.kind, a, e, iv, segs, LgAuto, LnAuto, Lg, Ln, ovG, ovN, cross, mem, comp, dem, sign, stag });
@@ -1713 +1825,2 @@ const GPR = (function () {
-    checks.forEach(c => { c.ref = ref[c.ls]; c.unc = [...new Set(Object.values(c.cap).flatMap(o => Object.values(o).flatMap(q => q.keys || [])))].filter(k => PBY[k] && PBY[k].unc); });
+    checks.forEach(c => { c.ref = ref[c.ls]; c.unc = [...new Set(Object.values(c.cap).flatMap(o => Object.values(o).flatMap(q => q.keys || [])))].filter(k => PBY[k] && PBY[k].unc);
+      c.cust = c.mem != null ? G[c.mem].custom : c.chord ? G[c.chord.i0].custom || G[c.chord.i1].custom : c.plane != null ? !!planes[c.plane].stag : false; });   // C10: uses a custom hole pattern (generalized rules, verify)
@@ -1787 +1900 @@ const GPR = (function () {
-  function exportProject(P) { return { _schema: SCHEMA, version: SCHEMA_VERSION, app: 'Gusset Plate Rating', savedAt: new Date().toISOString(), data: P }; }
+  function exportProject(P) { return { _schema: SCHEMA, version: (P.members || []).some(m => m.pattern === 'custom') ? 2 : 1, app: 'Gusset Plate Rating', savedAt: new Date().toISOString(), data: P }; }
@@ -1791 +1904 @@ const GPR = (function () {
-    parseTable, guessWide, applyWide, parseMidas, applyMidas, autoLoadTarget, exportProject, importProject, SCHEMA, SCHEMA_VERSION, geo: { pip, lineIntervals, rayExit, distSeg, polyArea } };
+    parseTable, guessWide, applyWide, parseMidas, applyMidas, autoLoadTarget, exportProject, importProject, SCHEMA, SCHEMA_VERSION, geo: { pip, lineIntervals, rayExit, distSeg, polyArea, hull, inside }, holeErrors, chainDed, TOLH };
@@ -1954 +2067 @@ const GP3D = (function () {
-      if (!w0) s.w = g.gS + 2 * Math.max(1.5, 1.75 * g.d); if (!d0) s.d2 = d2Def;
+      if (!w0) s.w = g.tmax - g.tmin + 2 * Math.max(1.5, 1.75 * g.d); if (!d0) s.d2 = d2Def;
@@ -2046 +2159 @@ const GP3D = (function () {
-      const o1 = g.P(g.sOut, g.tmin), o2 = g.P(g.sOut, g.tmax), e1 = add2(W.c, mul2(g.v, -W.hw)), e2 = add2(W.c, mul2(g.v, W.hw));
+      const o1 = g.wo[0], o2 = g.wo[1], e1 = add2(W.c, mul2(g.v, -W.hw)), e2 = add2(W.c, mul2(g.v, W.hw));
@@ -2163,0 +2277,4 @@ const GPDXF = (function () {
+    if (m.pattern === 'custom') {   // C10: the holes as entered (member-local along, across)
+      const dh = holeDia(f, p), hs = (m.holes || []).map(q => [num((q || [])[0]), num((q || [])[1])]), okC = isFinite(th) && hs.length > 0 && hs.every(q => isFinite(q[0]) && isFinite(q[1])) && isFinite(dh);
+      const holes = okC ? hs.map(([s, t], k) => ({ row: k, line: 0, s, t, x: P_(s, t)[0], y: P_(s, t)[1], dh })) : [], ss = hs.map(q => q[0]);
+      return { ok: okC, custom: true, th, u, v, P: P_, nR: NaN, nL: NaN, pitch: NaN, e: okC ? Math.min(...ss) : NaN, off: 0, ts: hs.map(q => q[1]), ss, dh, holes, sOut: okC ? Math.max(...ss) : 0, w: num(m.sec.w) || 0, cut: num(m.cut) || 0, tf: num(f.tf) || 0 }; }
@@ -2451 +2568 @@ const GPDXF = (function () {
-  /* returns { Q (candidate model), changes:[{grp, field, cur, imp}], warnings, errors, removed:[{i,id}], added:[n], irregular:[{n,tag}] (best-fit grid differs from the drawing), fits:{n:fit}, raw } */
+  /* returns { Q (candidate model), changes:[{grp, field, cur, imp}], warnings, errors, removed:[{i,id}], added:[n], custom:[{n,tag,nH}] (imported as a custom hole pattern), fits:{n:fit} (grid members), raw } */
@@ -2473 +2590 @@ const GPDXF = (function () {
-    const nm = P.members.length, newMembers = [], removed = [], added = [], irregular = [];
+    const nm = P.members.length, newMembers = [], removed = [], added = [], custom = [];
@@ -2493,5 +2610,9 @@ const GPDXF = (function () {
-        if (M.holes.length) { const thr = num(m.ang) * PI / 180, F = fitPattern(M.holes, thr); fits[n] = F;
-          const f = m.fast; f.nR = F.nR; f.nL = F.nL; f.e = r6(F.e); if (F.nR > 1) f.p = r6(F.p); f.off = r6(F.off);
-          if (F.nL > 1) { const gs = gStr(F.gages), cg = gageList(base ? base.fast.g : '', F.nL); if (!(cg.length === F.gages.length && cg.every((x, j) => Math.abs(x - r6(F.gages[j])) < 1e-6))) f.g = gs; }
-          if (F.issues.length) irregular.push({ n, tag });
-          if (F.issues.length) W.push(`${tag}: the hole pattern is not a regular grid; the best-fit regular pattern (${F.nR} rows × ${F.nL} gage lines${F.nR > 1 ? `, pitch ${fs(F.p)} in` : ''}) was imported, so the model has ${F.nR * F.nL} holes where the drawing has ${M.holes.length}. Differences, hole by hole: ${F.issues.join('; ')}.`);
+        if (M.holes.length) { const thr = num(m.ang) * PI / 180, F = fitPattern(M.holes, thr), loc = F.loc.map(h => [r6(h.s), r6(h.t)]);
+          // C10: an exact regular grid (every hole within 1/16 in of its grid point, none missing) -> grid as before; otherwise a custom pattern with the
+          // holes exactly as drawn (no best fit). A custom member whose holes are unchanged stays custom with its own values.
+          if (base && base.pattern === 'custom' && sameHoles(base.holes, loc)) { m.pattern = 'custom'; m.holes = base.holes; custom.push({ n, tag, nH: loc.length }); }
+          else { const f = m.fast; f.nR = F.nR; f.nL = F.nL; f.e = r6(F.e); if (F.nR > 1) f.p = r6(F.p); f.off = r6(F.off);
+            if (F.nL > 1) { const gs = gStr(F.gages), cg = gageList(base ? base.fast.g : '', F.nL); if (!(cg.length === F.gages.length && cg.every((x, j) => Math.abs(x - r6(F.gages[j])) < 1e-6))) f.g = gs; }
+            if (!F.issues.length) { m.pattern = 'grid'; m.holes = []; fits[n] = F; }
+            else { m.pattern = 'custom'; m.holes = loc; custom.push({ n, tag, nH: loc.length });   // the grid fields keep the best-fit grid for older copies of the tool only
+              W.push(`${tag}: the hole pattern is not a regular grid; it was imported as a custom pattern with the ${M.holes.length} holes exactly as drawn (offsets along and across the member). For information, the differences from the nearest regular grid: ${F.issues.join('; ')}.`); } }
@@ -2529 +2650 @@ const GPDXF = (function () {
-    return { Q, changes, warnings: W, errors: E, removed, added, irregular, fits, raw, present };
+    return { Q, changes, warnings: W, errors: E, removed, added, custom, fits, raw, present };
@@ -2530,0 +2652,3 @@ const GPDXF = (function () {
+  /* C10: the same set of holes (any order), each within 1e-4 in */
+  function sameHoles(a, b) { const x = (a || []).map(q => [num(q[0]), num(q[1])]), y = (b || []).map(q => [num(q[0]), num(q[1])]); if (x.length !== y.length) return false; const used = new Set();
+    return x.every(q => { const j = y.findIndex((r, k) => !used.has(k) && Math.abs(q[0] - r[0]) <= 1e-4 && Math.abs(q[1] - r[1]) <= 1e-4); if (j < 0) return false; used.add(j); return true; }); }
@@ -2532 +2656 @@ const GPDXF = (function () {
-  const GEO_F = [['ang', 'ang'], ['cut', 'n'], ['sec.w', 'n'], ['fast.d', 'n'], ['fast.hole', 's'], ['fast.nR', 'n'], ['fast.nL', 'n'], ['fast.p', 'p'], ['fast.g', 'g'], ['fast.e', 'n'], ['fast.off', 'n']];
+  const GEO_F = [['ang', 'ang'], ['cut', 'n'], ['sec.w', 'n'], ['fast.d', 'n'], ['fast.hole', 's'], ['fast.nR', 'n'], ['fast.nL', 'n'], ['fast.p', 'p'], ['fast.g', 'g'], ['fast.e', 'n'], ['fast.off', 'n'], ['pattern', 's'], ['holes', 'h']];
@@ -2538,0 +2663 @@ const GPDXF = (function () {
+    if (kind === 'h') return sameHoles(a, b);
@@ -2543,0 +2669,5 @@ const GPDXF = (function () {
+  /* C10: hole count and pattern of a member for the change table; holes in plate coordinates for the comparison */
+  const GRID_F = ['fast.nR', 'fast.nL', 'fast.p', 'fast.g', 'fast.e', 'fast.off'];
+  const holeN = m => m.pattern === 'custom' ? (m.holes || []).length : Math.round(num(m.fast.nR)) * Math.round(num(m.fast.nL));
+  const holeTxt = m => `${m.pattern === 'custom' ? 'custom' : 'grid'}, ${holeN(m)} hole${holeN(m) === 1 ? '' : 's'}`;
+  const holesXY = m => { const G = memGeo(m, GPR.prm({})); return G.holes.map(h => [h.x, h.y]); };
@@ -2553,2 +2683,3 @@ const GPDXF = (function () {
-      const a = P.members[i], b = Q.members[qi++]; if (!b) break; MEM_F.forEach(([path, kind, lbl]) => { const x = getPath(a, path), y = getPath(b, path); if (!same(x, y, kind, a, b)) C.push({ grp: `Member ${i + 1}: ${a.id}`, field: lbl, cur: show(x, kind), imp: show(y, kind) }); }); }
-    for (; qi < Q.members.length; qi++) { const b = Q.members[qi]; C.push({ grp: `New member: ${b.id}`, field: 'Member', cur: '—', imp: 'ADDED (forces = 0)', kind: 'add' }); MEM_F.forEach(([path, kind, lbl]) => C.push({ grp: `New member: ${b.id}`, field: lbl, cur: '—', imp: show(getPath(b, path), kind), kind: 'add' })); }
+      const a = P.members[i], b = Q.members[qi++]; if (!b) break; MEM_F.forEach(([path, kind, lbl]) => { if (b.pattern === 'custom' && GRID_F.includes(path)) return; const x = getPath(a, path), y = getPath(b, path); if (!same(x, y, kind, a, b)) C.push({ grp: `Member ${i + 1}: ${a.id}`, field: lbl, cur: show(x, kind), imp: show(y, kind) }); });
+      if (String(a.pattern) !== String(b.pattern) || !sameHoles(holesXY(a), holesXY(b))) C.push({ grp: `Member ${i + 1}: ${a.id}`, field: 'Holes (pattern, count)', cur: holeTxt(a), imp: holeTxt(b) + (a.pattern === b.pattern && holeN(a) === holeN(b) ? ' (positions changed)' : '') }); }
+    for (; qi < Q.members.length; qi++) { const b = Q.members[qi]; C.push({ grp: `New member: ${b.id}`, field: 'Member', cur: '—', imp: 'ADDED (forces = 0)', kind: 'add' }); MEM_F.forEach(([path, kind, lbl]) => { if (b.pattern === 'custom' && GRID_F.includes(path)) return; C.push({ grp: `New member: ${b.id}`, field: lbl, cur: '—', imp: show(getPath(b, path), kind), kind: 'add' }); }); C.push({ grp: `New member: ${b.id}`, field: 'Holes (pattern, count)', cur: '—', imp: holeTxt(b), kind: 'add' }); }
@@ -2682 +2813 @@ function memberBlock(m, i) {
-  return `<div class="row-blk mem-blk${open ? '' : ' closed'}" data-mi="${i}"><div class="row-hd"><button type="button" class="mem-tog" data-act="togMember" data-i="${i}" aria-expanded="${open}">${CHEV}</button><span>${esc(m.id)}</span><small class="n-dim">${m.role === 'chord' ? 'chord' : 'web'}, ${f1(num(m.ang))}°</small>
+  return `<div class="row-blk mem-blk${open ? '' : ' closed'}" data-mi="${i}"><div class="row-hd"><button type="button" class="mem-tog" data-act="togMember" data-i="${i}" aria-expanded="${open}">${CHEV}</button><span>${esc(m.id)}</span><small class="n-dim">${m.role === 'chord' ? 'chord' : 'web'}, ${f1(num(m.ang))}°${m.pattern === 'custom' ? `, custom holes (${(m.holes || []).length})` : ''}</small>
@@ -2692,0 +2824 @@ function memberBlock(m, i) {
+      ${patSwitch(m, i)}${m.pattern === 'custom' ? holePane(m, i) : `
@@ -2695 +2827 @@ function memberBlock(m, i) {
-      ${fld('WP to inner row', `members.${i}.fast.e`, 'in', 'dim', { note: 'row nearest WP' })}${fld('Transverse offset', `members.${i}.fast.off`, 'in', 'dim', { note: '+ left of member' })}
+      ${fld('WP to inner row', `members.${i}.fast.e`, 'in', 'dim', { note: 'row nearest WP' })}${fld('Transverse offset', `members.${i}.fast.off`, 'in', 'dim', { note: '+ left of member' })}`}
@@ -2704 +2836 @@ function memberBlock(m, i) {
-function paneMembers() { return `<div class="pad"><p class="hint static">Each member: work line from the work point (WP) at angle θ; fastener rows along the member starting at the row nearest the WP; gage lines centred on the work line plus the transverse offset (+ to the left looking out along the member). Gages: one value, or a list between adjacent lines.</p>
+function paneMembers() { return `<div class="pad"><p class="hint static">Each member: work line from the work point (WP) at angle θ; fastener rows along the member starting at the row nearest the WP; gage lines centred on the work line plus the transverse offset (+ to the left looking out along the member). Gages: one value, or a list between adjacent lines. For an irregular hole pattern choose the fastener pattern “Custom” and list each hole (along, across).</p>
@@ -2708,0 +2841,55 @@ function paneMembers() { return `<div class="pad"><p class="hint static">Each me
+/* ---------- C10: custom (irregular) fastener patterns ---------- */
+const r6u = x => { const y = Math.round(x * 1e6) / 1e6; return Object.is(y, -0) ? 0 : y; };
+/* is the hole list an exact regular grid (rows at a constant pitch × gage lines, every hole within 1/16 in of its grid point, none missing)? */
+function gridFit(m) { const hs = (m.holes || []).map(q => [num((q || [])[0]), num((q || [])[1])]);
+  if (!hs.length || hs.some(q => !isFinite(q[0]) || !isFinite(q[1]))) return { ok: false, why: 'Enter numbers for every hole first.' };
+  const F = GPDXF.fitPattern(hs.map(q => ({ x: q[0], y: q[1] })), 0);
+  return F.issues.length ? { ok: false, F, why: `The holes are not a regular grid (rows at a constant pitch × gage lines): ${F.issues.slice(0, 3).join('; ')}${F.issues.length > 3 ? '; …' : ''}.` } : { ok: true, F }; }
+/* grid fields from a fit (the exact grid on Convert to grid; the best fit kept in a custom member's grid fields for older copies of the tool only) */
+function setGridFields(m, F) { const f = m.fast; f.nR = F.nR; f.nL = F.nL; f.e = r6u(F.e); if (F.nR > 1) f.p = r6u(F.p); f.off = r6u(F.off);
+  if (F.nL > 1) { const g = F.gages.map(r6u); f.g = g.every(x => Math.abs(x - g[0]) < 1e-6) ? String(g[0]) : g.join(', '); } }
+function syncFit(m) { if (m.pattern !== 'custom') return; const r = gridFit(m); if (r.F && r.F.nR >= 1 && r.F.nL >= 1 && isFinite(r.F.e) && (r.F.nR === 1 || r.F.p > 0)) setGridFields(m, r.F); }
+/* the current grid holes, member-local (along, across) */
+function gridHoles(m) { return GPDXF.memGeo(m, GPR.prm(P.code)).holes.map(h => [r6u(h.s), r6u(h.t)]); }
+function patSwitch(m, i) { const cu = m.pattern === 'custom', gf = cu ? gridFit(m) : { ok: true };
+  return `<div class="full pat-row"><span class="pat-lbl">Fastener pattern</span><div class="seg" role="group" aria-label="Fastener pattern of ${esc(m.id)}">
+    <button type="button" id="hgrid-${i}" data-hact="toGrid" data-i="${i}" aria-pressed="${!cu}"${cu && !gf.ok ? ' disabled' : ''} title="${cu ? (gf.ok ? 'Convert to grid: the holes form an exact regular grid' : esc('Convert to grid is not available. ' + gf.why)) : 'Rows × gage lines'}">Grid</button>
+    <button type="button" data-hact="toCustom" data-i="${i}" aria-pressed="${cu}" title="${cu ? 'Custom: hole table' : 'Convert to custom: copies the current grid holes into a table, where single holes can be moved or deleted'}">Custom</button></div>
+    ${cu ? `<span class="lbl-note" id="hgridwhy-${i}">${gf.ok ? 'The holes form an exact grid: Grid converts back.' : 'Grid is not available: not a regular grid.'}</span>` : ''}</div>`; }
+function holePane(m, i) { const hs = m.holes || [];
+  const rows = hs.map((q, k) => `<tr><td class="an">${k + 1}</td><td>${cell(`members.${i}.holes.${k}.0`, 'dim', 'in')}</td><td>${cell(`members.${i}.holes.${k}.1`, 'dim', 'in')}</td><td class="ax"><button type="button" class="x-btn" data-hact="delHole" data-i="${i}" data-h="${k}" title="Delete hole ${k + 1}">×</button></td></tr>`).join('');
+  return `<div class="full hole-box"><p class="note">Hole centres in inches: <b>along</b> the member from the WP (+ outward) and <b>across</b> it (+ to the left looking out along the member). All holes have the diameter set above. Holes within 1/16 in along (across) the member form one row (gage line).</p>
+    <table class="atbl"><thead><tr><th></th><th>Along (in)</th><th>Across (in)</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="n-dim">No holes.</td></tr>'}</tbody></table>
+    <div class="arr-foot"><button type="button" class="proj-btn" data-hact="addHole" data-i="${i}">Add hole</button><span class="arr-sum" id="hcount-${i}">${hs.length} hole${hs.length === 1 ? '' : 's'}</span></div>
+    <div class="ig full"><label for="hpaste-${i}">Paste from Excel <span class="lbl-note">two columns: along, across (tab or comma); a header row is optional</span></label><textarea id="hpaste-${i}" rows="3" placeholder="Along&#9;Across&#10;26&#9;-5.25&#10;26&#9;-1.75"></textarea></div>
+    <div class="proj-row" style="grid-template-columns:1fr 1fr"><button type="button" class="proj-btn" data-hact="pasteReplace" data-i="${i}">Replace the table</button><button type="button" class="proj-btn" data-hact="pasteAdd" data-i="${i}">Add to the table</button></div>
+    <div id="hval-${i}">${holeVal(m)}</div></div>`; }
+/* validation under the hole table: errors (ratings blocked; duplicates are errors) and warnings (outside the plate, spacing < 3d: warnings only) */
+function holeVal(m) { const E = GPR.holeErrors(m), W = [], th = num(m.ang) * Math.PI / 180, d = num(m.fast.d), poly = (P.plates.poly || []).map(q => [num(q[0]), num(q[1])]);
+  const hs = (m.holes || []).map((q, k) => ({ k, s: num((q || [])[0]), t: num((q || [])[1]) })).filter(q => isFinite(q.s) && isFinite(q.t));
+  if (isFinite(th) && poly.length >= 3 && poly.every(q => isFinite(q[0]) && isFinite(q[1]))) { const out = hs.filter(q => !GPR.geo.inside([Math.cos(th) * q.s - Math.sin(th) * q.t, Math.sin(th) * q.s + Math.cos(th) * q.t], poly)).map(q => q.k + 1);
+    if (out.length) W.push(`Hole${out.length > 1 ? 's' : ''} ${out.join(', ')} ${out.length > 1 ? 'are' : 'is'} outside the plate outline.`); }
+  if (d > 0) { const cl = []; for (let a = 0; a < hs.length; a++) for (let b = a + 1; b < hs.length; b++) { const x = Math.hypot(hs[a].s - hs[b].s, hs[a].t - hs[b].t); if (x < 3 * d - 1e-9 && x > GPR.TOLH) cl.push(`${hs[a].k + 1}–${hs[b].k + 1} (${f3(x)} in)`); }
+    if (cl.length) W.push(`Spacing less than 3d = ${f3(3 * d)} in (LRFD 10th Ed. 6.13.2.6.1; warning only, the checks are not changed): holes ${cl.slice(0, 8).join(', ')}${cl.length > 8 ? ` and ${cl.length - 8} more pairs` : ''}.`); }
+  return (E.length ? `<div class="alert fail" style="margin:0"><b>Fix before rating:</b> ${E.map(esc).join(' ')}</div>` : '') + (W.length ? `<div class="alert warn" style="margin:${E.length ? '6px' : '0'} 0 0">${W.map(esc).join(' ')}</div>` : '') + (!E.length && !W.length ? `<p class="hint static" style="margin:0">${hs.length} hole${hs.length === 1 ? '' : 's'}; no duplicates, all inside the plate, spacing at least 3d.</p>` : ''); }
+function holeRefresh(i) { const m = P.members[i]; if (!m || m.pattern !== 'custom') return; const v = $('#hval-' + i); if (v) v.innerHTML = holeVal(m); const c = $('#hcount-' + i); if (c) c.textContent = `${(m.holes || []).length} hole${(m.holes || []).length === 1 ? '' : 's'}`;
+  const gf = gridFit(m), b = $('#hgrid-' + i), w = $('#hgridwhy-' + i); if (b) { b.disabled = !gf.ok; b.title = gf.ok ? 'Convert to grid: the holes form an exact regular grid' : 'Convert to grid is not available. ' + gf.why; } if (w) w.textContent = gf.ok ? 'The holes form an exact grid: Grid converts back.' : 'Grid is not available: not a regular grid.'; }
+/* pasted text -> holes; a first row that is not two numbers is taken as a header */
+function parseHoles(text) { const t = GPR.parseTable(text), out = [], bad = [];
+  t.rows.forEach((r, n) => { const a = num(r[0]), c = num(r[1]); if (r.length >= 2 && isFinite(a) && isFinite(c)) out.push([a, c]); else if (!(n === 0 && !out.length)) bad.push(n + 1); });
+  return { holes: out, bad }; }
+const HACT = {
+  toCustom(i) { const m = P.members[i]; if (m.pattern === 'custom') return false; m.holes = gridHoles(m); m.pattern = 'custom'; },
+  toGrid(i) { const m = P.members[i]; if (m.pattern !== 'custom') return false; const r = gridFit(m); if (!r.ok) { alert(r.why); return false; } setGridFields(m, r.F); m.pattern = 'grid'; m.holes = []; },
+  addHole(i) { const m = P.members[i], hs = m.holes || (m.holes = []), q = hs.map(h => [num(h[0]), num(h[1])]).filter(h => isFinite(h[0]) && isFinite(h[1])); hs.push(q.length ? [r6u(Math.max(...q.map(h => h[0])) + 3), q[q.length - 1][1]] : [6, 0]); },
+  delHole(i, k) { P.members[i].holes.splice(k, 1); },
+  pasteReplace(i) { return HACT.paste(i, true); }, pasteAdd(i) { return HACT.paste(i, false); },
+  paste(i, replace) { const ta = $('#hpaste-' + i), r = parseHoles(ta ? ta.value : ''), m = P.members[i];
+    if (!r.holes.length) { alert('No holes found. Paste two columns of numbers (along, across), tab or comma separated.'); return false; }
+    if (r.bad.length && !confirm(`Row${r.bad.length > 1 ? 's' : ''} ${r.bad.join(', ')} ${r.bad.length > 1 ? 'are' : 'is'} not two numbers and will be skipped. Continue?`)) return false;
+    if (replace && (m.holes || []).length && !confirm(`Replace the ${m.holes.length} holes of ${m.id} with the ${r.holes.length} pasted holes?`)) return false;
+    m.holes = replace ? r.holes : [...(m.holes || []), ...r.holes]; }
+};
+document.addEventListener('click', e => { const b = e.target.closest('[data-hact]'); if (!b || !HACT[b.dataset.hact] || b.disabled) return; const i = +b.dataset.i, m = P.members[i]; if (!m) return;
+  const r = HACT[b.dataset.hact](i, b.dataset.h != null ? +b.dataset.h : undefined); if (r === false) return; syncFit(m); cadEdited(); P.ui.open['m' + i] = true; rebuild(['members']); recompute(); autosave(); });
+
@@ -2751,0 +2939 @@ function onInput(e) {
+  if (/^members\.\d+\.holes\./.test(k)) { const mi = +k.split('.')[1]; syncFit(P.members[mi]); holeRefresh(mi); }   // C10: custom hole table
@@ -2822,0 +3011 @@ const ERR_BADGE = '<span class="badge fail" title="Could not be computed">error<
+const CUST_BADGE = '<span class="badge warn" title="Uses a custom hole pattern: the limit-state rules generalized to arbitrary holes (fix log C10, Method tab). Verify.">custom holes: verify</span>';
@@ -2885 +3074 @@ function svgDrawing(opt = {}) {
-    if (V.whitmore && W.ok) { const c = colFor([`${m.id}-WY`, `${m.id}-WF`, `${m.id}-WB`]), o1 = g.P(g.sOut, g.tmin), o2 = g.P(g.sOut, g.tmax), e1 = add2(W.c, mul2(g.v, -W.hw)), e2 = add2(W.c, mul2(g.v, W.hw));
+    if (V.whitmore && W.ok) { const c = colFor([`${m.id}-WY`, `${m.id}-WF`, `${m.id}-WB`]), o1 = g.wo[0], o2 = g.wo[1], e1 = add2(W.c, mul2(g.v, -W.hw)), e2 = add2(W.c, mul2(g.v, W.hw));
@@ -2917 +3106 @@ function geoTables() {
-    <p class="note-p">Net widths deduct d<sub>h</sub> + ${f4(R.p.dNet)} in for every hole whose centre is within d<sub>h</sub>/2 of the line (any member). "ovr": the value was overridden on the input tab.</p>`;
+    <p class="note-p">Net widths deduct d<sub>h</sub> + ${f4(R.p.dNet)} in for every hole whose centre is within d<sub>h</sub>/2 of the line (any member)${R.G.some(g => g.custom) ? '; with custom hole patterns, a staggered path (s²/4g, LRFD 6.8.3) is used where it deducts more (Method tab, C10)' : ''}. "ovr": the value was overridden on the input tab.</p>`;
@@ -2966 +3155 @@ function renderChecks() {
-    R.checks.filter(c => c.who === w).forEach(c => { const m = minRF(c); h += card('chk-' + c.id, `<span class="cid">${esc(c.id)}</span>${esc(LSNAME[c.ls])}`, '', `<p class="rpt-jump"><a href="#" data-rptjump="cr-chk-${esc(c.id)}">Open in the report</a></p>` + checkBody(c), `${verifyBadge(c.unc)}${c.na ? '<span class="badge na">N/A</span>' : c.err || (m && m.r.err) ? ERR_BADGE : rfBadge(m ? m.r.RF : null, 'min')}`); }); });
+    R.checks.filter(c => c.who === w).forEach(c => { const m = minRF(c); h += card('chk-' + c.id, `<span class="cid">${esc(c.id)}</span>${esc(LSNAME[c.ls])}`, '', `<p class="rpt-jump"><a href="#" data-rptjump="cr-chk-${esc(c.id)}">Open in the report</a></p>` + checkBody(c), `${c.cust ? CUST_BADGE : ''}${verifyBadge(c.unc)}${c.na ? '<span class="badge na">N/A</span>' : c.err || (m && m.r.err) ? ERR_BADGE : rfBadge(m ? m.r.RF : null, 'min')}`); }); });
@@ -3051,0 +3241,9 @@ function methodHtml() { return `<div class="man-part active">
+  <h3>Custom (irregular) hole patterns <span class="badge warn" title="Generalized rules; verify">verify</span></h3>
+  <p>A member's fasteners are either a <b>grid</b> (rows × gage lines, as above) or <b>custom</b>: a list of holes, each given by its offset <b>along</b> the member from the WP (+ outward) and <b>across</b> it (+ to the left looking out along the member), all with the member's hole diameter. Holes within 1/16 in along (across) the member form one row (gage line). The limit states use the same definitions as for a grid, applied to the actual holes; for a rectangular grid each rule below gives exactly the grid result, and grid members are computed exactly as before (fix log C10).</p>
+  <ul><li><b>Fastener shear:</b> N = number of holes × shear planes; long-joint length L<sub>j</sub> = distance along the member between the extreme holes. Continuous chord: N and L<sub>j</sub> from the actual holes of both chord members.</li>
+  <li><b>Bearing:</b> for each hole, L<sub>c</sub> in the force direction to the nearest hole in line (centres offset less than half the sum of the radii) or to the plate edge, as for a grid, with the actual neighbours.</li>
+  <li><b>Whitmore section:</b> spread at θ<sub>W</sub> from the outer holes of the row farthest from the WP (g<sub>s</sub> = their spread across the member, centred on them) to the line through the row nearest the WP (L = distance between the two rows). A warning is given when a hole lies outside the spread lines.</li>
+  <li><b>Staggered holes (s²/4g, LRFD 10th Ed. 6.8.3):</b> on every net section of a custom pattern, the net length is the gross length minus Σ(d<sub>h</sub> + Δ) plus Σ s²/4g over consecutive holes of a path (s = offset of two consecutive holes perpendicular to the section line, g = their spacing along it). The tool searches the straight line and every zig-zag path, through holes ordered along the section, within the band s<sub>b</sub> = 2√(L d<sub>n</sub>) of the line (L = gross length of the section, d<sub>n</sub> = d<sub>h</sub> + Δ; a step of more than s<sub>b</sub> costs at least d<sub>n</sub>), and uses the path that deducts the most. A path may run through the holes of a nearby row without touching the line itself, so the net width is not taken larger than at a row within the band. Whitmore: the member's own holes within the Whitmore ends, plus every hole on the line. Partial shear planes: the holes on the line plus the holes of custom members within the band. Each net length is minimized on its own (conservative).</li>
+  <li><b>Block shear:</b> tension plane across the row nearest the WP between the outer holes of the whole pattern (across); shear planes along those two outer lines from that row to the plate edge. Net lengths deduct the member's holes on each plane (centre within d<sub>h</sub>/2; a hole at a corner, where the planes meet, counts half), or a staggered path within the band if it deducts more. If there is no hole at a corner, the rectangle is still used and a warning is given (other block shapes are not searched).</li>
+  <li><b>L<sub>mid</sub>:</b> a member's fastener field is the convex hull of its hole centres (for a grid, the rectangle through the outer hole centres, as before); a continuous chord's field is the rectangle along the chord that encloses all chord holes, as before.</li>
+  <li><b>Inputs and warnings:</b> holes need numbers, an along offset beyond the WP and distinct positions (two holes within 1/16 in: error). Holes outside the plate and spacing below 3d (LRFD 10th Ed. 6.13.2.6.1) are warnings only. “Convert to custom” copies the grid holes into the table; “Grid” converts back only when the holes form an exact regular grid (within 1/16 in).</li></ul>
@@ -3059 +3257 @@ function methodHtml() { return `<div class="man-part active">
-  <li><b>GP-M&lt;n&gt;-BOLT</b>: CIRCLEs, the holes of member n (diameter = hole diameter). They are grouped into gage lines (across the member) and rows (along it) with a 1/16 in tolerance, giving rows, gage lines, pitch, gages, WP to inner row and transverse offset. An irregular pattern is imported as the best-fit regular pattern and every difference is listed hole by hole; Apply stays disabled until the box confirming the best-fit grid is ticked. The fastener diameter is kept if the circles match it, otherwise taken from M&lt;n&gt;.D or inferred as hole − 1/16 in (warning).</li>
+  <li><b>GP-M&lt;n&gt;-BOLT</b>: CIRCLEs, the holes of member n (diameter = hole diameter). They are grouped into gage lines (across the member) and rows (along it) with a 1/16 in tolerance. A regular grid (every hole within 1/16 in of its grid point, none missing) gives rows, gage lines, pitch, gages, WP to inner row and transverse offset; any other pattern is imported as a custom pattern with the holes exactly as drawn (no best fit). A custom member whose holes did not change keeps its values. Export writes the actual holes. The fastener diameter is kept if the circles match it, otherwise taken from M&lt;n&gt;.D or inferred as hole − 1/16 in (warning).</li>
@@ -3064 +3262 @@ function methodHtml() { return `<div class="man-part active">
-  <li>Import shows the current model and the drawing side by side, every change (field, current, imported) and the warnings. Apply replaces only these geometry and data fields; member forces, live load columns, code parameters, shear-plane definitions and rating settings stay. A member added in the drawing gets default section and fastener data and zero forces; members missing from the drawing are removed only after their removal is ticked. Undo import restores the previous inputs until the next edit.</li></ul>
+  <li>Import shows the current model and the drawing side by side (holes as read), every change (field, current, imported; the hole pattern and count of each member) and the warnings. Apply replaces only these geometry and data fields; member forces, live load columns, code parameters, shear-plane definitions and rating settings stay. A member added in the drawing gets default section and fastener data and zero forces; members missing from the drawing are removed only after their removal is ticked. Undo import restores the previous inputs until the next edit.</li></ul>
@@ -3104 +3302 @@ function cadShow(res, file) {
-  const pv = GPDXF.previewPair(P, res), ch = res.changes, W = res.warnings, rm = res.removed, irr = res.irregular || [];
+  const pv = GPDXF.previewPair(P, res), ch = res.changes, W = res.warnings, rm = res.removed, cus = res.custom || [];
@@ -3109 +3307 @@ function cadShow(res, file) {
-    <p class="cap"><span class="lgd"><i style="border-color:#252d29;background:#f4f1e8"></i>plate</span><span class="lgd"><i style="border-color:#c3352b"></i>work line</span><span class="lgd"><i style="border-color:#2c7a4b"></i>member outline</span><span class="lgd"><i style="border-color:#1d56a3;border-radius:50%"></i>hole</span><span class="lgd"><i style="border-color:#c3352b;background:rgba(195,53,43,.25);border-radius:50%"></i>hole off the regular pattern</span><span class="lgd"><i style="border-color:#c3352b;border-style:dashed;border-radius:50%"></i>missing hole (added by the best fit)</span></p>
+    <p class="cap"><span class="lgd"><i style="border-color:#252d29;background:#f4f1e8"></i>plate</span><span class="lgd"><i style="border-color:#c3352b"></i>work line</span><span class="lgd"><i style="border-color:#2c7a4b"></i>member outline</span><span class="lgd"><i style="border-color:#1d56a3;border-radius:50%"></i>hole (as drawn)</span></p>
@@ -3112 +3310 @@ function cadShow(res, file) {
-    ${irr.length ? `<div class="alert fail"><label class="ck-row" style="padding:0"><input type="checkbox" id="cad-fit-ok"><label for="cad-fit-ok">I confirm the best-fit regular grid is acceptable for <b>${irr.map(r => esc(r.tag)).join(', ')}</b> (the model may count holes not in the drawing, which is unconservative for fastener shear and bearing). Required to apply.</label></label></div>` : ''}
+    ${cus.length ? `<div class="alert info"><b>Custom hole patterns:</b> ${cus.map(r => `${esc(r.tag)} (${r.nH} holes)`).join(', ')} ${cus.length > 1 ? 'are' : 'is'} read with the holes exactly as drawn (not a regular grid; see the Members tab, fastener pattern “Custom”).</div>` : ''}
@@ -3116,3 +3314,2 @@ function cadShow(res, file) {
-/* Apply is enabled only with changes and, for an irregular hole pattern, the best-fit confirmation ticked */
-const cadFitOk = res => !(res.irregular || []).length || !!($('#cad-fit-ok') || {}).checked;
-function cadApplyState() { const res = CAD_RES, b = $('#cad-apply'); if (!b || !res || res.error) return; b.disabled = !res.changes.length || !cadFitOk(res); }
+/* Apply is enabled only when something would change */
+function cadApplyState() { const res = CAD_RES, b = $('#cad-apply'); if (!b || !res || res.error) return; b.disabled = !res.changes.length; }
@@ -3121 +3317,0 @@ function cadApply() {
-  if (!cadFitOk(res)) { alert('Tick the box to confirm the best-fit regular hole pattern, or Cancel.'); cadApplyState(); return; }
@@ -3136 +3332 @@ document.addEventListener('click', e => { const id = e.target.id; if (!id || !/^
-document.addEventListener('change', e => { if (e.target.id === 'cad-tpl') { CAD_TPL = e.target.value; return; } if (e.target.id === 'cad-fit-ok') { cadApplyState(); return; } if (e.target.id !== 'cad-file') return; const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
+document.addEventListener('change', e => { if (e.target.id === 'cad-tpl') { CAD_TPL = e.target.value; return; } if (e.target.id !== 'cad-file') return; const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
@@ -3185 +3381 @@ function crInputs() {
-  const mem = `<table class="cr-tbl cr-wide"><thead><tr><th>Member</th><th>Role</th><th>θ (deg)</th><th>Section</th><th>Fastener</th><th>d (in)</th><th>Rows × lines</th><th>p (in)</th><th>g (in)</th><th>e (in)</th><th>Offset (in)</th><th>Planes</th><th>Filler (in)</th><th>Holes</th></tr></thead><tbody>${P.members.map(m => { const f = m.fast; return `<tr><td>${esc(m.id)}</td><td>${m.role}</td><td class="n">${f1(num(m.ang))}</td><td>${esc((SECT.find(s => s[0] === m.sec.type) || [0, ''])[1])}${m.sec.desc ? ', ' + esc(m.sec.desc) : ''}, ${frac(num(m.sec.w))} in wide</td><td>${esc(GPR.FAST[f.grade].lbl)}${GPR.FAST[f.grade].kind === 'bolt' ? `, threads ${f.thr === 'incl' ? 'included' : 'excluded'}` : ''}</td><td class="n">${frac(num(f.d))}</td><td class="n">${f.nR} × ${f.nL}</td><td class="n">${frac(num(f.p))}</td><td class="n">${esc(f.g)}</td><td class="n">${frac(num(f.e))}</td><td class="n">${frac(num(f.off) || 0)}</td><td class="n">${f.Ns}</td><td class="n">${frac(num(f.tf) || 0)}</td><td>${f.hole}, ${f.prep}</td></tr>`; }).join('')}</tbody></table>`;
+  const mem = `<table class="cr-tbl cr-wide"><thead><tr><th>Member</th><th>Role</th><th>θ (deg)</th><th>Section</th><th>Fastener</th><th>d (in)</th><th>Rows × lines</th><th>p (in)</th><th>g (in)</th><th>e (in)</th><th>Offset (in)</th><th>Planes</th><th>Filler (in)</th><th>Holes</th></tr></thead><tbody>${P.members.map(m => { const f = m.fast; return `<tr><td>${esc(m.id)}</td><td>${m.role}</td><td class="n">${f1(num(m.ang))}</td><td>${esc((SECT.find(s => s[0] === m.sec.type) || [0, ''])[1])}${m.sec.desc ? ', ' + esc(m.sec.desc) : ''}, ${frac(num(m.sec.w))} in wide</td><td>${esc(GPR.FAST[f.grade].lbl)}${GPR.FAST[f.grade].kind === 'bolt' ? `, threads ${f.thr === 'incl' ? 'included' : 'excluded'}` : ''}</td><td class="n">${frac(num(f.d))}</td>${m.pattern === 'custom' ? `<td class="n">custom, ${(m.holes || []).length} holes</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td class="n">—</td>` : `<td class="n">${f.nR} × ${f.nL}</td><td class="n">${frac(num(f.p))}</td><td class="n">${esc(f.g)}</td><td class="n">${frac(num(f.e))}</td><td class="n">${frac(num(f.off) || 0)}</td>`}<td class="n">${f.Ns}</td><td class="n">${frac(num(f.tf) || 0)}</td><td>${f.hole}, ${f.prep}</td></tr>`; }).join('')}</tbody></table>`;
@@ -3187 +3383,3 @@ function crInputs() {
-  return [{ t: 'Gusset plates and rating basis', h: plates }, { t: 'Plate outline', h: poly }, { t: 'Members and fasteners', h: mem }, { t: 'Member forces', h: frc }];
+  const cus = P.members.map((m, i) => [m, i]).filter(([m]) => m.pattern === 'custom');   // C10: custom hole patterns, every hole listed
+  const holes = cus.map(([m, i]) => { const g = R.G[i]; return `<p class="cr-note"><b>${esc(m.id)}</b>: ${g.holes.length} holes, ${g.nR} row${g.nR > 1 ? 's' : ''} and ${g.nL} gage line${g.nL > 1 ? 's' : ''} (holes within 1/16 in grouped); along = from the WP along the member, across = + to the left looking out along the member.</p><table class="cr-tbl"><thead><tr><th>Hole</th><th>Along (in)</th><th>Across (in)</th><th>x (in)</th><th>y (in)</th></tr></thead><tbody>${g.holes.map((h, k) => `<tr><td>${k + 1}</td><td class="n">${f3(h.s)}</td><td class="n">${f3(h.t)}</td><td class="n">${f3(h.x)}</td><td class="n">${f3(h.y)}</td></tr>`).join('')}</tbody></table>`; }).join('');
+  return [{ t: 'Gusset plates and rating basis', h: plates }, { t: 'Plate outline', h: poly }, { t: 'Members and fasteners', h: mem }, ...(cus.length ? [{ t: 'Custom hole patterns', h: holes }] : []), { t: 'Member forces', h: frc }];
@@ -3200 +3398 @@ function buildReport(o) {
-  if (o.checks) { const ws = [...new Set(R.checks.map(c => c.who))]; ws.forEach(w => { body += `<section class="cr-sec">${H1(w)}`; R.checks.filter(c => c.who === w).forEach(c => { const m = minRF(c); body += `<div class="cr-sub">${H2(`${LSNAME[c.ls]} (${c.id})`, c.unc.length ? 'contains parameters to verify' : '', 'cr-chk-' + c.id)}<div class="cr-body">${checkBody(c, { gov: o.detail === 'gov' }).replace(/<span class="badge[^"]*"[^>]*>[^<]*<\/span>/g, '')}</div>${c.na ? '' : m && m.r.err ? `<div class="cr-line cr-res"><div class="cr-d">Lowest rating factor:</div><div class="cr-m"><b>not determined</b> (could not be computed for ${esc(R.cases[m.j].label)})</div><div class="cr-r cr-st-fail"><b>ERROR</b></div></div>` : `<div class="cr-line cr-res"><div class="cr-d">Lowest rating factor:</div><div class="cr-m"><b>${m ? f2(m.r.RF) : '—'}</b>${m ? ` (${esc(R.cases[m.j].label)})` : ''}</div><div class="cr-r ${m && m.r.RF < 1 ? 'cr-st-fail' : ''}"><b>${m ? (m.r.RF < 1 ? 'RF < 1.00' : 'RF ≥ 1.00') : 'n/a'}</b></div></div>`}</div>`; }); body += `</section>`; }); }
+  if (o.checks) { const ws = [...new Set(R.checks.map(c => c.who))]; ws.forEach(w => { body += `<section class="cr-sec">${H1(w)}`; R.checks.filter(c => c.who === w).forEach(c => { const m = minRF(c); body += `<div class="cr-sub">${H2(`${LSNAME[c.ls]} (${c.id})`, [c.unc.length ? 'contains parameters to verify' : '', c.cust ? 'custom hole pattern: generalized rules, verify' : ''].filter(Boolean).join('; '), 'cr-chk-' + c.id)}<div class="cr-body">${checkBody(c, { gov: o.detail === 'gov' }).replace(/<span class="badge[^"]*"[^>]*>[^<]*<\/span>/g, '')}</div>${c.na ? '' : m && m.r.err ? `<div class="cr-line cr-res"><div class="cr-d">Lowest rating factor:</div><div class="cr-m"><b>not determined</b> (could not be computed for ${esc(R.cases[m.j].label)})</div><div class="cr-r cr-st-fail"><b>ERROR</b></div></div>` : `<div class="cr-line cr-res"><div class="cr-d">Lowest rating factor:</div><div class="cr-m"><b>${m ? f2(m.r.RF) : '—'}</b>${m ? ` (${esc(R.cases[m.j].label)})` : ''}</div><div class="cr-r ${m && m.r.RF < 1 ? 'cr-st-fail' : ''}"><b>${m ? (m.r.RF < 1 ? 'RF < 1.00' : 'RF ≥ 1.00') : 'n/a'}</b></div></div>`}</div>`; }); body += `</section>`; }); }
```
