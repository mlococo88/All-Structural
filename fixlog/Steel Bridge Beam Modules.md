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

## 2026-10-12 — PR: claude/lldf-receivers (cross-tool: lldf DF payload `perFootStrip` / `skewShear` receivers; PR link added after merge)

Cross-tool connection PR (CLAUDE.md §7 exception): receivers of the `bridgeSuite.v1.lldf` payload honour lldf's new optional fields (fixlog/lldf.md 2026-10-12 SW3 `skewShear`, SW6 `perFootStrip`), and Bridge Geometry's skew note is softened. Tools changed: index.html, psbeam.html, stgirder.html, Moving Load Generator.html, Steel Bridge Beam Modules.html, Bridge Geometry.html; HANDOFF.md §4.2 / §4.3. The shared `bridgeSuite.v1.*` bootstrap blocks are not touched. No formula, factor, unit or code reference changed. Payloads without the new fields give the same results as before (checked).

### LR1. lldf DF pull: CIP slab DFs refused; shear skew compared   [hand-off] [no result change]
- **Where:** `gdLldfPlan(pl, basis)`. Anchors: `if (pl.perFootStrip === true) err.push(`, `pl.skewShear`.
- **Before:**
  ```js
    if (pl.skew != null && (typeof pl.skew !== 'number' || !isFinite(pl.skew))) err.push('The hand-off skew is not a number.');
    else if (pl.skew != null && Math.abs(Math.abs(pl.skew) - skM) > 0.5) warn.push(`Skew differs: LL & DL ${f0(pl.skew)}°, this bridge up to ${f0(skM)}°.`);
  ```
- **After:**
  ```js
    // CIP slab (lldf perFootStrip): factors per 1-ft strip of slab width, not per girder. Refused (HANDOFF.md §4.3).
    if (pl.perFootStrip === true) err.push('LL & DL sent cast-in-place slab factors: they are per 1-ft strip of slab width (AASHTO LRFD 4.6.2.3), not per girder. This tool needs girder factors.');
    …
    if (pl.skew != null && (typeof pl.skew !== 'number' || !isFinite(pl.skew))) err.push('The hand-off skew is not a number.');
    else if (pl.skewShear != null && (typeof pl.skewShear !== 'number' || !isFinite(pl.skewShear))) err.push('The hand-off shear skew (skewShear) is not a number.');
    // lldf's shear θ_V (skewShear, when sent) is the largest |skew|; compare that with this bridge's largest skew.
    // `skew` is then lldf's moment θ, which may be smaller by design (Art. 4.6.2.2.2e), so it is not compared.
    else if (pl.skewShear != null && Math.abs(Math.abs(pl.skewShear) - skM) > 0.5) warn.push(`Skew differs: LL & DL ${f0(Math.abs(pl.skewShear))}° for shear (${f0(pl.skew)}° for moment), this bridge up to ${f0(skM)}°.`);
    else if (pl.skewShear == null && pl.skew != null && Math.abs(Math.abs(pl.skew) - skM) > 0.5) warn.push(`Skew differs: LL & DL ${f0(pl.skew)}°, this bridge up to ${f0(skM)}°.`);
  ```
- **Problem:** (1) a slab payload passed the unit check (lldf writes `units.df` "lanes per girder" for every type) and only got the "type (slab)" warning, so per-strip factors could be applied to a steel girder (very unconservative). (2) With lldf's separate shear skew, `skew` is the moment θ (the smallest |skew|, or 0), so comparing it with this bridge's largest skew gave a false "Skew differs" warning. The right comparison is θ_V.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 4.6.2.3 (slab strip, per unit width); Art. 4.6.2.2.2e / 4.6.2.2.3c (moment θ vs shear θ). No formula changed.
- **Check case:** demo bridge (3 spans, supports up to 15°). Slab payload: before errors = [span count]; after errors also include the slab refusal. Girder payload θ = 30°, θ_V = 40°: before warning "LL & DL 30°, this bridge up to 15°"; after "LL & DL 40° for shear (30° for moment), this bridge up to 15°". Payload without `skewShear`: unchanged.
- **How verified:** headless Chromium, main vs branch, `gdLldfPlan(payload,'type')` on the lldf slab and girder payloads. No page errors.

## 2026-10-12 — PR: claude/gd-prelim-splice-xframe (engineer's requests; PR link added after merge)

Engineer's requests (2026-10-12): (1) an edit in Preliminary sizing must not move the page to another tab; (2) excluded field splices must show no splice results, and the splice location and size should be suggested; (3) cross-frames only on girders deep enough, otherwise channel or rolled diaphragms; (4) Suggest the number of girders, spacing, and overhangs from the out-to-out deck width; (5) hide the variable bay spacings when the spacing is Equal. Basis: AASHTO LRFD 10th Ed. (2024). **No check, formula, load or resistance factor, unit, or code reference of an existing check changed.** New computations: the channel diaphragm properties (G3), the new practice check CF10 (G3), and the width study (G4); see the §4 callouts in each item. Every default threshold is listed under "Needs engineer".

**PlateLine (`PL:`) edits** (G3, G4, G5): base64-decode `const PL_B64 = '...'` (standard alphabet, `=` padding, one line; UTF-8 HTML with LF line endings), apply the PlateLine diff at the end of this entry, encode again without line wrapping. After this PR the string is 579,240 characters (decoded 434,429 bytes; before: 557,928 / 418,445). The first 56,984 decoded bytes are unchanged. Line numbers below: main page ≈ line, `PL:` ≈ line in the decoded PlateLine.

**Exact before/after code:** the two unified diffs at the end of this entry (main page with the base64 string masked, and the decoded PlateLine). Each hunk's context lines are the anchors; the items below name the functions and anchor text.

### G1. Preliminary sizing edits no longer switch the page to Shear connectors; every refresh runs in the background   [bug fix / speed] [no result change]
- **Where:** new `GD_BG` and `gdBg(fn)` just before `function recompute()` (≈ 6540); `recompute()` first line `if (GD_BG) return;`; `fillInputs()` (≈ 6496) `if (GD_BG) { syncSame(); return; }`; `srcPanel()` `if (GD_BG) return;`; `loadAllInbox(j)` and `designAllRun(j, quiet)` now wrap `loadAllInbox0` / `designAllRun0` (the old bodies) in `gdBg`; `markLocks()` (≈ 5172) builds one label table. Anchors: `function designAllRun(j, quiet) {`, `function loadAllInbox(j) {`, `function markLocks() {`.
- **Cause:** a change to the bridge in Preliminary sizing schedules `gdScheduleRefresh` → `getDemands(…, 'refresh')` → `designAllRun(j, true)`. That function switches `P.mod` to each module in turn, and `runAutoDesign` → `recompute()` → `applyMod()` drew each module (tab buttons, `body.mod-pl` off). It ended with `P.mod = cur; setMod(cur)`, but `setMod` returns at once when `P.mod === cur`, so the screen was left on the last module drawn, Shear connectors (step 3, the stud redesign), while `P.mod` said Preliminary sizing. Also, `markLocks()` ran `document.querySelector('label[for=…]')` once per input (every module's inputs are in the page): about 1.5 s per call, 10 calls per refresh.
- **Fix:** multi-module runs (bridge auto-refresh, Design all, Load all, and the girder report's load step) compute and auto-design every module without drawing any; at the end the module on screen is redrawn once and the scroll positions (`.tab-panels`, `#side`, window) are restored. `fillInputs` keeps its data part (`syncSame`) in the background, so the data are the same as before. `markLocks` finds the same labels (first `label[for]` in document order) from one table.
- **Check case:** built-in example, Preliminary sizing open, edit girder spacing S 9.5 → 9.75 ft. Before: after the refresh the Shear connectors module is shown (`P.mod` = 'pl'); after: Preliminary sizing stays, its scroll (300 px) unchanged. Same for S, left overhang, t_s, N_b, D, haunch, f′c (each edit checked for 16 s). On Girder section scrolled to 600 px, a refresh: before → Shear connectors, scroll 24; after → Girder section, scroll 600. Refresh time (headless Chromium, `designAllRun`): 19.1–20.4 s before (markLocks 14.5 s), 3.4 s after.
- **Results:** Design all on the built-in example, main vs branch: every module's text and every check item (ID, status, cells, ratio) identical; the saved project differs only by the new optional fields (G2, G3).
- **Governing provision:** none (UI).

### G2. Field splices: "not included" shows one line only; Suggest splice proposes the location and the size   [UI / design suggestion] [no splice check changed]
- **Where (main page):** `GD_DEFAULT.spl` (≈ 1228); `spIncl`, `spStdT`, `spNextT`, `spLocSuggest`, `spSuggestSize`, `spSugBox`, `spSuggest` after `function spUndoBtn()` (≈ 6880); splice pane section `sec-spl` (anchor `${secHd('sec-spl', 'Field splices: inclusion and suggestion')}`); `recompute()` splice branch and new `renderSplOff()` (anchor `function renderSplOff()`); `modStatus` / `setMark` (`{ off: true }`); `designAllRun0` (`splOn`), `loadAllInbox0`, `applyInboxTo` (`P.spl.plN`); girder report (`if (mod === 'splice' && !spIncl())`); DXF (`dxfDetails`, `dxfBuild`: `FIELD SPLICES NOT INCLUDED`); `faImport('splice')`; `renderReportTab`, `openReport`; `spliceApply` (user's own plates kept); `onInput` (`P.spl.own = true`); `runAutoDesign('splice')` and `sp_auto` (`P.spl.own = false`); `autoDesignSplice` / `fitSplice` thickness steps and 3d pitch; manual "Field splices: inclusion and Suggest splice".
- **Problem:** with no field splices in the sizing layout, the Field splice module kept its earlier (or example) data and its checks: the tab mark and summary showed failures for a splice that does not exist (reproduced: 5 failing checks shown after the layout's splices were removed). There was no way to exclude splices, no location suggestion, and the splice auto-design used one bolt size and 1/16 in steps above 1 in.
- **Inclusion:** new select "Field splices" (`spl.inc`): `auto` (default, "As in Preliminary sizing": not included when the last sizing layout received has no field splices, recorded as `spl.plN` = number of splice cases received), `yes`, `no`. Not included → the splice module shows "Field splices not included" (status bar and Summary), no checks, report, drawings, 3D, DXF sheet, fatigue import, Design all row ("Field splices not included"), splice quantities or costs, splice/cross-frame conflicts, girder-report chapter (one line), and the tab mark is "–". Design all also clears the stud module's splice gaps (`sc.splX`, `sc.splL`) and redesigns the studs when splices are not included and gaps were set (no splice plates to avoid).
- **Suggest splice** (button on the Splice tab): 
  - *Location:* continuous unit — the dead-load (DC1 + DC2 + DW) contraflexure points next to each interior pier, from the Structural analysis module for an interior girder (G2; G1 with fewer than 3 girders), linear interpolation between nodes, rounded to the nearest foot; simple spans — the girder ends at the piers; then every field section longer than the maximum field-section length (`spl.maxLen`, default 120 ft, "shipping/erection assumption; verify") is divided into equal lengths (odd count in a simple span), and a splice closer than `spl.minSup` (default 10 ft) to a support is moved to that distance. The result is listed beside the stations in Preliminary sizing; the stations themselves stay in Preliminary sizing (the user's; not overwritten).
  - *Size:* `autoDesignSplice()` (unchanged search) run for each bolt diameter offered, 7/8, 1, 1-1/8 in (only the Bolts tab diameter when it is locked); among layouts passing every splice check, the least `bolts × std.cBolt + plate lb × std.cDet` (Owner standards, $15 and $3.50/lb) is kept. Plate thicknesses are standard: 1/16 in steps up to 1 in, 1/8 in above (`spNextT`/`spStdT` in the flange loop, inner-plate rounding, and `fitSplice`); the flange and web bolt pitches are at least 3d (changes only 1-1/8 in bolts: 3 3/8 in). Undo restores plates, web and bolts.
  - *Overrides:* editing any splice plate or the bolt diameter (`top.*`, `bot.*`, `web.*`, `bolts.d`) sets `spl.own`; imports and refreshes then keep the user's splice (source note says so) until Suggest splice or Auto-design splice is pressed. When demands are imported the splice is auto-designed with the Bolts tab diameter (as before).
- **§4 callout:** no splice check, resistance factor, or formula changed (TF, BF, MT, WS, DT are untouched). Auto-design suggestions change only (a) where a plate thicker than 1 in is chosen (now 1/8 in steps: 1 1/16 in is no longer offered) and (b) with 1-1/8 in bolts (pitch 3 3/8 in instead of 3 in, which failed DT1/DT9 before). The built-in example's 8 splice cases designed by Design all are identical main vs branch (all plates ≤ 7/8 in, 7/8 in bolts).
- **Worked example (built-in example, Field splice FS1 case, bridge from Preliminary sizing, Suggest splice):**
  - Location: 78, 142, 218, 282 ft (Preliminary sizing's Suggest placed 82, 145, 215, 278 ft from its constant-EI analysis; this uses the staged Structural analysis of G2). Rule text as above; no field section exceeds 120 ft (78, 64, 76, 64, 78 ft), no move for the 10 ft limit.
  - Size: 7/8 in: 96 bolts, 446 lb of plates, $3,001; **1 in: 96 bolts, 426 lb, $2,931 (chosen)**; 1-1/8 in: 96 bolts, 475 lb, $3,104. Top flange: single shear, 2 lines each side × 4 rows (32 bolts), outer PL 16 × 13/16. Bottom flange: double shear, 2 lines × 3 rows (24 bolts), outer PL 16 × 5/8, 2 inner PL 6 1/2 × 13/16. Web: 2 PL 57 × 1/2, 10 rows × 2 columns each side (40 bolts). Total 96 bolts.
  - Governing D/C after (before = the example's entered splice): TF1 0.941 (0.855), TF2 0.359 (0.550), TF3 0.874 (0.762), TF4 0.972 (0.842), TF5 0.806 (0.965), TF6 n/a, BF1 0.753 (0.769), BF2 0.495 (0.403), BF3 0.582 (0.571), BF4 0.986 (0.902), BF5 0.942 (0.820), BF6 n/a, MT1 0.940 (0.901), WS1 0.250 (0.195), WS2 0.458 (0.260), WS3 0.167 (0.128), WS4 0.264 (0.372), WS5 n/a, DT1 1.000 (0.875), DT2 0.917 (0.522), DT3 1.000 (0.857), DT4 0.714 (0.643), DT5 pass, DT6 pass, DT7 0.625 (0.714), DT8 0.923 (0.804), DT9 0.917 (0.571), DT10 1.000 (1.000), DT11 0.825 (0.658). Every check passes (29 checks: 26 OK, 3 n/a).
  - Override: top outer plate typed as 7/8 in → bridge refresh → kept (7/8 in, source note "as entered by the user"); Suggest splice again → 13/16 in.
- **Not-included check case:** built-in example, Preliminary sizing splices removed (`girder.splices = []`), example splice made to fail (top flange 1 row, 5/16 in plate). Before: Design all "Field splices: All checks pass; 0 cases designed" with $0 splice rows, tab mark "5" (failing), module "5 splice checks fail", governing 2.56. After: Design all "Field splices not included", no splice rows, tab mark "–", module one line "Field splices not included. The Preliminary sizing layout has no field splices." Setting "Not included" with splices present: the same, girder report chapter "Field splices not included.", report tab one line.
- **Saved data:** new optional object `spl: { inc, maxLen, minSup, own }` (+ `plN`, `sug` when used) inside the existing project/autosave JSON (`girderdetail_autosave_v1`); older files get the defaults through `deepMerge` (included, as before). No key renamed.
- **How verified:** headless Chromium, main vs branch (built-in example, Design all; no splices; Suggest splice; override; girder report; report tab).

### G3. Cross-frames: minimum girder depth, recommended bracing type (CF10), channel diaphragms   [new practice check (warning only) + new diaphragm option] [existing results unchanged]
- **Where (main page):** `CF_CH` before `const CF_DIA` (≈ 2645); `cfDiaChecks` (channel lookup `chS`, channel `I_y`, title, note, depth item); `GM.cf` `groups` (+ 'Bracing type'), `def.dMinXF: 48`, Geometry pane input `cf.dMinXF`, diaphragm section labels and shape list, validation, new check `CF10` at the end of `checks`; new `cfTypeRec(p)` before `function cfSVG(R)`; `AD.cf` adds the recommendation line (anchor `{ const TR = cfTypeRec(C0);`); manual "Channel diaphragms and the bracing type".
- **Where (PL):** `DEFAULT.framing.xfMinD: 48` (PL ≈ 1019); Framing tab input `framing.xfMinD` (PL ≈ 3402); detail export `cf.dMinXF` (PL ≈ 3252, anchor `const cf = { S: r2(m.S * 12)`); Suggest tab note `xfNoteHtml(s)` (anchor `host.innerHTML = wsHtml() + xfNoteHtml(s) + h;`).
- **Rule (CF10, src "Practice", status warning only):** girder depth d (out-to-out of the flanges: the "Girder depth d" input, which Preliminary sizing fills with D + t_top + t_bot at Abutment 1) ≥ `dMinXF` (default 48 in, "common practice (e.g. AISC/NSBA G13.1 guidance; owner standards govern) — verify") → cross-frame recommended (X or K by S/h > 1.5, the auto-designer's rule); d < minimum → the lightest channel with depth ≥ 0.5d (C8x11.5 … MC18x42.7), else the lightest W ≥ 0.5d from the existing W list. Status: pass when d ≥ minimum or a diaphragm is selected (`dia.on = 'yes'`); **warning** when d < minimum and a cross-frame is selected. The selected type is never changed (existing projects keep theirs).
- **Channel diaphragms:** the diaphragm alternative's shape list adds C8x11.5, C10x15.3, C12x20.7, MC12x31, C15x33.9, MC18x42.7 (nominal d, b_f, t_f, t_w from the AISC Manual — verify). They take the existing rolled-diaphragm checks (S10 path: brace stiffness 6EI_x/S, brace moment vs φ_fM_n by `ltbFnc` with L_b = S, C_b = 1.0, shear, jacking, eccentric bolt group with F_ub from the grade); differences: I_y about the channel's own centroid, the depth item compares with 0.5 × girder depth d (warning), and the note says the 6.10.8 I-section LTB model is an approximation for a channel (verify against AISC 360-16 F2).
- **§4 callout (new computation, existing values unchanged):**
  - Channel properties (fillets neglected): A = 2b_ft_f + h_wt_w; I_x = b_fd³/12 − (b_f − t_w)h_w³/12 (as for the W); x̄ = (h_wt_w·t_w/2 + 2b_ft_f·b_f/2)/A; I_y = h_wt_w³/12 + h_wt_w(t_w/2 − x̄)² + 2[t_fb_f³/12 + b_ft_f(b_f/2 − x̄)²].
  - Check case MC18x42.7 (d = 18, b_f = 3.95, t_f = 0.625, t_w = 0.450 in), girder depth 36 in, S = 114 in, 50 ksi: h_w = 16.75 in; A = 2(3.95)(0.625) + 16.75(0.45) = 12.475 in² (AISC 12.6); I_x = 3.95(18)³/12 − 3.50(16.75)³/12 = 549.0 in⁴ (AISC 554); S_x = 61.0 in³; x̄ = 0.918 in; I_y = 15.68 in⁴ (AISC 14.9); β_br = 6(29,000)(549.0)/114 = 838,001 kip-in/rad (tool: 838,001); φ_fM_n = 1,158 kip-in (F_nc = 18.98 ksi × 61.0); depth 18.00 ≥ 0.5(36) = 18.00 in (ratio 1.00). W shapes: unchanged (the same code path; W21x44 at d = 36 in: depth item 20.70 vs 0.75(60) = 45.00 in warning, as before).
  - CF10 check cases (cross-frame default, S = 114 in, h = 48 in): d = 62.5 in → pass, "K-frame (S/h = 2.38)"; d = 48.0 → pass; d = 47.9 → **warning**, "rolled diaphragm W27x84" (no channel reaches 24 in); d = 36 → **warning**, "channel diaphragm MC18x42.7 (or a rolled W)"; d = 36 with the MC18x42.7 or W21x44 diaphragm on → pass.
- **Results:** built-in example: the Cross-frames module gains CF10 (pass): "10 checks: 9 OK" instead of "9 checks: 8 OK"; nothing else changes. Shallow case (Preliminary sizing D = 33 in, girder depth 34.88 in, Design all): only change "Cross-frames: Fails: CF8; warnings CF10" and the CF10 row. `AD.cf` adds "Girder depth 36.00 in is below the 48.00 in minimum for cross-frames: a channel diaphragm MC18x42.7 (or a rolled W) is recommended (the cross-frame type is kept; …)".
- **Saved data / hand-off:** new optional `cf.dMinXF` (GirderDetail), `framing.xfMinD` (PlateLine), and `mods.cf.dMinXF` in the `girderdetail_inbox_v1` payload (imported like the other cross-frame geometry, override kept). Older data get 48 in.
- **Governing provision:** practice (AISC/NSBA G13.1 guidance; owner standards); AASHTO LRFD 10th Ed. 6.7.4.2 (diaphragm depth: 0.5 of a rolled beam, 0.75 of a plate girder), 6.7.4.2.2, 6.10.8 (unchanged use).
- **How verified:** `GM.cf.compute`/`checks` and Design all in headless Chromium, main vs branch; report tab renders CF10 and the channel title; hand numbers above.

### G4. PlateLine: girder count, spacing, and overhangs from the out-to-out deck width   [new feature] [nothing changes until applied]
- **Where (PL):** `DEFAULT.ws` (PL ≈ 1023); Suggest input tab section `sec-sgws` (anchor `${secHd('sec-sgws', 'Girder count from the deck width')}`); new `WS`, `wsKey`, `wsSetup`, `wsEval`, `wsCase`, `wsRun`, `renderSuggestSafe`, `wsPick`, `wsHtml`, `wsApply`, `xfNoteHtml` before `/* ---------------- alternatives study ---------------- */`; Suggest tab output `host.innerHTML = wsHtml() + xfNoteHtml(s) + h;`; manual "Girder count from the deck width".
- **Inputs (all "verify / owner"):** out-to-out deck width W (blank: Suggest uses N and S from the Bridge tab, as before); overhang 1.5 to 4.0 ft and ≤ 0.5S; d_e −1.0 to 5.5 ft; S 3.5 to 16 ft; objective least total steel weight (default) or fewest girders. Barrier/curb width comes from the Bridge tab (`brGeom(...).bar`, as Suggest uses it).
- **Method:** for N = 3, 4, …: overhangs on a 0.25 ft grid within the limits; S = (W − 2·oh)/(N − 1); kept when S, oh ≤ 0.5S and d_e = oh − barrier width are within the limits. Overhang choice: a trial size with oh nearest 0.375S gives K_g (longest span); then the feasible oh whose exterior and interior live-load moment distribution factors (`sgDF`, this tool's AASHTO 4.6.2.2 equations: Table 4.6.2.2.2b-1 interior; exterior max(lever rule, e·g_int), Table 4.6.2.2.2d-1) are closest (ties: nearest 0.375S); the girder is sized with Suggest fast mode for that N, S, oh (`suggestLayout` with the trial bridge) and checked with `runChecks` + `framingChecks` (like an Alternatives row). Table: N, S, overhang, d_e, g_M interior/exterior, section, steel per girder and total (kip), lb/ft² of deck, governing ratio of the layout checks, bracing type (G3), pass/fail; recommendation = passing row with least lb/ft² (= least total weight, W fixed) or fewest girders. Apply (one click + confirm, undo snapshot) sets N, S (equal), both overhangs, the girder plates and splices, and the stiffener setting. Runs in chunks (progress shown); GirderDetail refreshes in the background afterwards (G1).
- **Worked example (built-in bridge, W = 4 × 9.5 + 2 × 3.25 = 44.5 ft, barrier 1.5 ft):** N = 3 not feasible (S = (44.5 − 2·4.0)/2 = 18.25 > 16 ft). Sized:

  | N | S (ft) | oh (ft) | d_e | g_M int | g_M ext | web | kip/girder | total kip | lb/ft² | gov. ratio | bracing | checks |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | **4** | **13.00** | **2.75** | 1.25 | 0.855 | 0.854 | 66 × 1/2 stiff. | 98.32 | 393.28 | **24.55** | 1.00 (W3) | cross-frames | pass |
  | 5 | 10.00 | 2.25 | 0.75 | 0.696 | 0.690 | 65 × 1/2 stiff. | 87.68 | 438.41 | 27.37 | 1.00 (W3) | cross-frames | pass |
  | 6 | 8.00 | 2.25 | 0.75 | 0.571 | 0.563 | 52 × 1/2 stiff. | 79.40 | 476.41 | 29.74 | 1.00 (W3) | cross-frames | pass |
  | 7 | 6.67 | 2.25 | 0.75 | 0.489 | 0.487 | 44 × 1/2 unst. | 74.36 | 520.54 | 32.49 | 1.00 (W3) | channel / rolled | pass |
  | 8 | 5.79 | 2.00 | 0.50 | 0.447 | 0.444 | 47 × 1/2 unst. | 70.79 | 566.31 | 35.35 | 1.04 (D6) | cross-frames | pass, warnings |
  | 9 | 5.13 | 1.75 | 0.25 | 0.410 | 0.395 | 47 × 1/2 unst. | 67.33 | 605.98 | 37.83 | 1.04 (D6) | cross-frames | pass, warnings |
  | 10 | 4.56 | 1.75 | 0.25 | 0.381 | 0.370 | 50 × 1/2 unst. | 67.17 | 671.74 | 41.93 | 1.04 (D6) | cross-frames | pass, warnings |
  | 11 | 4.10 | 1.75 | 0.25 | 0.351 | 0.344 | 44 × 1/2 unst. | 64.13 | 705.43 | 44.03 | 1.07 (G6) | channel / rolled | pass, warnings |
  | 12 | 3.73 | 1.75 | 0.25 | 0.333 | 0.318 | 50 × 1/2 unst. | 64.67 | 775.99 | 48.44 | 1.17 (G6) | cross-frames | pass, warnings |

  Chosen (least weight): 4 girders at 13.00 ft, overhangs 2.75 ft. Hand check: S = (44.5 − 2·2.75)/3 = 13.00 ft; d_e = 2.75 − 1.5 = 1.25 ft; 2.75 ≤ 0.5·13.0; exterior lever rule a₁ = S + d_e − 2 = 12.25 ft, a₂ = 6.25 ft, g = 1.2 × 0.5(12.25 + 6.25)/13.00 = 0.854 (table 0.854) against the interior 0.855. At N = 5 the rule picks 2.25 ft overhangs (S = 10.00 ft) rather than the project's 3.25 ft (S = 9.50 ft), because the exterior and interior factors balance better. Apply → N = 4, S = 13, overhangs 2.75 ft, D = 66 in; GirderDetail stays on Preliminary sizing.
- **§4 callout:** no existing formula changed; the distribution factors are the existing `sgDF` equations, labelled as an estimate (run LL & DL for the chosen layout). The governing ratio is the largest item ratio among PlateLine's layout checks (practice checks included, so a "pass, warnings" row can show more than 1.00).
- **Saved data:** new optional `ws` object in the PlateLine project/autosave (`plateline_autosave_v1`); older projects get the defaults (W blank: feature off). Results are not saved.
- **How verified:** headless Chromium (table, recommendation, Apply, undo snapshot); `node --check` on the decoded PlateLine.

### G5. PlateLine Bridge tab: "Bay spacings (variable)" hidden while the spacing is Equal   [display only] [no result change]
- **Where (PL):** new `syncSpacingVis()` before `function onScalar(e)`; called from `onScalar` when `bridge.spacing` changes and at the end of `fillInputs()`.
- **Change:** the input's `.ig` block gets `display: none` with Equal spacing and is shown again with Variable. `P.bridge.bays` is not touched (switching back shows the same values).
- **Check case:** Equal → hidden, `bays` = "9.5, 9.5, 9.5, 9.5"; Variable → shown, same text; Equal again → hidden, same text. Screenshot `shot_pl_bridge_equal.png`.

### Verification summary
- `node --check`: every inline script of the page and of the decoded PlateLine: pass.
- Headless Chromium, main vs branch, built-in example: fresh load, Design all, and the main-saved autosave loaded into the branch: every module's text and every check item identical except the intended CF10 row; saved data and the `girderdetail_inbox_v1` payload differ only by the new optional fields. No console errors.
- Shallow girder (D = 33 in): only CF10 (warning) differs. Splices excluded: one line, no outputs. Tab and scroll unchanged on every Preliminary sizing edit and on a refresh while in another module.

### Raised, not changed
- `AD.cf` sets `type = 'K'` when S/h > 1.5, but the module's type values are `X`, `Kb`, `Kt`; `'K'` is computed as `Kt` (diagonals meeting at the top chord) and shows as "K-frame" in some places and not in the type select. Needs a decision: Kb or Kt for the auto-designed K-frame.
- The remaining refresh (≈ 3.4 s headless, mostly the splice and module auto-designers) still runs in one piece; it no longer moves the page, but the window does not respond for that time. Splitting it into steps would change the order of Design all; not done.

### Needs engineer
1. Minimum girder depth for cross-frames, default **48 in**, compared with the girder depth d (out-to-out of flanges), not the web depth.
2. Maximum field-section length **120 ft** (shipping/erection) and minimum splice distance from a support **10 ft**.
3. Splice location rule: dead-load (DC1 + DC2 + DW) contraflexure of an interior girder from the staged Structural analysis, rounded to 1 ft (Preliminary sizing's Suggest uses its constant-EI analysis, so the two can differ by a few feet: 78/142/218/282 vs 82/145/215/278 ft in the example).
4. Splice size objective: bolts × $15 + plate steel × $3.50/lb (Owner standards) across 7/8, 1, 1-1/8 in bolts; on import the Bolts tab diameter is kept (to keep the refresh fast). Confirm, or always search all diameters.
5. Channel list and dimensions (C8x11.5 … MC18x42.7), the 6.10.8 LTB approximation for channels, and the 0.5d channel depth.
6. Width study limits: overhang 1.5–4.0 ft and ≤ 0.5S, d_e −1.0 to 5.5 ft, S 3.5–16 ft, N from 3; the overhang rule (balance of exterior and interior moment factors; ties at 0.375S); objective default least weight.

### Exact changes: main page (unified diff, base64 string masked)

```diff
--- m_main.html	2026-10-12 20:41:13.315720093 +0000
+++ m_br.html	2026-10-12 20:41:13.320988749 +0000
@@ -1225,2 +1225,3 @@
   clr: { cw: 0.5, cv: 1.5 },
+  spl: { inc: 'auto', maxLen: 120, minSup: 10, own: false },   // field splices: inclusion, location rule inputs, user-entered plates flag (2026-10-12)
   ui: { itab: 'project', otab: 'summary', col: {}, man: 'p1', rpt: { inputs: true, combos: true, checks: true, summary: true, drawings: true, manual: false, detail: 'full' }, v3: { gird: true, plates: true, bolts: true, op: 0.35 } }
@@ -2134,2 +2135,3 @@
 <h3>Rolled diaphragm alternative (Cross-frames)</h3><p>A W-shape diaphragm can be checked beside the cross-frame: depth (6.7.4.2), torsional brace stiffness with β<sub>br</sub> = 6EI<sub>x</sub>/S (6.7.4.2.2), brace moment against φM<sub>n</sub> (6.10.8, L<sub>b</sub> = S, C<sub>b</sub> = 1.0), shear, jacking flexure and shear, and the eccentric bolted connection. Nominal dimensions, fillets neglected. Axial load from wind or seismic forces is not considered.</p>
+<h3>Channel diaphragms and the bracing type (Cross-frames)</h3><p>The diaphragm alternative also offers channels (C8x11.5 to MC18x42.7, nominal AISC dimensions; verify). A channel takes the same checks as the rolled W (brace stiffness, brace moment by the 6.10.8 model with L<sub>b</sub> = S and C<sub>b</sub> = 1.0, which is an approximation for a channel, shear, jacking, and the bolted connection), with I<sub>y</sub> about the channel's own centroid, and its depth is compared with half the girder depth. <b>CF10</b> recommends the intermediate bracing type from the girder depth d (out-to-out of the flanges, the "Girder depth d" input, not the web depth): at or above the <b>Minimum girder depth for cross-frames</b> (default 48 in; common practice, e.g. AISC/NSBA G13.1 guidance; owner standards govern; verify) a cross-frame (X or K by S/h, as the auto-design chooses), below it the lightest channel at least half the girder depth, or a rolled W. A cross-frame on a girder below the minimum gives a warning, not a failure. The selected type is never changed automatically; Preliminary sizing sends its own minimum (Framing tab) with the cross-frame geometry, and its Suggest tab states the recommendation.</p>
 <h3>Live load: vehicles and what controls (SA5)</h3><p>At every analysis point the HL-93 design truck (rear axle spacing varied from 14 to 30 ft in 1 ft steps, both directions) and design tandem are moved across the influence line, each with IM, and combined with the design lane load; in negative moment regions and for interior reactions, 90% of two design trucks plus 90% of the lane load is also evaluated. The Combinations tab card <b>Live load: vehicles evaluated and what controls</b> shows, at tenth points, each vehicle's moment per lane, the controlling truck spacing, which combination controls, the distribution factor, and the girder LL+IM; its chart shows every vehicle along the girder. The fatigue table gives the fatigue truck (30 ft rear spacing, IM 15%, one truck) range per lane, the fatigue distribution factor (single-lane ÷ 1.2), the girder range, and the Fatigue I range (× 1.75). Check SA5 records what was evaluated and how often each vehicle controls.</p>
@@ -2138,3 +2140,3 @@
 <h3>DXF export (AutoCAD)</h3><p><b>Format.</b> The default format is an AutoCAD 2018 DXF with the drawings at full size (inches, units stored in the file) in model space and one paper space layout per sheet (tabs 01, 02, …): a true 34 × 22 (or 17 × 11) page with the border and title block and a locked viewport at the sheet scale; plot each layout at 1:1. Linetypes scale with the viewport (PSLTSCALE on). Every layout's page setup is ready to plot: DWG To PDF.pc3, ANSI full-bleed D (or B) paper, 1:1, and the monochrome.ctb plot style, so all sheets plot black and white. To plot the whole set to one PDF, type PUBLISH in AutoCAD, keep the listed layouts (remove the Model entry), set Publish to PDF with Multi-sheet file, and click Publish. With Elevation of every girder selected, each girder also gets its own elevation sheet with its bearing stations, connection plates, moment envelope, and camber. Everything in model space lies on a sheet: each sheet's drawings are sized to fit its viewport with a 1/4 in. margin (text and dimension extents included), no two viewports show the same area, and the export warns if a sheet cannot fit even at 1:1200. This format is written by the ezdxf library running in the browser; the first export downloads it (internet needed, about 15–30 s), later exports are quick. The R12 option works offline and draws each sheet's border around the drawings in model space instead (plot each by window at the scale in its title block).</p><p><b>Also:</b> analysis diagrams for an exterior girder (G1) and an interior girder (G2): moment and shear envelopes (DC1, DC2 + DW, LL+IM, Strength I, values labeled), top and bottom flange stresses by stage with Service II against 0.95F<sub>y</sub>, and dead load deflections, each band at a stated vertical scale; a design summary (every Girder section check with its governing ratio and location, and each detail module's Design all result); and a standard details sheet filled in from the design (bolt holes and edge distances, stiffener clip and weld termination, connection plate at the tension flange, shear studs, flange transitions, splice fillers, camber measurement, bearing stiffeners at skewed supports, weld symbol legend) with typical construction staging notes. A load rating table will follow once rating is added.</p><p><b>Sheets available:</b> cover and sheet index with a revisions table; framing plan (top flanges to scale, connection plates, bearing and intermediate stiffeners, top flange splice plates, bearings, dimension chains, girder length and cross-frame location tables, and callouts to the cross-frame details); erection diagram with piece marks, the shipping piece table (plate weights at 490 pcf, plus 5% for details, heaviest piece flagged), steel by girder, and girder work points relative to CL bearing Abut. 1 at G1; girder elevation and camber with callouts to the connection plate, bearing stiffener, and splice sheets (sheet numbers filled in); typical section with flange-to-web weld symbols, general notes, and quantities; bearing reactions (unfactored DC1, DC2, DW, LL+IM max and min, pedestrian, service max and min, uplift flagged) for every girder and support; fatigue and fracture tables; deck overhang with the temporary bracket; every field splice; bearing stiffener, cross-frame (intermediate, end cross-frame along the skew, typical connection), stiffener and connection plate, shear connector, and flange transition details with weld symbols. In the layout format, bolts are GD_BOLT blocks and callouts are GD_SECT blocks with a TAG attribute. Not generated: sole plate and bearing details (bearings are not designed here), a deck placement sequence (needs a staged deck analysis), survey coordinates (work points are given relative to the girder layout), and office title blocks or layer standards (supply them to have them used).</p><p><b>Export DXF</b> (top bar) writes plot-ready sheets. Each sheet is a border and title block (project, project number, sheet title, scale, designed/checked, sheet n of N) drawn at its plot scale around full-size geometry in inches in model space; the scale is the smallest standard scale at which the sheet's content fits (34 × 22 or 17 × 11 sheets), so plot each sheet window at the scale in its title block. Sheets: 1, framing plan with girder spacing, cross-frame spacing along the exterior girders, field splice and span dimensions, the girder length and splice location table, and the cross-frame location table; 2, girder elevation with flange and web plates, connection plates, transverse stiffeners, bearing stiffeners, stud pitch zones, field splices and bearings, plate and span dimension chains, the plate schedule, the total dead load deflection (camber) table for every girder, the deflection components for a chosen girder, and the camber diagram of all girders; 3, the typical cross-section fully dimensioned, general notes (specification, steel, NSTM status, bolts, studs, deck, welding, camber), and the quantities from Design all; then one sheet per field splice case of the last Design all (plans of both flange splices and the elevation, with plates, fillers, bolts, and dimension chains of pitches, gages, end distances, and plate sizes); bearing stiffener, cross-frame, transverse stiffener and connection plate, and shear connector details; and flange transition details, one per distinct transition with its locations listed (the sheet is omitted when the girder has no shop transitions). Dimensions are AutoCAD DIMENSION entities with a dimension style per scale (GD + scale: ticks, text 0.1 in above the line, feet-inches to 1/8 in); text uses the GD style (romans.shx). Layers are named by content with the prefix you choose (default S-). Set the drawing units to inches in AutoCAD after opening and save as DWG.</p>
-<h3>Automatic refresh</h3><p>When the bridge changes in Preliminary sizing (spans, skews, girders, spacing, plates, splices), every module is updated automatically about 1.5 s after the last edit: demands are re-imported from the last demand source used (Preliminary sizing, or Structural analysis for a chosen girder), overrides and locked values are kept, auto-design runs if it is switched on in Owner standards, every module's checks are recomputed so the status marks on the module tabs are current, and you stay in the module you are working in. Switch it off with Auto-refresh every module when the bridge changes in Owner standards.</p>
+<h3>Automatic refresh</h3><p>When the bridge changes in Preliminary sizing (spans, skews, girders, spacing, plates, splices), every module is updated automatically about 1.5 s after the last edit: demands are re-imported from the last demand source used (Preliminary sizing, or Structural analysis for a chosen girder), overrides and locked values are kept, auto-design runs if it is switched on in Owner standards, every module's checks are recomputed so the status marks on the module tabs are current, and you stay in the module you are working in. The update runs in the background: no module is drawn while it runs (only the module on screen is redrawn once at the end), so the tab and the scroll position do not change. Switch it off with Auto-refresh every module when the bridge changes in Owner standards.</p>
 <h3>Girder report</h3><p><b>Girder report</b> (top bar) builds one calculation package for a selected girder. Choose the girder, the chapters, and whether to re-run auto-design for that girder (otherwise the plates, bolts, and welds as currently entered are checked). Every module is loaded with that girder's demands from the Structural analysis module (its own distribution factors, dead loads, and effective flange width), and each chapter is that module's full worked report: 1, bridge and girder geometry (bridge data, typical cross-section, framing plan, girder elevation, plate schedule); 2, loads and live load distribution factors with derivations; 3, structural analysis (moment and shear envelopes, reactions, deflections, stresses by construction stage); 4, girder section (Strength I, Service II, constructibility, and fatigue at the critical sections); 5, fatigue details; then one chapter per field splice on the girder; bearing stiffeners; transverse stiffeners and connection plates; shear connectors; cross-frames; deck overhang (exterior girders only); and web-to-flange welds and transitions. The package opens with a title page (girder, source of demands, basis of the details, specification, preparer and checker) and a contents list, starts each chapter on a new page, and carries "Girder G# calculation package" in the running header; print it to PDF. The app returns to the module you started from when printing is finished.</p>
@@ -2148,3 +2150,4 @@
 <h3>Splices from Preliminary sizing</h3><p><b>Sealing, stitching, gage lines, and wrench clearance.</b> DT2 limits the pitch along free edges for sealing, s ≤ 4.0 + 4.0t ≤ 7.0 in (6.13.2.6.2), with t the thinner outside plate: on a flange with inner plates, the thinner of the outer and inner plates. DT3 applies the maximum edge distance 8t ≤ 5.0 in to the splice plates. DT9 applies the stitch-bolt limits of 6.13.2.6.3 to the splice plates, taken to act in compression (the flange splices are designed for P<sub>fy</sub> in tension and compression, and the web plates carry the compressive part of the flange force transferred to the web): pitch s ≤ 12.0t along the force, gage g ≤ 24.0t between lines, including across the web on the outer plate; the end-pitch rule for compression members (6.13.2.6.4) is for built-up members and is not applied. A setting on the Bolts tab makes DT9 advisory instead of required. DT10 is the owner or office minimum number of bolt lines each side of the web (default 2; AASHTO itself requires only two rows along the force, DT6). Staggered holes are not used. DT11 checks the clearance needed to tighten the nuts: flange bolts to the face of the web splice plate, and the web bolts nearest the flanges to the face of the flange splice plates, against C₁ (defaults 1.25, 1.50, 1.625, 1.75 in for 3/4, 7/8, 1, 1-1/8 in bolts; confirm with the AISC Manual Table 7-16 and the fabricator).</p>
-<p><b>Auto-design splice</b> (Splice tab) finds the most economical splice that passes every strength and detailing check (TF, BF, MT, WS, and DT1 to DT11, including plate area not less than the connected area, stitching, the minimum gage lines, and wrench clearance). If a flange is too narrow for the minimum gage lines without staggering, it reports the width needed and leaves the splice unchanged: for each flange it tries double shear (inner plates, where they fit) and single shear with the minimum number of bolt lines (DT10) up to three each side of the web, the first line placed for edge distance and wrench clearance, takes the fewest bolt rows that pass shear and slip, then the thinnest plates (1/16 in steps from 5/16 in, inner and outer areas balanced) that pass bearing, yield, fracture, block shear, fatigue, and the edge-distance limits, and keeps the layout with the fewest bolts, then the least plate steel. The web splice uses plates as deep as the web less the clearances, the fewest bolt columns, the widest vertical pitch the sealing limit allows, and the thinnest passing plate. Geometry is fitted throughout: outer plates to the narrower flange, inner plates to the clearance from the web plate, bolt gages to the edge distances. <b>Undo auto-design</b> restores the previous layout; <b>Fit geometry only</b> keeps your bolts and thicknesses and only fits widths, gages, and the web plate. When a splice is loaded from an analysis, it is auto-designed for those demands automatically. Verification: the example splice drops from 124 to 96 bolts and the Br. 037201 interior splice from 268 to 152, both passing every check; review the result against your standard details.</p>
+<p><b>Auto-design splice</b> (Splice tab) finds the most economical splice that passes every strength and detailing check (TF, BF, MT, WS, and DT1 to DT11, including plate area not less than the connected area, stitching, the minimum gage lines, and wrench clearance). If a flange is too narrow for the minimum gage lines without staggering, it reports the width needed and leaves the splice unchanged: for each flange it tries double shear (inner plates, where they fit) and single shear with the minimum number of bolt lines (DT10) up to three each side of the web, the first line placed for edge distance and wrench clearance, takes the fewest bolt rows that pass shear and slip, then the thinnest plates (1/16 in steps from 5/16 in, inner and outer areas balanced) that pass bearing, yield, fracture, block shear, fatigue, and the edge-distance limits, and keeps the layout with the fewest bolts, then the least plate steel. The web splice uses plates as deep as the web less the clearances, the fewest bolt columns, the widest vertical pitch the sealing limit allows, and the thinnest passing plate. Geometry is fitted throughout: outer plates to the narrower flange, inner plates to the clearance from the web plate, bolt gages to the edge distances. <b>Undo auto-design</b> restores the previous layout; <b>Fit geometry only</b> keeps your bolts and thicknesses and only fits widths, gages, and the web plate. When a splice is loaded from an analysis, it is auto-designed for those demands automatically. Verification: the example splice drops from 124 to 96 bolts and the Br. 037201 interior splice from 268 to 152, both passing every check; review the result against your standard details. Plate thicknesses are standard: 1/16 in steps up to 1 in, 1/8 in steps above; the bolt pitch is at least 3d.</p>
+<h3>Field splices: inclusion and Suggest splice</h3><p><b>Field splices</b> (Splice tab) is "As in Preliminary sizing" by default: the splice module is not included when the last sizing layout received has no field splices; "Included" and "Not included" override that. When splices are not included, no splice checks, results, warnings, report, drawings, Design all rows, quantities, or tab status appear; the module shows one line, "Field splices not included", and the stud module gets no splice gaps from Design all. <b>Suggest splice</b> proposes the location and the size. Location: in a continuous unit, at the dead-load (DC1 + DC2 + DW) points of contraflexure next to each interior pier, from the Structural analysis module for an interior girder, rounded to the nearest foot (6.13.6.1.1); in simple spans, the girder ends at the piers; then any field section longer than the <b>Maximum field-section length</b> (default 120 ft, a shipping and erection assumption; verify) is divided into equal lengths (an odd number in a simple span, so no splice falls at midspan), and a splice closer than the <b>Minimum distance from a support</b> (default 10 ft; verify) is moved to that distance. The suggested stations are listed beside the ones in Preliminary sizing; the splice stations themselves are set on its Girder tab (your stations are kept until you change them). Size: Auto-design splice is run with each bolt diameter offered (7/8, 1, and 1-1/8 in; only the Bolts tab diameter when it is locked), and the layout that passes every splice check with the least cost of bolts (installed) plus plate steel (per lb), from the Owner standards, is kept. When demands are imported, the splice is auto-designed with the Bolts tab diameter. Plates or bolt diameter you edit are kept by imports and refreshes until you press Suggest splice or Auto-design splice. The splice checks themselves are unchanged.</p>
 <ol><li><b>Project tab.</b> Fill in the calculation header. To start from PlateLine, send the splices from PlateLine's Analysis tab (same browser and site), or import PlateLine's splice JSON with Import JSON, then choose a splice under Import from PlateLine.</li>
@@ -2644,12 +2647,16 @@
 const CF_MEM = [['top', 'Top chord'], ['bot', 'Bottom chord'], ['diag', 'Diagonals']];
+/* channels for diaphragms on shallow girders: [name, d, b_f, t_f (average), t_w] in in, nominal dimensions from the AISC Manual (verify) */
+const CF_CH = [['C8x11.5', 8.00, 2.26, 0.390, 0.220], ['C10x15.3', 10.0, 2.60, 0.436, 0.240], ['C12x20.7', 12.0, 2.94, 0.501, 0.282], ['MC12x31', 12.0, 3.67, 0.700, 0.370], ['C15x33.9', 15.0, 3.40, 0.650, 0.400], ['MC18x42.7', 18.0, 3.95, 0.625, 0.450]];
 const CF_DIA = [['W18x35', 17.7, 6.00, 0.425, 0.300], ['W21x44', 20.7, 6.50, 0.450, 0.350], ['W24x55', 23.6, 7.01, 0.505, 0.395], ['W24x76', 23.9, 8.99, 0.680, 0.440], ['W27x84', 26.7, 9.96, 0.640, 0.460], ['W30x99', 29.7, 10.5, 0.670, 0.520], ['W33x118', 32.9, 11.5, 0.740, 0.550], ['W36x135', 35.6, 12.0, 0.790, 0.600]];
 function cfDiaChecks(R, out) {
-  const p = R.p, q = p.dia || {}; if (q.on !== 'yes') return; const pre = CF_DIA.find(s => s[0] === q.shape), d = pre ? pre[1] : +q.d, bf = pre ? pre[2] : +q.bf, tf = pre ? pre[3] : +q.tf, tw = pre ? pre[4] : +q.tw, Fy = +q.gr || 50, E = 29000, S = R.S, SB = R.SB;
-  const hw = d - 2 * tf, A = 2 * bf * tf + hw * tw, Ix = bf * d ** 3 / 12 - (bf - tw) * hw ** 3 / 12, Sx = 2 * Ix / d, Iy = 2 * tf * bf ** 3 / 12 + hw * tw ** 3 / 12, ry = Math.sqrt(Iy / A), Dg = SB ? SB.Dg : null, nm_ = pre ? q.shape : `W ${f2(d)} x ${f2(bf)}`;
+  const p = R.p, q = p.dia || {}; if (q.on !== 'yes') return; const chS = CF_CH.find(s => s[0] === q.shape), pre = CF_DIA.find(s => s[0] === q.shape) || chS, d = pre ? pre[1] : +q.d, bf = pre ? pre[2] : +q.bf, tf = pre ? pre[3] : +q.tf, tw = pre ? pre[4] : +q.tw, Fy = +q.gr || 50, E = 29000, S = R.S, SB = R.SB;
+  const hw = d - 2 * tf, A = 2 * bf * tf + hw * tw, Ix = bf * d ** 3 / 12 - (bf - tw) * hw ** 3 / 12, Sx = 2 * Ix / d,
+    Iy = chS ? (() => { const xb = (hw * tw * tw / 2 + 2 * bf * tf * bf / 2) / A; return hw * tw ** 3 / 12 + hw * tw * (tw / 2 - xb) ** 2 + 2 * (tf * bf ** 3 / 12 + bf * tf * (bf / 2 - xb) ** 2); })() : 2 * tf * bf ** 3 / 12 + hw * tw ** 3 / 12, /* channel: I_y about its own centroid */ ry = Math.sqrt(Iy / A), Dg = SB ? SB.Dg : null, nm_ = pre ? q.shape : `W ${f2(d)} x ${f2(bf)}`;
   const lt = ltbFnc({ bfc: bf, tfc: tf, Dc: hw / 2, tw, Lb: S, Cb: 1.0, Rb: 1, Rh: 1, Fyc: Fy, Fyw: Fy }), Mn = lt.Fnc * Sx;   // 6.10.8 for a noncomposite rolled I-section, Lb = girder spacing
   const k = 5, lam = hw / tw, r1 = 1.12 * Math.sqrt(E * k / Fy), r2 = 1.40 * Math.sqrt(E * k / Fy), C = lam <= r1 ? 1 : lam <= r2 ? r1 / lam : 1.57 / lam ** 2 * (E * k / Fy), Vn = C * 0.58 * Fy * hw * tw;
-  const c = { id: 'CFD', grp: 'Rolled diaphragm alternative', title: `Rolled diaphragm ${nm_} (alternative to the cross-frame)`, ref: 'AASHTO LRFD 6.7.4.2, 6.7.4.2.2, 6.10.8, 6.10.9, 6.13.2, 3.4.3.1', src: 'Code', sym: T`\beta_{br} = \frac{6EI_x}{S},\quad M_{br} \le \phi_f M_n`, cols: ['Check', 'Demand', 'Resistance', 'Ratio'], items: [],
-    note: `Properties from nominal dimensions (d = ${f2(d)}, b_f = ${f2(bf)}, t_f = ${f3(tf)}, t_w = ${f3(tw)} in; fillets neglected): I_x = ${f0(Ix)} in⁴, S_x = ${f0(Sx)} in³, r_y = ${f2(ry)} in. Flexural resistance per 6.10.8 as a noncomposite rolled I-section braced only at the girders (L_b = S, C_b = 1.0, conservative). The brace stiffness 6EI/S assumes reverse-curvature bending between girders.` };
+  const c = { id: 'CFD', grp: 'Rolled diaphragm alternative', title: `${chS ? 'Channel' : 'Rolled'} diaphragm ${nm_} (alternative to the cross-frame)`, ref: 'AASHTO LRFD 6.7.4.2, 6.7.4.2.2, 6.10.8, 6.10.9, 6.13.2, 3.4.3.1', src: 'Code', sym: T`\beta_{br} = \frac{6EI_x}{S},\quad M_{br} \le \phi_f M_n`, cols: ['Check', 'Demand', 'Resistance', 'Ratio'], items: [],
+    note: `Properties from nominal dimensions (d = ${f2(d)}, b_f = ${f2(bf)}, t_f = ${f3(tf)}, t_w = ${f3(tw)} in; fillets neglected): I_x = ${f0(Ix)} in⁴, S_x = ${f0(Sx)} in³, r_y = ${f2(ry)} in. Flexural resistance per 6.10.8 as a noncomposite rolled I-section braced only at the girders (L_b = S, C_b = 1.0, conservative). The brace stiffness 6EI/S assumes reverse-curvature bending between girders.${chS ? ' Channel: the same checks as the rolled W diaphragm; the 6.10.8 lateral-torsional buckling model is for I-sections and is used here as an approximation for the channel (verify against AISC 360-16 F2 with c = (h_o/2)√(I_y/C_w)).' : ''}` };
   const it = (loc, dem, res, st, r) => c.items.push({ loc, cells: [dem, res, r != null ? f2(r) : '—'], st, r, work: T`\text{${loc}}` });
-  if (Dg) it('Depth (6.7.4.2: at least 0.75 of the plate girder depth)', `${f2(d)} in`, `${f2(0.75 * Dg)} in`, d >= 0.75 * Dg - 1e-6 ? 'pass' : 'warn', 0.75 * Dg / d);
+  if (chS) { const dgT = nm(p.dg); if (dgT > 0) it('Depth (at least about half the girder depth; 6.7.4.2: 0.5 of a rolled beam depth)', `${f2(d)} in`, `${f2(0.5 * dgT)} in`, d >= 0.5 * dgT - 1e-6 ? 'pass' : 'warn', 0.5 * dgT / d); }
+  else if (Dg) it('Depth (6.7.4.2: at least 0.75 of the plate girder depth)', `${f2(d)} in`, `${f2(0.75 * Dg)} in`, d >= 0.75 * Dg - 1e-6 ? 'pass' : 'warn', 0.75 * Dg / d);
   if (SB) { const bbr = 6 * E * Ix / S, bT = 1 / (1 / bbr + (isFinite(SB.bsec) ? 1 / SB.bsec : 0) + 1 / SB.bg), r = SB.bReq / bT;
@@ -2669,4 +2676,4 @@
   id: 'cf', label: 'Cross-frames', title: 'intermediate cross-frames, AASHTO LRFD 6.7.4, 6.9.4.4', rptTitle: 'Cross-Frame Design', rptRef: 'AASHTO LRFD Articles 4.6.2.7, 6.7.4, 6.8, 6.9.4.4, and 6.13.2',
-  groups: ['Members', 'Connections'], itabs: [['cf_geo', 'Geometry and loads'], ['cf_mem', 'Members']],
-  def: { type: 'X', S: 114, h: 48, dg: 62.5, Lb: 25, gA: '36', gG: '50', primary: 'no', dia: { on: 'no', shape: 'W21x44', d: 20.7, bf: 6.5, tf: 0.45, tw: 0.35, gr: '50', nb: 4, pitch: 3, ecc: 3.5, end: 'no', Rj: 0, aj: 12, P: 0 },
+  groups: ['Members', 'Connections', 'Bracing type'], itabs: [['cf_geo', 'Geometry and loads'], ['cf_mem', 'Members']],
+  def: { type: 'X', S: 114, h: 48, dg: 62.5, dMinXF: 48, Lb: 25, gA: '36', gG: '50', primary: 'no', dia: { on: 'no', shape: 'W21x44', d: 20.7, bf: 6.5, tf: 0.45, tw: 0.35, gr: '50', nb: 4, pitch: 3, ecc: 3.5, end: 'no', Rj: 0, aj: 12, P: 0 },
     wind: { V: 130, Kz: 1.0, G: 1.0, Cd: 1.3 },
@@ -2681,2 +2688,3 @@
         ${fld('Girder spacing S', 'cf.S', 'in')}${fld('Chord work-point depth h', 'cf.h', 'in')}${fld('Girder depth d', 'cf.dg', 'in')}${fld('Cross-frame spacing L<sub>b</sub>', 'cf.Lb', 'ft')}
+        ${fld('Minimum girder depth for cross-frames', 'cf.dMinXF', 'in', 'num', { full: true, note: 'common practice (e.g. AISC/NSBA G13.1 guidance; owner standards govern); verify' })}
         ${fld('Primary members', 'cf.primary', '', 'sel', { options: [['no', 'No (straight, skew ≤ 20°)'], ['yes', 'Yes (curved or skewed)']] })}<div></div></div>
@@ -2693,3 +2701,3 @@
         ${CF_MEM.map(([k, l]) => `<h4 class="sub-h full">${l}</h4>${mem(k)}`).join('')}</div>
-        ${secHd('sec-cfd', 'Rolled diaphragm alternative')}<div class="sec-body" id="sec-cfd">${fld('Check a rolled W-shape diaphragm', 'cf.dia.on', '', 'sel', { options: [['no', 'No'], ['yes', 'Yes']] })}${fld('Shape (nominal dimensions)', 'cf.dia.shape', '', 'sel', { options: CF_DIA.map(s => [s[0], s[0]]).concat([['custom', 'Custom (enter below)']]) })}${fld('Depth d', 'cf.dia.d', 'in')}${fld('Flange width b<sub>f</sub>', 'cf.dia.bf', 'in')}${fld('Flange thickness t<sub>f</sub>', 'cf.dia.tf', 'in')}${fld('Web thickness t<sub>w</sub>', 'cf.dia.tw', 'in')}${fld('Grade', 'cf.dia.gr', '', 'sel', { options: [['36', '36'], ['50', '50']] })}${fld('Bolts per end (one vertical line)', 'cf.dia.nb', '')}${fld('Bolt pitch', 'cf.dia.pitch', 'in')}${fld('Bolt line to girder web', 'cf.dia.ecc', 'in')}${fld('End diaphragm (jacking)', 'cf.dia.end', '', 'sel', { options: [['no', 'No'], ['yes', 'Yes']] })}${fld('Jacking reaction per jack, 1.3 × permanent (3.4.3.1)', 'cf.dia.Rj', 'kip')}${fld('Jack offset from girder centerline', 'cf.dia.aj', 'in')}</div>
+        ${secHd('sec-cfd', 'Rolled or channel diaphragm alternative')}<div class="sec-body" id="sec-cfd">${fld('Check a rolled W or channel (C, MC) diaphragm', 'cf.dia.on', '', 'sel', { options: [['no', 'No'], ['yes', 'Yes']] })}${fld('Shape (nominal dimensions)', 'cf.dia.shape', '', 'sel', { options: CF_DIA.map(s => [s[0], s[0]]).concat(CF_CH.map(s => [s[0], `${s[0]} (channel)`]), [['custom', 'Custom W (enter below)']]) })}${fld('Depth d', 'cf.dia.d', 'in')}${fld('Flange width b<sub>f</sub>', 'cf.dia.bf', 'in')}${fld('Flange thickness t<sub>f</sub>', 'cf.dia.tf', 'in')}${fld('Web thickness t<sub>w</sub>', 'cf.dia.tw', 'in')}${fld('Grade', 'cf.dia.gr', '', 'sel', { options: [['36', '36'], ['50', '50']] })}${fld('Bolts per end (one vertical line)', 'cf.dia.nb', '')}${fld('Bolt pitch', 'cf.dia.pitch', 'in')}${fld('Bolt line to girder web', 'cf.dia.ecc', 'in')}${fld('End diaphragm (jacking)', 'cf.dia.end', '', 'sel', { options: [['no', 'No'], ['yes', 'Yes']] })}${fld('Jacking reaction per jack, 1.3 × permanent (3.4.3.1)', 'cf.dia.Rj', 'kip')}${fld('Jack offset from girder centerline', 'cf.dia.aj', 'in')}</div>
         ${secHd('sec-cfc', 'End connections')}<div class="sec-body" id="sec-cfc">${fld('Bolt diameter', 'cf.conn.d', '', 'sel', { options: [['0.875', '7/8 in'], ['1', '1 in']] })}${fld('Grade', 'cf.conn.gr', '', 'sel', { options: [['A325', 'F3125 A325'], ['A490', 'F3125 A490']] })}
@@ -2705,2 +2713,3 @@
     ['s', 'e', 'tg'].forEach(k => { if (!(nm(C[k]) > 0)) errors.push(`Connection "${k}" must be positive.`); });
+    if (!(nm(p.dMinXF) > 0)) errors.push('The minimum girder depth for cross-frames must be positive.');
     ['StrI', 'Con'].forEach(c => ['top', 'bot', 'diag'].forEach(k => { if (!isFinite(nm(p.user[c][k]))) errors.push(`User force ${c} ${k} must be a number.`); }));
@@ -2826,2 +2835,8 @@
     cfDiaChecks(R, out);
+    { const TR = cfTypeRec(R.p), c = { id: 'CF10', grp: 'Bracing type', title: 'Intermediate bracing type for the girder depth', ref: 'Common practice (e.g. AISC/NSBA G13.1 guidance; owner standards govern); AASHTO LRFD 6.7.4.2', src: 'Practice',
+        sym: T`d \ge d_{min} = ${f2(TR.dMin)}\ \text{in} \Rightarrow \text{cross-frame}; \qquad d < d_{min} \Rightarrow \text{channel (C, MC) or rolled W diaphragm}`, cols: ['Girder depth d', 'Minimum for cross-frames', 'Recommended', 'Selected'], items: [],
+        note: 'Basis: the girder depth d (out-to-out of the flanges, the "Girder depth d" input), not the web depth. Below the minimum, a cross-frame is too shallow for efficient diagonals, so a channel (depth about half the girder depth or more) or a rolled W diaphragm is used; the selected type is never changed automatically. The rolled or channel diaphragm is checked on the Members tab (Rolled or channel diaphragm alternative).' };
+      c.items.push({ loc: 'Intermediate bracing', cells: [`${f2(TR.dg)} in`, `${f2(TR.dMin)} in`, TR.rec, TR.sel], st: TR.deep || !TR.xf ? 'pass' : 'warn',
+        work: TR.deep ? T`d = ${f2(TR.dg)} \ge ${f2(TR.dMin)}\ \text{in: cross-frames}` : T`d = ${f2(TR.dg)} < ${f2(TR.dMin)}\ \text{in: ${TR.xf ? 'cross-frame selected; a channel or rolled diaphragm is recommended' : 'diaphragm selected'}}` });
+      out.add(c); }
     return out;
@@ -2842,2 +2857,11 @@
 };
+/* recommended intermediate bracing type from the girder depth (2026-10-12): cross-frame at or above the minimum depth (X or K by S/h, as the auto-design does),
+   otherwise the lightest channel at least half the girder depth, or else the lightest W at least half the girder depth */
+function cfTypeRec(p) {
+  const dg = nm(p.dg), dMin = nm(p.dMinXF), S = nm(p.S), h = nm(p.h), deep = dg >= dMin - 1e-9, xf = (p.dia || {}).on !== 'yes';
+  const ch = CF_CH.filter(s => s[1] >= 0.5 * dg - 1e-9).sort((a, b) => (2 * a[2] * a[3] + (a[1] - 2 * a[3]) * a[4]) - (2 * b[2] * b[3] + (b[1] - 2 * b[3]) * b[4]))[0], w = CF_DIA.find(s => s[1] >= 0.5 * dg - 1e-9);
+  const rec = deep ? `${S / h > 1.5 ? 'K' : 'X'}-frame (S/h = ${f2(S / h)})` : ch ? `channel diaphragm ${ch[0]} (or a rolled W)` : w ? `rolled diaphragm ${w[0]}` : 'rolled W diaphragm';
+  const sel = xf ? ({ X: 'X-frame', Kb: 'K-frame', Kt: 'K-frame' }[p.type] || 'cross-frame') : `${CF_CH.some(s => s[0] === (p.dia || {}).shape) ? 'channel' : 'rolled'} diaphragm ${(p.dia || {}).shape === 'custom' ? 'custom W' : (p.dia || {}).shape}`;
+  return { dg, dMin, deep, xf, rec, sel, ch: ch && ch[0], w: w && w[0] };
+}
 function cfSVG(R) {
@@ -3666,3 +3690,3 @@
       add.push({ ...common, name: `${r.name}: bottom flange at flange-to-web weld`, det: 'B-weld', loc: 'bfo' }, { ...common, name: `${r.name}: top flange at flange-to-web weld`, det: 'B-weld', loc: 'tfo', Vf: 0 }); }); }
-  else if (src === 'splice') { const R = gdCompute(P); if (R.errors.length) return 'Field splice has input errors.'; const s = R.sm, d = P.dem, n2 = v => nm(v);
+  else if (src === 'splice') { if (!spIncl()) return 'Field splices not included.'; const R = gdCompute(P); if (R.errors.length) return 'Field splice has input errors.'; const s = R.sm, d = P.dem, n2 = v => nm(v);
     const common = { ...base, D: R.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT, MfP: n2(d.dMp), MfN: -n2(d.dMn), MD1: n2(d.MDC1), MD2: n2(d.MDC2) + n2(d.MDW), det: 'B-bolt' };
@@ -4906,3 +4930,3 @@
   try { let R, C;
-    if (id === 'splice') { R = gdCompute(P); if (R.errors.length) return { err: true }; C = gdChecks(R); }
+    if (id === 'splice') { if (!spIncl()) return { off: true }; R = gdCompute(P); if (R.errors.length) return { err: true }; C = gdChecks(R); }
     else if (id === 'bstf') { R = bsCompute(P); if (R.errors.length) return { err: true }; C = bsChecks(R); }
@@ -4913,2 +4937,3 @@
 function setMark(id, s) { const el = document.querySelector(`.mtab-s[data-s="${id}"]`); if (!el) return;
+  if (s && s.off) { el.className = 'mtab-s'; el.textContent = '–'; el.setAttribute('aria-label', 'field splices not included'); el.title = 'Field splices not included'; return; }
   el.className = 'mtab-s' + (s ? s.err ? ' err' : s.f ? ' fail' : s.w ? ' warn' : ' pass' : '');
@@ -4980,2 +5005,3 @@
 function srcPanel() {
+  if (GD_BG) return;
   const host = document.getElementById('srcbox'); if (!host) return; const m = GM[P.mod];
@@ -5015,3 +5041,4 @@
   const src = j.srcLabel || 'Preliminary sizing'; let kept = 0, what = '';
-  if (mod === 'splice') { if (!j.splices || !j.splices.length) return 'No field splices in the sizing layout.';
+  if (mod === 'splice') { if (Array.isArray(j.splices)) P.spl.plN = j.splices.length; if (!j.splices || !j.splices.length) { fillInputs(); recompute(); autosave(); return 'No field splices in the sizing layout.'; }
+    if (!spIncl()) return 'Field splices are set to "Not included" on the Splice tab; nothing was loaded.';
     const curFS = (/FS(\d+)/.exec(P.meta.subject || '') || [])[1], s = j.splices.find(q => curFS && q.label.startsWith(`FS${curFS} `)) || j.splices[0];
@@ -5041,3 +5068,4 @@
 const adLocked = path => !!adLocks()[path];
-function markLocks() { const L = adLocks(); document.querySelectorAll('[data-k]').forEach(el => { const on = !!L[el.dataset.k]; el.classList.toggle('locked', on); const lb = el.id && document.querySelector(`label[for="${el.id}"]`); if (lb) lb.classList.toggle('locked', on); }); }
+function markLocks() { const L = adLocks(), lbs = new Map(); document.querySelectorAll('label[for]').forEach(l => { if (!lbs.has(l.htmlFor)) lbs.set(l.htmlFor, l); });   // one lookup table (was one document query per input, about 1.5 s per call with every module's inputs in the page)
+  document.querySelectorAll('[data-k]').forEach(el => { const on = !!L[el.dataset.k]; el.classList.toggle('locked', on); const lb = el.id && lbs.get(el.id); if (lb) lb.classList.toggle('locked', on); }); }
 document.addEventListener('dblclick', e => { const lb = e.target.closest && e.target.closest('label'); if (!lb || !lb.htmlFor) return; const inp = document.getElementById(lb.htmlFor); if (!inp || !inp.dataset.k || inp.dataset.k.startsWith('std.')) return;
@@ -5144,2 +5172,3 @@
     const hk = C0.type === 'X' ? null : C0.type === 'Kb' ? 'top' : 'bot', a = up('diag'), b = hk ? up(hk) : false; if (!a && !b) { out.push('The largest standard angles do not satisfy CF8'); break; } }
+  { const TR = cfTypeRec(C0); if (!TR.deep) out.push(`Girder depth ${f2(TR.dg)} in is below the ${f2(TR.dMin)} in minimum for cross-frames: a ${TR.rec} is recommended${TR.xf ? ' (the cross-frame type is kept; turn on the rolled or channel diaphragm on the Members tab to check one)' : ''}`); }
   const r = adEval('cf'), S = r && r.R.SB;
@@ -5158,3 +5187,3 @@
 function runAutoDesign(mod, quiet) {
-  if (mod === 'splice') { const r = autoDesignSplice(); fillInputs(); recompute(); autosave(); if (!quiet) alert(`Splice auto-design\n\n${r.msg}`); return r.msg; }
+  if (mod === 'splice') { P.spl.own = false; const r = autoDesignSplice(); fillInputs(); recompute(); autosave(); if (!quiet) alert(`Splice auto-design\n\n${r.msg}`); return r.msg; }
   if (!AD[mod]) return null; const root = adRootOf(mod), before = JSON.stringify(P[root]); P._adUndo = P._adUndo || {}; P._adUndo[mod] = before;
@@ -5190,3 +5219,4 @@
   m.innerHTML = `<div class="da-card"><button type="button" class="da-x" id="da_close" aria-label="Close">×</button>${html}</div>`; m.hidden = false; }
-function designAllRun(j, quiet) {
+function designAllRun(j, quiet) { return gdBg(() => designAllRun0(j, quiet)); }
+function designAllRun0(j, quiet) {
   const cur = P.mod, S = { ...STD_COST, ...std() }, q = j.qty || {}, nb = q.nb || 5, lbS = 0.2836, single = j.src === 'sa';
@@ -5195,4 +5225,4 @@
   // 1. every field splice case
-  const spl = []; P.mod = 'splice';
-  (j.splices || []).forEach(s => { importInto('splice', () => spliceApply(j, s), j.srcLabel); const R = gdCompute(P); if (R.errors.length) return; const C = gdChecks(R), W = R.web;
+  const spl = []; P.mod = 'splice'; if (Array.isArray(j.splices)) P.spl.plN = j.splices.length; const splOn = spIncl();   // excluded field splices: no cases, no status, no quantities, no conflicts
+  (splOn ? (j.splices || []) : []).forEach(s => { importInto('splice', () => spliceApply(j, s), j.srcLabel); const R = gdCompute(P); if (R.errors.length) return; const C = gdChecks(R), W = R.web;
     const fl = F => (F.bo * F.to + (F.inner ? 2 * F.bi * F.ti : 0)) * F.Lpl * lbS, Lw = parseDim(P.bolts.gap) + 2 * (parseDim(P.web.ew) + (W.ncw - 1) * parseDim(P.web.sh) + parseDim(P.web.ewp));
@@ -5203,5 +5233,7 @@
   if (spl.length) { P.sc.splX = [...new Set(spl.map(s => +(+s.x).toFixed(2)))].join(', '); P.sc.splL = +(Math.max(...spl.map(s => s.Lpl)) / 12).toFixed(2); P.mod = 'sc'; if (std().auto !== 'off') runAutoDesign('sc', true); }
+  else if (!splOn && (P.sc.splX || +P.sc.splL)) { P.sc.splX = ''; P.sc.splL = 0; P.mod = 'sc'; if (std().auto !== 'off') runAutoDesign('sc', true); }   // splices not included: no stud gaps for splice plates
   // 4. status of every module
   const mods = ['splice', 'bstf', 'ts', 'sc', 'cf', 'oh', 'wt', 'gs', 'fa'], stat = [];
-  mods.forEach(mm => { P.mod = mm; let R, C; try { if (mm === 'splice') { R = gdCompute(P); C = R.errors.length ? null : gdChecks(R); } else { const e = adEval(mm); R = e && e.R; C = e && e.C; } } catch (er) { C = null; }
+  mods.forEach(mm => { if (mm === 'splice' && !splOn) { stat.push({ mm, name: 'Field splices', fails: [], warns: [], note: '', off: true }); return; }
+    P.mod = mm; let R, C; try { if (mm === 'splice') { R = gdCompute(P); C = R.errors.length ? null : gdChecks(R); } else { const e = adEval(mm); R = e && e.R; C = e && e.C; } } catch (er) { C = null; }
     const name = mm === 'splice' ? 'Field splices' : mm === 'bstf' ? 'Bearing stiffeners' : GM[mm].label;
@@ -5215,3 +5247,3 @@
   const splN = spl.reduce((a, s) => a + cnt(s.label), 0), splB = spl.reduce((a, s) => a + s.bolts * cnt(s.label), 0), splLb = spl.reduce((a, s) => a + s.lb * cnt(s.label), 0);
-  add(`Field splices (${splN} girder splices): plates`, splLb / 1000, 'kip', splLb * S.cDet); add('Field splices: bolts', splB, 'each', splB * S.cBolt);
+  if (splOn) { add(`Field splices (${splN} girder splices): plates`, splLb / 1000, 'kip', splLb * S.cDet); add('Field splices: bolts', splB, 'each', splB * S.cBolt); }
   const ty = P.ts.types, cpT = ty.B || Object.values(ty)[0], stT = ty.A || cpT, nCP = Math.max(0, (q.frames || 0) - (q.framesSup || 0)) * 2, cpLb = nCP * parseDim(cpT.bt) * parseDim(cpT.tp) * D * lbS * (cpT.sides === '2' ? 2 : 1);
@@ -5227,3 +5259,3 @@
   const conf = [], Lh = spl.length ? Math.max(...spl.map(s => s.Lpl)) / 24 : 0, clr = 0.5;
-  (q.splX || []).forEach(sx => (q.frX || []).forEach(fx => { if (Math.abs(fx - sx) < Lh + clr) conf.push(`Cross-frame at ${f2(fx)} ft is within the field splice plates at ${f2(sx)} ft (plates extend ±${f2(Lh)} ft): move the cross-frame or the splice`); }));
+  (splOn ? (q.splX || []) : []).forEach(sx => (q.frX || []).forEach(fx => { if (Math.abs(fx - sx) < Lh + clr) conf.push(`Cross-frame at ${f2(fx)} ft is within the field splice plates at ${f2(sx)} ft (plates extend ±${f2(Lh)} ft): move the cross-frame or the splice`); }));
   (q.trX || []).forEach(tx => (q.frX || []).forEach(fx => { if (Math.abs(fx - tx) < 0.5) conf.push(`Cross-frame at ${f2(fx)} ft is within 6 in of the flange shop transition at ${f2(tx)} ft`); }));
@@ -5234,3 +5266,3 @@
   daModal(`<h3>Design all: ${esc(j.srcLabel || 'Preliminary sizing')}</h3>
-    <table class="tbl"><thead><tr><th>Module</th><th>Result</th></tr></thead><tbody>${stat.map(s => `<tr><td class="lbl">${s.name}</td><td>${s.fails.length ? `<b class="st-fail">Fails: ${s.fails.join(', ')}</b>` : '<span class="st-pass">All checks pass</span>'}${s.warns.length ? `; warnings ${s.warns.join(', ')}` : ''}${s.note ? `; ${s.note}` : ''}</td></tr>`).join('')}</tbody></table>
+    <table class="tbl"><thead><tr><th>Module</th><th>Result</th></tr></thead><tbody>${stat.map(s => `<tr><td class="lbl">${s.name}</td><td>${s.off ? 'Field splices not included' : s.fails.length ? `<b class="st-fail">Fails: ${s.fails.join(', ')}</b>` : '<span class="st-pass">All checks pass</span>'}${s.warns.length ? `; warnings ${s.warns.join(', ')}` : ''}${s.note ? `; ${s.note}` : ''}</td></tr>`).join('')}</tbody></table>
     <h4>Quantities and costs</h4><table class="tbl"><thead><tr><th>Item</th><th class="right">Quantity</th><th class="right">Cost</th></tr></thead><tbody>${cost.map(c => `<tr><td class="lbl">${c.item}</td><td class="val">${c.unit === 'kip' ? f2(c.qn) : f0(c.qn)} ${c.unit}</td><td class="val">${money(c.c)}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td></td><td class="val"><b>${money(total)}</b></td></tr></tbody></table>
@@ -5238,3 +5270,3 @@
     <h4>Redundancy (NSTM)</h4><p>${nb >= 4 ? `${nb} girders: load-path redundant; the girders are not nonredundant steel tension members (NSTM).` : nb === 3 ? '3 girders: NSTM designation of the girder tension zones is an owner decision, which a system-redundancy evaluation can support.' : `${nb} girders: the girder tension flanges and web tension zones are NSTM (10th Ed. 6.6.2): specify the NSTM Charpy requirements of Table 6.6.2.1-2 for the temperature zone, fabrication under the AASHTO/AWS D1.5 Clause 12 fracture control plan, and NSTM inspection.`}</p>
-    <h4>Geometry conflicts</h4>${conf.length ? `<ul>${conf.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : '<p>None found (cross-frames clear of the splice plates and shop transitions; studs omitted over the splice plates with enough remaining).</p>'}`);
+    <h4>Geometry conflicts</h4>${conf.length ? `<ul>${conf.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : (splOn ? '<p>None found (cross-frames clear of the splice plates and shop transitions; studs omitted over the splice plates with enough remaining).</p>' : '<p>None found (cross-frames clear of the shop transitions).</p>')}`);
 }
@@ -5317,2 +5349,3 @@
       if (mod === 'df') DF_VIEW.j = g - 1;
+      if (mod === 'splice' && !spIncl()) { add('Field splices', '<p class="cr-p">Field splices not included.</p>', []); continue; }
       if (mod === 'splice') { for (const s of (j.splices || [])) { importInto('splice', () => spliceApply(j, s), j.srcLabel); const c = await grChapter('splice', k + 1, o, `G${g}: bolted field splice ${s.label.replace(/, G\d+$/, '')}`); add(`Field splice ${s.label}`, c.html, c.toc); } continue; }
@@ -5832,3 +5865,3 @@
   let j = null; try { j = JSON.parse(localStorage.getItem(KEY_IN) || 'null'); } catch (e) {}
-  if (j && j.splices && j.splices.length) { const snap = JSON.stringify(P);
+  if (spIncl() && j && j.splices && j.splices.length) { const snap = JSON.stringify(P);
     try { j.splices.forEach(s => { importInto('splice', () => spliceApply(j, s), j.srcLabel); const R = gdCompute(P); if (!R || !R.fl) return; const mt = /FS(\d+)/.exec(s.label || ''), kk = mt ? +mt[1] - 1 : 0;
@@ -5850,3 +5883,4 @@
   // every field splice case from the last demand import (designed as in Design all), then the state is restored
-  if (o.draw.splice) { const snap = JSON.stringify(P); let j = null; try { j = JSON.parse(localStorage.getItem(KEY_IN) || 'null'); } catch (e) {}
+  if (o.draw.splice && !spIncl()) skip('FIELD SPLICE', 'FIELD SPLICES NOT INCLUDED');
+  if (o.draw.splice && spIncl()) { const snap = JSON.stringify(P); let j = null; try { j = JSON.parse(localStorage.getItem(KEY_IN) || 'null'); } catch (e) {}
     const cases = j && j.splices && j.splices.length ? j.splices : [null];
@@ -6278,2 +6312,3 @@
   const sc = document.querySelector('.tab-panels'), keep = sc ? sc.scrollTop : 0, wasBuilt = !!host.querySelector('.crv-doc');
+  if (!CK && P.mod === 'splice' && !spIncl()) { host.innerHTML = '<div class="alert info"><b>Field splices not included.</b></div>'; CR_STALE = true; return; }
   if (!CK) { host.innerHTML = `<div class="alert fail"><b>The report is unavailable until the input errors are fixed.</b> See the status bar for the list.</div>`; CR_STALE = true; return; }
@@ -6427,2 +6462,7 @@
     splice: `
+      ${secHd('sec-spl', 'Field splices: inclusion and suggestion')}
+      <div class="sec-body" id="sec-spl">${fld('Field splices', 'spl.inc', '', 'sel', { full: true, options: [['auto', 'As in Preliminary sizing (not included when its layout has none)'], ['yes', 'Included'], ['no', 'Not included']] })}
+        ${fld('Maximum field-section length (shipping/erection assumption; verify)', 'spl.maxLen', 'ft')}${fld('Minimum distance from a support', 'spl.minSup', 'ft')}
+        <button type="button" class="proj-btn proj-btn-primary full" id="sp_suggest" style="width:100%">Suggest splice (location and size)</button>
+        <div id="sp_sugbox" class="full"></div></div>
       <div class="pad"><button type="button" class="proj-btn proj-btn-primary" id="sp_auto" style="width:100%">Auto-design splice</button>
@@ -6430,3 +6470,3 @@
         <button type="button" class="proj-btn" id="sp_undo" style="width:100%;margin-top:6px" hidden>Undo auto-design</button>
-        <p class="hint static">Auto-design finds the most economical splice that passes every strength and detailing check: for each flange it tries single and double shear and one to three bolt lines, takes the fewest bolt rows, then the thinnest plates (inner and outer areas balanced); for the web, full-depth plates with the fewest bolt columns and the thinnest plate. Runs automatically when splices come from an analysis.</p></div>
+        <p class="hint static">Suggest splice (above) also compares the bolt diameters and suggests the location. Auto-design finds the most economical splice that passes every strength and detailing check: for each flange it tries single and double shear and one to three bolt lines, takes the fewest bolt rows, then the thinnest plates (inner and outer areas balanced); for the web, full-depth plates with the fewest bolt columns and the thinnest plate. Runs automatically when splices come from an analysis.</p></div>
       ${secHd('sec-gap', 'General')}
@@ -6456,3 +6496,4 @@
 }
-function fillInputs() { $$('[data-k]').forEach(el => { const v = getPath(P, el.dataset.k); if (el.dataset.t === 'bool') el.checked = !!v; else if (el.dataset.t === 'dim') el.value = typeof v === 'number' ? frac(v) : (v ?? ''); else el.value = v ?? ''; }); syncSame();  markOverrides(); if (typeof markLocks === 'function') markLocks(); }
+function fillInputs() { if (GD_BG) { syncSame(); return; }   // background run: the inputs on screen are filled once at the end (gdBg)
+  $$('[data-k]').forEach(el => { const v = getPath(P, el.dataset.k); if (el.dataset.t === 'bool') el.checked = !!v; else if (el.dataset.t === 'dim') el.value = typeof v === 'number' ? frac(v) : (v ?? ''); else el.value = v ?? ''; }); syncSame();  markOverrides(); if (typeof markLocks === 'function') markLocks(); }
 /* field splice: right-side parts that match the left are copied and locked */
@@ -6473,2 +6514,3 @@
   if (/^sec\.(L\.|same\.)/.test(el.dataset.k)) syncSame();
+  if (/^(top|bot|web)\./.test(el.dataset.k) || el.dataset.k === 'bolts.d') P.spl.own = true;   // the user's splice plates and bolts: imports and Suggest keep them
   if (el.dataset.k.startsWith('dem.')) P.source = P.source ? P.source.replace(/ \(edited\)$/, '') + ' (edited)' : '';
@@ -6498,3 +6540,13 @@
 function setMod(m) { if (P.mod === m) return; P.mod = m; P.ui.col = {}; $('#tab-v3d').innerHTML = ''; if (V3) { V3.framed = false; V3.framedB = false; } applyMod(); renderInbox(); recompute(); autosave(); }
+/* background runs (bridge auto-refresh, Design all, Load all): every module is computed and auto-designed without being drawn,
+   so the module on screen, its tab, and its scroll position do not change; the module on screen is redrawn once at the end */
+let GD_BG = 0;
+function gdBg(fn) {
+  const tp = document.querySelector('.tab-panels'), sd = document.getElementById('side'), pos = { tp: tp ? tp.scrollTop : 0, sd: sd ? sd.scrollTop : 0, x: window.scrollX, y: window.scrollY }, mod = P.mod;
+  GD_BG++;
+  try { return fn(); }
+  finally { GD_BG--; if (!GD_BG) { P.mod = mod; fillInputs(); renderInbox(); recompute(); if (tp) tp.scrollTop = pos.tp; if (sd) sd.scrollTop = pos.sd; window.scrollTo(pos.x, pos.y); } }
+}
 function recompute() {
+  if (GD_BG) return;
   applyMod(); refreshMarks();
@@ -6510,2 +6562,4 @@
   }
+  spSugBox();
+  if (!spIncl()) { RS = { errors: ['Field splices not included.'], off: true }; CK = null; renderSplOff(); return; }
   RS = gdCompute(P); showN('sec', RS.MR);
@@ -6517,2 +6571,9 @@
 }
+/* field splices not included: one line where the splice results would be */
+function renderSplOff() { crMarkStale();
+  const why = (P.spl || {}).inc === 'no' ? 'Field splices are set to "Not included" on the Splice tab.' : 'The Preliminary sizing layout has no field splices.';
+  $('#status-bar').innerHTML = `<div class="verdict"><span class="vd-ico">–</span>Field splices not included</div><div class="sb-msg">${why}</div>`;
+  $('#dem-src').innerHTML = '';
+  ['summary', 'combos', 'checks', 'drawings', 'v3d'].forEach(t => { const el = $('#tab-' + t); if (el) el.innerHTML = t === 'summary' ? `<div class="alert info" style="margin:0"><b>Field splices not included.</b> ${why} No splice checks are made. To design a splice, set "Field splices" on the Splice tab to Included, or add field splices in Preliminary sizing.</div>` : ''; });
+}
 function typeset(root) { if (window.MathJax && MathJax.typesetPromise) { const els = root ? [root] : ['#tab-summary', '#tab-combos', '#tab-cap', '#tab-geometry', '#tab-checks', '#tab-manual'].map(s => $(s)).filter(Boolean); try { MathJax.typesetClear(els); } catch (e) {} MathJax.typesetPromise(els).catch(() => {}); } }
@@ -6746,3 +6807,3 @@
     if (!fails.length) break; let ch = false;
-    const thick = F => { F.to = parseDim(F.to) + 0.0625; if (F.inner) F.ti = parseDim(F.ti) + 0.0625; ch = true; };
+    const thick = F => { F.to = spNextT(parseDim(F.to)); if (F.inner) F.ti = spNextT(parseDim(F.ti)); ch = true; };
     if (fails.some(id => /^TF[123]$/.test(id)) && P.top.nr < 14) { P.top.nr++; ch = true; }
@@ -6752,3 +6813,3 @@
     if (fails.some(id => /^WS[123]$/.test(id)) && P.web.nc < 4) { P.web.nc++; ch = true; }
-    if (fails.some(id => /^WS[45]$/.test(id))) { P.web.t = parseDim(P.web.t) + 0.0625; ch = true; }
+    if (fails.some(id => /^WS[45]$/.test(id))) { P.web.t = spNextT(parseDim(P.web.t)); ch = true; }
     if (!ch) break;
@@ -6772,4 +6833,4 @@
   // ---- web: full-depth plates, fewest columns, then thinnest plate
-  const designWeb = () => { const hw = q2(R0.D - 2 * cv); P.web.h = hw; P.web.sh = 3; let best = null;
-    for (let nc = 1; nc <= 4; nc++) for (const sv of [3, 3.5, 4, 4.5, 5, 5.5, 6]) { const tMin = Math.max(0.3125, std().minPlate); const nr = Math.max(2, 1 + Math.floor((hw - 2 * em) / sv + 1e-9)), bolts = 2 * nr * nc; if (best && bolts > best.bolts) continue;
+  const designWeb = () => { const hw = q2(R0.D - 2 * cv); P.web.h = hw; P.web.sh = Math.max(3, u4(3 * d)); let best = null;
+    for (let nc = 1; nc <= 4; nc++) for (const sv of [3, 3.5, 4, 4.5, 5, 5.5, 6]) { if (sv < 3 * d - 1e-9) continue; /* pitch at least 3d (6.13.2.6.1) */ const tMin = Math.max(0.3125, std().minPlate); const nr = Math.max(2, 1 + Math.floor((hw - 2 * em) / sv + 1e-9)), bolts = 2 * nr * nc; if (best && bolts > best.bolts) continue;
       P.web.nc = nc; P.web.sv = sv; P.web.nr = nr;
@@ -6781,3 +6842,3 @@
     for (const inner of [true, false]) for (let nl = nMin; nl <= Math.max(nMin, 3); nl++) {
-      F.bo = bmin; F.g = g; F.inner = inner;
+      F.bo = bmin; F.g = g; F.inner = inner; if (parseDim(F.s) < 3 * d - 1e-9) F.s = u4(3 * d);   // pitch at least 3d (only 1-1/8 in bolts change)
       if (inner) { const bi = q4(bmin / 2 - tw / 2 - twp - cw); if (bi < 2 * em + 0.25) continue; F.bi = bi; }
@@ -6787,3 +6848,3 @@
       if (!ok) continue; ok = false;
-      for (let to = Math.max(0.3125, std().minPlate); to <= 2.0 + 1e-9; to += 0.0625) { F.to = to; if (inner) F.ti = Math.max(0.3125, std().minPlate, u16(to * F.bo / (2 * F.bi))); r = run(); if (!r) break;
+      for (let to = Math.max(0.3125, std().minPlate); to <= 2.0 + 1e-9; to = spNextT(to)) { F.to = to; if (inner) F.ti = Math.max(0.3125, std().minPlate, spStdT(to * F.bo / (2 * F.bi))); r = run(); if (!r) break;
         if (good(r.C, [pre + '1', pre + '2', pre + '3', pre + '4', pre + '5', pre + '6']) && good(r.C, DT, part)) { ok = true; break; } }
@@ -6807,5 +6868,64 @@
 document.addEventListener('click', e => { if (P.mod !== 'splice') return;
-  if (e.target.id === 'sp_auto') { const r = autoDesignSplice(); fillInputs(); recompute(); autosave(); alert(`Splice auto-design\n\n${r.msg}\n\nUse "Undo auto-design" to go back.`); spUndoBtn(); }
+  if (e.target.id === 'sp_auto') { P.spl.own = false; const r = autoDesignSplice(); fillInputs(); recompute(); autosave(); alert(`Splice auto-design\n\n${r.msg}\n\nUse "Undo auto-design" to go back.`); spUndoBtn(); }
   else if (e.target.id === 'sp_undo') { undoAutoDesign(); spUndoBtn(); } });
 function spUndoBtn() { const b = document.getElementById('sp_undo'); if (b) b.hidden = !P._spUndo; }
+/* ---------- field splices: inclusion, suggested location, suggested size (2026-10-12) ---------- */
+/* included unless set to "Not included", or set to "As in Preliminary sizing" and the last sizing layout received had no field splices */
+function spIncl() { const s = (P && P.spl) || {}; return s.inc === 'no' ? false : s.inc === 'yes' ? true : s.plN !== 0; }
+/* standard plate thicknesses: 1/16 in steps up to 1 in, 1/8 in steps above */
+const spStdT = v => v <= 1 + 1e-9 ? Math.ceil(v * 16 - 1e-6) / 16 : Math.ceil(v * 8 - 1e-6) / 8;
+const spNextT = t => spStdT(t + (t < 1 - 1e-9 ? 0.0625 : 0.125) - 1e-6);
+/* location: dead-load contraflexure next to each interior pier (continuous), girder ends at piers (simple spans),
+   field sections longer than the maximum divided equally (an odd number of pieces in a simple span), none closer than the minimum to a support */
+function spLocSuggest() {
+  const b = P.df && P.df.bridge, s = P.spl, maxL = nm(s.maxLen), minS = nm(s.minSup);
+  if (!(maxL > 0) || !(minS >= 0)) return { ok: false, msg: 'Enter a positive maximum field-section length and a minimum distance from a support of zero or more.' };
+  if (!b || !b.ok || !Array.isArray(b.spans) || !b.spans.length) return { ok: false, msg: 'The location needs the bridge from Preliminary sizing (spans and continuity).' };
+  const spans = b.spans.map(Number), cont = !!b.cont && spans.length > 1, sup = [0]; spans.forEach(L => sup.push(sup[sup.length - 1] + L)); const Lt = sup[sup.length - 1], x = [], notes = [];
+  let g = 0;
+  if (cont) { g = b.nb >= 3 ? 2 : 1; let R = null; try { R = GM.sa.compute({ ...P.sa, girder: g }); } catch (e) { R = null; }
+    if (!R || (R.errors && R.errors.length)) return { ok: false, msg: `The location needs the Structural analysis module (dead-load moments): ${R && R.errors ? R.errors[0] : 'not available'}` };
+    const X = Array.from(R.xs), M = X.map((_, i) => R.MDC1[i] + R.MDC2[i] + R.MDW[i]), cross = (i, j) => X[i] + (X[j] - X[i]) * M[i] / (M[i] - M[j]);
+    for (let k = 1; k < R.sup.length - 1; k++) { const ip = R.sup[k], Mp = M[ip];
+      for (let i = ip - 1; i >= R.sup[k - 1]; i--) if (M[i] * Mp <= 0 && M[i] !== M[i + 1]) { x.push(Math.round(cross(i, i + 1))); break; }
+      for (let i = ip + 1; i <= R.sup[k + 1]; i++) if (M[i] * Mp <= 0 && M[i] !== M[i - 1]) { x.push(Math.round(cross(i - 1, i))); break; } } }
+  const edges = [...new Set([0, ...(cont ? x : sup.slice(1, -1)), Lt])].sort((a, c) => a - c);
+  for (let i = 0; i < edges.length - 1; i++) { const a = edges[i], len = edges[i + 1] - a; let n = Math.ceil(len / maxL - 1e-9); if (!cont && n > 1 && n % 2 === 0) n++;
+    for (let k = 1; k < n; k++) x.push(Math.round(a + len * k / n)); }
+  const out = [...new Set(x)].sort((a, c) => a - c).map(v => { const near = sup.reduce((p, q) => Math.abs(q - v) < Math.abs(p - v) ? q : p, sup[0]), d = Math.abs(v - near);
+    if (d < minS - 1e-9) { const nv = +(near + (v >= near ? 1 : -1) * minS).toFixed(2); notes.push(`${f2(v)} ft moved to ${f2(nv)} ft (at least ${f2(minS)} ft from the support at ${f2(near)} ft)`); return nv; } return v; });
+  const xs = [...new Set(out)].filter(v => v > 0 && v < Lt).sort((a, c) => a - c);
+  const rule = cont ? `Continuous: at the dead-load (DC1 + DC2 + DW, G${g}) points of contraflexure next to each interior pier, from the Structural analysis module, rounded to the nearest foot; field sections longer than ${f2(maxL)} ft divided into equal lengths; no splice closer than ${f2(minS)} ft to a support.`
+    : `Simple spans: girder ends at the piers (not field splices); a span longer than ${f2(maxL)} ft divided into an odd number of equal pieces (no splice at midspan); no splice closer than ${f2(minS)} ft to a support.`;
+  let cur = []; try { const j = readInbox(); cur = j && Array.isArray(j.splices) ? [...new Set(j.splices.map(q => +(+q.x).toFixed(2)))].sort((a, c) => a - c) : []; } catch (e) {}
+  return { ok: true, x: xs, cur, rule, notes, cont };
+}
+/* size: Auto-design splice for each bolt diameter offered (7/8, 1, 1-1/8 in; only the one on the Bolts tab when it is locked), keep the passing layout with the least
+   bolts-plus-plate cost from the owner standards (bolt installed, detail steel per lb); the splice checks themselves are unchanged */
+function spSuggestSize() {
+  const R0 = gdCompute(P); if (R0.errors.length) return { ok: false, msg: 'Fix the splice input errors first.' };
+  const start = JSON.parse(JSON.stringify({ top: P.top, bot: P.bot, web: P.web, bolts: P.bolts })), S = { ...STD_COST, ...std() }, lbS = 0.2836, ds = adLocked('bolts.d') ? [String(P.bolts.d)] : ['0.875', '1', '1.125'], tried = [];
+  let best = null;
+  for (const dd of ds) { Object.assign(P, JSON.parse(JSON.stringify(start))); P.bolts.d = dd; const r = autoDesignSplice(); const R = gdCompute(P); if (R.errors.length) continue; const C = gdChecks(R), fails = C.filter(c => c.status === 'fail').map(c => c.id), W = R.web;
+    const fl = F => (F.bo * F.to + (F.inner ? 2 * F.bi * F.ti : 0)) * F.Lpl * lbS, Lw = parseDim(P.bolts.gap) + 2 * (parseDim(P.web.ew) + (W.ncw - 1) * parseDim(P.web.sh) + parseDim(P.web.ewp));
+    const bolts = 2 * R.fl.top.n + 2 * R.fl.bot.n + 2 * W.nrw * W.ncw, lb = fl(R.fl.top) + fl(R.fl.bot) + W.Awp * Lw * lbS, cost = bolts * S.cBolt + lb * S.cDet;
+    tried.push({ d: dd, ok: !fails.length, bolts, lb, cost, fails, msg: r.msg, st: JSON.parse(JSON.stringify({ top: P.top, bot: P.bot, web: P.web, bolts: P.bolts })) }); }
+  const pass = tried.filter(t => t.ok); best = pass.length ? pass.reduce((a, t) => t.cost < a.cost - 1e-6 ? t : a) : (tried.find(t => t.d === String(start.bolts.d)) || tried[0]);
+  if (!best) { Object.assign(P, start); return { ok: false, msg: 'No bolt size could be evaluated.' }; }
+  Object.assign(P, JSON.parse(JSON.stringify(best.st))); P._spUndo = start;
+  const tbl = tried.map(t => `${frac(+t.d)} in: ${t.ok ? `${t.bolts} bolts, ${f0(t.lb)} lb of plates, $${f0(t.cost)}` : `does not pass (${t.fails.join(', ')})`}`).join('; ');
+  return { ok: best.ok, d: best.d, msg: `${best.ok ? `Chosen: ${frac(+best.d)} in bolts` : 'No bolt size passes every check; shown'}: ${best.msg} Compared (bolts × $${(+S.cBolt).toFixed(2)} + plate steel × $${(+S.cDet).toFixed(2)}/lb): ${tbl}.`, tried };
+}
+function spSugBox() { const el = document.getElementById('sp_sugbox'); if (!el) return; const s = P.spl || {}, g = s.sug;
+  el.innerHTML = `<p class="hint static">${!spIncl() ? 'Field splices not included.' : s.own ? 'Plates and bolts: entered by you. Imports and Suggest keep them; Suggest splice or Auto-design splice redesigns them.' : 'Plates and bolts: designed automatically when demands are imported (bolt size from the Bolts tab); Suggest splice also compares the bolt sizes.'}</p>`
+    + (g && spIncl() ? `<p class="hint static"><b>Last suggestion (${new Date(g.ts).toLocaleDateString()}).</b> Location: ${g.x && g.x.length ? g.x.map(v => f2(v) + ' ft').join(', ') : 'none needed'}${g.cur && g.cur.length ? `; Preliminary sizing has ${g.cur.map(v => f2(v) + ' ft').join(', ')}` : ''}. ${esc(g.rule || '')} Size: ${esc(g.size || '')}</p>` : ''); }
+function spSuggest() {
+  if (!spIncl()) { alert('Field splices are not included. Set "Field splices" to Included (or add field splices in Preliminary sizing) to get a suggestion.'); return; }
+  const loc = spLocSuggest(), size = spSuggestSize(); P.spl.own = false;
+  P.spl.sug = { ts: Date.now(), x: loc.ok ? loc.x : [], cur: loc.ok ? loc.cur : [], rule: loc.ok ? loc.rule + (loc.notes.length ? ' ' + loc.notes.join('; ') + '.' : '') : loc.msg, size: size.msg, ok: size.ok };
+  fillInputs(); recompute(); autosave(); spUndoBtn();
+  const same = loc.ok && loc.cur.length === loc.x.length && loc.x.every((v, i) => Math.abs(v - loc.cur[i]) < 0.5);
+  alert(`Suggest splice\n\nLocation: ${loc.ok ? `${loc.x.length ? loc.x.map(v => f2(v) + ' ft').join(', ') : 'no field splice needed'}\n${loc.rule}${loc.notes.length ? '\n' + loc.notes.join('\n') : ''}\n${loc.cur.length ? `Preliminary sizing now has: ${loc.cur.map(v => f2(v) + ' ft').join(', ')}${same ? ' (the same).' : '. Move the splices on its Girder tab if you accept the suggestion; the demands follow on the next refresh.'}` : ''}` : loc.msg}\n\nSize (this splice case): ${size.msg}\n\nUse "Undo auto-design" to go back.`);
+}
+document.addEventListener('click', e => { if (e.target.id === 'sp_suggest' && P.mod === 'splice') spSuggest(); });
 document.addEventListener('click', e => { if (e.target.id !== 'sp_fit' || P.mod !== 'splice') return; const r = fitSplice(); fillInputs(); recompute(); autosave(); alert(`Splice fitted to the girder.\n\n${r.msg}`); });
@@ -6813,2 +6933,3 @@
   if (typeof std === 'function' && std().auto === 'off') { P.source += ' Splice plates and bolts as entered (not redesigned for these demands).'; return; }
+  if (P.spl && P.spl.own) { P.source += ' Splice plates and bolts as entered by the user (kept; Suggest splice or Auto-design splice redesigns them).'; return; }
   const fit = autoDesignSplice(); delete P._spUndo; P.source += ` Splice plates and bolts were auto-designed for these demands: ${fit.msg}`; setTimeout(() => flash(fit.ok ? 'Splice plates and bolts auto-designed; every check passes.' : `Splice designed; still failing: ${(fit.fails || []).join(', ')}.`), 300); }
@@ -6825,5 +6946,7 @@
 window.addEventListener('resize', () => { if (P && P.mod === 'pl') $('#pl-wrap').style.top = Math.ceil($('#modbar').getBoundingClientRect().bottom) + 'px'; });
-function loadAllInbox(j) {
+function loadAllInbox(j) { return gdBg(() => loadAllInbox0(j)); }
+function loadAllInbox0(j) {
   const done = [];
-  if (j.splices?.length) { importInto('splice', () => spliceApply(j, j.splices[0]), j.srcLabel); done.push(`Field splice (${j.splices[0].label}; pick another case on its Project tab)`); }
+  if (Array.isArray(j.splices)) P.spl.plN = j.splices.length;   // field splices in the sizing layout (0: none, so the splice module is not included unless set to Included)
+  if (j.splices?.length && spIncl()) { importInto('splice', () => spliceApply(j, j.splices[0]), j.srcLabel); done.push(`Field splice (${j.splices[0].label}; pick another case on its Project tab)`); }
   if (j.bearings?.length) { importInto('bstf', () => bsApply(j), j.srcLabel); done.push('Bearing stiffeners'); }
@@ -6858,3 +6981,3 @@
 const CR_OPTS = [['inputs', 'Input parameters'], ['combos', 'Section properties, loads, and combinations'], ['cap', 'Section capacity (Girder section module)'], ['stress', 'Stresses by construction stage (Structural analysis)'], ['checks', 'Design checks, worked'], ['summary', 'Summary of results'], ['drawings', 'Drawings'], ['manual', 'Appendix: design basis (user manual)']];
-function openReport() { if (P.mod === 'pl') { if (PL_FRAME && PL_FRAME.contentWindow.openReport) PL_FRAME.contentWindow.openReport(); return; } if (!CK) { alert('Fix the input errors before printing.'); return; }
+function openReport() { if (P.mod === 'pl') { if (PL_FRAME && PL_FRAME.contentWindow.openReport) PL_FRAME.contentWindow.openReport(); return; } if (!CK) { alert(P.mod === 'splice' && !spIncl() ? 'Field splices not included: there is no splice report.' : 'Fix the input errors before printing.'); return; }
   const r = P.ui.rpt; $('#rpt-opts').innerHTML = `<div class="ck-row"><input type="checkbox" checked disabled><label>Cover, references, table of contents, and objectives (always printed)</label></div>`
```

### Exact changes: decoded PlateLine (unified diff)

```diff
--- pl_main.html	2026-10-12 19:59:01.324288801 +0000
+++ pl_br.html	2026-10-12 20:26:06.462334120 +0000
@@ -1019,5 +1019,6 @@
   },
-  framing: { spacing: 25, orient: 'auto', arrange: 'contiguous', supClear: 3, stagMin: 4, stiff: 'on', doRatio: 1.0, stB: 6, stT: 0.5, cpB: 6, cpT: 0.5, bsB: 7, bsT: 1, clip: 1, bsPairs: 1, gS: '50' },
+  framing: { spacing: 25, orient: 'auto', arrange: 'contiguous', supClear: 3, stagMin: 4, stiff: 'on', doRatio: 1.0, stB: 6, stT: 0.5, cpB: 6, cpT: 0.5, bsB: 7, bsT: 1, clip: 1, bsPairs: 1, gS: '50', xfMinD: 48 },
   costs: { steel: 3.00, trans: 1500, splice: 6000, stiff: 150, xf: 2500, bearing: 4000 },
   alts: { nbList: '4, 5, 6, 7', ldLo: 22, ldHi: 36, ldStep: 2, web: 'stiffened', holdW: true },
+  ws: { W: '', ohMin: 1.5, ohMax: 4.0, ohS: 0.5, deMin: -1.0, deMax: 5.5, sMin: 3.5, sMax: 16, obj: 'wt' },   // girder count from the out-to-out deck width (2026-10-12); W blank = not used
   suggest: { lsdS: 25, lsdC: 30, keepD: false, web: 'auto', kbt: 6, weld: 1000, eff: 0.85, fws: 25, sip: 15, bar: 0.40, cll: 20, gtype: 'envelope',
@@ -2352,2 +2353,3 @@
 ['p2', 'Using the program', `
+<h3>Girder count from the deck width</h3><p>With an <b>Out-to-out deck width</b> W on the Suggest input tab, <b>Suggest girder count, spacing, and overhangs</b> compares girder counts. For each N from 3, every overhang on a 0.25 ft grid within the limits gives S = (W &minus; 2&middot;overhang)/(N &minus; 1); a layout is kept when S, the overhang (also &le; a fraction of S), and d<sub>e</sub> = overhang &minus; barrier (or curb) width are within the limits (defaults: overhang 1.5 to 4.0 ft and &le; 0.5S; d<sub>e</sub> &minus;1.0 to 5.5 ft; S 3.5 to 16 ft, the ranges of the 4.6.2.2 equations; verify / owner). Of those, the overhang whose exterior and interior girder live load moment distribution factors (this tool's 4.6.2.2 equations, longest span) are closest is used (ties: nearest 0.375S); the girder is then sized with Suggest (fast mode) and checked like an alternative. The table lists N, S, overhang, d<sub>e</sub>, the factors, the section, the steel per girder and in total (lb/ft<sup>2</sup> of deck), the governing ratio of the layout checks, the bracing type from the girder depth, and pass/fail. The recommendation is the passing row with the least total steel (or the fewest girders, if chosen). Nothing changes until you press Apply. With W blank, Suggest uses the girder count and spacing on the Bridge tab as before. Distribution factors are an estimate for comparing layouts: run LL &amp; DL for the chosen layout.</p>
 <h3>Suggest: lowest-cost layout</h3><p>Suggest proposes the web and flange layout and the field splices for the bridge on the Bridge tab, with one layout for all girders (designed for the envelope of the interior and exterior girders). It searches web depths from about L/36 to L/18 and, unless one is chosen, both an unstiffened and a transversely stiffened web, and keeps the layout with the <b>lowest total cost</b>: structural steel (weight × $/lb), flange shop transitions, transverse stiffeners, and field splices, each priced from the <b>Unit costs</b> on the Suggest tab, which are the same single price list used by the Alternatives study (and sent to GirderDetail's Design all). The defaults are placeholders; only their ratios affect the choice, and the tab shows each as an equivalent weight of steel. Within each field piece the flange width is constant and the thicknesses are chosen by an optimization that adds a transition only where it saves more than it costs. Field splices are placed by the program near the dead-load points of contraflexure and within the shipping length and weight, and moved off cross-frame locations where the framing check X4 finds a conflict.</p>
@@ -2583,2 +2585,13 @@
     </div>
+    ${secHd('sec-sgws', 'Girder count from the deck width')}
+    <div class="sec-body" id="sec-sgws">
+      ${fld('Out-to-out deck width', 'ws.W', 'ft', 'num', { full: true, note: '(blank: Suggest uses the girders and spacing on the Bridge tab)' })}
+      ${fld('Overhang, minimum', 'ws.ohMin', 'ft')}${fld('Overhang, maximum', 'ws.ohMax', 'ft')}
+      ${fld('Overhang / S, maximum', 'ws.ohS', '')}${fld('Objective', 'ws.obj', '', 'sel', { options: [['wt', 'Least total steel weight'], ['nb', 'Fewest girders']] })}
+      ${fld('d<sub>e</sub>, minimum (4.6.2.2)', 'ws.deMin', 'ft')}${fld('d<sub>e</sub>, maximum (4.6.2.2)', 'ws.deMax', 'ft')}
+      ${fld('Girder spacing S, minimum', 'ws.sMin', 'ft')}${fld('Girder spacing S, maximum', 'ws.sMax', 'ft')}
+      <p class="note full">Limits: verify / owner. Defaults: overhang 1.5 to 4.0 ft and not more than 0.5S; d<sub>e</sub> from −1.0 to 5.5 ft and S from 3.5 to 16.0 ft (the ranges of the AASHTO 4.6.2.2 distribution factor equations). For each girder count from 3 that fits the limits, S = (W − 2·overhang)/(N − 1), the overhang is chosen to balance the exterior and interior live load moment distribution factors, and the girder is sized with Suggest. Nothing on the Bridge or Girder tab changes until you apply a row.</p>
+      <button type="button" class="proj-btn proj-btn-primary full" id="ws_run">Suggest girder count, spacing, and overhangs</button>
+      <div id="ws_prog" class="full"></div>
+    </div>
     ${secHd('sec-sgload', 'Loads')}
@@ -2781,3 +2794,3 @@
     <li>The suggested layout still has to be verified with the analysis and design apps before use.</li></ul>`);
-  host.innerHTML = h;
+  host.innerHTML = wsHtml() + xfNoteHtml(s) + h;
   $('#sg_apply').onclick = applySuggestion;
@@ -3238,2 +3251,3 @@
   const cf = { S: r2(m.S * 12), h: Math.round(Math.max(m.D - 8, m.D * 0.75)), dg: r2(dg), Lb: r2(FR.sp), primary: m.skews.some(s => Math.abs(s) > 20) ? 'yes' : 'no' };
+  if (num(P.framing.xfMinD) > 0) cf.dMinXF = num(P.framing.xfMinD);   // minimum girder depth for cross-frames (GirderDetail recommends the bracing type)
   { // stability bracing during deck placement: the span with the largest factored deck-placement moment
@@ -3388,2 +3402,3 @@
       ${fld('Normal frames', 'framing.arrange', '', 'sel', { options: [['contiguous', 'Contiguous lines'], ['staggered', 'Staggered by bay']] })}${fld('Min. offset if not aligned', 'framing.stagMin', 'ft')}
+      ${fld('Minimum girder depth for cross-frames', 'framing.xfMinD', 'in', 'num', { full: true, note: 'common practice (e.g. AISC/NSBA G13.1 guidance; owner standards govern); verify' })}
       <p class="note">Cross-frames are placed at every bearing line and evenly between them, with extra frames added in skewed corners and where needed to clear field splices and flange transitions.</p>
@@ -3421,2 +3436,87 @@
 
+/* ---------------- girder count, spacing, and overhangs from the out-to-out deck width (2026-10-12) ----------------
+   For N = 3, 4, ... every overhang on a 0.25 ft grid within the limits gives S = (W - 2 oh)/(N - 1); the layout is feasible when
+   S_min <= S <= S_max, oh <= (oh/S)_max S and d_e = oh - barrier (or curb) width is within the d_e limits. Of the feasible overhangs the one
+   whose exterior and interior girder live load moment distribution factors (this tool's AASHTO 4.6.2.2 equations, longest span) are closest is used
+   (ties: closest to 0.375S). Each candidate is sized with Suggest (fast mode) and checked like an alternative. Nothing is applied without a click. */
+let WS = null, WS_RUN = 0;
+function wsKey() { return JSON.stringify([P.bridge, P.ws, P.limits, P.suggest, P.framing, P.costs, P.girder.gF, P.girder.gW]); }
+function wsSetup() {
+  const w = P.ws, W = num(w.W), L = { ohMin: num(w.ohMin), ohMax: num(w.ohMax), ohS: num(w.ohS), deMin: num(w.deMin), deMax: num(w.deMax), sMin: num(w.sMin), sMax: num(w.sMax) }, errs = [];
+  if (!(W > 0)) errs.push('Enter the out-to-out deck width.');
+  if (!(L.ohMin >= 0 && L.ohMax >= L.ohMin)) errs.push('Overhang limits: 0 ≤ minimum ≤ maximum.');
+  if (!(L.ohS > 0)) errs.push('The maximum overhang / S must be positive.');
+  if (!(isFinite(L.deMin) && L.deMax >= L.deMin)) errs.push('d_e limits: minimum ≤ maximum.');
+  if (!(L.sMin > 0 && L.sMax >= L.sMin)) errs.push('Spacing limits: 0 < minimum ≤ maximum.');
+  const BG = brGeom(P.bridge, num(P.suggest.bar)), bar = BG.bar; if (!(bar >= 0)) errs.push('Complete the barrier or curb inputs on the Bridge tab.');
+  if (errs.length) return { errs };
+  const ohs = []; for (let o = L.ohMin; o <= L.ohMax + 1e-9; o += 0.25) ohs.push(+o.toFixed(4)); if (Math.abs(ohs[ohs.length - 1] - L.ohMax) > 1e-6) ohs.push(L.ohMax);
+  const cases = [], skip = [];
+  for (let N = 3; N <= 30; N++) { const ok = ohs.map(oh => ({ oh, S: (W - 2 * oh) / (N - 1), de: oh - bar })).filter(c => c.S >= L.sMin - 1e-9 && c.S <= L.sMax + 1e-9 && c.oh <= L.ohS * c.S + 1e-9 && c.de >= L.deMin - 1e-9 && c.de <= L.deMax + 1e-9);
+    if (ok.length) cases.push({ N, ok }); else if ((W - 2 * L.ohMax) / (N - 1) >= L.sMin - 1e-9) skip.push(N);
+    if ((W - 2 * L.ohMin) / (N - 1) < L.sMin - 1e-9) break; }
+  return { errs, W, L, bar, cases, skip };
+}
+function wsEval(N, S, oh) {
+  const Pc0 = { ...P, bridge: { ...P.bridge, nb: N, S, spacing: 'equal', ohL: oh, ohR: oh } }, r = suggestLayout(Pc0);
+  if (r.errors.length) return { N, S, oh, err: r.errors[0] };
+  const strip = l => l.map(x => { const o = { L: x.L, t: x.t }; if (x.b !== undefined) o.b = x.b; return o; });
+  const fr0 = { ...P.framing }; if (r.webType) fr0.stiff = r.webType === 'stiffened' ? 'on' : 'off'; if (r.webType === 'stiffened' && r.doR) fr0.doRatio = r.doR;
+  const Pc = { ...Pc0, girder: { ...P.girder, D: r.D, web: strip(r.web), top: strip(r.top), bot: strip(r.bot), splices: [...r.splices] }, framing: fr0 };
+  const m = buildModel(Pc); if (m.errors.length) return { N, S, oh, err: m.errors[0] };
+  const fr = framingLayout(Pc, m), cc = [...runChecks(m), ...framingChecks(m, fr, Pc)];
+  let gov = { r: 0, id: '' }; cc.forEach(c => (c.items || []).forEach(i => { if (typeof i.r === 'number' && isFinite(i.r) && i.r > gov.r) gov = { r: i.r, id: c.id }; }));
+  const iMax = r.spans.indexOf(Math.max(...r.spans)), T = r.rec.types || {}, gI = T.int ? T.int.dfSpan[iMax].mM : null, gE = T.ext ? T.ext.dfSpan[iMax].mM : null;
+  const mx = l => l.reduce((a, g) => (g.b * g.t > a.b * a.t ? g : a), l[0]), dg = r.D + r.top[0].t + r.bot[0].t;
+  return { N, S, oh, de: r.de, gI, gE, D: r.D, tw: r.tw, top: mx(r.top), bot: mx(r.bot), webType: r.webType, wt: m.wt, psf: m.psf, tot: m.wt * N, gov, fails: cc.filter(k => k.status === 'fail').map(k => k.id), warns: cc.filter(k => k.status === 'warn').map(k => k.id), girder: Pc.girder, framing: { stiff: fr0.stiff, doRatio: fr0.doRatio }, dg, Kg: r.rec.Kg && r.rec.Kg[iMax] ? r.rec.Kg[iMax].Kg : null };
+}
+function wsCase(c, setup) {   // one girder count: pick the overhang, size the girder
+  const S0 = c.ok.reduce((a, q) => Math.abs(q.oh - 0.375 * q.S) < Math.abs(a.oh - 0.375 * a.S) ? q : a);
+  const r0 = wsEval(c.N, S0.S, S0.oh); if (r0.err) return { ...r0, rule: 'trial' };
+  const sp = (P.bridge.spans || []).map(num), iMax = sp.indexOf(Math.max(...sp)), Kg = r0.Kg, ts = num(P.bridge.ts);   // K_g of the trial girder
+  if (!Kg) return { ...r0, rule: '0.375S' };
+  const sc = c.ok.map(q => { const gi = sgDF(q.S, sp[iMax], Kg, ts, q.de, c.N, false).mM, ge = sgDF(q.S, sp[iMax], Kg, ts, q.de, c.N, true).mM; return { ...q, d: Math.abs(ge - gi) }; });
+  const best = sc.reduce((a, q) => q.d < a.d - 1e-6 || (Math.abs(q.d - a.d) <= 1e-6 && Math.abs(q.oh - 0.375 * q.S) < Math.abs(a.oh - 0.375 * a.S)) ? q : a);
+  if (Math.abs(best.oh - S0.oh) < 1e-9) return { ...r0, rule: 'balanced' };
+  const r1 = wsEval(c.N, best.S, best.oh); return r1.err ? { ...r0, rule: '0.375S' } : { ...r1, rule: 'balanced' };
+}
+function wsRun() {
+  const st = wsSetup(), prog = $('#ws_prog');
+  if (st.errs.length) { if (prog) prog.innerHTML = `<p class="hint static" style="color:var(--fail)">${st.errs.map(esc).join(' ')}</p>`; return; }
+  if (!st.cases.length) { WS = { key: wsKey(), done: true, res: [], st }; if (prog) prog.innerHTML = '<p class="hint static">No girder count fits the limits.</p>'; renderSuggestSafe(); return; }
+  const run = ++WS_RUN, res = []; WS = { key: wsKey(), done: false, res, st, i: 0, total: st.cases.length };
+  let i = 0; const step = () => { if (run !== WS_RUN) return; const t0 = performance.now();
+    while (i < st.cases.length && performance.now() - t0 < 60) { try { res.push(wsCase(st.cases[i], st)); } catch (e) { res.push({ N: st.cases[i].N, err: e.message }); } i++; }
+    WS.i = i; if (prog) prog.innerHTML = `<div class="prog"><i style="width:${(100 * i / st.cases.length).toFixed(0)}%"></i></div><p class="hint static">${i} of ${st.cases.length} girder counts sized…</p>`;
+    if (i < st.cases.length) setTimeout(step, 0); else { WS.done = true; if (prog) prog.innerHTML = `<p class="hint static">Done: ${res.length} girder counts compared; see the Suggest tab.</p>`; if (P.ui.otab !== 'suggest') setOTab('suggest'); renderSuggestSafe(); } };
+  setTimeout(step, 20);
+}
+function renderSuggestSafe() { try { if (SG && !SG.errors.length) renderSuggest(); else maybeSuggest(true); } catch (e) { console.error(e); } }
+function wsPick(res) { const ok = res.filter(r => !r.err && !r.fails.length); if (!ok.length) return null;
+  return P.ws.obj === 'nb' ? ok.reduce((a, r) => r.N < a.N || (r.N === a.N && r.psf < a.psf) ? r : a) : ok.reduce((a, r) => r.psf < a.psf - 1e-9 ? r : a); }
+function wsHtml() {
+  if (!WS) return '';
+  if (!WS.done) return `<div class="alert info"><b>Girder count from the deck width:</b> sizing ${WS.i} of ${WS.total}…</div>`;
+  const st = WS.st, ok = WS.res.filter(r => !r.err), best = wsPick(WS.res), stale = WS.key !== wsKey(), dmin = num(P.framing.xfMinD) || 48;
+  const rows = ok.map(r => `<tr class="${r === best ? 'gov' : ''}"><td>${r.N}</td><td class="val">${f2(r.S)}</td><td class="val">${f2(r.oh)}</td><td class="val">${f2(r.de)}</td><td class="val">${r.gI != null ? f3(r.gI) : '—'}</td><td class="val">${r.gE != null ? f3(r.gE) : '—'}</td>
+      <td class="lbl">${frac(r.D)} × ${frac(r.tw)} web (${r.webType === 'stiffened' ? 'stiff.' : 'unstiff.'}); top ${frac(r.top.b)} × ${frac(r.top.t)}, bottom ${frac(r.bot.b)} × ${frac(r.bot.t)} max.</td>
+      <td class="val">${f2(r.wt)}</td><td class="val">${f2(r.tot)}</td><td class="val">${f2(r.psf)}</td><td class="val">${f2(r.gov.r)}${r.gov.id ? ` (${r.gov.id})` : ''}</td><td>${r.dg >= dmin - 1e-9 ? 'Cross-frames' : 'Channel / rolled diaphragms'}</td>
+      <td>${r.fails.length ? `<span class="badge fail" title="${r.fails.join(', ')}">${r.fails.length} fail</span>` : r.warns.length ? `<span class="badge warn" title="${r.warns.join(', ')}">pass, ${r.warns.length} warn</span>` : badge('pass')}</td>
+      <td><button type="button" class="dg-btn" data-wsapply="${WS.res.indexOf(r)}">Apply</button></td></tr>`).join('');
+  const errs = WS.res.filter(r => r.err);
+  return card('ws-tbl', 'Girder count from the out-to-out deck width', `W = ${f2(st.W)} ft`, `
+    ${stale ? '<div class="alert warn" style="margin:0 0 8px"><b>Inputs changed since this study.</b> Run it again from the Suggest input tab.</div>' : ''}
+    ${best ? `<div class="sg-head pass"><div><b>Recommended (${P.ws.obj === 'nb' ? 'fewest girders' : 'least total steel weight'}): ${best.N} girders at ${f2(best.S)} ft, overhangs ${f2(best.oh)} ft</b><span>${f2(best.psf)} lb/ft² of deck, ${f2(best.wt)} kip per girder, web ${frac(best.D)} × ${frac(best.tw)}</span></div><button type="button" class="btn btn-primary" data-wsapply="${WS.res.indexOf(best)}">Apply</button></div>` : '<div class="alert warn" style="margin:0 0 8px"><b>No candidate passes every check.</b> Any row can still be applied.</div>'}
+    <div class="tscroll"><table class="tbl alttbl"><thead><tr><th>N</th><th class="right">S (ft)</th><th class="right">Overhang (ft)</th><th class="right">d<sub>e</sub> (ft)</th><th class="right">g<sub>M</sub> int.</th><th class="right">g<sub>M</sub> ext.</th><th>Girder section</th><th class="right">Steel per girder (kip)</th><th class="right">Total (kip)</th><th class="right">lb/ft² of deck</th><th class="right">Governing ratio</th><th>Bracing</th><th>Checks</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
+    <p class="note-p">Distribution factors: this tool's built-in AASHTO 4.6.2.2 equations (longest span, moment, interior: Table 4.6.2.2.2b-1; exterior: lever rule and Table 4.6.2.2.2d-1), an estimate for comparing girder counts; run LL &amp; DL (lldf) for the chosen layout before final design. Overhang: the value within the limits that balances the exterior and interior moment factors (ties: nearest 0.375S). Steel weight includes the ${f2(P.limits.allow)}% detail allowance. Governing ratio: the largest ratio among this tool's layout checks (proportions, transitions, splices, framing) for the sized girder; the strength design is by Suggest's approximate method. Bracing: girder depth at Abutment 1 against the ${f2(dmin)} in minimum for cross-frames (Framing tab).${st.skip.length ? ` No overhang within the limits works for N = ${st.skip.join(', ')}.` : ''}${errs.length ? ` Not sized: ${errs.map(r => `N = ${r.N} (${esc(r.err)})`).join('; ')}.` : ''} Limits: overhang ${f2(st.L.ohMin)} to ${f2(st.L.ohMax)} ft and ≤ ${f2(st.L.ohS)}S, d<sub>e</sub> ${f2(st.L.deMin)} to ${f2(st.L.deMax)} ft, S ${f2(st.L.sMin)} to ${f2(st.L.sMax)} ft (verify / owner).</p>`);
+}
+function wsApply(i) { const r = WS && WS.res[i]; if (!r || r.err) return;
+  if (!confirm(`Apply ${r.N} girders at ${f2(r.S)} ft with ${f2(r.oh)} ft overhangs and the sized girder (web ${frac(r.D)} × ${frac(r.tw)}) to the project? This replaces the girder count, spacing, overhangs, girder plates, splices, and the stiffener setting. You can revert afterwards.`)) return;
+  snapshotBefore(`Girder count from deck width (${r.N} girders at ${f2(r.S)} ft)`);
+  P.bridge.nb = r.N; P.bridge.S = +r.S.toFixed(4); P.bridge.spacing = 'equal'; P.bridge.ohL = r.oh; P.bridge.ohR = r.oh; P.girder = JSON.parse(JSON.stringify(r.girder)); P.framing.stiff = r.framing.stiff; P.framing.doRatio = r.framing.doRatio;
+  fillInputs(); ['web', 'top', 'bot', 'spl'].forEach(renderArr); recompute(); setOTab('summary'); autosave(); }
+document.addEventListener('click', e => { if (e.target.id === 'ws_run') { wsRun(); return; } const a = e.target.closest && e.target.closest('[data-wsapply]'); if (a) wsApply(+a.dataset.wsapply); });
+function xfNoteHtml(s) { const dmin = num(P.framing.xfMinD) || 48, d = s.D + s.top[0].t + s.bot[0].t;
+  return `<div class="alert info"><b>Intermediate bracing:</b> girder depth d = ${f2(d)} in at Abutment 1 ${d >= dmin - 1e-9 ? `≥ ${f2(dmin)} in: cross-frames.` : `< ${f2(dmin)} in (minimum for cross-frames, Framing tab; common practice, owner standards govern): channel (C, MC, depth about half the girder depth or more) or rolled W diaphragms; check them in GirderDetail's Cross-frames module.`}</div>`; }
+
 /* ---------------- alternatives study ---------------- */
@@ -3761,3 +3861,5 @@
   });
+  syncSpacingVis();
 }
+function syncSpacingVis() { const el = document.getElementById('f_bridge_bays'), ig = el && el.closest('.ig'); if (ig) ig.style.display = P.bridge.spacing === 'variable' ? '' : 'none'; }
 function onScalar(e) {
@@ -3770,2 +3872,3 @@
   setPath(P, el.dataset.k, v);
+  if (el.dataset.k === 'bridge.spacing') syncSpacingVis();
   if (el.dataset.k === 'limits.dot') { /* profile switched: nothing else */ }
```

## 2026-10-12 — PR: claude/gd-kframe-kb (auto-designed K-frame is Kb; PR link added after merge)

Engineer's decision (2026-10-12), on the item raised in G3 ("Raised, not changed"): **"Use Kb for the K-frame."**

### K1. Cross-frame auto-design writes `'Kb'` instead of the invalid `'K'`; stored `'K'` loads as `'Kb'`   [calc change for auto-designed K-frames] [member forces move between the chords; see the check case]
- **Where (main page; the embedded PlateLine is not changed):**
  - `AD.cf`, first line after `setMem` (≈ 5154). Anchor: `if (!adLocked('cf.type')) { const S = D(C0.S), h = D(C0.h); C0.type = S / h > 1.5 ?`
  - `AD.cf` summary line (≈ 5175). Anchor: ``out.push(`${C0.type === 'X' ? 'X' :``
  - `cfTypeRec` recommendation text (≈ 2863). Anchor: ``const rec = deep ? `${S / h > 1.5 ?``
  - DXF cross-frame elevation (≈ 5651, 5658). Anchors: `const memb = p.type ===`, `INTERMEDIATE CROSS-FRAME (TYPE`
  - 3D view cross-frames (≈ 6039). Anchor: `// cross-frames (members on their work points)` (the `if (cf.type === 'K'` line below it)
  - New `gdMigrateK(p)` after `function initP()`; it is called at the end of `initP()` (autosave) and in `loadData()` (Open, Import JSON, New from example).
- **Problem:** `AD.cf` set `type = 'K'` when S/h > 1.5. The module's types are `X`, `Kb` and `Kt`. `GM.cf.compute` builds `X` and `Kb` explicitly and puts everything else in its `else` branch, which is `Kt`, so `'K'` was **computed as Kt** (diagonals meeting at the top chord). Meanwhile:
  - the DXF and 3D view **drew** `'K'` as Kb (diagonals meeting at the bottom chord);
  - the Type select showed no matching option;
  - the summary "Type" read "undefined".
- **Before / after (code):** see the diff at the end of this entry. The essential line:
  ```js
  // before
  if (!adLocked('cf.type')) { const S = D(C0.S), h = D(C0.h); C0.type = S / h > 1.5 ? 'K' : 'X'; }
  // after
  if (!adLocked('cf.type')) { const S = D(C0.S), h = D(C0.h); C0.type = S / h > 1.5 ? 'Kb' : 'X'; }   // K-frame: diagonals meet at the bottom chord (engineer's decision 2026-10-12; was the invalid 'K', computed as Kt)
  ```
  - DXF and 3D: `Kb` (and any remaining `'K'`) are drawn with the diagonals meeting at the bottom chord, as `'K'` was. `Kt` (user-selected) is now drawn with the diagonals meeting at the top chord; before, it was drawn as an X.
  - Summary and recommendation texts read "K (bottom)-frame".
- **Migration (saved data, CLAUDE.md §5):** on load (`initP` for the autosave, `loadData` for Open, Import JSON and New), `gdMigrateK(p)` changes a stored `cf.type === 'K'` to `'Kb'`.
  - Kb is Kt mirrored top to bottom, so the migration also **swaps the top and bottom chord angle selections**: `cf.mem.top` ↔ `cf.mem.bot`, whole objects (`sec`, `b1`, `b2`, `t`). It also swaps their auto-design locks (`_lock['cf.mem.top.sec']` ↔ `_lock['cf.mem.bot.sec']`).
  - The continuous chord keeps its angle and the split chord keeps its angle, so the design is equivalent: the D/C values mirror and nothing newly fails.
  - The cross-frame auto-design undo copy (`_adUndo.cf`, a JSON string) is migrated the same way.
  - User member forces (`cf.user.*`) are physical chord forces from an analysis and are not swapped. They are 0 unless entered.
  - A one-line note, "Migrated from 'K' (computed as Kt) to Kb; top/bottom chords swapped.", is shown once at the top of the Cross-frames Summary. It is kept in the transient field `cf.migK` until shown, then removed and autosaved. The same text goes to the console.
  - Saved projects in the project list are migrated when opened. No storage key or format changed.
- **Governing provision:** the checks are unchanged: AASHTO LRFD 10th Ed. 6.9.4.4 and 6.9.4.1.1 (CF1), 6.8.2 (CF2), 6.9.3 / 6.8.4 (CF3), 6.13.2.7 (CF4), 6.13.2.9 (CF5), 6.7.4.2.2 (CF7, CF8). Only the truss geometry the auto-designer selects changes, from Kt to Kb.
- **§4 check case 1: Cross-frames module default (S = 114 in, h = 48 in, S/h = 2.38, L_b = 25 ft, stability bracing on, M_br = 389.2 kip-in), "Auto-design cross-frames".**
  - Before (stored `'K'`, computed as Kt):
    - Members: top chord L3x3x3/8 in two 57.00 in pieces; bottom chord L5x5x3/8, 114.00 in; diagonals L3x3x3/8, 74.52 in; 2 bolts.
    - Forces per kip of F_w at the bottom flange: top chords +0.500 / −0.500, bottom chord −0.500, diagonals ∓0.654.
    - Strength III (F_w = 3.66 kip): chords 1.83 kip each, diagonals 2.39 kip.
    - Constructibility: chords 8.11 kip (brace couple 389.2/48).
    - D/C: CF1 top 0.236 / bottom 0.154 / diagonals 0.085; CF2 0.143 / 0.101 / 0.042; CF4 0.156 / 0.156 / 0.046; CF5 0.140 / 0.140 / 0.041; CF7 0.236 / 0.154 / 0.085; CF8 β_T = 258,103 against 39,531 kip-in/rad required (0.153). Governing 0.236 (top chord).
  - After (`'Kb'`):
    - Members: top chord **L5x5x3/8**, 114.00 in; bottom chord **L3x3x3/8** in two 57.00 in pieces; diagonals L3x3x3/8, 74.52 in; 2 bolts.
    - Forces per kip of F_w: bottom chord 1 **−1.000**, bottom chord 2 0, top chord 0, diagonals ±0.654.
    - Strength III: bottom chord 1 **3.66 kip**, diagonals 2.39 kip.
    - Constructibility: all chords 8.11 kip.
    - D/C: CF1 top 0.154 / bottom 0.236 / diagonals 0.085; CF2 0.101 / 0.143 / 0.042; CF4 0.156 / 0.156 / 0.046; CF5 0.140 / 0.140 / 0.041; CF7 0.154 / 0.236 / 0.085; CF8 unchanged 0.153 (the K horizontal is L5x5x3/8 in both: Kt used the bottom chord area, Kb the top chord area, 2.346 in² × 0.65). Governing 0.236 (bottom chord).
  - Hand check of the wind force: in Kb, the loaded node BL connects only the bottom chord 1 (horizontal) and the girder web (vertical). Horizontal equilibrium gives a chord 1 force of F_w = 3.66 kip; the 0.5F_w in each chord was a Kt result.
- **§4 check case 2: built-in example after Design all (Preliminary sizing demands; S = 114 in, h = 52 in, d = 61.88 in).**
  - Before (`'K'`, Kt): top L3x3x3/8, bottom L5x5x3/8, diagonals L3x3x3/8.
    - CF1: top 2.83 kip (Con) 0.082; bottom 2.83 kip 0.054; diagonals 2.45 kip (StrIII) 0.092.
    - CF2: 0.050 / 0.035 / 0.043.
    - CF4: 0.054 / 0.054 / 0.047.
    - CF7: 0.082 / 0.054 / 0.092.
    - CF8 System 0.056.
    - Summary "Type": undefined.
  - After (`'Kb'`): top L5x5x3/8, bottom L3x3x3/8, diagonals L3x3x3/8.
    - CF1: top 2.83 kip 0.054; bottom **3.63 kip (StrIII) 0.106**; diagonals 0.092.
    - CF2: 0.035 / 0.064 / 0.043.
    - CF4: 0.054 / 0.070 / 0.047.
    - CF5: 0.049 / 0.062 / 0.042.
    - CF7: 0.054 / 0.106 / 0.092.
    - CF8 unchanged 0.056.
    - Summary "Type": K-frame (bottom).
  - No status changes. Every other module is identical, main vs branch.
- **§4 check case 3: migration.** A project auto-designed on main (type `'K'`) loads on the branch as `'Kb'` with the chords swapped. Before = main showing the stored `'K'` (Kt); after = branch after migration.
  - **h = 48 in, F_w = 3.66 kip.**
    - Main: top L3x3x3/8 (2 × 57 in), bottom L5x5x3/8 (114 in). D/C: CF1 0.236 / 0.154 / 0.085, CF2 0.143 / 0.101 / 0.042, CF3 0.694 / 0.823 / 0.907, CF4 0.156 / 0.156 / 0.046, CF5 0.140 / 0.140 / 0.041, CF7 0.236 / 0.154 / 0.085, CF8 0.153.
    - Branch after migration: top **L5x5x3/8** (114 in), bottom **L3x3x3/8** (2 × 57 in). D/C: CF1 0.154 / 0.236 / 0.085, CF2 0.101 / 0.143 / 0.042, CF3 0.823 / 0.694 / 0.907, CF4 and CF5 unchanged, CF7 0.154 / 0.236 / 0.085, CF8 0.153.
    - Governing code D/C 0.907 (CF3, diagonals) in both. No failing check in either.
  - **h = 52 in.**
    - Main: CF1 0.218 / 0.142 / 0.093, CF3 0.694 / 0.823 / 0.939.
    - Branch: CF1 0.142 / 0.218 / 0.093, CF3 0.823 / 0.694 / 0.939.
    - Governing 0.939 in both, no failures.
  - Without the swap (the first version of this PR), the 114 in top chord would have been the L3x3x3/8 and CF3 would fail: ℓ/r_z = 114/0.586 ≈ 194 > 140.
  - Unit test of `gdMigrateK`:
    - `{type:'K', top L3, bot L5, lock on top}` → `Kb`, top L5, bot L3, lock moved to bottom.
    - Undo copy `{K, top L3, bot L6}` → `{Kb, top L6, bot L3}`.
    - A stored `Kt` is left unchanged.
- **How verified:**
  - `node --check` on the page and the decoded PlateLine (unchanged).
  - Headless Chromium, main vs branch:
    - `runAutoDesign('cf')` on the default (case 1).
    - Design all on the built-in example: module text and checks identical except Cross-frames (case 2).
    - An autosave from main containing `'K'` loads as `'Kb'` with the chords swapped, the same governing D/C and no failure (case 3).
    - The note is shown on the first view of the Cross-frames module and not on the second; `cf.migK` is gone from the autosave afterwards. No alert.
    - The Cross-frames drawings tab with `Kb`, `Kt` and `X`: no console errors.
- **Other copies:** none (PlateLine does not set the cross-frame type).

### Exact changes: main page (unified diff, base64 string masked and unchanged)

```diff
--- km_main.html	2026-10-12 20:58:24.878999548 +0000
+++ km_br.html	2026-10-12 21:03:17.590981331 +0000
@@ -2862,3 +2862,3 @@
   const ch = CF_CH.filter(s => s[1] >= 0.5 * dg - 1e-9).sort((a, b) => (2 * a[2] * a[3] + (a[1] - 2 * a[3]) * a[4]) - (2 * b[2] * b[3] + (b[1] - 2 * b[3]) * b[4]))[0], w = CF_DIA.find(s => s[1] >= 0.5 * dg - 1e-9);
-  const rec = deep ? `${S / h > 1.5 ? 'K' : 'X'}-frame (S/h = ${f2(S / h)})` : ch ? `channel diaphragm ${ch[0]} (or a rolled W)` : w ? `rolled diaphragm ${w[0]}` : 'rolled W diaphragm';
+  const rec = deep ? `${S / h > 1.5 ? 'K (bottom)' : 'X'}-frame (S/h = ${f2(S / h)})` : ch ? `channel diaphragm ${ch[0]} (or a rolled W)` : w ? `rolled diaphragm ${w[0]}` : 'rolled W diaphragm';
   const sel = xf ? ({ X: 'X-frame', Kb: 'K-frame', Kt: 'K-frame' }[p.type] || 'cross-frame') : `${CF_CH.some(s => s[0] === (p.dia || {}).shape) ? 'channel' : 'rolled'} diaphragm ${(p.dia || {}).shape === 'custom' ? 'custom W' : (p.dia || {}).shape}`;
@@ -4891,2 +4891,3 @@
   showN(m.id, RS.MR); if (m.after) m.after(RS); CK = m.checks(RS); renderStatus(); gmSummary(m);
+  if (m.id === 'cf' && d.migK) { $('#tab-summary').insertAdjacentHTML('afterbegin', '<div class="alert info" style="margin:0 0 12px">Migrated from \'K\' (computed as Kt) to Kb; top/bottom chords swapped.</div>'); delete d.migK; autosave(); }   // shown once per project
   $('#tab-combos').innerHTML = `<div class="ctl-row"><button type="button" class="dg-btn" data-exp="combos">Expand all</button><button type="button" class="dg-btn" data-col="combos">Collapse all</button></div>` + (RS.MR ? card('cb-mr', 'Modular ratio', 'AASHTO LRFD 5.4.2.4, 6.10.1.1.1b', eq('Short-term modular ratio', '5.4.2.4-1', modTex(RS.MR)) + `<p class="note-p">The long-term (creep) section uses 3n = ${f2(3 * RS.MR.n)}.</p>`) : '') + m.combos(RS);
@@ -5153,3 +5154,3 @@
   const names = Object.keys(ANGLES).sort((a, b) => area(a) - area(b)), setMem = (k, n) => { const [b1, b2, t] = ANGLES[n]; C0.mem[k] = { sec: n, b1, b2, t }; };
-  if (!adLocked('cf.type')) { const S = D(C0.S), h = D(C0.h); C0.type = S / h > 1.5 ? 'K' : 'X'; }
+  if (!adLocked('cf.type')) { const S = D(C0.S), h = D(C0.h); C0.type = S / h > 1.5 ? 'Kb' : 'X'; }   // K-frame: diagonals meet at the bottom chord (engineer's decision 2026-10-12; was the invalid 'K', computed as Kt)
   const keys = ['diag', 'top', 'bot'], ids = ['CF1', 'CF2', 'CF3', 'CF4', 'CF5', 'CF6', 'CF7', 'CF9']; let done = null;
@@ -5174,3 +5175,3 @@
   const r = adEval('cf'), S = r && r.R.SB;
-  out.push(`${C0.type === 'X' ? 'X' : 'K'}-frame (S/h = ${f2(D(C0.S) / D(C0.h))}${adLocked('cf.type') ? ', type locked' : ''}); top chord ${C0.mem.top.sec}, bottom chord ${C0.mem.bot.sec}, diagonals ${C0.mem.diag.sec}; ${C0.conn.n} bolts per member end`);
+  out.push(`${C0.type === 'X' ? 'X' : C0.type === 'Kt' ? 'K (top)' : 'K (bottom)'}-frame (S/h = ${f2(D(C0.S) / D(C0.h))}${adLocked('cf.type') ? ', type locked' : ''}); top chord ${C0.mem.top.sec}, bottom chord ${C0.mem.bot.sec}, diagonals ${C0.mem.diag.sec}; ${C0.conn.n} bolts per member end`);
   if (S) out.push(`Bracing stiffness β_T = ${f0(S.bT)} kip-in/rad against ${f0(S.bReq)} required (ratio ${f2(S.bReq / S.bT)})`);
@@ -5650,3 +5651,4 @@
     const sg = x === 0 ? 1 : -1; D.rect(ly.cp, x + sg * tw / 2, bf.t, x + sg * (tw / 2 + 0.5), bf.t + Dm); D.line(ly.c, x, -2 * h, x, Dt + 2 * h, cl); });
-  const memb = p.type === 'K' ? [['top', [0, yt], [S, yt]], ['bot', [0, yb], [S, yb]], ['diag', [0, yt], [S / 2, yb]], ['diag', [S, yt], [S / 2, yb]]] : [['bot', [0, yb], [S, yb]], ['top', [0, yt], [S, yt]], ['diag', [0, yb], [S, yt]], ['diag', [0, yt], [S, yb]]];
+  const memb = p.type === 'Kb' || p.type === 'K' ? [['top', [0, yt], [S, yt]], ['bot', [0, yb], [S, yb]], ['diag', [0, yt], [S / 2, yb]], ['diag', [S, yt], [S / 2, yb]]]
+    : p.type === 'Kt' ? [['bot', [0, yb], [S, yb]], ['top', [0, yt], [S, yt]], ['diag', [0, yb], [S / 2, yt]], ['diag', [S, yb], [S / 2, yt]]] : [['bot', [0, yb], [S, yb]], ['top', [0, yt], [S, yt]], ['diag', [0, yb], [S, yt]], ['diag', [0, yt], [S, yb]]];
   memb.forEach(([k, a, b]) => { const mm = p.mem[k] || {}, L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nv = [-u[1], u[0]], w = +mm.b1 || 4;
@@ -5657,3 +5659,3 @@
   D.dimH(ly.d, 0, S, Dt + 4 * h, Dt, 'GIRDER SPACING <>'); D.dimV(ly.d, yb, yt, S + tf.b / 2 + 4 * h, S, 'WORK PT. <>'); D.dimV(ly.d, 0, yb, S + tf.b / 2 + 4 * h, S);
-  D.text(ly.t, 0, Dt + 8 * h, h * 1.3, `INTERMEDIATE CROSS-FRAME (TYPE ${p.type === 'K' ? 'K' : 'X'})`);
+  D.text(ly.t, 0, Dt + 8 * h, h * 1.3, `INTERMEDIATE CROSS-FRAME (TYPE ${/^K/.test(p.type) ? 'K' : 'X'})`);
   { const th = Math.max(...m.skews.map(v => Math.abs(v))), Se = S / Math.cos(th * Math.PI / 180), ox = S + tf.b + 30 * h, i0 = D.mark();
@@ -6038,3 +6040,4 @@
       rod(A, Bb, r, M.xf); rod(At, Bt, r, M.xf);
-      if (cf.type === 'K' && f.type !== 'sup') { const Mb = [(xa + xc) / 2, yb, (za + zc) / 2]; rod(At, Mb, r, M.xf); rod(Bt, Mb, r, M.xf); } else { rod(A, Bt, r, M.xf); rod(At, Bb, r, M.xf); } }); }
+      if ((cf.type === 'Kb' || cf.type === 'K') && f.type !== 'sup') { const Mb = [(xa + xc) / 2, yb, (za + zc) / 2]; rod(At, Mb, r, M.xf); rod(Bt, Mb, r, M.xf); }
+      else if (cf.type === 'Kt' && f.type !== 'sup') { const Mt = [(xa + xc) / 2, yt, (za + zc) / 2]; rod(A, Mt, r, M.xf); rod(Bb, Mt, r, M.xf); } else { rod(A, Bt, r, M.xf); rod(At, Bb, r, M.xf); } }); }
   // bearings and substructure seats along the skewed support lines
@@ -6383,3 +6386,14 @@
 let P = null, RS = null, CK = null, CUR = '';
-function initP() { P = GD_FULL(); try { const a = LS && JSON.parse(localStorage.getItem(KEY_AS) || 'null'); if (a && a.data) { P = deepMerge(GD_FULL(), a.data); CUR = a.name || ''; } } catch (e) {} }
+function initP() { P = GD_FULL(); try { const a = LS && JSON.parse(localStorage.getItem(KEY_AS) || 'null'); if (a && a.data) { P = deepMerge(GD_FULL(), a.data); CUR = a.name || ''; } } catch (e) {} gdMigrateK(P); }
+/* migration (2026-10-12): the cross-frame auto-designer stored the invalid type 'K', computed as Kt (diagonals meeting at the top chord).
+   The engineer's decision is Kb (diagonals meeting at the bottom chord). Kb is Kt mirrored top to bottom, so a stored 'K' loads as 'Kb' with the
+   top and bottom chord angle selections (section, legs, thickness) and their auto-design locks swapped: the continuous chord keeps its angle and the
+   split chord keeps its angle, so the design is equivalent. The same is done in the auto-design undo copy. A one-line note is shown once in the module. */
+function gdMigrateK(p) { if (!p) return 0; let n = 0;
+  const swap = c => { if (!c || c.type !== 'K') return false; c.type = 'Kb'; if (c.mem) { const t = c.mem.top; c.mem.top = c.mem.bot; c.mem.bot = t; } return true; };
+  if (swap(p.cf)) { n++; p.cf.migK = 1;
+    const L = p._lock; if (L) { const a = L['cf.mem.top.sec'], b = L['cf.mem.bot.sec']; delete L['cf.mem.top.sec']; delete L['cf.mem.bot.sec']; if (b) L['cf.mem.top.sec'] = b; if (a) L['cf.mem.bot.sec'] = a; } }
+  const u = p._adUndo && p._adUndo.cf; if (typeof u === 'string') { try { const o = JSON.parse(u); if (swap(o)) { p._adUndo.cf = JSON.stringify(o); n++; } } catch (e) {} }
+  if (n) console.info("GirderDetail: Migrated from 'K' (computed as Kt) to Kb; top/bottom chords swapped.");
+  return n; }
 
@@ -6763,3 +6777,3 @@
 function refreshList() { const n = Object.keys(store()).sort(); $('#proj_list').innerHTML = n.length ? n.map(x => `<option ${x === CUR ? 'selected' : ''}>${esc(x)}</option>`).join('') : '<option value="">No saved projects</option>'; }
-function loadData(d, name) { P = deepMerge(GD_FULL(), d); bsRebuildRows(); Object.keys(GM).forEach(gmBuildPanes); CUR = name || ''; fillInputs(); setITab(P.ui.itab || 'project'); setOTab(P.ui.otab || 'summary'); recompute(); autosave(); }
+function loadData(d, name) { P = deepMerge(GD_FULL(), d); gdMigrateK(P); bsRebuildRows(); Object.keys(GM).forEach(gmBuildPanes); CUR = name || ''; fillInputs(); setITab(P.ui.itab || 'project'); setOTab(P.ui.otab || 'summary'); recompute(); autosave(); }
 function initProjects() {
```


## 2026-10-12 — PR: claude/girderdetail-ws-full (engineer's request; PR link added after merge)

Engineer's request (2026-10-12): the girder-count study from the out-to-out deck width (G4) sizes each girder count with Suggest fast mode only; add a step that re-sizes the best 2–3 girder counts with Full design and ranks them on the full-design results, and "make sure there are notes in the app that explain what the app is doing". Basis: AASHTO LRFD 10th Ed. (2024). **This adds a UI/workflow step and explanatory notes only. No formula, load or resistance factor, unit, code reference, or check changed; `suggestLayout`, `suggestFull`, `wsEval`, `wsCase`, `wsRun`, `wsPick` and `wsApply` are unchanged in their computations.** Only PlateLine (`PL:`) changes; the main page differs only in the `PL_B64` string.

**PlateLine edits:** base64-decode `const PL_B64 = '...'` (standard alphabet, `=` padding, one line; UTF-8 HTML with LF line endings), apply the PlateLine diff at the end of this entry, encode again without line wrapping. After this PR the string is 605,528 characters (decoded 454,145 bytes; before: 579,240 / 434,429). The first 57,290 decoded bytes are unchanged. Line numbers: `PL:` ≈ line in the decoded PlateLine (branch).

### G6. PlateLine: "Full design of the best N" girder counts after the deck-width study, and notes   [new workflow step + notes] [no result changes; nothing changes until applied]
- **Where (PL):**
  - `DEFAULT.ws` (PL ≈ 1023): new optional field `nFull: 3`. Anchor `sMin: 3.5, sMax: 16, obj: 'wt', nFull: 3 }`.
  - Suggest input tab, section `sec-sgws` (PL ≈ 2595): new note "This study is quick because it uses Suggest's fast mode only…" and input `ws.nFull` "Full design: number of best girder counts (1 to 5; default 3)". Anchor `${fld('Full design: number of best girder counts', 'ws.nFull'`.
  - `wsKey()` (PL ≈ 3446): `nFull` left out of the key, so changing how many to run does not mark the fast study stale. Before: `function wsKey() { return JSON.stringify([P.bridge, P.ws, P.limits, …]); }`; after: `function wsKey() { const { nFull, ...ws } = P.ws || {}; return JSON.stringify([P.bridge, ws, P.limits, …]); }` (same key as before for the other fields).
  - `wsHtml()` (PL ≈ 3514): note on the overhang rule (K<sub>g</sub> of the trial girder sized at the overhang nearest 0.375S), new paragraph "What this table is" (fast mode, ranking aid), and `+ wsfHtml()` appended to its return value.
  - New `WSF`, `wsfN`, `wsfPicks`, `wsfEval`, `wsfPick`, `wsfProg`, `wsfRun`, `wsfHtml`, `wsfApply` and one click listener, inserted before `function xfNoteHtml(s) {` (PL ≈ 3523–3612). Anchor `/* ---------------- full design of the best girder counts from the deck-width study (2026-10-12)`.
  - Full design card note in `renderSuggest()` (PL ≈ 2720), after "…verified against its own recomputed demands.": "Every iteration re-runs the analysis on the current plates and recomputes the live load distribution factors (4.6.2.2) from that section's K<sub>g</sub>; the live load stage model of the first iteration is reused inside the loop to save time, and the final verification recomputes everything." Same statement added to the comment above `async function suggestFull(`.
  - Manual, Part 2 "Girder count from the deck width": new paragraph "Fast study, then full design of the best few."
- **Behavior:**
  - After the fast study, the Suggest tab shows a card "Full design of the best girder counts" with the notes and a button **Full design of the best N** (N = `ws.nFull`, 1–5, default 3; fewer if fewer rows were sized). It is never run automatically. The button is disabled when the study's inputs have changed (`wsKey`).
  - Candidates (`wsfPicks`): rows without an error; passing rows (no failing layout check) sorted by the study's objective (least total steel: lb/ft² of deck, then N; fewest girders: N, then lb/ft²), then failing rows by governing ratio; the first N. Each row has a distinct N.
  - Run (`wsfRun`): sequential, one girder count at a time, progress bar with message and elapsed time, Cancel (the same `sg-prog` style as Run full design). For each candidate, `suggestFull(Pc, prog, cancelled)` is called unchanged on `Pc = JSON.parse(JSON.stringify(P))` taken when the button was pressed, with `bridge = { ...bridge, nb: N, S, spacing: 'equal', ohL: oh, ohR: oh }` from the fast row. `suggestFull` and `suggestLayout` read only their `P` argument (checked: no reference to the globals `P`, `SG`, `M`, `window`, storage or the DOM in `suggestLayout`…`suggestFull`, PL ≈ 1809–2314), so the project is not touched. While it runs, Run full design and the study button are disabled (one full design at a time); Run full design running blocks this step with a message.
  - Each result (`wsfEval`) is built like a fast row: `buildModel`, `runChecks` + `framingChecks` (layout checks) on the full-design girder with its stiffener setting, d<sub>o</sub>/D and cross-frame spacing; the live load moment distribution factors of the final girder (longest span) are read from `suggestLayout(Pg, { analyze })`, i.e. the same staged `demand()` the final verification uses; `analyzeGirder` + `analysisChecks` (A1–A3) are run and named when they fail but do not decide the result.
  - Table: N, S, overhang, full-design section, cross-frame spacing, steel per girder, total, lb/ft² of deck, fast-study lb/ft², max. ratio (max of Full design's final flange and web ratios), g<sub>M</sub> interior/exterior, iterations of the selected depth candidate (number of candidates refined), bracing, result, Apply. Result "pass" = Full design passed (every check ≤ 1.0) and no failing layout check. Recommended row: `wsfPick`, the same rule as `wsPick` on passing rows.
  - Apply (`wsfApply`): confirm, `snapshotBefore(…)` (Revert works), then sets `bridge.nb`, `S`, `spacing = 'equal'`, `ohL`, `ohR`, `girder` (D, web, top, bottom, splices), `framing.stiff`, `framing.doRatio` (stiffened), `framing.spacing` (as `applySuggestion` does with a full design); `fillInputs`, `renderArr`, `recompute`, Summary tab, `autosave`. Results are not saved; stale results are marked when the inputs change.
- **§4 callout:** no engineering formula, factor, unit or reference changed. The new step only calls the existing `suggestFull` and the existing checks with another bridge; the distribution factors shown are the existing `sgDF` values from `demand()` (built-in AASHTO 4.6.2.2 equations, or GirderDetail's factors only where `sgDfx` matches the exact bridge and girder, as before).
- **Check case (built-in example, W = 44.5 ft, objective least total steel, N = 3; headless Chromium):** fast study as in G4 (N = 4 … 12 all pass; lb/ft² 24.55, 27.37, 29.74, …) → picks N = 4, 5, 6.

  | N | S (ft) | oh (ft) | full-design web | top / bottom max. | xf (ft) | kip/girder | total kip | lb/ft² (fast) | max. ratio | g<sub>M</sub> int / ext | iter. (cand.) | result |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | **4** | **13.00** | **2.75** | 66 × 1/2 stiff., d<sub>o</sub> = 1.0D | 17 × 1 3/8 / 20 × 1 5/8 | 25 | 87.88 | 351.52 | **21.94** (24.55) | 0.989 | 0.842 / 0.854 | 8 (7) | pass; A3 (Analysis tab) |
  | 5 | 10.00 | 2.25 | 71 × 1/2 stiff., 1.0D | 14 × 1 1/8 / 17 × 1 3/8 | 25 | 79.83 | 399.15 | 24.92 (27.37) | 0.973 | 0.696 / 0.690 | 6 (7) | pass |
  | 6 | 8.00 | 2.25 | 55 × 1/2 stiff., 2.0D | 15 × 1 1/4 / 18 × 1 3/8 | 25 | 75.04 | 450.23 | 28.10 (29.74) | 0.974 | 0.568 / 0.563 | 7 (7) | pass, warning D6 |

  Recommended: 4 girders at 13.00 ft, overhangs 2.75 ft. Hand check: total = 4 × 87.88 = 351.52 kip; lb/ft² = 351,520 / (44.5 × 360) = 21.94. Run time 78–83 s (≈ 27 s per girder count). Same-path check: setting the project's bridge to N = 4, S = 13.00, overhangs 2.75 and pressing Run full design gives the identical girder (D, every plate, splices, cross-frame spacing) and the same max. ratio 0.98858602… as the N = 4 row. Apply → N = 4, S = 13, overhangs 2.75 ft, D = 66 in, splices 80, 141, 219, 280 ft; the Summary then shows A3 (bearing stiffener bearing, Pier 1, R<sub>u</sub> 898.2 kip vs 840.0 kip with the example's 7 × 1 in stiffener), which is why A1–A3 are named beside the result.
- **Small case (single 120 ft span, the rest of the example, W = 44.5 ft):** picks N = 4, 5, 6; full design 7.9 s in all (2 s each); N = 4: S = 12.50, oh = 3.50, 69 × 1/2 web, 22.55 lb/ft² (fast 25.75), max. ratio 0.951, g<sub>M</sub> 0.881 / 0.912; recommended N = 4; Apply and reload: the applied design is restored from the autosave.
- **Saved data:** new optional `ws.nFull` in the existing PlateLine project/autosave (`plateline_autosave_v1`); no key or format change. Older data get 3 through `deepMerge(DEFAULT, …)`; a branch autosave with `nFull` loads in main unchanged (checked both ways). Results are not saved.
- **How verified:**
  - `node --check` on both inline scripts of the decoded PlateLine.
  - Bit-identity, headless Chromium, main vs branch on the built-in example: `suggestLayout(P)` (D, plates, splices, cost, candidate list), the fast study's every row (`WS.res` JSON, including the sized girder), the fast table HTML, and Run full design on the example bridge (`SG` girder, cost and the whole `SG.full` object, and the Full design table HTML): all identical. The project JSON differed only by `ws.nFull` and a GirderDetail timestamp (`dfx.ts`).
  - `P` JSON identical before and after the new step (the project is not changed by the run).
  - No console errors; screenshots `shot_default_running.png`, `shot_default_done.png`, `shot_full_table.png`, `shot_fast_card.png`, `shot_input_pane.png`, `shot_manual.png`.
- **Other copies:** none (PlateLine exists only in this file). No shared snippet touched.
- **Open items:** A1–A3 (deflection, uplift, bearing stiffener) are shown but do not decide a row, because Suggest does not size the bearing stiffener or bearings; confirm. The overhang and spacing are kept from the fast study (not re-optimized with full-design K<sub>g</sub>).

### Exact changes: decoded PlateLine (unified diff)

```diff
--- PL (main)
+++ PL (branch)
@@ -1020,7 +1020,7 @@
   framing: { spacing: 25, orient: 'auto', arrange: 'contiguous', supClear: 3, stagMin: 4, stiff: 'on', doRatio: 1.0, stB: 6, stT: 0.5, cpB: 6, cpT: 0.5, bsB: 7, bsT: 1, clip: 1, bsPairs: 1, gS: '50', xfMinD: 48 },
   costs: { steel: 3.00, trans: 1500, splice: 6000, stiff: 150, xf: 2500, bearing: 4000 },
   alts: { nbList: '4, 5, 6, 7', ldLo: 22, ldHi: 36, ldStep: 2, web: 'stiffened', holdW: true },
-  ws: { W: '', ohMin: 1.5, ohMax: 4.0, ohS: 0.5, deMin: -1.0, deMax: 5.5, sMin: 3.5, sMax: 16, obj: 'wt' },   // girder count from the out-to-out deck width (2026-10-12); W blank = not used
+  ws: { W: '', ohMin: 1.5, ohMax: 4.0, ohS: 0.5, deMin: -1.0, deMax: 5.5, sMin: 3.5, sMax: 16, obj: 'wt', nFull: 3 },   // girder count from the out-to-out deck width (2026-10-12); W blank = not used; nFull: girder counts re-sized by Full design (optional field, 2026-10-12)
   suggest: { lsdS: 25, lsdC: 30, keepD: false, web: 'auto', kbt: 6, weld: 1000, eff: 0.85, fws: 25, sip: 15, bar: 0.40, cll: 20, gtype: 'envelope',
     mode: 'fast', fab: 'on', depthRule: 'on', defl: 'off', fat: 'I', topConst: 'on', maxDb: 4, spD: 0.875, spLines: 2, spG: 3, spTwp: 0.5, spCw: 0.5, spC1: 1.5, cfOpt: 'on', cfMax: 25, doOpt: 'on' },
   ui: { itab: 'project', otab: 'summary', col: {}, man: 'p1', rpt: { summary: true, drawings: true, checks: true, schedule: true, suggest: false, manual: false } }
@@ -2252,7 +2252,10 @@
 /* Full design: refine the best fast candidates with the staged analysis and AASHTO checks, then price them.
    Each iteration runs the staged analysis once on the current layout, resizes with area factors that raise the
    requirement where a check exceeds 1.0 and lower it where there is spare capacity, and repeats until the layout
-   is unchanged; the chosen layout is verified against its own staged demands. */
+   is unchanged; the chosen layout is verified against its own staged demands.
+   Each iteration's demand() recomputes K_g and the 4.6.2.2 distribution factors from the current plates; the live-load stage model
+   (bN, influence lines on the short-term composite section) of the first iteration is reused inside the loop (llCache), and the
+   verification recomputes everything. Also used by the girder-count study (wsfRun) on a copy of the project with that row's bridge. */
 async function suggestFull(P, prog, cancelled) {
   const tick = () => new Promise(r => setTimeout(r, 0)), fast = suggestLayout(P); if (fast.errors.length) return fast;
   const SG = P.suggest, okC = fast.rec.cands.filter(c => c.ok), pool = okC.length ? okC : fast.rec.cands, picks = pool.slice(0, SG.keepD ? 2 : 3);
@@ -2352,6 +2355,7 @@
 
 ['p2', 'Using the program', `
 <h3>Girder count from the deck width</h3><p>With an <b>Out-to-out deck width</b> W on the Suggest input tab, <b>Suggest girder count, spacing, and overhangs</b> compares girder counts. For each N from 3, every overhang on a 0.25 ft grid within the limits gives S = (W &minus; 2&middot;overhang)/(N &minus; 1); a layout is kept when S, the overhang (also &le; a fraction of S), and d<sub>e</sub> = overhang &minus; barrier (or curb) width are within the limits (defaults: overhang 1.5 to 4.0 ft and &le; 0.5S; d<sub>e</sub> &minus;1.0 to 5.5 ft; S 3.5 to 16 ft, the ranges of the 4.6.2.2 equations; verify / owner). Of those, the overhang whose exterior and interior girder live load moment distribution factors (this tool's 4.6.2.2 equations, longest span) are closest is used (ties: nearest 0.375S); the girder is then sized with Suggest (fast mode) and checked like an alternative. The table lists N, S, overhang, d<sub>e</sub>, the factors, the section, the steel per girder and in total (lb/ft<sup>2</sup> of deck), the governing ratio of the layout checks, the bracing type from the girder depth, and pass/fail. The recommendation is the passing row with the least total steel (or the fewest girders, if chosen). Nothing changes until you press Apply. With W blank, Suggest uses the girder count and spacing on the Bridge tab as before. Distribution factors are an estimate for comparing layouts: run LL &amp; DL for the chosen layout.</p>
+<p><b>Fast study, then full design of the best few.</b> The study sizes every girder count with Suggest's <i>fast mode</i>: one constant-stiffness continuous-beam model, flange areas from lever-arm estimates, and only this tool's layout checks (proportions, transitions, splices, framing), with no strength, service, or fatigue check. That makes it quick enough to try every girder count, but its weights are a ranking aid. The overhang of each row is chosen with the K<sub>g</sub> of a trial girder sized at the overhang nearest 0.375S. When the study finishes, the Suggest tab offers <b>Full design of the best N</b> (N on the Suggest input tab, default 3, at most 5). It takes the best N rows (by the objective: passing rows first, then the others by governing ratio) and runs Full design (see <i>Fast and full design</i> below) on each with that row's girder count, spacing, and overhangs, on a copy of the project: each iteration re-runs the staged analysis of the current plates (DC1 on the steel section; DC2 and DW on the long-term composite section, 3n; live load on the short-term composite section, n; cracked near interior piers), recomputes the 4.6.2.2 distribution factors from that section's K<sub>g</sub>, checks every node, and resizes; the live load model of the first iteration is reused inside the loop, and the final verification recomputes everything, so the pass/fail of each row comes from fully recomputed demands. The girder count, spacing, and overhangs are kept from the fast study. Full design takes about 20 to 60 s for each girder count, which is why it runs only for the best few and only when you press the button (it can be cancelled). The results table lists the full-design section, cross-frame spacing, steel per girder, total and per deck area (with the fast-study value beside it), the largest ratio of the final verification, the interior and exterior moment distribution factors of the final girder (longest span), the iterations, and pass/fail (every full-design check at or below 1.0 and no failing layout check; failing Analysis tab checks A1 to A3 are named beside it but do not decide it, because they depend on the bearing stiffener and bearings, which Suggest does not size); the recommendation follows the same objective. Apply sets the girder count, spacing, overhangs, plates, splices, stiffener setting, and cross-frame spacing (Revert restores the previous design). The result is still preliminary: run LL &amp; DL (lldf) for the chosen layout and complete the design checks in GirderDetail.</p>
 <h3>Suggest: lowest-cost layout</h3><p>Suggest proposes the web and flange layout and the field splices for the bridge on the Bridge tab, with one layout for all girders (designed for the envelope of the interior and exterior girders). It searches web depths from about L/36 to L/18 and, unless one is chosen, both an unstiffened and a transversely stiffened web, and keeps the layout with the <b>lowest total cost</b>: structural steel (weight × $/lb), flange shop transitions, transverse stiffeners, and field splices, each priced from the <b>Unit costs</b> on the Suggest tab, which are the same single price list used by the Alternatives study (and sent to GirderDetail's Design all). The defaults are placeholders; only their ratios affect the choice, and the tab shows each as an equivalent weight of steel. Within each field piece the flange width is constant and the thicknesses are chosen by an optimization that adds a transition only where it saves more than it costs. Field splices are placed by the program near the dead-load points of contraflexure and within the shipping length and weight, and moved off cross-frame locations where the framing check X4 finds a conflict.</p>
 <p><b>Rules.</b> AASHTO LRFD minimums always apply: D/t<sub>w</sub> ≤ 150 unstiffened or 300 stiffened (6.10.2.1), b<sub>f</sub>/2t<sub>f</sub> ≤ 12, b<sub>f</sub> ≥ D/6, t<sub>f</sub> ≥ 1.1t<sub>w</sub>, 0.1 ≤ I<sub>yc</sub>/I<sub>yt</sub> ≤ 10 (6.10.2.2), plates at least 5/16 in (6.7.3), and one steel grade (no hybrid girders). With the AASHTO/NSBA G12.1 fabrication guidelines on (the default), the Limits tab minimum sizes, increments, and transition ratios also apply. The span-to-depth limits of Table 2.5.2.6.3-1 apply by default and can be turned off.</p><p><b>Optimizing the framing.</b> Stiffener spacing and cross-frame spacing are design variables. For stiffened webs, the fast search tries d<sub>o</sub>/D = 1.0, 1.5, 2.0, and 3.0 (shear buckling coefficient k = 5 + 5/(d<sub>o</sub>/D)²): wider panels need fewer stiffeners but a thicker web, and the cost decides. Full design then re-runs its best candidate at cross-frame spacings from 15 ft up to the maximum set on the Suggest tab (default 25 ft) in 2.5 ft steps, with every check (lateral-torsional buckling with the actual spacing and C<sub>b</sub>, deck placement, and the rest), adding the cost of each intermediate cross-frame, and keeps the cheapest. Apply sets the Framing tab spacing and d<sub>o</sub>/D. The deck overhang is not modeled in sizing: GirderDetail's Deck overhang auto-design gives the largest spacing the deck placement allows at the exterior girder, so set the maximum spacing no higher than that.</p><p><b>Flange widths.</b> Every flange at a field splice is made wide enough for the number of bolt gage lines each side of the web set on the Suggest tab (default 2) without staggering, using the same geometry as GirderDetail's splice auto-design: the first line clear of the web splice plate by the plate clearance plus the edge distance and by the tightening clearance C₁, the gage between lines, and the edge distance at the flange tip (about 14 in for 7/8 in bolts and two lines). The top flange is kept at one width along the girder unless turned off (it simplifies the haunch and stay-in-place forms), and the width of either flange changes by no more than the set maximum at a field splice (default 4 in; 0 for no limit). Widths are raised, never reduced, to meet these rules, and the thicknesses are then optimized at those widths.</p>
 <p><b>Fast and full design.</b> The suggestion shown updates automatically (fast mode: constant-stiffness analysis and flange areas from lever-arm estimates). <b>Run full design</b> takes the best fast candidates and, for each, repeats: the staged, cracked analysis of the current layout (the Structural analysis settings); the AASHTO checks at every node for the interior and exterior girders, on both sides of every plate boundary (Strength I positive flexure with the plastic moment, compactness, D<sub>p</sub>/D<sub>t</sub>, and 1.3M<sub>y</sub>; Strength I negative flexure by 6.10.8 with flange local buckling, lateral-torsional buckling at the cross-frame spacing with C<sub>b</sub> from the quarter-point moments of each unbraced segment (10th Edition 6.10.8.2.3b: C<sub>b</sub> = 12.5M<sub>max</sub>/(2.5M<sub>max</sub> + 3M<sub>A</sub> + 4M<sub>B</sub> + 3M<sub>C</sub>), with M<sub>max</sub> the largest moment compressing the flange and M<sub>A</sub>, M<sub>B</sub>, M<sub>C</sub> the absolute envelope values at the quarter points (largest compression, or smallest tension where the flange is never in compression), as defined in Appendix D6.6; brace points at the supports and at the cross-frame spacing), and R<sub>b</sub>; where the compression flange changes within the unbraced length, lateral-torsional buckling uses the smallest compression flange in it (conservative; the γ<sub>e</sub> methods of Appendix D6.6 are not implemented); deck-placement lateral-torsional buckling also uses C<sub>b</sub> from the deck-placement moments; Service II flange stresses and web bend-buckling; deck-placement constructibility; flange fatigue, Fatigue I, Category B at the flange-to-web welds (extreme fiber) and Category C′ at the connection plates welded to the flanges at every cross-frame (inner flange face, 6.6.1.3.1), unless turned off or limited to Category B; and optionally L/800 deflection); and resizing, with each flange's required area set from the check ratio so plates are thickened where a check exceeds 1.0 and trimmed where there is spare capacity. When the layout stops changing it is verified against its own recomputed demands, and the cheapest passing candidate is selected. The result lists the governing check and ratio for every plate. Applying it replaces the girder layout (and the stiffener setting); Revert restores the previous design.</p>
@@ -2591,6 +2595,8 @@
       ${fld('d<sub>e</sub>, minimum (4.6.2.2)', 'ws.deMin', 'ft')}${fld('d<sub>e</sub>, maximum (4.6.2.2)', 'ws.deMax', 'ft')}
       ${fld('Girder spacing S, minimum', 'ws.sMin', 'ft')}${fld('Girder spacing S, maximum', 'ws.sMax', 'ft')}
       <p class="note full">Limits: verify / owner. Defaults: overhang 1.5 to 4.0 ft and not more than 0.5S; d<sub>e</sub> from −1.0 to 5.5 ft and S from 3.5 to 16.0 ft (the ranges of the AASHTO 4.6.2.2 distribution factor equations). For each girder count from 3 that fits the limits, S = (W − 2·overhang)/(N − 1), the overhang is chosen to balance the exterior and interior live load moment distribution factors, and the girder is sized with Suggest. Nothing on the Bridge or Girder tab changes until you apply a row.</p>
+      <p class="note full">This study is quick because it uses Suggest's fast mode only: one constant-stiffness beam model, flange areas from lever-arm estimates, and this tool's layout checks (no strength, service, or fatigue check). When it finishes, the Suggest tab offers <b>Full design of the best N</b>: Full design (staged analysis, AASHTO checks) re-sizes only the leading girder counts, because it takes about a minute for each.</p>
+      ${fld('Full design: number of best girder counts', 'ws.nFull', '', 'num', { full: true, note: '(1 to 5; default 3)' })}
       <button type="button" class="proj-btn proj-btn-primary full" id="ws_run">Suggest girder count, spacing, and overhangs</button>
       <div id="ws_prog" class="full"></div>
     </div>
@@ -2714,7 +2720,7 @@
       ${s.full ? `<p class="note-p">Fast-mode suggestion for comparison: ${money(s.full.fastCost.total)}; the full design is ${f2(100 * (1 - C.total / s.full.fastCost.total))}% cheaper.</p>` : ''}
       ${!s.full && s.rec.cands ? `<h4 class="sg-h4">Candidates (fast mode, lowest cost first)</h4><div class="tscroll"><table class="tbl"><thead><tr><th class="right">D (in)</th><th>Web</th><th class="right">d<sub>o</sub>/D</th><th class="right">t<sub>w</sub></th><th class="right">Steel (kip)</th><th class="right">Transitions</th><th class="right">Stiffeners</th><th class="right">Cost</th><th>Span-to-depth</th></tr></thead><tbody>${s.rec.cands.slice(0, 10).map(c => `<tr class="${c.best ? 'gov' : ''}"><td class="val">${f0(c.D)}</td><td>${c.wt}</td><td class="val">${c.wt === 'stiffened' ? f2(c.doR) : '—'}</td><td class="val">${frac(c.tw)}</td><td class="val">${f0(c.cost.wTot / 1000)}</td><td class="val">${c.cost.nTr}</td><td class="val">${c.cost.nSt}</td><td class="val">${money(c.cost.total)}</td><td>${c.ok ? 'OK' : 'Too shallow'}</td></tr>`).join('')}</tbody></table></div>` : ''}`);
   if (s.full) { const F = s.full, gt = list => `<div class="tscroll"><table class="tbl"><thead><tr><th class="right">From (ft)</th><th class="right">To (ft)</th><th class="right">Plate (in)</th><th class="right">Ratio</th><th>Governing check</th></tr></thead><tbody>${list.map(g => `<tr><td class="val">${f2(g.x0)}</td><td class="val">${f2(g.x1)}</td><td class="val" style="white-space:nowrap">${frac(g.b)} × ${frac(g.t)}</td><td class="val">${g.ratio ? f3(g.ratio) : '—'}</td><td>${g.gov || 'Minimum size or proportion'}</td></tr>`).join('')}</tbody></table></div>`;
-    h += card('sg-full', 'Full design', F.passed ? 'Every check at or below 1.0' : 'No candidate passed every check', `<p class="note-p">${F.passed ? '' : '<b>Review:</b> the layout shown is the closest candidate. '}Each candidate was iterated with the staged, cracked analysis (Structural analysis settings) until its layout stopped changing, then verified against its own recomputed demands. Checks at every node for the interior and exterior girders: Strength I positive flexure (6.10.7, plastic moment, compactness, D<sub>p</sub>/D<sub>t</sub>, 1.3M<sub>y</sub> for continuous spans), Strength I negative flexure (6.10.8: flange local buckling, lateral-torsional buckling with L<sub>b</sub> = ${f2(F.check.Lb)} ft and C<sub>b</sub> = 1.0, R<sub>b</sub>; tension flange), Service II flange stresses and web bend-buckling (6.10.4.2.2), deck-placement constructibility (6.10.3.2), and flange fatigue when selected. Plate boundaries are checked on both sides. Where the compression flange changes within an unbraced length, lateral-torsional buckling uses the smallest flange in it over the full length (conservative; the γ<sub>e</sub> methods of App. D6.6 are not applied). Shear is sized by 6.10.9.</p>
+    h += card('sg-full', 'Full design', F.passed ? 'Every check at or below 1.0' : 'No candidate passed every check', `<p class="note-p">${F.passed ? '' : '<b>Review:</b> the layout shown is the closest candidate. '}Each candidate was iterated with the staged, cracked analysis (Structural analysis settings) until its layout stopped changing, then verified against its own recomputed demands. Every iteration re-runs the analysis on the current plates and recomputes the live load distribution factors (4.6.2.2) from that section's K<sub>g</sub>; the live load stage model of the first iteration is reused inside the loop to save time, and the final verification recomputes everything. Checks at every node for the interior and exterior girders: Strength I positive flexure (6.10.7, plastic moment, compactness, D<sub>p</sub>/D<sub>t</sub>, 1.3M<sub>y</sub> for continuous spans), Strength I negative flexure (6.10.8: flange local buckling, lateral-torsional buckling with L<sub>b</sub> = ${f2(F.check.Lb)} ft and C<sub>b</sub> = 1.0, R<sub>b</sub>; tension flange), Service II flange stresses and web bend-buckling (6.10.4.2.2), deck-placement constructibility (6.10.3.2), and flange fatigue when selected. Plate boundaries are checked on both sides. Where the compression flange changes within an unbraced length, lateral-torsional buckling uses the smallest flange in it over the full length (conservative; the γ<sub>e</sub> methods of App. D6.6 are not applied). Shear is sized by 6.10.9.</p>
       <div class="tscroll"><table class="tbl"><thead><tr><th class="right">D (in)</th><th>Web</th><th class="right">Cross-frames</th><th class="right">Iterations</th><th class="right">Max. flange ratio</th><th class="right">Web ratio</th><th class="right">Cost</th><th class="right">Fast-mode cost</th><th>Result</th></tr></thead><tbody>${F.cands.map(c => `<tr class="${c.best ? 'gov' : ''}"><td class="val">${f0(c.D)}</td><td>${c.wt}${c.wt === 'stiffened' ? `, d<sub>o</sub> = ${f2(c.doR)}D` : ''}</td><td class="val">${f2(c.spacing)} ft</td><td class="val">${c.iters}</td><td class="val">${f3(c.max)}</td><td class="val">${f3(c.web)}</td><td class="val">${money(c.cost.total)}</td><td class="val">${money(c.fastCost.total)}</td><td>${c.pass ? (c.best ? 'Selected' : 'Passes') : 'Does not pass'}${c.defl ? `; Δ<sub>LL</sub> ${f3(c.defl.d)} / ${f3(c.defl.lim)} in` : ''}</td></tr>`).join('')}</tbody></table></div>
       <div class="g2" style="margin-top:10px"><div><h4 class="sg-h4">Top flange: governing checks</h4>${gt(F.topGov)}</div><div><h4 class="sg-h4">Bottom flange: governing checks</h4>${gt(F.botGov)}</div></div>
       <p class="note-p">Web: ${F.check.gWeb ? `${F.check.gWeb}, ratio ${f3(F.check.rWeb)} at ${f2(F.check.xWeb)} ft` : 'no bend-buckling demand'}.${F.check.other.length ? ` Also: ${[...new Set(F.check.other.map(o => o.name))].join('; ')} exceeded at some points.` : ''} ${F.check.fat ? `Flange fatigue: Fatigue I, Category B at the flange-to-web welds (extreme fiber)${P.suggest.fat !== 'B' ? ' and Category C′ at the connection plates welded to the flanges at every cross-frame (inner flange face, 6.6.1.3.1)' : ''} (6.6.1.2), short-term composite section for both signs (minimum reinforcement per 6.10.1.7).` : 'Flange fatigue was not checked (turned off).'} Other fatigue details are checked in the Fatigue module.</p>`); }
@@ -3440,7 +3446,7 @@
    whose exterior and interior girder live load moment distribution factors (this tool's AASHTO 4.6.2.2 equations, longest span) are closest is used
    (ties: closest to 0.375S). Each candidate is sized with Suggest (fast mode) and checked like an alternative. Nothing is applied without a click. */
 let WS = null, WS_RUN = 0;
-function wsKey() { return JSON.stringify([P.bridge, P.ws, P.limits, P.suggest, P.framing, P.costs, P.girder.gF, P.girder.gW]); }
+function wsKey() { const { nFull, ...ws } = P.ws || {}; return JSON.stringify([P.bridge, ws, P.limits, P.suggest, P.framing, P.costs, P.girder.gF, P.girder.gW]); }   // nFull (how many to run in full) does not make the study stale
 function wsSetup() {
   const w = P.ws, W = num(w.W), L = { ohMin: num(w.ohMin), ohMax: num(w.ohMax), ohS: num(w.ohS), deMin: num(w.deMin), deMax: num(w.deMax), sMin: num(w.sMin), sMax: num(w.sMax) }, errs = [];
   if (!(W > 0)) errs.push('Enter the out-to-out deck width.');
@@ -3508,7 +3514,8 @@
     ${stale ? '<div class="alert warn" style="margin:0 0 8px"><b>Inputs changed since this study.</b> Run it again from the Suggest input tab.</div>' : ''}
     ${best ? `<div class="sg-head pass"><div><b>Recommended (${P.ws.obj === 'nb' ? 'fewest girders' : 'least total steel weight'}): ${best.N} girders at ${f2(best.S)} ft, overhangs ${f2(best.oh)} ft</b><span>${f2(best.psf)} lb/ft² of deck, ${f2(best.wt)} kip per girder, web ${frac(best.D)} × ${frac(best.tw)}</span></div><button type="button" class="btn btn-primary" data-wsapply="${WS.res.indexOf(best)}">Apply</button></div>` : '<div class="alert warn" style="margin:0 0 8px"><b>No candidate passes every check.</b> Any row can still be applied.</div>'}
     <div class="tscroll"><table class="tbl alttbl"><thead><tr><th>N</th><th class="right">S (ft)</th><th class="right">Overhang (ft)</th><th class="right">d<sub>e</sub> (ft)</th><th class="right">g<sub>M</sub> int.</th><th class="right">g<sub>M</sub> ext.</th><th>Girder section</th><th class="right">Steel per girder (kip)</th><th class="right">Total (kip)</th><th class="right">lb/ft² of deck</th><th class="right">Governing ratio</th><th>Bracing</th><th>Checks</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
-    <p class="note-p">Distribution factors: this tool's built-in AASHTO 4.6.2.2 equations (longest span, moment, interior: Table 4.6.2.2.2b-1; exterior: lever rule and Table 4.6.2.2.2d-1), an estimate for comparing girder counts; run LL &amp; DL (lldf) for the chosen layout before final design. Overhang: the value within the limits that balances the exterior and interior moment factors (ties: nearest 0.375S). Steel weight includes the ${f2(P.limits.allow)}% detail allowance. Governing ratio: the largest ratio among this tool's layout checks (proportions, transitions, splices, framing) for the sized girder; the strength design is by Suggest's approximate method. Bracing: girder depth at Abutment 1 against the ${f2(dmin)} in minimum for cross-frames (Framing tab).${st.skip.length ? ` No overhang within the limits works for N = ${st.skip.join(', ')}.` : ''}${errs.length ? ` Not sized: ${errs.map(r => `N = ${r.N} (${esc(r.err)})`).join('; ')}.` : ''} Limits: overhang ${f2(st.L.ohMin)} to ${f2(st.L.ohMax)} ft and ≤ ${f2(st.L.ohS)}S, d<sub>e</sub> ${f2(st.L.deMin)} to ${f2(st.L.deMax)} ft, S ${f2(st.L.sMin)} to ${f2(st.L.sMax)} ft (verify / owner).</p>`);
+    <p class="note-p">Distribution factors: this tool's built-in AASHTO 4.6.2.2 equations (longest span, moment, interior: Table 4.6.2.2.2b-1; exterior: lever rule and Table 4.6.2.2.2d-1), an estimate for comparing girder counts; run LL &amp; DL (lldf) for the chosen layout before final design. Overhang: the value within the limits that balances the exterior and interior moment factors, computed with K<sub>g</sub> of a trial girder sized at the overhang nearest 0.375S (ties: nearest 0.375S). Steel weight includes the ${f2(P.limits.allow)}% detail allowance. Governing ratio: the largest ratio among this tool's layout checks (proportions, transitions, splices, framing) for the sized girder; the strength design is by Suggest's approximate method. Bracing: girder depth at Abutment 1 against the ${f2(dmin)} in minimum for cross-frames (Framing tab).${st.skip.length ? ` No overhang within the limits works for N = ${st.skip.join(', ')}.` : ''}${errs.length ? ` Not sized: ${errs.map(r => `N = ${r.N} (${esc(r.err)})`).join('; ')}.` : ''} Limits: overhang ${f2(st.L.ohMin)} to ${f2(st.L.ohMax)} ft and ≤ ${f2(st.L.ohS)}S, d<sub>e</sub> ${f2(st.L.deMin)} to ${f2(st.L.deMax)} ft, S ${f2(st.L.sMin)} to ${f2(st.L.sMax)} ft (verify / owner).</p>
+    <p class="note-p"><b>What this table is.</b> Every row is sized with Suggest's <i>fast mode</i>: one constant-stiffness continuous-beam model, flange areas from lever-arm estimates, and only this tool's layout checks. No strength, service, or fatigue check has been made on these girders, so the weights are a ranking aid. The next card re-sizes the best few with Full design.</p>`) + wsfHtml();
 }
 function wsApply(i) { const r = WS && WS.res[i]; if (!r || r.err) return;
   if (!confirm(`Apply ${r.N} girders at ${f2(r.S)} ft with ${f2(r.oh)} ft overhangs and the sized girder (web ${frac(r.D)} × ${frac(r.tw)}) to the project? This replaces the girder count, spacing, overhangs, girder plates, splices, and the stiffener setting. You can revert afterwards.`)) return;
@@ -3516,6 +3523,94 @@
   P.bridge.nb = r.N; P.bridge.S = +r.S.toFixed(4); P.bridge.spacing = 'equal'; P.bridge.ohL = r.oh; P.bridge.ohR = r.oh; P.girder = JSON.parse(JSON.stringify(r.girder)); P.framing.stiff = r.framing.stiff; P.framing.doRatio = r.framing.doRatio;
   fillInputs(); ['web', 'top', 'bot', 'spl'].forEach(renderArr); recompute(); setOTab('summary'); autosave(); }
 document.addEventListener('click', e => { if (e.target.id === 'ws_run') { wsRun(); return; } const a = e.target.closest && e.target.closest('[data-wsapply]'); if (a) wsApply(+a.dataset.wsapply); });
+/* ---------------- full design of the best girder counts from the deck-width study (2026-10-12) ----------------
+   Takes the best N rows of the fast study (wsfPicks: passing rows by the study's objective, then failing rows by governing ratio) and runs
+   suggestFull, unchanged, on a deep copy of the project with that row's bridge (N, S equal, both overhangs). P is not changed until Apply.
+   Each result is then built and checked like a fast row (layout checks), and the distribution factors of the final girder are read from
+   a staged analysis of it (suggestLayout analyze: the same demand() the final verification uses). Run on request only (minutes). */
+let WSF = null;
+function wsfN() { const n = Math.round(num(P.ws && P.ws.nFull)); return n >= 1 ? Math.min(5, n) : 3; }
+function wsfPicks() { if (!WS || !WS.done) return [];
+  const ok = WS.res.filter(r => !r.err), pass = ok.filter(r => !r.fails.length), fail = ok.filter(r => r.fails.length);
+  pass.sort(P.ws.obj === 'nb' ? (a, b) => a.N - b.N || a.psf - b.psf : (a, b) => a.psf - b.psf || a.N - b.N);
+  fail.sort((a, b) => a.gov.r - b.gov.r || a.psf - b.psf);
+  return [...pass, ...fail].slice(0, wsfN()); }
+function wsfEval(c, Pc, r, secs) {
+  const base = { N: c.N, S: c.S, oh: c.oh, de: c.de, fastPsf: c.psf, fastWt: c.wt, secs };
+  if (!r || (r.errors && r.errors.length)) return { ...base, err: r ? r.errors[0] : 'No result.' };
+  const strip = l => l.map(x => { const o = { L: x.L, t: x.t }; if (x.b !== undefined) o.b = x.b; return o; });
+  const fr0 = { ...Pc.framing }; if (r.webType) fr0.stiff = r.webType === 'stiffened' ? 'on' : 'off'; if (r.webType === 'stiffened' && r.doR) fr0.doRatio = r.doR; if (r.spacing) fr0.spacing = r.spacing;
+  const girder = { ...Pc.girder, D: r.D, web: strip(r.web), top: strip(r.top), bot: strip(r.bot), splices: [...r.splices] }, Pg = { ...Pc, girder, framing: fr0 };
+  const m = buildModel(Pg); if (m.errors.length) return { ...base, err: m.errors[0] };
+  const fr = framingLayout(Pg, m), cc = [...runChecks(m), ...framingChecks(m, fr, Pg)];
+  const A = suggestLayout(Pg, { analyze: { D: r.D, top: r.top, bot: r.bot, web: r.web } }), sp = A.spans || [], iMax = sp.indexOf(Math.max(...sp)), TY = (A.R && A.R.types) || {};
+  const gI = TY.int ? TY.int.dfSpan[iMax].mM : null, gE = TY.ext ? TY.ext.dfSpan[iMax].mM : null;
+  const F = r.full, sel = F.cands.find(q => q.best) || {}, mx = l => l.reduce((a, g) => (g.b * g.t > a.b * a.t ? g : a), l[0]);
+  const fails = cc.filter(k => k.status === 'fail').map(k => k.id), warns = cc.filter(k => k.status === 'warn').map(k => k.id);
+  let ac = []; try { ac = analysisChecks(m, analyzeGirder(Pg, m), Pg); } catch (e) { console.error(e); }   // Analysis tab checks (A1-A3): shown, not part of pass/fail
+  const aFails = ac.filter(k => k.status === 'fail').map(k => k.id);
+  return { ...base, aFails, D: r.D, tw: r.tw, webType: r.webType, doR: r.doR, spacing: r.spacing, top: mx(r.top), bot: mx(r.bot), wt: m.wt, psf: m.psf, tot: m.wt * c.N, cost: r.cost.total,
+    fMax: F.check.max, fWeb: F.check.rWeb, fPass: !!F.passed, iters: sel.iters, nCand: F.cands.length, gI, gE, dfx: !!A.dfxUsed, fails, warns, pass: !!F.passed && !fails.length,
+    dg: r.D + r.top[0].t + r.bot[0].t, girder, framing: { stiff: fr0.stiff, doRatio: fr0.doRatio, spacing: fr0.spacing } };
+}
+function wsfPick(res) { const ok = res.filter(r => !r.err && r.pass); if (!ok.length) return null;
+  return P.ws.obj === 'nb' ? ok.reduce((a, r) => r.N < a.N || (r.N === a.N && r.psf < a.psf) ? r : a) : ok.reduce((a, r) => r.psf < a.psf - 1e-9 ? r : a); }
+function wsfProg() { if (!WSF) return; const fl = $('#wsf_fill'), ms = $('#wsf_msg'); if (fl) fl.style.width = `${Math.round(100 * WSF.frac)}%`; if (ms) ms.textContent = `${WSF.msg} (${Math.round((Date.now() - WSF.t0) / 1000)} s)`; }
+async function wsfRun() {
+  if (WSF && WSF.running) return;
+  if (SG_RUN) { flash('Full design is already running; wait for it to finish.', 'fail'); return; }
+  if (!WS || !WS.done || WS.key !== wsKey()) { flash('Run the girder count study again first (its inputs changed).', 'fail'); return; }
+  const picks = wsfPicks(); if (!picks.length) return;
+  const snap = JSON.stringify(P);   // the project as it is now; every girder count is designed on its own copy of it
+  WSF = { ws: WS, key: wsKey(), running: true, cancel: false, t0: Date.now(), res: [], picks: picks.map(r => r.N), frac: 0, msg: 'Starting…' };
+  const b1 = $('#sg_full'), b2 = $('#ws_run'); if (b1) b1.disabled = true; if (b2) b2.disabled = true;   // one full design at a time; the study stays as it is
+  renderSuggestSafe(); wsfProg();
+  for (let k = 0; k < picks.length; k++) { const c = picks[k], t1 = Date.now(), Pc = JSON.parse(snap);
+    Pc.bridge = { ...Pc.bridge, nb: c.N, S: c.S, spacing: 'equal', ohL: c.oh, ohR: c.oh };
+    const prog = (f, m) => { WSF.frac = (k + f) / picks.length; WSF.msg = `${c.N} girders (${k + 1} of ${picks.length}): ${m}`; wsfProg(); };
+    let r = null; try { r = await suggestFull(Pc, prog, () => WSF.cancel); } catch (e) { console.error(e); r = { errors: ['Full design failed: ' + e.message] }; }
+    if (WSF.cancel || !r) break;
+    let row; try { row = wsfEval(c, Pc, r, (Date.now() - t1) / 1000); } catch (e) { console.error(e); row = { N: c.N, S: c.S, oh: c.oh, err: e.message }; }
+    WSF.res.push(row);
+  }
+  WSF.running = false; WSF.secs = (Date.now() - WSF.t0) / 1000; WSF.cancelled = WSF.cancel;
+  if (b1) b1.disabled = false; if (b2) b2.disabled = false;
+  renderSuggestSafe();
+  flash(WSF.cancelled ? `Full design of the girder counts cancelled (${WSF.res.length} of ${picks.length} done).` : `Full design of ${picks.length} girder count${picks.length > 1 ? 's' : ''} complete (${Math.round(WSF.secs)} s); see the Suggest tab.`);
+}
+function wsfHtml() {
+  if (!WS || !WS.done || !WS.res.some(r => !r.err)) return '';
+  const W = WSF && WSF.ws === WS ? WSF : null, picks = W ? W.picks : wsfPicks().map(r => r.N), n = picks.length, stale = WS.key !== wsKey(), dmin = num(P.framing.xfMinD) || 48;
+  const notes = `<p class="note-p"><b>What this step does.</b> The table above sizes every girder count quickly with Suggest's fast mode (constant-stiffness beam, lever-arm flange areas, layout checks only). This step takes the best ${n} of those rows (ranked by the study's objective, ${P.ws.obj === 'nb' ? 'fewest girders' : 'least total steel weight'}: passing rows first, then the others by governing ratio) and runs <b>Full design</b> on each, the same procedure as <i>Run full design</i> on the Suggest input tab, with that row's girder count, spacing (equal), and overhangs. For each girder count, Full design takes Suggest's best depth and web candidates and repeats: the staged, cracked analysis of the current plates (DC1 on the steel section; DC2 and DW on the long-term composite section, 3n; live load on the short-term composite section, n; the composite stages cracked near interior piers; GirderDetail's Structural analysis settings), the live load distribution factors recomputed from that section's K<sub>g</sub> (this tool's AASHTO 4.6.2.2 equations), the AASHTO checks at every node (Strength I, Service II, deck placement, and flange fatigue when selected), and resizing of the flanges and web. To save time, the live load model of the first iteration is reused inside the loop. When the plates stop changing, the girder is verified against fully recomputed demands and factors, and those final checks decide pass or fail. With "Optimize cross-frame spacing" on, it also tries other cross-frame spacings.</p>
+    <p class="note-p"><b>Kept from the fast study:</b> the girder count, spacing, and overhangs; they are not re-optimized here. <b>Why only the best few:</b> Full design runs dozens of staged analyses for each girder count (about 20 to 60 s each, longer for many spans), so it is run on request for the leading rows only (number set on the Suggest input tab). The ranking below uses the full-design results. <b>Still preliminary:</b> the distribution factors are this tool's estimate; run LL &amp; DL (lldf) for the chosen layout and complete the design checks in GirderDetail before final design.</p>`;
+  let body = '';
+  if (W && W.running) body = `<div class="sg-prog"><div class="sg-prog-top"><b>Full design running</b><span id="wsf_msg">${esc(W.msg)}</span><button type="button" class="dg-btn" id="wsf_cancel">Cancel</button></div><div class="sg-prog-bar"><div id="wsf_fill" style="width:${Math.round(100 * W.frac)}%"></div></div></div>`;
+  else body = `<div class="sg-head"><div><b>Full design of the best ${n}: N = ${picks.join(', ')}</b><span>${stale ? 'Inputs changed since the study: run the study again first.' : 'Takes about a minute for each girder count; it can be cancelled.'}</span></div><button type="button" class="btn btn-primary" id="wsf_run"${stale || !n ? ' disabled' : ''}>Full design of the best ${n}</button></div>`;
+  if (W && W.res.length) {
+    const ok = W.res.filter(r => !r.err), best = wsfPick(W.res), rStale = W.key !== wsKey();
+    const rows = ok.map(r => `<tr class="${r === best ? 'gov' : ''}"><td>${r.N}</td><td class="val">${f2(r.S)}</td><td class="val">${f2(r.oh)}</td>
+      <td class="lbl">${frac(r.D)} × ${frac(r.tw)} web (${r.webType === 'stiffened' ? `stiff., d<sub>o</sub> = ${f2(r.doR)}D` : 'unstiff.'}); top ${frac(r.top.b)} × ${frac(r.top.t)}, bottom ${frac(r.bot.b)} × ${frac(r.bot.t)} max.</td>
+      <td class="val">${f2(r.spacing)}</td><td class="val">${f2(r.wt)}</td><td class="val">${f2(r.tot)}</td><td class="val">${f2(r.psf)}</td><td class="val">${f2(r.fastPsf)}</td>
+      <td class="val">${f3(Math.max(r.fMax, r.fWeb))}</td><td class="val">${r.gI != null ? f3(r.gI) : '—'}</td><td class="val">${r.gE != null ? f3(r.gE) : '—'}</td><td class="val">${r.iters != null ? r.iters : '—'} (${r.nCand})</td>
+      <td>${r.dg >= dmin - 1e-9 ? 'Cross-frames' : 'Channel / rolled diaphragms'}</td>
+      <td>${!r.fPass ? '<span class="badge fail">Full design: fails</span>' : r.fails.length ? `<span class="badge fail" title="${r.fails.join(', ')}">${r.fails.length} layout fail</span>` : r.warns.length ? `<span class="badge warn" title="${r.warns.join(', ')}">pass, ${r.warns.length} warn</span>` : badge('pass')}${r.aFails && r.aFails.length ? ` <span class="badge warn" title="Analysis tab checks, not part of the result: see the note">${r.aFails.join(', ')} (Analysis tab)</span>` : ''}</td>
+      <td><button type="button" class="dg-btn" data-wsfapply="${W.res.indexOf(r)}">Apply</button></td></tr>`).join('');
+    const errs = W.res.filter(r => r.err);
+    body += `${rStale ? '<div class="alert warn" style="margin:8px 0"><b>Inputs changed since this full design.</b> Run the study and this step again.</div>' : ''}
+    ${W.cancelled ? `<div class="alert warn" style="margin:8px 0"><b>Cancelled</b> after ${W.res.length} of ${W.picks.length} girder counts.</div>` : ''}
+    ${best ? `<div class="sg-head pass" style="margin-top:8px"><div><b>Recommended after full design (${P.ws.obj === 'nb' ? 'fewest girders' : 'least total steel weight'}): ${best.N} girders at ${f2(best.S)} ft, overhangs ${f2(best.oh)} ft</b><span>${f2(best.psf)} lb/ft² of deck, ${f2(best.wt)} kip per girder, web ${frac(best.D)} × ${frac(best.tw)}, cross-frames at ${f2(best.spacing)} ft</span></div><button type="button" class="btn btn-primary" data-wsfapply="${W.res.indexOf(best)}">Apply</button></div>` : '<div class="alert warn" style="margin:8px 0"><b>No girder count passes after full design.</b> Any row can still be applied.</div>'}
+    <div class="tscroll"><table class="tbl alttbl"><thead><tr><th>N</th><th class="right">S (ft)</th><th class="right">Overhang (ft)</th><th>Girder section (full design)</th><th class="right">Cross-frames (ft)</th><th class="right">Steel per girder (kip)</th><th class="right">Total (kip)</th><th class="right">lb/ft² of deck</th><th class="right">Fast study lb/ft²</th><th class="right">Max. ratio</th><th class="right">g<sub>M</sub> int.</th><th class="right">g<sub>M</sub> ext.</th><th class="right">Iterations (candidates)</th><th>Bracing</th><th>Result</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
+    <p class="note-p">Max. ratio: the largest flange or web ratio of Full design's final verification (fully recomputed staged demands). Result: "pass" needs every Full design check at or below 1.0 and no failing layout check of this tool (proportions, transitions, splices, framing); the recommendation is the passing row with the least lb/ft² of deck (= least total steel, the width being fixed) or the fewest girders, as chosen. The Analysis tab checks (A1 live load deflection, A2 bearing uplift, A3 bearing stiffener bearing) are also run on each girder and named beside the result when they fail, but they do not decide it: they depend on the bearing stiffener size on the Framing tab and on the bearings, which Suggest does not size. With fewer, more widely spaced girders the reactions grow, so A3 may need a larger bearing stiffener after Apply. g<sub>M</sub>: live load moment distribution factors of the final girder, longest span${ok.some(r => r.dfx) ? ' (GirderDetail\'s factors where they match the bridge exactly)' : ''}, from the staged analysis of that girder; they differ from the fast table, which used the fast-mode section. Iterations: of the selected depth candidate; in parentheses the number of depth and cross-frame spacing candidates refined. Steel weight includes the ${f2(P.limits.allow)}% detail allowance. Run time ${f0(W.secs || 0)} s${ok.length ? ` (${ok.map(r => `N = ${r.N}: ${f0(r.secs)} s`).join(', ')})` : ''}.${errs.length ? ` Not designed: ${errs.map(r => `N = ${r.N} (${esc(r.err)})`).join('; ')}.` : ''} Apply sets the girder count, spacing, overhangs, girder plates, splices, stiffener setting, and cross-frame spacing.</p>`;
+  }
+  return card('ws-fd', 'Full design of the best girder counts', `Best ${n} of the deck-width study`, notes + body);
+}
+function wsfApply(i) { const r = WSF && WSF.res[i]; if (!r || r.err || WSF.running) return;
+  if (!confirm(`Apply ${r.N} girders at ${f2(r.S)} ft with ${f2(r.oh)} ft overhangs and the full-design girder (web ${frac(r.D)} × ${frac(r.tw)}, cross-frames at ${f2(r.spacing)} ft) to the project? This replaces the girder count, spacing, overhangs, girder plates, splices, the stiffener setting, and the cross-frame spacing. You can revert afterwards.`)) return;
+  snapshotBefore(`Girder count from deck width, full design (${r.N} girders at ${f2(r.S)} ft)`);
+  P.bridge.nb = r.N; P.bridge.S = +r.S.toFixed(4); P.bridge.spacing = 'equal'; P.bridge.ohL = r.oh; P.bridge.ohR = r.oh; P.girder = JSON.parse(JSON.stringify(r.girder));
+  P.framing.stiff = r.framing.stiff; if (r.webType === 'stiffened' && r.doR) P.framing.doRatio = r.framing.doRatio; if (r.spacing) P.framing.spacing = r.framing.spacing;
+  fillInputs(); ['web', 'top', 'bot', 'spl'].forEach(renderArr); recompute(); setOTab('summary'); autosave(); }
+document.addEventListener('click', e => { if (e.target.id === 'wsf_run') { wsfRun(); return; } if (e.target.id === 'wsf_cancel' && WSF && WSF.running) { WSF.cancel = true; return; } const a = e.target.closest && e.target.closest('[data-wsfapply]'); if (a) wsfApply(+a.dataset.wsfapply); });
 function xfNoteHtml(s) { const dmin = num(P.framing.xfMinD) || 48, d = s.D + s.top[0].t + s.bot[0].t;
   return `<div class="alert info"><b>Intermediate bracing:</b> girder depth d = ${f2(d)} in at Abutment 1 ${d >= dmin - 1e-9 ? `≥ ${f2(dmin)} in: cross-frames.` : `< ${f2(dmin)} in (minimum for cross-frames, Framing tab; common practice, owner standards govern): channel (C, MC, depth about half the girder depth or more) or rolled W diaphragms; check them in GirderDetail's Cross-frames module.`}</div>`; }
 
```

## 2026-10-12 — PR: claude/girderdetail-four (engineer's approved follow-ups; PR link added after merge)

Engineer's approval (2026-10-12) of four follow-ups: (1) Suggest applies the span-to-depth limits whenever the Limits tab treats them as mandatory; (2) the deck-width study's overhang limits agree with check G6; (3) a warning when field splices are "Included" but Preliminary sizing has none; (4) auto-design splice failure names the cause. Basis: AASHTO LRFD 10th Ed. (2024). Items 1 and 2 change Suggest results (§4 callouts in G7 and G8); items 3 and 4 are messages only.

**PlateLine edits (G7, G8):** base64-decode `const PL_B64 = '...'` (standard alphabet, `=` padding, one line; UTF-8 HTML with LF line endings), apply the PlateLine diff of the entry, encode again without line wrapping. Line numbers: `PL:` ≈ line in the decoded PlateLine (branch). Sizes: main 605,528 characters (decoded 454,145 bytes); after G7 607,264 (455,448); after G8 608,864 (456,646).

### G7. PlateLine Suggest: span-to-depth (Table 2.5.2.6.3-1) applies whenever the Limits tab treats it as mandatory; Full design keeps it to the end   [§4: Suggest result changes when "Span-to-depth limits" is "Do not apply" and "Treat span-to-depth as mandatory" is on] [checks G1/G2 unchanged]
- **Where (PL):**
  - `suggestLayout()` → `depthOK(res, D)` (PL ≈ 1849). Anchor `function depthOK(res, D) {   // Table 2.5.2.6.3-1 minimum depths`.
    Before: `if (SG.depthRule === 'off') return true;`
    After: `if (SG.depthRule === 'off' && !P.limits.sdMandatory) return true;   // the Suggest setting applies only when the Limits tab does not treat span-to-depth as mandatory (2026-10-12)`
    `depthOK` is the only place `suggest.depthRule` is read; it is used by fast Suggest (candidate filter `ok`), `clearFrames`, the deck-width study (`wsEval` → `suggestLayout`), Full design (`suggestFull` takes the fast candidates), the study's Full design step (`wsfRun` → `suggestFull`), and the Alternatives web-economy comparison (`suggestLayout(P, { web })`). The Alternatives table itself sizes each case at a fixed depth from the L/D range (one candidate, `keepD`), so it is not affected; G1/G2 failures there are shown as before.
  - `suggestLayout()` `opts.verify` branch (PL ≈ 1882): the returned object gets `dOK: depthOK({ top: t, bot: b, web: w }, V.D)`. Anchor `return { errors: [], check: checkLayout(V.D, t, b, w, Rv), dOK: depthOK(`.
  - `suggestLayout()` `opts.only` branch (PL ≈ 1887): `c.dOK = depthOK(res, o.D);` before `return { errors: [], ...c, N, xs };`.
  - `suggestFull()` → `refine` (PL ≈ 2270–2300): `&& r.dOK` added to the iteration's `pass`; `&& v.dOK` to the verification of the cheapest passing iterations; `&& V.dOK` to the cleanup gate; `&& v.dOK` to the cleanup's accept test; `&& V.dOK` to the candidate's final `pass`; the candidate result gets `dOK: V.dOK`, and `full.cands` carries `dOK: o.dOK`.
  - `renderSuggest()` Full design card (PL ≈ 2725): the Result column shows "Too shallow (Table 2.5.2.6.3-1)" instead of "Does not pass" for a candidate whose only reason is the depth (`c.dOK === false`); the note gets "A candidate passes only if its final plates also meet the Table 2.5.2.6.3-1 minimum depths (span-to-depth applies to Suggest)." when the rule applies.
  - Suggest input tab, "Design rules" (PL ≈ 2619): new note `<p class="note" id="sg-dr-note" hidden>The Limits tab treats span-to-depth as mandatory, so Suggest applies Table 2.5.2.6.3-1 regardless of this setting.</p>` after the `suggest.depthRule` field; shown by `recompute()` (first line, PL ≈ 4036) when `P.limits.sdMandatory && P.suggest.depthRule === 'off'`.
  - Manual, Part 6 "Suggest mode", **Rules.** paragraph. Before: "The span-to-depth limits of Table 2.5.2.6.3-1 apply by default and can be turned off." After: "The span-to-depth limits of Table 2.5.2.6.3-1 apply by default. The Suggest setting can turn them off only when the Limits tab does not treat span-to-depth as mandatory; with "Treat span-to-depth (G1, G2) as mandatory" on, Suggest (fast and full design, the deck-width study, and the web economy comparison) always applies them, so it never proposes a girder that fails G1 or G2. Full design also requires the final plates of each candidate to meet the minimum depths, since resizing can thin the flanges."
- **Problem:** with "Span-to-depth limits" = "Do not apply" on the Suggest tab and "Treat span-to-depth (G1, G2) as mandatory" on (the default) on the Limits tab, Suggest returned a girder that fails G1/G2. Separately, Full design's refine loop resizes flanges with area factors at a fixed D (factor down to 0.8 per iteration), so a candidate that met the minimum depth in fast mode could end below it; the fast filter was the only depth test. Both make the Suggest result **less conservative** than the checks the tool then applies; the fix makes Suggest agree with G1/G2.
- **What Full design does now:** the depth test is part of the pass and verify steps. An iteration whose plates fall below the minimum is not accepted as passing, so the loop keeps the cheapest earlier iteration that met it (or the candidate is reported "Too shallow" and another depth is selected). The search and the area-factor rule themselves are unchanged.
- **§4 callout:**
  - **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 2.5.2.6.3, Table 2.5.2.6.3-1 (I-beam portion of composite I-girders: steel depth ≥ 0.033L simple / 0.027L continuous; overall composite depth ≥ 0.040L / 0.032L). The tool's G1/G2 cite "AASHTO LRFD 2.5.2.6.3, Table 2.5.2.6.3-1" and its reference list cites the 10th Edition. The ratios, the checks G1/G2, and their statuses are unchanged.
  - **Before:** Suggest applied the table only when `suggest.depthRule = 'on'`. **After:** when `suggest.depthRule = 'on'` **or** `limits.sdMandatory = true`. Nothing changes when sdMandatory is off, or when depthRule is 'on' (the default), except the Full design end-of-refine depth test (see the second check case).
  - **Check case 1 (repro; 90 ft simple span, N<sub>b</sub> = 10, S = 4 ft, overhangs 2.25 ft, the rest of the built-in example; Suggest "Do not apply", Limits "mandatory" on):** L = 90 ft → D<sub>st,min</sub> = 0.033(90)(12) = 35.64 in, D<sub>tot,min</sub> = 0.040(90)(12) = 43.20 in; h<sub>h</sub> + t<sub>s</sub> = 10.00 in.

    | | D (in) | t<sub>w</sub> | top | bottom | D<sub>st</sub> (in) | G1 req./prov. | D<sub>tot</sub> (in) | G2 req./prov. |
    |---|---|---|---|---|---|---|---|---|
    | Fast, before | 30 | 1/2 | 13 × 3/4 | 15 × 1 1/4 | 30 + 0.75 + 1.25 = 32.00 | 35.64/32.00 = 1.11 **fail** | 42.00 | 43.20/42.00 = 1.03 **fail** |
    | Fast, after | 37 | 1/2 | 13 × 3/4 | 14 × 1 1/8 | 37 + 0.75 + 1.125 = 38.875 | 0.92 pass | 48.88 | 0.88 pass |
    | Full design, before | 34 | 1/2 | 13 × 3/4 | 13 × 1 1/8 | 35.875 | 0.99 pass | 45.88 | 0.94 pass |
    | Full design, after | 37 | 1/2 | 13 × 3/4 | 13 × 1 | 38.75 | 0.92 pass | 48.75 | 0.89 pass |

    Full design candidates, before: D = 30 ($514,051), 28 ($522,492), 34 ($511,639, selected); after: 37 ($510,434, selected), 35 ($516,463), 39 ($520,080); max. flange ratio of the selected layout 0.907 → 0.901. (Before, Full design happened to select a layout that meets the table because its candidate at D = 34 was cheapest; its fast candidates at 28 and 30 in did not meet it.)
  - **Check case 2 (Full design end-of-refine; depthRule "Apply", mandatory on; 90 ft simple span, N<sub>b</sub> = 6, S = 8 ft, overhangs 2.5 ft, "Keep the web depth" on with D = 34 in, cross-frames 15 ft, cross-frame spacing optimization off):** before, Full design selected top 13 × 7/8, bottom 17 × 3/4 at the ends / 17 × 1 3/8 middle: D<sub>st</sub> = 34 + 0.875 + 0.75 = 35.625 in < 35.64 → G1 req./prov. = 1.0004 **fail** (shown 1.00), cost $383,169. After: top 13 × 1, same bottom: D<sub>st</sub> = 35.75 ≥ 35.64 → 0.997 pass, cost $392,575.
  - **Default example unchanged:** built-in example (depthRule 'on', sdMandatory on): fast Suggest (D = 63, plates, splices, cost, candidate list) and Run full design (D = 71 stiffened, every plate, splices 80/141/219/280 ft, cost $1,597,506, the whole `SG.full` object) bit-identical main vs branch (headless Chromium). With sdMandatory off and depthRule 'off', the repro gives the same D = 30 girder before and after (G1/G2 warnings, as before).
- **Saved data:** no key or format change; saved `suggest.depthRule` values are not rewritten.
- **How verified:** `node --check` on both inline scripts of the decoded PlateLine; headless Chromium main vs branch for the cases above; note shown/hidden as `limits.sdMandatory` is toggled; screenshots `i1_input.png`, `i1_full.png`; no console errors.
- **Other copies:** none (PlateLine exists only in this file).
- **Open items:** none.

### Exact changes (G7): decoded PlateLine (unified diff)

```diff
--- PL (main)
+++ PL (branch)
@@ -1847,7 +1847,7 @@
     return { total: parts.steel + parts.trans + parts.stiff + parts.splice + parts.frames, parts, wG, wTot: nb * wG, nTr, nSt, nSp, nb, nFr, spCF, doR: doR || DO_R };
   }
   function depthOK(res, D) {   // Table 2.5.2.6.3-1 minimum depths, from the plates directly
-    if (SG.depthRule === 'off') return true;
+    if (SG.depthRule === 'off' && !P.limits.sdMandatory) return true;   // the Suggest setting applies only when the Limits tab does not treat span-to-depth as mandatory (2026-10-12)
     const t = res.top.map(r => ({ ...r })), b = res.bot.map(r => ({ ...r })), w = res.web.map(r => ({ ...r })); sgLists(t, b, w);
     return spans.every((Ls, i) => { const a = supX[i], c = supX[i + 1]; let dmin = Infinity;
       for (let x = a + 0.5; x < c; x += 1) dmin = Math.min(dmin, D + sgAt(t, x).t + sgAt(b, x).t);
@@ -1877,13 +1877,13 @@
   if (opts.costOnly) { const V = opts.costOnly; return { errors: [], cost: costOf(V, V.D, V.wt, V.doR) }; }
   if (opts.verify) {         // staged demands and AASHTO checks for a given layout (no resizing)
     const V = opts.verify, cp = l => l.map(r => ({ ...r })), t = cp(V.top), b = cp(V.bot), w = cp(V.web); sgLists(t, b, w);
-    if (V.doR) DO_R = V.doR; const Rv = demand(V.D, t, b, w); return { errors: [], check: checkLayout(V.D, t, b, w, Rv), cost: costOf({ top: t, bot: b, web: w, splices: V.splices }, V.D, V.wt, V.doR), N, xs };
+    if (V.doR) DO_R = V.doR; const Rv = demand(V.D, t, b, w); return { errors: [], check: checkLayout(V.D, t, b, w, Rv), dOK: depthOK({ top: t, bot: b, web: w }, V.D), cost: costOf({ top: t, bot: b, web: w, splices: V.splices }, V.D, V.wt, V.doR), N, xs };
   }
   if (opts.only) {           // one candidate: size with area factors against the staged demands of the previous layout
     const o = opts.only; let R0 = null; if (o.doR) DO_R = o.doR;
     if (opts.layout) { const cp = l => l.map(r => ({ ...r })), t = cp(opts.layout.top), b = cp(opts.layout.bot), w = cp(opts.layout.web); sgLists(t, b, w); R0 = demand(o.D, t, b, w); }
     const res = sizeForDepth(o.D, o.wt, opts.kT, opts.kB, opts.twMin, R0, opts.shifts), c = { D: o.D, wt: o.wt, doR: DO_R, res, cost: costOf(res, o.D, o.wt, DO_R) };
-    c.check = R0 ? checkLayout(o.D, res.top, res.bot, res.web, R0) : null; return { errors: [], ...c, N, xs };
+    c.check = R0 ? checkLayout(o.D, res.top, res.bot, res.web, R0) : null; c.dOK = depthOK(res, o.D); return { errors: [], ...c, N, xs };
   }
   const rec = { D: { Lmax, ratio, cont, Dst: Lmax * 12 / ratio, keep: !!SG.keepD, bumps: 0 } }, cands = [];
   const doList = SG.doOpt === 'off' ? [num(P.framing.doRatio) || 1] : [1, 1.5, 2, 3];
@@ -2268,7 +2268,7 @@
       if (cancelled && cancelled()) return null; prog && prog(Math.min(0.96, ++step / steps), `${tag || `Depth ${c.D} in, ${c.wt} web`}: iteration ${it + 1}`); await tick();
       const r = suggestLayout(P, { full: true, only: cc, kT: req, twMin, layout: { D: c.D, ...lay }, llCache, shifts }), ch = r.check;
       if (!llCache && r.res.rec && r.res.rec.types) { llCache = {}; Object.entries(r.res.rec.types).forEach(([g, T]) => { if (T.bN) llCache[g] = T.bN; }); }
-      const k = key(r.res), pass = ch.max <= 1.0005 && ch.rWeb <= 1.0005; costs.push(r.cost.total);
+      const k = key(r.res), pass = ch.max <= 1.0005 && ch.rWeb <= 1.0005 && r.dOK; costs.push(r.cost.total);
       if (pass) passed.push(r);
       const settled = costs.length >= 3 && Math.abs(costs[costs.length - 1] - costs[costs.length - 3]) / costs[costs.length - 1] < 0.003;
       if (pass && (k === prev || settled)) break;
@@ -2279,10 +2279,10 @@
     }
     // verify the cheapest passing iterations against their own, fully recomputed staged demands
     passed.sort((a, b) => a.cost.total - b.cost.total); let best = null, V = null;
-    for (const cand of passed.slice(0, 3)) { prog && prog(Math.min(0.98, ++step / steps), `${tag || `Depth ${c.D} in`}: verifying`); await tick(); const v = suggestLayout(P, { full: true, verify: { ...cc, ...cand.res } }); if (v.check.max <= 1.0005 && v.check.rWeb <= 1.0005) { best = cand; V = v; break; } }
+    for (const cand of passed.slice(0, 3)) { prog && prog(Math.min(0.98, ++step / steps), `${tag || `Depth ${c.D} in`}: verifying`); await tick(); const v = suggestLayout(P, { full: true, verify: { ...cc, ...cand.res } }); if (v.check.max <= 1.0005 && v.check.rWeb <= 1.0005 && v.dOK) { best = cand; V = v; break; } }
     if (!best) { best = passed[0] || suggestLayout(P, { full: true, only: cc, kT: req, twMin, layout: { D: c.D, ...lay }, shifts }); V = suggestLayout(P, { full: true, verify: { ...cc, ...best.res } }); }
     // cleanup: replace a plate by its lighter neighbor where the design still passes and costs less (removes leftovers of the iteration, such as heavy short end plates)
-    if (V && V.check.max <= 1.0005 && V.check.rWeb <= 1.0005) { let res = JSON.parse(JSON.stringify(best.res)), Vb = V, better = true, n = 0;
+    if (V && V.check.max <= 1.0005 && V.check.rWeb <= 1.0005 && V.dOK) { let res = JSON.parse(JSON.stringify(best.res)), Vb = V, better = true, n = 0;
       const spn = (P.bridge.spans || []).map(Number), skw = (P.bridge.skews || []).map(v => Math.abs(+v || 0)), pal = a => a.every((v, i) => Math.abs(v - a[a.length - 1 - i]) < 1e-6), symB = pal(spn) && pal(skw);
       const symL = L => L.every((q, i) => { const r = L[L.length - 1 - i]; return Math.abs(q.L - r.L) < 1e-6 && q.b === r.b && q.t === r.t; });
       while (better && n++ < 24) { better = false;
@@ -2291,13 +2291,13 @@
             const mir = symB && symL(Lst) ? Lst.length - 1 - i : i;   // symmetric bridge: change the plate and its mirror together
             const merged = []; Lst.map((q, j) => j === i || j === mir ? { ...q, b: nb.b, t: nb.t } : { ...q }).forEach(q => { const la = merged[merged.length - 1]; if (la && la.b === q.b && la.t === q.t) la.L += q.L; else merged.push(q); });
             const cand = { ...res, [fk]: merged }, v = suggestLayout(P, { full: true, verify: { ...cc, ...cand } });
-            if (v.check.max <= 1.0005 && v.check.rWeb <= 1.0005 && v.cost.total < Vb.cost.total - 1) { res = cand; Vb = v; better = true; } }
+            if (v.check.max <= 1.0005 && v.check.rWeb <= 1.0005 && v.dOK && v.cost.total < Vb.cost.total - 1) { res = cand; Vb = v; better = true; } }
           if (better) break; } }
       if (Vb !== V) { best = { ...best, res }; V = Vb; } }
-    const pass = V.check.max <= 1.0005 && V.check.rWeb <= 1.0005; let defl = null;
+    const pass = V.check.max <= 1.0005 && V.check.rWeb <= 1.0005 && V.dOK; let defl = null;
     if (pass && SG.defl === 'on') { const Pc = { ...P, girder: { ...P.girder, D: c.D, web: best.res.web.map(w => ({ L: w.L, t: w.t })), top: best.res.top.map(g => ({ L: g.L, b: g.b, t: g.t })), bot: best.res.bot.map(g => ({ L: g.L, b: g.b, t: g.t })), splices: best.res.splices } };
       const m = buildModel(Pc); if (!m.errors.length) { const an = analyzeGirder(Pc, m); if (!an.errors) defl = Object.values(an.types).flatMap(T => T.dl).reduce((a, q) => (!a || q.d / q.lim > a.d / a.lim) ? q : a, null); } }
-    return { D: c.D, wt: c.wt, doR: c.doR, spacing: +PP.framing.spacing, res: best.res, check: V.check, cost: V.cost, pass: pass && (!defl || defl.d <= defl.lim + 1e-9), iters: it + 1, defl, xs: best.xs, fastCost: c.cost };
+    return { D: c.D, wt: c.wt, doR: c.doR, spacing: +PP.framing.spacing, res: best.res, check: V.check, cost: V.cost, pass: pass && (!defl || defl.d <= defl.lim + 1e-9), dOK: V.dOK, iters: it + 1, defl, xs: best.xs, fastCost: c.cost };
   };
   for (const c of picks) { const r = await refine(P, c); if (!r) return null; out.push(r); }
   // cross-frame spacing: re-run the best candidate at other spacings, cross-frame cost included
@@ -2310,7 +2310,7 @@
   const gov = (list, ratios, names) => { let x = 0; return list.map(g => { const x0 = x; x += g.L; let rm = 0, nm = ''; best.xs.forEach((xx, i) => { if (xx >= x0 - 1e-6 && xx < x - 1e-6 && ratios[i] > rm) { rm = ratios[i]; nm = names[i]; } }); return { ...g, x0, x1: x, ratio: rm, gov: nm }; }); };
   const res = best.res, ch = best.check;
   return { ...fast, D: best.D, webType: best.wt, doR: best.doR, spacing: best.spacing, cost: best.cost, tw: res.tw, web: res.web, top: res.top, bot: res.bot, splices: res.splices, rec: { ...fast.rec, ...res.rec, D: { ...fast.rec.D, final: best.D } },
-    full: { cands: out.map(o => ({ D: o.D, wt: o.wt, doR: o.doR, spacing: o.spacing, pass: o.pass, iters: o.iters, max: o.check.max, web: o.check.rWeb, cost: o.cost, fastCost: o.fastCost, defl: o.defl, best: o === best })), check: ch, topGov: gov(res.top, ch.rT, ch.gT), botGov: gov(res.bot, ch.rB, ch.gB), passed: best.pass, fastCost: fast.cost } };
+    full: { cands: out.map(o => ({ D: o.D, wt: o.wt, doR: o.doR, spacing: o.spacing, pass: o.pass, dOK: o.dOK, iters: o.iters, max: o.check.max, web: o.check.rWeb, cost: o.cost, fastCost: o.fastCost, defl: o.defl, best: o === best })), check: ch, topGov: gov(res.top, ch.rT, ch.gT), botGov: gov(res.bot, ch.rB, ch.gB), passed: best.pass, fastCost: fast.cost } };
 }
 
 
@@ -2357,7 +2357,7 @@
 <h3>Girder count from the deck width</h3><p>With an <b>Out-to-out deck width</b> W on the Suggest input tab, <b>Suggest girder count, spacing, and overhangs</b> compares girder counts. For each N from 3, every overhang on a 0.25 ft grid within the limits gives S = (W &minus; 2&middot;overhang)/(N &minus; 1); a layout is kept when S, the overhang (also &le; a fraction of S), and d<sub>e</sub> = overhang &minus; barrier (or curb) width are within the limits (defaults: overhang 1.5 to 4.0 ft and &le; 0.5S; d<sub>e</sub> &minus;1.0 to 5.5 ft; S 3.5 to 16 ft, the ranges of the 4.6.2.2 equations; verify / owner). Of those, the overhang whose exterior and interior girder live load moment distribution factors (this tool's 4.6.2.2 equations, longest span) are closest is used (ties: nearest 0.375S); the girder is then sized with Suggest (fast mode) and checked like an alternative. The table lists N, S, overhang, d<sub>e</sub>, the factors, the section, the steel per girder and in total (lb/ft<sup>2</sup> of deck), the governing ratio of the layout checks, the bracing type from the girder depth, and pass/fail. The recommendation is the passing row with the least total steel (or the fewest girders, if chosen). Nothing changes until you press Apply. With W blank, Suggest uses the girder count and spacing on the Bridge tab as before. Distribution factors are an estimate for comparing layouts: run LL &amp; DL for the chosen layout.</p>
 <p><b>Fast study, then full design of the best few.</b> The study sizes every girder count with Suggest's <i>fast mode</i>: one constant-stiffness continuous-beam model, flange areas from lever-arm estimates, and only this tool's layout checks (proportions, transitions, splices, framing), with no strength, service, or fatigue check. That makes it quick enough to try every girder count, but its weights are a ranking aid. The overhang of each row is chosen with the K<sub>g</sub> of a trial girder sized at the overhang nearest 0.375S. When the study finishes, the Suggest tab offers <b>Full design of the best N</b> (N on the Suggest input tab, default 3, at most 5). It takes the best N rows (by the objective: passing rows first, then the others by governing ratio) and runs Full design (see <i>Fast and full design</i> below) on each with that row's girder count, spacing, and overhangs, on a copy of the project: each iteration re-runs the staged analysis of the current plates (DC1 on the steel section; DC2 and DW on the long-term composite section, 3n; live load on the short-term composite section, n; cracked near interior piers), recomputes the 4.6.2.2 distribution factors from that section's K<sub>g</sub>, checks every node, and resizes; the live load model of the first iteration is reused inside the loop, and the final verification recomputes everything, so the pass/fail of each row comes from fully recomputed demands. The girder count, spacing, and overhangs are kept from the fast study. Full design takes about 20 to 60 s for each girder count, which is why it runs only for the best few and only when you press the button (it can be cancelled). The results table lists the full-design section, cross-frame spacing, steel per girder, total and per deck area (with the fast-study value beside it), the largest ratio of the final verification, the interior and exterior moment distribution factors of the final girder (longest span), the iterations, and pass/fail (every full-design check at or below 1.0 and no failing layout check; failing Analysis tab checks A1 to A3 are named beside it but do not decide it, because they depend on the bearing stiffener and bearings, which Suggest does not size); the recommendation follows the same objective. Apply sets the girder count, spacing, overhangs, plates, splices, stiffener setting, and cross-frame spacing (Revert restores the previous design). The result is still preliminary: run LL &amp; DL (lldf) for the chosen layout and complete the design checks in GirderDetail.</p>
 <h3>Suggest: lowest-cost layout</h3><p>Suggest proposes the web and flange layout and the field splices for the bridge on the Bridge tab, with one layout for all girders (designed for the envelope of the interior and exterior girders). It searches web depths from about L/36 to L/18 and, unless one is chosen, both an unstiffened and a transversely stiffened web, and keeps the layout with the <b>lowest total cost</b>: structural steel (weight × $/lb), flange shop transitions, transverse stiffeners, and field splices, each priced from the <b>Unit costs</b> on the Suggest tab, which are the same single price list used by the Alternatives study (and sent to GirderDetail's Design all). The defaults are placeholders; only their ratios affect the choice, and the tab shows each as an equivalent weight of steel. Within each field piece the flange width is constant and the thicknesses are chosen by an optimization that adds a transition only where it saves more than it costs. Field splices are placed by the program near the dead-load points of contraflexure and within the shipping length and weight, and moved off cross-frame locations where the framing check X4 finds a conflict.</p>
-<p><b>Rules.</b> AASHTO LRFD minimums always apply: D/t<sub>w</sub> ≤ 150 unstiffened or 300 stiffened (6.10.2.1), b<sub>f</sub>/2t<sub>f</sub> ≤ 12, b<sub>f</sub> ≥ D/6, t<sub>f</sub> ≥ 1.1t<sub>w</sub>, 0.1 ≤ I<sub>yc</sub>/I<sub>yt</sub> ≤ 10 (6.10.2.2), plates at least 5/16 in (6.7.3), and one steel grade (no hybrid girders). With the AASHTO/NSBA G12.1 fabrication guidelines on (the default), the Limits tab minimum sizes, increments, and transition ratios also apply. The span-to-depth limits of Table 2.5.2.6.3-1 apply by default and can be turned off.</p><p><b>Optimizing the framing.</b> Stiffener spacing and cross-frame spacing are design variables. For stiffened webs, the fast search tries d<sub>o</sub>/D = 1.0, 1.5, 2.0, and 3.0 (shear buckling coefficient k = 5 + 5/(d<sub>o</sub>/D)²): wider panels need fewer stiffeners but a thicker web, and the cost decides. Full design then re-runs its best candidate at cross-frame spacings from 15 ft up to the maximum set on the Suggest tab (default 25 ft) in 2.5 ft steps, with every check (lateral-torsional buckling with the actual spacing and C<sub>b</sub>, deck placement, and the rest), adding the cost of each intermediate cross-frame, and keeps the cheapest. Apply sets the Framing tab spacing and d<sub>o</sub>/D. The deck overhang is not modeled in sizing: GirderDetail's Deck overhang auto-design gives the largest spacing the deck placement allows at the exterior girder, so set the maximum spacing no higher than that.</p><p><b>Flange widths.</b> Every flange at a field splice is made wide enough for the number of bolt gage lines each side of the web set on the Suggest tab (default 2) without staggering, using the same geometry as GirderDetail's splice auto-design: the first line clear of the web splice plate by the plate clearance plus the edge distance and by the tightening clearance C₁, the gage between lines, and the edge distance at the flange tip (about 14 in for 7/8 in bolts and two lines). The top flange is kept at one width along the girder unless turned off (it simplifies the haunch and stay-in-place forms), and the width of either flange changes by no more than the set maximum at a field splice (default 4 in; 0 for no limit). Widths are raised, never reduced, to meet these rules, and the thicknesses are then optimized at those widths.</p>
+<p><b>Rules.</b> AASHTO LRFD minimums always apply: D/t<sub>w</sub> ≤ 150 unstiffened or 300 stiffened (6.10.2.1), b<sub>f</sub>/2t<sub>f</sub> ≤ 12, b<sub>f</sub> ≥ D/6, t<sub>f</sub> ≥ 1.1t<sub>w</sub>, 0.1 ≤ I<sub>yc</sub>/I<sub>yt</sub> ≤ 10 (6.10.2.2), plates at least 5/16 in (6.7.3), and one steel grade (no hybrid girders). With the AASHTO/NSBA G12.1 fabrication guidelines on (the default), the Limits tab minimum sizes, increments, and transition ratios also apply. The span-to-depth limits of Table 2.5.2.6.3-1 apply by default. The Suggest setting can turn them off only when the Limits tab does not treat span-to-depth as mandatory; with "Treat span-to-depth (G1, G2) as mandatory" on, Suggest (fast and full design, the deck-width study, and the web economy comparison) always applies them, so it never proposes a girder that fails G1 or G2. Full design also requires the final plates of each candidate to meet the minimum depths, since resizing can thin the flanges.</p><p><b>Optimizing the framing.</b> Stiffener spacing and cross-frame spacing are design variables. For stiffened webs, the fast search tries d<sub>o</sub>/D = 1.0, 1.5, 2.0, and 3.0 (shear buckling coefficient k = 5 + 5/(d<sub>o</sub>/D)²): wider panels need fewer stiffeners but a thicker web, and the cost decides. Full design then re-runs its best candidate at cross-frame spacings from 15 ft up to the maximum set on the Suggest tab (default 25 ft) in 2.5 ft steps, with every check (lateral-torsional buckling with the actual spacing and C<sub>b</sub>, deck placement, and the rest), adding the cost of each intermediate cross-frame, and keeps the cheapest. Apply sets the Framing tab spacing and d<sub>o</sub>/D. The deck overhang is not modeled in sizing: GirderDetail's Deck overhang auto-design gives the largest spacing the deck placement allows at the exterior girder, so set the maximum spacing no higher than that.</p><p><b>Flange widths.</b> Every flange at a field splice is made wide enough for the number of bolt gage lines each side of the web set on the Suggest tab (default 2) without staggering, using the same geometry as GirderDetail's splice auto-design: the first line clear of the web splice plate by the plate clearance plus the edge distance and by the tightening clearance C₁, the gage between lines, and the edge distance at the flange tip (about 14 in for 7/8 in bolts and two lines). The top flange is kept at one width along the girder unless turned off (it simplifies the haunch and stay-in-place forms), and the width of either flange changes by no more than the set maximum at a field splice (default 4 in; 0 for no limit). Widths are raised, never reduced, to meet these rules, and the thicknesses are then optimized at those widths.</p>
 <p><b>Fast and full design.</b> The suggestion shown updates automatically (fast mode: constant-stiffness analysis and flange areas from lever-arm estimates). <b>Run full design</b> takes the best fast candidates and, for each, repeats: the staged, cracked analysis of the current layout (the Structural analysis settings); the AASHTO checks at every node for the interior and exterior girders, on both sides of every plate boundary (Strength I positive flexure with the plastic moment, compactness, D<sub>p</sub>/D<sub>t</sub>, and 1.3M<sub>y</sub>; Strength I negative flexure by 6.10.8 with flange local buckling, lateral-torsional buckling at the cross-frame spacing with C<sub>b</sub> from the quarter-point moments of each unbraced segment (10th Edition 6.10.8.2.3b: C<sub>b</sub> = 12.5M<sub>max</sub>/(2.5M<sub>max</sub> + 3M<sub>A</sub> + 4M<sub>B</sub> + 3M<sub>C</sub>), with M<sub>max</sub> the largest moment compressing the flange and M<sub>A</sub>, M<sub>B</sub>, M<sub>C</sub> the absolute envelope values at the quarter points (largest compression, or smallest tension where the flange is never in compression), as defined in Appendix D6.6; brace points at the supports and at the cross-frame spacing), and R<sub>b</sub>; where the compression flange changes within the unbraced length, lateral-torsional buckling uses the smallest compression flange in it (conservative; the γ<sub>e</sub> methods of Appendix D6.6 are not implemented); deck-placement lateral-torsional buckling also uses C<sub>b</sub> from the deck-placement moments; Service II flange stresses and web bend-buckling; deck-placement constructibility; flange fatigue, Fatigue I, Category B at the flange-to-web welds (extreme fiber) and Category C′ at the connection plates welded to the flanges at every cross-frame (inner flange face, 6.6.1.3.1), unless turned off or limited to Category B; and optionally L/800 deflection); and resizing, with each flange's required area set from the check ratio so plates are thickened where a check exceeds 1.0 and trimmed where there is spare capacity. When the layout stops changing it is verified against its own recomputed demands, and the cheapest passing candidate is selected. The result lists the governing check and ratio for every plate. Applying it replaces the girder layout (and the stiffener setting); Revert restores the previous design.</p>
 <h3>Analysis model</h3><p>The analysis of the current design uses a variable-stiffness, staged line-girder model: DC1 on the steel section, DC2 and DW on the long-term composite section, and live load on the short-term composite section, with the composite stages cracked near interior supports. Its settings (staged or constant EI, cracked zones, deck reinforcement) are made in GirderDetail's Structural analysis module. Suggest mode searches trial layouts with the faster constant-EI model and then designs the chosen layout with the staged model.</p>
 <h3>Variable spacing and deck edges</h3><p>On the Bridge tab, <b>Girder spacing</b> can be <i>Variable</i>: enter the bay spacings from left to right (one fewer than the number of girders). The framing plan, cross-section, deck width, and GirderDetail's LLDF and DLs module use each bay; the sizing checks and the built-in approximate distribution factors use the average spacing, and the spacing and overhang checks are made bay by bay. <b>Deck edges</b> can be a barrier (width and the Suggest barrier weight) or a <i>curb and railing</i> on each side: curb width and height, railing load point and weight, and the distance from the deck edge to the traffic face, which sets the roadway. When GirderDetail's LLDF and DLs module is in use, its factors and MassDOT dead loads replace the built-in ones (see the Analysis tab).</p>
@@ -2616,6 +2616,7 @@
     <div class="sec-body" id="sec-sgrule">
       ${fld('AASHTO/NSBA G12.1 fabrication guidelines', 'suggest.fab', '', 'sel', { full: true, options: [['on', 'On: Limits tab minimums, increments, and transition ratios'], ['off', 'Off: AASHTO LRFD minimums only']] })}
       ${fld('Span-to-depth limits (Table 2.5.2.6.3-1)', 'suggest.depthRule', '', 'sel', { full: true, options: [['on', 'Apply'], ['off', 'Do not apply (optional criteria)']] })}
+      <p class="note" id="sg-dr-note" hidden>The Limits tab treats span-to-depth as mandatory, so Suggest applies Table 2.5.2.6.3-1 regardless of this setting.</p>
       ${fld('Live load deflection L/800 (full design)', 'suggest.defl', '', 'sel', { full: true, options: [['off', 'Do not apply (optional criterion)'], ['on', 'Apply']] })}
       ${fld('Top flange width', 'suggest.topConst', '', 'sel', { full: true, options: [['on', 'Constant along the girder (deck forming)'], ['off', 'May change at field splices']] })}
       ${fld('Maximum flange width change at a field splice', 'suggest.maxDb', 'in')}<div></div>
@@ -2720,8 +2721,8 @@
       ${s.full ? `<p class="note-p">Fast-mode suggestion for comparison: ${money(s.full.fastCost.total)}; the full design is ${f2(100 * (1 - C.total / s.full.fastCost.total))}% cheaper.</p>` : ''}
       ${!s.full && s.rec.cands ? `<h4 class="sg-h4">Candidates (fast mode, lowest cost first)</h4><div class="tscroll"><table class="tbl"><thead><tr><th class="right">D (in)</th><th>Web</th><th class="right">d<sub>o</sub>/D</th><th class="right">t<sub>w</sub></th><th class="right">Steel (kip)</th><th class="right">Transitions</th><th class="right">Stiffeners</th><th class="right">Cost</th><th>Span-to-depth</th></tr></thead><tbody>${s.rec.cands.slice(0, 10).map(c => `<tr class="${c.best ? 'gov' : ''}"><td class="val">${f0(c.D)}</td><td>${c.wt}</td><td class="val">${c.wt === 'stiffened' ? f2(c.doR) : '—'}</td><td class="val">${frac(c.tw)}</td><td class="val">${f0(c.cost.wTot / 1000)}</td><td class="val">${c.cost.nTr}</td><td class="val">${c.cost.nSt}</td><td class="val">${money(c.cost.total)}</td><td>${c.ok ? 'OK' : 'Too shallow'}</td></tr>`).join('')}</tbody></table></div>` : ''}`);
   if (s.full) { const F = s.full, gt = list => `<div class="tscroll"><table class="tbl"><thead><tr><th class="right">From (ft)</th><th class="right">To (ft)</th><th class="right">Plate (in)</th><th class="right">Ratio</th><th>Governing check</th></tr></thead><tbody>${list.map(g => `<tr><td class="val">${f2(g.x0)}</td><td class="val">${f2(g.x1)}</td><td class="val" style="white-space:nowrap">${frac(g.b)} × ${frac(g.t)}</td><td class="val">${g.ratio ? f3(g.ratio) : '—'}</td><td>${g.gov || 'Minimum size or proportion'}</td></tr>`).join('')}</tbody></table></div>`;
-    h += card('sg-full', 'Full design', F.passed ? 'Every check at or below 1.0' : 'No candidate passed every check', `<p class="note-p">${F.passed ? '' : '<b>Review:</b> the layout shown is the closest candidate. '}Each candidate was iterated with the staged, cracked analysis (Structural analysis settings) until its layout stopped changing, then verified against its own recomputed demands. Every iteration re-runs the analysis on the current plates and recomputes the live load distribution factors (4.6.2.2) from that section's K<sub>g</sub>; the live load stage model of the first iteration is reused inside the loop to save time, and the final verification recomputes everything. Checks at every node for the interior and exterior girders: Strength I positive flexure (6.10.7, plastic moment, compactness, D<sub>p</sub>/D<sub>t</sub>, 1.3M<sub>y</sub> for continuous spans), Strength I negative flexure (6.10.8: flange local buckling, lateral-torsional buckling with L<sub>b</sub> = ${f2(F.check.Lb)} ft and C<sub>b</sub> = 1.0, R<sub>b</sub>; tension flange), Service II flange stresses and web bend-buckling (6.10.4.2.2), deck-placement constructibility (6.10.3.2), and flange fatigue when selected. Plate boundaries are checked on both sides. Where the compression flange changes within an unbraced length, lateral-torsional buckling uses the smallest flange in it over the full length (conservative; the γ<sub>e</sub> methods of App. D6.6 are not applied). Shear is sized by 6.10.9.</p>
-      <div class="tscroll"><table class="tbl"><thead><tr><th class="right">D (in)</th><th>Web</th><th class="right">Cross-frames</th><th class="right">Iterations</th><th class="right">Max. flange ratio</th><th class="right">Web ratio</th><th class="right">Cost</th><th class="right">Fast-mode cost</th><th>Result</th></tr></thead><tbody>${F.cands.map(c => `<tr class="${c.best ? 'gov' : ''}"><td class="val">${f0(c.D)}</td><td>${c.wt}${c.wt === 'stiffened' ? `, d<sub>o</sub> = ${f2(c.doR)}D` : ''}</td><td class="val">${f2(c.spacing)} ft</td><td class="val">${c.iters}</td><td class="val">${f3(c.max)}</td><td class="val">${f3(c.web)}</td><td class="val">${money(c.cost.total)}</td><td class="val">${money(c.fastCost.total)}</td><td>${c.pass ? (c.best ? 'Selected' : 'Passes') : 'Does not pass'}${c.defl ? `; Δ<sub>LL</sub> ${f3(c.defl.d)} / ${f3(c.defl.lim)} in` : ''}</td></tr>`).join('')}</tbody></table></div>
+    h += card('sg-full', 'Full design', F.passed ? 'Every check at or below 1.0' : 'No candidate passed every check', `<p class="note-p">${F.passed ? '' : '<b>Review:</b> the layout shown is the closest candidate. '}Each candidate was iterated with the staged, cracked analysis (Structural analysis settings) until its layout stopped changing, then verified against its own recomputed demands. Every iteration re-runs the analysis on the current plates and recomputes the live load distribution factors (4.6.2.2) from that section's K<sub>g</sub>; the live load stage model of the first iteration is reused inside the loop to save time, and the final verification recomputes everything. Checks at every node for the interior and exterior girders: Strength I positive flexure (6.10.7, plastic moment, compactness, D<sub>p</sub>/D<sub>t</sub>, 1.3M<sub>y</sub> for continuous spans), Strength I negative flexure (6.10.8: flange local buckling, lateral-torsional buckling with L<sub>b</sub> = ${f2(F.check.Lb)} ft and C<sub>b</sub> = 1.0, R<sub>b</sub>; tension flange), Service II flange stresses and web bend-buckling (6.10.4.2.2), deck-placement constructibility (6.10.3.2), and flange fatigue when selected. Plate boundaries are checked on both sides. Where the compression flange changes within an unbraced length, lateral-torsional buckling uses the smallest flange in it over the full length (conservative; the γ<sub>e</sub> methods of App. D6.6 are not applied). Shear is sized by 6.10.9.${(P.suggest.depthRule !== 'off' || P.limits.sdMandatory) ? ' A candidate passes only if its final plates also meet the Table 2.5.2.6.3-1 minimum depths (span-to-depth applies to Suggest).' : ''}</p>
+      <div class="tscroll"><table class="tbl"><thead><tr><th class="right">D (in)</th><th>Web</th><th class="right">Cross-frames</th><th class="right">Iterations</th><th class="right">Max. flange ratio</th><th class="right">Web ratio</th><th class="right">Cost</th><th class="right">Fast-mode cost</th><th>Result</th></tr></thead><tbody>${F.cands.map(c => `<tr class="${c.best ? 'gov' : ''}"><td class="val">${f0(c.D)}</td><td>${c.wt}${c.wt === 'stiffened' ? `, d<sub>o</sub> = ${f2(c.doR)}D` : ''}</td><td class="val">${f2(c.spacing)} ft</td><td class="val">${c.iters}</td><td class="val">${f3(c.max)}</td><td class="val">${f3(c.web)}</td><td class="val">${money(c.cost.total)}</td><td class="val">${money(c.fastCost.total)}</td><td>${c.pass ? (c.best ? 'Selected' : 'Passes') : c.dOK === false ? 'Too shallow (Table 2.5.2.6.3-1)' : 'Does not pass'}${c.defl ? `; Δ<sub>LL</sub> ${f3(c.defl.d)} / ${f3(c.defl.lim)} in` : ''}</td></tr>`).join('')}</tbody></table></div>
       <div class="g2" style="margin-top:10px"><div><h4 class="sg-h4">Top flange: governing checks</h4>${gt(F.topGov)}</div><div><h4 class="sg-h4">Bottom flange: governing checks</h4>${gt(F.botGov)}</div></div>
       <p class="note-p">Web: ${F.check.gWeb ? `${F.check.gWeb}, ratio ${f3(F.check.rWeb)} at ${f2(F.check.xWeb)} ft` : 'no bend-buckling demand'}.${F.check.other.length ? ` Also: ${[...new Set(F.check.other.map(o => o.name))].join('; ')} exceeded at some points.` : ''} ${F.check.fat ? `Flange fatigue: Fatigue I, Category B at the flange-to-web welds (extreme fiber)${P.suggest.fat !== 'B' ? ' and Category C′ at the connection plates welded to the flanges at every cross-frame (inner flange face, 6.6.1.3.1)' : ''} (6.6.1.2), short-term composite section for both signs (minimum reinforcement per 6.10.1.7).` : 'Flange fatigue was not checked (turned off).'} Other fatigue details are checked in the Fatigue module.</p>`); }
 
@@ -4032,6 +4033,7 @@
 let tmr = null;
 function schedule() { clearTimeout(tmr); tmr = setTimeout(recompute, 160); autosave(); }
 function recompute() {
+  const drn = $('#sg-dr-note'); if (drn) drn.hidden = !(P.limits.sdMandatory && P.suggest.depthRule === 'off');   // Suggest span-to-depth setting overridden by the Limits tab (2026-10-12)
   M = buildModel(P);
   if (M.errors.length) { C = null; FR = null; AN = null; renderErrors(); maybeSuggest(); maybeAlts(); return; }
   C = runChecks(M);
```

### G8. PlateLine deck-width study: overhang limits are the stricter of the study's and check G6's   [§4: study rows change where an overhang exceeded the G6 limit] [G6 unchanged; saved values unchanged]
- **Where (PL):**
  - `wsSetup()` (PL ≈ 3456), after the spacing-limit validation and before `const BG = brGeom(...)`. Anchor `// overhang limits: the stricter of this study's and the Limits tab's (check G6)`. Added:
    ```js
    const kG6 = num(P.limits.ohFrac), mG6 = num(P.limits.ohMax); L.ohSWs = L.ohS; L.ohMaxWs = L.ohMax; L.ohSGov = 'ws'; L.ohMaxGov = 'ws';
    if (kG6 > 0 && kG6 < L.ohS) { L.ohS = kG6; L.ohSGov = 'G6'; }
    if (mG6 >= 0 && mG6 < L.ohMax) { L.ohMax = mG6; L.ohMaxGov = 'G6'; }
    if (!errs.length && L.ohMin > L.ohMax) errs.push(`The minimum overhang (${f2(L.ohMin)} ft) exceeds the maximum overhang on the Limits tab (${f2(L.ohMax)} ft, check G6).`);
    ```
    The overhang grid (`ohMin` to `ohMax` in 0.25 ft steps), the feasibility filter (`c.oh <= L.ohS * c.S`), and the "no overhang works" list then use the stricter values. The validation of the study's own inputs is unchanged (it still reads `ws.*` as entered).
  - `wsHtml()` results note (PL ≈ 3523). Before: `Limits: overhang ${f2(st.L.ohMin)} to ${f2(st.L.ohMax)} ft and ≤ ${f2(st.L.ohS)}S, d<sub>e</sub>…`. After: the same, plus "(maximum from the Limits tab, check G6; this study's setting X ft)" after the maximum and "(from the Limits tab, check G6; this study's setting XS)" after the ratio when G6 governs.
  - Suggest input tab note under the study inputs: "…not more than 0.5S (the study uses the stricter of these and the Limits tab overhang limits of check G6, 0.40S and 4.0 ft by default);".
  - Manual, Part 2 "Girder count from the deck width": new sentence after the defaults: "The overhang limits used are the stricter of these settings and the Limits tab overhang limits of check G6 (overhang / S and maximum overhang, 0.40S and 4.0 ft by default), so the study never proposes an overhang that G6 warns about; the results note says which value governs."
- **Problem:** the study used `ws.ohS` (default 0.5) and `ws.ohMax` (4.0 ft) while G6 uses `limits.ohFrac` (0.40) and `limits.ohMax` (4.0 ft), so the study could propose an overhang that G6 then flags (built-in example: N = 11 and 12 had G6 warnings). The study now proposes only overhangs that satisfy G6 (more restrictive).
- **§4 callout:**
  - **Governing provision:** check G6 "Deck overhang", ref. "Owner / practice limit (edit per DOT)": w<sub>oh</sub> ≤ min(k<sub>oh</sub>S, w<sub>oh,max</sub>). Not an AASHTO provision; the limits are owner values (Limits tab). G6 itself is unchanged.
  - **Before:** feasible overhang oh ≤ ws.ohS·S and ohMin ≤ oh ≤ ws.ohMax. **After:** oh ≤ min(ws.ohS, limits.ohFrac)·S and ohMin ≤ oh ≤ min(ws.ohMax, limits.ohMax).
  - **Check case 1 (built-in example, W = 44.5 ft; study defaults, Limits defaults 0.40S / 4.0 ft):** rows N = 4 … 10 identical (N = 4 at 13.00 ft, overhangs 2.75 ft, 24.55 lb/ft² recommended, unchanged). Changed rows:

    | N | before: S, oh (G6 limit = min(0.40S, 4.0)) | before result | after: S, oh | after result |
    |---|---|---|---|---|
    | 11 | 4.100, 1.75 (1.64) | D = 44, 44.03 lb/ft², G6 warning 1.07 | (44.5 − 2·1.50)/10 = 4.150, 1.50 (1.66) | D = 47, 44.75 lb/ft², G6 passes (governing D6 1.04) |
    | 12 | 3.727, 1.75 (1.49) | D = 50, 48.44 lb/ft², G6 warning 1.17 | (44.5 − 3.00)/11 = 3.773, 1.50 (1.509) | D = 50, 48.44 lb/ft², G6 passes |

    Hand check N = 11: an overhang of 1.75 ft gives S = (44.5 − 3.5)/10 = 4.10 ft, 0.40(4.10) = 1.64 < 1.75, so it is now excluded; 1.50 ft (the study minimum) gives S = 4.15, 0.40(4.15) = 1.66 ≥ 1.50. Results note: "Limits: overhang 1.50 to 4.00 ft and ≤ 0.40S (from the Limits tab, check G6; this study's setting 0.50S), …".
  - **Check case 2 (the result changes; same, with Limits "Max. overhang" = 2.5 ft):** before, recommended N = 4 at 13.00 ft with 2.75 ft overhangs, 24.55 lb/ft², G6 warning (2.75 / 2.50 = 1.10). After: N = 4 at (44.5 − 5.0)/3 = 13.17 ft with 2.50 ft overhangs, D = 66, 24.82 lb/ft², G6 = 1.00 (passes). Note: "overhang 1.50 to 2.50 ft (maximum from the Limits tab, check G6; this study's setting 4.00 ft) and ≤ 0.40S (…)".
- **Saved data:** none changed; `ws.ohS`, `ws.ohMax` and their defaults are kept as saved (the stricter value is applied when the study runs). The study key (`wsKey`) already includes `P.limits`, so changing G6 limits marks a finished study stale as before.
- **How verified:** `node --check`; headless Chromium main vs branch, `WS.res` rows and the results note for both cases; screenshot `i2_ws_note.png`; no console errors. Full design of the best rows (G6) picks from these rows, unchanged code.
- **Other copies:** none.
- **Open items:** none.

### Exact changes (G8): decoded PlateLine (unified diff)

```diff
--- PL (after G7)
+++ PL (after G8)
@@ -2354,7 +2354,7 @@
 <div class="alert warn"><b>This app is an engineering aid, not a substitute for engineering judgment.</b> The user is responsible for the design, for verifying every limit in use, and for confirming that the layout satisfies all strength, service, fatigue, and constructibility requirements through analysis.</div>`],
 
 ['p2', 'Using the program', `
-<h3>Girder count from the deck width</h3><p>With an <b>Out-to-out deck width</b> W on the Suggest input tab, <b>Suggest girder count, spacing, and overhangs</b> compares girder counts. For each N from 3, every overhang on a 0.25 ft grid within the limits gives S = (W &minus; 2&middot;overhang)/(N &minus; 1); a layout is kept when S, the overhang (also &le; a fraction of S), and d<sub>e</sub> = overhang &minus; barrier (or curb) width are within the limits (defaults: overhang 1.5 to 4.0 ft and &le; 0.5S; d<sub>e</sub> &minus;1.0 to 5.5 ft; S 3.5 to 16 ft, the ranges of the 4.6.2.2 equations; verify / owner). Of those, the overhang whose exterior and interior girder live load moment distribution factors (this tool's 4.6.2.2 equations, longest span) are closest is used (ties: nearest 0.375S); the girder is then sized with Suggest (fast mode) and checked like an alternative. The table lists N, S, overhang, d<sub>e</sub>, the factors, the section, the steel per girder and in total (lb/ft<sup>2</sup> of deck), the governing ratio of the layout checks, the bracing type from the girder depth, and pass/fail. The recommendation is the passing row with the least total steel (or the fewest girders, if chosen). Nothing changes until you press Apply. With W blank, Suggest uses the girder count and spacing on the Bridge tab as before. Distribution factors are an estimate for comparing layouts: run LL &amp; DL for the chosen layout.</p>
+<h3>Girder count from the deck width</h3><p>With an <b>Out-to-out deck width</b> W on the Suggest input tab, <b>Suggest girder count, spacing, and overhangs</b> compares girder counts. For each N from 3, every overhang on a 0.25 ft grid within the limits gives S = (W &minus; 2&middot;overhang)/(N &minus; 1); a layout is kept when S, the overhang (also &le; a fraction of S), and d<sub>e</sub> = overhang &minus; barrier (or curb) width are within the limits (defaults: overhang 1.5 to 4.0 ft and &le; 0.5S; d<sub>e</sub> &minus;1.0 to 5.5 ft; S 3.5 to 16 ft, the ranges of the 4.6.2.2 equations; verify / owner). The overhang limits used are the stricter of these settings and the Limits tab overhang limits of check G6 (overhang / S and maximum overhang, 0.40S and 4.0 ft by default), so the study never proposes an overhang that G6 warns about; the results note says which value governs. Of those, the overhang whose exterior and interior girder live load moment distribution factors (this tool's 4.6.2.2 equations, longest span) are closest is used (ties: nearest 0.375S); the girder is then sized with Suggest (fast mode) and checked like an alternative. The table lists N, S, overhang, d<sub>e</sub>, the factors, the section, the steel per girder and in total (lb/ft<sup>2</sup> of deck), the governing ratio of the layout checks, the bracing type from the girder depth, and pass/fail. The recommendation is the passing row with the least total steel (or the fewest girders, if chosen). Nothing changes until you press Apply. With W blank, Suggest uses the girder count and spacing on the Bridge tab as before. Distribution factors are an estimate for comparing layouts: run LL &amp; DL for the chosen layout.</p>
 <p><b>Fast study, then full design of the best few.</b> The study sizes every girder count with Suggest's <i>fast mode</i>: one constant-stiffness continuous-beam model, flange areas from lever-arm estimates, and only this tool's layout checks (proportions, transitions, splices, framing), with no strength, service, or fatigue check. That makes it quick enough to try every girder count, but its weights are a ranking aid. The overhang of each row is chosen with the K<sub>g</sub> of a trial girder sized at the overhang nearest 0.375S. When the study finishes, the Suggest tab offers <b>Full design of the best N</b> (N on the Suggest input tab, default 3, at most 5). It takes the best N rows (by the objective: passing rows first, then the others by governing ratio) and runs Full design (see <i>Fast and full design</i> below) on each with that row's girder count, spacing, and overhangs, on a copy of the project: each iteration re-runs the staged analysis of the current plates (DC1 on the steel section; DC2 and DW on the long-term composite section, 3n; live load on the short-term composite section, n; cracked near interior piers), recomputes the 4.6.2.2 distribution factors from that section's K<sub>g</sub>, checks every node, and resizes; the live load model of the first iteration is reused inside the loop, and the final verification recomputes everything, so the pass/fail of each row comes from fully recomputed demands. The girder count, spacing, and overhangs are kept from the fast study. Full design takes about 20 to 60 s for each girder count, which is why it runs only for the best few and only when you press the button (it can be cancelled). The results table lists the full-design section, cross-frame spacing, steel per girder, total and per deck area (with the fast-study value beside it), the largest ratio of the final verification, the interior and exterior moment distribution factors of the final girder (longest span), the iterations, and pass/fail (every full-design check at or below 1.0 and no failing layout check; failing Analysis tab checks A1 to A3 are named beside it but do not decide it, because they depend on the bearing stiffener and bearings, which Suggest does not size); the recommendation follows the same objective. Apply sets the girder count, spacing, overhangs, plates, splices, stiffener setting, and cross-frame spacing (Revert restores the previous design). The result is still preliminary: run LL &amp; DL (lldf) for the chosen layout and complete the design checks in GirderDetail.</p>
 <h3>Suggest: lowest-cost layout</h3><p>Suggest proposes the web and flange layout and the field splices for the bridge on the Bridge tab, with one layout for all girders (designed for the envelope of the interior and exterior girders). It searches web depths from about L/36 to L/18 and, unless one is chosen, both an unstiffened and a transversely stiffened web, and keeps the layout with the <b>lowest total cost</b>: structural steel (weight × $/lb), flange shop transitions, transverse stiffeners, and field splices, each priced from the <b>Unit costs</b> on the Suggest tab, which are the same single price list used by the Alternatives study (and sent to GirderDetail's Design all). The defaults are placeholders; only their ratios affect the choice, and the tab shows each as an equivalent weight of steel. Within each field piece the flange width is constant and the thicknesses are chosen by an optimization that adds a transition only where it saves more than it costs. Field splices are placed by the program near the dead-load points of contraflexure and within the shipping length and weight, and moved off cross-frame locations where the framing check X4 finds a conflict.</p>
 <p><b>Rules.</b> AASHTO LRFD minimums always apply: D/t<sub>w</sub> ≤ 150 unstiffened or 300 stiffened (6.10.2.1), b<sub>f</sub>/2t<sub>f</sub> ≤ 12, b<sub>f</sub> ≥ D/6, t<sub>f</sub> ≥ 1.1t<sub>w</sub>, 0.1 ≤ I<sub>yc</sub>/I<sub>yt</sub> ≤ 10 (6.10.2.2), plates at least 5/16 in (6.7.3), and one steel grade (no hybrid girders). With the AASHTO/NSBA G12.1 fabrication guidelines on (the default), the Limits tab minimum sizes, increments, and transition ratios also apply. The span-to-depth limits of Table 2.5.2.6.3-1 apply by default. The Suggest setting can turn them off only when the Limits tab does not treat span-to-depth as mandatory; with "Treat span-to-depth (G1, G2) as mandatory" on, Suggest (fast and full design, the deck-width study, and the web economy comparison) always applies them, so it never proposes a girder that fails G1 or G2. Full design also requires the final plates of each candidate to meet the minimum depths, since resizing can thin the flanges.</p><p><b>Optimizing the framing.</b> Stiffener spacing and cross-frame spacing are design variables. For stiffened webs, the fast search tries d<sub>o</sub>/D = 1.0, 1.5, 2.0, and 3.0 (shear buckling coefficient k = 5 + 5/(d<sub>o</sub>/D)²): wider panels need fewer stiffeners but a thicker web, and the cost decides. Full design then re-runs its best candidate at cross-frame spacings from 15 ft up to the maximum set on the Suggest tab (default 25 ft) in 2.5 ft steps, with every check (lateral-torsional buckling with the actual spacing and C<sub>b</sub>, deck placement, and the rest), adding the cost of each intermediate cross-frame, and keeps the cheapest. Apply sets the Framing tab spacing and d<sub>o</sub>/D. The deck overhang is not modeled in sizing: GirderDetail's Deck overhang auto-design gives the largest spacing the deck placement allows at the exterior girder, so set the maximum spacing no higher than that.</p><p><b>Flange widths.</b> Every flange at a field splice is made wide enough for the number of bolt gage lines each side of the web set on the Suggest tab (default 2) without staggering, using the same geometry as GirderDetail's splice auto-design: the first line clear of the web splice plate by the plate clearance plus the edge distance and by the tightening clearance C₁, the gage between lines, and the edge distance at the flange tip (about 14 in for 7/8 in bolts and two lines). The top flange is kept at one width along the girder unless turned off (it simplifies the haunch and stay-in-place forms), and the width of either flange changes by no more than the set maximum at a field splice (default 4 in; 0 for no limit). Widths are raised, never reduced, to meet these rules, and the thicknesses are then optimized at those widths.</p>
@@ -2594,7 +2594,7 @@
       ${fld('Overhang / S, maximum', 'ws.ohS', '')}${fld('Objective', 'ws.obj', '', 'sel', { options: [['wt', 'Least total steel weight'], ['nb', 'Fewest girders']] })}
       ${fld('d<sub>e</sub>, minimum (4.6.2.2)', 'ws.deMin', 'ft')}${fld('d<sub>e</sub>, maximum (4.6.2.2)', 'ws.deMax', 'ft')}
       ${fld('Girder spacing S, minimum', 'ws.sMin', 'ft')}${fld('Girder spacing S, maximum', 'ws.sMax', 'ft')}
-      <p class="note full">Limits: verify / owner. Defaults: overhang 1.5 to 4.0 ft and not more than 0.5S; d<sub>e</sub> from −1.0 to 5.5 ft and S from 3.5 to 16.0 ft (the ranges of the AASHTO 4.6.2.2 distribution factor equations). For each girder count from 3 that fits the limits, S = (W − 2·overhang)/(N − 1), the overhang is chosen to balance the exterior and interior live load moment distribution factors, and the girder is sized with Suggest. Nothing on the Bridge or Girder tab changes until you apply a row.</p>
+      <p class="note full">Limits: verify / owner. Defaults: overhang 1.5 to 4.0 ft and not more than 0.5S (the study uses the stricter of these and the Limits tab overhang limits of check G6, 0.40S and 4.0 ft by default); d<sub>e</sub> from −1.0 to 5.5 ft and S from 3.5 to 16.0 ft (the ranges of the AASHTO 4.6.2.2 distribution factor equations). For each girder count from 3 that fits the limits, S = (W − 2·overhang)/(N − 1), the overhang is chosen to balance the exterior and interior live load moment distribution factors, and the girder is sized with Suggest. Nothing on the Bridge or Girder tab changes until you apply a row.</p>
       <p class="note full">This study is quick because it uses Suggest's fast mode only: one constant-stiffness beam model, flange areas from lever-arm estimates, and this tool's layout checks (no strength, service, or fatigue check). When it finishes, the Suggest tab offers <b>Full design of the best N</b>: Full design (staged analysis, AASHTO checks) re-sizes only the leading girder counts, because it takes about a minute for each.</p>
       ${fld('Full design: number of best girder counts', 'ws.nFull', '', 'num', { full: true, note: '(1 to 5; default 3)' })}
       <button type="button" class="proj-btn proj-btn-primary full" id="ws_run">Suggest girder count, spacing, and overhangs</button>
@@ -3455,6 +3455,11 @@
   if (!(L.ohS > 0)) errs.push('The maximum overhang / S must be positive.');
   if (!(isFinite(L.deMin) && L.deMax >= L.deMin)) errs.push('d_e limits: minimum ≤ maximum.');
   if (!(L.sMin > 0 && L.sMax >= L.sMin)) errs.push('Spacing limits: 0 < minimum ≤ maximum.');
+  // overhang limits: the stricter of this study's and the Limits tab's (check G6), so no row gets a G6 overhang warning (2026-10-12)
+  const kG6 = num(P.limits.ohFrac), mG6 = num(P.limits.ohMax); L.ohSWs = L.ohS; L.ohMaxWs = L.ohMax; L.ohSGov = 'ws'; L.ohMaxGov = 'ws';
+  if (kG6 > 0 && kG6 < L.ohS) { L.ohS = kG6; L.ohSGov = 'G6'; }
+  if (mG6 >= 0 && mG6 < L.ohMax) { L.ohMax = mG6; L.ohMaxGov = 'G6'; }
+  if (!errs.length && L.ohMin > L.ohMax) errs.push(`The minimum overhang (${f2(L.ohMin)} ft) exceeds the maximum overhang on the Limits tab (${f2(L.ohMax)} ft, check G6).`);
   const BG = brGeom(P.bridge, num(P.suggest.bar)), bar = BG.bar; if (!(bar >= 0)) errs.push('Complete the barrier or curb inputs on the Bridge tab.');
   if (errs.length) return { errs };
   const ohs = []; for (let o = L.ohMin; o <= L.ohMax + 1e-9; o += 0.25) ohs.push(+o.toFixed(4)); if (Math.abs(ohs[ohs.length - 1] - L.ohMax) > 1e-6) ohs.push(L.ohMax);
@@ -3515,7 +3520,7 @@
     ${stale ? '<div class="alert warn" style="margin:0 0 8px"><b>Inputs changed since this study.</b> Run it again from the Suggest input tab.</div>' : ''}
     ${best ? `<div class="sg-head pass"><div><b>Recommended (${P.ws.obj === 'nb' ? 'fewest girders' : 'least total steel weight'}): ${best.N} girders at ${f2(best.S)} ft, overhangs ${f2(best.oh)} ft</b><span>${f2(best.psf)} lb/ft² of deck, ${f2(best.wt)} kip per girder, web ${frac(best.D)} × ${frac(best.tw)}</span></div><button type="button" class="btn btn-primary" data-wsapply="${WS.res.indexOf(best)}">Apply</button></div>` : '<div class="alert warn" style="margin:0 0 8px"><b>No candidate passes every check.</b> Any row can still be applied.</div>'}
     <div class="tscroll"><table class="tbl alttbl"><thead><tr><th>N</th><th class="right">S (ft)</th><th class="right">Overhang (ft)</th><th class="right">d<sub>e</sub> (ft)</th><th class="right">g<sub>M</sub> int.</th><th class="right">g<sub>M</sub> ext.</th><th>Girder section</th><th class="right">Steel per girder (kip)</th><th class="right">Total (kip)</th><th class="right">lb/ft² of deck</th><th class="right">Governing ratio</th><th>Bracing</th><th>Checks</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
-    <p class="note-p">Distribution factors: this tool's built-in AASHTO 4.6.2.2 equations (longest span, moment, interior: Table 4.6.2.2.2b-1; exterior: lever rule and Table 4.6.2.2.2d-1), an estimate for comparing girder counts; run LL &amp; DL (lldf) for the chosen layout before final design. Overhang: the value within the limits that balances the exterior and interior moment factors, computed with K<sub>g</sub> of a trial girder sized at the overhang nearest 0.375S (ties: nearest 0.375S). Steel weight includes the ${f2(P.limits.allow)}% detail allowance. Governing ratio: the largest ratio among this tool's layout checks (proportions, transitions, splices, framing) for the sized girder; the strength design is by Suggest's approximate method. Bracing: girder depth at Abutment 1 against the ${f2(dmin)} in minimum for cross-frames (Framing tab).${st.skip.length ? ` No overhang within the limits works for N = ${st.skip.join(', ')}.` : ''}${errs.length ? ` Not sized: ${errs.map(r => `N = ${r.N} (${esc(r.err)})`).join('; ')}.` : ''} Limits: overhang ${f2(st.L.ohMin)} to ${f2(st.L.ohMax)} ft and ≤ ${f2(st.L.ohS)}S, d<sub>e</sub> ${f2(st.L.deMin)} to ${f2(st.L.deMax)} ft, S ${f2(st.L.sMin)} to ${f2(st.L.sMax)} ft (verify / owner).</p>
+    <p class="note-p">Distribution factors: this tool's built-in AASHTO 4.6.2.2 equations (longest span, moment, interior: Table 4.6.2.2.2b-1; exterior: lever rule and Table 4.6.2.2.2d-1), an estimate for comparing girder counts; run LL &amp; DL (lldf) for the chosen layout before final design. Overhang: the value within the limits that balances the exterior and interior moment factors, computed with K<sub>g</sub> of a trial girder sized at the overhang nearest 0.375S (ties: nearest 0.375S). Steel weight includes the ${f2(P.limits.allow)}% detail allowance. Governing ratio: the largest ratio among this tool's layout checks (proportions, transitions, splices, framing) for the sized girder; the strength design is by Suggest's approximate method. Bracing: girder depth at Abutment 1 against the ${f2(dmin)} in minimum for cross-frames (Framing tab).${st.skip.length ? ` No overhang within the limits works for N = ${st.skip.join(', ')}.` : ''}${errs.length ? ` Not sized: ${errs.map(r => `N = ${r.N} (${esc(r.err)})`).join('; ')}.` : ''} Limits: overhang ${f2(st.L.ohMin)} to ${f2(st.L.ohMax)} ft${st.L.ohMaxGov === 'G6' ? ` (maximum from the Limits tab, check G6; this study's setting ${f2(st.L.ohMaxWs)} ft)` : ''} and ≤ ${f2(st.L.ohS)}S${st.L.ohSGov === 'G6' ? ` (from the Limits tab, check G6; this study's setting ${f2(st.L.ohSWs)}S)` : ''}, d<sub>e</sub> ${f2(st.L.deMin)} to ${f2(st.L.deMax)} ft, S ${f2(st.L.sMin)} to ${f2(st.L.sMax)} ft (verify / owner).</p>
     <p class="note-p"><b>What this table is.</b> Every row is sized with Suggest's <i>fast mode</i>: one constant-stiffness continuous-beam model, flange areas from lever-arm estimates, and only this tool's layout checks. No strength, service, or fatigue check has been made on these girders, so the weights are a ranking aid. The next card re-sizes the best few with Full design.</p>`) + wsfHtml();
 }
 function wsApply(i) { const r = WS && WS.res[i]; if (!r || r.err) return;
```

### G9. Field splice: warning when splices are "Included" but Preliminary sizing has none   [message only] [no result change]
- **Where (main page):**
  - New helpers after `function spIncl()` (≈ 6890). Anchor `/* "Included" while the last sizing layout received has no field splices`. `spNoPL()` = `P.spl.inc === 'yes' && P.spl.plN === 0`; `spNoPLMsg()` returns the warning text; `spNoPLBox()` the Project-tab alert; `spNoPLMark(srcOnly)` fills the Project-tab slot and, with results, adds a line to the status bar (after the verdict) and an alert at the top of the Summary.
  - `recompute()` splice path (≈ 6577): `spSugBox(); spNoPLMark(true);` (Project-tab slot, also cleared when not applicable) and `…renderReportHead(); spNoPLMark();` after the results are drawn.
  - `srcPanel()` (≈ 5014): `<div id="src_spwarn">${spNoPLBox()}</div>` after the hint under Get demands.
  - `applyInboxTo()` (≈ 5043), splice branch with no splices received. Before: `return 'No field splices in the sizing layout.';` After: `return spNoPL() ? spNoPLMsg() : 'No field splices in the sizing layout.';`
  - Message listener for targeted requests (≈ 6998). Before: `const msg = applyInboxTo(j.target, j); renderInbox(); flash(msg); return;` After: the same, but when the target is the splice module and the message is the warning: `flash(msg, 'fail'); alert(\`Get demands: field splice\n\n${msg}\`);`.
  - `buildCalcReport()` (≈ 6246), Objectives: `<p class="cr-p"><b>Warning:</b> …</p>` after "Source of demands" for the splice module. `renderReportHead()` (print header, ≈ 6755): the same warning after "Demands source".
  - `designAllRun0()` result table (≈ 5268): the Field splices row shows "Warning: … No splice case was designed from this analysis (0 cases designed)." instead of "All checks pass; 0 cases designed" in that state. `P.designAll` (saved) is unchanged.
  - Manual, "Field splices: inclusion and Suggest splice": new sentence "With "Included" while the Preliminary sizing layout has no field splices, the module still checks the splice entered on its tabs, with the section and demands entered by hand or kept from an earlier import, and warns in the status bar, the Summary, the Project tab (next to Get demands), the report, and the Design all table that they are not from the current analysis; Get demands then loads nothing and shows that warning."
- **Text:** "Preliminary sizing does not include a field splice. The section and demands shown come from the Splice module only (entered by hand or kept from an earlier import), not from the current analysis." (status bar, short: "! Preliminary sizing has no field splice: the section and demands are the Splice module's own.")
- **Problem:** with "Field splices" = Included and a sizing layout without field splices, Get demands loaded nothing ("No field splices in the sizing layout." flashed for 3.5 s) and the module kept checking the old section and demands (in the repro, the built-in example's 60 in web) without saying so.
- **§4:** no formula, factor, unit or reference changed; message only.
- **Check case (repro; headless Chromium):** Preliminary sizing 90 ft simple span, N<sub>b</sub> = 10, S = 4 ft, D = 38 in, no field splices; Splice tab "Included"; Get demands (Preliminary sizing). Before: no alert, no warning anywhere; Design all row "All checks pass; 0 cases designed". After: alert with the text above; warning in the status bar, Summary, Project tab, report (Objectives) and Design all row. Every check (id, status, every item ratio) before and after Get demands, `P.spl` (`inc: 'yes'`, `plN: 0`), `P.sec.D` (60), `P.dem`, `P.source`, and `P.designAll.stat`: identical main vs branch. "As in Preliminary sizing" with no splices: status bar, Summary, report, Design all ("Field splices not included") and alerts identical main vs branch (the Project-tab slot is empty).
- **Saved data:** none changed.
- **How verified:** `node --check` on the inline scripts; headless Chromium main vs branch as above; screenshots `i3_before_*.png`, `i3_after_project.png`, `i3_after_summary.png`, `i3_after_designall.png`; no console errors.
- **Other copies:** none.
- **Open items:** the girder report (Girder report button) and the DXF title-block status table were not changed; in this state the girder report has no field splice chapter and the DXF table prints the stored Design all row ("ALL CHECKS PASS").

### Exact changes (G9): main page (unified diff)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index e8a9510..eab4e8d 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -2151,3 +2151,3 @@ const MAN = [
 <p><b>Auto-design splice</b> (Splice tab) finds the most economical splice that passes every strength and detailing check (TF, BF, MT, WS, and DT1 to DT11, including plate area not less than the connected area, stitching, the minimum gage lines, and wrench clearance). If a flange is too narrow for the minimum gage lines without staggering, it reports the width needed and leaves the splice unchanged: for each flange it tries double shear (inner plates, where they fit) and single shear with the minimum number of bolt lines (DT10) up to three each side of the web, the first line placed for edge distance and wrench clearance, takes the fewest bolt rows that pass shear and slip, then the thinnest plates (1/16 in steps from 5/16 in, inner and outer areas balanced) that pass bearing, yield, fracture, block shear, fatigue, and the edge-distance limits, and keeps the layout with the fewest bolts, then the least plate steel. The web splice uses plates as deep as the web less the clearances, the fewest bolt columns, the widest vertical pitch the sealing limit allows, and the thinnest passing plate. Geometry is fitted throughout: outer plates to the narrower flange, inner plates to the clearance from the web plate, bolt gages to the edge distances. <b>Undo auto-design</b> restores the previous layout; <b>Fit geometry only</b> keeps your bolts and thicknesses and only fits widths, gages, and the web plate. When a splice is loaded from an analysis, it is auto-designed for those demands automatically. Verification: the example splice drops from 124 to 96 bolts and the Br. 037201 interior splice from 268 to 152, both passing every check; review the result against your standard details. Plate thicknesses are standard: 1/16 in steps up to 1 in, 1/8 in steps above; the bolt pitch is at least 3d.</p>
-<h3>Field splices: inclusion and Suggest splice</h3><p><b>Field splices</b> (Splice tab) is "As in Preliminary sizing" by default: the splice module is not included when the last sizing layout received has no field splices; "Included" and "Not included" override that. When splices are not included, no splice checks, results, warnings, report, drawings, Design all rows, quantities, or tab status appear; the module shows one line, "Field splices not included", and the stud module gets no splice gaps from Design all. <b>Suggest splice</b> proposes the location and the size. Location: in a continuous unit, at the dead-load (DC1 + DC2 + DW) points of contraflexure next to each interior pier, from the Structural analysis module for an interior girder, rounded to the nearest foot (6.13.6.1.1); in simple spans, the girder ends at the piers; then any field section longer than the <b>Maximum field-section length</b> (default 120 ft, a shipping and erection assumption; verify) is divided into equal lengths (an odd number in a simple span, so no splice falls at midspan), and a splice closer than the <b>Minimum distance from a support</b> (default 10 ft; verify) is moved to that distance. The suggested stations are listed beside the ones in Preliminary sizing; the splice stations themselves are set on its Girder tab (your stations are kept until you change them). Size: Auto-design splice is run with each bolt diameter offered (7/8, 1, and 1-1/8 in; only the Bolts tab diameter when it is locked), and the layout that passes every splice check with the least cost of bolts (installed) plus plate steel (per lb), from the Owner standards, is kept. When demands are imported, the splice is auto-designed with the Bolts tab diameter. Plates or bolt diameter you edit are kept by imports and refreshes until you press Suggest splice or Auto-design splice. The splice checks themselves are unchanged.</p>
+<h3>Field splices: inclusion and Suggest splice</h3><p><b>Field splices</b> (Splice tab) is "As in Preliminary sizing" by default: the splice module is not included when the last sizing layout received has no field splices; "Included" and "Not included" override that. When splices are not included, no splice checks, results, warnings, report, drawings, Design all rows, quantities, or tab status appear; the module shows one line, "Field splices not included", and the stud module gets no splice gaps from Design all. With "Included" while the Preliminary sizing layout has no field splices, the module still checks the splice entered on its tabs, with the section and demands entered by hand or kept from an earlier import, and warns in the status bar, the Summary, the Project tab (next to Get demands), the report, and the Design all table that they are not from the current analysis; Get demands then loads nothing and shows that warning. <b>Suggest splice</b> proposes the location and the size. Location: in a continuous unit, at the dead-load (DC1 + DC2 + DW) points of contraflexure next to each interior pier, from the Structural analysis module for an interior girder, rounded to the nearest foot (6.13.6.1.1); in simple spans, the girder ends at the piers; then any field section longer than the <b>Maximum field-section length</b> (default 120 ft, a shipping and erection assumption; verify) is divided into equal lengths (an odd number in a simple span, so no splice falls at midspan), and a splice closer than the <b>Minimum distance from a support</b> (default 10 ft; verify) is moved to that distance. The suggested stations are listed beside the ones in Preliminary sizing; the splice stations themselves are set on its Girder tab (your stations are kept until you change them). Size: Auto-design splice is run with each bolt diameter offered (7/8, 1, and 1-1/8 in; only the Bolts tab diameter when it is locked), and the layout that passes every splice check with the least cost of bolts (installed) plus plate steel (per lb), from the Owner standards, is kept. When demands are imported, the splice is auto-designed with the Bolts tab diameter. Plates or bolt diameter you edit are kept by imports and refreshes until you press Suggest splice or Auto-design splice. The splice checks themselves are unchanged.</p>
 <ol><li><b>Project tab.</b> Fill in the calculation header. To start from PlateLine, send the splices from PlateLine's Analysis tab (same browser and site), or import PlateLine's splice JSON with Import JSON, then choose a splice under Import from PlateLine.</li>
@@ -5014,3 +5014,3 @@ function srcPanel() {
     <button type="button" class="proj-btn" id="src_reset" style="width:100%;margin-top:6px">Reset overrides</button>
-    <p class="hint static">${s ? `Current demands: ${esc(s.label)}, imported ${new Date(s.ts).toLocaleString()}.` : 'No demands imported yet; the values shown are entered by hand or the example.'} Any imported value can be changed; changed values are outlined and kept on re-import.</p>`;
+    <p class="hint static">${s ? `Current demands: ${esc(s.label)}, imported ${new Date(s.ts).toLocaleString()}.` : 'No demands imported yet; the values shown are entered by hand or the example.'} Any imported value can be changed; changed values are outlined and kept on re-import.</p><div id="src_spwarn">${spNoPLBox()}</div>`;
   const sel = document.getElementById('src_sel'); if (P.ui.srcSel && [...sel.options].some(o => o.value === P.ui.srcSel)) sel.value = P.ui.srcSel;
@@ -5042,3 +5042,3 @@ function applyInboxTo(mod, j) {
   const src = j.srcLabel || 'Preliminary sizing'; let kept = 0, what = '';
-  if (mod === 'splice') { if (Array.isArray(j.splices)) P.spl.plN = j.splices.length; if (!j.splices || !j.splices.length) { fillInputs(); recompute(); autosave(); return 'No field splices in the sizing layout.'; }
+  if (mod === 'splice') { if (Array.isArray(j.splices)) P.spl.plN = j.splices.length; if (!j.splices || !j.splices.length) { fillInputs(); recompute(); autosave(); return spNoPL() ? spNoPLMsg() : 'No field splices in the sizing layout.'; }
     if (!spIncl()) return 'Field splices are set to "Not included" on the Splice tab; nothing was loaded.';
@@ -5267,3 +5267,3 @@ function designAllRun0(j, quiet) {
   daModal(`<h3>Design all: ${esc(j.srcLabel || 'Preliminary sizing')}</h3>
-    <table class="tbl"><thead><tr><th>Module</th><th>Result</th></tr></thead><tbody>${stat.map(s => `<tr><td class="lbl">${s.name}</td><td>${s.off ? 'Field splices not included' : s.fails.length ? `<b class="st-fail">Fails: ${s.fails.join(', ')}</b>` : '<span class="st-pass">All checks pass</span>'}${s.warns.length ? `; warnings ${s.warns.join(', ')}` : ''}${s.note ? `; ${s.note}` : ''}</td></tr>`).join('')}</tbody></table>
+    <table class="tbl"><thead><tr><th>Module</th><th>Result</th></tr></thead><tbody>${stat.map(s => `<tr><td class="lbl">${s.name}</td><td>${s.mm === 'splice' && !s.off && spNoPL() ? `<b style="color:var(--warn)">Warning:</b> ${spNoPLMsg()} No splice case was designed from this analysis${s.note ? ` (${s.note})` : ''}.` : `${s.off ? 'Field splices not included' : s.fails.length ? `<b class="st-fail">Fails: ${s.fails.join(', ')}</b>` : '<span class="st-pass">All checks pass</span>'}${s.warns.length ? `; warnings ${s.warns.join(', ')}` : ''}${s.note ? `; ${s.note}` : ''}`}</td></tr>`).join('')}</tbody></table>
     <h4>Quantities and costs</h4><table class="tbl"><thead><tr><th>Item</th><th class="right">Quantity</th><th class="right">Cost</th></tr></thead><tbody>${cost.map(c => `<tr><td class="lbl">${c.item}</td><td class="val">${c.unit === 'kip' ? f2(c.qn) : f0(c.qn)} ${c.unit}</td><td class="val">${money(c.c)}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td></td><td class="val"><b>${money(total)}</b></td></tr></tbody></table>
@@ -6245,2 +6245,3 @@ function buildCalcReport(o) {
   const src = crSource(); if (src) body += `<p class="cr-p"><b>Source of demands:</b> ${esc(src)}</p>`;
+  if (mod === 'splice' && spNoPL()) body += `<p class="cr-p"><b>Warning:</b> ${spNoPLMsg()}</p>`;
   if (mt.task) body += `<p class="cr-p"><b>Task:</b> ${esc(mt.task)}</p>`;
@@ -6576,3 +6577,3 @@ function recompute() {
   }
-  spSugBox();
+  spSugBox(); spNoPLMark(true);
   if (!spIncl()) { RS = { errors: ['Field splices not included.'], off: true }; CK = null; renderSplOff(); return; }
@@ -6582,3 +6583,3 @@ function recompute() {
   CK = gdChecks(RS);
-  renderStatus(); renderSummary(); renderCombos(); renderChecks(); renderDrawings(); render3D(); renderReportHead();
+  renderStatus(); renderSummary(); renderCombos(); renderChecks(); renderDrawings(); render3D(); renderReportHead(); spNoPLMark();
   applyCollapse(); typeset();
@@ -6754,3 +6755,3 @@ function renderReportHead() {
     <table class="tb"><tr><td><span>Project</span>${esc(mt.name)}</td><td><span>Computed by</span>${esc(mt.compBy)}</td><td><span>Date</span>${esc(mt.compDate)}</td></tr><tr><td><span>Subject</span>${esc(mt.subject)}</td><td><span>Checked by</span>${esc(mt.chkBy)}</td><td><span>Date</span>${esc(mt.chkDate)}</td></tr><tr><td colspan="3"><span>Task</span>${esc(mt.task)}</td></tr></table>
-    <h2 class="rpt-h">Input echo</h2>${P.source ? `<p class="note-p">Demands source: ${esc(P.source)}</p>` : ''}
+    <h2 class="rpt-h">Input echo</h2>${P.source ? `<p class="note-p">Demands source: ${esc(P.source)}</p>` : ''}${spNoPL() ? `<p class="note-p"><b>Warning:</b> ${spNoPLMsg()}</p>` : ''}
     <div class="g2">${kv([['Web depth D', frac(R.D), 'in'], ['Grades: flange / web / plates', `${P.sec.gF} / ${P.sec.gW} / ${P.sec.gP}`], ['Left: t_w, top, bottom', `${frac(R.secL.tw)}; ${frac(R.secL.topB)} × ${frac(R.secL.topT)}; ${frac(R.secL.botB)} × ${frac(R.secL.botT)}`, 'in'], ['Right: t_w, top, bottom', `${frac(R.secR.tw)}${P.sec.same?.web ? ' (= left)' : ''}; ${frac(R.secR.topB)} × ${frac(R.secR.topT)}${P.sec.same?.top ? ' (= left)' : ''}; ${frac(R.secR.botB)} × ${frac(R.secR.botT)}${P.sec.same?.bot ? ' (= left)' : ''}`, 'in'],
@@ -6888,2 +6889,11 @@ function spUndoBtn() { const b = document.getElementById('sp_undo'); if (b) b.hi
 function spIncl() { const s = (P && P.spl) || {}; return s.inc === 'no' ? false : s.inc === 'yes' ? true : s.plN !== 0; }
+/* "Included" while the last sizing layout received has no field splices: the module keeps its own section and demands (warning only, 2026-10-12) */
+function spNoPL() { const s = (P && P.spl) || {}; return s.inc === 'yes' && s.plN === 0; }
+function spNoPLMsg() { return 'Preliminary sizing does not include a field splice. The section and demands shown come from the Splice module only (entered by hand or kept from an earlier import), not from the current analysis.'; }
+function spNoPLBox() { return P.mod === 'splice' && spNoPL() ? `<div class="alert warn" style="margin:8px 0 0">${spNoPLMsg()}</div>` : ''; }
+function spNoPLMark(srcOnly) {   // Project tab (next to Get demands); with the results: status bar and Summary
+  const w = document.getElementById('src_spwarn'); if (w) w.innerHTML = spNoPLBox();
+  if (srcOnly || P.mod !== 'splice' || !spNoPL() || !CK) return;
+  $('#status-bar .verdict')?.insertAdjacentHTML('afterend', `<div class="sb-msg" style="white-space:normal;max-width:380px;color:var(--warn);font-weight:600" title="${spNoPLMsg()}">! Preliminary sizing has no field splice: the section and demands are the Splice module's own.</div>`);
+  $('#tab-summary')?.insertAdjacentHTML('afterbegin', `<div class="alert warn" style="margin:0 0 12px"><b>No field splice in Preliminary sizing.</b> ${spNoPLMsg()} Field splices are set to "Included" on the Splice tab.</div>`); }
 /* standard plate thicknesses: 1/16 in steps up to 1 in, 1/8 in steps above */
@@ -6988,3 +6998,3 @@ window.addEventListener('message', e => {
   if (j.target === 'refresh') { try { designAllRun(j, true); refreshMarks(); flash('All modules updated for the changed bridge.'); } catch (err) { console.error(err); } return; }
-  if (j.target && j.target !== 'pl') { const msg = applyInboxTo(j.target, j); renderInbox(); flash(msg); return; }
+  if (j.target && j.target !== 'pl') { const msg = applyInboxTo(j.target, j); renderInbox(); if (j.target === 'splice' && msg === spNoPLMsg()) { flash(msg, 'fail'); alert(`Get demands: field splice\n\n${msg}`); } else flash(msg); return; }
   if (!confirm(`Load the sizing results from "${j.project}" into every detail module? This replaces the demands and locations in each module (your plate, bolt, and weld choices where a module keeps them).`)) { flash('Not loaded. Each module\'s Project tab still offers the results under Import from PlateLine.'); return; }
```

### G10. Auto-design splice: when no layout passes, the message names the cause and what can fix it   [message only] [search, checks and fallback unchanged]
- **Where (main page):** `autoDesignSplice()` (≈ 6876), before `if (narrow.length)`. Anchor `// why no layout passed (message only; the search, the checks and the fallback are unchanged)`. New closure `diag(webOnly)`; the two failure returns append its text:
  - Before: `if (!W || !T || !B || fails.length) { const f = fitSplice(); return { ok: f.ok, msg: \`No layout within the search passed every check…; the plates and bolts were fitted and increased instead. ${f.msg}\`, fails: f.fails }; }`
  - After: `… { const f = fitSplice(), why = f.ok ? '' : diag(false); return { ok: f.ok, msg: \`… ${f.msg}${why}\`, fails: f.fails }; }`
  - The "flange too narrow" return: when the web search also found nothing (`!W`), `diag(true)` (web part only) is computed before the undo and appended as "Also, no web splice layout passed: …". Otherwise that message is unchanged.
  - Manual, Auto-design splice paragraph: new sentence "When no layout passes, the plates and bolts are fitted and increased instead and the message says why: …".
- **What `diag` reports** (all values from this module's own `gdCompute`/`gdChecks`; nothing new is calculated by hand):
  - Web bolt strength failure (WS1/WS2): the Strength I combination with the largest critical-bolt ratio; V<sub>r</sub> (10th Ed.) or V<sub>uw</sub> (8th), M<sub>t</sub>, H<sub>w</sub>; for the 10th Ed. with M<sub>u</sub> > M<sub>r</sub>, MT1's M<sub>u</sub> and M<sub>r</sub>. The largest web bolt group that fits: web plate h = D − 2(clearance), rounded down to 1/2 in (as the search), rows = 1 + ⌊(h − 2e<sub>min</sub>)/s<sub>v,min</sub>⌋ at the smallest pitch the search uses (3 in, or the first of 3, 3.5 … 6 in that is ≥ 3d), × 4 columns. H<sub>w</sub>/n against φR<sub>n</sub>; when that alone exceeds φR<sub>n</sub>: "no web bolt group of this bolt size can work". Otherwise the critical-bolt force R<sub>u</sub> of that group (computed by `gdCompute` on a temporary copy of the web inputs with 1 in plates; `P.web` is restored to the same object) and whether that group still fails WS1–WS3, with the bearing resistance per bolt (girder web, splice plates) when WS2 fails.
  - Web bolt slip failure (WS3): the Service II / deck-casting combination with the largest R<sub>s</sub>; V, M<sub>t</sub>, H; H/n and R<sub>s</sub> of the largest group against the slip resistance per bolt.
  - Flange bolt failure (TF1–3 / BF1–3): bolts needed ≈ n × (largest ratio), rows with the current lines (and with 3 lines where they fit the flange), against the 16 rows the search tries; notes single shear when there are no inner plates.
  - "To fix it:" a lower-moment splice location (Suggest splice), larger bolts (Suggest splice compares 7/8, 1 and 1-1/8 in), inner plates or a wider flange (flange failures), a deeper or heavier girder in Preliminary sizing (web failures).
- **§4:** no formula, factor, unit or reference changed; the search, the checks, `fitSplice` and the returned layout are unchanged. The longer message also reaches the places that already show the auto-design message (the alert, the demands-source note written on import when auto-design fails, the Suggest splice note).
- **Check case (headless Chromium):** Preliminary sizing 90 ft simple span, N<sub>b</sub> = 10, S = 4 ft, girder D = 30 in, top 16 × 3/4, bottom 18 × 1 1/4, field splice at 45 ft; Get demands; then the splice moments ×2.0 (M<sub>DC1</sub> 1316.6, M<sub>DC2</sub> 329.6, M<sub>DW</sub> 189.8, M<sub>LL+</sub> 1810.6, M<sub>CLL</sub> 162 kip-ft); Auto-design splice. Layout and failing checks (WS1, WS2, WS3) identical main vs branch. Message after "Still failing: WS1, WS2, WS3; adjust these by hand." (branch):
  > Why: Web bolts, strength (StrP): V_r = 435.00 kip, M_t = 2827.50 kip-in, H_w = 1267.90 kip (MT1: M_u = 5511.00 kip-ft exceeds the flange splices' M_r = 3212.94 kip-ft). The largest web bolt group that fits the 27 in web plate is 9 rows × 4 columns = 36 bolts per side (3 in pitch): H_w alone gives 35.22 kip per bolt against φR_n = 64.65 kip; with V and M_t the critical bolt carries R_u = 51.36 kip (ratio 0.79); with a 1 in web plate that group still fails WS2 (bearing resistance per bolt: girder web 43.05 kip, splice plates 138.60 kip). Web bolts, slip (SvP): V = 32.89 kip, M_t = 0.00 kip-in, H = 1239.33 kip. With 36 bolts per side, H alone gives 34.43 kip per bolt against the slip resistance 39.00 kip; with V and M_t, R_s = 34.44 kip, so that group would not slip.
  >
  > To fix it: move the splice to a lower-moment location (…), use larger bolts (…), or use a deeper or heavier girder in Preliminary sizing (…).

  Hand check: H<sub>w</sub>/n = 1267.90/36 = 35.22 kip; rows = 1 + ⌊(27 − 2(1.125))/3⌋ = 1 + 8 = 9. Moments ×3.2: "H_w alone gives 85.90 kip per bolt against φR_n = 64.65 kip, so no web bolt group of this bolt size can work" (3092.34/36 = 85.90). Flange case (top flange 16 × 3, inner plates locked off, moments ×1): "Top flange bolts (TF1): 56 bolts per side carry 1.41 times their resistance, so about 80 are needed: 20 rows with 2 lines each side of the web, against at most 16 rows in the search, so this flange splice cannot work with this bolt size and flange width; the splice has no inner plates (single shear)." Passing cases (moments ×1) and the narrow-flange case without a web failure: message and layout identical main vs branch.
- **Saved data:** none changed (the message text can appear in `P.source` / `P.spl.sug` as before).
- **How verified:** `node --check`; headless Chromium main vs branch for the cases above (layouts and checks identical; only the message differs where intended); no console errors.
- **Other copies:** none.
- **Open items:** the fallback layout keeps the last vertical pitch the search tried (6 in, 5 rows in the case above) while the largest group is 9 rows at 3 in; raised here, not changed (search behavior).

### Exact changes (G10): main page (unified diff)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index eab4e8d..2ab3ba4 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -2150,3 +2150,3 @@ const MAN = [
 <h3>Splices from Preliminary sizing</h3><p><b>Sealing, stitching, gage lines, and wrench clearance.</b> DT2 limits the pitch along free edges for sealing, s ≤ 4.0 + 4.0t ≤ 7.0 in (6.13.2.6.2), with t the thinner outside plate: on a flange with inner plates, the thinner of the outer and inner plates. DT3 applies the maximum edge distance 8t ≤ 5.0 in to the splice plates. DT9 applies the stitch-bolt limits of 6.13.2.6.3 to the splice plates, taken to act in compression (the flange splices are designed for P<sub>fy</sub> in tension and compression, and the web plates carry the compressive part of the flange force transferred to the web): pitch s ≤ 12.0t along the force, gage g ≤ 24.0t between lines, including across the web on the outer plate; the end-pitch rule for compression members (6.13.2.6.4) is for built-up members and is not applied. A setting on the Bolts tab makes DT9 advisory instead of required. DT10 is the owner or office minimum number of bolt lines each side of the web (default 2; AASHTO itself requires only two rows along the force, DT6). Staggered holes are not used. DT11 checks the clearance needed to tighten the nuts: flange bolts to the face of the web splice plate, and the web bolts nearest the flanges to the face of the flange splice plates, against C₁ (defaults 1.25, 1.50, 1.625, 1.75 in for 3/4, 7/8, 1, 1-1/8 in bolts; confirm with the AISC Manual Table 7-16 and the fabricator).</p>
-<p><b>Auto-design splice</b> (Splice tab) finds the most economical splice that passes every strength and detailing check (TF, BF, MT, WS, and DT1 to DT11, including plate area not less than the connected area, stitching, the minimum gage lines, and wrench clearance). If a flange is too narrow for the minimum gage lines without staggering, it reports the width needed and leaves the splice unchanged: for each flange it tries double shear (inner plates, where they fit) and single shear with the minimum number of bolt lines (DT10) up to three each side of the web, the first line placed for edge distance and wrench clearance, takes the fewest bolt rows that pass shear and slip, then the thinnest plates (1/16 in steps from 5/16 in, inner and outer areas balanced) that pass bearing, yield, fracture, block shear, fatigue, and the edge-distance limits, and keeps the layout with the fewest bolts, then the least plate steel. The web splice uses plates as deep as the web less the clearances, the fewest bolt columns, the widest vertical pitch the sealing limit allows, and the thinnest passing plate. Geometry is fitted throughout: outer plates to the narrower flange, inner plates to the clearance from the web plate, bolt gages to the edge distances. <b>Undo auto-design</b> restores the previous layout; <b>Fit geometry only</b> keeps your bolts and thicknesses and only fits widths, gages, and the web plate. When a splice is loaded from an analysis, it is auto-designed for those demands automatically. Verification: the example splice drops from 124 to 96 bolts and the Br. 037201 interior splice from 268 to 152, both passing every check; review the result against your standard details. Plate thicknesses are standard: 1/16 in steps up to 1 in, 1/8 in steps above; the bolt pitch is at least 3d.</p>
+<p><b>Auto-design splice</b> (Splice tab) finds the most economical splice that passes every strength and detailing check (TF, BF, MT, WS, and DT1 to DT11, including plate area not less than the connected area, stitching, the minimum gage lines, and wrench clearance). If a flange is too narrow for the minimum gage lines without staggering, it reports the width needed and leaves the splice unchanged: for each flange it tries double shear (inner plates, where they fit) and single shear with the minimum number of bolt lines (DT10) up to three each side of the web, the first line placed for edge distance and wrench clearance, takes the fewest bolt rows that pass shear and slip, then the thinnest plates (1/16 in steps from 5/16 in, inner and outer areas balanced) that pass bearing, yield, fracture, block shear, fatigue, and the edge-distance limits, and keeps the layout with the fewest bolts, then the least plate steel. The web splice uses plates as deep as the web less the clearances, the fewest bolt columns, the widest vertical pitch the sealing limit allows, and the thinnest passing plate. Geometry is fitted throughout: outer plates to the narrower flange, inner plates to the clearance from the web plate, bolt gages to the edge distances. When no layout passes, the plates and bolts are fitted and increased instead and the message says why: for failing web bolts, the governing demands (V<sub>r</sub>, M<sub>t</sub>, and H<sub>w</sub> from MT1), the force per bolt from H<sub>w</sub> alone and the critical-bolt force for the largest web bolt group that fits the web plate (all rows at the smallest pitch × 4 columns), against the bolt resistance; for failing flange bolts, the rows needed against the 16 rows searched; then what can fix it (a lower-moment splice location, larger bolts, inner plates or a wider flange, a deeper or heavier girder). <b>Undo auto-design</b> restores the previous layout; <b>Fit geometry only</b> keeps your bolts and thicknesses and only fits widths, gages, and the web plate. When a splice is loaded from an analysis, it is auto-designed for those demands automatically. Verification: the example splice drops from 124 to 96 bolts and the Br. 037201 interior splice from 268 to 152, both passing every check; review the result against your standard details. Plate thicknesses are standard: 1/16 in steps up to 1 in, 1/8 in steps above; the bolt pitch is at least 3d.</p>
 <h3>Field splices: inclusion and Suggest splice</h3><p><b>Field splices</b> (Splice tab) is "As in Preliminary sizing" by default: the splice module is not included when the last sizing layout received has no field splices; "Included" and "Not included" override that. When splices are not included, no splice checks, results, warnings, report, drawings, Design all rows, quantities, or tab status appear; the module shows one line, "Field splices not included", and the stud module gets no splice gaps from Design all. With "Included" while the Preliminary sizing layout has no field splices, the module still checks the splice entered on its tabs, with the section and demands entered by hand or kept from an earlier import, and warns in the status bar, the Summary, the Project tab (next to Get demands), the report, and the Design all table that they are not from the current analysis; Get demands then loads nothing and shows that warning. <b>Suggest splice</b> proposes the location and the size. Location: in a continuous unit, at the dead-load (DC1 + DC2 + DW) points of contraflexure next to each interior pier, from the Structural analysis module for an interior girder, rounded to the nearest foot (6.13.6.1.1); in simple spans, the girder ends at the piers; then any field section longer than the <b>Maximum field-section length</b> (default 120 ft, a shipping and erection assumption; verify) is divided into equal lengths (an odd number in a simple span, so no splice falls at midspan), and a splice closer than the <b>Minimum distance from a support</b> (default 10 ft; verify) is moved to that distance. The suggested stations are listed beside the ones in Preliminary sizing; the splice stations themselves are set on its Girder tab (your stations are kept until you change them). Size: Auto-design splice is run with each bolt diameter offered (7/8, 1, and 1-1/8 in; only the Bolts tab diameter when it is locked), and the layout that passes every splice check with the least cost of bolts (installed) plus plate steel (per lb), from the Owner standards, is kept. When demands are imported, the splice is auto-designed with the Bolts tab diameter. Plates or bolt diameter you edit are kept by imports and refreshes until you press Suggest splice or Auto-design splice. The splice checks themselves are unchanged.</p>
@@ -6874,4 +6874,27 @@ function autoDesignSplice() {
   const narrow = ['top', 'bot'].filter((k, i) => ![T, B][i]).map(k => { const bmin = Math.min(R0.secL[k + 'B'], R0.secR[k + 'B']), nb = needB(parseDim(P.web.t), false); return bmin < nb ? `${k === 'top' ? 'top' : 'bottom'} flange is ${frac(bmin)} in wide; ${nMin} gage lines each side of the web without staggering need at least ${frac(nb)} in` : null; }).filter(Boolean);
-  if (narrow.length) { Object.assign(P, JSON.parse(JSON.stringify(P._spUndo))); return { ok: false, msg: `The ${narrow.join('; the ')}. Widen the flange at this splice (Preliminary sizing's Suggest sizes flanges at field splices for this), or lower the minimum number of gage lines on the Bolts tab. The splice was not changed.`, fails: ['DT10'] }; }
-  if (!W || !T || !B || fails.length) { const f = fitSplice(); return { ok: f.ok, msg: `No layout within the search passed every check${!W ? ' (web)' : !T ? ' (top flange)' : !B ? ' (bottom flange)' : ''}; the plates and bolts were fitted and increased instead. ${f.msg}`, fails: f.fails }; }
+  // why no layout passed (message only; the search, the checks and the fallback are unchanged): governing demands, the largest web bolt group that fits, flange rows needed
+  const diag = webOnly => { const r = run(); if (!r) return ''; const { R, C } = r, X10 = R.code === '10', st = id => (C.find(q => q.id === id) || {}).status, out = []; let wbF = false, flF = false;
+    const wf = ['WS1', 'WS2', 'WS3'].filter(id => st(id) === 'fail');
+    if (wf.length) {
+      const hw = q2(R0.D - 2 * cv), svMin = [3, 3.5, 4, 4.5, 5, 5.5, 6].find(v => v >= 3 * d - 1e-9) || 6, nrMax = Math.max(2, 1 + Math.floor((hw - 2 * em) / svMin + 1e-9)), nMax = nrMax * 4;
+      const w0 = P.web; P.web = { ...w0, h: hw, nr: nrMax, nc: 4, sv: svMin, sh: Math.max(3, u4(3 * d)), t: 1.0 }; let rM = null; try { rM = run(); } finally { P.web = w0; }   // largest group (1 in plates), this module's own calculation; then the same web object is restored
+      const wsF = x => { const f = ['WS1', 'WS2', 'WS3'].filter(id => (x.C.find(q => q.id === id) || {}).status === 'fail'); return f.length ? `still fails ${f.join(', ')}${f.includes('WS2') ? ` (bearing resistance per bolt: girder web ${f2(x.R.web.brgW)} kip, splice plates ${f2(x.R.web.brgP)} kip)` : ''}` : 'passes WS1 to WS3'; };
+      const strs = R.combos.filter(k => k.type === 'str'), svs = R.combos.filter(k => k.type !== 'str'), RM = rM && rM.R, byId = (list, id) => (list || []).find(k => k.id === id);
+      wbF = true;
+      if (strs.length && wf.some(id => id !== 'WS3')) {
+        const cb = strs.reduce((a, k) => k.wb.R / R.web.phRw > a.wb.R / R.web.phRw ? k : a), m = cb.m10, H = Math.abs(cb.Huw || 0), cM = RM && byId(RM.combos, cb.id), ph = RM ? RM.web.phRw : R.web.phRw, per = H / nMax;
+        out.push(`Web bolts, strength (${cb.id}): ${X10 ? 'V_r' : 'V_uw'} = ${f2(cb.Vuw)} kip, M_t = ${f2(cb.wb.Mt)} kip-in, H_w = ${f2(H)} kip${X10 && m && m.ex > 0 ? ` (MT1: M_u = ${f2(m.Mu / 12)} kip-ft exceeds the flange splices' M_r = ${f2(m.Mr / 12)} kip-ft)` : ''}. The largest web bolt group that fits the ${frac(hw)} in web plate is ${nrMax} rows × 4 columns = ${nMax} bolts per side (${frac(svMin)} in pitch): H_w alone gives ${f2(per)} kip per bolt against φR_n = ${f2(ph)} kip`
+          + (per > ph + 1e-9 ? ', so no web bolt group of this bolt size can work, even before the shear and M_t are added.' : cM ? `; with V and M_t the critical bolt carries R_u = ${f2(cM.wb.R)} kip${cM.wb.R > ph + 1e-9 ? ', so even this group does not work.' : ` (ratio ${f2(cM.wb.R / ph)}); with a 1 in web plate that group ${wsF(rM)}.`}` : '.')); }
+      if (svs.length && wf.includes('WS3')) {
+        const cb = svs.reduce((a, k) => k.wb.R > a.wb.R ? k : a), H = Math.abs(cb.Hw || 0), cM = RM && byId(RM.combos, cb.id), sl = R.web.slipW, per = H / nMax;
+        out.push(`Web bolts, slip (${cb.id}): V = ${f2(cb.Vw)} kip, M_t = ${f2(cb.wb.Mt)} kip-in, H = ${f2(H)} kip. With ${nMax} bolts per side, H alone gives ${f2(per)} kip per bolt against the slip resistance ${f2(sl)} kip` + (per > sl + 1e-9 ? ', so no web bolt group of this bolt size can work.' : cM ? `; with V and M_t, R_s = ${f2(cM.wb.R)} kip${cM.wb.R > sl + 1e-9 ? ', so even this group does not work.' : ', so that group would not slip.'}` : '.')); } }
+    if (!webOnly) ['top', 'bot'].forEach(k => { const pre = k === 'top' ? 'TF' : 'BF', ids = [pre + '1', pre + '2', pre + '3'].filter(id => st(id) === 'fail'); if (!ids.length) return;
+      const F = R.fl[k], rmax = Math.max(...ids.flatMap(id => (C.find(q => q.id === id) || { items: [] }).items.map(i => i.r || 0))), nReq = Math.ceil(F.n * rmax - 1e-9), rows = Math.ceil(nReq / (2 * F.nl)), fit3 = F.nl < 3 && F.g0 + 2 * g <= F.bmin / 2 - em + 1e-9, rows3 = Math.ceil(nReq / 6), best = fit3 ? Math.min(rows, rows3) : rows; flF = true;
+      out.push(`${k === 'top' ? 'Top' : 'Bottom'} flange bolts (${ids.join(', ')}): ${F.n} bolts per side carry ${f2(rmax)} times their resistance, so about ${nReq} are needed: ${rows} rows with ${F.nl} line${F.nl > 1 ? 's' : ''} each side of the web${fit3 ? ` (${rows3} rows with 3 lines)` : ''}, against at most 16 rows in the search${best > 16 ? ', so this flange splice cannot work with this bolt size and flange width' : ''}${F.inner ? '' : '; the splice has no inner plates (single shear)'}.`); });
+    if (!out.length) return '';
+    const fix = [...(wbF ? ['move the splice to a lower-moment location (Suggest splice on this tab proposes one)'] : []), 'use larger bolts (Suggest splice compares 7/8, 1, and 1-1/8 in)',
+      ...(flF ? ['use inner splice plates (double shear) or a wider flange at the splice so more gage lines fit'] : []), ...(wbF ? ["use a deeper or heavier girder in Preliminary sizing (larger flanges raise the flange splices' moment resistance and reduce H_w; a thicker girder web raises the web bearing resistance)"] : [])];
+    return `\n\nWhy: ${out.join(' ')}\n\nTo fix it: ${fix.slice(0, -1).join(', ')}${fix.length > 1 ? ', or ' : ''}${fix[fix.length - 1]}.`; };
+  if (narrow.length) { const why = !W ? diag(true) : ''; Object.assign(P, JSON.parse(JSON.stringify(P._spUndo))); return { ok: false, msg: `The ${narrow.join('; the ')}. Widen the flange at this splice (Preliminary sizing's Suggest sizes flanges at field splices for this), or lower the minimum number of gage lines on the Bolts tab. The splice was not changed.${why ? `${why.replace('\n\nWhy: ', '\n\nAlso, no web splice layout passed: ')}` : ''}`, fails: ['DT10'] }; }
+  if (!W || !T || !B || fails.length) { const f = fitSplice(), why = f.ok ? '' : diag(false); return { ok: f.ok, msg: `No layout within the search passed every check${!W ? ' (web)' : !T ? ' (top flange)' : !B ? ' (bottom flange)' : ''}; the plates and bolts were fitted and increased instead. ${f.msg}${why}`, fails: f.fails }; }
   const fs = (F, x) => `${x.inner ? 'double shear' : 'single shear'}, ${F.nl} line${F.nl > 1 ? 's' : ''} each side × ${F.nr} rows = ${x.bolts} bolts; outer PL ${frac(F.bo)} × ${frac(F.to)}${F.inner ? `, 2 inner PL ${frac(F.bi)} × ${frac(F.ti)}` : ''}`;
```

## 2026-10-12 — PR: claude/girderdetail-cf-diaphragm (engineer's decisions; PR link added after merge)

Engineer's decisions (2026-10-12): when the girder is too shallow for a cross-frame, a channel (or rolled W) diaphragm is designed and used; diaphragm depth at least 0.75 of the girder depth for plate girders (AASHTO LRFD 6.7.4.2); the 48 in minimum girder depth for cross-frames stays. Defaults chosen by the engineer for the open details (assumptions to verify, stated in the UI and the check note): channel/W web bolted to the connection plate with one vertical row of bolts, bolt count and pitch by auto-design; diaphragm centered on the girder depth (no position input added); end (bearing-line) diaphragms unchanged and out of scope. Basis: AASHTO LRFD 10th Ed. (2024). Cross-frames module (`GM.cf`) on the main page only; the PlateLine string `PL_B64` is not touched. Line numbers ≈ branch.

### CF-D1. Diaphragm depth rule by girder type: 0.75 of the girder depth for both channels and W shapes; CF10 recommendation on the same rule   [§4: CFD depth requirement and CF10 recommendation change] [status of the depth item stays a warning]
- **Where:**
  - `cfDiaChecks(R, out)` (≈ 2662–2690), the depth item. Anchor `it('Depth (6.7.4.2: at least 0.75 of the plate girder depth d)'`.
    Before (two lines):
    ```js
    if (chS) { const dgT = nm(p.dg); if (dgT > 0) it('Depth (at least about half the girder depth; 6.7.4.2: 0.5 of a rolled beam depth)', `${f2(d)} in`, `${f2(0.5 * dgT)} in`, d >= 0.5 * dgT - 1e-6 ? 'pass' : 'warn', 0.5 * dgT / d); }
    else if (Dg) it('Depth (6.7.4.2: at least 0.75 of the plate girder depth)', `${f2(d)} in`, `${f2(0.75 * Dg)} in`, d >= 0.75 * Dg - 1e-6 ? 'pass' : 'warn', 0.75 * Dg / d);
    ```
    (`Dg = SB ? SB.Dg : null`, the web depth D of the stability-bracing inputs `cf.sb.D`; no depth item when the stability bracing check was off.)
    After (one line; `dgT = nm(p.dg)`, the "Girder depth d" input, declared with the section properties):
    ```js
    if (dgT > 0) it('Depth (6.7.4.2: at least 0.75 of the plate girder depth d)', `${f2(d)} in`, `${f2(0.75 * dgT)} in`, d >= 0.75 * dgT - 1e-6 ? 'pass' : 'warn', 0.75 * dgT / d);
    ```
  - `cfTypeRec(p)` (≈ 2885). Anchor `const ch = CF_CH.filter(s => s[1] >=`. Before `s[1] >= 0.5 * dg - 1e-9` (channels) and `CF_DIA.find(s => s[1] >= 0.5 * dg - 1e-9)` (W); after `0.75 * dg` in both. Header comment updated.
  - CF10 (`GM.cf.checks`, ≈ 2876): `sym` gets `,\ d_{dia} \ge 0.75d`; the note "a channel (depth about half the girder depth or more) or a rolled W diaphragm is used; the selected type is never changed automatically. The rolled or channel diaphragm is checked on the Members tab (Rolled or channel diaphragm alternative)." becomes "a channel or a rolled W diaphragm at least 0.75 of the girder depth (6.7.4.2, plate girders) is used: the lightest channel, else the lightest W. Auto-design selects the diaphragm below the minimum, designs it, and switches back to the cross-frame at or above it, unless the "Intermediate bracing used" input is locked. The diaphragm is checked as CFD (Members tab, Diaphragm section)." CF10's status logic is unchanged.
- **Problem:** channels were compared with half the girder depth (the rolled-beam value) and W shapes with 0.75 of the *web* depth D from the stability-bracing inputs (and not at all with that check off). This tool's girders are plate girders (no rolled-beam option exists in GirderDetail or the cross-frame inputs), so the plate-girder value applies to every diaphragm. More conservative (a deeper diaphragm is required/recommended).
- **§4 callout:**
  - **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 6.7.4.2 (I-section members): diaphragms or cross-frames for rolled beams should be at least 0.5 of the beam depth, and for plate girders at least 0.75 of the girder depth (the tool cites "6.7.4.2"; the wording "should" is why the item stays a warning; verify the wording against the edition in use).
  - **Before:** channel: d<sub>dia</sub> ≥ 0.5 d (girder depth); W: d<sub>dia</sub> ≥ 0.75 D (web depth, `cf.sb.D`), only with stability bracing on; CF10 recommendation: lightest channel with d<sub>dia</sub> ≥ 0.5 d, else lightest W with d<sub>dia</sub> ≥ 0.5 d. **After:** d<sub>dia</sub> ≥ 0.75 d (girder depth, `cf.dg`) for channels and W shapes alike, always; CF10 recommendation with 0.75 d. Status of the depth item: warning when short (unchanged; it was a warning before for both).
  - **Check case A (hand):** d = 32.00 in, D = 30 in. Before: channel limit 0.5(32.00) = 16.00 in, MC18x42.7 (18.00 in) passes, ratio 16.00/18.00 = 0.89; W limit 0.75(30) = 22.50 in, W24x55 (23.60 in) passes, 0.95; CF10 recommends channel MC18x42.7. After: limit 0.75(32.00) = 24.00 in for both: MC18x42.7 warns, 24.00/18.00 = 1.33; W24x55 warns, 24.00/23.60 = 1.02; CF10: no channel ≥ 24.00 in, W24x55 (23.60) and W24x76 (23.90) are short, so W27x84 (26.70 in). (Depths are the tabulated actual depths, as before.)
  - **Check case B (headless Chromium, repro below; d = 38.88 in, D = 37 in):** before: W limit 0.75(37) = 27.75 in, channel limit 0.5(38.88) = 19.44 in, CF10 recommends "rolled diaphragm W21x44" (20.70 ≥ 19.44; no channel reaches 19.44); after: 0.75(38.88) = 29.16 in, CF10 recommends "rolled diaphragm W30x99" (29.70 in).
  - **Default example unchanged:** d = 62.5 in ≥ 48 in, `dia.on = 'no'` → no CFD; CF10 cells identical (only its note and symbol text change).

### CF-D2. The diaphragm is the design when selected   [CF1–CF9 N/A with the diaphragm; CFD decides status, badge, report, Design all] [projects with dia.on = 'no' bit-identical]
- **Where:**
  - New helpers after `CF_DIA` (≈ 2651): `cfDiaSec(q)` (section from the `cf.dia` inputs: the same preset/custom lookup and `hw = d − 2t_f`, `A = 2b_ft_f + h_wt_w` that `cfDiaChecks` used, plus `wpf = A × 12 × 0.2836` lb/ft and the name), `cfDiaOn(p)` (`p.dia.on === 'yes'`), `cfDiaGap(q)` (`max(0.5, ecc − 1.5)` in: diaphragm end from the girder web, used by quantities and drawings). `cfDiaChecks` now takes its section from `cfDiaSec` (same values; refactor, the default never reaches it and the saved-dia comparison below shows identical numbers).
  - `GM.cf.checks` (≈ 2853), before `cfDiaChecks(R, out);`: `if (cfDiaOn(R.p)) out.forEach(c => { if (/^CF[1-9]$/.test(c.id)) { c.items = []; c.status = 'na'; c.gov = -1; c.naWhy = 'Not used: diaphragm selected (the intermediate bracing is the channel or rolled W diaphragm, check CFD).'; } });`
  - CFD (`cfDiaChecks`): `grp` 'Rolled diaphragm alternative' → 'Diaphragm (intermediate bracing used)'; title `${chS ? 'Channel' : 'Rolled'} diaphragm ${nm_} (alternative to the cross-frame)` → `… (intermediate bracing used in place of the cross-frame)`; ref adds 4.6.2.7.1; sym adds `M_w = F_w\,d`; note extended (depth rule, wind model, assumptions).
  - `grps()` (≈ 6687). Before `const grps = () => (MODS[P.mod] || MODS.splice).groups;` After `const grps = () => P.mod === 'cf' && cfDiaOn(P.cf) ? ['Diaphragm (intermediate bracing used)', ...MODS.cf.groups] : (MODS[P.mod] || MODS.splice).groups;`. Found while testing: CFD's group was never in `GM.cf.groups`, so the Checks tab and the report (both list checks by group) did not show CFD at all, even with the alternative on; the status chip bar now shows it too.
  - `GM.cf.kq` (Summary key quantities), `echo` (one extra row "Intermediate bracing used" only when on), `combos` (one sentence after the truss table only when on), `drawings` (diaphragm elevation `cfDiaSVG(R)` when on).
  - Members tab (`panes`): section header 'Rolled or channel diaphragm alternative' → 'Diaphragm (channel or rolled W) in place of the cross-frame'; `cf.dia.on` label 'Check a rolled W or channel (C, MC) diaphragm' → 'Intermediate bracing used', options 'No'/'Yes' → 'Cross-frame (angles)'/'Diaphragm: channel (C, MC) or rolled W' (values unchanged); a note after the jacking inputs (assumptions, auto-design, lock).
- **Saved data:** no key or format change; `cf.dia.on` keeps its saved value (a project saved with the alternative on now uses the diaphragm as its design).

### CF-D3. CFD: wind on the diaphragm, wind on its bolts, and the bolt-line geometry   [new check items in CFD]
- **Where:** `cfDiaChecks`, after the jacking items. Anchor `it(\`Wind, Strength ${wk}: flexure M_w = F_w d (4.6.2.7.1)\``.
  ```js
  const wk = R.W.III.Fw >= R.W.V.Fw ? 'III' : 'V', Fw = R.W[wk].Fw, Mw = Fw * dgT, Vw = 2 * Mw / S;
  it(`Wind, Strength ${wk}: flexure M_w = F_w d (4.6.2.7.1)`, …, Mw / Mn); it(`Wind, Strength ${wk}: shear 2M_w/S`, …, Vw / Vn);
  // connection under wind (same bolt group, resistance and eccentricity as the existing item):
  const Mc = Mw + Vw * ecc, fw = Math.hypot(Vw / nb, Mc * ymax / Σy² + Fw / nb);
  // bolt line: s ≥ 3d_b and (nb − 1)s + 2e_min ≤ d − 2t_f − 1.0 in   (e_min = BOLT[d].emin.cut, the module's R.emin)
  ```
- **Model (new check; assumptions to verify):** the wind force is the module's own bottom-flange force F<sub>w</sub> = 1.0 P<sub>Z</sub>(d/2)L<sub>b</sub> (3.8.1.2.1, 4.6.2.7.1), the larger of Strength III (V) and Strength V (80 mph); no new load derivation. With a diaphragm there is no truss: F<sub>w</sub> at the exterior girder's bottom flange is reacted at the deck (top flange), a torque F<sub>w</sub> × d on the girder, resisted by diaphragm bending. M<sub>w</sub> = F<sub>w</sub>d is taken as the diaphragm end moment and the shear as 2M<sub>w</sub>/S (reverse curvature, the same relation the existing brace-moment shear item uses). Resistances are the existing φ<sub>f</sub>M<sub>n</sub> (6.10.8, L<sub>b</sub> = S, C<sub>b</sub> = 1.0) and φ<sub>v</sub>V<sub>n</sub> of CFD. Bolts: V<sub>w</sub>/n vertical; M = M<sub>w</sub> + V<sub>w</sub>·ecc distributed elastically over one vertical row, plus F<sub>w</sub>/n horizontal; against the existing min(φR<sub>s</sub>, φR<sub>b</sub>) (6.13.2.7, 6.13.2.9). Axial force F<sub>w</sub> in the diaphragm is not combined with flexure (f<sub>a</sub> shown in the note). The bolt-line item makes the one-row assumption checkable: pitch ≥ 3d (6.13.2.6.1) and the row with end distances e<sub>min</sub> (Table 6.13.2.6.6-1, rolled/cut edges as the module's angles use) within d − 2t<sub>f</sub> − 1.0 in (0.5 in fillet allowance each side, an assumption).
- **Check case (headless Chromium, repro below, W30x99, 5 bolts at 3 in, ecc 3.5 in):** V = 130 mph, K<sub>z</sub> = G = 1.0, C<sub>D</sub> = 1.3: P<sub>Z</sub> = 2.56×10⁻⁶(130)²(1.3) = 0.05624 ksf; W = 0.05624(38.88/12)/2 = 0.0911 kip/ft; L<sub>b</sub> = 25 ft: F<sub>w</sub> = 2.28 kip (Strength III governs; Strength V 0.86 kip). M<sub>w</sub> = 2.278(38.88) = 88.6 kip-in ≤ φM<sub>n</sub> = 13,311 kip-in (0.01); V<sub>w</sub> = 2(88.6)/48 = 3.69 kip ≤ 427.67 kip (0.01). Bolts: y = −6, −3, 0, 3, 6 in, Σy² = 90 in²; M<sub>c</sub> = 88.6 + 3.69(3.5) = 101.5 kip-in; 101.5(6)/90 + 2.278/5 = 6.77 + 0.46 = 7.22; √(7.22² + 0.74²) = 7.26 kip ≤ 25.98 kip (0.28). Bolt line: 3.00 ≥ 3(0.875) = 2.63; 4(3) + 2(1.125) = 14.25 ≤ 29.70 − 2(0.670) − 1.0 = 27.36 in (0.88).

### CF-D4. Auto-design selects the bracing type and designs the diaphragm   [auto-design behavior] [default example unchanged]
- **Where:** `AD.cf` (≈ 5196), before `if (!adLocked('cf.type'))`:
  ```js
  { const TR = cfTypeRec(C0), q = C0.dia = C0.dia || {}, lk = adLocked('cf.dia.on');
    if (!lk && !TR.deep && q.on !== 'yes') { q.on = 'yes'; out.push(`… the cross-frame was replaced by a diaphragm`); }
    else if (!lk && TR.deep && q.on === 'yes') { q.on = 'no'; out.push(`… the diaphragm was replaced by a cross-frame`); }
    if (q.on === 'yes') return adCfDia(C0, out, TR, lk); }
  ```
  The type message at the end (anchor `is recommended${TR.xf ?`) now reads "(the cross-frame is kept because "Intermediate bracing used" is locked)", the only way to reach it. New `const adCfDia = (C0, out, TR, lk) => {…}` after `AD.cf`: candidates = channels sorted by area, then `CF_DIA` (by weight), those with d ≥ 0.75 d (or the locked shape; or the deepest W when none is deep enough, the depth item then excluded from the pass test); pitch = max(3 in, 3d rounded up to 1/4 in) unless locked; bolts per end from 2 up to the most that fit (same bolt-line limit as CF-D3) unless locked; first candidate whose CFD items are all pass/N/A wins. A torsional-stiffness shortfall that no diaphragm can fix (β<sub>sec</sub> and β<sub>g</sub> in series below β<sub>T,req</sub> even with a rigid brace) is reported and not chased with larger sections, as the angle designer does for CF8; if nothing passes, the largest candidate with the most bolts is left and the failing items are named. The angle inputs and `cf.type` are left untouched while the diaphragm is used. Lock keys: `cf.dia.on`, `cf.dia.shape`, `cf.dia.nb`, `cf.dia.pitch` (existing double-click convention; no new key).
- **Behavior note:** like every other unlocked input (e.g. `cf.type`), an unlocked "Intermediate bracing used" is set by auto-design from the girder depth: a diaphragm the user turned on for a deep girder is switched back unless locked.

### CF-D5. Drawings, 3D, DXF show the diaphragm   [graphics only]
- **Where:** new `cfDiaSVG(R)` after `cfSVG` (girders, connection plates, the channel/W centered on d with its flanges, bolt rows, F<sub>w</sub> arrow, dimensions S, d<sub>dia</sub>, d); `v3bBuild()` cross-frame block (≈ 6122): with the diaphragm on, intermediate frames (`f.type !== 'sup'`) draw web and flange boxes between the girders, centered on the girder depth, ends `cfDiaGap` from each girder line; end frames unchanged; the 3D note says "bracing lines: intermediate diaphragms (…) and end cross-frames". `dxfCF()`: with the diaphragm on, the intermediate detail draws the diaphragm outline, flange lines, bolt rows and dimensions, titled "INTERMEDIATE DIAPHRAGM (CHANNEL|ROLLED W)", and the general note names the shape, grade, bolts, pitch, bolt line, "CENTERED ON GIRDER DEPTH; COPE FLANGES AS REQUIRED"; the end cross-frame detail is unchanged.

### CF-D6. Design all quantities: diaphragm steel and bolts in place of the angles   [quantities]
- **Where:** `designAllRun0()` (≈ 5328). Anchor `const cfE = adEval('cf'); if (cfE && cfDiaOn(P.cf))`. With the diaphragm on: steel = n<sub>F</sub> × A × (S − 2·`cfDiaGap`) × 0.2836 lb/in³, row "Intermediate diaphragms (n<sub>F</sub>, shape, length ft at lb/ft): steel"; bolts = n<sub>F</sub> × 2 × `dia.nb`, row "Diaphragms: bolts"; unit costs `cDet`, `cBolt` as for the angles. Otherwise the existing cross-frame rows, unchanged.
- **Check case (repro):** W30x99: A = 2(10.5)(0.670) + (29.70 − 1.34)(0.520) = 28.82 in² → 98.07 lb/ft; L = 48 − 2(3.5 − 1.5) = 44 in = 3.67 ft; 27 × 28.82 × 44 × 0.2836 = 9,709 lb = 9.71 kip, $33,981 at $3.50/lb; bolts 27 × 2 × 5 = 270, $4,050.

### CF-D7. Manual
- "Rolled diaphragm alternative (Cross-frames)" and "Channel diaphragms and the bracing type (Cross-frames)" (≈ 2135–2136) replaced by "Diaphragms (Cross-frames)" and "Bracing type (Cross-frames)" describing CF-D1 to CF-D6.

### Verification and open items (CF-D1 to CF-D7)
- **Repro (shallow girder):** Preliminary sizing 90 ft simple span, N<sub>b</sub> = 10, S = 4 ft, overhangs 2.25 ft, depth rule off, Suggest applied (D = 37, top 13 × 3/4, bottom 14 × 1 1/8, d = 38.88 in); Cross-frames: Get demands (Preliminary sizing; auto-design runs). Before: K-frame kept, L6x6x5/8 / L3x3x3/8 / L6x6x5/8, CF8 fails (β<sub>T</sub> 12,790 < 21,597), CF10 warns; Design all: "Fails: CF8; warnings CF10", members 7.49 kip $26,204 + 540 bolts $8,100. After: diaphragm W30x99, 5 bolts at 3 in; CF1–CF9 N/A; CFD fails only on the torsional brace system stiffness (β<sub>T</sub> = 12,950 < 21,597: β<sub>sec</sub> = 14,634 governs because the 0.8 D test uses the chord work-point depth h = 29 in < 0.8(37) = 29.6 in), every other CFD item passes; CF10 OK; Design all "Fails: CFD", 9.71 kip $33,981 + 270 bolts $4,050. With h = 30 in (≥ 0.8 D) the same W30x99 with 5 bolts passes every CFD item (β<sub>T</sub> = 112,558).
- **Default example:** every module's checks (ids, statuses, item cells), Summary text, the cross-frame auto-design result, DXF text, Design all (statuses, quantities, costs, conflicts), saved autosave/inbox/PlateLine data bit-identical main vs branch except timestamps; only intended text differs (Members tab header/label/options/note, CF10 note and symbol).
- **Saved data both directions:** a branch project with the diaphragm loads in main (shown there as the alternative; main's old depth limits); a main project with the alternative on (W21x44, deep girder) loads in the branch with `dia.on` kept and CFD as the design. No console errors.
- **Lock:** with `cf.dia.on` locked at 'no', auto-design keeps the cross-frame and CF10 warns; unlocked, it selects the diaphragm; deep girder (d = 62.5) unlocked switches back to the cross-frame; locked 'yes' keeps a diaphragm (deepest W, depth warns).
- **How verified:** `node --check` on the inline scripts; headless Chromium (Playwright) main vs branch; screenshots of the Summary, Members inputs, Checks (CFD), Drawings, 3D and Design all.
- **Other copies:** none.
- **Open items (raised, not changed):**
  1. CFD's β<sub>sec</sub> and the C coefficient (2.4 vs 3.6/φ) of 6.7.4.2.2 decide "deep bracing" from the cross-frame chord depth `cf.h`, not the diaphragm depth; with the diaphragm selected the diaphragm depth (and its connection-plate length) may be the right basis. In the repro this alone makes CFD fail (β<sub>T</sub> 12,950 vs 112,558 with h ≥ 0.8 D).
  2. Depth comparison uses actual depths (W24x55 = 23.60 in): a 31.75 in girder needs 23.81 in, so W27x84 (26.70) is recommended, not W24x55.
  3. Preliminary sizing's own text (PlateLine, not edited here) still says "channel (C, MC, depth about half the girder depth or more)".
  4. The wind model and the axial force in the diaphragm (CF-D3), and the 1.0 in fillet allowance of the bolt-line item.
  5. With the diaphragm, the end cross-frame drawings still show the angle cross-frame members, which auto-design no longer re-sizes while the diaphragm is used.

### Exact changes (CF-D1 to CF-D7): main page (unified diff)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index 2ab3ba4..6e70ef9 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -2132,8 +2132,8 @@ const MAN = [
 <h3>Analysis stiffness (6.10.1.5)</h3><p>The analysis uses the concrete deck effective over the entire length for all composite loads, as Article 6.10.1.5 requires; the cracked-zone options remain available and are labeled as not per 6.10.1.5. Stresses in negative flexure still use the steel section plus the longitudinal reinforcement (6.10.1.1.1c).</p>
 <h3>Deck placement sequence (SA7)</h3><p>Steel and other noncomposite loads act on the steel; each pour's wet concrete then acts on the girder with the earlier pours composite (n or 3n). Pours are automatic (positive-moment regions first, then pier regions) or typed as x1-x2 ranges in placement order. The Combinations tab shows each stage, the noncomposite envelope against placing the deck at once, and deck tension in hardened pours; SA7 reports the governing values. With Structural analysis as the demand source, each Girder section location receives the sequence moment (M<sub>DC1</sub> for constructibility), used by the constructibility checks; final-condition checks use the deck placed at once.</p>
 <h3>Bearing and connection forces; fit condition; routine criteria (SA6)</h3><p>Under the reactions: permanent reaction, jacking 1.3 × permanent (3.4.3.1), Seismic Zone 1 horizontal connection force (3.10.9.2), and minimum support length N (4.7.4.4). SA6 compares the bridge with the NSBA routine-bridge definition, records η = 1.0 (1.3.2.1), and requires the fit condition (6.7.2) when a skew exceeds 20°; the fit condition appears in the drawings' notes and camber table.</p>
-<h3>Rolled diaphragm alternative (Cross-frames)</h3><p>A W-shape diaphragm can be checked beside the cross-frame: depth (6.7.4.2), torsional brace stiffness with β<sub>br</sub> = 6EI<sub>x</sub>/S (6.7.4.2.2), brace moment against φM<sub>n</sub> (6.10.8, L<sub>b</sub> = S, C<sub>b</sub> = 1.0), shear, jacking flexure and shear, and the eccentric bolted connection. Nominal dimensions, fillets neglected. Axial load from wind or seismic forces is not considered.</p>
-<h3>Channel diaphragms and the bracing type (Cross-frames)</h3><p>The diaphragm alternative also offers channels (C8x11.5 to MC18x42.7, nominal AISC dimensions; verify). A channel takes the same checks as the rolled W (brace stiffness, brace moment by the 6.10.8 model with L<sub>b</sub> = S and C<sub>b</sub> = 1.0, which is an approximation for a channel, shear, jacking, and the bolted connection), with I<sub>y</sub> about the channel's own centroid, and its depth is compared with half the girder depth. <b>CF10</b> recommends the intermediate bracing type from the girder depth d (out-to-out of the flanges, the "Girder depth d" input, not the web depth): at or above the <b>Minimum girder depth for cross-frames</b> (default 48 in; common practice, e.g. AISC/NSBA G13.1 guidance; owner standards govern; verify) a cross-frame (X or K by S/h, as the auto-design chooses), below it the lightest channel at least half the girder depth, or a rolled W. A cross-frame on a girder below the minimum gives a warning, not a failure. The selected type is never changed automatically; Preliminary sizing sends its own minimum (Framing tab) with the cross-frame geometry, and its Suggest tab states the recommendation.</p>
+<h3>Diaphragms (Cross-frames)</h3><p>The intermediate bracing is either the cross-frame (angles) or a diaphragm: a channel (C8x11.5 to MC18x42.7) or a rolled W (W18x35 to W36x135), nominal AISC dimensions, fillets neglected (verify). Set it with <b>Intermediate bracing used</b> on the Members tab. With the diaphragm selected it is the design: the angle checks CF1 to CF9 show N/A and check <b>CFD</b> decides the module status, the tab badge, the report, and the Design all row. CFD checks the depth against 0.75 of the girder depth d (6.7.4.2, plate girders; a warning, as the article says "should"), the torsional brace stiffness with β<sub>br</sub> = 6EI<sub>x</sub>/S (6.7.4.2.2), the brace moment against φM<sub>n</sub> (6.10.8, L<sub>b</sub> = S, C<sub>b</sub> = 1.0; for a channel an approximation), shear, jacking flexure and shear (when on), wind, and the bolted connection (one vertical row through the web, eccentric shear and moment), plus the bolt pitch and the fit of the bolt row in the web. <b>Wind:</b> the bottom-flange wind force F<sub>w</sub> the module already derives for the cross-frame (governing Strength III or V, 4.6.2.7.1) acts with the lever arm d to the deck: M<sub>w</sub> = F<sub>w</sub>d is the diaphragm end moment, with shear 2M<sub>w</sub>/S, and the bolts also take F<sub>w</sub> horizontally (a simplified model to verify; axial force in the diaphragm is not combined with flexure). Assumed details (verify): web bolted to the connection plate, diaphragm centered on the girder depth, member ends 1.5 in past the bolt line; end (bearing-line) diaphragms are not covered.</p>
+<h3>Bracing type (Cross-frames)</h3><p><b>CF10</b> recommends the intermediate bracing type from the girder depth d (out-to-out of the flanges, the "Girder depth d" input, not the web depth): at or above the <b>Minimum girder depth for cross-frames</b> (default 48 in; common practice, e.g. AISC/NSBA G13.1 guidance; owner standards govern; verify) a cross-frame (X or K by S/h, as the auto-design chooses), below it the lightest channel at least 0.75 d deep, or else the lightest rolled W at least 0.75 d deep. A cross-frame on a girder below the minimum gives a warning, not a failure. Auto-design selects the type: below the minimum it switches to the diaphragm and picks the lightest channel, then W, at least 0.75 d deep that passes every CFD item, with the fewest bolts (one row, pitch 3 in or 3d); at or above the minimum it designs the cross-frame and switches a diaphragm back. Double-click the <b>Intermediate bracing used</b> label to lock the choice (and the shape, bolt count, or pitch labels to lock those). Preliminary sizing sends its own minimum (Framing tab) with the cross-frame geometry, and its Suggest tab states the recommendation. Design all counts the diaphragm steel (S less the end gaps, times the weight per foot from the nominal area) and its bolts in place of the angles.</p>
 <h3>Live load: vehicles and what controls (SA5)</h3><p>At every analysis point the HL-93 design truck (rear axle spacing varied from 14 to 30 ft in 1 ft steps, both directions) and design tandem are moved across the influence line, each with IM, and combined with the design lane load; in negative moment regions and for interior reactions, 90% of two design trucks plus 90% of the lane load is also evaluated. The Combinations tab card <b>Live load: vehicles evaluated and what controls</b> shows, at tenth points, each vehicle's moment per lane, the controlling truck spacing, which combination controls, the distribution factor, and the girder LL+IM; its chart shows every vehicle along the girder. The fatigue table gives the fatigue truck (30 ft rear spacing, IM 15%, one truck) range per lane, the fatigue distribution factor (single-lane ÷ 1.2), the girder range, and the Fatigue I range (× 1.75). Check SA5 records what was evaluated and how often each vehicle controls.</p>
 <h3>Applicability of the line-girder analysis (SA4)</h3><p>The Structural analysis module is a line-girder analysis with the approximate live load distribution factors of 4.6.2.2. Check SA4 lists the limits of that method for the bridge: the range of applicability of the distribution factor equations (DF1); skew within 60° for the skew corrections of Tables 4.6.2.2.2e-1 and 4.6.2.2.3c-1 (a fail beyond, where a refined analysis is required); the skew index I<sub>s</sub> = w<sub>g</sub>tanθ/L<sub>s</sub> ≤ 0.30 of NCHRP Report 725 per span (a warning above it, where a grid or 3D analysis is recommended); horizontal curvature within 4.6.1.2.4b (DF4); and at least four girders. For skews over 20° it also warns of the two effects a line-girder analysis cannot compute: cross-frame live-load forces (enter them from a refined analysis in the Cross-frames module, or show by the connectivity index of 4.6.3.3.2 that none is needed; that index is not computed here) and flange lateral bending. For the latter, Preliminary sizing sends every Girder section location f<sub>ℓ</sub> estimated per C6.10.1, 10.0 ksi for interior and 7.5 ksi for exterior girders (unfactored, based on staggered cross-frames), times a load factor (1.25 by default); all three are on the Limits tab. The full design of Preliminary sizing includes the same f<sub>ℓ</sub> on the bottom flange (f<sub>bu</sub> + f<sub>ℓ</sub>/3 in negative flexure and noncompact positive flexure, M<sub>u</sub> + f<sub>ℓ</sub>S<sub>xt</sub>/3 in compact positive flexure), so its plates pass the Girder section checks with it.</p>
 <h3>3D view</h3><p><b>3D view</b> (top bar) opens a 3D model built from the current design. <b>Whole bridge</b>: every girder with its flange and web plates as designed, the skewed deck (semi-transparent) on its haunches, cross-frames on their work points (X or K type from the Cross-frames module, end cross-frames along the bearing lines), connection plates on the side each cross-frame attaches to, bearing stiffeners, intermediate stiffeners when the web is stiffened, field splice plates, bearings, and the support seats along the skewed bearing lines. <b>Composite girder G#</b>: one girder with its haunch and tributary deck strip, all of the above for that girder, every splice bolt, and every shear stud at its pitch zone; <b>Zoom to</b> jumps to a field splice or bearing. Layers switch on and off (deck, cross-frames, stiffeners, splices and bolts, studs, bearings and supports). Drag to rotate, right-drag to pan, scroll to zoom; <b>Save PNG</b> saves the view. Run Design all first so the details shown are the designed ones.</p><p><b>Diagrams in 3D.</b> The diagram picker draws a shear or moment diagram as a translucent fence beside each girder (offset toward the next girder), zero line at mid-web: Strength I, Service II, LL+IM, fatigue envelopes (maximum red, minimum blue) or DC1, DC2 + DW, dead load shear. By default positive moment is plotted down (tension side); untick "+ moment down" to plot it up. Solid lines mark supports and dashed lines field splices; peak values are labeled, and in the single-girder view the pier and splice values too. Hover over a fence for the station and value; the Scale slider changes the vertical scale. The whole-bridge view analyzes every girder, so the fences show how load is shared among the girders.</p>
@@ -2648,17 +2648,27 @@ const CF_MEM = [['top', 'Top chord'], ['bot', 'Bottom chord'], ['diag', 'Diagona
 /* channels for diaphragms on shallow girders: [name, d, b_f, t_f (average), t_w] in in, nominal dimensions from the AISC Manual (verify) */
 const CF_CH = [['C8x11.5', 8.00, 2.26, 0.390, 0.220], ['C10x15.3', 10.0, 2.60, 0.436, 0.240], ['C12x20.7', 12.0, 2.94, 0.501, 0.282], ['MC12x31', 12.0, 3.67, 0.700, 0.370], ['C15x33.9', 15.0, 3.40, 0.650, 0.400], ['MC18x42.7', 18.0, 3.95, 0.625, 0.450]];
 const CF_DIA = [['W18x35', 17.7, 6.00, 0.425, 0.300], ['W21x44', 20.7, 6.50, 0.450, 0.350], ['W24x55', 23.6, 7.01, 0.505, 0.395], ['W24x76', 23.9, 8.99, 0.680, 0.440], ['W27x84', 26.7, 9.96, 0.640, 0.460], ['W30x99', 29.7, 10.5, 0.670, 0.520], ['W33x118', 32.9, 11.5, 0.740, 0.550], ['W36x135', 35.6, 12.0, 0.790, 0.600]];
+/* diaphragm section from the cf.dia inputs (preset W or channel, or a custom W): nominal dimensions, fillets neglected */
+function cfDiaSec(q) {
+  const chS = CF_CH.find(s => s[0] === q.shape), pre = CF_DIA.find(s => s[0] === q.shape) || chS, d = pre ? pre[1] : +q.d, bf = pre ? pre[2] : +q.bf, tf = pre ? pre[3] : +q.tf, tw = pre ? pre[4] : +q.tw;
+  const hw = d - 2 * tf, A = 2 * bf * tf + hw * tw;
+  return { chS, pre, d, bf, tf, tw, hw, A, wpf: A * 12 * 0.2836, nm_: pre ? q.shape : `W ${f2(d)} x ${f2(bf)}` };   // wpf: lb/ft from the nominal area, 0.2836 lb/in³ (490 pcf)
+}
+/* the diaphragm is the intermediate bracing used when cf.dia.on = 'yes' (2026-10-12; was a side-by-side alternative) */
+const cfDiaOn = p => ((p || {}).dia || {}).on === 'yes';
+/* end of the diaphragm from each girder web: the bolt line (cf.dia.ecc) less a 1.5 in end distance (assumption for quantities and drawings) */
+const cfDiaGap = q => Math.max(0.5, (+q.ecc || 3.5) - 1.5);
 function cfDiaChecks(R, out) {
-  const p = R.p, q = p.dia || {}; if (q.on !== 'yes') return; const chS = CF_CH.find(s => s[0] === q.shape), pre = CF_DIA.find(s => s[0] === q.shape) || chS, d = pre ? pre[1] : +q.d, bf = pre ? pre[2] : +q.bf, tf = pre ? pre[3] : +q.tf, tw = pre ? pre[4] : +q.tw, Fy = +q.gr || 50, E = 29000, S = R.S, SB = R.SB;
-  const hw = d - 2 * tf, A = 2 * bf * tf + hw * tw, Ix = bf * d ** 3 / 12 - (bf - tw) * hw ** 3 / 12, Sx = 2 * Ix / d,
-    Iy = chS ? (() => { const xb = (hw * tw * tw / 2 + 2 * bf * tf * bf / 2) / A; return hw * tw ** 3 / 12 + hw * tw * (tw / 2 - xb) ** 2 + 2 * (tf * bf ** 3 / 12 + bf * tf * (bf / 2 - xb) ** 2); })() : 2 * tf * bf ** 3 / 12 + hw * tw ** 3 / 12, /* channel: I_y about its own centroid */ ry = Math.sqrt(Iy / A), Dg = SB ? SB.Dg : null, nm_ = pre ? q.shape : `W ${f2(d)} x ${f2(bf)}`;
+  const p = R.p, q = p.dia || {}; if (q.on !== 'yes') return; const X = cfDiaSec(q), { chS, pre, d, bf, tf, tw, nm_ } = X, Fy = +q.gr || 50, E = 29000, S = R.S, SB = R.SB;
+  const hw = X.hw, A = X.A, Ix = bf * d ** 3 / 12 - (bf - tw) * hw ** 3 / 12, Sx = 2 * Ix / d,
+    Iy = chS ? (() => { const xb = (hw * tw * tw / 2 + 2 * bf * tf * bf / 2) / A; return hw * tw ** 3 / 12 + hw * tw * (tw / 2 - xb) ** 2 + 2 * (tf * bf ** 3 / 12 + bf * tf * (bf / 2 - xb) ** 2); })() : 2 * tf * bf ** 3 / 12 + hw * tw ** 3 / 12, /* channel: I_y about its own centroid */ ry = Math.sqrt(Iy / A), dgT = nm(p.dg);
   const lt = ltbFnc({ bfc: bf, tfc: tf, Dc: hw / 2, tw, Lb: S, Cb: 1.0, Rb: 1, Rh: 1, Fyc: Fy, Fyw: Fy }), Mn = lt.Fnc * Sx;   // 6.10.8 for a noncomposite rolled I-section, Lb = girder spacing
   const k = 5, lam = hw / tw, r1 = 1.12 * Math.sqrt(E * k / Fy), r2 = 1.40 * Math.sqrt(E * k / Fy), C = lam <= r1 ? 1 : lam <= r2 ? r1 / lam : 1.57 / lam ** 2 * (E * k / Fy), Vn = C * 0.58 * Fy * hw * tw;
-  const c = { id: 'CFD', grp: 'Rolled diaphragm alternative', title: `${chS ? 'Channel' : 'Rolled'} diaphragm ${nm_} (alternative to the cross-frame)`, ref: 'AASHTO LRFD 6.7.4.2, 6.7.4.2.2, 6.10.8, 6.10.9, 6.13.2, 3.4.3.1', src: 'Code', sym: T`\beta_{br} = \frac{6EI_x}{S},\quad M_{br} \le \phi_f M_n`, cols: ['Check', 'Demand', 'Resistance', 'Ratio'], items: [],
-    note: `Properties from nominal dimensions (d = ${f2(d)}, b_f = ${f2(bf)}, t_f = ${f3(tf)}, t_w = ${f3(tw)} in; fillets neglected): I_x = ${f0(Ix)} in⁴, S_x = ${f0(Sx)} in³, r_y = ${f2(ry)} in. Flexural resistance per 6.10.8 as a noncomposite rolled I-section braced only at the girders (L_b = S, C_b = 1.0, conservative). The brace stiffness 6EI/S assumes reverse-curvature bending between girders.${chS ? ' Channel: the same checks as the rolled W diaphragm; the 6.10.8 lateral-torsional buckling model is for I-sections and is used here as an approximation for the channel (verify against AISC 360-16 F2 with c = (h_o/2)√(I_y/C_w)).' : ''}` };
+  const wk = R.W.III.Fw >= R.W.V.Fw ? 'III' : 'V', Fw = R.W[wk].Fw, Mw = Fw * dgT, Vw = 2 * Mw / S;   // wind on the diaphragm: the module's own bottom-flange wind force (4.6.2.7.1) times the lever arm d to the deck
+  const c = { id: 'CFD', grp: 'Diaphragm (intermediate bracing used)', title: `${chS ? 'Channel' : 'Rolled'} diaphragm ${nm_} (intermediate bracing used in place of the cross-frame)`, ref: 'AASHTO LRFD 6.7.4.2, 6.7.4.2.2, 6.10.8, 6.10.9, 6.13.2, 3.4.3.1, 4.6.2.7.1', src: 'Code', sym: T`\beta_{br} = \frac{6EI_x}{S},\quad M_{br} \le \phi_f M_n,\quad M_w = F_w\,d`, cols: ['Check', 'Demand', 'Resistance', 'Ratio'], items: [],
+    note: `Properties from nominal dimensions (d = ${f2(d)}, b_f = ${f2(bf)}, t_f = ${f3(tf)}, t_w = ${f3(tw)} in; fillets neglected): I_x = ${f0(Ix)} in⁴, S_x = ${f0(Sx)} in³, r_y = ${f2(ry)} in. Flexural resistance per 6.10.8 as a noncomposite rolled I-section braced only at the girders (L_b = S, C_b = 1.0, conservative). The brace stiffness 6EI/S assumes reverse-curvature bending between girders.${chS ? ' Channel: the same checks as the rolled W diaphragm; the 6.10.8 lateral-torsional buckling model is for I-sections and is used here as an approximation for the channel (verify against AISC 360-16 F2 with c = (h_o/2)√(I_y/C_w)).' : ''} Depth: AASHTO LRFD 6.7.4.2 asks for diaphragms at least 0.75 of the girder depth for plate girders (0.5 for rolled beams); the girders here are plate girders, so 0.75 of the "Girder depth d" input is used for channels and W shapes alike (a warning, not a failure, since the article says "should"). Wind (Strength ${wk}, the governing of Strength III and V): the bottom-flange wind force F_w = ${f2(Fw)} kip of the exterior girder (the same force the cross-frame model uses, 4.6.2.7.1) is carried to the deck at the top flange through the girder and the diaphragm, a torque F_w × d = ${f2(Fw)} × ${f2(dgT)} = ${f0(Mw)} kip-in resisted by diaphragm bending, taken as the diaphragm end moment with shear 2M_w/S (reverse curvature, as for the brace moment); the bolts also take F_w horizontally. Axial force F_w in the diaphragm (f_a = ${f2(Fw / A)} ksi) is not combined with the flexure (assumption to verify). Assumed details (verify): the channel or W web is bolted to the connection plate with one vertical row of bolts, and the diaphragm is centered on the girder web depth; flanges coped to clear the connection plate as needed.` };
   const it = (loc, dem, res, st, r) => c.items.push({ loc, cells: [dem, res, r != null ? f2(r) : '—'], st, r, work: T`\text{${loc}}` });
-  if (chS) { const dgT = nm(p.dg); if (dgT > 0) it('Depth (at least about half the girder depth; 6.7.4.2: 0.5 of a rolled beam depth)', `${f2(d)} in`, `${f2(0.5 * dgT)} in`, d >= 0.5 * dgT - 1e-6 ? 'pass' : 'warn', 0.5 * dgT / d); }
-  else if (Dg) it('Depth (6.7.4.2: at least 0.75 of the plate girder depth)', `${f2(d)} in`, `${f2(0.75 * Dg)} in`, d >= 0.75 * Dg - 1e-6 ? 'pass' : 'warn', 0.75 * Dg / d);
+  if (dgT > 0) it('Depth (6.7.4.2: at least 0.75 of the plate girder depth d)', `${f2(d)} in`, `${f2(0.75 * dgT)} in`, d >= 0.75 * dgT - 1e-6 ? 'pass' : 'warn', 0.75 * dgT / d);
   if (SB) { const bbr = 6 * E * Ix / S, bT = 1 / (1 / bbr + (isFinite(SB.bsec) ? 1 / SB.bsec : 0) + 1 / SB.bg), r = SB.bReq / bT;
     it('Torsional brace system stiffness (6.7.4.2.2)', `β_T,req = ${f0(SB.bReq)} kip-in/rad`, `β_T = ${f0(bT)} (β_br = ${f0(bbr)})`, r <= 1 ? 'pass' : 'fail', r);
     const rm = SB.Mbr / (1.0 * Mn); it('Brace moment M_br (6.7.4.2.2)', `${f0(SB.Mbr)} kip-in`, `φ_f M_n = ${f0(Mn)} kip-in (F_nc = ${f2(lt.Fnc)} ksi)`, rm <= 1 ? 'pass' : 'fail', rm);
@@ -2666,9 +2676,17 @@ function cfDiaChecks(R, out) {
   else it('Stability bracing', 'enter the girder and bracing data (Stability bracing inputs)', '—', 'na');
   if (q.end === 'yes' && +q.Rj > 0) { const Mj = +q.Rj * +q.aj, rm = Mj / Mn, rv = +q.Rj / Vn;
     it('Jacking: flexure (3.4.3.1)', `${f0(Mj)} kip-in`, `φ_f M_n = ${f0(Mn)} kip-in`, rm <= 1 ? 'pass' : 'fail', rm); it('Jacking: shear', `${f2(+q.Rj)} kip`, `φ_v V_n = ${f2(Vn)} kip`, rv <= 1 ? 'pass' : 'fail', rv); }
+  { const rm = Mw / Mn, rv = Vw / Vn;
+    it(`Wind, Strength ${wk}: flexure M_w = F_w d (4.6.2.7.1)`, `${f0(Mw)} kip-in (F_w = ${f2(Fw)} kip)`, `φ_f M_n = ${f0(Mn)} kip-in`, rm <= 1 ? 'pass' : 'fail', rm);
+    it(`Wind, Strength ${wk}: shear 2M_w/S`, `${f2(Vw)} kip`, `φ_v V_n = ${f2(Vn)} kip`, rv <= 1 ? 'pass' : 'fail', rv); }
   { const nb = Math.max(2, Math.round(+q.nb || 2)), s = +q.pitch || 3, db = +((p.conn || {}).d) || 0.875, Ab = Math.PI * db * db / 4, thr = (p.conn || {}).thr === 'excl' ? 0.56 : 0.45, phiRs = 0.80 * thr * Ab * (FUB[(p.conn || {}).gr] || 120), phiRb = 0.80 * 2.4 * db * tw * (Fy === 36 ? 58 : 65);
-    const V = SB ? 2 * SB.Mbr / S : 0, Vt = V + (q.end === 'yes' ? +q.Rj || 0 : 0), M = (SB ? SB.Mbr : 0) + Vt * (+q.ecc || 0), ys = [...Array(nb)].map((_, i) => (i - (nb - 1) / 2) * s), sy2 = ys.reduce((a, y) => a + y * y, 0), fmax = Math.hypot(Vt / nb, M * Math.max(...ys.map(Math.abs)) / (sy2 || 1)), res = Math.min(phiRs, phiRb), r = fmax / res;
-    it(`Bolted connection: ${nb} bolts at ${f2(s)} in, eccentric shear and moment (6.13.1, 6.13.2)`, `${f2(fmax)} kip per bolt`, `${f2(res)} kip (shear ${f2(phiRs)}, bearing ${f2(phiRb)})`, r <= 1 ? 'pass' : 'fail', r); }
+    const ys = [...Array(nb)].map((_, i) => (i - (nb - 1) / 2) * s), sy2 = ys.reduce((a, y) => a + y * y, 0), ym = Math.max(...ys.map(Math.abs)), res = Math.min(phiRs, phiRb);
+    const V = SB ? 2 * SB.Mbr / S : 0, Vt = V + (q.end === 'yes' ? +q.Rj || 0 : 0), M = (SB ? SB.Mbr : 0) + Vt * (+q.ecc || 0), fmax = Math.hypot(Vt / nb, M * ym / (sy2 || 1)), r = fmax / res;
+    it(`Bolted connection: ${nb} bolts at ${f2(s)} in, eccentric shear and moment (6.13.1, 6.13.2)`, `${f2(fmax)} kip per bolt`, `${f2(res)} kip (shear ${f2(phiRs)}, bearing ${f2(phiRb)})`, r <= 1 ? 'pass' : 'fail', r);
+    const Mc = Mw + Vw * (+q.ecc || 0), fw = Math.hypot(Vw / nb, Mc * ym / (sy2 || 1) + Fw / nb), rw = fw / res;
+    it(`Bolted connection under wind, Strength ${wk}: V = ${f2(Vw)} kip, M = ${f0(Mc)} kip-in, H = F_w = ${f2(Fw)} kip (6.13.2)`, `${f2(fw)} kip per bolt`, `${f2(res)} kip`, rw <= 1 ? 'pass' : 'fail', rw);
+    const em = R.emin, avail = d - 2 * tf - 1.0, need = (nb - 1) * s + 2 * em, okG = s >= 3 * db - 1e-9 && need <= avail + 1e-9;
+    it(`Bolt line: pitch ≥ 3d (6.13.2.6.1) and ${nb} bolts with ${frac(em)} in end distances within the web depth d − 2t_f − 1 in`, `s = ${f2(s)} in, ${f2(need)} in`, `≥ ${f2(3 * db)} in, ≤ ${f2(avail)} in`, okG ? 'pass' : 'fail', Math.max(3 * db / s, need / (avail > 0 ? avail : 1e-9))); }
   out.add(c);
 }
 GM.cf = {
@@ -2699,7 +2717,7 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
           <p class="note">Brace moment M<sub>br</sub> = (C L / nEI<sub>yeff</sub>)(M<sub>u</sub>/C<sub>b</sub>)²(L<sub>b</sub>/500h<sub>o</sub>) with C = 2.4 or 3.6. It is applied to the truss as a couple on one girder and added to the Constructibility forces. The stiffness requirement of 6.7.4.2.2 (β<sub>br</sub>, β<sub>sec</sub>, β<sub>g</sub>) is not yet checked.</p></div>`,
       cf_mem: `${secHd('sec-cfm', 'Angles')}<div class="sec-body" id="sec-cfm">${fld('Angle grade', 'cf.gA', '', 'sel', { options: GR })}${fld('Gusset grade', 'cf.gG', '', 'sel', { options: GR })}
         ${CF_MEM.map(([k, l]) => `<h4 class="sub-h full">${l}</h4>${mem(k)}`).join('')}</div>
-        ${secHd('sec-cfd', 'Rolled or channel diaphragm alternative')}<div class="sec-body" id="sec-cfd">${fld('Check a rolled W or channel (C, MC) diaphragm', 'cf.dia.on', '', 'sel', { options: [['no', 'No'], ['yes', 'Yes']] })}${fld('Shape (nominal dimensions)', 'cf.dia.shape', '', 'sel', { options: CF_DIA.map(s => [s[0], s[0]]).concat(CF_CH.map(s => [s[0], `${s[0]} (channel)`]), [['custom', 'Custom W (enter below)']]) })}${fld('Depth d', 'cf.dia.d', 'in')}${fld('Flange width b<sub>f</sub>', 'cf.dia.bf', 'in')}${fld('Flange thickness t<sub>f</sub>', 'cf.dia.tf', 'in')}${fld('Web thickness t<sub>w</sub>', 'cf.dia.tw', 'in')}${fld('Grade', 'cf.dia.gr', '', 'sel', { options: [['36', '36'], ['50', '50']] })}${fld('Bolts per end (one vertical line)', 'cf.dia.nb', '')}${fld('Bolt pitch', 'cf.dia.pitch', 'in')}${fld('Bolt line to girder web', 'cf.dia.ecc', 'in')}${fld('End diaphragm (jacking)', 'cf.dia.end', '', 'sel', { options: [['no', 'No'], ['yes', 'Yes']] })}${fld('Jacking reaction per jack, 1.3 × permanent (3.4.3.1)', 'cf.dia.Rj', 'kip')}${fld('Jack offset from girder centerline', 'cf.dia.aj', 'in')}</div>
+        ${secHd('sec-cfd', 'Diaphragm (channel or rolled W) in place of the cross-frame')}<div class="sec-body" id="sec-cfd">${fld('Intermediate bracing used', 'cf.dia.on', '', 'sel', { options: [['no', 'Cross-frame (angles)'], ['yes', 'Diaphragm: channel (C, MC) or rolled W']] })}${fld('Shape (nominal dimensions)', 'cf.dia.shape', '', 'sel', { options: CF_DIA.map(s => [s[0], s[0]]).concat(CF_CH.map(s => [s[0], `${s[0]} (channel)`]), [['custom', 'Custom W (enter below)']]) })}${fld('Depth d', 'cf.dia.d', 'in')}${fld('Flange width b<sub>f</sub>', 'cf.dia.bf', 'in')}${fld('Flange thickness t<sub>f</sub>', 'cf.dia.tf', 'in')}${fld('Web thickness t<sub>w</sub>', 'cf.dia.tw', 'in')}${fld('Grade', 'cf.dia.gr', '', 'sel', { options: [['36', '36'], ['50', '50']] })}${fld('Bolts per end (one vertical line)', 'cf.dia.nb', '')}${fld('Bolt pitch', 'cf.dia.pitch', 'in')}${fld('Bolt line to girder web', 'cf.dia.ecc', 'in')}${fld('End diaphragm (jacking)', 'cf.dia.end', '', 'sel', { options: [['no', 'No'], ['yes', 'Yes']] })}${fld('Jacking reaction per jack, 1.3 × permanent (3.4.3.1)', 'cf.dia.Rj', 'kip')}${fld('Jack offset from girder centerline', 'cf.dia.aj', 'in')}<p class="note full">With the diaphragm selected it is the design: the angle checks (CF1 to CF9) are not used and CFD governs. Auto-design selects the diaphragm when the girder depth d is below the minimum for cross-frames (double-click the "Intermediate bracing used" label to lock the choice), choosing the lightest channel, then W, at least 0.75 d deep (6.7.4.2, plate girders) that passes every CFD item, and the bolts (one vertical row). Assumptions to verify: web bolted to the connection plate with one vertical row of bolts; diaphragm centered on the web depth; member ends 1.5 in past the bolt line; end (bearing-line) diaphragms are not covered here.</p></div>
         ${secHd('sec-cfc', 'End connections')}<div class="sec-body" id="sec-cfc">${fld('Bolt diameter', 'cf.conn.d', '', 'sel', { options: [['0.875', '7/8 in'], ['1', '1 in']] })}${fld('Grade', 'cf.conn.gr', '', 'sel', { options: [['A325', 'F3125 A325'], ['A490', 'F3125 A490']] })}
         ${fld('Threads', 'cf.conn.thr', '', 'sel', { options: [['incl', 'Included'], ['excl', 'Excluded']] })}${fld('Bolts per member end', 'cf.conn.n', '')}${fld('Pitch', 'cf.conn.s', 'in', 'dim')}${fld('End distance', 'cf.conn.e', 'in', 'dim')}${fld('Gusset thickness', 'cf.conn.tg', 'in', 'dim')}
         <p class="note">One line of bolts through the connected leg, single shear, standard holes.</p></div>` }; },
@@ -2832,34 +2850,39 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
         note: 'Force ranges from a refined analysis of the fatigue truck (a line-girder analysis gives none). γ = 1.75 × 0.65 for Fatigue I per the 10th Edition cross-frame provisions (NCHRP 12-113).' };
       const Ms = M.filter(m => m.dP > 0); if (!Ms.length) c.naWhy = 'No fatigue force ranges entered (from a refined analysis).';
       Ms.forEach(m => c.items.push(rc(`${m.l} (${m.name})`, [f2(m.dP), f2(m.df), f2(R.FT), f2(m.df / R.FT)], m.df, R.FT, T`${f3(R.gF)}\frac{${f2(m.dP)}}{${f2(m.A)}} = ${f2(m.df)} \;${LE(m.df, R.FT)}\; ${f2(R.FT)}\ \text{ksi}`))); out.add(c); }
+    if (cfDiaOn(R.p)) out.forEach(c => { if (/^CF[1-9]$/.test(c.id)) { c.items = []; c.status = 'na'; c.gov = -1; c.naWhy = 'Not used: diaphragm selected (the intermediate bracing is the channel or rolled W diaphragm, check CFD).'; } });
     cfDiaChecks(R, out);
     { const TR = cfTypeRec(R.p), c = { id: 'CF10', grp: 'Bracing type', title: 'Intermediate bracing type for the girder depth', ref: 'Common practice (e.g. AISC/NSBA G13.1 guidance; owner standards govern); AASHTO LRFD 6.7.4.2', src: 'Practice',
-        sym: T`d \ge d_{min} = ${f2(TR.dMin)}\ \text{in} \Rightarrow \text{cross-frame}; \qquad d < d_{min} \Rightarrow \text{channel (C, MC) or rolled W diaphragm}`, cols: ['Girder depth d', 'Minimum for cross-frames', 'Recommended', 'Selected'], items: [],
-        note: 'Basis: the girder depth d (out-to-out of the flanges, the "Girder depth d" input), not the web depth. Below the minimum, a cross-frame is too shallow for efficient diagonals, so a channel (depth about half the girder depth or more) or a rolled W diaphragm is used; the selected type is never changed automatically. The rolled or channel diaphragm is checked on the Members tab (Rolled or channel diaphragm alternative).' };
+        sym: T`d \ge d_{min} = ${f2(TR.dMin)}\ \text{in} \Rightarrow \text{cross-frame}; \qquad d < d_{min} \Rightarrow \text{channel (C, MC) or rolled W diaphragm},\ d_{dia} \ge 0.75d`, cols: ['Girder depth d', 'Minimum for cross-frames', 'Recommended', 'Selected'], items: [],
+        note: 'Basis: the girder depth d (out-to-out of the flanges, the "Girder depth d" input), not the web depth. Below the minimum, a cross-frame is too shallow for efficient diagonals, so a channel or a rolled W diaphragm at least 0.75 of the girder depth (6.7.4.2, plate girders) is used: the lightest channel, else the lightest W. Auto-design selects the diaphragm below the minimum, designs it, and switches back to the cross-frame at or above it, unless the "Intermediate bracing used" input is locked. The diaphragm is checked as CFD (Members tab, Diaphragm section).' };
       c.items.push({ loc: 'Intermediate bracing', cells: [`${f2(TR.dg)} in`, `${f2(TR.dMin)} in`, TR.rec, TR.sel], st: TR.deep || !TR.xf ? 'pass' : 'warn',
         work: TR.deep ? T`d = ${f2(TR.dg)} \ge ${f2(TR.dMin)}\ \text{in: cross-frames}` : T`d = ${f2(TR.dg)} < ${f2(TR.dMin)}\ \text{in: ${TR.xf ? 'cross-frame selected; a channel or rolled diaphragm is recommended' : 'diaphragm selected'}}` });
       out.add(c); }
     return out;
   },
-  kq(R) { return [['Type', { X: 'X-frame', Kb: 'K-frame (bottom)', Kt: 'K-frame (top)' }[R.p.type]], ['Members', Object.values(R.mem).map(m => m.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')], ['Wind force, Strength III', `${f2(R.W.III.Fw)} kip`], ['Bolts', `${R.n} × ${frac(R.bolt.d)} in per end`]]; },
+  kq(R) { if (cfDiaOn(R.p)) { const q = R.p.dia, X = cfDiaSec(q); return [['Type', `${X.chS ? 'Channel' : 'Rolled'} diaphragm ${X.nm_}`], ['Depth', `${f2(X.d)} in (0.75 d = ${f2(0.75 * nm(R.p.dg))} in)`], ['Wind force, Strength III', `${f2(R.W.III.Fw)} kip`], ['Bolts', `${Math.max(2, Math.round(+q.nb || 2))} × ${frac(R.bolt.d)} in per end, one row at ${f2(+q.pitch || 3)} in`]]; }
+    return [['Type', { X: 'X-frame', Kb: 'K-frame (bottom)', Kt: 'K-frame (top)' }[R.p.type]], ['Members', Object.values(R.mem).map(m => m.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')], ['Wind force, Strength III', `${f2(R.W.III.Fw)} kip`], ['Bolts', `${R.n} × ${frac(R.bolt.d)} in per end`]]; },
   scope: ['Refined analysis of skewed or curved framing (enter those member forces directly)', 'Gusset plate and connection plate design (see the Transverse stiffeners module for connection plate welds)', 'Slip resistance of the bolted connections', 'Tension-only diagonals', 'WT and double-angle members'],
   combos(R) { const w = R.W; let h = card('cb-w', 'Wind load on the exterior girder', 'AASHTO LRFD 3.8.1.2.1, 4.6.2.7.1', eq('Strength III', '', T`P_Z = 2.56\times10^{-6}(${f0(w.III.V)})^2(${f2(nm(R.p.wind.Kz))})(${f2(nm(R.p.wind.G))})(${f2(nm(R.p.wind.Cd))}) = ${w.III.PZ.toFixed(4)}\ \text{ksf}, \quad W = \frac{1.0\,P_Zd}{2} = \frac{${w.III.PZ.toFixed(4)}(${f3(R.dft)})}{2} = ${f3(w.III.W)}\ \text{kip/ft}, \quad F_w = WL_b = ${f3(w.III.W)}(${f2(R.Lb)}) = ${f2(w.III.Fw)}\ \text{kip}`)
       + eq('Strength V', '', T`P_Z = 2.56\times10^{-6}(80)^2(${f2(nm(R.p.wind.Kz))})(${f2(nm(R.p.wind.G))})(${f2(nm(R.p.wind.Cd))}) = ${w.V.PZ.toFixed(4)}\ \text{ksf}, \quad F_w = \frac{${w.V.PZ.toFixed(4)}(${f3(R.dft)})}{2}(${f2(R.Lb)}) = ${f2(w.V.Fw)}\ \text{kip}`)
       + `<p class="note-p">F<sub>w</sub> is applied horizontally at the bottom flange of the exterior girder; the top chord work points are held by the deck. Wind can act in either direction, so each member is designed for its analysis force plus and minus the wind force.</p>`);
     h += card('cb-t', 'Member forces from the truss model', 'Direct stiffness, pinned joints', `<div class="tscroll"><table class="tbl"><thead><tr><th>Member</th><th class="right">Length (in)</th><th class="right">Force per kip of F<sub>w</sub></th>${R.combos.map(c => `<th class="right">${c.id} T / C (kip)</th>`).join('')}</tr></thead><tbody>${R.frames.map((e, i) => `<tr><td class="lbl">${e.lbl}</td><td class="val">${f2(e.L)}</td><td class="val">${f3(e.unit)}</td>${R.combos.map(c => `<td class="val">${f2(c.f[i].T)} / ${f2(c.f[i].Cc)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
-      <p class="note-p">T and C are the governing tension and compression in each combination: analysis force ± |wind force|.</p>`);
+      <p class="note-p">T and C are the governing tension and compression in each combination: analysis force ± |wind force|.${cfDiaOn(R.p) ? ' <b>Diaphragm selected:</b> these truss forces are not used; the wind force F<sub>w</sub> above is checked on the diaphragm in CFD.' : ''}</p>`);
     return h; },
-  drawings(R) { return card('dw-cf', 'Cross-frame elevation', 'To scale; Strength III wind forces', `<div class="dwg-wrap">${cfSVG(R)}</div><p class="cap">Force labels: Strength III wind force per member (tension +) for wind toward the interior girder.</p>`); },
+  drawings(R) { if (cfDiaOn(R.p)) return card('dw-cf', 'Diaphragm elevation', 'To scale; nominal dimensions', `<div class="dwg-wrap">${cfDiaSVG(R)}</div><p class="cap">Diaphragm centered on the girder depth, web bolted to the connection plates with one vertical row of bolts (assumed detail; verify). F<sub>w</sub>: governing Strength III or V wind force at the exterior girder bottom flange.</p>`);
+    return card('dw-cf', 'Cross-frame elevation', 'To scale; Strength III wind forces', `<div class="dwg-wrap">${cfSVG(R)}</div><p class="cap">Force labels: Strength III wind force per member (tension +) for wind toward the interior girder.</p>`); },
   echo(R) { return { kv: [['Type', { X: 'X-frame', Kb: 'K-frame, diagonals meet at the bottom chord', Kt: 'K-frame, diagonals meet at the top chord' }[R.p.type]], ['S / h / d / L_b', `${f2(R.S)} in / ${f2(R.h)} in / ${f2(nm(R.p.dg))} in / ${f2(R.Lb)} ft`], ['Wind V, K_z, G, C_D', `${f0(nm(R.p.wind.V))} mph, ${R.p.wind.Kz}, ${R.p.wind.G}, ${R.p.wind.Cd}`], ['Grades: angles / gusset', `${R.p.gA} / ${R.p.gG}`],
       ...Object.values(R.mem).map(m => [m.l, m.name]), ['Bolts', `${R.n} × ${frac(R.bolt.d)} in ${R.p.conn.gr} per end, pitch ${frac(R.s)}, end ${frac(R.e0)}, gusset ${frac(R.tg)} in`],
-      ['User forces Str I (top/bot/diag)', `${R.p.user.StrI.top} / ${R.p.user.StrI.bot} / ${R.p.user.StrI.diag}`, 'kip'], ['User forces Con (top/bot/diag)', `${R.p.user.Con.top} / ${R.p.user.Con.bot} / ${R.p.user.Con.diag}`, 'kip']] }; },
+      ['User forces Str I (top/bot/diag)', `${R.p.user.StrI.top} / ${R.p.user.StrI.bot} / ${R.p.user.StrI.diag}`, 'kip'], ['User forces Con (top/bot/diag)', `${R.p.user.Con.top} / ${R.p.user.Con.bot} / ${R.p.user.Con.diag}`, 'kip'],
+      ...(cfDiaOn(R.p) ? (q => [['Intermediate bracing used', `diaphragm ${cfDiaSec(q).nm_}, grade ${q.gr}; ${Math.max(2, Math.round(+q.nb || 2))} bolts per end at ${f2(+q.pitch || 3)} in, ${f2(+q.ecc || 0)} in from the girder web (the angles above are not used)`]])(R.p.dia) : [])] }; },
   inbox(j) { const s = j && j.mods && j.mods.cf; return s ? { n: 1, what: 'cross-frame geometry and deck-placement bracing', apply: () => Object.assign(P.cf, { ...s, sb: { ...P.cf.sb, ...(s.sb || {}) } }) } : null; }
 };
 /* recommended intermediate bracing type from the girder depth (2026-10-12): cross-frame at or above the minimum depth (X or K by S/h, as the auto-design does),
-   otherwise the lightest channel at least half the girder depth, or else the lightest W at least half the girder depth */
+   otherwise the lightest channel at least 0.75 of the girder depth, or else the lightest W at least 0.75 of the girder depth
+   (AASHTO LRFD 6.7.4.2: 0.75 of the girder depth for plate girders; half the girder depth until the engineer's decision of 2026-10-12) */
 function cfTypeRec(p) {
   const dg = nm(p.dg), dMin = nm(p.dMinXF), S = nm(p.S), h = nm(p.h), deep = dg >= dMin - 1e-9, xf = (p.dia || {}).on !== 'yes';
-  const ch = CF_CH.filter(s => s[1] >= 0.5 * dg - 1e-9).sort((a, b) => (2 * a[2] * a[3] + (a[1] - 2 * a[3]) * a[4]) - (2 * b[2] * b[3] + (b[1] - 2 * b[3]) * b[4]))[0], w = CF_DIA.find(s => s[1] >= 0.5 * dg - 1e-9);
+  const ch = CF_CH.filter(s => s[1] >= 0.75 * dg - 1e-9).sort((a, b) => (2 * a[2] * a[3] + (a[1] - 2 * a[3]) * a[4]) - (2 * b[2] * b[3] + (b[1] - 2 * b[3]) * b[4]))[0], w = CF_DIA.find(s => s[1] >= 0.75 * dg - 1e-9);
   const rec = deep ? `${S / h > 1.5 ? 'K (bottom)' : 'X'}-frame (S/h = ${f2(S / h)})` : ch ? `channel diaphragm ${ch[0]} (or a rolled W)` : w ? `rolled diaphragm ${w[0]}` : 'rolled W diaphragm';
   const sel = xf ? ({ X: 'X-frame', Kb: 'K-frame', Kt: 'K-frame' }[p.type] || 'cross-frame') : `${CF_CH.some(s => s[0] === (p.dia || {}).shape) ? 'channel' : 'rolled'} diaphragm ${(p.dia || {}).shape === 'custom' ? 'custom W' : (p.dia || {}).shape}`;
   return { dg, dMin, deep, xf, rec, sel, ch: ch && ch[0], w: w && w[0] };
@@ -2877,6 +2900,24 @@ function cfSVG(R) {
   return `<svg viewBox="0 0 ${Wpx} ${Y(0) + 60}" class="dwg" role="img" aria-label="Cross-frame"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#c0392b"/></marker></defs>${o}</svg>`;
 }
 
+/* diaphragm elevation (cf.dia.on = 'yes'): channel or W centered on the girder depth, web bolted to the connection plates with one vertical row */
+function cfDiaSVG(R) {
+  const q = R.p.dia, X = cfDiaSec(q), dg = nm(R.p.dg), S = R.S, SB = R.SB, Wpx = 900, sc = Math.min(700 / S, 360 / dg), Xp = x => 100 + x * sc, Yp = y => 40 + (dg - y) * sc;
+  const bfT = SB ? SB.bc : 12, bfB = SB ? SB.bt : 12, tT = SB ? SB.tc : 0.75, tB = SB ? SB.tt : 1, ft = t => Math.max(3, t * sc), gap = cfDiaGap(q), ecc = +q.ecc || 3.5, y0 = (dg - X.d) / 2, y1 = y0 + X.d;
+  const nb = Math.max(2, Math.round(+q.nb || 2)), s = +q.pitch || 3, rb = Math.max(2.5, ((+((R.p.conn || {}).d) || 0.875) / 2) * sc);
+  const wk = R.W.III.Fw >= R.W.V.Fw ? 'III' : 'V', Fw = R.W[wk].Fw; let o = '';
+  [0, S].forEach((x, i) => { const sg = i ? -1 : 1;
+    o += `<rect x="${Xp(x - bfB / 2)}" y="${Yp(0) - ft(tB)}" width="${bfB * sc}" height="${ft(tB)}" fill="${DC.stl}" stroke="${DC.stlS}" stroke-width="1.5"/><rect x="${Xp(x - bfT / 2)}" y="${Yp(dg)}" width="${bfT * sc}" height="${ft(tT)}" fill="${DC.stl}" stroke="${DC.stlS}" stroke-width="1.5"/>`;
+    o += `<path d="M${Xp(x)} ${Yp(dg)}V${Yp(0)}" stroke="${DC.stlS}" stroke-width="3"/><rect x="${Math.min(Xp(x), Xp(x + sg * 0.5))}" y="${Yp(dg) + ft(tT)}" width="${Math.max(2, 0.5 * sc)}" height="${Yp(0) - Yp(dg) - ft(tT) - ft(tB)}" fill="none" stroke="${DC.plS}" stroke-width="1"/>`; });
+  o += `<rect x="${Xp(gap)}" y="${Yp(y1)}" width="${(S - 2 * gap) * sc}" height="${X.d * sc}" fill="${DC.inn}" fill-opacity="0.6" stroke="${DC.innS}" stroke-width="2"/>`;
+  [y0 + X.tf, y1 - X.tf].forEach(y => o += `<path d="M${Xp(gap)} ${Yp(y)}H${Xp(S - gap)}" stroke="${DC.innS}" stroke-width="1"/>`);
+  [ecc, S - ecc].forEach(x => { for (let i = 0; i < nb; i++) o += `<circle cx="${Xp(x)}" cy="${Yp(dg / 2 + (i - (nb - 1) / 2) * s)}" r="${rb}" fill="${DC.bolt}"/>`; });
+  o += `<text x="${Xp(S / 2)}" y="${Yp(dg / 2) + 4}" class="sv-t" text-anchor="middle" style="paint-order:stroke;stroke:#fff;stroke-width:4px">${X.chS ? 'Channel' : 'Rolled'} diaphragm ${X.nm_}; ${nb} bolts per end at ${f2(s)} in</text>`;
+  o += `<path d="M${Xp(0) - 70} ${Yp(0)}H${Xp(0) - 8}" stroke="#c0392b" stroke-width="2" marker-end="url(#ar)"/><text x="${Xp(0) - 95}" y="${Yp(0) + 18}" class="sv-t sv-sm">F<tspan baseline-shift="sub" font-size="8">w</tspan> = ${f2(Fw)} kip (Str ${wk})</text>`;
+  o += dimH(Xp(0), Xp(S), Yp(0) + 34, `S = ${f2(S)} in`) + dimV(Xp(S) + 40, Yp(y1), Yp(y0), `d = ${f2(X.d)} in`, false) + dimV(Xp(S) + 110, Yp(dg), Yp(0), `girder d = ${f2(dg)} in`, false);
+  return `<svg viewBox="0 0 ${Wpx} ${Yp(0) + 60}" class="dwg" role="img" aria-label="Diaphragm"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#c0392b"/></marker></defs>${o}</svg>`;
+}
+
 /* =====================================================================
    OH: deck overhang constructibility
    ===================================================================== */
@@ -5152,6 +5193,12 @@ AD.wt = () => { const S = std(), W = P.wt, out = [], D = k => parseDim(k);
   return out; };
 AD.cf = () => { const C0 = P.cf, out = [], D = k => parseDim(k), area = n => { const [b1, b2, t] = ANGLES[n]; return t * (b1 + b2 - t); };
   const names = Object.keys(ANGLES).sort((a, b) => area(a) - area(b)), setMem = (k, n) => { const [b1, b2, t] = ANGLES[n]; C0.mem[k] = { sec: n, b1, b2, t }; };
+  // bracing type from the girder depth (engineer's decision 2026-10-12): below the minimum for cross-frames a diaphragm is designed and used; at or above it the cross-frame.
+  // An unlocked choice is auto-designed like every other input; double-click "Intermediate bracing used" to lock it.
+  { const TR = cfTypeRec(C0), q = C0.dia = C0.dia || {}, lk = adLocked('cf.dia.on');
+    if (!lk && !TR.deep && q.on !== 'yes') { q.on = 'yes'; out.push(`Girder depth d = ${f2(TR.dg)} in is below the ${f2(TR.dMin)} in minimum for cross-frames: the cross-frame was replaced by a diaphragm`); }
+    else if (!lk && TR.deep && q.on === 'yes') { q.on = 'no'; out.push(`Girder depth d = ${f2(TR.dg)} in is at or above the ${f2(TR.dMin)} in minimum for cross-frames: the diaphragm was replaced by a cross-frame`); }
+    if (q.on === 'yes') return adCfDia(C0, out, TR, lk); }
   if (!adLocked('cf.type')) { const S = D(C0.S), h = D(C0.h); C0.type = S / h > 1.5 ? 'Kb' : 'X'; }   // K-frame: diagonals meet at the bottom chord (engineer's decision 2026-10-12; was the invalid 'K', computed as Kt)
   const keys = ['diag', 'top', 'bot'], ids = ['CF1', 'CF2', 'CF3', 'CF4', 'CF5', 'CF6', 'CF7', 'CF9']; let done = null;
   for (let n = 2; n <= 6 && !done; n++) { if (adLocked('cf.conn.n') && n !== D(C0.conn.n)) continue; C0.conn.n = n; let ok = true;
@@ -5171,11 +5218,36 @@ AD.cf = () => { const C0 = P.cf, out = [], D = k => parseDim(k), area = n => { c
     const S = r.R.SB; if (S.bg < S.bReq) { out.push(`The girders' in-plane stiffness β_g = ${f0(S.bg)} kip-in/rad is below the requirement ${f0(S.bReq)}: stiffer cross-frames cannot satisfy CF8 (the system buckles as a unit); more girders, a shorter span, or top lateral bracing is needed`); break; }
     const up = k => { if (adLocked(`cf.mem.${k}.sec`)) return false; const i = names.indexOf(C0.mem[k].sec); if (i < 0 || i >= names.length - 1) return false; setMem(k, names[i + 1]); return true; };
     const hk = C0.type === 'X' ? null : C0.type === 'Kb' ? 'top' : 'bot', a = up('diag'), b = hk ? up(hk) : false; if (!a && !b) { out.push('The largest standard angles do not satisfy CF8'); break; } }
-  { const TR = cfTypeRec(C0); if (!TR.deep) out.push(`Girder depth ${f2(TR.dg)} in is below the ${f2(TR.dMin)} in minimum for cross-frames: a ${TR.rec} is recommended${TR.xf ? ' (the cross-frame type is kept; turn on the rolled or channel diaphragm on the Members tab to check one)' : ''}`); }
+  { const TR = cfTypeRec(C0); if (!TR.deep) out.push(`Girder depth ${f2(TR.dg)} in is below the ${f2(TR.dMin)} in minimum for cross-frames: a ${TR.rec} is recommended${TR.xf ? ' (the cross-frame is kept because "Intermediate bracing used" is locked)' : ''}`); }
   const r = adEval('cf'), S = r && r.R.SB;
   out.push(`${C0.type === 'X' ? 'X' : C0.type === 'Kt' ? 'K (top)' : 'K (bottom)'}-frame (S/h = ${f2(D(C0.S) / D(C0.h))}${adLocked('cf.type') ? ', type locked' : ''}); top chord ${C0.mem.top.sec}, bottom chord ${C0.mem.bot.sec}, diagonals ${C0.mem.diag.sec}; ${C0.conn.n} bolts per member end`);
   if (S) out.push(`Bracing stiffness β_T = ${f0(S.bT)} kip-in/rad against ${f0(S.bReq)} required (ratio ${f2(S.bReq / S.bT)})`);
   return out; };
+/* diaphragm design (cf.dia.on = 'yes'): the lightest channel, then W, at least 0.75 of the girder depth (6.7.4.2, plate girders) that passes every CFD item,
+   with the fewest bolts in one vertical row; the angle inputs are left as they are (not used). Locked shape, bolt count, and pitch are kept. */
+const adCfDia = (C0, out, TR, lk) => { const q = C0.dia, dg = TR.dg, need = 0.75 * dg, D = k => parseDim(k), cw = s => 2 * s[2] * s[3] + (s[1] - 2 * s[3]) * s[4];
+  const db = D((C0.conn || {}).d) || 0.875, em = (BOLT[(C0.conn || {}).d] || BOLT['0.875']).emin.cut, lkS = adLocked('cf.dia.shape'), lkN = adLocked('cf.dia.nb'), lkP = adLocked('cf.dia.pitch');
+  const all = [...CF_CH.slice().sort((a, b) => cw(a) - cw(b)), ...CF_DIA], deepEnough = all.filter(s => s[1] >= need - 1e-9);
+  const cands = lkS ? [CF_CH.find(s => s[0] === q.shape) || CF_DIA.find(s => s[0] === q.shape) || ['custom', D(q.d), D(q.bf), D(q.tf), D(q.tw)]] : deepEnough.length ? deepEnough : [CF_DIA[CF_DIA.length - 1]];
+  if (!lkP) q.pitch = Math.max(3, uInc(3 * db, 0.25)); const s = D(q.pitch);
+  const nMax = sec => Math.max(2, Math.floor((sec[1] - 2 * sec[3] - 1.0 - 2 * em) / s + 1e-9) + 1), skipped = [];
+  const failsOf = r => { const c = r && r.C.find(x => x.id === 'CFD'); return c ? c.items.filter(i => !AD_OK.includes(i.st)).map(i => i.loc.replace(/ \(.*$/, '')) : ['input errors']; };
+  // a torsional-brace stiffness shortfall that no diaphragm can fix (β_sec and β_g in series below the requirement even with a rigid brace) is reported, not chased with ever larger sections (as for the angles and CF8)
+  const sysMax = r => { const S = r && r.R.SB; return S ? 1 / ((isFinite(S.bsec) ? 1 / S.bsec : 0) + 1 / S.bg) : Infinity; }, sysOut = r => { const S = r && r.R.SB; return !!S && sysMax(r) < S.bReq; }, isK = i => i.loc.startsWith('Torsional brace system stiffness'), isDep = i => !deepEnough.length && i.loc.startsWith('Depth');   // no listed section is deep enough: the depth item warns, the rest decide
+  let done = null, sys = null;
+  for (const sec of cands) { if (!lkS) q.shape = sec[0]; let last = null;
+    for (let n = lkN ? D(q.nb) : 2; n <= (lkN ? D(q.nb) : nMax(sec)); n++) { q.nb = n; const r = adEval('cf'); last = r; if (r && sysOut(r)) sys = r.R.SB; if (r && adGood(r.C, ['CFD'], i => !(sysOut(r) && isK(i)) && !isDep(i))) { done = { sec, n }; break; } }
+    if (done) break; skipped.push(`${sec[0]} (${[...new Set(failsOf(last))].join(', ')})`); }
+  if (!lkS) { const lighter = all.slice(0, all.findIndex(x => x[0] === (done ? done.sec[0] : cands[cands.length - 1][0]))).filter(x => x[1] < need - 1e-9);
+    if (lighter.length && deepEnough.length) out.push(`Lighter sections are shallower than 0.75 d = ${f2(need)} in (6.7.4.2, plate girders): ${lighter.map(x => `${x[0]} ${f2(x[1])} in`).join(', ')}`); }
+  if (!deepEnough.length && !lkS) out.push(`No channel or W in the list is at least 0.75 d = ${f2(need)} in deep; the deepest (${CF_DIA[CF_DIA.length - 1][0]}) is used and the depth item warns`);
+  if (!done) { const big = cands[cands.length - 1]; if (!lkS) q.shape = big[0]; if (!lkN) q.nb = nMax(big); const r = adEval('cf');
+    out.push(`No ${lkS ? 'bolt count for the locked shape' : 'channel or W at least 0.75 d deep'} passes every diaphragm check (CFD): ${skipped.join('; ')}. ${lkS ? 'The locked shape' : `The largest, ${big[0]},`} with ${q.nb} bolts per end was left in place to show the remaining ratios${r ? `; still failing: ${[...new Set(failsOf(r))].join(', ')}` : ''}`); return out; }
+  if (skipped.length) out.push(`Deep enough but failing a CFD item: ${skipped.join('; ')}`);
+  const r = adEval('cf'), c = r && r.C.find(x => x.id === 'CFD'), g = c && c.items[c.gov];
+  if (sys) out.push(`Torsional brace system stiffness (CFD) cannot be met by any diaphragm: with a rigid brace, β_sec = ${isFinite(sys.bsec) ? f0(sys.bsec) : '∞'} and β_g = ${f0(sys.bg)} kip-in/rad in series give at most ${f0(1 / ((isFinite(sys.bsec) ? 1 / sys.bsec : 0) + 1 / sys.bg))} against β_T,req = ${f0(sys.bReq)} kip-in/rad (C = ${f2(sys.Cs)}; the 0.8 D bracing-depth test uses the chord work-point depth h = ${f2(D(C0.h))} in against D = ${f2(sys.Dg)} in). ${sys.bg < sys.bReq ? 'The girders\' in-plane stiffness β_g is itself below the requirement: more girders, a shorter span, or top lateral bracing is needed' : 'Web distortion governs: full-depth connection plates, a wider or thicker connection plate, or a bracing depth of at least 0.8 D is needed'}. The section below passes every other CFD item; CFD still fails on the stiffness`);
+  out.push(`${CF_CH.some(x => x[0] === q.shape) ? 'Channel' : 'Rolled'} diaphragm ${q.shape} (d = ${f2(done.sec[1])} in ${done.sec[1] >= need - 1e-9 ? "≥" : "<"} 0.75 d = ${f2(need)} in${lkS ? ', shape locked' : ''}${lk ? ', bracing type locked' : ''}): the lightest channel or W that passes every CFD item${sys ? ' other than the system stiffness' : ''}; ${q.nb} - ${frac(db)} in bolts per end in one vertical row at ${f2(s)} in${g ? `; governing: ${g.loc.replace(/ \(.*$/, '')}, ratio ${g.r != null ? f2(g.r) : '—'}` : ''}`);
+  return out; };
 AD.oh = () => { const O = P.oh, out = [], D = k => parseDim(k);
   O.rows.forEach((row, ri) => { const pre = `oh.rows.${ri}.`, mine = i => String(i.loc).startsWith(row.name || ''), cur = D(row.Lb); if (adLocked(pre + 'Lb')) { out.push(`${row.name}: L_b locked at ${f2(cur)} ft`); return; }
     let best = null; for (let L = 5; L <= 40 + 1e-9; L += 0.5) { row.Lb = L; const r = adEval('oh'); if (r && adGood(r.C, ['OH1', 'OH2', 'OH3', 'OH4', 'OH5'], mine)) best = L; else if (best !== null) break; }
@@ -5253,7 +5325,9 @@ function designAllRun0(j, quiet) {
   let bsN = 0, bsLb = 0; P.bs.rows.forEach(r => { const t = P.bs.types[r.type]; if (!t) return; const c = cnt(r.name); bsN += c * parseDim(t.np) * 2; bsLb += c * parseDim(t.np) * 2 * parseDim(t.bt) * parseDim(t.tp) * D * lbS; }); add('Bearing stiffeners', bsN, 'plates', bsLb * S.cDet);
   const scE = adEval('sc'); let studs = 0; if (scE) { const R = scE.R; R.zones.forEach(z => { studs += z.nr * Math.floor((z.x2 - z.x1) * 12 / z.p + 1e-6); R.gaps.forEach(gp => { const L = Math.max(0, Math.min(z.x2, gp.b) - Math.max(z.x1, gp.a)); if (L > 0) studs -= z.nr * Math.ceil(L * 12 / z.p - 1e-6); }); }); }
   studs *= nb; add('Shear studs', studs, 'each', studs * S.cStud);
-  const cfE = adEval('cf'); if (cfE) { const R = cfE.R, nF = Math.max(0, (q.frames || 0) - (q.framesSup || 0)), lbF = R.frames.reduce((a, e) => a + e.L * R.mem[e.k].A * lbS, 0), bF = R.frames.length * 2 * parseDim(P.cf.conn.n);
+  const cfE = adEval('cf'); if (cfE && cfDiaOn(P.cf)) { const R = cfE.R, dq = P.cf.dia, X = cfDiaSec(dq), nF = Math.max(0, (q.frames || 0) - (q.framesSup || 0)), Ld = Math.max(0, R.S - 2 * cfDiaGap(dq)), lbD = X.A * Ld * lbS, bD = 2 * Math.max(2, Math.round(+dq.nb || 2));   // diaphragm selected: steel from the nominal area over S less the end gaps, and its bolts
+    add(`Intermediate diaphragms (${nF}, ${X.nm_}, ${f2(Ld / 12)} ft at ${f2(X.wpf)} lb/ft): steel`, nF * lbD / 1000, 'kip', nF * lbD * S.cDet); add('Diaphragms: bolts', nF * bD, 'each', nF * bD * S.cBolt); }
+  else if (cfE) { const R = cfE.R, nF = Math.max(0, (q.frames || 0) - (q.framesSup || 0)), lbF = R.frames.reduce((a, e) => a + e.L * R.mem[e.k].A * lbS, 0), bF = R.frames.length * 2 * parseDim(P.cf.conn.n);
     add(`Intermediate cross-frames (${nF}): members`, nF * lbF / 1000, 'kip', nF * lbF * S.cDet); add('Cross-frames: bolts', nF * bF, 'each', nF * bF * S.cBolt); }
   const total = cost.reduce((a, c) => a + c.c, 0);
   // 6. geometry conflicts
@@ -5649,6 +5723,14 @@ function dxfCF(D, C) {
   const S = +p.S, hh = +p.h, tf = m.top[0], bf = m.bot[0], Dm = m.D, Dt = Dm + tf.t + bf.t, yb = (Dt - hh) / 2, yt = yb + hh, tw = m.web[0].t, cn = p.conn || {}, rb = (+cn.d || 0.875) / 2 + 0.0625;
   [0, S].forEach(x => { D.rect(ly.g, x - bf.b / 2, 0, x + bf.b / 2, bf.t); D.rect(ly.g, x - tw / 2, bf.t, x + tw / 2, bf.t + Dm); D.rect(ly.g, x - tf.b / 2, bf.t + Dm, x + tf.b / 2, Dt);
     const sg = x === 0 ? 1 : -1; D.rect(ly.cp, x + sg * tw / 2, bf.t, x + sg * (tw / 2 + 0.5), bf.t + Dm); D.line(ly.c, x, -2 * h, x, Dt + 2 * h, cl); });
+  const dOn = cfDiaOn(p);
+  if (dOn) { const q = p.dia, X = cfDiaSec(q), g = tw / 2 + cfDiaGap(q), y0 = (Dt - X.d) / 2, y1 = y0 + X.d, ec = +q.ecc || 3.5, nb = Math.max(2, Math.round(+q.nb || 2)), s0 = +q.pitch || 3;   // diaphragm selected: channel or W centered on the girder depth, web bolted to the connection plates
+    D.rect(ly.x, g, y0, S - g, y1); D.line(ly.x, g, y0 + X.tf, S - g, y0 + X.tf); D.line(ly.x, g, y1 - X.tf, S - g, y1 - X.tf); D.line(ly.c, 0, Dt / 2, S, Dt / 2, cl);
+    [ec, S - ec].forEach(x => { for (let i = 0; i < nb; i++) D.circle(ly.bo, x, Dt / 2 + (i - (nb - 1) / 2) * s0, rb); });
+    D.text(ly.t, S / 2 - 12 * h, y1 + 1.2 * h, h * 0.8, dxfStr(`${X.nm_}`));
+    D.dimH(ly.d, 0, S, Dt + 4 * h, Dt, 'GIRDER SPACING <>'); D.dimV(ly.d, y0, y1, S + tf.b / 2 + 4 * h, S, 'DIAPHRAGM <>'); D.dimV(ly.d, 0, y0, S + tf.b / 2 + 4 * h, S); D.dimH(ly.d, 0, ec, y0 - 3 * h, y0, '<>');
+    D.text(ly.t, 0, Dt + 8 * h, h * 1.3, `INTERMEDIATE DIAPHRAGM (${X.chS ? 'CHANNEL' : 'ROLLED W'})`); }
+  else {
   const memb = p.type === 'Kb' || p.type === 'K' ? [['top', [0, yt], [S, yt]], ['bot', [0, yb], [S, yb]], ['diag', [0, yt], [S / 2, yb]], ['diag', [S, yt], [S / 2, yb]]]
     : p.type === 'Kt' ? [['bot', [0, yb], [S, yb]], ['top', [0, yt], [S, yt]], ['diag', [0, yb], [S / 2, yt]], ['diag', [S, yb], [S / 2, yt]]] : [['bot', [0, yb], [S, yb]], ['top', [0, yt], [S, yt]], ['diag', [0, yb], [S, yt]], ['diag', [0, yt], [S, yb]]];
   memb.forEach(([k, a, b]) => { const mm = p.mem[k] || {}, L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nv = [-u[1], u[0]], w = +mm.b1 || 4;
@@ -5657,7 +5739,7 @@ function dxfCF(D, C) {
     const n = Math.max(1, +cn.n || 2); [a2].concat(b[0] === S / 2 ? [] : [b2]).forEach((q, e) => { const sgn = e ? -1 : 1; for (let i = 0; i < n; i++) D.circle(ly.bo, q[0] + sgn * u[0] * ((+cn.e || 1.5) + i * (+cn.s || 3)), q[1] + sgn * u[1] * ((+cn.e || 1.5) + i * (+cn.s || 3)), rb); });
     const mid = [(a[0] + b[0]) / 2 + nv[0] * (w / 2 + 1.2 * h), (a[1] + b[1]) / 2 + nv[1] * (w / 2 + 1.2 * h)], ang = Math.atan2(u[1], u[0]) * 180 / Math.PI; D.text(ly.t, mid[0], mid[1], h * 0.8, dxfStr(mm.sec || ''), 1, ang > 90 || ang < -90 ? ang + 180 : ang); });
   D.dimH(ly.d, 0, S, Dt + 4 * h, Dt, 'GIRDER SPACING <>'); D.dimV(ly.d, yb, yt, S + tf.b / 2 + 4 * h, S, 'WORK PT. <>'); D.dimV(ly.d, 0, yb, S + tf.b / 2 + 4 * h, S);
-  D.text(ly.t, 0, Dt + 8 * h, h * 1.3, `INTERMEDIATE CROSS-FRAME (TYPE ${/^K/.test(p.type) ? 'K' : 'X'})`);
+  D.text(ly.t, 0, Dt + 8 * h, h * 1.3, `INTERMEDIATE CROSS-FRAME (TYPE ${/^K/.test(p.type) ? 'K' : 'X'})`); }
   { const th = Math.max(...m.skews.map(v => Math.abs(v))), Se = S / Math.cos(th * Math.PI / 180), ox = S + tf.b + 30 * h, i0 = D.mark();
     [0, Se].forEach(x => { D.rect(ly.g, ox + x - bf.b / 2, 0, ox + x + bf.b / 2, bf.t); D.rect(ly.g, ox + x - tw / 2, bf.t, ox + x + tw / 2, bf.t + Dm); D.rect(ly.g, ox + x - tf.b / 2, bf.t + Dm, ox + x + tf.b / 2, Dt); D.rect(ly.cp, ox + x + (x ? -1 : 1) * (tw / 2), bf.t, ox + x + (x ? -1 : 1) * (tw / 2 + 0.75), bf.t + Dm); });
     [[[0, yt], [Se, yt]], [[0, yb], [Se, yb]], [[0, yb], [Se, yt]], [[0, yt], [Se, yb]]].forEach(([a, b]) => D.line(ly.x, ox + a[0], a[1], ox + b[0], b[1]));
@@ -5669,6 +5751,7 @@ function dxfCF(D, C) {
     const bx = [...Array(n)].map((_, i) => cx + 0.625 + e0 + i * s0); bx.forEach(x => D.circle(ly.bo, x, cy, rb));
     D.chainH(ly.d, [cx + 0.625, ...bx], cy + (+mm.b1 || 4) / 2 + 3 * h, cy + (+mm.b1 || 4) / 2);
     D.text(ly.t, cx, cy + Lc / 2 + 3 + 4 * h, h * 1.1, 'TYPICAL CONNECTION (MEMBER TO CONNECTION PLATE)'); D.text(ly.t, cx + Lc + 10, cy - 0.4 * h, h * 0.8, `${dxfStr(mm.sec || '')}: ${n} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS @ ${dxfIn(s0)}, EDGE ${dxfIn(e0)}${+cn.tg ? `; GUSSET ${dxfIn(+cn.tg)}` : ''}`); }
+  if (dOn) { const q = p.dia; D.text(ly.t, 0, -4 * h, h * 0.8, dxfStr(`DIAPHRAGM ${cfDiaSec(q).nm_} ASTM A709 GR. ${q.gr || 50}; WEB BOLTED TO CONNECTION PLATE WITH ${Math.max(2, Math.round(+q.nb || 2))} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END IN ONE ROW @ ${dxfIn(+q.pitch || 3)}, ${dxfIn(+q.ecc || 3.5)} FROM GIRDER WEB; CENTERED ON GIRDER DEPTH; COPE FLANGES AS REQUIRED; CONNECTION PLATES SHOWN SCHEMATICALLY.`)); return; }
   D.text(ly.t, 0, -4 * h, h * 0.8, `MEMBERS ASTM A709 GR. ${p.gA}; ${cn.n || 2} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END @ ${dxfIn(+cn.s || 3)}, EDGE ${dxfIn(+cn.e || 1.5)}; CONNECTION PLATES SHOWN SCHEMATICALLY.`);
 }
 /* ---------- 7: transverse stiffeners and connection plates ---------- */
@@ -6036,7 +6119,11 @@ function v3bBuild() {
       inst(pts, new THREE.CylinderGeometry(d / 2, d / 2, hs, 8), M.stud); } }
   // cross-frames (members on their work points)
   if (lay.xf && !single) { const cf = P.cf || {}, Dt = D + tTmax + tBmax, h = Math.min(+cf.h || D * 0.8, Dt - 4), yb = -tBmax + (Dt - h) / 2, yt = yb + h, r = 1.4;
+    const dOn = cfDiaOn(cf), DX = dOn ? cfDiaSec(cf.dia) : null, ym = -tBmax + Dt / 2;   // diaphragm selected: channel or W centered on the girder depth at intermediate frames (end frames unchanged)
     FR.frames.forEach(f => { const za = Z(f.bay), zc = Z(f.bay + 1), xa = f.xa * 12, xc = f.xc * 12, A = [xa, yb, za], At = [xa, yt, za], Bb = [xc, yb, zc], Bt = [xc, yt, zc];
+      if (dOn && f.type !== 'sup') { const dx = xc - xa, dz = zc - za, L = Math.hypot(dx, dz), g = cfDiaGap(cf.dia), Lm = Math.max(1, L - 2 * g), ry = Math.atan2(-dz, dx), ux = dx / L, uz = dz / L, cx = (xa + xc) / 2, cz = (za + zc) / 2, ch = !!DX.chS;
+        const pc = (off, y, sy, sz) => { const b = box(cx - uz * off, y, cz + ux * off, Lm, sy, sz, M.xf); b.rotation.y = ry; };
+        pc(0, ym, DX.d - 2 * DX.tf, DX.tw); const fo = ch ? (DX.bf - DX.tw) / 2 : 0; pc(fo, ym + (DX.d - DX.tf) / 2, DX.tf, DX.bf); pc(fo, ym - (DX.d - DX.tf) / 2, DX.tf, DX.bf); return; }
       rod(A, Bb, r, M.xf); rod(At, Bt, r, M.xf);
       if ((cf.type === 'Kb' || cf.type === 'K') && f.type !== 'sup') { const Mb = [(xa + xc) / 2, yb, (za + zc) / 2]; rod(At, Mb, r, M.xf); rod(Bt, Mb, r, M.xf); }
       else if (cf.type === 'Kt' && f.type !== 'sup') { const Mt = [(xa + xc) / 2, yt, (za + zc) / 2]; rod(A, Mt, r, M.xf); rod(Bb, Mt, r, M.xf); } else { rod(A, Bt, r, M.xf); rod(At, Bb, r, M.xf); } }); }
@@ -6082,7 +6169,7 @@ function v3bBuild() {
     const def = m.splices.length ? 's0' : 'b1'; fsel.value = def; V3B.tg[def] != null ? V3B.focus(V3B.tg[def]) : V3B.home(); V3B.home2 = () => { const v = fsel.value; V3B.tg[v] != null ? V3B.focus(V3B.tg[v]) : V3B.home(); }; }
   else { fsel.hidden = true; V3B.home(); V3B.home2 = V3B.home; }
   const nStud = lay.stud ? '' : ' Studs are off (turn them on to see every stud at its pitch zone).';
-  document.getElementById('v3b-note').textContent = single ? `Composite girder G${gs + 1}: plates as designed, haunch, tributary deck strip, connection plates, bearing stiffeners, splice plates with every bolt, and shear studs.${nStud} Drag to rotate, right-drag to pan, scroll to zoom.` : `${nb} girders, ${FR.frames.length} cross-frames (type ${(P.cf && P.cf.type) || 'X'}), deck ${frac(ts)} in. on ${frac(hh)} in. haunch, skew ${m.skews.map(v => f2(v)).join(' / ')} deg.${nStud} Drag to rotate, right-drag to pan, scroll to zoom.`;
+  document.getElementById('v3b-note').textContent = single ? `Composite girder G${gs + 1}: plates as designed, haunch, tributary deck strip, connection plates, bearing stiffeners, splice plates with every bolt, and shear studs.${nStud} Drag to rotate, right-drag to pan, scroll to zoom.` : `${nb} girders, ${FR.frames.length} ${cfDiaOn(P.cf) ? `bracing lines: intermediate diaphragms (${cfDiaSec(P.cf.dia).nm_}) and end cross-frames` : `cross-frames (type ${(P.cf && P.cf.type) || 'X'})`}, deck ${frac(ts)} in. on ${frac(hh)} in. haunch, skew ${m.skews.map(v => f2(v)).join(' / ')} deg.${nStud} Drag to rotate, right-drag to pan, scroll to zoom.`;
 }
 document.addEventListener('click', e => { const id = e.target.id;
   if (id === 'btn-v3dbr') v3bOpen();
@@ -6597,7 +6684,7 @@ function renderErrors() { crMarkStale();
   const h = `<div class="alert fail"><b>Checks are blocked until these inputs are fixed.</b><ul class="err-list">${RS.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
   ['summary', 'combos', 'checks', 'drawings', 'v3d'].forEach(t => $('#tab-' + t).innerHTML = h);
 }
-const grps = () => (MODS[P.mod] || MODS.splice).groups;
+const grps = () => P.mod === 'cf' && cfDiaOn(P.cf) ? ['Diaphragm (intermediate bracing used)', ...MODS.cf.groups] : (MODS[P.mod] || MODS.splice).groups;   // cross-frames: the diaphragm group (check CFD) is listed when the diaphragm is the bracing used
 function counts() { const c = { fail: 0, warn: 0, adv: 0, pass: 0, na: 0 }; CK.forEach(k => c[k.status]++); return c; }
 function renderStatus() { crMarkStale();
   const c = counts(), v = c.fail ? { cls: 'fail', ico: '✕', t: `${c.fail} check${c.fail > 1 ? 's' : ''} fail` } : { cls: 'pass', ico: '✓', t: 'All checks pass' };
```

## 2026-10-12 — PR: claude/girderdetail-q3 (engineer's approved follow-ups; PR link added after merge)

Engineer's approval (2026-10-12) of three follow-ups: (1) the DXF title-block status table and the Girder report carry the G9 warning when field splices are "Included" but Preliminary sizing has none; (2) splice auto-design: when no web layout passes, the fallback fit starts from the largest web bolt group that fits; (3) TS5 (stiffener spacing) is not applicable on a web with connection plates only, and a panel wider than 3D is advisory. Basis: AASHTO LRFD 10th Ed. (2024). Main page only; the PlateLine string `PL_B64` is not touched. Items 1 and 3 change status and message text only (no formula, factor, unit or reference changed); item 2 changes the fallback layout that auto-design returns when nothing passes (no formula or check changed). Line numbers ≈ branch.

### Q1. DXF title-block status table and Girder report: warning when splices are "Included" but Preliminary sizing has none   [message only] [no result change]
- **Where (main page):**
  - `dxfSummary()` (≈ 5898), the Design all status table (`MODULE / RESULT / NOTE`). Anchor `dxfTable(D, tb, 0, T.y - 2 * h, ['MODULE', 'RESULT', 'NOTE']`. The RESULT cell of the Field splices row reads `WARNING: NO SPLICE IN SIZING; SPLICE DATA FROM SPLICE MODULE ONLY` when `s.mm === 'splice' && !s.off && spNoPL()` (the same condition the Design all table on screen uses since G9); otherwise unchanged. The NOTE cell is unchanged (e.g. `0 CASES DESIGNED`).
  - `girderReportRun()` (≈ 5426), module loop. Anchor `if (mod === 'splice' && !spIncl()) { add('Field splices', '<p class="cr-p">Field splices not included.</p>', []); continue; }`. New line after it: when the demands received have no splices and `spNoPL()`, a "Field splices" chapter with one line: "**Warning:** Field splices are "Included" on the Splice tab, but Preliminary sizing has no field splice, so no splice was designed or checked for this girder." Before, the report had no splice chapter in that state and said nothing.
- **Before / after (exact):** see "Exact changes (Q1)" below.
- **Problem:** after G9 the status bar, Summary, Project tab, report and Design all table warned, but the DXF status table still printed the stored Design all row (`ALL CHECKS PASS`) for the splice, and the Girder report silently left the splice out.
- **§4:** no formula, factor, unit or reference changed; message only. `P.designAll` (saved) is unchanged; the DXF reads `spNoPL()` when it is written, as the Design all table on screen does.
- **Check case (headless Chromium):** Preliminary sizing 90 ft simple span, N<sub>b</sub> = 10, S = 4 ft, overhangs 2.25 ft, depth rule off, Suggest applied (D = 37, top 13 × 3/4, bottom 14 × 1 1/8, no field splices); Splice tab "Included" (`P.spl` `inc: 'yes'`, `plN: 0`); Get demands; Design all (Preliminary sizing); DXF; Girder report for G2.
  - DXF status table, Field splices row. Before: `ALL CHECKS PASS | 0 CASES DESIGNED`. After: `WARNING: NO SPLICE IN SIZING; SPLICE DATA FROM SPLICE MODULE ONLY | 0 CASES DESIGNED`. Every other row: same as before (the Transverse stiffeners row changes with Q3 only).
  - Girder report chapters. Before: 10 chapters, no splice chapter. After: 11 chapters, "Chapter 6. Field splices" with the warning line.
  - Default example (splices in the sizing layout): DXF text, Design all, and every check identical main vs branch.
- **Saved data:** none changed.
- **How verified:** `node --check` on the inline scripts; headless Chromium (Playwright) main vs branch; no console errors.
- **Other copies:** none.
- **Open items:** none.

### Exact changes (Q1): main page (unified diff)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index 6e70ef9..643e627 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -5425,2 +5425,3 @@ async function girderReportRun(j) {
       if (mod === 'splice' && !spIncl()) { add('Field splices', '<p class="cr-p">Field splices not included.</p>', []); continue; }
+      if (mod === 'splice' && !(j.splices || []).length && spNoPL()) { add('Field splices', `<p class="cr-p"><b>Warning:</b> Field splices are "Included" on the Splice tab, but Preliminary sizing has no field splice, so no splice was designed or checked for this girder.</p>`, []); continue; }
       if (mod === 'splice') { for (const s of (j.splices || [])) { importInto('splice', () => spliceApply(j, s), j.srcLabel); const c = await grChapter('splice', k + 1, o, `G${g}: bolted field splice ${s.label.replace(/, G\d+$/, '')}`); add(`Field splice ${s.label}`, c.html, c.toc); } continue; }
@@ -5896,3 +5897,3 @@ function dxfSummary(D, C) { const h = D.h, tb = D.layer('TABL', 7), l = D.layer(
   const st = (P.designAll && P.designAll.stat) || [];
-  if (st.length) dxfTable(D, tb, 0, T.y - 2 * h, ['MODULE', 'RESULT', 'NOTE'], st.map(s => [dxfStr(s.name || s.mm).toUpperCase(), s.fails && s.fails.length ? 'FAILS: ' + s.fails.join(', ') : s.warns && s.warns.length ? 'PASS, WARNINGS: ' + s.warns.join(', ') : 'ALL CHECKS PASS', dxfStr(s.note || '').toUpperCase()]), `DETAIL DESIGN (DESIGN ALL, ${dxfStr(P.designAll.src || '').toUpperCase()})`); }
+  if (st.length) dxfTable(D, tb, 0, T.y - 2 * h, ['MODULE', 'RESULT', 'NOTE'], st.map(s => [dxfStr(s.name || s.mm).toUpperCase(), s.mm === 'splice' && !s.off && spNoPL() ? 'WARNING: NO SPLICE IN SIZING; SPLICE DATA FROM SPLICE MODULE ONLY' : s.fails && s.fails.length ? 'FAILS: ' + s.fails.join(', ') : s.warns && s.warns.length ? 'PASS, WARNINGS: ' + s.warns.join(', ') : 'ALL CHECKS PASS', dxfStr(s.note || '').toUpperCase()]), `DETAIL DESIGN (DESIGN ALL, ${dxfStr(P.designAll.src || '').toUpperCase()})`); }
 /* ---------- standard details, filled in from the design ---------- */
```

### Q2. Auto-design splice: when no web layout passes, the fallback fit starts from the largest web bolt group that fits   [fallback layout change, only when no layout passes] [no formula, check or search change]
- **Where (main page):** `autoDesignSplice()` (≈ 6992), the fallback to `fitSplice()`. Anchor `if (!W || !T || !B || fails.length) {`.
  - Before: `if (!W || !T || !B || fails.length) { const f = fitSplice(), why = …`
  - After: the same branch, but first, when the web search found nothing (`!W`): `P.web.h` = D − 2(clearance) rounded down to 1/2 in (as the search), `P.web.sv` = the smallest pitch of the search that is ≥ 3d (`[3, 3.5, 4, 4.5, 5, 5.5, 6].find(v => v >= 3 * d - 1e-9)`), `P.web.nr` = 1 + ⌊(h − 2e<sub>min</sub>)/s<sub>v</sub>⌋ (at least 2), `P.web.nc` = 4; then the locked web inputs are put back (`locked.filter(([k]) => k.startsWith('web.'))…`), then `fitSplice()` runs as before. `P.web.t` and `P.web.sh` are left as the search left them. When the web search found a layout (`W`), nothing changes.
  - Manual, Auto-design splice paragraph: "When no layout passes, the plates and bolts are fitted and increased instead (when no web layout passed, the web starts from the largest bolt group that fits: the smallest pitch of at least 3d, every row that fits, and 4 columns) and the message says why:" (added text in parentheses).
- **Problem (G10 open item):** with no passing web layout, the web group kept the last vertical pitch the search tried (6 in, 5 rows in the repro), although 9 rows at 3 in fit the 27 in plate; `fitSplice` only adds columns (up to 4) and plate thickness, so the result failed checks that the largest group passes.
- **§4:** no formula, factor, resistance, unit or reference changed; the search, the checks, `fitSplice` and the message logic are unchanged. Only the starting web layout of the fallback changes, and only when no web layout passes. Pitch ≥ 3d (6.13.2.6.1) and the edge distance (DT5) are the same rules the search uses.
- **Check case (headless Chromium; the G10 repro):** Preliminary sizing 90 ft simple span, N<sub>b</sub> = 10, S = 4 ft, overhangs 2.25 ft, depth rule off; girder D = 30 in, top 16 × 3/4, bottom 18 × 1 1/4, field splice at 45 ft; Splice: Get demands; splice moments × 2.0 (M<sub>DC1</sub> 1316.6, M<sub>DC2</sub> 329.6, M<sub>DW</sub> 189.8, M<sub>LL+</sub> 1810.6, M<sub>CLL</sub> 162 kip-ft); Auto-design splice. 7/8 in bolts, e<sub>min</sub> = 1.125 in.
  - Web layout. Before: PL 27 × 1, **5 rows at 6 in** × 4 columns (20 bolts per side). After: PL 27 × 1, **9 rows at 3 in** × 4 columns (36 bolts per side). Flange plates and bolts identical before and after.
  - Hand check of the group: rows = 1 + ⌊(27 − 2(1.125))/3⌋ = 1 + ⌊8.25⌋ = 9; pitch 3 in ≥ 3d = 2.625 in. H<sub>w</sub>/n = 1267.90/36 = 35.22 kip (before 1267.90/20 = 63.40 kip).
  - Checks (governing combination, ratio). Before → after:
    - WS1 (StrP): R<sub>u</sub> = 88.78 kip vs φR<sub>n</sub> = 64.65 kip, 1.37 **fail** → R<sub>u</sub> = 51.36 kip, 0.79 pass.
    - WS2 (StrP): 88.78 vs bearing 43.05 kip (girder web), 2.06 **fail** → 51.36 vs 43.05, 1.19 **fail**.
    - WS3 (SvP): R<sub>s</sub> = 61.99 kip vs 39.00 kip, 1.59 **fail** → 34.44 vs 39.00, 0.88 pass.
    - WS4 shear rupture (StrP): 435.00 vs 1429.12 kip, 0.30 → 435.00 vs 1169.28 kip, 0.37 (more holes in the net section); shear yielding 0.28 both; WS5 0.52 both.
    - DT1/DT2/DT9 web pitch items: 6.00 → 3.00 in (all pass); every other item unchanged. Failing checks: WS1, WS2, WS3 → WS2. The message lists "Still failing: WS2" and the G10 "Why" text (the slip part no longer appears because WS3 passes).
  - Passing cases bit-identical main vs branch (layout, message, every check item): the same girder with moments × 1.0 (auto-design passes: web 7 rows at 4 in × 2 columns), and the default example's auto-design splice.
  - Locked web pitch (`web.sv` locked at 4.5 in, moments × 2.0): layout, message and checks identical main vs branch (6 rows at 4.5 in × 4 columns; the lock is kept).
- **Saved data:** none changed (only the values auto-design writes into `P.web` differ, in the case above).
- **How verified:** `node --check`; headless Chromium (Playwright) main vs branch for the cases above; no console errors.
- **Other copies:** none.
- **Open items:** none new. The largest group still fails WS2 in this repro (girder web bearing 43.05 kip per bolt); the G10 message's fixes (larger bolts, lower-moment location, thicker girder web) apply.

### Exact changes (Q2): main page (unified diff)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index 643e627..e275cbb 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -2150,3 +2150,3 @@ const MAN = [
 <h3>Splices from Preliminary sizing</h3><p><b>Sealing, stitching, gage lines, and wrench clearance.</b> DT2 limits the pitch along free edges for sealing, s ≤ 4.0 + 4.0t ≤ 7.0 in (6.13.2.6.2), with t the thinner outside plate: on a flange with inner plates, the thinner of the outer and inner plates. DT3 applies the maximum edge distance 8t ≤ 5.0 in to the splice plates. DT9 applies the stitch-bolt limits of 6.13.2.6.3 to the splice plates, taken to act in compression (the flange splices are designed for P<sub>fy</sub> in tension and compression, and the web plates carry the compressive part of the flange force transferred to the web): pitch s ≤ 12.0t along the force, gage g ≤ 24.0t between lines, including across the web on the outer plate; the end-pitch rule for compression members (6.13.2.6.4) is for built-up members and is not applied. A setting on the Bolts tab makes DT9 advisory instead of required. DT10 is the owner or office minimum number of bolt lines each side of the web (default 2; AASHTO itself requires only two rows along the force, DT6). Staggered holes are not used. DT11 checks the clearance needed to tighten the nuts: flange bolts to the face of the web splice plate, and the web bolts nearest the flanges to the face of the flange splice plates, against C₁ (defaults 1.25, 1.50, 1.625, 1.75 in for 3/4, 7/8, 1, 1-1/8 in bolts; confirm with the AISC Manual Table 7-16 and the fabricator).</p>
-<p><b>Auto-design splice</b> (Splice tab) finds the most economical splice that passes every strength and detailing check (TF, BF, MT, WS, and DT1 to DT11, including plate area not less than the connected area, stitching, the minimum gage lines, and wrench clearance). If a flange is too narrow for the minimum gage lines without staggering, it reports the width needed and leaves the splice unchanged: for each flange it tries double shear (inner plates, where they fit) and single shear with the minimum number of bolt lines (DT10) up to three each side of the web, the first line placed for edge distance and wrench clearance, takes the fewest bolt rows that pass shear and slip, then the thinnest plates (1/16 in steps from 5/16 in, inner and outer areas balanced) that pass bearing, yield, fracture, block shear, fatigue, and the edge-distance limits, and keeps the layout with the fewest bolts, then the least plate steel. The web splice uses plates as deep as the web less the clearances, the fewest bolt columns, the widest vertical pitch the sealing limit allows, and the thinnest passing plate. Geometry is fitted throughout: outer plates to the narrower flange, inner plates to the clearance from the web plate, bolt gages to the edge distances. When no layout passes, the plates and bolts are fitted and increased instead and the message says why: for failing web bolts, the governing demands (V<sub>r</sub>, M<sub>t</sub>, and H<sub>w</sub> from MT1), the force per bolt from H<sub>w</sub> alone and the critical-bolt force for the largest web bolt group that fits the web plate (all rows at the smallest pitch × 4 columns), against the bolt resistance; for failing flange bolts, the rows needed against the 16 rows searched; then what can fix it (a lower-moment splice location, larger bolts, inner plates or a wider flange, a deeper or heavier girder). <b>Undo auto-design</b> restores the previous layout; <b>Fit geometry only</b> keeps your bolts and thicknesses and only fits widths, gages, and the web plate. When a splice is loaded from an analysis, it is auto-designed for those demands automatically. Verification: the example splice drops from 124 to 96 bolts and the Br. 037201 interior splice from 268 to 152, both passing every check; review the result against your standard details. Plate thicknesses are standard: 1/16 in steps up to 1 in, 1/8 in steps above; the bolt pitch is at least 3d.</p>
+<p><b>Auto-design splice</b> (Splice tab) finds the most economical splice that passes every strength and detailing check (TF, BF, MT, WS, and DT1 to DT11, including plate area not less than the connected area, stitching, the minimum gage lines, and wrench clearance). If a flange is too narrow for the minimum gage lines without staggering, it reports the width needed and leaves the splice unchanged: for each flange it tries double shear (inner plates, where they fit) and single shear with the minimum number of bolt lines (DT10) up to three each side of the web, the first line placed for edge distance and wrench clearance, takes the fewest bolt rows that pass shear and slip, then the thinnest plates (1/16 in steps from 5/16 in, inner and outer areas balanced) that pass bearing, yield, fracture, block shear, fatigue, and the edge-distance limits, and keeps the layout with the fewest bolts, then the least plate steel. The web splice uses plates as deep as the web less the clearances, the fewest bolt columns, the widest vertical pitch the sealing limit allows, and the thinnest passing plate. Geometry is fitted throughout: outer plates to the narrower flange, inner plates to the clearance from the web plate, bolt gages to the edge distances. When no layout passes, the plates and bolts are fitted and increased instead (when no web layout passed, the web starts from the largest bolt group that fits: the smallest pitch of at least 3d, every row that fits, and 4 columns) and the message says why: for failing web bolts, the governing demands (V<sub>r</sub>, M<sub>t</sub>, and H<sub>w</sub> from MT1), the force per bolt from H<sub>w</sub> alone and the critical-bolt force for the largest web bolt group that fits the web plate (all rows at the smallest pitch × 4 columns), against the bolt resistance; for failing flange bolts, the rows needed against the 16 rows searched; then what can fix it (a lower-moment splice location, larger bolts, inner plates or a wider flange, a deeper or heavier girder). <b>Undo auto-design</b> restores the previous layout; <b>Fit geometry only</b> keeps your bolts and thicknesses and only fits widths, gages, and the web plate. When a splice is loaded from an analysis, it is auto-designed for those demands automatically. Verification: the example splice drops from 124 to 96 bolts and the Br. 037201 interior splice from 268 to 152, both passing every check; review the result against your standard details. Plate thicknesses are standard: 1/16 in steps up to 1 in, 1/8 in steps above; the bolt pitch is at least 3d.</p>
 <h3>Field splices: inclusion and Suggest splice</h3><p><b>Field splices</b> (Splice tab) is "As in Preliminary sizing" by default: the splice module is not included when the last sizing layout received has no field splices; "Included" and "Not included" override that. When splices are not included, no splice checks, results, warnings, report, drawings, Design all rows, quantities, or tab status appear; the module shows one line, "Field splices not included", and the stud module gets no splice gaps from Design all. With "Included" while the Preliminary sizing layout has no field splices, the module still checks the splice entered on its tabs, with the section and demands entered by hand or kept from an earlier import, and warns in the status bar, the Summary, the Project tab (next to Get demands), the report, and the Design all table that they are not from the current analysis; Get demands then loads nothing and shows that warning. <b>Suggest splice</b> proposes the location and the size. Location: in a continuous unit, at the dead-load (DC1 + DC2 + DW) points of contraflexure next to each interior pier, from the Structural analysis module for an interior girder, rounded to the nearest foot (6.13.6.1.1); in simple spans, the girder ends at the piers; then any field section longer than the <b>Maximum field-section length</b> (default 120 ft, a shipping and erection assumption; verify) is divided into equal lengths (an odd number in a simple span, so no splice falls at midspan), and a splice closer than the <b>Minimum distance from a support</b> (default 10 ft; verify) is moved to that distance. The suggested stations are listed beside the ones in Preliminary sizing; the splice stations themselves are set on its Girder tab (your stations are kept until you change them). Size: Auto-design splice is run with each bolt diameter offered (7/8, 1, and 1-1/8 in; only the Bolts tab diameter when it is locked), and the layout that passes every splice check with the least cost of bolts (installed) plus plate steel (per lb), from the Owner standards, is kept. When demands are imported, the splice is auto-designed with the Bolts tab diameter. Plates or bolt diameter you edit are kept by imports and refreshes until you press Suggest splice or Auto-design splice. The splice checks themselves are unchanged.</p>
@@ -6986,3 +6986,7 @@ function autoDesignSplice() {
   if (narrow.length) { const why = !W ? diag(true) : ''; Object.assign(P, JSON.parse(JSON.stringify(P._spUndo))); return { ok: false, msg: `The ${narrow.join('; the ')}. Widen the flange at this splice (Preliminary sizing's Suggest sizes flanges at field splices for this), or lower the minimum number of gage lines on the Bolts tab. The splice was not changed.${why ? `${why.replace('\n\nWhy: ', '\n\nAlso, no web splice layout passed: ')}` : ''}`, fails: ['DT10'] }; }
-  if (!W || !T || !B || fails.length) { const f = fitSplice(), why = f.ok ? '' : diag(false); return { ok: f.ok, msg: `No layout within the search passed every check${!W ? ' (web)' : !T ? ' (top flange)' : !B ? ' (bottom flange)' : ''}; the plates and bolts were fitted and increased instead. ${f.msg}${why}`, fails: f.fails }; }
+  if (!W || !T || !B || fails.length) {
+    if (!W) {   // no web layout passed: the fit starts from the largest web bolt group that fits (smallest pitch ≥ 3d, every row that fits, 4 columns), not the last one the search tried; locked web inputs are kept
+      const hw = q2(R0.D - 2 * cv), svMin = [3, 3.5, 4, 4.5, 5, 5.5, 6].find(v => v >= 3 * d - 1e-9) || 6;
+      Object.assign(P.web, { h: hw, sv: svMin, nr: Math.max(2, 1 + Math.floor((hw - 2 * em) / svMin + 1e-9)), nc: 4 }); locked.filter(([k]) => k.startsWith('web.')).forEach(([k, v]) => setPath(P, k, v)); }
+    const f = fitSplice(), why = f.ok ? '' : diag(false); return { ok: f.ok, msg: `No layout within the search passed every check${!W ? ' (web)' : !T ? ' (top flange)' : !B ? ' (bottom flange)' : ''}; the plates and bolts were fitted and increased instead. ${f.msg}${why}`, fails: f.fails }; }
   const fs = (F, x) => `${x.inner ? 'double shear' : 'single shear'}, ${F.nl} line${F.nl > 1 ? 's' : ''} each side × ${F.nr} rows = ${x.bolts} bolts; outer PL ${frac(F.bo)} × ${frac(F.to)}${F.inner ? `, 2 inner PL ${frac(F.bi)} × ${frac(F.ti)}` : ''}`;
```

### Q3. Transverse stiffeners, TS5 (stiffener spacing): not applicable with connection plates only; a panel wider than 3D is advisory   [status and text only] [no calculation change; TS4 and every other check unchanged]
- **Where (main page):**
  - `GM.ts.checks()`, check TS5 (≈ 2454). Anchor `{ const c = { id: 'TS5', grp: G2, title: 'Stiffener spacing limits'`.
    - Item status. Before: `st: ge(lim, q.do) ? 'pass' : 'warn'`. After: `ok = ge(lim, q.do), adv = !ok && !q.stiff` and `st: ok ? 'pass' : adv ? 'adv' : 'warn'`; with `adv` the worked line ends "(treated as unstiffened in TS4)". `q.stiff` is the flag TS4's `webShear()` already uses (d<sub>o</sub> > 0 and ≤ 3D): a panel wider than 3D is exactly the one TS4 checks with k = 5 and V<sub>n</sub> = CV<sub>p</sub> (Eq. 6.10.9.2-1).
    - New: when no stiffener location uses a type with role `'int'` (connection plates only) and no item is a warning, the items are dropped and TS5 is N/A with "Web designed as unstiffened (connection plates only): connection-plate spacing is not limited by 6.10.9.1; web shear is checked as unstiffened in TS4."
    - Note. Before: "A panel wider than the limit is treated as unstiffened for shear; the check is a warning because the web may still work as unstiffened." After: "The 6.10.9.1 limits decide only whether a panel counts as stiffened for shear. A panel wider than 3D is advisory: it is treated as unstiffened in TS4 (k = 5, V_n = CV_p), and TS4 decides pass or fail. An end panel wider than 1.5D but not wider than 3D stays a warning (TS4 checks it with V_n = CV_p and k from its d_o). With connection plates only (no intermediate stiffener) the check is not applicable."
  - `AD.ts` auto-design message (≈ 5152). Anchor `const ts5 = r ? r.C.find(c => c.id === 'TS5') : null`. Before: one line when TS5 is 'warn' ("TS5 warnings: panels wider than the stiffened-panel limit … TS4 confirms the web shear"). After: "TS5 advisories: panels wider than 3D are not stiffened panels (6.10.9.1) and are treated as unstiffened in TS4, which decides the web shear" when any TS5 item is advisory, and "TS5 warnings: end panels wider than 1.5D (6.10.9.1); TS4 checks them with V_n = CV_p and k from d_o" when any item is a warning; nothing when TS5 is N/A.
  - Manual, Transverse stiffeners, "Web shear (6.10.9)". Before: "End panels are limited to 1.5D and interior panels to 3D." After: "Check TS5 compares each panel with the limits of 6.10.9.1 (1.5D for end panels, 3D for interior panels), which decide only whether the panel counts as stiffened: a panel wider than 3D is advisory, because TS4 checks it as unstiffened (k = 5) and decides pass or fail; an end panel wider than 1.5D but not wider than 3D is a warning. When the web has no intermediate stiffeners (connection plates only), it is designed as unstiffened and TS5 is not applicable."
- **Deviation from the approval, for the engineer:** an **end** panel wider than 1.5D but not wider than 3D keeps its **warning** (also when there are connection plates only, in which case TS5 stays applicable). TS4 does not treat that panel as unstiffened: `webShear()` gives it k = 5 + 5/(d<sub>o</sub>/D)² and V<sub>n</sub> = CV<sub>p</sub> (Eq. 6.10.9.3.3-1), so "treated as unstiffened in TS4" would not be true there. See open items.
- **Problem:** on a web designed unstiffened with connection plates only at the cross-frames, every panel exceeded 3D/1.5D and TS5 warned on all of them, so the module, the "Web shear" group, the module tab, Design all and the DXF status table showed warnings although the 6.10.9.1 limits only decide whether a panel counts as stiffened and TS4 already checks those panels as unstiffened.
- **§4:** no formula, factor, unit or reference changed; TS4 and every other check are identical. Only TS5's status and text, and the statuses that follow from it (Web shear group, module status, module tab, Design all warnings list, DXF status table), change.
- **Check case 1 (headless Chromium; repro):** Preliminary sizing 90 ft simple span, N<sub>b</sub> = 10, S = 4 ft, overhangs 2.25 ft, depth rule off, Suggest applied (D = 37 in, web unstiffened); Transverse stiffeners: Get demands (Preliminary sizing). Six locations, all Type B (connection plate), d<sub>o</sub> = 300 in both sides; four end panels.
  - TS5. Before: **warn**, 12 items warn (end panels 300 vs 1.5(37) = 55.50 in, ratio 5.41; interior panels 300 vs 3(37) = 111.00 in, ratio 2.70). After: **N/A** with the text above.
  - TS4: identical, pass, all 12 items (e.g. first connection plate from Abut. 1, interior, end panel: d<sub>o</sub> 300, V<sub>u</sub> 93.38, C 0.815, φV<sub>n</sub> 437.28 kip, 0.21). Hand check that TS4 is the unstiffened case: d<sub>o</sub> = 300 > 3D = 111 in, so k = 5 and φV<sub>n</sub> = CV<sub>p</sub> = 0.815 × 0.58(50)(37)(0.5) = 437.3 kip.
  - Status bar. Before: "All checks pass, 1 warning; ! Web shear". After: "All checks pass, No warnings; ✓ Web shear". Module tab badge: warn "1" → pass. Design all (Preliminary sizing), Transverse stiffeners: "All checks pass; warnings TS5" → "All checks pass". DXF status table: `PASS, WARNINGS: TS5` → `ALL CHECKS PASS`. Auto-design message: the "TS5 warnings: …" line is no longer printed; the plate result ("Connection plate: PL 5 × 1/2, one side, welds 5/16 web, 5/16 flanges, cutback 2.") is identical.
- **Check case 2 (default example, with intermediate stiffeners):** Type A (intermediate) at 60/60 in with an end panel, Type B at 90/90 in, D = 60 in. TS5 pass (4 items pass) before and after; every check, Summary, auto-design results, Design all, DXF text and saved data identical main vs branch; only the TS5 note text differs (Checks tab and report).
- **Check case 3 (default example, variants; TS4 identical in every variant):**
  | Variant | TS5 before | TS5 after | Module before → after |
  |---|---|---|---|
  | Type A panel 2 at 200 in (> 3D = 180) | warn (pass, warn, pass, pass) | adv (pass, adv, pass, pass) | 1 warning → no warnings |
  | Type A end panel at 120 in (1.5D = 90 < 120 ≤ 180) | warn | warn (unchanged) | 1 warning → 1 warning |
  | Connection plates only, all panels 240 in, no end panel | warn (4 warn) | N/A | 1 warning → no warnings |
  | Connection plates only, 150 in, first row an end panel | warn (warn, pass, pass, pass) | warn (unchanged; the end panel is 1.5D < 150 ≤ 3D) | 1 warning → 1 warning |
  | Connection plates only, end panel 120 in, others 240 in | warn (4 warn) | warn (warn, adv, adv, adv) | 1 warning → 1 warning |
- **Saved data:** none changed. Projects saved by main load in the branch and the reverse, with identical results except the TS5 note.
- **How verified:** `node --check` on the inline scripts; headless Chromium (Playwright) main vs branch for the cases above; screenshots of the TS5 card (advisory, N/A), the TS Checks and Summary tabs, and the Design all table; no console errors.
- **Other copies:** none.
- **Open items (raised, not changed):** an end panel with 1.5D < d<sub>o</sub> ≤ 3D is not a stiffened end panel under 6.10.9.1, but TS4 (`webShear()`, `stiff` = d<sub>o</sub> ≤ 3D) uses k = 5 + 5/(d<sub>o</sub>/D)² for it with Eq. 6.10.9.3.3-1 instead of k = 5 (unstiffened, Eq. 6.10.9.2-1). For D = 60, d<sub>o</sub> = 120 in: k = 6.25 vs 5. This is a calculation question for the engineer; TS5 keeps its warning on that panel meanwhile.

### Exact changes (Q3): main page (unified diff)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index e275cbb..415cb51 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -2274,3 +2274,3 @@ const MAN = [
 <p>d<sub>o</sub> is the smaller adjacent panel and b the smaller of d<sub>o</sub> and D. Where neither panel needs tension-field action, I<sub>t</sub> ≥ I<sub>t1</sub>. Otherwise I<sub>t</sub> ≥ I<sub>t1</sub> + (I<sub>t2</sub> − I<sub>t1</sub>)ρ<sub>w</sub> when I<sub>t2</sub> > I<sub>t1</sub>, else I<sub>t</sub> ≥ I<sub>t2</sub>, with ρ<sub>w</sub> the larger of (V<sub>u</sub> − φ<sub>v</sub>V<sub>cr</sub>)/(φ<sub>v</sub>V<sub>n</sub> − φ<sub>v</sub>V<sub>cr</sub>) in the two panels (confirm the equation numbering against your edition). I<sub>t</sub> is taken about the web face for a single plate and about the web mid-thickness for a pair.</p>
-<h3>Web shear (6.10.9)</h3><p>Each adjacent panel is checked for V<sub>u</sub> ≤ φ<sub>v</sub>V<sub>n</sub> with k = 5 + 5/(d<sub>o</sub>/D)². Interior panels include tension-field action (Eq. 6.10.9.3.2-2 or -8 depending on 2Dt<sub>w</sub>/(b<sub>fc</sub>t<sub>fc</sub> + b<sub>ft</sub>t<sub>ft</sub>)); end panels and panels wider than 3D use V<sub>n</sub> = CV<sub>p</sub>. End panels are limited to 1.5D and interior panels to 3D.</p>
+<h3>Web shear (6.10.9)</h3><p>Each adjacent panel is checked for V<sub>u</sub> ≤ φ<sub>v</sub>V<sub>n</sub> with k = 5 + 5/(d<sub>o</sub>/D)². Interior panels include tension-field action (Eq. 6.10.9.3.2-2 or -8 depending on 2Dt<sub>w</sub>/(b<sub>fc</sub>t<sub>fc</sub> + b<sub>ft</sub>t<sub>ft</sub>)); end panels and panels wider than 3D use V<sub>n</sub> = CV<sub>p</sub>. Check TS5 compares each panel with the limits of 6.10.9.1 (1.5D for end panels, 3D for interior panels), which decide only whether the panel counts as stiffened: a panel wider than 3D is advisory, because TS4 checks it as unstiffened (k = 5) and decides pass or fail; an end panel wider than 1.5D but not wider than 3D is a warning. When the web has no intermediate stiffeners (connection plates only), it is designed as unstiffened and TS5 is not applicable.</p>
 <h3>Welds and fatigue</h3><p>Intermediate stiffener web welds stop 4t<sub>w</sub> to 6t<sub>w</sub> from the web-to-flange weld at the tension flange (6.10.11.1.1). Connection plates are welded to both flanges and those welds are designed for 20 kip laterally on straight, nonskewed bridges, or the analysis force otherwise (6.6.1.3.1). Base metal at stiffener weld toes is Category C′, (ΔF)<sub>TH</sub> = 12 ksi. Minimum fillet sizes follow Table 6.13.3.4-1.</p>
@@ -2453,4 +2453,7 @@ tabs: { combos: 'Demands', rptCombos: 'Design demands' },
       out.add(c); }
-    { const c = { id: 'TS5', grp: G2, title: 'Stiffener spacing limits', ref: 'AASHTO LRFD 6.10.9.1, 6.10.9.3.3', src: 'Code', sym: T`d_o \le 3D\ \text{(interior panels)}, \qquad d_o \le 1.5D\ \text{(end panels)}`, cols: ['Location, panel', 'd_o (in)', 'Limit (in)', 'Ratio'], items: [], note: 'A panel wider than the limit is treated as unstiffened for shear; the check is a warning because the web may still work as unstiffened.' };
-      R.rows.forEach(r => [r.p1, r.p2].forEach((q, i) => { const lim = (q.end ? 1.5 : 3) * r.D; c.items.push({ loc: `${L(r)}, panel ${i + 1}${q.end ? ' (end)' : ''}`, cells: [f2(q.do), f2(lim), f2(q.do / lim)], r: q.do / lim, st: ge(lim, q.do) ? 'pass' : 'warn', work: T`d_o = ${f2(q.do)} \;${LE(q.do, lim)}\; ${q.end ? '1.5' : '3'}(${f2(r.D)}) = ${f2(lim)}\ \text{in}` }); })); out.add(c); }
+    { const c = { id: 'TS5', grp: G2, title: 'Stiffener spacing limits', ref: 'AASHTO LRFD 6.10.9.1, 6.10.9.3.3', src: 'Code', sym: T`d_o \le 3D\ \text{(interior panels)}, \qquad d_o \le 1.5D\ \text{(end panels)}`, cols: ['Location, panel', 'd_o (in)', 'Limit (in)', 'Ratio'], items: [], note: 'The 6.10.9.1 limits decide only whether a panel counts as stiffened for shear. A panel wider than 3D is advisory: it is treated as unstiffened in TS4 (k = 5, V_n = CV_p), and TS4 decides pass or fail. An end panel wider than 1.5D but not wider than 3D stays a warning (TS4 checks it with V_n = CV_p and k from its d_o). With connection plates only (no intermediate stiffener) the check is not applicable.' };
+      R.rows.forEach(r => [r.p1, r.p2].forEach((q, i) => { const lim = (q.end ? 1.5 : 3) * r.D, ok = ge(lim, q.do), adv = !ok && !q.stiff; c.items.push({ loc: `${L(r)}, panel ${i + 1}${q.end ? ' (end)' : ''}`, cells: [f2(q.do), f2(lim), f2(q.do / lim)], r: q.do / lim, st: ok ? 'pass' : adv ? 'adv' : 'warn', work: T`d_o = ${f2(q.do)} \;${LE(q.do, lim)}\; ${q.end ? '1.5' : '3'}(${f2(r.D)}) = ${f2(lim)}\ \text{in}${adv ? T`\ \text{(treated as unstiffened in TS4)}` : ''}` }); }));
+      // web designed unstiffened (connection plates only): connection-plate spacing is not limited by 6.10.9.1 (an end panel that TS4 still checks with k from d_o keeps its warning)
+      if (!R.rows.some(r => r.t.role === 'int') && !c.items.some(i => i.st === 'warn')) { c.items = []; c.naWhy = 'Web designed as unstiffened (connection plates only): connection-plate spacing is not limited by 6.10.9.1; web shear is checked as unstiffened in TS4.'; }
+      out.add(c); }
     { const c = { id: 'TS6', grp: G3, title: 'Web weld cutoff at the tension flange', ref: 'AASHTO LRFD 6.10.11.1.1', src: 'Code', sym: T`4t_w \le g \le 6t_w`, cols: ['Location', 'g (in)', '4t_w (in)', '6t_w (in)'], items: [], note: 'For intermediate stiffeners not used as connection plates: the distance from the end of the stiffener-to-web weld to the near toe of the web-to-flange weld.' };
@@ -5148,3 +5151,5 @@ AD.ts = () => { const S = std(), T = P.ts, out = [], D = k => parseDim(k);
   const cp2 = r ? r.C.find(c => c.id === 'CP2') : null; if (cp2 && cp2.status === 'fail') out.push('CP2 (fatigue at the connection plate and stiffener welds, Category C′) depends on the tension-flange stress range, not the plate size: run Full design in Preliminary sizing, which checks Category C′, or thicken the tension flange there');
-  const ts5 = r ? r.C.find(c => c.id === 'TS5') : null; if (ts5 && ts5.status === 'warn') out.push('TS5 warnings: panels wider than the stiffened-panel limit (3D, or 1.5D for end panels) are treated as unstiffened for shear; with an unstiffened web and connection plates only at the cross-frames this is expected, and TS4 confirms the web shear');
+  const ts5 = r ? r.C.find(c => c.id === 'TS5') : null, ts5x = st => ts5 ? ts5.items.some(i => i.st === st) : false;
+  if (ts5x('adv')) out.push('TS5 advisories: panels wider than 3D are not stiffened panels (6.10.9.1) and are treated as unstiffened in TS4, which decides the web shear');
+  if (ts5x('warn')) out.push('TS5 warnings: end panels wider than 1.5D (6.10.9.1); TS4 checks them with V_n = CV_p and k from d_o');
   if (panel.length) out.push(`Panel shear or spacing fails at ${[...new Set(panel)].join('; ')}: these depend on the stiffener spacing (Framing tab in Preliminary sizing), not the plate size`);

## 2026-10-13 — PR: claude/plateline-quick-checked (engineer's decisions 2026-10-12; PR link added after merge)

All changes are inside the embedded PlateLine (Preliminary sizing) page, the base64 string `const PL_B64 = '...'` of `Steel Bridge Beam Modules.html` (decode, edit, re-encode on one line). The main page code is not changed. The exact changes to the decoded page are the unified diff at the end of this entry; line numbers (PL ≈) refer to the decoded page.

### SQ1. Quick suggestion is checked for strength and service and fixed (plates only increase)   [§4: the quick suggestion's plates can increase] [no formula, factor, or check changed]

- **Where:**
  - New `async function suggestQuickCheck(P, fast, prog, cancelled)` (PL ≈ 2327), directly after `suggestFull`. Anchor `/* Quick suggestion: strength and service check and fix of the fast result`.
  - `checkLayout()` inside `suggestLayout` (PL ≈ 2175). Anchor `const tT = new Array(N).fill(''), tB = new Array(N).fill('');`. Records the girder type ('int'/'ext') of each governing ratio (`tT`, `tB`, `tWeb`), reporting only; every ratio is computed exactly as before.
  - UI: `sgQKey()`, `maybeSuggest()`, new `sgQuickStart()`, `sgGov()`, `sgGovTxt()`, `sgApplyLbl()`, `applySuggestion()` (PL ≈ 2700–2780). Anchor `let SGQ_RUN = 0, SGQ_APPLY = 0;`.
- **What it does:** after the fast result (`suggestLayout(P)`, unchanged: cost-based depth and web pick, constant-EI beam, lever-arm flange areas) is shown, `sgQuickStart()` runs `suggestQuickCheck` in the background on a copy of the project:
  1. `V = suggestLayout(P, { full: true, verify: { D, wt, doR, top, bot, web, splices } })` — the same staged verify Full design uses (interior and exterior girders, both sides of plate boundaries, `dOK` = Table 2.5.2.6.3-1 depth rule as Full design applies it).
  2. Pass = `check.max ≤ 1.0005 && check.rWeb ≤ 1.0005 && dOK` (Full design's criterion).
  3. If not passing: required area at every node = `max(A_cur, A × min(1.01·r/0.97, 1.35))` where r > 1.0005, else `A_cur` (A_cur = larger plate area on either side of the node; at a field splice, the plate of the piece on the right, the piece the node belongs to in `sizeFlanges`; A = area where the ratio was found, `check.aT/aB`). Symmetric bridge (spans and skews palindromic): each node takes the larger of itself and the nearest node of the mirrored field piece. Web: `twMin = tw + incTw` where `rWeb > 1.0005` (as `suggestFull`'s refine); `twMin` starts at the fast `tw`.
  4. Re-size with `suggestLayout(P, { only: {D, wt, doR}, kT: { areq: true, top, bot }, twMin, shifts })` (fast demand for splices and shear, as before), refuse the result if any node's plate area or the web thickness would decrease (stops with a note), stop if the layout does not change, re-verify; at most 8 rounds.
  Depth, web type, d<sub>o</sub>/D and splice shifts of the fast pick are kept. If it still fails, the card says so and names the ratio.
- **Not changed:** `suggestFull` (Full design) still calls `suggestLayout(P)` fast only and never calls the check (results bit-identical, below). The deck-width study (`wsCase`), Full design of the best N (`wsfRun`), the Alternatives study and the web-economy comparison call `suggestLayout` directly and are unchanged (fast sizing, used for ranking).
- **Async behaviour:** run token `SGQ_RUN` (like `WS_RUN`): every new fast result (an edit; `maybeSuggest` is already debounced 60 ms) starts a new run and the old one stops at its next step. The card shows the fast result as "checking…" with a progress bar, then is replaced by the checked result. `sgQKey()` = `sgKey()` + `P.framing`, `P.analysis`, `P.costs`, because the check uses the cross-frame spacing and analysis settings: a change there re-runs the quick suggestion when the Suggest tab is shown (a Full design result keeps its old staleness rule, `sgKey()` only). `maybeSuggest(true)` with unchanged inputs (print) keeps the checked or checking result instead of recomputing it.
- **Apply during the check:** queued. The buttons read "Apply quick suggestion (when checked)" and a message says it will be applied after confirmation when the check finishes; then the usual confirm appears for the checked result. If the inputs change before that, the queued apply is dropped with a message (applying a layout for inputs the user is still editing would be wrong). Chosen over "apply the fast result now" because the fast result may fail strength or service.
- **§4 callout:** no formula, load factor, resistance factor, unit or code reference changes; the checks are the existing `checkLayout` checks (AASHTO LRFD 10th Ed. 6.10.7, 6.10.8, 6.10.4.2.2, 6.10.3.2, 6.6.1.2, 6.10.1.10 Table 2.5.2.6.3-1 depth rule). What changes is the quick suggestion's plates: before, the fast sizing was returned as is; after, plates are increased where the staged checks exceed 1.0. Before/after (Suggest result applied, then GirderDetail's Girder section module via `getDemands('pl')`):

  | Case | Before (main): fast plates, verify max | Girder section module, before | After: plates, verify max | Girder section module, after |
  |---|---|---|---|---|
  | 90 ft simple, 10 girders at 4.0 ft, overhangs 2.25 ft, span-to-depth off (engineer's repro) | D 30 × 1/2; top 13 × 3/4; bottom 15 × 1 1/4; 0.852 (Fatigue I C′ at connection plates, bottom flange, 39 ft) | no fail, no warning | unchanged (the fast result passes: 0 rounds), 0.852 | no fail, no warning |
  | Built-in example 110-140-110 ft, 5 girders at 9.5 ft | D 63; bottom end pieces 16 × 1 1/8, pier plates 20 × 7/8 – 1 5/8 – 7/8 at 16/26/16 ft; 1.046 (Fatigue I C′, bottom flange, 301 ft, exterior) | no fail, no warning | 1 round: bottom end pieces 16 × 1 1/4; pier plates 15/28/15 ft (bottom) and 16/26/16 ft (top); 0.987 (Fatigue I C′, bottom flange, 60 ft, exterior); cost $1,696,419 → $1,719,411 | no fail, no warning |
  | 60 ft simple, 4 girders at 12 ft, overhangs 3 ft | top 12 × 3/4; 1.012 (constructibility, compression flange, 30 ft) | GS14 Deck placement: compression flange fails | 1 round: top 12 × 7/8; 0.877 | no fail, no warning |
  | 160 ft simple, 5 girders at 9 ft, overhangs 3 ft | web 78 × 1/2; web ratio 1.083 (constructibility web bend-buckling, 80 ft) | GS1 web D/t<sub>w</sub> = 156 > 150 fails; GS15 web bend-buckling 1.08 | 1 round: web 78 × 9/16, flange plate sizes unchanged (the thicker plates extended 1 ft toward the ends); 0.830 | no fail, no warning |
  | 80-80-80 ft, 5 girders at 9 ft, overhangs 3 ft | 1.143 (Fatigue I C′, bottom flange, 111 ft) | GS19 moment reversal warning only | 1 round: bottom end pieces 14 → 15 × 1 1/8, middle 14 × 3/4 → 14 × 1; 0.986 | GS19 warning only |

  Worked check case (60 ft row): top flange 12 × 0.75 = 9.00 in², ratio r = 1.012 at 30 ft. Required area = 9.00 × min(1.01 × 1.012/0.97, 1.35) = 9.00 × 1.0537 = 9.48 in². Width unchanged (12 in), t = 9.48/12 = 0.790 → rounded up to the 1/8 in increment = 7/8 in (10.50 in²). Re-verify: 0.877 ≤ 1.0, stop.
  The engineer's "exterior positive flexure 1.01 with D<sub>p</sub>/D<sub>t</sub>" case does not reproduce on current main for the 90 ft repro (the fast result there now passes both PlateLine's verify and the Girder section module); the 60, 160, and 80-80-80 ft cases above show the same kind of failure being fixed.
- **Runtimes (headless Chromium, this container):** fast result 0.04–1.4 s (unchanged); the check afterwards 0.01–0.8 s over 25 layouts (60–200 ft simple, two- and three-span units up to 150-190-150 ft). Built-in example: fast ≈ 1.0 s, check ≈ 0.45 s (1 round). 90 ft repro: fast ≈ 0.3 s, check ≈ 0.03 s (0 rounds). A contrived failing case (160 ft with "Keep current web depth" at 36 in): 8 rounds, still 1.009, reported on the card.

### SQ2. Names and labels   [UI text only]

- Card title (`renderSuggest`, card `sg-sum`, id unchanged): "Suggested layout" → "Quick suggestion (updates as you edit) — checked for strength and service" (while checking: "… — checking strength and service…"); with a Full design result: "Full design (Run full design) — optimized for least steel".
- Card banner: states the strength/service result — "Passes the strength and service checks: largest ratio X" or "Does not pass every strength and service check: largest ratio X", "Governing: check, flange or web at x ft (Span k), interior/exterior girder", the rounds of plate increases (or "The fast sizing passed as is; no plate was changed"), and "Run full design for a layout that passes" when it fails; the proportion-check counts are kept as the last line.
- Apply buttons `#sg_apply` ("Apply to girder") and `#sg_apply_side` ("Apply suggestion to the girder") → "Apply quick suggestion" / "Apply full design" by what is shown (`sgApplyLbl()`).
- Undo label (`snapshotBefore`): "Suggested layout" → "Quick suggestion" or "Full design" (label text inside the existing `plateline_undo_v1` record; key and format unchanged).
- Top info alert of the Suggest tab, cost card title ("Cost of the quick suggestion"), the cost note (fast sizing before the check, and what the check added), candidates header "Candidates (fast mode, lowest cost first)" → "Depth candidates (fast sizing before the strength and service check, lowest cost first)", Full design table header "Fast-mode cost" → "Fast-sizing cost", a "Fast sizing shown" note on the web and flange-sizing cards when the check changed plates, and two bullets of "Assumptions and limitations of the suggestion".
- Suggest input-pane note above Run full design (quick vs full in plain words).
- Notes of the girder-count study (input pane, results table, "Full design of the best N"), the Alternatives input note: "fast mode" → "fast sizing (without the quick suggestion's strength and service check)" so they stay accurate.
- Manual: Part 1 bullet "Suggest mode is not a design" and "Suggest mode analysis is approximate"; Part 2 "Fast and full design" → "Quick suggestion and full design" (quick = cost-based depth pick + lever-arm sizing, then checked and plates increased until strength/service pass, not necessarily the lightest; full = staged analysis + AASHTO checks iterating plates up and down for least steel), the two references to it in the girder-count paragraphs; Part 6 (Suggest mode methodology) new subsection "Strength and service check of the quick suggestion"; Part 8 (TS&L) alternatives sentence.

### SQ3. Apply warns when the shown result does not pass   [confirm text]

- `applySuggestion()`: if the quick suggestion did not pass (or could not be checked), or a Full design result did not pass, the confirm starts with "Warning: the quick suggestion does not pass every strength and service check: ratio 1.009 > 1.0 (Strength I, positive flexure (6.10.7.1), bottom flange at 107.00 ft, exterior girder); the girder is also shallower than the Table 2.5.2.6.3-1 minimum depth. Run full design (Suggest input tab) for a layout that passes." (Full design: "Review the Full design results, adjust the inputs, and run full design again before relying on it.")

### SQ4. Channel / W diaphragm depth text   [text only]

- `xfNoteHtml()` (Suggest recommendation, PL ≈ 3717). Before: "channel (C, MC, depth about half the girder depth or more) or rolled W diaphragms; check them in GirderDetail's Cross-frames module." After: "channel (C, MC) or rolled W diaphragms at least 0.75 of the girder depth, ${f2(0.75 * d)} in (AASHTO 6.7.4.2, plate girders); check them in GirderDetail's Cross-frames module." Matches GirderDetail's Cross-frames CFD depth item (CF-D1). The Framing tab and manual had no "half the depth" text.

### Verification and open items (SQ1 to SQ4)

- `node --check` on the decoded page's script; no console errors in any run.
- Main vs branch, built-in example (headless Chromium, `cmp.mjs`): fast `suggestLayout(P)` result identical; deck-width study rows (W = 44.5 ft) and table HTML identical; Run full design result identical (D, plates, splices, cost, every candidate, and the check arrays; the check object only gains `tT`, `tB`, `tWeb`), table HTML differs only in the header "Fast-sizing cost"; Full design took 22 s on both.
- Before/after table above from `gs.mjs` (apply, then Girder section module).
- UI (`ui.mjs`, screenshots under the session scratchpad `followups/sg-quick/`): card while checking, after the check, Apply pressed while checking (queued, applied after confirmation with the checked plates, undo label "Quick suggestion"), edit during the check (the old run is dropped, only the latest finishes), a failing case card and its Apply warning, input-pane note, manual paragraph, Full design title and buttons ("Apply full design", undo label "Full design").
- Saved data: localStorage keys unchanged (`plateline_autosave_v1`, `plateline_undo_v1`, `girderdetail_*`); an autosave written by the branch loads in main with an identical project and vice versa. No project format change; the quick check result is not saved.
- **Open items:** (1) the check uses Full design's tolerance (ratios ≤ 1.0005 pass), so a reported 1.000 can be up to 1.0005. (2) The quick fix only increases plates at the chosen depth; when the depth itself is too shallow (kept depth or span-to-depth), it can stop above 1.0 and the card says so. (3) In the built-in example, PlateLine's Category C′ fatigue check (connection plates at every cross-frame) governs at 1.046 while GirderDetail's Girder section module showed no failure on the same plates; the two models differ (left as is).
- **Other copies:** none.

### Exact changes (SQ1 to SQ4): decoded PlateLine (unified diff)

```diff
--- PL (main 44bdca0)
+++ PL (after SQ1-SQ4)
@@ -740,6 +740,8 @@
 .sg-head.pass { background: var(--pass-dim); } .sg-head.fail { background: var(--fail-dim); }
 .sg-head b { display: block; font-size: 14px; } .sg-head.pass b { color: var(--pass); } .sg-head.fail b { color: var(--fail); }
 .sg-head span { font-size: 12.5px; color: var(--text-dim); }
+.sg-head span.sg-ln { display: block; margin-top: 3px; } .sg-head > div:first-child { flex: 1 1 320px; }
+.sg-head.chk { background: color-mix(in oklab, var(--ink, #1d56a3) 8%, transparent); } .sg-head.chk b { color: var(--ink, #1d56a3); } .sg-head .sg-prog-bar { margin: 8px 0 4px; max-width: 520px; }
 .sg-h4 { font-size: 13px; font-weight: 650; margin: 4px 0 4px; }
 .sgtbl td { vertical-align: top; font-size: 12.5px; }
 #tab-suggest.busy { opacity: .55; transition: opacity .2s; }
@@ -2170,7 +2172,8 @@
     sgLists(top, bot, web);
     const E = ES, Fy = FyF, Fyw = FyW, Lb = spCF * 12, reb = (num((P.analysis || {}).rebar) || 1) / 100, rt3 = Math.sqrt(E / Fy);
     const rT = new Float64Array(N), rB = new Float64Array(N), aT = new Float64Array(N), aB = new Float64Array(N), gT = new Array(N).fill(''), gB = new Array(N).fill(''); let rWeb = 0, gWeb = '', xWeb = 0; const other = [];
-    let aNow = { T: 0, B: 0 }; const put = (arr, g, i, r, name) => { if (r > arr[i]) { arr[i] = r; g[i] = name; (arr === rT ? aT : aB)[i] = arr === rT ? aNow.T : aNow.B; } };
+    const tT = new Array(N).fill(''), tB = new Array(N).fill(''); let gtNow = '', tWeb = '';   // girder type of each governing ratio (reporting only)
+    let aNow = { T: 0, B: 0 }; const put = (arr, g, i, r, name) => { if (r > arr[i]) { arr[i] = r; g[i] = name; (arr === rT ? aT : aB)[i] = arr === rT ? aNow.T : aNow.B; (arr === rT ? tT : tB)[i] = gtNow; } };
     const FAT = SG.fat !== 'off', thB = 16.0, thC = 12.0;   // Fatigue I: Category B at the flange-to-web welds; Category C′ at connection plates welded to the flanges (6.6.1.3.1)
     const Fcrw = (Dc, tw) => Math.min(0.9 * E * (9 / Math.max(Dc / D, 0.05) ** 2) / (D / tw) ** 2, Fy, Fyw / 0.7);
     const Fnc = (bf, tf, Dc, tw, Rb1, Cb = 1, ltbOnly = false, bL = bf, tL = tf) => { const Fyr = Math.min(0.7 * Fy, Fyw), lf = bf / (2 * tf), lpf = 0.38 * rt3, lrf = 0.56 * Math.sqrt(E / Fyr), lrw = 5.7 * rt3;
@@ -2183,7 +2186,7 @@
     const seg = x => { let k = 0; for (let q = 1; q < supX.length; q++) if (Math.abs(supX[q] - x) < Math.abs(supX[k] - x)) k = q; const xp = supX[k], sg = x >= xp ? 1 : -1, lim = sg > 0 ? (supX[k + 1] ?? xp) : (supX[k - 1] ?? xp);
       const j = Math.floor(Math.abs(x - xp) / spCF + 1e-9), a = xp + sg * j * spCF, b = xp + sg * Math.min((j + 1) * spCF, Math.abs(lim - xp)); return sg > 0 ? [a, Math.max(a + 1e-3, b)] : [Math.min(a - 1e-3, b), a]; };
     const cbAt = (M, x, sgn) => { const [a, b] = seg(x); return feCb(xs, M, a, b, sgn); }; let cbMax = 1;
-    for (const gt of types) { const T = R.types[gt], beff = T.trW * 12;
+    for (const gt of types) { const T = R.types[gt], beff = T.trW * 12; gtNow = gt;
       // flange lateral bending from skew (C6.10.1 estimate, factored), on the discretely braced bottom flange; the same value Girder section receives
       const skM = Math.max(...(P.bridge.skews || [0]).map(v => Math.abs(+v || 0))), Lm = P.limits || {}, fl = skM > 20 + 1e-9 ? (parseFloat(Lm.flSkG) || 1.25) * (gt === 'ext' ? (parseFloat(Lm.flSkE) || 7.5) : (parseFloat(Lm.flSkI) || 10)) : 0, flS = fl > 0 ? fl / (parseFloat(Lm.flSkG) || 1.25) : 0;   // flS: unfactored f_l for Service II (Eq. 6.10.4.2.2-2)
       for (let i = 0; i < N; i++) for (const side of [-1, 1]) {
@@ -2215,17 +2218,17 @@
           if (fb > 0) { const Cb = cbAt(T.Mun, x, -1), sm = segMinBot(x); cbMax = Math.max(cbMax, Cb); put(rB, gB, i, (fb + fl / 3) / Fnc(b.b, b.t, Dc, tw, false, Cb, false, sm.b, sm.t), fl ? 'Strength I, negative, compression flange with skew f_ℓ (6.10.8.1.1)' : 'Strength I, negative, compression flange (6.10.8.2)'); }
           if (ft > 0) put(rT, gT, i, ft / Fy, 'Strength I, negative, tension flange (6.10.8.3)');
           const sb = -(M1 * 12 / Sb.s + (M2 + Mw + 1.3 * Ln) * 12 / Sb.cr), st_ = -(M1 * 12 / St.s + (M2 + Mw + 1.3 * Ln) * 12 / St.cr);
-          if (sb > 0) { put(rB, gB, i, (sb + flS / 2) / (0.95 * Fy), flS ? 'Service II, negative, with skew f_ℓ/2 (6.10.4.2.2)' : 'Service II, negative (6.10.4.2.2)'); const rw = sb / Fcrw(Dc, tw); if (rw > rWeb) { rWeb = rw; gWeb = 'Service II web bend-buckling (6.10.4.2.2)'; xWeb = x; } }
+          if (sb > 0) { put(rB, gB, i, (sb + flS / 2) / (0.95 * Fy), flS ? 'Service II, negative, with skew f_ℓ/2 (6.10.4.2.2)' : 'Service II, negative (6.10.4.2.2)'); const rw = sb / Fcrw(Dc, tw); if (rw > rWeb) { rWeb = rw; gWeb = 'Service II web bend-buckling (6.10.4.2.2)'; xWeb = x; tWeb = gtNow; } }
           if (st_ > 0) put(rT, gT, i, st_ / (0.95 * Fy), 'Service II, negative (6.10.4.2.2)');
         }
         // constructibility, deck placement on the steel section (6.10.3.2)
         const Mc = T.Mc[i];
         if (Mc > 0) { const fc = Mc * 12 / St.s, Dc = d - ybs - t.t; put(rT, gT, i, fc / Fnc(t.b, t.t, Dc, tw, true, cbAt(T.Mc, x, 1)), 'Constructibility, compression flange (6.10.3.2.1)'); put(rB, gB, i, Mc * 12 / Sb.s / Fy, 'Constructibility, tension flange (6.10.3.2.2)');
-          const rw = fc / Fcrw(Dc, tw); if (rw > rWeb) { rWeb = rw; gWeb = 'Constructibility web bend-buckling (6.10.3.2.1)'; xWeb = x; } }
+          const rw = fc / Fcrw(Dc, tw); if (rw > rWeb) { rWeb = rw; gWeb = 'Constructibility web bend-buckling (6.10.3.2.1)'; xWeb = x; tWeb = gtNow; } }
         else if (Mc < 0) { const fc = -Mc * 12 / Sb.s, Dc = ybs - b.t; put(rB, gB, i, fc / Fnc(b.b, b.t, Dc, tw, true, cbAt(T.Mc, x, -1)), 'Constructibility, compression flange (6.10.3.2.1)'); put(rT, gT, i, -Mc * 12 / St.s / Fy, 'Constructibility, tension flange (6.10.3.2.2)'); }
       } }
     const max = Math.max(...rT, ...rB);
-    return { rT, rB, aT, aB, gT, gB, rWeb, gWeb, xWeb, max, other, Lb: spCF, fat: FAT, cbMax };
+    return { rT, rB, aT, aB, gT, gB, tT, tB, rWeb, gWeb, xWeb, tWeb, max, other, Lb: spCF, fat: FAT, cbMax };
   }
   function sgPlastic(q, D, beff, t, b, tw) {   // positive plastic moment (App. D6.1), deck rebar ignored, haunch concrete ignored
     const tb = b.t, tt = t.t, d = tb + D + tt, y0 = d + hh, y1 = y0 + ts, Fy = FyF, Fw = FyW;
@@ -2313,6 +2316,47 @@
     full: { cands: out.map(o => ({ D: o.D, wt: o.wt, doR: o.doR, spacing: o.spacing, pass: o.pass, dOK: o.dOK, iters: o.iters, max: o.check.max, web: o.check.rWeb, cost: o.cost, fastCost: o.fastCost, defl: o.defl, best: o === best })), check: ch, topGov: gov(res.top, ch.rT, ch.gT), botGov: gov(res.bot, ch.rB, ch.gB), passed: best.pass, fastCost: fast.cost } };
 }
 
+/* Quick suggestion: strength and service check and fix of the fast result (approved 2026-10-12).
+   The fast result (suggestLayout(P): cost-based depth pick, constant-stiffness beam, lever-arm flange areas) is verified with the
+   same staged analysis and AASHTO checks as Full design (opts.verify: interior and exterior girders, both sides of every plate
+   boundary, and the Table 2.5.2.6.3-1 depth rule as Full design applies it). Where a flange ratio exceeds 1.0, the required area at
+   that node is raised with Full design's area factor (f = r/0.97, times 1.01, at most 1.35 per round), and never set below the plate
+   already there, so plates only increase; the web is thickened by one increment where its ratio exceeds 1.0 (as in Full design).
+   The layout is re-sized (opts.only with kT.areq, the fast demand for splices and shear) and re-verified, at most 8 rounds.
+   Depth, web type, d_o/D, and splice shifts of the fast pick are kept. Full design (suggestFull) does not use this. */
+async function suggestQuickCheck(P, fast, prog, cancelled) {
+  const tick = () => new Promise(r => setTimeout(r, 0)), OK = 1.0005, t0 = performance.now(), MAXIT = 8;
+  const cc = { D: fast.D, wt: fast.webType, doR: fast.doR }, shifts = fast.shifts, incTw = num(P.limits.incTw) || 0.0625;
+  const cp = l => l.map(r => ({ ...r })), pass = v => v.check.max <= OK && v.check.rWeb <= OK && v.dOK;
+  const ver = L => suggestLayout(P, { full: true, verify: { ...cc, top: cp(L.top), bot: cp(L.bot), web: cp(L.web), splices: [...L.splices] } });
+  const areaAt = (list, x) => { const g = sgAt(list, x); return g.b * g.t; };
+  const spn = (P.bridge.spans || []).map(Number), skw = (P.bridge.skews || []).map(v => Math.abs(+v || 0)), pal = a => a.every((v, i) => Math.abs(v - a[a.length - 1 - i]) < 1e-6), symB = pal(spn) && pal(skw);
+  let lay = { top: cp(fast.top), bot: cp(fast.bot), web: cp(fast.web), splices: [...fast.splices], tw: fast.tw };
+  prog && prog(0.05, 'Strength and service check of the fast result'); await tick(); if (cancelled()) return null;
+  let V = ver(lay); const V0 = V; let it = 0, twMin = fast.tw, note = '';
+  while (!pass(V) && it < MAXIT) {
+    const ch = V.check, xs = V.xs; sgLists(lay.top, lay.bot, lay.web); const Lt = lay.top.reduce((a, g) => a + g.L, 0);
+    const atSpl = x => lay.splices.some(v => Math.abs(v - x) < 1e-6), pieceOf = x => x >= Lt - 1e-6 ? lay.splices.length : lay.splices.filter(v => v <= x + 1e-6).length;   // a node at a field splice belongs to the piece on its right (sizeFlanges)
+    const a0 = (list, x) => atSpl(x) ? areaAt(list, Math.min(x + 1e-6, Lt)) : Math.max(areaAt(list, Math.max(x - 1e-6, 0)), areaAt(list, Math.min(x + 1e-6, Lt)));
+    const req = (list, rr, aa) => Float64Array.from(xs, (x, i) => { const cur = a0(list, x), q = rr[i]; if (!(q > OK)) return cur; const f = q / 0.97; return Math.max(cur, (aa[i] || cur) * Math.min(f * 1.01, 1.35)); });
+    const kT = { areq: true, top: req(lay.top, ch.rT, ch.aT), bot: req(lay.bot, ch.rB, ch.aB) };
+    if (symB) { const nP = lay.splices.length + 1, mir = xs.map(x => { const q = nP - 1 - pieceOf(x); let j = -1; xs.forEach((y, k) => { if (pieceOf(y) === q && (j < 0 || Math.abs(y - (Lt - x)) < Math.abs(xs[j] - (Lt - x)))) j = k; }); return j; });   // symmetric bridge: symmetric required areas (the larger of each mirrored pair, nearest node of the mirrored field piece)
+      ['top', 'bot'].forEach(fk => { const A = kT[fk], B2 = Float64Array.from(A); mir.forEach((j, i) => { if (j >= 0) B2[i] = Math.max(A[i], A[j]); }); kT[fk] = B2; }); }
+    if (ch.rWeb > OK) twMin = lay.tw + incTw;
+    const r = suggestLayout(P, { only: cc, kT, twMin, shifts }); if (r.errors && r.errors.length) { note = r.errors[0]; break; }
+    const nl = { top: r.res.top, bot: r.res.bot, web: r.res.web, splices: r.res.splices, tw: r.res.tw }; sgLists(nl.top, nl.bot, nl.web); sgLists(lay.top, lay.bot, lay.web);
+    // plates only increase: every node, both sides, both flanges, and the web
+    const lower = nl.tw < lay.tw - 1e-9 || xs.some(x => [-1e-6, 1e-6].some(d => { const xx = Math.min(Math.max(x + d, 0), Lt); return areaAt(nl.top, xx) < areaAt(lay.top, xx) - 1e-6 || areaAt(nl.bot, xx) < areaAt(lay.bot, xx) - 1e-6; }));
+    if (lower) { note = 'resizing would have reduced a plate'; break; }
+    const key = L => JSON.stringify([L.tw, L.splices, L.top.map(g => [g.L, g.b, g.t]), L.bot.map(g => [g.L, g.b, g.t])]);
+    if (key(nl) === key(lay)) { note = 'no plate change can raise the capacity further'; break; }
+    lay = nl; it++;
+    prog && prog(Math.min(0.95, 0.1 + 0.85 * it / MAXIT), `Plates increased, round ${it}: re-checking`); await tick(); if (cancelled()) return null;
+    V = ver(lay);
+  }
+  return { lay, V, V0, iters: it, pass: pass(V), changed: it > 0, note, ms: performance.now() - t0 };
+}
+
 
 /* =====================================================================
    Built-in user manual
@@ -2326,7 +2370,7 @@
 <h3>What this app does NOT do</h3>
 <ul>
 <li><b>No strength, service, fatigue, or constructibility design.</b> Flexure, shear, Service II, fatigue, and deck-casting checks need moment and shear demands. Use your analysis and design apps.</li>
-<li><b>Suggest mode is not a design.</b> Its demands are approximate (constant EI, simplified flange-area estimates, no fatigue, no lateral-torsional buckling calculation). A suggested layout must be verified with a full analysis and design; see Part 6.</li>
+<li><b>Suggest mode is not a design.</b> Its sizing is approximate (constant EI, simplified flange-area estimates). The quick suggestion and Full design are then checked with a staged analysis and the main AASHTO strength, service, constructibility, and flange fatigue checks, but not every design check. A suggested layout must be verified with a full analysis and design; see Part 6.</li>
 <li><b>No curved girders.</b> Horizontally curved girders need flange lateral bending and refined analysis. A curved layout is flagged as a failure (G9) rather than checked.</li>
 <li><b>No longitudinally stiffened webs.</b> Webs with D/t<sub>w</sub> above 150 fail W1; the provisions of 6.10.2.1.2 and 6.10.11.3 are not implemented.</li>
 <li><b>No variable-depth (haunched) girders, box girders, or rolled beams with cover plates.</b> The web depth is constant along the girder.</li>
@@ -2344,7 +2388,7 @@
 <h4>Splice location is judged by a band, not by the dead load moment diagram</h4>
 <p>AASHTO 6.13.6.1.1 places splices at or near dead load contraflexure. Without analysis, the app uses a band measured from the nearest interior support as a fraction of the span containing the splice (default 0.15 to 0.30). Confirm against the actual dead load moment diagram.</p>
 <h4>Suggest mode analysis is approximate</h4>
-<p>Suggest mode assumes constant flexural stiffness along the girder and for all load cases, sizes flanges from force-couple lever arms rather than section analysis, reduces compression flange capacity with a single efficiency factor, ignores slab reinforcement in negative flexure, and does not apply the skew reduction for moment. Its results are a starting point only.</p>
+<p>Suggest mode assumes constant flexural stiffness along the girder and for all load cases, sizes flanges from force-couple lever arms rather than section analysis, reduces compression flange capacity with a single efficiency factor, ignores slab reinforcement in negative flexure, and does not apply the skew reduction for moment. The quick suggestion and Full design then check the sized girder with the staged analysis and AASHTO checks; the girder-count and Alternatives studies use the fast sizing only. Its results are a starting point only.</p>
 <h4>Integral abutment limits and unit costs are placeholders</h4>
 <p>The integral abutment length and skew limits and all unit prices must be set from the owner manual and recent bid tabs before the related results are relied on.</p>
 <h4>Weights exclude cross-frames</h4>
@@ -2354,11 +2398,11 @@
 <div class="alert warn"><b>This app is an engineering aid, not a substitute for engineering judgment.</b> The user is responsible for the design, for verifying every limit in use, and for confirming that the layout satisfies all strength, service, fatigue, and constructibility requirements through analysis.</div>`],
 
 ['p2', 'Using the program', `
-<h3>Girder count from the deck width</h3><p>With an <b>Out-to-out deck width</b> W on the Suggest input tab, <b>Suggest girder count, spacing, and overhangs</b> compares girder counts. For each N from 3, every overhang on a 0.25 ft grid within the limits gives S = (W &minus; 2&middot;overhang)/(N &minus; 1); a layout is kept when S, the overhang (also &le; a fraction of S), and d<sub>e</sub> = overhang &minus; barrier (or curb) width are within the limits (defaults: overhang 1.5 to 4.0 ft and &le; 0.5S; d<sub>e</sub> &minus;1.0 to 5.5 ft; S 3.5 to 16 ft, the ranges of the 4.6.2.2 equations; verify / owner). The overhang limits used are the stricter of these settings and the Limits tab overhang limits of check G6 (overhang / S and maximum overhang, 0.40S and 4.0 ft by default), so the study never proposes an overhang that G6 warns about; the results note says which value governs. Of those, the overhang whose exterior and interior girder live load moment distribution factors (this tool's 4.6.2.2 equations, longest span) are closest is used (ties: nearest 0.375S); the girder is then sized with Suggest (fast mode) and checked like an alternative. The table lists N, S, overhang, d<sub>e</sub>, the factors, the section, the steel per girder and in total (lb/ft<sup>2</sup> of deck), the governing ratio of the layout checks, the bracing type from the girder depth, and pass/fail. The recommendation is the passing row with the least total steel (or the fewest girders, if chosen). Nothing changes until you press Apply. With W blank, Suggest uses the girder count and spacing on the Bridge tab as before. Distribution factors are an estimate for comparing layouts: run LL &amp; DL for the chosen layout.</p>
-<p><b>Fast study, then full design of the best few.</b> The study sizes every girder count with Suggest's <i>fast mode</i>: one constant-stiffness continuous-beam model, flange areas from lever-arm estimates, and only this tool's layout checks (proportions, transitions, splices, framing), with no strength, service, or fatigue check. That makes it quick enough to try every girder count, but its weights are a ranking aid. The overhang of each row is chosen with the K<sub>g</sub> of a trial girder sized at the overhang nearest 0.375S. When the study finishes, the Suggest tab offers <b>Full design of the best N</b> (N on the Suggest input tab, default 3, at most 5). It takes the best N rows (by the objective: passing rows first, then the others by governing ratio) and runs Full design (see <i>Fast and full design</i> below) on each with that row's girder count, spacing, and overhangs, on a copy of the project: each iteration re-runs the staged analysis of the current plates (DC1 on the steel section; DC2 and DW on the long-term composite section, 3n; live load on the short-term composite section, n; cracked near interior piers), recomputes the 4.6.2.2 distribution factors from that section's K<sub>g</sub>, checks every node, and resizes; the live load model of the first iteration is reused inside the loop, and the final verification recomputes everything, so the pass/fail of each row comes from fully recomputed demands. The girder count, spacing, and overhangs are kept from the fast study. Full design takes about 20 to 60 s for each girder count, which is why it runs only for the best few and only when you press the button (it can be cancelled). The results table lists the full-design section, cross-frame spacing, steel per girder, total and per deck area (with the fast-study value beside it), the largest ratio of the final verification, the interior and exterior moment distribution factors of the final girder (longest span), the iterations, and pass/fail (every full-design check at or below 1.0 and no failing layout check; failing Analysis tab checks A1 to A3 are named beside it but do not decide it, because they depend on the bearing stiffener and bearings, which Suggest does not size); the recommendation follows the same objective. Apply sets the girder count, spacing, overhangs, plates, splices, stiffener setting, and cross-frame spacing (Revert restores the previous design). The result is still preliminary: run LL &amp; DL (lldf) for the chosen layout and complete the design checks in GirderDetail.</p>
+<h3>Girder count from the deck width</h3><p>With an <b>Out-to-out deck width</b> W on the Suggest input tab, <b>Suggest girder count, spacing, and overhangs</b> compares girder counts. For each N from 3, every overhang on a 0.25 ft grid within the limits gives S = (W &minus; 2&middot;overhang)/(N &minus; 1); a layout is kept when S, the overhang (also &le; a fraction of S), and d<sub>e</sub> = overhang &minus; barrier (or curb) width are within the limits (defaults: overhang 1.5 to 4.0 ft and &le; 0.5S; d<sub>e</sub> &minus;1.0 to 5.5 ft; S 3.5 to 16 ft, the ranges of the 4.6.2.2 equations; verify / owner). The overhang limits used are the stricter of these settings and the Limits tab overhang limits of check G6 (overhang / S and maximum overhang, 0.40S and 4.0 ft by default), so the study never proposes an overhang that G6 warns about; the results note says which value governs. Of those, the overhang whose exterior and interior girder live load moment distribution factors (this tool's 4.6.2.2 equations, longest span) are closest is used (ties: nearest 0.375S); the girder is then sized with Suggest's fast sizing (without the quick suggestion's strength and service check) and checked like an alternative. The table lists N, S, overhang, d<sub>e</sub>, the factors, the section, the steel per girder and in total (lb/ft<sup>2</sup> of deck), the governing ratio of the layout checks, the bracing type from the girder depth, and pass/fail. The recommendation is the passing row with the least total steel (or the fewest girders, if chosen). Nothing changes until you press Apply. With W blank, Suggest uses the girder count and spacing on the Bridge tab as before. Distribution factors are an estimate for comparing layouts: run LL &amp; DL for the chosen layout.</p>
+<p><b>Fast study, then full design of the best few.</b> The study sizes every girder count with Suggest's <i>fast sizing</i> (without the quick suggestion's strength and service check): one constant-stiffness continuous-beam model, flange areas from lever-arm estimates, and only this tool's layout checks (proportions, transitions, splices, framing), with no strength, service, or fatigue check. That makes it quick enough to try every girder count, but its weights are a ranking aid. The overhang of each row is chosen with the K<sub>g</sub> of a trial girder sized at the overhang nearest 0.375S. When the study finishes, the Suggest tab offers <b>Full design of the best N</b> (N on the Suggest input tab, default 3, at most 5). It takes the best N rows (by the objective: passing rows first, then the others by governing ratio) and runs Full design (see <i>Quick suggestion and full design</i> below) on each with that row's girder count, spacing, and overhangs, on a copy of the project: each iteration re-runs the staged analysis of the current plates (DC1 on the steel section; DC2 and DW on the long-term composite section, 3n; live load on the short-term composite section, n; cracked near interior piers), recomputes the 4.6.2.2 distribution factors from that section's K<sub>g</sub>, checks every node, and resizes; the live load model of the first iteration is reused inside the loop, and the final verification recomputes everything, so the pass/fail of each row comes from fully recomputed demands. The girder count, spacing, and overhangs are kept from the fast study. Full design takes about 20 to 60 s for each girder count, which is why it runs only for the best few and only when you press the button (it can be cancelled). The results table lists the full-design section, cross-frame spacing, steel per girder, total and per deck area (with the fast-study value beside it), the largest ratio of the final verification, the interior and exterior moment distribution factors of the final girder (longest span), the iterations, and pass/fail (every full-design check at or below 1.0 and no failing layout check; failing Analysis tab checks A1 to A3 are named beside it but do not decide it, because they depend on the bearing stiffener and bearings, which Suggest does not size); the recommendation follows the same objective. Apply sets the girder count, spacing, overhangs, plates, splices, stiffener setting, and cross-frame spacing (Revert restores the previous design). The result is still preliminary: run LL &amp; DL (lldf) for the chosen layout and complete the design checks in GirderDetail.</p>
 <h3>Suggest: lowest-cost layout</h3><p>Suggest proposes the web and flange layout and the field splices for the bridge on the Bridge tab, with one layout for all girders (designed for the envelope of the interior and exterior girders). It searches web depths from about L/36 to L/18 and, unless one is chosen, both an unstiffened and a transversely stiffened web, and keeps the layout with the <b>lowest total cost</b>: structural steel (weight × $/lb), flange shop transitions, transverse stiffeners, and field splices, each priced from the <b>Unit costs</b> on the Suggest tab, which are the same single price list used by the Alternatives study (and sent to GirderDetail's Design all). The defaults are placeholders; only their ratios affect the choice, and the tab shows each as an equivalent weight of steel. Within each field piece the flange width is constant and the thicknesses are chosen by an optimization that adds a transition only where it saves more than it costs. Field splices are placed by the program near the dead-load points of contraflexure and within the shipping length and weight, and moved off cross-frame locations where the framing check X4 finds a conflict.</p>
 <p><b>Rules.</b> AASHTO LRFD minimums always apply: D/t<sub>w</sub> ≤ 150 unstiffened or 300 stiffened (6.10.2.1), b<sub>f</sub>/2t<sub>f</sub> ≤ 12, b<sub>f</sub> ≥ D/6, t<sub>f</sub> ≥ 1.1t<sub>w</sub>, 0.1 ≤ I<sub>yc</sub>/I<sub>yt</sub> ≤ 10 (6.10.2.2), plates at least 5/16 in (6.7.3), and one steel grade (no hybrid girders). With the AASHTO/NSBA G12.1 fabrication guidelines on (the default), the Limits tab minimum sizes, increments, and transition ratios also apply. The span-to-depth limits of Table 2.5.2.6.3-1 apply by default. The Suggest setting can turn them off only when the Limits tab does not treat span-to-depth as mandatory; with "Treat span-to-depth (G1, G2) as mandatory" on, Suggest (fast and full design, the deck-width study, and the web economy comparison) always applies them, so it never proposes a girder that fails G1 or G2. Full design also requires the final plates of each candidate to meet the minimum depths, since resizing can thin the flanges.</p><p><b>Optimizing the framing.</b> Stiffener spacing and cross-frame spacing are design variables. For stiffened webs, the fast search tries d<sub>o</sub>/D = 1.0, 1.5, 2.0, and 3.0 (shear buckling coefficient k = 5 + 5/(d<sub>o</sub>/D)²): wider panels need fewer stiffeners but a thicker web, and the cost decides. Full design then re-runs its best candidate at cross-frame spacings from 15 ft up to the maximum set on the Suggest tab (default 25 ft) in 2.5 ft steps, with every check (lateral-torsional buckling with the actual spacing and C<sub>b</sub>, deck placement, and the rest), adding the cost of each intermediate cross-frame, and keeps the cheapest. Apply sets the Framing tab spacing and d<sub>o</sub>/D. The deck overhang is not modeled in sizing: GirderDetail's Deck overhang auto-design gives the largest spacing the deck placement allows at the exterior girder, so set the maximum spacing no higher than that.</p><p><b>Flange widths.</b> Every flange at a field splice is made wide enough for the number of bolt gage lines each side of the web set on the Suggest tab (default 2) without staggering, using the same geometry as GirderDetail's splice auto-design: the first line clear of the web splice plate by the plate clearance plus the edge distance and by the tightening clearance C₁, the gage between lines, and the edge distance at the flange tip (about 14 in for 7/8 in bolts and two lines). The top flange is kept at one width along the girder unless turned off (it simplifies the haunch and stay-in-place forms), and the width of either flange changes by no more than the set maximum at a field splice (default 4 in; 0 for no limit). Widths are raised, never reduced, to meet these rules, and the thicknesses are then optimized at those widths.</p>
-<p><b>Fast and full design.</b> The suggestion shown updates automatically (fast mode: constant-stiffness analysis and flange areas from lever-arm estimates). <b>Run full design</b> takes the best fast candidates and, for each, repeats: the staged, cracked analysis of the current layout (the Structural analysis settings); the AASHTO checks at every node for the interior and exterior girders, on both sides of every plate boundary (Strength I positive flexure with the plastic moment, compactness, D<sub>p</sub>/D<sub>t</sub>, and 1.3M<sub>y</sub>; Strength I negative flexure by 6.10.8 with flange local buckling, lateral-torsional buckling at the cross-frame spacing with C<sub>b</sub> from the quarter-point moments of each unbraced segment (10th Edition 6.10.8.2.3b: C<sub>b</sub> = 12.5M<sub>max</sub>/(2.5M<sub>max</sub> + 3M<sub>A</sub> + 4M<sub>B</sub> + 3M<sub>C</sub>), with M<sub>max</sub> the largest moment compressing the flange and M<sub>A</sub>, M<sub>B</sub>, M<sub>C</sub> the absolute envelope values at the quarter points (largest compression, or smallest tension where the flange is never in compression), as defined in Appendix D6.6; brace points at the supports and at the cross-frame spacing), and R<sub>b</sub>; where the compression flange changes within the unbraced length, lateral-torsional buckling uses the smallest compression flange in it (conservative; the γ<sub>e</sub> methods of Appendix D6.6 are not implemented); deck-placement lateral-torsional buckling also uses C<sub>b</sub> from the deck-placement moments; Service II flange stresses and web bend-buckling; deck-placement constructibility; flange fatigue, Fatigue I, Category B at the flange-to-web welds (extreme fiber) and Category C′ at the connection plates welded to the flanges at every cross-frame (inner flange face, 6.6.1.3.1), unless turned off or limited to Category B; and optionally L/800 deflection); and resizing, with each flange's required area set from the check ratio so plates are thickened where a check exceeds 1.0 and trimmed where there is spare capacity. When the layout stops changing it is verified against its own recomputed demands, and the cheapest passing candidate is selected. The result lists the governing check and ratio for every plate. Applying it replaces the girder layout (and the stiffener setting); Revert restores the previous design.</p>
+<p><b>Quick suggestion and full design.</b> Suggest has two modes. The <b>quick suggestion</b> updates as you edit. It picks the web depth and web type with the lowest estimated cost from a fast sizing (one constant-stiffness beam model, flange areas from lever-arm estimates, this tool's layout checks), then checks that girder with the same staged analysis and AASHTO checks as Full design (listed below) for the interior and exterior girders, including the Table 2.5.2.6.3-1 minimum depths when span-to-depth applies to Suggest. Where a ratio exceeds 1.0 it increases the flange plates there (required area = current area &times; ratio/0.97 &times; 1.01, at most 1.35 times per round, never less than the plate already there) and thickens the web by one increment if the web ratio exceeds 1.0, then checks again, up to 8 rounds. Plates are only increased, never trimmed, so the quick suggestion passes the strength and service checks (the card says so, or names the ratio that still exceeds 1.0) but is not necessarily the lightest girder. The check runs in the background after the fast result appears (the card shows &ldquo;checking&rdquo; with a progress bar; typically a second or less after the fast result); a new edit restarts it, and Apply pressed during the check applies the checked result, after confirmation, when it is ready. The girder-count study and the Alternatives study use the fast sizing only, without this check, to rank layouts. <b>Run full design</b> optimizes for the least steel: it takes the best fast candidates and, for each, repeats: the staged, cracked analysis of the current layout (the Structural analysis settings); the AASHTO checks at every node for the interior and exterior girders, on both sides of every plate boundary (Strength I positive flexure with the plastic moment, compactness, D<sub>p</sub>/D<sub>t</sub>, and 1.3M<sub>y</sub>; Strength I negative flexure by 6.10.8 with flange local buckling, lateral-torsional buckling at the cross-frame spacing with C<sub>b</sub> from the quarter-point moments of each unbraced segment (10th Edition 6.10.8.2.3b: C<sub>b</sub> = 12.5M<sub>max</sub>/(2.5M<sub>max</sub> + 3M<sub>A</sub> + 4M<sub>B</sub> + 3M<sub>C</sub>), with M<sub>max</sub> the largest moment compressing the flange and M<sub>A</sub>, M<sub>B</sub>, M<sub>C</sub> the absolute envelope values at the quarter points (largest compression, or smallest tension where the flange is never in compression), as defined in Appendix D6.6; brace points at the supports and at the cross-frame spacing), and R<sub>b</sub>; where the compression flange changes within the unbraced length, lateral-torsional buckling uses the smallest compression flange in it (conservative; the γ<sub>e</sub> methods of Appendix D6.6 are not implemented); deck-placement lateral-torsional buckling also uses C<sub>b</sub> from the deck-placement moments; Service II flange stresses and web bend-buckling; deck-placement constructibility; flange fatigue, Fatigue I, Category B at the flange-to-web welds (extreme fiber) and Category C′ at the connection plates welded to the flanges at every cross-frame (inner flange face, 6.6.1.3.1), unless turned off or limited to Category B; and optionally L/800 deflection); and resizing, with each flange's required area set from the check ratio so plates are thickened where a check exceeds 1.0 and trimmed where there is spare capacity. When the layout stops changing it is verified against its own recomputed demands, and the cheapest passing candidate is selected. The result lists the governing check and ratio for every plate. Applying it replaces the girder layout (and the stiffener setting); Revert restores the previous design.</p>
 <h3>Analysis model</h3><p>The analysis of the current design uses a variable-stiffness, staged line-girder model: DC1 on the steel section, DC2 and DW on the long-term composite section, and live load on the short-term composite section, with the composite stages cracked near interior supports. Its settings (staged or constant EI, cracked zones, deck reinforcement) are made in GirderDetail's Structural analysis module. Suggest mode searches trial layouts with the faster constant-EI model and then designs the chosen layout with the staged model.</p>
 <h3>Variable spacing and deck edges</h3><p>On the Bridge tab, <b>Girder spacing</b> can be <i>Variable</i>: enter the bay spacings from left to right (one fewer than the number of girders). The framing plan, cross-section, deck width, and GirderDetail's LLDF and DLs module use each bay; the sizing checks and the built-in approximate distribution factors use the average spacing, and the spacing and overhang checks are made bay by bay. <b>Deck edges</b> can be a barrier (width and the Suggest barrier weight) or a <i>curb and railing</i> on each side: curb width and height, railing load point and weight, and the distance from the deck edge to the traffic face, which sets the roadway. When GirderDetail's LLDF and DLs module is in use, its factors and MassDOT dead loads replace the built-in ones (see the Analysis tab).</p>
 <h3>Reverting a suggestion</h3><p>Applying a suggested layout (Suggest tab) or an alternative (Alternatives tab) keeps a copy of the design from just before it. A banner above the output tabs then offers <b>Revert to the previous design</b>; after reverting, the same button re-applies the change, so you can compare the two. The copy survives a reload and is replaced the next time you apply a suggestion or alternative. <b>Keep and dismiss</b> discards it.</p>
@@ -2479,7 +2523,9 @@
 <p>Positive flexure assumes the plastic neutral axis in the slab so that the bottom flange force acts about mid-deck, and neglects the web; negative flexure neglects slab reinforcement. η accounts for compression flange buckling in place of computed resistances. These are preliminary estimates only.</p>
 <h3>Splices, widths, and transitions</h3>
 <p>Continuous units: splices at the permanent-load contraflexure points (6.13.6.1.1). Simple spans: girder ends at piers, and a span longer than the shipping limit is divided into an odd number of equal pieces so no splice falls at midspan. Pieces over the length or weight limit are subdivided.</p>
-<p>Within each piece, each flange has one width: the largest of the minimum width, D/6, L<sub>pc</sub>/(L/b limit), and √(2kA<sub>max</sub>), rounded up, and widened if the thickness would exceed the maximum. Thickness at each point is A<sub>req</sub>/b<sub>f</sub> rounded up, not less than max(t<sub>f,min</sub>, 1.1t<sub>w</sub>, b<sub>f</sub>/24), which satisfies F1, F3, and F5 by construction. All arrangements of up to three shop transitions (limited by the Limits tab) at whole-foot stations are evaluated; arrangements that violate the minimum segment length or thickness ratio are discarded, and the one with the least plate weight plus the weld-cost equivalent per transition is kept. Loads, distribution factors, and lever arms depend on the plates, so the process is repeated until the layout stops changing (up to ten iterations). When spans, skews, and splices are symmetric, pieces in the second half are made mirror images of the first half so that equal-cost choices cannot produce an asymmetric layout. Finally, 0.1 ≤ I<sub>yt</sub>/I<sub>yb</sub> ≤ 10 is enforced by thickening the smaller flange if needed.</p>`],
+<p>Within each piece, each flange has one width: the largest of the minimum width, D/6, L<sub>pc</sub>/(L/b limit), and √(2kA<sub>max</sub>), rounded up, and widened if the thickness would exceed the maximum. Thickness at each point is A<sub>req</sub>/b<sub>f</sub> rounded up, not less than max(t<sub>f,min</sub>, 1.1t<sub>w</sub>, b<sub>f</sub>/24), which satisfies F1, F3, and F5 by construction. All arrangements of up to three shop transitions (limited by the Limits tab) at whole-foot stations are evaluated; arrangements that violate the minimum segment length or thickness ratio are discarded, and the one with the least plate weight plus the weld-cost equivalent per transition is kept. Loads, distribution factors, and lever arms depend on the plates, so the process is repeated until the layout stops changing (up to ten iterations). When spans, skews, and splices are symmetric, pieces in the second half are made mirror images of the first half so that equal-cost choices cannot produce an asymmetric layout. Finally, 0.1 ≤ I<sub>yt</sub>/I<sub>yb</sub> ≤ 10 is enforced by thickening the smaller flange if needed.</p>
+<h3>Strength and service check of the quick suggestion</h3>
+<p>The layout above (the fast sizing) is then verified with the staged analysis and the AASHTO checks of Full design (Part 2, Quick suggestion and full design). Where a flange ratio r exceeds 1.0 at a node, the required area there becomes max(A<sub>plate</sub>, A &times; min(1.01 r/0.97, 1.35)), with A the area of the plate the ratio was found on; elsewhere it is the plate already there. The flanges are re-sized from these areas with the rules above (so a plate is never made smaller), the web is thickened by one increment if its ratio exceeds 1.0, and the girder is verified again, up to 8 rounds. Depth, web type, stiffener spacing, and splice locations come from the fast sizing.</p>`],
 ['p5f', 'Framing, detailing, and analysis methodology', `
 <h3>Cross-frame layout</h3>
 <p>Girders are placed at y = 0, S, 2S, … and each support line passes through the bridge centerline station at its skew angle, so the bearing of girder i at support k is at x = X<sub>k</sub> + (y<sub>i</sub> − y<sub>c</sub>)tan θ<sub>k</sub>. A cross-frame is placed in every bay along every bearing line. Between bearing lines, n = ⌈L/s⌉ − 1 intermediate frames are placed, where s is the target spacing. Parallel frames interpolate between the two bearing lines. Normal frames are placed at even stations (offset by half a spacing in alternate bays if staggered), dropped where they would fall within the clear distance of a skewed bearing line, and supplemented near the acute corners so no girder exceeds the target spacing. If any frame falls within the splice clearance of a field splice or shop transition, up to three additional frames per span are tried and the layout with the fewest conflicts is kept.</p>
@@ -2496,7 +2542,7 @@
 <p>Reaction influence lines come from the jump in shear at each support. Dead loads are integrated over them; live load uses HL-93 (including 90% of two trucks plus lane at interior piers of continuous units, 3.6.1.3.1) with the shear distribution factor and the skew correction of Table 4.6.2.2.3c-1. The minimum Strength I reaction uses 0.90DC + 0.65DW + 1.75LL<sub>min</sub> (A2). Bearing stiffener bearing resistance is φ<sub>b</sub>1.4A<sub>pn</sub>F<sub>ys</sub> with φ<sub>b</sub> = 1.0 and A<sub>pn</sub> = 2(b<sub>t</sub> − clip)t<sub>p</sub> per pair (6.10.11.2.3, A3).</p>`],
 ['p5t', 'TS&L alternatives and cost', `
 <h3>Alternatives</h3>
-<p>For each girder count N<sub>b</sub> in the list, the out-to-out width and both overhangs are held and S = (width − overhangs)/(N<sub>b</sub> − 1). For each L/D<sub>st</sub> in the range, D = ⌈L<sub>max</sub>(12)/r − 2.5⌉ on the depth increment (duplicates removed). Each combination is sized with Suggest mode at that fixed depth (G1 and G2 are not forced, so shallow alternatives may fail them), the cross-frames are laid out, all proportion and framing checks are run, and quantities are priced. With the "cheaper of both" web basis, each is sized stiffened and unstiffened and the cheaper is kept.</p>
+<p>For each girder count N<sub>b</sub> in the list, the out-to-out width and both overhangs are held and S = (width − overhangs)/(N<sub>b</sub> − 1). For each L/D<sub>st</sub> in the range, D = ⌈L<sub>max</sub>(12)/r − 2.5⌉ on the depth increment (duplicates removed). Each combination is sized with Suggest's fast sizing (without the quick suggestion's strength and service check) at that fixed depth (G1 and G2 are not forced, so shallow alternatives may fail them), the cross-frames are laid out, all proportion and framing checks are run, and quantities are priced. With the "cheaper of both" web basis, each is sized stiffened and unstiffened and the cheaper is kept.</p>
 <h3>Cost model</h3>
 <div class="eq-math">\\[C = c_{st}W_{st} + c_{tr}n_{tr} + c_{sp}n_{sp} + c_{sf}(n_{stiff} + n_{conn}) + c_{xf}n_{xf} + c_{br}n_{br}\\]</div>
 <p>W<sub>st</sub> is the girder steel for all girders including the detail allowance; n<sub>tr</sub> the shop transitions, n<sub>sp</sub> the girder field splices (locations times girders), n<sub>stiff</sub> the transverse stiffeners at d<sub>o</sub> less those replaced by connection plates, n<sub>conn</sub> two connection plates per cross-frame, n<sub>xf</sub> the cross-frames, and n<sub>br</sub> the bearings. The recommended alternative is the least cost with no failed check. Deck, substructure, and deck thickness changes with spacing are not priced.</p>`],
@@ -2595,7 +2641,7 @@
       ${fld('d<sub>e</sub>, minimum (4.6.2.2)', 'ws.deMin', 'ft')}${fld('d<sub>e</sub>, maximum (4.6.2.2)', 'ws.deMax', 'ft')}
       ${fld('Girder spacing S, minimum', 'ws.sMin', 'ft')}${fld('Girder spacing S, maximum', 'ws.sMax', 'ft')}
       <p class="note full">Limits: verify / owner. Defaults: overhang 1.5 to 4.0 ft and not more than 0.5S (the study uses the stricter of these and the Limits tab overhang limits of check G6, 0.40S and 4.0 ft by default); d<sub>e</sub> from −1.0 to 5.5 ft and S from 3.5 to 16.0 ft (the ranges of the AASHTO 4.6.2.2 distribution factor equations). For each girder count from 3 that fits the limits, S = (W − 2·overhang)/(N − 1), the overhang is chosen to balance the exterior and interior live load moment distribution factors, and the girder is sized with Suggest. Nothing on the Bridge or Girder tab changes until you apply a row.</p>
-      <p class="note full">This study is quick because it uses Suggest's fast mode only: one constant-stiffness beam model, flange areas from lever-arm estimates, and this tool's layout checks (no strength, service, or fatigue check). When it finishes, the Suggest tab offers <b>Full design of the best N</b>: Full design (staged analysis, AASHTO checks) re-sizes only the leading girder counts, because it takes about a minute for each.</p>
+      <p class="note full">This study is quick because it uses Suggest's fast sizing only (the quick suggestion's first step, without its strength and service check): one constant-stiffness beam model, flange areas from lever-arm estimates, and this tool's layout checks (no strength, service, or fatigue check). When it finishes, the Suggest tab offers <b>Full design of the best N</b>: Full design (staged analysis, AASHTO checks) re-sizes only the leading girder counts, because it takes about a minute for each.</p>
       ${fld('Full design: number of best girder counts', 'ws.nFull', '', 'num', { full: true, note: '(1 to 5; default 3)' })}
       <button type="button" class="proj-btn proj-btn-primary full" id="ws_run">Suggest girder count, spacing, and overhangs</button>
       <div id="ws_prog" class="full"></div>
@@ -2639,10 +2685,10 @@
     </div>
     ${secHd('sec-sgrun', 'Full design')}
     <div class="sec-body one-col" id="sec-sgrun">
-      <p class="note">The suggestion on the Suggest tab updates automatically (fast mode). <b>Full design</b> refines the best candidates with the staged analysis and the AASHTO strength and service checks, trims or thickens plates until every check is at or below 1.0, and prices the result (about 20 to 60 s).</p>
+      <p class="note">Two modes. <b>Quick suggestion</b> (Suggest tab, updates as you edit): the depth with the lowest estimated cost, sized from lever-arm flange areas, then checked with the staged analysis and the AASHTO strength and service checks; plates are increased until every check is at or below 1.0 (in the background, typically a second or less). It passes but is not necessarily the lightest girder. <b>Full design</b> (this button): refines the best candidates with the same analysis and checks, trims or thickens plates for the least steel with every check at or below 1.0, and prices the result (about 20 to 60 s).</p>
       <button type="button" class="proj-btn proj-btn-primary" id="sg_full">Run full design</button>
       <div id="sg_prog_host"></div>
-      <button type="button" class="proj-btn proj-btn-primary" id="sg_apply_side">Apply suggestion to the girder</button>
+      <button type="button" class="proj-btn proj-btn-primary" id="sg_apply_side">Apply quick suggestion</button>
     </div>`;
 }
 
@@ -2661,24 +2707,67 @@
 document.addEventListener('click', e => { if (e.target.id === 'sg_full') runFullDesign(); else if (e.target.id === 'sg_cancel' && SG_RUN) SG_RUN.cancel = true; });
 function sgEquiv() { const el = document.getElementById('sg_equiv'); if (!el) return; const s = P.costs, c = num(s.steel) || 1; el.innerHTML = `One price list for Suggest, Full design, and the Alternatives study (placeholders; replace them with fabricator or owner data). In pounds of steel: a transition = ${f0(num(s.trans) / c)} lb, a stiffener = ${f0(num(s.stiff) / c)} lb, a field splice = ${f0(num(s.splice) / c)} lb per girder, a cross-frame = ${f0(num(s.xf) / c)} lb. Only the ratios affect the choice of layout.`; }
 function sgKey() { return JSON.stringify([P.bridge, P.limits, P.suggest, P.girder.gF, P.girder.gW, P.suggest.keepD ? P.girder.D : 0]); }
+function sgQKey() { return JSON.stringify([sgKey(), P.framing, P.analysis, P.costs]); }   // the quick check also depends on the cross-frame spacing and the analysis settings
 function maybeSuggest(force) {
   if (P.ui.otab !== 'suggest' && !force) return;
   const k = sgKey();
-  if (k === SG_KEY && SG && !force) return;
+  if (k === SG_KEY && SG && !force && !(SG.quick && SG.quick.qk !== sgQKey())) return;
   const host = $('#tab-suggest');
   if (!force) { host.classList.add('busy'); if (!host.innerHTML.trim()) host.innerHTML = '<div class="pending">Computing suggested layout…</div>'; }
   clearTimeout(SG_T);
   sgEquiv();
   if (SG_FULL && SG_FULL.key === k && SG && SG.full && !force) return;
-  const run = () => { try { SG = suggestLayout(P); SG_FULL = null; SG_KEY = k; renderSuggest(); } catch (e) { host.innerHTML = `<div class="alert fail"><b>Suggest mode failed.</b> ${esc(e.message)}</div>`; console.error(e); } host.classList.remove('busy'); };
+  if (force && k === SG_KEY && SG && SG.quick && SG.quick.qk === sgQKey() && SG.quick.state !== 'error') { try { renderSuggest(); } catch (e) { console.error(e); } return; }   // same inputs: keep the checked (or checking) quick suggestion
+  const run = () => { try { SG = suggestLayout(P); SG_FULL = null; SG_KEY = k; sgQuickStart(); renderSuggest(); } catch (e) { host.innerHTML = `<div class="alert fail"><b>Suggest mode failed.</b> ${esc(e.message)}</div>`; console.error(e); } host.classList.remove('busy'); };
   if (force) run(); else SG_T = setTimeout(run, 60);
 }
 
 function sgGirder() { const s = SG; const strip = l => l.map(r => { const o = { L: r.L, t: r.t }; if (r.b !== undefined) o.b = r.b; return o; }); return { ...P.girder, D: s.D, web: strip(s.web), top: strip(s.top), bot: strip(s.bot), splices: [...s.splices] }; }
+/* Quick suggestion check in the background: the fast result renders at once, marked "checking"; suggestQuickCheck runs on a copy of
+   the project with a run token (SGQ_RUN), so a new edit (a new fast result) cancels it. Apply pressed during the check is queued
+   (SGQ_APPLY) and applies the checked result, after the usual confirmation, when the check finishes; an edit in between drops it. */
+let SGQ_RUN = 0, SGQ_APPLY = 0;
+function sgQuickStart() {
+  const run = ++SGQ_RUN;
+  if (SGQ_APPLY) { SGQ_APPLY = 0; flash('The inputs changed while the quick suggestion was being checked; press Apply again when the check finishes.', 'fail'); }
+  if (!SG || SG.errors.length || SG.full) return;
+  const base = SG, key = SG_KEY, PP = clone(P); base.quick = { state: 'checking', f: 0, msg: 'Starting…', t0: Date.now(), qk: sgQKey() };
+  const prog = (f, m) => { if (run !== SGQ_RUN) return; base.quick.f = f; base.quick.msg = m; const fl = $('#sg_q_fill'), ms = $('#sg_q_msg'); if (fl) fl.style.width = `${Math.round(100 * f)}%`; if (ms) ms.textContent = `${m} (${Math.round((Date.now() - base.quick.t0) / 1000)} s)`; };
+  setTimeout(async () => {
+    if (run !== SGQ_RUN || SG !== base) return; let r = null;
+    try { r = await suggestQuickCheck(PP, base, prog, () => run !== SGQ_RUN || SG !== base); } catch (e) { console.error(e); r = { err: e.message || String(e) }; }
+    if (run !== SGQ_RUN || SG !== base || !r) return;
+    if (r.err) { base.quick = { ...base.quick, state: 'error', msg: r.err }; SGQ_APPLY = 0; try { renderSuggest(); } catch (e) { console.error(e); } return; }
+    const q = { state: 'done', qk: base.quick.qk, pass: r.pass, changed: r.changed, iters: r.iters, note: r.note, ms: r.ms, check: r.V.check, dOK: r.V.dOK, max0: r.V0.check.max, web0: r.V0.check.rWeb, pass0: r.V0.check.max <= 1.0005 && r.V0.check.rWeb <= 1.0005 && r.V0.dOK, fastCost: base.cost };
+    SG = r.changed ? { ...base, top: r.lay.top, bot: r.lay.bot, web: r.lay.web, tw: r.lay.tw, splices: r.lay.splices, cost: r.V.cost, quick: q } : { ...base, quick: q };
+    const pend = SGQ_APPLY === run; if (pend) SGQ_APPLY = 0;
+    try { renderSuggest(); } catch (e) { console.error(e); }
+    if (pend) { if (SG_KEY === key && sgKey() === key) applySuggestion(); else flash('The inputs changed while the quick suggestion was being checked; press Apply again.', 'fail'); }
+  }, 30);
+}
+function sgGov(ch, xs) {   // largest ratio of a verify check: flange (top or bottom) or web
+  let g = { r: ch.rWeb || 0, name: ch.gWeb, x: ch.xWeb, gt: ch.tWeb, where: 'web' };
+  [[ch.rT, ch.gT, ch.tT, 'top flange'], [ch.rB, ch.gB, ch.tB, 'bottom flange']].forEach(([rr, gg, tt, w]) => { for (let i = 0; i < rr.length; i++) if (rr[i] > g.r) g = { r: rr[i], name: gg[i], x: xs[i], gt: tt ? tt[i] : '', where: w }; });
+  return g;
+}
+function sgGovTxt(g, spans) {
+  if (!g || !(g.r > 0)) return 'no strength or service demand found';
+  let a = 0, k = 0; for (; k < spans.length - 1; k++) { if (g.x <= a + spans[k] + 1e-9) break; a += spans[k]; }
+  return `${g.name}, ${g.where} at ${f2(g.x)} ft${spans.length > 1 ? ` (Span ${k + 1})` : ''}${g.gt ? `, ${g.gt === 'ext' ? 'exterior' : 'interior'} girder` : ''}`;
+}
+function sgApplyLbl() {
+  const t = SG && SG.full ? 'Apply full design' : SGQ_APPLY && SGQ_APPLY === SGQ_RUN ? 'Apply quick suggestion (when checked)' : 'Apply quick suggestion';
+  ['#sg_apply', '#sg_apply_side'].forEach(id => { const b = $(id); if (b) b.textContent = t; });
+}
 function applySuggestion() {
   if (!SG || SG.errors.length) { maybeSuggest(true); if (!SG || SG.errors.length) return; }
-  if (!confirm('Replace the web, flange plates, and field splices on the Girder tab with the suggested layout? You can revert to the current layout afterwards.')) return;
-  snapshotBefore('Suggested layout');
+  if (!SG.full && SG.quick && SG.quick.state === 'checking') { SGQ_APPLY = SGQ_RUN; sgApplyLbl(); flash('Checking the quick suggestion for strength and service; it will be applied (after you confirm) when the check finishes.'); return; }
+  const what = SG.full ? 'full design' : 'quick suggestion', Q = SG.full ? null : SG.quick, ch = SG.full ? SG.full.check : Q && Q.state === 'done' ? Q.check : null;
+  const bad = SG.full ? !SG.full.passed : !(Q && Q.state === 'done' && Q.pass), g = ch ? sgGov(ch, SG.beam.xs) : null;
+  let warn = '';
+  if (bad) warn = `Warning: the ${what} does not pass every strength and service check: ${!ch ? 'the check could not be completed' : g.r > 1.0005 ? `ratio ${f3(g.r)} > 1.0 (${sgGovTxt(g, SG.spans)})${Q && !Q.dOK ? '; the girder is also shallower than the Table 2.5.2.6.3-1 minimum depth' : ''}` : SG.full ? 'a minimum depth (Table 2.5.2.6.3-1) or deflection limit is not met' : 'the girder is shallower than the Table 2.5.2.6.3-1 minimum depth'}. ${SG.full ? 'Review the Full design results, adjust the inputs, and run full design again before relying on it.' : 'Run full design (Suggest input tab) for a layout that passes.'}\n\n`;
+  if (!confirm(`${warn}Replace the web, flange plates, and field splices on the Girder tab with the ${what}? You can revert to the current layout afterwards.`)) return;
+  snapshotBefore(SG.full ? 'Full design' : 'Quick suggestion');
   P.girder = sgGirder(); if (SG.webType) P.framing.stiff = SG.webType === 'stiffened' ? 'on' : 'off'; if (SG.webType === 'stiffened' && SG.doR) P.framing.doRatio = SG.doR; if (SG.spacing) P.framing.spacing = SG.spacing; fillInputs(); ['web', 'top', 'bot', 'spl'].forEach(renderArr); recompute(); setOTab('summary'); autosave();
 }
 
@@ -2695,7 +2784,8 @@
 
   /* 1. summary */
   const verdict = cnt.fail ? 'fail' : 'pass';
-  let h = `<div class="alert info"><b>Preliminary sizing from an approximate analysis.</b> Demands come from a constant-stiffness continuous-beam model with HL-93 live load and AASHTO distribution factors, and flange areas from lever-arm estimates. Use the suggestion as a starting layout, then confirm it with your analysis and design apps.</div>`;
+  const Q = s.full ? null : (s.quick || null), chk = s.full ? { ch: s.full.check, pass: s.full.passed, dOK: true } : Q && Q.state === 'done' ? { ch: Q.check, pass: Q.pass, dOK: Q.dOK } : null, gv = chk ? sgGov(chk.ch, s.beam.xs) : null;
+  let h = `<div class="alert info"><b>Preliminary sizing.</b> ${s.full ? '<b>Full design</b> (Run full design): staged analysis and AASHTO checks, with the plates iterated up and down for the least steel.' : '<b>Quick suggestion</b>: the web depth with the lowest estimated cost is sized from a constant-stiffness continuous-beam model (HL-93 live load, AASHTO distribution factors) with flange areas from lever-arm estimates, then checked with the staged analysis and the AASHTO strength and service checks used by Full design; plates are increased where a ratio exceeds 1.0. It is not necessarily the lightest girder: <b>Run full design</b> on the Suggest input tab optimizes for least steel.'} Use the result as a starting layout, then confirm it with your analysis and design apps.</div>`;
   const cmp = `<table class="tbl narrow"><thead><tr><th></th><th class="right">Suggested</th>${cur ? '<th class="right">Current girder</th>' : ''}<th></th></tr></thead><tbody>
     <tr><td class="lbl">Web</td><td class="val">${frac(s.D)} × ${frac(s.tw)}</td>${cur ? `<td class="val">${frac(cur.D)} × ${[...new Set(cur.web.map(w => frac(w.t)))].join(', ')}</td>` : ''}<td class="unit">in</td></tr>
     <tr><td class="lbl">Field splices</td><td class="val">${s.splices.length ? s.splices.map(f2).join(', ') : 'None'}</td>${cur ? `<td class="val">${cur.splices.length ? cur.splices.map(f2).join(', ') : 'None'}</td>` : ''}<td class="unit">ft</td></tr>
@@ -2703,10 +2793,16 @@
     <tr><td class="lbl">Steel per girder, with allowance</td><td class="val">${f2(mS.wt)}</td>${cur ? `<td class="val">${f2(cur.wt)}</td>` : ''}<td class="unit">kip</td></tr>
     <tr><td class="lbl"><b>Steel per deck area</b></td><td class="val"><b>${f2(mS.psf)}</b></td>${cur ? `<td class="val">${f2(cur.psf)}</td>` : ''}<td class="unit">psf</td></tr></tbody></table>`;
   const plates = (list, isWeb) => `<table class="tbl"><thead><tr><th>#</th><th class="right">From (ft)</th><th class="right">To (ft)</th><th class="right">Length (ft)</th><th class="right">Plate (in)</th></tr></thead><tbody>${list.map((r, i) => `<tr><td>${i + 1}</td><td class="val">${f2(r.x0)}</td><td class="val">${f2(r.x1)}</td><td class="val">${f2(r.L)}</td><td class="val">${isWeb ? `${frac(s.D)} × ${frac(r.t)}` : pl(r.b, r.t)}</td></tr>`).join('')}</tbody></table>`;
-  h += card('sg-sum', 'Suggested layout', `${R.iter} sizing iterations`, `
-    <div class="sg-head ${verdict}"><div><b>${cnt.fail ? `${cnt.fail} check${cnt.fail > 1 ? 's' : ''} fail on the suggested layout` : 'The suggested layout passes the code proportion checks'}</b>
-      <span>${cnt.warn} warning${cnt.warn === 1 ? '' : 's'}, ${cnt.adv} advisor${cnt.adv === 1 ? 'y' : 'ies'}${issues.length ? ': ' + issues.map(c => `${c.id} ${STLBL[c.status].toLowerCase()}`).join(', ') : ''}</span></div>
-      <button type="button" class="btn btn-primary" id="sg_apply">Apply to girder</button></div>
+  const prop = `${cnt.fail ? `${cnt.fail} code proportion check${cnt.fail > 1 ? 's' : ''} fail` : 'Passes the code proportion checks'}: ${cnt.warn} warning${cnt.warn === 1 ? '' : 's'}, ${cnt.adv} advisor${cnt.adv === 1 ? 'y' : 'ies'}${issues.length ? ': ' + issues.map(c => `${c.id} ${STLBL[c.status].toLowerCase()}`).join(', ') : ''}`;
+  let sv = '';
+  if (Q && Q.state === 'checking') sv = `<b>Checking strength and service…</b><span class="sg-ln">The fast result is shown. The staged analysis and AASHTO strength and service checks (interior and exterior girders) are running on it; plates may increase when the check finishes.</span><div class="sg-prog-bar"><div id="sg_q_fill" style="width:${Math.round(100 * (Q.f || 0))}%"></div></div><span class="sg-ln" id="sg_q_msg">${esc(Q.msg || '')}</span>`;
+  else if (Q && Q.state === 'error') sv = `<b>The strength and service check could not be completed</b><span class="sg-ln">${esc(Q.msg || '')}. The fast result shown is not checked; run full design.</span>`;
+  else if (chk) sv = `<b>${chk.pass ? 'Passes the strength and service checks' : 'Does not pass every strength and service check'}: largest ratio ${f3(gv.r)}</b><span class="sg-ln">Governing: ${esc(sgGovTxt(gv, s.spans))}.${chk.dOK ? '' : ' The girder is shallower than the Table 2.5.2.6.3-1 minimum depth.'}${Q ? (Q.changed ? ` Plates increased in ${Q.iters} round${Q.iters > 1 ? 's' : ''} from the fast sizing (largest ratio before: ${f3(Math.max(Q.max0, Q.web0))}).` : Q.pass ? ' The fast sizing passed as is; no plate was changed.' : '') : ''}${chk.pass ? '' : s.full ? ' Review the Full design results below.' : ` ${Q.note ? `Stopped: ${esc(Q.note)}. ` : ''}Run full design for a layout that passes.`}</span>`;
+  const verdict2 = Q && Q.state === 'checking' ? 'chk' : cnt.fail || (chk && !chk.pass) || (Q && Q.state === 'error') ? 'fail' : 'pass';
+  const ttl = s.full ? 'Full design (Run full design) — optimized for least steel' : Q && Q.state === 'checking' ? 'Quick suggestion (updates as you edit) — checking strength and service…' : 'Quick suggestion (updates as you edit) — checked for strength and service';
+  h += card('sg-sum', ttl, `${R.iter} sizing iterations`, `
+    <div class="sg-head ${verdict2}"><div>${sv}<span class="sg-ln">${prop}</span></div>
+      <button type="button" class="btn btn-primary" id="sg_apply">${s.full ? 'Apply full design' : 'Apply quick suggestion'}</button></div>
     <div class="g2">${cmp}<div class="note-p" style="margin:0">Designed for the ${SG_TYPES_TXT(types)}. Web depth ${s.rec.D.keep ? 'kept from the Girder tab' : `from the target L/D<sub>st</sub> of ${f2(R.D.ratio)}${R.D.bumps ? `, increased ${R.D.bumps} time${R.D.bumps > 1 ? 's' : ''} to satisfy G1/G2` : ''}`}. Widths are constant within each field piece; thickness changes only where the steel saved exceeds the ${f0(P.suggest.weld)} lb weld-cost equivalent.</div></div>
     <div class="g3" style="margin-top:12px"><div><h4 class="sg-h4">Top flange</h4>${plates(mS.top)}</div><div><h4 class="sg-h4">Web</h4>${plates(mS.web, true)}</div><div><h4 class="sg-h4">Bottom flange</h4>${plates(mS.bot)}</div></div>`);
 
@@ -2714,15 +2810,15 @@
   const wtCur = P.framing && P.framing.stiff === 'on' ? 'stiffened' : 'unstiffened';
   const curCost = cur ? suggestLayout(P, { costOnly: { D: cur.D, wt: wtCur, top: P.girder.top.map(g => ({ L: num(g.L), b: num(g.b), t: num(g.t) })), bot: P.girder.bot.map(g => ({ L: num(g.L), b: num(g.b), t: num(g.t) })), web: P.girder.web.map(w => ({ L: num(w.L), t: num(w.t) })), splices: (P.girder.splices || []).map(num) } }).cost : null;
   const C = s.cost, money = v => '$' + Math.round(v).toLocaleString('en-US'), cc = curCost || { parts: { steel: 0, trans: 0, stiff: 0, splice: 0 }, wTot: 0, nTr: 0, nSt: 0, nSp: 0, total: 0 }, crow = (l, a, b2) => `<tr><td class="lbl">${l}</td><td class="val">${a}</td>${curCost ? `<td class="val">${b2}</td>` : ''}</tr>`;
-  if (C) h += card('sg-cost', s.full ? 'Cost of the full design' : 'Cost of the suggestion', `${C.nb} girders`, `<table class="tbl narrow"><thead><tr><th></th><th class="right">${s.full ? 'Full design' : 'Suggested'}</th>${curCost ? '<th class="right">Current girder</th>' : ''}</tr></thead><tbody>
+  if (C) h += card('sg-cost', s.full ? 'Cost of the full design' : 'Cost of the quick suggestion', `${C.nb} girders`, `<table class="tbl narrow"><thead><tr><th></th><th class="right">${s.full ? 'Full design' : 'Quick suggestion'}</th>${curCost ? '<th class="right">Current girder</th>' : ''}</tr></thead><tbody>
       ${crow('Structural steel', `${money(C.parts.steel)} (${f0(C.wTot / 1000)} kip)`, `${money(cc.parts.steel)} (${f0(cc.wTot / 1000)} kip)`)}${crow('Flange transitions', `${money(C.parts.trans)} (${C.nTr} per girder)`, `${money(cc.parts.trans)} (${cc.nTr})`)}
       ${crow('Transverse stiffeners', `${money(C.parts.stiff)} (${C.nSt} per girder${C.nSt ? `, d<sub>o</sub> = ${f2(C.doR)}D` : ''})`, `${money(cc.parts.stiff)} (${cc.nSt})`)}${crow('Intermediate cross-frames', `${money(C.parts.frames || 0)} (${C.nFr || 0} at ${f2(C.spCF || 0)} ft)`, `${money((cc.parts || {}).frames || 0)} (${cc.nFr || 0})`)}${crow('Field splices', `${money(C.parts.splice)} (${C.nSp} per girder)`, `${money(cc.parts.splice)} (${cc.nSp})`)}
       <tr class="tot"><td>Total</td><td class="val"><b>${money(C.total)}</b></td>${curCost ? `<td class="val">${money(curCost.total)}</td>` : ''}</tr></tbody></table>
-      ${s.full ? `<p class="note-p">Fast-mode suggestion for comparison: ${money(s.full.fastCost.total)}; the full design is ${f2(100 * (1 - C.total / s.full.fastCost.total))}% cheaper.</p>` : ''}
-      ${!s.full && s.rec.cands ? `<h4 class="sg-h4">Candidates (fast mode, lowest cost first)</h4><div class="tscroll"><table class="tbl"><thead><tr><th class="right">D (in)</th><th>Web</th><th class="right">d<sub>o</sub>/D</th><th class="right">t<sub>w</sub></th><th class="right">Steel (kip)</th><th class="right">Transitions</th><th class="right">Stiffeners</th><th class="right">Cost</th><th>Span-to-depth</th></tr></thead><tbody>${s.rec.cands.slice(0, 10).map(c => `<tr class="${c.best ? 'gov' : ''}"><td class="val">${f0(c.D)}</td><td>${c.wt}</td><td class="val">${c.wt === 'stiffened' ? f2(c.doR) : '—'}</td><td class="val">${frac(c.tw)}</td><td class="val">${f0(c.cost.wTot / 1000)}</td><td class="val">${c.cost.nTr}</td><td class="val">${c.cost.nSt}</td><td class="val">${money(c.cost.total)}</td><td>${c.ok ? 'OK' : 'Too shallow'}</td></tr>`).join('')}</tbody></table></div>` : ''}`);
+      ${s.full ? `<p class="note-p">Fast sizing (the quick suggestion before its strength and service check) for comparison: ${money(s.full.fastCost.total)}; the full design is ${f2(100 * (1 - C.total / s.full.fastCost.total))}% cheaper.</p>` : ''}${Q && Q.changed ? `<p class="note-p">Fast sizing before the strength and service check: ${money(Q.fastCost.total)}; the plates added by the check: ${money(C.total - Q.fastCost.total)}.</p>` : ''}
+      ${!s.full && s.rec.cands ? `<h4 class="sg-h4">Depth candidates (fast sizing before the strength and service check, lowest cost first)</h4><div class="tscroll"><table class="tbl"><thead><tr><th class="right">D (in)</th><th>Web</th><th class="right">d<sub>o</sub>/D</th><th class="right">t<sub>w</sub></th><th class="right">Steel (kip)</th><th class="right">Transitions</th><th class="right">Stiffeners</th><th class="right">Cost</th><th>Span-to-depth</th></tr></thead><tbody>${s.rec.cands.slice(0, 10).map(c => `<tr class="${c.best ? 'gov' : ''}"><td class="val">${f0(c.D)}</td><td>${c.wt}</td><td class="val">${c.wt === 'stiffened' ? f2(c.doR) : '—'}</td><td class="val">${frac(c.tw)}</td><td class="val">${f0(c.cost.wTot / 1000)}</td><td class="val">${c.cost.nTr}</td><td class="val">${c.cost.nSt}</td><td class="val">${money(c.cost.total)}</td><td>${c.ok ? 'OK' : 'Too shallow'}</td></tr>`).join('')}</tbody></table></div>` : ''}`);
   if (s.full) { const F = s.full, gt = list => `<div class="tscroll"><table class="tbl"><thead><tr><th class="right">From (ft)</th><th class="right">To (ft)</th><th class="right">Plate (in)</th><th class="right">Ratio</th><th>Governing check</th></tr></thead><tbody>${list.map(g => `<tr><td class="val">${f2(g.x0)}</td><td class="val">${f2(g.x1)}</td><td class="val" style="white-space:nowrap">${frac(g.b)} × ${frac(g.t)}</td><td class="val">${g.ratio ? f3(g.ratio) : '—'}</td><td>${g.gov || 'Minimum size or proportion'}</td></tr>`).join('')}</tbody></table></div>`;
     h += card('sg-full', 'Full design', F.passed ? 'Every check at or below 1.0' : 'No candidate passed every check', `<p class="note-p">${F.passed ? '' : '<b>Review:</b> the layout shown is the closest candidate. '}Each candidate was iterated with the staged, cracked analysis (Structural analysis settings) until its layout stopped changing, then verified against its own recomputed demands. Every iteration re-runs the analysis on the current plates and recomputes the live load distribution factors (4.6.2.2) from that section's K<sub>g</sub>; the live load stage model of the first iteration is reused inside the loop to save time, and the final verification recomputes everything. Checks at every node for the interior and exterior girders: Strength I positive flexure (6.10.7, plastic moment, compactness, D<sub>p</sub>/D<sub>t</sub>, 1.3M<sub>y</sub> for continuous spans), Strength I negative flexure (6.10.8: flange local buckling, lateral-torsional buckling with L<sub>b</sub> = ${f2(F.check.Lb)} ft and C<sub>b</sub> = 1.0, R<sub>b</sub>; tension flange), Service II flange stresses and web bend-buckling (6.10.4.2.2), deck-placement constructibility (6.10.3.2), and flange fatigue when selected. Plate boundaries are checked on both sides. Where the compression flange changes within an unbraced length, lateral-torsional buckling uses the smallest flange in it over the full length (conservative; the γ<sub>e</sub> methods of App. D6.6 are not applied). Shear is sized by 6.10.9.${(P.suggest.depthRule !== 'off' || P.limits.sdMandatory) ? ' A candidate passes only if its final plates also meet the Table 2.5.2.6.3-1 minimum depths (span-to-depth applies to Suggest).' : ''}</p>
-      <div class="tscroll"><table class="tbl"><thead><tr><th class="right">D (in)</th><th>Web</th><th class="right">Cross-frames</th><th class="right">Iterations</th><th class="right">Max. flange ratio</th><th class="right">Web ratio</th><th class="right">Cost</th><th class="right">Fast-mode cost</th><th>Result</th></tr></thead><tbody>${F.cands.map(c => `<tr class="${c.best ? 'gov' : ''}"><td class="val">${f0(c.D)}</td><td>${c.wt}${c.wt === 'stiffened' ? `, d<sub>o</sub> = ${f2(c.doR)}D` : ''}</td><td class="val">${f2(c.spacing)} ft</td><td class="val">${c.iters}</td><td class="val">${f3(c.max)}</td><td class="val">${f3(c.web)}</td><td class="val">${money(c.cost.total)}</td><td class="val">${money(c.fastCost.total)}</td><td>${c.pass ? (c.best ? 'Selected' : 'Passes') : c.dOK === false ? 'Too shallow (Table 2.5.2.6.3-1)' : 'Does not pass'}${c.defl ? `; Δ<sub>LL</sub> ${f3(c.defl.d)} / ${f3(c.defl.lim)} in` : ''}</td></tr>`).join('')}</tbody></table></div>
+      <div class="tscroll"><table class="tbl"><thead><tr><th class="right">D (in)</th><th>Web</th><th class="right">Cross-frames</th><th class="right">Iterations</th><th class="right">Max. flange ratio</th><th class="right">Web ratio</th><th class="right">Cost</th><th class="right">Fast-sizing cost</th><th>Result</th></tr></thead><tbody>${F.cands.map(c => `<tr class="${c.best ? 'gov' : ''}"><td class="val">${f0(c.D)}</td><td>${c.wt}${c.wt === 'stiffened' ? `, d<sub>o</sub> = ${f2(c.doR)}D` : ''}</td><td class="val">${f2(c.spacing)} ft</td><td class="val">${c.iters}</td><td class="val">${f3(c.max)}</td><td class="val">${f3(c.web)}</td><td class="val">${money(c.cost.total)}</td><td class="val">${money(c.fastCost.total)}</td><td>${c.pass ? (c.best ? 'Selected' : 'Passes') : c.dOK === false ? 'Too shallow (Table 2.5.2.6.3-1)' : 'Does not pass'}${c.defl ? `; Δ<sub>LL</sub> ${f3(c.defl.d)} / ${f3(c.defl.lim)} in` : ''}</td></tr>`).join('')}</tbody></table></div>
       <div class="g2" style="margin-top:10px"><div><h4 class="sg-h4">Top flange: governing checks</h4>${gt(F.topGov)}</div><div><h4 class="sg-h4">Bottom flange: governing checks</h4>${gt(F.botGov)}</div></div>
       <p class="note-p">Web: ${F.check.gWeb ? `${F.check.gWeb}, ratio ${f3(F.check.rWeb)} at ${f2(F.check.xWeb)} ft` : 'no bend-buckling demand'}.${F.check.other.length ? ` Also: ${[...new Set(F.check.other.map(o => o.name))].join('; ')} exceeded at some points.` : ''} ${F.check.fat ? `Flange fatigue: Fatigue I, Category B at the flange-to-web welds (extreme fiber)${P.suggest.fat !== 'B' ? ' and Category C′ at the connection plates welded to the flanges at every cross-frame (inner flange face, 6.6.1.3.1)' : ''} (6.6.1.2), short-term composite section for both signs (minimum reinforcement per 6.10.1.7).` : 'Flange fatigue was not checked (turned off).'} Other fatigue details are checked in the Fatigue module.</p>`); }
 
@@ -2753,7 +2849,8 @@
 
   /* 6. web */
   const W = R.web, Fyw = GRADES[P.girder.gW];
-  h += card('sg-web', 'Web depth and thickness', '', `
+  const fastNote = Q && Q.changed ? `<p class="note-p"><b>Fast sizing shown.</b> This card shows the fast (lever-arm) sizing. The strength and service check then increased ${s.tw > (R.web || {}).tw + 1e-9 ? 'the web thickness and ' : ''}plates; the final plates are in the Quick suggestion card above.</p>` : '';
+  h += card('sg-web', 'Web depth and thickness', '', `${fastNote}
     <div class="eq-block"><div class="eq-title"><span>Web depth</span><span class="eq-ref">Target span-to-depth (practice); AASHTO 2.5.2.6.3</span></div><div class="eq-math">\\[${R.D.keep ? `D = ${f2(s.D)}\\ \\text{in (kept from the Girder tab)}` : `D = \\left\\lceil \\frac{L_{max}(12)}{r} - 2.5 \\right\\rceil = \\left\\lceil \\frac{${f2(R.D.Lmax)}(12)}{${f2(R.D.ratio)}} - 2.5 \\right\\rceil = ${f2(s.D - R.D.bumps * P.limits.incD)}\\ \\text{in}${R.D.bumps ? `\\;\\rightarrow\\; ${f2(s.D)}\\ \\text{in (G1/G2)}` : ''}`}\\]</div>
     <div class="eq-where"><table><tr><td class="wsym">r</td><td class="wdesc">Target L/D<sub>st</sub> (${R.D.cont ? 'continuous' : 'simple'}); 2.5 in allows for flange thicknesses</td><td class="wval">${f2(R.D.ratio)}</td></tr></table></div></div>
     <div class="eq-block"><div class="eq-title"><span>Web thickness from shear, maximum V<sub>u</sub> at ${f2(W.loc)} ft (${TT(R.VuType)} girder)</span><span class="eq-ref">AASHTO 6.10.9.2, 6.10.9.3.2 (no tension-field action)</span></div>
@@ -2781,7 +2878,7 @@
   };
   const frows = R.flanges.map(f => `<tr><td>${f.piece}${f.mirrored ? '<br><span class="n-dim">mirror</span>' : ''}</td><td>${f.fl}</td><td class="val">${f2(f.Amax)}</td><td class="lbl">${f2(f.xMax)} ft, ${esc(f.gov)}, ${TT(f.gtype)}</td><td class="val">${f2(f.bD6)} / ${f2(f.bLb)} / ${f2(f.bOpt)}</td><td class="val"><b>${frac(f.bf)}</b></td><td class="val">${frac(f.tmin)}</td>
     <td class="val nw">${f.segs.map(g => `${f2(g.L)} @ ${frac(g.t)}`).join('<br>')}</td><td class="val tr-cell">${f.nTr ? `<b>${f.nTr}</b>: saves ${f0(f.saved)} lb, net ${f0(f.saved - f.nTr * f.weld)} lb` : f.cand ? `none; best (${f.cand.n}) saves ${f0(f.cand.saved)} lb, net ${f0(f.cand.net)} lb` : f.len >= 2 * P.limits.minSeg ? 'none possible within limits' : 'piece too short'}</td></tr>`).join('');
-  h += card('sg-flg', 'Flange sizing by field piece', '', `
+  h += card('sg-flg', 'Flange sizing by field piece', '', `${fastNote}
     <p class="note-p">For each flange of each field piece: width b<sub>f</sub> = the larger of ${frac(P.limits.minBf)} in, D/6, L<sub>pc</sub>/${f2(P.limits.lbRatio)} (in), and √(2k·A<sub>max</sub>) with k = ${f2(num(P.suggest.kbt))}, rounded up to ${frac(P.limits.incBf)} in and widened if A<sub>max</sub>/b<sub>f</sub> exceeds ${f2(P.limits.maxTf)} in. The thickness at each point is A<sub>req</sub>/b<sub>f</sub> rounded up to ${frac(P.limits.incTf)} in, but not less than t<sub>min</sub> = max(${frac(P.limits.minTf)} in, 1.1t<sub>w</sub>, b<sub>f</sub>/24). ${R.flanges.some(f => f.mirrored) ? 'The bridge is symmetric, so pieces in the second half mirror the first. ' : ''}Every arrangement of up to ${Math.min(3, P.limits.maxTrans)} shop transitions on whole-foot stations is then evaluated, respecting the minimum segment length and thickness ratio, and the arrangement with the least steel weight plus ${f0(P.suggest.weld)} lb per transition is kept.</p>
     <div class="tscroll"><table class="tbl sgtbl"><thead><tr><th>Piece</th><th>Flange</th><th class="right">A<sub>max</sub> (in²)</th><th>Where, criterion, girder</th><th class="right">D/6 / L/${f0(P.limits.lbRatio)} / √(2kA) (in)</th><th class="right">b<sub>f</sub> (in)</th><th class="right">t<sub>min</sub> (in)</th><th class="right">Plates (ft @ in)</th><th class="right">Transitions</th></tr></thead><tbody>${frows}</tbody></table></div>
     ${work('Bottom', iB)}${work('Top', iT)}`);
@@ -2793,14 +2890,14 @@
 
   /* 9. limitations */
   h += card('sg-lim', 'Assumptions and limitations of the suggestion', '', `<ul class="dlist">
-    <li>Constant flexural stiffness is assumed along the girder and for all load cases. Actual section changes and composite action redistribute continuous-span moments somewhat.</li>
+    <li>The depth search and the first plate sizes assume constant flexural stiffness along the girder and for all load cases. Actual section changes and composite action redistribute continuous-span moments somewhat; the strength and service check of the quick suggestion (and Full design) uses the staged analysis of the Structural analysis settings.</li>
     <li>Flange areas use simple force-couple estimates. They neglect web participation, and they ignore slab reinforcement in negative flexure, which is conservative for the top flange. Compression flanges use the efficiency factor η in place of computed buckling resistances.</li>
-    <li>Fatigue, lateral-torsional buckling between cross-frames, flange lateral bending, deck pour sequence, and web bend-buckling are not checked.</li>
+    <li>The fast sizing does not check fatigue, lateral-torsional buckling between cross-frames, or web bend-buckling; the strength and service check that follows does (the checks listed under Full design in the manual, with the skew flange lateral bending estimate). Deck pour sequence is not modeled.</li>
     <li>The skew reduction for moment and the rigid-body exterior girder check (4.6.2.2.2d) are not applied.</li>
     <li>One web thickness is used for the whole girder.</li>
     <li>The suggested layout still has to be verified with the analysis and design apps before use.</li></ul>`);
   host.innerHTML = wsHtml() + xfNoteHtml(s) + h;
-  $('#sg_apply').onclick = applySuggestion;
+  $('#sg_apply').onclick = applySuggestion; sgApplyLbl();
   applyCollapse(); drawSuggestCharts(mS); typeset(host);
 }
 function SG_TYPES_TXT(t) { return t.length > 1 ? 'envelope of the interior and exterior girders' : t[0] === 'int' ? 'interior girder' : 'exterior girder'; }
@@ -3430,7 +3527,7 @@
       ${fld('Girder counts to study', 'alts.nbList', '', 'text', { full: true, note: '(comma separated)' })}
       ${fld('L / D<sub>st</sub> from', 'alts.ldLo', '')}${fld('L / D<sub>st</sub> to', 'alts.ldHi', '')}
       ${fld('L / D<sub>st</sub> step', 'alts.ldStep', '')}${fld('Web basis', 'alts.web', '', 'sel', { options: [['stiffened', 'Stiffened'], ['unstiffened', 'Unstiffened'], ['both', 'Cheaper of both']] })}
-      <p class="note">Each alternative keeps the out-to-out deck width and overhangs, sets the spacing from the girder count, sizes the girder with Suggest mode at the web depth for that L/D, lays out cross-frames, and prices the result.</p>
+      <p class="note">Each alternative keeps the out-to-out deck width and overhangs, sets the spacing from the girder count, sizes the girder with Suggest's fast sizing (without the quick suggestion's strength and service check) at the web depth for that L/D, lays out cross-frames, and prices the result.</p>
     </div>
     ${secHd('sec-cost', 'Unit costs')}
     <div class="sec-body" id="sec-cost">
@@ -3521,7 +3618,7 @@
     ${best ? `<div class="sg-head pass"><div><b>Recommended (${P.ws.obj === 'nb' ? 'fewest girders' : 'least total steel weight'}): ${best.N} girders at ${f2(best.S)} ft, overhangs ${f2(best.oh)} ft</b><span>${f2(best.psf)} lb/ft² of deck, ${f2(best.wt)} kip per girder, web ${frac(best.D)} × ${frac(best.tw)}</span></div><button type="button" class="btn btn-primary" data-wsapply="${WS.res.indexOf(best)}">Apply</button></div>` : '<div class="alert warn" style="margin:0 0 8px"><b>No candidate passes every check.</b> Any row can still be applied.</div>'}
     <div class="tscroll"><table class="tbl alttbl"><thead><tr><th>N</th><th class="right">S (ft)</th><th class="right">Overhang (ft)</th><th class="right">d<sub>e</sub> (ft)</th><th class="right">g<sub>M</sub> int.</th><th class="right">g<sub>M</sub> ext.</th><th>Girder section</th><th class="right">Steel per girder (kip)</th><th class="right">Total (kip)</th><th class="right">lb/ft² of deck</th><th class="right">Governing ratio</th><th>Bracing</th><th>Checks</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
     <p class="note-p">Distribution factors: this tool's built-in AASHTO 4.6.2.2 equations (longest span, moment, interior: Table 4.6.2.2.2b-1; exterior: lever rule and Table 4.6.2.2.2d-1), an estimate for comparing girder counts; run LL &amp; DL (lldf) for the chosen layout before final design. Overhang: the value within the limits that balances the exterior and interior moment factors, computed with K<sub>g</sub> of a trial girder sized at the overhang nearest 0.375S (ties: nearest 0.375S). Steel weight includes the ${f2(P.limits.allow)}% detail allowance. Governing ratio: the largest ratio among this tool's layout checks (proportions, transitions, splices, framing) for the sized girder; the strength design is by Suggest's approximate method. Bracing: girder depth at Abutment 1 against the ${f2(dmin)} in minimum for cross-frames (Framing tab).${st.skip.length ? ` No overhang within the limits works for N = ${st.skip.join(', ')}.` : ''}${errs.length ? ` Not sized: ${errs.map(r => `N = ${r.N} (${esc(r.err)})`).join('; ')}.` : ''} Limits: overhang ${f2(st.L.ohMin)} to ${f2(st.L.ohMax)} ft${st.L.ohMaxGov === 'G6' ? ` (maximum from the Limits tab, check G6; this study's setting ${f2(st.L.ohMaxWs)} ft)` : ''} and ≤ ${f2(st.L.ohS)}S${st.L.ohSGov === 'G6' ? ` (from the Limits tab, check G6; this study's setting ${f2(st.L.ohSWs)}S)` : ''}, d<sub>e</sub> ${f2(st.L.deMin)} to ${f2(st.L.deMax)} ft, S ${f2(st.L.sMin)} to ${f2(st.L.sMax)} ft (verify / owner).</p>
-    <p class="note-p"><b>What this table is.</b> Every row is sized with Suggest's <i>fast mode</i>: one constant-stiffness continuous-beam model, flange areas from lever-arm estimates, and only this tool's layout checks. No strength, service, or fatigue check has been made on these girders, so the weights are a ranking aid. The next card re-sizes the best few with Full design.</p>`) + wsfHtml();
+    <p class="note-p"><b>What this table is.</b> Every row is sized with Suggest's <i>fast sizing</i> (the quick suggestion before its strength and service check): one constant-stiffness continuous-beam model, flange areas from lever-arm estimates, and only this tool's layout checks. No strength, service, or fatigue check has been made on these girders, so the weights are a ranking aid. The next card re-sizes the best few with Full design.</p>`) + wsfHtml();
 }
 function wsApply(i) { const r = WS && WS.res[i]; if (!r || r.err) return;
   if (!confirm(`Apply ${r.N} girders at ${f2(r.S)} ft with ${f2(r.oh)} ft overhangs and the sized girder (web ${frac(r.D)} × ${frac(r.tw)}) to the project? This replaces the girder count, spacing, overhangs, girder plates, splices, and the stiffener setting. You can revert afterwards.`)) return;
@@ -3587,7 +3684,7 @@
 function wsfHtml() {
   if (!WS || !WS.done || !WS.res.some(r => !r.err)) return '';
   const W = WSF && WSF.ws === WS ? WSF : null, picks = W ? W.picks : wsfPicks().map(r => r.N), n = picks.length, stale = WS.key !== wsKey(), dmin = num(P.framing.xfMinD) || 48;
-  const notes = `<p class="note-p"><b>What this step does.</b> The table above sizes every girder count quickly with Suggest's fast mode (constant-stiffness beam, lever-arm flange areas, layout checks only). This step takes the best ${n} of those rows (ranked by the study's objective, ${P.ws.obj === 'nb' ? 'fewest girders' : 'least total steel weight'}: passing rows first, then the others by governing ratio) and runs <b>Full design</b> on each, the same procedure as <i>Run full design</i> on the Suggest input tab, with that row's girder count, spacing (equal), and overhangs. For each girder count, Full design takes Suggest's best depth and web candidates and repeats: the staged, cracked analysis of the current plates (DC1 on the steel section; DC2 and DW on the long-term composite section, 3n; live load on the short-term composite section, n; the composite stages cracked near interior piers; GirderDetail's Structural analysis settings), the live load distribution factors recomputed from that section's K<sub>g</sub> (this tool's AASHTO 4.6.2.2 equations), the AASHTO checks at every node (Strength I, Service II, deck placement, and flange fatigue when selected), and resizing of the flanges and web. To save time, the live load model of the first iteration is reused inside the loop. When the plates stop changing, the girder is verified against fully recomputed demands and factors, and those final checks decide pass or fail. With "Optimize cross-frame spacing" on, it also tries other cross-frame spacings.</p>
+  const notes = `<p class="note-p"><b>What this step does.</b> The table above sizes every girder count quickly with Suggest's fast sizing (the quick suggestion without its strength and service check: constant-stiffness beam, lever-arm flange areas, layout checks only). This step takes the best ${n} of those rows (ranked by the study's objective, ${P.ws.obj === 'nb' ? 'fewest girders' : 'least total steel weight'}: passing rows first, then the others by governing ratio) and runs <b>Full design</b> on each, the same procedure as <i>Run full design</i> on the Suggest input tab, with that row's girder count, spacing (equal), and overhangs. For each girder count, Full design takes Suggest's best depth and web candidates and repeats: the staged, cracked analysis of the current plates (DC1 on the steel section; DC2 and DW on the long-term composite section, 3n; live load on the short-term composite section, n; the composite stages cracked near interior piers; GirderDetail's Structural analysis settings), the live load distribution factors recomputed from that section's K<sub>g</sub> (this tool's AASHTO 4.6.2.2 equations), the AASHTO checks at every node (Strength I, Service II, deck placement, and flange fatigue when selected), and resizing of the flanges and web. To save time, the live load model of the first iteration is reused inside the loop. When the plates stop changing, the girder is verified against fully recomputed demands and factors, and those final checks decide pass or fail. With "Optimize cross-frame spacing" on, it also tries other cross-frame spacings.</p>
     <p class="note-p"><b>Kept from the fast study:</b> the girder count, spacing, and overhangs; they are not re-optimized here. <b>Why only the best few:</b> Full design runs dozens of staged analyses for each girder count (about 20 to 60 s each, longer for many spans), so it is run on request for the leading rows only (number set on the Suggest input tab). The ranking below uses the full-design results. <b>Still preliminary:</b> the distribution factors are this tool's estimate; run LL &amp; DL (lldf) for the chosen layout and complete the design checks in GirderDetail before final design.</p>`;
   let body = '';
   if (W && W.running) body = `<div class="sg-prog"><div class="sg-prog-top"><b>Full design running</b><span id="wsf_msg">${esc(W.msg)}</span><button type="button" class="dg-btn" id="wsf_cancel">Cancel</button></div><div class="sg-prog-bar"><div id="wsf_fill" style="width:${Math.round(100 * W.frac)}%"></div></div></div>`;
@@ -3618,7 +3715,7 @@
   fillInputs(); ['web', 'top', 'bot', 'spl'].forEach(renderArr); recompute(); setOTab('summary'); autosave(); }
 document.addEventListener('click', e => { if (e.target.id === 'wsf_run') { wsfRun(); return; } if (e.target.id === 'wsf_cancel' && WSF && WSF.running) { WSF.cancel = true; return; } const a = e.target.closest && e.target.closest('[data-wsfapply]'); if (a) wsfApply(+a.dataset.wsfapply); });
 function xfNoteHtml(s) { const dmin = num(P.framing.xfMinD) || 48, d = s.D + s.top[0].t + s.bot[0].t;
-  return `<div class="alert info"><b>Intermediate bracing:</b> girder depth d = ${f2(d)} in at Abutment 1 ${d >= dmin - 1e-9 ? `≥ ${f2(dmin)} in: cross-frames.` : `< ${f2(dmin)} in (minimum for cross-frames, Framing tab; common practice, owner standards govern): channel (C, MC, depth about half the girder depth or more) or rolled W diaphragms; check them in GirderDetail's Cross-frames module.`}</div>`; }
+  return `<div class="alert info"><b>Intermediate bracing:</b> girder depth d = ${f2(d)} in at Abutment 1 ${d >= dmin - 1e-9 ? `≥ ${f2(dmin)} in: cross-frames.` : `< ${f2(dmin)} in (minimum for cross-frames, Framing tab; common practice, owner standards govern): channel (C, MC) or rolled W diaphragms at least 0.75 of the girder depth, ${f2(0.75 * d)} in (AASHTO 6.7.4.2, plate girders); check them in GirderDetail's Cross-frames module.`}</div>`; }
 
 /* ---------------- alternatives study ---------------- */
 function altKey() { return JSON.stringify([P.bridge, P.limits, P.suggest, P.framing, P.costs, P.alts, P.girder.gF, P.girder.gW]); }
```

## 2026-10-13 — PR: claude/girderdetail-cf-dia2 (engineer's decisions 2026-10-12; PR link added after merge)

Engineer's decisions (2026-10-12), follow-ups to CF-D1 to CF-D7: (1) when the diaphragm is the bracing used, the 6.7.4.2.2 torsional bracing calculation uses the diaphragm's own depth instead of the cross-frame chord depth `cf.h`; (2) the end (bearing-line) frames become diaphragms as well, sized by auto-design (lightest passing at least 0.75 d, same bolting rules, same section as the intermediate or deeper), with actual tabulated depths kept. Basis: AASHTO LRFD 10th Ed. (2024). Cross-frames module (`GM.cf`) on the main page only; the PlateLine string `PL_B64` is not touched. Line numbers ≈ branch.

### CF-D8. Torsional bracing with a diaphragm: β_sec and the coefficient C use the diaphragm depth   [§4: CFD stiffness item, M_br and β_T,req can change when the diaphragm is used] [cross-frame projects bit-identical]
- **Where:**
  - `GM.cf.compute(p)`, stability-bracing block (≈ 2773–2780). Anchor `const hBr = cfDiaOn(p) && cfDiaSec(p.dia).d > 0`.
    Before:
    ```js
          const deepFrame = h >= 0.8 * Dg, C = sb.full === 'yes' && deepFrame ? 2.4 : 3.6, Mbr = …;
          SB = { …, full: sb.full === 'yes' && deepFrame, fullSet: sb.full === 'yes', deepFrame };
          …
          const deep = h >= 0.8 * Dg, bs = gd('bs'), tsp = gd('tsp'), bsec = deep ? Infinity : 3.3 * ES / ho * (1.5 * ho * tw ** 3 / 12 + tsp * bs ** 3 / 12);
    ```
    After:
    ```js
          const hBr = cfDiaOn(p) && cfDiaSec(p.dia).d > 0 ? cfDiaSec(p.dia).d : h;   // bracing depth for the 0.8 D test …
          const deepFrame = hBr >= 0.8 * Dg, C = sb.full === 'yes' && deepFrame ? 2.4 : 3.6, Mbr = …;
          SB = { …, full: sb.full === 'yes' && deepFrame, fullSet: sb.full === 'yes', deepFrame, hBr };
          …
          const deep = hBr >= 0.8 * Dg, bs = gd('bs'), …   // β_sec formula unchanged
    ```
    `d_dia` is the actual tabulated depth of the preset channel/W (`CF_CH`/`CF_DIA`), or the custom `cf.dia.d`. With the cross-frame (`cf.dia.on` ≠ 'yes') `hBr = h`, so nothing changes.
  - `cfDiaChecks`, stiffness item (anchor `β_sec = ${isFinite(SB.bsec)`): the resistance cell now lists β_br, β_sec, β_g and the 0.8 D test (`β_T = 112,558 (β_br = 14,330,661, β_sec = ∞, β_g = 113,449; d_dia ≥ 0.8 D = 29.60 in)`); CFD note adds one sentence on the basis.
  - `adCfDia` (auto-design of the diaphragm): a stiffness shortfall is treated as one "no diaphragm can fix" only when the **deepest** candidate also falls short (anchor `const deepest = cands.reduce(`); before, any candidate with a shortfall had its stiffness item ignored, which with a depth-dependent β_sec would accept a too-shallow section. The message names the deepest candidate's depth against 0.8 D instead of "the chord work-point depth h".
- **Problem:** the "deep bracing" test (β_sec infinite; C = 2.4 with full-depth plates) compared the cross-frame chord work-point depth `cf.h` with 0.8 D even when a diaphragm, not a cross-frame, was the bracing. Less conservative when the diaphragm is deeper than `cf.h` (higher β_T, possibly lower M_br and β_T,req); more conservative when shallower.
- **§4 callout:**
  - **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 6.7.4.2.2 (torsional bracing of I-section members: brace system stiffness β_T from β_br, β_sec, β_g in series; M_br). The tool cites "6.7.4.2.2 (10th Ed.)" and "Eq. 6.7.4.2.2-14 and -15" for M_br; it cites no equation number for β_sec or β_T,req. I could not verify the equation numbers against the printed edition; please confirm.
  - **Before:** deep = (`cf.h` ≥ 0.8 D); β_sec = ∞ if deep, else 3.3E/h_o (1.5h_o t_w³/12 + t_s b_s³/12); C = 2.4 if (full-depth plates and deep) else 3.6; C_s = 2.4 if (full-depth plates and deep) else 3.6/0.75.
  - **After (diaphragm used):** deep = (d_dia ≥ 0.8 D); the rest unchanged.
  - **Check case (repro, headless Chromium):** 90 ft simple span, N_b = 10, S = 48 in, D = 37 in, t_w = 0.5 in, h_o = 37.94 in, connection plate 5 × 1/2 in, `sb.full` = 'no' (so C = 3.6 and C_s = 4.8 before and after), W30x99 (d_dia = 29.70 in), `cf.h` = 29 in, 0.8 D = 29.60 in.
    - β_br = 6EI_x/S = 6(29,000)(3,953)/48 = 14,330,661 kip-in/rad (I_x = 10.5(29.70)³/12 − 9.98(28.36)³/12 = 3,953 in⁴).
    - β_g = 24(n_g − 1)²S²EI_x,g/(n_gL³) = 24(9)²(48)²(29,000)(11,002.6)/(10 × 1080³) = 113,449 kip-in/rad.
    - β_T,req = C_sLM_u²/(nEI_yeff C_b²) = 4.8(1080)(10,996.8)²/(3 × 29,000 × 333.65 × 1.0²) = 21,597 kip-in/rad.
    - **Before:** 29.00 < 29.60, β_sec = 3.3(29,000)/37.94 × (1.5(37.94)(0.5)³/12 + 0.5(5)³/12) = 2,522.6 × 5.801 = 14,634; β_T = 1/(1/14,330,661 + 1/14,634 + 1/113,449) = **12,950 < 21,597, fail (1.67)**.
    - **After:** 29.70 ≥ 29.60, β_sec = ∞; β_T = 1/(1/14,330,661 + 1/113,449) = **112,558 ≥ 21,597, pass (0.19)**.
    - M_br = 256 kip-in unchanged (C = 3.6 both, `sb.full` = 'no'). With `sb.full` = 'yes' the coefficient would also change: C 3.6 → 2.4 (M_br × 2/3) and C_s 4.8 → 2.4 (β_T,req ÷ 2).
  - **Auto-design:** still W30x99 with 5 bolts at 3 in (every lighter channel/W is shallower than 0.75 d = 29.16 in, CF-D1); CFD now passes every item; Design all row "Fails: CFD" → no failures; quantities unchanged (27 diaphragms, 9.71 kip, 270 bolts).
  - **Default example (cross-frame):** every module's checks, Summary text, cross-frame report, drawings, member forces, auto-design result, DXF text, Design all, and saved autosave/inbox data are bit-identical main vs branch (timestamps masked).
- **How verified:** `node --check` on the inline scripts; headless Chromium main vs branch (default example, repro).
- **Other copies:** none.

### Exact changes (CF-D8): main page (unified diff)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index 772181c..3093042 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -2669,11 +2669,11 @@ function cfDiaChecks(R, out) {
   const k = 5, lam = hw / tw, r1 = 1.12 * Math.sqrt(E * k / Fy), r2 = 1.40 * Math.sqrt(E * k / Fy), C = lam <= r1 ? 1 : lam <= r2 ? r1 / lam : 1.57 / lam ** 2 * (E * k / Fy), Vn = C * 0.58 * Fy * hw * tw;
   const wk = R.W.III.Fw >= R.W.V.Fw ? 'III' : 'V', Fw = R.W[wk].Fw, Mw = Fw * dgT, Vw = 2 * Mw / S;   // wind on the diaphragm: the module's own bottom-flange wind force (4.6.2.7.1) times the lever arm d to the deck
   const c = { id: 'CFD', grp: 'Diaphragm (intermediate bracing used)', title: `${chS ? 'Channel' : 'Rolled'} diaphragm ${nm_} (intermediate bracing used in place of the cross-frame)`, ref: 'AASHTO LRFD 6.7.4.2, 6.7.4.2.2, 6.10.8, 6.10.9, 6.13.2, 3.4.3.1, 4.6.2.7.1', src: 'Code', sym: T`\beta_{br} = \frac{6EI_x}{S},\quad M_{br} \le \phi_f M_n,\quad M_w = F_w\,d`, cols: ['Check', 'Demand', 'Resistance', 'Ratio'], items: [],
-    note: `Properties from nominal dimensions (d = ${f2(d)}, b_f = ${f2(bf)}, t_f = ${f3(tf)}, t_w = ${f3(tw)} in; fillets neglected): I_x = ${f0(Ix)} in⁴, S_x = ${f0(Sx)} in³, r_y = ${f2(ry)} in. Flexural resistance per 6.10.8 as a noncomposite rolled I-section braced only at the girders (L_b = S, C_b = 1.0, conservative). The brace stiffness 6EI/S assumes reverse-curvature bending between girders.${chS ? ' Channel: the same checks as the rolled W diaphragm; the 6.10.8 lateral-torsional buckling model is for I-sections and is used here as an approximation for the channel (verify against AISC 360-16 F2 with c = (h_o/2)√(I_y/C_w)).' : ''} Depth: AASHTO LRFD 6.7.4.2 asks for diaphragms at least 0.75 of the girder depth for plate girders (0.5 for rolled beams); the girders here are plate girders, so 0.75 of the "Girder depth d" input is used for channels and W shapes alike (a warning, not a failure, since the article says "should"). Wind (Strength ${wk}, the governing of Strength III and V): the bottom-flange wind force F_w = ${f2(Fw)} kip of the exterior girder (the same force the cross-frame model uses, 4.6.2.7.1) is carried to the deck at the top flange through the girder and the diaphragm, a torque F_w × d = ${f2(Fw)} × ${f2(dgT)} = ${f0(Mw)} kip-in resisted by diaphragm bending, taken as the diaphragm end moment with shear 2M_w/S (reverse curvature, as for the brace moment); the bolts also take F_w horizontally. Axial force F_w in the diaphragm (f_a = ${f2(Fw / A)} ksi) is not combined with the flexure (assumption to verify). Assumed details (verify): the channel or W web is bolted to the connection plate with one vertical row of bolts, and the diaphragm is centered on the girder web depth; flanges coped to clear the connection plate as needed.` };
+    note: `Properties from nominal dimensions (d = ${f2(d)}, b_f = ${f2(bf)}, t_f = ${f3(tf)}, t_w = ${f3(tw)} in; fillets neglected): I_x = ${f0(Ix)} in⁴, S_x = ${f0(Sx)} in³, r_y = ${f2(ry)} in. Flexural resistance per 6.10.8 as a noncomposite rolled I-section braced only at the girders (L_b = S, C_b = 1.0, conservative). The brace stiffness 6EI/S assumes reverse-curvature bending between girders. Web distortion β_sec and the coefficient C (2.4 or 3.6/φ) of 6.7.4.2.2 use the diaphragm depth d_dia = ${f2(d)} in for the 0.8 D bracing-depth test (β_sec infinite and, with full-depth connection plates, C = 2.4 when d_dia ≥ 0.8 D).${chS ? ' Channel: the same checks as the rolled W diaphragm; the 6.10.8 lateral-torsional buckling model is for I-sections and is used here as an approximation for the channel (verify against AISC 360-16 F2 with c = (h_o/2)√(I_y/C_w)).' : ''} Depth: AASHTO LRFD 6.7.4.2 asks for diaphragms at least 0.75 of the girder depth for plate girders (0.5 for rolled beams); the girders here are plate girders, so 0.75 of the "Girder depth d" input is used for channels and W shapes alike (a warning, not a failure, since the article says "should"). Wind (Strength ${wk}, the governing of Strength III and V): the bottom-flange wind force F_w = ${f2(Fw)} kip of the exterior girder (the same force the cross-frame model uses, 4.6.2.7.1) is carried to the deck at the top flange through the girder and the diaphragm, a torque F_w × d = ${f2(Fw)} × ${f2(dgT)} = ${f0(Mw)} kip-in resisted by diaphragm bending, taken as the diaphragm end moment with shear 2M_w/S (reverse curvature, as for the brace moment); the bolts also take F_w horizontally. Axial force F_w in the diaphragm (f_a = ${f2(Fw / A)} ksi) is not combined with the flexure (assumption to verify). Assumed details (verify): the channel or W web is bolted to the connection plate with one vertical row of bolts, and the diaphragm is centered on the girder web depth; flanges coped to clear the connection plate as needed.` };
   const it = (loc, dem, res, st, r) => c.items.push({ loc, cells: [dem, res, r != null ? f2(r) : '—'], st, r, work: T`\text{${loc}}` });
   if (dgT > 0) it('Depth (6.7.4.2: at least 0.75 of the plate girder depth d)', `${f2(d)} in`, `${f2(0.75 * dgT)} in`, d >= 0.75 * dgT - 1e-6 ? 'pass' : 'warn', 0.75 * dgT / d);
   if (SB) { const bbr = 6 * E * Ix / S, bT = 1 / (1 / bbr + (isFinite(SB.bsec) ? 1 / SB.bsec : 0) + 1 / SB.bg), r = SB.bReq / bT;
-    it('Torsional brace system stiffness (6.7.4.2.2)', `β_T,req = ${f0(SB.bReq)} kip-in/rad`, `β_T = ${f0(bT)} (β_br = ${f0(bbr)})`, r <= 1 ? 'pass' : 'fail', r);
+    it('Torsional brace system stiffness (6.7.4.2.2)', `β_T,req = ${f0(SB.bReq)} kip-in/rad`, `β_T = ${f0(bT)} (β_br = ${f0(bbr)}, β_sec = ${isFinite(SB.bsec) ? f0(SB.bsec) : '∞'}, β_g = ${f0(SB.bg)}; d_dia ${SB.deep ? '≥' : '<'} 0.8 D = ${f2(0.8 * SB.Dg)} in)`, r <= 1 ? 'pass' : 'fail', r);
     const rm = SB.Mbr / (1.0 * Mn); it('Brace moment M_br (6.7.4.2.2)', `${f0(SB.Mbr)} kip-in`, `φ_f M_n = ${f0(Mn)} kip-in (F_nc = ${f2(lt.Fnc)} ksi)`, rm <= 1 ? 'pass' : 'fail', rm);
     const Vb = 2 * SB.Mbr / S; it('Shear from the brace moment', `${f2(Vb)} kip`, `φ_v V_n = ${f2(Vn)} kip (C = ${f3(C)})`, Vb <= Vn ? 'pass' : 'fail', Vb / Vn); }
   else it('Stability bracing', 'enter the girder and bracing data (Stability bracing inputs)', '—', 'na');
@@ -2770,12 +2770,13 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
     if (sbOn) { const gd = k => nm(sb[k]), Dg = gd('D'), tc = gd('tc'), bc = gd('bc'), tt = gd('tt'), bt = gd('bt'), tw = gd('tw');
       const s0 = steelProps(Dg, { tw, topB: bc, topT: tc, botB: bt, botT: tt }), yc = s0.d - tc / 2, yt = tt / 2, cD = yc - s0.yb, tD = s0.yb - yt;
       const Iyc = tc * bc ** 3 / 12, Iyt = tt * bt ** 3 / 12, Iyeff = Iyc + tD / cD * Iyt, ho = Dg + (tc + tt) / 2, L = gd('L') * 12, n = gd('n'), Mu = gd('Mu') * 12, Cb = gd('Cb'), Lb = g('Lb') * 12;
-      const deepFrame = h >= 0.8 * Dg, C = sb.full === 'yes' && deepFrame ? 2.4 : 3.6, Mbr = C * L / (n * ES * Iyeff) * (Mu / Cb) ** 2 * Lb / (500 * ho);
-      SB = { Dg, tc, bc, tt, bt, tw, Iyc, Iyt, Iyeff, cD, tD, ho, L, n, Mu, Cb, Lb, C, Mbr, full: sb.full === 'yes' && deepFrame, fullSet: sb.full === 'yes', deepFrame };
+      const hBr = cfDiaOn(p) && cfDiaSec(p.dia).d > 0 ? cfDiaSec(p.dia).d : h;   // bracing depth for the 0.8 D test: the diaphragm's own depth when the diaphragm is used (engineer's decision 2026-10-12), else the chord work-point depth h
+      const deepFrame = hBr >= 0.8 * Dg, C = sb.full === 'yes' && deepFrame ? 2.4 : 3.6, Mbr = C * L / (n * ES * Iyeff) * (Mu / Cb) ** 2 * Lb / (500 * ho);
+      SB = { Dg, tc, bc, tt, bt, tw, Iyc, Iyt, Iyeff, cD, tD, ho, L, n, Mu, Cb, Lb, C, Mbr, full: sb.full === 'yes' && deepFrame, fullSet: sb.full === 'yes', deepFrame, hBr };
       // torsional brace system stiffness (6.7.4.2.2): brace, web distortion, girder in-plane stiffness, in series
       const Rf = 0.65, Ad = Rf * mem.diag.A, isX = p.type === 'X', Lc = isX ? Math.hypot(S, h) : Math.hypot(S / 2, h), Ah = Rf * (p.type === 'Kb' ? mem.top.A : mem.bot.A);
       const bbr = isX ? Ad * ES * S ** 2 * h ** 2 / Lc ** 3 : 2 * ES * S ** 2 * h ** 2 / (8 * Lc ** 3 / Ad + S ** 3 / Ah);
-      const deep = h >= 0.8 * Dg, bs = gd('bs'), tsp = gd('tsp'), bsec = deep ? Infinity : 3.3 * ES / ho * (1.5 * ho * tw ** 3 / 12 + tsp * bs ** 3 / 12);
+      const deep = hBr >= 0.8 * Dg, bs = gd('bs'), tsp = gd('tsp'), bsec = deep ? Infinity : 3.3 * ES / ho * (1.5 * ho * tw ** 3 / 12 + tsp * bs ** 3 / 12);
       const ng = Math.max(2, Math.round(gd('ng') || 2)), bg = 24 * (ng - 1) ** 2 * S ** 2 * ES * s0.I / (ng * L ** 3), bT = 1 / (1 / bbr + (isFinite(bsec) ? 1 / bsec : 0) + 1 / bg);
       const Cs = SB.full ? 2.4 : 3.6 / 0.75, bReq = Cs * L * Mu ** 2 / (n * ES * Iyeff * Cb ** 2);
       Object.assign(SB, { Rf, Ad, Lc, Ah, isX, bbr, deep, bs, tsp, bsec, ng, bg, bT, Cs, bReq, Ix: s0.I }); }
@@ -5239,9 +5240,11 @@ const adCfDia = (C0, out, TR, lk) => { const q = C0.dia, dg = TR.dg, need = 0.75
   const failsOf = r => { const c = r && r.C.find(x => x.id === 'CFD'); return c ? c.items.filter(i => !AD_OK.includes(i.st)).map(i => i.loc.replace(/ \(.*$/, '')) : ['input errors']; };
   // a torsional-brace stiffness shortfall that no diaphragm can fix (β_sec and β_g in series below the requirement even with a rigid brace) is reported, not chased with ever larger sections (as for the angles and CF8)
   const sysMax = r => { const S = r && r.R.SB; return S ? 1 / ((isFinite(S.bsec) ? 1 / S.bsec : 0) + 1 / S.bg) : Infinity; }, sysOut = r => { const S = r && r.R.SB; return !!S && sysMax(r) < S.bReq; }, isK = i => i.loc.startsWith('Torsional brace system stiffness'), isDep = i => !deepEnough.length && i.loc.startsWith('Depth');   // no listed section is deep enough: the depth item warns, the rest decide
-  let done = null, sys = null;
+  // beta_sec and C now depend on the diaphragm depth (2026-10-12): the shortfall is unfixable only if the deepest candidate also falls short
+  const deepest = cands.reduce((a, x) => x[1] > a[1] ? x : a, cands[0]); let sysFix = true, sys0 = null; { const s0 = q.shape; if (!lkS) q.shape = deepest[0]; const r0 = adEval('cf'); sysFix = !(r0 && sysOut(r0)); if (!sysFix) sys0 = r0.R.SB; q.shape = s0; }
+  let done = null, sys = sys0;
   for (const sec of cands) { if (!lkS) q.shape = sec[0]; let last = null;
-    for (let n = lkN ? D(q.nb) : 2; n <= (lkN ? D(q.nb) : nMax(sec)); n++) { q.nb = n; const r = adEval('cf'); last = r; if (r && sysOut(r)) sys = r.R.SB; if (r && adGood(r.C, ['CFD'], i => !(sysOut(r) && isK(i)) && !isDep(i))) { done = { sec, n }; break; } }
+    for (let n = lkN ? D(q.nb) : 2; n <= (lkN ? D(q.nb) : nMax(sec)); n++) { q.nb = n; const r = adEval('cf'); last = r; if (r && adGood(r.C, ['CFD'], i => !(!sysFix && sysOut(r) && isK(i)) && !isDep(i))) { done = { sec, n }; break; } }
     if (done) break; skipped.push(`${sec[0]} (${[...new Set(failsOf(last))].join(', ')})`); }
   if (!lkS) { const lighter = all.slice(0, all.findIndex(x => x[0] === (done ? done.sec[0] : cands[cands.length - 1][0]))).filter(x => x[1] < need - 1e-9);
     if (lighter.length && deepEnough.length) out.push(`Lighter sections are shallower than 0.75 d = ${f2(need)} in (6.7.4.2, plate girders): ${lighter.map(x => `${x[0]} ${f2(x[1])} in`).join(', ')}`); }
@@ -5250,7 +5253,7 @@ const adCfDia = (C0, out, TR, lk) => { const q = C0.dia, dg = TR.dg, need = 0.75
     out.push(`No ${lkS ? 'bolt count for the locked shape' : 'channel or W at least 0.75 d deep'} passes every diaphragm check (CFD): ${skipped.join('; ')}. ${lkS ? 'The locked shape' : `The largest, ${big[0]},`} with ${q.nb} bolts per end was left in place to show the remaining ratios${r ? `; still failing: ${[...new Set(failsOf(r))].join(', ')}` : ''}`); return out; }
   if (skipped.length) out.push(`Deep enough but failing a CFD item: ${skipped.join('; ')}`);
   const r = adEval('cf'), c = r && r.C.find(x => x.id === 'CFD'), g = c && c.items[c.gov];
-  if (sys) out.push(`Torsional brace system stiffness (CFD) cannot be met by any diaphragm: with a rigid brace, β_sec = ${isFinite(sys.bsec) ? f0(sys.bsec) : '∞'} and β_g = ${f0(sys.bg)} kip-in/rad in series give at most ${f0(1 / ((isFinite(sys.bsec) ? 1 / sys.bsec : 0) + 1 / sys.bg))} against β_T,req = ${f0(sys.bReq)} kip-in/rad (C = ${f2(sys.Cs)}; the 0.8 D bracing-depth test uses the chord work-point depth h = ${f2(D(C0.h))} in against D = ${f2(sys.Dg)} in). ${sys.bg < sys.bReq ? 'The girders\' in-plane stiffness β_g is itself below the requirement: more girders, a shorter span, or top lateral bracing is needed' : 'Web distortion governs: full-depth connection plates, a wider or thicker connection plate, or a bracing depth of at least 0.8 D is needed'}. The section below passes every other CFD item; CFD still fails on the stiffness`);
+  if (sys) out.push(`Torsional brace system stiffness (CFD) cannot be met by any diaphragm: with a rigid brace, β_sec = ${isFinite(sys.bsec) ? f0(sys.bsec) : '∞'} and β_g = ${f0(sys.bg)} kip-in/rad in series give at most ${f0(1 / ((isFinite(sys.bsec) ? 1 / sys.bsec : 0) + 1 / sys.bg))} against β_T,req = ${f0(sys.bReq)} kip-in/rad (C = ${f2(sys.Cs)}; the 0.8 D bracing-depth test uses the depth of the deepest candidate diaphragm, ${f2(sys.hBr)} in, against 0.8 D = ${f2(0.8 * sys.Dg)} in). ${sys.bg < sys.bReq ? 'The girders\' in-plane stiffness β_g is itself below the requirement: more girders, a shorter span, or top lateral bracing is needed' : 'Web distortion governs: full-depth connection plates, a wider or thicker connection plate, or a bracing depth of at least 0.8 D is needed'}. The section below passes every other CFD item; CFD still fails on the stiffness`);
   out.push(`${CF_CH.some(x => x[0] === q.shape) ? 'Channel' : 'Rolled'} diaphragm ${q.shape} (d = ${f2(done.sec[1])} in ${done.sec[1] >= need - 1e-9 ? "≥" : "<"} 0.75 d = ${f2(need)} in${lkS ? ', shape locked' : ''}${lk ? ', bracing type locked' : ''}): the lightest channel or W that passes every CFD item${sys ? ' other than the system stiffness' : ''}; ${q.nb} - ${frac(db)} in bolts per end in one vertical row at ${f2(s)} in${g ? `; governing: ${g.loc.replace(/ \(.*$/, '')}, ratio ${g.r != null ? f2(g.r) : '—'}` : ''}`);
   return out; };
 AD.oh = () => { const O = P.oh, out = [], D = k => parseDim(k);
```

### CF-D9. End (bearing-line) frames are diaphragms when the diaphragm is used: check CFE, auto-design, drawings, 3D, DXF, Design all   [new check CFE; jacking items move from CFD to CFE] [cross-frame projects bit-identical] [optional saved fields `cf.dia.eShape`, `cf.dia.eNb`]
- **Where:**
  - New helper `cfDiaEnd(q)` after `cfDiaGap` (anchor `const cfDiaEnd = q =>`): the `cf.dia` inputs with `shape = q.eShape || q.shape` and `nb = q.eNb` when ≥ 2, else `q.nb`. The two fields are optional: they are **not** added to the defaults, so a project saved without them (every existing project) loads unchanged, the end diaphragm then equals the intermediate one, and cross-frame projects never get the keys. Auto-design writes them when the diaphragm is used.
  - `cfDiaChecks(R, out, end)` (anchor `function cfDiaChecks(R, out, end)`): `end` = true builds check **CFE** (group "End diaphragms (bearing lines)", title "… end diaphragm … at the bearing lines (in place of the end cross-frames)") from `cfDiaEnd(q)`; same items as CFD except the torsional brace system stiffness (6.7.4.2.2 brace-point requirement; not applied at the supports). Before, the jacking items and the jacking shear in the bolt group were applied to the (intermediate) CFD whenever `cf.dia.end` = 'yes'; after, only to CFE: `if (end && q.end === 'yes' && +q.Rj > 0)` and `Vt = V + (end && q.end === 'yes' ? +q.Rj || 0 : 0)`. CFE's note states the loads and the gaps.
  - `GM.cf.checks`: `cfDiaChecks(R, out); cfDiaChecks(R, out, true);`. `grps()`: the CFE group is listed after the CFD group when the diaphragm is used.
  - Members tab, Diaphragm section: new inputs "End diaphragm shape (bearing lines)" (`cf.dia.eShape`; '' = "Same as the intermediate", then the W and channel list) and "End diaphragm bolts per end" (`cf.dia.eNb`, blank = same); `cf.dia.end` label "End diaphragm (jacking)" → "Jacking at the end diaphragms" (values unchanged); note: "end (bearing-line) diaphragms are not covered here" replaced by the CFE description.
  - `kq` (Summary key quantities) and `echo` (report inputs): one "End diaphragms" row when the diaphragm is used. `drawings`: a second card "End diaphragm elevation (bearing lines)" from `cfDiaSVG(R, true)` (`cfDiaSVG(R, end)` takes the section from `cfDiaEnd`).
  - Auto-design: the existing diaphragm designer is renamed `adCfDiaInt` (unchanged) and `adCfDia = (C0, out, TR, lk) => { adCfDiaInt(…); adCfDiaEnd(C0, out, TR); return out; }`. New `adCfDiaEnd`: candidates are the intermediate section, then the heavier sections in the same order (channels by area, then `CF_DIA`) that are at least as deep (for a custom intermediate W: the custom W, then the `CF_DIA` shapes at least as deep); bolts from 2 up to the most that fit in one row (same pitch and the same bolt-line limit d − 2t_f − 1.0 in − 2e_min); the first section and bolt count with every CFE item pass/N/A wins (the depth item is ignored only when no candidate is 0.75 d deep, as for the intermediate). Locks `cf.dia.eShape`, `cf.dia.eNb` are kept. Message: "End diaphragms (bearing lines): W33x118 (deeper or heavier than the intermediate: W30x99 (Bolted connection …)), 10 - 7/8 in bolts per end at 3.00 in; jacking 175.00 kip checked; governing …", or "(same as the intermediate)", or "jacking not checked (…)"; if nothing passes, the largest with the most bolts is left and the failing items are named.
  - 3D (`v3bBuild`, anchor `const DX = f.type === 'sup' ? DXE : DXi`): with the diaphragm, end frames (`f.type === 'sup'`) are drawn as diaphragm boxes with the end section; note "intermediate diaphragms (…) and end diaphragms (…)".
  - DXF framing plan tags: "INTERMEDIATE DIAPHRAGM" / "END DIAPHRAGM" when the diaphragm is used (was "… CROSS-FRAME"). `dxfCF` end detail (anchor `// end diaphragm along the bearing line (2026-10-13)`): with the diaphragm, the end detail along the skew draws the end diaphragm outline, flange lines, bolt rows, depth dimension, title "END DIAPHRAGM AT BEARINGS (ROLLED W|CHANNEL, ALONG θ DEG. SKEW)" and the note "END DIAPHRAGM … WEB BOLTED WITH n - … BOLTS EACH END IN ONE ROW @ …; CENTERED ON GIRDER DEPTH; BEARING STIFFENERS SERVE AS CONNECTION PLATES …"; the angle connection detail is drawn only for the cross-frame. Cross-frame branch unchanged.
  - Design all (`designAllRun0`, anchor `const eq = cfDiaEnd(dq)`): with the diaphragm, two rows "End diaphragms at the bearing lines (n, shape, L ft [along θ° skew] at lb/ft): steel" and "End diaphragms: bolts": n = `qty.framesSup` (the bearing-line frames Preliminary sizing counts), L = S/cos θ_max − 2·`cfDiaGap` (θ_max = largest |skew| of `P.df.bridge.skews`, 0 if none), steel = n·A·L·0.2836 lb/in³ at `cDet`, bolts n·2·nb at `cBolt`. (Before, Design all counted no end frames at all, angles or diaphragms; the cross-frame case is unchanged and still counts none; see open items.)
  - Manual "Diaphragms (Cross-frames)": the end-diaphragm description replaces "end (bearing-line) diaphragms are not covered".
- **Loads on the end diaphragm (no new load derivation; assumptions stated in the UI note and the CFE note):** jacking per 3.4.3.1 from the module's existing inputs (`cf.dia.end`, `Rj`, `aj`; the Structural analysis module lists 1.3 × permanent per support), flexure M_j = R_j a_j and shear R_j against φ_fM_n and φ_vV_n, and R_j added to the bolt-group shear (as CFD did before); plus the same brace moment M_br and bottom-flange wind force F_w per frame that the module derives for the intermediate diaphragm (conservative for wind: a bearing line takes half a bay of bottom-flange wind). **Not checked (gap, stated):** superstructure wind and seismic horizontal forces carried to the bearings through the end diaphragms (the Structural analysis module computes the 3.10.9.2 connection force, but the Cross-frames module derives no bearing-line force), and torsional brace stiffness at the supports.
- **Problem:** with the diaphragm used, the end frames stayed angle cross-frames in the DXF, auto-design no longer re-sized them, and the jacking check (meant for an end diaphragm) was applied to the intermediate diaphragm.
- **Check case (repro, headless Chromium; 90 ft simple span, N_b = 10, S = 48 in, d = 38.88 in, after CF-D8):**
  - Without jacking (`cf.dia.end` = 'no'): end diaphragm W30x99 with 5 bolts (same as the intermediate); CFE passes, governing depth 0.98. Design all adds "End diaphragms at the bearing lines (18, W30x99, 3.67 ft at 98.07 lb/ft): steel" 18 × 28.82 in² × 44 in × 0.2836 = 6,473 lb = 6.47 kip, $22,654; "End diaphragms: bolts" 18 × 2 × 5 = 180, $2,700. Before: no end-frame rows.
  - With jacking R_j = 175 kip at a_j = 12 in (`cf.dia.end` = 'yes'):
    - **Before (main):** CFD (intermediate W30x99, 5 bolts) included jacking: M_j = 2,100 kip-in ≤ 13,311 (0.16), shear 175 ≤ 427.67 (0.41), bolts V_t = 10.67 + 175 = 185.67 kip, M = 256.17 + 185.67(3.5) = 906.0 kip-in, Σy² = 90, f = √((185.67/5)² + (906.0 × 6/90)²) = √(37.13² + 60.40²) = 70.90 kip > 25.98, **fail**.
    - **After:** CFD (intermediate W30x99, 5 bolts) has no jacking: bolts 19.68 kip (0.76), passes. CFE: W30x99 with the most bolts that fit (9, y = 0, ±3, …, ±12, Σy² = 540): √((185.67/9)² + (906.0 × 12/540)²) = √(20.63² + 20.13²) = 28.83 > 25.98, fails; W33x118 with 10 bolts (Σy² = 742.5, y_max = 13.5): √((185.67/10)² + (906.0 × 13.5/742.5)²) = √(18.57² + 16.47²) = **24.82 ≤ 25.98 (0.96)**; jacking flexure 2,100 ≤ φM_n 17,700 (0.12), shear 175 ≤ 501.15 (0.35); bolt line 9(3) + 2(1.125) = 29.25 ≤ 32.9 − 1.48 − 1.0 = 30.42 (0.96, governs). Auto-design: intermediate W30x99 / 5 bolts, end W33x118 / 10 bolts.
- **Saved data:** no key or format change; two optional fields `cf.dia.eShape` and `cf.dia.eNb` (missing = same as the intermediate). A main project with the diaphragm (no fields) loads in the branch with end = intermediate; a branch project with the fields loads in main (fields ignored, main's behavior). Cross-frame projects: autosave, inbox and every result bit-identical.
- **Default example (cross-frame):** every module's checks, Summary, DXF text, Design all, member forces, drawings and saved data bit-identical main vs branch (timestamps masked); the only difference is the cross-frame report's input list, which shows the two new inputs (blank) and the renamed jacking label.
- **How verified:** `node --check` on the inline scripts; headless Chromium main vs branch (default example, repro with and without jacking, end shape lock, saved data both directions); screenshots (Members inputs, Checks, Drawings with both elevations, 3D at the bearing line, Design all) and a render of the DXF cross-frame sheet.
- **Other copies:** none.
- **Open items (raised, not changed):**
  1. Bearing-line loads beyond jacking: superstructure wind and seismic (3.10.9.2) forces to the bearings through the end diaphragms are not checked; the module derives none.
  2. Design all counts no end cross-frames in the cross-frame case (unchanged); with the diaphragm the end diaphragms are now counted.
  3. The end-diaphragm length in Design all uses the largest skew for every bearing line.

### Exact changes (CF-D9): main page (unified diff)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index 3093042..2721ab0 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -2132,7 +2132,7 @@ const MAN = [
 <h3>Analysis stiffness (6.10.1.5)</h3><p>The analysis uses the concrete deck effective over the entire length for all composite loads, as Article 6.10.1.5 requires; the cracked-zone options remain available and are labeled as not per 6.10.1.5. Stresses in negative flexure still use the steel section plus the longitudinal reinforcement (6.10.1.1.1c).</p>
 <h3>Deck placement sequence (SA7)</h3><p>Steel and other noncomposite loads act on the steel; each pour's wet concrete then acts on the girder with the earlier pours composite (n or 3n). Pours are automatic (positive-moment regions first, then pier regions) or typed as x1-x2 ranges in placement order. The Combinations tab shows each stage, the noncomposite envelope against placing the deck at once, and deck tension in hardened pours; SA7 reports the governing values. With Structural analysis as the demand source, each Girder section location receives the sequence moment (M<sub>DC1</sub> for constructibility), used by the constructibility checks; final-condition checks use the deck placed at once.</p>
 <h3>Bearing and connection forces; fit condition; routine criteria (SA6)</h3><p>Under the reactions: permanent reaction, jacking 1.3 × permanent (3.4.3.1), Seismic Zone 1 horizontal connection force (3.10.9.2), and minimum support length N (4.7.4.4). SA6 compares the bridge with the NSBA routine-bridge definition, records η = 1.0 (1.3.2.1), and requires the fit condition (6.7.2) when a skew exceeds 20°; the fit condition appears in the drawings' notes and camber table.</p>
-<h3>Diaphragms (Cross-frames)</h3><p>The intermediate bracing is either the cross-frame (angles) or a diaphragm: a channel (C8x11.5 to MC18x42.7) or a rolled W (W18x35 to W36x135), nominal AISC dimensions, fillets neglected (verify). Set it with <b>Intermediate bracing used</b> on the Members tab. With the diaphragm selected it is the design: the angle checks CF1 to CF9 show N/A and check <b>CFD</b> decides the module status, the tab badge, the report, and the Design all row. CFD checks the depth against 0.75 of the girder depth d (6.7.4.2, plate girders; a warning, as the article says "should"), the torsional brace stiffness with β<sub>br</sub> = 6EI<sub>x</sub>/S (6.7.4.2.2), the brace moment against φM<sub>n</sub> (6.10.8, L<sub>b</sub> = S, C<sub>b</sub> = 1.0; for a channel an approximation), shear, jacking flexure and shear (when on), wind, and the bolted connection (one vertical row through the web, eccentric shear and moment), plus the bolt pitch and the fit of the bolt row in the web. <b>Wind:</b> the bottom-flange wind force F<sub>w</sub> the module already derives for the cross-frame (governing Strength III or V, 4.6.2.7.1) acts with the lever arm d to the deck: M<sub>w</sub> = F<sub>w</sub>d is the diaphragm end moment, with shear 2M<sub>w</sub>/S, and the bolts also take F<sub>w</sub> horizontally (a simplified model to verify; axial force in the diaphragm is not combined with flexure). Assumed details (verify): web bolted to the connection plate, diaphragm centered on the girder depth, member ends 1.5 in past the bolt line; end (bearing-line) diaphragms are not covered.</p>
+<h3>Diaphragms (Cross-frames)</h3><p>The intermediate bracing is either the cross-frame (angles) or a diaphragm: a channel (C8x11.5 to MC18x42.7) or a rolled W (W18x35 to W36x135), nominal AISC dimensions, fillets neglected (verify). Set it with <b>Intermediate bracing used</b> on the Members tab. With the diaphragm selected it is the design: the angle checks CF1 to CF9 show N/A and check <b>CFD</b> decides the module status, the tab badge, the report, and the Design all row. CFD checks the depth against 0.75 of the girder depth d (6.7.4.2, plate girders; a warning, as the article says "should"), the torsional brace stiffness with β<sub>br</sub> = 6EI<sub>x</sub>/S (6.7.4.2.2), the brace moment against φM<sub>n</sub> (6.10.8, L<sub>b</sub> = S, C<sub>b</sub> = 1.0; for a channel an approximation), shear, jacking flexure and shear (when on), wind, and the bolted connection (one vertical row through the web, eccentric shear and moment), plus the bolt pitch and the fit of the bolt row in the web. <b>Wind:</b> the bottom-flange wind force F<sub>w</sub> the module already derives for the cross-frame (governing Strength III or V, 4.6.2.7.1) acts with the lever arm d to the deck: M<sub>w</sub> = F<sub>w</sub>d is the diaphragm end moment, with shear 2M<sub>w</sub>/S, and the bolts also take F<sub>w</sub> horizontally (a simplified model to verify; axial force in the diaphragm is not combined with flexure). Assumed details (verify): web bolted to the connection plate, diaphragm centered on the girder depth, member ends 1.5 in past the bolt line. <b>End (bearing-line) diaphragms:</b> with the diaphragm used, the end frames are diaphragms too (check <b>CFE</b>; inputs "End diaphragm shape" and "End diaphragm bolts per end", blank = same as the intermediate). Auto-design starts from the intermediate section and goes to heavier sections at least as deep, with the fewest bolts, until every CFE item passes. CFE checks the depth, jacking flexure, shear and bolts (3.4.3.1, with "Jacking at the end diaphragms" on and the jacking reaction entered; the Structural analysis module lists 1.3 × permanent per support), and the same brace moment and wind force per frame as the intermediate diaphragm; the jacking items are no longer applied to the intermediate diaphragm. Not checked (verify): superstructure wind and seismic forces carried to the bearings through the end diaphragms, and the torsional bracing stiffness at the supports. The drawings, 3D view, DXF (framing plan tags and the end detail along the skew) show the end diaphragms, and Design all counts them (length S/cos θ of the largest skew less the end gaps) with their bolts.</p>
 <h3>Bracing type (Cross-frames)</h3><p><b>CF10</b> recommends the intermediate bracing type from the girder depth d (out-to-out of the flanges, the "Girder depth d" input, not the web depth): at or above the <b>Minimum girder depth for cross-frames</b> (default 48 in; common practice, e.g. AISC/NSBA G13.1 guidance; owner standards govern; verify) a cross-frame (X or K by S/h, as the auto-design chooses), below it the lightest channel at least 0.75 d deep, or else the lightest rolled W at least 0.75 d deep. A cross-frame on a girder below the minimum gives a warning, not a failure. Auto-design selects the type: below the minimum it switches to the diaphragm and picks the lightest channel, then W, at least 0.75 d deep that passes every CFD item, with the fewest bolts (one row, pitch 3 in or 3d); at or above the minimum it designs the cross-frame and switches a diaphragm back. Double-click the <b>Intermediate bracing used</b> label to lock the choice (and the shape, bolt count, or pitch labels to lock those). Preliminary sizing sends its own minimum (Framing tab) with the cross-frame geometry, and its Suggest tab states the recommendation. Design all counts the diaphragm steel (S less the end gaps, times the weight per foot from the nominal area) and its bolts in place of the angles.</p>
 <h3>Live load: vehicles and what controls (SA5)</h3><p>At every analysis point the HL-93 design truck (rear axle spacing varied from 14 to 30 ft in 1 ft steps, both directions) and design tandem are moved across the influence line, each with IM, and combined with the design lane load; in negative moment regions and for interior reactions, 90% of two design trucks plus 90% of the lane load is also evaluated. The Combinations tab card <b>Live load: vehicles evaluated and what controls</b> shows, at tenth points, each vehicle's moment per lane, the controlling truck spacing, which combination controls, the distribution factor, and the girder LL+IM; its chart shows every vehicle along the girder. The fatigue table gives the fatigue truck (30 ft rear spacing, IM 15%, one truck) range per lane, the fatigue distribution factor (single-lane ÷ 1.2), the girder range, and the Fatigue I range (× 1.75). Check SA5 records what was evaluated and how often each vehicle controls.</p>
 <h3>Applicability of the line-girder analysis (SA4)</h3><p>The Structural analysis module is a line-girder analysis with the approximate live load distribution factors of 4.6.2.2. Check SA4 lists the limits of that method for the bridge: the range of applicability of the distribution factor equations (DF1); skew within 60° for the skew corrections of Tables 4.6.2.2.2e-1 and 4.6.2.2.3c-1 (a fail beyond, where a refined analysis is required); the skew index I<sub>s</sub> = w<sub>g</sub>tanθ/L<sub>s</sub> ≤ 0.30 of NCHRP Report 725 per span (a warning above it, where a grid or 3D analysis is recommended); horizontal curvature within 4.6.1.2.4b (DF4); and at least four girders. For skews over 20° it also warns of the two effects a line-girder analysis cannot compute: cross-frame live-load forces (enter them from a refined analysis in the Cross-frames module, or show by the connectivity index of 4.6.3.3.2 that none is needed; that index is not computed here) and flange lateral bending. For the latter, Preliminary sizing sends every Girder section location f<sub>ℓ</sub> estimated per C6.10.1, 10.0 ksi for interior and 7.5 ksi for exterior girders (unfactored, based on staggered cross-frames), times a load factor (1.25 by default); all three are on the Limits tab. The full design of Preliminary sizing includes the same f<sub>ℓ</sub> on the bottom flange (f<sub>bu</sub> + f<sub>ℓ</sub>/3 in negative flexure and noncompact positive flexure, M<sub>u</sub> + f<sub>ℓ</sub>S<sub>xt</sub>/3 in compact positive flexure), so its plates pass the Girder section checks with it.</p>
@@ -2661,30 +2661,33 @@ function cfDiaSec(q) {
 const cfDiaOn = p => ((p || {}).dia || {}).on === 'yes';
 /* end of the diaphragm from each girder web: the bolt line (cf.dia.ecc) less a 1.5 in end distance (assumption for quantities and drawings) */
 const cfDiaGap = q => Math.max(0.5, (+q.ecc || 3.5) - 1.5);
-function cfDiaChecks(R, out) {
-  const p = R.p, q = p.dia || {}; if (q.on !== 'yes') return; const X = cfDiaSec(q), { chS, pre, d, bf, tf, tw, nm_ } = X, Fy = +q.gr || 50, E = 29000, S = R.S, SB = R.SB;
+/* end (bearing-line) diaphragms (engineer's decision 2026-10-12): when the diaphragm is the bracing used, the end frames are diaphragms too.
+   Optional inputs cf.dia.eShape and cf.dia.eNb (blank or missing = same as the intermediate), so projects saved without them load unchanged. */
+const cfDiaEnd = q => ({ ...q, shape: q.eShape || q.shape, nb: +q.eNb >= 2 ? q.eNb : q.nb });
+function cfDiaChecks(R, out, end) {   // end: the end (bearing-line) diaphragm, check CFE (2026-10-13)
+  const p = R.p, q0 = p.dia || {}; if (q0.on !== 'yes') return; const q = end ? cfDiaEnd(q0) : q0, X = cfDiaSec(q), { chS, pre, d, bf, tf, tw, nm_ } = X, Fy = +q.gr || 50, E = 29000, S = R.S, SB = R.SB;
   const hw = X.hw, A = X.A, Ix = bf * d ** 3 / 12 - (bf - tw) * hw ** 3 / 12, Sx = 2 * Ix / d,
     Iy = chS ? (() => { const xb = (hw * tw * tw / 2 + 2 * bf * tf * bf / 2) / A; return hw * tw ** 3 / 12 + hw * tw * (tw / 2 - xb) ** 2 + 2 * (tf * bf ** 3 / 12 + bf * tf * (bf / 2 - xb) ** 2); })() : 2 * tf * bf ** 3 / 12 + hw * tw ** 3 / 12, /* channel: I_y about its own centroid */ ry = Math.sqrt(Iy / A), dgT = nm(p.dg);
   const lt = ltbFnc({ bfc: bf, tfc: tf, Dc: hw / 2, tw, Lb: S, Cb: 1.0, Rb: 1, Rh: 1, Fyc: Fy, Fyw: Fy }), Mn = lt.Fnc * Sx;   // 6.10.8 for a noncomposite rolled I-section, Lb = girder spacing
   const k = 5, lam = hw / tw, r1 = 1.12 * Math.sqrt(E * k / Fy), r2 = 1.40 * Math.sqrt(E * k / Fy), C = lam <= r1 ? 1 : lam <= r2 ? r1 / lam : 1.57 / lam ** 2 * (E * k / Fy), Vn = C * 0.58 * Fy * hw * tw;
   const wk = R.W.III.Fw >= R.W.V.Fw ? 'III' : 'V', Fw = R.W[wk].Fw, Mw = Fw * dgT, Vw = 2 * Mw / S;   // wind on the diaphragm: the module's own bottom-flange wind force (4.6.2.7.1) times the lever arm d to the deck
-  const c = { id: 'CFD', grp: 'Diaphragm (intermediate bracing used)', title: `${chS ? 'Channel' : 'Rolled'} diaphragm ${nm_} (intermediate bracing used in place of the cross-frame)`, ref: 'AASHTO LRFD 6.7.4.2, 6.7.4.2.2, 6.10.8, 6.10.9, 6.13.2, 3.4.3.1, 4.6.2.7.1', src: 'Code', sym: T`\beta_{br} = \frac{6EI_x}{S},\quad M_{br} \le \phi_f M_n,\quad M_w = F_w\,d`, cols: ['Check', 'Demand', 'Resistance', 'Ratio'], items: [],
-    note: `Properties from nominal dimensions (d = ${f2(d)}, b_f = ${f2(bf)}, t_f = ${f3(tf)}, t_w = ${f3(tw)} in; fillets neglected): I_x = ${f0(Ix)} in⁴, S_x = ${f0(Sx)} in³, r_y = ${f2(ry)} in. Flexural resistance per 6.10.8 as a noncomposite rolled I-section braced only at the girders (L_b = S, C_b = 1.0, conservative). The brace stiffness 6EI/S assumes reverse-curvature bending between girders. Web distortion β_sec and the coefficient C (2.4 or 3.6/φ) of 6.7.4.2.2 use the diaphragm depth d_dia = ${f2(d)} in for the 0.8 D bracing-depth test (β_sec infinite and, with full-depth connection plates, C = 2.4 when d_dia ≥ 0.8 D).${chS ? ' Channel: the same checks as the rolled W diaphragm; the 6.10.8 lateral-torsional buckling model is for I-sections and is used here as an approximation for the channel (verify against AISC 360-16 F2 with c = (h_o/2)√(I_y/C_w)).' : ''} Depth: AASHTO LRFD 6.7.4.2 asks for diaphragms at least 0.75 of the girder depth for plate girders (0.5 for rolled beams); the girders here are plate girders, so 0.75 of the "Girder depth d" input is used for channels and W shapes alike (a warning, not a failure, since the article says "should"). Wind (Strength ${wk}, the governing of Strength III and V): the bottom-flange wind force F_w = ${f2(Fw)} kip of the exterior girder (the same force the cross-frame model uses, 4.6.2.7.1) is carried to the deck at the top flange through the girder and the diaphragm, a torque F_w × d = ${f2(Fw)} × ${f2(dgT)} = ${f0(Mw)} kip-in resisted by diaphragm bending, taken as the diaphragm end moment with shear 2M_w/S (reverse curvature, as for the brace moment); the bolts also take F_w horizontally. Axial force F_w in the diaphragm (f_a = ${f2(Fw / A)} ksi) is not combined with the flexure (assumption to verify). Assumed details (verify): the channel or W web is bolted to the connection plate with one vertical row of bolts, and the diaphragm is centered on the girder web depth; flanges coped to clear the connection plate as needed.` };
+  const c = { id: end ? 'CFE' : 'CFD', grp: end ? 'End diaphragms (bearing lines)' : 'Diaphragm (intermediate bracing used)', title: end ? `${chS ? 'Channel' : 'Rolled'} end diaphragm ${nm_} at the bearing lines (in place of the end cross-frames)` : `${chS ? 'Channel' : 'Rolled'} diaphragm ${nm_} (intermediate bracing used in place of the cross-frame)`, ref: 'AASHTO LRFD 6.7.4.2, 6.7.4.2.2, 6.10.8, 6.10.9, 6.13.2, 3.4.3.1, 4.6.2.7.1', src: 'Code', sym: T`\beta_{br} = \frac{6EI_x}{S},\quad M_{br} \le \phi_f M_n,\quad M_w = F_w\,d`, cols: ['Check', 'Demand', 'Resistance', 'Ratio'], items: [],
+    note: `${end ? `End (bearing-line) diaphragm, used at every bearing line with the diaphragm: the same section as the intermediate diaphragm, or deeper when one of these items requires it (auto-design). Checked for the depth, the jacking reaction (3.4.3.1, when "Jacking at the end diaphragms" is on; ${q.end === 'yes' && +q.Rj > 0 ? `R_j = ${f2(+q.Rj)} kip at ${f2(+q.aj)} in` : 'off or no reaction entered, not checked'}), and the same brace moment M_br and wind force F_w per frame that the module derives for the intermediate diaphragm (no separate bearing-line load is derived; the wind on the bottom flange at a bearing line is tributary to half a bay, so using F_w is conservative). Not checked (assumption to verify): the superstructure wind and seismic forces carried to the bearings through the end diaphragms (see the Structural analysis module's bearing and connection forces, 3.10.9.2), and the 6.7.4.2.2 stiffness at the supports. ` : ''}Properties from nominal dimensions (d = ${f2(d)}, b_f = ${f2(bf)}, t_f = ${f3(tf)}, t_w = ${f3(tw)} in; fillets neglected): I_x = ${f0(Ix)} in⁴, S_x = ${f0(Sx)} in³, r_y = ${f2(ry)} in. Flexural resistance per 6.10.8 as a noncomposite rolled I-section braced only at the girders (L_b = S, C_b = 1.0, conservative). The brace stiffness 6EI/S assumes reverse-curvature bending between girders. Web distortion β_sec and the coefficient C (2.4 or 3.6/φ) of 6.7.4.2.2 use the diaphragm depth d_dia = ${f2(d)} in for the 0.8 D bracing-depth test (β_sec infinite and, with full-depth connection plates, C = 2.4 when d_dia ≥ 0.8 D).${chS ? ' Channel: the same checks as the rolled W diaphragm; the 6.10.8 lateral-torsional buckling model is for I-sections and is used here as an approximation for the channel (verify against AISC 360-16 F2 with c = (h_o/2)√(I_y/C_w)).' : ''} Depth: AASHTO LRFD 6.7.4.2 asks for diaphragms at least 0.75 of the girder depth for plate girders (0.5 for rolled beams); the girders here are plate girders, so 0.75 of the "Girder depth d" input is used for channels and W shapes alike (a warning, not a failure, since the article says "should"). Wind (Strength ${wk}, the governing of Strength III and V): the bottom-flange wind force F_w = ${f2(Fw)} kip of the exterior girder (the same force the cross-frame model uses, 4.6.2.7.1) is carried to the deck at the top flange through the girder and the diaphragm, a torque F_w × d = ${f2(Fw)} × ${f2(dgT)} = ${f0(Mw)} kip-in resisted by diaphragm bending, taken as the diaphragm end moment with shear 2M_w/S (reverse curvature, as for the brace moment); the bolts also take F_w horizontally. Axial force F_w in the diaphragm (f_a = ${f2(Fw / A)} ksi) is not combined with the flexure (assumption to verify). Assumed details (verify): the channel or W web is bolted to the connection plate with one vertical row of bolts, and the diaphragm is centered on the girder web depth; flanges coped to clear the connection plate as needed.` };
   const it = (loc, dem, res, st, r) => c.items.push({ loc, cells: [dem, res, r != null ? f2(r) : '—'], st, r, work: T`\text{${loc}}` });
   if (dgT > 0) it('Depth (6.7.4.2: at least 0.75 of the plate girder depth d)', `${f2(d)} in`, `${f2(0.75 * dgT)} in`, d >= 0.75 * dgT - 1e-6 ? 'pass' : 'warn', 0.75 * dgT / d);
-  if (SB) { const bbr = 6 * E * Ix / S, bT = 1 / (1 / bbr + (isFinite(SB.bsec) ? 1 / SB.bsec : 0) + 1 / SB.bg), r = SB.bReq / bT;
-    it('Torsional brace system stiffness (6.7.4.2.2)', `β_T,req = ${f0(SB.bReq)} kip-in/rad`, `β_T = ${f0(bT)} (β_br = ${f0(bbr)}, β_sec = ${isFinite(SB.bsec) ? f0(SB.bsec) : '∞'}, β_g = ${f0(SB.bg)}; d_dia ${SB.deep ? '≥' : '<'} 0.8 D = ${f2(0.8 * SB.Dg)} in)`, r <= 1 ? 'pass' : 'fail', r);
+  if (SB) { if (!end) { const bbr = 6 * E * Ix / S, bT = 1 / (1 / bbr + (isFinite(SB.bsec) ? 1 / SB.bsec : 0) + 1 / SB.bg), r = SB.bReq / bT;
+    it('Torsional brace system stiffness (6.7.4.2.2)', `β_T,req = ${f0(SB.bReq)} kip-in/rad`, `β_T = ${f0(bT)} (β_br = ${f0(bbr)}, β_sec = ${isFinite(SB.bsec) ? f0(SB.bsec) : '∞'}, β_g = ${f0(SB.bg)}; d_dia ${SB.deep ? '≥' : '<'} 0.8 D = ${f2(0.8 * SB.Dg)} in)`, r <= 1 ? 'pass' : 'fail', r); }
     const rm = SB.Mbr / (1.0 * Mn); it('Brace moment M_br (6.7.4.2.2)', `${f0(SB.Mbr)} kip-in`, `φ_f M_n = ${f0(Mn)} kip-in (F_nc = ${f2(lt.Fnc)} ksi)`, rm <= 1 ? 'pass' : 'fail', rm);
     const Vb = 2 * SB.Mbr / S; it('Shear from the brace moment', `${f2(Vb)} kip`, `φ_v V_n = ${f2(Vn)} kip (C = ${f3(C)})`, Vb <= Vn ? 'pass' : 'fail', Vb / Vn); }
   else it('Stability bracing', 'enter the girder and bracing data (Stability bracing inputs)', '—', 'na');
-  if (q.end === 'yes' && +q.Rj > 0) { const Mj = +q.Rj * +q.aj, rm = Mj / Mn, rv = +q.Rj / Vn;
+  if (end && q.end === 'yes' && +q.Rj > 0) { const Mj = +q.Rj * +q.aj, rm = Mj / Mn, rv = +q.Rj / Vn;
     it('Jacking: flexure (3.4.3.1)', `${f0(Mj)} kip-in`, `φ_f M_n = ${f0(Mn)} kip-in`, rm <= 1 ? 'pass' : 'fail', rm); it('Jacking: shear', `${f2(+q.Rj)} kip`, `φ_v V_n = ${f2(Vn)} kip`, rv <= 1 ? 'pass' : 'fail', rv); }
   { const rm = Mw / Mn, rv = Vw / Vn;
     it(`Wind, Strength ${wk}: flexure M_w = F_w d (4.6.2.7.1)`, `${f0(Mw)} kip-in (F_w = ${f2(Fw)} kip)`, `φ_f M_n = ${f0(Mn)} kip-in`, rm <= 1 ? 'pass' : 'fail', rm);
     it(`Wind, Strength ${wk}: shear 2M_w/S`, `${f2(Vw)} kip`, `φ_v V_n = ${f2(Vn)} kip`, rv <= 1 ? 'pass' : 'fail', rv); }
   { const nb = Math.max(2, Math.round(+q.nb || 2)), s = +q.pitch || 3, db = +((p.conn || {}).d) || 0.875, Ab = Math.PI * db * db / 4, thr = (p.conn || {}).thr === 'excl' ? 0.56 : 0.45, phiRs = 0.80 * thr * Ab * (FUB[(p.conn || {}).gr] || 120), phiRb = 0.80 * 2.4 * db * tw * (Fy === 36 ? 58 : 65);
     const ys = [...Array(nb)].map((_, i) => (i - (nb - 1) / 2) * s), sy2 = ys.reduce((a, y) => a + y * y, 0), ym = Math.max(...ys.map(Math.abs)), res = Math.min(phiRs, phiRb);
-    const V = SB ? 2 * SB.Mbr / S : 0, Vt = V + (q.end === 'yes' ? +q.Rj || 0 : 0), M = (SB ? SB.Mbr : 0) + Vt * (+q.ecc || 0), fmax = Math.hypot(Vt / nb, M * ym / (sy2 || 1)), r = fmax / res;
+    const V = SB ? 2 * SB.Mbr / S : 0, Vt = V + (end && q.end === 'yes' ? +q.Rj || 0 : 0), M = (SB ? SB.Mbr : 0) + Vt * (+q.ecc || 0), fmax = Math.hypot(Vt / nb, M * ym / (sy2 || 1)), r = fmax / res;
     it(`Bolted connection: ${nb} bolts at ${f2(s)} in, eccentric shear and moment (6.13.1, 6.13.2)`, `${f2(fmax)} kip per bolt`, `${f2(res)} kip (shear ${f2(phiRs)}, bearing ${f2(phiRb)})`, r <= 1 ? 'pass' : 'fail', r);
     const Mc = Mw + Vw * (+q.ecc || 0), fw = Math.hypot(Vw / nb, Mc * ym / (sy2 || 1) + Fw / nb), rw = fw / res;
     it(`Bolted connection under wind, Strength ${wk}: V = ${f2(Vw)} kip, M = ${f0(Mc)} kip-in, H = F_w = ${f2(Fw)} kip (6.13.2)`, `${f2(fw)} kip per bolt`, `${f2(res)} kip`, rw <= 1 ? 'pass' : 'fail', rw);
@@ -2720,7 +2723,7 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
           <p class="note">Brace moment M<sub>br</sub> = (C L / nEI<sub>yeff</sub>)(M<sub>u</sub>/C<sub>b</sub>)²(L<sub>b</sub>/500h<sub>o</sub>) with C = 2.4 or 3.6. It is applied to the truss as a couple on one girder and added to the Constructibility forces. The stiffness requirement of 6.7.4.2.2 (β<sub>br</sub>, β<sub>sec</sub>, β<sub>g</sub>) is not yet checked.</p></div>`,
       cf_mem: `${secHd('sec-cfm', 'Angles')}<div class="sec-body" id="sec-cfm">${fld('Angle grade', 'cf.gA', '', 'sel', { options: GR })}${fld('Gusset grade', 'cf.gG', '', 'sel', { options: GR })}
         ${CF_MEM.map(([k, l]) => `<h4 class="sub-h full">${l}</h4>${mem(k)}`).join('')}</div>
-        ${secHd('sec-cfd', 'Diaphragm (channel or rolled W) in place of the cross-frame')}<div class="sec-body" id="sec-cfd">${fld('Intermediate bracing used', 'cf.dia.on', '', 'sel', { options: [['no', 'Cross-frame (angles)'], ['yes', 'Diaphragm: channel (C, MC) or rolled W']] })}${fld('Shape (nominal dimensions)', 'cf.dia.shape', '', 'sel', { options: CF_DIA.map(s => [s[0], s[0]]).concat(CF_CH.map(s => [s[0], `${s[0]} (channel)`]), [['custom', 'Custom W (enter below)']]) })}${fld('Depth d', 'cf.dia.d', 'in')}${fld('Flange width b<sub>f</sub>', 'cf.dia.bf', 'in')}${fld('Flange thickness t<sub>f</sub>', 'cf.dia.tf', 'in')}${fld('Web thickness t<sub>w</sub>', 'cf.dia.tw', 'in')}${fld('Grade', 'cf.dia.gr', '', 'sel', { options: [['36', '36'], ['50', '50']] })}${fld('Bolts per end (one vertical line)', 'cf.dia.nb', '')}${fld('Bolt pitch', 'cf.dia.pitch', 'in')}${fld('Bolt line to girder web', 'cf.dia.ecc', 'in')}${fld('End diaphragm (jacking)', 'cf.dia.end', '', 'sel', { options: [['no', 'No'], ['yes', 'Yes']] })}${fld('Jacking reaction per jack, 1.3 × permanent (3.4.3.1)', 'cf.dia.Rj', 'kip')}${fld('Jack offset from girder centerline', 'cf.dia.aj', 'in')}<p class="note full">With the diaphragm selected it is the design: the angle checks (CF1 to CF9) are not used and CFD governs. Auto-design selects the diaphragm when the girder depth d is below the minimum for cross-frames (double-click the "Intermediate bracing used" label to lock the choice), choosing the lightest channel, then W, at least 0.75 d deep (6.7.4.2, plate girders) that passes every CFD item, and the bolts (one vertical row). Assumptions to verify: web bolted to the connection plate with one vertical row of bolts; diaphragm centered on the web depth; member ends 1.5 in past the bolt line; end (bearing-line) diaphragms are not covered here.</p></div>
+        ${secHd('sec-cfd', 'Diaphragm (channel or rolled W) in place of the cross-frame')}<div class="sec-body" id="sec-cfd">${fld('Intermediate bracing used', 'cf.dia.on', '', 'sel', { options: [['no', 'Cross-frame (angles)'], ['yes', 'Diaphragm: channel (C, MC) or rolled W']] })}${fld('Shape (nominal dimensions)', 'cf.dia.shape', '', 'sel', { options: CF_DIA.map(s => [s[0], s[0]]).concat(CF_CH.map(s => [s[0], `${s[0]} (channel)`]), [['custom', 'Custom W (enter below)']]) })}${fld('Depth d', 'cf.dia.d', 'in')}${fld('Flange width b<sub>f</sub>', 'cf.dia.bf', 'in')}${fld('Flange thickness t<sub>f</sub>', 'cf.dia.tf', 'in')}${fld('Web thickness t<sub>w</sub>', 'cf.dia.tw', 'in')}${fld('Grade', 'cf.dia.gr', '', 'sel', { options: [['36', '36'], ['50', '50']] })}${fld('Bolts per end (one vertical line)', 'cf.dia.nb', '')}${fld('Bolt pitch', 'cf.dia.pitch', 'in')}${fld('Bolt line to girder web', 'cf.dia.ecc', 'in')}${fld('End diaphragm shape (bearing lines)', 'cf.dia.eShape', '', 'sel', { options: [['', 'Same as the intermediate']].concat(CF_DIA.map(s => [s[0], s[0]]), CF_CH.map(s => [s[0], `${s[0]} (channel)`])) })}${fld('End diaphragm bolts per end', 'cf.dia.eNb', '', 'num', { note: 'blank = same' })}${fld('Jacking at the end diaphragms', 'cf.dia.end', '', 'sel', { options: [['no', 'No'], ['yes', 'Yes']] })}${fld('Jacking reaction per jack, 1.3 × permanent (3.4.3.1)', 'cf.dia.Rj', 'kip')}${fld('Jack offset from girder centerline', 'cf.dia.aj', 'in')}<p class="note full">With the diaphragm selected it is the design: the angle checks (CF1 to CF9) are not used and CFD governs. Auto-design selects the diaphragm when the girder depth d is below the minimum for cross-frames (double-click the "Intermediate bracing used" label to lock the choice), choosing the lightest channel, then W, at least 0.75 d deep (6.7.4.2, plate girders) that passes every CFD item, and the bolts (one vertical row). Assumptions to verify: web bolted to the connection plate with one vertical row of bolts; diaphragm centered on the web depth; member ends 1.5 in past the bolt line. <b>End (bearing-line) diaphragms</b> (check CFE) replace the end cross-frames when the diaphragm is used: the same section or deeper, sized by auto-design (lock the end shape or bolts by double-clicking their labels), checked for the jacking reaction entered here (1.3 × permanent, 3.4.3.1; the Structural analysis module lists it per support) and for the module's brace moment and wind force per frame; the superstructure wind and seismic forces to the bearings are not checked (verify).</p></div>
         ${secHd('sec-cfc', 'End connections')}<div class="sec-body" id="sec-cfc">${fld('Bolt diameter', 'cf.conn.d', '', 'sel', { options: [['0.875', '7/8 in'], ['1', '1 in']] })}${fld('Grade', 'cf.conn.gr', '', 'sel', { options: [['A325', 'F3125 A325'], ['A490', 'F3125 A490']] })}
         ${fld('Threads', 'cf.conn.thr', '', 'sel', { options: [['incl', 'Included'], ['excl', 'Excluded']] })}${fld('Bolts per member end', 'cf.conn.n', '')}${fld('Pitch', 'cf.conn.s', 'in', 'dim')}${fld('End distance', 'cf.conn.e', 'in', 'dim')}${fld('Gusset thickness', 'cf.conn.tg', 'in', 'dim')}
         <p class="note">One line of bolts through the connected leg, single shear, standard holes.</p></div>` }; },
@@ -2855,7 +2858,7 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
       const Ms = M.filter(m => m.dP > 0); if (!Ms.length) c.naWhy = 'No fatigue force ranges entered (from a refined analysis).';
       Ms.forEach(m => c.items.push(rc(`${m.l} (${m.name})`, [f2(m.dP), f2(m.df), f2(R.FT), f2(m.df / R.FT)], m.df, R.FT, T`${f3(R.gF)}\frac{${f2(m.dP)}}{${f2(m.A)}} = ${f2(m.df)} \;${LE(m.df, R.FT)}\; ${f2(R.FT)}\ \text{ksi}`))); out.add(c); }
     if (cfDiaOn(R.p)) out.forEach(c => { if (/^CF[1-9]$/.test(c.id)) { c.items = []; c.status = 'na'; c.gov = -1; c.naWhy = 'Not used: diaphragm selected (the intermediate bracing is the channel or rolled W diaphragm, check CFD).'; } });
-    cfDiaChecks(R, out);
+    cfDiaChecks(R, out); cfDiaChecks(R, out, true);   // intermediate (CFD) and end (CFE) diaphragms
     { const TR = cfTypeRec(R.p), c = { id: 'CF10', grp: 'Bracing type', title: 'Intermediate bracing type for the girder depth', ref: 'Common practice (e.g. AISC/NSBA G13.1 guidance; owner standards govern); AASHTO LRFD 6.7.4.2', src: 'Practice',
         sym: T`d \ge d_{min} = ${f2(TR.dMin)}\ \text{in} \Rightarrow \text{cross-frame}; \qquad d < d_{min} \Rightarrow \text{channel (C, MC) or rolled W diaphragm},\ d_{dia} \ge 0.75d`, cols: ['Girder depth d', 'Minimum for cross-frames', 'Recommended', 'Selected'], items: [],
         note: 'Basis: the girder depth d (out-to-out of the flanges, the "Girder depth d" input), not the web depth. Below the minimum, a cross-frame is too shallow for efficient diagonals, so a channel or a rolled W diaphragm at least 0.75 of the girder depth (6.7.4.2, plate girders) is used: the lightest channel, else the lightest W. Auto-design selects the diaphragm below the minimum, designs it, and switches back to the cross-frame at or above it, unless the "Intermediate bracing used" input is locked. The diaphragm is checked as CFD (Members tab, Diaphragm section).' };
@@ -2864,7 +2867,7 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
       out.add(c); }
     return out;
   },
-  kq(R) { if (cfDiaOn(R.p)) { const q = R.p.dia, X = cfDiaSec(q); return [['Type', `${X.chS ? 'Channel' : 'Rolled'} diaphragm ${X.nm_}`], ['Depth', `${f2(X.d)} in (0.75 d = ${f2(0.75 * nm(R.p.dg))} in)`], ['Wind force, Strength III', `${f2(R.W.III.Fw)} kip`], ['Bolts', `${Math.max(2, Math.round(+q.nb || 2))} × ${frac(R.bolt.d)} in per end, one row at ${f2(+q.pitch || 3)} in`]]; }
+  kq(R) { if (cfDiaOn(R.p)) { const q = R.p.dia, X = cfDiaSec(q); return [['Type', `${X.chS ? 'Channel' : 'Rolled'} diaphragm ${X.nm_}`], ['Depth', `${f2(X.d)} in (0.75 d = ${f2(0.75 * nm(R.p.dg))} in)`], ['Wind force, Strength III', `${f2(R.W.III.Fw)} kip`], ['Bolts', `${Math.max(2, Math.round(+q.nb || 2))} × ${frac(R.bolt.d)} in per end, one row at ${f2(+q.pitch || 3)} in`], ['End diaphragms', (e => `${cfDiaSec(e).nm_}, ${Math.max(2, Math.round(+e.nb || 2))} bolts per end`)(cfDiaEnd(q))]]; }
     return [['Type', { X: 'X-frame', Kb: 'K-frame (bottom)', Kt: 'K-frame (top)' }[R.p.type]], ['Members', Object.values(R.mem).map(m => m.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')], ['Wind force, Strength III', `${f2(R.W.III.Fw)} kip`], ['Bolts', `${R.n} × ${frac(R.bolt.d)} in per end`]]; },
   scope: ['Refined analysis of skewed or curved framing (enter those member forces directly)', 'Gusset plate and connection plate design (see the Transverse stiffeners module for connection plate welds)', 'Slip resistance of the bolted connections', 'Tension-only diagonals', 'WT and double-angle members'],
   combos(R) { const w = R.W; let h = card('cb-w', 'Wind load on the exterior girder', 'AASHTO LRFD 3.8.1.2.1, 4.6.2.7.1', eq('Strength III', '', T`P_Z = 2.56\times10^{-6}(${f0(w.III.V)})^2(${f2(nm(R.p.wind.Kz))})(${f2(nm(R.p.wind.G))})(${f2(nm(R.p.wind.Cd))}) = ${w.III.PZ.toFixed(4)}\ \text{ksf}, \quad W = \frac{1.0\,P_Zd}{2} = \frac{${w.III.PZ.toFixed(4)}(${f3(R.dft)})}{2} = ${f3(w.III.W)}\ \text{kip/ft}, \quad F_w = WL_b = ${f3(w.III.W)}(${f2(R.Lb)}) = ${f2(w.III.Fw)}\ \text{kip}`)
@@ -2873,12 +2876,13 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
     h += card('cb-t', 'Member forces from the truss model', 'Direct stiffness, pinned joints', `<div class="tscroll"><table class="tbl"><thead><tr><th>Member</th><th class="right">Length (in)</th><th class="right">Force per kip of F<sub>w</sub></th>${R.combos.map(c => `<th class="right">${c.id} T / C (kip)</th>`).join('')}</tr></thead><tbody>${R.frames.map((e, i) => `<tr><td class="lbl">${e.lbl}</td><td class="val">${f2(e.L)}</td><td class="val">${f3(e.unit)}</td>${R.combos.map(c => `<td class="val">${f2(c.f[i].T)} / ${f2(c.f[i].Cc)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
       <p class="note-p">T and C are the governing tension and compression in each combination: analysis force ± |wind force|.${cfDiaOn(R.p) ? ' <b>Diaphragm selected:</b> these truss forces are not used; the wind force F<sub>w</sub> above is checked on the diaphragm in CFD.' : ''}</p>`);
     return h; },
-  drawings(R) { if (cfDiaOn(R.p)) return card('dw-cf', 'Diaphragm elevation', 'To scale; nominal dimensions', `<div class="dwg-wrap">${cfDiaSVG(R)}</div><p class="cap">Diaphragm centered on the girder depth, web bolted to the connection plates with one vertical row of bolts (assumed detail; verify). F<sub>w</sub>: governing Strength III or V wind force at the exterior girder bottom flange.</p>`);
+  drawings(R) { if (cfDiaOn(R.p)) return card('dw-cf', 'Diaphragm elevation', 'To scale; nominal dimensions', `<div class="dwg-wrap">${cfDiaSVG(R)}</div><p class="cap">Diaphragm centered on the girder depth, web bolted to the connection plates with one vertical row of bolts (assumed detail; verify). F<sub>w</sub>: governing Strength III or V wind force at the exterior girder bottom flange.</p>`)
+      + card('dw-cfe', 'End diaphragm elevation (bearing lines)', 'To scale; nominal dimensions; normal to the girders', `<div class="dwg-wrap">${cfDiaSVG(R, true)}</div><p class="cap">End diaphragm at the bearing lines (check CFE); bearing stiffeners serve as the connection plates. Along a skewed bearing line the diaphragm is longer by 1/cos θ (DXF end detail).</p>`);
     return card('dw-cf', 'Cross-frame elevation', 'To scale; Strength III wind forces', `<div class="dwg-wrap">${cfSVG(R)}</div><p class="cap">Force labels: Strength III wind force per member (tension +) for wind toward the interior girder.</p>`); },
   echo(R) { return { kv: [['Type', { X: 'X-frame', Kb: 'K-frame, diagonals meet at the bottom chord', Kt: 'K-frame, diagonals meet at the top chord' }[R.p.type]], ['S / h / d / L_b', `${f2(R.S)} in / ${f2(R.h)} in / ${f2(nm(R.p.dg))} in / ${f2(R.Lb)} ft`], ['Wind V, K_z, G, C_D', `${f0(nm(R.p.wind.V))} mph, ${R.p.wind.Kz}, ${R.p.wind.G}, ${R.p.wind.Cd}`], ['Grades: angles / gusset', `${R.p.gA} / ${R.p.gG}`],
       ...Object.values(R.mem).map(m => [m.l, m.name]), ['Bolts', `${R.n} × ${frac(R.bolt.d)} in ${R.p.conn.gr} per end, pitch ${frac(R.s)}, end ${frac(R.e0)}, gusset ${frac(R.tg)} in`],
       ['User forces Str I (top/bot/diag)', `${R.p.user.StrI.top} / ${R.p.user.StrI.bot} / ${R.p.user.StrI.diag}`, 'kip'], ['User forces Con (top/bot/diag)', `${R.p.user.Con.top} / ${R.p.user.Con.bot} / ${R.p.user.Con.diag}`, 'kip'],
-      ...(cfDiaOn(R.p) ? (q => [['Intermediate bracing used', `diaphragm ${cfDiaSec(q).nm_}, grade ${q.gr}; ${Math.max(2, Math.round(+q.nb || 2))} bolts per end at ${f2(+q.pitch || 3)} in, ${f2(+q.ecc || 0)} in from the girder web (the angles above are not used)`]])(R.p.dia) : [])] }; },
+      ...(cfDiaOn(R.p) ? (q => [['Intermediate bracing used', `diaphragm ${cfDiaSec(q).nm_}, grade ${q.gr}; ${Math.max(2, Math.round(+q.nb || 2))} bolts per end at ${f2(+q.pitch || 3)} in, ${f2(+q.ecc || 0)} in from the girder web (the angles above are not used)`], ['End diaphragms (bearing lines)', (e => `${cfDiaSec(e).nm_}; ${Math.max(2, Math.round(+e.nb || 2))} bolts per end; jacking ${q.end === 'yes' && +q.Rj > 0 ? `${f2(+q.Rj)} kip at ${f2(+q.aj)} in` : 'not checked'}`)(cfDiaEnd(q))]])(R.p.dia) : [])] }; },
   inbox(j) { const s = j && j.mods && j.mods.cf; return s ? { n: 1, what: 'cross-frame geometry and deck-placement bracing', apply: () => Object.assign(P.cf, { ...s, sb: { ...P.cf.sb, ...(s.sb || {}) } }) } : null; }
 };
 /* recommended intermediate bracing type from the girder depth (2026-10-12): cross-frame at or above the minimum depth (X or K by S/h, as the auto-design does),
@@ -2905,8 +2909,8 @@ function cfSVG(R) {
 }
 
 /* diaphragm elevation (cf.dia.on = 'yes'): channel or W centered on the girder depth, web bolted to the connection plates with one vertical row */
-function cfDiaSVG(R) {
-  const q = R.p.dia, X = cfDiaSec(q), dg = nm(R.p.dg), S = R.S, SB = R.SB, Wpx = 900, sc = Math.min(700 / S, 360 / dg), Xp = x => 100 + x * sc, Yp = y => 40 + (dg - y) * sc;
+function cfDiaSVG(R, end) {
+  const q = end ? cfDiaEnd(R.p.dia) : R.p.dia, X = cfDiaSec(q), dg = nm(R.p.dg), S = R.S, SB = R.SB, Wpx = 900, sc = Math.min(700 / S, 360 / dg), Xp = x => 100 + x * sc, Yp = y => 40 + (dg - y) * sc;
   const bfT = SB ? SB.bc : 12, bfB = SB ? SB.bt : 12, tT = SB ? SB.tc : 0.75, tB = SB ? SB.tt : 1, ft = t => Math.max(3, t * sc), gap = cfDiaGap(q), ecc = +q.ecc || 3.5, y0 = (dg - X.d) / 2, y1 = y0 + X.d;
   const nb = Math.max(2, Math.round(+q.nb || 2)), s = +q.pitch || 3, rb = Math.max(2.5, ((+((R.p.conn || {}).d) || 0.875) / 2) * sc);
   const wk = R.W.III.Fw >= R.W.V.Fw ? 'III' : 'V', Fw = R.W[wk].Fw; let o = '';
@@ -2916,7 +2920,7 @@ function cfDiaSVG(R) {
   o += `<rect x="${Xp(gap)}" y="${Yp(y1)}" width="${(S - 2 * gap) * sc}" height="${X.d * sc}" fill="${DC.inn}" fill-opacity="0.6" stroke="${DC.innS}" stroke-width="2"/>`;
   [y0 + X.tf, y1 - X.tf].forEach(y => o += `<path d="M${Xp(gap)} ${Yp(y)}H${Xp(S - gap)}" stroke="${DC.innS}" stroke-width="1"/>`);
   [ecc, S - ecc].forEach(x => { for (let i = 0; i < nb; i++) o += `<circle cx="${Xp(x)}" cy="${Yp(dg / 2 + (i - (nb - 1) / 2) * s)}" r="${rb}" fill="${DC.bolt}"/>`; });
-  o += `<text x="${Xp(S / 2)}" y="${Yp(dg / 2) + 4}" class="sv-t" text-anchor="middle" style="paint-order:stroke;stroke:#fff;stroke-width:4px">${X.chS ? 'Channel' : 'Rolled'} diaphragm ${X.nm_}; ${nb} bolts per end at ${f2(s)} in</text>`;
+  o += `<text x="${Xp(S / 2)}" y="${Yp(dg / 2) + 4}" class="sv-t" text-anchor="middle" style="paint-order:stroke;stroke:#fff;stroke-width:4px">${X.chS ? 'Channel' : 'Rolled'} ${end ? 'end ' : ''}diaphragm ${X.nm_}; ${nb} bolts per end at ${f2(s)} in</text>`;
   o += `<path d="M${Xp(0) - 70} ${Yp(0)}H${Xp(0) - 8}" stroke="#c0392b" stroke-width="2" marker-end="url(#ar)"/><text x="${Xp(0) - 95}" y="${Yp(0) + 18}" class="sv-t sv-sm">F<tspan baseline-shift="sub" font-size="8">w</tspan> = ${f2(Fw)} kip (Str ${wk})</text>`;
   o += dimH(Xp(0), Xp(S), Yp(0) + 34, `S = ${f2(S)} in`) + dimV(Xp(S) + 40, Yp(y1), Yp(y0), `d = ${f2(X.d)} in`, false) + dimV(Xp(S) + 110, Yp(dg), Yp(0), `girder d = ${f2(dg)} in`, false);
   return `<svg viewBox="0 0 ${Wpx} ${Yp(0) + 60}" class="dwg" role="img" aria-label="Diaphragm"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#c0392b"/></marker></defs>${o}</svg>`;
@@ -5231,7 +5235,7 @@ AD.cf = () => { const C0 = P.cf, out = [], D = k => parseDim(k), area = n => { c
   return out; };
 /* diaphragm design (cf.dia.on = 'yes'): the lightest channel, then W, at least 0.75 of the girder depth (6.7.4.2, plate girders) that passes every CFD item,
    with the fewest bolts in one vertical row; the angle inputs are left as they are (not used). Locked shape, bolt count, and pitch are kept. */
-const adCfDia = (C0, out, TR, lk) => { const q = C0.dia, dg = TR.dg, need = 0.75 * dg, D = k => parseDim(k), cw = s => 2 * s[2] * s[3] + (s[1] - 2 * s[3]) * s[4];
+const adCfDiaInt = (C0, out, TR, lk) => { const q = C0.dia, dg = TR.dg, need = 0.75 * dg, D = k => parseDim(k), cw = s => 2 * s[2] * s[3] + (s[1] - 2 * s[3]) * s[4];
   const db = D((C0.conn || {}).d) || 0.875, em = (BOLT[(C0.conn || {}).d] || BOLT['0.875']).emin.cut, lkS = adLocked('cf.dia.shape'), lkN = adLocked('cf.dia.nb'), lkP = adLocked('cf.dia.pitch');
   const all = [...CF_CH.slice().sort((a, b) => cw(a) - cw(b)), ...CF_DIA], deepEnough = all.filter(s => s[1] >= need - 1e-9);
   const cands = lkS ? [CF_CH.find(s => s[0] === q.shape) || CF_DIA.find(s => s[0] === q.shape) || ['custom', D(q.d), D(q.bf), D(q.tf), D(q.tw)]] : deepEnough.length ? deepEnough : [CF_DIA[CF_DIA.length - 1]];
@@ -5256,6 +5260,25 @@ const adCfDia = (C0, out, TR, lk) => { const q = C0.dia, dg = TR.dg, need = 0.75
   if (sys) out.push(`Torsional brace system stiffness (CFD) cannot be met by any diaphragm: with a rigid brace, β_sec = ${isFinite(sys.bsec) ? f0(sys.bsec) : '∞'} and β_g = ${f0(sys.bg)} kip-in/rad in series give at most ${f0(1 / ((isFinite(sys.bsec) ? 1 / sys.bsec : 0) + 1 / sys.bg))} against β_T,req = ${f0(sys.bReq)} kip-in/rad (C = ${f2(sys.Cs)}; the 0.8 D bracing-depth test uses the depth of the deepest candidate diaphragm, ${f2(sys.hBr)} in, against 0.8 D = ${f2(0.8 * sys.Dg)} in). ${sys.bg < sys.bReq ? 'The girders\' in-plane stiffness β_g is itself below the requirement: more girders, a shorter span, or top lateral bracing is needed' : 'Web distortion governs: full-depth connection plates, a wider or thicker connection plate, or a bracing depth of at least 0.8 D is needed'}. The section below passes every other CFD item; CFD still fails on the stiffness`);
   out.push(`${CF_CH.some(x => x[0] === q.shape) ? 'Channel' : 'Rolled'} diaphragm ${q.shape} (d = ${f2(done.sec[1])} in ${done.sec[1] >= need - 1e-9 ? "≥" : "<"} 0.75 d = ${f2(need)} in${lkS ? ', shape locked' : ''}${lk ? ', bracing type locked' : ''}): the lightest channel or W that passes every CFD item${sys ? ' other than the system stiffness' : ''}; ${q.nb} - ${frac(db)} in bolts per end in one vertical row at ${f2(s)} in${g ? `; governing: ${g.loc.replace(/ \(.*$/, '')}, ratio ${g.r != null ? f2(g.r) : '—'}` : ''}`);
   return out; };
+/* the diaphragm (intermediate, then end): the end (bearing-line) diaphragm starts from the intermediate section and goes to heavier, at least as deep
+   sections until every CFE item passes, with the fewest bolts (same pitch and bolt-line rule); locks cf.dia.eShape and cf.dia.eNb are kept (2026-10-13) */
+const adCfDia = (C0, out, TR, lk) => { adCfDiaInt(C0, out, TR, lk); adCfDiaEnd(C0, out, TR); return out; };
+const adCfDiaEnd = (C0, out, TR) => { const q = C0.dia, need = 0.75 * TR.dg, D = k => parseDim(k), cw = x => 2 * x[2] * x[3] + (x[1] - 2 * x[3]) * x[4];
+  const em = (BOLT[(C0.conn || {}).d] || BOLT['0.875']).emin.cut, s = D(q.pitch) || 3, lkS = adLocked('cf.dia.eShape'), lkN = adLocked('cf.dia.eNb');
+  const all = [...CF_CH.slice().sort((a, b) => cw(a) - cw(b)), ...CF_DIA], iSec = all.find(x => x[0] === q.shape) || ['', D(q.d), D(q.bf), D(q.tf), D(q.tw)];   // '' = same as the intermediate (custom W)
+  const rest = all.includes(iSec) ? all.slice(all.indexOf(iSec) + 1) : CF_DIA, cands = lkS ? [all.find(x => x[0] === (q.eShape || q.shape)) || iSec] : [iSec, ...rest.filter(x => x[1] >= iSec[1] - 1e-9)];
+  const noDeep = !cands.some(x => x[1] >= need - 1e-9), isDep = i => noDeep && i.loc.startsWith('Depth'), nMax = sec => Math.max(2, Math.floor((sec[1] - 2 * sec[3] - 1.0 - 2 * em) / s + 1e-9) + 1);
+  const nFix = +q.eNb >= 2 ? +q.eNb : +q.nb, failsOf = r => { const c = r && r.C.find(x => x.id === 'CFE'); return c ? c.items.filter(i => !AD_OK.includes(i.st)).map(i => i.loc.replace(/ \(.*$/, '')) : ['input errors']; };
+  let done = null; const skipped = [];
+  for (const sec of cands) { if (!lkS) q.eShape = sec[0]; let last = null;
+    for (let n = lkN ? nFix : 2; n <= (lkN ? nFix : nMax(sec)); n++) { q.eNb = n; const r = adEval('cf'); last = r; if (r && adGood(r.C, ['CFE'], i => !isDep(i))) { done = { sec, n }; break; } }
+    if (done) break; skipped.push(`${sec[0] || 'custom W'} (${[...new Set(failsOf(last))].join(', ')})`); }
+  const jk = q.end === 'yes' && +q.Rj > 0 ? `jacking ${f2(+q.Rj)} kip checked` : 'jacking not checked ("Jacking at the end diaphragms" off or no reaction entered)';
+  if (!done) { const big = cands[cands.length - 1]; if (!lkS) q.eShape = big[0]; if (!lkN) q.eNb = nMax(big); const r = adEval('cf');
+    out.push(`End diaphragms (bearing lines): no ${lkS ? 'bolt count for the locked shape' : 'section from the intermediate one up'} passes every CFE item: ${skipped.join('; ')}. ${big[0] || 'The custom W'} with ${q.eNb} bolts per end was left in place${r ? `; still failing: ${[...new Set(failsOf(r))].join(', ')}` : ''}; ${jk}`); return out; }
+  const r = adEval('cf'), c = r && r.C.find(x => x.id === 'CFE'), g = c && c.items[c.gov], same = done.sec === iSec;
+  out.push(`End diaphragms (bearing lines): ${done.sec[0] || 'custom W'} (${same ? 'same as the intermediate' : `deeper or heavier than the intermediate: ${skipped.join('; ')}`}${lkS ? ', shape locked' : ''}), ${q.eNb} - ${frac(D((C0.conn || {}).d) || 0.875)} in bolts per end at ${f2(s)} in; ${jk}${g ? `; governing: ${g.loc.replace(/ \(.*$/, '')}, ratio ${g.r != null ? f2(g.r) : '—'}` : ''}`);
+  return out; };
 AD.oh = () => { const O = P.oh, out = [], D = k => parseDim(k);
   O.rows.forEach((row, ri) => { const pre = `oh.rows.${ri}.`, mine = i => String(i.loc).startsWith(row.name || ''), cur = D(row.Lb); if (adLocked(pre + 'Lb')) { out.push(`${row.name}: L_b locked at ${f2(cur)} ft`); return; }
     let best = null; for (let L = 5; L <= 40 + 1e-9; L += 0.5) { row.Lb = L; const r = adEval('oh'); if (r && adGood(r.C, ['OH1', 'OH2', 'OH3', 'OH4', 'OH5'], mine)) best = L; else if (best !== null) break; }
@@ -5334,7 +5357,9 @@ function designAllRun0(j, quiet) {
   const scE = adEval('sc'); let studs = 0; if (scE) { const R = scE.R; R.zones.forEach(z => { studs += z.nr * Math.floor((z.x2 - z.x1) * 12 / z.p + 1e-6); R.gaps.forEach(gp => { const L = Math.max(0, Math.min(z.x2, gp.b) - Math.max(z.x1, gp.a)); if (L > 0) studs -= z.nr * Math.ceil(L * 12 / z.p - 1e-6); }); }); }
   studs *= nb; add('Shear studs', studs, 'each', studs * S.cStud);
   const cfE = adEval('cf'); if (cfE && cfDiaOn(P.cf)) { const R = cfE.R, dq = P.cf.dia, X = cfDiaSec(dq), nF = Math.max(0, (q.frames || 0) - (q.framesSup || 0)), Ld = Math.max(0, R.S - 2 * cfDiaGap(dq)), lbD = X.A * Ld * lbS, bD = 2 * Math.max(2, Math.round(+dq.nb || 2));   // diaphragm selected: steel from the nominal area over S less the end gaps, and its bolts
-    add(`Intermediate diaphragms (${nF}, ${X.nm_}, ${f2(Ld / 12)} ft at ${f2(X.wpf)} lb/ft): steel`, nF * lbD / 1000, 'kip', nF * lbD * S.cDet); add('Diaphragms: bolts', nF * bD, 'each', nF * bD * S.cBolt); }
+    add(`Intermediate diaphragms (${nF}, ${X.nm_}, ${f2(Ld / 12)} ft at ${f2(X.wpf)} lb/ft): steel`, nF * lbD / 1000, 'kip', nF * lbD * S.cDet); add('Diaphragms: bolts', nF * bD, 'each', nF * bD * S.cBolt);
+    const eq = cfDiaEnd(dq), XE = cfDiaSec(eq), nE = Math.max(0, q.framesSup || 0), skw = ((P.df || {}).bridge || {}).skews || [], skM = skw.length ? Math.max(...skw.map(v => Math.abs(+v) || 0)) : 0, LdE = Math.max(0, R.S / Math.cos(skM * Math.PI / 180) - 2 * cfDiaGap(eq)), lbE = XE.A * LdE * lbS, bE = 2 * Math.max(2, Math.round(+eq.nb || 2));   // end (bearing-line) diaphragms, length along the largest skew (2026-10-13)
+    if (nE) { add(`End diaphragms at the bearing lines (${nE}, ${XE.nm_}, ${f2(LdE / 12)} ft${skM ? ` along ${f0(skM)}° skew` : ''} at ${f2(XE.wpf)} lb/ft): steel`, nE * lbE / 1000, 'kip', nE * lbE * S.cDet); add('End diaphragms: bolts', nE * bE, 'each', nE * bE * S.cBolt); } }
   else if (cfE) { const R = cfE.R, nF = Math.max(0, (q.frames || 0) - (q.framesSup || 0)), lbF = R.frames.reduce((a, e) => a + e.L * R.mem[e.k].A * lbS, 0), bF = R.frames.length * 2 * parseDim(P.cf.conn.n);
     add(`Intermediate cross-frames (${nF}): members`, nF * lbF / 1000, 'kip', nF * lbF * S.cDet); add('Cross-frames: bolts', nF * bF, 'each', nF * bF * S.cBolt); }
   const total = cost.reduce((a, c) => a + c.c, 0);
@@ -5578,8 +5603,8 @@ function dxfPlan(D, C) {
   if (m.splices.length) { D.chainH(ly.d, [X(gN.x0 + gN.bear[0]), ...m.splices.map(s => X(gN.x0 + s)), X(gN.x0 + gN.bear[gN.bear.length - 1])], Y(wid) + 6 * h, Y(wid)); m.splices.forEach((s, i) => D.text(ly.t, X(gN.x0 + s), Y(wid) + 8.4 * h, h * 0.8, `FS${i + 1}`, 1)); }
   m.spans.forEach((L, i) => D.dimH(ly.d, X(g0.x0 + g0.bear[i]), X(g0.x0 + g0.bear[i + 1]), Y(0) - 6 * h, Y(0), `SPAN ${i + 1} = <> (G1)`));
   { const f = FR.frames.find(q => q.type !== 'sup' && q.bay === 0), fe = FR.frames.find(q => q.type === 'sup' && q.bay === 0);
-    if (f) dxfTag(D, ly.t, X((f.xa + f.xc) / 2), Y((FR.ys[0] + FR.ys[1]) / 2), 'X', `INTERMEDIATE CROSS-FRAME, ${dxfNo(C, 'CROSS-FRAME')}`);
-    if (fe) dxfTag(D, ly.t, X((fe.xa + fe.xc) / 2), Y((FR.ys[0] + FR.ys[1]) / 2), 'E', `END CROSS-FRAME, ${dxfNo(C, 'CROSS-FRAME')}`, -1, 1); }
+    if (f) dxfTag(D, ly.t, X((f.xa + f.xc) / 2), Y((FR.ys[0] + FR.ys[1]) / 2), 'X', `INTERMEDIATE ${cfDiaOn(P.cf) ? 'DIAPHRAGM' : 'CROSS-FRAME'}, ${dxfNo(C, 'CROSS-FRAME')}`);
+    if (fe) dxfTag(D, ly.t, X((fe.xa + fe.xc) / 2), Y((FR.ys[0] + FR.ys[1]) / 2), 'E', `END ${cfDiaOn(P.cf) ? 'DIAPHRAGM' : 'CROSS-FRAME'}, ${dxfNo(C, 'CROSS-FRAME')}`, -1, 1); }
   D.text(ly.t, xMin, Y(wid) + 14 * h, h * 1.6, 'FRAMING PLAN');
   D.text(ly.t, xMin, Y(wid) + 12.4 * h, h * 0.75, 'TOP FLANGES, CONNECTION PLATES, BEARING STIFFENERS, INTERMEDIATE STIFFENERS, AND TOP FLANGE SPLICE PLATES SHOWN TO SCALE. SQUARE = BEARING.');
   { const g1 = FR.girders[0]; m.top.forEach(s => D.text(ly.t, X(g1.x0 + (s.x0 + s.x1) / 2), Y(g1.y) + s.b / 2 + 0.8 * h, h * 0.7, `TOP FL. ${frac(s.b)} x ${frac(s.t)} (TYP. ALL GIRDERS)`, 1)); }
@@ -5751,15 +5776,22 @@ function dxfCF(D, C) {
   D.text(ly.t, 0, Dt + 8 * h, h * 1.3, `INTERMEDIATE CROSS-FRAME (TYPE ${/^K/.test(p.type) ? 'K' : 'X'})`); }
   { const th = Math.max(...m.skews.map(v => Math.abs(v))), Se = S / Math.cos(th * Math.PI / 180), ox = S + tf.b + 30 * h, i0 = D.mark();
     [0, Se].forEach(x => { D.rect(ly.g, ox + x - bf.b / 2, 0, ox + x + bf.b / 2, bf.t); D.rect(ly.g, ox + x - tw / 2, bf.t, ox + x + tw / 2, bf.t + Dm); D.rect(ly.g, ox + x - tf.b / 2, bf.t + Dm, ox + x + tf.b / 2, Dt); D.rect(ly.cp, ox + x + (x ? -1 : 1) * (tw / 2), bf.t, ox + x + (x ? -1 : 1) * (tw / 2 + 0.75), bf.t + Dm); });
+    if (dOn) { const q = cfDiaEnd(p.dia), X = cfDiaSec(q), g = tw / 2 + cfDiaGap(q), y0 = (Dt - X.d) / 2, y1 = y0 + X.d, ec = +q.ecc || 3.5, nb = Math.max(2, Math.round(+q.nb || 2)), s0 = +q.pitch || 3;   // end diaphragm along the bearing line (2026-10-13)
+      D.rect(ly.x, ox + g, y0, ox + Se - g, y1); D.line(ly.x, ox + g, y0 + X.tf, ox + Se - g, y0 + X.tf); D.line(ly.x, ox + g, y1 - X.tf, ox + Se - g, y1 - X.tf); D.line(ly.c, ox, Dt / 2, ox + Se, Dt / 2, cl);
+      [ec, Se - ec].forEach(x => { for (let i = 0; i < nb; i++) D.circle(ly.bo, ox + x, Dt / 2 + (i - (nb - 1) / 2) * s0, rb); });
+      D.text(ly.t, ox + Se / 2 - 12 * h, y1 + 1.2 * h, h * 0.8, dxfStr(X.nm_)); D.dimV(ly.d, y0, y1, ox + Se + tf.b / 2 + 4 * h, ox + Se, 'DIAPHRAGM <>');
+      D.dimH(ly.d, ox, ox + Se, Dt + 4 * h, Dt, 'ALONG SKEW <>'); D.text(ly.t, ox, Dt + 8 * h, h * 1.3, `END DIAPHRAGM AT BEARINGS (${X.chS ? 'CHANNEL' : 'ROLLED W'}, ALONG ${f2(th)} DEG. SKEW)`);
+      D.text(ly.t, ox, -6 * h, h * 0.8, dxfStr(`END DIAPHRAGM ${X.nm_} ASTM A709 GR. ${q.gr || 50}; WEB BOLTED WITH ${nb} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END IN ONE ROW @ ${dxfIn(s0)}, ${dxfIn(ec)} FROM GIRDER WEB; CENTERED ON GIRDER DEPTH; BEARING STIFFENERS SERVE AS CONNECTION PLATES (SKEWED OR BENT PLATES PER DESIGN).`)); }
+    else {
     [[[0, yt], [Se, yt]], [[0, yb], [Se, yb]], [[0, yb], [Se, yt]], [[0, yt], [Se, yb]]].forEach(([a, b]) => D.line(ly.x, ox + a[0], a[1], ox + b[0], b[1]));
     D.dimH(ly.d, ox, ox + Se, Dt + 4 * h, Dt, 'ALONG SKEW <>'); D.text(ly.t, ox, Dt + 8 * h, h * 1.3, `END CROSS-FRAME AT BEARINGS (ALONG ${f2(th)} DEG. SKEW)`);
     D.text(ly.t, ox, -4 * h, h * 0.8, 'MEMBERS PER THE CROSS-FRAME DESIGN; BEARING STIFFENERS SERVE AS CONNECTION PLATES (SKEWED OR BENT PLATES PER DESIGN).');
-    // connection detail: angle to connection plate
+    // connection detail: angle to connection plate (cross-frame only)
     const cx = 0, cy = -18 * h, n = Math.max(1, +cn.n || 2), s0 = +cn.s || 3, e0 = +cn.e || 1.5, Lc = e0 * 2 + (n - 1) * s0 + 4, mm = p.mem.diag || {};
     D.rect(ly.cp, cx, cy - Lc / 2 - 3, cx + 0.625, cy + Lc / 2 + 3); D.rect(ly.x, cx + 0.625, cy - (+mm.b1 || 4) / 2, cx + 0.625 + Lc + 6, cy + (+mm.b1 || 4) / 2);
     const bx = [...Array(n)].map((_, i) => cx + 0.625 + e0 + i * s0); bx.forEach(x => D.circle(ly.bo, x, cy, rb));
     D.chainH(ly.d, [cx + 0.625, ...bx], cy + (+mm.b1 || 4) / 2 + 3 * h, cy + (+mm.b1 || 4) / 2);
-    D.text(ly.t, cx, cy + Lc / 2 + 3 + 4 * h, h * 1.1, 'TYPICAL CONNECTION (MEMBER TO CONNECTION PLATE)'); D.text(ly.t, cx + Lc + 10, cy - 0.4 * h, h * 0.8, `${dxfStr(mm.sec || '')}: ${n} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS @ ${dxfIn(s0)}, EDGE ${dxfIn(e0)}${+cn.tg ? `; GUSSET ${dxfIn(+cn.tg)}` : ''}`); }
+    D.text(ly.t, cx, cy + Lc / 2 + 3 + 4 * h, h * 1.1, 'TYPICAL CONNECTION (MEMBER TO CONNECTION PLATE)'); D.text(ly.t, cx + Lc + 10, cy - 0.4 * h, h * 0.8, `${dxfStr(mm.sec || '')}: ${n} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS @ ${dxfIn(s0)}, EDGE ${dxfIn(e0)}${+cn.tg ? `; GUSSET ${dxfIn(+cn.tg)}` : ''}`); } }
   if (dOn) { const q = p.dia; D.text(ly.t, 0, -4 * h, h * 0.8, dxfStr(`DIAPHRAGM ${cfDiaSec(q).nm_} ASTM A709 GR. ${q.gr || 50}; WEB BOLTED TO CONNECTION PLATE WITH ${Math.max(2, Math.round(+q.nb || 2))} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END IN ONE ROW @ ${dxfIn(+q.pitch || 3)}, ${dxfIn(+q.ecc || 3.5)} FROM GIRDER WEB; CENTERED ON GIRDER DEPTH; COPE FLANGES AS REQUIRED; CONNECTION PLATES SHOWN SCHEMATICALLY.`)); return; }
   D.text(ly.t, 0, -4 * h, h * 0.8, `MEMBERS ASTM A709 GR. ${p.gA}; ${cn.n || 2} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END @ ${dxfIn(+cn.s || 3)}, EDGE ${dxfIn(+cn.e || 1.5)}; CONNECTION PLATES SHOWN SCHEMATICALLY.`);
 }
@@ -6128,9 +6160,9 @@ function v3bBuild() {
       inst(pts, new THREE.CylinderGeometry(d / 2, d / 2, hs, 8), M.stud); } }
   // cross-frames (members on their work points)
   if (lay.xf && !single) { const cf = P.cf || {}, Dt = D + tTmax + tBmax, h = Math.min(+cf.h || D * 0.8, Dt - 4), yb = -tBmax + (Dt - h) / 2, yt = yb + h, r = 1.4;
-    const dOn = cfDiaOn(cf), DX = dOn ? cfDiaSec(cf.dia) : null, ym = -tBmax + Dt / 2;   // diaphragm selected: channel or W centered on the girder depth at intermediate frames (end frames unchanged)
+    const dOn = cfDiaOn(cf), DXi = dOn ? cfDiaSec(cf.dia) : null, DXE = dOn ? cfDiaSec(cfDiaEnd(cf.dia)) : null, ym = -tBmax + Dt / 2;   // diaphragm selected: channel or W centered on the girder depth at intermediate and end (bearing-line) frames
     FR.frames.forEach(f => { const za = Z(f.bay), zc = Z(f.bay + 1), xa = f.xa * 12, xc = f.xc * 12, A = [xa, yb, za], At = [xa, yt, za], Bb = [xc, yb, zc], Bt = [xc, yt, zc];
-      if (dOn && f.type !== 'sup') { const dx = xc - xa, dz = zc - za, L = Math.hypot(dx, dz), g = cfDiaGap(cf.dia), Lm = Math.max(1, L - 2 * g), ry = Math.atan2(-dz, dx), ux = dx / L, uz = dz / L, cx = (xa + xc) / 2, cz = (za + zc) / 2, ch = !!DX.chS;
+      if (dOn) { const DX = f.type === 'sup' ? DXE : DXi, dx = xc - xa, dz = zc - za, L = Math.hypot(dx, dz), g = cfDiaGap(cf.dia), Lm = Math.max(1, L - 2 * g), ry = Math.atan2(-dz, dx), ux = dx / L, uz = dz / L, cx = (xa + xc) / 2, cz = (za + zc) / 2, ch = !!DX.chS;
         const pc = (off, y, sy, sz) => { const b = box(cx - uz * off, y, cz + ux * off, Lm, sy, sz, M.xf); b.rotation.y = ry; };
         pc(0, ym, DX.d - 2 * DX.tf, DX.tw); const fo = ch ? (DX.bf - DX.tw) / 2 : 0; pc(fo, ym + (DX.d - DX.tf) / 2, DX.tf, DX.bf); pc(fo, ym - (DX.d - DX.tf) / 2, DX.tf, DX.bf); return; }
       rod(A, Bb, r, M.xf); rod(At, Bt, r, M.xf);
@@ -6178,7 +6210,7 @@ function v3bBuild() {
     const def = m.splices.length ? 's0' : 'b1'; fsel.value = def; V3B.tg[def] != null ? V3B.focus(V3B.tg[def]) : V3B.home(); V3B.home2 = () => { const v = fsel.value; V3B.tg[v] != null ? V3B.focus(V3B.tg[v]) : V3B.home(); }; }
   else { fsel.hidden = true; V3B.home(); V3B.home2 = V3B.home; }
   const nStud = lay.stud ? '' : ' Studs are off (turn them on to see every stud at its pitch zone).';
-  document.getElementById('v3b-note').textContent = single ? `Composite girder G${gs + 1}: plates as designed, haunch, tributary deck strip, connection plates, bearing stiffeners, splice plates with every bolt, and shear studs.${nStud} Drag to rotate, right-drag to pan, scroll to zoom.` : `${nb} girders, ${FR.frames.length} ${cfDiaOn(P.cf) ? `bracing lines: intermediate diaphragms (${cfDiaSec(P.cf.dia).nm_}) and end cross-frames` : `cross-frames (type ${(P.cf && P.cf.type) || 'X'})`}, deck ${frac(ts)} in. on ${frac(hh)} in. haunch, skew ${m.skews.map(v => f2(v)).join(' / ')} deg.${nStud} Drag to rotate, right-drag to pan, scroll to zoom.`;
+  document.getElementById('v3b-note').textContent = single ? `Composite girder G${gs + 1}: plates as designed, haunch, tributary deck strip, connection plates, bearing stiffeners, splice plates with every bolt, and shear studs.${nStud} Drag to rotate, right-drag to pan, scroll to zoom.` : `${nb} girders, ${FR.frames.length} ${cfDiaOn(P.cf) ? `bracing lines: intermediate diaphragms (${cfDiaSec(P.cf.dia).nm_}) and end diaphragms (${cfDiaSec(cfDiaEnd(P.cf.dia)).nm_})` : `cross-frames (type ${(P.cf && P.cf.type) || 'X'})`}, deck ${frac(ts)} in. on ${frac(hh)} in. haunch, skew ${m.skews.map(v => f2(v)).join(' / ')} deg.${nStud} Drag to rotate, right-drag to pan, scroll to zoom.`;
 }
 document.addEventListener('click', e => { const id = e.target.id;
   if (id === 'btn-v3dbr') v3bOpen();
@@ -6693,7 +6725,7 @@ function renderErrors() { crMarkStale();
   const h = `<div class="alert fail"><b>Checks are blocked until these inputs are fixed.</b><ul class="err-list">${RS.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
   ['summary', 'combos', 'checks', 'drawings', 'v3d'].forEach(t => $('#tab-' + t).innerHTML = h);
 }
-const grps = () => P.mod === 'cf' && cfDiaOn(P.cf) ? ['Diaphragm (intermediate bracing used)', ...MODS.cf.groups] : (MODS[P.mod] || MODS.splice).groups;   // cross-frames: the diaphragm group (check CFD) is listed when the diaphragm is the bracing used
+const grps = () => P.mod === 'cf' && cfDiaOn(P.cf) ? ['Diaphragm (intermediate bracing used)', 'End diaphragms (bearing lines)', ...MODS.cf.groups] : (MODS[P.mod] || MODS.splice).groups;   // cross-frames: the diaphragm group (check CFD) is listed when the diaphragm is the bracing used
 function counts() { const c = { fail: 0, warn: 0, adv: 0, pass: 0, na: 0 }; CK.forEach(k => c[k.status]++); return c; }
 function renderStatus() { crMarkStale();
   const c = counts(), v = c.fail ? { cls: 'fail', ico: '✕', t: `${c.fail} check${c.fail > 1 ? 's' : ''} fail` } : { cls: 'pass', ico: '✓', t: 'All checks pass' };

## 2026-10-13 — PR: claude/girderdetail-end-panel-k (engineer's decision 2026-10-13; PR link added after merge)

Engineer's decision: an end panel whose stiffener spacing d<sub>o</sub> exceeds 1.5D is not a stiffened end panel, so its shear resistance uses k = 5 (unstiffened), V<sub>n</sub> = CV<sub>p</sub> (Eq. 6.10.9.2-1), no tension field. Interior panels are unchanged (wider than 3D already unstiffened). This closes the open item of Q3. Main page and the embedded PlateLine (`PL_B64`, decoded, edited, re-encoded on one line) are changed; the Cross-frames module (GM.cf) is not touched.

### Places that compute web shear resistance (all searched; listed whether changed or not)

| Place | Before | After |
|---|---|---|
| Main `webShear()` (≈ 2367): used by Transverse stiffeners TS4 (both adjacent panels), Girder section GS11 and GS16 (`r.sh`), Fatigue (`GM.fa`, ≈ 3627) | stiffened if 0 < d<sub>o</sub> ≤ 3D for every panel | stiffened if 0 < d<sub>o</sub> ≤ 3D, or ≤ 1.5D for an end panel (EK1) |
| Transverse stiffeners TS4 | end panel 1.5D < d<sub>o</sub> ≤ 3D: k = 5 + 5/(d<sub>o</sub>/D)², Eq. 6.10.9.3.3-1 | k = 5, Eq. 6.10.9.2-1 (via `webShear`) |
| Transverse stiffeners TS3 (I<sub>t</sub>, ρ<sub>w</sub>) | end panels already ρ = 0 (`tfa = q.stiff && !q.end`) | unchanged |
| Transverse stiffeners TS5 (spacing) | end panel 1.5D–3D: warning | advisory "(treated as unstiffened in TS4)", N/A with connection plates only (EK2) |
| Girder section GS11 (strength shear) and GS16 (deck placement, V<sub>cr</sub> = CV<sub>p</sub>) | rows with "End panel = Yes" and 1.5D < d<sub>o</sub> ≤ 3D used k from d<sub>o</sub> | k = 5 (via `webShear`). Rows from Preliminary sizing are never end panels (`end: 'no'`: max. positive, piers, transitions), so imported demands are not affected |
| Girder section fatigue shear (6.10.5.3, ≈ 3408) | filters `r.sh.stiff && r.end !== 'yes'` (interior panels only) | unchanged in result (end panels were already excluded) |
| Fatigue module (`GM.fa`, special fatigue shear) | `webShear(..., false)`: interior panels only | unchanged (no end-panel input; 6.10.5.3 applies to interior panels) |
| Field splice V<sub>r</sub> = φ<sub>v</sub>V<sub>n</sub> of the smaller web (≈ 1324, `stiffW`, `vnExpr`, `over3D`) | stiffened if d<sub>o</sub> ≤ 3D | unchanged, already correct: a field splice is inside a span and the module has no end-panel input |
| Bearing stiffeners | no web shear resistance computed | n/a |
| Auto-design (`AD.ts`) | sizes plates only; does not choose stiffener spacing | message text only (EK2) |
| PlateLine `webFromShear()` (Suggest quick/fast sizing; also used by Full design, Alternatives, girder-count study through `suggestLayout`) | one constant web sized for the largest V<sub>u</sub> with k = 5 + 5/min(d<sub>o</sub>/D, 3)², d<sub>o</sub>/D from the Framing ratio or the d<sub>o</sub>/D search [1, 1.5, 2, 3]; end panels at the same spacing | also sized for the largest V<sub>u</sub> within d<sub>o</sub> of each girder end with k = 5 when d<sub>o</sub>/D > 1.5; the thicker web governs (EK3) |
| PlateLine check D4 (d<sub>o</sub> ≤ 3D, "Intermediate panels") and D3 (I<sub>t</sub>) | spacing / inertia, not shear resistance | unchanged |
| PlateLine `checkLayout` (quick check, Full design verify) | no web shear check (`rWeb` is web bend-buckling) | unchanged |
| PlateLine `detailExport` (TS rows sent to GirderDetail) | first stiffener from each abutment: `end: 'yes'`, do1 = d<sub>o</sub>/D × D | unchanged; GirderDetail's TS4 now treats those end panels as unstiffened when d<sub>o</sub>/D > 1.5 |

### EK1. `webShear()`: an end panel wider than 1.5D is unstiffened (k = 5)   [§4: calculation change]

- **Where:** main page, `function webShear(D, tw, Fyw, doIn, flgA, end)` (≈ 2367). Anchor `function webShear(D, tw, Fyw, doIn, flgA, end) {`.
- **Before:** `const stiff = doIn > 0 && doIn <= 3 * D + 1e-9, k = stiff ? 5 + 5 / (doIn / D) ** 2 : 5, ...`
- **After:** `const stiff = doIn > 0 && doIn <= (end ? 1.5 : 3) * D + 1e-9, k = stiff ? 5 + 5 / (doIn / D) ** 2 : 5, ...` (comment added on the function line). The rest of the function is unchanged: `if (!stiff || end) Vn = C·Vp` with `eqn = end && stiff ? '6.10.9.3.3-1' : '6.10.9.2-1'`, so an end panel with d<sub>o</sub> > 1.5D now reports k = 5 and Eq. 6.10.9.2-1.
- **Before/after expression (end panel, 1.5D < d<sub>o</sub> ≤ 3D):** k = 5 + 5/(d<sub>o</sub>/D)², V<sub>n</sub> = CV<sub>p</sub> (Eq. 6.10.9.3.3-1) → k = 5, V<sub>n</sub> = CV<sub>p</sub> (Eq. 6.10.9.2-1). C from Eq. 6.10.9.3.2-4 to -6 in both. End panels with d<sub>o</sub> ≤ 1.5D, interior panels, and panels wider than 3D: identical.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 6.10.9.1 (web panels considered stiffened when the transverse stiffener spacing does not exceed 3D) and Art. 6.10.9.3.3 (end panels: V<sub>n</sub> = V<sub>cr</sub> = CV<sub>p</sub>, Eq. 6.10.9.3.3-1; transverse stiffener spacing of end panels not to exceed 1.5D); unstiffened webs Art. 6.10.9.2, Eq. 6.10.9.2-1 with k = 5. The tool already cites 6.10.9.1 and 6.10.9.3.3 in TS5. **Wording check for the engineer:** 6.10.9.3.3 states the 1.5D end-panel spacing as a limit ("shall not exceed"), not as a definition of an unstiffened panel; treating a wider end panel as unstiffened is the engineer's decision of 2026-10-13, not a quotation.
- **Problem:** an end panel with 1.5D < d<sub>o</sub> ≤ 3D got the stiffened k although 6.10.9.3.3 does not let that spacing count as a stiffened end panel. Unconservative: φ<sub>v</sub>V<sub>n</sub> drops by up to 20% (k 6.25 → 5 at d<sub>o</sub> = 2D, C ∝ k in the elastic range).
- **Check case (hand check; engineer's case):** D = 60 in, t<sub>w</sub> = 0.5625 in, F<sub>yw</sub> = 50 ksi, end panel d<sub>o</sub> = 120 in = 2D (> 1.5D = 90 in).
  - D/t<sub>w</sub> = 106.67; (D/t<sub>w</sub>)² = 11,377.8; V<sub>p</sub> = 0.58(50)(60)(0.5625) = 978.75 kip.
  - Before: k = 5 + 5/2² = 6.25; √(Ek/F<sub>yw</sub>) = √(29,000 × 6.25/50) = 60.21; 1.40 × 60.21 = 84.29 < 106.67, so C = 1.57/11,377.8 × (29,000 × 6.25/50) = 1.57 × 3,625/11,377.8 = 0.5002; V<sub>n</sub> = 0.5002 × 978.75 = 489.58 kip; φ<sub>v</sub>V<sub>n</sub> = 1.0 × 489.58 = **489.58 kip**.
  - After: k = 5; √(29,000 × 5/50) = 53.85; 1.40 × 53.85 = 75.39 < 106.67, so C = 1.57 × 2,900/11,377.8 = 0.4002; V<sub>n</sub> = 0.4002 × 978.75 = 391.66 kip; φ<sub>v</sub>V<sub>n</sub> = **391.66 kip** (−20.0%).
  - Tool (headless Chromium, `webShear(60, 0.5625, 50, 120, flgA, true)`): main k 6.25, C 0.50021, V<sub>n</sub> 489.58, Eq. 6.10.9.3.3-1; branch k 5, C 0.40017, V<sub>n</sub> 391.66, Eq. 6.10.9.2-1.
  - Transverse stiffeners default example with row 1 d<sub>o1</sub> = 120 in (V<sub>u</sub> = 241.00 kip): TS4 end panel C 0.500 → 0.400, φV<sub>n</sub> 489.58 → 391.66 kip, ratio 0.49 → 0.62 (pass both). TS5 warn → advisory. Status bar "All checks pass, 1 warning, ! Web shear" → "All checks pass, No warnings, ✓ Web shear"; module tab badge "1" → none.
  - Same end panel at d<sub>o</sub> = 150 in: φV<sub>n</sub> 454.33 → 391.66 kip (k 5.80 → 5); at 180 in = 3D: 435.18 → 391.66 kip (k 5.556 → 5). At 90 in (= 1.5D) and 200 in (> 3D): unchanged.
  - Girder section default example with every row set to End panel = Yes, d<sub>o</sub> = 120 in (D = 60, t<sub>w</sub> = 0.5625): GS11 row 1 φV<sub>n</sub> 489.58 → 391.66 kip, ratio 0.21 → 0.26; row 2 0.70 → 0.88; GS16 V<sub>cr</sub> 489.58 → 391.66 kip (ratios 0.06 → 0.08, 0.28 → 0.35). With d<sub>o</sub> = 90 in, or End panel = No at 120 in: unchanged.
- **Effect on layouts made before this change** (Preliminary sizing → Get demands, stiffened web, d<sub>o</sub>/D = 2, 120 ft simple span, default bridge otherwise): main's Full design layout D = 58 in, t<sub>w</sub> = 1/2 in now gives in TS4 (hand computed with the TS4 demand of the main run), first stiffener from Abut. 1, end panel d<sub>o</sub> = 116 in, V<sub>u</sub> = 302.00 kip: φV<sub>n</sub> = 355.70 → 284.56 kip (C 0.423 → 0.338), ratio 0.85 → **1.06 (fail)**; main's quick suggestion D = 61 in, t<sub>w</sub> = 1/2 in: V<sub>u</sub> = 299.68 kip, φV<sub>n</sub> 338.21 → 270.57 kip, ratio 0.89 → **1.11 (fail)**. Projects saved with such layouts will show these TS4 failures when reopened; re-run the Suggest / Full design (EK3 now sizes the web for it) or reduce the end-panel spacing to 1.5D.

### EK2. TS5, TS4/GS11 notes, auto-design message, manual: end panels wider than 1.5D are advisory   [text and status only]

- **TS5** (`GM.ts.checks()`, ≈ 2454; anchor `{ const c = { id: 'TS5', grp: G2, title: 'Stiffener spacing limits'`): the item logic is unchanged (`adv = !ok && !q.stiff`); since `q.stiff` now follows the 1.5D end-panel limit, an end panel wider than 1.5D is advisory "(treated as unstiffened in TS4)" like an interior panel wider than 3D, and with connection plates only the check becomes N/A (Q3's rule: no `'int'` role and no warning item). The `'warn'` branch is kept but no longer reachable (both limits use the same 1e-9 tolerance).
  - Note before: "… A panel wider than 3D is advisory: it is treated as unstiffened in TS4 (k = 5, V_n = CV_p), and TS4 decides pass or fail. An end panel wider than 1.5D but not wider than 3D stays a warning (TS4 checks it with V_n = CV_p and k from its d_o). With connection plates only …"
  - Note after: "… A panel wider than its limit (3D, or 1.5D for an end panel) is advisory: it is treated as unstiffened in TS4 (k = 5, V_n = CV_p), and TS4 decides pass or fail. With connection plates only …"
  - Comment above the N/A line updated.
- **TS4 note** (≈ 2450): "…; end panels and panels wider than 3D use V_n = CV_p. …" → "…; stiffened end panels (d_o ≤ 1.5D) use V_n = CV_p with k = 5 + 5/(d_o/D)² (Eq. 6.10.9.3.3-1). Interior panels wider than 3D and end panels wider than 1.5D are unstiffened (6.10.9.1): k = 5, V_n = CV_p (Eq. 6.10.9.2-1). …". The worked line already shows `k = 5` when `q.stiff` is false.
- **GS11 note** (≈ 3381): "Unstiffened webs (d_o = 0 or d_o > 3D) and end panels use V_n = CV_p; …" → "Unstiffened webs and panels (d_o = 0, d_o > 3D, or an end panel with d_o > 1.5D; 6.10.9.1) use k = 5 and V_n = CV_p; stiffened end panels use V_n = CV_p with k from d_o (Eq. 6.10.9.3.3-1); …".
- **`AD.ts`** (≈ 5152; anchor `const ts5 = r ? r.C.find(c => c.id === 'TS5')`): advisory line "panels wider than 3D are not stiffened panels …" → "panels wider than 3D (end panels: 1.5D) are not stiffened panels …"; the "TS5 warnings: end panels wider than 1.5D …; TS4 checks them with V_n = CV_p and k from d_o" line is removed (no longer true or reachable).
- **Manual**, Transverse stiffeners, "Web shear (6.10.9)" (≈ 2275): the end-panel sentence now says stiffened end panels use Eq. 6.10.9.3.3-1, and an interior panel wider than 3D or an end panel wider than 1.5D is checked as unstiffened (k = 5, Eq. 6.10.9.2-1); TS5 "a panel wider than its limit is advisory" (the "end panel … is a warning" clause removed).
- **Q3 variants re-run (TS module, default example):**
  | Variant | TS5 main | TS5 branch | TS4 end panel φV<sub>n</sub> main → branch |
  |---|---|---|---|
  | Type A end panel 120 in | warn | adv | 489.58 → 391.66 |
  | Connection plates only, 150 in, first row an end panel | warn | N/A | 454.33 → 391.66 |
  | Connection plates only, end panel 120 in, others 240 in | warn (warn, adv, adv, adv) | N/A | 489.58 → 391.66 |
  | Type A panel 2 at 200 in; Type A end panel 200 in; connection plates only 240 in | adv / adv / N/A | same | unchanged |

### EK3. PlateLine Suggest: web thickness also sized for the end panels with k = 5 when d<sub>o</sub>/D > 1.5   [§4: suggested web thickness / depth can change]

- **Where (decoded PlateLine, PL ≈):** `webFromShear(D, Vu, loc, wt, twMin, R)` (≈ 2067; anchor `/* ---- web thickness from shear (no tension field) ---- */`); `demand()` envelope loop (≈ 2029; anchor `let VuMax = 0, VuLoc = 0;`) stores the Strength I |V<sub>u</sub>| of every element in `VuE` (per girder type, `out.types[gt].VuE`; the existing V<sub>u</sub> expression unchanged); `sizeForDepth()` (≈ 1919) passes `R`; Suggest web card (≈ 2866) and manual Part 6 "Web" (≈ 2528).
- **Before:** t<sub>w</sub> = smallest on the increment with C(k)·0.58F<sub>yw</sub>Dt<sub>w</sub> ≥ V<sub>u,max</sub>, k = 5 + 5/min(d<sub>o</sub>/D, 3)² (stiffened) or 5.
- **After:** the same t<sub>w</sub> (unchanged code, now the inner `size(k, Vu, loc)`), and in addition, when the web is stiffened and d<sub>o</sub>/D > 1.5: t<sub>w,end</sub> from k = 5 and V<sub>u,end</sub> = the largest element V<sub>u</sub> within d<sub>o</sub> = (d<sub>o</sub>/D)·D of a girder end (both abutments for a continuous unit; every support for simple spans, each being a girder end), over the girder types. The web is the larger; if the end panel governs, the result carries `end: true`, and the Suggest web card names it ("end panel (d_o = 2.00D > 1.5D, unstiffened), maximum V_u in the end panels at … ft", k described as "an end panel wider than 1.5D is not a stiffened panel (6.10.9.1, 6.10.9.3.3), so k = 5"). With d<sub>o</sub>/D ≤ 1.5 or an unstiffened web: identical code path and result. Tension-field action is still not used.
- **Provision:** as EK1 (6.10.9.1, 6.10.9.3.3, 6.10.9.2; AASHTO LRFD 10th Ed.).
- **Hand check (120 ft simple span, default bridge, stiffened, d<sub>o</sub>/D = 2, web depth kept at 61 in):** V<sub>u,max</sub> = 334.14 kip (main) at 119.5 ft (an end panel). Before: k = 6.25, D/t<sub>w</sub> = 122, C = 1.57 × 3,625/14,884 = 0.3824, φV<sub>n</sub> = 0.3824 × 0.58(50)(61)(0.5) = 0.3824 × 884.5 = 338.21 ≥ 334.14 → t<sub>w</sub> = 1/2 in. After: k = 5 at t<sub>w</sub> = 1/2: C = 1.57 × 2,900/14,884 = 0.3059, φV<sub>n</sub> = 270.57 < 335.49 kip; t<sub>w</sub> = 9/16: D/t<sub>w</sub> = 108.44, C = 1.57 × 2,900/11,760 = 0.3872, φV<sub>n</sub> = 0.3872 × 995.06 = 385.24 ≥ 335.49 kip → **t<sub>w</sub> = 9/16 in** (tool: same values; V<sub>u</sub> 335.49 kip because the heavier web adds self-weight). Fast cost $555,024 → $587,113; bottom plates 19 × 1 / 19 × 1 5/8 / 19 × 1 → 20 × 7/8 / 20 × 1 5/8 / 20 × 1.

### Before/after of the suggestions and built-in examples

| Case | Main | Branch |
|---|---|---|
| GirderDetail default project, every module (gs, fa, splice, bstf, ts, sc, cf, oh, wt, df, sa): every check, status and item | — | identical; only the TS4, TS5 and GS11 note text differ |
| PlateLine built-in example (110-140-110 ft, d<sub>o</sub>/D search on): fast pick, candidate list (incl. d<sub>o</sub>/D = 2 and 3 candidates), quick suggestion, Full design (D 71, 1/2 in web, $1,597,506), Apply → TS and GS modules | — | identical (V<sub>u,max</sub> is at the piers, interior panels govern; the d<sub>o</sub>/D = 2 and 3 candidates keep 9/16 in) |
| Same, forced stiffened d<sub>o</sub>/D = 3 | D 63, 9/16 in; TS4 Abut. 1 end panel (189 in, V<sub>u</sub> 214.65): C 0.403, φV<sub>n</sub> 414.46, 0.52; TS5 warn | sizing identical; TS4 C 0.363, φV<sub>n</sub> 373.01, 0.58; TS5 adv, no warnings |
| 90 ft repro (10 girders at 4 ft, overhangs 2.25 ft, span-to-depth off; `ws-full/repro*.mjs` setup): quick and Full design | D 30 / 34 in, unstiffened, 1/2 in | identical (unstiffened web; with stiffened d<sub>o</sub>/D = 2 forced: identical sizing, C = 1, TS5 warn → adv) |
| 80-80-80 ft continuous, 5 girders at 9 ft | D 40, unstiffened | identical |
| 160 ft simple, 5 at 9 ft (search on) | D 78, d<sub>o</sub>/D = 1 | identical pick; only the ranking of lower candidates (d<sub>o</sub>/D 1.5–3) changes |
| 160 ft simple, forced d<sub>o</sub>/D = 3 | D 72, 5/8 in | identical (5/8 in also satisfies k = 5 at the ends: φV<sub>n</sub> 447.72 ≥ 396.56 kip); TS4 end panel 0.68 → 0.76; TS5 warn → adv |
| 120 ft simple, default bridge, forced stiffened d<sub>o</sub>/D = 2, quick suggestion | D 61, 1/2 in, $555,024; bottom 19 × 1 / 19 × 1 5/8 / 19 × 1; TS4 end panel 0.89 (k 6.25) | D 47, 1/2 in, $578,236; top 17 × 3/4 / 17 × 1 1/4 / 17 × 3/4, bottom 22 × 1 / 22 × 1 3/4 / 22 × 1 1/8; TS4 end panel 0.89 (k 5, φV<sub>n</sub> 351.16) |
| Same, Run full design | D 58, 1/2 in, $502,011, passes | D 53, 9/16 in, $533,684, passes; top 17 × 7/8; bottom 19 × 7/8 / 19 × 1 1/2 / 19 × 7/8 |

### Verification

- `node --check` on every inline script of the main page and of the decoded PlateLine; the base64 round trip of the unchanged page was byte-identical before editing.
- Headless Chromium (Playwright), main vs branch: every module's checks on the default project (above); TS and GS variants (above); PlateLine cases (fast, quick, Full design, Apply, then Get demands in the Transverse stiffeners and Girder section modules). No console errors, no alerts.
- Saved data: localStorage keys `girderdetail_autosave_v1`, `plateline_autosave_v1` only, unchanged. A project saved by main (TS end panel 120 in) loads in the branch with identical inputs (and shows the new TS4 result), and the reverse. No format change; the new `VuE` arrays are in memory only.
- Screenshots (session scratchpad `followups/endk/`): TS4 and TS5 cards and status bar (end panel 120 in; connection plates only), GS11 card, PlateLine web card with the end panel governing; main and branch.
- **Other copies / shared snippets:** none (no `bridgeSuite.v1.*` code or other shared snippet touched).
- **Open items (raised, not changed):** (1) PlateLine's `detailExport` flags only the panels next to the abutments as end panels (`end = ks === 0 || ks === nS - 1`); for simple spans the panels next to a pier are also girder ends. EK3's sizing treats them as end panels; GirderDetail's TS4 rows from Preliminary sizing do not. (2) TS4 checks each panel with V<sub>u</sub> at the stiffener; for an end panel the largest shear is at the bearing, which no GirderDetail check uses (GS rows are never at the abutments). (3) Q3's N/A text "web shear is checked as unstiffened in TS4" is applied with connection plates only even when an interior panel is ≤ 3D (TS4 then uses the stiffened k and tension field for it), e.g. connection plates at 150 in with D = 60; unchanged from Q3. (4) PlateLine sizes one constant web thickness for the whole girder, so an end panel governing thickens the whole web; a smaller end-panel spacing (≤ 1.5D) is not modelled by the single d<sub>o</sub>/D ratio. (5) PlateLine's minimum D/t<sub>w</sub> uses 300 for a stiffened web (`D / (st ? 300 : 150)`); not changed here.

### Exact changes (EK1, EK2): main page (unified diff, PL_B64 line omitted)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index 772181c..eabc23f 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -2274,3 +2274,3 @@ const MAN = [
 <p>d<sub>o</sub> is the smaller adjacent panel and b the smaller of d<sub>o</sub> and D. Where neither panel needs tension-field action, I<sub>t</sub> ≥ I<sub>t1</sub>. Otherwise I<sub>t</sub> ≥ I<sub>t1</sub> + (I<sub>t2</sub> − I<sub>t1</sub>)ρ<sub>w</sub> when I<sub>t2</sub> > I<sub>t1</sub>, else I<sub>t</sub> ≥ I<sub>t2</sub>, with ρ<sub>w</sub> the larger of (V<sub>u</sub> − φ<sub>v</sub>V<sub>cr</sub>)/(φ<sub>v</sub>V<sub>n</sub> − φ<sub>v</sub>V<sub>cr</sub>) in the two panels (confirm the equation numbering against your edition). I<sub>t</sub> is taken about the web face for a single plate and about the web mid-thickness for a pair.</p>
-<h3>Web shear (6.10.9)</h3><p>Each adjacent panel is checked for V<sub>u</sub> ≤ φ<sub>v</sub>V<sub>n</sub> with k = 5 + 5/(d<sub>o</sub>/D)². Interior panels include tension-field action (Eq. 6.10.9.3.2-2 or -8 depending on 2Dt<sub>w</sub>/(b<sub>fc</sub>t<sub>fc</sub> + b<sub>ft</sub>t<sub>ft</sub>)); end panels and panels wider than 3D use V<sub>n</sub> = CV<sub>p</sub>. Check TS5 compares each panel with the limits of 6.10.9.1 (1.5D for end panels, 3D for interior panels), which decide only whether the panel counts as stiffened: a panel wider than 3D is advisory, because TS4 checks it as unstiffened (k = 5) and decides pass or fail; an end panel wider than 1.5D but not wider than 3D is a warning. When the web has no intermediate stiffeners (connection plates only), it is designed as unstiffened and TS5 is not applicable.</p>
+<h3>Web shear (6.10.9)</h3><p>Each adjacent panel is checked for V<sub>u</sub> ≤ φ<sub>v</sub>V<sub>n</sub> with k = 5 + 5/(d<sub>o</sub>/D)². Interior panels include tension-field action (Eq. 6.10.9.3.2-2 or -8 depending on 2Dt<sub>w</sub>/(b<sub>fc</sub>t<sub>fc</sub> + b<sub>ft</sub>t<sub>ft</sub>)); end panels use V<sub>n</sub> = CV<sub>p</sub> (Eq. 6.10.9.3.3-1). An interior panel wider than 3D or an end panel wider than 1.5D is not a stiffened panel (6.10.9.1): it is checked as unstiffened, k = 5 and V<sub>n</sub> = CV<sub>p</sub> (Eq. 6.10.9.2-1). Check TS5 compares each panel with these limits, which decide only whether the panel counts as stiffened: a panel wider than its limit is advisory, because TS4 checks it as unstiffened (k = 5) and decides pass or fail. When the web has no intermediate stiffeners (connection plates only), it is designed as unstiffened and TS5 is not applicable.</p>
 <h3>Welds and fatigue</h3><p>Intermediate stiffener web welds stop 4t<sub>w</sub> to 6t<sub>w</sub> from the web-to-flange weld at the tension flange (6.10.11.1.1). Connection plates are welded to both flanges and those welds are designed for 20 kip laterally on straight, nonskewed bridges, or the analysis force otherwise (6.6.1.3.1). Base metal at stiffener weld toes is Category C′, (ΔF)<sub>TH</sub> = 12 ksi. Minimum fillet sizes follow Table 6.13.3.4-1.</p>
@@ -2366,4 +2366,4 @@ function numRows(rows, spec, lbl, errors) { return rows.map((r0, i) => { const r
     if (!isFinite(v) || v < min) errors.push(`${r.name}: "${spec.find(s => s[0] === k)[1].replace(/<[^>]+>/g, '')}" must be ${o && o.any ? 'a number' : min === 0 ? 'zero or positive' : 'positive'}.`); }); return r; }); }
-function webShear(D, tw, Fyw, doIn, flgA, end) {
-  const stiff = doIn > 0 && doIn <= 3 * D + 1e-9, k = stiff ? 5 + 5 / (doIn / D) ** 2 : 5, lam = D / tw, r = Math.sqrt(ES * k / Fyw);
+function webShear(D, tw, Fyw, doIn, flgA, end) {   // stiffened panel (6.10.9.1, 6.10.9.3.3): d_o <= 3D, or d_o <= 1.5D for an end panel; otherwise unstiffened (k = 5)
+  const stiff = doIn > 0 && doIn <= (end ? 1.5 : 3) * D + 1e-9, k = stiff ? 5 + 5 / (doIn / D) ** 2 : 5, lam = D / tw, r = Math.sqrt(ES * k / Fyw);
   const C = lam <= 1.12 * r ? 1 : lam <= 1.40 * r ? 1.12 * r / lam : 1.57 / lam ** 2 * (ES * k / Fyw), Vp = 0.58 * Fyw * D * tw;
@@ -2449,3 +2449,3 @@ tabs: { combos: 'Demands', rptCombos: 'Design demands' },
     { const c = { id: 'TS4', grp: G2, title: 'Web shear resistance of adjacent panels', ref: 'AASHTO LRFD 6.10.9.3.2, 6.10.9.3.3', src: 'Code', sym: T`V_u \le \phi_vV_n, \quad \phi_v = 1.0`,
-        cols: ['Location, panel', 'd_o (in)', 'V_u (kip)', 'C', 'φV_n (kip)', 'Ratio'], items: [], note: 'Interior stiffened panels include tension-field action (Eq. 6.10.9.3.2-2 or -8); end panels and panels wider than 3D use V_n = CV_p. V_u is the Strength I shear at the stiffener, applied to both adjacent panels.' };
+        cols: ['Location, panel', 'd_o (in)', 'V_u (kip)', 'C', 'φV_n (kip)', 'Ratio'], items: [], note: 'Interior stiffened panels include tension-field action (Eq. 6.10.9.3.2-2 or -8); stiffened end panels (d_o ≤ 1.5D) use V_n = CV_p with k = 5 + 5/(d_o/D)² (Eq. 6.10.9.3.3-1). Interior panels wider than 3D and end panels wider than 1.5D are unstiffened (6.10.9.1): k = 5, V_n = CV_p (Eq. 6.10.9.2-1). V_u is the Strength I shear at the stiffener, applied to both adjacent panels.' };
       R.rows.forEach(r => [r.p1, r.p2].forEach((q, i) => c.items.push(rc(`${L(r)}, panel ${i + 1}${q.end ? ' (end)' : ''}`, [f2(q.do), f2(r.Vu), f3(q.C), f2(q.phVn), f2(r.Vu / q.phVn)], r.Vu, q.phVn,
@@ -2453,5 +2453,5 @@ tabs: { combos: 'Demands', rptCombos: 'Design demands' },
       out.add(c); }
-    { const c = { id: 'TS5', grp: G2, title: 'Stiffener spacing limits', ref: 'AASHTO LRFD 6.10.9.1, 6.10.9.3.3', src: 'Code', sym: T`d_o \le 3D\ \text{(interior panels)}, \qquad d_o \le 1.5D\ \text{(end panels)}`, cols: ['Location, panel', 'd_o (in)', 'Limit (in)', 'Ratio'], items: [], note: 'The 6.10.9.1 limits decide only whether a panel counts as stiffened for shear. A panel wider than 3D is advisory: it is treated as unstiffened in TS4 (k = 5, V_n = CV_p), and TS4 decides pass or fail. An end panel wider than 1.5D but not wider than 3D stays a warning (TS4 checks it with V_n = CV_p and k from its d_o). With connection plates only (no intermediate stiffener) the check is not applicable.' };
+    { const c = { id: 'TS5', grp: G2, title: 'Stiffener spacing limits', ref: 'AASHTO LRFD 6.10.9.1, 6.10.9.3.3', src: 'Code', sym: T`d_o \le 3D\ \text{(interior panels)}, \qquad d_o \le 1.5D\ \text{(end panels)}`, cols: ['Location, panel', 'd_o (in)', 'Limit (in)', 'Ratio'], items: [], note: 'The 6.10.9.1 limits decide only whether a panel counts as stiffened for shear. A panel wider than its limit (3D, or 1.5D for an end panel) is advisory: it is treated as unstiffened in TS4 (k = 5, V_n = CV_p), and TS4 decides pass or fail. With connection plates only (no intermediate stiffener) the check is not applicable.' };
       R.rows.forEach(r => [r.p1, r.p2].forEach((q, i) => { const lim = (q.end ? 1.5 : 3) * r.D, ok = ge(lim, q.do), adv = !ok && !q.stiff; c.items.push({ loc: `${L(r)}, panel ${i + 1}${q.end ? ' (end)' : ''}`, cells: [f2(q.do), f2(lim), f2(q.do / lim)], r: q.do / lim, st: ok ? 'pass' : adv ? 'adv' : 'warn', work: T`d_o = ${f2(q.do)} \;${LE(q.do, lim)}\; ${q.end ? '1.5' : '3'}(${f2(r.D)}) = ${f2(lim)}\ \text{in}${adv ? T`\ \text{(treated as unstiffened in TS4)}` : ''}` }); }));
-      // web designed unstiffened (connection plates only): connection-plate spacing is not limited by 6.10.9.1 (an end panel that TS4 still checks with k from d_o keeps its warning)
+      // web designed unstiffened (connection plates only): connection-plate spacing is not limited by 6.10.9.1 (TS4 checks every panel wider than its limit as unstiffened)
       if (!R.rows.some(r => r.t.role === 'int') && !c.items.some(i => i.st === 'warn')) { c.items = []; c.naWhy = 'Web designed as unstiffened (connection plates only): connection-plate spacing is not limited by 6.10.9.1; web shear is checked as unstiffened in TS4.'; }
@@ -3380,3 +3380,3 @@ tabs: { combos: 'Loads and stresses', cap: 'Resistances', geometry: 'Proportions
       if (!c.items.length) c.naWhy = 'No flange lateral bending entered.'; out.add(c); }
-    { const c = { id: 'GS11', grp: SH, title: 'Shear resistance', ref: 'AASHTO LRFD 6.10.9', src: 'Code', sym: T`V_u \le \phi_vV_n, \quad \phi_v = 1.0`, cols: ['Location', 'V_u (kip)', 'C', 'φV_n (kip)', 'Ratio'], items: [], note: 'Unstiffened webs (d_o = 0 or d_o > 3D) and end panels use V_n = CV_p; interior stiffened panels include tension-field action.' };
+    { const c = { id: 'GS11', grp: SH, title: 'Shear resistance', ref: 'AASHTO LRFD 6.10.9', src: 'Code', sym: T`V_u \le \phi_vV_n, \quad \phi_v = 1.0`, cols: ['Location', 'V_u (kip)', 'C', 'φV_n (kip)', 'Ratio'], items: [], note: 'Unstiffened webs and panels (d_o = 0, d_o > 3D, or an end panel with d_o > 1.5D; 6.10.9.1) use k = 5 and V_n = CV_p; stiffened end panels use V_n = CV_p with k from d_o (Eq. 6.10.9.3.3-1); interior stiffened panels include tension-field action.' };
       R.rows.forEach(r => { const q = r.sh; c.items.push(rc(L(r), [f2(r.Vu), f3(q.C), f2(q.Vn), f2(r.Vu / q.Vn)], r.Vu, q.Vn,
@@ -5152,4 +5152,3 @@ AD.ts = () => { const S = std(), T = P.ts, out = [], D = k => parseDim(k);
   const ts5 = r ? r.C.find(c => c.id === 'TS5') : null, ts5x = st => ts5 ? ts5.items.some(i => i.st === st) : false;
-  if (ts5x('adv')) out.push('TS5 advisories: panels wider than 3D are not stiffened panels (6.10.9.1) and are treated as unstiffened in TS4, which decides the web shear');
-  if (ts5x('warn')) out.push('TS5 warnings: end panels wider than 1.5D (6.10.9.1); TS4 checks them with V_n = CV_p and k from d_o');
+  if (ts5x('adv')) out.push('TS5 advisories: panels wider than 3D (end panels: 1.5D) are not stiffened panels (6.10.9.1) and are treated as unstiffened in TS4, which decides the web shear');
   if (panel.length) out.push(`Panel shear or spacing fails at ${[...new Set(panel)].join('; ')}: these depend on the stiffener spacing (Framing tab in Preliminary sizing), not the plate size`);
```

### Exact changes (EK3): decoded PlateLine (unified diff)

```diff
--- a/PlateLine (decoded PL_B64)
+++ b/PlateLine (decoded PL_B64)
@@ -1918,3 +1918,3 @@
       // web thickness from shear
-      const W = webFromShear(D, R.VuMax, R.VuLoc, wt, twMin);
+      const W = webFromShear(D, R.VuMax, R.VuLoc, wt, twMin, R);
       tw = W.tw; web = [{ L: Ltot, t: tw }];
@@ -2028,5 +2028,5 @@
       }
-      let VuMax = 0, VuLoc = 0;
+      let VuMax = 0, VuLoc = 0; const VuE = new Float64Array(N - 1);   // VuE: Strength I |V_u| per element (end-panel shear, webFromShear)
       for (let e = 0; e < N - 1; e++) { const vf = s => (s * VDC[e] >= 0 ? 1.25 : 0.90) * VDC[e] + (s * VDW[e] >= 0 ? 1.5 : 0.65) * VDW[e];   // 3.4.1: minimum factors where a permanent load relieves the extreme
-        const v = Math.max(Math.abs(vf(1) + 1.75 * Vp[e]), Math.abs(vf(-1) + 1.75 * Vn[e])); if (v > VuMax) { VuMax = v; VuLoc = (xs[e] + xs[e + 1]) / 2; } }
+        const v = Math.max(Math.abs(vf(1) + 1.75 * Vp[e]), Math.abs(vf(-1) + 1.75 * Vn[e])); VuE[e] = v; if (v > VuMax) { VuMax = v; VuLoc = (xs[e] + xs[e + 1]) / 2; } }
       // required flange areas (in^2)
@@ -2049,3 +2049,3 @@
       out.types[gt] = { gt, ext, feOn: FEon, IMk, IMf, bS, b3, bN, stg, VDC1, VDC2, VDW, VCL, Vp, Vn, MfP, MfN, Vfr, Vfm, w1, wSteel, wHaunch, wDeck, wSip, wHaunch0: wHaunch[0], wSteelMax: Math.max(...wSteel), wSteelMin: Math.min(...wSteel), wDC2, wDW, wCL, trW,
-        MDC1, MDC2, MDW, MCL, Mp, Mn, Mup, Mun, Msp, Msn, Mc, mgM, dfSpan, dfPier, skV, VuMax, VuLoc, Abot, Atop, gB, gT, cf, Mperm };
+        MDC1, MDC2, MDW, MCL, Mp, Mn, Mup, Mun, Msp, Msn, Mc, mgM, dfSpan, dfPier, skV, VuMax, VuLoc, VuE, Abot, Atop, gB, gT, cf, Mperm };
     }
@@ -2066,13 +2066,23 @@
   /* ---- web thickness from shear (no tension field) ---- */
-  function webFromShear(D, Vu, loc, wt, twMin) {
-    const st = (wt || SG.web) === 'stiffened', k = st ? 5 + 5 / Math.min(DO_R, 3) ** 2 : 5, E = ES;
-    let tw = up(Math.max(L.minTw, D / (st ? 300 : 150), 0.3125, twMin || 0), L.incTw), C, Vn, lam;
-    for (let g = 0; g < 80; g++) {
-      lam = D / tw; const r = Math.sqrt(E * k / FyW);
-      C = lam <= 1.12 * r ? 1 : lam <= 1.40 * r ? 1.12 * r / lam : 1.57 / lam ** 2 * (E * k / FyW);
-      Vn = C * 0.58 * FyW * D * tw;
-      if (Vn >= Vu - 1e-9) break;
-      tw += L.incTw;
+  function webFromShear(D, Vu, loc, wt, twMin, R) {
+    const st = (wt || SG.web) === 'stiffened', E = ES;
+    const size = (k, Vu, loc) => {
+      let tw = up(Math.max(L.minTw, D / (st ? 300 : 150), 0.3125, twMin || 0), L.incTw), C, Vn, lam;
+      for (let g = 0; g < 80; g++) {
+        lam = D / tw; const r = Math.sqrt(E * k / FyW);
+        C = lam <= 1.12 * r ? 1 : lam <= 1.40 * r ? 1.12 * r / lam : 1.57 / lam ** 2 * (E * k / FyW);
+        Vn = C * 0.58 * FyW * D * tw;
+        if (Vn >= Vu - 1e-9) break;
+        tw += L.incTw;
+      }
+      return { tw, k, C, Vn, Vu, lam, loc, Vp: 0.58 * FyW * D * tw };
+    };
+    const W = size(st ? 5 + 5 / Math.min(DO_R, 3) ** 2 : 5, Vu, loc);
+    // end panels (6.10.9.1, 6.10.9.3.3): with d_o > 1.5D the end panel is not a stiffened panel, so the shear in it is resisted with k = 5 (unstiffened)
+    if (st && DO_R > 1.5 + 1e-9 && R && R.types) {
+      const dE = DO_R * D / 12, ends = cont ? [0, Ltot] : supX; let VuEnd = 0, xEnd = 0, gEnd = '';
+      Object.values(R.types).forEach(Tg => { if (Tg.VuE) for (let e = 0; e < N - 1; e++) if (ends.some(xe => xs[e] < xe + dE - 1e-9 && xs[e + 1] > xe - dE + 1e-9) && Tg.VuE[e] > VuEnd) { VuEnd = Tg.VuE[e]; xEnd = (xs[e] + xs[e + 1]) / 2; gEnd = Tg.gt; } });
+      if (VuEnd > 0) { const We = size(5, VuEnd, xEnd); if (We.tw > W.tw + 1e-9) return { ...We, end: true, doR: DO_R, gt: gEnd }; }
     }
-    return { tw, k, C, Vn, Vu, lam, loc, Vp: 0.58 * FyW * D * tw };
+    return W;
   }
@@ -2517,3 +2527,3 @@
 <h3>Web</h3>
-<p>Web depth D = ⌈L<sub>max</sub>(12)/r − 2.5⌉ on the depth increment, increased until G1 and G2 pass. Web thickness is the smallest on the thickness increment satisfying the minimum thickness, D/t<sub>w</sub> ≤ 150, and φ<sub>v</sub>V<sub>n</sub> = C(0.58F<sub>yw</sub>Dt<sub>w</sub>) ≥ V<sub>u</sub> (6.10.9.2, 6.10.9.3.2), with C from Eq. 6.10.9.3.2-4 to -6. Tension-field action is not used, which is conservative.</p>
+<p>Web depth D = ⌈L<sub>max</sub>(12)/r − 2.5⌉ on the depth increment, increased until G1 and G2 pass. Web thickness is the smallest on the thickness increment satisfying the minimum thickness, D/t<sub>w</sub> ≤ 150, and φ<sub>v</sub>V<sub>n</sub> = C(0.58F<sub>yw</sub>Dt<sub>w</sub>) ≥ V<sub>u</sub> (6.10.9.2, 6.10.9.3.2), with C from Eq. 6.10.9.3.2-4 to -6. Tension-field action is not used, which is conservative. With transverse stiffeners at d<sub>o</sub> > 1.5D, the end panels (d<sub>o</sub> from each girder end) are not stiffened panels (6.10.9.1, 6.10.9.3.3): the largest V<sub>u</sub> in them is also checked with k = 5 (unstiffened), and the thicker web governs.</p>
 <h3>Required flange areas</h3>
@@ -2855,5 +2865,5 @@
     <div class="eq-where"><table><tr><td class="wsym">r</td><td class="wdesc">Target L/D<sub>st</sub> (${R.D.cont ? 'continuous' : 'simple'}); 2.5 in allows for flange thicknesses</td><td class="wval">${f2(R.D.ratio)}</td></tr></table></div></div>
-    <div class="eq-block"><div class="eq-title"><span>Web thickness from shear, maximum V<sub>u</sub> at ${f2(W.loc)} ft (${TT(R.VuType)} girder)</span><span class="eq-ref">AASHTO 6.10.9.2, 6.10.9.3.2 (no tension-field action)</span></div>
+    <div class="eq-block"><div class="eq-title"><span>Web thickness from shear, ${W.end ? `end panel (d<sub>o</sub> = ${f2(W.doR)}D > 1.5D, unstiffened), maximum V<sub>u</sub> in the end panels` : 'maximum V<sub>u</sub>'} at ${f2(W.loc)} ft (${TT(W.gt || R.VuType)} girder)</span><span class="eq-ref">AASHTO 6.10.9.2, 6.10.9.3.2 (no tension-field action)</span></div>
     <div class="eq-math">\\[\\begin{aligned}\\frac{D}{t_w} &= \\frac{${f2(s.D)}}{${f3(W.tw)}} = ${f2(W.lam)}, \\qquad \\sqrt{\\frac{Ek}{F_{yw}}} = \\sqrt{\\frac{29{,}000(${W.k})}{${f2(Fyw)}}} = ${f2(Math.sqrt(ES * W.k / Fyw))} \\\\ C &= ${W.C >= 1 - 1e-9 ? '1.00' : W.lam <= 1.40 * Math.sqrt(ES * W.k / Fyw) ? `\\frac{1.12}{D/t_w}\\sqrt{\\frac{Ek}{F_{yw}}}` : `\\frac{1.57}{(D/t_w)^2}\\frac{Ek}{F_{yw}}`} = ${f3(W.C)} \\\\ \\phi_v V_n &= 1.0\\,C\\,(0.58F_{yw}Dt_w) = ${f3(W.C)}(0.58)(${f2(Fyw)})(${f2(s.D)})(${f3(W.tw)}) = ${f2(W.Vn)}\\ \\text{kip} \\;${W.Vn >= W.Vu ? '\\ge' : '<'}\\; V_u = ${f2(W.Vu)}\\ \\text{kip}\\end{aligned}\\]</div>
-    <div class="eq-where"><table><tr><td class="wsym">k</td><td class="wdesc">${P.suggest.web === 'stiffened' ? 'Shear buckling coefficient, transverse stiffeners at d<sub>o</sub> = D: 5 + 5/(d<sub>o</sub>/D)²' : 'Shear buckling coefficient, unstiffened web'}</td><td class="wval">${W.k}</td></tr>
+    <div class="eq-where"><table><tr><td class="wsym">k</td><td class="wdesc">${W.end ? 'Shear buckling coefficient: an end panel wider than 1.5D is not a stiffened panel (6.10.9.1, 6.10.9.3.3), so k = 5 (unstiffened); it governs the constant web thickness' : P.suggest.web === 'stiffened' ? 'Shear buckling coefficient, transverse stiffeners at d<sub>o</sub> = D: 5 + 5/(d<sub>o</sub>/D)²' : 'Shear buckling coefficient, unstiffened web'}</td><td class="wval">${W.k}</td></tr>
     <tr><td class="wsym">t<sub>w</sub></td><td class="wdesc">Smallest thickness on the ${frac(P.limits.incTw)} in increment that satisfies shear, D/t<sub>w</sub> ≤ 150, and the minimum ${frac(P.limits.minTw)} in</td><td class="wval">${frac(W.tw)}<span class="wunit">in</span></td></tr></table></div></div>`);
```

## 2026-10-13 — PR: claude/plateline-suggest-compare (engineer's request 2026-10-13; PR link added after merge)

Engineer's request: "in the quick suggest tab, it should show the existing configuration compared with the suggested configuration so we know what is suggested to change". SC1 is inside the embedded PlateLine (Preliminary sizing) page, the base64 string `const PL_B64 = '...'` of `Steel Bridge Beam Modules.html` (decode, edit, re-encode on one line). The exact changes are the unified diffs at the end of this entry; line numbers (PL ≈) refer to the decoded page.

### SC1. Suggest tab: current girder compared with the quick suggestion or full design   [display only] [no formula, factor, check, or suggestion changed]

- **Where (decoded PlateLine):**
  - New globals and functions after `sgGovTxt()` (PL ≈ 2768–2895). Anchor `let SGC = null, SGC_RUN = 0, SGC_SHOWN = '';`: `sgcKey()`, `sgcIn()`, `sgCurStart()`, `sgFs()`, `sgCmpRows()`, `sgCmpHtml()`, `sgCmpPlot()`.
  - `renderSuggest()`: calls `sgCurStart(); SGC_SHOWN = sgcKey();` after `const cur = ...`; the `wtCur` / `curCost` lines (cost of the current girder, `suggestLayout(P, { costOnly })`, unchanged) moved up from the cost card to the top so the comparison can use them; card `sg-sum` gains one line (what changes, or "No change suggested") and, when the current girder is valid, no longer shows the small Suggested/Current table and the three suggested plate lists (they are replaced by the comparison card; both are still shown when the current girder has input errors); new card `sg-cmp` right after `sg-sum`; `sgCmpPlot(mS, cur)` after `drawSuggestCharts(mS)`.
  - `maybeSuggest()`: anchor `if (k === SG_KEY && SG && !force && !(SG.quick && SG.quick.qk !== sgQKey()))`. With unchanged Suggest inputs it used to return; now it re-renders the tab (no new suggestion) when the current girder changed since the last render (`SGC_SHOWN !== sgcKey()`), so the comparison follows Girder tab edits.
  - CSS after `.sg-head.chk`: `.tbl tr.chg`, `.tbl td.chg-t`, `.cmp-tbls`, `.plt.short`.
  - Manual Part 2, new paragraph "Current girder compared with the suggestion" after the "Quick suggestion and full design" paragraph.
- **What the card shows** (title "Current girder compared with the quick suggestion" / "... with the full design"):
  - Result line: "Current girder: largest ratio r (check, flange or web at x ft (Span k), interior/exterior girder)" and the same for the suggestion; heading "A change is needed: the current girder exceeds 1.0 (largest ratio r)" (or is shallower than the Table 2.5.2.6.3-1 minimum depth where Suggest applies it, or fails code proportion checks), "Not needed for strength or service: the current girder passes (largest ratio r)", or "No change suggested"; and the steel and cost difference ("would only save steel and cost", or "would not save cost: keep the current girder ...").
  - Overall rows, current | suggested | change, changed rows highlighted: web depth D, web thickness t<sub>w</sub>, transverse stiffeners and d<sub>o</sub>/D, cross-frame spacing (the full design's spacing; the quick suggestion does not set it), field splices (added / removed / moved), shop transitions, steel per girder and per deck area, cost of all girders (Unit costs), largest strength and service ratio, code proportion check counts (the PlateLine proportion checks of the current girder from the existing `C`, the same check ids as the suggestion's `runChecks(mS)`).
  - Top flange, web, bottom flange plate by plate (`sgCmpRows`): the two plate lists are merged by station (the union of both lists' segment ends; adjacent ranges with the same current and suggested plates merged), each row "From | To | Current b × t | Suggested b × t | Change"; change text "b 16 → 18", "t 1 1/8 → 1 1/4", "D 60 → 63", "new transition at 97 ft" (the suggestion changes plate where the current girder does not), "new plate change at the field splice at 81 ft", "plate change at 100 ft removed".
  - Plot (Plotly, same style as the existing Suggest charts): flange thickness (upper) and width (lower) along the girder, top (blue) and bottom (green), current dashed, suggested solid; supports, suggested splices (blue dashed), current splices (grey dotted).
  - If the current girder has input errors: "The current girder has input errors, so it cannot be compared or checked. Fix them on the Girder tab." with the error list.
  - Decision on the old per-flange suggested plate lists: **replaced** by the comparison tables (which carry the same suggested plates and stations), kept only as the fallback when the current girder has input errors.
- **Current-girder check:** `suggestLayout(PP, { full: true, verify: { D, wt, doR, top, bot, web, splices } })` on a copy of the project, the same call the quick suggestion's check makes (`suggestQuickCheck`), with the current plates (`M.top/bot/web`, `M.D`, `M.splices`), the Framing tab stiffener setting (`wt`), `doRatio`, and therefore its cross-frame spacing. Pass = `check.max ≤ 1.0005 && check.rWeb ≤ 1.0005 && dOK` (the quick check's criterion). Where GirderDetail's LLDF and DLs module factors match the current girder (`sgDfx`), that check uses them, as `demand()` already does; the card says so.
- **Async behaviour:** `sgCurStart()` runs from `renderSuggest()` when `sgcKey()` (= `sgQKey()` + `P.girder` + `P.dfx`) changes; run token `SGC_RUN`; the verify runs after two timer ticks and a result is dropped if a newer run started or the key changed; when it finishes it re-renders the tab. While it runs the card shows "Checking the current girder for strength and service…".
- **§4 callout:** none needed — no formula, load factor, resistance factor, unit or code reference changes; the quick suggestion, Full design, girder-count study and Alternatives results are unchanged (bit-identical, below). The only new computation is the existing verify applied to the current girder, for display.
- **Check case (90 ft simple span, 10 girders at 4.0 ft, overhangs 2.25 ft, span-to-depth off; current girder D 36 × 1/2, top 14 × 3/4, bottom 16 × 1 / 16 × 1 1/2 / 16 × 1 at 30/30/30 ft, stiffened d<sub>o</sub> = D):** card: "Not needed for strength or service: the current girder passes (largest ratio 0.759)"; current 0.759 (Fatigue I C′ at connection plates, bottom flange 30 ft, exterior), quick suggestion 0.852 (same check, 39 ft); rows: D 36 → 30 (−6 in), stiffeners removed, transitions 2 → 0, steel 15.17 → 13.99 kip per girder (−7.77%), cost $636,511 → $532,139; top 0–90 ft "b 14 → 13"; bottom 0–30 "b 16 → 15; t 1 → 1 1/4", 30–60 "b 16 → 15; t 1 1/2 → 1 1/4; plate change at 30 ft removed", 60–90 "...; plate change at 60 ft removed". Hand check of a merged row: current bottom 16 × 1 1/2 over 30–60 ft, suggested 15 × 1 1/4 over 0–90 ft → row 30–60 ft, b 16 → 15, t 1 1/2 → 1 1/4; the current plate changes at 30 ft and the suggestion does not, so "plate change at 30 ft removed". Steel: 15.17 − 13.99 = 1.18 kip less (1.18/15.17 = 7.77%).
- **Built-in example:** "A change is needed: the current girder exceeds 1.0 (largest ratio 1.059)" (PlateLine's Fatigue I C′ check at connection plates, bottom flange 301 ft, exterior — see open item (3) of SQ1–SQ4), quick suggestion 0.987; D 60 → 63, t<sub>w</sub> 9/16 → 1/2, splices moved 82 → 81, 145 → 139, 215 → 221, 278 → 279 ft, steel −2.97 kip per girder (−3.25%), cost −$46,840; 17 top and 17 bottom flange ranges.
- **Equal case:** apply the quick suggestion (or the full design) on the 90 ft case, reopen the Suggest tab: "No change suggested"; every row unhighlighted; "The quick suggestion is the same as the current girder."

### Verification (SC1)

- `node --check` on the decoded PlateLine scripts; no console errors in any run.
- Main vs branch, headless Chromium, built-in example and the 90 ft case: fast `suggestLayout(P)` result, deck-width study rows (W = 44.5 ft) and table HTML, and Run full design (D, plates, splices, cost, every candidate and check array, results table HTML) identical; the project `P` identical except the `dfx.ts` timestamp; the checked quick suggestion (plates, check, cost) and its cost card HTML identical (the cards after the new one are numbered one higher).
- UI: the cases above; an edit during the current-girder check (three edits within ~20 ms): the first run stopped, 2 verifies of the current girder for 3 edits, the final card for the last girder; an edit made on another output tab refreshes the comparison when the Suggest tab is reopened; current girder with an input error; Full design (90 ft case) and its "No change suggested" after Apply; window widths 1600 and 1000 px.
- Saved data: localStorage keys unchanged (`plateline_autosave_v1`, `plateline_undo_v1`, `girderdetail_*`); an autosave written by the branch loads in main with an identical project and vice versa. The current-girder check result is not saved.
- An alert "Preliminary sizing has input errors; fix them first." seen once while a test left the Girder tab with an input error during GirderDetail's "Bridge changed: updating every module" refresh is existing behaviour (reproduced on main).
- **Open items:** (1) For the built-in example the comparison says a change is needed because PlateLine's Category C′ fatigue check of the current girder gives 1.059 (open item (3) of SQ1–SQ4: GirderDetail's Girder section module did not fail it). (2) The current girder is checked at its Framing tab cross-frame spacing and the full design at its own; the card says so.
- **Other copies:** none.

### Exact changes (SC1): decoded PlateLine (unified diff)

```diff
--- PL (main 8425bcc)
+++ PL (after SC1)
@@ -742,6 +742,8 @@
 .sg-head span { font-size: 12.5px; color: var(--text-dim); }
 .sg-head span.sg-ln { display: block; margin-top: 3px; } .sg-head > div:first-child { flex: 1 1 320px; }
 .sg-head.chk { background: color-mix(in oklab, var(--ink, #1d56a3) 8%, transparent); } .sg-head.chk b { color: var(--ink, #1d56a3); } .sg-head .sg-prog-bar { margin: 8px 0 4px; max-width: 520px; }
+.tbl tr.chg td { background: color-mix(in oklab, var(--blue) 10%, transparent); } .tbl td.chg-t { font-weight: 600; color: var(--blue); }   /* current girder vs suggestion: changed rows (2026-10-13) */
+.cmp-tbls { display: grid; grid-template-columns: minmax(0,1fr); gap: 14px; margin-top: 12px; } .plt.short { height: 250px; }
 .sg-h4 { font-size: 13px; font-weight: 650; margin: 4px 0 4px; }
 .sgtbl td { vertical-align: top; font-size: 12.5px; }
 #tab-suggest.busy { opacity: .55; transition: opacity .2s; }
@@ -2413,6 +2415,7 @@
 <h3>Suggest: lowest-cost layout</h3><p>Suggest proposes the web and flange layout and the field splices for the bridge on the Bridge tab, with one layout for all girders (designed for the envelope of the interior and exterior girders). It searches web depths from about L/36 to L/18 and, unless one is chosen, both an unstiffened and a transversely stiffened web, and keeps the layout with the <b>lowest total cost</b>: structural steel (weight × $/lb), flange shop transitions, transverse stiffeners, and field splices, each priced from the <b>Unit costs</b> on the Suggest tab, which are the same single price list used by the Alternatives study (and sent to GirderDetail's Design all). The defaults are placeholders; only their ratios affect the choice, and the tab shows each as an equivalent weight of steel. Within each field piece the flange width is constant and the thicknesses are chosen by an optimization that adds a transition only where it saves more than it costs. Field splices are placed by the program near the dead-load points of contraflexure and within the shipping length and weight, and moved off cross-frame locations where the framing check X4 finds a conflict.</p>
 <p><b>Rules.</b> AASHTO LRFD minimums always apply: D/t<sub>w</sub> ≤ 150 unstiffened or 300 stiffened (6.10.2.1), b<sub>f</sub>/2t<sub>f</sub> ≤ 12, b<sub>f</sub> ≥ D/6, t<sub>f</sub> ≥ 1.1t<sub>w</sub>, 0.1 ≤ I<sub>yc</sub>/I<sub>yt</sub> ≤ 10 (6.10.2.2), plates at least 5/16 in (6.7.3), and one steel grade (no hybrid girders). With the AASHTO/NSBA G12.1 fabrication guidelines on (the default), the Limits tab minimum sizes, increments, and transition ratios also apply. The span-to-depth limits of Table 2.5.2.6.3-1 apply by default. The Suggest setting can turn them off only when the Limits tab does not treat span-to-depth as mandatory; with "Treat span-to-depth (G1, G2) as mandatory" on, Suggest (fast and full design, the deck-width study, and the web economy comparison) always applies them, so it never proposes a girder that fails G1 or G2. Full design also requires the final plates of each candidate to meet the minimum depths, since resizing can thin the flanges.</p><p><b>Optimizing the framing.</b> Stiffener spacing and cross-frame spacing are design variables. For stiffened webs, the fast search tries d<sub>o</sub>/D = 1.0, 1.5, 2.0, and 3.0 (shear buckling coefficient k = 5 + 5/(d<sub>o</sub>/D)²): wider panels need fewer stiffeners but a thicker web, and the cost decides. Full design then re-runs its best candidate at cross-frame spacings from 15 ft up to the maximum set on the Suggest tab (default 25 ft) in 2.5 ft steps, with every check (lateral-torsional buckling with the actual spacing and C<sub>b</sub>, deck placement, and the rest), adding the cost of each intermediate cross-frame, and keeps the cheapest. Apply sets the Framing tab spacing and d<sub>o</sub>/D. The deck overhang is not modeled in sizing: GirderDetail's Deck overhang auto-design gives the largest spacing the deck placement allows at the exterior girder, so set the maximum spacing no higher than that.</p><p><b>Flange widths.</b> Every flange at a field splice is made wide enough for the number of bolt gage lines each side of the web set on the Suggest tab (default 2) without staggering, using the same geometry as GirderDetail's splice auto-design: the first line clear of the web splice plate by the plate clearance plus the edge distance and by the tightening clearance C₁, the gage between lines, and the edge distance at the flange tip (about 14 in for 7/8 in bolts and two lines). The top flange is kept at one width along the girder unless turned off (it simplifies the haunch and stay-in-place forms), and the width of either flange changes by no more than the set maximum at a field splice (default 4 in; 0 for no limit). Widths are raised, never reduced, to meet these rules, and the thicknesses are then optimized at those widths.</p>
 <p><b>Quick suggestion and full design.</b> Suggest has two modes. The <b>quick suggestion</b> updates as you edit. It picks the web depth and web type with the lowest estimated cost from a fast sizing (one constant-stiffness beam model, flange areas from lever-arm estimates, this tool's layout checks), then checks that girder with the same staged analysis and AASHTO checks as Full design (listed below) for the interior and exterior girders, including the Table 2.5.2.6.3-1 minimum depths when span-to-depth applies to Suggest. Where a ratio exceeds 1.0 it increases the flange plates there (required area = current area &times; ratio/0.97 &times; 1.01, at most 1.35 times per round, never less than the plate already there) and thickens the web by one increment if the web ratio exceeds 1.0, then checks again, up to 8 rounds. Plates are only increased, never trimmed, so the quick suggestion passes the strength and service checks (the card says so, or names the ratio that still exceeds 1.0) but is not necessarily the lightest girder. The check runs in the background after the fast result appears (the card shows &ldquo;checking&rdquo; with a progress bar; typically a second or less after the fast result); a new edit restarts it, and Apply pressed during the check applies the checked result, after confirmation, when it is ready. The girder-count study and the Alternatives study use the fast sizing only, without this check, to rank layouts. <b>Run full design</b> optimizes for the least steel: it takes the best fast candidates and, for each, repeats: the staged, cracked analysis of the current layout (the Structural analysis settings); the AASHTO checks at every node for the interior and exterior girders, on both sides of every plate boundary (Strength I positive flexure with the plastic moment, compactness, D<sub>p</sub>/D<sub>t</sub>, and 1.3M<sub>y</sub>; Strength I negative flexure by 6.10.8 with flange local buckling, lateral-torsional buckling at the cross-frame spacing with C<sub>b</sub> from the quarter-point moments of each unbraced segment (10th Edition 6.10.8.2.3b: C<sub>b</sub> = 12.5M<sub>max</sub>/(2.5M<sub>max</sub> + 3M<sub>A</sub> + 4M<sub>B</sub> + 3M<sub>C</sub>), with M<sub>max</sub> the largest moment compressing the flange and M<sub>A</sub>, M<sub>B</sub>, M<sub>C</sub> the absolute envelope values at the quarter points (largest compression, or smallest tension where the flange is never in compression), as defined in Appendix D6.6; brace points at the supports and at the cross-frame spacing), and R<sub>b</sub>; where the compression flange changes within the unbraced length, lateral-torsional buckling uses the smallest compression flange in it (conservative; the γ<sub>e</sub> methods of Appendix D6.6 are not implemented); deck-placement lateral-torsional buckling also uses C<sub>b</sub> from the deck-placement moments; Service II flange stresses and web bend-buckling; deck-placement constructibility; flange fatigue, Fatigue I, Category B at the flange-to-web welds (extreme fiber) and Category C′ at the connection plates welded to the flanges at every cross-frame (inner flange face, 6.6.1.3.1), unless turned off or limited to Category B; and optionally L/800 deflection); and resizing, with each flange's required area set from the check ratio so plates are thickened where a check exceeds 1.0 and trimmed where there is spare capacity. When the layout stops changing it is verified against its own recomputed demands, and the cheapest passing candidate is selected. The result lists the governing check and ratio for every plate. Applying it replaces the girder layout (and the stiffener setting); Revert restores the previous design.</p>
+<p><b>Current girder compared with the suggestion.</b> Below the quick suggestion (or full design) card, the Suggest tab compares the current girder (the Girder tab plates and splices, with the Framing tab stiffeners and cross-frame spacing) with the suggestion, so you can see what the suggestion changes. The overall rows give the web depth and thickness, transverse stiffeners and d<sub>o</sub>/D, cross-frame spacing, field splices, shop transitions, steel per girder and per deck area, cost (Unit costs), the largest strength and service ratio, and the code proportion check counts, with each changed row highlighted. The top flange, web, and bottom flange are then compared plate by plate: the two plate lists are merged by station, so each row is a station range with the current and the suggested plate and what changes (for example &ldquo;t 1 1/8 &rarr; 1 1/4&rdquo;, &ldquo;b 16 &rarr; 15&rdquo;, &ldquo;new transition at 28 ft&rdquo;). A plot shows the flange thickness and width along the girder for both. The current girder is checked in the background with the same staged analysis and strength and service checks as the quick suggestion, at its own cross-frame spacing (an edit restarts the check); the card says whether a change is needed (the current girder exceeds 1.0, is shallower than the Table 2.5.2.6.3-1 minimum depth where that applies, or fails a code proportion check) or would only save steel and cost, and &ldquo;No change suggested&rdquo; when the suggestion is the same as the current girder. If the current girder has input errors, the card lists them instead. The comparison changes nothing until you press Apply.</p>
 <h3>Analysis model</h3><p>The analysis of the current design uses a variable-stiffness, staged line-girder model: DC1 on the steel section, DC2 and DW on the long-term composite section, and live load on the short-term composite section, with the composite stages cracked near interior supports. Its settings (staged or constant EI, cracked zones, deck reinforcement) are made in GirderDetail's Structural analysis module. Suggest mode searches trial layouts with the faster constant-EI model and then designs the chosen layout with the staged model.</p>
 <h3>Variable spacing and deck edges</h3><p>On the Bridge tab, <b>Girder spacing</b> can be <i>Variable</i>: enter the bay spacings from left to right (one fewer than the number of girders). The framing plan, cross-section, deck width, and GirderDetail's LLDF and DLs module use each bay; the sizing checks and the built-in approximate distribution factors use the average spacing, and the spacing and overhang checks are made bay by bay. <b>Deck edges</b> can be a barrier (width and the Suggest barrier weight) or a <i>curb and railing</i> on each side: curb width and height, railing load point and weight, and the distance from the deck edge to the traffic face, which sets the roadway. When GirderDetail's LLDF and DLs module is in use, its factors and MassDOT dead loads replace the built-in ones (see the Analysis tab).</p>
 <h3>Reverting a suggestion</h3><p>Applying a suggested layout (Suggest tab) or an alternative (Alternatives tab) keeps a copy of the design from just before it. A banner above the output tabs then offers <b>Revert to the previous design</b>; after reverting, the same button re-applies the change, so you can compare the two. The copy survives a reload and is replaced the next time you apply a suggestion or alternative. <b>Keep and dismiss</b> discards it.</p>
@@ -2721,7 +2724,7 @@
 function maybeSuggest(force) {
   if (P.ui.otab !== 'suggest' && !force) return;
   const k = sgKey();
-  if (k === SG_KEY && SG && !force && !(SG.quick && SG.quick.qk !== sgQKey())) return;
+  if (k === SG_KEY && SG && !force && !(SG.quick && SG.quick.qk !== sgQKey())) { if (!SG.errors.length && SGC_SHOWN !== sgcKey()) { try { renderSuggest(); } catch (e) { console.error(e); } } return; }   // the current girder changed: refresh the comparison only
   const host = $('#tab-suggest');
   if (!force) { host.classList.add('busy'); if (!host.innerHTML.trim()) host.innerHTML = '<div class="pending">Computing suggested layout…</div>'; }
   clearTimeout(SG_T);
@@ -2765,6 +2768,129 @@
   let a = 0, k = 0; for (; k < spans.length - 1; k++) { if (g.x <= a + spans[k] + 1e-9) break; a += spans[k]; }
   return `${g.name}, ${g.where} at ${f2(g.x)} ft${spans.length > 1 ? ` (Span ${k + 1})` : ''}${g.gt ? `, ${g.gt === 'ext' ? 'exterior' : 'interior'} girder` : ''}`;
 }
+/* Current girder vs suggestion (display only, 2026-10-13). The current girder (Girder tab, with the Framing tab stiffener setting and
+   cross-frame spacing) is checked with the same staged verify as the quick suggestion (suggestLayout opts.verify), in the background with
+   its own run token (SGC_RUN): renderSuggest starts it when the current girder or the inputs change, and a result for older inputs is
+   dropped. Nothing here changes a suggestion or a saved value. */
+let SGC = null, SGC_RUN = 0, SGC_SHOWN = '';
+function sgcKey() { return JSON.stringify([sgQKey(), P.girder, P.dfx || null]); }
+function sgcIn() { const m = M && !M.errors.length ? M : null; if (!m) return null; const F = P.framing || {};
+  return { D: m.D, wt: F.stiff === 'on' ? 'stiffened' : 'unstiffened', doR: num(F.doRatio) || 1, top: m.top.map(g => ({ L: g.L, b: g.b, t: g.t })), bot: m.bot.map(g => ({ L: g.L, b: g.b, t: g.t })), web: m.web.map(w => ({ L: w.L, t: w.t })), splices: [...m.splices] }; }
+function sgCurStart() {
+  const key = sgcKey(); if (SGC && SGC.key === key) return;
+  const inp = sgcIn(); if (!inp) { SGC_RUN++; SGC = { key, state: 'none' }; return; }
+  const run = ++SGC_RUN, PP = clone(P), me = SGC = { key, state: 'checking' };
+  setTimeout(async () => {
+    await new Promise(r => setTimeout(r, 0)); if (run !== SGC_RUN || SGC !== me) return;   // an edit in between started a new run: this one stops
+    let r;
+    try { const V = suggestLayout(PP, { full: true, verify: inp });
+      r = V.errors && V.errors.length ? { state: 'error', msg: V.errors[0] } : { state: 'done', V, pass: V.check.max <= 1.0005 && V.check.rWeb <= 1.0005 && V.dOK, dfx: !!sgDfx(PP, inp.D, inp.top, inp.bot, inp.web, false) }; }
+    catch (e) { console.error(e); r = { state: 'error', msg: e.message || String(e) }; }
+    if (run !== SGC_RUN || SGC !== me) return;
+    SGC = { key, ...r };
+    if (SG && !SG.errors.length && key === sgcKey()) { try { renderSuggest(); } catch (e) { console.error(e); } }
+  }, 40);
+}
+const sgFs = x => Math.abs(x - Math.round(x)) < 5e-3 ? String(Math.round(x)) : f2(x);   // station in ft, whole feet without decimals
+function sgCmpRows(cl, sl, isWeb, Dc, Ds, spl) {   // plate lists merged by station: one row per range over which neither girder changes plate
+  const r4 = v => Math.round(v * 1e4) / 1e4, Lt = r4(sl[sl.length - 1].x1);
+  const xs = [...new Set([0, Lt, ...cl.map(g => r4(g.x1)), ...sl.map(g => r4(g.x1))])].filter(x => x <= Lt).sort((a, b) => a - b);
+  const at = (l, x) => l.find(g => x >= g.x0 - 1e-6 && x < g.x1 - 1e-6) || l[l.length - 1];
+  const same = (a, b) => Math.abs(a.t - b.t) < 1e-9 && (isWeb || Math.abs(a.b - b.b) < 1e-9);
+  const rows = [];
+  for (let i = 0; i < xs.length - 1; i++) { if (xs[i + 1] - xs[i] < 1e-6) continue; const xm = (xs[i] + xs[i + 1]) / 2, c = at(cl, xm), g = at(sl, xm), p = rows[rows.length - 1];
+    if (p && same(p.c, c) && same(p.g, g)) { p.x1 = xs[i + 1]; continue; } rows.push({ x0: xs[i], x1: xs[i + 1], c, g }); }
+  rows.forEach((r, i) => { const n = [];
+    if (isWeb && Math.abs(Dc - Ds) > 1e-9) n.push(`D ${frac(Dc)} → ${frac(Ds)}`);
+    if (!isWeb && Math.abs(r.c.b - r.g.b) > 1e-9) n.push(`b ${frac(r.c.b)} → ${frac(r.g.b)}`);
+    if (Math.abs(r.c.t - r.g.t) > 1e-9) n.push(`t ${frac(r.c.t)} → ${frac(r.g.t)}`);
+    const p = rows[i - 1];
+    if (p) { const sC = !same(p.g, r.g), cC = !same(p.c, r.c), atS = spl.some(v => Math.abs(v - r.x0) < 1e-3);
+      if (sC && !cC) n.push(atS ? `new plate change at the field splice at ${sgFs(r.x0)} ft` : `new transition at ${sgFs(r.x0)} ft`);
+      if (cC && !sC) n.push(`plate change at ${sgFs(r.x0)} ft removed`); }
+    r.note = n.join('; '); r.chg = !!n.length; });
+  return rows;
+}
+function sgCmpHtml(o) {   // the comparison card and a one-line summary for the suggestion card
+  const { s, mS, cur, cS, cnt, Cs, curCost, Q, chk, gv } = o, F = P.framing || {}, money = v => '$' + Math.round(v).toLocaleString('en-US');
+  const what = s.full ? 'full design' : 'quick suggestion', W = s.full ? 'Full design' : 'Quick suggestion', ttl = `Current girder compared with the ${what}`;
+  if (!cur) { const er = (M && M.errors) || [];
+    return { line: 'The current girder (Girder tab) has input errors, so it is not compared.', html: card('sg-cmp', ttl, 'Not compared', `<div class="alert fail"><b>The current girder has input errors, so it cannot be compared or checked.</b> Fix them on the Girder tab.${er.length ? `<ul class="err-list">${er.slice(0, 6).map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}</div>`) }; }
+  const rT = sgCmpRows(cur.top, mS.top, false, 0, 0, s.splices), rW = sgCmpRows(cur.web, mS.web, true, cur.D, s.D, s.splices), rB = sgCmpRows(cur.bot, mS.bot, false, 0, 0, s.splices);
+  const pct = (d, b) => b > 0 ? `${d > 0 ? '+' : d < 0 ? '−' : ''}${f2(Math.abs(100 * d / b))}%` : '';
+  const sgn = (d, f) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${f(Math.abs(d))}`;
+  const cSt = F.stiff === 'on', cDo = num(F.doRatio) || 1, sSt = s.webType ? s.webType === 'stiffened' : cSt, sDo = s.doR || cDo;
+  const stTxt = (st, d) => st ? `stiffened, d<sub>o</sub> = ${f2(d)}D` : 'unstiffened (connection plates only)';
+  const stChg = cSt !== sSt || (sSt && Math.abs(cDo - sDo) > 1e-6);
+  const cSp = num(F.spacing), sSp = s.spacing || cSp, spChg = !!s.spacing && Math.abs(sSp - cSp) > 1e-6;
+  const dChg = Math.abs(cur.D - s.D) > 1e-9, twC = [...new Set(cur.web.map(w => frac(w.t)))].join(', '), twS = [...new Set(mS.web.map(w => frac(w.t)))].join(', '), twChg = twC !== twS;
+  const has = (l, v) => l.some(u => Math.abs(u - v) < 1e-3), sAdd = s.splices.filter(v => !has(cur.splices, v)), sDel = cur.splices.filter(v => !has(s.splices, v)), splChg = !!(sAdd.length || sDel.length);
+  const nTc = cur.trans.filter(t => !t.atSplice).length, nTs = mS.trans.filter(t => !t.atSplice).length;
+  const ids = new Set(cS.map(k => k.id)), cP = { fail: 0, warn: 0 }; (C || []).forEach(k => { if (ids.has(k.id) && cP[k.status] !== undefined) cP[k.status]++; });
+  const chT = rT.some(r => r.chg), chB = rB.some(r => r.chg), chW = rW.some(r => r.chg);
+  const noChange = !chT && !chB && !chW && !dChg && !twChg && !splChg && !stChg && !spChg;
+  const S = SGC && SGC.key === sgcKey() ? SGC : { state: 'checking' };
+  const cg = S.state === 'done' ? sgGov(S.V.check, S.V.xs) : null;
+  const dep = ok => ok ? '' : '; shallower than the Table 2.5.2.6.3-1 minimum depth';
+  const curR = S.state === 'done' ? `Current girder: largest ratio ${f3(cg.r)} (${esc(sgGovTxt(cg, s.spans))})${dep(S.V.dOK)}.` : S.state === 'checking' ? 'Current girder: checking…' : `Current girder: the check could not be completed (${esc(S.msg || 'no result')}).`;
+  const sugR = gv ? `${W}: largest ratio ${f3(gv.r)} (${esc(sgGovTxt(gv, s.spans))})${dep(chk.dOK)}.` : Q && Q.state === 'checking' ? `${W}: checking…` : `${W}: not checked.`;
+  let cls = 'chk', head = 'Checking the current girder for strength and service…';
+  if (S.state === 'error' || S.state === 'none') { cls = 'fail'; head = 'The strength and service check of the current girder could not be completed'; }
+  else if (S.state === 'done') {
+    const why = []; if (!S.pass) why.push(cg.r > 1.0005 ? `exceeds 1.0 (largest ratio ${f3(cg.r)})` : 'is shallower than the Table 2.5.2.6.3-1 minimum depth'); if (cP.fail) why.push(`fails ${cP.fail} code proportion check${cP.fail > 1 ? 's' : ''}`);
+    if (noChange) { cls = S.pass && !cP.fail ? 'pass' : 'fail'; head = 'No change suggested'; }
+    else if (why.length) { cls = 'fail'; head = `A change is needed: the current girder ${why.join(' and ')}`; }
+    else { cls = 'pass'; head = `Not needed for strength or service: the current girder passes (largest ratio ${f3(cg.r)})`; } }
+  let sav = '';
+  if (noChange) sav = `The ${what} is the same as the current girder.`;
+  else if (Cs && curCost) { const dW = mS.wt - cur.wt, dC = Cs.total - curCost.total;
+    sav = `${W} compared with the current girder: steel ${Math.abs(dW) < 5e-3 ? 'the same' : `${f2(Math.abs(dW))} kip ${dW < 0 ? 'less' : 'more'} per girder (${pct(dW, cur.wt)})`}, cost ${Math.abs(dC) < 0.5 ? 'the same' : `${money(Math.abs(dC))} ${dC < 0 ? 'less' : 'more'} for all girders (${pct(dC, curCost.total)})`}.`;
+    if (S.state === 'done' && S.pass && !cP.fail) sav += dC < -0.5 ? ' The change would only save steel and cost.' : ` The change would not save cost: keep the current girder${s.full ? '' : ', or run full design for the least steel'}.`;
+    else if (S.state === 'done' && chk && !chk.pass) sav += ` The ${what} does not pass every check either; ${s.full ? 'review the Full design results' : 'run full design'}.`; }
+  const row = (l, a, b, chg, note) => `<tr class="${chg ? 'chg' : ''}"><td class="lbl">${l}</td><td class="val">${a}</td><td class="val">${b}</td><td class="${chg ? 'chg-t' : ''}">${chg ? note || 'changed' : ''}</td></tr>`;
+  const spl = l => l.length ? l.map(f2).join(', ') + ' ft' : 'none';
+  const dWt = mS.wt - cur.wt, dPsf = mS.psf - cur.psf, dCost = Cs && curCost ? Cs.total - curCost.total : 0;
+  const rr = (a, b) => a && b && Math.abs(a.r - b.r) > 5e-4;
+  const overall = `<div class="tscroll"><table class="tbl"><thead><tr><th></th><th class="right">Current girder</th><th class="right">${W}</th><th>Change</th></tr></thead><tbody>
+    ${row('Web depth D', `${frac(cur.D)} in`, `${frac(s.D)} in`, dChg, `${sgn(s.D - cur.D, frac)} in`)}
+    ${row('Web thickness t<sub>w</sub>', `${twC} in`, `${twS} in`, twChg, `${twC} → ${twS} in`)}
+    ${row('Transverse stiffeners', stTxt(cSt, cDo), stTxt(sSt, sDo), stChg, cSt !== sSt ? (sSt ? 'stiffeners added' : 'stiffeners removed') : `d<sub>o</sub>/D ${f2(cDo)} → ${f2(sDo)}`)}
+    ${row('Cross-frame spacing', `${f2(cSp)} ft`, s.spacing ? `${f2(sSp)} ft` : `${f2(cSp)} ft (not changed by the ${what})`, spChg, `${sgn(sSp - cSp, f2)} ft`)}
+    ${row('Field splices', spl(cur.splices), spl(s.splices), splChg, sAdd.length && sAdd.length === sDel.length ? `moved ${sDel.map((v, i) => `${sgFs(v)} → ${sgFs(sAdd[i])}`).join(', ')} ft` : [sAdd.length ? `added at ${sAdd.map(sgFs).join(', ')} ft` : '', sDel.length ? `removed at ${sDel.map(sgFs).join(', ')} ft` : ''].filter(Boolean).join('; '))}
+    ${row('Shop transitions (all flanges)', nTc, nTs, nTc !== nTs, sgn(nTs - nTc, String))}
+    ${row('Steel per girder, with allowance', `${f2(cur.wt)} kip`, `${f2(mS.wt)} kip`, Math.abs(dWt) >= 5e-3, `${sgn(dWt, f2)} kip (${pct(dWt, cur.wt)})`)}
+    ${row('Steel per deck area', `${f2(cur.psf)} psf`, `${f2(mS.psf)} psf`, Math.abs(dPsf) >= 5e-3, `${sgn(dPsf, f2)} psf (${pct(dPsf, cur.psf)})`)}
+    ${Cs && curCost ? row('Cost, all girders (Unit costs)', money(curCost.total), money(Cs.total), Math.abs(dCost) >= 0.5, `${dCost < 0 ? '−' : '+'}${money(Math.abs(dCost))} (${pct(dCost, curCost.total)})`) : ''}
+    ${row('Largest strength and service ratio', cg ? f3(cg.r) : S.state === 'checking' ? 'checking…' : '—', gv ? f3(gv.r) : Q && Q.state === 'checking' ? 'checking…' : '—', rr(cg, gv), cg && gv ? `${f3(cg.r)} → ${f3(gv.r)}` : '')}
+    ${row('Code proportion checks', `${cP.fail} fail, ${cP.warn} warn`, `${cnt.fail} fail, ${cnt.warn} warn`, cP.fail !== cnt.fail || cP.warn !== cnt.warn, [cP.fail !== cnt.fail ? `fail ${cP.fail} → ${cnt.fail}` : '', cP.warn !== cnt.warn ? `warn ${cP.warn} → ${cnt.warn}` : ''].filter(Boolean).join(', '))}</tbody></table></div>`;
+  const ptbl = (title, rows, isWeb) => `<div><h4 class="sg-h4">${title}</h4><div class="tscroll"><table class="tbl"><thead><tr><th class="right">From (ft)</th><th class="right">To (ft)</th><th class="right">Current (in)</th><th class="right">${W} (in)</th><th>Change</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.chg ? 'chg' : ''}"><td class="val">${f2(r.x0)}</td><td class="val">${f2(r.x1)}</td><td class="val nw">${isWeb ? `${frac(cur.D)} × ${frac(r.c.t)}` : pl(r.c.b, r.c.t)}</td><td class="val nw">${isWeb ? `${frac(s.D)} × ${frac(r.g.t)}` : pl(r.g.b, r.g.t)}</td><td class="${r.chg ? 'chg-t' : ''}">${r.note}</td></tr>`).join('')}</tbody></table></div></div>`;
+  const nCh = [rT, rW, rB].reduce((a, l) => a + l.filter(r => r.chg).length, 0);
+  const parts = [dChg && 'web depth', twChg && 'web thickness', stChg && 'stiffeners', spChg && 'cross-frame spacing', splChg && 'field splices', chT && 'top flange plates', chB && 'bottom flange plates'].filter(Boolean);
+  const line = noChange ? `No change suggested: the ${what} is the same as the current girder.` : `Changes from the current girder: ${parts.join(', ')} (compared below).`;
+  const fast = Q && Q.state === 'checking' ? ` While the ${what} is being checked, the fast result is compared; its plates may still increase.` : '';
+  const note = `<p class="note-p">Current girder: the Girder tab plates and splices with the Framing tab stiffeners and cross-frame spacing. The two plate lists are merged by station, so each row below is a station range over which neither girder changes plate; changed rows are highlighted. Both girders are checked with the same staged analysis and AASHTO strength and service checks (those of the quick suggestion and Full design, for the interior and exterior girders)${s.full ? ', the current girder at its Framing tab cross-frame spacing and the full design at its own' : ''}. Steel includes the ${f2(P.limits.allow)}% detail allowance; costs use the Unit costs on the Suggest input tab.${S.dfx ? ' The current girder\'s check uses the factors and dead loads of GirderDetail\'s LLDF and DLs module (computed for this girder); the suggestion, the built-in ones.' : ''}${fast} Nothing changes until you press Apply.</p>`;
+  const html = card('sg-cmp', ttl, noChange ? 'No change suggested' : `${nCh} plate range${nCh === 1 ? '' : 's'} change`, `
+    <div class="sg-head ${cls}"><div><b>${head}</b><span class="sg-ln">${curR}</span><span class="sg-ln">${sugR}</span><span class="sg-ln">${sav}</span></div></div>${note}${overall}
+    <div class="cmp-tbls">${ptbl('Top flange', rT)}${ptbl('Web', rW, true)}${ptbl('Bottom flange', rB)}</div>
+    <h4 class="sg-h4" style="margin-top:14px">Flange plates along the girder</h4><div id="plt-sg-cmpT" class="plt"></div><div id="plt-sg-cmpB" class="plt short"></div>
+    <p class="cap">Thickness (upper plot) and width (lower plot) of the top and bottom flanges: current girder dashed, ${what} solid. Vertical lines mark supports (solid), the ${what}'s field splices (blue dashed), and the current field splices (grey dotted).</p>`);
+  return { line, html };
+}
+function sgCmpPlot(mS, cur) {   // flange thickness and width along the girder, current vs suggested
+  if (!window.Plotly || !SG || !cur || !$('#plt-sg-cmpT')) return;
+  const step = (l, f) => { const xx = [], yy = [], cd = []; l.forEach(r => { xx.push(r.x0, r.x1); yy.push(f(r), f(r)); cd.push(frac(f(r)), frac(f(r))); }); return { x: xx, y: yy, customdata: cd }; };
+  const vl = (x, color, dash) => ({ type: 'line', xref: 'x', yref: 'paper', x0: x, x1: x, y0: 0, y1: 1, line: { color, width: 1, dash } });
+  const sh = [...SG.beam.sup.map(i => vl(SG.beam.xs[i], '#17212b', 'solid')), ...SG.splices.map(v => vl(v, '#2346c2', 'dash')), ...cur.splices.map(v => vl(v, '#9aa3ab', 'dot'))];
+  const base = { font: PLOT_FONT, margin: { l: 70, r: 20, t: 16, b: 50 }, paper_bgcolor: '#fff', plot_bgcolor: '#fff', hovermode: 'x unified', legend: { orientation: 'h', y: -0.25 }, shapes: sh,
+    xaxis: { title: 'Station (ft)', range: [0, SG.beam.Ltot], gridcolor: '#edf0ec', zeroline: false } };
+  const tr = f => [
+    { ...step(cur.top, f), name: 'Top, current', line: { color: '#2346c2', width: 1.6, dash: 'dash' } }, { ...step(mS.top, f), name: 'Top, suggested', line: { color: '#2346c2', width: 2.4 } },
+    { ...step(cur.bot, f), name: 'Bottom, current', line: { color: '#15724a', width: 1.6, dash: 'dash' } }, { ...step(mS.bot, f), name: 'Bottom, suggested', line: { color: '#15724a', width: 2.4 } }];
+  const dT = tr(r => r.t), dB = tr(r => r.b);
+  [dT, dB].forEach(d => d.forEach(q => { q.mode = 'lines'; q.hovertemplate = `${q.name}: %{customdata} in<extra></extra>`; }));
+  Plotly.react($('#plt-sg-cmpT'), dT, { ...base, yaxis: { title: 'Flange thickness (in)', gridcolor: '#edf0ec', rangemode: 'tozero' } }, { displaylogo: false, responsive: true });
+  Plotly.react($('#plt-sg-cmpB'), dB, { ...base, showlegend: false, margin: { l: 70, r: 20, t: 10, b: 44 }, yaxis: { title: 'Flange width (in)', gridcolor: '#edf0ec', rangemode: 'tozero' } }, { displaylogo: false, responsive: true });
+}
 function sgApplyLbl() {
   const t = SG && SG.full ? 'Apply full design' : SGQ_APPLY && SGQ_APPLY === SGQ_RUN ? 'Apply quick suggestion (when checked)' : 'Apply quick suggestion';
   ['#sg_apply', '#sg_apply_side'].forEach(id => { const b = $(id); if (b) b.textContent = t; });
@@ -2791,6 +2917,9 @@
   const issues = cS.filter(c => ['fail', 'warn', 'adv'].includes(c.status));
   const R = s.rec, types = s.types, TT = t => t === 'int' ? 'interior' : 'exterior';
   const cur = M && !M.errors.length ? M : null;
+  sgCurStart(); SGC_SHOWN = sgcKey();   // strength and service check of the current girder (background), for the comparison card
+  const wtCur = P.framing && P.framing.stiff === 'on' ? 'stiffened' : 'unstiffened';
+  const curCost = cur ? suggestLayout(P, { costOnly: { D: cur.D, wt: wtCur, top: P.girder.top.map(g => ({ L: num(g.L), b: num(g.b), t: num(g.t) })), bot: P.girder.bot.map(g => ({ L: num(g.L), b: num(g.b), t: num(g.t) })), web: P.girder.web.map(w => ({ L: num(w.L), t: num(w.t) })), splices: (P.girder.splices || []).map(num) } }).cost : null;
 
   /* 1. summary */
   const verdict = cnt.fail ? 'fail' : 'pass';
@@ -2809,16 +2938,17 @@
   else if (Q && Q.state === 'error') sv = `<b>The strength and service check could not be completed</b><span class="sg-ln">${esc(Q.msg || '')}. The fast result shown is not checked; run full design.</span>`;
   else if (chk) sv = `<b>${chk.pass ? 'Passes the strength and service checks' : 'Does not pass every strength and service check'}: largest ratio ${f3(gv.r)}</b><span class="sg-ln">Governing: ${esc(sgGovTxt(gv, s.spans))}.${chk.dOK ? '' : ' The girder is shallower than the Table 2.5.2.6.3-1 minimum depth.'}${Q ? (Q.changed ? ` Plates increased in ${Q.iters} round${Q.iters > 1 ? 's' : ''} from the fast sizing (largest ratio before: ${f3(Math.max(Q.max0, Q.web0))}).` : Q.pass ? ' The fast sizing passed as is; no plate was changed.' : '') : ''}${chk.pass ? '' : s.full ? ' Review the Full design results below.' : ` ${Q.note ? `Stopped: ${esc(Q.note)}. ` : ''}Run full design for a layout that passes.`}</span>`;
   const verdict2 = Q && Q.state === 'checking' ? 'chk' : cnt.fail || (chk && !chk.pass) || (Q && Q.state === 'error') ? 'fail' : 'pass';
+  const dnote = `<div class="note-p" style="margin:0">Designed for the ${SG_TYPES_TXT(types)}. Web depth ${s.rec.D.keep ? 'kept from the Girder tab' : `from the target L/D<sub>st</sub> of ${f2(R.D.ratio)}${R.D.bumps ? `, increased ${R.D.bumps} time${R.D.bumps > 1 ? 's' : ''} to satisfy G1/G2` : ''}`}. Widths are constant within each field piece; thickness changes only where the steel saved exceeds the ${f0(P.suggest.weld)} lb weld-cost equivalent.</div>`;   // design basis note (beside the plate lists when the current girder cannot be compared)
+  const cmpO = sgCmpHtml({ s, mS, cur, cS, cnt, Cs: s.cost, curCost, Q, chk, gv });   // current girder vs suggestion (2026-10-13)
   const ttl = s.full ? 'Full design (Run full design) — optimized for least steel' : Q && Q.state === 'checking' ? 'Quick suggestion (updates as you edit) — checking strength and service…' : 'Quick suggestion (updates as you edit) — checked for strength and service';
   h += card('sg-sum', ttl, `${R.iter} sizing iterations`, `
-    <div class="sg-head ${verdict2}"><div>${sv}<span class="sg-ln">${prop}</span></div>
+    <div class="sg-head ${verdict2}"><div>${sv}<span class="sg-ln">${prop}</span><span class="sg-ln">${cmpO.line}</span></div>
       <button type="button" class="btn btn-primary" id="sg_apply">${s.full ? 'Apply full design' : 'Apply quick suggestion'}</button></div>
-    <div class="g2">${cmp}<div class="note-p" style="margin:0">Designed for the ${SG_TYPES_TXT(types)}. Web depth ${s.rec.D.keep ? 'kept from the Girder tab' : `from the target L/D<sub>st</sub> of ${f2(R.D.ratio)}${R.D.bumps ? `, increased ${R.D.bumps} time${R.D.bumps > 1 ? 's' : ''} to satisfy G1/G2` : ''}`}. Widths are constant within each field piece; thickness changes only where the steel saved exceeds the ${f0(P.suggest.weld)} lb weld-cost equivalent.</div></div>
-    <div class="g3" style="margin-top:12px"><div><h4 class="sg-h4">Top flange</h4>${plates(mS.top)}</div><div><h4 class="sg-h4">Web</h4>${plates(mS.web, true)}</div><div><h4 class="sg-h4">Bottom flange</h4>${plates(mS.bot)}</div></div>`);
+    ${cur ? dnote : `<div class="g2">${cmp}${dnote}</div>
+    <div class="g3" style="margin-top:12px"><div><h4 class="sg-h4">Top flange</h4>${plates(mS.top)}</div><div><h4 class="sg-h4">Web</h4>${plates(mS.web, true)}</div><div><h4 class="sg-h4">Bottom flange</h4>${plates(mS.bot)}</div></div>`}`);
+  h += cmpO.html;
 
   /* 1b. cost, candidates, full design */
-  const wtCur = P.framing && P.framing.stiff === 'on' ? 'stiffened' : 'unstiffened';
-  const curCost = cur ? suggestLayout(P, { costOnly: { D: cur.D, wt: wtCur, top: P.girder.top.map(g => ({ L: num(g.L), b: num(g.b), t: num(g.t) })), bot: P.girder.bot.map(g => ({ L: num(g.L), b: num(g.b), t: num(g.t) })), web: P.girder.web.map(w => ({ L: num(w.L), t: num(w.t) })), splices: (P.girder.splices || []).map(num) } }).cost : null;
   const C = s.cost, money = v => '$' + Math.round(v).toLocaleString('en-US'), cc = curCost || { parts: { steel: 0, trans: 0, stiff: 0, splice: 0 }, wTot: 0, nTr: 0, nSt: 0, nSp: 0, total: 0 }, crow = (l, a, b2) => `<tr><td class="lbl">${l}</td><td class="val">${a}</td>${curCost ? `<td class="val">${b2}</td>` : ''}</tr>`;
   if (C) h += card('sg-cost', s.full ? 'Cost of the full design' : 'Cost of the quick suggestion', `${C.nb} girders`, `<table class="tbl narrow"><thead><tr><th></th><th class="right">${s.full ? 'Full design' : 'Quick suggestion'}</th>${curCost ? '<th class="right">Current girder</th>' : ''}</tr></thead><tbody>
       ${crow('Structural steel', `${money(C.parts.steel)} (${f0(C.wTot / 1000)} kip)`, `${money(cc.parts.steel)} (${f0(cc.wTot / 1000)} kip)`)}${crow('Flange transitions', `${money(C.parts.trans)} (${C.nTr} per girder)`, `${money(cc.parts.trans)} (${cc.nTr})`)}
@@ -2908,7 +3038,7 @@
     <li>The suggested layout still has to be verified with the analysis and design apps before use.</li></ul>`);
   host.innerHTML = wsHtml() + xfNoteHtml(s) + h;
   $('#sg_apply').onclick = applySuggestion; sgApplyLbl();
-  applyCollapse(); drawSuggestCharts(mS); typeset(host);
+  applyCollapse(); drawSuggestCharts(mS); sgCmpPlot(mS, cur); typeset(host);
 }
 function SG_TYPES_TXT(t) { return t.length > 1 ? 'envelope of the interior and exterior girders' : t[0] === 'int' ? 'interior girder' : 'exterior girder'; }
 function argmax(a) { let k = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[k]) k = i; return k; }
```

### SC2. TS5 not-applicable text for connection-plate-only webs   [text only]

- **Where (main page):** `ckNew()`, TS5 block. Anchor `c.naWhy = 'Web designed as unstiffened (connection plates only)`.
- **Before:** `'Web designed as unstiffened (connection plates only): connection-plate spacing is not limited by 6.10.9.1; web shear is checked as unstiffened in TS4.'`
- **After:** `'Connection plates only (no intermediate stiffeners): connection-plate spacing is not limited by 6.10.9.1; TS4 checks each panel as stiffened where its spacing is within the 6.10.9.1 limits (3D interior, 1.5D end panels) and as unstiffened where it is wider.'`
- **Why:** since EK1/EK2, `webShear()` treats a panel bounded by connection plates as stiffened when d<sub>o</sub> ≤ 3D (interior) or ≤ 1.5D (end), so "checked as unstiffened" was wrong for those panels. The source comment above it gets the same correction. Governing provision: AASHTO LRFD 10th Ed. 6.10.9.1. No calculation or status changed.
- **Check case:** GirderDetail Transverse stiffeners module, built-in example with both locations set to Type B (connection plate), first location d<sub>o1</sub> = 60 in (end panel, ≤ 1.5D = 90 in) and d<sub>o2</sub> = 200 in (> 3D = 180 in): TS4 panel 1 (end) C = 0.800, φV<sub>n</sub> = 783.32 kip (stiffened, k = 5 + 5/(60/60)² = 10); panel 2 C = 0.400, φV<sub>n</sub> = 391.66 kip (unstiffened, k = 5) — before and after identical; TS5 N/A, reason text before/after as above.
- **How verified:** `node --check` on the main page scripts; headless Chromium (`GM.ts.compute` / `GM.ts.checks`) before and after; screenshot of the TS Summary tab. No console errors.
- **Other copies:** none.

### Exact changes (SC2): main page (unified diff, PL_B64 line omitted)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index 731db66..6202c96 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -2455,4 +2455,4 @@ tabs: { combos: 'Demands', rptCombos: 'Design demands' },
       R.rows.forEach(r => [r.p1, r.p2].forEach((q, i) => { const lim = (q.end ? 1.5 : 3) * r.D, ok = ge(lim, q.do), adv = !ok && !q.stiff; c.items.push({ loc: `${L(r)}, panel ${i + 1}${q.end ? ' (end)' : ''}`, cells: [f2(q.do), f2(lim), f2(q.do / lim)], r: q.do / lim, st: ok ? 'pass' : adv ? 'adv' : 'warn', work: T`d_o = ${f2(q.do)} \;${LE(q.do, lim)}\; ${q.end ? '1.5' : '3'}(${f2(r.D)}) = ${f2(lim)}\ \text{in}${adv ? T`\ \text{(treated as unstiffened in TS4)}` : ''}` }); }));
-      // web designed unstiffened (connection plates only): connection-plate spacing is not limited by 6.10.9.1 (TS4 checks every panel wider than its limit as unstiffened)
-      if (!R.rows.some(r => r.t.role === 'int') && !c.items.some(i => i.st === 'warn')) { c.items = []; c.naWhy = 'Web designed as unstiffened (connection plates only): connection-plate spacing is not limited by 6.10.9.1; web shear is checked as unstiffened in TS4.'; }
+      // connection plates only (no intermediate stiffeners): connection-plate spacing is not limited by 6.10.9.1 (TS4 checks a panel within its limit as stiffened and a wider one as unstiffened)
+      if (!R.rows.some(r => r.t.role === 'int') && !c.items.some(i => i.st === 'warn')) { c.items = []; c.naWhy = 'Connection plates only (no intermediate stiffeners): connection-plate spacing is not limited by 6.10.9.1; TS4 checks each panel as stiffened where its spacing is within the 6.10.9.1 limits (3D interior, 1.5D end panels) and as unstiffened where it is wider.'; }
       out.add(c); }
```

## 2026-10-13 — PR: claude/girderdetail-cf-naming (engineer's requests 2026-10-13; PR link added after merge)

Engineer's requests (2026-10-13): (1) the Cross-frames module is named for the bracing used: "Diaphragms" wherever the module's name is shown when the diaphragm is the bracing used (`cf.dia.on === 'yes'`), "Cross-frames" exactly as before otherwise; module id `cf`, keys and saved data unchanged; (2) the diaphragm elevations (and the DXF diaphragm details) draw the connection plates the diaphragm bolts to, with the bolt row passing through them, and the cross-frame elevation gets them too; (3) (CF-D12, separate commit) with the diaphragm, the module shows only what applies to the diaphragm. Display only: no formula, factor, resistance, check, or status changed. Cross-frames module (`GM.cf`) and its labels on the main page; `PL_B64`, the Transverse stiffeners module and the Field splice module are not touched. Line numbers ≈ branch.

### CF-D10. Module name follows the bracing used ("Diaphragms" with the diaphragm)   [UI text only] [cross-frame projects: every label unchanged]
- **Where (anchors):**
  - New helper after `cfDiaOn` (anchor `const cfIsDia = () =>`): `try { return !!P && cfDiaOn(P.cf); } catch (e) { return false; }` (P is not yet set while the modules are defined).
  - `GM.cf` header (anchor `id: 'cf', get label()`). Before:
    ```js
      id: 'cf', label: 'Cross-frames', title: 'intermediate cross-frames, AASHTO LRFD 6.7.4, 6.9.4.4', rptTitle: 'Cross-Frame Design', rptRef: 'AASHTO LRFD Articles 4.6.2.7, 6.7.4, 6.8, 6.9.4.4, and 6.13.2',
    ```
    After (getters; the cross-frame strings are the old ones, character for character):
    ```js
      id: 'cf', get label() { return cfIsDia() ? 'Diaphragms' : 'Cross-frames'; }, get title() { return cfIsDia() ? 'intermediate and end diaphragms, AASHTO LRFD 6.7.4, 6.10.8, 6.13.2' : 'intermediate cross-frames, AASHTO LRFD 6.7.4, 6.9.4.4'; },
      get rptTitle() { return cfIsDia() ? 'Diaphragm Design' : 'Cross-Frame Design'; }, get rptRef() { return cfIsDia() ? 'AASHTO LRFD Articles 3.4.3.1, 4.6.2.7, 6.7.4, 6.10.8, 6.10.9, and 6.13.2' : 'AASHTO LRFD Articles 4.6.2.7, 6.7.4, 6.8, 6.9.4.4, and 6.13.2'; },
    ```
  - `MODS` (anchor `Object.defineProperties(MODS.cf,`): `MODS.cf.title` and `MODS.cf.rpt` (report section "… checks (all worked)") become getters on `GM.cf` (they were copied once at load). `#mod-sub` (title under the app name), the report cover and front matter use them.
  - `applyMod()` calls new `cfUiSync()` (anchor `function cfUiSync()`): sets the module bar tab `#mtab-cf .mtab-l` and the "Auto-design …" button to `GM.cf.label` when they differ (no DOM change with the cross-frame). Runs on every recompute, so the tab follows the bracing from any module (Design all, auto-design, import).
  - Places that already read `GM.cf.label`/`rptTitle` and now follow it: Summary heading ("Diaphragms: every check is satisfied"), Design all row name (`stat.name`), the auto-design alert title, the report cover (`crTitle()`), the print footer (`crPageCSS`).
  - Girder report chapter (anchor `Object.defineProperty(GR_CHAPS.find(c => c[0] === 'cf'), 1`): chapter name and dialog checkbox from `GM.cf.label`.
  - `CR_META.cf.obj` (report objectives): a diaphragm sentence when the diaphragm is used; the cross-frame sentence unchanged.
  - DXF: sheet title `add(cfDiaOn(P.cf) ? 'DIAPHRAGM DETAILS' : 'CROSS-FRAME DETAILS', dxfCF, …)`; framing-plan tags `dxfNo(C, cfDiaOn(P.cf) ? 'DIAPHRAGM' : 'CROSS-FRAME')` (the sheet number lookup follows the sheet title); export dialog item `['cf', cfDiaOn(P.cf) ? 'Diaphragm' : 'Cross-frame']`; framing plan table "INTERMEDIATE DIAPHRAGM LOCATIONS …"/"DIAPHRAGM LOCATIONS"; girder elevation note "CONNECTION PLATES AT DIAPHRAGMS".
  - Text that points the user to the module: Structural analysis SA4 item note "… in the ${GM.cf.label} module …" (was a fixed string); Deck overhang `scope` becomes a getter with "… in the ${GM.cf.label} module" (other items unchanged); Design all quantity row "Connection plates at intermediate diaphragms" with the diaphragm.
  - Manual: Part list "<b>Cross-frames</b> (Part 15; the tab reads <b>Diaphragms</b> when the diaphragm is the bracing used)"; headings "Diaphragms (Cross-frames)" / "Bracing type (Cross-frames)" → "(Cross-frames module)"; one sentence listing the places that read Diaphragms.
- **Not renamed (generic text, kept):** check titles/notes that say "cross-frame" as a structural member (e.g. CF10 "minimum girder depth for cross-frames", CFD "in place of the cross-frame"), the 3D-view layer toggle "Cross-frames", the input "Minimum girder depth for cross-frames", the wind note "… to the cross-frames", the Design all geometry-conflict text, the Transverse stiffeners module scope text "(use the Cross-frames module)" (TS module not edited by request), and anything in `PL_B64`.
- **§4 callout (code reference list in the report heading):** `rptRef` with the diaphragm: before "AASHTO LRFD Articles 4.6.2.7, 6.7.4, 6.8, 6.9.4.4, and 6.13.2" (the angle articles), after "AASHTO LRFD Articles 3.4.3.1, 4.6.2.7, 6.7.4, 6.10.8, 6.10.9, and 6.13.2" — the articles CFD/CFE already cite (`ref: 'AASHTO LRFD 6.7.4.2, 6.7.4.2.2, 6.10.8, 6.10.9, 6.13.2, 3.4.3.1, 4.6.2.7.1'`), 10th Ed. (2024). Title line likewise. Nothing is computed from them; check case: repro below, report heading reads "Diaphragm Design / AASHTO LRFD Articles 3.4.3.1, …" and every CFD/CFE item is unchanged; default example heading unchanged.
- **Saved data:** none changed (no new key; `P.designAll.stat[].name` is the shown name, as before).

### CF-D11. Elevations show the connection plates   [drawings and DXF only] [no check changed]
- **Where (anchors):**
  - New `cfCP(p)` and `cfCPpts(cp, x0, sg, yb, yt)` before `cfSVG`: the connection plate is the transverse stiffener used as connection plate, welded to the web, **b<sub>s</sub> × t<sub>p</sub> = `cf.sb.bs` × `cf.sb.tsp`** (the module's own "Connection plate width b<sub>s</sub> / thickness t<sub>s</sub>" inputs, the values the β<sub>sec</sub> calculation uses); web t<sub>w</sub> = `cf.sb.tw`; corner clip c from the Transverse stiffeners module's Type B (connection plate) `P.ts.types.B.c` when present, else 1 in (the Cross-frames module has no clip input). Outline: from the web face, b<sub>s</sub> wide, between the flange faces, clipped c × c at both web corners.
  - New `cfDiaFit(R, q, cp, tB, tT)` before `cfDiaSVG`: bolt line `cf.dia.ecc` from the web centerline; edge distance to the plate's free edge = t<sub>w</sub>/2 + b<sub>s</sub> − ecc against e<sub>min</sub> = `R.emin` (cut edge, the value of the CFD bolt-line item); end bolts to the plate ends (flange face + clip); diaphragm end gap `cfDiaGap(q)` = ecc − 1.5 in (≥ 0.5) from the web centerline, as the module assumes; lap = t<sub>w</sub>/2 + b<sub>s</sub> − gap. Items that do not fit are returned and stated (drawing text in red, caption, DXF note), never hidden.
  - `cfDiaSVG(R, end)`: before, a 1/2 in-wide outline strip next to each web; after, the plate polygon (b<sub>s</sub> wide, clips), the plate's free edge as a dashed line through the lapping diaphragm web, the label "Connection plate 5 × 1/2 in (b<sub>s</sub> × t<sub>p</sub>), welded to the web" (end diaphragm: "(bearing stiffener; …)"), dimensions of the bolt line and the diaphragm end from the web centerline, and a red "Check the connection geometry: …" line when `cfDiaFit` reports a misfit.
  - `cfSVG(R)` (cross-frame): it had no plates; now both plates (girder depth `cf.dg` centered on the work points as in the DXF, flange thicknesses from `cf.sb.tt/tc`), the label, web lines over the full plate height, and the S dimension and drawing height moved to clear them.
  - `GM.cf.drawings` captions: plate size and source, clip source, and (when the Transverse stiffeners module's Type B plate differs from b<sub>s</sub> × t<sub>p</sub>) "… is 6 × 1/2 in (different; make them agree)"; diaphragm: bolt line, edge distances, lap, end gap, and "Does not fit: …" in red when applicable; end diaphragm: bearing stiffeners drawn at b<sub>s</sub> × t<sub>p</sub> (size per the Bearing stiffeners module).
  - `dxfCF`: intermediate detail plates `D.pline(ly.cp, cfCPpts(cpD, …), true)` (was `D.rect` 1/2 in wide); end detail with the diaphragm likewise (the cross-frame end detail keeps its 3/4 in bearing stiffener strips); diaphragm outline end `g = cfDiaGap(q)` from the girder centerline (was `tw / 2 + cfDiaGap(q)`, which put the member end 1.5 − t<sub>w</sub>/2 in past the bolt line instead of the 1.5 in the module and the Design all lengths use); notes "CONNECTION PLATES SHOWN SCHEMATICALLY" → "CONNECTION PLATES 5" x 1/2" WELDED TO WEB, CORNER CLIPS 1"" (cross-frame and diaphragm), "DIAPHRAGM END 2" FROM GIRDER WEB CL.", and "CHECK CONNECTION GEOMETRY: …" when it does not fit.
  - Manual "Diaphragms (Cross-frames module)": one sentence on the elevations.
- **Check case (repro: 90 ft simple span, N<sub>b</sub> = 10, S = 48 in, d = 38.88 in, W30x99, 5 bolts at 3 in, ecc = 3.5 in, b<sub>s</sub> × t<sub>p</sub> = 5 × 1/2 in, t<sub>w</sub> = 1/2 in, t<sub>f</sub> = 3/4 (top), 1 1/8 (bottom), c = 1 in, e<sub>min</sub> = 1 1/8 in):** free edge at 0.25 + 5 = 5.25 in; edge distance 5.25 − 3.50 = 1.75 ≥ 1.125 in; bolts at 19.44 ± 6 in: bottom 13.44 − 1.125 − 1 = 11.32 in, top 38.88 − 0.75 − 1 − 25.44 = 11.69 in, governing 11.32 ≥ 1.125; gap = 3.5 − 1.5 = 2.00 in ≥ 0.25 (clear of the web); lap 5.25 − 2.00 = 3.25 in. Fits. With ecc = 6 in: edge 5.25 − 6 = −0.75 → "bolt line 6.00 in from the web is outside the 5 in plate (free edge at 5.25 in)" in the drawing, the caption and the DXF; CFD's items unchanged (all pass; the bolt-line check of CFD covers the web depth, not the plate width — see open items).
- **How verified (CF-D10 and CF-D11):** `node --check` on the inline scripts; headless Chromium, main vs branch. Default example (cross-frame): every module's checks (ids, statuses, items), Summary, Member forces, cross-frame auto-design result, Design all (statuses, quantities, costs, conflicts), autosave and every localStorage key bit-identical (timestamps masked); module bar, title, input panes (HTML), report text other than the drawing: identical; differences only in the cross-frame elevation (plates, height) and the DXF (plate outlines, plate note). Repro (diaphragm): module tab "Diaphragms", title, "Auto-design diaphragms", report "Diaphragm Design", Girder report chapter "Diaphragms", Design all row "Diaphragms", DXF sheet "DIAPHRAGM DETAILS"; CFD/CFE items identical to main; switching `cf.dia.on` back gives "Cross-frames" everywhere (also from another module). Screenshots of both elevations, the misfit case and a render of the DXF detail. Saved data both directions: the same saved diaphragm project loaded in main and branch gives the same `P.cf` after auto-design; no key or format change. No console errors.
- **Other copies:** none.
- **Open items (raised, not changed):**
  1. CFD's bolt-line item checks the bolt row against the diaphragm web depth (d − 2t<sub>f</sub> − 1 in), not against the connection plate width; the plate fit is only shown in the drawings (no check added). Should a connection-plate edge-distance item be added to CFD/CFE?
  2. The module's plate size (`cf.sb.bs`, `cf.sb.tsp`, used by β<sub>sec</sub>) and the Transverse stiffeners module's Type B plate are separate inputs (default example 5 × 1/2 vs 6 × 1/2 in); the caption flags a difference.
  3. The end diaphragm's connection plates are the bearing stiffeners; they are drawn at b<sub>s</sub> × t<sub>p</sub> because the Cross-frames module has no bearing-stiffener size.

### Exact changes (CF-D10, CF-D11): main page (unified diff; the PL_B64 line is not touched)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index 6202c96..6fc90a2 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -2113,3 +2113,3 @@ const MAN = [
 <h3>What this app does</h3>
-<p>GirderDetail designs steel I-girder details in modules chosen at the top of the window. <b>Field splice</b> (Parts 2 through 8) designs bolted field splices to AASHTO LRFD Article 6.13.6. <b>Bearing stiffeners</b> (Parts 10 through 12) checks bearing stiffeners to Article 6.10.11.2 at every bearing of a girder line. <b>Transverse stiffeners</b> (Part 13), <b>Shear connectors</b> (Part 14), <b>Cross-frames</b> (Part 15), <b>Deck overhang</b> (Part 16), and <b>Welds and transitions</b> (Part 17) complete the girder detail package, and <b>Girder section</b> (Part 18) checks the composite girder itself at its critical sections, <b>Fatigue</b> (Part 19) designs and evaluates the fatigue details along the girder, and <b>Distribution factors</b> (Part 20) computes the live and dead load distribution for the whole bridge defined in Preliminary sizing. Every detail module has a <b>Detailing</b> tab (<b>Proportions</b> in the Girder section module) listing its proportion and detailing limits as a checklist (the field splice adds a dimension schedule of plates, fillers, and bolt patterns) and a <b>Report</b> tab with the full calculation document. Choose the module from the list at the top of the window. <b>Preliminary sizing (PlateLine)</b> is the first module: it proportions the girder line, runs the approximate analysis, and has its own manual, projects, and report inside it. Its "Send to GirderDetail" button (Analysis tab) offers to load every detail module at once. The detail modules share one project file and title block; the sizing module keeps its own saved projects. In the field splice module, It covers flange splices with outer and inner splice plates, the web splice with two web plates, slip-critical high-strength bolts, and the detailing rules of Article 6.13.2.6. every load combination is fully worked, every check shows its governing location with the substituted equation, and drawings and a 3D view are generated to scale. Splice sections and approximate demands can be imported from PlateLine.</p>
+<p>GirderDetail designs steel I-girder details in modules chosen at the top of the window. <b>Field splice</b> (Parts 2 through 8) designs bolted field splices to AASHTO LRFD Article 6.13.6. <b>Bearing stiffeners</b> (Parts 10 through 12) checks bearing stiffeners to Article 6.10.11.2 at every bearing of a girder line. <b>Transverse stiffeners</b> (Part 13), <b>Shear connectors</b> (Part 14), <b>Cross-frames</b> (Part 15; the tab reads <b>Diaphragms</b> when the diaphragm is the bracing used), <b>Deck overhang</b> (Part 16), and <b>Welds and transitions</b> (Part 17) complete the girder detail package, and <b>Girder section</b> (Part 18) checks the composite girder itself at its critical sections, <b>Fatigue</b> (Part 19) designs and evaluates the fatigue details along the girder, and <b>Distribution factors</b> (Part 20) computes the live and dead load distribution for the whole bridge defined in Preliminary sizing. Every detail module has a <b>Detailing</b> tab (<b>Proportions</b> in the Girder section module) listing its proportion and detailing limits as a checklist (the field splice adds a dimension schedule of plates, fillers, and bolt patterns) and a <b>Report</b> tab with the full calculation document. Choose the module from the list at the top of the window. <b>Preliminary sizing (PlateLine)</b> is the first module: it proportions the girder line, runs the approximate analysis, and has its own manual, projects, and report inside it. Its "Send to GirderDetail" button (Analysis tab) offers to load every detail module at once. The detail modules share one project file and title block; the sizing module keeps its own saved projects. In the field splice module, It covers flange splices with outer and inner splice plates, the web splice with two web plates, slip-critical high-strength bolts, and the detailing rules of Article 6.13.2.6. every load combination is fully worked, every check shows its governing location with the substituted equation, and drawings and a 3D view are generated to scale. Splice sections and approximate demands can be imported from PlateLine.</p>
 <h3>What this app does NOT do</h3>
@@ -2134,4 +2134,4 @@ const MAN = [
 <h3>Bearing and connection forces; fit condition; routine criteria (SA6)</h3><p>Under the reactions: permanent reaction, jacking 1.3 × permanent (3.4.3.1), Seismic Zone 1 horizontal connection force (3.10.9.2), and minimum support length N (4.7.4.4). SA6 compares the bridge with the NSBA routine-bridge definition, records η = 1.0 (1.3.2.1), and requires the fit condition (6.7.2) when a skew exceeds 20°; the fit condition appears in the drawings' notes and camber table.</p>
-<h3>Diaphragms (Cross-frames)</h3><p>The intermediate bracing is either the cross-frame (angles) or a diaphragm: a channel (C8x11.5 to MC18x42.7) or a rolled W (W18x35 to W36x135), nominal AISC dimensions, fillets neglected (verify). Set it with <b>Intermediate bracing used</b> on the Members tab. With the diaphragm selected it is the design: the angle checks CF1 to CF9 show N/A and check <b>CFD</b> decides the module status, the tab badge, the report, and the Design all row. CFD checks the depth against 0.75 of the girder depth d (6.7.4.2, plate girders; a warning, as the article says "should"), the torsional brace stiffness with β<sub>br</sub> = 6EI<sub>x</sub>/S (6.7.4.2.2), the brace moment against φM<sub>n</sub> (6.10.8, L<sub>b</sub> = S, C<sub>b</sub> = 1.0; for a channel an approximation), shear, jacking flexure and shear (when on), wind, and the bolted connection (one vertical row through the web, eccentric shear and moment), plus the bolt pitch and the fit of the bolt row in the web. <b>Wind:</b> the bottom-flange wind force F<sub>w</sub> the module already derives for the cross-frame (governing Strength III or V, 4.6.2.7.1) acts with the lever arm d to the deck: M<sub>w</sub> = F<sub>w</sub>d is the diaphragm end moment, with shear 2M<sub>w</sub>/S, and the bolts also take F<sub>w</sub> horizontally (a simplified model to verify; axial force in the diaphragm is not combined with flexure). Assumed details (verify): web bolted to the connection plate, diaphragm centered on the girder depth, member ends 1.5 in past the bolt line. <b>End (bearing-line) diaphragms:</b> with the diaphragm used, the end frames are diaphragms too (check <b>CFE</b>; inputs "End diaphragm shape" and "End diaphragm bolts per end", blank = same as the intermediate). Auto-design starts from the intermediate section and goes to heavier sections at least as deep, with the fewest bolts, until every CFE item passes. CFE checks the depth, jacking flexure, shear and bolts (3.4.3.1, with "Jacking at the end diaphragms" on and the jacking reaction entered; the Structural analysis module lists 1.3 × permanent per support), and the same brace moment and wind force per frame as the intermediate diaphragm; the jacking items are no longer applied to the intermediate diaphragm. Not checked (verify): superstructure wind and seismic forces carried to the bearings through the end diaphragms, and the torsional bracing stiffness at the supports. The drawings, 3D view, DXF (framing plan tags and the end detail along the skew) show the end diaphragms, and Design all counts them (length S/cos θ of the largest skew less the end gaps) with their bolts.</p>
-<h3>Bracing type (Cross-frames)</h3><p><b>CF10</b> recommends the intermediate bracing type from the girder depth d (out-to-out of the flanges, the "Girder depth d" input, not the web depth): at or above the <b>Minimum girder depth for cross-frames</b> (default 48 in; common practice, e.g. AISC/NSBA G13.1 guidance; owner standards govern; verify) a cross-frame (X or K by S/h, as the auto-design chooses), below it the lightest channel at least 0.75 d deep, or else the lightest rolled W at least 0.75 d deep. A cross-frame on a girder below the minimum gives a warning, not a failure. Auto-design selects the type: below the minimum it switches to the diaphragm and picks the lightest channel, then W, at least 0.75 d deep that passes every CFD item, with the fewest bolts (one row, pitch 3 in or 3d); at or above the minimum it designs the cross-frame and switches a diaphragm back. Double-click the <b>Intermediate bracing used</b> label to lock the choice (and the shape, bolt count, or pitch labels to lock those). Preliminary sizing sends its own minimum (Framing tab) with the cross-frame geometry, and its Suggest tab states the recommendation. Design all counts the diaphragm steel (S less the end gaps, times the weight per foot from the nominal area) and its bolts in place of the angles.</p>
+<h3>Diaphragms (Cross-frames module)</h3><p>The intermediate bracing is either the cross-frame (angles) or a diaphragm: a channel (C8x11.5 to MC18x42.7) or a rolled W (W18x35 to W36x135), nominal AISC dimensions, fillets neglected (verify). Set it with <b>Intermediate bracing used</b> on the Members tab. With the diaphragm selected it is the design, and the module is named for it: the module tab, its title, the calculation report ("Diaphragm Design"), the Design all row, the Girder report chapter, and the DXF sheet ("DIAPHRAGM DETAILS") read <b>Diaphragms</b> (with the cross-frame they read Cross-frames, as before; the module, its saved data, and its keys are the same). The angle checks CF1 to CF9 show N/A and check <b>CFD</b> decides the module status, the tab badge, the report, and the Design all row. CFD checks the depth against 0.75 of the girder depth d (6.7.4.2, plate girders; a warning, as the article says "should"), the torsional brace stiffness with β<sub>br</sub> = 6EI<sub>x</sub>/S (6.7.4.2.2), the brace moment against φM<sub>n</sub> (6.10.8, L<sub>b</sub> = S, C<sub>b</sub> = 1.0; for a channel an approximation), shear, jacking flexure and shear (when on), wind, and the bolted connection (one vertical row through the web, eccentric shear and moment), plus the bolt pitch and the fit of the bolt row in the web. <b>Wind:</b> the bottom-flange wind force F<sub>w</sub> the module already derives for the cross-frame (governing Strength III or V, 4.6.2.7.1) acts with the lever arm d to the deck: M<sub>w</sub> = F<sub>w</sub>d is the diaphragm end moment, with shear 2M<sub>w</sub>/S, and the bolts also take F<sub>w</sub> horizontally (a simplified model to verify; axial force in the diaphragm is not combined with flexure). Assumed details (verify): web bolted to the connection plate, diaphragm centered on the girder depth, member ends 1.5 in past the bolt line. <b>Elevations:</b> the connection plates are drawn welded to the girder web between the flanges, b<sub>s</sub> × t<sub>p</sub> from the connection plate inputs of the stability bracing (the values β<sub>sec</sub> uses), with the corner clip of the Transverse stiffeners module's Type B; the diaphragm web laps the plate and the bolt row passes through it. The caption gives the edge distance from the bolt line to the plate's free edge and to the plate ends (against e<sub>min</sub>) and the diaphragm end gap; a bolt row that does not fit the plate is stated in the drawing, the caption, and the DXF note. <b>End (bearing-line) diaphragms:</b> with the diaphragm used, the end frames are diaphragms too (check <b>CFE</b>; inputs "End diaphragm shape" and "End diaphragm bolts per end", blank = same as the intermediate). Auto-design starts from the intermediate section and goes to heavier sections at least as deep, with the fewest bolts, until every CFE item passes. CFE checks the depth, jacking flexure, shear and bolts (3.4.3.1, with "Jacking at the end diaphragms" on and the jacking reaction entered; the Structural analysis module lists 1.3 × permanent per support), and the same brace moment and wind force per frame as the intermediate diaphragm; the jacking items are no longer applied to the intermediate diaphragm. Not checked (verify): superstructure wind and seismic forces carried to the bearings through the end diaphragms, and the torsional bracing stiffness at the supports. The drawings, 3D view, DXF (framing plan tags and the end detail along the skew) show the end diaphragms, and Design all counts them (length S/cos θ of the largest skew less the end gaps) with their bolts.</p>
+<h3>Bracing type (Cross-frames module)</h3><p><b>CF10</b> recommends the intermediate bracing type from the girder depth d (out-to-out of the flanges, the "Girder depth d" input, not the web depth): at or above the <b>Minimum girder depth for cross-frames</b> (default 48 in; common practice, e.g. AISC/NSBA G13.1 guidance; owner standards govern; verify) a cross-frame (X or K by S/h, as the auto-design chooses), below it the lightest channel at least 0.75 d deep, or else the lightest rolled W at least 0.75 d deep. A cross-frame on a girder below the minimum gives a warning, not a failure. Auto-design selects the type: below the minimum it switches to the diaphragm and picks the lightest channel, then W, at least 0.75 d deep that passes every CFD item, with the fewest bolts (one row, pitch 3 in or 3d); at or above the minimum it designs the cross-frame and switches a diaphragm back. Double-click the <b>Intermediate bracing used</b> label to lock the choice (and the shape, bolt count, or pitch labels to lock those). Preliminary sizing sends its own minimum (Framing tab) with the cross-frame geometry, and its Suggest tab states the recommendation. Design all counts the diaphragm steel (S less the end gaps, times the weight per foot from the nominal area) and its bolts in place of the angles.</p>
 <h3>Live load: vehicles and what controls (SA5)</h3><p>At every analysis point the HL-93 design truck (rear axle spacing varied from 14 to 30 ft in 1 ft steps, both directions) and design tandem are moved across the influence line, each with IM, and combined with the design lane load; in negative moment regions and for interior reactions, 90% of two design trucks plus 90% of the lane load is also evaluated. The Combinations tab card <b>Live load: vehicles evaluated and what controls</b> shows, at tenth points, each vehicle's moment per lane, the controlling truck spacing, which combination controls, the distribution factor, and the girder LL+IM; its chart shows every vehicle along the girder. The fatigue table gives the fatigue truck (30 ft rear spacing, IM 15%, one truck) range per lane, the fatigue distribution factor (single-lane ÷ 1.2), the girder range, and the Fatigue I range (× 1.75). Check SA5 records what was evaluated and how often each vehicle controls.</p>
@@ -2661,2 +2661,4 @@ function cfDiaSec(q) {
 const cfDiaOn = p => ((p || {}).dia || {}).on === 'yes';
+/* the current project uses the diaphragm (module name, labels, and which content is shown; 2026-10-13). P is not yet set while the modules are being defined */
+const cfIsDia = () => { try { return !!P && cfDiaOn(P.cf); } catch (e) { return false; } };
 /* end of the diaphragm from each girder web: the bolt line (cf.dia.ecc) less a 1.5 in end distance (assumption for quantities and drawings) */
@@ -2698,4 +2700,6 @@ function cfDiaChecks(R, out, end) {   // end: the end (bearing-line) diaphragm,
 GM.cf = {
+// the module's name follows the bracing used (engineer's request 2026-10-13): "Diaphragms" when cf.dia.on = 'yes', else "Cross-frames" exactly as before; id, keys and saved data unchanged
 tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
-  id: 'cf', label: 'Cross-frames', title: 'intermediate cross-frames, AASHTO LRFD 6.7.4, 6.9.4.4', rptTitle: 'Cross-Frame Design', rptRef: 'AASHTO LRFD Articles 4.6.2.7, 6.7.4, 6.8, 6.9.4.4, and 6.13.2',
+  id: 'cf', get label() { return cfIsDia() ? 'Diaphragms' : 'Cross-frames'; }, get title() { return cfIsDia() ? 'intermediate and end diaphragms, AASHTO LRFD 6.7.4, 6.10.8, 6.13.2' : 'intermediate cross-frames, AASHTO LRFD 6.7.4, 6.9.4.4'; },
+  get rptTitle() { return cfIsDia() ? 'Diaphragm Design' : 'Cross-Frame Design'; }, get rptRef() { return cfIsDia() ? 'AASHTO LRFD Articles 3.4.3.1, 4.6.2.7, 6.7.4, 6.10.8, 6.10.9, and 6.13.2' : 'AASHTO LRFD Articles 4.6.2.7, 6.7.4, 6.8, 6.9.4.4, and 6.13.2'; },
   groups: ['Members', 'Connections', 'Bracing type'], itabs: [['cf_geo', 'Geometry and loads'], ['cf_mem', 'Members']],
@@ -2878,5 +2882,7 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
     return h; },
-  drawings(R) { if (cfDiaOn(R.p)) return card('dw-cf', 'Diaphragm elevation', 'To scale; nominal dimensions', `<div class="dwg-wrap">${cfDiaSVG(R)}</div><p class="cap">Diaphragm centered on the girder depth, web bolted to the connection plates with one vertical row of bolts (assumed detail; verify). F<sub>w</sub>: governing Strength III or V wind force at the exterior girder bottom flange.</p>`)
-      + card('dw-cfe', 'End diaphragm elevation (bearing lines)', 'To scale; nominal dimensions; normal to the girders', `<div class="dwg-wrap">${cfDiaSVG(R, true)}</div><p class="cap">End diaphragm at the bearing lines (check CFE); bearing stiffeners serve as the connection plates. Along a skewed bearing line the diaphragm is longer by 1/cos θ (DXF end detail).</p>`);
-    return card('dw-cf', 'Cross-frame elevation', 'To scale; Strength III wind forces', `<div class="dwg-wrap">${cfSVG(R)}</div><p class="cap">Force labels: Strength III wind force per member (tension +) for wind toward the interior girder.</p>`); },
+  drawings(R) { const cp = cfCP(R.p), cpTxt = `Connection plates ${frac(cp.bs)} × ${frac(cp.tp)} in (b<sub>s</sub> × t<sub>p</sub>: the connection plate width and thickness of the Stability bracing inputs, the values β<sub>sec</sub> uses), welded to the girder web between the flanges, corner clips ${frac(cp.c)} in (${cp.tsB ? 'Transverse stiffeners module, Type B' : 'assumed'})${cp.tsB && (Math.abs(cp.tsB.bt - cp.bs) > 1e-9 || Math.abs(cp.tsB.tp - cp.tp) > 1e-9) ? `; the Transverse stiffeners module's Type B connection plate is ${frac(cp.tsB.bt)} × ${frac(cp.tsB.tp)} in (different; make them agree)` : ''}.`;
+    if (cfDiaOn(R.p)) { const tB = R.SB ? R.SB.tt : 1, tT = R.SB ? R.SB.tc : 0.75, fit = q => { const G = cfDiaFit(R, q, cp, tB, tT); return ` Bolt line ${f2(G.ecc)} in from the web centerline: ${f2(G.edge)} in to the plate's free edge (e<sub>min</sub> = ${frac(G.em)} in), end bolts ${f2(G.vEdge)} in from the plate ends; the diaphragm web laps the plate ${f2(G.lap)} in, its end ${f2(G.gap)} in from the web centerline (bolt line less 1.5 in, as the module assumes).${G.bad.length ? ` <b style="color:#c0392b">Does not fit: ${G.bad.join('; ')}.</b>` : ''}`; };
+      return card('dw-cf', 'Diaphragm elevation', 'To scale; nominal dimensions', `<div class="dwg-wrap">${cfDiaSVG(R)}</div><p class="cap">Diaphragm centered on the girder depth, web bolted to the connection plates with one vertical row of bolts (assumed detail; verify). ${cpTxt}${fit(R.p.dia)} F<sub>w</sub>: governing Strength III or V wind force at the exterior girder bottom flange.</p>`)
+      + card('dw-cfe', 'End diaphragm elevation (bearing lines)', 'To scale; nominal dimensions; normal to the girders', `<div class="dwg-wrap">${cfDiaSVG(R, true)}</div><p class="cap">End diaphragm at the bearing lines (check CFE); bearing stiffeners serve as the connection plates, drawn here at the connection plate size b<sub>s</sub> × t<sub>p</sub> (the bearing stiffener size is set in the Bearing stiffeners module).${fit(cfDiaEnd(R.p.dia))} Along a skewed bearing line the diaphragm is longer by 1/cos θ (DXF end detail).</p>`); }
+    return card('dw-cf', 'Cross-frame elevation', 'To scale; Strength III wind forces', `<div class="dwg-wrap">${cfSVG(R)}</div><p class="cap">Force labels: Strength III wind force per member (tension +) for wind toward the interior girder. ${cpTxt} Girder depth d centered on the work points.</p>`); },
   echo(R) { return { kv: [['Type', { X: 'X-frame', Kb: 'K-frame, diagonals meet at the bottom chord', Kt: 'K-frame, diagonals meet at the top chord' }[R.p.type]], ['S / h / d / L_b', `${f2(R.S)} in / ${f2(R.h)} in / ${f2(nm(R.p.dg))} in / ${f2(R.Lb)} ft`], ['Wind V, K_z, G, C_D', `${f0(nm(R.p.wind.V))} mph, ${R.p.wind.Kz}, ${R.p.wind.G}, ${R.p.wind.Cd}`], ['Grades: angles / gusset', `${R.p.gA} / ${R.p.gG}`],
@@ -2897,5 +2903,18 @@ function cfTypeRec(p) {
 }
+/* connection plates in the elevations (display only; engineer's request 2026-10-13): the transverse stiffener used as connection plate, welded to the girder web,
+   width b_s and thickness t_s from the module's own inputs (cf.sb.bs, cf.sb.tsp: the values the beta_sec calculation uses); corner clip c from the Transverse
+   stiffeners module's Type B (connection plate) when it has one, else 1 in. Web thickness t_w from cf.sb.tw. */
+function cfCP(p) {
+  const sb = (p && p.sb) || {}, bs = nm(sb.bs) > 0 ? nm(sb.bs) : 5, tp = nm(sb.tsp) > 0 ? nm(sb.tsp) : 0.5, tw = nm(sb.tw) > 0 ? nm(sb.tw) : 0.5;
+  let tsB = null; try { tsB = P && P.ts && P.ts.types && P.ts.types.B; } catch (e) {}
+  return { bs, tp, tw, c: tsB && +tsB.c > 0 ? +tsB.c : 1, tsB: tsB && +tsB.bt > 0 ? { bt: +tsB.bt, tp: +tsB.tp } : null };
+}
+/* plate outline at the girder web x0 (sg = +1: plate to the right of the web), between the flange faces yb (top of bottom flange) and yt, clipped at the web corners */
+const cfCPpts = (cp, x0, sg, yb, yt) => [[x0 + sg * cp.tw / 2, yb + cp.c], [x0 + sg * (cp.tw / 2 + cp.c), yb], [x0 + sg * (cp.tw / 2 + cp.bs), yb], [x0 + sg * (cp.tw / 2 + cp.bs), yt], [x0 + sg * (cp.tw / 2 + cp.c), yt], [x0 + sg * cp.tw / 2, yt - cp.c]];
 function cfSVG(R) {
-  const Wpx = 900, sc = Math.min(700 / R.S, 360 / R.h), X = x => 100 + x * sc, Y = y => 40 + (R.h - y) * sc; let o = '';
-  [0, R.S].forEach(x => o += `<path d="M${X(x)} ${Y(R.h) - 20}V${Y(0) + 20}" stroke="${DC.stlS}" stroke-width="4"/>`);
+  const Wpx = 900, sc = Math.min(700 / R.S, 360 / R.h), cp = cfCP(R.p), dg = nm(R.p.dg) > 0 ? nm(R.p.dg) : R.h, sb = R.p.sb || {}, tB = nm(sb.tt) > 0 ? nm(sb.tt) : 1, tT = nm(sb.tc) > 0 ? nm(sb.tc) : 0.75;
+  const yb = (R.h - dg) / 2 + tB, yt = (R.h + dg) / 2 - tT, ext = Math.max(0, -yb * sc, (yt - R.h) * sc), X = x => 100 + x * sc, Y = y => 40 + ext + (R.h - y) * sc; let o = '';   // girder centered on the work points (as in the DXF)
+  [0, R.S].forEach((x, i) => o += `<polygon points="${cfCPpts(cp, x, i ? -1 : 1, yb, yt).map(([u, v]) => `${X(u)},${Y(v)}`).join(' ')}" fill="${DC.pl}" stroke="${DC.plS}" stroke-width="1"/>`);
+  o += `<text x="${X(cp.tw / 2 + cp.bs) + 6}" y="${Y(yt) + 12}" class="sv-t sv-sm">Connection plate ${frac(cp.bs)} × ${frac(cp.tp)} in</text>`;
+  [0, R.S].forEach(x => o += `<path d="M${X(x)} ${Math.min(Y(R.h) - 20, Y(yt))}V${Math.max(Y(0) + 20, Y(yb))}" stroke="${DC.stlS}" stroke-width="4"/>`);
   const w = R.combos.find(c => c.id === 'StrIII');
@@ -2906,6 +2925,17 @@ function cfSVG(R) {
   o += `<path d="M${X(0) - 70} ${Y(0)}H${X(0) - 8}" stroke="#c0392b" stroke-width="2" marker-end="url(#ar)"/><text x="${X(0) - 70}" y="${Y(0) - 8}" class="sv-t sv-sm">F<tspan baseline-shift="sub" font-size="8">w</tspan> = ${f2(w.wind)} kip</text>`;
-  o += dimH(X(0), X(R.S), Y(0) + 34, `S = ${f2(R.S)} in`) + dimV(X(R.S) + 30, Y(R.h), Y(0), `h = ${f2(R.h)} in`, false);
-  return `<svg viewBox="0 0 ${Wpx} ${Y(0) + 60}" class="dwg" role="img" aria-label="Cross-frame"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#c0392b"/></marker></defs>${o}</svg>`;
+  o += dimH(X(0), X(R.S), Y(0) + 34 + Math.max(0, -yb * sc), `S = ${f2(R.S)} in`) + dimV(X(R.S) + 30, Y(R.h), Y(0), `h = ${f2(R.h)} in`, false);
+  return `<svg viewBox="0 0 ${Wpx} ${Y(0) + 60 + ext}" class="dwg" role="img" aria-label="Cross-frame"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#c0392b"/></marker></defs>${o}</svg>`;
 }
 
+/* connection-plate geometry of the diaphragm (display only, 2026-10-13): bolt row ecc from the girder web centerline within the plate width with the
+   module's edge distance e_min (cut edge, as the CFD bolt-line item), the end bolts within the plate height, and the diaphragm end (cfDiaGap = ecc − 1.5 in)
+   clear of the girder web. Returns the values and the items that do not fit (stated in the drawing; nothing is hidden). */
+function cfDiaFit(R, q, cp, tB, tT) {
+  const dg = nm(R.p.dg), ecc = +q.ecc || 3.5, nb = Math.max(2, Math.round(+q.nb || 2)), s = +q.pitch || 3, em = R.emin, gap = cfDiaGap(q), bad = [];
+  const edge = cp.tw / 2 + cp.bs - ecc, yEnd = dg / 2 - (nb - 1) / 2 * s, vEdge = Math.min(yEnd - tB - cp.c, dg - tT - cp.c - (dg / 2 + (nb - 1) / 2 * s)), lap = cp.tw / 2 + cp.bs - gap;
+  if (edge < em - 1e-9) bad.push(edge < 0 ? `bolt line ${f2(ecc)} in from the web is outside the ${frac(cp.bs)} in plate (free edge at ${f2(cp.tw / 2 + cp.bs)} in)` : `edge distance to the plate's free edge ${f2(edge)} in < ${frac(em)} in`);
+  if (vEdge < em - 1e-9) bad.push(`end bolt to the plate end (clip) ${f2(vEdge)} in < ${frac(em)} in`);
+  if (gap < cp.tw / 2 + 1e-9) bad.push(`diaphragm end ${f2(gap)} in from the web centerline reaches the web`);
+  return { ecc, edge, vEdge, lap, gap, em, bad };
+}
 /* diaphragm elevation (cf.dia.on = 'yes'): channel or W centered on the girder depth, web bolted to the connection plates with one vertical row */
@@ -2916,8 +2946,14 @@ function cfDiaSVG(R, end) {
   const wk = R.W.III.Fw >= R.W.V.Fw ? 'III' : 'V', Fw = R.W[wk].Fw; let o = '';
+  const cp = cfCP(R.p), G = cfDiaFit(R, q, cp, tB, tT);
+  const fb = (Yp(0) - ft(tB)), fT = (Yp(dg) + ft(tT)), Yi = py => Yp(0) - (py * sc);   // plate drawn between the flange faces as drawn (flange thickness shown at least 3 px)
   [0, S].forEach((x, i) => { const sg = i ? -1 : 1;
     o += `<rect x="${Xp(x - bfB / 2)}" y="${Yp(0) - ft(tB)}" width="${bfB * sc}" height="${ft(tB)}" fill="${DC.stl}" stroke="${DC.stlS}" stroke-width="1.5"/><rect x="${Xp(x - bfT / 2)}" y="${Yp(dg)}" width="${bfT * sc}" height="${ft(tT)}" fill="${DC.stl}" stroke="${DC.stlS}" stroke-width="1.5"/>`;
-    o += `<path d="M${Xp(x)} ${Yp(dg)}V${Yp(0)}" stroke="${DC.stlS}" stroke-width="3"/><rect x="${Math.min(Xp(x), Xp(x + sg * 0.5))}" y="${Yp(dg) + ft(tT)}" width="${Math.max(2, 0.5 * sc)}" height="${Yp(0) - Yp(dg) - ft(tT) - ft(tB)}" fill="none" stroke="${DC.plS}" stroke-width="1"/>`; });
+    o += `<polygon points="${cfCPpts(cp, x, sg, (Yp(0) - fb) / sc, (Yp(0) - fT) / sc).map(([u, v]) => `${Xp(u)},${Yi(v)}`).join(' ')}" fill="${DC.pl}" stroke="${DC.plS}" stroke-width="1"/>`;
+    o += `<path d="M${Xp(x)} ${Yp(dg)}V${Yp(0)}" stroke="${DC.stlS}" stroke-width="3"/>`; });
   o += `<rect x="${Xp(gap)}" y="${Yp(y1)}" width="${(S - 2 * gap) * sc}" height="${X.d * sc}" fill="${DC.inn}" fill-opacity="0.6" stroke="${DC.innS}" stroke-width="2"/>`;
   [y0 + X.tf, y1 - X.tf].forEach(y => o += `<path d="M${Xp(gap)} ${Yp(y)}H${Xp(S - gap)}" stroke="${DC.innS}" stroke-width="1"/>`);
+  [0, S].forEach((x, i) => { const sg = i ? -1 : 1, xe = Xp(x + sg * (cp.tw / 2 + cp.bs)); o += `<path d="M${xe} ${fT}V${fb}" stroke="${DC.plS}" stroke-width="1.2" stroke-dasharray="5 3"/>`; });   // plate free edge, through the diaphragm web that laps it
   [ecc, S - ecc].forEach(x => { for (let i = 0; i < nb; i++) o += `<circle cx="${Xp(x)}" cy="${Yp(dg / 2 + (i - (nb - 1) / 2) * s)}" r="${rb}" fill="${DC.bolt}"/>`; });
+  { const xl = Xp(S - cp.tw / 2 - cp.bs / 2), yl = fT + 4; o += `<path d="M${xl} ${yl}L${xl - 30} ${Yp(dg) - 12}" stroke="${DC.plS}" stroke-width=".8"/><text x="${xl - 33}" y="${Yp(dg) - 14}" class="sv-t sv-sm" text-anchor="end" fill="${DC.plS}">Connection plate ${frac(cp.bs)} × ${frac(cp.tp)} in (${end ? 'bearing stiffener; ' : ''}b<tspan baseline-shift="sub" font-size="8">s</tspan> × t<tspan baseline-shift="sub" font-size="8">p</tspan>), welded to the web</text>`; }
+  o += dimH(Xp(0), Xp(ecc), Yp(dg) - 26, `${f2(ecc)}`) + dimH(Xp(0), Xp(gap), Yp(dg) - 9, `${f2(gap)}`);   // bolt line and diaphragm end from the web centerline
   o += `<text x="${Xp(S / 2)}" y="${Yp(dg / 2) + 4}" class="sv-t" text-anchor="middle" style="paint-order:stroke;stroke:#fff;stroke-width:4px">${X.chS ? 'Channel' : 'Rolled'} ${end ? 'end ' : ''}diaphragm ${X.nm_}; ${nb} bolts per end at ${f2(s)} in</text>`;
@@ -2925,3 +2961,4 @@ function cfDiaSVG(R, end) {
   o += dimH(Xp(0), Xp(S), Yp(0) + 34, `S = ${f2(S)} in`) + dimV(Xp(S) + 40, Yp(y1), Yp(y0), `d = ${f2(X.d)} in`, false) + dimV(Xp(S) + 110, Yp(dg), Yp(0), `girder d = ${f2(dg)} in`, false);
-  return `<svg viewBox="0 0 ${Wpx} ${Yp(0) + 60}" class="dwg" role="img" aria-label="Diaphragm"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#c0392b"/></marker></defs>${o}</svg>`;
+  if (G.bad.length) o += `<text x="${Xp(0)}" y="${Yp(0) + 56}" class="sv-t sv-sm" style="fill:#c0392b;font-weight:600">Check the connection geometry: ${G.bad.join('; ')}</text>`;
+  return `<svg viewBox="0 0 ${Wpx} ${Yp(0) + 60 + (G.bad.length ? 16 : 0)}" class="dwg" role="img" aria-label="Diaphragm"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#c0392b"/></marker></defs>${o}</svg>`;
 }
@@ -2992,3 +3029,3 @@ tabs: { combos: 'Bracket loads', rptCombos: 'Bracket loads and flange lateral be
   kq(R) { return [['Bracket load w<sub>u</sub>', `${f3(R.wu)} kip/ft`], ['Lateral force F<sub>ℓ</sub>', `${f3(R.Fl)} kip/ft + ${f2(R.Pl)} kip`], ['Bracket slope a/h<sub>b</sub>', f3(R.tana)], ['Locations', String(R.rows.length)]]; },
-  scope: ['Torsion of the exterior girder and the resulting cross-frame forces (use analysis forces in the Cross-frames module)', 'Staged deck placement sequences (enter the governing moment for each location)', 'Bracket and hanger design (contractor)', 'Interior girders'],
+  get scope() { return [`Torsion of the exterior girder and the resulting cross-frame forces (use analysis forces in the ${GM.cf.label} module)`, 'Staged deck placement sequences (enter the governing moment for each location)', 'Bracket and hanger design (contractor)', 'Interior girders']; },   // module name follows the bracing used (2026-10-13)
   combos(R) { const L = R.L; let h = card('cb-l', 'Bracket loads and flange lateral bending', 'AASHTO LRFD 3.4.2.1, C6.10.3.4', `<div class="tscroll"><table class="tbl"><thead><tr><th>Load</th><th class="right">w (kip/ft)</th><th class="right">γ</th><th class="right">γw (kip/ft)</th></tr></thead><tbody>
@@ -4446,3 +4483,3 @@ tabs: { combos: 'Results', cap: 'Method', drawings: 'Diagrams', rptCombos: 'Anal
       if (th > 20 + 1e-9) {
-        it('Cross-frame live-load forces', `skew ${f2(th)}° > 20°`, 'warn', 'Not computed by a line-girder analysis: enter cross-frame forces from a refined analysis in the Cross-frames module, or confirm by the connectivity index of 4.6.3.3.2 that it is not required');
+        it('Cross-frame live-load forces', `skew ${f2(th)}° > 20°`, 'warn', `Not computed by a line-girder analysis: enter cross-frame forces from a refined analysis in the ${GM.cf.label} module, or confirm by the connectivity index of 4.6.3.3.2 that it is not required`);
         it('Flange lateral bending from skew', `skew ${f2(th)}° > 20°`, 'warn', 'Not computed by a line-girder analysis: estimated per C6.10.1 (10.0 ksi interior, 7.5 ksi exterior, unfactored) and sent to the Girder section module with the load factor set in Preliminary sizing (Limits)');
@@ -4903,2 +4940,4 @@ Object.values(GM).forEach(m => { MODS[m.id] = { title: m.title, groups: m.groups
   rpt: [['summary', 'Summary'], ['combos', 'Load combinations and demands'], ['checks', `${m.label} checks (all worked)`], ['drawings', 'Drawings'], ['manual', 'User manual (design basis)']] }; });
+// Cross-frames module: title and report section names follow the bracing used ("Diaphragms" with the diaphragm; 2026-10-13)
+Object.defineProperties(MODS.cf, { title: { get: () => GM.cf.title, enumerable: true }, rpt: { get: () => [['summary', 'Summary'], ['combos', 'Load combinations and demands'], ['checks', `${GM.cf.label} checks (all worked)`], ['drawings', 'Drawings'], ['manual', 'User manual (design basis)']], enumerable: true } });
 function gmRowsHtml(id, which) {
@@ -5352,3 +5391,3 @@ function designAllRun0(j, quiet) {
   const ty = P.ts.types, cpT = ty.B || Object.values(ty)[0], stT = ty.A || cpT, nCP = Math.max(0, (q.frames || 0) - (q.framesSup || 0)) * 2, cpLb = nCP * parseDim(cpT.bt) * parseDim(cpT.tp) * D * lbS * (cpT.sides === '2' ? 2 : 1);
-  add('Connection plates at intermediate cross-frames', nCP, 'each', cpLb * S.cDet);
+  add(`Connection plates at intermediate ${cfDiaOn(P.cf) ? 'diaphragms' : 'cross-frames'}`, nCP, 'each', cpLb * S.cDet);
   const nSt = (q.stiffPerGirder || 0) * nb, stLb = nSt * parseDim(stT.bt) * parseDim(stT.tp) * D * lbS * (stT.sides === '2' ? 2 : 1); if (nSt) add('Intermediate transverse stiffeners', nSt, 'each', stLb * S.cDet);
@@ -5400,2 +5439,3 @@ const GR_CHAPS = [['geo', 'Bridge and girder geometry'], ['df', 'Loads and live
   ['fa', 'Fatigue details'], ['splice', 'Field splices'], ['bstf', 'Bearing stiffeners'], ['ts', 'Transverse stiffeners and connection plates'], ['sc', 'Shear connectors'], ['cf', 'Cross-frames'], ['oh', 'Deck overhang (exterior girders)'], ['wt', 'Web-to-flange welds and transitions']];
+Object.defineProperty(GR_CHAPS.find(c => c[0] === 'cf'), 1, { get: () => GM.cf.label });   // chapter name follows the bracing used ("Diaphragms" with the diaphragm; 2026-10-13)
 let GR_RUN = null;
@@ -5604,4 +5644,4 @@ function dxfPlan(D, C) {
   { const f = FR.frames.find(q => q.type !== 'sup' && q.bay === 0), fe = FR.frames.find(q => q.type === 'sup' && q.bay === 0);
-    if (f) dxfTag(D, ly.t, X((f.xa + f.xc) / 2), Y((FR.ys[0] + FR.ys[1]) / 2), 'X', `INTERMEDIATE ${cfDiaOn(P.cf) ? 'DIAPHRAGM' : 'CROSS-FRAME'}, ${dxfNo(C, 'CROSS-FRAME')}`);
-    if (fe) dxfTag(D, ly.t, X((fe.xa + fe.xc) / 2), Y((FR.ys[0] + FR.ys[1]) / 2), 'E', `END ${cfDiaOn(P.cf) ? 'DIAPHRAGM' : 'CROSS-FRAME'}, ${dxfNo(C, 'CROSS-FRAME')}`, -1, 1); }
+    if (f) dxfTag(D, ly.t, X((f.xa + f.xc) / 2), Y((FR.ys[0] + FR.ys[1]) / 2), 'X', `INTERMEDIATE ${cfDiaOn(P.cf) ? 'DIAPHRAGM' : 'CROSS-FRAME'}, ${dxfNo(C, cfDiaOn(P.cf) ? 'DIAPHRAGM' : 'CROSS-FRAME')}`);
+    if (fe) dxfTag(D, ly.t, X((fe.xa + fe.xc) / 2), Y((FR.ys[0] + FR.ys[1]) / 2), 'E', `END ${cfDiaOn(P.cf) ? 'DIAPHRAGM' : 'CROSS-FRAME'}, ${dxfNo(C, cfDiaOn(P.cf) ? 'DIAPHRAGM' : 'CROSS-FRAME')}`, -1, 1); }
   D.text(ly.t, xMin, Y(wid) + 14 * h, h * 1.6, 'FRAMING PLAN');
@@ -5613,3 +5653,3 @@ function dxfPlan(D, C) {
   const cfRows = FR.girders.map((g, i) => { const xs = FR.frames.filter(f => f.type !== 'sup' && (f.bay === i || f.bay === i - 1)).map(f => (f.bay === i ? f.xa : f.xc) - g.x0 - g.bear[0]).sort((a, b) => a - b); return [`G${i + 1}`, xs.map(v => dxfFI(X(v))).join(', ')]; });
-  const t2 = dxfTable(D, ly.tb, x0, t1.y - h, ['GIRDER', 'INTERMEDIATE CROSS-FRAME LOCATIONS FROM CL BRG. ABUT. 1, ALONG GIRDER'], cfRows, 'CROSS-FRAME LOCATIONS');
+  const t2 = dxfTable(D, ly.tb, x0, t1.y - h, ['GIRDER', `INTERMEDIATE ${cfDiaOn(P.cf) ? 'DIAPHRAGM' : 'CROSS-FRAME'} LOCATIONS FROM CL BRG. ABUT. 1, ALONG GIRDER`], cfRows, cfDiaOn(P.cf) ? 'DIAPHRAGM LOCATIONS' : 'CROSS-FRAME LOCATIONS');
 }
@@ -5645,3 +5685,3 @@ function dxfElev(D, C) {
   D.text(ly.t, 0, yB + Dw + tmax + 16 * h, h * 1.6, `${one ? `GIRDER G${gi + 1} ELEVATION (${gi === 0 || gi === m.nb - 1 ? 'EXTERIOR' : 'INTERIOR'}; BEARINGS, CONNECTION PLATES AND CAMBER OF THIS GIRDER)` : 'GIRDER ELEVATION (TYPICAL, SHOWN ALONG G1)'}${v !== 1 ? ` - VERTICAL SCALE x${v}` : ''}`);
-  D.text(ly.t, 0, yB + Dw + tmax + 14.2 * h, h * 0.8, `STEEL: FLANGES ${m.gF}, WEB ${m.gW}. CONNECTION PLATES AT CROSS-FRAMES; BEARING STIFFENERS AT BEARINGS.`);
+  D.text(ly.t, 0, yB + Dw + tmax + 14.2 * h, h * 0.8, `STEEL: FLANGES ${m.gF}, WEB ${m.gW}. CONNECTION PLATES AT ${cfDiaOn(P.cf) ? 'DIAPHRAGMS' : 'CROSS-FRAMES'}; BEARING STIFFENERS AT BEARINGS.`);
   // Strength I moment envelope (G1) under the elevation, same stations
@@ -5756,6 +5796,7 @@ function dxfCF(D, C) {
   const S = +p.S, hh = +p.h, tf = m.top[0], bf = m.bot[0], Dm = m.D, Dt = Dm + tf.t + bf.t, yb = (Dt - hh) / 2, yt = yb + hh, tw = m.web[0].t, cn = p.conn || {}, rb = (+cn.d || 0.875) / 2 + 0.0625;
+  const cp = cfCP(p), cpD = { ...cp, tw }, cpN = `CONNECTION PLATES ${dxfIn(cp.bs)} x ${dxfIn(cp.tp)} WELDED TO WEB, CORNER CLIPS ${dxfIn(cp.c)}`;   // connection plate b_s x t_p (cf.sb.bs, cf.sb.tsp), clip from the TS module Type B
   [0, S].forEach(x => { D.rect(ly.g, x - bf.b / 2, 0, x + bf.b / 2, bf.t); D.rect(ly.g, x - tw / 2, bf.t, x + tw / 2, bf.t + Dm); D.rect(ly.g, x - tf.b / 2, bf.t + Dm, x + tf.b / 2, Dt);
-    const sg = x === 0 ? 1 : -1; D.rect(ly.cp, x + sg * tw / 2, bf.t, x + sg * (tw / 2 + 0.5), bf.t + Dm); D.line(ly.c, x, -2 * h, x, Dt + 2 * h, cl); });
+    const sg = x === 0 ? 1 : -1; D.pline(ly.cp, cfCPpts(cpD, x, sg, bf.t, bf.t + Dm), true); D.line(ly.c, x, -2 * h, x, Dt + 2 * h, cl); });   // connection plate b_s wide with corner clips (2026-10-13; was a 1/2 in schematic strip)
   const dOn = cfDiaOn(p);
-  if (dOn) { const q = p.dia, X = cfDiaSec(q), g = tw / 2 + cfDiaGap(q), y0 = (Dt - X.d) / 2, y1 = y0 + X.d, ec = +q.ecc || 3.5, nb = Math.max(2, Math.round(+q.nb || 2)), s0 = +q.pitch || 3;   // diaphragm selected: channel or W centered on the girder depth, web bolted to the connection plates
+  if (dOn) { const q = p.dia, X = cfDiaSec(q), g = cfDiaGap(q), y0 = (Dt - X.d) / 2, y1 = y0 + X.d, ec = +q.ecc || 3.5, nb = Math.max(2, Math.round(+q.nb || 2)), s0 = +q.pitch || 3;   // diaphragm selected: channel or W centered on the girder depth, web bolted to the connection plates
     D.rect(ly.x, g, y0, S - g, y1); D.line(ly.x, g, y0 + X.tf, S - g, y0 + X.tf); D.line(ly.x, g, y1 - X.tf, S - g, y1 - X.tf); D.line(ly.c, 0, Dt / 2, S, Dt / 2, cl);
@@ -5776,4 +5817,4 @@ function dxfCF(D, C) {
   { const th = Math.max(...m.skews.map(v => Math.abs(v))), Se = S / Math.cos(th * Math.PI / 180), ox = S + tf.b + 30 * h, i0 = D.mark();
-    [0, Se].forEach(x => { D.rect(ly.g, ox + x - bf.b / 2, 0, ox + x + bf.b / 2, bf.t); D.rect(ly.g, ox + x - tw / 2, bf.t, ox + x + tw / 2, bf.t + Dm); D.rect(ly.g, ox + x - tf.b / 2, bf.t + Dm, ox + x + tf.b / 2, Dt); D.rect(ly.cp, ox + x + (x ? -1 : 1) * (tw / 2), bf.t, ox + x + (x ? -1 : 1) * (tw / 2 + 0.75), bf.t + Dm); });
-    if (dOn) { const q = cfDiaEnd(p.dia), X = cfDiaSec(q), g = tw / 2 + cfDiaGap(q), y0 = (Dt - X.d) / 2, y1 = y0 + X.d, ec = +q.ecc || 3.5, nb = Math.max(2, Math.round(+q.nb || 2)), s0 = +q.pitch || 3;   // end diaphragm along the bearing line (2026-10-13)
+    [0, Se].forEach(x => { D.rect(ly.g, ox + x - bf.b / 2, 0, ox + x + bf.b / 2, bf.t); D.rect(ly.g, ox + x - tw / 2, bf.t, ox + x + tw / 2, bf.t + Dm); D.rect(ly.g, ox + x - tf.b / 2, bf.t + Dm, ox + x + tf.b / 2, Dt); if (dOn) D.pline(ly.cp, cfCPpts(cpD, ox + x, x ? -1 : 1, bf.t, bf.t + Dm), true); else D.rect(ly.cp, ox + x + (x ? -1 : 1) * (tw / 2), bf.t, ox + x + (x ? -1 : 1) * (tw / 2 + 0.75), bf.t + Dm); });
+    if (dOn) { const q = cfDiaEnd(p.dia), X = cfDiaSec(q), g = cfDiaGap(q), y0 = (Dt - X.d) / 2, y1 = y0 + X.d, ec = +q.ecc || 3.5, nb = Math.max(2, Math.round(+q.nb || 2)), s0 = +q.pitch || 3;   // end diaphragm along the bearing line (2026-10-13)
       D.rect(ly.x, ox + g, y0, ox + Se - g, y1); D.line(ly.x, ox + g, y0 + X.tf, ox + Se - g, y0 + X.tf); D.line(ly.x, ox + g, y1 - X.tf, ox + Se - g, y1 - X.tf); D.line(ly.c, ox, Dt / 2, ox + Se, Dt / 2, cl);
@@ -5782,3 +5823,3 @@ function dxfCF(D, C) {
       D.dimH(ly.d, ox, ox + Se, Dt + 4 * h, Dt, 'ALONG SKEW <>'); D.text(ly.t, ox, Dt + 8 * h, h * 1.3, `END DIAPHRAGM AT BEARINGS (${X.chS ? 'CHANNEL' : 'ROLLED W'}, ALONG ${f2(th)} DEG. SKEW)`);
-      D.text(ly.t, ox, -6 * h, h * 0.8, dxfStr(`END DIAPHRAGM ${X.nm_} ASTM A709 GR. ${q.gr || 50}; WEB BOLTED WITH ${nb} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END IN ONE ROW @ ${dxfIn(s0)}, ${dxfIn(ec)} FROM GIRDER WEB; CENTERED ON GIRDER DEPTH; BEARING STIFFENERS SERVE AS CONNECTION PLATES (SKEWED OR BENT PLATES PER DESIGN).`)); }
+      D.text(ly.t, ox, -6 * h, h * 0.8, dxfStr(`END DIAPHRAGM ${X.nm_} ASTM A709 GR. ${q.gr || 50}; WEB BOLTED WITH ${nb} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END IN ONE ROW @ ${dxfIn(s0)}, ${dxfIn(ec)} FROM GIRDER WEB; CENTERED ON GIRDER DEPTH; BEARING STIFFENERS SERVE AS CONNECTION PLATES (SKEWED OR BENT PLATES PER DESIGN; DRAWN AT ${dxfIn(cp.bs)} x ${dxfIn(cp.tp)}, SIZE PER THE BEARING STIFFENER DESIGN).`)); }
     else {
@@ -5793,4 +5834,6 @@ function dxfCF(D, C) {
     D.text(ly.t, cx, cy + Lc / 2 + 3 + 4 * h, h * 1.1, 'TYPICAL CONNECTION (MEMBER TO CONNECTION PLATE)'); D.text(ly.t, cx + Lc + 10, cy - 0.4 * h, h * 0.8, `${dxfStr(mm.sec || '')}: ${n} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS @ ${dxfIn(s0)}, EDGE ${dxfIn(e0)}${+cn.tg ? `; GUSSET ${dxfIn(+cn.tg)}` : ''}`); } }
-  if (dOn) { const q = p.dia; D.text(ly.t, 0, -4 * h, h * 0.8, dxfStr(`DIAPHRAGM ${cfDiaSec(q).nm_} ASTM A709 GR. ${q.gr || 50}; WEB BOLTED TO CONNECTION PLATE WITH ${Math.max(2, Math.round(+q.nb || 2))} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END IN ONE ROW @ ${dxfIn(+q.pitch || 3)}, ${dxfIn(+q.ecc || 3.5)} FROM GIRDER WEB; CENTERED ON GIRDER DEPTH; COPE FLANGES AS REQUIRED; CONNECTION PLATES SHOWN SCHEMATICALLY.`)); return; }
-  D.text(ly.t, 0, -4 * h, h * 0.8, `MEMBERS ASTM A709 GR. ${p.gA}; ${cn.n || 2} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END @ ${dxfIn(+cn.s || 3)}, EDGE ${dxfIn(+cn.e || 1.5)}; CONNECTION PLATES SHOWN SCHEMATICALLY.`);
+  if (dOn) { const q = p.dia; D.text(ly.t, 0, -4 * h, h * 0.8, dxfStr(`DIAPHRAGM ${cfDiaSec(q).nm_} ASTM A709 GR. ${q.gr || 50}; WEB BOLTED TO CONNECTION PLATE WITH ${Math.max(2, Math.round(+q.nb || 2))} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END IN ONE ROW @ ${dxfIn(+q.pitch || 3)}, ${dxfIn(+q.ecc || 3.5)} FROM GIRDER WEB; CENTERED ON GIRDER DEPTH; COPE FLANGES AS REQUIRED; ${cpN}; DIAPHRAGM END ${dxfIn(cfDiaGap(q))} FROM GIRDER WEB CL.`));
+    { const R = GM.cf.compute(p), G = R.errors && R.errors.length ? null : cfDiaFit(R, q, cp, bf.t, tf.t); if (G && G.bad.length) D.text(ly.t, 0, -5.4 * h, h * 0.8, dxfStr(`CHECK CONNECTION GEOMETRY: ${G.bad.join('; ')}.`.toUpperCase())); }
+    return; }
+  D.text(ly.t, 0, -4 * h, h * 0.8, `MEMBERS ASTM A709 GR. ${p.gA}; ${cn.n || 2} - ${dxfIn(+cn.d || 0.875)} DIA. H.S. BOLTS EACH END @ ${dxfIn(+cn.s || 3)}, EDGE ${dxfIn(+cn.e || 1.5)}; ${cpN}.`);
 }
@@ -6020,3 +6063,3 @@ function dxfBuild(lay) {
   if (o.draw.bs) { try { const R = bsCompute(P); if (R && R.types && !(R.errors && R.errors.length)) add('BEARING STIFFENER DETAILS', dxfBS, { bs: R }, 4); } catch (e) {} }
-  if (o.draw.cf && P.cf) add('CROSS-FRAME DETAILS', dxfCF, {}, 4);
+  if (o.draw.cf && P.cf) add(cfDiaOn(P.cf) ? 'DIAPHRAGM DETAILS' : 'CROSS-FRAME DETAILS', dxfCF, {}, 4);
   if (o.draw.ts) { try { const R = GM.ts.compute(P.ts); if (!(R.errors && R.errors.length)) add('STIFFENER AND CONNECTION PLATE DETAILS', dxfTS, { ts: R }, 4); } catch (e) {} }
@@ -6061,3 +6104,3 @@ function dxfStart() {
   const o = dxfOpts(), b = P.df && P.df.bridge, nb = b && b.ok ? b.nb : 1, row = (id, l, v) => `<div class="ig"><label for="${id}">${l}</label><input id="${id}" value="${v}"></div>`;
-  const items = [['cover', 'Cover and sheet index, revisions'], ['plan', 'Framing plan (flanges, stiffeners, splice plates), lengths, cross-frames'], ['erect', 'Erection diagram, shipping pieces, girder layout'], ['diag', 'Analysis diagrams (exterior and interior girder)'], ['summ', 'Design summary'], ['std', 'Standard details and staging notes'], ['gelev', 'Elevation of every girder (own bearings, connection plates, camber)'], ['reac', 'Bearing reactions'], ['fat', 'Fatigue and fracture'], ['oh', 'Deck overhang'], ['elev', 'Girder elevation, plate schedule, camber (all girders)'], ['sec', 'Typical section, general notes, quantities'], ['splice', 'Field splices (every splice case)'], ['bs', 'Bearing stiffeners'], ['cf', 'Cross-frame'], ['ts', 'Transverse stiffeners and connection plates'], ['sc', 'Shear connectors'], ['wt', 'Flange transitions']];
+  const items = [['cover', 'Cover and sheet index, revisions'], ['plan', 'Framing plan (flanges, stiffeners, splice plates), lengths, cross-frames'], ['erect', 'Erection diagram, shipping pieces, girder layout'], ['diag', 'Analysis diagrams (exterior and interior girder)'], ['summ', 'Design summary'], ['std', 'Standard details and staging notes'], ['gelev', 'Elevation of every girder (own bearings, connection plates, camber)'], ['reac', 'Bearing reactions'], ['fat', 'Fatigue and fracture'], ['oh', 'Deck overhang'], ['elev', 'Girder elevation, plate schedule, camber (all girders)'], ['sec', 'Typical section, general notes, quantities'], ['splice', 'Field splices (every splice case)'], ['bs', 'Bearing stiffeners'], ['cf', cfDiaOn(P.cf) ? 'Diaphragm' : 'Cross-frame'], ['ts', 'Transverse stiffeners and connection plates'], ['sc', 'Shear connectors'], ['wt', 'Flange transitions']];
   daModal(`<h3>Export DXF (AutoCAD)</h3><p>Full-size drawings (inches) in model space. With paper space layouts, every sheet is a layout tab: a true 34 x 22 (or 17 x 11) page with border and title block and a locked viewport at the smallest standard scale that fits; plot each layout at 1:1. The R12 option instead draws each sheet's border around the drawings in model space. Dimensions are AutoCAD dimensions with a style per scale. Opens in AutoCAD as DXF (R12); save as DWG from there.</p>
@@ -6250,3 +6293,3 @@ const CR_META = {
   sc: { refs: ['LRFD'], obj: () => 'This calculation checks the stud shear connectors for fatigue (pitch), strength (number of connectors between points of maximum moment and supports), and the detailing limits of AASHTO LRFD 6.10.10.' },
-  cf: { refs: ['LRFD', 'AISC'], obj: () => 'This calculation analyzes an intermediate cross-frame as a pinned truss for wind on the exterior girder and for user-supplied analysis forces, and checks the single-angle members and their bolted end connections (AASHTO LRFD 4.6.2.7, 6.7.4, 6.8, 6.9.4.4, 6.13.2).' },
+  cf: { refs: ['LRFD', 'AISC'], obj: () => cfDiaOn(P.cf) ? 'This calculation checks the intermediate diaphragms and the end (bearing-line) diaphragms, channel or rolled W sections bolted to the connection plates, for the deck-placement stability bracing strength and stiffness, wind on the exterior girder, jacking at the end diaphragms when entered, and their bolted connections (AASHTO LRFD 3.4.3.1, 4.6.2.7, 6.7.4, 6.10.8, 6.10.9, 6.13.2).' : 'This calculation analyzes an intermediate cross-frame as a pinned truss for wind on the exterior girder and for user-supplied analysis forces, and checks the single-angle members and their bolted end connections (AASHTO LRFD 4.6.2.7, 6.7.4, 6.8, 6.9.4.4, 6.13.2).' },
   oh: { refs: ['LRFD'], obj: () => 'This calculation checks the exterior girder during deck placement for vertical bending combined with flange lateral bending from the deck overhang brackets (AASHTO LRFD 6.10.3, 6.10.1.6, C6.10.3.4).' },
@@ -6669,2 +6712,3 @@ function applyMod() {
   const M = MODS[P.mod] || MODS.splice; $('#mod-sub').textContent = M.title;
+  cfUiSync();
   document.querySelectorAll('.mtab').forEach(b => { const on = b.dataset.mod === P.mod; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
@@ -6681,2 +6725,8 @@ function applyMod() {
 }
+/* Cross-frames module (2026-10-13): the module tab and the auto-design button read "Diaphragms" when the diaphragm is the bracing used */
+function cfUiSync() {
+  const lab = GM.cf.label, mt = document.querySelector('#mtab-cf .mtab-l'); if (mt && mt.textContent !== lab) mt.textContent = lab;
+  if (P.mod !== 'cf') return;
+  const ad = document.getElementById('ad_run'), at = `Auto-design ${lab.toLowerCase()}`; if (ad && ad.textContent !== at) ad.textContent = at;
+}
 function setMod(m) { if (P.mod === m) return; P.mod = m; P.ui.col = {}; $('#tab-v3d').innerHTML = ''; if (V3) { V3.framed = false; V3.framedB = false; } applyMod(); renderInbox(); recompute(); autosave(); }
```

### CF-D12. With the diaphragm, the module shows only what applies to the diaphragm   [display only; checks CF1 to CF9 not listed with the diaphragm] [cross-frame projects bit-identical, UI included]
Engineer's request (2026-10-13, same branch, separate commit): with the diaphragm used, hide or replace the cross-frame-only content (member forces, angle checks, angle inputs).
- **Where (anchors):**
  - `GM.cf.checks` (anchor `if (cfDiaOn(R.p)) for (let i = out.length - 1; i >= 0; i--)`). Before: CF1 to CF9 kept with `items = []`, `status = 'na'`, `naWhy = 'Not used: diaphragm selected …'`. After: removed from the list (`out.splice`). Kept: **CFD**, **CFE**, **CF10** (bracing type, applies to both). Why the rest is not needed: CF7 (stability bracing strength) and CF8 (stiffness) are checked for the diaphragm in CFD (brace moment, shear, torsional brace system stiffness); CF1–CF6 are angle member and gusset/angle-leg connection checks; CF9 is angle-member fatigue (no diaphragm fatigue check exists; listed under "Not checked here"). Status, counts, Design all and auto-design were already decided by CFD/CFE/CF10 (N/A checks count only as "not applicable"), so no status changes; the "N/A" count drops by 9.
  - `grps()` (anchor `const grps = () => P.mod === 'cf' && cfDiaOn(P.cf) ?`): with the diaphragm `['Diaphragm (intermediate bracing used)', 'End diaphragms (bearing lines)', 'Bracing type']` (was these plus the empty "Members", "Connections" headings).
  - `GM.cf.tabs` becomes a getter: "Diaphragm forces" / "Loads and diaphragm forces" with the diaphragm (was always "Member forces" / "Loads and member forces").
  - `GM.cf.combos`: with the diaphragm the wind card note says how F<sub>w</sub> loads the diaphragm, and the truss member-force table is replaced by `cfDiaForces(R)` (new, after `GM.cf`): one table, intermediate (CFD) and end (CFE) columns — section, M<sub>br</sub>, 2M<sub>br</sub>/S, F<sub>w</sub>, M<sub>w</sub> = F<sub>w</sub>d, V<sub>w</sub> = 2M<sub>w</sub>/S, jacking R<sub>j</sub> and M<sub>j</sub> (end, when on), φM<sub>n</sub>/φV<sub>n</sub>, bolts, bolt-group V/M and bolt force, under wind V<sub>w</sub>/M/H and bolt force, bolt resistance — and the worked bolt-force equation for the intermediate diaphragm. The values are the ones `cfDiaChecks` computes: one added line at the end of its bolt block stores them, `(R.DIA = R.DIA || {})[end ? 'e' : 'i'] = { … }` (no arithmetic added or changed).
  - `GM.cf.echo` (report inputs): with the diaphragm only the diaphragm rows, S / d / L<sub>b</sub>, wind, and the bolt diameter/grade/threads (was the angle type, h, grades, angle members, angle bolts, user forces, then the diaphragm rows).
  - `GM.cf.scope` becomes a getter: with the diaphragm the "Not checked here" list is refined analysis of skewed or curved framing, connection plate design, slip resistance, fatigue of the diaphragms (CF9 covers angle members only), axial force combined with flexure, coped flanges, and bearing-line wind/seismic forces (all stated before in the CFD/CFE notes or the manual); the cross-frame list is unchanged.
  - Inputs, `cfUiSync()` (anchor `['cf.type', 'cf.h', 'cf.primary',`): with the diaphragm the class `cf-off` (new CSS `.cf-off { display: none !important; }`) hides, without deleting: Type (X/K), Chord work-point depth h, Primary members, the "Member forces from analysis" section, the fatigue force ranges and member end detail with their heading, the stability-bracing note about the truss couple, the Angles section (angle and gusset grades, members), and the angle end connections (bolts per member end, pitch, end distance, gusset thickness, and their note). Kept: S, d, L<sub>b</sub>, minimum depth, wind, every stability-bracing input (including the connection plate b<sub>s</sub>, t<sub>s</sub> and girder data used by β<sub>sec</sub>, β<sub>g</sub>, M<sub>br</sub>), the diaphragm inputs, bolt diameter, grade and threads. Labels "Cross-frame spacing L<sub>b</sub>" → "Diaphragm spacing L<sub>b</sub>" and "Cross-frame depth and connection plates" → "Diaphragm depth and connection plates" (restored with the cross-frame). `h` is not used by any diaphragm calculation (since CF-D8 the 0.8 D test uses d<sub>dia</sub>); it still must be positive (unchanged input validation). Saved values stay in the project.
  - `crInputs()` (report inputs): skips elements inside `.cf-off` (anchor `if (el.closest('.cf-off')) return;`), so hidden inputs are not printed.
  - `renderGeometry()` (Detailing tab, anchor `ks = P.mod === 'cf' && cfDiaOn(P.cf) ?`): with the diaphragm it lists the depth and bolt-line items of CFD and CFE (was CF3 and CF6, the angle slenderness and connection geometry, both N/A).
  - Summary tab: no code change; it now lists CFD, CFE, CF10 and the diaphragm scope. Drawings: already diaphragm-only (CF-D5, CF-D9, CF-D11). Auto-design message: already diaphragm-only (the bracing-type switch line, the intermediate and the end diaphragm); unchanged.
  - Manual "Diaphragms (Cross-frames module)": "the angle checks CF1 to CF9 show N/A" replaced by a description of what is shown and hidden.
- **Check case (repro, W30x99, 5 bolts at 3 in, ecc 3.5 in, S = 48 in, d = 38.88 in):** Diaphragm forces tab: M<sub>br</sub> = 256 kip-in, 2(256)/48 = 10.67 kip; F<sub>w</sub> = 2.28 kip, M<sub>w</sub> = 2.278(38.88) = 89 kip-in, V<sub>w</sub> = 2(88.6)/48 = 3.69 kip; φM<sub>n</sub>/φV<sub>n</sub> = 13,311 / 427.67; bolt group V = 10.67, M = 256.2 + 10.67(3.5) = 294 kip-in, f = √((10.67/5)² + (293.5 × 6/90)²) = √(2.13² + 19.57²) = 19.68 kip; under wind 3.69 / 101 / 2.28, 7.26 kip; resistance 25.98 (25.98, 56.78) — the same numbers as the CFD items (19.68, 7.26 kip). Checks: CFD pass, CFE pass, CF10 pass (main: the same plus CF1–CF9 N/A); CFD and CFE item text identical to main.
- **How verified:** `node --check`; headless Chromium. Default example (cross-frame): every module's checks, Summary, Member forces, auto-design, Design all, saved data, the input pane HTML, module bar, tabs and report text identical to main (only the CF-D11 drawing/DXF differences). Repro (diaphragm): tabs "Summary, Diaphragm forces, Checks, Drawings, Detailing, Report, Manual"; status chips CFD/CFE/Bracing type; 18 input elements hidden (list above); report TOC: inputs Geometry, Wind, Stability bracing, Diaphragm, End connections; "Loads and diaphragm forces"; CFD; CFE; Bracing type; summary; drawings. Toggling `cf.dia.on` back to the cross-frame restores every input, label and check; `P.cf` after auto-design identical in main and branch from the same saved project. Screenshots: Summary, Diaphragm forces, Checks, Detailing, both input tabs, report. No console errors.
- **Other copies:** none.
- **Open items:** fatigue of the diaphragm and its bolted connection is not checked (CF9 is for angle members); listed under "Not checked here".

### Exact changes (CF-D12): main page (unified diff against the CF-D11 commit; the PL_B64 line is not touched)

```diff
diff --git a/Steel Bridge Beam Modules.html b/Steel Bridge Beam Modules.html
index 6fc90a2..fcacee5 100644
--- a/Steel Bridge Beam Modules.html	
+++ b/Steel Bridge Beam Modules.html	
@@ -770,2 +770,3 @@ body.mod-pl #app { display: none !important; }
 .itab[hidden] { display: none !important; }
+.cf-off { display: none !important; }
 .same-row { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-bottom: 4px; }
@@ -2134,3 +2135,3 @@ const MAN = [
 <h3>Bearing and connection forces; fit condition; routine criteria (SA6)</h3><p>Under the reactions: permanent reaction, jacking 1.3 × permanent (3.4.3.1), Seismic Zone 1 horizontal connection force (3.10.9.2), and minimum support length N (4.7.4.4). SA6 compares the bridge with the NSBA routine-bridge definition, records η = 1.0 (1.3.2.1), and requires the fit condition (6.7.2) when a skew exceeds 20°; the fit condition appears in the drawings' notes and camber table.</p>
-<h3>Diaphragms (Cross-frames module)</h3><p>The intermediate bracing is either the cross-frame (angles) or a diaphragm: a channel (C8x11.5 to MC18x42.7) or a rolled W (W18x35 to W36x135), nominal AISC dimensions, fillets neglected (verify). Set it with <b>Intermediate bracing used</b> on the Members tab. With the diaphragm selected it is the design, and the module is named for it: the module tab, its title, the calculation report ("Diaphragm Design"), the Design all row, the Girder report chapter, and the DXF sheet ("DIAPHRAGM DETAILS") read <b>Diaphragms</b> (with the cross-frame they read Cross-frames, as before; the module, its saved data, and its keys are the same). The angle checks CF1 to CF9 show N/A and check <b>CFD</b> decides the module status, the tab badge, the report, and the Design all row. CFD checks the depth against 0.75 of the girder depth d (6.7.4.2, plate girders; a warning, as the article says "should"), the torsional brace stiffness with β<sub>br</sub> = 6EI<sub>x</sub>/S (6.7.4.2.2), the brace moment against φM<sub>n</sub> (6.10.8, L<sub>b</sub> = S, C<sub>b</sub> = 1.0; for a channel an approximation), shear, jacking flexure and shear (when on), wind, and the bolted connection (one vertical row through the web, eccentric shear and moment), plus the bolt pitch and the fit of the bolt row in the web. <b>Wind:</b> the bottom-flange wind force F<sub>w</sub> the module already derives for the cross-frame (governing Strength III or V, 4.6.2.7.1) acts with the lever arm d to the deck: M<sub>w</sub> = F<sub>w</sub>d is the diaphragm end moment, with shear 2M<sub>w</sub>/S, and the bolts also take F<sub>w</sub> horizontally (a simplified model to verify; axial force in the diaphragm is not combined with flexure). Assumed details (verify): web bolted to the connection plate, diaphragm centered on the girder depth, member ends 1.5 in past the bolt line. <b>Elevations:</b> the connection plates are drawn welded to the girder web between the flanges, b<sub>s</sub> × t<sub>p</sub> from the connection plate inputs of the stability bracing (the values β<sub>sec</sub> uses), with the corner clip of the Transverse stiffeners module's Type B; the diaphragm web laps the plate and the bolt row passes through it. The caption gives the edge distance from the bolt line to the plate's free edge and to the plate ends (against e<sub>min</sub>) and the diaphragm end gap; a bolt row that does not fit the plate is stated in the drawing, the caption, and the DXF note. <b>End (bearing-line) diaphragms:</b> with the diaphragm used, the end frames are diaphragms too (check <b>CFE</b>; inputs "End diaphragm shape" and "End diaphragm bolts per end", blank = same as the intermediate). Auto-design starts from the intermediate section and goes to heavier sections at least as deep, with the fewest bolts, until every CFE item passes. CFE checks the depth, jacking flexure, shear and bolts (3.4.3.1, with "Jacking at the end diaphragms" on and the jacking reaction entered; the Structural analysis module lists 1.3 × permanent per support), and the same brace moment and wind force per frame as the intermediate diaphragm; the jacking items are no longer applied to the intermediate diaphragm. Not checked (verify): superstructure wind and seismic forces carried to the bearings through the end diaphragms, and the torsional bracing stiffness at the supports. The drawings, 3D view, DXF (framing plan tags and the end detail along the skew) show the end diaphragms, and Design all counts them (length S/cos θ of the largest skew less the end gaps) with their bolts.</p>
+<h3>Diaphragms (Cross-frames module)</h3><p>The intermediate bracing is either the cross-frame (angles) or a diaphragm: a channel (C8x11.5 to MC18x42.7) or a rolled W (W18x35 to W36x135), nominal AISC dimensions, fillets neglected (verify). Set it with <b>Intermediate bracing used</b> on the Members tab. With the diaphragm selected it is the design, and the module is named for it: the module tab, its title, the calculation report ("Diaphragm Design"), the Design all row, the Girder report chapter, and the DXF sheet ("DIAPHRAGM DETAILS") read <b>Diaphragms</b> (with the cross-frame they read Cross-frames, as before; the module, its saved data, and its keys are the same). Only what applies to the diaphragm is shown: the angle checks CF1 to CF9 are not listed (CF7 and CF8, stability bracing strength and stiffness, are checked for the diaphragm in CFD; CF9, fatigue, covers angle members only and is listed under "Not checked here"); the <b>Diaphragm forces</b> tab lists the brace moment, wind, jacking, and bolt forces of CFD and CFE in place of the truss member forces; the inputs the diaphragm does not use (cross-frame type, chord depth h, primary members, member forces from analysis, fatigue force ranges, angles, and the angle end connections other than the bolt diameter, grade, and threads) are hidden, and their saved values are kept; the Detailing tab shows the depth and bolt-line items of CFD and CFE. Check <b>CFD</b> decides the module status, the tab badge, the report, and the Design all row. CFD checks the depth against 0.75 of the girder depth d (6.7.4.2, plate girders; a warning, as the article says "should"), the torsional brace stiffness with β<sub>br</sub> = 6EI<sub>x</sub>/S (6.7.4.2.2), the brace moment against φM<sub>n</sub> (6.10.8, L<sub>b</sub> = S, C<sub>b</sub> = 1.0; for a channel an approximation), shear, jacking flexure and shear (when on), wind, and the bolted connection (one vertical row through the web, eccentric shear and moment), plus the bolt pitch and the fit of the bolt row in the web. <b>Wind:</b> the bottom-flange wind force F<sub>w</sub> the module already derives for the cross-frame (governing Strength III or V, 4.6.2.7.1) acts with the lever arm d to the deck: M<sub>w</sub> = F<sub>w</sub>d is the diaphragm end moment, with shear 2M<sub>w</sub>/S, and the bolts also take F<sub>w</sub> horizontally (a simplified model to verify; axial force in the diaphragm is not combined with flexure). Assumed details (verify): web bolted to the connection plate, diaphragm centered on the girder depth, member ends 1.5 in past the bolt line. <b>Elevations:</b> the connection plates are drawn welded to the girder web between the flanges, b<sub>s</sub> × t<sub>p</sub> from the connection plate inputs of the stability bracing (the values β<sub>sec</sub> uses), with the corner clip of the Transverse stiffeners module's Type B; the diaphragm web laps the plate and the bolt row passes through it. The caption gives the edge distance from the bolt line to the plate's free edge and to the plate ends (against e<sub>min</sub>) and the diaphragm end gap; a bolt row that does not fit the plate is stated in the drawing, the caption, and the DXF note. <b>End (bearing-line) diaphragms:</b> with the diaphragm used, the end frames are diaphragms too (check <b>CFE</b>; inputs "End diaphragm shape" and "End diaphragm bolts per end", blank = same as the intermediate). Auto-design starts from the intermediate section and goes to heavier sections at least as deep, with the fewest bolts, until every CFE item passes. CFE checks the depth, jacking flexure, shear and bolts (3.4.3.1, with "Jacking at the end diaphragms" on and the jacking reaction entered; the Structural analysis module lists 1.3 × permanent per support), and the same brace moment and wind force per frame as the intermediate diaphragm; the jacking items are no longer applied to the intermediate diaphragm. Not checked (verify): superstructure wind and seismic forces carried to the bearings through the end diaphragms, and the torsional bracing stiffness at the supports. The drawings, 3D view, DXF (framing plan tags and the end detail along the skew) show the end diaphragms, and Design all counts them (length S/cos θ of the largest skew less the end gaps) with their bolts.</p>
 <h3>Bracing type (Cross-frames module)</h3><p><b>CF10</b> recommends the intermediate bracing type from the girder depth d (out-to-out of the flanges, the "Girder depth d" input, not the web depth): at or above the <b>Minimum girder depth for cross-frames</b> (default 48 in; common practice, e.g. AISC/NSBA G13.1 guidance; owner standards govern; verify) a cross-frame (X or K by S/h, as the auto-design chooses), below it the lightest channel at least 0.75 d deep, or else the lightest rolled W at least 0.75 d deep. A cross-frame on a girder below the minimum gives a warning, not a failure. Auto-design selects the type: below the minimum it switches to the diaphragm and picks the lightest channel, then W, at least 0.75 d deep that passes every CFD item, with the fewest bolts (one row, pitch 3 in or 3d); at or above the minimum it designs the cross-frame and switches a diaphragm back. Double-click the <b>Intermediate bracing used</b> label to lock the choice (and the shape, bolt count, or pitch labels to lock those). Preliminary sizing sends its own minimum (Framing tab) with the cross-frame geometry, and its Suggest tab states the recommendation. Design all counts the diaphragm steel (S less the end gaps, times the weight per foot from the nominal area) and its bolts in place of the angles.</p>
@@ -2696,3 +2697,5 @@ function cfDiaChecks(R, out, end) {   // end: the end (bearing-line) diaphragm,
     const em = R.emin, avail = d - 2 * tf - 1.0, need = (nb - 1) * s + 2 * em, okG = s >= 3 * db - 1e-9 && need <= avail + 1e-9;
-    it(`Bolt line: pitch ≥ 3d (6.13.2.6.1) and ${nb} bolts with ${frac(em)} in end distances within the web depth d − 2t_f − 1 in`, `s = ${f2(s)} in, ${f2(need)} in`, `≥ ${f2(3 * db)} in, ≤ ${f2(avail)} in`, okG ? 'pass' : 'fail', Math.max(3 * db / s, need / (avail > 0 ? avail : 1e-9))); }
+    it(`Bolt line: pitch ≥ 3d (6.13.2.6.1) and ${nb} bolts with ${frac(em)} in end distances within the web depth d − 2t_f − 1 in`, `s = ${f2(s)} in, ${f2(need)} in`, `≥ ${f2(3 * db)} in, ≤ ${f2(avail)} in`, okG ? 'pass' : 'fail', Math.max(3 * db / s, need / (avail > 0 ? avail : 1e-9)));
+    // the same values, kept for the "Diaphragm forces" tab (display only; 2026-10-13)
+    (R.DIA = R.DIA || {})[end ? 'e' : 'i'] = { nm_, chS, d, Mn, Fnc: lt.Fnc, Vn, C, wk, Fw, Mw, Vw, Mbr: SB ? SB.Mbr : null, jack: end && q.end === 'yes' && +q.Rj > 0 ? { Rj: +q.Rj, aj: +q.aj } : null, nb, s, db, ecc: +q.ecc || 0, ys, sy2, ym, V, Vt, M, fmax, Mc, fw, res, phiRs, phiRb }; }
   out.add(c);
@@ -2701,3 +2704,3 @@ GM.cf = {
 // the module's name follows the bracing used (engineer's request 2026-10-13): "Diaphragms" when cf.dia.on = 'yes', else "Cross-frames" exactly as before; id, keys and saved data unchanged
-tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
+  get tabs() { return cfIsDia() ? { combos: 'Diaphragm forces', rptCombos: 'Loads and diaphragm forces' } : { combos: 'Member forces', rptCombos: 'Loads and member forces' }; },
   id: 'cf', get label() { return cfIsDia() ? 'Diaphragms' : 'Cross-frames'; }, get title() { return cfIsDia() ? 'intermediate and end diaphragms, AASHTO LRFD 6.7.4, 6.10.8, 6.13.2' : 'intermediate cross-frames, AASHTO LRFD 6.7.4, 6.9.4.4'; },
@@ -2863,3 +2866,5 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
       Ms.forEach(m => c.items.push(rc(`${m.l} (${m.name})`, [f2(m.dP), f2(m.df), f2(R.FT), f2(m.df / R.FT)], m.df, R.FT, T`${f3(R.gF)}\frac{${f2(m.dP)}}{${f2(m.A)}} = ${f2(m.df)} \;${LE(m.df, R.FT)}\; ${f2(R.FT)}\ \text{ksi}`))); out.add(c); }
-    if (cfDiaOn(R.p)) out.forEach(c => { if (/^CF[1-9]$/.test(c.id)) { c.items = []; c.status = 'na'; c.gov = -1; c.naWhy = 'Not used: diaphragm selected (the intermediate bracing is the channel or rolled W diaphragm, check CFD).'; } });
+    // diaphragm used: the angle (cross-frame) checks CF1 to CF9 do not apply and are not listed (2026-10-13; they were listed as N/A). Stability bracing strength and
+    // stiffness (CF7, CF8) are checked for the diaphragm in CFD; fatigue (CF9) covers angle members only (not checked for the diaphragm, listed under "Not checked here").
+    if (cfDiaOn(R.p)) for (let i = out.length - 1; i >= 0; i--) if (/^CF[1-9]$/.test(out[i].id)) out.splice(i, 1);
     cfDiaChecks(R, out); cfDiaChecks(R, out, true);   // intermediate (CFD) and end (CFE) diaphragms
@@ -2875,6 +2880,8 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
     return [['Type', { X: 'X-frame', Kb: 'K-frame (bottom)', Kt: 'K-frame (top)' }[R.p.type]], ['Members', Object.values(R.mem).map(m => m.name).filter((v, i, a) => a.indexOf(v) === i).join(', ')], ['Wind force, Strength III', `${f2(R.W.III.Fw)} kip`], ['Bolts', `${R.n} × ${frac(R.bolt.d)} in per end`]]; },
-  scope: ['Refined analysis of skewed or curved framing (enter those member forces directly)', 'Gusset plate and connection plate design (see the Transverse stiffeners module for connection plate welds)', 'Slip resistance of the bolted connections', 'Tension-only diagonals', 'WT and double-angle members'],
-  combos(R) { const w = R.W; let h = card('cb-w', 'Wind load on the exterior girder', 'AASHTO LRFD 3.8.1.2.1, 4.6.2.7.1', eq('Strength III', '', T`P_Z = 2.56\times10^{-6}(${f0(w.III.V)})^2(${f2(nm(R.p.wind.Kz))})(${f2(nm(R.p.wind.G))})(${f2(nm(R.p.wind.Cd))}) = ${w.III.PZ.toFixed(4)}\ \text{ksf}, \quad W = \frac{1.0\,P_Zd}{2} = \frac{${w.III.PZ.toFixed(4)}(${f3(R.dft)})}{2} = ${f3(w.III.W)}\ \text{kip/ft}, \quad F_w = WL_b = ${f3(w.III.W)}(${f2(R.Lb)}) = ${f2(w.III.Fw)}\ \text{kip}`)
+  get scope() { return cfIsDia() ? ['Refined analysis of skewed or curved framing (live-load and skew forces in the diaphragms)', 'Connection plate design (see the Transverse stiffeners module for connection plate welds)', 'Slip resistance of the bolted connections', 'Fatigue of the diaphragms and their connections (CF9 covers angle cross-frame members only)', 'Axial force in the diaphragm combined with flexure', 'Coped flanges (block shear and local buckling at copes)', 'Superstructure wind and seismic forces carried to the bearings through the end diaphragms']
+    : ['Refined analysis of skewed or curved framing (enter those member forces directly)', 'Gusset plate and connection plate design (see the Transverse stiffeners module for connection plate welds)', 'Slip resistance of the bolted connections', 'Tension-only diagonals', 'WT and double-angle members']; },
+  combos(R) { const w = R.W, dia = cfDiaOn(R.p); let h = card('cb-w', 'Wind load on the exterior girder', 'AASHTO LRFD 3.8.1.2.1, 4.6.2.7.1', eq('Strength III', '', T`P_Z = 2.56\times10^{-6}(${f0(w.III.V)})^2(${f2(nm(R.p.wind.Kz))})(${f2(nm(R.p.wind.G))})(${f2(nm(R.p.wind.Cd))}) = ${w.III.PZ.toFixed(4)}\ \text{ksf}, \quad W = \frac{1.0\,P_Zd}{2} = \frac{${w.III.PZ.toFixed(4)}(${f3(R.dft)})}{2} = ${f3(w.III.W)}\ \text{kip/ft}, \quad F_w = WL_b = ${f3(w.III.W)}(${f2(R.Lb)}) = ${f2(w.III.Fw)}\ \text{kip}`)
       + eq('Strength V', '', T`P_Z = 2.56\times10^{-6}(80)^2(${f2(nm(R.p.wind.Kz))})(${f2(nm(R.p.wind.G))})(${f2(nm(R.p.wind.Cd))}) = ${w.V.PZ.toFixed(4)}\ \text{ksf}, \quad F_w = \frac{${w.V.PZ.toFixed(4)}(${f3(R.dft)})}{2}(${f2(R.Lb)}) = ${f2(w.V.Fw)}\ \text{kip}`)
-      + `<p class="note-p">F<sub>w</sub> is applied horizontally at the bottom flange of the exterior girder; the top chord work points are held by the deck. Wind can act in either direction, so each member is designed for its analysis force plus and minus the wind force.</p>`);
+      + (dia ? `<p class="note-p">F<sub>w</sub> acts horizontally at the bottom flange of the exterior girder and is reacted at the deck (top flange): a torque F<sub>w</sub>d on the girder, resisted by bending of the diaphragm (CFD, CFE).</p>` : `<p class="note-p">F<sub>w</sub> is applied horizontally at the bottom flange of the exterior girder; the top chord work points are held by the deck. Wind can act in either direction, so each member is designed for its analysis force plus and minus the wind force.</p>`));
+    if (dia) return h + cfDiaForces(R);   // diaphragm used: its design forces in place of the truss member forces (2026-10-13)
     h += card('cb-t', 'Member forces from the truss model', 'Direct stiffness, pinned joints', `<div class="tscroll"><table class="tbl"><thead><tr><th>Member</th><th class="right">Length (in)</th><th class="right">Force per kip of F<sub>w</sub></th>${R.combos.map(c => `<th class="right">${c.id} T / C (kip)</th>`).join('')}</tr></thead><tbody>${R.frames.map((e, i) => `<tr><td class="lbl">${e.lbl}</td><td class="val">${f2(e.L)}</td><td class="val">${f3(e.unit)}</td>${R.combos.map(c => `<td class="val">${f2(c.f[i].T)} / ${f2(c.f[i].Cc)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
@@ -2887,3 +2894,5 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
     return card('dw-cf', 'Cross-frame elevation', 'To scale; Strength III wind forces', `<div class="dwg-wrap">${cfSVG(R)}</div><p class="cap">Force labels: Strength III wind force per member (tension +) for wind toward the interior girder. ${cpTxt} Girder depth d centered on the work points.</p>`); },
-  echo(R) { return { kv: [['Type', { X: 'X-frame', Kb: 'K-frame, diagonals meet at the bottom chord', Kt: 'K-frame, diagonals meet at the top chord' }[R.p.type]], ['S / h / d / L_b', `${f2(R.S)} in / ${f2(R.h)} in / ${f2(nm(R.p.dg))} in / ${f2(R.Lb)} ft`], ['Wind V, K_z, G, C_D', `${f0(nm(R.p.wind.V))} mph, ${R.p.wind.Kz}, ${R.p.wind.G}, ${R.p.wind.Cd}`], ['Grades: angles / gusset', `${R.p.gA} / ${R.p.gG}`],
+  echo(R) { if (cfDiaOn(R.p)) { const q = R.p.dia; return { kv: [['Intermediate bracing used', `diaphragm ${cfDiaSec(q).nm_}, grade ${q.gr}; ${Math.max(2, Math.round(+q.nb || 2))} bolts per end at ${f2(+q.pitch || 3)} in, ${f2(+q.ecc || 0)} in from the girder web`], ['End diaphragms (bearing lines)', (e => `${cfDiaSec(e).nm_}; ${Math.max(2, Math.round(+e.nb || 2))} bolts per end; jacking ${q.end === 'yes' && +q.Rj > 0 ? `${f2(+q.Rj)} kip at ${f2(+q.aj)} in` : 'not checked'}`)(cfDiaEnd(q))],
+      ['S / d / L_b', `${f2(R.S)} in / ${f2(nm(R.p.dg))} in / ${f2(R.Lb)} ft`], ['Wind V, K_z, G, C_D', `${f0(nm(R.p.wind.V))} mph, ${R.p.wind.Kz}, ${R.p.wind.G}, ${R.p.wind.Cd}`], ['Bolts', `${frac(R.bolt.d)} in ${R.p.conn.gr}, threads ${R.p.conn.thr === 'excl' ? 'excluded' : 'included'}`]] }; }   // diaphragm used: only the inputs it uses (2026-10-13)
+    return { kv: [['Type', { X: 'X-frame', Kb: 'K-frame, diagonals meet at the bottom chord', Kt: 'K-frame, diagonals meet at the top chord' }[R.p.type]], ['S / h / d / L_b', `${f2(R.S)} in / ${f2(R.h)} in / ${f2(nm(R.p.dg))} in / ${f2(R.Lb)} ft`], ['Wind V, K_z, G, C_D', `${f0(nm(R.p.wind.V))} mph, ${R.p.wind.Kz}, ${R.p.wind.G}, ${R.p.wind.Cd}`], ['Grades: angles / gusset', `${R.p.gA} / ${R.p.gG}`],
       ...Object.values(R.mem).map(m => [m.l, m.name]), ['Bolts', `${R.n} × ${frac(R.bolt.d)} in ${R.p.conn.gr} per end, pitch ${frac(R.s)}, end ${frac(R.e0)}, gusset ${frac(R.tg)} in`],
@@ -2893,2 +2902,27 @@ tabs: { combos: 'Member forces', rptCombos: 'Loads and member forces' },
 };
+/* "Diaphragm forces" tab (cf.dia.on = 'yes'; 2026-10-13): the design forces of the intermediate (CFD) and end (CFE) diaphragms, the values computed by cfDiaChecks (display only) */
+function cfDiaForces(R) {
+  if (!R.DIA) GM.cf.checks(R);
+  const I = R.DIA && R.DIA.i, E = R.DIA && R.DIA.e, S = R.S, dg = nm(R.p.dg), SB = R.SB; if (!I) return '';
+  const col = (f, x) => x ? f(x) : '—', row = (l, f, u) => `<tr><td class="lbl">${l}</td><td class="val">${col(f, I)}</td><td class="val">${col(f, E)}</td><td class="unit">${u}</td></tr>`;
+  const t = `<div class="tscroll"><table class="tbl"><thead><tr><th>Force</th><th class="right">Intermediate (CFD)</th><th class="right">End, bearing lines (CFE)</th><th></th></tr></thead><tbody>
+    ${row('Section', x => `${x.chS ? 'channel' : 'rolled'} ${x.nm_}, d = ${f2(x.d)} in`, '')}
+    ${row('Brace moment M<sub>br</sub> (6.7.4.2.2)', x => x.Mbr != null ? f0(x.Mbr) : 'not checked', 'kip-in')}
+    ${row('Shear from the brace moment, 2M<sub>br</sub>/S', x => x.Mbr != null ? f2(2 * x.Mbr / S) : '—', 'kip')}
+    ${row(`Wind force F<sub>w</sub>, Strength ${I.wk}`, x => f2(x.Fw), 'kip')}
+    ${row('Wind moment M<sub>w</sub> = F<sub>w</sub>d', x => f0(x.Mw), 'kip-in')}
+    ${row('Wind shear V<sub>w</sub> = 2M<sub>w</sub>/S', x => f2(x.Vw), 'kip')}
+    ${row('Jacking reaction R<sub>j</sub> at a<sub>j</sub> (3.4.3.1)', x => x.jack ? `${f2(x.jack.Rj)} at ${f2(x.jack.aj)} in` : '—', 'kip')}
+    ${row('Jacking moment M<sub>j</sub> = R<sub>j</sub>a<sub>j</sub>', x => x.jack ? f0(x.jack.Rj * x.jack.aj) : '—', 'kip-in')}
+    ${row('Resistances φ<sub>f</sub>M<sub>n</sub> / φ<sub>v</sub>V<sub>n</sub>', x => `${f0(x.Mn)} / ${f2(x.Vn)}`, 'kip-in / kip')}
+    ${row('Bolts per end (one vertical row)', x => `${x.nb} at ${f2(x.s)} in, ${f2(x.ecc)} in from the web`, '')}
+    ${row('Bolt group: V / M (brace moment and jacking)', x => `${f2(x.Vt)} / ${f0(x.M)}`, 'kip / kip-in')}
+    ${row('Bolt force, brace moment and jacking', x => f2(x.fmax), 'kip')}
+    ${row('Bolt group under wind: V<sub>w</sub> / M = M<sub>w</sub> + V<sub>w</sub>e / H = F<sub>w</sub>', x => `${f2(x.Vw)} / ${f0(x.Mc)} / ${f2(x.Fw)}`, 'kip, kip-in')}
+    ${row('Bolt force under wind', x => f2(x.fw), 'kip')}
+    ${row('Bolt resistance (lesser of shear and bearing on the diaphragm web)', x => `${f2(x.res)} (${f2(x.phiRs)}, ${f2(x.phiRb)})`, 'kip')}
+  </tbody></table></div>`;
+  const ex = eq('Intermediate diaphragm, bolt force (brace moment)', '6.13.2', T`f = \sqrt{\left(\frac{V}{n}\right)^2 + \left(\frac{M\,y_{max}}{\sum y^2}\right)^2} = \sqrt{\left(\frac{${f2(I.Vt)}}{${I.nb}}\right)^2 + \left(\frac{${f0(I.M)}(${f2(I.ym)})}{${f2(I.sy2)}}\right)^2} = ${f2(I.fmax)}\ \text{kip}`);
+  return card('cb-dia', 'Diaphragm design forces', 'AASHTO LRFD 6.7.4.2.2, 4.6.2.7.1, 3.4.3.1, 6.13.2', t + ex + `<p class="note-p">Per diaphragm, the values checked in CFD and CFE. M<sub>br</sub>${SB ? ` = ${f0(SB.Mbr)} kip-in from the stability bracing inputs (6.7.4.2.2)` : ': stability bracing check off, not applied'}; M<sub>w</sub> = F<sub>w</sub>d with the girder depth d = ${f2(dg)} in; shears 2M/S with S = ${f2(S)} in (reverse curvature). The bolt group takes V and M = M<sub>br</sub> + V·e (e = bolt line to girder web), distributed elastically over one vertical row; under wind also H = F<sub>w</sub>. The end diaphragm adds the jacking reaction when "Jacking at the end diaphragms" is on. The angle cross-frame inputs and the truss member forces are not used.</p>`);
+}
 /* recommended intermediate bracing type from the girder depth (2026-10-12): cross-frame at or above the minimum depth (X or K by S/h, as the auto-design does),
@@ -6356,2 +6390,3 @@ function crInputs() {
         if (el.closest('.row-blk') && !el.classList.contains('row-blk')) return;
+        if (el.closest('.cf-off')) return;   // inputs hidden because they do not apply (Cross-frames module with the diaphragm)
         if (el.classList.contains('row-blk')) return;
@@ -6725,7 +6760,16 @@ function applyMod() {
 }
-/* Cross-frames module (2026-10-13): the module tab and the auto-design button read "Diaphragms" when the diaphragm is the bracing used */
+/* Cross-frames module with the diaphragm as the bracing used (2026-10-13): the module tab reads "Diaphragms", and the inputs the diaphragm does not use
+   (cross-frame type, chord depth h, primary members, analysis member forces, fatigue force ranges, angles, angle end connections) are hidden, not deleted:
+   their saved values stay in the project. With the cross-frame nothing is changed. */
 function cfUiSync() {
-  const lab = GM.cf.label, mt = document.querySelector('#mtab-cf .mtab-l'); if (mt && mt.textContent !== lab) mt.textContent = lab;
+  const dia = cfIsDia(), lab = GM.cf.label, mt = document.querySelector('#mtab-cf .mtab-l'); if (mt && mt.textContent !== lab) mt.textContent = lab;
   if (P.mod !== 'cf') return;
   const ad = document.getElementById('ad_run'), at = `Auto-design ${lab.toLowerCase()}`; if (ad && ad.textContent !== at) ad.textContent = at;
+  const off = el => { if (el && (dia || el.classList.contains('cf-off'))) el.classList.toggle('cf-off', dia); }, ig = k => { const i = document.querySelector(`#ipane-cf_geo [data-k="${k}"], #ipane-cf_mem [data-k="${k}"]`); return i && i.closest('.ig'); };
+  ['cf.type', 'cf.h', 'cf.primary', 'cf.user.Fat.top', 'cf.user.Fat.bot', 'cf.user.Fat.diag', 'cf.fatCat', 'cf.conn.n', 'cf.conn.s', 'cf.conn.e', 'cf.conn.tg'].forEach(k => off(ig(k)));
+  ['sec-cfu', 'sec-cfm'].forEach(id => { off(document.getElementById(id)); off(document.querySelector(`.sec-hd[data-target="${id}"]`)); });
+  const fh = ig('cf.user.Fat.top'); off(fh && fh.previousElementSibling && fh.previousElementSibling.matches('h4') ? fh.previousElementSibling : null);
+  ['#sec-cfsb > p.note', '#sec-cfc > p.note'].forEach(q => off(document.querySelector(q)));
+  [['f_cf_Lb', 'Diaphragm spacing L<sub>b</sub>'], ['f_cf_sb_full', 'Diaphragm depth and connection plates']].forEach(([id, t]) => { const l = document.querySelector(`label[for="${id}"]`); if (!l) return;
+    if (dia && l.dataset.cfLbl === undefined) { l.dataset.cfLbl = l.innerHTML; l.innerHTML = t; } else if (!dia && l.dataset.cfLbl !== undefined) { l.innerHTML = l.dataset.cfLbl; delete l.dataset.cfLbl; } });
 }
@@ -6776,3 +6820,3 @@ function renderErrors() { crMarkStale();
 }
-const grps = () => P.mod === 'cf' && cfDiaOn(P.cf) ? ['Diaphragm (intermediate bracing used)', 'End diaphragms (bearing lines)', ...MODS.cf.groups] : (MODS[P.mod] || MODS.splice).groups;   // cross-frames: the diaphragm group (check CFD) is listed when the diaphragm is the bracing used
+const grps = () => P.mod === 'cf' && cfDiaOn(P.cf) ? ['Diaphragm (intermediate bracing used)', 'End diaphragms (bearing lines)', 'Bracing type'] : (MODS[P.mod] || MODS.splice).groups;   // cross-frames: with the diaphragm used only its groups (CFD, CFE) and the bracing type (CF10) are listed; the angle groups are not shown (2026-10-13)
 function counts() { const c = { fail: 0, warn: 0, adv: 0, pass: 0, na: 0 }; CK.forEach(k => c[k.status]++); return c; }
@@ -6886,3 +6930,3 @@ function renderGeometry() {
   if (!CK) { host.innerHTML = ''; return; }
-  const ids = GEO[P.mod] || [], ks = CK.filter(k => ids.includes(k.id)), items = ks.flatMap(k => k.items), nf = items.filter(i => i.st === 'fail').length, nw = items.filter(i => i.st === 'warn').length;
+  const ids = GEO[P.mod] || [], ks = P.mod === 'cf' && cfDiaOn(P.cf) ? CK.filter(k => k.id === 'CFD' || k.id === 'CFE').map(k => ({ ...k, items: k.items.filter(i => /^(Depth|Bolt line)/.test(i.loc)) })).filter(k => k.items.length) : CK.filter(k => ids.includes(k.id)), items = ks.flatMap(k => k.items), nf = items.filter(i => i.st === 'fail').length, nw = items.filter(i => i.st === 'warn').length;
   let h = card('geo-head', 'Geometric proportions and detailing', '', `<p class="note-p">${ks.length ? `${ks.length} checks covering ${items.length} dimensions: ${items.length - nf - nw} satisfied, ${nf} not satisfied, ${nw} warning${nw === 1 ? '' : 's'}. Each check also appears, fully worked, on the Checks tab and in the report.` : 'This module has no geometric proportion limits of its own. Flange and web proportions for the girder are checked in the Girder section module (GS1 to GS3).'}</p>`);
```

## 2026-10-13 — PR: claude/girderdetail-q4 (engineer's approved items Q4–Q6, 2026-10-13; PR link added after merge)

Engineer's approval (2026-10-13) of three items: (Q4) Transverse stiffeners TS4 checks each end panel with the largest V<sub>u</sub> in it (at the bearing), not only the shear at the first stiffener; (Q5) for simple spans, PlateLine flags the panels next to an interior support as end panels too (each is a girder end); (Q6) PlateLine Bridge tab, third girder spacing mode "From exterior girders". Main page and the embedded PlateLine (`const PL_B64 = '...'`, decoded, edited, re-encoded on one line, no wrapping) are changed. Basis: AASHTO LRFD 10th Ed. (2024). Line numbers ≈ branch (main page) or decoded PlateLine (PL ≈). Builds on EK1–EK3 (end panel wider than 1.5D is unstiffened, k = 5), Q3 (TS5) and SC1/SC2. No `bridgeSuite.v1.*` code or other shared snippet is touched.

### Q4. TS4: an end panel is checked with the largest V<sub>u</sub> in it (at the bearing)   [§4: demand location change] [optional saved fields `ts.rows[i].VDC1b`, `VDC2b`, `VDWb`, `VLLb`]

- **Where (main page):**
  - `TS_ROWSPEC` (≈ 2389; anchor `['df', 'Δf fatigue, tension flange', 'ksi', 'num', { min: 0 }]`): four optional inputs per location, "End panel: max. V<sub>DC1</sub> / V<sub>DC2</sub> / V<sub>DW</sub> / V<sub>LL+IM</sub> in panel 1" (kip, `{ min: 0, opt: true }`), and `const TS_BRG` (their keys).
  - `numRows()` (≈ 2362; anchor `function numRows(rows, spec, lbl, errors)`): a spec entry with `opt: true` left blank (missing, `''`, `null`, or NaN) is `null` instead of an input error. No other spec uses `opt`, so every other module is unchanged.
  - `GM.ts.compute()` (≈ 2419): error "enter all four end-panel shears, or leave all four blank" when only some are given; new `r.VuB` (Strength I of the end-panel shears, same γ inputs) and `r.Vu1` (panel 1 demand); `q.Vu` per panel (panel 1: `r.Vu1`, panel 2: `r.Vu`).
  - `GM.ts.checks()` TS4 (≈ 2457): items use `q.Vu`; the worked line says "(largest in the end panel: at the bearing)" (or "at the stiffener" when that is larger) or "(at the stiffener: no end-panel shears given)"; note extended.
  - Key quantities "Max. V<sub>u</sub>" (`kq`) uses `r.Vu1`; Demands tab (`combos`) adds "Strength I, end panel (largest in panel 1, at the bearing)"; report input table (`echo`) adds "; end panel a / b / c / d" to the shear cell; Locations note and manual "Web shear (6.10.9)" paragraph.
- **Where (decoded PlateLine):** `detailExport()` (PL ≈ 3470; anchor `const shear = (T, x) => { const e = el(x);`): new `shearIn(T, a, b)`, the largest |V| of each component (DC1, DC2, DW, and the larger of LL+IM positive/negative) over the analysis elements between the bearing (`m.sup[ks]`) and the first stiffener; the TS rows flagged `end: 'yes'` carry it as `VDC1b`, `VDC2b`, `VDWb`, `VLLb` (appended after `df`). Rows that are not end panels are unchanged. The Structural analysis source goes through the same `detailExport` with that girder's arrays (`pl-export-req`, `src: 'sa'`), so its support shear is used the same way.
- **Before:** TS4 panel 1 of an end location: V<sub>u</sub> = γ<sub>DC</sub>(V<sub>DC1</sub> + V<sub>DC2</sub>) + γ<sub>DW</sub>V<sub>DW</sub> + γ<sub>LL</sub>V<sub>LL+IM</sub> with the shears at the stiffener.
- **After:** V<sub>u,end</sub> = max(V<sub>u,stiffener</sub>, γ<sub>DC</sub>(V<sub>DC1b</sub> + V<sub>DC2b</sub>) + γ<sub>DW</sub>V<sub>DWb</sub> + γ<sub>LL</sub>V<sub>LLb</sub>) when the four end-panel shears are given; otherwise as before, and the item says "(at the stiffener: no end-panel shears given)". Panel 2, TS3 (ρ<sub>w</sub>: end panels have none), TS1/TS2/TS5–CP2: unchanged. φ<sub>v</sub>V<sub>n</sub> unchanged.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 6.10.9.1 (V<sub>u</sub> ≤ φ<sub>v</sub>V<sub>n</sub>, Eq. 6.10.9.1-1, V<sub>u</sub> = shear in the web at the section under consideration due to the factored loads), Art. 6.10.9.3.3 (end panels, V<sub>n</sub> = V<sub>cr</sub> = CV<sub>p</sub>, Eq. 6.10.9.3.3-1) and Art. 6.10.9.2 (unstiffened, Eq. 6.10.9.2-1, end panels wider than 1.5D per EK1). The end panel is the web panel from the bearing to the first stiffener, so the largest shear in it (at the bearing) is the demand for that panel.
- **Problem:** the larger shear at the bearing was not checked anywhere in GirderDetail (the Girder section rows are never at a bearing). Unconservative: the end panel's V<sub>u</sub> was low by the shear drop over d<sub>o</sub>.
- **Envelope note:** each component is its own maximum over the panel (as `shear()` already does for the three elements around a stiffener), so V<sub>u,end</sub> can be slightly larger than the largest V<sub>u</sub> of one load position; at a simple support or an abutment all components peak in the element next to the bearing.
- **Check case 1 (PlateLine built-in example, 110-140-110 ft continuous, D = 60 in, t<sub>w</sub> = 9/16 in, F<sub>yw</sub> = 50 ksi, stiffened, d<sub>o</sub> = D = 60 in; Transverse stiffeners → Get demands from Preliminary sizing):** Span 1, first stiffener from Abut. 1, interior girder, panel 1 (end):
  - Before (shears at the stiffener, 5 ft from the bearing): V<sub>DC1</sub> = 47.2, V<sub>DC2</sub> = 9.0, V<sub>DW</sub> = 7.5, V<sub>LL+IM</sub> = 106.6 kip; V<sub>u</sub> = 1.25(47.2 + 9.0) + 1.50(7.5) + 1.75(106.6) = 70.25 + 11.25 + 186.55 = **268.05 kip**.
  - After (largest in the end panel, the element at the bearing): 51.2, 9.8, 8.1, 111.6 kip; V<sub>u</sub> = 1.25(51.2 + 9.8) + 1.50(8.1) + 1.75(111.6) = 76.25 + 12.15 + 195.30 = **283.70 kip**.
  - Resistance (both): D/t<sub>w</sub> = 106.67, k = 5 + 5/(60/60)² = 10, √(Ek/F<sub>yw</sub>) = √(29,000 × 10/50) = 76.16, 1.40 × 76.16 = 106.62 < 106.67, so C = 1.57/106.67² × 5,800 = 0.800; V<sub>p</sub> = 0.58(50)(60)(0.5625) = 978.75 kip; φ<sub>v</sub>V<sub>n</sub> = 0.800 × 978.75 = **783.32 kip** (Eq. 6.10.9.3.3-1). Ratio 268.05/783.32 = **0.34 → 283.70/783.32 = 0.36** (pass).
  - Other end panels of the example: Abut. 2 interior 262.90 → 283.70 kip (0.34 → 0.36); Abut. 1 exterior 240.92 → 255.03 (0.31 → 0.33); Abut. 2 exterior 236.30 → 255.03 (0.30 → 0.33). Every other TS item, the status bar and every other check: unchanged.
  - Same with Structural analysis, G2: identical numbers (268.05 → 283.70, 262.90 → 283.70).
- **Check case 2 (90 ft simple span, 10 girders at 4 ft, overhangs 2.25 ft, span-to-depth off; quick suggestion applied: D = 30 in, t<sub>w</sub> = 1/2 in, unstiffened, connection plates at 25 ft, end panel d<sub>o</sub> = 300 in):** Span 1, first connection plate from Abut. 1, interior girder, panel 1 (end):
  - Before: 13.5, 3.5, 2.0, 39.5 kip at the connection plate; V<sub>u</sub> = 1.25(17.0) + 1.50(2.0) + 1.75(39.5) = 21.25 + 3.00 + 69.13 = **93.38 kip**.
  - After: 27.9, 7.2, 4.2, 58.9 kip at the bearing; V<sub>u</sub> = 1.25(35.1) + 1.50(4.2) + 1.75(58.9) = 43.88 + 6.30 + 103.08 = **153.25 kip**.
  - Resistance (both): unstiffened, k = 5; D/t<sub>w</sub> = 60 ≤ 1.12√(29,000 × 5/50) = 60.31, so C = 1.0; φ<sub>v</sub>V<sub>n</sub> = 0.58(50)(30)(0.5) = **435.00 kip** (Eq. 6.10.9.2-1). Ratio **0.21 → 0.35** (pass). Exterior girder: 79.82 → 133.40 kip (0.18 → 0.31); Abut. 2: 90.88 → 153.25 (interior), 77.45 → 133.40 (exterior).
- **Check case 3 (GirderDetail default project, Transverse stiffeners, hand-entered example):** no end-panel shears → TS4 panel 1 (end) unchanged, V<sub>u</sub> = 241.00 kip, φ<sub>v</sub>V<sub>n</sub> = 783.32, ratio 0.31; the worked line adds "(at the stiffener: no end-panel shears given)". Entering 60 / 9 / 10 / 95 kip: V<sub>u</sub> = 1.25(69) + 1.50(10) + 1.75(95) = 86.25 + 15.00 + 166.25 = 267.50 kip, ratio 0.34; Key quantities "Max. V<sub>u</sub>" 267.50 kip. Entering only V<sub>DC1b</sub>: input error "Span 1, first stiffener from Abut. 1: enter all four end-panel shears, or leave all four blank."
- **Saved data and hand-off:** no key changed (`girderdetail_autosave_v1`, `girderdetail_inbox_v1`, `plateline_autosave_v1`). The four fields are optional: an old project, an old saved inbox, or rows entered by hand load and use the shear at the stiffener (and say so). A project saved by the branch with them loads in main (main ignores them and keeps them; TS4 as before) and back in the branch unchanged. The PlateLine payload (`mods.ts.rows`) only gains the four fields on end-panel rows.
- **How verified:** `node --check` on every inline script (main page and decoded PlateLine); headless Chromium main vs branch (below).
- **Other copies:** none.
- **Open items:** none new. The GS rows are still never at a bearing (unchanged; TS4 now carries the end-panel shear check).

### Exact changes (Q4): main page (unified diff, PL_B64 line omitted)

```diff
--- a/Steel Bridge Beam Modules.html
+++ b/Steel Bridge Beam Modules.html
@@ -2274,3 +2274,3 @@
 <p>d<sub>o</sub> is the smaller adjacent panel and b the smaller of d<sub>o</sub> and D. Where neither panel needs tension-field action, I<sub>t</sub> ≥ I<sub>t1</sub>. Otherwise I<sub>t</sub> ≥ I<sub>t1</sub> + (I<sub>t2</sub> − I<sub>t1</sub>)ρ<sub>w</sub> when I<sub>t2</sub> > I<sub>t1</sub>, else I<sub>t</sub> ≥ I<sub>t2</sub>, with ρ<sub>w</sub> the larger of (V<sub>u</sub> − φ<sub>v</sub>V<sub>cr</sub>)/(φ<sub>v</sub>V<sub>n</sub> − φ<sub>v</sub>V<sub>cr</sub>) in the two panels (confirm the equation numbering against your edition). I<sub>t</sub> is taken about the web face for a single plate and about the web mid-thickness for a pair.</p>
-<h3>Web shear (6.10.9)</h3><p>Each adjacent panel is checked for V<sub>u</sub> ≤ φ<sub>v</sub>V<sub>n</sub> with k = 5 + 5/(d<sub>o</sub>/D)². Interior panels include tension-field action (Eq. 6.10.9.3.2-2 or -8 depending on 2Dt<sub>w</sub>/(b<sub>fc</sub>t<sub>fc</sub> + b<sub>ft</sub>t<sub>ft</sub>)); end panels use V<sub>n</sub> = CV<sub>p</sub> (Eq. 6.10.9.3.3-1). An interior panel wider than 3D or an end panel wider than 1.5D is not a stiffened panel (6.10.9.1): it is checked as unstiffened, k = 5 and V<sub>n</sub> = CV<sub>p</sub> (Eq. 6.10.9.2-1). Check TS5 compares each panel with these limits, which decide only whether the panel counts as stiffened: a panel wider than its limit is advisory, because TS4 checks it as unstiffened (k = 5) and decides pass or fail. When the web has no intermediate stiffeners (connection plates only), it is designed as unstiffened and TS5 is not applicable.</p>
+<h3>Web shear (6.10.9)</h3><p>Each adjacent panel is checked for V<sub>u</sub> ≤ φ<sub>v</sub>V<sub>n</sub> with k = 5 + 5/(d<sub>o</sub>/D)². Interior panels include tension-field action (Eq. 6.10.9.3.2-2 or -8 depending on 2Dt<sub>w</sub>/(b<sub>fc</sub>t<sub>fc</sub> + b<sub>ft</sub>t<sub>ft</sub>)); end panels use V<sub>n</sub> = CV<sub>p</sub> (Eq. 6.10.9.3.3-1). An interior panel wider than 3D or an end panel wider than 1.5D is not a stiffened panel (6.10.9.1): it is checked as unstiffened, k = 5 and V<sub>n</sub> = CV<sub>p</sub> (Eq. 6.10.9.2-1). V<sub>u</sub> is the Strength I shear at the stiffener for both panels, except that an end panel is checked with the largest V<sub>u</sub> in it (at the bearing): the location's end-panel shears (V<sub>DC1</sub>, V<sub>DC2</sub>, V<sub>DW</sub>, V<sub>LL+IM</sub>, the largest in panel 1, sent by Preliminary sizing and Structural analysis) give that V<sub>u</sub>, and the larger of it and the shear at the stiffener is used. When they are blank (projects saved before they existed, or entered by hand), the end panel uses the shear at the stiffener and the TS4 item says so. Check TS5 compares each panel with these limits, which decide only whether the panel counts as stiffened: a panel wider than its limit is advisory, because TS4 checks it as unstiffened (k = 5) and decides pass or fail. When the web has no intermediate stiffeners (connection plates only), it is designed as unstiffened and TS5 is not applicable.</p>
 <h3>Welds and fatigue</h3><p>Intermediate stiffener web welds stop 4t<sub>w</sub> to 6t<sub>w</sub> from the web-to-flange weld at the tension flange (6.10.11.1.1). Connection plates are welded to both flanges and those welds are designed for 20 kip laterally on straight, nonskewed bridges, or the analysis force otherwise (6.6.1.3.1). Base metal at stiffener weld toes is Category C′, (ΔF)<sub>TH</sub> = 12 ksi. Minimum fillet sizes follow Table 6.13.3.4-1.</p>
@@ -2362,3 +2362,5 @@
 function numRows(rows, spec, lbl, errors) { return rows.map((r0, i) => { const r = { i, name: r0.name || `${lbl} ${i + 1}` };
-  spec.forEach(([k, , , ty, o]) => { if (ty === 'text' || ty === 'sel') { r[k] = r0[k]; return; } const v = nm(r0[k]); r[k] = v;
+  spec.forEach(([k, , , ty, o]) => { if (ty === 'text' || ty === 'sel') { r[k] = r0[k]; return; }
+    if (o && o.opt && (r0[k] == null || r0[k] === '' || (typeof r0[k] === 'number' && isNaN(r0[k])))) { r[k] = null; return; }   // optional input left blank
+    const v = nm(r0[k]); r[k] = v;
     const min = o && o.min !== undefined ? o.min : (o && o.any ? -Infinity : 1e-12);
@@ -2389,3 +2391,6 @@
   ['VDC1', 'V<sub>DC1</sub>', 'kip', 'num', { min: 0 }], ['VDC2', 'V<sub>DC2</sub>', 'kip', 'num', { min: 0 }], ['VDW', 'V<sub>DW</sub>', 'kip', 'num', { min: 0 }], ['VLL', 'V<sub>LL+IM</sub>', 'kip', 'num', { min: 0 }],
-  ['df', 'Δf fatigue, tension flange', 'ksi', 'num', { min: 0 }]];
+  ['df', 'Δf fatigue, tension flange', 'ksi', 'num', { min: 0 }],
+  ['VDC1b', 'End panel: max. V<sub>DC1</sub> in panel 1', 'kip', 'num', { min: 0, opt: true }], ['VDC2b', 'End panel: max. V<sub>DC2</sub> in panel 1', 'kip', 'num', { min: 0, opt: true }],
+  ['VDWb', 'End panel: max. V<sub>DW</sub> in panel 1', 'kip', 'num', { min: 0, opt: true }], ['VLLb', 'End panel: max. V<sub>LL+IM</sub> in panel 1', 'kip', 'num', { min: 0, opt: true }]];
+const TS_BRG = ['VDC1b', 'VDC2b', 'VDWb', 'VLLb'];   // optional end-panel shears (largest in panel 1, at the bearing; Q4); all four blank = the shear at the stiffener is used
 GM.ts = {
@@ -2406,3 +2411,3 @@
         ${fld('γ<sub>DC</sub>', 'ts.gam.dc', '')}${fld('γ<sub>DW</sub>', 'ts.gam.dw', '')}${fld('γ<sub>LL</sub> Strength I', 'ts.gam.ll', '')}${fld('γ Fatigue I', 'ts.gam.fat', '')}</div>
-        ${secHd('sec-tsr', 'Stiffener locations')}<div class="sec-body one-col" id="sec-tsr">${gmRowsHtml('ts')}<p class="note">Shears at the stiffener, per girder, magnitudes. Panel 1 and panel 2 are the web panels on either side. Δf is the unfactored fatigue-truck stress range in the tension flange at the stiffener (0 to skip).</p></div>`,
+        ${secHd('sec-tsr', 'Stiffener locations')}<div class="sec-body one-col" id="sec-tsr">${gmRowsHtml('ts')}<p class="note">Shears at the stiffener, per girder, magnitudes. Panel 1 and panel 2 are the web panels on either side. When panel 1 is an end panel, the four end-panel shears are the largest in that panel (at the bearing) and TS4 checks it with them; leave all four blank to use the shears at the stiffener. Δf is the unfactored fatigue-truck stress range in the tension flange at the stiffener (0 to skip).</p></div>`,
       ts_pl: `${secHd('sec-tsA', 'Type A')}<div class="sec-body" id="sec-tsA">${ty('A')}</div>${secHd('sec-tsB', 'Type B')}<div class="sec-body" id="sec-tsB">${ty('B')}</div>
@@ -2414,2 +2419,3 @@
     const rows = numRows(p.rows, TS_ROWSPEC, 'Location', errors);
+    rows.forEach(r => { const n = TS_BRG.filter(k => r[k] != null).length; if (n && n < 4) errors.push(`${r.name}: enter all four end-panel shears, or leave all four blank.`); });
     if (!rows.length) errors.push('Add at least one stiffener location.');
@@ -2418,5 +2424,8 @@
       r.Vu = g('dc') * (r.VDC1 + r.VDC2) + g('dw') * r.VDW + g('ll') * r.VLL;
+      // end panel (Q4): the largest V_u in panel 1 (at the bearing) when the end-panel shears are given; otherwise the shear at the stiffener
+      r.VuB = r.end === 'yes' && r.VDC1b != null ? g('dc') * (r.VDC1b + r.VDC2b) + g('dw') * r.VDWb + g('ll') * r.VLLb : null;
+      r.Vu1 = r.VuB != null ? Math.max(r.VuB, r.Vu) : r.Vu;
       const flgA = r.bfc * r.tfc + r.bft * r.tft;
       r.p1 = webShear(r.D, r.tw, Fyw, r.do1, flgA, r.end === 'yes'); r.p2 = webShear(r.D, r.tw, Fyw, r.do2, flgA, false);
-      [r.p1, r.p2].forEach((q, i) => { q.do = i ? r.do2 : r.do1; q.end = !i && r.end === 'yes'; q.phVn = PHI.v * q.Vn; const tfa = q.stiff && !q.end; q.rho = tfa && r.Vu > PHI.v * q.Vcr ? Math.min(1, (r.Vu - PHI.v * q.Vcr) / Math.max(q.phVn - PHI.v * q.Vcr, 1e-9)) : 0; });
+      [r.p1, r.p2].forEach((q, i) => { q.do = i ? r.do2 : r.do1; q.end = !i && r.end === 'yes'; q.Vu = i ? r.Vu : r.Vu1; q.phVn = PHI.v * q.Vn; const tfa = q.stiff && !q.end; q.rho = tfa && r.Vu > PHI.v * q.Vcr ? Math.min(1, (r.Vu - PHI.v * q.Vcr) / Math.max(q.phVn - PHI.v * q.Vcr, 1e-9)) : 0; });
       r.rhow = Math.max(r.p1.rho, r.p2.rho);
@@ -2448,5 +2457,5 @@
     { const c = { id: 'TS4', grp: G2, title: 'Web shear resistance of adjacent panels', ref: 'AASHTO LRFD 6.10.9.3.2, 6.10.9.3.3', src: 'Code', sym: T`V_u \le \phi_vV_n, \quad \phi_v = 1.0`,
-        cols: ['Location, panel', 'd_o (in)', 'V_u (kip)', 'C', 'φV_n (kip)', 'Ratio'], items: [], note: 'Interior stiffened panels include tension-field action (Eq. 6.10.9.3.2-2 or -8); stiffened end panels (d_o ≤ 1.5D) use V_n = CV_p with k = 5 + 5/(d_o/D)² (Eq. 6.10.9.3.3-1). Interior panels wider than 3D and end panels wider than 1.5D are unstiffened (6.10.9.1): k = 5, V_n = CV_p (Eq. 6.10.9.2-1). V_u is the Strength I shear at the stiffener, applied to both adjacent panels.' };
-      R.rows.forEach(r => [r.p1, r.p2].forEach((q, i) => c.items.push(rc(`${L(r)}, panel ${i + 1}${q.end ? ' (end)' : ''}`, [f2(q.do), f2(r.Vu), f3(q.C), f2(q.phVn), f2(r.Vu / q.phVn)], r.Vu, q.phVn,
-        T`k = ${q.stiff ? T`5 + \frac{5}{(${f2(q.do)}/${f2(r.D)})^2}` : '5'} = ${f3(q.k)}, \quad C = ${f3(q.C)}, \quad V_p = 0.58(${f0(R.Fyw)})(${f2(r.D)})(${f3(r.tw)}) = ${f2(q.Vp)}, \quad \phi_vV_n = ${f2(q.phVn)}\ \text{kip (Eq. ${q.eqn})} \;${GE(q.phVn, r.Vu)}\; V_u = ${f2(r.Vu)}\ \text{kip}`))));
+        cols: ['Location, panel', 'd_o (in)', 'V_u (kip)', 'C', 'φV_n (kip)', 'Ratio'], items: [], note: 'Interior stiffened panels include tension-field action (Eq. 6.10.9.3.2-2 or -8); stiffened end panels (d_o ≤ 1.5D) use V_n = CV_p with k = 5 + 5/(d_o/D)² (Eq. 6.10.9.3.3-1). Interior panels wider than 3D and end panels wider than 1.5D are unstiffened (6.10.9.1): k = 5, V_n = CV_p (Eq. 6.10.9.2-1). V_u is the Strength I shear at the stiffener, applied to both adjacent panels; an end panel is checked with the largest V_u in it (at the bearing, from the end-panel shears), or with the shear at the stiffener when they are blank (the item says which).' };
+      R.rows.forEach(r => [r.p1, r.p2].forEach((q, i) => c.items.push(rc(`${L(r)}, panel ${i + 1}${q.end ? ' (end)' : ''}`, [f2(q.do), f2(q.Vu), f3(q.C), f2(q.phVn), f2(q.Vu / q.phVn)], q.Vu, q.phVn,
+        T`k = ${q.stiff ? T`5 + \frac{5}{(${f2(q.do)}/${f2(r.D)})^2}` : '5'} = ${f3(q.k)}, \quad C = ${f3(q.C)}, \quad V_p = 0.58(${f0(R.Fyw)})(${f2(r.D)})(${f3(r.tw)}) = ${f2(q.Vp)}, \quad \phi_vV_n = ${f2(q.phVn)}\ \text{kip (Eq. ${q.eqn})} \;${GE(q.phVn, q.Vu)}\; V_u = ${f2(q.Vu)}\ \text{kip}${!q.end ? '' : r.VuB != null ? T`\ \text{(largest in the end panel: ${r.VuB >= r.Vu ? 'at the bearing' : 'at the stiffener'})}` : T`\ \text{(at the stiffener: no end-panel shears given)}`}`))));
       out.add(c); }
@@ -2473,6 +2482,6 @@
   },
-  kq(R) { return Object.values(R.types).filter(t => R.rows.some(r => r.type === t.k)).map(t => [`Type ${t.k}, ${t.name}`, `${t.sides === 2 ? 'Pair' : 'One side'}, ${frac(t.bt)} × ${frac(t.tp)}`]).concat([['Locations', String(R.rows.length)], ['Max. V<sub>u</sub>', `${f2(Math.max(...R.rows.map(r => r.Vu)))} kip`]]); },
+  kq(R) { return Object.values(R.types).filter(t => R.rows.some(r => r.type === t.k)).map(t => [`Type ${t.k}, ${t.name}`, `${t.sides === 2 ? 'Pair' : 'One side'}, ${frac(t.bt)} × ${frac(t.tp)}`]).concat([['Locations', String(R.rows.length)], ['Max. V<sub>u</sub>', `${f2(Math.max(...R.rows.map(r => r.Vu1)))} kip`]]); },
   scope: ['Bearing stiffeners (use the Bearing stiffeners module)', 'Longitudinal stiffeners', 'Cross-frame member and connection forces (use the Cross-frames module)', 'Distortion-induced fatigue from differential girder deflection in skewed bridges'],
   combos(R) { let h = card('cb-g', 'Strength I and Fatigue I', 'AASHTO LRFD Table 3.4.1-1', `<p class="note-p">Strength I gives the shear used for the web panels and the tension-field ratio; Fatigue I (γ = ${f2(R.g.fat)}) gives the stress range at the weld toes.</p>` + eq('Strength I shear', '', T`V_u = ${f2(R.g.dc)}(V_{DC1} + V_{DC2}) + ${f2(R.g.dw)}V_{DW} + ${f2(R.g.ll)}V_{LL+IM}`));
-    R.rows.forEach(r => h += card('cb-r' + r.i, esc(r.name), `Type ${r.type}`, eq('Strength I', '', T`V_u = ${f2(R.g.dc)}(${f2(r.VDC1)} + ${f2(r.VDC2)}) + ${f2(R.g.dw)}(${f2(r.VDW)}) + ${f2(R.g.ll)}(${f2(r.VLL)}) = ${f2(r.Vu)}\ \text{kip}`) + (r.df > 0 ? eq('Fatigue I', '', T`\gamma(\Delta f) = ${f2(R.g.fat)}(${f2(r.df)}) = ${f2(r.fat)}\ \text{ksi}`) : '')));
+    R.rows.forEach(r => h += card('cb-r' + r.i, esc(r.name), `Type ${r.type}`, eq('Strength I', '', T`V_u = ${f2(R.g.dc)}(${f2(r.VDC1)} + ${f2(r.VDC2)}) + ${f2(R.g.dw)}(${f2(r.VDW)}) + ${f2(R.g.ll)}(${f2(r.VLL)}) = ${f2(r.Vu)}\ \text{kip}`) + (r.VuB != null ? eq('Strength I, end panel (largest in panel 1, at the bearing)', '', T`V_u = ${f2(R.g.dc)}(${f2(r.VDC1b)} + ${f2(r.VDC2b)}) + ${f2(R.g.dw)}(${f2(r.VDWb)}) + ${f2(R.g.ll)}(${f2(r.VLLb)}) = ${f2(r.VuB)}\ \text{kip}`) : '') + (r.df > 0 ? eq('Fatigue I', '', T`\gamma(\Delta f) = ${f2(R.g.fat)}(${f2(r.df)}) = ${f2(r.fat)}\ \text{ksi}`) : '')));
     return h; },
@@ -2482,3 +2491,3 @@
     return { kv: [['Grades: web / stiffeners', `${P.ts.gW} / ${P.ts.gS}`], ['F_EXX', f0(R.Fexx), 'ksi'], ['Load factors DC / DW / LL / Fatigue', `${f2(R.g.dc)} / ${f2(R.g.dw)} / ${f2(R.g.ll)} / ${f2(R.g.fat)}`], t('A'), t('B')],
-      table: [['Location', 'Type', 'Web', 'Flanges (top / bottom)', 'd_o 1 / 2', 'V: DC1 / DC2 / DW / LL', 'Δf'], R.rows.map(r => [esc(r.name), r.type, `${frac(r.D)} × ${frac(r.tw)}`, `${frac(r.bfc)} × ${frac(r.tfc)} / ${frac(r.bft)} × ${frac(r.tft)}`, `${f2(r.do1)}${r.end === 'yes' ? ' (end)' : ''} / ${f2(r.do2)}`, `${f2(r.VDC1)} / ${f2(r.VDC2)} / ${f2(r.VDW)} / ${f2(r.VLL)}`, f2(r.df)])] }; },
+      table: [['Location', 'Type', 'Web', 'Flanges (top / bottom)', 'd_o 1 / 2', 'V: DC1 / DC2 / DW / LL', 'Δf'], R.rows.map(r => [esc(r.name), r.type, `${frac(r.D)} × ${frac(r.tw)}`, `${frac(r.bfc)} × ${frac(r.tfc)} / ${frac(r.bft)} × ${frac(r.tft)}`, `${f2(r.do1)}${r.end === 'yes' ? ' (end)' : ''} / ${f2(r.do2)}`, `${f2(r.VDC1)} / ${f2(r.VDC2)} / ${f2(r.VDW)} / ${f2(r.VLL)}${r.end === 'yes' && r.VDC1b != null ? `; end panel ${f2(r.VDC1b)} / ${f2(r.VDC2b)} / ${f2(r.VDWb)} / ${f2(r.VLLb)}` : ''}`, f2(r.df)])] }; },
   inbox(j) { return j && j.mods && j.mods.ts && j.mods.ts.rows.length ? { n: j.mods.ts.rows.length, what: 'stiffener locations', apply: () => { P.ts.rows = clone(j.mods.ts.rows); if (j.mods.ts.types) ['A', 'B'].forEach(k => Object.assign(P.ts.types[k], j.mods.ts.types[k])); if (j.mods.ts.gW) P.ts.gW = j.mods.ts.gW; } } : null; }
```

### Exact changes (Q4): decoded PlateLine (unified diff)

```diff
--- PlateLine (decoded PL_B64, main f16c6bf)
+++ PlateLine (after Q4)
@@ -3470,2 +3470,5 @@
   const shear = (T, x) => { const e = el(x); return { VDC1: r1(vmax(T.VDC1, e)), VDC2: r1(vmax(T.VDC2, e)), VDW: r1(vmax(T.VDW, e)), VLL: r1(Math.max(vmax(T.Vp, e), vmax(T.Vn, e))) }; };
+  // end panel (Q4): the largest shears in the elements between the bearing and the first stiffener (a < b), for GirderDetail's TS4 end-panel check
+  const shearIn = (T, a, b) => { const mx = arr => { let v = 0; for (let e = 0; e < N - 1; e++) if (xs[e] < b - 1e-9 && xs[e + 1] > a + 1e-9) v = Math.max(v, Math.abs(arr[e] || 0)); return v; };
+    return { VDC1b: r1(mx(T.VDC1)), VDC2b: r1(mx(T.VDC2)), VDWb: r1(mx(T.VDW)), VLLb: r1(Math.max(mx(T.Vp), mx(T.Vn))) }; };
   const nS = m.sup.length, supN = k => k === 0 ? 'Abut. 1' : k === nS - 1 ? 'Abut. 2' : `Pier ${k}`;
@@ -3476,3 +3479,3 @@
       [[x0 + doFt, k, 1], [x1 - doFt, k + 1, -1]].forEach(([x, ks, dir]) => { const s = sec(x), end = ks === 0 || ks === nS - 1;
-        ts.rows.push({ name: `Span ${k + 1}, first ${stiff ? 'stiffener' : 'connection plate'} from ${supN(ks)}, ${TT(gt)}`, type: stiff ? 'A' : 'B', D: s.D, tw: s.tw, bfc: s.topB, tfc: s.topT, bft: s.botB, tft: s.botT, bfw: bfw(x), end: end ? 'yes' : 'no', do1: r2(doIn), do2: r2(doIn), ...shear(T, x), df: 0 }); });
+        ts.rows.push({ name: `Span ${k + 1}, first ${stiff ? 'stiffener' : 'connection plate'} from ${supN(ks)}, ${TT(gt)}`, type: stiff ? 'A' : 'B', D: s.D, tw: s.tw, bfc: s.topB, tfc: s.topT, bft: s.botB, tft: s.botT, bfw: bfw(x), end: end ? 'yes' : 'no', do1: r2(doIn), do2: r2(doIn), ...shear(T, x), df: 0, ...(end ? shearIn(T, Math.min(x, m.sup[ks]), Math.max(x, m.sup[ks])) : {}) }); });
       let best = -1, bx = (x0 + x1) / 2; xs.forEach((x, i) => { if (x > x0 && x < x1) { const rg = T.MfP[i] - T.MfN[i]; if (rg > best) { best = rg; bx = x; } } });
```

### Q5. Simple spans: the panels next to an interior support are end panels   [§4: panel classification change] [no formula, factor or saved-data change]

- **Where (decoded PlateLine):** `detailExport()`, transverse stiffener rows (PL ≈ 3479; anchor `[[x0 + doFt, k, 1], [x1 - doFt, k + 1, -1]].forEach(([x, ks, dir]) => { const s = sec(x), end =`).
- **Before:** `end = ks === 0 || ks === nS - 1` (only the panels next to the abutments).
- **After:** `end = ks === 0 || ks === nS - 1 || !m.cont` (comment added). `m.cont` is `bridge.cont === 'continuous' && spans > 1`, so for simple spans every first stiffener (or connection plate) from a pier is an end panel; continuous units are unchanged. Such a row is sent with `end: 'yes'` and, with Q4, the end-panel shears (`VDC1b` …). In GirderDetail it therefore gets the 1.5D limit of TS5, the end-panel resistance of TS4 (no tension field; k = 5 when d<sub>o</sub> > 1.5D per EK1), and Q4's bearing shear. EK3's web sizing already treated these panels as end panels (`ends = cont ? [0, Ltot] : supX`), so Suggest / Full design results are unchanged.
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 6.10.9.3.3 (end panels: the panels adjacent to the simple supports / girder ends, V<sub>n</sub> = CV<sub>p</sub>, d<sub>o</sub> ≤ 1.5D) and Art. 6.10.9.1; a simple span is a girder with a bearing at each end, including over a pier.
- **Problem:** for a simple-span bridge with more than one span, the panels at the piers were checked as interior panels (tension-field action, 3D limit), which 6.10.9.3.3 does not allow at a girder end. Unconservative.
- **Check case (2 × 120 ft simple spans, default bridge otherwise, stiffened, d<sub>o</sub>/D = 2, quick suggestion applied: D = 47 in, t<sub>w</sub> = 1/2 in, F<sub>yw</sub> = 50 ksi; Transverse stiffeners → Get demands):** Span 1, first stiffener from Pier 1, interior girder, panel 1, d<sub>o</sub> = 94 in:
  - D/t<sub>w</sub> = 94, (D/t<sub>w</sub>)² = 8,836; V<sub>p</sub> = 0.58(50)(47)(0.5) = 681.50 kip.
  - Before (interior panel, stiffened, k = 5 + 5/2² = 6.25): √(29,000 × 6.25/50) = 60.21, 1.40 × 60.21 = 84.29 < 94, C = 1.57 × 3,625/8,836 = 0.644; tension field (2Dt<sub>w</sub>/(b<sub>fc</sub>t<sub>fc</sub> + b<sub>ft</sub>t<sub>ft</sub>) ≤ 2.5, Eq. 6.10.9.3.2-2): V<sub>n</sub> = 681.50[0.644 + 0.87(1 − 0.644)/√(1 + 2²)] = 681.50 × 0.7826 = **533.32 kip**; V<sub>u</sub> at the stiffener = 1.25(73.7 + 13.4) + 1.50(11.1) + 1.75(107.5) = 108.88 + 16.65 + 188.13 = **313.65 kip**; ratio **0.59**. TS5: 94 ≤ 3(47) = 141 in, pass.
  - After (end panel, d<sub>o</sub> = 94 > 1.5D = 70.5 in, unstiffened per EK1, k = 5): √(29,000 × 5/50) = 53.85, C = 1.57 × 2,900/8,836 = 0.515; V<sub>n</sub> = 0.515 × 681.50 = **351.16 kip** (Eq. 6.10.9.2-1); V<sub>u</sub> at the bearing (Q4) = 1.25(81.5 + 14.9) + 1.50(12.3) + 1.75(115.3) = 120.50 + 18.45 + 201.78 = **340.73 kip**; ratio **0.97** (pass). TS5: 94 > 70.5 in, advisory "(treated as unstiffened in TS4)".
  - The other pier panels: Span 2 interior 313.90 kip / 0.59 → 341.23 kip / 0.97; exterior 283.48 / 0.53 → 308.23 / 0.88 (Span 1) and 283.73 / 0.53 → 308.60 / 0.88 (Span 2). The abutment panels (already end panels) change with Q4 only: 313.77 → 340.98 kip (0.89 → 0.97). Status: all checks pass before and after.
- **Check case (2 × 90 ft simple spans, 10 girders at 4 ft, overhangs 2.25 ft, quick suggestion D = 30 in, t<sub>w</sub> = 1/2 in, connection plates only at 25 ft, d<sub>o</sub> = 300 in):** pier rows `end: 'no'` → `'yes'` (location text "panel 1" → "panel 1 (end)"); φ<sub>v</sub>V<sub>n</sub> = 435.00 kip both (unstiffened, C = 1.0); V<sub>u</sub> (Q4) interior 91.00 → 153.38 kip (0.21 → 0.35), exterior 77.58 → 133.65 kip (0.18 → 0.31); TS5 not applicable in both (connection plates only).
- **Unchanged:** continuous units (2 × 90 ft continuous: TS rows and every TS check identical to Q4 alone; the built-in 110-140-110 ft example: identical), single simple spans (both supports are abutments), Suggest / Full design / Alternatives / width study results (EK3 already sized these ends).
- **How verified:** `node --check`; headless Chromium Q4-only vs Q4 + Q5 for the cases above.
- **Other copies:** none. **Open items:** none.

### Exact changes (Q5): decoded PlateLine (unified diff)

```diff
--- PlateLine (after Q4)
+++ PlateLine (after Q5)
@@ -3478,3 +3478,4 @@
     spans.forEach(k => { const x0 = m.sup[k], x1 = m.sup[k + 1];
-      [[x0 + doFt, k, 1], [x1 - doFt, k + 1, -1]].forEach(([x, ks, dir]) => { const s = sec(x), end = ks === 0 || ks === nS - 1;
+      // end panel: next to an abutment, or next to any support of a simple span (each span is a girder with two ends; Q5)
+      [[x0 + doFt, k, 1], [x1 - doFt, k + 1, -1]].forEach(([x, ks, dir]) => { const s = sec(x), end = ks === 0 || ks === nS - 1 || !m.cont;
         ts.rows.push({ name: `Span ${k + 1}, first ${stiff ? 'stiffener' : 'connection plate'} from ${supN(ks)}, ${TT(gt)}`, type: stiff ? 'A' : 'B', D: s.D, tw: s.tw, bfc: s.topB, tfc: s.topT, bft: s.botB, tft: s.botT, bfw: bfw(x), end: end ? 'yes' : 'no', do1: r2(doIn), do2: r2(doIn), ...shear(T, x), df: 0, ...(end ? shearIn(T, Math.min(x, m.sup[ks]), Math.max(x, m.sup[ks])) : {}) }); });
```

### Q6. PlateLine Bridge tab: girder spacing "From exterior girders"   [new input mode] [no calculation change] [optional saved field `bridge.Wcc`]

- **What it does:** Girder spacing gets a third option beside Equal and Variable, **From exterior girders**: input W<sub>cc</sub>, the center-to-center distance between the exterior girders (ft, new optional field `bridge.Wcc`). **S = W<sub>cc</sub>/(N<sub>b</sub> − 1)**, recomputed whenever N<sub>b</sub> or W<sub>cc</sub> changes (every recompute), and shown read-only under the input with the out-to-out deck width W<sub>cc</sub> + left overhang + right overhang. In this mode the "Girder spacing S (equal)" input is hidden (as the bay list is hidden for Equal). When the mode is first selected with no W<sub>cc</sub>, W<sub>cc</sub> starts at the current layout's sum of bays (so the geometry does not change).
- **How S reaches every consumer (design decision):** the computed S is written to `bridge.S` (the mode is equal spacing with S derived), so every reader of `P.bridge.S` / equal spacing is unchanged: `brGeom()` (only `'variable'` reads the bay list), `buildModel`, Suggest (`suggestLayout`, quick check, Full design), girder-count / width study, Alternatives, quantities and costs, drawings, GirderDetail's bridge definition (`bridgeDef()`, which already sends the computed `nb`, `S`, `bays`), detail demands (`detailExport`), the DXF/report bay text (`B.spacing === 'variable' ? ... : nb − 1 @ S`). The geometry signature `sgGeoSig()` signs the mode as `'equal'`, so GirderDetail's LLDF/DL factors (matched by that signature, `sgDfx`) still apply to the same bridge, and the `gd-bridge` payload is identical to Equal mode. The `bridgeSuite.v1.*` handoff code and payloads are not touched.
- **Applies (width study "Apply", its Full design "Apply", Alternatives "Apply"):** they set N<sub>b</sub> and S as before. Before, they always set `spacing = 'equal'`; now, if the mode is "From exterior girders" it is kept and W<sub>cc</sub> = (N<sub>b</sub> − 1)·S (unrounded S of the result, 6 decimals), so S stays the applied spacing (to < 1e-6 ft; S is then re-derived from W<sub>cc</sub>); in Equal or Variable mode they set Equal exactly as before (`spKeepExt()`). Alternatives keep the deck width and overhangs, so W<sub>cc</sub> is unchanged by them (case below: 40 → 40); the width study changes the overhangs, so W<sub>cc</sub> follows (40 → 39 with 4 girders at 13 ft, overhangs 2.75 ft, out-to-out 44.50 ft).
- **Where (decoded PlateLine):**
  - Bridge tab inputs (PL ≈ 4125; anchor `${fld('Girder spacing', 'bridge.spacing', '', 'sel'`): option `['exterior', 'From exterior girders']`; `fld('Exterior girders, center to center W<sub>cc</sub>', 'bridge.Wcc', 'ft')` after the bay list; `<p class="hint static full" id="br-wcc-info">`.
  - `syncSpacingVis()` (PL ≈ 4211): also hides `bridge.S` and shows `bridge.Wcc` in the new mode; new `spExtS()`, `spExtSync()`, `spExtInfo()`, `spKeepExt()` after it.
  - `onScalar()` (PL ≈ 4228): first selection of the mode with no W<sub>cc</sub> sets W<sub>cc</sub> = Σ bays.
  - `recompute()` (PL ≈ 4297): `spExtSync()` first (S = W<sub>cc</sub>/(N<sub>b</sub> − 1) when the mode is on and the inputs are valid; also updates the hidden S input).
  - `brGeom()` (PL ≈ 1088): input errors "Girder spacing from the exterior girders: enter a positive center-to-center distance between the exterior girders." and "... needs at least 2 girders." (mode on only).
  - `sgGeoSig()` (PL ≈ 1808): `(B.spacing === 'exterior' ? 'equal' : B.spacing) || 'equal'`.
  - `wsApply()`, `wsfApply()`, `applyAlt()`: `P.bridge.spacing = 'equal'` → `spKeepExt(P.bridge, r.S)`.
  - Manual: "Variable spacing and deck edges" paragraph and the input table (row W<sub>cc</sub>).
- **§4:** no formula, factor, unit or reference changed; S is derived as stated, and with the same N<sub>b</sub> and S every result is identical to Equal mode (verified below).
- **Check case (built-in example, 5 girders at 9.5 ft, overhangs 3.25 ft):** select "From exterior girders": W<sub>cc</sub> = 38 ft, S = 38/4 = 9.500 ft, out-to-out 38 + 3.25 + 3.25 = 44.50 ft. N<sub>b</sub> = 6: S = 38/5 = 7.600 ft (model bays 5 × 7.6). Same bridge in Equal mode with N<sub>b</sub> = 6, S = 7.6: fast suggestion, `detailExport`, `bridgeDef` (without `ts`), `sgGeoSig`, every PlateLine check status, and GirderDetail's received `P.df.bridge`: identical. W<sub>cc</sub> = 40: S = 8.000 ft, out-to-out 46.50 ft. W<sub>cc</sub> blank: input error (above). N<sub>b</sub> = 1: input error. Switching back to Equal shows S = 7.6 in the S input.
- **Saved data:** no key changed. `bridge.Wcc` is only written when the mode is used (not added to the defaults), so projects that do not use it save exactly as before. A project saved in the new mode loads in main with an identical `P.bridge` and identical model (main reads `spacing: 'exterior'` as equal spacing with the stored S; its select shows blank because main has no such option); it loads in the branch unchanged. Old projects load as before.
- **UI:** Equal and Variable modes: the Cross-section section is pixel-identical to main (screenshots). New mode: W<sub>cc</sub> in the S cell, the read-only line below it (full width), the rest of the section flows on.
- **How verified:** `node --check`; headless Chromium (case above; Alternatives Apply and width-study Apply run in the new mode — the width study's Full design Apply uses the same `spKeepExt()` line and was not run; saved data both directions; no console errors).
- **Other copies:** none. **Open items:** none.

### Exact changes (Q6): decoded PlateLine (unified diff)

```diff
--- PlateLine (after Q5)
+++ PlateLine (after Q6)
@@ -1087,2 +1087,3 @@
     if (bays.some(v => !(v > 0))) errs.push('Variable spacing: every bay must be a positive number.'); }
+  if (b.spacing === 'exterior') { if (!(num(b.Wcc) > 0)) errs.push('Girder spacing from the exterior girders: enter a positive center-to-center distance between the exterior girders.'); if (!(nb >= 2)) errs.push('Girder spacing from the exterior girders needs at least 2 girders.'); }
   const S = bays.length ? bays.reduce((a, v) => a + v, 0) / bays.length : num(b.S);
@@ -1807,3 +1808,3 @@
 function sgGeoSig(B, D, top, bot, web) { const r3 = v => Math.round(+v * 1000) / 1000, L = r => r3(r.L != null ? r.L : r.x1 - r.x0);
-  return JSON.stringify([B.nb, B.S, B.spacing || 'equal', B.bays || '', B.ohL, B.ohR, B.barrier, B.edge || null, B.spans, B.skews, B.ts, B.haunch, B.fc, B.wc, r3(D), top.map(r => [L(r), +r.b, +r.t]), bot.map(r => [L(r), +r.b, +r.t]), web.map(r => [L(r), +r.t])]); }
+  return JSON.stringify([B.nb, B.S, (B.spacing === 'exterior' ? 'equal' : B.spacing) || 'equal', B.bays || '', B.ohL, B.ohR, B.barrier, B.edge || null, B.spans, B.skews, B.ts, B.haunch, B.fc, B.wc, r3(D), top.map(r => [L(r), +r.b, +r.t]), bot.map(r => [L(r), +r.b, +r.t]), web.map(r => [L(r), +r.t])]); }
 function sgDfx(P, D, top, bot, web, ext) {
@@ -2419,3 +2420,3 @@
 <h3>Analysis model</h3><p>The analysis of the current design uses a variable-stiffness, staged line-girder model: DC1 on the steel section, DC2 and DW on the long-term composite section, and live load on the short-term composite section, with the composite stages cracked near interior supports. Its settings (staged or constant EI, cracked zones, deck reinforcement) are made in GirderDetail's Structural analysis module. Suggest mode searches trial layouts with the faster constant-EI model and then designs the chosen layout with the staged model.</p>
-<h3>Variable spacing and deck edges</h3><p>On the Bridge tab, <b>Girder spacing</b> can be <i>Variable</i>: enter the bay spacings from left to right (one fewer than the number of girders). The framing plan, cross-section, deck width, and GirderDetail's LLDF and DLs module use each bay; the sizing checks and the built-in approximate distribution factors use the average spacing, and the spacing and overhang checks are made bay by bay. <b>Deck edges</b> can be a barrier (width and the Suggest barrier weight) or a <i>curb and railing</i> on each side: curb width and height, railing load point and weight, and the distance from the deck edge to the traffic face, which sets the roadway. When GirderDetail's LLDF and DLs module is in use, its factors and MassDOT dead loads replace the built-in ones (see the Analysis tab).</p>
+<h3>Variable spacing and deck edges</h3><p>On the Bridge tab, <b>Girder spacing</b> can be <i>Variable</i>: enter the bay spacings from left to right (one fewer than the number of girders). It can also be <i>From exterior girders</i>: enter the center-to-center distance W<sub>cc</sub> between the two exterior girders, and the equal spacing is S = W<sub>cc</sub>/(N<sub>b</sub> − 1), recomputed whenever N<sub>b</sub> or W<sub>cc</sub> changes and shown with the out-to-out deck width W<sub>cc</sub> + left overhang + right overhang; everything else then works exactly as with equal spacing S. The framing plan, cross-section, deck width, and GirderDetail's LLDF and DLs module use each bay; the sizing checks and the built-in approximate distribution factors use the average spacing, and the spacing and overhang checks are made bay by bay. <b>Deck edges</b> can be a barrier (width and the Suggest barrier weight) or a <i>curb and railing</i> on each side: curb width and height, railing load point and weight, and the distance from the deck edge to the traffic face, which sets the roadway. When GirderDetail's LLDF and DLs module is in use, its factors and MassDOT dead loads replace the built-in ones (see the Analysis tab).</p>
 <h3>Reverting a suggestion</h3><p>Applying a suggested layout (Suggest tab) or an alternative (Alternatives tab) keeps a copy of the design from just before it. A banner above the output tabs then offers <b>Revert to the previous design</b>; after reverting, the same button re-applies the change, so you can compare the two. The copy survives a reload and is replaced the next time you apply a suggestion or alternative. <b>Keep and dismiss</b> discards it.</p>
@@ -2448,2 +2449,3 @@
 <tr><td>Girder spacing S</td><td>ft</td><td>Uniform center-to-center spacing.</td></tr>
+<tr><td>Exterior girders, center to center W<sub>cc</sub></td><td>ft</td><td>Spacing mode "From exterior girders" only: S = W<sub>cc</sub>/(N<sub>b</sub> − 1).</td></tr>
 <tr><td>Overhangs</td><td>ft</td><td>Exterior girder centerline to edge of deck, each side.</td></tr>
@@ -3769,3 +3771,3 @@
   snapshotBefore(`Girder count from deck width (${r.N} girders at ${f2(r.S)} ft)`);
-  P.bridge.nb = r.N; P.bridge.S = +r.S.toFixed(4); P.bridge.spacing = 'equal'; P.bridge.ohL = r.oh; P.bridge.ohR = r.oh; P.girder = JSON.parse(JSON.stringify(r.girder)); P.framing.stiff = r.framing.stiff; P.framing.doRatio = r.framing.doRatio;
+  P.bridge.nb = r.N; P.bridge.S = +r.S.toFixed(4); spKeepExt(P.bridge, r.S); P.bridge.ohL = r.oh; P.bridge.ohR = r.oh; P.girder = JSON.parse(JSON.stringify(r.girder)); P.framing.stiff = r.framing.stiff; P.framing.doRatio = r.framing.doRatio;
   fillInputs(); ['web', 'top', 'bot', 'spl'].forEach(renderArr); recompute(); setOTab('summary'); autosave(); }
@@ -3856,3 +3858,3 @@
   snapshotBefore(`Girder count from deck width, full design (${r.N} girders at ${f2(r.S)} ft)`);
-  P.bridge.nb = r.N; P.bridge.S = +r.S.toFixed(4); P.bridge.spacing = 'equal'; P.bridge.ohL = r.oh; P.bridge.ohR = r.oh; P.girder = JSON.parse(JSON.stringify(r.girder));
+  P.bridge.nb = r.N; P.bridge.S = +r.S.toFixed(4); spKeepExt(P.bridge, r.S); P.bridge.ohL = r.oh; P.bridge.ohR = r.oh; P.girder = JSON.parse(JSON.stringify(r.girder));
   P.framing.stiff = r.framing.stiff; if (r.webType === 'stiffened' && r.doR) P.framing.doRatio = r.framing.doRatio; if (r.spacing) P.framing.spacing = r.framing.spacing;
@@ -3977,3 +3979,3 @@
   snapshotBefore(`Alternative (${r.nb} girders at ${f2(r.S)} ft)`);
-  P.bridge.nb = r.nb; P.bridge.S = +r.S.toFixed(4); P.bridge.spacing = 'equal'; P.girder = JSON.parse(JSON.stringify(r.girder)); P.framing.stiff = r.web === 'stiffened' ? 'on' : 'off';
+  P.bridge.nb = r.nb; P.bridge.S = +r.S.toFixed(4); spKeepExt(P.bridge, r.S); P.girder = JSON.parse(JSON.stringify(r.girder)); P.framing.stiff = r.web === 'stiffened' ? 'on' : 'off';
   fillInputs(); ['web', 'top', 'bot', 'spl'].forEach(renderArr); recompute(); setOTab('summary'); autosave();
@@ -4119,4 +4121,4 @@
       <div class="sec-body" id="sec-xs">
-        ${fld('Number of girders', 'bridge.nb', '')}${fld('Girder spacing', 'bridge.spacing', '', 'sel', { options: [['equal', 'Equal'], ['variable', 'Variable (bay by bay)']] })}
-        ${fld('Girder spacing S (equal)', 'bridge.S', 'ft')}${fld('Bay spacings, left to right (variable)', 'bridge.bays', 'ft', 'text')}
+        ${fld('Number of girders', 'bridge.nb', '')}${fld('Girder spacing', 'bridge.spacing', '', 'sel', { options: [['equal', 'Equal'], ['variable', 'Variable (bay by bay)'], ['exterior', 'From exterior girders']] })}
+        ${fld('Girder spacing S (equal)', 'bridge.S', 'ft')}${fld('Bay spacings, left to right (variable)', 'bridge.bays', 'ft', 'text')}${fld('Exterior girders, center to center W<sub>cc</sub>', 'bridge.Wcc', 'ft')}<p class="hint static full" id="br-wcc-info"></p>
         ${fld('Left overhang', 'bridge.ohL', 'ft')}${fld('Right overhang', 'bridge.ohR', 'ft')}
@@ -4205,3 +4207,13 @@
 }
-function syncSpacingVis() { const el = document.getElementById('f_bridge_bays'), ig = el && el.closest('.ig'); if (ig) ig.style.display = P.bridge.spacing === 'variable' ? '' : 'none'; }
+function syncSpacingVis() { const el = document.getElementById('f_bridge_bays'), ig = el && el.closest('.ig'); if (ig) ig.style.display = P.bridge.spacing === 'variable' ? '' : 'none';
+  const ext = P.bridge.spacing === 'exterior', vis = (id, on) => { const e = document.getElementById(id), g = e && e.closest('.ig'); if (g) g.style.display = on ? '' : 'none'; };
+  vis('f_bridge_S', !ext); vis('f_bridge_Wcc', ext); spExtInfo(); }
+/* girder spacing "From exterior girders" (Q6): S = W_cc/(N_b - 1) is kept in bridge.S (equal spacing), so every reader of bridge.S and the hand-offs are unchanged */
+function spExtS(b) { const nb = Math.round(Number(b.nb)), w = Number(b.Wcc); return b.spacing === 'exterior' && nb >= 2 && w > 0 ? w / (nb - 1) : null; }
+function spExtSync() { const s = spExtS(P.bridge); if (s != null && !(Math.abs(Number(P.bridge.S) - s) < 1e-6)) { P.bridge.S = s; const el = document.getElementById('f_bridge_S'); if (el) el.value = s; } spExtInfo(); }
+function spExtInfo() { const el = document.getElementById('br-wcc-info'); if (!el) return; const B = P.bridge, ext = B.spacing === 'exterior'; el.style.display = ext ? '' : 'none'; if (!ext) { el.innerHTML = ''; return; }
+  const s = spExtS(B), nb = Math.round(Number(B.nb)), w = Number(B.Wcc), oL = Number(B.ohL), oR = Number(B.ohR);
+  el.innerHTML = s == null ? 'Enter W<sub>cc</sub> (and at least 2 girders) to set the spacing.' : `S = W<sub>cc</sub>/(N<sub>b</sub> − 1) = ${f2(w)}/${nb - 1} = <b>${f3(s)} ft</b> (read-only). Out-to-out deck width = W<sub>cc</sub> + left + right overhang = ${f2(w)} + ${f2(oL)} + ${f2(oR)} = <b>${f2(w + oL + oR)} ft</b>.`; }
+/* an Apply that sets the girder count and equal spacing keeps the "From exterior girders" mode with W_cc = (N_b - 1)S; otherwise it sets equal spacing as before */
+function spKeepExt(B, S0) { if (B.spacing === 'exterior') B.Wcc = +((Math.round(Number(B.nb)) - 1) * S0).toFixed(6); else B.spacing = 'equal'; }
 function onScalar(e) {
@@ -4214,2 +4226,5 @@
   setPath(P, el.dataset.k, v);
+  if (el.dataset.k === 'bridge.spacing' && P.bridge.spacing === 'exterior' && !(Number(P.bridge.Wcc) > 0)) {   // start from the current layout: W_cc = sum of the bays
+    const nb = Math.round(Number(P.bridge.nb)), bays = M && !M.errors.length && M.bays && M.bays.length === nb - 1 ? M.bays : new Array(Math.max(nb - 1, 0)).fill(Number(P.bridge.S));
+    const w = bays.reduce((a, v) => a + v, 0); if (w > 0) { P.bridge.Wcc = +w.toFixed(4); const wi = document.getElementById('f_bridge_Wcc'); if (wi) wi.value = P.bridge.Wcc; } }
   if (el.dataset.k === 'bridge.spacing') syncSpacingVis();
@@ -4281,2 +4296,3 @@
 function recompute() {
+  spExtSync();   // "From exterior girders": S = W_cc/(N_b - 1) before anything reads bridge.S (Q6)
   const drn = $('#sg-dr-note'); if (drn) drn.hidden = !(P.limits.sdMandatory && P.suggest.depthRule === 'off');   // Suggest span-to-depth setting overridden by the Limits tab (2026-10-12)
```

### Verification (Q4–Q6)

- `node --check` on every inline script of the main page and of the decoded PlateLine. The base64 round trip of the unchanged page was byte-identical before editing.
- **Headless Chromium (Playwright), main vs branch, GirderDetail default project, every module** (gs, fa, splice, bstf, ts, sc, cf, oh, wt, df, sa): every check, status and item is identical. The only differences are the TS4 note and one TS4 worked line ("(at the stiffener: no end-panel shears given)").
- **PlateLine built-in example, 90 ft simple span and 120 ft simple span with d<sub>o</sub>/D = 2:** compared fast pick, quick suggestion, Full design (default and 90 ft), Apply, Transverse stiffeners and Girder section demands. The sizing, girder plates and every GS check are identical. Only the TS4 end-panel V<sub>u</sub> changes, as intended:
  - built-in example after Full design: 265.25 → 285.70 kip, ratio 0.57 → 0.61;
  - 90 ft simple span after Full design: 93.13 → 152.75 kip, ratio 0.21 → 0.35;
  - 120 ft simple span: 313.77 → 340.98 kip, ratio 0.89 → 0.97.
- **Built-in example, width study (W = 44.5 ft) and Full design:** results, table HTML and project identical (except the `dfx.ts` timestamp).
- **Hand-off payloads** (built-in example and 2 × 180 ft simple spans):
  - PlateLine → GirderDetail inbox: identical except the new optional `VDC1b`/`VDC2b`/`VDWb`/`VLLb` on end-panel TS rows, and (Q5, simple spans) `end: 'no'` → `'yes'` on the pier rows.
  - `bridgeDef` / `gd-bridge` and GirderDetail's `P.df.bridge`: identical.
  - localStorage key list: identical.
- **Saved data:** checked both directions for Q4 (TS rows with end-panel shears) and Q6 (project in the new spacing mode). See Q4 and Q6 above.
- **Console:** no errors in any run. One alert, "Preliminary sizing has input errors; fix them first.", appeared only while a test deliberately left N<sub>b</sub> = 1 or W<sub>cc</sub> blank. This is existing behaviour of GirderDetail's bridge refresh.
- **Screenshots** (session scratchpad `followups/gd-q4/`):
  - TS location row with the end-panel inputs, blank and filled;
  - TS Demands tab and TS4 card;
  - PlateLine Cross-section section in Equal and Variable modes (pixel-identical to main), the new mode (5 and 6 girders), blank W<sub>cc</sub>, and after width-study Apply.
- **Shared snippets:** none touched (no `bridgeSuite.v1.*` code).
