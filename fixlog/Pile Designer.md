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
