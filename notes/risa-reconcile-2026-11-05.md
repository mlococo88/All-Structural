# Seymour Platform Foundation: RISAFoundation v16 vs Spread Footing tool, reconciliation

Prepared 2026-11-05. Read-only review; no repository was changed.

Sources:
- RISA: `/home/user/temp_app_ouputs/RISA Output 1.pdf`, `Risa output 2.pdf` (RISAFoundation Version 16, model "App Comparison.fnd", 220 pp each).
- Tool input: `Seymour Platform Foundation_inputs.json`.
- Tool report: `Spread Footing Design Tool.pdf` (67 pp).
- Tool run myself, headless, from `origin/main` at **805f83c** (#763, term-by-term overturning, merged 2026-11-04 22:42 -0500), and for comparison from 3cbdd94 (the main before #763). Runs are in `scratchpad/rec/out_main2` (805f83c), `out_main` (3cbdd94) and `outv/` (variants below).

## 0. Short answer

The two programs model **different structures**:

- **RISA** models a **2-D wall footing** ("Wall Footings: TYP. WALL DESIGN", N35 to N45, 13 ft long, 32 in wall, 7.25 ft tall, 1.5 ft toe and 1.5 ft heel, 24 in footing). It smears every load uniformly over the 13 ft. It designs only the **cross-section** (out-of-plane, transverse direction). It states that the in-plane wall forces are **not used for design**: M in plane 291.24 k-ft and V in plane 15.95 k (LC 13).
- **The tool** models a **3-D combined footing**, 5 × 13 ft, with two pedestals that together form the wall. The big wind moment along the wall (Mx = 120.2 k-ft plus V·(t+h) = 15.1 × 9.25 k-ft) goes into the bearing pressure, the overturning about the ±y edges, sliding in y, longitudinal flexure, punching and the pedestal design.

I made a tool variant that copies RISA. It aligns four inputs (B = 5.667 ft, f'c = 3000 psi, μ = 0.30, wind Vx sign) and removes the in-plane loads. With that variant the tool reproduces **every RISA service-level number to 3 significant figures**, for every combination with +W:

- bearing: 1.816 / 2.309 / 2.027 / 2.344 / 1.939 / **2.436** / 1.213 ksf;
- out-of-plane overturning FS: 100.16 / 53.78 / 72.18 / 65.14 / 58.96 / 53.63;
- sliding FS: 129.9 / 70.7 / 94.7 / 85.35 / 77.6 / 70.5.

It also reproduces the toe flexure exactly: M_u = 36.29 k-ft / 13 ft = **2.791 k-ft/ft** (RISA 2.791).

So there is **no calculation bug** behind the large differences. They come from:

1. the in-plane load path, a legitimate method difference, where RISA is unconservative for this short wall;
2. four input mismatches;
3. a few smaller method differences (load factor on L, wind reversal, size-effect factor λs, bar layer order, dowel minimum for a column vs a wall).

## 1. Are the two RISA PDFs identical?

- md5: `8be2136f…` (Output 1) vs `7bef80f6…` (Output 2). The bytes differ (7.56 MB vs 7.43 MB; Bluebeam re-stapled).
- `pdftotext -layout` text: **identical** once the print time stamps are removed (Output 1 printed 10:30:15 PM, Output 2 10:33:41 PM; same date 11/4/2026, same model file, same page count).
- Rendered pages (40 dpi, fuzz 20 %): at most 26 pixels differ on any page, all in the time-stamp area.
- **Conclusion: same model, same results, printed twice.** Only Output 1 is cited below.

## 2. Spread Footing report PDF: version

- The report carries no version string. It shows calc date 11/1/2026 and was printed 2026-11-05 03:35 UTC (Chrome 156).
- Its content matches main **before #760**:
  - the 3.4 resultant table has no itemised applied-M or V·(t+h) rows;
  - the edge tables have one lumped "Applied M + V·h couple" row (before #761);
  - it already has the LRFD reference sections 4.6 and 5.5 (#757, 8e5ecd4).
- So it was printed from a build between 8e5ecd4 and 76b69b8. Every computed number in it equals the 3cbdd94 run, because #758 to #762 are display-only.
- **What #763 changes** (the PDF is older than #763):

| Item | PDF / pre-#763 (net bucketing) | main 805f83c (term by term) |
|---|---|---|
| Governing overturning | **FS 3.14**, edge +y, 0.6D+0.6(+Wx), M_r 557.38 / M_o 177.60 | **FS 3.09**, edge −y, 0.6D+0.6(−Wx), M_r 519.38 / M_o 168.18 |
| 0.6D+0.6(−Wx), −y edge | 497.7 / 146.5 = 3.40 | 519.4 / 168.2 = 3.09 |
| D+0.6(−Wx), −y | 6.28 | 5.15 |
| D+0.75L+0.45(−Wx)+0.75S, −y | 17.83 | 9.02 |
| 0.6D+0.6(+Wx), +x (the RISA-comparable edge) | 205.3 / 1.14 = **180.05** | 206.9 / 2.81 = **73.77** |

Bearing, sliding, eccentricity and all strength results are unchanged by #763. The overturning FS is reported only, not gated (otGate off).

Hand check of the #763 change, 0.6D+0.6(−Wx), edge −y. The applied terms, signed + where they tip the footing over −y:

| Term | Value (k-ft) |
|---|---|
| 0.6·M_x,D | −18.90 |
| 0.6·0.5·9.25 | −2.77 |
| −0.6·120.2 | +72.12 |
| −0.6·15.1·9.25 | +83.80 |
| Net | +134.25 |

- Old (net bucketing): M_o = 12.25 (wind uplift) + 134.25 = 146.50. M_r = 497.71. FS = 3.40.
- New (term by term): M_o = 12.25 + 72.12 + 83.80 = 168.18. M_r = 497.71 + 18.90 + 2.77 = 519.38. FS = 3.09. Both match the runs.

## 3. Inputs side by side

The axis mapping is derived from the data and checked below: **tool x = −RISA Z** (across the wall), **tool y = 24.0 ft − RISA X** (along the wall; origin at the wall's mid-length, mirrored), **tool z = RISA Y** (up).

How the mapping was confirmed:

1. The Ped 2 load point is at tool y = −4.91 + 0.25 = −4.66. RISA node N32 is at X = 28.66 ft, which is 24.00 + 4.66. So the sign is mirrored.
2. RISA X-shear −0.5 enters the tool as Vy = +0.5. RISA MZ = +31.5 enters as Mx = +31.5. The tool convention (Mx and Vy both shift the resultant toward +y) makes these two add, as they do in RISA. A −X force at the top of the wall gives the moment vector +h·15.1·Ẑ, the same sense as +MZ.
3. RISA Z = −0.3 with MX = −0.9 becomes tool Vx = +0.3 with My = +0.9. They add in both programs. RISA's D overturning moment confirms it: (0.9 + 0.3·9.25)/13 = 0.283 k-ft/ft, as printed.

| Quantity | RISA | Tool JSON | Flag |
|---|---|---|---|
| Element type | Wall footing (2-D section per ft, loads smeared over 13 ft) | Combined footing, 2 pedestals (3-D rigid plate) | **Method (b)** |
| Footing width across wall | 32 in + 1.5 + 1.5 ft = **5.667 ft (5′-8″)** | B = **5.00 ft** | **(a) MISMATCH** |
| Length | 13 ft (X 17.5 to 30.5) | L = 13 ft | OK |
| Thickness | 24 in | t = 2 ft | OK |
| Soil over footing | Soil height 1.5 ft (toe and heel) | Df 3.5, cover 1.5, γ 120 | OK |
| Wall / pedestal | 32 in × 13 ft × 7.25 ft, continuous | Ped 1 2.67 × 9.833 × 7.25 at y 1.58; Ped 2 2.667 × 3.166 × 7.25 at y −4.91 (footprints overlap 0.0095 ft) | OK (trivial) |
| Footing concrete | **Conc3000NW, f'c 3 ksi** | f'c **4000** psi | **(a) MISMATCH** (ask which is intended) |
| γ_c | 0.150 | 150 pcf | OK |
| f_y | 60 ksi | 60 000 psi | OK |
| Covers | bot 3, top 2 in | 3 / 2 | OK |
| Transverse bottom bars | #7@8 (outer layer, d = 20.56 in) | botX #7@8 (inner layer, d_x = 19.69 in) | Method (b): layer order fixed in the tool |
| Longitudinal bottom bars | **#6@8** each face | botY **#7@8** | (a) minor mismatch |
| Top bars | #6@8 | #6@8 both ways | OK |
| Wall verticals | #6@8 each face (40 #6 over 13 ft) | Ped 1: 32 #6; Ped 2: **16 #8** | (a) minor mismatch |
| Wall horizontals / ties | #5@10 | #4@12 (Ped 1), #3@12 (Ped 2) | (a) minor mismatch |
| Allowable bearing | 6.5 ksf | 6.5 ksf, gross | OK |
| Gross / net | Gross | Gross | OK |
| Subgrade modulus | 328.32 k/ft³ (190 pci) | 150 pci (rigidity check only) | Informational |
| Friction μ | **0.30** (sliding reproduces 0.30·N exactly) | muMode "phi": **tan(2/3·32°) = 0.391** (the 0.45 input is unused) | **(a) MISMATCH** |
| Passive | 0 | 0 | OK |
| Overburden 0.1 ksf (spread-footing definition) | not used by the wall footing | – | n/a |
| Water height 6 ft, heel surcharge 0.5 ksf (wall-footing soil definition) | Not reflected in the results (bearing reproduces without them; no retained soil) | dw none | OK |
| FS targets | OT and sliding 1.5 (1.0 for the 0.6D combinations) | FSot 2.0 (not gated), FSsl 1.5 | Method (b) |
| Code | ACI 318-19, IBC 2021 / ASCE 7(-16) | ACI 318-19, ASCE 7-16, IBC 2021 | OK |

### Loads (unfactored, at the top of the wall / pedestal)

| Case | RISA (node: Y, X, Z, MZ, MX, MY) | Tool (ped: P, Vx, Vy, Mx, My) | Flag |
|---|---|---|---|
| D | N42, N43: Y 23.57 each (X = 19.04, 24.04)<br>N32: 15.94, −0.5, −0.3, 31.5, −0.9, −0.2 | Ped 1 P 47.15<br>Ped 2: 15.90, 0.3, 0.5, 31.5, 0.9 | Ped 2 P 15.94 vs 15.90 (trivial). Torsion MY ignored by both |
| L | N42, N43: 18.15 each | Ped 1 36.30 | OK |
| S | N32: 11.5, −0.5, −0.3, 35.2, −1, −0.2 | Ped 2: 11.5, 0.3, 0.5, 35.2, 1.0 | OK |
| W | N32: 11.1, **−15.1**, −0.3, **120.2**, −1, 0 | Ped 2 "Wx": 11.1, **−0.3**, 15.1, 120.2, 1.0 | **(a) Vx sign wrong**: should be +0.3, as for D and S. The case is named "Wx" but the wind acts along y; that is only a label. |
| Ped 1 load position | Two equal point loads at mirrored y = +4.96 and −0.04, **centroid y = +2.46** | Ped 1 centre 1.58 + loadEy 0.25 = **1.83** | **(a) MISMATCH**, 0.63 ft. Set Ped 1 loadEy = 0.88 (affects the tool only; RISA smears loads) |
| Ped 2 load position | X 28.66 → y −4.66 | −4.91 + 0.25 = −4.66 | OK |
| Self-weights | Wall 37.70 k, footing 22.10 k (Material Take-Off 59.8 k); soil 3 ft × 1.5 ft × 0.12 × 13 = 7.02 k | Footing 19.50 (B = 5), peds 37.73, EV 5.45 | Follows from B |

## 4. Load combinations

| | RISA (IBC 21 / ASCE) | Tool (ASCE 7-16) | Difference |
|---|---|---|---|
| Service | D; D+L; D+(Lr/S/R); D+0.75L+0.75(Lr/S/R); D+0.6W; D+0.45W+0.75L+0.75(Lr/S/R); 0.6D+0.6W | Same set (Lr and R are zero, so collapsed) | **RISA has only +W.** The tool adds ±W and reverses the wind P too (uplift −11.1 k on Ped 2 under −W). (b) |
| Strength 3 | 1.2D + 1.6(Lr/S) + **0.5L** or 0.5W | 1.2D + 1.6S + **1.0L** or 0.5W | RISA uses ASCE 7-16 2.3.1 exception 1 (0.5L for L0 ≤ 100 psf). (b) |
| Strength 4 | 1.2D + 1.0W + **0.5L** + 0.5(Lr/S) | 1.2D + 1.0W + **1.0L** + 0.5S | Same as above. Does not govern the toe flexure; no L on Ped 2. (b) |
| 1, 2, 5 | 1.4D; 1.2D+1.6L+0.5(Lr/S/R); 0.9D+1.0W | Same | OK |

## 5. Results by category

Notation for the tool runs:
- **V0** = the JSON as given (main 805f83c).
- **V1** = V0 with these inputs aligned: B = 5.667, f'c 3000, μ 0.30 (muMode user), FSot 1.5, Wx Vx +0.3, Ped 2 D P 15.94, Ped 1 loadEy 0.88. It keeps the in-plane loads.
- **V2** = V1 with the in-plane loads removed (Vy = Mx = 0, all vertical loads at y = 0): the RISA 2-D model.

Running these variants changes no file; they are patches applied in the harness only.

### 5.1 Soil bearing (service), gross, q_a = 6.5 ksf

| Combination | RISA q_max | Tool V0 | Tool V1 | Tool V2 |
|---|---|---|---|---|
| D | 1.816 | 2.345 | 2.304 | **1.816** |
| D+L | 2.309 | 3.376 | 3.356 | **2.309** |
| D+S | 2.027 | 2.494 | 2.428 | **2.027** |
| D+0.75L+0.75S | 2.344 | 3.230 | 3.186 | **2.344** |
| D+0.6W | 1.939 | 3.315 | 3.209 | **1.939** |
| **D+0.75L+0.45W+0.75S (governs in both)** | **2.436 (UC 0.375)** | **3.957 (DCR 0.609)** | 3.865 | **2.436** |
| 0.6D+0.6W | 1.213 | 2.377 | 2.288 | **1.213** |

- Contact is 100 % in all cases. Tool V0, governing combination: q_min = 1.169, e_x = 0.034, e_y = 1.090 ft. RISA: e = M/N = 0.631/13.134 = 0.048 ft across the wall, no eccentricity along it.
- **Hand check, RISA LC 6(b), per ft:**
  - N = [63.08 + 0.75·36.3 + 0.75·11.5 + 0.45·11.1 + 59.80 + 7.02]/13 = 170.75/13 = 13.134 k/ft.
  - M = [0.9 + 0.75·1 + 0.45·1 + (0.3 + 0.75·0.3 + 0.45·0.3)·9.25]/13 = 8.205/13 = 0.631 k-ft/ft. This equals RISA's M_overturn for 6(b).
  - q = 13.134/5.667 + 6·0.631/5.667² = 2.318 + 0.118 = **2.436 ksf**. ✓
- **Hand check, tool V0, governing combination:**
  - P/A = 166.58/65 = 2.563.
  - 6e_y/L = 6·1.090/13 = 0.503.
  - 6e_x/B = 6·0.034/5 = 0.041.
  - q = 2.563·1.544 = **3.957**. ✓
- **Decomposition of 2.436 → 3.957:**
  - B = 5.0 instead of 5.667 (smaller area, lighter footing and less soil): 2.436 → about 2.56 uniform.
  - Wind Vx sign: about −0.04.
  - The **in-plane moment ΣM_x = 181.5 k-ft** (228.1 k-ft with the Ped 1 position corrected) adds +50 % to +62 %. It is the dominant term.
  - V1 → V2 isolates it: 3.865 → 2.436.

### 5.2 Overturning

RISA checks only the out-of-plane direction (the tool's ±x edges). RISA uses arm B/2 for M_r, and M_o = ΣM_X + ΣV_Z·(7.25 + 2) per ft. That is the same t + h lever as the tool.

| Combination | RISA M_r / M_o (k-ft total = per ft × 13) | RISA FS | Tool V0 +x, pre-#763 | Tool V0 +x, main | Tool V1 / V2 +x |
|---|---|---|---|---|---|
| D | 368.1 / 3.68 | 100.15 | 85.54 | 85.54 | **100.16** |
| D+S | 400.6 / 7.45 | 53.78 | 46.05 | 46.05 | **53.78** |
| D+0.6W | 386.9 / 5.94 | 65.14 | 126.82 | 77.82 | **65.14** |
| D+0.75L+0.45W+0.75S | 483.8 / 8.20 | 58.96 | 72.97 | 60.05 | **58.96** |
| 0.6D+0.6W | 239.7 / 4.47 | **53.62 (governs, LC 20 is the UC reported)** | 180.05 | 73.77 | **53.63** |

- RISA's reported governing UC is 0.028, from LC 3(b) D+S: SF 53.776 vs min 1.5. The 0.6D combinations use SF min 1.0.
- **Tool governing overturning: about the y edges** (in-plane, not checked by RISA):
  - FS 3.09, edge −y, 0.6D+0.6(−Wx), on main;
  - FS 3.14, edge +y, 0.6D+0.6(+Wx), in the PDF and pre-#763.
- **Hand check, RISA 0.6D+0.6W:**
  - N = 0.6·129.90 + 0.6·11.1 = 84.60 k. M_r = 84.60·2.833 = 239.7.
  - M_o = 0.6(0.9 + 0.3·9.25) + 0.6(1.0 + 0.3·9.25) = 2.205 + 2.265 = 4.47.
  - FS = 53.6. ✓
- Tool V0, same edge, main: the wind V_x couple has the wrong sign (−0.18·9.25 = −1.665). Term by term:
  - M_o = 0.54 + 1.665 + 0.60 = 2.81;
  - M_r = 205.25 + 1.665 = 206.9;
  - FS = 73.8.
- Pre-#763 the same terms netted to M_o = 1.14, giving FS 180. With the sign fixed (V1) all terms have one sign. Then M_o = 4.47 = RISA, and #763 makes no difference for this edge.
- Root causes:
  - out-of-plane FS differences: B and the Vx sign (a);
  - the governing FS ≈ 3.1 about the y edges: the in-plane method (b);
  - the #763 changes: tool method update (see §2).

### 5.3 Sliding

| | RISA | Tool V0 | Tool V1 / V2 |
|---|---|---|---|
| Across the wall (x), D+S | V 0.6 k, R 42.42 k, **SF 70.7** | 89.33 | **70.70** |
| Across the wall, 0.6D+0.6W | 70.5 | ∞ (Hx = 0: wind Vx −0.3 cancels D Vx +0.3) | **70.50** |
| Governing across the wall | 70.5 / 70.7 (UC 0.021, LC 3(b)) | 74.62 (0.6D+0.6(−Wx)) | 70.5 |
| **Along the wall (y)** | **not checked** (V in plane 15.95 k "not used") | **FS 3.07**, 0.6D+0.6(−Wx): 0.391·68.78/8.76 | V1 **2.44** (0.30·71.28/8.76) |

- Hand check, RISA D+S: R = 0.30·(63.08 + 11.5 + 59.80 + 7.02) = 0.30·141.40 = 42.42 k. H = 0.3 + 0.3 = 0.6 k. SF = 70.7. ✓
- Root causes:
  - μ (0.391 vs 0.30) and N (B): input (a);
  - the wind Vx sign: input (a);
  - y-sliding exists only in the tool: method (b). Sliding along the wall under the full wind shear is real, and RISA leaves it out.

### 5.4 Footing flexure

| | RISA | Tool V0 | Tool V1 / V2 |
|---|---|---|---|
| Transverse (toe) M_u at the wall face | **2.791 k-ft/ft**, LC 4 (1.2D+1.6L+0.5S) | 24.99/13 = 1.922 k-ft/ft, same combination, x = 1.333 | 36.29/13 = **2.791** ✓ |
| Cantilever | 1.5 ft | 1.167 ft (B = 5) | 1.5 ft |
| d | 20.56 in (transverse bars outer) | 19.69 in (y-bars outer) | 19.69 in |
| A_s | 0.902 in²/ft (#7 = 0.601) | 0.900 | 0.900 |
| φM_n | **79.87 k-ft/ft** (f'c 3) | 77.05 (f'c 4) | 76.16 (f'c 3) |
| UC | 0.035 | 0.025 | 0.037 |
| Longitudinal | T&S only (2.938 in²), no flexure check | M_u **276.76 k-ft** sag (1.2D+1.0(+Wx)+L+0.5S), DCR **0.687 (governs)**<br>M_u⁻ 189.47 hog (0.9D+1.0(−Wx)), DCR 0.626 | V1 268.0 / 0.593 |

- **Hand check, RISA toe moment, LC 4, per ft:**
  - Gross N = (139.526 + 1.2·59.80 + 1.2·7.02)/13 = 16.901 k/ft.
  - Net under the toe, after footing and soil weight (1.2·0.30 + 1.2·0.18 = 0.576): q = 16.901/5.667 − 0.576 = 2.406 ± 6·0.4844/5.667² = ±0.0905 ksf. Here 0.4844 = (1.58 + 0.51·9.25)/13.
  - High side: q_edge 2.4965, q_face 2.4486.
  - M = 1.5²·(2.4486/2 + 0.0479/3) = **2.791**. ✓
- **Hand check, φM_n:**
  - RISA: a = 0.902·60/(0.85·3·12) = 1.769 in; φM_n = 0.9·0.902·60·(20.5625 − 0.884)/12 = **79.87**. ✓
  - Tool V1: 0.9·0.9·60·(19.688 − 0.882)/12 = 76.16. ✓
- Root causes:
  - the cantilever: B (a);
  - φM_n: f'c (a), and the layer order: the tool always puts the y-bars outermost, `dBotX = tin − cvB − d_bx/2 − d_by` in Spread Footing.html (b);
  - longitudinal flexure exists only in the tool: method (b). RISA's model cannot see it.
- Development of the toe bars: the tool fails it.
  - V0: ℓ_dh 18.35 > 11.0 in.
  - V1: ℓ_dh 19.56 > 15.0 in (f'c 3000, epoxy ψ_e 1.2, ψ_o 1.25).
  - RISA's wall footing output prints no development check for these bars. This is not a tool error; the engineer should review the hooks.

### 5.5 One-way shear

| | RISA | Tool |
|---|---|---|
| Toe / heel | V_u = 0 (the critical section d = 1.71 ft from the face is beyond the 1.5 ft toe); φV_n 12.49 k/ft | "critical section at d from every face falls outside the footing: N/A" (x and y) |

- The two agree.
- Note RISA's φV_n: 0.75·8·ρ^(1/3)·√3000·12·20.56, with ρ = 0.902/(12·20.56) = 0.003655, gives **12.49 k/ft**. This is ACI 318-19 Table 22.5.5.1(c) **without λs**.
- The tool always applies λs = √(2/(1 + d/10)) (0.815 here), in one-way and two-way shear (Spread Footing.html, around lines 4759, 5235 and 5322).
- I believe ACI 318-19 §13.2.6.2 permits neglecting λs for footings and mats. **Please confirm the provision.** If it does, the tool is conservative by 1/0.815 = 1.23 on footing shear. The tool's own note attributes the RISA difference to RISA using pre-2019 editions; this RISA output is labelled ACI 318-19.
- Classification: (b), with an optional tool enhancement. See §6.

### 5.6 Punching

- RISA: none (a wall footing has no punching check).
- Tool V0: Ped 2 DCR 0.389, 1.2D+1.0(+Wx)+L+0.5S.
  - v_u = 9.32 + 0.31 + 50.48 = 60.12 psi vs φv_c = 154.60 psi.
  - The in-plane M_ux = 261.1 k-ft carries it.
- Tool V0: Ped 1 DCR 0.067.
- Flagged REVIEW: the perimeters overlap, because the wall is modelled as two touching pedestals.
- Method (b): punching is not meaningful for a continuous wall. Use the tool's grouped / one-way checks.

### 5.7 Pedestal / wall

| | RISA (wall, per ft, out-of-plane) | Tool |
|---|---|---|
| P–M | UC 0.026: M_u 0.406 k-ft/ft, P_u 14.213 k/ft, φM_n 15.70, LC 4 | Ped 2 P–M ratio 0.29 (V0) / 0.30 (V1), in-plane M_ux 300.22 k-ft |
| Shear | UC 0.007 (0.076 k/ft, LC 9) | Ped 2 shear ratio 0.37 (V_uy 15.95 k) |
| In-plane forces | M 291.24 k-ft, V 15.95 k (LC 13) "not used for design" | Used |
| Horizontal steel | **Fails minimum** (5.522 < 5.568 in², ρ 0.0020), hence RISA's warning-log failure | Tie checks pass (not a wall check) |
| Dowels | UC 0.001 shear friction; wall vertical minimum ρ 0.0015 | Ped 1 fails 0.005A_g (14.08 < 18.90 in²); Ped 2 ℓ_dh 22.42 > 19.25 in |

- **Hand check, in-plane moment at the wall base, LC 13 / tool combination 1.2D+1.0W+L+0.5S:**
  - 1.2·31.5 + 120.2 + 0.5·35.2 = 175.6 k-ft;
  - plus V = 1.2·0.5 + 15.1 + 0.5·0.5 = 15.95 k times 7.25 ft;
  - total **291.24** = RISA.
  - The tool's 300.22 = 291.24 + P·e_y = 35.93·0.25 = 8.98 (load offset). The two programs agree on the demand; RISA just does not design for it.
- **Hand check, out-of-plane wall moment, LC 4:** (1.58 + 0.51·7.25)/13 = 0.406 k-ft/ft. ✓
- Root causes:
  - the in-plane design: method (b);
  - the dowel minimum: the tool applies the column rule 0.005A_g (ACI 318-19 16.3.4.1) to a "pedestal" that is really a wall, where the wall interface minimum would apply (16.3.4.2 / 11.6). This is method / modelling (b); ask the engineer.
  - Ped 2 bar size (#8 vs #6@8) drives the ℓ_dh failure: input (a).

## 6. Classification and actions

**(a) Input mismatches.** Change these in the tool, or in RISA, if the two are meant to describe the same footing:

1. **B = 5.00 ft → 5.667 ft** (32 in wall + 1.5 ft + 1.5 ft), or change RISA's toe and heel to 1.1665 ft. This is the largest single input effect (cantilever 1.167 vs 1.5 ft, bearing area, self-weight).
2. **f'c 4000 → 3000 psi**, or set RISA to Conc4000NW. Confirm the intended concrete.
3. **Base friction:** the tool uses tan(2/3·32°) = 0.391; RISA uses 0.30. Set Stability → μ = input 0.30, or change RISA.
4. **Wind Vx sign on Ped 2: −0.3 → +0.3.** RISA has Z = −0.3 for D, S and W alike, and the tool has +0.3 for D and S. With −0.3 the wind cancels the D shear: x-sliding FS becomes ∞ in 0.6D+0.6W, and the x-edge M_o drops.
5. **Ped 1 load position:** loadEy 0.25 → **0.88** (RISA loads at the mirrored y = +4.96 and −0.04, centroid +2.46). This adds about 47 k-ft to M_x in the governing bearing combination.
6. Smaller ones:
   - Ped 2 D P 15.90 → 15.94;
   - longitudinal bottom bars #7@8 → #6@8;
   - wall verticals and horizontals (Ped 2 #8 → #6@8; ties vs #5@10);
   - JSON `nTot: 30` is stale (faces mode gives 32);
   - the unused `direct` loads (P 264 / 338).

**(b) Legitimate method differences:**

1. **In-plane loads.**
   - RISA's wall-footing module ignores the in-plane wall M and V for bearing, stability and design ("Enveloped Wall Forces Not Used For Design"). For a 13 ft wall with a concentrated wind moment of 120 k-ft plus 15.1 k at 7.25 ft, that is **unconservative**.
   - The tool's 3-D treatment gives bearing 3.87 to 3.96 ksf vs 2.44, y-sliding FS 2.4 to 3.1, y-overturning FS about 3.1, longitudinal M_u 277 k-ft and pedestal checks. These are the governing results.
   - Recommend the engineer use the tool, or model the footing in RISA as a spread or mat footing with the wall as a stiff element, for the in-plane direction.
2. **Wind reversal.** The tool runs ±W, and −W also reverses P = 11.1 k into uplift. RISA has only +W. The −W cases govern the tool's overturning (FS 3.09) and hogging (M_u⁻ 189 k-ft).
3. **0.5L in strength 3 and 4.** RISA applies ASCE 7-16 2.3.1 exception 1; the tool uses 1.0L, which is conservative. It does not change the governing toe flexure here.
4. **FS targets.** RISA: 1.5, and 1.0 for 0.6D. Tool: OT 2.0, reported only; sliding 1.5.
5. **Bottom-layer order.** The tool fixes the y-bars outermost, so d_x = 19.69 vs RISA's 20.56 in for the transverse bars (φM_n −3 %).
6. **Size-effect factor λs** on footing shear: the tool applies it always; RISA omits it, consistent with ACI 318-19 §13.2.6.2 (please confirm). Shear does not govern here.
7. **Dowel minimum:** column rule 0.005A_g (tool) vs wall rule (RISA).
8. **Punching:** the tool checks two overlapping pedestals; RISA has none for a wall.
9. **Overturning bucketing (#763):** term by term since 805f83c. The engineer's PDF predates it (3.14 → 3.09; see §2).

**(c) Likely bugs in the Spread Footing tool: none found.**

Every RISA number I checked is reproduced exactly once the inputs are aligned and the in-plane terms removed. That covers bearing in 7 combinations, out-of-plane overturning in 6, sliding in 6, toe M_u, P_u per ft, and the in-plane wall M and V.

Candidate enhancements (not bugs; each needs the engineer's approval under CLAUDE.md §4):
- an option to neglect λs in footings, if ACI 318-19 §13.2.6.2 says so;
- a choice of which bottom layer is outermost;
- a note when "pedestals" form a continuous wall: dowel minimum per 16.3.4.2 instead of 16.3.4.1, and punching not applicable.

## 7. Not determined

- **Which concrete strength (3 or 4 ksi) and which footing width (5′-0″ or 5′-8″) are intended.** The two models disagree; the engineer must choose.
- Whether RISA's wall-footing "Water Height 6 ft" and "Heel Surcharge 0.5 ksf" are meant to act. They have no effect on the printed results, which reproduce without them.
- The exact wording of ACI 318-19 §13.2.6.2. I cite it from memory; please verify before any tool change.
- RISA's toe/heel labelling vs the tool's ±x. RISA reports the toe as the high-pressure side under +W. The mapping x = −Z is consistent with the load signs, but RISA's toe direction is not labelled in plan.
- RISA's footing-bar development is not printed (no check found in the 220 pages of text), so the tool's development failure has no RISA counterpart to compare.

## Appendix: how the runs were made

- Harness: `scratchpad/rec/run3.mjs` (the sfc/run.mjs pattern). The JSON is loaded as `sfd_auto.state`, and a patch is applied for V1/V2 (`scratchpad/rec/variants.py`). Libraries come from `scratchpad/sflibs`.
- Code under test: `git archive origin/main` → `scratchpad/rec/main2` (805f83c) and the pre-#763 copy `scratchpad/rec/main` (3cbdd94). The repository is unchanged.
- Report text: `scratchpad/rec/rep_main2.txt`, `rep_main.txt`, `rep_v0/v1/v2.txt`. PDF text: `scratchpad/rec/r1.txt`, `r2.txt`, `sf.txt`.
