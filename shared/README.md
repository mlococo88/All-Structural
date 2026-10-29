# shared/ — code used by more than one tool

Plan: `docs/REBUILD_PLAN.md` (§3). Rules: `CLAUDE.md` §1, §3, §7, §8.

## Conventions

- **Classic scripts.** Each file is loaded with a plain
  `<script src="shared/name.js"></script>` (or `../../shared/name.js` from
  `apps/<tool>/`). No `type="module"`, no `import`/`export`: browsers block
  modules from `file://`. Relative paths only.
- **One global namespace per file.** A file wraps its code in an IIFE and
  exposes exactly one object, e.g. `window.SharedMovingLoad`,
  `window.SharedVehicles`. No loose globals. If a file depends on another,
  it reads that namespace at call time and the page loads the dependency
  first.
- **No DOM access in engine files.** Engine files take plain inputs and return
  plain objects: no `document`, no `localStorage`, no reading form fields, no
  drawing. This keeps them runnable in Node (`tests/engine/`).
- **Data in `.js` files.** Tables (vehicles, shapes, …) are JavaScript objects
  in `.js` files, never `.json` loaded by `fetch`/XHR (blocked from `file://`).
- **Units** are stated in each function's header comment.

## Changing a shared file

- §4 change control applies: a pure refactor must not change any result;
  a calculation change needs before/after, the code section with edition, and
  a check case.
- Run `node tests/engine/run.mjs` and the tests of every tool that loads the
  file; list those tools in the PR.
- Log the change in `fixlog/shared-<name>.md` (e.g. `fixlog/shared-moving-load.md`).

## Files and the tools that load them

| File | Namespace | Loaded by |
|---|---|---|
| `vehicles.js` | `window.SharedVehicles` | `Moving Load Generator.html` |
| `moving-load.js` | `window.SharedMovingLoad` | `Moving Load Generator.html` |
