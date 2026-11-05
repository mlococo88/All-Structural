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

## 2026-11-05 — PR: claude/home-sync-all (HSP PR 2) — file text and sync engine per tool, for the home page's GitHub status and Sync all   [storage only; no result change]
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
