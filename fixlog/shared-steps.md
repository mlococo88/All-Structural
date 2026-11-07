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
