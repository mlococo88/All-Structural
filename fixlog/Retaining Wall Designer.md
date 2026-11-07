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

## 2026-11-07 — PR: claude/rw-varheight-both-modes — Variable-height wall offered in both modes; the locked Stem Height box shows why (RWVH; display only, no result change)

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
