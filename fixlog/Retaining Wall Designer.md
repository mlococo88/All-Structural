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
