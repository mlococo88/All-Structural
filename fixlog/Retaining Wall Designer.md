# Fix log — Retaining Wall Designer.html

Governing basis used for fixes: AASHTO LRFD 10th Ed. (2024); ACI 318-19. MassDOT-specific items are unchanged.

## 2026-10-04 — PR: claude/fix-retaining-wall (PR #9: https://github.com/mlococo88/All-Structural/pull/9)

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

## 2026-10-04 — PR: claude/step1-group2 (PR #31: https://github.com/mlococo88/All-Structural/pull/31)

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

## 2026-10-09 — PR: claude/pin-retainingwall (PR #76: https://github.com/mlococo88/All-Structural/pull/76)

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

## 2026-10-12 — PR: claude/sweep-retwall (open-item sweep; PR #128: https://github.com/mlococo88/All-Structural/pull/128)

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

## 2026-10-18 — PR: claude/rw-d11-report (PR #281: https://github.com/mlococo88/All-Structural/pull/281)

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

## 2026-10-19 — PR: claude/rw-status-badges (PR #316: https://github.com/mlococo88/All-Structural/pull/316)

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

## 2026-10-19 — PR: claude/rw-count-card-checks (PR #317: https://github.com/mlococo88/All-Structural/pull/317)

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

## 2026-10-19 — PR: claude/aashto10-retwall — AASHTO mode: ℓd and stem hook per AASHTO LRFD 10th Ed. 5.10.8.2.1a / 5.10.8.2.4a; Table 3.11.6.4.1-1/-2 renumbers (PR #346: https://github.com/mlococo88/All-Structural/pull/346)

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

## 2026-11-01 — PR: claude/rpt-retwall — Report output tab in the shared report viewer (RWRP; display only, no calculation change) (PR #549: https://github.com/mlococo88/All-Structural/pull/549)

The tool file uses CRLF line endings; keep them. Line numbers are approximate; search for the anchor text. Every code site is tagged `RWRP`.

### RWRP. "Report" output tab (shared/report.js, shared/steps.js, KaTeX 0.16.9)   [display only]
- **Engineer request (2026-11-01):** a Report output tab in the shared viewer used by the Steel Bridge app and Spread Footing: navigation tree, numbered sections, worked steps (equation → substituted values → result, CLAUDE.md §6), steps grouped by topic, "see §x.y" links and links back to the tool's tabs, print to PDF with a title block (no owner cell), running header and page numbers.
- **Engineer decision (2026-11-01):** add KaTeX 0.16.9 (pinned, the same cdnjs tags as `apps/steel-bridge/index.html`) for the Report tab; the result tabs keep MathJax 3.2.2. Without KaTeX (offline, CDN blocked) the shared viewer's built-in renderer sets the steps (checked: same report, 0 errors other than the blocked CDN requests).
- **Coordinator decision (2026-11-01):** the Export report window (D11 pop-up) and Ctrl+P from the other tabs are unchanged; the Report tab is added alongside.
- **Loads (head, after the MathJax tag):** `katex.min.css` and `katex.min.js` 0.16.9 from cdnjs, then `<script src="shared/steps.js">` and `<script src="shared/report.js">` (classic scripts, relative path). The tool now needs the `shared` folder next to it (it is in the repository). Without that folder only the Report tab shows an error; every other tab is unaffected.
- **HTML:** tab button `<button class="tab-btn" data-tab="report">Report</button>` after "3D model"; panel `<div class="tab-panel tex2jax_ignore" id="tab-report"></div>` after `#tab-threed` (class `tex2jax_ignore`: MathJax's `typesetActivePanel` leaves the KaTeX output alone).
- **CSS (main page `@media print`):** `#tab-report:not(.active) { display: none !important; }` after `.tab-panel { display: block !important; max-width: none; }`, so Ctrl+P from any other tab prints the page exactly as before.
- **`onInputChange()`:** one line after `typesetActivePanel();`: `if (typeof renderRwReport === 'function' && document.getElementById('tab-report')?.classList.contains('active')) renderRwReport();   // RWRP` (the report follows the inputs while it is shown).
- **New code** (one `<script>` block after the main script, anchor `REPORT TAB (RWRP, 2026-11-01)`):
  - `rwrModel(r)` builds the report model from `window._R` (`calcAll`) and the D/C values of `rwResultRows(r)` (the same function the Export report uses); `rwrItem()` groups a list of steps into topics with `SharedSteps.group`.
  - `renderRwReport()` mounts the viewer (`SharedReport.mount`) when the tab is opened and on input changes while it is shown.
  - `rwrGoto()` handles the in-app links: `[[tab:<tab>|…]]` opens a result tab; `[[tab:card:<key>|…]]` opens the card with the existing D11 `rwGoto(key)` (scroll + flash).
  - A `beforeprint` listener: Ctrl+P while the Report tab is shown prints the report alone (`#rp-print`, `body.rp-printing`, the shared running header).
- **Sections** (both bases; the stability section follows the basis):
  1. Design summary: every `r.checks` entry (the status bar), its value, D/C (as the Export report: `rwResultRows`), basis, PASS/FAIL and a § link to the step where it is worked.
  2. Input parameters: project, wall geometry (with the Overview wall drawing `buildOverviewSVG`), soil / water / loading, materials / cover / design options (AASHTO options on that basis), column / beam loads.
  3. Stability. ACI basis: Steps 1–7 of the Stability tab (K_a, K_p; lateral forces in three topics; weights and moments; overturning with D/C = 1.5 / FOS; sliding; bearing with the bearing diagram `buildBearingDiagram`; factored bearing, both envelopes), column combinations, Mononobe-Okabe detail. AASHTO basis: the load-combination table (cells link to the steps), Steps 1–9 of the AASHTO Stability tab (coefficient, LS surcharge, loads, sliding, eccentricity, bearing Strength I and Ia, collision, Extreme Event II stability, yield line, interface shear, crack control and minimum reinforcement for stem, heel and toe), column combinations.
  4. Stem design: base section Steps 1–6 as six topics (demands, d, flexure and S1, shear, development / hook / cutoff, S2), mid-height section (two topics).
  5. Footing design: heel Steps 1–4, toe Steps 1–4 (topics), longitudinal T&S (F3).
  6. Reinforcement schedule: the bar table (each mark links to its bar selection); on the ACI basis the crack-control spacing (ACI 318-19 §24.3.2, as the Export report §7).
  7. Assumptions and warnings (the tool's `r.warnings`). 8. References (`RW_REFS` of the basis).
- **Values:** every step `value` is a field of `_R` (for example `r.FOS_OT`, `r.Mu_stem_lbft`, `r.sel_heel.As_prov`, `a.sliding_dcr`, `a.serv.stem.crack.s_max`) or a D/C of `rwResultRows`. Only the substitution strings are formatted. The few values the tabs show without a field of `_R` use the tab's own display expression, copied: P_a,1, P_a,2, P_a,3 (water table), M_u,soil / M_u,ES / M_u,LS of the stem, F_fr = μ ΣV_fr, θ of Mononobe-Okabe, the column combinations 2/3/4/6, V_DC = W_ftg + W_stem + W_bar, and the two terms of the ACI crack-control min( ) (as the Export report). Two check ratios that the tab shows only as "≤" are written as D/C: Strength I and Ia bearing q_u/q_R (`a.bearing_ok_max`, `a.bearing_ok_Ia` give the status) and the footing interface V_u/φV_n.
- **Titles:** subsection titles are the tab card titles ("Step 4 — Overturning check", "Heel Step 3 — Flexural steel"), so a "see §x.y" in print is easy to find on screen.
- **Title block:** Project / Project No. / Calculated by (Engineer of record) / Date / Checked by / Checked date. The tool has no date or checked-date input: both show "—" (no new saved field). Running header: "Project No. … — notes or project" / "Computed: … · Checked: …"; footer "<project> (RetainCalc Pro — Retaining Wall Designer)" and "Page X of Y".
- **Saved data:** nothing new is saved; no key or format change (`retaincalcpro.*`, `rcp_input_tab` untouched). The viewer's collapsed sections are kept in memory only (`RWRP.closed`).
- **Provision:** none. No formula, factor, unit, code reference or result changed.

### Check case (default project, ACI basis; values as on the Stability tab)
- Overturning: M_stab,OT = 123673.1 lb-ft/ft, M_OT = 16402.5 lb-ft/ft, FOS_OT = 123673.1 / 16402.5 = 7.540; D/C = 1.5 / 7.540 = 0.199 (report §3.4, summary row "O.T." D/C 0.20, §3.4).
- Sliding: FOS_SL = 1.66 (D/C 0.91, §3.5); bearing q_max = 1.47 ksf ≤ 3.00 ksf (D/C 0.49, §3.6); stem flexure D/C 0.97 (§4.1); stem hook ℓ_dh = 8.5 in ≤ 15.0 in (D/C 0.56, §4.1).
- Report: 8 sections, 21 subsections, 26 topics, 106 worked steps; 17 status-bar checks in the summary, all PASS (as the status bar).

### How verified (headless Chromium, the pinned libraries served locally: MathJax 3.2.2, KaTeX 0.16.9, Plotly 2.35.2, three r128)
- 7 cases (default ACI; ACI with water table, k_h = 0.2, column loads, β = 10°, q_s = 250, passive, shear key; ACI β = 15°, water table, triangular uplift; AASHTO default; AASHTO with collision, barrier, yield line, interface shear, MassDOT heel, q_s = 100; AASHTO at-rest with LL surcharge, column loads, general shear procedure; AASHTO Coulomb δ = 20°, rock, q_n estimated, H_s = 16, water table):
  - 106 to 138 steps, 21 to 25 subsections, 22 to 28 topics per report; 0 unresolved or duplicate references; 0 KaTeX errors; no MathJax inside the Report tab; no NaN / undefined / raw TeX in the text.
  - 35 to 41 spot values per case equal the app's (`_R` fields and the `rwResultRows` D/C), for example M_u, V_u, d, R_n, A_s,des, A_s,prov of S1/S3/F1/F2, V_c, ℓ_d, ℓ_dh, K_a, F_h, ΣV, M_stab, M_OT, FOS, e, ΣV_u, P_EH, ΣγQ, R_R, sliding DCR, q_u, s_max, K_AE, R_w, V_n, P_u/φP_n.
  - The summary lists every status-bar check (17 to 26). `_R` is unchanged by building the report. 0 console errors.
  - In-app links: a card link opens the Stability tab and flashes the card; a § link jumps within the report.
  - Ctrl+P on the Report tab: `body.rp-printing`, the report alone, @page running header (PDF: default 19 pages, AASHTO collision 22 pages). Ctrl+P on another tab: the page printout as before, the Report panel hidden.
  - Without KaTeX (CDN blocked): the report renders with the built-in renderer, same references and values.
- main vs branch, the 7 cases: `_R`, the status bar, localStorage keys and the text of the Overview, Stability, Stem design, Footing design, Rebar schedule and Analysis diagram tabs are identical; 0 console errors.
- `node tests/check-syntax.mjs "Retaining Wall Designer.html"`: all scripts pass. `node tests/engine/run.mjs report steps steps-groups report-wiring`: passed. The 390 px check found the report column wider than the screen; the same one-token fix to `shared/report.js` (`minmax(0,1fr)`) had just been merged by claude/rpt-timber (`fixlog/shared-report.md`), so this PR does not change any shared file.
- Screenshots 1280 / 390 px and the print PDFs were checked by eye (title block, contents, running header, page numbers, worked steps).

### Other copies
- None. `shared/README.md` lists the tool as a user of `steps.js` and `report.js`.

### Open items (noticed, not changed)
- The AASHTO footing bearing (q_u at the stem faces used by the heel and toe) is still not worked on a tab (open item of 2026-10-18); the report shows the values the footing uses, with a note.
- The heel and toe minimum-reinforcement checks (AASHTO, status bar) have no card on the tab; the report works them in §3 Step 9.
- At 390 px the tool shows the input panel above the tabs (existing layout); the Report tab itself fits the width.

Diff (`Retaining Wall Designer.html`, `git diff -U0` against origin/main; CR line ends removed here):

```diff
diff --git a/Retaining Wall Designer.html b/Retaining Wall Designer.html
index 147e490..d3de356 100644
--- a/Retaining Wall Designer.html	
+++ b/Retaining Wall Designer.html	
@@ -599,0 +600 @@ a.wkA:hover { text-decoration: underline; }
+  #tab-report:not(.active) { display: none !important; }   /* RWRP: the Report tab prints itself; not part of the page printout */
@@ -636,0 +638,6 @@ window.MathJax = {
+<!-- RWRP: KaTeX for the Report tab only (engineer-approved 2026-11-01; the result tabs keep MathJax), then the shared worked steps and
+     the shared report viewer (classic scripts, relative path: keep the shared folder next to this file) -->
+<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
+<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
+<script src="shared/steps.js"></script>
+<script src="shared/report.js"></script>
@@ -1316,0 +1324 @@ window.MathJax = {
+    <button class="tab-btn" data-tab="report">Report</button>
@@ -1325,0 +1334 @@ window.MathJax = {
+    <div class="tab-panel tex2jax_ignore" id="tab-report"></div>
@@ -5539,0 +5549 @@ function onInputChange() {
+  if (typeof renderRwReport === 'function' && document.getElementById('tab-report')?.classList.contains('active')) renderRwReport();   // RWRP
@@ -8689,0 +8700,511 @@ onInputChange();
+<script>
+// ================================================================
+// REPORT TAB (RWRP, 2026-11-01): the calculation report in the shared viewer
+// (shared/report.js: navigation tree, numbered sections §n.m, collapse / expand, search, Print with a title block,
+// running header and page numbers). Worked steps are shared/steps.js steps (equation → substituted values → result),
+// set by KaTeX 0.16.9 (Report tab only; the result tabs keep MathJax) or, without it, by the built-in renderer.
+// Every value shown is a value the tool has already computed (window._R from calcAll, and the D/C values of
+// rwResultRows used by the Export report); only the substitution strings are formatted here. The few products shown
+// on a tab without a field of _R (P_a,1..3, M_u,soil, θ, the column combinations, the crack-control terms) are the
+// tabs' own display expressions, copied. Nothing is saved: the report is rebuilt from _R when the tab is shown and
+// when the inputs change while it is shown. The Export report window (D11) is unchanged.
+// ================================================================
+const RWRP = { closed: new Set(), api: null, doc: null };
+const rwrN = (x, d) => SharedSteps.n(x, d == null ? 2 : d);
+const rwrP = (x, d) => (typeof x === 'number' && x < 0) ? '(' + rwrN(x, d) + ')' : rwrN(x, d);   // a negative value in parentheses inside a substitution
+const rwrPlain = s => String(s == null ? '' : s).replace(/<sub>(.*?)<\/sub>/g, '_$1').replace(/<sup>(.*?)<\/sup>/g, '^$1').replace(/<[^>]+>/g, '')
+  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
+const RWR_FC = "f^{\\prime}_{c}";
+const RWR_DEG = '^{\\circ}';
+/* a steps item; with more than one topic the steps are grouped (SharedSteps.group, one topic per list entry, in order) */
+function rwrItem(scope, list, opt) {
+  const L = list.filter(t => t && t.steps && t.steps.length);
+  const steps = [].concat(...L.map(t => t.steps));
+  const it = Object.assign({ type: 'steps', scope, steps }, opt || {});
+  if (L.length > 1) it.topics = L.map(t => { const g = SharedSteps.group(t.steps, [{ key: 'k', title: t.title, ref: t.ref, ids: () => true }], { strip: false })[0];
+    return { title: t.title, ref: t.ref || '', n: t.steps.length, cls: g.cls, chip: g.chip, res: g.res }; });
+  return it;
+}
+const rwrS = o => SharedSteps.step(o);
+const rwrCell = (v, d) => ({ t: (typeof v === 'number') ? (isFinite(v) ? rwrN(v, d) : (v > 0 ? '∞' : '—')) : String(v == null || v === '' ? '—' : v), n: typeof v === 'number' });
+
+function rwrModel(r) {
+  const inp = r.inp, A = inp.aashto, a = r.aashtoR, isA = r.isAASHTO;
+  const g = id => ((document.getElementById(id) || {}).value || '').trim();
+  const meta = { name: g('proj_name'), num: g('proj_num'), eng: g('proj_eng'), chk: g('proj_chk'), notes: g('proj_notes') };
+  const AA = s => 'AASHTO LRFD 10th Ed. ' + s;
+  const CK = {};   // r.checks key -> report key of the step that works it (for the summary)
+  const DC = {}; { const ks = Object.keys(r.checks); rwResultRows(r).forEach((x, i) => { DC[ks[i]] = x; }); }
+  const dcv = k => (DC[k] && typeof DC[k].dc === 'number') ? DC[k].dc : NaN;
+  const ok = k => !!(r.checks[k] && r.checks[k].ok);
+  const onTab = (key, txt) => (RW_CARDS[key] && rwCardTitle(key, isA)) ? { type: 'note', text: `[[tab:card:${key}|On screen: ${txt || (RW_TABNAME[RW_CARDS[key][0]] + ' tab · ' + rwCardTitle(key, isA))}]]` } : null;   // a note that is only the link: hidden in print (.rp-go)
+  const sub = (title, items) => ({ title, items: items.filter(Boolean) });
+  const fosRef = 'IBC 2021 §1807.2.3';
+  const secs = [];
+
+  /* ---------- 2. Inputs (built first; §1 summary is added in front at the end) ---------- */
+  {
+    const subs = [];
+    subs.push(sub('Project', [{ type: 'kv', rows: [
+      ['Project', meta.name || '—'], ['Project number', meta.num || '—'], ['Engineer of record', meta.eng || '—'], ['Checked by', meta.chk || '—'],
+      ...(meta.notes ? [['Notes / description', meta.notes]] : []),
+      ['Design basis', isA ? 'AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), limit-state design' : 'ACI 318-19 (concrete), IBC 2021 §1807.2.3 (stability, service loads), ASCE 7-22'],
+      ['Earth pressure', isA ? ((A.ep_method === 'coulomb' ? 'Coulomb' : 'Rankine') + ', ' + (A.ep_cond === 'atrest' ? 'at-rest' : 'active')) : 'Rankine, active']] },
+      { type: 'note', text: 'Units: lb, ft, psf, pcf unless noted; per foot of wall. Every value in this report is the value the tool computes on its result tabs (Stability, Stem design, Footing design, Rebar schedule).' }]));
+    const geo = [['Stem height H_s' + (inp.vh_enable ? ' (variable height: H_lo + 0.75(H_hi − H_lo), MassDOT §3.3.2.2)' : ''), rwrCell(inp.Hs, 2), 'ft'],
+      ['Footing thickness t_f', rwrCell(inp.tf, 1), 'in'], ['Stem thickness at base t_s,bot', rwrCell(inp.ts_bot, 1), 'in'], ['Stem thickness at top t_s,top', rwrCell(inp.ts_top, 1), 'in'],
+      ['Toe length L_t', rwrCell(inp.Lt, 2), 'ft'], ['Heel length L_h', rwrCell(inp.Lh, 2), 'ft'], ['Toe soil cover above footing D_f,add', rwrCell(inp.Df_add, 2), 'ft'],
+      ['Total toe embedment D_f = t_f + D_f,add', rwrCell(r.Df, 3), 'ft'], ['Footing width B', rwrCell(r.B, 3), 'ft'], ['Total wall height H = H_s + t_f', rwrCell(r.H, 3), 'ft'],
+      ...(inp.useShearKey ? [['Shear key depth d_k', rwrCell(inp.dk, 0), 'in']] : []),
+      ...(r.hasBarrier ? [['Barrier height / weight W_bar', rwrN(r.bar_h_ft, 2) + ' ft / ' + rwrN(r.W_bar, 0) + ' lb/ft', '–']] : [])];
+    const fig = (() => { try { return buildOverviewSVG(r); } catch (e) { return ''; } })();
+    subs.push(sub('Wall geometry', [{ type: 'table', head: ['Quantity', 'Value', 'Unit'], rows: geo },
+      fig ? { type: 'figure', svg: fig, caption: 'Wall section (as on the Overview tab)' } : null]));
+    const soil = [['Soil unit weight γ_s', rwrCell(inp.gamma_s, 0), 'pcf'], ['Friction angle φ', rwrCell(inp.phi, 0), 'deg'], ['Cohesion c', rwrCell(inp.coh, 0), 'psf'],
+      ['Backfill slope β', rwrCell(inp.beta, 0), 'deg'], ['Surcharge q_s', rwrCell(inp.q_sur, 0), 'psf'], ['Allowable bearing q_a', rwrCell(inp.qa, 0), 'psf'],
+      ['Base friction coefficient μ (ACI basis)', rwrCell(inp.mu, 4), '–'], ['Passive resistance', inp.inclPassive ? 'included' : 'neglected', '–'],
+      ...(r.hasWT ? [['Water table depth from top d_WT', rwrCell(r.wt_d, 2), 'ft'], ['Water height at footing base h_w', rwrCell(r.hw, 3), 'ft'], ['Water unit weight γ_w', rwrCell(r.gamma_w, 1), 'pcf'],
+        ['Saturated / buoyant unit weight γ_sat / γ′', rwrN(r.gamma_sat, 1) + ' / ' + rwrN(r.gamma_s_sub, 1), 'pcf'], ['Hydrostatic uplift distribution', r.upliftTri ? 'triangular' : 'uniform', '–']] : [['Water table', 'none', '–']]),
+      ...(r.hasSeismic ? [['Seismic k_h / k_v', rwrN(inp.kh, 3) + ' / ' + rwrN(inp.kv, 3), '–'], ['M-O wall friction δ', rwrCell(inp.delta_mo, 0), 'deg']] : [])];
+    subs.push(sub('Soil, water and loading', [{ type: 'table', head: ['Quantity', 'Value', 'Unit'], rows: soil }]));
+    const mat = [["Concrete f′c", rwrCell(inp.fc, 0), 'psi'], ['Steel f_y', rwrCell(inp.fy / 1000, 0), 'ksi'], ['Concrete unit weight γ_c', rwrCell(inp.gamma_c, 0), 'pcf'],
+      ['Stem cover (back face)', rwrCell(inp.cov_stem, 2), 'in'], ['Footing cover', rwrCell(inp.cov_ftg, 2), 'in'],
+      ['Heel design basis', { std: 'standard (upward relief credited)', norelief: 'no upward relief', envelope: 'envelope' }[inp.heel_basis] || inp.heel_basis, '–'],
+      ...(inp.massdot_ftg ? [['MassDOT §3.3.2.2 heel top steel rule', 'on', '–']] : [])];
+    if (isA) mat.push(['Load modifier η', rwrCell(a.eta, 2), '–'], ['φ_τ / φ_ep / φ_b', rwrN(A.phi_tau, 2) + ' / ' + rwrN(A.phi_ep, 2) + ' / ' + rwrN(A.phi_b, 2), '–'],
+      ['Base interface: ' + rwrPlain(a.fric_label), 'δ_b = ' + rwrN(a.delta_b, 1) + '°, tan δ_b = ' + rwrN(a.tanDelta, 3), '–'], ['Eccentricity limit', rwrPlain(a.e_limit_label), '–'],
+      ['Nominal bearing q_n', a.useManualQn ? 'from geotechnical report' : 'estimated as 3 q_a', '–'], ['Live-load surcharge', A.ll_surcharge ? 'on (h_eq ' + (A.heq_mode === 'manual' ? 'manual' : 'from Table 3.11.6.4.1-2') + ')' : 'off', '–'],
+      ['Shear method', A.shear_method || 'auto', '–'], ['Exposure factors γ_e (footing / stem)', rwrN(A.gamma_e1, 2) + ' / ' + rwrN(A.gamma_e2, 2), '–'],
+      ['Vehicular collision (Extreme Event II)', A.ct_enable ? 'on' : 'off', '–'], ['Interface shear check', A.ish_enable ? 'on' : 'off', '–']);
+    subs.push(sub('Materials, cover and design options', [{ type: 'table', head: ['Quantity', 'Value', 'Unit'], rows: mat }]));
+    if (r.hasCol) subs.push(sub('Column / beam loads', [{ type: 'table', head: ['Quantity', 'Value', 'Unit'], rows: [
+      ['Dead / live / snow reaction P_DL / P_LL / P_SL', rwrN(inp.col_DL, 1) + ' / ' + rwrN(inp.col_LL, 1) + ' / ' + rwrN(inp.col_SL, 1), 'kip'], ['Wind reaction P_WL (+ down)', rwrCell(inp.col_WL, 1), 'kip'],
+      ['Distribution length L_dist', rwrCell(inp.col_Ldist, 2), 'ft'], ['Column position', inp.col_pos + ' of stem', '–'], ['Moment arm from toe x_col', rwrCell(r.x_col, 3), 'ft']] }]));
+    secs.push({ title: 'Input parameters', subs });
+  }
+
+  /* ---------- 3. Stability ---------- */
+  if (!isA) {
+    const subs = [];
+    { const st = [];
+      if (inp.beta === 0) st.push(rwrS({ id: 'Ka', label: 'Active coefficient, level backfill', sym: 'K_{a}', eq: '\\tan^{2}\\left(45' + RWR_DEG + ' \\minus \\frac{\\phi}{2}\\right)', sub: '\\tan^{2}\\left(45' + RWR_DEG + ' \\minus \\frac{' + rwrN(inp.phi, 0) + RWR_DEG + '}{2}\\right)', value: r.Ka, unit: '', d: 4, ref: 'Rankine' }));
+      else st.push(rwrS({ id: 'Ka', label: 'Active coefficient, sloped backfill', sym: 'K_{a}', eq: '\\cos\\beta\\,\\frac{\\cos\\beta \\minus \\sqrt{\\cos^{2}\\beta \\minus \\cos^{2}\\phi}}{\\cos\\beta + \\sqrt{\\cos^{2}\\beta \\minus \\cos^{2}\\phi}}', sub: '\\phi = ' + rwrN(inp.phi, 0) + RWR_DEG + ',\\; \\beta = ' + rwrN(inp.beta, 0) + RWR_DEG, value: r.Ka, unit: '', d: 4, ref: 'Rankine' }));
+      st.push(rwrS({ id: 'Kp', label: 'Passive coefficient', sym: 'K_{p}', eq: '\\tan^{2}\\left(45' + RWR_DEG + ' + \\frac{\\phi}{2}\\right)', sub: '\\tan^{2}\\left(45' + RWR_DEG + ' + \\frac{' + rwrN(inp.phi, 0) + RWR_DEG + '}{2}\\right)', value: r.Kp, unit: '', d: 4, ref: 'Rankine' }));
+      subs.push(sub('Step 1 — Earth pressure coefficients', [rwrItem('st1', [{ title: 'Coefficients', steps: st }]), onTab('stabKa')])); }
+    { const T = [], s1 = [], Ka = rwrN(r.Ka, 4), gs = rwrN(inp.gamma_s, 0);
+      if (r.hasWT) {
+        s1.push(rwrS({ id: 'Pa1', label: 'Active force above the water table (moist soil)', sym: 'P_{a,1}', eq: '\\frac{1}{2} K_{a} \\gamma_{s} h_{1}^{2}', sub: '\\frac{1}{2}(' + Ka + ')(' + gs + ')(' + rwrN(r.h_above, 2) + ')^{2}', value: 0.5 * r.Ka * inp.gamma_s * r.h_above ** 2, unit: 'lb/ft', d: 1 }));
+        s1.push(rwrS({ id: 'Pa2', label: 'Active force below the water table, rectangular block from the soil above', sym: 'P_{a,2}', eq: 'K_{a} \\gamma_{s} h_{1} h_{2}', sub: '(' + Ka + ')(' + gs + ')(' + rwrN(r.h_above, 2) + ')(' + rwrN(r.h_below, 2) + ')', value: r.Ka * inp.gamma_s * r.h_above * r.h_below, unit: 'lb/ft', d: 1 }));
+        s1.push(rwrS({ id: 'Pa3', label: 'Active force below the water table, buoyant soil', sym: 'P_{a,3}', eq: '\\frac{1}{2} K_{a} \\gamma^{\\prime} h_{2}^{2}', sub: '\\frac{1}{2}(' + Ka + ')(' + rwrN(r.gamma_s_sub, 1) + ')(' + rwrN(r.h_below, 2) + ')^{2}', value: 0.5 * r.Ka * r.gamma_s_sub * r.h_below ** 2, unit: 'lb/ft', d: 1, note: 'γ′ = γ_sat − γ_w = ' + rwrN(r.gamma_sat, 1) + ' − ' + rwrN(r.gamma_w, 1) + ' pcf' }));
+        s1.push(rwrS({ id: 'Pa', label: 'Total active soil resultant', sym: 'P_{a}', eq: 'P_{a,1} + P_{a,2} + P_{a,3}', sub: '', value: r.Pa_tri, unit: 'lb/ft', d: 1 }));
+        s1.push(rwrS({ id: 'Fhyd', label: 'Hydrostatic force (water column)', sym: 'F_{hyd}', eq: '\\frac{1}{2}\\gamma_{w} h_{w}^{2}', sub: '\\frac{1}{2}(' + rwrN(r.gamma_w, 1) + ')(' + rwrN(r.hw, 2) + ')^{2}', value: r.F_hyd, unit: 'lb/ft', d: 1 }));
+      } else s1.push(rwrS({ id: 'Pa', label: 'Active soil resultant (triangular distribution)', sym: 'P_{a}', eq: '\\frac{1}{2} K_{a} \\gamma_{s} H^{2}', sub: '\\frac{1}{2}(' + Ka + ')(' + gs + ')(' + rwrN(r.H, 3) + ')^{2}', value: r.Pa_tri, unit: 'lb/ft', d: 1 }));
+      if (r.Pa_incl_deg > 0) { const iS = r.coulombThrust ? '(\\delta + \\omega)' : '\\beta';
+        s1.push(rwrS({ id: 'PaH', label: 'Horizontal component' + (r.coulombThrust ? ' (Coulomb: inclined at δ + ω)' : ' (inclined at β)'), sym: 'P_{a,H}', eq: 'P_{a}\\cos' + iS, sub: rwrN(r.Pa_tri, 1) + '\\cos(' + rwrN(r.Pa_incl_deg, 1) + RWR_DEG + ')', value: r.Pa_tri_h, unit: 'lb/ft', d: 1 }));
+        s1.push(rwrS({ id: 'PaV', label: 'Vertical component (acts downward at the heel, stabilizing)', sym: 'P_{a,V}', eq: 'P_{a}\\sin' + iS, sub: rwrN(r.Pa_tri, 1) + '\\sin(' + rwrN(r.Pa_incl_deg, 1) + RWR_DEG + ')', value: r.Pa_tri_v, unit: 'lb/ft', d: 1 })); }
+      T.push({ title: 'Active earth pressure' + (r.hasWT ? ' and water' : ''), steps: s1 });
+      const s2 = [rwrS({ id: 'Pasur', label: 'Surcharge lateral force (uniform over H)', sym: 'P_{a,sur}', eq: 'K_{a} q_{s} H', sub: '(' + Ka + ')(' + rwrN(inp.q_sur, 0) + ')(' + rwrN(r.H, 3) + ')', value: r.Pa_sur_h, unit: 'lb/ft', d: 1 })];
+      if (r.hasSeismic) s2.push(rwrS({ id: 'dPE', label: 'Seismic increment, Mononobe-Okabe (acts at 0.6H)', sym: '\\Delta P_{E}', eq: 'P_{AE} \\minus P_{a}', sub: rwrN(r.Pae, 1) + ' \\minus ' + rwrN(r.Pa_tri, 1), value: r.Pe_inc, unit: 'lb/ft', d: 1, ref: 'ASCE 7-22 §11.8', note: 'k_h = ' + rwrN(inp.kh, 3) + ', k_v = ' + rwrN(inp.kv, 3) }));
+      s2.push(rwrS({ id: 'Fh', label: 'Total horizontal driving force', sym: 'F_{h}', eq: 'P_{a,H} + P_{a,sur}' + (r.hasWT ? ' + F_{hyd}' : ''), sub: rwrN(r.Pa_tri_h, 1) + ' + ' + rwrN(r.Pa_sur_h, 1) + (r.hasWT ? ' + ' + rwrN(r.F_hyd, 1) : ''), value: r.Fh, unit: 'lb/ft', d: 1 }));
+      T.push({ title: 'Surcharge' + (r.hasSeismic ? ', seismic' : '') + ' and total thrust', steps: s2 });
+      const s3 = [rwrS({ id: 'Pp', label: 'Passive resistance at the toe (embedment D_f = ' + rwrN(r.Df, 2) + ' ft)', sym: 'P_{p}', eq: '\\frac{1}{2} K_{p} \\gamma_{s} D_{f}^{2}', sub: '\\frac{1}{2}(' + rwrN(r.Kp, 4) + ')(' + gs + ')(' + rwrN(r.Df, 3) + ')^{2}', value: r.Pp_toe, unit: 'lb/ft', d: 1,
+        note: inp.inclPassive ? 'included in sliding and overturning (P_p = ' + rwrN(r.Pp_full, 0) + ' lb/ft)' : 'neglected (option off): P_p = ' + rwrN(r.Pp_full, 0) + ' lb/ft is not counted in sliding or overturning' })];
+      if (inp.useShearKey) s3.push(rwrS({ id: 'Ppkey', label: 'Additional passive from the shear key (d_k = ' + rwrN(inp.dk, 0) + ' in)', sym: 'P_{p,key}', eq: '\\frac{1}{2}K_{p}\\gamma_{s}(D_{f} + d_{k})^{2} \\minus P_{p,toe}', sub: '', value: r.Pp_key, unit: 'lb/ft', d: 1 }));
+      T.push({ title: 'Passive resistance', steps: s3 });
+      subs.push(sub('Step 2 — Lateral driving forces', [rwrItem('st2', T), r.hasSeismic ? { type: 'note', text: 'P_AE and the Mononobe-Okabe coefficient: [[st9/Pae]].' } : null])); }
+    { const st = [], gc = rwrN(inp.gamma_c, 0);
+      st.push(rwrS({ id: 'Wftg', label: 'Footing self-weight (arm x = ' + rwrN(r.x_ftg, 3) + ' ft)', sym: 'W_{ftg}', eq: '\\gamma_{c} B t_{f}', sub: '(' + gc + ')(' + rwrN(r.B, 3) + ')(' + rwrN(r.tf_ft, 3) + ')', value: r.Wftg, unit: 'lb/ft', d: 1 }));
+      st.push(rwrS({ id: 'Wstem', label: 'Stem self-weight, trapezoid (arm x = ' + rwrN(r.x_stem, 3) + ' ft)', sym: 'W_{stem}', eq: '\\gamma_{c}\\,\\frac{t_{s,top} + t_{s,bot}}{2}\\,H_{s}', sub: '(' + gc + ')\\frac{' + rwrN(inp.ts_top, 1) + ' + ' + rwrN(inp.ts_bot, 1) + '}{2\\cdot 12}(' + rwrN(inp.Hs, 2) + ')', value: r.Wstem, unit: 'lb/ft', d: 1 }));
+      st.push(rwrS({ id: 'Wsoil', label: 'Soil block on the heel (arm x = ' + rwrN(r.x_soil, 3) + ' ft)', sym: 'W_{soil}', eq: '\\gamma_{s} H_{s} L_{h}', sub: '(' + rwrN(inp.gamma_s, 0) + ')(' + rwrN(inp.Hs, 2) + ')(' + rwrN(inp.Lh, 2) + ')', value: r.Wsoil, unit: 'lb/ft', d: 1 }));
+      if (inp.q_sur > 0) st.push(rwrS({ id: 'Wsur', label: 'Surcharge on the heel (arm x = ' + rwrN(r.x_soil, 3) + ' ft)', sym: 'W_{sur}', eq: 'q_{s} L_{h}', sub: '(' + rwrN(inp.q_sur, 0) + ')(' + rwrN(inp.Lh, 2) + ')', value: r.Wsur, unit: 'lb/ft', d: 1 }));
+      if (inp.beta > 0) st.push(rwrS({ id: 'PaV3', label: 'Vertical earth pressure component at the heel (arm x = B = ' + rwrN(r.B, 3) + ' ft)', sym: 'P_{a,V}', eq: '', sub: '', value: r.Pa_tri_v, unit: 'lb/ft', d: 1 }));
+      if (r.hasCol) st.push(rwrS({ id: 'wcol', label: 'Column / beam service load DL + LL + SL over L_dist (arm x = ' + rwrN(r.x_col, 3) + ' ft)', sym: 'w_{col}', eq: '\\frac{P_{DL} + P_{LL} + P_{SL}}{L_{dist}}', sub: '\\frac{(' + rwrN(inp.col_DL, 1) + ' + ' + rwrN(inp.col_LL, 1) + ' + ' + rwrN(inp.col_SL, 1) + ')\\times 1000}{' + rwrN(inp.col_Ldist, 1) + '}', value: r.W_col, unit: 'lb/ft', d: 1 }));
+      if (r.hasWT) st.push(rwrS({ id: 'U', label: 'Hydrostatic uplift on the base, ' + (r.upliftTri ? 'triangular' : 'uniform') + ' (destabilizing; at x = ' + rwrN(r.x_uplift, 2) + ' ft)', sym: 'U', eq: (r.upliftTri ? '\\frac{1}{2}' : '') + '\\gamma_{w} h_{w} B', sub: (r.upliftTri ? '\\frac{1}{2}' : '') + '(' + rwrN(r.gamma_w, 1) + ')(' + rwrN(r.hw, 2) + ')(' + rwrN(r.B, 3) + ')', value: r.F_uplift, unit: 'lb/ft', d: 1 }));
+      st.push(rwrS({ id: 'SumV', label: 'Total vertical force', sym: '\\sum V', eq: '\\sum W_{i}' + (r.hasWT ? ' \\minus U' : ''), sub: '', value: r.SumV, unit: 'lb/ft', d: 1 }));
+      st.push(rwrS({ id: 'Ms', label: 'Total stabilizing (resisting) moment about the toe', sym: 'M_{stab}', eq: '\\sum W_{i} x_{i}' + (r.hasWT ? ' \\minus U x_{U}' : '') + (r.Ms_Pp > 0 ? ' + P_{p,toe}\\frac{D_{f}}{3}' : ''), sub: '', value: r.Ms, unit: 'lb-ft/ft', d: 1 }));
+      subs.push(sub('Step 3 — Vertical forces and stabilizing moments about the toe', [rwrItem('st3', [{ title: 'Weights and moments', steps: st }]), { type: 'note', text: 'Moments are taken about the front-bottom corner of the toe.' }])); }
+    { const T = [], s1 = [];
+      s1.push(rwrS({ id: 'Moa', label: 'Overturning moment, active soil (resultant height y_a)', sym: 'M_{o,a}', eq: 'P_{a,H}\\,y_{a}', sub: '(' + rwrN(r.Pa_tri_h, 1) + ')(' + rwrN(r.y_Pa, 3) + ')', value: r.Mo_tri, unit: 'lb-ft/ft', d: 1 }));
+      s1.push(rwrS({ id: 'Mos', label: "Overturning moment, surcharge (resultant at H'/2)", sym: 'M_{o,s}', eq: "P_{a,sur}\\frac{H^{\\prime}}{2}", sub: '(' + rwrN(r.Pa_sur_h, 1) + ')\\frac{' + rwrN(r.Hp, 3) + '}{2}', value: r.Mo_sur, unit: 'lb-ft/ft', d: 1 }));
+      if (r.hasWT) s1.push(rwrS({ id: 'Mow', label: 'Overturning moment, hydrostatic (resultant at h_w/3)', sym: 'M_{o,w}', eq: 'F_{hyd}\\frac{h_{w}}{3}', sub: '(' + rwrN(r.F_hyd, 1) + ')\\frac{' + rwrN(r.hw, 2) + '}{3}', value: r.Mo_hyd, unit: 'lb-ft/ft', d: 1 }));
+      if (r.hasSeismic) s1.push(rwrS({ id: 'MoE', label: 'Overturning moment, seismic increment (at 0.6H)', sym: 'M_{o,E}', eq: '\\Delta P_{E}\\cdot 0.6H', sub: '(' + rwrN(r.Pe_inc, 1) + ')(' + rwrN(0.6 * r.H, 2) + ')', value: r.Mo_seis, unit: 'lb-ft/ft', d: 1 }));
+      s1.push(rwrS({ id: 'Mo', label: 'Total overturning moment', sym: 'M_{OT}', eq: '\\sum M_{o}', sub: '', value: r.Mo, unit: 'lb-ft/ft', d: 1 }));
+      T.push({ title: 'Overturning moments', steps: s1 });
+      const s2 = [rwrS({ id: 'MsOT', label: 'Resisting moment relied on for overturning (surcharge and column live / snow excluded)', sym: 'M_{stab,OT}', eq: 'M_{stab} \\minus q_{sur}L_{h}x_{sur} \\minus (P_{LL} + P_{S})_{col}x_{col}', sub: rwrN(r.Ms, 1) + ' \\minus ' + rwrN(r.Ms_OT_excl, 1), value: r.Ms_OT, unit: 'lb-ft/ft', d: 1,
+        note: 'loads that may be absent while the thrust acts are excluded from all resisting forces; they stay in the bearing check' }),
+        rwrS({ id: 'FOS', label: 'Factor of safety against overturning', sym: 'FOS_{OT}', eq: '\\frac{M_{stab,OT}}{M_{OT}}', sub: '\\frac{' + rwrN(r.Ms_OT, 1) + '}{' + rwrN(r.Mo, 1) + '}', value: r.FOS_OT, unit: '', d: 3, ref: fosRef }),
+        rwrS({ id: 'dc', label: 'Overturning check: FOS_OT ≥ 1.5 (D/C = 1.5 / FOS, as the Overview scorecard)', sym: 'D/C', eq: '\\frac{1.5}{FOS_{OT}}', sub: '\\frac{1.5}{' + rwrN(r.FOS_OT, 3) + '}', value: dcv('ot'), unit: '', d: 3, ok: ok('ot'), ref: fosRef })];
+      CK.ot = 'st4/dc';
+      T.push({ title: 'Factor of safety', ref: fosRef, steps: s2 });
+      subs.push(sub('Step 4 — Overturning check', [rwrItem('st4', T), onTab('stabOT')])); }
+    { const st = [rwrS({ id: 'SumVfr', label: 'Vertical load relied on for friction (surcharge and column live / snow excluded)', sym: '\\sum V_{fr}', eq: '\\sum V \\minus q_{sur}L_{h} \\minus (P_{LL} + P_{S})_{col}', sub: rwrN(r.SumV, 1) + ' \\minus ' + rwrN(r.V_slide_excl, 1), value: r.SumV_slide, unit: 'lb/ft', d: 1 }),
+      rwrS({ id: 'Ffr', label: 'Friction resistance at the base', sym: 'F_{fr}', eq: '\\mu\\,\\sum V_{fr}', sub: '(' + rwrN(inp.mu, 4) + ')(' + rwrN(r.SumV_slide, 1) + ')', value: inp.mu * r.SumV_slide, unit: 'lb/ft', d: 1 }),
+      rwrS({ id: 'Fr', label: 'Total sliding resistance (friction + passive)', sym: 'F_{r}', eq: '\\mu\\,\\sum V_{fr} + P_{p}', sub: rwrN(inp.mu * r.SumV_slide, 1) + ' + ' + rwrN(r.Pp, 1), value: r.Fr, unit: 'lb/ft', d: 1, note: inp.inclPassive ? 'P_p included' : 'P_p neglected (option off)' }),
+      rwrS({ id: 'FOS', label: 'Factor of safety against sliding', sym: 'FOS_{SL}', eq: '\\frac{F_{r}}{F_{h}' + (r.hasSeismic ? ' + \\Delta P_{E}' : '') + '}', sub: '\\frac{' + rwrN(r.Fr, 1) + '}{' + rwrN(r.Fh + (r.hasSeismic ? r.Pe_inc : 0), 1) + '}', value: r.FOS_SL, unit: '', d: 3, ref: fosRef }),
+      rwrS({ id: 'dc', label: 'Sliding check: FOS_SL ≥ 1.5 (D/C = 1.5 / FOS)', sym: 'D/C', eq: '\\frac{1.5}{FOS_{SL}}', sub: '\\frac{1.5}{' + rwrN(r.FOS_SL, 3) + '}', value: dcv('sliding'), unit: '', d: 3, ok: ok('sliding'), ref: fosRef })];
+      CK.sliding = 'st5/dc';
+      subs.push(sub('Step 5 — Sliding check (μ = ' + rwrN(inp.mu, 4) + ')', [rwrItem('st5', [{ title: 'Sliding', steps: st }]), onTab('stabSlide')])); }
+    { const st = [rwrS({ id: 'xR', label: 'Location of the resultant from the toe', sym: '\\bar{x}', eq: '\\frac{M_{stab} \\minus M_{OT}}{\\sum V}', sub: '\\frac{' + rwrN(r.Ms, 1) + ' \\minus ' + rwrN(r.Mo, 1) + '}{' + rwrN(r.SumV, 1) + '}', value: r.x_R, unit: 'ft', d: 4 }),
+      rwrS({ id: 'e', label: 'Eccentricity from the footing centreline (B/6 = ' + rwrN(r.B / 6, 4) + ' ft)', sym: 'e', eq: '\\frac{B}{2} \\minus \\bar{x}', sub: '\\frac{' + rwrN(r.B, 3) + '}{2} \\minus ' + rwrN(r.x_R, 4), value: r.e, unit: 'ft', d: 4 })];
+      if (!r.tension_zone) { st.push(rwrS({ id: 'qtoe', label: 'Bearing pressure at the toe, resultant within the kern (trapezoidal)', sym: 'q_{toe}', eq: '\\frac{\\sum V}{B}\\left(1 + \\frac{6e}{B}\\right)', sub: '\\frac{' + rwrN(r.SumV, 1) + '}{' + rwrN(r.B, 3) + '}\\left(1 + \\frac{6(' + rwrN(r.e, 4) + ')}{' + rwrN(r.B, 3) + '}\\right)', value: r.q_toe, unit: 'psf', d: 1 }));
+        st.push(rwrS({ id: 'qheel', label: 'Bearing pressure at the heel', sym: 'q_{heel}', eq: '\\frac{\\sum V}{B}\\left(1 \\minus \\frac{6e}{B}\\right)', sub: '\\frac{' + rwrN(r.SumV, 1) + '}{' + rwrN(r.B, 3) + '}\\left(1 \\minus \\frac{6(' + rwrN(r.e, 4) + ')}{' + rwrN(r.B, 3) + '}\\right)', value: r.q_heel, unit: 'psf', d: 1 })); }
+      else st.push(rwrS({ id: 'qmaxT', label: 'Peak bearing pressure, resultant outside the kern (triangular)', sym: 'q_{max}', eq: '\\frac{2\\sum V}{3\\bar{x}}', sub: '\\frac{2(' + rwrN(r.SumV, 1) + ')}{3(' + rwrN(r.x_R, 4) + ')}', value: r.q_max, unit: 'psf', d: 1 }));
+      st.push(rwrS({ id: 'dc', label: 'Bearing check: q_max ≤ q_a (service loads)', sym: '\\frac{q_{max}}{q_{a}}', eq: '', sub: '\\frac{' + rwrN(r.q_max, 1) + '}{' + rwrN(inp.qa, 0) + '}', value: dcv('bearing'), unit: '', d: 3, ok: ok('bearing') }));
+      CK.bearing = 'st6/dc';
+      const fig = (() => { try { return buildBearingDiagram(r); } catch (e) { return ''; } })();
+      subs.push(sub('Step 6 — Bearing pressure check (q_a = ' + rwrN(inp.qa, 0) + ' psf)', [rwrItem('st6', [{ title: 'Bearing', steps: st }]), fig ? { type: 'figure', svg: fig, caption: 'Service bearing pressure, toe to heel' } : null, onTab('stabBrg')])); }
+    { const st = [rwrS({ id: 'SumVu', label: 'Factored vertical load, U = 1.2D + 1.6H', sym: '\\sum V_{u}', eq: '1.2(W_{ftg} + W_{stem} + W_{soil}' + (r.W_bar > 0 ? ' + W_{bar}' : '') + ') + 1.6(W_{sur} + P_{a,V})' + (r.hasCol ? ' + w_{col,u}' : ''), sub: '', value: r.SumVu, unit: 'lb/ft', d: 1 }),
+      rwrS({ id: 'xRu', label: 'Factored resultant location from the toe', sym: '\\bar{x}_{u}', eq: '\\frac{M_{s,u} \\minus M_{o,u}}{\\sum V_{u}}', sub: '\\frac{' + rwrN(r.Msu, 1) + ' \\minus ' + rwrN(r.Mou, 1) + '}{' + rwrN(r.SumVu, 1) + '}', value: r.x_Ru, unit: 'ft', d: 4 }),
+      rwrS({ id: 'eu', label: 'Factored eccentricity', sym: 'e_{u}', eq: '\\frac{B}{2} \\minus \\bar{x}_{u}', sub: '\\frac{' + rwrN(r.B, 3) + '}{2} \\minus ' + rwrN(r.x_Ru, 4), value: r.e_u, unit: 'ft', d: 4 }),
+      rwrS({ id: 'qutoe', label: 'Factored bearing at the toe', sym: 'q_{u,toe}', eq: '', sub: '', value: r.qu_toe, unit: 'psf', d: 1 }),
+      rwrS({ id: 'quheel', label: 'Factored bearing at the heel', sym: 'q_{u,heel}', eq: '', sub: '', value: r.qu_heel, unit: 'psf', d: 1 }),
+      rwrS({ id: 'qufront', label: 'Factored bearing at the front (toe) face of the stem, x = ' + rwrN(inp.Lt, 2) + ' ft (linear interpolation)', sym: 'q_{u,front}', eq: '', sub: '', value: r.quf_front, unit: 'psf', d: 1 }),
+      rwrS({ id: 'quback', label: 'Factored bearing at the back (heel) face of the stem, x = ' + rwrN(inp.Lt + r.ts_bot_ft, 2) + ' ft', sym: 'q_{u,back}', eq: '', sub: '', value: r.quf_back, unit: 'psf', d: 1 })];
+      const sm = [rwrS({ id: 'SumVumin', label: 'Minimum-vertical case U = 0.9D + 1.6H (surcharge and column L / S / W omitted)', sym: '\\sum V_{u}', eq: '0.9(W_{ftg} + W_{stem} + W_{soil}' + (r.W_bar > 0 ? ' + W_{bar}' : '') + ' + P_{a,V}' + (r.hasCol ? ' + w_{col,D}' : '') + ')', sub: '', value: r.SumVu_min, unit: 'lb/ft', d: 1 }),
+        rwrS({ id: 'eumin', label: 'Factored eccentricity, minimum-vertical case', sym: 'e_{u}', eq: '', sub: '', value: r.e_u_min, unit: 'ft', d: 4 }),
+        rwrS({ id: 'qutoemin', label: 'Factored bearing at the toe, minimum-vertical case', sym: 'q_{u,toe}', eq: '', sub: '', value: r.qu_toe_min, unit: 'psf', d: 1 }),
+        rwrS({ id: 'quheelmin', label: 'Factored bearing at the heel, minimum-vertical case', sym: 'q_{u,heel}', eq: '', sub: '', value: r.qu_heel_min, unit: 'psf', d: 1 }),
+        rwrS({ id: 'qufrontmin', label: 'Factored bearing at the front face of the stem, minimum-vertical case', sym: 'q_{u,front}', eq: '', sub: '', value: r.quf_front_min, unit: 'psf', d: 1 }),
+        rwrS({ id: 'qubackmin', label: 'Factored bearing at the back face of the stem, minimum-vertical case', sym: 'q_{u,back}', eq: '', sub: '', value: r.quf_back_min, unit: 'psf', d: 1 })];
+      subs.push(sub('Step 7 — Factored bearing for footing design', [rwrItem('st7', [{ title: 'U = 1.2D + 1.6H (+ 1.0E)', ref: 'ACI 318-19 §5.3', steps: st }, { title: 'U = 0.9D + 1.6H (footing design envelope)', ref: 'ACI 318-19 §5.3', steps: sm }]), onTab('stabFactBrg')])); }
+    secs.push({ title: 'Stability analysis (service, unfactored)', subs, key: 'stab' });
+  } else {
+    const subs = [], E = a.ct ? a.ct.ee2 : null;
+    const lc = [['Strength I', 'γ_EH = ' + rwrN(a.gEH_max, 2) + ' / 0.90, γ_EV = 1.35 / 1.00, γ_LS = 1.75; φ_τ = ' + rwrN(A.phi_tau, 2) + ', φ_b = ' + rwrN(A.phi_b, 2),
+      { t: 'DCR ' + rwrN(a.sliding_dcr, 2), cls: a.sliding_ok_A ? 'ok' : 'ng', key: 'sa4/dc' }, { t: 'e = ' + rwrN(Math.abs(a.e_A), 2) + ' ≤ ' + rwrN(a.e_limit, 2), cls: a.ecc_ok_A ? 'ok' : 'ng', key: 'sa5/dc' }, { t: rwrN(a.q_ult_gov / 1000, 2) + ' ≤ ' + rwrN(a.q_R_A / 1000, 2) + ' ksf', cls: a.bearing_ok_A ? 'ok' : 'ng', key: 'sa6/dc' }]];
+    if (E) lc.push(['Extreme Event II (collision)', 'γ_CT = 1.0, γ_EH = ' + (E.ehDropped ? '0 (MassDOT)' : '1.0') + ', γ_LS = ' + rwrN(E.gLS_ct, 2) + '; φ = ' + rwrN(E.phi_ct, 2),
+      { t: 'DCR ' + rwrN(E.sliding_dcr_ct, 2), cls: E.sliding_ok_ct ? 'ok' : 'ng', key: 'sa7b/sl' }, { t: 'e = ' + rwrN(Math.abs(E.e_ct), 2) + ' ≤ ' + rwrN(E.e_lim_ct, 2), cls: E.ecc_ok_ct ? 'ok' : 'ng', key: 'sa7b/ec' }, { t: rwrN(E.q_ult_ct / 1000, 2) + ' ≤ ' + rwrN(E.q_R_ct / 1000, 2) + ' ksf', cls: E.bearing_ok_ct ? 'ok' : 'ng', key: 'sa7b/br' }]);
+    lc.push(['Service I', 'all γ = 1.0', { t: '—', cls: 'na' }, { t: 'e = ' + rwrN(Math.abs(r.e), 2) + (Math.abs(r.e) <= r.B / 6 ? ' ≤ ' : ' > ') + 'B/6', cls: Math.abs(r.e) <= r.B / 6 ? 'ok' : 'ng' }, { t: rwrN(r.q_max / 1000, 2) + ' ≤ ' + rwrN(inp.qa / 1000, 2) + ' ksf', cls: r.bearing_ok ? 'ok' : 'ng' }]);
+    subs.push(sub('Load combination summary', [{ type: 'table', wide: true, caption: 'AASHTO LRFD 10th Ed. Table 3.4.1-1: governing result per check', head: ['Limit state', 'Key factors', 'Sliding', 'Eccentricity', 'Bearing'], rows: lc },
+      { type: 'note', text: 'Concrete design is enveloped separately: Strength I vs Extreme Event II' + (r.stem_ee2_governs ? ' (Extreme Event II governs the stem)' : '') + (r.heel_md_governs ? '; MassDOT §3.3.2.2 governs the heel top steel' : '') + '. The Service I row is a status-bar check of the tool (e ≤ B/6, q_max ≤ q_a with the service values of the ACI-format stability, not worked on the AASHTO tab).' }]));
+    { const st = [], ph = rwrN(inp.phi, 0) + RWR_DEG;
+      if (A.ep_cond === 'atrest') st.push(rwrS({ id: 'K', label: 'At-rest coefficient (Jaky, OCR-corrected)', sym: 'K_{0}', eq: '(1 \\minus \\sin\\phi)\\,OCR^{\\sin\\phi}', sub: '(1 \\minus \\sin ' + ph + ')(' + rwrN(A.ocr, 1) + ')^{\\sin ' + ph + '}', value: r.Ka, unit: '', d: 4, ref: AA('Art. 3.11.5.2') }));
+      else if (A.ep_method === 'coulomb') { st.push(rwrS({ id: 'K', label: 'Coulomb active coefficient', sym: 'K_{a}', eq: '\\frac{\\sin^{2}(\\theta + \\phi)}{\\Gamma\\,\\sin^{2}\\theta\\,\\sin(\\theta \\minus \\delta)}', sub: '\\phi = ' + ph + ',\\; \\delta = ' + rwrN(A.delta, 0) + RWR_DEG + ',\\; \\beta = ' + rwrN(inp.beta, 0) + RWR_DEG + ',\\; \\theta = ' + rwrN(90 - A.batter, 2) + RWR_DEG, value: r.Ka, unit: '', d: 4, ref: AA('Art. 3.11.5.3'),
+        note: 'Γ = [1 + √(sin(φ + δ) sin(φ − β) / (sin(θ − δ) sin(θ + β)))]²' + (r.coulombDeltaWarn ? '; Coulomb wall friction on a cantilever wall: see the warning on the Stability tab (heel ' + (r.heelLongForRankine ? 'long: Rankine for stability' : 'short') + ')' : '') })); }
+      else st.push(rwrS({ id: 'K', label: 'Rankine active coefficient', sym: 'K_{a}', eq: '\\tan^{2}\\left(45' + RWR_DEG + ' \\minus \\frac{\\phi}{2}\\right)', sub: '\\tan^{2}\\left(45' + RWR_DEG + ' \\minus \\frac{' + ph + '}{2}\\right)', value: r.Ka, unit: '', d: 4, ref: AA('Art. 3.11.5.3') }));
+      st.push(rwrS({ id: 'Kp', label: 'Passive coefficient (toe resistance)', sym: 'K_{p}', eq: '', sub: '', value: r.Kp, unit: '', d: 4, ref: AA('Art. 3.11.5.4') }));
+      subs.push(sub('Step 1 — Earth pressure coefficient', [rwrItem('sa1', [{ title: 'Coefficients', steps: st }]), onTab('stabKa')])); }
+    if (A.ll_surcharge) subs.push(sub('Step 2 — Live-load surcharge (equivalent soil height)', [rwrItem('sa2', [{ title: 'Surcharge', steps: [
+      rwrS({ id: 'heq', label: A.heq_mode === 'manual' ? 'Equivalent height (manual override)' : 'Equivalent height from the wall height H = ' + rwrN(r.H, 2) + ' ft (interpolated)', sym: 'h_{eq}', eq: '', sub: '', value: a.heq, unit: 'ft', d: 2, ref: AA('Table 3.11.6.4.1-2') }),
+      rwrS({ id: 'qLS', label: 'Equivalent surcharge pressure', sym: 'q_{LS}', eq: '\\gamma_{s}\\,h_{eq}', sub: '(' + rwrN(inp.gamma_s, 0) + ')(' + rwrN(a.heq, 2) + ')', value: a.q_ll_aashto, unit: 'psf', d: 0, ref: AA('Art. 3.11.6.4') })] }]), onTab('stabLS')]));
+    { const st = [rwrS({ id: 'PEH', label: 'Horizontal earth pressure resultant EH (at y = ' + rwrN(a.y_EH, 2) + ' ft)', sym: 'P_{EH}', eq: r.hasWT ? '\\text{3-block effective-stress resultant on } H^{\\prime}' : '\\frac{1}{2}K_{a}\\gamma_{s} H^{\\prime 2}' + (inp.beta > 0 ? '\\cos\\beta' : ''), sub: r.hasWT ? '' : '\\frac{1}{2}(' + rwrN(r.Ka, 4) + ')(' + rwrN(inp.gamma_s, 0) + ')(' + rwrN(r.Hp, 2) + ')^{2}' + (inp.beta > 0 ? '\\cos ' + rwrN(inp.beta, 0) + RWR_DEG : ''), value: a.P_EH, unit: 'lb/ft', d: 0, ref: AA('Art. 3.11.5') })];
+      if (A.ll_surcharge) st.push(rwrS({ id: 'PLS', label: "Live-load surcharge horizontal LS (at y = H'/2 = " + rwrN(a.y_LS, 2) + ' ft)', sym: 'P_{LS}', eq: 'K_{a}\\,q_{LS}\\,H^{\\prime}', sub: '(' + rwrN(r.Ka, 4) + ')(' + rwrN(a.q_ll_aashto, 0) + ')(' + rwrN(r.Hp, 2) + ')', value: a.P_LS, unit: 'lb/ft', d: 0, ref: AA('Art. 3.11.6.4') }));
+      st.push(rwrS({ id: 'VDC', label: 'Vertical dead load of the structure DC', sym: 'V_{DC}', eq: 'W_{ftg} + W_{stem}' + (r.W_bar > 0 ? ' + W_{bar}' : ''), sub: rwrN(r.Wftg, 0) + ' + ' + rwrN(r.Wstem, 0) + (r.W_bar > 0 ? ' + ' + rwrN(r.W_bar, 0) : ''), value: r.Wftg + r.Wstem + r.W_bar, unit: 'lb/ft', d: 0 }));
+      st.push(rwrS({ id: 'VEV', label: 'Vertical earth load EV' + (r.Wwedge > 0 ? ' (soil on the heel + slope wedge)' : ' (soil on the heel)'), sym: 'V_{EV}', eq: 'W_{soil}', sub: '', value: r.Wsoil, unit: 'lb/ft', d: 0 }));
+      if (r.Pa_tri_v > 0) st.push(rwrS({ id: 'VEHv', label: 'Vertical component of the earth thrust (factored as EH, not EV)', sym: 'V_{EH,v}', eq: 'P_{a,V}', sub: '', value: r.Pa_tri_v, unit: 'lb/ft', d: 0 }));
+      if (a.V_up > 0) st.push(rwrS({ id: 'U', label: 'Water uplift on the base (WA, γ = 1.0), subtracted', sym: 'U', eq: '\\gamma_{w} h_{w} B', sub: '', value: a.V_up, unit: 'lb/ft', d: 0 }));
+      subs.push(sub('Step 3 — Unfactored load components (per ft of wall)', [rwrItem('sa3', [{ title: 'Loads', steps: st }])])); }
+    { const st = [rwrS({ id: 'Q', label: 'Factored sliding demand (γ_EH = ' + rwrN(a.gEH_max, 2) + ', γ_LS = 1.75)', sym: '\\sum\\gamma Q', eq: '\\eta(' + rwrN(a.gEH_max, 2) + '\\,P_{EH} + 1.75\\,P_{LS}' + (a.P_ES > 0 ? ' + 1.50\\,P_{ES}' : '') + (a.P_hyd > 0 ? ' + 1.00\\,P_{WA}' : '') + ')', sub: rwrN(a.eta, 2) + '(' + rwrN(a.gEH_max, 2) + '\\cdot' + rwrN(a.P_EH, 0) + ' + 1.75\\cdot' + rwrN(a.P_LS, 0) + (a.P_ES > 0 ? ' + 1.50\\cdot' + rwrN(a.P_ES, 0) : '') + (a.P_hyd > 0 ? ' + 1.00\\cdot' + rwrN(a.P_hyd, 0) : '') + ')', value: a.H_drive_str, unit: 'lb/ft', d: 0, ref: AA('Table 3.4.1-1') }),
+      rwrS({ id: 'RR', label: 'Factored friction resistance (minimum vertical 0.90DC + 1.00EV' + (r.Pa_tri_v > 0 ? ' + 0.90EH,v' : '') + ')', sym: 'R_{R}', eq: '\\phi_{\\tau}(0.90\\,V_{DC} + 1.00\\,V_{EV}' + (r.Pa_tri_v > 0 ? ' + 0.90\\,V_{EH,v}' : '') + (a.V_up > 0 ? ' \\minus U' : '') + ')\\tan\\delta_{b}', sub: '(' + rwrN(A.phi_tau, 2) + ')(' + rwrN(a.V_resist_min, 0) + ')(' + rwrN(a.tanDelta, 3) + ')', value: a.R_tau, unit: 'lb/ft', d: 0, ref: AA('Art. 10.6.3.4, Table 11.5.7-1'), note: 'δ_b = ' + rwrN(a.delta_b, 1) + '°, basis: ' + rwrPlain(a.fric_label) }),
+      rwrS({ id: 'Rep', label: 'Factored passive resistance' + (inp.inclPassive ? '' : ' (passive neglected, option off: P_p = ' + rwrN(r.Pp_full, 0) + ' lb/ft not counted)'), sym: '\\phi_{ep}P_{p}', eq: '', sub: '(' + rwrN(A.phi_ep, 2) + ')(' + rwrN(r.Pp, 0) + ')', value: a.R_ep, unit: 'lb/ft', d: 0 }),
+      rwrS({ id: 'Rs', label: 'Total sliding resistance', sym: 'R_{R} + \\phi_{ep}P_{p}', eq: '', sub: rwrN(a.R_tau, 0) + ' + ' + rwrN(a.R_ep, 0), value: a.R_slide, unit: 'lb/ft', d: 0 }),
+      rwrS({ id: 'dc', label: 'Sliding check: resistance ≥ demand', sym: 'DCR', eq: '\\frac{\\sum\\gamma Q}{R_{R} + \\phi_{ep}P_{p}}', sub: '\\frac{' + rwrN(a.H_drive_str, 0) + '}{' + rwrN(a.R_slide, 0) + '}', value: a.sliding_dcr, unit: '', d: 3, ok: ok('sliding'), ref: AA('Art. 10.6.3.4') })];
+      CK.sliding = 'sa4/dc';
+      subs.push(sub('Step 4 — Sliding resistance (Strength I)', [rwrItem('sa4', [{ title: 'Sliding', steps: st }]), onTab('stabSlide')])); }
+    { const st = [rwrS({ id: 'Mo', label: 'Factored overturning moment about the toe (maximum horizontal)', sym: 'M_{o}', eq: '\\eta(' + rwrN(a.gEH_max, 2) + '\\,P_{EH}y_{EH} + 1.75\\,P_{LS}y_{LS}' + (a.P_hyd > 0 ? ' + P_{WA}y_{WA}' : '') + ')', sub: '', value: a.Mo_str, unit: 'lb-ft/ft', d: 0 }),
+      rwrS({ id: 'Mr', label: 'Factored resisting moment (minimum vertical 0.90DC + 1.00EV' + (r.Pa_tri_v > 0 ? ' + 0.90EH,v' : '') + ')', sym: 'M_{r}', eq: '', sub: '', value: a.Mr_str_min, unit: 'lb-ft/ft', d: 0 }),
+      rwrS({ id: 'xR', label: 'Location of the resultant from the toe', sym: '\\bar{x}', eq: '\\frac{M_{r} \\minus M_{o}}{V}', sub: '', value: a.x_R_A, unit: 'ft', d: 3 }),
+      rwrS({ id: 'e', label: 'Eccentricity of the resultant', sym: 'e', eq: '\\frac{B}{2} \\minus \\bar{x}', sub: '\\frac{' + rwrN(r.B, 2) + '}{2} \\minus ' + rwrN(a.x_R_A, 3), value: a.e_A, unit: 'ft', d: 3 }),
+      rwrS({ id: 'dc', label: 'Eccentricity check, foundation on ' + (a.onRock ? 'rock' : 'soil') + ': |e| ≤ ' + rwrPlain(a.e_limit_label) + ' = ' + rwrN(a.e_limit, 3) + ' ft', sym: '\\frac{|e|}{e_{lim}}', eq: '', sub: '\\frac{' + rwrN(Math.abs(a.e_A), 3) + '}{' + rwrN(a.e_limit, 3) + '}', value: dcv('ecc'), unit: '', d: 3, ok: ok('ecc'), ref: AA('Art. 11.6.3.3') })];
+      CK.ecc = 'sa5/dc';
+      subs.push(sub('Step 5 — Eccentricity limit (Strength I)', [rwrItem('sa5', [{ title: 'Eccentricity', steps: st }]), onTab('stabEcc')])); }
+    { const s1 = [rwrS({ id: 'Vu', label: 'Factored vertical load (maximum: 1.25DC + 1.35EV' + (r.Pa_tri_v > 0 ? ' + ' + rwrN(a.gEH_max, 2) + 'EH,v' : '') + ' + 1.75LS' + (a.V_up > 0 ? ' − U' : '') + ')', sym: 'V_{u}', eq: '', sub: '', value: a.V_str_max, unit: 'lb/ft', d: 0 }),
+      rwrS({ id: 'e', label: 'Eccentricity for bearing', sym: 'e', eq: '', sub: '', value: a.e_brg, unit: 'ft', d: 3 }),
+      rwrS({ id: 'Beff', label: 'Effective width (Meyerhof)', sym: 'B^{\\prime}', eq: 'B \\minus 2e', sub: rwrN(r.B, 2) + ' \\minus 2(' + rwrN(a.e_brg, 3) + ')', value: a.B_eff, unit: 'ft', d: 3 })];
+      const inK = Math.abs(a.e_brg) <= r.B / 6;
+      if (a.onRock) s1.push(rwrS({ id: 'qu', label: 'Footing on rock: maximum factored bearing pressure (linear distribution)', sym: 'q_{u}', eq: inK ? '\\frac{V_{u}}{B}\\left(1 + \\frac{6e}{B}\\right)' : '\\frac{2V_{u}}{3(B/2 \\minus e)}', sub: inK ? '\\frac{' + rwrN(a.V_str_max, 0) + '}{' + rwrN(r.B, 2) + '}\\left(1 + \\frac{6(' + rwrN(Math.abs(a.e_brg), 3) + ')}{' + rwrN(r.B, 2) + '}\\right)\\frac{1}{1000}' : '\\frac{2(' + rwrN(a.V_str_max, 0) + ')}{3(' + rwrN(r.B / 2, 3) + ' \\minus ' + rwrN(Math.abs(a.e_brg), 3) + ')}\\frac{1}{1000}', value: a.q_ult_A / 1000, unit: 'ksf', d: 2, ref: AA('Art. 10.6.5, Eq. 11.6.3.2-' + (inK ? '2' : '3')) }));
+      else s1.push(rwrS({ id: 'qu', label: 'Uniform factored bearing pressure over the effective width', sym: 'q_{u}', eq: '\\frac{V_{u}}{B^{\\prime}}', sub: '\\frac{' + rwrN(a.V_str_max, 0) + '}{' + rwrN(a.B_eff, 3) + '}\\frac{1}{1000}', value: a.q_ult_A / 1000, unit: 'ksf', d: 2, ref: AA('Art. 10.6.3.1') }));
+      s1.push(rwrS({ id: 'qR', label: a.useManualQn ? 'Factored bearing resistance (from the geotechnical report)' : 'Factored bearing resistance (q_n ≈ 3 q_a = ' + rwrN(a.q_n_A, 0) + ' psf)', sym: 'q_{R}', eq: '\\phi_{b}\\,q_{n}', sub: a.useManualQn ? '' : '(' + rwrN(A.phi_b, 2) + ')(' + rwrN(a.q_n_A, 0) + ')\\frac{1}{1000}', value: a.q_R_A / 1000, unit: 'ksf', d: 2,
+        note: a.useManualQn ? '' : 'q_n estimated as 3 q_a (assumes the allowable was derived with FS ≈ 3); enter the geotechnical value for final design' }));
+      s1.push(rwrS({ id: 'okmax', label: 'Bearing check, Strength I (maximum vertical): q_u ≤ q_R', sym: '\\frac{q_{u}}{q_{R}}', eq: '', sub: '\\frac{' + rwrN(a.q_ult_A / 1000, 2) + '}{' + rwrN(a.q_R_A / 1000, 2) + '}', value: a.q_ult_A / a.q_R_A, unit: '', d: 3, ok: !!a.bearing_ok_max }));
+      const s2 = [rwrS({ id: 'BeffIa', label: a.onRock ? 'Strength Ia (minimum vertical 0.90DC + 1.00EV, maximum EH), same e as the eccentricity check' : "Strength Ia: effective width at the eccentricity of the eccentricity check", sym: a.onRock ? 'e' : 'B^{\\prime}', eq: a.onRock ? '' : 'B \\minus 2|e|', sub: a.onRock ? '' : rwrN(r.B, 2) + ' \\minus 2(' + rwrN(Math.abs(a.e_A), 3) + ')', value: a.onRock ? Math.abs(a.e_A) : a.B_eff_Ia, unit: 'ft', d: 3, note: 'V = ' + rwrN(a.V_str_min, 0) + ' lb/ft (minimum factored vertical)' }),
+        rwrS({ id: 'quIa', label: 'Factored bearing pressure, Strength Ia', sym: 'q_{u}', eq: a.onRock ? (Math.abs(a.e_A) <= r.B / 6 ? '\\frac{V}{B}\\left(1 + \\frac{6e}{B}\\right)' : '\\frac{2V}{3(B/2 \\minus e)}') : '\\frac{V}{B^{\\prime}}', sub: a.onRock ? '' : '\\frac{' + rwrN(a.V_str_min, 0) + '}{' + rwrN(a.B_eff_Ia, 3) + '}\\frac{1}{1000}', value: a.q_ult_Ia / 1000, unit: 'ksf', d: 2, ref: a.onRock ? AA('C11.5.6, Eq. 11.6.3.2-' + (Math.abs(a.e_A) <= r.B / 6 ? '2' : '3')) : AA('C11.5.6') }),
+        rwrS({ id: 'okIa', label: 'Bearing check, Strength Ia (minimum vertical): q_u ≤ q_R', sym: '\\frac{q_{u}}{q_{R}}', eq: '', sub: '\\frac{' + rwrN(a.q_ult_Ia / 1000, 2) + '}{' + rwrN(a.q_R_A / 1000, 2) + '}', value: a.q_ult_Ia / a.q_R_A, unit: '', d: 3, ok: !!a.bearing_ok_Ia }),
+        rwrS({ id: 'dc', label: 'Bearing: governing of Strength I and Ia (status-bar check)', sym: '\\frac{q_{u,gov}}{q_{R}}', eq: '', sub: '\\frac{' + rwrN(a.q_ult_gov / 1000, 2) + '}{' + rwrN(a.q_R_A / 1000, 2) + '}', value: dcv('bearing'), unit: '', d: 3, ok: ok('bearing') })];
+      CK.bearing = 'sa6/dc';
+      subs.push(sub('Step 6 — Bearing resistance (Strength I)', [rwrItem('sa6', [{ title: 'Strength I (maximum vertical)', ref: a.onRock ? AA('Art. 10.6.5, 11.6.3.2') : AA('Art. 10.6.3.1'), steps: s1 }, { title: 'Strength Ia (minimum vertical)', steps: s2 }]), onTab('stabBrg')])); }
+    if (a.ct) {
+      const c = a.ct, TLN = { tl23: 'TL-2 / TL-3', tl4: 'TL-4 (S3-MTL4)', tl5: 'TL-5 (CF-MTL5)', manual: 'manual' };
+      subs.push(sub('Step 7 — Vehicular collision load (Extreme Event II)', [rwrItem('sa7', [{ title: 'Collision', steps: [
+        rwrS({ id: 'Ft', label: 'Collision force per test level ' + (TLN[c.tl] || c.tl) + ' (L_t = ' + rwrN(A.ct_wh, 1) + ' ft, h_CT = ' + rwrN(A.ct_h_app, 0) + ' in above the roadway)', sym: 'F_{t}', eq: '', sub: '', value: c.Ft, unit: 'kip', d: 0, ref: 'MassDOT LRFD Bridge Manual Table 3.3.2-1' }),
+        rwrS({ id: 'CT', label: c.distMode === 'section' ? 'Distributed over the full wall section between joints' : 'Distributed over a 45° spread (capped at the joint spacing)', sym: 'CT', eq: '\\frac{F_{t}}{L_{dist}}', sub: '\\frac{' + rwrN(c.Ft, 0) + '}{' + rwrN(c.Ldist, 1) + '}', value: c.CT_h, unit: 'kip/ft', d: 3, ref: c.distMode === 'section' ? 'MassDOT LRFD Bridge Manual §3.3.2.4' : '' }),
+        rwrS({ id: 'yCT', label: 'Lever arm above the base of the footing (roadway at the top of the stem)', sym: 'y_{CT}', eq: 'H + h_{CT}', sub: rwrN(r.H, 2) + ' + ' + rwrN(A.ct_h_app / 12, 2), value: c.y_CT, unit: 'ft', d: 2 }),
+        rwrS({ id: 'MCT', label: 'Collision overturning moment about the toe', sym: 'M_{CT}', eq: 'CT\\cdot y_{CT}', sub: '(' + rwrN(c.CT_h, 3) + ')(' + rwrN(c.y_CT, 2) + ')', value: c.M_CT / 1000, unit: 'kip-ft/ft', d: 2 })] }])]));
+      const sb = [rwrS({ id: 'Q', label: 'Factored driving force' + (E.ehDropped ? ' (γ_EH = 0, MassDOT §3.3.2.4: the wall pulls away from the backfill)' : ' (γ_EH = 1.0, earth pressure concurrent)'), sym: '\\sum\\gamma Q', eq: '1.0\\,CT' + (E.ehDropped ? '' : ' + 1.0\\,P_{EH}') + ' + ' + rwrN(E.gLS_ct, 2) + '\\,P_{LS}', sub: rwrN(c.CT_h * 1000, 0) + (E.ehDropped ? '' : ' + ' + rwrN(a.P_EH, 0)) + ' + ' + rwrN(E.gLS_ct, 2) + '\\cdot' + rwrN(a.P_LS, 0), value: E.H_drive_ct, unit: 'lb/ft', d: 0 }),
+        rwrS({ id: 'V', label: 'Resisting vertical load (DC + EV at γ = 1.0)', sym: 'V', eq: '1.0(W_{ftg} + W_{stem}' + (r.hasBarrier ? ' + W_{bar}' : '') + ') + 1.0(W_{soil} + P_{a,V})', sub: '', value: E.V_ct_min, unit: 'lb/ft', d: 0 }),
+        rwrS({ id: 'sl', label: 'Sliding under collision', sym: 'DCR', eq: '\\frac{\\sum\\gamma Q}{\\phi(V\\tan\\delta + P_{p})}', sub: '\\frac{' + rwrN(E.H_drive_ct, 0) + '}{' + rwrN(E.R_ct, 0) + '}', value: E.sliding_dcr_ct, unit: '', d: 3, ok: ok('ctSliding'), note: 'φ = ' + rwrN(E.phi_ct, 2) + ', tan δ = ' + rwrN(a.tanDelta, 3) }),
+        rwrS({ id: 'e', label: 'Resultant location and eccentricity', sym: 'e', eq: '\\frac{B}{2} \\minus \\frac{M_{r} \\minus M_{o}}{V}', sub: '\\frac{' + rwrN(r.B, 2) + '}{2} \\minus \\frac{' + rwrN(E.Mr_ct, 0) + ' \\minus ' + rwrN(E.Mo_ct, 0) + '}{' + rwrN(E.V_ct_min, 0) + '}', value: E.e_ct, unit: 'ft', d: 3 }),
+        rwrS({ id: 'ec', label: 'Eccentricity limit under collision: |e| ≤ B/' + rwrN(E.eccDiv, 0) + ' = ' + rwrN(E.e_lim_ct, 3) + ' ft', sym: '\\frac{|e|}{e_{lim}}', eq: '', sub: '\\frac{' + rwrN(Math.abs(E.e_ct), 3) + '}{' + rwrN(E.e_lim_ct, 3) + '}', value: dcv('ctEcc'), unit: '', d: 3, ok: ok('ctEcc') }),
+        a.onRock ? rwrS({ id: 'qu', label: 'Bearing pressure on rock (linear distribution), e = ' + rwrN(Math.abs(E.e_brg_ct), 3) + ' ft', sym: 'q_{u}', eq: Math.abs(E.e_brg_ct) <= r.B / 6 ? '\\frac{V}{B}\\left(1 + \\frac{6e}{B}\\right)' : '\\frac{2V}{3(B/2 \\minus e)}', sub: '', value: E.q_ult_ct / 1000, unit: 'ksf', d: 2, ref: AA('Art. 10.6.5, Eq. 11.6.3.2-' + (Math.abs(E.e_brg_ct) <= r.B / 6 ? '2' : '3')) })
+          : rwrS({ id: 'qu', label: "Effective width B' = B − 2|e| = " + rwrN(E.B_eff_ct, 3) + ' ft and bearing pressure (Meyerhof)', sym: 'q_{u}', eq: '\\frac{V}{B^{\\prime}}', sub: '\\frac{' + rwrN(E.V_ct_min, 0) + '}{' + rwrN(E.B_eff_ct, 3) + '}\\frac{1}{1000}', value: E.q_ult_ct / 1000, unit: 'ksf', d: 2 }),
+        rwrS({ id: 'br', label: 'Bearing under collision: q_u ≤ q_R = φ q_n = ' + rwrN(E.q_R_ct / 1000, 2) + ' ksf', sym: '\\frac{q_{u}}{q_{R}}', eq: '', sub: '\\frac{' + rwrN(E.q_ult_ct / 1000, 2) + '}{' + rwrN(E.q_R_ct / 1000, 2) + '}', value: dcv('ctBearing'), unit: '', d: 3, ok: ok('ctBearing') })];
+      CK.ctSliding = 'sa7b/sl'; CK.ctEcc = 'sa7b/ec'; CK.ctBearing = 'sa7b/br';
+      subs.push(sub('Step 7b — Stability under collision (Extreme Event II)', [rwrItem('sa7b', [{ title: 'Sliding', steps: sb.slice(0, 3) }, { title: 'Eccentricity', steps: sb.slice(3, 5) }, { title: 'Bearing', steps: sb.slice(5) }]), onTab('stabCT')]));
+      if (c.yl) { const y = c.yl, k8 = y.isEnd ? '' : '8';
+        subs.push(sub('Step 7c — Barrier yield-line capacity (' + (y.isEnd ? 'end' : 'interior') + ' segment)', [rwrItem('sa7c', [{ title: 'Yield line', ref: AA('Art. A13.3.1'), steps: [
+          rwrS({ id: 'Lc', label: 'Critical length of the yield-line pattern', sym: 'L_{c}', eq: '\\frac{L_{t}}{2} + \\sqrt{\\left(\\frac{L_{t}}{2}\\right)^{2} + \\frac{' + k8 + 'H(M_{b} + M_{w})}{M_{c}}}', sub: '\\frac{' + rwrN(y.Lt_c, 1) + '}{2} + \\sqrt{\\left(\\frac{' + rwrN(y.Lt_c, 1) + '}{2}\\right)^{2} + \\frac{' + k8 + '(' + rwrN(y.Hb, 2) + ')(' + rwrN(y.Mb, 1) + ' + ' + rwrN(y.Mw, 1) + ')}{' + rwrN(y.Mc, 1) + '}}', value: y.Lc, unit: 'ft', d: 2, ref: AA('Art. A13.3.1') }),
+          rwrS({ id: 'Rw', label: 'Nominal railing resistance', sym: 'R_{w}', eq: '\\frac{2}{2L_{c} \\minus L_{t}}\\left(' + k8 + 'M_{b} + ' + k8 + 'M_{w} + \\frac{M_{c}L_{c}^{2}}{H}\\right)', sub: '', value: y.Rw, unit: 'kip', d: 1, ref: AA('Art. A13.3.1') }),
+          rwrS({ id: 'dc', label: 'Railing resistance vs the design impact: R_w ≥ F_t = ' + rwrN(y.Ft, 0) + ' kip', sym: '\\frac{F_{t}}{R_{w}}', eq: '', sub: '\\frac{' + rwrN(y.Ft, 0) + '}{' + rwrN(y.Rw, 1) + '}', value: dcv('ctYield'), unit: '', d: 3, ok: ok('ctYield') })] }]), onTab('stabYL')]));
+        CK.ctYield = 'sa7c/dc'; }
+    }
+    if (a.ish) { const s = a.ish, st = [rwrS({ id: 'Vn', label: 'Footing–subfooting nominal interface shear (least of three limits)', sym: 'V_{n}', eq: '\\min(c\\,A_{cv},\\; K_{1} ' + RWR_FC + ' A_{cv},\\; K_{2} A_{cv})', sub: 'c = ' + rwrN(A.ish_c, 3) + ',\\; A_{cv} = ' + rwrN(s.Acv_ftg, 0) + ',\\; K_{1} = ' + rwrN(A.ish_k1, 2) + ',\\; K_{2} = ' + rwrN(A.ish_k2, 2), value: s.Vn_ftg, unit: 'kip/ft', d: 1, ref: AA('Art. 5.7.4.3') }),
+      rwrS({ id: 'ftg', label: 'Footing interface: φV_n ≥ V_u' + (s.dowel_needed ? ' (concrete alone; dowels below)' : ''), sym: '\\frac{V_{u}}{\\phi V_{n}}', eq: '', sub: '\\frac{' + rwrN(s.Vu_ish, 1) + '}{' + rwrN(s.Vr_ftg, 1) + '}', value: s.Vu_ish / s.Vr_ftg, unit: '', d: 3, ok: !!s.ish_ftg_ok, note: 'φ_v = ' + rwrN(s.phi_v, 2) })];
+      if (s.dowel_needed) st.push(rwrS({ id: 'dow', label: 'Bedrock dowels #' + s.bar_d.num + ' at ' + rwrN(A.dowel_spc, 0) + ' in (A_vf = ' + rwrN(s.Avf_dowel, 3) + ' in²/ft): φμA_vf f_y ≥ deficit', sym: '\\frac{\\text{deficit}}{\\phi\\mu A_{vf} f_{y}}', eq: '', sub: '\\frac{' + rwrN(s.shear_deficit, 1) + '}{' + rwrN(s.Vr_dowel, 1) + '}', value: s.shear_deficit / s.Vr_dowel, unit: '', d: 3, ok: !!s.dowel_ok }));
+      st.push(rwrS({ id: 'ftgdc', label: 'Footing–subfooting interface outcome (status-bar check)', sym: 'D/C', eq: '', sub: '', value: dcv('ishFtg'), unit: '', d: 3, ok: ok('ishFtg') }));
+      st.push(rwrS({ id: 'stem', label: 'Stem–footing interface (S1 bars as shear friction): φV_n ≥ V_u', sym: '\\frac{V_{u}}{\\phi V_{n}}', eq: '', sub: '\\frac{' + rwrN(s.Vu_stem_ish, 1) + '}{' + rwrN(s.Vr_stem, 1) + '}', value: dcv('ishStem'), unit: '', d: 3, ok: ok('ishStem') }));
+      CK.ishFtg = 'sa8/ftgdc'; CK.ishStem = 'sa8/stem';
+      subs.push(sub('Step 8 — Interface shear', [rwrItem('sa8', [{ title: 'Interface shear', ref: AA('Art. 5.7.4.3'), steps: st }]), { type: 'note', text: 'V_u at the stem base: [[stb/s1.Vu]]; S1 bars: [[stb/s3.S1]].' }, onTab('stabISH')])); }
+    if (a.serv) { const sv = a.serv, T = [];
+      const cr = (k, nm, ge, M, mk) => { const c = sv[k].crack; return [
+        rwrS({ id: k + '.fss', label: nm + ': service tensile stress in the steel' + (c.fss_ok ? '' : ' (capped at 0.6 f_y, Art. 5.6.7)'), sym: 'f_{ss}', eq: '\\frac{M_{serv}}{A_{s} j d}', sub: 'M_{serv} = ' + rwrN(M / 1000, 1) + '\\;\\text{kip-ft/ft}', value: c.fss / 1000, unit: 'ksi', d: 1 }),
+        rwrS({ id: k + '.bs', label: nm + ': strain ratio factor', sym: '\\beta_{s}', eq: '1 + \\frac{d_{c}}{0.7(h \\minus d_{c})}', sub: '1 + \\frac{' + rwrN(c.dc, 3) + '}{0.7(' + rwrN(c.h, 2) + ' \\minus ' + rwrN(c.dc, 3) + ')}', value: c.beta_s, unit: '', d: 3 }),
+        rwrS({ id: k + '.smax', label: nm + ': maximum bar spacing (γ_e = ' + rwrN(ge, 2) + ')', sym: 's_{max}', eq: '\\min\\left(\\frac{700\\gamma_{e}}{\\beta_{s} f_{ss}} \\minus 2d_{c},\\; 1.5h,\\; 18\\right)', sub: '\\min\\left(\\frac{700(' + rwrN(ge, 2) + ')}{' + rwrN(c.beta_s, 3) + '(' + rwrN(c.fss / 1000, 2) + ')} \\minus 2(' + rwrN(c.dc, 3) + '),\\; ' + rwrN(1.5 * c.h, 1) + ',\\; 18\\right)', value: c.s_max, unit: 'in', d: 1, ref: AA('Eq. 5.6.7-1') }),
+        rwrS({ id: k + '.ok', label: nm + ' (' + mk + '): s ≤ s_max', sym: '\\frac{s}{s_{max}}', eq: '', sub: '\\frac{' + rwrN(sv[k].spacing, 1) + '}{' + rwrN(c.s_max, 1) + '}', value: dcv('crack' + k[0].toUpperCase() + k.slice(1)), unit: '', d: 3, ok: ok('crack' + k[0].toUpperCase() + k.slice(1)) })]; };
+      const mr = (k, nm) => { const m = sv[k].minR; return [
+        rwrS({ id: k + '.Mcr', label: nm + ': cracking moment', sym: 'M_{cr}', eq: '\\gamma_{3}\\gamma_{1} f_{r} S_{nc}', sub: 'f_{r} = ' + rwrN(sv.fr, 0) + '\\;\\text{psi}', value: m.Mcr / 1000, unit: 'kip-ft/ft', d: 1, ref: AA('Art. 5.6.3.3') }),
+        rwrS({ id: k + '.mr', label: nm + ': minimum reinforcement M_r ≥ min(M_cr, 1.33 M_u)', sym: '\\frac{\\min(M_{cr}, 1.33M_{u})}{M_{r}}', eq: '', sub: '\\frac{' + rwrN(m.demand / 1000, 1) + '}{' + rwrN(m.Mr / 1000, 1) + '}', value: dcv('minRf' + k[0].toUpperCase() + k.slice(1)), unit: '', d: 3, ok: ok('minRf' + k[0].toUpperCase() + k.slice(1)) })]; };
+      T.push({ title: 'Stem crack control', ref: AA('Art. 5.6.7'), steps: cr('stem', 'Stem', A.gamma_e2, sv.M_serv_stem, 'S1') });
+      T.push({ title: 'Heel crack control', ref: AA('Art. 5.6.7'), steps: cr('heel', 'Heel', A.gamma_e1, sv.M_serv_heel, 'F1') });
+      T.push({ title: 'Toe crack control', ref: AA('Art. 5.6.7'), steps: cr('toe', 'Toe', A.gamma_e1, sv.M_serv_toe, 'F2') });
+      T.push({ title: 'Minimum reinforcement', ref: AA('Art. 5.6.3.3'), steps: [].concat(mr('stem', 'Stem'), mr('heel', 'Heel'), mr('toe', 'Toe')) });
+      ['Stem', 'Heel', 'Toe'].forEach(x => { CK['crack' + x] = 'sa9/' + x.toLowerCase() + '.ok'; CK['minRf' + x] = 'sa9/' + x.toLowerCase() + '.mr'; });
+      subs.push(sub('Step 9 — Serviceability: crack control and minimum reinforcement', [rwrItem('sa9', T),
+        { type: 'note', text: 'n = ' + rwrN(sv.n_modular, 0) + ' (E_c = ' + rwrN(sv.Ec / 1000, 0) + ' ksi, Eq. 5.4.2.4-1). Service I stem moment: ' + (sv.serv_ko ? 'K_0 = ' + rwrN(sv.K_serv, 3) + ' for the earth term, K_a for the surcharge' : 'K_a') + '; heel: full downward load, no upward relief; toe: |M_u| / 1.5 (approximation of the tool). Heel and toe minimum reinforcement are status-bar checks without a card on the tab.' }, onTab('stabServ')])); }
+    secs.push({ title: 'Stability (AASHTO LRFD limit states)', subs, key: 'stab' });
+  }
+  /* column / beam loads (both bases: the tool computes them the same way) and seismic detail (ACI) */
+  {
+    const S = secs[secs.length - 1];
+    if (r.hasCol) { const fk = x => rwrN(x / 1000, 3);
+      S.subs.push(sub('Column / beam load combinations', [rwrItem('col', [{ title: 'Combinations', ref: 'ASCE 7-22 §2.3.1', steps: [
+        rwrS({ id: 'wsvc', label: 'Service load per foot', sym: 'w_{svc}', eq: '\\frac{(P_{DL} + P_{LL} + P_{SL})\\times 1000}{L_{dist}}', sub: '\\frac{(' + rwrN(inp.col_DL, 1) + ' + ' + rwrN(inp.col_LL, 1) + ' + ' + rwrN(inp.col_SL, 1) + ')\\times 1000}{' + rwrN(inp.col_Ldist, 1) + '}', value: r.P_col_svc, unit: 'lb/ft', d: 1 }),
+        rwrS({ id: 'c2', label: 'Combination 2', sym: '1.2D + 1.6L + 0.5S', eq: '', sub: '1.2(' + fk(r.pDL) + ') + 1.6(' + fk(r.pLL) + ') + 0.5(' + fk(r.pSL) + ')', value: (1.2 * r.pDL + 1.6 * r.pLL + 0.5 * r.pSL) / 1000, unit: 'kip/ft', d: 3 }),
+        rwrS({ id: 'c3', label: 'Combination 3', sym: '1.2D + 1.6S + 1.0L', eq: '', sub: '1.2(' + fk(r.pDL) + ') + 1.6(' + fk(r.pSL) + ') + 1.0(' + fk(r.pLL) + ')', value: (1.2 * r.pDL + 1.0 * r.pLL + 1.6 * r.pSL) / 1000, unit: 'kip/ft', d: 3 }),
+        rwrS({ id: 'c4', label: 'Combination 4', sym: '1.2D + 1.0W + 1.0L + 0.5S', eq: '', sub: '1.2(' + fk(r.pDL) + ') + 1.0(' + fk(r.pWL) + ') + 1.0(' + fk(r.pLL) + ') + 0.5(' + fk(r.pSL) + ')', value: (1.2 * r.pDL + 1.0 * r.pWL + 1.0 * r.pLL + 0.5 * r.pSL) / 1000, unit: 'kip/ft', d: 3 }),
+        rwrS({ id: 'c6', label: 'Combination 6 (uplift check)', sym: '0.9D + 1.0W', eq: '', sub: '0.9(' + fk(r.pDL) + ') + 1.0(' + fk(r.pWL) + ')', value: (0.9 * r.pDL + 1.0 * r.pWL) / 1000, unit: 'kip/ft', d: 3 }),
+        rwrS({ id: 'wumax', label: 'Governing envelope, maximum', sym: 'w_{u,max}', eq: '', sub: '', value: r.Puf_max / 1000, unit: 'kip/ft', d: 3, note: 'w_u,min = ' + fk(r.Puf_min) + ' kip/ft' })] },
+        { title: 'Stem axial', ref: 'ACI 318-19 §22.4', steps: [rwrS({ id: 'ax', label: 'Stem axial ratio (tied member, A_g = ' + rwrN(inp.ts_bot * 12, 0) + ' in² per ft)', sym: '\\frac{P_{u}}{\\phi P_{n,max}}', eq: '\\frac{P_{u}}{0.80(0.65)(0.85 ' + RWR_FC + ' A_{g})}', sub: '\\frac{' + rwrN(r.Pu_stem_axial, 0) + '}{0.80(0.65)(0.85\\cdot' + rwrN(inp.fc, 0) + '\\cdot' + rwrN(inp.ts_bot * 12, 0) + ')}', value: r.col_axial_ratio, unit: '', d: 4, ok: ok('colAxial'),
+          note: r.col_axial_ratio <= 0.10 ? 'P/φP_n ≤ 0.10: flexure governs the stem design' : 'P/φP_n > 0.10: perform a detailed P-M interaction check for the stem' })] }]),
+        isA ? { type: 'note', text: 'On the AASHTO basis the column card is not shown on the Stability tab; the values are the tool\'s own (status-bar check "Col. Axial").' } : onTab('stabCol')]));
+      CK.colAxial = 'col/ax'; }
+    if (r.hasSeismic && !isA) { const th = Math.atan(inp.kh / (1 - inp.kv)) * 180 / Math.PI;
+      S.subs.push(sub('Seismic — Mononobe-Okabe detail', [rwrItem('st9', [{ title: 'Mononobe-Okabe', ref: 'ASCE 7-22 §11.8', steps: [
+        rwrS({ id: 'th', label: 'Seismic inertia angle', sym: '\\theta', eq: '\\arctan\\left(\\frac{k_{h}}{1 \\minus k_{v}}\\right)', sub: '\\arctan\\left(\\frac{' + rwrN(inp.kh, 3) + '}{1 \\minus ' + rwrN(inp.kv, 3) + '}\\right)', value: th, unit: 'deg', d: 2 }),
+        rwrS({ id: 'Kae', label: 'M-O combined coefficient (δ = ' + rwrN(inp.delta_mo, 0) + '°)', sym: 'K_{AE}', eq: '\\frac{\\cos^{2}(\\phi \\minus \\theta)}{\\cos\\theta\\,\\cos(\\delta + \\theta)\\left[1 + \\sqrt{\\frac{\\sin(\\phi + \\delta)\\sin(\\phi \\minus \\theta \\minus \\beta)}{\\cos(\\delta + \\theta)\\cos\\beta}}\\right]^{2}}', sub: '', value: r.Kae, unit: '', d: 4 }),
+        rwrS({ id: 'Pae', label: 'Total seismic-active force', sym: 'P_{AE}', eq: '\\frac{1}{2}K_{AE}\\gamma_{s} H^{2}(1 \\minus k_{v})', sub: '\\frac{1}{2}(' + rwrN(r.Kae, 4) + ')(' + rwrN(inp.gamma_s, 0) + ')(' + rwrN(r.H, 3) + ')^{2}(1 \\minus ' + rwrN(inp.kv, 3) + ')', value: r.Pae, unit: 'lb/ft', d: 1 }),
+        rwrS({ id: 'dPE', label: 'Seismic increment, applied at 0.6H = ' + rwrN(0.6 * r.H, 2) + ' ft above the base', sym: '\\Delta P_{E}', eq: 'P_{AE} \\minus P_{a}', sub: rwrN(r.Pae, 1) + ' \\minus ' + rwrN(r.Pa_tri, 1), value: r.Pe_inc, unit: 'lb/ft', d: 1 })] }]),
+        { type: 'note', warn: true, text: 'Simplified M-O per Seed & Whitman (1970). Verify with the project geotechnical engineer; seismic FOS acceptance may be reduced to 1.1 per local practice (confirm with the AHJ).' }])); }
+  }
+
+  /* ---------- 4. Stem ---------- */
+  {
+    const subs = [], gEH = isA ? 1.50 : 1.6, gLS = isA ? 1.75 : 1.6, gES = isA ? 1.50 : 1.6, qll = isA ? r.q_ll_aashto : 0, ss = r.sel_stem;
+    const T1 = [rwrS({ id: 'Msoil', label: 'Factored moment, triangular soil pressure (γ' + (isA ? '_EH = 1.50' : ' = 1.6') + ')', sym: 'M_{u,soil}', eq: gEH + '\\cdot\\frac{K_{a}\\gamma_{s} H_{s}^{3}}{6}', sub: gEH + '\\cdot\\frac{(' + rwrN(r.Ka, 4) + ')(' + rwrN(inp.gamma_s, 0) + ')(' + rwrN(inp.Hs, 2) + ')^{3}}{6}', value: gEH * r.Ka * inp.gamma_s * inp.Hs ** 3 / 6, unit: 'lb-ft/ft', d: 1})];
+    if (inp.q_sur > 0) T1.push(rwrS({ id: 'MES', label: 'Factored moment, dead surcharge (γ' + (isA ? '_ES = 1.50' : ' = 1.6') + ')', sym: 'M_{u,ES}', eq: gES + '\\cdot\\frac{K_{a} q_{s} H_{s}^{2}}{2}', sub: gES + '\\cdot\\frac{(' + rwrN(r.Ka, 4) + ')(' + rwrN(inp.q_sur, 0) + ')(' + rwrN(inp.Hs, 2) + ')^{2}}{2}', value: gES * r.Ka * inp.q_sur * inp.Hs ** 2 / 2, unit: 'lb-ft/ft', d: 1 }));
+    if (isA && qll > 0) T1.push(rwrS({ id: 'MLS', label: 'Factored moment, live-load surcharge (γ_LS = 1.75)', sym: 'M_{u,LS}', eq: '1.75\\cdot\\frac{K_{a}\\gamma_{s}h_{eq}H_{s}^{2}}{2}', sub: '1.75\\cdot\\frac{(' + rwrN(r.Ka, 4) + ')(' + rwrN(qll, 0) + ')(' + rwrN(inp.Hs, 2) + ')^{2}}{2}', value: gLS * r.Ka * qll * inp.Hs ** 2 / 2, unit: 'lb-ft/ft', d: 1}));
+    if (r.stem_water) T1.push(rwrS({ id: 'Mhyd', label: 'Water-table adjustment: buoyant soil below the water table + hydrostatic (h_2 = ' + rwrN(Math.max(0, inp.Hs - r.wt_d), 2) + ' ft)', sym: 'M_{u,hyd}', eq: (isA ? '\\gamma_{WA}' : '\\gamma') + '\\cdot\\frac{1}{2}\\gamma_{w} h_{2}^{2}\\cdot\\frac{h_{2}}{3}', sub: '', value: (isA ? 1.0 : 1.6) * r.sd_base_Mhyd, unit: 'lb-ft/ft', d: 1, ref: isA ? AA('Table 3.4.1-1, γ_WA = 1.0') : 'γ = 1.6 (ACI H)' }));
+    T1.push(rwrS({ id: 'Mu', label: 'Total factored design moment' + (r.stem_ee2_governs ? ' (Extreme Event II governs)' : ''), sym: 'M_{u}', eq: r.stem_ee2_governs ? '\\max(M_{u,StrI},\\, M_{u,EE2})' : '\\sum M_{u,i}', sub: r.stem_ee2_governs ? '\\max(' + rwrN(r.Mu_stem_strI, 1) + ',\\, ' + rwrN(r.Mu_stem_ee2, 1) + ')' : '', value: r.Mu_stem_lbft, unit: 'lb-ft/ft', d: 1, note: r.stem_water ? 'water-aware: the 3-block effective-stress profile plus the hydrostatic triangle' : '' }));
+    T1.push(rwrS({ id: 'Vu', label: 'Factored shear at the base', sym: 'V_{u}', eq: '', sub: '', value: r.Vu_stem, unit: 'lb/ft', d: 1, note: r.hasSeismic ? 'ΔP_E is not included in the stem design (as the tab)' : '' }));
+    const T2 = [rwrS({ id: 'd', label: 'Effective depth (S1 bar #' + ss.bar.num + ', d_b = ' + rwrN(ss.bar.db, 3) + ' in; tension on the back face)', sym: 'd', eq: 't_{s,bot} \\minus c_{c} \\minus \\frac{d_{b}}{2}', sub: rwrN(inp.ts_bot, 1) + ' \\minus ' + rwrN(inp.cov_stem, 2) + ' \\minus ' + rwrN(ss.bar.db / 2, 4), value: r.d_stem, unit: 'in', d: 3 })];
+    const flex = (pre, Mu_in, d, Rn, Asr, Asm, Asd, h, sel, mark, okk, osd) => [
+      rwrS({ id: 'Rn', label: 'Required flexural resistance factor', sym: 'R_{n}', eq: '\\frac{M_{u}}{\\phi\\,b\\,d^{2}}', sub: '\\frac{' + rwrN(Mu_in, 0) + '}{(0.90)(12)(' + rwrN(d, 3) + ')^{2}}', value: Rn, unit: 'psi', d: 2 }),
+      rwrS({ id: 'Asr', label: 'Required steel, Whitney stress block', sym: 'A_{s,req}', eq: '\\frac{0.85 ' + RWR_FC + '}{f_{y}}\\left(1 \\minus \\sqrt{1 \\minus \\frac{2R_{n}}{0.85 ' + RWR_FC + '}}\\right)b\\,d', sub: '\\frac{0.85(' + rwrN(inp.fc, 0) + ')}{' + rwrN(inp.fy, 0) + '}\\left(1 \\minus \\sqrt{1 \\minus \\frac{2(' + rwrN(Rn, 2) + ')}{0.85(' + rwrN(inp.fc, 0) + ')}}\\right)(12)(' + rwrN(d, 3) + ')', value: Asr, unit: 'in^{2}/ft', d: 4 }),
+      rwrS({ id: 'Asm', label: 'Minimum flexural steel', sym: 'A_{s,min}', eq: isA ? '\\phi M_{n} \\ge \\min(M_{cr},\\, 1.33M_{u})' : '0.0018\\,b\\,h', sub: isA ? '' : '0.0018(12)(' + rwrN(h, 1) + ')', value: Asm, unit: 'in^{2}/ft', d: 4, ref: isA ? AA('Art. 5.6.3.3') : 'ACI 318-19 §7.6.1.1 (via §13.3.7)' }),
+      rwrS({ id: 'Asd', label: 'Design steel (greater of required and minimum)', sym: 'A_{s,des}', eq: '\\max(A_{s,req},\\, A_{s,min})', sub: '\\max(' + rwrN(Asr, 4) + ',\\, ' + rwrN(Asm, 4) + ')', value: Asd, unit: 'in^{2}/ft', d: 4 }),
+      rwrS({ id: mark, label: 'Bar selection ' + mark + ': #' + sel.bar.num + ' at ' + sel.spacing + ' in' + (sel.overridden ? ' (user override)' : '') + (osd ? '; section over-stressed (R_n > 0.383 f′c)' : ''), sym: 'A_{s,prov}', eq: '\\frac{12\\,A_{b}}{s} \\ge A_{s,des}', sub: '\\frac{12(' + rwrN(sel.bar.Ab, 2) + ')}{' + sel.spacing + '} \\ge ' + rwrN(Asd, 4), value: sel.As_prov, unit: 'in^{2}/ft', d: 4, ok: okk, ref: isA ? AA('Art. 5.6.3') : 'ACI 318-19 §9.5 / §22.2' })];
+    const T3 = flex('s3', r.Mu_stem_in, r.d_stem, r.Rn_stem, r.As_stem_req, r.As_s_min, r.As_stem_des, inp.ts_bot, ss, 'S1', ok('stemFlex'), r.stem_overstressed);
+    CK.stemFlex = 'stb/s3.S1';
+    const vc = (sh, Vc, d, h) => isA
+      ? [rwrS({ id: 'dv', label: 'Effective shear depth', sym: 'd_{v}', eq: '\\max(0.9d,\\; 0.72h)', sub: '\\max(0.9(' + rwrN(d, 2) + '),\\; 0.72(' + rwrN(h, 1) + '))', value: sh.dv, unit: 'in', d: 2, ref: AA('Art. 5.7.2.8') }),
+         ...(sh.useSimple ? [] : [rwrS({ id: 'beta', label: 'Shear transmission factor, general procedure (ε_s = ' + rwrN(sh.eps_s * 1000, 3) + '×10⁻³, s_xe = ' + rwrN(sh.sxe, 1) + ' in)', sym: '\\beta', eq: '\\frac{4.8}{1 + 750\\epsilon_{s}}\\cdot\\frac{51}{39 + s_{xe}}', sub: '\\frac{4.8}{1 + 750(' + rwrN(sh.eps_s, 6) + ')}\\cdot\\frac{51}{39 + ' + rwrN(sh.sxe, 1) + '}', value: sh.beta, unit: '', d: 3, ref: AA('Art. 5.7.3.4.2') })]),
+         rwrS({ id: 'Vc', label: 'Nominal concrete shear resistance, ' + rwrPlain(sh.method), sym: 'V_{c}', eq: '0.0316\\,\\beta\\sqrt{' + RWR_FC + '}\\,b_{v} d_{v}', sub: '0.0316(' + rwrN(sh.beta, 3) + ')\\sqrt{' + rwrN(inp.fc / 1000, 2) + '}(12)(' + rwrN(sh.dv, 2) + ')(1000)', value: Vc, unit: 'lb/ft', d: 0, ref: AA(sh.useSimple ? 'Art. 5.7.3.4.1' : 'Art. 5.7.3.4.2') })]
+      : [rwrS({ id: 'lams', label: 'Size-effect factor', sym: '\\lambda_{s}', eq: '\\sqrt{\\frac{2}{1 + d/10}} \\le 1', sub: '\\sqrt{\\frac{2}{1 + ' + rwrN(d, 2) + '/10}}', value: sh.lam_s, unit: '', d: 3 }),
+         rwrS({ id: 'rho', label: 'Longitudinal steel ratio', sym: '\\rho_{w}', eq: '\\frac{A_{s}}{b\\,d}', sub: '', value: sh.rho, unit: '', d: 5 }),
+         rwrS({ id: 'Vc', label: 'Nominal concrete shear, members without shear reinforcement (≤ 5λ√f′c b d)', sym: 'V_{c}', eq: '8\\lambda_{s}\\lambda\\,\\rho_{w}^{1/3}\\sqrt{' + RWR_FC + '}\\,b\\,d', sub: '8(' + rwrN(sh.lam_s, 3) + ')(1.0)(' + rwrN(sh.rho, 5) + ')^{1/3}\\sqrt{' + rwrN(inp.fc, 0) + '}(12)(' + rwrN(d, 2) + ')', value: Vc, unit: 'lb/ft', d: 0, ref: 'ACI 318-19 Table 22.5.5.1(c)' })];
+    const phiS = isA ? (r.stem_ee2_governs ? '1.00' : '0.90') : '0.75';
+    const T4 = vc(r.shearStem, r.Vc_stem, r.d_stem, inp.ts_bot).concat([
+      rwrS({ id: 'phiVc', label: 'Design shear resistance', sym: '\\phi V_{c}', eq: phiS + '\\,V_{c}', sub: phiS + '(' + rwrN(r.Vc_stem, 0) + ')', value: r.phiVc_stem, unit: 'lb/ft', d: 0 }),
+      rwrS({ id: 'dc', label: 'One-way shear check: V_u ≤ φV_c', sym: '\\frac{V_{u}}{\\phi V_{c}}', eq: '', sub: '\\frac{' + rwrN(r.Vu_stem, 0) + '}{' + rwrN(r.phiVc_stem, 0) + '}', value: dcv('stemShear'), unit: '', d: 3, ok: ok('stemShear') })]);
+    CK.stemShear = 'stb/s4.dc';
+    const T5 = [];
+    if (isA) { const L = r.ldA_stem, H = r.ldhA_stem;
+      T5.push(rwrS({ id: 'ldb', label: 'Basic development length (λ_rl = λ_cf = 1.0, k_tr = 0)', sym: '\\ell_{db}', eq: '0.17\\,d_{b}\\left(\\frac{\\lambda_{er}f_{y} \\minus F_{h}/A_{b}}{1.97\\,\\lambda\\,(' + RWR_FC + ')^{0.25}}\\right)^{2}', sub: '0.17(' + rwrN(ss.bar.db, 3) + ')\\left(\\frac{' + rwrN(inp.fy / 1000, 1) + ' \\minus 0}{1.97(1.0)(' + rwrN(L.fc4, 4) + ')}\\right)^{2}', value: L.ldb, unit: 'in', d: 1, ref: AA('Eq. 5.10.8.2.1a-1, -2') }),
+        rwrS({ id: 'lrc', label: 'Reinforcement confinement factor (raw ' + rwrN(L.lam_rc_raw, 3) + ', limited)', sym: '\\lambda_{rc}', eq: '\\frac{d_{b}}{c_{b}}', sub: '\\frac{' + rwrN(ss.bar.db, 3) + '}{' + rwrN(L.cb, 3) + '}', value: L.lam_rc, unit: '', d: 3, ref: AA('Art. 5.10.8.2.1c') }),
+        rwrS({ id: 'ld', label: 'Tension development length', sym: '\\ell_{d}', eq: '\\max(\\ell_{db}\\lambda_{rl}\\lambda_{cf}\\lambda_{rc},\\; 12)', sub: '\\max(' + rwrN(L.ldb, 1) + '(1.0)(1.0)(' + rwrN(L.lam_rc, 3) + '),\\; 12)', value: r.ld_stem, unit: 'in', d: 1, ref: AA('Art. 5.10.8.2.1a') }),
+        rwrS({ id: 'R', label: 'Hook bend radius to the bar centre (minimum standard bend D = ' + H.Dmin + ' d_b)', sym: 'R', eq: '\\frac{D}{2} + \\frac{d_{b}}{2}', sub: '\\frac{' + H.Dmin + '(' + rwrN(H.db, 3) + ')}{2} + \\frac{' + rwrN(H.db, 3) + '}{2}', value: H.R, unit: 'in', d: 3, ref: AA('Table 5.10.2.3-1') }),
+        rwrS({ id: 'v', label: 'Hook bearing factor (0.45 ≤ v ≤ 0.65)', sym: 'v', eq: '0.85 \\minus \\frac{' + RWR_FC + '}{20}', sub: '', value: H.v, unit: '', d: 3 }),
+        rwrS({ id: 'Fh', label: 'Hook bearing force', sym: 'F_{h}', eq: 'd_{b} R v ' + RWR_FC, sub: '(' + rwrN(H.db, 3) + ')(' + rwrN(H.R, 3) + ')(' + rwrN(H.v, 3) + ')(' + rwrN(H.fcA, 2) + ')', value: H.Fh, unit: 'kip', d: 2 }),
+        rwrS({ id: 'ldbh', label: 'Basic development length of the hooked bar', sym: '\\ell_{db}', eq: '0.17\\,d_{b}\\left(\\frac{f_{y} \\minus F_{h}/A_{b}}{1.97\\,\\lambda\\,(' + RWR_FC + ')^{0.25}}\\right)^{2}', sub: '0.17(' + rwrN(H.db, 3) + ')\\left(\\frac{' + rwrN(inp.fy / 1000, 1) + ' \\minus ' + rwrN(H.Fh, 2) + '/' + rwrN(H.Ab, 2) + '}{1.97(1.0)(' + rwrN(H.fc4, 4) + ')}\\right)^{2}', value: H.ldb, unit: 'in', d: 1, ref: AA('Eq. 5.10.8.2.4a-1, -2') }),
+        rwrS({ id: 'ldH', label: 'Development length of the hooked bar', sym: '\\ell_{d}', eq: '\\ell_{db}\\lambda_{rl}\\lambda_{cf}\\lambda_{rc}', sub: rwrN(H.ldb, 1) + '(1.0)(1.0)(' + rwrN(H.lam_rc, 3) + ')', value: H.ld, unit: 'in', d: 1 }),
+        rwrS({ id: 'ldh', label: 'Hook development length (no tie reduction)', sym: '\\ell_{dh}', eq: '\\max(\\ell_{d} + R + \\frac{d_{b}}{2},\\; 8d_{b},\\; 6)', sub: '\\max(' + rwrN(H.ld, 1) + ' + ' + rwrN(H.R, 3) + ' + ' + rwrN(H.db / 2, 3) + ',\\; ' + rwrN(8 * H.db, 2) + ',\\; 6)', value: r.ldh_stem, unit: 'in', d: 1, ref: AA('Art. 5.10.8.2.4a') }));
+    } else {
+      T5.push(rwrS({ id: 'ld', label: 'Tension development length (ψ_t = 1.0, ψ_e = 1.0, ψ_s = ' + (ss.bar.db <= 0.75 ? '0.8' : '1.0') + ', ψ_g = ' + (inp.fy <= 60000 ? '1.0' : (inp.fy <= 80000 ? '1.15' : '1.3')) + '; c_b = min(cover to the bar centre, s/2))', sym: '\\ell_{d}', eq: '\\frac{3}{40}\\,\\frac{f_{y}\\,\\psi_{t}\\psi_{e}\\psi_{s}\\psi_{g}}{\\lambda\\sqrt{' + RWR_FC + '}\\left(\\frac{c_{b} + K_{tr}}{d_{b}}\\right)}\\,d_{b}', sub: '', value: r.ld_stem, unit: 'in', d: 1, ref: 'ACI 318-19 §25.4.2.4' }));
+      T5.push(rwrS({ id: 'ldh', label: 'Hook development length (ψ_r = 1.6, ψ_c = f′c/15000 + 0.6)', sym: '\\ell_{dh}', eq: '', sub: '', value: r.ldh_stem, unit: 'in', d: 1, ref: 'ACI 318-19 §25.4.3.1' }));
+    }
+    T5.push(rwrS({ id: 'hook', label: 'Stem bar standard hook into the footing: ℓ_dh ≤ t_f − c_c = ' + rwrN(r.ldh_avail, 1) + ' in', sym: '\\frac{\\ell_{dh}}{t_{f} \\minus c_{c}}', eq: '', sub: '\\frac{' + rwrN(r.ldh_stem, 1) + '}{' + rwrN(r.ldh_avail, 1) + '}', value: dcv('stemHook'), unit: '', d: 3, ok: ok('stemHook'), ref: isA ? AA('Art. 5.10.8.2.4a') : 'ACI 318-19 §25.4.3.1' }));
+    CK.stemHook = 'stb/s5.hook';
+    if (r.z_cutoff !== null) T5.push(rwrS({ id: 'zcut', label: 'Alternate-bar cutoff: half the S1 bars (#' + ss.bar.num + ' at ' + r.s_rem + ' in) carry M_u above z_th = ' + rwrN(r.z_cut_theory, 2) + ' ft; terminated bars extend max(d, 12d_b) past it', sym: 'z_{cut}', eq: 'z_{th} \\minus ' + rwrN(r.cut_ext, 2), sub: rwrN(r.z_cut_theory, 2) + ' \\minus ' + rwrN(r.cut_ext, 2), value: r.z_cutoff, unit: 'ft', d: 2, ref: isA ? AA('Art. 5.10.8.1.2') : 'ACI 318-19 §9.7.3.3', note: 'full S1 bars up to ' + rwrN(r.z_cutoff_from_base, 2) + ' ft above the base' }));
+    const T6 = [isA ? rwrS({ id: 'As', label: 'Required temperature and shrinkage steel, per face (b = stem height ' + rwrN(r.b_TS_stem, 0) + ' in)', sym: 'A_{s,TS}', eq: '\\frac{1.30\\,b\\,h}{2(b + h)f_{y}},\\; 0.11 \\le A_{s} \\le 0.60', sub: '\\frac{1.30(' + rwrN(r.b_TS_stem, 0) + ')(' + rwrN(inp.ts_bot, 1) + ')}{2(' + rwrN(r.b_TS_stem, 0) + ' + ' + rwrN(inp.ts_bot, 1) + ')(' + rwrN(inp.fy / 1000, 0) + ')}', value: r.As_temp_stem, unit: 'in^{2}/ft', d: 4, ref: AA('Eq. 5.10.6-1') })
+      : rwrS({ id: 'As', label: 'Required temperature and shrinkage steel (0.0018 gross area)', sym: 'A_{s,TS}', eq: '0.0018\\,b\\,t_{s,bot}', sub: '0.0018(12)(' + rwrN(inp.ts_bot, 1) + ')', value: r.As_temp_stem, unit: 'in^{2}/ft', d: 4, ref: 'ACI 318-19 §24.4.3.2' }),
+      rwrS({ id: 'S2', label: 'Bar selection S2 (horizontal): #' + r.sel_temp.bar.num + ' at ' + r.sel_temp.spacing + ' in' + (r.sel_temp.overridden ? ' (user override)' : ''), sym: 'A_{s,prov}', eq: '', sub: rwrN(r.sel_temp.As_prov, 4) + ' \\ge ' + rwrN(r.As_temp_stem, 4), value: r.sel_temp.As_prov, unit: 'in^{2}/ft', d: 4, ok: ok('tsStem') })];
+    CK.tsStem = 'stb/s6.S2';
+    const pre = (p, L) => L.map(s => Object.assign({}, s, { id: p + '.' + s.id }));
+    subs.push(sub('Base section: Steps 1 to 6', [rwrItem('stb', [
+      { title: 'Step 1 — Factored demands at the base of the stem', ref: isA ? AA('Table 3.4.1-1, Strength I: 1.50EH + 1.75LS') : 'ACI 318-19 §5.3, U = 1.6H', steps: pre('s1', T1) },
+      { title: 'Step 2 — Effective depth', steps: pre('s2', T2) }, { title: 'Step 3 — Flexural reinforcement (φ = 0.90)', ref: isA ? AA('Art. 5.6.3') : 'ACI 318-19 §9.5 / §22.2', steps: pre('s3', T3) },
+      { title: 'Step 4 — One-way shear check (φ = ' + phiS + ')', ref: isA ? AA('Art. 5.7.3') : 'ACI 318-19 Table 22.5.5.1(c)', steps: pre('s4', T4) },
+      { title: 'Step 5 — Development length and bar cutoff', ref: isA ? AA('Art. 5.10.8') : 'ACI 318-19 §25.4 / §9.7.3', steps: pre('s5', T5) },
+      { title: 'Step 6 — Horizontal temperature and shrinkage steel', ref: isA ? AA('Art. 5.10.6') : 'ACI 318-19 §24.4.3.2', steps: pre('s6', T6) }], { title: 'Stem, base section (b = 12 in strip, cantilever fixed at the footing)' }),
+      { type: 'note', text: 'K_a: ' + (isA ? '[[sa1/K]]' : '[[st1/Ka]]') + (isA && qll > 0 ? '; q_LS: [[sa2/qLS]]' : '') + '.' },
+      { type: 'note', text: 'Critical section at the top of the footing.' }, onTab('stemFlex', 'Stem design tab (pressure and V(z), M(z) diagrams)')]));
+    const st = r.sel_stemT, M = [rwrS({ id: 'Msoil', label: 'Factored moment, soil + surcharge over the top half (h = ' + rwrN(r.Hs_mid, 2) + ' ft)', sym: 'M_{u,soil}', eq: '', sub: '', value: r.Mu_stemT_soil, unit: 'lb-ft/ft', d: 1 })];
+    if (r.Mu_stemT_ct > 0) M.push(rwrS({ id: 'Mct', label: 'Additional collision moment (Extreme Event II, γ_CT = 1.0)', sym: 'M_{u,CT}', eq: 'CT_{h}(h/2 + h_{CT})', sub: '', value: r.Mu_stemT_ct, unit: 'lb-ft/ft', d: 1, ref: AA('Art. 3.6.5') }));
+    M.push(rwrS({ id: 'Mu', label: 'Total factored design moment at mid-height', sym: 'M_{u}', eq: '', sub: '', value: r.Mu_stemT_lbft, unit: 'lb-ft/ft', d: 1 }));
+    M.push(rwrS({ id: 'd', label: 'Effective depth at mid-height (t_mid = ' + rwrN(r.ts_mid, 2) + ' in)', sym: 'd', eq: 't_{mid} \\minus c_{c} \\minus \\frac{d_{b}}{2}', sub: rwrN(r.ts_mid, 2) + ' \\minus ' + rwrN(inp.cov_stem, 2) + ' \\minus ' + rwrN(st.bar.db / 2, 4), value: r.d_stemT, unit: 'in', d: 2 }));
+    const M2 = [rwrS({ id: 'As', label: 'Required area of steel at mid-height', sym: 'A_{s,req}', eq: '', sub: '', value: r.As_stemT_des, unit: 'in^{2}/ft', d: 4 }),
+      rwrS({ id: 'S3', label: 'Bar selection S3 (mid-height vertical): #' + st.bar.num + ' at ' + st.spacing + ' in' + (st.overridden ? ' (user override)' : '') + (r.stemT_overstressed ? '; section over-stressed' : ''), sym: 'A_{s,prov}', eq: '', sub: rwrN(st.As_prov, 4) + ' \\ge ' + rwrN(r.As_stemT_des, 4), value: st.As_prov, unit: 'in^{2}/ft', d: 4, ok: ok('stemMidFlex') }),
+      rwrS({ id: 'dc', label: 'One-way shear at mid-height (' + rwrPlain(r.shearStemT.method) + '): V_u ≤ φV_c', sym: '\\frac{V_{u}}{\\phi V_{c}}', eq: '', sub: '\\frac{' + rwrN(r.Vu_stemT, 0) + '}{' + rwrN(r.phiVc_stemT, 0) + '}', value: dcv('stemMidShear'), unit: '', d: 3, ok: ok('stemMidShear') })];
+    CK.stemMidFlex = 'stm/m2.S3'; CK.stemMidShear = 'stm/m2.dc';
+    subs.push(sub('Mid-height (top-half) section', [rwrItem('stm', [{ title: 'Mid Step 1 — Factored demands at mid-height', steps: pre('m1', M) }, { title: 'Mid Step 2 — Flexural reinforcement and shear', steps: pre('m2', M2) }], { title: 'Stem, mid-height section (h_s/2 = ' + rwrN(r.Hs_mid, 2) + ' ft above the base)' }),
+      { type: 'note', text: 'The section at mid-height is designed as a cantilever fixed at mid-height.' }, onTab('stemMid', 'Stem design tab, Mid Step 2')]));
+    secs.push({ title: 'Stem design', subs });
+  }
+
+  /* ---------- 5. Footing ---------- */
+  {
+    const subs = [], down = r.Mu_heel_net >= 0, fk = x => rwrN(x / 1000, 3), phiF = isA ? '0.90' : '0.75';
+    const H1 = [rwrS({ id: 'wu', label: 'Factored downward load, uniform over the heel (' + (r.heel_min_governs ? (isA ? 'Strength Ia' : 'U = 0.9D + 1.6H') : (isA ? 'Strength I' : 'U = 1.2D + 1.6H')) + ' governs case A)', sym: 'w_{u}', eq: isA ? rwrN(r.gHeel[0], 2) + '\\,w_{EV} + ' + rwrN(r.gHeel[1], 2) + '\\gamma_{c} t_{f} + ' + rwrN(r.gHeel[2], 2) + '\\,q_{s} + ' + rwrN(r.gHeel[3], 2) + '\\,q_{LS}' : rwrN(r.gHeel[0], 1) + '(w_{EV} + \\gamma_{c} t_{f}) + ' + rwrN(r.gHeel[2], 1) + '\\,q_{s}', sub: 'w_{EV} = ' + rwrN(r.w_soil_col, 1) + ',\\; \\gamma_{c} t_{f} = ' + rwrN(inp.gamma_c * r.tf_ft, 1), value: r.wu_heel, unit: 'psf', d: 1 }),
+      rwrS({ id: 'q0', label: 'Factored upward bearing at the stem face', sym: 'q_{u}(0)', eq: 'q_{u,back}', sub: '', value: r.q0h, unit: 'psf', d: 1, note: isA ? 'AASHTO basis: the factored bearing for the footing design is not worked on a tab (open item)' : '' }),
+      rwrS({ id: 'qL', label: 'Factored upward bearing at the heel tip', sym: 'q_{u}(L_{h})', eq: 'q_{u,heel}', sub: '', value: r.qLh, unit: 'psf', d: 1 })];
+    const H2 = [rwrS({ id: 'Md', label: 'Moment of the downward load about the back face', sym: 'M_{down}', eq: '\\frac{w_{u} L_{h}^{2}}{2}', sub: '\\frac{(' + rwrN(r.wu_heel, 1) + ')(' + rwrN(inp.Lh, 2) + ')^{2}}{2}', value: r.Md_heel, unit: 'lb-ft/ft', d: 1 }),
+      rwrS({ id: 'Mup', label: 'Moment of the upward bearing about the back face (trapezoid)', sym: 'M_{up}', eq: '\\frac{q_{0} L_{h}^{2}}{2} + \\frac{(q_{L} \\minus q_{0})L_{h}^{2}}{3}', sub: '\\frac{(' + rwrN(r.q0h, 1) + ')(' + rwrN(inp.Lh, 2) + ')^{2}}{2} + \\frac{(' + rwrN(r.qLh, 1) + ' \\minus ' + rwrN(r.q0h, 1) + ')(' + rwrN(inp.Lh, 2) + ')^{2}}{3}', value: r.Mu_heel_up, unit: 'lb-ft/ft', d: 1 }),
+      rwrS({ id: 'MA', label: 'Case A, standard: net moment (upward relief credited)', sym: 'M_{u,A}', eq: 'M_{down} \\minus M_{up}', sub: rwrN(r.Md_heel, 1) + ' \\minus ' + rwrN(r.Mu_heel_up, 1), value: r.Mu_heel_std / 1000, unit: 'kip-ft/ft', d: 3, note: 'V_u,A = |w_u L_h − (q_0 + q_L)/2 · L_h| = ' + fk(r.Vu_heel_std) + ' kip/ft' }),
+      rwrS({ id: 'MB', label: 'Case B, no upward relief: full factored downward cantilever', sym: 'M_{u,B}', eq: 'M_{down}', sub: '', value: r.Mu_heel_nr / 1000, unit: 'kip-ft/ft', d: 3, note: 'V_u,B = w_u L_h = ' + fk(r.Vu_heel_nr) + ' kip/ft' })];
+    if (r.useMassDOTFtg) H2.push(rwrS({ id: 'MMD', label: 'MassDOT §3.3.2.2 heel top steel: DL only, no upward relief (γ = φ = 1.0)' + (r.heel_md_governs ? ', governs' : ', does not govern'), sym: 'M_{u,MD}', eq: '\\frac{w_{DL} L_{h}^{2}}{2}', sub: '\\frac{(' + rwrN(inp.gamma_s * inp.Hs + inp.gamma_c * r.tf_ft, 1) + ')(' + rwrN(inp.Lh, 2) + ')^{2}}{2}', value: r.Mu_heel_md, unit: 'lb-ft/ft', d: 1, ref: 'MassDOT LRFD Bridge Manual §3.3.2.2' }));
+    H2.push(rwrS({ id: 'Mu', label: 'Design moment at the stem face, basis ' + ({ std: 'standard', norelief: 'no upward relief', envelope: 'envelope' }[r.heelBasis] || 'standard') + (r.heel_md_governs ? ' (MassDOT governs)' : '') + ' (' + (down ? 'top' : 'bottom') + ' bars)', sym: 'M_{u}', eq: '', sub: '', value: r.Mu_heel_net, unit: 'lb-ft/ft', d: 1 }),
+      rwrS({ id: 'Vu', label: 'Design shear at the stem face', sym: 'V_{u}', eq: '', sub: '', value: r.Vu_heel, unit: 'lb/ft', d: 1 }));
+    const sh = r.sel_heel, H3 = [rwrS({ id: 'd', label: 'Effective depth', sym: 'd', eq: 't_{f} \\minus c_{c} \\minus \\frac{d_{b}}{2}', sub: rwrN(inp.tf, 1) + ' \\minus ' + rwrN(inp.cov_ftg, 2) + ' \\minus ' + rwrN(sh.bar.db / 2, 4), value: r.d_heel, unit: 'in', d: 3 })];
+    const flexF = (Mu_in, d, Rn, Asr, Asm, Asd, sel, mark, okk, osd) => [
+      rwrS({ id: 'Rn', label: 'Flexural resistance factor', sym: 'R_{n}', eq: '\\frac{M_{u}}{\\phi\\,b\\,d^{2}}', sub: '\\frac{' + rwrN(Mu_in, 0) + '}{(0.90)(12)(' + rwrN(d, 3) + ')^{2}}', value: Rn, unit: 'psi', d: 2 }),
+      rwrS({ id: 'Asr', label: 'Required steel', sym: 'A_{s,req}', eq: '\\frac{0.85 ' + RWR_FC + '}{f_{y}}\\left(1 \\minus \\sqrt{1 \\minus \\frac{2R_{n}}{0.85 ' + RWR_FC + '}}\\right)b\\,d', sub: '', value: Asr, unit: 'in^{2}/ft', d: 4 }),
+      rwrS({ id: 'Asm', label: 'Minimum steel', sym: 'A_{s,min}', eq: isA ? '\\phi M_{n} \\ge \\min(M_{cr},\\, 1.33M_{u})' : '0.0018\\,b\\,h', sub: isA ? '' : '0.0018(12)(' + rwrN(inp.tf, 1) + ')', value: Asm, unit: 'in^{2}/ft', d: 4, ref: isA ? AA('Art. 5.6.3.3') : 'ACI 318-19 §7.6.1.1 (via §13.3.7)' }),
+      rwrS({ id: mark, label: 'Bar selection ' + mark + ': #' + sel.bar.num + ' at ' + sel.spacing + ' in' + (sel.overridden ? ' (user override)' : '') + (osd ? '; section over-stressed' : ''), sym: 'A_{s,prov}', eq: '', sub: rwrN(sel.As_prov, 4) + ' \\ge ' + rwrN(Asd, 4), value: sel.As_prov, unit: 'in^{2}/ft', d: 4, ok: okk, ref: isA ? AA('Art. 5.6.3') : 'ACI 318-19 §9.5 / §22.2' })];
+    H3.push(...flexF(r.Mu_heel_in, r.d_heel, r.Rn_heel, r.As_heel_req, r.As_h_min, r.As_heel_des, sh, 'F1', ok('heelFlex'), r.heel_overstressed));
+    const vcF = (shr, Vc, d) => isA
+      ? [rwrS({ id: 'dv', label: 'Effective shear depth', sym: 'd_{v}', eq: '\\max(0.9d,\\; 0.72h)', sub: '\\max(0.9(' + rwrN(d, 2) + '),\\; 0.72(' + rwrN(inp.tf, 1) + '))', value: shr.dv, unit: 'in', d: 2, ref: AA('Art. 5.7.2.8') }),
+         ...(shr.useSimple ? [] : [rwrS({ id: 'beta', label: 'Shear transmission factor, general procedure (ε_s = ' + rwrN(shr.eps_s * 1000, 3) + '×10⁻³, s_xe = ' + rwrN(shr.sxe, 1) + ' in)', sym: '\\beta', eq: '\\frac{4.8}{1 + 750\\epsilon_{s}}\\cdot\\frac{51}{39 + s_{xe}}', sub: '', value: shr.beta, unit: '', d: 3, ref: AA('Art. 5.7.3.4.2') })]),
+         rwrS({ id: 'Vc', label: 'Nominal concrete shear resistance, ' + rwrPlain(shr.method), sym: 'V_{c}', eq: '0.0316\\,\\beta\\sqrt{' + RWR_FC + '}\\,b_{v} d_{v}', sub: '0.0316(' + rwrN(shr.beta, 3) + ')\\sqrt{' + rwrN(inp.fc / 1000, 2) + '}(12)(' + rwrN(shr.dv, 2) + ')(1000)', value: Vc, unit: 'lb/ft', d: 0 })]
+      : [rwrS({ id: 'Vc', label: 'Nominal concrete shear, size effect (λ_s = ' + rwrN(shr.lam_s, 3) + ', ρ_w = ' + rwrN(shr.rho, 5) + ')', sym: 'V_{c}', eq: '8\\lambda_{s}\\lambda\\,\\rho_{w}^{1/3}\\sqrt{' + RWR_FC + '}\\,b\\,d', sub: '8(' + rwrN(shr.lam_s, 3) + ')(1.0)(' + rwrN(shr.rho, 5) + ')^{1/3}\\sqrt{' + rwrN(inp.fc, 0) + '}(12)(' + rwrN(d, 2) + ')', value: Vc, unit: 'lb/ft', d: 0, ref: 'ACI 318-19 Table 22.5.5.1(c)' })];
+    const H4 = vcF(r.shearHeel, r.Vc_heel, r.d_heel).concat([
+      rwrS({ id: 'phiVc', label: 'Design shear resistance', sym: '\\phi V_{c}', eq: phiF + '\\,V_{c}', sub: phiF + '(' + rwrN(r.Vc_heel, 0) + ')', value: r.phiVc_heel, unit: 'lb/ft', d: 0 }),
+      rwrS({ id: 'dc', label: 'One-way shear at the face of the stem: V_u ≤ φV_c', sym: '\\frac{V_{u}}{\\phi V_{c}}', eq: '', sub: '\\frac{' + rwrN(r.Vu_heel, 0) + '}{' + rwrN(r.phiVc_heel, 0) + '}', value: dcv('heelShear'), unit: '', d: 3, ok: ok('heelShear') }),
+      rwrS({ id: 'ld', label: 'Development length, top bars (' + (isA ? 'λ_rl = 1.3' : 'ψ_t = 1.3') + ')', sym: '\\ell_{d}', eq: '', sub: '', value: r.ld_heel, unit: 'in', d: 1, ref: isA ? AA('Art. 5.10.8.2.1a') : 'ACI 318-19 §25.4.2' })]);
+    const pre = (p, L) => L.map(s => Object.assign({}, s, { id: p + '.' + s.id }));
+    CK.heelFlex = 'heel/h3.F1'; CK.heelShear = 'heel/h4.dc';
+    subs.push(sub('Heel: cantilever from the back face (L_h = ' + rwrN(inp.Lh, 2) + ' ft)', [rwrItem('heel', [
+      { title: 'Heel Step 1 — Factored loads', steps: pre('h1', H1) }, { title: 'Heel Step 2 — Design moment and shear at the face of the stem', steps: pre('h2', H2) },
+      { title: 'Heel Step 3 — Flexural steel (' + (down ? 'top' : 'bottom') + ' face)', ref: isA ? AA('Art. 5.6.3') : 'ACI 318-19 §9.5', steps: pre('h3', H3) },
+      { title: 'Heel Step 4 — Shear and development', ref: isA ? AA('Art. 5.7.3') : 'ACI 318-19 Table 22.5.5.1(c)', steps: pre('h4', H4) }], { title: 'Heel' }), isA ? null : { type: 'note', text: 'q_u,back and q_u,heel: [[st7/quback]], [[st7/quheel]] (and the minimum-vertical case, [[st7/qubackmin]]).' },
+      { type: 'note', text: 'Serviceability (crack control) uses the unfactored no-relief moment.' }, onTab('heelFlex', 'Footing design tab, Heel (shear and moment diagrams)')]));
+    const sT = r.sel_toe, T1 = [rwrS({ id: 'wsw', label: 'Factored self-weight of the footing (downward)' + (r.toe_min_governs ? '; bearing from ' + (isA ? 'Strength Ia' : 'U = 0.9D + 1.6H') + ' governs the toe' : ''), sym: 'w_{sw}', eq: '0.9\\,\\gamma_{c} t_{f}', sub: '0.9(' + rwrN(inp.gamma_c, 0) + ')(' + rwrN(r.tf_ft, 3) + ')', value: r.wu_toe_down, unit: 'psf', d: 1 }),
+      rwrS({ id: 'q0', label: 'Net upward pressure at the front face', sym: 'q_{net}(0)', eq: 'q_{u,front} \\minus w_{sw}', sub: '', value: r.net_q0t, unit: 'psf', d: 1, }),
+      rwrS({ id: 'qL', label: 'Net upward pressure at the toe tip', sym: 'q_{net}(L_{t})', eq: 'q_{u,toe} \\minus w_{sw}', sub: '', value: r.net_qLt, unit: 'psf', d: 1 })];
+    const T2 = [rwrS({ id: 'Mu', label: 'Design moment about the front face (tension on the bottom)', sym: 'M_{u}', eq: '\\frac{q_{0} L_{t}^{2}}{2} + \\frac{(q_{L} \\minus q_{0})L_{t}^{2}}{3}', sub: '\\frac{(' + rwrN(r.net_q0t, 1) + ')(' + rwrN(inp.Lt, 2) + ')^{2}}{2} + \\frac{(' + rwrN(r.net_qLt, 1) + ' \\minus ' + rwrN(r.net_q0t, 1) + ')(' + rwrN(inp.Lt, 2) + ')^{2}}{3}', value: r.Mu_toe_net, unit: 'lb-ft/ft', d: 1 }),
+      rwrS({ id: 'Vu', label: 'Design shear at the front face', sym: 'V_{u}', eq: '\\frac{q_{0} + q_{L}}{2}\\,L_{t}', sub: '\\frac{' + rwrN(r.net_q0t, 1) + ' + ' + rwrN(r.net_qLt, 1) + '}{2}(' + rwrN(inp.Lt, 2) + ')', value: r.Vu_toe, unit: 'lb/ft', d: 1 })];
+    const T3 = [rwrS({ id: 'd', label: 'Effective depth', sym: 'd', eq: 't_{f} \\minus c_{c} \\minus \\frac{d_{b}}{2}', sub: rwrN(inp.tf, 1) + ' \\minus ' + rwrN(inp.cov_ftg, 2) + ' \\minus ' + rwrN(sT.bar.db / 2, 4), value: r.d_toe, unit: 'in', d: 3 })]
+      .concat(flexF(r.Mu_toe_in, r.d_toe, r.Rn_toe, r.As_toe_req, r.As_t_min, r.As_toe_des, sT, 'F2', ok('toeFlex'), r.toe_overstressed));
+    const T4 = vcF(r.shearToe, r.Vc_toe, r.d_toe).concat([
+      rwrS({ id: 'phiVc', label: 'Design shear resistance', sym: '\\phi V_{c}', eq: phiF + '\\,V_{c}', sub: phiF + '(' + rwrN(r.Vc_toe, 0) + ')', value: r.phiVc_toe, unit: 'lb/ft', d: 0 }),
+      rwrS({ id: 'dc', label: 'One-way shear at the front face: V_u ≤ φV_c', sym: '\\frac{V_{u}}{\\phi V_{c}}', eq: '', sub: '\\frac{' + rwrN(r.Vu_toe, 0) + '}{' + rwrN(r.phiVc_toe, 0) + '}', value: dcv('toeShear'), unit: '', d: 3, ok: ok('toeShear') }),
+      rwrS({ id: 'ld', label: 'Development length into the stem', sym: '\\ell_{d}', eq: '', sub: '', value: r.ld_toe, unit: 'in', d: 1, ref: isA ? AA('Art. 5.10.8.2.1a') : 'ACI 318-19 §25.4.2' })]);
+    CK.toeFlex = 'toe/t3.F2'; CK.toeShear = 'toe/t4.dc';
+    subs.push(sub('Toe: cantilever from the front face (L_t = ' + rwrN(inp.Lt, 2) + ' ft)', [rwrItem('toe', [
+      { title: 'Toe Step 1 — Net upward load', steps: pre('t1', T1) }, { title: 'Toe Step 2 — Design moment and shear at the front face', steps: pre('t2', T2) },
+      { title: 'Toe Step 3 — Flexural steel (bottom face)', ref: isA ? AA('Art. 5.6.3') : 'ACI 318-19 §9.5', steps: pre('t3', T3) },
+      { title: 'Toe Step 4 — Shear and development', ref: isA ? AA('Art. 5.7.3') : 'ACI 318-19 Table 22.5.5.1(c)', steps: pre('t4', T4) }], { title: 'Toe' }), isA ? null : { type: 'note', text: 'q_u,front and q_u,toe: [[st7/qufront]], [[st7/qutoe]].' },
+      onTab('toeFlex', 'Footing design tab, Toe')]));
+    const L = [isA ? rwrS({ id: 'As', label: 'Required temperature and shrinkage steel, per face (b = footing width ' + rwrN(r.b_TS_ftg, 0) + ' in)', sym: 'A_{s,TS}', eq: '\\frac{1.30\\,b\\,h}{2(b + h)f_{y}},\\; 0.11 \\le A_{s} \\le 0.60', sub: '\\frac{1.30(' + rwrN(r.b_TS_ftg, 0) + ')(' + rwrN(inp.tf, 1) + ')}{2(' + rwrN(r.b_TS_ftg, 0) + ' + ' + rwrN(inp.tf, 1) + ')(' + rwrN(inp.fy / 1000, 0) + ')}', value: r.As_ftg_long, unit: 'in^{2}/ft', d: 4, ref: AA('Eq. 5.10.6-1') })
+      : rwrS({ id: 'As', label: 'Required temperature and shrinkage steel', sym: 'A_{s,TS}', eq: '0.0018\\,b\\,t_{f}', sub: '0.0018(12)(' + rwrN(inp.tf, 1) + ')', value: r.As_ftg_long, unit: 'in^{2}/ft', d: 4, ref: 'ACI 318-19 §24.4.3.2' }),
+      rwrS({ id: 'F3', label: 'Bar selection F3 (longitudinal, both faces): #' + r.sel_ftg_long.bar.num + ' at ' + r.sel_ftg_long.spacing + ' in' + (r.sel_ftg_long.overridden ? ' (user override)' : ''), sym: 'A_{s,prov}', eq: '', sub: rwrN(r.sel_ftg_long.As_prov, 4) + ' \\ge ' + rwrN(r.As_ftg_long, 4), value: r.sel_ftg_long.As_prov, unit: 'in^{2}/ft', d: 4, ok: ok('tsFtg') })];
+    CK.tsFtg = 'lng/F3';
+    subs.push(sub('Longitudinal reinforcement: temperature and shrinkage parallel to the wall', [rwrItem('lng', [{ title: 'T&S', steps: L }]), onTab('ftgTS')]));
+    secs.push({ title: 'Footing design', subs });
+  }
+
+  /* ---------- 6. Reinforcement schedule (+ ACI crack control) ---------- */
+  {
+    const rows = [['S1', 'Stem — vertical (back face)', r.sel_stem, r.As_stem_des, r.ld_stem, r.stem_overstressed, 'stb/s3.S1'], ['S3', 'Stem — vertical mid-height (top half)', r.sel_stemT, r.As_stemT_des, null, r.stemT_overstressed, 'stm/m2.S3'],
+      ['S2', 'Stem — horizontal T&S (both faces)', r.sel_temp, r.As_temp_stem, null, false, 'stb/s6.S2'], ['F1', 'Heel — transverse ' + (r.Mu_heel_net >= 0 ? 'top' : 'bottom') + ' bars', r.sel_heel, r.As_heel_des, r.ld_heel, r.heel_overstressed, 'heel/h3.F1'],
+      ['F2', 'Toe — transverse bottom bars', r.sel_toe, r.As_toe_des, r.ld_toe, r.toe_overstressed, 'toe/t3.F2'], ['F3', 'Footing — longitudinal T&S (both faces)', r.sel_ftg_long, r.As_ftg_long, null, false, 'lng/F3']]
+      .map(([m, loc, s, req, ld, os, key]) => { const okk = !os && s.As_prov >= req - 0.001;
+        return { cells: [{ t: m + (s.overridden ? ' (override)' : ''), key }, loc, '#' + s.bar.num, rwrCell(s.spacing, 0), rwrCell(req, 4), rwrCell(s.As_prov, 4), rwrCell(s.As_prov / Math.max(req, 0.001), 2), ld == null ? '—' : rwrCell(ld, 1), { t: okk ? 'OK' : 'NG', cls: okk ? 'ok' : 'ng' }] }; });
+    const items = [{ type: 'table', wide: true, caption: 'Bar schedule per foot of wall (f′c = ' + rwrN(inp.fc, 0) + ' psi, f_y = ' + rwrN(inp.fy / 1000, 0) + ' ksi)', head: ['Mark', 'Location', 'Bar', 's (in)', 'A_s,req (in²/ft)', 'A_s,prov (in²/ft)', 'Ratio', 'ℓ_d (in)', 'Status'], rows },
+      { type: 'note', text: 'Each mark links to its bar selection.' }, { type: 'note', text: '[[tab:rebar|On screen: Rebar schedule tab]]' }];
+    const subs = [sub('Bar schedule', items)];
+    if (r.aciCr) {
+      const T = [['stem', 'Stem S1 (back face)', 'Stem'], ['heel', 'Heel F1', 'Heel'], ['toe', 'Toe F2', 'Toe']].map(([k, nm, K]) => { const x = r.aciCr[k];
+        CK['crack' + K] = 'crk/' + k + '.dc';
+        return { title: nm, ref: 'ACI 318-19 §24.3.2', steps: [
+          rwrS({ id: k + '.smax', label: nm + ': maximum bar spacing (f_s = ⅔ f_y = ' + rwrN(x.fs, 0) + ' psi, c_c = ' + rwrN(x.cc, 2) + ' in)', sym: 's_{max}', eq: '\\min\\left(15\\,\\frac{40000}{f_{s}} \\minus 2.5\\,c_{c},\\; 12\\,\\frac{40000}{f_{s}}\\right)', sub: '\\min(' + rwrN(15 * 40000 / x.fs - 2.5 * x.cc, 2) + ',\\; ' + rwrN(12 * 40000 / x.fs, 2) + ')', value: x.smax, unit: 'in', d: 2, ref: 'ACI 318-19 §24.3.2' }),
+          rwrS({ id: k + '.dc', label: nm + ': s ≤ s_max', sym: '\\frac{s}{s_{max}}', eq: '', sub: '\\frac{' + rwrN(x.spacing, 2) + '}{' + rwrN(x.smax, 2) + '}', value: dcv('crack' + K), unit: '', d: 3, ok: ok('crack' + K) })] }; });
+      subs.push(sub('Crack-control bar spacing', [rwrItem('crk', T), { type: 'note', text: 'ACI 318-19 §24.3.2 with f_s = ⅔ f_y. Not worked on a result tab (worked in the Export report §7 and here).' }]));
+    }
+    secs.push({ title: 'Reinforcement schedule', subs });
+  }
+
+  /* ---------- 7. Warnings and assumptions, 8. References ---------- */
+  {
+    const items = [];
+    if (meta.notes) items.push({ type: 'note', text: 'Project notes: ' + meta.notes });
+    (isA ? ['AASHTO LRFD limit-state design: load factors Tables 3.4.1-1/-2, resistance factors as entered (Design Options).',
+      'Earth pressure ' + (A.ep_method === 'coulomb' ? 'Coulomb' : 'Rankine') + ', ' + (A.ep_cond === 'atrest' ? 'at-rest' : 'active') + '; one coefficient is used for the stability and the stem design.',
+      'Concrete design is enveloped Strength I / Ia' + (a.ct ? ' and Extreme Event II' : '') + '; b = 12 in design strip.']
+      : ['Stability with service (unfactored) loads, FOS ≥ 1.5 (IBC 2021 §1807.2.3); concrete design with U = 1.2D + 1.6H and 0.9D + 1.6H (ACI 318-19 §5.3).',
+        'Rankine earth pressure; surcharge over the heel and column live / snow loads are excluded from the resisting forces and included in the bearing check.',
+        'b = 12 in design strip; no shear reinforcement (ACI 318-19 Table 22.5.5.1(c)).']).forEach(t => items.push({ type: 'note', text: t }));
+    (r.warnings || []).forEach(w => items.push({ type: 'note', warn: true, text: 'Warning: ' + rwrPlain(w) }));
+    secs.push({ title: 'Assumptions and warnings', subs: [sub('Assumptions and warnings', items)] });
+    secs.push({ title: 'References', subs: [sub('Codes and references cited', [{ type: 'table', head: ['Reference', 'Provisions used'], rows: RW_REFS[isA ? 'AASHTO' : 'ACI'].map(([x, y]) => [rwrPlain(x), rwrPlain(y)]) }])] });
+  }
+
+  /* ---------- 1. Design summary (in front) ---------- */
+  {
+    const rows = Object.entries(r.checks).map(([k, c]) => { const x = DC[k] || {}, dc = x.dc;
+      return { cells: [rwrPlain(c.label), c.val != null ? rwrPlain(c.val) : '—', { t: (typeof dc === 'number' && isFinite(dc)) ? rwrN(dc, 2) : (dc === Infinity ? '∞' : 'n/a'), n: true }, rwrPlain(x.ref || '') + (x.note ? '; ' + rwrPlain(x.note) : ''), { t: c.ok ? 'PASS' : 'FAIL', cls: c.ok ? 'ok' : 'ng' }, CK[k] ? { t: '', key: CK[k] } : '—'], cls: c.ok ? '' : 'gov' }; });
+    const nF = Object.values(r.checks).filter(c => !c.ok).length, nT = Object.keys(r.checks).length;
+    secs.unshift({ title: 'Design summary', subs: [sub(nF ? nF + ' of ' + nT + ' checks fail' : 'All ' + nT + ' checks pass', [{ type: 'table', wide: true, head: ['Check', 'Value', 'D/C', 'Basis', 'Status', 'Worked in'], rows },
+      { type: 'note', text: 'The checks of the status bar, with D/C as in the Export report (for a factor-of-safety check D/C = 1.5 / FOS). ' + (isA ? '' : 'Crack control (ACI 318-19 §24.3.2) is counted in the status bar. ') + '' }, { type: 'note', text: '[[tab:overview|On screen: Overview tab (scorecard)]]' }])] });
+  }
+  const codes = isA ? 'AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024)' : 'ACI 318-19 · IBC 2021 · ASCE 7-22';
+  return { title: 'Cantilever Retaining Wall — Calculation Report', subtitle: meta.name || 'Unnamed project', code: codes,
+    info: [['Project', meta.name], ['Project No.', meta.num], ['Calculated by', meta.eng], ['Date', ''], ['Checked by', meta.chk], ['Checked date', '']],
+    head: { left: 'Project No. ' + (meta.num || '—') + ' — ' + String(meta.notes || meta.name || '—').slice(0, 40), right: 'Computed: ' + (meta.eng || '—') + ' · Checked: ' + (meta.chk || '—'), foot: (meta.name || 'Unnamed project') + ' (RetainCalc Pro — Retaining Wall Designer)' },
+    sections: secs };
+}
+function renderRwReport() {
+  const T = document.getElementById('tab-report'); if (!T) return;
+  if (!window.SharedReport || !window.SharedSteps) { T.innerHTML = '<div class="alert fail">⚠ shared/report.js or shared/steps.js is not loaded: keep the shared folder next to this file.</div>'; RWRP.api = null; RWRP.doc = null; return; }
+  const r = window._R;
+  if (!r || r.fatal) { T.innerHTML = (r && r.errors ? r.errors : ['No results.']).map(e => `<div class="alert fail">⚠ ${e}</div>`).join('') + '<div class="alert info">Correct the input errors to see the report.</div>'; RWRP.api = null; RWRP.doc = null; return; }
+  let M;
+  try { M = rwrModel(r); } catch (e) { console.error(e); T.innerHTML = '<div class="alert fail">⚠ Report error: ' + String(e && e.message).replace(/</g, '&lt;') + '</div>'; RWRP.api = null; RWRP.doc = null; return; }
+  RWRP.api = SharedReport.mount(T, M, { closed: RWRP.closed, onGoto: rwrGoto });
+  RWRP.doc = RWRP.api.doc;
+}
+/* [[tab:…]] links of the report: a result tab, or "card:<key>" (the card on its tab, as the D11 "Worked in" links) */
+function rwrGoto(name) {
+  if (name.indexOf('card:') === 0) { rwGoto(name.slice(5)); return; }
+  const b = document.querySelector(`.tab-btn[data-tab="${name}"]`); if (b) b.click();
+  const P = document.querySelector('.tab-panels'); if (P) P.scrollTop = 0;
+}
+document.querySelector('.tab-btn[data-tab="report"]').addEventListener('click', renderRwReport);
+/* Ctrl+P while the Report tab is shown prints the report alone (shared/report.js print layout and running header);
+   from any other tab the page prints as before (the Report panel is hidden in print, see the RWRP rule in @media print) */
+window.addEventListener('beforeprint', () => {
+  const T = document.getElementById('tab-report');
+  if (!RWRP.doc || !T || !T.classList.contains('active') || document.body.classList.contains('rp-printing')) return;
+  let box = document.getElementById('rp-print'); if (!box) { box = document.createElement('div'); box.id = 'rp-print'; document.body.appendChild(box); }
+  box.innerHTML = '<div class="rp"><article class="rp-doc">' + SharedReport.html(RWRP.doc, { lazy: false }) + '</article></div>';
+  document.body.classList.add('rp-printing');
+});
+</script>
```

## 2026-11-01 — PR: claude/rpt-retwall-full — Report tab: the factored bearing trapezoids worked (ACI and AASHTO), the tab charts as figures (RWRP2; display only) (PR #574: https://github.com/mlococo88/All-Structural/pull/574)

Every code site is tagged `RWRP2`. The tool file uses CRLF line endings; keep them.

### RWRP2. Self-contained report: everything of the Export report now in the Report tab   [display only]
- **Engineer decision (2026-11-01):** every report self-contained with full worked steps; work the AASHTO footing bearing q_u at the stem faces (display of the tool's own values; report anything not computed), and anything else of the Export report not yet worked in the Report tab.
- **`rwrTrap()`** (new helper inside `rwrModel`, anchor `RWRP2: the factored bearing trapezoid`): four steps for a factored bearing trapezoid — q_u,toe and q_u,heel from V and e (kern: V/B (1 ± 6e/B); outside the kern: 2V/(3x̄) or 2V/(3(B − x̄)), the branches of `calcAll`), and q_u,front / q_u,back by q(x) = q_toe + (q_heel − q_toe) x/B. Values are the tool's own fields.
- **ACI basis, §3 Step 7:** q_u,toe / q_u,heel / q_u,front / q_u,back of U = 1.2D + 1.6H (`r.qu_toe`, `r.quf_front`, …) and of U = 0.9D + 1.6H (`r.qu_toe_min`, …, with x̄_u = `r.x_Ru_min`, e_u = `r.e_u_min`) are now worked (before: values only).
- **AASHTO basis, new §3 subsection "Factored bearing for footing design (Strength I / Ia, full width B)"** (scope `saf`): V_u = `a.V_str_max_tot` and the Strength I trapezoid `a.quA_toe`, `a.quA_heel`, `a.quA_front`, `a.quA_back`; Strength Ia: V = `a.V_str_min_tot`, e = `a.e_Ia` and `a.quIa_*`. **Not computed / not returned:** the eccentricity of the Strength I footing-design resultant (`e_tot` inside `calcAll`) is not returned in `_R`. Without water uplift it is by construction the bearing-check eccentricity `a.e_brg` (same V and M_r), which the substitution uses; with uplift the Strength I toe and heel pressures are shown without substitution (noted in the report). No calculation was added.
- **Heel / toe notes** link to the trapezoid steps on both bases and say which case (maximum or minimum vertical) governs (`r.heel_min_governs`, `r.toe_min_governs`). This closes the 2026-10-18 open item "AASHTO footing bearing is not worked anywhere".
- **Charts:** `rwrAddPlots()` adds the result tabs' six Plotly charts (bearing pressure, stem pressure, stem V/M, footing loads, heel V/M, toe V/M) as figures in the subsections they belong to, from `rwPlotImages()` (the images the Export report embeds). `renderRwReport()` draws them asynchronously once per result and mounts the report again when they are ready (`RWRP.imgs`, memory only).
- **Saved data:** none. **Provision:** none (no formula, factor, unit, code reference or result changed).

### Check case (default ACI project)
- §3.7: q_u,front = q_u,toe + (q_u,heel − q_u,toe)·L_t/B with the values of Step 7; equals `r.quf_front` (spot-checked).

### How verified (headless Chromium, pinned libraries served locally)
- 7 cases (as RWRP): 107–149 steps, 21–26 subsections; 0 unresolved / duplicate references; 0 KaTeX errors; no NaN / undefined / raw TeX; 6 charts per report; spot values (now also `st7/qutoe`, `st7/qubackmin`, `saf/V`, `saf/qutoe`, `saf/quback`, `saf/qufrontIa`, `saf/eIa`) equal `_R`; `_R` unchanged; 0 console errors; Ctrl+P prints the report alone (AASHTO collision case 26 pages).
- `node tests/check-syntax.mjs "Retaining Wall Designer.html"`: pass.

### Other copies
- None.

Diff (`Retaining Wall Designer.html`, `git diff -U0` against origin/main; CR line ends removed here):

```diff
diff --git a/Retaining Wall Designer.html b/Retaining Wall Designer.html
index d3de356..e28171a 100644
--- a/Retaining Wall Designer.html	
+++ b/Retaining Wall Designer.html	
@@ -8742,0 +8743,13 @@ function rwrModel(r) {
+  /* RWRP2: the factored bearing trapezoid under the footing: q at the toe and heel from V and e (kern or triangular, as calcAll),
+     and q at the stem faces by linear interpolation q(x) = q_toe + (q_heel - q_toe) x / B. e is null when the tool does not
+     return it (AASHTO Strength I footing trapezoid with water uplift): the equation is then shown without substitution. */
+  const rwrTrap = (k, V, e, xR, qt, qh, qf, qb, Vsym, tail) => { tail = tail || ''; const B = r.B, Bs = rwrN(B, 3), Vs = rwrN(V, 1), kern = e == null ? null : Math.abs(e) <= B / 6 + 1e-12;
+    const xf = inp.Lt, xb = inp.Lt + r.ts_bot_ft;
+    const toe = kern === null ? ['\\frac{' + Vsym + '}{B}\\left(1 + \\frac{6e}{B}\\right)\\;\\text{or}\\;\\frac{2' + Vsym + '}{3\\bar{x}}', ''] : kern ? ['\\frac{' + Vsym + '}{B}\\left(1 + \\frac{6e}{B}\\right)', '\\frac{' + Vs + '}{' + Bs + '}\\left(1 + \\frac{6(' + rwrP(e, 4) + ')}{' + Bs + '}\\right)'] : e > 0 ? ['\\frac{2' + Vsym + '}{3\\bar{x}}', '\\frac{2(' + Vs + ')}{3(' + rwrN(xR, 4) + ')}'] : ['0', ''];
+    const heel = kern === null ? ['\\frac{' + Vsym + '}{B}\\left(1 \\minus \\frac{6e}{B}\\right)\\;\\text{or}\\;\\frac{2' + Vsym + '}{3(B \\minus \\bar{x})}', ''] : kern ? ['\\frac{' + Vsym + '}{B}\\left(1 \\minus \\frac{6e}{B}\\right)', '\\frac{' + Vs + '}{' + Bs + '}\\left(1 \\minus \\frac{6(' + rwrP(e, 4) + ')}{' + Bs + '}\\right)'] : e > 0 ? ['0', ''] : ['\\frac{2' + Vsym + '}{3(B \\minus \\bar{x})}', '\\frac{2(' + Vs + ')}{3(' + Bs + ' \\minus ' + rwrN(xR, 4) + ')}'];
+    const ip = x => ['q_{u,toe} + (q_{u,heel} \\minus q_{u,toe})\\frac{x}{B}', rwrN(qt, 1) + ' + (' + rwrN(qh, 1) + ' \\minus ' + rwrN(qt, 1) + ')\\frac{' + rwrN(x, 2) + '}{' + Bs + '}'];
+    const note = kern === null ? '' : kern ? '|e| ≤ B/6: trapezoid' : 'resultant outside the kern: triangular distribution (no tension)';
+    return [rwrS({ id: 'qutoe' + k, label: 'Factored bearing at the toe' + tail, sym: 'q_{u,toe}', eq: toe[0], sub: toe[1], value: qt, unit: 'psf', d: 1, note }),
+      rwrS({ id: 'quheel' + k, label: 'Factored bearing at the heel' + tail, sym: 'q_{u,heel}', eq: heel[0], sub: heel[1], value: qh, unit: 'psf', d: 1 }),
+      rwrS({ id: 'qufront' + k, label: 'Factored bearing at the front (toe) face of the stem, x = ' + rwrN(xf, 2) + ' ft' + tail, sym: 'q_{u,front}', eq: ip(xf)[0], sub: ip(xf)[1], value: qf, unit: 'psf', d: 1 }),
+      rwrS({ id: 'quback' + k, label: 'Factored bearing at the back (heel) face of the stem, x = ' + rwrN(xb, 2) + ' ft' + tail, sym: 'q_{u,back}', eq: ip(xb)[0], sub: ip(xb)[1], value: qb, unit: 'psf', d: 1 })]; };
@@ -8859,4 +8872 @@ function rwrModel(r) {
-      rwrS({ id: 'qutoe', label: 'Factored bearing at the toe', sym: 'q_{u,toe}', eq: '', sub: '', value: r.qu_toe, unit: 'psf', d: 1 }),
-      rwrS({ id: 'quheel', label: 'Factored bearing at the heel', sym: 'q_{u,heel}', eq: '', sub: '', value: r.qu_heel, unit: 'psf', d: 1 }),
-      rwrS({ id: 'qufront', label: 'Factored bearing at the front (toe) face of the stem, x = ' + rwrN(inp.Lt, 2) + ' ft (linear interpolation)', sym: 'q_{u,front}', eq: '', sub: '', value: r.quf_front, unit: 'psf', d: 1 }),
-      rwrS({ id: 'quback', label: 'Factored bearing at the back (heel) face of the stem, x = ' + rwrN(inp.Lt + r.ts_bot_ft, 2) + ' ft', sym: 'q_{u,back}', eq: '', sub: '', value: r.quf_back, unit: 'psf', d: 1 })];
+      ...rwrTrap('', r.SumVu, r.e_u, r.x_Ru, r.qu_toe, r.qu_heel, r.quf_front, r.quf_back, '\\sum V_{u}')];
@@ -8864,5 +8874,3 @@ function rwrModel(r) {
-        rwrS({ id: 'eumin', label: 'Factored eccentricity, minimum-vertical case', sym: 'e_{u}', eq: '', sub: '', value: r.e_u_min, unit: 'ft', d: 4 }),
-        rwrS({ id: 'qutoemin', label: 'Factored bearing at the toe, minimum-vertical case', sym: 'q_{u,toe}', eq: '', sub: '', value: r.qu_toe_min, unit: 'psf', d: 1 }),
-        rwrS({ id: 'quheelmin', label: 'Factored bearing at the heel, minimum-vertical case', sym: 'q_{u,heel}', eq: '', sub: '', value: r.qu_heel_min, unit: 'psf', d: 1 }),
-        rwrS({ id: 'qufrontmin', label: 'Factored bearing at the front face of the stem, minimum-vertical case', sym: 'q_{u,front}', eq: '', sub: '', value: r.quf_front_min, unit: 'psf', d: 1 }),
-        rwrS({ id: 'qubackmin', label: 'Factored bearing at the back face of the stem, minimum-vertical case', sym: 'q_{u,back}', eq: '', sub: '', value: r.quf_back_min, unit: 'psf', d: 1 })];
+        rwrS({ id: 'xRumin', label: 'Factored resultant location from the toe, minimum-vertical case', sym: '\\bar{x}_{u}', eq: '\\frac{M_{s,u} \\minus M_{o,u}}{\\sum V_{u}}', sub: '', value: r.x_Ru_min, unit: 'ft', d: 4 }),
+        rwrS({ id: 'eumin', label: 'Factored eccentricity, minimum-vertical case', sym: 'e_{u}', eq: '\\frac{B}{2} \\minus \\bar{x}_{u}', sub: '\\frac{' + rwrN(r.B, 3) + '}{2} \\minus ' + rwrN(r.x_Ru_min, 4), value: r.e_u_min, unit: 'ft', d: 4 }),
+        ...rwrTrap('min', r.SumVu_min, r.e_u_min, r.x_Ru_min, r.qu_toe_min, r.qu_heel_min, r.quf_front_min, r.quf_back_min, '\\sum V_{u}', ', minimum-vertical case')];
@@ -8972,0 +8981,8 @@ function rwrModel(r) {
+    { const sI = [rwrS({ id: 'V', label: 'Factored vertical load on the footing underside, Strength I maximum (total: water uplift added back, it acts on the same underside)', sym: 'V_{u}', eq: '\\eta(1.25\\,DC + 1.35\\,EV + \\gamma_{EH}\\,P_{a,V} + 1.75\\,LS_{v}) + V_{col}', sub: '', value: a.V_str_max_tot, unit: 'lb/ft', d: 0, ref: AA('Table 3.4.1-1') })];
+      const eI = a.V_up > 0 ? null : a.e_brg;   // without uplift the footing-design resultant is the bearing-check resultant (same V and M_r, calcAll)
+      sI.push(...rwrTrap('', a.V_str_max_tot, eI, r.B / 2 - (eI == null ? 0 : eI), a.quA_toe, a.quA_heel, a.quA_front, a.quA_back, 'V_{u}'));
+      const sIa = [rwrS({ id: 'VIa', label: 'Factored vertical load, Strength Ia minimum (total)', sym: 'V_{u}', eq: '0.90\\,DC + 1.00\\,EV + 0.90\\,P_{a,V}', sub: '', value: a.V_str_min_tot, unit: 'lb/ft', d: 0 }),
+        rwrS({ id: 'eIa', label: 'Eccentricity of the Strength Ia resultant (total vertical)', sym: 'e', eq: '\\frac{B}{2} \\minus \\bar{x}', sub: '', value: a.e_Ia, unit: 'ft', d: 3 })];
+      sIa.push(...rwrTrap('Ia', a.V_str_min_tot, a.e_Ia, r.B / 2 - a.e_Ia, a.quIa_toe, a.quIa_heel, a.quIa_front, a.quIa_back, 'V_{u}', ', Strength Ia'));
+      subs.push(sub('Factored bearing for footing design (Strength I / Ia, full width B)', [rwrItem('saf', [{ title: 'Strength I (maximum vertical)', ref: AA('Table 3.4.1-1'), steps: sI }, { title: 'Strength Ia (minimum vertical)', ref: AA('C11.5.6'), steps: sIa }]),
+        { type: 'note', text: 'Report only: the tab uses these values in the heel and toe cards without working them. The trapezoid across the full width B (not the Meyerhof width) is what the heel and toe design use; the envelope takes the case that governs each cantilever.' + (a.V_up > 0 ? ' With water uplift the tool does not return the eccentricity of the Strength I footing-design resultant, so the Strength I toe and heel pressures are shown without substitution.' : '') }])); }
@@ -9077 +9093 @@ function rwrModel(r) {
-      rwrS({ id: 'q0', label: 'Factored upward bearing at the stem face', sym: 'q_{u}(0)', eq: 'q_{u,back}', sub: '', value: r.q0h, unit: 'psf', d: 1, note: isA ? 'AASHTO basis: the factored bearing for the footing design is not worked on a tab (open item)' : '' }),
+      rwrS({ id: 'q0', label: 'Factored upward bearing at the stem face', sym: 'q_{u}(0)', eq: 'q_{u,back}', sub: '', value: r.q0h, unit: 'psf', d: 1, note: '' }),
@@ -9107 +9123 @@ function rwrModel(r) {
-      { title: 'Heel Step 4 — Shear and development', ref: isA ? AA('Art. 5.7.3') : 'ACI 318-19 Table 22.5.5.1(c)', steps: pre('h4', H4) }], { title: 'Heel' }), isA ? null : { type: 'note', text: 'q_u,back and q_u,heel: [[st7/quback]], [[st7/quheel]] (and the minimum-vertical case, [[st7/qubackmin]]).' },
+      { title: 'Heel Step 4 — Shear and development', ref: isA ? AA('Art. 5.7.3') : 'ACI 318-19 Table 22.5.5.1(c)', steps: pre('h4', H4) }], { title: 'Heel' }), { type: 'note', text: 'q_u,back and q_u,heel: ' + (isA ? '[[saf/quback]], [[saf/quheel]] (Strength Ia: [[saf/qubackIa]])' : '[[st7/quback]], [[st7/quheel]] (minimum-vertical case: [[st7/qubackmin]])') + '; ' + (r.heel_min_governs ? 'the minimum-vertical case governs the heel.' : 'the maximum-vertical case governs the heel.') },
@@ -9124 +9140 @@ function rwrModel(r) {
-      { title: 'Toe Step 4 — Shear and development', ref: isA ? AA('Art. 5.7.3') : 'ACI 318-19 Table 22.5.5.1(c)', steps: pre('t4', T4) }], { title: 'Toe' }), isA ? null : { type: 'note', text: 'q_u,front and q_u,toe: [[st7/qufront]], [[st7/qutoe]].' },
+      { title: 'Toe Step 4 — Shear and development', ref: isA ? AA('Art. 5.7.3') : 'ACI 318-19 Table 22.5.5.1(c)', steps: pre('t4', T4) }], { title: 'Toe' }), { type: 'note', text: 'q_u,front and q_u,toe: ' + (isA ? '[[saf/qufront]], [[saf/qutoe]] (Strength Ia: [[saf/qufrontIa]])' : '[[st7/qufront]], [[st7/qutoe]] (minimum-vertical case: [[st7/qufrontmin]])') + '; ' + (r.toe_min_governs ? 'the minimum-vertical case governs the toe.' : 'the maximum-vertical case governs the toe.') },
@@ -9188,0 +9205,2 @@ function renderRwReport() {
+  if (RWRP.imgsFor !== r) { RWRP.imgsFor = r; RWRP.imgs = null; const tok = r;   // charts: drawn off screen by the tabs' own plot jobs (async), then the report is mounted again
+    rwPlotImages().then(im => { if (RWRP.imgsFor !== tok || !Object.keys(im).length) return; RWRP.imgs = im; const T2 = document.getElementById('tab-report'); if (T2 && T2.classList.contains('active')) renderRwReport(); }).catch(() => {}); }
@@ -9190,0 +9209 @@ function renderRwReport() {
+  rwrAddPlots(M, RWRP.imgs || {});
@@ -9193,0 +9213,9 @@ function renderRwReport() {
+/* RWRP2: the result tabs' Plotly charts as figures, after the subsection they belong to (images from rwPlotImages, as the Export report) */
+function rwrAddPlots(M, im) {
+  const fig = (id, cap) => im[id] ? { type: 'figure', svg: '<img src="' + im[id] + '" alt="" style="max-width:100%;height:auto">', caption: cap } : null;
+  const put = (secRe, subRe, items) => { const s = M.sections.find(x => secRe.test(x.title)); const q = s && s.subs.find(x => subRe.test(x.title)); if (q) q.items.push(...items.filter(Boolean)); };
+  put(/^Stability/, /Step 6/, [fig('plt-bearing', 'Bearing pressure distribution, toe to heel (Stability tab chart)')]);
+  put(/^Stem design/, /^Base section/, [fig('plt-stem-press', 'Lateral pressure distribution on the stem (Stem design tab chart)'), fig('plt-stem-sm', 'Factored shear and moment diagrams V(z), M(z) of the stem (Stem design tab chart)')]);
+  put(/^Footing design/, /^Heel/, [fig('plt-ftg-loads', 'Factored loads on the footing (Footing design tab chart)'), fig('plt-heel-sm', 'Heel shear and moment diagrams (Footing design tab chart)')]);
+  put(/^Footing design/, /^Toe/, [fig('plt-toe-sm', 'Toe shear and moment diagrams (Footing design tab chart)')]);
+}
```

## 2026-11-01 — PR: claude/rpt-retwall-etot — calcAll returns the Strength I footing-design eccentricity; the report substitutes it with water uplift (RWETOT; exposure only, no result change) (PR #596: https://github.com/mlococo88/All-Structural/pull/596)

The tool file uses CRLF line endings; keep them. Every code site is tagged `RWETOT`.

### RWETOT. `aashtoR.x_R_tot`, `aashtoR.e_tot` returned by `calcAll`   [exposure only]
- **Engineer / coordinator decision (2026-11-01):** after RWRP2 the report could not substitute the Strength I footing-design trapezoid with water uplift, because the eccentricity of that resultant (`e_tot`) was internal to `calcAll`. Return it as an extra output field (pure exposure, no formula change) and use it in the report.
- **`calcAll`, AASHTO block, return object** (anchor `quA_toe, quA_heel, quA_front, quA_back, useManualQn, onRock,`):
  - Before: `      quA_toe, quA_heel, quA_front, quA_back, useManualQn, onRock,`
  - After: the same line, then `      x_R_tot, e_tot,   // RWETOT (2026-11-01): the Strength I footing-design resultant, returned for the report (exposure only)`
  - `x_R_tot = (Mr_str_max_tot − Mo_str_max) / V_str_max_tot` and `e_tot = B/2 − x_R_tot` are the existing local constants that already set `quA_toe` / `quA_heel` (unchanged).
- **Report (`rwrModel`, AASHTO subsection "Factored bearing for footing design")**: the Strength I trapezoid now uses `a.e_tot` and `a.x_R_tot` (before: `a.e_brg` without uplift, no substitution with uplift); the note about the missing eccentricity is removed.
- **Provision:** none. No formula, factor, unit, code reference or computed value changed; two existing values are added to the output.
- **Saved data:** none (`_R` is not saved).

### How verified
- main vs branch, 7 cases (as RWRP, including two with a water table): `_R` with the two new fields removed is identical; the status bar, the text of the Overview, Stability, Stem design, Footing design, Rebar schedule and Analysis diagram tabs and the storage keys are identical; 0 console errors. Without uplift `e_tot` equals `e_brg` (same V and M_r).
- Report checks, 7 cases: 0 unresolved / duplicate references, 0 KaTeX errors, no NaN / raw TeX, spot values equal `_R`.
- `node tests/check-syntax.mjs "Retaining Wall Designer.html"`: pass.

Diff (`Retaining Wall Designer.html`, `git diff -U0` against origin/main; CR line ends removed here):

```diff
diff --git a/Retaining Wall Designer.html b/Retaining Wall Designer.html
index e28171a..c713832 100644
--- a/Retaining Wall Designer.html	
+++ b/Retaining Wall Designer.html	
@@ -2390,0 +2391 @@ function calcAll(inp) {
+      x_R_tot, e_tot,   // RWETOT (2026-11-01): the Strength I footing-design resultant, returned for the report (exposure only)
@@ -8982,2 +8983,2 @@ function rwrModel(r) {
-      const eI = a.V_up > 0 ? null : a.e_brg;   // without uplift the footing-design resultant is the bearing-check resultant (same V and M_r, calcAll)
-      sI.push(...rwrTrap('', a.V_str_max_tot, eI, r.B / 2 - (eI == null ? 0 : eI), a.quA_toe, a.quA_heel, a.quA_front, a.quA_back, 'V_{u}'));
+      const eI = a.e_tot;   // RWETOT: the Strength I footing-design eccentricity returned by calcAll (with or without water uplift)
+      sI.push(...rwrTrap('', a.V_str_max_tot, eI, a.x_R_tot, a.quA_toe, a.quA_heel, a.quA_front, a.quA_back, 'V_{u}'));
@@ -8988 +8989 @@ function rwrModel(r) {
-        { type: 'note', text: 'Report only: the tab uses these values in the heel and toe cards without working them. The trapezoid across the full width B (not the Meyerhof width) is what the heel and toe design use; the envelope takes the case that governs each cantilever.' + (a.V_up > 0 ? ' With water uplift the tool does not return the eccentricity of the Strength I footing-design resultant, so the Strength I toe and heel pressures are shown without substitution.' : '') }])); }
+        { type: 'note', text: 'Report only: the tab uses these values in the heel and toe cards without working them. The trapezoid across the full width B (not the Meyerhof width) is what the heel and toe design use; the envelope takes the case that governs each cantilever.' + '' }])); }
```

## 2026-11-02 — PR: claude/phone-print-rwall — Phone: wide equations start at the left edge (their start was cut off) (PHN; display only, no calculation change)

Engineer-approved overnight job (2026-11-02): phone layout at 390 / 768 px and report print polish, one PR per tool. Code site tagged `PHN`.

### PHN-1. Equations wider than their box are left-aligned on a phone / tablet screen   [display only]
- **Problem:** `.eq-math` is a flex box with `justify-content: center` and `overflow-x: auto`. When an equation is wider than the box, which happens on a phone (Stability, Stem design and Footing design tabs), centring pushes its start off the left edge, where the scroll bar cannot reach. At 390 px, "K_a = tan²(45° − φ/2) = …" showed as "n²(45° − φ/2) = …".
- **Where:** after the `@media (max-width: 900px) { … }` block (anchor `.tab-panel [style*="grid-template-columns:1fr 330px"] { grid-template-columns: 1fr !important; }`).
- **Added:**
```css
@media screen and (max-width: 899px) { .eq-math { justify-content: flex-start; } }
```
- Screen only and below 900 px. Desktop and print are unchanged.
- **Check case:** 390 px, Stability tab, "Active coefficient — level backfill". Before: the equation starts at "n²(45° …". After: it starts at "K_a = tan²(45° …" and scrolls right to "= 0.3333".

### Checked, no change
- At 390 and 768 px the page does not scroll sideways on any of the 7 input panes or 8 output tabs. The existing 900 px layout stacks the panels, and the header and tab bar wrap or scroll.
- Report → Print report: 23 pages; the running header and page numbers are present. The Export report window prints 32 pages. Nothing is clipped. Two near-empty pages are section ends (Report p5, a 4-row table continuation; Export p21).
- `tests/smoke/phone-layout.mjs` gains the key `rwall`. It passes before and after; it guards against page-width regressions.

### How verified (no computed result, saved key or hand-off changed)
- origin/main vs this branch, headless Chromium, file://, at 1280 px: the page text on load and on all 15 tabs, the whole-document `textContent` (592,380 chars) and localStorage after load are identical.
- Screenshots at 900 and 1280 px: 0–22 differing pixels, in different places on each run (input-field and scroll-bar anti-aliasing). Report print text is identical.

## 2026-11-02 — PR: [#669](https://github.com/mlococo88/All-Structural/pull/669) — PLIB: saved-project list (Open / Rename / Duplicate / Delete) and Undo / Redo   [display and storage only]
- **Before:** Project tab → Saved projects: drop-down with Open / Save / Save as… / Delete (`retaincalcpro.projects.v1`, `{ name: { fields,
  ts } }`), Export / Import JSON, Back up all. No rename, no duplicate, no undo.
- **Where:**
  - after `<script src="shared/report.js"></script>`: `<script src="shared/projects.js"></script>` and `<script src="shared/projects-ui.js"></script>`.
  - `scheduleAutosave()`, anchor `function scheduleAutosave() {`: first statement `if (window.RWPL) RWPL.soon();   // PLIB: one undo step per change (debounced)`.
  - a new `<script>` after the boot script (after `waitPL`), anchor `/* PLIB (2026-11-02): saved-project list and Undo / Redo`: history over
    `JSON.stringify(snapshotFields())`, `set` = `restoreFields()` + `onInputChange()`; `mapStore(localStorage, PROJ_KEY, { time: ts })`;
    dialog `open` = `loadProject(n)`; "open now" = the `retaincalcpro.lastproject.v1` name; a rename of that project moves the pointer to the
    new name (same key, same plain-string format) and, when Project Name equals the old name, sets Project Name to the new one (Save uses
    Project Name as the list name); a delete clears the pointer as the Delete button does. Buttons Undo, Redo, Saved projects… in a new
    `header .hdr-group` before the Inputs / Code / Report group.
- **Saved data:** keys `retaincalcpro.projects.v1`, `retaincalcpro.autosave.v1`, `retaincalcpro.lastproject.v1` and their formats unchanged; no new key.
- **How verified:** `node tests/smoke/project-library.mjs --tool retwall`: ALL PASS (`window._R`, every computed result, identical to
  origin/main on load, after an input change, reopened on main's storage and opened from the dialog; Undo / Redo / Ctrl+Z / Ctrl+Y exact;
  dialog byte-identical; quota; 390 px; no new console errors). `node tests/check-syntax.mjs`: pass.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Entered demands (not added):** the tool already takes its external loads directly (column / beam reactions P_DL, P_LL, P_SL, P_WL,
  surcharge q_s, LS h_eq, barrier, CT collision, seismic k_h). The stem and footing demands are worked from soil pressure and those loads
  through stability; an entered M_u / V_u or an extra horizontal load would need new terms in the stability equations (a new formula),
  which the brief excludes. Raised for the engineer instead.

## 2026-11-02 — PR: claude/report-retire-rwall, PR #689: https://github.com/mlococo88/All-Structural/pull/689 (RWRX: the Export report (D11, a separate window) retired after porting what the Report tab lacked; "Export report", Ctrl+P and the browser's Print print the Report from every tab; display only, no result change)

### RWRX-1. Content of the Export report ported into the Report tab   [display] [no result change]
- **Engineer request (2026-11-02):** retire the old reports where the Report tab is complete. This uses the same method as lldf #623, Light Pole #625, Shear and Moment #672, elastomeric #676 and ACI Rebar #685: compare every number and section, port what is missing (the tool's own values and text, no recomputation), then remove the old report and print the Report from every tab.
- **Compared:** the Export report (`buildReportHTML(r)`, print media) on origin/main against the Report tab (`rwrModel()` + `rwrAddPlots`, Print report → `#rp-print`) on the branch. Three cases:
  - def: the default wall (ACI);
  - aci2: ACI with surcharge 250 psf, passive resistance on, k_h 0.15;
  - aash: AASHTO with LL surcharge and vehicular collision on.
  - A number counts as present when the Report shows the same value (the same digits, or more digits that round to it).
- **Missing before the port:** 39 / 42 / 43 numbers (def / aci2 / aash), not counting the old section numbers. They were:
  - the material quantities (footing, stem and total concrete, ft³/ft and cy/ft);
  - the development lengths in ft of the General detailing requirements;
  - the collision resultant x̄;
  - numbers inside the result tabs' note boxes (P_p, the M-O reference year, the 2013 edition, 45°, …);
  - every value the old report repeated in kip (3.645 kip/ft = 3645 lb/ft …).
- **Text missing before the port:**
  - the tabs' note boxes (`.alert`): "Passive resistance neglected / included", "Why the surcharge and column live/snow loads are left out" (overturning and sliding), "Stem demands use static earth pressure", the mid-height section notes, the heel design basis note, the M-O note, and the AASHTO notes (interface angle, e ≤ B/4, MassDOT §3.3.2.4 collision section, roadway datum, earth pressure dropped under collision);
  - the Bar notes, General detailing requirements and Approximate material quantities cards;
  - "No column or beam loads applied." and the closing Engineering note.
- **Ported:**
  - New `rwrTabNotes(r)` and `rwrAddNotes(M, N)`, before `rwrGoto`, anchor `RWRX (2026-11-02): what the retired Export report printed`. They read each result tab's HTML from `rwTabSource(tab, r)`, the same source the Export report used. For each tab:
    - every `.alert` becomes a note, prefixed with its card's title, warn style for `.warn` / `.fail`. Boxes equal to an `r.warnings` entry are skipped: those are already in "Assumptions and warnings";
    - in the Rebar schedule tab, the Bar Notes table, the General Detailing Requirements rows and the quantities table become report tables.
  - They are added as subsections at the end of the matching Report sections: "Notes on the Stability / Stem design / Footing design / Rebar schedule tab", "Bar notes", "General detailing requirements (ACI 318-19)" and "Approximate material quantities: concrete and steel (per linear foot of wall)".
  - `renderRwReport()` caches them per result (`RWRP.notesFor` / `RWRP.notes`), then `rwrAddNotes(M, RWRP.notes)` after `rwrAddPlots`.
  - Inputs: with no column loads, a subsection "Column / beam loads" with the note "No column or beam loads applied." (`if (!r.hasCol) subs.push(…)`).
  - Step 7b, step `e` (collision eccentricity): `note: 'x̄ = (M_r − M_o)/V = ' + rwrN(E.x_R_ct, 3) + ' ft from the toe'` (`E.x_R_ct`, the value the Stability tab shows).
  - Assumptions and warnings: the Export report's closing Engineering note (verbatim wording of the tool).
  - Wording only: the summary note "with D/C as in the Export report" → "with their D/C"; the crack-control note "(worked in the Export report §7 and here)" → "(worked here only)".
- **Not ported (already in the Report, or not a value):**
  - the kip repeats of lb values;
  - the print date;
  - the section numbers and contents;
  - the "Card check" legend (no card checks exist: 0 in all three cases);
  - the Footing tab's var-table line "d_b assumed bar diameter (#7) 0.875 in" (see open items);
  - in AASHTO with a manual q_R, the tab's "q_n nominal bearing resistance 9000 psf" line (see open items).
  - Figures: the Report already has the wall section, the bearing chart and the stem / heel / toe charts (RWRP2).
- **After the port:** in all three cases, every old-report number is in the Report except the kip repeats, the print date, the section numbers and the two lines above.

### RWRX-2. Export report removed; "Export report", Ctrl+P and the browser's Print print the Report from every tab   [display]
- **Removed:** `async function generateReport()` and `async function buildReportHTML(r)` (the whole report window: HTML, CSS, MathJax, table of contents, result lines), and `const RW_SEC` (used only there). A one-line RWRX comment is in their place. Kept: `rwTabSource`, `rwPlotImages`, `rwResultRows` (used by the Report).
- **Changed:**
  - The header button keeps its label "Export report". `onclick="generateReport()"` → `onclick="rwrPrintAny()"`, with the tooltip "Print / PDF the calculation report (the Report tab), from any tab".
  - New `rwrPrintPrep()`: from another tab it remembers the active tab (`RWRP_BACK`) and clicks the Report tab button. It runs only with results and with the shared files loaded.
  - New `async rwrPrintAny()`: `rwrPrintPrep()`, waits for the chart images (`RWRP.imgsP`, the `rwPlotImages()` promise now kept by `renderRwReport`), then `RWRP.api.print()`. With no report, it calls `window.print()`.
  - New inline `<script>` before `<script src="shared/steps.js">`: `window.addEventListener('beforeprint', … rwrPrintPrep() …)`. It is registered before shared/report.js's own listener, so for Ctrl+P / the browser's Print the Report is already shown when that listener sets the running header and fills lazy items. The existing Report `beforeprint` handler then fills `#rp-print`. On this path the charts print only if their images are ready (they are once the Report has been shown for the current result).
  - New `afterprint` handler: it clicks the remembered tab's button.
  - The output tab is not saved, so nothing saved changes.
- **Governing provision:** none changed. No formula, factor, unit, code reference or computed value changed (CLAUDE.md §4).
- **How verified:**
  - `node tests/check-syntax.mjs "Retaining Wall Designer.html"`: pass.
  - Results and storage, origin/main vs branch, the three cases:
    - `window._R` (all results, JSON) identical;
    - the text of the six result tabs identical;
    - localStorage identical (`retaincalcpro.autosave.v1`, apart from its time stamp);
    - page text identical;
    - console errors identical (blocked CDN in the test kit).
  - Print routing, headless, from every tab: by `beforeprint` and by the "Export report" button. `#rp-print` holds the Report, `body.rp-printing` and the running header `#rp-page` are set, and the tab of before comes back after `afterprint`.
- **Other copies:** none.
- **Open items (display only, raised, not changed):**
  - Footing tab, Heel Step 3 card (`renderFooting`, anchor `{sym:'d_b', desc:'assumed bar diameter (#7)', val:'0.875', unit:'in'}`; also `{sym:'c_c', desc:'top clear cover', val:'2.00'…}`): the var table shows a fixed #7 / 0.875 in and a 2.00 in cover. The equation beside it uses the selected bar (`r.sel_heel.bar.db`) and the input cover (`inp.cov_ftg`). The same fixed d_b line is in the toe card and a #6 one at about line 4697. The Report uses the actual values.
  - AASHTO Stability tab, Step 6 with q_R from the geotechnical report (`qn_mode = 'manual'`): the var table still lists "q_n nominal bearing resistance = 3 q_a" (9000 psf), which that mode does not use.

## 2026-11-02 — PR: claude/rwall-footing-db-label, PR #699: https://github.com/mlococo88/All-Structural/pull/699 (RWDB: the effective-depth tables show the selected bar's d_b and the input cover; q_n is not listed when q_R is entered; display only, no result change)
- **Engineer request (2026-11-02):** fix the two display issues raised in RWRX (#689): show the selected bar's d_b and the input cover, and hide q_n = 3 q_a when q_R is entered. No result change.
- **Problem:** the "where" tables beside three effective-depth equations listed fixed values, while the equation beside each used the real ones:
  - Stem Step 2: "assumed bar diameter (#6) 0.750";
  - Heel Step 3: "top clear cover 2.00" and "assumed bar diameter (#7) 0.875";
  - Toe Step 3: "assumed bar diameter (#7) 0.875".
  - The heel card subtitle also read "d = t_f − 2.0'' cover − d_b/2".
  - The equations use `r.sel_stem/heel/toe.bar.db` and `inp.cov_stem` / `inp.cov_ftg`.
  - In AASHTO mode with q_R from the geotechnical report (`qn_mode = 'manual'`), Step 6 listed "q_n nominal bearing resistance = 3 q_a", which that mode does not use.
- **Where / before → after (`renderStem`, `renderFooting`, `renderStability`; anchors in the code are tagged `RWDB`):**
  - Stem Step 2: `{sym:'d_b', desc:'assumed bar diameter (#6)', val:'0.750', …}` → `{sym:'d_b', desc:` + "`diameter of the selected bar (#${r.sel_stem.bar.num})`" + `, val:F(r.sel_stem.bar.db,3), …}`.
  - Heel Step 3:
    - card-ref `d = t_f − 2.0'' cover − d_b/2` → `d = t_f − cover − d_b/2 · cover = ${F(inp.cov_ftg,2)} in`;
    - `{sym:'c_c', desc:'top clear cover', val:'2.00'}` → `{sym:'c_c', desc:'clear cover (footing cover input)', val:F(inp.cov_ftg,2)}`;
    - d_b row as in the stem, with `r.sel_heel`.
  - Toe Step 3: d_b row as in the stem, with `r.sel_toe`.
  - AASHTO Step 6: the q_n row is `...(a.useManualQn ? [] : [{sym:'q_n', desc:'nominal bearing resistance (≈ 3 q_a)', …}])`.
- **Check case (default wall, ACI):**
  - Heel: d = 18.0 − 3.00 − 0.250 = 14.750 in (equation unchanged). The table now reads c_c = 3.00 in and d_b (#4) = 0.500 in; before it read 2.00 and 0.875.
  - Stem: d_b (#4) = 0.500 in; before it read 0.750.
- **Governing provision:** none. No formula or computed value changed.
- **How verified:**
  - `node tests/check-syntax.mjs`: pass.
  - origin/main vs branch, three cases (ACI default; AASHTO with the default q_R placeholder; AASHTO with manual q_R and footing cover 2.5 in): `window._R` and localStorage identical.
  - Tab text differs only in the lines above. The stem, heel and toe d_b rows now equal the bars in the equations: #4 / #5 / #3 etc.
- **Other copies:** none. The Report tab already used the actual values.

## 2026-11-05 — PR: claude/github-sync-rollout (PR #811: https://github.com/mlococo88/All-Structural/pull/811) (GHS: saved projects copied to a private GitHub repository; storage only, no result change)
- **Engineer:** the same saved projects on every device (`docs/github-sync-setup.md`; shared code `shared/github-sync.js`, fix log `shared-github-sync.md`; pilot Spread Footing, PR #808).
- **Where:** after `<script src="shared/projects-ui.js"></script>`, new `<script src="shared/github-sync.js"></script>`; in the PLIB block, `SharedProjectsUI.libraryDialog({` gets a first property `cloud:{tool:'retaining-wall-designer', …}` (anchor `GHS (2026-11-05): GitHub sync of this list`).
- **File on GitHub:** `projects/retaining-wall-designer/<name>.json`: `toFile` = `{format:'RetainCalcPro.project', version:1, name, fields:item.fields}` (the single-project export without `exported`), indent 2. **Download (fromFile):** format `RetainCalcPro.project` with `fields`; stored as `{fields, ts: Date.now()}` (the tool's item); Open then goes through the dialog's existing `open`.
- **Saved data:** `retaincalcpro.projects.v1` and the autosave unchanged (key and format). With sync off nothing is written and no request is made.
- **How verified:** `node tests/smoke/project-library.mjs` for this tool (origin/main vs branch, sync off): ALL PASS. `node tests/smoke/github-sync-tools.mjs`: Save → file on GitHub; update with sha; a GitHub-only copy opened gives the same results as the saved project; 0 console errors.
- **Formulas, factors, units, code references:** none.

## 2026-11-06 — PR: claude/standard-save-retaining-wall (PR #846: https://github.com/mlococo88/All-Structural/pull/846) (STDS) — the standard save: header chip + Save + Saved projects…, "Save and open" card first in the Project tab, Save as, Ctrl+S   [display / save controls only; no result change]
- **Why:** engineer decision 2026-11-05 (standard save roll-out after the Spread Footing pilot #837). Uses `SharedProjectsUI.projectBar` (shared/projects-ui.js).
- **Header:** before: All tools · Undo · Redo · Saved projects… | Code ACI / AASHTO · Export report. After: All tools · chip `Project: <open saved project> ● saved / unsaved changes / not saved` (+ GitHub badge with sync on) · Undo · Redo · **Save (Ctrl+S)** · Saved projects… | Code · Export report (the tool's print button). Display-only CSS added in the PLIB block so the header fits: the tool name keeps at least 150 px (its subtitle is cut first); below 1500 px the Ctrl+S hint is only in Save's tooltip and the chip name is cut at 14 characters; below 1300 px the word "Project:" is hidden; from 901 to 1250 px only the chip's dot and status show (the name is in its tooltip and the card); from 901 to 1150 px the header may take two rows (as it already did at 900 px and below).
- **Project tab:** the "Saved projects" section (`#sec-projmgr`, first in the tab) → **"Save and open"** (same id and collapse button): status line; Save · Save as… · Saved projects… · New; "File on this computer": Export JSON · Import JSON · Back up all (`#proj_export_btn` / `#proj_import_btn` / `#proj_exportall_btn`, same handlers; Back up all was a link under the card); the two hint lines; `#proj_msg` kept. Removed: Open, Save, Save as… (`prompt()`), Delete, the autosave dot line. The drop-down `#proj_list` is **kept, hidden**, because `snapshotFields()` stores its value in every saved project, the autosave and Export JSON (format unchanged, §5); it is left out of the "unsaved changes" comparison. The `proj_save_btn` / `proj_saveas_btn` / `proj_load_btn` / `proj_delete_btn` wiring stays (optional chaining; no button calls it).
- **Import JSON (anchor `byId('proj_import_btn')`):** before `() => byId('proj_import_file')?.click()` after `() => { if (window.RWPL && RWPL.pb) RWPL.pb.importJSON(); else byId('proj_import_file')?.click(); }` (asks first on unsaved changes). **importProjectJSON, single project (anchor `if (pn) pn.value = nm;`):** added `if (window.RWPL && RWPL.pb) RWPL.pb.setCurrent(null);` so an imported file is not taken for the open saved project (Save then asks for a name instead of overwriting the last project).
- **Code (PLIB block, anchor `/* STDS (2026-11-06): the standard save`):** `projectBar({ store: mapStore(localStorage,'retaincalcpro.projects.v1'), snapshot / snapOf: canon(fields without proj_list), current / setCurrent: the last-project key retaincalcpro.lastproject.v1 (as before; removed on New, on a single-project Import and when that project is deleted), save(n): saveProject(n, { overwrite: true }) (the old write: { fields, ts }, last-project key, list), open: loadProject (as before), newProject: the autosave removed and the page reloaded (the HTML default inputs), exportFile (Save as → File: the Export JSON text under that name), importFile: #proj_import_file, renamed: Project Name follows a rename of the open project (as before), cloud: <unchanged GHS ctx.cloud> })`. `window.RWPL = { h, store, dlg, soon, pb }`.
- **Behaviour changes (asked for):** no `prompt()` / "Overwrite it?" on save; plain Save with no open name opens Save as (was: saved under the Project Name field); Save to the open name never asks; a new duplicate name at Save as is blocked ("Replace it"); Delete only in Saved projects… (asks about the GitHub copy); Open / New / Import ask first on unsaved changes; Ctrl+S / Ctrl+Shift+S.
- **Decision (pending engineer review):** Save as no longer writes the chosen name into the Project Name input (the old Save as did): the title block is left as typed, so a save never changes a printed field. New is new for this tool: the page's default inputs (the autosave cleared and the page reloaded). "Back up all" is kept as a third file button.
- **Saved data (§5):** `retaincalcpro.projects.v1` ({ name: { fields, ts } }), `retaincalcpro.autosave.v1`, `retaincalcpro.lastproject.v1` unchanged (same meaning); Export JSON / library / GitHub file formats unchanged; no new key.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **How verified:** main vs branch after the same input change: `_R` identical (0 differences), localStorage keys identical (`retaincalcpro.autosave.v1` identical apart from `ts`), Export JSON text identical apart from its time stamp (2,922 chars), Report tab text identical (47,877 chars), no console errors. Probe: save → saved; change → unsaved; Ctrl+S saves with no dialog; every input tab, output tab and section toggle leaves "saved"; Open, reload: saved; New → the defaults, not saved. `project-library --tool retwall` ALL PASS; `github-sync-tools --tool retwall`, `standard-save` (8 / 8), `github-sync` (13 / 13), `home-projects`, `home-sync`: pass; `phone-layout --tool rwall` pass; engine `project-registry`, `github-sync`, `projects` pass; `check-syntax` pass. 390 px: page 390 / 390, dialog 355 / 355; header at 1000–1400 px looked at.
## 2026-11-06 — PR: claude/hdrs-retwall (PR #899: https://github.com/mlococo88/All-Structural/pull/899) (HDRS) — header: Save and Saved projects… removed (in the "Save and open" card only); the chip opens the Project tab   [display only; no result change]
- **Why:** engineer 2026-11-06: every app's header as in Spread Footing (#884): no Save (Ctrl+S) and Saved projects… buttons in the header; they stay in the "Save and open" card. The header keeps the project chip (click = the Project tab), Undo, Redo, the app's other global actions and Print. Ctrl+S and Ctrl+Shift+S work from anywhere. No "Recent projects" start strip (Spread Footing only).
- **Where:** the `SharedProjectsUI.projectBar({...})` call, right after the line `header: g, chipBefore: bu, card: $i('sec-projmgr'),` (a comment `/* HDRS (2026-11-06, …) */` and one line).
  Before: nothing. After:
  `headerSave: false, chipClick: () => { const t = $i('itab-project'); if (t) t.click(); const h = document.querySelector('.sec-hd[data-target="sec-projmgr"]'); if (h && h.getAttribute('aria-expanded') === 'false') h.click(); const c = $i('sec-projmgr'); if (c) c.scrollIntoView({ block: 'nearest' }); }, chipHint: 'the Project tab (Save and open)',`
  Uses the projectBar options of `shared/projects-ui.js` (HDRS, #884; `fixlog/shared-projects.md`): `headerSave:false` (the chip only in the header), `chipClick`, `chipHint` (the chip tooltip's "Click: …").
- **Header before:** chip · Undo · Redo · Save · Saved projects…; chip click = Saved projects… dialog. **After:** chip · Undo · Redo; chip click = the Project input tab (its tab button `#itab-project` clicked; the "Save and open" section `#sec-projmgr` opened if collapsed; the card brought into view). The card's buttons are unchanged.
- **Problem:** none (layout request). **Governing provision:** none (§4 does not apply).
- **Check case:** default project, another tab open: click the chip → the Project tab, the "Save and open" card on screen, no dialog; Ctrl+S on another tab (nothing saved yet) → Save as dialog; Ctrl+Shift+S → Save as dialog.
- **How verified:** main vs branch on the default project: every localStorage key (1), page text (37660 chars), Export JSON (2900 chars identical) and the printed report text (print media, 35819 chars) identical (clock times normalised); 0 console errors; chip click → card on screen, no dialog; Ctrl+S / Ctrl+Shift+S → Save as; header at 1280 / 1400 / 1920 / 390 px (390: no sideways scroll), screenshots looked at. `node tests/check-syntax.mjs "Retaining Wall Designer.html"`; `node tests/smoke/project-library.mjs --tool retwall`; `node tests/smoke/github-sync-tools.mjs --tool retwall`; `node tests/smoke/home-projects.mjs --tool retwall`; `node tests/smoke/phone-layout.mjs --tool rwall`: pass.
- **Saved data:** no key or format changed (§5).
- **Other copies:** none. **Open items:** none.

## 2026-11-06 — PR: claude/rw-drawings (PR #922: https://github.com/mlococo88/All-Structural/pull/922) (RWDW) — Drawings output tab: four 11 × 17 sheets (typical section; reinforcement and bar schedule; loads and bearing pressure; elevation and general notes), sheet viewer, Print sheet / Print all sheets, Download DXF   [display / export only; no result change]
- **Why:** engineer-approved 2026-11-06 (review `rwreview` Phase 2): a Drawings tab matching Spread Footing (SFDW #749/#767), Light Pole (#750), Concrete Beam Capacity (#806) and Base Plate & Anchor Designer (BPDW #917).
- **Where (all new code, anchors):**
  - head: `<script src="shared/dxf.js"></script>   <!-- RWDW (2026-11-06) …` after `shared/report.js` (classic script, relative path; works from `file://`);
  - CSS: block `/* RWDW (2026-11-06): the Drawings tab */` (`.rwdwBar`, `.rwdwBox`, `.rwdwIdx` …); `@media print`: `#tab-drawings { display: none !important; }` (the sheets print only through their buttons; Ctrl+P prints the Report as before);
  - result tabs: `<button class="tab-btn" data-tab="drawings">Drawings</button>` after "3D model", panel `<div class="tab-panel" id="tab-drawings">`;
  - `onInputChange()`: one line after the RWRP line, `if (typeof rwdwRender === 'function' && document.getElementById('tab-drawings')?.classList.contains('active')) rwdwRender(r);` (the tab redraws only while shown; it is built when its tab is clicked);
  - `rwrPrintPrep()` and the RWRP `beforeprint` listener: `|| document.body.classList.contains('sdx-printing')` added to their early-return conditions, so Print sheet / Print all sheets (SharedDxf.printSheets) do not switch to the Report tab or build the Report print box while the sheets print. Ctrl+P / Export report: unchanged;
  - the script block `/* DRAWINGS tab (RWDW, 2026-11-06 …` before the UI-shell script: `RWDW_SC`, `RWDW`, `rwdwGeo(r)` (model geometry in inches), `rwdwBars(r, G)` (bars as modelled + labelled nominal lengths), `RWDW_SUPPORT` / `rwdwSupport(r)` (footing support layer), `rwdwBearing(c)`, `rwdwBuild(r)` (the four sheets), `rwdwRender(r)` (tab UI).
- **Sheets** (one DXF R12, model space full size in inches, x from the toe, y up from the footing base; each sheet 17 × 11 in at the largest standard architectural scale that fits (3" = 1'-0" … 1/16" = 1'-0"), border 0.25 in inside the paper edge (`SharedDxf.sheetBorder`), title block of the other apps without an owner cell, a graphic scale bar and the scale under each view and in the title block):
  1. TYPICAL WALL SECTION: footing, stem (front face vertical, back face battered from t_s,top to t_s,base, as modelled), shear key, barrier, construction joint, backfill grade (level or at β from the back edge of the stem top), toe grade (soil cover), subgrade, water table (▽ and depth / elevation), surcharge (q_s, LS h_eq), dimensions (toe, stem, heel, B; t_f, H_s, H; stem top; soil cover, D_f; key depth), bar marks and covers. Coulomb back-face batter ω (AASHTO) noted as used in K_a only.
  2. REINFORCEMENT DETAILS AND BAR SCHEDULE: S1 (back face, parallel to the battered face, to the top cover; cutoff of the alternate bars at z_cut as computed), S1D dowel (hooked on the bottom mat, 12 d_b tail; lap 1.3 ℓ_d above the joint **as the tool's section drawing draws it; not checked**), S3 (upper half), S2 dots both faces at s, F1 top / F2 bottom with ℓ_d past the stem faces, F3 dots both mats at s; key: "no reinforcement designed in the tool"; front-face verticals: "not in the model". Bar schedule per foot: mark, size, spacing, location, shape, length, A_s,prov, ℓ_d / ℓ_dh (from the results); AASHTO interface-shear dowels D1 when the tool requires them.
  3. LOADS AND BEARING PRESSURE DIAGRAM: pressures on the vertical plane through the heel (height H′): soil (break at the water table, ordinates K_a·γ·h_above and + K_a·γ′·h_below from the model's K_a, γ, γ′, h_above, h_below), q_s / ES and LS bands (K_a·q), water (γ_w·h_w = p_hyd_base); resultants with their heights (ACI P_a,H at y_Pa, P_sur at H′/2, F_hyd at h_w/3, ΔP_E at 0.6H; AASHTO P_EH at y_EH, P_ES, P_LS at H′/2, P_WA at h_w/3); passive at the toe (+ key), "included / neglected"; resultant R at x_R; loads table (ACI: service forces, arms, moments, ΣV, ΣM_R, ΣM_O, FOS, x_R, e, q; AASHTO: unfactored loads with their max / min load factors, sliding, eccentricity, bearing and footing-design results). Support layer (soil): ACI service trapezoid q_toe / q_heel vs q_a and the factored (1.2D + 1.6H) trapezoid for the footing design; AASHTO: the governing Strength I / Ia bearing, uniform over B′ centred on the resultant (soil; rock: values only) vs q_R, and the Strength I footing-design trapezoid.
  4. WALL ELEVATION AND GENERAL NOTES: the wall from the front (stem above the toe grade, footing and key hidden); variable height (AASHTO "varies in height"): low / high ends and the design height at 0.75 L from the low end (MassDOT 3.3.2.2, as the tool); length: the collision joint spacing L_joint when collision is on (dimensioned, EXP. JT. at both ends), otherwise a nominal segment labelled "wall length not in the model". General notes (paraphrased): code basis by mode, earth pressure method and K_a / K_p, materials, covers, bearing (from the support layer), backfill, water, sliding, seismic, scope (global stability, settlement, drainage, joints, key and front-face steel, S1 lap, bar development not in the tool), check count.
- **Nominal rules (not in the model; labelled "detailer to confirm"):** S1D length = embedment to the bottom mat (t_f − cover − d_b,F2 − d_b,F3 − d_b/2) + 1.3 ℓ_d + 12 d_b; S1 from the joint to one stem cover below the top, cut-off bars to the cutoff elevation; S3 from mid-height to the top (its splice with S1 is not in the model); F1 = L_h − cover + ℓ_d,heel past the back face, F2 = L_t − cover + ℓ_d,toe past the front face, both capped at the footing; lengths rounded up to 1 in; bend allowances not added; S2, F3 continuous (laps by the detailer); key width drawn as the tool's own section drawings (0.36 t_s,base, 0.32 t_s,base from the front face); front-face cover drawn = back-face cover; barrier width = 0.85 t_s,top unless entered (geometry mode). The S1D mark is added on the drawings (the dowel of S1).
- **Title block:** PROJECT = Project Name, PROJECT NO. = Project Number, CALCULATED BY = Engineer of Record (as the Report), CHECKED BY = Checked By; the Project tab has no Date / Checked date fields, so DATE and CHECKED DATE are blank ("—"). DESIGN BASIS = the mode; SHEET n OF 4.
- **Pile phase (planned):** the footing support is one layer, `RWDW_SUPPORT[kind]` chosen by `rwdwSupport(r)` (`soil` today), with hooks `section(c)` (under the footing in the section), `elev(c)`, `loads(c)` (the bearing diagrams; returns the lowest y used), `notes(r)` (foundation notes) and `schedule(r)` (extra bar-schedule rows). A pile-supported footing adds `RWDW_SUPPORT.piles` (pile rows in the section / elevation, the pile-reaction diagram, pile notes and schedule rows) and makes `rwdwSupport` return it from the model's foundation type; the wall, bars and notes code need not change.
- **Layers:** RW-CONC, RW-JOINT, RW-HIDDEN, RW-REBAR, RW-REBAR-TEXT, RW-LEADER, RW-DIMS, RW-TEXT, RW-SOIL, RW-GRADE, RW-WATER, RW-SURCHARGE, RW-LOAD, RW-LOAD-TEXT, RW-TABLE, RW-TBLK, RW-BRDR (colours as the Spread Footing sheets: concrete 7, rebar 5, dims 3, soil 30, loads 1, water 4). Text in the sheets is ASCII (φ → PHI, β → BETA, γ → GAMMA, ℓ → L) so the DXF and the preview read the same.
- **Index:** sheet, scale and "Worked in" links (§6) to the cards that work each value (`rwLink`: Stability Step 1 K_a / overturning / sliding / eccentricity / bearing / factored bearing; Stem design flexure, development, mid-height, T&S; Footing design heel / toe flexure, T&S).
- **Saved data (§5):** no existing key or format changed. New per-browser key `retaincalcpro.dwgSheet.v1` (the sheet last picked; written only when a sheet is picked; not in the project, the autosave or Export JSON).
- **Formulas, factors, units, code references:** none changed (§4 does not apply). Every drawn value is read from `window._R`; the only arithmetic is drawing geometry, the pressure ordinates listed in sheet 3 and arms shown as M / P where the model does not return the arm (W_sur).
- **How verified:**
  - origin/main vs branch, six cases (ACI default; tall wall H_s 28 ft; sloped backfill β 18° + q_s 250; key + water table 6 ft + soil cover 2 ft + passive + k_h 0.15; AASHTO variable height + barrier + collision + key + interface shear; input error f′c blank): `window._R`, every localStorage key on load and after the edit (only `retaincalcpro.autosave.v1`, identical), Export JSON (time stamp normalised), `rwrModel(r)`, the Report tab text and the six result tabs' text **identical**; 0 console errors.
  - `tests/smoke/dxf-print-sheets.mjs` (new `rw` entry: Print sheet 1 page 17 × 11, border 0.25 in, the graphic scale bar measured to scale on the PDF, Print all 4 pages, then Ctrl+P prints the Report on letter pages): all tools all ok.
  - `project-library --tool retwall` ALL PASS; `standard-save` 8/8; `phone-layout --tool rwall` 390 / 768 px (17 views, no sideways scroll); `github-sync-tools --tool retwall` ALL PASS; `check-syntax` all files pass; DXF `SharedDxf.validate` ok for every case.
  - Every sheet looked at for the five projects (deviceScaleFactor 2): no overlaps; scales chosen 3/8" (default section) … 1/16" (tall wall elevation).
- **Other copies:** none. **Open items (engineer):** S3 vs S1 in the upper half (both back-face verticals; drawn and scheduled as the model gives them); the S1 dowel lap and F1 / F2 development are drawn, not checked (calculation audit, Phase 7); Date / Checked date fields (Phase 1c).

## 2026-11-06 — PR: claude/rw-suite-theme (PR #924: https://github.com/mlococo88/All-Structural/pull/924) (RWTH) — suite look: navy masthead, suite fonts, box tabs, card heads; visible title "Retaining Wall Designer"   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (review `rwreview`, Phase 1 item 1): RW matches Light Pole and Sign Post (LPTH #662) and Concrete Beam Capacity (CBTH #783/#785/#787).
- **Where:**
  - head: `<title>RetainCalc Pro — Cantilever Retaining Wall Design</title>` → `<title>Retaining Wall Designer — Cantilever Retaining Wall Design</title>`;
  - head: the three Google Fonts tags (`fonts.googleapis.com` preconnect, `fonts.gstatic.com` preconnect, the `css2?family=IBM+Plex+Mono…&family=Public+Sans…` stylesheet) replaced by the comment `<!-- RWTH (2026-11-06): the Google Fonts link (Public Sans, IBM Plex Mono) removed; … -->`. Light Pole, Concrete Beam Capacity, Base Plate and apps/steel-bridge load no web font; they use the system UI font stack for controls and Times for calculation values, and so does RW now. The font names left in RW's inline SVG / Plotly text (`'Public Sans',Arial`, `'IBM Plex Mono',Consolas`) fall back to Arial / Consolas, as they already did offline;
  - CSS: one new block at the end of the stylesheet, after `@media print { .bx-all-tools { display: none !important; } }`: `/* RWTH (2026-11-06, engineer-approved; … */` — token overrides on `:root` (navy / slate palette, `--sans` / `--cond` = the UI font, `--mono` = Times, `--blue` = steel #1c4e80, pass / fail / warn as LP), then overrides of `header` (navy `#1E3A5F`, 3 px `#16304F` rule, white title 15 pt, byline `#C7D4E4`, translucent buttons as LP `.pbtn`, white chip, the code switch white-on-navy), `.itabs` / `.itab` and `.tab-bar` / `.tab-btn` (box tabs with the blue top stripe, wrapping instead of scrolling sideways), `.sec-hd` + `.sec-body` / `.proj-box` (each input section drawn as a card with an upper-case slate head), `.card-hd` / `.card-title`, `.eq-title`, `.sec-heading`, `.tbl`, `.badge`, `.alert`, the status strip chips, and the Overview card (`.sc-*`, kept; restyled only). The rules above the block are unchanged (no rule removed);
  - header HTML: the "RetainCalc Pro" logo tile (`<svg class="brand-mark" …>`) removed; `<span class="logo-name">RetainCalc Pro</span>` → `Retaining Wall Designer`; the subtitle `Cantilever retaining wall design, <span … id="logo-pill">` → `by Mario Lococo · cantilever retaining wall · <span … id="logo-pill">` (the code text in `#logo-pill` is still set by `onBasisChange`);
  - Report (`rwrModel`): the closing note `'Engineering note: generated by RetainCalc Pro as a calculation aid …'` → `'… generated by Retaining Wall Designer as a calculation aid …'`; the printed page footer `' (RetainCalc Pro — Retaining Wall Designer)'` → `' (Retaining Wall Designer)'`.
- **Not changed (§5):** the file name; every `retaincalcpro.*` key; the Export JSON / library / GitHub-file formats `RetainCalcPro.project` / `RetainCalcPro.library` and their error message; the default download names `RetainCalcPro_…json` (they are file names a user may already have; renaming them is not asked); `rcp_input_tab`.
- **Decision (pending engineer review):** the byline "by Mario Lococo" added, as in every suite app's masthead (LP, CBC, Gusset, Steel Bridge Design). Values in result tables and the D/C numbers are set in Times (LP / CBC set their calculation values in Times); input boxes keep RW's own label-above layout (the layout is kept, CLAUDE.md §6), only their font and colours follow the suite.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **How verified:** origin/main vs branch, five cases (ACI default; project fields filled; AASHTO variable height + barrier + collision + interface shear; tall wall φ 34° + key + water + passive + soil cover + k_h 0.15; input error f′c blank), headless at 1400 px: `window._R`, Export JSON (time stamp normalised), every localStorage key on load and after the edit (only `retaincalcpro.autosave.v1`, identical), the four Drawings sheets' DXF and the text of the Overview / Stability / Stem / Footing / Rebar tabs **identical**; the Report text identical except the closing note's tool name; 0 console errors. One display-only difference: in the AASHTO case the Stem tab's Plotly chart picks other axis ticks (0 10 20 30 → 0 5 10 … 30) because the output panel is 24 px wider (padding 28 → 16 px). Screenshots before / after at 1400 and 390 px (deviceScaleFactor 2) looked at. Tests: see the PR.
- **Other copies:** none.

## 2026-11-06 — PR: claude/rw-header-print (PR #925: https://github.com/mlococo88/All-Structural/pull/925) (RWHP) — header: chip · Undo · Redo · Print; the ACI / AASHTO Code switch in the first input card   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (review `rwreview`, Phase 1 item 2): the header as every app after #884 / #899, and the code switch in the input panel as Light Pole (its first card, `#modeCard`).
- **Where (header HTML, `<div class="hdr-group">`):**
  - before: `<button … id="inputs-toggle">…</button>` · `<span class="hdr-lbl" id="basis-lbl">Code</span>` · `<div class="seg" … id="basis-seg">` (ACI 318-19 / AASHTO LRFD) · `<button type="button" class="btn btn-primary" onclick="rwrPrintAny()" …><svg …/><span>Export report</span></button>`;
  - after: `<button type="button" class="btn" id="rw-print" onclick="rwrPrintAny()" title="Print / PDF the calculation report (the Report tab), from any tab (Ctrl+P)">Print</button>` · `<button … id="inputs-toggle">` (unchanged; phone and tablet only). The chip, Undo and Redo are still inserted before this group by the PLIB / STDS script, so the order is chip · Undo · Redo · Print (· Show inputs below 900 px). Print runs the same function as Export report did (`rwrPrintAny`: the Report tab printed from any tab); Ctrl+P is unchanged.
  - the Code switch: the same `#basis-lbl` / `#basis-seg` markup (same ids and buttons, same handler in the UI shell: it sets `#design_basis` and fires its change) moved to a new card `<div class="rw-code-card" id="rw-code-card">` at the top of the input panel (`<div class="side" id="side">`), above the input finder and the input tabs, so it shows whatever input tab is open; not printed.
  - CSS: block `/* RWHP (2026-11-06): the Code switch in the first input card … */` after the RWTH block (`.rw-code-card`, its `.seg` as LP's `.mode-seg`: navy when on).
- **Unchanged:** Save and Saved projects… are only in the Project tab's "Save and open" card (as #899); the Project tab's "Design basis" select (`#design_basis`, the saved field) is unchanged; no key or saved format changed.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **How verified:** origin/main (after #924) vs branch, five cases (ACI default; project fields; AASHTO variable height + barrier + collision + interface shear; tall wall + key + water + passive + k_h; f′c blank): `window._R`, Export JSON, every localStorage key, Report text, the result tabs' text and the four sheets' DXF all identical; 0 console errors. A click on AASHTO in the card sets `#design_basis`; Print prints the Report once. Tests: check-syntax, phone-layout rwall 390 / 768, project-library retwall, standard-save, github-sync-tools retwall, home-projects retwall, dxf-print-sheets rw: all pass. Screenshots 1400 / 390 px looked at.
- **Other copies:** none.

## 2026-11-06 — PR: claude/rw-check-summary (PR #926: https://github.com/mlococo88/All-Structural/pull/926) (RWDC) — check summary panel replaces the sideways-scrolling check-chip strip   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (review `rwreview`, Phase 1 item 3): RW's strip of check chips scrolled sideways and was cut off at 1400 px ("Stem Hoo…") with no D/C. Replaced by the check summary panel of Spread Footing (SFDC #737 / SFDF #740), Light Pole (LPDC #747) and Concrete Beam Capacity (#788).
- **Where:**
  - HTML: `<div class="app" id="app">` gains a first child `<aside id="rwDashCol" aria-label="Check summary"></aside>` (the left column at 1500 px and wider); `<div class="status-bar" id="status-bar">` now holds `<div id="rwDashBox">` (head: `#rwDashTgl` Hide / Show checks, `#rwDashTtl` "Check summary", `#rwDashCnt` counts; list `#rwDash`) instead of the "Calculating…" status item;
  - CSS: block `/* RWDC (2026-11-06): check summary panel … */` after the RWHP block (`.rwdCh` rows, `.rwdMsg`, the ≥ 1500 px column, collapsed strip); not printed;
  - JS: `renderStatus(r)` (anchor `function renderStatus(r) {`) — before:
```js
function renderStatus(r) {
  const sb = document.getElementById('status-bar');
  if (window.syncHeaderControls) syncHeaderControls();
  if (window.refreshInputTabs) refreshInputTabs();
  if (r.fatal) {
    sb.innerHTML = `<div class="verdict fail"><span class="vd-ico" aria-hidden="true">!</span>Inputs need attention</div>
      <div class="chips">${r.errors.map(e => `<span class="chip fail"><b aria-hidden="true">✕</b>${e}</span>`).join('')}</div>`;
    return;
  }
  const cs = Object.values(r.checks);
  const nFail = cs.filter(c => !c.ok).length;
  sb.innerHTML = `
    <div class="verdict ${nFail ? 'fail' : 'pass'}">
      <span class="vd-ico" aria-hidden="true">${nFail ? '✕' : '✓'}</span>
      ${nFail ? `${nFail} of ${cs.length} checks fail` : `All ${cs.length} checks pass`}
    </div>
    <div class="chips">${cs.map(c => `
      <span class="chip ${c.ok ? 'pass' : 'fail'}"${c.val ? ` title="${c.label}: ${c.val}"` : ''}>
        <b aria-hidden="true">${c.ok ? '✓' : '✕'}</b>${c.label}${c.val ? `<em>${c.val}</em>` : ''}
      </span>`).join('')}
    </div>`;
}
```
    after:
```js
function renderStatus(r) {
  if (window.syncHeaderControls) syncHeaderControls();
  if (window.refreshInputTabs) refreshInputTabs();
  /* RWDC (2026-11-06): the sideways-scrolling strip of check chips is replaced by the check summary panel (rwDashRender, built
     from r.checks and rwResultRows(r); no new calculation) */
  if (typeof rwDashRender === 'function') rwDashRender(r);
}
```
  - JS: new script block `/* CHECK SUMMARY PANEL (RWDC, 2026-11-06 …` before the UI-shell script: `RWDC` (key, media query, open state), `RWDC_RPT`, `rwDashDC`, `rwDashGo`, `rwDashWhere`, `rwDashItems(r)`, `rwDashRender(r)`, `rwDashPlace()`, `rwDashColl(v, save)`.
- **Rows:** one per entry of `r.checks`, in the same order as the Report's summary table (§1.1): name (`label`), short value (`D/C x.xx` from `rwResultRows(r)[i].dc`, formatted `f(dc, 2)`, ∞ when infinite; where a check fails with its ratio within 1.0 or with no ratio, the failing condition instead: the row's note, e.g. "section over-stressed", or the check's value), status PASS / FAIL (`checks[k].ok`). ▸ opens a row: the value (`val`), the D/C and note, the reference (`rwResultRows` basis, tags removed) and "→ tab · card". FAIL rows start open. A click (or Enter / Space) opens the card where the check is worked (`rwGoto(card)`, the D11 "Worked in" links, `RW_CHECK_CARD`); ACI crack control (worked only in the Report) opens the Report tab at its step (`RWRP.api.jump('crk/stem.dc' | 'crk/heel.dc' | 'crk/toe.dc')`, again after the Report's chart images are in). Input errors (`r.fatal`): "Input error: no results. Correct the inputs:" with the error list and an "input error" count.
- **Layout:** below 1500 px the panel sits above the output tabs (rows in a grid, 250 px minimum); at 1500 px and wider it is a 292 px left column that scrolls on its own («/» shrinks it to a 42 px strip). Hide checks / Show checks collapses it.
- **Saved data (§5):** new per-browser UI key `retaincalcpro.dashCollapsed.v1` ('1' collapsed, '0' open; written only when the toggle is clicked; not in the project, the autosave or Export JSON). No existing key or format changed.
- **Kept:** the Overview "Wall section works / governing D/C" card (unchanged); the Report; the D11 links. Removed: only the strip's verdict + chips markup (the CSS rules `.verdict`, `.chips`, `.chip` remain, unused).
- **Formulas, factors, units, code references:** none changed (§4 does not apply). Every value shown is read from `r.checks` / `rwResultRows(r)`.
- **How verified:**
  - origin/main (after #925) vs branch, five cases (ACI default; project fields; AASHTO variable height + barrier + collision + interface shear; tall wall + key + water + passive + k_h; f′c blank): `window._R`, Export JSON, every localStorage key on load and after the edit, Report text, the result tabs' text and the four sheets' DXF **identical**; 0 console errors;
  - the panel against the Report's summary table, five cases (ACI, AASHTO full, water/key, tall ACI wall with 7 FAIL, tall AASHTO wall with 8 FAIL): every row's name, D/C and PASS / FAIL equal;
  - every row's click lands on its card (ACI and AASHTO); the crack-control rows open the Report at the step; the toggle writes `retaincalcpro.dashCollapsed.v1`; screenshots at 1400, 1700 and 390 px (expanded, collapsed, FAIL rows, input error) looked at.
- **Other copies:** none.
- **Decision (pending engineer review):** RW's checks are pass / fail only, so the panel shows PASS / FAIL (no REVIEW or N/A rows invented); the AASHTO "Extreme Event I not evaluated" warning is not a check and stays where it is.

## 2026-11-06 — PR: claude/rw-title-dates (PR #927: https://github.com/mlococo88/All-Structural/pull/927) (RWTB) — Project tab: optional Date and Checked Date, fed to the Report and Drawings title blocks   [display / saved-format addition only; no result change]
- **Why:** engineer-approved 2026-11-06 (review `rwreview`, Phase 1 item 4). The Drawings title block (#922) and the Report title block had DATE / CHECKED DATE cells that were always blank.
- **Where:**
  - Project tab, card "Project information": two new inputs after "Engineer of Record" and after "Checked By": `<input type="text" id="proj_date" placeholder="e.g. 2026-11-06">` (label "Date optional") and `<input type="text" id="proj_chkdate" …>` (label "Checked Date optional"); free text, as Spread Footing's title block;
  - `const RWTB_FIELDS = ['proj_date', 'proj_chkdate'];` before `function snapshotFields()`; in `snapshotFields()`, after the loop: `RWTB_FIELDS.forEach(id => { if (out[id] === '') delete out[id]; });` — a blank date is not saved, so a project without dates saves, autosaves, exports and uploads exactly as before;
  - `restoreFields(fields)`, first line after `if (!fields) return;`: `RWTB_FIELDS.forEach(id => { if (!(id in fields)) { const el = document.getElementById(id); if (el) el.value = ''; } });` — **migration:** a project, autosave, Export JSON file or GitHub copy saved before this change (no date fields) opens with both dates blank, not with the dates of the project open before;
  - Report (`rwrModel`): `meta` gains `date: g('proj_date'), chkDate: g('proj_chkdate')`; `info` before `['Date', ''] … ['Checked date', '']`, after `['Date', meta.date] … ['Checked date', meta.chkDate]`; the running header's right side, before `'Computed: ' + (meta.eng || '—') + ' · Checked: ' + (meta.chk || '—')`, after adds `' ' + date` / `' ' + chkDate` when filled (as Spread Footing);
  - Drawings (`rwdwBuild`): `meta` gains the two dates; title block row 1 before `['DATE', '', 1.75] … ['CHECKED DATE', '', 1.75]`, after `['DATE', meta.date, 1.75] … ['CHECKED DATE', meta.chkDate, 1.75]`; the Drawings tab's note "the tool has no Date / Checked date fields, so those cells are blank" → "… Date, Checked by, Checked date; a blank field prints "-"".
- **Saved data (§5):** no key renamed; the project / autosave / Export JSON / GitHub file (`RetainCalcPro.project`, `fields`) gains `proj_date` and `proj_chkdate` **only when filled**; older saves open blank (migration above).
- **Not changed:** the shared project info hand-off (`projectMeta`, MAP `date: ''`): "Use shared project info" / "Share project info" do not carry the date (unchanged; see the PR question).
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **How verified:** tests check-syntax, phone-layout rwall 390 / 768, project-library retwall, standard-save, github-sync-tools retwall, home-projects retwall, dxf-print-sheets rw: all pass. origin/main (after #926) vs branch, five cases with the dates blank (ACI default; project fields; AASHTO full; tall wall + key + water + passive + k_h; f′c blank): `_R`, Export JSON, every localStorage key, Report text, tab text, DXF **identical**. With Date 2026-11-06 and Checked date 2026-11-09: `_R` identical; Export JSON and the autosave differ only by `fields.proj_date` / `fields.proj_chkdate`; the Report text only in the title block (Date, Checked date); the DXF only in the two title-block date texts of each of the four sheets (8 text values). An old saved project (no date fields) opened after dates were typed: both blank and not saved; a project saved with a date keeps it and opens with it. Screenshots (Project tab, the sheet's title block) looked at. Tests: see the PR.
- **Other copies:** none.

## 2026-11-06 — PR: claude/rw-shared-date (PR #928: https://github.com/mlococo88/All-Structural/pull/928) (RWPD) — Shared project info carries the Project tab Date   [display / hand-off mapping only; no result change]
- **Why:** engineer-approved 2026-11-06 (Phase 3 task A; follow-up to RWTB #927, whose PR left the hand-off unchanged).
- **Where:** script block `/* Shared project info (HANDOFF.md §4.1, channel projectMeta) …`, the field map `var MAP={ projectName:'#proj_name', …`:
  - before: `… preparedBy:'#proj_eng', checkedBy:'#proj_chk', date:'' };`
  - after: `… preparedBy:'#proj_eng', checkedBy:'#proj_chk', date:'#proj_date' };`
  - nothing else: the existing `share()` / `use()` code already handles a mapped field. "Share project info" sends the Date (blank when empty, as before); "Use shared project info" lists and fills it like the other fields; a blank or missing shared date leaves the Date unchanged. `proj_date` is a text field (RWTB), so any date text is taken (as Spread Footing's `meta.calcDate` and the Steel Bridge app). Checked Date is not on the channel (it has one `date` field).
  - HANDOFF.md §4.1: a line for Retaining Wall Designer's field mapping (it was not listed).
- **Saved data (§5):** no key or format changed. A pulled date is saved like a typed one (RWTB: only when filled).
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Check case:** Date 2026-11-06, Share → `bridgeSuite.v1.projectMeta.fields.date = "2026-11-06"`; shared date "11/07/2026" → Use lists `Date: "2026-11-06" -> "11/07/2026"`, fills it, autosave holds it; shared date blank → Date unchanged (only the name is listed); own Date blank → Share sends `""`.
- **How verified:** the check case run headless (0 console errors); origin/main vs branch, five cases (ACI default; project fields; AASHTO full; tall wall + key + water + passive + k_h; f′c blank): `_R`, Export JSON, every localStorage key, Report text, tab text, DXF of the four sheets **identical**. Tests: check-syntax, engine handoffs + projects, phone-layout rwall 390/768, project-library retwall, standard-save, github-sync-tools retwall, home-projects retwall, dxf-print-sheets rw: all pass.
- **Other copies:** none (the map is this tool's own).

## 2026-11-06 — PR: claude/rw-scale (PR #929: https://github.com/mlococo88/All-Structural/pull/929) (RWTS-1) — Overview wall section: measured to scale, scale bar, readable labels   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (Phase 3 task B, PR 3a; as Spread Footing SFTS #776 and CBC CBSB #802). The Overview card "Dimensioned Cross-Section — To scale" had no scale bar and its labels rendered at 4.5–6.5 px at 1400 px (the drawing was shown at 75 % width, about 495 px, of a 760-unit viewBox with 6.5–9.5-unit text); several labels overlapped (GL(back) on the dimension lines, "Bearing (psf)" on B, the soil callout on the H dimension, the active base value cut off at the right edge).
- **Audit (headless Chromium, rendered px per ft from the drawn footing rectangle and stem polygon):** before and after, the geometry is already one scale across and up (`SCALE = drawW / (B + 0.3)` for both): footing across = footing up = stem up = stem base across, ratio 1.00. After: default wall 31.96 px/ft at 1400 px (scale bar 2.5 ft = 79.9 px → 31.96 px/ft), 35.18 at 768, 30.21 at 390 (drawing 620 px, scrolls sideways); tall wall (H_s 18, L_t 5, L_h 10) 24.35 px/ft, bar 5 ft. Smallest rendered text: 9.5 px at 1400, 10.4 at 768, 9.0 at 390 (was 4.5–6.5 px at 1400).
- **Where:** `buildOverviewSVG(r)` (anchor `const SVG_W   = 760;`):
  - margins `ML 60 → 70`, `DIM_GAP 52 → 56`, `PRESS_W 150 → 160`; new `FS = { s: 11, m: 11.5, d: 12.5, b: 13.5 }` text sizes and `HALO` (a background-coloured text outline, readable over hatching);
  - top margin `MT` (was 54 fixed) = 58 + the room the drawn items need above the stem top (`needTop`: stem-top dimension, barrier height, surcharge arrows, column load, backfill slope rise); bottom rows (was `MB = 82` fixed): bearing block, the two dimension rows (`dim_y1`, `dim_y2`) placed under it, then the scale bar (`sb_y`); `SVG_H = sb_y + 40` (was `H_px + MT + MB + dk_px + Df_add_px + 24`);
  - bearing ordinate scale `BRG_SCALE = (MB * 0.48) / max(MAX_BRG, 50)` → `40 / max(MAX_BRG, 50)` (39.4 → 40 px for the largest ordinate; pressure ordinates are not geometry);
  - `<svg … style="width:75%;min-width:300px;…">` → `<svg class="rw-dwg" … data-scale="${SCALE}" style="width:100%;height:auto;…">`; the Overview card body gets class `rw-dwg-wrap`; new CSS `.rw-dwg-wrap { overflow-x: auto; max-width: 100%; } .rw-dwg-wrap > svg.rw-dwg { min-width: 620px; }` (not in print) and `.tab-panel [style*="grid-template-columns:1fr 330px"] > * { min-width: 0; }` (the Overview grid's columns may shrink below their content, so the card scrolls and the page does not; at 1400 px the layout is unchanged): below about 660 px of card width the drawing scrolls sideways instead of shrinking its text;
  - titles centred on the drawing; the f′c / γ_c and γ_s / φ / q_a leader callouts (beside the toe and over the H dimension) → the subtitle (`… f'c · fy · γc · Ka · Kp`) and a second line `Soil: γs · φ · qa` (same values);
  - label moves: GL(back) inside the backfill under the line at the heel end; GL(toe) above the toe grade line; WT label inside the backfill under the water line; barrier label left of the barrier; active base value "… psf at base" and hydrostatic "+… psf (hydro.)" under the pressure diagram's right end; p_top inside the zone; "Ka·q = …" above the strip; "Bearing (psf; ordinates not to scale)" between the q values; stem-top width dimension above the barrier when there is one; vertical dimensions (t_f, H_s, H, D_f) with their text along the line (`ovDimV(…, 'rot', …)`);
  - new `rwtsScaleBar(x, y, sc, fs, note)` (before `// ── SVG helper: callout leader line`): a 0 / L/2 / L ft bar (L from 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100 ft, at most 180 units long) and the note "Pressure ordinates and load arrows are not to scale (values labelled)."; `data-geo="footing"` / `"stem"` on the two concrete shapes (for the measurement);
  - `ovDimH` / `ovDimV` take an optional text size `fs` (and `ovDimV` the side `'rot'`); with no `fs` they draw exactly as before (no other caller passes it).
- **Report:** the same figure (§ Wall geometry, "Wall section (as on the Overview tab)") follows; it prints 661 px wide (was 496).
- **Formulas, factors, units, code references:** none changed (§4 does not apply). Every value drawn is the one drawn before.
- **Saved data (§5):** none.
- **How verified:** origin/main vs branch, seven cases (ACI default; project fields; AASHTO full; tall wall + key + water + passive + k_h; f′c blank; column load + surcharge + β + water + key; AASHTO barrier + LS surcharge + β): `_R`, Export JSON, every localStorage key, Report text and tab text with the SVG figures removed, DXF of the four sheets **identical**; the only SVG that differs is the Overview figure (tab and Report). Measurements above. Tests: see the PR. Screenshots before/after at 1400 and 390 (default, AASHTO barrier + surcharge + β, water + column) looked at.
- **Other copies:** none.
- **Decision (pending engineer review):** at phone width the drawing keeps a 620 px minimum width and scrolls sideways inside its card, so its text stays at 9 px or more (shrinking it to 350 px would put the labels at about 5 px). The material/soil leaders became subtitle lines.

## 2026-11-06 — PR: claude/rw-scale-diagram (PR #930: https://github.com/mlococo88/All-Structural/pull/930) (RWTS-2) — Analysis diagram cross-section: measured to scale, scale bar, readable labels, Fit shows the whole drawing   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (Phase 3 task B; second drawing after RWTS-1 #929). The Analysis diagram tab opened at 100 % in a 640 px viewport, which cut off the footing, the bearing diagram and the dimensions (default wall), and "Fit" only reset to that view. There was no scale bar. Its 6.3–9-unit labels overlapped ("crit." on the stem-top dimension, GL (back) and H_s on the dimension lines, W.T. on the p_wt value, F2 on its bars, the passive value on the F2 bars). The S1 hook and lap zone were schematic.
- **Bug found and fixed (display):** the bearing and passive tooltips (`brgtip`, `ptip`) held `<b style="color:…">` inside a double-quoted `data-tip` attribute. The inner quote ended the attribute, so the browser closed the `<svg>` there. The bearing labels, the q_a line label, the critical-section tags and **every dimension** fell out of the SVG as loose HTML text under the drawing (on main, in every case, out of sight below the 640 px viewport). The inner quotes are now `&#39;` (`<b style=&#39;color:#7fd6a8&#39;>`), so the tooltips show the same coloured PASS / FAIL / Included / Neglected.
- **Audit (headless Chromium, px per ft from the drawn footing rectangle and stem polygon; the scale bar's px per ft):** the geometry was already one scale across and up (`SCALE = drawW / (B + 0.4)`). After, at the fitted view:
  - default wall at 1400 px: 45.98 / 45.98 / 45.98 (bar 2.5 ft);
  - 768 px: 39.98;
  - 390 px: 33.41 (drawing 620 px, scrolls);
  - tall wall (H_s 24, L_t 4, L_h 9, key, water, column, q_s, β) at 1400: 24.92 (bar 5 ft).
  Ratio across / up 1.00 in every case. Smallest text at the fitted view: 13.3 px (1400), 11.6 (768), 9.7 (390), 12.0 (tall, 1400 and 390). Before, the default wall's smallest text was 7.4 px at 100 % (6.3 units × 1.18), with the bottom of the drawing out of view.
- **Where:**
  - `buildCrossSection(r)` (anchor `const SVG_W   = 820;`):
    - margins: `ML 30 → 60`, `MR 180 → 190`;
    - new `K` (text scale `min(2, max(1, (H·SCALE + 280) / 820))`, so tall drawings, which are fitted at a smaller zoom, get larger text) and `FS = { s: 12K, m: 12.5K, d: 13K, b: 14K }`;
    - `MT` (was 50 fixed) and the bottom rows (was `MB = 100`) placed from what they hold (`off_c`, `off_d`, `off_col`, `drop0`, `dimOff1`, `dimOff2`, `sbOff`);
    - `ACT_MAX_W = MR − 20` → `160` and `BRG_SCALE = (MB·0.50)/…` → `50/…`: the same pressure ordinate sizes;
    - `<svg … class="rw-dwg" data-scale="${SCALE}">`;
    - before the dimension block, the fixed 6.3–8-unit text sizes are scaled: `font-size = max(1.5·v, 12)·K`; every `<text>` gets a background-coloured halo;
    - dimensions use `dL(…, fs)` / `dV(…, fs)`; vertical dimension text runs along the line; the right-hand dimensions sit at `x_heel + 6 + FS.d` and `+ FS.b + 10` (were `+14`, `+30`).
  - Label moves:
    - GL (back) inside the backfill at the heel end; GL (toe) above its line;
    - W.T. label and "saturated γ′" at the right end under the water line; the γ′ note just under the water line;
    - critical-section tags left of their lines, above the barrier;
    - stem-top dimension in its own row; column load above it;
    - F2 label at the top of the toe; the passive value above the F2 bars; the "Passive" tag only where it fits (`Df_px > 6.5·FS.s`, was `> 20`);
    - "std 90° hook" right of the hook; "Ka·q" under the p_top value; the q values anchored inside the ends; "Bearing (psf) — service" at 0.62 B; the key tag under the key.
  - **S1 hook drawn to scale** (was: elbow at 0.62 t_f, tail max(10 px, 0.9 t_f)):
    - down to the top of the bottom mat: tail centreline at `y_fbot − cover − (d_b,F2 + d_b,S1/2)`;
    - bend radius to the centreline (inside diameter/2 + d_b/2): inside diameter 6 d_b for #3–#8, 8 d_b for #9–#11, 10 d_b for #14–#18 (ACI 318-19 Table 25.3.2; AASHTO LRFD 10th Ed. Table 5.10.2.3-1);
    - 12 d_b tail toward the toe (ACI 318-19 Table 25.3.1; AASHTO 5.10.2.1).
  - **Lap zone** at its true length 1.3 ℓ_d (was capped at 0.16 H_s).
  - **Scale bar:** `rwtsScaleBar(…, noteBelow = true)` with "Pressure ordinates, load arrows and bar symbols are not to scale (values labelled)." `rwtsScaleBar` gains `noteBelow`, and its bar may grow to 15 × the text size so its labels do not overlap. For the Overview's 11-unit text the limit is still 180, so the Overview figure is unchanged (checked: identical to main).
  - `initDiagramInteractivity` (anchor `const fit = () =>`):
    - new `size()`: the viewport is as tall as the drawing, up to 85 % of the window (at least 640 px when the drawing is taller; was 640 px fixed);
    - `fit()` fits the whole drawing (zoom = min(1, viewport height / drawing height), centred; was zoom 1 at the top-left);
    - the tab opens fitted, and refits when shown or resized (`ResizeObserver` on the stage), until the view is zoomed or panned by hand (`_dgState.user`, a new in-memory field; nothing saved). The hand-set view is kept across re-renders as before;
    - zoom-out limit 0.4 → 0.2.
  - CSS `@media (max-width: 700px) { #dg-viewport { overflow: auto !important; } #dg-stage { min-width: 620px; } }`: on a phone the drawing keeps its readable size and scrolls by touch inside the viewport.
- **Formulas, factors, units, code references:** none changed (§4 does not apply). The hook and bend sizes are drawn from the standard-hook tables quoted in the code comment. No check reads them.
- **Saved data (§5):** none (`_dgState.user` is in memory only).
- **How verified:**
  - origin/main (after #929) vs branch, eight cases (seven of RWTS-1 + the tall wall): `_R`, Export JSON, every localStorage key, Report text and tab text with the SVG figures removed, DXF of the four sheets **identical**. The Analysis diagram SVG is the only SVG that differs (it is not in the Report).
  - Measurements above.
  - Screenshots at 1400 and 390 (default, AASHTO barrier + LS surcharge + β, tall wall with key + water + column + q_s + β) looked at, before and after.
  - Tests: see the PR.
- **Other copies:** none.
- **Decisions (pending engineer review):**
  - The diagram opens fitted (whole drawing visible), not at 100 % top-left.
  - Tall walls get proportionally larger text (K up to 2) so labels stay about 12 px at the fitted view.
  - The S1 hook is drawn resting on the bottom mat with the standard bend and 12 d_b tail. That is how it is usually detailed, but the tool's ℓ_dh check does not depend on it.
  - The bar dots stay symbols (enlarged where a true-size dot would be under 2.5 units); the note says so.

## 2026-11-06 — PR: claude/rw-scale-elev (PR #931: https://github.com/mlococo88/All-Structural/pull/931) (RWTS-3) — Collision elevation (Analysis diagram, AASHTO CT) drawn to scale with a scale bar; readable labels   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (Phase 3 task B; third drawing after RWTS-1 #929 and RWTS-2 #930).
  - The "Elevation — Vehicular Collision Distribution" card drew the wall with a vertical scale exaggerated to a 240–330 px height and said so ("NTS — vertical scale ×1.39 horizontal"). The 45° spread lines were therefore not at 45°, and the note "(true; NTS)" admitted it.
  - Its 6–9.5-unit labels were cut off at the left (y_CT, H_s) and overlapped: h_b on h_CT; ROADWAY on the data table; EE-II OK on the M_CT box; "vertical cantilever" on the centred MassDOT note.
- **Where:** `buildElevationSVG(r)` (anchor `// ── Layout: ONE scale along the wall and up`):
  - **Scale.**
    - Before: `SCx = drawW / Ljoint; ELEV_H = max(240, min(330, totalFt·SCx·1.6)); SCy = ELEV_H / totalFt`.
    - After: `SCx = min(drawW0 / Ljoint, 420 / totalFt); SCy = SCx; drawW = Ljoint·SCx`: one scale, and the elevation is at most 420 units tall (the wall is then narrower than the column).
    - `MR 172 → 206`. `MT` (was 54) grows for EXP JT / L_c / an impact above the barrier.
    - Bottom rows: band +40 → +44, plan +62 → +84, scale bar at plan bottom + 54; H_SVG adds 34 when the impact-above-barrier warning shows (it used to sit on the plan dimension).
    - Subtitle "NTS — vertical scale ×n horizontal" → "to scale". "(true; NTS)" under 45° removed.
  - **Dimension chain.**
    - Three lines (`dx1 = x0−16`, `dx0 = x0−44`, `dx2 = x0−72`; were two at −30 / −62). Text runs along each line where it fits, else it sits beside the line's lower end; "(lever arm)" is dropped from y_CT when it does not fit.
    - h_CT is now dimensioned beside the contact patch (`xp1 + 12`). h_b is named in the barrier ("BARRIER h_b=3.00'"), as the two short segments' text could not fit on the left.
  - **Label moves.**
    - ROADWAY under the line at the left end.
    - EE-II OK / FAIL above the band's right end.
    - L_dist dimension at band + 50 (was +32).
    - L_c dimension at barrier top − 34 (was −24).
    - Load-path arrow at `min(x1 − 50, max(xc + L_t/2 + 34, xc + 175))`.
    - Data table 176 wide with 17-unit rows (was 140 / 15); M_CT box below it when the elevation is short.
    - Plan title "… (strip width schematic)".
  - **Text and scale bar.**
    - Text sizes `max(1.35·v, 11)` units, with a halo.
    - `rwtsScaleBar(x0, y_sb, SCx, 11, 'Arrow lengths, the load band and the plan strip width are not to scale (values labelled).', true)`.
  - **Display width.** `<svg class="rw-dwg rw-dwg-wide" data-scale=…>`; its card body gets `rw-dwg-wrap`; new CSS `.rw-dwg-wrap > svg.rw-dwg.rw-dwg-wide { min-width: 760px; }`. Below that width the drawing scrolls inside its card; the page does not widen.
- **Measured (headless Chromium; px per ft along the wall from the stem rectangle's width ÷ L_joint, and up from its height ÷ H_s; scale bar):**
  - L_joint 41 ft, MassDOT full section, 1400 px: 16.17 / 16.17, bar 10 ft → 16.17; smallest text 13.1 px.
  - Same at 390 px (drawing 760 px, scrolls): 12.03 / 12.03; 9.7 px.
  - L_joint 90 ft, 45° spread, h_CT 42 in (above the 36 in barrier): 7.37 / 7.37, bar 25 ft.
  - Before, the default case had a vertical scale ×1.39 the horizontal (17.16 px/ft along, 23.77 up at 1400), and its smallest text was 8.3 px at 1400 (some labels cut off at the left edge) and 3.0 px at 390.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Saved data (§5):** none.
- **How verified:** origin/main (after #930) vs branch, ten cases (the eight of RWTS-2 + MassDOT full-section CT + 45° spread CT with h_CT above the barrier): `_R`, Export JSON, every localStorage key, Report text and tab text with SVG removed, every Report / Overview SVG, DXF of the four sheets **identical**; the elevation is not in the Report. Screenshots at 1400 and 390 looked at, before and after. Tests: see the PR.
- **Other copies:** none.
- **Decision (pending engineer review):** the elevation is drawn at one scale; a very long joint spacing gives a long, low strip with its text still at full size. The plan strip's width is schematic, and the note says so.

## 2026-11-06 — PR: claude/rw-bearing-combo (PR #932: https://github.com/mlococo88/All-Structural/pull/932) (RWBP) — Stability tab: bearing pressure per combination (selector, to-scale diagram, resultant, e, contact length)   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (Phase 3 task D, review PR 3c). Before, the Stability tab showed only the Plotly chart (service q(x), factored q_u(x), q_a). There was no per-combination bearing diagram, resultant location, eccentricity or contact length. The Report's bearing figure (`buildBearingDiagram`) was not to scale and had no scale bar.
- **What:**
  - A **Combination** selector with a to-scale diagram above the existing chart:
    - ACI mode: in Step 6 — Bearing Pressure Check.
    - AASHTO mode: in the "Bearing Pressure Distribution" card.
  - The chart itself is unchanged.
- **Options** (what the analysis computes; ★ = default, the governing one):
  - **ACI:** ★ Service (unfactored), the bearing check vs q_a; U = 1.2D + 1.6H; U = 0.9D + 1.6H (footing design).
  - **AASHTO:**
    - ★ Strength I (maximum vertical) or Strength Ia (minimum vertical), whichever governs (`bearing_Ia_governs`);
    - the other of the two;
    - Extreme Event II (when the collision check is on);
    - Strength I / Ia total vertical with uplift (footing design);
    - Service (unfactored loads), labelled "reference only, not a check in AASHTO mode".
- **Diagram** (`rwbpSVG`):
  - footing B × t_f and the stem base (cut by a break line), to scale with a scale bar;
  - the middle-third ticks and B/2;
  - the pressure block of the selected combination, ordinates to their own scale and labelled. Linear trapezoid / triangle; uniform over B′ (soil, Meyerhof) placed centred on the resultant; on rock, linear per AASHTO 10.6.5 / Eqs. 11.6.3.2-2/-3;
  - the limit line (q_a, or q_R) where the combination is a check;
  - the resultant R = ΣV with e at x̄, and dimensions x̄ (from the toe) and contact length.
- **Worked lines** under the diagram (§6), for the selected combination:
  - ΣV and x̄, then e = B/2 − x̄ = …, with B/6;
  - then the contact length and the pressures: full contact, q = ΣV/B·(1 ± 6e/B); triangular, 3x̄ and 2ΣV/(3x̄); uniform, B′ = B − 2|e| and q = ΣV/B′; rock;
  - with the limit;
  - and a "Worked in" link to the card where the combination is worked: Stability Step 6, Step 7 (factored, ACI), Step 7b (EE II), or Footing "Factored Loads on Footing" (new `RW_CARDS.ftgLoads`).
  - A resultant outside the base (|e| > B/2, where the analysis gives q = 0) is stated, with no contact length.
- **Values:** every number is the analysis' own (`r`, `r.aashtoR`, `r.aashtoR.ct.ee2`). The only derived values are:
  - the contact length (B, 3x̄, 3(B − x̄), B′ or 3(B/2 − |e|), by the same formulas the analysis uses);
  - on rock with |e| ≤ B/6, the minimum-edge pressure ΣV/B·(1 − 6|e|/B) (shown with its formula).
- **Where** (new block before `// SHARED HELPER — renders a standard flexure+shear result card`):
  - `rwbpCombos(r)`, `rwbpPick(r)`, `rwbpZone(r, c)`, `rwbpWork(r, c, z)`, `rwbpSVG(r, c)`, `rwbpBlock(r)`, `rwbpSet(k)`;
  - inserted into `renderStability` (`h += rwbpBlock(r);` before `<div id="plt-bearing" style="margin-top:12px;">`) and into the AASHTO card (`<div class="card-body">${rwbpBlock(r)}<div id="plt-bearing"></div></div>`);
  - CSS `.rwbp …` after `.wkLink`.
- **Report:** ACI Step 6 figure "Service bearing pressure, toe to heel": `buildBearingDiagram(r)` → `rwbpSVG(r, <service>)`. The caption is the same; the figure is to scale. `buildBearingDiagram` is now unused (kept). The AASHTO Report is unchanged.
- **Selection / sync:**
  - `window.RWBP_SEL`: `'GOV'` (the default) or a combination key; session only, with **no storage key**. 'GOV' follows the governing combination after an input change.
  - `rwbpSet` calls an optional `window.rwbpOnPick(sel)`, a one-way sync hook for the 3D view (task C, as Spread Footing SF3L); nothing uses it yet.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Saved data (§5):** none.
- **Check case** (default ACI wall, service):
  - ΣV = 16583 lb/ft, x̄ = 6.469 ft, e = 6.250 − 6.469 = −0.219 ft (toward the heel), |e| ≤ B/6 = 2.083 ft;
  - full contact 12.50 ft;
  - q_toe, q_heel = 1187, 1466 psf ≤ q_a = 3000 psf (as Step 6).
- **Check case** (H_s 18, L_t 1, L_h 6, service):
  - x̄ = 1.945 ft, e = 2.305 > B/6 = 1.417 ft;
  - contact 3·1.945 = 5.834 ft;
  - q_max = 2·18248/(3·1.945) = 6255 psf (as Step 6).
- **How verified:**
  - origin/main vs branch, nine cases (ACI default; project fields; AASHTO full; tall wall + key + water + passive + k_h; f′c blank; column + q_s + β; AASHTO CT; triangular ACI; AASHTO rock with CT): `_R`, Export JSON, every localStorage key, the Report text and the tab text (SVG and the new block removed), and the DXF are **identical**. The Report's only change is the ACI bearing figure.
  - Every option of every case rendered with 0 console errors.
  - Measured at 1400: footing across = up = stem width = scale bar 46.88 px/ft, smallest text 11 px. At 390 (620 px, scrolls): 38.24 px/ft, 9 px. Report figure about 670 px wide.
  - Screenshots looked at: default; AASHTO Strength I / Ia; triangular; resultant outside the base; Report.
  - Tests: see the PR.
- **Other copies:** none.
- **Decisions (pending engineer review):**
  - The selector shows one combination at a time, with the governing one as default.
  - AASHTO soil bearing is drawn as the uniform Meyerhof block over B′ centred on the resultant (what the check uses). The footing-design trapezoids are separate options.
  - The service distribution in AASHTO mode is listed as reference only.
  - The Plotly chart is kept as is below the new diagram.

## 2026-11-06 — PR: claude/rw-3d-labels (PR #933: https://github.com/mlococo88/All-Structural/pull/933) (RW3L) — 3D view: load arrows with value labels, a load case / combination selector, a title with the sign convention   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (Phase 3 task C, review PR 3b; as Spread Footing SF3L #765). Before, the 3D view showed pressure prisms only: no load resultants, no values, no selector. Its bearing block was the service trapezoid over the full B, also when the resultant was outside the middle third.
- **What:**
  - **Selector "Show"** above the view (`#c3d-sel`, optgroups):
    - ★ Governing bearing combination (default; the one the Stability tab marks ★);
    - Load cases (unfactored, per ft of wall): All load cases, then each case present.
      - AASHTO: EH; LS; ES; WA (with uplift); CT (Extreme Event II).
      - ACI: H (earth, with P_a,v when β > 0); surcharge; water (with uplift); E (M-O increment, when k_h > 0).
      - Both modes: surcharge (vertical, q·L_h); D/DC concrete (stem, footing, barrier); soil on the heel (EV); column / beam (service); passive (toe, key) when included.
    - Combinations (base reaction and bearing pressure): every combination of the Stability tab's bearing selector (RWBP #932).
  - **Arrows and labels:**
    - Each load is an arrow, placed at the front of the 12 ft run, with a label giving its value and its height y above the footing base (lateral loads) or its x from the toe (vertical loads). Example: `H (earth) = 3.65 k/ft @ y = 4.50 ft`.
    - Lateral loads act on the heel plane (x = B) toward the toe; passive acts on the toe toward the heel; CT acts at the stem's back face at y_CT.
    - For a combination (or Governing): the base reaction `R = ΣV = … k/ft @ x̄ = … ft, e = … ft` points up under the footing, and the bearing layer shows that combination's distribution (`rwbpZone`: trapezoid / triangle, B′ block, rock). The contact length and q_max are given in the title.
    - "All load cases" shows the service reaction. A single load case shows no bearing pressure.
  - **Labels:**
    - Canvas-texture `THREE.Sprite`s (bold 12 px, white box, border in the load colour), `sizeAttenuation:false` and `depthTest:false`: the same pixel size at any zoom, always facing the camera, never hidden by geometry or the section cut.
    - `rw3LayoutLabels()` runs each frame before the render. It places each label right of its anchor inside the view, keeps it off the control panels (legend, buttons, readout: class `c3d-panel`), and moves it below the panel in the way when neither side has room. It pushes a label down below any label already placed, and draws a dashed leader (SVG `#c3d-leaders`) when a label is more than 10 px from its arrow.
  - **Title** (`#c3d-title`): what is shown (governing / combination, factored or not; or the load case, unfactored), the units and axes, and the sign convention (directions of every arrow). It links to the bearing card.
- **Where:**
  - New block before `function buildGeometry3D(r) {`: `RW3`, `rw3K`, `rw3Cases`, `rw3Options`, `rw3Selected`, `rw3Title`, `rw3Label`, `rw3Arrow`, `rw3Build`, `rw3LayoutLabels`, `rw3Set`, `window.rwbpOnPick`.
  - `render3D` shell: the `.c3d-bar` with the selector and the title; `<svg id="c3d-leaders">`; class `c3d-panel` on the legend, the right-hand controls and the readout; group `'loads'` added to the scene groups; `rw3LayoutLabels()` in the animation loop.
  - `buildGeometry3D`: before, `// ── BEARING PRESSURE (trapezoid below footing) ──` built `bShape` from `r.q_toe`/`r.q_heel` over 0…B. After: `rw3Build(r);`.
  - CSS `.c3d-bar …`.
- **Sync (one-way, as SF3L):** a pick in the Stability tab's bearing selector (`rwbpSet` → `window.rwbpOnPick`) sets the 3D selection (`'GOV'` or `'C:'+key`), also before the 3D tab is opened. A pick in the 3D selector stays local. The selection is session only (`RW3.sel`): **no storage key**.
- **Values:** the analysis' own: `r` (ACI / service) and `r.aashtoR` (P_EH, y_EH, P_LS, y_LS, P_ES, P_hyd, ct.CT_h, ct.y_CT). Heights where the analysis keeps only the moment: y = M / P (surcharge Mo_sur/Pa_sur_h, water Mo_hyd/F_hyd, seismic Mo_seis/Pe_inc). Positions: x_stem, x_ftg, x_soil, x_bar, x_col, Ms_sur/Wsur, x_uplift; passive toe at D_f/3 (as `Ms_Pp`). Arrow lengths are indicative.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Check case** (default ACI wall, H = 13.5 ft, K_a = 1/3, γ = 120 pcf):
  - H (earth) = ½·(1/3)·120·13.5² = 3645 lb/ft → `3.65 k/ft @ y = 4.50 ft` (= H/3);
  - stem (1 + 1.5)/2·12·150 = 2250 → `2.25 k/ft @ x = 3.63 ft`;
  - footing 12.5·1.5·150 = 2812.5 → `2.81 k/ft`;
  - soil 8·12·120 = 11520 → `11.52 k/ft @ x = 8.50 ft`;
  - R = 16.58 k/ft @ x̄ = 6.47 ft, e = −0.22 ft (as Stability Step 6).
- **How verified:**
  - origin/main vs branch, eight cases (ACI default; project fields; AASHTO full; tall wall + key + water + passive + k_h; f′c blank; column + q_s + β + water; AASHTO CT; triangular ACI): `_R`, Export JSON, every localStorage key, Report and tab text, and DXF **identical**.
  - Every option rendered with 0 console errors.
  - Sync: a Stability pick of U = 1.2D + 1.6H → 3D shows `C:u12`.
  - Screenshots at 1400 and 390 (ACI with water + seismic + column + key + passive; AASHTO with barrier + CT; load case CT; synced combination) looked at: no label overlaps another label or a panel.
  - Tests: see the PR.
- **Other copies:** none. **Library:** three.js r128 already loaded (Sprite, CanvasTexture, ArrowHelper); nothing new.
- **Decisions (pending engineer review):**
  - In a combination view the load arrows are the **unfactored** load cases, while the base reaction and the bearing pressure are the combination's (factored where it is). The title says so. Factored per-load arrows would need the combination factors restated outside the analysis; I did not add them (question).
  - A single load case shows no bearing pressure.
  - The 3D selection is session only.
  - AASHTO mode lists no seismic case (Extreme Event I is not evaluated by the tool).

## 2026-11-06 — PR: claude/rw-3d-factored (PR #934: https://github.com/mlococo88/All-Structural/pull/934) (RW3F) — 3D view: "Load arrows: Unfactored / Factored" for combination views; factors read from the analysis' combination definitions   [display only; calcAll refactor with no result change]
- **Why:** engineer-approved 2026-11-06 (follow-up to RW3L #933, whose open question was factored per-load arrows).
- **What:**
  - A toggle **Load arrows: ○ Unfactored ○ Factored** next to the 3D selector (`#c3d-fac`, radios `name="c3d-fac"`). Enabled for a factored combination (ACI U = 1.2D + 1.6H, U = 0.9D + 1.6H; AASHTO Strength I, Strength Ia, Extreme Event II, Strength I / Ia total). Disabled (greyed, with a tooltip) for a single load case, "All load cases" and the service combination: these stay unfactored.
  - Factored: each load-case arrow is γ × the load case, labelled `name = γ × P = γP k/ft @ position` (e.g. `Soil = 1.20 × 16.16 = 19.39 k/ft @ x = 8.50 ft`). A load whose factor is 0 in that combination is not drawn and is listed in the title ("Not in this combination's base resultant: …"). The column is drawn as the analysis' own factored value (ACI: `Puf_max`, or 0.9·column DL for U = 0.9D + 1.6H; AASHTO Strength I: `V_col`; none in Ia / EE II, as the formulas).
  - The title states which is shown ("Load arrows: factored …, read from the analysis' definition of <combination>", with η when ≠ 1; or "load arrows: unfactored") and a **check line**: Σγ·V of the arrows vs R = ΣV of the combination, and Σγ·M about the toe vs R·x̄, each ✓/✗ (tolerance 1e-6 relative). This proves the factor map against the analysis for any input.
  - AASHTO unfactored load cases gain two arrows that the analysis uses and the view lacked: `EH,v` (P_a,v at x = B, in the EH case) and `LS,v` (q_LL·L_h on the heel, in the LS case).
  - State `RW3.fac` (default Unfactored): **session only, no storage key**.
- **calcAll refactor (no result change):** the literal factors of the bearing / stability combinations are now one definition each, used by the formulas and returned:
  - ACI, before `const SumVu = 1.2 * (Wftg + Wstem + Wsoil + W_bar) + 1.6 * (Wsur + Pa_tri_v) + Puf_max;` (and `Mou`, `Msu`, `SumVu_min`, `Msu_min`). After: `const CMB_U12 = { D: 1.2, H: 1.6, E: 1.0 };` `const CMB_U09 = { D: 0.9, Hv: 0.9, colD: 0.9 };` and e.g. `const SumVu = CMB_U12.D * (Wftg + Wstem + Wsoil + W_bar) + CMB_U12.H * (Wsur + Pa_tri_v) + Puf_max;` Returned as `r.comb = { u12, u09 }`.
  - AASHTO Strength I / Ia, before e.g. `eta * (gEH_max*P_EH + 1.75*P_LS + 1.50*P_ES + 1.00*P_hyd)`, `0.90*(V_DC + W_bar) + 1.00*Wsoil + gEH_min*Pa_tri_v - V_up`, `eta * (1.25*V_DC + 1.35*Wsoil + gEH_max*Pa_tri_v + 1.75*V_LS_v + 1.25*W_bar) + V_col`, `V_str_max_tot - V_up`. After: `const CMB_S1 = { DC: 1.25, EV: 1.35, EH: gEH_max, LS: 1.75, ES: 1.50, WA: 1.00 };` `const CMB_S1A = { DC: 0.90, EV: 1.00, EH: gEH_min };` used in `H_drive_str`, `V_resist_min`, `Mo_str`, `V_str_min`, `Mr_str_min`, `V_str_max_tot`, `Mr_str_max_tot`, `V_str_max`, `Mr_str_max` (uplift as `CMB_S1.WA*V_up`, `CMB_S1.WA*M_up`; ×1.00 is exact). Returned in `aashtoR` with `V_LS_v` and `x_LSv`.
  - Extreme Event II, before `CT_h*1000 + …`, `1.00*(Wftg + Wstem + W_bar) + 1.00*(Wsoil + Pa_tri_v) - F_uplift`, `M_CT + …`, `1.00*(Ms_ftg + Ms_stem + Ms_bar) + 1.00*(Ms_soil + Ms_Pv) + Ms_uplift`. After: `const CMB_EE2 = { CT: 1.00, DC: 1.00, EV: 1.00, EH: gEH_ct, LS: gLS_ct, WA: 1.00 };` used in `H_drive_ct`, `V_ct_min`, `Mo_ct`, `Mr_ct`; returned in `ct.ee2.CMB_EE2`.
  - Same numbers and the same arithmetic order (each literal replaced by a constant of the same value, grouping unchanged), so every result is bit-identical (proved below).
- **Where:** `rw3Factors(r, key)` (which definition factor multiplies which load, as the formulas do), `rw3Factored(r, S, F)` (factored items, omitted loads, Σγ·V, Σγ·M), `rw3Fac(on)`; `rw3Selected` returns `F` and `fac`; `rw3Title` factored branch; `rw3Build` draws `S.FX.items` when factored; item tags (`tag`) on `rw3Cases`; CSS `.c3d-fac`.
- **Formulas, factors, units, code references:** none changed (§4: refactor only).
- **Check case** (default ACI wall, U = 1.2D + 1.6H, factored arrows): stem 1.20 × 2.25 = 2.70, footing 1.20 × 2.81 = 3.38, soil 1.20 × 11.52 = 13.82 k/ft; H (earth) 1.60 × 3.65 = 5.83 k/ft @ y = 4.50 ft. Σγ·V = 19899 lb/ft = SumVu ✓; Σγ·M = 122164 lb·ft/ft = SumVu·x_Ru ✓.
- **How verified:**
  - origin/main vs branch, eight cases (ACI default; project fields; AASHTO full with CT; tall wall + water + passive + k_h; f′c blank; ACI water + seismic + column + q_s + β + key; AASHTO water + column + η 1.05 + at-rest + passive; AASHTO rock + CT (γ_EH,CT 0) + water + β): `_R` identical except the added `comb`, `aashtoR.CMB_S1`, `CMB_S1A`, `V_LS_v`, `x_LSv`, `ct.ee2.CMB_EE2` (exact comparison); Export JSON, every localStorage key, Report and tab text, DXF identical; 0 console errors.
  - Every combination of six cases with Factored on: both checks ✓ (Σγ·V = R, Σγ·M = R·x̄) in all 21 factored views; toggle disabled for load cases, All and service.
  - Screenshots 1400 (ACI U = 1.2D + 1.6H unfactored / factored, load case; AASHTO governing and EE II factored) and 390 looked at.
- **Other copies:** none.
- **Decisions (pending engineer review):**
  - Factored arrows only in combination views; the reaction R and pressure were already the combination's.
  - η is included in γ for AASHTO Strength (as the analysis multiplies), stated in the title.
  - The view state is session only (no key).
- **Observations for the engineer (not changed, §4 — questions):**
  - ACI U = 1.2D + 1.6H and 0.9D + 1.6H: the factored resultant omits the water uplift (service includes it).
  - AASHTO Strength I: the vertical dead-load surcharge q_sur·L_h (ES vertical) is not in ΣV (`V_ES_v = 0`), while ES lateral is; Extreme Event II adds γ_LS,CT × q_sur·L_h (the dead surcharge, not the LS q_LL·L_h) and factors the hydrostatic WA with γ_EH,CT (so it drops to 0 with the MassDOT option).

## 2026-11-06 — PR: claude/rw-report-bearing (PR #935: https://github.com/mlococo88/All-Structural/pull/935) (RWRB) — AASHTO Report: to-scale bearing diagram for the governing combination in Step 6   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (task 2). The ACI Report has had the Stability tab's to-scale bearing figure in Step 6 since #932; the AASHTO Report's bearing section had none.
- **What:** AASHTO Report, "Step 6 — Bearing resistance (Strength I)": after the worked steps, a figure = `rwbpSVG(r, <governing combination>)` (the Stability tab's diagram, #932: footing and stem base to scale with a scale bar, pressure block, q_R line, resultant R at x̄ with e, contact length). The governing combination is the Stability tab's ★ (`rwbpCombos(r).gov`: Strength I or Strength Ia, `bearing_Ia_governs`). Soil: uniform over B′ (Meyerhof); rock: linear (Art. 10.6.5).
- **Caption:** the combination, ΣV, x̄, e, the distribution and B′ or the contact length, q_u vs q_R, and "see §" links to the steps where they are worked: `sa6/e` (Strength I) or `sa6/BeffIa` (Strength Ia), `sa6/qu` or `sa6/quIa`, and the check `sa6/dc`. The existing "On screen: Stability tab" link stays after it.
- **Where:** new `rwrBrgFigA(r)` before `function rwrItem(scope, list, opt) {`; in the AASHTO Step 6 `subs.push(sub('Step 6 — Bearing resistance (Strength I)', [rwrItem('sa6', …), rwrBrgFigA(r), onTab('stabBrg')]))` (before: `[rwrItem('sa6', …), onTab('stabBrg')]`).
- **Formulas, factors, units, code references:** none changed (§4 does not apply). Values are the analysis' own (`r.aashtoR`).
- **Check case** (AASHTO with barrier + CT, default wall): Strength I governs; ΣV = 27441 lb/ft, x̄ = 6.02 ft, e = 0.228 ft; B′ = 12.50 − 2(0.228) = 12.04 ft; q_u = 27441 / 12.04 = 2278 psf ≤ q_R = 4950 psf (as Step 6).
- **How verified:** origin/main vs branch, eight cases (as RW3F): `_R`, Export JSON, every localStorage key, tab text, DXF identical; the Report text differs only by the new caption in the three AASHTO cases (Strength I soil; Strength Ia soil, resultant near the toe; Strength Ia on rock, triangular); ACI Reports identical; links resolve (no `§?`); 0 console errors. Screenshots of the figure looked at.
- **Other copies:** none.
- **Decisions (pending engineer review):** only the governing combination is drawn (the tab's selector shows the others); Extreme Event II keeps its worked steps without a figure.

## 2026-11-07 — PR: claude/rw-input-errors (PR #936: https://github.com/mlococo88/All-Structural/pull/936) (RWIE) — required inputs: "Input error: no results" banner with links, fields marked with their reason, one validation pass by code mode   [behaviour change for blank / invalid input only; valid inputs: no result change]
- **Why:** engineer-approved 2026-11-06 (task 3, review Phase 4a; as CBC #794, LP #744, SF). Before, only f′c, f_y, q_a, η, φ_b, γ_e and a few geometry cases (β ≥ φ, members too thin for cover) stopped the run. Every other blank box was read as 0 by `getInputs` (`parseFloat(…) || 0`), and some invalid values fell back silently: an out-of-range bar override fell back to automatic; a blank distribution length became 0.5 ft (`Math.max(0.5, …)`); a manual δ_b of 0 fell back to ⅔φ; a blank barrier height switched the barrier off.
- **What:**
  - `rwInputErrors()`: one pass over the values as typed. Blank boxes are told apart from 0. It runs by code mode, and conditional fields only when their option is on.
  - Errors stop the run: `window._R = { inp, errors, warnings: [], fatal: true, inputErrors }`, and `calcAll` is not called.
  - REVIEW notes (doubtful values) are shown on the field in amber and do not block.
  - `rwInputMarks()`: an invalid field gets class `err` with `aria-invalid` and the reason under it. The input tab's red dot comes from the existing `refreshInputTabs`.
  - The analysis' own fatal messages (β ≥ φ, member too thin, M-O, …) are marked on their fields too (`rwIeIdOf`).
  - `rwInputErrHTML(r)`: the common banner "Input error: no results." with one linked line per error. It is used by the check summary, every output tab (Overview, Stability, Stem, Footing, Rebar, Analysis diagram, 3D), the Drawings ("no drawings") and the Report ("no report"). Before, each showed red "⚠ <message>" alerts with no link.
  - `rwIeGoto(id)` (the link) does the following, in order:
    - opens the drawer on a phone;
    - clears the finder;
    - switches the input tab;
    - opens the card if it is closed;
    - scrolls to the field and focuses it.
- **Rules.** Errors are for blank or clearly invalid values only; there are no engineering-judgment limits.
  - **Required (blank is an error):**
    - H_s, or H_low / H_high when the wall varies in height (H_high must be ≥ H_low);
    - t_f, t_s,base, t_s,top (> 0);
    - L_t, L_h (≥ 0; "0 for no toe / heel");
    - f′c, f_y, γ_c (> 0);
    - stem and footing cover (≥ 0, and less than t_s / t_f);
    - γ_s (> 0);
    - φ (0 < φ < 90°);
    - q_a (> 0), unless AASHTO with a manual q_R;
    - custom μ (> 0) when chosen;
    - key depth d_k (> 0) when the shear key is on;
    - top-of-wall and water elevations, in elevation mode;
    - distribution length (> 0) when any column load is non-zero;
    - barrier h (> 0) and w or t (> 0) when the barrier is on;
    - AASHTO: q_R (> 0) when manual; h_eq (≥ 0) when manual with LS on; δ_b (0 < δ_b < 90°) when the base friction is manual;
    - AASHTO collision: F_t, L_t (> 0), h_CT (≥ 0), joint spacing (> 0); yield line: M_b, M_w (≥ 0), M_c (> 0);
    - AASHTO interface shear: c (≥ 0), μ, K1, K2, f′c,sub (> 0), dowel bar in the bar table, dowel spacing (> 0).
  - **Optional (blank keeps 0 or its documented default; checked only when entered):**
    - D_f,add, c, q_s, water depth, k_h, δ_MO (≥ 0); k_v (< 1);
    - column D / L / S (≥ 0);
    - γ_w, γ_sat (> 0); γ_sat must not be less than γ_w;
    - η, φ_b, γ_e1, γ_e2, collision φ and e-divisor (> 0); φ_τ, φ_ep, δ (≥ 0).
  - **Bar overrides:** a bar outside #3–#10, a bar without a 3–18 in spacing, or a spacing without a bar is an error. These are the limits `applyOvr` applies; before, such an override silently fell back to automatic.
  - **REVIEW (not blocking):** β < 0; a resistance factor φ_τ, φ_ep or φ_b > 1.
  - Unchanged: the existing `calcAll` validation and warnings (stem top > base stays a warning).
- **Where:**
  - New block before `function onInputChange() {`: `rwInputErrors`, `rwIeIdOf`, `rwInputMarks`, `rwInputErrHTML`, `rwIeGoto`, and a delegated click on `.rwie-go`.
  - In `onInputChange`: before, `const r = calcAll(inp);`. After: `rwInputMarks(IE); const r = IE.E.length ? { inp, errors: …, fatal: true, inputErrors: IE.E } : calcAll(inp);` and the marks for `calcAll`'s fatal messages.
  - The fatal branches of `renderOverview`, `renderStability`, `renderStem`, `renderFooting`, `renderRebar`, `renderDiagram`, `render3D`, `renderRwReport`, `rwdwRender` and `rwDashRender`: before, ``r.errors.map(e=>`<div class="alert fail">⚠ ${e}</div>`).join('')``. After: `rwInputErrHTML(r)`.
  - CSS `.rwie-box`, `.rwie-msg`, `input.rwie-rv`.
- **Formulas, factors, units, code references:** none changed. Pass/fail logic changes only in that results are withheld for invalid input (§4: behaviour change for invalid input only, as LP #744).
- **Saved data (§5):** no key or format change. An older project saved with a blank or invalid value opens on the banner, with the field marked (tested: autosave with H_s and f′c blank).
- **Check case:** default project: no banner, no mark, results as before. H_s blank: "Input error: no results. Stem Height Hs: enter a value." on every tab; the link focuses H_s.
- **How verified:**
  - origin/main vs branch, eight valid cases (as RW3F): `_R`, Export JSON, every localStorage key, Report and tab text, DXF **identical**. The f′c-blank case differs only by the new banner text and the added `inp` / `inputErrors`.
  - New smoke test `tests/smoke/retaining-wall-checks.mjs`: 14 cases plus the old-save case, each with the banner on all nine output views, the field marked, the link focusing the field, and 0 console errors. A further 25-case scratch run covered every rule group.
  - Screenshots at 1400 and 390 looked at.
- **Other copies:** none.
- **Decisions (pending engineer review):**
  - A blank "none-type" input (loads, cohesion, surcharge, seismic, water depth) stays 0 and is not an error. Geometry, materials and q_a must be entered.
  - The REVIEW list is kept short: β < 0 and φ > 1.
- **Observation (not changed):** `getInputs` applies the variable-height rule (H = H_lo + 0.75(H_hi − H_lo)) whenever its box is ticked, also in ACI mode, where the card is hidden.

## 2026-11-07 — PR: claude/rw-self-checks (PR #937: https://github.com/mlococo88/All-Structural/pull/937) (RWSC) — self-consistency checks panel under the check summary   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (task 4, review Phase 4b; as Spread Footing's "Self-consistency checks — all n passed").
- **What:** a collapsed `<details>` "Self-consistency checks — all n passed ✓" (or "— k MISMATCH", which opens itself) under the check summary (`#rwSelf` in `#rwDashBox`; hidden while the summary is collapsed or while an input is in error). Each row: the internal check, ✓ OK / ✗ MISMATCH, and the detail with both numbers. Each value is recomputed by an independent path:
  1. B = L_t + t_s + L_h vs B.
  2. Concrete weights from the geometry: footing γ_c·B·t_f; stem as a rectangle (t_top) plus a triangle (t_base − t_top), vs W_ftg, W_stem.
  3. ΣV (service) from those weights and the analysis' soil, surcharge, P_a,v, column, barrier and uplift, vs ΣV.
  4. ΣM about the toe: resisting moment with the stem centroid by the rectangle + triangle decomposition (not the trapezoid-centroid formula); overturning from each lateral force × its arm. Compared with M_s and M_o.
  5. x̄ = (M_s − M_o) / ΣV and e vs the shown x̄, e.
  6. Bearing diagrams: for every combination of the Stability tab's bearing selector, the drawn pressure block (`rwbpZone`) integrated (∫q dx, the trapezoid area) and its centroid vs that combination's ΣV and x̄.
  7. Stem base, unfactored: the lateral pressure p(z) integrated over the stem height by Simpson's rule (400 strips; earth above / below the water table, water) vs the force-resultant moments `sd_base_Msoil`, `sd_base_Mhyd`.
  8. Stem base, factored: γ_EH·(integrated earth) + γ_WA·(integrated water) + γ_ES·K_a·q_s·H_s²/2 + γ_LS·K_a·q_LL·H_s²/2 vs M_u (Strength I / U = 1.6H), with the analysis' own factors.
  9. A_s of S1, S3, S2, F1, F2, F3: A_b (bar table by bar number) × 12 / s vs A_s,prov.
- **Tolerances:** relative 1e-6 (geometry, sums, moments, bearing; bearing with an absolute floor of 0.5 lb/ft and 1e-4 ft), 1e-4 for the numerical integration.
- **Where:** `rwSelfChecks(r)`, `rwSelfRender(r)` before `function rwDashRender(r) {` (which now calls `rwSelfRender(r)` first); `<div id="rwSelf"></div>` after `#rwDash`; CSS `.rwsc…`. calcAll returns `gEH, gWA` (the stem factors already used for M_u; exposure only).
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Check case** (default ACI wall): 16 checks, all pass. B = 3 + 1.5 + 8 = 12.5 ft. Stem 150·1.0·12 = 1800 + 150·0.5/2·12 = 450 → 2250 lb/ft. ΣV = 16582.5 lb/ft. x̄ = 6.4689 ft. Earth moment at the stem base ∫ = 11520 = ⅓·120·12³/6 lb·ft/ft. M_u = 1.6·11520 = 18432 lb·ft/ft. S1 #4 @ 6: 0.20·12/6 = 0.400 in²/ft.
- **How verified:**
  - origin/main vs branch, eight cases: `_R` identical except the added `gEH`, `gWA`. Export JSON, every localStorage key, Report and tab text, and the DXF are identical.
  - All checks pass in 12 cases: ACI; ACI with water + seismic + column + β + key; triangular bearing; AASHTO with barrier + CT + variable height; AASHTO water + column + η + at-rest; AASHTO rock + CT; a high water table; elevation-mode water; an override; a battered stem; a barrier by geometry.
  - `tests/smoke/retaining-wall-checks.mjs` extended: the panel passes on 5 walls; a ΣV made inconsistent shows MISMATCH and opens; the panel is gone while an input is in error.
  - Screenshots at 1400, 1700 (left column) and 390 looked at.
- **Other copies:** none.
- **Decisions (pending engineer review):**
  - The panel is collapsed when all checks pass and opens on a mismatch, as in SF.
  - It is not in the Report.

## 2026-11-07 — PR: claude/rw-report-overview (PR #938: https://github.com/mlococo88/All-Structural/pull/938) (RWOV) — Report: "Overview of the wall" after the Design summary (3D snapshot, typical section, elevation)   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (task 5, review Phase 5a; as Spread Footing SFOV #780 and CBC #795).
- **What:** a new Report section 2, "Overview of the wall", right after the Design summary. Its subsection "3D view, typical section and elevation" holds three figures:
  1. **3D snapshot.** The 3D model tab's own scene at its default view: the governing bearing combination, unfactored load arrows with value labels, every layer on, no section cut, the Reset-view camera. It is rendered off screen once per result (`rwovSnap3D`, WebGL with `preserveDrawingBuffer`, 1000 × 600, white background). The viewer's 3D state (selection, Factored toggle, layers, cut, opacity, rotation) is put back after the snapshot (tested). When WebGL or three.js is missing, a note says why.
  2. **Typical wall section.** Drawings sheet 1's view only: no border, title block or schedules. It is to scale and dimensioned, with the sheet's own scale bar.
  3. **Wall elevation from the front.** Drawings sheet 4's view only, without the general notes. It shows the variable height when that option is on.
  - Each caption names its source with a link (`[[tab:threed| ↗]]`, `[[tab:drawings| ↗]]`). For the sheet views, the caption gives the sheet number, the sheet scale and "reduced here: use the scale bar or the dimensions".
- **Where:**
  - `rwdwBuild` → `sheet()`: `const ic = D.mark();` after the view is placed (the end of the view, before the border). `sh` gains `ic` and `iv` (`ret.iv`).
  - The notes sheet: `const ivE = D.mark();` after the elevation's scale bar, and `return { known: sbK, iv: ivE };` (before: `return { known: sbK };`).
  - `D.mark()` only reads the length of the display list, so the sheets and the DXF are unchanged.
  - New `RWOV`, `rwovSnap3D`, `rwovView`, `rwovAdd` before `/* RWRP2: the result tabs' Plotly charts…`.
  - `renderRwReport`: `rwovAdd(M, r);` after `rwrAddNotes(M, RWRP.notes);`.
- **Section numbers:** every later section moves up by one (Input parameters is §3, and so on). The step links are by key and still resolve (0 `§?`).
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Saved data (§5):** none. The section is always included. SF has an "Include" box saved in its project; RW has no Include bar and its saved format is unchanged.
- **How verified:**
  - origin/main vs branch, eight cases: `_R`, Export JSON, every localStorage key, the tab text and the **DXF identical**. The Report differs by the new section and the renumbering.
  - 0 console errors; 0 unresolved links.
  - 3D state restore checked: the selection `C:u12`, Factored on and Soil layer off are the same after the snapshot.
  - Screenshots (ACI default; AASHTO with barrier, collision, variable height and key) looked at.
- **Other copies:** none.
- **Decisions (pending engineer review):**
  - No Include box. If you want one, a new prefixed key or project field is needed: ask.
  - The snapshot has a white background (the screen has a dark one) for print.

## 2026-11-07 — PR: claude/rw-report-appendix (PR #939: https://github.com/mlococo88/All-Structural/pull/939) (RWAX) — Report: the Analysis diagram figures in their sections; appendix "Figures of the result tabs"   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (task 5, review Phase 5a: figures in their sections and an appendix of the tab figures, as SF SFRF #779 and CBC #798). Before, the Analysis diagram tab's figures were not in the Report, and nothing listed where each tab figure is.
- **What:**
  - **Figures in their sections:**
    - The service cross-section with the reinforcement and pressure diagrams (`buildCrossSection`, Analysis diagram tab) goes into the lateral-forces step: ACI "Step 2 — Lateral driving forces", AASHTO "Step 3 — Unfactored load components".
    - The collision elevation (`buildElevationSVG`, AASHTO with CT) goes into "Step 7 — Vehicular collision load".
    - Both are placed before the step's "On screen" link, with a caption and a tab link.
  - **Appendix "Figures of the result tabs"** (last, under "Appendices"). One table row per figure of the Report that comes from a result tab:
    - #, the tab (link), the card or sheet, the figure, and "In this report" with a § link to its subsection.
    - Then the views that are on screen only: Drawings sheets 2–3 and the full sheets; the other 3D load cases and combinations, Factored arrows and the cut; the bearing pressure of the other combinations.
    - Each figure is printed once, in the section that works it.
  - Copies of on-screen SVGs get their own ids (`rwaxUniq`: id, url(#…), href="#…"). This also fixes the §3.2 wall section, whose copy duplicated the Overview tab's 8 marker ids (`oh`, `oc`, `m-dn`, …). A hidden duplicate id can leave a copy without arrowheads. After the change: 0 duplicate ids in the page.
- **Where:**
  - New `RWAX_N`, `rwaxUniq`, `rwaxAdd` before `/* RWRP2: the result tabs' Plotly charts…`.
  - `renderRwReport`: `rwaxAdd(M, r);` after `rwovAdd(M, r);`.
  - Subsections holding a tab figure get a key (`fig<s>-<q>`) when they had none, for the § links.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Saved data (§5):** none.
- **How verified:**
  - origin/main vs branch, eight cases: `_R`, Export JSON, every localStorage key, tab text and DXF identical. The Report differs by the two figures and the appendix.
  - 0 `§?`, 0 console errors, 0 duplicate ids (main: 8).
  - Screenshots of the appendix, Step 3 with the cross-section and Step 7 with the collision elevation (AASHTO + CT) looked at.
- **Other copies:** none.
- **Decisions (pending engineer review):**
  - The appendix is a list with links, not a second print of every figure. The figures are in their sections, as SF #779 moved them out of its appendix.
  - Drawings sheets 2–3 are listed as on screen only (Print sheet / Print all).

## 2026-11-07 — PR: claude/rw-report-print (PR #940: https://github.com/mlococo88/All-Structural/pull/940) (RWPR) — Report in print checked (PDF); input echo completed (Project dates, barrier, Coulomb / at-rest / h_eq inputs, bar overrides); print smoke test   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (task 5, review Phase 5a: verify the input echo prints correctly, as SF #781, and that the page breaks print correctly).
- **Print check (PDF, Letter):**
  - ACI (water, column, seismic): 29–30 pages. AASHTO (barrier, CT, variable height, key): 31–32 pages.
  - Rendered page by page and looked at. The report prints alone, with its running header (project no., computed / checked with dates) and "Page n of N".
  - Each section starts as the shared viewer sets it; figures are not split across pages; long tables repeat their header row on the next page (§3.3).
  - 0 KaTeX errors; the page comes back after printing.
  - Nothing to correct in the page breaks: `shared/report.js` is not changed.
- **Input echo:**
  - It printed correctly: no shifted or empty cells. RW builds its echo tables directly and does not copy a tab, so SF's span problem does not arise.
  - It lacked some inputs, now added:
    - §3.1 Project: **Date** and **Checked date** (the Project tab fields; they were only in the title block);
    - §3.2 Wall geometry, with a barrier: how its weight is set (geometry: thickness × height × γ_c, or the entered weight) and its offset from the stem-top centreline;
    - §3.4 Materials and options, AASHTO: Coulomb wall friction δ and wall batter θ (Coulomb); OCR (at-rest); h_eq (LS on);
    - §3.4, both modes: **Bar overrides (Rebar tab)**: the marks overridden ("S1 #6 @ 8 in"), or "none (automatic selection)". Only overrides the analysis applies are listed (#3–#10 at 3–18 in, as `applyOvr`).
- **Where:** `rwrModel`, inputs block:
  - the Project kv rows;
  - the `geo` barrier row;
  - before `subs.push(sub('Materials, cover and design options', …` (the overrides row);
  - before `['Shear method', A.shear_method || 'auto', '–'],` (the AASHTO rows).
- **Test:** `tests/smoke/retaining-wall-checks.mjs` gains the print check, for two walls:
  - Print report with window.print stubbed, print media, page.pdf;
  - the report alone; every section present; the 3D image and the drawn figures;
  - the echo with the dates and overrides; 0 KaTeX errors; ≥ 15 pages; the page restored.
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data:** none.
- **How verified:**
  - origin/main vs branch, eight cases: `_R`, Export JSON, every localStorage key, tab text and DXF identical. The Report differs only by the added echo rows.
  - The smoke test passes, as do the standard tests (see the PR).
- **Other copies:** none.
- **PDFs** (scratch, not committed): `aci.pdf`, `aashto.pdf` from the session scratchpad `rw4/pdf`.

## 2026-11-07 — PR: claude/rw-katex (PR #941: https://github.com/mlococo88/All-Structural/pull/941) (RWKX) — the result tabs' worked steps set by KaTeX; MathJax removed (one maths library)   [display only; no result change]
- **Why:** engineer-approved 2026-11-06 (task 5, review Phase 5b). The page loaded two maths libraries: MathJax 3.2.2 for the tabs, and KaTeX 0.16.9 (approved in #549) for the Report. CLAUDE.md §2: no new library. KaTeX was already loaded, at the pinned version the other apps use.
- **What:**
  - `typesetActivePanel()` now sets every `$$…$$` of the visible panel with `katex.renderToString` (display mode, `throwOnError: false`, `strict: 'ignore'`), on the same TeX source. Before: `MathJax.typesetPromise([panel])`.
  - The MathJax configuration and its script tag are removed: `<script src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js" id="MathJax-main">`.
  - The boot wait `waitMJ` now waits for `window.katex`.
  - The KaTeX CSS / JS tags are unchanged (0.16.9, cdnjs).
- **Differences found and resolved:**
  1. The tool's `.fbox` style (the formula boxes of the ACI cards) also matched KaTeX's `span.fbox`, which draws `\boxed{}`. The boxed results were drawn as empty grey boxes with the value spilling out. Fix: the tool's two rules became `div.fbox` (its three formula boxes are divs).
  2. A "·" inside `\text{…}` (units such as lb·ft/ft) has no text-mode glyph in KaTeX, which printed `\cdotp` in red. MathJax set it as typed. Fix: `rwKxText()` sets each "·" inside `\text{…}` as `\(\mathord{\cdotp}\)` before rendering. Nothing else in the TeX is changed.
  3. KaTeX keeps a hidden MathML copy of each formula, absolutely positioned. With no positioned ancestor it escaped the equation box's own horizontal scroll, and on a 390 px phone the page scrolled sideways (Stability 101 px, Stem 38 px, Footing 3 px; caught by `phone-layout`). Fix: `.eq-math { position: relative; }`.
- **Checks:**
  - Eight walls (ACI and AASHTO; water, seismic, key, passive, column, collision, yield line, interface shear, Coulomb, LS, rock, manual δ_b / q_R): every `.eq-math` of the Stability, Stem and Footing tabs is set by KaTeX. 0 `.katex-error`, 0 red output, no `$$` left, 0 console errors.
  - The tab text with the maths removed is identical, main vs branch.
  - Screenshots before / after (Stability, Stem at 1400; Footing at 390) looked at: the same equations, boxes and line breaks, and the same left start on a phone (PHN).
- **Where:** the `<head>` script tags (`<!-- RWKX … -->`); CSS `.eq-math .katex-display` (was `.eq-math mjx-container[display="true"]`), `div.fbox` ×2; `rwKatex`, `rwKxText`, `typesetActivePanel`; the boot `waitMJ`.
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data:** none.
- **How verified:**
  - origin/main vs branch, eight cases: `_R`, Export JSON, every localStorage key, the Report text and the DXF identical. The tab text differs only in the typeset maths.
  - `tests/smoke/retaining-wall-checks.mjs` gains the KaTeX checks: MathJax not loaded; every equation by KaTeX; 0 errors, 0 red, no `$$`.
- **Other copies:** none.
- **Library:** MathJax 3.2.2 is no longer loaded by this tool (other tools still use it; `tests/libs` unchanged).

## 2026-11-07 — PR: claude/rw-aci-uplift-note — ACI footing design: note that the factored base pressure includes the water uplift (RWUPN; display only, no calculation change) (PR #942: https://github.com/mlococo88/All-Structural/pull/942)

Calculation audit, item 1. Engineer decision (2026-11-07): no calculation change; a one-line note on the Footing design tab and in the Report. Code site tagged `RWUPN`.

### RWUPN. Note in the "Factored Loads on Footing" card, ACI mode with a water table   [display only]
- **Where:** `renderFooting`, the "Factored Loads on Footing" card (anchor `<div class="card-body"><div id="plt-ftg-loads"></div>`).
- **Before:** the card body held only the chart div `plt-ftg-loads`.
- **After:** after the chart div, when `!r.isAASHTO && r.F_uplift > 0`, an `alert info` box: in U = 1.2D + 1.6H and U = 0.9D + 1.6H the factored base pressure q_u is the total contact pressure on the footing underside (soil + water); the uplift U is part of that reaction, so it is not subtracted from ΣV_u and is already in the heel and toe design (the same as splitting it out while the base is in full contact; the AASHTO mode also uses the total pressure). The closing line of the template literal gains the comment `// RWUPN (2026-11-07): ACI uplift note, display only`.
- **Report:** no Report code changed. The Report carries each tab's `.alert` boxes (RWRX, `rwrTabNotes` / `rwrAddNotes`), so the note appears under Footing design → "Notes on the Footing design tab", prefixed with the card title.
- **Why (the audit's reasoning, re-checked):** `calcAll` builds `SumVu` (1.2D + 1.6H) and `SumVu_min` (0.9D + 1.6H) from the downward loads with no −U term, so the trapezoids `qu_*` / `qu_*_min` are the total pressure on the underside. The heel's downward load already uses the saturated soil column (`w_soil_col`). The AASHTO branch does the same on purpose (`V_str_max_tot`, "total vertical").
- **Provision:** ACI 318-19 5.3.8 (H, which per R5.3.8 includes water in soil, at 1.6 / 0.9 / 0) was the basis of the question; nothing is cited in the note.
- **Check case (ACI default, water 6 ft below the top, uniform uplift):** U = 62.4·7.5·12.5 = 5850 lb/ft; SumVu = 20475 lb/ft, e_u = 0.291 ft; heel upward moment M_up (max case) = 48214 lb·ft/ft whether the uplift is in the total pressure (now) or split out (soil reaction from ΣV_u − γ_U·U plus γ_U·u(x)) with γ_U = 1.6 or 0.9; toe M_up 8237 both ways. Heel M_u 19032, toe M_u 7325: unchanged (no calculation change).
- **Open item (found while checking the wording; for the engineer):** the decision's phrase "slightly conservative in partial contact" holds for the heel but not for the toe, so it was left out of the note. Water 2 ft below the top (h_w = 11.5 ft), triangular uplift U = 4485 lb/ft, ACI default otherwise; split-out soil reaction outside the kern:
  - max case γ_U = 1.6: heel M_up 40633 (split) vs 40529 (now): now is conservative; toe M_up 10216 (split) vs 10161 (now): now is 0.5 % unconservative;
  - min case (0.9D + 1.6H) γ_U = 1.6: toe M_up 13256 (split) vs 9234 (now), i.e. toe M_u about 12345 vs 9250; with γ_U = 0.9: 9501 vs 9234 (the max case still governs the toe at 9250).
  - Whether the uplift in the minimum-vertical case takes 1.6 or 0.9 (ACI 5.3.8) is the engineer's call (audit option (b)).

### How verified
- origin/main vs branch, eight walls (ACI default; ACI water uniform; ACI water triangular at 2 ft; ACI water + k_h + column + q_s + β + key + passive; AASHTO with barrier + collision; AASHTO water + column + η 1.05 + at-rest + passive; AASHTO rock + collision (γ_EH,CT 0) + water + β; tall ACI wall with k_h and water): `_R`, Export JSON, every localStorage key and the Report model identical in all eight; the Footing design tab text and the Report text differ only by the note, in the four ACI cases with water; the four other cases identical; 0 console errors.
- Tests: check-syntax, `tests/smoke/retaining-wall-checks.mjs`, phone-layout rwall 390 / 768, project-library retwall, dxf-print-sheets rw: all pass.

## 2026-11-07 — PR: claude/rw-aashto-es-vertical — AASHTO: the dead surcharge on the heel q_s·L_h (ES vertical) enters ΣV (RWES; calculation change) (PR #943: https://github.com/mlococo88/All-Structural/pull/943)

Calculation audit, item 2. Engineer decision (2026-11-07): in AASHTO mode the vertical dead surcharge on the heel is a permanent earth surcharge ES. It takes γ = 1.50 where it adds load (bearing, footing-design pressure) and γ = 0.75 where it resists (sliding, eccentricity). Code sites are tagged `RWES`.

### RWES-1. `calcAll`, AASHTO block: ES vertical in Strength I / Ia   [§4: result change when q_s > 0]
- **Problem:** `V_ES_v` was 0 (comment "surcharge vertical not on heel here"). The lateral ES (`P_ES`, 1.50) and the heel's downward load (`heelCase`, γ_ES 1.50 max / 0.75 min) included q_s, but no vertical sum did. As a result:
  - bearing was unconservative;
  - the heel was loaded with ES and got no matching upward pressure, so it was over-designed;
  - the toe was slightly under-designed;
  - sliding and eccentricity gave no credit for ES (conservative).
  Fix log F5 had recorded this as an assumption.
- **Provision:** AASHTO LRFD 10th Ed. (2024):
  - Table 3.4.1-2: ES maximum 1.50, minimum 0.75.
  - Table 3.4.1-1: one factor for every effect of one load.
  - C11.5.6 / Figs. C11.5.6-1 and -2: permanent loads take maximum factors for bearing and minimum factors for sliding and eccentricity; only the live surcharge over the heel is left out of sliding and eccentricity.
- **Where (anchors):**
  - `const V_ES_v =`
  - `const CMB_S1A =`
  - `const V_resist_min =`
  - `const V_str_min =`
  - `const Mr_str_min =`
  - `const V_str_max_tot =` and its moment line
  - the return line `CMB_S1, CMB_S1A, V_LS_v, x_LSv: xLSv,`
- **Before / after** (`git diff -U0`):
```diff
@@ -2401 +2401,2 @@ function calcAll(inp) {
-    const V_ES_v = 0;                            // (surcharge vertical not on heel here)
+    const V_ES_v = inp.q_sur * inp.Lh;           // RWES (2026-11-07): ES dead surcharge vertical over the heel (permanent; Table 3.4.1-2 ES 1.50 / 0.75), arm x_sur
+    const xESv  = x_sur;
@@ -2429,2 +2430,2 @@ function calcAll(inp) {
-    const CMB_S1A = { DC: 0.90, EV: 1.00, EH: gEH_min };   // Strength Ia, minimum vertical factors (RW3F)
-    const V_resist_min = CMB_S1A.DC*(V_DC + W_bar) + CMB_S1A.EV*Wsoil + CMB_S1A.EH*Pa_tri_v + 0*V_LS_v - V_up;   // min vertical for sliding (net of uplift)
+    const CMB_S1A = { DC: 0.90, EV: 1.00, EH: gEH_min, ES: 0.75 };   // Strength Ia, minimum vertical factors (RW3F); ES min 0.75 (RWES)
+    const V_resist_min = CMB_S1A.DC*(V_DC + W_bar) + CMB_S1A.EV*Wsoil + CMB_S1A.EH*Pa_tri_v + CMB_S1A.ES*V_ES_v + 0*V_LS_v - V_up;   // min vertical for sliding (net of uplift); RWES: + 0.75 ES
@@ -2440,2 +2441,2 @@ function calcAll(inp) {
-    const V_str_min = CMB_S1A.DC*(V_DC + W_bar) + CMB_S1A.EV*Wsoil + CMB_S1A.EH*Pa_tri_v - CMB_S1.WA*V_up;  // min stabilizing vertical (net of uplift)
-    const Mr_str_min = CMB_S1A.DC*(Wftg*x_ftg + Wstem*x_stem + W_bar*x_bar) + CMB_S1A.EH*Pa_tri_v*B + CMB_S1A.EV*Wsoil*x_soil - CMB_S1.WA*M_up;
+    const V_str_min = CMB_S1A.DC*(V_DC + W_bar) + CMB_S1A.EV*Wsoil + CMB_S1A.EH*Pa_tri_v + CMB_S1A.ES*V_ES_v - CMB_S1.WA*V_up;  // min stabilizing vertical (net of uplift); RWES: + 0.75 ES
+    const Mr_str_min = CMB_S1A.DC*(Wftg*x_ftg + Wstem*x_stem + W_bar*x_bar) + CMB_S1A.EH*Pa_tri_v*B + CMB_S1A.EV*Wsoil*x_soil + CMB_S1A.ES*V_ES_v*xESv - CMB_S1.WA*M_up;   // RWES: + 0.75 ES
@@ -2458 +2459 @@ function calcAll(inp) {
-    const V_str_max_tot = eta * (CMB_S1.DC*V_DC + CMB_S1.EV*Wsoil + CMB_S1.EH*Pa_tri_v + CMB_S1.LS*V_LS_v + CMB_S1.DC*W_bar) + V_col;
+    const V_str_max_tot = eta * (CMB_S1.DC*V_DC + CMB_S1.EV*Wsoil + CMB_S1.EH*Pa_tri_v + CMB_S1.LS*V_LS_v + CMB_S1.ES*V_ES_v + CMB_S1.DC*W_bar) + V_col;   // RWES: + 1.50 ES
@@ -2460 +2461 @@ function calcAll(inp) {
-                     + CMB_S1.LS*V_LS_v*xLSv) + V_col*x_col;
+                     + CMB_S1.LS*V_LS_v*xLSv + CMB_S1.ES*V_ES_v*xESv) + V_col*x_col;   // RWES: + 1.50 ES
@@ -2674 +2675 @@ function calcAll(inp) {
-      CMB_S1, CMB_S1A, V_LS_v, x_LSv: xLSv,   // RW3F (2026-11-06): the combination factors and the LS vertical, returned for the 3D view (exposure only)
+      CMB_S1, CMB_S1A, V_LS_v, x_LSv: xLSv, V_ES_v, x_ESv: xESv,   // RW3F (2026-11-06): the combination factors and the LS vertical, returned for the 3D view (exposure only); RWES (2026-11-07): + the ES vertical
```
- **Arms:** the ES arm is `x_sur` (the heel's centre, as for the service surcharge). `η` multiplies the maximum terms (Strength I), as it does for the other loads in `V_str_max_tot`; the minimum terms take no η, as before.
- **What follows from it:**
  - The Strength Ia footing trapezoid (`V_str_min_tot = V_str_min + V_up`) and the Strength I one (`V_str_max_tot`) now include ES.
  - The heel's downward ES (1.50 / 0.75, unchanged and checked) is now matched by the upward pressure.
  - Service I crack control is unchanged in method: `M_serv_heel` already had q_s at 1.0, and `M_serv_toe = |Mu_toe|/1.5` follows the toe.
- **Not changed:**
  - ACI mode.
  - Extreme Event II (`V_ct_min`, `V_ct_max` with 0.5·W_sur), which is audit item 3 and gets its own PR.
  - The stem.

### RWES-2. Display (tabs, Report, Drawings table, 3D)   [shown only when q_s > 0]
- **Stability tab (AASHTO):**
  - Step 3 lists `V_ES = q_s L_h` with its factors.
  - Step 4 R_R reads `+0.75 V_ES`.
  - Step 5 M_r label reads `+ 0.75ES`.
  - Step 6 V_u label reads `+ 1.50ES`, and the Strength Ia label reads `+ 0.75ES`.
- **Report:**
  - Step 3 adds the step `VES` (q_s L_h, arm, Table 3.4.1-2).
  - The R_R, M_r, V_u (max) and Strength Ia labels and equations show the same terms as the tab.
  - The footing-design V_u (Strength I) and V_u (Strength Ia) equations add `+ 1.50 ES_v` / `+ 0.75 ES_v`.
- **Drawings loads table:** the row `ES  SURCHARGE OVER HEEL (VERTICAL)`, factors 1.50 / 0.75.
- **3D view (`rw3Factors`):**
  - the vertical surcharge arrow `SV` takes η·1.50 in Strength I and 0.75 in Strength Ia (before: 0);
  - the Σγ·V = R check therefore still closes;
  - Extreme Event II is unchanged (item 3).

### Check case (AASHTO default + q_s = 250 psf; B = 12.5 ft, L_h = 8 ft, η = 1)
- **ES vertical:**
  - V_ES = 250 · 8 = 2000 lb/ft
  - arm x = L_t + t_s + L_h/2 = 3 + 1.5 + 4 = 8.5 ft
- **Bearing, Strength I:**
  - V = 26878 + 1.50 · 2000 = 29878 lb/ft
  - M_r = 206866 + 1.50 · 2000 · 8.5 = 232366 lb·ft/ft
  - x̄ = (232366 − 54971)/29878 = 5.937 ft, so e = 0.313 ft (before 0.599)
  - B′ = 12.5 − 2(0.313) = 11.875 ft
  - q_u = 29878/11.875 = 2516 psf (before 2378); D/C 0.480 → 0.508
- **Sliding:**
  - V_min = 16076 + 0.75 · 2000 = 17576 lb/ft
  - R_R = 17576 · tan 20° = 6397 lb/ft (before 5851)
  - D/C = 9966/6397 = 1.558 (before 1.703; still FAIL)
- **Eccentricity:**
  - M_r = 121098 + 0.75 · 2000 · 8.5 = 133848 lb·ft/ft
  - x̄ = (133848 − 54971)/17576 = 4.488 ft
  - e = 1.762 ft (before 2.137; limit B/4 = 3.125)
- **Heel:**
  - Before, the Strength I case governed: w_u = 1.35(1440) + 1.25(225) + 1.50(250) + 1.75(357) = 3225 psf; M_down = 103200, M_up = 57470 (q 2323 → 1532 psf), so M_u = 45730 lb·ft/ft, #6 @ 7.
  - After, the Strength Ia case governs: w_u = 1.00(1440) + 0.90(225) + 0.75(250) = 1830 psf; M_down = 58560, M_up = 23173 (q 1739 → 217 psf), so M_u = 35387 lb·ft/ft, #5 @ 6.
  - The Strength I case after: q 2491 → 2031 psf, so M_u = 33301.
- **Toe:** M_u 11101 → 11201 lb·ft/ft (#4 @ 10 unchanged).
- **At q_s = 0 nothing changes.**

### Saved data
- No new field and no key change.
- AASHTO projects with q_s > 0 give the new results when opened (this is the fix; no migration, by the engineer's decision).

### How verified
- The tool's own `calcAll` was run in Node, main vs branch, for:
  - AASHTO q_s 0 and 250;
  - q_s 250 + water;
  - q_s 250 + η 1.05 + rock;
  - ACI q_s 250.
  The numbers are above. ACI is identical. The briefing's values (audit item 2, option A) are reproduced.
- origin/main vs branch in headless Chromium, ten walls:
  - **The eight audit walls** (ACI default; ACI water uniform; ACI water triangular; ACI water + k_h + column + q_s 250 + β + key + passive; AASHTO barrier + collision; AASHTO water + column + η 1.05 + at-rest + passive; AASHTO rock + collision + water + β; tall ACI + k_h + water):
    - `_R` is identical except the three added fields `aashtoR.V_ES_v`, `x_ESv`, `CMB_S1A.ES`;
    - Export JSON, every localStorage key, tab text and Report text are identical;
    - 0 console errors.
  - **AASHTO q_s 250, and AASHTO q_s 250 + water + collision + η 1.05:** results change as above; the EE II values (`aashtoR.ct`) are unchanged.
- Tests: check-syntax, smoke/retaining-wall-checks (self-consistency panel passes), phone-layout rwall 390/768, project-library retwall, dxf-print-sheets rw.

## 2026-11-07 — PR: claude/rw-aashto-ee2-ct — AASHTO Extreme Event II (collision) stability: LS instead of the dead surcharge for bearing, ES vertical in the resisting load, water at WA = 1.0, lateral ES with the EH choice (RWCT; calculation change) (PR #944: https://github.com/mlococo88/All-Structural/pull/944)

Calculation audit, item 3. Engineer decision (2026-11-07). Code sites are tagged `RWCT`.

### RWCT-1. `calcAll`, AASHTO collision block (`ct.ee2`)   [§4: result change when collision is on]
- **Problems:**
  - Bearing added 0.5 × the **dead** surcharge q_s·L_h (`gLS_ct * Wsur`, and `gLS_ct*Ms_sur` in the moment). It should be 0.5 × the live surcharge q_LL·L_h.
  - The resisting vertical left out ES (q_s·L_h).
  - The hydrostatic force was multiplied by γ_EH,CT, so the MassDOT option (γ_EH,CT = 0) dropped the water.
  - The lateral ES was never in the driving force.
- **Provision:**
  - AASHTO LRFD 10th Ed. (2024) Table 3.4.1-1, Extreme Event II: γp = 1.00 for the permanent loads; LL / LS 0.50; WA 1.00. 3.4.1 explains the minimum for CT. C11.5.6 says WA is always 1.0.
  - MassDOT Bridge Manual 3.3.2.4 (paraphrased): for stability under collision, the retained soil's earth pressure need not be applied, because the wall moves away from the backfill. The text speaks of earth pressure only.
- **Engineer's choices:**
  - (a) bearing V = V_min + 0.50·V_LS (moment + 0.50·V_LS·x_LS);
  - (b) V_min + 1.00·V_ES (moment + V_ES·x_ES);
  - (c) P_hyd and U at WA = 1.00 in every case. U was already at 1.00 in V_min; P_hyd changes;
  - (d) lateral P_ES at γ_EH,CT: 0 with MassDOT, 1.00 with "full".
  The stem's Extreme Event II case is unchanged; it was already consistent.
- **Before / after** (`git diff -U0`):
```diff
@@ -2586 +2586,3 @@ function calcAll(inp) {
-      const CMB_EE2 = { CT: 1.00, DC: 1.00, EV: 1.00, EH: gEH_ct, LS: gLS_ct, WA: 1.00 };   // Extreme Event II factors (RW3F)
+      const CMB_EE2 = { CT: 1.00, DC: 1.00, EV: 1.00, EH: gEH_ct, LS: gLS_ct, WA: 1.00, ES: gEH_ct, ESv: 1.00 };   // Extreme Event II factors (RW3F)
+      // RWCT (2026-11-07): water (P_hyd, U) at WA = 1.00 always; lateral ES follows the EH choice (ES = γ_EH,CT);
+      // ES vertical q_s·L_h is permanent at γp = 1.00 (Table 3.4.1-1 EE II); LS vertical q_LL·L_h at γ_LS = 0.50 on the bearing side only.
@@ -2592 +2594 @@ function calcAll(inp) {
-                       + gEH_ct * (P_EH + P_hyd)
+                       + gEH_ct * P_EH + CMB_EE2.WA * P_hyd + CMB_EE2.ES * P_ES   // RWCT: water no longer × γ_EH,CT; + ES lateral
@@ -2596,2 +2598,2 @@ function calcAll(inp) {
-      const V_ct_min = CMB_EE2.DC*(Wftg + Wstem + W_bar) + CMB_EE2.EV*(Wsoil + Pa_tri_v) - CMB_EE2.WA*F_uplift;
-      const V_ct_max = V_ct_min + gLS_ct * Wsur;
+      const V_ct_min = CMB_EE2.DC*(Wftg + Wstem + W_bar) + CMB_EE2.EV*(Wsoil + Pa_tri_v) + CMB_EE2.ESv*V_ES_v - CMB_EE2.WA*F_uplift;   // RWCT: + 1.00 ES vertical
+      const V_ct_max = V_ct_min + gLS_ct * V_LS_v;   // RWCT: + 0.50 LS vertical (was 0.50·W_sur, the dead surcharge)
@@ -2608 +2610 @@ function calcAll(inp) {
-                  + gEH_ct * (P_EH*y_EH + P_hyd*(hw/3))
+                  + gEH_ct * P_EH*y_EH + CMB_EE2.WA * P_hyd*(hw/3) + CMB_EE2.ES * P_ES*y_ES   // RWCT: as H_drive_ct
@@ -2610 +2612 @@ function calcAll(inp) {
-      const Mr_ct = CMB_EE2.DC*(Ms_ftg + Ms_stem + Ms_bar) + CMB_EE2.EV*(Ms_soil + Ms_Pv) + CMB_EE2.WA*Ms_uplift;
+      const Mr_ct = CMB_EE2.DC*(Ms_ftg + Ms_stem + Ms_bar) + CMB_EE2.EV*(Ms_soil + Ms_Pv) + CMB_EE2.ESv*V_ES_v*xESv + CMB_EE2.WA*Ms_uplift;   // RWCT: + 1.00 ES vertical
@@ -2617 +2619 @@ function calcAll(inp) {
-      const x_R_brg_ct = V_ct_max > 0 ? (Mr_ct + gLS_ct*Ms_sur - Mo_ct) / V_ct_max : B/2;
+      const x_R_brg_ct = V_ct_max > 0 ? (Mr_ct + gLS_ct*V_LS_v*xLSv - Mo_ct) / V_ct_max : B/2;   // RWCT: 0.50 LS vertical (was 0.50·M_s,sur)
```
- **Uses item 2's terms:** `V_ES_v`, `xESv` (RWES), `V_LS_v`, `xLSv`, `P_ES`, `y_ES`.

### RWCT-2. Display   [display]
- **Stability tab, Step 7b:**
  - The driving force shows `+ 1.0 P_ES` (with "full") and `+ 1.0 P_WA` when present.
  - The resisting V shows `+ 1.0 V_ES` and `− 1.0 U` (the uplift was in the value but not shown before).
  - A new line shows the bearing vertical: V_max = V + 0.50·V_LS.
  - The Meyerhof line now reads q_u = V_max/B′.
- **The MassDOT alert:** the quoted manual sentence was replaced by a paraphrase (brief: no manual text). It now also says that water stays at γ_WA = 1.0 and that the vertical dead loads, ES included, stay at 1.0. The "full" alert mentions ES and water.
- **Report, Step 7b:**
  - Same terms in Q and V.
  - A new step `Vmax`.
  - The Meyerhof substitution now uses V_ct,max. Before, it substituted V_ct,min although the value shown was q from V_ct,max: a display error, now fixed.
- **3D view (`rw3Factors`, `ee2`):**
  - water lateral takes WA (it was the EH factor);
  - ES lateral takes γ_EH,CT (it was 0);
  - LS vertical takes 0.50 (it was 0);
  - the vertical surcharge arrow (q_s·L_h) takes 1.00 (it was 0.50).
  So Σγ·V = V_ct,max.

### Check cases (AASHTO default; collision TL-4: 28 kip over L_joint = 41 ft, so CT = 0.683 k/ft at 30 in above the top of the stem)
- **Default (q_s = 0, no water), MassDOT γ_EH = 0.** Only bearing changes:
  - V_LS = 357·8 = 2856 lb/ft;
  - V_max = 16583 + 0.5·2856 = 18011 (before 16583);
  - e = −0.383 ft (before −0.222), B′ = 11.734 ft;
  - q = 18011/11.734 = 1535 psf (before 1375); D/C vs 9000 psf = 0.171 (before 0.153);
  - sliding D/C 0.246 and e −0.222 ft are unchanged.
- **q_s 250, water 6 ft below the top (P_hyd = 1755, U = 5850 lb/ft), MassDOT:**
  - H = 1486 + 1.0·1755 = 3241 (before 1486);
  - V_min = 11213 + 2000 = 13213 (before 11213);
  - R = 13213·tan 20° = 4809;
  - sliding D/C 0.364 → 0.674;
  - M_o 16349 → 20736; M_r 91191 → 108191; e −0.425 → −0.369 ft (limit 4.167);
  - V_max 12213 → 13213 + 0.5·2856 = 14641; q 1076 → 1285 psf.
- **The same with γ_EH = "full":**
  - H = 6395 → 6395 + 1125 (P_ES) = 7520;
  - sliding D/C 1.567 → 1.564 (still FAIL);
  - e 1.320 → 1.354 ft;
  - q 1169 → 1395 psf.
- **Stem M_u:** unchanged in all cases (32274 / 42577 lb·ft/ft).
- **Pass / fail change seen in the comparison walls:** AASHTO rock + collision (MassDOT) + water 4 ft below the top + β 10°. The water now drives at 1.0 (P_hyd = 2816 lb/ft): H 1683 → 4499 lb/ft against R = 3850, so the Extreme Event II sliding D/C goes 0.437 → **1.169 (PASS → FAIL)**. e goes −0.535 → 0.308 ft and q 1063 → 962 psf.

### Open item (not changed; for the engineer)
- With the MassDOT option, the vertical component of the earth thrust P_a,V (sloped backfill or Coulomb δ > 0) is still credited at 1.00 in V_ct,min, while the horizontal component is dropped. This is unconservative where P_a,V > 0. Should P_a,V follow γ_EH,CT?

### How verified
- The tool's `calcAll` was run in Node, main vs branch: the three cases above, the default with "full", and q_s 250 on rock. They reproduce the audit briefing's values.
- **origin/main vs branch, headless Chromium, ten walls** (the eight audit walls plus AASHTO q_s 250 + water + CT + η 1.05, and the same with γ_EH "full"):
  - walls without collision: `_R`, Export JSON, every localStorage key, tab and Report text identical;
  - walls with collision: only `aashtoR.ct.ee2` values and the Step 7b / status / Report text change, as above. The stem is unchanged.
  - 0 console errors.
- The self-consistency panel passes, and the 3D Σγ·V equals V_ct,max, on four collision walls (default, q_s + water MassDOT / full, rock + water + β).
- Tests: check-syntax, smoke/retaining-wall-checks, phone-layout rwall 390/768, project-library retwall, dxf-print-sheets rw.

### Saved data
- No field or key change.
- AASHTO projects with collision on give the new Extreme Event II results. This is the fix, by the engineer's decision.

## 2026-11-07 — PR: claude/rw-aashto-ls-distance — AASHTO live-load surcharge: numeric distance to traffic, the H/2 applicability rule, traffic direction (walls / abutments table) (RWLS; calculation change) (PR #945: https://github.com/mlococo88/All-Structural/pull/945)

Calculation audit, item 3b. Engineer decision (2026-11-07). The approach-slab option was declined. Code sites are tagged `RWLS`.

### RWLS-1. Inputs (Traffic pane, "Live-load surcharge")   [saved data: additive]
- **`aashto_heq_dist`:**
  - It was a `<select>` with values "0" (traffic at the wall) and "1" (≥ 1.0 ft). It is now a number input in ft, with **the same id and saved field**.
  - Old saves hold "0" or "1" and give the same h_eq: 0 ft gives the 0-ft column and 1 ft gives the 1-ft column (2.0 ft). So no migration is needed. This was proven in a browser (below).
- **New `aashto_traffic_dir`:**
  - Values: "parallel" (Table 3.11.6.4.1-2, the default, which is today's behaviour) or "perpendicular" (Table 3.11.6.4.1-1, abutments).
  - It is saved only when it is not the default (`RWLS_DEF` in `snapshotFields` / `restoreFields`). Old projects therefore save, autosave and export exactly as before, and a save without it opens as "parallel".
  - `getInputs` puts `traffic_dir` in `inp.aashto` only when it is "perpendicular".
- **Other input changes:**
  - The h_eq Source option now reads "Auto from wall height and distance (Tables 3.11.6.4.1-1 / -2)".
  - A new line under the distance input (`hint_ls_req`, from `rwLsHint`) shows the H/2 test and the h_eq in use.
  - RWIE: the distance is required (≥ 0) when LS is on with Auto h_eq.

### RWLS-2. `heqAASHTO` / `calcAll`   [§4]
- **Provision (verified in the 10th Ed. PDF; paraphrased):** AASHTO LRFD 10th Ed. (2024) Art. 3.11.6.4.1.
  - LS is applied where vehicular load can act on the backfill within one-half the wall height behind the back face.
  - h_eq may be taken from Table 3.11.6.4.1-1 (abutments perpendicular to traffic: 4.0 / 3.0 / 2.0 ft at 5 / 10 / ≥ 20 ft) or Table 3.11.6.4.1-2 (walls parallel to traffic: 0-ft column 5.0 / 3.5 / 2.0; "1.0 ft or further" 2.0 / 2.0 / 2.0).
  - Linear interpolation on height.
  - The height is measured from the backfill surface to the footing bottom.
  - (The coordinator's message used the older numbering "3.11.6.4-1/-2". The 10th Ed. numbers them 3.11.6.4.1-1/-2, as the tool does.)
- **Rules:**
  - Height: H = H_s + t_f, as before.
  - Parallel table: d ≥ 1 ft takes the 1-ft column. 0 < d < 1 ft is linear between the two columns. That is the engineer's decision; the table gives only the two columns.
  - Abutment table: d does not enter.
  - H/2 rule: with Auto h_eq and d > H/2, LS is not required. h_eq = 0, so P_LS = 0 and V_LS = 0 in every limit state (Strength, the EE II LS terms of RWCT, the stem, service). It is noted on the tab and in the Report.
  - At d = H/2, LS is still required.
  - The checkbox stays the off switch.
  - A **manual h_eq is the user's override** and is applied whatever the distance; the hint notes that d > H/2.
- **Before / after** (`git diff -U0`, inputs and calculation):
```diff
@@ -1876,3 +1881,3 @@ function calcK_AASHTO(method, cond, phi, delta, beta, batter, ocr) {
-/** AASHTO LL surcharge equivalent soil height h_eq (ft)
- *  Table 3.11.6.4.1-2 (walls parallel to traffic) — interpolated by wall height H (ft).
- *  Distance to traffic 0 ft: ≤5 ft → 5.0; 10 ft → 3.5; ≥20 ft → 2.0.  ≥1 ft: 2.0.
+/** AASHTO LL surcharge equivalent soil height h_eq (ft), AASHTO LRFD 10th Ed. Art. 3.11.6.4.1
+ *  Table 3.11.6.4.1-2 (walls parallel to traffic): 0-ft column 5.0 / 3.5 / 2.0 at H = 5 / 10 / ≥20 ft; ≥ 1 ft: 2.0.
+ *  Table 3.11.6.4.1-1 (abutments perpendicular to traffic): 4.0 / 3.0 / 2.0.  Linear on H.
@@ -1880,6 +1885,15 @@ function calcK_AASHTO(method, cond, phi, delta, beta, batter, ocr) {
-function heqAASHTO(H_ft, dist_ft=0) {
-  // AASHTO Table 3.11.6.4.1-2 (retaining walls, traffic parallel to wall):
-  //   distance wall back face → edge of traffic = 0 ft : 5.0 / 3.5 / 2.0 ft at H = 5 / 10 / ≥20 ft
-  //   distance ≥ 1 ft                                  : 2.0 ft for all heights
-  if (dist_ft >= 1) return 2.0;
-  const pts = [[5, 5.0], [10, 3.5], [20, 2.0]];
+// RWLS (2026-11-07): the table's columns at wall height H (ft), interpolated linearly on H (Art. 3.11.6.4.1):
+//   'parallel'      Table 3.11.6.4.1-2 (retaining walls, traffic parallel): c0 = the 0-ft column, c1 = the "1.0 ft or further" column;
+//   'perpendicular' Table 3.11.6.4.1-1 (abutments, traffic perpendicular): 4.0 / 3.0 / 2.0 ft at H = 5 / 10 / ≥20 ft (no distance column).
+function heqCols(H_ft, dir) {
+  const ab = dir === 'perpendicular';
+  const c0 = heqInterpH(H_ft, ab ? [[5, 4.0], [10, 3.0], [20, 2.0]] : [[5, 5.0], [10, 3.5], [20, 2.0]]);
+  return { c0, c1: ab ? c0 : 2.0, tbl: ab ? 'Table 3.11.6.4.1-1' : 'Table 3.11.6.4.1-2' };
+}
+// h_eq for a distance d (ft) from the back face to the edge of traffic. Parallel table: d ≥ 1 ft → the 1-ft column; 0 < d < 1 ft →
+// linear between the 0-ft and 1-ft columns (engineer decision 2026-11-07; the table gives the two columns only). Abutment table: no d.
+function heqAASHTO(H_ft, dist_ft=0, dir='parallel') {
+  const c = heqCols(H_ft, dir), d = Math.max(0, +dist_ft || 0);
+  return d >= 1 ? c.c1 : c.c0 + (c.c1 - c.c0) * d;
+}
+function heqInterpH(H_ft, pts) {
@@ -2148,2 +2162,9 @@ function calcAll(inp) {
-  const heq = isAASHTO && A.ll_surcharge
-    ? (A.heq_mode === 'manual' ? A.heq : heqAASHTO(H, A.heq_dist || 0))
+  // RWLS (2026-11-07): Art. 3.11.6.4.1 requires LS where vehicular load can act on the backfill within H/2 behind the back face
+  // (H = backfill surface to footing bottom, as the table lookup). Auto h_eq: beyond H/2 → LS not required (h_eq = 0, noted);
+  // a manual h_eq is the user's override and is applied whatever the distance. The checkbox stays the off switch.
+  const ls_dir  = A.traffic_dir === 'perpendicular' ? 'perpendicular' : 'parallel';
+  const ls_dist = Math.max(0, A.heq_dist || 0), ls_half = H / 2;
+  const ls_auto_off = isAASHTO && !!A.ll_surcharge && A.heq_mode !== 'manual' && ls_dist > ls_half;
+  const ls_on = isAASHTO && !!A.ll_surcharge && !ls_auto_off;
+  const heq = ls_on
+    ? (A.heq_mode === 'manual' ? A.heq : heqAASHTO(H, ls_dist, ls_dir))
@@ -2664 +2685 @@ function calcAll(inp) {
-      eta, heq, q_ll_aashto,
+      eta, heq, q_ll_aashto, ls_on, ls_auto_off, ls_dir, ls_dist, ls_half,   // RWLS: LS applicability and table (exposure)
@@ -3575,0 +3597 @@ function getInputs() {
+      ...(s('aashto_traffic_dir') === 'perpendicular' ? { traffic_dir: 'perpendicular' } : {}),   // RWLS (2026-11-07): Table 3.11.6.4.1-1; absent = 'parallel' (Table 3.11.6.4.1-2), as before
@@ -5669,0 +5706 @@ const RWTB_FIELDS = ['proj_date', 'proj_chkdate'];   // RWTB (2026-11-06): the o
+const RWLS_DEF = { aashto_traffic_dir: 'parallel' };   // RWLS (2026-11-07): saved only when not the default; absent → the default
@@ -5678,0 +5716 @@ function snapshotFields() {
+  Object.entries(RWLS_DEF).forEach(([id, d]) => { if (out[id] === d) delete out[id]; });   // RWLS: old saves and default projects unchanged
@@ -5686,0 +5725 @@ function restoreFields(fields) {
+  Object.entries(RWLS_DEF).forEach(([id, d]) => { if (!(id in fields)) { const el = document.getElementById(id); if (el) el.value = d; } });   // RWLS
@@ -6025,0 +6065 @@ function rwInputErrors() {
+    if (on('aashto_ll_surcharge') && sel('aashto_heq_mode') !== 'manual') need('aashto_heq_dist', ge0);   // RWLS: numeric distance
```

### RWLS-3. Display   [display]
- **Stability tab, Step 2:**
  - The card reference names the table in use.
  - The H/2 test is worked: d vs H/2, with "LS required" or "LS not required".
  - The h_eq lookup is worked: the two columns at H and the interpolation in d.
  - With d > H/2 a note replaces the q_LS line.
  - P_LS in Step 3 now shows only when LS is applied (`a.ls_on`).
- **Report:**
  - The input echo gives the LS state, and the traffic direction and distance.
  - Step 2 has the step `half` (H/2), and an h_eq step with the columns and the interpolation.
  - P_LS shows only when applied.
- **Cross-section tooltip and references list:** they name the table in use / both tables.

### Check cases (AASHTO default: H = 13.5 ft, so H/2 = 6.75 ft; γ_s 120)
| Case | h_eq | Sliding D/C | e (ft) | q (psf) | Stem M_u / bar | Heel M_u | Toe M_u |
|---|---|---|---|---|---|---|---|
| d = 0, parallel (= main) | 3.5 + (2.0 − 3.5)(13.5 − 10)/10 = **2.975** | 1.415 | 1.428 | 2212 | 32274 / #5@7 | 27580 | 9447 |
| d = 1 (= main "≥ 1 ft") | 2.0 | 1.257 | 1.041 | 2047 | 27360 / #5@9 | 23198 | 8490 |
| d = 0.5 (new, interpolated) | 2.975 + (2.0 − 2.975)(0.5) = **2.4875** | 1.336 | 1.235 | 2130 | 29817 / #5@8 | 25389 | 8969 |
| d = 6.75 = H/2 | 2.0 (LS required) | 1.257 | 1.041 | 2047 | 27360 / #5@9 | 23198 | 8490 |
| **d = 8 > H/2** (main: h_eq 2.0) | **0** (LS not required) | 1.257 → **0.934** (FAIL → PASS) | 1.041 → **0.248** | 2047 → **1790** | 27360 #5@9 → **17280 #4@7** | 23198 → **14211** | 8490 → **6526** |
| Abutment table, any d ≤ H/2 (new) | 3.0 + (2.0 − 3.0)(3.5/10) = **2.65** | 1.362 | 1.299 | 2157 | 30636 / #5@8 | 26119 | 9128 |

- At d = 8 ft, compared with main's d = 0 setting: sliding 1.415 → 0.934, stem #5@7 → #4@7, heel 27580 → 14211, toe 9447 → 6526. These are the audit briefing's values, reproduced.
- **With collision on (TL-4, MassDOT), d = 8:**
  - the EE II LS terms drop out: H_drive 1223 → 683, V_ct,max 17543 → 16583, q 1508 → 1454 psf;
  - the stem's EE II case then governs: 21422 lb·ft/ft, #4@6.
  - At d = 0, EE II is unchanged (1486 / 18011 / 1535).

### How verified
- The tool's `calcAll` was run in Node, main vs branch: d = 0 and d = 1 are identical to main in every value above. The new cases are in the table.
- **Old saves:** autosaves made by **main** (AASHTO with d "1"; d "0" with collision + q_s 250; manual h_eq 3 with d "1") were opened in the branch.
  - The distance input shows 0 / 1 and the direction is "parallel".
  - `_R` is identical except the added `ls_*` fields.
  - The autosave has no `aashto_traffic_dir`.
  - 0 console errors.
- **Restore:** a save with "perpendicular" round-trips (h_eq 2.65). A save without the field, opened after it, resets to "parallel" (h_eq 2.975). "parallel" is not written to the save.
- **origin/main vs branch, headless Chromium, eleven walls** (the eight audit walls, AASHTO d "1" + collision, AASHTO q_s 250 + water + collision ± "full"):
  - Every computed value is identical. `_R` differs only by the added `aashtoR.ls_on`, `ls_auto_off`, `ls_dir`, `ls_dist`, `ls_half`.
  - Export JSON and every localStorage key are identical.
  - ACI tab and Report text are identical. The AASHTO Stability tab and Report text differ by the new Step 2 lines.
  - 0 console errors.
- Screenshots looked at: d = 8 (not required), d = 0.5 (interpolated), abutment.
- Tests: check-syntax, smoke/retaining-wall-checks, phone-layout rwall 390/768, project-library retwall, dxf-print-sheets rw. All pass.

### Saved data
- `aashto_heq_dist` keeps its id and its values; old "0" / "1" give the same h_eq.
- `aashto_traffic_dir` is additive and saved only when "perpendicular".
- A project whose real traffic edge is beyond H/2 changes only once the user enters the real distance. Old saves hold 0 or 1 ft and keep their results.

## 2026-11-07 — PR: claude/rw-varheight-both-modes — Variable-height wall offered in both modes; the locked Stem Height box shows why (RWVH; display only, no result change) (PR #946: https://github.com/mlococo88/All-Structural/pull/946)

Calculation audit, item 4. Engineer decision (2026-11-07): offer the variable-height wall in both modes. Code sites are tagged `RWVH`.

### RWVH. Variable-height card, Stem Height lock, drawings   [display only]
- **Problem:** `getInputs` applied the variable height in **both** modes (`Hs = vh_enable ? H_lo + 0.75(H_hi − H_lo) : Hs`). The card (`sec-vh`) was `.aashto-only`, so it was hidden in ACI mode. An ACI project with the box ticked (ticked while in AASHTO mode) used a design height the user could not see. The Stem Height box was also locked with no reason given.
- **Changes:**
  - The card header and body (`sec-vh`) are no longer `.aashto-only`. The tag reads "MassDOT".
  - The card's note gains a sentence shown in ACI mode only (`.aci-only`): this is a MassDOT owner rule for variable-height segments (paraphrased), not an ACI 318 provision, and in ACI mode it is applied because it is ticked.
  - New line `hint_hs_vh` under the Stem Height / Footing Thickness row, shown while the box is ticked. It reads "Set by Variable-height wall below: design H_s = H_lo + 0.75(H_hi − H_lo) = … ft (MassDOT §3.3.2.2). This box is not used while it is ticked." The box also gets a title.
  - The line is filled by the new `rwVhHint()`, called from `onVHChange`, `syncConditionalUI` and `onInputChange`.
  - Drawings, "Wall elevation and general notes" sheet: `const vh = isA && inp.vh_enable` → `const vh = !!inp.vh_enable`. The elevation draws the sloping top and "VARIABLE HEIGHT" in ACI mode too.
  - The Report's overview figure caption for the elevation: `r.isAASHTO && r.inp.vh_enable` → `r.inp.vh_enable`.
  - The Report input echo (Stem height with "(variable height: H_lo + 0.75(H_hi − H_lo), MassDOT §3.3.2.2)") and the RWIE validation were already not gated by mode. They are unchanged.
- **Where the 0.75 rule comes from (verified):** MassDOT Bridge Manual (Hundredth Anniversary Ed.) 3.3.2.2, cantilever walls. Variable-height segments are designed, stem plus footing, for the low-end height plus 75 % of the difference between the low and high ends.
  - It is an owner (MassDOT) rule; neither ACI 318-19 nor AASHTO LRFD has it.
  - The manual states it on the total wall height. The tool applies it to the stem height. With a constant footing thickness this is the same, because t_f cancels in H_lo + 0.75(H_hi − H_lo).
- **Provision changed:** none. No formula, factor or default changed.

### Check case
- ACI default with variable height ticked, H_lo 8 ft / H_hi 16 ft: design H_s = 8 + 0.75·8 = 14.0 ft.
- Results are the same on main and the branch: FS_SL 1.43 FAIL, stem flexure D/C 0.91.
- The only difference is that the card, the reason line and the elevation are now visible in ACI mode.

### How verified
- origin/main vs branch in headless Chromium, ten walls: the eight audit walls, ACI with variable height ticked (8 / 16 ft), and AASHTO with variable height (10 / 18 ft) + collision.
  - `_R`, Export JSON and every localStorage key are **identical** in all ten.
  - Tab text is identical in all ten.
  - Report text is identical in nine. In the ACI variable-height wall it differs only in the overview elevation figure (now drawn with the sloping top) and its caption (", variable height (design H_s at 0.75 L)").
  - 0 console errors.
- ACI + variable height in the browser:
  - the card shows and is editable;
  - the reason line reads "… = 14.00 ft";
  - the Drawings elevation sheet shows "VARIABLE HEIGHT".
  - Screenshots were looked at.
- Tests: check-syntax, smoke/retaining-wall-checks, phone-layout rwall 390/768, project-library retwall, dxf-print-sheets rw.

### Saved data
None. No field or key changed.

## 2026-11-07 — PR: claude/rw-dev-splice-checks — Development and splice checks: stem dowel tension lap, heel F1 and toe F2 ℓd vs length available, optional hooked toe bars (RWDS; new checks) (PR #947: https://github.com/mlococo88/All-Structural/pull/947)

Calculation audit, item 5 (PR 5a). Engineer decision (2026-11-07). Code sites are tagged `RWDS`. The S1 / S3 layout and the alternate-bar cut-off are PR 5b (not here).

### RWDS-1. `devLength` split (pure refactor)
- `devLength(...)` now returns `Math.max(12, devLengthACIRaw(...))`.
- The new `devLengthACIRaw` is the same Eq. 25.4.2.4a expression without the 12-in minimum.
- Same value as before for every input (the ACI ℓd values of all walls compared below are identical).

### RWDS-2. New checks in `calcAll` (after the toe ℓd)   [§4: new checks; no existing value changes]
- **Provisions** (verified for the audit briefing; cited and paraphrased):
  - ACI 318-19 Table 25.5.2.1 and AASHTO LRFD 10th Ed. 5.10.8.4.3a, tension lap splices: Class A (1.0ℓd) only if A_s,prov/A_s,req ≥ 2 over the lap length and no more than 50 % of A_s is spliced within the lap length; otherwise Class B (1.3ℓd); ℓst ≥ 12 in.
  - In ACI, ℓd is from 25.4.2.1(a), i.e. before its 12-in minimum.
  - Development: ACI 318-19 §25.4.2 / §25.4.3.1 and AASHTO 5.10.8.2.1a / 5.10.8.2.4a.
- **(1) Stem dowel lap `stemLap`:**
  - `lap_ld_a` is ℓd before the 12-in minimum: ACI `devLengthACIRaw`; AASHTO ℓdb·λrl·λcf·λrc.
  - `lap_ratio` = S1 A_s,prov / A_s,des at the base.
  - `lap_pct` = 100, because every S1 bar laps its dowel at the joint. So the lap is always Class B.
  - `lst_stem` = max(12, 1.3·ℓd).
  - Check: ℓst ≤ H_s (the lap fits in the stem).
  - The drawings use `lst_stem` for the S1D lap. Before, they used 1.3 × ℓd including its 12-in minimum, labelled "as drawn by the tool (not checked)".
- **(2) Heel bars `heelDev`:** ℓd(F1) ≤ min(L_h·12 − c_c, L_t·12 + t_s − c_c). These are the lengths available on each side of the stem back face.
- **(3) Toe bars `toeDev`:**
  - Straight bars: ℓd(F2) ≤ L_t·12 − c_c past the stem front face.
  - Hooked bars (new input **"Toe bars F2 hooked at the toe end"**, `toe_hook`): ℓdh(F2) ≤ L_t·12 − c_c instead.
  - ℓdh is from `hookDevLength`: ACI ψr 1.6, ψo 1.0, ψc; AASHTO with λrc of the straight bar.
  - Also ℓd ≤ t_s + L_h·12 − c_c into the stem and the heel.
  - NG gives a warning and a red note on the tab.
- **Before / after** (`git diff -U0`, calculation, inputs and drawing geometry):
```diff
@@ -1943,0 +1945,4 @@ function devLength(db, fy, fc, psi_t, psi_e, cover_to_ctr, lambda=1.0, spacing=I
+  return Math.max(12, devLengthACIRaw(db, fy, fc, psi_t, psi_e, cover_to_ctr, lambda, spacing));   // min 12 in per ACI 25.4.2.1 (RWDS: same value as before)
+}
+// RWDS (2026-11-07): ℓd of ACI 318-19 §25.4.2.1(a) / Eq. 25.4.2.4a before its 12-in minimum (the lap length ℓst is based on it, Table 25.5.2.1)
+function devLengthACIRaw(db, fy, fc, psi_t, psi_e, cover_to_ctr, lambda=1.0, spacing=Infinity) {
@@ -1953 +1958 @@ function devLength(db, fy, fc, psi_t, psi_e, cover_to_ctr, lambda=1.0, spacing=I
-  return Math.max(12, ld);                  // min 12 in per ACI 25.4.2.1
+  return ld;
@@ -3229,0 +3235,30 @@ function calcAll(inp) {
+  // ── RWDS (2026-11-07): development and splice checks (engineer decision, audit item 5a) ──
+  // ℓd before the 12-in minimum: ACI 318-19 §25.4.2.1(a) (Eq. 25.4.2.4a); AASHTO 10th §5.10.8.2.1a (ℓdb·λrl·λcf·λrc)
+  const ldRaw = (bar, spacing, cov, top) => isAASHTO
+    ? (p => p.ldb * p.lam_rl * p.lam_rc)(devLengthAASHTOParts(bar.db, inp.fy, inp.fc, top, cov + bar.db / 2, spacing))
+    : devLengthACIRaw(bar.db, inp.fy, inp.fc, top ? 1.3 : 1.0, 1.0, cov + bar.db / 2, 1.0, spacing);
+  // (1) stem dowel (S1D) tension lap with S1 at the construction joint — ACI Table 25.5.2.1 / AASHTO 5.10.8.4.3a:
+  //     Class A (1.0ℓd) only if A_s,prov/A_s,req ≥ 2 over the lap AND ≤ 50 % of A_s spliced; else Class B (1.3ℓd); ℓst ≥ 12 in.
+  //     Every S1 bar is lapped with its dowel at the joint → 100 % spliced → Class B.
+  const lap_ld_a   = ldRaw(sel_stem.bar, sel_stem.spacing, inp.cov_stem, false);
+  const lap_ratio  = sel_stem.As_prov / Math.max(As_stem_des, 1e-9);
+  const lap_pct    = 100;
+  const lap_classA = lap_ratio >= 2 && lap_pct <= 50;
+  const lst_stem   = Math.max(12, (lap_classA ? 1.0 : 1.3) * lap_ld_a);
+  const lap_avail  = inp.Hs * 12;                                  // the lap must fit in the stem above the joint
+  const lap_ok     = lst_stem <= lap_avail;
+  // (2) heel bars F1: ℓd each side of the critical section at the stem back face
+  const f1_av_heel = inp.Lh * 12 - inp.cov_ftg;                     // to the heel end
+  const f1_av_toe  = inp.Lt * 12 + inp.ts_bot - inp.cov_ftg;        // past the stem back face, through the stem and toe
+  const heel_dev_ok = ld_heel <= Math.min(f1_av_heel, f1_av_toe);
+  // (3) toe bars F2: ℓd (or ℓdh if hooked at the toe end) past the stem front face
+  const toe_hook   = !!inp.toe_hook;
+  const ldA_toe    = isAASHTO ? devLengthAASHTOParts(sel_toe.bar.db, inp.fy, inp.fc, false, inp.cov_ftg + sel_toe.bar.db / 2, sel_toe.spacing) : null;
+  const ldh_toe    = hookDevLength(sel_toe.bar.db, inp.fy, inp.fc, isAASHTO, sel_toe.bar, ldA_toe ? ldA_toe.lam_rc : 1.0);
+  const f2_av_toe  = inp.Lt * 12 - inp.cov_ftg;                     // to the toe end
+  const f2_av_heel = inp.ts_bot + inp.Lh * 12 - inp.cov_ftg;        // past the front face, into the stem and heel
+  const f2_need    = toe_hook ? ldh_toe : ld_toe;
+  const toe_dev_ok = f2_need <= f2_av_toe && ld_toe <= f2_av_heel;
+  if (!toe_dev_ok) warnings.push(`Toe bars F2: ${toe_hook ? 'ℓdh' : 'ℓd'} = ${f(f2_need,1)}" > ${f(f2_av_toe,1)}" available to the toe end — ${toe_hook ? 'use a smaller bar or lengthen the toe' : 'hook the bars at the toe end, use a smaller bar or lengthen the toe'}.`);
+  if (!heel_dev_ok) warnings.push(`Heel bars F1: ℓd = ${f(ld_heel,1)}" exceeds the length available (${f(Math.min(f1_av_heel, f1_av_toe),1)}").`);
+
@@ -3392,0 +3428,3 @@ function calcAll(inp) {
+    stemLap:   { ok: lap_ok,                       label: 'Stem Dowel Lap', val: `ℓst=${f(lst_stem,1)}" Class ${lap_classA ? 'A' : 'B'}` },   // RWDS
+    heelDev:   { ok: heel_dev_ok,                  label: 'Heel F1 ℓd', val: `${f(ld_heel,1)}${heel_dev_ok ? '≤' : '>'}${f(Math.min(f1_av_heel, f1_av_toe),1)}"` },   // RWDS
+    toeDev:    { ok: toe_dev_ok,                   label: 'Toe F2 ' + (toe_hook ? 'ℓdh' : 'ℓd'), val: `${f(f2_need,1)}${f2_need <= f2_av_toe ? '≤' : '>'}${f(f2_av_toe,1)}"` },   // RWDS
@@ -3545,0 +3586 @@ function getInputs() {
+    ...(b('toe_hook') ? { toe_hook: true } : {}),   // RWDS (2026-11-07): F2 hooked at the toe end; absent = straight (as before)
@@ -10084 +10158 @@ function rwdwBars(r, G) {
-  const lap = 1.3 * r.ld_stem;                                       // as drawn by the tool (Class B 1.3 l_d), not checked
+  const lap = r.lst_stem;                                            // RWDS (2026-11-07): the computed tension lap ℓst (Stem design Step 5); was 1.3 × ℓd (with its 12-in minimum)
@@ -10093 +10167 @@ function rwdwBars(r, G) {
-    F2: { s: f2, x0: cf, x1: Math.min(G.B - cf, G.xf + r.ld_toe), y: cf + db(f2) / 2 },
+    F2: { s: f2, x0: cf, x1: Math.min(G.B - cf, G.xf + r.ld_toe), y: cf + db(f2) / 2, hook: r.toe_hook ? 12 * db(f2) : 0 },   // RWDS: 90° hook up at the toe end when ticked
@@ -10096 +10170 @@ function rwdwBars(r, G) {
-  B.F1.len = B.F1.x1 - B.F1.x0; B.F2.len = B.F2.x1 - B.F2.x0;
+  B.F1.len = B.F1.x1 - B.F1.x0; B.F2.len = B.F2.x1 - B.F2.x0 + B.F2.hook;
```

### RWDS-3. Display
- **Stem design, Step 5:** the lap is worked: class conditions, ℓst = max(1.3ℓd, 12), and ℓst ≤ H_s.
- **Footing design:**
  - Heel Step 4: F1 both sides.
  - Toe Step 4: the hook ℓdh when ticked, the F2 check, and an NG note when it fails.
- **Report:** steps `stb/s5.lap`, `heel/h4.dev`, `toe/t4.dev` (and `t4.ldh`).
- **Dashboard rows:** "Stem Dowel Lap", "Heel F1 ℓd", "Toe F2 ℓd / ℓdh", with D/C and links to their cards.
- **Rebar schedule tab:** an "S1D dowel lap ℓst" row, and "Toe F2 hook ℓdh" when ticked.
- **Cross-section tooltip:** shows the lap.
- **Drawings:**
  - S1D lap = ℓst, labelled "CLASS B TENSION LAP L_ST = … (CHECKED)".
  - F2 gets a 90° hook leg (12 d_b) at the toe end when ticked, with its label.
  - Bar schedule: F2 bend "90° HOOK", length includes the hook, ℓd / ℓdh.
- **Saved data:** `toe_hook` is additive and saved only when ticked. A save without it opens unticked (`RWLS_DEF` reset).

### Check cases (re-run with the tool's `calcAll` and in the browser)
- **ACI default:**
  - S1 #4@6: A_s,prov/A_s,req = 0.400/0.3888 = 1.03 < 2, and 100 % is spliced, so **Class B**.
  - ℓd(a) = 3·60000·0.8/(40·63.25·2.5)·0.5 = **11.38 in**, so ℓst = max(1.3·11.38, 12) = **14.8 in** (drawn before: 1.3·12 = 15.6 in).
  - F1 ℓd 14.8 ≤ min(93, 51) in, OK.
  - F2 ℓd 12.0 ≤ 33 in, OK.
- **AASHTO default:**
  - S1 #5@7: ratio 1.14, **Class B**, ℓst = 1.3·14.78 = **19.2 in** (drawn before: 19.2).
  - F1 ℓd 19.2 ≤ min(93, 51), OK.
  - F2 12.0 ≤ 33, OK.
- **ACI variant, L_t 1.5 ft, L_h 9.5 ft:** available to the toe end = 18 − 3 = **15 in**.
  - Toe override #6@12, straight: ℓd = **17.08 > 15, NG** (new FAIL).
  - Toe override #6@12, hooked: ℓdh = **15.54 > 15, NG**.
  - Toe override #5@12, hooked: ℓdh = **11.8 ≤ 15, OK**.
  - F1: ℓd 14.8 ≤ min(111, 33), OK.
- **AASHTO, same variant, #6 hooked:** ℓdh = 14.53 ≤ 15, OK. (Straight would be ℓd = 17.74.)

### How verified
- `calcAll` in Node, branch, for the cases above. Every value matches the audit briefing.
- **origin/main vs branch, headless Chromium, eleven walls** (the eight audit walls, plus the short-toe variant, plus AASHTO q_s 250 + water + collision ± "full"):
  - every pre-existing `_R` value is identical;
  - `_R` gains only the new fields and the three `checks` entries (20 paths), plus one new warning in the short-toe variant;
  - Export JSON and every localStorage key are identical;
  - tab and Report text differ by the new steps and rows.
- **Tests:**
  - project-library retwall: its step 1 ("results identical", which compares `_R` strictly) reports exactly the 20 added items (17 fields + 3 checks) and nothing else; all its other steps pass.
  - check-syntax, smoke/retaining-wall-checks, phone-layout rwall 390/768, dxf-print-sheets rw: pass.
- **Screenshots looked at:** Toe Step 4 hooked #6 (FAIL), the drawings with a hooked #5.

### Saved data and old projects
- `toe_hook` is additive; there is no other change.
- Old projects keep every value. They gain three check rows.
- A wall whose toe is too short for straight F2 bars now shows a FAIL that was not checked before.
- The S1D lap drawn in ACI mode changes where ℓd < 12 in (e.g. 15.6 → 14.8 in at the default).

## 2026-11-07 — PR: claude/rw-stem-s1s3 — Stem back-face layout: S1 to mid-height + the S3–S1 lap, S3 above; alternate-bar cut-off removed; S1 end and moment along the height checked (RWS13; calculation and detailing change) (PR #948: https://github.com/mlococo88/All-Structural/pull/948)

Calculation audit, item 5b. Engineer decision (2026-11-07). Code sites are tagged `RWS13`.

### RWS13-1. `calcAll`: the alternate-bar cut-off removed; new S1/S3 block after the F1 development check   [§4]
- **Before:** S1 ran full height; half of S1 was cut off at `z_cutoff` (extension max(d, 12d_b) in both modes); S3 ran from mid-height to the top with no splice with S1 ("not in the model"); a warning asked to confirm ACI 9.7.3.5 at the cut-off.
- **After (engineer's model):**
  - S1 (lapped with the S1D dowels at the joint) runs from the footing to mid-height + the S3–S1 lap; S3 from mid-height to the top. No alternate-bar cut-off.
  - **S3–S1 tension lap:** all S3 bars lap S1 at one level (100 % spliced) → Class B, ℓst = max(1.3ℓd, 12 in), ℓd before its 12-in minimum (ACI 318-19 Table 25.5.2.1 / §25.5.2.1; AASHTO LRFD 10th Ed. 5.10.8.4.3a). Bars of different size: ℓst = the greater of ℓd of the larger bar and ℓst of the smaller bar (ACI 318-19 §25.5.2.2), used in both modes (AASHTO: adopted from ACI by the engineer). Same size: the larger of the two ℓst (they differ only by spacing).
  - **Extension of S1 past z_req** (the height above which S3 alone carries M_u): ACI 318-19 §7.7.3.3 (one-way slab rules apply to the stem by §13.3.6.1; §9.7.3.3 has the same rule for beams): max(d, 12d_b). AASHTO 10th 5.10.8.1.2a: max(d, 15d_b, L/20), L = clear span = H_s.
  - **End of S1:** z_S1 = max(H_s/2 + ℓst/12, z_req + ℓ_ext/12); S1 runs full height when z_S1 reaches the top cover.
  - **Moment along the height** (ACI 318-19 §13.3.6.3): 240 sections plus the bar ends; φM_n of the bars present, each set's stress in proportion to its embedment beyond the section up to ℓd (S1 above its end, S3 above mid-height); demand = the same envelope the cut-off used (Strength I / U = 1.6H, φ 0.90; AASHTO Extreme Event II, φ 1.00). New check rows `stemS3Lap` ("Stem S3–S1 Lap") and `stemMAlong` ("Stem M along height").
- **Decisions (pending engineer review):**
  - ℓd of the larger bar in the §25.5.2.2 rule is taken with its 12-in minimum (conservative).
  - The S1 end is a lap splice with S3 (continuous reinforcement), not a bar termination: ACI §7.7.3.5 (tension-zone termination) and the AASHTO 5.10.8.1.2a "no more than 50 % terminated at a section" rule are not applied to it.
  - L in L/20 = H_s (the stem is a cantilever from the joint).
  - The vertical bars are taken as anchored at the stem top (no development ramp at the top end).
- **Before / after** (`git diff -U0`, calculation):
```diff
@@ -2996,44 +2997,2 @@ function calcAll(inp) {
-  // ── Bar cutoff: alternate S1 bars terminated (ACI 318-19 §9.7.3 / AASHTO 5.10.8.1.2) ──
-  // Remaining bars = half of S1 at twice the spacing. Find the depth z_th (from top) at
-  // which φMn of the remaining bars equals the factored demand envelope (Strength +
-  // EE-II), using the tapered stem thickness. The terminated bars must then extend
-  // PAST that point toward the top by max(d, 12db) [ACI 9.7.3.3 / AASHTO 5.10.8.1.2a],
-  // and be developed (ℓd) from the base where they are fully stressed.
-  let z_cutoff = null, z_cut_theory = null, cut_ext = 0, As_rem = 0, s_rem = 0;
-  {
-    As_rem = sel_stem.As_prov / 2;
-    s_rem  = sel_stem.spacing * 2;
-    const db = sel_stem.bar.db;
-    const ctArmTop = ctR ? (ctR.y_CT - tf_ft - inp.Hs) : 0;   // collision height above stem top
-    const MuAt = z => {                         // factored demand at depth z below stem top (lb·ft/ft)
-      const sd = stemDemand(z);
-      const mS = gEH*sd.M_soil + gWA*sd.M_hyd + gES*(Ka*inp.q_sur*z*z/2) + gLS*(Ka*q_ll_stem*z*z/2);
-      const mE = ctR ? (sd.M_soil + sd.M_hyd + Ka*inp.q_sur*z*z/2 + 0.5*Ka*q_ll_stem*z*z/2
-                        + ctR.CT_h*1000*(ctArmTop + z)) : 0;
-      return Math.max(mS, mE);
-    };
-    const dAt = z => (inp.ts_top + (inp.ts_bot - inp.ts_top) * z / inp.Hs) - inp.cov_stem - db/2;
-    const phiMnRem = z => { const d = dAt(z), a = As_rem*inp.fy/(0.85*inp.fc*bw);
-                            return 0.9 * As_rem * inp.fy * (d - a/2) / 12; };
-    if (s_rem > max_s_stem) {
-      z_cutoff = null;                          // remaining spacing would violate max spacing
-    } else if (MuAt(inp.Hs) <= phiMnRem(inp.Hs)) {
-      z_cut_theory = inp.Hs;                    // half the bars suffice full height
-    } else {
-      let lo = 0, hi = inp.Hs;
-      for (let k = 0; k < 50; k++) {
-        const mid = (lo + hi) / 2;
-        if (MuAt(mid) <= phiMnRem(mid)) lo = mid; else hi = mid;
-      }
-      z_cut_theory = lo;
-    }
-    if (z_cut_theory !== null) {
-      cut_ext = Math.max(dAt(z_cut_theory), 12 * db) / 12;          // ft
-      // Extend toward the TOP; also no shorter than ℓd measured from the base
-      z_cutoff = Math.min(z_cut_theory - cut_ext, inp.Hs - ld_stem / 12);
-      if (z_cutoff <= 0.5) z_cutoff = null;     // cutoff would be at/near the top — run bars full height
-    }
-  }
-  const z_cutoff_from_base = z_cutoff === null ? inp.Hs : Math.max(0, inp.Hs - z_cutoff); // full bars up to here
-  if (z_cutoff !== null)
-    warnings.push(`S1 alternate-bar cutoff is in a flexural tension zone — confirm ACI 9.7.3.5 / AASHTO 5.10.8.1.2 shear/steel conditions at the cutoff.`);
+  // RWS13 (2026-11-07): the alternate-bar cut-off of S1 (z_cutoff) is removed (engineer decision, audit item 5b).
+  // S1 runs from the footing to mid-height + the S3–S1 lap; see "RWS13" after the development checks below.
@@ -3264,0 +3224,71 @@ function calcAll(inp) {
+  // ── RWS13 (2026-11-07): stem back-face layout S1 / S3 (engineer decision, audit item 5b) ──
+  // S1 (lapped with the dowels S1D at the joint) runs from the footing up to mid-height + the S3–S1 lap ℓst;
+  // S3 runs from mid-height to the top. No alternate-bar cut-off.
+  // (a) S3–S1 tension lap: all S3 bars lap S1 at one level (100 % spliced) → Class B (ACI Table 25.5.2.1 /
+  //     AASHTO 5.10.8.4.3a). Bars of different size: ℓst = max(ℓd of the larger bar, ℓst of the smaller bar)
+  //     (ACI 318-19 §25.5.2.2; used in AASHTO mode too, adopted from ACI by the engineer). Same size: the larger ℓst.
+  const ld_S3      = isAASHTO
+    ? devLengthAASHTO(sel_stemT.bar.db, inp.fy, inp.fc, false, inp.cov_stem + sel_stemT.bar.db / 2, sel_stemT.spacing)
+    : devLength(sel_stemT.bar.db, inp.fy, inp.fc, 1.0, 1.0, inp.cov_stem + sel_stemT.bar.db / 2, 1.0, sel_stemT.spacing);
+  const s13_ld_a1  = lap_ld_a;                                                    // S1, before the 12-in minimum
+  const s13_ld_a3  = ldRaw(sel_stemT.bar, sel_stemT.spacing, inp.cov_stem, false); // S3, before the 12-in minimum
+  const s13_lst1   = Math.max(12, 1.3 * s13_ld_a1), s13_lst3 = Math.max(12, 1.3 * s13_ld_a3);
+  const s13_ratio  = sel_stemT.As_prov / Math.max(As_stemT_des, 1e-9);            // over the lap (S3 at mid-height); 100 % spliced → Class B anyway
+  const s13_diff   = sel_stem.bar.num !== sel_stemT.bar.num;
+  const s13_big    = sel_stem.bar.num >= sel_stemT.bar.num ? 'S1' : 'S3';
+  const s13_ld_big = s13_big === 'S1' ? ld_stem : ld_S3;                          // ℓd of the larger bar (with its 12-in minimum)
+  const s13_lst_sm = s13_big === 'S1' ? s13_lst3 : s13_lst1;                      // ℓst of the smaller bar
+  const s13_lst    = s13_diff ? Math.max(s13_ld_big, s13_lst_sm) : Math.max(s13_lst1, s13_lst3);
+  // (b) S1 extension past the point where it is no longer required (S3 alone carries the demand above z_req):
+  //     ACI 318-19 §7.7.3.3 (one-way slab, §13.3.6.1; same rule as §9.7.3.3): max(d, 12d_b);
+  //     AASHTO 10th §5.10.8.1.2a: max(d, 15d_b, L/20), L = clear span of the cantilever stem = H_s.
+  const tAt  = zb => inp.ts_bot - (inp.ts_bot - inp.ts_top) * zb / inp.Hs;           // stem thickness at zb ft above the joint (in)
+  const ctArmTop = ctR ? (ctR.y_CT - tf_ft - inp.Hs) : 0;                              // collision height above the stem top
+  const MuS = zb => { const z = inp.Hs - zb, sd = stemDemand(z);                       // Strength I / U = 1.6H at zb (lb·ft/ft)
+    return gEH*sd.M_soil + gWA*sd.M_hyd + gES*(Ka*inp.q_sur*z*z/2) + gLS*(Ka*q_ll_stem*z*z/2); };
+  const MuE = zb => { if (!ctR) return 0; const z = inp.Hs - zb, sd = stemDemand(z);  // AASHTO Extreme Event II at zb
+    return sd.M_soil + sd.M_hyd + Ka*inp.q_sur*z*z/2 + 0.5*Ka*q_ll_stem*z*z/2 + ctR.CT_h*1000*(ctArmTop + z); };
+  const phiE = isAASHTO ? 1.00 : 0.90;
+  const MnOf = (sets, zb) => {                                                          // nominal moment of the effective bars (lb·ft/ft)
+    const T = sets.reduce((a, q) => a + q.A, 0); if (T <= 0) return 0;
+    const a = T * inp.fy / (0.85 * inp.fc * bw);
+    return sets.reduce((m, q) => m + q.A * inp.fy * (tAt(zb) - inp.cov_stem - q.db / 2 - a / 2), 0) / 12; };
+  const dcAt = (sets, zb) => { const Mn = MnOf(sets, zb), mS = MuS(zb), mE = MuE(zb);
+    if (mS <= 1e-6 && mE <= 1e-6) return 0; if (Mn <= 0) return Infinity;
+    return Math.max(mS / (0.90 * Mn), mE / (phiE * Mn)); };
+  const NZ = 240, s3only = zb => [{ A: sel_stemT.As_prov, db: sel_stemT.bar.db }];
+  let z_req = 0;                                                                      // S1 is required below z_req
+  for (let i = NZ; i >= 0; i--) { const zb = inp.Hs * i / NZ;
+    if (dcAt(s3only(zb), zb) > 1) { let lo = zb, hi = Math.min(inp.Hs, zb + inp.Hs / NZ);
+      for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (dcAt(s3only(m), m) > 1) lo = m; else hi = m; }
+      z_req = hi; break; } }
+  const s1_ext_d   = tAt(z_req) - inp.cov_stem - sel_stem.bar.db / 2;
+  const s1_ext_db  = (isAASHTO ? 15 : 12) * sel_stem.bar.db;
+  const s1_ext_L   = isAASHTO ? inp.Hs * 12 / 20 : 0;
+  const s1_ext     = Math.max(s1_ext_d, s1_ext_db, s1_ext_L);                           // in
+  const z_s1_lap   = Hs_mid + s13_lst / 12;                                              // ft above the joint
+  const z_s1_ext   = z_req + s1_ext / 12;
+  const z_s1_need  = Math.max(z_s1_lap, z_s1_ext);
+  const s1_full    = z_s1_need >= inp.Hs - inp.cov_stem / 12;                            // S1 runs to the top
+  const z_s1_end   = s1_full ? inp.Hs : z_s1_need;
+  const s13_lap_prov = (z_s1_end - Hs_mid) * 12;                                         // lap provided (in)
+  const s13_lap_ok = s1_full || s13_lap_prov >= s13_lst - 1e-6;
+  const s1_end_ok  = s1_full || z_s1_end >= z_s1_ext - 1e-9;
+  // (c) moment capacity along the height (ACI 13.3.6.3: investigate along the height): φMn of the bars present at each
+  //     height, each set's stress taken in proportion to its embedment beyond the section up to ℓd (S1 above its end
+  //     at z_s1_end, S3 above its start at mid-height); the bars are taken as anchored at the stem top.
+  const setsAt = zb => {
+    const q = [];
+    const e1 = s1_full ? 1 : Math.min(1, Math.max(0, (z_s1_end - zb) * 12 / ld_stem));
+    if (e1 > 0) q.push({ A: sel_stem.As_prov * e1, db: sel_stem.bar.db });
+    const e3 = zb <= Hs_mid ? 0 : Math.min(1, (zb - Hs_mid) * 12 / ld_S3);
+    if (e3 > 0) q.push({ A: sel_stemT.As_prov * e3, db: sel_stemT.bar.db });
+    return q; };
+  const zKey = [0, Hs_mid, Hs_mid + ld_S3 / 12, z_s1_end - ld_stem / 12, z_s1_end].filter(z => z >= 0 && z <= inp.Hs);
+  let s13_dc = 0, s13_dc_z = 0;
+  for (const zb of [...Array(NZ + 1).keys()].map(i => inp.Hs * i / NZ).concat(zKey)) {
+    const dc = dcAt(setsAt(zb), zb); if (dc > s13_dc) { s13_dc = dc; s13_dc_z = zb; } }
+  const s13_Mu_at  = Math.max(MuS(s13_dc_z), MuE(s13_dc_z)), s13_Mn_at = MnOf(setsAt(s13_dc_z), s13_dc_z);
+  const s13_ok     = s13_dc <= 1 + 1e-9;
+  if (!s13_ok) warnings.push(`Stem back-face bars: M_u exceeds φM_n of the bars present at ${f(s13_dc_z,2)} ft above the joint (D/C ${f(s13_dc,2)}) — increase S3 or extend S1.`);
+
@@ -3432,0 +3463,2 @@ function calcAll(inp) {
+    stemS3Lap:  { ok: s13_lap_ok && s1_end_ok,   label: 'Stem S3–S1 Lap', val: s1_full ? 'S1 full height' : `S1 to ${f(z_s1_end,2)}ft` },   // RWS13
+    stemMAlong: { ok: s13_ok,                     label: 'Stem M along height', val: `D/C ${f(s13_dc,2)} @ ${f(s13_dc_z,1)}ft` },   // RWS13
@@ -3516 +3547,0 @@ function calcAll(inp) {
-    z_cut_theory, cut_ext, As_rem, s_rem,
@@ -3519 +3550,3 @@ function calcAll(inp) {
-    z_cutoff, z_cutoff_from_base,
+    ld_S3, s13_ld_a1, s13_ld_a3, s13_lst1, s13_lst3, s13_ratio, s13_diff, s13_big, s13_ld_big, s13_lst_sm, s13_lst,   // RWS13
+    z_req, s1_ext_d, s1_ext_db, s1_ext_L, s1_ext, z_s1_lap, z_s1_ext, z_s1_need, s1_full, z_s1_end, s13_lap_prov, s13_lap_ok, s1_end_ok,
+    s13_dc, s13_dc_z, s13_Mu_at, s13_Mn_at, s13_ok,
```

### RWS13-2. Display
- **Stem design tab:** Step 5 renamed "Development Length & Dowel Lap" (the cut-off equation removed); new card **Mid Step 3 — S3–S1 Lap, End of S1 & Moment along the Height** (lap of each bar, the §25.5.2.2 rule, z_req, extension, z_S1, max M_u/φM_n with its location). The V/M plot and the stem moment diagram show the end of S1 instead of the cut-off; the cross-section shows the S1 end and the lap zone.
- **Dashboard rows** "Stem S3–S1 Lap" (D/C = ℓst / lap provided, 1.00 by construction) and "Stem M along height", linked to Mid Step 3.
- **Report:** Mid Step 3 (`stm/m3.*`) in the mid-height section; the cut-off step `stb/s5.zcut` removed; Step 5 title; references (ACI §7.7.3.3, §13.3.6.3, §25.5.2; AASHTO 5.10.8).
- **Rebar schedule tab:** S1 and S3 notes give the S1 end and the lap; S3 shows its ℓd.
- **Drawings:** S1 drawn to z_S1; S3 label "CLASS B TENSION LAP WITH S1 L_ST = … (CHECKED)" (was "SPLICE NOT IN THE MODEL"); the cut-off mark and label removed; bar schedule: one S1 row (lower, to mid-height + lap; was full-height + cut-off rows), S3 with ℓd and lap; notes updated.

### Check cases (`calcAll` in Node and in the browser)
- **ACI default:** S1 #4@6, S3 #4@7 (same size). ℓd(a) = 11.38 in both (spacing changes c_b only through s/2 ≥ cover) → ℓst = max(1.3·11.38, 12) = **14.8 in**. z_req = 0 (S3 alone carries M_u = 18432 at the base: φM_n = 0.9·0.343·60000·(15.75 − 0.5·0.504)/12 = 23 900 ≥ 18432 lb·ft/ft). ℓ_ext = max(15.75, 6.0) = 15.75 in → z_S1 = max(6.0 + 1.23, 0 + 1.31) = **7.23 ft** above the joint (before: full height 12 ft, half the bars cut at 2.44 ft above the base, z_cut 9.56 ft from the top). Max M_u/φM_n = 0.663 at the base.
- **AASHTO default:** S1 #5@7, S3 #3@9. ℓd #5 = 14.78 in; ℓst #3 = max(1.3·8.87, 12) = 12.0 → ℓst = max(14.78, 12.0) = **14.8 in** (§25.5.2.2 rule). z_req = 4.93 ft; ℓ_ext = max(13.22, 15·0.625 = 9.38, 144/20 = 7.20) = 13.22 in → z_S1 = max(7.23, 6.03) = **7.23 ft** (before: full height + half cut at 3.93 ft above the base). Max D/C 0.882 at the base.
- **AASHTO + collision (TL-4):** z_req 4.06 ft, ℓ_ext 13.66 in, z_S1 7.23 ft; D/C 0.882.
- **ACI tall wall** (H_s 28, t 30/14, t_f 36, L_t 6, L_h 16): S1 #10@7, S3 #5@7: ℓst = max(ℓd #10 = 43.55, ℓst #5 = 18.50) = 43.55 in; z_req 11.28 ft; z_S1 = max(17.63, 13.02) = 17.63 ft; D/C 0.928 (base).
- **ACI tall wall with S3 override #4@18:** z_req 18.09 ft → z_S1 = z_req + ℓ_ext = 19.51 ft (the extension governs over mid-height + lap).

### How verified
- origin/main vs branch, headless Chromium, the twelve audit walls (ACI default, water uniform / triangular, mix (water + seismic + column + β + q_s + key), short toe; AASHTO collision, water + column + η + at-rest, rock + collision + water + β, variable height + collision, q_s 250 + water + collision ± "full"; ACI tall + seismic + water): `_R` differs only by the six removed cut-off fields, the removed cut-off warning (later warnings shift by one index), the 31 new fields and the two new `checks` entries; Export JSON and every localStorage key identical; tab and Report text differ by the new card, rows and steps. 0 console errors.
- Tests: check-syntax; smoke/retaining-wall-checks (new table `AUD`: the RWS13 check cases); phone-layout rwall 390/768; project-library retwall (its strict "results identical" step lists only the removed and added `_R` items above); dxf-print-sheets rw.
- Screenshots looked at: Stem design Mid Step 3 (AASHTO), Drawings sheet 2 (AASHTO).

### Saved data
- No input added; no key or format change. Old projects open with the new layout (S1 shorter, no cut-off) and two new check rows.

## 2026-11-07 — PR: claude/rw-aci-ecc — ACI mode: eccentricity limit select (middle third default, B/4, none = information only); old saves open with "none" (RWEC; calculation change: new check) (PR #949: https://github.com/mlococo88/All-Structural/pull/949)

Calculation audit, item 7. Engineer decision (2026-11-07). Code sites are tagged `RWEC`. AASHTO mode unchanged.

### RWEC-1. Input, calculation and migration   [§4: new check]
- **Input (Soil tab, ACI only):** "Eccentricity limit (service)" `aci_ecc_limit`: `b6` middle third e ≤ B/6 (page default, new projects), `b4` e ≤ B/4, `none` no eccentricity limit (IBC / ACI), e for information. Hint: neither code sets a maximum eccentricity.
- **Provisions (verified; cited and paraphrased):** ACI 318-19 §13.2.6.1 (PDF p. 196, printed 194): foundations proportioned for bearing and for stability against overturning and sliding per the general building code. IBC 2018 §1807.2.1: retaining walls stable against overturning, sliding, excessive foundation pressure and water uplift. Neither sets an eccentricity limit; the limit is the engineer's choice (as in Spread Footing, #908 / #913). The tool's IBC citations elsewhere say 2021 (not in the references); unchanged here.
- **Check:** `checks.ecc` (ACI) only when a limit is chosen: |e| ≤ B/6 or B/4 with the service e (`B/2 − x̄`), D/C = |e|/limit. With `none` there is no row (as before) and e is shown for information. The tension-zone warning is unchanged.
- **Migration (§5):** a project, autosave, library item or import saved before this option has no `aci_ecc_limit`; `restoreFields` sets it to `none` (the earlier behaviour, results as saved) and the Stability Step 6 note says so. `calcAll` also treats a missing value as `none`. New projects take the page default (middle third).
- **Before / after** (`git diff -U0`, calculation and migration):
```diff
@@ -2331,0 +2339,6 @@ function calcAll(inp) {
+  // RWEC (2026-11-07): ACI-mode eccentricity limit (engineer decision, audit item 7). Neither ACI 318-19 §13.2.6.1 nor IBC 2018
+  // §1807.2.1 sets a maximum e; the user picks middle third (B/6, default for new projects), B/4, or none (information only;
+  // projects saved before the option open with 'none', the earlier behaviour).
+  const aci_ecc_limit = isAASHTO ? null : (inp.aci_ecc_limit || 'none');
+  const ecc_lim_aci   = aci_ecc_limit === 'b6' ? B / 6 : aci_ecc_limit === 'b4' ? B / 4 : null;
+  const ecc_ok_aci    = ecc_lim_aci === null || Math.abs(e) <= ecc_lim_aci + 1e-9;
@@ -3449,0 +3463 @@ function calcAll(inp) {
+    ...(ecc_lim_aci !== null ? { ecc: { ok: ecc_ok_aci, label: 'Eccentricity', val: `e=${f(Math.abs(e),2)}${ecc_ok_aci ? '≤' : '>'}${f(ecc_lim_aci,2)}ft` } } : {}),   // RWEC
@@ -3549,0 +3564 @@ function calcAll(inp) {
+    aci_ecc_limit, ecc_lim_aci, ecc_ok_aci,   // RWEC
@@ -3618,0 +3634 @@ function getInputs() {
+    aci_ecc_limit: (document.getElementById('aci_ecc_limit') || {}).value || 'none',   // RWEC (2026-11-07)
@@ -5843,0 +5866 @@ function snapshotFields() {
+let RWEC_MIGRATED = false;   // RWEC: the open project had no aci_ecc_limit (saved before 2026-11-07) and was set to 'none'
@@ -5849,0 +5873,4 @@ function restoreFields(fields) {
+  /* RWEC (2026-11-07) migration: a project or autosave saved before the ACI eccentricity limit has no aci_ecc_limit; it opens with
+     'none' (information only), its results as saved. New projects take the page default (middle third). */
+  RWEC_MIGRATED = !('aci_ecc_limit' in fields);
+  if (RWEC_MIGRATED) { const el = document.getElementById('aci_ecc_limit'); if (el) el.value = 'none'; }
```

### RWEC-2. Display
- **Stability tab, Step 6:** the e check with D/C, or the information note (with the migration notice for an old save).
- **Dashboard row** "Eccentricity" in ACI mode, linked to Step 6 (`RW_CARDS.stabEcc` now has the ACI card).
- **Report:** step `st6/ecc` (check or information) and the input echo row "Eccentricity limit (service)".

### Check cases (re-run with `calcAll` and in the browser)
- **ACI default** (B = 12.5 ft): e = −0.219 ft (toward the heel), B/6 = 2.083 ft, D/C = 0.105, **PASS**. Other results unchanged: FS_OT 7.54, FS_SL 1.656, q_max 1466 psf.
- **ACI variant** (L_t 2, L_h 3, t_f 24 in, key 36 in, passive on, q_a 4000; B = 6.5 ft): e = 1.366 ft.
  - B/6 = 1.083 ft: D/C **1.261, FAIL** (new; before: warning only).
  - B/4 = 1.625 ft: D/C **0.841, PASS**.
  - "No limit": information only, no row.
  - FS_OT 1.877, FS_SL 1.939, q_max 3015 psf in every case.
- **Old save** (autosave without the field): opens with "No eccentricity limit", no e row, results as before.
- **AASHTO default:** unchanged (e 1.43 ≤ 3.13 ft, B/4).

### How verified
- origin/main vs branch, headless Chromium, the twelve audit walls (fresh page, so the branch is on the new default B/6) and three ACI walls with "none":
  - with "none" `_R` differs only by the three new fields (`aci_ecc_limit`, `ecc_lim_aci` = null, `ecc_ok_aci`);
  - with the default B/6 the ACI walls also gain `checks.ecc` and its row;
  - the AASHTO walls differ only by the three new fields (null);
  - Export JSON gains only `aci_ecc_limit` in `fields`.
- Tests: check-syntax; smoke/retaining-wall-checks (table `AUD`: RWEC default, variant B/6 FAIL and B/4 PASS, old autosave → none with the notice, AASHTO unchanged); phone-layout rwall 390/768; project-library retwall (its "results identical" steps list only the new fields and, on a fresh page, the new `checks.ecc`); dxf-print-sheets rw.

### Saved data
- `aci_ecc_limit` is a new field (additive), saved with every project.
- Old saves without it open with "none" (migration above), so their results and pass/fail are unchanged.
- **Open item:** this changes pass/fail for new ACI projects (or an old project after the user picks a limit) where e > the chosen limit.

## 2026-11-07 — PR: claude/rw-front-face-ts — AASHTO: stem front-face vertical T&S bars S4 (Art. 5.10.6, each face and each direction); f_y ≤ 75 ksi in Eq. 5.10.6-1 for S2, S4 and F3; ACI: note only (RWFF; calculation change) (PR #950: https://github.com/mlococo88/All-Structural/pull/950)

Calculation audit, item 8. Engineer decision (2026-11-07). Code sites are tagged `RWFF`.

### RWFF-1. `calcAll`   [§4]
- **Provisions (verified; cited and paraphrased):**
  - AASHTO LRFD 10th Ed. (2024) Art. 5.10.6: shrinkage and temperature steel near exposed surfaces; Eq. 5.10.6-1 gives the area per foot **on each face and in each direction**, 0.11 ≤ A_s ≤ 0.60, with f_y the specified yield strength **≤ 75.0 ksi**.
  - ACI 318-19 §11.7.2.3 (PDF p. 174, printed 172): walls thicker than 10 in need two layers of distributed reinforcement, except single-story basement walls and **cantilever retaining walls**.
  - ACI 318-19 §13.3.6.1: the stem of a cantilever retaining wall is designed as a one-way slab (Ch. 7).
- **f_y cap** (`fy_TS = min(f_y, 75 ksi)`) in every Eq. 5.10.6-1 use: S2 (stem horizontal), S4 (new) and F3 (footing longitudinal). Results move only for AASHTO walls with f_y > 75 ksi (A_s goes up).
- **S4 front-face verticals (AASHTO):** A_s = the same Eq. 5.10.6-1 value as S2 (same b = stem height, h = base thickness); bar by `selectBar` with the T&S spacing limit; override `ovr_bar_s4` / `ovr_spc_s4`. New check `tsFF` "Stem Front T&S (S4)". ACI: no S4, a note.
- **Before / after** (`git diff -U0`, calculation, inputs, saved-field default):
```diff
@@ -2890,0 +2899 @@ function calcAll(inp) {
+  const fy_TS = Math.min(inp.fy / 1000, 75);   // RWFF (2026-11-07): AASHTO 10th Eq. 5.10.6-1 takes f_y ≤ 75.0 ksi (S2, S4, F3)
@@ -2892 +2901 @@ function calcAll(inp) {
-    ? Math.min(0.60, Math.max(0.11, 1.30 * b_TS_stem * inp.ts_bot / (2 * (b_TS_stem + inp.ts_bot) * (inp.fy / 1000))))
+    ? Math.min(0.60, Math.max(0.11, 1.30 * b_TS_stem * inp.ts_bot / (2 * (b_TS_stem + inp.ts_bot) * fy_TS)))
@@ -2923,0 +2933,5 @@ function calcAll(inp) {
+  // RWFF (2026-11-07): AASHTO 10th Art. 5.10.6 — T&S steel on each face and in each direction: the front face of the stem gets
+  // vertical bars S4 with the same A_s as S2 (same b = stem height, h = base thickness). ACI: not required (cantilever retaining
+  // walls are exempt from two layers, ACI 318-19 §11.7.2.3; the stem is a one-way slab, §13.3.6.1).
+  const As_ff_stem = isAASHTO ? As_temp_stem : 0;
+  const sel_ff     = isAASHTO ? applyOvr('s4', As_ff_stem, selectBar(As_ff_stem, tsMaxS(inp.ts_bot))) : null;
@@ -3323 +3337 @@ function calcAll(inp) {
-    ? Math.min(0.60, Math.max(0.11, 1.30 * b_TS_ftg * inp.tf / (2 * (b_TS_ftg + inp.tf) * (inp.fy / 1000))))
+    ? Math.min(0.60, Math.max(0.11, 1.30 * b_TS_ftg * inp.tf / (2 * (b_TS_ftg + inp.tf) * fy_TS)))   // RWFF: f_y ≤ 75 ksi
@@ -3486,0 +3501 @@ function calcAll(inp) {
+    ...(isAASHTO ? { tsFF: { ok: sel_ff.As_prov >= As_ff_stem - 0.001, label: 'Stem Front T&amp;S (S4)' } } : {}),   // RWFF
@@ -3595,0 +3611 @@ function calcAll(inp) {
+    fy_TS, As_ff_stem, sel_ff,   // RWFF
@@ -3661,0 +3678 @@ function getInputs() {
+      s4: { bar: Math.round(n('ovr_bar_s4')), spc: n('ovr_spc_s4') },   // RWFF
@@ -5852 +5877 @@ const RWTB_FIELDS = ['proj_date', 'proj_chkdate'];   // RWTB (2026-11-06): the o
-const RWLS_DEF = { aashto_traffic_dir: 'parallel', toe_hook: false };   // RWLS (2026-11-07) / RWDS (toe_hook): saved only when not the default; absent → the default
+const RWLS_DEF = { aashto_traffic_dir: 'parallel', toe_hook: false, ovr_bar_s4: '0', ovr_spc_s4: '0' };   // RWFF: + the S4 override (saved only when set)   // RWLS (2026-11-07) / RWDS (toe_hook): saved only when not the default; absent → the default
```

### RWFF-2. Display
- **Stem design Step 6:** title and reference by mode; f_y used shown in the where-list; S4 bar selection (AASHTO) or the ACI note.
- **Dashboard row** "Stem Front T&S (S4)" (→ Step 6); Overview bars list; Rebar schedule tab row S4.
- **Report:** Step 6 `stb/s6.S4` (AASHTO check, ACI note); f_y used in the S2 and F3 substitutions; bar schedule row S4; input echo of the S4 override.
- **Drawings sheet 2:** S4 drawn on the front face from the joint to the top cover, label "S4 … FRONT FACE, VERT. T&S, AASHTO 5.10.6", bar schedule row S4. In ACI mode the old note "FRONT-FACE VERTICALS: NOT IN THE MODEL (BY THE ENGINEER)" becomes "NOT REQUIRED (ACI 318-19 11.7.2.3 / 13.3.6.1)".
- **Input:** Rebar tab, "S4 — Stem vert. front face T&S (AASHTO)" (AASHTO only); validated only in AASHTO mode.

### Check cases (`calcAll` in Node and in the browser)
- **AASHTO default** (H_s 12 ft → b = 144 in, h = 18 in, f_y 60 ksi): A_s = 1.30·144·18 / (2·(144 + 18)·60) = 3369.6 / 19440 = **0.1733 in²/ft per face** → S4 **#3@7** (0.1886 ≥ 0.1733, D/C 0.92, PASS). S2 and F3 unchanged (0.1733, #3@7; 0.1741, #3@7).
- **AASHTO, f_y = 80 ksi:** f_y used = 75 ksi. S2: 3369.6 / (324·75) = **0.1387** (was 0.1300 with 80 ksi), #3@10 → **#3@9**. F3: 0.1306 → **0.1393**, #3@10 → #3@9. S4: 0.1387, #3@9.
- **ACI default and ACI f_y 80:** unchanged (0.0018·12·18 = 0.3888, #4@6); no S4; note shown.

### How verified
- origin/main vs branch, headless Chromium, the twelve audit walls + AASHTO f_y 80 + ACI f_y 80. `_R` differs only by the new fields (`fy_TS`, `As_ff_stem`, `sel_ff`, `inp.ovr.s4`) and `checks.tsFF` (AASHTO), except AASHTO f_y 80, where also `As_temp_stem`, `sel_temp`, `As_ftg_long` and `sel_ftg_long` change as above. Export JSON and localStorage are identical (the S4 override is saved only when set). 0 console errors.
- Tests: check-syntax; smoke/retaining-wall-checks (table `AUD`: the RWFF cases); phone-layout rwall 390/768; project-library retwall (its "results identical" steps list only the new items); dxf-print-sheets rw.
- Screenshots looked at: AASHTO Stem Step 6, Drawings sheet 2.

### Saved data
- `ovr_bar_s4` / `ovr_spc_s4` are additive and saved only when not 0 (`RWLS_DEF`). Old saves and default projects are unchanged.

## 2026-11-07 — PR: claude/rw-shear-key — Shear key: structural design (ACI plain concrete first, else reinforced K1; AASHTO reinforced), key width input b_k; "no sliding credit" note when passive is off (RWSK; calculation change: new checks) (PR #951: https://github.com/mlococo88/All-Structural/pull/951)

Calculation audit, item 6 (a) and (b). Engineer decision (2026-11-07). Code sites are tagged `RWSK`. Walls without a key are unchanged.

### RWSK-1. Input, calculation   [§4: new checks]
- **New input** "Shear Key Width b_k" (`key_bk`, default 12 in, Design tab under the key depth). It is saved only when not 12 in (`RWLS_DEF`); old projects open with 12 in.
- **Demand:** the key is a cantilever from the footing underside, loaded by the passive pressure on its depth. The pressure is a trapezoid from p_top = K_p γ_s D_f to p_bot = K_p γ_s (D_f + d_k), the same as the existing P_p,key.
  - P_k = (p_top + p_bot)/2 · d_k.
  - M_k = p_top d_k²/2 + (p_bot − p_top) d_k²/6.
  - Factored with 1.6 in ACI (passive taken as H, ACI 318-19 §5.3.8) or 1.50 in AASHTO (passive taken as EH max, Table 3.4.1-2).
  - The key is designed whenever one is entered, passive on or off.
- **ACI, plain concrete first** (ACI 318-19 Ch. 14, verified in the PDF, pp. 208–209):
  - h = b_k − 2 in (cast against soil, §14.5.1.7).
  - M_n = min(5λ√f'c, 0.85 f'c)·S_m (§14.5.2.1).
  - V_n = (4/3)λ√f'c b h (Table 14.5.5.1(a); R14.5.5.1 names shear keys).
  - φ = 0.60 (Table 21.2.1(i), PDF p. 393).
- **Reinforced (ACI when plain fails; AASHTO always):** K1 bars on the toe face, d = b_k − c_c − d_b/2.
  - Flexure φ 0.90 with A_s,min `asMin` (ACI 0.0018 A_g; AASHTO 1.33M_u / M_cr).
  - One-way shear `shearVc`, φ 0.75 (ACI) / 0.90 (AASHTO).
  - Development: hooked up into the footing, ℓ_dh ≤ t_f − c_c. Straight down into the key, ℓ_d ≤ d_k − c_c; if ℓ_d does not fit, a standard hook at the key bottom, ℓ_dh ≤ d_k − c_c.
  - Provisions: ACI §22.2 / Table 22.5.5.1(c) / §25.4; AASHTO 5.6.3 / 5.7.3 / 5.10.8.2.1a / 5.10.8.2.4a.
- **New checks** `keyFlex`, `keyShear`, and `keyDev` (reinforced only).
- **Decisions (pending engineer review):**
  - The key is designed whether or not passive is counted (conservative: the key can still be loaded).
  - AASHTO has no article specific to keys; Section 5 is used with passive as EH 1.50, per the engineer's decision.
  - K1 is hooked at the key bottom when straight ℓ_d does not fit.
  - The key stays centred under the stem, as drawn before.
  - Water is not considered on the key face (as for P_p).
- **Before / after** (`git diff -U0`, calculation, input and drawing geometry):
```diff
@@ -3340,0 +3345,51 @@ function calcAll(inp) {
+  // ── RWSK (2026-11-07): structural design of the shear key (engineer decision, audit item 6a) ──
+  // Cantilever from the footing underside, loaded by the passive pressure on its depth (trapezoid p_top = K_p γ D_f to
+  // p_bot = K_p γ (D_f + d_k), the same pressure as P_p,key), factored as H 1.6 (ACI 318-19 §5.3.8) or EH max 1.50 (AASHTO 10th
+  // Table 3.4.1-2). Designed whenever a key is entered, passive on or off. ACI: plain concrete first (Ch. 14: h = b_k − 2 in,
+  // §14.5.1.7; M_n = 5λ√f'c S_m ≤ 0.85 f'c S_m, §14.5.2.1; V_n = (4/3)λ√f'c b h, Table 14.5.5.1(a); φ = 0.60, Table 21.2.1(i)),
+  // reinforced (K1 bars on the toe face, hooked into the footing) if it fails. AASHTO: reinforced (Section 5).
+  let keyR = null;
+  if (inp.useShearKey && dk_ft > 0) {
+    const bk = inp.key_bk > 0 ? inp.key_bk : 12;
+    const gP = isAASHTO ? 1.50 : 1.6;
+    const p_top = Kp * inp.gamma_s * Df, p_bot = Kp * inp.gamma_s * (Df + dk_ft);
+    const P_k = (p_top + p_bot) / 2 * dk_ft;                                        // lb/ft (= P_p,key)
+    const M_k = p_top * dk_ft * dk_ft / 2 + (p_bot - p_top) * dk_ft * dk_ft / 6;    // lb·ft/ft at the footing underside
+    const Vu = gP * P_k, Mu = gP * M_k;
+    const sq = Math.sqrt(inp.fc);
+    const h_pl = bk - 2, S_pl = bw * h_pl * h_pl / 6;
+    const Mn_pl = h_pl > 0 ? Math.min(5 * sq * S_pl, 0.85 * inp.fc * S_pl) / 12 : 0;
+    const Vn_pl = h_pl > 0 ? 4 / 3 * sq * bw * h_pl : 0;
+    const phiMn_pl = 0.60 * Mn_pl, phiVn_pl = 0.60 * Vn_pl;
+    const plain_flex_ok = Mu <= phiMn_pl, plain_shear_ok = Vu <= phiVn_pl;
+    const plain = !isAASHTO && plain_flex_ok && plain_shear_ok;
+    let rf = null;
+    if (!plain) {
+      const cov = inp.cov_ftg, maxS = isAASHTO ? Math.min(1.5 * bk, 18) : Math.min(3 * bk, 18);
+      let d = bk - cov - 0.375, sel = null, As_req = 0, As_min = 0, As_des = 0, os = false;
+      for (let pass = 0; pass < 2 && d > 0; pass++) {
+        const Rn = Mu * 12 / (0.9 * bw * d * d), disc = 1 - 2 * Rn / (0.85 * inp.fc);
+        os = disc < 0;
+        As_req = os ? 0 : (0.85 * inp.fc / inp.fy) * (1 - Math.sqrt(disc)) * bw * d;
+        As_min = asMin(d, bk, Mu * 12, 0.9);
+        As_des = Math.max(os ? As_min : As_req, As_min);
+        sel = selectBar(As_des, maxS);
+        d = bk - cov - sel.bar.db / 2;
+      }
+      const a = sel.As_prov * inp.fy / (0.85 * inp.fc * bw), phiMn = 0.9 * sel.As_prov * inp.fy * (d - a / 2) / 12;
+      const sh = shearVc(d, bk, sel.As_prov, Mu, Vu, dk_ft), phiV = isAASHTO ? 0.90 : 0.75, phiVc = phiV * sh.Vc;
+      const db = sel.bar.db;
+      const ldP = isAASHTO ? devLengthAASHTOParts(db, inp.fy, inp.fc, false, cov + db / 2, sel.spacing) : null;
+      const ld = isAASHTO ? devLengthAASHTO(db, inp.fy, inp.fc, false, cov + db / 2, sel.spacing)
+                          : devLength(db, inp.fy, inp.fc, 1.0, 1.0, cov + db / 2, 1.0, sel.spacing);
+      const ldh = hookDevLength(db, inp.fy, inp.fc, isAASHTO, sel.bar, ldP ? ldP.lam_rc : 1.0);
+      const av_ftg = inp.tf - inp.cov_ftg, av_key = inp.dk - cov;               // hooked up into the footing; down into the key
+      const hook_bot = ld > av_key, need_key = hook_bot ? ldh : ld;                // straight into the key if ℓd fits, else a standard hook at the key bottom
+      rf = { d, As_req, As_min, As_des, os, sel, a, phiMn, sh, phiV, phiVc, ld, ldh, av_ftg, av_key, hook_bot, need_key,
+             flex_ok: !os && sel.As_prov >= As_des - 0.001 && phiMn >= Mu - 1e-6, shear_ok: phiVc >= Vu, dev_ok: ldh <= av_ftg && need_key <= av_key };
+      if (!rf.dev_ok) warnings.push(`Shear key bars K1: ℓdh = ${f(ldh,1)}" into the footing (${f(av_ftg,1)}" available) / ${hook_bot ? 'ℓdh' : 'ℓd'} = ${f(need_key,1)}" into the key (${f(av_key,1)}" available) — deepen the key or the footing, or use smaller bars.`);
+    }
+    keyR = { bk, gP, p_top, p_bot, P_k, M_k, Vu, Mu, h_pl, S_pl, Mn_pl, Vn_pl, phiMn_pl, phiVn_pl, plain_flex_ok, plain_shear_ok, plain, rf,
+             no_credit: !inp.inclPassive };
+  }
+
@@ -3501,0 +3557,4 @@ function calcAll(inp) {
+    ...(keyR ? {   // RWSK
+      keyFlex:  { ok: keyR.plain ? keyR.plain_flex_ok : keyR.rf.flex_ok,   label: 'Key Flex',  val: keyR.plain ? 'plain concrete' : 'K1 ' + keyR.rf.sel.label },
+      keyShear: { ok: keyR.plain ? keyR.plain_shear_ok : keyR.rf.shear_ok, label: 'Key Shear', val: keyR.plain ? 'plain concrete' : undefined },
+      ...(keyR.rf ? { keyDev: { ok: keyR.rf.dev_ok, label: 'Key K1 ℓdh/ℓd' } } : {}) } : {}),
@@ -3611,0 +3671 @@ function calcAll(inp) {
+    keyR,   // RWSK
@@ -3664,0 +3725 @@ function getInputs() {
+    key_bk: n('key_bk') > 0 ? n('key_bk') : 12,   // RWSK (2026-11-07): key width (in)
@@ -5877 +5973 @@ const RWTB_FIELDS = ['proj_date', 'proj_chkdate'];   // RWTB (2026-11-06): the o
-const RWLS_DEF = { aashto_traffic_dir: 'parallel', toe_hook: false, ovr_bar_s4: '0', ovr_spc_s4: '0' };   // RWFF: + the S4 override (saved only when set)   // RWLS (2026-11-07) / RWDS (toe_hook): saved only when not the default; absent → the default
+const RWLS_DEF = { aashto_traffic_dir: 'parallel', toe_hook: false, ovr_bar_s4: '0', ovr_spc_s4: '0', key_bk: '12' };   // RWSK: + key width (saved only when not 12 in; absent = 12 in)   // RWFF: + the S4 override (saved only when set)   // RWLS (2026-11-07) / RWDS (toe_hook): saved only when not the default; absent → the default
@@ -10265,2 +10386,2 @@ function rwdwGeo(r) {
-  // shear key: width not in the model; drawn as the tool's own section drawings (0.36 t_s,base wide, 0.32 t_s,base from the front face)
-  G.kw = 0.36 * G.tsb; G.kx = G.xf + 0.32 * G.tsb;
+  // shear key: width b_k (input, RWSK; before 2026-11-07 drawn nominal 0.36 t_s,base wide), centred under the stem
+  G.kw = inp.key_bk || 12; G.kx = G.xf + G.tsb / 2 - G.kw / 2;   // RWSK (2026-11-07): key width = the input b_k (was 0.36 t_s,base, drawn nominal), centred under the stem as before
```

### RWSK-2. Display
- **Footing design tab:** new card "Shear Key — Structural Design": pressures, demand, plain checks (ACI), K1 design, development. Dashboard rows "Key Flex", "Key Shear" and "Key K1 ℓdh/ℓd" link to it.
- **(b) "No sliding credit" note:** when a key is entered and "Include passive" is off, the note reads "Shear key gives no sliding credit: passive resistance is off (MassDOT BDM 3.3.1.1 neglects passive in front of the wall)". It appears:
  - under the key input;
  - in the sliding check (ACI Step 5, AASHTO Step 4);
  - on the key card and in the Report.
- **Report:** sub "Shear key (b_k, d_k)" in Footing design (`key/*`); K1 in the bar schedule; b_k in the input echo.
- **Overview input table, cross-sections, 3D view and drawings:** the key is drawn b_k wide, centred under the stem. Before, the drawings used a nominal 0.36·t_s,base and the 3D view 0.40·t_s,base.
  - Sheet 1: "SHEAR KEY, B_K = …" (was "WIDTH NOT IN THE MODEL, DRAWN NOMINAL").
  - Sheet 2: the K1 bar and its note "PLAIN CONCRETE (ACI 318-19 CH. 14)" or "K1 … TOE FACE, HOOKED INTO THE FOOTING" (was "NO REINFORCEMENT DESIGNED IN THE TOOL"); bar schedule row K1.

### Check cases (`calcAll` in Node and in the browser; default wall, φ = 30°, K_p = 3.0, D_f = 1.5 ft)
- **ACI, 12-in key, passive on:**
  - p_top = 3·120·1.5 = 540 psf; p_bot = 900 psf.
  - P_k = 720 lb/ft; M_k = 540·1/2 + 360·1/6 = 330 lb·ft/ft.
  - V_u = 1152, M_u = 528.
  - Plain concrete, h = 10 in, S_m = 200 in³:
    - φM_n = 0.6·5·63.25·200/12 = **3162** → D/C **0.167**;
    - φV_n = 0.6·(4/3)·63.25·12·10 = **6072** → D/C **0.190**.
  - **Plain OK.** Sliding FS 1.964 (unchanged).
- **ACI, 36-in key:**
  - P_k = 3240, M_k = 540·9/2 + 1080·9/6 = 4050.
  - M_u = **6480 > 3162** → reinforced. d = 8.75 in.
  - A_s,req 0.1669 < A_s,min 0.0018·12·12 = 0.2592 → **K1 #4@9** (0.267).
  - φM_n 10 265 ≥ 6480; φV_c 5436 ≥ V_u 5184.
  - ℓ_dh 8.5 ≤ 15; ℓ_d 12 ≤ 33. OK.
- **AASHTO, 12-in key:**
  - M_u = 1.50·330 = 495; V_u 1080.
  - Reinforced: A_s,min 0.0166 → K1 #3@18; φM_n 2890.
  - ℓ_d 12 > d_k − c_c = 9, so K1 is hooked at the key bottom: ℓ_dh 7.3 ≤ 9 OK.
- **AASHTO, 36-in key:** M_u 6075 → K1 #3@6, φM_n 8564, all OK.
- **ACI, 12-in key, passive off:** sliding FS 1.656 (no key credit), the note shown, the key designed as above.
- **Walls without a key:** unchanged, no key rows.

### How verified
- origin/main vs branch, headless Chromium: the twelve audit walls plus ACI 12-in key (passive on / off), ACI 36-in key and AASHTO 12-in key. `_R` differs only by the new `keyR` and `inp.key_bk` fields; walls with a key also gain the new key checks (and the ACI mix wall, which has an 18-in key, gains them too). Every existing value is identical. Export JSON and localStorage are identical (b_k is saved only when not 12 in). 0 console errors.
- Tests: check-syntax; smoke/retaining-wall-checks (table `AUD`: the RWSK cases); phone-layout rwall 390/768; project-library retwall (its "results identical" comparisons list only `keyR` / `inp.key_bk`); dxf-print-sheets rw.
- Screenshots looked at: Footing tab key card (ACI 36-in key), Drawings sheet 2 (AASHTO 12-in key, K1).

### Saved data
- `key_bk` is additive (saved only when not 12 in; absent = 12 in). No other change.

## 2026-11-07 — PR: claude/rw-aashto-ee1 — AASHTO Extreme Event I (seismic) stability per Art. 11.6.5.1: P_AE + 0.5P_IR and max(0.5P_AE, P_A) + P_IR; φ 1.0 sliding, 0.8 bearing; e limit B/3 to 0.4B by γ_EQ (RWE1; calculation change: new checks) (PR #952: https://github.com/mlococo88/All-Structural/pull/952)

Calculation audit, item 9 (1). Engineer decision (2026-11-07). Code sites are tagged `RWE1`. ACI mode is unchanged (item 9 (2) follows).

### RWE1-1. `calcAll` (AASHTO block)   [§4: new checks; replaces the warning "Extreme Event I stability is not evaluated"]
- **Provisions (verified in the AASHTO LRFD 10th Ed. (2024) PDF; cited and paraphrased):**
  - **Art. 11.6.5.1:** gravity and semigravity walls are checked for sliding (10.6.3.4), bearing (11.6.3) and overall stability with the seismic earth pressure and the inertial forces, using Extreme Event I factors (11.5.8).
    - The total seismic force combines P_AE and P_IR = k_h(W_w + W_s), with W_s the soil immediately above the wall, including the heel.
    - It is investigated in two non-concurrent cases: (1) 100 % P_AE + 50 % P_IR; (2) 50 % P_AE, but not less than the static active force, + 100 % P_IR.
    - The resultant must lie within the middle 2/3 of the base for γ_EQ = 0 and within the middle 8/10 for γ_EQ = 1.0, interpolated between.
  - **Art. 11.5.8:** φ = 1.0 for the extreme event, except φ = 0.8 for bearing of gravity and semigravity walls (and 0.9 for overall stability, not computed by the tool).
  - **Art. 11.6.5.3:** M-O P_AE, resultant at H/3 (the tool's K_AE, unchanged).
- **Loads:**
  - P_AE = ½K_AE γ_s H′²(1 − k_v), horizontal, at H′/3, where H′ is the static pressure height (H with no slope).
  - P_A = the static P_EH at its own height.
  - W_w = footing + stem + barrier; W_s = soil over the heel (with the wedge); y_IR = their combined centroid.
  - DC, EV, ES (lateral and vertical) and water (WA) at 1.0; LS at the new input γ_EQ (default 0): lateral, and vertical in bearing only.
  - Column: DL + γ_EQ·LL, in bearing only.
  - Friction R = V tan δ_b + P_p (φ = 1.0); q_R = 0.8 q_n.
- **New input** "γ_EQ on live load / LS (Extreme Event I)" (`aashto_gamma_eq`, AASHTO only, default 0, saved only when not 0). New checks `eeSliding`, `eeEcc`, `eeBearing`.
- **Warnings:**
  - AASHTO: the "not evaluated" warning is removed.
  - AASHTO: the seismic note now says Extreme Event I is checked and the stem and footing are not designed for it.
  - The ΔP_E at 0.6H warning (an ACI-branch quantity) is shown in ACI mode only.
- **Decisions (pending engineer review):**
  - Vertical components of P_AE and P_A are neglected (conservative).
  - P_AE uses the moist γ_s, with water as hydrostatic at 1.0.
  - P_AE is taken on H′, the plane of the static analysis.
  - η is 1.0.
  - Overall (global) stability, φ 0.9, is not computed (as for the static case).
- **Before / after** (`git diff -U0`, `calcAll`):
```diff
@@ -2083 +2089 @@ function calcAll(inp) {
-    warnings.push(`Seismic: ΔPe = ${f(Pe_inc/1000,3)} k/ft acting at 0.6H = ${f(0.6*H,2)} ft. Add to O.T. check. Verify with geotechnical engineer.`);
+    if (inp.basis !== 'AASHTO') warnings.push(`Seismic: ΔPe = ${f(Pe_inc/1000,3)} k/ft acting at 0.6H = ${f(0.6*H,2)} ft. Add to O.T. check. Verify with geotechnical engineer.`);   // RWE1: ACI branch only (AASHTO: Extreme Event I)
@@ -2185,2 +2191,2 @@ function calcAll(inp) {
-    warnings.push('Seismic: stem and footing are NOT designed for the seismic case — the increment is applied to stability only, and wall/soil inertia (AASHTO 11.6.5.1 P_IR) is not included.');
-    if (isAASHTO) warnings.push('Seismic: AASHTO Extreme Event I stability is not evaluated — the k_h input currently affects only the ASD/ACI branch.');
+    warnings.push(isAASHTO ? 'Seismic: Extreme Event I stability is checked (Art. 11.6.5.1: P_AE and wall inertia P_IR, Stability Step 7a); the stem and footing are NOT designed for the seismic case.'   // RWE1
+                           : 'Seismic: stem and footing are NOT designed for the seismic case — the increment is applied to stability only, and wall/soil inertia (AASHTO 11.6.5.1 P_IR) is not included.');
@@ -2717,0 +2724,38 @@ function calcAll(inp) {
+    // ── RWE1 (2026-11-07): EXTREME EVENT I (seismic) stability — AASHTO LRFD 10th Art. 11.6.5.1 (engineer decision, audit item 9(1)) ──
+    // Two non-concurrent cases: (1) P_AE + 0.5P_IR; (2) max(0.5P_AE, P_A) + P_IR, P_IR = k_h(W_w + W_s). P_AE = ½K_AEγH′²(1 − k_v)
+    // (M-O K_AE as above), horizontal, at H′/3; P_A = the static active force P_EH at its own height. Other loads at γ = 1.0 (DC, EV,
+    // ES lateral and vertical, water WA), LS at γ_EQ (lateral; vertical only for bearing). φ = 1.0 sliding (Art. 11.5.8),
+    // φ_b = 0.8 bearing (semigravity walls, Art. 11.5.8). e within the middle 2/3 (γ_EQ = 0) to 8/10 (γ_EQ = 1.0) of B, interpolated.
+    let ee1 = null;
+    if (hasSeismic && Kae > 0) {
+      const gEQ = Math.min(1, Math.max(0, A.gamma_eq || 0));
+      const P_AE = 0.5 * Kae * inp.gamma_s * Hp * Hp * (1 - inp.kv), y_AE = Hp / 3;
+      const Ww = Wftg + Wstem + W_bar, Ws = Wsoil;
+      const y_stem_c = tf_ft + inp.Hs * (ts_bot_ft + 2 * ts_top_ft) / (3 * (ts_bot_ft + ts_top_ft));
+      const y_IR = (Wftg * tf_ft / 2 + Wstem * y_stem_c + W_bar * (H + bar_h_ft / 2) + Wsoil_rect * (tf_ft + inp.Hs / 2) + Wwedge * (H + dH_slope / 3)) / Math.max(Ww + Ws, 1e-9);
+      const P_IR = inp.kh * (Ww + Ws);
+      const H_oth = P_ES + gEQ * P_LS + P_hyd, M_oth = P_ES * y_ES + gEQ * P_LS * y_LS + P_hyd * y_hyd;
+      const V_min  = V_DC + W_bar + Wsoil + V_ES_v - V_up;                         // resisting vertical (sliding, e)
+      const Mr_min = Wftg * x_ftg + Wstem * x_stem + W_bar * x_bar + Wsoil * x_soil + V_ES_v * xESv - M_up;
+      const V_colE = pDL + gEQ * (pLL + pSL);
+      const V_max  = V_min + gEQ * V_LS_v + V_colE;                                 // bearing
+      const Mr_max = Mr_min + gEQ * V_LS_v * xLSv + V_colE * x_col;
+      const phiS = 1.0, phiB = 0.8;
+      const R = phiS * V_min * tanDelta + phiS * Pp;
+      const eLim = B * (1 / 3 + (0.4 - 1 / 3) * gEQ);
+      const q_n = useManualQn ? A.qR / Math.max(A.phi_b, 1e-6) : q_n_A, q_R = phiB * q_n;
+      const mk = (PA, yA, PI) => {
+        const Hd = PA + PI + H_oth, Mo = PA * yA + PI * y_IR + M_oth;
+        const xR = V_min > 0 ? (Mr_min - Mo) / V_min : B / 2, e = B / 2 - xR;
+        const xRb = V_max > 0 ? (Mr_max - Mo) / V_max : B / 2, eb = B / 2 - xRb, Be = B - 2 * Math.abs(eb);
+        const q = onRock ? qRock(V_max, eb) : (Be > 0 ? V_max / Be : 999999);
+        return { PA, yA, PI, H: Hd, dcS: Hd / Math.max(R, 1e-9), Mo, xR, e, dcE: Math.abs(e) / eLim, xRb, eb, Be, q, dcB: q / q_R };
+      };
+      const PA2 = Math.max(0.5 * P_AE, P_EH);
+      const c1 = mk(P_AE, y_AE, 0.5 * P_IR), c2 = mk(PA2, 0.5 * P_AE > P_EH ? y_AE : y_EH, P_IR);
+      ee1 = { gEQ, P_AE, y_AE, Kae, P_A: P_EH, y_A: y_EH, Ww, Ws, y_IR, P_IR, H_oth, M_oth, V_min, Mr_min, V_colE, V_max, Mr_max, phiS, phiB, R, eLim, q_n, q_R, c1, c2,
+        sliding_dcr: Math.max(c1.dcS, c2.dcS), ecc_dcr: Math.max(c1.dcE, c2.dcE), bearing_dcr: Math.max(c1.dcB, c2.dcB),
+        e_gov: Math.abs(c1.e) >= Math.abs(c2.e) ? c1.e : c2.e, q_gov: Math.max(c1.q, c2.q) };
+      ee1.sliding_ok = ee1.sliding_dcr <= 1 + 1e-9; ee1.ecc_ok = ee1.ecc_dcr <= 1 + 1e-9; ee1.bearing_ok = ee1.bearing_dcr <= 1 + 1e-9;
+    }
+
@@ -2718,0 +2763 @@ function calcAll(inp) {
+      ee1,   // RWE1
@@ -3567,0 +3613,5 @@ function calcAll(inp) {
+    ...(isAASHTO && aashtoR && aashtoR.ee1 ? {   // RWE1
+      eeSliding: { ok: aashtoR.ee1.sliding_ok, label: 'EQ Sliding', val: `DCR=${f(aashtoR.ee1.sliding_dcr,2)}` },
+      eeEcc:     { ok: aashtoR.ee1.ecc_ok,     label: 'EQ Eccentricity', val: `e=${f(Math.abs(aashtoR.ee1.e_gov),2)}≤${f(aashtoR.ee1.eLim,2)}ft` },
+      eeBearing: { ok: aashtoR.ee1.bearing_ok, label: 'EQ Bearing', val: `${f(aashtoR.ee1.q_gov/1000,2)}≤${f(aashtoR.ee1.q_R/1000,2)}ksf` },
+    } : {}),
```

### RWE1-2. Display
- **Stability tab:**
  - new card "Step 7a — Extreme Event I (Seismic) Stability": P_AE, P_IR, V, M_r, and sliding, e and bearing for each case;
  - an EE I row in the Load Combination Summary.
- **Dashboard rows** "EQ Sliding", "EQ Eccentricity" and "EQ Bearing" (→ Step 7a).
- **Report:** a summary-table row and the sub "Step 7a — Extreme Event I" (`sa7a/*`).
- **Drawings:** the loads note and general note 10 give the EE I results (before: "not evaluated").
- **Seismic card:** the γ_EQ input and a hint (AASHTO).

### Check cases (`calcAll` in Node and in the browser; AASHTO default, k_v 0, δ_MO 0, γ_EQ 0)
- **k_h = 0.10:** θ = 5.71°, K_AE = 0.3966.
  - P_AE = ½·0.3966·120·13.5² = **4336** lb/ft; P_A = 3645.
  - W_w = 5062.5, W_s = 11520 → P_IR = 0.10·16582.5 = **1658** at 6.30 ft.
  - V = 16582.5, M_r = 123673; R = 16582.5·tan 20° = **6036**.

  | Case | H | Sliding D/C | M_o | e (≤ B/3 = 4.167) | q = V/(B − 2e) vs 7200 |
  |---|---|---|---|---|---|
  | 1: P_AE + 0.5P_IR | 5165 | **0.856** | 24738 | 0.284 | 1390 |
  | 2: P_A + P_IR | 5303 | **0.879** | 26851 | 0.411 | 1420 |

  Before: not evaluated. Strength I sliding D/C 1.415 is unchanged.
- **k_h = 0.20:** K_AE 0.4733, P_AE 5175, P_IR 3317. Sliding **1.132 / 1.153, FAIL**; e 0.826 / 1.041; q 1529 / 1592.
- **k_h 0.10, γ_EQ = 1.0:** e limit 0.4B = 5.0 ft; LS lateral added: sliding 1.122 / 1.145 (FAIL).

### How verified
- origin/main vs branch, headless Chromium, the twelve audit walls plus AASHTO k_h 0.10, k_h 0.20 and k_h 0.10 + water + q_s + collision.
  - Walls without k_h, and every ACI wall (including the seismic ones): `_R` differs only by `aashtoR.ee1` (null) and `inp.aashto.gamma_eq`.
  - AASHTO seismic walls also gain the EE I fields and checks, and their seismic warnings change as described.
  - Every existing value is identical. 0 console errors.
- Tests: check-syntax; smoke/retaining-wall-checks (table `AUD`: RWE1 k_h 0.10 and 0.20); phone-layout rwall 390/768; project-library retwall; dxf-print-sheets rw.
- Screenshot looked at: Stability Step 7a (AASHTO k_h 0.10).

### Saved data
- `aashto_gamma_eq` is additive (saved only when not 0; absent = 0).

## 2026-11-07 — PR: claude/rw-aci-ibc-seismic — ACI/IBC mode with earthquake: static FS 1.5 with E = 0, and 0.7 × ΔP_E with FS 1.1 (IBC 2018 §1807.2.3 and Exception); IBC cited as 2018 (RWIB; calculation change) (PR #953: https://github.com/mlococo88/All-Structural/pull/953)

Calculation audit, item 9 (2). Engineer decision (2026-11-07). Code sites are tagged `RWIB`. AASHTO checks are unchanged; `FOS_OT` / `FOS_SL` are ACI-mode checks.

### RWIB-1. `calcAll`   [§4]
- **Provision (verified in the IBC 2018 PDF; cited and paraphrased):**
  - IBC 2018 §1807.2.3: retaining walls resist sliding and overturning with a safety factor of 1.5. The Section 1605 combinations do not apply; design uses 0.7 × the nominal earthquake load and 1.0 × the other nominal loads, with variable loads also investigated at zero.
  - **Exception:** where earthquake loads are included, the minimum safety factor for sliding and overturning is 1.1.
  - The tool cited IBC 2021, which is not in the references. Every "IBC 2021" citation and label in the tool now reads "IBC 2018" (14 places, including the mode label). §1807.2 of the 2021 edition was not checked.
- **Before:** with k_h > 0, FOS_OT = M_stab,OT / (M_o + 1.0·M_o,E) and FOS_SL = F_r / (F_h + 1.0·ΔP_E), both ≥ 1.5.
- **After:**
  - FOS_OT = M_stab,OT / (M_o − M_o,E) and FOS_SL = F_r / F_h, the static case, ≥ 1.5;
  - with earthquake (k_h > 0): FOS_OT,E = M_stab,OT / (M_o − M_o,E + 0.7·M_o,E) and FOS_SL,E = F_r / (F_h + 0.7·ΔP_E), ≥ 1.1. New checks `otE` and `slidingE`.
  - M_o (incl. 1.0·M_o,E) still gives x̄, e and the service bearing pressure, unchanged.
  - ΔP_E stays at 0.6H (Seed–Whitman), as decided.
- **Results move** only for ACI walls with k_h > 0. Pass/fail can become less conservative (as the engineer decided).
- **Before / after** (`git diff -U0`, `calcAll`):
```diff
@@ -2342 +2342,6 @@ function calcAll(inp) {
-  const FOS_OT = Mo > 0 ? Ms_OT / Mo : 999;
+  // RWIB (2026-11-07): IBC 2018 §1807.2.3 — FS 1.5 on sliding and overturning with the earthquake load set to zero (static case),
+  // and, where earthquake loads are included, 0.7 × the nominal earthquake load with FS ≥ 1.1 (Exception). Before: one check,
+  // 1.0·ΔP_E included, against 1.5. M_o (incl. 1.0·M_o,E) still drives x̄, e and the service bearing (unchanged).
+  const Mo_st    = Mo - Mo_seis;
+  const FOS_OT   = Mo_st > 0 ? Ms_OT / Mo_st : 999;
+  const FOS_OT_E = hasSeismic ? (Mo_st + 0.7 * Mo_seis > 0 ? Ms_OT / (Mo_st + 0.7 * Mo_seis) : 999) : null;
@@ -2351 +2356,2 @@ function calcAll(inp) {
-  const FOS_SL = Fh  > 0 ? Fr / (Fh + (hasSeismic ? Pe_inc : 0)) : 999;
+  const FOS_SL = Fh  > 0 ? Fr / Fh : 999;   // RWIB: static case (E = 0), FS ≥ 1.5
+  const FOS_SL_E = hasSeismic ? (Fh + 0.7 * Pe_inc > 0 ? Fr / (Fh + 0.7 * Pe_inc) : 999) : null;   // RWIB: 0.7E, FS ≥ 1.1
@@ -3575,0 +3582 @@ function calcAll(inp) {
+    ...(hasSeismic ? { otE: { ok: FOS_OT_E >= 1.1, label: 'O.T. (0.7E)', val: `FOS=${f(FOS_OT_E)}` }, slidingE: { ok: FOS_SL_E >= 1.1, label: 'Sliding (0.7E)', val: `FOS=${f(FOS_SL_E)}` } } : {}),   // RWIB
@@ -3657 +3664 @@ function calcAll(inp) {
-    hasSeismic, Pae, Pe_inc, Mo_seis, Kae,
+    hasSeismic, Pae, Pe_inc, Mo_seis, Kae, Mo_st, FOS_OT_E, FOS_SL_E,   // RWIB
```

### RWIB-2. Display
- **Stability Steps 4 and 5:** the static check (E = 0), plus the 0.7E check with FOS ≥ 1.1. Card references are IBC 2018.
- **Dashboard rows** "O.T. (0.7E)" and "Sliding (0.7E)".
- **Report:** steps `st4/FOSE` and `st5/FOSE`; the static FOS labelled "earthquake set to zero".
- **Drawings:** sheet note "WITH 0.7E: …"; IBC 2018 in the notes.

### Check cases (`calcAll` in Node and in the browser)
- **ACI default, k_h = 0.10:** ΔP_E = 691.3 lb/ft at 0.6H = 8.1 ft, so M_o,E = 5600 lb·ft/ft. M_o = 22002 (static 16403). M_stab,OT = 123673.
  - **Before:** FOS_OT = 123673/22002 = 5.62; FOS_SL = 6035.5/(3645 + 691.3) = **1.392 < 1.5, FAIL**.
  - **After, static:** FOS_OT = 123673/16403 = **7.54**; FOS_SL = 6035.5/3645 = **1.656 ≥ 1.5**.
  - **After, 0.7E:** FOS_OT,E = 123673/(16403 + 3920) = **6.09**; FOS_SL,E = 6035.5/(3645 + 483.9) = **1.462 ≥ 1.1, PASS**.
  - q_max 1402 psf (unchanged).
- **ACI tall wall + water + k_h 0.15:**
  - Before: FS_OT 1.948, FS_SL 0.452.
  - After: static 2.724 / 0.541; 0.7E 2.130 / 0.475 (sliding still FAIL).
- **k_h = 0 walls:** unchanged.

### Open item (found, not changed)
- With k_h > 0 the **service bearing check and e use M_o with 1.0·ΔP_E only**; the static case (E = 0) is not checked for bearing. At the ACI default with k_h 0.10, static q_max = 1466 psf > the 1402 psf checked. This is a separate, small §4 change, left for the engineer.

### How verified
- origin/main vs branch, headless Chromium, the twelve audit walls + ACI k_h 0.10 + AASHTO k_h 0.10.
  - Only the seismic ACI walls (mix, tall, k_h 0.10) change: `FOS_OT`, `FOS_SL`, `checks.ot` / `sliding` values, plus the new `Mo_st`, `FOS_OT_E`, `FOS_SL_E` and checks.
  - The AASHTO seismic wall also changes `FOS_OT` / `FOS_SL`, which are not used in AASHTO mode.
  - Every other value is identical.
  - Text differs by the IBC 2018 citations.
- Tests: check-syntax; smoke/retaining-wall-checks (table `AUD`: RWIB); phone-layout rwall 390/768; project-library retwall; dxf-print-sheets rw.

### Saved data
- No input or format change. Old ACI projects with k_h > 0 change their stability FOS and pass/fail as above.

## 2026-11-07 — PR: claude/rw-stem-seismic — Stem designed for the seismic increment: ACI U = 1.2D + 1.0E + 1.6H, AASHTO Extreme Event I (two cases, φ 1.0), at the base, at mid-height and along the height (RWSQ; calculation change) (PR #954: https://github.com/mlococo88/All-Structural/pull/954)

Calculation audit, item 9 (3). Engineer decision (2026-11-07). Code sites are tagged `RWSQ`.

### RWSQ-1. `calcAll`   [§4]
- **Provisions (cited and paraphrased; verified for the audit):**
  - ACI 318-19 Table 5.3.1, Eq. (5.3.1e): U = 1.2D + 1.0E + 1.0L + 0.2S.
  - ACI 318-19 §5.3.8: H (lateral earth pressure, incl. water in soil) is added at 1.6 where it adds to the effect.
  - AASHTO LRFD 10th Ed. Art. 11.6.5.1: the wall elements are designed per Section 5 for the seismic case, with P_AE and P_IR combined in the two cases.
  - AASHTO Art. 5.5.4.3: φ = 1.0 at the extreme event.
- **New `stemSeis(z)`:** the factored seismic combination at depth z below the stem top.
  - **ACI:** the U = 1.6H stem load, plus 1.0·ΔP_E,s at 0.6z, with ΔP_E,s = ΔP_E·(z/H)². This is the stability M-O increment over the stem height; ΔP_E stays at 0.6H, as decided.
  - **AASHTO, when Extreme Event I is active (RWE1):** max of two cases.
    - (1) P_AE,s·z/3 + 0.5·M_IR.
    - (2) max(0.5P_AE,s, P_A,s) + M_IR, with P_A,s = the static soil on the stem.
    - P_AE,s = ½K_AEγ_s z²(1 − k_v).
    - M_IR = k_h × (stem weight above the section, tapered, 24 strips, + barrier at its centroid) × arm.
    - ES and water at 1.0; LS at γ_EQ.
- **Envelope:** the stem base M_u and V_u are max(Strength I / U = 1.6H, Extreme Event II, seismic). The same applies at mid-height (S3) and along the height (RWS13 check, φ 0.90 ACI / 1.00 AASHTO EE I).
  - AASHTO φ = 1.0 when an extreme event governs.
  - `stem_ee2_governs` is now false when the seismic case governs; new flags `stem_eq_governs` and `stemT_eq_governs`.
- **Warnings:**
  - AASHTO: the stem is designed for EE I; the footing is not.
  - ACI: the stem is designed for U = 1.2D + 1.0E + 1.6H; the footing uses 1.0·ΔP_E as before; inertia is not included in ACI mode.
- **Before / after** (`git diff -U0`, `calcAll`):
```diff
@@ -2191,2 +2191,2 @@ function calcAll(inp) {
-    warnings.push(isAASHTO ? 'Seismic: Extreme Event I stability is checked (Art. 11.6.5.1: P_AE and wall inertia P_IR, Stability Step 7a); the stem and footing are NOT designed for the seismic case.'   // RWE1
-                           : 'Seismic: stem and footing are NOT designed for the seismic case — the increment is applied to stability only, and wall/soil inertia (AASHTO 11.6.5.1 P_IR) is not included.');
+    warnings.push(isAASHTO ? 'Seismic: Extreme Event I stability is checked (Art. 11.6.5.1: P_AE and wall inertia P_IR, Stability Step 7a) and the stem is designed for Extreme Event I; the footing is NOT designed for the seismic case.'   // RWE1 / RWSQ
+                           : 'Seismic: the stem is designed for U = 1.2D + 1.0E + 1.6H (ΔP_E at 0.6H); the footing uses the factored bearing with 1.0·ΔP_E; wall/soil inertia (AASHTO 11.6.5.1 P_IR) is not included in ACI mode.');   // RWSQ
@@ -2863,3 +2863,33 @@ function calcAll(inp) {
-  // Governing stem demand = envelope of Strength I and Extreme Event II
-  const stem_ee2_governs = Mu_stem_ee2 > Mu_stem_strI;
-  const Mu_stem_lbft = Math.max(Mu_stem_strI, Mu_stem_ee2);
+  // ── RWSQ (2026-11-07): stem seismic load combination (engineer decision, audit item 9(3)) ──
+  //  ACI 318-19 Eq. 5.3.1e with H per §5.3.8: U = 1.2D + 1.0E + 1.6H — the static stem load at 1.6 plus 1.0·ΔP_E over the stem
+  //    (ΔP_E,s = ΔP_E·(z/H)², at 0.6z, the stability assumption); no D effect on the stem moment.
+  //  AASHTO Extreme Event I (Art. 11.6.5.1; Section 5 for the structure, φ = 1.0): the stability cases applied to the stem above the
+  //    section: (1) P_AE,s + 0.5P_IR,s, (2) max(0.5P_AE,s, P_A,s) + P_IR,s; P_IR,s = k_h(stem above the section + barrier); ES and
+  //    water at 1.0, LS at γ_EQ.
+  const eeQ = isAASHTO && aashtoR && aashtoR.ee1 ? aashtoR.ee1 : null;
+  const stemSeis = z => {   // factored seismic-combination M (lb·ft/ft) and V (lb/ft) at depth z below the stem top; null without seismic
+    if (!hasSeismic || !(z > 0)) return null;
+    const sd = stemDemand(z);
+    if (!isAASHTO) {
+      const Pe = Pe_inc * (z / H) ** 2;
+      return { M: gEH*sd.M_soil + gWA*sd.M_hyd + gES*Ka*inp.q_sur*z*z/2 + gLS*Ka*q_ll_stem*z*z/2 + Pe*0.6*z,
+               V: gEH*sd.V_soil + gWA*sd.V_hyd + gES*Ka*inp.q_sur*z + gLS*Ka*q_ll_stem*z + Pe, Pe };
+    }
+    if (!eeQ) return null;
+    const PAE = 0.5 * Kae * inp.gamma_s * z * z * (1 - inp.kv), MAE = PAE * z / 3;
+    let WI = 0, MI = 0; const n = 24;
+    for (let i = 0; i < n; i++) { const zz = (i + 0.5) * z / n, w = inp.gamma_c * (inp.ts_top + (inp.ts_bot - inp.ts_top) * zz / inp.Hs) / 12 * z / n; WI += w; MI += w * (z - zz); }
+    WI += W_bar; MI += W_bar * (z + bar_h_ft / 2);
+    const PIR = inp.kh * WI, MIR = inp.kh * MI;
+    const oM = Ka*inp.q_sur*z*z/2 + sd.M_hyd + eeQ.gEQ*Ka*q_ll_stem*z*z/2, oV = Ka*inp.q_sur*z + sd.V_hyd + eeQ.gEQ*Ka*q_ll_stem*z;
+    const useAE = 0.5 * PAE > sd.V_soil;
+    const c1 = { M: MAE + 0.5*MIR + oM, V: PAE + 0.5*PIR + oV };
+    const c2 = { M: (useAE ? 0.5*MAE : sd.M_soil) + MIR + oM, V: (useAE ? 0.5*PAE : sd.V_soil) + PIR + oV };
+    return { M: Math.max(c1.M, c2.M), V: Math.max(c1.V, c2.V), PAE, MAE, PIR, MIR, WI, c1, c2, useAE };
+  };
+  const sq_base = stemSeis(inp.Hs);
+  const Mu_stem_eq = sq_base ? sq_base.M : 0, Vu_stem_eq = sq_base ? sq_base.V : 0;
+  // Governing stem demand = envelope of Strength I, Extreme Event II and (RWSQ) the seismic combination
+  const stem_eq_governs  = Mu_stem_eq > Math.max(Mu_stem_strI, Mu_stem_ee2);
+  const stem_ee2_governs = !stem_eq_governs && Mu_stem_ee2 > Mu_stem_strI;
+  const Mu_stem_lbft = Math.max(Mu_stem_strI, Mu_stem_ee2, Mu_stem_eq);
@@ -2867 +2897 @@ function calcAll(inp) {
-  const Vu_stem      = Math.max(Vu_stem_strI, Vu_stem_ee2);
+  const Vu_stem      = Math.max(Vu_stem_strI, Vu_stem_ee2, Vu_stem_eq);
@@ -2944 +2974 @@ function calcAll(inp) {
-  const phiF_stem = (isAASHTO && stem_ee2_governs) ? 1.00 : 0.90;
+  const phiF_stem = (isAASHTO && (stem_ee2_governs || stem_eq_governs)) ? 1.00 : 0.90;   // RWSQ: extreme events φ = 1.0
@@ -2979 +3009 @@ function calcAll(inp) {
-  const phiV     = isAASHTO ? (stem_ee2_governs ? 1.00 : 0.90) : 0.75;
+  const phiV     = isAASHTO ? ((stem_ee2_governs || stem_eq_governs) ? 1.00 : 0.90) : 0.75;   // RWSQ
@@ -3049,2 +3079,5 @@ function calcAll(inp) {
-  const stemT_ee2_governs = Mu_stemT_ee2 > Mu_stemT_strI;
-  const Mu_stemT_lbft = Math.max(Mu_stemT_strI, Mu_stemT_ee2);
+  const sq_mid = stemSeis(Hs_mid);   // RWSQ
+  const Mu_stemT_eq = sq_mid ? sq_mid.M : 0, Vu_stemT_eq = sq_mid ? sq_mid.V : 0;
+  const stemT_eq_governs  = Mu_stemT_eq > Math.max(Mu_stemT_strI, Mu_stemT_ee2);
+  const stemT_ee2_governs = !stemT_eq_governs && Mu_stemT_ee2 > Mu_stemT_strI;
+  const Mu_stemT_lbft = Math.max(Mu_stemT_strI, Mu_stemT_ee2, Mu_stemT_eq);
@@ -3053 +3086 @@ function calcAll(inp) {
-  const Vu_stemT      = Math.max(Vu_stemT_strI, Vu_stemT_ee2);
+  const Vu_stemT      = Math.max(Vu_stemT_strI, Vu_stemT_ee2, Vu_stemT_eq);   // RWSQ
@@ -3055 +3088 @@ function calcAll(inp) {
-  const phiF_stemT = (isAASHTO && stemT_ee2_governs) ? 1.00 : 0.90;
+  const phiF_stemT = (isAASHTO && (stemT_ee2_governs || stemT_eq_governs)) ? 1.00 : 0.90;   // RWSQ
@@ -3072 +3105 @@ function calcAll(inp) {
-  const phiV_T = isAASHTO ? (stemT_ee2_governs ? 1.00 : 0.90) : 0.75;
+  const phiV_T = isAASHTO ? ((stemT_ee2_governs || stemT_eq_governs) ? 1.00 : 0.90) : 0.75;   // RWSQ
@@ -3338,3 +3371,4 @@ function calcAll(inp) {
-  const dcAt = (sets, zb) => { const Mn = MnOf(sets, zb), mS = MuS(zb), mE = MuE(zb);
-    if (mS <= 1e-6 && mE <= 1e-6) return 0; if (Mn <= 0) return Infinity;
-    return Math.max(mS / (0.90 * Mn), mE / (phiE * Mn)); };
+  const MuQ = zb => { const q = stemSeis(inp.Hs - zb); return q ? q.M : 0; }, phiQ = isAASHTO ? 1.00 : 0.90;   // RWSQ: seismic combination
+  const dcAt = (sets, zb) => { const Mn = MnOf(sets, zb), mS = MuS(zb), mE = MuE(zb), mQ = MuQ(zb);
+    if (mS <= 1e-6 && mE <= 1e-6 && mQ <= 1e-6) return 0; if (Mn <= 0) return Infinity;
+    return Math.max(mS / (0.90 * Mn), mE / (phiE * Mn), mQ / (phiQ * Mn)); };
@@ -3373 +3407 @@ function calcAll(inp) {
-  const s13_Mu_at  = Math.max(MuS(s13_dc_z), MuE(s13_dc_z)), s13_Mn_at = MnOf(setsAt(s13_dc_z), s13_dc_z);
+  const s13_Mu_at  = Math.max(MuS(s13_dc_z), MuE(s13_dc_z), MuQ(s13_dc_z)), s13_Mn_at = MnOf(setsAt(s13_dc_z), s13_dc_z);
@@ -3589 +3623 @@ function calcAll(inp) {
-                 label: 'Stem Flex', val: stem_ee2_governs ? 'EE-II governs' : undefined },
+                 label: 'Stem Flex', val: stem_eq_governs ? (isAASHTO ? 'EE-I governs' : 'seismic U governs') : stem_ee2_governs ? 'EE-II governs' : undefined },
@@ -3597 +3631 @@ function calcAll(inp) {
-                 label: 'Stem Mid Flex', val: stemT_ee2_governs ? 'EE-II governs' : undefined },
+                 label: 'Stem Mid Flex', val: stemT_eq_governs ? (isAASHTO ? 'EE-I governs' : 'seismic U governs') : stemT_ee2_governs ? 'EE-II governs' : undefined },
@@ -3706,0 +3741 @@ function calcAll(inp) {
+    sq_base, Mu_stem_eq, Vu_stem_eq, stem_eq_governs, sq_mid, Mu_stemT_eq, stemT_eq_governs,   // RWSQ
```

### RWSQ-2. Display
- **Stem design:**
  - Step 1: the seismic combination worked, the governing note and the card reference.
  - Steps 3 and 4: φ.
  - Mid Step 1: the seismic M_u at mid-height.
  - The "ΔPE is not included in stem flexure" note is replaced.
- **Report:**
  - Step 1 `stb/s1.MuEQ`, the envelope in `stb/s1.Mu`, and the V_u note;
  - check label "Extreme Event I governs" / "U = 1.2D + 1.0E + 1.6H governs".
- **Drawings:** general note 10.

### Check cases (`calcAll` in Node and in the browser)
- **ACI default, k_h = 0.10:**
  - ΔP_E = 691.3, so ΔP_E,s = 691.3·(12/13.5)² = 546.2 lb/ft.
  - M_u = 18432 + 546.2·0.6·12 = **22365** lb·ft/ft (was 18432, +21 %). The seismic combination governs.
  - S1 stays #4@6 (A_s,min governs). V_u 4608 → 5154. Mid-height M_u 2304 → 2796. Along-height D/C 0.663 → 0.804.
- **ACI default, k_h = 0.20:** M_u 27137; along-height D/C 0.975.
- **ACI tall wall + water + k_h 0.15:** M_u 304035 → **382750**, S1 #8@3 → **#9@3**; mid-height 30036 → 39876.
- **AASHTO default, k_h = 0.10:**
  - P_AE,s = ½·0.3966·120·12² = 3426 at 4.0 ft, so M = 13706.
  - P_IR,s = 0.10·2250 = 225 at 5.6 ft, so M_IR = 1260.
  - Case 1: 13706 + 630 = **14335**; case 2: 11520 + 1260 = 12780.
  - 14335 < Strength I 32274, so it does not govern (as in the audit). Nothing moves.
- **AASHTO default, k_h = 0.30:** EE I 21566 < 32274, so it does not govern.

### How verified
- origin/main vs branch, headless Chromium: the twelve audit walls + ACI k_h 0.10 + AASHTO k_h 0.10 + AASHTO k_h 0.30 with collision.
  - Walls without k_h: `_R` differs only by the new null / 0 fields.
  - The AASHTO seismic walls gain the new fields only; EE I does not govern, so no value moves.
  - ACI seismic walls: the stem M_u / V_u, mid-height, along-height and downstream stem values (bars, d, φM_n, shear, crack spacing, laps) change as above.
  - The footing and stability are identical.
- Tests: check-syntax; smoke/retaining-wall-checks (table `AUD`: RWSQ ACI and AASHTO); phone-layout rwall 390/768; project-library retwall; dxf-print-sheets rw.
- Screenshot looked at: ACI Stem Step 1 (k_h 0.10).

### Saved data
- No input or format change. Old projects with k_h > 0 get the stem seismic combination; their stem results can change (ACI).

## 2026-11-07 — PR: claude/rw-ee2-vertical-eh — AASHTO Extreme Event II (collision): the vertical earth-thrust component P_a,V follows the EH choice (0 under MassDOT, 1.00 under "full") (RWCV; calculation change) (PR #956: https://github.com/mlococo88/All-Structural/pull/956)

Follow-up to item 3 (#944). Engineer answer (2026-11-07): the vertical component of the earth thrust follows the EH choice in Extreme Event II. Code sites are tagged `RWCV`.

### RWCV-1. `calcAll`, Extreme Event II block   [§4]
- **Where:** `calcAll`, anchors `const CMB_EE2 = {`, `const V_ct_min =`, `const Mr_ct =`.
- **Problem:** the resisting vertical load V and moment M_r counted P_a,V at 1.00 as EV, whatever the EH choice. With the MassDOT option (γ_EH,CT = 0) the horizontal earth thrust was dropped but its vertical (stabilizing) component was still counted. Unconservative for sliding, and it moved the resultant toward the heel, on walls with a sloped backfill (Rankine) or wall friction δ > 0 (Coulomb).
- **Fix:** P_a,V and its moment P_a,V·B take γ_EH,CT, the new `CMB_EE2.EHv`: 0 with the MassDOT option, 1.00 with "full". W_soil stays EV at 1.00. V feeds sliding, e and (through V_max = V + 0.50 V_LS) bearing, so all three use the same factor.
- **Provisions:**
  - AASHTO LRFD 10th Ed. Table 3.4.1-1 (EE II row): γp = 1.00 for the permanent loads; one load (EH) takes one factor in all its effects.
  - MassDOT LRFD Bridge Manual 3.3.2.4: earth pressure need not act with the collision force for stability (γp = 0). The engineer applies this to both components of the thrust.
- **Before / after** (`git diff -U0`):
```diff
@@ -2653 +2653 @@ function calcAll(inp) {
-      const CMB_EE2 = { CT: 1.00, DC: 1.00, EV: 1.00, EH: gEH_ct, LS: gLS_ct, WA: 1.00, ES: gEH_ct, ESv: 1.00 };   // Extreme Event II factors (RW3F)
+      const CMB_EE2 = { CT: 1.00, DC: 1.00, EV: 1.00, EH: gEH_ct, EHv: gEH_ct, LS: gLS_ct, WA: 1.00, ES: gEH_ct, ESv: 1.00 };   // Extreme Event II factors (RW3F); RWCV (2026-11-07): EHv = the vertical earth-thrust component follows the EH choice
@@ -2665 +2665 @@ function calcAll(inp) {
-      const V_ct_min = CMB_EE2.DC*(Wftg + Wstem + W_bar) + CMB_EE2.EV*(Wsoil + Pa_tri_v) + CMB_EE2.ESv*V_ES_v - CMB_EE2.WA*F_uplift;   // RWCT: + 1.00 ES vertical
+      const V_ct_min = CMB_EE2.DC*(Wftg + Wstem + W_bar) + CMB_EE2.EV*Wsoil + CMB_EE2.EHv*Pa_tri_v + CMB_EE2.ESv*V_ES_v - CMB_EE2.WA*F_uplift;   // RWCT: + 1.00 ES vertical; RWCV: P_a,V at γ_EH,CT (was 1.00 as EV)
@@ -2679 +2679 @@ function calcAll(inp) {
-      const Mr_ct = CMB_EE2.DC*(Ms_ftg + Ms_stem + Ms_bar) + CMB_EE2.EV*(Ms_soil + Ms_Pv) + CMB_EE2.ESv*V_ES_v*xESv + CMB_EE2.WA*Ms_uplift;   // RWCT: + 1.00 ES vertical
+      const Mr_ct = CMB_EE2.DC*(Ms_ftg + Ms_stem + Ms_bar) + CMB_EE2.EV*Ms_soil + CMB_EE2.EHv*Ms_Pv + CMB_EE2.ESv*V_ES_v*xESv + CMB_EE2.WA*Ms_uplift;   // RWCT: + 1.00 ES vertical; RWCV: P_a,V at γ_EH,CT
```
- **Results move** only for AASHTO walls with collision on, the MassDOT option, and P_a,V > 0 (Rankine with β > 0, or Coulomb with δ > 0). Coulomb with δ = 0 has P_a,V = 0 even with β > 0 (the thrust is inclined at δ), so those walls do not move. The stem EE II case (EH at 1.00, MassDOT 3.3.2.4) does not use P_a,V and is unchanged.

### RWCV-2. Display (Stability Step 7b, Report Step 7b, 3D view)
- `renderStabilityAASHTO`, anchor `Resisting vertical load (DC + EV at`:
  - the title names the factor on P_a,V; the equation shows the values substituted; a P_a,V row is added to the "where" list;
  - new step "Resisting moment about the toe (same factors as V)": M_r worked with each W·x (was quoted only in the eccentricity step);
  - the MassDOT alert says the vertical component is dropped with the horizontal thrust.
- `rwrModel`, Step 7b (`sa7b`): `V` gets its substituted values and, under the MassDOT option with P_a,V > 0, a note; new step `Mr` (worked); the Eccentricity group is `sb.slice(3, 6)` and Bearing `sb.slice(6)` (were 3–5 and 5).
- `rw3Factors`, key `ee2`: the 3D view's EH,v factor is `E.EHv` (was `E.EV`).
- Item 3b: no change. The manual h_eq already overrides the H/2 rule and is noted on the Traffic tab (RWLS).

### Check cases (AASHTO default + collision TL-4: 28 kip / 41 ft = 0.683 k/ft at 30 in; `calcAll` in Node and in the browser)
- **Default (P_a,V = 0):** unchanged. V 16583, sliding D/C 0.246, e −0.222 ft, q 1535 psf.
- **β 10°, Rankine, MassDOT:** P_a,V = 819.2 lb/ft (Stability Step 2), moment P_a,V·B = 819.2 × 12.5 = 10240.
  - V = 1.0(2813 + 2250) + 1.0(12284) + 0 × 819 = **17347** (was 18166).
  - Sliding: R = 1.0 × 17347 × 0.364 = 6314; D/C = 1619 / 6314 = **0.256** (was 1619 / 6612 = 0.245).
  - M_r 141302 → 131062; e = 6.25 − (131062 − 17944) / 17347 = **−0.271 ft** (was −0.541).
  - Bearing: V_max 19594 → 18775; q 1754 → **1611 psf** (limit 9000).
- **β 10°, Rankine, "full":** unchanged (V 18166, sliding 0.947, e 0.738, q 1710).
- **Coulomb δ 20°, MassDOT:** P_a,V = 1112 lb/ft. V 17694 → **16583**; sliding 0.217 → **0.232**; e −0.634 → **−0.257 ft**; q 1740 → **1543 psf**.
- **Coulomb δ 20°, "full":** unchanged (V 17694, sliding 0.692).

### How verified
- origin/main vs branch, headless Chromium (results `_R`, Export JSON, localStorage, tab text, Report model and text): the twelve audit walls + the four β / δ collision walls.
  - Walls without collision (all ACI walls, `aashto_water_col_eta`): identical in every part.
  - Collision walls with P_a,V = 0 (`aashto_ct`, `aashto_rock_ct_water` (Coulomb δ 0, β 10°), `aashto_vh_ct`, the q_s 250 + water walls) and the "full" walls: `_R` differs only by the new `CMB_EE2.EHv`; the text differs by the Step 7b display.
  - β 10° / δ 20° MassDOT walls: only `aashtoR.ct.ee2` (V, V_max, R, D/C, M_r, x̄, e, bearing) and the `ct*` check values change, as above.
  - 0 console errors; self-consistency panel: all passed.
- Tests: check-syntax; smoke/retaining-wall-checks (table `AUD`: RWCV β 10° MassDOT and "full", δ 20° MassDOT); phone-layout rwall 390/768; project-library retwall; dxf-print-sheets rw.
- Screenshot looked at: Stability Step 7b (β 10°, MassDOT).

### Decisions (pending engineer review)
- The factor on P_a,V applies to all three EE II stability checks (sliding, eccentricity, bearing), as one load takes one factor. Under the MassDOT option this lowers the bearing pressure slightly (β 10°: 1754 → 1611 psf); the alternative (keep P_a,V at 1.00 for bearing only) was not adopted because the horizontal thrust that goes with it is not applied.

## 2026-11-07 — PR: claude/rw-aci-uplift-split — ACI footing design with water: the uplift is split out of the factored base pressure, γ_U = 1.6 for the toe and 0.9 for the heel (ACI 318-19 §5.3.8) (RWUP; calculation change) (PR #960: https://github.com/mlococo88/All-Structural/pull/960)

Calculation audit, item 1 follow-up (#942 added a display note, RWUPN). Engineer answer (2026-11-07): split the uplift out, 1.6 where it adds to the effect (toe), 0.9 where it is permanent and counteracts (heel downward load), in U = 1.2D + 1.6H and 0.9D + 1.6H. Code sites are tagged `RWUP`.

**Provision checked in the PDF:** the load-factor rule for H is ACI 318-19 **§5.3.8** (a) 1.6 where H adds to the primary effect, (b) 0.9 where it is permanent and counteracts, (c) 0 where it is not permanent and counteracts; R5.3.8 says H covers water in soil. §5.3.9 (named in the request) is the flood-load provision, so §5.3.8 is cited.

### RWUP-1. `calcAll`, footing heel and toe (ACI with water only)   [§4]
- **Where:** after `const bqm_back  = isAASHTO ? aashtoR.quIa_back  : quf_back_min;` — new `upS`, `rwUpSplit(V, M, g, lbl)`, `rwUpSoilAt(sp, x)`, `rwUpMember(sp, xf, xt)`; `heelCase(..., up)` and `toeCase(q0, qL, up)` take the split; return adds `upS, hcG_up, tcG_up`.
- **Before:** heel and toe were designed for the total factored base-pressure trapezoid of each combination (soil + water together, built from ΣV_u with no −U), with the edge pressures interpolated linearly between the toe and the heel end.
- **After (only when `!isAASHTO && F_uplift > 0`):** for each combination (ΣV_u, M_u = M_s,u − M_o,u about the toe, as before):
  - soil reaction V_s = ΣV_u − γ_U·U, x̄_s = (M_u − γ_U·U·x_U)/V_s, e_s = B/2 − x̄_s;
  - soil pressure: full contact when |e_s| ≤ B/6 (q = V_s/B(1 ± 6e_s/B)); otherwise a triangular block of length L_c = 3x̄_s from the toe (or 3(B − x̄_s) from the heel end), peak 2V_s/L_c;
  - water pressure on the member: γ_U·γ_w·h_w (uniform) or γ_U·γ_w·h_w·x/B (triangular);
  - member force and moment about the stem face from the linear pieces: F = (q_a + q_b)(s₂ − s₁)/2, M = (s₂ − s₁)[q_a(2s₁ + s₂) + q_b(s₁ + 2s₂)]/6;
  - **toe γ_U = 1.6** (§5.3.8(a)); **heel γ_U = 0.9** (§5.3.8(b)); the two combinations are enveloped as before; heel M_u = M_down − M_up, V_u = |w_u L_h − F_up|; toe M_u = M_up − w_sw L_t²/2, V_u = F_up − w_sw L_t.
  - V_s ≤ 0, or the soil resultant outside the base: a warning; the soil reaction is taken at the toe tip (toe) or as zero on the member (heel, and the toe when the resultant is beyond the heel end).
- In full contact the split gives the same pressure as before (results equal to round-off, ≤ 1e-11). AASHTO mode and walls without water: unchanged.
- **Before / after (core):**
```diff
-  const hcMax = heelCase(gEV, gDC, gES, gLS, bq_back, bq_heel);
+  const hcMax = heelCase(gEV, gDC, gES, gLS, bq_back, bq_heel, upS ? upS.heelMax : null);   // RWUP
-                         : heelCase(0.9, 0.9, 0, 0, bqm_back, bqm_heel);
+                         : heelCase(0.9, 0.9, 0, 0, bqm_back, bqm_heel, upS ? upS.heelMin : null);
-    const Mup = q0 * inp.Lh ** 2 / 2 + (qL - q0) * inp.Lh ** 2 / 3;
+    if (up) { q0 = up.q0; qL = up.qL; }
+    const Mup = up ? up.M : q0 * inp.Lh ** 2 / 2 + (qL - q0) * inp.Lh ** 2 / 3;
+    const Fup = up ? up.F : ((q0 + qL) / 2) * inp.Lh;
-             Vstd: Math.abs(wu * inp.Lh + gEVc * V_wedge_heel - ((q0 + qL) / 2) * inp.Lh),
+             Vstd: Math.abs(wu * inp.Lh + gEVc * V_wedge_heel - Fup),
-  const tcMax = toeCase(bq_front, bq_toe), tcMin = toeCase(bqm_front, bqm_toe);
+  const tcMax = toeCase(bq_front, bq_toe, upS ? upS.toeMax : null), tcMin = toeCase(bqm_front, bqm_toe, upS ? upS.toeMin : null);   // RWUP
-             M: n0 * inp.Lt ** 2 / 2 + (nL - n0) * inp.Lt ** 2 / 3,
-             V: Math.max(0, n0 * inp.Lt + (nL - n0) * inp.Lt / 2) };
+             M: up ? up.M - wu_toe_down * inp.Lt ** 2 / 2 : n0 * inp.Lt ** 2 / 2 + (nL - n0) * inp.Lt ** 2 / 3,
+             V: Math.max(0, up ? up.F - wu_toe_down * inp.Lt : n0 * inp.Lt + (nL - n0) * inp.Lt / 2) };
```
  (`rwUpSplit` / `rwUpMember` are new code; see the file at the `RWUP` tag.)

### RWUP-2. Display
- Footing tab: the RWUPN note on "Factored Loads on Footing" is rewritten (the uplift is now split out; γ_U 1.6 toe / 0.9 heel). Heel Step 1 / Toe Step 1: V_s, x̄_s, e_s, soil pressure (or L_c and peak), water pressure, q(0) and q(L) = soil + water. Heel Step 2 / Toe Step 2: M_soil, M_water, M_up worked, then M_u and V_u. New helpers `rwUpSteps(r, up, mem)` and `rwUpTabEq(st)` (one step list for the tab and the Report).
- Stability Step 7 (ACI): a note that these are total pressures and the uplift is split for the heel and toe, with links (new card keys `ftgHeelUp`, `ftgToeUp`).
- Report: Heel Step 1–2 and Toe Step 1–2 carry the same steps (ids `u*`); the Step 7 note; the heel/toe "q_u from" notes point to ΣV_u.
- Heel / toe shear and moment charts (`plotHeelSM`, `plotToeSM`): use the pieces (`rwUpBeyond`). The schematic SVG diagrams in the Analysis tab still draw the end pressures linearly (annotated values are the design values).

### Check cases (ACI default wall: H_s 12, t_f 1.5 ft, L_t 3, L_h 8, B 12.5 ft)
- **Water 6 ft below the top (default water case), uniform or triangular:** unchanged. Toe M_u 7325, heel 19032 lb-ft/ft (full contact: split = total).
- **Water 2 ft below the top, triangular uplift** (h_w = 11.5 ft, U = ½(62.4)(11.5)(12.5) = 4485 lb/ft at x_U = 8.333 ft):
  - Toe, U = 0.9D + 1.6H governs: V_s = 15644 − 1.6(4485) = 8468; x̄_s = (72958 − 1.6(4485)(8.333))/8468 = 1.554 ft; e_s = 4.696 > B/6 = 2.083 → L_c = 4.662 ft, q_s,toe = 2(8468)/4.662 = 3633.2 psf; at the stem face q_s = 1295.0. Water 1.6(62.4)(11.5) = 1148.2 psf at the heel end → 275.6 psf at the face, 0 at the tip.
    M_soil = 3²/6 (1295.0 + 2·3633.2) = 12842; M_water = 3²/6 (275.6) = 413; M_up = 13256; M_u = 13256 − 202.5(3²)/2 = **12344** (was **9250**, 1.2D + 1.6H total trapezoid). V_u 5998 → 7198. F2 stays #4 @ 6.
  - Heel, U = 0.9D + 1.6H governs: V_s = 15644 − 0.9(4485) = 11608; x̄_s = 3.387; e_s = 2.863 → L_c = 10.162, peak 2284.5; at the back face 1272.9 psf, contact ends 5.662 ft into the heel. Water 0.9(62.4)(11.5) = 645.8 psf at the heel end → 232.5 at the face.
    M_soil = 5.662²/6 (1272.9) = 6802; M_water = 8²/6 (232.5 + 2·645.8) = 16258; M_up = 23060; M_down = 50832; M_u = **27772** (was **28267**). F1 stays #5 @ 8.
- **Water 2 ft, uniform uplift:** toe 9250 → 9377 (the 0.9D + 1.6H toe case has no soil equilibrium at γ_U 1.6 → warning, V_s at the toe tip, does not govern); heel 28267 → 27431.
- **Audit wall `aci_mix`** (water 6 ft, k_h 0.15, column, β 10°, q_s 250, key 18 in, passive): heel M_u 10254 → **25412** (F1 #4 @ 6 unchanged; A_s,req 0.389 → 0.390); toe 41177 → 41228. Most of the heel change is the soil block: e_u,min = 2.576 > B/6, and the total trapezoid used before spread the triangle over the whole base (see open item).

- **Audit wall `aci_tall_seis`** (H_s 28 ft, water 10 ft below the top, k_h 0.15): in U = 0.9D + 1.6H the soil resultant at γ_U = 1.6 falls beyond the toe (warning), so V_s is taken at the toe tip: toe M_u 103657 → **129214**, F2 #6 @ 6 → **#7 @ 7**; heel 353922 → 352930 (F1 unchanged); heel V_u 33949 → 38264 (the wall already failed heel and toe shear).
- **Water 4 ft, uniform:** toe 8089 → 8939 (0.9D + 1.6H now governs), heel 22687 unchanged to round-off.

### How verified
- origin/main vs branch, headless Chromium (`_R`, Export JSON, localStorage, tabs, Report): the twelve audit walls + water 2 ft triangular / uniform + water 4 ft uniform.
  - Walls without water and AASHTO walls: `_R` differs only by the new `upS` / `hcG_up` / `tcG_up` (null); tabs and Report identical.
  - `aci_water_uni` (6 ft): values equal to round-off (≤ 1e-11); text differs by the new worked steps.
  - `aci_water_tri`, `aci_mix`, 2 ft / 4 ft walls: only the heel and toe design values move, as above. Stability is unchanged.
  - 0 console errors.
- Hand check above reproduced in Node with the tool's own `calcAll`.
- Tests: check-syntax; smoke/retaining-wall-checks (table `AUD`: RWUP 2 ft triangular, 6 ft, no water, AASHTO); phone-layout rwall 390/768; project-library retwall; dxf-print-sheets rw.

### Decisions (pending engineer review)
- §5.3.8 cited (the request named §5.3.9, which is the flood provision).
- When the soil reaction alone leaves the middle third, the split uses the statically consistent triangular block (L_c = 3x̄_s). The total trapezoid that is still used without water interpolates the edge pressures over the whole base B, which overstates the upward pressure under the heel (unconservative heel, slightly conservative toe). Not changed for walls without water (open item below).
- No envelope with the old total-pressure method: the heel at γ_U = 0.9 can come out slightly lower than before in partial contact (2 ft triangular: 28267 → 27772), as the engineer's factors give.
- No equilibrium under a combination (V_s ≤ 0, or soil resultant outside the base): warning; the toe takes V_s at its tip (upper bound), the heel takes no soil relief.

### Open item (raised, not changed)
- ACI factored trapezoids without water (`qu_toe`/`qu_heel`, `qu_toe_min`/`qu_heel_min`) and the edge values `quf_front`/`quf_back`: with e_u > B/6 the pressure at the stem faces is interpolated linearly from the toe to the heel end, not over the contact length 3x̄_u. Unconservative for the heel (e.g. `aci_mix` with the water removed). Fix to the same block as RWUP?

### Saved data
- No input or format change.
## 2026-11-07 — PR: claude/rw-pile-8b-inputs — Pile-supported footing, Phase 8b: foundation type and pile-row inputs, piles in the Analysis diagram, Overview, 3D and Drawings (RWPL; inputs and display only, no result change) (PR #957: https://github.com/mlococo88/All-Structural/pull/957)

Review Phase 8 (pile-supported footing), PR 8b. Engineer decisions 2026-11-07 (review Q11–Q18, taken as recommended): pile mode follows the code mode; one pile type per wall; spacing per row; vertical piles; no staggering. Code sites are tagged `RWPL`.

### RWPL-1. Inputs (Wall tab, new "Foundation" card after Geometry)
- `fnd_type`: "Spread footing on soil" (default) or "Pile-supported footing (rows of vertical piles)".
- Pile mode only:
  - `pile_nrows` (2, 3 or 4 rows);
  - `pile_x1..4`: the row position from the toe (ft);
  - `pile_s1..4`: the pile spacing along the wall (ft);
  - `pile_shape` (H-pile / pipe / square precast / round), `pile_desig` (text, optional), `pile_size` D (in);
  - `pile_embed`: embedment into the footing (in); `pile_clr`: clear distance from the pile top to the bottom bars (in);
  - ACI / IBC mode (`aci-only`): allowable `pile_Pa` (compression), `pile_Ta` (uplift) and `pile_Ha` (lateral), kip per pile, service loads;
  - AASHTO mode (`aashto-only`): `pile_Rn` with `pile_phic`, `pile_Rnup` with `pile_phiup`, and the factored lateral resistance `pile_Hr`, kip per pile;
  - `pile_passive`: an opt-in passive credit against H (off by default; used from 8c).
- `rwPileInputs()` returns `inp.fnd` = {type, rows:[{x, s}], shape, desig, D, embed, clr, Pa, Ta, Ha, Rn, phic, Rnup, phiup, Hr, passive}.
  `getInputs()` adds `fnd` only when the type is 'pile' (anchor `key_bk: n('key_bk') > 0`), so a spread footing's `inp` and results are byte-identical.
- `rwPileUI()` shows the pile fields for the foundation type, the row count and the mode. It is called from `onBasisChange` (after the
  aci-only / aashto-only toggles), `syncConditionalUI` and `onInputChange`.
- Input checks (`rwInputErrors`, block `// ── RWPL (2026-11-07): pile-supported footing ──`), pile mode only:
  - each row x within 0..B and no two rows at the same x;
  - s > 0, D > 0, embedment ≥ 0, clear ≥ 0, and embedment + clear < t_f;
  - capacities > 0 (uplift and lateral ≥ 0); φ in (0, 1];
  - REVIEW (not an error) when a pile of width D extends past the footing edge.
### RWPL-2. Saved data (§5)
- `RWPL_DEF` (the default of every pile field) is merged into `RWLS_DEF` (anchor `Object.assign(RWLS_DEF, RWPL_DEF);`).
  - A field equal to its default is not saved.
  - A save without the field restores the default.
- So a spread-footing project saves, autosaves and exports byte-identical to before. Every project saved before opens as a spread footing.
- No key changes.
### RWPL-3. Display
- `rwPileSVG(r, x_toe, y_fbot, SCALE, stroke)` (new, before `buildCrossSection`): each row is drawn as a pile of width D. The
  embedded length is dashed inside the footing, and a stub below the footing ends in a break line. The tooltip gives x, s, D and the embedment.
  It is called in `buildCrossSection` (Analysis diagram) and `buildOverviewSVG` (after the shear key).
- 3D (`buildGeometry3D`, before `// Retained soil (heel side)`): piles at s/2 + k·s along the wall in every row, drawn to a nominal length of max(4 ft, 0.6H).
- Drawings: `RWDW_SUPPORT.piles` (section: pile rows with embedment, break lines and "ROW i @ s O.C."; elevation: piles along the
  wall, the toe row solid and the others hidden; notes: the rows, type, D, embedment and the capacities as entered; loads: a line
  saying the pile reactions come with the pile analysis; schedule: none yet). `rwdwSupport(r)` returns it when `r.inp.fnd.type === 'pile'`.
- `calcAll`: in pile mode, one warning says the pile analysis is not in this version yet, so the results are still those of a spread footing.
### Problem
- None. This is new input and display. Spread-footing results are unchanged.
### Governing provision
- None in this PR (no calculation). The analysis (8c) cites AASHTO LRFD 10th Ed. (2024) Sec. 10.7 / 11.6 and IBC 2018 §1810 with ACI 318-19 Ch. 13.
### Check case
- Default wall with "Pile-supported", 2 rows: x = 1.5 ft and 11.0 ft from the toe (B = 12.5 ft), s = 6 ft, HP 12 in, embedment 12 in.
  The section shows the two piles 1.5 ft from each footing edge with "ROW 1 @ 6'-0" O.C." and "ROW 2 @ 6'-0" O.C.". Every result is as for the spread footing, plus the warning.
### How verified
- origin/main vs branch, headless Chromium, 12 walls (all in spread mode). Every `_R` value (`inp.fnd` aside), the Export JSON,
  the autosave, the Report text, the tab texts and the DXF are identical:
  - ACI: default; water uniform / triangular; mix (water, k_h, column, β, q_s, key, passive, D_f); short toe; k_h 0.10.
  - AASHTO: default; collision + barrier; water + column + η 1.05 + at-rest; rock + collision + water; k_h 0.10 + q_s + key; variable height + interface shear.
- `node tests/check-syntax.mjs`;
- `tests/smoke/retaining-wall-checks.mjs`, `phone-layout.mjs --tool rwall --w 390,768`, `project-library.mjs --tool retwall`, `dxf-print-sheets.mjs --tool rw`;
- screenshots of pile mode (inputs, section sheet, 3D).
### Other copies
- None.
### Open items
- 8c (pile analysis and checks, soil checks replaced), 8d (footing from the pile reactions, punching), 8e (Report / Drawings / schedule), 8f (Pile Designer hand-off).
- **Decision (pending engineer review):** 2 to 4 rows (a single row of pinned vertical piles cannot take the wall moment).
- **Decision (pending engineer review):** placeholder capacities until the geotechnical values are entered (ACI P_a 100 / T_a 25 / H_a 8 kip; AASHTO R_n 300 kip with φ_c 0.65, R_n,up 100 kip with φ_up 0.50, H_r 20 kip). They are only used in pile mode.

### Before / after (code, `git diff -U0` of `Retaining Wall Designer.html`, HTML card abbreviated to its field ids above)
```diff
+<!-- RWPL (2026-11-07): Phase 8b, foundation type and pile rows (pile-supported footing). Spread footing is the default; every field
+     below is saved only when it differs from its default, so a spread-footing project saves and opens exactly as before. -->
+<button type="button" class="sec-hd" data-target="sec-fnd" aria-expanded="true"><span class="sec-hd-label">Foundation</span><svg class="sec-hd-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
+<div class="sec-body" id="sec-fnd">
+    <div class="ig full"><label for="fnd_type">Foundation type</label>
+      <select id="fnd_type">
+        <option value="spread">Spread footing on soil</option>
+        <option value="pile">Pile-supported footing (rows of vertical piles)</option>
+      </select></div>
+    <div class="note pile-only" id="note_pile" style="display:none">Rows of identical vertical piles across the footing, each with its own spacing along the wall; one pile type per wall; no staggering. The footing acts as a rigid cap (Phase 8). <span class="aci-only">ACI / IBC mode: allowable pile capacities (service loads).</span><span class="aashto-only" style="display:none">AASHTO mode: nominal resistances with their φ, factored lateral resistance.</span></div>
+    <div class="ig full pile-only" style="display:none"><label for="pile_nrows">Number of pile rows</label>
+      <select id="pile_nrows">
+        <option value="2" selected>2</option>
+        <option value="3">3</option>
+        <option value="4">4</option>
+      </select></div>
+    <div class="ig full pile-only" style="display:none"><label for="pile_shape">Pile type</label>
+      <select id="pile_shape">
+        <option value="hp">Steel H-pile</option>
+        <option value="pipe">Steel pipe pile</option>
+        <option value="square">Square precast concrete</option>
+        <option value="round">Round (timber / cast-in-place)</option>
+      </select></div>
+      <input type="text" id="pile_desig" placeholder="e.g. HP 12×53"></div>
+    <div class="ck-row pile-only" style="display:none">
+      <input type="checkbox" id="pile_passive">
+      <label for="pile_passive">Credit passive in front of the footing against the lateral load (pile mode)</label>
+    </div>
+    <div class="hint pile-only" id="hint_pile_cap" style="display:none">Enter the capacities from the geotechnical report or from Pile Designer. The defaults are placeholders.</div>
+  </div>
+  // RWPL (2026-11-07, Phase 8b): pile-supported footing selected: inputs and drawings only in this version
+  if (inp.fnd && inp.fnd.type === 'pile') warnings.push('Pile-supported footing selected: the piles are drawn, but the pile analysis is not in this version yet (Phase 8c). The stability and footing results shown are still those of a spread footing on soil.');
+/* RWPL (2026-11-07): Phase 8 pile-supported footing. The inputs (Wall tab, Foundation card): foundation type, 2 to 4 rows of identical
+   vertical piles (x from the toe, spacing along the wall), pile type and width, embedment and clear cover over the pile heads,
+   capacities per mode (ACI / IBC: allowable P_a, T_a, H_a; AASHTO: R_n with φ_c, R_n,up with φ_up, factored H_r), and the opt-in
+   passive credit. type 'spread' (the default, and every project saved before) is the spread footing on soil, unchanged. */
+const RWPL_DEF = { fnd_type: 'spread', pile_nrows: '2', pile_x1: '1.5', pile_s1: '6', pile_x2: '11', pile_s2: '6', pile_x3: '6', pile_s3: '6', pile_x4: '9', pile_s4: '6',
+  pile_shape: 'hp', pile_desig: '', pile_size: '12', pile_embed: '12', pile_clr: '3', pile_Pa: '100', pile_Ta: '25', pile_Ha: '8',
+  pile_Rn: '300', pile_phic: '0.65', pile_Rnup: '100', pile_phiup: '0.5', pile_Hr: '20', pile_passive: false };
+function rwPileInputs() {
+  const el = id => document.getElementById(id), v = id => { const e = el(id); return e ? parseFloat(e.value) : NaN; };
+  const type = (el('fnd_type') || {}).value === 'pile' ? 'pile' : 'spread';
+  const nr = Math.max(2, Math.min(4, parseInt((el('pile_nrows') || {}).value, 10) || 2));
+  const rows = []; for (let k = 1; k <= nr; k++) rows.push({ x: v('pile_x' + k), s: v('pile_s' + k) });
+  return { type, rows, shape: (el('pile_shape') || {}).value || 'hp', desig: ((el('pile_desig') || {}).value || '').trim(),
+    D: v('pile_size'), embed: v('pile_embed'), clr: v('pile_clr'),
+    Pa: v('pile_Pa'), Ta: v('pile_Ta'), Ha: v('pile_Ha'), Rn: v('pile_Rn'), phic: v('pile_phic'), Rnup: v('pile_Rnup'), phiup: v('pile_phiup'), Hr: v('pile_Hr'),
+    passive: !!(el('pile_passive') && el('pile_passive').checked) };
+}
+function rwPileUI() {
+  const el = id => document.getElementById(id);
+  const pile = el('fnd_type') && el('fnd_type').value === 'pile', isA = el('design_basis') && el('design_basis').value === 'AASHTO';
+  const nr = parseInt((el('pile_nrows') || {}).value, 10) || 2;
+  document.querySelectorAll('.pile-only').forEach(e => {
+    const m = /pile-row-(\d)/.exec(e.className), show = pile && !(e.classList.contains('aci-only') && isA) && !(e.classList.contains('aashto-only') && !isA) && !(m && +m[1] > nr);
+    e.style.display = show ? '' : 'none';
+  });
+}
+    ...(() => { const fd = rwPileInputs(); return fd.type === 'pile' ? { fnd: fd } : {}; })(),   // RWPL (2026-11-07): foundation type and pile rows (Phase 8); present only on piles, so a spread footing's inputs are as before
+  rwPileUI();   // RWPL: the pile fields follow the foundation type, the row count and the mode
+Object.assign(RWLS_DEF, RWPL_DEF);   // RWPL (2026-11-07): the pile fields are saved only when changed; old saves open as a spread footing
+  rwPileUI();   // RWPL
+  // ── RWPL (2026-11-07): pile-supported footing ──
+  if (sel('fnd_type') === 'pile') {
+    const nr = Math.max(2, Math.min(4, parseInt(sel('pile_nrows'), 10) || 2));
+    const Bft = (val('Lt') || 0) + (val('ts_bot') || 0) / 12 + (val('Lh') || 0), xs = [];
+    for (let k = 1; k <= nr; k++) {
+      const xi = 'pile_x' + k, si = 'pile_s' + k;
+      if (need(xi, Object.assign(v => v >= 0 && v <= Bft + 1e-9, { msg: `must be within the footing, 0 to B = ${f(Bft, 2)} ft from the toe` }))) {
+        if (xs.some(x => Math.abs(x - val(xi)) < 1e-6)) err(xi, `${lab(xi)} = ${raw(xi)} ft: two rows at the same x; give each row its own position.`);
+        xs.push(val(xi));
+      }
+      need(si, gt0);
+    }
+    const D = need('pile_size', gt0), em = need('pile_embed', ge0), cl = need('pile_clr', ge0);
+    if (D && nr) for (let k = 1; k <= nr; k++) { const xi = val('pile_x' + k), r2 = val('pile_size') / 24;
+      if (isFinite(xi) && (xi < r2 - 1e-9 || xi > Bft - r2 + 1e-9)) R.push(['pile_x' + k, `${lab('pile_x' + k)} = ${raw('pile_x' + k)} ft: the pile (D = ${raw('pile_size')} in) extends past the footing edge. Confirm the edge distance.`]); }
+    if (tfOk && em && cl && val('pile_embed') + val('pile_clr') >= val('tf')) err('pile_embed', `${lab('pile_embed')} ${raw('pile_embed')} in + clear ${raw('pile_clr')} in is not less than the footing thickness t_f = ${raw('tf')} in.`);
+    if (isA) { need('pile_Rn', gt0); need('pile_Rnup', ge0); need('pile_Hr', ge0);
+      const phi = Object.assign(v => v > 0 && v <= 1, { msg: 'must be greater than 0 and not more than 1' }); need('pile_phic', phi); need('pile_phiup', phi); }
+    else { need('pile_Pa', gt0); need('pile_Ta', ge0); need('pile_Ha', ge0); }
+  }
+  rwPileUI();   // RWPL: pile fields follow the foundation type and the row count
+/* RWPL (2026-11-07): the pile rows under the footing in an elevation-style SVG (Analysis diagram, Overview): each row drawn as a pile of
+   width D, its embedded length dashed inside the footing, a stub below with a break line. Display only. */
+function rwPileSVG(r, x_toe, y_fbot, SCALE, stroke) {
+  const P = r.inp && r.inp.fnd; if (!P || P.type !== 'pile') return '';
+  const d = Math.max(3, P.D / 12 * SCALE), em = P.embed / 12 * SCALE, L = Math.max(28, 1.6 * SCALE);
+  let o = '<g class="rw-piles">';
+  P.rows.forEach((rw, i) => {
+    const xc = x_toe + rw.x * SCALE, x0 = xc - d / 2, x1 = xc + d / 2, yb = y_fbot + L, h = Math.min(5, d / 3);
+    o += `<rect x="${x0}" y="${y_fbot - em}" width="${d}" height="${em}" fill="none" stroke="${stroke}" stroke-width="0.9" stroke-dasharray="3 2"/>`;
+    o += `<path d="M${x0},${y_fbot} L${x0},${yb} L${xc - d / 4},${yb - h} L${xc + d / 4},${yb + h} L${x1},${yb} L${x1},${y_fbot} Z" fill="rgba(90,100,110,0.18)" stroke="${stroke}" stroke-width="1.1"`
+      + ` data-tip="<b>Pile row ${i + 1}</b><br>x = ${f(rw.x, 2)} ft from the toe · spacing ${f(rw.s, 2)} ft along the wall<br>D = ${f(P.D, 1)} in · embedment ${f(P.embed, 1)} in${P.desig ? '<br>' + P.desig.replace(/[<>&"]/g, '') : ''}"/>`;
+  });
+  return o + '</g>';
+}
+  s += rwPileSVG(r, x_toe, y_fbot, SCALE, '#3d4650');   // RWPL: pile rows (pile-supported footing only)
+  s += rwPileSVG(r, x_toe, y_fbot, SCALE, '#3d4650');   // RWPL: pile rows (pile-supported footing only)
+  // RWPL (2026-11-07): pile rows under a pile-supported footing (display; length drawn nominal, 0.6 H, at least 4 ft)
+  if (inp.fnd && inp.fnd.type === 'pile') {
+    const P = inp.fnd, d = P.D / 12, top = P.embed / 12, Lp = Math.max(4, 0.6 * H), steel = P.shape === 'hp' || P.shape === 'pipe';
+    const geo = (P.shape === 'pipe' || P.shape === 'round') ? new THREE.CylinderGeometry(d / 2, d / 2, top + Lp, 16) : new THREE.BoxGeometry(d, top + Lp, d);
+    const pm = mat(steel ? 0x5a6470 : 0x8a8f96);
+    P.rows.forEach(rw => { if (!(rw.s > 0)) return;
+      for (let z = rw.s / 2; z < WL - 1e-6; z += rw.s) { const m = new THREE.Mesh(geo, pm); m.position.set(rw.x, (top - Lp) / 2, z); m.castShadow = true; G.concrete.add(m); } });
+  }
+
-  // piles: { section, elev, loads, notes, schedule }   planned (pile rows across the footing: plan / section / schedule)
+  /* RWPL (2026-11-07): pile-supported footing (Phase 8b): pile rows in the section and the elevation, the pile notes. The pile
+     reactions on the loads sheet and the pile schedule follow with the pile analysis (8c / 8e). */
+  piles: {
+    label: 'PILE-SUPPORTED FOOTING',
+    section(c) {
+      const { D, L, G, k, r } = c, P = r.inp.fnd, d = P.D, em = P.embed, yb = -1.6 * k, hid = D.ltype('HIDDEN');
+      if (G.dk > 0) { D.line(L.soil, -0.15 * k, 0, G.kx, 0); D.line(L.soil, G.kx + G.kw, 0, G.B + 0.15 * k, 0); } else D.line(L.soil, -0.15 * k, 0, G.B + 0.15 * k, 0);
+      P.rows.forEach((rw, i) => {
+        const x = rw.x * 12, x0 = x - d / 2, x1 = x + d / 2;
+        D.line(L.hid, x0, 0, x0, em, hid); D.line(L.hid, x1, 0, x1, em, hid); D.line(L.hid, x0, em, x1, em, hid);   // embedded length
+        D.line(L.conc, x0, 0, x0, yb); D.line(L.conc, x1, 0, x1, yb);
+        const m = (x0 + x1) / 2, h = 0.06 * k;   // break line
+        D.pline(L.conc, [[x0 - 0.03 * k, yb], [m - h / 2, yb], [m - h / 4, yb + h], [m + h / 4, yb - h], [m + h / 2, yb], [x1 + 0.03 * k, yb]], false);
+        D.text(L.txt, x, yb - 0.18 * k, 0.085 * k, 'ROW ' + (i + 1) + ' @ ' + rwdwFI(rw.s * 12) + ' O.C.', 1);
+      });
+    },
+    elev(c) {
+      const { D, L, k, r, x0, x1 } = c, P = r.inp.fnd, d = P.D, yb = -1.4 * k, hid = D.ltype('HIDDEN');
+      D.line(L.soil, x0, 0, x1, 0);
+      const order = P.rows.map((rw, i) => ({ rw, i })).sort((a, b) => a.rw.x - b.rw.x);   // the toe row is nearest the viewer
+      order.forEach(({ rw }, j) => { const s = rw.s * 12; if (!(s > 0)) return;
+        for (let x = x0 + s / 2; x < x1 - 1e-6; x += s) { const lt = j ? hid : undefined, l = j ? L.hid : L.conc;
+          D.line(l, x - d / 2, 0, x - d / 2, yb, lt); D.line(l, x + d / 2, 0, x + d / 2, yb, lt); } });
+    },
+    loads(c) { const { L, G, k, T } = c; let y0 = c.y0 != null ? c.y0 : -G.dk - 0.35 * k;
+      T(L.lt, G.B / 2, y0 - 0.2 * k, 0.085 * k, 'PILE-SUPPORTED FOOTING: PILE REACTIONS WITH THE PILE ANALYSIS (NOT YET IN THIS VERSION)', 1); return y0 - 0.6 * k; },
+    notes(r) {
+      const P = r.inp.fnd, isA = r.isAASHTO, sh = { hp: 'STEEL H-PILES', pipe: 'STEEL PIPE PILES', square: 'SQUARE PRECAST CONCRETE PILES', round: 'ROUND PILES' }[P.shape] || 'PILES';
+      return ['PILE-SUPPORTED FOOTING: ' + P.rows.length + ' ROWS OF VERTICAL ' + sh + (P.desig ? ' (' + P.desig + ')' : '') + ', D = ' + rwdwIn(P.D) + ', EMBEDDED ' + rwdwIn(P.embed) + ' INTO THE FOOTING; ROWS AT '
+        + P.rows.map(rw => rwdwFI(rw.x * 12) + ' FROM THE TOE @ ' + rwdwFI(rw.s * 12)).join(', ') + '.',
+        isA ? 'PILE RESISTANCES (AS ENTERED): R_N = ' + rwdwN(P.Rn, 0) + ' KIP (PHI_C = ' + rwdwN(P.phic, 2) + '), R_N,UP = ' + rwdwN(P.Rnup, 0) + ' KIP (PHI_UP = ' + rwdwN(P.phiup, 2) + '), H_R = ' + rwdwN(P.Hr, 1) + ' KIP (FACTORED), PER THE GEOTECHNICAL ENGINEER.'
+            : 'ALLOWABLE PILE CAPACITIES (SERVICE LOADS, AS ENTERED): P_A = ' + rwdwN(P.Pa, 0) + ' KIP, T_A = ' + rwdwN(P.Ta, 0) + ' KIP (UPLIFT), H_A = ' + rwdwN(P.Ha, 1) + ' KIP (LATERAL), PER THE GEOTECHNICAL ENGINEER.'];
+    },
+    schedule() { return []; },
+  },
-const rwdwSupport = r => RWDW_SUPPORT.soil;   // the foundation type of the model; spread footing only today
+const rwdwSupport = r => (r && r.inp && r.inp.fnd && r.inp.fnd.type === 'pile') ? RWDW_SUPPORT.piles : RWDW_SUPPORT.soil;   // RWPL: the foundation type of the model
```

## 2026-11-07 — PR: claude/rw-pile-8c-analysis — Pile-supported footing, Phase 8c: rigid-cap pile reactions per combination, pile compression / uplift / lateral and detailing checks; soil bearing, sliding and overturning replaced in pile mode (RWPL; calculation change in pile mode only) (PR #958: https://github.com/mlococo88/All-Structural/pull/958)

Review Phase 8, PR 8c. Engineer decisions 2026-11-07 (review Q11–Q15, taken as recommended) and the decisions listed under Open items. Code sites are tagged `RWPL`. Spread-footing results are unchanged.

### RWPL-4. `rwPileAnalysis(ctx)` (new, before `calcAll`)   [§4]
- Uses `shared/pile-group.js` (new script tag before `shared/dxf.js`). Per ft of wall, with n_i = 1/s_i:
  - N = Σn_i, x̄ = Σn_i·x_i/N, I = Σn_i·(x_i − x̄)².
  - For each combination (V net of water uplift on the cap base, resultant at x_R from the toe): M = V·(x_R − x̄) and P_i = V/N + M·(x_i − x̄)/I per pile.
  - h = H/N per pile.
- **ACI / IBC (allowable, service):** ASCE 7-16 §2.4.1 combinations against P_a, T_a and H_a (IBC 2018 §1810.3.3.1, §1810.3.3.1.5, §1810.3.3.2).
  - **s1, D + H + L:** V = ΣV (as the bearing check). x_R = (M_s − M_s,Pp − M_o,static)/ΣV. H = F_h.
  - **s2, D + H + L + 0.7E** (when k_h > 0): M_o,static + 0.7·M_o,E. H = F_h + 0.7·ΔP_E.
  - **s3, 0.6D + H:**
    - V = 0.6(W_ftg + W_stem + W_soil + W_bar + w_col,D) + 0.6·P_a,V + 0.6·min(0, w_col,W) − U_water.
    - Moments are taken the same way about the toe (water uplift at 1.0). The surcharge and column L / S are omitted.
  - **s4, 0.6D + 0.7E + H** (when k_h > 0).
- **AASHTO (factored):** the tool's own limit-state sets.
  - **Strength I max (bearing set):** V_str,max, x_R,brg, H_str. Checked against φ_c R_n, φ_up R_n,up and H_r.
  - **Strength I min (Ia, eccentricity set):** V_str,min, x_R,A, H_str.
  - **Extreme Event I (both Art. 11.6.5.1 cases):** V_max with x_Rb, and V_min with x_R.
  - **Extreme Event II (collision):** V_ct,max with x_R,brg,ct, and V_ct,min with x_R,ct.
  - The extreme events are checked against 1.0 R_n, 0.80 R_n,up and H_r (Art. 10.5.5.3.3).
- **Passive (opt-in `pile_passive`):** H − P_p,toe (ACI) or H − φ_ep P_p,toe (AASHTO; 1.0 in the extreme events). There is no base friction.
- **Detailing:**
  - AASHTO Art. 10.7.1.2: c-c spacing ≥ max(30 in, 2.5D), along the wall and row to row (Δx, conservative for no staggering); pile side to the footing edge ≥ 9 in; embedment ≥ 12 in.
  - IBC 2018 §1810.3.11: embedment ≥ 3 in; the cap extends ≥ 4 in beyond the pile; no minimum spacing.
  - Group-effect warnings at s < 3D (axial) and row spacing < 8D (lateral) (IBC 2018 §1810.2.5; AASHTO Art. 10.7.2.4 / 10.7.3.9).
### RWPL-5. `calcAll` (block `// ── RWPL (2026-11-07, Phase 8c): pile-supported footing`, before `const checks = {`)
- In pile mode, `checks` starts with `pileComp`, `pileUplift`, `pileLat`, `pileSpacing` (AASHTO), `pileEdge` and `pileEmbed` **instead of** `stabChecks` (ot / sliding / bearing / ecc / otE / slidingE).
- The soil checks of Extreme Event I and II (eeSliding / eeEcc / eeBearing, ctSliding / ctEcc / ctBearing) are not listed (`!isPile &&`).
- Each pile check carries its own `ref` and `dc`. `rwResultRows` uses them when `D[k]` has no entry.
- Warnings:
  - the soil checks are not done; the heel and toe are still designed from the soil bearing until 8d;
  - group effects;
  - the passive credit, when ticked.
- The soil-bearing notes ("AASHTO bearing: φb·qn = 4950 psf …", "tension zone in soil") are removed in pile mode.
- `return` gains `pile` only in pile mode (`...(pile ? { pile } : {})`): a spread footing's results have no new field.
### RWPL-6. Display / Report
- **Stability tab:** `renderStability` now calls `renderStabilitySoil` (the former body, unchanged) and, in pile mode, `rwPileStability(r)`:
  - Pile Step 1, the group table and N, x̄, I;
  - Pile Step 2, the reactions table per combination, the governing compression worked, and the compression, uplift and lateral checks, and the detailing.
  - The soil cards are dimmed with "Not applicable: pile-supported footing".
- **Overview scorecard:** a "Piles" group (compression, uplift, lateral) replaces Stability in pile mode.
- **Dashboard / summary links:** `RW_CARDS.stabPile`, `RW_CHECK_CARD` for the pile keys.
- **Report:** a new section "Pile-supported footing" after the stability section:
  - pile data;
  - Pile Step 1 steps (N, x̄, I);
  - Pile Step 2 (reactions table, governing steps, detailing table);
  - a note at the head of the stability section that its soil checks do not apply.
  - The summary "Worked in" links point to pl2/comp, pl2/upl and pl2/latdc.
### Check case (default wall, 2 rows at x = 1.5 / 11.0 ft, s = 6 ft)
- Group: N = 2/6 = 0.3333 /ft; x̄ = (1.5 + 11.0)/2 = 6.25 ft; I = 2(1/6)(4.75²) = 7.5208 ft²/ft.
- **ACI s1 (D + H + L):**
  - ΣV = 16582.5 lb/ft; M_s = 123673.1; M_o = 16402.5 lb-ft/ft.
  - x_R = 107270.6/16582.5 = 6.4689 ft; M = 16.5825(6.4689 − 6.25) = 3.630 kip-ft/ft.
  - P_toe = 16.5825/0.3333 − 3.630(4.75)/7.5208 = 49.748 − 2.293 = **47.45 kip**; P_heel = 49.748 + 2.293 = **52.04 kip** ≤ P_a 100 (D/C 0.52).
  - H = 3.645 kip/ft gives 10.94 kip/pile > H_a 8 (placeholder): FAIL, D/C 1.37.
- **ACI s3 (0.6D + H):**
  - V = 0.6(2812.5 + 2250 + 11520) = 9949.5 lb/ft; x_R = 5.8095 ft; M = −4.383 kip-ft/ft.
  - P = 29.849 ± 4.383(4.75)/7.5208 = **32.62 / 27.08 kip** (no uplift).
- **AASHTO Strength I max:**
  - V = 26.878 kip/ft at x_R = 6.0750 ft; M = −4.702 kip-ft/ft.
  - P_toe = 80.634 + 2.970 = **83.60 kip**; P_heel = **77.66 kip** ≤ φ_c R_n = 0.65 × 300 = 195 (D/C 0.43).
- Before (the same wall as a spread footing): O.T. FOS 7.54, sliding 1.66, bearing 1.47 ksf. Spread-footing walls are unchanged.
### How verified
- origin/main vs branch, headless Chromium, the 12 walls of 8b in spread mode: every `_R` value (`inp.fnd` and `pile` aside), the Export JSON, the autosave, the Report text, the tab texts and the DXF are identical.
- Pile mode on the default wall (ACI and AASHTO), ACI k_h 0.15 (s1 to s4), and AASHTO k_h 0.10 + collision + water + passive: no console errors, and the numbers above.
- `tests/smoke/retaining-wall-checks.mjs` extended:
  - 4 pile input-error cases;
  - the ACI and AASHTO pile cases above;
  - a spread case with no pile results.
- Also run: `node tests/check-syntax.mjs`; phone layout rwall 390/768; project library retwall; DXF sheets rw.
### Other copies
- The rigid-cap formula: `shared/pile-group.js` (loaded here) and `abutment_calculator.html` `pileReaction` (to move onto the shared file, PR 8h).
### Open items / decisions (pending engineer review)
- **Decision (pending engineer review):** ACI uplift case 0.6D + H with 0.6 on the vertical earth thrust (resisting, permanent) and 1.0 on water uplift (ASCE 7-16 §2.4.1 H rule). The surcharge and the column L / S are omitted.
- **Decision (pending engineer review):** ACI compression with E uses D + H + L + 0.7E, which covers ASCE 7-16 combinations 5 and 6b.
- **Decision (pending engineer review):** the AASHTO extreme-event uplift φ is 0.80 (the Art. 10.5.5.3.3 upper limit) and the compression φ is 1.0. The entered factored H_r is used for every limit state (conservative for the extreme events).
- **Decision (pending engineer review):** the passive credit uses the toe passive only (no shear-key passive) and does not reduce the moment.
- **Decision (pending engineer review):** row-to-row spacing is checked with Δx, as if piles of adjacent rows were in line.
- **Decision (pending engineer review):** ACI 318-19 Ch. 13 is cited without article numbers. The PDF text could not be read in this session, and the IBC 2018 §1810 sections were verified.
- Next steps: 8d (footing from the pile reactions), 8e (Drawings loads sheet, 3D and diagram reaction display), 8f (Pile Designer hand-off). Battered piles: 8g, which needs a method decision.

### Before / after (code, `git diff -U0` of `Retaining Wall Designer.html` against the 8b branch)
```diff
+<script src="shared/pile-group.js"></script>   <!-- RWPL (2026-11-07): rigid-cap pile-group statics (pile-supported footing, Phase 8c) -->
-  ftgKey:      ['footing', 'Shear Key — Structural Design', 'Shear Key — Structural Design'],   // RWSK   // RWBP (2026-11-06): link target of the bearing selector
+  ftgKey:      ['footing', 'Shear Key — Structural Design', 'Shear Key — Structural Design'],
+  stabPile:    ['stability', 'Pile Step 2 — Pile Reactions and Checks', 'Pile Step 2 — Pile Reactions and Checks'],   // RWPL   // RWSK   // RWBP (2026-11-06): link target of the bearing selector
-const RW_CHECK_CARD = { ot:'stabOT', otE:'stabOT', sliding:'stabSlide', slidingE:'stabSlide', bearing:'stabBrg', ecc:'stabEcc',
+const RW_CHECK_CARD = { pileComp:'stabPile', pileUplift:'stabPile', pileLat:'stabPile', pileSpacing:'stabPile', pileEdge:'stabPile', pileEmbed:'stabPile', ot:'stabOT', otE:'stabOT', sliding:'stabSlide', slidingE:'stabSlide', bearing:'stabBrg', ecc:'stabEcc',
+/* RWPL (2026-11-07, Phase 8c): pile-supported footing analysis. Rigid cap on rows of identical vertical piles (shared/pile-group.js,
+   SharedPileGroup.rowGroup / rowLoads): per ft of wall, n_i = 1/s_i, N = Σn_i, x̄ = Σn_i·x_i/N, I = Σn_i·(x_i − x̄)²; for a combination
+   with vertical load V (per ft, net of water uplift on the cap base) whose resultant is at x_R from the toe, M = V·(x_R − x̄) and the
+   load on one pile of row i is P_i = V/N + M·(x_i − x̄)/I; each pile takes H/N of the horizontal load (vertical piles, equal share).
+   Basis by mode (engineer decisions 2026-11-07, review Q11–Q15):
+   - ACI / IBC: service (ASD) combinations of ASCE 7-16 §2.4.1 against the allowable pile capacities (IBC 2018 §1810.3.3.1 axial,
+     §1810.3.3.2 lateral): D + H + L (+ surcharge), D + H + L + 0.7E, 0.6D + H (0.6 on the resisting vertical earth thrust, 1.0 on water
+     uplift; 0.6W of a column uplift), 0.6D + 0.7E + H. IBC 2018 §1810.3.11: the soil under the cap carries no vertical load.
+   - AASHTO: Strength I maximum (the bearing set) and minimum (Ia, the eccentricity set) factored loads against φ_c·R_n, φ_up·R_n,up and the
+     factored H_r; Extreme Event I (both Art. 11.6.5.1 cases) and II (collision) with φ = 1.0, uplift φ = 0.80 (Art. 10.5.5.3.3).
+   Soil bearing, base sliding and overturning / eccentricity are not checked in pile mode. Passive in front of the toe (P_p,toe) is
+   credited against H only when ticked (φ_ep in AASHTO). The footing design (8d) moves to the pile reactions in a later phase.
+   ctx (lb, ft): the calcAll quantities named below. Returns the pile results in kip and ft. */
+function rwPileAnalysis(ctx) {
+  const P = ctx.fnd, isA = ctx.isAASHTO, SPG = window.SharedPileGroup, k = 1000;
+  const out = { rows: P.rows.map(r => ({ x: r.x, s: r.s })), D: P.D, embed: P.embed, clr: P.clr, shape: P.shape, desig: P.desig, passive: !!P.passive, isA };
+  if (!SPG) { out.err = 'shared/pile-group.js is not loaded: keep the shared folder next to this file.'; return out; }
+  const g = SPG.rowGroup(P.rows); out.g = g;
+  if (!g.ok || !(g.I > 0)) { out.err = 'Pile rows: ' + (g.err || 'the rows must be at two or more different positions'); return out; }
+  const Hp = P.passive ? (isA ? ctx.phi_ep : 1.0) * ctx.Pp_toe : 0;   // passive credit (lb/ft), opt-in
+  out.Hpass = Hp / k;
+  const comb = [];   // {key, label, V (kip/ft), xR (ft), H (kip/ft), cap: {c, t, h} (kip per pile), kind}
+  const add = (key, label, V, xR, H, cap, kind, Hp0) => comb.push({ key, label, V: V / k, xR, H: Math.max(0, H - (Hp0 == null ? Hp : Hp0)) / k, Hgross: H / k, cap, kind });
+  if (!isA) {
+    const cap = { c: P.Pa, t: P.Ta, h: P.Ha, cs: 'P_a', ts: 'T_a', hs: 'H_a' };
+    const c = ctx;
+    const Mst = c.Ms - c.Ms_Pp;   // the toe-passive moment is not credited to the piles
+    add('s1', 'D + H + L (service)', c.SumV, (Mst - c.Mo_st) / c.SumV, c.Fh, cap, 'max');
+    const D6 = 0.6 * (c.Wftg + c.Wstem + c.Wsoil + c.W_bar + c.pDL) + 0.6 * c.Pa_tri_v + 0.6 * Math.min(0, c.pWL) - c.F_uplift;
+    const M6 = 0.6 * (c.Ms_ftg + c.Ms_stem + c.Ms_soil + c.Ms_bar + c.pDL * c.x_col) + 0.6 * c.Ms_Pv + 0.6 * Math.min(0, c.pWL) * c.x_col + c.Ms_uplift;
+    add('s3', '0.6D + H (minimum vertical)', D6, (M6 - c.Mo_st) / D6, c.Fh, cap, 'min');
+    if (c.hasSeismic) {
+      add('s2', 'D + H + L + 0.7E', c.SumV, (Mst - c.Mo_st - 0.7 * c.Mo_seis) / c.SumV, c.Fh + 0.7 * c.Pe_inc, cap, 'max');
+      add('s4', '0.6D + 0.7E + H', D6, (M6 - c.Mo_st - 0.7 * c.Mo_seis) / D6, c.Fh + 0.7 * c.Pe_inc, cap, 'min');
+    }
+  } else {
+    const a = ctx.aashtoR, capS = { c: P.phic * P.Rn, t: P.phiup * P.Rnup, h: P.Hr, cs: '\\phi_c R_n', ts: '\\phi_{up} R_{n,up}', hs: 'H_r' };
+    const capE = { c: 1.0 * P.Rn, t: 0.80 * P.Rnup, h: P.Hr, cs: '1.0 R_n', ts: '0.80 R_{n,up}', hs: 'H_r' };
+    add('str_max', 'Strength I (maximum vertical)', a.V_str_max, a.x_R_brg, a.H_drive_str, capS, 'max');
+    add('str_min', 'Strength I (minimum vertical)', a.V_str_min, a.x_R_A, a.H_drive_str, capS, 'min');
+    const HpE = P.passive ? 1.0 * ctx.Pp_toe : 0;
+    if (a.ee1) [['c1', 'P_AE + 0.5P_IR'], ['c2', 'max(0.5P_AE, P_A) + P_IR']].forEach(([q, t]) => { const c = a.ee1[q];
+      add('ee1_' + q + '_max', 'Extreme Event I, ' + t + ' (maximum vertical)', a.ee1.V_max, c.xRb, c.H, capE, 'max', HpE);
+      add('ee1_' + q + '_min', 'Extreme Event I, ' + t + ' (minimum vertical)', a.ee1.V_min, c.xR, c.H, capE, 'min', HpE); });
+    if (a.ct && a.ct.ee2) { const E = a.ct.ee2;
+      add('ee2_max', 'Extreme Event II, collision (maximum vertical)', E.V_ct_max, E.x_R_brg_ct, E.H_drive_ct, capE, 'max', HpE);
+      add('ee2_min', 'Extreme Event II, collision (minimum vertical)', E.V_ct_min, E.x_R_ct, E.H_drive_ct, capE, 'min', HpE); }
+  }
+  comb.forEach(c => { if (!(c.V > 0) || !isFinite(c.xR)) { c.xR = isFinite(c.xR) ? c.xR : g.xbar; }
+    c.M = SPG.momentAbout(c.V, c.xR, g.xbar); c.L = SPG.rowLoads(g, c.V, c.M, c.H);
+    c.dcC = c.L.Pmax > 0 ? c.L.Pmax / Math.max(c.cap.c, 1e-9) : 0;
+    c.dcT = c.L.Pmin < 0 ? -c.L.Pmin / Math.max(c.cap.t, 1e-9) : 0;
+    c.dcH = c.L.rows.length ? c.L.rows[0].h / Math.max(c.cap.h, 1e-9) : 0; });
+  if (!isA) comb.sort((p, q) => (p.key < q.key ? -1 : 1));   // s1 D+H+L, s2 +0.7E, s3 0.6D+H, s4 0.6D+0.7E+H
+  out.comb = comb;
+  const gov = f => comb.reduce((b, c) => (b === null || f(c) > f(b)) ? c : b, null);
+  out.govC = gov(c => c.dcC); out.govT = gov(c => c.dcT); out.govH = gov(c => c.dcH);
+  // detailing minimums: AASHTO Art. 10.7.1.2 (c-c ≥ max(30 in, 2.5D); pile side to cap edge ≥ 9 in; embedment ≥ 12 in);
+  // IBC 2018 §1810.3.11 (embedment ≥ 3 in; cap ≥ 4 in beyond the pile edges); IBC has no minimum spacing (group effects, §1810.2.5)
+  const Din = P.D, B = ctx.B, xs = P.rows.map(r => r.x).slice().sort((p, q) => p - q);
+  const minRowDx = xs.slice(1).reduce((m, x, i) => Math.min(m, (x - xs[i]) * 12), Infinity);
+  const minS = Math.min(...P.rows.map(r => r.s)) * 12, cc = Math.min(minS, minRowDx);
+  const edge = Math.min(...P.rows.map(r => Math.min(r.x * 12, (B - r.x) * 12) - Din / 2));
+  out.det = { cc, minS, minRowDx, edge, embed: P.embed,
+    ccMin: isA ? Math.max(30, 2.5 * Din) : null, edgeMin: isA ? 9 : 4, embMin: isA ? 12 : 3,
+    ref: isA ? 'AASHTO LRFD 10th Ed. Art. 10.7.1.2' : 'IBC 2018 §1810.3.11' };
+  out.det.grp3 = cc < 3 * Din; out.det.grp8 = minRowDx < 8 * Din;
+  return out;
+}
-  // RWPL (2026-11-07, Phase 8b): pile-supported footing selected: inputs and drawings only in this version
-  if (inp.fnd && inp.fnd.type === 'pile') warnings.push('Pile-supported footing selected: the piles are drawn, but the pile analysis is not in this version yet (Phase 8c). The stability and footing results shown are still those of a spread footing on soil.');
+  // ── RWPL (2026-11-07, Phase 8c): pile-supported footing — pile reactions and checks replace soil bearing, sliding and overturning ──
+  const isPile = !!(inp.fnd && inp.fnd.type === 'pile');
+  const pile = isPile ? rwPileAnalysis({ fnd: inp.fnd, isAASHTO, aashtoR, B, phi_ep: inp.aashto.phi_ep, Pp_toe,
+    SumV, Ms, Ms_Pp, Mo_st, Mo_seis, Fh, Pe_inc, hasSeismic, Wftg, Wstem, Wsoil, W_bar, pDL, pWL, x_col, Pa_tri_v, F_uplift,
+    Ms_ftg, Ms_stem, Ms_soil, Ms_bar, Ms_Pv, Ms_uplift }) : null;
+  let pileChecks = null;
+  if (pile) {
+    if (pile.err) errors.push(pile.err);
+    else {
+      const pc = pile, d = pc.det;
+      pileChecks = {
+        pileComp:   { ok: pc.govC.dcC <= 1 + 1e-9, label: 'Pile Compression', val: `${f(pc.govC.L.Pmax,1)}${pc.govC.dcC <= 1 + 1e-9 ? '≤' : '>'}${f(pc.govC.cap.c,1)}k`, dc: pc.govC.dcC,
+                      ref: (isAASHTO ? 'AASHTO LRFD 10th Ed. Art. 10.5.5.2.3 (φ) / 10.7.3.9' : 'IBC 2018 §1810.3.3.1; ASD (ASCE 7-16 §2.4.1)') + '; ' + pc.govC.label },
+        pileUplift: { ok: pc.govT.dcT <= 1 + 1e-9, label: 'Pile Uplift', val: pc.govT.L.Pmin < 0 ? `${f(-pc.govT.L.Pmin,1)}${pc.govT.dcT <= 1 + 1e-9 ? '≤' : '>'}${f(pc.govT.cap.t,1)}k` : 'no uplift', dc: pc.govT.dcT,
+                      ref: (isAASHTO ? 'AASHTO LRFD 10th Ed. Art. 10.7.3.10' : 'IBC 2018 §1810.3.3.1.5') + '; ' + pc.govT.label },
+        pileLat:    { ok: pc.govH.dcH <= 1 + 1e-9, label: 'Pile Lateral', val: `${f(pc.govH.L.rows[0].h,2)}${pc.govH.dcH <= 1 + 1e-9 ? '≤' : '>'}${f(pc.govH.cap.h,1)}k`, dc: pc.govH.dcH,
+                      ref: (isAASHTO ? 'AASHTO LRFD 10th Ed. Art. 10.7.3.12; H<sub>r</sub> as entered' : 'IBC 2018 §1810.3.3.2; H<sub>a</sub> as entered') + '; H/N per pile, ' + pc.govH.label },
+        ...(isAASHTO ? { pileSpacing: { ok: d.cc >= d.ccMin - 1e-9, label: 'Pile Spacing', val: `${f(d.cc,1)}${d.cc >= d.ccMin - 1e-9 ? '≥' : '<'}${f(d.ccMin,1)}"`, dc: d.ccMin / Math.max(d.cc, 1e-9), ref: d.ref + '; c-c ≥ max(30 in, 2.5D), along the wall and row to row' } } : {}),
+        pileEdge:   { ok: d.edge >= d.edgeMin - 1e-9, label: 'Pile Edge Distance', val: `${f(d.edge,1)}${d.edge >= d.edgeMin - 1e-9 ? '≥' : '<'}${f(d.edgeMin,0)}"`, dc: d.edgeMin / Math.max(d.edge, 1e-9), ref: d.ref + '; pile side to the footing edge (toe / heel)' },
+        pileEmbed:  { ok: d.embed >= d.embMin - 1e-9, label: 'Pile Embedment', val: `${f(d.embed,1)}${d.embed >= d.embMin - 1e-9 ? '≥' : '<'}${f(d.embMin,0)}"`, dc: d.embMin / Math.max(d.embed, 1e-9), ref: d.ref + '; pile top into the footing' },
+      };
+      if (d.grp3) warnings.push(`Pile spacing ${f(d.cc,1)} in < 3D = ${f(3 * pc.D,1)} in: axial group effects apply (IBC 2018 §1810.2.5; AASHTO Art. 10.7.2.4 / 10.7.3.9). The capacities entered must include them.`);
+      if (d.grp8) warnings.push(`Row-to-row spacing ${f(d.minRowDx,1)} in < 8D = ${f(8 * pc.D,1)} in in the direction of the lateral load: lateral group effects apply (IBC 2018 §1810.2.5; AASHTO Art. 10.7.2.4). The lateral capacity entered must include them.`);
+      for (let i = warnings.length - 1; i >= 0; i--) if (/^AASHTO bearing|tension zone in soil/.test(warnings[i])) warnings.splice(i, 1);   // soil-bearing notes do not apply
+      warnings.push('Pile-supported footing: soil bearing, base sliding and overturning are not checked (the piles carry the wall). The heel and toe are still designed from the soil bearing pressure in this version; the design from the pile reactions follows (Phase 8d).');
+      if (pc.passive) warnings.push(`Pile mode: passive in front of the toe credited against H: ${f(pc.Hpass,3)} kip/ft${isAASHTO ? ' (φ_ep = ' + f(inp.aashto.phi_ep,2) + ')' : ''}.`);
+    }
+  }
-    ...stabChecks,
+    ...(pileChecks || stabChecks),
-    ...(isAASHTO && aashtoR && aashtoR.ee1 ? {   // RWE1
+    ...(!isPile && isAASHTO && aashtoR && aashtoR.ee1 ? {   // RWE1
-    ...(isAASHTO && aashtoR && aashtoR.ct && aashtoR.ct.ee2 ? {
+    ...(!isPile && isAASHTO && aashtoR && aashtoR.ct && aashtoR.ct.ee2 ? {
+    ...(pile ? { pile } : {}),   // RWPL (2026-11-07): pile-supported footing results (absent for a spread footing, so its results are as before)
+/* RWPL (2026-11-07, Phase 8c): in pile mode the Stability tab opens with the pile cards (group, reactions per combination, checks);
+   the soil cards below stay for the earth pressures and are marked "not applicable" where they check the soil. */
+  renderStabilitySoil(r);
+  if (!r.fatal && r.pile && !r.pile.err) rwPileStability(r);
+}
+function rwPileStability(r) {
+  const el = document.getElementById('tab-stability'); if (!el) return;
+  const P = r.pile, g = P.g, A = r.isAASHTO, F = (v, d = 2) => (isFinite(v) ? (+v).toFixed(d) : '—');
+  const rowsT = P.rows.map((rw, i) => { const n = 1 / rw.s, xp = rw.x - g.xbar; return `<tr><td>${i + 1}</td><td>${F(rw.x)}</td><td>${F(rw.s)}</td><td>${F(n, 4)}</td><td>${F(xp, 3)}</td><td>${F(n * xp * xp, 4)}</td></tr>`; }).join('');
+  let h = `<div class="sec-heading">Pile-Supported Footing — Rigid Cap on Rows of Vertical Piles</div>`;
+  h += `<div class="card" style="margin-bottom:16px;"><div class="card-hd"><span class="card-title">Pile Step 1 — Pile Group (per ft of wall)</span><span class="card-ref">rigid cap · identical vertical piles · shared/pile-group.js</span></div><div class="card-body">
+    <table class="tbl"><thead><tr><th>Row</th><th>x from toe (ft)</th><th>s along wall (ft)</th><th>n = 1/s (/ft)</th><th>x' = x − x̄ (ft)</th><th>n·x'² (ft²/ft)</th></tr></thead><tbody>${rowsT}</tbody></table>`
+    + eq('1.1 Piles per ft and centroid', `N = \\sum \\frac{1}{s_i} = \\boxed{${F(g.N, 4)}\\ \\text{/ft}}, \\quad \\bar{x} = \\frac{\\sum n_i x_i}{N} = \\boxed{${F(g.xbar, 3)}\\ \\text{ft}}`, 'from the toe')
+    + eq('1.2 Moment of inertia of the group', `I = \\sum n_i (x_i - \\bar{x})^2 = \\boxed{${F(g.I, 4)}\\ \\text{ft}^2\\text{/ft}}`, '')
+    + `<div class="note">${A ? 'AASHTO LRFD 10th Ed.: factored loads per limit state; resistances φ<sub>c</sub>R<sub>n</sub>, φ<sub>up</sub>R<sub>n,up</sub> (Art. 10.5.5.2.3), H<sub>r</sub> as entered; Extreme Event φ = 1.0, uplift 0.80 (Art. 10.5.5.3.3).' : 'ACI 318-19 / IBC 2018: service (ASD) loads, ASCE 7-16 §2.4.1, against the allowable capacities (IBC 2018 §1810.3.3.1, §1810.3.3.2). The soil under the cap carries no vertical load (§1810.3.11).'} Each pile takes H/N of the horizontal load.${P.passive ? ' Passive in front of the toe credited: ' + F(P.Hpass, 3) + ' kip/ft.' : ' No passive or base friction credited.'}</div></div></div>`;
+  const cr = P.comb.map(c => `<tr><td>${c.label}</td><td>${F(c.V, 3)}</td><td>${F(c.xR, 3)}</td><td>${F(c.M, 3)}</td><td>${F(c.H, 3)}</td>${c.L.rows.map(x => `<td>${F(x.P, 2)}</td>`).join('')}<td>${F(c.L.rows[0].h, 2)}</td></tr>`).join('');
+  const gc = P.govC, x0 = gc.L.rows[gc.L.iMax];
+  h += `<div class="card" style="margin-bottom:16px;"><div class="card-hd"><span class="card-title">Pile Step 2 — Pile Reactions and Checks</span><span class="card-ref">${A ? 'AASHTO LRFD 10th Ed. Sec. 10.7' : 'IBC 2018 §1810; ASCE 7-16 §2.4.1'}</span></div><div class="card-body">
+    <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Combination</th><th>V (kip/ft)</th><th>x<sub>R</sub> (ft)</th><th>M about x̄ (kip-ft/ft)</th><th>H (kip/ft)</th>${P.rows.map((x, i) => `<th>P row ${i + 1} (kip)</th>`).join('')}<th>H per pile (kip)</th></tr></thead><tbody>${cr}</tbody></table></div>`
+    + eq('2.1 Governing pile compression (' + gc.label + ')', `M = V(x_R - \\bar{x}) = ${F(gc.V, 3)}(${F(gc.xR, 3)} - ${F(g.xbar, 3)}) = ${F(gc.M, 3)}\\ \\text{kip-ft/ft}; \\quad P = \\frac{V}{N} + \\frac{M\\,x'}{I} = \\frac{${F(gc.V, 3)}}{${F(g.N, 4)}} + \\frac{(${F(gc.M, 3)})(${F(x0.xp, 3)})}{${F(g.I, 4)}} = \\boxed{${F(x0.P, 2)}\\ \\text{kip}}`, 'row ' + (gc.L.iMax + 1))
+    + eqCheck('2.2 Compression', `P_{max} = ${F(gc.L.Pmax, 2)} \\le ${gc.cap.cs} = ${F(gc.cap.c, 2)}\\ \\text{kip} \\quad (D/C = ${F(gc.dcC, 3)})`, r.checks.pileComp.ok, r.checks.pileComp.ref)
+    + eqCheck('2.3 Uplift', P.govT.L.Pmin < 0 ? `-P_{min} = ${F(-P.govT.L.Pmin, 2)} \\le ${P.govT.cap.ts} = ${F(P.govT.cap.t, 2)}\\ \\text{kip} \\quad (${P.govT.label.replace(/[^A-Za-z0-9 .+()]/g, '')})` : `P_{min} = ${F(Math.min(...P.comb.map(c => c.L.Pmin)), 2)}\\ \\text{kip} \\ge 0\\ \\text{(no uplift)}`, r.checks.pileUplift.ok, r.checks.pileUplift.ref)
+    + eqCheck('2.4 Lateral', `h = \\frac{H}{N} = \\frac{${F(P.govH.H, 3)}}{${F(g.N, 4)}} = ${F(P.govH.L.rows[0].h, 2)} \\le ${P.govH.cap.hs} = ${F(P.govH.cap.h, 2)}\\ \\text{kip}`, r.checks.pileLat.ok, r.checks.pileLat.ref)
+    + `<div class="note">Detailing: c-c spacing ${F(P.det.cc, 1)} in${P.det.ccMin ? ' (min. ' + F(P.det.ccMin, 1) + ' in)' : ''}; pile side to footing edge ${F(P.det.edge, 1)} in (min. ${F(P.det.edgeMin, 0)} in); embedment ${F(P.det.embed, 1)} in (min. ${F(P.det.embMin, 0)} in) — ${P.det.ref}.</div></div></div>`;
+  el.insertAdjacentHTML('afterbegin', h);
+  // the soil checks do not apply in pile mode
+  const na = A ? ['Step 4 — Sliding', 'Step 5 — Eccentricity', 'Step 6 — Bearing', 'Step 7a — Extreme Event I'] : ['Step 4 — Overturning', 'Step 5 — Sliding', 'Step 6 — Bearing', 'Step 7 — Factored Bearing'];
+  el.querySelectorAll('.card').forEach(c => { const t = c.querySelector('.card-title'); if (!t) return; const tt = t.textContent;
+    if (na.some(x => tt.startsWith(x)) || (A && /Stability under Collision/.test(tt))) {
+      c.style.opacity = '0.55'; c.querySelector('.card-hd').insertAdjacentHTML('afterend', '<div class="note" style="margin:8px 12px;font-weight:600">Not applicable: pile-supported footing. Shown for information only; the piles carry the wall (Pile Step 2).</div>'); } });
+}
+function renderStabilitySoil(r) {
-  const stab = r.isAASHTO ? [
+  const pc = r.pile && !r.pile.err ? r.pile : null;   // RWPL: pile mode shows the pile checks (demand vs capacity, kip per pile)
+  const stab = pc ? [
+    { label:'Pile Compression', val: pc.govC.L.Pmax, req: pc.govC.cap.c, unit:'kip/pile', ok: r.checks.pileComp.ok, invert:true },
+    { label:'Pile Uplift',      val: Math.max(0, -pc.govT.L.Pmin), req: pc.govT.cap.t, unit:'kip/pile', ok: r.checks.pileUplift.ok, invert:true },
+    { label:'Pile Lateral',     val: pc.govH.L.rows[0].h, req: pc.govH.cap.h, unit:'kip/pile', ok: r.checks.pileLat.ok, invert:true },
+  ] : r.isAASHTO ? [
-      <div class="sc-group"><h3>Stability <span>${r.isAASHTO ? 'Strength limit states' : 'Service, ASD'}</span></h3>${stab.map(row).join('')}${scale}</div>
+      <div class="sc-group"><h3>${pc ? 'Piles' : 'Stability'} <span>${r.isAASHTO ? (pc ? 'Factored, per limit state' : 'Strength limit states') : 'Service, ASD'}</span></h3>${stab.map(row).join('')}${scale}</div>
-    try { if (D[k]) v = D[k](); } catch (e) { /* value not available: D/C n/a */ }
+    try { if (D[k]) v = D[k](); else if (c.ref !== undefined) v = [c.ref, c.dc, c.note || '']; } catch (e) { /* value not available: D/C n/a */ }   // RWPL: the pile checks carry their own reference and D/C
+  /* ---------- RWPL (2026-11-07, Phase 8c): pile-supported footing (after the stability section) ---------- */
+  if (r.pile && !r.pile.err) {
+    const P = r.pile, G = P.g, subs = [], N = (v, d) => rwrN(v, d);
+    subs.push(sub('Pile data', [{ type: 'table', head: ['Quantity', 'Value', 'Unit'], rows: [
+      ['Pile type', ({ hp: 'steel H-pile', pipe: 'steel pipe pile', square: 'square precast concrete', round: 'round (timber / cast-in-place)' }[P.shape] || P.shape) + (P.desig ? ', ' + P.desig : ''), '–'],
+      ['Pile width / diameter D', rwrCell(P.D, 1), 'in'], ['Embedment into the footing', rwrCell(P.embed, 1), 'in'], ['Clear, pile top to the bottom bars', rwrCell(P.clr, 2), 'in'],
+      ...P.rows.map((rw, i) => ['Row ' + (i + 1) + ': x from the toe / spacing along the wall', N(rw.x, 2) + ' / ' + N(rw.s, 2), 'ft']),
+      ...(isA ? [['Nominal compression R_n, φ_c', N(inp.fnd.Rn, 1) + ', ' + N(inp.fnd.phic, 2), 'kip, –'], ['Nominal uplift R_n,up, φ_up', N(inp.fnd.Rnup, 1) + ', ' + N(inp.fnd.phiup, 2), 'kip, –'], ['Factored lateral resistance H_r', rwrCell(inp.fnd.Hr, 1), 'kip']]
+             : [['Allowable compression P_a', rwrCell(inp.fnd.Pa, 1), 'kip'], ['Allowable uplift T_a', rwrCell(inp.fnd.Ta, 1), 'kip'], ['Allowable lateral H_a', rwrCell(inp.fnd.Ha, 1), 'kip']]),
+      ['Passive in front of the toe', P.passive ? 'credited against H: ' + N(P.Hpass, 3) + ' kip/ft' : 'not credited (no passive, no base friction)', '–']] },
+      { type: 'note', text: isA ? 'AASHTO LRFD 10th Ed.: rigid cap on vertical piles; factored loads per limit state; φ_c R_n, φ_up R_n,up (Art. 10.5.5.2.3); Extreme Event φ = 1.0, uplift φ = 0.80 (Art. 10.5.5.3.3); H_r as entered. Soil bearing, base sliding and overturning are not checked.'
+                                : 'IBC 2018 §1810: service (ASD) combinations of ASCE 7-16 §2.4.1 against the allowable capacities (§1810.3.3.1, §1810.3.3.2); the soil under the cap carries no vertical load (§1810.3.11). Soil bearing, base sliding and overturning are not checked.' }]));
+    const st = [rwrS({ id: 'N', label: 'Piles per ft of wall', sym: 'N', eq: '\\sum \\frac{1}{s_i}', sub: P.rows.map(rw => '\\frac{1}{' + N(rw.s, 2) + '}').join(' + '), value: G.N, unit: '/ft', d: 4 }),
+      rwrS({ id: 'xbar', label: 'Pile-group centroid from the toe', sym: '\\bar{x}', eq: '\\frac{\\sum x_i / s_i}{N}', sub: '\\frac{' + P.rows.map(rw => N(rw.x, 2) + '/' + N(rw.s, 2)).join(' + ') + '}{' + N(G.N, 4) + '}', value: G.xbar, unit: 'ft', d: 3 }),
+      rwrS({ id: 'I', label: 'Moment of inertia of the group per ft', sym: 'I', eq: '\\sum \\frac{(x_i \\minus \\bar{x})^2}{s_i}', sub: P.rows.map(rw => '\\frac{(' + N(rw.x - G.xbar, 3) + ')^2}{' + N(rw.s, 2) + '}').join(' + '), value: G.I, unit: 'ft^{2}/ft', d: 4 })];
+    subs.push(sub('Pile Step 1 — Pile group (per ft of wall)', [rwrItem('pl1', [{ title: 'Group properties', steps: st }])]));
+    const head = ['Combination', 'V (kip/ft)', 'x_R (ft)', 'M (kip-ft/ft)', 'H (kip/ft)', ...P.rows.map((x, i) => 'P row ' + (i + 1) + ' (kip)'), 'h (kip)'];
+    const rows = P.comb.map(c => [c.label, rwrCell(c.V, 3), rwrCell(c.xR, 3), rwrCell(c.M, 3), rwrCell(c.H, 3), ...c.L.rows.map(x => rwrCell(x.P, 2)), rwrCell(c.L.rows[0].h, 2)]);
+    const gc = P.govC, x0 = gc.L.rows[gc.L.iMax], gt = P.govT, gh = P.govH;
+    const ck = [rwrS({ id: 'M', label: 'Moment about the group centroid, ' + gc.label, sym: 'M', eq: 'V(x_R \\minus \\bar{x})', sub: N(gc.V, 3) + '(' + N(gc.xR, 3) + ' \\minus ' + N(G.xbar, 3) + ')', value: gc.M, unit: 'kip-ft/ft', d: 3 }),
+      rwrS({ id: 'Pmax', label: 'Largest pile load (row ' + (gc.L.iMax + 1) + ')', sym: 'P_{max}', eq: '\\frac{V}{N} + \\frac{M\\,(x_i \\minus \\bar{x})}{I}', sub: '\\frac{' + N(gc.V, 3) + '}{' + N(G.N, 4) + '} + \\frac{(' + N(gc.M, 3) + ')(' + N(x0.xp, 3) + ')}{' + N(G.I, 4) + '}', value: x0.P, unit: 'kip', d: 2 }),
+      rwrS({ id: 'comp', label: 'Compression check', sym: '\\frac{P_{max}}{' + gc.cap.cs + '}', eq: '', sub: '\\frac{' + N(gc.L.Pmax, 2) + '}{' + N(gc.cap.c, 2) + '}', value: P.govC.dcC, unit: '', d: 3, ok: ok('pileComp') }),
+      gt.L.Pmin < 0 ? rwrS({ id: 'upl', label: 'Uplift check (' + gt.label + ')', sym: '\\frac{\\minus P_{min}}{' + gt.cap.ts + '}', eq: '', sub: '\\frac{' + N(-gt.L.Pmin, 2) + '}{' + N(gt.cap.t, 2) + '}', value: gt.dcT, unit: '', d: 3, ok: ok('pileUplift') })
+                    : rwrS({ id: 'upl', label: 'Uplift: the smallest pile load of all combinations is not negative', sym: 'P_{min}', eq: '', sub: '', value: Math.min(...P.comb.map(c => c.L.Pmin)), unit: 'kip', d: 2, ok: ok('pileUplift') }),
+      rwrS({ id: 'lat', label: 'Lateral load per pile (' + gh.label + ')', sym: 'h', eq: '\\frac{H}{N}', sub: '\\frac{' + N(gh.H, 3) + '}{' + N(G.N, 4) + '}', value: gh.L.rows[0].h, unit: 'kip', d: 2 }),
+      rwrS({ id: 'latdc', label: 'Lateral check', sym: '\\frac{h}{' + gh.cap.hs + '}', eq: '', sub: '\\frac{' + N(gh.L.rows[0].h, 2) + '}{' + N(gh.cap.h, 2) + '}', value: gh.dcH, unit: '', d: 3, ok: ok('pileLat') })];
+    const d = P.det, dt = [['Center-to-center spacing (along the wall and row to row)', N(d.cc, 1) + ' in', d.ccMin ? '≥ ' + N(d.ccMin, 1) + ' in' : 'no minimum (group effects: §1810.2.5)'],
+      ['Pile side to the footing edge (toe / heel)', N(d.edge, 1) + ' in', '≥ ' + N(d.edgeMin, 0) + ' in'], ['Embedment into the footing', N(d.embed, 1) + ' in', '≥ ' + N(d.embMin, 0) + ' in']];
+    subs.push(sub('Pile Step 2 — Pile reactions and checks', [{ type: 'table', head, rows }, rwrItem('pl2', [{ title: 'Governing pile loads', ref: isA ? AA('Sec. 10.7') : 'IBC 2018 §1810', steps: ck }]),
+      { type: 'table', head: ['Detailing', 'Provided', 'Required (' + d.ref + ')'], rows: dt }, onTab('stabPile')]));
+    CK.pileComp = 'pl2/comp'; CK.pileUplift = 'pl2/upl'; CK.pileLat = 'pl2/latdc';
+    const iS = secs.findIndex(x => x.key === 'stab');
+    secs.splice(iS + 1, 0, { title: 'Pile-supported footing', subs, key: 'pile' });
+    if (iS >= 0) secs[iS].subs.unshift(sub('Pile-supported footing: soil checks not applicable', [{ type: 'note', text: 'The footing is on piles. The overturning, sliding, eccentricity and soil-bearing steps of this section are shown for information only and are not checks; the piles carry the wall (next section). The earth pressures and the factored loads of this section are used.' }]));
+  }
```

## 2026-11-07 — PR: claude/rw-audit-bookkeeping — Calculation audit item 10: bookkeeping (EH vertical 0.90 labelled as the engineer's choice; O4 and O5 closed; AUDIT.md §3.9 updated; two ACI citations in comments corrected) (RWBK; no result change) (PR #963: https://github.com/mlococo88/All-Structural/pull/963)

Calculation audit, item 10. Engineer answers (2026-11-07). Code sites are tagged `RWBK`. No computed value changes.

### RWBK-1. EH vertical minimum 0.90 kept (engineer's choice)
- **Where:** `calcAll`, AASHTO block, anchor `const gEH_min = 0.90;` (comment added); `renderStabilityAASHTO` Step 3, anchor `{sym:'V_{EH,v}', desc:'vertical component of the earth thrust`; `rwrModel`, Report step `VEHv` (label).
- **Before:** the comment and labels said only "factored as EH (γ_EH max/min), not EV".
- **After:** they add that the 0.90 minimum in sliding and eccentricity is the engineer's choice, more conservative than AASHTO LRFD 10th Ed. Fig. C11.5.6-2, which shows the EH maximum factor on both components of the thrust there.
- **Check case:** Rankine β 20° (AASHTO): sliding D/C 1.938 stays (with 1.50 on the vertical it would be 1.810). No result change.

### RWBK-2. Comments citing the wrong ACI table (comments only)
- `devLengthACIRaw`, anchor `const psi_s = db <= 0.75 ? 0.8 : 1.0;`: the comment cited "ACI Table 25.5.2.1" (the lap table); now ACI 318-19 Table 25.4.2.5.
- `asMin`, anchor `if (!isAASHTO) return 0.0018 * bw * h;`: the comment cited "Table 24.4.3.2"; in ACI 318-19, §24.4.3.2 is a paragraph (0.0018, all grades), so it now reads §7.6.1.1 / §24.4.3.2.

### RWBK-3. Open items O4 and O5 closed (decisions 2026-11-07)
- **O4 (N1). AASHTO φ_τ default 1.00:** kept. AASHTO LRFD 10th Ed. Table 11.5.7-1 (semi-gravity walls) gives 1.0 for sliding; the shallow-foundation values of Table 10.5.5.2.2-1 (0.80 CIP on sand) are not used for walls. Closed; no change.
- **O5 (N2). Collision factors:** γp = 1.00 for DC/EV in Extreme Event II is AASHTO LRFD 10th Ed. Table 3.4.1-1 (γp = 1.00 in EE I/II), not a MassDOT value; γ_EH = 0 for stability, the full-joint distribution, the test-level forces (Table 3.3.2-1) and the 0.75 variable-height rule are MassDOT Bridge Manual 3.3.2.4 / 3.3.2.2 (verified in the audit). Water, ES and the vertical earth thrust in EE II were settled in #944 (RWCT) and #956 (RWCV). Closed.
- `ENGINEER_CHECKS.md`, Retaining Wall line: φτ and collision values removed (closed).

### RWBK-4. AUDIT.md
- §3.9 Retaining Wall table: every row marked with the fix that resolved it (F1/F14 SI toggle; F2 thrust at δ; F3 K_p; F4 EH vertical, 0.90 kept by the engineer; F5 Strength Ia / 0.9D; F17 q_n; F9 A_s,min; F8 ψ_g / c_b; F6 M-O; F7 key; O5 collision; F10 cohesion), plus a status line naming O4/O5 closed and the audit PRs.
- §8 plan: A28 and A29 marked done (PR #9).

### How verified
- `_R`, Export JSON and localStorage identical main vs branch on the twelve audit walls; the tab and Report text differ only by the RWBK-1 labels.
- Tests: check-syntax; smoke/retaining-wall-checks; phone-layout rwall 390/768; project-library retwall; dxf-print-sheets rw.

### Saved data
- No change.

## 2026-11-07 — PR: claude/rw-pile-8d-footing — Pile-supported footing, Phase 8d: heel and toe designed from the factored pile-row reactions, bottom cover over the pile heads, punching around the piles, ACI cap depth (RWPL; calculation change in pile mode only) (PR #961: https://github.com/mlococo88/All-Structural/pull/961)

Review Phase 8, PR 8d. Code sites are tagged `RWPL`. Spread-footing results are unchanged: `cov_bot` = c_c, and the pile paths run only when `pile` exists.

### RWPL-7. `calcAll` — the footing on piles   [§4]
- **Order:** the pile analysis (8c) is now computed before the footing design (anchor `// RWPL (2026-11-07): the pile analysis (8c), computed here`). It was in the checks block; the values are the same.
- **`pileFtg`:** the factored pile-row reactions of the two footing sets, as the bearing trapezoids use them.
  - ACI:
    - U = 1.2D + 1.6H (+1.0E): ΣV_u at x̄_u.
    - U = 0.9D + 1.6H: ΣV_u,min at x̄_u,min.
  - AASHTO:
    - Strength I max: V_str,max,tot at x_R,tot.
    - Strength Ia: V_str,min,tot at B/2 − e_Ia.
  - Formulas: P_i = V/N + M x'_i/I, with line loads q_i = P_i/s_i (shared/pile-group.js).
- **`heelCase(…, pc)`:** the rows behind the stem back face (by the pile centre) give
  - M_up = Σq_i a_i, with a_i = x_i − x_back;
  - V_u,A = |w_u L_h + wedge − Σq_i|.
  - The downward load, the wedge, the no-relief case B, MassDOT §3.3.2.2 and the heel-basis choice are as before.
- **`toeCase(…, pc)`:** the rows in front of the front face give
  - M_u = Σq_i a_i − w_sw L_t²/2, with a_i = x_front − x_i;
  - V_u = Σq_i − w_sw L_t (at the face, as before).
  - The envelope of the two sets is as before.
- **`cov_bot`:** on piles, the bottom cover is max(c_c, embedment + clear). It is used for:
  - d_toe;
  - the toe ℓ_d cover;
  - the toe crack control (ACI §24.3.2 / AASHTO Art. 5.6.7);
  - the stem-hook length available (t_f − cov_bot; the hook bears on the bottom mat above the pile heads).
- **`pilePunch`:** two-way shear at each pile row.
  - Critical section at d/2 (ACI 318-19 §22.6.4.1) or d_v/2 (AASHTO Art. 5.12.8.6.1, verified) from the pile face. The pile is taken as the square of equal area (round / pipe: 0.886D).
  - The section side is a = D_eq + d.
  - b_o:
    - interior: 4a;
    - cut by the toe or heel edge (e < a/2): a + 2(e + a/2);
    - neighbouring piles of the row overlapping (s ≤ a): the sides across the wall drop out.
  - Depth over the pile heads: d_p = t_f − cov_bot − d_b. This is the abutment's C-13 rule.
  - ACI 318-19 Table 22.6.5.2: v_c = min(4, 2 + 4/β, 2 + α_s d/b_o)λ_sλ√f'c, with:
    - λ_s = √(2/(1 + d/10)) ≤ 1;
    - β = 1;
    - α_s = 40 (interior) or 30 (edge / strip);
    - φ = 0.75.
  - AASHTO Art. 5.12.8.6.3 (verified): V_n = (0.063 + 0.126/β_c)λ√f'c b_o d_v ≤ 0.126λ√f'c b_o d_v (ksi), with β_c = 1, d_v = max(0.9d_p, 0.72t_f) and φ_v = 0.90.
  - Demand P_u = the larger factored reaction of the row in the two footing sets, with no deduction for the cap weight inside the perimeter.
- **New checks** (pile mode): `pilePunch` (both modes) and `pileCapD` (ACI: d_p ≥ 12 in, ACI 318-19 §13.3.1.2).
- **Warnings:**
  - The 8c note "heel and toe still from soil" is replaced by "designed from the factored pile reactions".
  - New: with cov_bot > 6 in, the toe crack-control check uses that cover and fails for large covers. The remedy is a bar mat below the pile heads, or the engineer's judgement.
- **Returned (pile mode only, with `pile`):** `pileFtg`, `cov_bot`, `pilePunch`, `heelPile`, `toePile`. A spread footing's results have none of them; the displays use `r.cov_bot ?? c_c`.
- **RWUP (#960) on piles:** the water-uplift split (`upS`) requires `!isPile`. On piles the factored vertical load, water included, goes to the pile rows. `heelCase` / `toeCase` take `(…, up, pc)`, and the pile path runs first.
### RWPL-8. Display / Report
- Footing tab:
  - Heel Step 1 / Toe Step 1: the pile-row line loads instead of the bearing pressures (link to Pile Step 2).
  - Heel Step 2: M_up = Σq_i a_i.
  - Toe Step 2: M_u = Σq_i a_i − w_sw L_t²/2 and V_u = Σq_i − w_sw L_t.
  - Toe Step 3: d with cov_bot.
  - New card "Pile Cap — Punching around the Piles" (`RW_CARDS.ftgPunch`).
  - "Factored loads on footing" plot: the pile rows drawn as spikes in place of the bearing trapezoid.
  - The heel / toe shear and moment plots and SVG diagrams use the pile rows.
- Report, footing section: the heel / toe steps above, the toe d with cov_bot, and the new sub "Pile cap — punching around the piles" (summary links ppn/dc and ppn/cap).
### Check case: default wall, t_f 36 in, 2 rows at 1.5 / 11.0 ft, s 6 ft, ACI
- Group: N = 1/3, x̄ = 6.25, I = 7.5208.
- **U = 1.2D + 1.6H:**
  - ΣV_u = 23274 lb/ft at x̄_u = 5.7361 ft, so M = 23274(5.7361 − 6.25) = −11961.
  - P_toe = 69822 + 11961(4.75)/7.5208 = **77376 lb**, so q_toe = 77376/6 = 12896 lb/ft.
- **Toe:**
  - w_sw = 0.9(150)(3.0) = 405 psf.
  - M_u = 12896(1.5) − 405(3²)/2 = **17521.6 lb-ft/ft**.
  - V_u = 12896 − 405(3) = **11681 lb/ft** > φV_c 11584 (D/C 1.008, toe shear FAIL, section at the face).
  - d = 36 − 15 − 0.375 = 20.625 in.
  - Before (the bearing trapezoid of the same wall on soil): M_u from q_u,front / q_u,toe.
- **Heel:** U = 0.9D + 1.6H governs.
  - w_u = 0.9(1440 + 450) = 1701 psf.
  - M_down = 1701(8²)/2 = 54432.
  - M_up = 6836.1(6.5) = 44434.6.
  - M_u = **9997.4 lb-ft/ft**.
- **Punching:**
  - d_p = 36 − 15 − 0.75 = 20.25 in; a = 12 + 20.25 = 32.25 in; b_o = 4a = 129 in (interior: e = 18 in > a/2).
  - λ_s = √(2/3.025) = 0.813.
  - v_c = min(4, 6, 2 + 40(20.25)/129 = 8.28)(0.813)√4000 = 205.7 psi.
  - φV_c = 0.75(205.7)(129)(20.25) = **403.0 kip** ≥ P_u 77.38 kip (D/C 0.19).
- Cap depth: d_p = 20.25 ≥ 12 in.
### How verified
- origin/main vs branch, headless Chromium, the 12 walls in spread mode: identical (pile fields aside).
- Pile mode: the case above in ACI and AASHTO; no console errors; screenshots of the Footing tab.
- `tests/smoke/retaining-wall-checks.mjs`: + two 8d cases (the numbers above; AASHTO φV_n formula).
- Also run: `node tests/check-syntax.mjs`; phone layout rwall 390/768; project library retwall; DXF sheets rw.
### Other copies
- Two-way shear around piles: `abutment_calculator.html` C-13 (its own perimeter rules). It is a candidate for `shared/pile-group.js` with the abutment move (PR 8h).
### Open items / decisions (pending engineer review)
- **Decision (pending engineer review):** one-way shear stays at the stem face, with every pile row in front of or behind the face counted in full. This is conservative. ACI's partial count of piles near the critical section (and d from the face) is not applied.
- **Decision (pending engineer review):** a pile row is assigned to the heel or the toe by its centre. A row under the stem is carried by neither cantilever.
- **Decision (pending engineer review):** round and pipe piles are punched as the square of equal area. b_o is cut by the toe / heel edges and by the overlapping neighbours along the wall. Corner piles at the wall ends are not modelled (per ft of wall). No cap weight is deducted inside the perimeter.
- **Decision (pending engineer review):** the bottom cover on piles is max(c_c, embedment + clear) for the toe d, ℓ_d, crack control and the stem hook. Crack control then fails for typical caps (warning).
- **Decision (pending engineer review):** the ACI 318-19 Table 22.6.5.2 and §13.3.1.2 citations are from the standard; the ACI PDF text was not readable in this session. AASHTO 5.12.8.6.1 / 5.12.8.6.3 were verified.
- **Decision (pending engineer review):** the heel bottom bars when piles lift the heel (M_u < 0) follow the existing heel logic (bars for |M_u|, the face shown on the tab). The Drawings still draw F1 at the top. This is to be detailed in 8e.
- Next steps: 8e (Drawings loads sheet with the pile reactions, bottom mat above the pile heads in the sheets, pile schedule), 8f (Pile Designer hand-off).

### Before / after (code, `git diff -U0` of `Retaining Wall Designer.html` against main after 8c)
```diff
+  ftgPunch:    ['footing', 'Pile Cap — Punching around the Piles', 'Pile Cap — Punching around the Piles'],   // RWPL 8d
-const RW_CHECK_CARD = { pileComp:'stabPile', pileUplift:'stabPile', pileLat:'stabPile', pileSpacing:'stabPile', pileEdge:'stabPile', pileEmbed:'stabPile', ot:'stabOT', otE:'stabOT', sliding:'stabSlide', slidingE:'stabSlide', bearing:'stabBrg', ecc:'stabEcc',
+const RW_CHECK_CARD = { pilePunch:'ftgPunch', pileCapD:'ftgPunch', pileComp:'stabPile', pileUplift:'stabPile', pileLat:'stabPile', pileSpacing:'stabPile', pileEdge:'stabPile', pileEmbed:'stabPile', ot:'stabOT', otE:'stabOT', sliding:'stabSlide', slidingE:'stabSlide', bearing:'stabBrg', ecc:'stabEcc',
+  // RWPL (2026-11-07, Phase 8d): on piles the bottom mat sits on the pile heads: bottom cover = max(c_c, embedment + clear)
+  const cov_bot = (inp.fnd && inp.fnd.type === 'pile') ? Math.max(inp.cov_ftg, (+inp.fnd.embed || 0) + (+inp.fnd.clr || 0)) : inp.cov_ftg;
-  const ldh_avail  = inp.tf - inp.cov_ftg;                     // hook bears on the bottom mat
+  const ldh_avail  = inp.tf - cov_bot;                         // hook bears on the bottom mat (RWPL: on piles, above the pile heads)
+  // RWPL (2026-11-07): the pile analysis (8c), computed here so the footing design (8d) can use it
+  const isPile = !!(inp.fnd && inp.fnd.type === 'pile');
+  const pile = isPile ? rwPileAnalysis({ fnd: inp.fnd, isAASHTO, aashtoR, B, phi_ep: inp.aashto.phi_ep, Pp_toe,
+    SumV, Ms, Ms_Pp, Mo_st, Mo_seis, Fh, Pe_inc, hasSeismic, Wftg, Wstem, Wsoil, W_bar, pDL, pWL, x_col, Pa_tri_v, F_uplift,
+    Ms_ftg, Ms_stem, Ms_soil, Ms_bar, Ms_Pv, Ms_uplift }) : null;
+  /* RWPL (2026-11-07, Phase 8d): pile-supported footing — the heel and toe take the factored pile-row reactions (line loads
+     q_i = P_i / s_i per ft, rigid cap, shared/pile-group.js) in place of the factored bearing trapezoid. The same two factored sets:
+     ACI U = 1.2D + 1.6H (+1.0E) and U = 0.9D + 1.6H (ΣV_u, x̄_u as the bearing trapezoid); AASHTO Strength I max and Ia min (total
+     vertical, as the footing-design trapezoid: V_str,max,tot at x_R,tot; V_str,min,tot at B/2 − e_Ia). Rows behind the stem back face
+     load the heel, rows in front of the front face load the toe (by the pile centre); a row under the stem loads neither. */
+  const pileFtg = (pile && !pile.err) ? (() => {
+    const SPG = window.SharedPileGroup, g = pile.g;
+    const mk = (key, label, V, xR) => { const M = SPG.momentAbout(V, xR, g.xbar), L = SPG.rowLoads(g, V, M, 0);
+      return { key, label, V, xR, M, L, rows: L.rows.map(rw => ({ x: rw.x, s: rw.s, P: rw.P, q: rw.q })) }; };   // lb/ft, ft; P in lb per pile, q lb/ft
+    const cmax = isAASHTO ? mk('str_max', 'Strength I (maximum)', aashtoR.V_str_max_tot, aashtoR.x_R_tot) : mk('u12', 'U = 1.2D + 1.6H' + (hasSeismic ? ' + 1.0E' : ''), SumVu, x_Ru);
+    const cmin = isAASHTO ? mk('str_min', 'Strength I (minimum, Ia)', aashtoR.V_str_min_tot, B / 2 - aashtoR.e_Ia) : mk('u09', 'U = 0.9D + 1.6H', SumVu_min, x_Ru_min);
+    return { cmax, cmin };
+  })() : null;
-  const upS = (!isAASHTO && F_uplift > 0) ? { gToe: 1.6, gHeel: 0.9 } : null;
+  const upS = (!isAASHTO && F_uplift > 0 && !isPile) ?   // RWPL: on piles the factored vertical load (water included) goes to the pile rows; no split
+    { gToe: 1.6, gHeel: 0.9 } : null;
-  function heelCase(gEVc, gDCc, gESc, gLSc, q0, qL, up) {   // up: RWUP split (soil + water) for this combination, or null
+  function heelCase(gEVc, gDCc, gESc, gLSc, q0, qL, up, pc) {   // up: RWUP split (soil + water) for this combination, or null; pc: RWPL pile rows
+    if (pc) {   // RWPL: pile rows behind the back face, line loads q_i at a_i = x_i − x_back
+      const hr = pc.rows.filter(rw => rw.x > x_back + 1e-9).map(rw => ({ x: rw.x, q: rw.q, a: rw.x - x_back }));
+      const Mup = hr.reduce((t, rw) => t + rw.q * rw.a, 0), Vup = hr.reduce((t, rw) => t + rw.q, 0);
+      return { wu, Md, Mup, q0: NaN, qL: NaN, up: null, g: [gEVc, gDCc, gESc, gLSc], pile: { key: pc.key, label: pc.label, rows: hr, Vup },
+               Mstd: Md - Mup, Vstd: Math.abs(wu * inp.Lh + gEVc * V_wedge_heel - Vup), Vnr: wu * inp.Lh + gEVc * V_wedge_heel };
+    }
-  const hcMax = heelCase(gEV, gDC, gES, gLS, bq_back, bq_heel, upS ? upS.heelMax : null);   // RWUP
-  const hcMin = isAASHTO ? heelCase(1.00, 0.90, 0.75, 0, bqm_back, bqm_heel)
-                         : heelCase(0.9, 0.9, 0, 0, bqm_back, bqm_heel, upS ? upS.heelMin : null);
+  const hcMax = heelCase(gEV, gDC, gES, gLS, bq_back, bq_heel, upS ? upS.heelMax : null, pileFtg && pileFtg.cmax);   // RWUP, RWPL
+  const hcMin = isAASHTO ? heelCase(1.00, 0.90, 0.75, 0, bqm_back, bqm_heel, null, pileFtg && pileFtg.cmin)
+                         : heelCase(0.9, 0.9, 0, 0, bqm_back, bqm_heel, upS ? upS.heelMin : null, pileFtg && pileFtg.cmin);
-  function toeCase(q0, qL, up) {   // up: RWUP split (soil + water) for this combination, or null
+  function toeCase(q0, qL, up, pc) {   // up: RWUP split (soil + water) for this combination, or null; pc: RWPL pile rows
+    if (pc) {   // RWPL: pile rows in front of the front face, line loads q_i at a_i = x_front − x_i, less the footing weight
+      const tr = pc.rows.filter(rw => rw.x < x_front - 1e-9).map(rw => ({ x: rw.x, q: rw.q, a: x_front - rw.x }));
+      const Mup = tr.reduce((t, rw) => t + rw.q * rw.a, 0), Vup = tr.reduce((t, rw) => t + rw.q, 0);
+      return { q0: NaN, qL: NaN, n0: NaN, nL: NaN, pile: { key: pc.key, label: pc.label, rows: tr, Vup, Mup },
+               M: Mup - wu_toe_down * inp.Lt ** 2 / 2, V: Math.max(0, Vup - wu_toe_down * inp.Lt) };
+    }
-  const tcMax = toeCase(bq_front, bq_toe, upS ? upS.toeMax : null), tcMin = toeCase(bqm_front, bqm_toe, upS ? upS.toeMin : null);   // RWUP
+  const tcMax = toeCase(bq_front, bq_toe, upS ? upS.toeMax : null, pileFtg && pileFtg.cmax), tcMin = toeCase(bqm_front, bqm_toe, upS ? upS.toeMin : null, pileFtg && pileFtg.cmin);   // RWUP, RWPL
-  let d_toe = inp.tf - inp.cov_ftg - 0.375;   // pass 1 assumption (#6)
+  let d_toe = inp.tf - cov_bot - 0.375;   // pass 1 assumption (#6); RWPL: cov_bot = c_c for a spread footing
-    d_toe = inp.tf - inp.cov_ftg - sel_toe.bar.db / 2;
+    d_toe = inp.tf - cov_bot - sel_toe.bar.db / 2;
-    ? devLengthAASHTO(sel_toe.bar.db, inp.fy, inp.fc, false, inp.cov_ftg + sel_toe.bar.db / 2, sel_toe.spacing)
-    : devLength(sel_toe.bar.db, inp.fy, inp.fc, 1.0, 1.0, inp.cov_ftg + sel_toe.bar.db / 2, 1.0, sel_toe.spacing);
+    ? devLengthAASHTO(sel_toe.bar.db, inp.fy, inp.fc, false, cov_bot + sel_toe.bar.db / 2, sel_toe.spacing)
+    : devLength(sel_toe.bar.db, inp.fy, inp.fc, 1.0, 1.0, cov_bot + sel_toe.bar.db / 2, 1.0, sel_toe.spacing);
+  // ── RWPL (2026-11-07, Phase 8d): two-way (punching) shear around each pile row ──
+  // Critical section at d/2 (ACI 318-19 §22.6.4.1) / d_v/2 (AASHTO Art. 5.12.8.6.1) from the pile face, the pile taken as the square
+  // of equal area (round / pipe: side 0.886D). b_o is cut by the toe or heel edge when the section would pass it (three sides, the two
+  // side legs running to the edge), and by the neighbouring piles of the row when s ≤ a (the sides across the wall drop out: the row
+  // then acts as a strip). Depth over the pile heads d_p = t_f − cover_bot − d_b (the abutment calculator's C-13 rule).
+  // ACI 318-19 Table 22.6.5.2: v_c = min(4, 2 + 4/β, 2 + α_s d/b_o)·λ_s·λ·√f'c, λ_s = √(2/(1 + d/10)) ≤ 1, β = 1, α_s 40 / 30 (edge), φ 0.75.
+  // AASHTO Art. 5.12.8.6.3: V_n = (0.063 + 0.126/β_c)λ√f'c b_o d_v ≤ 0.126λ√f'c b_o d_v (ksi), β_c = 1, φ_v 0.90 (Art. 5.5.4.2).
+  let pilePunch = null;
+  if (pileFtg) {
+    const Pf = inp.fnd, Deq = (Pf.shape === 'pipe' || Pf.shape === 'round') ? 0.886 * Pf.D : Pf.D;
+    const dp = inp.tf - cov_bot - sel_toe.bar.db, dvp = isAASHTO ? Math.max(0.9 * dp, 0.72 * inp.tf) : dp, dc = isAASHTO ? dvp : dp;
+    const a = Deq + dc, phiP = isAASHTO ? 0.90 : 0.75;
+    const rows = pile.rows.map((rw, i) => {
+      const S = rw.s * 12, ex = Math.min(rw.x, B - rw.x) * 12, cut = ex < a / 2, strip = S <= a;
+      const Lpar = Math.min(a, S), Lperp = cut ? ex + a / 2 : a;
+      const bo = (cut ? 1 : 2) * Lpar + (strip ? 0 : 2 * Lperp);
+      const loc = strip ? 'strip (perimeters of the row overlap)' : cut ? 'edge (cut by the ' + (rw.x * 12 < (B - rw.x) * 12 ? 'toe' : 'heel') + ' edge)' : 'interior';
+      let Vc, vc = null, lam_s = null, alpha = cut || strip ? 30 : 40, gov = '';
+      if (!isAASHTO) {
+        lam_s = Math.min(1, Math.sqrt(2 / (1 + dp / 10)));
+        const sq = Math.sqrt(inp.fc), c1 = 4, c2 = 2 + 4 / 1, c3 = 2 + alpha * dp / bo, cm = Math.min(c1, c2, c3);
+        vc = cm * lam_s * sq; Vc = vc * bo * dp; gov = cm === c3 ? '2 + α_s d/b_o' : '4';
+      } else {
+        const sq = Math.sqrt(inp.fc / 1000), k = Math.min(0.063 + 0.126 / 1, 0.126);
+        Vc = k * sq * bo * dvp * 1000; vc = k * sq * 1000;
+      }
+      const phiVc = phiP * Vc;
+      return { i, x: rw.x, s: rw.s, S, ex, cut, strip, a, Lpar, Lperp, bo, loc, Pu: Math.max(pileFtg.cmax.rows[i].P, pileFtg.cmin.rows[i].P, 0), Vc, vc, lam_s, alpha, gov, phiVc,
+        dc: Math.max(pileFtg.cmax.rows[i].P, pileFtg.cmin.rows[i].P, 0) / Math.max(phiVc, 1e-9) };
+    });
+    const g = rows.reduce((b, x) => (!b || x.dc > b.dc) ? x : b, null);
+    pilePunch = { Deq, dp, dvp, dc, a, phi: phiP, rows, gov: g, ok: g.dc <= 1 + 1e-9 };
+  }
-  const ldA_toe    = isAASHTO ? devLengthAASHTOParts(sel_toe.bar.db, inp.fy, inp.fc, false, inp.cov_ftg + sel_toe.bar.db / 2, sel_toe.spacing) : null;
+  const ldA_toe    = isAASHTO ? devLengthAASHTOParts(sel_toe.bar.db, inp.fy, inp.fc, false, cov_bot + sel_toe.bar.db / 2, sel_toe.spacing) : null;
-    toe:  aciCrack(inp.cov_ftg,  sel_toe.spacing),
+    toe:  aciCrack(cov_bot,  sel_toe.spacing),
-        crack: crackSpacing(d_toe, sel_toe.bar.db, inp.cov_ftg, inp.tf,
+        crack: crackSpacing(d_toe, sel_toe.bar.db, cov_bot, inp.tf,
-  const isPile = !!(inp.fnd && inp.fnd.type === 'pile');
-  const pile = isPile ? rwPileAnalysis({ fnd: inp.fnd, isAASHTO, aashtoR, B, phi_ep: inp.aashto.phi_ep, Pp_toe,
-    SumV, Ms, Ms_Pp, Mo_st, Mo_seis, Fh, Pe_inc, hasSeismic, Wftg, Wstem, Wsoil, W_bar, pDL, pWL, x_col, Pa_tri_v, F_uplift,
-    Ms_ftg, Ms_stem, Ms_soil, Ms_bar, Ms_Pv, Ms_uplift }) : null;
+        ...(pilePunch ? { pilePunch: { ok: pilePunch.ok, label: 'Pile Punching', val: `${f(pilePunch.gov.Pu/1000,1)}${pilePunch.ok ? '≤' : '>'}${f(pilePunch.gov.phiVc/1000,1)}k`, dc: pilePunch.gov.dc,
+                      ref: (isAASHTO ? 'AASHTO LRFD 10th Ed. Art. 5.12.8.6.3, φ 0.90' : 'ACI 318-19 Table 22.6.5.2, φ 0.75') + '; row ' + (pilePunch.gov.i + 1) + ', ' + pilePunch.gov.loc + ', b<sub>o</sub> = ' + f(pilePunch.gov.bo,1) + ' in' } } : {}),
+        ...(pilePunch && !isAASHTO ? { pileCapD: { ok: pilePunch.dp >= 12 - 1e-9, label: 'Cap Depth over Bars', val: `${f(pilePunch.dp,2)}${pilePunch.dp >= 12 - 1e-9 ? '≥' : '<'}12"`, dc: 12 / Math.max(pilePunch.dp, 1e-9),
+                      ref: 'ACI 318-19 §13.3.1.2; depth above the bottom bars, footings on piles' } } : {}),
-      warnings.push('Pile-supported footing: soil bearing, base sliding and overturning are not checked (the piles carry the wall). The heel and toe are still designed from the soil bearing pressure in this version; the design from the pile reactions follows (Phase 8d).');
+      if (cov_bot > 6) warnings.push(`Pile cap: the bottom bars sit ${f(cov_bot,2)} in above the base (embedment + clear). The toe crack-control check uses this cover (ACI 318-19 §24.3.2 / AASHTO Art. 5.6.7) and fails for large covers; a bar mat below the pile heads, or the engineer's judgement, is needed.`);
+      warnings.push('Pile-supported footing: soil bearing, base sliding and overturning are not checked (the piles carry the wall). The heel and toe are designed from the factored pile reactions (Footing design tab).');
-    ...(pile ? { pile } : {}),   // RWPL (2026-11-07): pile-supported footing results (absent for a spread footing, so its results are as before)
+    ...(pile ? { pile, pileFtg, cov_bot, pilePunch, heelPile: hcG.pile || null, toePile: tcG.pile || null } : {}),   // RWPL (2026-11-07): pile-supported footing results, absent for a spread footing (its results are as before); 8d: factored pile reactions for the footing, bottom cover, punching
+    if (r.heelPile) {   // RWPL 8d: pile-row line loads beyond the section
+      const pr = r.heelPile.rows.filter(rw => rw.a > x + 1e-9);
+      Vs.push(Math.abs(r.wu_heel*L - pr.reduce((t2, rw) => t2 + rw.q, 0))/1000); Ms.push(Math.abs(r.wu_heel*L*L/2 - pr.reduce((t2, rw) => t2 + rw.q*(rw.a - x), 0))/1000); xs.push(x); continue;
+    }
+    if (r.toePile) {   // RWPL 8d: pile-row line loads beyond the section, less the footing weight
+      const pr = r.toePile.rows.filter(rw => rw.a > x + 1e-9), L = inp.Lt - x;
+      Vs.push(Math.max(0, pr.reduce((t2, rw) => t2 + rw.q, 0) - r.wu_toe_down*L)/1000); Ms.push(Math.max(0, pr.reduce((t2, rw) => t2 + rw.q*(rw.a - x), 0) - r.wu_toe_down*L*L/2)/1000); xs.push(x); continue;
+    }
+  // RWPL 8d: on piles the upward load is the pile rows (line loads, lb/ft per ft of wall), drawn as spikes; the bearing trapezoid is not used
+  const pf = r.pileFtg ? (r.heel_min_governs ? r.pileFtg.cmin : r.pileFtg.cmax) : null;
+    pf ? { x: [].concat(...pf.rows.map(rw => [rw.x, rw.x, null])), y: [].concat(...pf.rows.map(rw => [0, rw.q, null])), name: 'Pile-row reactions qᵢ = Pᵢ/sᵢ (up, lb/ft; ' + pf.label + ')',
+      mode:'lines+markers', line:{ color: PLT.pass, width: 4 }, marker:{ size: 7 },
+      hovertemplate:'pile row at x = %{x:.2f} ft<br>q = %{y:,.0f} lb/ft<extra></extra>' } :
-    yaxis: { title: 'Pressure (psf)', gridcolor:'#e8edf5' },
+    yaxis: { title: pf ? 'psf (distributed) · lb/ft (pile rows)' : 'Pressure (psf)', gridcolor:'#e8edf5' },
+  if (r.heelPile) {   // RWPL (2026-11-07, Phase 8d): pile rows behind the back face instead of the bearing trapezoid
+    const hp = r.heelPile;
+    h += eq('Factored pile reactions under the heel (' + hp.label + '; line loads q_i = P_i/s_i)',
+      hp.rows.length ? hp.rows.map(rw => `q = ${F(rw.q,1)}\\ \\text{lb/ft at } a = x - x_{back} = ${F(rw.a,3)}\\ \\text{ft}`).join(';\\ ') : `\\text{no pile row behind the back face: } \\sum q = 0`, 'Pile Step 2 · rigid cap',
+      hp.rows.map((rw, j) => ({ sym: 'q_{' + (j + 1) + '}', desc: 'pile row at x = ' + F(rw.x, 2) + ' ft from the toe', val: F(rw.q, 1), unit: 'lb/ft' })));
+    h += rwWorkedIn(r, [['stabPile', 'pile reactions']]);
+  } else {
+  }
-  else h += eq('Moment from upward bearing about back face (trapezoid: ∫q(x)·x dx)',
+  else h += r.heelPile ? eq('Moment from the pile reactions about back face',
+    `M_{up} = \\sum q_i a_i = ${r.heelPile.rows.length ? r.heelPile.rows.map(rw => `(${F(rw.q,1)})(${F(rw.a,3)})`).join(' + ') : '0'} = \\boxed{${F(r.Mu_heel_up,1)}\\ \\text{lb·ft/ft}}`,'',
+    [{sym:'M_{up}', desc:'pile-reaction moment at face', val:F(r.Mu_heel_up,1), unit:'lb·ft/ft'}]) : eq('Moment from upward bearing about back face (trapezoid: ∫q(x)·x dx)',
-    `M_{u,A} = M_{down} - M_{up} = ${Fk(r.Mu_heel_std)}\\ \\text{kip·ft/ft}, \\quad V_{u,A} = \\left| w_u L_h - ${upHs ? 'F_{up}' : '\\tfrac{q_0+q_L}{2}L_h'} \\right| = ${Fk(r.Vu_heel_std)}\\ \\text{kip/ft}`,'');
+    `M_{u,A} = M_{down} - M_{up} = ${Fk(r.Mu_heel_std)}\\ \\text{kip·ft/ft}, \\quad V_{u,A} = ${r.heelPile ? '\\left| w_u L_h - \\sum q_i \\right|' : '\\left| w_u L_h - ' + (upHs ? 'F_{up}' : '\\tfrac{q_0+q_L}{2}L_h') + ' \\right|'} = ${Fk(r.Vu_heel_std)}\\ \\text{kip/ft}`,'');
+  if (r.toePile) {   // RWPL 8d: pile rows in front of the front face
+    const tp = r.toePile;
+    h += eq('Factored pile reactions under the toe (' + tp.label + '; line loads q_i = P_i/s_i)',
+      tp.rows.length ? tp.rows.map(rw => `q = ${F(rw.q,1)}\\ \\text{lb/ft at } a = x_{front} - x = ${F(rw.a,3)}\\ \\text{ft}`).join(';\\ ') : `\\text{no pile row in front of the front face: } \\sum q = 0`, 'Pile Step 2 · rigid cap',
+      tp.rows.map((rw, j) => ({ sym: 'q_{' + (j + 1) + '}', desc: 'pile row at x = ' + F(rw.x, 2) + ' ft from the toe', val: F(rw.q, 1), unit: 'lb/ft' })));
+    h += rwWorkedIn(r, [['stabPile', 'pile reactions']]);
+  } else {
+  }
-  h += upTs ? eq('Design moment about front face (tension on BOTTOM)',
+  h += r.toePile ? eq('Design moment about front face (tension on BOTTOM)',
+    `M_u = \\sum q_i a_i - \\frac{w_{sw} L_t^2}{2} = ${F(r.toePile.Mup,1)} - \\frac{(${F(r.wu_toe_down,1)})(${F(inp.Lt,2)})^2}{2} = \\boxed{${F(r.Mu_toe_net,1)}\\ \\text{lb·ft/ft}}`,'',
+    [{sym:'M_u', desc:'factored design moment at face', val:F(r.Mu_toe_net,1), unit:'lb·ft/ft'}])   // RWPL 8d
+  : upTs ? eq('Design moment about front face (tension on BOTTOM)',
-    `V_u = ${upTs ? (Math.abs(r.tcG_up.F - r.wu_toe_down*inp.Lt - r.Vu_toe) < 0.5 ? `F_{up} - w_{sw} L_t = ${F(r.tcG_up.F,1)} - (${F(r.wu_toe_down,1)})(${F(inp.Lt,2)})` : '\\max \\text{ of the two combinations}') : '\\frac{q_0+q_L}{2}\\,L_t'} = \\boxed{${F(r.Vu_toe,1)}\\ \\text{lb/ft}} = ${Fk(r.Vu_toe)}\\ \\text{kip/ft}`,'',
+    `V_u = ${r.toePile ? '\\sum q_i - w_{sw} L_t' : upTs ? (Math.abs(r.tcG_up.F - r.wu_toe_down*inp.Lt - r.Vu_toe) < 0.5 ? `F_{up} - w_{sw} L_t = ${F(r.tcG_up.F,1)} - (${F(r.wu_toe_down,1)})(${F(inp.Lt,2)})` : '\\max \\text{ of the two combinations}') : '\\frac{q_0+q_L}{2}\\,L_t'} = \\boxed{${F(r.Vu_toe,1)}\\ \\text{lb/ft}} = ${Fk(r.Vu_toe)}\\ \\text{kip/ft}`,'',
-    <div class="card-hd"><span class="card-title">Toe Step 3 — Flexural Steel (bottom face)</span><span class="card-ref">d = t_f − cover − d_b/2 · cover = ${F(inp.cov_ftg,2)} in</span></div>
+    <div class="card-hd"><span class="card-title">Toe Step 3 — Flexural Steel (bottom face)</span><span class="card-ref">d = t_f − cover − d_b/2 · cover = ${F(r.cov_bot ?? inp.cov_ftg,2)} in</span></div>
-    `d = t_f - c_c - \\frac{d_b}{2} = ${F(inp.tf,1)} - ${F(inp.cov_ftg,2)} - ${F(r.sel_toe.bar.db/2,4)} = \\boxed{${F(r.d_toe,3)}\\ \\text{in}}`,'',
+    `d = t_f - c_c - \\frac{d_b}{2} = ${F(inp.tf,1)} - ${F(r.cov_bot ?? inp.cov_ftg,2)} - ${F(r.sel_toe.bar.db/2,4)} = \\boxed{${F(r.d_toe,3)}\\ \\text{in}}`,'',
-     {sym:'c_c', desc:'bottom clear cover', val:F(inp.cov_ftg,2), unit:'in'},
+     {sym:'c_c', desc: r.pile ? 'bottom clear cover on piles = max(cover input, embedment + clear over the pile heads)' : 'bottom clear cover', val:F(r.cov_bot ?? inp.cov_ftg,2), unit:'in'},   // RWPL
+  // ════ RWPL (2026-11-07, Phase 8d): PILE CAP — PUNCHING AROUND THE PILES ════
+  if (r.pilePunch) {
+    const pp = r.pilePunch, A = r.isAASHTO, g = pp.gov;
+    h += `<div class="sec-heading" style="margin-top:6px;">Pile Cap</div><div class="card" style="margin-bottom:16px;">
+      <div class="card-hd"><span class="card-title">Pile Cap — Punching around the Piles</span><span class="card-ref">${A ? 'AASHTO Art. 5.12.8.6.1 / 5.12.8.6.3 · φ<sub>v</sub> 0.90' : 'ACI 318-19 §22.6.4.1 / Table 22.6.5.2 · φ 0.75'}</span></div><div class="card-body">`;
+    h += eq('Depth over the pile heads', `d_p = t_f - c_{bot} - d_b = ${F(inp.tf,1)} - ${F(r.cov_bot,2)} - ${F(r.sel_toe.bar.db,3)} = \\boxed{${F(pp.dp,2)}\\ \\text{in}}` + (A ? `, \\quad d_v = \\max(0.9d_p,\\,0.72t_f) = ${F(pp.dvp,2)}\\ \\text{in}` : ''), 'c_bot = max(cover, embedment + clear)');
+    h += eq('Critical section side (pile as the square of equal area, at ' + (A ? 'd_v/2' : 'd/2') + ' from its face)', `a = D_{eq} + ${A ? 'd_v' : 'd'} = ${F(pp.Deq,2)} + ${F(pp.dc,2)} = \\boxed{${F(pp.a,2)}\\ \\text{in}}`, '');
+    h += `<table class="tbl"><thead><tr><th>Row</th><th>x (ft)</th><th>s (in)</th><th>edge e (in)</th><th>section</th><th>b<sub>o</sub> (in)</th><th>P<sub>u</sub> (kip)</th><th>φV<sub>c</sub> (kip)</th><th>D/C</th></tr></thead><tbody>${pp.rows.map(x => `<tr><td>${x.i + 1}</td><td>${F(x.x,2)}</td><td>${F(x.S,1)}</td><td>${F(x.ex,1)}</td><td>${x.loc}</td><td>${F(x.bo,1)}</td><td>${F(x.Pu/1000,2)}</td><td>${F(x.phiVc/1000,2)}</td><td>${F(x.dc,3)}</td></tr>`).join('')}</tbody></table>`;
+    h += eq('Perimeter, row ' + (g.i + 1) + ' (' + g.loc + ')', g.strip ? `b_o = ${g.cut ? '1' : '2'}\\,s = ${F(g.bo,1)}\\ \\text{in}\\ (s \\le a)` : (g.cut ? `b_o = a + 2(e + a/2) = ${F(g.a,2)} + 2(${F(g.ex,2)} + ${F(g.a/2,2)}) = \\boxed{${F(g.bo,1)}\\ \\text{in}}` : `b_o = 4a = 4(${F(g.a,2)}) = \\boxed{${F(g.bo,1)}\\ \\text{in}}`), '');
+    h += A ? eqCheck('Two-way shear, row ' + (g.i + 1), `\\phi V_n = 0.90\\,(0.126)\\sqrt{${F(inp.fc/1000,2)}}\\,(${F(g.bo,1)})(${F(pp.dvp,2)}) = ${F(g.phiVc/1000,2)} \\ge P_u = ${F(g.Pu/1000,2)}\\ \\text{kip}`, pp.ok, 'β_c = 1: (0.063 + 0.126/β_c) capped at 0.126')
+           : eqCheck('Two-way shear, row ' + (g.i + 1), `\\lambda_s = \\sqrt{\\tfrac{2}{1+d/10}} = ${F(g.lam_s,3)};\; v_c = \\min(4,\\,6,\\,2 + \\tfrac{${F(g.alpha,0)}(${F(pp.dp,2)})}{${F(g.bo,1)}})\\lambda_s\\sqrt{${F(inp.fc,0)}} = ${F(g.vc,1)}\\ \\text{psi};\; \\phi V_c = 0.75(${F(g.vc,1)})(${F(g.bo,1)})(${F(pp.dp,2)}) = ${F(g.phiVc/1000,2)} \\ge P_u = ${F(g.Pu/1000,2)}\\ \\text{kip}`, pp.ok, 'α_s = ' + g.alpha + (g.alpha === 40 ? ' (interior)' : ' (edge)'));
+    if (!A) h += eqCheck('Depth above the bottom bars, footings on piles', `d_p = ${F(pp.dp,2)} \\ge 12\\ \\text{in}`, pp.dp >= 12 - 1e-9, 'ACI 318-19 §13.3.1.2');
+    h += `<div class="note">P<sub>u</sub> = the larger factored pile reaction of the two footing sets (${r.pileFtg.cmax.label}; ${r.pileFtg.cmin.label}), no deduction for the cap weight inside the perimeter. Piles at the wall ends (corner piles) are not modelled (per ft of wall).</div>`;
+    h += rwWorkedIn(r, [['stabPile', 'pile reactions']]) + `</div></div>`;
+  }
+    if (r.heelPile) {   // RWPL 8d: section at x from the face, loads beyond it (downward w_u, pile-row line loads)
+      const L = inp.Lh - x, pr = r.heelPile.rows.filter(rw => rw.a > x + 1e-9);
+      pts.push({ x: 1 - t, V: Math.abs(wu*L - pr.reduce((t2, rw) => t2 + rw.q, 0)), M: Math.abs(wu*L*L/2 - pr.reduce((t2, rw) => t2 + rw.q*(rw.a - x), 0)) }); continue;
+    }
+    if (r.toePile) {   // RWPL 8d: section at x from the face, pile-row line loads beyond it less the footing weight
+      const L = inp.Lt - x, pr = r.toePile.rows.filter(rw => rw.a > x + 1e-9);
+      pts.push({ x: t, V: Math.max(0, pr.reduce((t2, rw) => t2 + rw.q, 0) - r.wu_toe_down*L), M: Math.max(0, pr.reduce((t2, rw) => t2 + rw.q*(rw.a - x), 0) - r.wu_toe_down*L*L/2) }); continue;
+    }
-    const T3 = [rwrS({ id: 'd', label: 'Effective depth', sym: 'd', eq: 't_{f} \\minus c_{c} \\minus \\frac{d_{b}}{2}', sub: rwrN(inp.tf, 1) + ' \\minus ' + rwrN(inp.cov_ftg, 2) + ' \\minus ' + rwrN(sT.bar.db / 2, 4), value: r.d_toe, unit: 'in', d: 3 })]
+    if (r.heelPile && r.toePile) {   // RWPL (2026-11-07, Phase 8d): the factored pile-row reactions replace the bearing trapezoid
+      const rowsS = (L, sym) => L.length ? L.map(rw => '(' + rwrN(rw.q, 1) + ')(' + rwrN(rw.a, 3) + ')').join(' + ') : '0';
+      const hp = r.heelPile, tp = r.toePile;
+      H1.splice(1, 2, rwrS({ id: 'q0', label: 'Factored pile-row reactions behind the back face (' + hp.label + '), line loads q_i = P_i/s_i at a_i = x_i − x_back', sym: '\\sum q_{i}', eq: '\\sum \\frac{P_{i}}{s_{i}}', sub: hp.rows.map(rw => rwrN(rw.q, 1)).join(' + ') || '0', value: hp.Vup, unit: 'lb/ft', d: 1 }));
+      H2.splice(1, 1, rwrS({ id: 'Mup', label: 'Moment of the pile reactions about the back face', sym: 'M_{up}', eq: '\\sum q_{i} a_{i}', sub: rowsS(hp.rows), value: r.Mu_heel_up, unit: 'lb-ft/ft', d: 1 }));
+      H2.forEach(x => { if (x.id === 'MA' && x.note) x.note = x.note.replace('(q_0 + q_L)/2 · L_h', 'Σq_i'); });
+      T1.splice(1, 2, rwrS({ id: 'q0', label: 'Factored pile-row reactions in front of the front face (' + tp.label + '), line loads q_i = P_i/s_i at a_i = x_front − x_i', sym: '\\sum q_{i}', eq: '\\sum \\frac{P_{i}}{s_{i}}', sub: tp.rows.map(rw => rwrN(rw.q, 1)).join(' + ') || '0', value: tp.Vup, unit: 'lb/ft', d: 1 }));
+      T2.splice(0, 2, rwrS({ id: 'Mu', label: 'Design moment about the front face (tension on the bottom)', sym: 'M_{u}', eq: '\\sum q_{i} a_{i} \\minus \\frac{w_{sw} L_{t}^{2}}{2}', sub: rowsS(tp.rows) + ' \\minus \\frac{(' + rwrN(r.wu_toe_down, 1) + ')(' + rwrN(inp.Lt, 2) + ')^{2}}{2}', value: r.Mu_toe_net, unit: 'lb-ft/ft', d: 1 }),
+        rwrS({ id: 'Vu', label: 'Design shear at the front face', sym: 'V_{u}', eq: '\\sum q_{i} \\minus w_{sw} L_{t}', sub: rwrN(tp.Vup, 1) + ' \\minus (' + rwrN(r.wu_toe_down, 1) + ')(' + rwrN(inp.Lt, 2) + ')', value: r.Vu_toe, unit: 'lb/ft', d: 1 }));
+    }
+    const T3 = [rwrS({ id: 'd', label: 'Effective depth' + (r.pile ? ' (bottom cover on piles = max(c_c, embedment + clear))' : ''), sym: 'd', eq: 't_{f} \\minus c_{c} \\minus \\frac{d_{b}}{2}', sub: rwrN(inp.tf, 1) + ' \\minus ' + rwrN(r.cov_bot ?? inp.cov_ftg, 2) + ' \\minus ' + rwrN(sT.bar.db / 2, 4), value: r.d_toe, unit: 'in', d: 3 })]
+    if (r.pilePunch) {   // RWPL 8d: punching around the piles
+      const pp = r.pilePunch, g = pp.gov;
+      const PS = [rwrS({ id: 'dp', label: 'Depth over the pile heads', sym: 'd_{p}', eq: 't_{f} \\minus c_{bot} \\minus d_{b}', sub: rwrN(inp.tf, 1) + ' \\minus ' + rwrN(r.cov_bot ?? inp.cov_ftg, 2) + ' \\minus ' + rwrN(r.sel_toe.bar.db, 3), value: pp.dp, unit: 'in', d: 2 }),
+        rwrS({ id: 'a', label: 'Critical section side, pile as the square of equal area at ' + (isA ? 'd_v/2' : 'd/2') + ' from its face', sym: 'a', eq: 'D_{eq} + ' + (isA ? 'd_{v}' : 'd'), sub: rwrN(pp.Deq, 2) + ' + ' + rwrN(pp.dc, 2), value: pp.a, unit: 'in', d: 2 }),
+        rwrS({ id: 'bo', label: 'Perimeter, governing row ' + (g.i + 1) + ' (' + g.loc + ')', sym: 'b_{o}', eq: g.strip ? 's' : (g.cut ? 'a + 2(e + a/2)' : '4a'), sub: g.strip ? rwrN(g.S, 1) : (g.cut ? rwrN(g.a, 2) + ' + 2(' + rwrN(g.ex, 2) + ' + ' + rwrN(g.a / 2, 2) + ')' : '4(' + rwrN(g.a, 2) + ')'), value: g.bo, unit: 'in', d: 1 }),
+        isA ? rwrS({ id: 'Vc', label: 'Two-way shear resistance (Eq. 5.12.8.6.3-1, β_c = 1)', sym: '\\phi V_{n}', eq: '0.90(0.126)\\sqrt{f\'_{c}}\\,b_{o} d_{v}', sub: '0.90(0.126)\\sqrt{' + rwrN(inp.fc / 1000, 2) + '}(' + rwrN(g.bo, 1) + ')(' + rwrN(pp.dvp, 2) + ')', value: g.phiVc / 1000, unit: 'kip', d: 2 })
+            : rwrS({ id: 'Vc', label: 'Two-way shear resistance (Table 22.6.5.2, β = 1, α_s = ' + g.alpha + ', λ_s = ' + rwrN(g.lam_s, 3) + ')', sym: '\\phi V_{c}', eq: '0.75\\,v_{c} b_{o} d', sub: '0.75(' + rwrN(g.vc, 1) + ')(' + rwrN(g.bo, 1) + ')(' + rwrN(pp.dp, 2) + ')', value: g.phiVc / 1000, unit: 'kip', d: 2 }),
+        rwrS({ id: 'dc', label: 'Punching check, largest factored pile reaction of the row', sym: '\\frac{P_{u}}{\\phi V_{c}}', eq: '', sub: '\\frac{' + rwrN(g.Pu / 1000, 2) + '}{' + rwrN(g.phiVc / 1000, 2) + '}', value: g.dc, unit: '', d: 3, ok: ok('pilePunch') })];
+      if (!isA) PS.push(rwrS({ id: 'cap', label: 'Depth above the bottom bars, footing on piles (ACI 318-19 §13.3.1.2)', sym: 'd_{p}', eq: '\\ge 12\\ \\text{in}', sub: '', value: pp.dp, unit: 'in', d: 2, ok: ok('pileCapD') }));
+      CK.pilePunch = 'ppn/dc'; if (!isA) CK.pileCapD = 'ppn/cap';
+      subs.push(sub('Pile cap — punching around the piles', [rwrItem('ppn', [{ title: 'Two-way shear at the pile heads', ref: isA ? AA('Art. 5.12.8.6') : 'ACI 318-19 §22.6', steps: PS }]), onTab('ftgPunch')]));
+    }
```

## 2026-11-07 — PR: claude/rw-pile-8e-drawings — Pile-supported footing, Phase 8e: Drawings show the pile reactions and the bottom mat on the pile heads; no soil-bearing graphics on piles (RWPL; display only) (PR #966: https://github.com/mlococo88/All-Structural/pull/966)

Review Phase 8, PR 8e. This PR changes no computed value.
### RWPL-9. Drawings (`RWDW_SUPPORT.piles.loads`, `rwdwBars`, the loads sheet notes)
- `RWDW_SUPPORT.piles.loads(c)`: the loads sheet now shows the pile reactions per row (kip per pile) as upward arrows under the footing, drawn to their own scale. Uplift is drawn as a downward arrow marked "(UPLIFT)".
  - It draws the governing compression combination, with P_max against the capacity and H/N.
  - It then draws the combination with the smallest pile load, with P_min and, under uplift, the capacity T.
  - Before (8b): one line, "PILE REACTIONS WITH THE PILE ANALYSIS (NOT YET IN THIS VERSION)".
- `rwdwBars`: `cb = r.cov_bot` (8d; it equals c_c on soil). F2 is drawn at `cb + d_b/2` and the stem hook at `cb + …`, so on piles the bottom mat sits above the pile heads. On soil the drawing is unchanged.
- Loads sheet notes in pile mode:
  - "soil bearing, sliding and overturning not applicable";
  - N, x̄ and I;
  - compression, uplift and lateral, each with its capacity;
  - punching.
  - These replace the soil FOS / q / eccentricity lines.
### RWPL-10. Section views
- `buildCrossSection` (Analysis diagram): the bearing layer is hidden on piles (`data-layer="bearing"` with `display:none`).
- `buildOverviewSVG`: the bearing block is skipped on piles (`tog.bearing && !r.pile`).
### Check case
- Default wall, t_f 36 in, 2 rows at 1.5 / 11.0 ft, s = 6 ft, ACI. Sheet 3 shows:
  - D + H + L: 59.7 and 56.6 kip per pile, "P_MAX = 59.7 KIP <= 100.0 KIP; H/N = 13.50 KIP/PILE";
  - 0.6D + H: 41.5 and 28.3 kip.
  - These are the Stability tab, Pile Step 2 values.
- Sheet 1 shows the bottom mat 15 in above the base.
### How verified
- origin/main vs branch, the 12 spread walls: `_R`, Export JSON, autosave, Report, tab texts and DXF are identical.
- Pile mode: the sheets were screenshotted and checked, with no console errors.
- Also run: `dxf-print-sheets.mjs --tool rw`, `check-syntax`.
### Open items
- The 3D view's bearing layer and its "Show" combination selector still offer the soil base reaction on piles. The pile reactions in 3D are to come with the Pile Designer link (8f) or a later display PR.
- No pile schedule table: the piles are described in the general notes (8b).

### Before / after (code, `git diff -U0` of `Retaining Wall Designer.html` against main after 8d)
```diff
-  s += `<g data-layer="bearing">`;
+  s += `<g data-layer="bearing"${r.pile ? ' style="display:none"' : ''}>`;   // RWPL (8e): no soil bearing under a pile-supported footing
-  if (tog.bearing) {
+  if (tog.bearing && !r.pile) {   // RWPL (8e): no soil bearing under a pile-supported footing
-  const yHook = cf + db(f2) + db(f3) + db(s1) / 2;                   // the hook bears on the bottom mat
+  const cb = r.cov_bot != null ? r.cov_bot : cf;                      // RWPL (8e): on piles the bottom mat sits above the pile heads (cov_bot = c_c on soil)
+  const yHook = cb + db(f2) + db(f3) + db(s1) / 2;                   // the hook bears on the bottom mat
-    F2: { s: f2, x0: cf, x1: Math.min(G.B - cf, G.xf + r.ld_toe), y: cf + db(f2) / 2, hook: r.toe_hook ? 12 * db(f2) : 0 },   // RWDS: 90° hook up at the toe end when ticked
+    F2: { s: f2, x0: cf, x1: Math.min(G.B - cf, G.xf + r.ld_toe), y: cb + db(f2) / 2, hook: r.toe_hook ? 12 * db(f2) : 0 },   // RWDS: 90° hook up at the toe end when ticked
-    loads(c) { const { L, G, k, T } = c; let y0 = c.y0 != null ? c.y0 : -G.dk - 0.35 * k;
-      T(L.lt, G.B / 2, y0 - 0.2 * k, 0.085 * k, 'PILE-SUPPORTED FOOTING: PILE REACTIONS WITH THE PILE ANALYSIS (NOT YET IN THIS VERSION)', 1); return y0 - 0.6 * k; },
+    /* RWPL (8e): the pile reactions per row (kip per pile) of the governing compression combination, as upward arrows under the
+       footing, with the governing uplift / minimum combination below them; values from r.pile (Stability tab, Pile Step 2) */
+    loads(c) {
+      const { D, L, G, k, T, r } = c, P = r.pile, h = 0.085 * k; let y0 = c.y0 != null ? c.y0 : -G.dk - 0.35 * k;
+      if (!P || P.err) { T(L.lt, G.B / 2, y0 - 0.2 * k, h, 'PILE-SUPPORTED FOOTING: NO PILE RESULTS (INPUT ERROR)', 1); return y0 - 0.6 * k; }
+      const one = (cmb, title) => {
+        const Pm = Math.max(...cmb.L.rows.map(x => Math.abs(x.P)), 1e-9), sc = 0.55 * k / Pm;
+        D.line(L.load, 0, y0, G.B, y0);
+        cmb.L.rows.forEach(x => { const xi = x.x * 12, len = Math.abs(x.P) * sc, yt = y0 - Math.max(len, 0.08 * k);
+          if (x.P >= 0) arrowV(D, L.load, xi, yt, y0, k); else arrowV(D, L.load, xi, y0, yt, k);
+          T(L.lt, xi, yt - 0.14 * k, h, rwdwN(x.P, 1) + ' KIP/PILE' + (x.P < 0 ? ' (UPLIFT)' : ''), 1); });
+        const yl = y0 - 0.55 * k - 0.4 * k; T(L.lt, G.B / 2, yl, h, title, 1); y0 = yl - 0.3 * k;
+      };
+      one(P.govC, 'PILE REACTIONS, ' + P.govC.label.toUpperCase() + ': P_MAX = ' + rwdwN(P.govC.L.Pmax, 1) + ' KIP ' + (r.checks.pileComp.ok ? '<=' : '>') + ' ' + rwdwN(P.govC.cap.c, 1) + ' KIP; H/N = ' + rwdwN(P.govH.L.rows[0].h, 2) + ' KIP/PILE');
+      const mn = P.comb.reduce((b, x) => (!b || x.L.Pmin < b.L.Pmin) ? x : b, null);
+      if (mn && mn !== P.govC) one(mn, 'PILE REACTIONS, ' + mn.label.toUpperCase() + ' (SMALLEST PILE LOAD): P_MIN = ' + rwdwN(mn.L.Pmin, 1) + ' KIP' + (mn.L.Pmin < 0 ? ' (UPLIFT, T <= ' + rwdwN(mn.cap.t, 1) + ' KIP)' : ''));
+      return y0;
+    },
+    if (r.pile && !r.pile.err) {   // RWPL (8e): on piles the soil checks do not apply; the pile results instead
+      const pc = r.pile;
+      foot = ['PILE-SUPPORTED FOOTING: SOIL BEARING, SLIDING AND OVERTURNING NOT APPLICABLE (STABILITY TAB, PILE STEP 2)',
+        'PILE GROUP PER FT: N = ' + F(pc.g.N, 4) + ' /FT, X_BAR = ' + F(pc.g.xbar, 3) + ' FT, I = ' + F(pc.g.I, 4) + ' FT2/FT',
+        'COMPRESSION: P_MAX = ' + F(pc.govC.L.Pmax, 1) + ' KIP <= ' + F(pc.govC.cap.c, 1) + ' (' + pc.govC.label.toUpperCase() + ')',
+        'UPLIFT: ' + (pc.govT.L.Pmin < 0 ? F(-pc.govT.L.Pmin, 1) + ' KIP VS ' + F(pc.govT.cap.t, 1) : 'NONE'),
+        'LATERAL: H/N = ' + F(pc.govH.L.rows[0].h, 2) + ' KIP/PILE VS ' + F(pc.govH.cap.h, 1) + ' KIP',
+        ...(r.pilePunch ? ['PUNCHING AT THE PILES: P_U = ' + F(r.pilePunch.gov.Pu / 1000, 1) + ' KIP VS PHI V_C = ' + F(r.pilePunch.gov.phiVc / 1000, 1) + ' KIP (FOOTING DESIGN TAB)'] : [])];
+    }
```
## 2026-11-07 — PR: claude/rw-left-summary — Check summary in the left panel exactly as Spread Footing's Summary Dashboard: rows styled as SF's chips (RWDL; display only, no result change) (PR #959: https://github.com/mlococo88/All-Structural/pull/959)

### RWDL. Check summary rows styled as Spread Footing's dashboard chips; position and breakpoints confirmed against SF   [display only]
- **Request (engineer, 2026-11-07):** "the summary cards should be on the left panel" — RW's check summary panel (RWDC, #926) to sit in the left column exactly like Spread Footing's Summary Dashboard (SFDC #737 / SFDF #740) and Light Pole's panel (LPDC #747): same position, breakpoints, collapse behaviour and card styling.
- **Study of SF (origin/main, `Spread Footing.html`):** `SFDC.mq = matchMedia('screen and (min-width:1500px)')`; at 1500 px and wider `sfdDashPlace()` moves `#sfdDashBox` into `#sfdDashCol`, the first child of `.main`, i.e. a left column (280 px + 12 px gap) to the LEFT of the input panel, own scroll, sticky head, «/» collapses it to a 42 px strip; below 1500 px the box sits on top of the output panel above the output tabs, chips in a `minmax(min(250px,100%),1fr)` grid, "▾ Hide checks / ▸ Show checks". RW (RWDC) already does the same: same 1500 px query, `#rwDashCol` first child of `#app` (left of the inputs, 292 px incl. padding), own scroll, sticky head, «/» → 42 px strip, below 1500 px above the output tabs with the same grid and the same Hide / Show checks button, same key behaviour (`retaincalcpro.dashCollapsed.v1`, unchanged). Screenshots of both tools at 1280, 1400, 1920 and 390 px confirm the same placement. The one visible difference was the row ("card") styling: SF chips have a 1 px border in the status colour on a tinted background and a bold check name; RW rows had a 4 px coloured left stripe on white with a regular-weight name.
- **Where:** CSS, block `/* RWDC (2026-11-06): check summary panel …`, after the line anchor `.rwdCh.pass { border-left-color: var(--pass); } .rwdCh.fail { border-left-color: var(--fail); background: #FEF2F2; } .rwdCh.warn { border-left-color: var(--warn); background: #FFFBEB; }`.
  - Before: (nothing after that line)
  - After (added):
```css
/* RWDL (2026-11-07, engineer: "the summary cards should be on the left panel" as in Spread Footing): each row is styled as
   Spread Footing's dashboard chip (SFDC): a 1 px border in the status colour on a tinted background, the check name in bold.
   Display only. */
.rwdCh { border-left-width: 1px; }
.rwdCh.pass { border-color: var(--pass); background: #ECFDF5; } .rwdCh.fail { border-color: var(--fail); background: #FEF2F2; }
.rwdCh.warn { border-color: var(--warn); background: #FFFBEB; } .rwdCh.na { border-color: var(--slate-400); background: var(--slate-50); }
.rwdCh.pass:hover { background: #D1FAE5; } .rwdCh.fail:hover { background: #FEE2E2; } .rwdCh.warn:hover { background: #FEF3C7; } .rwdCh.na:hover { background: var(--slate-100); }
.rwdCh .rwdN { font-weight: 700; color: var(--slate-900); }
```
- **Decisions (pending engineer review):**
  1. Breakpoint kept at 1500 px, the same as Spread Footing and Light Pole (as asked: "same breakpoints"). Below 1500 px (e.g. 1280 and 1400 px windows, or a 1920 px screen at 150 % Windows scaling = 1280 CSS px) both tools show the summary above the output tabs, not as a left column. If the engineer's screen is below 1500 px and the left column is wanted there, the breakpoint would need lowering in SF, LP and RW together (a separate change).
  2. RW's own fonts and colour tokens are kept (sans-serif UI, `--pass` / `--fail` / `--warn`); only the chip shape (border + tint + bold name) follows SF. The RW title "CHECK SUMMARY" and the count badges are unchanged.
  3. The Overview "Wall section works / governing D/C" card stays at the top of the Overview tab (SF has no equivalent card; its dashboard is the only summary). The self-consistency line stays under the check list (in the left column at ≥ 1500 px), as RWSC placed it.
  4. Phone (≤ 900 px): RW's "results first / Show inputs" behaviour is kept (SF shows inputs first with a "Jump to the results" link); only the row styling changes there.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Saved data (§5):** no key or format changed; no new key.
- **Check case:** default ACI wall (H_s 12 ft, q_a 3000 psf): 23 rows, all PASS, green bordered rows (D/C 0.20 … 1.00), "all pass · 23 checks"; H_s 22 ft, q_a 2500 psf: "5 FAIL", red bordered rows open (Sliding D/C 1.62, Bearing 1.66, Stem Shear 1.12, Stem Hook ℓdh 1.91, Toe Shear 2.39).
- **How verified:** origin/main (after #957) vs branch, headless Chromium at 1920 px, three walls (ACI default; AASHTO default; ACI H_s 22 / q_a 2500 with 5 FAIL): `window._R`, Export JSON fields (`snapshotFields()`), every localStorage key and value, the Report tab text and the four-sheet DXF **identical**; 0 console errors. No sideways page scroll at 390, 768, 1280, 1400 and 1920 px. Screenshots before / after at 1280, 1400, 1920 and 390 px (deviceScaleFactor 2) next to Spread Footing at the same widths, and the FAIL wall at 1920 and 1400 px, looked at. Tests: check-syntax; smoke/retaining-wall-checks; phone-layout rwall 390/768; project-library retwall.
- **Other copies:** none.

## 2026-11-07 — PR: claude/rw-partial-contact — Footing design in partial contact: the factored soil reaction is the triangular block of length 3x̄, not the whole-base interpolation (ACI without water and AASHTO Strength I / Ia) (RWPC; calculation change) (PR #980: https://github.com/mlococo88/All-Structural/pull/980)

Open item raised in #960 (RWUP). Engineer instruction relayed 2026-11-07 (no questions; conservative choice). Code sites are tagged `RWPC`.

### RWPC-1. Problem
- When a factored resultant lies outside the kern (|e| > B/6), the trapezoid becomes a triangle of length 3x̄ from the toe (q_toe = 2V/(3x̄)) or 3(B − x̄) from the heel end. The face pressures q_u,front / q_u,back (ACI 1.2D + 1.6H and 0.9D + 1.6H; AASHTO Strength I `quA_*` and Strength Ia `quIa_*`) were interpolated linearly from q_toe at x = 0 to 0 at x = B, i.e. a triangle of length B. That distribution is not in equilibrium (its area q_toe·B/2 exceeds V).
  - Heel: upward relief overstated → heel M_u **unconservative**.
  - Toe: upward pressure overstated → toe M_u and V_u conservative, sometimes grossly.
- ACI walls with water were already done statically in #960 (RWUP); they are not changed here.

### RWPC-2. Fix (`calcAll`)
- New `q_blk(x, qt, qh, e, xR)` next to `q_at`: full contact → `q_at` (same arithmetic, bit-identical); partial contact → the block. Used for `quf_front`, `quf_back`, `quf_front_min`, `quf_back_min`, `quA_front`, `quA_back`, `quIa_front`, `quIa_back` (were `q_at` / the same linear expression).
- Members: a combination with |e| > B/6 and no water split loads the heel and toe with the RWUP pieces at γ_U = 0 (`rwUpSplit(V, M, 0, …)`, `rwUpMember`), so a block that ends inside a member is integrated exactly: `pcS` after the RWUP block; `heelCase` / `toeCase` get `pcS[0]` (ACI 1.2D + 1.6H / AASHTO Strength I) and `pcS[1]` (ACI 0.9D + 1.6H / AASHTO Strength Ia). AASHTO returns `M_net_tot`, `M_net_Ia`, `x_R_Ia` for this.
- Pile-supported footings (RWPL, #961) design the heel and toe from the pile-row reactions and are not affected (`pcS` is skipped in pile mode).
- A resultant outside the base (x̄ ≤ 0 or ≥ B) is handled as in RWUP (warning "Footing (partial contact)"; V at the toe tip for the toe, no relief on the heel). Before, the toe pressure became 0 there.
- **Basis:** statics of a rigid footing on soil that takes no tension (the linear distribution the tool already uses for the stability and rock-bearing checks, cf. AASHTO LRFD 10th Ed. Eqs. 11.6.3.2-2/-3). No code formula, load factor or resistance factor changes.

### RWPC-3. Display
- Footing tab Heel/Toe Step 1–2 (via `rwUpSteps`, new "no water split" branch): ΣV_u (or V_u), x̄ = M_u/V, e, L_c, peak pressure, q(0), q(L), M_soil = M_up. Stability Step 7 (ACI) title says "partial contact: triangular block" when it applies; Report `rwrTrap` face values use the block formula. The §5.3.8 reference and the "uplift split" notes stay only with water.

### Check cases
- **ACI, L_t 2, L_h 3, t_f 24 in (B = 6.5 ft), no water** (hand check):
  - Toe, U = 0.9D + 1.6H governs: ΣV_u = 7668 lb/ft, M_u = 1207 lb-ft/ft → x̄ = 0.157 ft, e = 3.093 > B/6 = 1.083; L_c = 0.472 ft, q_toe = 2(7668)/0.472 = 32478 psf. The block lies inside the toe: M_up = V(L_t − L_c/3) = 7668(2 − 0.157) = 14129; M_u = 14129 − 270(2²)/2 = **13589** (was **57755**: face pressure 22487 psf from the whole-base line, upward force on the toe 54,965 lb/ft > V = 7668). V_u 54424 → 8046. F2 #6 @ 8 → **#5 @ 7**.
  - Heel, U = 1.2D + 1.6H governs: ΣV_u = 10224, x̄ = 1.112, L_c = 3.335 ft < x_back = 3.5 ft → no soil under the heel: M_u = M_down = 2088(3²)/2 = **9396** (was **5151** = 9396 − 2830(3²)/6). F1 #5 @ 7 unchanged. Heel and toe shear checks, which failed on the old (non-equilibrium) pressure, now pass.
- **AASHTO, Rankine β 20°** (hand check): Strength Ia V = 19761, x̄ = 3.730, e = 2.520 > 2.083; L_c = 11.189 ft, q_toe = 3532.1; at the back face q = 3532.1(1 − 4.5/11.189) = 2111.6, contact ends 6.689 ft into the heel. M_up = 6.689²/6 (2111.6) = 15747 (was 2260.5(8²)/6 = 24112); M_u = 60713 − 15747 = **44966** (was **36600**); F1 #5 @ 6 → **#6 @ 7**.
- **Audit walls that move** (main vs branch):

| Wall | Before | After |
|---|---|---|
| `aashto_water_col_eta` | heel M_u 33125, F1 #5 @ 7 | **43381, #6 @ 7** |
| `aashto_rock_ct_water` | heel 43557 (Strength I) | **45189** (Strength Ia governs); bars unchanged |
| `aashto_vh_ct` | heel 49416 (Strength I) | **51291** (Strength Ia governs); bars unchanged |
| `aci_mix`, `aci_tall_seis` (water: RWUP) | — | design unchanged; only the informational `quf_front_min` / `quf_back_min` (Stability Step 7) change |

- **Extra walls:** ACI `aci_mix` without water: heel 10147 → **23021** (#4 @ 6 unchanged). AASHTO L_t 2, L_h 3, t_f 24: heel 7695 → 13176 (#3 @ 12 → #3 @ 7), toe 31166 → 18989 (#5 @ 8 → #4 @ 8). AASHTO L_t 4, L_h 4: toe 22204 → 19501 (#5 @ 8 → #5 @ 9).
- **Full contact unchanged:** `aci_default`, `aci_water_uni`, `aci_water_tri`, `aci_shorttoe` identical in every part (`_R`, export, tabs, Report); `aashto_ct`, `aashto_qs250_water_ct(_full)` differ only by the new fields `M_net_tot`, `M_net_Ia`, `x_R_Ia`.

### How verified
- origin/main vs branch, headless Chromium (`_R`, Export JSON, localStorage, tabs, Report): the twelve audit walls + 5 partial-contact walls (above). 0 console errors.
- Hand checks above reproduced with the tool's `calcAll` in Node.
- Tests: check-syntax; smoke/retaining-wall-checks (table `AUD`: RWPC ACI L_t 2 / L_h 3, AASHTO β 20°, default full contact); phone-layout rwall 390/768; project-library retwall; dxf-print-sheets rw.

### Decisions (pending engineer review)
- The block is applied to toes too, so toe M_u / V_u / bars can go **down** where the old line overstated the pressure (statics; e.g. L_t 2 / L_h 3: toe #6 @ 8 → #5 @ 7). No envelope with the old non-equilibrium distribution.
- Resultant outside the base: toe takes V at its tip (upper bound), heel no relief, with a warning (was zero pressure).
- AASHTO on rock: the footing-design trapezoid is treated the same way (linear distribution with no tension, as Eqs. 11.6.3.2-2/-3).

### Saved data
- No input or format change.
## 2026-11-07 — PR: claude/rw-left-breakpoint — Check summary as a left column from 1200 px (was 1500 px); 240 px wide from 1200 to 1499 px (RWLB; display only, no result change) (PR #984: https://github.com/mlococo88/All-Structural/pull/984)

### RWLB. The check summary is on the left at common laptop widths   [display only]
- **Decision (pending engineer review):** the engineer asked (2026-11-07) for "the summary cards … on the left panel"; at 1280–1499 px (laptops, and 1920 px screens at 125–150 % scaling) RWDC / RWDL (#926, #959) still put the summary above the output tabs. The left column now starts at **1200 px** in Retaining Wall Designer, Spread Footing and Light Pole and Sign Post alike (one PR per tool). From 1200 to 1499 px the column is **240 px** wide; at 1500 px and wider it is 292 px as before (layout unchanged there). Below 1200 px (tablet, phone) nothing changes: the summary sits above the output tabs, and the phone keeps "results first / Show inputs". Same collapse button (« / » → 42 px strip) and key `retaincalcpro.dashCollapsed.v1`.
- **Why 1200:** at 1200 px the column (240) + inputs (344) leave a 616 px output panel; every output tab fits without sideways scroll (checked on all nine tabs at 1200, 1280 and 1400 px). The Overview card's two groups (Stability / Structural) were cramped at that width (bars and values overlapping), so from 1200 to 1279 px with the column open they stack, exactly as they already do at 1100 px and below.
- **Where:**
  - CSS, RWDC block: before `@media screen and (min-width: 1500px) {` (the rule holding `body.rwDashWide #rwDashCol { display: block; flex: 0 0 292px; …`); after:
```css
/* RWLB (…): the left column starts at 1200 px (was 1500 px) … */
@media screen and (min-width: 1200px) and (max-width: 1499.98px) { body.rwDashWide #rwDashCol { flex-basis: 240px; width: 240px; } }
/* RWLB: … the Overview card's Stability / Structural groups stack, as they already do at 1100 px and below */
@media screen and (min-width: 1200px) and (max-width: 1279.98px) {
  body.rwDashWide:not(.rwDashColl) .sc-cols { grid-template-columns: 1fr; }
  body.rwDashWide:not(.rwDashColl) .sc-group + .sc-group { border-left: 0; border-top: 1px solid var(--border); }
  body.rwDashWide:not(.rwDashColl) .sc-gov { text-align: left; }
}
@media screen and (min-width: 1200px) {
```
  - JS: `const RWDC = { … mq: window.matchMedia ? window.matchMedia('screen and (min-width:1500px)') : null, …` → `'screen and (min-width:1200px)'` (comment `/* RWLB: was 1500px */`).
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data (§5):** no key or format changed.
- **How verified:** origin/main vs branch at 1920, 1280 and 1200 px, three walls (ACI default; AASHTO default, 1 FAIL; ACI H_s 22 ft / q_a 2500 psf, 5 FAIL): `window._R`, Export JSON fields, every localStorage key and value, the Report text (`textContent`: the Report's subsections use `content-visibility:auto`, so `innerText` drops off-screen subsections and depends on the layout) and the four-sheet DXF **identical**; 0 console errors. No sideways page scroll at 390, 768, 1200, 1280, 1400, 1920 px (every output tab at 1200 / 1280 / 1400). Screenshots before / after at 1200, 1280, 1400 (and after at 1920, 768, 390; the 5-FAIL wall at 1280) looked at. Tests: check-syntax; smoke/retaining-wall-checks; phone-layout rwall 390/768; project-library retwall.

## 2026-11-07 — PR: claude/rw-pile-schedule — Pile-supported footing: pile schedule (Drawings sheet 5 with a pile layout plan, Report table); the stale Phase 8b warning removed (RWPL; display only, no result change) (PR #981: https://github.com/mlococo88/All-Structural/pull/981)

Review Phase 8, pile schedule (the open item of 8e). Code sites are tagged `RWPL`. No computed value changes; spread-footing walls are byte-identical.
### RWPL-11. `rwPileSchedule(r)` (new, after `rwPileAnalysis`)
- One row per pile row, read from `r.pile` (Stability tab, Pile Step 2); nothing new is computed, only selected:
  - compression: the combination with the largest P_i / capacity for that row (P_i > 0), its P_i and capacity;
  - uplift: the combination with the largest −P_i / uplift capacity for that row (P_i < 0), else none;
  - lateral: h = H/N of the governing lateral combination (`r.pile.govH`; the same on every pile);
  - piles per ft = 1/s; count per joint segment when the wall length is known (AASHTO collision input L_joint, the only length in the model): the
    first pile s/2 from the joint, then every s (the rule of the elevation and the 3D view), n = ceil((L − s/2)/s).
- Combinations are numbered in `r.pile.comb` order (the Pile Step 2 table order).
### RWPL-12. Drawings: sheet 5 "PILE LAYOUT PLAN AND PILE SCHEDULE" (pile mode only; block `/* ===== 5. PILE LAYOUT AND PILE SCHEDULE`)
- Plan from above, toe at the bottom: footing B × segment length (joint spacing, or the nominal length of the elevation sheet), stem faces,
  piles of each row (hidden: under the footing; squares, or circles for pipe / round), row lines, the first spacing of each row dimensioned,
  "ROW i @ s O.C.", a chain of the row positions from the toe and B.
- Pile schedule table at paper size: ROW, X FROM TOE, SPACING, PILES/FT, NO. IN L (or NO./SEGMENT "-"), PILE, EMBED., P_MAX / capacity / comb.,
  UPLIFT / capacity / comb., H/N / capacity / comb.; notes: the combination list, the selection rule, the capacities' basis, the count rule,
  "pile length, tip elevation and driving criteria by the geotechnical engineer".
- The sheet is appended after sheet 4, so sheets 1–4 keep their numbers; it is drawn only when `r.pile` has results (spread footing: 4 sheets, as before).
  It is in the DXF and the print like every sheet. Links: Pile Step 2, punching.
### RWPL-13. Report: "Pile schedule" (last sub of the "Pile-supported footing" section)
- The same rows (kip per pile: P / capacity (comb.)), the combination list, the count rule, a link to the Drawings tab.
### RWPL-14. Stale warning removed
- `calcAll`: the Phase 8b warning "Pile-supported footing selected: the piles are drawn, but the pile analysis is not in this version yet
  (Phase 8c) …" was still pushed in pile mode (8c meant to remove it; it survived the 8b/8c merge). It contradicted the pile results shown. Removed. Display only.
### Check case (default wall, t_f 36 in, 2 rows at 1.5 / 11.0 ft, s = 6 ft, ACI)
- Row 1: x 1'-6", 6'-0", 0.1667 /ft, P_max 59.7 kip ≤ P_a 100 (1) D + H + L; uplift none; H/N 13.50 kip vs H_a 8.0 (1).
- Row 2: x 11'-0", P_max 56.6 kip (1). These are the Pile Step 2 table values (and the 8e loads sheet).
- AASHTO, collision joint 41 ft, rows 1.5 / 11.0 / 6.0 ft at s 6 / 6 / 8 ft: 7, 7 and 5 piles in the 41-ft segment (3, 9, …, 39 ft; 4, 12, …, 36 ft).
### How verified
- origin/main vs branch, headless Chromium, the 12 audit walls (spread): `_R`, Export JSON, autosave, Report, tab texts and DXF identical.
- Pile mode (ACI default; AASHTO collision + k_h + 3 rows): the only differences are the warning removed, the Report sub "Pile schedule" and sheet 5 in the DXF.
- Sheet 5 screenshotted (ACI and AASHTO); `check-syntax`; `retaining-wall-checks`; `phone-layout --tool rwall --w 390,768`; `project-library --tool retwall`; `dxf-print-sheets --tool rw`.
### Other copies
- None.
### Open items
- **Decision (pending engineer review):** the schedule shows, per row, the combination with the largest load-to-capacity ratio (not the largest load), so it matches the checks when the capacities differ by limit state (AASHTO strength vs extreme event).
- **Decision (pending engineer review):** the count per segment uses "first pile s/2 from the joint"; the actual layout at joints is the detailer's.

### Before / after (code, `git diff -U0` of `Retaining Wall Designer.html`)
```diff
-/* RWDL (2026-11-07, engineer: "the summary cards should be on the left panel" as in Spread Footing): each row is styled as
-   Spread Footing's dashboard chip (SFDC): a 1 px border in the status colour on a tinted background, the check name in bold.
-   Display only. */
-.rwdCh { border-left-width: 1px; }
-.rwdCh.pass { border-color: var(--pass); background: #ECFDF5; } .rwdCh.fail { border-color: var(--fail); background: #FEF2F2; }
-.rwdCh.warn { border-color: var(--warn); background: #FFFBEB; } .rwdCh.na { border-color: var(--slate-400); background: var(--slate-50); }
-.rwdCh.pass:hover { background: #D1FAE5; } .rwdCh.fail:hover { background: #FEE2E2; } .rwdCh.warn:hover { background: #FEF3C7; } .rwdCh.na:hover { background: var(--slate-100); }
-.rwdCh .rwdN { font-weight: 700; color: var(--slate-900); }
+/* RWPL (2026-11-07, Phase 8 pile schedule; display only): the pile schedule of the Drawings (sheet 5) and the Report, one row per
+   pile row. Every number is read from r.pile (Stability tab, Pile Step 2); nothing is computed here but the selection:
+   - compression: the combination with the largest P_i / capacity for that row (P_i > 0), with its P_i and capacity;
+   - uplift: the combination with the largest −P_i / uplift capacity for that row (P_i < 0), or none;
+   - lateral: h = H/N, the same on every pile, of the governing lateral combination (P.govH);
+   - count: piles of the row in one joint segment (AASHTO collision input L_joint, the only wall length in the model), placed as
+     in the elevation and the 3D view: the first pile s/2 from the joint, then every s. With no length: piles per ft only.
+   Combinations are numbered in r.pile.comb order (the order of the Pile Step 2 table). */
+function rwPileSchedule(r) {
+  const P = r && r.pile; if (!P || P.err || !P.comb || !P.comb.length || !P.g) return null;
+  const inp = r.inp, isA = r.isAASHTO, A = inp.aashto || {};
+  const Lseg = (isA && A.ct_enable && A.ct_ljoint > 0) ? A.ct_ljoint : null;
+  const nIn = (L, s) => (L > s / 2 ? Math.ceil((L - s / 2) / s - 1e-9) : 0);
+  const num = c => P.comb.indexOf(c) + 1;
+  const rows = P.rows.map((rw, i) => {
+    let c = null, t = null;
+    P.comb.forEach(cb => { const x = cb.L.rows[i]; if (!x || !isFinite(x.P)) return;
+      const dc = x.P > 0 ? x.P / Math.max(cb.cap.c, 1e-9) : 0, dt = x.P < 0 ? -x.P / Math.max(cb.cap.t, 1e-9) : 0;
+      if (x.P > 0 && (!c || dc > c.dc)) c = { P: x.P, cap: cb.cap.c, cs: cb.cap.cs, dc, label: cb.label, n: num(cb) };
+      if (x.P < 0 && (!t || dt > t.dc)) t = { P: -x.P, cap: cb.cap.t, ts: cb.cap.ts, dc: dt, label: cb.label, n: num(cb) }; });
+    return { row: i + 1, x: rw.x, s: rw.s, n: 1 / rw.s, count: Lseg ? nIn(Lseg, rw.s) : null, c, t };
+  });
+  const gh = P.govH, h = gh && gh.L.rows.length ? { h: gh.L.rows[0].h, cap: gh.cap.h, hs: gh.cap.hs, dc: gh.dcH, label: gh.label, n: num(gh) } : null;
+  const shape = { hp: 'steel H-pile', pipe: 'steel pipe pile', square: 'square precast concrete', round: 'round (timber / cast-in-place)' }[P.shape] || P.shape;
+  return { rows, h, Lseg, shape, desig: P.desig || '', D: P.D, embed: P.embed, isA, combs: P.comb.map((c, j) => ({ n: j + 1, label: c.label })) };
+}
-  // RWPL (2026-11-07, Phase 8b): pile-supported footing selected: inputs and drawings only in this version
-  if (inp.fnd && inp.fnd.type === 'pile') warnings.push('Pile-supported footing selected: the piles are drawn, but the pile analysis is not in this version yet (Phase 8c). The stability and footing results shown are still those of a spread footing on soil.');
+  // RWPL (2026-11-07): the Phase 8b warning "pile analysis not in this version yet" is removed (stale since 8c / 8d: the piles are analysed)
+    // RWPL (2026-11-07, pile schedule; display only): one row per pile row; values from Pile Step 2 (rwPileSchedule)
+    const PS = rwPileSchedule(r);
+    if (PS) {
+      const cmb = q => q ? N(q.P, 2) + ' / ' + N(q.cap, 2) + ' (' + q.n + ')' : 'none';
+      const prow = PS.rows.map(q => ['Row ' + q.row, N(q.x, 2), N(q.s, 2), N(q.n, 4), q.count == null ? '–' : String(q.count), PS.shape + (PS.desig ? ', ' + PS.desig : '') + ', D = ' + N(PS.D, 1) + ' in', N(PS.embed, 1),
+        cmb(q.c), cmb(q.t), PS.h ? N(PS.h.h, 2) + ' / ' + N(PS.h.cap, 2) + ' (' + PS.h.n + ')' : '–']);
+      const cap = isA ? 'factored resistance' : 'allowable';
+      subs.push(sub('Pile schedule', [{ type: 'table', wide: true, caption: 'Pile schedule (per pile row; loads per pile, kip)', head: ['Row', 'x from the toe (ft)', 'Spacing s (ft)', 'Piles per ft', PS.Lseg ? 'Piles in ' + N(PS.Lseg, 1) + ' ft' : 'Piles per segment', 'Pile', 'Embedment (in)', 'Compression P / ' + cap + ' (comb.)', 'Uplift T / ' + cap + ' (comb.)', 'Lateral h / ' + cap + ' (comb.)'], rows: prow },
+        { type: 'note', text: 'Combinations: ' + PS.combs.map(c => '(' + c.n + ') ' + c.label).join('; ') + '. For each row the combination with the largest load-to-capacity ratio is shown; the lateral load h = H/N is the same on every pile. Every value is worked in Pile Step 2 (above; on screen: Stability tab, Pile Step 2).' },
+        { type: 'note', text: PS.Lseg ? 'Piles per segment: one joint segment of ' + N(PS.Lseg, 1) + ' ft (the collision input), the first pile s/2 from the joint, then every s (as drawn on the Drawings, sheet 5).' : 'The wall length is not in the model: piles per ft only; the Drawings (sheet 5) show a typical segment at a nominal length.' },
+        { type: 'note', text: '[[tab:drawings|On screen: Drawings tab, sheet 5 (pile layout plan and pile schedule)]]' }]));
+    }
+  /* ================= 5. PILE LAYOUT AND PILE SCHEDULE (pile-supported footing only; RWPL, display only) ================= */
+  const PS = rwPileSchedule(r);
+  if (PS) sheet('piles', 'PILE LAYOUT PLAN AND PILE SCHEDULE', P => {
+    const h = 0.085 * P, hs = 0.072 * P, F = inp.fnd, d = F.D, round = F.shape === 'pipe' || F.shape === 'round';
+    const Lknown = PS.Lseg ? PS.Lseg * 12 : null, Lw = Lknown || Math.max(2 * G.H, 240);
+    // plan: x along the wall, y from the toe (toe at the bottom); the footing, the stem faces, the piles (hidden: under the footing)
+    D.rect(L.conc, 0, 0, Lw, G.B);
+    D.line(L.conc, 0, G.xf, Lw, G.xf); D.line(L.conc, 0, G.xbt, Lw, G.xbt); if (Math.abs(G.xbb - G.xbt) > 1e-6) D.line(L.hid, 0, G.xbb, Lw, G.xbb);
+    const freeY = (y0, y1) => { const ys = [y0, ...F.rows.map(rw => rw.x * 12).filter(y => y > y0 && y < y1), y1].sort((p1, p2) => p1 - p2);   // the middle of the widest gap between rows
+      let best = [y0, y1], w = -1; ys.slice(1).forEach((y, j) => { if (y - ys[j] > w) { w = y - ys[j]; best = [ys[j], y]; } }); return (best[0] + best[1]) / 2; };
+    T(L.txt, Lw / 2, (G.xf + G.xbt) / 2 - 0.035 * P, hs, 'STEM', 1);
+    T(L.txt, Lw / 2, freeY(0, G.xf) - 0.035 * P, hs, 'TOE', 1); T(L.txt, Lw / 2, freeY(Math.max(G.xbb, G.xbt), G.B) - 0.035 * P, hs, 'HEEL', 1);
+    const ord = F.rows.map((rw, i) => ({ rw, i })).sort((p1, p2) => p1.rw.x - p2.rw.x);
+    ord.forEach(({ rw, i }) => { const s = rw.s * 12, y = rw.x * 12; if (!(s > 0)) return; const xs = [];
+      for (let x = s / 2; x < Lw - 1e-6; x += s) { xs.push(x); if (round) D.circle(L.hid, x, y, d / 2); else D.rect(L.hid, x - d / 2, y - d / 2, x + d / 2, y + d / 2); }
+      D.line(L.hid, -0.1 * P, y, Lw + 0.1 * P, y, D.ltype('DASHED'));   // row line
+      if (xs.length > 1) D.dimH(L.dim, xs[0], xs[1], y + d / 2 + 0.22 * P, y + d / 2, '<>');
+      T(L.txt, Lw + 0.18 * P, y - 0.035 * P, h, 'ROW ' + (i + 1) + ' @ ' + rwdwFI(s) + ' O.C.', 0); });
+    D.h = 0.085 * P;
+    D.chainV(L.dim, [0, ...ord.map(o => o.rw.x * 12)], -0.45 * P, 0);
+    D.dimV(L.dim, 0, G.B, -0.9 * P, 0, 'B = <>');
+    T(L.txt, -1.05 * P, G.B / 2, hs, 'FROM THE TOE', 1, 90);
+    const yd = -0.5 * P;
+    if (Lknown) D.dimH(L.dim, 0, Lw, yd, 0, 'JOINT SPACING <> (COLLISION INPUT)');
+    else T(L.txt, Lw / 2, yd, hs, 'WALL LENGTH NOT IN THE MODEL: TYPICAL SEGMENT AT A NOMINAL LENGTH; FIRST PILE S/2 FROM THE SEGMENT END', 1);
+    const sbK = scaleBar(Lw / 2, yd - 0.45 * P, P, 'PILE LAYOUT PLAN (FROM ABOVE, TOE AT THE BOTTOM)  ·  SCALE ' + rwdwScName(P));
+    const ivP = D.mark();
+    // the schedule below the plan, at paper size
+    const yT = yd - 1.3 * P, th = 0.068 * P, pile = (PS.desig || ({ hp: 'H-PILE', pipe: 'PIPE', square: 'SQ. PRECAST', round: 'ROUND' }[F.shape] || 'PILE')) + ', D = ' + rwdwIn(PS.D);
+    const capS = isA ? 'RESIST.' : 'ALLOW.';
+    const rows = PS.rows.map(q => [String(q.row), rwdwFI(q.x * 12), rwdwFI(q.s * 12), rwdwN(q.n, 4), q.count == null ? '-' : String(q.count), pile, rwdwIn(PS.embed),
+      q.c ? rwdwN(q.c.P, 1) : '-', q.c ? rwdwN(q.c.cap, 1) : '-', q.c ? '(' + q.c.n + ')' : '-',
+      q.t ? rwdwN(q.t.P, 1) : 'NONE', q.t ? rwdwN(q.t.cap, 1) : '-', q.t ? '(' + q.t.n + ')' : '-',
+      PS.h ? rwdwN(PS.h.h, 2) : '-', PS.h ? rwdwN(PS.h.cap, 1) : '-', PS.h ? '(' + PS.h.n + ')' : '-']);
+    D.text(L.txt, 0, yT, 0.12 * P, 'PILE SCHEDULE (' + ({ hp: 'STEEL H-PILES', pipe: 'STEEL PIPE PILES', square: 'SQUARE PRECAST CONCRETE PILES', round: 'ROUND PILES' }[F.shape] || 'PILES') + ', VERTICAL)', 0);
+    const t = table(0, yT - 0.12 * P, ['ROW', 'X FROM TOE', 'SPACING', 'PILES/FT', PS.Lseg ? 'NO. IN ' + rwdwFI(PS.Lseg * 12) : 'NO./SEGMENT', 'PILE', 'EMBED.', 'P_MAX (KIP)', capS + ' (KIP)', 'COMB.', 'UPLIFT (KIP)', capS + ' (KIP)', 'COMB.', 'H/N (KIP)', capS + ' (KIP)', 'COMB.'], rows, th, [1, 2, 3, 4, 7, 8, 10, 11, 13, 14]);
+    const comb = PS.combs.map(c => '(' + c.n + ') ' + c.label.toUpperCase()).join('; ');
+    const notes = ['COMBINATIONS: ' + comb + '.',
+      'PER PILE, FROM THE PILE ANALYSIS (STABILITY TAB, PILE STEP 2): P_MAX = THE COMPRESSION OF THE COMBINATION WITH THE LARGEST P / CAPACITY FOR THE ROW; UPLIFT LIKEWISE;',
+      'H/N = THE LATERAL LOAD PER PILE (EQUAL SHARE)' + (F.passive ? ', NET OF THE PASSIVE CREDIT' : '') + '. ' + (isA ? 'RESISTANCES: PHI_C R_N, PHI_UP R_N,UP (STRENGTH), 1.0 R_N, 0.80 R_N,UP (EXTREME EVENT), H_R AS ENTERED.' : 'ALLOWABLE CAPACITIES (SERVICE LOADS) AS ENTERED: P_A, T_A, H_A.'),
+      'NO. IN SEGMENT: PILES OF THE ROW IN ONE SEGMENT, FIRST PILE S/2 FROM THE SEGMENT END (AS DRAWN); ' + (PS.Lseg ? 'SEGMENT = THE JOINT SPACING OF THE COLLISION INPUT.' : 'THE WALL LENGTH IS NOT IN THE MODEL: PILES PER FT ONLY.'),
+      'PILE LENGTH, TIP ELEVATION AND DRIVING CRITERIA: BY THE GEOTECHNICAL ENGINEER (NOT IN THE TOOL).'];
+    const wrap = (s0, n) => { const out = []; let line = ''; String(s0).split(/\s+/).forEach(w => { if (line && (line + ' ' + w).length > n) { out.push(line); line = '   ' + w; } else line = line ? line + ' ' + w : w; }); if (line) out.push(line); return out; };
+    const nl = []; notes.forEach(s0 => wrap(s0, 170).forEach(q => nl.push(q)));
+    nl.forEach((s2, j) => D.text(L.txt, 0, yT - 0.3 * P - t.h - 0.115 * j * P, 0.062 * P, s2, 0));
+    return { known: sbK, iv: ivP };
+  }, [8, 12, 16, 24, 32, 48, 64, 96, 192], [['stabPile', 'pile reactions'], ['ftgPunch', 'punching']]);
+
## 2026-11-07 — PR: claude/rw-pile-3d — Pile-supported footing: 3D view with the pile combinations and the pile reactions per row; no soil base reaction on piles (RWPL; display only, no result change) (PR #998: https://github.com/mlococo88/All-Structural/pull/998)

Review Phase 8, 3D view (open item of 8e). Code sites are tagged `RWPL`. Nothing computed changes; on a spread footing the 3D view is as before.
### RWPL-15. 3D "Show" list on piles (`rw3Options`, `rw3Selected`; new `rw3IsPile`, `rw3PileCombos`, `rw3PileFactors`)
- On a pile-supported footing (`r.pile` with results) the combinations are the pile analysis' own (`r.pile.comb`, Stability tab, Pile Step 2):
  "★ Governing pile compression combination" (`r.pile.govC`) and the group "Combinations (pile reactions per row)". The bearing combinations
  (`rwbpCombos`) are not offered on piles. "All load cases" shows the ACI D + H + L pile reactions (AASHTO: none; every pile combination is factored).
- Factored arrows (RW3F) on piles: the factors of a pile combination are read from the analysis' definitions:
  - AASHTO: Strength I max = the bearing set's `CMB_S1` (same V and x_R, 8c), Strength I min = `CMB_S1A`, Extreme Event II max = `CMB_EE2`
    (`rw3Factors` 's1', 's1a', 'ee2'). Extreme Event I and Extreme Event II min: no factor map; the arrows stay unfactored and the toggle is off.
  - ACI / IBC (the service combinations of `rwPileAnalysis`): D + H + L all × 1.0; + 0.7E; 0.6D + H (DC, EV, P_a,V × 0.6, water uplift × 1.0,
    no heel surcharge, column 0.6 × (D + any wind uplift)); 0.6D + 0.7E + H.
  - The 3D title's check line (Σγ·V and Σγ·M about the toe of the arrows vs the combination's V and V·x_R) passes (✓) for every pile
    combination of: the default wall; ACI water + k_h 0.15 + column + β 10° + q_s + key + passive (s1–s4); AASHTO collision + barrier + water +
    column + k_h 0.10 + q_s + passive (Strength I max / min, Extreme Event II max).
### RWPL-16. Pile reactions instead of the soil base reaction (`rw3Build`)
- On piles: no bearing-pressure surface and no "R = ΣV" arrow. Per row an arrow at x_i under the footing (up in compression, down in uplift),
  labelled "Row i: P = … kip/pile, q = … k/ft", and one horizontal arrow "h = H/N = … kip/pile (lateral, every pile)" toward the heel; in the
  layer "Pile reactions" (the 'bearing' layer, relabelled on piles). Values: `r.pile.comb[k].L` (Pile Step 2).
- Title on piles (`rw3TitlePile`): the pile combination, "pile reactions per row as the pile analysis computes them" (service / factored),
  the arrows unfactored or factored with the check line, and a link to Pile Step 2.
- Report overview figure caption on piles: "the governing pile compression combination (…) with its pile reactions per row".
### Check case
- Default wall, pile mode, ACI (2 rows 1.5 / 11.0 ft, s 6 ft): GOV = D + H + L; Row 1 P = 59.7, Row 2 P = 56.6 kip/pile; h = 13.50 kip/pile;
  factored arrows: Σγ·V = 19395 lb/ft = V ✓, Σγ·M = 118751 = V·x_R ✓ (x_R = 6.12 ft). These are Pile Step 2's numbers.
### How verified
- origin/main vs branch, the 12 audit walls (spread): `_R`, Export JSON, autosave, Report, tab texts and DXF identical; the 3D title text of
  every "Show" option, unfactored and factored, identical on an ACI and an AASHTO (collision, water, k_h) spread wall.
- Pile mode: every option of the list run unfactored and factored, the check lines above; screenshot of the 3D view (3 rows).
- `check-syntax`; `retaining-wall-checks`; `phone-layout --tool rwall --w 390,768`; `project-library --tool retwall`; `dxf-print-sheets --tool rw`.
### Open items
- **Decision (pending engineer review):** Extreme Event I and Extreme Event II (minimum vertical) pile combinations offer unfactored arrows only (no factor map in the tool for those sets); their pile reactions are shown as computed.

### Before / after (code, `git diff -U0` of `Retaining Wall Designer.html`)
```diff
+/* RWPL (2026-11-07, Phase 8 3D): on a pile-supported footing the combinations of the 3D view are the pile analysis' own
+   (r.pile.comb, Stability tab, Pile Step 2): V (lb/ft) at x_R, with the pile reactions per row; no soil base reaction. */
+const rw3IsPile = r => !!(r && r.pile && !r.pile.err && r.pile.comb && r.pile.comb.length);
+function rw3PileCombos(r) {
+  const P = r.pile;
+  return { list: P.comb.map(c => ({ key: c.key, name: c.label, kind: 'pile', V: c.V * 1000, xR: c.xR, e: r.B / 2 - c.xR, pile: c })), gov: P.govC ? P.govC.key : P.comb[0].key };
+}
+/* the load factors of a pile combination for the factored arrows (RW3F), or null (arrows unfactored only):
+   AASHTO: Strength I max / min and Extreme Event II max are the bearing sets' own V and x_R (8c), so their definitions apply
+   (rw3Factors 's1', 's1a', 'ee2'); Extreme Event I and Extreme Event II min have no factor map here.
+   ACI / IBC: the service combinations of rwPileAnalysis (ASCE 7-16 §2.4.1): D + H + L (all loads × 1.0), + 0.7E, and
+   0.6D + H (0.6 on the dead loads and on the vertical earth thrust, water uplift 1.0, no surcharge or column L / S), + 0.7E. */
+function rw3PileFactors(r, key) {
+  if (r.isAASHTO) { const m = { str_max: 's1', str_min: 's1a', ee2_max: 'ee2' }[key]; return m ? rw3Factors(r, m) : null; }
+  const E = r.hasSeismic ? 0.7 : 0, all = { EH: 1, EHv: 1, ES: 1, WA: 1, UP: 1, SV: 1, DC: 1, EV: 1, PP: 0 };
+  const min6 = { EH: 1, EHv: 0.6, ES: 1, WA: 1, UP: 1, SV: 0, DC: 0.6, EV: 0.6, PP: 0 };
+  const colMin = r.hasCol ? { v: 0.6 * (r.inp.col_DL + Math.min(0, r.inp.col_WL || 0)) * 1000 / r.inp.col_Ldist, how: '0.6 × (column dead load + any wind uplift)' } : null;
+  if (key === 's1') return { def: 'D + H + L (service)', f: { ...all, EQ: 0 }, col: r.hasCol ? { v: r.W_col, how: 'the service column load' } : null };
+  if (key === 's2') return { def: 'D + H + L + 0.7E', f: { ...all, EQ: E }, col: r.hasCol ? { v: r.W_col, how: 'the service column load' } : null };
+  if (key === 's3') return { def: '0.6D + H', f: { ...min6, EQ: 0 }, col: colMin };
+  if (key === 's4') return { def: '0.6D + 0.7E + H', f: { ...min6, EQ: E }, col: colMin };
+  return null;
+}
-  const C = (typeof rwbpCombos === 'function') ? rwbpCombos(r) : { list: [], gov: null };
+  const pm = rw3IsPile(r);   // RWPL
+  const C = pm ? rw3PileCombos(r) : (typeof rwbpCombos === 'function') ? rwbpCombos(r) : { list: [], gov: null };
-  const o = [['Governing', [['GOV', '★ Governing bearing combination' + (g ? ': ' + g.name.replace(/ — .*$/, '') : '')]]]];
+  const o = [['Governing', [['GOV', (pm ? '★ Governing pile compression combination' : '★ Governing bearing combination') + (g ? ': ' + g.name.replace(/ — .*$/, '') : '')]]]];
-  o.push(['Combinations (base reaction and bearing pressure)', C.list.map(x => ['C:' + x.key, (x.key === C.gov ? '★ ' : '') + x.name])]);
+  o.push([pm ? 'Combinations (pile reactions per row)' : 'Combinations (base reaction and bearing pressure)', C.list.map(x => ['C:' + x.key, (x.key === C.gov ? '★ ' : '') + x.name])]);
-  const svc = C.list.find(x => x.key === 'svc');
-  if (sel === 'ALL') return { sel, cases, combo: svc || null, comboNote: 'service (unfactored)' };
+  const pm = rw3IsPile(r), svc = C.list.find(x => x.key === (pm ? 's1' : 'svc') && (!pm || !r.isAASHTO));   // RWPL: on piles, ACI D + H + L (service); AASHTO none
+  if (sel === 'ALL') return { sel, cases, combo: svc || null, comboNote: pm ? 'service combination D + H + L' : 'service (unfactored)' };
-  const F = rw3Factors(r, k);
+  const F = pm ? rw3PileFactors(r, k) : rw3Factors(r, k);   // RWPL
+  if (rw3IsPile(r)) return rw3TitlePile(r, S, unit);   // RWPL: pile-supported footing
+/* RWPL (2026-11-07): the 3D title on a pile-supported footing (pile combinations, pile reactions per row; no soil base reaction) */
+function rw3TitlePile(r, S, unit) {
+  const sign = 'Arrows point the way each load acts on the wall: earth, surcharge, water, seismic and collision toward the toe; weights down; uplift up; passive toward the heel. Pile reactions act on the footing: up in compression, down in uplift (tension), and toward the heel against the lateral load.';
+  const c = S.combo, cmb = c ? `<b>${c.name}</b>` : '';
+  let what;
+  if (S.sel.startsWith('CASE:')) what = `<b>${S.cases[0] ? S.cases[0].name : ''}</b>: unfactored. No pile reactions are shown for a single load case.`;
+  else if (S.sel === 'ALL') what = `<b>All load cases</b>, unfactored` + (c ? `; pile reactions per row for the ${S.comboNote} (${c.name}).` : '; no pile reactions (every pile combination in AASHTO mode is factored: choose one in the list).');
+  else if (S.fac) {
+    const X = S.FX, F = S.F, tol = v => 1e-6 * Math.max(1, Math.abs(v));
+    const okV = Math.abs(X.V - c.V) <= tol(c.V), okM = Math.abs(X.M - c.V * c.xR) <= tol(c.V * c.xR) * 10;
+    what = `${S.gov ? '<b>Governing</b> pile compression combination: ' : ''}${cmb}. <b>Load arrows: factored</b>, each load case × its load factor γ in this combination, read from the analysis' definition of ${F.def}${F.eta != null && F.eta !== 1 ? ` (γ includes η = ${f(F.eta, 3)})` : ''}; pile reactions per row as the pile analysis computes them.`
+      + (X.omit.length ? ` Not in this combination's vertical resultant: ${X.omit.join(', ')}.` : '')
+      + `<div class="c3d-sign">Check: Σγ·V of the arrows = ${f(X.V, 0)} lb/ft vs V = ${f(c.V, 0)} lb/ft ${okV ? '✓' : '✗'}; Σγ·M about the toe = ${f(X.M, 0)} vs V·x_R = ${f(c.V * c.xR, 0)} lb·ft/ft ${okM ? '✓' : '✗'}.</div>`;
+  }
+  else what = `${S.gov ? '<b>Governing</b> pile compression combination: ' : ''}${cmb}: pile reactions per row (kip per pile) as the pile analysis computes them${r.isAASHTO ? ' (factored)' : ' (service loads)'}; <b>load arrows: unfactored</b>, the load cases${S.F ? ' (choose Factored to see them × this combination\'s load factors)' : ' (no factor map for this combination: the arrows stay unfactored)'}.`;
+  return `<div>${what}</div><div class="c3d-sign">${unit} ${sign} Worked on the Stability tab (<a class="wkA" href="#" data-card="stabPile">pile reactions</a>).</div>`;
+}
-  if (c) {
+  if (c && c.kind === 'pile') {   // RWPL (2026-11-07): pile reactions per row (kip per pile) in the 'bearing' layer; no soil base reaction
+    const L = c.pile.L, Pm = Math.max(...L.rows.map(x => Math.abs(x.P)), 1e-9), gb = G.bearing;
+    L.rows.forEach((x, i) => { const len = La * (0.35 + 0.65 * Math.abs(x.P) / Pm), y0 = -0.15;
+      if (x.P >= 0) rw3Arrow(gb, V3(x.x, y0 - len), V3(x.x, y0), '#ffd040');
+      else rw3Arrow(gb, V3(x.x, y0), V3(x.x, y0 - len), '#ffd040');
+      rw3Label(gb, `Row ${i + 1}: P = ${f(x.P, 1)} kip/pile${x.P < 0 ? ' (uplift)' : ''}, q = ${f(x.q, 2)} k/ft`, V3(x.x, y0 - len), '#c0a020'); });
+    const h = L.rows.length ? L.rows[0].h : 0, xh = Math.min(...L.rows.map(x => x.x));
+    if (h > 1e-6) { rw3Arrow(gb, V3(xh - La * 0.6, 0.05), V3(xh, 0.05), '#ffd040'); rw3Label(gb, `h = H/N = ${f(h, 2)} kip/pile (lateral, every pile)`, V3(xh - La * 0.6, 0.05), '#c0a020'); }
+    S.rInfo = `V = ${rw3K(c.V)} at x_R = ${f(c.xR, 2)} ft; P_max = ${f(L.Pmax, 1)} kip, P_min = ${f(L.Pmin, 1)} kip per pile; H = ${f(c.pile.H, 3)} k/ft`;
+  } else if (c) {
-  const t = document.getElementById('c3d-title'); if (t) t.innerHTML = rw3Title(r, S) + (S.rInfo ? `<div class="c3d-sign">Base reaction: ${S.rInfo}.</div>` : '');
+  const t = document.getElementById('c3d-title'); if (t) t.innerHTML = rw3Title(r, S) + (S.rInfo ? `<div class="c3d-sign">${c && c.kind === 'pile' ? 'Pile reactions' : 'Base reaction'}: ${S.rInfo}.</div>` : '');
+  const lb = document.querySelector('#t3d-bearing + span'); if (lb) lb.textContent = rw3IsPile(r) ? 'Pile reactions' : 'Bearing';   // RWPL: the layer holds the pile reactions on piles
-  let gname = ''; try { const C = rwbpCombos(r), g = C.list.find(x => x.key === C.gov); gname = g ? g.name.replace(/ — .*$/, '') : ''; } catch (e) { /* none */ }
+  let gname = ''; try { const C = rw3IsPile(r) ? rw3PileCombos(r) : rwbpCombos(r), g = C.list.find(x => x.key === C.gov); gname = g ? g.name.replace(/ — .*$/, '') : ''; } catch (e) { /* none */ }   // RWPL: on piles, the governing pile combination
-    '3D model tab[[tab:threed| ↗]] at its default view: the governing bearing combination' + (gname ? ' (' + gname + ')' : '') + ' with its base reaction R and bearing pressure, the load cases as unfactored arrows with their values, every layer on, no section cut, the Reset-view camera. Perspective: not to scale; B = ' + rwrN(r.B, 2) + ' ft, H = ' + rwrN(r.H, 2) + ' ft, a ' + rwrN(wallLen3D(r), 0) + ' ft run of wall.');
+    '3D model tab[[tab:threed| ↗]] at its default view: the governing ' + (rw3IsPile(r) ? 'pile compression combination' : 'bearing combination') + (gname ? ' (' + gname + ')' : '') + (rw3IsPile(r) ? ' with its pile reactions per row' : ' with its base reaction R and bearing pressure') + ', the load cases as unfactored arrows with their values, every layer on, no section cut, the Reset-view camera. Perspective: not to scale; B = ' + rwrN(r.B, 2) + ' ft, H = ' + rwrN(r.H, 2) + ' ft, a ' + rwrN(wallLen3D(r), 0) + ' ft run of wall.');
```

## 2026-11-07 — PR: claude/rw-pile-8f — Pile-supported footing, Phase 8f: hand-off with Pile Designer — foundationLoads revision 2 (element.type "wall") sent, pileResults read back with the stale check (RWPX; no change to a computed result unless results are pulled; cross-tool PR with Pile Designer) (PR #1015: https://github.com/mlococo88/All-Structural/pull/1015)

Review Phase 8, PR 8f, following the abutment calculator's contract (HANDOFF.md §4.6 revision 2, §4.10; ABPX / PXR / PXR2). Code sites tagged `RWPX`. Cross-tool connection: Pile Designer (BY list, one label) and HANDOFF.md change in the same PR (CLAUDE.md §7 exception).
### RWPX-1. Engine (new `<script>` before `</body>`, between the markers `/* RWPX-ENGINE-BEGIN */` … `/* RWPX-ENGINE-END */`; run in Node by tests/engine/handoffs.test.mjs)
- `rwpxSegment(rows)`: the segment length L sent = the least common multiple of the row spacings (to 1/100 in) when ≤ 120 ft (exact: every row has L/s piles), else 120 ft rounded down to a multiple of the largest spacing.
- `rwpxLayout(r, L)`: the piles of the segment (row i at x = B/2 − x_i, + toward the toe; y = s/2 + k·s − L/2), group properties by `SharedPileGroup.groupProps`.
- `rwpxCases`: per pile combination (r.pile.comb): P = V·L, Vx = H·L, Vy = 0, My = P(x̄_d − x_R), Mx = −P·ȳ; `pileP` by `SharedPileGroup.reaction`.
- `rwpxDesign`: per combination the rows with the largest and smallest per-ft pile load: P (the wall's value), h = H/N, pinned.
- `rwpxBuild(r, meta)`: the payload (element.type "wall", revision 2, pileLayout, pileDesign, contentHash); `rwpxHash`: the abutment's FNV-1a rule.
- `rwpxStatus(basis, cur, sent)`, `rwpxPlan(r, res, cur, sent)`: the stale check and what a pileResults payload sets (AASHTO: pile_Rn, pile_phic, pile_Rnup, pile_phiup from `geotechnical.static`; ACI: nothing) and the per-combination match (by `source.caseId` "<key>:compression", else a Group row of that name).
### RWPX-2. UI and saved data
- Foundation card (pile mode): "Send to Pile Designer", "Pull pile results", "Import pile results (JSON)", status line (`#pxr_status`), hidden field `pile_pxr` (the record; in `RWLS_DEF` with default '', so it is saved only when filled: every other project saves, autosaves and exports byte-identical).
- `onInputChange`: `r = rwpxCheck(inp, calcAll(inp))`: with a record and pile results, the status is re-checked; **STALE**: every imported input still holding its imported value is computed with its `prev` value (calcAll re-run with those values in `inp.fnd`), with a warning; the inputs keep the imported values. `r.pxr` = {status, why, producedAt, fields, cases} only when a record exists.
- Report, "Pile-supported footing" › Pile data: a source note (status, imported values; "not used while stale").
### Check case (end-to-end smoke, AASHTO default wall on piles, t_f 36 in, 2 rows 1.5 / 11.0 ft, s 6 ft)
- Segment 6 ft (one spacing), 2 piles; Σ pileP = P per case; each pileDesign compression P = the wall's Pile Step 2 P_max of that combination (to 0.0006 kip).
- Pile Designer: per-pile check "every pile's reaction … equals … to within 0.0005 kip"; static R_n = 123.70 kip, φ = 0.70 sent back; content hash echoed.
- Wall after Import: R_n = 123.70, φ_c = 0.70 used, CURRENT. Stem height + 1 ft: STALE, the calculation uses R_n = 300, φ_c = 0.65 (before the import), the input still shows 123.70. Height back: CURRENT.
- Engine test (3 rows x = 1.5 / 6 / 11 ft, s = 6 / 6 / 8 ft): N = 0.45833 /ft, x̄ = 5.72727 ft, L = 24 ft, 11 piles; every pile = its row's per-ft P.
### How verified
- `node tests/engine/run.mjs handoffs pile-group` (3 new tests), `node tests/smoke/retwall-pile-handoff.mjs` (new; RW → Pile Designer → RW), `check-syntax`, `retaining-wall-checks`, `phone-layout --tool rwall --w 390,768`, `project-library --tool retwall,abutment,pile`, `dxf-print-sheets --tool rw`, `pile-library`.
- origin/main vs branch, the 12 audit walls (spread) and 2 pile walls without a pull: `_R`, Export JSON, autosave, Report, tab texts, DXF identical.
### Open items
- **Decision (pending engineer review):** ACI / IBC mode sends service (ASD) cases (factored:false) and imports nothing back (Pile Designer's LRFD R_n, φ cannot be turned into allowable P_a without a factor of safety the tool does not have); the values are listed for reference.
- **Decision (pending engineer review):** H_r is not imported (Pile Designer gives p-y results and checks per case, not a lateral resistance); its per-case M_max and pass / fail are listed in the pull dialog for reference.
- **Decision (pending engineer review):** the static R_n and φ are imported (not the field-method R_n,req); the abutment offers the choice.
- The H-pile section is not adopted by Pile Designer (the wall has no d, b_f, t_f, t_w).
- 8g (battered piles): not done; suggested feature.

### Before / after (code, `git diff -U0` of `Retaining Wall Designer.html`)
```diff
+    <!-- RWPX (2026-11-07, Phase 8f): hand-off with Pile Designer (HANDOFF.md §4.6 / §4.10); pile_pxr = the pulled-results record (saved only when filled) -->
+    <div class="pile-only" style="display:none;margin-top:6px">
+      <div style="display:flex;flex-wrap:wrap;gap:6px">
+        <button type="button" class="btn" id="pxr_send" onclick="rwpxSendOpen()" title="Send the pile combinations, a wall segment of the pile rows and the per-pile governing loads to Pile Designer (channel foundationLoads)">Send to Pile Designer</button>
+        <button type="button" class="btn" id="pxr_pull" onclick="rwpxPullOpen()" title="Pull Pile Designer's results (channel pileResults): R_n and φ, and per combination its p-y results; with the stale check">Pull pile results</button>
+        <label class="btn" style="cursor:pointer" title="Import a pile-results hand-off file exported by Pile Designer">Import pile results (JSON)<input type="file" accept=".json,application/json" style="display:none" onchange="rwpxImportFile(this)"></label>
+      </div>
+      <div class="hint" id="pxr_status"></div>
+      <textarea id="pile_pxr" style="display:none" aria-hidden="true" tabindex="-1"></textarea>
+    </div>
-  // RWPC (2026-11-07): pressure at x of a factored trapezoid with eccentricity e and resultant x̄ from the toe. Full contact
-  // (|e| ≤ B/6): the linear q_at, unchanged. Partial contact: the triangular block of length 3x̄ from the toe (or 3(B − x̄) from
-  // the heel end); it was interpolated linearly over the whole base B, which overstated the pressure under the heel.
-  function q_blk(x, qt, qh, e, xR) {
-    if (Math.abs(e) <= B / 6) return q_at(x, qt, qh);
-    if (e > 0) { const Lc = 3 * xR; return Lc > 0 && x < Lc ? qt * (1 - x / Lc) : 0; }
-    const Lc = 3 * (B - xR); return Lc > 0 && x > B - Lc ? qh * (1 - (B - x) / Lc) : 0;
-  }
-  const quf_front = q_blk(x_front, qu_toe, qu_heel, e_u, x_Ru);   // RWPC: was q_at (linear over B also in partial contact)
-  const quf_back  = q_blk(x_back,  qu_toe, qu_heel, e_u, x_Ru);
+  const quf_front = q_at(x_front, qu_toe, qu_heel);
+  const quf_back  = q_at(x_back,  qu_toe, qu_heel);
-  const quf_front_min = q_blk(x_front, qu_toe_min, qu_heel_min, e_u_min, x_Ru_min);   // RWPC
-  const quf_back_min  = q_blk(x_back,  qu_toe_min, qu_heel_min, e_u_min, x_Ru_min);
+  const quf_front_min = q_at(x_front, qu_toe_min, qu_heel_min);
+  const quf_back_min  = q_at(x_back,  qu_toe_min, qu_heel_min);
-    const quA_front = q_blk(x_front, quA_toe, quA_heel, e_tot, x_R_tot);   // RWPC: was linear over B also in partial contact
-    const quA_back  = q_blk(x_back,  quA_toe, quA_heel, e_tot, x_R_tot);
-    const M_net_tot = Mr_str_max_tot - Mo_str_max;                          // RWPC: net moment about the toe (for the member pieces)
+    const quA_front = quA_toe + (quA_heel - quA_toe) * (x_front / B);
+    const quA_back  = quA_toe + (quA_heel - quA_toe) * (x_back  / B);
-    const quIa_front = q_blk(x_front, quIa_toe, quIa_heel, e_Ia, x_R_Ia);   // RWPC
-    const quIa_back  = q_blk(x_back,  quIa_toe, quIa_heel, e_Ia, x_R_Ia);
-    const M_net_Ia   = Mr_str_min_tot - Mo_str_max;                        // RWPC
+    const quIa_front = quIa_toe + (quIa_heel - quIa_toe) * (x_front / B);
+    const quIa_back  = quIa_toe + (quIa_heel - quIa_toe) * (x_back  / B);
-      V_str_min_tot, e_Ia, quIa_toe, quIa_heel, quIa_front, quIa_back, M_net_tot, M_net_Ia, x_R_Ia,   // RWPC: + net moments, x̄_Ia
+      V_str_min_tot, e_Ia, quIa_toe, quIa_heel, quIa_front, quIa_back,
-      upWarn.push(`${lbl}${g ? `, water uplift at γ_U = ${g}` : ''}: ${kind === 'none' ? 'the factored uplift exceeds the vertical load (no soil reaction)' : 'the soil resultant falls outside the base (no equilibrium with the soil in compression)'}. The footing is designed with the soil reaction ${kind === 'outToe' ? 'concentrated at the toe tip' : 'taken as zero on that member'} (conservative); review the proportions or the water level.`);
+      upWarn.push(`${lbl}, water uplift at γ_U = ${g}: ${kind === 'none' ? 'the factored uplift exceeds the vertical load (no soil reaction)' : 'the soil resultant falls outside the base (no equilibrium with the soil in compression)'}. The footing is designed with the soil reaction ${kind === 'outToe' ? 'concentrated at the toe tip' : 'taken as zero on that member'} (conservative); review the proportions or the water level.`);
-  // RWPC (2026-11-07): without the water split (ACI without water; AASHTO Strength I / Ia), a combination whose resultant lies
-  // beyond the kern (|e| > B/6) loads the heel and toe with the triangular soil block of length 3x̄ (γ_U = 0: no uplift taken
-  // out), worked as RWUP pieces. Full contact keeps the linear trapezoid (unchanged).
-  const pcV = isAASHTO ? [[aashtoR.V_str_max_tot, aashtoR.M_net_tot, aashtoR.e_tot, 'Strength I'], [aashtoR.V_str_min_tot, aashtoR.M_net_Ia, aashtoR.e_Ia, 'Strength Ia']]
-                       : [[SumVu, Msu - Mou, e_u, 'U = 1.2D + 1.6H'], [SumVu_min, Msu_min - Mou, e_u_min, 'U = 0.9D + 1.6H']];
-  const pcS = (upS || pileFtg) ? [null, null] : pcV.map(([V, M, e, c]) => Math.abs(e) > B / 6
-    ? { heel: rwUpMember(rwUpSplit(V, M, 0, 'Heel, ' + c), x_back, B), toe: rwUpMember(rwUpSplit(V, M, 0, 'Toe, ' + c), x_front, 0) } : null);
-  if (!upS) upWarn.forEach(w => warnings.push('Footing (partial contact): ' + w));
-  const hcMax = heelCase(gEV, gDC, gES, gLS, bq_back, bq_heel, upS ? upS.heelMax : pcS[0] ? pcS[0].heel : null, pileFtg && pileFtg.cmax);   // RWUP, RWPL; RWPC
-  const hcMin = isAASHTO ? heelCase(1.00, 0.90, 0.75, 0, bqm_back, bqm_heel, pcS[1] ? pcS[1].heel : null, pileFtg && pileFtg.cmin)
-                         : heelCase(0.9, 0.9, 0, 0, bqm_back, bqm_heel, upS ? upS.heelMin : pcS[1] ? pcS[1].heel : null, pileFtg && pileFtg.cmin);
+  const hcMax = heelCase(gEV, gDC, gES, gLS, bq_back, bq_heel, upS ? upS.heelMax : null, pileFtg && pileFtg.cmax);   // RWUP, RWPL
+  const hcMin = isAASHTO ? heelCase(1.00, 0.90, 0.75, 0, bqm_back, bqm_heel, null, pileFtg && pileFtg.cmin)
+                         : heelCase(0.9, 0.9, 0, 0, bqm_back, bqm_heel, upS ? upS.heelMin : null, pileFtg && pileFtg.cmin);
-  const tcMax = toeCase(bq_front, bq_toe, upS ? upS.toeMax : pcS[0] ? pcS[0].toe : null, pileFtg && pileFtg.cmax), tcMin = toeCase(bqm_front, bqm_toe, upS ? upS.toeMin : pcS[1] ? pcS[1].toe : null, pileFtg && pileFtg.cmin);   // RWUP, RWPL; RWPC
+  const tcMax = toeCase(bq_front, bq_toe, upS ? upS.toeMax : null, pileFtg && pileFtg.cmax), tcMin = toeCase(bqm_front, bqm_toe, upS ? upS.toeMin : null, pileFtg && pileFtg.cmin);   // RWUP, RWPL
-  h += eq(Math.abs(r.e_u) > r.B / 6 ? 'Factored bearing at stem faces (partial contact: triangular block of length 3x̄ from the ' + (r.e_u > 0 ? 'toe' : 'heel end') + ')' : 'Factored bearing at stem faces (linear interpolation)',   // RWPC
+  h += eq('Factored bearing at stem faces (linear interpolation)',
-  const nw = !(sp.g > 0);   // RWPC (2026-11-07): no water split — partial contact of the factored soil reaction only
-  if (nw) st.push({ id: 'Vs', label: 'Factored vertical load, ' + sp.combo + ': its resultant lies outside the kern (|e| > B/6), so the soil reaction is a triangular block, not the whole-base trapezoid', sym: r.isAASHTO ? 'V_{u}' : '\\Sigma V_{u}', eq: '', sub: '', value: sp.Vs, unit: 'lb/ft', d: 0,
-    note: 'V and its moment about the toe from the ' + sp.combo + ' trapezoid (' + (r.isAASHTO ? 'Footing design tab, factored loads' : 'Stability tab, Step 7') + ').' });
-  else st.push({ id: 'Vs', label: 'Soil reaction without the water: ' + sp.combo + ' less the uplift at γ_U = ' + g + ' (ACI 318-19 §5.3.8(' + (isToe ? 'a): the uplift adds to the toe’s upward bending' : 'b): the uplift is permanent and counteracts the heel’s downward load') + ')',
+  st.push({ id: 'Vs', label: 'Soil reaction without the water: ' + sp.combo + ' less the uplift at γ_U = ' + g + ' (ACI 318-19 §5.3.8(' + (isToe ? 'a): the uplift adds to the toe’s upward bending' : 'b): the uplift is permanent and counteracts the heel’s downward load') + ')',
-  if (sp.Vs > 0 && nw) st.push({ id: 'xs', label: 'Location of the resultant from the toe (M_u = resisting less overturning moment about the toe)', sym: '\\bar{x}', eq: '\\frac{M_{u}}{V_{u}}', sub: '\\frac{' + n(sp.M, 0) + '}{' + n(sp.Vs, 0) + '}', value: sp.xs, unit: 'ft', d: 3 });
-    if (!nw) st.push({ id: 'xs', label: 'Location of the soil reaction from the toe (M_u = resisting less overturning moment about the toe)', sym: '\\bar{x}_{s}', eq: '\\frac{M_{u} \\minus \\gamma_{U} U x_{U}}{V_{s}}', sub: '\\frac{' + n(sp.M, 0) + ' \\minus ' + g + '(' + n(U, 0) + ')(' + n(r.x_uplift, 3) + ')}{' + n(sp.Vs, 0) + '}', value: sp.xs, unit: 'ft', d: 3 });
+    st.push({ id: 'xs', label: 'Location of the soil reaction from the toe (M_u = resisting less overturning moment about the toe)', sym: '\\bar{x}_{s}', eq: '\\frac{M_{u} \\minus \\gamma_{U} U x_{U}}{V_{s}}', sub: '\\frac{' + n(sp.M, 0) + ' \\minus ' + g + '(' + n(U, 0) + ')(' + n(r.x_uplift, 3) + ')}{' + n(sp.Vs, 0) + '}', value: sp.xs, unit: 'ft', d: 3 });
-  if (!nw) st.push({ id: 'uw', label: 'Water pressure on the underside at γ_U = ' + g + (r.upliftTri ? ' (triangular: 0 at the toe, this value at the heel end)' : ' (uniform)'), sym: '\\gamma_{U}\\gamma_{w}h_{w}', eq: '', sub: g + '(' + n(r.gamma_w, 1) + ')(' + n(r.hw, 2) + ')', value: sp.uwB, unit: 'psf', d: 1 });
+  st.push({ id: 'uw', label: 'Water pressure on the underside at γ_U = ' + g + (r.upliftTri ? ' (triangular: 0 at the toe, this value at the heel end)' : ' (uniform)'), sym: '\\gamma_{U}\\gamma_{w}h_{w}', eq: '', sub: g + '(' + n(r.gamma_w, 1) + ')(' + n(r.hw, 2) + ')', value: sp.uwB, unit: 'psf', d: 1 });
-  if (nw) st.push({ id: 'q0', label: 'Upward soil pressure at the stem face', sym: 'q(0)', eq: '', sub: '', value: up.q0, unit: 'psf', d: 1 },
-    { id: 'qL', label: 'Upward soil pressure at the ' + (isToe ? 'toe' : 'heel') + ' tip', sym: 'q(' + Ls + ')', eq: '', sub: '', value: up.qL, unit: 'psf', d: 1 });
-  else st.push({ id: 'q0', label: 'Upward pressure at the stem face: soil + water', sym: 'q(0)', eq: 'q_{s}(0) + \\gamma_{U}u(0)', sub: n(up.q0s, 1) + ' + ' + n(ws0, 1), value: up.q0, unit: 'psf', d: 1 });
-  if (!nw) st.push({ id: 'qL', label: 'Upward pressure at the ' + (isToe ? 'toe' : 'heel') + ' tip: soil + water', sym: 'q(' + Ls + ')', eq: 'q_{s}(' + Ls + ') + \\gamma_{U}u(' + Ls + ')', sub: n(up.qLs, 1) + ' + ' + n(wsL, 1), value: up.qL, unit: 'psf', d: 1 });
+  st.push({ id: 'q0', label: 'Upward pressure at the stem face: soil + water', sym: 'q(0)', eq: 'q_{s}(0) + \\gamma_{U}u(0)', sub: n(up.q0s, 1) + ' + ' + n(ws0, 1), value: up.q0, unit: 'psf', d: 1 });
+  st.push({ id: 'qL', label: 'Upward pressure at the ' + (isToe ? 'toe' : 'heel') + ' tip: soil + water', sym: 'q(' + Ls + ')', eq: 'q_{s}(' + Ls + ') + \\gamma_{U}u(' + Ls + ')', sub: n(up.qLs, 1) + ' + ' + n(wsL, 1), value: up.qL, unit: 'psf', d: 1 });
-  if (!nw) st.push({ id: 'Mw', label: 'Moment of the water pressure about the stem face (q_a = ' + n(up.water.qa, 1) + ' psf at the face, q_b = ' + n(up.water.qb, 1) + ' psf at the tip)', sym: 'M_{water}', eq: pf(up.water), sub: psub(up.water), value: up.Mw, unit: 'lb-ft/ft', d: 1, note: 'F_water = ' + n(up.Fw, 1) + ' lb/ft' });
-  if (nw) st.push({ id: 'Mup', label: 'Moment of the upward pressure about the stem face', sym: 'M_{up}', eq: 'M_{soil}', sub: '', value: up.M, unit: 'lb-ft/ft', d: 1, note: 'F_up = ' + n(up.F, 1) + ' lb/ft' });
-  else st.push({ id: 'Mup', label: 'Moment of the upward pressure about the stem face', sym: 'M_{up}', eq: 'M_{soil} + M_{water}', sub: n(up.Ms, 1) + ' + ' + n(up.Mw, 1), value: up.M, unit: 'lb-ft/ft', d: 1, note: 'F_up = F_soil + F_water = ' + n(up.F, 1) + ' lb/ft' });
+  st.push({ id: 'Mw', label: 'Moment of the water pressure about the stem face (q_a = ' + n(up.water.qa, 1) + ' psf at the face, q_b = ' + n(up.water.qb, 1) + ' psf at the tip)', sym: 'M_{water}', eq: pf(up.water), sub: psub(up.water), value: up.Mw, unit: 'lb-ft/ft', d: 1, note: 'F_water = ' + n(up.Fw, 1) + ' lb/ft' });
+  st.push({ id: 'Mup', label: 'Moment of the upward pressure about the stem face', sym: 'M_{up}', eq: 'M_{soil} + M_{water}', sub: n(up.Ms, 1) + ' + ' + n(up.Mw, 1), value: up.M, unit: 'lb-ft/ft', d: 1, note: 'F_up = F_soil + F_water = ' + n(up.F, 1) + ' lb/ft' });
-  const r = IE.E.length ? { inp, errors: IE.E.map(e => e[1]), warnings: [], fatal: true, inputErrors: IE.E } : calcAll(inp);   // RWIE: no results while an input is in error
+  const r = IE.E.length ? { inp, errors: IE.E.map(e => e[1]), warnings: [], fatal: true, inputErrors: IE.E } : (typeof rwpxCheck === 'function' ? rwpxCheck(inp, calcAll(inp)) : calcAll(inp));   // RWIE: no results while an input is in error   // RWPX: the Pile Designer stale check
+  if (typeof rwpxPaint === 'function') rwpxPaint(r);   // RWPX
-    const ip0 = x => ['q_{u,toe} + (q_{u,heel} \\minus q_{u,toe})\\frac{x}{B}', rwrN(qt, 1) + ' + (' + rwrN(qh, 1) + ' \\minus ' + rwrN(qt, 1) + ')\\frac{' + rwrN(x, 2) + '}{' + Bs + '}'];
-    // RWPC (2026-11-07): partial contact — the face values come from the triangular block of length 3x̄ (was the whole-base interpolation)
-    const ip = x => kern !== false ? ip0(x) : e > 0
-      ? (x < 3 * xR ? ['q_{u,toe}\\left(1 \\minus \\frac{x}{3\\bar{x}}\\right)', rwrN(qt, 1) + '\\left(1 \\minus \\frac{' + rwrN(x, 2) + '}{3(' + rwrN(xR, 4) + ')}\\right)'] : ['0\\;(x \\ge 3\\bar{x})', ''])
-      : (x > B - 3 * (B - xR) ? ['q_{u,heel}\\left(1 \\minus \\frac{B \\minus x}{3(B \\minus \\bar{x})}\\right)', rwrN(qh, 1) + '\\left(1 \\minus \\frac{' + Bs + ' \\minus ' + rwrN(x, 2) + '}{3(' + Bs + ' \\minus ' + rwrN(xR, 4) + ')}\\right)'] : ['0\\;(x \\le B \\minus 3(B \\minus \\bar{x}))', '']);
+    const ip = x => ['q_{u,toe} + (q_{u,heel} \\minus q_{u,toe})\\frac{x}{B}', rwrN(qt, 1) + ' + (' + rwrN(qh, 1) + ' \\minus ' + rwrN(qt, 1) + ')\\frac{' + rwrN(x, 2) + '}{' + Bs + '}'];
-    const upR = (up, mem) => up ? rwUpSteps(r, up, mem).map(o => rwrS(Object.assign({}, o, { id: 'u' + o.id, ref: o.id === 'Vs' && r.upS ? 'ACI 318-19 §5.3.8' : '' }))) : null;   // RWUP; RWPC: no §5.3.8 without the split
+    const upR = (up, mem) => up ? rwUpSteps(r, up, mem).map(o => rwrS(Object.assign({}, o, { id: 'u' + o.id, ref: o.id === 'Vs' ? 'ACI 318-19 §5.3.8' : '' }))) : null;   // RWUP
-      { title: 'Heel Step 4 — Shear and development', ref: isA ? AA('Art. 5.7.3') : 'ACI 318-19 Table 22.5.5.1(c)', steps: pre('h4', H4) }], { title: 'Heel' }), { type: 'note', text: (upHr && r.upS ? 'ΣV_u and its moment: [[st7/SumVu]], [[st7/SumVumin]] (the water uplift is split out in Heel Step 1, ACI 318-19 §5.3.8)' : upHr ? 'Partial contact: the soil block is worked in Heel Step 1 (RWPC)' : 'q_u,back and q_u,heel: ' + (isA ? '[[saf/quback]], [[saf/quheel]] (Strength Ia: [[saf/qubackIa]])' : '[[st7/quback]], [[st7/quheel]] (minimum-vertical case: [[st7/qubackmin]])')) + '; ' + (r.heel_min_governs ? 'the minimum-vertical case governs the heel.' : 'the maximum-vertical case governs the heel.') },
+      { title: 'Heel Step 4 — Shear and development', ref: isA ? AA('Art. 5.7.3') : 'ACI 318-19 Table 22.5.5.1(c)', steps: pre('h4', H4) }], { title: 'Heel' }), { type: 'note', text: (upHr ? 'ΣV_u and its moment: [[st7/SumVu]], [[st7/SumVumin]] (the water uplift is split out in Heel Step 1, ACI 318-19 §5.3.8)' : 'q_u,back and q_u,heel: ' + (isA ? '[[saf/quback]], [[saf/quheel]] (Strength Ia: [[saf/qubackIa]])' : '[[st7/quback]], [[st7/quheel]] (minimum-vertical case: [[st7/qubackmin]])')) + '; ' + (r.heel_min_governs ? 'the minimum-vertical case governs the heel.' : 'the maximum-vertical case governs the heel.') },
-      { title: 'Toe Step 4 — Shear and development', ref: isA ? AA('Art. 5.7.3') : 'ACI 318-19 Table 22.5.5.1(c)', steps: pre('t4', T4) }], { title: 'Toe' }), { type: 'note', text: (upTr && r.upS ? 'ΣV_u and its moment: [[st7/SumVu]], [[st7/SumVumin]] (the water uplift is split out in Toe Step 1, ACI 318-19 §5.3.8)' : upTr ? 'Partial contact: the soil block is worked in Toe Step 1 (RWPC)' : 'q_u,front and q_u,toe: ' + (isA ? '[[saf/qufront]], [[saf/qutoe]] (Strength Ia: [[saf/qufrontIa]])' : '[[st7/qufront]], [[st7/qutoe]] (minimum-vertical case: [[st7/qufrontmin]])')) + '; ' + (r.toe_min_governs ? 'the minimum-vertical case governs the toe.' : 'the maximum-vertical case governs the toe.') },
+      { title: 'Toe Step 4 — Shear and development', ref: isA ? AA('Art. 5.7.3') : 'ACI 318-19 Table 22.5.5.1(c)', steps: pre('t4', T4) }], { title: 'Toe' }), { type: 'note', text: (upTr ? 'ΣV_u and its moment: [[st7/SumVu]], [[st7/SumVumin]] (the water uplift is split out in Toe Step 1, ACI 318-19 §5.3.8)' : 'q_u,front and q_u,toe: ' + (isA ? '[[saf/qufront]], [[saf/qutoe]] (Strength Ia: [[saf/qufrontIa]])' : '[[st7/qufront]], [[st7/qutoe]] (minimum-vertical case: [[st7/qufrontmin]])')) + '; ' + (r.toe_min_governs ? 'the minimum-vertical case governs the toe.' : 'the maximum-vertical case governs the toe.') },
+    if (r.pxr) subs[subs.length - 1].items.push({ type: 'note', warn: r.pxr.status === 'stale', text: 'Pile Designer results (Pull pile results, ' + rwpxWhen(r.pxr.producedAt) + '): ' + r.pxr.status.toUpperCase() + ' (' + r.pxr.why + '). ' + (Object.keys(r.pxr.fields).length ? 'Imported: ' + Object.entries(r.pxr.fields).map(([k, v]) => k.replace('pile_', '') + ' = ' + v).join(', ') + (r.pxr.status === 'stale' ? '; not used while stale (the values held before the import are used).' : '.') : 'No input imported (reference only).') });   // RWPX
+<script>
+/* =====================================================================
+   RWPX (2026-11-07, Phase 8f): hand-off with Pile Designer, as the abutment calculator's (HANDOFF.md §4.6 revision 2, §4.10).
+   Sends foundationLoads (copy by.retwall; element.type "wall") with a discrete wall segment of the pile rows (pileLayout), each case's
+   pile reactions (pileP) and the per-pile governing loads (pileDesign); reads pileResults back with the stale check (content hash).
+   Engine (pure, between the RWPX-ENGINE markers; tests/engine/handoffs.test.mjs runs it in Node with shared/pile-group.js):
+   - rwpxSegment(rows): the segment length L (ft) sent: the least common multiple of the row spacings (to 1/100 in), when ≤ 120 ft, so
+     every row has exactly L/s piles and the discrete group gives the per-ft results exactly (N·L piles, x̄, I·L); else 120 ft rounded
+     down to a multiple of the largest spacing ("exact": false; the receiver's distribution then differs slightly from the per-ft one).
+   - rwpxLayout(r, L): the piles of the segment: row i at x = B/2 − x_i (hand-off axes: x + toward the toe, origin at the footing centre),
+     y = s_i/2 + k·s_i − L/2 (y along the wall, origin at the segment centre); group props by SharedPileGroup.groupProps (the abutment's C-8).
+   - rwpxCases(r, Lay): per pile combination of r.pile.comb: P = V·L, Vx = H·L (+ toward the toe; H net of the passive credit as in the
+     pile check), Vy = 0, My = P·(x̄_d − x_R) (+ moves the resultant toward the toe), Mx = −P·ȳ (resultant at mid-segment), about the pile-group
+     centroid; pileP = SharedPileGroup.reaction on the segment layout (the receiver's check of its own distribution).
+   - rwpxDesign(r, Lay): per combination the row with the largest and the smallest per-ft pile load (Pile Step 2), its first pile, P (kip per
+     pile, the wall's own value), lateral share h = H/N, pinned head.
+   - rwpxBuild(r, meta): the payload; rwpxHash(p): FNV-1a of {location, reference, cases, pileLayout without resistance, pileDesign, integral}
+     (the abutment's contentHash rule).
+   - rwpxPlan(r, res, sent, mode): what a pileResults payload would set, the stale status and the per-combination match. */
+/* RWPX-ENGINE-BEGIN */
+function rwpxSegment(rows) {
+  const ss = rows.map(q => Math.round(q.s * 1200));   // spacing in 1/100 in
+  if (!ss.length || ss.some(v => !(v > 0))) return { L: 0, exact: false };
+  const gcd = (a, b) => b ? gcd(b, a % b) : a;
+  let l = ss[0]; for (let i = 1; i < ss.length && l <= 120 * 1200; i++) l = l / gcd(l, ss[i]) * ss[i];
+  if (l <= 120 * 1200) return { L: l / 1200, exact: true };
+  const smax = Math.max(...rows.map(q => q.s)); return { L: Math.max(smax, Math.floor(120 / smax) * smax), exact: false };
+}
+function rwpxLayout(r, L) {
+  const SPG = window.SharedPileGroup, B = r.B, piles = [];
+  r.pile.rows.forEach((q, i) => { for (let y = q.s / 2; y < L - 1e-6; y += q.s) piles.push({ no: piles.length + 1, row: i + 1, x: B / 2 - q.x, y: y - L / 2, active: true }); });
+  const g = SPG.groupProps(piles);
+  return { piles, n: g.n, xgc: g.xgc, ygc: g.ygc, Sxx: g.Sxx, Syy: g.Syy, Sxy: g.Sxy, L };
+}
+const rwpxR3 = v => Math.round((+v || 0) * 1000) / 1000, rwpxR6 = v => Math.round((+v || 0) * 1e6) / 1e6;
+function rwpxLS(c, isA) {
+  if (!isA) return { ls: 'Service (ASD, ASCE 7-16 2.4.1)', fac: false };
+  return { ls: /^ee1/.test(c.key) ? 'Extreme Event I' : /^ee2/.test(c.key) ? 'Extreme Event II' : 'Strength I', fac: true };
+}
+function rwpxCases(r, Lay) {
+  const SPG = window.SharedPileGroup, L = Lay.L, B = r.B, xbd = B / 2 - Lay.xgc;   // x̄ of the segment from the toe
+  return r.pile.comb.map(c => {
+    const P = c.V * L, My = P * (xbd - c.xR), Mx = -P * Lay.ygc, t = rwpxLS(c, r.isAASHTO);
+    return { id: c.key, name: c.label, limitState: t.ls, factored: t.fac, P: rwpxR3(P), Vx: rwpxR3(c.H * L), Vy: 0, Mx: rwpxR3(Mx), My: rwpxR3(My),
+      governs: c.kind === 'max' ? 'maximum vertical' : 'minimum vertical', combination: c.label,
+      pileP: Lay.piles.map(p => rwpxR3(SPG.reaction(P, My, Mx, p.x - Lay.xgc, p.y - Lay.ygc, { n: Lay.n, Sxx: Lay.Sxx, Syy: Lay.Syy, Sxy: Lay.Sxy }))) };
+  });
+}
+function rwpxDesign(r, Lay) {
+  const out = [], first = i => Lay.piles.find(p => p.row === i + 1);
+  r.pile.comb.forEach(c => { const t = rwpxLS(c, r.isAASHTO);
+    [['compression', c.L.iMax], ['uplift', c.L.iMin]].forEach(([role, i]) => { const q = c.L.rows[i], pp = first(i); if (!q || !pp || !isFinite(q.P)) return;
+      const rl = role === 'uplift' && q.P >= 0 ? 'minimum' : role;
+      out.push({ id: c.key + ':' + rl, limitState: t.ls, factored: t.fac, role: rl, pile: pp.no, row: i + 1, x: rwpxR6(pp.x), y: rwpxR6(pp.y),
+        P: rwpxR3(q.P), Vx: rwpxR3(q.h), Vy: 0, V: rwpxR3(Math.abs(q.h)), M: 0, head: 'pinned', DR: 0, gDR: 1.10, combination: c.label }); }); });
+  return out;
+}
+function rwpxHash(p) {
+  const lay = p.pileLayout ? Object.assign({}, p.pileLayout, { resistance: undefined }) : null;
+  const s = JSON.stringify({ location: p.location, reference: p.reference, cases: p.cases, pileLayout: lay, pileDesign: p.pileDesign || null, integral: p.integral || null });
+  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8);
+}
+function rwpxBuild(r, meta) {
+  if (!r || r.fatal) return { err: 'No results: fix the input errors first.' };
+  if (!r.pile || r.pile.err || !r.pile.comb || !r.pile.comb.length) return { err: 'Not a pile-supported footing with pile results (Foundation type: pile-supported).' };
+  if (!window.SharedPileGroup) return { err: 'shared/pile-group.js is not loaded.' };
+  meta = meta || {};
+  const F = r.inp.fnd, isA = r.isAASHTO, seg = rwpxSegment(r.pile.rows), Lay = rwpxLayout(r, seg.L), B = r.B;
+  const shp = { hp: 'hp', pipe: 'round', square: 'square', round: 'round' }[F.shape] || 'hp';
+  const sec = { shape: shp, designation: F.desig || ({ hp: 'H-pile', pipe: 'steel pipe pile', square: 'square precast concrete pile', round: 'round pile' }[F.shape] || 'pile') + ', D = ' + F.D + ' in', size: +F.D || 0, wallShape: F.shape };
+  const cases = rwpxCases(r, Lay);
+  const p = { _schema: 'bridge-foundation-loads', schemaVersion: 1, producer: 'Retaining Wall Designer', producerFile: 'Retaining Wall Designer.html',
+    project: { name: meta.name || '', bridgeId: meta.bridgeId || '' }, units: { force: 'kip', moment: 'kip-ft', length: 'ft' },
+    element: { type: 'wall', label: meta.name || 'Retaining wall', wall: { perFoot: false, segmentLength: rwpxR6(seg.L), exactSegment: seg.exact } },
+    location: 'bottom of pile cap (wall footing), pile-group centroid of a ' + rwpxR3(seg.L) + ' ft wall segment (' + rwpxR3(B / 2 - Lay.xgc) + ' ft from the toe, at mid-segment)',
+    reference: { level: 'bottomOfPileCap', point: 'pileGroupCentroid', fromToe: rwpxR3(B / 2 - Lay.xgc), fromCentreline: 0 },
+    includes: { footingWeight: true, soilOverFooting: true, earthPressure: true },
+    axes: { x: 'horizontal, across the wall, + toward the toe (the direction of the earth thrust)', y: 'horizontal, along the wall, origin at mid-segment' },
+    geometry: { footingWidthB: rwpxR3(B), footingLength: rwpxR3(seg.L), footingThickness: rwpxR3(r.tf_ft) },
+    signConvention: 'P + = downward (compression on the foundation). x = across the wall, + toward the toe; y = along the wall. Vx, Vy = horizontal force on the foundation, + toward +x, +y. My = moment about the y axis, + when it moves the resultant toward +x (toward the toe), so e_x = My/P; Mx + moves it toward +y, so e_y = Mx/P. About the pile-group centroid of the segment, at the bottom of the footing.',
+    cases, revision: 2, notes: [] };
+  p.pileLayout = { units: { coordinates: 'ft', spacing: 'ft', section: 'in', Fy: 'ksi', embedment: 'in', cap: 'ft', resistance: 'kip' },
+    frame: 'the hand-off axes (x + toward the toe, y along the wall), origin at the footing centre line (B/2 from the toe) at mid-segment; the wall\'s own row positions x_i are from the toe, so x here = B/2 − x_i',
+    mode: 'coord', nRows: r.pile.rows.length, nCols: null, rows: r.pile.rows.map((q, i) => ({ row: i + 1, xFromToe: q.x, x: rwpxR6(B / 2 - q.x), spacing: q.s })),
+    piles: Lay.piles.map(q => ({ no: q.no, x: rwpxR6(q.x), y: rwpxR6(q.y), active: true })),
+    n: Lay.n, centroid: { x: rwpxR6(Lay.xgc), y: rwpxR6(Lay.ygc) }, Sxx: rwpxR6(Lay.Sxx), Syy: rwpxR6(Lay.Syy), Sxy: rwpxR6(Lay.Sxy),
+    vertical: true, batter: null, section: sec, embedment: +F.embed || 0, clearTop: +F.clr || 0,
+    cap: { widthX: rwpxR6(B), lengthY: rwpxR6(seg.L), thickness: rwpxR6(r.tf_ft), centre: { x: 0, y: 0 }, fromToeToCentre: rwpxR6(B / 2) },
+    resistance: isA ? { Rn: F.Rn, phiC: F.phic, RnUp: F.Rnup, phiUp: F.phiup, Hr: F.Hr, DR: 0, gDR: 1.10, basis: 'AASHTO LRFD, as entered in the wall' }
+                    : { Rn: null, phiC: null, RnUp: null, phiUp: null, Pa: F.Pa, Ta: F.Ta, Ha: F.Ha, DR: 0, gDR: 1.10, basis: 'allowable (ASD, service loads), as entered in the wall' },
+    distribution: 'rigid cap, identical vertical piles: P_i = P/n + [(My·Σy\'² − Mx·Σx\'y\')·x\'_i + (Mx·Σx\'² − My·Σx\'y\')·y\'_i]/(Σx\'²·Σy\'² − (Σx\'y\')²) about the group centroid; each pile takes Vx/n and Vy/n; pinned heads (no head moment). The wall works per ft of wall (Stability tab, Pile Step 2); ' + (seg.exact ? 'the segment holds exactly L/s piles of every row, so these reactions equal the wall\'s per-ft pile loads.' : 'the segment is not a common multiple of the spacings, so these reactions differ slightly from the wall\'s per-ft pile loads.'),
+    head: 'pinned' };
+  p.pileDesign = { units: { force: 'kip', moment: 'kip-ft', length: 'ft' }, lateralShare: 'equal: each pile takes H/N (per ft of wall: N = Σ1/s_i; the wall\'s assumption), net of the passive credit when ticked',
+    head: { condition: 'pinned', basis: 'the wall\'s rigid-cap distribution gives axial load and an equal shear share with no head moment' }, DR: 0, gDR: 1.10, cases: rwpxDesign(r, Lay) };
+  p.notes.push('Retaining wall on ' + r.pile.rows.length + ' rows of vertical piles, worked per ft of wall (Stability tab, Pile Step 2). Sent as a ' + rwpxR3(seg.L) + ' ft segment with ' + Lay.n + ' piles: P = V·L, Vx = H·L, My about the segment\'s pile-group centroid.');
+  p.notes.push(isA ? 'AASHTO mode: Strength I (maximum / minimum vertical), Extreme Event I and II are factored (factored:true), as the wall\'s pile check.'
+                   : 'ACI / IBC mode: the cases are service (ASD) combinations of ASCE 7-16 §2.4.1 (factored:false), checked in the wall against allowable pile capacities; Pile Designer\'s LRFD resistances are not imported back in this mode (reference only).');
+  p.notes.push('Per-pile governing loads (pileDesign): per combination the row with the largest and the smallest pile load of the wall\'s pile check, P per pile, lateral share h = H/N, pinned head. No drag load is modelled (DR = 0).');
+  p.contentHash = rwpxHash(p);
+  return { p, n: cases.length, seg, Lay };
+}
+/* the stale check of §4.10: basis = the pileResults basis (or the saved record's), cur = the hash of what the wall sends now */
+function rwpxStatus(b, cur, sent) {
+  if (!b || b.producer !== 'Retaining Wall Designer') return { status: 'other', why: 'these results are not based on loads from this wall (' + (b ? b.producer || '?' : 'no foundation-load import') + ')' };
+  if (b.contentHash) return b.contentHash === cur ? { status: 'current', why: 'content ' + cur + ' = what this wall sends now' } : { status: 'stale', why: 'the wall\'s loads or pile layout changed since they were run (content ' + b.contentHash + ' → ' + cur + ')' };
+  if (sent && sent.producedAt && b.producedAt !== sent.producedAt) return { status: 'stale', why: 'based on loads sent ' + b.producedAt + ', not the last sent (' + sent.producedAt + ')' };
+  return { status: 'unchecked', why: 'no content hash: cannot be checked' };
+}
+/* pileResults → what would change. res: the payload; sent: the wall's last sent foundationLoads (by.retwall) or null; cur: the content
+   hash of what the wall would send now. Returns { err } or { status, why, set:[{id, label, from, to}], match:[…] }. */
+function rwpxPlan(r, res, cur, sent) {
+  if (!res || res._schema !== 'bridge-pile-results') return { err: 'Not a pile-results hand-off (' + ((res && res._schema) || 'no _schema') + ').' };
+  if (!(res.schemaVersion <= 1)) return { err: 'Newer pile-results format (v' + res.schemaVersion + ') than this tool reads (v1).' };
+  const u = res.units || {}; if (u.force !== 'kip' || (u.length && u.length !== 'ft')) return { err: 'Pile results units must be kip and ft.' };
+  const { status, why } = rwpxStatus(res.basis || null, cur, sent);
+  const set = [], g = res.geotechnical && res.geotechnical.static, F = r.inp.fnd, num = v => typeof v === 'number' && isFinite(v);
+  if (r.isAASHTO && g && status !== 'other') {
+    if (num(g.Rn) && g.Rn > 0 && num(g.phi) && g.phi > 0 && g.phi <= 1) { set.push({ id: 'pile_Rn', label: 'R_n (compression)', from: F.Rn, to: g.Rn }); set.push({ id: 'pile_phic', label: 'φ_c', from: F.phic, to: g.phi }); }
+    if (num(g.RnUp) && g.RnUp > 0 && num(g.phiUp) && g.phiUp > 0 && g.phiUp <= 1) { set.push({ id: 'pile_Rnup', label: 'R_n,up (uplift)', from: F.Rnup, to: g.RnUp }); set.push({ id: 'pile_phiup', label: 'φ_up', from: F.phiup, to: g.phiUp }); }
+  }
+  const match = (r.pile && r.pile.comb || []).map(c => {
+    const q = (res.cases || []).find(x => x.source && x.source.kind === 'perPile' && x.source.caseId === c.key + ':compression')
+      || (res.cases || []).find(x => x.source && x.source.kind === 'group' && x.source.caseName === c.label && !x.source.uplift);
+    const P = c.L.Pmax, h = c.L.rows.length ? c.L.rows[0].h : 0;
+    if (!q) return { key: c.key, label: c.label, P, h, none: true };
+    const lp = q.loads || {}, py = q.py || {}, ck = q.checks || {};
+    const dP = num(lp.P) ? Math.abs(lp.P - P) : null, dV = num(lp.V) ? Math.abs(lp.V - h) : null, tol = v => 0.01 + 0.001 * Math.abs(v);
+    return { key: c.key, label: c.label, P, h, name: q.name, Ppd: lp.P, Vpd: lp.V, M: py.Mmax, y0: py.y0, pass: ck.pass, differs: (dP != null && dP > tol(P)) || (dV != null && dV > tol(h)) };
+  });
+  return { status, why, set, match, aci: !r.isAASHTO };
+}
+/* RWPX-ENGINE-END */
+</script>
+<script>
+/* RWPX (2026-11-07, Phase 8f) — the hand-off UI: Foundation card buttons, the send / pull dialogs, the saved record (hidden field
+   pile_pxr: saved with the project only when filled, so other projects save as before), and the stale check after each calculation
+   (rwpxCheck, called by onInputChange): while STALE, every imported input that still holds its imported value is computed with the value
+   it held before the import (the abutment's PXR2 rule), with a warning; the inputs keep showing the imported values. */
+RWLS_DEF.pile_pxr = '';   // saved only when filled; an older save has no field and opens with no record
+const RWPX = { NS: 'bridgeSuite.v1.', RID: 'retwall', MAP: { pile_Rn: 'Rn', pile_phic: 'phic', pile_Rnup: 'Rnup', pile_phiup: 'phiup' } };
+function rwpxRec() { try { const v = (document.getElementById('pile_pxr') || {}).value; return v ? JSON.parse(v) : null; } catch (e) { return null; } }
+function rwpxSent() { try { return JSON.parse(localStorage.getItem(RWPX.NS + 'foundationLoads.by.retwall') || 'null'); } catch (e) { return null; } }
+function rwpxMeta() { const sp = window.BridgeXfer && BridgeXfer.sharedProject ? BridgeXfer.sharedProject() : null; return { name: ((document.getElementById('proj_name') || {}).value || '').trim(), bridgeId: (sp && sp.bridgeId) || '' }; }
+const rwpxEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
+const rwpxWhen = iso => { const d = new Date(iso); if (isNaN(d)) return String(iso || '?'); const p = n => (n < 10 ? '0' : '') + n; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
+function rwpxCheck(inp, r) {
+  const rec = rwpxRec(); if (!rec || !r || r.fatal || !r.pile || r.pile.err) return r;
+  let cur = null; try { const b = rwpxBuild(r, rwpxMeta()); cur = b.p ? b.p.contentHash : null; } catch (e) { cur = null; }
+  const st = rwpxStatus(rec.basis || null, cur, rwpxSent());
+  let out = r;
+  if (st.status === 'stale') {
+    const fnd = Object.assign({}, inp.fnd), used = [];
+    Object.entries(rec.fields || {}).forEach(([id, v]) => { const el = document.getElementById(id), k = RWPX.MAP[id];
+      if (k && el && String(el.value) === String(v) && rec.prev && id in rec.prev) { fnd[k] = parseFloat(rec.prev[id]); used.push(id.replace('pile_', '') + ' = ' + rec.prev[id] + ' (imported ' + v + ' not used)'); } });
+    if (used.length) out = calcAll(Object.assign({}, inp, { fnd }));
+    out.warnings.push('Pile Designer results are STALE: ' + st.why + '. ' + (used.length ? 'The calculation uses the values held before the import: ' + used.join('; ') + '. Send the loads to Pile Designer again, run it, and pull the results.' : 'No imported value is in use.'));
+  }
+  out.pxr = { status: st.status, why: st.why, producedAt: rec.producedAt, fields: rec.fields || {}, cases: rec.cases || [] };
+  return out;
+}
+function rwpxPaint(r) {
+  const el = document.getElementById('pxr_status'); if (!el) return;
+  const rec = rwpxRec(), st = r && r.pxr;
+  el.innerHTML = rec ? 'Pile Designer results pulled ' + rwpxEsc(rwpxWhen(rec.producedAt)) + ': <b' + (st && st.status === 'stale' ? ' style="color:#b42318"' : '') + '>' + rwpxEsc(st ? st.status.toUpperCase() : '—') + '</b>' + (st ? ' (' + rwpxEsc(st.why) + ')' : '') + '. ' + (Object.keys(rec.fields || {}).length ? 'Imported: ' + Object.entries(rec.fields).map(([k, v]) => rwpxEsc(k.replace('pile_', '')) + ' = ' + rwpxEsc(v)).join(', ') + '.' : 'No input imported (reference only).') + ' <a href="#" onclick="rwpxClear();return false">Clear</a>' : '';
+}
+function rwpxModal(title, body, btns) {
+  const old = document.getElementById('rwpx-ov'); if (old) old.remove();
+  const ov = document.createElement('div'); ov.id = 'rwpx-ov'; ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 8px';
+  ov.innerHTML = '<div role="dialog" aria-label="' + rwpxEsc(title) + '" style="background:#fff;color:#1c2a42;max-width:760px;width:100%;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.45;box-shadow:0 8px 30px rgba(0,0,0,.3)"><div style="font-weight:700;font-size:15px;margin-bottom:6px">' + rwpxEsc(title) + '</div><div id="rwpx-body" style="overflow-x:auto">' + body + '</div><div id="rwpx-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"></div></div>';
+  document.body.appendChild(ov);
+  const bx = ov.querySelector('#rwpx-btns'); btns.concat([['Cancel', () => ov.remove()]]).forEach(([t, fn]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = t; b.onclick = fn; bx.appendChild(b); });
+  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
+}
+const rwpxTbl = (head, rows) => '<table style="border-collapse:collapse;font-size:12px;margin:6px 0">' + '<tr>' + head.map(h => '<th style="border:1px solid #ccd;padding:2px 6px;text-align:left">' + h + '</th>').join('') + '</tr>' + rows.map(r => '<tr>' + r.map(c => '<td style="border:1px solid #ccd;padding:2px 6px">' + c + '</td>').join('') + '</tr>').join('') + '</table>';
+function rwpxSendOpen() {
+  const b = rwpxBuild(window._R, rwpxMeta()); if (b.err) { alert(b.err); return; }
+  const p = b.p, f = (v, d) => (+v).toFixed(d == null ? 2 : d);
+  const body = '<div>Channel foundationLoads (receiver: Pile Designer, "Pull from Abutment / SubLoads"; copy by.retwall), payload revision 2. '
+    + 'The wall is worked per ft; it is sent as a <b>' + f(b.seg.L, 2) + ' ft segment with ' + b.Lay.n + ' piles</b> (' + p.pileLayout.rows.map(q => 'row ' + q.row + ' at ' + f(q.xFromToe) + ' ft @ ' + f(q.spacing) + ' ft') .join(', ') + ')'
+    + (b.seg.exact ? ', a common multiple of the spacings, so Pile Designer\'s rigid-cap distribution gives the wall\'s pile loads.' : '. <b>Not a common multiple of the spacings</b> (over 120 ft): the receiver\'s distribution differs slightly from the wall\'s per-ft pile loads.') + '</div>'
+    + rwpxTbl(['Case', 'Limit state', 'Factored', 'P (kip)', 'Vx (kip)', 'My (kip-ft)'], p.cases.map(c => [rwpxEsc(c.name), rwpxEsc(c.limitState), c.factored ? 'yes' : 'no (service)', f(c.P, 1), f(c.Vx, 1), f(c.My, 1)]))
+    + '<div>Also sent: the pile layout (' + b.Lay.n + ' piles, ' + rwpxEsc(p.pileLayout.section.designation) + ', embedment ' + f(p.pileLayout.embedment, 1) + ' in, cap ' + f(p.pileLayout.cap.widthX) + ' × ' + f(p.pileLayout.cap.lengthY) + ' × ' + f(p.pileLayout.cap.thickness) + ' ft), each case\'s pile reactions, and '
+    + p.pileDesign.cases.length + ' per-pile governing loads (largest and smallest pile load per combination, lateral share h = H/N, pinned head). Content ' + p.contentHash + '.</div>'
+    + (r_isACI() ? '<div style="color:#8a5a00;margin-top:4px">ACI / IBC mode: the cases are service (ASD) loads; Pile Designer designs by LRFD. Its resistances are shown for reference when pulled back; the allowable capacities stay as entered.</div>' : '');
+  rwpxModal('Send foundation loads to Pile Designer', body, [
+    ['Send to other tools', () => { const res = BridgeXfer.publish('foundationLoads', p, 'Retaining Wall Designer', 'Retaining Wall Designer.html');
+      if (res.error) { alert(res.error); return; }
+      try { localStorage.setItem(RWPX.NS + 'foundationLoads.by.retwall', JSON.stringify(res.payload)); } catch (e) { /* storage full: the channel key holds it */ }
+      document.getElementById('rwpx-ov').remove(); onInputChange(); alert('Sent (' + rwpxWhen(res.payload.producedAt) + '). In Pile Designer: Loads & group tab, "Pull from Abutment / SubLoads".'); }],
+    ['Export hand-off (JSON)', () => { const q = Object.assign({}, p, { producedAt: new Date().toISOString(), notes: p.notes }); _downloadJSON(q, 'foundationLoads_retaining-wall.json'); }]]);
+}
+const r_isACI = () => !(window._R && window._R.isAASHTO);
+function rwpxPullOpen(res, via) {
+  if (!res) { const rd = window.BridgeXfer ? BridgeXfer.read('pileResults', 'bridge-pile-results', 1) : { error: 'no hand-off helper' }; if (rd.error) { alert('Pull pile results: ' + rd.error); return; } res = rd.payload; via = 'storage'; }
+  const r = window._R; if (!r || r.fatal || !r.pile || r.pile.err) { alert('Pull pile results: the wall has no pile results (pile-supported footing, no input errors).'); return; }
+  let cur = null; try { const b = rwpxBuild(r, rwpxMeta()); cur = b.p ? b.p.contentHash : null; } catch (e) { cur = null; }
+  const pl = rwpxPlan(r, res, cur, rwpxSent()); if (pl.err) { alert('Pull pile results: ' + pl.err); return; }
+  const f = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d == null ? 2 : d) : '—';
+  const stc = pl.status === 'stale' ? '#b42318' : pl.status === 'current' ? '#067647' : '#8a5a00';
+  const body = '<div>From <b>' + rwpxEsc(res.producer) + '</b>, ' + rwpxEsc(rwpxWhen(res.producedAt)) + (res.project && res.project.name ? ', project ' + rwpxEsc(res.project.name) : '') + '. Status: <b style="color:' + stc + '">' + pl.status.toUpperCase() + '</b> (' + rwpxEsc(pl.why) + ').</div>'
+    + (pl.set.length ? '<div style="margin-top:6px"><b>Will change</b> (Foundation card):</div>' + rwpxTbl(['Input', 'Now', 'From Pile Designer'], pl.set.map(s => [rwpxEsc(s.label), f(s.from, 4), f(s.to, 4)]))
+      : '<div style="margin-top:6px">No input will change' + (pl.aci ? ' (ACI / IBC mode: the allowable capacities stay as entered; Pile Designer\'s LRFD values are kept for reference)' : pl.status === 'other' ? '' : ' (no static resistance in the results)') + '.</div>')
+    + (pl.status === 'stale' ? '<div style="color:#b42318">While STALE the calculation keeps the values held before the import (the imported values are shown but not used).</div>' : '')
+    + '<div style="margin-top:6px"><b>Per combination</b> (the wall\'s pile check vs the case Pile Designer ran; reference only: the lateral resistance H_r stays as entered):</div>'
+    + rwpxTbl(['Combination', 'P wall (kip)', 'h wall (kip)', 'Pile Designer case', 'P', 'V', 'M_max p-y (kip-ft)', 'Checks'], pl.match.map(m => [rwpxEsc(m.label), f(m.P, 1), f(m.h, 2), m.none ? '<i>not run</i>' : rwpxEsc(m.name) + (m.differs ? ' <b style="color:#b42318">(loads differ)</b>' : ''), f(m.Ppd, 1), f(m.Vpd, 2), f(m.M, 1), m.none ? '' : m.pass === true ? 'pass' : m.pass === false ? '<b style="color:#b42318">fail</b>' : '—']));
+  rwpxModal('Pull pile results from Pile Designer', body, [['Import', () => {
+    const rec = { producer: res.producer, producerFile: res.producerFile, producedAt: res.producedAt, via: via || 'storage', adoptedAt: new Date().toISOString(),
+      basis: res.basis ? { producer: res.basis.producer, producedAt: res.basis.producedAt, contentHash: res.basis.contentHash || null, target: res.basis.target || null } : null,
+      statusAtImport: pl.status, fields: {}, prev: {}, geo: (res.geotechnical && res.geotechnical.static) ? (({ Rn, phi, RnUp, phiUp, toeDepth }) => ({ Rn, phi, RnUp, phiUp, toeDepth }))(res.geotechnical.static) : null,
+      fixity: res.fixity ? { Lf: res.fixity.Lf } : null, cases: pl.match.filter(m => !m.none).map(m => ({ key: m.key, name: m.name, P: m.Ppd, V: m.Vpd, M: m.M, pass: m.pass })) };
+    pl.set.forEach(s => { const el = document.getElementById(s.id); if (!el) return; rec.prev[s.id] = el.value; el.value = String(s.to); rec.fields[s.id] = el.value; });
+    document.getElementById('pile_pxr').value = JSON.stringify(rec);
+    if (via !== 'file' && window.BridgeXfer) BridgeXfer.markAdopted('pileResults', RWPX.RID, res.producedAt);
+    document.getElementById('rwpx-ov').remove(); onInputChange(); }]]);
+}
+function rwpxImportFile(inpEl) {
+  const fl = inpEl.files && inpEl.files[0]; if (!fl) return; const rd = new FileReader();
+  rd.onload = () => { inpEl.value = ''; let p; try { p = JSON.parse(rd.result); } catch (e) { alert('Import pile results: not a JSON file.'); return; } rwpxPullOpen(p, 'file'); };
+  rd.readAsText(fl);
+}
+function rwpxClear() { const el = document.getElementById('pile_pxr'); if (!el || !el.value) return; if (!confirm('Clear the Pile Designer results record? The imported input values stay as they are.')) return; el.value = ''; onInputChange(); }
+</script>
```

## 2026-11-07 — PR: claude/pile-m7-group-handoff (PR #1050: https://github.com/mlococo88/All-Structural/pull/1050) (PDA-M7) — pile results import: Pile Designer's group reduction applied to R_n and R_n,up   [imported value change with a group]
- **Problem (Pile Designer review M7):** `rwpxPlan` set `pile_Rn` / `pile_Rnup` to the single-pile static resistance even when Pile Designer's group efficiency or block governs.
- **Where:** `rwpxPlan` (RWPX engine block).
  - New `G`, `grR` (`res.group.reduce` when < 1) and `grU` (`res.group.uplift.reduceUp` when < 1).
  - Before: `to: g.Rn` and `to: g.RnUp`. After: `to: g.Rn * grR` and `to: g.RnUp * grU`, with the labels stating the factor.
  - The plan also returns `group: { reduce, reduceUp, eta, blockGoverns }` (or null).
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) 10.7.3.9 / 10.9.3.6, 10.7.3.11 / 10.9.3.8 (through Pile Designer's Module 11). No wall formula changed.
- **Check case** (`tests/engine/handoffs.test.mjs`, "PDA-M7 pileResults group"): static R_n 400, R_n,up 150, `reduce` 0.8, `reduceUp` 0.6.
  - `pile_Rn` = **320**, `pile_Rnup` = **90**; φ unchanged.
  - Without `group`, or with `reduce` 1: 400 / 150 as before.
- **How verified:** handoffs tests 10 pass; `tests/smoke/retwall-pile-handoff.mjs` all passed; `check-syntax`: pass.

## 2026-11-07 — PR: claude/rw2-h5-collision-phib — AASHTO Extreme Event II (collision): bearing φ_b = 0.8 for semigravity walls per Art. 11.5.8; sliding keeps φ = 1.0 (RW2H5; calculation change) (PR #1134: https://github.com/mlococo88/All-Structural/pull/1134)

Second-pass review finding H5 (2026-11-07). Code sites are tagged `RW2H5`.

### RW2H5-1. Problem
- The collision bearing check used `q_R_ct = phi_ct * q_n_ct` with the single extreme-event φ input (`aashto_ct_phi`, default 1.00).
- AASHTO LRFD 10th Ed. (2024) Art. 11.5.8: extreme-event resistance factors are 1.0 unless otherwise specified; for bearing, φ = 0.8 for gravity and semigravity walls (0.9 for MSE). The bearing sentence is not limited to earthquake loading (C11.5.8: bearing should not fail before sliding). The tool already used φ_b = 0.8 for Extreme Event I (RWE1). Unconservative by 25 % on the bearing resistance.

### RW2H5-2. Fix (`calcAll`, collision block, anchor `const q_R_ct`)
Before:
```js
      const q_R_ct     = phi_ct * q_n_ct;                     // φ=1.0 × nominal
```
After:
```js
      const phi_b_ct   = Math.min(0.80, phi_ct);              // RW2H5 ...
      const q_R_ct     = phi_b_ct * q_n_ct;                   // φ_b = 0.8 × nominal
```
- `phi_b_ct` is returned in `aashtoR.ct.ee2`. Sliding (`R_tau_ct`, `R_ep_ct`) keeps `phi_ct`.
- Display: Stability Step 7b card reference "φ = 1.00 sliding, φ_b = 0.80 bearing (§11.5.8)"; the bearing check shows q_R = φ_b q_n = 0.80(q_n) with φ_b and q_n in the variable list; Overview dashboard row "φ=1.00 φb=0.80"; Report load-case table and Step 7b bearing label "q_R = φ_b q_n = 0.80 × 9.00 = 7.20 ksf (Art. 11.5.8)"; the collision input note mentions φ_b.

### Check case (AASHTO default wall, collision TL-4 on, defaults otherwise)
- q_n = 9000 psf (the placeholder φ_b q_n 4950 / 0.55). V_max = 18011 lb/ft, q_u = 1535 psf (unchanged).
- Before: q_R = 1.0 × 9000 = 9000 psf, D/C = 1535 / 9000 = **0.171**.
- After: q_R = 0.8 × 9000 = **7200 psf**, D/C = 1535 / 7200 = **0.213**. PASS either way.
- Collision sliding D/C 0.246 and e unchanged.

### How verified
- origin/main vs branch, headless (`calcAll` on 17 review walls: ACI/AASHTO defaults, variants, pile cases, k_h, η, water, collision): only `aashto_ct` and `aashto_ct_var` move, and only `ctBearing` (9.00 → 7.20 ksf). 0 console errors.
- Tests: check-syntax; smoke/retaining-wall-checks (new `AUD` row RW2H5); phone-layout rwall; project-library retwall; dxf-print-sheets rw; retwall-pile-handoff; engine handoffs, pile-group.

### Decision (pending engineer review)
- φ_b,EE II = min(0.80, φ input): a φ input below 0.80 also governs bearing (conservative); the input otherwise applies to sliding and passive only.

### Saved data
- No input or format change. `aashto_ct_phi` keeps its value and now governs sliding/passive only (and bearing when below 0.80).

## 2026-11-07 — PR: claude/rw2-h4-eta — AASHTO load modifier η on every Strength I load effect (stem, heel, toe, key, column) and 1/η on the minimum-factor loads (Art. 1.3.2.1) (RW2H4; calculation change, η ≠ 1.00 only) (PR #1136: https://github.com/mlococo88/All-Structural/pull/1136)

Second-pass review finding H4 (2026-11-07). Code sites are tagged `RW2H4`.

### RW2H4-1. Problem
- η multiplied only `H_drive_str`, `Mo_str`, `V_str_max_tot` and `Mr_str_max_tot` (without the column load). It was missing on the stem demands (base, mid-height, M along the height), on the heel's factored downward load, on the toe self-weight and on the shear-key demand.
- The minimum-factor loads (`V_resist_min`, `V_str_min`, `Mr_str_min`, Strength Ia trapezoid, heel Ia downward load, toe self-weight 0.90 DC) were not divided by η.
- AASHTO LRFD 10th Ed. (2024) Art. 1.3.2.1:
  - loads at their maximum factor take η_i = η_Dη_Rη_I ≥ 0.95 (Eq. 1.3.2.1-2);
  - loads at their minimum factor take η_i = 1/(η_Dη_Rη_I) ≤ 1.0 (Eq. 1.3.2.1-3).
- With η > 1 the old code was unconservative. With η < 1 the heel took un-reduced downward loads against an η-reduced trapezoid.

### RW2H4-2. Fix (`calcAll`)
- AASHTO block: `etaMn = Math.min(1, 1/eta)`.
- Minimum side (min loads × `etaMn`; water uplift × `eta`, since there it reduces the resistance):
  - `V_resist_min = etaMn*(0.90(DC) + 1.00 EV + 0.90 P_aV + 0.75 ES) − eta*U` (was `… − U`, no η);
  - `V_str_min`, `Mr_str_min`: the same (was `… − 1.00·U`).
- Bearing side:
  - `V_str_max = V_str_max_tot − etaMn*U`, and `Mr_str_max` likewise (the uplift relieves the soil pressure; was `− U`).
  - `V_str_min_tot = V_str_min + eta*U` (adds back exactly what was taken out).
- Column: `V_col = eta*(1.25 DL + 1.75(LL + S))` (was outside η).
- Members (`etaMx = isAASHTO ? A.eta : 1`, `etaMn = isAASHTO ? min(1, 1/η) : 1`):
  - `Mu_stem_strI`, `Vu_stem_strI`, `Mu_stemT_strI`, `Vu_stemT_strI` and `MuS(z)` = `etaMx*(…)` (were the bracket alone);
  - `heelCase(..., et)`: `wu = et*(…)` and the wedge `et*γ_EV`; Strength I max passes `etaMx`, Strength Ia passes `etaMn`;
  - `wu_toe_down = etaMn*0.90γ_c t_f`;
  - shear key `gP = 1.50*etaMx`.
- Extreme Event I / II, Service I and ACI mode are unchanged.
- Display:
  - Stem Step 1 and the Report: a step "Load modifier η on the Strength I demand", M = η(Σ).
  - Heel Step 1: w_u = η(…) or 1/η(…).
  - Toe Step 1: w_sw = (1/η)·0.9γ_c t_f.
  - Stability Step 4: R_R = φ_τ(1/η[…] − ηU)tan δ_b, with 1/η in the variable list. Labels for M_r and V_u. Report Steps 4 and 6 and the Strength Ia footing load.
  - 3D load arrows (`rw3Factors`): the minimum factors × 1/η, and uplift as above.
  - Self-consistency stem M_u × η.
  - Every η line is shown only when η ≠ 1.00, so the default display is unchanged.

### Check case (AASHTO default wall, η = 1.05)
- Stem:
  - Σγ_iM_i = 1.50(17280) + 1.75(8568) = 32274;
  - M_u = 1.05 × 32274 = **33888** (was 32274);
  - V_u = 1.05 × 6819 = **7160**.
- Sliding:
  - H = 1.05 × 8278.88 = 8692.8;
  - V_min = 16076.3 / 1.05 = 15310.7;
  - R = 1.0 × 15310.7 × tan 20° = 5572.6;
  - D/C = **1.560** (was 1.486, with η on H only).
- Eccentricity: e_A 1.564 → **1.706** ft (≤ 3.125).
- Heel: Strength Ia governs. Md = 52560 / 1.05 = 50057; M_u 29115 → **29264**. Toe M_u 9965 → **10009** (w_sw = 202.5 / 1.05 = 192.9 psf).
- η = 1.00: every result is identical. η = 0.95: maximum-factor effects × 0.95, minimum factors × 1.0 (capped). Stem M_u 30660; the heel is now consistent (Ia governs, 26045; before, 28980 from un-reduced down loads against a reduced trapezoid).

### How verified
- origin/main vs branch, headless, 21 walls.
  - Every η = 1.00 wall is identical, including the ACI, pile, seismic and collision walls.
  - The η walls move as above: η 1.05 with water and column, bearing q 7225 → 7519 psf; η 1.05 on piles; η 1.05 with key, key M_u 1215 → 1276; η 0.95.
  - 0 console errors.
  - At η 1.05 with water and column: self-consistency panel all passed, 0 KaTeX errors.
- Tests: check-syntax; smoke/retaining-wall-checks (new `AUD` rows RW2H4 η 1.05 and η 1.00); phone-layout rwall; project-library retwall; dxf-print-sheets rw; retwall-pile-handoff; engine handoffs, pile-group.

### Decisions (pending engineer review)
- Water uplift (WA, a single factor 1.00) takes η where it reduces the resistance (sliding, eccentricity, Strength Ia) and 1/η where it relieves the soil bearing. Both choices are conservative.
- η is not applied in Extreme Event I / II. The tool's η input is the strength-limit-state modifier, as before; Art. 1.3.5 lets η_I apply to extreme events, which the engineer may want.
- Pile mode (AASHTO) uses the same Strength I / Ia sets, so the pile reactions follow. The Pile Designer hand-off at η = 1.00 is unchanged.

### Saved data
- No input or format change.

## 2026-11-07 — PR: claude/rw2-h1-aci-static-brg — ACI/IBC with earthquake: the service bearing and the eccentricity are checked for the static case (E = 0) and for the case with 1.0·ΔP_E; the larger governs (RW2H1; calculation change, k_h > 0 only) (PR #1137: https://github.com/mlococo88/All-Structural/pull/1137)

Second-pass review finding H1 (2026-11-07), the open item of RWIB (#953). Code sites are tagged `RW2H1`.

### RW2H1-1. Problem
- `calcAll` took `x_R = (Ms − Mo)/SumV` with `Mo` including `Mo_seis` = 1.0·ΔP_E·0.6H. So `q_toe`, `q_heel`, `q_max`, `bearing_ok` and `ecc_ok_aci` were checked for the 1.0E case only.
- Where the static resultant is on the heel side (e < 0, the default wall), adding E moves it toward the centre, and the checked pressure was lower than the static one.
- IBC 2018 §1807.2.3 and ASCE 7-16 §2.4.1: the allowable-stress combinations without E must be satisfied on their own. FS_OT and FS_SL were already split (RWIB).

### RW2H1-2. Fix (`calcAll`, anchor `RW2H1`, service bearing block)
Before:
```js
  const x_R = SumV > 0 ? (Ms - Mo) / SumV : B / 2;
```
After:
```js
  const xR_E = SumV > 0 ? (Ms - Mo) / SumV : B / 2, e_E = B / 2 - xR_E;
  const xR_S = SumV > 0 ? (Ms - Mo_st) / SumV : B / 2, e_S = B / 2 - xR_S;
  const brg_static = !isAASHTO && hasSeismic && Math.abs(e_S) > Math.abs(e_E);
  const Mo_brg = brg_static ? Mo_st : Mo;
  const x_R = brg_static ? xR_S : xR_E;
```
- `x_R`, `e`, `q_toe`, `q_heel` and `q_max` are now the governing case, so the bearing, eccentricity, drawings and diagrams follow it. ΣV is the same in both cases, so the larger |e| also gives the larger q_max.
- New results:
  - `Mo_brg`: the overturning moment used;
  - `brgAlt`: `{gov, other, Mo, x_R, e, q_max}` of the other case.
- The E case stays at 1.0·ΔP_E (as before; more severe than 0.7E).
- Display:
  - Stability Step 6: a note, both cases worked (x̄, e, q_max), "… governs", and x̄ with M_OT of the governing case.
  - Report Step 6: x̄ with the governing case and the other case quoted.
  - The self-consistency x̄ check uses the governing M_OT.
- Not changed: ACI without seismic, AASHTO mode (Extreme Event I does its own checks), and pile mode (its own combinations).

### Check case (ACI default wall, k_h = 0.10)
- SumV = 16582.5 lb/ft, M_s = 123673, M_o,st = 3645(4.5) = 16402.5, M_o,E = ΔP_E(0.6H) = 691.3(8.10) = 5599.8.
- **Static case:**
  - x̄ = (123673 − 16402.5)/16582.5 = 6.4689 ft, so e = −0.2189 ft;
  - q_heel = 1326.6(1 + 6(0.2189)/12.5) = **1466.0 psf**.
- **Seismic case:**
  - x̄ = (123673 − 22002.2)/16582.5 = 6.1312 ft, so e = +0.1188 ft;
  - q_toe = 1326.6(1 + 6(0.1188)/12.5) = 1402.2 psf.
- Static governs: q_max 1402.2 → **1466.0 psf** (≤ 3000, PASS); e 0.119 → **0.219 ft** (≤ B/6 2.083, D/C 0.105).
- Other walls that move (main vs branch):

| Wall | q_max (psf) | e (ft) |
|---|---|---|
| k_h 0.20, L_t 5, L_h 5 | 1303.5 → 1352.3 | 0.470 → −0.560 |
| k_h 0.10, β 15° | 1702.4 → 1715.9 | 0.227 → −0.246 |

- The review variant (k_h 0.20, β 15°, water): the seismic case governs, so there is no change.

### How verified
- Headless probe, H4 branch vs this branch, on 24 walls. Only the ACI walls with k_h > 0 where the static |e| is larger move, and only in x̄, e, q and the bearing / eccentricity values. 0 console errors.
- At k_h 0.10: self-consistency all passed.
- Tests:
  - check-syntax;
  - smoke/retaining-wall-checks (new `AUD` rows RW2H1);
  - phone-layout rwall; project-library retwall; dxf-print-sheets rw;
  - retwall-pile-handoff; engine handoffs, pile-group.

### Decision (pending engineer review)
- The E case keeps 1.0·ΔP_E, as the tool did before; ASCE 7-16 ASD combinations 5/8 would allow 0.7E. Bearing and e take the more severe of the static case and 1.0E. The FS checks keep 0.7E with FS ≥ 1.1 (RWIB).

### Saved data
- No input or format change.

## 2026-11-07 — PR: claude/rw2-h2-aci-dpe-hprime — Mononobe-Okabe P_AE and ΔP_E on the pressure-plane height H′ (sloped backfill), applied at 0.6H′, as the static thrust and AASHTO Extreme Event I (RW2H2; calculation change, k_h > 0 with β > 0 only) (PR #1139: https://github.com/mlococo88/All-Structural/pull/1139)

Second-pass review finding H2 (2026-11-07). Code sites are tagged `RW2H2`.

### RW2H2-1. Problem
- `Pae = ½K_AEγH²(1 − k_v)`, `Pe_inc = Pae − ½K_A,MOγH²` and `Mo_seis = Pe_inc·0.6H` used the wall height H.
- The static thrust (`Pa_tri`) and the AASHTO Extreme Event I `P_AE` act on the vertical plane through the heel end, H′ = H + (L_h + t_bot − t_top)·tanβ.
- With a sloped backfill, ΔP_E was understated by (H′/H)². This was unconservative for FS_OT,E, FS_SL,E, the bearing and e (1.0E case), the ACI footing design with 1.0E, and the ACI pile combinations s2 / s4.
- The tabs also labelled the subtracted static force "P_a" and showed the Rankine/Coulomb thrust `Pa_tri`, which is not the value the code subtracts (the M-O expression at θ = 0).

### RW2H2-2. Fix (`calcAll`, seismic block)
Before:
```js
    Pae    = 0.5 * KaeMO * inp.gamma_s * H * H * (1 - kv);
    Pe_inc = Math.max(0, Pae - 0.5 * Ka_static_MO * inp.gamma_s * H * H);
    Mo_seis = Pe_inc * (0.6 * H);
```
After:
```js
    const Hq = H + (inp.beta > 0 ? (inp.Lh + ts_bot_ft - ts_top_ft) * Math.tan(beta_r) : 0);   // = Hp
    Pae    = 0.5 * KaeMO * inp.gamma_s * Hq * Hq * (1 - kv);
    Pa_MO  = 0.5 * Ka_static_MO * inp.gamma_s * Hq * Hq;
    Pe_inc = Math.max(0, Pae - Pa_MO);
    Mo_seis = Pe_inc * (0.6 * Hq);
```
- Stem: `stemSeis` scales ΔP_E by (z/H′)², was (z/H)². The stem value is unchanged: ½(K_AE − K_A,MO)γz² either way.
- New result `Pa_MO`.
- Display (H′ is shown only for β > 0):
  - Stability tab: the Earth-pressure step "ΔP_E = P_AE − ½K_A,MO γH′²", M_o,E at 0.6H′, and the M-O detail: P_AE worked with H′, ΔP_E = P_AE − P_a,MO.
  - Stem seismic step: (H_s/H′)².
  - Report: the same steps.
  - Drawings: the ΔP_E arrow and the moment table at 0.6H′.

### Check case (review variant, ACI: β 15°, q_s 250, water 6 ft, key 18 in, passive, k_h 0.20)
- H′ = 13.5 + 8.5 tan 15° = **15.778 ft**; K_AE = 0.66533; K_A,MO = 0.40192.
- P_AE = ½(0.66533)(120)(15.778²) = **9937 lb/ft** (was 7275 on H).
- P_a,MO = ½(0.40192)(120)(15.778²) = 6003.
- ΔP_E = **3934 lb/ft** (was 2880).
- M_o,E = 3934(0.6)(15.778) = **37243** (was 23331).
- FS_OT,E = 118865/(42962 + 0.7·37243) = **1.722** (was 2.005; ≥ 1.1 OK).
- FS_SL,E = **0.609** (was 0.654; FAIL as before).
- Seismic stem M_u 50218 is unchanged.
- Consequences, same wall:
  - bearing q_max 2344 → 2942 psf and e 1.81 → 2.70 ft: the eccentricity check B/6 now FAILS;
  - ACI footing design with 1.0E: heel M_u 46177 → 55673 (#6 @ 7 → #7 @ 8).
- ACI pile variant: s2 / s4 move; P_max 77.7 → 85.1 kip and P_min −17.1 → −24.6 kip.
- AASHTO mode: no check moves. Only the informational service reference q and the unused ACI FS fields change; Extreme Event I already used H′.
- Level backfill (β = 0): H′ = H, identical.

### How verified
- Headless probe, H1 branch vs this branch, 26 walls. Only walls with k_h > 0 and β > 0 move, as above. 0 console errors.
- Self-consistency passes on the variant and on k_h 0.10; 0 KaTeX errors.
- Tests: check-syntax; smoke/retaining-wall-checks (new `AUD` rows RW2H2); phone-layout rwall; project-library retwall; dxf-print-sheets rw; retwall-pile-handoff; engine handoffs, pile-group.

### Saved data
- No input or format change. ACI pile walls with β > 0 and k_h > 0 send larger s2 / s4 loads in the Pile Designer hand-off (foundationLoads). The Pile Designer then shows a stale flag, as for any changed load.

## 2026-11-07 — PR: claude/rw2-h3-pile-water — Pile-supported footing with water: the piles take V − γ_U·U and the uplift acts on the heel underside (the #960 split; the toe keeps the total routing, conservative); the Report's heel pile steps fixed (RW2H3; calculation change, pile mode with water only) (PR #1140: https://github.com/mlococo88/All-Structural/pull/1140)

Second-pass review finding H3 (2026-11-07). Code sites are tagged `RW2H3`.

### RW2H3-1. Problem
- `pileFtg` built the pile-row line loads for the heel and toe design (Phase 8d) from the total factored vertical load: ACI `SumVu` / `SumVu_min`; AASHTO `V_str_max_tot` / `V_str_min_tot`, with the uplift added back. No water pressure acted on the cap underside, and the RWUP split (`upS`) is off on piles.
- The piles carry V − U, and the water pushes up on the footing. Routing U through the heel pile row (arm 6.5 ft) instead of spreading it over the heel (centroid L_h/2 = 4 ft) overstated the heel relief, so the heel was **unconservative**.
- Report, pile mode: Heel Step 1–2 still showed the bearing-trapezoid steps ("q_u(L_h) = — psf"). The pile substitution was applied to `H1` / `H2` after `pre()` had already copied them. This is display only; the Footing tab was right.

### RW2H3-2. Fix (`calcAll`, `pileFtg`, anchor `RW2H3`)
- Each pile set gets a heel version `wsplit(c, γ_U, x_back, B)` (the original is unchanged without water):
  - V_p = V − γ_U U and x̄_p = (V x̄ − γ_U U x_U)/V_p feed the pile rows;
  - `water = { g, u_a, u_b, L, F = (u_a + u_b)L/2, M = L²(u_a + 2u_b)/6 }`, with u(x) = γ_U γ_w h_w (uniform, or x/B for triangular uplift).
- Factors:
  - ACI: heel γ_U = 0.9 (`heelMax`, `heelMin`), as RWUP (ACI 318-19 §5.3.8, engineer decision of #960);
  - AASHTO: γ_WA = 1.0.
- The toe keeps `cmax` / `cmin` (the total routing). The split would lower it (see the Decision below).
- `heelCase` (pile branch): M_up = Σq_i a_i + M_w and V_up = Σq_i + F_w. The pile-row parts are kept as `Mpl`, `Vpl`. `toeCase` has the same code path, which is inactive while the toe has no `water`.
- `cmax` / `cmin` (total) are kept for punching (conservative, as the review suggested) and for the Footing tab's net-load chart, which now plots the heel set.
- The shear and moment diagrams (Plotly and SVG) add the water beyond the section (`rwPileWaterBeyond`).
- Display:
  - Footing tab Heel Step 1: a new step "Water uplift on the heel underside" (V_piles = V_tot − γ_U U, u, F_w, M_w), and Heel Step 2 with M_up = Σq_i a_i + M_w and V_u = |w_u L_h − Σq_i − F_w|.
  - Report: the same step; the heel pile substitution moved before the heel section is built.
- Not changed:
  - spread footings;
  - piles without water;
  - the pile analysis itself (`rwPileAnalysis`, Pile Step 1–2, the pile checks);
  - the Pile Designer hand-off (foundationLoads). It is built from `r.pile`, which is unchanged: the hand-off test passes and the probe shows identical pile combinations.

### Check case (default wall, t_f 36 in, rows 1.5 / 11.0 ft at s 6 ft, water 6 ft below the top: h_w 9 ft, U = 62.4·9·12.5 = 7020 lb/ft, uniform)
- ACI heel, U = 0.9D + 1.6H governs: M_d = 56160.
  - Water on the heel: u = 0.9 × 561.6 = 505.4 psf, M_w = 505.4(8²)/2 = 16174.
  - Pile row at 11.0 ft (a = 6.5 ft) from V_p = 17888 − 0.9(7020) = 11570: Σq a = 19994.
  - M_up = 36168 (was 40527); M_u = 56160 − 36168 = **19992** (was **15633**). F1 unchanged (#4 @ 6, minimum).
- AASHTO heel, γ_WA 1.0: M_up 35964 → 31120; M_u 24996 → **29840**; F1 #4 @ 10 → **#4 @ 8**.
- Toes: unchanged (ACI 19128, AASHTO 24384).
- Other walls: ACI pile variant heel 69429 → 73788; AASHTO pile variant heel 66612 → 71456 (#5 @ 6 → #6 @ 8); triangular uplift heel 15633 → 17679.
- Without water: identical.

### How verified
- Headless probe, origin/main (after #1139) vs this branch, 28 walls. Only pile walls with water move, as above. Pile combinations (`r.pile.comb`) are identical. 0 console errors.
- Self-consistency passes; 0 KaTeX errors.
- Tests: check-syntax; smoke/retaining-wall-checks (new `AUD` rows RW2H3; RWPL 8d rows unchanged); phone-layout rwall; project-library retwall; dxf-print-sheets rw; **retwall-pile-handoff** and engine **handoffs, pile-group** (the Pile Designer hand-off values do not change).

### Decisions (pending engineer review)
- **Toe:** keeps the total routing, which is conservative. With the split (ACI γ_U 1.6, AASHTO 1.0) the toe M_u would go **down**, e.g. ACI 19128 → 14748 (water 2 ft: 22057 → 15730, and the toe shear would pass) and AASHTO 24384 → 21646. The engineer may adopt the split for the toe too.
- **ACI heel factor:** γ_U = 0.9, the RWUP heel rule, also on piles.
- **AASHTO factor:** γ_WA = 1.0 on both members, with no η (the review's case is at η 1.00). With η ≠ 1, the AASHTO total sets keep their RW2H4 factors.
- **Punching:** keeps the total pile reactions (conservative).

### Saved data
- No input or format change.

## 2026-11-07 — PR: claude/rw2-m2-service-heel-toe — AASHTO heel and toe crack control (Art. 5.6.7) from Service I moments of the Service I base reaction (RW2M2; calculation change, AASHTO mode) (PR #1141: https://github.com/mlococo88/All-Structural/pull/1141)

Second-pass review finding M2 (2026-11-07). Code sites are tagged `RW2M2`.

### RW2M2-1. Problem
- **Heel:** `M_serv_heel` was the full unfactored downward load with no upward relief (64,704 lb-ft/ft at the default, against a factored M_u of 27,580).
  - The raw f_ss ≈ 121 ksi was capped at 0.6f_y, so the check row passed.
  - At the same time the warning "Heel service steel stress exceeds 0.6f_y — increase A_s" appeared on the default AASHTO wall, contradicting the check row. Neither value was a real service stress.
- **Toe:** `M_serv_toe = |M_u|/1.5`. This is unconservative where the average factor is below 1.5.

### RW2M2-2. Fix (`calcAll`, Service I block, anchor `RW2M2`)
Before:
```js
    const M_serv_heel = (w_soil_col + inp.gamma_c * tf_ft
                       + (isAASHTO ? q_ll_aashto : 0) + inp.q_sur) * inp.Lh ** 2 / 2 + M_wedge_heel;
    const M_serv_toe  = Math.abs(Mu_toe_net) / 1.5;
```
After:
- **Service I loads (all γ = 1.0, η = 1.0; AASHTO LRFD 10th Ed. Table 3.4.1-1):**
  - V = DC + EV + P_a,V + LS_v + ES_v + column (DL + LL + S);
  - M_r about the toe;
  - M_o = P_EH y_EH + P_LS y_LS + P_ES H′/2 + P_WA h_w/3;
  - x̄ = (M_r − M_o)/V.
- **Spread footing:** the total vertical as a trapezoid, or the RWPC soil block 3x̄ in partial contact (`q_blk`), the same as the Strength I footing design. M_up is integrated over the member (Simpson, 400 strips).
- **Piles:** the Service I pile-row reactions (`SharedPileGroup.momentAbout` / `rowLoads`). The heel takes the RW2H3 water split (γ = 1.0) and the toe the total routing.
- **Moments:**
  - `M_serv_heel = max(0, w L_h²/2 + M_wedge − M_up)`, with w = soil + footing + LS + q_s;
  - `M_serv_toe = max(0, M_up − γ_c t_f L_t²/2)`; soil over the toe is not credited, as in strength.
- `aashtoR.serv.svc` exposes V, M_r, M_o, x̄, e, q, w, M_down and M_up.
- **Display:**
  - Stability Step 9: two worked steps (the Service I resultant and pressures; the heel and toe M_s), with M_serv in the heel and toe check rows.
  - Report Step 9: "Service I heel and toe moments".
  - The Report heel note now says which moment is used in AASHTO mode.
- The "Heel service steel stress exceeds 0.6f_y" warning stays. It now fires only for a real Service I stress.
- ACI mode is unchanged.

### Check case (AASHTO default wall)
- V = 2812.5 + 2250 + 11520 + 357(8) = 19438.5 lb/ft.
- M_r = 123673 + 2856(8.5) = 147949.
- M_o = 3645(4.5) + 1606.5(6.75) = 27246.
- x̄ = 6.2096 ft, e = 0.040 ft.
- q_toe / q_heel = 1585 / 1525 psf; 1563.5 psf at the back face.
- **Heel:** w = 1440 + 225 + 357 = 2022 psf.
  - M_down = 2022(64)/2 = 64704.
  - M_up = 1563.5(32) − 38.6(64)/3 = 49208.
  - M_s = **15496** (was **64704**). f_ss is now below 0.6f_y and the warning is gone.
  - s_max 8.1 → **11.7 in** (F1 #5 @ 8: PASS).
- **Toe:** M_up ≈ 7112, less 225(9)/2 = 1012.5, gives M_s = **6100** (was 6298 = 9447/1.5). s_max 15.8 → 16.5 in.

Other walls (heel M_s, before → after):

| Wall | Before | After | Note |
|---|---|---|---|
| L_t 5 / L_h 6, η 1.05 | 36396 | 10568 | crack check FAIL → PASS |
| piles, t_f 36 | 71040 | 5517 | |
| water + column | 66624 | 0 | net upward: F1 not in tension |

### How verified
- Headless probe, H3 branch vs this branch, 28 walls. Only AASHTO walls move, and only `serv.M_serv_heel` / `M_serv_toe`, the crack-control rows and the warning. 0 console errors.
- ACI walls identical. Self-consistency passes; 0 KaTeX errors.
- Tests: check-syntax; smoke/retaining-wall-checks (new `AUD` row RW2M2); phone-layout rwall; project-library retwall; dxf-print-sheets rw; retwall-pile-handoff; engine handoffs, pile-group.

### Decisions (pending engineer review)
- **One Service I set for both members:** the column LL and LS are included in V and M_r, and LS in M_o.
- **Net upward heel (M_s < 0):** F1 is not checked in tension (M_s = 0). The bottom face of the heel has no crack check, as before.
- **Pile toe:** the existing "negative s_max" with the cover over the pile heads is unchanged (8d decision).

### Saved data
- No input or format change.

## 2026-11-07 — PR: claude/rw2-m3-pile-cap-tension — Piles in uplift: a "Pile–Cap Tension" FAIL row with the tension and the embedment, and a warning; the connection is designed by the engineer (RW2M3; check added, pile mode with uplift only) (PR #1142: https://github.com/mlococo88/All-Structural/pull/1142)

Second-pass review finding M3 (2026-11-07). Code sites are tagged `RW2M3`.

### RW2M3-1. Problem
- A pile in tension (P_min < 0) was checked only against the geotechnical uplift capacity (T_a or φR_n,up).
- No pile-to-cap tension connection (anchorage) was checked or flagged.
- AASHTO LRFD 10th Ed. Art. 10.7.1.2 (paraphrased) allows the reduced projection into the cap only with embedded bars or strands anchored per Art. 5.12.9.1.
- IBC 2018 §1810.3.11 / §1810.3.3.1.5 (paraphrased): the uplift load path is to be designed.
- Example: the review's ACI pile variant has P = −17.1 kip (−24.6 kip after RW2H2) with a 12-in embedment, and no flag.

### RW2M3-2. Fix (`calcAll`, `pileChecks`; Stability Pile Step 2; Report Pile Step 2)
- When `pile.govT.L.Pmin < 0`:
  - new check row `pileCapT` (ok: false, label "Pile–Cap Tension", value `T=…k, embed …": not designed`, D/C n/a, with the reference);
  - a warning "Pile uplift: P_min = −… kip per pile (combination) … provide and design the anchorage … Marked FAIL until then";
  - a warn alert after "2.3 Uplift" on the Stability tab;
  - a Report step "Pile–cap tension connection for T = … kip per pile (embedment … in): not designed in this tool".
- `RW_CHECK_CARD.pileCapT = 'stabPile'`.
- No row when no pile is in tension.
- The pile results, capacities and the Pile Designer hand-off are unchanged.

### Check cases
- **ACI, t_f 36 in, rows 1.5 / 11.0 ft, water 2 ft below the top:** P_min = −10.4 kip, so **FAIL**, "T=10.4k, embed 12.0": not designed".
- **ACI pile variant** (β 15°, q_s 250, water 6 ft, key, passive, k_h 0.20): T = 24.6 kip (0.6D + 0.7E + H), so FAIL.
- **AASHTO pile variant:** T = 15.2 kip, so FAIL.
- **Default pile walls (no uplift):** no row (unchanged).

### How verified
- Headless probe, M2 branch vs this branch, 28 walls:
  - only the three uplift walls change, by the new row and warning;
  - every number is identical;
  - 0 console errors.
- Tests: check-syntax; smoke/retaining-wall-checks (new `AUD` rows RW2M3); phone-layout rwall; project-library retwall; dxf-print-sheets rw; retwall-pile-handoff; engine handoffs, pile-group.

### Decisions (pending engineer review)
- **No in-tool connection design.** Embedment bond of H-piles, and pipe or precast dowels, depend on the pile type and the owner's details. The row FAILs, which is conservative, and names the tension and the embedment.
- **Possible follow-up:** a "connection designed by the engineer" input that turns the row to REVIEW, or an anchorage check for dowels (ℓ_d into the cap).

### Saved data
- No input or format change.

## 2026-11-07 — PR: claude/rw2-m1-ee-footing — AASHTO heel and toe checked for Extreme Event I (both cases) and Extreme Event II (collision), φ = 1.0, with the Strength I bars; pile mode: a note (RW2M1; check added, AASHTO with EE I or EE II only) (PR #1143: https://github.com/mlococo88/All-Structural/pull/1143)

Second-pass review finding M1 (2026-11-07). Code sites are tagged `RW2M1`.

### RW2M1-1. Problem
- The heel, toe and key were designed for Strength I / Ia only.
- AASHTO LRFD 10th Ed. Art. 11.6.4 and 11.6.5.1 require the structural design (Section 5) for every limit state.
- EE I was mentioned in a warning only; EE II had no note.
- With a large k_h, a short heel or full EH under collision, the toe pressure can exceed the Strength I value.

### RW2M1-2. Fix (`calcAll`, block `eeFtg` before `checks`)
- **Cases.** Each extreme-event case is checked with its maximum- and minimum-vertical sets:
  - EE I case 1, `V_max` at `c1.xRb`, and `V_min` at `c1.xR`;
  - EE I case 2, the same at `c2.xRb` and `c2.xR`;
  - EE II, `V_ct_max` at `x_R_brg_ct`, and `V_ct_min` at `x_R_ct`;
  - a minimum set identical to its maximum is merged (γ_EQ = 0, no column; cf. L7).
- **Base reaction.** The total base reaction is V + U, with the moment V·x̄ + U·x_U (water at 1.0). It is applied as a trapezoid, or as the soil block 3x̄ in partial contact (`q_blk`).
- **Heel.**
  - Downward load: w = soil + footing + q_s + γ_LS·LS, with γ_LS = γ_EQ in EE I and 0.50 in EE II, and the wedge, all at γ = 1.0.
  - M = M_down − ∫q·a dx, with V at the face.
- **Toe.** M = ∫q·a dx − γ_c t_f L_t²/2, with γ = 1.0, and V at the face.
- **Check.** The governing M and V are compared with M_n of F1 / F2 as designed for Strength I (φ = 1.0, i.e. φM_n/0.9) and with V_c (φ = 1.0).
- **New check rows.** `heelEE` and `toeEE` carry the D/C, the governing case and the reference, and are linked to the new Footing card `ftgEE`.
- **Pile mode.** A warning says the EE pile reactions are not applied to the heel and toe; check them by hand.
- **Display.**
  - Footing tab: a new card, "Heel and Toe — Extreme Event I / II Check". It shows a table per case (V_tot, x̄, q_toe / q_heel, w, M_heel = M_down − M_up, V_heel, M_toe, V_toe) and the two checks.
  - Report: a new sub-section, "Heel and toe: Extreme Event I / II check".
- ACI mode and AASHTO walls without EE I / II are unchanged.

### Check case (AASHTO default wall, k_h 0.20, collision TL-4)
- EE I case 2 (γ_EQ = 0): V_tot = 16582.5 lb/ft, x̄ = 5.209 ft, e = 1.041 ft. Then q = 1326.6(1 ± 0.4997) = 1989 / 664 psf, and 1512 psf at the back face.
- **Heel:** w = 1440 + 225 = 1665 psf. M_down = 1665(64)/2 = 53280. M_up = 1512(32) − 848(64)/3 = 30290.
  - M = **22994** ≤ M_n = 33.4 kip-ft/ft (F1 #5 @ 8), D/C 0.69.
- **Toe:** M_up = 8476, less 1012.5 (225 × 3²/2), gives M = **7464** ≤ M_n = 16.1 kip-ft/ft (F2), D/C 0.46. The review's spot check gave about 7.5.
- **EE II:**
  - max vertical: heel 8.03, toe 4.47 kip-ft/ft;
  - min vertical: heel 8.23, toe 4.42 kip-ft/ft.
  - Neither governs.
- **Review variant, AASHTO** (β 15°, water, k_h 0.20): heel 53.8 ≤ 82.1, toe 14.0 ≤ 28.9 kip-ft/ft. PASS.

### How verified
- Headless probe, origin/main (after #1142) vs this branch, 28 walls. Only AASHTO walls with EE I or EE II gain the two rows. The AASHTO pile walls with EE gain the note. No other value changes. 0 console errors.
- Tests: check-syntax; smoke/retaining-wall-checks (new `AUD` rows RW2M1); phone-layout rwall; project-library retwall; dxf-print-sheets rw; retwall-pile-handoff; engine handoffs, pile-group.

### Decisions (pending engineer review)
- **A check, not a redesign.** A failing EE case shows FAIL, and the bars are increased by the bar override. This keeps one design path.
- **Load factors γ = 1.0** for DC, EV, ES and water in both events, as the tool's EE stability (O5 closed, RW3F). The toe self-weight is at 1.0, not 0.9.
- **Not checked for EE:** the shear key, the stem–footing development and the crack control.
- **Pile mode:** the EE pile reactions are not applied to the heel and toe; the note says so.

### Saved data
- No input or format change.

## 2026-11-07 — PR: claude/rw2-low-items — Second-pass review LOW items L1–L8: citations and the 6-in rule, AASHTO Rebar labels and schedule, phone overflow on piles, S3 crack control, AASHTO auto shear, ACI §13.2.6.2 option, EE I duplicate rows, ACI joint shear friction (RW2L1–L8; small calculation changes and checks added, §4 where noted) (PR #1144: https://github.com/mlococo88/All-Structural/pull/1144)

Second-pass review LOW findings (2026-11-07). Code sites are tagged `RW2L1` … `RW2L8`.

### RW2L1 — citations; ACI §13.3.1.2 check (check added)
- **Pile-cap depth row (`pileCapD`):** the reference was "ACI 318-19 §13.3.1.2". It is now **§13.4.6.1**: the effective depth of the bottom bars of a pile cap is at least 12 in.
  - In 318-19, §13.3.1.2 is the 6-in rule for shallow foundations.
  - Verified on the rendered pages: printed 197 (PDF 199) and printed 202 (PDF 204).
- **New ACI check row `ftgDepth`** (spread footings only): "Footing d ≥ 6 in". It tests d of F2 (the bottom bars) against ACI 318-19 §13.3.1.2. The dashboard links it to Toe Step 3.
- Check cases:
  - default ACI: d = 14.75 in, PASS (D/C 0.41);
  - t_f 8 in, cover 3 in: d = 4.75 in, **FAIL** (D/C 1.26).

### RW2L2 — AASHTO Rebar tab (display only)
- The schedule card reference and the "General Detailing Requirements" card now read "AASHTO LRFD 10th Ed." in AASHTO mode (was "ACI 318-19").
- The S2 and F3 notes cite AASHTO §5.10.6 in AASHTO mode (was "ACI §24.4.3").
- Maximum spacings: 1.5h ≤ 18 in for AASHTO (was 3h).
- New schedule rows, as on Drawings sheet 2, in both modes:
  - **S1D:** the hooked stem dowel. Its ℓ column shows ℓ_dh.
  - **K1:** the reinforced shear key, when present.
- "Stem S1 dev. into ftg" (the straight ℓ_d) is now "Stem S1D dowel hook ℓ_dh into ftg": ℓ_dh ≤ t_f − c_c, with the straight ℓ_d in brackets.
- "Worked in" links added for S1D and K1.

### RW2L3 — phone layout in pile mode (display only)
- The pile-group table (Stability tab, Pile Step 1; 499 px) and the pile punching table (Footing tab; 514 px) are now wrapped in `overflow-x:auto`.
- At 390 px the page no longer scrolls sideways. scrollWidth was 522 px (Stability) and 537 px (Footing); it is now 390 px on both.
- New block RW2L3 in `smoke/retaining-wall-checks.mjs`: ACI and AASHTO pile cases at 390 px.

### RW2L4 — crack control on S3 (check added)
- **ACI:** `aciCr.stemT = aciCrack(c_c, s of S3)` (ACI 318-19 §24.3.2, f_s = ⅔f_y). It adds the row "Stem S3 Crack Ctrl" and a Report step "Crack-control bar spacing".
  - Default: s_max 10.0 in vs S3 #4 @ 7, PASS.
- **AASHTO:** the Service I moment at mid-height, `M_serv_stemT` (as `M_serv_stem`, with K_0 when that option is chosen). It uses `crackSpacing(d_stemT, …, t_mid, …, γ_e2)`.
  - The row is "Stem S3 Crack Ctrl". A worked check is added in Stability Step 9 and in the Report.
  - Default: s_max 13.4 in, PASS.
- **Not added (Decision, pending engineer review):**
  - S4 (front-face T&S): no Service I flexural tension.
  - K1: the passive load on the key is a resistance, not a service load.
  - Both are noted here, not checked.

### RW2L5 — AASHTO "auto" shear: the 3d_v rule for footings only (§4)
- Before: `simpleAllowed = h < 16 || (L·12 < 3d_v)`, used for the stem, mid-height and key as well.
- After: `simpleAllowed = h < 16 || (ftg && L·12 < 3d_v)`, where `ftg` is true for the heel and toe only.
- **Provision:** AASHTO LRFD 10th Ed. Art. 5.7.3.4.1 (paraphrased). β = 2.0 may be used for footings where the zero-shear point is within 3d_v of the face. Other sections may use it only when h < 16 in, among the listed conditions. Otherwise Art. 5.7.3.4.2 applies.
- **Check case:** AASHTO, H_s 3 ft, t_bot 18 in.
  - Stem d_v ≈ 14.1 in, so 3d_v = 42 in > 36 in. The stem was β = 2.0 (φV_c = 19427 lb/ft).
  - It is now the general procedure (φV_c = 23149 lb/ft). The general procedure can give β > 2 here.
  - The toe keeps β = 2.0.
- Walls with H_s·12 ≥ 3d_v are unchanged (all review walls).

### RW2L6 — ACI §13.2.6.2 size-effect option (§4; default off)
- New input `aci_ftg_nolams`, ACI only: "Heel / toe one-way shear: neglect the size-effect factor λ_s (ACI §13.2.6.2)".
  - Default **off**: λ_s is applied, as before (conservative).
  - Spread footings only; pile caps keep λ_s (§13.2.6.2 covers shallow foundations).
- **Saved data:** the field is saved only when checked (`snapshotFields` deletes the default). Older saves and default projects are unchanged and open with the option off.
- **Check case:** default ACI toe. λ_s = 0.899 gives V_c = 10565 lb/ft; with the option on, λ_s = 1 gives V_c = **11752** lb/ft (φV_c 7923 → 8814).

### RW2L7 — EE I duplicate rows (display; pile combinations)
- `rwPileAnalysis` (AASHTO): when V_max = V_min and x̄_b = x̄ (γ_EQ = 0 and no column), one row "(maximum = minimum vertical)" is listed instead of two identical rows.
- The footing EE check (RW2M1) does the same.
- The governing values are unchanged. Probe: AASHTO pile variant, 6 → 4 EE I rows, with identical numbers.

### RW2L8 — ACI shear friction at the stem–footing joint (check added)
- New result `sfJ` and row "Joint Shear Friction" (`ishAci`) in ACI mode:
  - φV_n = 0.75·min(μA_vf f_y, 0.2f′c A_c, 800A_c) ≥ V_u;
  - A_vf = the S1D dowels (flexural tension steel may serve, R22.9.4.6);
  - μ = 0.6 (concrete against hardened concrete not intentionally roughened, Table 22.9.4.2(c));
  - A_c = t_bot × 12.
- **Provision:** ACI 318-19 Eq. 22.9.4.2 and Table 22.9.4.4(d),(e). Verified on the rendered pages: printed 432–434 (PDF 434–436).
- Worked in Stem Step 4 (tab and Report).
- **Check case:** default ACI.
  - A_vf = 0.40 in²/ft (#4 @ 6) and A_c = 216 in².
  - V_n = min(0.6(0.40)(60000), 0.2(4000)(216), 800(216)) = min(14400, 172800, 172800) = 14400.
  - φV_n = **10800 lb/ft** ≥ V_u = 4608, PASS.
  - A_vf,req = 0.171 in²/ft.
- **Decision (pending engineer review):**
  - μ = 0.6 (no roughening assumed). The engineer may adopt 1.0 for a roughened joint or a keyway.
  - Permanent compression across the joint (§22.9.4.5) is not added.
- AASHTO mode already has the optional interface-shear check (Art. 5.7.4).

### How verified
- Headless probe, origin/main (after #1143) vs this branch, 32 walls. The only differences are:
  - the new rows (`crackStemT`, `ishAci`, `ftgDepth`), all PASS on the review walls except the t_f 8 in case;
  - the merged pile EE I row;
  - the L5 / L6 cases above.
  - 0 console errors.
- Phone 390 px pile: no sideways scroll.
- Tests:
  - check-syntax;
  - smoke/retaining-wall-checks: new `AUD` rows RW2L1–RW2L8 and the RW2L3 phone block;
  - phone-layout rwall;
  - project-library retwall;
  - dxf-print-sheets rw;
  - retwall-pile-handoff;
  - engine handoffs, pile-group.

## 2026-11-07 — PR: claude/rw-stem-geh-display (PR #1146: https://github.com/mlococo88/All-Structural/pull/1146) — Stem tab and Report Step 1: the earth-pressure factor shown is the analysis' γ_EH (1.35 at-rest, 1.50 active; Table 3.4.1-2), was 1.50 hard-coded (RWGE; display only, no result change)

Follow-up A1 of the second-pass fix round. Code sites are tagged `RWGE`.

### Problem
- `calcAll` factors the stem earth pressure with `gEH = isAASHTO ? (A.ep_cond === 'atrest' ? 1.35 : 1.50) : 1.6` (AASHTO LRFD 10th Ed. (2024) Table 3.4.1-2, EH maximum: active 1.50, at-rest 1.35). M_u, V_u, the mid-height and the M-along-height values all use it.
- The Stem tab (`renderStem`, Step 1) and the Report (§5.1 Step 1, `rwrModel` "4. Stem") wrote their own `gEH = isAASHTO ? 1.50 : 1.6`. With at-rest pressure they showed "Strength I: 1.50EH + 1.75LS", γ_EH = 1.50 and an M_u,soil 11 % too high, while the total M_u below it was the 1.35 value.
- Display only: the computed demands were always right (checked below). Only the shown component and the shown factor were wrong. The stem is designed for Strength I maximum only; no minimum EH factor enters the stem, so no min/max choice is shown.

### Fix
`renderStem`, anchor `const gEH = r.isAASHTO ? 1.50 : 1.6;`:
```js
// before
  const gEH = r.isAASHTO ? 1.50 : 1.6;
// after
  const gEH = r.gEH;   // RWGE (2026-11-07): the analysis' factor ...
```
- Card reference: `'Strength I: 1.50EH + 1.75LS'` → `'Strength I: ' + F(gEH,2) + 'EH + 1.75LS'`.
- Step label: `(γ_{EH}=1.50)` → `(γ_{EH}=<gEH>[, at-rest], Table 3.4.1-2)`.

`rwrModel`, section "4. Stem", anchor `const subs = [], gEH = isA ? 1.50 : 1.6`:
- `gEH = isA ? 1.50 : 1.6` → `gEH = r.gEH`;
- label `'(γ_EH = 1.50)'` → `'(γ_EH = ' + rwrN(gEH, 2) + [', at-rest'] + ', Table 3.4.1-2)'`;
- Step 1 reference `'Table 3.4.1-1, Strength I: 1.50EH + 1.75LS'` → with `rwrN(gEH, 2)`.

`r.gEH` is the value `calcAll` already returns (RWSC). ACI shows 1.6 as before. The shear-key factor (passive as EH, 1.50) is not touched: Table 3.4.1-2 gives 1.50 for passive whatever the backfill condition.

### Governing provision
AASHTO LRFD 10th Ed. (2024) Table 3.4.1-2 (γ_p for EH: active 1.50 / 0.90, at-rest 1.35 / 0.90). No factor or formula changed.

### Check case (AASHTO default wall, Pressure Condition "At-rest K₀", OCR 1)
- K_0 = 1 − sin 30° = 0.5000.
- M_u,soil = 1.35 × 0.5 × 120 × 12³ / 6 = **23328 lb-ft/ft** (shown before: 1.50 × … = 25920).
- M_u,LS = 1.75 × 0.5 × 357 × 12² / 2 = 22491; M_u = 23328 + 22491 = **45819 lb-ft/ft**: the tool's total, before and after (#6 @ 7).
- Active (default): 1.50 and 17280 / 25920 as before; only the label gains "Table 3.4.1-2".

### How verified
- Headless, origin/main vs branch, `calcAll` on the 32 review walls plus AASHTO at-rest (spread and pile): **no value differs**; 0 console errors.
- Stem tab text and the Report model: only the at-rest factor, M_u,soil and the reference move; the default AASHTO wall gains "Table 3.4.1-2" in the label; ACI identical.
- Tests: check-syntax; smoke/retaining-wall-checks; phone-layout rwall; project-library retwall; dxf-print-sheets rw; retwall-pile-handoff; engine handoffs, pile-group.

### Saved data
- No input or format change.
## 2026-11-07 — PR: claude/rw-pile-bottom-mat (PR #1149: https://github.com/mlococo88/All-Structural/pull/1149) — Pile-supported footing: the bottom mat stays at the footing cover c_c, between the pile heads (was lifted onto the pile heads, cover = embedment + clear); punching and the ACI cap depth keep the depth over the pile heads (RWPB; calculation change, pile mode only)

Engineer instruction (2026-11-07, paraphrased): on piles the bottom footing bars must stay at the normal bottom position; they are not to be lifted onto the pile heads. The bars run between and around the embedded pile heads (the usual New England detail). This applies to every project, old saves included, with no option. Depths that physically start at the pile head (punching, the pile-cap depth) stay as they are. Code sites are tagged `RWPB`.

### RWPB-1. Problem
- RWPL Phase 8d (#961) set `cov_bot = max(c_c, embedment + clear)` on piles: 15 in at the defaults (12 + 3). The toe d, the toe ℓ_d / λ_rc cover, the toe crack control, the stem-hook length available and the Drawings bottom mat all used it.
- Consequences at the defaults: toe crack control FAILed with a negative s_max (ACI −22.5 in, AASHTO −18.3 in), the toe d was 12 in short, and a warning asked for "a bar mat below the pile heads, or the engineer's judgement". The 8d decision "the bottom cover on piles is max(c_c, embedment + clear)" is superseded by this instruction.

### RWPB-2. Fix (`calcAll`)
Before (anchor `RWPL (2026-11-07, Phase 8d): on piles the bottom mat sits on the pile heads`):
```js
  const cov_bot = (inp.fnd && inp.fnd.type === 'pile') ? Math.max(inp.cov_ftg, (+inp.fnd.embed || 0) + (+inp.fnd.clr || 0)) : inp.cov_ftg;
```
After:
```js
  const cov_bot = inp.cov_ftg;
  const cov_ph  = (inp.fnd && inp.fnd.type === 'pile') ? Math.max(inp.cov_ftg, (+inp.fnd.embed || 0) + (+inp.fnd.clr || 0)) : inp.cov_ftg;
```
- `cov_bot` (now c_c) feeds, unchanged in code: `d_toe`, the toe ℓ_d cover (ACI ψ / AASHTO λ_rc c_b), `aciCr.toe`, the AASHTO toe `crackSpacing`, `ldh_avail = t_f − cov_bot` (the stem hook bears on the bottom mat) and the Drawings `rwdwBars` `cb` (F2/F3 and the S1D hook drawn at the bottom; the piles project through the mat, embedded length dashed, as before). The heel already used c_c.
- Punching: `dp = inp.tf - cov_bot - sel_toe.bar.db` → `dp = inp.tf - cov_ph - sel_toe.bar.db`. The depth over the pile head stays t_f − max(c_c, embedment + clear) − d_b, the abutment calculator's C-13 rule (`d_e = h_p − c_top − d_b`, h_p = t_f − embedment). The ACI "Cap Depth over Bars" row (§13.4.6.1, d_p ≥ 12 in) uses the same d_p, as before. The embedment check is unchanged.
- `cov_ph` is returned with the pile results.
- Warning (pile mode), was "Pile cap: the bottom bars sit … in above the base (embedment + clear) … fails for large covers …" (shown when cov_bot > 6). Now, always on piles: "Pile cap: the bottom bars are at the footing cover c_c = … in and pass between the pile heads, which project … in into the footing. Detail the bars to clear the piles (bar spacing against the pile width D; field adjustment of bars at a pile). Punching uses the depth over the pile heads, t_f − … in − d_b."
- Display: Footing tab Toe Step 3 c_c description; the punching step "d_p = t_f − c_ph − d_b" with c_ph explained; Report Toe Step 3 label and the punching step (`r.cov_ph`). The Report's cap-depth step cited "ACI 318-19 §13.3.1.2"; it now cites §13.4.6.1, as the check row has since RW2L1 (#1144) (citation in the Report only; the check is unchanged).

### Governing provisions
- Engineer instruction 2026-11-07 (detailing basis).
- ACI 318-19 §20.5.1.3 / AASHTO LRFD 10th Ed. (2024) Art. 5.10.1 (cover: the footing cover input, unchanged); d of the toe per ACI 318-19 §22.2 / AASHTO Art. 5.6.2; crack control ACI 318-19 §24.3.2 / AASHTO Art. 5.6.7.
- Punching: ACI 318-19 §22.6.4.1, Table 22.6.5.2; AASHTO Art. 5.12.8.6.1 / 5.12.8.6.3 (unchanged; depth over the pile heads).

### Check cases
**Default pile wall, ACI** (t_f 36 in, c_c 3, embedment 12, clear 3, rows 1.5 / 11.0 ft at s 6 ft; toe F2 #6 @ 6, A_s 0.88 in²/ft; M_u 17521.6 lb-ft/ft, V_u 11681 lb/ft):
- d: before 36 − 15 − 0.375 = 20.625 in; after 36 − 3 − 0.375 = **32.625 in**.
- a = 0.88(60000)/(0.85·4000·12) = 1.294 in. φM_n: before 0.9(0.88)(60000)(20.625 − 0.647) = 949,352 lb-in (79.1 kip-ft/ft, D/C 0.221); after 0.9(0.88)(60000)(32.625 − 0.647) = **1,519,590 lb-in** (126.6 kip-ft/ft, **D/C 0.138**).
- One-way shear (λ_s = √(2/(1 + d/10))): before φV_c 11584 lb/ft, D/C 1.008 **FAIL**; after λ_s 0.685, ρ_w 0.002248, φV_c = 0.75·8(0.685)(0.002248)^⅓√4000(12)(32.625) = **13330 lb/ft**, D/C 0.876 **PASS**.
- Crack control (f_s = 40 ksi): before s_max = 15 − 2.5(15) = −22.5 in **FAIL**; after min(15 − 2.5(3), 12) = **7.5 in** ≥ 6 **PASS**.
- Stem hook available: 21 → **33 in** (ℓ_dh 8.5 in).
- Punching (row 1): d_p = 36 − 15 − 0.75 = 20.25 in, unchanged: 77.4 ≤ 403.0 kip, D/C 0.192. Cap depth 20.25 ≥ 12 in, unchanged.

**Default pile wall, AASHTO** (M_u 23433 lb-ft/ft, V_u 15622 lb/ft, M_s 15907 lb-ft/ft):
- d 20.75 (#4 @ 7) → **32.81 in** (#3 @ 6, the minimum now governs with A_s 0.22 in²/ft).
- φM_n 379,504 → **387,891 lb-in**; D/C 0.741 → **0.725**. φV_c 35384 → **40314 lb/ft** (D/C 0.441 → 0.388).
- Crack control s_max −18.3 → **16.2 in** (FAIL → PASS).
- Punching d_p 20.5 → 20.625 in (smaller toe bar); d_v = max(0.9d_p, 0.72t_f) = 25.92 in either way, D/C 0.154 unchanged.

**Review pile variant** (β 15°, q_s 250, water 6 ft, key 18 in, passive, k_h 0.20, t_f 36):
- ACI: d 20.625 → 32.625; φM_n 949,352 → 1,519,590 lb-in; φV_c 11584 → 13330; crack −22.5 → 7.5 in (FAIL → PASS).
- AASHTO: toe #5 @ 7 → #4 @ 7; d 20.69 → 32.75; φM_n 582,459 → 601,675 lb-in; φV_c 35384 → 40237; crack −18.6 → 16.1 in (FAIL → PASS); toe ℓ_d 14.8 → 12.0 in (c_b now with c_c).

### How verified
- Headless, origin/main vs branch, `calcAll` on the 32 review walls plus AASHTO at-rest (spread and pile): only pile walls move, and only the toe d and what follows from it (toe bars, φM_n, φV_c, ℓ_d, crack control, stem-hook length available, the warning). Spread footings identical; pile reactions and the Pile Designer hand-off identical. 0 console errors.
- Drawings sheet 1 on piles looked at: bottom mat at the bottom cover, pile heads projecting 12 in through it.
- Tests: check-syntax; smoke/retaining-wall-checks (the RWPL 8d row now expects d_toe 32.625 with cov_bot 3, cov_ph 15, toe crack control and shear PASS; punching and cap-depth rows unchanged); phone-layout rwall; project-library retwall; dxf-print-sheets rw; retwall-pile-handoff; engine handoffs, pile-group.

### Decisions (pending engineer review)
- The punching depth keeps the abutment's C-13 rule (t_f − embedment − clear − d_b), conservative now that the bars are below the pile heads.
- The clear-cover input "clear, pile top to the bottom bars" is kept for that depth only; its label is unchanged.
- No in-tool check of bar clearance to the piles; the warning asks for it.
- The abutment calculator still lifts its bottom mat onto the pile heads (`cBot = embed + clrTop`); not changed here (one tool per PR).

### Saved data
- No input or format change. Old pile saves open with the mat at c_c (engineer instruction: no option).

## 2026-11-07 — PR: claude/rw-pile-thin-cap-error (PR #1151: https://github.com/mlococo88/All-Structural/pull/1151) — Pile-supported footing: a named input error when t_f ≤ embedment + clear + 2 in (the depth over the pile heads), never a throw; the page catches any calculation error (RWTE; input-validation change, pile mode only; valid inputs: no result change)

Follow-up A2 of the second-pass fix round. Code sites are tagged `RWTE`.

### RWTE-1. Problem and root cause
- Report: in pile mode t_f = 8 in made the calculation throw while the page showed only "Input error: no results".
- Root cause (before #1149, RWPB): `calcAll` took the bottom cover on piles as max(c_c, embedment + clear) = 15 in, and its only thickness guard was the spread-footing rule `t_f ≤ c_c + 2`. With t_f ≤ 15.375 in the toe d of the first pass was ≤ 0, the bar loop never ran, `sel_toe` stayed null and `shearVc(…, sel_toe.As_prov, …)` threw `TypeError: Cannot read properties of null (reading 'As_prov')`.
  - For t_f ≤ embedment + clear (8 in) the page's own validation (RWIE) blocked the calculation first, so the banner was named. Other callers of `calcAll` still threw.
  - For 15 < t_f ≤ 15.375 in, `onInputChange` itself threw: the page stopped updating, with no message.
- After RWPB (bottom bars at c_c) the toe no longer throws. But the depth over the pile heads d_p = t_f − embedment − clear − d_b was still unguarded, which gave nonsense punching results:
  - t_f 15.5 in: d_p = 0, D/C 5.9 × 10¹³;
  - embedment 3 / clear 3, t_f 6.5 in: d_p −0.5 in, negative φV_c;
  - a direct `calcAll` call at t_f 8 in: d_p −7.75 in with punching marked "ok".

### RWTE-2. Fix
- `calcAll`, after the spread "Footing too thin" rule (anchor `Stem too thin (`). Pile mode returns a fatal, named error when `t_f ≤ embedment + clear + 2`:
  "Footing too thin over the pile heads: t_f = … in must exceed embedment … in + clear … in + 2 in for the bars = … in (depth over the pile heads d_p = t_f − embedment − clear − d_b > 0). Increase t_f or reduce the pile embedment."
  The 2-in allowance for the bar is the same as in the spread rule. `rwIeIdOf` marks it on `tf` (/Footing too thin/).
- `calcAll`, defensive: if `sel_heel` or `sel_toe` is null after its bar loop, return a fatal error "Heel: d ≤ 0 (…)" / "Toe: d ≤ 0 (…)" (marked on `tf`) instead of throwing.
- Page validation (`rwInputErrors`, pile block): `embed + clr ≥ t_f` → `embed + clr + 2 ≥ t_f`. The message names the limit: "Embedment into the footing 12 in + clear 3 in + 2 in for the bars = 17.00 in is not less than the footing thickness t_f = 8 in: the depth over the pile heads would be ≤ 0. Increase t_f to more than 17.00 in or reduce the embedment."
- `onInputChange`: `calcAll` in try/catch. An unexpected error becomes the banner "Calculation error: <message>. No results for these inputs; …" (fatal, no results). The page keeps working, and the error goes to `console.warn`.

### §4 (input limit)
- **Before:** a pile footing gave results for t_f > embedment + clear (UI) and threw for 15 < t_f ≤ 15.375 in.
- **After:** results need t_f > embedment + clear + 2 in. Inputs with embedment + clear < t_f ≤ embedment + clear + 2 in now show the named input error instead of results with d_p ≤ ~1.25 in.
- This is not a formula change. Basis: d_p > 0 is required by the punching equations (ACI 318-19 §22.6.5.2; AASHTO LRFD 10th Ed. (2024) Art. 5.12.8.6.3). The 2-in bar allowance matches the tool's spread-footing rule.
- **Check cases** (defaults: embedment 12, clear 3; limit 17 in):
  - t_f 8 → error naming 17.00 in (was a throw from `calcAll`; the banner was named by RWIE);
  - t_f 15.5 → error (was d_p = 0, punching D/C 5.9e13);
  - t_f 17 → error (at the limit; d_p would be 17 − 15 − 0.75 = 1.25 in);
  - t_f 17.1 → results as before (d_p 1.6 in; punching FAILs; cap depth FAIL);
  - embedment 3 / clear 3, t_f 6.5 → error (was d_p −0.5);
  - spread footing t_f 5.5, cover 3 → unchanged (d 2.125).

### How verified
- Headless, origin/main vs branch:
  - `calcAll` on the 32 review walls plus the at-rest walls: identical. One run showed a probe state leak on `aci_var`; a re-run of that case was identical.
  - The cases above: the banner and `calcAll` give the named errors.
  - A forced throw from `calcAll` gives the "Calculation error" banner, and the page recovers on the next input.
  - 0 console errors.
- Tests:
  - check-syntax;
  - smoke/retaining-wall-checks (new RWIE rows RWTE t_f 8 and t_f 17 marked on `pile_embed`);
  - phone-layout rwall; project-library retwall; dxf-print-sheets rw; retwall-pile-handoff; engine handoffs, pile-group.

### Decision (pending engineer review)
- The limit is embedment + clear + 2 in, the same allowance as the spread rule. A thicker-cap minimum (ACI §13.4.6.1, d_p ≥ 12 in) stays a check row (FAIL), not an input error.

### Saved data
- No input or format change. A saved pile project with embedment + clear < t_f ≤ embedment + clear + 2 in now opens with the input error, and its inputs are kept.
## 2026-11-07 — PR: claude/rw-pile-tab — Piles output tab (pile-supported footing only): the pile cards move from the Stability tab, with a layout card, a pile-checks card and the Pile Designer hand-off card; links, chips and the Report follow (RWPT; display only) (PR #1148: https://github.com/mlococo88/All-Structural/pull/1148)

Engineer request (2026-11-07): "there is no output tab for the piles". Code sites are tagged `RWPT`. **Display and organisation only: no computed result changes** (§4), no saved field or key changes (§5).

### Tab
- New tab button `data-tab="piles"` ("Piles", `id="tabbtn-piles"`) after "Footing design", and panel `#tab-piles`.
  - Anchor: `<button class="tab-btn" data-tab="piles" id="tabbtn-piles" style="display:none">Piles</button>`.
  - Shown only for a pile-supported footing: `rwPileUI()` sets `tabbtn-piles` display with the pile-only inputs. Leaving pile mode while the tab is open opens Stability.
- `renderPiles(r)` (new; called by `onInputChange` after `renderFooting`). Input error: the common banner (`rwInputErrHTML`). Spread footing: a one-line note. Cards:
  1. **Pile Layout**: per row x from the toe, x from the heel (B − x), spacing, piles per ft (1/s); pile type, designation, D, embedment, clear, the bottom cover used (`r.cov_bot`, c_c since RWPB #1149) and the cover over the pile heads for punching (`r.cov_ph`), B × t_f, the capacities as entered, the passive credit.
  2. **Pile Step 1 — Pile Group (per ft of wall)** and 3. **Pile Step 2 — Pile Reactions and Checks**: moved **unchanged** from `rwPileStability` (the same HTML, equations and the RW2M3 pile–cap tension alert).
  4. **Pile Step 3 — Pile Checks**: every pile row of `r.checks` (pileComp, pileUplift, pileCapT, pileLat, pileSpacing, pileEdge, pileEmbed, pileCapD, pilePunch) with its value, D/C, PASS/FAIL, basis and a "worked in" link (`RW_CHECK_CARD`); failing rows shaded (`.tbl tr.rwpt-ng`).
  5. **Pile Designer Hand-off** (`rwptHandoff(r)`): loads sent (the `bridgeSuite.v1.foundationLoads.by.retwall` copy: time, content hash, whether it equals what the wall sends now), results received (`pile_pxr` record and `r.pxr`: CURRENT / STALE / other, why), the imported inputs with Pile Designer's single-pile value and the group reduction (imported / `rec.geo`), the pulled per-combination results, and the same buttons as the Foundation card (`rwpxSendOpen`, `rwpxPullOpen`, `rwpxImportFile`, `rwpxClear`). Reads only; nothing is written.

### Stability tab
- `rwPileStability(r)`: before, it inserted the two pile cards at the top. After, it inserts **Pile-Supported Footing — Summary** (N, x̄, P_max with D/C, P_min, h = H/N with D/C, pile checks pass/fail count) with "Worked in" links to Pile Step 1, Step 2 and Step 3. The "not applicable" soil-card notes now end "(Piles tab, Pile Step 2)" (was "(Pile Step 2)").

### Links
- `RW_TABNAME`: + `piles: 'Piles'`.
- `RW_CARDS.stabPile`: tab `'stability'` → `'piles'` (key and title kept, so every `RW_CHECK_CARD` row, `rwWorkedIn`, the check summary chips, the Overview check table, the Drawings index and the Report "On screen" note follow). New keys `pileLay`, `pileGrp`, `pileCk`, `pilePD` (Piles tab) and `stabPileSum` (Stability).
- 3D pile-reaction label: "Worked on the Stability tab" → "Worked on the Piles tab".
- Text: warning RW2M1 pile note "(Stability tab, Pile Step 2)" → "(Piles tab, Pile Step 2)" (wording only); Report pile-schedule note "on screen: Stability tab" → "Piles tab"; DXF notes "(STABILITY TAB, PILE STEP 2)" → "(SEE PILES TAB, PILE STEP 2)" (the same length, so the sheets keep their scales: with "(PILES TAB, …)" the loads sheet of a pile wall moved from 1/8" to 3/16" = 1'-0").

### Report
- Section "Pile-supported footing" → **"Piles (pile-supported footing)"**, as the tab.
- New sub **Pile Step 3 — Pile checks**: the table of the tab's Pile Step 3 (value, D/C, basis, status, "see §" to the step that works it), with the on-screen link.
- `rwTabSource` / `rwrTabNotes` / `rwrAddNotes`: + `piles`. The pile cards' alerts (RW2M3 pile–cap tension) moved with the cards: they are now in "Notes on the Piles tab" of the pile section (were in "Notes on the Stability tab").

### Decision (pending engineer review)
- The Pile Designer payload (`rwpxBuild`) is **unchanged**: its `pileLayout.distribution` text "(Stability tab, Pile Step 2)" is inside the content hash, so editing it would mark every pulled result STALE. Its notes keep the same wording.
- The hand-off buttons stay on the Foundation card as well (the tab repeats them).
- Spacing row: ACI / IBC has none (IBC 2018 has no minimum spacing, §1810.2.5), as before; the Pile Step 3 note says so.

### How verified
- Headless probe, origin/main (95d5810) vs this branch, 9 walls (ACI and AASHTO spread; ACI pile default, t_f 36 with water 2 ft (uplift), seismic 3 rows with passive; AASHTO pile default, EE I + collision 4 rows with water): `window._R` identical except the RW2M1 warning wording; Report text differs only in the section title, the new Pile Step 3 and the notes moved to the Piles tab; DXF identical except the two note lines; 0 console errors.
- Tests: check-syntax; smoke/retaining-wall-checks (AUD rows read the Piles tab; new RWPT block: shown only on piles, after Footing design, cards, KaTeX, buttons, the chip "Pile Compression" lands on Pile Step 2, the Stability summary link, the Report section, back to Stability on spread, input-error banner; RW2L3 phone 390 px includes the Piles tab); phone-layout rwall; project-library retwall; dxf-print-sheets rw; retwall-pile-handoff; engine handoffs.
