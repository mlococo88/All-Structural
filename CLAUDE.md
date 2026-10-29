# CLAUDE.md — Standing rules for this repository

This repo is a collection of HTML structural/bridge engineering tools. They are used by a licensed PE for real design work. **Accuracy and
stability matter more than code elegance.**

See `AUDIT.md` for the current inventory, known issues, and the work plan, and
`HANDOFF.md` for how tools pass data to each other.

## 1. No-install architecture (single-file rule removed by the engineer, 2026-10-29)

- A tool may be one HTML file or a folder of plain HTML/JS/CSS files
  (`apps/<tool>/`), and tools may load shared files from `shared/`. Split or
  share code where it makes tools cheaper to change and test; small or stable
  tools can stay single files.
- No build step, no npm, no bundlers, no transpile step: the files in the repo
  are what runs.
- Tools must still run by **double-clicking** on a locked-down work laptop with
  no install rights (opened via `file://`, from a copy of the whole repo
  folder). Because of `file://`:
  - load code with classic `<script src="relative/path.js">` tags: no
    JavaScript modules (`type="module"`/`import`), which browsers block from
    `file://`;
  - no `fetch`/XHR of local files: put data (tables, shapes, vehicles) in
    `.js` files;
  - use relative paths only.
- Shared files use one global namespace per file (e.g. `window.SharedUnits`),
  never loose globals.

## 2. External libraries

- External libraries are allowed **only via CDN `<script>`/`<link>` tags**
  (e.g., KaTeX, Plotly, Leaflet, proj4js, three.js).
- **Do not add new libraries without asking first.**
- Pin exact versions in CDN URLs when you touch a tag. Don't change a
  library version unless the task asks for it.

## 3. Shared code

- Logic used by more than one tool belongs once in `shared/`, tested in Node
  where it is calculation code (`tests/`).
- A PR that changes a shared file runs the tests of **every tool that loads
  it** and **lists those tools in the PR description**. A shared file's
  computed results fall under §4 like any tool's.
- Moving existing duplicated code into `shared/` is planned work (see the
  rebuild plan), not a drive-by change. Until a snippet is moved, keep its
  copies in step and list in the PR which tools contain it.
- Known duplicated snippets not yet moved: the `bridgeSuite.v1.*` bootstrap/handoff code at the
  top of `index.html`, `lldf.html` and `Prestressed Bridge Design.html`
  (`psbeam.html` until 2026-10-22), and the
  ACI rebar development-length app that is also embedded in
  `Concrete Beam Capacity.html`. See `AUDIT.md`.
- ST-Girder lives only inside `Steel Bridge Design.html` (GirderDetail, renamed
  from `Steel Bridge Beam Modules.html`) as the `st-src` block; `stgirder.html`
  was deleted at the cut-over (2026-10-22, #422). Edit ST-Girder in `st-src`
  (escaped as `pl-src`; `tests/check-syntax.mjs` checks it).

## 4. Engineering calculations: change control

- **Never** change engineering formulas, load factors, resistance factors,
  units, unit conversions, or code references (spec, edition, article,
  equation, table) without calling it out explicitly in the PR description.
  Each callout needs:
  - the **before and after** values or expressions,
  - the **governing code section**, with its edition (e.g., AASHTO LRFD 9th
    Ed. Art. 5.7.3.3), and
  - a **worked check case** the engineer can verify by hand: inputs,
    intermediate values, and the final result, before and after.
- A pure refactor must not change any computed result. If you claim one
  doesn't, say how you checked.
- Don't fix calculation issues "while you're in there". Raise them and ask.

## 5. Saved data is sacred

- **Do not change existing localStorage / sessionStorage / IndexedDB keys or
  saved-data formats** (including JSON project export/import formats and the
  `bridgeSuite.v1.*` cross-tool handoff keys).
- If a change is unavoidable, include a **migration** that reads the old key or
  format, converts it, and preserves the existing user data. Never silently
  discard it.
- Note: in Chromium-based browsers (Chrome/Edge), every page opened from
  `file://` shares **one** localStorage origin. Every tool sees every other
  tool's keys, so new keys must be prefixed per tool and must never be generic
  (no `activeTab`, `settings`, etc.).

## 6. UI and behavior

- Preserve each tool's existing UI layout and behavior unless the task
  specifically asks to change it.
- Show the work and link to it (engineer's guideline, 2026-10-14): every
  computed value is worked somewhere in the tool (equation symbolically →
  values substituted → result). Wherever a value is used or quoted away from
  where it is worked (another tab, module or report section), link to that
  derivation: an in-app link to the tab, module or card on screen, and a
  "see §x.y" reference in the printed calculation report.

## 7. Scope of changes

- **One tool per PR** unless the engineer says otherwise. Exceptions: a cross-tool connection (see `HANDOFF.md`, approved 2026-10-04) may change the sending and receiving tools in one PR; a change to a shared file may include the tools that load it (2026-10-29).
- Keep diffs minimal and focused on the task. No drive-by reformatting,
  renaming, or reorganizing.
- Do not move, rename, or delete tool files unless asked. When a tool moves
  into `apps/<tool>/`, its old file name stays as a small redirect page.
  Other tools link to
  some of them by file name (`index.html`, `lldf.html`, `psbeam.html`,
  `elastomeric_design_module.html`, `Steel Bridge Design.html`;
  `Steel Bridge Beam Modules.html` is kept as a redirect page to it;
  `Prestressed Bridge Design.html`, with `psbeam.html` kept as a redirect page
  to it).

## 8. Fix log

- Every change to a tool is recorded in `fixlog/<tool file name without .html>.md` (for a folder tool, `fixlog/<folder name>.md`; for a shared file, `fixlog/shared-<file name without .js>.md`), in the same PR. See `fixlog/README.md` for the entry format.
- Each entry must contain enough to re-apply the fix by hand: the function, anchor text, the exact before/after code, the governing provision, and a check case.

## 9. When unsure, ask

- If a requirement, code provision, edition, or intended behavior is unclear,
  **ask instead of assuming**.
