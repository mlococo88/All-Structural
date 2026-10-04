# CLAUDE.md — Standing rules for this repository

This repo is a collection of single-file HTML structural/bridge engineering
tools. They are used by a licensed PE for real design work. **Accuracy and
stability matter more than code elegance.**

See `AUDIT.md` for the current inventory, known issues, and the work plan, and
`HANDOFF.md` for how tools pass data to each other.

## 1. Single-file, no-install architecture

- Every tool must stay a **single, self-contained HTML file**.
- No build step, no npm, no bundlers, no transpile step, no splitting into
  separate JS/CSS files, and no shared library files.
- Tools must run by **double-clicking** the file on a locked-down work laptop
  with no install rights (opened via `file://`).

## 2. External libraries

- External libraries are allowed **only via CDN `<script>`/`<link>` tags**
  (e.g., KaTeX, Plotly, Leaflet, proj4js, three.js).
- **Do not add new libraries without asking first.**
- Pin exact versions in CDN URLs when you touch a tag. Don't change a
  library version unless the task asks for it.

## 3. Duplicated code stays duplicated

- If code is duplicated across tools, **keep it duplicated**. Do not extract it
  into a shared file.
- When syncing a shared snippet, copy it into each file and **list in the PR
  description which tools contain it**.
- Known shared snippets: the `bridgeSuite.v1.*` bootstrap/handoff code at the
  top of `index.html`, `lldf.html`, `psbeam.html`, and `stgirder.html`, and the
  ACI rebar development-length app that is also embedded in
  `Concrete Beam Capacity.html`. See `AUDIT.md`.

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

## 7. Scope of changes

- **One tool per PR** unless the engineer says otherwise. Exception (approved 2026-10-04): a cross-tool connection (see `HANDOFF.md`) may change the sending and receiving tools in one PR.
- Keep diffs minimal and focused on the task. No drive-by reformatting,
  renaming, or reorganizing.
- Do not move, rename, or delete tool files unless asked. Other tools link to
  some of them by file name (`index.html`, `lldf.html`, `psbeam.html`,
  `stgirder.html`, `elastomeric_design_module.html`).

## 8. Fix log

- Every change to a tool is recorded in `fixlog/<tool file name without .html>.md`, in the same PR. See `fixlog/README.md` for the entry format.
- Each entry must contain enough to re-apply the fix by hand: the function, anchor text, the exact before/after code, the governing provision, and a check case.

## 9. When unsure, ask

- If a requirement, code provision, edition, or intended behavior is unclear,
  **ask instead of assuming**.
