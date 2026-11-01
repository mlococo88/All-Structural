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

## 2026-11-01 — PR: claude/rpt-retwall — Report output tab in the shared report viewer (RWRP; display only, no calculation change) (PR link added after merge)

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
- `node tests/check-syntax.mjs "Retaining Wall Designer.html"`: all scripts pass. `node tests/engine/run.mjs report steps steps-groups report-wiring`: 14 passed (shared/report.js changed, see `fixlog/shared-report.md`).
- Screenshots 1280 / 390 px and the print PDFs were checked by eye (title block, contents, running header, page numbers, worked steps).

### Other copies
- None. `shared/README.md` lists the tool as a user of `steps.js` and `report.js`. The narrow-screen fix in `shared/report.js` is logged in `fixlog/shared-report.md`.

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
