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
- **A_n ≤ 0.85 A_g** applied to the Whitmore net section (LRFD 6.13.5.2); it governs the validation case. Set to 1.0 if not applicable to gussets.
- **Filler reduction applied to rivets** (LRFD 6.13.6.1.5 is written for bolts); γ is taken as t_filler / t_plate (thinnest gusset plate), an approximation of A_f/A_p.
- **Counteracting dead load factors:** γ_DC,min 0.90, γ_DW,min 0.65 (LRFR) and A1,min 1.0 (LFR) are judgment.
- **Condition and system factors** default 1.0; MBE Table 6A.4.2.4-1 lists φ_s = 0.90 for riveted members in truss bridges. Confirm what the owner applies to gusset plates.
- **Article numbers** of MBE 6A.6.12.6.x and LRFD 6.14.2.8.x sub-articles are cited as recalled.
- **Unknown-steel presets** (MBE Table 6A.6.2.1-1): before 1905 26/52, 1905–1936 30/60, 1936–1963 33/66, after 1963 36/66 ksi.
- **Geometric conventions to confirm:** Whitmore spread from the row farthest from the WP to the row nearest it; L_mid stop = nearest other-member fastener-field outline or plate edge; block shear only for tension, rectangular block; automatic shear planes through the top/bottom line of chord fasteners (through the holes).

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
  - O6. Live load concurrency: shear-plane and chord ΔF demands treat the entered member LL forces as concurrent; envelope forces from different truck positions should be entered as separate columns.
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
  - O11. Irregular fastener patterns (missing, staggered or unevenly pitched holes) can only be imported as the best-fit regular grid, because the model stores rows × gage lines at one pitch. The best fit may count holes that are not in the drawing (unconservative for fastener shear and bearing); the warning lists each one. Storing irregular patterns would need new project fields (a format change with a migration) — not done.
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
