# Fix log — shared/units.js (window.SharedUnits) and shared/steps.js (window.SharedSteps)

Loaded by: `apps/steel-bridge/index.html` (and its engine). Tests: `node tests/engine/run.mjs model sections`.

## 2026-10-29 — PR: sbd2-model-sections — created (new files)
### Where
- `shared/units.js` (new): exact factors ft↔in, kip-in↔kip-ft, kcf↔pcf, ksi↔psi; `fmt(x, d)` (fixed decimals, no "-0"),
  `fmtSig`, `fmtInt` (thousands grouped), `frac(x)` (1/16-in mixed fraction) and `parseDim(v)` ("1 1/8", "1-1/8"",
  "3/4"). `frac` and `parseDim` are copies of GirderDetail's functions of the same names (anchors
  `function frac(x) {`, `function parseDim(v) {` in `Steel Bridge Design.html`), same rules.
- `shared/steps.js` (new): the worked-step format (`step`, `work(prefix)` collector, `n`/`g` number formatting for
  substitutions) and its renderer (`toHTML`, `toText`, `line`) for the TeX subset documented in `shared/README.md`
  ("Worked steps").
### Governing provision
- None (no engineering formula). Conversions are exact (12 in/ft, 1000 lb/kip).
### Check case
- `ftToIn(10)` = 120; `kipInToKipFt(71300)` = 5941.667; `kcfToPcf(0.15)` = 150; `frac(1.125)` = "1 1/8";
  `parseDim('1-1/8"')` = 1.125; `fmt(-0.001, 2)` = "0.00". `toText('\frac{I}{\bar{y}}')` = "I/ȳ".
### How verified
- `tests/engine/model.test.mjs` (units) and `tests/engine/sections.test.mjs` (steps), Node.
### Other copies
- `frac`, `parseDim`: also in `Steel Bridge Design.html` (GirderDetail), unchanged.
### Open items
- None.

## 2026-10-29 — PR: sbd2-katex — worked steps rendered with KaTeX (`steps.js`; engineer's approval 2026-10-29)
### Where
- `shared/steps.js`, after `function render(src, html)` (anchor `const toHTML = s =>`):
  - New `KATEX_OPT = { throwOnError: false, strict: 'ignore', macros: { '\\minus': '-' } }` and `kx()` (`window.katex` when loaded).
  - New `unitTeX(u)`: a unit's words in `\text{}` for KaTeX (`kip-ft` → `\text{kip-ft}`, `in^{2}` → `\text{in}^{2}`).
  - Before: `const toHTML = s => render(String(s == null ? '' : s), true);`
    After: `const toHTML = s => { const t = String(s == null ? '' : s), K = kx(); return K && t ? K.renderToString(t, KATEX_OPT) : render(t, true); };`
  - `line(s, html)`: with KaTeX, `sym`, `eq`, `sub` go through `katex.renderToString('\\displaystyle ' + t, KATEX_OPT)` and a numeric
    value with its unit through `katex.renderToString(fmt(value, d) + '\;' + unitTeX(unit), KATEX_OPT)`; a string value stays plain text.
    Without KaTeX, and for `html = false`, `line` is exactly as before.
  - `window.SharedSteps` gains `unitTeX` and `katexOpt` (additive).
  - `toText` unchanged.
- `shared/README.md` "Worked steps": the notation must also be valid KaTeX; how toHTML picks KaTeX or the built-in renderer.
### Problem
- New behaviour (engineer's request): the worked steps on screen and in print are typeset with KaTeX. Values, rounding and digits are
  unchanged (the value is still `fmt(value, d)`), so no computed or displayed number changes.
### Governing provision
- None (rendering only; no formula, factor, unit or code reference changed).
### Check case
- Step `S_{bot} = \frac{I}{\bar{y}} = \frac{51{,}050}{33.535}`, value 51050 / 33.535 = 1522.29, d = 0, unit `in^{3}`:
  - `line(s, false)` before and after: `S_(bot) = I/ȳ = (51,050)/33.535 = 1522 in^3` (identical with or without KaTeX).
  - `line(s, true)` without KaTeX: as before (`st-frac` spans). With KaTeX: KaTeX spans (`class="katex"`), no `katex-error`.
### How verified
- `tests/engine/tex.test.mjs` (new; runs last): every step string the engine tests make (sections, flexure incl. noncomposite, loads,
  LLDF, owners, shear, stiffeners; on tests/projects/sbd2-*, the 100 tests/projects/st/gd_*.json payloads and the built-in project;
  recorded by `tests/engine/harness.mjs`, digits folded) parsed by KaTeX 0.16.9 (`tests/libs`, the version the page pins) with
  `strict: 'error'`: 0 parse errors. No step string needed a change. Also the line() check case above.
- Headless load of `apps/steel-bridge/index.html` (see `fixlog/steel-bridge.md`, same PR).
### Other copies
- None (`steps.js` is loaded only by `apps/steel-bridge/index.html`).
### Open items
- The built-in fallback renderer has no symbol for `\ell`, `\tan` and `\circ` (used by the engines; KaTeX shows them correctly); without
  KaTeX they show as the words "ell", "tan", "circ", as before this PR. Adding them to `SYM` would also change `toText` output, so it was
  left for the engineer to decide.
