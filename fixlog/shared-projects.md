# Fix log — shared/projects.js (window.SharedProjects) and shared/projects-ui.js (window.SharedProjectsUI)

Loaded by: see `shared/README.md` (one row per file). Tests: `node tests/engine/run.mjs projects` (Node) and
`node tests/smoke/project-library.mjs --tool <key>` (browser, one key per tool that loads them).

## 2026-11-02 — PR: [#664](https://github.com/mlococo88/All-Structural/pull/664) — created (new files): saved-project list and Undo / Redo for the tools (PLIB)   [display and storage only]
- **Why:** engineer-approved 2026-11-02: every tool gets a saved-project list (save / open / rename / duplicate / delete in the browser),
  Export / Import JSON and Undo / Redo, following the Steel Bridge app (`apps/steel-bridge/engine/library.js`, `ui/library.js`, #516).
  The code is shared so each tool's change is a small integration block (CLAUDE.md §3).
- **`shared/projects.js`** (no DOM): `mapStore(storage, key, { pack, unpack, time, sort })` works on ONE localStorage value holding
  `{ "<name>": item }`, the format most tools already use. The tool passes its own key; the file never chooses a key and never
  changes a format (§5). `rename` moves the stored item to the new name unchanged and keeps its place in the list; `duplicate`
  copies it unchanged (default name "<name> (copy)"). A name already in use is refused with `error: 'exists'` unless `{ replace: true }`.
  Every write is one `setItem` of the whole list: a refused write (quota, private window) returns `{ ok: false, error: 'quota' | 'storage',
  message }` and storage is as it was. A list whose text does not parse is never written (`error: 'unreadable'`; the text stays).
  `usage(storage, keys)` (characters of the origin and of the tool's keys; quota 5 M chars = about 10 MB, Chrome / Edge), `etTime(t)`
  (US Eastern), `history({ get, set, max, settleMs })`: undo / redo of whole-state text snapshots, 100 steps, session only; `undo` /
  `redo` first record a change not yet recorded; for 400 ms after an undo / redo a tool's normalising redraw only re-takes the snapshot.
- **`shared/projects-ui.js`**: `libraryDialog(ctx)` (a `<dialog>`: name, last saved when the tool stores a time, size, Open / Rename /
  Duplicate / Delete with prompt / confirm, the storage-use bar, the error text of a refused write), `undoRedo(h, { undo, redo, keys })`
  (buttons disabled at the ends; Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, not while text is being typed in a field or a dialog is open),
  `button()`. Every element added has `data-sp` (tests remove them before comparing page text). CSS is injected once (`style[data-sp]`).
- **Check case:** `tests/engine/projects.test.mjs` (8 tests): the stored text after save is exactly `{"Bridge B":{"span":40},…}`; rename of
  `two` in `{"one":…,"two":{"c":"x"},"three":3}` gives keys `one, deux, three` with `deux` byte-identical; a 120-character quota refuses a save
  and storage is byte-identical; `'{not json'` stays as it is after save / remove; undo / redo / max 3 / settle.
- **Formulas, factors, units, code references:** none (§4 does not apply).

## 2026-11-02 — PR: [#665](https://github.com/mlococo88/All-Structural/pull/665) — loaded by Stone Masonry Arch Load Rating.html (no change to the shared files)
- `tests/smoke/project-library.mjs` gains `--tool stonearch`, and A vs B reload comparison (both sides reopened on A's storage).

## 2026-11-02 — PR: [#667](https://github.com/mlococo88/All-Structural/pull/667) — projects-ui.js: dialog centred under page CSS resets; actions wrap on phones   [display only]
- **Problem:** in `Gusset Plate Rating.html` (a page whose CSS resets `margin` on every element) the dialog opened at the top-left corner,
  because a modal `<dialog>` is centred by the browser's `margin:auto`. At 390 px the Delete button was cut off (scrolled).
- **Where:** `css()`, anchor `'dialog.spLib{`: added `position:fixed;inset:0;margin:auto;height:fit-content;box-sizing:border-box;`; new rule
  after `'.spLib .spScroll{overflow-x:auto;}',`: `@media (max-width:560px){ .spLib td.spAct{white-space:normal;text-align:left;} … }`.
- **Tools that load the file and were re-tested:** ASCE7-16 Load Generator (`--tool asce7`), Stone Masonry Arch Load Rating
  (`--tool stonearch`), Gusset Plate Rating (`--tool gusset`): ALL PASS each.

## 2026-11-02 — PR: [#691](https://github.com/mlococo88/All-Structural/pull/691) — projects-ui.js: optional "Save the open project…" button in the dialog   [display only]
- **Why:** Bridge Substructure Loading had no Save-to-browser of its own and no room in its header for another button.
- **Where:** `libraryDialog(ctx)`: the dialog head shows `<button data-spa="save">` (text `ctx.saveLabel`) only when `ctx.save` is given; the
  click calls `ctx.save()` (the tool asks for the name and returns the `mapStore` result), shows a refused write's message, calls
  `ctx.changed()` and redraws. Tools that do not pass `ctx.save` are unchanged.
- **Tools that load the file, re-tested:** `tests/smoke/project-library.mjs` with `--tool` asce7, stonearch, gusset, retwall, baseplate,
  spreadfooting, steelbeam, edm, abutment, lightpole, timber, mlg, spc, bsl: ALL PASS each.

## 2026-11-05 — PR: claude/github-sync — projects-ui.js: optional GitHub sync of the list (`ctx.cloud`, GHS)   [display and storage hooks only]
- **Why:** engineer request: saved projects copied to a private GitHub repository (`shared/github-sync.js`, `fixlog/shared-github-sync.md`).
- **Where:** `libraryDialog(ctx)`:
  - after `let msg = '';`: `const cloud = ctx.cloud && window.SharedGitHubSync ? window.SharedGitHubSync.attach(ctx) : null;` and `cui`;
  - `draw()`: the default note becomes `(ctx.note || (cloud && cloud.note()) || '<p class="spNote">Saved projects stay in this browser only…')`,
    then `if (cloud) cloud.decorate(body, cui);`;
  - rename: `if (done(r)) { if (ctx.renamed) ctx.renamed(name, r.name); if (cloud) cloud.renamed(name, r.name); }` (before: `if (done(r) && ctx.renamed) ctx.renamed(name, r.name);`);
  - delete: `if (done(ctx.store.remove(name))) { if (ctx.deleted) ctx.deleted(name); if (cloud) cloud.deleted(name); }` (before: `if (done(ctx.store.remove(name)) && ctx.deleted) ctx.deleted(name);`);
  - `show()`: `if (cloud) cloud.shown(cui).catch(() => {});`; the returned handle has `cloud`.
- A tool that passes no `ctx.cloud`, or a page without `shared/github-sync.js`, behaves exactly as before (`cloud` is null).
- **Tools that load projects-ui.js, re-tested (`tests/smoke/project-library.mjs --tool …`, origin/main vs branch):** see the PR.
