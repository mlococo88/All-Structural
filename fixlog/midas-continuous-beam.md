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

## 2026-11-17 — MCB2: I-shaped section instead of rectangular (engineer request)
### Where
- `apps/midas-continuous-beam/index.html`: the "Spans & section" card (now "Spans & I-section"), `DEFAULT_SPANS`, `SPAN_KEYS`,
  `migrateV1`, `loadInputs`, `renderSpans`, `depthAt`, new `iProps` and `showSectInfo`, `buildModel`, `buildRequests` (`/db/MATL`
  TYPE, `/db/SECT`), `drawElevation`; the Material card (new Type select, `MAT_DEFAULTS`); γ default; header title.
### Before / after
- **Span inputs.** Before: `{ L, b, hL, hM, hR, n }` (rectangle b × h, h parabolic). After: `{ L, DL, DM, DR, tw, bt, tt, bb, tb, n }`:
  web depth D (clear between flanges) parabolic through left / mid / right, `D(ξ) = DL(1−ξ)(1−2ξ) + DM·4ξ(1−ξ) + DR·ξ(2ξ−1)`; web
  t<sub>w</sub>, top flange b × t, bottom flange b × t constant within a span. Total depth H = D + t<sub>top</sub> + t<sub>bot</sub>.
- **Section properties (check solver and DC).** Before: `A = b·h`, `I = b·h³/12`. After (`iProps`, inches): three rectangles
  (bottom flange, web, top flange), `A = Σ Aᵢ`, `ȳ_bot = Σ(Aᵢ·yᵢ)/A`, `I = Σ(I₀ᵢ + Aᵢ·(yᵢ − ȳ)²)`; then ft² / ft⁴ (÷144, ÷20736).
  The smallest and largest section are worked on screen (`#sectInfo`).
- **Civil NX section.** Before: `SHAPE: 'SB'`, `vSIZE: [h, b]`. After: `SHAPE: 'H'`, `vSIZE: [H, B1, tw, tf1, B2, tf2, r1, r2]` =
  `[H, b_top, t_w, t_top, b_bot, t_bot, 0, 0]` in ft (parameter order per the MIDAS-RnD midas-civil Python library's DBUSER docs; B1 /
  tf1 taken as the top flange, as in the Civil NX dialog). Element axis at the section centroid (MIDAS default offset), shear
  deformation off.
- **Material.** Before: `TYPE: 'CONC'`, `ASTM(RC)` / `Grade C4000`, γ 0.150 kcf. After: Type select (Steel / Concrete); Steel default
  `ASTM(S)` (a Civil NX steel standard) / `A709-50` (grade name not confirmed), γ 0.490 kcf; Concrete keeps the old defaults. Switching the
  type swaps standard / grade / γ only where they are still at the other type's defaults.
- **DC.** Still γ·A as element uniform loads; A is now the I-section area (girder only: no deck, haunch or details allowance; stated in the tool).
- **Saved data.** New key `cbeam.inputs.v2`. If it is missing, `cbeam.inputs.v1` is read once and converted (`migrateV1`): L, elements,
  loads, factors, material names kept, type set to Concrete, web depth = old h − 1 − 1.25 in with the default plates (16 × 1 top,
  18 × 1.25 bottom, t<sub>w</sub> 0.5625). The v1 key is not changed or removed.
- **Default example.** 100 / 130 / 100 ft; D 54 in in the spans, 84 in over the interior supports; t<sub>w</sub> 0.5625; top 16 × 1;
  bottom 18 × 1.25; 16 / 20 / 16 elements.
### Check case
- D = 54, t<sub>w</sub> = 0.5625, top 16 × 1, bottom 18 × 1.25 (in):
  A = 22.5 + 30.375 + 16 = 68.875 in²; y = 0.625 / 28.25 / 55.75 in; ȳ_bot = (14.06 + 858.09 + 892.00) / 68.875 = 25.614 in;
  I₀ = 2.93 + 7381.13 + 1.33; A·d² = 22.5·24.989² + 30.375·2.636² + 16·30.136² = 14050 + 211 + 14531;
  I = 36177 in⁴ (`iProps` gives 68.875 / 25.614 / 36177.4). H = 56.25 in.
- Analysis (unchanged code): two equal 50 ft spans, w = 1 klf: −312.50 k-ft, 18.75 / 62.50 / 18.75 k (MCB1 check).
### How verified
- Headless Chrome: `iProps` value above; `/db/SECT` body for section 1 shows `SHAPE: "H"` and the 8-value vSIZE in ft; `/db/MATL` TYPE
  STEEL; mocked MIDAS run (tables built from the check solver) Δ = 0.00 % for all cases; v1 → v2 migration (spans converted, Concrete,
  γ and DW kept, v1 key still present); Type switch Steel → Concrete swaps standard / grade / γ; 0 console errors.
- **Still not run against a live Civil NX session:** confirm the H-section vSIZE order (B1 = top flange) by opening section 1 in Civil NX
  after a run, and the steel grade name.
### Other copies
- `apps/continuous-beam.html` in mlococo88/MIDAS_Civil_NX_References: updated the same way.
### Open items
- Composite section (deck), cover plates / flange transitions within a span, and web haunch shapes other than parabolic are not modelled.

## 2026-11-17 — MCB3: user-defined material by default; read-back check before analysis (engineer report)
Engineer's first live run stopped at `/doc/ANAL` with "failed to making analysis data: make Property". The most likely cause is the
material: the database grade name `A709-50` was a guess, and the DB request also lacked the `CODE` / `bELAST` keys MIDAS's example has.
### Where
- `apps/midas-continuous-beam/index.html`: Material card (new `matSrc` select, `matE`, `matNu`, rows `matUserRow` / `matDbRow`),
  `FIELDS`, `MAT_DEFAULTS` (E, ν, damping, α per type), `buildRequests` (`/db/MATL` body), init (type switch also swaps E / ν; row
  toggle), `runMidas` loop (response logging, `/doc/ANAL` error hint), new `checkModel`.
### Before / after
- **Material.** Before: always database, `{ TYPE, NAME, PARAM: [{ P_TYPE: 1, STANDARD, DB }] }`. After: source select, default
  **User-defined**: `{ TYPE: 'USER', NAME, HE_SPEC: 0, HE_COND: 0, PLMT: 0, P_NAME: '', bMASS_DENS: false, DAMP_RAT, PARAM: [{ P_TYPE: 2,
  ELAST: E·144 (ksi → ksf), POISN: ν, THERMAL: α, DEN: γ (kcf), MASS: γ/32.174 }] }` (format per MIDAS JSON manual, Material Properties,
  user-defined isotropic example). Defaults: steel E 29,000 ksi, ν 0.30, damping 0.02, α 6.5e-6; concrete E 3,605 ksi
  (57,000·√4000 psi), ν 0.20, damping 0.05, α 6.0e-6. Database source kept, now also sending `HE_SPEC … DAMP_RAT`, `CODE: ''`,
  `bELAST: false`.
- **Read-back check.** New: before `/doc/ANAL`, GET `/db/MATL`, `/db/SECT`, `/db/NODE`, `/db/ELEM` and stop with a clear message if any
  ID sent is not stored; logs the stored material 1 and section 1.
- **Errors.** `/doc/ANAL` failures add a hint (check Material / Section in Civil NX); POST/PUT responses mentioning error / fail /
  invalid / message are logged.
- E, ν, α, damping don't change the analysis results here (one material, linear static, no thermal loads); DEN/MASS are not used by
  the loads (DC is γ·A beam loads).
### Check case
- Steel default: ELAST = 29,000 × 144 = 4,176,000 ksf; DEN 0.49 kcf; MASS = 0.49 / 32.174 = 0.01523 kip·s²/ft⁴ (as sent, see below).
- Analysis results unchanged: mocked run Δ = 0.00 %; 2-span check case as MCB1.
### How verified
- Headless Chrome with a mock that stores POSTed DB data and answers GETs: full run passes the read-back and loads results; with the
  material dropped by the mock, the run stops before `/doc/ANAL` with "/db/MATL: 1 of 1 not stored". 0 console errors.
- **Not yet confirmed on live Civil NX** that `TYPE: 'USER'` is accepted (the manual's spec table writes "User", its example "USER").
### Other copies
- `apps/continuous-beam.html` in mlococo88/MIDAS_Civil_NX_References: updated the same way.

## 2026-11-17 — MCB4: connection check before building; plain message for "client does not exist" (engineer report)
Engineer's run: every `POST /doc/NEW` returned HTTP 404 `{"error":{"message":"client does not exist"}}`. The request reached the MIDAS
server from the browser (so direct browser calls work, no proxy needed), but no Civil NX session was connected under that MAPI-Key.
### Where
- `apps/midas-continuous-beam/index.html`: `runMidas` (verify first), its `catch`, `verify()` (status text and `catch`), new constant
  `NOT_CONNECTED_MSG` (above `checkModel`).
### Before / after
- Before: the run started with `/doc/NEW` and showed MIDAS's raw 404 text. After: the run first calls `/mapikey/verify`; if the key
  isn't verified or the status isn't "connected" it stops before sending anything, with `NOT_CONNECTED_MSG` (open a model, Apps > API
  Settings > Connect, wait for "Connected", copy the new key if it was refreshed, Verify). A "client does not exist" reply from any
  request, or a 4xx from Verify, shows the same message.
- No engineering content changed. **Saved data:** none.
### How verified
- Headless Chrome mocks: verify "disconnected" → stops after the verify call only, with the message; 404 "client does not exist" on
  every call → same message + MIDAS's text; Verify button 404 → same message; normal connected run → results loaded (Δ 0.00 %);
  0 console errors.
### Other copies
- `apps/continuous-beam.html` in mlococo88/MIDAS_Civil_NX_References: updated the same way.

## 2026-11-17 — MCB5: sections sent with the full DB/User key set, by PUT (engineer report)
Engineer's run (connected, user-defined material stored): the read-back check stopped with "/db/SECT: 17 of 17 not stored"; material,
nodes and elements were stored. So Civil NX dropped every section without an error. This probably also caused the first live
failure ("make Property"), which happened with the rectangular SB section.
### Where
- `apps/midas-continuous-beam/index.html`: `buildRequests` (`/db/SECT` body and method); `runMidas` loop (always logs the `/db/SECT`
  and `/db/MATL` responses).
### Before / after
- Before: `POST /db/SECT`, `SECT_BEFORE: { USE_SHEAR_DEFORM: false, SHAPE: 'H', DATATYPE: 2, SECT_I: { vSIZE } }`, name
  `I55.37-W53.12x0.5625-…`.
- After: `PUT /db/SECT`; `SECT_BEFORE` adds `OFFSET_PT: 'CC'`, `OFFSET_CENTER: 0`, `USER_OFFSET_REF: 0`, `HORZ_OFFSET_OPT: 0`,
  `USERDEF_OFFSET_YI/YJ: 0`, `VERT_OFFSET_OPT: 0`, `USERDEF_OFFSET_ZI/ZJ: 0`, `USE_WARPING_EFFECT: false`; name `GIRDER_<id>`. This is the key
  set and method MIDAS's own midas-civil Python library (v1.8.0, `_SS_DBUSER.toJSON`, `Offset.JS`, `Section.create` → `PUT /db/SECT`)
  uses, and matches the manual's "Section Properties - Common" examples (OFFSET_PT, HORZ/VERT_OFFSET_OPT, USE_WARPING_EFFECT).
- vSIZE values, units and order are unchanged; offset at the centroid = the element axis the check solver assumes. No engineering
  content changed. **Saved data:** none.
### How verified
- Headless Chrome mocked run: results loaded, Δ 0.00 %; 0 console errors. **Needs a live re-run** to confirm Civil NX now stores the
  sections; if not, the log now shows MIDAS's reply to `/db/SECT`.
### Other copies
- `apps/continuous-beam.html` in mlococo88/MIDAS_Civil_NX_References: updated the same way.

## 2026-11-17 — MCB6: HL-93 moving load replaces the uniform static LL (engineer request)
Engineer confirmed the MCB5 build ran end to end in Civil NX ("That worked"), then asked for the moving-load analysis.
### Where
- `apps/midas-continuous-beam/index.html`: Loads card (LL klf input `wLL` removed; new `dfM`, `dfV`, `imPct`, `mpf`, `dualTruck`;
  note text), `CASES` (LL → LL+IM), `FIELDS` (+ `fieldVal` / `setFieldVal` for the checkbox), `loadVals`, the whole check-solver
  block (`ke`, `feqUniform`, new `feqPoint`, `makeSolver` (LU once), `solveState`, `outPoints`, `staticCase`, `HL93`, `hl93Envelope`,
  `combine`, `runLocal`), `buildRequests` (+ `RESULT_LOADS`, `REACT_LOADS`), `runMidas` table collection, `checkModel` list,
  `parseMidas`, `autoSign`, new `midasView`, `draw`, `drawSummary`, `downloadCsv`.
### Before / after (§4 callout)
- **Live load.** Before: static uniform `LL` = 0.64 klf on all spans (a user input), in STR-I/SER-I. After: HL-93 moving load,
  AASHTO LRFD 9th Ed. 3.6.1.2: design truck 8/32/32 kips, 14 ft, rear spacing 14–30 ft (3.6.1.2.2); design tandem 25/25 kips at
  4 ft (3.6.1.2.3); design lane 0.64 klf (3.6.1.2.4); truck and tandem each with lane, taken separately (3.6.1.3.1); IM 33% on
  truck/tandem only (3.6.2.1, Table 3.6.2.1-1); × distribution factor (moment DF for M; shear DF for V and reactions) × m (default
  1.0, 3.6.1.1.2: m not applied with approximate DFs). 90% two trucks (≥50 ft headway) + 90% lane for negative moment between
  contraflexure points and interior reactions (3.6.1.3.1): check solver only, optional, because Civil NX needs Lane Supports
  (`/db/MLSP`, format not yet known) — stated in the tool.
- **Combinations.** Before: STR-I = 1.25 DC + 1.50 DW + 1.75 LL (static), SER-I = 1.0 each. After: same factors on LL+IM, as
  envelopes: max = static + f·LL_max, min = static + f·LL_min; in Civil NX STR-I-M / STR-I-V / SER-I-M / SER-I-V (moving case LLM or LLV
  with ANAL "MV"). No minimum (0.90 / 0.65) DC/DW factors — stated in the tool.
- **Civil NX requests (new, all PUT):** `/db/MVCD` {CODE "AASHTO LRFD"}; `/db/LLAN` LANE1 on all elements (ECC 0, WHEEL_SPACE 6 ft,
  WIDTH 10 ft, SPAN_START on the first element of each span); `/db/MVHL` HL-93TRK and HL-93TDM (MVLD_CODE 2, STANDARD_CODE
  "AASHTO-LRFD", DYN_LOAD_ALLOWANCE = IM %); `/db/MVLD` LLM and LLV (TYPE 0, SCALE_FACTORS [m, 1, 0.85, 0.65, 0.65, 0.65],
  INDEPENDENT, one lane, vehicle SCALE_FACTOR = DF); `/db/MVCT` (EXACT, POINT "INF", 3 points per element, reactions /
  displacements / forces on). Formats from the MIDAS JSON manual (Vehicles – AASHTO LRFD, Moving Load Cases, Moving Load Analysis
  Control) and the midas-civil library (MVCD, LLAN). Results read one load name per `/post/TABLE` request (14 beam-force, 8 reaction).
- **Check solver.** Influence lines from unit loads at every output point (5 per element), resampled on a 0.5 ft grid; axle groups
  moved over the grid in both directions; rear spacing in 2 ft steps; lane load on the adverse parts (trapezoid rule).
- **Saved data:** `cbeam.inputs.v2` gains `dfM`, `dfV`, `imPct`, `mpf`, `dualTruck`; an old `wLL` value is ignored (left in place).
### Check cases (check solver; DF = m = 1)
- Single 100 ft span, IM 33%: truck M = 72(50 − 2.333)²/100 − 8·14 = 1523.9 k-ft; lane 0.64·100²/8 = 800; LL+IM = 1.33·1523.9 + 800 =
  2826.8 hand → 2824.8 app (max over output points 1.25 ft apart; truck peak at 47.67 ft). End shear: truck 32 + 32·0.86 + 8·0.72 =
  65.28, lane 32 → 1.33·65.28 + 32 = 118.82 hand = 118.82 app.
- Two equal 100 ft spans, IM 0: pier M (truck/tandem + lane) −1466.4 k-ft (lane part −0.64·100²/8 = −800); interior reaction 151.1 k;
  with the 90% two-truck option −1918.3 k-ft and 174.8 k.
### How verified
- The two checks above in headless Chrome. Full mocked Civil NX round trip (DB data stored/read back, 22 tables answered from the check
  solver with the moment sign reversed): all requests sent, sign flip detected with max/min swapped, Δ = 0.00 % in every case and
  reaction; 0 console errors. `tests/check-syntax.mjs` passes.
- **Needs a live run:** that Civil NX accepts the vehicle names HL-93TRK / HL-93TDM, MVCT POINT "INF", ANAL "MV" in LCOM-GEN; and how
  close its moving-load envelope is to the check (HL-93TRK is assumed to include the lane load, as the Civil NX HL-93 vehicles do).
### Open items
- Lane Supports (`/db/MLSP`, `/db/MLSR`) for the 90% two-truck case in Civil NX; fatigue truck; pedestrian load.
