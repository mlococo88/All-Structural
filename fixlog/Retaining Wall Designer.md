# Fix log — Retaining Wall Designer.html

Governing basis used for fixes: AASHTO LRFD 10th Ed. (2024); ACI 318-19. MassDOT-specific items are unchanged.

## 2026-10-04 — PR: claude/fix-retaining-wall (PR link added after merge)

Line numbers are approximate, as of this fix. Search for the anchor text. The file uses CRLF line endings; keep them.

### F1. SI toggle disabled (engine is US-only)   [bug fix] [no result change in US mode]
- **Decision:** disable the toggle; do not convert in `getInputs`.
- **Why:** converting in `getInputs` cannot be made fully correct:
  - Only 24 fields were ever converted. `gamma_sat`, `el_tow`, `el_gw`, `bar_w`, `aashto_qR`, `aashto_heq`, `vh_hlo`/`vh_hhi` and the CT inputs stay US.
  - Every output, plot and report is printed in US units.
  - The in-place conversion rounds (fy → 414 MPa → 60,043 psi on the way back), so a round trip changes the inputs.
- **Where:**
  - Header button `data-units="SI"`.
  - `toggleUnits()` (≈ line 7953). Anchor: `function toggleUnits() {`.
  - `scheduleAutosave()` (≈ line 5146).
  - `restoreSession()` (≈ line 5180).
- **Before:**
  ```js
  <button type="button" data-units="SI" aria-pressed="false" title="SI metric (m, mm, kN, MPa)">SI</button>
  function toggleUnits() {
    const toSI = (_units === 'US');
    _units = toSI ? 'SI' : 'US';
  ...
        localStorage.setItem(AUTO_KEY, JSON.stringify({ fields: snapshotFields(), ts: Date.now(), name }));
  ...
      if (auto && auto.fields) {
        restoreFields(auto.fields);
  ```
- **After:**
  ```js
  <button type="button" data-units="SI" aria-pressed="false" disabled title="SI mode is disabled: the calculation engine works in US customary units only. Enter all inputs in ft, in, lb, psi.">SI</button>
  function toggleUnits() {
    const toSI = (_units === 'US');
    if (toSI) { alert('SI units are disabled in this version: ...'); return; }
    _units = toSI ? 'SI' : 'US';
  ...
        const units = (typeof _units !== 'undefined') ? _units : 'US';   // optional field (absent in older autosaves)
        localStorage.setItem(AUTO_KEY, JSON.stringify({ fields: snapshotFields(), ts: Date.now(), name, units }));
  ...
      if (auto && auto.fields) {
        restoreFields(auto.fields);
        if (auto.units === 'SI' && typeof UNIT_DEFS !== 'undefined') {
          Object.entries(UNIT_DEFS).forEach(([id, def]) => {
            const el = document.getElementById(id);
            if (!el) return;
            const v = parseFloat(el.value);
            if (!isNaN(v) && v !== 0) el.value = parseFloat((v / def.k).toFixed(def.dUS + 2));
          });
        }
  ```
- **Saved data:**
  - The autosave key `retaincalcpro.autosave.v1` is unchanged. It gains one optional field, `units`.
  - Old autosaves have no tag and cannot be identified as SI, so they are restored as is.
  - An autosave tagged `'SI'` is converted back to US. Nothing writes `'SI'` now; this is a safety net only.
  - Project saves and JSON exports are unchanged.
- **Check case (node, stubbed DOM):**
  - Clicking SI → `_units` stays `'US'`, f'c stays 4000 and Hs stays 12; one alert is shown. Before: f'c became 27.6 and Hs became 3.66, and both were read as psi and ft.
  - An SI-tagged autosave {fc 27.6, Hs 3.66, fy 414} restores as 4002.9 / 12.008 / 60043.5.
  - An untagged autosave restores unchanged.
- **Other copies:** none known.

### F2. Coulomb thrust inclined at δ + batter, not β   [calc change] [more conservative when β > 0; ⚠ LESS conservative when δ > 0 or batter > 0]
- **Where:** `calcAll`, earth-pressure block (≈ line 1690). Anchor: `const Pa_tri_h`. The display "Horizontal component …" (≈ line 3929) and the return object (`Pa_incl_deg, coulombThrust`) were updated to match.
- **Problem:** the components were always `Pa·cos β` and `Pa·sin β`. For AASHTO Coulomb active, the resultant acts at δ to the normal of the back plane, that is at δ + ω (batter) from horizontal. With δ = 0 and β = 20° the horizontal thrust was 6% low, and a spurious stabilising vertical force at the heel was credited.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.11.5.3, Fig. 3.11.5.3-1.
- **Before:**
  ```js
    const Pa_tri_h      = Pa_tri * Math.cos(b_r);
    const Pa_tri_v      = Pa_tri * Math.sin(b_r);
  ```
- **After:**
  ```js
    const coulombThrust = isAASHTO && A.ep_method === 'coulomb' && A.ep_cond !== 'atrest';
    const Pa_incl_deg   = coulombThrust ? (A.delta || 0) + (A.batter || 0) : inp.beta;
    const Pa_incl_r     = toRad(Pa_incl_deg);
    const Pa_tri_h      = Pa_tri * Math.cos(Pa_incl_r);
    const Pa_tri_v      = Pa_tri * Math.sin(Pa_incl_r);
  ```
  Rankine and at-rest are unchanged (still β).
- **Check case:** AASHTO, Coulomb active, φ = 30°, δ = 0, β = 20°, batter 0, default wall. Ka = 0.4411, H' = 16.594 ft, Pa = ½(0.4411)(120)(16.594²) = 7287 lb/ft.

  | Quantity | Before | After |
  |---|---|---|
  | Pa,H | 6848 (= 7287 cos 20°) | 7287 |
  | Pa,V | 2492 | 0 |
  | Sliding DCR | 2.024 | 2.413 |
  | e | 2.64 ft (passes B/4 = 3.125) | **4.10 ft (fails)** |
  | Bearing q_u | 2998 psf | 3260 psf |

- **⚠ Less-conservative direction:** with δ = 20°, β = 0 the old code had Pa,V = 0.
  - Before: Pa,H = 3251, sliding DCR 1.262, e = 1.135 ft.
  - After: Pa,H = 3055 (= 3251 cos 20°), Pa,V = 1112. Sliding DCR 1.141, e = 0.625 ft.
  - This is the correct Coulomb statics. Note the existing on-screen warning that δ > 0 on a long heel acts on a soil-soil plane, where Rankine (δ = β) is appropriate.
- **How verified:** node run of `calcAll`, before and after.

### F3. Coulomb passive Kp at the toe: level ground, vertical face, δ = 0   [calc change] [more conservative]
- **Where:** `calcAll` (≈ line 1640). Anchor: `calcKpCoulomb(inp.phi,`
- **Problem:** passive at the toe used the backfill slope β, the back batter and the back-face δ. With φ = 30° and β = 20°, Kp rose from 3.00 to 5.74.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.11.5.4. Coulomb Kp is unconservative as δ grows, so δ = 0 is used, per the brief: "if unsure use δ = 0".
- **Before:** `? calcKpCoulomb(inp.phi, A.delta, inp.beta, A.batter)`
- **After:** `? calcKpCoulomb(inp.phi, 0, 0, 0)`, which equals the Rankine tan²(45 + φ/2).
- **Check case:** AASHTO Coulomb, φ = 30°, β = 20°, passive on, Df = 1.5 ft.
  - Before: Kp 5.737, Pp 774.5 lb/ft, φep·Pp 387.3.
  - After: Kp 3.000, Pp 405.0, φep·Pp 202.5.
  - Hand check: 0.5 × 3 × 120 × 1.5² = 405.

### F4. Vertical EH component factored with γEH (max/min), not γEV   [calc change] [more conservative]
- **Where:** AASHTO block of `calcAll`: `V_resist_min`, `V_str_min`, `Mr_str_min`, `V_str_max_tot` and `Mr_str_max_tot` (≈ lines 1940–1970). Displays (Steps 3, 4, 5 and 6, and the report table and §4.2/§4.4) now show V_EH,v separately. `V_EV` is unchanged as a variable.
- **Problem:** Pa,V was lumped into EV: 1.00 at the minimum (should be EH min 0.90) and 1.35 at the maximum (should be EH max 1.50 active / 1.35 at-rest).
- **Governing provision:** AASHTO LRFD 10th Ed. Table 3.4.1-2 (EH active 1.50/0.90, at-rest 1.35/0.90; EV 1.35/1.00).
- **Before:**
  ```js
      const V_resist_min = 0.90*(V_DC + W_bar) + 1.00*V_EV + 0*V_LS_v - V_up;
      const V_str_min = 0.90*(V_DC + W_bar) + 1.00*V_EV - V_up;
      const Mr_str_min = 0.90*(Wftg*x_ftg + Wstem*x_stem + W_bar*x_bar) + 1.00*Pa_tri_v*B + 1.00*Wsoil*x_soil - M_up;
      const V_str_max_tot = eta * (1.25*V_DC + 1.35*V_EV + 1.75*V_LS_v + 1.25*W_bar) + V_col;
      const Mr_str_max_tot = eta * (1.25*(Wftg*x_ftg + Wstem*x_stem + W_bar*x_bar) + 1.35*(Wsoil*x_soil + Pa_tri_v*B)
                       + 1.75*V_LS_v*xLSv) + V_col*x_col;
  ```
- **After:**
  ```js
      const gEH_min = 0.90;
      const V_resist_min = 0.90*(V_DC + W_bar) + 1.00*Wsoil + gEH_min*Pa_tri_v + 0*V_LS_v - V_up;
      const V_str_min = 0.90*(V_DC + W_bar) + 1.00*Wsoil + gEH_min*Pa_tri_v - V_up;
      const Mr_str_min = 0.90*(Wftg*x_ftg + Wstem*x_stem + W_bar*x_bar) + gEH_min*Pa_tri_v*B + 1.00*Wsoil*x_soil - M_up;
      const V_str_max_tot = eta * (1.25*V_DC + 1.35*Wsoil + gEH_max*Pa_tri_v + 1.75*V_LS_v + 1.25*W_bar) + V_col;
      const Mr_str_max_tot = eta * (1.25*(Wftg*x_ftg + Wstem*x_stem + W_bar*x_bar) + 1.35*Wsoil*x_soil + gEH_max*Pa_tri_v*B
                       + 1.75*V_LS_v*xLSv) + V_col*x_col;
  ```
  The Extreme Event II block (MassDOT, γ = 1.0) is unchanged.
- **Check case:** AASHTO Rankine, φ = 30°, β = 20°, default wall. Pa,V = 2340.5 lb/ft.

  | Quantity | Before | After | Hand check |
  |---|---|---|---|
  | V_resist,min | 19994.6 | 19760.5 | Δ = −0.10 × 2340.5 = −234.1 |
  | Sliding DCR | 1.9155 | 1.9382 | |
  | e | 2.418 ft | 2.520 ft | |
  | V_str,max | 32167.8 | 32518.9 | Δ = +0.15 × 2340.5 = +351.1 |

### F5. Footing design and AASHTO bearing: Strength Ia / ACI 0.9D + 1.6H added and enveloped   [calc change] [more conservative]
- **Where:**
  - AASHTO block: new `B_eff_Ia`, `q_ult_Ia`, `bearing_ok_max`, `bearing_ok_Ia`, `q_ult_gov`, and the Ia trapezoid `quIa_*` (anchor: `const quA_back`).
  - ACI: new `SumVu_min` … `quf_back_min` after `const quf_back`.
  - Heel: `heelCase()`, `hcMax`, `hcMin` (anchor: `function heelCase(`).
  - Toe: `toeCase()` (anchor: `function toeCase(`).
  - Displays: Step 6 bearing, Step 7 ACI, the footing heading, the heel w_u line (factors now `r.gHeel`), and the summaries (now `q_ult_gov`).
- **Problem:**
  - Heel and toe design used only the max-vertical trapezoid (AASHTO Strength I max / ACI 1.2D + 1.6H), and AASHTO bearing was checked only for the max case.
  - The min-vertical case has a larger e. It gives less heel relief (heel flexure and shear) and can give higher toe pressure and higher q on a smaller B'.
- **Governing provision:**
  - AASHTO LRFD 10th Ed. Art. 11.5.6, Fig. C11.5.6-1, and Table 3.4.1-2 minimum factors (DC 0.90, EV 1.00, ES 0.75, EH 0.90 for the vertical component, LS 0).
  - ACI 318-19 5.3.1(e) / ASCE 7 0.9D + 1.6H, with the vertical thrust component taken at 0.9 because it resists.
- **Assumptions:**
  - The Strength Ia set is the same minimum-vertical set as the existing eccentricity check (column loads excluded, as there).
  - The ACI min case is 0.9(concrete + soil + Pa,V + column D). The surcharge and column L, S and W are omitted.
  - ES (q_sur) vertical is not in either AASHTO trapezoid, as before.
  - Case B (no relief) still uses the max-factor downward load.
- **Before (heel):**
  ```js
    const wu_heel = gEV * w_soil_col + gDC * (inp.gamma_c * tf_ft) + gES * inp.q_sur + (isAASHTO ? gLS * q_ll_aashto : 0);
    const q0h = bq_back, qLh = bq_heel;
    const Md_heel    = wu_heel * inp.Lh ** 2 / 2 + gEV * M_wedge_heel;
    const Mu_heel_up = q0h * inp.Lh ** 2 / 2 + (qLh - q0h) * inp.Lh ** 2 / 3;
    const Mu_heel_std = Md_heel - Mu_heel_up;
    const Vu_heel_std = Math.abs(wu_heel * inp.Lh + gEV * V_wedge_heel - ((q0h + qLh) / 2) * inp.Lh);
    const Mu_heel_nr = Md_heel;  const Vu_heel_nr = wu_heel * inp.Lh + gEV * V_wedge_heel;
  ```
- **After (heel):**
  ```js
    const hcMax = heelCase(gEV, gDC, gES, gLS, bq_back, bq_heel);
    const hcMin = isAASHTO ? heelCase(1.00, 0.90, 0.75, 0, bqm_back, bqm_heel)
                           : heelCase(0.9, 0.9, 0, 0, bqm_back, bqm_heel);
    const heel_min_governs = hcMin.Mstd > hcMax.Mstd;
    const hcG = heel_min_governs ? hcMin : hcMax;
    // wu_heel, q0h, qLh, Md_heel, Mu_heel_up, Mu_heel_std from hcG
    const Vu_heel_std = Math.max(hcMax.Vstd, hcMin.Vstd);
    const Mu_heel_nr = hcMax.Md;  const Vu_heel_nr = hcMax.Vnr;
  ```
  The toe follows the same pattern: `toeCase(bq_front,bq_toe)` and `toeCase(bqm_front,bqm_toe)`, with M from the governing case and V as the maximum of the two.
- **Before (bearing):** `const bearing_ok_A = q_ult_A <= q_R_A;`
- **After (bearing):**
  ```js
      const B_eff_Ia  = B - 2*Math.abs(e_A);
      const q_ult_Ia  = B_eff_Ia > 0 ? Math.max(V_str_min, 0) / B_eff_Ia : 999999;
      const bearing_ok_A = (q_ult_A <= q_R_A) && (q_ult_Ia <= q_R_A);
  ```
- **Check cases (default wall: Hs 12, B = 12.5, Lh 8, tf 18 in):**
  - **ACI default:**
    - Before: heel Mu = 14548 lb·ft/ft (max case).
    - After: 0.9D + 1.6H governs. ΣVu = 0.9 × 16582.5 = 14924.3, e = 0.550 ft, q_back = 1282.3, q_heel = 878.5, w_u = 0.9(1440 + 225) = 1498.5. M_down = 1498.5 × 8²/2 = 47952; M_up = 1282.3 × 32 − 403.8 × 64/3 = 32419; Mu = **15533** (+6.8%).
  - **AASHTO default:**
    - Before: heel Mu = 25705.
    - After: Strength Ia governs, with w_u = 1.00 × 1440 + 0.90 × 225 = 1642.5 and q_back = 1533.0, q_heel = 404.5; Mu = **27580** (+7.3%).
    - Bearing Ia: V = 16076, e = 1.428, B' = 9.644, q = 1667 psf, which does not govern (max case 2212).
  - **AASHTO, β = 15°, q_s = 250 psf:**
    - Before: toe Mu = 15660, bearing q = 3059 psf.
    - After: **toe Mu = 22550 (+44%, Strength Ia governs the toe)**, toe bar #4 @ 7 → #5 @ 8. Bearing Ia q = 4250 psf governs (q_R = 4950, OK).
    - Part of this change also comes from F2.

### F6. Mononobe-Okabe: φ − θ − β ≤ 0 is an error, not a fallback   [calc change / robustness] [more conservative]
- **Where:** `calcAll`, seismic block (≈ line 1536). Anchor: `const moOK`
- **Before:**
  ```js
      const KaeMO = (B > 0 && C > 0 && D > 0)
        ? ... : calcKa(inp.phi, inp.beta) * (1 + 1.5 * kh);  // fallback approx
  ```
- **After:**
  ```js
      const moOK = (B > 0 && C > 0 && D > 0);
      if (!moOK) errors.push(`Seismic: φ − θ − β = ... ≤ 0 ... no Mononobe-Okabe solution exists. ...`);
      const KaeMO = moOK ? ... : 0;
  ```
- **Governing provision:** Mononobe-Okabe (AASHTO LRFD 10th Ed. Appendix A11). No solution exists when φ − θ − β < 0.
- **Check case:** ACI, φ = 30°, β = 15°, kh = 0.4, kv = 0. θ = 21.80°, so φ − θ − β = −6.80°.
  - Before: Kae = 0.597 (fallback), ΔPe = 2130 lb/ft, and the run passes.
  - After: fatal error with the message above.

### F7. Shear-key passive gets no overturning credit   [calc change] [more conservative]
- **Where:** `calcAll` (≈ line 1793). Anchor: `const Ms_Pp`. The display label is now `P_{p,toe}·D_f/3`.
- **Problem:** `Pp` includes `Pp_key`, which acts below the base and toe pivot, yet it got a +Df/3 resisting arm.
- **Before:** `const Ms_Pp     = Pp * Df / 3;   // Pp already zero when passive toggle off`
- **After:** `const Ms_Pp     = (inp.inclPassive ? Pp_toe : 0) * Df / 3;`
- **Governing provision:** statics; IBC 2021 1807.2.3 overturning.
- **Check case:** ACI default, passive on, key dk = 24 in. Pp_toe = 405, Pp_key = 1800.
  - Before: Ms_Pp = 1102.5, FS_OT = 7.607.
  - After: Ms_Pp = 202.5 (= 405 × 1.5/3), FS_OT = 7.552.
  - Sliding is unchanged (FS 3.232).

### F8. ACI ℓd: ψg by grade; cb = min(cover to centre, s/2) (ACI and AASHTO)   [calc change] [more conservative]
- **Where:** `devLength` (≈ line 1470) and `devLengthAASHTO` (≈ line 1488), each with a new trailing `spacing` argument (the default reproduces the old cb). The three call sites (stem, heel, toe) now pass `sel_*.spacing`. The stem ℓd display now lists ψg.
- **Governing provision:** ACI 318-19 25.4.2.4 and Table 25.4.2.5 (ψg 1.0 / 1.15 / 1.3 for Grade 60 / 80 / 100). AASHTO LRFD 10th Ed. 5.10.8.2.1c (same cb definition).
- **Before:**
  ```js
  function devLength(db, fy, fc, psi_t, psi_e, cover_to_ctr, lambda=1.0) {
    const psi_g = 1.0;                        // Grade 60
    const ratio = Math.min(2.5, (cover_to_ctr + Ktr) / db);
  function devLengthAASHTO(db, fy, fc, top, cover_to_ctr) {
    const lam_rc = Math.min(1.0, Math.max(0.4, db / Math.max(cover_to_ctr, 1e-6)));
  ```
- **After:**
  ```js
  function devLength(db, fy, fc, psi_t, psi_e, cover_to_ctr, lambda=1.0, spacing=Infinity) {
    const psi_g = fy <= 60000 ? 1.0 : (fy <= 80000 ? 1.15 : 1.3);
    const cb    = Math.min(cover_to_ctr, (spacing > 0 ? spacing : Infinity) / 2);
    const ratio = Math.min(2.5, (cb + Ktr) / db);
  function devLengthAASHTO(db, fy, fc, top, cover_to_ctr, spacing=Infinity) {
    const cb  = Math.min(cover_to_ctr, (spacing > 0 ? spacing : Infinity) / 2);
    const lam_rc = Math.min(1.0, Math.max(0.4, db / Math.max(cb, 1e-6)));
  ```
- **Check case:** ACI default with fy = 80 ksi.
  - Before: stem #4 @ 7", ℓd = 15.18 in.
  - After: stem #4 @ 6" (from F9), ℓd = 17.46 in (= 15.18 × 1.15). Heel ℓd: 19.73 → 22.69.
  - At fy = 60 ksi there is no change (ℓd 12.00 / 14.80).
  - cb = s/2 governs only when s/2 < cover + db/2, i.e. for tight spacing.

### F9. ACI minimum flexural steel = 0.0018Ag for all grades   [calc change] [⚠ LESS conservative for fy < 60 ksi; more conservative for fy > 60 ksi]
- **Where:** `asMin` (≈ line 2271). Anchor: `if (!isAASHTO) return`
- **Governing provision:** ACI 318-19 7.6.1.1 and Table 24.4.3.2. The 2019 edition simplified the minimum to 0.0018 for all deformed-bar grades. The fy-dependent 0.0018·60,000/fy ≥ 0.0014 is the ACI 318-14 form. The tool's own display already printed `A_s,min = 0.0018 b h`.
- **Before:** `if (!isAASHTO) return Math.max(0.0014, 0.0018 * 60000 / inp.fy) * bw * h;`
- **After:** `if (!isAASHTO) return 0.0018 * bw * h;   // ACI 318-19 7.6.1.1 / Table 24.4.3.2: 0.0018Ag, all grades`
- **Check case:** h = 18 in, b = 12 in.

  | fy | Before | After |
  |---|---|---|
  | 80 ksi | 0.3024 in²/ft (0.0014) | 0.3888 in²/ft |
  | 60 ksi | 0.3888 | 0.3888 (unchanged) |
  | 40 ksi | 0.5832 (0.0027) | **0.3888 (less conservative)** |

### F10. Cohesion input: "not used" note   [display] [no result change]
- **Where:** the `coh` input row. A hint was added: "Display only — cohesion is not used in sliding, bearing or earth pressure."

### F11. `|| default` no longer blocks entering 0   [robustness] [⚠ can be less conservative only if a user enters 0 deliberately]
- **Where:** `getInputs` (new helper `nd(id, dflt)`, where blank → default and an entered 0 is kept); the `eta`, `phi_tau`, `phi_ep`, `phi_b`, `gamma_e1` and `gamma_e2` lines; `calcAll` (`const eta = A.eta;`); the HTML `min` of φτ and φep (now 0).
- **Before:**
  ```js
  eta: n('aashto_eta') || 1.0, phi_tau: n('aashto_phi_tau') || 1.0, phi_ep: n('aashto_phi_ep') || 0.50,
  phi_b: n('aashto_phi_b') || 0.55, gamma_e1: n('aashto_gamma_e1') || 1.0, gamma_e2: n('aashto_gamma_e2') || 0.75
  const eta = A.eta || 1.0;
  ```
- **After:**
  ```js
  eta: nd('aashto_eta', 1.0), phi_tau: nd('aashto_phi_tau', 1.0), phi_ep: nd('aashto_phi_ep', 0.50),
  phi_b: nd('aashto_phi_b', 0.55), gamma_e1: nd('aashto_gamma_e1', 1.0), gamma_e2: nd('aashto_gamma_e2', 0.75)
  const eta = A.eta;
  ```
- **Behaviour:**
  - 0 is legitimate for φτ and φep (no friction or passive credit) and is now used as entered.
  - 0 is not legitimate for η, φb or γe; it is now a clear error ("must be greater than 0") instead of silently becoming 1.0 / 0.55 / 1.0.
  - Blank still gives the default.
- **Check case:**
  - φτ = 0, φep = 0 → before: R_τ = 5851, R_ep = 202.5 (0 silently became 1.0 / 0.5). After: 0 / 0.
  - η = 0 → before: η = 1 used. After: error.

### F12. Blank f'c, fy or q_a → clear errors   [robustness]
- **Where:** `calcAll`, validation block (≈ line 1612). Anchor: `if (!(inp.fc > 0))`
- **Before:** a blank value was read as 0, giving Infinity/NaN steel or a bearing that always failed, with no message.
- **After:** fatal errors are raised for f'c ≤ 0, fy ≤ 0 and q_a ≤ 0. q_a is not required when AASHTO uses a manual φb·qn.
- **Check case:** fy blank → before: fatal = false, no errors. After: fatal, with "Steel yield strength f_y is blank or zero — enter f_y (psi)."

### F13. Toe self-weight label   [display] [no result change]
- **Where:** the footing tab, "Factored self-weight of footing" eq.
- The label printed `1.2 γc tf`, but the code uses 0.90 (`wu_toe_down = 0.90*γc*tf`). The label now reads 0.9.

## 2026-10-04 — Engineer decisions applied

### F14. SI/US units toggle removed; the tool is US customary only (engineer: "No SI")   [UI removal / robustness] [no result change]
- **Where:** header `#unit-seg` group (anchor `<div class="hdr-group">`, next to the `#basis-seg` group); `scheduleAutosave()` (anchor `localStorage.setItem(AUTO_KEY, JSON.stringify({ fields: snapshotFields(), ts: Date.now(), name }));`); `restoreSession()` (anchor `// The tool is US customary only (SI toggle removed).`); the `UNIT TOGGLE` block before `// 3D VIEW TAB`; `syncHeaderControls()` and the header listeners in the UI-shell script.
- **Problem:** F1 only disabled the SI button. The engineer decided that the tool will not support SI, so the toggle UI and its dead conversion path are removed.
- **Governing provision:** n/a.
- **Before:**
  ```html
      <span class="hdr-lbl" id="units-lbl">Units</span>
      <div class="seg" role="group" aria-labelledby="units-lbl" id="unit-seg">
        <button type="button" data-units="US" aria-pressed="true" title="US customary (ft, in, lb, psi)">US</button>
        <button type="button" data-units="SI" aria-pressed="false" disabled title="SI mode is disabled: the calculation engine works in US customary units only. Enter all inputs in ft, in, lb, psi.">SI</button>
      </div>
      <span class="vh" id="unit-label">US customary (ft, in, lb, psi)</span>
  ```
  ```js
      const units = (typeof _units !== 'undefined') ? _units : 'US';   // optional field (absent in older autosaves)
      localStorage.setItem(AUTO_KEY, JSON.stringify({ fields: snapshotFields(), ts: Date.now(), name, units }));
  …
      // An autosave explicitly tagged as SI is converted back to US customary (the engine is
      // US-only). Older autosaves carry no unit tag and cannot be identified, so they are
      // restored unchanged.
      if (auto.units === 'SI' && typeof UNIT_DEFS !== 'undefined') {
        Object.entries(UNIT_DEFS).forEach(([id, def]) => {
          const el = document.getElementById(id);
          if (!el) return;
          const v = parseFloat(el.value);
          if (!isNaN(v) && v !== 0) el.value = parseFloat((v / def.k).toFixed(def.dUS + 2));
        });
      }
  …
  // ================================================================
  // UNIT TOGGLE — US Customary ↔ SI Metric
  // Converts input field values + labels in-place
  // ================================================================
  let _units = 'US';  // 'US' or 'SI'
  const UNIT_DEFS = { Hs: {…}, tf: {…}, … wt_depth: {…} };   // 24 entries
  function toggleUnits() { … onInputChange(); }               // whole function (block is 69 lines incl. UNIT_DEFS)
  …
    const u = (typeof _units !== 'undefined') ? _units : 'US';
    document.querySelectorAll('#unit-seg button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.units === u)));
  …
  document.querySelectorAll('#unit-seg button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.units !== _units) toggleUnits();
    syncHeaderControls();
  }));
  ```
- **After:** the header HTML, the `UNIT TOGGLE` block, the two `#unit-seg` lines in `syncHeaderControls()` and the `#unit-seg` click listener are deleted. Autosave and restore become:
  ```js
      localStorage.setItem(AUTO_KEY, JSON.stringify({ fields: snapshotFields(), ts: Date.now(), name }));
  …
      // The tool is US customary only (SI toggle removed). An optional `units` field written by
      // an earlier build is ignored; if it says 'SI', warn once that the values may be metric,
      // then rewrite the autosave without the field so the warning does not repeat.
      if (auto.units !== undefined) {
        if (auto.units === 'SI') {
          setTimeout(() => alert('The last autosaved session was saved while the SI units option was selected, so some input values may be in SI (m, mm, kN, MPa). This tool works in US customary units only (ft, in, lb, psi, pcf). Check every input before using the results.'), 0);
        }
        try { const a2 = Object.assign({}, auto); delete a2.units; localStorage.setItem(AUTO_KEY, JSON.stringify(a2)); } catch(e){}
      }
  ```
- **Saved data:** the key `retaincalcpro.autosave.v1` and its `{fields, ts, name}` format are unchanged; this is the format on `main`. The optional `units` field that F1 added is no longer written. An autosave that carries it still loads, and the field is ignored. If it is `'SI'`, the values are restored **as stored, without conversion**, and a warning is shown once. The F1 SI→US auto-conversion is removed with `UNIT_DEFS`. Project saves and JSON export/import are not affected.
- **Check case (jsdom boot with a seeded autosave, scratch `jsd/rw_si.js`):**
  - No autosave: no alert; f'c = 4000, Hs = 12.
  - Old autosave without `units` (Hs 14): no alert; Hs = 14.
  - Autosave `units:'US'` (Hs 15): no alert; Hs = 15; the stored autosave is rewritten without `units`.
  - Autosave `units:'SI'` {f'c 27.6, Hs 3.66}: one alert; values restored as 27.6 / 3.66; the stored autosave is rewritten without `units`, so the next boot shows no alert.
  - No page errors in any case. The `#unit-seg` element is absent.
- **How verified:** `node --check` on all 4 inline scripts (`syncheck.js`). A grep for `_units|UNIT_DEFS|toggleUnits|unit-seg|units-lbl|unit-label|data-units` finds no matches, so nothing references the removed code. The jsdom boot test above. The engine (`getInputs`/`calcAll`) is untouched, so US results do not change.
- **Other copies of this code:** none known.

## Open items (not changed)
- **O1. AASHTO q_n = 3·q_a default** ("estimate" mode). This is a back-calculated resistance, and it is unconservative if q_a is settlement-controlled. Needs a decision: make "From geotech report" the default, or warn more strongly. Not changed.
- **O2. Rock bearing distribution.** The 0.45B option still uses a uniform Meyerhof B'. AASHTO 10.6.5 / 11.6.3.2 call for a triangular or trapezoidal distribution on rock, and φb = 0.45 for rock is not automatic. Needs a decision.
- **O3. ACI base friction default μ = tan φ.** Recommend tan(⅔φ) to match the AASHTO default and Spread Footing. Needs a decision; it changes results.
- **O4. AASHTO φτ default 1.00** (Table 11.5.7-1 semi-gravity). Many agencies use the 10.5.5.2.2-1 values (0.80 CIP on sand). Needs a decision.
- **O5. Collision CT factors (γ_EH = 0, γ_DC/EV = 1.0 in EE II, full-joint distribution) and the variable-height 0.75 rule.** These are MassDOT-specific and need MassDOT confirmation. Not changed.
- **O6. Ec = 33·w^1.5·√f'c.** AASHTO 10th uses Ec = 120,000·K1·wc²·f'c^0.33. This affects n for the crack-control fss. Needs confirmation before changing.
- **O7. Interface shear Avf credit:** `Avf_stem = As_stem_des` credits the flexural tension steel as shear-friction steel. Needs a decision.
- **O8. Not in scope, noted:**
  - The stem design uses the horizontal pressure Ka·γ·h with the Coulomb Ka. It does not take cos(δ + ω), which is conservative.
  - The Coulomb surcharge thrust `Pa_sur_h = Ka·q·H'` is kept fully horizontal (conservative).
  - The ACI factored resultant (`SumVu`) omits the barrier weight and the uplift, in both the max and the new min case, unchanged.

## Resolved items
- **F1: SI toggle disabled pending a decision on SI support.**
  - **RESOLVED 2026-10-04 (F14):** engineer: "No SI". The toggle and its conversion code are removed; the tool is US customary only.
- **O1 (q_n = 3·q_a default):** RESOLVED 2026-10-12 (F17). The default is now "From geotech report".
- **O2 (rock bearing distribution):** RESOLVED 2026-10-12 (F18). φb on rock is a warning only; see N3.
- **O3 (ACI μ = tan φ default):** RESOLVED 2026-10-12 (F19). The default is now tan(⅔φ).
- **O6 (Ec):** RESOLVED 2026-10-12 (F20), Eq. 5.4.2.4-1. See N4.
- **O7 (A_vf credit):** CLOSED 2026-10-12, not an issue (ACI R22.9.4.2); see the 2026-10-12 section.
- **O8:** the barrier in the ACI ΣV_u is RESOLVED 2026-10-12 (F21). The uplift part and the two conservative simplifications are CLOSED.
- **O4, O5:** still open, waiting for the engineer (N1, N2 in the 2026-10-12 section).

## 2026-10-04 — PR: claude/step1-group2 (PR link added after merge)

### F15. "← All tools" link + shared project info (HANDOFF.md §4.1)   [feature (no result change)]

- **Type:** feature (no result change). No formulas, factors, units, code references, storage keys or saved-data formats were changed.
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, hidden in print), and two buttons, **Use shared project info** and **Share project info**, in the Project tab → Project information. Share publishes `bridgeSuite.v1.projectMeta` (`_schema:"bridge-project-meta"`) with the tool's own fields, and `""` for fields it lacks. Use reads it with `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm dialog listing each field that will be overwritten (old → new), writes only this tool's fields, never blanks a field when the shared value is blank, and writes through the tool's normal path (sets the input and dispatches a bubbling `input` event, so the tool's own handler updates its state and autosaves).
- **Field mapping (shared `fields` key → this tool's input):**

| shared field | this tool |
|---|---|
| `projectName` | `#proj_name` |
| `bridgeId` | — (not in this tool; shared as `""`, ignored on Use) |
| `jobNo` | `#proj_num` |
| `client` | — (not in this tool; shared as `""`, ignored on Use) |
| `location` | — (not in this tool; shared as `""`, ignored on Use) |
| `preparedBy` | `#proj_eng` |
| `checkedBy` | `#proj_chk` |
| `date` | — (not in this tool; shared as `""`, ignored on Use) |

- **Governing provision:** none (not a calculation change). Spec: HANDOFF.md §4.1 (channel) and §5 (helper).
- **Check case:** Share with Project name "Route 9 over Mill Brook", Job no. "J-4471", Prepared by "M. Lococo", Checked by "A. Checker", Date "2026-10-04"; then Use in another tool → the mapped fields show those values after one confirm; unmapped fields are unchanged. Calculation results before/after: identical (no calculation code touched).

**Edit 1 — link.** Where: page `<header>` (after the `.brand` block; anchor `<div class="hdr-spacer"></div>` before `id="inputs-toggle"`).
- Before:
```html
  </div>
  <div class="hdr-spacer"></div>
  <div class="hdr-group">
    <button type="button" class="btn btn-inputs" id="inputs-toggle"
```
- After:
```html
  </div>
  <a class="bx-all-tools" href="tools.html" target="_top" title="Open the list of all tools">&larr; All tools</a>
  <div class="hdr-spacer"></div>
  <div class="hdr-group">
    <button type="button" class="btn btn-inputs" id="inputs-toggle"
```

**Edit 2 — buttons.** Where: Project tab → "Project information" (`#sec-proj`), after the "Checked By" input `#proj_chk`.
- Before:
```js
      <input type="text" id="proj_chk" placeholder="Name, PE"></div>

```
- After:
```js
      <input type="text" id="proj_chk" placeholder="Name, PE"></div>
    <div class="proj-row" style="grid-template-columns: 1fr 1fr"><button type="button" id="bx-pm-use" class="proj-btn" title="Fill these fields from the project info shared by another tool">Use shared project info</button><button type="button" id="bx-pm-share" class="proj-btn" title="Share these project fields with the other tools">Share project info</button></div>

```

**Edit 3 — CSS.** Where: end of the first `<style>` block in `<head>` (inserted just before its `</style>`).
- Before: `</style>`
- After:
```css
/* "All tools" link */
.bx-all-tools { font-size: 12px; color: var(--muted); text-decoration: none; white-space: nowrap; }
.bx-all-tools:hover { color: var(--blue); text-decoration: underline; }
@media print { .bx-all-tools { display: none !important; } }
</style>
```

**Edit 4 — scripts.** Where: just before the first `</head>`.
- Before: `</head>`
- After:
```html
<script>
/* BridgeXfer v1 verbatim from HANDOFF.md §5 (not repeated here) */
</script>
<script>
/* Shared project info (HANDOFF.md §4.1, channel projectMeta): "Use shared project info" / "Share project info".
   Uses BridgeXfer v1 above. Writes only the fields this tool has, through the tool's normal input path. */
(function(){
  var TOOL='Retaining Wall Designer', FILE='Retaining Wall Designer.html';
  var MAP={ projectName:'#proj_name', bridgeId:'', jobNo:'#proj_num', client:'', location:'', preparedBy:'#proj_eng', checkedBy:'#proj_chk', date:'' }; // shared field -> this tool's input ('' = this tool has no such field)
  var LBL={ projectName:'Project name', bridgeId:'Bridge ID', jobNo:'Job / project no.', client:'Client', location:'Location', preparedBy:'Prepared by', checkedBy:'Checked by', date:'Date' };
  function el(k){ return MAP[k] ? document.querySelector(MAP[k]) : null; }
  function share(){
    var f={}; for(var k in LBL){ var e=el(k); f[k]=e ? String(e.value==null?'':e.value).trim() : ''; }
    var r=BridgeXfer.publish('projectMeta',{ _schema:'bridge-project-meta', project:{ name:f.projectName, bridgeId:f.bridgeId }, fields:f }, TOOL, FILE);
    alert(r.error ? 'Could not share project info: '+r.error : 'Project info shared. Other tools can load it with "Use shared project info".');
  }
  function use(){
    var r=BridgeXfer.read('projectMeta','bridge-project-meta',1);
    if(r.error){ alert(r.empty ? 'No shared project info yet. Click "Share project info" in a tool that has the project filled in.' : 'Cannot use shared project info: '+r.error); return; }
    var f=r.payload.fields||{}, todo=[], lines=[], skipped=[];
    for(var k in LBL){ var e=el(k); if(!e) continue;
      var v=f[k]==null ? '' : String(f[k]).trim(); if(!v) continue;
      if(e.type==='date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)){ skipped.push(LBL[k]+' "'+v+'" (not a YYYY-MM-DD date)'); continue; }
      if(v===e.value) continue;
      todo.push([k,v]); lines.push('  '+LBL[k]+': "'+(e.value||'')+'" -> "'+v+'"'); }
    var from='From: '+BridgeXfer.describe(r.payload);
    if(!todo.length){ alert('Shared project info has nothing new for this tool.\n\n'+from+(skipped.length?'\n\nNot used: '+skipped.join('; '):'')); return; }
    if(!confirm('Use shared project info?\n\n'+from+'\n\nThis will overwrite:\n'+lines.join('\n')+(skipped.length?'\n\nNot used: '+skipped.join('; '):'')+'\n\nBlank shared fields are left unchanged.')) return;
    todo.forEach(function(t){ var e=el(t[0]); if(!e) return; e.value=t[1]; e.dispatchEvent(new Event('input',{ bubbles:true })); });
  }
  document.addEventListener('click', function(ev){
    var b=ev.target && ev.target.closest ? ev.target.closest('#bx-pm-use,#bx-pm-share') : null; if(!b) return;
    if(b.id==='bx-pm-use') use(); else share();
  });
})();
</script>
</head>
```

- **Line endings:** this file uses CRLF; the inserted lines use CRLF too.

- **How verified:**
  - `node --check` on every plain inline `<script>` of the old and new file: no failures in either (2 new scripts per file: helper + glue). The tool has no `text/babel` blocks.
  - jsdom load with CDN scripts not fetched: the same load errors as the original file (none new); `window.BridgeXfer` exists; the link has `href="tools.html" target="_top"`.
  - Share → Use run in jsdom between all six tools of this PR (30 pairs) with the localStorage entry copied across: every pair passed. The payload had `_schema:"bridge-project-meta"`, `schemaVersion:1`, all 8 `fields` keys, and `producedAt` equal to `bridgeSuite.v1.projectMeta.updatedAt`. Fields were written through the tool's own input handler and reached its saved state/autosave. A blank shared field never blanked a tool field; an empty channel and a wrong `_schema` gave a message and changed nothing.
  - Diff check: at most one line is removed, the line replaced at the button anchor where that anchor is inside a JS template string; everything else is additions. No calculation code, storage key or saved-data format was touched.
- **Other copies:** the BridgeXfer v1 helper is duplicated verbatim in every tool that uses it (CLAUDE.md §3; list in the PR). The glue block is the same in each tool of this PR except `TOOL`/`FILE` and the field map.
- **Open items:** none.

## 2026-10-09 — PR: claude/pin-retainingwall (PR link added after merge)

### F16. Pin MathJax CDN URLs to 3.2.2 (CLAUDE.md §2; engineer's decision 2026-10-09)   [library pin] [no result change]

- **Type:** library version pin. No formulas, factors, units, code references, storage keys or saved-data formats were changed. MathJax `@3` already resolved to 3.2.2 (the latest 3.x on the npm registry, published 2022-06-08; npm `latest` is 4.1.3, not used), so the pin loads the same build as before.
- **Where (1 of 2):** `<head>`, main page MathJax loader (≈ line 630). Anchor: `id="MathJax-main"`.
  - Before: `<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" id="MathJax-main"></script>`
  - After: `<script src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js" id="MathJax-main"></script>`
- **Where (2 of 2):** `generateReport()`, inside the report-window HTML template string (≈ line 7578). Anchor: `id="MathJax-script"><\/script>`.
  - Before: `<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" id="MathJax-script"><\/script>`
  - After: `<script src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js" id="MathJax-script"><\/script>`
- **Other URLs checked, not changed (already pinned):** `cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`; `cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`; the Plotly fallback loader (`cdn.plot.ly/plotly-2.35.2.min.js`, `cdnjs.cloudflare.com/ajax/libs/plotly.js/2.35.2/plotly.min.js`, `cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js`); Google Fonts CSS (not a versioned library). MathJax's fonts are loaded relative to its script URL, so they now come from `mathjax@3.2.2/es5/output/chtml/fonts/woff-v2/` too.
- **Line endings:** the tool uses CRLF; the edit was an in-line substitution, CRLF kept.
- **Governing provision / check case:** none (no calculation touched). Check: open the tool, go to the Stability, Stem design and Footing design tabs and open the report; equations render and the numbers match the previous version.
- **How verified:** headless Chromium (Playwright), main vs branch, default inputs, CDN requests served from the npm 3.2.2 / three 0.128.0 / plotly.js-dist-min 2.35.2 packages. `MathJax.version` = 3.2.2 on the page and in the report window; typeset equation count identical (Stability 29, Stem 22, Footing 29, report 62), 0 `mjx-merror` in both; text of all 7 result tabs identical; report text identical except the "Generated" time stamp; autosave (`retaincalcpro.autosave.v1`) identical except `ts`; no new console errors (only the blocked Google Fonts request and WebGL software-render warnings, same in both). The requested URLs show the pinned path on the branch.
- **Other copies:** none in this tool. Other tools load their own MathJax tags and are pinned in their own PRs.
- **Open items:** none.

## 2026-10-12 — PR: claude/sweep-retwall (open-item sweep; PR link added after merge)

Engineer's instruction 2026-10-12: work through every open item, use best judgment, and list what truly needs the engineer. Line numbers are approximate; search for the anchor text. The tool file uses CRLF line endings; all edits keep CRLF. Saved data: no storage key, field id or format changed and no new fields were added. Only three HTML default values changed (`mu_method`, `aashto_qn_mode`, `aashto_qR`). Every project save, autosave and JSON export stores every sidebar field, so an existing file restores its own stored option values and gives the same result as before, apart from the calculation fixes F18, F20 and F21.

### F17. AASHTO q_n source defaults to "From geotech report" (O1)   [calc default] [no change at the default inputs; removes the silent 3·q_a assumption]
- **Where:**
  - Sidebar → Design → Resistance factors (AASHTO). Anchors: `<option value="manual">From geotech report` and `id="grp_qn_manual"`.
  - `calcAll`, AASHTO bearing block. Anchor: `const q_R_A   = useManualQn ? A.qR : A.phi_b * q_n_A;`
  - `renderStabilityAASHTO`, the 3·q_a warning. Anchor: `Nominal bearing resistance q_n is estimated as 3×q_a`
- **Problem:** the default was "Estimate as 3 × q_a". This back-calculated q_n is unconservative when q_a was derived with FS < 3. It also hides the case where q_a is set by settlement, because the AASHTO branch then has no service settlement check.
- **Before:**
  ```html
        <option value="estimate">Estimate as 3 × q_a (FS ≈ 3)</option>
        <option value="manual">From geotech report (factored φ_b·q_n)</option>
  …
      <div class="ig full" id="grp_qn_manual" style="display:none"><label for="aashto_qR">Factored Bearing Resistance φ<sub>b</sub>q<sub>n</sub></label>
        <div class="iw"><input type="number" id="aashto_qR" value="8000" min="1000" max="60000" step="500"><span class="iw-unit">psf</span></div></div></div>
  ```
  ```js
      const q_R_A   = useManualQn ? A.qR : A.phi_b * q_n_A;      // factored resistance
  ```
- **After:**
  ```html
        <option value="estimate">Estimate as 3 × q_a (FS ≈ 3)</option>
        <option value="manual" selected>From geotech report (factored φ_b·q_n)</option>
  …
      <div class="ig full" id="grp_qn_manual"><label for="aashto_qR">Factored Bearing Resistance φ<sub>b</sub>q<sub>n</sub></label>
        <div class="iw"><input type="number" id="aashto_qR" value="4950" min="1000" max="60000" step="500"><span class="iw-unit">psf</span></div>
        <div class="hint static">Enter the factored bearing resistance from the geotechnical report. The default 4950 psf is a placeholder only (= 0.55 × 3 × the default q<sub>a</sub> of 3000 psf).</div></div></div>
  ```
  ```js
      const q_R_A   = useManualQn ? A.qR : A.phi_b * q_n_A;      // factored resistance
      if (useManualQn && A.qR === 4950)
        warnings.push('AASHTO bearing: φb·qn = 4950 psf is the tool\'s default placeholder. Enter the factored bearing resistance from the geotechnical report.');
  ```
  The estimate-mode warning gains this sentence: "This is unconservative if q_a was derived with FS &lt; 3 or is set by settlement (the service settlement limit is then not checked)."
- **Default choice:** the placeholder value 4950 psf equals the old default result (0.55 × 3 × 3000), so a new session gives the same AASHTO numbers as before. The value is now shown as an explicit input with a placeholder note and a warning. The old default qR of 8000 psf was not used, because it would have made the out-of-box bearing check less conservative (8000 > 4950).
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 10.6.3.1 (nominal bearing resistance from the geotechnical analysis) and Table 11.5.7-1 (φb = 0.55).
- **Check case:** AASHTO, default wall. Before: estimate mode, q_R = 0.55 × 3 × 3000 = 4950 psf. After: manual mode, q_R = 4950 psf. q_u,gov = 2212 psf in both, so the bearing check is unchanged. The placeholder warning is shown. A saved project with `aashto_qn_mode: "estimate"` and `aashto_qR: "8000"` restores as estimate / 8000 and gives q_R = 4950 as before (tested by seeding a main-built autosave into the branch).
- **Conservatism:** neutral at the defaults. The tool no longer applies 3·q_a without the user choosing it.

### F18. AASHTO bearing on rock: linear (trapezoidal/triangular) distribution (O2)   [calc change] [more conservative]
- **Where:** `calcAll`, AASHTO bearing block (anchors `const B_eff   = B - 2*Math.abs(e_brg);`, `const q_ult_Ia  =`), and the CT Extreme Event II block (anchor `const q_ult_ct   =`); `aashtoR` return (`onRock`). Displays: `renderStabilityAASHTO` Step 6 card ref, "Eccentricity check — foundation on …", the q_u equation, the Strength Ia equation, the CT bearing equation; report §4.4 and §4.5 lines; the `HINTS.aashto_ecc_limit.rock` text.
- **Trigger:** the eccentricity-limit option `rock` ("e ≤ 0.45B — middle nine-tenths (rock)"). Its hint already says "Do not use for footings on soil", so it is the tool's existing "footing on rock" switch. No new input was added.
- **Before:**
  ```js
      const q_ult_A = B_eff > 0 ? V_str_max / B_eff : 999999;    // uniform over B'
  …
      const q_ult_Ia  = B_eff_Ia > 0 ? Math.max(V_str_min, 0) / B_eff_Ia : 999999;
  …
        const q_ult_ct   = V_ct_max / B_eff_ct;                 // psf
  ```
- **After:**
  ```js
      const onRock  = A.ecc_limit === 'rock';
      const qRock   = (V, ecc) => { const ae = Math.abs(ecc);
        if (!(V > 0)) return 0;
        if (ae <= B/6) return V / B * (1 + 6*ae/B);                  // Eq. 11.6.3.2-2
        return ae < B/2 ? 2*V / (3*(B/2 - ae)) : 999999; };           // Eq. 11.6.3.2-3
      const q_ult_A = onRock ? qRock(V_str_max, e_brg)
                             : (B_eff > 0 ? V_str_max / B_eff : 999999);    // uniform over B' (soil)
  …
      const q_ult_Ia  = onRock ? qRock(Math.max(V_str_min, 0), e_A)
                               : (B_eff_Ia > 0 ? Math.max(V_str_min, 0) / B_eff_Ia : 999999);
      if (onRock && !useManualQn && A.phi_b > 0.45)
        warnings.push(`AASHTO bearing on rock: φb = ${f(A.phi_b,2)} is used. Table 10.5.5.2.2-1 gives φb = 0.45 for footings on rock (Table 11.5.7-1 gives 0.55 for semi-gravity walls). Confirm φb with the geotechnical engineer.`);
  …
        const q_ult_ct   = onRock ? qRock(V_ct_max, e_brg_ct) : V_ct_max / B_eff_ct;   // psf (rock: Eq. 11.6.3.2-2/-3)
  ```
- **φb on rock:** not changed automatically. Table 11.5.7-1 (the wall table) gives φb = 0.55 for semi-gravity walls and does not separate rock. Table 10.5.5.2.2-1 gives 0.45 for footings on rock. The tool keeps the user's φb and warns when it is above 0.45 on rock in estimate mode. See "Needs engineer" N3.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 10.6.5 (footings on rock: triangular or trapezoidal distribution) and Art. 11.6.3.2, Eqs. 11.6.3.2-2 and 11.6.3.2-3 (verify the equation numbers against the 10th Ed. print).
- **Check cases (AASHTO, estimate mode, ecc limit = rock; B = 12.5 ft, B/6 = 2.083 ft):**

  | Case | V (lb/ft) | e (ft) | Before: V/(B−2e) | After | Hand check |
  |---|---|---|---|---|---|
  | Default wall, Strength I | 26878 | 0.175 | 2212 psf | **2331 psf** | 26878/12.5 × (1 + 6×0.175/12.5) = 2150.3 × 1.0840 = 2331 |
  | Default wall, Strength Ia | 16076 | 1.428 | 1667 | **2168** | 1286.1 × (1 + 6×1.428/12.5) = 1286.1 × 1.6855 = 2168 |
  | β = 15°, q_s = 250, Strength Ia | 17238 | 4.222 > B/6 | 4250 (OK vs 4950) | **5667 (fails)** | 2 × 17238 / (3 × (6.25 − 4.222)) = 34476 / 6.084 = 5667 |
  | Default + barrier + CT, EE II | 17033 | 0.144 | 1395 | **1457** | 17033/12.5 × (1 + 6×0.144/12.5) = 1362.6 × 1.0689 = 1456.5 |

- **Conservatism:** more conservative. For e = 0 the two are equal. For 0 < e ≤ B/6, (1 + 6e/B) > 1/(1 − 2e/B). For e > B/6 the triangular peak is 4/3 of V/(B − 2e).
- **Footings on soil:** unchanged (Meyerhof B′, Eq. 11.6.3.2-1).

### F19. ACI base-friction default μ = tan(⅔φ) (O3)   [calc default] [more conservative]
- **Where:** Sidebar → Design → Design options → Base Friction Method. Anchor: `<option value="twothirds">tan(⅔φ) — concrete on soil</option>`
- **Before:** `<option value="phi">` was first and unselected, so it was the default. μ = tan φ ("soil on soil").
- **After:** `<option value="twothirds" selected>tan(⅔φ) — concrete on soil</option>`. The option order and labels are unchanged.
- **Why:** a cast-in-place footing on soil is the case the tool's own label calls "concrete on soil". tan(⅔φ) is also the default of the AASHTO branch (`aashto_base_fric = two_thirds`) and of Spread Footing (`μ = tan(2/3 φ)`). tan φ stays selectable.
- **Governing provision:** no ACI 318 provision; the friction coefficient is a geotechnical input. Reference practice: AASHTO LRFD 10th Ed. Art. 10.6.3.4 and C10.6.3.4; NAVFAC DM-7.02 (verify table).
- **Check case:** ACI default wall, φ = 30°. ΣV for sliding = 16582.5 lb/ft, F_h = 3645 lb/ft.
  - Before: μ = tan 30° = 0.5774. F_r = 16582.5 × 0.5774 = 9574. FS_SL = 9574/3645 = 2.63.
  - After: μ = tan 20° = 0.3640. F_r = 16582.5 × 0.3640 = 6036. FS_SL = 6036/3645 = **1.66** (≥ 1.5, OK).
  - Old saved projects keep their stored `mu_method` (e.g. `"phi"`) and give the old result.

### F20. AASHTO crack control: Ec per Eq. 5.4.2.4-1 (O6)   [calc change] [slightly less conservative]
- **Where:** `calcAll`, AASHTO extended checks. Anchor: `const Ec = `. The Step 9 card header now prints E_c. `aashtoR.serv` returns `Ec`.
- **Before:** `const Ec = 33 * Math.pow(inp.gamma_c, 1.5) * Math.sqrt(inp.fc);  // psi (w in pcf, f'c in psi)`
- **After:**
  ```js
      // AASHTO LRFD 10th Ed. Eq. 5.4.2.4-1: Ec = 120,000·K1·wc^2.0·f'c^0.33 (ksi; wc kcf, f'c ksi), K1 = 1.0
      const Ec = 120000 * 1.0 * Math.pow(inp.gamma_c/1000, 2.0) * Math.pow(inp.fc/1000, 0.33) * 1000;  // psi
  ```
  The card header changes from `n = 8 · f_r = 480 psi` to `n = 7 (E_c = 4266 ksi, Eq. 5.4.2.4-1) · f_r = 480 psi`.
- **Scope:** AASHTO branch only, where Ec is used only for n in the Service I crack-control fss. ACI has no crack-control Ec in this tool.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 5.4.2.4, Eq. 5.4.2.4-1 (K1 = 1.0). The old expression is the ACI 318-19 19.2.2.1 / pre-2015 AASHTO form.
- **Assumption:** wc = the tool's γc input (default 150 pcf, which includes reinforcement). See "Needs engineer" N4.
- **Check case:** f'c = 4000 psi, γc = 150 pcf, Es = 29,000 ksi.
  - Before: Ec = 33 × 150^1.5 × √4000 = 33 × 1837.1 × 63.25 = 3834 ksi. Es/Ec = 7.56, so n = 8.
  - After: Ec = 120,000 × 0.150² × 4^0.33 = 2700 × 1.5801 = 4266 ksi. Es/Ec = 6.80, so n = 7.
  - Default AASHTO wall: stem fss 30.88 → 30.76 ksi, s_max 9.42 → 9.47 in. Toe fss 24.25 → 24.19 ksi, s_max 15.70 → 15.76 in. Heel k 0.185 → 0.175.
- **Conservatism:** slightly less conservative (s_max up by about 0.6%). This is the code-required value.

### F21. ACI factored resultant includes the barrier weight (O8, part 3)   [calc change] [mixed: toe more, heel less conservative]
- **Where:** `calcAll`, ACI factored bearing. Anchors: `const SumVu = 1.2 *`, `const Msu   = 1.2 *`, `const SumVu_min = 0.9 *`, `const Msu_min   = 0.9 *`. The Step 7 display equations show `+W_{bar}` when a barrier is on.
- **Before:**
  ```js
    const SumVu = 1.2 * (Wftg + Wstem + Wsoil) + 1.6 * (Wsur + Pa_tri_v) + Puf_max;
    const Msu   = 1.2 * (Ms_ftg + Ms_stem + Ms_soil) + 1.6 * (Ms_sur + Ms_Pv) + Puf_max * x_col;
    const SumVu_min = 0.9 * (Wftg + Wstem + Wsoil) + 0.9 * Pa_tri_v + 0.9 * pDL;
    const Msu_min   = 0.9 * (Ms_ftg + Ms_stem + Ms_soil) + 0.9 * Ms_Pv + 0.9 * pDL * x_col;
  ```
- **After:**
  ```js
    const SumVu = 1.2 * (Wftg + Wstem + Wsoil + W_bar) + 1.6 * (Wsur + Pa_tri_v) + Puf_max;
    const Msu   = 1.2 * (Ms_ftg + Ms_stem + Ms_soil + Ms_bar) + 1.6 * (Ms_sur + Ms_Pv) + Puf_max * x_col;
    const SumVu_min = 0.9 * (Wftg + Wstem + Wsoil + W_bar) + 0.9 * Pa_tri_v + 0.9 * pDL;
    const Msu_min   = 0.9 * (Ms_ftg + Ms_stem + Ms_soil + Ms_bar) + 0.9 * Ms_Pv + 0.9 * pDL * x_col;
  ```
- **Problem:** the barrier is DC on the stem. The service ΣV, the AASHTO Strength sets and the CT set all include it, but the ACI footing-design trapezoids (1.2D + 1.6H and 0.9D + 1.6H) left it out.
- **Governing provision:** ACI 318-19 Table 5.3.1 (1.2D + 1.6H; 0.9D + 1.6H per 5.3.1(e) / ASCE 7); statics.
- **Check case:** ACI, μ = tan φ, barrier on (geometry mode, W_bar = 450 lb/ft at x_bar = 3.5 ft, Ms_bar = 1575 lb·ft/ft).
  - ΣV_u 19899 → 20439 (Δ = 1.2 × 450 = 540). M_s,u 148408 → 150298 (Δ = 1.2 × 1575 = 1890). e_u 0.111 → 0.181 ft.
  - q_u,toe 1676.6 → 1776.8 psf. Toe M_u 6572 → **6982 lb·ft/ft (+6.2%)**.
  - The min case governs the heel: ΣV_u,min 14924 → 15329 (Δ = 0.9 × 450 = 405). Heel M_u 15533 → **15281 lb·ft/ft (−1.6%)**, V_u 3492 → 3311.
  - With no barrier (the default) nothing changes.
- **Conservatism:** toe demand rises; heel demand falls slightly, because the larger total vertical load gives more heel bearing relief. This is the correct statics.

### Closed without a code change
- **O7. Interface-shear A_vf credits the flexural steel.** Kept as is. ACI 318-19 commentary R22.9.4.2 (verify the article number) says that where a moment acts across a shear-friction plane, the flexural tension and compression are in equilibrium, so the clamping force A_vf·f_y is unchanged. No reinforcement beyond the flexural steel is needed, unless the required flexural tension steel exceeds the shear-friction steel in the tension zone. Here A_vf is the provided stem steel As_stem_des itself, and the stem axial compression P_c is conservatively not credited (Eq. 5.7.4.3-3 is used with P_c = 0). AASHTO 5.7.4.3 defines A_vf as the reinforcement crossing the interface and does not exclude flexural bars. The inventory recommendation (credit only the excess over the flexural demand) would be more conservative than both codes; the engineer may still choose it.
- **O8, parts 1 and 2. The stem uses horizontal Ka·γ·h without cos(δ + ω), and the Coulomb surcharge thrust is horizontal.** Both are conservative simplifications; accepted, no change.
- **O8, part 3 (uplift in the ACI ΣV_u).** Not an error. ΣV_u builds the *total* upward pressure on the footing underside (soil plus water) for structural design. Leaving out the uplift is the same treatment the AASHTO branch uses (`V_str_max_tot`, "uplift added back"). The barrier part of O8 is fixed in F21.

### How verified (all of F17–F21)
- `node --check` on all 6 inline scripts: no failures.
- Headless Chromium (Playwright, local MathJax 3.2.2 / three r128 / Plotly 2.35.2), main vs branch, 12 scenarios: ACI default; ACI μ = tan φ; ACI + barrier (μ = tan φ, and default μ); AASHTO default; AASHTO estimate; AASHTO manual 8000; AASHTO rock; AASHTO rock + barrier + CT; AASHTO CT; AASHTO rock β = 15°, q_s = 250; AASHTO f'c = 5000. All `calcAll` outputs were flattened and diffed.
  - ACI default vs branch ACI μ = tan φ: identical except the `inp.aashto` defaults.
  - Main AASHTO default vs branch AASHTO estimate: differs only in the F20 crack-control values (n, k, j, fss, s_max) and the unused ASD `FOS_SL`/`Fr`.
  - Rock cases: q_ult_A, q_ult_Ia and q_ult_ct as in the F18 table.
  - Barrier cases: ACI ΣV_u and the footing values as in F21. In AASHTO mode, the AASHTO footing design (`Mu_heel`, `Mu_toe`) is unchanged by F21.
- The result-tab text diffs match the items above. 0 `mjx-merror` on the page (37 typeset) and in the report (61 typeset). No page errors. The only console error is the blocked Google Fonts request, the same in main.
- Autosave `retaincalcpro.autosave.v1` has the same key and format `{fields, ts, name}`, with 116 fields in both. A main-built autosave (AASHTO, estimate, μ = tan φ) restored in the branch gives identical bearing and sliding results; only n changes (F20).
- Screenshots were reviewed: the sidebar shows the qR input and the placeholder note; the Step 6 rock equation and the report §4.4/§4.5 render.
- **Other copies:** none. The Spread Footing friction default is already tan(⅔φ).

### Needs engineer
- **N1 (O4). AASHTO φτ default.** Keep 1.00 per Table 11.5.7-1 (semi-gravity walls), or use 0.80 (Table 10.5.5.2.2-1, CIP concrete on sand) as MassDOT policy? Recommendation: keep 1.00 unless MassDOT requires 0.80. Unchanged.
- **N2 (O5). Collision CT under Extreme Event II.** Confirm the MassDOT values: γ_EH = 0, γ_DC/EV = 1.0, distribution over the full joint length, and the variable-height 0.75 rule (MassDOT BDDM §3.3.2.2 / §3.3.2.4). Unchanged.
- **N3 (F18). φb on rock.** Should a rock footing default to φb = 0.45 (Table 10.5.5.2.2-1) instead of the wall value 0.55 (Table 11.5.7-1)? Recommendation: 0.45 when the geotech report gives a nominal q_n for rock. The tool now only warns.
- **N4 (F20). wc in Eq. 5.4.2.4-1.** The tool uses γc (default 150 pcf, which includes reinforcement). Table 3.5.1-1 / C5.4.2.4 suggest the plain-concrete unit weight (0.145 kcf for f'c ≤ 5 ksi; verify). With 0.145, Ec = 3987 ksi and n is still 7. Recommendation: keep γc unless you want a separate wc input.

### Remaining open items
- None. O1, O2, O3, O6 and O8 (barrier) are fixed in F17–F21. O7 and the rest of O8 are closed above. O4 and O5 wait for the engineer (N1, N2).

## 2026-10-18 — PR: claude/rw-d11-report (PR link added after merge)

The tool file uses CRLF line endings; keep them. Line numbers are approximate; search for the anchor text.

### D11: calculation-sheet report in the Gusset Plate Rating / ST-Girder format (Tier 1, display only)
- **Engineer request:** 2026-10-14 / 2026-10-18 (AUDIT.md D11).
- **What changes for the user:** the **Export report** window is restructured, so its printout changes. Ctrl+P on the main page is unchanged apart from the new "Worked in" lines (D11 links below).
- **Where:** the whole report block, from the anchor `// CALCULATION REPORT (D11, 2026-10-18)` down to the end of `buildReportHTML()` (just above `// 3D VIEW TAB — Three.js interactive model`). It replaces the old block that started at `// PDF REPORT GENERATOR` and ended with the old `generateReport()`. To re-apply by hand, copy that whole block from this version. It holds `RW_REFS`, `RW_SEC`, `rwTabSource()`, `rwPlotImages()`, `rwResultRows()`, `generateReport()` (now `async`) and `buildReportHTML()`.
- **Before:** one template-literal report in a new window:
  - a title block (Project No., Engineer, Checked By, Date, Standard, Units, Load combo, Status);
  - its own re-derivations: §1 Input Parameters (1.1, 1.2, 1.4; no 1.3), §2 Wall Geometry, §3 Earth Pressure, §4 Stability, §5 Stem, §6 Footing, §7 Reinforcement Schedule, §8 Design Summary;
  - no references, no table of contents, no result lines;
  - `@page{size:letter;margin:1in 0.85in 1in 0.85in;}`, with no header or footer.
- **After:**
  - **Cover:**
    - title, project name, Notes / Description, and the codes of the selected basis;
    - title block: Project / Project No. / Calculated by (`proj_eng`) / Date (the date the report is generated, as before) / Checked by (`proj_chk`) / Checked date ("—": the tool has no such field, and none was added) / design basis / units;
    - a PASS/FAIL banner from `r.checks` (same count as the status bar).
  - **References table** (`RW_REFS`, by basis). It lists only what the tool cites:
    - ACI basis: ACI 318-19, IBC 2021 §1807.2.3, ASCE 7-22 §2.3.1 / §11.8, Rankine (1857), Seed & Whitman (1970).
    - AASHTO basis: AASHTO LRFD 10th Ed. (2024) articles; MassDOT LRFD Bridge Manual §3.3.2.2 / §3.3.2.4 / Table 3.3.2-1, marked "edition: verify" (the tool states none); ACI 318-19 §25.4.2 (cited for the footing bars' ℓd); ASCE 7-22 §2.3.1.
  - **Numbered table of contents** with links (sections and subsections).
  - **Sections:**
    1. Design Summary: every check of `r.checks`, plus the card checks (below), with value, D/C, status and "Worked in §n.k".
    2. Input Parameters: the old §1 tables, unchanged except the numbers (2.1 Wall Geometry, 2.2 Soil Properties & Loading, 2.3 Column / Beam Loads, 2.4 Materials & Cover; the materials table had no heading before).
    3. Wall Geometry: the old figure.
    4. Stability, 5. Stem Design, 6. Footing Design, 7. Reinforcement Schedule: the result tabs' own cards.
       - They are built by `renderStability` / `renderStem` / `renderFooting` / `renderRebar` into a stand-in element (`rwTabSource`); the live tab is not touched.
       - Each card is subsection n.k; its title keeps the tab's "Step x" text. The tabs' group headings are kept, unnumbered.
       - The Plotly charts are drawn off screen by the tabs' own plot jobs and inserted as SVG images (`rwPlotImages`). Without Plotly the report says the chart is not included.
  - **Result lines** at the end of §4–§7 (`rwResultRows`): "<check>: D/C = x.xx (<ref>; <note>; §n.k) PASS/FAIL".
    - The status is the check's own flag (`r.checks[k].ok`, or the card's own condition).
    - D/C uses the tool's values. For a FOS check, D/C = 1.5 / FOS, as on the Overview scorecard.
    - Card checks that are not in the status bar are listed too, marked "card check, not counted in the status bar": S2 and F3 temperature & shrinkage bar selection, and (AASHTO with interface shear) the stem–footing interface.
  - **ACI crack control** (`crackStem/Heel/Toe`, ACI 318-19 §24.3.2) was not worked in any tab. The report adds the card "Crack-Control Bar Spacing" in §7 with `eqCheck`, from `r.aciCr` (f_s, c_c, s_max, s). The two terms inside min( ) use the tool's own expressions `15(40000/fs) − 2.5cc` and `12(40000/fs)`.
  - **Print:** `@page` letter with margin boxes, inside `@media print` (print only).
    - Top: "Project No / Description" (Notes, else the project name), "Computed By / Checked By", "Date / Date".
    - Bottom: "<project> (RetainCalc Pro — Retaining Wall Designer)" and "Page X of Y".
    - The on-screen footer line is hidden in print.
  - The report window opens inside the click (pop-up blockers) with a "Building…" note, then loads the report from a Blob URL as before.
  - MathJax in the report: same CDN tag (3.2.2); inline math also accepts `\( \)`.
- **Fixed along the way (report display only):**
  - AASHTO mode printed ACI labels next to the AASHTO values. All of these are gone, because the report now prints the tabs' own equations:
    - the old title block: "Standard: ACI 318-19, IBC 2021, ASCE 7-22" and "Load combo: U = 1.2D + 1.6H — ACI 318-19 §5.3";
    - old §5 / §6, headed "(ACI 318-19)" with "U = 1.6H", "M_u = 1.6[…]" and "U = 1.2D + 1.6H";
    - old §4.2 (AASHTO), which wrote the sliding demand as η(1.50 P_EH + 1.75 P_LS), while the tool uses γ_EH,max.
  - The old report left out these checks, and its summary listed 9 checks. All checks are now worked and listed:
    - mid-height stem section, hook, crack control and minimum reinforcement;
    - interface shear, collision (Extreme Event II), barrier yield line and column axial.
  - The section-number gap (no 1.3) and the unlabelled materials table.
- **Provision:** none. No formula, factor, unit, code reference or result changed.
- **Saved data:** none. No key or format change (`retaincalcpro.*` and `rcp_input_tab` untouched).
- **Check case (default project, ACI basis):** 7 sections, 34 subsections, 32 letter pages (main: 9). 17 result lines, all PASS, for example:
  - O.T.: D/C = 0.20 (FOS = 7.54); Sliding: 0.91 (FOS = 1.66); Bearing: 0.49 (1.47 ksf vs q_a = 3.00 ksf).
  - Stem Flex 0.97 (§5.3), Stem Hook ℓdh 0.56 (§5.5), Heel Flex 0.97 (§6.4), Toe Shear 0.55 (§6.10).
  - Stem / Heel / Toe Crack Ctrl 0.60 / 0.80 / 0.80 (§7.5: s_max = 10.00 / 7.50 / 7.50 in, s = 6 in).
- **Check case (AASHTO with collision, barrier, yield line, interface shear, MassDOT heel and q_s = 100 psf):** 36 pages, 26 result lines.
  - Sliding: D/C = 1.49, FAIL (§4.5). This is the only status-bar failure, as on screen.
  - Heel Flex: 0.86, "MassDOT §3.3.2.2 governs". Stem–Footing Interface Shear: 0.24 (card check).

### D11 links: quoted values link to the card where they are worked (CLAUDE.md §6) (Tier 1, display only)
- **New helpers** after `fmtEqTitle()` (anchor `/* ---- D11 links (CLAUDE.md §6, 2026-10-18)`):
  - `RW_TABNAME`; `RW_CARDS` (card key → tab and title prefix per basis); `RW_CHECK_CARD` (check → card);
  - `rwCardTitle`, `rwLink`, `rwWorkedIn`, `rwGoto`, and one document click handler for `a.wkA`;
  - a click opens the tab (with the tab button's own click), scrolls to the card and flashes it.
  - CSS after `.mono   { font-family: var(--mono); }` (anchor `/* D11 links (CLAUDE.md §6)`).
- **"Worked in" lines added** (each is `h += rwWorkedIn(...)` or `${rwWorkedIn(...)}`):
  1. Stability (AASHTO), Load Combination Summary, after the "Concrete design is enveloped separately" line: Sliding → Step 4, Eccentricity → Step 5, Bearing → Step 6, Extreme Event II → Step 7b.
  2. Stability (AASHTO), Step 8, after the stem–footing interface `eqCheck`: V_u (stem base) → Stem Step 4; S1 bars → Stem Step 3.
  3. Stability (AASHTO), Step 9, after the toe crack-control `eqCheck`: S1 (s, A_s, M_u) → Stem Step 3; F1 → Heel Step 3; F2 → Toe Step 3.
  4. Stem Step 1, after "Factored shear at base": K_a → Stability Step 1; q_LS → Stability Step 2 (AASHTO with LL surcharge).
  5. Footing Heel Step 1 and Toe Step 1 (ACI basis only): q_u,back, q_u,heel and q_u,front, q_u,toe → Stability Step 7.
  6. Rebar schedule, under the bar schedule table: S1, S3, S2, F1, F2, F3, and ℓ_d of S1, F1, F2 → their cards.
- **Existing text made into links:**
  - Footing "Factored Loads on Footing" card-ref, ACI basis only. On screen the text is unchanged.
    - Before: `<span class="card-ref">bearing from Step 7 of Stability tab</span>`
    - After: `<span class="card-ref">bearing from ${r.isAASHTO ? 'Step 7 of Stability tab' : '<a class="wkA" href="#" data-card="stabFactBrg" data-intext="1">Step 7 of Stability tab</a>'}</span>`
  - Overview "Check Summary": each check label is a link to its card (tooltip "Worked in: <Tab> · <card>"). One line is added under the table: "Worked in: click a check to open the card where it is worked."
    - Before: `${Object.values(r.checks).map(c => \`` … `<td class="lbl">${c.label}</td>`
    - After: `${Object.entries(r.checks).map(([k, c]) => \`` … the label is wrapped in an `a.wkA` when its card exists.
    - ACI crack control has no card on screen and stays plain text.
- **In the report:**
  - every "→ Tab · Card" link reads "<value>: see §n.k" (a PDF link);
  - the in-text "Step 7 of Stability tab" reads "§4.7";
  - a target that is not in the printout would read "not in this printout" (none in the cases tested).
- **Check case (default):** 93 internal links, none broken. The report text reads:
  - "Ka: see §4.1"; "qu,back, qu,heel: see §4.7";
  - "S1: see §5.3 · S3: see §5.8 · S2: see §5.6 · F1: see §6.4 · F2: see §6.9 · F3: see §6.12 · ℓd S1: see §5.5 · ℓd F1: see §6.5 · ℓd F2: see §6.10".

### How verified (both entries)
- `node tests/check-syntax.mjs "Retaining Wall Designer.html"`: all scripts pass.
- `node tests/compare.mjs --tool page --file "Retaining Wall Designer.html"`:
  - page.storage is identical;
  - page.text differs only by the added line "Worked in: click a check to open the card where it is worked.";
  - the console errors on both sides come only from the CDN libraries the kit does not hold (MathJax tex-chtml 3.2.2, Plotly 2.35.2).
- **Main vs branch with the libraries served locally** (MathJax 3.2.2 and plotly.js-dist-min 2.35.2 from `npm pack`, three r128 from `tests/libs`):
  - Five cases:
    1. default (ACI);
    2. ACI with water table, k_h = 0.2, column loads, β = 10°, q_s = 250, passive and shear key;
    3. AASHTO default;
    4. AASHTO with collision, barrier, yield line, interface shear, MassDOT heel and q_s = 100;
    5. AASHTO Coulomb δ = 20°, β = 5°, rock, q_n estimated, H_s = 16, water table.
  - In every case these are identical: the full `window._R` (functions removed), every check flag and value, the status bar text and the localStorage keys. 0 console errors.
  - The result tabs' text differs only by the "Worked in" lines.
  - Building the report does not change `window._R`.
- **Headless Chromium PDF of the report** (print media, `preferCSSPageSize`), in all five cases:
  - 0 MathJax errors, no raw TeX, every internal link resolves, 6 chart images;
  - pages checked: cover; references and contents; summary; inputs; §4 cards; a chart page; the §4 / §5 result blocks; the rebar schedule with its "see §" line; the §7.5 crack-control card; the AASHTO collision card; the header and footer boxes.
- In the app, every link of the default case and the AASHTO collision case (15 and 19 targets) opens the right tab and flashes the right card.
- **Other copies:** none. The report builder and the links are specific to this tool.

### Open items (noticed, not changed)
- **AASHTO footing bearing is not worked anywhere.**
  - In AASHTO mode the factored bearing used for the footing design (q_u at toe, heel and stem faces, Strength I and Ia) has no card. The ACI basis has it in Stability Step 7.
  - The Footing card-ref "bearing from Step 7 of Stability tab" then points to the collision step (or to nothing), and the report prints it as is.
- **The AASHTO Service I row** of the Load Combination Summary (e ≤ B/6, q_max ≤ q_a) is not worked in any AASHTO card.
- **The column axial check on the AASHTO basis** (`colAxial`, when column loads are entered) has no card: the column card is ACI only. The report summary shows "—" under Worked in.
- **ACI crack control** (`crackStem/Heel/Toe`) is not worked in any tab on screen. The report now shows it (§7); the app does not.
- **Some checks have a PASS/FAIL mark in a card but are not counted in the status bar:** the stem–footing interface shear (AASHTO Step 8), and the S2 and F3 T&S bar selections. A failure there would not show in the status bar.
- **Over-stressed sections:** the Step 3 bar-selection badges (stem, heel, toe, mid-height) and the Overview scorecard test only A_s,prov ≥ A_s,des. The status-bar check also requires "not over-stressed", so they can disagree.
- **Where-block labels that do not match the equation:**
  - Stem Step 2 "assumed bar diameter (#6) 0.750" and Heel/Toe Step 3 "assumed bar diameter (#7) 0.875": the equation uses the selected bar.
  - Heel Step 3 "top clear cover 2.00" and card-ref "d = t_f − 2.0'' cover": the equation uses the footing cover input (3.00 by default).
- **ACI labels in AASHTO mode:** Stem Step 6 card-ref "ACI 318-19 §24.4.3.2"; Heel/Toe Step 4 ℓd "ACI 25.4.2"; the rebar tab's "ACI 318-19" card-ref and its notes "ACI §24.4.3".
- **The toe service moment** for AASHTO crack control is |M_u| / 1.5 (an approximation, noted in the code).

### Needs engineer
- **Report length:** the report now carries every card of the tabs (default project: 32 pages, was 9). Keep it all, or add section toggles later?
- **Checked date:** the tool has no checked-date field, so the title block and print header show "—". Add an optional tool-prefixed field?

## 2026-10-19 — PR: claude/rw-status-badges (PR link added after merge)

### Over-stressed sections: the bar-selection badges, the Overview scorecard and the rebar schedule now use the status-bar condition (engineer-approved 2026-10-19; Tier 1, display only)
- **Problem:** when a flexural section is over-stressed (R_n so large that 1 − 2R_n/(0.85 f'c) < 0), `calcAll` sets A_s,req = 0 and A_s,des = A_s,min, and the bar picked for A_s,min passes A_s,prov ≥ A_s,des. The status bar marks the flexure check FAIL, because `r.checks.stemFlex / heelFlex / toeFlex` require `!<section>_overstressed`. The Step 3 bar-selection badges (S1, F1, F2), the Overview scorecard and the rebar schedule tested only A_s,prov ≥ A_s,des and showed PASS. A displayed PASS on these now reads FAIL when the section is over-stressed (more conservative display; no value changed).
- **The status-bar condition** (`calcAll`, anchor `const checks = {`), unchanged:
  - `stemFlex: { ok: !stem_overstressed && sel_stem.As_prov >= As_stem_des - 0.001`
  - `stemMidFlex: { ok: !stemT_overstressed && sel_stemT.As_prov >= As_stemT_des - 0.001`
  - `heelFlex: { ok: !heel_overstressed && sel_heel.As_prov >= As_heel_des - 0.001`
  - `toeFlex: { ok: !toe_overstressed && sel_toe.As_prov >= As_toe_des - 0.001`
- **Changed (each `ok` argument or field only):**
  1. `renderStem`, anchor `eqCheck('Bar selection — S1 vertical, back face'`, third argument:
     - Before: `    r.sel_stem.As_prov >= r.As_stem_des - 0.001);`
     - After: `    !r.stem_overstressed && r.sel_stem.As_prov >= r.As_stem_des - 0.001);`
  2. `renderFooting`, anchor `eqCheck('Bar selection — F1 transverse '`:
     - Before: `    r.sel_heel.As_prov >= r.As_heel_des - 0.001);`
     - After: `    !r.heel_overstressed && r.sel_heel.As_prov >= r.As_heel_des - 0.001);`
  3. `renderFooting`, anchor `eqCheck('Bar selection — F2 transverse bottom'`:
     - Before: `    r.sel_toe.As_prov >= r.As_toe_des - 0.001);`
     - After: `    !r.toe_overstressed && r.sel_toe.As_prov >= r.As_toe_des - 0.001);`
  4. `buildScorecard`, the `struct` rows `Stem Flex`, `Heel Flex`, `Toe Flex`:
     - Before: `ok: r.sel_stem.As_prov >= r.As_stem_des - 0.001 },` (and `sel_heel / As_heel_des`, `sel_toe / As_toe_des`)
     - After: `ok: !r.stem_overstressed && r.sel_stem.As_prov >= r.As_stem_des - 0.001 },` (and `!r.heel_overstressed && …`, `!r.toe_overstressed && …`)
  5. `renderRebar` (the rebar schedule shows a PASS/FAIL per bar mark and an overall banner for the same checks):
     - rows S1, S3, F1, F2 get an `os` field. Before: `      overridden: r.sel_stem.overridden` (likewise `sel_stemT`, `sel_heel`, `sel_toe`). After: `      overridden: r.sel_stem.overridden, os: r.stem_overstressed` (likewise `os: r.stemT_overstressed`, `os: r.heel_overstressed`, `os: r.toe_overstressed`). S2 and F3 have no `os` (T&S bars, no over-stress flag).
     - Banner. Before: `  const allOk = rows.every(rw => rw.As_prov >= rw.As_req - 0.001);` After: `  const allOk = rows.every(rw => !rw.os && rw.As_prov >= rw.As_req - 0.001);`
     - Row status. Before: `              const ok = rw.As_prov >= rw.As_req - 0.001;` After: `              const ok = !rw.os && rw.As_prov >= rw.As_req - 0.001;`
- **Already consistent, not changed:** the mid-height S3 badge (`eqCheck('Bar selection — S3 mid-height vertical'` already had `!r.stemT_overstressed &&`); the unused `flexShearCard()` helper; the report summary result lines (`rwResultRows`, which read `r.checks[k].ok`). The report prints the tabs' cards, so its S1/F1/F2 badges follow item 1–3.
- **Provision:** none changed. Over-stress test as coded: ACI 318-19 §22.2 / AASHTO LRFD 10th Ed. Art. 5.6.3 rectangular stress block, no real root of the A_s quadratic when R_n > 0.425 f'c. No formula, factor, unit, code reference or computed value changed; only the PASS/FAIL shown.
- **Saved data:** none.
- **Check case (stem over-stressed), ACI basis, default inputs except H_s = 18 ft, t_s,bot = t_s,top = 8 in, L_h = 12 ft, L_t = 4 ft:**
  - M_u = 746,496 lb·in/ft (62.21 k·ft/ft); d = 8 − 2.00 − 0.375/2 = 5.8125 in (#3).
  - R_n = 746,496 / (0.90 × 12 × 5.8125²) = 746,496 / 364.88 = 2045.9 psi > 0.425 f'c = 0.425 × 4000 = 1700 psi; 1 − 2(2045.9)/(0.85 × 4000) = −0.203 < 0 → over-stressed.
  - A_s,req = 0 → A_s,des = A_s,min = 0.0018 × 12 × 8 = 0.1728 in²/ft; S1 #3 @ 7" → A_s,prov = 0.11 × 12 / 7 = 0.1886 ≥ 0.1728.
  - Status bar (before and after): "3 of 15 checks fail" with Stem Flex ✕ (also Stem Shear ✕, Toe Shear ✕).
  - Before: S1 badge PASS; scorecard Stem Flex green (D/C 0.92); rebar schedule S1 PASS and "✓ All reinforcement requirements satisfied."
  - After: S1 badge FAIL; scorecard Stem Flex red (D/C 0.92 unchanged); rebar S1 FAIL and the "⚠ One or more bars …" banner.
- **Check case (heel):** same defaults except H_s = 24 ft, t_s,bot = 30 in, t_s,top = 12 in, t_f = 12 in, L_h = 20 ft, L_t = 8 ft, f'c = 3000 psi: R_n,heel = 1316.5 psi > 0.425 × 3000 = 1275 psi; F1 #4 @ 9" = 0.2667 ≥ A_s,min = 0.2592. F1 badge, scorecard Heel Flex and rebar F1: PASS → FAIL; status bar Heel Flex ✕ before and after.
- **Check case (toe):** as the heel case with L_h = 8 ft, L_t = 12 ft: R_n,toe = 1311.2 psi > 1275 psi; F2 #4 @ 9" = 0.2667 ≥ 0.2592. F2 badge, scorecard Toe Flex and rebar F2: PASS → FAIL; status bar Toe Flex ✕ before and after.
- **How verified:**
  - `node tests/check-syntax.mjs "Retaining Wall Designer.html"`: all scripts pass.
  - `node tests/compare.mjs --tool page --file "Retaining Wall Designer.html"`: page.text and page.storage identical (console errors on both sides are the CDN libraries the kit does not hold).
  - Headless main vs branch (MathJax 3.2.2 and plotly.js-dist-min 2.35.2 from `npm pack`, three r128 from `tests/libs`), on the five cases of the D11 entry plus the stem, heel and toe over-stressed cases: the full `window._R` (functions removed) is identical in every case; the status bar text is identical; 0 console errors. The five D11 cases have identical tab text, badges, scorecard and rebar schedule. In the three over-stressed cases the only differences are the badge, scorecard row, rebar row and rebar banner listed above.
  - Screenshots of the S1 / F1 / F2 badges, the scorecard and the rebar schedule checked.
- **Other copies:** none.

### Open items (noticed, not changed)
- **Checks shown in cards but not counted in the status bar (decision for the engineer):**
  - Stem–footing interface shear (AASHTO Stability Step 8, `eqCheck('Stem–footing interface (S1 bars as shear friction)'`, flag `aashtoR.ish.ish_stem_ok`) is not in `r.checks`. The status-bar "Interface Shear" chip (`ishFtg`) is the footing–subfooting check (`ish_ftg_ok || dowel_ok`). A stem–footing FAIL would not show in the status bar or the scorecard.
  - In the same card, the footing-interface line shows FAIL when `ish_ftg_ok` is false even if dowels make up the deficit; the status-bar chip then reads PASS (`dowel_ok`). The dowel line in the card shows that PASS.
  - S2 (stem horizontal T&S) and F3 (footing longitudinal T&S) badges (`eqCheck('Bar selection — S2 horizontal'`, `eqCheck('Bar selection — F3 longitudinal'`) are not in `r.checks`. The rebar schedule rows and banner do count them, so the rebar banner can read FAIL while the status bar reads all pass.
  - The report lists all three as "card check, not counted in the status bar".
- **Scorecard D/C for an over-stressed section** is A_s,des / A_s,prov with A_s,des = A_s,min, so it reads below 1.0 (0.92 in the stem case) while the row is red. The over-stress is not in the D/C.
- **Rebar banner wording:** "One or more bars do not satisfy required steel area" also appears when the cause is an over-stressed section.

## 2026-10-19 — PR: claude/rw-count-card-checks (PR link added after merge)

### Card checks counted in the status bar: stem–footing interface shear, S2 and F3 T&S bars (engineer decision 2026-10-19; Tier 2, pass/fail count only)
- **Decision:** the engineer chose to COUNT the three card checks listed as open items in the claude/rw-status-badges entry, so any FAIL shows in the overall status. No computed value changes; the status bar, the Overview scorecard, the Overview Check Summary and the report summary now include them.
- **§4 callout (pass/fail logic):** before, these three checks had a PASS/FAIL mark in their cards only; the status bar could read "All N checks pass" while one of them failed. After, they are entries of `r.checks`, so a failure is counted. The check total grows by 2 (ACI) or 2–3 (AASHTO: +1 when interface shear is enabled) in every project; the failure count changes only where one of them fails.
  - Provisions (unchanged): S2 / F3 T&S: AASHTO LRFD 10th Ed. Art. 5.10.6 (Eq. 5.10.6-1), ACI 318-19 §24.4.3.2 (0.0018 b h). Stem–footing interface shear: AASHTO LRFD 10th Ed. Art. 5.7.4.3 (shear friction, φ_v = 0.90). The ACI basis has no stem–footing interface check: nothing added there.
- **Changed:**
  1. `calcAll`, `const checks = {`, after `toeShear: { ok: toe_shear_ok, label: 'Toe Shear' },` (added):
     ```
     tsStem:    { ok: sel_temp.As_prov >= As_temp_stem - 0.001,     label: 'Stem T&amp;S (S2)' },
     tsFtg:     { ok: sel_ftg_long.As_prov >= As_ftg_long - 0.001,  label: 'Ftg T&amp;S (F3)' },
     ```
     These are the same conditions as the S2 and F3 card badges (`eqCheck('Bar selection — S2 horizontal'`, `eqCheck('Bar selection — F3 longitudinal'`) and the rebar schedule rows.
  2. Same object, inside the `aashtoR.ish` spread after `ishFtg` (added):
     ```
     ishStem: { ok: aashtoR.ish.ish_stem_ok, label: 'Stem–Ftg Interface',
                val: `${f(aashtoR.ish.Vu_stem_ish,1)}≤${f(aashtoR.ish.Vr_stem,1)}k` },
     ```
     `ish_stem_ok` is the governing combined check of that interface (V_n = c A_cv + μ A_vf f_y with the S1 bars, capped by K₁ f'c A_cv and K₂ A_cv); it has no dowel term. The existing `ishFtg` (footing–subfooting: `ish_ftg_ok || dowel_ok`, i.e. concrete, plus dowels when needed) is unchanged.
  3. `RW_CHECK_CARD`: `ishFtg:'stabISH', ctSliding:'stabCT',` → `ishFtg:'stabISH', ishStem:'stabISH', tsStem:'stemTS', tsFtg:'ftgTS', ctSliding:'stabCT',` (Overview Check Summary and report links).
  4. `buildScorecard`, `struct`, after the `Toe Shear` row (added): `Stem T&amp;S (S2)` (A_s,prov vs A_s,T&S), `Ftg T&amp;S (F3)`, and on AASHTO with interface shear `Stem–Ftg Interface` (val `Vr_stem`, req `Vu_stem_ish`, k/ft), each `ok` equal to its `r.checks` entry.
  5. `rwResultRows` (report): added `ishStem`, `tsStem`, `tsFtg` to the `D` map (refs AASHTO 5.7.4.3 / 5.10.6, ACI §24.4.3.2; D/C = V_u / φV_n and A_s,req / A_s,prov). Removed the block headed `// checks worked (with a PASS/FAIL mark) in the cards but not part of the status bar` (the `xtra` note "card check, not counted in the status bar" and its three `rows.push`). The three lines now come from `r.checks` like every other result line. (`nXFail` in the report banner is left in place; it is now always 0.)
  6. Stability Step 8 card (`// ════ INTERFACE SHEAR & DOWELS ════`), so the card's headline is not misleading when concrete alone fails but the dowels make up the deficit:
     - added `const ishFtgOk = s.ish_ftg_ok || s.dowel_ok;` and the card outcome in the header: `<span class="card-ref">shear friction · φ_v = 0.90 · outcome ${pf(ishFtgOk && s.ish_stem_ok)}</span>` (before: `…φ_v = 0.90</span>`);
     - the concrete-only line is titled `'Footing interface resistance vs factored horizontal demand' + (s.dowel_needed ? ' (concrete alone; dowels below)' : '')` (its own badge still shows its own inequality);
     - added, before the "Worked in" line: `Interface shear outcome (counted in the status bar): footing–subfooting[ with dowels] PASS/FAIL · stem–footing PASS/FAIL` (alert info / fail).
  7. `renderRebar` banner wording (the banner already counted S2/F3). Before: any failure read `'⚠ One or more bars do not satisfy required steel area — review highlighted rows.'` After: an area shortfall keeps that text (adding ", and a section is over-stressed (increase thickness)" when both apply); a failure from an over-stressed section only reads `'⚠ One or more bars are in an over-stressed section (increase thickness) — review highlighted rows.'`
- **Saved data:** none (`r.checks` is not saved).
- **Check case 1 (ACI, S2 T&S):** default project, S2 override #3 @ 18".
  - A_s,T&S = 0.0018 × 12 × 18 = 0.3888 in²/ft; A_s,prov = 0.11 × 12 / 18 = 0.0733 in²/ft < 0.3888 → S2 FAIL (D/C 5.30).
  - Before: status bar "✓ All 15 checks pass"; S2 card badge FAIL; report line "Stem Horiz. T&S (S2) … card check, not counted in the status bar".
  - After: "✕ 1 of 17 checks fail" (Stem T&S (S2) ✕); scorecard row red; report line counted. F3 override #3 @ 18" gives the same with Ftg T&S (F3).
- **Check case 2 (AASHTO, stem–footing interface):** AASHTO basis, interface shear on, shear key and passive on, H_s = 10 ft, t_s,bot = 30 in, t_s,top = 12 in, L_h = 10 ft, c = 0, μ = 0.4, dowels #8 @ 12".
  - Stem–footing: A_cv = 30 × 12 = 360 in²; A_vf = A_s,des(S1) = 0.2300 in²/ft; V_n = 0 × 360 + 0.4 × 0.2300 × 60 = 5.520 kip/ft; φV_n = 0.90 × 5.520 = 4.968 < V_u = 5.293 kip/ft → FAIL (D/C 1.07).
  - Footing–subfooting: concrete alone φV_n = 0 < V_u = 6.60 kip/ft (FAIL line); dowels φμA_vf f_y = 0.90 × 0.4 × 0.79 × 60 = 17.06 ≥ deficit 6.60 → combined PASS (status-bar "Interface Shear" ✓, unchanged).
  - Before: "✓ All 19 checks pass"; card header without outcome. After: "✕ 1 of 22 checks fail" (Stem–Ftg Interface ✕), card header "outcome FAIL", outcome line "footing–subfooting with dowels PASS · stem–footing FAIL", scorecard governing D/C "Stem–Ftg Interface 1.07".
  - Same inputs with μ = 0.6: φV_n,stem = 0.90 × 0.6 × 0.2300 × 60 = 7.45 ≥ 5.29 PASS; dowels 25.6 ≥ 6.60. Concrete-alone line still FAIL, card header now reads "outcome PASS" and status "All 22 checks pass".
- **How verified:**
  - `node tests/check-syntax.mjs`: all scripts pass. `node tests/compare.mjs --tool page`: page.storage identical; page.text differs by the status count and the added Check Summary rows (expected).
  - Headless main (48d7588) vs branch, MathJax 3.2.2 / Plotly 2.35.2 from `npm pack`, 13 cases: the 5 D11 cases, the stem/heel/toe over-stressed cases of the previous entry, S2 fail, F3 fail, the two interface cases above, and c = 0 / μ = 0.01. `window._R` with `checks` removed is identical in every case; `checks` differs only by the added `tsStem`, `tsFtg` (and `ishStem` on AASHTO with interface shear); every existing check's label/ok/val is unchanged. The failure count changes only in the S2, F3 and stem–footing failing cases. Report result lines: the three "card check, not counted" lines are replaced by the counted lines with the same PASS/FAIL and D/C. 0 console errors.
  - Screenshots of the Step 8 card, the scorecard and the status bar checked.
- **Other copies:** none.

## 2026-10-19 — PR: claude/aashto10-retwall — AASHTO mode: ℓd and stem hook per AASHTO LRFD 10th Ed. 5.10.8.2.1a / 5.10.8.2.4a; Table 3.11.6.4.1-1/-2 renumbers (PR link added after merge)

The file uses CRLF line endings; keep them. ACI mode unchanged.

### R1. Tension development length (AASHTO mode)   [calculation change (§4)]
- **Where:** `devLengthAASHTO` (anchor `// AASHTO LRFD 10th Ed. (2024) §5.10.8.2.1a — tension development length (in)`), now a wrapper of the new `devLengthAASHTOParts`. Callers (stem, heel with top-bar factor, toe) unchanged.
- **Before:**
  ```js
  const ldb = 2.4 * db * (fy/1000) / Math.sqrt(fc/1000);
  const cb  = Math.min(cover_to_ctr, (spacing > 0 ? spacing : Infinity) / 2);
  const lam_rc = Math.min(1.0, Math.max(0.4, db / Math.max(cb, 1e-6)));
  const lam_rl = top ? 1.3 : 1.0;
  return Math.max(12, ldb * lam_rl * lam_rc);
  ```
- **After:**
  ```js
  const fc4 = Math.pow(Math.min(fc/1000, 15), 0.25);
  const ldb = 0.17 * db * Math.pow((fy/1000) / (1.97 * fc4), 2);
  const cb  = Math.min(cover_to_ctr, (spacing > 0 ? spacing : Infinity) / 2);
  const lam_rc_raw = cb > 0 ? db * cb / Math.pow(cb, 2) : 1.0;
  const lam_rc = Math.min(1.0, Math.max(0.3, lam_rc_raw));
  const lam_rl = top ? 1.3 : 1.0;
  return { fc4, ldb, cb, lam_rc_raw, lam_rc, lam_rl, ld: Math.max(12, ldb * lam_rl * lam_rc) };
  ```
  ℓdb = 0.17·db·[(λer·fy − Fh/Ab)/(1.97·λ·f′c^0.25)]² with λer = λ = 1.0, Fh = 0; ℓd = ℓdb·λrl·λcf·λrc ≥ 12 in., λcf = 1.0; λrc = db·cb/(cb(1−βt) + 1.67·ns·ktr)² with βt = 0, ktr = 0 (no transverse steel credited, as before) = db/cb, bounded **0.3**–1.0 (was 0.4–1.0); f′c ≤ 15 ksi. Same implementation as `ACI Rebar Development Length.html` (PR claude/aashto10-rebar), duplicated per CLAUDE.md §3.
- **Provision:** AASHTO LRFD 10th Ed. (2024) Art. 5.10.8.2.1a (Eqs. 5.10.8.2.1a-1, -2), 5.10.8.2.1c (Eqs. 5.10.8.2.1c-1, -2).

### R2. Stem bar standard hook (AASHTO mode)   [calculation change (§4)]
- **Where:** new `hookAASHTOParts(bar, fy, fc, lam_rc)`; `hookDevLength(db, fy, fc, isAASHTO, bar, lam_rc)` AASHTO branch; call `const ldh_stem = hookDevLength(sel_stem.bar.db, inp.fy, inp.fc, isAASHTO, sel_stem.bar, ldA_stem ? ldA_stem.lam_rc : 1.0);`.
- **Before:** `ldh = 38 * db / Math.sqrt(fc/1000) * (fy/1000/60)`, ≥ max(8db, 6 in.) (λrc = λcw = λer = 1.0).
- **After:** ℓdh = ℓd + R + db/2 ≥ max(8db, 6 in.) (Eq. 5.10.8.2.4a-1), ℓd = ℓdb·λrl·λcf·λrc with ℓdb from Eq. 5.10.8.2.1a-2 and Fh = db·R·v·f′c (Eq. 5.10.8.2.4a-2); v = 0.85 − f′c/20, 0.45 ≤ v ≤ 0.65 (Table 5.8.2.5.3a-1, CTT node); R = D/2 + db/2 with the minimum finished bend D of Table 5.10.2.3-1 (6db #3–#8, 8db #9–#11, 10db #14–#18; smallest R = longest ℓdh); λrl = 1.0 (vertical stem bar), λcf = 1.0, **λrc = that of the straight stem bar (same c_b)**, as in the ACI Rebar tool; no tie reduction (5.10.8.2.4b); bracket ≤ 0 taken as 0.
- **Note on λrc:** the old "λrc = 1.0, no confinement credit" was the 9th Ed. hook *tie* factor (0.8 with ties). In the 10th Ed. ties are a separate 0.8 factor (not taken here) and λrc in the hook's straight portion is the cover/spacing factor of 5.10.8.2.1c, so it is applied as for straight bars. Taking λrc = 1.0 instead would give ℓdh = 34.7 in. in the default AASHTO case (hook check FAIL vs 15.0 in. available); flagged as an open item.
- **Provision:** AASHTO LRFD 10th Ed. Art. 5.10.8.2.4a (Eqs. 5.10.8.2.4a-1, -2), 5.10.8.2.4b, Table 5.8.2.5.3a-1, Table 5.10.2.3-1.

### R3. Display / citations
- Step 5 (stem): ℓdb, λrc and ℓd worked symbolically → substituted → result; a new line works R, v, Fh, ℓdb, ℓd and ℓdh of the hook; the hook check row text reads "ℓdh = ℓd + R + d_b/2 (10th Ed.), no tie reduction". Heel and toe development rows cite "AASHTO 5.10.8.2.1a" in AASHTO mode (were "ACI 25.4.2" in both modes; ACI text unchanged).
- Table renumbers: "Table 3.11.6.4-2" → **Table 3.11.6.4.1-2** (h_eq source option, `heqAASHTO` comments). **Citation correction:** the Step 2 card, its equation reference, the drawing tooltip and the references row cited "Table 3.11.6.4-1" (abutments perpendicular to traffic, 4.0/3.0/2.0 ft), while `heqAASHTO` uses the wall table values (5.0/3.5/2.0 ft at 0 ft distance, 2.0 ft at ≥ 1 ft) — now cited as **Table 3.11.6.4.1-2** with Art. **3.11.6.4.1**. Values unchanged.

### Check case (AASHTO, default project: H = 13.5 ft, f′c 4 ksi, fy 60 ksi, stem #5 @ 7 in. cover 2 in., heel #5 @ 8 in. top, toe #3, footing cover 3 in., t_f available 15.0 in.)
- f′c^0.25 = 1.4142; ℓdb(#5) = 0.17 × 0.625 × (60/2.786)² = 49.28 in. (before 2.4 × 0.625 × 60/2 = 45.0 in.).
- Stem: c_b = min(2 + 0.3125, 7/2) = 2.3125 in.; λrc = 0.625/2.3125 = 0.270 → **0.30** (before → 0.40). ℓd = max(49.28 × 0.30, 12) = **14.78 in.** (before 45.0 × 0.4 = 18.00 in.).
- Heel (top, λrl 1.3, c_b = min(3.3125, 4) → λrc 0.30): ℓd = 49.28 × 1.3 × 0.30 = **19.22 in.** (before 23.40 in.). Toe #3: 12 in. both.
- Hook (#5): R = 3 × 0.625 + 0.3125 = 2.1875 in.; v = 0.85 − 0.20 = 0.65; Fh = 0.625 × 2.1875 × 0.65 × 4 = 3.555 kip; Fh/Ab = 11.47 ksi; ℓdb = 0.17 × 0.625 × ((60 − 11.47)/2.786)² = 32.24 in.; ℓd = 32.24 × 0.30 = 9.67 in.; ℓdh = 9.67 + 2.1875 + 0.3125 = **12.17 in.** ≤ 15.0 in. PASS (before 38 × 0.625/2 × 1 = 11.88 in.).
- Same at f′c = 8 ksi: ℓd stem 12.73 → **12.00** (min.), heel 16.55 → **13.59**, hook 8.40 → **8.15 in.**

### How verified
- `node tests/check-syntax.mjs "Retaining Wall Designer.html"`: all scripts pass.
- Headless (`calcAll`), main vs branch: AASHTO at f′c 4 and 8 ksi give the numbers above; ACI identical (stem 12.00, hook 8.46, heel 14.80, toe 12.00 in.); warnings unchanged. `tests/compare.mjs --tool page` (default ACI): page text and storage identical. The new TeX of Step 5 renders in KaTeX 0.16.9 (other pre-existing "·" in \text warnings unchanged).
- **Other copies:** `ACI Rebar Development Length.html` (all factors), the Development & Splice tab of `Concrete Beam Capacity.html`, `abutment_calculator.html` (ℓd only).

### Open items (engineer decision)
- Straight-bar ℓd in AASHTO mode is now shorter than before in the default case (λrc floor 0.3 instead of 0.4 outweighs the larger ℓdb). That is the 10th Ed. result; confirm.
- Hook λrc: applied from the stem bar's c_b (see R2 note). Use 1.0 (no cover credit) instead? Then the default AASHTO hook (34.7 in.) does not fit the 18 in. footing.
