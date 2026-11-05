# Fix log — shared/project-registry.js (window.SharedProjectRegistry)

Loaded by: see `shared/README.md` (row `project-registry.js`). Tests: `node tests/engine/run.mjs project-registry` (Node) and
`node tests/smoke/home-projects.mjs` (browser: each tool's own Save, then the home page).

## 2026-11-05 — PR: claude/home-saved-projects (PR #818: https://github.com/mlococo88/All-Structural/pull/818) (HSP PR 1) — created (new file): where each tool keeps its saved-project list   [read only; no result change]
- **Why:** engineer request 2026-11-05: a "Saved projects" view on the home page (`tools.html`) across the apps. The home page cannot run a
  tool's code, so it needs to know, per tool, the list key and how the tool reads the saved time.
- **What:** one entry per tool with a saved-project list and GitHub sync (15 at 2026-11-05: the 14 of #811 and the Abutment Calculator, #815, whose own Projects dialog is newest first by `ts`): `tool` / `label` (the tool's `ctx.cloud`),
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
