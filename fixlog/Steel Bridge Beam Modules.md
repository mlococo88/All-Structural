# Fix log — Steel Bridge Beam Modules.html

Governing basis used for fixes: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024)

The embedded PlateLine app (the base64 `PL_B64` string, line 2229) was **not** changed in this PR.
Line numbers below are approximate, at the time of the fix. Long lines are quoted as the exact
substring that changed. Search for the anchor text.

## 2026-10-04 — PR: claude/fix-girderdetail (PR link added after merge)

### F1. SC3 stud pitch: the work string printed "6(d)" next to a 4d value   [display] [no result change]
- **Where:** `GM.sc.checks`, check `SC3` (≈ line 2444). Anchor: `id: 'SC3', grp: 'Detailing', title: 'Pitch limits'`
- **Re-verification:** the audit said the 4d minimum pitch is wrong and AASHTO requires 6d. **That is not a bug under the 10th Ed.** The 10th Edition (2024) reduced the minimum center-to-center stud pitch in 6.10.10.1.2 from 6d to 4d. The tool's own "10th Edition changes applied" note (≈ line 2160) says so ("Minimum pitch is 4d (was 6d)"), and published 10th Ed. change summaries confirm it. The 4d check, the `sym` text, the "Min." column and the auto-designer's 4d search floor (≈ line 4840) are therefore **left as they are**. The only bug was the label in the displayed work string, which said `6(d) = <4d value>`.
- **Problem:** the worked equation read "6(0.875) = 3.50", which is arithmetically wrong and suggests a 6d check.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.10.10.1.2 (minimum pitch 4.0 d).
- **Before:**
  ```js
  work: T`6(${f3(d)}) = ${f2(4 * d)} \le p
  ```
- **After:**
  ```js
  work: T`4(${f3(d)}) = ${f2(4 * d)} \le p
  ```
- **Check case:** default SC module, 7/8 in studs, zone "Span 1, 0 to 0.2L", p = 9 in → before: `6(0.875) = 3.50 \le p = 9.00 \le 48.00`; after: `4(0.875) = 3.50 \le p = 9.00 \le 48.00`; status pass in both. Hand check: 4 × 0.875 = 3.50 in.
- **How verified:** node run of `GM.sc.compute` + `GM.sc.checks` on the original and edited script.
- **Other copies of this code:** none known.

### F2. Stud plan drawing labelled/flagged the pitch against 6d   [display] [no result change]
- **Where:** stud plan SVG drawing (≈ lines 2492 and 2495). Anchors: `pitch ${frac(p)}″ (≥` and `'PITCH <`
- **Problem:** the drawing still used the 9th Ed. 6d limit, so a pitch that passes SC3 (4d ≤ p < 6d) was drawn with a "PITCH < 6d" warning.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.10.10.1.2.
- **Before:**
  ```js
  `pitch ${frac(p)}″ (≥ 6d = ${frac(6 * d)}″)`
  ...
  p >= 6 * d - 1e-6 ? '' : 'PITCH < 6d'
  ```
- **After:**
  ```js
  `pitch ${frac(p)}″ (≥ 4d = ${frac(4 * d)}″)`
  ...
  p >= 4 * d - 1e-6 ? '' : 'PITCH < 4d'
  ```
- **Check case:** 7/8 in studs at p = 5 in → before: label "≥ 6d = 5 1/4″", flag "PITCH < 6d"; after: label "≥ 4d = 3 1/2″", no flag (SC3 passes in both).
- **How verified:** reasoning plus syntax check (drawing code only, no computed values).
- **Other copies of this code:** none known.

### F3. Splice: blank or zero d_o on a stiffened web now gives an input error   [robustness] [no result change for valid input]
- **Where:** `gdCompute`, input validation (≈ line 1167). Anchor: `Rebar yield strength F_yr must be positive when P_rs is included.`
- **Problem:** with web basis "Stiffened", d_o blank gave k = NaN, so V_n and every web check were NaN and showed "fail". d_o = 0 gave k = ∞, C = 1 and V_n = V_p (unconservative for the web splice demand).
- **Governing provision:** n/a (input validation).
- **Before:** (no check)
- **After (new line after the F_yr check):**
  ```js
  if (S.web === 'stiffened' && !(num(S.do) > 0)) errors.push('Stiffener spacing d_o must be positive when the web shear resistance basis is "Stiffened" (select "Unstiffened" if there are no transverse stiffeners).');
  ```
- **Check case:** default splice with `sec.web = 'stiffened'` → d_o = "" before: k = NaN, φV_n = NaN, V_uw = NaN; after: input error. d_o = 0 before: k = ∞, C = 1, φV_n = 978.75 kip; after: input error.
- **How verified:** node run of `gdCompute`, before and after.
- **Other copies of this code:** none known.

### F4. Splice: apply the d_o ≤ 3D limit for a stiffened web   [calc change] [**LESS conservative** where d_o > 3D]
- **Where:** `gdCompute`, "web shear resistance of the smaller section" (≈ lines 1210–1217); display strings at ≈ 1472, 6333, 6430. Anchor: `/* ---- web shear resistance of the smaller section ---- */`
- **Problem:** the splice engine used the stiffened-web k and the tension-field equation for any d_o, even d_o > 3D. 6.10.9.1 treats an interior panel with d_o > 3D as unstiffened. The module's `webShear()` function (used by other modules) already applied this limit; the splice engine did not.
- **Important:** in the splice, φ_vV_n is a **demand** (10th Ed.: V_r = φ_vV_n is the web-splice design shear; 8th Ed.: it sets V_uw). Lowering V_n for d_o > 3D therefore **lowers the web-splice design shear**. This is code-correct but less conservative than before.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.10.9.1 (stiffened interior panel requires d_o ≤ 3D), Eq. 6.10.9.2-1; 6.13.6.1.3c.
- **Before:**
  ```js
  const tw = sm.tw, FyW = gW.Fy, k = S.web === 'stiffened' ? 5 + 5 / (num(S.do) / D) ** 2 : 5, r = ...
  ...
  if (S.web === 'stiffened') {
  ...
  } else { Vn = Cv * Vp; vnExpr = { k, C: Cv, Vp, eq: '6.10.9.2-1' }; }
  ```
- **After:**
  ```js
  const tw = sm.tw, FyW = gW.Fy, stiffW = S.web === 'stiffened' && num(S.do) <= 3 * D + 1e-9, k = stiffW ? 5 + 5 / (num(S.do) / D) ** 2 : 5, r = ...
  ...
  if (stiffW) {   // 6.10.9.1: interior panels with d_o > 3D are unstiffened
  ...
  } else { Vn = Cv * Vp; vnExpr = { k, C: Cv, Vp, eq: '6.10.9.2-1', over3D: S.web === 'stiffened' }; }
  ```
  The three display strings that print `${P.sec.web}` now append ` (d<sub>o</sub> > 3D, treated as unstiffened per 6.10.9.1)` when `R.vnExpr.over3D` is true (in the summary table: ` (> 3D: treated as unstiffened, 6.10.9.1)`).
- **Check case:** default splice (D = 60 in, t_w = 0.5625 in, 50W web, V_p = 0.58(50)(60)(0.5625) = 978.75 kip), web "Stiffened", d_o = 240 in (> 3D = 180 in):
  - before: d_o/D = 4, k = 5 + 5/16 = 5.3125, C = 0.4252, tension-field Eq. 6.10.9.3.2-2 → V_n = 534.86 kip; WS1 max ratio 0.2662, WS2 0.3553, WS4 0.4944.
  - after: k = 5, C = 0.4002, V_n = C·V_p = 391.66 kip (Eq. 6.10.9.2-1); WS1 0.1949, WS2 0.2602, WS4 0.3725.
  - d_o = 180 in (= 3D) and d_o = 60 in: unchanged (V_n = 584.73 and 903.55 kip).
  - Hand check (unstiffened): D/t_w = 106.7; 1.40√(Ek/F_y) = 1.40√(29000·5/50) = 75.4 < 106.7, so C = 1.57/(106.7²)·(29000·5/50) = 0.400; V_n = 0.400 × 978.75 = 391.7 kip.
- **How verified:** node run of `gdCompute` + `gdChecks`, before and after, for d_o = "", 0, 60, 180, 181, 240.
- **Other copies of this code:** `webShear()` in the same file already had this rule.

### F5. Net-area hole width = standard hole + 1/16 in   [calc change] [mixed: more conservative for fracture/block shear; **LESS conservative** for the 10th Ed. flange design force P_fy and for bolt checks that use it]
- **Where:**
  - `gdCompute`: hole width definition (≈ line 1222, anchor `const nhT = 2 * +P.top.nl, nhB = 2 * +P.bot.nl, dh = bolt.dh`); flange `An` (≈ 1224); `pfyOf` (≈ 1243); block shear `bs` and every `blk.push` Atn width (≈ 1297–1312); splice plate `An_o`/`An_i` (≈ 1315); web plate `Avn` (≈ 1342).
  - Cross-frame module: hole width (≈ line 2642, anchor `Fug = GD_GR[p.gG].Fu, dh = bolt.dh`) and angle `m.An` (≈ 2649).
  - Display strings: ≈ 1497 (`A_vn = 2(h − n_r`), 2068 (manual), 2667 (cross-frame note), 6331 and 6345 (report).
- **Problem:** net areas deducted the standard hole diameter d_h (15/16 in for 7/8 in bolts) instead of d_h + 1/16 in. Bearing clear distances L_c, edge distances and drawings still correctly use d_h and were not changed.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.8.3 (width of each standard hole taken as the nominal hole diameter plus 1/16 in), used by 6.8.2.1 / 6.13.5.2 (net fracture), 6.13.4 (block shear A_vn, A_tn), 6.13.5.3 (A_vn) and 6.13.6.1.3 (A_e for P_fy).
- **Before (examples, all occurrences in the listed lines):**
  ```js
  const nhT = 2 * +P.top.nl, nhB = 2 * +P.bot.nl, dh = bolt.dh;
  f.An = f.Ag - f.nh * dh * f.t;
  An = Ag - nh * dh * t,
  Anv = planes * (Lv - (nr - 0.5) * dh) * t           // and dh in every block-shear Atn width
  Math.min(Ao - 2 * nl * dh * to, 0.85 * Ao), An_i = inner ? Math.min(Ai - 2 * nl * dh * ti,
  Avn = 2 * (hw - nrw * dh) * twp;
  Fug = GD_GR[p.gG].Fu, dh = bolt.dh;
  m.An = m.A - dh * m.t;
  ```
- **After:**
  ```js
  const nhT = 2 * +P.top.nl, nhB = 2 * +P.bot.nl, dh = bolt.dh, dn = dh + 0.0625;   // dn: hole width deducted for net area, standard hole + 1/16 in (6.8.3)
  f.An = f.Ag - f.nh * dn * f.t;
  An = Ag - nh * dn * t,
  Anv = planes * (Lv - (nr - 0.5) * dn) * t           // and dn in every block-shear Atn width
  Math.min(Ao - 2 * nl * dn * to, 0.85 * Ao), An_i = inner ? Math.min(Ai - 2 * nl * dn * ti,
  Avn = 2 * (hw - nrw * dn) * twp;
  Fug = GD_GR[p.gG].Fu, dh = bolt.dh, dn = dh + 0.0625;   // dn: net-area hole width (6.8.3)
  m.An = m.A - dn * m.t;
  ```
  Display: `holes × d<sub>h</sub> × t` → `holes × (d<sub>h</sub> + 1/16) × t` and `${f3(R.bolt.dh)}` → `${f3(R.bolt.dh + 0.0625)}` in the A_n lines; `A_vn = 2(h − n_r d_h)t` → `A_vn = 2(h − n_r(d_h + 1/16))t`; manual "deducts the nominal hole diameter" → "deducts the standard hole diameter plus 1/16 in"; cross-frame note "one standard hole (x in)" → "one standard hole plus 1/16 in (x in, 6.8.3)".
- **Check case:** default splice (7/8 in A325, 50W, F_y = 50, F_u = 70 ksi; top flange 16 × 3/4 in, 2 bolt lines per side so 4 holes; top outer plate 16 × 1/2 in; web plates 2 − 54 × 7/16 in with 17 rows):
  - Top flange A_n: before 12 − 4(0.9375)(0.75) = 9.1875 in²; after 12 − 4(1.000)(0.75) = 9.000 in².
  - A_e = (0.80·70)/(0.95·50)·A_n = 1.1789·A_n: before 10.832 in²; after 10.611 in² (both < A_g = 12).
  - P_fy = 50·A_e: before 541.58 kip; after 530.53 kip (**−2.0 %, less conservative bolt demand**). TF1 (bolt shear) ratio 0.8726 → 0.8548; TF2 0.5619 → 0.5504; BF1 0.7853 → 0.7693; BF2 0.4113 → 0.4029.
  - Top outer plate: A_n 6.125 → 6.000 in², φ_uF_uA_n = 0.80(70)A_n: 343.0 → 336.0 kip; TF4 max ratio 0.8364 → 0.8421.
  - Block shear, top outer plate edge strips: A_vn 5.406 → 5.250 in², A_tn 1.531 → 1.500 in², R_r 261.35 → 254.52 kip; TF5 max ratio 0.9581 → 0.9650.
  - Web plates: A_vn = 2(54 − 17·d)(0.4375): before 33.305 in² (V_r fracture 1081.74 kip); after 32.375 in² (1051.54 kip); WS4 ratio 0.3621 → 0.3725. MT1 0.8827 → 0.9011 (smaller flange couple).
  - Cross-frame default, L5×5×3/8 (A = 3.609 in²), A36 (F_u = 58), 2 bolts (U = 0.5371): A_n 3.2578 → 3.2344 in²; φP_u = 0.80(58)(A_n)(U): 81.18 → 80.60 kip.
  - No pass/fail status changed in the default splice or cross-frame example.
- **How verified:** node run of `gdCompute`/`gdChecks` and `GM.cf.compute`/`checks`, before and after, plus the hand numbers above.
- **Other copies of this code:** the embedded PlateLine app was not checked or changed for net areas (preliminary sizing only).

### F6. One-bolt cases now give clear input errors   [robustness] [no result change for valid input]
- **Where:** `gdCompute` validation (≈ line 1168, anchor as F3); cross-frame validation (≈ line 2590, anchor `Bolts per member end must be a whole number.`).
- **Problem:** a web splice with 1 row × 1 column gave I_p = 0 and NaN bolt forces in WS1–WS3. A cross-frame with 1 bolt per end gave L = 0, U = 0 and P_u = 0, which read as a strength failure.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.13.1 (connections other than lacing etc. contain at least two bolts).
- **Before:**
  ```js
  const C = p.conn, n = +C.n; if (!(Number.isInteger(n) && n >= 1)) errors.push('Bolts per member end must be a whole number.');
  ```
- **After:**
  ```js
  const C = p.conn, n = +C.n; if (!(Number.isInteger(n) && n >= 1)) errors.push('Bolts per member end must be a whole number.'); else if (n < 2) errors.push('Bolts per member end must be at least 2 (AASHTO LRFD 6.13.1; with one bolt the shear lag factor U is undefined).');
  ```
  and, in the splice validation:
  ```js
  if (Number.isInteger(+P.web.nr) && Number.isInteger(+P.web.nc) && +P.web.nr * +P.web.nc < 2) errors.push('Web splice: at least two bolts are needed on each side of the splice (rows × columns ≥ 2); a one-bolt group has no polar moment of inertia.');
  ```
- **Check case:** splice web nr = nc = 1 → before: all combinations R = NaN; after: input error. nr = 1, nc = 2 still computes (StrP R = 652.77 kip, unchanged). Cross-frame n = 1 → before: U = 0, P_ur = 0; after: input error. n = 2 unchanged apart from F5.
- **How verified:** node run, before and after. The auto-designers already start at 2 bolts.
- **Other copies of this code:** none known.

### F7. Shear-connector stud diameter selector now lists 1 in   [bug fix] [no result change]
- **Where:** `GM.sc` pane `sc_gen` (≈ line 2396). Anchor: `fld('Stud diameter', 'sc.d'`
- **Problem:** the owner standard (`std.studD`) offers 1 in and the auto-designer copies it into `sc.d`, but the module's own selector listed only 3/4 and 7/8 in, so the select showed a value not in its list. The engine already handled d = 1 (`d = +p.d`).
- **Before:**
  ```js
  { options: [['0.75', '3/4 in'], ['0.875', '7/8 in']] })}${fld('Stud height h'
  ```
- **After:**
  ```js
  { options: [['0.75', '3/4 in'], ['0.875', '7/8 in'], ['1', '1 in']] })}${fld('Stud height h'
  ```
- **Check case:** `sc.d = '1'` → A_sc = 0.7854 in², Z_r = 7.0A_sc = 5.498 kip, Q_n(9th) = 47.12 kip, no errors (same before and after; only the selector changed).
- **How verified:** node run.
- **Other copies of this code:** none known.

## Open items (not changed)
- O1. **Auto-designer strength loop stops at 6d.** The stud strength-tightening loop (≈ line 4846, `D(z.p) > Math.ceil(6 * d)`) still uses the 9th Ed. 6d floor, while SC3 and the pitch search use 4d (10th Ed.). This is conservative (it never picks a pitch the code forbids) but may leave SC2 failing where a 4d–6d pitch would pass. — Not changed (auto-design behaviour) — Decide whether to lower it to `Math.ceil(4 * d)`.
- O2. **Hole width for 1-1/8 in bolts.** F5 uses d_h + 1/16 in, per the 10th Ed. 6.8.3 wording supplied for this task. For 7/8 and 1 in bolts this equals d + 1/8 in. For 1-1/8 in bolts (d_h = 1.25 in) it gives 1.3125 in, while the older wording "bolt diameter + 0.125 in" gives 1.25 in. — Confirm the 10th Ed. wording; if it is "bolt + 1/8 in", change `dn` to `bolt.d + 0.125` (1/16 in less conservative for 1-1/8 in bolts only).
- O3. **Q_n default is the 9th Ed. equation** (`Qn = Qn10 > 0 ? Qn10 : Qn9`). The 10th Ed. Q_n equation (6.10.10.4.3) is **not implemented**; the tool only accepts a user-entered 10th Ed. value. — Not changed: no implemented 10th Ed. option to make the default, and I am not certain of the exact 10th Ed. equation. — Provide the 10th Ed. Eq. 6.10.10.4.3-1 text so it can be coded; until then, enter Q_n on the Deck and studs tab.
- O4. **E_c unit weight (0.145 vs 0.150 kcf).** All modules use one w_c (default 0.150) for both E_c and deck dead load. 5.4.2.4 / Table 3.5.1-1 use the plain-concrete unit weight (0.145 kcf for f′c ≤ 5 ksi) for E_c; with 0.150, n is about 7 % low (6.80 vs 7.27 at f′c = 4 ksi). — Needs a decision: separate inputs for E_c and DL unit weight (new optional saved field, default reproducing today's value), or change the default.
- O5. **L_p = 1.1 r_t √(E/F_yc)** (labelled 10th Ed.; the 9th Ed. used 1.0 r_t). I could not confirm the 10th Ed. text. Note also that the 10th Ed. reportedly replaced the C_b equation; the tool was not checked for that. — Confirm the 10th Ed. Eq. 6.10.8.2.3-4 / A6.3.3-4 coefficient and the C_b change.
- O6. **Splice plate compression φ_c = 0.90** (`PHI.c`), versus φ_c = 0.95 in 6.5.4.2 and in this file's bearing-stiffener and cross-frame modules. Conservative. — Decide whether the splice should use 0.95 (would be less conservative).
- O7. **`crack: '15'` migration** (≈ line 4157): an old project with `crack = '15'` and no `crackV` is switched once to `'none'`. This is deliberate: '15' was the former default, it is not per 6.10.1.5, and an old saved '15' cannot be told apart from the old default. Not clearly a bug, so not changed. — If wanted: show a one-time notice when the migration happens, or keep '15' for projects that explicitly chose it (not possible to detect from saved data).
- O8. **Splice report "V_r = 1.0(C)(V_p)" line** (≈ line 6349) prints C·V_p even when the tension-field equation is used, so the shown product does not equal the shown V_r for a stiffened web. Display only. — Fix the displayed expression in a later PR.
- O9. Not addressed here (from the review, out of scope for this PR): GS uses max permanent-load factors only; Service II omits f_ℓ/2; bearing-stiffener hybrid strip double reduction; rolled-diaphragm hard-coded F_ub = 120; postMessage origin checks; PlateLine items (DC1-only noncompact check, 9th Ed. reference list, unguarded profile JSON.parse).

## 2026-10-04 — PR: claude/step1-group2 (PR link added after merge)

### F8. "← All tools" link + shared project info (HANDOFF.md §4.1)   [feature (no result change)]

- **Type:** feature (no result change). No formulas, factors, units, code references, storage keys or saved-data formats were changed.
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, hidden in print), and two buttons, **Use shared project info** and **Share project info**, in the Calculation header (Project tab). Share publishes `bridgeSuite.v1.projectMeta` (`_schema:"bridge-project-meta"`) with the tool's own fields, and `""` for fields it lacks. Use reads it with `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm dialog listing each field that will be overwritten (old → new), writes only this tool's fields, never blanks a field when the shared value is blank, and writes through the tool's normal path (sets the input and dispatches a bubbling `input` event, so the tool's own handler updates its state and autosaves).
- **Field mapping (shared `fields` key → this tool's input):**

| shared field | this tool |
|---|---|
| `projectName` | `#f_meta_name` |
| `bridgeId` | — (not in this tool; shared as `""`, ignored on Use) |
| `jobNo` | `#f_meta_projNo` |
| `client` | — (not in this tool; shared as `""`, ignored on Use) |
| `location` | — (not in this tool; shared as `""`, ignored on Use) |
| `preparedBy` | `#f_meta_compBy` |
| `checkedBy` | `#f_meta_chkBy` |
| `date` | `#f_meta_compDate` |

- **Governing provision:** none (not a calculation change). Spec: HANDOFF.md §4.1 (channel) and §5 (helper).
- **Check case:** Share with Project name "Route 9 over Mill Brook", Job no. "J-4471", Prepared by "M. Lococo", Checked by "A. Checker", Date "2026-10-04"; then Use in another tool → the mapped fields show those values after one confirm; unmapped fields are unchanged. Calculation results before/after: identical (no calculation code touched).

**Edit 1 — link.** Where: page `<header>` (after the `.brand` block; anchor `<div class="hdr-spacer"></div>\n  <div class="hdr-group"><button type="button" class="btn" id="btn-designall"`), outer page only; the PlateLine iframe/base64 is not touched.
- Before:
```html
  <div class="hdr-spacer"></div>
  <div class="hdr-group"><button type="button" class="btn" id="btn-designall"
```
- After:
```html
  <a class="bx-all-tools" href="tools.html" target="_top" title="Open the list of all tools">&larr; All tools</a>
  <div class="hdr-spacer"></div>
  <div class="hdr-group"><button type="button" class="btn" id="btn-designall"
```

**Edit 2 — buttons.** Where: `buildSidebar()` → `project` pane → "Calculation header" (`sec-meta`); anchor `${fld('Checked date', 'meta.chkDate', '', 'text')}</div></div>`.
- Before:
```js
<div class="pair">${fld('Checked by', 'meta.chkBy', '', 'text')}${fld('Checked date', 'meta.chkDate', '', 'text')}</div></div>
```
- After:
```js
<div class="pair">${fld('Checked by', 'meta.chkBy', '', 'text')}${fld('Checked date', 'meta.chkDate', '', 'text')}</div>
        <div class="proj-row" style="grid-template-columns: 1fr 1fr"><button type="button" id="bx-pm-use" class="proj-btn" title="Fill this header from the project info shared by another tool">Use shared project info</button><button type="button" id="bx-pm-share" class="proj-btn" title="Share this header's project info with the other tools">Share project info</button></div></div>
```

**Edit 3 — CSS.** Where: end of the first `<style>` block in `<head>` (inserted just before its `</style>`).
- Before: `</style>`
- After:
```css
/* "All tools" link (outer page) */
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
  var TOOL='Steel Bridge Beam Modules', FILE='Steel Bridge Beam Modules.html';
  var MAP={ projectName:'#f_meta_name', bridgeId:'', jobNo:'#f_meta_projNo', client:'', location:'', preparedBy:'#f_meta_compBy', checkedBy:'#f_meta_chkBy', date:'#f_meta_compDate' }; // shared field -> this tool's input ('' = this tool has no such field)
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

- **How verified:**
  - `node --check` on every plain inline `<script>` of the old and new file: no failures in either (2 new scripts per file: helper + glue). The tool has no `text/babel` blocks.
  - jsdom load with CDN scripts not fetched: the same load errors as the original file (none new); `window.BridgeXfer` exists; the link has `href="tools.html" target="_top"`.
  - Share → Use run in jsdom between all six tools of this PR (30 pairs) with the localStorage entry copied across: every pair passed. The payload had `_schema:"bridge-project-meta"`, `schemaVersion:1`, all 8 `fields` keys, and `producedAt` equal to `bridgeSuite.v1.projectMeta.updatedAt`. Fields were written through the tool's own input handler and reached its saved state/autosave. A blank shared field never blanked a tool field; an empty channel and a wrong `_schema` gave a message and changed nothing.
  - Diff check: at most one line is removed, the line replaced at the button anchor where that anchor is inside a JS template string; everything else is additions. No calculation code, storage key or saved-data format was touched.
- **Other copies:** the BridgeXfer v1 helper is duplicated verbatim in every tool that uses it (CLAUDE.md §3; list in the PR). The glue block is the same in each tool of this PR except `TOOL`/`FILE` and the field map.
- **Open items:** none.
