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

## 2026-11-05 — PR: claude/github-sync (PR #808: https://github.com/mlococo88/All-Structural/pull/808) — projects-ui.js: optional GitHub sync of the list (`ctx.cloud`, GHS)   [display and storage hooks only]
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

## 2026-11-05 — PR: claude/standard-save-shared (STDS PR 1) — the standard save: `listStore`, standard Saved projects dialog, `projectBar` (Save / Save as… / Ctrl+S)   [display and list interface only; no result change, no key or format change]
- **Why:** engineer decision 2026-11-05 (standard save design approved as shown in the save survey's mock-ups): every tool gets the same header chip + Save + Saved projects…, a "Save and open" card, one Saved projects dialog with GitHub-only rows in the same table, Save as with a "Save to" choice, Ctrl+S / Ctrl+Shift+S. This PR adds the shared parts only; **no tool calls them yet** (each tool opts in in its own PR), so every current page draws and behaves exactly as before.
- **projects.js**
  - `mapStore` is now a thin wrapper over a shared `core(key, read, writeRaw, stamp, o)`. Before: `function mapStore(storage, key, o) { o = o || {}; const pack = …; function read() {…} function write(map, what) { try { storage.setItem(key, JSON.stringify(map)); return { ok: true }; } catch (e) { return fail(e, what); } } …`. After: `function mapStore(storage, key, o) { function read() {…same…} const stamp = () => storage.getItem(key); return core(key, read, map => { storage.setItem(key, JSON.stringify(map)); }, stamp, o); }` with the rest of the old body (list, has, get, item, save, rename, duplicate, remove, copyName) moved unchanged into `core`. Same text written, same messages, same refused-write behaviour.
  - New `listStore({ key, readMap, writeMap, stamp?, pack, unpack, time, sort })`: the same interface over a list the tool keeps some other way (id-keyed list shown by name, IndexedDB with an in-memory copy). New `stamp()` on every store (mapStore: the stored text).
- **projects-ui.js**
  - `libraryDialog(ctx)`: new `ctx.standard` (with `label`, `exportOne(name)`, `importFile()`). Without it: unchanged (the `draw()` path is the old one; `if (std) { drawStd(); return; }` is the only new line in it). With it: title "Saved projects — <label>", filter box, "Save the open project…" / "Import JSON…" at the top, one table Name / Last saved (Eastern) / Size / This browser / GitHub (sync on) / Open Rename Duplicate Export Delete, GitHub-only projects as rows of the same table (Open / Download / Delete from GitHub), storage bar, one note; on phones (≤ 560 px) each row is a stacked card. New row action `export` (default: the stored item, or `ctx.cloud.toFile` of it, as JSON, `<name>.json`).
  - New `projectBar(ctx)`: header chip "Project: <name> ● saved / unsaved changes / not saved" (+ GitHub badge while sync is on; click = Saved projects…), Save (Ctrl+S) and Saved projects… in the header; the "Save and open" card (status line; Save · Save as… · Saved projects… · New; "File on this computer": Export JSON · Import JSON (the tool's own buttons moved in, or new ones calling the tool's handlers); extras row; two hint lines). Save saves to the open name with no question (no open name → Save as). Save as: name + "Save to" (This browser and GitHub (cloud), default when sync is set up / This browser only / File on this computer (.json) = the tool's Export JSON). A name already in the list (or on GitHub only) is not overwritten without "Replace it". Open / New / Import ask first when the inputs changed since the last open / save. Ctrl+S / Ctrl+Shift+S (browser's "Save page" never; ignored while a dialog is open). Stores nothing: the open name lives in the tool (`current` / `setCurrent`) or in the page; after a reload it is found again by content.
  - New `download(file, text)`.
- **Decision (pending engineer review):** the open project's name is not stored in a new key; after a reload it is recognised when the inputs on screen equal a saved project (autosave restored unchanged), else the chip says "not saved" until Save as / Open. A tool that keeps the name in its own state passes `current()`.
- **Decision (pending engineer review):** Open / New / Import ask about unsaved changes only when the open project is in the list and changed, or the inputs were edited on this page since the last open / save / New (an autosaved, never-saved state restored on reload does not trigger the question, as today).
- **Decision (pending engineer review):** "Last saved" shows "—" for tools whose list items carry no time (Spread Footing, Bridge Substructure…): their stored format has no time and is not changed (§5).
- **Loaded by (unchanged behaviour, none opts in here):** every page in `shared/README.md` for `projects.js` / `projects-ui.js` (ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Geometry, Bridge Substructure Loading, Concrete Beam Capacity, Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Pile Designer, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design - AISC 15th, Steel Bridge Design, Stone Masonry Arch Load Rating, Timber Beam Check, abutment_calculator, elastomeric_design_module, index.html, lldf.html, apps/steel-bridge, tools.html).
- **How verified:** `node tests/engine/run.mjs projects` (10 / 10, 2 new: listStore; mapStore stamp). New `node tests/smoke/standard-save.mjs` (fixture page `tests/smoke/standard-save-fixture.html`, mock GitHub): 8 / 8. `node tests/smoke/project-library.mjs --tool <each>` origin/main vs branch for asce7, baseplate, bsl, gusset, lightpole, mlg, retwall, spc, smd, steelbeam, stonearch, timber, rebar, spreadfooting, abutment, edm, bgeo, index, lldf: ALL PASS (results, saved list, dialog text without `[data-sp]`). `tests/smoke/pile-library.mjs`, `steel-bridge-library.mjs`, `github-sync.mjs`, `github-sync-tools.mjs` (all 19 sync tools), `home-projects.mjs`, `home-sync.mjs`: ALL PASS.
- **Formulas, factors, units, code references:** none (§4 does not apply). **Saved data:** no key, no format changed.
