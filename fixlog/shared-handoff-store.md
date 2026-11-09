# Fix log — shared/handoff-store.js (window.SharedHandoffStore)

Loaded by: see `shared/README.md` (row `handoff-store.js`). Spec: `HANDOFF.md` §5.1. Tests: `node tests/engine/run.mjs handoff-store`
(Node; GitHub mocked by `tests/engine/gh-mock.mjs`).

## 2026-11-09 — PR: claude/geomxfer-spec — created (new file): per-project hand-off copies, uploaded through Cloud sync (GXF-1)   [storage: new keys only; no calculation]
- **Why:** engineer decisions 2026-11-09 (started 2026-11-09): "All hand-offs should be per project"; the sent copies go through the
  projects repository when Cloud sync is on (option 2); Pull asks which project. First channels: the new `superGeometry` (HANDOFF.md §4.14)
  and `superReactions` (§4.4); the others move one at a time later.
- **What:** `shared/handoff-store.js` (classic script, IIFE, one namespace; no DOM; storage, fetch and `SharedGitHubSync` passed in or read
  at call time):
  - `pidOf({ name, bridgeId })` (anchor `const id = enc(b) + '~' + enc(n);`): project id `enc(bridgeId) + '~' + enc(name)` (trimmed, inner
    white space collapsed; `enc` keeps `A-Z a-z 0-9 space _ -`, every other character `%XX` of its UTF-8 bytes); '' with neither; longer
    than 120 characters: the first 100 + `~h` + FNV-1a of the whole id.
  - `write(storage, channel, producer, payload)`: `bridgeSuite.v1.<channel>.by.<producer>.<project id>` = the stamped payload as published.
  - `send(o)`: `write`, then with Cloud sync set up `PUT handoffs/<channel>/<producer>/<project id>.json` (JSON, one-space indent; the
    file's sha from one tree read; one retry on a sha conflict); a failed upload is queued in `bridgeSuite.v1.handoffStore.pending`
    and sent by `flush` at the next send or list.
  - `local(o)`, `cloud(o)`, `list(o)`, `group(entries)`: this browser's per-project copies + the legacy keys a receiver names + (sync on)
    the GitHub copies, validated (`_schema`, `schemaVersion`), a GitHub file identical to this browser's copy (git blob sha) not downloaded;
    grouped by project id, newest `producedAt` first, the same payload once; no project → "earlier hand-off (no project)".
  - `match(groups, { name, bridgeId })`: the bridgeId (both non-blank, case-insensitive), else the name.
  - `fnv`, `contentHash(obj)` (FNV-1a of `JSON.stringify`, as HANDOFF.md §4.6), `deviceName(storage)` (the Cloud sync device name).
- **Saved data (CLAUDE.md §5):** new keys only (`…by.<producer>.<project id>`, `bridgeSuite.v1.handoffStore.pending`); no existing key or
  format is read differently or written. The project id always contains `~`, so a per-project key never equals a channel's `.updatedAt`,
  `.adopted.<receiver>` or `.by.<producer>` key. With Cloud sync off: no request, no sync key.
- **Calculations:** none (§4 not engaged).
- **Decisions (pending engineer review):**
  1. Key scheme `bridgeSuite.v1.<channel>.by.<producer id>.<project id>` (the example of the decision, with `~` between bridgeId and name).
  2. Project names compare exactly after trimming and collapsing white space (two names differing only in case are two projects); the
     picker's preselection compares case-insensitively.
  3. GitHub: the newest send replaces the file (a sent copy is a snapshot, not an edited document, so no "keep both" copies as the project
     sync makes); another device's copy of the same project is overwritten by the next send from here.
  4. A receiver lists GitHub copies in memory only; it does not write them into this browser's sender keys.
- **Check case:** `{ name: " Route 9  over  Mill Brook ", bridgeId: "B-12-034" }` → id `B-12-034~Route 9 over Mill Brook`, key
  `bridgeSuite.v1.superGeometry.by.steelbridge.B-12-034~Route 9 over Mill Brook`, GitHub path
  `handoffs/superGeometry/steelbridge/B-12-034~Route 9 over Mill Brook.json`. `{ name: "A.b/c~d" }` → `~A%2Eb%2Fc%7Ed`.
- **How verified:** `node tests/engine/run.mjs` (new `handoff-store.test.mjs`, 4 tests: ids, local listing and grouping, sync off, sync on
  with upload / update / offline queue / merge of another device's copy / no download of an identical copy); `node tests/check-syntax.mjs`.
- **Other copies:** none (shared file).
- **Open items:** none.
