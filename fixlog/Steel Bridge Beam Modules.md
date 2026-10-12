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


## 2026-10-04 — PR: claude/conn-lldf-girderdetail (PR link added after merge)

### H1. Pull distribution factors from LL & DL Distribution (lldf.html)   [feature: hand-off (no result change)]
- **Type:** feature: hand-off (no result change). Spec: HANDOFF.md §4.3 (channel `bridgeSuite.v1.lldf`, `_schema:"bridge-lldf-factors"`, `schemaVersion` 1, receiver id `girderdetail`).
- **Design:** the LLDF and DLs module computes its own factors from the bridge in Preliminary sizing, and those still feed Preliminary sizing (unchanged). The tool already has an override path for the analysis: Structural analysis → "Live load distribution factors" = "Enter manually for this girder" (`sa.dfSrc = 'manual'`, values in `sa.dfm.<region>.{gM,gV,fM,fV}`). The pull fills exactly those existing inputs for the girder being analyzed and sets the select to manual; that select is the on/off toggle (default "From the LLDF and DLs module"; it only becomes manual when the user confirms a pull). No new calculation path was added; the analysis uses the factors exactly as if they were typed in.
- **Where:**
  1. `GM.df.panes`, Bridge tab. Anchor: `<div class="sec-body one-col" id="sec-dfb">${src}${kv}`
     - Before: `<div class="sec-body one-col" id="sec-dfb">${src}${kv}<button type="button" class="proj-btn" data-dfpl="1"`
     - After: `<div class="sec-body one-col" id="sec-dfb">${src}${kv}${gdLldfDfNote()}<button type="button" class="proj-btn" data-dfpl="1"`
  2. `GM.sa.panes`, section "Live load: distribution factors and impact". Anchor: `['manual', 'Enter manually for this girder']] })}`
     - Before: `['manual', 'Enter manually for this girder']] })}</div>`
     - After: `['manual', 'Enter manually for this girder']] })}${gdLldfUi()}</div>`
  3. `GM.sa.echo` (report input echo). Anchor: `['Loads per girder', \`DC1 deck ${f3(R.wDeck)} klf + steel; DC2 ${f3(R.wDC2)}; DW ${f3(R.wDW)}; PL ${f3(R.wPL)} klf\`]]`
     - Before: `... PL ${f3(R.wPL)} klf\`]] }; },`
     - After: `... PL ${f3(R.wPL)} klf\`]].concat(gdLldfEcho(R)) }; },`  (adds one row only when an import exists AND manual factors are in use)
  4. New block inserted right after the end of `GM.sa = { ... };` (anchor: the line `inbox() { return null }, noInbox: 'This module takes the bridge from Preliminary sizing and the girder loads and factors from the LLDF and DLs module; nothing needs to be imported.'` followed by `};`) and before `/* stresses by construction stage at every node (tension +) */`. Exact code:
     ```js
/* ---------- Hand-off: "Pull from LL & DL" (HANDOFF.md §4.3, channel bridgeSuite.v1.lldf, _schema bridge-lldf-factors) ----------
   Fills the EXISTING manual distribution factor inputs of the Structural analysis module (sa.dfSrc = 'manual', sa.dfm)
   for the girder being analyzed, from the factors published by lldf.html. Nothing changes until the user confirms the
   dialog; nothing is applied on page load. The source is kept in the new optional field P.sa.dfImport. No formula is
   changed: the analysis uses the manual factors exactly as it does when they are typed in. */
const GD_LLDF = { ch: 'lldf', schema: 'bridge-lldf-factors', ver: 1, rx: 'girderdetail' };
let GD_LLDF_PENDING = null;
const gdLldfProj = pl => { const p = pl && pl.project; return p && typeof p === 'object' ? String(p.name || '') : String(p || ''); };
const gdLldfWhen = t => { const d = new Date(t); return t && isFinite(d) ? d.toLocaleString() : 'time unknown'; };
function gdLldfIsNew() { try { return !!(window.BridgeXfer && BridgeXfer.isNew(GD_LLDF.ch, GD_LLDF.rx)); } catch (e) { return false; } }
function gdLldfSrcHtml() {
  const x = P && P.sa && P.sa.dfImport; if (!x) return '';
  const inUse = P.sa.dfSrc === 'manual', gNow = Math.round(nm(P.sa.girder)), ok = inUse && gNow === x.girder;
  return `<div class="df-src${ok ? '' : ' df-lock'}"><b>Source: ${esc(x.producer)}</b> (${esc(x.producerFile)}), produced ${esc(gdLldfWhen(x.producedAt))}${x.project ? `, project "${esc(x.project)}"` : ''}. Pulled ${esc(gdLldfWhen(x.adoptedAt))} for G${x.girder}, ${esc(x.basisLbl)}.${!inUse ? ' <b>Not in use:</b> the factors are set to come from the LLDF and DLs module.' : gNow !== x.girder ? ` <b>Check:</b> G${gNow} is now analyzed, but the manual factors were pulled for G${x.girder}. Pull again for this girder.` : ''}</div>`;
}
function gdLldfUi() {
  return `<div class="full" id="gd-lldf-box"><div class="fa-imp"><button type="button" class="proj-btn" data-gdlldf="pull" title="Use the distribution factors published by LL &amp; DL Distribution (lldf.html) as the manual factors for this girder">Pull from LL &amp; DL <span id="gd-lldf-new" class="badge info"${gdLldfIsNew() ? '' : ' hidden'}>new data</span></button><button type="button" class="proj-btn" data-gdlldf="file">Import hand-off (JSON)</button></div><input type="file" id="gd-lldf-file" accept=".json,application/json" hidden>
    <div id="gd-lldf-src">${gdLldfSrcHtml()}</div><p class="note">Pull fills the manual distribution factors below for the girder being analyzed, from the factors that LL &amp; DL Distribution (lldf.html) publishes. You see what changes and confirm first.</p></div>`;
}
function gdLldfDfNote() {
  const x = P && P.sa && P.sa.dfImport; if (!x) return '';
  return `<p class="note">Factors from ${esc(x.producer)} (produced ${esc(gdLldfWhen(x.producedAt))}) were pulled into Structural analysis as the manual factors for G${x.girder}${P.sa.dfSrc === 'manual' ? '' : ' (not in use there now)'}. The factors on this page are computed here and still feed Preliminary sizing.</p>`;
}
function gdLldfEcho(R) {
  const x = P && P.sa && P.sa.dfImport; if (!x || !R.man) return [];
  return [['Live load distribution factors', esc(`Manual, pulled from ${x.producer} (${x.producerFile}), produced ${gdLldfWhen(x.producedAt)}${x.project ? `, project "${x.project}"` : ''}; for G${x.girder}, ${x.basisLbl}${x.girder !== R.j + 1 ? `. NOTE: G${R.j + 1} is analyzed` : ''}. Lanes per girder; multiple presence and skew included by LL & DL; fatigue factors are one lane ÷ 1.2.`)]];
}
function gdLldfPaint() { const n = document.getElementById('gd-lldf-new'); if (n) n.hidden = !gdLldfIsNew(); const s = document.getElementById('gd-lldf-src'); if (s) s.innerHTML = gdLldfSrcHtml(); }
/* Map a payload onto this bridge and girder. basis: 'type' = lldf's interior/exterior envelope for the analyzed girder's type;
   'beam' = lldf's own beam with the same number (governing.byBeam). Returns the rows that would change, warnings and errors. */
function gdLldfPlan(pl, basis) {
  const err = [], warn = [], rows = [], unused = [], b = P.df && P.df.bridge;
  if (!b || !b.ok || !Array.isArray(b.regions)) return { err: ['Define the complete bridge in Preliminary sizing first; the factors are mapped onto its spans and supports.'], warn, rows, unused };
  const nb = b.nb, j = Math.round(nm(P.sa.girder)) - 1;
  if (!(j >= 0 && j < nb)) return { err: [`Select a girder between G1 and G${nb} first.`], warn, rows, unused };
  const ext = j === 0 || j === nb - 1, tKey = ext ? 'exterior' : 'interior';
  // Units: bridge-lldf-factors v1 factors are dimensionless, in lanes per girder (HANDOFF.md §4.3). Anything else is refused.
  if (pl.units && pl.units.df != null && !/lanes? per girder/i.test(String(pl.units.df))) err.push(`Unsupported distribution factor unit "${pl.units.df}". This tool takes lanes per girder.`);
  const ls = Array.isArray(pl.spans) ? pl.spans : [];
  if (!ls.length || !ls.every(v => typeof v === 'number' && isFinite(v) && v > 0)) err.push('The hand-off has no valid span lengths (positive numbers, ft).');
  else if (ls.length !== b.spans.length) err.push(`Span count differs: LL & DL has ${ls.length} span${ls.length > 1 ? 's' : ''}, this bridge has ${b.spans.length}. Pull factors only for the same bridge.`);
  else if (ls.some((L, i) => Math.abs(L - b.spans[i]) > 0.5)) warn.push(`Span lengths differ: LL & DL ${ls.map(f2).join(' + ')} ft, this bridge ${b.spans.map(f2).join(' + ')} ft.`);
  const plNb = Number(pl.Nb);
  if (pl.Nb != null && plNb !== nb) warn.push(`Number of girders differs: LL & DL ${esc(pl.Nb)}, this bridge ${nb}.`);
  if (basis === 'beam' && plNb !== nb) err.push('"Same beam number" needs the same number of girders in both tools. Use the interior / exterior envelope.');
  if (pl.bridgeType && pl.bridgeType !== 'a') warn.push(`LL & DL computed the factors for cross-section type (${esc(pl.bridgeType)}); this tool designs steel I-girders, type (a).`);
  const skM = b.skews && b.skews.length ? Math.max(...b.skews.map(Math.abs)) : 0;
  if (pl.skew != null && (typeof pl.skew !== 'number' || !isFinite(pl.skew))) err.push('The hand-off skew is not a number.');
  else if (pl.skew != null && Math.abs(Math.abs(pl.skew) - skM) > 0.5) warn.push(`Skew differs: LL & DL ${f0(pl.skew)}°, this bridge up to ${f0(skM)}°.`);
  const pick = g => !g || typeof g !== 'object' ? null : basis === 'beam' ? (g.byBeam || {})[String(j + 1)] || null : g[tKey] || null;
  const pos = pick(pl.governing), neg = pick(pl.governingNeg);
  if (!pos) err.push(`The hand-off has no positive-region factors for ${basis === 'beam' ? `beam ${j + 1}` : `the ${tKey} girder`}.`);
  const num = (o, k, lbl, req) => { const v = o ? o[k] : undefined;
    if (v == null) { if (req) err.push(`${lbl} is missing.`); return null; }
    if (typeof v !== 'number' || !isFinite(v) || !(v > 0)) { err.push(`${lbl} is not a positive number (${esc(v)}).`); return null; } return v; };
  let DF = null; try { DF = GM.df.compute(P.df); if (DF.errors.length) DF = null; } catch (e) { DF = null; }
  const man = P.sa.dfSrc === 'manual', cur = (rid, k, mk) => { const v = nm(((P.sa.dfm || {})[rid] || {})[k]); if (man && v > 0) return { v, from: 'manual' };
    const rg = DF && DF.regions.find(r => r.id === rid), m = rg && rg.members[j]; return { v: m ? m[mk] : null, from: 'LLDF and DLs module' }; };
  const keep = (rg, k, lbl, mk) => { const c = cur(rg.id, k, mk), v = nm(((P.sa.dfm || {})[rg.id] || {})[k]); rows.push({ rid: rg.id, k, lbl: `${rg.label}: ${lbl}`, old: c.v, nu: null, keep: v > 0 ? `unchanged (${f3(v)}, manual)` : 'unchanged (from the LLDF and DLs module)' }); };
  const spans = b.regions.filter(rg => rg.kind === 'span'), piers = b.regions.filter(rg => rg.kind !== 'span');
  // Per span: governingBySpan[i] (that span alone, L = span i) when the payload has it for every span; otherwise the all-span envelope `governing`.
  const bySpan = Array.isArray(pl.governingBySpan) && pl.governingBySpan.length === b.spans.length && spans.every(rg => pick(pl.governingBySpan[rg.i])) ? pl.governingBySpan : null;
  if (pos) { let noFat = false;
    spans.forEach(rg => { const o = bySpan ? pick(bySpan[rg.i]) : pos, sl = bySpan ? ` (span ${rg.i + 1})` : '';
      const F = [['gM', num(o, 'gM', `Moment factor${sl}`, true), 'g moment', 'gM'], ['gV', num(o, 'gV', `Shear factor${sl}`, true), 'g shear', 'gV'],
        ['fM', num(o, 'fatM', `Fatigue moment factor${sl}`, false), 'g fatigue moment', 'fatM'], ['fV', num(o, 'fatV', `Fatigue shear factor${sl}`, false), 'g fatigue shear', 'fatV']];
      if (o.fatM == null || o.fatV == null) noFat = true;
      F.forEach(([k, v, lbl, mk]) => v == null ? keep(rg, k, lbl, mk) : rows.push({ rid: rg.id, k, lbl: `${rg.label}: ${lbl}`, old: cur(rg.id, k, mk).v, nu: v })); });
    if (noFat) warn.push('The hand-off has no fatigue factor for this girder; those fields are left unchanged.'); }
  if (piers.length) {
    if (!neg) { warn.push('The hand-off has no negative-moment factors (LL & DL was set up with one span?). The pier factors are left unchanged.'); piers.forEach(rg => keep(rg, 'gM', 'g moment', 'gM')); }
    else { const g = num(neg, 'gM', 'Moment factor (negative region)', true); piers.forEach(rg => g == null ? keep(rg, 'gM', 'g moment', 'gM') : rows.push({ rid: rg.id, k: 'gM', lbl: `${rg.label}: g moment`, old: cur(rg.id, 'gM', 'gM').v, nu: g })); } }
  else if (neg) unused.push('Negative-moment factors (this bridge has no interior supports)');
  if (neg) unused.push('Negative-region shear and fatigue factors (this module uses the span factors for shear and fatigue)');
  unused.push('Factors of the other girders, design lanes, K_g and the per-member table (shown in LL & DL)');
  return { err: [...new Set(err)], warn, rows, unused, j, ext, tKey, basis, bySpan: !!bySpan, basisLbl: `${basis === 'beam' ? `LL & DL beam ${j + 1}` : `LL & DL ${tKey} envelope`}, ${bySpan ? 'per span' : 'all-span envelope'}` };
}
function gdLldfDialog(basis) {
  const pl = GD_LLDF_PENDING && GD_LLDF_PENDING.pl; if (!pl) return; GD_LLDF_PENDING.basis = basis;
  const plan = gdLldfPlan(pl, basis), notes = [].concat(Array.isArray(pl.notes) ? pl.notes : [], pl.note ? [pl.note] : []), sameNb = Number(pl.Nb) === (P.df.bridge && P.df.bridge.nb);
  const li = a => a.length ? `<ul class="dlist">${a.map(s => `<li>${s}</li>`).join('')}</ul>` : '';
  const tb = plan.rows.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th>Field (Structural analysis, manual factors)</th><th class="right">Now in use</th><th class="right">After pull</th></tr></thead><tbody>${plan.rows.map(r => `<tr><td class="lbl">${esc(r.lbl)}</td><td class="val">${r.old == null ? '—' : f3(r.old)}</td><td class="val">${r.nu == null ? esc(r.keep) : `<b>${f3(r.nu)}</b>`}</td></tr>`).join('')}</tbody></table></div>` : '';
  daModal(`<h3>Pull from LL &amp; DL Distribution</h3>
    <p><b>From:</b> ${esc(pl.producer || 'LL & DL Distribution')} (${esc(pl.producerFile || 'lldf.html')}), produced ${esc(gdLldfWhen(pl.producedAt))}${gdLldfProj(pl) ? `, project "${esc(gdLldfProj(pl))}"` : ''}; via ${esc(GD_LLDF_PENDING.via)}.</p>
    <p><b>For:</b> G${plan.j != null ? plan.j + 1 : '?'}${plan.j != null ? ` (${plan.ext ? 'exterior' : 'interior'})` : ''}, the girder selected in Structural analysis.</p>
    <fieldset style="border:0;padding:0;margin:6px 0"><legend><b>Which LL &amp; DL factors to use</b></legend>
      <label style="display:block"><input type="radio" name="gdlldf-basis" value="type"${basis === 'type' ? ' checked' : ''}> Envelope of LL &amp; DL's ${plan.tKey || 'interior / exterior'} girders (default; does not depend on the girder numbering)</label>
      <label style="display:block"><input type="radio" name="gdlldf-basis" value="beam"${basis === 'beam' ? ' checked' : ''}${sameNb ? '' : ' disabled'}> LL &amp; DL's beam with the same number${sameNb ? '' : ' (needs the same number of girders)'}</label></fieldset>
    <p class="note-p">Basis: lanes per girder; LL &amp; DL includes multiple presence and the skew corrections; the fatigue factors are the one-lane factor ÷ 1.2. ${plan.bySpan ? 'Each span gets LL &amp; DL\'s factors for that span (positive moment and shear, L = span); every pier gets LL &amp; DL\'s envelope over all interior supports (negative moment).' : 'This payload has no per-span factors, so every span gets LL &amp; DL\'s envelope over all spans (positive moment and shear), and every pier its envelope over all interior supports (negative moment).'} This sets "Live load distribution factors" to "Enter manually for this girder".</p>
    ${plan.err.length ? `<div class="alert fail"><b>Cannot pull:</b>${li(plan.err)}</div>` : ''}${plan.warn.length ? `<div class="alert warn"><b>Check:</b>${li(plan.warn)}</div>` : ''}
    ${tb}${plan.unused.length ? `<p class="note-p"><b>Not used:</b> ${plan.unused.map(esc).join('; ')}.</p>` : ''}${notes.length ? `<p class="note-p"><b>Notes from LL &amp; DL:</b> ${notes.map(esc).join(' ')}</p>` : ''}
    <div class="ctl-row"><button type="button" class="proj-btn proj-btn-primary" data-gdlldf="apply"${plan.err.length ? ' disabled' : ''}>Apply these factors</button><button type="button" class="proj-btn" data-gdlldf="cancel">Cancel</button></div>`);
}
function gdLldfOffer(pl, via) { GD_LLDF_PENDING = { pl, via }; gdLldfDialog('type'); }
function gdLldfApply() {
  const pend = GD_LLDF_PENDING; if (!pend) return; const pl = pend.pl, plan = gdLldfPlan(pl, pend.basis || 'type'); if (plan.err.length) { gdLldfDialog(pend.basis || 'type'); return; }
  const dfm = P.sa.dfm || (P.sa.dfm = {});
  plan.rows.forEach(r => { if (r.nu != null) (dfm[r.rid] || (dfm[r.rid] = {}))[r.k] = r.nu; });
  P.sa.dfSrc = 'manual';
  P.sa.dfImport = { producer: String(pl.producer || 'LL & DL Distribution'), producerFile: String(pl.producerFile || 'lldf.html'), producedAt: String(pl.producedAt || ''), project: gdLldfProj(pl),
    adoptedAt: new Date().toISOString(), girder: plan.j + 1, basis: plan.basis, basisLbl: plan.basisLbl, fields: plan.rows.filter(r => r.nu != null).map(r => `${r.rid}.${r.k}`) };
  try { if (window.BridgeXfer) BridgeXfer.markAdopted(GD_LLDF.ch, GD_LLDF.rx, pl.producedAt); } catch (e) {}
  GD_LLDF_PENDING = null; const md = document.getElementById('da-modal'); if (md) md.hidden = true;
  gmBuildPanes('sa'); gmBuildPanes('df'); fillInputs(); recompute(); autosave(); flash(`Distribution factors pulled from LL & DL for G${plan.j + 1}.`);
}
function gdLldfPull() {
  if (!window.BridgeXfer) { alert('The hand-off helper is not available in this browser.'); return; }
  const r = BridgeXfer.read(GD_LLDF.ch, GD_LLDF.schema, GD_LLDF.ver);
  if (r.error) { alert(r.empty ? 'Nothing has been published yet. In LL & DL Distribution (lldf.html) click "Send DFs to Design Apps", or use "Import hand-off (JSON)".' : `Cannot use the LL & DL hand-off: ${r.error}`); return; }
  gdLldfOffer(r.payload, 'shared browser storage');
}
document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-gdlldf]'); if (!t) return; const a = t.dataset.gdlldf;
  if (a === 'pull') gdLldfPull(); else if (a === 'file') { const f = document.getElementById('gd-lldf-file'); if (f) { f.value = ''; f.click(); } }
  else if (a === 'apply') gdLldfApply(); else if (a === 'cancel') { GD_LLDF_PENDING = null; const md = document.getElementById('da-modal'); if (md) md.hidden = true; } });
document.addEventListener('change', e => {
  if (e.target.id === 'gd-lldf-file' && e.target.files && e.target.files[0]) { const file = e.target.files[0];
    BridgeXfer.importFile(file, GD_LLDF.schema, GD_LLDF.ver, r => { if (r.error) { alert(`Cannot import the hand-off file: ${r.error}`); return; } gdLldfOffer(r.payload, `file ${file.name}`); }); return; }
  if (e.target.name === 'gdlldf-basis') { gdLldfDialog(e.target.value); return; }
  if (e.target.dataset && /^sa\.(girder|dfSrc)$/.test(e.target.dataset.k || '')) setTimeout(gdLldfPaint, 0); });
window.addEventListener('storage', e => { if (!e.key || e.key.indexOf('bridgeSuite.v1.lldf') === 0) gdLldfPaint(); });
     ```
- **Mapping table** (analyzed girder Gj; "type" = lldf's `interior` or `exterior` for Gj's type, default; "beam" = lldf's `byBeam["j"]`, allowed only when both tools have the same number of girders):

  | lldf payload field | GirderDetail input | Notes |
  |---|---|---|
  | `governingBySpan[i].<type or byBeam>.gM` | `sa.dfm.s<i>.gM` (span i+1, g moment) | `governing.…` for every span if the payload has no `governingBySpan` (older lldf) |
  | `governingBySpan[i]….gV` | `sa.dfm.s<i>.gV` (g shear) | same |
  | `governingBySpan[i]….fatM` | `sa.dfm.s<i>.fM` (g fatigue moment) | one lane ÷ 1.2; left unchanged if absent |
  | `governingBySpan[i]….fatV` | `sa.dfm.s<i>.fV` (g fatigue shear) | same |
  | `governingNeg.<type or byBeam>.gM` | `sa.dfm.p<k>.gM` for every pier k | left unchanged if the payload has no `governingNeg` |
  | — | `sa.dfSrc` ← `'manual'` | the existing toggle |
  | `producer`, `producerFile` (default `lldf.html`), `producedAt`, `project` (string or `{name}`) | `sa.dfImport` (NEW optional field) | also `adoptedAt`, `girder`, `basis`, `basisLbl`, `fields` |
  | `governingNeg` shear/fatigue, other girders, `designLanes`, `Kg`, `members` | not used | listed in the dialog |

- **Units / checks:** DFs are dimensionless lanes per girder; a payload whose `units.df` does not say "lanes per girder" is refused. Every number used must be a finite positive number. Different span count → refused. Different span lengths (> 0.5 ft), girder count, skew (> 0.5°) or cross-section type (not `a`) → warning in the dialog. Wrong `_schema`, newer `schemaVersion`, corrupt JSON → refused with a message (BridgeXfer).
- **Problem:** none (new feature). Results are unchanged unless the user confirms a pull; after a pull the analysis uses lldf's factors instead of this tool's, which can be more or less conservative (e.g. check case: span 2 interior g 0.6677 → 0.6728, pier 1 interior g 0.7156 → 0.6934).
- **Governing provision:** no change. AASHTO LRFD 10th Ed. 4.6.2.2 (factors computed in lldf); C3.6.1.1.2 (fatigue = one lane ÷ 1.2).
- **Check case** (default Preliminary sizing bridge: 3 spans 110 + 140 + 110 ft, 5 girders at 9.5 ft, skew 15°, t_s = 8 in; lldf type (a), same spans/spacing/skew, I = 40,000 in⁴, A = 60 in², e_g = 40 in, n = 8):
  - K_g = 8(40,000 + 60·40²) = 1,088,000 in⁴. Span 2 alone, L = 140 ft: (K_g/12Lt_s³)^0.1 = 1.0238; g_M2 = 0.075 + (9.5/9.5)^0.6 (9.5/140)^0.2 (1.0238) = 0.6728 (g_M1 = 0.4511) → lldf `governingBySpan[1].interior.gM` = 0.6728. Pier, L = 125 ft: g_M2 = 0.6934 = `governingNeg.interior.gM`.
  - G2 (interior), mid span 2 (x = 180 ft): per-lane LL+IM moment 2,686.4 k-ft (unchanged). Before: g = 0.6677 (this tool's own), M = 1,793.7 k-ft. After pull: g = 0.6728, M = 0.6728 × 2,686.4 = 1,807.4 k-ft.
  - Pier 1 (x = 110 ft): before g = 0.7156, M⁻ = −2,280.1 k-ft; after g = 0.6934, M⁻ = −2,209.3 k-ft.
  - Setting the select back to "From the LLDF and DLs module" gives the original results exactly.
- **How verified:** `node --check` of every inline script. End-to-end in jsdom with one shared localStorage stub: lldf.html's real "Send DFs" publish → GirderDetail's real Pull button/dialog/Apply (the bridge was produced by the embedded PlateLine's own `bridgeDef()` and delivered through the real `gd-bridge` message handler); asserted all 14 mapped inputs, `sa.dfSrc`, `sa.dfImport` (also in the autosave), the adoption marker, the indicator, the source in the module, the LLDF and DLs note and the report echo; G1 with "same beam number"; a payload without `governingBySpan`; lldf's "Export DF hand-off (JSON)" file → "Import hand-off (JSON)"; refusals for wrong `_schema`, `schemaVersion` 2, corrupt JSON, negative/string/NaN DFs, wrong span count, wrong DF units, wrong-schema file. With no hand-off, the original and new files give identical Structural analysis arrays (gMi, LL±, fatigue, Strength I M/V, echo), identical LLDF and DLs factors and identical report echo for G1 and G2. 52/52 checks pass.
- **Other copies:** the BridgeXfer v1 helper already in this file (from Step 1) is reused unchanged.
- **Open items:** the manual factors are per girder; after changing the analyzed girder the module shows a "pull again" warning rather than re-mapping automatically. The PlateLine base64 block was not touched.

## 2026-10-09 — PR: claude/pin-girderdetail (PR link added after merge)

### P1. MathJax pinned to 3.2.2 (main page and embedded PlateLine)   [no calculation change]
- **Date / type:** 2026-10-09, library pinning only (CLAUDE.md §2). Engineer's decision 2026-10-09: pin the libraries. No code, formula, UI, storage key or file-format change.
- **Where (2 places):**
  1. Main page `<head>` scripts, ≈ line 1049. Anchor text: `npm/mathjax@3/es5/tex-svg.js" async></script>` (the line just after the `window.MathJax = {` config).
  2. Inside the embedded PlateLine app: the base64 string `const PL_B64 = '...'` (≈ line 2344). In the decoded PlateLine HTML the tag is at ≈ line 907, just after its own `window.MathJax = {` config.
- **Before / After (exact, identical in both places):**

| Library | Before | After |
|---|---|---|
| MathJax (tex-svg) | `<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>` | `<script src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js" async></script>` |

- **Version chosen:** **3.2.2**, the latest 3.x on npm (published 2022-06-08). It is what `@3` resolves to today, so the tool gets the same code as before (the page reports `MathJax.version` = 3.2.2 on main too). Gusset Plate Rating already uses `mathjax@3.2.2`. MathJax 4.x (npm `latest` = 4.1.3) was not considered: new major.
- **How to re-apply the PlateLine part by hand:** base64-decode the `PL_B64` string (standard alphabet, with `=` padding, one line, no line breaks; the decoded bytes are UTF-8 HTML with LF line endings). Replace the one occurrence of `mathjax@3/es5/tex-svg.js` with `mathjax@3.2.2/es5/tex-svg.js`. Base64-encode again the same way (no line wrapping) and put it back between the quotes. The string grows from 556,048 to 556,056 characters (decoded 417,036 → 417,040 bytes). Base64 text before the change point (first 66,647 characters) is unchanged; everything after it shifts, as expected for a 4-byte insertion.
- **Left as is (already pinned or fixed releases):**
  - three.js `cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` (fixed release r128) and `cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`.
  - Plotly `cdnjs.cloudflare.com/ajax/libs/plotly.js/2.27.0/plotly.min.js` (main page and PlateLine).
  - Pyodide `cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js` (dynamic load in `dxfPy`, DXF export only); `micropip` and `numpy` come from that Pyodide release's own package set.
  - Google Fonts stylesheet (main page and PlateLine).
  - PlateLine has no other external URLs (decoded and searched: only Google Fonts, MathJax, Plotly and the SVG namespace).
- **Check case:** default example ("Example 3-span continuous", 110 + 140 + 110 ft, 5 girders @ 9.50 ft). Main and branch both show, in Preliminary sizing (PlateLine): "Proportions satisfy the code limits checked", 46 checks, 44 OK, 28.58 psf, 91.57 kip per girder, 228.92 tons; and the same text in all 12 detail modules.
- **How verified:**
  - Script check: the decoded PlateLine from main and branch differ in exactly one line (the MathJax tag); the outer file, with the base64 string masked, differs in exactly one line (the MathJax tag). Base64 decode → encode round-trips byte-exactly on both.
  - Headless Chromium (Playwright). CDNs are blocked in the sandbox, so each URL was served from the npm tarball of that exact version (mathjax 3.2.2, three 0.128.0, plotly.js-dist-min 2.27.0). Every module tab (Preliminary sizing + 12 modules) was opened on main and on the branch:
    - `MathJax.version` 3.2.2 in both the main page and the PlateLine iframe; typeset `mjx-container` counts identical per module (e.g. Field splice 107, LLDF and DLs 90, PlateLine 106); no `merror` nodes; no raw `\(` left in the detail modules.
    - Module text and PlateLine text identical. The only difference is the time stamp of the bridge hand-off ("received … PM") and the autosave `ts` fields.
    - `girderdetail_autosave_v1` and `plateline_autosave_v1` identical apart from `ts`.
    - No console errors. The branch requested only `mathjax@3.2.2` (from both the page and the PlateLine iframe), never `mathjax@3/`.
- **Not verifiable here:** the live jsDelivr response (blocked in the sandbox). Before merging, open the file once from `file://` with network access and confirm the equations render in a detail module and in Preliminary sizing.
- **Other copies:** none (the CDN tags are per file; PlateLine exists only inside this file).
- **Open items (found, not changed):**
  - The DXF export installs `ezdxf` with `micropip.install('ezdxf')` (in `dxfPy`, anchor `micropip.install('ezdxf')`), with no version, so it takes the newest ezdxf on PyPI that installs in Pyodide 0.26.4 (PyPI latest today: 1.4.4, requires Python ≥ 3.10). Not changed: it is a Python package, not a CDN tag, and DXF export could not be run here (Pyodide is blocked in the sandbox), so a pinned version could not be tested. Needs: a decision on whether to pin it (e.g. `micropip.install('ezdxf==<version>')`) and a DXF export test with network access.

## 2026-10-09 — Pin ezdxf for DXF export

### P2. `micropip.install('ezdxf')` pinned to `ezdxf==1.4.4`   [library pin, no calculation change]
- **Engineer's decision (2026-10-09):** pin the ezdxf version used by DXF export (open item from P1).
- **Where:** the DXF loader that starts Pyodide on first use. Anchor: `/* paper space layouts: the drawing is written by ezdxf running in the browser (Pyodide), loaded on first use */` (≈ line 5858); the install call is a few lines below.
- **Before:**
  ```js
  await py.runPythonAsync("import micropip\nawait micropip.install('ezdxf')");
  ```
- **After:**
  ```js
  await py.runPythonAsync("import micropip\nawait micropip.install('ezdxf==1.4.4')");
  ```
- **Why:** without a version, micropip installs the newest ezdxf from PyPI on every first export, so a future ezdxf release could change or break the DXF output without warning. 1.4.4 is the version the unpinned call installs today, so today's output is unchanged.
- **Checks:**
  - PyPI has `ezdxf-1.4.4-py3-none-any.whl` (pure Python, `Requires-Python >=3.10`), which micropip can install in Pyodide v0.26.4 (Python 3.12). Its dependencies (pyparsing ≥ 3.0, typing_extensions ≥ 4.6, numpy, fonttools) are still resolved by micropip/Pyodide as before (numpy is loaded from Pyodide's own packages).
  - The embedded writer `GD_DXF_PY` was extracted and executed against ezdxf 1.4.4 in CPython: it loads without errors (defines `build`).
  - `node --check` on every inline script: pass.
  - Not run here: an end-to-end DXF export in the browser (the Pyodide CDN is blocked in the test environment). **The engineer should run one DXF export after this change.**
- **Other copies:** none (PlateLine does not use ezdxf).
- **Open items:** ezdxf's own dependencies are not pinned (they are resolved by micropip); Pyodide itself is already pinned at v0.26.4.

## 2026-10-12 — PR: claude/sweep-sbbm (open-item sweep; PR link added after merge)

Engineer's instruction (2026-10-12): work through every open item, use best judgment, and list what needs the engineer. Basis: AASHTO LRFD 10th Ed. (2024). Items whose article number I could not confirm against the printed 10th Ed. are marked **verify**. Line numbers are approximate (main page ≈ line, or `PL:` ≈ line in the decoded PlateLine HTML).

**How to re-apply a PlateLine (`PL:`) edit by hand:** base64-decode the `const PL_B64 = '...'` string (standard alphabet, `=` padding, one line; the bytes are UTF-8 HTML with LF line endings), make the edit, base64-encode again without line wrapping and put it back between the quotes. After this PR the string is 557,928 characters (decoded 418,445 bytes; before: 556,056 / 417,040). The first 143,329 decoded bytes are unchanged.

### S1. Girder section: minimum permanent-load factors where a permanent load relieves the effect; moment-reversal check GS19   [calc change] [**MORE conservative**] (open item O9a)
- **Where:** `GM.gs` (≈ lines 3127–3365). Anchors: `gam: { dc: 1.25, dw: 1.50,` (def), `${fld('γ<sub>DC</sub> Strength I', 'gs.gam.dc', '')}` (panes), `const G = { dc: gm('dc')` and `const comb = (a` (compute), `const MD1 =` (yield moment), `{ const c = { id: 'GS19'` (new check, after GS18), `combos(R) { let h = card('cb-g'` and `${row('DC1', 'DC1',` (Loads and stresses tab), `['Load factors', \`Str I` (report echo), manual part p18 "Other checks".
- **Problem:** Strength I used γ_DC = 1.25 and γ_DW = 1.50 on every permanent moment, also where the permanent moment has the opposite sign to the location's moment (a positive-flexure location near a pier, a negative-flexure location near a contraflexure point). 3.4.1 requires the minimum factor on a load that reduces the effect. The opposite extreme (live load of the other sign with the minimum factors) was not looked at at all, so a moment reversal went unnoticed (the card only said "check the minimum factors separately").
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.4.1 (minimum factor on a load that reduces the force effect) and Table 3.4.1-2 (γ_p DC 1.25/0.90, DW 1.50/0.65).
- **Before (compute):**
  ```js
  const G = { dc: gm('dc'), dw: gm('dw'), ll: gm('ll'), sll: gm('sll'), fat: gm('fat'), cdc: gm('cdc'), ccl: gm('ccl') };
  ...
      const comb = (a, b, c, l) => ({ top: a * r.stg.DC1.top + a * r.stg.DC2.top + b * r.stg.DW.top + l * r.stg.LL.top, bot: a * r.stg.DC1.bot + a * r.stg.DC2.bot + b * r.stg.DW.bot + l * r.stg.LL.bot });
      r.str = comb(G.dc, G.dw, 0, G.ll); r.svc = comb(1, 1, 0, G.sll);
      r.Mu = G.dc * (r.MDC1 + r.MDC2) + G.dw * r.MDW + G.ll * MLL; r.Ms = r.MDC1 + r.MDC2 + r.MDW + G.sll * MLL;
  ...
      const MD1 = G.dc * r.MDC1, MD2 = G.dc * r.MDC2 + G.dw * r.MDW; r.MD1x
  ```
- **After (compute):**
  ```js
  const G = { dc: gm('dc'), dw: gm('dw'), dcMin: gm('dcMin'), dwMin: gm('dwMin'), ll: gm('ll'), sll: gm('sll'), fat: gm('fat'), cdc: gm('cdc'), ccl: gm('ccl') };
  ...
      // 3.4.1: each permanent load takes its maximum factor where it adds to the location's governing effect and its minimum factor where it relieves it
      const sg = pos ? 1 : -1, gF = (M, mx, mn, s1) => s1 * M >= 0 ? mx : mn, gSet = s1 => ({ DC1: gF(r.MDC1, G.dc, G.dcMin, s1), DC2: gF(r.MDC2, G.dc, G.dcMin, s1), DW: gF(r.MDW, G.dw, G.dwMin, s1) });
      r.gm = gSet(sg);
      const comb = (a1, a2, b, l) => ({ top: a1 * r.stg.DC1.top + a2 * r.stg.DC2.top + b * r.stg.DW.top + l * r.stg.LL.top, bot: a1 * r.stg.DC1.bot + a2 * r.stg.DC2.bot + b * r.stg.DW.bot + l * r.stg.LL.bot });
      r.str = comb(r.gm.DC1, r.gm.DC2, r.gm.DW, G.ll); r.svc = comb(1, 1, 1, G.sll);
      r.Mu = r.gm.DC1 * r.MDC1 + r.gm.DC2 * r.MDC2 + r.gm.DW * r.MDW + G.ll * MLL; r.Ms = r.MDC1 + r.MDC2 + r.MDW + G.sll * MLL;
      { const gO = gSet(-sg), MLLo = pos ? r.MLLn : r.MLLp; r.gmO = gO; r.MLLo = MLLo; r.Mrev = gO.DC1 * r.MDC1 + gO.DC2 * r.MDC2 + gO.DW * r.MDW + G.ll * MLLo; r.rev = sg * r.Mrev < 0; }   // opposite extreme: moment reversal
  ...
      const MD1 = r.gm.DC1 * r.MDC1, MD2 = r.gm.DC2 * r.MDC2 + r.gm.DW * r.MDW; r.MD1x
  ```
  (`r.svc` is unchanged: the old call passed 1 for DW through its second argument.)
- **Other edits:** def `gam` gains `dcMin: 0.90, dwMin: 0.65`; two inputs "γ_DC Strength I, minimum" (`gs.gam.dcMin`) and "γ_DW Strength I, minimum" (`gs.gam.dwMin`) are inserted after the γ_DW input; the stress-accumulation table shows the factor actually used per stage (`r.gm.DC1`, `r.gm.DC2`, `r.gm.DW` instead of `R.G.dc`, `R.G.dc`, `R.G.dw`); the load-combination note and the report echo name the minimum factors; new check **GS19 "Moment reversal under Strength I"** (group Strength I flexure) lists, per location, M_u and the opposite extreme M_u,opp = γ·M_DC1 + γ·M_DC2 + γ·M_DW + γ_LL·M_LL(other sign), with γ = min where the permanent moment opposes that extreme. Status: **warning** when the sign reverses ("also check as negative/positive flexure"), pass otherwise. The opposite sense of flexure is not designed automatically: the warning asks for a location with the other region.
- **Shear:** unchanged. The module validates V_DC1, V_DC2, V_DW and V_LL ≥ 0 (magnitudes), so every permanent shear adds and the maximum factors are correct.
- **Saved data:** two new optional fields `gs.gam.dcMin`, `gs.gam.dwMin` inside the existing autosave/project JSON (no new storage key). Older files load through `deepMerge` with the defaults 0.90 / 0.65.
- **Check case** (Girder section, default section rows with the moments changed; k-ft):
  - A1, positive region, M_DC1 = −200, M_DC2 = −30, M_DW = −35, M_LL+ = 900, M_LL− = −700. Before: M_u = 1.25(−230) + 1.50(−35) + 1.75(900) = −287.5 − 52.5 + 1575 = **1,235.00**. After: 0.90(−230) + 0.65(−35) + 1575 = −207.0 − 22.75 + 1575 = **1,345.25** (GS6 demand 1,235.00 → 1,345.25; bottom-flange f_bu 6.94 → 7.85 ksi). GS19: M_u,opp = 1.25(−230) + 1.50(−35) + 1.75(−700) = **−1,565.00** → reversal warning.
  - A2, negative region, M_DC1 = 300, M_DC2 = 40, M_DW = 45, M_LL− = −900, M_LL+ = 600. Before: 1.25(340) + 1.50(45) − 1575 = **−1,082.50**; after: 0.90(340) + 0.65(45) − 1575 = **−1,239.75** (GS7 f_bu 4.93 → 5.70 ksi; GS9 M_u 1,082.50 → 1,239.75). GS19: 1.25(340) + 1.50(45) + 1.75(600) = **1,542.50** → reversal warning.
  - Built-in example (Span 1 and Pier 1): every permanent moment has the sign of the location's moment, so all results are unchanged; GS19 gives 950.00 (Span 1) and −2,176.50 (Pier 1): no reversal. The module summary goes from 18 to 19 checks.
- **How verified:** headless Chromium, main vs branch: `GM.gs.compute`/`checks` for the rows above and the default; default module text differs only by the new GS19 row and the check count.
- **Other copies:** PlateLine's own envelope (`Mup`/`Mun`) already picked the factors by sign; its noncompact positive check did not (see S3).

### S2. Girder section, Service II: f_ℓ/2 on the bottom flange   [calc change] [**MORE conservative** where f_ℓ > 0] (open item O9b)
- **Where:** `GM.gs.checks`, check GS12. Anchor: `{ const c = { id: 'GS12', grp: SV, title: 'Permanent deformations: flange stresses'`.
- **Problem:** Eq. 6.10.4.2.2-2 (bottom steel flange of composite sections) is f_f + f_ℓ/2 ≤ 0.95R_hF_yf; the check used f_f only.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.10.4.2.2, Eqs. 6.10.4.2.2-1 (top) and -2 (bottom).
- **Before:**
  ```js
  ref: 'AASHTO LRFD 6.10.4.2.2', src: 'Code', sym: T`f_f \le 0.95R_hF_{yf}\ \text{(composite section flanges)}`, ... note: '... (steel plus reinforcement), which is conservative.' };
      R.rows.forEach(r => [['top', r.svc.top, R.Fyt], ['bottom', r.svc.bot, R.Fyb]].forEach(([f, v, Fy]) => { const a = Math.abs(v), cap = 0.95 * r.Rh * Fy; c.items.push(rc(`${L(r)}, ${f}`, [f2(a), f2(cap), f2(a / cap)], a, cap, T`|f_f| = ${f2(a)} ...`)); })); out.add(c); }
  ```
- **After:**
  ```js
  ref: 'AASHTO LRFD 6.10.4.2.2, Eqs. 6.10.4.2.2-1 and -2', src: 'Code', sym: T`f_f \le 0.95R_hF_{yf}\ \text{(top flange)}, \qquad f_f + \frac{f_\ell}{2} \le 0.95R_hF_{yf}\ \text{(bottom flange)}`, ... note: '... which is conservative. f_ℓ on the discretely braced bottom flange (Eq. 6.10.4.2.2-2) is the first-order value entered for the location, which is the Strength I value; using it for Service II is conservative.' };
      R.rows.forEach(r => [['top', r.svc.top, R.Fyt, 0], ['bottom', r.svc.bot, R.Fyb, Math.max(r.fl, 0)]].forEach(([f, v, Fy, fl]) => { const a = Math.abs(v) + fl / 2, cap = 0.95 * r.Rh * Fy; c.items.push(rc(`${L(r)}, ${f}`, [f2(a), f2(cap), f2(a / cap)], a, cap, fl > 0 ? T`|f_f| + \frac{f_\ell}{2} = ...` : T`|f_f| = ${f2(a)} ...`)); })); out.add(c); }
  ```
  (The full work strings are in the file; with f_ℓ = 0 the work string is the old one.)
- **f_ℓ used:** the location's entered f_ℓ (labelled Strength I, first order). The module has no Service II f_ℓ input; using the Strength I value is conservative. Manual p18 "Other checks" updated.
- **Check case:** default Span 1 row with f_ℓ = 6 ksi: f_f = 29.50 ksi; before 29.50 ≤ 47.50 (ratio 0.62); after 29.50 + 6/2 = **32.50** ≤ 0.95(1.0)(50) = 47.50 (ratio **0.68**). Default Pier 1 with f_ℓ = 6: 29.44 → 32.44 ksi. With f_ℓ = 0 (built-in example) nothing changes.
- **How verified:** as S1.

### S3. PlateLine: noncompact positive-flexure compression flange includes DC2, DW and LL+IM; same γ_p as M_u+; edition reference 10th Ed.   [calc change] [**MORE conservative**] (open item O9c)
- **Where:** decoded PlateLine, `checkLayout` (PL: ≈ 2193–2206). Anchors: `const Sb = { s: p.I / ybs, c3:`, `if (T.Mup[i] > 0) {`, `if (cont) { const MD1 =`, `} else { const g1 = 1.25, fb =`. Reference list PL: ≈ 2546, anchor `<li>AASHTO LRFD Bridge Design Specifications, 9th Edition`.
- **Problem:** the noncompact positive check compared the top (compression) flange stress from DC1 alone (`ft = 1.25 M_DC1/S_top,steel`) with F_y; DC2, DW (on 3n) and LL+IM (on n) were left out. Both flange checks (and the 1.3R_hM_y cap) also used 1.25/1.50 regardless of the sign of the permanent moments, while M_u+ (`Mup`) picks the factor by sign.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.10.7.2.1 (f_bu ≤ φ_fF_nc for the compression flange), 6.10.1.1.1a (stresses accumulated on the section that carries each load), 3.4.1 / Table 3.4.1-2.
- **Before (PL):**
  ```js
          const Sb = { s: p.I / ybs, c3: c3.I / c3.yb, n: cn.I / cn.yb, cr: Icr / ybc }, St = { s: p.I / (d - ybs), cr: Icr / (d - ybc) };
  ...
        if (T.Mup[i] > 0) {
          const pl = sgPlastic(q, D, beff, t, b, tw), comp = ...
            if (cont) { const MD1 = 1.25 * M1, MD2 = 1.25 * M2 + 1.5 * Mw, MAD = ...
          } else { const g1 = 1.25, fb = (g1 * M1 * 12 / Sb.s + (g1 * M2 + 1.5 * Mw) * 12 / Sb.c3 + 1.75 * Lp * 12 / Sb.n), ft = (g1 * M1 * 12 / St.s);
  ```
- **After (PL):**
  ```js
          const Sb = { s: p.I / ybs, c3: c3.I / c3.yb, n: cn.I / cn.yb, cr: Icr / ybc }, St = { s: p.I / (d - ybs), c3: c3.I / (d - c3.yb), n: cn.I / (d - cn.yb), cr: Icr / (d - ybc) };
  ...
        if (T.Mup[i] > 0) {
          const gdP = M1 + M2 >= 0 ? 1.25 : 0.90, gwP = Mw >= 0 ? 1.50 : 0.65;   // the same permanent-load factors as M_u+ (3.4.1)
          const pl = sgPlastic(q, D, beff, t, b, tw), comp = ...
            if (cont) { const MD1 = gdP * M1, MD2 = gdP * M2 + gwP * Mw, MAD = ...
          } else { const fb = (gdP * M1 * 12 / Sb.s + (gdP * M2 + gwP * Mw) * 12 / Sb.c3 + 1.75 * Lp * 12 / Sb.n), ft = (gdP * M1 * 12 / St.s + (gdP * M2 + gwP * Mw) * 12 / St.c3 + 1.75 * Lp * 12 / St.n);   // compression flange: every stage on its own section (6.10.7.2.1, 6.10.1.1.1a)
  ```
  Reference list: `9th Edition, ... 2020` → `10th Edition, ... 2024`.
- **Check case** (PlateLine built-in bridge with D = 84 in, web 1/2 in, stiffened, so that the positive sections are noncompact; interior girder, x = 50 ft; M_DC1 = 952.06, M_DC2 = 116.52, M_DW = 151.12, M_LL+ = 1,943.61 k-ft; top of steel S_steel = 1,682.19, S_3n = 5,849.22, S_n = 16,859.65 in³):
  - before: f_top = 1.25(952.06)(12)/1,682.19 = **8.49 ksi**, ratio 8.49/50 = 0.170;
  - after: 8.49 + [1.25(116.52) + 1.50(151.12)](12)/5,849.22 + 1.75(1,943.61)(12)/16,859.65 = 8.49 + 0.76 + 2.42 = **11.67 ksi**, ratio **0.233** (now the governing top-flange check at that node).
  - The γ_p part changes results only where M_DC1 + M_DC2 < 0 or M_DW < 0 at a node with M_u+ > 0 (near piers); there the minimum factors give a larger compression and a smaller tension-side relief (more conservative).
  - Built-in example (compact positive sections): no change (all node ratios identical).
- **How verified:** PlateLine run standalone in headless Chromium, `suggestLayout(P, { full: true, verify: ... })` for the current layout, node ratio arrays main vs branch; the node above instrumented in a scratch copy for the intermediate values.

### S4. PlateLine, Service II: f_ℓ/2 from skew on the bottom flange   [calc change] [**MORE conservative**, skew > 20° only] (same provision as S2; found while doing O9b)
- **Where:** PL `checkLayout`. Anchors: `fl = skM > 20 + 1e-9 ?` (adds `flS`), `'Service II, positive (6.10.4.2.2)'`, `'Service II, negative (6.10.4.2.2)'`.
- **Before (PL):**
  ```js
  ... : (parseFloat(Lm.flSkI) || 10)) : 0;
  put(rB, gB, i, (M1 * 12 / Sb.s + (M2 + Mw) * 12 / Sb.c3 + 1.3 * Lp * 12 / Sb.n) / (0.95 * Fy), 'Service II, positive (6.10.4.2.2)');
  if (sb > 0) { put(rB, gB, i, sb / (0.95 * Fy), 'Service II, negative (6.10.4.2.2)');
  ```
- **After (PL):**
  ```js
  ... : (parseFloat(Lm.flSkI) || 10)) : 0, flS = fl > 0 ? fl / (parseFloat(Lm.flSkG) || 1.25) : 0;   // flS: unfactored f_l for Service II (Eq. 6.10.4.2.2-2)
  put(rB, gB, i, (M1 * 12 / Sb.s + (M2 + Mw) * 12 / Sb.c3 + 1.3 * Lp * 12 / Sb.n + flS / 2) / (0.95 * Fy), flS ? 'Service II, positive, with skew f_ℓ/2 (6.10.4.2.2)' : 'Service II, positive (6.10.4.2.2)');
  if (sb > 0) { put(rB, gB, i, (sb + flS / 2) / (0.95 * Fy), flS ? 'Service II, negative, with skew f_ℓ/2 (6.10.4.2.2)' : 'Service II, negative (6.10.4.2.2)');
  ```
- **f_ℓ used:** the skew estimate of C6.10.1 (Limits tab: 10 ksi interior, 7.5 ksi exterior) without its Strength load factor (`flSkG`, default 1.25), i.e. the Service II value. Web bend-buckling is unchanged.
- **Governing provision:** AASHTO LRFD 10th Ed. Eq. 6.10.4.2.2-2; C6.10.1 (skew f_ℓ estimate).
- **Check case** (built-in bridge with every skew 30°, interior girder, x = 1 ft): f_f = 51.18(12)/1,328.17 + (6.24 + 8.10)(12)/1,773.93 + 1.3(82.05)(12)/1,926.84 = 0.462 + 0.097 + 0.664 = 1.224 ksi. Before: 1.224/47.5 = 0.026 (not governing; node ratio 0.088 from another check). After: (1.224 + 10/2)/47.5 = **0.131**, now the governing bottom-flange check at that node. With skew ≤ 20° (built-in example: 15°) nothing changes.
- **How verified:** as S3.

### S5. PlateLine: Strength I design shear takes the minimum factor on a permanent shear that relieves the extreme   [calc change] [**MORE conservative**] (found during the sweep; same rule as S1)
- **Where:** PL ≈ 2027, `analyzeGirder` envelope. Anchor: `let VuMax = 0, VuLoc = 0;` (next line).
- **Before (PL):**
  ```js
        for (let e = 0; e < N - 1; e++) { const vd = 1.25 * VDC[e] + 1.5 * VDW[e]; const v = Math.max(Math.abs(vd + 1.75 * Vp[e]), Math.abs(vd + 1.75 * Vn[e])); if (v > VuMax) { VuMax = v; VuLoc = (xs[e] + xs[e + 1]) / 2; } }
  ```
- **After (PL):**
  ```js
        for (let e = 0; e < N - 1; e++) { const vf = s => (s * VDC[e] >= 0 ? 1.25 : 0.90) * VDC[e] + (s * VDW[e] >= 0 ? 1.5 : 0.65) * VDW[e];   // 3.4.1: minimum factors where a permanent load relieves the extreme
          const v = Math.max(Math.abs(vf(1) + 1.75 * Vp[e]), Math.abs(vf(-1) + 1.75 * Vn[e])); if (v > VuMax) { VuMax = v; VuLoc = (xs[e] + xs[e + 1]) / 2; } }
  ```
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.4.1, Table 3.4.1-2.
- **Check case** (one element): V_DC = 10, V_DW = 2, V_LL+ = 5, V_LL− = −60 kip. Before: v_d = 1.25(10) + 1.5(2) = 15.5; max(|15.5 + 8.75|, |15.5 − 105|) = **89.5 kip**. After: positive extreme 24.25 (unchanged); negative extreme 0.90(10) + 0.65(2) − 105 = −94.7 → **94.7 kip** (+5.8 %). Built-in bridge: unchanged (the positive extreme governs everywhere).
- **How verified:** PlateLine text and verify-mode ratios, main vs branch, built-in example: identical.

### S6. PlateLine: round-off moments at the abutments no longer trigger the negative-flexure checks   [bug fix] [results change only where the old ratio was ~10¹¹] (found during the sweep)
- **Where:** PL ≈ 2208. Anchor: `// negative flexure, Strength I (6.10.8) and Service II`.
- **Problem:** at an abutment node M_u− is round-off (≈ −7 × 10⁻¹¹ kip-ft). With a skew over 20° the check adds f_ℓ/3 to a zero f_bu and divides by F_nc computed with C_b ≈ 3 × 10⁻¹³ from the near-zero moment diagram, so the ratio was 3.6 × 10¹¹ at node 0. The verify mode used by Suggest (`v.check.max <= 1.0005`) could therefore never accept a layout for a bridge skewed more than 20°.
- **Before (PL):**
  ```js
          // negative flexure, Strength I (6.10.8) and Service II
          if (T.Mun[i] < 0) {
  ```
- **After (PL):**
  ```js
          // negative flexure, Strength I (6.10.8) and Service II (round-off moments at the abutments, |M| < 1e-6 kip-ft, are not negative flexure)
          if (T.Mun[i] < -1e-6) {
  ```
- **Governing provision:** none (numerical guard).
- **Check case:** built-in bridge, all skews 30°, verify mode: before, node 0 bottom flange ratio 363,262,006,193 ("Strength I, negative, compression flange with skew f_ℓ"), layout max the same; after, node 0 ratio 0.1435 (Service II with skew f_ℓ/2), layout max **1.0586** (the same governing check as with 15° skew). Built-in example: unchanged.
- **How verified:** as S3, with the node instrumented in a scratch copy (M_u− = −7.47 × 10⁻¹¹, C_b = 2.97 × 10⁻¹³, F_nc = 1.15 × 10⁻¹¹ ksi).

### S7. Field splice: flange splice plates in compression use φ_c = 0.95   [calc change] [**LESS conservative**] (open item O6)
- **Where:** `const PHI = {` (≈ 1206); `gdCompute` plate resistances (≈ 1429, anchor `c: PHI.c * gP.Fy * Ao`); `gdChecks` TF4/BF4 work string (≈ 1532, anchor `cm = [['compression', pr.c,`); manual part "Splice plates" (≈ 2191) and the validation note (≈ 2221).
- **Before:**
  ```js
  const PHI = { f: 1.0, y: 0.95, u: 0.80, c: 0.90, s: 0.80, bb: 0.80, bs: 0.80, v: 1.0, vu: 0.80 };
  ... c: PHI.c * gP.Fy * Ao } ... c: PHI.c * gP.Fy * Ai }
  cm = [['compression', pr.c, T`\phi_cF_yA_s = 0.90(${f0(R.gP.Fy)})(${f2(pr.A)})`]];
  ```
- **After:**
  ```js
  const PHI = { f: 1.0, y: 0.95, u: 0.80, c: 0.90, cp: 0.95, s: 0.80, bb: 0.80, bs: 0.80, v: 1.0, vu: 0.80 };
  ... c: PHI.cp * gP.Fy * Ao } ... c: PHI.cp * gP.Fy * Ai }
  cm = [['compression', pr.c, T`\phi_cF_yA_s = 0.95(${f0(R.gP.Fy)})(${f2(pr.A)})`]];
  ```
  Manual: "Compression: φ_cF_yA_s with φ_c = 0.90." → "... with φ_c = 0.95 (6.5.4.2). The web splice plate check under H_w keeps 0.90, because it stands for tension as well, where net-section fracture is not checked separately." Validation note: "its splice plate compression check uses φ_y = 0.95 instead of φ_c = 0.90;" → "its splice plate compression check uses φ = 0.95, labelled φ_y (the program uses φ_c = 0.95, 6.5.4.2, the same value);".
- **Not changed:** the web splice plate H_w check (`PHI.c` at ≈ 1621, φ = 0.90 "covers tension and compression"): in tension, net fracture (0.80F_uA_n) can govern over 0.95F_yA_g and is not checked there, so 0.90 is kept as the conservative cover.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.13.6.1.3b (splice plates in compression, R_r = φ_cF_yA_s, φ_c per 6.5.4.2) and 6.5.4.2 (φ_c = 0.95, axial compression, steel only). **verify** the 10th Ed. 6.13.6.1.3b wording refers to 6.5.4.2.
- **Check case** (built-in splice, 50 ksi plates): top outer plate A_s = 8.00 in²: before 0.90(50)(8.00) = 360.00 kip (TF4 ratio 265.26/360.00 = 0.74); after 0.95(50)(8.00) = **380.00 kip** (0.70). Top inner plates 8.13 in²: 365.63 → 385.94 kip (0.73 → 0.69). Bottom outer 11.00 in²: 495.00 → 522.50 kip (0.80 → 0.76); bottom inner 11.38 in²: 511.88 → 540.31 kip (0.78 → 0.74). No status change. The independent calculation quoted in the manual used 0.95, so it now agrees.
- **How verified:** default splice in headless Chromium, main vs branch: only TF4/BF4 compression items changed.

### S8. Shear connector auto-designer: strength loop may tighten the pitch down to 4d   [auto-design change] [no check changed] (open item O1)
- **Where:** `AD.sc`, strength loop (≈ 5091). Anchor: `!adLocked(\`sc.zones.${zi}.p\`) && D(z.p) > Math.ceil(`.
- **Before:** `D(z.p) > Math.ceil(6 * d)` — **After:** `D(z.p) > Math.ceil(4 * d)`.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.10.10.1.2 (minimum pitch 4d; SC3 already checks 4d).
- **Check case:** SC module default with the strength region shortened to 0–10 ft, 7/8 in studs, "Design" run: before, the loop stops at p = 6 in (ceil 5.25) with **SC2 failing**; after, it reaches p = **4 in** (≥ 4d = 3.50 in) and SC2 passes. Default example: same result (4 studs at 15 in, 3 at 17 in) before and after.
- **How verified:** `runAutoDesign('sc', true)` in headless Chromium, main vs branch.

### S9. Bearing stiffener: web strip reduced by F_yw/F_ys only once   [calc change] [**LESS conservative**, only where F_yw < 0.7F_ys] (open item O9d)
- **Where:** `bsCompute` (≈ 1795, anchor `r.Po = Fys * (r.As + t.np * t.tp * tw)`); `bsChecks` P_o "where" text (≈ 1843, anchor `['P<sub>o</sub>', `).
- **Problem:** when F_yw < 0.7F_ys the web strip length was reduced by F_yw/F_ys (correct: the reduced strip is an equivalent area at F_ys), and then that reduced area was multiplied by F_yw again, so the web contribution to P_o was reduced twice.
- **Before:**
  ```js
      r.Po = Fys * (r.As + t.np * t.tp * tw) + Fyw * r.Aw;
  ```
- **After:**
  ```js
      r.AwS = (r.strip9 + r.sEnd) * tw; r.AwI = r.Aw - r.AwS;   // web strips outside the group (reduced by F_yw/F_ys when F_yw < 0.7F_ys), web between the plates
      r.Po = Fys * (r.As + t.np * t.tp * tw) + (r.red < 1 ? Fys : Fyw) * r.AwS + Fyw * r.AwI;   // 6.10.11.2.4b: a reduced strip is an equivalent area at F_ys (single reduction)
  ```
  The web between multiple stiffener pairs (not reduced) keeps F_yw. With F_yw ≥ 0.7F_ys (`red = 1`) P_o is unchanged. The "where" line for P_o names the two web parts when the reduction applies.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.10.11.2.4b (web strip; reduction by F_yw/F_ys when F_yw < 0.7F_ys). **verify** that the 10th Ed. wording reduces the *area* (equivalent area at F_ys).
- **Check case** (built-in bearing stiffeners with web grade 36, stiffeners HPS70W): Abut. 1, Type A (1 pair, 7 × 7/8 in, t_w = 9/16 in): red = 36/70 = 0.514; strip 9t_w·red = 2.604 in; A_w = 2.929 in². Before P_o = 70(12.25 + 0.492) + 36(2.929) = 891.95 + 105.44 = 997.40 kip, P_r = 935.19 kip. After P_o = 891.95 + 70(2.929) = **1,096.98 kip** (= 36 × the unreduced 5.695 in²), P_r = **1,027.21 kip** (ratio 0.29 → 0.26). Pier 1, Type B (2 pairs): A_w = 2.929 (strips) + 6.188 (between the plates, F_yw) in²: P_r 2,488.71 → 2,581.34 kip. Same-grade default (50W/50W): unchanged.
- **How verified:** `bsCompute`/`bsChecks` in headless Chromium, main vs branch.

### S10. Rolled diaphragm bolts: F_ub from the selected bolt grade   [calc change] [**LESS conservative** for A490 only] (open item O9d)
- **Where:** `cfDiaChecks` (≈ 2662). Anchor: `thr = (p.conn || {}).thr === 'excl' ? 0.56 : 0.45, phiRs = 0.80 * thr * Ab *`.
- **Before:** `phiRs = 0.80 * thr * Ab * 120,` — **After:** `phiRs = 0.80 * thr * Ab * (FUB[(p.conn || {}).gr] || 120),` (`FUB = { A325: 120, A490: 150 }`, the table the cross-frame bolts already use).
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 6.13.2.7 (R_n = 0.45/0.56 A_bF_ub), 6.4.3.1 (F_ub: ASTM F3125 Grade A325 120 ksi, Grade A490 150 ksi).
- **Check case** (cross-frame default with the rolled diaphragm on, 7/8 in bolts, threads included): A325 unchanged, 0.80(0.45)(0.6013)(120) = 25.98 kip. A490: before 25.98 kip; after 0.80(0.45)(0.6013)(150) = **32.47 kip** (ratio 1.59 → 1.27; still fails in this example).
- **How verified:** `GM.cf.compute`/`checks` with `dia.on = 'yes'`, main vs branch.

### S11. Splice report: V_r line shows the tension-field expression when it is used   [display] [no result change] (open item O8)
- **Where:** `pfyCard` (≈ 6595). Anchor: `+ eq('Web factored shear resistance, smaller web', '6.13.6.1.3c, 6.10.9',`.
- **Before:**
  ```js
  T`V_r = \phi_vV_n = 1.0(${f3(R.Cv)})(${f2(R.Vp)}) = ${f2(R.phVn)}\ \text{kip} \quad (k = ${f2(R.k)},\ \text{Eq. ${R.vnExpr.eq}})`
  ```
- **After:**
  ```js
  R.vnExpr.dD != null ? T`V_r = \phi_vV_n = 1.0(${f2(R.Vp)})\left[${f3(R.Cv)} + \frac{0.87(1 - ${f3(R.Cv)})}{\sqrt{1 + (${f3(R.vnExpr.dD)})^2}${R.vnExpr.eq === '6.10.9.3.2-8' ? T` + ${f3(R.vnExpr.dD)}` : ''}}\right] = ${f2(R.phVn)}\ \text{kip} \quad (k = ${f2(R.k)},\ d_o/D = ${f3(R.vnExpr.dD)},\ \text{Eq. ${R.vnExpr.eq}})` : <the old string>
  ```
- **Governing provision:** AASHTO LRFD 10th Ed. Eqs. 6.10.9.3.2-2 and -8 (display only).
- **Check case:** built-in splice, web stiffened, d_o = 90 in: before "1.0(0.578)(978.75) = 765.05" (the product is 565.7, not 765.05); after "1.0(978.75)[0.578 + 0.87(1 − 0.578)/√(1 + 1.500²)] = 765.05 kip" (hand: 978.75 × (0.578 + 0.367/1.803) = 978.75 × 0.782 = 765.1). Unstiffened web: unchanged string.
- **How verified:** `pfyCard(gdCompute(...))` string, main vs branch.

### S12. Messages accepted only from the right window; PlateLine owner-default profiles guarded   [bug fix / robustness] [no result change] (open item O9e; AUDIT S9, S10)
- **Where (main page):** new `const gdFromPL = e => typeof PL_FRAME !== 'undefined' && !!PL_FRAME && e.source === PL_FRAME.contentWindow;` before the `gd-bridge` listener (anchor `if (!e.data || e.data.type !== 'gd-bridge' || !e.data.bridge) return;`); `if (!gdFromPL(e)) return;` added as the first line of the `gd-bridge`, `gd-gs` and `gd-inbox` listeners; `gdFromPL(e) &&` added to the `pl-status` and `gd-inbox-err` one-liners.
- **Where (PL):** `if (e.source !== window.parent) return;` first in the listener for `pl-bridge-req`/`gd-an`/`gd-dfx` (PL ≈ 3321) and in the `pl-export-req` listener (PL ≈ 3353). Owner-default profile buttons (PL ≈ 4179–4180, anchors `$('#pf_save').onclick =`, `$('#pf_load').onclick =`): `JSON.parse` and `localStorage.setItem` wrapped in try/catch.
- **Before (PL, profiles):**
  ```js
    $('#pf_save').onclick = () => { if (!LS) return; const all = JSON.parse(localStorage.getItem(KEY_PF) || '{}'); all[P.limits.dot] = clone(P.limits); localStorage.setItem(KEY_PF, JSON.stringify(all)); flashPf(`Saved these limits as the ${P.limits.dot} defaults.`); };
    $('#pf_load').onclick = () => { const all = LS ? JSON.parse(localStorage.getItem(KEY_PF) || '{}') : {}; const d = all[P.limits.dot]; ...
  ```
- **After (PL, profiles):**
  ```js
    $('#pf_save').onclick = () => { if (!LS) return; let all = {}; try { all = JSON.parse(localStorage.getItem(KEY_PF) || '{}') || {}; } catch (e) { flashPf('Not saved: the owner defaults already in browser storage could not be read (corrupt data), and saving would overwrite them.', 'fail'); return; } all[P.limits.dot] = clone(P.limits); try { localStorage.setItem(KEY_PF, JSON.stringify(all)); } catch (e) { flashPf('Could not save the defaults: the browser storage is full or blocked.', 'fail'); return; } flashPf(`Saved these limits as the ${P.limits.dot} defaults.`); };
    $('#pf_load').onclick = () => { let all = {}; try { all = (LS ? JSON.parse(localStorage.getItem(KEY_PF) || '{}') : {}) || {}; } catch (e) { flashPf('The saved owner defaults could not be read (corrupt data in browser storage).', 'fail'); return; } const d = all[P.limits.dot]; ...
  ```
  A corrupt profile store is never overwritten (saved data is kept, CLAUDE.md §5).
- **Problem:** any window that could post to the page (a framing page, another frame) could inject a bridge, sections, an inbox (including `target: 'all'`, which runs "Design all") or an alert. Corrupt or blocked storage threw uncaught errors on the profile buttons.
- **Check case:** `window.postMessage({ type: 'gd-inbox-err', msg: 'SPOOF' }, '*')` from the page itself: before an alert "SPOOF"; after ignored. The real PlateLine frame still delivers: Structural analysis / LLDF and DLs text identical to main after load. Profiles: corrupt store → load: before uncaught SyntaxError; after message "could not be read"; save: before uncaught error, after "Not saved ..." and the stored text is unchanged; blocked setItem → "Could not save the defaults ...". Normal save/load unchanged.
- **How verified:** headless Chromium (main page and PlateLine standalone).

### S13. Autosave failure is shown instead of swallowed   [UI] [no result change] (AUDIT S8 / inventory X-S8, this tool's part)
- **Where:** `autosave()` (≈ 6688). Anchor: `function autosave() { if (!LS) return; clearTimeout(asT);`.
- **Before:** `... setTimeout(() => d.style.opacity = .25, 500); } } catch (e) {} }, 300); }`
- **After:** `... setTimeout(() => d.style.opacity = .25, 500); } gdAsState(true); } catch (e) { gdAsState(false); } }, 300); }` plus the new function `gdAsState(ok)` right after it (dot turns red, the "Autosaves and restores your last session" text becomes "Autosave failed: browser storage is full or blocked. Use Export JSON to keep your work.", one alert per session; both revert after the next successful autosave).
- **Check case:** `Storage.prototype.setItem` made to throw for `girderdetail_autosave_v1`: before nothing visible; after one alert, red dot and the message; restoring storage → the normal text returns. No storage key or format changed.
- **How verified:** headless Chromium; screenshot `shot_autosave_fail.png`.

### Earlier open items: status after this PR
- **O1** fixed (S8). **O6** fixed (S7). **O8** fixed (S11). **O9**: GS factors (S1), Service II f_ℓ/2 (S2), bearing-stiffener double reduction and rolled-diaphragm F_ub (S9, S10), postMessage checks (S12), PlateLine DC1-only check, 9th Ed. reference and profile `JSON.parse` (S3, S12).
- **O7 closed, not an issue.** The `crack: '15'` migration in `GM.sa.compute` (`if (!p.crackV) { if (p.crack === '15') p.crack = 'none'; p.crackV = 2; }`) never runs on a load: `GM.sa.def` contains `crackV: 2`, and every load goes through `deepMerge(GD_FULL(), saved)`, which supplies `crackV: 2` before `compute` sees the data. Test: autosave seeded with `{ sa: { crack: '15' } }` and no `crackV` → after load and after opening Structural analysis, `P.sa.crack` is still `'15'` (the saved value is kept, shown as "Cracked 15% ... (not per 6.10.1.5)"). Nothing is silently changed, so no notice is needed. The migration line is dead code and was left as is.
- **P2 (ezdxf dependencies) and H1 (DF pull "pull again" warning):** left, as recommended in the inventory.
- **O2, O3, O5:** need the printed 10th Ed. (see "Needs engineer").
- **O4:** not done in this PR (see "Remaining open items").

### Needs engineer
1. **O5 — L_p and C_b (6.10.8.2.3, A6.3.3).** The tool uses L_p = 1.1r_t√(E/F_yc) and the quarter-point C_b, labelled 10th Ed. Please confirm Eqs. 6.10.8.2.3-4 and A6.3.3-4 (coefficient 1.1 or 1.0) and the 10th Ed. C_b equation from the printed spec. Recommendation: if the printed text is 1.0, change `Lp = 1.1 * rt` in the three places that have it: `ltbFnc` (used by every 6.10.8 check in the detail modules), the Appendix A6 block of `GM.gs.compute`, and PlateLine `Fnc`.
2. **O3 — 10th Ed. Q_n (6.10.10.4.3).** Please supply the 10th Ed. equation text. Recommendation: code it as the default and keep the 9th Ed. equation as an option; until then the module uses the user-entered 10th Ed. Q_n or the 9th Ed. equation, as it warns.
3. **O2 — hole width for 1-1/8 in bolts (6.8.3).** Confirm "standard hole + 1/16 in" (1.3125 in, current) or "bolt + 1/8 in" (1.25 in). Recommendation: keep the current, more conservative value unless the printed text says otherwise.
4. **S7 / S9 verify flags:** confirm 6.13.6.1.3b refers splice plates in compression to φ_c of 6.5.4.2 (0.95), and that 6.10.11.2.4b reduces the web strip *area* by F_yw/F_ys.

### Remaining open items
- **O4 — unit weight for E_c (5.4.2.4, Table 3.5.1-1).** Not changed: the change reaches PlateLine (its own n and the modular ratio it sends), the LLDF and DLs module (K_g), the Structural analysis stiffness, and five detail modules (splice, studs, welds, girder section, fatigue), and it shifts the numbers quoted in several manual verification paragraphs and the splice validation table. Recommendation for a dedicated PR: in the five detail modules the `wc` input is used only for E_c, so relabel it "w_c for E_c (plain concrete, Table 3.5.1-1)" and change its default to 0.145 kcf (saved projects keep their stored value); in PlateLine add an optional `bridge.wcE` (default 0.145) used for E_c and sent to the modules, keeping `bridge.wc` (0.150) for dead load; in the LLDF and DLs module use `b.wcE` when present. Question for the engineer: does MassDOT practice use 0.145 kcf (plain concrete, f′c ≤ 5 ksi) for E_c?
- **Girder section, constructibility:** M = γ_DC M_DC1 + γ M_CLL still uses the maximum factors on both; a construction live load of the opposite sign to M_DC1 is not checked with 0.90 M_DC1 (rare; recommendation: same sign rule as S1).
- **Service II reversal** (S1 covers Strength I only) and **Service II f_ℓ input** (S2 uses the Strength I f_ℓ, conservative): recommendation, add an optional Service II f_ℓ per location if the conservatism matters.
