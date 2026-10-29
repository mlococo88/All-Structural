# Fix log — apps/steel-bridge/ (Steel Bridge Design, rebuild)

The rebuild of `Steel Bridge Design.html` (docs/REBUILD_PLAN.md §5, Phase 3). Folder: `apps/steel-bridge/`
(`index.html`, `engine/*.js`). Loads `../../shared/units.js` and `../../shared/steps.js`.
Tests: `node tests/engine/run.mjs sections model`. The old `Steel Bridge Design.html` is unchanged and stays in use.

## 2026-10-29 — PR: sbd2-model-sections — folder, project model v1, section properties (new files)
### Where
- `apps/steel-bridge/index.html` (new): the shell in the Base Plate layout (header; input panel and output panel, each
  scrolling on its own; tabs; stacked below 900 px). Input tabs Project, Spans, Materials & deck, Girders & plates
  (plate segments editable). Output tab Section properties: the card for the selected girder and segment, positive or
  negative flexure, with every value linked (§) to its worked step. Results are marked out of date when an input
  changes and recalculated with Calculate (plan §5). Plain HTML/JS, classic scripts, no library.
- `engine/model.js` (new, `window.SBDModel`): project schema `sbd2.project` version 1 (project info; spans,
  continuous or simple; steel grades per top flange / bottom flange / web, E_s; concrete f′c, w_c, K1, n rule;
  rebar F_yr; deck: composite, t_s, total thickness, haunch, two rebar layers, rebar-in-positive-M_p option;
  girders with b_eff and plate segments x0–x1). `validate`, `migrate` (no steps yet), `exportJSON`/`importJSON`,
  `save`/`load` (storage passed in). `importLegacy` is a stub: old GirderDetail / Preliminary sizing / ST-Girder
  files are recognised and answered "comes in a later version"; nothing is changed.
- `engine/sections.js` (new, `window.SBDSections`): ported from `Steel Bridge Design.html`, GirderDetail Girder
  section module (anchor `GM.gs = {`, `compute(p, opt)`, the lines from `const pos = r.region === 'pos', s = steelProps(r.D, r)`
  to `r.Dp = r.Dt - yp`) and the functions it calls: `steelProps`, `addPart`, `modRatio`, `plasticNA`, `d61pos`,
  `d61neg`, `rhFactor`. Arithmetic copied operation for operation; the TeX fields (`leadTex`, `lt`, `rt` text) are
  replaced by the steps. New functions: `steel`, `composite(…, n, k)` (k = 1 or 3), `withRebar`, `plastic`,
  `dc`, `hybrid`, `card` (all of them with worked steps), `modularRatio`.
### Saved data (CLAUDE.md §5)
- New keys only: `sbd2.project.current` (autosaved project), `sbd2.project.unreadable.<ISO time>` (a saved project
  that could not be read is copied here before anything else happens; if that copy fails, autosave stays off), `sbd2.ui`
  (the page's tab, girder, segment and region choices). No existing key is read or written. Export file: `<name>.sbd2.json`.
### Governing provisions (AASHTO LRFD 10th Ed. (2024); all as GirderDetail has them, none changed)
- E_c = 120,000 K1 w_c² f′c^0.33, Eq. 5.4.2.4-1; n = E_s/E_c, Art. 6.10.1.1.1b (exact, or rounded as GirderDetail's option).
- Steel section 6.10.1.1.1a; short-term n and long-term 3n composite 6.10.1.1.1b (slab b_eff t_s/(kn) at d + haunch + t_s/2,
  haunch concrete not counted); steel + longitudinal reinforcement 6.10.1.1.1c.
- Plastic moment App. D6.1, Tables D6.1-1 (positive) and D6.1-2 (negative); D_cp D6.3.2; D_c D6.3.1 (on one section);
  D_t, D_p 6.10.7.1.2; R_h 6.10.1.10.1 (Eqs. -1, -2).
### Check case
- Hand check 1, doubly symmetric steel I, 16 × 1 flanges, 60 × 1/2 web, F_y 50: A 62 in², ȳ 31.000 in, I 38,770.667 in⁴,
  S 1250.667 in³; M_p (Table D6.1-2, no rebar, Case I) 71,300 kip-in = 5941.667 kip-ft (= 50 Z, Z = 1426 in³), D_cp 30 in.
- Hand check 2, same steel, b_eff 96, t_s 8, haunch 2 in, n = 8: A 158 in², ȳ 53.481 in, I 90,854.11 in⁴, S top/bottom of
  steel 10,664.8 / 1698.8 in³; 3n: A 94 in², ȳ 43.596 in, I 67,835.97 in⁴; M_p (f′c 4, Table D6.1-1 Case II) 9307.7 kip-ft,
  Ȳ 0.3055 in, y_p 61.6945 in, D_p 10.3055 in, D_t 72 in. Arithmetic in `tests/engine/sections.test.mjs`.
- Before: none (new app). GirderDetail's own values for the same inputs are identical (parity, below).
### How verified
- Parity (`tests/engine/sections.test.mjs`): GirderDetail's `GM.gs.compute` taken from the page text and run in a Node vm
  (`tests/engine/gd-source.mjs`), against this engine, on every zone of the 100 `tests/projects/st/gd_*.json` payloads
  (positive and negative flexure, deck rebar excluded from and included in the positive M_p) and GirderDetail's
  built-in Girder section rows (as is, HPS70W flanges on a 50W web, n rounded): 204 module inputs, 3,608 rows,
  171,380 values: all identical (largest difference 0). A, ȳ, I, S top/bottom of s, 3n, n, steel + rebar; d, D_t,
  slab and rebar heights; M_p, y_p, D6.1 case, Ȳ, D_cp, D_p, the bisection cross-check, plastic forces; D_c; R_h.
- Payload mapping: the payload's deck A_r "at deck mid-depth" is one layer at c = t_s/2; n of the payload (6.315) equals
  `modularRatio(f′c, w_c, 1, 'exact')` within its 4-decimal rounding.
- One headless browser load of `apps/steel-bridge/index.html`: 0 console errors; edit, Calculate and region switch work;
  only `sbd2.*` keys written; no horizontal scroll at 800 px.
### Other copies
- None. The functions remain in `Steel Bridge Design.html` (unchanged) until the switch-over (plan Phase 4).
### Open items
- SB2-O1. Positive-flexure plastic moment without a deck (a noncomposite girder, `deck.composite = false`): GirderDetail
  never computes it; this engine finds the PNA by force equilibrium (bisection) and D_cp = t_b + D − y_p. New behaviour,
  for the engineer to confirm before any noncomposite design check uses it.
- SB2-O2. Owner rules not in the model yet: GirderDetail's OWN8 (haunch taken as 0 in composite properties, `gdHP`) and
  the other owner load rules. To be added with the loads PR; until then the haunch is always counted as entered.
- SB2-O3. GirderDetail's detail modules (shear connectors, welds, fatigue, …) use `secSet` with ONE rebar layer A_r at
  depth d_r, while the Girder section module (ported here) uses two layers. The model keeps two layers (one layer = set
  the other area to 0). Confirm this is the representation wanted for every module.
- SB2-O4. Equation notation: a small TeX subset rendered by `shared/steps.js` without a library. KaTeX (already used in
  the old app) could render the same strings; adding it to the new app needs the engineer's OK (CLAUDE.md §2).
- SB2-O5. D_c in positive flexure for composite sections (D6.3.1: from the stresses of the combined loads) depends on
  the loads, so it is not in the section card; it comes with the flexure module.

## 2026-10-29 — PR: sbd2-flexure — girder flexure, Strength I and Service II (new files)
### Where
- `engine/flexure.js` (new, `window.SBDFlexure`): ported from `Steel Bridge Design.html`, GirderDetail Girder section module
  (anchor `GM.gs = {`): the flexure part of `compute(p, opt)` (from `const secs = pos ?` to the Fatigue I ranges `r.dfT`, `r.dfB`;
  shear, constructibility and the fatigue limit state left out) and of `checks(R)` (GS5–GS10, GS12, GS13, GS19), with `rbFactor`,
  `ltbFnc`, `ampFl`, `fcrw`, `gsGov`; from Preliminary sizing's row builder (`detailExport`, `gsRow`, Strength I part) the per-location
  L_b, C_b and nonprismatic data: `feAt`, `feCb`, `feNpr`, `feGe`, `feGeA`, `feGov`, `stP`, `crk`, `fBotN`, `rbN`, `govRec`, `geRec`.
  Arithmetic copied operation for operation. New: `location(loc, prj)` returns every check as { id, value (demand), capacity, ratio,
  ok, inUse, ref (10th Ed.), step } plus the worked steps (lazy); `girder(locs, prj, { supports })` (PNA-OOS per span; governing
  ratio); `envelopeStrI` (GirderDetail `saComb`, Strength I, AASHTO base); `bracing(x, env, opt)`; `fromPayload(payload)` (the
  stations GirderDetail's Check at any location checks, from a `stgirder-external-demands` hand-off, as ST-Girder read it).
  Demands: unfactored per load and stage (normal case) or factored (`loc.factored = { str, svc, fat }`).
- `ui/flexure.js` (new, `window.SBDFlexureUI`): the Flexure output tab: demand source (example = GirderDetail's built-in moments on the
  project girder, or a hand-off file), L_b, C_b, f_ℓ, skew, negative-flexure method; per-location table (governing check and ratio,
  coloured, governing location marked), the checks of the selected location with § links, its worked steps.
- `index.html`: two script tags, the Flexure tab button, tab switching (`ui.otab`, in the existing `sbd2.ui` key) and one dispatch
  line in `drawOut`.
### Saved data (CLAUDE.md §5)
- No new key. `sbd2.ui` gains the field `otab` (the open output tab; absent = Section properties). The project schema is unchanged;
  the Flexure tab's choices and loaded demands are not saved.
### Governing provisions (AASHTO LRFD 10th Ed. (2024); all as GirderDetail has them, none changed)
- Load factors Tables 3.4.1-1, -2 (γ_p max/min by the sign of each moment; utilities UT with the DW factors, UF γ_DC/0); Strength I,
  Service II 1.30, Fatigue I 1.75. φ_f = 1.0.
- Positive flexure: compactness 6.10.6.2.2; D_p ≤ 0.42D_t 6.10.7.3; M_n 6.10.7.1.2 (Eqs. -1, -2, -3: 1.3R_hM_y for continuous spans);
  M_u + f_ℓS_xt/3 ≤ φ_fM_n Eq. 6.10.7.1.1-2; noncompact Eqs. 6.10.7.2.1-1, -2 (R_b = 1); M_y D6.2.2.
- Negative flexure 6.10.8: F_nc FLB 6.10.8.2.2, LTB 6.10.8.2.3 (Eqs. a-1 to a-5, b-1 to b-3, c-1 to c-3, App. D6.6.2 Method A for γ_e),
  R_b 6.10.1.10.2, f_ℓ amplification 6.10.1.6, tension flange 6.10.8.3; M_y D6.2.3.
- Appendix A6 where 6.10.6.2.3 permits it (S2-9): skew ≤ 20°, straight, F_y ≤ 70, 2D_c/t_w < λ_rw = c_rw√(E/F_yc), I_yc/I_yt ≥ 0.3,
  prismatic L_b; A6.1 to A6.4.
- Service II 6.10.4.2.2 (Eqs. -1, -2, -4), D_c from the Service II stresses D6.3.1 (this is SB2-O5: D_c of composite sections in
  positive flexure, from the loads), F_crw 6.10.1.9.1 (k = 7.2 with both web edges in compression). f_ℓ ≤ 0.6F_yf Eq. 6.10.1.6-1.
### Check case
- Built-in Pier 1 (18 × 1.5 / 60 × 9/16 / 18 × 2, F_y 50, rebar 6.6 + 3.2 in², L_b 20 ft, C_b 1): M_u = −8057.5 kip-ft; steel + rebar
  ȳ = 3494.05/106.55 = 32.7926 in, D_c = 30.7926 in, R_b = 1; F_nc,FLB = 50; r_t = 4.8237 in, L_p = 127.79, L_r = 436.19, L_b = 240 in,
  F_nc,LTB = [1 − 0.3(240 − 127.79)/(436.19 − 127.79)]50 = 44.542 ksi.
- Built-in Span 1 (16 × 3/4 / 60 × 9/16 / 16 × 1 1/8, b_eff 114, t_s 8, haunch 2): Case II, Ȳ = 0.054188 in, D_cp = 0, compact;
  D_p = 10.0542 in, D_t = 71.875, M_n = 0.97208M_p; M_u = 5322.5 kip-ft. Arithmetic in `tests/engine/flexure.test.mjs`.
- Before: none (new app). GirderDetail's values for the same inputs are identical (parity, below).
### How verified
- `tests/engine/flexure.test.mjs`: GirderDetail's `GM.gs.compute` and `GM.gs.checks` (vm, `gd-source.mjs`, AASHTO base, P.df.bridge.skews
  of the payload) on the same rows as this engine: every station Check at any location checks on the 100 `gd_*.json` payloads
  (demands from the payload stations), the five AASHTO G1 payloads again with f_ℓ = 7.5 ksi, and GirderDetail's built-in rows (as is,
  f_ℓ, HPS70W hybrid, 6.10.8 only, 28° skew, nonprismatic simp / ge bound / ge Method A with a governing section): 113 cases,
  38,971 locations, 2,128,487 values and check items: all identical (largest difference 0). bracing() with Preliminary sizing's own
  fe* functions: identical on 3,710 locations (972 'ge', 320 'simp'). A6 permission: builtin28 (28°) not permitted at any negative
  location, with the skew reason; builtin (15°) never the skew reason; the stored hand-off's A6 values (skew, c_rw, λ_rw, 2D_c/t_w,
  I_yc/I_yt, reasons) agree at its governing stations (AASHTO payloads).
- One headless load of `apps/steel-bridge/index.html`: Flexure tab with the example and with a hand-off file (371 stations); 0 console
  errors; no horizontal scroll at 800 px; only `sbd2.ui` written.
### Other copies
- None. The functions remain in `Steel Bridge Design.html` (unchanged).
### Open items
- SB2-O6. R_b (6.10.1.10.2) and A6.2.2 use λ_rw = 5.7√(E/F_yc), as GirderDetail; the A6 permission (S2-9) uses c_rw√(E/F_yc).
  Kept as GirderDetail; for the engineer to decide (no change made).
- SB2-O7. Noncomposite girders (no deck, or noncomposite in positive flexure: 6.10.8 and App. A6 in positive regions with the
  noncomposite M_p of SB2-O1, approved 2026-10-29) are not in this PR: the next flexure PR. The tab says so for `deck.composite = false`.
- SB2-O8. The hand-off payload's deck rebar (`deck.Ar` at slab mid-depth, e.g. 7.68 in² = 1 % of b_eff t_s) is not what GirderDetail's
  own Girder section module used for the stored `checks.negFlex` (its two layers 6.6 + 3.2 in²). `fromPayload` uses the payload's A_r
  (as ST-Girder did) unless `opt.rebar` is given; to be settled with the loads/analysis PR.
- SB2-O9. Brace points: the payload has only the cross-frame spacing, so `fromPayload` places braces every ≤ L_b per span; GirderDetail
  uses each girder's own framing (skew stagger). The bracing logic is ported; its input comes with the framing/cross-frames module.
- Not ported here (other modules): GS1–GS4 proportions, GS11 shear, GS14–GS16 constructibility, GS17/GS18 fatigue resistance,
  GS20 design load rating (owner rules), owner load rules and the m multiplier.
## 2026-10-29 — PR: sbd2-loads-lldf — cross-section, dead loads per girder, live-load distribution factors, owner rules
### Where
- `engine/owners.js` (new, `window.SBDOwners`): GirderDetail's owner rules table `OWN_RULES` copied as data, unchanged
  (anchor `const OWN_RULES = {` in `Steel Bridge Design.html`, 125 rows, AASHTO / RIDOT / MassDOT / CTDOT); `rules`, `rule`,
  `cite` (gdOwnRules / gdOwnR / gdOwnCite); `loadFactors(owner, eta, nb)` = Preliminary sizing's `plLF` (anchor
  `function plLF(Pp) {`: m, η_D η_R η_I, η = max(Πη, 0.95), η_N = min(1/Πη, 1), h0) with worked steps; `haunchInProps` = `gdHP`
  (OWN8); `defaults(owner)` = the owner default rows (OWN14) that the new model has (wearing surface, distribution method,
  sacrificial thickness, w_c for E_c, f′c).
- `engine/lldf.js` (new, `window.SBDLldf`): GirderDetail's LLDF and DLs module, live-load part (anchor `GM.df = {`,
  `compute(p)`; functions `DF_MPF`, `DF_SIMPLE`, `dfGeometry`, `dfType`, `dfSpacing`, `dfSkew`, `dfEmp`, `dfLeverC`, `dfLever`,
  `dfLeverAll`, `dfRigid`, `dfMember`; `KgOf` and the region loop of `compute`, the "exterior not less than interior" policy).
  Operation for operation; worked steps added (K_g, e_g, skew factors, interior equations, lever rule, e-factors, rigid
  cross-section trials, g_M, g_V, fatigue). New: `regions(spans, cont, skews, segments, x)` (Preliminary sizing `bridgeDef`'s
  span and pier regions, from the girder's plate segments), `ranges` (check DF1).
- `engine/loads.js` (new, `window.SBDLoads`): the rest of `GM.df.compute` (input checks, `numRows`, `parseDim`, `dfOpt`,
  `dfXsIn`, `dfEdgeIn`, `dfBridgeEff`, `dfEdges`, `dfLLFace`, `dfDead`) and the girder self-weight of `GM.sa.compute`
  (`wSt`, `SA_PLF = 3.4`). Worked steps of every line load, each girder's deck, haunch, SIP and share of each line load
  (equal, MassDOT pile-cap, RIDOT 60/40, two adjacent), totals DC1 / DC2 / DW / PL / UT / UF. `fromModel(project)` builds
  the module input from the sbd2 project; `girder(R, j)` one girder's loads and factors.
- `engine/model.js` (additive): optional `ownerRules`, `xs` (cross-section: girders, bays, overhangs, support skews, deck
  edges, sidewalks, median, wearing surface, overlays, SIP, detail allowance, added line loads, overrides, beam classes,
  distribution method, LLDF options) and `materials.concrete.wcE`; `defaultXs()`; validation of the new fields. Schema stays
  version 1: a project saved without them reads the defaults (GirderDetail's built-in cross-section, unskewed, AASHTO).
- `ui/loads.js` (new, `window.SBDUiLoads`): input tab "Cross-section & loads" and output tab "Loads & LLDF" (owner load
  rules, dead loads per girder, distribution factors per region and girder, range warnings, the worked steps of the selected
  girder and region; every value links to its step, a link to another girder or region selects it).
- `index.html`: script tags; the input tab and the output tab; section properties now apply the owner haunch rule OWN8
  (haunch 0 in the composite properties under RIDOT / MassDOT, SB2-O2) and w_c for E_c (OWN17) when entered.
### Saved data (CLAUDE.md §5)
- No new key. `sbd2.project.current` gains the optional fields above (additive; read back by this version, ignored by none:
  the previous version of this app validates only the fields it knows). `sbd2.ui` gains `otab`, `lg`, `lr`.
### Governing provisions (as GirderDetail has them; none changed)
- AASHTO LRFD 10th Ed.: N_L Art. 3.6.1.1.1; m Table 3.6.1.1.2-1; K_g Eq. 4.6.2.2.1-1 (simplified terms Table 4.6.2.2.1-3);
  interior moment Table 4.6.2.2.2b-1, shear Table 4.6.2.2.3a-1; exterior e-factors Tables 4.6.2.2.2d-1, 4.6.2.2.3b-1 (d_e ≥
  −1.0 ft), lever rule, rigid cross-section Art. 4.6.2.2.2d / Eq. C4.6.2.2.2d-1; skew Tables 4.6.2.2.2e-1, 4.6.2.2.3c-1;
  fatigue one lane / 1.2 Art. 3.6.1.4.3b; N_b = 3 and S > 16 ft rules of the tables; dead loads Art. 3.5.1, Table 3.5.1-1;
  pedestrian Art. 3.6.1.6; η Eqs. 1.3.2.1-2, -3. Owner: MassDOT Part I 3.5.3 (pile-cap), 3.5.5 (utilities), 3.5.1.2 (haunch);
  RIDOT BDM 3.3.1 (60/40), 3.4.1.2 (m 1.2), 6.5.1 / 9.4.6 (haunch); CTDOT BRSDM V2 5.4.2.4 (w_c 0.145 for E_c), 9.7.1.1.
### Check case
- Built-in cross-section (5 girders at 9.5 ft, 3.25 ft overhangs, 8 in deck, 0.40 klf barriers, 25 psf FWS, MassDOT 3.5.3):
  G1 deck 8.00 × 8/12 × 0.150 = 0.8000 klf; left barrier on G1 0.4/5 + 0.4(21.5)(19)/902.5 = 0.261053 klf, right barrier
  0.08 klf, DC2 0.341053 klf (payload 0.3411); FWS 25/1000 × 41.5 / 5 = 0.2075 klf each.
- Span 1 (L 110 ft, K_g 869,919 in⁴, skew 15°): interior g_M = 0.075 + 1 × (9.5/110)^0.2 × 1.025566 = 0.703391; g_V =
  0.917993 × 1.049681 = 0.963600. Exterior G1: lever 0.657895 × 1.2 = 0.789474; rigid, 2 lanes: 2/5 + 19(19.5)/902.5 =
  0.810526 governs g_M (payload 0.8105); fatigue 0.789474/1.2 = 0.657895. Arithmetic in `tests/engine/loads.test.mjs`.
- Before: none (new app). GirderDetail's values for the same inputs are identical (below).
### How verified
- `tests/engine/record-loads.mjs` recorded GirderDetail's LLDF and DLs inputs (P.df with the bridge Preliminary sizing sends)
  from `Steel Bridge Design.html` in headless Chromium for the 5 projects × 4 owners of the 100 `gd_*` payloads
  (`tests/projects/sbd2-loads/`, with the page's own results).
- `tests/engine/loads.test.mjs`: (1) GirderDetail's `GM.df.compute` run in Node reproduces the browser: 4,360 values,
  4,240 bit-identical, 120 differ in the last bit (largest relative 1.1e-16: `Math.pow` of Node's and Chromium's V8);
  (2) this engine against GirderDetail in the same Node run: 20 recorded inputs + 23 variations (curbs, sidewalks, fences,
  median, overlays, every added-row category and rule, overrides, beam classes, RIDOT 60/40, K_g averaged and simplified,
  exterior policy, exterior-only shear skew, skews 35–70°, N_b = 3, S > 16 ft, 22 ft roadway, sacrificial deck, OWN8, input
  errors): 29,834 values, all identical; (3) the 100 payloads: `girderDetail.df` and `girderDetail.loads` (components,
  totals, method, beam class, lanes, roadway, deflection factor, steel min / max) to their 4 decimals: 5,120 values, 0 differ;
  steel self-weight average 1.7e-4 relative (the payload weights analysis nodes by tributary length, this engine segments by
  length); (4) owner load factors equal Preliminary sizing's `bridge.lf` for all 20 inputs; hand checks above.
- One headless browser load of `apps/steel-bridge/index.html`: 0 console errors; owner change, owner defaults, added row,
  curb edge, bays edited, Calculate, girder / region switch and step links work; only `sbd2.*` keys; no horizontal scroll at 800 px.
### Other copies
- The functions remain in `Steel Bridge Design.html` (unchanged). `lldf.html` (the reference LLDF tool) is unchanged.
### Open items
- SB2-O2 closed: OWN8 applied in the section properties and K_g (the haunch weight stays in DC1).
- SB2-O6. GirderDetail (ported as is) and `lldf.html` differ (CLAUDE.md §4/§9, not changed): (a) exterior fatigue factor:
  GirderDetail = one-lane lever rule / 1.2; `lldf.html` = max(lever rule, one-lane rigid cross-section) / 1.2 (4.6.2.2.2d).
  (AUDIT.md says lldf lacks the floor; it now has it and GirderDetail does not.) On the recorded inputs the rigid value
  exceeds the lever rule for 40 of 200 exterior girder-regions (every xsA one, all owners; sidewalk fences move the traffic face in):
  G1 g_fat,M 0.2763 (GirderDetail) vs 0.4474 with the floor — unconservative for fatigue. (b) Lever rule: GirderDetail moves
  the trucks on a 0.25 ft grid; `lldf.html` also tests the exact kink positions. (c) S > 16 ft and N_b = 3: GirderDetail's
  multi-lane lever rule is two trucks; `lldf.html` the governing of 2 … N_L trucks. (d) Moment skew: GirderDetail the
  smaller support skew; `lldf.html` none when adjacent supports differ by more than 10°. Engineer to decide which governs.
- SB2-O7. Cross-frame and diaphragm weights (GirderDetail DC1 point loads from its Cross-frames module) are not in this
  version's DC1; they come with the cross-frames module.
- SB2-O8. LLDF regions take the section at mid-span; GirderDetail takes it at the station of the largest positive moment of
  Preliminary sizing's analysis (`regions(…, x)` accepts it once the analysis module exists). Same plate segment in every
  recorded case.
- SB2-O9. Owner defaults are applied by a button (the user's values are otherwise kept); GirderDetail moves untouched inputs
  automatically when the owner changes (OWN14). Confirm the wanted behaviour.

## 2026-10-29 — PR: sbd2-shear-stiffeners — web shear, transverse and bearing stiffeners, stiffener layout (new files)
### Where
- `engine/shear.js` (new, `window.SBDShear`): ported from `Steel Bridge Design.html`: `webShear` (anchor `function webShear(`),
  `A610_shearC`, `A610_Vp` (anchor `function A610_shearC(`); Preliminary sizing's `tsVn` (anchor `function tsVn(`, in `pl-src`); the shear
  lines of GirderDetail's Girder section `compute` (anchor `GM.gs = {`: `r.Vu =`, `r.VuP =`, `r.VuC =`, `r.sh = webShear(`, `r.VuF =`) and
  the checks GS11 (6.10.9), GS16 (6.10.3.3), GS18 (6.10.5.3); the Strength I shear per element of Preliminary sizing's analysis
  (`VuE`, minimum factors where a permanent load relieves). New: `location(L, prj)` (checks with value, capacity, ratio, 10th Ed. ref, and
  worked steps), `panels(pans, opt)` (every panel of a layout: tsVn, the largest V_u in the panel, the thinnest web and the largest
  2Dt_w/(b_fc t_fc + b_ft t_ft) in it, as Preliminary sizing's `tsEvalBay`), `demands(pl)` and `fromPayload(pl)` (hand-off shears).
- `engine/stiffeners.js` (new, `window.SBDStiffeners`): GirderDetail's Transverse stiffeners module (anchor `GM.ts = {`: `compute`,
  `checks`: TS1–TS8, CP1, CP2, with `TS_ROWSPEC`, `numRows`, `parseDim`, `wMinFor`), Bearing stiffeners (anchors `function bsCompute(P)`,
  `function bsChecks(R)`: BS1–BS7), Preliminary sizing's layout (`tsBaysOf`, `tsBayX`, `tsPanels`, `tsGirderBays`). Operation for operation;
  the TeX `work` lines replaced by worked steps (`transverseSteps`, `bearingSteps`). New: `stiffenerRows` (a Transverse stiffeners row for
  every intermediate stiffener and connection plate of a girder's layout), `framesDefault` (cross-frames evenly ≤ L_b per span, until
  the framing module exists).
- `engine/model.js` (additive): optional `stiffeners` { layout: web, mode 'uniform' | 'bays', doRatio, bays [{ g, a, b, n, e0, e1 }]
  (Preliminary sizing's framing.stiff / doMode / doRatio / bays.list), frames { Lb, at }; transverse { gS, Fexx, types A/B }; bearing
  { gS, Fexx, ed, types A/B } }, `defaultStiffeners()` (GirderDetail's built-in types), validation. Schema stays version 1; a project
  saved without it reads the defaults.
- `ui/shear.js` (new, `window.SBDShearUI`): input tab "Stiffeners" (layout, per-bay table of the selected girder with a button that
  fills it from the uniform d_o/D, plate types) and output tab "Shear & stiffeners" (governing ratio of each group; every panel; every
  station GS11/GS16/GS18; every stiffener and connection plate TS1–TS8/CP1; every bearing BS1–BS7; the worked steps of the selected
  row, each governing item linked to its step).
- `index.html`: three script tags, the input tab, the output tab button and its dispatch line, the input click hook.
### Saved data (CLAUDE.md §5)
- No new key. `sbd2.project.current` gains the optional `stiffeners` (additive); `sbd2.ui.otab` may be `'shear'`, `itab` `'stf'`.
  The Shear tab's demand choice and file are not saved.
### Governing provisions (AASHTO LRFD 10th Ed. (2024); all as GirderDetail has them, none changed)
- Shear 6.10.9: stiffened panel d_o ≤ 3D (interior), ≤ 1.5D (end) 6.10.9.1, else unstiffened k = 5, V_n = CV_p Eq. 6.10.9.2-1; C Eqs.
  6.10.9.3.2-4 to -6, k Eq. -7, V_p Eq. -3; interior panels with tension field Eq. 6.10.9.3.2-2 (2Dt_w/(b_fc t_fc + b_ft t_ft) ≤ 2.5,
  Eq. -1) or -8; end panels V_n = CV_p Eq. 6.10.9.3.3-1, only next to an abutment or any bearing of a simple span (S2-4, #455; pier panels
  are interior panels); V_u the largest in the panel 6.10.9.3.1; φ_v = 1.0. Deck placement 6.10.3.3. Special fatigue 6.10.5.3 (interior
  panels of stiffened webs; permanent + 1.75 V_fat).
- Transverse stiffeners 6.10.11.1: b_t Eqs. 6.10.11.1.2-1, -2; I_t Eqs. 6.10.11.1.3-1, -2 (smaller where no panel has V_u > φ_vV_cr,
  GD33), -7, -8 with ρ_w, J Eq. -3, ρ_t Eq. -5, F_crs Eq. -6; weld cutoff 6.10.11.1.1; welds Table 6.13.3.4-1, Eq. 6.13.3.2.4b-1;
  connection plates 6.6.1.3.1 (20 kip); fatigue Category C′ Table 6.6.1.2.3-1 (CTDOT Category C).
- Bearing stiffeners 6.10.11.2: b_t Eq. 6.10.11.2.2-1; (R_sb)_r = φ_b 1.4A_pnF_ys Eqs. 6.10.11.2.3-1, -2 (φ_b 1.0); effective column
  6.10.11.2.4 (9t_w strips, F_yw/F_ys when F_yw < F_ys, KL = 0.75D), P_n Eqs. 6.9.4.1.1-1, -2, P_e Eq. 6.9.4.1.2-1, P_r = 0.95P_n
  Eq. 6.9.2.1-1; welds to the web Eq. 6.13.3.2.4b-1 (φ_e2 0.80), minimum weld; width and flange connection 6.10.11.2.1; owner minimum
  thickness (CTDOT 3/4 in, RIDOT 7/16 in).
- Load factors Table 3.4.1-1 (shears as magnitudes: maximum factors), owner η and m (OWN6/OWN7), m not on the pedestrian load (GD45).
### Check case
- GS11, built-in Pier 1 (60 × 9/16 web, 18 × 1 1/2 / 18 × 2 flanges, d_o 90 in, interior): k 7.2222, C 0.578018, V_p 978.75, Eq. -2,
  V_n 765.05 kip; V_u 344.00 kip, ratio 0.4496. GS18: 221.25 ≤ V_cr 565.73 kip. As an end panel: V_n = CV_p = 565.73 kip.
- TS3, built-in row 1 (6 × 1/2 plate, d_o 60/60): I_t 36.0, J 0.5, I_t1 5.3394, F_crs 50, ρ_t 1.0, I_t2 23.195 in⁴; no panel V_u > φ_vV_cr:
  I_req = min = 5.3394 in⁴ (Eq. -1). BS2/BS3, built-in Abut. 1 (one pair 7 × 7/8, clip 1): R_u 267.5, A_pn 10.5 in², (R_sb)_r 735.0 kip;
  A 18.4375 in², I 225.333 in⁴, KL/r 12.872, P_e 31,849, P_o 921.875, P_n 910.77, P_r 865.24 kip. Arithmetic in
  `tests/engine/shear.test.mjs` and `stiffeners.test.mjs`.
- Before: none (new app). GirderDetail's values for the same inputs are identical (below).
### How verified
- PARITY_PLACEHOLDER
### Other copies
- `parseDim` / `nm` are duplicated in `engine/loads.js` and `engine/stiffeners.js` (CLAUDE.md §3). The ported functions remain in
  `Steel Bridge Design.html` (unchanged).
### Open items
- SB2-O10. Uniform spacing: GirderDetail's Transverse stiffeners and Girder section rows take every panel as d_o = (d_o/D)·D, while its
  drawings and per-bay mode place ⌈L/d_o⌉ − 1 stiffeners evenly in each bay (panels ≤ d_o). This app checks the panels of the layout
  (tsGirderBays) in both modes (the task: the full layout). Panels are never wider than GirderDetail's d_o, so the shear resistance is
  never lower than GirderDetail's; I_t1 (J from the smaller d_o) can be larger. Engineer to confirm.
- SB2-O11. Bearing reactions from a hand-off file: the payload has no reactions; DC/DW are the jump in shear, LL+IM the sum of the shear
  envelopes on both sides (an upper bound: built-in G2 pier 268.3 kip vs GirderDetail's reaction envelope 225.9 kip for the interior
  girder, +19 %). Conservative until the analysis module gives reaction envelopes.
- SB2-O12. Cross-frames: no framing module yet; they are placed evenly at most L_b apart in each span (normal to the girders, no skew
  stagger), so the bays differ from GirderDetail's framing on skewed bridges. Bearings at the support stations (no per-girder skew offset).
- SB2-O13. Not ported here: the auto-design of stiffener plates (GirderDetail AD.ts / AD.bstf), Suggest's per-bay design (tsDesignBay), the
  Fatigue module's CP2 stress range (Δf = 0 in rows from the layout until the fatigue PR), the uncoated weathering steel sacrificial
  thickness (engine supports `env.ws`; the model has no weathering input yet), the stiffener drawings and 3D.
