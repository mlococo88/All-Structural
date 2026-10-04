# Fix log — Bridge Substructure Loading.html

Governing basis used for fixes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024)

## 2026-10-04 — PR: claude/fix-subloads (PR link added after merge)

### F1. Minimum support length: Zone 2 percentage 100% → 150%   [calc change] [more conservative]
- **Where:** function `supportLength` (≈ line 1945 at time of fix). Anchor text: `pct = Z === 1 ? (As < 0.05 ? 75 : 100)`
- **Problem:** Zone 2 used 100% of N. Table 4.7.4.4-1 requires 150% for Zones 2, 3 and 4. Zone 2 bridges were under-required by one third.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 4.7.4.4, Table 4.7.4.4-1 (Zone 1, As < 0.05: ≥ 75%; Zone 1, As ≥ 0.05: 100%; Zones 2, 3, 4: 150%).
- **Before:**
  ```js
  const Z = SM.site.zone, As = SM.site.As, pct = Z === 1 ? (As < 0.05 ? 75 : 100) : Z === 2 ? 100 : 150, D = MODEL.dist, out = [];
  ```
- **After:**
  ```js
  const Z = SM.site.zone, As = SM.site.As, pct = Z === 1 ? (As < 0.05 ? 75 : 100) : 150, D = MODEL.dist, out = [];
  ```
- **Check case:** abutment end of a 200 ft unit, average pier height H = 20 ft, skew 0°, Zone 2.
  N = (8 + 0.02·200 + 0.08·20)(1 + 0.000125·0²) = 13.60 in.
  Before: pct = 100, N_req = 13.60 in. After: pct = 150, N_req = 20.40 in.
  Zone 1 (As = 0.12) is unchanged at 100% (13.60 in); Zone 3 is unchanged at 150% (20.40 in).
- **How verified:** the actual `supportLength` function was extracted from the old and new files and run in node (`sl_test.js`) with stubbed `P`/`MODEL`. The numbers above are its output. `node --check` on the inline script.
- **Other copies of this code:** none. (`abutment_calculator.html` has its own support-length check; not touched here.)

### F2. Dynamic ice: F = min(Fb, Fc) only when w/t ≤ 6   [calc change] [more conservative]
- **Where:** function `iceCalc` (≈ line 1728). Anchor text: `Fb = al > 15 ? Cn * p * t * t : Infinity, F =`
- **Problem:** for noses inclined more than 15°, F was always taken as the lesser of Fc and Fb. Art. 3.9.2.2 allows the lesser value only when w/t ≤ 6.0; for w/t > 6.0, F = Fc. Wide piers with inclined noses were under-loaded.
- **Governing provision:** AASHTO LRFD 10th Ed., Art. 3.9.2.2 (Eqs. 3.9.2.2-1 to -5).
- **Before:**
  ```js
  const wd = up.we, Ca = Math.sqrt(5 * t / wd + 1), Fc = Ca * p * t * wd, Cn = al > 15 ? 0.5 / Math.tan(rad(al - 15)) : Infinity, Fb = al > 15 ? Cn * p * t * t : Infinity, F = al > 15 ? Math.min(Fb, Fc) : Fc;
  ```
- **After:**
  ```js
  const wd = up.we, Ca = Math.sqrt(5 * t / wd + 1), Fc = Ca * p * t * wd, Cn = al > 15 ? 0.5 / Math.tan(rad(al - 15)) : Infinity, Fb = al > 15 ? Cn * p * t * t : Infinity, F = al > 15 && wd / t <= 6 ? Math.min(Fb, Fc) : Fc;   // 3.9.2.2: lesser of Fc and Fb only for w/t <= 6; F = Fc for w/t > 6
  ```
  Display: a `w/t` row was added to the ice table in `iceHtml` (just above the "Dynamic ice force F" row), and the manual sentence "otherwise the lesser of F<sub>c</sub> and F<sub>b</sub> = C<sub>n</sub>pt²." now ends "… when w/t ≤ 6 (F = F<sub>c</sub> when w/t > 6)."
- **Check case:** t = 1.0 ft, p = 24 ksf, α = 45°.
  - w = 8 ft (w/t = 8): Ca = √(5·1/8 + 1) = 1.2748; Fc = 1.2748·24·1·8 = 244.75 kip; Cn = 0.5/tan 30° = 0.8660; Fb = 0.8660·24·1² = 20.78 kip. Before: F = 20.78 kip. After: F = 244.75 kip.
  - w = 5 ft (w/t = 5): Fc = 1.4142·24·1·5 = 169.71 kip, Fb = 20.78 kip. Before and after: F = 20.78 kip (unchanged).
- **How verified:** the actual `const wd = up.we, …` line was extracted from both files and run in node (`sl_test.js`). `node --check` on the inline script.
- **Other copies of this code:** none known.

### F3. At-rest earth pressure: EH load factors 1.35/0.90   [calc change] [less conservative for at-rest abutments with the default factors]
- **Where:** function `comboComps` (the live combination engine, ≈ line 2725). Anchor text: `const EH = ((P.units[k].earth || {}).method === 'atrest')`
- **Problem:** abutments set to "At rest, k₀" used the active EH factors 1.50/0.90. Table 3.4.1-2 gives 1.35/0.90 for at-rest earth pressure.
- **Governing provision:** AASHTO LRFD 10th Ed., Table 3.4.1-2 (EH: active 1.50/0.90; at-rest 1.35/0.90).
- **Before:**
  ```js
  const EH = [nz(br.ehMax) || 1.5, nz(br.ehMin) || 0.9], EV = [nz(br.evMax) || 1.35, nz(br.evMin) || 1.0], ES = [nz(br.esMax) || 1.5, nz(br.esMin) || 0.75];
  ```
- **After:**
  ```js
  const EH = ((P.units[k].earth || {}).method === 'atrest') ? [nz(br.ehAtMax) || 1.35, nz(br.ehAtMin) || 0.9] : [nz(br.ehMax) || 1.5, nz(br.ehMin) || 0.9] /* Table 3.4.1-2: EH at-rest 1.35/0.90, active 1.50/0.90 */, EV = [nz(br.evMax) || 1.35, nz(br.evMin) || 1.0], ES = [nz(br.esMax) || 1.5, nz(br.esMin) || 0.75];
  ```
  Supporting edits:
  - `defP` patch in `patchEarth`: added `ehAtMax: 1.35, ehAtMin: 0.90` after `ehMin: 0.90,`.
  - `paneBridge` patch: added inputs `fld('γ<sub>EH</sub> max, at rest', 'br.ehAtMax') + fld('γ<sub>EH</sub> min, at rest', 'br.ehAtMin')` after the `br.ehMin` field. The note now reads "(active EH; at-rest EH applies to abutments set to k₀)".
  - The earth-tab note `Load factors: EH …` shows the at-rest pair for an at-rest abutment.
  - The `basisExtra` "Backfill" row adds "(at rest x/y)" when any abutment uses k₀.
  - Saved data: the new `br.ehAtMax` / `br.ehAtMin` fields are optional. Old projects without them get 1.35/0.90 through the `|| 1.35` / `|| 0.9` fallback. No key or format change.
- **Check case:** one abutment unit, Strength I with LL off, unfactored DC = 150 kip, DW = 10, SH = 20, EH = 40 (all same sign).
  - Before (k₀): max = 1.25·150 + 1.50·10 + 20 + **1.50**·40 = 282.50; min = 0.90·150 + 0.65·10 + 20 + 0.90·40 = 197.50.
  - After (k₀): max = 187.5 + 15 + 20 + **1.35**·40 = 276.50; min = 197.50 (unchanged).
  - Rankine/Coulomb abutments: unchanged (282.50 / 197.50).
- **How verified:** `lfOf`, `comboComps` and `comboEval` were extracted from both files and run in node with stubbed loads (`sl_test.js`). `node --check` on the inline script.
- **Note:** the older `combine` wrapper in the "combinations" block of the earth section (`const pf = (v, gg, hi) => …`) still uses the active pair. That wrapper is superseded by the final `combine = function (k)` that calls `comboComps`, so it is not used. It was left unchanged, per the instruction not to refactor the `combine` monkey-patches.
- **Other copies of this code:** none.

### F4. Shrinkage load factor γSH option (0.5 with gross stiffness)   [calc change, opt-in] [no result change with the default]
- **Where:** function `comboComps` (≈ line 2733). Anchor text: `fix(p4.SH && sc(p4.SH,`
- **Problem:** SH was always combined at γ = 1.0. Table 3.4.1-3 gives γSH = 0.50 for substructures analysed with gross stiffness I_g, and 1.0 with I_effective. The tool's own column stiffness factor `br.Ifac` defaults to 1.0 (that is, gross I_g), but the analysis basis is the engineer's decision, so the default stays at 1.0 (old behaviour; conservative).
- **Governing provision:** AASHTO LRFD 10th Ed., Table 3.4.1-3 (substructures supporting non-segmental superstructures: CR, SH using I_g 0.50; using I_effective 1.00).
- **Before:**
  ```js
  perm(DC, L.dc, 'DC'); perm(D.DW, L.dw, 'DW'); fix(p4.SH, 'SH');
  ```
- **After:**
  ```js
  perm(DC, L.dc, 'DC'); perm(D.DW, L.dw, 'DW'); fix(p4.SH && sc(p4.SH, num(br.gSH) === 0.5 ? 0.5 : 1.0), 'SH');   // γSH, Table 3.4.1-3: 0.5 with I_g, 1.0 with I_eff
  ```
  New input in the Temperature section (after "Shrinkage + creep strain"):
  `fld('γ<sub>SH</sub> (Table 3.4.1-3)', 'br.gSH', '', 'sel', { options: [['1.0', '1.0 (substructure analysed with I_eff)'], ['0.5', '0.5 (substructure analysed with gross I_g)']] })`.
  The "Analysis options" basis row now prints `γSH = 1.00/0.50 (Table 3.4.1-3)`. The `br.gSH` field is optional; missing or blank = 1.0.
- **Check case:** same as F3 with k₀ and γSH = 0.5: max = 187.5 + 15 + 0.5·20 + 54 = 266.50 (was 276.50 with γSH = 1.0); min = 135 + 6.5 + 10 + 36 = 187.50 (was 197.50). With the default (blank / 1.0), the results are identical to before.
- **How verified:** node run of the extracted `comboComps` (`sl_test.js`).
- **Other copies of this code:** the superseded earlier `combine` versions (≈ lines 1761, 1961, 2093) add SH at 1.0. They are not used by the final engine and were left unchanged (no refactor of the monkey-patches).

## Open items (not changed)
- O1. **Service IV wind pair (0.75V with γWS = 1.00).** Line `const vLS = key => key === 'III' ? nz(P.br.V) : key === 'V' ? 80 : key === 'SI' ? 70 : 0.75 * nz(P.br.V);` and `c.gws = 1.0`. My understanding of the 8th Ed.+ framework (Table 3.8.1.1.2-1 Service IV = 0.75V; Table 3.4.1-1 Service IV γWS = 1.00) says this is consistent, so I did not change it. I could not open the 10th Ed. text from this environment. — Engineer to confirm against the 10th Ed. Table 3.8.1.1.2-1 and Table 3.4.1-1. The file's own PENDING item for this is left in place.
- O2. **γSH default.** The default stays at 1.0. Because `br.Ifac` defaults to 1.0 (gross I_g), Table 3.4.1-3 would give 0.5 for a default model. — Engineer to decide whether the default should follow `Ifac` (for example 0.5 when Ifac = 1.0).
- O3. **EE I EH factor (`gEHEQ`, default 1.0).** Table 3.4.1-1 lists γp for EH in EE I. Not changed (EOR judgment, review item 5).
- O4. The `combine` monkey-patch chain was not refactored (by instruction).
