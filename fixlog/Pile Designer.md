# Fix log — Pile Designer.html

Governing basis used for fixes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024); ASTM A722; FHWA NHI-05-039 (micropiles). The file's own article numbers were carried over from the 9th Ed.; the articles cited below have the same numbers in the 9th and 10th Eds. as far as checked.

## 2026-10-04 — PR: claude/fix-pile-designer (PR link added after merge)

All check-case numbers below came from running the real `computeAll()` (and the loaders) from the file in node, before (origin/main) and after the change. The harness loads the single inline `<script>` into a `vm` context with React/three/Plotly stubbed out. A second harness renders the whole `App` tree with stubbed hooks (micropile, H-pile, IAB, slender casing, D/t over the limit, bad inputs, legacy H-pile save, fyb = 150). It reported no render exceptions before or after. Line numbers are approximate, as of this fix.

### F1. Grade 150 thread bars: fy = 120 ksi, not 150   [calc change] [more conservative]
- **Where:** `BAR_CATALOG` (≈ line 7887) and `BarSelect` (≈ line 7893). Anchor text: `id: "1.375-150"`
- **Problem:** The catalog set `fy: 150` for A722 Gr150 bars. 150 ksi is the ultimate strength (fpu). Picking a Gr150 bar wrote `fyb = 150`, which overstated bar tension, the test-bar check (0.8·Ab·fyb), CFST Po and the M-φ section by 25%. The cased and uncased axial checks were not affected, because they use min(fyb, fyc).
- **Governing provision:** ASTM A722 (Type II bar: fpu = 150 ksi, minimum fpy = 0.80·fpu = 120 ksi).
- **Before:**
  ```js
  { id: "1-150", lbl: "1″ Gr150 (0.85)", Ab: 0.85, fy: 150 },
  { id: "1.25-150", lbl: "1-1/4″ Gr150 (1.25)", Ab: 1.25, fy: 150 },
  { id: "1.375-150", lbl: "1-3/8″ Gr150 (1.58)", Ab: 1.58, fy: 150 },
  { id: "1.75-150", lbl: "1-3/4″ Gr150 (2.60†)", Ab: 2.60, fy: 150 },
  { id: "2.5-150", lbl: "2-1/2″ Gr150 (5.19†)", Ab: 5.19, fy: 150 }
  ```
- **After:** the same five lines with `fy: 120`. The labels still say Gr150, and the ids are unchanged. The comment above the catalog now explains fpu vs fpy. `BarSelect` adds one warning line under the centre-bar selector when `fyb >= 149.5`:
  ```js
      BAR_CATALOG.map(b => /*#__PURE__*/React.createElement("option", { key: b.id, value: b.id }, b.lbl))),
    setGrade && I.fyb >= 149.5 && /*#__PURE__*/React.createElement("div", { className: "text-[9px] mt-1 leading-snug", style: { color: "#b23b3b" } },
      "⚠ fyb ≥ 150 ksi: for an ASTM A722 Gr150 threadbar, 150 ksi is the ULTIMATE strength (fpu). Yield fpy = 0.80·fpu = 120 ksi — re-select the bar or set fyb = 120."));
  ```
- **Saved data:** Saved projects keep their stored `fyb`. A project saved with 150 still computes with 150, because the code cannot tell a deliberate value from a catalog pick. The warning above appears for such projects, and the catalog then shows "custom".
- **Check case:** Ab = 1.58 in² (1-3/8″ Gr150 selected; verification bar Ab = 1.58), other inputs default.
  - Before: fyb = 150 → Tn,bar = 150·1.58 = 237.0 kip; φt·Tn,bar = 0.90·237 = 213.3 kip; Pt,verf = 0.8·1.58·150 = 189.6 kip.
  - After: fyb = 120 → Tn,bar = 189.6 kip; φt·Tn,bar = 170.6 kip; Pt,verf = 151.7 kip.
  - Cased and uncased φRn are unchanged (546.1 / 160.6 kip; they use min(fyb, fyc) = 80).
- **How verified:** node run of `computeAll` before/after; render harness shows the warning.
- **Other copies of this code:** none known.

### F2. Casing flexure: slender branch, a clear fail above 0.45E/Fy, consistent combined-check mode   [calc change] [more conservative]
- **Where:** `computeAll`, section "4. CASING FLEXURE (joint)" (≈ line 1758), and `R.comb.isCompact` (≈ line 1841). Anchor text: `slender branch (AASHTO 6.12.2.2.3)`
- **Problem:**
  - For 0.31E/Fy ≤ D/t ≤ 0.45E/Fy the code returned Mn = Fy·Z ("Yielding"), which is about 1.2 to 2 times too high.
  - Because "Yielding" also counted as compact, the combined check then used the compact Eqs. 6.9.2.2.1-1/-2.
  - Above 0.45E/Fy, `Mn_j` was `undefined`, so φMn was NaN and the module showed "—" with no reason.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.12.2.2.3 (circular tubes):
  - D/t ≤ 0.07E/Fy: Mn = Fy·Z.
  - 0.07E/Fy < D/t ≤ 0.31E/Fy: Mn = (0.021E/(D/t) + Fy)·S.
  - 0.31E/Fy < D/t ≤ 0.45E/Fy: Mn = Fcr·S, with Fcr = 0.33E/(D/t).
  - The article applies only up to D/t = 0.45E/Fy.
  - Art. 6.9.2.2.1: Eqs. -1/-2 apply only to compact sections; otherwise use the additive Eq. -3, as the code already did.
- **Before:**
  ```js
  let Mn_j, flexMode;
  const Mn_j1 = fyc * Zj / 12; // kip-ft (yielding)
  if (Dt_ref <= lim_Y) {
    Mn_j = Mn_j1;
    flexMode = "Yielding";
  }
  // local buckling branch (compact-noncompact)
  const Mn_j2 = (0.021 * Es / Dt_ref + fyc) * Sj / 12; // kip-ft
  if (Dt_ref > lim_pl && Dt_ref < lim_31) {
    // noncompact -> use Mn_j2, controlling is min
    Mn_j = Math.min(Mn_j1, Mn_j2);
    flexMode = "Local Buckling (noncompact)";
  } else if (Dt_ref <= lim_pl) {
    Mn_j = Mn_j1;
    flexMode = "Compact (yielding)";
  }
  ...
    pass: phi_f * Mn_j >= Mmax,
  ...
  const isCompact = /compact|yielding/i.test(flexMode) && !/noncompact/i.test(flexMode);
  ...
    pass: interaction <= 1.0          // (R.comb)
  ```
- **After:**
  ```js
  let Mn_j, flexMode, flexMsg = "";
  const Mn_j1 = fyc * Zj / 12; // kip-ft (yielding)
  // local buckling branch (compact-noncompact)
  const Mn_j2 = (0.021 * Es / Dt_ref + fyc) * Sj / 12; // kip-ft
  // slender branch (AASHTO 6.12.2.2.3): Mn = Fcr*S, Fcr = 0.33E/(D/t), for 0.31E/Fy < D/t <= 0.45E/Fy
  const Fcr_j3 = 0.33 * Es / Dt_ref; // ksi
  const Mn_j3 = Fcr_j3 * Sj / 12; // kip-ft
  // D/t > 0.45E/Fy is outside 6.12.2.2.3 -> no flexural resistance credited (check fails, with a reason)
  const flexNotPermitted = !(tc_r > 0) || !(Dt_ref <= lim_Y);
  if (!(tc_r > 0)) {
    Mn_j = 0;
    flexMode = "Invalid: corroded wall thickness <= 0";
    flexMsg = "Corroded casing wall t_r = t - corrosion = " + fmt(tc_r, 3) + " in is not positive, ...";
  } else if (Dt_ref > lim_Y) {
    Mn_j = 0;
    flexMode = "Not permitted: D/t > 0.45E/Fy";
    flexMsg = "Casing D/t = " + fmt(Dt_ref, 1) + " (joint basis, OD_r/(t_r/2)) exceeds the 0.45E/Fy = " + fmt(lim_Y, 1) + " limit of AASHTO 6.12.2.2.3. ... no flexural resistance is credited and the check FAILS. ...";
  } else if (Dt_ref <= lim_pl) {
    Mn_j = Mn_j1;
    flexMode = "Compact (yielding)";
  } else if (Dt_ref <= lim_31) {
    // noncompact -> use Mn_j2, controlling is min
    Mn_j = Math.min(Mn_j1, Mn_j2);
    flexMode = "Local Buckling (noncompact)";
  } else {
    // slender: 0.31E/Fy < D/t <= 0.45E/Fy
    Mn_j = Mn_j3;
    flexMode = "Local Buckling (slender)";
  }
  const flexCompact = !flexNotPermitted && Dt_ref <= lim_pl;
  ...
    pass: !flexNotPermitted && phi_f * Mn_j >= Mmax,     // R.flex (+ Fcr_j3, Mn_j3, flexNotPermitted, flexCompact, flexMsg)
  ...
  const isCompact = flexCompact; // D/t <= 0.07E/Fy only (same classification as the flexure check above)
  ...
    pass: !flexNotPermitted && interaction <= 1.0       // R.comb
  ```
  The `...` inside the message strings stands for wording only; the exact text is in the file.
- **Display changes:**
  - Report §04 gains a "Slender local-buckling moment" Calc line (shown only in the slender range) and the `flexMsg` narrative (shown only when not permitted). The cite changes from "Eq. 6.12.2.2.3-1/-2" to "Art. 6.12.2.2.3".
  - Module 04 gains "Slender limit" (0.45E/fyc) and "Slender moment" lines, plus a red message box when not permitted.
- **Boundary note:** at exactly D/t = 0.31E/Fy, the noncompact equation now applies (≤). Before, that point fell into "Yielding".
- **Check case 1 (slender range):** 10-3/4″ × 0.25″ N-80 (fyc = 80, E = 29,000), corrosion 1/16″, other inputs default (STL = 86 kip, Mmax = 17.5 kip-ft).
  - Section: OD_r = 10.625, t_r = 0.1875, IDj = 10.4375 → S = 8.095 in³, Z = 10.398 in³.
  - Slenderness: D/t = 10.625/(0.1875/2) = 113.33. That is above 0.31E/Fy = 112.375 and below 0.45E/Fy = 163.125, so the slender branch applies.
  - Before: "Yielding", Mn = 80·10.398/12 = 69.32 kip-ft. Combined used Eq. 6.9.2.2.1-2: 0.219 + 8/9·(17.5/69.32 = 0.252) = 0.443.
  - After: Fcr = 0.33·29000/113.33 = 84.44 ksi, Mn = 84.44·8.095/12 = 56.96 kip-ft (−17.8%). Combined uses Eq. 6.9.2.2.1-3: 0.219 + 17.5/56.96 = 0.219 + 0.307 = 0.526.
- **Check case 2 (over the limit):** same casing with t = 0.18″ → D/t = 10.625/(0.1175/2) = 180.9 > 163.1.
  - Before: Mn = undefined, φMn = NaN, interaction = NaN, fail with no reason.
  - After: Mn = 0, mode "Not permitted: D/t > 0.45E/Fy", flex and combined both fail, and the message explains why.
- **Check case 3 (defaults, noncompact):** OD 7, t 0.453, D/t = 35.2. Unchanged: Mn = min(58.10, 53.95) = 53.95 kip-ft; interaction 0.494 (Eq. -3).
- **How verified:** node run before/after; full regression of every numeric field of `computeAll(DEFAULT_INPUTS)` shows no change other than the new fields and punching (F4).
- **Other copies of this code:** none known.

### F3. H-pile resistance factors: the inputs now drive the calc; defaults set to AASHTO values   [calc change] [no result change at defaults or for old saves]
- **Where:**
  - `hpileGeoCapacity` (≈ line 1227);
  - buckling block (`bklPhiC`, ≈ line 2244);
  - H-pile structural block in `computeAll` (≈ lines 2892–2950);
  - p-crit path (`phi_c_used`, ≈ line 11493);
  - `DEFAULT_INPUTS` (≈ line 5405);
  - H-pile report and module text;
  - a new φ input block in the H-pile "Pile Section" panel.
  - Anchor text: `const phi_c_axial = I.hpPhiC`
- **Problem:**
  - `hpPhiC/F/Ty/Tu/V/Geo/Up` existed only as defaults, they had no input fields, and the report printed them: φc 0.53, φgeo 0.45, φup 0.35.
  - The calc used hardcoded values instead: 0.60 (axial and buckling), 0.70 (combined), 1.00 (flexure), 1.00 (shear), 0.95/0.80 (tension), and the geotech table `PHI = {sand 0.30, clay 0.35, uplift 0.25}`.
  - So a sealed report showed factors that were never applied, and severe driving (φc = 0.50) could not be selected.
- **Governing provision:**
  - AASHTO LRFD 10th Ed. Art. 6.5.4.2:
    - H-piles, axial, severe driving with a pile tip: 0.50;
    - H-piles, axial, good driving without a pile tip: 0.60;
    - combined axial + flexure of undamaged H-piles: axial 0.70, flexure 1.00;
    - tension yield 0.95, fracture 0.80; shear 1.00.
  - Table 10.5.5.2.3-1:
    - static, SPT (Meyerhof) side + tip in sand: 0.30;
    - α-method side in clay: 0.35;
    - uplift, SPT and α: 0.25.
  - Note: the task brief said "0.70 good driving". 6.5.4.2 gives 0.70 for the combined case and 0.60 for good-driving axial. 0.60 was used because it is what the calc already used. See open item O8.
- **Defaults: before → after**
  - New keys: `hpPhiCcomb` and `hpPhiGeoClay`. `hpPhiRev` is a migration marker.
  - The "calc used before" column gives the value the calculation actually applied.

  | key | default before (report only) | calc used before | default after (= calc) |
  |---|---|---|---|
  | hpPhiC (axial, buckling, p-crit) | 0.53 | 0.60 hardcoded | **0.60** (0.50 via "severe") |
  | hpPhiCcomb (new) | — | 0.70 hardcoded | **0.70** |
  | hpPhiF | 1.00 | 1.00 hardcoded | 1.00 |
  | hpPhiV | 1.00 | 1.00 hardcoded | 1.00 |
  | hpPhiTy / hpPhiTu | 0.95 / 0.80 | 0.95 / 0.80 hardcoded | 0.95 / 0.80 |
  | hpPhiGeo (sand/silt SPT side + tip) | 0.45 | 0.30 (PHI table) | **0.30** |
  | hpPhiGeoClay (new; α side + 9Su tip) | — | 0.35 (PHI table) | **0.35** |
  | hpPhiUp | 0.35 | 0.25 (PHI table) | **0.25** |
  | hpDriveCond | "static_generic" | not used | **"good"** ("severe" sets φc 0.50; "static_generic" = custom) |

- **Before (calc):**
  ```js
  function hpileGeoCapacity({ layers, d, bf, embedTop, embedLen, smallGroup }) {
    ...
    const PHI = {
      sand_stat: 0.30, clay_stat: 0.35,      // Table 10.5.5.2.3-1 static, side+tip
      sand_up: 0.25, clay_up: 0.25           // uplift (SPT / alpha)
    };
  bklPhiC = 0.60;                     // H-pile, good driving, no tip (6.5.4.2)
  const phi_c_axial = 0.60;
  const phi_f = 1.00;
  const phi_c_comb = 0.70;
  const phi_v = 1.00;
  const phi_ty = 0.95, phi_tu = 0.80;
  const phi_c_used = I.pileType === "hpile" ? 0.60 : (I.phiC || 0.7);
  ```
- **After (calc):**
  ```js
  function hpileGeoCapacity({ layers, d, bf, embedTop, embedLen, smallGroup, phiSand, phiClay, phiUp }) {
    ...
    const PHI = {
      sand_stat: phiSand != null ? phiSand : 0.30, clay_stat: phiClay != null ? phiClay : 0.35, // static, side+tip
      sand_up: phiUp != null ? phiUp : 0.25, clay_up: phiUp != null ? phiUp : 0.25              // uplift (SPT / alpha)
    };
  // call site adds: phiSand: I.hpPhiGeo, phiClay: I.hpPhiGeoClay, phiUp: I.hpPhiUp
  bklPhiC = I.hpPhiC != null ? I.hpPhiC : 0.60;
  const phi_c_axial = I.hpPhiC != null ? I.hpPhiC : 0.60;
  const phi_f = I.hpPhiF != null ? I.hpPhiF : 1.00;
  const phi_c_comb = I.hpPhiCcomb != null ? I.hpPhiCcomb : 0.70;
  const phi_v = I.hpPhiV != null ? I.hpPhiV : 1.00;
  const phi_ty = I.hpPhiTy != null ? I.hpPhiTy : 0.95, phi_tu = I.hpPhiTu != null ? I.hpPhiTu : 0.80;
  const phi_c_used = I.pileType === "hpile" ? (I.hpPhiC != null ? I.hpPhiC : 0.60) : (I.phiC || 0.7);
  // R.hpileStruct now also carries phi_ty, phi_tu
  ```
- **Display:**
  - Every hardcoded "0.60 / 0.70 / 1.00 / 0.95 / 0.80 / 0.30 / 0.35 / 0.25" in the H-pile modules (03, 04, 05, 07, 09, geotech) and in the printed H-pile structural summary now prints the factor used (`hs.phi_c_axial`, `hs.phi_c_comb`, `hs.phi_f`, `hs.phi_v`, `hs.phi_ty`, `hs.phi_tu`, `g.PHI.*`). This includes the p-crit re-computations inside those modules.
  - The report's "Resistance factors · H-pile" table lists all nine factors with article references.
  - The IAB module's 0.70 is not touched.
- **Migration (saved data):**
  - `mergeSavedInputs` (see F8) runs on any saved input object without `hpPhiRev`.
  - It replaces `hpPhiC === 0.53 → 0.60`, `hpPhiGeo === 0.45 → 0.30` and `hpPhiUp === 0.35 → 0.25`.
  - It sets `hpDriveCond "static_generic" → "good"` when φc is 0.60, then sets `hpPhiRev = 2`.
  - Because there was no UI for these fields, any saved value is the old placeholder. Old H-pile projects therefore compute exactly as before.
  - A note tells the user the report now shows the factors actually applied.
- **Check case 1:** H-pile defaults (HP 13.83×14.7, Fy 50). Before = after:
  - φc = 0.60 → φPn = 774.9 kip;
  - φc,comb = 0.70 → Pr = 904.1 kip;
  - φMn = 537.8 kip-ft; φVn = 224.7 kip; φPty/φPtu = 1226.9/1343.2 kip.
- **Check case 2 (legacy save):** the old DEFAULT_INPUTS (φc 0.53, φgeo 0.45, φup 0.35), loaded through `mergeSavedInputs`, gives every H-pile result field identical to origin/main (checked by script).
- **Check case 3 (geotech):** 30 ft embedment below a 3 ft stickup (toe at 33 ft); sand N60 = 20 from 0–20 ft over clay Su = 1.5 ksf, α = 0.6; box perimeter 4.755 ft/ft; box area 1.412 ft².
  - Side, sand: Rs = (20/50)(4.755)(17) = 32.33 kip.
  - Side, clay: Rs = (0.6·1.5)(4.755)(13) = 55.63 kip.
  - Tip: Rp = 9(1.5)(1.412) = 19.06 kip.
  - φRn = 0.30·32.33 + 0.35·(55.63 + 19.06) = 35.84 kip. Before = after. Uplift: 0.25·(32.33 + 55.63) = 21.99 kip.
- **Check case 4 (new capability):** "Severe driving" sets φc = 0.50, so φPn = 0.50·1291.5 = 645.8 kip (before: no option; always 774.9 kip).
- **How verified:** node runs before/after, legacy-merge equality script, render harness for hpile mode.
- **Other copies of this code:** none known.

### F4. Cap punching: critical perimeter at dv/2 from the pile face; separate concrete φ = 0.90   [calc change] [LESS conservative for corner/edge piles at the defaults; more conservative for interior piles and when a steel φ preset was applied]
- **Where:** `computeAll`, section 7 (≈ line 2123); `DEFAULT_INPUTS` (`phiVpunch`); the φ input grid; `PHI_INFO.phiV` / `PHI_INFO.phiVpunch`; the extreme-event overrides; `CapPlan`; report §07 and Module 07. Anchor text: `PUNCHING SHEAR (5.12.8.6.3)`
- **Problem:**
  - The perimeter used the pile-to-cap-edge distance where AASHTO uses dv: `bo1 = π(OD + d_edge)`.
  - φ was `I.phiV`, which the steel presets "Micropile structural — Strength" and "General steel member" set to 1.00. That made punching 11% unconservative after a preset.
- **Governing provision:**
  - AASHTO LRFD 10th Ed. Art. 5.12.8.6.3: the critical section is at dv/2 from the face of the concentrated load (here, the pile).
  - Art. 5.5.4.2: φ = 0.90 for shear in normal-weight concrete.
- **Before:**
  ```js
  /* ---------- 7. PUNCHING SHEAR (5.8.4) ---------- */
  const bo1 = PI * (OD + d_edge);
  const bo2 = PI * (OD + d_edge) / 4 + 2 * d_edge;
  const phi_v = I.phiV;
  ```
- **After:**
  ```js
  /* ---------- 7. PUNCHING SHEAR (5.12.8.6.3) ---------- */
  const bo1 = PI * (OD + dv);
  const bo2 = PI * (OD + dv) / 4 + 2 * d_edge;
  const phi_v = (I.phiVpunch != null) ? I.phiVpunch : 0.90;
  ```
- **Truncation:** the corner/edge truncation is kept. It is a quarter circle of the same dv/2 radius plus two legs of length d_edge (measured from the pile centre) to the cap edges, and bo = min(bo1, bo2).
- **New optional field:** `phiVpunch` (default 0.90), shown as "φv punch" in the φ grid. Old saves without it get 0.90. `phiV` is kept, and the presets still set it, but it no longer affects punching.
- **Extreme event:** the extreme-event preset and the extreme load-case override set `phiVpunch: 1.0`, the same as they previously did through `phiV`.
- **Display:**
  - The report and module now print the bo formula and use `r.punch.phi_v`.
  - The cap plan draws the critical circle at dv/2.
  - The report's φ table lists "φ punching shear (cap concrete)".
- **Check case 1 (defaults):** OD = 7 in, t = min(2.667, 2.833)·12 = 32.0 in, he = 12 in → de = 20.0 in, dv = max(0.9·20.0, 0.72·32.0) = 23.04 in; d_edge = min(1.833, 1.083)·12 = 13.0 in; f′c = 4 ksi.
  - Before: bo1 = π(20.0) = 62.8 in; bo2 = π(20.0)/4 + 26.0 = 41.7 in → Vn = 0.125·2·41.7·23.04 = 240.2 kip → φVn = 0.90·240.2 = 216.2 kip.
  - After: bo1 = π(30.04) = 94.4 in; bo2 = π(30.04)/4 + 26.0 = 49.6 in → Vn = 285.7 kip → φVn = 257.1 kip (**+18.9%, less conservative**).
- **Check case 2 (after a steel preset set phiV = 1.00):**
  - Before: φVn = 1.00·240.2 = 240.2 kip.
  - After: φVn = 0.90·285.7 = 257.1 kip. The φ part alone is −10%; the net change is still +7% from the perimeter.
- **Check case 3 (interior pile, edge distances 3 ft):**
  - Before: bo = min(π(43) = 135.1, 105.8) = 105.8 in → φVn = 548.4 kip.
  - After: bo = min(π(30.04) = 94.4, 95.6) = 94.4 in → φVn = 489.3 kip (**−10.8%, more conservative**).
- **How verified:** node run before/after.
- **Other copies of this code:** none known.

### F5. Load-case envelope: "D/C comb" shows the interaction ratio; `tenR` field names   [bug fix / display] [no calc change]
- **Where:** `runAllCases` row builder (≈ line 11164). Anchor text: `combR: c.type`
- **Problem:**
  - `combR` printed `R2.comb.ratio`, which is Po/Pe (the column-curve parameter), in the "D/C comb" column of the envelope and the printed summary.
  - `tenR` read `phiPn_geoUp` and `phiPn_strUp`, which do not exist, so it was always about 0. That value was latent, not displayed.
- **Before:**
  ```js
  combR: c.type === "service" ? null : R2.comb.ratio,
  tenR: c.type === "tension" ? rat(I2.Tu, Math.min(R2.tension && R2.tension.phiPn_geoUp || 1e9, R2.tension && R2.tension.phiPn_strUp || 1e9)) : null,
  ```
- **After:**
  ```js
  combR: c.type === "service" ? null : R2.comb.interaction, // P-M interaction value (was R2.comb.ratio = Po/Pe)
  tenR: c.type === "tension" ? rat(I2.Tu, Math.min(R2.tension && R2.tension.phiPn_up || 1e9, R2.tension && R2.tension.phiPn_tension_total || 1e9)) : null,
  ```
- **Check case:** defaults. The column showed 0.008 (Po/Pe) and now shows 0.494 (the Eq. 6.9.2.2.1-3 interaction).
- **How verified:** node run of `computeAll(defaults)` (`comb.ratio` = 0.008, `comb.interaction` = 0.494; `tension.phiPn_up` = 54.98, `phiPn_tension_total` = 626.1).
- **Other copies of this code:** none known.

### F6. Davisson fixity: keep `nh`/`kh` on soil-JSON import; fall back with a warning instead of NaN   [bug fix] [less conservative than a NaN "fail": a number is now computed]
- **Where:** `normalizeSoilLayersImport` (≈ line 9045) and the `computeAll` buckling block (≈ line 2258). Anchor text: `nh/kh are KEPT` and `top layer has no`
- **Problem:** The importer deleted `nh`/`kh`. Davisson then read `undefined`, so T, Lf, Pe and φPn were NaN and the buckling check showed "—"/fail.
- **Before:**
  ```js
  delete r.nh; delete r.kh;   // legacy uniform-soil fields; never read by the layered solver — drop
  // so a stale value can't be mistaken for something that does something here.
  ```
  ```js
  bklStiff = bklSoilIsSand ? top.nh : top.kh;
  bklSoilSrc = "layered profile (top layer: " + (top.type || "sand") + ")";
  ```
- **After:**
  - Importer: keeps values; backfills missing ones with a warning.
    ```js
    if (!(typeof r.nh === "number" && isFinite(r.nh) && r.nh > 0)) { r.nh = 60; if (r.type === "sand") warnings.push("Layer " + (i + 1) + ": n_h missing — defaulted to 60 (Davisson fixity / linear solver). VERIFY."); }
    if (!(typeof r.kh === "number" && isFinite(r.kh) && r.kh > 0)) { r.kh = 150; if (r.type !== "sand") warnings.push("Layer " + (i + 1) + ": k_h missing — defaulted to 150 (Davisson fixity / linear solver). VERIFY."); }
    ```
  - `computeAll`: covers layers saved by the old importer.
    ```js
    if (!(typeof bklStiff === "number" && isFinite(bklStiff) && bklStiff > 0)) {
      bklStiff = bklSoilIsSand ? 60 : 150;
      bklSoilSrc += " — ⚠ top layer has no " + (bklSoilIsSand ? "n_h" : "k_h") + "; default " + bklStiff + " used";
      inputNotes.push("Davisson fixity: the top soil layer has no ... value, so the default ... was used. ...");
    }
    ```
  - 60 and 150 are the values new layer rows and the LPILE mapping already hardcode.
- **Check case:** buckling enabled, 10 ft stickup, default soil layers with `nh`/`kh` removed (as the old importer left them).
  - Before: bklStiff = undefined, T = NaN, Lf = NaN, φPn = NaN.
  - After: nh = 60, T = (EI/60)^(1/5) = 2.69 ft, Lf = 1.8T = 4.84 ft, Pe = 85.9 kip, φPn = 60.2 kip. This is identical to the result with `nh` present, and a note is shown.
  - Import `{nh: 40}` on a sand layer: before nh → undefined; after nh = 40 is kept.
- **How verified:** node run before/after.
- **Other copies of this code:** none known.

### F7. φc steel-only text   [display] [no result change]
- **Where:** `PHI_PRESETS.struct` notes (≈ lines 774–777) and `PHI_INFO.phiC` options (≈ line 828). Anchor text: `steel-only axial compression is 0.95`
- **Problem:** The text cited "φc = 0.90 (6.5.4.2)" for steel-only compression. Since the 8th Ed., 6.5.4.2 gives 0.95 for steel-only and 0.90 for composite members.
- **Change:**
  - Text only. The presets still seed `phiC: 0.90`, and the `phiC` default stays 0.80.
  - The notes now say "φc seeded at 0.90 (6.5.4.2 composite); steel-only axial compression is 0.95 (6.5.4.2, 8th Ed.+)".
  - `PHI_INFO.phiC` now lists 0.95 (steel-only, 6.5.4.2, 8th Ed.+), 0.90 (composite) and 0.80 (app default, conservative).
  - The `phiV` info text now says it is not applied to cap punching (see F4).
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.5.4.2.
- **Check case:** n/a (text only). The default results are unchanged per the regression script.
- **Other copies of this code:** none known.

### F8. Robustness: null fields on load, deferred revoke, divide-by-zero guards   [robustness] [no result change for valid inputs]
- **Null-to-default on load.**
  - **Where:** new `mergeSavedInputs()` (≈ line 5837), used by `loadSavedInputs`, `importProject` and the IndexedDB `loadProject`. Anchor text: `function mergeSavedInputs`
  - **Problem:** A blank numeric field stores NaN, which JSON saves as `null`. On reload, `{...DEFAULT_INPUTS, ...parsed}` kept that `null` over the default.
  - **Before:** `return { ...DEFAULT_INPUTS, ...parsed };` (and the same spread pattern in import and library load).
  - **After:** `mergeSavedInputs(parsed)` copies every saved key except a `null` whose default is a number. That key keeps the default and is listed in a dismissable note ("Blank field(s) in the loaded data were restored to their defaults: …"). The function also runs the F3 H-pile φ migration.
  - The storage keys and the saved format are unchanged. Nested objects (soil layers, load cases) are not touched.
  - **Check case:** `{OD: null, STL: 150}`. Before: OD = null. After: OD = 7 (default), STL = 150 kept.
- **Manual download.**
  - **Where:** `downloadManual` (≈ line 5355).
  - **Before:** `document.body.removeChild(a); URL.revokeObjectURL(url);`
  - **After:** `document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000);`. This is the same pattern `exportProject` already uses.
- **Input guards.**
  - **Where:** top of `computeAll` (≈ line 1587) and the end of `computeAll`. A banner appears under the check index, and the printed report header lists the errors. Anchor text: `const inputErrors = []`
  - **After:** in micropile mode, the following push to `R.inputErrors`, which forces `R.allPass = false` and shows a red "Input error" line:
    - `!(I.OD > 0)`;
    - `!(I.phiGeo > 0)`;
    - `!(I.tc > (I.corr || 0))`.
  - Casing flexure also reports "Invalid: corroded wall thickness <= 0" (see F2).
  - `R.inputNotes` carries non-fatal notes (F6).
  - **Check case:**
    - OD = 0 → Lb_req = ∞ before and after; after: 1 error, and allPass is false.
    - t = 0.1 ≤ corr = 0.2 → before: "Compact (yielding)" with Mn = −14.7 kip-ft; after: Mn = 0, mode invalid, 1 error.
- **How verified:** node runs before/after; render harness for each case.
- **Other copies of this code:** none known.

### F9. CFST C′ cap of 0.9 in `computeAll`   [calc change] [more conservative]
- **Where:** `computeAll` §5b (≈ line 1906) and Module CFST C′ line. Anchor text: `const Cp_raw`
- **Problem:**
  - `computeAll` used C′ = 0.15 + Pdl/Po + (Ast + Asb)/(Ast + Asb + Ac) with no upper limit.
  - The app's own p-y `EI_aashto` applies `Math.min(..., 0.9)`, and its comment cites "<= 0.9".
  - This is a clear omission in one of the two copies.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.9.6.3.2, CFST effective stiffness EIeff = EsIs + EsIsr + C′EcIc with C′ ≤ 0.9. **Please confirm the cap against your copy of the 10th Ed.**
- **Before:** `const Cp = 0.15 + Pdl / Po_cfst + (Ast_c + Asb_c) / (Ast_c + Asb_c + Ac_c);`
- **After:**
  ```js
  const Cp_raw = 0.15 + Pdl / Po_cfst + (Ast_c + Asb_c) / (Ast_c + Asb_c + Ac_c);
  const Cp = Math.min(Cp_raw, 0.9); // C' <= 0.9 (same cap as the p-y EI_aashto option)
  ```
  `R.cfst.Cp_raw` was added, and Module CFST prints `… = C′raw ≤ 0.9 ⇒ C′ = …`.
- **Check case:** CFST on, defaults, with Pdl = 600 kip. Po = 803.5 kip, Ast + Asb = 8.745 in², Ac = 28.38 in².
  - C′raw = 0.15 + 600/803.5 + 8.745/37.12 = 1.132.
  - Before: C′ = 1.132, EIeff = 1,520,997 kip-in², Pe = 2140.4 kip, Pr = 618.0 kip.
  - After: C′ = 0.900, EIeff = 1,458,917 kip-in², Pe = 2087.6 kip, Pr = 615.5 kip.
  - At the defaults (Pdl = 0, C′ = 0.386) there is no change.
- **How verified:** node run before/after.
- **Other copies of this code:** the p-y `EI_aashto` in `App` already had the cap.

## 2026-10-04 — "All tools" link and shared project info
### F10. "← All tools" link; "Use shared project info" / "Share project info" buttons   [feature (no result change)]
- **Date:** 2026-10-04. **Type:** feature (no result change). Approved by the engineer (step 1 of the cross-tool hand-off work, HANDOFF.md §4.1).
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, because tools can be shown inside index.html's iframe), placed in the App header (`header.blueprint-grid`), first row of the hero. It is hidden in print.
- **Shared project info:** two buttons in the "Project Info" panel in the input rail, after the Subject field.
  - **Share** builds the full `fields` object (all 8 HANDOFF §4.1 fields, blank where this tool has no field) and calls `BridgeXfer.publish('projectMeta', {_schema:'bridge-project-meta', project:{name, bridgeId}, fields})`. Key: `bridgeSuite.v1.projectMeta` (+ `.updatedAt`). On Share, the placeholder defaults from `DEFAULT_INPUTS` ("Project Name", "Job No.", "ABC", "XYZ") are sent as blank (`pileProjShareValues`).
  - **Use** calls `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm listing the producer, time, project and every field that will change (old → new), and writes only this tool's mapped fields. A blank shared value never blanks a field. Apply path: `setI(s => ({...s, ...patch}))`, so the existing debounced autosave (`STORAGE_KEY`) and re-render run as for typing. Records `bridgeSuite.v1.projectMeta.adopted.<id>`.
- **Field mapping (shared → this tool):**

  | Shared field | Tool field | Label |
  |---|---|---|
  | `projectName` | `projName` | Project name |
  | `jobNo` | `projNum` | Job no. |
  | `preparedBy` | `projBy` | By |
  | `checkedBy` | `projChk` | Chk |

  Not mapped: bridgeId, client, location, date (the report date is computed as today, not an input). Subject (`projSubject`) has no shared field.
- **Helpers added:** a plain `<script>` with BridgeXfer v1 verbatim from HANDOFF.md §5, then a plain `<script>` with `ProjMetaUI` (shown in full in the After code below) and this tool's field map. Both sit before the tool's own script.
- **Storage:** no existing key or saved-data format changed. New keys only: `bridgeSuite.v1.projectMeta`, `.updatedAt`, `.adopted.<id>` (HANDOFF.md §2).
- **Line endings:** this file uses CRLF; the inserted lines use CRLF too.
- **Where / Before / After** (each change is an insertion; the Before text is the anchor and is kept):
  1. Anchor: `}, /*#__PURE__*/React.createElement("span", null, "AASHTO LRFD BDS 10th Ed."),`
     - Before:
       ```
         }, /*#__PURE__*/React.createElement("span", null, "AASHTO LRFD BDS 10th Ed."), 
       ```
     - After:
       ```
         }, /*#__PURE__*/React.createElement("a", {
           href: "tools.html",
           target: "_top",
           title: "Open the list of all tools",
           className: "no-print hover:text-white"
         }, "\u2190 All tools"), /*#__PURE__*/React.createElement("span", {
           className: "opacity-40 no-print"
         }, "/"), /*#__PURE__*/React.createElement("span", null, "AASHTO LRFD BDS 10th Ed."), 
       ```
  2. Anchor: `onChange: v => setStr('projSubject', v)`
     - Before:
       ```
           onChange: v => setStr('projSubject', v)
         }))), 
       ```
     - After:
       ```
           onChange: v => setStr('projSubject', v)
         }), /*#__PURE__*/React.createElement("div", {
           className: "flex gap-2 no-print"
         }, /*#__PURE__*/React.createElement("button", {
           type: "button",
           onClick: () => {
             const patch = ProjMetaUI.use(PILE_PROJ_MAP, I, "pileDesigner");
             if (patch) setI(s => ({
               ...s,
               ...patch
             }));
           },
           title: "Fill the project info from project info shared by another tool",
           className: "font-mono-tech text-[9px] px-1.5 py-1 rounded-sm border border-slate-300 text-slate-500 hover:bg-white"
         }, "Use shared project info"), /*#__PURE__*/React.createElement("button", {
           type: "button",
           onClick: () => ProjMetaUI.share(PILE_PROJ_MAP, pileProjShareValues(I), "Pile Designer", "Pile Designer.html"),
           title: "Make this project info available to the other tools",
           className: "font-mono-tech text-[9px] px-1.5 py-1 rounded-sm border border-slate-300 text-slate-500 hover:bg-white"
         }, "Share project info")))), 
       ```
  3. Anchor: `<div id="root"></div>`
     - Before:
       ```
       <div id="root"></div>

       <script>
       const {
       ```
     - After:
       ```
       <div id="root"></div>

       <script>
       /* BridgeXfer v1 verbatim from HANDOFF.md §5 (73 lines, starts "/* BridgeXfer v1 — cross-tool hand-off helper.", ends "})();") */
       </script>
       <script>
       /* Shared project info buttons (HANDOFF.md §4.1, channel bridgeSuite.v1.projectMeta). Uses window.BridgeXfer.
          map: [{shared:'<HANDOFF field>', key:'<this tool's field>', label:'<this tool's label>', accept:optional fn(v)->bool}]
          values: { <tool key>: <current value> } */
       (function(){
         if(window.ProjMetaUI) return;
         var FIELDS=['projectName','bridgeId','jobNo','client','location','preparedBy','checkedBy','date'];
         function s(v){ return (v===undefined||v===null)?'':String(v); }
         function share(map, values, producer, producerFile){
           var fields={}; FIELDS.forEach(function(k){ fields[k]=''; });
           map.forEach(function(m){ fields[m.shared]=s(values[m.key]); });
           var r=window.BridgeXfer.publish('projectMeta', {_schema:'bridge-project-meta', project:{ name:fields.projectName, bridgeId:fields.bridgeId }, fields:fields}, producer, producerFile);
           if(r.error){ alert('Could not share project info: '+r.error); return r; }
           var lines=map.map(function(m){ return '  '+m.label+': '+(fields[m.shared]||'(blank)'); });
           alert('Project info shared with the other tools:\n\n'+lines.join('\n'));
           return r;
         }
         function use(map, values, receiverId){
           var r=window.BridgeXfer.read('projectMeta','bridge-project-meta',1);
           if(r.error){ alert('Shared project info: '+r.error+(r.empty?'\n\nOpen a tool that has project info and click "Share project info" first.':'')); return null; }
           var p=r.payload, f=(p.fields&&typeof p.fields==='object')?p.fields:{}, patch={}, lines=[], skipped=[];
           map.forEach(function(m){
             var v=s(f[m.shared]);
             if(v.trim()==='') return;                                   /* never blank a field */
             if(m.accept && !m.accept(v)){ skipped.push('  '+m.label+': "'+v+'" (not a valid value here)'); return; }
             if(v===s(values[m.key])) return;
             patch[m.key]=v; lines.push('  '+m.label+': "'+s(values[m.key])+'" → "'+v+'"');
           });
           if(!lines.length){ alert('Shared project info ('+window.BridgeXfer.describe(p)+') has nothing new for this tool.'+(skipped.length?'\n\nNot used:\n'+skipped.join('\n'):'')); return null; }
           if(!confirm('Use shared project info from '+window.BridgeXfer.describe(p)+'?\n\nThis will overwrite:\n'+lines.join('\n')+(skipped.length?'\n\nNot used:\n'+skipped.join('\n'):''))) return null;
           window.BridgeXfer.markAdopted('projectMeta', receiverId, p.producedAt);
           return patch;
         }
         window.ProjMetaUI={ share:share, use:use };
       })();
       /* Pile Designer: shared project info field map (Project Info panel). Defaults ("Project Name", "Job No.", "ABC", "XYZ") are placeholders and are shared as blank. */
       var PILE_PROJ_MAP=[{shared:'projectName',key:'projName',label:'Project name'},
                          {shared:'jobNo',key:'projNum',label:'Job no.'},
                          {shared:'preparedBy',key:'projBy',label:'By'},
                          {shared:'checkedBy',key:'projChk',label:'Chk'}];
       function pileProjShareValues(I){ var v={}; PILE_PROJ_MAP.forEach(function(m){ var d=(typeof DEFAULT_INPUTS!=='undefined')?DEFAULT_INPUTS[m.key]:undefined; v[m.key]=(I[m.key]===d)?'':I[m.key]; }); return v; }
       </script>
       <script>
       const {
       ```
- **Governing provision:** none. UI and cross-tool data hand-off only (HANDOFF.md §2, §4.1, §5). No formula, factor, unit, code reference or computed result changed.
- **Check case:** not applicable (no calculation touched). Functional check: Spread Footing shares {Project Name "Route 9 over Mill Brook", Project Number "J-2026-114", Calculated By "MRL", Date "2026-10-04", Checked By "JKD"}; Use in this tool fills the mapped fields; a blank shared value leaves the existing field unchanged.
- **How verified:** `node --check` on every plain inline script; text/babel blocks transpiled with @babel/standalone; page loaded in jsdom with CDN libraries stubbed (React UMD served locally); Share → Use exercised across Spread Footing, BasePlateAnchorDesigner, Pile Designer, Concrete Anchor and Timber Beam Check (Timber: plain scripts in jsdom, the same calls its onClick handlers make, since it imports React from esm.sh) with a localStorage carried between pages; `git diff --numstat` shows only insertions plus the 2 anchor lines that were split to insert the new elements.
- **Other copies:** BridgeXfer v1 and `ProjMetaUI` are duplicated (CLAUDE.md §3) in Pile Designer.html, Spread Footing.html, BasePlateAnchorDesigner.html, Concrete Anchor.html and Timber Beam Check.html (this PR), plus any other tools that received BridgeXfer in their own step-1 PRs.
- **`ProjMetaUI`:** given in full in the After code of the helper insertion above; the copy is identical in every tool listed.

## 2026-10-05 — PR: claude/conn-foundation-loads (PR link added after merge)

### F11. Pull foundation loads from the abutment calculator / SubLoads (HANDOFF.md §4.6, channel `foundationLoads`)   [feature: hand-off (no result change)]
- **Where:** (1) a new plain `<script>` before the main application script; anchor text `<script>\nconst {\n  useState,` (inserted just before it, after the `pileProjShareValues` script). (2) `PrintReport`, "Project" input rows; anchor `["Checked by", I.projChk, "", ""],`. (3) `App`, Project Info panel, after the "Share project info" button; anchor `"Share project info"))))`.
- **Problem:** none (feature).
- **Governing provision:** n/a. No formula, factor, default or unit changed. The receiver reads `deriveLoadPoints`, `deriveGroupCases`, `computeCapDist` (for the default centroid, with cap/stem weight off), `caseIsZero`, `pileWidth` and writes inputs only through `setI` after **Import**.
- **What it does:** **Pull from Abutment / SubLoads** (● new data from `BridgeXfer.isNew('foundationLoads','pileDesigner')`) and **Import hand-off (JSON)**. Nothing is applied on page load. The dialog lists every valid sender copy (`.by.abutment`, `.by.subloads`, the channel key), shows producer, time, project, element, location, the sender's sign convention and notes, the cases, and exactly what will change. Refused in integral-abutment mode.
- **Load-case structure checked:** the LRFD case table (`I.loadCases`: `{name, type: strength|extreme|service|tension, STL kip, Plat kip, Mhead kip-ft}`) holds **per-pile** loads; each row is checked with its own φ set (Extreme Event φ = 1.0, service rows for deflection only). The group workspace (`I.loadPoints` + `I.groupCases`, mags `{P, Vx, Vy, Mx, My}` kip / kip-ft) holds cap loads and emits one "Group ▦" row per case for the governing pile. A footing / pile-cap resultant therefore goes to the group workspace by default.
- **Mapping:**

| Hand-off case (axes mapped: pile +x/+y = ± hand-off x or y, default identity) | Group workspace target (default) | Single-pile table target (only after "acts on one pile" is ticked) |
|---|---|---|
| `P` (+ down) | `mags[pt].P` | `STL = |P|`; type `tension` when P < 0 |
| `Vx`, `Vy` | `mags[pt].Vx`, `.Vy` | lateral `Plat` = √(Vx² + Vy²) (default), or |Vx| or |Vy| |
| `Mx`, `My` (effect-based, same as `Mx_eff = Mx + Vy·z + P·e_y`) | `mags[pt].Mx`, `.My` | `Mhead` = 0 (default) or |M| in the same plane |
| `factored`, `limitState` | type `strength`; `extreme` for an Extreme Event limit state; `service` when `factored:false` | same (tension overrides) |
| reference point | load location "Foundation hand-off" at (x, y) entered in pile coordinates, default = centroid of the current layout; z = 0 | — |
| `includes.footingWeight` | offers to switch off `capIncludeWeight` / `stemEnable` (default on) | — |

  Other choices: turn on `groupEnable` (default on), replace previously imported rows (default; only rows tagged `_bx.ch = "foundationLoads"` are removed) or add. Source: new optional field `I.foundationSrc` (`producer, producerFile, producedAt, project, element, location, target, cases, axes, point, lateral, moment, mode, via, adoptedAt, notes`), saved with the inputs, shown under the project buttons and printed in the report's "Project" input rows.
- **Before / After** (exact):
  1. New script. Before: `</script>` (end of the `pileProjShareValues` script) followed by `<script>` / `const {` / `  useState,`. After — inserted between them:
```html
/* Foundation-load hand-off receiver (HANDOFF.md §4.6, channel foundationLoads; senders: abutment_calculator.html,
   Bridge Substructure Loading.html). Project panel: "Pull from Abutment / SubLoads" (new-data marker) and
   "Import hand-off (JSON)". Nothing is applied on page load. The dialog shows the source, the sender's sign
   convention, every case, and exactly what will change; it applies only on "Import". Two targets, the user's choice:
   - Pile group workspace (default): each case becomes one group load case (groupCases, type strength / extreme /
     service from the case's factored flag and limit state) acting at one load location "Foundation hand-off"
     (loadPoints, z = 0) placed at the reference point (default: the pile-group centroid). The existing rigid-cap
     distribution then gives each pile's load and adds a "Group ▦" row per case to the LRFD case table.
   - Single-pile LRFD case table: each case becomes one row (STL = P, lateral and head moment as chosen), only for
     loads that act on ONE pile.
   Hand-off and group workspace use the same effect-based moment convention (+My moves the resultant toward +x,
   +Mx toward +y; P + down), so only the axes are mapped. Imported rows carry a "_bx" tag; "replace" removes only
   tagged rows. The source is kept in the new optional input field I.foundationSrc (saved with the inputs,
   printed in the report). No calculation changes. Uses BridgeXfer v1 (above). */
(function(){
  if(window.PileFoundationXfer) return;
  var CH='foundationLoads', SCHEMA='bridge-foundation-loads', MAXV=1, RID='pileDesigner', BY=['abutment','subloads'];
  var FORCE={kip:1,kips:1,k:1,lb:0.001,lbf:0.001,lbs:0.001};               /* -> kip */
  var MOMENT={'kip-ft':1,'kip·ft':1,'k-ft':1,'ft-kip':1,'kip-in':1/12,'lb-ft':0.001,'ft-lb':0.001,'lb-in':0.001/12};   /* -> kip-ft */
  var AX=['+x','-x','+y','-y'], AXL={'+x':'+x of the hand-off','-x':'−x of the hand-off','+y':'+y of the hand-off','-y':'−y of the hand-off'};
  var PT_NAME='Foundation hand-off';
  function isNum(v){ return typeof v==='number' && isFinite(v); }
  function f2(v,d){ return isNum(v) ? (Math.abs(v)<1e-12?0:v).toFixed(d==null?2:d) : '—'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function h(tag,css,html){ var e=document.createElement(tag); if(css) e.style.cssText=css; if(html!==undefined) e.innerHTML=html; return e; }
  function when(iso){ var d=new Date(iso); if(isNaN(d)) return String(iso||'?');
    function p(n){ return (n<10?'0':'')+n; }
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }
  function projName(p){ return (p.project && typeof p.project==='object') ? (p.project.name||'') : String(p.project||''); }
  function r6(v){ return Math.round(v*1e6)/1e6; }
  function short(p){ return /abut/i.test(p.producer||'')?'Abut':/substructure|subloads/i.test(p.producer||'')?'SubLoads':(p.producer||'Hand-off'); }

  /* ---- validate and convert to kip / kip-ft (same check as Spread Footing's receiver) ---- */
  function check(p){
    var out={err:[],warn:[],cases:[]};
    var e=BridgeXfer.validate(p,SCHEMA,MAXV); if(e){ out.err.push(e); return out; }
    var u=p.units||{}, kf=FORCE[u.force], km=MOMENT[u.moment];
    if(!kf){ out.err.push('Unknown force unit "'+(u.force||'')+'". Accepted: kip, or lb (converted ÷ 1000).'); return out; }
    if(!km){ out.err.push('Unknown moment unit "'+(u.moment||'')+'". Accepted: kip-ft, kip-in, lb-ft, lb-in.'); return out; }
    if(u.length!==undefined && u.length!=='ft'){ out.err.push('Unknown length unit "'+u.length+'". Accepted: ft.'); return out; }
    if(kf!==1) out.warn.push('Forces converted from '+u.force+' to kip (× '+kf+').');
    if(km!==1) out.warn.push('Moments converted from '+u.moment+' to kip-ft (× '+km+').');
    if(!Array.isArray(p.cases) || !p.cases.length){ out.err.push('The payload has no load cases.'); return out; }
    p.cases.forEach(function(c,i){
      var nm=(c && c.name) ? String(c.name) : 'case '+(i+1);
      if(!c || typeof c!=='object'){ out.err.push('Case '+(i+1)+' is not an object.'); return; }
      if(typeof c.factored!=='boolean'){ out.err.push(nm+': "factored" must be true or false.'); return; }
      var v={}, bad=[];
      ['P','Vx','Vy','Mx','My'].forEach(function(k){ if(!isNum(c[k])) bad.push(k+' = '+JSON.stringify(c[k])); else v[k]=c[k]*(k[0]==='M'?km:kf); });
      if(bad.length){ out.err.push(nm+': not a finite number: '+bad.join(', ')+'.'); return; }
      out.cases.push({i:i,name:nm,limitState:String(c.limitState||''),factored:c.factored,governs:c.governs||'',combination:c.combination||'',P:v.P,Vx:v.Vx,Vy:v.Vy,Mx:v.Mx,My:v.My});
    });
    return out;
  }
  function mapAxes(c,ax){
    function comp(a){ var s=a.charAt(0)==='-'?-1:1, k=a.charAt(1); return {V:s*(k==='x'?c.Vx:c.Vy), M:s*(k==='x'?c.My:c.Mx)}; }
    var X=comp(ax.x), Y=comp(ax.y);
    return {P:c.P, Vx:X.V, Vy:Y.V, Mx:Y.M, My:X.M};
  }
  function caseType(c){ return !c.factored ? 'service' : (/extreme/i.test(c.limitState) ? 'extreme' : 'strength'); }
  function candidates(){
    var keys=BY.map(function(b){ return BridgeXfer.NS+CH+'.by.'+b; }).concat([BridgeXfer.NS+CH]), seen={}, out=[];
    keys.forEach(function(k){ var raw=null; try{ raw=localStorage.getItem(k); }catch(e){}
      if(!raw) return; var p; try{ p=JSON.parse(raw); }catch(e){ return; }
      if(BridgeXfer.validate(p,SCHEMA,MAXV)) return;
      var id=(p.producer||'')+'|'+(p.producedAt||''); if(seen[id]) return; seen[id]=1; out.push(p); });
    out.sort(function(a,b){ return String(b.producedAt||'').localeCompare(String(a.producedAt||'')); });
    return out;
  }
  /* pile-group centroid of the current layout (read-only use of the app's own computeCapDist) */
  function centroid(I){
    try{ var w=(typeof pileWidth==='function')?pileWidth(I):0;
      var g={nRows:I.groupNrows,nCols:I.groupNcols,s_in:(I.groupSpacingIn&&I.groupSpacingIn>0?I.groupSpacingIn:(I.groupSpacingDia||3)*w)};
      var cd=computeCapDist(Object.assign({},I,{capIncludeWeight:false,stemEnable:false}),g,[]); return {x:r6(cd.cx),y:r6(cd.cy),n:cd.n}; }
    catch(e){ return {x:0,y:0,n:0}; }
  }
  function tagged(o){ return !!(o && o._bx && o._bx.ch===CH); }
  function defaults(chk,I){
    var c=centroid(I);
    return {target:'group', sel:chk.cases.map(function(){ return true; }), ax:{x:'+x',y:'+y'}, px:c.x, py:c.y, mode:'replace',
      groupOn:true, wtOff:true, lat:'res', mom:'zero', single:false};
  }
  /* ---- plan: exactly what will change. Pure: reads I, returns the patch. ---- */
  function plan(p,chk,o,I){
    var r={err:[],warn:[],changes:[],patch:{},rows:[]};
    if(I.pileType==='iab') r.err.push('Integral-abutment mode takes the unfactored gravity load per pile (MassDOT simplified method), not foundation load cases. Switch the pile type to micropile or H-pile to import.');
    if(o.ax.x.charAt(1)===o.ax.y.charAt(1)) r.err.push('Map pile x and y to different hand-off axes.');
    var picked=chk.cases.filter(function(c,j){ return o.sel[j]; });
    if(!picked.length) r.err.push('Tick at least one case.');
    if(o.target==='single' && !o.single) r.err.push('Single-pile target: tick the box to confirm these loads act on one pile. A footing or pile-cap resultant must go to the pile group workspace.');
    if(o.target==='group' && (!isNum(o.px) || !isNum(o.py))) r.err.push('Enter the reference-point location (x, y) in pile coordinates.');
    if(r.err.length) return r;
    var src={ch:CH,producer:p.producer||'',producedAt:p.producedAt||''}, sh=short(p);
    if(o.target==='group'){
      var pts=deriveLoadPoints(I).map(function(x){ return Object.assign({},x); }), gcs=deriveGroupCases(I).map(function(x){ return Object.assign({},x); });
      var pt=pts.filter(tagged)[0], nextPt=pts.reduce(function(m,x){ return Math.max(m,x.id||0); },0)+1;
      if(pt && o.mode==='replace'){ if(pt.x!==o.px||pt.y!==o.py||pt.z!==0) r.changes.push('Load location "'+pt.name+'": (x, y, z) = ('+f2(pt.x)+', '+f2(pt.y)+', '+f2(pt.z||0)+') → ('+f2(o.px)+', '+f2(o.py)+', 0) ft'); pt.x=o.px; pt.y=o.py; pt.z=0; pt.atStemTop=false; pt._bx=src; }
      else { pt={id:nextPt,name:PT_NAME,x:o.px,y:o.py,z:0,_bx:src}; pts.push(pt); r.changes.push('New load location "'+PT_NAME+'" #'+pt.id+' at (x, y, z) = ('+f2(o.px)+', '+f2(o.py)+', 0) ft'); }
      var keep=gcs, removed=[];
      if(o.mode==='replace'){ keep=gcs.filter(function(c){ if(tagged(c)){ removed.push(c.name); return false; } return true; }); }
      if(removed.length) r.changes.push('Remove '+removed.length+' previously imported group case(s): '+removed.join('; '));
      var nextId=gcs.reduce(function(m,c){ return Math.max(m,c.id||0); },0)+1, add=[];
      picked.forEach(function(c){ var m=mapAxes(c,o.ax), mags={}; mags[pt.id]={P:r6(m.P),Vx:r6(m.Vx),Vy:r6(m.Vy),Mx:r6(m.Mx),My:r6(m.My)};
        var g={id:nextId++,name:sh+': '+c.name,type:caseType(c),mags:mags,_bx:Object.assign({case:c.name},src)}; add.push(g);
        r.rows.push({name:g.name,type:g.type,P:m.P,Vx:m.Vx,Vy:m.Vy,Mx:m.Mx,My:m.My}); });
      r.changes.push('Add '+add.length+' group load case(s) at "'+pt.name+'" (table below)');
      var others=keep.filter(function(c){ return !tagged(c) && !caseIsZero(c); });
      if(others.length) r.warn.push('The group workspace keeps '+others.length+' other non-zero case(s) ('+others.map(function(c){ return c.name; }).join('; ')+'); they also become Group ▦ rows in the LRFD table.');
      r.patch.loadPoints=pts; r.patch.groupCases=keep.concat(add);
      if(!I.groupEnable){ if(o.groupOn){ r.patch.groupEnable=true; r.changes.push('"Apply pile group to the design": off → on'); } else r.warn.push('"Apply pile group to the design" is off: the imported group cases are stored but not used until you turn it on (Pile Group Workspace).'); }
      var inc=p.includes||{};
      if(inc.footingWeight && (I.capIncludeWeight || I.stemEnable)){
        if(o.wtOff){ if(I.capIncludeWeight){ r.patch.capIncludeWeight=false; r.changes.push('Cap self-weight + soil surcharge: on → off (the hand-off already includes the footing weight and soil)'); }
          if(I.stemEnable){ r.patch.stemEnable=false; r.changes.push('Stem wall self-weight: on → off (the hand-off already includes the wall)'); } }
        else r.warn.push('The hand-off includes the footing/cap weight and the soil, and this tool also adds its cap'+(I.stemEnable?' and stem':'')+' self-weight: they are counted twice.');
      } else if(!inc.footingWeight && I.capIncludeWeight===false) r.warn.push('The hand-off does not include the footing/cap weight ('+(p.location||'')+'). Turn on the cap self-weight in the Pile Group Workspace if the cap is not otherwise counted.');
      var pnt=p.reference&&p.reference.point;
      if(pnt!=='pileGroupCentroid') r.warn.push('The hand-off moments are about the '+(pnt==='footingCentre'?'footing centre':pnt==='unitCentre'?'unit centre':'sender\'s reference point')+'. The location (x, y) above must be that point in pile coordinates; the default is the pile-group centroid ('+f2(centroid(I).x)+', '+f2(centroid(I).y)+'), i.e. it assumes the group is centred on it.');
      r.warn.push('z = 0: the moments are taken as given at the pile heads (the hand-off level, '+(p.location||'')+'); no V·z is added.');
    } else {
      var base=(Array.isArray(I.loadCases)&&I.loadCases.length)? I.loadCases.filter(function(c){ return c && !(typeof c.name==='string' && c.name.indexOf('Group ▦')===0); }) : [{name:'Case 1 — Strength',type:'strength',STL:I.STL,Plat:I.Plat,Mhead:I.pyMhead||0}];
      var kept=base, gone=[];
      if(o.mode==='replace') kept=base.filter(function(c){ if(tagged(c)){ gone.push(c.name); return false; } return true; });
      if(gone.length) r.changes.push('Remove '+gone.length+' previously imported LRFD case(s): '+gone.join('; '));
      var rows=[];
      picked.forEach(function(c){ var m=mapAxes(c,o.ax), V, M;
        if(o.lat==='x'){ V=m.Vx; M=m.My; } else if(o.lat==='y'){ V=m.Vy; M=m.Mx; } else { V=Math.hypot(m.Vx,m.Vy); M=Math.hypot(m.Mx,m.My); }
        var t=caseType(c); if(c.P<0) t='tension';
        var row={name:sh+': '+c.name,type:t,STL:r6(Math.abs(c.P)),Plat:r6(Math.abs(V)),Mhead:o.mom==='same'?r6(Math.abs(M)):0,_bx:Object.assign({case:c.name},src)};
        rows.push(row); r.rows.push({name:row.name,type:row.type,P:row.STL,V:row.Plat,M:row.Mhead}); });
      r.changes.push('Add '+rows.length+' LRFD load case row(s) (table below)');
      r.patch.loadCases=kept.concat(rows);
      if(picked.some(function(c){ return c.P<0; })) r.warn.push('Cases with net uplift (P < 0) become "tension" rows with STL = |P|.');
      r.warn.push('Lateral = '+(o.lat==='res'?'√(Vx² + Vy²)':'V'+o.lat)+'; head moment = '+(o.mom==='same'?(o.lat==='res'?'√(Mx² + My²)':'|M| in the same plane')+', entered as positive (same sense as the lateral load)':'0 (not imported)')+'.');
      if(I.groupEnable) r.warn.push('The pile group is applied: the group workspace still adds its own Group ▦ rows.');
    }
    var nf=picked.filter(function(c){ return !c.factored; }).length;
    if(nf) r.warn.push(nf+' service case(s) (factored:false) are imported as type "service" (deflection check only).');
    r.patch.foundationSrc={producer:p.producer||'',producerFile:p.producerFile||'',producedAt:p.producedAt||'',project:p.project||'',
      element:p.element||null,location:p.location||'',target:o.target,cases:picked.map(function(c){ return c.name; }),
      axes:{x:o.ax.x,y:o.ax.y},point:o.target==='group'?{x:o.px,y:o.py,z:0}:null,lateral:o.target==='single'?o.lat:null,moment:o.target==='single'?o.mom:null,mode:o.mode,
      notes:(p.notes||[]).slice(0,20)};
    return r;
  }
  function apply(p,chk,o,I,setter,via){
    var r=plan(p,chk,o,I); if(r.err.length) return r;
    var patch=Object.assign({},r.patch); patch.foundationSrc=Object.assign({},patch.foundationSrc,{via:via||'pull',adoptedAt:new Date().toISOString()});
    setter(function(s){ return Object.assign({},s,patch); });
    BridgeXfer.markAdopted(CH,RID,p.producedAt);
    r.ok=true; r.applied=patch;
    setTimeout(refreshBar,0);
    return r;
  }
  function openDialog(list,I,setter,via){
    var si=0, p=list[0], chk=check(p);
    if(chk.err.length){ alert('Foundation-load hand-off refused:\n  '+chk.err.join('\n  ')); return null; }
    var o=defaults(chk,I);
    var old=document.getElementById('pfxOverlay'); if(old) old.remove();
    var ov=h('div','position:fixed;inset:0;background:rgba(8,18,28,.55);z-index:1000;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif'); ov.id='pfxOverlay';
    var box=h('div','background:#fff;color:#1a1a1a;border-radius:6px;padding:12px 16px;width:960px;max-width:96vw;max-height:90vh;overflow:auto;font-size:12px;line-height:1.4'); ov.appendChild(box);
    var head=h('div'), body=h('div'), sum=h('div'); box.appendChild(head); box.appendChild(body); box.appendChild(sum);
    var row=h('div','display:flex;gap:8px;justify-content:flex-end;margin-top:10px;border-top:1px solid #ccc;padding-top:8px');
    var ca=h('button','padding:3px 10px;border:1px solid #94a3b8;border-radius:3px','Cancel'), go=h('button','padding:3px 10px;border:1px solid #14304a;border-radius:3px;background:#14304a;color:#fff','<b>Import</b>'); go.id='pfxGo'; ca.id='pfxCancel';
    row.appendChild(ca); row.appendChild(go); box.appendChild(row);
    var WB='background:#fff8e1;border:1px solid #f9a825;padding:5px 8px;margin:4px 0', TB='border-collapse:collapse;width:100%;margin:4px 0', TD='border:1px solid #ddd;padding:1px 5px';
    function opt(sel,val,txt,on){ var op=document.createElement('option'); op.value=val; op.textContent=txt; if(on) op.selected=true; sel.appendChild(op); }
    function draw(){
      head.innerHTML='';
      head.appendChild(h('div',null,'<b style="font-size:14px">Import foundation loads</b>'));
      if(list.length>1){ var sl=h('label',null,'<b>Sender</b> '), ss=document.createElement('select'); ss.id='pfxSrcSel';
        list.forEach(function(q,i){ opt(ss,i,(q.producer||'?')+' — '+when(q.producedAt)+((q.element&&q.element.label)?' — '+q.element.label:''),i===si); }); sl.appendChild(ss); head.appendChild(sl); }
      head.appendChild(h('div','color:#334155;margin:4px 0','<b>Source:</b> '+esc(p.producer||'?')+(p.producerFile?' ('+esc(p.producerFile)+')':'')+
        ' &middot; <b>sent</b> '+esc(when(p.producedAt))+' &middot; <b>project</b> '+esc(projName(p)||'—')+
        (p.element?' &middot; <b>element</b> '+esc((p.element.type||'')+' '+(p.element.label||'')):'')+(via==='file'?' &middot; from a JSON file':'')+
        '<br><b>Location:</b> '+esc(p.location||'—')+'<br><b>Sign convention (sender):</b> '+esc(p.signConvention||'—')+
        (p.axes?'<br><b>Axes (sender):</b> x: '+esc(p.axes.x||'')+'; y: '+esc(p.axes.y||''):'')));
      head.appendChild(h('div',WB,'This tool (pile group workspace): P + = down; +Vx, +Vy toward +x, +y of the pile coordinates; M<sub>x,eff</sub> = Mx + Vy·z + P·e<sub>y</sub> and M<sub>y,eff</sub> = My + Vx·z + P·e<sub>x</sub>, so +My moves the resultant toward +x and +Mx toward +y — the same effect-based convention as the hand-off. Only the axes are mapped.'));
      if(chk.warn.length) head.appendChild(h('div',WB,chk.warn.map(esc).join('<br>')));
      if(p.notes && p.notes.length){ var nb=h('details'); nb.appendChild(h('summary',null,'Sender notes ('+p.notes.length+')'));
        nb.appendChild(h('div','color:#475569',p.notes.map(function(n){ return '&bull; '+esc(n); }).join('<br>'))); nb.open=true; head.appendChild(nb); }
      body.innerHTML='';
      var tg=h('div','margin:6px 0','<b>Target:</b> <label><input type="radio" name="pfxTarget" value="group"'+(o.target==='group'?' checked':'')+'> Pile group workspace (footing / pile-cap resultant, distributed to the piles)</label> &nbsp; '+
        '<label><input type="radio" name="pfxTarget" value="single"'+(o.target==='single'?' checked':'')+'> Single-pile LRFD case table</label>');
      body.appendChild(tg);
      var t=h('table',TB); t.innerHTML='<tr><th style="'+TD+'"><input type="checkbox" id="pfxAll"'+(o.sel.every(Boolean)?' checked':'')+'></th><th style="'+TD+'">Case</th><th style="'+TD+'">Factored</th><th style="'+TD+'">→ type</th><th style="'+TD+'">P (k)</th><th style="'+TD+'">Vx</th><th style="'+TD+'">Vy</th><th style="'+TD+'">Mx (k-ft)</th><th style="'+TD+'">My</th></tr>';
      chk.cases.forEach(function(c,j){ var tr=h('tr');
        tr.innerHTML='<td style="'+TD+'"><input type="checkbox" data-pfx-case="'+j+'"'+(o.sel[j]?' checked':'')+'></td><td style="'+TD+'" title="'+esc(c.combination)+'">'+esc(c.name)+'</td><td style="'+TD+'">'+(c.factored?'yes':'no')+'</td><td style="'+TD+'">'+((o.target==='single'&&c.P<0)?'tension':caseType(c))+'</td>'+
          ['P','Vx','Vy','Mx','My'].map(function(k){ return '<td style="'+TD+';text-align:right">'+f2(c[k],1)+'</td>'; }).join('');
        t.appendChild(tr); });
      var tw=h('div','max-height:28vh;overflow:auto'); tw.appendChild(t); body.appendChild(tw);
      var g=h('div','display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin:8px 0');
      ['x','y'].forEach(function(a){ var lb=h('label',null,'<b>Pile +'+a+' =</b> '), se=document.createElement('select'); se.id='pfxAx'+a;
        AX.forEach(function(k){ opt(se,k,AXL[k],o.ax[a]===k); }); lb.appendChild(se); g.appendChild(lb); });
      body.appendChild(g);
      var x='';
      if(o.target==='group'){
        x+='<div><b>Reference point in pile coordinates:</b> x <input id="pfxPx" type="number" step="any" value="'+o.px+'" style="width:70px"> y <input id="pfxPy" type="number" step="any" value="'+o.py+'" style="width:70px"> ft, z = 0 '+
          '<span style="color:#64748b">(default: centroid of the current '+centroid(I).n+'-pile layout)</span></div>';
        if(!I.groupEnable) x+='<label><input type="checkbox" id="pfxGrpOn"'+(o.groupOn?' checked':'')+'> turn on "Apply pile group to the design"</label><br>';
        if(p.includes && p.includes.footingWeight && (I.capIncludeWeight||I.stemEnable)) x+='<label><input type="checkbox" id="pfxWt"'+(o.wtOff?' checked':'')+'> switch off this tool\'s cap'+(I.stemEnable?' and stem':'')+' self-weight (the hand-off already includes them)</label><br>';
      } else {
        x+='<div><label><input type="checkbox" id="pfxSingle"'+(o.single?' checked':'')+'> these loads act on <b>one</b> pile (e.g. a single shaft); a footing or pile-cap resultant must use the group workspace</label></div>'+
          '<div><b>Lateral load</b> <select id="pfxLat">'+[['res','resultant √(Vx² + Vy²)'],['x','Vx (pile x)'],['y','Vy (pile y)']].map(function(q){ return '<option value="'+q[0]+'"'+(o.lat===q[0]?' selected':'')+'>'+q[1]+'</option>'; }).join('')+'</select> '+
          '<b>Head moment</b> <select id="pfxMom"><option value="zero"'+(o.mom==='zero'?' selected':'')+'>0 (not imported)</option><option value="same"'+(o.mom==='same'?' selected':'')+'>|M| in the same plane, + with the lateral load</option></select></div>';
      }
      x+='<div><b>Previously imported rows:</b> <label><input type="radio" name="pfxMode" value="replace"'+(o.mode==='replace'?' checked':'')+'> replace</label> <label><input type="radio" name="pfxMode" value="add"'+(o.mode==='add'?' checked':'')+'> keep and add</label> <span style="color:#64748b">(rows you entered yourself are never removed)</span></div>';
      body.appendChild(h('div',null,x));
    }
    function read(){
      var e, r=document.querySelector('input[name="pfxTarget"]:checked'); if(r) o.target=r.value;
      var m=document.querySelector('input[name="pfxMode"]:checked'); if(m) o.mode=m.value;
      Array.prototype.forEach.call(box.querySelectorAll('input[data-pfx-case]'),function(cb){ o.sel[+cb.getAttribute('data-pfx-case')]=cb.checked; });
      if((e=document.getElementById('pfxAxx'))) o.ax.x=e.value; if((e=document.getElementById('pfxAxy'))) o.ax.y=e.value;
      if((e=document.getElementById('pfxPx'))) o.px=parseFloat(e.value); if((e=document.getElementById('pfxPy'))) o.py=parseFloat(e.value);
      if((e=document.getElementById('pfxGrpOn'))) o.groupOn=e.checked; if((e=document.getElementById('pfxWt'))) o.wtOff=e.checked;
      if((e=document.getElementById('pfxSingle'))) o.single=e.checked; if((e=document.getElementById('pfxLat'))) o.lat=e.value; if((e=document.getElementById('pfxMom'))) o.mom=e.value;
      return o;
    }
    function refresh(){
      var r=plan(p,chk,o,I), x='';
      if(r.err.length) x+='<div style="'+WB+';color:#b71c1c;font-weight:bold">'+r.err.map(esc).join('<br>')+'</div>';
      else {
        x+='<div style="margin:6px 0"><b>Will change:</b><ul style="margin:2px 0 2px 18px">'+r.changes.map(function(c){ return '<li>'+esc(c)+'</li>'; }).join('')+
          '<li>Record the source (producer, time, cases) in the inputs (I.foundationSrc); shown in the project panel and printed in the report.</li></ul></div>';
        var t='<table style="'+TB+'"><tr>'+(o.target==='group'?['New group case','type','P','Vx','Vy','Mx','My']:['New LRFD row','type','axial STL','lateral','M head']).map(function(s){ return '<th style="'+TD+'">'+s+'</th>'; }).join('')+'</tr>'+
          r.rows.map(function(q){ return '<tr><td style="'+TD+'">'+esc(q.name)+'</td><td style="'+TD+'">'+q.type+'</td>'+(o.target==='group'?['P','Vx','Vy','Mx','My']:['P','V','M']).map(function(k){ return '<td style="'+TD+';text-align:right">'+f2(q[k],2)+'</td>'; }).join('')+'</tr>'; }).join('')+'</table>';
        x+='<div style="max-height:22vh;overflow:auto">'+t+'</div>';
      }
      if(r.warn.length) x+='<div style="'+WB+'">'+r.warn.map(esc).join('<br>')+'</div>';
      sum.innerHTML=x; go.disabled=!!r.err.length;
      return r;
    }
    function full(){ draw(); refresh(); }
    box.addEventListener('change',function(e){
      var t=e.target; if(!t) return;
      if(t.id==='pfxSrcSel'){ si=+t.value; p=list[si]; chk=check(p);
        if(chk.err.length){ sum.innerHTML='<div style="'+WB+';color:#b71c1c">'+chk.err.map(esc).join('<br>')+'</div>'; go.disabled=true; return; }
        o=defaults(chk,I); full(); return; }
      if(t.id==='pfxAll'){ o.sel=o.sel.map(function(){ return t.checked; }); full(); return; }
      read(); if(t.name==='pfxTarget' || t.getAttribute('data-pfx-case')!==null){ full(); return; } refresh();
    });
    box.addEventListener('input',function(e){ if(e.target && (e.target.id==='pfxPx'||e.target.id==='pfxPy')){ read(); refresh(); } });
    ca.addEventListener('click',function(){ ov.remove(); });
    go.addEventListener('click',function(){ var r=apply(p,chk,read(),I,setter,via); if(r.err.length){ refresh(); return; } ov.remove(); });
    document.body.appendChild(ov);
    full();
    return {overlay:ov, opts:o, chk:chk, refresh:refresh, read:read};
  }
  function sourceLine(I){
    var s=I && I.foundationSrc; if(!s || !s.producedAt && !s.producer) return '';
    return (s.target==='single'?'LRFD case rows':'Pile-group load cases')+' from '+(s.producer||'?')+(s.element&&s.element.label?' ('+s.element.label+')':'')+', '+when(s.producedAt)+
      ((s.project&&(s.project.name||typeof s.project==='string'))?', project '+(s.project.name||s.project):'')+': '+((s.cases||[]).length)+' case(s) at '+(s.location||'?')+
      '; pile +x = hand-off '+((s.axes&&s.axes.x)||'?')+', +y = '+((s.axes&&s.axes.y)||'?')+(s.point?'; at ('+s.point.x+', '+s.point.y+') ft':'')+(s.via==='file'?'; via JSON file':'');
  }
  function refreshBar(){ var nd=document.getElementById('pfxNew'); if(nd) nd.hidden=!BridgeXfer.isNew(CH,RID); }
  function pull(I,setter){
    var list=candidates();
    if(!list.length){ var r=BridgeXfer.read(CH,SCHEMA,MAXV);
      alert('Pull foundation loads: '+(r.ok?'no valid payload.':r.error)+(r.empty?'\n\nIn the abutment calculator or Bridge Substructure Loading, click "Send foundation loads" first.':'')); return null; }
    return openDialog(list,I,setter,'pull');
  }
  function importFile(ev,I,setter){
    var f=ev && ev.target && ev.target.files && ev.target.files[0]; if(!f) return;
    BridgeXfer.importFile(f,SCHEMA,MAXV,function(r){
      if(!r.ok){ alert('Import hand-off: '+r.error); return; }
      openDialog([r.payload],I,setter,'file');
    });
    ev.target.value='';
  }
  window.PileFoundationXfer={check:check,mapAxes:mapAxes,candidates:candidates,centroid:centroid,defaults:defaults,plan:plan,apply:apply,openDialog:openDialog,sourceLine:sourceLine,refreshBar:refreshBar,pull:pull,importFile:importFile};
  window.addEventListener('focus',refreshBar);
  window.addEventListener('storage',refreshBar);
  setInterval(refreshBar,2000);
})();
</script>
<script>
```
  2. `PrintReport`, Project rows. Before:
```js
      ["Checked by", I.projChk, "", ""],
```
     After:
```js
      ["Checked by", I.projChk, "", ""],
      ["Foundation loads from", (window.PileFoundationXfer && PileFoundationXfer.sourceLine(I)) || null, "", "hand-off (HANDOFF.md §4.6)"],
```
  3. `App`, Project Info panel. Before:
```js
  }, "Share project info")))), /*#__PURE__*/(I.pileType === "iab") && /*#__PURE__*/React.createElement(Panel, {
```
     After:
```js
  }, "Share project info")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 no-print"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    id: "pfxPull",
    onClick: () => PileFoundationXfer.pull(I, setI),
    title: "Pull foundation load cases sent by the abutment calculator or Bridge Substructure Loading (channel foundationLoads; asks first, nothing changes until you import)",
    className: "font-mono-tech text-[9px] px-1.5 py-1 rounded-sm border border-slate-300 text-slate-500 hover:bg-white"
  }, "Pull from Abutment / SubLoads", /*#__PURE__*/React.createElement("span", {
    id: "pfxNew",
    hidden: true,
    style: { color: "#b45309", fontWeight: 700 }
  }, " ● new data")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    id: "pfxImp",
    onClick: () => { const f = document.getElementById("pfxFile"); if (f) f.click(); },
    title: "Import a foundationLoads hand-off JSON file (asks first)",
    className: "font-mono-tech text-[9px] px-1.5 py-1 rounded-sm border border-slate-300 text-slate-500 hover:bg-white"
  }, "Import hand-off (JSON)"), /*#__PURE__*/React.createElement("input", {
    type: "file",
    id: "pfxFile",
    accept: ".json,application/json",
    style: { display: "none" },
    onChange: e => PileFoundationXfer.importFile(e, I, setI)
  })), I.foundationSrc && /*#__PURE__*/React.createElement("div", {
    id: "pfxSrc",
    className: "text-[9px] text-slate-500 italic leading-snug"
  }, PileFoundationXfer.sourceLine(I)))), /*#__PURE__*/(I.pileType === "iab") && /*#__PURE__*/React.createElement(Panel, {
```
- **Check case:**
  - Abutment default → group workspace: "Strength I — V max" P = 3153.435 kip, My = 3495.453 kip-ft at the centroid (1.75, 1.75) ft, z = 0; `computeCapDist` gives ΣP = 3153.435 and M_y,eff = 3495.453 (no V·z, no P·e).
  - Abutment pile branch (24 piles) → same coordinates, pile +x = hand-off −x (the calculator's pile x is + toward the heel): largest pile axial for "Strength I — My max, pile P max" = **211.213 kip** = the calculator's pile table.
  - SubLoads Pier 1 bottom of footing, pile +x = hand-off +y, pile +y = hand-off −x: Vx = Vy, Vy = −Vx, My = Mx, Mx = −My (asserted for the first case).
- **How verified:** `node --check` on every plain inline script of the four changed files (abutment 13, SubLoads 3, Pile Designer 4, Spread Footing 18 blocks; none is JSX — Pile Designer is pre-compiled `React.createElement`). End-to-end in jsdom with one shared localStorage stub (React UMD served locally): **79 of 79 assertions pass** — abutment default → Pile Designer; abutment pile branch → Pile Designer with the same pile layout; SubLoads Pier 2 top of footing → Spread Footing; SubLoads Pier 1 bottom of footing → Pile Designer (rotated axes); JSON export → import into both receivers; refusals (wrong `_schema`, `schemaVersion` 2 and 3, kN units, non-finite P, missing `factored`, corrupt JSON file, corrupt stored payload, nothing sent, service-only payload into the footing, integral-abutment mode). No-hand-off invariance against the pre-change files: abutment `computeAll()` (dashboard, every permutation table, Input ID); SubLoads `combine()` envelopes and `concurrentSets()` of every unit and `abutExportData()`; Spread Footing `computeAll()` + `computePhase2()` (by-type and Direct mode); Pile Designer `computeAll(DEFAULT_INPUTS)` and the rendered app text (identical apart from the two new buttons). The earlier e2e suites still pass on this branch: memberReactions (Steel Beam → BasePlate / Spread Footing, 56/56) and abutmentLoads (SubLoads → abutment, 57/57).
- **Other copies:** `check()`, `mapAxes()` and `candidates()` are duplicated in Spread Footing.html (CLAUDE.md §3). BridgeXfer v1 unchanged.
- **Open items:** the reference point defaults to the pile-group centroid (assumes the footing centre coincides with it); single-pile mode enters |M| with the sense of the lateral load.

## 2026-10-10 — PR: claude/pile-restyle (PR link added after merge)

### F12. Screen restyle to match the recent tools ("GirderDetail look"); title block moved to the header   [UI only] [no calculation change]
- **Date:** 2026-10-10. **Type:** UI only (presentation). The engineer asked for a review and a formatting cleanup "to make it look more like the more recent apps". The review is summarised in the PR; new open items O16–O21 are below.
- **What changed (screen only; the printed report is unchanged):**
  - **Header:** the tall "blueprint grid" hero is replaced by a compact navy band. It holds the title ("Drilled Micropile — LRFD" etc.), the existing description as a subtitle, a basis line ("← All tools · AASHTO LRFD BDS 10th Ed. · FHWA … · by Mario Lococo"), a "Methodology & code path" button, the same key stats, the Overall pill, and a **title block** (Project, Subject, Job no., Prepared by, Checked by) with **Use / Share project info**.
  - **Project Info panel** (rail, Project tab): the five text fields and the Use/Share buttons moved to the header. They are bound to the same keys (`projName`, `projSubject`, `projNum`, `projBy`, `projChk`) through the same `setStr` and the same `ProjMetaUI` calls. The panel keeps the foundation-load hand-off buttons (`#pfxPull`, `#pfxImp`, `#pfxFile`, `#pfxSrc`) and its title "Project Info", which `railTabFor` matches.
  - **Summary strip** (`CheckIndex`): tinted green/red by the overall result (CSS `:has()`), with chip and button styles as in the recent tools. Below 820 px it is no longer sticky.
  - **Input tabs:** navy active tab, red dot (it still marks a "⚠" in the tab).
  - **Rail panels:** numbered "1. …" per tab (CSS counter, so `.panel-title` text is unchanged), with a gradient title bar. **Every panel can now collapse** (`Panel` default `collapsible = true`) and opens by default as before.
  - **Modules:** light cards with a gradient title row, a red border when NG, and light OK/NG badges (`StatusPill` gets `pd-pill is-ok|is-ng`). Derivation lines (`DerivLine`) show the equation on a light strip with a blue left rule. Result rows (`CheckRow`) have a coloured left rule.
  - **Labels and controls:** tracked all-caps micro labels are shown in their source sentence case (CSS). Four rail button labels are changed to sentence case in the source. Number inputs are right-aligned. Input borders and table header rows use the recent tools' colours.
  - **Colour tokens:** `--blueprint` #1E3A5F, `--accent` #1E3A5F, `--ok` #059669, `--no` #DC2626, `--warn` #B45309, `--paper` #F8FAFC. Plot colours (JS constant `C`) are unchanged.
- **Not changed:** every input id/key, handler, storage key (`micropile_lrfd_inputs_v1`, `micropile_lrfd_lpile_v1`, IndexedDB `micropile_lrfd_db`), the saved/exported JSON, the hand-offs (`bridgeSuite.v1.projectMeta`, `foundationLoads`), `computeAll` and every module's content, and the `PrintReport` component. Library tags and versions are unchanged.
- **Governing provision:** none (presentation only). No formula, factor, unit, default or code reference changed.
- **Check case:** not applicable. Parity: see How verified.
- **How verified:**
  - `node --check` on all four inline scripts (the app is pre-compiled `React.createElement`, so there is no JSX to transpile).
  - Headless Chromium with the pinned libraries served locally (React 18.3.1 UMD, three 0.128.0, KaTeX 0.16.9, Plotly 2.32.0; Tailwind 3.4.5 compiled from each file's classes in place of the Play CDN), origin/main vs branch:
    - every module expanded in micropile, H-pile and integral-abutment mode: `.main-col` text and the print report text are identical (2300 / 1105 / 458 numbers, all equal);
    - module statuses are identical;
    - an edited project (five title-block fields typed through each version's own UI, bond length 31 ft) gives identical autosave JSON, `Save .json` export, IndexedDB library record and `bridgeSuite.v1.projectMeta` share payload;
    - "Use shared project info" from the header fills the fields, and "Pull from Abutment / SubLoads" still opens its flow;
    - print PDFs have the same page counts (13 / 8 / 5) and identical text;
    - no console errors, and no horizontal scroll at 400 px in any mode.
  - Before/after screenshots of every input tab and the output column at 1500 and 400 px were reviewed.
- **Other copies:** none. The CSS and `HdrField` are specific to this tool. BridgeXfer / ProjMetaUI are unchanged.
- **Re-applying by hand:** the exact before/after is the unified diff below (CRLF stripped; the file itself uses CRLF). Hunks in order:
  1. CSS block appended at the end of the head `<style>`, after the `prefers-reduced-motion` rule. Anchor: `@media (prefers-reduced-motion: reduce) {`.
  2. `StatusPill` className. Anchor: `"font-mono-tech text-[11px] font-bold px-2 py-0.5 rounded-sm tracking-wider "`.
  3. New `HdrField` before `function Toggle({`.
  4. `CheckRow` classNames. Anchors: `"flex items-center justify-between gap-4 py-2.5 px-3 rounded-sm fade-in"` and `"min-w-0 overflow-x-auto seg text-[15px]"`.
  5. `DerivLine` classNames.
  6. `App` header. Anchor: `React.createElement("header", {` + `className: "blueprint-grid text-white"`, up to `React.createElement(CheckIndex, {`.
  7. `App` Project Info panel. Anchor: `title: "Project Info",`.
  8. Rail button labels. Anchors: `"↧ PRINT / SAVE PDF REPORT"`, `"↓ DOWNLOAD USER MANUAL (theory + methodology)"`, `"↓ SAVE SCENARIO"`, `"↑ LOAD SCENARIO"`.
  9. `Panel` default `collapsible = true` and the caret class.

```diff
diff --git a/Pile Designer.html b/Pile Designer.html
index 445a319..7c4fca1 100644
--- a/Pile Designer.html	
+++ b/Pile Designer.html	
@@ -212,4 +212,131 @@
     html { scroll-behavior: auto; }
   }
+  /* ==========================================================
+     GIRDERDETAIL LOOK (2026-10-10, presentation only)
+     ----------------------------------------------------------
+     Brings the screen look in line with the recent tools (Section Property
+     Calculator, Timber Beam Check, Gusset Plate Rating, Steel Beam Design):
+     navy header band with the title block, a tinted summary strip, navy tab
+     strips, light section cards with a gradient title bar and "1." numbers,
+     calc lines with a blue left rule, light OK / NG badges, blue-grey table
+     headers. Overrides only; no calculation, input key or report value is
+     touched. The printed report keeps its own inline styles.
+  ========================================================== */
+  :root {
+    --navy-900: #16304F; --navy-800: #1E3A5F; --blue-600: #2563EB;
+    --pd-line: #E4E7EB;
+    --blueprint: #1E3A5F;
+    --blueprint2: #16304F;
+    --accent: #1E3A5F;
+    --ok: #059669;
+    --no: #DC2626;
+    --warn: #B45309;
+    --paper: #F8FAFC;
+    --f-ui: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
+  }
+  /* header band + title block */
+  .pd-hdr { background: var(--navy-800); color: #fff; border-bottom: 3px solid var(--navy-900); font-family: var(--f-ui); }
+  .pd-hdr-in { padding: 8px 24px 8px; }
+  .pd-titleRow { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px 16px; flex-wrap: wrap; }
+  .pd-titleCol { min-width: 0; flex: 1 1 460px; }
+  .pd-h1 { font-family: var(--f-ui); font-size: 19px; font-weight: 600; margin: 0; letter-spacing: .3px; color: #fff; line-height: 1.25; }
+  .app-shell .pd-byline { font-size: 12.5px; color: #C7D4E4; margin-top: 2px; line-height: 1.35; max-width: 980px; }
+  .pd-basis { font-size: 12px; color: #B9C8DB; margin-top: 3px; display: flex; gap: 2px 7px; flex-wrap: wrap; align-items: baseline; }
+  .pd-alltools { color: #C7D4E4; text-decoration: none; margin-right: 8px; }
+  .pd-alltools:hover { color: #fff; text-decoration: underline; }
+  .pd-sep { opacity: .6; }
+  .pd-hdrRight { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
+  .pd-hdrBtns { display: flex; gap: 6px; flex-wrap: wrap; }
+  .pd-hdrBtns button { font-family: var(--f-ui); font-size: 12px; padding: 4px 11px; border: 1px solid #ffffff55; border-radius: 4px; background: #ffffff1c; color: #fff; }
+  .pd-hdrBtns button:hover { background: #ffffff33; }
+  .pd-stats { display: flex; flex-wrap: wrap; gap: 3px 14px; align-items: center; justify-content: flex-end; font-size: 12px; }
+  .app-shell .pd-stats .text-\[\#9fc0d8\] { color: #B9C8DB; font-size: 12px; }
+  .pd-overall { display: flex; align-items: center; gap: 6px; }
+  .pd-overall-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #B9C8DB; }
+  .pd-projGrid { display: grid; grid-template-columns: minmax(120px, 1.3fr) minmax(160px, 2fr) repeat(3, minmax(96px, 1fr)); gap: 4px 8px; margin-top: 7px; }
+  .pd-fld { display: block; min-width: 0; }
+  .pd-fld > span { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; color: #B9C8DB; margin-bottom: 1px; }
+  .app-shell .pd-fld input[type=text] { width: 100%; font-family: var(--f-ui); font-size: 12.5px; padding: 3px 6px; border: 1px solid #ffffff33; border-radius: 3px; background: #ffffff14; color: #fff; text-align: left; }
+  .app-shell .pd-fld input[type=text]::placeholder { color: #8FA3BC; }
+  .app-shell .pd-fld input[type=text]:focus { outline: 2px solid #BFD3F2; outline-offset: 0; background: #ffffff24; }
+  .pd-projShare { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
+  .pd-projShare button { font-family: var(--f-ui); font-size: 11.5px; padding: 2px 8px; border: 1px solid #ffffff44; border-radius: 3px; background: #ffffff14; color: #fff; }
+  .pd-projShare button:hover { background: #ffffff2a; }
+
+  /* OK / NG badges (light, as the recent tools) */
+  .app-shell .pd-pill { background: #E8F7F0 !important; color: #065F46 !important; border: 1px solid #7FD1B0; border-radius: 4px; letter-spacing: .4px; font-family: var(--f-ui); }
+  .app-shell .pd-pill.is-ng { background: #FDECEC !important; color: #B91C1C !important; border-color: #F1A8A8; }
+
+  /* summary strip (the sticky check index) */
+  .check-index { background: #F1F3F5; border-bottom: 1px solid #D5DBE2; box-shadow: none; font-family: var(--f-ui);
+    -webkit-backdrop-filter: none; backdrop-filter: none; }
+  .check-index:has(.ci-status.is-ok) { background: #EAF6EE; border-bottom-color: #9ED3B0; }
+  .check-index:has(.ci-status.is-ng) { background: #FBEAEA; border-bottom-color: #E2A2A2; }
+  .check-index-inner { min-height: 44px; gap: 6px 12px; padding-top: 6px; padding-bottom: 6px; }
+  .ci-pile { font-family: var(--f-ui); font-size: 14px; font-weight: 600; color: var(--navy-900); }
+  .ci-status { font-weight: 700; letter-spacing: .3px; background: rgba(0,0,0,.06); border-radius: 4px; }
+  .ci-status.is-ok { color: var(--ok); background: rgba(0,0,0,.05); }
+  .ci-status.is-ng { color: var(--no); background: rgba(0,0,0,.05); }
+  .ci-case { color: #5A6B80; }
+  .ci-chip { border: 1.5px solid #CBD5E1; border-radius: 5px; font-family: var(--f-ui); padding: 2px 7px; }
+  .ci-chip.st-ok { border-color: #9CD6BC; }
+  .ci-chip.st-ng { border-color: #F1A8A8; background: #FDF3F3; }
+  .ci-chip.st-na { color: #64748B; }
+  .ci-chip[aria-current="true"] { background: var(--navy-800); border-color: var(--navy-800); color: #fff; }
+  .ci-btn { font-family: var(--f-ui); font-size: 12px; padding: 4px 10px; border-radius: 4px; border-color: var(--navy-800); color: var(--navy-800); }
+  .ci-btn:hover { background: #EFF4FA; }
+  .ci-btn-primary { background: var(--navy-800); color: #fff; }
+  .ci-btn-primary:hover { background: var(--navy-900); }
+  .ci-btn-quiet { border-color: #C6CFDA; color: #41546E; }
+
+  /* input rail: tab strip + numbered section cards */
+  .rail-tabs { background: var(--paper); border-bottom: 2px solid var(--navy-800); padding: 6px 0 0; gap: 2px; flex-wrap: wrap; overflow: visible; margin-bottom: 8px; }
+  .rail-tab { font-family: var(--f-ui); font-size: 12px; padding: 5px 11px; border: 1px solid var(--pd-line); border-bottom: none; background: #F1F3F5; color: #41546E; border-radius: 5px 5px 0 0; }
+  .rail-tab:hover { background: #EFF4FA; color: #41546E; }
+  .rail-tab.is-active { background: var(--navy-800); color: #fff; border-color: var(--navy-800); font-weight: 600; }
+  .rail-tab-dot { background: var(--no); box-shadow: 0 0 0 1.5px #fff; }
+  aside.input-rail { counter-reset: pdsec; }
+  .app-shell .panel { border: 1px solid var(--pd-line); border-radius: 6px; box-shadow: none; }
+  .app-shell .panel > .panel-head { background: linear-gradient(#F6F8FA, #EDF1F5) !important; border-bottom: 1px solid var(--pd-line); padding: 6px 10px; }
+  .app-shell .panel .panel-title { font-family: var(--f-ui); font-size: 13px; font-weight: 600; color: var(--navy-800); }
+  aside.input-rail .panel-title::before { counter-increment: pdsec; content: counter(pdsec) ". "; }
+  .app-shell .panel .panel-sub { font-family: var(--f-ui); font-size: 11px; color: #6B7A8F; }
+  .app-shell .panel .panel-caret { color: var(--navy-800); }
+
+  /* output modules: calc-sheet cards */
+  .app-shell .module-card { border: 1px solid var(--pd-line); border-radius: 6px; box-shadow: none; }
+  .app-shell .module-card[data-status="ng"] { border-color: #E9A9A4; }
+  .app-shell .module-toggle { background-image: linear-gradient(#F6F8FA, #EDF1F5); border-bottom: 1px solid var(--pd-line); padding-top: 8px; padding-bottom: 8px; }
+  .app-shell .module-title { font-family: var(--f-ui); font-size: 14.5px; font-weight: 600; color: var(--navy-800); }
+  .app-shell .module-badge { font-family: var(--f-ui); font-weight: 600; border-radius: 4px; }
+  .app-shell .deriv-line { border-bottom: none !important; padding: 3px 0; }
+  .app-shell .deriv-lbl { text-transform: none; letter-spacing: 0; font-family: var(--f-ui); font-size: 11.5px; font-weight: 600; color: #6B7A8F; }
+  .app-shell .deriv-eq { background: #F7F8FA; border-left: 3px solid var(--blue-600); padding: 3px 12px; }
+  .app-shell .check-row { border: 1px solid var(--pd-line); border-left-width: 3px; border-radius: 6px; }
+  .app-shell .check-row.is-ok { background: #F6FBF8 !important; border-left-color: var(--ok) !important; }
+  .app-shell .check-row.is-ng { background: #FDF7F6 !important; border-color: #E9A9A4; border-left-color: var(--no) !important; }
+  .app-shell .check-row.is-adv { background: #FEF6E7 !important; border-color: #F0C36D; border-left-color: var(--warn) !important; }
+  /* tracked all-caps micro labels -> sentence-case section labels (source text is already sentence case) */
+  .app-shell .uppercase.tracking-wider, .app-shell .uppercase.tracking-wide, .app-shell .uppercase[class*="tracking-[0."] { text-transform: none; letter-spacing: 0; font-family: var(--f-ui); font-weight: 600; }
+  .app-shell .tracking-wider, .app-shell .tracking-wide { letter-spacing: .02em; }
+  .app-shell button.rounded-sm, .app-shell label.rounded-sm { border-radius: 4px; }
+  /* tables: header row as the recent tools */
+  .app-shell .main-col table th, .app-shell aside.input-rail table th { background: #DCE6F1; color: var(--navy-900); font-family: var(--f-ui); font-weight: 700; border: 1px solid #B9C8DB; padding: 3px 6px; }
+  .app-shell .main-col table td { border-color: var(--pd-line); }
+  /* form controls */
+  .app-shell input[type=number]:not(:focus), .app-shell input[type=text]:not(:focus), .app-shell select:not(:focus) { border-color: #C6CFDA; }
+  .app-shell input[type=number] { text-align: right; }
+  .app-shell input[type=number], .app-shell input[type=text], .app-shell select { border-radius: 3px; }
+  .app-shell input:focus, .app-shell select:focus { border-color: var(--blue-600); }
+
+  /* narrow screens */
+  @media (max-width: 820px) {
+    .pd-hdr-in { padding: 8px 12px; }
+    .pd-hdrRight { align-items: flex-start; }
+    .pd-stats { justify-content: flex-start; }
+    .pd-projGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
+    .pd-fld-wide { grid-column: 1 / -1; }
+    .check-index { position: static; }
+  }
 </style>
 </head>
@@ -3811,5 +3938,5 @@ function StatusPill({
 }) {
   return /*#__PURE__*/React.createElement("span", {
-    className: "font-mono-tech text-[11px] font-bold px-2 py-0.5 rounded-sm tracking-wider " + (pass ? "text-white" : "text-white"),
+    className: "pd-pill " + (pass ? "is-ok " : "is-ng ") + "font-mono-tech text-[11px] font-bold px-2 py-0.5 rounded-sm tracking-wider " + (pass ? "text-white" : "text-white"),
     style: {
       background: pass ? "var(--ok)" : "var(--no)"
@@ -3861,4 +3988,21 @@ function TextField({
   }));
 }
+/* UI: one title-block field in the header band (GirderDetail look). Same
+   onChange contract as TextField; the value is the same input key. */
+function HdrField({
+  label,
+  value,
+  onChange,
+  wide
+}) {
+  return /*#__PURE__*/React.createElement("label", {
+    className: "pd-fld" + (wide ? " pd-fld-wide" : "")
+  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("input", {
+    type: "text",
+    value: value,
+    placeholder: label,
+    onChange: e => onChange(e.target.value)
+  }));
+}
 function Toggle({
   label,
@@ -4024,5 +4168,5 @@ function CheckRow({
   const adv = advisory && !pass;
   return /*#__PURE__*/React.createElement("div", {
-    className: "flex items-center justify-between gap-4 py-2.5 px-3 rounded-sm fade-in",
+    className: "check-row " + (adv ? "is-adv " : pass ? "is-ok " : "is-ng ") + "flex items-center justify-between gap-4 py-2.5 px-3 rounded-sm fade-in",
     style: {
       background: adv ? "rgba(183,121,31,0.09)" : pass ? "rgba(47,125,79,0.07)" : "rgba(178,59,59,0.07)",
@@ -4030,5 +4174,5 @@ function CheckRow({
     }
   }, /*#__PURE__*/React.createElement("div", {
-    className: "min-w-0 overflow-x-auto seg text-[15px]"
+    className: "check-row-eq min-w-0 overflow-x-auto seg text-[15px]"
   }, /*#__PURE__*/React.createElement(Tex, {
     tex: tex
@@ -4130,9 +4274,9 @@ function DerivLine({
 }) {
   return /*#__PURE__*/React.createElement("div", {
-    className: "py-1.5 border-b border-dashed border-slate-100 last:border-0"
+    className: "deriv-line py-1.5 border-b border-dashed border-slate-100 last:border-0"
   }, /*#__PURE__*/React.createElement("div", {
-    className: "text-[10px] uppercase tracking-wider text-slate-400 mb-0.5 leading-snug"
+    className: "deriv-lbl text-[10px] uppercase tracking-wider text-slate-400 mb-0.5 leading-snug"
   }, label), /*#__PURE__*/React.createElement("div", {
-    className: "overflow-x-auto seg"
+    className: "deriv-eq overflow-x-auto seg"
   }, /*#__PURE__*/React.createElement(Tex, {
     tex: tex
@@ -12138,33 +12282,36 @@ function App() {
     } : undefined
   }, /*#__PURE__*/React.createElement("header", {
-    className: "blueprint-grid text-white"
+    className: "pd-hdr"
+  }, /*#__PURE__*/React.createElement("div", {
+    className: "pd-hdr-in max-w-[1920px] mx-auto"
   }, /*#__PURE__*/React.createElement("div", {
-    className: "max-w-[1920px] mx-auto px-6 pt-8 pb-7"
+    className: "pd-titleRow"
   }, /*#__PURE__*/React.createElement("div", {
-    className: "flex items-center gap-2 text-[11px] font-mono-tech tracking-[0.2em] text-[#9fc0d8] uppercase mb-3"
+    className: "pd-titleCol"
+  }, /*#__PURE__*/React.createElement("h1", {
+    className: "pd-h1"
+  }, I.pileType === "iab" ? "Integral Abutment Pile" : I.pileType === "hpile" ? "Driven Steel H-Pile" : "Drilled Micropile", " \u2014 LRFD"), /*#__PURE__*/React.createElement("div", {
+    className: "pd-byline"
+  }, I.pileType === "iab" ? "MassDOT Simplified Method check for integral abutment H-piles \u2014 eligibility, tabulated gravity capacity with skew, section and geometry limits, with optional p-y verification. Every equation is shown for an engineer to verify and seal." : I.pileType === "hpile" ? "A full design check for driven steel H-piles \u2014 static geotechnical capacity, structural axial and buckling, flexure, combined loading, shear, head fixity, lateral p-y, and group effects. Every equation is shown for an engineer to verify and seal." : "A full design check for cased drilled micropiles — geotechnical bond, structural axial, casing flexure, combined loading, head bearing, punching shear, and load-test bars. Every equation is shown for an engineer to verify and seal."), /*#__PURE__*/React.createElement("div", {
+    className: "pd-basis"
   }, /*#__PURE__*/React.createElement("a", {
     href: "tools.html",
     target: "_top",
     title: "Open the list of all tools",
-    className: "no-print hover:text-white"
-  }, "\u2190 All tools"), /*#__PURE__*/React.createElement("span", {
-    className: "opacity-40 no-print"
-  }, "/"), /*#__PURE__*/React.createElement("span", null, "AASHTO LRFD BDS 10th Ed."), /*#__PURE__*/React.createElement("span", {
-    className: "opacity-40"
-  }, "/"), /*#__PURE__*/React.createElement("span", null, I.pileType === "iab" ? "MassDOT Bridge Manual Part I \u00a73.10" : I.pileType === "hpile" ? "FHWA-NHI-16-009 driven piles" : "FHWA NHI-05-039")), /*#__PURE__*/React.createElement("h1", {
-    className: "font-disp text-3xl md:text-[40px] font-bold leading-[1.05] tracking-tight"
-  }, I.pileType === "iab" ? "Integral Abutment Pile" : I.pileType === "hpile" ? "Driven Steel H-Pile" : "Drilled Micropile", /*#__PURE__*/React.createElement("span", {
-    className: "text-[var(--accent)]"
-  }, " / LRFD")), /*#__PURE__*/React.createElement("div", {
-    className: "hero-byline"
-  }, "by Mario Lococo"), /*#__PURE__*/React.createElement("p", {
-    className: "text-[#bcd2e2] text-[13px] mt-3 max-w-2xl leading-relaxed"
-  }, I.pileType === "iab" ? "MassDOT Simplified Method check for integral abutment H-piles \u2014 eligibility, tabulated gravity capacity with skew, section and geometry limits, with optional p-y verification. Every equation is shown for an engineer to verify and seal." : I.pileType === "hpile" ? "A full design check for driven steel H-piles \u2014 static geotechnical capacity, structural axial and buckling, flexure, combined loading, shear, head fixity, lateral p-y, and group effects. Every equation is shown for an engineer to verify and seal." : "A full design check for cased drilled micropiles — geotechnical bond, structural axial, casing flexure, combined loading, head bearing, punching shear, and load-test bars. Every equation is shown for an engineer to verify and seal."), /*#__PURE__*/React.createElement("button", {
+    className: "pd-alltools no-print"
+  }, "\u2190 All tools"), /*#__PURE__*/React.createElement("span", null, "AASHTO LRFD BDS 10th Ed."), /*#__PURE__*/React.createElement("span", {
+    className: "pd-sep"
+  }, "\u00b7"), /*#__PURE__*/React.createElement("span", null, I.pileType === "iab" ? "MassDOT Bridge Manual Part I \u00a73.10" : I.pileType === "hpile" ? "FHWA-NHI-16-009 driven piles" : "FHWA NHI-05-039"), /*#__PURE__*/React.createElement("span", {
+    className: "pd-sep"
+  }, "\u00b7"), /*#__PURE__*/React.createElement("span", null, "by Mario Lococo"))), /*#__PURE__*/React.createElement("div", {
+    className: "pd-hdrRight"
+  }, /*#__PURE__*/React.createElement("div", {
+    className: "pd-hdrBtns no-print"
+  }, /*#__PURE__*/React.createElement("button", {
+    type: "button",
     onClick: () => setDocsOpen(true),
-    className: "mt-4 inline-flex items-center gap-2 font-mono-tech text-[12px] px-3.5 py-2 rounded-sm bg-white/10 hover:bg-white/20 border border-white/20 transition"
-  }, /*#__PURE__*/React.createElement("span", {
-    className: "text-[var(--accent)]"
-  }, "❓"), " Methodology & code path"), /*#__PURE__*/React.createElement("div", {
-    className: "flex flex-wrap gap-x-6 gap-y-1 mt-5 font-mono-tech text-[12px]"
+    title: "How this tool checks the pile: methodology and code path"
+  }, "Methodology & code path")), /*#__PURE__*/React.createElement("div", {
+    className: "pd-stats"
   }, ...(I.pileType === "iab" ? [
     /*#__PURE__*/React.createElement(Stat, { key: "s1", label: "Section", v: I.iabSection === "HP12X84" ? "HP12\u00d784" : "HP10\u00d757" }),
@@ -12182,11 +12329,50 @@ function App() {
     /*#__PURE__*/React.createElement(Stat, { key: "s4", label: "Lb", v: `${fmt(I.LbProvided, 0)} ft` })
   ]), /*#__PURE__*/React.createElement("div", {
-    className: "ml-auto flex items-center gap-2"
+    className: "pd-overall"
   }, /*#__PURE__*/React.createElement("span", {
-    className: "text-[#9fc0d8] uppercase text-[10px] tracking-wider"
+    className: "pd-overall-lbl"
   }, "Overall"), /*#__PURE__*/React.createElement(StatusPill, {
     pass: r.allPass,
     label: r.allPass ? "ALL CHECKS OK" : "CHECK REQUIRED"
-  }))))), /*#__PURE__*/React.createElement(CheckIndex, {
+  }))))), /*#__PURE__*/React.createElement("div", {
+    className: "pd-projGrid"
+  }, /*#__PURE__*/React.createElement(HdrField, {
+    label: "Project",
+    value: I.projName,
+    onChange: v => setStr('projName', v)
+  }), /*#__PURE__*/React.createElement(HdrField, {
+    label: "Subject",
+    value: I.projSubject,
+    onChange: v => setStr('projSubject', v),
+    wide: true
+  }), /*#__PURE__*/React.createElement(HdrField, {
+    label: "Job no.",
+    value: I.projNum,
+    onChange: v => setStr('projNum', v)
+  }), /*#__PURE__*/React.createElement(HdrField, {
+    label: "Prepared by",
+    value: I.projBy,
+    onChange: v => setStr('projBy', v)
+  }), /*#__PURE__*/React.createElement(HdrField, {
+    label: "Checked by",
+    value: I.projChk,
+    onChange: v => setStr('projChk', v)
+  })), /*#__PURE__*/React.createElement("div", {
+    className: "pd-projShare no-print"
+  }, /*#__PURE__*/React.createElement("button", {
+    type: "button",
+    onClick: () => {
+      const patch = ProjMetaUI.use(PILE_PROJ_MAP, I, "pileDesigner");
+      if (patch) setI(s => ({
+        ...s,
+        ...patch
+      }));
+    },
+    title: "Fill the project info from project info shared by another tool"
+  }, "Use shared project info"), /*#__PURE__*/React.createElement("button", {
+    type: "button",
+    onClick: () => ProjMetaUI.share(PILE_PROJ_MAP, pileProjShareValues(I), "Pile Designer", "Pile Designer.html"),
+    title: "Make this project info available to the other tools"
+  }, "Share project info")))), /*#__PURE__*/React.createElement(CheckIndex, {
     pileLabel: I.pileType === "iab" ? "Integral abutment pile" : I.pileType === "hpile" ? "Driven H-pile" : "Drilled micropile",
     allPass: r.allPass,
@@ -12297,51 +12483,9 @@ function App() {
   }, "Save many named projects in this browser. Recall, overwrite, or delete any. For cross-device or archival storage, use the .json export above."))), /*#__PURE__*/React.createElement(Panel, {
     title: "Project Info",
-    sub: "Appears on printed report"
+    sub: "Project, job no., subject, by / chk: in the header title block \u00b7 foundation-load hand-off"
   }, /*#__PURE__*/React.createElement("div", {
     className: "grid grid-cols-1 gap-2"
-  }, /*#__PURE__*/React.createElement(TextField, {
-    label: "Project name",
-    value: I.projName,
-    onChange: v => setStr('projName', v)
-  }), /*#__PURE__*/React.createElement("div", {
-    className: "grid grid-cols-2 gap-2"
-  }, /*#__PURE__*/React.createElement(TextField, {
-    label: "Job no.",
-    value: I.projNum,
-    onChange: v => setStr('projNum', v)
-  }), /*#__PURE__*/React.createElement("div", {
-    className: "grid grid-cols-2 gap-2"
-  }, /*#__PURE__*/React.createElement(TextField, {
-    label: "By",
-    value: I.projBy,
-    onChange: v => setStr('projBy', v)
-  }), /*#__PURE__*/React.createElement(TextField, {
-    label: "Chk",
-    value: I.projChk,
-    onChange: v => setStr('projChk', v)
-  }))), /*#__PURE__*/React.createElement(TextField, {
-    label: "Subject",
-    value: I.projSubject,
-    onChange: v => setStr('projSubject', v)
-  }), /*#__PURE__*/React.createElement("div", {
-    className: "flex gap-2 no-print"
-  }, /*#__PURE__*/React.createElement("button", {
-    type: "button",
-    onClick: () => {
-      const patch = ProjMetaUI.use(PILE_PROJ_MAP, I, "pileDesigner");
-      if (patch) setI(s => ({
-        ...s,
-        ...patch
-      }));
-    },
-    title: "Fill the project info from project info shared by another tool",
-    className: "font-mono-tech text-[9px] px-1.5 py-1 rounded-sm border border-slate-300 text-slate-500 hover:bg-white"
-  }, "Use shared project info"), /*#__PURE__*/React.createElement("button", {
-    type: "button",
-    onClick: () => ProjMetaUI.share(PILE_PROJ_MAP, pileProjShareValues(I), "Pile Designer", "Pile Designer.html"),
-    title: "Make this project info available to the other tools",
-    className: "font-mono-tech text-[9px] px-1.5 py-1 rounded-sm border border-slate-300 text-slate-500 hover:bg-white"
-  }, "Share project info")), /*#__PURE__*/React.createElement("div", {
-    className: "flex gap-2 no-print"
+  }, /*#__PURE__*/React.createElement("div", {
+    className: "flex flex-wrap gap-2 no-print"
   }, /*#__PURE__*/React.createElement("button", {
     type: "button",
@@ -12938,10 +13082,10 @@ function App() {
       background: "var(--blueprint)"
     }
-  }, "↧ PRINT / SAVE PDF REPORT"), /*#__PURE__*/React.createElement("button", {
+  }, "↧ Print / save PDF report"), /*#__PURE__*/React.createElement("button", {
     onClick: downloadManual,
     className: "w-full font-mono-tech text-[11px] tracking-wider py-2 rounded-sm border border-[var(--blueprint2)] text-[var(--blueprint2)] hover:bg-slate-50 transition"
-  }, "↓ DOWNLOAD USER MANUAL (theory + methodology)"), /*#__PURE__*/React.createElement("div", { className: "flex gap-2" },
-    /*#__PURE__*/React.createElement("button", { onClick: saveScenario, className: "flex-1 font-mono-tech text-[10px] tracking-wider py-2 rounded-sm border border-slate-300 text-slate-600 hover:bg-slate-50 transition" }, "↓ SAVE SCENARIO"),
-    /*#__PURE__*/React.createElement("button", { onClick: () => fileInputRef.current && fileInputRef.current.click(), className: "flex-1 font-mono-tech text-[10px] tracking-wider py-2 rounded-sm border border-slate-300 text-slate-600 hover:bg-slate-50 transition" }, "↑ LOAD SCENARIO"),
+  }, "↓ Download user manual (theory + methodology)"), /*#__PURE__*/React.createElement("div", { className: "flex gap-2" },
+    /*#__PURE__*/React.createElement("button", { onClick: saveScenario, className: "flex-1 font-mono-tech text-[10px] tracking-wider py-2 rounded-sm border border-slate-300 text-slate-600 hover:bg-slate-50 transition" }, "↓ Save scenario"),
+    /*#__PURE__*/React.createElement("button", { onClick: () => fileInputRef.current && fileInputRef.current.click(), className: "flex-1 font-mono-tech text-[10px] tracking-wider py-2 rounded-sm border border-slate-300 text-slate-600 hover:bg-slate-50 transition" }, "↑ Load scenario"),
     /*#__PURE__*/React.createElement("input", { ref: fileInputRef, type: "file", accept: ".json,application/json", onChange: loadScenarioFile, style: { display: "none" } })))), /*#__PURE__*/React.createElement("main", {
     className: "main-col space-y-4"
@@ -14922,5 +15066,5 @@ function Panel({
   sub,
   children,
-  collapsible = false,
+  collapsible = true,
   defaultOpen = true
 }) {
@@ -14941,5 +15085,5 @@ function Panel({
         style: { background: "rgba(20,48,74,0.03)", borderBottom: open ? "1px solid #f1f5f9" : "none" }
       }, /*#__PURE__*/React.createElement("div", { className: "flex-1 min-w-0" }, headInner),
-        /*#__PURE__*/React.createElement("span", { className: "text-slate-400 text-[12px]", "aria-hidden": true }, open ? "\u25b4" : "\u25be"))
+        /*#__PURE__*/React.createElement("span", { className: "panel-caret text-slate-400 text-[12px]", "aria-hidden": true }, open ? "\u25b4" : "\u25be"))
     : /*#__PURE__*/React.createElement("div", {
         className: "panel-head px-3 py-2 border-b border-slate-100",
```

## 2026-10-10 — PR: claude/pile-output-print (PR link added after merge)

### F13. Output tabs; printed report in the recent tools' look with a print-section chooser   [UI only] [no calculation change]
- **Date:** 2026-10-10. **Type:** UI only (presentation). Engineer's approval 2026-10-10: "Continue with output and print style" (review proposals U7 / U8 / item 14 of F12).
- **What changed (screen):**
  - **Output tabs.** A tab strip (`OutTabs`) sits under the pile-type card, at the top of the output column. It is sticky under the summary strip (top `var(--ci-h)`; top 0 below 820 px), wraps at narrow widths, and is an ARIA tablist (roving tabindex; Arrow Left/Right, Home, End). Every module stays rendered; `OutTabs` tags each output block with `data-otab` and CSS hides the blocks of the other tabs, as the input rail already does (`data-rtab`). Tabs with nothing in them are not shown. A red dot marks a tab that holds a module with status NG.
  - Tab per module (`outTabFor`):

    | Tab | Micropile | H-pile | Integral abutment |
    |---|---|---|---|
    | Summary | LRFD load cases, summary of checks | LRFD load cases, summary of checks | summary of checks |
    | Geometry & limits | G | G | G |
    | Geotechnical | 01, 09 | 01 | — |
    | Simplified Method | — | — | 01 |
    | Tier 2 | — | — | 12 (when run) |
    | Lateral (p-y) | 02 | 02 | — |
    | Structural | 03, 04, 05, 05b, 10 | 03, 04, 05, 07, 09, 10 | — |
    | Cap & connection | 06, 07 | 06 (fixed head) | — |
    | Load test | 08 | — | — |
    | Group | 11 | 11 | — |

    The pile-type card and the footer are on every tab.
  - **Jumps select the tab first.** `jumpToModule` (summary-strip chips, summary-of-checks rows) and `gotoModule` ("Apply avg fm … (Module 02)") call `showOutTabOf(section)` before opening and scrolling. `section[data-module]` scroll margin now includes the tab strip height (`--ot-h`).
  - **Expand all / Collapse all** act on the modules of the open tab; on a tab with no modules (Summary) they act on every module, as before (button titles say so).
  - The active tab is remembered per browser in the **new key `micropile_lrfd_outTab_v1`** (try/catch; not in project data). If the remembered tab does not exist for the pile type, Summary is shown and the remembered tab is kept.
- **What changed (printed report):**
  - **Print-section chooser** (`PrintChooser`): every print button (summary strip "Print report", rail "Print / save PDF report", preview bar "Print / Save PDF") opens a dialog with one tick box per report group present for the pile type (Input summary A; Scope, references & assumptions B–D; Geometry & limits G; Geotechnical 01, 09; Simplified Method 01a–01d; Tier 2 12; Lateral 02, 02R, 02F; Structural 03–05b, 10, 03–09; Cap & connection 06, 07; Load test 08; Group 11; Summary of results & conclusion S), with Print, Preview report and Cancel. The title block, PE seal box, sheet header and footer and the closing disclaimer always print. Default = everything = what printed before. Remembered per browser in the **new key `micropile_lrfd_printSel_v1`** (`{group: false}` for an unticked group). Preview uses the same selection. Hiding is CSS only (`:has()` on the section that holds a heading of an unticked group); the 02F figure block, the 11 group block and the S block got a `rpt-grp` wrapper class (S: a new wrapper `div` around heading … conclusion).
  - **Look:** title block in the recent tools' layout (package label, pile-type title, overall status badge, then Project / Job no. / Subject / member / Units / Prepared by / Checked by / Date / Design basis). Text in Times, labels in UI sans, navy #16304F, table header rows #DCE6F1. Module headings (`RptHeading`) carry a light **OK / NG badge** equal to the status of the same on-screen module (read from its `data-status`; "03–09" combines 03/04/05/07/09; G is not badged because its report section lists materials, not the limit checks). Calc lines (`Calc`) sit on a light strip with a blue left rule; check lines (`RptCheck`, `RptRow`) have light green/red boxes with OK/NG badges. Input-group titles are shown in their source sentence case (no CSS upper-casing).
  - **Page flow:** headings are kept with the next content (`break-after: avoid`); calc lines, check lines, table rows and list items are not split; sections shorter than 260 px stay on one page and longer ones flow (the old rule kept every section whole, which left pages nearly empty); the two forced page breaks (before 01 and before 02F) are removed. Before printing (and on `beforeprint`, and for the preview) `fitPrintReport` lays the report out off screen at 7.1 in: tables still too wide get a smaller font and equations past the right edge are scaled down (none needed at the defaults). Running header added (`@top-left` project — subject, `@top-right` "Pile Designer · prepared by · date"); the "Sheet x of y" footer is kept (font Georgia → Times).
  - Page counts at the defaults: micropile 13 → 9, H-pile 8 → 7, integral abutment 5 → 4.
- **Report content:** for the default selection every number, equation, note and code reference is unchanged. Text differences are only: (1) the title block (labels "Job No."/"Computed"/"Checked"/"Date" → "Job no."/"Prepared by"/"Checked by"/"Date", the job number no longer repeated in the top bar, new "Subject / member" and "Units: US customary (kip, ft, in, ksi)" labels), (2) the new OK/NG badges on module headings, (3) input-group titles no longer upper-cased by CSS.
- **Not changed:** `computeAll` and every check; every module's content; the input rail; storage keys `micropile_lrfd_inputs_v1`, `micropile_lrfd_lpile_v1`, IndexedDB `micropile_lrfd_db`; the saved / exported JSON; `bridgeSuite.v1.projectMeta` and `foundationLoads` hand-offs; library tags and versions.
- **New storage keys (per browser, UI only, never in project data):** `micropile_lrfd_outTab_v1` (string tab id), `micropile_lrfd_printSel_v1` (JSON object). Both tool-prefixed, read/written in try/catch.
- **Governing provision:** none (presentation only). No formula, factor, unit, default or code reference changed.
- **Check case:** not applicable. Parity: see How verified.
- **How verified:**
  - `node --check` on all four inline scripts (pre-compiled `React.createElement`; no JSX to transpile).
  - Headless Chromium, pinned libraries served locally (React 18.3.1, three r128, KaTeX 0.16.9, Plotly 2.32.0, Tailwind 3.4.5 compiled from the file's classes), origin/main vs branch, all three modes with every module expanded: `.main-col` text (tab strip removed) identical; report text identical apart from the title block and badges (2292 / 1097 / 450 numbers, and 2300 for an edited project, all equal); module statuses identical; autosave JSON, `Save .json` export, IndexedDB library record and `bridgeSuite.v1.projectMeta` share payload identical for an edited project.
  - Tabs: every summary-strip chip (13 / 9 / 2) and every summary row (9 / 6 / 2) selects the right tab, opens the module and scrolls to it; Expand all on Structural opens only Structural modules; Arrow/Home/End keys with wrap; the tab is remembered after reload; falls back to Summary for a tab the pile type lacks and returns to it when switching back.
  - Print: Letter PDFs in all three modes with the default selection and a partial selection (no inputs, no scope/references, no lateral) were looked at page by page: no clipped tables or equations, no orphan headings, no near-empty pages except before short kept-together blocks; chooser, preview (same selection), Esc / Cancel, "All (default)" restoring `{}`. No console errors; no horizontal scroll at 400 px in any mode.
- **Other copies:** none. The CSS, `OutTabs`, `PrintChooser`, `fitPrintReport` and the report helpers are specific to this tool.
- **Re-applying by hand:** the exact before/after is the unified diff below (CRLF stripped; the file uses CRLF). Hunks in order:
  1. CSS block appended at the end of the head `<style>` after the F12 `@media (max-width: 820px)` block. Anchor: `    .check-index { position: static; }`.
  2. Report helpers: new constants / functions before `function RTex({` (`RPT_UI`, `RPT_SERIF`, `RPT_GRP_*`, `rptGrpFor`, `RptStatCtx`, `rptStatusFor`, `RPT_SEL_KEY`, `loadRptSel`, `saveRptSel`, `fitPrintReport`).
  3. `Calc`, `RptCheck`, `RptInputs` title, `RptHeading`, `Narr` styles. Anchors: `function Calc({`, `// Pass/fail check line for the report`, `function RptInputs(`, `function RptHeading({`, `function Narr({`.
  4. `PrintReport`: `sel` prop and module-status effect; `cell`/`cellK`; `serif`; `RptRow`; `pageCss` + `hideCss`; `RptStatCtx.Provider`; title block (anchor `"Structural Calculation Package"`) up to `"Signature / Date"`; soil-layer sub-title; `rpt-grp` on the 02F and 11 blocks; S wrapper (anchors `n: "S",` and `before this package is sealed.")))`); summary table header row; colour tokens `#14304a` → `#16304F`, `#2f7d4f` → `#047857`, `#b23b3b` → `#B91C1C` inside `PrintReport` only.
  5. `LoadCasesCard` and `UtilizationDashboard` root `div`: `"data-otab-fixed": "summary"`.
  6. `jumpToModule` and `App` `gotoModule`: `showOutTabOf(...)`.
  7. `App`: `printDlg` / `rptSel` state, `printReport` → opens the chooser, `doPrint`, `beforeprint` and preview fit effects, `sel: rptSel` on both `PrintReport`s, `PrintChooser` element; `OutTabs` element before `LoadCasesCard` in `main.main-col`.
  8. New `OutTabs`, `PrintChooser` (and `OUT_TAB_KEY`, `OUT_TABS`, `outTabFor`, `readOutTab`, `showOutTabOf`) before the `CHECK INDEX` comment; `CheckIndex` `setAll` and the Expand / Collapse button titles.

```diff
diff --git a/Pile Designer.html b/Pile Designer.html
index 7c4fca1..266eea6 100644
--- a/Pile Designer.html	
+++ b/Pile Designer.html	
@@ -339,4 +339,78 @@
     .check-index { position: static; }
   }
+  /* ==========================================================
+     OUTPUT TABS + REPORT LOOK (2026-10-10, presentation only)
+     ----------------------------------------------------------
+     Output column split into tabs (Summary / Geometry & limits / Geotechnical /
+     Lateral / Structural / Cap & connection / Load test / Group; IAB: Simplified
+     Method / Tier 2). Every module stays rendered; the non-active tabs' blocks
+     are hidden with CSS only, as the input rail does. The printed report takes
+     the recent tools' look (Times text, UI-sans labels, navy #16304F headings,
+     calc lines on a light strip with a blue left rule, light OK / NG badges)
+     and a section chooser. No calculation, input key or report value changes.
+  ========================================================== */
+  .out-tabs { position: sticky; top: var(--ci-h); z-index: 30; display: flex; flex-wrap: wrap; gap: 2px;
+    background: var(--paper); border-bottom: 2px solid var(--navy-800); padding: 6px 0 0; font-family: var(--f-ui); }
+  .out-tab { position: relative; display: inline-flex; align-items: center; font-family: var(--f-ui); font-size: 12.5px; padding: 5px 11px;
+    border: 1px solid var(--pd-line); border-bottom: none; background: #F1F3F5; color: #41546E; border-radius: 5px 5px 0 0; white-space: nowrap; cursor: pointer; }
+  .out-tab:hover { background: #EFF4FA; }
+  .out-tab[aria-selected="true"] { background: var(--navy-800); color: #fff; border-color: var(--navy-800); font-weight: 600; }
+  .out-tab:focus-visible { outline: 2px solid #BFD3F2; outline-offset: 1px; }
+  .out-tab-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--no); margin-left: 6px; box-shadow: 0 0 0 1.5px #fff; }
+  .main-col > .out-tabs { margin-bottom: 0; }
+  section[data-module] { scroll-margin-top: calc(var(--ci-h) + var(--ot-h, 40px) + 12px); }
+  .main-col[data-otab-active="summary"] > [data-otab]:not([data-otab="summary"]),
+  .main-col[data-otab-active="geom"] > [data-otab]:not([data-otab="geom"]),
+  .main-col[data-otab-active="geo"] > [data-otab]:not([data-otab="geo"]),
+  .main-col[data-otab-active="simp"] > [data-otab]:not([data-otab="simp"]),
+  .main-col[data-otab-active="tier2"] > [data-otab]:not([data-otab="tier2"]),
+  .main-col[data-otab-active="lat"] > [data-otab]:not([data-otab="lat"]),
+  .main-col[data-otab-active="struct"] > [data-otab]:not([data-otab="struct"]),
+  .main-col[data-otab-active="cap"] > [data-otab]:not([data-otab="cap"]),
+  .main-col[data-otab-active="test"] > [data-otab]:not([data-otab="test"]),
+  .main-col[data-otab-active="group"] > [data-otab]:not([data-otab="group"]) { display: none; }
+  @media (max-width: 820px) {
+    .out-tabs { top: 0; }
+    .out-tab { font-size: 12px; padding: 5px 9px; }
+  }
+  @media print { .out-tabs, .pd-prdlg-ov { display: none !important; } }
+
+  /* print-section chooser */
+  .pd-prdlg-ov { position: fixed; inset: 0; background: rgba(15,25,40,.45); z-index: 80; display: flex; align-items: center; justify-content: center; font-family: var(--f-ui); }
+  .pd-prdlg { background: #fff; border-radius: 8px; padding: 16px 20px; width: min(460px, 92vw); max-height: 86vh; overflow: auto; box-shadow: 0 12px 40px rgba(0,0,0,.3); color: #1b232b; font-family: var(--f-ui); }
+  .pd-prdlg h2 { font-size: 15px; font-weight: 700; color: var(--navy-800); margin: 0 0 4px; }
+  .pd-prdlg .pd-prdlg-hint { font-size: 12px; color: #5A6B80; margin: 0 0 8px; line-height: 1.4; }
+  .pd-prdlg label { display: flex; gap: 8px; align-items: baseline; padding: 3px 0; font-size: 13px; cursor: pointer; }
+  .pd-prdlg label input { position: relative; top: 2px; }
+  .pd-prdlg .pd-prdlg-ns { color: #6B7A8F; font-size: 12px; }
+  .pd-prdlg .pd-prdlg-fixed { font-size: 12px; color: #41546E; padding: 3px 0 5px; border-bottom: 1px solid var(--pd-line); margin-bottom: 4px; }
+  .pd-prdlg .pd-prdlg-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
+  .pd-prdlg button { font-family: var(--f-ui); font-size: 12.5px; padding: 5px 12px; border-radius: 4px; border: 1px solid var(--navy-800); color: var(--navy-800); background: #fff; cursor: pointer; }
+  .pd-prdlg button:hover { background: #EFF4FA; }
+  .pd-prdlg button.is-primary { background: var(--navy-800); color: #fff; }
+  .pd-prdlg button.is-primary:hover { background: var(--navy-900); }
+  .pd-prdlg button.is-quiet { border-color: #C6CFDA; color: #41546E; padding: 2px 8px; font-size: 11.5px; }
+
+  /* printed report: page flow (headings stay with their content, short
+     sections and calc lines are not split, long sections flow so no page is
+     left nearly empty; no forced page breaks) */
+  @media print {
+    .print-only .rpt-section { break-inside: auto; page-break-inside: auto; }
+    .print-only .rpt-section[data-short] { break-inside: avoid; page-break-inside: avoid; }
+    .print-only .rpt-pagebreak { break-before: auto; page-break-before: auto; }
+    .print-only .rpt-h { break-after: avoid; page-break-after: avoid; }
+    .print-only tr, .print-only li, .print-only .rpt-calc, .print-only .rpt-check, .print-only .rpt-row { break-inside: avoid; page-break-inside: avoid; }
+    .print-only thead { display: table-header-group; }
+    .print-only, .print-only * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
+  }
+  /* the report is measured off screen at the printable width (7.1 in) before
+     printing; tables still too wide get a smaller font (nothing is clipped) */
+  .print-only[data-measure] { display: block !important; position: absolute !important; left: -30000px; top: 0; width: 7.1in; visibility: hidden; }
+  .print-only[data-measure] [style*="font-size: 7.5px"], .print-only[data-measure] [style*="font-size: 8px"],
+  .print-only[data-measure] [style*="font-size: 8.5px"], .print-only[data-measure] [style*="font-size: 9px"] { font-size: 8pt !important; }
+  .print-only[data-measure] [style*="font-size: 9.5px"], .print-only[data-measure] [style*="font-size: 10px"] { font-size: 8.5pt !important; }
+  .print-only table[data-fit="8"], .print-only table[data-fit="8"] td, .print-only table[data-fit="8"] th { font-size: 7.5pt !important; }
+  .print-only table[data-fit="7"], .print-only table[data-fit="7"] td, .print-only table[data-fit="7"] th { font-size: 7pt !important; }
+  .print-only table[data-fit="6"], .print-only table[data-fit="6"] td, .print-only table[data-fit="6"] th { font-size: 6.3pt !important; }
 </style>
 </head>
@@ -6410,4 +6484,80 @@ function loadSavedInputs() {
    Formatted as a sealed structural calc package.
 ============================================================ */
+/* Report look (2026-10-10): UI sans for labels, Times for text, navy #16304F. */
+const RPT_UI = "-apple-system, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif";
+const RPT_SERIF = "\"Times New Roman\", Times, \"Liberation Serif\", serif";
+/* Report section groups (print-section chooser). Each RptHeading carries its
+   group so the chooser can hide the section that holds it (CSS only). */
+const RPT_GRP_ORDER = ["inputs", "basis", "geom", "geo", "simp", "tier2", "lat", "struct", "cap", "test", "group", "summary"];
+const RPT_GRP_LABEL = { inputs: "Input summary", basis: "Scope, references & assumptions", geom: "Geometry & limits", geo: "Geotechnical", simp: "Simplified Method", tier2: "Tier 2", lat: "Lateral (p-y)", struct: "Structural", cap: "Cap & connection", test: "Load test", group: "Group", summary: "Summary of results & conclusion" };
+function rptGrpFor(n) {
+  const s = String(n);
+  if (s === "A") return "inputs";
+  if (s === "B" || s === "C" || s === "D") return "basis";
+  if (s === "S") return "summary";
+  if (s === "G") return "geom";
+  if (/^01[a-d]$/.test(s)) return "simp";
+  if (s === "12") return "tier2";
+  if (s === "01" || s === "09") return "geo";
+  if (/^02/.test(s)) return "lat";
+  if (s === "06" || s === "07") return "cap";
+  if (s === "08") return "test";
+  if (s === "11") return "group";
+  return "struct";
+}
+/* OK / NG badge on a report module heading: the status of the same on-screen
+   module (read from its data-status), so screen and report always agree.
+   "03-09" (H-pile structural block) combines its modules. G is not badged:
+   its report section lists materials and geometry, not the limit checks. */
+const RptStatCtx = React.createContext({});
+function rptStatusFor(n, stat) {
+  const s = String(n);
+  if (s === "G") return null;
+  const ids = s === "03\u201309" ? ["03", "04", "05", "07", "09"] : [s];
+  const v = ids.map(i => stat[i]).filter(x => x === "ok" || x === "ng");
+  if (!v.length) return null;
+  return v.indexOf("ng") >= 0 ? "ng" : "ok";
+}
+const RPT_SEL_KEY = "micropile_lrfd_printSel_v1";
+function loadRptSel() {
+  try { const v = JSON.parse(window.localStorage.getItem(RPT_SEL_KEY) || "null"); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
+}
+function saveRptSel(v) { try { window.localStorage.setItem(RPT_SEL_KEY, JSON.stringify(v)); } catch (e) {} }
+/* Fit the report to the printable width before printing / previewing. The
+   standalone report is display:none on screen, so it is laid out off screen at
+   7.1 in. Tables that are still too wide get a smaller font, equations that
+   run past the right edge are scaled down, and short sections are marked so
+   print keeps them on one page. Attributes / KaTeX nodes only. */
+function fitPrintReport(root) {
+  const R = root || [...document.querySelectorAll(".print-only")].find(e => !e.closest(".report-preview-show"));
+  if (!R) return;
+  const hidden = R.getClientRects().length === 0;
+  if (hidden) R.setAttribute("data-measure", "1");
+  try {
+    R.querySelectorAll("table[data-fit]").forEach(t => t.removeAttribute("data-fit"));
+    R.querySelectorAll(".katex[data-fitk]").forEach(k => { k.style.fontSize = ""; k.removeAttribute("data-fitk"); });
+    R.querySelectorAll("table").forEach(t => {
+      const pw = t.parentElement ? t.parentElement.clientWidth : 0;
+      if (!pw) return;
+      for (const f of ["8", "7", "6"]) { if (t.scrollWidth <= pw + 0.5) break; t.setAttribute("data-fit", f); }
+    });
+    const right = R.getBoundingClientRect().right;
+    R.querySelectorAll(".katex").forEach(k => {
+      if (k.parentElement && k.parentElement.closest(".katex")) return;
+      const box = k.closest("td, .rpt-calc-eq, .rpt-check") || R;
+      const lim = Math.min(right, box.getBoundingClientRect().right) - 2;
+      const kr = k.getBoundingClientRect();
+      if (kr.width > 0 && kr.right > lim) {
+        const room = lim - kr.left, fs = parseFloat(getComputedStyle(k).fontSize) || 12;
+        if (room > 20) { k.style.fontSize = (fs * Math.max(0.6, room / kr.width)).toFixed(2) + "px"; k.setAttribute("data-fitk", "1"); }
+      }
+    });
+    R.querySelectorAll(".rpt-section").forEach(sec => {
+      const h = sec.getBoundingClientRect().height;
+      if (h > 0 && h < 260) sec.setAttribute("data-short", "1"); else sec.removeAttribute("data-short");
+    });
+  } catch (e) { console.error(e); }
+  if (hidden) R.removeAttribute("data-measure");
+}
 function RTex({
   tex
@@ -6430,6 +6580,7 @@ function Calc({
 }) {
   return /*#__PURE__*/React.createElement("div", {
+    className: "rpt-calc",
     style: {
-      marginBottom: "7px",
+      marginBottom: "6px",
       breakInside: "avoid"
     }
@@ -6442,12 +6593,19 @@ function Calc({
     }
   }, /*#__PURE__*/React.createElement("div", {
+    className: "rpt-calc-eq",
     style: {
       fontSize: "11.5px",
-      color: "#1a2733",
-      flex: 1
+      color: "#11161c",
+      flex: 1,
+      minWidth: 0,
+      background: "#F7F8FA",
+      borderLeft: "3px solid #2563EB",
+      padding: "2px 10px"
     }
   }, label && /*#__PURE__*/React.createElement("span", {
     style: {
-      color: "#475569"
+      color: "#475569",
+      fontFamily: RPT_UI,
+      fontSize: "10.5px"
     }
   }, label, ": "), /*#__PURE__*/React.createElement("span", {
@@ -6467,6 +6625,6 @@ function Calc({
     style: {
       fontSize: "9px",
-      color: "#94a3b8",
-      fontFamily: "monospace",
+      color: "#5A6B80",
+      fontFamily: RPT_UI,
       whiteSpace: "nowrap",
       textAlign: "right",
@@ -6478,5 +6636,6 @@ function Calc({
       color: "#64748b",
       fontStyle: "italic",
-      marginTop: "1px"
+      marginTop: "1px",
+      paddingLeft: "13px"
     }
   }, note));
@@ -6489,4 +6648,5 @@ function RptCheck({
 }) {
   return /*#__PURE__*/React.createElement("div", {
+    className: "rpt-check",
     style: {
       display: "flex",
@@ -6494,11 +6654,15 @@ function RptCheck({
       gap: "10px",
       margin: "6px 0",
-      padding: "5px 9px",
-      background: pass ? "rgba(47,125,79,0.06)" : "rgba(178,59,59,0.06)",
-      borderLeft: `3px solid ${pass ? "#2f7d4f" : "#b23b3b"}`
+      padding: "4px 9px",
+      background: pass ? "#F6FBF8" : "#FDF7F6",
+      border: "1px solid " + (pass ? "#CDEBDC" : "#F1C9C5"),
+      borderLeft: `3px solid ${pass ? "#059669" : "#DC2626"}`,
+      borderRadius: "4px",
+      breakInside: "avoid"
     }
   }, /*#__PURE__*/React.createElement("div", {
     style: {
       flex: 1,
+      minWidth: 0,
       fontSize: "12.5px"
     }
@@ -6507,8 +6671,13 @@ function RptCheck({
   })), /*#__PURE__*/React.createElement("div", {
     style: {
-      fontSize: "11px",
+      fontSize: "10px",
       fontWeight: 700,
-      fontFamily: "monospace",
-      color: pass ? "#2f7d4f" : "#b23b3b"
+      fontFamily: RPT_UI,
+      whiteSpace: "nowrap",
+      padding: "0 6px",
+      borderRadius: "3px",
+      background: pass ? "#E8F7F0" : "#FDECEC",
+      color: pass ? "#065F46" : "#B91C1C",
+      border: "1px solid " + (pass ? "#7FD1B0" : "#F1A8A8")
     }
   }, pass ? "✓ OK" : "✗ NG"));
@@ -6522,7 +6691,8 @@ function RptInputs({ title, rows }) {
   return /*#__PURE__*/React.createElement("div", { className: "rpt-avoid", style: { marginBottom: "10px" } },
     /*#__PURE__*/React.createElement("div", {
-      style: { fontFamily: "monospace", fontSize: "9.5px", fontWeight: 700, color: "#14304a",
-               textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px",
-               borderBottom: "1px solid #cbd5e1", paddingBottom: "2px" }
+      className: "rpt-sub",
+      style: { fontFamily: RPT_UI, fontSize: "10px", fontWeight: 700, color: "#16304F",
+               marginBottom: "3px", breakAfter: "avoid",
+               borderBottom: "1px solid #B9C8DB", paddingBottom: "2px" }
     }, title),
     /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "10px" } },
@@ -6543,23 +6713,30 @@ function RptHeading({
   code
 }) {
+  const st = rptStatusFor(n, React.useContext(RptStatCtx));
   return /*#__PURE__*/React.createElement("div", {
-    className: "rpt-avoid",
+    className: "rpt-avoid rpt-h",
+    "data-rgrp": rptGrpFor(n),
+    "data-n": n,
     style: {
       marginTop: "16px",
       marginBottom: "8px",
-      borderBottom: "1.5px solid #14304a",
+      borderBottom: "1.5px solid #16304F",
       paddingBottom: "3px",
       display: "flex",
       alignItems: "baseline",
-      gap: "8px"
+      flexWrap: "wrap",
+      gap: "2px 8px",
+      breakAfter: "avoid",
+      pageBreakAfter: "avoid"
     }
   }, /*#__PURE__*/React.createElement("span", {
     style: {
-      fontFamily: "monospace",
-      fontSize: "11px",
+      fontFamily: RPT_UI,
+      fontSize: "10.5px",
       fontWeight: 700,
       color: "#fff",
-      background: "#14304a",
-      padding: "1px 6px"
+      background: "#16304F",
+      padding: "1px 6px",
+      borderRadius: "3px"
     }
   }, n), /*#__PURE__*/React.createElement("span", {
@@ -6567,12 +6744,24 @@ function RptHeading({
       fontSize: "14px",
       fontWeight: 700,
-      color: "#14304a",
-      fontFamily: "Georgia, serif"
+      color: "#16304F",
+      fontFamily: RPT_SERIF
     }
-  }, title), code && /*#__PURE__*/React.createElement("span", {
+  }, title), st && /*#__PURE__*/React.createElement("span", {
+    className: "rpt-badge",
+    style: {
+      fontFamily: RPT_UI,
+      fontSize: "9px",
+      fontWeight: 700,
+      padding: "0 5px",
+      borderRadius: "3px",
+      background: st === "ok" ? "#E8F7F0" : "#FDECEC",
+      color: st === "ok" ? "#065F46" : "#B91C1C",
+      border: "1px solid " + (st === "ok" ? "#7FD1B0" : "#F1A8A8")
+    }
+  }, st === "ok" ? "OK" : "NG"), code && /*#__PURE__*/React.createElement("span", {
     style: {
       fontSize: "9.5px",
-      color: "#94a3b8",
-      fontFamily: "monospace",
+      color: "#5A6B80",
+      fontFamily: RPT_UI,
       marginLeft: "auto"
     }
@@ -6588,5 +6777,5 @@ function Narr({
       lineHeight: 1.5,
       margin: "4px 0 8px",
-      fontFamily: "Georgia, serif"
+      fontFamily: RPT_SERIF
     }
   }, children);
@@ -6597,6 +6786,15 @@ function PrintReport({
   caseRes,
   pyRes,
-  pcr
+  pcr,
+  sel
 }) {
+  // OK / NG of each on-screen module (read after every render; see rptStatusFor)
+  const [modStat, setModStat] = useState({});
+  useEffect(() => {
+    const m = {};
+    document.querySelectorAll(".app-shell section[data-module]").forEach(s => { m[s.getAttribute("data-module")] = s.getAttribute("data-status"); });
+    const k = JSON.stringify(m);
+    setModStat(p => JSON.stringify(p) === k ? p : m);
+  });
   const today = new Date().toLocaleDateString(undefined, {
     year: "numeric",
@@ -6605,5 +6803,5 @@ function PrintReport({
   });
   const cell = {
-    border: "1px solid #cbd5e1",
+    border: "1px solid #C6CFDA",
     padding: "3px 7px",
     fontSize: "10px",
@@ -6612,6 +6810,6 @@ function PrintReport({
   const cellK = {
     ...cell,
-    background: "#f1f5f9",
-    color: "#475569"
+    background: "#EEF2F7",
+    color: "#41546E"
   };
   const cellV = {
@@ -6619,8 +6817,8 @@ function PrintReport({
     fontWeight: 700
   };
-  const serif = "Georgia, 'Times New Roman', serif";
-  const RptRow = ({ label, val, pass }) => /*#__PURE__*/React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", padding: "3px 0", fontFamily: "monospace", fontSize: "10px" } },
+  const serif = RPT_SERIF;
+  const RptRow = ({ label, val, pass }) => /*#__PURE__*/React.createElement("div", { className: "rpt-row", style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", borderTop: "1px solid #E4E7EB", padding: "3px 0", fontFamily: "monospace", fontSize: "10px" } },
     /*#__PURE__*/React.createElement("span", null, label),
-    /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, val), "  ", /*#__PURE__*/React.createElement("span", { style: { color: pass ? "#2f7d4f" : "#b23b3b", fontWeight: 700 } }, pass ? "OK" : "NG")));
+    /*#__PURE__*/React.createElement("span", { style: { whiteSpace: "nowrap" } }, /*#__PURE__*/React.createElement("b", null, val), "  ", /*#__PURE__*/React.createElement("span", { style: { fontFamily: RPT_UI, fontSize: "9px", padding: "0 5px", borderRadius: "3px", background: pass ? "#E8F7F0" : "#FDECEC", color: pass ? "#065F46" : "#B91C1C", border: "1px solid " + (pass ? "#7FD1B0" : "#F1A8A8"), fontWeight: 700 } }, pass ? "OK" : "NG")));
 
   // results rows (mirror on-screen summary)
@@ -6657,6 +6855,10 @@ function PrintReport({
   const cssStr = v => String(v == null ? "" : v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
   const footLeft = [I.projName, I.projNum, I.pileType === "iab" ? "Integral abutment pile" : I.pileType === "hpile" ? "Driven H-pile" : "Drilled micropile"].filter(Boolean).join("  \u00b7  ");
-  const pageCss = "@media print { @page { @bottom-left { content: \"" + cssStr(footLeft) + "\"; font: 8pt Georgia, 'Times New Roman', serif; color: #475569; } @bottom-right { content: \"Sheet \" counter(page) \" of \" counter(pages); font: 8pt Georgia, 'Times New Roman', serif; color: #475569; } } }";
-  return /*#__PURE__*/React.createElement("div", {
+  const headLeft = [I.projName, I.projSubject].filter(Boolean).join(" \u2014 ");
+  const headRight = ["Pile Designer", I.projBy, today].filter(Boolean).join("  \u00b7  ");
+  const pageCss = "@media print { @page { @top-left { content: \"" + cssStr(headLeft) + "\"; font: 7.5pt 'Times New Roman', Times, serif; color: #5A6B80; } @top-right { content: \"" + cssStr(headRight) + "\"; font: 7.5pt 'Times New Roman', Times, serif; color: #5A6B80; } @bottom-left { content: \"" + cssStr(footLeft) + "\"; font: 8pt 'Times New Roman', Times, serif; color: #475569; } @bottom-right { content: \"Sheet \" counter(page) \" of \" counter(pages); font: 8pt 'Times New Roman', Times, serif; color: #475569; } } }";
+  // print-section chooser: hide the section (or group block) that holds a heading of an unticked group
+  const hideCss = RPT_GRP_ORDER.filter(g => sel && sel[g] === false).map(g => ".print-only :is(.rpt-section, .rpt-grp):has(> .rpt-h[data-rgrp=\"" + g + "\"]) { display: none !important; }").join("\n");
+  return /*#__PURE__*/React.createElement(RptStatCtx.Provider, { value: modStat }, /*#__PURE__*/React.createElement("div", {
     className: "print-only",
     style: {
@@ -6666,8 +6868,14 @@ function PrintReport({
       margin: "0 auto"
     }
-  }, /*#__PURE__*/React.createElement("style", null, pageCss), /*#__PURE__*/React.createElement("div", {
-    className: "rpt-avoid",
+  }, /*#__PURE__*/React.createElement("style", null, pageCss + (hideCss ? "\n" + hideCss : "")),
+  /* Title block (recent tools' layout): package label, pile-type title and
+     overall status, then Project / Job no. / Subject / Units / Prepared by /
+     Checked by / Date and the design basis. */
+  /*#__PURE__*/React.createElement("div", {
+    className: "rpt-avoid rpt-title",
     style: {
-      border: "2px solid #11161c"
+      border: "1.6px solid #16304F",
+      padding: "8px 12px 6px",
+      breakInside: "avoid"
     }
   }, /*#__PURE__*/React.createElement("div", {
@@ -6675,86 +6883,54 @@ function PrintReport({
       display: "flex",
       justifyContent: "space-between",
-      alignItems: "center",
-      padding: "10px 14px",
-      borderBottom: "1px solid #11161c",
-      background: "#14304a",
-      color: "#fff"
+      alignItems: "flex-start",
+      gap: "6px 12px",
+      flexWrap: "wrap"
     }
-  }, /*#__PURE__*/React.createElement("div", {
+  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
     style: {
-      fontFamily: "monospace",
-      fontSize: "10px",
-      letterSpacing: "2px",
-      textTransform: "uppercase"
+      fontFamily: RPT_UI,
+      fontSize: "9px",
+      letterSpacing: "1px",
+      textTransform: "uppercase",
+      color: "#5A6B80"
     }
   }, "Structural Calculation Package"), /*#__PURE__*/React.createElement("div", {
     style: {
-      fontFamily: "monospace",
-      fontSize: "10px"
-    }
-  }, I.projNum)), /*#__PURE__*/React.createElement("div", {
-    style: {
-      display: "flex"
-    }
-  }, /*#__PURE__*/React.createElement("div", {
-    style: {
-      flex: 2,
-      padding: "12px 14px",
-      borderRight: "1px solid #11161c"
-    }
-  }, /*#__PURE__*/React.createElement("div", {
-    style: {
-      fontSize: "19px",
+      fontSize: "17px",
       fontWeight: 700,
-      color: "#14304a",
-      lineHeight: 1.15
-    }
-  }, I.projName), /*#__PURE__*/React.createElement("div", {
-    style: {
-      fontSize: "13px",
-      marginTop: "3px",
-      color: "#334155"
-    }
-  }, I.projSubject), /*#__PURE__*/React.createElement("div", {
-    style: {
-      fontSize: "12px",
-      marginTop: "8px",
-      fontWeight: 700
+      color: "#16304F",
+      lineHeight: 1.2,
+      marginTop: "2px"
     }
   }, I.pileType === "iab" ? "Integral Abutment H-Pile \u2014 MassDOT Simplified Method" : I.pileType === "hpile" ? "Driven Steel H-Pile — Structural & Geotechnical Design" : "Drilled Micropile — Structural & Geotechnical Design")), /*#__PURE__*/React.createElement("div", {
     style: {
-      flex: 1,
-      padding: "12px 14px",
-      fontFamily: "monospace",
-      fontSize: "10.5px",
-      lineHeight: 1.7
-    }
-  }, /*#__PURE__*/React.createElement("div", null, "Job No.\xA0\xA0", /*#__PURE__*/React.createElement("b", null, I.projNum)), /*#__PURE__*/React.createElement("div", null, "Computed\xA0\xA0", /*#__PURE__*/React.createElement("b", null, I.projBy)), /*#__PURE__*/React.createElement("div", null, "Checked\xA0\xA0\xA0", /*#__PURE__*/React.createElement("b", null, I.projChk)), /*#__PURE__*/React.createElement("div", null, "Date\xA0\xA0\xA0\xA0\xA0\xA0", /*#__PURE__*/React.createElement("b", null, today)))), /*#__PURE__*/React.createElement("div", {
-    style: {
-      display: "flex",
-      borderTop: "1px solid #11161c"
-    }
-  }, /*#__PURE__*/React.createElement("div", {
-    style: {
-      flex: 1,
-      padding: "8px 14px",
-      fontSize: "11px"
-    }
-  }, /*#__PURE__*/React.createElement("span", {
-    style: {
-      color: "#475569"
-    }
-  }, "Design basis: "), "AASHTO LRFD Bridge Design Specifications; FHWA NHI-05-039"), /*#__PURE__*/React.createElement("div", {
-    style: {
-      padding: "8px 14px",
-      borderLeft: "1px solid #11161c",
-      fontFamily: "monospace",
-      fontSize: "11px",
+      fontFamily: RPT_UI,
+      fontSize: "10px",
       fontWeight: 700,
-      color: r.allPass ? "#2f7d4f" : "#b23b3b",
-      minWidth: "150px",
-      textAlign: "center"
-    }
-  }, r.allPass ? "ALL CHECKS SATISFIED" : "CHECKS REQUIRE REVIEW"))), ((r.inputErrors && r.inputErrors.length) || (r.inputNotes && r.inputNotes.length)) ? /*#__PURE__*/React.createElement("div", {
+      whiteSpace: "nowrap",
+      padding: "2px 8px",
+      borderRadius: "4px",
+      background: r.allPass ? "#E8F7F0" : "#FDECEC",
+      color: r.allPass ? "#065F46" : "#B91C1C",
+      border: "1px solid " + (r.allPass ? "#7FD1B0" : "#F1A8A8")
+    }
+  }, r.allPass ? "ALL CHECKS SATISFIED" : "CHECKS REQUIRE REVIEW")), (() => {
+    const tdS = { padding: "1.5px 10px 1.5px 0", verticalAlign: "top", width: "50%" };
+    const lab = t => /*#__PURE__*/React.createElement("b", { style: { fontFamily: RPT_UI, fontSize: "9.5px", color: "#41546E" } }, t, ": ");
+    const row = (k, l1, v1, l2, v2) => /*#__PURE__*/React.createElement("tr", { key: k },
+      /*#__PURE__*/React.createElement("td", { style: tdS }, lab(l1), v1),
+      /*#__PURE__*/React.createElement("td", { style: tdS }, lab(l2), v2));
+    return /*#__PURE__*/React.createElement("table", {
+      style: { width: "100%", borderCollapse: "collapse", fontSize: "11px", marginTop: "6px", borderTop: "1px solid #B9C8DB" }
+    }, /*#__PURE__*/React.createElement("tbody", null,
+      row("a", "Project", I.projName, "Job no.", I.projNum),
+      row("b", "Subject / member", I.projSubject, "Units", "US customary (kip, ft, in, ksi)"),
+      row("c", "Prepared by", I.projBy, "Checked by", I.projChk),
+      /*#__PURE__*/React.createElement("tr", { key: "d" },
+        /*#__PURE__*/React.createElement("td", { style: tdS }, lab("Date"), today),
+        /*#__PURE__*/React.createElement("td", { style: tdS }, /*#__PURE__*/React.createElement("span", {
+          style: { fontFamily: RPT_UI, fontSize: "9.5px", fontWeight: 700, color: "#41546E" }
+        }, "Design basis: "), "AASHTO LRFD Bridge Design Specifications; FHWA NHI-05-039"))));
+  })()), ((r.inputErrors && r.inputErrors.length) || (r.inputNotes && r.inputNotes.length)) ? /*#__PURE__*/React.createElement("div", {
     style: { marginTop: "6px", fontSize: "10px", color: "#8a2a2a" }
   }, (r.inputErrors || []).map((m, i) => /*#__PURE__*/React.createElement("div", { key: "e" + i }, "\u26a0 Input error: ", m)),
@@ -6784,8 +6960,8 @@ function PrintReport({
       right: "0",
       textAlign: "center",
-      fontFamily: "monospace",
+      fontFamily: RPT_UI,
       fontSize: "8px",
       color: "#94a3b8",
-      letterSpacing: "1px"
+      letterSpacing: "0.5px"
     }
   }, "PROFESSIONAL ENGINEER SEAL"), /*#__PURE__*/React.createElement("div", {
@@ -6793,5 +6969,5 @@ function PrintReport({
       borderTop: "1px solid #475569",
       width: "90%",
-      fontFamily: "monospace",
+      fontFamily: RPT_UI,
       fontSize: "8px",
       color: "#475569",
@@ -6919,5 +7095,5 @@ function PrintReport({
     ] }),
     (Array.isArray(I.soilLayers) && I.soilLayers.length > 0) && /*#__PURE__*/React.createElement("div", { className: "rpt-avoid", style: { marginBottom: "10px" } },
-      /*#__PURE__*/React.createElement("div", { style: { fontFamily: "monospace", fontSize: "9.5px", fontWeight: 700, color: "#14304a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px" } }, "Soil profile \u00b7 layers"),
+      /*#__PURE__*/React.createElement("div", { className: "rpt-sub", style: { fontFamily: RPT_UI, fontSize: "10px", fontWeight: 700, color: "#16304F", marginBottom: "3px", breakAfter: "avoid", borderBottom: "1px solid #B9C8DB", paddingBottom: "2px" } }, "Soil profile \u00b7 layers"),
       /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "9.5px" } },
         /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", { style: { borderBottom: "1px solid #cbd5e1" } },
@@ -6927,5 +7103,5 @@ function PrintReport({
           /*#__PURE__*/React.createElement("tr", { key: i, style: { borderBottom: "1px solid #f1f5f9" } },
             /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", textAlign: "right", fontFamily: "monospace" } }, fmt(ly.topDepth, 1)),
-            /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", color: "#14304a" } },
+            /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", color: "#16304F" } },
               ly.type === "sand" ? "Reese sand (1974)" : ly.type === "stiffclay" ? "Welch\u2013Reese stiff clay" : ly.type === "weakrock" ? "Reese weak rock (1997)" : "Matlock soft clay (1970)"),
             /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", textAlign: "right", fontFamily: "monospace" } }, ly.gamma != null ? fmt(ly.gamma, 0) : "\u2014"),
@@ -7066,5 +7242,5 @@ function PrintReport({
               /*#__PURE__*/React.createElement("table", { style: { borderCollapse: "collapse", width: "100%" } },
                 /*#__PURE__*/React.createElement("tbody", null, b.bc.map((c, i) => /*#__PURE__*/React.createElement("tr", { key: i },
-                  /*#__PURE__*/React.createElement("td", { style: { ...cell, color: c.ok ? "#256436" : "#b23b3b", width: "16px" } }, c.ok ? "\u2713" : "\u2717"),
+                  /*#__PURE__*/React.createElement("td", { style: { ...cell, color: c.ok ? "#256436" : "#B91C1C", width: "16px" } }, c.ok ? "\u2713" : "\u2717"),
                   /*#__PURE__*/React.createElement("td", { style: cell }, c.label),
                   /*#__PURE__*/React.createElement("td", { style: { ...cell, textAlign: "right", whiteSpace: "nowrap" } }, c.val))))),
@@ -7292,5 +7468,5 @@ function PrintReport({
   }), /*#__PURE__*/React.createElement(Narr, null, I.lateralSource === "py" ? `The maximum bending moment used in the structural checks is computed by the built-in nonlinear p-y finite-difference analysis (Reese et al. 1974 sand; Matlock 1970 soft clay; Welch & Reese 1972 stiff clay; Georgiadis 1983 layering; axial thrust carried in the governing equation). Mmax = ${fmt(r.MmaxUsed != null ? r.MmaxUsed : I.Mmax, 1)} kip·ft.${I.solverFree < 0 ? ` The pile head is modeled ${fmt(Math.abs(I.solverFree),1)} ft below grade (buried pile cap); lateral soil resistance is credited from the head down at true overburden. The cap’s passive resistance is not included in this pile analysis and no near-surface p-y reduction is applied — near-surface soil should be down-rated separately if backfill is disturbed or non-structural.` : ``} The implementation is benchmarked against an LPILE 2022 project analysis (within 0.2% on Mmax); final design should be verified against a project-specific LPILE run prior to sealing.` : I.lateralSource === "input" ? `The maximum bending moment used in the structural checks is taken from an external p-y (LPILE) analysis as Mmax = ${fmt(I.Mmax, 1)} kip·ft.` : `The maximum bending moment is computed by a finite-difference beam-on-elastic-foundation analysis using a linear subgrade modulus, and reports the depth to fixity (second zero-crossing of the moment diagram) as a reference figure only \u2014 it is not used in the structural checks. This first-order result is to be verified against a project-specific LPILE analysis prior to sealing.`),
   I.lateralSource === "py" && /*#__PURE__*/React.createElement("div", { style: { margin: "6px 0 8px" } },
-    /*#__PURE__*/React.createElement("div", { style: { fontSize: "8.5px", fontWeight: 700, color: "#14304a", marginBottom: "2px" } }, "p-y ANALYSIS CONSTANTS (these govern the result — verify against the geotechnical report)"),
+    /*#__PURE__*/React.createElement("div", { style: { fontSize: "8.5px", fontWeight: 700, color: "#16304F", marginBottom: "2px" } }, "p-y ANALYSIS CONSTANTS (these govern the result — verify against the geotechnical report)"),
     /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "8px" } },
       /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", { style: { borderBottom: "1px solid #94a3b8", textAlign: "left", color: "#64748b" } },
@@ -7568,5 +7744,5 @@ function PrintReport({
     // ---- three-method comparison, mirroring the on-screen tabs ----
     /*#__PURE__*/React.createElement("div", { className: "rpt-avoid", style: { margin: "6px 0 10px" } },
-      /*#__PURE__*/React.createElement("div", { style: { fontFamily: "monospace", fontSize: "9.5px", fontWeight: 700, color: "#14304a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px" } },
+      /*#__PURE__*/React.createElement("div", { style: { fontFamily: "monospace", fontSize: "9.5px", fontWeight: 700, color: "#16304F", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px" } },
         "All three methods \u00b7 \u03c6c\u00b7Pn vs STL = " + fmt(r.buckling.STL, 0) + " kip"),
       /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "10px" } },
@@ -7578,6 +7754,6 @@ function PrintReport({
             const mm = r.buckling.methods[k], isSel = k === r.buckling.bklTab;
             return /*#__PURE__*/React.createElement("tr", { key: k, style: { borderBottom: "1px solid #f1f5f9", background: isSel ? "rgba(20,48,74,0.06)" : "transparent" } },
-              /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", fontWeight: 700, color: "#14304a" } }, isSel ? "\u25b8" : ""),
-              /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", fontWeight: isSel ? 700 : 400, color: "#14304a" } }, nm),
+              /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", fontWeight: 700, color: "#16304F" } }, isSel ? "\u25b8" : ""),
+              /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", fontWeight: isSel ? 700 : 400, color: "#16304F" } }, nm),
               ...(mm
                 ? [k === "pcrit" ? fmt(mm.KLeq_ft, 1) + "*" : fmt(mm.Lf, 1), fmt(mm.KL, 1), fmt(mm.slender, 0), fmt(mm.Pe, 0), fmt(mm.Pn, 0), fmt(mm.phiPn, 0)]
@@ -7585,5 +7761,5 @@ function PrintReport({
                 : [/*#__PURE__*/React.createElement("td", { key: "na", colSpan: 6, style: { padding: "2px 4px", textAlign: "right", fontStyle: "italic", color: "#94a3b8" } },
                     k === "pcrit" ? "ramp not run" : (r.buckling.deflDegenerate ? "match degenerate \u2014 L_equiv \u2264 L\u1d64" : "no lateral deflection available"))]),
-              /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", textAlign: "right", fontWeight: 700, color: mm ? (mm.pass ? "#2f6f3e" : "#b23b3b") : "#94a3b8" } },
+              /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", textAlign: "right", fontWeight: 700, color: mm ? (mm.pass ? "#2f6f3e" : "#B91C1C") : "#94a3b8" } },
                 mm ? (mm.pass ? "OK" : "NG") : "\u2014"));
           }))),
@@ -7668,5 +7844,5 @@ function PrintReport({
     eq: `\\phi_c P_n = ${fmt(r.buckling.phiPn_buck, 1)}\\ \\text{kip} \\;${r.buckling.buck_pass ? '\\geq' : '<'}\\; STL = ${fmt(I.STL, 0)}\\ \\text{kip}`
   }), pcr && pcr.ok && /*#__PURE__*/React.createElement("div", { style: { marginTop: "8px", padding: "7px 9px", border: "1px solid #cbd5e1", borderRadius: "3px", background: "#f8fafc" } },
-    /*#__PURE__*/React.createElement("div", { style: { fontSize: "9px", fontWeight: 700, color: "#14304a", marginBottom: "3px" } }, "Soil-supported critical buckling (nonlinear p-y ramp \u2014 rigorous cross-check)"),
+    /*#__PURE__*/React.createElement("div", { style: { fontSize: "9px", fontWeight: 700, color: "#16304F", marginBottom: "3px" } }, "Soil-supported critical buckling (nonlinear p-y ramp \u2014 rigorous cross-check)"),
     /*#__PURE__*/React.createElement("div", { style: { fontSize: "8.5px", color: "#334", marginBottom: "2px" } },
       "Axial thrust ramped on the nonlinear p-y model to instability: P", /*#__PURE__*/React.createElement("sub", null, "cr"), " = ", /*#__PURE__*/React.createElement("b", null, fmt(pcr.Pcr, 0), " kip"),
@@ -7717,5 +7893,5 @@ function PrintReport({
               data: [{ x: pcr.hist.filter(p => !p.diverged && isFinite(p.y0) && isFinite(p.Q)).map(p => Math.abs(p.y0)), y: pcr.hist.filter(p => !p.diverged && isFinite(p.y0) && isFinite(p.Q)).map(p => p.Q), mode: "lines+markers", line: { color: C.accent, width: 2 }, marker: { size: 4 },
                 hoverinfo: "text", text: pcr.hist.filter(p => !p.diverged && isFinite(p.y0) && isFinite(p.Q)).map(p => "Q=" + fmt(p.Q, 0) + " kip<br>y₀=" + fmt(Math.abs(p.y0), 3) + " in<br>Mmax=" + fmt(p.Mmax, 1) + " kip·ft") },
-                { x: [Math.abs(isFinite(pcr.y0_base) ? pcr.y0_base : 0)], y: [pcr.at.STL], mode: "markers", marker: { color: "#14304a", size: 8, symbol: "diamond" }, hoverinfo: "text", text: ["design STL"] }],
+                { x: [Math.abs(isFinite(pcr.y0_base) ? pcr.y0_base : 0)], y: [pcr.at.STL], mode: "markers", marker: { color: "#16304F", size: 8, symbol: "diamond" }, hoverinfo: "text", text: ["design STL"] }],
               layout: baseLayout({ height: 200, margin: { l: 50, r: 8, t: 8, b: 34 }, showlegend: false,
                 xaxis: { title: { text: "head deflection (in)", font: { size: 9 } }, gridcolor: C.grid },
@@ -7742,5 +7918,5 @@ function PrintReport({
           /*#__PURE__*/React.createElement("br"), /*#__PURE__*/React.createElement("span", { className: "text-slate-500" }, "Note: the model never restrains head translation (only rotation, per the head-fixity setting), so this finds sway and sway-coupled interior modes. A pile head rigidly braced against sidesway by the cap/superstructure buckles at a higher load; for that truly-braced case this P", /*#__PURE__*/React.createElement("sub", null, "cr"), " is conservative."))),
     pcr.trace && pcr.trace.length > 1 && /*#__PURE__*/React.createElement("div", { className: "rpt-avoid", style: { marginTop: "6px" } },
-      /*#__PURE__*/React.createElement("div", { style: { fontFamily: "monospace", fontSize: "8.5px", fontWeight: 700, color: "#14304a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" } },
+      /*#__PURE__*/React.createElement("div", { style: { fontFamily: "monospace", fontSize: "8.5px", fontWeight: 700, color: "#16304F", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" } },
         "Ramp trace \u00b7 every solve in the search (" + pcr.trace.length + " steps)"),
       /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "8.5px" } },
@@ -7759,9 +7935,9 @@ function PrintReport({
               /*#__PURE__*/React.createElement("td", { style: { padding: "1px 4px", textAlign: "right", fontFamily: "monospace", color: "#64748b" } }, I.STL > 0 ? fmt(t.Q / I.STL, 2) : "\u2014"),
               t.diverged
-                ? /*#__PURE__*/React.createElement("td", { colSpan: 5, style: { padding: "1px 4px", textAlign: "right", fontStyle: "italic", color: "#b23b3b" } }, "solve diverged")
+                ? /*#__PURE__*/React.createElement("td", { colSpan: 5, style: { padding: "1px 4px", textAlign: "right", fontStyle: "italic", color: "#B91C1C" } }, "solve diverged")
                 : [t.y0, t.ymax, t.peakFt, t.Mmax, t.soft != null ? t.soft * 100 : null].map((v, k) =>
                     /*#__PURE__*/React.createElement("td", { key: k, style: { padding: "1px 4px", textAlign: "right", fontFamily: "monospace" } },
                       v == null ? "\u2014" : fmt(v, k === 0 || k === 1 ? 3 : (k === 4 ? 0 : 1)))),
-              /*#__PURE__*/React.createElement("td", { style: { padding: "1px 4px", textAlign: "right", fontFamily: "monospace", fontWeight: unstable ? 700 : 400, color: unstable ? "#b23b3b" : "#2f6f3e" } },
+              /*#__PURE__*/React.createElement("td", { style: { padding: "1px 4px", textAlign: "right", fontFamily: "monospace", fontWeight: unstable ? 700 : 400, color: unstable ? "#B91C1C" : "#2f6f3e" } },
                 unstable ? "UNSTABLE" : "stable"));
           });
@@ -7790,8 +7966,8 @@ function PrintReport({
     /*#__PURE__*/React.createElement("div", { className: "rpt-avoid", style: { border: "1px solid #cbd5e1", background: "#f8fafc", padding: "6px 8px", margin: "6px 0" } },
       /*#__PURE__*/React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px" } },
-        /*#__PURE__*/React.createElement("span", { style: { fontFamily: "monospace", fontSize: "9.5px", fontWeight: 700, color: "#14304a", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Geotechnical depth to fixity"),
-        /*#__PURE__*/React.createElement("span", { style: { fontFamily: "monospace", fontSize: "8px", background: "rgba(20,48,74,0.10)", color: "#14304a", padding: "1px 5px" } }, "REFERENCE ONLY")),
+        /*#__PURE__*/React.createElement("span", { style: { fontFamily: "monospace", fontSize: "9.5px", fontWeight: 700, color: "#16304F", textTransform: "uppercase", letterSpacing: "0.06em" } }, "Geotechnical depth to fixity"),
+        /*#__PURE__*/React.createElement("span", { style: { fontFamily: "monospace", fontSize: "8px", background: "rgba(20,48,74,0.10)", color: "#16304F", padding: "1px 5px" } }, "REFERENCE ONLY")),
       pyRes.zFix2 != null
-        ? /*#__PURE__*/React.createElement("div", { style: { fontFamily: "monospace", fontSize: "12px", color: "#14304a", marginBottom: "3px" } },
+        ? /*#__PURE__*/React.createElement("div", { style: { fontFamily: "monospace", fontSize: "12px", color: "#16304F", marginBottom: "3px" } },
             /*#__PURE__*/React.createElement("b", null, "z_fix = " + fmt(pyRes.zFix2, 1) + " ft"),
             /*#__PURE__*/React.createElement("span", { style: { fontSize: "9.5px", color: "#64748b" } },
@@ -7827,5 +8003,5 @@ function PrintReport({
     // ---- per-layer p-y model basis ----
     (Array.isArray(I.soilLayers) && I.soilLayers.length > 0) && /*#__PURE__*/React.createElement("div", { className: "rpt-avoid", style: { marginBottom: "10px" } },
-      /*#__PURE__*/React.createElement("div", { style: { fontFamily: "monospace", fontSize: "9.5px", fontWeight: 700, color: "#14304a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px" } },
+      /*#__PURE__*/React.createElement("div", { style: { fontFamily: "monospace", fontSize: "9.5px", fontWeight: 700, color: "#16304F", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px" } },
         "p-y constitutive model \u00b7 by layer"),
       /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "9.5px" } },
@@ -7844,5 +8020,5 @@ function PrintReport({
           return /*#__PURE__*/React.createElement("tr", { key: i, style: { borderBottom: "1px solid #f1f5f9" } },
             /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", fontFamily: "monospace" } }, fmt(ly.topDepth, 1)),
-            /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", color: "#14304a", fontWeight: 600 } }, meta.crit),
+            /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", color: "#16304F", fontWeight: 600 } }, meta.crit),
             /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", color: "#475569" } }, meta.ref),
             /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", fontSize: "8.5px", color: bad ? "#8a5a1f" : "#2f6f3e" } }, meta.cal));
@@ -7852,5 +8028,5 @@ function PrintReport({
     // ---- response profile table ----
     (pyRes.records && pyRes.records.length > 0) && /*#__PURE__*/React.createElement("div", { className: "rpt-avoid", style: { marginBottom: "6px" } },
-      /*#__PURE__*/React.createElement("div", { style: { fontFamily: "monospace", fontSize: "9.5px", fontWeight: 700, color: "#14304a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px" } },
+      /*#__PURE__*/React.createElement("div", { style: { fontFamily: "monospace", fontSize: "9.5px", fontWeight: 700, color: "#16304F", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px", borderBottom: "1px solid #cbd5e1", paddingBottom: "2px" } },
         "Response profile \u00b7 tabulated"),
       (() => {
@@ -7879,5 +8055,5 @@ function PrintReport({
   /*#__PURE__*/React.createElement("div", {
     className: "rpt-section rpt-pagebreak"
-  }, pyRes && pyRes.ok && pyRes.records && /*#__PURE__*/React.createElement("div", { style: { pageBreakInside: "avoid", marginBottom: "12px" } },
+  }, pyRes && pyRes.ok && pyRes.records && /*#__PURE__*/React.createElement("div", { className: "rpt-grp", style: { pageBreakInside: "avoid", marginBottom: "12px" } },
     /*#__PURE__*/React.createElement(RptHeading, { n: "02F", title: "Figures — Lateral Analysis (nonlinear p-y)" }),
     /*#__PURE__*/React.createElement("div", { style: { border: "1px solid #e2e8f0", padding: "6px", background: "#fff" } },
@@ -7889,5 +8065,5 @@ function PrintReport({
         /*#__PURE__*/React.createElement(Plot, {
           data: caseRes.rows.filter(r2 => r2.prof).map((r2, i) => {
-            const cols = ["#14304a", "#c9622e", "#2f6f3e", "#3d6a94", "#8a5a1f", "#7a4a7a"];
+            const cols = ["#16304F", "#c9622e", "#2f6f3e", "#3d6a94", "#8a5a1f", "#7a4a7a"];
             return { x: r2.prof.m, y: r2.prof.d, mode: "lines", line: { color: cols[i % 6], width: 1.6 }, name: r2.name, hoverinfo: "skip" };
           }),
@@ -7897,11 +8073,11 @@ function PrintReport({
       /*#__PURE__*/React.createElement("div", { style: { fontSize: "7.5px", color: "#94a3b8", marginTop: "2px" } },
         "Figure F-2: moment profiles, all LRFD load cases overlaid (per-case p-y solves)."))),
-  r.capDist && r.capDist.enable && /*#__PURE__*/React.createElement("div", { style: { marginBottom: "12px" } },
+  r.capDist && r.capDist.enable && /*#__PURE__*/React.createElement("div", { className: "rpt-grp", style: { marginBottom: "12px" } },
     /*#__PURE__*/React.createElement(RptHeading, { n: "11", title: "Pile Group \u2014 Rigid-Cap Load Distribution" }),
     /*#__PURE__*/React.createElement("div", { style: { fontSize: "8.5px", color: "#334", marginBottom: "4px" } },
       "Generalized elastic bolt-group statics (biaxial bending incl. product term S", /*#__PURE__*/React.createElement("sub", null, "xy"), "). ", r.capDist.nLoads, " load(s) resolved to the group centroid; rigid cap, identical vertical piles, pinned heads (axial + overturning; equal shear share)."),
-    /*#__PURE__*/React.createElement("div", { style: { fontSize: "8.5px", color: "#14304a", marginBottom: "3px" } },
+    /*#__PURE__*/React.createElement("div", { style: { fontSize: "8.5px", color: "#16304F", marginBottom: "3px" } },
       "Group: ", r.capDist.n, " piles \u00b7 centroid (", fmt(r.capDist.cx, 2), ", ", fmt(r.capDist.cy, 2), ") ft \u00b7 S", /*#__PURE__*/React.createElement("sub", null, "xx"), " = ", fmt(r.capDist.Sxx, 1), ", S", /*#__PURE__*/React.createElement("sub", null, "yy"), " = ", fmt(r.capDist.Syy, 1), ", S", /*#__PURE__*/React.createElement("sub", null, "xy"), " = ", fmt(r.capDist.Sxy, 1), " ft\u00b2"),
-    /*#__PURE__*/React.createElement("div", { style: { fontSize: "8.5px", color: "#14304a", marginBottom: "4px" } },
+    /*#__PURE__*/React.createElement("div", { style: { fontSize: "8.5px", color: "#16304F", marginBottom: "4px" } },
       "Resultant at centroid: \u03a3P = ", fmt(r.capDist.Pv, 1), " kip, \u03a3V = (", fmt(r.capDist.Vx, 1), ", ", fmt(r.capDist.Vy, 1), ") kip, \u03a3M", /*#__PURE__*/React.createElement("sub", null, "eff"), " = (", fmt(r.capDist.Mx_eff, 1), ", ", fmt(r.capDist.My_eff, 1), ") kip\u00b7ft (incl. shear\u00d7height and vertical\u00d7offset)."),
     r.capDist.capWt_incl && /*#__PURE__*/React.createElement("div", { style: { fontSize: "8px", color: "#64748b", marginBottom: "3px" } },
@@ -7919,19 +8095,19 @@ function PrintReport({
         /*#__PURE__*/React.createElement("td", { style: { padding: "2px 5px", textAlign: "right", color: "#64748b" } }, fmt(p.base, 1)),
         /*#__PURE__*/React.createElement("td", { style: { padding: "2px 5px", textAlign: "right", color: "#64748b" } }, (p.bend >= 0 ? "+" : "") + fmt(p.bend, 1)),
-        /*#__PURE__*/React.createElement("td", { style: { padding: "2px 5px", textAlign: "right", fontWeight: 600, color: p.axial < 0 ? "#b23b3b" : "#14304a" } }, fmt(p.axial, 1)),
+        /*#__PURE__*/React.createElement("td", { style: { padding: "2px 5px", textAlign: "right", fontWeight: 600, color: p.axial < 0 ? "#B91C1C" : "#16304F" } }, fmt(p.axial, 1)),
         /*#__PURE__*/React.createElement("td", { style: { padding: "2px 5px", textAlign: "right", color: "#64748b" } }, fmt(p.Vres, 1))))),
       /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", { style: { borderTop: "1px solid #94a3b8", fontWeight: 600 } },
         /*#__PURE__*/React.createElement("td", { colSpan: 5, style: { padding: "2px 5px" } }, "Max compression / max uplift"),
         /*#__PURE__*/React.createElement("td", { style: { padding: "2px 5px", textAlign: "right" } }, fmt(r.capDist.maxComp, 1)),
-        /*#__PURE__*/React.createElement("td", { style: { padding: "2px 5px", textAlign: "right", color: r.capDist.anyUplift ? "#b23b3b" : "#14304a" } }, fmt(r.capDist.maxUplift, 1))))),
+        /*#__PURE__*/React.createElement("td", { style: { padding: "2px 5px", textAlign: "right", color: r.capDist.anyUplift ? "#B91C1C" : "#16304F" } }, fmt(r.capDist.maxUplift, 1))))),
     /*#__PURE__*/React.createElement("div", { style: { fontSize: "7.5px", color: "#94a3b8", marginTop: "3px" } },
       "\u25c9 = design pile (checks run against this). ", r.capDist.anyUplift ? "Uplift present \u2014 verify tension/uplift. " : "", "Working-load elastic distribution; for flexible caps or battered piles use a full group model."),
     I.loadFromGroup && /*#__PURE__*/React.createElement("div", { style: { fontSize: "8px", color: "#8a5a1f", marginTop: "3px", fontWeight: 600 } },
       "Load cases in this report are driven by the group: design pile #", r.capDist.selId, " axial = ", fmt(r.capDist.sel.axial, 1), " kip, shear = ", fmt(r.capDist.sel.Vres, 1), " kip, M", /*#__PURE__*/React.createElement("sub", null, "head"), " = 0.")),
-  /*#__PURE__*/React.createElement(RptHeading, {
+  /*#__PURE__*/React.createElement("div", { className: "rpt-grp" }, /*#__PURE__*/React.createElement(RptHeading, {
     n: "S",
     title: "Summary of Results"
   }), caseRes && caseRes.rows && /*#__PURE__*/React.createElement("div", { style: { marginBottom: "10px" } },
-    /*#__PURE__*/React.createElement("div", { style: { fontSize: "9px", fontWeight: 700, color: "#14304a", marginBottom: "3px" } },
+    /*#__PURE__*/React.createElement("div", { style: { fontSize: "9px", fontWeight: 700, color: "#16304F", marginBottom: "3px" } },
       "LRFD LOAD-CASE ENVELOPE (each case: own p-y analysis and \u03c6 set; Extreme Event \u03c6=1.0, uplift 0.8, AASHTO 10.5.5.3)"),
     /*#__PURE__*/React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: "8.5px" } },
@@ -7945,5 +8121,5 @@ function PrintReport({
         /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px" } }, r0.y0 != null ? fmt(r0.y0, 3) : "\u2014"),
         ["geoR", "flexR", "combR", "buckR"].map((k, j) => /*#__PURE__*/React.createElement("td", { key: j, style: { padding: "2px 4px" } }, r0[k] != null ? fmt(r0[k], 2) : "\u2014")),
-        /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", fontWeight: 700, color: r0.pass ? "#2f6f3e" : "#b23b3b" } }, r0.pass ? "PASS" : "FAIL"))))),
+        /*#__PURE__*/React.createElement("td", { style: { padding: "2px 4px", fontWeight: 700, color: r0.pass ? "#2f6f3e" : "#B91C1C" } }, r0.pass ? "PASS" : "FAIL"))))),
     /*#__PURE__*/React.createElement("div", { style: { fontSize: "7.5px", color: "#94a3b8", marginTop: "2px" } },
       "Envelope computed " + caseRes.at + ". Service rows report deflection only. The detailed module calculations that follow reflect the ACTIVE case.")),
@@ -7955,6 +8131,7 @@ function PrintReport({
   }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
     style: {
-      background: "#14304a",
-      color: "#fff"
+      background: "#DCE6F1",
+      color: "#16304F",
+      fontFamily: RPT_UI
     }
   }, /*#__PURE__*/React.createElement("th", {
@@ -8026,5 +8203,5 @@ function PrintReport({
       textAlign: "center",
       fontWeight: 700,
-      color: pass ? "#2f7d4f" : "#b23b3b"
+      color: pass ? "#047857" : "#B91C1C"
     }
   }, pass ? "OK" : "NG"))))), /*#__PURE__*/React.createElement("div", {
@@ -8032,9 +8209,9 @@ function PrintReport({
       marginTop: "10px",
       padding: "8px 12px",
-      border: `1.5px solid ${r.allPass ? "#2f7d4f" : "#b23b3b"}`,
+      border: `1.5px solid ${r.allPass ? "#047857" : "#B91C1C"}`,
       fontSize: "12px",
       fontFamily: serif
     }
-  }, /*#__PURE__*/React.createElement("b", null, "Conclusion:\xA0"), r.allPass ? (I.pileType === "iab" ? "The integral abutment pile satisfies the MassDOT Simplified Method: all \u00a73.10.11.1 boundary conditions are met and the factored gravity load per pile is within the tabulated capacity. Pile tip elevation shall be set at the required length shown; thermal/skew effects are embedded in the tabulated Pu per \u00a73.10.11.3." : I.pileType === "hpile" ? "All evaluated strength and geotechnical checks are satisfied for the driven H-pile as designed. Nominal geotechnical resistance is to be field-verified by dynamic testing / driving criteria per the resistance factors used." : "All evaluated strength and load-test checks are satisfied for the micropile as designed. Geotechnical bond resistance is to be confirmed by the specified verification and proof load tests.") : (I.pileType === "iab" ? "The Simplified Method is not satisfied \u2014 either a boundary condition fails (requiring the 3D Space Frame Analysis Method, \u00a73.10.11.5) or the gravity demand exceeds the tabulated capacity (requiring a larger section or more piles). Revise before sealing." : "One or more checks require review (marked NG above). The design must be revised until all applicable checks are satisfied before this package is sealed."))), /*#__PURE__*/React.createElement("div", {
+  }, /*#__PURE__*/React.createElement("b", null, "Conclusion:\xA0"), r.allPass ? (I.pileType === "iab" ? "The integral abutment pile satisfies the MassDOT Simplified Method: all \u00a73.10.11.1 boundary conditions are met and the factored gravity load per pile is within the tabulated capacity. Pile tip elevation shall be set at the required length shown; thermal/skew effects are embedded in the tabulated Pu per \u00a73.10.11.3." : I.pileType === "hpile" ? "All evaluated strength and geotechnical checks are satisfied for the driven H-pile as designed. Nominal geotechnical resistance is to be field-verified by dynamic testing / driving criteria per the resistance factors used." : "All evaluated strength and load-test checks are satisfied for the micropile as designed. Geotechnical bond resistance is to be confirmed by the specified verification and proof load tests.") : (I.pileType === "iab" ? "The Simplified Method is not satisfied \u2014 either a boundary condition fails (requiring the 3D Space Frame Analysis Method, \u00a73.10.11.5) or the gravity demand exceeds the tabulated capacity (requiring a larger section or more piles). Revise before sealing." : "One or more checks require review (marked NG above). The design must be revised until all applicable checks are satisfied before this package is sealed.")))), /*#__PURE__*/React.createElement("div", {
     style: {
       marginTop: "14px",
@@ -8046,5 +8223,5 @@ function PrintReport({
       lineHeight: 1.5
     }
-  }, "Computed checks follow AASHTO LRFD Bridge Design Specifications and FHWA NHI-05-039 methodology. This calculation package is a design aid; all results, assumptions, and input load effects must be independently verified and sealed by a licensed Professional Engineer prior to use for construction. " + (I.pileType === "hpile" ? "Nominal geotechnical resistances are from static analysis and must be field-verified by dynamic testing / driving criteria (AASHTO Table 10.5.5.2.3-1)." : "Bond values are preliminary (AASHTO Table C10.9.3.5.2-1) and must be confirmed by load testing.") + " — ", I.projNum, " · ", today));
+  }, "Computed checks follow AASHTO LRFD Bridge Design Specifications and FHWA NHI-05-039 methodology. This calculation package is a design aid; all results, assumptions, and input load effects must be independently verified and sealed by a licensed Professional Engineer prior to use for construction. " + (I.pileType === "hpile" ? "Nominal geotechnical resistances are from static analysis and must be field-verified by dynamic testing / driving criteria (AASHTO Table 10.5.5.2.3-1)." : "Bond values are preliminary (AASHTO Table C10.9.3.5.2-1) and must be confirmed by load testing.") + " — ", I.projNum, " · ", today)));
 }
 
@@ -8456,5 +8633,5 @@ function LoadCasesCard({ cases, updCases, applyCase, runAllCases, caseRes, I, up
   const wG = worst('geoR'), wF = worst('flexR'), wC = worst('combR'), wB = worst('buckR');
   const fmtR = v => v == null ? "—" : fmt(v, 2);
-  return /*#__PURE__*/React.createElement("div", { className: "rounded-sm border border-slate-300 bg-white p-3 mb-4" },
+  return /*#__PURE__*/React.createElement("div", { className: "rounded-sm border border-slate-300 bg-white p-3 mb-4", "data-otab-fixed": "summary" },
     /*#__PURE__*/React.createElement("div", { className: "flex items-center justify-between mb-1" },
       /*#__PURE__*/React.createElement("span", { className: "text-[11px] font-mono-tech text-[var(--blueprint)] uppercase tracking-wider" }, "LRFD load cases"),
@@ -8602,5 +8779,5 @@ function UtilizationDashboard({ r, I }) {
   const gov = rows.length ? rows[0] : null;
   const barColor = d => d > 1.0 ? "#b23b3b" : d > 0.85 ? "#c9622e" : d > 0.6 ? "#8a6d1f" : "#2f6f3e";
-  return /*#__PURE__*/React.createElement("div", { className: "bg-white rounded-md border border-slate-200 card-sh p-3" },
+  return /*#__PURE__*/React.createElement("div", { className: "bg-white rounded-md border border-slate-200 card-sh p-3", "data-otab-fixed": "summary" },
     /*#__PURE__*/React.createElement("div", { className: "flex items-baseline justify-between mb-2" },
       /*#__PURE__*/React.createElement("div", { className: "text-[11px] font-mono-tech text-[var(--blueprint)] uppercase tracking-wider" }, "Summary of checks · demand / capacity"),
@@ -8634,4 +8811,5 @@ function UtilizationDashboard({ r, I }) {
 function jumpToModule(id) {
   const s = document.getElementById(id); if (!s) return false;
+  showOutTabOf(s); // output tabs: select the module's tab first
   const t = s.querySelector(".module-toggle");
   if (t && t.getAttribute("aria-expanded") === "false") t.click();
@@ -10848,4 +11026,8 @@ function App() {
   const [cycInfoOpen, setCycInfoOpen] = useState(false);
   const [previewReport, setPreviewReport] = useState(false);
+  // UI: print-section chooser (per-browser selection, not project data)
+  const [printDlg, setPrintDlg] = useState(false);
+  const [rptSel, setRptSelState] = useState(() => loadRptSel());
+  const setRptSel = v => { setRptSelState(v); saveRptSel(v); };
   // UI: active tab of the left input rail (presentation state, not an input)
   const [railTab, setRailTab] = useState("pile");
@@ -10872,5 +11054,6 @@ function App() {
     setTimeout(() => {
       const el = document.getElementById("module-" + (domIdx != null ? domIdx : openKey));
-      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
+      if (el) showOutTabOf(el); // output tabs: select the module's tab first
+      if (el && el.scrollIntoView) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
     }, 60);
   };
@@ -11048,8 +11231,23 @@ function App() {
   const ALL_MODULES = [1, 2, 3, 4, 5, 55, 6, 7, 8, 9, 10, 11];
   function printReport() {
+    // UI: every print button opens the print-section chooser first.
+    setPrintDlg(true);
+  }
+  function doPrint() {
     // The PrintReport component renders independently of the on-screen modules,
-    // so we can print directly.
-    window.print();
+    // so we can print directly (after the chooser closes and the report is fitted).
+    setPrintDlg(false);
+    setTimeout(() => { fitPrintReport(); window.print(); }, 60);
   }
+  useEffect(() => {
+    const f = () => fitPrintReport();
+    window.addEventListener("beforeprint", f);
+    return () => window.removeEventListener("beforeprint", f);
+  }, []);
+  useEffect(() => {
+    if (!previewReport) return;
+    const t = setTimeout(() => fitPrintReport(document.querySelector(".report-preview-show .print-only")), 400);
+    return () => clearTimeout(t);
+  }, [previewReport, rptSel]);
 
   // ---- LPILE file import ----
@@ -12269,5 +12467,6 @@ function App() {
     caseRes: caseRes,
     pyRes: pyRes,
-    pcr: pcr
+    pcr: pcr,
+    sel: rptSel
   }))), /*#__PURE__*/React.createElement(PrintReport, {
     I: I,
@@ -12275,5 +12474,13 @@ function App() {
     caseRes: caseRes,
     pyRes: pyRes,
-    pcr: pcr
+    pcr: pcr,
+    sel: rptSel
+  }), /*#__PURE__*/React.createElement(PrintChooser, {
+    open: printDlg,
+    sel: rptSel,
+    setSel: setRptSel,
+    onClose: () => setPrintDlg(false),
+    onPrint: doPrint,
+    onPreview: () => { setPrintDlg(false); setPreviewReport(true); window.scrollTo(0, 0); }
   }), /*#__PURE__*/React.createElement("div", {
     className: "app-shell",
@@ -13113,4 +13320,5 @@ function App() {
       className: "text-[10px] text-slate-500 mt-1.5 leading-snug"
     }, "Integral abutment pile mode — MassDOT Bridge Manual Part I \u00a73.10 Simplified Method. Single row of vertical H-piles (HP10\u00d757 or HP12\u00d784, Grade 50), webs parallel to the abutment, bending about the weak axis under thermal movement. Capacity is read from MassDOT's pre-computed tables (thermal + skew effects already embedded) \u2014 no p-y analysis required for the non-scour case. Sanity-check aid only \u2014 independent PE review required.")),
+  /*#__PURE__*/React.createElement(OutTabs, { pileType: I.pileType }),
   /*#__PURE__*/(I.pileType !== "iab") && /*#__PURE__*/React.createElement(LoadCasesCard, { cases: cases, updCases: updCases, applyCase: applyCase, runAllCases: runAllCases, caseRes: caseRes, I: I, updCasesLimit: v => { set('deflLimit', v); setCaseRes(null); }, activeIdx: activeIdx, setActive: i => set('activeCase', i), onRowEdit: (i, k, v) => {
     const next = cases.map((c, j) => j === i ? { ...c, [k]: v } : c);
@@ -15180,4 +15388,144 @@ function RailTabs({ tab, setTab, pileType }) {
 }
 
+/* ============================================================
+   OUTPUT TABS (UI only, 2026-10-10)
+   ------------------------------------------------------------
+   The output column is split into tabs. Every module stays rendered (the
+   check index, the report badges and the scroll targets read them); the
+   blocks of the other tabs are hidden with CSS, as the input rail does.
+   Anything that jumps to a module (check-index chips, summary rows, "apply
+   to Module 02") selects its tab first (showOutTabOf). The active tab is
+   remembered per browser in micropile_lrfd_outTab_v1 (not project data).
+============================================================ */
+const OUT_TAB_KEY = "micropile_lrfd_outTab_v1";
+const OUT_TABS = [["summary", "Summary"], ["geom", "Geometry & limits"], ["geo", "Geotechnical"], ["simp", "Simplified Method"], ["tier2", "Tier 2"], ["lat", "Lateral (p-y)"], ["struct", "Structural"], ["cap", "Cap & connection"], ["test", "Load test"], ["group", "Group"]];
+function outTabFor(el, pileType) {
+  const fx = el.getAttribute("data-otab-fixed"); if (fx) return fx;
+  const idx = el.getAttribute("data-module"); if (!idx) return null; // pile-type card, footer: always shown
+  if (idx === "G") return "geom";
+  if (pileType === "iab") return idx === "12" ? "tier2" : "simp";
+  if (idx === "01") return "geo";
+  if (idx === "09") return pileType === "hpile" ? "struct" : "geo";
+  if (idx === "02") return "lat";
+  if (idx === "06") return "cap";
+  if (idx === "07") return pileType === "hpile" ? "struct" : "cap";
+  if (idx === "08") return "test";
+  if (idx === "11") return "group";
+  return "struct"; // 03, 04, 05, 05b, 10
+}
+function readOutTab() { try { return window.localStorage.getItem(OUT_TAB_KEY) || "summary"; } catch (e) { return "summary"; } }
+function showOutTabOf(sec) {
+  const t = sec && sec.getAttribute("data-otab"), main = sec && sec.closest(".main-col");
+  if (!t || !main) return;
+  if (main.getAttribute("data-otab-active") !== t) main.setAttribute("data-otab-active", t);
+  if (window.__pdSetOutTab) window.__pdSetOutTab(t);
+}
+function OutTabs({ pileType }) {
+  const [tab, setTab] = React.useState(readOutTab);
+  const [present, setPresent] = React.useState([]);
+  const [ng, setNg] = React.useState({});
+  const ref = React.useRef(null);
+  const choose = React.useCallback(t => { setTab(t); try { window.localStorage.setItem(OUT_TAB_KEY, t); } catch (e) {} }, []);
+  React.useEffect(() => { window.__pdSetOutTab = choose; return () => { if (window.__pdSetOutTab === choose) window.__pdSetOutTab = null; }; }, [choose]);
+  React.useLayoutEffect(() => {
+    const strip = ref.current, main = strip && strip.parentElement; if (!main) return;
+    const has = {}, bad = {};
+    [...main.children].forEach(c => {
+      if (c === strip) return;
+      const t = outTabFor(c, pileType);
+      if (t) { if (c.getAttribute("data-otab") !== t) c.setAttribute("data-otab", t); has[t] = true; if (c.getAttribute("data-status") === "ng") bad[t] = true; }
+      else if (c.hasAttribute("data-otab")) c.removeAttribute("data-otab");
+    });
+    const ids = OUT_TABS.map(x => x[0]).filter(id => has[id]);
+    const now = ids.indexOf(tab) >= 0 ? tab : (ids[0] || "summary");
+    if (main.getAttribute("data-otab-active") !== now) main.setAttribute("data-otab-active", now);
+    const k1 = ids.join("|"), k2 = JSON.stringify(bad);
+    setPresent(p => p.join("|") === k1 ? p : ids);
+    setNg(p => JSON.stringify(p) === k2 ? p : bad);
+  });
+  React.useEffect(() => {
+    const el = ref.current; if (!el) return;
+    const apply = () => document.documentElement.style.setProperty("--ot-h", Math.ceil(el.getBoundingClientRect().height) + "px");
+    apply();
+    if (!("ResizeObserver" in window)) return;
+    const ro = new ResizeObserver(apply); ro.observe(el); return () => ro.disconnect();
+  }, []);
+  const cur = present.indexOf(tab) >= 0 ? tab : (present[0] || "summary");
+  const pick = (id, focus) => {
+    choose(id);
+    const strip = ref.current;
+    // if the page is scrolled past the top of the tabs, bring the new tab's top into view
+    if (strip && strip.previousElementSibling) {
+      const top = parseFloat(getComputedStyle(strip).top) || 0;
+      const y = strip.previousElementSibling.getBoundingClientRect().bottom + window.scrollY - top;
+      if (window.scrollY > y) window.scrollTo({ top: y, behavior: "auto" });
+    }
+    if (focus) setTimeout(() => { const b = document.getElementById("otab-" + id); if (b) b.focus(); }, 0);
+  };
+  const onKey = (e, i) => {
+    let j = null;
+    if (e.key === "ArrowRight") j = (i + 1) % present.length;
+    else if (e.key === "ArrowLeft") j = (i - 1 + present.length) % present.length;
+    else if (e.key === "Home") j = 0;
+    else if (e.key === "End") j = present.length - 1;
+    if (j == null) return;
+    e.preventDefault(); pick(present[j], true);
+  };
+  const label = id => (OUT_TABS.find(x => x[0] === id) || [id, id])[1];
+  return /*#__PURE__*/React.createElement("div", { ref: ref, className: "out-tabs no-print", role: "tablist", "aria-label": "Output sections" },
+    present.map((id, i) => /*#__PURE__*/React.createElement("button", {
+      key: id, id: "otab-" + id, type: "button", role: "tab", className: "out-tab",
+      "aria-selected": cur === id ? "true" : "false", tabIndex: cur === id ? 0 : -1,
+      title: ng[id] ? "A check on this tab is not satisfied" : undefined,
+      onClick: () => pick(id), onKeyDown: e => onKey(e, i)
+    }, label(id), ng[id] ? /*#__PURE__*/React.createElement("span", { className: "out-tab-dot", "aria-label": "(not satisfied)" }) : null)));
+}
+
+/* ============================================================
+   PRINT-SECTION CHOOSER (UI only, 2026-10-10)
+   ------------------------------------------------------------
+   Lists the report groups present for this pile type (read from the rendered
+   report headings). The choice is remembered per browser in
+   micropile_lrfd_printSel_v1 ({group: false} for an unticked group; nothing
+   stored = everything, which is what printed before). The title block, seal
+   box and sheet footers always print. Preview uses the same selection.
+============================================================ */
+function PrintChooser({ open, sel, setSel, onClose, onPrint, onPreview }) {
+  const [groups, setGroups] = React.useState([]);
+  const goRef = React.useRef(null);
+  React.useEffect(() => {
+    if (!open) return;
+    const seen = {}, list = [];
+    document.querySelectorAll(".print-only .rpt-h[data-rgrp]").forEach(h => {
+      const g = h.getAttribute("data-rgrp"), n = h.getAttribute("data-n");
+      if (!seen[g]) { seen[g] = { g, ns: [] }; list.push(seen[g]); }
+      if (seen[g].ns.indexOf(n) < 0) seen[g].ns.push(n);
+    });
+    list.sort((a, b) => RPT_GRP_ORDER.indexOf(a.g) - RPT_GRP_ORDER.indexOf(b.g));
+    setGroups(list);
+    const onKey = e => { if (e.key === "Escape") onClose(); };
+    document.addEventListener("keydown", onKey);
+    setTimeout(() => { if (goRef.current) goRef.current.focus(); }, 0);
+    return () => document.removeEventListener("keydown", onKey);
+  }, [open]);
+  if (!open) return null;
+  const setAll = v => { const n = { ...sel }; groups.forEach(x => { if (v) delete n[x.g]; else n[x.g] = false; }); setSel(n); };
+  return /*#__PURE__*/React.createElement("div", { className: "pd-prdlg-ov no-print", onClick: e => { if (e.target === e.currentTarget) onClose(); } },
+    /*#__PURE__*/React.createElement("div", { className: "pd-prdlg", role: "dialog", "aria-modal": "true", "aria-labelledby": "pdPrdlgT" },
+      /*#__PURE__*/React.createElement("h2", { id: "pdPrdlgT" }, "Print report — select contents"),
+      /*#__PURE__*/React.createElement("p", { className: "pd-prdlg-hint" }, "Use the browser’s print dialog to print or save as PDF. Your choice is remembered in this browser; it is not saved with the project."),
+      /*#__PURE__*/React.createElement("div", { className: "pd-prdlg-fixed" }, "Always printed: title block, PE seal box, sheet header and footer."),
+      groups.map(x => /*#__PURE__*/React.createElement("label", { key: x.g },
+        /*#__PURE__*/React.createElement("input", { type: "checkbox", checked: sel[x.g] !== false, onChange: e => { const n = { ...sel }; if (e.target.checked) delete n[x.g]; else n[x.g] = false; setSel(n); } }),
+        /*#__PURE__*/React.createElement("span", null, RPT_GRP_LABEL[x.g] || x.g, " ", /*#__PURE__*/React.createElement("span", { className: "pd-prdlg-ns" }, "(" + x.ns.join(", ") + ")")))),
+      /*#__PURE__*/React.createElement("div", { className: "pd-prdlg-row" },
+        /*#__PURE__*/React.createElement("button", { type: "button", className: "is-quiet", onClick: () => setAll(true) }, "All (default)"),
+        /*#__PURE__*/React.createElement("button", { type: "button", className: "is-quiet", onClick: () => setAll(false) }, "None")),
+      /*#__PURE__*/React.createElement("div", { className: "pd-prdlg-row" },
+        /*#__PURE__*/React.createElement("button", { ref: goRef, type: "button", className: "is-primary", onClick: onPrint }, "Print"),
+        /*#__PURE__*/React.createElement("button", { type: "button", onClick: onPreview }, "Preview report"),
+        /*#__PURE__*/React.createElement("button", { type: "button", onClick: onClose }, "Cancel"))));
+}
+
 /* ============================================================
    CHECK INDEX -- sticky strip under the title block (UI only)
@@ -15191,7 +15539,14 @@ function RailTabs({ tab, setTab, pileType }) {
 ============================================================ */
 function CheckIndex({ pileLabel, allPass, onSave, onPreview, previewing, onPrint, caseLabel }) {
+  // Expand / Collapse all act on the modules of the open output tab (on a tab
+  // with no modules, e.g. Summary, on every module).
   const setAll = (wantOpen) => {
-    document.querySelectorAll(".app-shell section[data-module] .module-toggle").forEach(t => {
-      if ((t.getAttribute("aria-expanded") === "true") !== wantOpen) t.click();
+    const main = document.querySelector(".app-shell .main-col");
+    const act = main && main.getAttribute("data-otab-active");
+    const secs = [...document.querySelectorAll(".app-shell section[data-module]")];
+    const onTab = secs.filter(s => s.getAttribute("data-otab") === act);
+    (onTab.length ? onTab : secs).forEach(s => {
+      const t = s.querySelector(".module-toggle");
+      if (t && (t.getAttribute("aria-expanded") === "true") !== wantOpen) t.click();
     });
   };
@@ -15284,6 +15639,6 @@ function CheckIndex({ pileLabel, allPass, onSave, onPreview, previewing, onPrint
             /*#__PURE__*/React.createElement("span", { className: "sr-only" }, it.title + (it.status === "ok" ? ", OK" : it.status === "ng" ? ", not satisfied" : "")))))),
       /*#__PURE__*/React.createElement("div", { className: "ci-actions" },
-        /*#__PURE__*/React.createElement("button", { type: "button", className: "ci-btn ci-btn-quiet", onClick: () => setAll(true) }, "Expand all"),
-        /*#__PURE__*/React.createElement("button", { type: "button", className: "ci-btn ci-btn-quiet", onClick: () => setAll(false) }, "Collapse all"),
+        /*#__PURE__*/React.createElement("button", { type: "button", className: "ci-btn ci-btn-quiet", onClick: () => setAll(true), title: "Open every module on the open output tab (on the Summary tab: every module)" }, "Expand all"),
+        /*#__PURE__*/React.createElement("button", { type: "button", className: "ci-btn ci-btn-quiet", onClick: () => setAll(false), title: "Close every module on the open output tab (on the Summary tab: every module)" }, "Collapse all"),
         /*#__PURE__*/React.createElement("button", { type: "button", className: "ci-btn", onClick: onSave }, "Save .json"),
         /*#__PURE__*/React.createElement("button", { type: "button", className: "ci-btn", onClick: onPreview, "aria-pressed": !!previewing }, previewing ? "Close preview" : "Preview report"),
```

## Open items (not changed)
- O1. **Uncased/cased structural axial: outer 0.85 factor and `fy = min(fyb, fyc)`** (`Rn_cased/Rn_ucased`, ≈ line 1675).
  - Neither AASHTO 10.9.3.10.2 nor FHWA NHI-05-039 Eq. 5-13 has the outer 0.85, and the uncased section has no casing, so min(fyb, fyc) is arbitrary there.
  - Both are conservative, and there is no strain-compatibility cap at about 87 ksi.
  - Not changed (calc change needs a decision). **Engineer to confirm:** keep the 0.85 as a disclosed deviation, or remove it? Should the uncased section use fyb, limited by strain compatibility?
- O2. **Casing tension through threaded joints.** `phiPn_tension_total` counts the full corroded casing area. FHWA advises neglecting casing in tension unless the joint capacity is documented. `phiT` defaults to 0.90.
  - Potentially unconservative.
  - **Needs:** a decision whether to drop the casing term (or add a joint-efficiency input), and the micropile tension φ from Table 10.5.5.2.5-2 / 10.9.3.10.
- O3. **Uncased flexure location.** It is checked only at the casing tip (`M_belowTip`), with φ = 0.90; the comment says 6.5.4.2, which gives 1.00.
  - Larger moments below the tip are missed when typed-in LPILE values are used (unconservative).
  - **Needs:** a decision on using the moment envelope below the tip.
- O4. **CFST:** the p-y `EI_aashto` uses the cap f′c (`I.fc`) and ACI Ec = 57√f′c, while `computeAll` uses `fcGrout` and the AASHTO Ec = 2500f′c^0.33. `Mr_cfst` applies φc to the moment ordinate.
  - Not changed (it alters the lateral analysis EI).
  - **Needs:** confirmation of which f′c/Ec apply, and of 6.9.6.3.4 for the φ on M.
- O5. **H-pile clay tip φ.** The tip in clay uses the clay factor 0.35 (now `hpPhiGeoClay`). Table 10.5.5.2.3-1 lists 0.40 for clay tip (Skempton).
  - Conservative.
  - **Ask:** add a separate tip φ (0.40)?
- O6. **SVL service axial check.** SVL is entered but no service settlement or elastic-shortening check exists (10.9.2 service).
  - **Needs:** a scope decision.
- O7. **Multi-case LPILE import.** `parseLpileText` takes only the first load case.
  - **Needs:** a decision on the UI for picking or enveloping cases.
- O8. **H-pile φc for good driving.** The task brief said "0.70 good driving". AASHTO 6.5.4.2 (as I read the 9th/10th Ed.) gives 0.60 for good-driving axial (no pile tip) and 0.70 for combined axial + flexure of undamaged piles.
  - The defaults are 0.60 axial / 0.70 combined, which equal what the calc always used.
  - **Engineer to confirm.**
- O9. **H-pile small-group 0.80 reduction.** It is applied to static-analysis φ (`grpFac`). In AASHTO this reduction is tied to specific verification methods.
  - **Confirm** that it applies here.
- O10. **Linear (Winkler) solver with layers missing `nh`/`kh`** (`subgradeAt`: `L.nh || 0` → zero soil; `analysisDepth`).
  - New imports now keep or backfill `nh`/`kh` (F6), but layers saved by the old importer still give zero stiffness in that legacy solver.
  - Not changed: outside the listed scope, and the linear solver is not the design basis.
- O11. **`phiV` (steel shear)** is now applied by no micropile check (punching uses `phiVpunch`). It is kept so that saved data and presets are unchanged.
  - **Ask:** hide it, or relabel it?
- O12. **Saved projects with `fyb = 150`** keep 150; the code cannot tell an intentional value from an old catalog pick. A red warning appears under the bar selector.
  - **Ask:** should load auto-convert 150 → 120 for an area that matches a Gr150 catalog bar?
- O13. **In-session blank fields still compute with NaN** (fail, without explanation) until reload. Only the reload path was in scope.
- O14. **Punching citation.** The summary table row "Punching shear" still cites "5.8.4" (an old article number). The code comment now says 5.12.8.6.3.
  - Not changed (a code reference change needs sign-off).
  - **Confirm** relabelling it to 5.12.8.6.3.
- O15. **Punching `bo2` leg length.** It uses d_edge as the pile-centre-to-edge distance, consistent with the bearing A2 calculation. If "Edge dist" is measured from the pile face instead, the legs are short by OD/2.
  - **Confirm** how the edge distance is measured.
- O16. **H-pile geotechnical capacity is 0 at the defaults.** Found in the 2026-10-10 review.
  - The soil layer carried over from the micropile mode has no SPT N, so the sand SPT method gives qs = qp = 0 and φRn = 0 kip against STL = 86 kip.
  - The summary row "Geotech axial (tip+skin)" shows "0.00 ✗": an empty bar for a failing check.
  - **Ask:** require N (or warn) in H-pile mode, and show "capacity 0 — NG" instead of a 0.00 ratio.
- O17. **Integral abutment: eligibility shown as a ratio.** The summary shows "Simplified-Method eligibility 2.00 ✗" for a pass/fail eligibility.
  - Blank/0 bridge length and abutment height show ✗ with no "enter a value" hint: `(I.iabBridgeLength || 0) > 0 && …`, ≈ line 3528.
  - **Ask:** show eligible / not eligible, plus a hint for missing inputs.
- O18. **Integral abutment, Module 01 §4: equation does not render.** The "Required pile length" line shows raw KaTeX source in red: `\text{(governs: fixity (L_f + 5 ft))}`; the `_` inside `\text` fails. The value is correct. Equation-text fix pending sign-off.
- O19. **H-pile mode, Module 02 elevation plot shows micropile geometry.** It draws "casing tip" and "bond 27 ft", and the text line reports "M at casing tip …".
  - **Ask:** hide these for H-piles.
- O20. **φc default 0.80** (`DEFAULT_INPUTS.phiC`). It is used in the casing-only combined interaction (Module 05) and in buckling.
  - AASHTO LRFD 10th Ed. 6.5.4.2 gives 0.95 (steel-only) and 0.90 (composite). The tool's own φ info says "resolve which applies before sealing".
  - The default is conservative.
  - **Engineer to confirm** the basis.
- O21. **"UNVERIFIED" φ labels.** The H-pile banner "⚠ UNVERIFIED φ — driven-pile module, confirm vs AASHTO 10th Ed before use" and the PHI_INFO notes "VALUE UNVERIFIED" (micropile φcc, φcu and uplift) are still shown, although F3 set the H-pile defaults to AASHTO values.
  - **Ask:** confirm the values and remove or relabel, or keep.
- O22. **Report, Assumptions & Design Notes (micropile): the bond-value item prints a line break and the word "beta".** The `RTex` call has `tex: "\\\\beta"`, which reaches KaTeX as `\\beta` (a line break, then text "beta") instead of β. Found in the 2026-10-10 output/print work; text in an equation, so listed rather than changed.
- O23. **The printed report has no section for the Module G code-limit checks** (uncased flexure below the casing tip, minimum bond length, plunge, cover). On screen Module G is NG at the micropile defaults (uncased flexure D/C 1.34), but the report only lists materials and geometry under G, and the Summary of Results table has no uncased-flexure row. **Ask:** add the G checks to the report (new report content).
