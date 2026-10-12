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
