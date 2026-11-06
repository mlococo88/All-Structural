# Fix log — shared/project-registry.js (window.SharedProjectRegistry)

Loaded by: see `shared/README.md` (row `project-registry.js`). Tests: `node tests/engine/run.mjs project-registry` (Node) and
`node tests/smoke/home-projects.mjs` (browser: each tool's own Save, then the home page).

## 2026-11-05 — PR: claude/home-saved-projects (PR #818: https://github.com/mlococo88/All-Structural/pull/818) (HSP PR 1) — created (new file): where each tool keeps its saved-project list   [read only; no result change]
- **Why:** engineer request 2026-11-05: a "Saved projects" view on the home page (`tools.html`) across the apps. The home page cannot run a
  tool's code, so it needs to know, per tool, the list key and how the tool reads the saved time.
- **What:** one entry per tool with a saved-project list and GitHub sync (16 at 2026-11-05: the 14 of #811, the Abutment Calculator (#815) and Elastomeric Bearing Design (#817), whose own Projects dialogs are newest first by `ts`): `tool` / `label` (the tool's `ctx.cloud`),
  `name` (shown), `href` (page to open; the rebar calculator opens `Concrete%20Beam%20Capacity.html#dev`), `key` (the tool's own list key),
  `time` / `sort` (the tool's own `mapStore` options). `all()`, `get(tool)`, `store(entry, storage)` (a `SharedProjects.mapStore` with
  those options), `list(entry, storage)` (`{ ok, error, items }`; an unreadable list is reported, never changed).
- **Keys / formats (CLAUDE.md §5):** none new, none changed; the file only reads.
- **Decision (pending engineer review):** the entries repeat the key / time / sort / tool / label each tool passes to `mapStore` and
  `ctx.cloud` (the tools are not changed to read them from here, to keep this task off the 14 tool files while other tools are being
  changed in parallel). Drift is caught by the tests: the Node test checks that each tool's page contains the same key and the same
  `cloud:{tool:'…',label:'…'`; the browser test checks the home page lists the same names, order and saved times as each tool's own dialog.
- **Check case:** `{"B":{"x":1},"A":{"y":2}}` in `sfd_projects` → `A`, `B` (by name, no time); `movingLoadGen.projects.v1` with
  `savedAt` 2026-01-01 / 2026-11-01 → newest first, as the Moving Load Generator's dialog; `{bad` → `{ ok:false, error:'unreadable' }` and
  the text is left as it is; the storage is byte-identical after every call.
- **Formulas, factors, units, code references:** none (§4 does not apply).

## 2026-11-05 — PR: claude/home-sync-all (PR #821: https://github.com/mlococo88/All-Structural/pull/821) (HSP PR 2) — file text and sync engine per tool, for the home page's GitHub status and Sync all   [storage only; no result change]
- **What:** each entry gets `space` and `toFile`, copied from the tool's `ctx.cloud` (one-line wrappers of the stored item, no calculation). The 17 entries (Bridge Geometry, #819, added in this PR) are:
  - `i => i.d` (Section Property, Shear & Moment, Steel Beam, Timber);
  - `i => i.state` (Abutment, Elastomeric); Bridge Geometry (#819) `(i, n) => { const o = Object.assign({}, i, { name: n }); delete o.savedAt; return o; }` (list: by name, time `savedAt`);
  - Light Pole `{ tool, format:'lpp-project', version:1, name, state }`;
  - Retaining Wall `{ format:'RetainCalcPro.project', version:1, name, fields }`;
  - Base Plate `Object.assign({ _bpad:'project', _bpadVersion:1 }, i)`;
  - Gusset `{ _schema:'gusset-rating-project', version: custom pattern ? 2 : 1, app:'Gusset Plate Rating', data: i }`, i.e. the tool's `GPR.exportProject` without `savedAt`, written out; its rule for `version` is the tool's;
  - none (the stored item itself) for the rest.

  `sync: false` (list only) is available for a tool whose file needs the tool's own code; no tool uses it yet. New `fileText(entry, item, name)` makes the same text as the engine's `fileText`. New `engine(entry, storage, fetch, o)` returns `SharedGitHubSync.engine` with the tool's tool / label / key / toFile / space, so it shares the tool's bookkeeping key, queue, lock and conflict rules. Its `fromFile` refuses ("open <app> …"), so the home page never writes a GitHub file into a tool's list.
- **Byte-identical files:** `tests/smoke/home-sync.mjs` uploads from the home page, then opens each of the 17 tools with sync on. Each tool's own engine computes its own file text and compares its git blob sha with GitHub's. It reports "synced" and uploads nothing (0 writes after its background check), and the bookkeeping `l` of every project equals the git sha of the file on GitHub. Each tool's sync file is its Export JSON (tested for Spread Footing in `tests/smoke/github-sync.mjs`, and per tool in #811 / #815 / #817).
- **Drift guard (Node):** each tool page's `cloud:{…}` has the same `space`, and has a `toFile` exactly when the entry has one; `fileText` = engine `fileText`; home Upload all followed by a tool engine shows synced with no write, for every entry (`tests/engine/run.mjs project-registry`).
- **Shared files (§3):** `shared/github-sync.js` and `shared/projects.js` are unchanged (only loaded by `tools.html` too). No tool loads `project-registry.js`.
- **Formulas, factors, units, code references:** none (§4 does not apply).

## 2026-11-05 — PR: claude/ghsync-sbapp (PR #823: https://github.com/mlococo88/All-Structural/pull/823) (GHS2) — entry for the Steel Bridge app; optional `view` for a list that is not a mapStore   [storage only; no result change]
- **What:** new optional entry field `view(storage)` → a read-only by-name store with the mapStore interface (`key`, `read`, `list`, `has`, `item`; `save` / `duplicate` / `rename` / `remove` refuse with "open the app"). `store(e, storage)`: new first line `if (e.view) return e.view(storage);` (entries without `view` unchanged). New `sbd2View(storage)`: `sbd2.lib.index` (schema `sbd2.library`) + `sbd2.lib.p.<id>`, each name = its newest item by `saved` (the same rule as the app's own sync, `apps/steel-bridge/index.html` `ghStore`); `saved` before 1971 (a rebuilt index) shown as none, as the app; an unreadable index is reported and left as it is. New entry (first: its card comes before Moving Load Generator's) `{ tool: 'steel-bridge-app', label: 'Steel Bridge Design (new app)', href: 'apps/steel-bridge/index.html', key: 'sbd2.lib.index', toFile: t => t, view: sbd2View }`.
- **Home sync and conflicts:** a conflict found from the home page cannot keep both (the view refuses `duplicate`): nothing is uploaded, the home page shows the engine's message, and the app resolves it when opened.
- **Tests:** `tests/engine/project-registry.test.mjs`: drift guard: for a `view` entry the key may be in the app folder's own `.js` files (`engine/model.js` KEYS); the generic fileText / home-then-tool test skips `view` entries; new test for the app view (list newest per name, file text = stored text, home Upload all then the app engine over the same view: synced, no write; a conflict from home: nothing uploaded; the app keys unchanged; unreadable index kept). `tests/smoke/home-projects.mjs`: `sbapp` in `FOLDER`, `OWN_ROWS`, new `OWN_DATE` (the saved-time cell index). `tests/smoke/project-library.mjs`: `sbapp` entry (used by github-sync-tools / home-projects; `noRun` here).
- **Loaded by:** `tools.html` (home page). No tool loads it.
- **How verified:** `node tests/engine/run.mjs project-registry github-sync projects`: 26 / 26. `node tests/smoke/home-projects.mjs`: ALL PASS. `node tests/smoke/home-sync.mjs`: ALL PASS.
- **Formulas, factors, units, code references:** none.

## 2026-11-05 — PR: claude/ghsync-sbd (PR #826: https://github.com/mlococo88/All-Structural/pull/826) (GHS2) — entry for Steel Bridge Design (GirderDetail)   [storage only; no result change]
- New first entry `{ tool: 'steel-bridge-design', label: 'Steel Bridge Design', name: 'Steel Bridge Design (GirderDetail)', href: 'Steel%20Bridge%20Design.html', key: 'girderdetail_projects_v1', space: 2, toFile: (i, n) => ({ app: 'SteelBridgeDesign', v: 1, name: n, data: i }) }` (the tool's own toFile with its `SBD_V` = 1; `tests/smoke/home-sync.mjs` fails if they ever differ). Card order: first (its card precedes the new app's).
- `tests/smoke/home-projects.mjs` `FOLDER`: `gd`; `tests/smoke/project-library.mjs`: `gd` entry (`noRun`).
- **How verified:** `node tests/engine/run.mjs project-registry github-sync projects`; `node tests/smoke/home-projects.mjs`; `node tests/smoke/home-sync.mjs` (see the PR).

## 2026-11-06 — PR: claude/cbc-stds-capacity (PR #854: https://github.com/mlococo88/All-Structural/pull/854) (STDS) — entry for Concrete Beam Capacity, Beam Capacity tab   [storage only; no result change]
- New entry before `aci-rebar-development`: `{ tool: 'concrete-beam-capacity', label: 'Concrete Beam Capacity', name: 'Beam Capacity (Concrete Beam Design Suite)', href: 'Concrete%20Beam%20Capacity.html#capacity', key: 'rcbeam_v2_projects', time: i => i && i.__savedAt || null, sort: 'saved', space: 2 }` (the tool's own mapStore options and ctx.cloud; the file = the stored record).
- Tests: `tests/smoke/home-projects.mjs` `FOLDER` and `tests/smoke/github-sync-tools.mjs` `FOLDER`: `cbc`; `github-sync-tools` allows the suite's other tab's bookkeeping key (`SUITE`: rebar ↔ cbc share one page); `tests/smoke/project-library.mjs`: new `cbc` entry (frame `#suite-frame-capacity`).
- Loaded by: `tools.html` (home page) only.
- **How verified:** `node tests/engine/run.mjs project-registry github-sync projects`; `node tests/smoke/home-projects.mjs`; `node tests/smoke/home-sync.mjs` (all tools): pass.

## 2026-11-06 — PR: claude/cbc-stds-asd (PR #856: https://github.com/mlococo88/All-Structural/pull/856) (STDS) — entry for Concrete Beam Capacity, ASD tab   [storage only; no result change]
- New entry before `aci-rebar-development`: `{ tool: 'concrete-beam-asd', label: 'Concrete Beam ASD Rating', name: 'ASD Beam Rating (Concrete Beam Design Suite)', href: 'Concrete%20Beam%20Capacity.html#asd', key: 'asd_v1_projects', time: i => i && i.when || null, space: 2, toFile: i => i.data }` (the tool's own mapStore options and ctx.cloud).
- Tests: `tests/engine/project-registry.test.mjs`: a `{ when, data }` item for `concrete-beam-asd`; `home-projects.mjs` / `github-sync-tools.mjs` `FOLDER`: `asd`; `github-sync-tools` `SUITE` lists the three synced tabs of the suite page; `project-library.mjs`: new `asd` entry (frame `#suite-frame-asd`). Loaded by `tools.html` only.
- **How verified:** engine `project-registry github-sync projects`; `home-projects`; `home-sync` (all tools): pass.

## 2026-11-06 — PR: claude/pile-stds (STDS-P) — Pile Designer entry (`pile-designer`, read-only view over the tool's name mirror, sync: false)
- **What:** new `pileView(storage)` and `TOOLS.push({ tool: 'pile-designer', label: 'Pile Designer', name: 'Pile Designer', href: 'Pile%20Designer.html', key: 'micropile_lrfd_index_v1', view: pileView, sync: false, space: 2, toFile })` before `const all = () => TOOLS.slice();`.
- **Why a mirror, not async lists:** the projects are in IndexedDB `micropile_lrfd_db`. The home page must not open that database: opening it before the tool has created it would create it empty (version 1, no store), and the tool's upgrade would then never run. Pile Designer writes the names and times to the new key `micropile_lrfd_index_v1` after each change; the view reads it (newest record of each name, as the tool's sync). No async support was needed in github-sync.js or project-registry.js. `sync: false`: the home page lists Pile projects; "open the app to sync" (the file text needs the records).
- **Other entries:** unchanged.
- **How verified:** `node tests/engine/run.mjs project-registry`; `node tests/smoke/home-projects.mjs --tool pile,sbapp`.
