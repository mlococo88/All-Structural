# Fix log — shared/list-input.js (window.SharedListInput)

Loaded by: see `shared/README.md`. Tests: `node tests/engine/run.mjs list-input` (Node, the pure helpers) and
`node tests/smoke/list-input.mjs` (browser: the widget on a test page, and every tool that loads the file, main vs the branch).

## 2026-11-02 — PR: claude/list-input, PR #681: https://github.com/mlococo88/All-Structural/pull/681 — created (new file): editable list tables in place of comma-separated boxes (LIST)   [display only]
- **Why:** engineer decision 2026-11-02: no more comma-separated inputs. The short list inputs (about 25, survey of 33 in all)
  become small tables, one box per value, "+ Add" and "×" per row; multi-column lists (x:P pairs, a–b ranges) get one box per
  column. The multi-line paste boxes (Excel load combinations, USGS Sa table, survey points, hole coordinates, the masonry
  arch's lists) stay, each with a table of what was read next to it, which can be edited (later PRs). This PR is phase 1:
  the shared file and its first user, `Shear and Moment Diagrams.html` (Custom x).
- **API** (file header has the full list):
  - Pure, no DOM: `splitPaste(text, ncol, { columns, parse })`, `fromText(text, { rowSplit = ',', colSplit, ncol })`,
    `toText(rows, { rowSep = ', ', colSep = ', ' })`, `fromNumbers(array)`, `toNumbers(rows, col, num)`, `filled(rows)`,
    `same(a, b, columns)`, `checkCell(text, col)`. Rows are arrays of cell strings, kept as typed.
  - Column spec: `{ label, unit, type: 'number' | 'text', min, max, minExclusive, maxExclusive, integer, lenient, rangeNote,
    required, placeholder, width }`; `label`, `unit`, `min`, `max` may be functions.
  - DOM: `mount(host, o)` → `ctl { el, get, rows, set, setColumns, relabel, problems, focus, destroy }`;
    `bindInput(input, o)` (a list kept as TEXT in an existing `<input>`: the input stays, hidden, as the source; edits write
    `toText(rows)` and fire its `input` / `change`; a script that sets `input.value` redraws the table);
    `slot(name)` + `mountSlot(root, name, o)` (tools that build HTML strings); `react(React)` → `ListTable` (no JSX, no build step).
  - Keyboard: Enter moves down, and from the last row adds a row; in a one-column number table "," and ";" do the same.
    Pasting (or typing) a list with commas, semicolons, tabs or new lines splits it into rows from the cell on; an Excel column
    (one value per line) keeps "1,234" in one cell; a header line with no number is dropped.
  - Accessibility: table caption (the list's name, visually hidden by default), column headers with `scope="col"`, each box
    labelled "x (ft), row 2 — <list name>", remove buttons "Remove row 2", `aria-invalid` and `aria-describedby` → the cell's
    message.
  - Checks: "Not a number", "Must be ≥ 0", "Must be ≤ 36 (outside the beam, not used)", "Must be a whole number", "Read as 4"
    (lenient: the tool reads with parseFloat). Shown per cell, red / amber. A check never changes or drops a value: the
    tool's own parser decides what it uses, as before.
- **Saved data (§5):** the file stores nothing and chooses no key. Text fields stay text in the same format (`fromText` with the
  tool's own separator, `toText` joins rows with ", "); a blank row is never saved; cell text is kept as typed (no
  re-formatting); `bindInput` writes back only when the text changes (adding a blank row does not mark the project changed).
  Arrays stay arrays (`fromNumbers` / `toNumbers`).
- **Check case:** `tests/engine/list-input.test.mjs` (9 tests): `fromText("2.5, 5")` = `[["2.5"],["5"]]` and `toText` of it is
  `"2.5, 5"` byte for byte; older spellings (`"2.5,5"`, `" 2.5 ,  5 "`, `"2.5,,5,"`, `"1, abc, 7"`, `"4ft, 8"`, `"2.50, 05"`)
  give the same numbers through Shear and Moment's and Steel Beam Design's own parsers before and after a save, and a second
  save writes the same text; a Shear and Moment `userXs` written by the table (`"2.5, 5, 12.75"`) reads `[2.5, 5, 12.75]` in
  Steel Beam Design's parser; `[110, 140, 110.5]` → rows → the same array; x:P `"20:1.5, 40:1.5"` and range `"0-80, 140-220"`
  round trips; paste splitting; checks.
- **Browser:** `tests/smoke/list-input.mjs --part widget`: Enter adds a row, "," adds a row, an Excel column paste fills
  rows, a paste overwrites from the cell down, × removes, cell marks (class, `aria-invalid`, message), labels, `bindInput`
  (hidden input, write back + `input` event, scripted value redraws, blank row changes nothing), React wrapper (rows from
  state, typing updates state, an unreadable value being typed is not wiped by the parent's echo, an outside state change
  redraws); 0 console errors.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **Open items:** the other tools (survey list) are converted one per PR after this; React tools (index.html, Prestressed
  Bridge Design.html) use `react(React)`.

## 2026-11-02 — PR: claude/list-input-sbeam, PR #683: https://github.com/mlococo88/All-Structural/pull/683 — loaded by Steel Beam Design - AISC 15th.html (no change to the shared file)
- Output Stations, Custom stations x (`mount`). `tests/smoke/list-input.mjs` gains the part `sbeam`. The widget and `smd` parts were re-run: all pass.

## 2026-11-02 — PR: claude/list-input-bsl, PR #688: https://github.com/mlococo88/All-Structural/pull/688 — loaded by Bridge Substructure Loading.html (no change to the shared file)
- Bridge tab, span lengths and girder spacings (`bindInput` on `#f_spans` / `#f_bays`, `events: ['input']`, commit on leaving the
  table). `tests/smoke/list-input.mjs` gains the part `bsl` and two hooks for any tool: `typeNew` (fill the table a tool's own
  way) and `expect` (the saved form when it is not the typed text, e.g. an array), plus `fillTable()` (replace a table's rows).

## 2026-11-02 — PR: claude/list-input-bgeo, PR #690: https://github.com/mlococo88/All-Structural/pull/690 — loaded by Bridge Geometry.html (no change to the shared file)
- Per-span girder offsets (`slot` + `mountSlot`, one table per span) and the survey-point paste box's table (`mount`).
  `tests/smoke/list-input.mjs` gains the part `bgeo` and two entry options: `extra` (checks on the branch only, e.g. a paste box
  and its table) and `over` (a sideways scroll at 390 px that main already had).

## 2026-11-02 — PR: claude/list-input-gusset, PR #692: https://github.com/mlococo88/All-Structural/pull/692 — loaded by Gusset Plate Rating.html (no change to the shared file)
- Members, "Gage(s) g" (`bindInput`, text cells). `tests/smoke/list-input.mjs` gains the part `gusset`.
- Note for later: a column `check` function (a tool's own number reader, e.g. Gusset's `num()` with fractions) would let such
  cells be marked; not added here (a shared-file change).

## 2026-11-02 — PR: claude/list-input-secprop — loaded by Section Property Calculator.html (no change to the shared file)
- Library "Save to the library", Tags (`mount`, one text column). `tests/smoke/list-input.mjs` gains the part `secprop`.
