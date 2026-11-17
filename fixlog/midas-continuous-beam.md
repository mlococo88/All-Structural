# Fix log — apps/midas-continuous-beam/ (MIDAS Civil NX API: Continuous Beam demo)

A new folder app (engineer request 2026-11-17): the first tool that drives MIDAS Civil NX through its Open API (REST + JSON through
MIDAS's server to the running program). Reference notes for the API (endpoints, request formats, result tables, firewall allowlist) live
in the separate repository mlococo88/MIDAS_Civil_NX_References (`docs/`, `js/midas-api.js`).

Labelling: "DEMO — NOT FOR DESIGN USE" in the header and on the tools.html card.

## 2026-11-17 — MCB1: the app (new files)
### Where (all new)
- `apps/midas-continuous-beam/index.html`: one page. Inputs: connection (Base URL, MAPI-Key, "Use local proxy"), spans (L ft; b, h left,
  h mid, h right in; elements per span), loads (γ kcf, DW klf, LL klf, STR-I factors), material (Civil NX database standard and grade
  names), run options. Outputs: elevation, shear and moment diagrams (MIDAS solid, check solver dashed) per case, summary table with Δ %,
  reactions, CSV download of the MIDAS beam-force table, request log, JSON preview of every API request.
- `apps/midas-continuous-beam/local_proxy.py`: standard-library relay on 127.0.0.1:8765 that forwards only to `https://*.midasit.com`;
  used only if the browser blocks direct calls to the MIDAS API server (CORS, not yet confirmed either way).
- Plotly 2.35.2 from cdn.plot.ly (pinned; Plotly is already used in the suite, e.g. plotly-basic 2.27.0 in `Shear and Moment Diagrams.html`).

### What the app does (stated in the tool)
- Depth in each span: quadratic through h left / h mid / h right, `h(ξ) = hL(1−ξ)(1−2ξ) + hM·4ξ(1−ξ) + hR·ξ(2ξ−1)`. Each element is
  prismatic at the depth of its midpoint (stepped approximation); sections are de-duplicated by (b, h).
- Civil NX requests, in order: `/doc/NEW` (optional, confirmed by the user), `PUT /db/UNIT` (FT, KIPS), `/db/MATL` (database concrete),
  `/db/SECT` (DBUSER, shape SB, `vSIZE [H, B]` in ft, shear deformation off), `/db/NODE`, `/db/ELEM`, `/db/CONS` (first support
  `1111000`, others `0111000`, as MIDAS's Simple_Beam sample), `/db/STLD` (DC, DW, LL), `/db/BMLD` (uniform GZ loads),
  `/db/LCOM-GEN` (STR-I = 1.25 DC + 1.50 DW + 1.75 LL by default, SER-I = 1.0 each), `/doc/ANAL`, `/post/TABLE` BEAMFORCE
  (Shear-z, Moment-y) and REACTIONG.
- DC is applied as element uniform loads γ·A (not MIDAS self-weight), so MIDAS and the check solver use the same weight. DW and LL are
  uniform on all spans; there's no pattern loading.
- Check solver: 2D Euler–Bernoulli direct stiffness on the same stepped elements (E cancels with one material), vertical restraint at
  supports; internal V = V1 + w·x, M = −M1 + V1·x + w·x²/2 (sagging +, shear + = left side up). MIDAS signs are compared with it
  (DC case) and flipped for plotting if opposite; the flip is shown and can be unticked.
- The STR-I factors are user inputs labelled "STR-I"; the tool doesn't cite or check them against AASHTO, and it does no design checks.

### Check case
- Two equal spans 50 ft, prismatic, w = 1 klf down, 10 elements per span: interior-support M = −312.50 k-ft (−wL²/8 = −312.5),
  reactions 18.75 / 62.50 / 18.75 k (3/8, 10/8, 3/8 · wL), max +M 175.78 k-ft (9/128 · wL² = 175.78). Matches.
- Default haunched 3-span (60/80/60 ft, b = 36 in, h 30 → 48 in over interior supports), γ = 0.150 kcf: DC total 256.33 k = ΣR.

### How verified
- Check solver run in Node against the case above (exact to 1e-12).
- Headless Chrome with a mocked MIDAS server (responses built from the check solver, moment sign reversed, parts labelled I[n] / 1/4 /
  2/4 / 3/4 / J[n]): full request sequence sent, tables parsed, moment sign flip detected, summary Δ = 0.00 %, 0 console errors.
- **Not yet run against a live Civil NX session.** To confirm on the first real run: browser CORS (else use the proxy), the material
  names (`ASTM(RC)` / `Grade C4000`; MIDAS's own sample uses `AS17(RC)` / `C32`), the BEAMFORCE part labels and column names.

### Other copies
- `apps/continuous-beam.html` in mlococo88/MIDAS_Civil_NX_References (same app; that copy points to `tools/local_proxy.py`).

### Open items
- Pattern live loading, moving loads (`/db/MVLD` etc.), steel/composite sections and a calculation report are not included.
