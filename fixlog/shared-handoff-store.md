# Fix log — shared/handoff-store.js (window.SharedHandoffStore)

Loaded by: see `shared/README.md` (row `handoff-store.js`). Spec: `HANDOFF.md` §5.1. Tests: `node tests/engine/run.mjs handoff-store`
(Node; GitHub mocked by `tests/engine/gh-mock.mjs`).

## 2026-11-09 — PR: claude/geomxfer-spec (PR #1261: https://github.com/mlococo88/All-Structural/pull/1261) — created (new file): per-project hand-off copies, uploaded through Cloud sync (GXF-1)   [storage: new keys only; no calculation]
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
  - Channel helpers shared by sender and receiver: `geometryHash(p)` (§4.14 `contentHash` over spans, supports, girders, edges, deck,
    section, ownerRules), `checkGeometry(p)` (§4.14 checks: schema, units, counts, finite and positive numbers; a hash that no longer
    matches is a warning), `summary(channel, p)` (the picker's line, e.g. "3 spans, 110–140–110 ft, 5 girders").
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
- **How verified:** `node tests/engine/run.mjs` (new `handoff-store.test.mjs`, 5 tests: checkGeometry / summary; ids, local listing and grouping, sync off, sync on
  with upload / update / offline queue / merge of another device's copy / no download of an identical copy); `node tests/check-syntax.mjs`.
- **Other copies:** none (shared file).
- **Open items:** none.

## 2026-11-09 — PR: claude/geomxfer-readme — shared/README.md row: the tools that load the file   [documentation only]
- The row said "None yet"; it now names `apps/steel-bridge/index.html` (#1264), `Bridge Substructure Loading.html` (#1265) and
  `Steel Bridge Design.html` (#1266). No code change.

## 2026-11-11 — PR: fdx-perunit (PR #1424: https://github.com/mlococo88/All-Structural/pull/1424) — per-unit copies (FPU; engineer decision 2026-11-11 "Fix both")   [no calculation; storage: new keys only]

- **Where:** `copyKey`, `cloudPath`, `write`, `send`, `local`, `cloud`, `group`, the export object; new `unitId`, `unitKey`, `pickDefault`, `newerOfUnit` (anchor `/* FPU (2026-11-11)`).
- **Before:** `copyKey = (channel, producer, pid) => `${NS}${channel}.by.${producer}.${pid}``; `write(storage, channel, producer, payload)`; `local()` took everything after `.by.<producer>.` as the pid. **After:** `copyKey(channel, producer, pid, unit)` = `…by.<producer>.<pid>` + (`.<unit>` when a unit is given), `cloudPath` likewise (`<pid>.<unit>.json`); `write(…, unit)` and `send({ …, unit })` (unit checked against `/^[A-Za-z0-9 _%-]{1,62}$/`); `local`/`cloud` split the id at its first `.` (`splitId`) and add `unit` to each entry (`''` for a project copy); `group` sorts a unit copy before the project copy of the same send (`|| ((b.unit ? 1 : 0) - (a.unit ? 1 : 0))`); the queue's `pid` holds the copy id. `unitId(name)` = `enc(norm(name))`, > 60 chars → 50 + `_h` + fnv. `unitKey(p)` = `producer|#unitIndex` else `producer|L<label lower-case>`. `pickDefault(groups, open, last)` → the matched project's entry with `unitKey(last)` (when `last`'s project is that project), else its newest. `newerOfUnit(groups, e)` → the newest entry of e's project with the same `unitKey` when newer.
- **Check case:** `copyKey('foundationLoads','subloads','B-1~A','support-2')` = `bridgeSuite.v1.foundationLoads.by.subloads.B-1~A.support-2`; `cloudPath(...)` = `handoffs/foundationLoads/subloads/B-1~A.support-2.json`; `unitId(' Abut.  1 ')` = `Abut%2E 1`.
- **Tools that load it (all tested):** Bridge Substructure Loading, abutment_calculator, Pile Designer, Spread Footing, Steel Bridge Design.html, apps/steel-bridge (geometry-handoff, gd-reactions-handoff, github-sync-tools; other channels write no `.` after the pid, so they list as before).
- **How verified:** `node tests/engine/run.mjs` (2 new handoff-store tests), the smoke tests listed in the PR.
- **Decisions (pending engineer review):** (1) SubLoads unit id = support number `support-<n>` (not the name); (2) the per-project copy `.by.subloads.<pid>` (last unit) is still written and uploaded after the unit copy, for backward compatibility; (3) the Abutment Calculator writes one copy per project, per unit (the SubLoads unit name `S.subloadsSrc.abutment`) when the project was pulled from a SubLoads abutment; (4) "older" is per project and unit; (5) the picker default is the unit last pulled into the open project, read from the existing saved source record (nothing new saved); (6) the upload queue's `pid` field holds the copy id (format unchanged).
- **Calculations:** none (§4 not engaged): a pull of any copy imports exactly the payload that unit's send produced; main-vs-branch probes identical (PR description).
- **Saved data (§5):** new prefixed keys only (`bridgeSuite.v1.foundationLoads.by.<producer>.<project id>.<unit id>`, and `.by.abutment.<project id>`); no existing key or format changed.
- **Other copies:** none.
