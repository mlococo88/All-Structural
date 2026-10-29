# Fix log — apps/steel-bridge/ (Steel Bridge Design, rebuild)

The rebuild of `Steel Bridge Design.html` (docs/REBUILD_PLAN.md §5, Phase 3). Folder: `apps/steel-bridge/`
(`index.html`, `engine/*.js`). Loads `../../shared/units.js` and `../../shared/steps.js`; from sbd2-analysis also `../../shared/vehicles.js` and `../../shared/moving-load.js`.
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
- SB2-O7 (done 2026-10-29, sbd2-flexure-noncomposite). Noncomposite girders (no deck, or noncomposite in positive flexure: 6.10.8 and App. A6 in positive regions with the
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

## 2026-10-29 — PR: sbd2-flexure-noncomposite — flexure of noncomposite girders (SB2-O7 of the sbd2-flexure entry; new behaviour)
### Where
- `engine/flexure.js`, `location(L, prj, cache)` (anchor `const dk = prj.deck, nc = dk.composite === false`): a branch for
  `prj.deck.composite === false`. New fields on the result: `nc`, `p7` (= composite in positive flexure: the 6.10.7 path, unchanged),
  `flT`; `cF.fl`, `tF.fl` (first-order f_ℓ of the compression / tension flange). New input `loc.flT` (top-flange f_ℓ, noncomposite only).
  - Section card: `S.card(p, { …, rebar: {}, composite: false })`: steel section only (no c3/cn, no deck, no deck rebar; M_p and D_cp of the
    steel section, SB2-O1 approved 2026-10-29). Stage sections: DC1, DC2, DW, LL+IM all on the steel (6.10.1.1.1a); fatigue ranges on the steel.
  - M_y: `ymNc` = F_yS_x/12 of the steel section per flange (D6.2.1) instead of the D6.2.2/D6.2.3 staged form.
  - The former negative-flexure block (anchor `// compression flange c, tension flange t`) now reads the compression flange from `r.cF`
    (bottom in negative flexure, as before; the top flange for a noncomposite section in positive flexure) and the tension flange from
    `r.tF`: b_fc, t_fc, F_yc, D_c, R_b, F_nc (FLB, LTB), f_ℓ amplification, A6 (M_yc/M_yt, I_yc/I_yt, a_wc, c_rw, λ_pw(Dcp), R_pc/R_pt, S_xc/S_xt,
    F_yr, λ_f, r_t, L_p, L_r, F_cr, M_nc, M_nt). Composite: the same variables hold the same values as before (bottom/top), so nothing changes.
  - Noncomposite D_c (D6.3.1): (d − t_t) − ȳ_s (positive) or ȳ_s − t_b (negative), ≥ 0.
  - A nonprismatic 'ge' unbraced length (6.10.8.2.3c) in positive flexure of a noncomposite girder throws ("not available").
- `checksOf`: noncomposite GS5/GS6 n/a in positive flexure (6.10.7 is for composite sections); GS8 f_bu + f_ℓ/3 ≤ φ_fF_nt (Eq. 6.10.8.1.2-1);
  GS9 tension M_u + f_ℓS_xt/3 ≤ φ_fR_ptM_yt (Eq. A6.1.2-1); GS10 for each flange (keys `fl` bottom, `flT` top); GS12 both flanges
  f_f + f_ℓ/2 ≤ 0.80R_hF_yf (Eq. 6.10.4.2.2-3); GS13 web bend-buckling always (Eq. 6.10.4.2.2-4); new information items `CN` (`cnY`, `cnW`,
  `cnT`, `inUse: false, info: true`): 6.10.3.2.1-1, -3 and 6.10.3.2.2-1 at the Strength I stresses. New helpers `flLims(r)`, `cnItems(r)`.
- `worked`: steps for all of the above (ids `fx.nc`, `fx.MyT/MyB` (D6.2.1), `fx.Dc`, `fx.fnt.ok`, `fx.a6t.ok`, `fx.flim.ok`, `fx.flimT.ok`,
  `fx.svt.ok`, `fx.svb.ok`, `fx.cn.slender`, `fx.cn.Y`, `fx.cn.W`, `fx.cn.T`); composite step text unchanged.
- `ui/flexure.js`: the "noncomposite comes in the next version" notice removed; noncomposite runs the example demands on the steel
  section; input "f_ℓ, top flange" (noncomposite only); L_b label "both flanges"; method column for every 6.10.8/A6 location; CN items
  marked "(information, not in the governing ratio)". The hand-off file path stays composite (GirderDetail payloads are composite).
- Owner rules in flexure (coordinator request 2026-10-29, after #467): `ui/flexure.js` `inputs()` (anchor `owner rules as the Section
  properties tab`) now passes the owner-adjusted section inputs exactly as `index.html` `calc()` does: haunch = `SBDOwners.haunchInProps(
  d.haunch, loadFactors(owner, eta, nb))` (OWN8: RIDOT BDM 6.5.1, MassDOT 3.5.1.2, haunch 0 in every section property) and E_c from
  `materials.concrete.wcE` when given (OWN17). Before: `haunch: d.haunch`, `wc`. `engine/flexure.js` `fromPayload(pl, opt)`: new `opt.owner`
  (the payloads do not state their owner) applies OWN8 to the deck and to `bracing()`. The hand-off file path in the tab passes no owner.
  `tests/engine/flexure.test.mjs`: owners.js loaded; the stored-hand-off check now runs every owner (owner from the file name), 600 stored
  governing items (150 each), all agree with GirderDetail's own stored values (before: AASHTO only, 150). E.g. gd_builtin_MassDOT_G1 Pier:
  2D_c/t_w = 108.8307 stored, 108.8307 with OWN8, 109.4847 without. The 113-case GirderDetail parity (base rules, payload haunch on both
  sides) is unchanged: identical.
### Saved data (CLAUDE.md §5)
- No key or format change. The new f_ℓ top-flange input lives in memory like the other Flexure-tab choices.
### Governing provisions (AASHTO LRFD 10th Ed. (2024)) — new behaviour (before: not available)
- 6.10.1.1.1a (noncomposite stresses on the steel section); D6.2.1 (M_y = lesser of F_ycS_xc, F_ytS_xt); D6.3.1 (D_c); D6.1 / SB2-O1 (M_p, D_cp by
  force equilibrium for the steel section).
- 6.10.6.2.3: noncomposite sections in both regions: App. A6 where F_y ≤ 70, 2D_c/t_w < λ_rw (Eq. 6.10.6.2.3-1, c_rw), I_yc/I_yt ≥ 0.3
  (Eq. -2), skew ≤ 20°, straight, prismatic L_b (S2-9 test, as the composite path); else 6.10.8.
- 6.10.8.1.1 (Eq. -1), 6.10.8.1.2 (Eq. -1, discretely braced tension flange), 6.10.8.2.2 (FLB), 6.10.8.2.3 (LTB), 6.10.8.3 (F_nt = R_hF_yt);
  R_b 6.10.1.10.2 (λ_rw = 5.7√(E/F_yc), SB2-O6), R_h 6.10.1.10.1; f_ℓ 6.10.1.6 (Eq. -1 each flange, Eqs. -4/-5 compression flange only).
- App. A6: A6.1.1, A6.1.2 (with f_ℓ), A6.2.1/A6.2.2 (R_pc, R_pt), A6.3.2, A6.3.3, A6.4.
- Service II 6.10.4.2.2 Eq. -3 (noncomposite, both flanges, 0.80R_hF_yf) and Eq. -4 (F_crw 6.10.1.9.1).
- Constructibility (information): 6.10.3.2.1 Eqs. -1, -3, 6.10.3.2.2 Eq. -1.
### Check case
- Positive, simple span: 14 × 1 flanges, 36 × 1/2 web, F_y 50, L_b 20 ft, C_b 1.0; M_DC1 600, M_DC2 100, M_DW 80, M_LL 700 kip-ft.
  M_u = 2220 kip-ft; S = 606.807 in³; f_bu = 43.902 ksi; M_y = 2528.36; D_c = 18; R_b = 1; A6 permitted; M_p = 2833.33 (Z = 680 in³);
  λ_pw(Dcp) = 90.755 ≥ 72: compact web, R_pc = 1.12062; J = 10.4133, L_p = 97.159 in, L_r = 357.308 in, M_nc = 2249.41 kip-ft;
  GS9: 2220/2249.41 = 0.98693 (governs). 6.10.8 (not in use): F_nc,LTB = 40.863 ksi, ratio 1.0744. Service II: 33.421 ≤ 40 (0.83552).
  Before: not available (the tab showed "comes in the next version").
- Negative, slender web: top 18 × 1.5, web 60 × 7/16, bottom 14 × 1, F_y 50, L_b 18 ft, C_b 1.3, f_ℓ 4 (bottom) / 2 (top);
  M_DC1 −900, M_DC2 −150, M_DW −120, M_LL −800. M_u = −2892.5; ȳ = 36.99628; f_bu = 29.1738, f_t = 20.1112 ksi; D_c = 35.99628;
  R_b = 0.96727; A6 not permitted (2D_c/t_w = 164.55 ≥ λ_rw = 128.18); F_nc = 48.363; f_ℓ amplified ×1.24701 = 4.9880;
  GS7 30.8365/48.363 = 0.63760; GS8 20.7779/50 = 0.41556; Service II bottom 24.2901/40, top 16.3659/40; F_crw = 34.6995, GS13 0.64237 (governs).
  Arithmetic in `tests/engine/flexure-nc.test.mjs`.
### How verified
- `tests/engine/flexure-nc.test.mjs`: the two hand checks (independent arithmetic); noncomposite negative = the existing negative path of the
  same steel section with no rebar at 12,936 negative stations of the 100 payloads (largest relative difference 8.3e-16, i.e. round-off);
  noncomposite positive = noncomposite negative of the section turned upside down at 37,100 stations (every check; A6 in use at 10,720;
  largest relative difference 1.8e-12); steps/links; composite results ignore `flT`.
- `tests/engine/flexure.test.mjs` (GirderDetail parity, composite) unchanged and still identical; whole suite passes.
- Headless load of `apps/steel-bridge/index.html`: Flexure tab composite, then noncomposite; 0 console errors.
### Other copies
- None.
### Open items
- SB2-O10. Constructibility (6.10.3.2) of a noncomposite girder: shown as information (CN items) at the Strength I stresses, an upper bound
  only if the construction-stage loads (3.4.2) do not exceed the final ones. Confirm the basis, or keep them for the constructibility module.
- SB2-O11. f_ℓ: one first-order value per flange for Strength I and the same value at Service II (as the composite path); confirm, and where
  the top-flange f_ℓ of a noncomposite girder comes from (wind, deck overhang brackets).
- SB2-O12. Noncomposite with a deck present: the deck rebar is ignored everywhere in flexure; the Section properties tab still shows the
  steel + rebar section and negative M_p with rebar for `composite = false` (engine/sections.js `card`). Confirm, then align the card.
- SB2-O13. 6.10.8.2.3 / A6.3.3: a noncomposite monosymmetric section in reverse curvature within an unbraced length: LTB of both flanges.
  Here each location checks its own compression flange with the entered C_b; per-flange C_b from the envelope comes with the analysis module.
- SB2-O14. The composite path cites Eq. A6.1.2-1 for M_u ≤ φ_fR_ptM_yt; with the deck the tension flange is continuously braced (A6.1.4-1).
  Reference only, values unchanged; not changed here (CLAUDE.md §4).

## 2026-10-29 — PR: sbd2-analysis — structural analysis (engine/analysis.js, Analysis tab; new files)
### Where
- `engine/analysis.js` (new, `window.SBDAnalysis`): `analyzeGirder(project, gi, opt)` connects the shared beam engine
  (`shared/moving-load.js`: `staticAnalysis`, `camber`, `analyze` with `m.simple` and the new `m.negX`, `deflection`) to the
  model. It does not solve a beam itself. It mirrors GirderDetail's Structural analysis ("Steel Bridge Design.html", `GM.sa`):
  - `GM.sa.compute`: stations on GirderDetail's node grid (`sgBeam`: max(8, round(L)) parts per span); girder steel
    `wSt = A × SA_PLF/1000 × (1 + allow/100)`, SA_PLF = 3.4; DC1 = steel + cross-frame points (`gdXfNodal`) + wet deck on I_s;
    DC2, DW on I_3n; construction LL (`wCL`) and utilities UT/UF on I_s; the pier region (`region`: negative M_DC1 + M_DC2 +
    M_DW + M_UT, contiguous around each pier) takes the pier g_M; LL5 two-truck region = pier region ∪ negative-IL region
    (through `m.negX`); g_V of the element's span; reactions g_V = larger adjacent span; fatigue g's of the span.
  - `feStages`: cracked zones 'none' (default), '15', 'dl' on the grid elements; I_3n and I_n → I_cr (steel + rebar) there.
  - `GM.sa.compute` `lld`: SA3 LL deflection g_Δ max(Δ_truck(1+IM), 0.25Δ_truck(1+IM) + Δ_lane) ≤ L/limit per span.
  - `dS`, `dDk`, `dSD`, `dU`: camber per stage (steel, wet deck, DC2 + DW, existing utilities) and the total.
  - `saSeq`: deck placement sequence (pours from the sign of M_DC1, positive regions first, or a custom list; hardened pours
    composite with n or 3n, uncracked), M_DCc = the noncomposite envelope (as the hand-off's `M_DCc`), deck tension vs φf_r.
  - Section stiffness from `engine/sections.js` (`steelCore`, `composite`, `withRebar`), haunch 0 under OWN8, E_c from w_cE (OWN17).
  - Loads and factors: explicit `girder.loads` / `girder.df`, else the loads module (`SBDLoads.compute(fromModel(…))`,
    `SBDLoads.girder(R, line)`: DC1, DC2, DW, UT, UF, xs.allow; regions' gM, gV, fatM, fatV, gDef), else entered
    `girder.loadsManual` / `girder.dfManual`. `girder.line` picks the cross-section girder (default: G1 for an exterior,
    G2 for an interior plate girder). CL and cross-frame points: entered (not in the loads module yet).
  - Worked steps (`an.*`): steel weight per segment, I per stage, cracked zones, statics (ΣR = Σwℓ + ΣP) per stage, largest DC1
    and LL+IM moments per span (g_M M_HL93), pier moments, LL reactions (g_V R_HL93), LL deflection and its limit, camber,
    M_DCc, φf_r and the deck tension.
- `ui/analysis.js` (new, `window.SBDAnalysisUI`): the Analysis tab: settings, loads and factors (sources shown), Run
  analysis (results marked out of date when inputs change), SVG diagrams (M, V, dead-load deflection; no Plotly), reactions,
  SA3 table, pour sequence, station table (moments / shears / deflections) and the worked steps, linked (§).
- `index.html`: script tags (`../../shared/vehicles.js`, `../../shared/moving-load.js`, `engine/analysis.js`, `ui/analysis.js`),
  the Analysis tab button and two lines in `drawOut()`.
- `engine/model.js`: header comment only (the optional fields `analysis`, `girders[i].line`, `loadsManual`, `dfManual`).
- `shared/moving-load.js`: the `m.negX` option (see `fixlog/shared-moving-load.md`; no result change for existing callers).
### Saved data (CLAUDE.md §5)
- No new key. New optional project fields only (above), saved in `sbd2.project.current` and the export file; a project without
  them reads with the defaults (IM 33 %/15 %, no cracked zones, L/800, sequence on with n, allowance 5 %, haunch per owner rule).
### Governing provisions (AASHTO LRFD 10th Ed. (2024); all as GirderDetail has them, none changed)
- 3.6.1.2 (HL-93: truck 8-32-32 kip, rear spacing 14–30 ft, or tandem, + lane 0.64 klf), 3.6.1.3.1 (90 % of two trucks + lane
  for negative moment and interior pier reactions; on simple spans the summed pier reaction, SML-O4), 3.6.1.4.1 (fatigue truck,
  30 ft), 3.6.2.1 (IM 33 % / 15 %, not on the lane), 4.6.2.2 (g), 2.5.2.6.2 and 3.6.1.3.2 (LL deflection), 4.5.2.2 and 4.6.2
  (line-girder analysis), 6.10.1.1.1 (staged sections), 6.10.1.5 (cracked zones), 6.10.3.4.1 (deck placement sequence),
  6.10.1.7 (φf_r = 0.9 × 0.24√f′c), Table 3.5.1-1 (steel 0.490 kcf, taken as 3.4 lb/ft per in²).
### Check case
- Hand check 1 (tests/engine/analysis.test.mjs): two equal spans 100 ft, steel I 16 × 1 / 60 × 1/2 / 16 × 1 (A 62 in²,
  I 38,770.667 in⁴), steel only, allowance 0: w = 62 × 3.4/1000 = 0.2108 klf; pier M = −wL²/8 = −263.5 kip-ft; R_A = 0.375wL
  = 7.905, R_B = 1.25wL = 26.35 kips; V either side of the pier ∓13.175 kips; deflection at L/2 = wL⁴/(192EI) = 0.168743 in.
- Hand check 2: single span 60 ft, g_M 0.5, g_V 0.8, g_fat 0.3: M_LL midspan 0.5 × [1.33(18L − 280) + wL²/8] = 0.5 × 1352.00
  = 676.00 kip-ft; V_LL end 0.8 × [1.33(72 − 672/L) + wL/2] = 0.8 × 100.064 = 80.051 kips; M_FAT midspan 0.3 × 1.15 × 544
  = 187.68 kip-ft.
- SML-O4: two simple spans 60 + 110 ft, g 1: pier R_LL = 0.9[1.33(60.800 + 27.055) + 54.4] = 154.122 kips (two trucks
  govern); pier moments 0.
- Before: none (new module). GirderDetail's values for the same inputs: below.
### How verified
- `node tests/engine/run.mjs analysis` (a sample of 10 payloads; `SBD_AN_ALL=1` runs all 100, ~25 min) and the full suite.
- (a) Against the station demands of the 100 `tests/projects/st/gd_*.json` payloads (each made an sbd2 project with the
  payload's loads and factors; cross-frame node loads recovered from the jumps of V_DC1steel; pedestrian load taken out of
  LL+IM), largest |difference| / largest |value| on the girder, all 100: M_DC1wet 0.008 %, M_DC2 0.11 %, M_DW 0.012 %,
  M_CL 0.006 %, M_DC1steel 0.195 %, M_DC1 0.048 %, V_DC 0.72–0.84 %, D_DC1steel 0.26 %, D_DC1wet 0.046 %, D_DC2DW 0.055 %,
  M_DCc 1.04 %, M_LL+ 0.006 %, M_LL− 0.005 %, M_FAT 0.010 %, V_LL 0.007 % (0.011 % just left of piers), V_FAT 0.019 %,
  SA3 LL deflection 0.08 %.
- (b) Against GirderDetail's own functions run in Node (`tests/engine/gd-sa-ref.mjs` on `gd-source.mjs`: sgBeam, feStages,
  sgLLRow, feIM, feFatIM, saComp, saCracked, saSeq; the lines of GM.sa.compute that assemble them repeated), same inputs, all
  100: M_LL, M_FAT, V_LL, V_FAT, R_LL ≤ 0.0013 % (0 for fatigue and LL shear); M_DC1wet, M_DC2, M_DW, M_CL ≤ 0.006 %;
  R_DC2/DW/CL 0.0006 %, R_DC1 0.012 %; M_DC1steel 0.19 %; V_DC 0.72 %; deflections ≤ 0.24 %; M_DCc 1.04 %; LL deflection
  0.08 %. The same with cracked zones '15' and 'dl' (zones identical to feStages) and on the built-in project.
  GirderDetail's functions reproduce the stored payloads within the payload's rounding (≤ 0.13 % for a girder with a
  small DC2, ≤ 0.05 % otherwise).
- Causes of the differences (none changed on either side, CLAUDE.md §4/§9):
  1. Uniform loads exact here (consistent loads), lumped at GirderDetail's 1-ft nodes: ≤ 0.012 %.
  2. Steel weight at a plate-zone boundary: GirderDetail's boundary node takes the left zone's weight over its whole
     tributary length: M_DC1steel ≤ 0.2 % (< 1 kip-ft). Fed GirderDetail's node loads, the shared engine agrees to 1e-7.
  3. Shear at a station: exact here; GirderDetail's element shear is the exact shear at the element middle: |ΔV| = wh/2.
  4. M_DCc: GirderDetail loads a node on a pour boundary in both pours (1 ft of deck counted twice per boundary): ~1 % near
     the piers. With that emulated, 0.035 %.
  5. Dead-load deflection: exact here; virtual work by the nodal rule there: ≤ 0.26 %.
  6. LL deflection: here the 1/20 points, all truck axles (shared `deflection()`); GirderDetail every second node, axles that
     add only (LL8): ≤ 0.12 %.
  7. Payload rounding of loads and factors (4 decimals) and of results (0.001).
  8. Pier region boundary one node apart where the permanent moment is within ±0.6 kip-ft of zero at a node (7 of 100
     payloads); those nodes are left out of the LL moment comparison.
- Smoke test: `apps/steel-bridge/index.html` headless: Analysis tab, loads entered, Run analysis (~4 s), 3 SVG diagrams,
  365-row station table, steps linked, stale banner on change, only `sbd2.*` keys, no horizontal scroll at 800 px, 0 console errors.
### Other copies
- None. GirderDetail keeps its own Structural analysis until the switch-over.
### Open items
- SB2-A1. GirderDetail's deck placement sequence loads a node on a pour boundary in both pours (`saSeq`: `w = xs.map(x =>
  inP(x, q) ? R.wDeck : 0)` with inclusive pour ends): about 1 ft of deck per boundary counted twice; M_DCc near the piers ~1 %
  larger (gd_builtin28_MassDOT_G4, x = 250 ft: −2059.6 vs −2038.3 kip-ft here). The new engine loads each pour exactly. Which is wanted?
- SB2-A2. Girder steel at 3.4 lb/ft per in² (GirderDetail SA_PLF; 490/144 = 3.403, 0.08 % less); kept for parity. Confirm.
- SB2-A3. Station shears: exact at the station here; GirderDetail's hand-off V is its element's shear (≈ 0.5 ft further
  along, |ΔV| = wh/2, ~0.7 %). Confirm the exact station value is wanted in the tables and any later hand-off.
- SB2-A4. LL deflection: the shared `deflection()` sums all truck axles and reads the 1/20 points; GirderDetail neglects
  axles that do not add (LL8, 2026-10-14) and reads every second node. ≤ 0.12 % here (lower). Applying LL8 needs an option
  in `shared/moving-load.js`.
- SB2-A5. Owner LL deflection rules (OWN19: RIDOT L/800 or L/1000 with pedestrians; MassDOT L/1000 with sidewalks,
  interior beam only) are not applied: the limit L/… is an input (default 800).
- SB2-A6. Not in this PR: the pedestrian load (PL) in LL+IM (warned when the loads module gives one), the construction live
  load and the cross-frame weights from their modules (entered by hand), load combinations and stresses (later PRs).
- SB2-A7. `girder.line`: a plate girder takes the loads and factors of one cross-section girder (default G1 exterior, G2
  interior). Confirm the mapping wanted when several plate girders are designed.
