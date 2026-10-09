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

## Open items (not changed)
- O1. **Libraries.** These are logged OPEN per the instructions; the CDN tags were not changed:
  - `@babel/standalone` is unpinned (unpkg).
  - `lucide@latest` is unpinned and unused (icons come from `lucide-react@0.292.0` via esm.sh).
  - Tailwind Play CDN (`cdn.tailwindcss.com`) is meant for development only.
  - esm.sh serves React 18.2.0 and lucide-react.
  - Decision needed: pin the versions, or precompile and inline the app.
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
- O9. **Uplift (0.6D + 0.6W with W negative).** The tool flags the net uplift and reminds the user about bottom-edge bracing. CL is still based on the single lateral-support setting, and bearing ignores negative reactions. Decision: add a separate bottom-edge unbraced length?
- O10. **Span slider** is limited to 4–40 ft (unchanged UI).
- O11. **Stud grade 8 in. and wider** (Table 4A directs No.3 values) is not built in; the tool asks for Manual values.
- O12. **SP 4-in.-thick, 8 in. and wider:** Table 4B permits CF = 1.1 on Fb. It is not applied (conservative).
- O13. **ASCE 7 edition:** 7-16 assumed. ASCE 7-22 Sec. 2.4.1 is believed to have the same forms for these load types. Confirm the governing edition.
- O14. **Ci is applied to timbers if ticked.** NDS 4.3.8 is written for dimension lumber. Minor; confirm.
- O15. **Not in scope:** no print button (C4 in the audit); `projectInfo.notes` has no input; the app title differs from the file name.

## How verified (all fixes)
- **Before values:** the original engine (lines 67-88 and 361-482 of the original file) was extracted verbatim into node and run on 8 cases.
- **After values:** `runTimberCheck` and the tables were extracted verbatim from the edited file into node and run on 20 cases. The deflection superposition was checked against three closed-form solutions.
- **Build:** the `text/babel` block transpiles with @babel/standalone 7.23.5 (preset react, module).
- **Render:** the transpiled app was rendered with React 18.2.0 `react-dom/server` in 6 state variants (analysis tab, report tab, check case, notch + point load + unbraced, timber error, manual mode). There were no React errors, and no NaN, undefined or Infinity in the output.
- **Load harness:** `loadProject` was extracted verbatim and run with stub setters on a legacy file, a malformed file and a wrong-types file.
