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
