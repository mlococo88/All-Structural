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

## 2026-11-05 — PR: claude/standard-save-shared (PR #836: https://github.com/mlococo88/All-Structural/pull/836) (STDS PR 1) — the standard save: `listStore`, standard Saved projects dialog, `projectBar` (Save / Save as… / Ctrl+S)   [display and list interface only; no result change, no key or format change]
- **Why:** engineer decision 2026-11-05 (standard save design approved as shown in the save survey's mock-ups): every tool gets the same header chip + Save + Saved projects…, a "Save and open" card, one Saved projects dialog with GitHub-only rows in the same table, Save as with a "Save to" choice, Ctrl+S / Ctrl+Shift+S. This PR adds the shared parts only; **no tool calls them yet** (each tool opts in in its own PR), so every current page draws and behaves exactly as before.
- **projects.js**
  - `mapStore` is now a thin wrapper over a shared `core(key, read, writeRaw, stamp, o)`. Before: `function mapStore(storage, key, o) { o = o || {}; const pack = …; function read() {…} function write(map, what) { try { storage.setItem(key, JSON.stringify(map)); return { ok: true }; } catch (e) { return fail(e, what); } } …`. After: `function mapStore(storage, key, o) { function read() {…same…} const stamp = () => storage.getItem(key); return core(key, read, map => { storage.setItem(key, JSON.stringify(map)); }, stamp, o); }` with the rest of the old body (list, has, get, item, save, rename, duplicate, remove, copyName) moved unchanged into `core`. Same text written, same messages, same refused-write behaviour.
  - New `canon(v, omit)`: JSON text with keys sorted (top-level `omit` fields left out), for the "unsaved changes" check.
  - New `listStore({ key, readMap, writeMap, stamp?, pack, unpack, time, sort })`: the same interface over a list the tool keeps some other way (id-keyed list shown by name, IndexedDB with an in-memory copy). New `stamp()` on every store (mapStore: the stored text).
- **projects-ui.js**
  - `libraryDialog(ctx)`: new `ctx.standard` (with `label`, `exportOne(name)`, `importFile()`). Without it: unchanged (the `draw()` path is the old one; `if (std) { drawStd(); return; }` is the only new line in it). With it: title "Saved projects — <label>", filter box, "Save the open project…" / "Import JSON…" at the top, one table Name / Last saved (Eastern) / Size / This browser / GitHub (sync on) / Open Rename Duplicate Export Delete, GitHub-only projects as rows of the same table (Open / Download / Delete from GitHub), storage bar, one note; on phones (≤ 560 px) each row is a stacked card. New row action `export` (default: the stored item, or `ctx.cloud.toFile` of it, as JSON, `<name>.json`).
  - New `projectBar(ctx)`: header chip "Project: <name> ● saved / unsaved changes / not saved" (+ GitHub badge while sync is on; click = Saved projects…), Save (Ctrl+S) and Saved projects… in the header; the "Save and open" card (status line; Save · Save as… · Saved projects… · New; "File on this computer": Export JSON · Import JSON (the tool's own buttons moved in, or new ones calling the tool's handlers); extras row; two hint lines). Save saves to the open name with no question (no open name → Save as). Save as: name + "Save to" (This browser and GitHub (cloud), default when sync is set up / This browser only / File on this computer (.json) = the tool's Export JSON). A name already in the list (or on GitHub only) is not overwritten without "Replace it". Open / New / Import ask first when the inputs changed since the last open / save. Ctrl+S / Ctrl+Shift+S (browser's "Save page" never; ignored while a dialog is open). `card: true` + `mount(el)` for a tool that draws its Project tab again. Default "unsaved changes" check: `canon(state, ctx.omit)` vs `canon(saved item, ctx.omit)`. Stores nothing: the open name lives in the tool (`current` / `setCurrent`) or in the page; after a reload it is found again by content.
  - New `download(file, text)`.
- **Decision (pending engineer review):** the open project's name is not stored in a new key; after a reload it is recognised when the inputs on screen equal a saved project (autosave restored unchanged), else the chip says "not saved" until Save as / Open. A tool that keeps the name in its own state passes `current()`.
- **Decision (pending engineer review):** Open / New / Import ask about unsaved changes only when the open project is in the list and changed, or the inputs were edited on this page since the last open / save / New (an autosaved, never-saved state restored on reload does not trigger the question, as today).
- **Decision (pending engineer review):** "Last saved" shows "—" for tools whose list items carry no time (Spread Footing, Bridge Substructure…): their stored format has no time and is not changed (§5).
- **Loaded by (unchanged behaviour, none opts in here):** every page in `shared/README.md` for `projects.js` / `projects-ui.js` (ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Geometry, Bridge Substructure Loading, Concrete Beam Capacity, Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Pile Designer, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design - AISC 15th, Steel Bridge Design, Stone Masonry Arch Load Rating, Timber Beam Check, abutment_calculator, elastomeric_design_module, index.html, lldf.html, apps/steel-bridge, tools.html).
- **How verified:** `node tests/engine/run.mjs projects` (11 / 11, 3 new: listStore; mapStore stamp; canon). New `node tests/smoke/standard-save.mjs` (fixture page `tests/smoke/standard-save-fixture.html`, mock GitHub): 8 / 8. `node tests/smoke/project-library.mjs --tool <each>` origin/main vs branch for asce7, baseplate, bsl, gusset, lightpole, mlg, retwall, spc, smd, steelbeam, stonearch, timber, rebar, spreadfooting, abutment, edm, bgeo, index, lldf: ALL PASS (results, saved list, dialog text without `[data-sp]`). `tests/smoke/pile-library.mjs`, `steel-bridge-library.mjs`, `github-sync.mjs`, `github-sync-tools.mjs` (all 19 sync tools), `home-projects.mjs`, `home-sync.mjs`: ALL PASS.
- **Formulas, factors, units, code references:** none (§4 does not apply). **Saved data:** no key, no format changed.

## 2026-11-06 — PR: claude/sf-start-chooser (PR #845: https://github.com/mlococo88/All-Structural/pull/845) (START) — projects-ui.js: start-of-session project chooser, `projectBar` `ctx.start` (opt-in)   [TRIAL in Spread Footing only, pending engineer review; display and new per-tool keys only; no result change]
- **Why:** the engineer asked whether the save / load screen should pop up whenever an app opens; a blocking pop-up was advised against and this was proposed instead; engineer: "try it with the Spread Footing app to see if I like it". **Trial, pending engineer review**: only `Spread Footing.html` passes `ctx.start`.
- **What (projects-ui.js, anchor `function startChooser(ctx, b)`, called at the end of `projectBar`: `st = ctx.start ? startChooser(ctx, { store, dialog, eng, openNamed, getCur, setCur, snapshot, snapOf, refresh, clean, dirty }) : null;`):** at DOMContentLoaded (after the tool's own start-up scripts):
  - autosave (`ctx.start.autosaveKey`, read only) and at least one saved project (here, or GitHub-only once the background listing is back): a "Recent projects" strip right after `ctx.start.after`, in the page flow (never over the page): "Continue: <saved project the autosave equals | title name (unsaved work) | unsaved work>" + "(autosaved <date, time EST/EDT>)" (or "autosaved in this browser" when the time is not known), up to 5 Open buttons (most recently saved / opened first; the project Continue names is not repeated; GitHub-only ones marked "GitHub only"), "All saved projects…" (the standard dialog), ×. Closes on the first typed input edit (trusted `input` / `change` outside `[data-sp]`), on Open (strip or dialog), on Continue and ×. Hidden in print.
  - no autosave and at least one project (local, or GitHub-only after the listing): the standard Saved projects dialog opens by itself. No project at all: nothing.
  - new box in the standard dialog (`libraryDialog` `ctx.startPref`, only when `ctx.start` is on): "Show this when the app opens" (off by default); on: the dialog opens at every start instead of the strip.
  - suppressed: `ctx.start.incoming()` true, a URL `#hash` / `?query` (unless `start.url === false`), inside a frame, print media.
  - the open project is found again by content at that point (the chip then names it; before, `projectBar` only looked at construction time, which in Spread Footing is before `loadAuto()`).
- **Refactor (no behaviour change for any tool):** `projectBar`'s dialog `open:` arrow function became the named `openNamed` (same body, plus `if (st) st.opened(n);`), used by the dialog and the strip. `renamed` / `deleted` / `done()` call `st.renamed / st.deleted / st.opened` only when `st` exists. Without `ctx.start`, `st` is null and `startPref` is null: nothing is drawn, listened to or stored.
- **Storage (§5: new keys only, prefixed per tool; no existing key or format touched; written only by a tool with `ctx.start`):** `bridgeSuite.v1.projectsUI.<tool>.startDialog` ('1' = on; removed when off); `bridgeSuite.v1.projectsUI.<tool>.start` = `{ v:1, auto:{ at: ISO time the tool last rewrote its autosave, h: FNV-1a hash + length of that autosave text }, recent:[{ n, t }] }` (the time is shown only while the hash matches the autosave found at start).
- **Decisions (pending engineer review):** (1) a list whose items carry no saved time (Spread Footing's `sfd_projects`) is ordered by this file's own note of Save / Open, then last added first; (2) with an autosave but no saved project at all the strip is not shown (it would hold only Continue); (3) with sync on, the GitHub listing is fetched in the background at start (one request, never waited for) so GitHub-only projects can be offered; (4) "autosaved <time>" needs the new `.start` key (the autosave format has no time and is not changed): for an autosave written before this change the strip says "autosaved in this browser".
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **Loaded by (unchanged behaviour, none but Spread Footing opts in):** ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Geometry, Bridge Substructure Loading, Concrete Beam Capacity, Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Pile Designer, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design - AISC 15th, Steel Bridge Design, Stone Masonry Arch Load Rating, Timber Beam Check, abutment_calculator, elastomeric_design_module, index.html, lldf.html, apps/steel-bridge/index.html.
- **Check case:** Spread Footing, six saved projects "Footing F1…F6", `sfd_auto` = Footing F3: strip "Continue: Footing F3 (autosaved in this browser) · Footing F6 · F5 · F4 · F2 · F1 · All saved projects… · ×"; Open "Footing F5" from the strip gives state, results R, storage and chip identical to Open "Footing F5" in the dialog (B = 13 ft). Same list, no `sfd_auto`: the dialog opens by itself.
- **How verified:** see the PR (new `tests/smoke/start-chooser.mjs`, the smoke tests of the tools that load the file, main vs branch for Spread Footing).

## 2026-11-06 — PR: claude/sbapp-stds (PR #855: https://github.com/mlococo88/All-Structural/pull/855) (STDS-B) — projects-ui.js: projectBar / standard dialog hooks for a list that is not a mapStore (id-keyed, duplicate names)   [display only; no key or format change]
- **Why:** apps/steel-bridge (and next Pile Designer) keep items by id with duplicate names; the standard dialog lists them through a by-name view whose rows are not all synced.
- **What (`shared/projects-ui.js`):**
  - `libraryDialog` `usageHtml()`: `SP().usage(ctx.storage, [ctx.store.key])` → `SP().usage(ctx.storage, ctx.store.keys ? ctx.store.keys() : [ctx.store.key])` (a list kept under several keys).
  - `drawStd()` GitHub cell: `${cloud.cell(i.name, g ? g.status : null, g && g.conflict)}` → `${cloud.cell(…) || (ctx.ghNote && ctx.ghNote(i.name)) || ''}` (new optional `ctx.ghNote(name)`).
  - `projectBar`: `guard`: `(!inList() && !touched)` → `(!inList() && !touched && ctx.askUnsaved !== 'always')` (new optional `ctx.askUnsaved`); the dialog gets `ghNote: ctx.ghNote`; `done(r, name)`: first line `if (r && r.ok && typeof r.name === 'string' && r.name) name = r.name;` (a tool's save may report the list name it saved under).
  - Header comments of `libraryDialog` and `projectBar` document the three.
- **Unchanged for every other tool:** none passes `store.keys`, `ghNote` or `askUnsaved`; every `ctx.save` / `store.save` result either has no `name` or the same name (mapStore `save` returns the trimmed name it was given).
- **Loaded by:** ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Geometry, Bridge Substructure Loading, Concrete Beam Capacity, Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Pile Designer, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design - AISC 15th, Steel Bridge Design, Stone Masonry Arch Load Rating, Timber Beam Check, abutment_calculator, elastomeric_design_module, index.html, lldf.html, tools.html, apps/steel-bridge.
- **How verified:** see the PR (standard-save, github-sync, github-sync-tools (all tools), home-projects, home-sync, steel-bridge-library, engine tests).
- **Formulas, factors, units, code references:** none.

## 2026-11-06 — PR: claude/bss-shared-mct (PR #863: https://github.com/mlococo88/All-Structural/pull/863) (BSS) — projects-ui.js: Save sends the project to GitHub at once also with a settle time   [display only]
- **What (`projectBar` `done()`, anchor `dialog.cloud.tick()`):** `if (dialog.cloud && dialog.cloud.tick) dialog.cloud.tick().catch(() => {});` → `… dialog.cloud.tick(true).catch(() => {});` (see fixlog/shared-github-sync.md, same PR: `tick(all)`).
- **Unchanged for every other tool:** none has a `settle` time; `all` only skips the settle check.
- **Loaded by:** the tools listed for `shared/projects-ui.js` in shared/README.md, plus `index.html`; `lldf.html` (already loaded it); `Prestressed Bridge Design.html` (its own PR).
- **How verified:** `tests/smoke/standard-save.mjs`, `github-sync-tools.mjs`, `bridge-suite-save.mjs` (Save uploads at once although the suite's settle time is 30 s).
- **Formulas, factors, units, code references:** none.

## 2026-11-06 — PR: claude/sf-header-save (PR #884: https://github.com/mlococo88/All-Structural/pull/884) (HDRS) — projects-ui.js: projectBar options `headerSave:false`, `chipClick`, `chipHint` (opt-in; trial in Spread Footing)   [display only; no key or format change]
- **Why:** engineer 2026-11-06: in Spread Footing, take Save and Saved projects… out of the header (they stay in the Project tab's "Save and open" card); the chip opens the Project tab. Trial in Spread Footing; other apps keep the header Save until the engineer decides.
- **What (`shared/projects-ui.js`, `projectBar`):**
  - Header comment: three options documented after `start` (anchor `HDRS (2026-11-06, TRIAL in Spread Footing only`).
  - Chip click, anchor `chip.addEventListener('click',`: before `chip.addEventListener('click', () => dialog.show());` → after `chip.addEventListener('click', () => { if (ctx.chipClick) ctx.chipClick(); else dialog.show(); });`
  - Header buttons, anchor `[hSave, hLib].forEach(`: before `[hSave, hLib].forEach(b => ctx.header.insertBefore(b, at(ctx.headerBefore)));` → after `if (ctx.headerSave !== false) [hSave, hLib].forEach(…same…);` (the buttons are still built and returned in `el.save` / `el.lib`, just not placed).
  - Chip tooltip in `refresh()`: before `+ '. Click: Saved projects…';` → after `+ '. Click: ' + (ctx.chipClick ? ctx.chipHint || 'open the project' : 'Saved projects…');`
  - Ctrl+S / Ctrl+Shift+S (document keydown, `ctx.keys`) unchanged: they work from anywhere with or without the header buttons.
- **Unchanged for every other tool:** none passes `headerSave`, `chipClick` or `chipHint` (only Spread Footing does), so the header, chip click and tooltip are as before.
- **Loaded by:** ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Geometry, Bridge Substructure Loading, Concrete Beam Capacity, Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Pile Designer, Prestressed Bridge Design, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design - AISC 15th, Steel Bridge Design, Stone Masonry Arch Load Rating, Timber Beam Check, abutment_calculator, elastomeric_design_module, index, lldf, apps/steel-bridge.
- **Check case:** Spread Footing (opts in): header = chip · Undo · Redo · Auto-calculate · Re-analyze · Print; chip click → Project tab, title block open. Standard-save fixture (does not opt in): header chip · Undo · Redo · Save · Saved projects… · Print and chip click = Saved projects…, as before (`tests/smoke/standard-save.mjs` unchanged and passing).
- **How verified:** see the PR (standard-save, start-chooser, project-library for every tool entry, sbd-standard-save, pile-library, steel-bridge-library, github-sync, github-sync-tools, bridge-suite-save, check-syntax).
- **Formulas, factors, units, code references:** none (§4 does not apply).

## 2026-11-08 — PR: claude/sync-autosave-ui (PR #1252: https://github.com/mlococo88/All-Structural/pull/1252) (LIVE PR 2 of 3) — projects-ui.js: auto-save of the open named project, chip status, "Updated on <device>" banner with Load it / Keep mine / Undo   [GitHub sync only; nothing changes while sync is off; no key or format change; no result change]
- **Why:** engineer request 2026-11-08 (A, B). Engine: fixlog/shared-github-sync.md LIVE PR 1 (#1251).
- **What (`shared/projects-ui.js`):**
  - New `liveBar(ctx, b)` (anchor `function liveBar(ctx, b)`), made by every `projectBar` (anchor `live = liveBar(ctx, {`). A 3 s timer. Its first line returns at once when `SharedGitHubSync` is not loaded or sync is not set up (`eng()` null): no request, no key, no element.
    - **Auto-save:** `SharedGitHubSync.autoSaveDue` with "edited" = the inputs' snapshot differs from the one taken when the project was opened / saved (`reset()`, called by `setCur`), so unsaved work restored from a tool's autosave is not saved until it is changed on the page. The save is the tool's own Save (`ctx.save(name)` or `store.save(name, getState())`) through `done(r, name, true, true)`. Never while a dialog is open.
    - **Check:** `SharedGitHubSync.pollDue` (not while `document.visibilityState === 'hidden'` or the page is a frame that is not shown); engine `poll`; a GitHub change → `changeInfo` → banner.
    - **Banners:** `<div class="spLive" data-sp="live">`, fixed bottom left, hidden in print:
      - "Updated on <device> at <hh:mm Eastern> — Load it / Keep mine" (`data-lv="upd"`);
      - after Load it, "Loaded the version from … Undo" (`data-lv="undo"`, until the next input change or ×);
      - messages (`data-lv="msg"`).
    - **Load it:** unsaved inputs on screen are first saved into the project (the tool's Save). Then engine `loadCloud`, the tool's `ctx.open(name)`, and the same bookkeeping as the dialog's Open (`opened`: setCur, afterOpen, start strip, changed).
    - **Undo:** engine `undoLoad`, then `ctx.open`; that GitHub version is not offered again on this page.
    - **Keep mine:** closes the banner for that GitHub version.
  - `done(r, name, quiet)` → `done(r, name, quiet, auto)`. With `auto`, the start strip's `opened` and the immediate `tick(true)` upload are skipped (the background upload sends it, with the tool's settle time). Before: `setCur(name); savedAt[name] = Date.now(); if (st) st.opened(name); … if (dialog.cloud && dialog.cloud.tick) dialog.cloud.tick(true)…`. After: `… if (st && !auto) st.opened(name); … if (!auto && dialog.cloud && dialog.cloud.tick) …`. Save / Save as call it without `auto`: unchanged.
  - `setCur(n)` also calls `live.reset()`.
  - Chip (`refresh()`): after the GitHub badge, `live.chipHtml(n, inList)` = `<span class="spLiveSt">` "auto-saved 14:32" / "uploading" (queued) / "pending (offline)" / "pending (rate limit)" / "pending (token refused)" / "auto-save failed", or nothing. Sync on only.
  - CSS lines for `.spLiveSt` and `.spLive`. The projectBar API returns `live`.
- **Per tool (no tool file changed):**
  - Every tool goes through `projectBar`, so each one auto-saves with its own Save.
  - **Steel Bridge Design:** its Save writes both lists (`sbdPairStore`), and its snapshot holds both parts.
  - **Bridge Suite** (index, lldf, Prestressed): Save = this app's parts into the open project (+ the MIDAS demands bundle in the MCT generator, as Save). The upload keeps the suite's 30 s settle. Hand-off locks are not touched (no channel is written). LL & DL and Prestressed already write their part into the open project on every change, so they are rarely "unsaved"; auto-save mainly acts in the MCT generator. A project listed as "<name> (older, saved …)" is not checked (the sync has no file for it).
  - **Spread Footing:** the Recent projects strip is not closed or reordered by an auto-save (only by the user's own Save / Open).
  - **Concrete Beam Capacity:** each tab's frame has its own bar; a frame that is not shown is treated as hidden.
- **Decisions (pending engineer review):**
  1. "Keep mine" does not upload over the other device's file (that would hide its change in the history). A later save of the project keeps both versions (conflict copy), as before.
  2. Load it with unsaved inputs on screen saves them into the project first, so they end up in the conflict copy.
  3. Banners sit at the bottom left, so the tools' headers and layout are not moved.
  4. The Bridge Suite's MCT auto-save also bundles the latest MIDAS demands, as its Save does.
- **Loaded by (§3):** ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Geometry, Bridge Substructure Loading, Concrete Beam Capacity (three frames), Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Pile Designer, Prestressed Bridge Design, Retaining Wall Designer, Section Property Calculator, Shear and Moment Diagrams, Spread Footing, Steel Beam Design - AISC 15th, Steel Bridge Design, Stone Masonry Arch Load Rating, Timber Beam Check, abutment_calculator, elastomeric_design_module, index.html, lldf.html, apps/steel-bridge (projectBar); tools.html loads github-sync.js only (no projectBar: unchanged).
- **Check case:** `tests/smoke/github-sync-live.mjs` (new; two browsers = two devices on one in-memory GitHub; timings shortened in the page). Spread Footing "Pier 1", geom.B 10 → 11 on device A:
  - auto-saved and uploaded once; the chip shows "auto-saved hh:mm"; no further upload while nothing changes;
  - device B shows "Updated on Laptop at hh:mm" with its geom.B still 10;
  - Load it → 11; Undo → 10, and GitHub still has 11;
  - A and B edit at once (21 / 31) → "Pier 1.json" = 21 and "Pier 1 (conflict Desktop …).json" = 31;
  - a hidden tab makes no request for 14 s and checks again when shown;
  - sync off: no request and no key.
- **Formulas, factors, units, code references:** none.
