# Fix log — Timber Beam Check.html

Governing basis used for fixes: NDS 2018 (ANSI/AWC NDS-2018) and NDS Supplement 2018 Ed., ASD; ASCE 7-16 Sec. 2.4.1 ASD load combinations; IBC Table 1604.3 for the deflection limits (user-editable).

## 2026-10-04 — PR: claude/fix-timber (PR link added after merge)

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

## 2026-10-09 — PR: claude/tabs-timber (PR link added after merge)

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

## 2026-10-09 — PR: claude/pin-timber (PR link added after merge)

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

## 2026-10-10 — PR: claude/timber-rebuild-p1 (PR link added after merge)

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
- R1-b. **l<sub>e</sub> for continuous beams and cantilevers:** the footnote 1 general rule is used (conservative). Confirm, or use the Table 3.3.3 cantilever rows for cantilevers.
- R1-c. **Cantilever deflection limit:** L = twice the cantilever length (IBC 2018 Table 1604.3 footnote h, as recalled). Confirm the footnote and the intent. *(Engineer 2026-10-10: confirmed. No change; R2.)*
- R1-d. **Pattern (skip) live loading** is not generated for continuous beams (Steel Beam does not either); an advisory is shown. Decision: add automatic patterns? *(Engineer 2026-10-10: declined; the advisory stays. R2.)*
- R1-e. **Cb at interior supports:** ticked by default for an interior support (member continues past it). Confirm.
- R1-f. **NDS equation numbers** in the calc sheets (3.3-2, 3.3-5, 3.3-6, 3.4-2, 3.4-3, 3.5-1, 3.10-2) are as recalled; verify against the printed NDS 2018.
- R1-g. **Shared project info:** `TBC_PROJ_MAP` is unchanged (Client, Job #, Designer). The new fields Project, Checked by and Date could be mapped to `projectName`, `checkedBy`, `date`. Decision?
- R1-h. **Observation (Steel Beam, not changed here):** in `Steel Beam Design - AISC 15th.html`, `evalVM(X, …)` includes the reaction couple of a node at `X` itself, so at x = L with a fixed right end it returns M = 0 instead of the end moment (fixed-pin-fixed 10 + 10 ft, w = 75 plf: 0 vs −2187.5 ft-lb at x = 20 ft). The station just before it is close, so the effect is small but unconservative. For a separate Steel Beam PR if wanted.
- R1-i. **Fixed supports** are offered (as in Steel Beam) but rare in timber; the bearing check uses the vertical reaction only.

## 2026-10-10 — PR: claude/timber-rebuild-p2 (PR link added after merge)

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

## Open items (not changed)
- O1. **Libraries.** Versions pinned 2026-10-09 (L1): `@babel/standalone@7.29.10`, `lucide@1.54.0` (unused), Tailwind Play CDN 3.4.17. Still open: *(R1: resolved; the rebuild uses only KaTeX 0.16.11 and plotly-basic 2.35.2.)*
  - Tailwind Play CDN (`cdn.tailwindcss.com`) is meant for development only.
  - esm.sh serves React 18.2.0 and lucide-react (exact versions) and is not on the CLAUDE.md host list.
- O2. **Southern Pine SS, No.1 and Stud (Table 4B)**, and the SP Ft/Fc values, were not entered because I am not confident of them. The tool asks for Manual values. Decision: supply the values from the Supplement to add.
- O3. **Table 4D timbers** (Beams & Stringers, Posts & Timbers) values are not built in, and flat use of timbers is blocked. Recommendation: add DF-L/HF/SP Table 4D values from the Supplement if timbers are needed.
- O4. **NDS 3.4.3.1(b)** permits reducing concentrated loads within d of a support by x/d. This is not applied, which is conservative. Decision: add it as an option?
- O5. **Table 3.3.3 concentrated-load rows** (e.g. a central point load: 1.80lu / 1.37lu + 3d) are not used. With point loads, the footnote-1 general rule is used, which is conservative.
- O6. **le for uniform load at lu/d > 14.3.** The reviewer said 1.84lu; the tool uses 1.63lu + 3d (the uniform-load row). Please confirm against NDS 2018 Table 3.3.3. If 1.84lu is wanted for uniform load as well, change the `else if (hasPL && luD > 14.3)` condition to `else if (luD > 14.3)`.
- O7. **Deflection:**
  - Kcr is applied to D only. There is no "sustained live load" input.
  - The total check uses Kcr·ΔD + ΔLL against L/240. This is more conservative than the IBC D + L check without creep, and it is the existing behaviour.
  - Wind is excluded from deflection.
  - The transient case set {L, Lr, S, 0.75L + 0.75(Lr or S)} is my interpretation of "include S/Lr in the live portion appropriately". Please confirm.
- O8. **Notch model.** One end-notch depth applies at both ends, on the tension face at the supports. Interior notches (≤ d/6 in the outer thirds; none in the middle third, NDS 4.4.3) and compression-side notches (NDS 3.4.3.2(c)) are not modelled.
- O9. **Uplift (0.6D + 0.6W with W negative).** The tool flags the net uplift and reminds the user about bottom-edge bracing. CL is still based on the single lateral-support setting, and bearing ignores negative reactions. Decision: add a separate bottom-edge unbraced length? *(R1: bottom-edge lateral support input added; files from the earlier version open with "same as top edge"; see R1-a.)* *(R2: old files now open with the bottom edge "at supports only".)*
- O10. **Span slider** is limited to 4–40 ft (unchanged UI). *(R1: resolved, spans are typed.)*
- O11. **Stud grade 8 in. and wider** (Table 4A directs No.3 values) is not built in; the tool asks for Manual values.
- O12. **SP 4-in.-thick, 8 in. and wider:** Table 4B permits CF = 1.1 on Fb. It is not applied (conservative).
- O13. **ASCE 7 edition:** 7-16 assumed. ASCE 7-22 Sec. 2.4.1 is believed to have the same forms for these load types. Confirm the governing edition.
- O14. **Ci is applied to timbers if ticked.** NDS 4.3.8 is written for dimension lumber. Minor; confirm.
- O15. **Not in scope:** no print button (C4 in the audit); `projectInfo.notes` has no input; the app title differs from the file name. *(R1: resolved: Print report, a Notes input, title "Timber Beam Check".)*
- P2-1. **Round-off negative moment (observation, not changed).** The bottom-edge slenderness failure ("Bottom edge (negative moment): slenderness RB = … exceeds 50") is raised when any combination has `c.bend[i].Mn > 0`. A moment of about 1e-12 ft-lb from floating-point round-off at an end support counts, so a member with no real negative moment can be flagged NG when its bottom-edge R<sub>B</sub> exceeds 50 (1 of 20,417 parity cases: 29.7 ft span, five point loads). The advisory beside it already uses a 1e-9 tolerance. Proposed fix: `c.bend[i].Mn > 1e-9` in the anchor `if (s.bot.RB > 50 && combos.some(c => c.bend[i].Mn > 0))`. Decision?

## How verified (all fixes)
- **Before values:** the original engine (lines 67-88 and 361-482 of the original file) was extracted verbatim into node and run on 8 cases.
- **After values:** `runTimberCheck` and the tables were extracted verbatim from the edited file into node and run on 20 cases. The deflection superposition was checked against three closed-form solutions.
- **Build:** the `text/babel` block transpiles with @babel/standalone 7.23.5 (preset react, module).
- **Render:** the transpiled app was rendered with React 18.2.0 `react-dom/server` in 6 state variants (analysis tab, report tab, check case, notch + point load + unbraced, timber error, manual mode). There were no React errors, and no NaN, undefined or Infinity in the output.
- **Load harness:** `loadProject` was extracted verbatim and run with stub setters on a legacy file, a malformed file and a wrong-types file.
