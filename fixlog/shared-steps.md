# Fix log — shared/steps.js (window.SharedSteps)

Loaded by (2026-11-07): `ASCE7-16 Load Generator.html`, `Pile Designer.html`, `Prestressed Bridge Design.html`,
`Light Pole and Sign Post.html`, `Shear and Moment Diagrams.html`, `abutment_calculator.html`, `Timber Beam Check.html`, `index.html`,
`Stone Masonry Arch Load Rating.html`, `Retaining Wall Designer.html`, `Section Property Calculator.html`, `Bridge Substructure Loading.html`,
`elastomeric_design_module.html`, `Concrete Beam Capacity.html`, `lldf.html`, `apps/steel-bridge/index.html`, `Gusset Plate Rating.html`,
`BasePlateAnchorDesigner.html`, `Moving Load Generator.html`, `Spread Footing.html`, `Steel Beam Design - AISC 15th.html`.
Tests: `node tests/engine/run.mjs` (steps, steps-totext, tex, report, …).

## 2026-11-07 — PR: fix/report-plaintext-tex (PR #1138: https://github.com/mlococo88/All-Structural/pull/1138) — plain-text report: TeX beyond the subset reads as text (TXP; display only)
### Where
- `render(src, html)`, plain-text path only (`html === false`, i.e. `toText()`, `line(step, false)`, `summary(t, false)`, and so
  `SharedReport.text()`). Anchor text: `/* TXP (2026-11-07): the plain-text path only`.
### Before / After
- Before: a command outside the README subset fell through to `else out += SYM[cmd] != null ? SYM[cmd] : cmd;`, i.e. its **name** was
  printed: `\mathrm{kips}` → `mathrmkips`, `\tfrac{B}{2}` → `tfracB2`, `\qquad` → `qquad`, `\varphi` → `varphi`, `\checkmark` → `checkmark`,
  `\!` → `!`, `\begin{cases}…` → `begincases…`.
- After: new constants before `function render` (`TSYM` symbol map: Greek variants and capitals, `\leq` `\geq` `\neq` `\Rightarrow` `\checkmark`
  `\lfloor` …; `TFRAC` `dfrac|tfrac|cfrac`; `TWRAP` font / wrapper commands `mathrm|mathbf|…|operatorname|boxed|…`; `TDROP` style and
  sizing commands `displaystyle|big|Big|…`; `TOPS` operator names `sin|cos|cot|log|…`; `TACC` accents), a function `txt(cmd)` inside
  `render` (after `const atom = …; let out = '';`), and in the command branch, before `if (cmd === 'frac')`:
  ```js
  if (!html && txt(cmd)) continue;   // TXP: plain text only
  ```
  plus, in the character branch before the final `else`:
  ```js
  else if (c === '&' && !html) { out += ' '; i++; }   // TXP: an alignment tab (cases, aligned) in plain text
  else if (c === '~' && !html) { out += ' '; i++; }   // TXP: a non-breaking space in plain text
  ```
  `txt(cmd)`: `\dfrac`/`\tfrac`/`\cfrac` as `\frac` (`a/b`, `(a+b)/c`); wrappers → their rendered content; style/size commands dropped;
  `\textcolor{c}{x}` → x; `\color{c}`, `\phantom{…}` dropped; `\stackrel{a}{b}` → b; `\quad` → 1 space, `\qquad` → 2, `\!` → nothing,
  `\:` `\>` → space; `\kern`/`\mkern`/`\hskip` with their dimension dropped; `\\` → `; `; `\&` `\#` `\$` → the character;
  `\begin{cases}` → `{ `, `\end{…}` → nothing (matrix / array → `[`…`]`); `\left.` / `\right.` → nothing (other brackets print as before);
  `\sqrt[n]{x}` → `n√(x)`; `\tag{x}` → ` (x)`; accents (`\hat`, `\vec`, `\tilde`, …) → combining character on one letter;
  `\not=` → ≠; operator names spaced like `\tan` (`m_x\cos^2\theta` → `m_x cos^2θ`); symbols from `TSYM`. Anything else falls
  through to the code as before.
- `toText(s, o)`, `line(s, html, o)`, `summary(t, html, o)`: new optional `o`; `o.legacy` gives the plain text exactly as before
  (render's third argument `rd` false: every TXP branch is skipped). Before: `const toText = s => render(String(s == null ? '' : s), false);`
  After: `const toText = (s, o) => render(String(s == null ? '' : s), false, !(o && o.legacy));`; in `line` / `summary`
  `toText` → `t => toText(t, o)`; recursive `render(group(), html)` → `render(group(), html, rd)`.
- Tools that use the plain text internally pass `{ legacy: true }` so their Report / labels / sheets stay as they were (each has its
  own fixlog entry): `Spread Footing.html` (`sfxApply`, `sfrfMove`), `Concrete Beam Capacity.html` (`rxRest`, CBRF), `Pile Designer.html`
  (`pdrRest`), `Section Property Calculator.html`, `index.html` (Report harvest), `ASCE7-16 Load Generator.html` (`a7xInline`),
  `abutment_calculator.html` (`abxInline`), `Gusset Plate Rating.html` (step labels), `BasePlateAnchorDesigner.html` and
  `Steel Beam Design - AISC 15th.html` (step notes), `apps/steel-bridge/engine/sheets.js` (`plain()`, drawing sheets).
  Without it, Concrete Beam Capacity's default Report lost one copied equation line (its harvest saw new numbers in the readable text).
### Problem
- The plain-text report (`SharedReport.text`) printed raw TeX command names, e.g. Spread Footing "W_f = 30.00 mathrmkips",
  "x = ±tfracB2", "mathrmDCR = 6.03/8.62 = mathbf0.70 checkmark", "N_q = e^(πtan varphi)tan^2!(45+tfracvarphi2),quad …".
### Governing provision
- None: display only. No formula, factor, unit or value changes; the HTML path (`toHTML`, with or without KaTeX) is not touched.
### Check case
- Spread Footing default project, card "Bearing check (effective-area uniform pressure)":
  before `mathrmDCR = 6.03/8.62 = mathbf0.70 checkmark`; after `DCR = 6.03/8.62 = 0.70 ✓` (same digits).
- "Footing self-weight": before `W_f = 30.00 mathrmkips  (acts at footing centroid)`; after `W_f = 30.00 kips  (acts at footing centroid)`.
- "Bearing capacity factors": before `N_q = e^(πtan varphi)tan^2!(45+tfracvarphi2),quad N_c = (N_q-1)cotvarphi,quad …`;
  after `N_q = e^(πtan φ)tan^2(45+φ/2),  N_c = (N_q-1) cot φ,  …`.
### How verified
- `node tests/engine/run.mjs steps-totext` (new, 11 tests) and the whole engine suite; `node tests/check-syntax.mjs`.
- `toHTML` of every TeX-bearing string literal in the repository (7,586 strings) is byte-identical to origin/main, and so is
  `toText(s, { legacy: true })`; `toText(s)` differs for 2,434 of them.
- Every consumer opened headless, origin/main vs this branch: the rendered report (`.rp-doc` textContent) and the page text are identical;
  only `SharedReport.text()` changes (see the PR).
### Other copies
- None. (`ASCE7-16 Load Generator.html` `a7xLite` and `abutment_calculator.html` `abxLite` pre-clean their own TeX before calling
  `toText`; unchanged.)
### Open items
- The built-in HTML renderer (used for `$…$` in report titles / cells and when KaTeX is not loaded) still prints the names of commands
  outside the subset (e.g. `mathrm`); not changed here (the screen / print must stay as it is). Raise separately if wanted.

## 2026-11-07 — PR: fix/steps-fallback-html (PR #1145: https://github.com/mlococo88/All-Structural/pull/1145) — built-in HTML renderer: TeX beyond the subset shown as HTML, not by command name (TXH; display only)
### Where
- `render(src, html, rd)`, built-in **HTML** path only (`html === true`), i.e. `toHTML()` when `window.katex` is absent (offline / CDN
  blocked), `line(step, true)` and `summary(t, true)` without KaTeX, and `SharedReport`'s `$…$` in titles, notes and table cells
  (`report.js` `lite()`, which always uses the built-in renderer, also when KaTeX is loaded). Anchor text: `/* TXH: one command of the built-in HTML path`.
### Before / After
- Before: on the HTML path a command outside the README subset fell through to `else out += SYM[cmd] != null ? SYM[cmd] : cmd;`, so its
  **name** was shown on screen and in print: `\mathrm{kips}` → `mathrmkips`, `\tfrac{B}{2}` → `tfracB2`, `\varphi` → `varphi`,
  `\qquad` → `qquad`, `\checkmark` → `checkmark`, `\!` → `!`, `\begin{bmatrix}…` → `beginbmatrix…`, `\parallel` → `parallel`, `\int` → `int`.
- After: new constant `HSYM` (after `TSYM`: `\textendash` – `\textemdash` — `\cdotp` · `\circlearrowleft` ↺ `\circlearrowright` ↻ `\emptyset` / `\varnothing` ∅;
  HTML only, so the plain text is unchanged), a function `htm(cmd)` inside `render` after `txt`, and in the command branch, after the TXP line:
  ```js
  if (!html && rd && txt(cmd)) continue;   // TXP: plain text only
  if (html && rd && htm(cmd)) continue;   // TXH: the built-in HTML path
  ```
  plus, in the character branch after the TXP `~` line:
  ```js
  else if (c === '~' && html && rd) { out += '&nbsp;'; i++; }   // TXH: a non-breaking space
  ```
  and `toHTML` (render's third argument `rd` true, so the TXH branches run):
  ```js
  // before
  const toHTML = s => { const t = String(s == null ? '' : s), K = kx(); return K && t ? K.renderToString(t, KATEX_OPT) : render(t, true); };
  // after
  const toHTML = s => { const t = String(s == null ? '' : s), K = kx(); return K && t ? K.renderToString(t, KATEX_OPT) : render(t, true, true); };   // TXH: rd true
  ```
  `htm(cmd)` mirrors TXP's `txt(cmd)` (same `TFRAC` / `TWRAP` / `TDROP` / `TOPS` / `TACC` / `TSYM` tables) but emits HTML:
  `\dfrac` / `\tfrac` / `\cfrac` stacked exactly like `\frac` (`.st-frac`); wrappers give their content, `\mathbf` / `\textbf` / `\boldsymbol` / `\bm`
  in `<b>`, `\mathit` / `\textit` / `\emph` in `<i>`, `\boxed` / `\fbox` in a bordered `span.st-box`, `\underline` in `<u>`;
  `\textcolor{c}{x}` → `<span style="color:c">x</span>` (only a plain colour name or `#hex`, else just x); `\color`, `\phantom`, `\label` dropped;
  `\stackrel{a}{b}` → b; `\quad` → `&emsp;`, `\qquad` → two, `\:` `\>` → `&thinsp;`, `\!` → nothing, `\kern…` dropped; `\\` → `<br>`;
  `\begin{cases|aligned|array|…matrix}…\end{…}` → an inline table `span.st-env` (`display:inline-table`), one cell per top-level `&` and one row
  per top-level `\\` (cases left-aligned, aligned right/left pairs, array per its column spec, matrices centred), each cell rendered by
  `render`; cases get a `{`, pmatrix `(`…`)`, bmatrix `[`…`]`, vmatrix `|`…`|` (`span.st-delim`, scaled to the row count). Outside an environment `&` stays a
  literal `&amp;`; `\left.` / `\right.` → nothing; `\sqrt[n]{x}` →
  `<sup>n</sup>√` + overlined x; `\tag{x}` → ` (x)`; accents on one letter → combining character (`\hat\theta` θ̂), `\overline{AB}` → `.st-bar`;
  `\not=` → ≠; `\cos` `\sin` `\cot` `\log` … spaced with `&thinsp;` like `\tan`; `\text{…}` that contains commands (`\text{kip\text{-}ft}`,
  `\text{kip\cdot ft}`) is rendered instead of printed with its backslashes (a `\text{…}` without a backslash is escaped as before).
  Anything else falls through to the code as before.
- Unchanged: the KaTeX path (`toHTML` / `line` with `window.katex`), `toText()` (TXP) and `toText(s, { legacy: true })`, and the HTML of
  every string that uses only the README subset.
### Problem
- With KaTeX not loaded (a work laptop opening from `file://` with the CDN blocked), the worked steps on every tab and in the Report showed
  raw command names, e.g. Spread Footing `θ = mathrmatan2(M_ux, M_uy)`, `M_u,strip = int_face^edge …`; Light Pole `H_parallel = …qquad … tan^-1!`;
  Gusset Plate `RF = dfrac{φ_c φ_s …}`; Stone Arch and Steel Beam `T = beginbmatrixc&s&0…endbmatrix`. Report titles and table cells with `$…$` showed the same
  names also when KaTeX is loaded.
### Governing provision
- None: display only. No formula, factor, unit, value or code reference changes.
### Check case
- `SharedSteps.toHTML('W_f = 30.00\;\\mathrm{kips}')` without KaTeX: before `W<sub>f</sub> = 30.00&thinsp;mathrmkips`; after
  `W<sub>f</sub> = 30.00&thinsp;kips` (screen: W_f = 30.00 kips, same digits).
- `\mathrm{DCR} = 6.03/8.62 = \mathbf{0.70}\;\checkmark`: before `mathrmDCR = 6.03/8.62 = mathbf0.70 checkmark`; after `DCR = 6.03/8.62 = **0.70** ✓`.
- Light Pole default project, "Along-cable pull — sag method" (KaTeX blocked): before `H_parallel = wL²/8s qquad … α = tan⁻¹! 4s/L`; after
  `H_∥ = wL²/8s   … α = tan⁻¹ 4s/L` (fractions stacked).
### How verified
- `node tests/engine/run.mjs steps-tohtml` (new, 11 tests) and the whole engine suite; `node tests/check-syntax.mjs`.
- Every TeX-bearing string literal in the repository (10,310 strings): `toText(s)` and `toText(s, { legacy: true })` byte-identical to
  origin/main; built-in `toHTML(s)` differs for 2,791, every one of them a string with a command outside the subset (or a `\text{…}`
  with commands inside, or `\sqrt[n]`).
- Every consumer opened headless (default project, Report opened), origin/main vs this branch:
  - KaTeX served: the HTML of every rendered step (`.rp-m`, `.rp-tsum`, `ol.steps li`, `.sg-sum`) and `.rp-doc` textContent identical in all
    21; `.rp-doc` innerHTML identical once Plotly's random SVG ids and the timing lines are masked.
  - KaTeX CDN routed to fail: the same structure (steps, rows, headings, tables) and the same digits in the page and the Report text in all
    21; only the notation changes (e.g. Gusset Plate 125 of 215 steps, Light Pole 60 of 142); no page errors.
### Other copies
- None.
### Open items
- Tools that call KaTeX themselves (not through SharedSteps) still show TeX source when KaTeX is blocked: e.g. Spread Footing's Report
  notes copied from its tabs (`W_f = 10.00 \cdot 8.00 … \;\mathrm{kcf}` in `.rp-nt`). Not changed here (tool code, one tool per PR).

## 2026-11-08 — PR: claude/shared-step-notes (PR #1240: https://github.com/mlococo88/All-Structural/pull/1240) — list notes: a step's note may be a lead and bullets (SNL; display only)
### Where
- `shared/steps.js`, anchor `/* ---------- list notes (SNL, 2026-11-08)`, before `/* work(prefix): a collector.`; the header comment's `note` line; the
  export line `window.SharedSteps = { …, groupCss, noteParts, noteSep, noteText };` (the last three are new).
### Before / After
- Before: `note` was a string only (the README and the header said "optional remark").
- After: `note` may also be a **list note** `{ lead, items: [[lead, text] | text, …], action? }` (action: a string or a list of strings).
  New functions (nothing existing changed; `step()` keeps the object as given):
  ```js
  const noteParts = note => {
    if (!note || typeof note !== 'object' || Array.isArray(note)) return null;
    const str = v => (v == null ? '' : String(v));
    const action = (Array.isArray(note.action) ? note.action : note.action != null && note.action !== '' ? [note.action] : []).map(str).filter(Boolean);
    const items = (note.items || []).map(t => (Array.isArray(t) ? [str(t[0]), str(t[1])] : ['', str(t)])).filter(t => t[0] || t[1]);
    return { action, lead: str(note.lead), items };
  };
  const noteSep = lead => (/[:.?!—]$/.test(lead) ? ' ' : ': ');
  const noteText = note => {
    const P = noteParts(note); if (!P) return note == null ? '' : String(note);
    return P.action.concat(P.lead ? [P.lead] : [], P.items.map(([l, t]) => '• ' + (l ? l + (t ? noteSep(l) : '') : '') + t)).join('\n');
  };
  ```
  Rendering is in `shared/report.js` (see `fixlog/shared-report.md`, same PR).
### Problem
- Engineer request (2026-11-07, approved for all tools): long notes as a lead and a list. The per-tool passes (SFNL … SBNL) could not split
  a long worked-step note, because a step's note was one string drawn by the shared viewer as one italic paragraph (open items in
  `fixlog/Shear and Moment Diagrams.md` SMNL and `fixlog/elastomeric_design_module.md` EDNL-1).
### Governing provision
- None: display only. No formula, factor, unit, value or code reference changes.
### Check case
- `noteText({ lead: 'L.', items: [['A:', 'x'], ['B', 'y'], 'z'], action: 'Decision (pending engineer review): q.' })` →
  `Decision (pending engineer review): q.\nL.\n• A: x\n• B: y\n• z`; `noteText('abc')` → `abc`.
### How verified
- `node tests/engine/run.mjs steps-listnote` (new, 5 tests); the whole engine suite; `node tests/check-syntax.mjs`. Consumer checks: see `fixlog/shared-report.md` (same PR).
### Other copies
- None.

## 2026-11-24 — PR: claude/sb-le-display (PR #1699: https://github.com/mlococo88/All-Structural/pull/1699) (CMPL) — line(): comparison steps read "D_p ≤ 0.42D_t = 9.204 ≤ … = 11.340, OK" and "… = 115.18 ≤ 140" (no stray "=", no repeated value)   [display only; no value, verdict, formula or reference changes]
### Problem
- Engineer (2026-11-24), Steel Bridge Design, Flexure tab, topic "Compact positive flexure" (6.10.7.1.2 / 6.10.7.3):
  "D_p = ≤ 0.42D_t = 9.204 ≤ 0.42(27.000) = 11.340 = OK" and "M_u + 1/3 f_ℓ S_xt = ≤ φ_f M_n = 2086.83 + … ≤ 2284.07 = OK".
- Root cause: `line()` joins every part with " = " (sym = eq = sub = value). A step whose `eq` starts with a relation (`'\le 0.42D_{t}'`) is the
  right-hand side of a comparison with `sym`, so the join put "=" in front of "≤". 67 steps in the repository have this form (source scan in
  the new test): Steel Bridge Design engine/flexure.js 14, constructibility.js 5, proportions.js 5, autodesign.js 1, framing.js 1, splplace.js 1;
  shared/lldf.js 1 (exterior shear width factor, capV); Crane Pick tandem.js 4, clear3d.js 2; Spread Footing 20; Concrete Beam Capacity 11;
  Retaining Wall Designer 1; Light Pole and Sign Post 1 — each shows the same "= ≤" (or "= ≥", "= <") wherever it is drawn through `line()`
  (the tabs that use it, and `shared/report.js` screen / print / plain-text step lines).
- Second pattern (coordinator, after #1692 put the comparison in `sub`): a numeric value repeated after its own comparison, e.g. Cross-frames
  `cf.top.sl` "ℓ/r_z = 114.00/0.990 = 115.18 ≤ 140 = 115.18", `cf.top.Pr` "P_r = 0.95P_n ≥ C_u = 0.95(55.49) = 52.71 ≥ 3.03 = 52.71 kip",
  `cf.top.Pt` "… = min(123.44, 80.60) ≥ 3.03 = 80.60 kip", the diaphragm `ax.sl` "Kℓ/r_min = 47.00/0.997 = 47.2 ≤ 140 = 47.2"; and a verdict
  joined with "=" after a comparison ("… = 11.340 = OK").
### Where
- `shared/steps.js`, `line()` (anchor `function line(s, html, o) {   // o: toText's options`), and the new `REL`, `isRel` just above it; `isRel`
  exported on `window.SharedSteps`.
### Before / After
- Before:
  ```js
  if (s.sym) parts.push(R(s.sym));
  if (s.eq) parts.push(R(s.eq));
  ```
- After:
  ```js
  const REL = /^\s*(?:\\(?:le|ge|lt|gt|ne|leq|geq|neq)(?![A-Za-z])|[<>≤≥≠])/;
  const HASREL = /\\(?:le|ge|lt|gt|ne|leq|geq|neq)(?![A-Za-z])|[<>≤≥≠]/;
  const isRel = s => !!(s && s.sym && s.eq && REL.test(String(s.eq)));
  const shows = (src, v) => new RegExp('(^|[^0-9.])' + v.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '(?![0-9])').test(src);
  …
  let last = '';
  if (isRel(s)) { last = s.sym + ' ' + String(s.eq).trim(); parts.push(R(last)); }   // (1) 'sym eq', one comparison
  else { if (s.sym) { parts.push(R(s.sym)); last = s.sym; } if (s.eq) { parts.push(R(s.eq)); last = s.eq; } }
  if (s.sub && s.sub !== s.eq) { parts.push(R(s.sub)); last = s.sub; }
  const v = …;   // as before
  const cmp = parts.length > 0 && HASREL.test(String(last)), num = typeof s.value === 'number';
  if (v === '' || (cmp && num && shows(String(last), v))) return parts.join(' = ');   // (2) the comparison shows the value
  const vs = …;   // the value and unit, as before
  if (cmp && !num) return parts.join(' = ') + ', ' + vs;   // (2) a verdict after a comparison
  parts.push(vs); return parts.join(' = ');
  ```
  (1) With KaTeX the comparison is one display-style formula. (2) After a comparison (the last of sym / eq / sub shown holds a relation):
  a numeric value whose formatted digits the comparison already shows is not repeated (its unit, which the comparison does not show, goes
  with it: "P_r = … = 52.71 ≥ 3.03", the value 52.71 kip stays in the report's value column and the tab's tables); a text value follows a
  comma. A numeric value not in the comparison (a ratio, e.g. shear "V_u ≤ φ_vV_n = 812.50 ≤ 1.0(1858.00) = 0.437") is shown as before.
  A step without a relation renders byte for byte as before.
### Governing provision
- None: display only. No step object, value, verdict, formula, factor, unit or reference changes.
### Check case
- `{ sym: 'D_{p}', eq: '\le 0.42D_{t}', sub: '9.204 \le 0.42(27.000) = 11.340', value: 'OK' }`: plain text before
  `D_p = ≤ 0.42D_t = 9.204 ≤ 0.42(27.000) = 11.340 = OK`, after `D_p ≤ 0.42D_t = 9.204 ≤ 0.42(27.000) = 11.340, OK`.
- Steel built-in project (KaTeX, the page): Flexure location 0 before "Dp = ≤0.42Dt = 10.054≤0.42(71.875)=30.188 = OK", after
  "Dp≤0.42Dt = 10.054≤0.42(71.875)=30.188, OK"; Cross-frames before "Pr = 0.95Pn≥Cu = 0.95(55.49)=52.71 ≥ 3.03 = 52.71kip" and
  "rzℓ = 0.990114.00=115.18 ≤ 140 = 115.18", after "… = 0.95(55.49)=52.71 ≥ 3.03" and "… =115.18 ≤ 140" (the page run on both versions of the file).
- Any other step: the same string as before, byte for byte (the new test compares with a copy of the old `line()`, plain, built-in HTML and KaTeX).
### How verified
- `node tests/engine/run.mjs steps-cmpl` (new, 4 tests), `steps-`, `tex`; the whole engine suite (4 chunks); `node tests/check-syntax.mjs`.
- Browser: `tests/smoke/steel-bridge-cmpl.mjs` (new: Flexure, Constructibility, Cross-frames, every step line, no relation right after "=");
  smokes of the other tools with such steps: crane-tandem, crane-clear3d, cbc-loads, lightpole-shaft-subtabs, retaining-wall-checks,
  spread-footing-plain, ps-bridge-skeleton.
### Tools that load shared/steps.js (CLAUDE.md §3)
- index.html, lldf.html, elastomeric_design_module.html, apps/steel-bridge, apps/ps-bridge, apps/crane-pick, abutment_calculator.html,
  Timber Beam Check.html, Stone Masonry Arch Load Rating.html, Steel Beam Design - AISC 15th.html, Spread Footing.html, Shear and Moment
  Diagrams.html, Section Property Calculator.html, Retaining Wall Designer.html, Prestressed Bridge Design.html, Pile Designer.html, Moving Load
  Generator.html, Light Pole and Sign Post.html, Gusset Plate Rating.html, Concrete Beam Capacity.html, Bridge Substructure Loading.html,
  BasePlateAnchorDesigner.html, ASCE7-16 Load Generator.html. Only steps with a relation (≤ ≥ < > ≠) in sym, eq or sub can render differently (a stray "=" removed, a repeated value dropped, ", OK" for "= OK"); every other step is byte for byte unchanged.
### Other copies
- None.
### Decisions (pending engineer review)
- CMPL-1. The comparison keeps " = " before the substitution ("D_p ≤ 0.42D_t = 9.204 ≤ …"), as the shear checks; the colon form
  "D_p ≤ 0.42D_t: 9.204 ≤ …" is not used.
- CMPL-2. A ratio after a comparison that does not show it ("812.50 ≤ 1858.00 = 0.437") is kept as before.
- CMPL-3. A repeated value is dropped with its unit (the unit is in the label / value column elsewhere).

## 2026-11-24 — PR: claude/shared-steps-ratio (PR #1706: https://github.com/mlococo88/All-Structural/pull/1706) — topic chips: only real demand / capacity ratios give the number (SSR; display only)
### Where
- `shared/steps.js`: the header comment (new field `ratio`); `step(o)`, anchor `if (s.ok === undefined) delete s.ok;`; `isRatio`, anchor
  `/* isRatio(s): a test step whose value is a demand / capacity ratio`; the `group()` doc line `ratio  the largest ratio of its test steps`.
  `shared/README.md`, "Worked steps" table: new row `ratio`.
### Before / After
- Before:
  ```js
  const isRatio = s => s.ok !== undefined && typeof s.value === 'number' && !s.unit;
  ```
  and `step()` dropped any key not in `KEYS`.
- After:
  ```js
  const RTOL = 1e-3;
  const isRatio = s => s.ok !== undefined && typeof s.value === 'number' && !s.unit && (typeof s.ratio === 'boolean' ? s.ratio
    : s.ok !== false ? fin(s.value) && s.value <= 1 + RTOL : !(fin(s.value) && s.value <= 1 - RTOL));
  ```
  and in `step()`, after `if (s.ok === undefined) delete s.ok;`:
  ```js
  if (typeof o.ratio === 'boolean') s.ratio = o.ratio;
  ```
  `group()` and `summary()` are unchanged; they call `isRatio`. A test step that is no longer a ratio still counts for its topic's status
  through its `ok` flag (chip `OK` / `NG`, class `ok` / `ng`), gives no number, and its one-line result shows its value.
### Problem
- PR #1692 (SBDFH) found that `group()` read every test step with a number and no unit as a D/C ratio, so a slenderness Kℓ/r = 47.15 ≤ 140
  showed as a red "47.153" chip. Audit (every tool that loads this file, below): the same false badge on the Prestressed (app) Loads & LLDF
  tab ("Number of beams N_b = 5" as a red "5.000"), its Rating topics' raw chips (rating factors ≥ 1 as red ratios; the tab and report
  override them, PSBOutKit.groups, so not shown), Spread Footing "Longitudinal steel" (ρ_g = 0.020 as a green D/C), Steel Bridge
  cross-frame members (ℓ/r = 115 as red "115.178" where no check item links to the topic; the tab and report use the items, #1692) and
  Welds TR4 (t_1/t_2, A_1/A_2 proportions as D/C). Display only: no value, ok flag, verdict or saved data changes.
### Governing provision
- None: display only. No formula, factor, unit, value or code reference changes.
### Check case
- `group([step({ id: 'sl', label: 'sl', value: 47.153, unit: '', ok: true })], [{ key: 't', title: 'T', ids: () => true }])`: before chip
  `47.153`, class `ng`; after chip `OK`, class `ok`, summary `sl: 47.15`. A ratio 0.95 (ok) stays `0.950` `hi`; 1.2 (not ok) `1.200 NG`;
  a factor of safety 2.1 (ok) `OK`; a rating factor 0.8 (not ok) `NG` (was `0.800 NG`); `ratio: true` on a 0.6 that fails: `0.600 NG`.
  `tests/engine/steps-ratio.test.mjs`.
### How verified
- New `tests/engine/steps-ratio.test.mjs`; `tests/engine/steps-groups.test.mjs` (its synthetic 0.4-failing step now reads `NG` with no number;
  the same step declared `ratio: true` keeps `0.400 NG`); the whole engine suite (`node tests/engine/run.mjs`, 4 chunks); `tests/check-syntax.mjs`.
- Every tool that loads the file opened headless (main vs this branch), every tab clicked, every `SharedSteps.group` call recorded (chip,
  class, result step, one-line result, and each step's value and ok): only the topics listed in the PR changed; every step value and ok
  flag the same; console errors the same. Tools: `ASCE7-16 Load Generator.html`, `Pile Designer.html`, `Prestressed Bridge Design.html`,
  `Light Pole and Sign Post.html`, `Shear and Moment Diagrams.html`, `abutment_calculator.html`, `Timber Beam Check.html`, `index.html`,
  `Stone Masonry Arch Load Rating.html`, `Retaining Wall Designer.html`, `Section Property Calculator.html`, `Bridge Substructure Loading.html`,
  `elastomeric_design_module.html`, `Concrete Beam Capacity.html`, `lldf.html`, `apps/steel-bridge/index.html`, `apps/ps-bridge/index.html`,
  `apps/crane-pick/index.html` (loads the file, calls no group), `Gusset Plate Rating.html`, `BasePlateAnchorDesigner.html`,
  `Moving Load Generator.html`, `Spread Footing.html`, `Steel Beam Design - AISC 15th.html`.
### Other copies
- `apps/steel-bridge/ui/framing.js` groups() (#1692) keeps its own slenderness rule for topics no check item links to (unchanged).
- The tools' explicit `ratio: false` (same PR): `fixlog/steel-bridge.md`, `fixlog/ps-bridge.md`, `fixlog/Spread Footing.md`,
  `fixlog/Retaining Wall Designer.md`, `fixlog/Timber Beam Check.md`.
### Open items
- Decision (pending engineer review): the rule (ok agrees with value ≤ 1 within 1e-3) and a failing step below 1.0 read as not a ratio
  (chip `NG` with no number); a D/C with a limit other than 1.0 must declare `ratio: true` to keep its number. None found in the audit.
