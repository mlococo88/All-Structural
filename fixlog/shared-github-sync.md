# Fix log — shared/github-sync.js (window.SharedGitHubSync)

Loaded by: see `shared/README.md` (row `github-sync.js`). Tests: `node tests/engine/run.mjs github-sync` (Node, fetch mocked by
`tests/engine/gh-mock.mjs`) and `node tests/smoke/github-sync.mjs` (browser; api.github.com routed to the same mock).
Engineer's setup steps: `docs/github-sync-setup.md`.

## 2026-11-05 — PR: claude/github-sync (PR #808: https://github.com/mlococo88/All-Structural/pull/808) — created (new file): saved projects copied to a private GitHub repository (GHS)   [storage only; no result change]
- **Why:** engineer request 2026-11-05: see the same saved projects on every device; GitHub chosen over Firebase. A private repository
  (default `mlococo88/structural-projects`) and a fine-grained token (Contents read / write on that repository only), pasted once per device.
- **What:** `shared/github-sync.js` (classic script, no library, GitHub REST API with `fetch`):
  - `client(settings, fetch)`: `GET /repos/{o}/{r}` and `/branches/{b}` (Test connection), `GET /repos/{o}/{r}/git/trees/{branch}?recursive=1`
    (listing and file shas: one request, no 404 per missing file), `GET /contents/{path}` with `Accept: application/vnd.github.raw+json`
    (download), `PUT /contents/{path}` (create, or update with `sha`), `DELETE /contents/{path}` (with `sha`). Every call goes to
    `https://api.github.com` only (other addresses refused), with `cache: 'no-store'`, `credentials: 'omit'`, `redirect: 'error'`,
    `referrerPolicy: 'no-referrer'`. Errors are mapped to offline / auth / notfound / conflict (409, 422 "sha") / rate (403 or 429 with
    `x-ratelimit-remaining: 0` or `retry-after`) / http; messages never contain the token.
  - `engine({ tool, label, store, storage, fetch, toFile, fromFile, space })`: one per tool list (a `SharedProjects.mapStore`).
    `scan()` reads the tool's list key (only when its text changed) and queues every project whose file text is new or changed;
    `flush()` uploads the queue (offline / refused uploads stay queued, retry after 30 s doubling to 10 min, or the rate-limit reset);
    three-way status per project from git blob shas (`gitSha`, SHA-1 of `blob <bytes>\0<bytes>`, so no download is needed to compare):
    synced, waiting to upload, this browser only, not on GitHub (deleted there), on GitHub only, GitHub newer, conflict.
    `download`, `useCloud`, `keepMine`, `deleteCloud` (explicit only), `uploadAll` (first connect).
  - `attach(ctx)`: the hooks `shared/projects-ui.js` calls when a tool passes `ctx.cloud` (the GitHub column, the "On GitHub only" rows,
    the status bar, the first-connect offer, the "Cloud sync (GitHub)" settings dialog with Test connection and Forget token, a
    notice for conflicts). A 3 s timer runs scan + flush; it does nothing while sync is off.
- **Decisions (pending engineer review):**
  1. **Keys (CLAUDE.md §5: new keys only).** Settings in ONE key, `bridgeSuite.v1.githubSync` = `{ owner, repo, branch, token, device }`,
     shared by every tool (all `file://` pages share one storage origin in Chrome / Edge, so one setup covers every tool). Per-tool sync
     bookkeeping in `bridgeSuite.v1.githubSync.tool.<tool>` = `{ v:1, base:{name:{c,l}}, seen:{name:l}, queue:[names], asked, conflicts, lock }`
     (a separate key per tool so two tools open in two tabs never overwrite each other's bookkeeping). Neither key is written while sync
     is off. No tool key or format is changed.
  2. **File = the tool's Export JSON.** `projects/<tool>/<safe name>.json`; `toFile` / `fromFile` hooks per tool when the stored item
     differs from the export (default: the item; JSON indent 1, as Spread Footing's export). Safe name: letters, digits, inner spaces and
     `_-.(),+&'!~=@` kept, anything else `%XX` (UTF-8), so the file name gives the project name back exactly.
  3. **Change detection by reading the list**, not by hooking each save path: any save path of a tool (its own Save / Overwrite, the
     dialog's Rename / Duplicate) is seen within 3 s, with no change to the tool's save code.
  4. **First connect on a device:** projects already in the list are recorded, not uploaded; the dialog offers "Upload all" once
     ("Not now" leaves an Upload button on each). Projects saved after that are uploaded.
  5. **Conflict = keep both.** When GitHub's file is not the one this browser last synced (or GitHub answers 409 / 422 "sha"), ours is
     saved as `<name> (conflict <device> <yyyy-mm-dd hhmm Eastern>)` in this browser (a duplicate of the stored item) and on GitHub, a
     notice is shown, and `<name>` shows "conflict" with "Use GitHub version" / "Keep mine" (both ask first). No retry loop.
  6. **Delete is explicit:** a local delete in the dialog asks "Also delete from GitHub?" (Cancel keeps it; it is then listed under "On
     GitHub only" with "Delete from GitHub"). A rename asks whether to delete the old name on GitHub. A tool's own Delete button never
     touches GitHub.
  7. **Autosave is not synced** (said in the dialog bar and the settings dialog).
  8. **Token:** stored in this browser's storage (said in the dialog), shown masked (`github_pat_••••••••abcd`), sent only in the
     `Authorization: Bearer` header to api.github.com, never in a URL, never logged, never in a project file. "Forget token on this
     device" removes it.
  9. **Two tabs of one tool:** a lock in the per-tool key (90 s) lets one tab upload at a time; the second finds the file already
     identical (same blob sha) and marks it synced.
- **file:// and CORS:** GitHub's REST API answers browser requests from any origin (`Access-Control-Allow-Origin: *`, Authorization
  allowed in the preflight); a `file://` page sends `Origin: null`, which `*` covers because no cookies are sent (`credentials: 'omit'`).
  **Untested against the real API** (this environment cannot reach it); tested against the mock in headless Chromium from `file://`
  (the page's real `fetch`, with CORS preflights). The engineer tests it (ENGINEER_CHECKS.md).
- **Check case:** `tests/engine/github-sync.test.mjs` (12 tests): sync off makes no request and no key; file names round trip
  (`'a/b'` → `a%2Fb.json`); `gitSha('')` = `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` (git's empty blob) and agrees with node:crypto on
  70 kB / Unicode text; Upload all, save, update (PUT `sha` = the previous blob sha); conflict keeps GitHub's text and creates
  `Pier 3 (conflict Laptop 2026-11-05 1432)` with ours; 409 on the PUT; cloud-only download; offline queue and backoff; rate limit
  waits for the reset; delete only explicit; the token only in the header; Test connection reads only and warns on a public repository.
- **Formulas, factors, units, code references:** none (§4 does not apply).

## 2026-11-05 — PR: claude/github-sync-rollout (PR #811: https://github.com/mlococo88/All-Structural/pull/811) — roll-out to every tool with the shared Saved projects dialog; two fixes in the shared file   [storage only; no result change]
- **Loaded by (new):** ASCE7-16 Load Generator, BasePlateAnchorDesigner, Bridge Substructure Loading, Concrete Beam Capacity (Development & Splice
  frame), Gusset Plate Rating, Light Pole and Sign Post, Moving Load Generator, Retaining Wall Designer, Section Property Calculator, Shear and
  Moment Diagrams, Steel Beam Design - AISC 15th, Stone Masonry Arch Load Rating, Timber Beam Check (each tool's `toFile` / `fromFile` in its fix log).
- **Fix 1, `keepBoth` (conflict copy):** a tool whose file carries the project name (Light Pole, Retaining Wall) uploaded the copy with the
  original's text and then once more with its own. Before: `const l = gitSha(text); const r = await c.put(pathOf(cn), text, …); … v.seen[cn] = l; … v.base[cn] = { c: r.sha, l };`.
  After: `const l = gitSha(text), ctext = fileText(cn), lc = gitSha(ctext); const r = await c.put(pathOf(cn), ctext, …); … v.seen[cn] = lc; … v.base[cn] = { c: r.sha, l: lc };`
  (`conflicts[name].l` stays the original's). Check: new test "a file that carries the project name": the copy's file has `name` = the copy's
  name, and a second flush sends no PUT.
- **Fix 2, `attach`:** before the 3 s timer, new `if (eng.configured()) eng.init();`. Before, a project saved within the first 3 s after the
  page opened on a device with no bookkeeping yet was counted as "already here" (offered by Upload all) instead of uploaded.
- **Not covered (own project dialogs, not `libraryDialog`):** abutment_calculator, elastomeric_design_module, Bridge Geometry, Pile Designer
  (IndexedDB), index.html, lldf.html, Prestressed Bridge Design, Steel Bridge Design, apps/steel-bridge. Each needs its own small adapter;
  not done (question for the engineer).

## 2026-11-05 — PR: claude/ghsync-ext (PR #815: https://github.com/mlococo88/All-Structural/pull/815) (GHS2) — hooks for tools with their own project dialog; first tool: abutment_calculator   [storage only; no result change]
- **Why:** engineer request: sync in the tools that keep projects in their own dialog or panel (not `libraryDialog`).
- **What (`attach`, additive; the Saved projects dialog of the 14 tools behaves as before):**
  - New `statusCell(name)`: the GitHub status badge and its buttons for one project (`<span data-sp="gh-cell">…</span>`; `''` while sync is off), for the tool to place in its own row.
  - New `bind(el)` (= the existing `bindBody`): one click listener for those buttons on the tool's rows element.
  - `decorate(body, u)` → `decorate(body, u, o)`: `o.rows === false` skips the GitHub column of `body`'s table (the tool placed `statusCell` itself). Before: `const table = body.querySelector('table');` After: `const table = o && o.rows === false ? null : body.querySelector('table');`
  - In `decorate`, `own = !(dlg && dlg.querySelector('.spHead span'))` (not a Saved projects dialog): the "Cloud sync (GitHub)…" settings button goes in the sync bar (`data-ghx="setup"`, already handled) instead of the dialog head. Before: `if (dlg && !dlg.querySelector('[data-gh=setup]')) {` After: `if (dlg && !own && !dlg.querySelector('[data-gh=setup]')) {`.
- **Loaded by:** the 14 tools in `shared/README.md` (unchanged path: `libraryDialog` passes no third argument and has a `.spHead`), and new: `abutment_calculator.html`.
- **Check case / how verified:** `node tests/engine/run.mjs github-sync`: 13 / 13. `node tests/smoke/github-sync.mjs` (whole flow, Spread Footing): ALL PASS. `node tests/smoke/github-sync-tools.mjs` (all 15 tools): ALL PASS. `node tests/smoke/project-library.mjs --tool <each of the 15>` (origin/main vs branch, sync off): ALL PASS. `tests/smoke/github-sync-tools.mjs` extended: `OWN` (show the tool's own dialog), "synced" shown in the row, and for own-dialog tools the settings button in the bar, the first-sync offer, a delete that asks about the GitHub copy, and a sync-off run (no request, no sync key).
- **Formulas, factors, units, code references:** none (§4 does not apply).

## 2026-11-05 — PR: claude/standard-save-shared (PR #836: https://github.com/mlococo88/All-Structural/pull/836) (STDS PR 1) — "This browser only" (hold), settle time, listStore lists, one-table option   [storage bookkeeping only; no result change]
- **Why:** the standard save (engineer decision 2026-11-05): Save as offers "This browser only"; the bridge suite (later PR) uploads after edits pause about 30 s; own lists (id-keyed, IndexedDB) get a by-name `listStore`.
- **What (all additive; with none of the new options a tool syncs exactly as before):**
  - `engine(o)`: new `o.settle` (ms; default 0 = as before). `scan` notes when each queued name changed (in memory); `flush(force, all)` skips a name changed less than `settle` ago unless `all` (Upload, Upload all, Sync now / dialog opened pass `all`). Before: `async function flush(force) {` After: `async function flush(force, all) {` + `if (!all && settle && changedAt[name] && now() - changedAt[name] < settle) continue;`.
  - New `hold(name, on)` / `held(name)`: bookkeeping field `hold: { name: true }` in `bridgeSuite.v1.githubSync.tool.<tool>` (the sync key only; written only while sync is set up; `hold` returns false and writes nothing while sync is off). A held name is not queued by `scan`, skipped by `flush` and `uploadAll`, shown as "this browser only" (`statusOf` → `local`), and `upload(name)` clears it. Held names no longer in the list are dropped at the next scan. `attach().renamed` carries the hold to the new name.
  - Change check: `scan` / `init` / after a download or conflict copy read `store.stamp()` when the store has it (every mapStore / listStore now does; a mapStore's stamp is the stored text, the same value as before) instead of `storage.getItem(store.key)`.
  - `attach().decorate(body, ui, { only: false })`: no separate "On GitHub only" table (the standard dialog lists those rows itself). `attach()` also returns `cell(name, status, conflict)`.
- **Loaded by:** unchanged list in `shared/README.md`; no page passes `settle`, `only: false` or calls `hold` yet.
- **Check case / how verified:** `node tests/engine/run.mjs github-sync`: 16 / 16 (3 new: hold, settle, listStore). Settle check: save B1 at t, flush at t → not sent; edit at t+20 s, flush at t+40 s → not sent; flush at t+55 s → sent with v = 2. `node tests/smoke/github-sync.mjs`, `github-sync-tools.mjs` (19 tools), `home-sync.mjs`: ALL PASS; `tests/smoke/standard-save.mjs` (hold through Save as, Upload): ALL PASS.
- **Formulas, factors, units, code references:** none (§4 does not apply).

## 2026-11-06 — PR: claude/sbapp-stds (PR #855: https://github.com/mlococo88/All-Structural/pull/855) (STDS-B) — attach(): `ctx.cloud.store` (the list the sync works on) and no GitHub-delete question while the name is still in that list   [storage bookkeeping only; no key or format change]
- **What (`shared/github-sync.js` `attach(ctx)`):** engine `store: ctx.store` → `store: cfg.store || ctx.store`; `const store = () => ctx.store;` → `const store = () => cfg.store || ctx.store;` (first-sync count); `renamed(a, b)`: `if (cl && cl.has(a) && confirm(…` → `if (cl && cl.has(a) && !store().has(a) && confirm(…`; `deleted(name)`: `if (cl && cl.has(name) && confirm(…` → `if (cl && cl.has(name) && !store().has(name) && confirm(…`. Header comment of `attach` documents `ctx.cloud.store`.
- **Why:** apps/steel-bridge's dialog lists every item (duplicate names included) while the sync works on the newest item of each name (`ghStore`, as in #823). After deleting / renaming the newest item, an older item may still carry the name: its GitHub file must not be offered for deletion (the rule #823 implemented in the app's own dialog).
- **Unchanged for mapStore tools:** without `cfg.store` the store is `ctx.store`; after a mapStore rename / delete the old name is never in it, so the question is asked exactly as before.
- **Loaded by:** as `shared/projects-ui.js` (fixlog/shared-projects.md, same date) plus tools.html.
- **How verified:** `tests/smoke/steel-bridge-library.mjs` step 11 (delete of the newest "Dup" with an older "Dup" left: only the delete question, the GitHub file kept); `tests/smoke/github-sync.mjs`, `github-sync-tools.mjs` (all tools), `home-sync.mjs`.
- **Formulas, factors, units, code references:** none.

## 2026-11-06 — PR: claude/bss-shared-mct (PR #863: https://github.com/mlococo88/All-Structural/pull/863) (BSS) — settle across open tabs of one tool; Save sends a settling project at once   [no key or format change]
- **Why:** the Bridge Suite (three pages, one tool key `bridge-suite`, `settle: 30000`) is the first user of `settle`. (1) With two pages open, the page that did not record a change (the other page's scan had already set `seen`) had no `changedAt` for it and uploaded it at once, so the settle time did not hold. (2) After Save, `tick()` flushed without `all`, so a project inside its settle time waited although the user pressed Save.
- **What (`engine`, anchor `const changedAt = {};`):** new `const known = {};` (the file sha this page last saw per name); in `scan()`, before the existing `names.forEach(n => { if (v.seen[n] !== shas[n]) …`: `if (settle) names.forEach(n => { if (known[n] !== shas[n]) { known[n] = shas[n]; changedAt[n] = now(); } });`. Without `settle` (every other tool) the line does nothing.
- **What (`attach`, anchor `async function tick(`):** `async function tick()` → `async function tick(all)`; `eng.flush(q > 0 && !(before && before.kind === 'rate'))` → `eng.flush(q > 0 && !(before && before.kind === 'rate'), !!all)`. The 3-s timer and `online` still call `tick()` (all false), as before. `shared/projects-ui.js` `done()` calls `tick(true)` after a Save (fixlog/shared-projects.md); for a tool without `settle`, `all` changes nothing.
- **Check case:** engine test "settle across two pages of one tool": page A scans the change at t, page B at t + 1 s; B's flush at t + 1 s uploads nothing (before: uploaded); at t + 32 s both flush: one PUT. Fails with the `known` line removed.
- **Loaded by:** every tool listed for `shared/github-sync.js` in shared/README.md, plus `index.html` (this PR); behaviour unchanged for all of them (no `settle`).
- **How verified:** `node tests/engine/run.mjs github-sync` (17 / 17), `tests/smoke/github-sync.mjs`, `github-sync-tools.mjs` (all tools), `home-sync.mjs`, `standard-save.mjs`, `bridge-suite-save.mjs`.
- **Formulas, factors, units, code references:** none.

## 2026-11-08 — PR: claude/sync-autosave-engine (PR #1251: https://github.com/mlococo88/All-Structural/pull/1251) (LIVE PR 1 of 3) — engine for auto-save, the open project's GitHub check and presence (no UI yet)   [sync bookkeeping only; no tool key or format change; no result change]
- **Why:** engineer request 2026-11-08: (A) auto-save the open named project (opt-in box, on by default once sync is set up), (B) check GitHub every ~30 s for the open project and offer "Load it / Keep mine", (C) presence: warn and show a banner when two devices have the same project open. This PR adds the engine and its Node tests; the dialog box, chip status and banners come in PR 2 (shared/projects-ui.js), presence in PR 3. No page calls the new functions yet, so every tool behaves as before (apart from the commit message and the 409 retry below).
- **New (module level, all additive):**
  - Keys (CLAUDE.md §5: new keys only; none written while sync is off, none read by any tool): `bridgeSuite.v1.githubSync.live` = `{ v:1, autoSave, watch }` (absent = both on; `live(storage)`, `saveLive(storage, { autoSave, watch })`); `bridgeSuite.v1.githubSync.deviceId` = 12 random `[a-z0-9]` (`deviceId(storage, create)`, made on the first heartbeat only); `bridgeSuite.v1.githubSync.presence.<tool>` = `{ v:1, files: { "<presence path>": { sha, at, since, tabs: { <tab>: ms } } } }` (this browser's own heartbeat files, so two tabs write one file, once a minute). The settings key `bridgeSuite.v1.githubSync` keeps its five fields (`saveSettings` unchanged).
  - `LIVE = { every: 30000, quiet: 5000, poll: 30000, beat: 60000, stale: 150000, idle: 600000 }` (ms).
  - Pure decisions: `autoSaveDue(x)` (configured, box on, a named project in the list, inputs differ from the saved copy, edited on this page, not the text already auto-saved, 5 s without a change, 30 s since the last save → `due`; else the reason), `pollDue(x)` / `beatDue(x)` (sync and the "watch" box on, a named project, the tab visible, the interval; the heartbeat also stops 10 min after the last input on the page), `presenceFresh(p, now)` (see Decision 3).
- **New (engine methods):** `poll(name)` → `same | changed | both | gone | none | held` from one tree request (reused when this page read the tree less than 24 s ago), plus the other devices' heartbeats; `changeInfo(name, sha)` → `{ device, at }` from `GET /repos/{o}/{r}/commits?path=…&sha=<branch>&per_page=1` (one request per new sha); `loadCloud(name)` ("Load it" = `useCloud`, which keeps a version GitHub does not have as a conflict copy first) → `{ ok, copy?, undo }`; `undoLoad(undo)` (the previous version back under the name through `fromFile` + `store.save`, the name's `base` / `seen` / `conflicts` bookkeeping as before; nothing uploaded or deleted on GitHub); `presenceOf(name, files)`, `others(name)`, `beat(name)`, `leave(name, { keepalive })`. Client: new `commits(path)`; `del(path, sha, message, { keepalive })`; `call()` passes `keepalive` to `fetch` (only the presence delete sent while a page closes sets it).
- **Changed (behaviour, called out):**
  1. Commit message of a save, anchor `saveMsg`: before `` `${label}: save "${name}"` `` → after `` `${label}: save "${name}"${devName() ? ` (from ${devName()})` : ''}` `` (`devName()` = the settings' device name without `()` / line breaks). Commit messages are repository history, not a saved format; "Updated on <device>" reads it back. `tests/engine/github-sync.test.mjs` line `^Spread Footing: save "Footing C"$` → `… "Footing C" \(from Laptop\)$`.
  2. `flush()`, anchor `GitHub can refuse a commit when another file of the branch was committed at the same moment`: before, any 409 / 422 "sha" on the PUT → conflict copy (`keepBoth`). After: the file's sha is read again; when it is still the sha the PUT was sent with (the branch moved, e.g. another device's heartbeat, the file did not), the PUT is sent once more; only a changed file (or a second refusal) makes the conflict copy, as before. Fewer false conflict copies; never an overwrite (the PUT still carries the sha).
  3. `flush()` / `refreshCloud()` read the tree through `treeOf()` (kept as `lastTree` for `poll()`); `refreshCloud()` takes the files directly in `projects/<tool>/` from the same one tree request `client.list()` made (`.presence/` and any other sub-folder skipped, as before). `keepBoth`, `keepMine`, `deleteCloud` keep `lastTree` up to date. `useCloud()` returns the name of the copy it made (`copy`).
  4. `flush()` waits (`skipped`) while this page writes a heartbeat (`pbusy`), so one page never sends two commits at once.
- **Presence file (Decision, pending engineer review):** `projects/<tool>/.presence/<safe name>.<device id>.json` = `{ "v": 1, "app": "presence", "tool", "project", "device", "id", "since" (ISO, when this browser opened the project), "at" (ISO, this write) }` (JSON indent 1). In a sub-folder, so the project listing / Download (files directly in `projects/<tool>/`) never sees it; a project named ".presence" is the file `%2Epresence.json` (safeName encodes a leading dot). `<safe name>.` + an id of `[a-z0-9]{8,32}` (no dot) keeps "A" and "A.b" apart.
- **Decisions (pending engineer review):**
  1. Settings in a new key `bridgeSuite.v1.githubSync.live` instead of new fields in `bridgeSuite.v1.githubSync` (its format stays `{ owner, repo, branch, token, device }`); both boxes on when absent ("on by default once sync is set up").
  2. "Updated on <device>": the device name is in the save's commit message (no new field in any project file); a commit made before this change shows "another device".
  3. Heartbeat freshness `presenceFresh`: stale 150 s after this page first saw the file's current sha; a fresh file must also have its own `at` < 150 s old, unless this page saw its sha change while watching (so a device with a wrong clock is still shown while it writes, and goes stale once it stops). A heartbeat file is read only when its sha is new to the page.
- **Check case:** `node tests/engine/run.mjs github-sync` (new file `tests/engine/github-sync-live.test.mjs`, 11 tests): `autoSaveDue` with x = `{ dirty, edited, changedAt: 1000, lastAt: 0, now: 40000 }` → due; changedAt 36000 → typing (4 s); lastAt 15000 → wait (25 s); `presenceFresh({ at: now+1 h, seenAt: now-151 s, changed: true })` → false; poll states; Load it + Undo leaves GitHub untouched and the status "GitHub newer"; two devices editing at once → `J (conflict Laptop …)` on GitHub and here, GitHub's J never overwritten, every version kept after Load it + Undo; a 409 from a moved branch → sent again, no conflict copy; the heartbeat file and its fields, one write per minute for two tabs, seen by a second browser with the same device name (different id), stale after 150 s, deleted by the last tab; sync off → no request, no key. `tests/engine/gh-mock.mjs` (test tooling): `GET /commits?path=` and a commit date per commit.
- **Formulas, factors, units, code references:** none (§4 does not apply).

## 2026-11-08 — PR: claude/sync-autosave-ui (PR #1252: https://github.com/mlococo88/All-Structural/pull/1252) (LIVE PR 2 of 3) — Cloud sync dialog: "Auto-save open project every 30 s" and "Check GitHub every 30 s for changes to the open project"   [new key bridgeSuite.v1.githubSync.live only, written when a box is changed]
- **Where:** `settingsDialog`, after the device field. Two checkboxes `#spGhAuto` / `#spGhWatch`, each with a note. `d.onchange` → `saveLive(storage, { autoSave, watch })` at once ("Saved (applies to every tool in this browser).").
- **CSS:** `dialog.spGh label.spGhChk{…}` (the dialog's input rule made a checkbox 100% wide).
- **Unchanged:** the five settings fields and their key; with sync off the dialog writes nothing unless a box is changed.
- **Tests:** see fixlog/shared-projects.md, same PR. **Formulas:** none.

## 2026-11-08 — PR: claude/sync-presence (PR #1253: https://github.com/mlococo88/All-Structural/pull/1253) (LIVE PR 3 of 3) — engine `presenceHint(name)`; the dialog box's text names presence   [no key or format change]
- **What:** new engine method `presenceHint(name)` (anchor `function presenceHint(`). It returns 'none' when the tree this page read less than 2 × LIVE.poll ago has no other device's heartbeat for the project, 'some' when it has one, and 'unknown' otherwise. With 'none', `projects-ui.js` opens at once, without a request.
- The box text "Check GitHub every 30 s for changes to the open project" becomes "…, and show who else has it open", and its note says what the presence file is.
- **Presence file and decisions:** see #1251 (format, path) and fixlog/shared-projects.md, same PR (commit noise).
- **Tests:** see fixlog/shared-projects.md, same PR. **Formulas:** none.
