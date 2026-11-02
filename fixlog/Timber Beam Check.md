# Fix log — Timber Beam Check.html

Governing basis used for fixes: NDS 2018 (ANSI/AWC NDS-2018) and NDS Supplement 2018 Ed., ASD; ASCE 7-16 Sec. 2.4.1 ASD load combinations; IBC Table 1604.3 for the deflection limits (user-editable).

## 2026-10-04 — PR: claude/fix-timber (PR #6: https://github.com/mlococo88/All-Structural/pull/6)

Scope: the engineer asked for this tool to be **fixed fully**. The calculation engine was rewritten as one pure function, `runTimberCheck(inp)`, placed between `SIZES_DB` and `// --- UI COMPONENTS ---`. The old inline engine in the component (from `// --- CALCULATION ENGINE ---` / `// Safe parsing inputs` down to `const dcr_def = ...`) was replaced by a single call:

```js
            // --- CALCULATION ENGINE (see runTimberCheck) ---
            const res = runTimberCheck({ span, spacing, bearingLen, bearingInterior, unbracedLen, wDead, wLive, wSnow, wWind, wRoofLive, pointLoads, loadCombo, selfWeight,
                species, grade, sizeLabel, customB, customD, isManual, manualProps, customMaterials, moisture, temp, incising, repetitive, flatUse,
                creepFactor, notchDepth, deflLimitLL, deflLimitTL, latSupport });
```

To re-apply by hand, copy the block from `// --- DATABASE ---` to `// --- UI COMPONENTS ---` from this commit. The per-fix entries below give the exact old and new lines for each item. The file keeps its CRLF line endings.

### Worked check case (requested by the engineer)

DF-L No.2 2x10 joists at 16 in. o.c., simple span 14 ft, D = 10 psf, L = 40 psf. Other inputs are at the tool defaults: self-weight on (34 pcf), repetitive on, dry, ≤ 100 °F, not incised, edgewise, continuous lateral support, bearing 3.5 in. at the member end, Kcr = 1.5, no notch.

Section: b = 1.5 in., d = 9.25 in., A = 13.875 in², S = 21.39 in³, I = 98.93 in⁴.
Loads: trib = 16/12 = 1.333 ft; w_self = 34 × 13.875/144 = 3.276 plf; w_D = 10 × 1.333 + 3.276 = 16.61 plf; w_L = 40 × 1.333 = 53.33 plf; D + L = 69.94 plf.

| Item | Before | After | Hand check (after) |
|---|---|---|---|
| Fb (reference) | 900 × 0.75 (grade "mod") = 675 | 900 (Table 4A DF-L No.2) | — |
| CF | 1.0 (formula, d ≤ 12) | 1.1 (Table 4A, 10 in. wide) | — |
| Fb′ (D+L, CD 1.0, Cr 1.15) | 675 × 1.15 = 776 psi | 900 × 1.0 × 1.1 × 1.15 = 1138.5 psi | — |
| M (D+L) | 1713.6 ft-lb | 1713.6 ft-lb | 69.94 × 14²/8 = 1713.6 |
| fb | 961.3 psi | 961.3 psi | 1713.6 × 12/21.39 = 961.3 |
| **fb/Fb′** | **1.238 (NG)** | **0.844 (OK)** | 961.3/1138.5 |
| V at d (D+L) | 435.7 lb | 435.7 lb | 489.6 − 69.94 × 0.771 = 435.7 |
| fv / Fv′ | 47.1/180 = 0.262 | 47.1/180 = 0.262 | 1.5 × 435.7/13.875 = 47.1 |
| R (max of both ends) | 489.6 (left only) | 489.6 | 69.94 × 7 |
| Cb | 1.107 (applied at end bearing) | 1.0 (end bearing) | NDS 3.10.4 |
| Fc⊥′ | 692 psi | 625 psi | 625 × 1.0 |
| fc⊥ / Fc⊥′ | 93.3/692 = 0.135 | 93.3/625 = 0.149 | 489.6/(1.5 × 3.5) = 93.3 |
| E′ | 1,600,000 | 1,600,000 | — |
| ΔD | 0.091 in. | 0.091 in. | 5wL⁴/384EI with w = 16.61 plf |
| ΔL | 0.291 in. (computed, not checked) | 0.291 in. = L/577 | 5 × 4.444 × 168⁴/(384 × 1.6e6 × 98.93) = 0.291 |
| LL check, L/360 = 0.467 in. | not checked | 0.624 | 0.291/0.467 |
| ΔT = 1.5ΔD + ΔL | 0.427 in. | 0.427 in. | 1.5 × 0.091 + 0.291 |
| TL check, L/240 = 0.700 in. | 0.610 | 0.610 | 0.427/0.700 |
| Headline | 123.8 % Bending (NG) | 84.4 % Bending, combination D + L (OK) | — |

Governing combinations (after): D + L for bending, shear and bearing. The D-only combination (CD 0.9) gives fb/Fb′ = 228/1024.7 = 0.223.

**Less conservative:** the old tool failed this joist (123.8 %) because of the double grade reduction (Fb 675) and the missing CF = 1.1. The corrected result is 84.4 %. Bearing is slightly more conservative (0.135 → 0.149).

Source of numbers: before = the ORIGINAL file's lines 67-88 and 361-482, extracted verbatim and run in node; after = the new `runTimberCheck` extracted verbatim from the edited file and run in node; also confirmed in the rendered report (React 18.2 server render of the transpiled page).

### F1. Reference design values: per-grade tabulated values replace base × grade multiplier   [calc change] [mixed: see below]
- **Where:** `DEFAULT_SPECIES`, `GRADES_DB` (≈ lines 67-79 at time of fix), the new `REF_4A` and `REF_4B_SP` tables, and the reference-value block of `runTimberCheck`. Anchor: `const REF_4A = {`
- **Problem:** the species base values were already the No.2 values, and Fb was then multiplied by a grade "mod" (No.2 0.75, No.1 0.85, SS 1.0, Stud 0.60). So DF-L No.2 used Fb = 675 instead of 900, and SS used 900 instead of 1500. E/Emin never changed with grade: Stud stiffness was unconservative, SS was conservative. The SP values (Fb 850) were not Table 4B values.
- **Governing provision:** NDS Supplement 2018 Ed., Table 4A (DF-L, HF, SPF) and Table 4B (Southern Pine).
- **Before:**
  ```js
  'DF-L': { name: 'Douglas Fir-Larch', G: 0.50, dens: 34, F_b: 900, F_v: 180, E: 1600000, F_c_perp: 625, Emin: 580000 },
  'SP': { name: 'Southern Pine', G: 0.55, dens: 36, F_b: 850, F_v: 175, E: 1400000, F_c_perp: 565, Emin: 510000 },
  'HF': { name: 'Hem-Fir', G: 0.43, dens: 30, F_b: 850, F_v: 150, E: 1300000, F_c_perp: 405, Emin: 470000 },
  'SPF': { name: 'Spruce-Pine-Fir', G: 0.42, dens: 29, F_b: 875, F_v: 135, E: 1400000, F_c_perp: 425, Emin: 510000 },
  ...
  'SS': { name: 'Select Structural', mod: 1.0 }, 'No.1': { name: 'No. 1', mod: 0.85 }, 'No.2': { name: 'No. 2', mod: 0.75 }, 'Stud': { name: 'Stud', mod: 0.60 },
  ...
  const gMod = GRADES_DB[grade] ? GRADES_DB[grade].mod : 1.0; // Safety check here
  return { Fb: s.F_b * gMod, Fv: s.F_v, E: s.E, Emin: s.Emin, FcPerp: s.F_c_perp, G: s.G, dens: s.dens };
  ```
- **After:** `DEFAULT_SPECIES` keeps only name, G and dens (for self-weight); `GRADES_DB` keeps only names. The values are in the table below, coded as `[Fb, Ft, Fv, Fc_perp, Fc, E, Emin]`:
  ```js
  const REF_4A = {
      'DF-L': { 'SS': [1500, 1000, 180, 625, 1700, 1900000, 690000], 'No.1': [1000, 675, 180, 625, 1500, 1700000, 620000], 'No.2': [900, 575, 180, 625, 1350, 1600000, 580000], 'Stud': [700, 450, 180, 625, 850, 1400000, 510000] },
      'HF':   { 'SS': [1400, 925, 150, 405, 1500, 1600000, 580000], 'No.1': [975, 625, 150, 405, 1350, 1500000, 550000], 'No.2': [850, 525, 150, 405, 1300, 1300000, 470000], 'Stud': [675, 400, 150, 405, 800, 1200000, 440000] },
      'SPF':  { 'SS': [1250, 700, 135, 425, 1400, 1500000, 550000], 'No.1': [875, 450, 135, 425, 1150, 1400000, 510000], 'No.2': [875, 450, 135, 425, 1150, 1400000, 510000], 'Stud': [675, 350, 135, 425, 725, 1200000, 440000] },
  };
  const REF_4B_SP = { 'No.2': { '2-4': [1100, null, 175, 565, null, 1400000, 510000], '5-6': [1000, null, ...], '8': [925, ...], '10': [800, ...], '12': [750, ...] } };
  ```
  A grade or size that is not built in (SP SS/No.1/Stud, Stud 8 in. and wider, timbers) shows a red "No results" panel that tells the user to use Manual values. It never falls back to another grade.
- **Effect:** DF-L No.2 Fb goes from 675 to 900 (**less conservative**, now correct). DF-L SS goes from 900 to 1500 (**less conservative**). Stud E goes from 1.6M to 1.4M (**more conservative**). SP No.2 2x10 Fb goes from 850 × 0.75 = 638 to 800 (**less conservative**), and SP No.2 2x4 goes from 638 to 1100 (**less conservative**).
- **Check case:** see the worked check case above (Fb′ 776 → 1138.5).
- **How verified:** node run of the old and new engines; React render.
- **Other copies of this code:** none known.

#### Reference values entered: please verify each one against the NDS Supplement (2018 Ed.)

Units are psi. "Conf." is my confidence in each value. Everything still needs verifying against the printed Supplement before the tool is relied on.

| Table | Species | Grade | Fb | Ft | Fv | Fc⊥ | Fc | E | Emin | Conf. |
|---|---|---|---|---|---|---|---|---|---|---|
| 4A | DF-L | Select Structural | 1500 | 1000 | 180 | 625 | 1700 | 1,900,000 | 690,000 | High |
| 4A | DF-L | No.1 | 1000 | 675 | 180 | 625 | 1500 | 1,700,000 | 620,000 | High |
| 4A | DF-L | No.2 | 900 | 575 | 180 | 625 | 1350 | 1,600,000 | 580,000 | High |
| 4A | DF-L | Stud | 700 | 450 | 180 | 625 | 850 | 1,400,000 | 510,000 | High |
| 4A | Hem-Fir | Select Structural | 1400 | 925 | 150 | 405 | 1500 | 1,600,000 | 580,000 | High |
| 4A | Hem-Fir | No.1 | 975 | 625 | 150 | 405 | 1350 | 1,500,000 | 550,000 | High |
| 4A | Hem-Fir | No.2 | 850 | 525 | 150 | 405 | 1300 | 1,300,000 | 470,000 | High |
| 4A | Hem-Fir | Stud | 675 | 400 | 150 | 405 | 800 | 1,200,000 | 440,000 | Medium-high (verify Ft, Fc) |
| 4A | SPF | Select Structural | 1250 | 700 | 135 | 425 | 1400 | 1,500,000 | 550,000 | High |
| 4A | SPF | No.1/No.2 (one combined grade in Table 4A) | 875 | 450 | 135 | 425 | 1150 | 1,400,000 | 510,000 | High |
| 4A | SPF | Stud | 675 | 350 | 135 | 425 | 725 | 1,200,000 | 440,000 | Medium-high (verify Ft, Fc) |
| 4B | Southern Pine | No.2, 2"-4" wide | 1100 | not entered | 175 | 565 | not entered | 1,400,000 | 510,000 | **Medium: VERIFY** (post-2013 SP values) |
| 4B | Southern Pine | No.2, 5"-6" wide | 1000 | not entered | 175 | 565 | not entered | 1,400,000 | 510,000 | **Medium: VERIFY** |
| 4B | Southern Pine | No.2, 8" wide | 925 | not entered | 175 | 565 | not entered | 1,400,000 | 510,000 | **Medium: VERIFY** |
| 4B | Southern Pine | No.2, 10" wide | 800 | not entered | 175 | 565 | not entered | 1,400,000 | 510,000 | **Medium: VERIFY** |
| 4B | Southern Pine | No.2, 12" wide | 750 | not entered | 175 | 565 | not entered | 1,400,000 | 510,000 | **Medium: VERIFY** |
| 4B | Southern Pine | Select Structural, No.1, Stud | **not entered** | | | | | | | Not confident. The tool requires Manual values. |

Ft and Fc are listed for completeness only. This tool has no axial load, so they are never used.

Factor tables entered (Table 4A footnotes; Table 4B uses the same Cfu and wet-service factors):

| Item | Value entered | Conf. |
|---|---|---|
| CF for Fb, SS/No.1/No.2, nominal width 2-4 / 5 / 6 / 8 / 10 / 12 / 14+ (2" & 3" thick) | 1.5 / 1.4 / 1.3 / 1.2 / 1.1 / 1.0 / 0.9 | High |
| Same, 4" thick | 1.5 / 1.4 / 1.3 / 1.3 / 1.2 / 1.1 / 1.0 | High |
| CF for Fb, Stud, 2-4 / 5-6 wide | 1.1 / 1.0 (8"+ → No.3 values, not built in) | High |
| Cfu, width 2-3 / 4 / 5 / 6 / 8 / 10+ (2" & 3" thick) | 1.00 / 1.10 / 1.10 / 1.15 / 1.15 / 1.20 | High |
| Cfu, 4" thick | — / 1.00 / 1.05 / 1.05 / 1.05 / 1.10 | High |
| SP (Table 4B) CF | 1.0 (size-specific values); 0.9 on Fb for widths over 12 in. (applied to the 12 in. values) | Medium-high |
| CM, dimension lumber | Fb 0.85 only if Fb·CF > 1150 psi; Fv 0.97; Fc⊥ 0.67; E/Emin 0.9 (Ft 1.0; Fc 0.8 if Fc·CF > 750, not used) | High |
| CM, timbers (Table 4D, Manual mode only) | Fb 1.00; Fv 1.00; Fc⊥ 0.67; E/Emin 1.00 | High |

### F2. No grade selector in the UI   [bug fix] [no result change for default No.2]
- **Where:** Material accordion, after the species `<select>`. Anchor: `{Object.keys(GRADES_DB).map(k=><option key={k} value={k}>{GRADES_DB[k].name}</option>)}`
- **Problem:** `grade` had no control. It was stuck at No.2, so SS, No.1 and Stud were unreachable except by loading a file.
- **Governing provision:** n/a
- **Before:** (no control)
- **After:**
  ```jsx
  {!customMaterials[species] && (
      <select value={grade} onChange={e=>setGrade(e.target.value)} className="w-full p-2 text-xs border rounded dark:bg-slate-800 dark:border-slate-600">
          {Object.keys(GRADES_DB).map(k=><option key={k} value={k}>{GRADES_DB[k].name}</option>)}
      </select>
  )}
  ```
- **Check case:** render test shows the select. Picking HF SS 2x10 gives Fb′ = 1400 × 1.1 × 1.15 = 1771 psi.
- **How verified:** React server render.
- **Other copies of this code:** none known.

### F3. Size factor CF: tabulated for dimension lumber; (12/d)^(1/9) only for timbers   [calc change] [less conservative for 2x4–2x10; more conservative for custom dimension lumber over 12 in.]
- **Where:** `runTimberCheck`, CF block. Anchor: `CF = T4A_CF_FB[wg][thick4 ? 1 : 0]`
- **Problem:** `CF = (d>12) ? (12/d)^(1/9) : 1.0` is the Beams & Stringers / Posts & Timbers rule (NDS 4.3.6.2). Dimension lumber uses the tabulated Table 4A CF.
- **Governing provision:** NDS Supplement 2018 Table 4A footnote (size factor); NDS 2018 4.3.6.2.
- **Before:**
  ```js
  const CF = (d_safe > 12) ? Math.pow((12/d_safe), 1/9) : 1.0;
  ```
- **After:**
  ```js
  if (cat === 'dim') {
      if (cfIncluded) { CF = (!userVals && inp.species === 'SP' && wg >= 14) ? 0.9 : 1.0; ... }
      else if (useStudCF) { CF = T4A_CF_FB_STUD[wg]; ... }
      else { CF = T4A_CF_FB[wg][thick4 ? 1 : 0]; ... }
  } else {
      CF = (!cfIncluded && d > 12) ? Math.pow(12 / d, 1 / 9) : 1.0; ...
  }
  ```
  The size class comes from the section. Thickness b ≤ 3.5 in. is dimension lumber; b ≥ 4.5 in. (5x5 and larger) is a timber. Width group: `widthGroup(d)` maps the actual dressed width to the nominal group, rounding a non-standard width UP to the next group. That gives the smaller CF, so it is conservative.
- **Behaviour change in Manual mode:** Table 4A CF is now applied to a manually entered Fb for dimension sizes (before, it was 1.0 for d ≤ 12). The new checkbox "Fb already size-specific (CF = 1.0, e.g. SP Table 4B)" turns this off. This is **less conservative** for manual users of 2x4–2x10 who had entered Table 4A values; it is now correct.
- **Check case:** 2x10 CF 1.0 → 1.1 (see the worked check case). 2x4 gets 1.5; 2x12 gets 1.0; a custom 1.5 × 13.25 gets 0.9 (before: (12/13.25)^(1/9) = 0.989).
- **How verified:** node run.
- **Other copies of this code:** none known.

### F4. Wet service factor CM per property   [calc change] [Fc⊥ more conservative; Fb/Fv/E less conservative]
- **Where:** `runTimberCheck`. Anchor: `const CM = { Fb: 1.0, Fv: 1.0, Fcp: 1.0, E: 1.0 };`
- **Problem:** 0.85 was applied to every property. That is unconservative for Fc⊥ (should be 0.67) and conservative for the others.
- **Governing provision:** NDS Supplement 2018 Table 4A/4B footnote, wet service factor; Table 4D for timbers.
- **Before:**
  ```js
  const CM = moisture === 'Wet' ? 0.85 : 1.0;
  ```
- **After:**
  ```js
  const CM = { Fb: 1.0, Fv: 1.0, Fcp: 1.0, E: 1.0 };
  if (wet) {
      if (cat === 'timber') { CM.Fcp = 0.67; }
      else { CM.Fb = (ref.Fb * CF > 1150) ? 0.85 : 1.0; CM.Fv = 0.97; CM.Fcp = 0.67; CM.E = 0.9; }
  }
  ```
- **Check case:** check-case joist, wet. Before: Fb′ 660 (0.85 × 776), Fv′ 153, Fc⊥′ 588, E′ 1.36M. After: Fb·CF = 990 ≤ 1150, so CM_Fb = 1.0 and Fb′ = 1138.5; Fv′ = 174.6; Fc⊥′ = 418.75; E′ = 1.44M. Bearing ratio 0.159 → 0.223.
- **How verified:** node run (`wet` case).
- **Other copies of this code:** none known.

### F5. Temperature factor Ct by range (Table 2.3.3)   [calc change] [more conservative for wet 125–150 °F; less conservative for E]
- **Where:** `ctFactors()` and `runTimberCheck`. Anchor: `const ctFactors = (temp, wet) => {`
- **Problem:** "High" applied 0.7 to everything, including E. That is unconservative for wet use at 125–150 °F (should be 0.5) and conservative for E (should be 0.9).
- **Governing provision:** NDS 2018 Table 2.3.3.
- **Before:**
  ```js
  const Ct = temp === 'High' ? 0.7 : 1.0;
  ```
- **After:**
  ```js
  const ctFactors = (temp, wet) => {
      if (temp === '100-125') return { E: 0.9, other: wet ? 0.7 : 0.8 };
      if (temp === '125-150' || temp === 'High') return { E: 0.9, other: wet ? 0.5 : 0.7 };
      return { E: 1.0, other: 1.0 };
  };
  ```
  The selector now offers "≤ 100°F" (value `Normal`), "100–125°F" and "125–150°F". The old value `High` maps to 125–150 °F, both in the engine and on load. Ft would also be 0.9 per Table 2.3.3, but it is not used here.
- **Check case:** check-case joist, wet, 125–150 °F. After: Ct = 0.5 on Fb/Fv/Fc⊥ and 0.9 on E. Fb′ = 569 psi, fb/Fb′ = 1.689. Before, the same state gave 0.7 everywhere (Fb′ = 0.85 × 0.7 × 776 = 462 with the old Fb).
- **How verified:** node run (`temp_wet_hot`).
- **Other copies of this code:** none known.

### F6. Incising factor Ci per property   [calc change] [less conservative for E/Emin and Fc⊥]
- **Where:** `runTimberCheck`. Anchor: `const Ci = { Fb: ciOn ? 0.80 : 1.0`
- **Problem:** 0.80 was applied to E, Emin and Fc⊥ as well.
- **Governing provision:** NDS 2018 4.3.8 (Table 4.3.8).
- **Before:**
  ```js
  const Ci = incising ? 0.80 : 1.0;
  ```
- **After:**
  ```js
  const Ci = { Fb: ciOn ? 0.80 : 1.0, Fv: ciOn ? 0.80 : 1.0, Fcp: 1.0, E: ciOn ? 0.95 : 1.0 };
  ```
- **Check case:** check-case joist, incised. E′ = 1.6M × 0.95 = 1.52M (before 1.28M); Fc⊥′ = 625 (before 0.8 × 692 = 553); Fb′ = 0.8 × 1138.5 = 910.8.
- **How verified:** node run.
- **Other copies of this code:** none known.

### F7. Flat use: weak-axis section properties and size-dependent Cfu   [calc change] [much MORE conservative]
- **Where:** `runTimberCheck`. Anchors: `const bw = flat ? d : b;` and `const Cfu = (flat && cat === 'dim')`
- **Problem:** Flat use multiplied Fb by Cfu = 1.1 but kept the edgewise S and I. That was grossly unconservative: for a 2x10 the flat S is about 1/6 of the edgewise S.
- **Governing provision:** NDS Supplement 2018 Table 4A/4B flat use factor; NDS 2018 3.3.3.1 (CL = 1.0 when d ≤ b).
- **Before:**
  ```js
  const Cfu = flatUse ? 1.1 : 1.0;
  const Sx = (b_safe * d_safe * d_safe) / 6;
  const Ix = (b_safe * d_safe * d_safe * d_safe) / 12;
  ```
- **After:**
  ```js
  const bw = flat ? d : b;   // bending width
  const dep = flat ? b : d;  // bending depth
  const S = bw * dep * dep / 6;
  const I = bw * dep * dep * dep / 12;
  const Cfu = (flat && cat === 'dim') ? T4A_CFU[wg][thick4 ? 1 : 0] : 1.0;
  ```
  The bending depth and width are used everywhere downstream (stability, shear at d, notch, bearing width). Flat use of timbers is blocked (Table 4D factors are not built in).
- **Check case:** check-case joist laid flat. Before: S = 21.39, Cfu = 1.1, fb/Fb′ = 1.126. After: S = 9.25 × 1.5²/6 = 3.469 in³, Cfu = 1.20, fb = 5928 psi, Fb′ = 1366 psi, fb/Fb′ = 4.34; I = 2.60 in⁴, LL deflection ratio 23.7.
- **How verified:** node run (`flat`).
- **Other copies of this code:** none known.

### F8. Bearing area factor Cb only away from the member end   [calc change] [more conservative by default]
- **Where:** `runTimberCheck`. Anchor: `const Cb = (inp.bearingInterior && lb < 6)`
- **Problem:** Cb = (lb + 0.375)/lb was applied at the end reaction and was never capped for lb ≥ 6 in.
- **Governing provision:** NDS 2018 3.10.4 (bearing < 6 in. long and ≥ 3 in. from the member end).
- **Before:**
  ```js
  const Cb = ((bearingLen||3.5) + 0.375) / (bearingLen||3.5);
  ```
- **After:**
  ```js
  const Cb = (inp.bearingInterior && lb < 6) ? (lb + 0.375) / lb : 1.0;
  ```
  New checkbox: "Bearing ≥ 3 in. from member end (Cb)". Default off (end bearing, Cb = 1.0). It is saved as `bearingInterior`.
- **Check case:** lb = 3.5 in. Before Cb = 1.107 (Fc⊥′ 692); after 1.0 (625). With the box ticked, 1.107.
- **How verified:** node run (`checkcase`, `interiorCb`).
- **Other copies of this code:** none known.

### F9. Shear and bearing use the larger reaction; design shear between d from either support   [calc change] [more conservative for unsymmetric loads]
- **Where:** `runTimberCheck`, per-combination block. Anchors: `const shearRegion =` and `const Rbear = Math.max(bm.RL, bm.RR, 0);`
- **Problem:** `V_crit` and `fcp` used R_left only. A point load near the right support gave unconservative shear and bearing.
- **Governing provision:** NDS 2018 3.4.3.1(a); 3.10.2.
- **Before:**
  ```js
  let V_crit = R_left - w_total * d_ft; // at d
  pointLoads.forEach(pl => { if (d_ft > (pl.loc||0)) V_crit -= (pl.mag||0); });
  const fcp_actual = R_left / (b_safe * (bearingLen||3.5));
  ```
- **After:**
  ```js
  const shearRegion = L > 2 * dft ? [...new Set([...xs.filter(x => x >= dft && x <= L - dft), dft, L - dft])] : xs;
  ...
  shearRegion.forEach(x => { const v = Math.max(Math.abs(bm.V(x, false)), Math.abs(bm.V(x, true))); if (v > Vd) { Vd = v; xV = x; } });
  const Rmax = Math.max(Math.abs(bm.RL), Math.abs(bm.RR));
  const Rbear = Math.max(bm.RL, bm.RR, 0);
  const fcp = Rbear / (bw * lb);
  ```
  The point-load x/d reduction of NDS 3.4.3.1(b) is not applied. This is conservative; see O4.
- **Check case:** check-case joist plus a 1000 lb D point load at 12 ft. R_L = 489.6 + 1000 × 2/14 = 632.5; R_R = 489.6 + 1000 × 12/14 = 1346.7. Before: V_crit = 578.5 lb (left), fc⊥ = 120.5 psi. After: Vd = 1292.8 lb at x = L − d, fv/Fv′ = 0.776; fc⊥ = 1346.7/5.25 = 256.5 psi, ratio 0.410.
- **How verified:** node run (`asym_point`).
- **Other copies of this code:** none known.

### F10. Deflection: point loads included, live/snow check added, limits editable   [calc change] [more conservative]
- **Where:** `runTimberCheck`, deflection block. Anchor: `const DEFL_TRANSIENT = [`
- **Problem:** Deflection used only the uniform w, so point loads were ignored. `del_L` used only `wLive`, so S and Lr were ignored. `deflLimitLL` (L/360) was never checked. Neither limit had a control.
- **Governing provision:** NDS 2018 3.5.1, 3.5.2 (Kcr); IBC Table 1604.3 for the limits (user-editable).
- **Before:**
  ```js
  const del_unif = (w) => (5 * (w/12) * Math.pow(span_safe*12, 4)) / (384 * E_p * Ix);
  const del_D = del_unif(w_D);
  const del_L = del_unif(wLive*trib); // Use Live component
  const del_LT = del_D * (creepFactor||1.5) + del_L;
  ...
  const dcr_def = del_long_term / ((span_safe*12)/(deflLimitTL||240));
  ```
- **After:** for each station, deflection = uniform w·x(L³ − 2Lx² + x³)/(24E′I) plus each point load (standard simple-beam expressions, superposed). Per load type (D, L, Lr, S):
  - ΔLL = max over the transient cases {L, Lr, S, 0.75L + 0.75Lr, 0.75L + 0.75S}; check ΔLL ≤ L/`deflLimitLL`.
  - ΔT = max over the same cases of (Kcr·ΔD(x) + Δtransient(x)); check ΔT ≤ L/`deflLimitTL`.
  - `dcr.def = Math.max(r_dLL, r_dTL)`.
  - Point loads take their load type (new per-load selector; default D).
  - New inputs: "Live/snow defl. limit L/" (default 360) and "Total defl. limit L/" (default 240).
- **Check case:** worked check case: ΔL = 0.291 in., LL ratio 0.624 (before: not checked); TL unchanged at 0.610. Closed-form checks of the engine: a central 1000 lb point load gives 0.62407 in. = PL³/48EI exactly; a 1000 lb load at 3 ft gives 0.38372 in. = Pa(L²−a²)^1.5/(9√3·LEI).
- **How verified:** node run against the closed forms.
- **Other copies of this code:** none known.

### F11. Roof live load Lr input   [bug fix] [more conservative]
- **Where:** Loads accordion. Anchor: `label="Roof Live (Lr) psf"`
- **Problem:** `wRoofLive` had no control, so "D + Lr" analysed D only with CD 1.25.
- **Governing provision:** ASCE 7-16 2.4.1.
- **Before:** (no control)
- **After:**
  ```jsx
  <NumberInput label="Roof Live (Lr) psf" value={wRoofLive} onChange={setWRoofLive} />
  ```
  The labels of the other load inputs now show psf, and W is "+ down".
- **Check case:** D = 10, Lr = 20 psf, 14 ft. D + Lr: w = 43.28 plf, M = 1060 ft-lb, fb/Fb′ = 595/(1138.5 × 1.25) = 0.418.
- **How verified:** node run (`roofLr`).
- **Other copies of this code:** none known.

### F12. All ASD combinations evaluated; governing combination shown; two combinations added   [calc change] [more conservative]
- **Where:** `COMBOS`, `LOAD_CD`, and the per-combination loop in `runTimberCheck`. Anchor: `const combos = COMBOS.map(c => {`
- **Problem:** Only the one user-picked combination was checked. D + 0.75L + 0.75(0.6W) + 0.75(Lr or S) and 0.6D + 0.6W were missing. The label "0.9D" was misleading (the load was 1.0D with CD = 0.9).
- **Governing provision:** ASCE 7-16 2.4.1 (combinations 1-7); NDS 2018 2.3.2 (CD of the shortest-duration load in the combination).
- **Before:**
  ```js
  switch(loadCombo) {
      case 'D': w_total = w_D; Cd = 0.9; comboName="0.9D"; break;
      case 'D+L': ... Cd = 1.0 ...  case 'D+S': ... 1.15 ...  case 'D+Lr': ... 1.25 ...
      case 'D+0.75(L+S)': ... 1.15 ...  case 'D+0.6W': ... 1.6 ...
  }
  ```
- **After:** 10 combinations: D; D+L; D+Lr; D+S; D+0.75L+0.75S; D+0.6W; D+0.75L+0.75Lr; D+0.75L+0.75(0.6W)+0.75Lr; D+0.75L+0.75(0.6W)+0.75S; 0.6D+0.6W. For each:
  ```js
  const present = Object.keys(c.f).filter(t => c.f[t] !== 0 && (wu[t] !== 0 || pls.some(p => p.type === t && p.mag !== 0)));
  const CD = present.length ? Math.max(...present.map(t => LOAD_CD[t])) : LOAD_CD.D;
  ```
  - CD follows the shortest-duration load actually present. A wind combination with W = 0 therefore takes the CD of the other loads in it.
  - Governing = the maximum ratio per check (bending, shear, bearing), shown on the rings, in the hero card and in the report table (section 7).
  - The old `loadCombo` selector now only picks the combination shown in the V/M diagrams (default "Governing for bending (auto)"). Old saved keys are still valid.
- **Check case:** check-case joist. All 10 combinations are listed. D + L governs: 0.844. D alone: 0.223.
- **How verified:** node run.
- **Other copies of this code:** none known.

### F13. Beam stability: le per Table 3.3.3 and the RB ≤ 50 limit   [calc change] [slightly more conservative with point loads]
- **Where:** `runTimberCheck`. Anchor: `leRule = '2.06 lu (lu/d < 7)'`
- **Problem:** le = 1.63lu + 3d was always used, and RB ≤ 50 was not enforced.
- **Governing provision:** NDS 2018 Table 3.3.3 and its footnote 1; 3.3.3.7.
- **Before:**
  ```js
  const le = 1.63 * Lu + 3 * d_safe;
  ```
- **After:**
  ```js
  if (luD < 7) { le = 2.06 * lu; ... }
  else if (hasPL && luD > 14.3) { le = 1.84 * lu; ... }
  else { le = 1.63 * lu + 3 * dep; ... }
  ...
  if (stabilityApplies && RB > 50) fails.push(`Slenderness RB = ... exceeds 50 (NDS 3.3.3.7). Not permitted.`);
  ```
  - Uniform load only: the Table 3.3.3 single-span uniform-load row (2.06lu below lu/d = 7; 1.63lu + 3d at or above 7).
  - With point loads, the loading is uniform + concentrated, which the table does not specify. Footnote 1 applies: 2.06lu / 1.63lu + 3d / 1.84lu above lu/d = 14.3.
  - The specific concentrated-load rows are not used (they are less conservative; see O5).
  - **Disagreement with the reviewer:** the reviewer listed 1.84lu for *uniform* load at lu/d > 14.3. My reading is that the 14.3 break is only in footnote 1, and the uniform-load row stays at 1.63lu + 3d. Please confirm (O6).
- **Check case:** 2x10, lu = 16 ft (lu/d = 20.8), uniform load only: le = 1.63 × 192 + 3 × 9.25 = 340.7 in. (unchanged). With a point load present: le = 1.84 × 168 = 309.1 in. for a 14 ft span (before 301.6).
- **How verified:** node run (`unbraced`, `asym_point`).
- **Other copies of this code:** none known.

### F14. Notched ends: full reaction, and the d/4 limit   [calc change] [more conservative]
- **Where:** `runTimberCheck`. Anchors: `const fvn = hasNotch ? 1.5 * Rmax / (bw * dn) : 0;` and `exceeds d/4`
- **Problem:** The notch check used V at distance d from the support, not the full reaction. The NDS 4.4.3 notch-depth limit was not checked.
- **Governing provision:** NDS 2018 3.4.3.2(a); 4.4.3.2 (end notch ≤ d/4).
- **Before:**
  ```js
  const fv_actual = (1.5 * V_crit) / (Area * ((notchDepth||0) > 0 ? dn_rat : 1));
  ```
- **After:**
  ```js
  const fvn = hasNotch ? 1.5 * Rmax / (bw * dn) : 0;
  ... r_vn = hasNotch ? fvn / (Fv_p * Cn) : 0 ... r_v: Math.max(r_v1, r_vn)
  if (hasNotch && notch > dep / 4) fails.push(`End notch ... exceeds d/4 ... (NDS 4.4.3.2). Not permitted.`);
  ```
  The unnotched shear check at d is still done, and the larger ratio governs. A notch over d/4 makes the member NG (red banner, "Code limit violated (NG)").
- **Check case:** check-case joist, 2 in. end notch. dn = 7.25 in., Cn = (7.25/9.25)² = 0.6143. Before: fv = 1.5 × 435.7/(1.5 × 7.25) = 60.1 psi, ratio 0.543. After: fv,n = 1.5 × 489.6/(1.5 × 7.25) = 67.5 psi; Fv′·Cn = 110.6; ratio 0.611. With a 3 in. notch (> 2.31 in.), the member is flagged NG.
- **How verified:** node run (`notch`, `bignotch`).
- **Other copies of this code:** none known.

### F15. Headline DCR includes bearing and code-limit failures   [bug fix] [more conservative]
- **Where:** hero card. Anchor: `res.fails.length ? 'Code limit violated (NG)' : res.ctrlName`
- **Before:**
  ```jsx
  {Math.max(dcr_b, dcr_v, dcr_def) === dcr_b ? "Bending Moment" : Math.max(dcr_b, dcr_v, dcr_def) === dcr_v ? "Shear" : "Deflection"}
  ```
- **After:** `ctrl` = the maximum of bending, shear, bearing and deflection, computed in `runTimberCheck`. The hero card shows the governing combination (or which deflection check governs). Code-limit failures (RB > 50, notch > d/4) turn it red with "Code limit violated (NG)".
- **Check case:** n/a (display). Check-case headline: 84.4 % Bending, D + L (CD = 1).
- **How verified:** React render.
- **Other copies of this code:** none known.

### F16. Report and diagram display errors   [display] [no result change]
- **Where:** report section 5 and `DiagramsPanel`. Anchors: `formula:"M × 12 / S"` and `{hoverX !== null ? valM.toFixed(0) : maxM.toFixed(0)} ft-lb`
- **Problem:** "Max Moment" printed maxM/12 labelled ft-lb (maxM is already ft-lb, so it was 12× too small). The diagram badge did the same. The fb trace omitted ×12. The "Design Shear" trace printed `maxV - w*d`, but the value came from R_left.
- **Before:**
  ```js
  { label:"Max Moment", ..., res:(maxM/12).toFixed(0), unit:"ft-lb", ... },
  { label:"Design Shear", sym:"V*", formula:"Vmax - w*d", sub:`${maxV.toFixed(0)} - ${w_total.toFixed(0)}*${(d/12).toFixed(2)}`, ... },
  { label:"Act Bending", sym:"fb", formula:"M / S", sub:`${maxM.toFixed(0)} / ${Sx.toFixed(2)}`, ... },
  {hoverX !== null ? (valM/12).toFixed(0) : (maxM/12).toFixed(0)} ft-lb
  ```
- **After:**
  ```js
  { label:"Max Moment", sym:"Mmax", formula:"statics, uniform + point loads", sub:`${gb.name}, x = ${gb.xM.toFixed(2)} ft`, res:gb.Mmax.toFixed(0), unit:"ft-lb", ref:"Statics" },
  { label:"Act Bending", sym:"fb", formula:"M × 12 / S", sub:`${gb.Mmax.toFixed(0)} × 12 / ${res.S.toFixed(2)}`, ... },
  { label:"Design Shear", sym:"V", formula:"max |V| between d from each support", sub:`${gv.name}, x = ${gv.xV.toFixed(2)} ft, d = ...`, ... },
  {hoverX !== null ? valM.toFixed(0) : maxM.toFixed(0)} ft-lb
  ```
  The report also gained: the reference values with their source; per-property CM/Ct/Ci and Cb rows; full Fb′/Fv′/Fc⊥′/E′/Emin′ substitutions; bearing and notch lines; a deflection section (6); and an all-combinations table (7).
- **Check case:** check case report: Mmax = 1714 ft-lb (before it displayed 143), fb = 1714 × 12/21.39 = 961 psi.
- **How verified:** React server render (text checked).
- **Other copies of this code:** none known.

### F17. V/M stations include point-load positions and zero-shear points   [calc change] [slightly more conservative]
- **Where:** `runTimberCheck`. Anchor: `const xs = [...new Set([...Array.from({ length: 101 }`
- **Problem:** 101 equal stations could miss the moment peak under a point load.
- **Before:**
  ```js
  for (let i=0; i<=pts; i++) { const x = i * dx; ... }
  ```
- **After:** the stations are the 101 equal points plus every point-load position. The analytical zero-shear point in each segment is added as a candidate for Mmax. Shear is evaluated on both sides of each point load. The diagram hover now looks up by x (the stations are no longer uniform).
- **Check case:** 16 ft, D + L 76.61 plf, plus 800 lb L at 12 ft. Zero shear at x = 812.9/76.61 = 10.61 ft; Mmax = 812.9 × 10.61 − 76.61 × 10.61²/2 = 4313 ft-lb (matches the report).
- **How verified:** node run and React render.
- **Other copies of this code:** none known.

### F18. Save/load: all inputs saved; robust load; legacy files load; wWind restored   [robustness] [no result change]
- **Where:** `saveProject` and `loadProject`. Anchor: `// Older files (span, spacing, wDead, wLive`
- **Problem:** Only 11 fields were saved. Point loads, bearing, unbraced length, factors, notch, custom size, creep, manual properties and custom species were silently lost on reload. `JSON.parse` had no try/catch, and `wWind` was saved but not restored.
- **Before:**
  ```js
  const data = { span, spacing, wDead, wLive, wSnow, wWind, species, grade, sizeLabel, loadCombo, projectInfo };
  ...
  const d = JSON.parse(ev.target.result);
  setSpan(d.span); setSpacing(d.spacing); setWDead(d.wDead); setWLive(d.wLive); setWSnow(d.wSnow || 0);
  setSpecies(d.species); setGrade(d.grade); setSizeLabel(d.sizeLabel); setLoadCombo(d.loadCombo || 'D+L');
  ```
- **After:**
  - The same file name (`timber_design.json`) and the same field names. The old 11 keys are unchanged; new fields are added: `wRoofLive, pointLoads, selfWeight, bearingLen, bearingInterior, unbracedLen, customB, customD, isManual, manualProps, customMaterials, moisture, temp, incising, repetitive, flatUse, creepFactor, notchDepth, costPerBF, deflLimitLL, deflLimitTL, latSupport`.
  - Load: JSON.parse is inside try/catch (an alert is shown on failure). Every field is type-checked and falls back to its default when missing or invalid. Enumerations are validated (species, grade, size, combination, temp, moisture, lateral support).
  - `temp: 'High'` maps to `'125-150'`. Custom species are accepted in either the new `{Fb, Fv, FcPerp, ...}` format or the old `{F_b, F_v, F_c_perp, ...}` shape. A point load without a type gets `D`.
  - The file input is reset so the same file can be re-opened.
- **Check case:** the `loadProject` code was extracted verbatim and run with stub setters:
  - A current-format (pre-fix) file loads. All 11 fields are restored, including wWind = 10 (before: dropped), and every new field is defaulted.
  - Malformed JSON shows an alert instead of an uncaught exception.
  - `{temp:'High', span:'abc', pointLoads:[{mag:100,loc:2},null]}` gives temp 125-150, span 16 (default), and 1 point load of type D.
- **How verified:** node harness (`loadtest.js`).
- **Other copies of this code:** none known. No localStorage is used by this tool.

### F19. Controls for inputs that had none; editable custom species   [bug fix] [no result change at defaults]
- **Where:** Loads, Material and Factors accordions; new `PropEditor` component. Anchor: `const PropEditor = ({ title, vals, onChange }) => (`
- **Problem:** `wRoofLive`, `deflLimitLL`, `deflLimitTL`, `selfWeight` and `manualProps` had no controls. "+ Add Custom" copied the DF-L values with no way to edit them.
- **After:**
  - Lr input (F11) and a self-weight checkbox.
  - Deflection limit inputs (F10).
  - Manual mode ("Man") shows an editor for Fb, Fv, Fc⊥, E, Emin, density, G and "Fb already size-specific".
  - A selected custom species shows the same editor. A new custom species starts from DF-L No.2 values and cannot reuse a built-in species name.
  - The reference values in use, and their source, are shown under the size selector.
- **Check case:** React render with Manual on: the editor renders, and the results equal DF-L No.2 at the same CF (Fb 900 manual).
- **How verified:** React render.
- **Other copies of this code:** none known.

### F20. Input validation: point-load location, section, bearing, limits   [robustness] [more conservative]
- **Where:** `runTimberCheck`, top. Anchor: `is outside the span (0 to`
- **Problem:**
  - A point-load location outside 0..L gave a negative reaction contribution and wrong results.
  - Blank inputs fell back silently (`bearingLen||3.5`, `customB||0.1`).
- **After:**
  - Invalid input (span or spacing ≤ 0, b or d ≤ 0, b > d, a non-standard thickness 3.5–4.5 in., bearing ≤ 0, a deflection limit ≤ 0, a point load outside the span, missing reference values, a negative or too-deep notch) gives a red "No results" panel that lists the problems.
  - An out-of-span location input is outlined in red.
- **Check case:** 500 lb at 20 ft on a 16 ft span gives "Point load 1: location 20 ft is outside the span (0 to 16 ft)." and no results.
- **How verified:** node run (`bad_pl`) and React render (`error_timber`).
- **Other copies of this code:** none known.

### F21. Repetitive member factor Cr limited to dimension lumber   [calc change] [more conservative for timbers]
- **Where:** `runTimberCheck`. Anchor: `const Cr = (inp.repetitive && cat === 'dim' && spacing <= 24)`
- **Problem:** Cr = 1.15 was applied to any size, including 6x and 8x timbers.
- **Governing provision:** NDS 2018 4.3.9 (dimension lumber 2"-4" thick).
- **Before:**
  ```js
  const Cr = (repetitive && spacing_safe <= 24) ? 1.15 : 1.0;
  ```
- **After:**
  ```js
  const Cr = (inp.repetitive && cat === 'dim' && spacing <= 24) ? 1.15 : 1.0;
  ```
  An informational note is shown when Cr is ticked but not applied.
- **Check case:** 6x8 in Manual mode: Cr = 1.0 (before 1.15).
- **How verified:** node run (`timber_manual`).
- **Other copies of this code:** none known.

### F22. Timbers (5x5 and larger) require Manual values   [calc change] [more conservative / blocks]
- **Where:** `runTimberCheck`. Anchor: `Timbers (5 in. x 5 in. and larger) use NDS Supplement Table 4D`
- **Problem:** 6x6, 6x8 and 8x8 were checked with dimension-lumber values. Posts & Timbers use Table 4D (different Fb, Fv, E and CM).
- **After:** In standard mode, a timber size shows "use Manual values". In Manual mode the tool applies CF = (12/d)^(1/9) for d > 12 in., the Table 4D CM (Fc⊥ 0.67 only), and Cr = 1.0.
- **Check case:** 6x8 standard gives the red panel. 6x8 Manual (900/180/625/1.6M/580k) gives fb/Fb′ = 0.735 (16 ft, defaults).
- **How verified:** node run and React render.
- **Other copies of this code:** none known.

## 2026-10-04 — "All tools" link and shared project info
### F23. "← All tools" link; "Use shared project info" / "Share project info" buttons   [feature (no result change)]
- **Date:** 2026-10-04. **Type:** feature (no result change). Approved by the engineer (step 1 of the cross-tool hand-off work, HANDOFF.md §4.1).
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, because tools can be shown inside index.html's iframe), placed in the sticky app header, left of the logo. It is hidden in print.
- **Shared project info:** two buttons in the "Project & Geometry" section, under the Job # / Designer inputs.
  - **Share** builds the full `fields` object (all 8 HANDOFF §4.1 fields, blank where this tool has no field) and calls `BridgeXfer.publish('projectMeta', {_schema:'bridge-project-meta', project:{name, bridgeId}, fields})`. Key: `bridgeSuite.v1.projectMeta` (+ `.updatedAt`).
  - **Use** calls `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm listing the producer, time, project and every field that will change (old → new), and writes only this tool's mapped fields. A blank shared value never blanks a field. Apply path: `setProjectInfo(pi => ({...pi, ...patch}))`. Records `bridgeSuite.v1.projectMeta.adopted.<id>`.
- **Field mapping (shared → this tool):**

  | Shared field | Tool field | Label |
  |---|---|---|
  | `client` | `projectInfo.client` | Client |
  | `jobNo` | `projectInfo.job` | Job # |
  | `preparedBy` | `projectInfo.designer` | Designer |

  Not mapped: projectName, bridgeId, location, checkedBy, date. Notes (`projectInfo.notes`) has no shared field.
- **Helpers added:** a plain `<script>` with BridgeXfer v1 verbatim from HANDOFF.md §5, then a plain `<script>` with `ProjMetaUI` (shown in full in the After code below) and this tool's field map. Both sit before the tool's own script (React/Babel tool: separate plain script before the app).
- **Storage:** no existing key or saved-data format changed. New keys only: `bridgeSuite.v1.projectMeta`, `.updatedAt`, `.adopted.<id>` (HANDOFF.md §2).
- **Line endings:** this file uses CRLF; the inserted lines use CRLF too.
- **Where / Before / After** (each change is an insertion; the Before text is the anchor and is kept):
  1. Anchor: `<div id="root"></div>`
     - Before:
       ```
           <div id="root"></div>

           <script type="text/babel" data-type="module">
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
       /* Timber Beam Check: shared project info field map ("Project & Geometry" section). */
       var TBC_PROJ_MAP=[{shared:'client',key:'client',label:'Client'},
                         {shared:'jobNo',key:'job',label:'Job #'},
                         {shared:'preparedBy',key:'designer',label:'Designer'}];
       </script>
           <script type="text/babel" data-type="module">
       ```
  2. Anchor: `<div className="flex items-center gap-4">`
     - Before:
       ```
                               <div className="flex items-center gap-4">
                                   <div className="bg-indigo-600 p-2 rounded-lg">
       ```
     - After:
       ```
                               <div className="flex items-center gap-4">
                                   <a href="tools.html" target="_top" title="Open the list of all tools" className="text-xs text-slate-500 hover:text-indigo-500">&larr; All tools</a>
                                   <div className="bg-indigo-600 p-2 rounded-lg">
       ```
  3. Anchor: `<div className="pt-4 border-t dark:border-slate-700">`
     - Before:
       ```
                                       <div className="pt-4 border-t dark:border-slate-700">
                                           <InputControl label="Span (ft)"
       ```
     - After:
       ```
                                       <div className="flex gap-2 mb-2 hide-print">
                                           <button type="button" title="Fill the project fields from project info shared by another tool" onClick={()=>{ const patch = ProjMetaUI.use(TBC_PROJ_MAP, projectInfo, 'timberBeamCheck'); if (patch) setProjectInfo(pi => ({...pi, ...patch})); }} className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">Use shared project info</button>
                                           <button type="button" title="Make these project fields available to the other tools" onClick={()=>ProjMetaUI.share(TBC_PROJ_MAP, projectInfo, 'Timber Beam Check', 'Timber Beam Check.html')} className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800">Share project info</button>
                                       </div>
                                       <div className="pt-4 border-t dark:border-slate-700">
                                           <InputControl label="Span (ft)"
       ```
- **Governing provision:** none. UI and cross-tool data hand-off only (HANDOFF.md §2, §4.1, §5). No formula, factor, unit, code reference or computed result changed.
- **Check case:** not applicable (no calculation touched). Functional check: Spread Footing shares {Project Name "Route 9 over Mill Brook", Project Number "J-2026-114", Calculated By "MRL", Date "2026-10-04", Checked By "JKD"}; Use in this tool fills the mapped fields; a blank shared value leaves the existing field unchanged.
- **How verified:** `node --check` on every plain inline script; text/babel blocks transpiled with @babel/standalone; page loaded in jsdom with CDN libraries stubbed (React UMD served locally); Share → Use exercised across Spread Footing, BasePlateAnchorDesigner, Pile Designer, Concrete Anchor and Timber Beam Check (Timber: plain scripts in jsdom, the same calls its onClick handlers make, since it imports React from esm.sh) with a localStorage carried between pages; `git diff --numstat` shows only insertions.
- **Other copies:** BridgeXfer v1 and `ProjMetaUI` are duplicated (CLAUDE.md §3) in Pile Designer.html, Spread Footing.html, BasePlateAnchorDesigner.html, Concrete Anchor.html and Timber Beam Check.html (this PR), plus any other tools that received BridgeXfer in their own step-1 PRs.
- **`ProjMetaUI`:** given in full in the After code of the helper insertion above; the copy is identical in every tool listed.

## 2026-10-09 — PR: claude/tabs-timber (PR #67: https://github.com/mlococo88/All-Structural/pull/67)

### T1. Input panel split into tabs   [UI only — no calculation change]
- **Date / type:** 2026-10-09, UI only (no result change). Engineer's request of 2026-10-09: "Go through all the apps and make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel."
- **Approach (React):** this tool is a React app, so DOM nodes are not moved (React owns them). Each of the four existing `<Accordion>` groups is wrapped, unchanged, in a `<div role="tabpanel" hidden={inTab !== '…'}>`. **All four panes are always rendered**; the inactive ones are only hidden (`hidden` attribute → `display:none` via Tailwind preflight). Nothing unmounts, so every input keeps its state, key and handler, and the accordions still open and close as before. A small `InputTabs` component draws the tab strip as the first child of the scrolling input column.
- **Tabs (in order) and the sections in each:**

| Tab | Section (Accordion title) | Inputs |
|---|---|---|
| Project & Geometry | Project & Geometry | Client, Job #, Designer, Use / Share shared project info, Span (ft), Spacing (in) |
| Loads | Loads & Combinations | Diagram combo, D / L / Lr / S / W (psf), Include self-weight, point loads (+ Add, magnitude, location, type, delete) |
| Material | Material & Section | Species (+ Add Custom), grade, size, Std/Man, custom b and d, Manual reference values / custom species values (PropEditor), Notch depth, Cost $/BF |
| Factors | Advanced Factors | Unbraced length, bearing length, bearing ≥ 3 in. from end (Cb), creep factor, L/ deflection limits, Ci, Cr, Ct, Cfu, CM, lateral support |

  The mode-dependent controls (grade select hidden for a custom species, custom b/d for size "Custom", PropEditor in Manual mode or for a custom species) are inside their accordions and show/hide exactly as before. No tab is ever empty, so none is hidden.
- **Error marker:** a red dot on a tab when (a) `runTimberCheck` reports an input error that names an input on it (`TBC_IN_ERR`: `Span/Spacing must …` → Project & Geometry; `Point load …` → Loads; section, reference-value, density, species/grade, timber, SP/Stud "not built in", flat-use-of-timbers and notch messages → Material; `Bearing length …` / `Deflection limits …` → Factors), (b) a field in it has the tool's own red error border (`border-red-500`, today the point-load location outside the span), or (c) a number field holds text the browser cannot parse (`validity.badInput`). Refreshed on every render and on every `input` event in the panel. Note: React restores a controlled number field at once, so in practice (c) rarely persists; a blanked field becomes NaN and, where the engine treats that as an error, (a) marks it.
- **Keyboard / accessibility:** `role="tablist"` / `role="tab"` (`aria-selected`, `aria-controls`) / `role="tabpanel"` (`aria-labelledby`); roving `tabIndex`; ←/→ (and ↑/↓) wrap, Home and End; focus follows the selected tab.
- **Look:** same style as the tool's own "Visual Analysis / Detailed Report" switch (`p-1 rounded-lg bg-slate-200`, buttons `px-3 py-1.5 text-xs font-bold rounded`, selected `bg-white shadow text-blue-600`; dark: `bg-slate-800` / `bg-slate-700 text-blue-400`). Sticky (`sticky top-0`) at the top of the scrolling input column, wraps (`flex-wrap`) on narrow screens. One row on desktop; two rows at 400 px.
- **New storage key:** `tbc_inputTab_v1` (localStorage, plain string `project`, `loads`, `material` or `factors`). This tool had no storage key of its own (file save/load only); the prefix `tbc` follows its existing `TBC_PROJ_MAP` identifier. Written only when the user picks a tab; every read and write is in try/catch, with an in-memory copy when storage is blocked; an unknown stored value falls back to Project & Geometry. It is **not** in the saved project JSON (`timber_design.json`) or any hand-off; no existing key or format changed.
- **Programmatic focus / scroll:** nothing in this tool focuses or scrolls to an input. Open project (file) and "Use shared project info" only set React state, which reaches hidden panes too; so no tab switching is needed.
- **Print:** the whole input column has `hide-print` (unchanged), so nothing printed changes. Checked: the body text under print media is identical on main and on this branch in all scenarios.
- **Governing provision:** none (no engineering change).
- **Where / Before / After** (file uses CRLF; the inserted lines use CRLF):
  1. Anchor `        // --- MAIN APP ---` (just above `function UniversalTimberStudio()`). Before: nothing. After: this block inserted just above the anchor (shown without the file's leading indent: 8 spaces in item 1, 12 in item 3):
    ```jsx
    // --- INPUT PANEL TABS (UI only) ---
    // The four input accordions are wrapped in tab panes. Every pane is always rendered and the
    // inactive ones are only hidden (hidden attribute), so no input unmounts and all state,
    // keys and handlers are unchanged. The active tab is remembered per browser in localStorage
    // key tbc_inputTab_v1 (never in the saved project file).
    const TBC_IN_TABS = [['project', 'Project & Geometry'], ['loads', 'Loads'], ['material', 'Material'], ['factors', 'Factors']];
    const TBC_IN_KEY = 'tbc_inputTab_v1';
    let tbcInTabMem = null; // in-memory copy, used when storage is unavailable
    const tbcInTabGet = () => { if (tbcInTabMem) return tbcInTabMem; try { return localStorage.getItem(TBC_IN_KEY) || ''; } catch (e) { return ''; } };
    const tbcInTabSet = (t) => { tbcInTabMem = t; try { localStorage.setItem(TBC_IN_KEY, t); } catch (e) {} };
    // runTimberCheck input errors, mapped to the tab that holds the input
    const TBC_IN_ERR = [
        [/^(Span|Spacing) must/, 'project'],
        [/^Point load /, 'loads'],
        [/^(Section b and d|b must not exceed d|Thickness between|Enter all reference design values|Enter the density|Unknown species|Unknown grade|Timbers |Southern Pine |Stud grade |Flat use of timbers|Notch depth)/, 'material'],
        [/ values are not built in/, 'material'],
        [/^(Bearing length|Deflection limits)/, 'factors'],
    ];
    const InputTabs = ({ active, onSelect, marks, isDark }) => {
        const onKey = (e) => {
            const i = TBC_IN_TABS.findIndex(([k]) => k === active);
            let j = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % TBC_IN_TABS.length;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + TBC_IN_TABS.length) % TBC_IN_TABS.length;
            else if (e.key === 'Home') j = 0;
            else if (e.key === 'End') j = TBC_IN_TABS.length - 1;
            if (j < 0) return;
            e.preventDefault();
            const k = TBC_IN_TABS[j][0];
            onSelect(k);
            const b = document.getElementById('tbcInTab_' + k); if (b) b.focus();
        };
        return (
            <div className={`sticky top-0 z-10 pb-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                <div role="tablist" aria-label="Input groups" className={`flex flex-wrap gap-1 p-1 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    {TBC_IN_TABS.map(([k, lab]) => {
                        const on = k === active;
                        return (
                            <button key={k} type="button" role="tab" id={'tbcInTab_' + k} aria-controls={'tbcInPane_' + k} aria-selected={on ? 'true' : 'false'} tabIndex={on ? 0 : -1}
                                title={marks[k] ? 'An input on this tab needs attention' : undefined}
                                onClick={() => onSelect(k)} onKeyDown={onKey}
                                className={`flex items-center px-3 py-1.5 text-xs font-bold rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${on ? (isDark ? 'bg-slate-700 shadow text-blue-400' : 'bg-white shadow text-blue-600') : 'text-slate-500'}`}>
                                {lab}
                                {marks[k] && <span aria-hidden="true" className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-red-500"></span>}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };
    ```
  2. Anchor `const [openSections, setOpenSections] = useState(` in `UniversalTimberStudio`. After: these lines inserted right after that line (12-space indent in the file):
    ```jsx
    const [inTab, setInTab] = useState(() => { const t = tbcInTabGet(); return TBC_IN_TABS.some(([k]) => k === t) ? t : 'project'; }); // input panel tab (UI only)
    const [inDomMarks, setInDomMarks] = useState('');
    ```
  3. Anchor `            // Helpers` (after `const ctrlDetail = …`). After: this block inserted just above the anchor (shown without the file's leading indent: 8 spaces in item 1, 12 in item 3):
    ```jsx
    // Input tab error dots: an input error reported by runTimberCheck, a field shown with a red
    // border, or a number field the browser cannot parse.
    const inPanelRef = React.useRef(null);
    const selectInTab = (t) => { setInTab(t); tbcInTabSet(t); if (inPanelRef.current) inPanelRef.current.scrollTop = 0; };
    const checkInDom = () => {
        if (!inPanelRef.current) return;
        const bad = TBC_IN_TABS.filter(([k]) => {
            const pn = document.getElementById('tbcInPane_' + k); if (!pn) return false;
            return !!pn.querySelector('.border-red-500') || Array.from(pn.querySelectorAll('input')).some(i => i.validity && i.validity.badInput);
        }).map(([k]) => k).join(',');
        setInDomMarks(m => m === bad ? m : bad);
    };
    useEffect(checkInDom);
    const inMarks = {};
    (res.errors || []).forEach(m => { const r = TBC_IN_ERR.find(x => x[0].test(m)); if (r) inMarks[r[1]] = true; });
    inDomMarks.split(',').forEach(k => { if (k) inMarks[k] = true; });
    ```
  4. Anchor `{/* CONTROLS */}`. The input column `<div>` gets a ref and an input handler, and the tab strip is its first child:
    - Before:
      ```jsx
      <div className="lg:col-span-4 space-y-4 hide-print h-[calc(100vh-120px)] overflow-y-auto pr-2 custom-scrollbar">
      ```
    - After:
      ```jsx
      <div ref={inPanelRef} onInput={checkInDom} className="lg:col-span-4 space-y-4 hide-print h-[calc(100vh-120px)] overflow-y-auto pr-2 custom-scrollbar">
      (existing whitespace-only line kept)
           <InputTabs active={inTab} onSelect={selectInTab} marks={inMarks} isDark={isDark} />
      ```
  5. Each of the four `<Accordion …> … </Accordion>` groups (anchors `{/* 1. PROJECT */}`, `{/* 2. LOADS */}`, `{/* 3. MATERIAL */}`, `{/* 4. FACTORS */}`) is wrapped, with no other change: the line `<div role="tabpanel" id="tbcInPane_<k>" aria-labelledby="tbcInTab_<k>" hidden={inTab !== '<k>'}>` is inserted right after the comment line, and a line `</div>` right after the closing `</Accordion>`, with `<k>` = `project`, `loads`, `material`, `factors` respectively. The Accordion lines themselves are unchanged.
- **Check case:** not applicable (no calculation touched). Functional check: default DF-L No.2 2x10, 16 ft at 16 in., D 15 / L 40 psf → 120.8 % Bending Moment, D + L, identical on main and branch; the 2026-10-04 worked check case (14 ft, D 10 psf) → identical report text.
- **How verified:**
  - Every inline script passes `node --check`; the `text/babel` block was transpiled first with @babel/standalone **8.0.7** (preset react, module), which is the version the unpinned unpkg URL serves today.
  - Headless Chromium (Playwright), page opened from `file://`. The CDNs are blocked in the test environment, so requests were served locally: @babel/standalone 8.0.7 and lucide 1.54.0 (the versions the unpinned `@babel/standalone` and `lucide@latest` URLs resolve to today); Tailwind 3.4.19 CSS compiled from the page's classes in place of the unpinned Play CDN script; React 18.2.0, react-dom 18.2.0/client and lucide-react 0.292.0 (the exact esm.sh versions) bundled to ESM with esbuild.
  - main vs branch, 9 scenarios (default; worked check case; Manual + Custom 3.5 x 11.25 + two point loads + notch + supports-only bracing + wet/incised/100–125 °F; HF SS 2x6 flat use; SP No.2 2x12; custom species; 6x8 timber error; SP SS + point load outside span + zero bearing + zero L/ limit; point-load error only), each loaded through the tool's own Open file input: Visual Analysis text, Detailed Report text (trace on and off), print-media body text, Save JSON file, and the ordered list of all input controls with values — **all identical** (66 comparisons; the report timestamp and the timing-dependent toast text are masked). Save → Open → Save round trip identical. Opening a file while the Factors tab is active gives the same results. "Share project info" payload (`bridgeSuite.v1.projectMeta`, minus `producedAt`) and "Use shared project info" → saved JSON identical.
  - Every input control (38 at defaults: Project & Geometry 8, Loads 9, Material 8, Factors 13, counting buttons) is present in the same order with the same value, and each is inside exactly one tab pane.
  - Tab clicks, ←/→/Home/End, focus, remembered tab after reload, unknown stored value, storage blocked (tabs still work, no errors), value kept across tab switches, red dots (Loads for a point load outside the span; Factors for a blank bearing length; Material for 6x8; three tabs for the multi-error file) and their clearing, sticky strip while the panel is scrolled, ARIA pairs. No console errors.
  - Screenshots of every tab at 1440 px and 400 px, dark mode, Manual values and an error dot were reviewed.
- **Open items:** at 400 px the existing header (logo, title, Trace / Save / Open / dark buttons) is 557 px wide and causes a horizontal page scroll; this is the same on main and is not caused by the tabs (the tab strip and input panel fit within 400 px). Not changed (UI outside the input panel). The unpinned libraries are already logged as O1.
- **Other copies:** none (UI code specific to this tool).

## 2026-10-09 — PR: claude/pin-timber (PR #73: https://github.com/mlococo88/All-Structural/pull/73)

### L1. CDN library versions pinned   [libraries — no calculation change]
- **Engineer's decision (2026-10-09):** pin the libraries (CLAUDE.md §2: exact versions in CDN URLs). Resolves the "pin the versions" half of O1.
- **Where:** the `<head>` of the file, lines ≈ 9, 12 and 15. Anchors: `<!-- Tailwind CSS -->`, `<!-- Babel for React -->`, `<!-- Lucide Icons -->`. Each library stays on its existing host.
- **Before / After (exact lines, 4-space indent, CRLF):**
  ```html
  -    <script src="https://cdn.tailwindcss.com"></script>
  +    <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  -    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  +    <script src="https://unpkg.com/@babel/standalone@7.29.10/babel.min.js"></script>
  -    <script src="https://unpkg.com/lucide@latest"></script>
  +    <script src="https://unpkg.com/lucide@1.54.0"></script>
  ```
- **Versions chosen (npm registry checked 2026-10-09):**
  - `@babel/standalone` **7.29.10**: the latest 7.x release. The unpinned URL now resolves to 8.0.7 (a new major); the tool was written for Babel 7.
  - `lucide` **1.54.0**: the version `@latest` serves today. The page does not use the `lucide` global (icons come from `lucide-react@0.292.0` via esm.sh), so any version works; unpkg serves the package's `unpkg` field, `dist/umd/lucide.min.js`.
  - Tailwind Play CDN **3.4.17** (`cdn.tailwindcss.com/<version>` path form, as already used by `Pile Designer.html` with 3.4.5). The page sets no `tailwind.config`.
- **Not changed:** the esm.sh imports are already exact (`react@18.2.0`, `react-dom@18.2.0/client`, `lucide-react@0.292.0`); esm.sh is not on the CLAUDE.md host list but pre-dates it and was not moved. Google Fonts is a stylesheet and needs no pin.
- **Check case:** not applicable (no calculation touched). Default DF-L No.2 2x10, 16 ft at 16 in., D 15 / L 40 psf and the 2026-10-04 worked check case (14 ft, D 10 psf → 84.4 % Bending Moment, D + L) give identical results on main and branch.
- **How verified:**
  - The CDNs are blocked in the test environment, so each URL was served locally in headless Chromium (Playwright, `file://`). main: @babel/standalone 8.0.7 and lucide 1.54.0 (what the unpinned URLs serve today) and Tailwind 3.4.19 CSS compiled from the page's classes. Branch: @babel/standalone 7.29.10, lucide 1.54.0 and Tailwind 3.4.17 CSS compiled from the page's classes (stand-in for the Play CDN script, which is not on npm). Both: React 18.2.0, react-dom 18.2.0/client and lucide-react 0.292.0 bundled to ESM with esbuild. A request log confirmed each page fetched exactly its own URLs.
  - The compiled Tailwind 3.4.17 and 3.4.19 CSS for this page differ only in the version banner comment.
  - main vs branch, the same 9 scenarios as the tabs entry (default, worked check case, Manual + custom section + point loads + notch, HF SS flat, SP No.2, custom species, 6x8 error, multi-error, point-load error), each loaded through the tool's Open file input: Visual Analysis text, Detailed Report text (trace on and off), print-media text, saved project JSON, all 38 input controls with values, Save → Open → Save round trip, load while the Factors tab is active, "Share project info" payload and "Use shared project info" → **all identical** (66 comparisons). No console errors on either page.
  - Full-page screenshots (light and dark) compared pixel by pixel: dark identical; light differs only by the timing-dependent "Project saved successfully" toast.
- **Other copies:** none.

## 2026-10-10 — PR: claude/timber-rebuild-p1 (PR #81: https://github.com/mlococo88/All-Structural/pull/81)

### R1. Rebuild in vanilla JS (Steel Beam layout), Phase 1: same results + continuous beams and cantilevers   [rebuild] [no result change for any case the pre-R1 tool supports] [new calculations for multi-span / cantilever]

- **Date / type:** 2026-10-10. Engineer's decisions of 2026-10-10: rebuild the tool like Steel Beam (single file, vanilla JS, header with project fields, input tabs, output tabs with full worked calc sheets, Validation, Method, Print report; KaTeX 0.16.11 and plotly-basic 2.35.2 only); Phase 1 = everything the tool did + multi-span and cantilevers; every built-in value shown with its Supplement table and a "verify" badge. Phase 2 (Glulam, SCL, Table 4D, missing SP grades, LRFD) is not implemented; the data model has the slots (`material.type`, `design.method`).
- **File name unchanged** (`Timber Beam Check.html`; `tools.html` links to it). CRLF line endings kept. The page title is now "Timber Beam Check — NDS 2018 (ASD)" (was "Universal Timber Design Studio (NDS 2018)", O15).

#### Structure of the new file (top to bottom)

| Part | Anchor | Content |
|---|---|---|
| `<head>` | `<title>Timber Beam Check` | KaTeX **0.16.11** CSS + JS (`cdn.jsdelivr.net/npm/katex@0.16.11/...`, `defer`), plotly-basic **2.35.2** (`cdn.plot.ly/plotly-basic-2.35.2.min.js`): the exact tags of `Steel Beam Design - AISC 15th.html`. CSS after Steel Beam (navy header, input tabs, output tab bar, `.sec` sections) plus calc-sheet blocks (`.eqb`), badges and a narrow-screen layout (`@media (max-width:820px)`). |
| body | `<div id="app">` | Header: title, "← All tools" (`tools.html`, `target="_top"`), Open file / Save file / Print report, project fields (`#projGrid`), "Use shared project info" / "Share project info". Governing strip (`#govStrip`). Input panel (`#inputPanel`), output panel (`#tabBar`, `#tabPages`). Hidden file input `#tbcFile`. |
| script 1 | `/* BridgeXfer v1 — cross-tool hand-off helper.` | **Unchanged** (verbatim copy of the pre-R1 file, HANDOFF.md §5). |
| script 2 | `/* Shared project info buttons (HANDOFF.md §4.1` | **Unchanged**: `ProjMetaUI` and `TBC_PROJ_MAP` (Client, Job #, Designer). |
| script 3 | `/* TBC-ENGINE-BEGIN */` … `/* TBC-ENGINE-END */` | The calculation engine, pure functions, no DOM: reference/factor tables, `widthGroup`, `ctFactors`, `tbcDefaultModel`, the continuous-beam solver (`gauss`, `elemK`, `tbcSpanOf`, `tbcSolve`, `tbcStatics`), `tbcRun(model)`, and the saved-data functions `tbcFromLegacy`, `tbcSanitize`, `tbcMigrate`. |
| script 4 | `Timber Beam Check — user interface (vanilla JS` | UI: helpers (KaTeX helpers copied from Steel Beam), state and storage, header, input tabs, output tabs, plots, print report, start-up (`tbcInit`). `window.TBC` is a read-only test hook (model, results, flush). |

Removed with the React version: Tailwind Play CDN 3.4.17, `@babel/standalone@7.29.10`, `lucide@1.54.0`, esm.sh (`react@18.2.0`, `react-dom@18.2.0/client`, `lucide-react@0.292.0`), Google Fonts. No new library: KaTeX and plotly-basic at the versions Steel Beam already uses.

#### Engine: what is unchanged and what is new

The pre-R1 engine (`runTimberCheck`, fix log F1–F22) is the base of `tbcRun`. Every table and helper is copied unchanged: `DEFAULT_SPECIES`, `GRADES_DB`, `REF_4A`, `REF_4B_SP`, `T4A_CF_FB`, `T4A_CF_FB_STUD`, `T4A_CFU`, `LOAD_CD`, `COMBOS`, `DEFL_TRANSIENT`, `SIZES_DB`, `widthGroup`, `ctFactors`. `tbcRun` reads a model object instead of the React state; the field mapping is:

| pre-R1 input (`runTimberCheck(inp)`) | R1 model |
|---|---|
| `span` | `geom.spans[0].L` (one entry per span) |
| `spacing` | `geom.spacing` |
| `bearingLen`, `bearingInterior` | `geom.supports[j].lb`, `geom.supports[j].cb` (one per support; `t` = `pin` / `fixed` / `free`) |
| `wDead`, `wLive`, `wRoofLive`, `wSnow`, `wWind`, `selfWeight`, `pointLoads` | `loads.D`, `.L`, `.Lr`, `.S`, `.W`, `.selfWeight`, `.points` (x from the left end) |
| `species`, `grade`, `sizeLabel`, `customB`, `customD`, `isManual`, `manualProps`, `customMaterials`, `notchDepth`, `costPerBF` | `material.species`, `.grade`, `.size`, `.customB`, `.customD`, `.manual`, `.manualProps`, `.customMaterials`, `.notch`, `.costPerBF` (+ `material.type`, Phase 2 slot) |
| `moisture`, `temp`, `incising`, `repetitive`, `flatUse`, `latSupport`, `unbracedLen`, `creepFactor`, `deflLimitLL`, `deflLimitTL` | `design.moisture`, `.temp`, `.incising`, `.repetitive`, `.flatUse`, `.latTop`, `.luTop`, `.creep`, `.deflLL`, `.deflTL` (+ `design.latBot`, `design.luBot`, new; `design.method`, Phase 2 slot) |
| `loadCombo` | `ui.diagCombo` |

**A single span on two pin supports (`simple`) runs the pre-R1 code, line for line:** the closed-form `beam()` statics, the station list `L*i/100` plus point-load positions, the zero-shear candidates, the shear region `[d, L − d]`, `defl()` superposition, the factor, C<sub>L</sub>, notch, bearing and deflection expressions in the same order. Where the pre-R1 code had one value, the R1 code keeps that expression for the simple span and uses a general one otherwise:

| pre-R1 anchor (earlier entries) | R1 anchor | Simple span |
|---|---|---|
| `const Cb = (inp.bearingInterior && lb < 6) ? (lb + 0.375) / lb : 1.0;` (F8) | `const Cbs = lbs.map((lb, j) => (cbOn[j] && lb < 6) ? (lb + 0.375) / lb : 1.0);` | same value at each support; `Cb` = value at support A |
| `const Rbear = Math.max(bm.RL, bm.RR, 0); const fcp = Rbear / (bw * lb);` (F9) | `const Rbear = legacyBear ? Math.max(bm.RL, bm.RR, 0) : gc.Rb;` | pre-R1 expression whenever both supports have the same l<sub>b</sub> and Cb box (`legacyBear`); otherwise per-support ratios |
| `const fb = Mmax * 12 / S;` and `r_b = fb / Fb_p` (F12, F17) | `const fb = legacyBend ? Mmax * 12 / S : Mgov * 12 / S;` | pre-R1 expression when the bottom edge is "same as top edge" (`legacyBend`) |
| `if (luD < 7) { le = 2.06 * lu; ...` (F13) | `const leFor = (lu) => {` with `const fn1 = hasPL \|\| !simple;` | identical (`fn1` = `hasPL`) |
| `const shearRegion = L > 2 * dft ? ...` (F9) | `if (simple) shearRegion = L > 2 * dft ? ...` | identical |
| `const defl = (w, P, x) => {` (F10) | same, plus `const deflG = (w, P, sol, i, x) => {` for the general model | identical |
| `const fvn = hasNotch ? 1.5 * Rmax / (bw * dn) : 0;` (F14) | same; `Rmax = simple ? Math.max(Math.abs(bm.RL), Math.abs(bm.RR)) : max over the end supports` | identical |
| `fails.push(\`Slenderness RB = ...` (F13) | same text for one span; `Span i: slenderness RB = ...` for several spans | identical |

Every error, code-limit failure and note of the pre-R1 engine is produced with the same text in the same order. New R1 advisories (bottom-edge bracing, pattern loading, notch at a cantilever end, uplift support names) are in a separate list (`adv`) and shown with the notes.

#### Calculation callouts (CLAUDE.md §4)

1. **No formula, factor, table value, unit or code reference changed** for any case the pre-R1 tool supports (a single span on two pins). Proof: the parity runs below (exact equality, `Object.is`, of every computed field).
2. **New: continuous beams and cantilevers** (new capability; no earlier result exists):
   - *Analysis:* direct stiffness, Euler–Bernoulli elements, one E′I for the member, exact fixed-end forces for the full-span uniform load (wL/2, wL²/12) and point loads (Pb²(L + 2a)/L³, Pab²/L², …); V and M by statics on the left segment. Copied from Steel Beam's `gauss`, `elemK`, `solveFor` (adapted: lb/ft, global point-load x, closed-form uniform-load FER instead of Steel's numerical N = 240 integration). Governing basis: statics / matrix structural analysis (no code provision).
   - *Bending (NDS 2018 3.3):* per span, the largest +M is checked with the top-edge C<sub>L</sub> and the largest −M with the bottom-edge C<sub>L</sub>. l<sub>u</sub> = entered value, else the span length (cantilever: its length). l<sub>e</sub>: NDS 2018 Table 3.3.3 footnote 1 general rule (2.06 l<sub>u</sub> for l<sub>u</sub>/d < 7; 1.63 l<sub>u</sub> + 3d for 7 ≤ l<sub>u</sub>/d ≤ 14.3; 1.84 l<sub>u</sub> above), which is not less than the table's cantilever rows (1.33 l<sub>u</sub>, 0.90 l<sub>u</sub> + 3d, 1.87 l<sub>u</sub>, 1.44 l<sub>u</sub> + 3d). R<sub>B</sub> ≤ 50 per span (NDS 3.3.3.7).
   - *Shear (NDS 3.4.3.1(a)):* V = max |V| between d from each support (to the tip on a cantilever); no x/d reduction (O4 kept).
   - *Bearing (NDS 3.10):* every support, with its own l<sub>b</sub> and Cb box; Cb per NDS 3.10.4, Eq. 3.10-2 (F8 rule: only when ticked, l<sub>b</sub> < 6 in.). The UI ticks the box for an interior support (the member continues past it).
   - *End notch (NDS 3.4.3.2(a), 4.4.3.2):* at the supports at the member ends; full reaction.
   - *Deflection (NDS 3.5, IBC Table 1604.3):* per span; limit L/n with L = span, or **twice the cantilever length** (IBC 2018 Table 1604.3 footnote h). Span deflection = chord between nodal deflections + simple-beam deflection of the span's loads + end-moment term [M₁s(L − s)(2L − s) + M₂s(L − s)(L + s)]/(6LE′I) (exact).
   - *Check case (hand-checkable), 2 spans 12 + 12 ft*, 2x10 DF-L No.2 @ 16 in., D 10 / L 40 psf, self-weight, top edge continuous, bottom edge at supports only, l<sub>b</sub> 3.5 / 5.5 (Cb) / 3.5 in.: w = 16.61 + 53.33 = 69.94 plf; R = 3/8·wL = 314.7 lb, 10/8·wL = 1049.1 lb, 314.7 lb; M<sub>B</sub> = −wL²/8 = −1259.0 ft-lb; +M = 9wL²/128 = 708.2 ft-lb at 4.5 ft. Bottom edge: l<sub>u</sub>/d = 144/9.25 = 15.57 > 14.3 → l<sub>e</sub> = 1.84 × 144 = 265.0 in.; R<sub>B</sub> = √(265.0 × 9.25/1.5²) = 33.00; F<sub>bE</sub> = 1.20 × 580,000/33.00² = 639 psi; F<sub>b</sub>* = 900 × 1.0 × 1.1 × 1.15 = 1138.5 psi; C<sub>L</sub> = 0.531; F′<sub>b</sub> = 604.7 psi; f<sub>b</sub> = 1259.0 × 12/21.39 = 706.3 psi; **ratio 1.168 (NG)**. With the bottom edge continuous: C<sub>L</sub> = 1.0, ratio 706.3/1138.5 = **0.620**. Bearing at B: C<sub>b</sub> = (5.5 + 0.375)/5.5 = 1.068, F′<sub>c⊥</sub> = 667.6 psi, f<sub>c⊥</sub> = 1049.1/(1.5 × 5.5) = 127.2 psi, 0.191. Live-load deflection 0.065 in. (L/2200).
   - *Check case, 12 ft span + 3 ft overhang* (same joist and loads): R<sub>A</sub> = 393.4 lb, R<sub>B</sub> = 655.7 lb; M<sub>B</sub> = −wa²/2 = −314.7 ft-lb; overhang live-load deflection 0.088 in. against 2 × 36/360 = 0.200 in. (0.442).
   - The Validation tab re-runs closed-form checks live through `tbcRun` (simple span, 2 and 3 equal spans, cantilever tip load and UDL, propped cantilever, fixed-fixed, span + overhang).
3. **New input: bottom-edge lateral support** (O9). `design.latBot` = `Supports` (at supports only, l<sub>u</sub> = `design.luBot` or the span) / `Continuous` / `same` (same as top edge = pre-R1 behaviour). **Files from the earlier version open with `same`, so their results are unchanged.** New projects default to `Supports` (more conservative wherever negative moment occurs: continuous beams, cantilevers, net uplift). Check case (fix-log joist, 14 ft, D 10 / L 40 / W −60 psf, top edge continuous): 0.6D + 0.6W gives w = −38.03 plf, M = −931.8 ft-lb, f<sub>b</sub> = 522.8 psi, F<sub>b</sub>* = 1138.5 × 1.6 = 1821.6 psi. `same` (as before): C<sub>L</sub> = 1.0, ratio **0.287**, headline 84.4 % (D + L bending), plus an advisory that the bottom edge is being taken as braced. `Supports`: l<sub>u</sub> = 168 in., l<sub>e</sub> = 1.63 × 168 + 3 × 9.25 = 301.6 in. (uniform load, l<sub>u</sub>/d = 18.2), R<sub>B</sub> = 35.21, F<sub>bE</sub> = 561.4 psi, C<sub>L</sub> = 0.302, F′<sub>b</sub> = 549.5 psi, ratio **0.951**, headline 95.1 % (0.6D + 0.6W bending).

#### Saved data (CLAUDE.md §5)

- **Files.** Save file writes `{ _schema: "timber-beam-check", version: 2, project, geom, loads, material, design, ui }` (file `<project name>.json`, or `timber_design.json` when the name is blank). Open file (`tbcMigrate`) reads version 2 and every earlier format: the original 11-field file, the F18 full flat file, `temp: "High"`, custom species in the old `{F_b, F_v, F_c_perp}` shape, wrong types, missing fields. `tbcFromLegacy` applies the pre-R1 `loadProject` rules field for field (same defaults and validation) and maps them onto the model; `latBot` = `same`. A file with another `_schema` or a newer version is refused with a message; the current project is kept. Nothing in an old file is discarded: every field the old tool read is carried over (projectInfo → project client/job/designer/notes).
- **Browser storage (new keys, tool-prefixed):** `tbc_autosave_v1` (the model, written on every change, restored at start-up), `tbc_projects_v1` (named projects `{name: {t, d: model}}`). `tbc_inputTab_v1` is kept; its values are now `project`, `geom`, `loads`, `material`, `factors` (the four pre-R1 values are still valid; an unknown value falls back to Project). Every access is in try/catch; the page works with storage blocked.
- **Hand-off:** `projectMeta` unchanged (same `TBC_PROJ_MAP`, receiver id `timberBeamCheck`, producer "Timber Beam Check", file "Timber Beam Check.html"). The new title-block fields (Project, Member, Checked by, Date) are not mapped (open item R1-g). No other channel; HANDOFF.md unchanged.

#### UI changes

- Input tabs: Project (saved projects, project file, notes), Geometry (layout presets, spans, supports with bearing length and Cb, spacing), Loads (area loads, self-weight, point loads), Material (type, species, grade, size, manual / custom values, notch, cost), Factors (method, service conditions, top- and bottom-edge lateral support, deflection). Red dot on a tab whose input has an error.
- Output tabs: Summary (utilization, check chips, governing results, all combinations), Schematic & Inputs, Analysis Results (V / M diagrams per combination or envelope, reactions, peaks), Design Values (section, loads, reference values, factor table, adjusted values), Bending, Shear, Bearing, Deflection (each a worked calc sheet: equation, substituted values, "where" table with sources and verify badges, result, ratio, NDS reference), Reference Values (every built-in value with its table and a verify badge), Validation, Method & Manual. Print report: selectable sections, title block, diagrams as images.
- Removed: dark mode, the Trace on/off switch (the calc sheets always show the full trace), the span slider (O10: spans are now typed, no 4–40 ft limit), the "Visual Analysis / Detailed Report" switch, the hover read-out of the old SVG diagrams (Plotly hover instead). The project notes (`projectInfo.notes`, now `project.notes`) have an input and are printed in the report (O15).

#### How verified

- `node --check` on all four inline scripts.
- **Engine parity (Node):** the pre-R1 engine and `loadProject` were extracted verbatim from `origin/main` and run against `tbcRun` + `tbcMigrate` on 20,417 project objects (the fix-log check case, every built-in species × grade × size edgewise and flat, every load type alone, point loads of each type at 10 positions including both supports, notches (2 in., > d/4, negative, ≥ d), unbraced / RB > 50, uplift with top edge continuous and at supports, wet / hot / incised, Lr, Cb, manual and custom species (both shapes), timbers blocked and Manual, Stud 2x8, SP SS, custom sections, every error case, wrong types, empty object, plus 20,000 random files). Two paths per case: through the file loaders, and the raw React state (incl. NaN/blank values) straight into both engines. Compared with exact equality: 49 top-level fields, 28 fields × 10 combinations, the governing combinations, 12 deflection fields, the diagram data. **Result: 0 differences (20,417 cases × 2 paths = 40,834 result comparisons; 13,197 cases with results, 7,220 blocked by input errors, where the error lists were compared).** A mutation test (Kcr default 1.5 → 1.5000001; zero-shear candidates removed) is detected.
- **Browser parity:** the origin/main file (React, its libraries served locally at the pinned versions) and the new file, both opened from `file://` in headless Chromium; each case written to a JSON file and opened through each page's own Open input. Compared: the combinations table (CD, w, R<sub>L</sub>/R<sub>R</sub>, M, three ratios), headline %, controlling limit state and detail, errors, fails, notes, every number of the old Detailed Report (sections 1–6), the 14 factor tiles, the reference-value line, the ring captions and the diagram combination. **Result: 296 cases (207 with results, 89 with input errors), 8,402 comparisons, 0 differences; no console errors on either page.**
- **Files saved by the old tool:** for each browser case the old page's Save button wrote a genuine `timber_design.json`; all 296 files opened in the new engine with identical results; each was then saved as version 2 and reopened: identical model and results.
- **Multi-span:** closed-form checks (2 and 3 equal spans, cantilever tip load / UDL, propped cantilever, fixed-fixed, span + overhang) match to ≤ 2e-16 relative (deflection maxima at the 1 % stations within 0.02 %); against Steel Beam's engine (extracted verbatim, same EI) reactions and moments agree within 4e-6 and deflections within 1.1e-4 relative (Steel integrates distributed-load FER and deflection numerically).
- **Interaction (Chromium):** editing, presets, add/remove span, point-load error and red dots, blank bearing length, SP SS → Manual, custom species, keyboard tab navigation, autosave restore after reload, named projects, Save file → Open file round trip (identical model and results), legacy and malformed files, another tool's file refused, Share / Use shared project info (same payload as before), print report (10 sections, 3 diagram images), storage blocked, pre-R1 stored tab value. No console errors.
- Screenshots of every input and output tab at 1440 px and 400 px (single span and a 3-span model with overhang) were reviewed; no horizontal page scroll at 400 px.

- **Other copies of this code:** `gauss` and `elemK` (verbatim) and the solve logic of `solveFor` are from `Steel Beam Design - AISC 15th.html`; the KaTeX helpers `TEX_CMD` … `tex()` are copied unchanged from the same file. BridgeXfer v1 and `ProjMetaUI` unchanged (same list as F23).

#### Open items affected

- O1 (libraries): **resolved** — no Tailwind Play CDN, Babel or esm.sh any more; KaTeX 0.16.11 and plotly-basic 2.35.2 pinned.
- O9 (uplift / bottom edge): **addressed** by the bottom-edge input; files from the earlier version keep "same as top edge" (decision R1-a below).
- O10 (span slider 4–40 ft): **resolved** (typed spans).
- O15 (no print button; notes without an input; title ≠ file name): **resolved**.
- T1 open item (400 px header causes a horizontal page scroll): **resolved** by the new layout.
- O2–O8, O11–O14: unchanged for the simple span; O4, O7 and O8 apply to continuous beams in the same way.

#### New open items (R1)

- R1-a. **Default bottom-edge bracing.** Files from the earlier version open with "same as top edge" (results unchanged); new projects default to "at supports only". Decision: should opening an old file switch it to "at supports only" (changes uplift results for files with a continuously braced top edge, e.g. 0.287 → 0.951 in the check case above)? *(Engineer 2026-10-10: yes. Done in R2.)*
- R1-b. **l<sub>e</sub> for continuous beams and cantilevers:** the footnote 1 general rule is used (conservative). Confirm, or use the Table 3.3.3 cantilever rows for cantilevers. *(R5: closed. Engineer's decision 2026-10-10: keep the conservative footnote 1 general rule. No change.)*
- R1-c. **Cantilever deflection limit:** L = twice the cantilever length (IBC 2018 Table 1604.3 footnote h, as recalled). Confirm the footnote and the intent. *(Engineer 2026-10-10: confirmed. No change; R2.)*
- R1-d. **Pattern (skip) live loading** is not generated for continuous beams (Steel Beam does not either); an advisory is shown. Decision: add automatic patterns? *(Engineer 2026-10-10: declined; the advisory stays. R2.)*
- R1-e. **Cb at interior supports:** ticked by default for an interior support (member continues past it). Confirm. *(R5: closed. Engineer's decision 2026-10-10: keep C<sub>b</sub> ticked by default at interior supports. No change.)*
- R1-f. **NDS equation numbers** in the calc sheets (3.3-2, 3.3-5, 3.3-6, 3.4-2, 3.4-3, 3.5-1, 3.10-2) are as recalled; verify against the printed NDS 2018. *(R5: still open; cannot be closed by code. Verify against the printed NDS 2018 and supply any corrected numbers.)* *(S1: still open; see S1, Needs engineer 4.)*
- R1-g. **Shared project info:** `TBC_PROJ_MAP` is unchanged (Client, Job #, Designer). The new fields Project, Checked by and Date could be mapped to `projectName`, `checkedBy`, `date`. Decision? *(R5: closed. Engineer's decision 2026-10-10: mapped. Project → `projectName`, Checked by → `checkedBy`, Date → `date`; existing mappings kept.)*
- R1-h. **Observation (Steel Beam, not changed here):** in `Steel Beam Design - AISC 15th.html`, `evalVM(X, …)` includes the reaction couple of a node at `X` itself, so at x = L with a fixed right end it returns M = 0 instead of the end moment (fixed-pin-fixed 10 + 10 ft, w = 75 plf: 0 vs −2187.5 ft-lb at x = 20 ft). The station just before it is close, so the effect is small but unconservative. For a separate Steel Beam PR if wanted.
- R1-i. **Fixed supports** are offered (as in Steel Beam) but rare in timber; the bearing check uses the vertical reaction only. *(S1: closed; an advisory is shown whenever a support is fixed; see S1-c.)*

## 2026-10-10 — PR: claude/timber-rebuild-p2 (PR #83: https://github.com/mlococo88/All-Structural/pull/83)

### R2. Engineer's decisions on the R1 open items (2026-10-10): old files open with the bottom edge braced at supports only   [calc change] [more conservative; only old files with negative moment]

- **Date / type:** 2026-10-10. Engineer's decisions on the R1 open items: **R1-a** old files open with the bottom edge "at supports only"; **R1-c** confirmed; **R1-d** declined; R1-b, R1-e, R1-f, R1-g unanswered (still open).
- **R1-a (changed).** `tbcFromLegacy` (anchor `latBot: 'same', luBot: 0,   // pre-R1 behaviour`) now maps every file of the earlier (React, pre-R1) version to `design.latBot = 'Supports'`. The bottom-edge unbraced length is the old file's `unbracedLen` when its `latSupport` was `'Supports'` (the earlier tool used that one length for both edges), otherwise 0 (= the span length).
  - Before:
    ```js
            latBot: 'same', luBot: 0,   // pre-R1 behaviour: one lateral-support setting for both edges (open item O9)
    ```
  - After:
    ```js
            // Engineer's decision R1-a (2026-10-10, fix log R2): the bottom edge opens "at supports only". When the old file
            // had the top edge at supports only with an entered unbraced length, that length is carried to the bottom edge too
            // (the earlier tool used it for both edges); otherwise l_u,bottom = 0 (= the span length).
            latBot: 'Supports', luBot: (st(d.latSupport, 'Continuous', ['Continuous', 'Supports']) === 'Supports') ? n(d.unbracedLen, 0) : 0,
    ```
  - "Same as top edge" stays in the bottom-edge selector for users who want it. Version-2 files (saved by R1) store `latBot` explicitly and are **not** changed. New projects already defaulted to "at supports only".
  - Text changed to match: the toast after opening an old file ("… converted; bottom edge braced at supports only, fix log R2"), the hint under the lateral-support inputs, the Method & Manual "Saved data" item and the Validation "Parity" note.
  - **Governing provision:** NDS 2018 3.3.3 (beam stability, C<sub>L</sub>; l<sub>u</sub> = distance between points of lateral support of the compression edge), Table 3.3.3, Eq. 3.3-6. The formulas are unchanged; only the bracing assumed for the bottom (compression under negative moment) edge of an old file changes.
  - **What changes (CLAUDE.md §4):** only files saved by the earlier version, only when some combination has negative moment (net uplift, e.g. 0.6D + 0.6W or D + 0.6W with W negative; or upward point loads) and the member is edgewise (d > b), and only when the old file had the top edge **continuously** braced: the bending check of the negative-moment region then uses C<sub>L</sub> with l<sub>u</sub> = span instead of C<sub>L</sub> = 1.0. Also: the advisory "Negative moment occurs, and the bottom-edge bracing is set to 'same as top edge' …" is no longer shown for those files; the bending location reads "−M (bottom edge in compression)" instead of "|M| max"; and an R<sub>B</sub> > 50 of the bottom edge is reported as "Bottom edge (negative moment): slenderness RB = … exceeds 50 (NDS 3.3.3.7). Not permitted." (NG). Files whose top edge was "at supports only" give the same C<sub>L</sub> as before (same l<sub>u</sub> for both edges). **Never less conservative** (parity run below).
  - **Check case** (fix-log joist: DF-L No.2 2x10 @ 16 in., 14 ft, D 10 / L 40 / W −60 psf, old file with `latSupport: 'Continuous'`): 0.6D + 0.6W: w = 0.6 × 16.61 + 0.6 × (−80.0) = −38.03 plf; M = −38.03 × 14²/8 = −931.8 ft-lb; f<sub>b</sub> = 931.8 × 12/21.39 = 522.8 psi; F<sub>b</sub>* = 900 × 1.6 × 1.0 × 1.0 × 1.1 × 1.0 × 1.15 = 1821.6 psi.
    - Before (bottom edge same as top = continuous): C<sub>L</sub> = 1.0, F′<sub>b</sub> = 1821.6 psi, ratio **0.287**; headline 84.4 % (D + L bending).
    - After (bottom edge at supports only): l<sub>u</sub> = 168 in., l<sub>u</sub>/d = 18.2 (uniform load only) → l<sub>e</sub> = 1.63 × 168 + 3 × 9.25 = 301.6 in.; R<sub>B</sub> = √(301.6 × 9.25/1.5²) = 35.21; F<sub>bE</sub> = 1.20 × 580,000/35.21² = 561.3 psi; F<sub>bE</sub>/F<sub>b</sub>* = 0.3082; C<sub>L</sub> = (1.3082/1.9) − √[(1.3082/1.9)² − 0.3082/0.95] = 0.302; F′<sub>b</sub> = 1821.6 × 0.302 = 549.5 psi; ratio 522.8/549.5 = **0.951**; headline 95.1 % (0.6D + 0.6W bending).
    - Same joist with `latSupport: 'Supports'`, `unbracedLen: 7`: before and after C<sub>L</sub> = 0.534, ratio 0.538 (unchanged: l<sub>u</sub> = 7 ft carried to the bottom edge).
- **R1-c (confirmed by the engineer 2026-10-10):** cantilever deflection limit with L = 2 × the cantilever length (IBC Table 1604.3 footnote h). No code change.
- **R1-d (declined by the engineer 2026-10-10):** no automatic pattern (skip) live loading. The advisory for continuous beams stays. No code change.
- **R1-b, R1-e, R1-f, R1-g:** not answered; still open (list below).
- **How verified:**
  - Node, the Phase 1 parity cases (20,417 project objects in the old file formats, incl. 20,000 random files): pre-R1 React engine (extracted verbatim from the pre-R1 file) vs this file's engine with the R1-a mapping undone (`latBot = 'same'`, `luBot = 0`): **0 differences** (exact equality, same fields as R1). Raw-state path: 0 differences. R1 (origin/main) engine vs this engine on the same version-2 model: 0 differences in a deep comparison of every R1 result field (20,417 cases + 3,000 random multi-span / cantilever models).
  - R1-a effect (this file as opened vs R1-a undone): **1,811 of 20,417 cases change**; in **1,810** a combination has negative moment; **none is less conservative** (headline and every bending ratio ≥ before). The one remaining case (`rand 108`, a 29.7 ft span with five point loads) changes only by a bottom-edge "R<sub>B</sub> > 50" NG message caused by a round-off moment of 1.8e-12 ft-lb at the end support (see new open item P2-1 below). Not changed here (CLAUDE.md §4: raise and ask).

### R3. Phase 2: glulam, SCL, Table 4D timbers, Southern Pine SS / No.1, LRFD   [new capability] [calc change only for cases the earlier version blocked] [ASD sawn results unchanged]

- **Date / type:** 2026-10-10. Engineer's decisions of 2026-10-10 (Phase 2 brief): add glulam (NDS Ch. 5, Supplement Table 5A), SCL with the manufacturer's values (NDS Ch. 8), Table 4D timbers, the missing Southern Pine grades (Table 4B) and LRFD (NDS 2018 Appendix N). Every built-in value is shown with its table and a **verify** badge on the Reference Values tab. The default stays ASD sawn lumber.
- **Files:** `Timber Beam Check.html`, this log, `tools.html` (card text and an "ASD / LRFD" tag). CRLF kept.

#### §4 callouts (CLAUDE.md)

1. **No existing formula, factor, table value, unit or code reference changed for ASD sawn lumber with the built-in species / grades.** Proof: parity runs below (0 differences). Every Phase 2 factor enters as a multiplier that is exactly 1 in ASD (K<sub>F</sub> = φ = 1, C<sub>V</sub> = 1, C<sub>vr</sub> = 1) or as a separate branch for glulam / SCL / LRFD.
2. **Cases that the earlier version blocked now give results (no previous result exists):** Southern Pine Select Structural and No.1 (Table 4B); timbers 5 in. and thicker with built-in DF-L, HF, SP values (Table 4D; fix-log F22 block removed where values exist); flat use of built-in timbers (O3). Before: red "No results" panel ("… values (Table 4B) are not built in", "Timbers (5 in. x 5 in. and larger) use NDS Supplement Table 4D values, which are not built in", "Flat use of timbers is not supported …"). After: full results. Timbers whose values are not built in (SPF, Stud) still stop, with a reworded message: "Timbers (5 in. x 5 in. and larger): Spruce-Pine-Fir values (NDS Supplement Table 4D) are not built in. Use Manual values (Man)." / "… grade Stud is not built in for Table 4D …"; flat use of a timber with Manual / custom values still stops ("Flat use of timbers with Manual or custom values is not supported (the Table 4D flat-use factor depends on the grade). Use the built-in Table 4D values.").
3. **Southern Pine No.2:** F<sub>t</sub> and F<sub>c</sub> were "not entered" (null); now entered (not used by any check). F<sub>b</sub>, F<sub>v</sub>, F<sub>c⊥</sub>, E, E<sub>min</sub> unchanged.
4. **New sizes** in the size list: 6x10, 6x12, 6x14, 6x16, 8x10, 8x12, 8x14, 8x16, 10x12, 10x14, 10x16, 12x16, dressed ½ in. under nominal (Supplement Table 1B). Existing 6x8 (5.5 × 7.25) and 8x8 (7.25 × 7.25) are **not** changed (open item P2-2).
5. **Timber C<sub>F</sub> in flat use** uses the depth in the load direction (b): anchor `const dCF = flat ? b : d;`. Edgewise unchanged (d).

#### Built-in values (all marked "verify"; entered without the printed Supplement at hand)

Table 4B Southern Pine (psi; [F<sub>b</sub>, F<sub>t</sub>, F<sub>v</sub>, F<sub>c⊥</sub>, F<sub>c</sub>, E, E<sub>min</sub>]):

| Grade | 2"–4" | 5"–6" | 8" | 10" | 12" | Confidence |
|---|---|---|---|---|---|---|
| Select Structural | 2350, 1650, 175, 565, 1900, 1.8M, 660k | 2000, 1350, … , 1800 | 1850, 1150, …, 1750 | 1500, 950, …, 1650 | 1400, 900, …, 1600 | F<sub>b</sub>/E: medium-low; F<sub>t</sub>/F<sub>c</sub>: low |
| No.1 | 1500, 1000, 175, 565, 1650, 1.6M, 580k | 1350, 875, …, 1550 | 1250, 800, …, 1500 | 1050, 700, …, 1450 | 1000, 650, …, 1400 | F<sub>b</sub>/E: medium; F<sub>t</sub>/F<sub>c</sub>: low |
| No.2 (F<sub>t</sub>, F<sub>c</sub> added) | 1100, 675, …, 1450 | 1000, 600, …, 1400 | 925, 550, …, 1350 | 800, 475, …, 1300 | 750, 450, …, 1250 | unchanged (medium); F<sub>t</sub>/F<sub>c</sub>: low |

"…" = F<sub>v</sub> 175, F<sub>c⊥</sub> 565 and the E, E<sub>min</sub> of the grade. **Stud is not entered** (not confident): still "Use Manual values".

Table 4D timbers (psi; same order). B&S = Beams and Stringers (d − b > 2 in.), P&T = Posts and Timbers:

| Species | Class | SS | No.1 | No.2 | Confidence |
|---|---|---|---|---|---|
| DF-L | B&S | 1600, 950, 170, 625, 1100, 1.6M, 580k | 1350, 675, 170, 625, 925, 1.6M, 580k | 875, 425, 170, 625, 600, 1.3M, 470k | medium-high |
| DF-L | P&T | 1500, 1000, 170, 625, 1150, 1.6M, 580k | 1200, 825, 170, 625, 1000, 1.6M, 580k | 750, 475, 170, 625, 700, 1.3M, 470k | medium-high |
| HF | B&S | 1300, 750, 140, 405, 925, 1.3M, 470k | 1050, 525, 140, 405, 750, 1.3M, 470k | 675, 350, 140, 405, 500, 1.1M, 400k | medium |
| HF | P&T | 1200, 800, 140, 405, 975, 1.3M, 470k | 975, 650, 140, 405, 850, 1.3M, 470k | 575, 375, 140, 405, 575, 1.1M, 400k | medium |
| SP | 5"×5" and larger | 1500, 1000, 165, 375, 950, 1.5M, 550k | 1350, 900, 165, 375, 825, 1.5M, 550k | 850, 550, 165, 375, 525, 1.2M, 440k | low-medium |

Table 4D factors: C<sub>F</sub> = (12/d)<sup>1/9</sup> for d > 12 in. (unchanged); C<sub>M</sub> wet: F<sub>c⊥</sub> 0.67 only (unchanged); flat use (footnote, B&S): F<sub>b</sub> × 0.86 SS / 0.74 No.1 / 1.00 No.2, P&T 1.00, SP takes the B&S factors (conservative) — anchor `const T4D_FLAT_FB`; C<sub>r</sub> = 1.0.

Table 5A / 5A Expanded glulam, bending about x–x ([F<sub>bx</sub><sup>+</sup>, F<sub>bx</sub><sup>−</sup>, F<sub>c⊥x</sub> tension face, F<sub>c⊥x</sub> compression face, F<sub>vx</sub>, E<sub>x</sub>, E<sub>x,min</sub>], psi):

| Combination | Values | Confidence |
|---|---|---|
| 20F-1.5E (stress class) | 2000, 1100, 425, 425, 210, 1.5M, 790k | medium |
| 24F-1.7E | 2400, 1450, 500, 500, 210, 1.7M, 900k | medium |
| 24F-1.8E | 2400, 1450, 650, 650, 265, 1.8M, 950k | medium |
| 24F-V4 DF | 2400, 1850, 650, 650, 265, 1.8M, 950k | medium |
| 24F-V8 DF | 2400, 2400, 650, 650, 265, 1.8M, 950k | medium |
| 24F-V3 SP | 2400, 2000, 740, 740, 300, 1.8M, 950k | low-medium |
| 24F-V5 SP | 2400, 2400, 740, 740, 300, 1.7M, 900k | low-medium |

Species groups: DF / western: laminations 1.5 in., x = 10, widths 3-1/8, 5-1/8, 6-3/4, 8-3/4, 10-3/4 in.; SP: 1.375 in., x = 20, widths 3, 5, 6-3/4, 8-1/2, 10-1/2 in. Density for self-weight 35 / 36 pcf (tool values). Glulam factors: C<sub>M</sub> wet (5A footnote) F<sub>b</sub> 0.8, F<sub>v</sub> 0.875, F<sub>c⊥</sub> 0.53, E/E<sub>min</sub> 0.833; C<sub>V</sub> = (21/L)<sup>1/x</sup>(12/d)<sup>1/x</sup>(5.125/b)<sup>1/x</sup> ≤ 1.0 (NDS 5.3.6, Eq. 5.3-1), lesser of C<sub>L</sub> and C<sub>V</sub>; C<sub>vr</sub> = 0.72 at notches (NDS 5.3.10); tension-face end notch ≤ min(d/10, 3 in.) (NDS 5.4.4.1). C<sub>F</sub>, C<sub>i</sub>, C<sub>r</sub>, C<sub>fu</sub> not applied (flat use blocked).

LRFD (NDS 2018 Appendix N): K<sub>F</sub> (Table N1) F<sub>b</sub> 2.54, F<sub>v</sub> 2.88, F<sub>c⊥</sub> 1.67, E<sub>min</sub> 1.76; φ (Table N2) 0.85, 0.75, 0.90, 0.85; λ (Table N3) 1.4D 0.6; 1.2D + 1.6L + 0.5(Lr or S) 0.8 (L occupancy) / 0.7 (storage); 1.2D + 1.6(Lr or S) + (L or 0.5W) 0.8; 1.2D + 1.0W + L + 0.5(Lr or S) 1.0; 0.9D + 1.0W 1.0. Combinations: ASCE 7-16 Sec. 2.3.1 (10, keys U1 … U6), L factor 1.0 in combinations 3 and 4 (the 0.5L exception not used, conservative). All confidence: high for K<sub>F</sub>, φ; medium-high for λ.

SCL: **no product values built in.** The user enters F<sub>b</sub>, F<sub>v</sub>, F<sub>c⊥</sub>, E, E<sub>min</sub>, density and the size factor C<sub>V</sub> = (d<sub>ref</sub>/d)<sup>n</sup> with a limit (default 1.0); the input panel says that the manufacturer's literature governs. C<sub>V</sub> ≤ 1.0: lesser of C<sub>L</sub>, C<sub>V</sub>; C<sub>V</sub> > 1.0: C<sub>L</sub> × C<sub>V</sub> (NDS 8.3.6, as recalled). Wet service, flat use and notches stop with an input error; C<sub>r</sub> = 1.0.

#### Engine changes (`tbcRun`; anchors)

- Tables after `const REF_4B_SP = {`: `REF_4D`, `T4D_FLAT_FB`, `GLULAM_5A`, `GLULAM_GRP`, `GLULAM_CM`, `GLULAM_CVR`, `SCL_KINDS`, `LRFD_KF`, `LRFD_PHI`, `LRFD_LAMBDA`, `COMBOS_LRFD`.
- `// Material type and design method (Phase 2: glulam, SCL, LRFD)`: section from the glulam (b, n × t, or custom b × d) or SCL inputs; `cat` = `glulam` / `scl`; timbers get `cls4D` (`BS` / `PT`, SP `ALL`).
- Reference values: new `if (isGL) … else if (isSCL) … else if (userVals) …` branches; timber branch `const t4 = REF_4D[mt.species];` replaces the F22 error.
- Factors: `else if (cat === 'glulam') { CM.Fb = GLULAM_CM.Fb; …}`; `const ciOn = !!dz.incising && !isGL && !isSCL;`; timber flat `Cfu = … T4D_FLAT_FB[mt.grade]`; `const KF = lrfd ? LRFD_KF : { Fb: 1, … }`, `const PHI = …`; `const CVscl = …`; `const Cvr = isGL ? GLULAM_CVR : 1;`.
- `const Emin_p = ref.Emin * CM.E * Ct.E * Ci.E * KF.Emin * PHI.Emin;` (was `… * Ci.E;`).
- Combinations: `const combos = (lrfd ? COMBOS_LRFD : COMBOS).map(c => {` with `const TF = lrfd ? lam : CD;`; `Fb_star = ref.Fb * TF * CM.Fb * Ct.Fb * CF * Ci.Fb * Cr * KF.Fb * PHI.Fb` (was `ref.Fb * CD * CM.Fb * Ct.Fb * CF * Ci.Fb * Cr`); `Fbn_star` with F<sub>bx</sub><sup>−</sup> (= F<sub>b</sub> for sawn / SCL); `Fv_p = ref.Fv * TF * CM.Fv * Ct.Fv * Ci.Fv * KF.Fv * PHI.Fv`; `Fcp_pj = … * Cbs[j] * KF.Fcp * PHI.Fcp`.
- Bending per region: `Fbp_t = Fb_star * kLV(CLt, CVt) * Cfu` with `kLV = (CL, CV) => CV === 1 ? CL : (CV > 1 ? CL * CV : Math.min(CL, CV))`; glulam C<sub>V</sub> from `zeroLen(x0, sign)`: the points of zero moment either side of the governing moment, found on the station list and refined by bisection of the exact statics M(x) to 1e-10 ft (member end if none).
- `legacyBend = simple && latBot === 'same' && !isGL` (glulam always uses F<sub>bx</sub><sup>+</sup>/F<sub>bx</sub><sup>−</sup> by sign).
- Notch: `const notchLim = isGL ? Math.min(dep / 10, 3) : dep / 4;` (sawn message unchanged); `r_vn = fvn / (Fv_p * Cn * Cvr)`.
- Saved data: `TBC_VERSION = 3`; `tbcVersionFor(m)` = 3 only with glulam, SCL or LRFD, else 2 (`stampVersion()` before autosave, Save file and named projects). `tbcSanitize` reads `material.glulam`, `material.scl`, `design.lrfdLive`, LRFD diagram keys; `tbcFromLegacy` adds the defaults. Version-2 files (R1) open unchanged; a version-3 file in the R1 tool is refused ("newer format") instead of being read as sawn / ASD. No storage key changed.

#### UI

Material tab: material type (sawn / glulam / SCL); glulam combination, species group, width, laminations (depth shown) or custom section, custom values editor; SCL product type, name, b, d, values, size factor; timber size class shown in the size list. Factors tab: ASD / LRFD; for LRFD the floor-live-load source (λ 0.8 / 0.7). All output tabs show C<sub>D</sub> or λ, K<sub>F</sub> and φ in LRFD, F<sub>bx</sub><sup>±</sup> and a C<sub>V</sub> calc sheet for glulam / SCL. Reference Values: new sections Table 4D, Table 5A, LRFD (N1, N2, N3 and the LRFD combinations), SCL. Validation: 30 new live benchmarks (the hand checks below). Print report title and footer show the method. Header: "Timber Beam Check — NDS 2018 (ASD / LRFD)".

#### Hand checks (all reproduced live on the Validation tab)

1. **Glulam 24F-1.8E DF, 5-1/8 × 18 in. (12 × 1.5 in.), simple span 24 ft, tributary 8 ft (spacing 96 in.), D 15 / L 40 psf, self-weight 35 pcf, top edge braced.** A = 92.25 in², S = 276.75 in³; w<sub>sw</sub> = 35 × 92.25/144 = 22.42 plf; D + L: w = 8 × 55 + 22.42 = 462.42 plf; M = 462.42 × 24²/8 = 33,294 ft-lb; f<sub>b</sub> = 33,294 × 12/276.75 = 1443.7 psi. Zero-moment points 0 and 24 ft → L = 24 ft; C<sub>V</sub> = (21/24)<sup>0.1</sup>(12/18)<sup>0.1</sup>(5.125/5.125)<sup>0.1</sup> = 0.98673 × 0.96026 × 1 = 0.9475; C<sub>L</sub> = 1.0; F′<sub>b</sub> = 2400 × 1.0 × min(1.0, 0.9475) = 2274.1 psi; ratio **0.635** (C<sub>V</sub> governs). Same beam, top edge at supports only (l<sub>u</sub> = 288 in., l<sub>u</sub>/d = 16 ≥ 7, uniform load): l<sub>e</sub> = 1.63 × 288 + 3 × 18 = 523.4 in.; R<sub>B</sub> = √(523.4 × 18/5.125²) = 18.94; F<sub>bE</sub> = 1.20 × 950,000/18.94² = 3178 psi; F<sub>bE</sub>/F<sub>b</sub>* = 1.3242; C<sub>L</sub> = 2.3242/1.9 − √[(2.3242/1.9)² − 1.3242/0.95] = 0.9031 < C<sub>V</sub> → F′<sub>b</sub> = 2167.5 psi, ratio **0.666** (C<sub>L</sub> governs). (Headline 74.0 %: total deflection.)
   - Continuous 24 + 24 ft, 24F-V4 DF: −M = wL²/8 = 33,294 ft-lb over B uses F<sub>bx</sub><sup>−</sup> = 1850; negative region 18–30 ft → L = 12 ft, C<sub>V</sub> = 1.0156 → 1.0.
2. **6x12 DF-L No.1 (5.5 × 11.5 in., d − b = 6 > 2: Beams and Stringers), 16 ft, spacing 48 in., D 15 / L 40 psf.** Table 4D: F<sub>b</sub> 1350, F<sub>v</sub> 170, F<sub>c⊥</sub> 625, E 1.6M, E<sub>min</sub> 580k. A = 63.25, S = 121.23; w = 4 × 55 + 34 × 63.25/144 = 234.93 plf; M = 7517.9 ft-lb; f<sub>b</sub> = 744.2 psi; C<sub>F</sub> = 1.0 (d ≤ 12), C<sub>r</sub> = 1.0 (timber; note shown); F′<sub>b</sub> = 1350 psi; ratio **0.551**. V at d = 1654.3 lb, f<sub>v</sub> = 39.2 psi / 170 = 0.231. (6x14, d = 13.5: C<sub>F</sub> = (12/13.5)<sup>1/9</sup> = 0.9870.) Before: no results (F22 block).
3. **Southern Pine No.1 2x10 @ 16 in., 14 ft, D 10 / L 40 psf.** Table 4B 10 in.: F<sub>b</sub> 1050, F<sub>v</sub> 175, F<sub>c⊥</sub> 565, E 1.6M. w<sub>sw</sub> = 36 × 13.875/144 = 3.469; w = 13.333 + 3.469 + 53.333 = 70.14 plf; M = 70.14 × 14²/8 = 1718.4 ft-lb; f<sub>b</sub> = 1718.4 × 12/21.39 = 964.0 psi; F′<sub>b</sub> = 1050 × 1.0 (C<sub>F</sub>) × 1.15 (C<sub>r</sub>) = 1207.5 psi; ratio **0.798**. Before: no results.
4. **LVL 1-3/4 × 14 in., user-entered example values (not a product): F<sub>b</sub> 2600, F<sub>v</sub> 285, F<sub>c⊥</sub> 750, E 1.9M, E<sub>min</sub> 966k, n = 0.111, d<sub>ref</sub> = 12, C<sub>V</sub> ≤ 1.0, 42 pcf; 14 ft, tributary 8 ft, D 15 / L 40.** S = 57.167; w = 440 + 7.15 = 447.15 plf; M = 10,955 ft-lb; f<sub>b</sub> = 2299.6 psi; C<sub>V</sub> = (12/14)<sup>0.111</sup> = 0.9830; C<sub>L</sub> = 1.0; F′<sub>b</sub> = 2600 × 0.9830 = 2555.9 psi; ratio **0.900**; shear 159.7/285 = 0.560; bearing 3130/(1.75 × 3.5) = 511 psi / 750 = 0.681.
5. **LRFD, the fix-log joist (DF-L No.2 2x10 @ 16 in., 14 ft, D 10 / L 40 psf), L from occupancy.** 1.2D + 1.6L + 0.5Lr: w<sub>u</sub> = 1.2 × 16.61 + 1.6 × 53.33 = 105.26 plf; M<sub>u</sub> = 2579.0 ft-lb; f<sub>b</sub> = 1446.8 psi. λ = 0.8; F′<sub>b</sub> = 900 × λ 0.8 × C<sub>M</sub> 1 × C<sub>t</sub> 1 × C<sub>L</sub> 1 × C<sub>F</sub> 1.1 × C<sub>i</sub> 1 × C<sub>fu</sub> 1 × C<sub>r</sub> 1.15 × K<sub>F</sub> 2.54 × φ<sub>b</sub> 0.85 = 1966.4 psi; ratio **0.736** (ASD, same beam: 961.3/1138.5 = **0.844**). F′<sub>v</sub> = 180 × 0.8 × 2.88 × 0.75 = 311.0 psi (shear 0.228; ASD 0.262); F′<sub>c⊥</sub> = 625 × 1.67 × 0.90 = 939.4 psi (no λ; bearing 0.149, ASD 0.149); E′<sub>min</sub> = 580,000 × 1.76 × 0.85 = 867,680 psi. 1.4D (λ 0.6): F′<sub>b</sub> = 1474.8 psi, ratio 0.217. Deflection unchanged (service).

#### How verified

- `node --check` on all four inline scripts.
- **Engine parity (Node), the 20,417 Phase 1 cases** (fix-log check case, every built-in species × grade × size edgewise and flat, every load type, point loads at 10 positions, notches, RB > 50, uplift, wet / hot / incised, Lr, Cb, manual and custom species, timbers, Stud 2x8, SP SS, custom sections, error cases, wrong types, empty object, 20,000 random files):
  - pre-R1 React engine vs this engine (R1-a undone): **0 unexplained differences**; 3,429 cases that the old engine blocked with a "not built in" error now have results (SP SS / No.1, Table 4D timbers, flat timbers); 1,401 still blocked with a reworded timber message (no new error introduced: checked); 921 differ only in the newly entered SP F<sub>t</sub>/F<sub>c</sub>. Raw-state path: 0 unexplained (2,701 newly built-in, 1,313 reworded).
  - R1 (origin/main) engine vs this engine, deep comparison of every R1 result field on the same version-2 model: **0 unexplained differences** (3,429 newly built-in, 1,401 reworded). 3,000 random multi-span / cantilever models: 0 unexplained (561 newly built-in, 214 reworded).
  - R1-a effect (R2): 2,082 cases change with this engine (more than the 1,811 of R2 because newly built-in members can now show it), all with negative moment except `rand 108` (P2-1); none less conservative.
- **Hand checks:** the five above through the production engine (Node) and on the Validation tab in Chromium: **all 70 benchmarks match**.
- **Browser (headless Chromium, `file://`, KaTeX 0.16.11 and plotly-basic 2.35.2 served locally):** 11 models (default, glulam simple / 2-span wet with notch / SP LRFD with overhang and uplift / custom, 6x12, HF 6x14 flat, SP No.1, LVL, LRFD joist, blank SCL) × all 11 output tabs: built, no NaN / undefined, no KaTeX errors, no console errors. Interactions: material type select, laminations → depth, V3 SP combination snaps group and width, width select, custom glulam editor, SCL values, method → LRFD (version 3), Save file → Open file round trip (identical model and result), a version-2 file opens, a version-4 file is refused, print report (LRFD title, 10 sections), 400 px width without horizontal scroll: **32/32 pass**. The R1 interaction script still passes except two intended changes (SP Select Structural now has results; a legacy file now opens with the bottom edge "at supports only", R2).
- Screenshots of the new input and output pieces reviewed (scratchpad `timber_p2/shots/`).
- **Other copies of this code:** none (tool-specific).

#### Open items affected

- O2 (SP SS, No.1, Stud, F<sub>t</sub>/F<sub>c</sub>): SS, No.1 and F<sub>t</sub>/F<sub>c</sub> **added** (verify); **Stud still not built in** (P2-3).
- O3 (Table 4D, flat use of timbers): **added** for DF-L, HF, SP (verify); SPF not built in (P2-3).
- O11 (Stud 8 in. and wider), O12 (SP 4" thick 8"+ C<sub>F</sub> 1.1), O14 (C<sub>i</sub> on timbers): unchanged.

## 2026-10-10 — PR: claude/timber-p2-followups (PR #85: https://github.com/mlococo88/All-Structural/pull/85)

### R4. Engineer's decisions on P2-1, P2-2 and P2-7 (2026-10-10): round-off moments ignored; 6x8 / 8x8 to Table 1B; C<sub>r</sub> = 1.04 for SCL   [calc change] [P2-1: removes a false NG; P2-2: less conservative for 6x8 / 8x8; P2-7: less conservative for SCL in repetitive use]

- **Date / type:** 2026-10-10. Engineer's decisions of 2026-10-10 on open items P2-1, P2-2 and P2-7. Calculation changes; CLAUDE.md §4 callouts below. Only `Timber Beam Check.html` and this log change. CRLF kept. No storage key or saved-data format changed (files store the size by name, so files with 6x8 / 8x8 open with the new section; see P2-2).

#### P2-1. Region moments from floating-point round-off are zero

- **Where:** `tbcRun`, inside `const combos = (lrfd ? COMBOS_LRFD : COMBOS).map(c => {`, directly after the station loop that fills `reg` (anchor `else putM(x, mv, 0);`); constants after `const SCL_KINDS = {`.
- **Before:**
  ```js
            else putM(x, mv, 0);
        });
        // Design shear: max |V| between d from each support (NDS 3.4.3.1(a)); no x/d reduction of point loads
  ```
- **After:**
  ```js
            else putM(x, mv, 0);
        });
        // Engineer's decision P2-1 (2026-10-10, fix log R4): a region moment that is floating-point round-off
        // (|M| <= the larger of 1e-6 ft-lb and 1e-9 x the largest |M| of the combination) is zero: no top- or bottom-edge check.
        const Mtol = Math.max(M_TOL_ABS, M_TOL_REL * Mmax);
        reg.forEach(r => { if (r.Mp <= Mtol) { r.Mp = 0; r.xp = null; } if (r.Mn <= Mtol) { r.Mn = 0; r.xn = null; } });
        // Design shear: max |V| between d from each support (NDS 3.4.3.1(a)); no x/d reduction of point loads
  ```
  and after `const SCL_KINDS = { … };`:
  ```js
  // Round-off tolerance for region moments (fix log R4, P2-1): |M| <= max(M_TOL_ABS ft-lb, M_TOL_REL x largest |M| of the combination) is zero
  const M_TOL_ABS = 1e-6, M_TOL_REL = 1e-9;
  ```
- **Tolerance chosen:** |M| ≤ max(1e-6 ft-lb, 1e-9 × M<sub>max</sub>), M<sub>max</sub> = largest |M| anywhere on the member in that combination. The absolute 1e-6 ft-lb (f<sub>b</sub> ≈ 1e-5/S psi) covers combinations whose moments are all round-off; the relative term covers very large members. Round-off seen in the parity runs is about 1e-15 × M<sub>max</sub> (here 1.8e-12 ft-lb with M<sub>max</sub> ≈ 13,000 ft-lb), many orders below the tolerance; any real moment is many orders above it.
- **Effect:** a positive (top edge in compression) or negative (bottom edge in compression) moment region whose moment is round-off is treated as having no moment: M = 0, no location, ratio 0, no glulam C<sub>V</sub> for it, and no bottom-edge "R<sub>B</sub> > 50" failure (the anchor `if (s.bot.RB > 50 && combos.some(c => c.bend[i].Mn > 0))` is unchanged and now sees 0). The "Peak values" table shows "0 / —" instead of "0" at the support location. Formulas unchanged.
- **Governing provision:** NDS 2018 3.3.3.7 (R<sub>B</sub> ≤ 50) and 3.3.3 (C<sub>L</sub> of the compression edge). No code value changes.
- **Not changed (new open item P2-10):** the top-edge "R<sub>B</sub> > 50" failure (anchor `if (stabilityApplies && s.top.RB > 50) fails.push(`) does not depend on the moment at all (pre-R1 behaviour), so a span with no positive moment (e.g. a fixed-free cantilever under gravity load) is still flagged when its top-edge R<sub>B</sub> > 50. That is not a round-off case and was left alone.
- **Check case (parity case "rand 108", reproduced on the Validation tab):** DF-L SS 2x10 (1.5 × 9.25 in.), simple span 29.7 ft, spacing 12 in., D 11 / L 40 psf, self-weight, point loads 250 lb W at 10.22 ft, 1200 lb Lr at 8.52 ft, 3000 lb D at 25.57 ft, −400 lb L at 16.64 ft, 500 lb D at 23.17 ft; wet, 100–125 °F; bearing 1.5 in. with C<sub>b</sub>; top edge braced, bottom edge at supports only.
  - Bottom edge: l<sub>u</sub> = 356.4 in., l<sub>u</sub>/d = 38.5 > 14.3 with point loads → l<sub>e</sub> = 1.84 × 356.4 = 655.8 in.; R<sub>B</sub> = √(655.8 × 9.25/1.5²) = 51.92 > 50.
  - Statics: a simple span has M(L) = 0 exactly at the right support; the computed "−M" of every combination was 1.8e-12 to 1.5e-11 ft-lb, all at x = 29.7 ft (round-off of M(L) = R<sub>L</sub>L − wL²/2 − ΣP(L − a)). No other negative moment occurs.
  - Before: fails = ["Bottom edge (negative moment): slenderness RB = 51.9 exceeds 50 (NDS 3.3.3.7). Not permitted."] (NG), −M max = 1.5e-11 ft-lb.
  - After: no failure; −M = 0 in every combination. Headline unchanged (1144.5 %, deflection; this random case is grossly overstressed anyway). Every other result identical.

#### P2-2. 6x8 and 8x8 dressed sizes per NDS Supplement Table 1B

- **Where:** `const SIZES_DB = [`.
- **Before:**
  ```js
      { label: '6x8', b: 5.5, d: 7.25 }, { label: '8x8', b: 7.25, d: 7.25 },
  ```
- **After:**
  ```js
      // Engineer's decision P2-2 (2026-10-10, fix log R4): 6x8 and 8x8 dressed to NDS Supplement Table 1B (were 5.5 x 7.25 and 7.25 x 7.25)
      { label: '6x8', b: 5.5, d: 7.5 }, { label: '8x8', b: 7.5, d: 7.5 },
  ```
- **Whole list checked against the Table 1B convention** (dressed dry: 2"–4" nominal −½ in. (1.5, 3.5); widths 2"–6" −½ in.; widths 8" and over −¾ in. for dimension lumber (2x8 7.25, 2x10 9.25, 2x12 11.25); timbers 5" and larger −½ in. both ways): 2x4, 2x6, 2x8, 2x10, 2x12, 4x4, 4x6, 6x6 and all the R3 timbers (6x10 … 12x16) are consistent. Only 6x8 and 8x8 had the dimension-lumber −¾ in. rule applied to a timber. No other change.
- **Size class unchanged:** 6x8 d − b = 2.0 in. (was 1.75) → Posts and Timbers; 8x8 d − b = 0 → Posts and Timbers. Timber C<sub>F</sub> = 1.0 (d ≤ 12 in.). Both still ≥ 4.5 in. thick (Table 4D).
- **Governing provision:** NDS Supplement 2018 Table 1B (standard dressed sizes). Section properties A = bd, S = bd²/6, I = bd³/12 unchanged.
- **Saved data:** files store `material.size` = "6x8" / "8x8" by name, so every saved project with these sizes opens with the larger section and different results (no migration: the engineer's decision corrects the size; the old section can still be entered as Custom 5.5 × 7.25 or 7.25 × 7.25). **Less conservative** for bending, shear and deflection (larger section); **slightly more conservative for bearing** (the self-weight grows with A while the bearing width b of the 6x8 is unchanged; 8x8: b and self-weight both grow). In the parity runs the headline went down in 3,979 and up in 54 cases (all bearing-governed).
- **Check case 6x8** (Validation tab): DF-L No.1 6x8, simple span 12 ft, spacing 48 in. (trib. 4 ft), D 15 / L 40 psf, self-weight 34 pcf, top braced; Table 4D P&T No.1: F<sub>b</sub> 1200, F<sub>v</sub> 170, F<sub>c⊥</sub> 625, E 1.6M.

  | | Before (5.5 × 7.25) | After (5.5 × 7.5) |
  |---|---|---|
  | A (in²) | 39.875 | 41.25 |
  | S (in³) | 48.182 | 51.5625 |
  | I (in⁴) | 174.66 | 193.36 |
  | w (D + L) = 220 + 34A/144 (plf) | 229.41 | 229.74 |
  | M = wL²/8 (ft-lb) | 4129.5 | 4135.3 |
  | f<sub>b</sub> = 12M/S (psi) | 1028.5 | 962.4 |
  | bending f<sub>b</sub>/F′<sub>b</sub> (F′<sub>b</sub> = 1200) | **0.857** | **0.802** |
  | shear f<sub>v</sub>/F′<sub>v</sub> | 46.57/170 = 0.274 | 44.90/170 = 0.264 |
  | bearing | 0.114 | 0.115 |
  | LL defl. ratio (L/360) | 0.668 | 0.603 |
  | TL defl. ratio (L/240) | 0.735 | 0.665 |
  | Headline | 85.7 % bending | 80.2 % bending |

- **Check case 8x8** (Validation tab): DF-L No.1 8x8, 14 ft, same loads and spacing.

  | | Before (7.25 × 7.25) | After (7.5 × 7.5) |
  |---|---|---|
  | A (in²) | 52.5625 | 56.25 |
  | S (in³) | 63.513 | 70.3125 |
  | I (in⁴) | 230.23 | 263.67 |
  | w (plf) | 232.41 | 233.28 |
  | M (ft-lb) | 5694.1 | 5715.4 |
  | f<sub>b</sub> (psi) | 1075.8 | 975.4 |
  | bending ratio | **0.897** | **0.813** |
  | shear | 0.250 | 0.233 |
  | bearing | 0.103 | 0.100 |
  | LL defl. ratio | 0.805 | 0.703 |
  | TL defl. ratio | 0.900 | 0.790 |
  | Headline | 90.0 % deflection | 81.3 % bending |

#### P2-7. Repetitive member factor C<sub>r</sub> = 1.04 for SCL

- **Where:** `tbcRun`, anchor `const Cr = (dz.repetitive && cat === 'dim' && spacing <= 24) ? 1.15 : 1.0;`; constant after `const SCL_KINDS = {`.
- **Before:**
  ```js
      const Cr = (dz.repetitive && cat === 'dim' && spacing <= 24) ? 1.15 : 1.0;
      if (dz.repetitive && cat !== 'dim') notes.push('Cr applies to dimension lumber only (NDS 4.3.9); Cr = 1.0 used.');
      if (dz.repetitive && cat === 'dim' && spacing > 24) notes.push('Cr requires spacing ≤ 24 in. (NDS 4.3.9); Cr = 1.0 used.');
  ```
- **After:**
  ```js
      // Repetitive member factor: dimension lumber 1.15 (NDS 4.3.9); SCL 1.04 (NDS 8.3.7; engineer's decision P2-7, 2026-10-10, fix log R4)
      const Cr = (dz.repetitive && cat === 'dim' && spacing <= 24) ? 1.15 : (dz.repetitive && cat === 'scl' && spacing <= 24) ? SCL_CR : 1.0;
      if (dz.repetitive && cat !== 'dim' && cat !== 'scl') notes.push('Cr applies to dimension lumber only (NDS 4.3.9); Cr = 1.0 used.');
      if (dz.repetitive && cat === 'dim' && spacing > 24) notes.push('Cr requires spacing ≤ 24 in. (NDS 4.3.9); Cr = 1.0 used.');
      if (dz.repetitive && cat === 'scl' && spacing > 24) notes.push('Cr requires spacing ≤ 24 in. (NDS 8.3.7); Cr = 1.0 used.');
  ```
  and `const SCL_CR = 1.04;` (comment: NDS 2018 8.3.7, Table 8.3.1, as recalled: verify).
- **Conditions** (same input and logic as dimension lumber): the existing "Repetitive member" tick box (three or more members, spacing ≤ 24 in., load-distributing element) and spacing s ≤ 24 in. Applies to F<sub>b</sub> only (enters F<sub>b</sub>*, ASD and LRFD). **Not** glulam or timbers (note text unchanged for them). The SCL calc sheets already listed C<sub>r</sub>; their reference now reads "NDS 8.3.7 verify" (was "not applied to SCL, open item").
- **Governing provision:** NDS 2018 8.3.7 and Table 8.3.1 (SCL adjustment factors), as recalled; **verify** against the printed standard (Reference Values tab row "C<sub>r</sub>, SCL" carries the verify badge).
- **Less conservative** for SCL beams with Repetitive member ticked and s ≤ 24 in. (Repetitive member is ticked in a new project by default, so an SCL project with s ≤ 24 in. gets C<sub>r</sub> = 1.04 unless the box is cleared).
- **Check case** (Validation tab): the R3 LVL (1-3/4 × 14 in., user-entered example values F<sub>b</sub> 2600, n = 0.111, d<sub>ref</sub> 12, 42 pcf, 14 ft span) placed in a repetitive configuration with the same line load as R3: spacing 24 in. (trib. 2 ft), D 60 / L 160 psf → w = 2 × 220 + 42 × 24.5/144 = 447.15 plf (R3: 8 × 55 + 7.15). M = 447.15 × 14²/8 = 10,955 ft-lb; S = 1.75 × 14²/6 = 57.167 in³; f<sub>b</sub> = 10,955 × 12/57.167 = 2299.6 psi; C<sub>V</sub> = (12/14)<sup>0.111</sup> = 0.98303; C<sub>L</sub> = 1.0.
  - Before: F′<sub>b</sub> = 2600 × 1.0 × min(1.0, 0.98303) × C<sub>r</sub> 1.0 = 2555.9 psi; ratio **0.900** (= R3).
  - After: F′<sub>b</sub> = 2600 × 1.0 × 0.98303 × C<sub>r</sub> 1.04 = 2658.1 psi; ratio 2299.6/2658.1 = **0.865**. Shear 0.560, bearing 0.681, deflection unchanged. Headline 90.0 % → 86.5 % (bending).
  - Same beam, LRFD (1.2D + 1.6L, λ 0.8): F′<sub>b</sub> = 2600 × 0.8 × 0.98303 × 2.54 × 0.85 × C<sub>r</sub>: 4414.5 → 4591.1 psi; ratio 0.774 → 0.744 (headline stays 82.9 %, deflection).
  - R3 check as published (spacing 96 in.): unchanged, 0.900; with Repetitive member ticked the note now reads "Cr requires spacing ≤ 24 in. (NDS 8.3.7); Cr = 1.0 used." (was "Cr applies to dimension lumber only (NDS 4.3.9) …").

#### Text / UI changes (no calculation)

Factors tab hint of the Repetitive member box ("Dimension lumber C<sub>r</sub> = 1.15 (NDS 4.3.9); SCL C<sub>r</sub> = 1.04 (NDS 8.3.7). Not timbers or glulam."); SCL hint on the Factors tab; Design Values C<sub>r</sub> row (status "repetitive, s ≤ 24 in." when C<sub>r</sub> > 1; reference NDS 8.3.7 for SCL); bending "where" row for SCL; Reference Values: SCL note, new row "C<sub>r</sub>, SCL — 1.04 on F<sub>b</sub> … NDS 2018 8.3.7, Table 8.3.1" (verify), dressed-sizes row text; Method & Manual: SCL item and the Files item (6x8 / 8x8 files change results); Validation: 17 new benchmarks (the four checks above), hint mentions R4.

#### How verified

- `node --check` on all four inline scripts.
- **Engine parity (Node, scratchpad `followups/timber-p2-followups/parity4.js`):** origin/main engine vs this engine, deep comparison of every result field, plus this engine with each change undone by text substitution (N0 = all three undone; N1/N2/N7 = only P2-1 / P2-2 / P2-7 active). Model migration (`tbcMigrate`) identical in every case.
  - **20,417 Phase 1 / Phase 2 cases** (old file formats, every species × grade × size, 20,000 random files): N0 vs main **0 differences**. P2-1 alone changes **7,080** cases, **all of the round-off kind**: in every one main had a region moment 0 < |M| ≤ tolerance (mostly M(L) at the right end support of a simple span), and only the region fields (`bend[].Mp/xp/Mn/xn/fbp/fbn/rp/rn/zt/zb/CVt/CVb`) and the fail list differ; **no bending, shear or bearing ratio, F′<sub>b</sub>, headline or governing check changes**; **1** case loses a bottom-edge "R<sub>B</sub> > 50" NG (`rand 108`, the case that raised P2-1). P2-2 alone changes **2,427** cases, all with size 6x8 or 8x8. P2-7 alone changes **0** (no SCL in this set). All three together: 8,512 changed, **0 unexplained**.
  - **20,000 random Phase 2 models** (all distinct; sawn incl. 6x8 / 8x8 / timbers, glulam, SCL (LVL / PSL / LSL, C<sub>V</sub> limit 1.0 / 1.15), ASD / LRFD, 1–3 spans, fixed / free ends, 0–5 point loads, uplift, all lateral-support settings, spacing 12–96 in., Repetitive member random): N0 vs main **0 differences**. P2-1 alone: **4,459** changed, all of the round-off kind, ratios and headline unchanged in all; **14** lose a bottom-edge "R<sub>B</sub> > 50" NG that came only from a round-off moment. P2-2 alone: **3,262**, all 6x8 / 8x8. P2-7 alone: **2,539**, all SCL with Repetitive member and s ≤ 24 in.; only C<sub>r</sub>, F<sub>b</sub>*, F′<sub>b</sub>, C<sub>L</sub> (through F<sub>b</sub>*), bending ratios, governing bending and headline fields differ; **no ratio increases**. All three: 8,915 changed, **0 unexplained**.
  - Headline (P2-2, cases with results): lower in 3,979, higher in 54 (bearing governs; self-weight).
- **Hand checks:** all 87 Validation benchmarks match (70 earlier + 17 new) in Chromium.
- **Browser (headless Chromium, `file://`, KaTeX / plotly served locally), main vs branch, every output tab's text, the governing strip and the saved model:** default, glulam (simple, 2-span wet notched, SP LRFD with overhang and uplift), 6x12, SP No.1, LRFD joist: **identical**. R3 LVL (s = 96 in.): identical results and saved data; only the bending "where" row text (C<sub>r</sub> reference). Changed as intended: LVL repetitive ASD (90.0 → 86.5 %) and LRFD (ratio 0.774 → 0.744), 6x8 (85.7 → 80.2 %), 8x8 (90.0 % defl. → 81.3 % bending), rand 108 (bottom-edge NG removed). No console errors, no NaN / undefined, no KaTeX errors. Screenshots reviewed (scratchpad `followups/timber-p2-followups/shots/`).
- **Other copies of this code:** none (tool-specific).

## 2026-10-10 — PR: claude/timber-open-items (PR #93: https://github.com/mlococo88/All-Structural/pull/93)

### R5. Engineer's decisions on all pending open items (2026-10-10): top-edge R<sub>B</sub> > 50 only where the top edge is in compression (P2-10); Project / Checked by / Date shared (R1-g); the rest closed as built   [calc change] [P2-10: removes a false NG only; no ratio changes] [R1-g: hand-off fields added]

- **Date / type:** 2026-10-10. Engineer's instruction of 2026-10-10: "fix all pending items with your recommended fix". P2-10 and R1-g are changed (below); R1-b, R1-e, P2-4, P2-5, P2-6, P2-8, P2-9 are closed with no code change (decisions recorded in the open-item list); R1-f and P2-3 stay open because they need the printed NDS / Supplement. Only `Timber Beam Check.html` and this log change; HANDOFF.md is not changed (§4.1 already lists the shared fields and says each tool maps them onto its own title block; no tool-specific line for this tool exists there). CRLF kept. No storage key or saved-data format changed.

#### P2-10. Top-edge "R<sub>B</sub> > 50" failure only where positive moment occurs   [calc change: code-limit check] [less conservative only by removing an NG on a span whose top edge is never in compression]

- **Where:** `tbcRun`, (1) the beam-stability block, anchor `stab.forEach((s, i) => {` directly after `return { top, bot, cant: types[i] === 'free' || types[i + 1] === 'free' };` (≈ line 866); (2) directly after the bottom-edge slenderness block, anchor `edge (negative moment): slenderness RB = ` (≈ line 1041).
- **Before (1):**
  ```js
      stab.forEach((s, i) => {
          if (stabilityApplies && s.top.RB > 50) fails.push(nS === 1 ? `Slenderness RB = ${s.top.RB.toFixed(1)} exceeds 50 (NDS 3.3.3.7). Not permitted.` : `Span ${i + 1}: slenderness RB = ${s.top.RB.toFixed(1)} exceeds 50 (NDS 3.3.3.7). Not permitted.`);
      });
  ```
- **After (1):**
  ```js
      const topRBFail = [];   // top-edge "RB > 50" failures; kept below only for spans where positive moment occurs (P2-10, fix log R5)
      stab.forEach((s, i) => {
          if (stabilityApplies && s.top.RB > 50) { const msg = nS === 1 ? `Slenderness RB = ${s.top.RB.toFixed(1)} exceeds 50 (NDS 3.3.3.7). Not permitted.` : `Span ${i + 1}: slenderness RB = ${s.top.RB.toFixed(1)} exceeds 50 (NDS 3.3.3.7). Not permitted.`; fails.push(msg); topRBFail.push({ i, msg }); }
      });
  ```
- **Before (2):** (nothing after the bottom-edge block)
  ```js
      if (latBot !== 'same' && stabBot) stab.forEach((s, i) => {
          if (s.bot.RB > 50 && combos.some(c => c.bend[i].Mn > 0)) fails.push(`${nS > 1 ? `Span ${i + 1}, bottom` : 'Bottom'} edge (negative moment): slenderness RB = ${s.bot.RB.toFixed(1)} exceeds 50 (NDS 3.3.3.7). Not permitted.`);
      });
  ```
- **After (2):** the same block, followed by
  ```js
      // Engineer's decision P2-10 (2026-10-10, fix log R5): the top-edge "RB > 50" failure stands only for a span where positive
      // moment (top edge in compression) occurs in some combination, as for the bottom edge above. Region moments are already
      // round-off filtered (P2-1: |M| <= max(1e-6 ft-lb, 1e-9 x Mmax) is 0). "Same as top edge": the bottom edge has the same RB and
      // no failure of its own, so the failure also stands where negative moment occurs.
      topRBFail.forEach(t => { if (!combos.some(c => c.bend[t.i].Mp > 0 || (latBot === 'same' && c.bend[t.i].Mn > 0))) fails.splice(fails.indexOf(t.msg), 1); });
  ```
- **Logic (mirrors the bottom edge exactly):** the failure for span *i* stands when some combination has `bend[i].Mp > 0`. `Mp` is the region moment after the P2-1 / R4 round-off filter (|M| ≤ max(1e-6 ft-lb, 1e-9 × M<sub>max</sub>) is set to 0 in `tbcRun`, anchor `const Mtol = Math.max(M_TOL_ABS, M_TOL_REL * Mmax);`), so the tolerance is the same one the bottom edge uses; no second tolerance was introduced. The message is still pushed at its old place and removed afterwards, so the order of the remaining failures is unchanged (e.g. the end-notch failure stays after it), and an input error that stops the run before the moments are known (negative / too-deep notch) returns the same `fails` list as before.
- **"Same as top edge" (`latBot = 'same'`, files of the earlier tool version that keep it):** in that mode the bottom edge uses the top-edge R<sub>B</sub> and has no failure of its own (the bottom-edge block is skipped), and the top-edge message is the only R<sub>B</sub> > 50 failure for either edge. Removing it for a cantilever would have dropped the check of the compression (bottom) edge, so in this mode the failure also stands where negative moment occurs. The failure is removed only when neither edge is ever in compression in that span.
- **C<sub>L</sub> / bending of the top edge (checked, no change needed):** C<sub>L</sub> of the top edge (`CLt`) is computed for every span but enters only `Fbp_t`, which divides `fbp = Mp × 12/S`; with Mp = 0 the top-edge ratio `rp` is 0, so the top edge never governs a span or combination with no positive moment (the governing region is the largest of `rp` / `rn`). The top-edge C<sub>L</sub> calc sheet is shown only when the governing region is +M. So C<sub>L</sub> and the bending check of the top edge are already applied only where the top edge is in compression. Display only: the "Bending by span and sign" table still lists C<sub>L</sub> and F′<sub>b</sub> for the "+M (top)" row with M = 0 and ratio 0.000, and the stability table still lists the top-edge R<sub>B</sub> (no NG mark there). Unchanged.
- **Governing provision:** NDS 2018 3.3.3 (beam stability factor C<sub>L</sub>): l<sub>u</sub> is the distance between points of lateral support of the **compression** edge (3.3.3.4–3.3.3.5 as recalled) and 3.3.3.7 limits R<sub>B</sub> = √(l<sub>e</sub>d/b²) ≤ 50 for that unbraced length; Table 3.3.3. Wording as recalled: **verify** against the printed NDS 2018. No formula, factor or limit value changes; only the edge to which the limit is applied.
- **Effect:** fewer NG results; the only cases affected are spans that are never in positive moment with the top edge braced at supports only and top-edge R<sub>B</sub> > 50: cantilevers under gravity load (fixed-free, or an overhang span), and spans in net uplift in every combination. Every stress ratio, F′<sub>b</sub>, C<sub>L</sub>, the headline and the governing check are unchanged; the summary changes from "Code limit violated (NG)" to the governing check when no other failure remains.
- **Check case (Validation tab, "Fixed-free cantilever, no positive moment"):** LVL 1-3/4 × 24 in. (the user-entered example LVL values of R3 / R4: F<sub>b</sub> 2600, F<sub>v</sub> 285, F<sub>c⊥</sub> 750, E 1.9M, E<sub>min</sub> 966,000 psi, n = 0.111, d<sub>ref</sub> 12 in., C<sub>V</sub> limit 1.0, 42 pcf); 16 ft cantilever, fixed at A (bearing 5.5 in.), free at B; spacing 24 in. (trib. 2 ft); D 10 / L 40 psf, self-weight; ASD, dry, normal temperature, not repetitive; top edge "at supports only" (l<sub>u</sub> = span), bottom edge "at supports only" with l<sub>u</sub> = 4 ft (braces at 4 ft).
  - Section: A = 42 in², S = 1.75 × 24²/6 = 168 in³, I = 2016 in⁴. Self-weight 42 × 42/144 = 12.25 plf; w (D) = 2 × 10 + 12.25 = 32.25 plf; w (D + L) = 32.25 + 2 × 40 = 112.25 plf.
  - Moments: cantilever under downward load: M(x) = −w(16 − x)²/2 ≤ 0 everywhere, every combination (W = 0, no point loads). **+M = 0 in every combination** (top edge in tension); −M at the fixed end = 112.25 × 16²/2 = **14,368 ft-lb** (D + L).
  - Top edge: l<sub>u</sub> = 192 in., l<sub>u</sub>/d = 8.0 → footnote 1 general rule 7 ≤ l<sub>u</sub>/d ≤ 14.3: l<sub>e</sub> = 1.63 × 192 + 3 × 24 = 384.96 in.; R<sub>B</sub> = √(384.96 × 24/1.75²) = **54.93 > 50**.
  - Bottom edge: l<sub>u</sub> = 48 in., l<sub>u</sub>/d = 2.0 < 7: l<sub>e</sub> = 2.06 × 48 = 98.88 in.; R<sub>B</sub> = √(98.88 × 24/1.75²) = 27.84 ≤ 50; F<sub>bE</sub> = 1.20 × 966,000/27.84² = 1495.9 psi; F<sub>b</sub>* = 2600 psi (C<sub>D</sub> 1.0); F<sub>bE</sub>/F<sub>b</sub>* = 0.5754; C<sub>L</sub> = 1.5754/1.9 − √((1.5754/1.9)² − 0.5754/0.95) = 0.8291 − 0.2861 = **0.5431**.
  - C<sub>V</sub> = (12/24)<sup>0.111</sup> = 0.9259 > C<sub>L</sub>, so F′<sub>b</sub> = 2600 × min(C<sub>L</sub>, C<sub>V</sub>) = 2600 × 0.5431 = **1412.0 psi**; f<sub>b</sub> = 14,368 × 12/168 = **1026.3 psi**; ratio **0.727** (bottom edge, D + L) governs. Shear 0.197 (V at d = 1796 − 112.25 × 2 = 1571.5 lb, f<sub>v</sub> = 56.1 psi), bearing at A 0.249 (1796/(1.75 × 5.5) = 186.6 psi), deflection 0.297 (total, tip, L = 2 × 16 ft).
  - **Before:** fails = ["Slenderness RB = 54.9 exceeds 50 (NDS 3.3.3.7). Not permitted."] → summary "Code limit violated (NG) · 72.7 %".
  - **After:** no failure → summary "Bending Moment · 72.7 %" (**OK**, bottom-edge bending governs). Every number above identical before and after.
  - Same model with the bottom edge "Same as top edge" (earlier-version mode): NG before and after (the bottom edge then has R<sub>B</sub> = 54.93 > 50 and is in compression).

#### R1-g. Shared project info: Project, Checked by and Date   [hand-off: fields added] [no result change]

- **Where:** anchor `var TBC_PROJ_MAP=[` (≈ line 341).
- **Before:**
  ```js
  var TBC_PROJ_MAP=[{shared:'client',key:'client',label:'Client'},
                    {shared:'jobNo',key:'job',label:'Job #'},
                    {shared:'preparedBy',key:'designer',label:'Designer'}];
  ```
- **After:**
  ```js
  /* Engineer's decision R1-g (2026-10-10, fix log R5): Project, Checked by and Date added (HANDOFF.md §4.1 field names). */
  var TBC_PROJ_MAP=[{shared:'projectName',key:'name',label:'Project'},
                    {shared:'client',key:'client',label:'Client'},
                    {shared:'jobNo',key:'job',label:'Job #'},
                    {shared:'preparedBy',key:'designer',label:'Designer'},
                    {shared:'checkedBy',key:'checker',label:'Checked by'},
                    {shared:'date',key:'date',label:'Date'}];
  ```
- **Field names:** the HANDOFF.md §4.1 `projectMeta` fields `projectName`, `checkedBy`, `date` (the names Steel Beam Design, Gusset Plate Rating, Section Property Calculator, Concrete Anchor and Pile Designer use). The existing Client / Job # / Designer mappings are kept. Member / mark and Notes are not shared (no matching field).
- **Behaviour:** "Share project info" now writes all six fields (and the envelope `project.name` = Project, so the other tools' "from …" line shows the project name); "Use shared project info" fills them (the existing rules: a blank shared value never blanks a field; the confirm dialog lists every overwrite). The date is a free-text field in this tool (as in Steel Beam), so any shared date text is accepted.
- **Saved data:** none changed. `M.project` keeps the keys `name, member, client, job, designer, checker, date, notes`; the `bridgeSuite.v1.projectMeta` payload shape is the HANDOFF.md §4.1 shape (the three fields were already in it, written blank by this tool before).
- **Method & Manual** text updated (Saved data: shared fields).

#### Closed with no code change (engineer's decisions 2026-10-10)

R1-b (footnote 1 general rule for l<sub>e</sub> of continuous beams and cantilevers kept), R1-e (C<sub>b</sub> ticked by default at interior supports kept), P2-4 (C<sub>M</sub> on SP timber F<sub>c⊥</sub> when wet kept, conservative), P2-5 (Table 4D flat-use factors kept as built, values still marked "verify"), P2-6 (a)–(f) (glulam choices kept as built), P2-8 (LRFD λ options kept: no impact, 0.5L exception not used), P2-9 (tension-face F<sub>c⊥x</sub> for glulam bearing kept). See the open-item list.

#### Still open (need the printed NDS 2018 / Supplement)

R1-f (equation numbers) and P2-3 (values not built in): reworded in the open-item list.

#### Text / UI changes (no calculation)

Method & Manual: Bending item ("R<sub>B</sub> ≤ 50 is enforced … for each edge in a span where that edge is in compression in some combination"); Saved data item (shared fields). Validation: 9 new benchmarks (the P2-10 check case), hint mentions R5.

#### How verified

- `node --check` on all inline scripts.
- **Engine parity (Node, scratchpad `followups/timber-open-items/parity5.js`):** origin/main engine vs this engine, deep comparison of every result field (`tbcRun` output incl. fails, notes, advisories, every combination, stability and deflection field), plus this engine with the P2-10 line removed by text substitution (must equal main). Model migration (`tbcMigrate`) identical in every case. Every difference is classified: only `fails` may differ; the remaining failures must be main's minus the removed ones in the same order; each removed message must be a top-edge "RB > 50" message (single-span or "Span k:" form) for a span with R<sub>B</sub> > 50, top edge at supports only, no positive moment in any combination and (for "same as top edge") no negative moment either; no failure may be added.
  - **20,417 Phase 1 / Phase 2 cases** (old file formats, every species × grade × size, 20,000 random files): P2-10 undone vs main **0 differences**; this engine vs main: **0 cases change** (all are single spans on two supports; every one has positive moment in some combination).
  - **20,000 random Phase 2 models** (the R4 generator and seed: sawn / glulam / SCL, ASD / LRFD, 1–3 spans, fixed / free ends, point loads, uplift, all bracing settings): P2-10 undone vs main **0 differences**; this engine vs main: **11 change**, 13 top-edge messages removed, **all 11 of the expected kind and nothing else differs** (11 with a free end, 8 multi-span, 5 with uplift); all 11 stay NG for other reasons (these random members are grossly overstressed, headline 215–18,143 %).
  - **5,000 targeted models** (fixed-free / free-fixed cantilevers, overhangs, 2-span + overhang; slender deep sections: 1.5 in. sawn to 16 in., glulam 3-1/8 in., SCL 1-3/4 × 16–24 in.; top edge at supports only; light loads): P2-10 undone vs main **0 differences**; this engine vs main: **137 change**, 137 messages removed, **all of the expected kind and nothing else differs** (all 137 single-span cantilevers); **64 go from NG to OK** (e.g. a fixed-free cantilever with top R<sub>B</sub> 51.6–59.5 and headline 20–79 %), 73 stay NG for other reasons.
  - Classification run on every changed case: only `fails` differs (no ratio, F′<sub>b</sub>, C<sub>L</sub>, headline, governing, note or advisory changes); the remaining failures are main's in the same order; no failure is added; no case with "same as top edge" and negative moment changes.
- **Hand check:** the cantilever above reproduced on the Validation tab; all **96** Validation benchmarks match (87 earlier + 9 new) in Chromium.
- **Browser (headless Chromium, `file://`, KaTeX / plotly served locally), main vs branch, every output tab's text, the governing strip and the saved model:** default, glulam, glulam 2-span wet notched, SP glulam LRFD with overhang and uplift (top edge at supports), 6x12, SP No.1, R3 LVL, LRFD joist, 6x8, rand 108, a slender simple span (top R<sub>B</sub> > 50, still NG), the check-case cantilever with "Same as top edge" (still NG): **identical** in all 11 compared views (every output tab except Validation and Method & Manual, whose text changes by design, plus the governing strip) and the saved model. Check-case cantilever: saved data and every result view identical; only the Summary and the governing strip change ("Code limit violated (NG) · 72.7 %" with the R<sub>B</sub> message → "Bending Moment · 72.7 %", OK). Validation tab: all 96 match. No console errors or warnings, no NaN / undefined, no KaTeX errors. Screenshots: scratchpad `followups/timber-open-items/shots/`.
- **Project-info round trip (same `file://` origin in one Chromium context):** Timber title block filled (Project, Member, Client, Job #, Designer, Checked by, Date) → "Share project info" → `bridgeSuite.v1.projectMeta.fields` = projectName / client / jobNo / preparedBy / checkedBy / date with the typed values (bridgeId, location blank; producer "Timber Beam Check") → Steel Beam "Use shared project info" fills its Project name, Prepared by, Checked by and Date with them. Reverse: Steel Beam values typed and shared → Timber "Use shared project info" fills Project, Designer, Checked by and Date; Client, Job # and Member keep their values (Steel shares them blank). Project object keys unchanged. No console errors or warnings on any of the three pages.
- **Other copies of this code:** none (tool-specific). The `ProjMetaUI` helper (shared with other tools) is unchanged.

## 2026-10-12 — PR: claude/sweep-timber (PR #150: https://github.com/mlococo88/All-Structural/pull/150)

### S1. Open-item sweep: every open item of this tool (O4–O8, O11–O14, R1-f, R1-i, P2-3)   [calc change: O4 shear, MORE conservative by default] [notes / advisories / text only for the rest]

- **Date / type:** 2026-10-12. Engineer's instruction of 2026-10-12: "continue making updates and fixes until it's completed. Use your best judgment ... If there is something that absolutely needs my input then note it." Only `Timber Beam Check.html` and this log change. CRLF kept. No storage key changed; one new optional saved field (`design.shearXd`, below).
- **Status of the O-items before this sweep:** O4–O8 and O11–O14 had no R4 / R5 annotation. R5 closed only R1-b, R1-e and P2-4 to P2-9 by name ("the rest closed as built" in the R5 heading refers to those), so they were still open. Each is settled below.

| Item | Result |
|---|---|
| O4 | **Fixed (calc).** Re-checked: the item was mis-described. The tool did not "not reduce" point loads within d; it left them out of the design shear altogether (unconservative). Now included at full value (default) or times x/d (new option). See S1-a. |
| O5 | Closed, no change: the footnote 1 general rule is used with point loads; conservative; documented (Method & Manual, Bending; Design Values). |
| O6 | Closed, no change: the tool follows NDS 2018 Table 3.3.3 (see S1-b). Printed-table check stays with R1-f. |
| O7 | **Needs engineer** (no code change): see "Needs engineer" below. |
| O8 | Closed as a documented limitation: the notch input hint now says one depth at both ends and that interior and compression-face notches are not checked; Method & Manual limitation reworded. |
| O11 | **Needs engineer** (values): with P2-3. |
| O12 | Closed with the conservative default: C<sub>F</sub> = 1.1 not applied; a note now appears on the Summary when the case arises (S1-c). |
| O13 | **Needs engineer** (cross-tool X-C8): ASCE 7-16 kept. |
| O14 | Closed with the conservative default: C<sub>i</sub> stays applied to timbers when ticked; a note now appears (S1-c). |
| R1-f | **Needs engineer** (printed NDS 2018). |
| R1-i | Closed: an advisory is now shown whenever a support is fixed (S1-c). |
| P2-3 | **Needs engineer** (values). |

#### S1-a. O4: point loads within d of a support in the design shear   [calc change] [MORE conservative by default; the new x/d option lowers V again, never below the region value]

- **Where:** `tbcRun`, per-combination block. Anchors: `const shearOf = (bmS, PS, bmR) =>` (new) and `const dft = dep / 12;` (the `xdFac` helper follows it). Also `tbcDefaultModel` (`shearXd: false`), `tbcFromLegacy` (`shearXd: false`), `tbcSanitize` (`shearXd: bo(dz.shearXd, false)`), the result object (`shearXd`), and each combination object (`vZone, Pv, xdUsed`).
- **Problem:** the design shear V was the largest |V| in the region from d off each support to d off the next support. That applies NDS 3.4.3.1(a) (uniform load within d may be ignored) correctly, but a concentrated load *inside* the zone within d of a support is on the support side of the section at d, so it never entered V (its only effect on the region was a small opposite-signed P·a/L). NDS 3.4.3.1(b) only permits such a load to be **multiplied by x/d**, not ignored. Fix log F9 / O4 described this as "not reduced (conservative)"; it was in fact unconservative, by up to the whole point load. The original (pre-F9) code did the same (`if (d_ft > pl.loc) V_crit -= pl.mag`).
- **Governing provision:** NDS 2018 3.4.3.1(a) and (b) (verify wording against the printed NDS: (b) "concentrated loads within a distance d from supports shall be permitted to be multiplied by x/d", x = distance from the beam support face to the load).
- **Before:**
  ```js
        // Design shear: max |V| between d from each support (NDS 3.4.3.1(a)); no x/d reduction of point loads
        let Vd = 0, xV = 0;
        shearRegion.forEach(x => { const v = Math.max(Math.abs(bm.V(x, false)), Math.abs(bm.V(x, true))); if (v > Vd) { Vd = v; xV = x; } });
  ```
- **After:**
  ```js
    const dft = dep / 12;
    // NDS 3.4.3.1(b) option (fix log O4): point loads within d of a support multiplied by x/d for the design shear only;
    // x = distance from the support point (node). Off (default): point loads within d count at full value.
    const shearXd = !!dz.shearXd;
    const supXs = xN.filter((_, j) => types[j] !== 'free');
    const xdFac = (loc) => { const x = Math.min(...supXs.map(s => Math.abs(loc - s))); return x < dft ? x / dft : 1; };
  ...
        // Design shear: max |V| between d from each support (NDS 3.4.3.1(a): uniform load within d ignored). Fix log O4: a point
        // load within d of a support adds to the shear at that support (the region alone left it out) at full value.
        const shearOf = (bmS, PS, bmR) => {   // bmS / PS: model and loads at the supports; bmR: an extra model for the region (envelope)
            let Vd = 0, xV = 0, vZone = null;
            shearRegion.forEach(x => { [bmS, bmR].forEach(q => { if (!q) return; const v = Math.max(Math.abs(q.V(x, false)), Math.abs(q.V(x, true))); if (v > Vd) { Vd = v; xV = x; } }); });
            Ls.forEach((Li, i) => {
                const lo = xN[i] + (types[i] !== 'free' ? dft : 0), hi = xN[i + 1] - (types[i + 1] !== 'free' ? dft : 0);
                if (simple ? !(L > 2 * dft) : lo > hi) return;   // short span: the whole span is in the shear region already
                [[i, 1], [i + 1, -1]].forEach(([j, dir]) => {
                    if (types[j] === 'free') return;
                    const s0 = xN[j];
                    if (!PS.some(p => p.mag !== 0 && dir * (p.loc - s0) > 0 && dir * (p.loc - s0) < dft)) return;   // no point load inside this zone
                    // shear at the support with the uniform load within d ignored = V at d + the point loads within d
                    const v = Math.abs(dir > 0 ? bmS.V(s0, true) - w * dft : bmS.V(s0, false) + w * dft);
                    if (v > Vd) { Vd = v; xV = s0; vZone = j; }
                });
            });
            return { Vd, xV, vZone };
        };
        let { Vd, xV, vZone } = shearOf(bm, P, null);
        // NDS 3.4.3.1(b) option: downward point loads within d of a support times x/d. The reduced model gives the shear at the
        // supports; the region takes the larger of the full and reduced models (a reduced load must not lower the shear
        // elsewhere, e.g. a load on an overhang); the result is used only when it is lower than without the reduction.
        const Pv = shearXd ? P.map(p => { const k = xdFac(p.loc); return (k < 1 && p.mag > 0) ? { mag: p.mag * k, loc: p.loc } : p; }) : P;
        let xdUsed = false;
        if (Pv.some((p, k) => p !== P[k])) {
            const sx = shearOf(simple ? beam(w, Pv) : beamG(w, Pv), Pv, bm);
            if (sx.Vd < Vd) { ({ Vd, xV, vZone } = sx); xdUsed = true; }
        }
  ```
  and `Vd, xV, Rmax,` → `Vd, xV, vZone, Pv, xdUsed, Rmax,` in the combination object.
- **Method:** where a non-zero point load lies strictly inside the zone within d of a support (not at the support itself, which goes straight into the reaction), the shear at that support is evaluated with the uniform load in the zone ignored: V<sub>s</sub> = V(s<sup>+</sup>) − w·d on the span side to the right of the support, V(s<sup>−</sup>) + w·d to the left (identical to "V at d plus the point loads in the zone"). The design shear is the larger of this and the region maximum. Cases with no point load inside a zone are computed exactly as before (no round-off change: the support value is not evaluated at all).
- **Option (new input, Loads tab, under the point loads):** "Reduce point loads within d of a support by x/d (shear, NDS 3.4.3.1(b))", **default unticked** (the code-compliant and conservative choice: the reduction is a permission, and it needs a beam in full bearing on one face with the loads on the opposite face, which the tool cannot know). When ticked, downward point loads within d of a support are multiplied by x/d for the design shear only; x is measured from the support point (node), which gives a larger x/d than the support face (conservative). Upward point loads are not reduced. Reactions, bearing, notch shear (full reaction, unchanged), moments, deflections and the plotted shear diagram use the full loads. The region is enveloped with the full-load model, and the reduced result is used only if it is lower than the unreduced one.
- **Saved data (§5):** new optional field `design.shearXd` (boolean). Files without it (every earlier file, all versions, and pre-R1 flat files) open with `false`: results as the default above. Saved-data version numbers unchanged (2, or 3 with glulam / SCL / LRFD). No storage key added or changed.
- **Check case (hand-checkable; also on the Validation tab as 6 benchmarks):** the fix-log joist (DF-L No.2 2x10 @ 16 in., simple span 14 ft, D 10 / L 40 psf, self-weight on: w = 50 × 16/12 + 34 × 13.875/144 = 66.667 + 3.276 = 69.943 plf) plus a 1000 lb D point load at x = 0.5 ft. d = 9.25 in. = 0.7708 ft; A = 13.875 in²; D + L: C<sub>D</sub> = 1.0, F′<sub>v</sub> = 180 psi.
  - R<sub>A</sub> = 69.943 × 7 + 1000 × 13.5/14 = 489.60 + 964.29 = 1453.88 lb; R<sub>B</sub> = 489.60 + 1000 × 0.5/14 = 525.31 lb.
  - **Before:** region only. At x = d: 1453.88 − 69.943 × 0.7708 − 1000 = 399.97 lb; at x = L − d: 525.31 − 53.91 = 471.40 lb → V = 471.4 lb, f<sub>v</sub> = 1.5 × 471.40/13.875 = 50.96 psi, **ratio 0.283**.
  - **After (default, full value):** V at A = 1453.88 − 53.91 = **1399.97 lb** (x = 0), f<sub>v</sub> = 151.35 psi, **ratio 0.841**. MORE conservative.
  - **After (x/d ticked):** P′ = 1000 × 0.5/0.7708 = 648.65 lb; R′<sub>A</sub> = 489.60 + 648.65 × 13.5/14 = 1115.08 lb; V at A = 1115.08 − 53.91 = **1061.17 lb**, f<sub>v</sub> = 114.72 psi, **ratio 0.637** (region, envelope of full and reduced models: 471.4 lb, does not govern). Less conservative than the new default, more conservative than before.
  - Headline unchanged (bending 0.972 governs).
  - Second case (continuous, in the node run only): 2 × 12 ft, default 2x10 DF-L No.2 @ 16 in., D 15 / L 40 psf, 1500 lb L at x = 12.4 ft (0.4 ft right of B): D + L V = 539.3 lb (x = 11.23 ft) before → 1989.3 lb at support B (ratio 0.324 → 1.195, NG) → with x/d 1280.3 lb (ratio 0.769).
- **UI / text:** Loads tab hint and the new checkbox; Shear tab "Design shear V" (formula line says "at support X, uniform load within d ignored, point loads within d included" when that governs; the result line lists the x/d-reduced loads or says the loads are at full value); Analysis tab hint; Schematic & Inputs row "Point loads within d of a support (shear): full value / times x/d"; Method & Manual (Inputs, Shear, Limitations); Validation hint mentions S1.

#### S1-b. O6: l<sub>e</sub> for a single span with uniform load at l<sub>u</sub>/d > 14.3   [closed, no change]

- NDS 2018 Table 3.3.3, row "Single span beam, uniformly distributed load": l<sub>e</sub> = 2.06 l<sub>u</sub> for l<sub>u</sub>/d < 7, and l<sub>e</sub> = 1.63 l<sub>u</sub> + 3d for l<sub>u</sub>/d ≥ 7 (two columns; no 14.3 break). The three-range rule with 1.84 l<sub>u</sub> for l<sub>u</sub>/d > 14.3 is footnote 1 (single span or cantilever with any loading not listed). The tool already does exactly this (anchor `else if (fn1 && luD > 14.3)`): uniform load on a simple span → table row; point loads, continuous, cantilever → footnote 1. The reviewer's 1.84 l<sub>u</sub> is the footnote value. The tool is therefore right as built; changing the condition would be more conservative than the table but not what it says. As recalled — confirm against the printed table (open item R1-f / ENGINEER_CHECKS A6, unchanged).

#### S1-c. O12, O14, R1-i: notes and advisory (no result change)

- **Where:** `tbcRun`. Anchors: after `CFnote = \`Table 4A, ${wg >= 14` (O12), after `notes.push('Ci applies to sawn lumber only` (O14), before `if (hasNotch && notchJ.length < 2 && !simple) adv.push(` (R1-i).
- **Added:**
  ```js
        if (!userVals && mt.species === 'SP' && thick4 && wg >= 8) notes.push('Southern Pine 4 in. thick, 8 in. and wider: the Table 4B footnote permits CF = 1.1 on Fb. Not applied (conservative, fix log O12).');
    if (ciOn && cat === 'timber') notes.push('Incised timber: NDS 4.3.8 and Table 4.3.8 are written for dimension lumber. Their Ci values are applied to this timber as ticked (conservative, fix log O14). Untick Incised if the timber is not incised.');
    if (types.some(t => t === 'fixed')) adv.push('Fixed support: bearing is checked with the vertical reaction only (uniform Fc⊥ stress over the bearing length). The effect of the fixing moment on the bearing stress, and the connection that provides the fixity, are not checked (fix log R1-i).');
  ```
- **O12 decision:** NDS Supplement 2018 Table 4B size-factor footnote *permits* C<sub>F</sub> = 1.1 on F<sub>b</sub> for 4 in. thick, 8 in. and wider (verify wording). Permitted, not required, so the conservative default (not applied) is kept and the user is told. Affects only a Custom-size SP section 2.5 < b ≤ 3.5 in. with d > 5.5 in. (no built-in size).
- **O14 decision:** keep applying the dimension-lumber C<sub>i</sub> (0.80 / 0.80 / 1.0 / 0.95) to an incised timber when ticked (conservative stand-in); note shown.
- **R1-i:** the bearing check is unchanged; the advisory makes the limitation visible.
- **Check cases (node and browser):** default model with species SP, Custom 3.5 × 9.25 in. → the O12 note, results identical to main; 6x12 DF-L No.2, spacing 48 in., Incised ticked → the O14 note, results identical; cantilever 6 ft fixed-free → the R1-i advisory, results identical.

#### S1-d. O8: notch limitation stated at the input   [text only]

- Notch input hint (sawn and glulam) now ends: "The same depth is used at both end supports. Interior notches and notches on the compression face are not checked (fix log O8)." Method & Manual limitation: "no interior or compression-face notches, one notch depth at both ends (O8)". Anchor: `fRow(body, 'Notch depth at end supports'` (the hint ternary is wrapped in parentheses to append the sentence).

#### Needs engineer

1. **O7 (deflection).** The tool applies K<sub>cr</sub> to the dead load only (no sustained-live-load input), leaves wind out, and takes the live/transient deflection as the largest of L, Lr, S, 0.75L + 0.75Lr, 0.75L + 0.75S. Question: is this transient set what you want? Recommendation: keep it (it brackets the IBC 1604.3 live / snow checks); add a "sustained portion of L" input only if you design storage floors with it.
2. **O13 / X-C8 (ASCE 7 edition).** The tool states ASCE 7-16 Sec. 2.4.1 / 2.3.1. Question: governing edition for the suite? Recommendation: keep 7-16 until the cross-tool X-C8 decision; the combinations used are the same in 7-22 for D, L, Lr, S, W (as recalled; verify).
3. **O11 / P2-3 (values).** Stud 8 in. and wider (Table 4A directs No.3 values), SP Stud (Table 4B), SPF timbers (Table 4D), Dense / Non-Dense grades, other glulam combinations: please supply the printed Supplement values to build in. Until then the tool asks for Manual values.
4. **R1-f (equation numbers) and S1-b (Table 3.3.3 layout).** Check against the printed NDS 2018: Eq. 3.3-2, 3.3-5, 3.3-6, 3.4-2, 3.4-3, 3.5-1, 3.10-2; Table 3.3.3 single-span uniform-load row (two columns, 7 as the only break) and footnote 1 (three ranges); 3.4.3.1(b) wording (x from the support face).
5. **O4 default (confirmation only).** The x/d reduction defaults to off. If you would rather it default on for new projects, say so (old files would still open with it off).

#### How verified

- `node --check` on all 4 inline scripts: no errors.
- **Engine parity (Node, scratchpad `tbsweep/parity.js`):** origin/main engine vs this engine, deep comparison of every `tbcRun` field, plus this engine with the new support-zone line removed by text substitution (must equal main apart from the new fields and the three new notes/advisory).
  - **20,417 Phase 1 / Phase 2 cases** (old file formats): migrated model identical apart from `shearXd: false`; zone-undone vs main **0 differences**; this engine vs main: **1,643 cases change, all in shear fields only** (V<sub>d</sub>, x<sub>V</sub>, f<sub>v</sub>, shear ratio, governing shear combination, and the headline / controlling name where shear now governs); **V<sub>d</sub> never lower**; every changed combination has its design shear at a support with a non-zero point load strictly within d of it; no case turns NG by headline (largest increase × 18.7).
  - **6,000 random Phase 2 models** (R4 generator and seed; half of the point loads moved to within 1.5 ft of a node; incising randomised): 0 migration differences; zone-undone vs main 0; **1,048 change, shear fields only**, V<sub>d</sub> never lower, all at a support with a point load within d; 4 go from OK to NG.
  - **x/d option on vs off (4,992 valid random models):** 1,707 change, only shear fields; **no combination has a larger V<sub>d</sub> with the option on**; no change where no point load lies within d of a support.
- **Hand check:** the S1-a case reproduced live on the Validation tab (6 new benchmarks); **all 102 benchmarks match** (96 earlier + 6) in Chromium.
- **Browser (headless Chromium, `file://`, KaTeX / plotly served locally), main vs branch, every output tab's text, the governing strip and the saved model, 13 cases:** default, glulam, glulam 2-span wet notched, SP glulam LRFD with overhang and uplift, 6x12, SP No.1, LVL, LRFD joist with notch, rand 108 (five point loads), cantilever (fixed support), the S1-a check case, SP 3.5 × 9.25 in., incised 6x12. Saved model identical in every case apart from the added `shearXd: false`. Results identical in every case except the S1-a case (shear 0.283 → 0.841; headline 97.2 % unchanged). Text differences, all intended: the new Schematic & Inputs row (all cases), the Analysis and Shear tab wording (all), the R1-i advisory (cantilever), the O12 note (SP 3.5 × 9.25), the O14 note (incised 6x12). Ticking the new box in the UI on the check case gives V = 1061.17 lb (hand 1061.17). No console errors or warnings, no NaN / undefined, no KaTeX errors. Screenshots: scratchpad `tbsweep/shots/` (Loads tab with the box, Shear tab main / branch / x/d, Validation).
- **Other copies of this code:** none (tool-specific).

## Open items (not changed)
- O1. **Libraries.** Versions pinned 2026-10-09 (L1): `@babel/standalone@7.29.10`, `lucide@1.54.0` (unused), Tailwind Play CDN 3.4.17. Still open: *(R1: resolved; the rebuild uses only KaTeX 0.16.11 and plotly-basic 2.35.2.)*
  - Tailwind Play CDN (`cdn.tailwindcss.com`) is meant for development only.
  - esm.sh serves React 18.2.0 and lucide-react (exact versions) and is not on the CLAUDE.md host list.
- O2. **Southern Pine SS, No.1 and Stud (Table 4B)**, and the SP Ft/Fc values, were not entered because I am not confident of them. The tool asks for Manual values. Decision: supply the values from the Supplement to add. *(R3: SS, No.1 and F<sub>t</sub>/F<sub>c</sub> added (verify); Stud still not built in, P2-3.)*
- O3. **Table 4D timbers** (Beams & Stringers, Posts & Timbers) values are not built in, and flat use of timbers is blocked. Recommendation: add DF-L/HF/SP Table 4D values from the Supplement if timbers are needed. *(R3: added for DF-L, HF, SP, incl. flat use (verify); SPF not built in, P2-3.)*
- O4. **NDS 3.4.3.1(b)** permits reducing concentrated loads within d of a support by x/d. This is not applied, which is conservative. Decision: add it as an option? *(S1: fixed. The item was mis-described: point loads within d were left out of V altogether (unconservative). Now included at full value (default) or times x/d (new option); see S1-a.)*
- O5. **Table 3.3.3 concentrated-load rows** (e.g. a central point load: 1.80lu / 1.37lu + 3d) are not used. With point loads, the footnote-1 general rule is used, which is conservative. *(S1: closed, no change; conservative and documented.)*
- O6. **le for uniform load at lu/d > 14.3.** The reviewer said 1.84lu; the tool uses 1.63lu + 3d (the uniform-load row). Please confirm against NDS 2018 Table 3.3.3. If 1.84lu is wanted for uniform load as well, change the `else if (hasPL && luD > 14.3)` condition to `else if (luD > 14.3)`. *(S1: closed, no change. The tool already follows Table 3.3.3: 1.63lu + 3d is the uniform-load row for all lu/d ≥ 7; 1.84lu is footnote 1, used for other loading. Printed-table check with R1-f; see S1-b.)*
- O7. **Deflection:**
  - Kcr is applied to D only. There is no "sustained live load" input.
  - The total check uses Kcr·ΔD + ΔLL against L/240. This is more conservative than the IBC D + L check without creep, and it is the existing behaviour.
  - Wind is excluded from deflection.
  - The transient case set {L, Lr, S, 0.75L + 0.75(Lr or S)} is my interpretation of "include S/Lr in the live portion appropriately". Please confirm. *(S1: still open; needs the engineer. See S1, Needs engineer 1.)*
- O8. **Notch model.** One end-notch depth applies at both ends, on the tension face at the supports. Interior notches (≤ d/6 in the outer thirds; none in the middle third, NDS 4.4.3) and compression-side notches (NDS 3.4.3.2(c)) are not modelled. *(S1: closed as a documented limitation; stated at the notch input and in Method & Manual; see S1-d.)*
- O9. **Uplift (0.6D + 0.6W with W negative).** The tool flags the net uplift and reminds the user about bottom-edge bracing. CL is still based on the single lateral-support setting, and bearing ignores negative reactions. Decision: add a separate bottom-edge unbraced length? *(R1: bottom-edge lateral support input added; files from the earlier version open with "same as top edge"; see R1-a.)* *(R2: old files now open with the bottom edge "at supports only".)*
- O10. **Span slider** is limited to 4–40 ft (unchanged UI). *(R1: resolved, spans are typed.)*
- O11. **Stud grade 8 in. and wider** (Table 4A directs No.3 values) is not built in; the tool asks for Manual values. *(S1: still open; values needed, with P2-3. See S1, Needs engineer 3.)*
- O12. **SP 4-in.-thick, 8 in. and wider:** Table 4B permits CF = 1.1 on Fb. It is not applied (conservative). *(S1: closed with the conservative default, not applied; a note is shown when the case arises; see S1-c.)*
- O13. **ASCE 7 edition:** 7-16 assumed. ASCE 7-22 Sec. 2.4.1 is believed to have the same forms for these load types. Confirm the governing edition. *(S1: still open; cross-tool decision X-C8. See S1, Needs engineer 2.)*
- O14. **Ci is applied to timbers if ticked.** NDS 4.3.8 is written for dimension lumber. Minor; confirm. *(S1: closed with the conservative default, kept; a note is shown; see S1-c.)*
- O15. **Not in scope:** no print button (C4 in the audit); `projectInfo.notes` has no input; the app title differs from the file name. *(R1: resolved: Print report, a Notes input, title "Timber Beam Check".)*
- P2-1. **Round-off negative moment (observation, not changed).** The bottom-edge slenderness failure ("Bottom edge (negative moment): slenderness RB = … exceeds 50") is raised when any combination has `c.bend[i].Mn > 0`. A moment of about 1e-12 ft-lb from floating-point round-off at an end support counts, so a member with no real negative moment can be flagged NG when its bottom-edge R<sub>B</sub> exceeds 50 (1 of 20,417 parity cases: 29.7 ft span, five point loads). The advisory beside it already uses a 1e-9 tolerance. Proposed fix: `c.bend[i].Mn > 1e-9` in the anchor `if (s.bot.RB > 50 && combos.some(c => c.bend[i].Mn > 0))`. Decision? *(R4: closed. Engineer's decision 2026-10-10: region moments with |M| ≤ max(1e-6 ft-lb, 1e-9 × M<sub>max</sub>) are zero; the false NG is gone.)*
- P2-2. **6x8 and 8x8 dressed sizes.** The size list (unchanged since the original tool) has 6x8 = 5.5 × 7.25 in. and 8x8 = 7.25 × 7.25 in.; NDS Supplement Table 1B gives 5.5 × 7.5 and 7.5 × 7.5 in. for timbers. The smaller section is conservative. Not changed (it changes results of existing files). Decision: correct them? *(R4: closed. Corrected to 5.5 × 7.5 and 7.5 × 7.5 in.; results of files with these sizes change.)*
- P2-3. **Not built in:** Southern Pine Stud (Table 4B), Spruce-Pine-Fir timbers (Table 4D), Dense / Non-Dense grades, glulam combinations other than the seven listed. These still ask for Manual / custom values. Supply the values if wanted. *(R5: still open; cannot be closed by code. Verify against the printed NDS 2018 Supplement and supply the values to build in.)* *(S1: still open; see S1, Needs engineer 3.)*
- P2-4. **Southern Pine Table 4D and wet service.** The SP timber F<sub>c⊥</sub> = 375 psi (≈ 0.67 × 565) suggests the SP timber values may already be for wet service; the tool still applies C<sub>M</sub> = 0.67 to F<sub>c⊥</sub> when Wet is ticked (conservative if so). Confirm the Table 4D footnote. *(R5: closed. Engineer's decision 2026-10-10: keep applying C<sub>M</sub> to SP timber F<sub>c⊥</sub> when wet (conservative). No change.)*
- P2-5. **Table 4D flat use.** Beams and Stringers loaded on the wide face: F<sub>b</sub> × 0.86 (SS), 0.74 (No.1), 1.00 (No.2) as recalled; Posts and Timbers 1.00; Southern Pine timbers take the B&S factors (conservative). Confirm. *(R5: closed. Engineer's decision 2026-10-10: keep the flat-use factors as built; the values stay marked "verify" on the Reference Values tab. No change.)*
- P2-6. **Glulam:** (a) F<sub>vx</sub> of the stress classes when made of Southern Pine (a Table 5A footnote may allow 300 psi; the tool uses the tabulated 210 / 265, conservative); (b) no balanced-layup option for the stress classes (F<sub>bx</sub><sup>−</sup> = F<sub>bx</sub><sup>+</sup>; use Custom values); (c) flat use (y–y) not supported; (d) notch rules (NDS 5.4.4.1 lesser of d/10 and 3 in.; C<sub>vr</sub> = 0.72, NDS 5.3.10) as recalled; (e) C<sub>V</sub> length L taken between the points of zero moment of each combination around the governing moment (for a cantilever: from the tip to the inflection point in the back span, or the support); (f) density 35 / 36 pcf (tool values). Confirm. *(R5: closed. Engineer's decision 2026-10-10: keep (a)–(f) as built (conservative choices). No change.)*
- P2-7. **SCL repetitive member factor.** NDS 2018 may permit C<sub>r</sub> = 1.04 for SCL in repetitive use (8.3.7, as recalled); not applied (1.0, conservative). Decision? *(R4: closed. C<sub>r</sub> = 1.04 applied to SCL F<sub>b</sub> with Repetitive member ticked and s ≤ 24 in. (NDS 8.3.7, verify).)*
- P2-8. **LRFD time effect factor.** The brief listed λ 0.7 / 0.8 / 1.0 for L from storage / occupancy / impact; NDS Table N3 (as recalled) gives 1.25 for impact. The tool offers occupancy (0.8, default) and storage (0.7) only; impact is not offered (ASD has no impact C<sub>D</sub> either). Confirm. The ASCE 7-16 Sec. 2.3.1 exception (0.5L in combinations 3 and 4) is not used (conservative). *(R5: closed. Engineer's decision 2026-10-10: keep the LRFD λ options as built (impact not offered; the 0.5L exception not used). No change.)*
- P2-9. **Glulam bearing face.** Bearing uses the tension-face F<sub>c⊥x</sub> at every support (the bottom face sits on the supports). The seven built-in combinations have equal values for both faces; matters only for custom data. Confirm. *(R5: closed. Engineer's decision 2026-10-10: keep the tension-face F<sub>c⊥x</sub> for bearing. No change.)*
- P2-10. **Top-edge R<sub>B</sub> > 50 regardless of moment (observation, not changed).** The top-edge failure "Slenderness RB = … exceeds 50" (anchor `if (stabilityApplies && s.top.RB > 50) fails.push(`) is raised for every span when the top edge is braced at supports only, even when the span has no positive moment (e.g. a fixed-free cantilever under gravity load: the top edge is in tension). The bottom-edge check is raised only where negative moment occurs. This is the pre-R1 behaviour (conservative) and not a round-off case, so it was not changed in R4. Decision: raise the top-edge failure only where positive moment occurs (`combos.some(c => c.bend[i].Mp > 0)`)? *(R5: closed. Engineer's decision 2026-10-10: changed. The top-edge failure stands only for spans with positive moment in some combination (same round-off tolerance as P2-1), or, with "same as top edge", negative moment; see R5.)*

## How verified (all fixes)
- **Before values:** the original engine (lines 67-88 and 361-482 of the original file) was extracted verbatim into node and run on 8 cases.
- **After values:** `runTimberCheck` and the tables were extracted verbatim from the edited file into node and run on 20 cases. The deflection superposition was checked against three closed-form solutions.
- **Build:** the `text/babel` block transpiles with @babel/standalone 7.23.5 (preset react, module).
- **Render:** the transpiled app was rendered with React 18.2.0 `react-dom/server` in 6 state variants (analysis tab, report tab, check case, notch + point load + unbraced, timber error, manual mode). There were no React errors, and no NaN, undefined or Infinity in the output.
- **Load harness:** `loadProject` was extracted verbatim and run with stub setters on a legacy file, a malformed file and a wrong-types file.

## 2026-10-18 — PR: claude/timber-d11-report (PR #285: https://github.com/mlococo88/All-Structural/pull/285)

The tool file uses CRLF line endings; keep them. Line numbers drift; search for the anchor text.

### D11: calculation-sheet report (Tier 1, display only)
- **Engineer request:** AUDIT.md D11 (2026-10-14 / 2026-10-18). Format copied from Base Plate & Anchor Designer (`/* D11 (2026-10-18)`) and Gusset Plate Rating.
- **What changes for the user:** the output of **Print report** (the button and its dialog are unchanged; the section ticks still apply). Ctrl+P without the button is unchanged (see Open items).
- **Where:** `PRINT_CSS` (anchor `/* D11 calculation sheet: cover, references, contents`) and the block from `/* D11 (2026-10-18): calculation-sheet report` down to the end of `buildPrintReport()` (just above `START-UP`): new `tbcPageCSS`, `tbcApplyPageCSS`, `tbcRefs`, `tbcResultRows`, `tbcResultBlock`; `buildPrintReport()` rewritten. To re-apply by hand, copy that block and the CSS lines.
- **Before:** the report already reused the tabs' own builders (`BUILDERS()[id](holder)`), so the worked equations were the tool's own. It had a title box (Project, Job #, Member, Client, Designer, Checked by, Date, and a second "Member" that was the section), the governing banner, then one page per tab with a running header line (`.prRunHdr`), the cards numbered 1, 2, … per tab, no references, no contents, no result lines, `@page{margin:0.6in 0.55in}` with no page numbers.
- **After:**
  - Cover: title, project, member / mark, codes; title block Project / Project No. (`job`) / Calculated by (`designer`) / Date (`date`, else today, as before) / Checked by (`checker`) / Checked date ("—": no such field; **none added**) / Member / mark / Client / Section / Design method; governing banner; notes.
  - References (`tbcRefs`): only what the tool cites: NDS 2018 articles (Ch. 4, 5 or 8 by material; App. N with LRFD), NDS Supplement 2018 tables, ASCE 7-16 Sec. 2.4.1 or 2.3.1, IBC 2018 Table 1604.3 (the edition the Reference Values tab states), the manufacturer (SCL), and AISC Manual Table 3-23 "edition: verify" only when Validation is printed.
  - Numbered contents with links; sections n = the ticked tabs, subsections n.k = the tab's cards (`.secTitle` "k. Title" → "n.k Title", id `tbr-n-k`).
  - Result lines (`tbcResultRows`, the same governing ratios as the Summary table): "Bending (combo): D/C = x.xxx (NDS 2018 3.3, Table 4.3.1; §5.3) PASS/FAIL", likewise Shear (or Shear at notched end), Bearing at support X, Deflection live/snow and total; at the end of each check section, and all of them in §1 plus "Code limits" (`R.fails`: R_B ≤ 50, notch depth) and "Member" (utilization, `isNG()`). Status = `stCls(ratio)`, as on screen. D/C is printed to 3 decimals, as everywhere in the tool.
  - Print header / footer (`tbcPageCSS`, a `<style id="tbc-page">` that exists only while the report exists; removed in `cleanup`): top "Project No / Description" (member / mark, else project), "Computed By / Checked By", "Date / Date" (checked date "—"); bottom "<project> (Timber Beam Check)" and "Page X of Y". `PRINT_CSS` `@page` is now letter, `0.95in 0.6in 0.7in 0.6in`.
  - Key code (before → after), in `buildPrintReport`:
    - `const sec = el('div', 'prSec' + (first ? ' first' : '')); … sec.appendChild(el('div', 'prRunHdr', …)); sec.appendChild(el('h1', null, esc(names[id])));`
    - → `const sec = el('section', 'cr-sec' + (n > 1 ? ' cr-break' : '')); const h = el('h1', 'cr-h1', n + '. ' + esc(names[id])); h.id = sid;` then `holder.querySelectorAll('.sec').forEach((s, k) => { … t.innerHTML = num + ' ' + t.innerHTML.replace(/^\s*\d+\.\s*/, ''); s.id = id2; if (card) cardMap[card] = { num, id: id2 }; … })`.
- **Fixed along the way (report display only):**
  - Title box: the section (`memberTxt()`) was labelled "Member" a second time; now "Section".
  - In print the narrow-screen rule `@media (max-width:820px)` matched the page width, so the "where" source column (`td.wsrc`) lost its padding and ran into the value ("2452 ft-lbAnalysis Results tab"). `PRINT_CSS` now restores it: `.eqbW td.wsrc{display:table-cell;width:34%;padding-left:12px}`.
- **Provision:** none. No formula, factor, unit, code reference or result changed.
- **Saved data:** none. No key or format change (`tbc_autosave_v1`, `tbc_projects_v1`, `tbc_inputTab_v1`, `M.ui.print` untouched).
- **Check case (default project, 2x10 DF-L No.2 @ 16 in., 16 ft, D 15 / L 40 psf):** 18 letter pages (was 16): cover, references + contents, §1 Summary (1.1–1.2), §2 Schematic & Inputs (2.1–2.4), §3 Analysis Results (3.1–3.3), §4 Design Values (4.1–4.5), §5 Bending (5.1–5.5), §6 Shear (6.1–6.3), §7 Bearing (7.1–7.2), §8 Deflection (8.1–8.3). Result lines: Bending (D + L) 1.208 FAIL (§5.3); Shear 0.333 PASS (§6.2); Bearing at support A 0.187 PASS (§7.1); Deflection live/snow (L) 0.932 PASS, total (Kcr·D + L) 1.028 FAIL (§8.2); Code limits none violated PASS; Member 120.8 % FAIL. Same values as the Summary tab.

### D11 links: quoted values link to the card where they are worked (CLAUDE.md §6) (Tier 1, display only)
- **Helpers** after `srcTag()` (anchor `/* ---- D11 links (CLAUDE.md §6, 2026-10-18)`): `TBC_CARDS` (card id = the `mkSec` id → tab, title), `tbcTabName`, `tbcCardTxt`, `tbcLink(card, txt, pre)`, `tbcWorkedIn(items)`, `tbcGoto(card)` and one document click handler for `a.wkA` (opens the tab as the tab button does, expands the card if collapsed, scrolls it under the tab bar, flashes it). CSS after `#printReport{display:none}` (anchor `/* D11 links (CLAUDE.md §6`).
- **New line:** Summary, "Governing results", under the hint: `body.appendChild(tbcWorkedIn([['bCap', 'Bending'], [nt ? 'sNotch' : 'sCap', 'Shear'], ['brCalc', 'Bearing'], ['dfCheck', 'Deflection']]));` → "Worked in: → Bending · Adjusted bending design value and check; → Shear · …; → Bearing · …; → Deflection · Deflection checks".
- **Existing text made into links (text unchanged on screen):** the "where" sources `'Design Values tab'` / `'Analysis Results tab'` become `tbcLink('<card>', 'Design Values tab')` etc.:
  - Bending "Moment and bending stress": M → `anaPeaks`, S → `dvSect`; `clBlock` E′min → `dvAdj`; `cvBlock` (glulam) x₁, x₂ → `anaDiag`;
  - Shear "Design shear V": V → `anaPeaks` (not when a point load within d sets V); notch R → `anaReac`; Bearing R → `anaReac`;
  - Deflection "Bending stiffness": E′ → `dvAdj`, I → `dvSect`;
  - Design Values factor table (`factorRows`): C_L "see the Bending tab" → `bCL`; glulam C_V "(see the Bending tab)" → `bCV`.
- **In the report** each link reads "see §n.k" (with a label where given: "Bending: see §5.3", "CL: see §5.2"); a target left out of the printout reads "see the <Tab> tab (<card>; not in this printout)".
- **Check case (default):** "Worked in: Bending: see §5.3; Shear: see §6.2; Bearing: see §7.1; Deflection: see §8.2"; M "see §3.3", S "see §4.1", E′ "see §4.5", I "see §4.1", R "see §3.2", C_L "CL: see §5.2".

### How verified (both entries)
- `node tests/check-syntax.mjs "Timber Beam Check.html"`: all 4 scripts pass. No other tests exist for this tool.
- `node tests/compare.mjs --tool page --file "Timber Beam Check.html"`: page.storage same; page.text differs only by the new "Worked in" line (KaTeX is not in the kit; same 3 blocked requests on both sides).
- **Main vs branch, headless Chromium, KaTeX 0.16.11 and plotly-basic 2.35.2 served locally (npm pack), 6 cases** (default; glulam 24F-1.8E two spans 22 + 18 ft with notch and snow; LRFD 2x12 No.1 with a 3 ft cantilever, point loads, uplift wind, notch and x/d; LVL fixed-free cantilever; 2x8 wet 19 ft NG; an input error): `TBC.res`, a fresh `TBC.run(model)`, the governing strip and the saved model identical in every case; every tab's text identical except the Summary "Worked in" line; building the report leaves `TBC.res` unchanged. 0 console errors or warnings.
- **Report PDF** (print media, `preferCSSPageSize`): pages 18 / 20 / 20 / 19 / 19 / 4 for the six cases, 35 with every section ticked; every internal link resolves (56 in the default case), 0 KaTeX errors, no raw TeX, 3 diagram images. Pages looked at: cover, references and contents, Summary with result lines, Bending, LRFD bending combinations, the input-error report. With Bending unticked, the links to it read "not in this printout".
- **In the app:** every link of three cases (38 clicks) opens the right tab with the target card expanded, scrolled into view and flashed; a collapsed target card is opened. Print with `window.print` stubbed: the header/footer style is present while printing and removed with the report after `afterprint`.
- **Other copies:** none (tool-specific).

### Open items (noticed, not changed)
- **Ctrl+P without Print report prints a blank page.** `PRINT_CSS` hides `#app` in print whether or not a report exists (unchanged since R1). Decision: leave it (use Print report), or print the screen when no report exists?
- **Checked date:** the tool has no such field; the title block and the print header show "—". Add an optional tool-only field (absent until typed, so saved files are unchanged)? Recommendation: add only if wanted.
- **Report length:** 18 pages for the default project (was 16), mostly the cover and contents page. Section ticks are unchanged.


## 2026-11-01 — PR: claude/rpt-timber — Report output tab in the shared report viewer (TBRP; display only, no calculation change) (PR #532: https://github.com/mlococo88/All-Structural/pull/532)

Line numbers are approximate; search for the anchor text. Every code site is tagged `TBRP`.

### TBRP. "Report" output tab (shared/report.js, shared/steps.js)   [display only]
- **Engineer request (2026-11-01, report rollout plan):** a Report output tab in the shared viewer used by the Steel Bridge app and Spread Footing: navigation tree, numbered sections, worked steps (equation → substituted values → result, CLAUDE.md §6) grouped by topic (`SharedSteps.group`), "see §x.y" links, links back to the tool's tabs, print with a title block (no owner / client cell), running header and page numbers.
- **Coordinator decisions recorded:** (1) the D11 "Print report" (header button, `openPrintDialog` / `buildPrintReport`) is kept unchanged and the Report tab is added alongside; (2) the steps' values are the tool's own computed numbers, read from `R` (never recomputed); only the substitution strings are formatted, with the tabs' own helpers (`f0`…`g4`, `fbFacs`, `fbStarFacs`, `fvFacs`, `fcpFacs`, `eFacs`, `fbBase`); (3) missing title-block fields: the tool has no "Checked date" input, so it shows "—" (no new saved field).
- **Loads:** `<script src="shared/steps.js">` and `<script src="shared/report.js">` (classic scripts, relative path) after the CDN libraries. The tool now needs the `shared` folder next to it (it is in the repository). Without it only the Report tab shows an error; every other tab is unaffected. KaTeX 0.16.11 (already loaded by the tool) renders the steps; offline, the shared built-in renderer.
- **Code:**
  - `OUT_TABS` (anchor `['man', 'Method & Manual']`): `['rpt', 'Report']` appended. `BUILDERS`: `rpt: buildReport`.
  - New block before `START-UP` (anchor `REPORT tab (TBRP, 2026-11-01)`): `tbrModel()` builds the report model; `tbrTopics()` (topics with `SharedSteps.group`), `tbrRich()` (subscript notation in tables / notes), `buildReport(pg)` mounts the viewer (`SharedReport.mount`, sticky under the tab bar), `tbrGoto()` handles the `[[tab:…]]` links (opens the tab as its tab button does), and a `beforeprint` listener.
- **Sections (topics in brackets):** 1 Summary of results (member, controlling limit state, a check table whose ratios link to their steps); 2 Project and inputs (project, geometry and supports with the schematic SVG, loads, section / material / design settings); 3 Section properties and loads [section properties A, S, I; line loads t, w_sw, w_D…w_W]; 4 Design values (reference values, adjustment factor table, [F′b, F′v, F′c⊥, E′ and E′min of the governing combinations]); 5 Analysis (every combination: TF, w, reactions, M, V, ΣF, ΣR); 6 Bending [f_b; C_L with l_u, l_u/d, l_e, R_B, F_bE, F_b*; C_V (glulam / SCL); F′b and f_b/F′b] + tables by span / sign and by combination; 7 Shear [V and f_v; F′v and f_v/F′v; notched ends d_n, C_n, f_v,n and ratio] + table; 8 Bearing [C_b; F′c⊥; f_c⊥ and ratio] + all supports; 9 Deflection [E′I; Δ_LL, L/n, ratio; Δ_T, L/n, ratio] + by span; 10 Notes and references (project notes, code-limit failures, notes / advisories, `tbcRefs`).
- **Values:** every step `value` is a value of `R`: e.g. `R.A`, `R.S`, `R.I`, `R.trib`, `R.wu[t]`, `R.gov.b.fb`, `.CL`, `.Fb_p`, `.r_b`, `R.stab[i].top/bot` (l_u, l_e, R_B, F_bE), `R.gov.v.Vd`, `.fv`, `.Fv_p`, `.r_v1`, `.fvn`, `.r_vn`, `R.Cn`, `R.dn`, `R.Cbs[j]`, `R.gov.c.Fcp_p`, `.fcp`, `.r_c`, `R.defl.Dtr`, `.LLlim`, `.r_dLL`, `.Dtot`, `.TLlim`, `.r_dTL`. Display-only numbers computed the same way as on the tabs: the F_bE/F_b* ratio in the C_L substitution (as `clBlock`), the glulam / SCL C_V product before its limit (as `cvBlock`), E′·I (as the Deflection tab).
- **Print:** the viewer's "Print report" prints the report alone (title block Project / Project No. / Calculated by / Date / Checked by / Checked date "—", cover, contents, running header "Project No. … — member" / "Computed … · Checked …", footer, "Page X of Y"). Ctrl+P while the Report tab is shown prints the report too (`PRINT_CSS` hides `#app` in print, so the report goes into `#rp-print`). From every other tab Ctrl+P and the header "Print report" button behave as before.
- **Saved data:** no key or format change. The open tab is the existing `M.ui.outTab` (it may now be `'rpt'`; an older copy of the tool falls back to Summary through `curTab()`). Collapsed report sections are kept in memory only (`TBRP.closed`).
- **Shared file:** `shared/report.js` one-word CSS fix for narrow screens (`fixlog/shared-report.md`), backward compatible; `node tests/engine/run.mjs report steps steps-groups report-wiring`: 14 passed.
- **How verified (headless Chromium, KaTeX 0.16.11 and plotly-basic 2.35.2 served locally):**
  - 6 projects (default 2x10 DF-L; glulam 24F-1.8E two spans with notch and snow; LRFD 2x12 with cantilever, point loads, notch, x/d; SCL fixed-free with bottom-edge bracing; long wet 2x8 (NG); input error). Reports of 34 to 46 steps in 17 to 19 topics; 0 unresolved or duplicate references, 0 KaTeX errors, no raw TeX, no NaN / undefined in `SharedReport.text()` or on screen.
  - 29 to 32 step values per project equal the app's values exactly (list above); the summary table's five ratios equal `R.gov.b.r_b`, `R.gov.v.r_v`, `R.gov.c.r_c`, `R.defl.r_dLL`, `R.defl.r_dTL`. `R` is unchanged by building the report. 0 console errors. The input-error project shows the input-error panel.
  - origin/main vs the branch, the 6 projects: the text of the 11 other tabs, the governing strip, the input panel and the saved model are identical (14 texts each).
  - Ctrl+P on the Report tab gives `body.rp-printing`, the report alone and the @page running header (PDF 16 pages, glulam project); Ctrl+P on another tab does not print the report; a `[[tab:bend]]` link opens the Bending tab.
  - `node tests/check-syntax.mjs "Timber Beam Check.html"` passes.
- **Check case (glulam two spans 22 + 18 ft, 5.125 × 18 in. 24F-1.8E @ 96 in., D 15 / S 30 psf):** §1.1 Bending 0.786 (see §6.1), shear at notched end 0.428, bearing 0.608, deflection 0.336 / 0.338 — the same as the Summary tab.
- **Other copies:** none. `shared/README.md` lists Timber Beam Check.html as a user of `steps.js` and `report.js`.

Diff (`Timber Beam Check.html`, `git diff -U0` against origin/main):

```diff
diff --git a/Timber Beam Check.html b/Timber Beam Check.html
index 2f29ed5..c3246e1 100644
--- a/Timber Beam Check.html	
+++ b/Timber Beam Check.html	
@@ -9,0 +10,3 @@
+<!-- TBRP: shared worked steps and the shared report viewer (classic scripts, relative path: keep the shared folder next to this file) -->
+<script src="shared/steps.js"></script>
+<script src="shared/report.js"></script>
@@ -1939 +1942 @@ const OUT_TABS = [['sum', 'Summary'], ['sch', 'Schematic & Inputs'], ['ana', 'An
-  ['refv', 'Reference Values'], ['val', 'Validation'], ['man', 'Method & Manual']];
+  ['refv', 'Reference Values'], ['val', 'Validation'], ['man', 'Method & Manual'], ['rpt', 'Report']];   // rpt: TBRP
@@ -1955 +1958 @@ function buildTabBar() {
-const BUILDERS = () => ({ sum: buildSummary, sch: buildSchem, ana: buildAnalysis, dv: buildDV, bend: buildBend, shear: buildShear, bear: buildBear, defl: buildDefl, refv: buildRefv, val: buildValid, man: buildManual });
+const BUILDERS = () => ({ sum: buildSummary, sch: buildSchem, ana: buildAnalysis, dv: buildDV, bend: buildBend, shear: buildShear, bear: buildBear, defl: buildDefl, refv: buildRefv, val: buildValid, man: buildManual, rpt: buildReport });   /* rpt: TBRP */
@@ -3061,0 +3065,274 @@ async function buildPrintReport(opts) {
+/* =====================================================================
+   REPORT tab (TBRP, 2026-11-01): the calculation report in the shared viewer (shared/report.js: navigation tree,
+   numbered sections §n.m, collapse / expand, search, Print with a title block, running header and page numbers).
+   Worked steps are shared/steps.js steps (equation → substituted values → result), grouped by topic with
+   SharedSteps.group as in Spread Footing and the Steel Bridge app. Every value is a value the tool has already
+   computed (R, its combinations R.combos and governing cases R.gov, R.defl); only the substitution strings are
+   formatted here, with the tabs' own helpers (f0 … g4, fbFacs, fvFacs, fcpFacs, eFacs). Nothing is saved: the
+   report is rebuilt from R whenever the tab is shown or the inputs change while it is shown. The D11 "Print report"
+   button (header) is unchanged.
+   ===================================================================== */
+const TBRP = { closed: new Set(), api: null, doc: null };
+const tbrPlain = s => String(s == null ? '' : s).replace(/<sub>(.*?)<\/sub>/g, '_$1').replace(/<sup>(.*?)<\/sup>/g, '^$1').replace(/<br\s*\/?>/g, '; ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s*verify\s*$/, '').replace(/\s+/g, ' ').trim();
+const tbrTx = s => String(s == null ? '' : s).replace(/[\\{}$&#%_^~]/g, '');   // text placed inside \text{}
+const tbrCell = (v, d, cls) => ({ t: (typeof v === 'number') ? (isFinite(v) ? f(v, d == null ? 2 : d) : '—') : String(v == null || v === '' ? '—' : v), n: typeof v === 'number', cls });
+const tbrDC = (v, key) => ({ t: (typeof v === 'number' && isFinite(v)) ? f3(v) : '—', n: true, cls: (typeof v === 'number' && isFinite(v)) ? (v > 1 + 1e-12 ? 'ng' : (v >= 0.9 ? 'hi' : 'ok')) : 'na', key });
+const TB_NDS = 'NDS 2018 ';
+/* a steps item whose steps are grouped in topics (one topic per list entry, in order; SharedSteps.group sets each topic's status and result line) */
+function tbrTopics(list, opt) {
+  const L = list.filter(t => t.steps && t.steps.length);
+  const steps = [].concat(...L.map(t => t.steps));
+  const topics = L.map(t => { const g = SharedSteps.group(t.steps, [{ key: 'k', title: t.title, ref: t.ref, ids: () => true, res: t.res }], { strip: false })[0];
+    return { title: t.title, ref: t.ref || '', n: t.steps.length, cls: g.cls, chip: g.chip, res: g.res }; });
+  return Object.assign({ type: 'steps', scope: 'tb', steps, topics }, opt || {});
+}
+const tbrClean = s => String(s == null ? '' : s).replace(/_/g, '').replace(/\^/g, '');   // step labels and notes are plain text: 'F′_b' -> 'F′b'
+const tbrS = o => SharedSteps.step(Object.assign({}, o, { label: tbrClean(o.label), note: tbrClean(o.note) }));
+/* table cells, notes and sub-headings are the viewer's rich text: 'F′_b', 'f_v,n', 'F_bx^+' become $…$ notation (subscripts) */
+const tbrNot = s => String(s == null ? '' : s).replace(/([A-Za-zΔφλ]′?)_([A-Za-z0-9⊥]+(?:,[A-Za-z0-9]+)?)(\^[+−])?/g, (m, a, b, c) => '$' + a + '_{' + b + '}' + (c ? '^{' + c.slice(1) + '}' : '') + '$');
+function tbrRich(model) {
+  const cell = c => (c && typeof c === 'object') ? Object.assign({}, c, { t: tbrNot(c.t) }) : tbrNot(c);
+  model.sections.forEach(sec => { sec.title = tbrClean(sec.title); (sec.subs || []).forEach(q => { q.title = tbrNot(q.title); (q.items || []).forEach(it => {
+    if (it.type === 'note') it.text = tbrNot(it.text);
+    else if (it.type === 'figure') it.caption = tbrNot(it.caption);
+    else if (it.type === 'kv') it.rows = it.rows.map(r => [tbrNot(r[0]), tbrNot(r[1])].concat(r.slice(2)));
+    else if (it.type === 'table') { it.head = (it.head || []).map(cell); it.rows = (it.rows || []).map(r => Array.isArray(r) ? r.map(cell) : Object.assign({}, r, { cells: r.cells.map(cell) })); }
+    else if (it.type === 'steps' && it.topics) it.topics.forEach(t => { t.title = tbrClean(t.title); t.ref = tbrClean(t.ref); });
+  }); }); });
+  return model;
+}
+/* the product F = base · factors as eq / sub strings (the same symbols and values as facEq on the tabs) */
+const tbrFac = (base, facs) => ({ eq: base[0] + '\\,' + facs.map(x => x[0]).join('\\,'), sub: base[1] + ' \\times ' + facs.map(x => x[1]).join(' \\times ') });
+const tbrTbl = () => 'NDS 2018 Table ' + (R.isGL ? '5.3.1' : R.isSCL ? '8.3.1' : '4.3.1') + (isLRFD() ? ', App. N' : '');
+
+function tbrModel() {
+  const p = M.project || {}, mt = M.material, dz = M.design, secs = [], today = new Date().toISOString().slice(0, 10);
+  const gb = R.gov.b, gv = R.gov.v, gc = R.gov.c, d = R.defl, nt = shearIsNotch(gv), r = R.ref;
+  const bSign = R.legacyBend ? (gb.bend[0].Mp >= gb.bend[0].Mn ? 1 : -1) : gb.gbSign, bSpan = gb.gbSpan;
+  /* ---------- 1. Summary ---------- */
+  {
+    const rows = [
+      ['Bending', gb.name + ' (' + tfP(gb) + ')', bendLoc(gb), 'f_b = ' + f0(gb.fb) + ' psi', 'F′_b = ' + f0(gb.Fb_p) + ' psi', tbrDC(gb.r_b, 'tb/bd.r'), TB_NDS + '3.3'],
+      [nt ? 'Shear at notched end' : 'Shear', gv.name + ' (' + tfP(gv) + ')', nt ? 'end support reaction' : 'x = ' + f2(gv.xV) + ' ft', nt ? 'f_v,n = ' + f1(gv.fvn) + ' psi' : 'f_v = ' + f1(gv.fv) + ' psi', nt ? 'F′_v C_n' + (R.isGL ? ' C_vr' : '') + ' = ' + f1(gv.Fv_p * R.Cn * R.Cvr) + ' psi' : 'F′_v = ' + f1(gv.Fv_p) + ' psi', tbrDC(gv.r_v, nt ? 'tb/sh.rn' : 'tb/sh.r'), TB_NDS + (nt ? '3.4.3.2' : '3.4.2, 3.4.3.1')],
+      ['Bearing', gc.name, 'support ' + nodeN(gc.gcJ), 'f_c⊥ = ' + f0(gc.fcp) + ' psi', 'F′_c⊥ = ' + f0(gc.Fcp_p) + ' psi', tbrDC(gc.r_c, 'tb/br.r'), TB_NDS + '3.10'],
+      ['Deflection, live/snow', d.trName, R.nS > 1 ? spanLab(d.spanLL) : 'span', 'Δ = ' + f3(d.Dtr) + ' in.', 'L/' + g4(d.LLdiv) + ' = ' + f3(d.LLlim) + ' in.', tbrDC(d.r_dLL, 'tb/df.rLL'), 'IBC 2018 Table 1604.3'],
+      ['Deflection, total', 'K_cr·D + ' + d.totName, R.nS > 1 ? spanLab(d.spanTL) : 'span', 'Δ = ' + f3(d.Dtot) + ' in.', 'L/' + g4(d.TLdiv) + ' = ' + f3(d.TLlim) + ' in.', tbrDC(d.r_dTL, 'tb/df.rTL'), TB_NDS + '3.5.2; IBC 2018 Table 1604.3']];
+    const items = [{ type: 'kv', rows: [['Member', memberTxt()], ['Design method', 'NDS 2018 ' + methTxt() + (isLRFD() ? ' (Appendix N)' : '')],
+      ['Controlling limit state', (R.fails.length ? 'Code limit violated (NG)' : R.ctrlName) + ' — ' + pct(R.dcrMax) + ' (' + ctrlDetail() + ')'], ['Result', isNG() ? 'DOES NOT PASS' : 'All checks pass']] },
+      { type: 'table', head: ['Check', 'Governing combination', 'Location', 'Demand', 'Capacity / limit', 'Ratio', 'Reference'], rows: rows.map(x => ({ cells: x, cls: x[5].t === f3(R.dcrMax) ? 'gov' : '' })) },
+      { type: 'note', text: 'Ratio = demand / capacity; ≤ 1.000 passes. Each ratio links to the step where it is worked. ' + (isLRFD() ? 'LRFD: stresses from factored loads; adjusted values include K_F, φ and λ (NDS 2018 Appendix N). Deflection at service loads.' : 'Stresses are ASD (unfactored loads).') + ' The same values are on the Summary tab[[tab:sum| ↗]].' }];
+    if (R.fails.length) items.push({ type: 'note', warn: true, text: 'Code limit violated (NG): ' + R.fails.join(' ') });
+    secs.push({ title: 'Summary of results', subs: [{ title: 'Governing results', items }] });
+  }
+  /* ---------- 2. Project and inputs ---------- */
+  {
+    const subs = [], xN = nodeXs();
+    subs.push({ title: 'Project', items: [{ type: 'kv', rows: [['Project', p.name || '—'], ['Member / mark', p.member || '—'], ['Job #', p.job || '—'], ['Designer', (p.designer || '—') + (p.date ? ', ' + p.date : '')], ['Checked by', p.checker || '—'],
+      ['Codes', 'NDS 2018 (' + methTxt() + '), NDS Supplement 2018, ASCE 7-16 ' + (isLRFD() ? 'Sec. 2.3.1' : 'Sec. 2.4.1') + ', IBC 2018 Table 1604.3']] },
+      { type: 'note', text: 'Units: lb, ft, in., psi unless noted. Every value in this report is the value the tool computes on its result tabs (Design Values[[tab:dv| ↗]], Analysis Results[[tab:ana| ↗]], Bending[[tab:bend| ↗]], Shear[[tab:shear| ↗]], Bearing[[tab:bear| ↗]], Deflection[[tab:defl| ↗]]).' }] });
+    const sch = schematicSVG(), svg = (sch.querySelector && sch.querySelector('svg')) ? sch.querySelector('svg').outerHTML : '';
+    const gItems = [{ type: 'table', head: ['Span', 'From – to', 'Length (ft)', 'Type'], rows: M.geom.spans.map((s, i) => [String(i + 1), nodeN(i) + ' – ' + nodeN(i + 1), tbrCell(R.Ls[i], 2), (R.types[i] === 'free' || R.types[i + 1] === 'free') ? 'cantilever' : 'between supports']) },
+      { type: 'table', head: ['Support', 'x (ft)', 'Type', 'Bearing l_b (in.)', 'C_b permitted (≥ 3 in. from end)'], rows: M.geom.supports.map((s, j) => [nodeN(j), tbrCell(xN[j], 2), s.t === 'pin' ? 'pin / roller' : s.t === 'fixed' ? 'fixed' : 'free end', s.t === 'free' ? '—' : g4(s.lb), s.t === 'free' ? '—' : (s.cb ? 'yes' : 'no (end bearing)')]) },
+      { type: 'note', text: 'Member spacing s = ' + g4(M.geom.spacing) + ' in. (tributary width: [[tb/ld.t]]). Set on the Geometry input tab; the schematic is on the Schematic & Inputs tab[[tab:sch| ↗]].' }];
+    if (svg) gItems.push({ type: 'figure', svg, caption: 'Schematic (not to scale vertically; loads + down; point-load positions from the left end, node A)' });
+    subs.push({ title: 'Geometry and supports', items: gItems });
+    const lItems = [{ type: 'table', head: ['Load type', 'Area load (psf)', 'Line load w (plf)', isLRFD() ? 'C_D (ASD only; not used in LRFD)' : 'C_D (NDS 2018 Table 2.3.2)'], rows: ['D', 'L', 'Lr', 'S', 'W'].map(t => [t, g4(M.loads[t] || 0) + (t === 'D' && M.loads.selfWeight ? ' + self-weight' : ''), { t: f2(R.wu[t]), n: true, key: 'tb/ld.w' + t }, String(LOAD_CD[t])]) }];
+    if ((M.loads.points || []).length) lItems.push({ type: 'table', head: ['Point load', 'P (lb)', 'x (ft)', 'Type'], rows: M.loads.points.map((q, i) => ['P' + (i + 1), g4(q.mag), g4(q.loc), q.type || 'D']) });
+    lItems.push({ type: 'note', text: 'Point loads within d of a support (shear): ' + (dz.shearXd ? 'multiplied by x/d (NDS 2018 3.4.3.1(b)).' : 'at full value.') });
+    subs.push({ title: 'Loads', items: lItems });
+    const tyName = (TBC_MAT_TYPES.find(t => t[0] === mt.type) || [0, mt.type])[1];
+    const mrows = mt.type === 'glulam' ? [['Material type', tyName], ['Combination', mt.glulam.combo === 'Custom' ? 'custom values' : mt.glulam.combo], ['Species group', (GLULAM_GRP[glGrpOf(mt.glulam)] || {}).name || '?'], ['Section', 'b = ' + g4(R.b) + ' in., d = ' + g4(R.d) + ' in.' + (mt.glulam.customSize ? ' (custom)' : ' (' + g4(mt.glulam.nLam) + ' laminations)')]]
+      : mt.type === 'scl' ? [['Material type', tyName], ['Product', (SCL_KINDS[mt.scl.kind] || mt.scl.kind) + (mt.scl.name ? ' — ' + mt.scl.name : '')], ['Section', 'b = ' + g4(mt.scl.b) + ' in., d = ' + g4(mt.scl.d) + ' in.'], ['Size factor', 'C_V = (' + g4(mt.scl.dref) + '/d)^' + g4(mt.scl.n) + ' ≤ ' + g4(mt.scl.cvMax) + ' (manufacturer)']]
+      : [['Material type', tyName], ['Size', mt.size === 'Custom' ? 'Custom b = ' + g4(mt.customB) + ' in., d = ' + g4(mt.customD) + ' in.' : mt.size], ['Species / grade', mt.manual ? 'Manual reference values' : (mt.customMaterials || {})[mt.species] ? 'Custom species "' + mt.species + '"' : mt.species + ' (' + ((DEFAULT_SPECIES[mt.species] || {}).name || '?') + '), ' + ((GRADES_DB[mt.grade] || {}).name || mt.grade)]];
+    mrows.push(['Reference values', tbrPlain(R.src)], ['Orientation', dz.flatUse ? 'Flat (load on the wide face)' : 'Edgewise'], ['Wet service', dz.moisture === 'Wet' ? 'yes' : 'no'], ['Temperature', { Normal: 'T ≤ 100 °F', '100-125': '100–125 °F', '125-150': '125–150 °F' }[dz.temp] || dz.temp],
+      ['Incised', dz.incising ? 'yes' : 'no'], ['Repetitive member', dz.repetitive ? 'yes' : 'no'], ['End notch', (mt.notch || 0) > 0 ? g4(mt.notch) + ' in.' : 'none'],
+      ['Lateral support, top edge', dz.latTop === 'Supports' ? 'at supports only, l_u = ' + (dz.luTop > 0 ? g4(dz.luTop) + ' ft' : 'span length') : 'continuous'],
+      ['Lateral support, bottom edge', dz.latBot === 'same' ? 'same as top edge (earlier tool versions)' : dz.latBot === 'Supports' ? 'at supports only, l_u = ' + (dz.luBot > 0 ? g4(dz.luBot) + ' ft' : 'span length') : 'continuous'],
+      ['Creep factor K_cr', g4(dz.creep)], ['Deflection limits', 'L/' + g4(dz.deflLL) + ' live/snow, L/' + g4(dz.deflTL) + ' total'], ['Design method', dz.method === 'LRFD' ? 'LRFD (NDS 2018 Appendix N; floor live load from ' + (dz.lrfdLive === 'storage' ? 'storage, λ = 0.7' : 'occupancy, λ = 0.8') + ')' : 'ASD (NDS 2018)']);
+    subs.push({ title: 'Section, material and design settings', items: [{ type: 'table', head: ['Item', 'Value'], rows: mrows }] });
+    secs.push({ title: 'Project and inputs', subs });
+  }
+  /* ---------- 3. Section properties and loads ---------- */
+  {
+    const fl = R.flat, T = [];
+    T.push({ title: 'Section properties', ref: TB_NDS + '3.1.2' + (fl ? '; flat use: bending about the weak axis' : ''), res: /\.S$/, steps: [
+      tbrS({ id: 'sec.A', label: 'Gross area (b, d: ' + (R.isGL || R.isSCL || M.material.size === 'Custom' ? 'entered' : 'standard dressed size, NDS Supplement 2018 Table 1B') + ')', sym: 'A', eq: 'b\\,d', sub: g4(R.b) + ' \\times ' + g4(R.d), value: R.A, unit: 'in^{2}', d: 3, ref: TB_NDS + '3.1.2' }),
+      tbrS({ id: 'sec.S', label: 'Section modulus (bending axis; b_w = ' + (fl ? 'd' : 'b') + ', d_b = ' + (fl ? 'b' : 'd') + ')', sym: 'S', eq: '\\frac{b_{w} d_{b}^{2}}{6}', sub: '\\frac{' + g4(R.bw) + ' \\times ' + g4(R.dep) + '^{2}}{6}', value: R.S, unit: 'in^{3}', d: 3 }),
+      tbrS({ id: 'sec.I', label: 'Moment of inertia (bending axis)', sym: 'I', eq: '\\frac{b_{w} d_{b}^{3}}{12}', sub: '\\frac{' + g4(R.bw) + ' \\times ' + g4(R.dep) + '^{3}}{12}', value: R.I, unit: 'in^{4}', d: 3 })] });
+    const ls = [tbrS({ id: 'ld.t', label: 'Tributary width (member spacing s)', sym: 't', eq: '\\frac{s}{12}', sub: '\\frac{' + g4(R.spacing) + '}{12}', value: R.trib, unit: 'ft', d: 3 }),
+      tbrS({ id: 'ld.wsw', label: 'Self-weight' + (M.loads.selfWeight ? '' : ' (not included: input)'), sym: 'w_{sw}', eq: '\\frac{\\rho A}{144}', sub: M.loads.selfWeight ? '\\frac{' + g4(R.dens) + ' \\times ' + f3(R.A) + '}{144}' : '', value: R.w_self, unit: 'plf', d: 2, note: M.loads.selfWeight ? 'ρ = ' + g4(R.dens) + ' pcf (' + (R.userVals ? 'user-entered' : 'tool value for ' + (R.isGL ? 'the species group' : M.material.species)) + ').' : '' })];
+    ['D', 'L', 'Lr', 'S', 'W'].forEach(t => ls.push(tbrS({ id: 'ld.w' + t, label: 'Line load, ' + t, sym: 'w_{' + t + '}', eq: t === 'D' && M.loads.selfWeight ? 'p_{D}\\,t + w_{sw}' : 'p_{' + t + '}\\,t', sub: g4(M.loads[t] || 0) + ' \\times ' + f3(R.trib) + (t === 'D' && M.loads.selfWeight ? ' + ' + f2(R.w_self) : ''), value: R.wu[t], unit: 'plf', d: 2 })));
+    T.push({ title: 'Loads on the member', ref: 'statics', res: /\.wL$/, steps: ls });
+    secs.push({ title: 'Section properties and loads', subs: [{ title: 'Section properties and line loads', items: [tbrTopics(T)] }] });
+  }
+  /* ---------- 4. Design values ---------- */
+  {
+    const subs = [];
+    subs.push({ title: 'Reference design values', items: [
+      R.isGL ? { type: 'table', head: ['F_bx^+', 'F_bx^−', 'F_vx', 'F_c⊥x (tension face)', 'E_x', 'E_x,min'], rows: [[r.Fb, r.Fbn, r.Fv, r.Fcp, r.E, r.Emin].map(v => ({ t: g4(v), n: true }))] }
+        : { type: 'table', head: ['F_b', 'F_t', 'F_v', 'F_c⊥', 'F_c', 'E', 'E_min'], rows: [[g4(r.Fb), r.Ft ?? '—', g4(r.Fv), g4(r.Fcp), r.Fc ?? '—', g4(r.E), g4(r.Emin)].map(v => ({ t: String(v), n: true }))] },
+      { type: 'note', text: 'psi. Source: ' + tbrPlain(R.src) + (R.userVals ? '.' : ' (built-in value: verify against the printed NDS Supplement; every built-in value is listed with its table on the Reference Values tab[[tab:refv| ↗]]).') + ' F_t and F_c are listed only: this beam check has no axial load.' }] });
+    subs.push({ title: 'Adjustment factors (NDS 2018 Table ' + (R.isGL ? '5.3.1, glulam' : R.isSCL ? '8.3.1, SCL' : '4.3.1, sawn lumber') + ', ' + methTxt() + ')', items: [{ type: 'table', head: ['Factor', 'F_b', 'F_v', 'F_c⊥', 'E, E_min', 'Basis', 'Reference'], rows: factorRows().map(x => x.map(tbrPlain)) },
+      { type: 'note', text: 'C_L is worked per span and edge in §6 ([[tb/bd.CL]]); C_b per support in §8 ([[tb/br.Cb]]).' }] });
+    const sg = R.legacyBend ? 1 : gb.gbSign, T = [];
+    const fb = tbrFac(fbBase(sg), fbFacs(gb, gb.CL, gb.CV)), fv = tbrFac([R.isGL ? 'F_{vx}' : 'F_{v}', g4(r.Fv)], fvFacs(gv)), fc = tbrFac([R.isGL ? 'F_{c⊥x}' : 'F_{c⊥}', g4(r.Fcp)], fcpFacs(gc.gcJ));
+    const fe = tbrFac(['E', g4(r.E)], eFacs(false)), fm = tbrFac(['E_{min}', g4(r.Emin)], eFacs(true));
+    T.push({ title: 'Bending: F′_b for ' + gb.name, ref: tbrTbl(), steps: [tbrS({ id: 'dv.Fb', label: 'Adjusted bending design value, ' + gb.name + (R.isGL ? (sg > 0 ? ' (M > 0, F_bx^+)' : ' (M < 0, F_bx^−)') : ''), sym: 'F^{\\prime}_{b}', eq: fb.eq, sub: fb.sub, value: gb.Fb_p, unit: 'psi', d: 0, ref: tbrTbl(), note: 'C_L and C_V: §bd.CL' + (sawnOnly() ? '' : ', §bd.CV') + '.' })] });
+    T.push({ title: 'Shear: F′_v for ' + gv.name, ref: tbrTbl(), steps: [tbrS({ id: 'dv.Fv', label: 'Adjusted shear design value, ' + gv.name, sym: 'F^{\\prime}_{v}', eq: fv.eq, sub: fv.sub, value: gv.Fv_p, unit: 'psi', d: 1, ref: tbrTbl() })] });
+    T.push({ title: 'Bearing: F′_c⊥ at support ' + nodeN(gc.gcJ), ref: tbrTbl() + (isLRFD() ? ' (no λ)' : ' (no C_D)'), steps: [tbrS({ id: 'dv.Fcp', label: 'Adjusted compression perpendicular to grain, support ' + nodeN(gc.gcJ), sym: 'F^{\\prime}_{c⊥}', eq: fc.eq, sub: fc.sub, value: gc.Fcp_p, unit: 'psi', d: 1, ref: tbrTbl() })] });
+    T.push({ title: 'Stiffness: E′ and E′_min', ref: tbrTbl(), res: /\.Emin$/, steps: [tbrS({ id: 'dv.E', label: 'Adjusted modulus of elasticity (deflection' + (isLRFD() ? ', service loads' : '') + ')', sym: 'E^{\\prime}', eq: fe.eq, sub: fe.sub, value: R.E_p, unit: 'psi', d: 0, ref: tbrTbl() }),
+      tbrS({ id: 'dv.Emin', label: 'Adjusted E_min (beam stability)' + (isLRFD() ? ', incl. K_F φ_s' : ''), sym: 'E^{\\prime}_{min}', eq: fm.eq, sub: fm.sub, value: R.Emin_p, unit: 'psi', d: 0, ref: tbrTbl() })] });
+    subs.push({ title: 'Adjusted design values (governing combinations)', items: [tbrTopics(T), { type: 'note', text: 'Each combination has its own ' + (isLRFD() ? 'λ' : 'C_D') + ': the values of every combination are in §6–§8 (tables) and on the Design Values tab[[tab:dv| ↗]].' }] });
+    secs.push({ title: 'Design values', subs });
+  }
+  /* ---------- 5. Analysis ---------- */
+  {
+    const sj = R.supJ;
+    const rows = R.combos.map(c => ({ cls: c === gb || c === gv || c === gc ? 'gov' : '', cells: [c.name, String(c.TF), tbrCell(c.w, 1), ...sj.map(j => tbrCell(c.R[j], 0)), tbrCell(bendM(c), 0), tbrCell(c.Vd, 0), tbrCell(c.sumF, 0), tbrCell(c.sumR, 0)] }));
+    const eqOK = R.combos.every(c => Math.abs(c.sumR - c.sumF) <= 1e-6 * Math.max(1, Math.abs(c.sumF)));
+    secs.push({ title: 'Analysis', subs: [{ title: isLRFD() ? 'LRFD load combinations (ASCE 7-16 Sec. 2.3.1): actions and reactions' : 'ASD load combinations (ASCE 7-16 Sec. 2.4.1): actions and reactions', items: [
+      { type: 'table', wide: true, head: ['Combination', tfHead().replace(/<sub>(.*?)<\/sub>/, '_$1'), 'w (plf)', ...sj.map(j => 'R_' + nodeN(j) + ' (lb)'), 'M (ft-lb)', 'V (lb)', 'ΣF (lb)', 'ΣR (lb)'], rows },
+      { type: 'note', text: 'Bold = governing for bending, shear or bearing. ' + (isLRFD() ? 'λ is the time effect factor of the combination (NDS 2018 Table N3).' : 'C_D is that of the shortest-duration load present in the combination (NDS 2018 2.3.2).') + ' M = ' + (R.legacyBend ? 'largest |M|' : 'moment of the governing bending region') + '; V = design shear (NDS 2018 3.4.3.1). Statics: ΣR = ΣF in ' + (eqOK ? 'every combination.' : 'NOT every combination (check).') },
+      { type: 'note', text: (R.simple ? 'Simple span: closed-form statics.' : 'Continuous beam / cantilever: direct stiffness method, one E′I for the member (EI does not affect the reactions of a prismatic member).') + ' Shear and moment diagrams and the peak values of every combination: Analysis Results tab[[tab:ana| ↗]].' }] }] });
+  }
+  /* ---------- 6. Bending ---------- */
+  {
+    const c = gb, i = bSpan, sign = bSign, be = c.bend[i], Mv = bendM(c), T = [];
+    T.push({ title: 'Bending stress (demand)', ref: TB_NDS + '3.3.2, Eq. 3.3-2', steps: [tbrS({ id: 'bd.fb', label: (R.legacyBend ? 'Largest |M|' : sign > 0 ? 'Largest positive moment' : 'Largest negative moment') + ' in ' + spanLab(i) + ', ' + c.name + ': M = ' + f0(Mv) + ' ft-lb (' + bendLoc(c) + ')', sym: 'f_{b}', eq: '\\frac{M}{S}', sub: '\\frac{' + f0(Mv) + ' \\times 12}{' + f3(R.S) + '}', value: c.fb, unit: 'psi', d: 0, ref: TB_NDS + 'Eq. 3.3-2', note: 'S: §sec.S. M: Analysis (§5.1).' })] });
+    const st = stabFor(i, sign), s = st.s, CL = sign > 0 ? be.CLt : be.CLb, cl = [];
+    if (!st.applies) cl.push(tbrS({ id: 'bd.CL', label: 'Beam stability factor (' + st.edge + ' edge)', sym: 'C_{L}', eq: '', sub: '', value: CL, unit: '', d: 3, ref: TB_NDS + '3.3.3.1, 3.3.3.3', note: R.dep <= R.bw ? 'd ≤ b: C_L = 1.0 (NDS 2018 3.3.3.1).' : 'The ' + st.edge + ' (compression) edge is braced continuously: C_L = 1.0 (NDS 2018 3.3.3.3).' }));
+    else {
+      const Fbs = sign > 0 ? c.Fb_star : c.Fbn_star, rr = s.FbE / Fbs, fs = tbrFac(fbBase(sign), fbStarFacs(c));
+      const leEq = /^2\.06/.test(s.leRule) ? ['2.06\\,l_{u}', '2.06 \\times ' + f1(s.lu)] : /^1\.84/.test(s.leRule) ? ['1.84\\,l_{u}', '1.84 \\times ' + f1(s.lu)] : ['1.63\\,l_{u} + 3d', '1.63 \\times ' + f1(s.lu) + ' + 3 \\times ' + g4(R.dep)];
+      cl.push(tbrS({ id: 'bd.lu', label: 'Unbraced length of the ' + st.edge + ' edge (' + ((sign > 0 ? dz.luTop : dz.luBot) > 0 ? 'entered' : 'span length') + '), ' + spanLab(i), sym: 'l_{u}', eq: '', sub: '', value: s.lu, unit: 'in', d: 1 }),
+        tbrS({ id: 'bd.luD', label: 'Slenderness of the unbraced length', sym: '\\frac{l_{u}}{d}', eq: '', sub: '\\frac{' + f1(s.lu) + '}{' + g4(R.dep) + '}', value: s.luD, unit: '', d: 2 }),
+        tbrS({ id: 'bd.le', label: 'Effective length: ' + s.leRule, sym: 'l_{e}', eq: leEq[0], sub: leEq[1], value: s.le, unit: 'in', d: 1, ref: TB_NDS + 'Table 3.3.3' + (R.fn1 ? ' footnote 1' : '') }),
+        tbrS({ id: 'bd.RB', label: 'Slenderness ratio for bending members', sym: 'R_{B}', eq: '\\sqrt{\\frac{l_{e}\\,d}{b^{2}}}', sub: '\\sqrt{\\frac{' + f1(s.le) + ' \\times ' + g4(R.dep) + '}{' + g4(R.bw) + '^{2}}}', value: s.RB, unit: '', d: 2, ref: TB_NDS + 'Eq. 3.3-5', note: s.RB > 50 ? 'R_B > 50: not permitted (NDS 2018 3.3.3.7) — NG.' : 'R_B ≤ 50 (NDS 2018 3.3.3.7).' }),
+        tbrS({ id: 'bd.FbE', label: 'Critical buckling design value', sym: 'F_{bE}', eq: '\\frac{1.20\\,E^{\\prime}_{min}}{R_{B}^{2}}', sub: '\\frac{1.20 \\times ' + f0(R.Emin_p) + '}{' + f2(s.RB) + '^{2}}', value: s.FbE, unit: 'psi', d: 0, ref: TB_NDS + '3.3.3.8', note: 'E′_min: §dv.Emin.' }),
+        tbrS({ id: 'bd.Fbs', label: 'F_b times all factors except C_L, C_V' + (R.isGL ? ' and C_fu' : '') + ' (' + c.name + ')', sym: 'F_{b}^{*}', eq: fs.eq, sub: fs.sub, value: Fbs, unit: 'psi', d: 0, ref: TB_NDS + '3.3.3.8' }),
+        tbrS({ id: 'bd.CL', label: 'Beam stability factor (' + st.edge + ' edge in compression, ' + spanLab(i) + ')', sym: 'C_{L}', eq: '\\frac{1 + F_{bE}/F_{b}^{*}}{1.9} - \\sqrt{\\left(\\frac{1 + F_{bE}/F_{b}^{*}}{1.9}\\right)^{2} - \\frac{F_{bE}/F_{b}^{*}}{0.95}}', sub: '\\frac{1 + ' + f3(rr) + '}{1.9} - \\sqrt{\\left(\\frac{1 + ' + f3(rr) + '}{1.9}\\right)^{2} - \\frac{' + f3(rr) + '}{0.95}}', value: CL, unit: '', d: 3, ref: TB_NDS + 'Eq. 3.3-6', note: 'F_bE / F_b* = ' + f3(rr) + '; C_L ≤ 1.0.' }));
+    }
+    T.push({ title: 'Beam stability factor C_L', ref: TB_NDS + '3.3.3, Table 3.3.3', res: /\.CL$/, steps: cl });
+    if (!sawnOnly()) {
+      const CV = sign > 0 ? be.CVt : be.CVb, cv = [], gov = CV > 1 ? 'C_V > 1.0: C_L and C_V both apply (NDS 2018 8.3.6).' : (CL <= CV ? 'C_L' : 'C_V') + ' governs (C_L and C_V are not cumulative: the lesser applies).';
+      if (R.isGL) {
+        const z = sign > 0 ? be.zt : be.zb, x = R.glX;
+        if (!z) cv.push(tbrS({ id: 'bd.CV', label: 'Volume factor (no moment of this sign in the region)', sym: 'C_{V}', eq: '', sub: '', value: CV, unit: '', d: 3, ref: TB_NDS + '5.3.6' }));
+        else {
+          const raw = Math.pow(21 / z.Lz, 1 / x) * Math.pow(12 / R.dep, 1 / x) * Math.pow(5.125 / R.bw, 1 / x);   // display only, as the Bending tab (cvBlock)
+          cv.push(tbrS({ id: 'bd.Lz', label: 'Length between the points of zero moment (x₁ = ' + f3(z.xl) + ', x₂ = ' + f3(z.xr) + ' ft)', sym: 'L', eq: 'x_{2} - x_{1}', sub: f3(z.xr) + ' - ' + f3(z.xl), value: z.Lz, unit: 'ft', d: 3, ref: TB_NDS + '5.3.6' }),
+            tbrS({ id: 'bd.CV', label: 'Volume factor (' + (sign > 0 ? 'positive' : 'negative') + ' moment region, ' + spanLab(i) + '; x = ' + x + ')', sym: 'C_{V}', eq: '\\left(\\frac{21}{L}\\right)^{1/x}\\left(\\frac{12}{d}\\right)^{1/x}\\left(\\frac{5.125}{b}\\right)^{1/x} \\le 1.0', sub: '\\left(\\frac{21}{' + f3(z.Lz) + '}\\right)^{1/' + x + '}\\left(\\frac{12}{' + g4(R.dep) + '}\\right)^{1/' + x + '}\\left(\\frac{5.125}{' + g4(R.bw) + '}\\right)^{1/' + x + '}', value: CV, unit: '', d: 3, ref: TB_NDS + '5.3.6, Eq. 5.3-1', note: 'Product = ' + raw.toFixed(4) + (raw > 1 ? ' > 1.0, so C_V = 1.0' : '') + '. C_L = ' + f3(CL) + ': ' + gov }));
+        }
+      } else {
+        const raw = Math.pow(R.sclRef / R.dep, R.sclN);   // display only, as the Bending tab (cvBlock)
+        cv.push(tbrS({ id: 'bd.CV', label: 'Size factor of the manufacturer (n, d_ref, C_V,max user-entered)', sym: 'C_{V}', eq: '\\left(\\frac{d_{ref}}{d}\\right)^{n}', sub: '\\left(\\frac{' + g4(R.sclRef) + '}{' + g4(R.dep) + '}\\right)^{' + g4(R.sclN) + '}', value: CV, unit: '', d: 3, ref: TB_NDS + '8.3.6; manufacturer', note: 'Product = ' + raw.toFixed(4) + (raw > R.sclMax ? ' > ' + g4(R.sclMax) + ', so C_V = ' + g4(R.sclMax) : '') + '. C_L = ' + f3(CL) + ': ' + gov }));
+      }
+      T.push({ title: R.isGL ? 'Volume factor C_V (glulam)' : 'Size factor C_V (SCL)', ref: R.isGL ? TB_NDS + '5.3.6' : TB_NDS + '8.3.6', res: /\.CV$/, steps: cv });
+    }
+    const fb = tbrFac(fbBase(sign), fbFacs(c, c.CL, c.CV));
+    T.push({ title: 'Adjusted bending design value and check', ref: TB_NDS + '3.3.1; ' + tbrTbl(), steps: [
+      tbrS({ id: 'bd.Fbp', label: 'Adjusted bending design value (' + c.name + ', ' + tfP(c) + ')', sym: 'F^{\\prime}_{b}', eq: fb.eq, sub: fb.sub, value: c.Fb_p, unit: 'psi', d: 0, ref: tbrTbl(), note: R.isGL ? 'C_L and C_V are not cumulative: the lesser applies (NDS 2018 5.3.6).' : R.isSCL ? 'NDS 2018 8.3.6.' : 'Sawn lumber: no C_V.' }),
+      tbrS({ id: 'bd.r', label: 'Bending check', sym: '\\frac{f_{b}}{F^{\\prime}_{b}}', eq: '', sub: '\\frac{' + f0(c.fb) + '}{' + f0(c.Fb_p) + '}', value: c.r_b, unit: '', d: 3, ref: TB_NDS + '3.3.1', ok: c.r_b <= 1 })] });
+    const cvOn = !sawnOnly(), brows = [];
+    c.bend.forEach(e => { brows.push([spanLab(e.span), '+M (top)' + (R.isGL ? ', F_bx^+' : ''), tbrCell(e.Mp, 0), e.xp == null ? '—' : tbrCell(e.xp, 2), tbrCell(e.CLt, 3), ...(cvOn ? [tbrCell(e.CVt, 3)] : []), tbrCell(e.Fbp_t, 0), tbrCell(e.fbp, 0), tbrDC(e.rp)]);
+      brows.push([spanLab(e.span), '−M (bottom)' + (R.isGL ? ', F_bx^−' : ''), tbrCell(e.Mn, 0), e.xn == null ? '—' : tbrCell(e.xn, 2), tbrCell(e.CLb, 3), ...(cvOn ? [tbrCell(e.CVb, 3)] : []), tbrCell(e.Fbp_b, 0), tbrCell(e.fbn, 0), tbrDC(e.rn)]); });
+    const subs = [{ title: 'Bending check (governing combination ' + c.name + ')', items: [tbrTopics(T), { type: 'note', text: 'The same steps are on the Bending tab[[tab:bend| ↗]].' }] }];
+    if (R.nS > 1 || !R.legacyBend) subs.push({ title: 'Bending by span and sign (' + c.name + ')', items: [{ type: 'table', head: ['Span', 'Region', '|M| (ft-lb)', 'x (ft)', 'C_L', ...(cvOn ? ['C_V'] : []), 'F′_b (psi)', 'f_b (psi)', 'Ratio'], rows: brows },
+      { type: 'table', head: ['Span', 'top l_u (in.)', 'l_e', 'R_B', 'F_bE', 'bottom l_u (in.)', 'l_e', 'R_B', 'F_bE'], rows: R.stab.map((q, k) => [spanLab(k), tbrCell(q.top.lu, 1), tbrCell(q.top.le, 1), tbrCell(q.top.RB, 2), tbrCell(q.top.FbE, 0), tbrCell(q.bot.lu, 1), tbrCell(q.bot.le, 1), tbrCell(q.bot.RB, 2), tbrCell(q.bot.FbE, 0)]) },
+      { type: 'note', text: 'Top edge: ' + (R.stabilityApplies ? 'at supports only' : 'braced (C_L = 1.0)') + '; bottom edge: ' + (R.latBot === 'same' ? 'same as top edge' : (R.stabBot ? 'at supports only' : 'braced (C_L = 1.0)')) + '.' + (R.simple ? '' : ' Continuous beams and cantilevers use the general rule of NDS 2018 Table 3.3.3 footnote 1.') }] });
+    subs.push({ title: 'Bending ratio by combination', items: [{ type: 'table', wide: true, head: ['Combination', tfHead().replace(/<sub>(.*?)<\/sub>/, '_$1'), 'F_b* (psi)', 'Governing region', 'M (ft-lb)', 'C_L', ...(cvOn ? ['C_V'] : []), 'F′_b (psi)', 'f_b (psi)', 'Ratio'],
+      rows: R.combos.map(k => ({ cls: k === c ? 'gov' : '', cells: [k.name, String(k.TF), tbrCell(k.Fb_s, 0), bendLoc(k), tbrCell(bendM(k), 0), tbrCell(k.CL, 3), ...(cvOn ? [tbrCell(k.CV, 3)] : []), tbrCell(k.Fb_p, 0), tbrCell(k.fb, 0), tbrDC(k.r_b)] })) }] });
+    secs.push({ title: 'Bending', subs });
+  }
+  /* ---------- 7. Shear ---------- */
+  {
+    const c = gv, T = [];
+    const xdList = !c.xdUsed ? [] : (c.Pv || []).map((q, k) => q !== c.P[k] ? f0(c.P[k].mag) + ' lb at x = ' + f2(q.loc) + ' ft × ' + f3(q.mag / c.P[k].mag) + ' = ' + f0(q.mag) + ' lb' : null).filter(Boolean);
+    T.push({ title: 'Design shear and shear stress', ref: TB_NDS + '3.4.2, 3.4.3.1', res: /\.fv$/, steps: [
+      tbrS({ id: 'sh.V', label: c.vZone !== null ? 'Design shear at support ' + nodeN(c.vZone) + ' (uniform load within d ignored, point loads within d included), ' + c.name : 'Design shear: largest |V| at least d from each support face, ' + c.name, sym: 'V', eq: '', sub: '', value: c.Vd, unit: 'lb', d: 0, ref: R.shearXd ? TB_NDS + '3.4.3.1(a), (b)' : TB_NDS + '3.4.3.1(a)',
+        note: 'x = ' + f2(c.xV) + ' ft; d = ' + g4(R.dep) + ' in. = ' + f3(R.dep / 12) + ' ft. ' + (R.shearXd ? 'Point loads within d of a support multiplied by x/d (NDS 2018 3.4.3.1(b)): ' + (xdList.length ? xdList.join('; ') : 'not used in this combination') + '.' : 'Point loads within d of a support at full value (the x/d reduction of NDS 2018 3.4.3.1(b) is not used).') }),
+      tbrS({ id: 'sh.fv', label: 'Shear stress', sym: 'f_{v}', eq: '\\frac{3V}{2A}', sub: '\\frac{1.5 \\times ' + f0(c.Vd) + '}{' + f3(R.A) + '}', value: c.fv, unit: 'psi', d: 1, ref: TB_NDS + 'Eq. 3.4-2', note: 'A: §sec.A.' })] });
+    const fv = tbrFac([R.isGL ? 'F_{vx}' : 'F_{v}', g4(r.Fv)], fvFacs(c));
+    T.push({ title: 'Adjusted shear design value and check', ref: tbrTbl(), steps: [
+      tbrS({ id: 'sh.Fvp', label: 'Adjusted shear design value (' + c.name + ', ' + tfP(c) + ')', sym: 'F^{\\prime}_{v}', eq: fv.eq, sub: fv.sub, value: c.Fv_p, unit: 'psi', d: 1, ref: tbrTbl() }),
+      tbrS({ id: 'sh.r', label: 'Shear check (unnotched section)', sym: '\\frac{f_{v}}{F^{\\prime}_{v}}', eq: '', sub: '\\frac{' + f1(c.fv) + '}{' + f1(c.Fv_p) + '}', value: c.r_v1, unit: '', d: 3, ref: TB_NDS + '3.4.1', ok: c.r_v1 <= 1 })] });
+    if (R.hasNotch) T.push({ title: 'Notched ends (tension face at the end supports)', ref: TB_NDS + '3.4.3.2(a)' + (R.isGL ? '; 5.3.10; 5.4.4.1' : '; 4.4.3.2'), steps: [
+      tbrS({ id: 'sh.dn', label: 'Depth at the notch (n = ' + g4(R.notch) + ' in.; limit ' + (R.isGL ? 'min(d/10, 3 in.)' : 'd/4') + ' = ' + f2(R.notchLim) + ' in.' + (R.notch > R.notchLim ? ': exceeded, NG' : '') + ')', sym: 'd_{n}', eq: 'd - n', sub: g4(R.dep) + ' - ' + g4(R.notch), value: R.dn, unit: 'in', d: 3, ref: R.isGL ? TB_NDS + '5.4.4.1' : TB_NDS + '4.4.3.2' }),
+      tbrS({ id: 'sh.Cn', label: 'Notch factor', sym: 'C_{n}', eq: '\\left(\\frac{d_{n}}{d}\\right)^{2}', sub: '\\left(\\frac{' + f3(R.dn) + '}{' + g4(R.dep) + '}\\right)^{2}', value: R.Cn, unit: '', d: 3, ref: TB_NDS + 'Eq. 3.4-3' }),
+      tbrS({ id: 'sh.fvn', label: 'Shear stress at the notched end (R = largest |reaction| at a notched end support, ' + c.name + ')', sym: 'f_{v,n}', eq: '\\frac{3R}{2\\,b\\,d_{n}}', sub: '\\frac{1.5 \\times ' + f0(c.Rmax) + '}{' + g4(R.bw) + ' \\times ' + f3(R.dn) + '}', value: c.fvn, unit: 'psi', d: 1, ref: TB_NDS + 'Eq. 3.4-3' }),
+      tbrS({ id: 'sh.rn', label: 'Notched-end check', sym: R.isGL ? '\\frac{f_{v,n}}{F^{\\prime}_{v}\\,C_{n}\\,C_{vr}}' : '\\frac{f_{v,n}}{F^{\\prime}_{v}\\,C_{n}}', eq: '', sub: R.isGL ? '\\frac{' + f1(c.fvn) + '}{' + f1(c.Fv_p) + ' \\times ' + f3(R.Cn) + ' \\times ' + R.Cvr + '}' : '\\frac{' + f1(c.fvn) + '}{' + f1(c.Fv_p) + ' \\times ' + f3(R.Cn) + '}', value: c.r_vn, unit: '', d: 3, ref: TB_NDS + '3.4.3.2(a)', ok: c.r_vn <= 1 })] });
+    secs.push({ title: 'Shear', subs: [{ title: 'Shear check (governing combination ' + c.name + ')', items: [tbrTopics(T), { type: 'note', text: 'Shear ratio of the combination = the larger of the unnotched and notched-end ratios = ' + f3(c.r_v) + '. The same steps are on the Shear tab[[tab:shear| ↗]].' }] },
+      { title: 'Shear ratio by combination', items: [{ type: 'table', wide: true, head: ['Combination', tfHead().replace(/<sub>(.*?)<\/sub>/, '_$1'), 'V (lb)', 'x (ft)', 'f_v (psi)', 'F′_v (psi)', 'f_v/F′_v', ...(R.hasNotch ? ['R notch (lb)', 'f_v,n/(F′_v C_n)'] : []), 'Ratio'],
+        rows: R.combos.map(k => ({ cls: k === c ? 'gov' : '', cells: [k.name, String(k.TF), tbrCell(k.Vd, 0), tbrCell(k.xV, 2), tbrCell(k.fv, 1), tbrCell(k.Fv_p, 1), tbrCell(k.r_v1, 3), ...(R.hasNotch ? [tbrCell(k.Rmax, 0), tbrCell(k.r_vn, 3)] : []), tbrDC(k.r_v)] })) }] }] });
+  }
+  /* ---------- 8. Bearing ---------- */
+  {
+    const c = gc, j = c.gcJ, lb = R.lbs[j], Cb = R.Cbs[j], fc = tbrFac([R.isGL ? 'F_{c⊥x}' : 'F_{c⊥}', g4(r.Fcp)], fcpFacs(j));
+    const T = [{ title: 'Bearing area factor', ref: TB_NDS + '3.10.4, Eq. 3.10-2', res: /\.Cb$/, steps: [tbrS({ id: 'br.Cb', label: 'Bearing area factor, support ' + nodeN(j) + ' (l_b = ' + g4(lb) + ' in.)', sym: 'C_{b}', eq: R.cbOn[j] && lb < 6 ? '\\frac{l_{b} + 0.375}{l_{b}}' : '', sub: R.cbOn[j] && lb < 6 ? '\\frac{' + g4(lb) + ' + 0.375}{' + g4(lb) + '}' : '', value: Cb, unit: '', d: 3, ref: TB_NDS + 'Eq. 3.10-2',
+      note: R.cbOn[j] ? (lb < 6 ? 'Bearing ≥ 3 in. from the member end and l_b < 6 in.' : 'l_b ≥ 6 in.: C_b = 1.0.') : 'End bearing (less than 3 in. from the member end): C_b = 1.0.' })] },
+      { title: 'Adjusted compression perpendicular to grain', ref: tbrTbl() + (isLRFD() ? ' (no λ)' : ' (no C_D)'), steps: [tbrS({ id: 'br.Fcp', label: 'Adjusted compression perpendicular to grain, support ' + nodeN(j), sym: 'F^{\\prime}_{c⊥}', eq: fc.eq, sub: fc.sub, value: c.Fcp_p, unit: 'psi', d: 1, ref: tbrTbl() })] },
+      { title: 'Bearing stress and check', ref: TB_NDS + '3.10.2', steps: [
+        tbrS({ id: 'br.fcp', label: 'Bearing stress (R = reaction at support ' + nodeN(j) + ', ' + c.name + '; uplift taken as 0)', sym: 'f_{c⊥}', eq: '\\frac{R}{b\\,l_{b}}', sub: '\\frac{' + f0(c.Rbear) + '}{' + g4(R.bw) + ' \\times ' + g4(lb) + '}', value: c.fcp, unit: 'psi', d: 1, ref: TB_NDS + '3.10.2' }),
+        tbrS({ id: 'br.r', label: 'Bearing check', sym: '\\frac{f_{c⊥}}{F^{\\prime}_{c⊥}}', eq: '', sub: '\\frac{' + f1(c.fcp) + '}{' + f1(c.Fcp_p) + '}', value: c.r_c, unit: '', d: 3, ref: TB_NDS + '3.10.2', ok: c.r_c <= 1 })] }];
+    const rows = R.supJ.map(jj => {
+      const best = R.combos.reduce((a, k) => { const e = k.bear.find(q => q.j === jj); return e.r > a.e.r ? { k, e } : a; }, { k: R.combos[0], e: R.combos[0].bear.find(q => q.j === jj) });
+      const Rmin = Math.min(...R.combos.map(k => k.R[jj]));
+      return { cls: jj === j ? 'gov' : '', cells: [nodeN(jj), g4(R.lbs[jj]), R.cbOn[jj] ? 'yes' : 'no', tbrCell(R.Cbs[jj], 3), tbrCell(best.e.Fcp_p, 1), best.k.name, tbrCell(best.e.R, 0), tbrCell(best.e.fcp, 1), tbrDC(best.e.r), tbrCell(Rmin, 0, Rmin < 0 ? 'ng' : '')] };
+    });
+    secs.push({ title: 'Bearing', subs: [{ title: 'Bearing perpendicular to grain at support ' + nodeN(j) + ' (' + c.name + ')', items: [tbrTopics(T), { type: 'note', text: 'F_c⊥ is not adjusted by ' + (isLRFD() ? 'λ' : 'C_D') + ' (NDS 2018 Table 4.3.1). The same steps are on the Bearing tab[[tab:bear| ↗]].' }] },
+      { title: 'All supports (largest ratio over the combinations)', items: [{ type: 'table', wide: true, head: ['Support', 'l_b (in.)', '≥ 3 in. from end', 'C_b', 'F′_c⊥ (psi)', 'Governing combination', 'R (lb)', 'f_c⊥ (psi)', 'Ratio', 'R min (lb)'], rows },
+        { type: 'note', text: 'R min < 0 = net uplift in at least one combination: the bearing check uses only downward reactions; provide an uplift connection.' }] }] });
+  }
+  /* ---------- 9. Deflection ---------- */
+  {
+    const gLL = d.perSpan[d.spanLL], gTL = d.perSpan[d.spanTL];
+    const T = [{ title: 'Bending stiffness', ref: TB_NDS + '3.5.1', steps: [tbrS({ id: 'df.EI', label: 'Bending stiffness', sym: 'E^{\\prime}I', eq: '', sub: f0(R.E_p) + ' \\times ' + f3(R.I), value: R.E_p * R.I, unit: 'lb-in^{2}', d: 0, note: 'E′: §dv.E; I: §sec.I. ' + (R.simple ? 'Simple span: superposition of the uniform load and each point load (standard simple-beam expressions).' : 'Continuous beam / cantilever: chord between the nodal deflections of the stiffness solution + simple-beam deflection of the span’s own loads + effect of the end moments.') + ' Per load type (D, L, Lr, S) at the analysis stations; wind not included; shear deformation neglected.' })] },
+      { title: 'Live / snow deflection' + (R.nS > 1 ? ' (' + spanLab(d.spanLL) + ')' : ''), ref: 'IBC 2018 Table 1604.3', steps: [
+        tbrS({ id: 'df.LL', label: 'Largest transient deflection (case ' + d.trName + ')', sym: '\\Delta_{LL}', eq: '\\max(\\Delta_{L}, \\Delta_{Lr}, \\Delta_{S}, 0.75\\Delta_{L} + 0.75\\Delta_{Lr}, 0.75\\Delta_{L} + 0.75\\Delta_{S})', sub: '', value: d.Dtr, unit: 'in', d: 3 }),
+        tbrS({ id: 'df.limLL', label: 'Limit (L = ' + (gLL.cant ? 'twice the cantilever length, IBC 2018 Table 1604.3 footnote h' : 'span length') + ')', sym: '\\frac{L}{n_{LL}}', eq: '', sub: '\\frac{' + f1(gLL.Lref) + '}{' + g4(d.LLdiv) + '}', value: d.LLlim, unit: 'in', d: 3, ref: 'IBC 2018 Table 1604.3' }),
+        tbrS({ id: 'df.rLL', label: 'Live / snow deflection check (L/' + f0(gLL.Lref / d.Dtr) + ')', sym: '\\frac{\\Delta_{LL}}{L/n_{LL}}', eq: '', sub: '\\frac{' + f3(d.Dtr) + '}{' + f3(d.LLlim) + '}', value: d.r_dLL, unit: '', d: 3, ref: 'IBC 2018 Table 1604.3', ok: d.r_dLL <= 1 })] },
+      { title: 'Total deflection with creep' + (R.nS > 1 ? ' (' + spanLab(d.spanTL) + ')' : ''), ref: TB_NDS + '3.5.2, Eq. 3.5-1; IBC 2018 Table 1604.3', steps: [
+        tbrS({ id: 'df.T', label: 'Total deflection (K_cr = ' + g4(d.Kcr) + ' on the dead-load deflection; Δ_D largest = ' + f3(d.dD) + ' in.)', sym: '\\Delta_{T}', eq: 'K_{cr}\\,\\Delta_{D} + \\Delta_{LL}', sub: g4(d.Kcr) + '\\,\\Delta_{D} + \\Delta(\\text{' + tbrTx(d.totName) + '})', value: d.Dtot, unit: 'in', d: 3, ref: TB_NDS + 'Eq. 3.5-1', note: 'The largest value over the span of K_cr Δ_D(x) + Δ_LL(x) at the analysis stations (not the sum of the two maxima). K_cr applies to the dead load only.' }),
+        tbrS({ id: 'df.limTL', label: 'Limit (L = ' + (gTL.cant ? 'twice the cantilever length' : 'span length') + ')', sym: '\\frac{L}{n_{TL}}', eq: '', sub: '\\frac{' + f1(gTL.Lref) + '}{' + g4(d.TLdiv) + '}', value: d.TLlim, unit: 'in', d: 3, ref: 'IBC 2018 Table 1604.3' }),
+        tbrS({ id: 'df.rTL', label: 'Total deflection check (L/' + f0(gTL.Lref / d.Dtot) + ')', sym: '\\frac{\\Delta_{T}}{L/n_{TL}}', eq: '', sub: '\\frac{' + f3(d.Dtot) + '}{' + f3(d.TLlim) + '}', value: d.r_dTL, unit: '', d: 3, ref: TB_NDS + '3.5.2; IBC 2018 Table 1604.3', ok: d.r_dTL <= 1 })] }];
+    secs.push({ title: 'Deflection', subs: [{ title: 'Deflection checks (service loads)', items: [tbrTopics(T), { type: 'note', text: 'The deflected shapes are plotted on the Deflection tab[[tab:defl| ↗]].' }] },
+      { title: 'Deflection by span', items: [{ type: 'table', wide: true, head: ['Span', 'L for limit (in.)', 'Δ_D (in.)', 'LL case', 'Δ_LL (in.)', 'L/n_LL (in.)', 'Ratio', 'TL case', 'Δ_T (in.)', 'L/n_TL (in.)', 'Ratio'],
+        rows: d.perSpan.map(e => [spanLab(e.span) + (e.cant ? ' (cantilever)' : ''), tbrCell(e.Lref, 1), tbrCell(e.dD, 3), e.trName, tbrCell(e.Dtr, 3), tbrCell(e.LLlim, 3), tbrDC(e.r_dLL), e.totName, tbrCell(e.Dtot, 3), tbrCell(e.TLlim, 3), tbrDC(e.r_dTL)]) }] }] });
+  }
+  /* ---------- 10. Notes and references ---------- */
+  {
+    const items = [];
+    if ((p.notes || '').trim()) items.push({ type: 'note', text: 'Project notes and assumptions (input): ' + String(p.notes).trim().replace(/\s*\n\s*/g, ' / ') });
+    R.fails.forEach(m => items.push({ type: 'note', warn: true, text: 'Code limit violated: ' + m }));
+    R.notes.concat(R.adv).forEach(m => items.push({ type: 'note', warn: true, text: 'Note: ' + m }));
+    if (!items.length) items.push({ type: 'note', text: 'No notes.' });
+    secs.push({ title: 'Notes and references', subs: [{ title: 'Notes', items }, { title: 'Codes and references cited', items: [{ type: 'table', head: ['Reference', 'Provisions used'], rows: tbcRefs({}).map(x => x.map(tbrPlain)) }] }] });
+  }
+  return { title: 'Timber Beam Check — Calculation Report', subtitle: (p.name || 'Untitled') + (p.member ? ' — ' + p.member : ''), code: 'NDS 2018 (' + methTxt() + ') · NDS Supplement 2018 · ASCE 7-16 · IBC 2018',
+    info: [['Project', p.name], ['Project No.', p.job], ['Calculated by', p.designer], ['Date', p.date || today], ['Checked by', p.checker], ['Checked date', '']],
+    head: { left: 'Project No. ' + (p.job || '—') + ' — ' + String(p.member || p.name || 'Timber beam').slice(0, 40), right: 'Computed: ' + (p.designer || '—') + ' ' + (p.date || today) + ' · Checked: ' + (p.checker || '—'), foot: (p.name || 'Untitled') + ' (Timber Beam Check)' },
+    sections: secs };
+}
+function buildReport(pg) {
+  if (!window.SharedReport || !window.SharedSteps) { pg.appendChild(el('div', 'errBox', 'shared/report.js or shared/steps.js is not loaded: keep the shared folder next to this file.')); TBRP.api = null; TBRP.doc = null; return; }
+  let Mo;
+  try { Mo = tbrRich(tbrModel()); } catch (e) { pg.appendChild(el('div', 'errBox', 'Report error: ' + esc(e && e.message))); TBRP.api = null; TBRP.doc = null; console.error(e); return; }
+  const tb = $('tabBar'), stick = tb && getComputedStyle(tb).position === 'sticky' ? tb.offsetHeight : 0;
+  TBRP.api = SharedReport.mount(pg, Mo, { closed: TBRP.closed, onGoto: tbrGoto, stick });
+  TBRP.doc = TBRP.api.doc;
+}
+/* [[tab:…]] links of the report: an output tab (as its tab button) */
+function tbrGoto(name) {
+  if (!OUT_TABS.some(t => t[0] === name)) return;
+  M.ui.outTab = name; autosave(); buildTabBar(); renderTab(); $('outputPanel').scrollTop = 0;
+  if ($('outputPanel').scrollHeight <= $('outputPanel').clientHeight + 1) window.scrollTo(0, $('tabBar').getBoundingClientRect().top + window.scrollY - 6);
+}
+/* Ctrl+P while the Report tab is shown prints the report alone (shared/report.js print layout and running header); PRINT_CSS hides
+   #app in print, so the report goes into #rp-print. From any other tab Ctrl+P is unchanged. */
+window.addEventListener('beforeprint', () => {
+  if (!TBRP.doc || curTab() !== 'rpt' || document.body.classList.contains('rp-printing') || $('printReport')) return;
+  let box = $('rp-print'); if (!box) { box = document.createElement('div'); box.id = 'rp-print'; document.body.appendChild(box); }
+  box.innerHTML = '<div class="rp"><article class="rp-doc">' + SharedReport.html(TBRP.doc, { lazy: false }) + '</article></div>';
+  document.body.classList.add('rp-printing');
+});
+
```
