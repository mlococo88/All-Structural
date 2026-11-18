# Fix log — apps/midas-model-inspector/ (MIDAS Civil NX API: Model Inspector)

A new folder app (engineer request 2026-11-17: "export the JSON from an existing MIDAS file rather than guessing … similar to
recording a macro in Excel"). Utility only: no engineering calculations, no formulas, factors or code references.

## 2026-11-17 — MI1: the app (new file)
### Where (new)
- `apps/midas-model-inspector/index.html`: one page; classic scripts; no libraries.
  - MIDAS API client: a copy of `js/midas-api.js` from mlococo88/MIDAS_Civil_NX_References, the same client inlined in
    `apps/midas-continuous-beam/index.html` (duplicated snippet, listed in the PR; candidate for `shared/` later).
  - `EP_GROUPS`: the `/db/` endpoints of the MIDAS API online manual, grouped as in the manual; `PRESETS` (basics, static loads,
    moving load, construction stage / PS).
  - `readMany`: GET up to 4 endpoints at a time; empty replies skipped; "client does not exist" → the not-connected message.
  - Results: reply as returned; "Copy as Assign" = the reply's records under `"Assign"` (the GET → Assign → PUT method in the MIDAS
    manual); `/info/db/<EP>` field descriptions; custom endpoint GET.
  - Snapshot → Compare: reads every catalogue endpoint before and after a manual change; per endpoint, records added / changed
    (JSON text differs) / removed; shows added + changed as one `{"Assign": …}` body (send with PUT), removed IDs listed, "before"
    values copyable.
  - Export: `POST /doc/EXPORT` and `/doc/EXPORTMXT` with `{ "Argument": "<folder>\\model_<date-time>.json|mct" }` (format per the
    MIDAS JSON manual); the file is written by Civil NX on its PC.
- Saved data (new keys): `midasInspector.selected.v1` (ticked endpoints), `midasInspector.exportDir.v1`; shares `midas.baseUrl`,
  `midas.mapiKey`, `midas.useProxy` with `apps/midas-continuous-beam/` (by design: one key per PC).
### How verified
- Headless Chrome against a mocked MIDAS server: Verify; Read (basics preset) shows only endpoints with data; custom `MLSR`; field
  info for the moving-load preset; snapshot (166 GETs) → model changed in the mock (node added, node moved, MLSR removed, MLSP added)
  → Compare shows exactly those three endpoints with +1 / 1 changed / −1; Export JSON posts `{"Argument":"C:\\MIDAS\\model_….json"}`;
  0 console errors. **Not yet run against a live Civil NX session.**
### Other copies
- `apps/model-inspector.html` in mlococo88/MIDAS_Civil_NX_References (same page; proxy note points to `tools/local_proxy.py`).
### Open items
- Live run; confirm whether `/info/db/<EP>` answers for every endpoint and which endpoints a given Civil NX build rejects.
