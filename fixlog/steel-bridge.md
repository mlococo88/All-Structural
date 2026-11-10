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
- SB2-O19 (was SB2-O6). GirderDetail (ported as is) and `lldf.html` differ (CLAUDE.md §4/§9, not changed): (a) exterior fatigue factor:
  GirderDetail = one-lane lever rule / 1.2; `lldf.html` = max(lever rule, one-lane rigid cross-section) / 1.2 (4.6.2.2.2d).
  (AUDIT.md says lldf lacks the floor; it now has it and GirderDetail does not.) On the recorded inputs the rigid value
  exceeds the lever rule for 40 of 200 exterior girder-regions (every xsA one, all owners; sidewalk fences move the traffic face in):
  G1 g_fat,M 0.2763 (GirderDetail) vs 0.4474 with the floor — unconservative for fatigue. (b) Lever rule: GirderDetail moves
  the trucks on a 0.25 ft grid; `lldf.html` also tests the exact kink positions. (c) S > 16 ft and N_b = 3: GirderDetail's
  multi-lane lever rule is two trucks; `lldf.html` the governing of 2 … N_L trucks. (d) Moment skew: GirderDetail the
  smaller support skew; `lldf.html` none when adjacent supports differ by more than 10°. Engineer to decide which governs.
- SB2-O20 (was SB2-O7). Cross-frame and diaphragm weights (GirderDetail DC1 point loads from its Cross-frames module) are not in this
  version's DC1; they come with the cross-frames module.
- SB2-O21 (was SB2-O8). LLDF regions take the section at mid-span; GirderDetail takes it at the station of the largest positive moment of
  Preliminary sizing's analysis (`regions(…, x)` accepts it once the analysis module exists). Same plate segment in every
  recorded case.
- SB2-O22 (was SB2-O9). Owner defaults are applied by a button (the user's values are otherwise kept); GirderDetail moves untouched inputs
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

## 2026-10-29 — PR: sbd2-flexure-crw — web limit λ_rw = c_rw√(E/F_yc) in R_b and App. A6 (SB2-O6 of the sbd2-flexure entry; engineer's decision 2026-10-29)
### Where
- `engine/flexure.js`: new `crwOf(awc)` (anchor `function crwOf(awc)`), c_rw = 3.1 + 5.0/a_wc within 4.6 … 5.7 (5.7 where a_wc ≤ 0); the function the
  App. A6 permission already used (S2-9), now shared and exported.
  - `rbFactor` — before: `const lrw = 5.7 * Math.sqrt(ES / Fyc), lw = 2 * Dc / tw, awc = 2 * Dc * tw / (bfc * tfc);`
    after: `const lw = 2 * Dc / tw, awc = 2 * Dc * tw / (bfc * tfc), crw = crwOf(awc), lrw = crw * Math.sqrt(ES / Fyc);` (returns `crw` too).
  - `bracing()` `rbN` (Preliminary sizing's R_b of the governing section of a 'ge' length) — before: `lrw = 5.7 * Math.sqrt(ES / opt.FyF)`;
    after: `lrw = crwOf(aw0) * Math.sqrt(ES / opt.FyF)` with a_wc = 2D_ct_w/(b_fct_fc) uncapped for c_rw (the a_wc ≤ 10 cap of the R_b formula kept).
  - `location()` App. A6 — before: `lrw = 5.7 * Math.sqrt(ES / Fyc)` (A6.2.1 cap λ_rw D_cp/D_c, A6.2.2 λ_pw(Dc) and the R_pc/R_pt interpolation);
    after: `lrw = lrwP` (= c_rw√(E/F_yc), the permission's).
  - Steps `fx.Rb` (shows a_wc, c_rw, λ_rw; refs Eqs. 6.10.1.10.2-3, -5, -8) and `fx.a6.Rpc` note.
- `tests/engine/flexure-nc.test.mjs`: hand check 2 (slender web) updated to the new R_b (below).
### Saved data (CLAUDE.md §5)
- None.
### Governing provisions (AASHTO LRFD 10th Ed. (2024))
- R_b: Eq. 6.10.1.10.2-3 with λ_rw = c_rw√(E/F_yc) (Eq. 6.10.1.10.2-5), c_rw = 3.1 + 5.0/a_wc, 4.6 ≤ c_rw ≤ 5.7 (Eq. 6.10.1.10.2-8).
- App. A6: λ_rw per Eqs. A6.1-3, A6.1-4 (A6.2.1, A6.2.2). Before: 5.7√(E/F_yc) in both (as GirderDetail before #470).
### Check case
- Noncomposite negative flexure, top 18 × 1.5, web 60 × 7/16, bottom 14 × 1, F_y 50, L_b 18 ft, C_b 1.3, f_ℓ 4 / 2 ksi, M_u = −2892.5 kip-ft:
  D_c = 35.99628 in, 2D_c/t_w = 164.554, a_wc = 2.24977, c_rw = 5.3225.
  Before: λ_rw = 5.7(24.0832) = 137.274, R_b = 1 − 0.0011999(27.280) = 0.96727, F_nc = 48.363 ksi, F_cr = 91.636, f_ℓ = 4.9880, GS7 = 30.8365/48.363 = 0.63760.
  After: λ_rw = 5.3225(24.0832) = 128.182, R_b = 1 − 0.0011999(36.373) = 0.95636, F_nc = 47.818 ksi, F_cr = 90.602, f_ℓ = 5.0147, GS7 = 30.8454/47.818 = 0.64506
  (now governs over GS13 0.64237). More conservative.
### How verified
- GirderDetail parity (`tests/engine/flexure.test.mjs`) against `Steel Bridge Design.html` after #470 (the same rule in GirderDetail): 113 cases,
  38,971 locations, 2,128,487 values: identical (0 differ); bracing() with Preliminary sizing's fe* functions identical; before this PR, 3,780 values
  differed (main after #470). No expected-difference set is needed, since GirderDetail now uses the same λ_rw.
- Change against the previous engine on the 100 payloads (38,955 locations, f_ℓ 0 and 7.5 on the AASHTO G1 files): R_b changed at 0 locations
  (no web slender enough); A6 R_pc/M_nc changed at 630 negative locations, all where A6 is not permitted (28° skew), so no check ratio changed and
  there are 0 pass/fail flips; positive flexure unchanged.
- Full suite passes; headless load of the page: 0 console errors.
### Other copies
- `Steel Bridge Design.html` (GirderDetail): the same change made by #470 (another PR).
### Open items
- SB2-O6 (flexure entry) closed.

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
- `tests/engine/record-stiffeners.mjs` (the loads PR's recorder pattern) recorded GirderDetail's P.ts, P.bs, P.gs (as Preliminary sizing
  sends them, auto-designed) and Preliminary sizing's layout of every girder, from `Steel Bridge Design.html` in headless Chromium, for the
  5 projects × 4 owners of the 100 `gd_*` payloads, uniform d_o/D and a per-bay layout (40 files, `tests/projects/sbd2-stiff/`).
- `tests/engine/stiffeners.test.mjs`: GirderDetail's GM.ts / bsCompute / bsChecks in Node = the browser (40,200 values, 0 differ); this
  engine = GirderDetail on the 40 inputs + 260 variations (pairs, connection plates only, wide/narrow/unstiffened panels, F_yw < F_ys, thin
  web with tension field, no panel shears, fatigue, utilities, small plates; 2 and 3 bearing pairs, fillet/CJP connection, short end,
  slender column) + the built-in inputs: 720 stiffener rows, 320 bearings, 325,460 values and 50,713 check items (location, status,
  ratio), all identical (largest difference 0); layout: 200 girders, 16,870 panels identical to tsGirderBays / tsPanels.
- `tests/engine/shear.test.mjs`: GS11/GS16/GS18 on the 720 recorded Girder section rows (owner factors, web panel shears): Node = browser,
  engine = GirderDetail, 0 differ; every station of the 100 payloads + the built-in rows (and d_o = 0, 1.5D, 3D without end panel, 3.2D
  on the G1 payloads): 181 cases, 65,342 locations, 0 differ; tsVn = GirderDetail's tsVn = webShear on 40,320 panel cases.
- One headless load of `apps/steel-bridge/index.html`: Stiffeners tab (d_o/D edit, per-bay fill, per-bay mode), Shear & stiffeners tab
  with the example and with a hand-off file (363 stations, 80 panels, 79 stiffener rows, 4 bearings), row selection and § links; 0 console
  errors; only `sbd2.*` keys; no horizontal scroll at 800 px.
### Other copies
- `parseDim` / `nm` are duplicated in `engine/loads.js` and `engine/stiffeners.js` (CLAUDE.md §3). The ported functions remain in
  `Steel Bridge Design.html` (unchanged).
### Open items
- SB2-O15. Uniform spacing: GirderDetail's Transverse stiffeners and Girder section rows take every panel as d_o = (d_o/D)·D, while its
  drawings and per-bay mode place ⌈L/d_o⌉ − 1 stiffeners evenly in each bay (panels ≤ d_o). This app checks the panels of the layout
  (tsGirderBays) in both modes (the task: the full layout). Panels are never wider than GirderDetail's d_o, so the shear resistance is
  never lower than GirderDetail's; I_t1 (J from the smaller d_o) can be larger. Accepted by the engineer (2026-10-29): the layout panels are checked.
- SB2-O16. Bearing reactions from a hand-off file: the payload has no reactions; DC/DW are the jump in shear, LL+IM the sum of the shear
  envelopes on both sides (an upper bound: built-in G2 pier 268.3 kip vs GirderDetail's reaction envelope 225.9 kip for the interior
  girder, +19 %). Accepted as an interim by the engineer (2026-10-29). The analysis module will supply the real support reactions
  (reaction envelopes), and the bearing stiffener check will be wired to them then.
- SB2-O17. Cross-frames: no framing module yet; they are placed evenly at most L_b apart in each span (normal to the girders, no skew
  stagger), so the bays differ from GirderDetail's framing on skewed bridges. Bearings at the support stations (no per-girder skew offset).
  Deferred to the cross-frame PR (engineer, 2026-10-29).
- SB2-O18. Not ported here: the auto-design of stiffener plates (GirderDetail AD.ts / AD.bstf), Suggest's per-bay design (tsDesignBay), the
  Fatigue module's CP2 stress range (Δf = 0 in rows from the layout until the fatigue PR), the uncoated weathering steel sacrificial
  thickness (engine supports `env.ws`; the model has no weathering input yet), the stiffener drawings and 3D. Deferred to the cross-frame and design-helper PRs (engineer, 2026-10-29).


## 2026-10-29 — PR: shared-lldf — distribution factors from shared/lldf.js (lldf.html's engine); the four SB2-O19 items follow lldf.html (engineer's decision 2026-10-29)
### Where
- `engine/lldf.js` (`window.SBDLldf`) is now a thin adapter on `shared/lldf.js` (`window.SharedLLDF`, moved out of `lldf.html` in the
  same PR; fixlog/shared-lldf.md). `lp(p)` maps a region (N_b, bays, overhangs, traffic faces, L, t_s, truck gap, simplified K_g, moment
  and shear skew) to SharedLLDF's input (type 'a'); `geometry`, `skew`, `emp`, `leverC`, `lever`, `leverAll`, new `leverMulti`, `rigid`,
  `member` call `SharedLLDF.geometry`, `skewFactors`, `empiricalInterior`, `leverContribution`, `leverConfig`, `leverAll`, `leverMulti`,
  `rigidMethod`, `memberDF` and map the results back to the same fields (r.mom1 … shr2, gM, gV, fatM, fatV, method, emp, lever1, eM, eV,
  mE, vE, rig, alt, de0, de) plus new `rig1`, `fat1`, `fatOneM`, `fatOneV`. Kept in the adapter as before: K_g per region (KgOf, the
  length-weighted option), `regions` (bridgeDef), the shear skew on exterior girders only, the exterior "not less than interior" policy,
  the range checks, GirderDetail's method labels, and every worked step.
- New `momentSkew(rg, skews)` (anchor `function momentSkew(rg, skews)`): the region's moment θ = 0 when the 4.6.2.2.2e rule applies, else
  max(0, min(skA, skB)); shear θ = max(0, max(skA, skB)). Span region: `SharedLLDF.momentSkewNoReduction(skA, skB)` (its own two support
  lines differ by more than 10°). Pier region at support line i: `SharedLLDF.momentSkewNoReductionPier(θ_i−1, θ_i, θ_i+1)` (either adjacent
  span's two support lines differ by more than 10°), from `skews` (every support line; `engine/loads.js` now passes `skews: b.skews` to
  `SBDLldf.compute`, its only change). The `max(0, …)` keeps GirderDetail's reading of a negative skew (no skew; SharedLLDF reads |θ|):
  SB2-O23. The rules are in one place: `momentSkewNoReduction` / `momentSkewNoReductionPier` in shared/lldf.js.
- Worked steps: new `df.<region>.noRed` (support lines differ by more than 10°: |θ_A − θ_B|, Art. 4.6.2.2.2e); `scfM` / `c1` use the moment θ
  after the rule; exterior girders: new `fat1` (max(g_lever,1, g_rigid,1), Art. 4.6.2.2.2d, Eq. C4.6.2.2.2d-1) and `fatM` / `fatV` =
  g_1 r / 1.2 (before: g_M,1 / 1.2 with the note "As GirderDetail … open item SB2-O6"); the multi-lane lever-rule steps (`lev2`) name the
  governing number of trucks.
- `engine/lldf.js` header rewritten (it listed the four differences). `index.html`: `<script src="../../shared/lldf.js">` before
  `engine/lldf.js`. `engine/loads.js` unchanged.
- Tests: `tests/engine/loads.test.mjs` loads shared/lldf.js; five new variations (one per item, and the pier rule) in the GirderDetail
  parity; the temporary DFL1 expected-difference set added by #472 is removed. One expected-difference set remains, for the pier rule only
  (`PIER_RULE_PENDING`: r_M, c_1 and the moment factors of a pier region whose rule applies; 88 values, in the two skew variations), until
  GirderDetail gets the pier rule in its follow-up PR, which removes it. `tests/projects/sbd2-loads/xsA_*.json` re-recorded
  (GirderDetail's browser values after #472; only the 80 item-1 fatigue values changed). New `tests/engine/lldf.test.mjs` (hash harness,
  hand checks of the four items) and `tests/engine/lldf-hash.mjs`.
### Saved data (CLAUDE.md §5)
- None. No key, model field or format change.
### Governing provisions (AASHTO LRFD 10th Ed. (2024)) — calculation change for this app (engineer's decision 2026-10-29, SB2-O19)
1. Exterior fatigue, Art. 4.6.2.2.2d (the exterior factor not less than the rigid cross-section value) with C3.6.1.1.2 / Art. 3.6.1.4.3b.
   Before: g_fat = g_lever,1 r / 1.2. After: g_fat = max(g_lever,1, g_rigid,1) r / 1.2, g_rigid,1 = 1.2(1/N_b + X_ext e/Σx²) (Eq. C4.6.2.2.2d-1).
2. Moment skew, Art. 4.6.2.2.2e, Table 4.6.2.2.2e-1. Before: r_M with θ = the smaller support skew of the region. After: r_M = 1.0 for a
   span whose two support lines differ by more than 10°, and for a pier region when either adjacent span's two support lines do;
   otherwise unchanged (engineer's decisions 2026-10-29: per span; piers by their adjacent spans).
3. S > 16 ft (Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1: lever rule) and N_b = 3 (the tables' N_b = 3 rows), Table 3.6.1.1.2-1. Before: the
   multi-lane lever rule = 2 trucks, m = 1.0. After: the governing of N = 2 … N_L trucks, each with its m.
4. Lever rule (Art. 4.6.2.2.1, C4.6.2.2.1). Before: trucks moved on a 0.25 ft grid. After: also every position where a wheel line is over
   a girder line (the kinks of R(s)) and the end of travel; R(s) is piecewise linear, so its maximum is found exactly.
### Check cases (arithmetic in `tests/engine/lldf.test.mjs`)
1. xsA (any owner), span 1, G1: d_e = 3.25 − 5.5 = −2.25 ft; lever, one truck at 7.5 / 13.5 ft: R = 0.5(12.75 − 7.5)/9.5 = 0.276316,
   g = 0.331579; rigid one lane: e = 19 − 2.25 − 5 = 11.75 ft, R = 1/5 + 19(11.75)/902.5 = 0.447368, g = 0.536842.
   g_fat,M before 0.331579/1.2 = **0.2763**, after 0.536842/1.2 = **0.4474**; g_fat,V (r_V 1.049681) 0.2900 → 0.4696.
2. Built-in bridge, support skews 20 / 35 / 35 / 50°, span 3 (35° / 50°, differ by 15°), G2: c_1 = 0.25(1.287167)^0.25(9.5/110)^0.5 =
   0.078255, r_M = 1 − 0.078255(tan 35°)^1.5 = 0.954148; g_M before 0.703391 × 0.954148 = **0.6711**, after 0.703391 × 1 = **0.7034**.
   Span 2 (35° / 35°) keeps the reduction; piers 1 and 2 (adjacent span 1, resp. 3, differs by 15°) lose it.
   Pier rule, skews 40 / 52 / 52 / 40°, pier 1 (L = 125 ft, K_g = 1,438,270 in⁴), G2: interior equation 0.710932; c_1 = 0.25(1.872748)^0.25
   (9.5/125)^0.5 = 0.080624, r_M = 1 − 0.080624(tan 52°)^1.5 = 0.883251; g_M before 0.710932 × 0.883251 = **0.6279**, after **0.7109**
   (span 1 differs by 12° > 10°; span 2 by 0°).
3. Built-in bridge with N_b = 4 at 18 ft, overhangs 4 ft (N_L = 4), G2: 2 trucks (wheels 12, 18, 22, 28 ft) R = 0.5(8 + 14 + 18 + 12)/18
   = 1.444444, m 1.00 → **1.4444** (before); 3 trucks (6 … 32 ft) R = 0.5(2 + 8 + 12 + 18 + 14 + 8)/18 = 1.722222, m 0.85 → **1.4639**
   (after; 4 trucks 1.1917). g_M and g_V of G2 / G3 +1.3 %.
4. Built-in bridge with 3.3 ft overhangs, G5, one truck: end of travel s = 44.6 − 1.5 − 2 − 6 = 35.1 ft (the grid stops at 35.0 ft):
   R before 0.5(3.2 + 9.2)/9.5 = 0.652632 (g **0.7832**), after 0.5(3.3 + 9.3)/9.5 = 0.663158 (g **0.7958**); g_fat,M 0.6526 → 0.6632; g_M
   unchanged (rigid 0.8126 governs).
### Changed values on the recorded inputs (`tests/projects/sbd2-loads/`, 20 project/owner inputs, 5 regions × 5 girders)
- g_fat,M: 40 of 500 changed; g_fat,V: 40 of 500 (item 1: G1 and G5 of the 4 xsA inputs, every region; all higher). Unchanged: one- and
  multi-lane moment and shear factors (500 each), g_M, g_V, methods (500 each), r_M, r_V (100 each), the 1,400 lever-rule trials (R and
  position). Items 2–4 do not occur in the recorded inputs (equal skews; N_b = 5, S = 9.5 ft; the grid hits every peak); the four
  variations above exercise them.
### How verified
- `tests/engine/lldf.test.mjs`: shared/lldf.js = lldf.html's engine before the move (1,592 cases, 11,135 outputs, identical hashes); hand checks 1–4.
- GirderDetail parity (`tests/engine/loads.test.mjs`) against "Steel Bridge Design.html" after #472 (the same four changes, per-span skew):
  20 recorded inputs + 28 variations (5 new), 33,032 values (every K_g, skew factor, one- and multi-lane factor, g_M, g_V, fatigue factor,
  method, lever-rule trial and rigid-section value): identical except the 88 pier-rule values above (GirderDetail keeps the pier
  reduction until its follow-up PR). Before #472 merged, the same comparison showed exactly the four items (140 item 1, 22 item 2, 40
  item 3, 120 item 4 on the inputs and variations) and nothing else. GirderDetail in Node = the re-recorded browser values. The 100
  payloads (the 15 xsA AASHTO / MassDOT / CTDOT files re-saved from GirderDetail after #472, as #472 did for RIDOT): girderDetail.df and
  .loads to 4 decimals, 0 differ. The re-saved payloads differ from the old ones only in producedAt, girderDetail.df.spans[].fatM / fatV
  (18 values, G1 and G5) and the fatigue envelopes of G1 / G5 at every station (M_FATpos/neg, V_FATpos/neg), all item 1.
- `tests/engine/analysis.test.mjs` (#469) and `tests/engine/fatigue.test.mjs` (#474), merged meanwhile, load shared/lldf.js before engine/lldf.js
  (their loads-module path tests), as index.html does.
- `node tests/engine/run.mjs`: every test passes. Headless loads of `lldf.html` (before/after, same values, 0 console errors) and
  `apps/steel-bridge/index.html` (Loads & LLDF tab, 0 console errors).
### Other copies
- `Steel Bridge Design.html` (GirderDetail): the same four changes in its own code (#472). `lldf.html`: the reference (engine now in
  shared/lldf.js, unchanged results).
### Open items
- SB2-O19 closed (the four GirderDetail / lldf.html differences of the sbd2-loads-lldf entry; engineer's decision 2026-10-29).
- SB2-O23. Negative skews: GirderDetail (and this app) read a negative support skew as no skew (no moment reduction, no shear
  correction); lldf.html uses |θ| (its LLDF-OH2). Kept as GirderDetail; engineer to decide (the model accepts −90° … 90°). Closed 2026-10-29 (sb2-o23-skew-abs: |θ| in both, DFL6).
- SB2-O24. Pier rule (decided 2026-10-29: a pier region loses the reduction if either adjacent span differs by more than 10°): in this app
  now; GirderDetail gets it in the follow-up PR on "Steel Bridge Design.html", which removes `PIER_RULE_PENDING` from loads.test.mjs.
  Done in claude/sbd-df-pier (DFL5, fixlog/Steel Bridge Design.md): `PIER_RULE_PENDING` removed, the DF parity is exact (33,032 values).
- SB2-O25. lldf.html takes the moment θ as entered for the selected design region, or from Bridge Geometry's `skewDetail.moment`, which is
  bridge-wide (0 when any two adjacent supports differ by more than 10°). Per span maps onto lldf.html as: for a span region, enter 0 when
  that span's own two support lines differ by more than 10°, else the smaller of them. lldf.html and Bridge Geometry are unchanged here
  (one tool per PR); aligning Bridge Geometry's hand-off with the per-span rule is a separate change.

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

## 2026-10-29 — PR: sbd2-fatigue-studs — fatigue (6.6.1, GS17, FA1–FA7) and stud shear connectors (6.10.10, SC1–SC7) (new files)
### Where
- `engine/fatigue.js` (new, `window.SBDFatigue`), ported operation for operation from GirderDetail ("Steel Bridge Design.html"):
  - anchors `const FA_STUD =`, `function gdFatSet(`, `function gdFatSup(`, `function gdFatN(`, `const gdFatNear =`, `function gdFatNr(`,
    `function gdFatLS(`, `function gdFatStud(` → `settings`, `supports`, `nAt`, `nRange`, `limitState`, `studLimit` (ADTT_SL = p·ADTT;
    n per Table 6.6.1.2.5-1, 1.5 within 0.1L each side of an interior support; Fatigue I where ADTT_SL ≥ A(γ_I/(γ_II(ΔF)_TH))^m/(365·life·n),
    else Fatigue II (ΔF)_n = (A/N)^(1/m), N = 365·life·n·ADTT_SL; m = 3 for the categories, m = 5 and A = 1040 × 10⁸ for studs);
  - `GM.fa = {` compute/checks → `compute`, `checks` (FA1 Eq. 6.6.1.2.2-1, FA2 6.6.1.2.1 net tension, FA3 6.10.5.3, FA4 6.6.1.3,
    FA5/FA6 MBE 7.2.4/7.2.5, FA7 owner OWN39) with `FA_CAT`, `FA_DET`, `FA_LOC`, `FA_SPEC`, `faRR`, `secSet`, `rowDk`; owner rules OWN8
    (haunch 0 in the properties), OWN25 (connection plate details Category C), diaphragm names (`cfDiaOn`), utilities (GD54b);
  - `GS17 limit state (F12-1` in `GM.gs` compute/checks → `flange(loc, o)` on an engine/flexure.js location (its Fatigue I ranges);
  - `detailsFromPayload(pl, opt)`: the detail rows of Preliminary sizing's inventory kinds (`detailExport` fatigue part) on one girder's
    own demands (not a port: Preliminary sizing works on its own analysis; not parity-tested).
  - worked steps `fa<i>.*` per detail and `gs17.*` per location.
- `engine/studs.js` (new, `window.SBDStuds`): `GM.sc = {` compute/checks → `compute`, `checks` (SC1 6.10.10.1.2/6.10.10.2, SC2 6.10.10.4,
  SC3 6.10.10.1.2 (+OWN22 6d), SC4 6.10.10.1.3, SC5 6.10.10.1.1/6.10.10.1.4, SC6 splice plates, SC7 OWN22), `SC_ZSPEC`, `SC_RSPEC`,
  `GM.sc.def`; `fromPayload(pl, opt)`: GirderDetail's Shear connectors input rebuilt from a hand-off (`details.studs`, S2-6 results);
  option `beffMode: 'girder'` (off by default; see Open items); worked steps `sc.*`, `scz<i>.*`, `scr<i>.*`, `scg<k>`.
- `ui/fatigue.js` (new, `window.SBDFatigueUI`): the "Fatigue & studs" input tab (traffic, limit state, flange categories,
  distortion details, studs, splices, b_eff option, pitch zones) and output tab (demands: this project's analysis — engine/analysis.js,
  merged from main during this PR — or GirderDetail's built-in example, or a hand-off file; details FA1–FA7, GS17 at every station,
  studs per zone and region SC1–SC7, the b_eff comparison line, worked steps linked (§)). With the analysis and no zones entered,
  the zones and regions are made as Preliminary sizing makes them for GirderDetail (span tenths, n_r, pitch from p_req; regions
  support → max. Strength I positive moment).
- `engine/model.js`: optional `fatigue` and `studs` blocks (`defaultFatigue()`, `defaultStuds()`, validation).
- `index.html`: three script tags, the input tab `fs`, the output tab button `fat` and its line in `drawOut()`, `tabOf`, onClick.
- Tests: `tests/engine/fatigue.test.mjs`, `tests/engine/studs.test.mjs`; recorder `tests/engine/record-fatigue.mjs` and its
  recordings `tests/projects/sbd2-fat/*.json` (P.fa, P.sc, P.df.bridge, P.cf and GirderDetail's browser results, 5 projects × 4 owners).
### Saved data (CLAUDE.md §5)
- No new key. New optional project fields `fatigue`, `studs` in `sbd2.project.current` and the export file; a project without them
  reads with the defaults (GirderDetail's built-in values).
### Governing provisions (AASHTO LRFD 10th Ed. (2024); all as GirderDetail has them, none changed)
- 3.6.1.4.2 (ADTT_SL), Table 3.4.1-1 (γ Fatigue I 1.75, Fatigue II 0.80), 6.6.1.2.1–6.6.1.2.5 (Tables 6.6.1.2.3-1, -2,
  6.6.1.2.5-1; Eqs. 6.6.1.2.2-1, 6.6.1.2.5-1, -2, -3), 6.6.1.3, 6.10.5.1, 6.10.5.3, 6.10.9.3.3 (V_cr), 6.10.10.1.1–6.10.10.1.4,
  6.10.10.2 (Eq. 6.10.10.2-1, Condition 9.2), 6.10.10.4 (Eq. 6.10.10.4.3-1 Q_n = 0.70A_scF_u, φ_sc = 1.00 per 6.5.4.2), MBE 7.2.
### Check case (tests: hand checks)
- GirderDetail's built-in Fatigue: ADTT_SL = 0.85 × 2000 = 1700. Category C′ (A 44 × 10⁸, (ΔF)_TH 12), n = 1: equivalent
  44e8 (1.75/(0.80 × 12))³/(365 × 75) = 973.6 ≤ 1700 → Fatigue I, 12 ksi. Forced Fatigue II: N = 46,537,500, (ΔF)_n = 4.5556 ksi.
  FA3 at the pier row: V_u = 125 + 1.75(55) = 221.25 kip; d_o = 90, D = 60, t_w = 9/16: k = 7.2222, C = 0.57802, V_cr = 565.74 kip.
- GS17 Category B, n = 1.5: equivalent 746.8 ≤ 1700 → Fatigue I, 16 ksi.
- Studs 7/8 in, n = 1: equivalent 1040e8 (1.75/(0.80 × 7.0))⁵/(365 × 75) = 11,322 > 1700 → Fatigue II; (ΔF)_n = (1040e8/46,537,500)^(1/5)
  = 4.6757 ksi, Z_r = 4.6757 × 0.60132 = 2.8116 kip.
- SC2, GM.sc.def region 1: P_c = 0.85(4)(114)(8) = 3100.8, P_s = 50(60)(0.5625) + 50(16 × 0.75 + 16 × 1.125) = 3187.5 → P = 3100.8 kip;
  Q_r = 0.70(0.60132)(60) = 25.2555 kip; n = 122.78 ≤ 3⌊264/9⌋ + 3⌊264/12⌋ = 87 + 66 = 153.
- Before: none (new modules).
### How verified
- GirderDetail's functions in Node (gd-source.mjs pattern) = GirderDetail in the browser on the recordings: 18,260 fatigue values and
  10,610 stud values, 0 differ.
- This engine = GirderDetail in Node, exact (largest relative difference 0): Fatigue on 20 recordings + 304 variations (Fatigue I/II
  forced, ADTT, uncracked, stresses entered, custom heights and categories, utilities, FA3, distortion, evaluation, input errors,
  built-in × 4 owners): 18,856 detail rows, 807,306 values, 47,605 check items. Limit-state functions: 2,160 cases. GS17 on the 100
  gd_* payloads: 14,860 locations, 29,720 flange items (17,100 Fatigue I, 12,620 Fatigue II). Shear connectors on 20 recordings +
  222 variations: 6,604 zones, 1,322 regions, 238,220 values, 31,804 check items.
- fromPayload on the 100 payloads = the stud results GirderDetail sends (S2-6), 3,000 zones and 600 regions: identical at the
  hand-off's 1e-6 rounding.
- `node tests/engine/run.mjs` (full suite); headless smoke test of `apps/steel-bridge/index.html` (Fatigue & studs tabs, analysis source).
### Other copies
- None. GirderDetail keeps its own Fatigue and Shear connectors modules until the switch-over.
### Decisions (engineer's rule of 2026-10-29: decide by AASHTO 10th Ed. and accuracy, record the reasoning)
- SB2-F1. Bridge-wide b_eff for the studs. GirderDetail's Shear connectors module has one set of zones and regions for the bridge
  with ONE b_eff (Preliminary sizing sends the girder type with the largest fatigue shear range; on the built-in project the
  exterior, 96 in). Decision: mirrored by default, as this PR's task requires for parity; the option `studs.beffMode: 'girder'`
  (each girder its own b_eff) is provided, off. Reasoning: AASHTO 6.10.10.1.2 takes Q and I of the girder's own short-term
  composite section, and 6.10.10.4.2 its own b_eff in P_1p (4.6.2.6), so the per-girder value is the accurate one; the
  bridge-wide value is an envelope simplification. Measured on the built-in project (AASHTO payloads): interior G2–G4 b_eff
  96 → 114 in, largest SC1 ratio 0.8746 → 0.8915 (p_max up to 3.03 % lower, i.e. the bridge-wide value is slightly
  unconservative for the interior girders in fatigue), SC2 unchanged 0.9938 (P_2p, the steel, governs), no pass/fail change;
  G1, G5 unchanged. Recommendation for the switch-over: turn the option on (a one-line default change in `defaultStuds()`).
- SB2-F2. V_f of a pitch zone with this app's analysis (or zones entered on a file): the largest V_FAT,pos − V_FAT,neg of the
  girder's own stations in the zone. Kept: 6.10.10.1.2 defines V_f as the vertical shear force range of the girder under the
  fatigue load; GirderDetail's governing-type element range is an envelope of the same quantity.
- SB2-F3. The fatigue detail list from a file or the analysis (`detailsFromPayload`) uses Preliminary sizing's kinds and rules
  on the girder's own station demands and the cross-frames of the stiffener layout. Kept: same detail kinds and categories as
  Preliminary sizing; the demands are the girder's own (more accurate than the type envelope). Not parity-tested by construction.
- SB2-F4. With a file, the stud inputs (d, h, s_t, F_u, γ, F_rc, w) are this project's, not the file's. Kept: the project is
  what is being designed; the parity test sets them to the file's values and reproduces GirderDetail's ratios exactly.

## 2026-10-29 — PR: sbd2-constructibility — constructibility during deck placement, 6.10.3 (engine/constructibility.js, Constructibility tab; SB2-O10)
### Where
- `engine/constructibility.js` (new, `window.SBDConstr`): ported from `Steel Bridge Design.html`, arithmetic copied operation for operation:
  GirderDetail Girder section `GM.gs.compute` (anchor `// constructibility (steel section)` to `r.VuC = G.cdc * r.VDC1 + G.ccl * r.VCL;`, with the
  nonprismatic block anchor `// nonprismatic deck-placement unbraced length (CB2`) and `GM.gs.checks` GS14, GS15, GS16; `gsGov` kinds 'Ct'/'Cb' (`gsGovC`);
  Preliminary sizing `gsRow` deck-placement L_b,C / C_b,C / nprC (anchor `// C_b for deck placement (CB1`; `bracingC`); the hand-off `gdStConstr`
  (governing item per span: compression top flange, compression bottom flange, tension flange, shear; overhang rows at the largest
  1.25M_DC1 + 1.5M_CL of each span, `ohRowsAt`); the Deck overhang module `GM.oh.compute` / `GM.oh.checks` OH1–OH5 (`ohLoads`, `overhang`).
  Reuses `SBDFlexure.ltbFnc/ampFl/fcrw/fe*`, `SBDShear.webShear/panelSteps`, `SBDSections.steelCore/hybrid`. New: `location`, `girder`,
  `fromPayload` (hand-off with M_DCc, M_CL; S2-8), `fromAnalysis` (this app's analysis: st.DC1, st.CL, seq.MDCc; braces = bearings + cross-frames
  of `P.stiffeners.layout.frames`; d_o and end panel from `SBDStiffeners.girderBays/bayPanels`). Worked steps `cn.*` and `oh.*`.
- `ui/constructibility.js` (new, `window.SBDConstrUI`): the Constructibility tab: source (this project: runs `analyzeGirder(P, g, { ll: false })`;
  or a hand-off file), f_ℓ during deck placement, overhang bracket inputs (exterior girder, saved), span summary (top / bottom compression,
  tension, shear, OH1–OH4, OH5) with click-through, per-location table, checks with § links, worked steps; overhang rows with their steps.
- `engine/flexure.js` (SB2-O10, engineer's decision): the information items CN removed (`cnItems`, the CN lines in `checksOf`, the `fx.cn.*`
  steps, `r.prjFyw`); header comment says where constructibility is. `ui/flexure.js`: the "(information, not in the governing ratio)" label
  removed; a note links to the Constructibility tab. `tests/engine/flexure-nc.test.mjs`: the CN asserts replaced by "no CN item / step".
- `index.html`: two script tags, the Constructibility tab button, one dispatch line. `engine/model.js`: header comment (`constr.oh`).
### Saved data (CLAUDE.md §5)
- No new key. New optional project field `constr.oh` (bracket inputs; absent = GirderDetail's Deck overhang defaults), saved in
  `sbd2.project.current` and the export file. Old projects read unchanged.
### Governing provisions (AASHTO LRFD 10th Ed. (2024); all as GirderDetail has them, none changed)
- 3.4.2.1: M_c = 1.25M_DCc + 1.50M_CL, V_u = 1.25V_DC1 + 1.50V_CL (GirderDetail gam.cdc, gam.ccl); M_DCc = the pour-sequence envelope
  (6.10.3.4.1), M_DC1 where none. Steel section 6.10.1.1.1a; D_c D6.3.1; R_h 6.10.1.10.1; φ_f = φ_v = 1.0.
- GS14: Eq. 6.10.3.2.1-1 (applied to every web, conservative, as GirderDetail) and Eq. -2 with F_nc of 6.10.8.2.2 / 6.10.8.2.3 (R_b = 1.0),
  C_b,C Eq. 6.10.8.2.3b-1 from the deck-placement moments, nonprismatic 6.10.8.2.3c (C_b = 1.0, γ_e by App. D6.6.2 Method A or the bound);
  f_ℓ amplification Eqs. 6.10.1.6-4, -5. GS15: Eq. 6.10.3.2.1-3 (F_crw 6.10.1.9.1), Eq. 6.10.3.2.2-1. GS16: Eq. 6.10.3.3-1 (V_cr = CV_p).
- OH1–OH5: C6.10.3.4 (F_ℓ = w_u a/h_b, P_ℓ = γP_fm a/h_b, M_ℓ = F_ℓL_b²/12 + P_ℓL_b/8), Eqs. 6.10.3.2.1-1, -2, -3, 6.10.3.2.2-1, 6.10.1.6-1.
### Check case (tests/engine/constructibility.test.mjs, arithmetic in the comments)
- Steel I 16 × 1 / 60 × 1/2 / 16 × 1, F_y 50, M_DC1 1000, M_DCc 1100, M_CL 100, L_b 20 ft, C_b 1: M_c = 1525 kip-ft, f_top = −14.6322 ksi, D_c = 30,
  r_t = 4.031621, L_p = 106.8037, L_r = 364.5814 in, F_nc,LTB = 42.24935: GS14 0.292644 / 0.346329 (governs), GS15 web (F_crw = 50) 0.292644,
  tension 0.292644; V_u = 1.25(50) + 1.5(5) = 70, unstiffened C = 0.316181, V_cr = 275.0771: GS16 0.254474.
- Overhang (GirderDetail's Deck overhang defaults and row): w_u = 0.8165625 klf, F_ℓ = 0.544375 klf, P_ℓ = 3.0 kip, M_u = 2395 kip-ft,
  M_ℓ = 400.3857 kip-in, f_ℓ1 top 12.51205 ksi; OH1 0.94222, OH2 0.84967, OH3 0.51636, OH4 0.59960, OH5 0.70977 / 0.27805 (= GM.oh).
- Before: none in the new app (flexure showed CN information items at the Strength I stresses; removed).
### How verified
- GirderDetail's own `GM.gs` / `GM.oh` run in Node (gd-source.mjs pattern), same inputs to both, all identical (largest relative difference 0):
  (1) the recorded Preliminary-sizing rows (tests/projects/sbd2-stiff, 40 inputs, as recorded and with M_DCc ≠ M_DC1, f_ℓ 3 ksi, V_CL × 2):
  1,440 rows (940 nonprismatic 'ge'), 7,200 GS14–GS16 items, 64,740 values; Node = browser for V_uC. (2) Every Check-at-any-location station of the
  100 gd_*.json payloads with the payload's M_DCc and M_CL fed in (+ f_ℓ 4 on the G1 payloads): 120 cases, 44,520 locations, 222,600 items;
  OH1–OH5 at the overhang rows of every exterior girder: 720 items. (3) `bracingC` with Preliminary sizing's own fe*: identical on 3,710 locations.
- Stored hand-off `girderDetail.checks.constr` recomputed from its stored inputs: 1,200 GS14–GS16 governing items and 240 OH items within the payload
  rounding (largest 0.03 kip on a V_cr recomputed from the rounded C). Governing location per span and group equal to GirderDetail's at 606 of 1,200;
  the others: 246 L_b,C / C_b,C differ (payload brace points every ≤ L_b vs GirderDetail's own framing, SB2-O9), 348 M_c differs ≤ 0.2 % at the
  same station (payload moments interpolated linearly vs GirderDetail's own analysis there); none other. Overhang rows at GirderDetail's station in every span.
- With this app's own pour sequence (engine/analysis.js) in place of the payload's M_DCc, all 100 payloads, 37,100 locations: ΔM_DCc ≤ 0.05 % of
  max at 12,220, 0.05–0.5 % at 20,178, > 0.5 % at 4,702 (all within 0.3L of a pier): SB2-A1, largest 1.04 % (gd_builtin28_MassDOT_G4, x = 250.01:
  GirderDetail −2452.4, this app −2426.0 kip-ft); every ratio change is exactly 1.25ΔM_DCc through M_c (asserted); shear, L_b,C, C_b,C unchanged;
  largest ratio change 0.0040 (0.4308 → 0.4268, tension flange). The engineer's decision: the new app keeps its exact pour loads.
- Flexure unchanged by the CN removal: origin/main vs this branch, every payload composite and noncomposite, 74,200 locations, 655,912 check ratios
  and governing items: 0 differ. Flexure GirderDetail parity re-run: identical (113 cases, 2,128,487 values). Full suite passes.
- Headless load of apps/steel-bridge/index.html: Constructibility tab (project: 367 locations; hand-off file: OH section), Flexure → Constructibility
  link, 0 console errors, only `sbd2.ui` written, no horizontal scroll at 800 px.
### Other copies
- None. GirderDetail keeps its own modules until the switch-over.
### Decisions (made here, per the engineer's rule of 2026-10-29)
- SB2-O10 closed: constructibility only in this module with the construction-stage loads; a noncomposite girder is checked the same way (steel section,
  M_DC1 + construction LL; no pour sequence), as GirderDetail.
- Shear V_DC1, V_CL on the project path: the exact station shear (VL left of a station, VR right of it), consistent with SB2-A3.
- f_ℓ in GS14/GS15: an entered first-order value (default 0, as Preliminary sizing sends flC = 0); the bracket f_ℓ is checked in OH1–OH5 only, as GirderDetail.
### Open items
- SB2-C1. Display only: engine/flexure.js step `fx.Mu` writes `γ` and a positive moment without parentheses (`1.251450.00`); values are right.
  Not changed here (one module per PR); to fix in the next flexure PR.
- SB2-C2. Overhang inputs: no "Fill from cross-section" (GirderDetail XS11) yet; the defaults are GirderDetail's planning values.

## 2026-10-29 — PR: sbd2-katex — worked steps rendered with KaTeX (engineer's approval 2026-10-29)
### Where
- `apps/steel-bridge/index.html`, `<head>`, before `<script src="../../shared/units.js">`: KaTeX 0.16.9 from cdnjs, the same pinned
  version and URLs as GirderDetail (`Steel Bridge Design.html`, anchor `KaTeX/0.16.9/katex.min.css`):
  `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">`,
  `<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>`.
- CSS after `.st-bar{…}`: `.steps .katex{font-size:1.08em;} .steps .lbl{margin-bottom:3px;}` (room for display-style fractions), `.steps .katex .katex-error{color:var(--fail);}`; in `@media print`:
  `.steps li{break-inside:avoid;}`, KaTeX colours printed exactly, fraction and overline rules in black at least 1 px.
- Rendering is in `shared/steps.js` (`toHTML`, `line`; see `fixlog/shared-units.md`, same PR). The Section properties, Flexure, Analysis, Fatigue & studs, Constructibility,
  Loads & LLDF and Shear & stiffeners tabs all render their steps with `SharedSteps.line(s, true)`, so all seven use KaTeX; no UI file changed.
- `engine/fatigue.js`, FA6 remaining-life step (anchor `id: 'life', label: \`Remaining fatigue life`), the `sub` shown when R_R is not
  entered: the only step string that KaTeX could not parse (`_` inside `\text{}`).
  Before: `'\\text{R_R not entered}'`. After: `'R_{R}\\ \\text{not entered}'`. Display text only: `value` (NaN) and `ok` unchanged;
  `toText` gives "R_R not entered" before and after; on screen, R with subscript R.
### Problem
- New behaviour: steps typeset with KaTeX. Offline or with the CDN blocked, the steps use the built-in renderer as before.
### Governing provision
- None (display only). No value, formula, factor, unit or reference changed; no saved-data key changed.
### Check case
- Section properties tab, built-in project: `S_bot = I/ȳ = 51,050/33.535 = 1522 in³` shown with a KaTeX fraction; same digits as before.
### How verified
- `node tests/engine/run.mjs`: all pass, including `tex.test.mjs` (every engine step string parses in KaTeX).
- Headless load (tests/lib.mjs, KaTeX served from tests/libs): see the PR description for the counts per tab (KaTeX spans,
  `.katex-error` = 0, console errors = 0), print emulation (0 `.katex-error`, fraction rules visible) and the same tabs with KaTeX blocked
  (built-in renderer, steps shown; the only console errors are the two blocked KaTeX requests).
### Other copies
- None.
### Open items
- None.
## 2026-10-29 — PR: sbd2-crossframes — framing layout and cross-frames (engine/framing.js, engine/crossframes.js, Framing and Cross-frames tabs; new files)
### Where
- `engine/framing.js` (new, `window.SBDFraming`): Preliminary sizing's `framingLayout(P, m)` copied line for line from the page text
  (`<script type="text/plain" id="pl-src">`, anchor `function framingLayout(P, m) {`) as `layout(P, m)`, with `plPierSp`, `plPierLen`, `FL_MEMO`,
  `plOwnXf` (owner rule xf.orient read from `window.SBDOwners`, GirderDetail's OWN_RULES verbatim) and `plXfDef` (the frame list GirderDetail's
  DC1 point loads use). Per span: parallel to the skew (both supports ≤ 20°) or normal; contiguous, staggered or (RIDOT) stepped; the first frame
  e = max(clear, 4b_f, 0.4s) from the obtuse bearing at a support skewed > 20° (C6.7.4.2.1); corner frames; end frames on the bearing lines;
  grid shifts and extra frames to clear field splices and shop transitions; pier-region spacing. Per girder (anchors `const brOf = {}, braceG`,
  `const toG =`, `const toX =`, `const lbMax =`): `braceG` (own brace stations), `toG`/`toX` (analysis station ↔ girder's own station,
  proportional within the span), `lbMax`. New: `modelOf(P)` (the layout inputs from an sbd2 project: spans, xs.nb/bays/skews, framing
  settings and field splices, every girder's plate changes as flange/web transitions), `compute(P)` (layout + worked steps `fr.*`),
  `girderBraces(P, gi)` / `forGirder(P, sel, sup)` (a girder's brace points as analysis stations, its intermediate frames, `lenOf(a, b)` = its own
  length), `flSkew(skews, ext, F)` (f_ℓ from skew, below; steps `flsk.fl`).
- `engine/crossframes.js` (new, `window.SBDCrossframes`): GirderDetail's Cross-frames module `GM.cf` (anchor `GM.cf = {`): `def`, `compute(p)`
  (truss model by direct stiffness: unit bottom-flange load with the top chord held by the deck, unit torsional brace moment; wind P_Z, W, F_w with
  γ_WS = 1.0η (OWN7); stability bracing M_br, β_br, β_sec, β_g, β_T, β_T,req; member demands T_u, C_u per combination; single-angle (KL/r)_eff,
  Q, P_e, P_n, P_r; φP_y, A_n, U, φP_u; ℓ/r_z; bolt shear and bearing; gage/edge; fatigue γΔf) and `checks(R)` (CF1–CF11), `cfDiaChecks`
  (CFD, CFE: anchor `function cfDiaChecks(`), `cfDiaSec`, `cfDiaOn`, `cfDiaGap`, `cfDiaEnd`, `cfTypeRec`, `cfTsCP`, `cfCPsize`, `cfBsCP`, `cfCP`,
  `cfDiaFit`, `angleProps`, `ANGLES`, `CF_MEM`, `CF_CH`, `CF_DIA`, `BOLT`, `FUB`, `PHI`; the XF1 weight `gdXfW` → `xfW`, `gdXfModel` → `xfModel(set, c)`,
  `gdXfPts` → `xfPts(b, X)`. Arithmetic copied operation for operation; GirderDetail's page state (P.ts, P.bs, P.df.bridge, gdLF, gdOwnR) is
  passed in `env`. TeX work lines replaced by steps `cf.*`, `cf.cfd.*`, `cf.cfe.*`. New: `defaults()`, `inputsOf(P, { L, A, gi })` (the
  geometry Preliminary sizing sends to GirderDetail, anchor `const cf = { S: r2(m.S * 12)`: S, h = round(max(D − 8, 0.75D)), d, L_b = the
  largest unbraced length on any girder, primary by skew > 20°; stability bracing span = the span of the largest 1.25M_DC1 + 1.5M_CL, its
  length, the fewest intermediate frames on any girder in it, the plates there), `envOf(P)`, `pointLoads(P, gi)` (DC1 point loads of the
  plate girder's cross-section line).
- `engine/analysis.js` `loadsOf` (anchor `// cross-frame point loads (XF1)`): xf point loads = explicit `girder.loads.xf`, else (project has
  `framing`, framing.js and crossframes.js loaded) `SBDCrossframes.pointLoads`, else `girder.loadsManual.xf`. `o.src.xf = 'module'`, `o.xfInfo`.
- `engine/flexure.js` `bracing()`: optional `opt.lenOf(a, b)` (the girder's own unbraced length, as Preliminary sizing's L = p1 − p0 in own
  stations; default b − a, i.e. unchanged); `fromPayload` passes `opt.lenOf`. Before: `const L = p1 - p0`; after: `const L = opt.lenOf ? opt.lenOf(p0, p1) : p1 - p0`.
- `engine/model.js`: optional `framing` and `crossframes` blocks (`defaultFraming()`, `defaultCrossframes()`, validation); `defaultProject()` has both.
- `ui/framing.js` (new, `window.SBDFramingUI`): input tab "Framing" (layout settings, field splices, plan sketch as plain SVG: girders, support
  lines, end and intermediate frames, splices; skew f_ℓ; members, connections, wind, stability bracing, refined-analysis forces, diaphragm, DC1
  weight) and output tab "Cross-frames" (governing ratio, framing per span and per girder with the plan, f_ℓ and DC1 point loads, CF/CFD/CFE
  table, truss member forces, worked steps, § links).
- `ui/flexure.js` (file source): brace points from the project's framing when the file's supports are the project's (girder = the file's
  girder), and f_ℓ = the value entered, else the skew f_ℓ from the file's skews and position. Also fixed: the file branch's `return` was on the
  same line after a `//` comment, so a hand-off file fell through to the example demands (UI only; no calculation changed).
- `ui/shear.js` (`framesOf`), `ui/fatigue.js` (frames and GS17 braces): the project's framing first, then the stations entered, then evenly ≤ L_b.
- `ui/analysis.js`: the dead-load card says where the cross-frame point loads come from (link to the Framing tab).
- `engine/constructibility.js` `fromAnalysis` (merged from main during this PR): `opt.braces` used when given (before: always the stiffener-layout
  frames); `ui/constructibility.js` passes the framing's brace points (project, or a file of this bridge). Unchanged without framing.
- `index.html`: three script tags, the input tab `fr`, the output tab `cf`, `tabOf`, change/redraw hooks, a `data-goto` link handler.
- `engine/lldf.js` step `df.s<i>.noRed` (merged from main, DFL5): unit `^{\circ}` → `deg` (display only). KaTeX cannot render a superscript
  after the unit spacing, so tests/engine/tex.test.mjs failed on main after #476 and #478 crossed; no value changed.
- Tests: `tests/engine/framing.test.mjs`, `tests/engine/crossframes.test.mjs`, loader `tests/engine/pl-source.mjs` (Preliminary sizing's own code
  from pl-src in a Node vm). No new recording: the 20 `tests/projects/sbd2-fat` and 40 `tests/projects/sbd2-stiff` recordings have the framing
  inputs (Preliminary sizing projects from the seeds), the frame lists (P.df.bridge.xf), the per-girder layouts and P.cf / P.ts / P.bs.
### Saved data (CLAUDE.md §5)
- No new key. New optional project fields `framing` and `crossframes` in `sbd2.project.current` and the export file. A project saved without
  them reads unchanged until the Framing tab is drawn: the page then adds the defaults (as the other input tabs do), so its analysis gains
  the cross-frame point loads (GirderDetail XF1: on by default, engineer's decision 2026-10-13). Delete nothing; the entered `loadsManual.xf`
  is kept and used when the project has no framing.
### Governing provisions (AASHTO LRFD 10th Ed. (2024); all as GirderDetail / Preliminary sizing have them, none changed)
- Layout 6.7.4.2.1, C6.7.4.2.1; owner rule xf.orient (RIDOT BDM 6.4.3, CTDOT BRSDM V2 6.7.4.2).
- Wind 3.8.1.2.1 (Eq. 3.8.1.2.1-1), 4.6.2.7.1; γ_WS 1.0η (Table 3.4.1-1, 1.3.2.1). Stability bracing 6.7.4.2.2 (Eqs. 6.7.4.2.2-14, -15), C4.6.3.3.4.
- Members 6.9.4.4 (Eqs. 6.9.4.4-1, -2), 6.9.4.1.1, 6.9.4.1.2, 6.9.4.2.2, 6.8.2.1, Table 6.8.2.2-1, 6.8.3, 6.9.3, 6.8.4; bolts 6.13.2.7, 6.13.2.9,
  6.13.2.6, Table 6.13.2.6.6-1; fatigue 6.6.1.2, Table 3.4.1-1 (×0.65). Diaphragms 6.7.4.2, 6.10.8, 6.10.9.2, 6.13.2, 3.4.3.1. Owner OWN34–OWN37.
- f_ℓ from skew C6.10.1 (10 ksi interior, 7.5 ksi exterior, × 1.25). DC1 cross-frame weight: GirderDetail XF1/XF2 (490 pcf, +10 %).
### Check case (tests: hand checks)
- Built-in cross-frame (GM.cf.def: X, S = 114, h = 48 in, L5x5x3/8, F_y 36): A = 5(0.375) + 4.625(0.375) = 3.609375 in²; diagonal
  ℓ = √(114² + 48²) = 123.693 in; b/t = 13.333 > 0.45√(29,000/36) = 12.772 → Q = 1.34 − 0.76(13.333)√(36/29,000) = 0.98298; wind Strength III
  P_Z = 2.56e-6(130²)(1.3) = 0.0562432 ksf, W = 0.0562432(62.5/12)/2 = 0.146467 kip/ft, F_w = 3.6617 kip; Strength V F_w = 1.3867 kip; bolt shear
  2(0.80)(0.45)(0.6013)(120) = 51.952 kip; I_yc = 256, I_yt = 384 in⁴, h_o = 60.9375 in.
- One X-frame in DC1 (S = 9.5 ft): (114(2 × 3.609375) + 2(123.693)(3.609375))(0.2836/1000)(1.10) = 0.53528 kip, W/2 = 0.26764 kip per girder.
- Layout: built-in 110-140-110 ft at 15°, s = 25 ft: parallel, 4 / 5 / 4 frames per bay at 22 / 23.333 / 22 ft; largest L_b 23.334 ft
  (brace points rounded to 0.001 ft). Single 100 ft span, 4 girders at 10 ft, 35°: normal; T = 100 − 2(15)tan 35° = 78.994 ft; after Preliminary
  sizing's 8 passes e = max(3, 4(16/12), 0.4s) = 8.315 ft, s = (78.994 − 2(8.315))/3 = 20.788 ft. Skew f_ℓ at 45°: exterior 1.25(7.5) = 9.38 ksi,
  interior 12.5 ksi; ≤ 20°: 0.
- Before: none (new modules).
### How verified
- Preliminary sizing in Node (pl-src) = Preliminary sizing in the browser: the frame lists recorded in the 20 sbd2-fat projects (identical), and
  the bearings and cross-frame stations of every girder in the sbd2-stiff layouts (identical).
- `layout` = `framingLayout` on 1,320 layouts (the 20 recorded projects × 66 variations: skews 0° to 50°, unequal, negative; contiguous /
  staggered / stepped; automatic / normal / parallel; spacing; pier-region spacing; splice clearance; stagger minimum; 4 owners): 99,594 frames,
  2,666,613 values, largest difference 0. `modelOf` from an sbd2 project = Preliminary sizing on its own project (exact).
- `compute`/`checks` = `GM.cf.compute`/`GM.cf.checks` on 2,041 cases (60 recorded states × 34 variations + built-in: types, sizes, LLV and custom
  angles, bolts, user forces, fatigue, stability bracing on/off/not full, wind, primary, shallow girders, every diaphragm shape, end diaphragms with
  jacking): 793,205 values and 58,248 check items (ratio and status), largest relative difference 0.
- Weight: `xfModel`/`xfPts` = `gdXfModel`/`gdXfPts` on the recorded frame lists, 6 weight settings × cross-frame/diaphragm: 27,480 point loads
  identical. Analysis takes them (src 'module'); explicit girder loads still win; equilibrium within 1e-5 (SB2-X1).
- Flexure, shear, stiffener, fatigue and analysis parity tests unchanged and passing (they run `fromPayload` without framing, or explicit loads).
- `node tests/engine/run.mjs` (full suite); one headless load of `apps/steel-bridge/index.html`: Framing tab plan, Cross-frames tab, Analysis,
  Shear, Fatigue and Flexure tabs; 0 console errors; no horizontal scroll; only `sbd2.*` keys written.
### Other copies
- None. GirderDetail and Preliminary sizing keep their own functions until the switch-over. `lineOf` is repeated in engine/framing.js (also
  engine/analysis.js).
### Decisions (engineer's rule of 2026-10-29: decide by AASHTO 10th Ed. and accuracy, record the reasoning)
- SB2-O9 / SB2-O17 (closed). Brace points and cross-frame bays come from the framing whenever the project has one: Flexure (file of this
  bridge: same supports; the file's girder), Shear & stiffeners and Fatigue (project, or a file of this bridge). A girder's own stations are mapped
  to the analysis stations proportionally within each span (Preliminary sizing's toX), and the unbraced length is the girder's own (lenOf),
  as Preliminary sizing's row builder; exact where the girder's span equals the analysis span (equal skews at both ends of a span). A file of
  another bridge keeps the evenly spaced points (reported on the tab).
- SB2-A6 (cross-frame part, closed). Cross-frame weights go into DC1 as GirderDetail XF1: the plate girder's cross-section line, W/2 per frame
  per girder at its own stations, on the steel section. The pedestrian load and the construction live load from a module stay open (SB2-A6).
- SB2-O11 (decided). f_ℓ comes from skew in lieu of a refined analysis (C6.10.1), as Preliminary sizing sends it: 1.25 × (10 ksi interior,
  7.5 ksi exterior) where any support is skewed more than 20°; the same value at Service II (GirderDetail). Kept: the C6.10.1 values are one
  unfactored total with no split by load; Service II factors are 1.0 on DC and 1.3 on LL, so the composite factor lies between 1.0 and 1.3 and
  1.25 is not materially conservative. GirderDetail derives no f_ℓ from wind (its flexure is Strength I only), so none is fed. The top-flange
  f_ℓ of a noncomposite girder (wind, overhang brackets) stays an input.
- SB2-O13 (decided, scope). Per-flange C_b: the bottom flange in negative regions from the Strength I envelope over the framing's unbraced
  segment (unchanged); the top flange of a noncomposite girder in positive regions keeps C_b = 1.0 (permitted by 6.10.8.2.3, conservative).
  The both-flange LTB of a monosymmetric noncomposite section in reverse curvature stays with the flexure module (not changed here).
- SB2-C1. The stability-bracing span is the span of the largest 1.25M_DC1 + 1.5M_CL of this plate girder's analysis (Preliminary sizing: the
  interior girder type's envelope). Kept: the girder being designed; for the interior girder it is the same quantity.
### Open items
- SB2-X1. `shared/moving-load.js` staticAnalysis meshes a point load within ~0.01 ft of a station as a very short element; the solve then
  loses up to ~1e-4 of that load in ΣR (28° skew built-in: a frame at 217.994 ft next to the 218 ft station; ΣR short by 0.75 lb of 102.66 kip,
  the Analysis tab's DC1 equilibrium step then shows "not met"). Not changed here (shared file); suggested fix: merge a point load within
  1e-3 × h of a mesh node into that node. Closed 2026-10-29 (sb2-x1-pointload, fixlog/shared-moving-load.md): a point load within
  0.05 h_max of a node is applied inside its element with exact fixed-end forces; ΣR now within round-off (28° built-in: 2.4e-9).
- SB2-X2. Not ported: Preliminary sizing's framing checks (`framingChecks`: X1–X4 and the owner skew warnings), Suggest's cross-frame
  auto-design, the cross-frame/diaphragm drawings and DXF. The layout records the splice conflicts it could not clear (Cross-frames tab).

## 2026-10-29 — PR: sb2-o23-skew-abs — negative support skews enter the LLDF as |θ| (SB2-O23 closed; engineer's decision 2026-10-29)
### Where
- `engine/lldf.js` `momentSkew(rg, skews)`: before `thMin = Math.min(skA, skB), thMax = Math.max(skA, skB)` … `thM: noRed ? 0 : Math.max(0, thMin),
  thV: Math.max(0, thMax)`; after `thMin = Math.min(Math.abs(skA), Math.abs(skB)), thMax = Math.max(Math.abs(skA), Math.abs(skB))` …
  `thM: noRed ? 0 : thMin, thV: thMax`. `compute`: the region `pp.skewM` / `skewV` (not used by the factors) = `ms.thMin` / `ms.thV`.
  Header and `momentSkew` comments updated. The 10° rule (`SharedLLDF.momentSkewNoReduction` / `…Pier`, `dTh`) still compares the signed
  skews. `shared/lldf.js` unchanged (its `skewFactors` already reads |θ|); lldf.html bit-identical (tests/engine/lldf-hash.mjs: 1,592 cases, 0 differ).
- GirderDetail: the same change (DFL6, fixlog/Steel Bridge Design.md), so the parity stays exact.
### Decision and reasoning (engineer, 2026-10-29)
- Tables 4.6.2.2.2e-1 / 4.6.2.2.3c-1 (AASHTO LRFD 10th Ed.) use the skew angle θ; the sign is only the direction, so θ = |θ|. Reading a
  negative skew as 0 dropped the shear correction (unconservative). The 4.6.2.2.2e "differ by more than 10°" test is the angle between the
  two support lines, so it keeps the signed difference (−35° / +35°: 70°).
### Check case
- Built-in bridge, support skews −30° at every line, span 1, G2 (S 9.5 ft, L 110 ft, t_s 8 in, K_g 869,918.955 in⁴): r_V 1.0 → 1.107048,
  g_V 0.9180 → 1.0163; c₁ 0 → 0.078255, r_M 1.0 → 0.965670, g_M 0.7034 → 0.6792 (arithmetic in `tests/engine/loads.test.mjs`, test
  "hand check SB2-O23").
### How verified
- `tests/engine/loads.test.mjs`: three new variations (−30° everywhere; −40/−45/−38/−65°; −35/35/35/−35° for the signed 10° rule):
  20 recorded inputs + 31 variations, 35,105 values, 0 differ from GirderDetail (patched) in the same Node run.
- `node tests/engine/run.mjs`: all pass. One headless load of apps/steel-bridge/index.html: 0 console errors.
### Saved data
- None (skews stored signed as before).
### Open items
- SB2-O23 closed.


## 2026-10-29 — PR: sbd2-splices — bolted field splices, AASHTO LRFD 10th Ed. 6.13.6.1 (engine/splices.js, Splices and Field splices tabs)
### Where
- New `apps/steel-bridge/engine/splices.js` (`window.SBDSplices`), ported operation for operation from GirderDetail's Field splice module
  (`Steel Bridge Design.html`, `MODS.splice`): `gdCompute` (anchor `function gdCompute(P) {`), `gdChecks` (`function gdChecks(R) {`),
  `spCtNarrow`, `autoDesignSplice`, `fitSplice`, `spStdT`, `spNextT`, with GirderDetail's `GD_GR`, `BOLT`, `FUB`, `PHI`, `GD_DEFAULT`
  (splice parts), `steelProps`, `addPart`, `modRatio`, `A610_shearC`, `A610_Vp`, `secEff`; the owner helpers `gdLF`, `gdOwnM(OWN_K.splice)`,
  `gdPLq`, `gdUt`, `gdHP`, `gdOwnR('spl.ovs')` become `env` (owner, lf, rule, cite, minPlate). Preliminary sizing's `spliceExport`
  (`function spliceExport(P, m, AN) {`) becomes `demandsAt` + `sectionAt` + `inputsAt`. TeX `work` lines replaced by SharedSteps
  (`checks()` items each carry a step `sp.<check>.<k>`; `steps(R)` works the section, combinations, V_r, P_fy, M_r, bolt and plate
  resistances, the web bolt group).
- New `apps/steel-bridge/ui/splices.js` (`window.SBDSplicesUI`): the Splices input tab and the Field splices output tab.
- `engine/model.js`: optional `splices` field (header, `defaultSplices()`, `validate`). The stations are `framing.splices` (the framing PR's
  field, one list for both modules; the Splices tab edits the same list). Absent in a saved project = `defaultSplices()`. No key or saved format changed.
- `apps/steel-bridge/index.html`: two script tags, the Splices input tab, the Field splices output tab, the change / click hooks, the
  error-tab mapping (`splices.*` → Splices) and `splices.auto` in the redraw list.
- New `tests/engine/splices.test.mjs`.
### Problem
- New module (docs/REBUILD_PLAN.md §5, Details: splices).
### Governing provision
- AASHTO LRFD 10th Ed. (2024): 6.13.6.1.1 (smaller section), 6.13.6.1.3 (10th Ed. design forces: P_fy = F_yf A_e, Eq. 6.13.6.1.3b-1, -2;
  the flange couple M_r and H_w, C6.13.6.1.3b; V_r = φ_vV_n, 6.13.6.1.3c), 6.13.6.1.4 (8th Ed. method kept as an option), 6.13.6.1.5
  (fillers), 6.13.2.7 (shear), 6.13.2.8 (slip), 6.13.2.9 (bearing and tearout), 6.13.2.6 (spacing, edge and end distances, sealing,
  stitch bolts), 6.13.4 (block shear), 6.13.5.2, 6.13.5.3, 6.8.2/6.8.3 (plates, A_n ≤ 0.85A_g, holes + 1/16 in), 6.6.1.2 (Category B
  fatigue), 6.7.3 (minimum plate), 6.10.9 (web V_n). Owner: CTDOT BRSDM V2 6.13.6.1 (spl.ovs), the load rules OWN6–OWN8, OWN14 def.minPlate.
- No formula, factor, unit or reference differs from GirderDetail (parity below).
### Check case (hand, in tests/engine/splices.test.mjs)
- GirderDetail's built-in splice (left 16 × 3/4, 60 × 9/16, 16 × 1 1/8; right 18 × 1, 18 × 1 1/4; 7/8 in A325, 50W):
  top P_fy = 50 × (0.80 × 70)/(0.95 × 50) × [12.0 − 4(15/16 + 1/16)(0.75)] = 50 × 1.17895 × 9.0 = 530.53 kip; bottom 795.79 kip;
  φ_sR_n = 0.80(0.56)(0.6013)(120)(2) = 64.652 kip; filler 1/4 in: γ = 4.0/12.0, R = 0.800; TF1 left 530.53/(12 × 64.652 × 0.8) = 0.8548;
  M_u (Strength I neg.) = 1.25(−120) + 1.25(−30) + 1.50(−35) + 1.75(−1,250) = −2,427.5 kip-ft; M_r = 530.53 × 60.9375/12 = 2,694.08 kip-ft
  (MT1 0.9011); V_r = 0.40017 × 978.75 = 391.66 kip; I_p = 7,420.5 in², e = 3.5 in, R_u = 12.602 kip, WS1 = 0.1949.
### How verified
- Parity with GirderDetail's own functions in Node (gd-source.mjs pattern, `node tests/engine/run.mjs splices`): built-in splice × 4 owners
  × 10th/8th Ed. × P_rs, plus a variant (utilities, pedestrian part with m, fatigue, stiffened web, threads included, Class A, punched,
  eccentricity settings, no inner plates, one web column); the auto-design of the built-in splice per owner; all 400 field splices of the 100
  `tests/projects/st/gd_*.json` payloads (inputs built from the payloads as spliceExport builds them): checks with GirderDetail's built-in
  plates (400), auto-design and checks of the designed splice (every third payload, 136 splices), 8th Ed. (every fifth payload).
  Every value of GirderDetail's result object, every check status and governing item, every item's ratio and status, and the designed
  plates: 0 differences (largest relative difference 0). No browser recording was needed: the payloads hold every splice input.
- App path (engine/analysis.js → girder()): demands at the splice vs the payload's: moments within 0.1 % of the largest moment at the
  splice, shears within 1.3 % (the analysis' consistent loads vs GirderDetail's lumped loads, SB2-A3; the payload's pedestrian load
  taken out, as analysis.test.mjs).
- Headless load of apps/steel-bridge/index.html: Field splices tab calculated (4 splices, auto-designed, all OK), drawing, 187 worked steps,
  0 KaTeX errors, Keep these plates → Splices tab entered plates, 0 console errors.
### Other copies
- None. GirderDetail keeps its own splice module until the switch-over.
### Decisions (made here, per the engineer's rule of 2026-10-29)
- SB2-SP1. Deck reinforcement: GirderDetail's splice module keeps its own default A_r = 9.3 in² at d_r = 4 in (spliceExport does not send
  them); the new app uses the project's deck rebar (top + bottom layers, at their centroid). Accuracy; it changes P_rs (when included)
  and the steel + reinforcement section of the negative-moment stresses only.
- SB2-SP2. Web shear basis: GirderDetail's module keeps "unstiffened" unless the user changes it; the new app takes the stiffener panel at
  the splice (Stiffeners tab layout): stiffened with its d_o, unstiffened where none. V_r = φ_vV_n of the actual web (6.13.6.1.3c),
  not the smaller unstiffened value (which understates the web bolt demand).
- SB2-SP3. Splice plate grade: GirderDetail keeps 50W; the new app defaults to the top flange grade (setting on the Splices tab).
- SB2-SP4. R_h: the hybrid factor of the smaller steel section (engine/sections.js; 1.0 when homogeneous) instead of GirderDetail's
  entered 1.0 (only differs for hybrid girders).
- SB2-SP5. Element shear at the splice: the larger magnitude of the element's two ends (the shared engine applies distributed loads
  exactly; GirderDetail's lumped loads give one shear per element), then GirderDetail's rule (the element and its neighbours).
- SB2-SP6. Minimum plate of the auto-design: the owner's OWN14 def.minPlate (RIDOT 7/16, CTDOT 1/2 in), else 3/8 in (GirderDetail STD_DEF).
- The module takes one flange grade (the top flange's) and one web depth (the left side's), as GirderDetail; a warning shows where the
  project differs.
### Open items
- SB2-SP7. CTDOT: every splice of the CTDOT payloads (16 in flanges) fails DT10 in both apps: the 2 in edge distance and 1/2 in plates
  of BRSDM V2 6.13.6.1 need a wider flange for 2 gage lines each side of the web (GirderDetail's GD62 note says so on the splice).
- SB2-SP8. GirderDetail's user manual (Part 7, "Built-in example") quotes P_fy top = 541.6 kip (net area with d_h only); its code, and
  this port, use d_h + 1/16 in (6.8.3): 530.53 kip. Manual text only; not changed here (old file).
- Not ported (GirderDetail UI aids): "Suggest splice" (location from contraflexure and bolt-size cost comparison), the locks of the
  auto-design, the DXF and 3D views of the splice.

## 2026-10-29 — PR: sbd2-rating — load rating, LRFR design-load (HL-93) Inventory and Operating (engine/rating.js, Rating tab; new files)
### Where
- `engine/rating.js` (new, `window.SBDRating`): ST-Girder's rating method (`Steel Bridge Design.html`, st-src block, `computeAll`, anchor
  `/* ---------- Load rating (LRFR, MBE) — station-based ---------- */` to `rating.govOpr=`, and `function RatingTab(`) with GirderDetail's GS20
  owner targets (anchor `function gsRateCheck(`, `const gdRateRule =`). Functions: `factors`, `phi`, `rf`, `flexure`, `service`, `shear`,
  `shearCases`, `noDoublePL`, `fatigue`, `target`, `girder`. Worked steps `rt.*` (φ_cφ_s, R_n with a link to the capacity's own step, C, DC, DW,
  LL+IM, f_ℓ term, RF Inventory, RF Operating).
- `ui/rating.js` (new, `window.SBDRatingUI`): the Rating tab: φ_c and φ_s inputs (MBE Tables 6A.4.2.3-1, 6A.4.2.4-1; saved), demands from this
  app's analysis (default) or a hand-off file, governing Inventory / Operating RF, owner target, the governing row of each group, every location,
  worked steps of the selected row followed by the flexure or shear work of that location (where R_n is worked). Capacities: `SBDFlexure.fromPayload`
  + `girder` (the Flexure tab's locations) and `SBDShearUI.build` (the Shear tab's stations, V_n with the stiffener layout).
- `engine/model.js`: `defaultRating()`, header comment, validation of `rating.phiC`, `rating.phiS` (0 < φ ≤ 1.0). `index.html`: two script tags,
  the Rating tab button, one dispatch line.
- `tests/engine/st-source.mjs` (new): ST-Girder's engine in Node (st-src babel script compiled with tests/libs Babel 7.23.5, React/DOM stubbed;
  its own `gdCheck`/`gdAdopt` text applies a payload to DEFAULTS; `stSpan` = its "Span n" button; GirderDetail's `loadShedRbG`, `webFcrw` as the
  host page, S2-2). Rating trace: additions after five statements of the rating section record ST-Girder's C, DC, DW, LL+IM; nothing computed changes.
### Saved data (CLAUDE.md §5)
- No new key. New optional project field `rating: { phiC, phiS }` (absent = 1.0, 1.0, ST-Girder's defaults), in `sbd2.project.current` and the
  export file. Old projects read unchanged.
### Governing provisions (AASHTO MBE 3rd Ed. (2018), Section 6A; resistances AASHTO LRFD 10th Ed. (2024)) — new behaviour in this app
- RF = (C − γ_DC DC − γ_DW DW ± γ_P P)/(γ_LL (LL+IM)), Eq. 6A.4.2.1-1; C = φ_cφ_sφR_n, Eq. 6A.4.2.1-2; φ_cφ_s ≥ 0.85, Eq. 6A.4.2.1-3 (Strength only).
- Table 6A.4.2.2-1, design-load rating: Strength I γ_DC 1.25, γ_DW 1.50, γ_LL 1.75 Inventory / 1.35 Operating; Service II γ_D 1.00, γ_LL 1.30 / 1.00.
- Service II, 6A.6.4.2.2 (Eq. 6A.6.4.2.2-1): f_R = 0.95R_hF_yf composite (Eqs. 6.10.4.2.2-1, -2), 0.80R_hF_yf noncomposite (-3); web f_c ≤ F_crw (-4).
- R_n: M_n 6.10.7.1.2 (with 1.3R_hM_y), F_nc = R_bR_hF_yc 6.10.7.2.2, F_nc 6.10.8.2.2/6.10.8.2.3 (incl. 6.10.8.2.3c), F_nt 6.10.8.3, App. A6 M_nc / R_ptM_yt,
  V_n 6.10.9 (tension field, V_cr in end panels), F_crw 6.10.1.9.1; φ_f = φ_v = 1.0 (6.5.4.2). No owner η or design load multiplier (GS20).
- ST-Girder does not state its MBE edition ("verify" in its references). The 3rd Ed. is cited; the article, table and equation numbers used are the
  same in the 2nd Ed.
### Check case (tests/engine/rating.test.mjs, arithmetic in the comments)
- Flexure, payload gd_builtin28_AASHTO_G1, x = 44 ft, compact: C = 1.3(1.0)(7,468.216) = 9,708.680 kip-ft; DC 1,101.171, DW 159.930, LL+IM 2,092.218;
  RF_inv = (9,708.680 − 1,376.464 − 239.895)/(1.75 × 2,092.218) = 8,092.322/3,661.382 = 2.2102; RF_op = 8,092.322/2,824.494 = 2.8651 (ST-Girder 2.2102 / 2.8651).
  φ_c 0.95, φ_s 0.85 → 0.8075 < 0.85 → 0.85: C = 8,252.378, RF_inv = 6,636.019/3,661.382 = 1.8124.
- Shear, same payload, x = 109.99 ft (station 109.999; 110.001 is across the pier): V_n = 903.547 kip; DC 81.520 + 23.868, DW 14.521, LL+IM 122.355;
  RF_inv = (903.547 − 131.735 − 21.782)/214.121 = 750.030/214.121 = 3.5028; RF_op = 750.030/165.179 = 4.5407 (ST-Girder 3.5028 / 4.5407).
- Service II: f_R 47.5, f_DC 12.905, f_DW 1.6665, f_LL 12.0274 ksi: RF_inv = 32.9285/15.63562 = 2.1060, RF_op = 2.7378 (ST-Girder 2.106 / 2.7378).
- Before: none in this app.
### How verified
- Formula and factors: ST-Girder run in Node on the 100 tests/projects/st/gd_*.json payloads, every span (300 sessions), plus φ_c/φ_s variations
  (0.95 × 0.85 floor, 0.95, 0.85) and two noncompact variants (ST-Girder's stress basis); every rating ST-Girder computes (flexure moment and stress
  basis, pier negative flexure, shear at every station, Service II both flanges and LL signs) recomputed by `SBDRating.rf` from ST-Girder's own
  C, DC, DW, LL+IM: all equal within 1e-9 relative (the count is printed by the test); its reported governing values equal.
- Full path (this app's capacities, the same payloads, 300 spans): RF this app / ST-Girder, min · 10 % · median · 90 % · max:
  positive flexure 0.9999 · 0.9999 · 1.0000 · 1.0000 · 1.0000; negative flexure 1.0193 · 1.0211 · 1.0268 · 1.0661 · 1.0722; shear 1.0000 (all);
  Service II 1.0005 · 1.0005 · 1.0005 · 1.0006 · 1.0007; governing Inventory and Operating = negative flexure. No RF crosses 1.0.
  Causes: negative flexure, the unified F_nc (6.10.8.2.3c nonprismatic unbraced length, γ_e; C 1.2 % to 3.7 % higher than ST-Girder's F_nc of the pier
  section), LL+IM at 0.01 ft from the pier (−0.03 %); Service II and positive flexure, the location 0.01 ft inside the support / moments interpolated
  (GirderDetail's Check at any location); shear identical: ST-Girder already has GirderDetail's V_n (S2-4, #455), so the +18–22 % expected from the
  tension field does not appear against today's ST-Girder.
- Built-in project, this app's analysis: Inventory 0.752 / Operating 0.975 in the Node test (its engine files), 0.74 / 0.96 on the page after the
  merge of #479 (framing, loaded by the page); 6.10.8 compression flange at the piers; see SB2-R2.
- Headless load of apps/steel-bridge/index.html: Rating tab, Calculate, a shear row, φ_c changed (saved, results stale, recalculated): 0 console errors.
### Other copies
- None. ST-Girder and GirderDetail keep their own ratings until the switch-over.
### Decisions (made here, per the engineer's rule of 2026-10-29; accuracy, not over-conservatism)
- Every location of the whole girder is rated (ST-Girder: the selected span; its negative flexure at one station, the largest −M_u).
- Negative flexure (and noncomposite) by the method in use: App. A6 on the moment basis (M_nc, R_ptM_yt) where it is used, else 6.10.8 on the stress
  basis, both flanges (ST-Girder: the bottom flange, 6.10.8 only). Positive noncompact: both flanges (as ST-Girder).
- Service II: both flanges and, where 6.10.4.2.2 requires it, the web (f_c ≤ F_crw; GS20 includes GS13). F_crw depends on the load through D_c: the RF
  is the load factor at which f_c = F_crw (bisection), as GS20's quadratic.
- f_ℓ (as the design checks): f_ℓS_x/3 (moment basis), f_ℓ/3 (stress basis; the amplified value of the compression flange), f_ℓ/2 at Service II,
  constant (not scaled with the live load). With f_ℓ = 0 the term is 0 even where the amplification is unbounded (see SB2-R2).
- γ_DC = 1.25, γ_DW = 1.50 on the dead loads as they act, one factor (Table 6A.4.2.2-1, as ST-Girder). Utilities (MassDOT): UF with DC, UT with DW
  where they add (no relief; ST-Girder GD54c default).
- Shear by direction: at each location the stations on the same side of every support, each direction of shear with the dead loads as they act in
  it (a relieving one taken as 0) and the LL+IM envelope of that direction; the lowest RF governs. (ST-Girder: |V_DC| with the larger LL+IM
  magnitude; same governing RF on all 300 spans.)
- φ_cφ_s on flexure and shear at the Strength limit state, not at Service II (as ST-Girder).
- Pedestrian load: with `pedestrianInLL: true` the hand-off's LL+IM already includes it (HANDOFF.md §4.9); the rating does not add M_PL / V_PL again.
- No legal or permit vehicles (ST-Girder has none); the owner's pending vehicle rows are listed as not rated. Fatigue RF = 1/(GS17 ratio) only for
  an owner fatigue target (GS20).
### Open items (need the engineer)
- SB2-R1. engine/flexure.js and engine/shear.js `fromPayload` (and the Shear demands) add M_PL / V_PL to M_LL / V_LL even when the hand-off has
  `pedestrianInLL: true`: the pedestrian load is counted twice on the Flexure, Shear and Fatigue tabs with a hand-off file (18 of the 100 payloads,
  the xsA project; e.g. gd_xsA_CTDOT_G1 at the pier: M_LL+IM −2,511.3 instead of −2,278.5 kip-ft). The rating avoids it (`noDoublePL`). Not changed here.
- SB2-R2. GS7 is not reported (ratio NaN) where f_bu ≥ F_cr with f_ℓ = 0: `ampFl` gives 0 × ∞. Same arithmetic in GirderDetail (`function ampFl(`,
  and `r.AF = r.ampReq ? …`). Built-in project with this app's analysis: 10 pier locations with f_bu up to 39.67 > F_nc 34.97 ksi (ratio 1.134) show
  no GS7, and the Flexure governing ratio is 0.973 elsewhere; the rating shows RF_inv 0.752 there. Not changed here (§4).

## 2026-10-29 — PR: sbd2-cleanup-decisions — engineer's and lead's decisions on open items (SB2-A2, A4, A5, A7, O12, O14, F1, O16, C1, C2)
All ten items were decided by the engineer or the lead (2026-10-29); this PR implements them. Each one below: where, before / after,
provision, check case. Closes SB2-A2, SB2-A4, SB2-A5, SB2-A7, SB2-O12, SB2-O14, SB2-F1, SB2-O16, SB2-C1, SB2-C2.

### SB2-A2. Girder steel at 490/144 = 3.4028 lb/ft per in² (calculation change)
- Where: `engine/loads.js` anchor `const STEEL_PLF =` (`steelWeight` uses it; its step `dl.steel.w<k>` now shows 3.4028);
  `engine/analysis.js` anchor `const STEEL_PLF =` and in `analyzeGirder` anchor `const allow = LD.steelAllowPct, plf =` (step `an.wst<i>`).
- Before: `const STEEL_PLF = 3.4;` (GirderDetail SA_PLF). After: `const STEEL_PLF = 490 / 144;` (3.402778).
  `analyzeGirder(P, gi, { steelPlf })` (new, tests only): another value, GirderDetail's 3.4 for the parity tests. Result field `R.plf`.
- Why: Table 3.5.1-1 steel 0.490 kcf; 490 pcf / 144 in²/ft² = 3.4028 lb/ft per in² exactly; 3.4 was GirderDetail's rounding (0.08 % low).
- Governing provision: AASHTO LRFD 10th Ed. Table 3.5.1-1 (DC, 3.5.1).
- Check case: (1) steel I 16 × 1 / 60 × 1/2 / 16 × 1, A = 62 in², allowance 0, two spans 100 ft: w = 62(3.4)/1000 = 0.2108 → 62(490/144)/1000 = 0.210972 klf;
  M_pier = −wL²/8 = −263.50 → −263.715 kip-ft; R_B = 1.25wL = 26.350 → 26.372 kips; Δ(L/2) = wL⁴/(192EI) = 0.168743 → 0.168875 in. (2) The app's default project,
  segment 1 A = 63.75 in², allowance 5 %: w = 63.75(3.4)(1.05)/1000 = 0.2275875 → 63.75(3.402778)(1.05)/1000 = 0.2277734 klf; M_DC1 at pier 1
  −2498.49 → −2498.84 kip-ft (+0.014 %; its girder-steel part −425.146 → −425.494, +0.0817 %); largest span 1 M_DC1 1052.61 → 1052.75 (+0.014 %).
  DC1 rises by 0.0817 % of its girder-steel part; DC1 as a whole by less (0.014–0.018 %), since the wet deck is most of it.
- Tests (expect this difference and nothing else): the parity runs with GirderDetail pass `steelPlf: 3.4` (unchanged results); new test
  "SB2-A2" in analysis.test.mjs: on the 10 sample payloads the girder-steel part of DC1 (M, V, R, deflection) × 490/144/3.4 = 1.000817
  exactly (residual 9.5e-10), the wet deck, DC2, DW, construction LL and the pier regions identical; largest M_DC1 rise 0.0175 %.
  loads.test.mjs: the payload's steel w_min, w_max, average × 490/144/3.4. constructibility.test.mjs (SB2-A1 test): `steelPlf: 3.4`.

### SB2-A4. LL deflection: truck axles that do not add are neglected (GirderDetail LL8)
- Where: `engine/analysis.js` `analyzeGirder`, anchor `const DL = ML().deflection(RH, { mode: 'lrfd', DF: 1, useIM: true, neglect: true })`;
  `shared/moving-load.js` `deflection()` (new option `opt.neglect`, off by default; see fixlog/shared-moving-load.md).
- Before: `ML().deflection(RH, { mode: 'lrfd', DF: 1, useIM: true })` (every axle on the bridge summed). After: `neglect: true`: the downward
  value sums only the downward axle effects (GirderDetail sgLLRow: P = positive ordinates only, used by its lld rows, LL8 2026-10-14).
- Governing provision: AASHTO LRFD 10th Ed. Art. 3.6.1.3.1 (axles that do not contribute to the extreme force effect neglected), 3.6.1.3.2, 2.5.2.6.2.
- Check case: three spans 20 + 20 + 20 ft, HL-93 truck per lane with IM 33 %: largest downward Δ 0.00301 → 0.00305 in; 22 of 61 sections larger
  (tests/engine/moving-load.test.mjs). On the 100 gd_* payloads (spans 60 ft and longer) no span changes (a truck can stand with every axle
  adding); the remaining LL-deflection difference to GirderDetail, ≤ 0.11 %, is the stations read (the 1/20 points here, every second node
  there). Not more conservative or less: larger or equal deflection.

### SB2-A5. Owner live load deflection limits (OWN19)
- Where: `engine/analysis.js` new `deflOwner(P, g, S)` (exported) and `analyzeGirder` anchor `const status = OW && OW.rep ? 'na'`; steps
  `an.defl.lim<k>` (cites the owner), new `an.defl.pref<k>`; `ui/analysis.js` LL deflection card (owner, limit, preferred limit, status).
- Before: limit L/`analysis.deflLimit` (default 800) for every owner. After (as GirderDetail SA3 / Preliminary sizing A1): RIDOT BDM 2.4.2.6
  L/800, L/1000 with pedestrians; MassDOT 3.5.6.1 L/1000 with sidewalks, without them L/800 and preferably L/1000 (exceeding the preferred
  limit is a warning), applied to the typical interior beam only (a plate girder that takes an exterior cross-section girder is reported,
  not checked: status 'na'). Sidewalk or pedestrians: a sidewalk on the Cross-section & loads tab (xs.sidewalks.L/R.w > 0). The entered
  L/… governs where stricter (rq = max(owner, entered)). AASHTO, CTDOT: the entered L/… (2.5.2.6.2, optional), unchanged.
- Decision (engineer's rule): the sidewalk test is the cross-section's, as GirderDetail's default 'auto'; GirderDetail's Limits-tab override
  (swOwn) has no input here yet.
- Governing provision: AASHTO LRFD 10th Ed. Art. 2.5.2.6.2; RIDOT BDM 2.4.2.6; MassDOT LRFD Bridge Manual Part I 3.5.6.1 (engine/owners.js 'defl.ll').
- Check case: default project (interior plate girder, cross-section G2): MassDOT, no sidewalk: L/800, preferred L/1000; span 1 (110 ft)
  Δ_lim = 12(110)/800 = 1.650 in, preferred 12(110)/1000 = 1.320 in. Sidewalk 6 ft: L/1000 = 1.320 in (MassDOT and RIDOT). Entered L/1200: RIDOT
  uses 1200. g.line = 0 (exterior) under MassDOT: reported only. Payloads gd_builtin_MassDOT_G1 / G2, gd_builtin_RIDOT_G1: status per span
  na / pass / pass, limit 1.65 in, = GirderDetail's stored SA3 status and limit.

### SB2-A7. Selector: the cross-section girder each plate girder takes its loads from
- Where: `index.html` Girders & plates tab, anchor `const lineSel = g =>` (select `#i_line`, data-kind 'line'; change handler anchor
  `if (el.dataset.kind === 'line')`). The Analysis tab's own selector (ui/analysis.js `an_g_line`) is unchanged.
- Before: only on the Analysis tab. After: also on the Girders & plates tab, with "Automatic (G…)" = no `girders[i].line` (the defaults
  unchanged: engine/analysis.js `lineOf`, G1 for an exterior plate girder, else G2). Saved data: the existing optional field `girders[i].line`;
  "Automatic" deletes it. No calculation change.

### SB2-O12. Section properties card of a noncomposite girder: no deck, no rebar
- Where: `engine/sections.js` `card()`, anchor `const dk = comp ? deck : { ...deck, beff: 0, rebar: {} };`; `index.html` Section properties card
  (anchors `${c.comp ? row('Steel + rebar'`, `c.region === 'neg' && c.comp`, `!c.comp ? 'rh.s.Rh'`).
- Before: for composite = false the card computed and showed the steel + rebar section, negative M_p with the deck rebar, D_c and R_h of the
  steel + rebar section. After: the steel section only (as engine/flexure.js, which already passed rebar {}): no Steel + rebar row, M_p without
  rebar, D_c and R_h of the steel section; a note says so. card() returns `comp`.
- Governing provision: AASHTO LRFD 10th Ed. Art. 6.10.1.1.1a (noncomposite: the steel section alone). Display of the card only; flexure unchanged
  (flexure-nc.test.mjs passes unchanged: its card had rebar {} before).
- Check case: 18 × 1.5 / 60 × 9/16 / 18 × 2, deck 8 in, A_r 6.6 + 3.2 in², noncomposite: before negative M_p included 9.8 in² of rebar at F_yr 60;
  after M_p, y_p, D_cp, R_h, D_c = those of the steel section (A = 96.75 in²), equal to flexure's card (sections.test.mjs SB2-O12).

### SB2-O14. Citation: composite tension flange, App. A6 (text only)
- Where: `engine/flexure.js` checks, anchor `title: 'App. A6, tension flange (continuously braced by the deck), M_u ≤ φ_fR_ptM_yt'` and the step
  `a6t.ok` (composite branch).
- Before: `ref: Eq. A6.1.2-1, A6.4` / step `Eq. A6.1.2-1`, title "App. A6, tension flange". After: `Eq. A6.1.4-1, A6.4` / `Eq. A6.1.4-1`,
  "(continuously braced by the deck)". The check itself is unchanged: M_u ≤ φ_fR_ptM_yt (A6.1.4-1 is the same inequality without f_ℓ).
- Governing provision: AASHTO LRFD 10th Ed. App. A6.1.4 (continuously braced tension flanges) in place of A6.1.2 (discretely braced). The
  noncomposite path keeps A6.1.2-1 (discretely braced, with f_ℓ).
- Check case: stocky-web negative-flexure section (36 × 3/4 web, 18 × 1.5 / 18 × 2 flanges, composite): the a6t item and step cite A6.1.4-1;
  ratios unchanged (flexure parity test on the 100 payloads unchanged).

### SB2-F1. Studs: each girder's own b_eff by default
- Where: `engine/model.js` `defaultStuds()` anchor `beffMode: 'girder'`; `ui/fatigue.js` the b_eff selector (per girder listed first) and notes;
  `engine/studs.js` header. Engine defaults unchanged: `compute()` / `fromPayload()` without beffMode = bridge-wide (GirderDetail), for the parity tests.
- Before: `beffMode: 'bridge'` (one b_eff for every girder, the largest-fatigue-shear girder's; GirderDetail). After: `'girder'` for a new project.
  Saved data: a stored project keeps the value it has (an explicit 'bridge' stays 'bridge'; the option can be changed on the Fatigue & studs tab).
- Why: AASHTO LRFD 10th Ed. Art. 6.10.10.1.2 takes Q and I of the girder's own short-term composite section, 6.10.10.4.2 its own b_eff in P_1p (4.6.2.6).
- Check case (GirderDetail built-in project, AASHTO payloads; tests/engine/studs.test.mjs SB2-F1): interior G2–G4 b_eff 96 → 114 in, largest SC1
  ratio 0.8746 → 0.8915 (p_max up to 3.03 % lower); SC2 0.9938 unchanged (P_2p, the steel, governs); G1, G5 unchanged; no pass/fail change.
  The app's own default project (one interior girder, b_eff 114 in) is unchanged (its bridge-wide b_eff is also 114 in).

### SB2-O16. Bearing stiffeners take the analysis support reactions
- Where: `ui/shear.js` new `fromAnalysis(P, gi)` (exported) and source "This project's analysis (Analysis tab)" on the Shear & stiffeners tab;
  `build()` anchor `const rxn = pl && Array.isArray(pl.reactions)`; the bearing note.
- Before: only the example rows or a hand-off file; reactions DC/DW = the jump in shear, LL+IM = V_LL,pos(left) − V_LL,neg(right) (an upper bound).
  After: with the analysis source, R_DC1, R_DC2, R_DW (R_UT, R_UF) = the support reactions of engine/analysis.js (st.*.R[k]) and R_LL+IM = the
  reaction envelope g_V R_HL93 (llR[k].max, the larger g_V of the adjacent spans; step an.R.LL.k). The file path is unchanged (still the upper bound:
  the hand-off file has no reactions). The analysis stations go in as a hand-off-shaped object in the file's sign (MIDAS), two stations 0.005 ft
  either side of each interior support. The default source stays "Example".
- Governing provision: AASHTO LRFD 10th Ed. Art. 6.10.11.2 (bearing stiffeners), 3.4.1 (R_u = 1.25(R_DC1 + R_DC2) + 1.50R_DW + 1.75R_LL+IM), 3.6.1.3.1.
- Check case (the app's default project, interior G2 factors; tests/engine/stiffeners.test.mjs SB2-O16): pier 1 R_LL+IM 255.4 (shear sum) → 215.3 kip
  (reaction envelope; the upper bound was +18.6 %), R_u 786.3 → 716.2 kip; abutments 107.8 → 107.8 kip (one side only). DC reactions = the jump in
  shear to the 0.005 ft offset (< 2 %).

### SB2-C1. Worked step fx.Mu: parentheses (display only)
- Where: `engine/flexure.js`, new `const pp = x => \`(${n2(x)})\`` next to `const pa =`; steps `fx.Mu` and the products in `fx.Ms`.
- Before: `${n2(r.gm.DC1)}${pa(r.MDC1)}` → "1.251450.00" for a positive moment. After: `${n2(r.gm.DC1)}${pp(r.MDC1)}` → "1.25(1450.00)". Values unchanged.
- Check case: Span 1 (M_DC1 1450, M_DC2 210, M_DW 240, M_LL 1650): "1.25(1450.00) + 1.25(210.00) + 1.50(240.00) + 1.75(1650.00) = 5322.5 kip-ft".

### SB2-C2. "Fill from cross-section" for the overhang bracket inputs (GirderDetail XS11)
- Where: `engine/constructibility.js` new `ohFill(P, gi)` (steps `oh.fill.*`); `ui/constructibility.js` button `#cn_oh_fill` (confirmation, never automatic).
- What it fills: w_OH = 12·overhang − b_tf/2 (in, to 0.01; the larger overhang, left when equal; b_tf the narrowest top flange of the girder),
  t_OH = the total deck thickness, w_c = the deck concrete unit weight. The other bracket inputs stay.
- Decision (engineer's rule, accuracy): t_OH = the total deck thickness (deck.tdeck: slab + integral wearing surface, all placed on the brackets)
  where GirderDetail fills t_s (its bridge data has no wearing thickness); the loads module also weighs the deck at t_s + t_sac.
- Governing provision: AASHTO LRFD 10th Ed. C6.10.3.4 (overhang bracket loads); Table 3.5.1-1 (w_c).
- Check case: default project: overhang 3.25 ft, top flange 16 in: w_OH = 12(3.25) − 16/2 = 31.00 in; t_OH = 8.5 in; w_c = 0.150 kcf. Right overhang
  3.6 ft: 12(3.6) − 8 = 35.20 in. Saved data: writes the existing optional field `constr.oh` only when the button is confirmed.

### Saved data (CLAUDE.md §5)
- No key or format changed. New project defaults only: `studs.beffMode` 'girder' (SB2-F1). `girders[i].line` (existing field) can now also be
  set on the Girders & plates tab; `constr.oh` (existing) can be filled by the button.
### How verified
- `node tests/engine/run.mjs` (full suite). New or changed tests: analysis (hand check 1 at 490/144, SB2-A2 difference test, SB2-A5), loads (steel × 1.000817),
  constructibility (SB2-A1 test at GirderDetail's 3.4, SB2-C2), moving-load (deflection neglect), sections (SB2-O12), flexure (SB2-C1, SB2-O14),
  fatigue and studs (SB2-F1), stiffeners (SB2-O16). Flexure and flexure-nc GirderDetail parity unchanged.
- Headless load of apps/steel-bridge/index.html: 0 console errors (see the PR).
### Other copies
- `shared/moving-load.js` `deflection()` option: see fixlog/shared-moving-load.md. The old `Steel Bridge Design.html` is unchanged.
### Open items
- SB2-A8. LL deflection stations: the shared `deflection()` reads the 1/20 points of each span, GirderDetail every second analysis node; ≤ 0.11 %
  (here lower). Denser stations would need an option in shared/moving-load.js.
- SB2-A9. OWN19 sidewalk test: GirderDetail's Limits-tab override (sidewalk yes/no, Preliminary sizing `limits.sidewalk`) has no input here; the
  cross-section's sidewalks decide.

## 2026-10-30 — PR: sb2-r2-r1-app — SB2-R2 (6.10.1.6 amplification with f_bu ≥ F_cr; NaN guard in every module) and SB2-R1 (pedestrian load counted twice) closed
### Where
- `engine/flexure.js`
  - `function ampFl(`: before `fl: fl * AF`; after `fl: fl === 0 ? 0 : fl * AF`, plus `und: AF === Infinity && fl !== 0`.
  - New `AMP_NG`, `guard(c)`, `gr(c)`, `govern(checks)` (exported). `location()` before:
    `r.checks.filter(c => c.inUse && isFinite(c.ratio))` reduced by `c.ratio >`. After: `r.checks.forEach(guard); r.gov = govern(r.checks)`.
  - The same change in `girder()` (PNA-OOS rows). The girder governing row is now compared with `gr`.
  - GS7, GS9 a6c and GS10 (composite negative; noncomposite compression flange via `flLims` `und`) carry `ng: AMP_NG` when the
    amplification is undefined.
  - `fromPayload`: `M_PLpos` / `M_PLneg` are added to `M_LL…` only when `pl.pedestrianInLL !== true` (anchor `const PL = k =>`).
- `engine/shear.js`
  - `demands()`: `V_PLpos` / `V_PLneg` are added only when `pedestrianInLL !== true` (anchor `plIn = pl.pedestrianInLL === true`).
  - `location()`: a non-finite ratio (not n/a) gets `ok = false`, `ng` and governs. Before, it was dropped by `isFinite`.
  - The panel `gov` ranks NaN/∞ first.
- `engine/constructibility.js`
  - GS14 yield/buckling get `ng: AMP_NG` when `r.amC.und`.
  - `overhang()`: `c.fl = c.fl1 === 0 ? 0 : c.fl1 * r.AF; r.und = …`; OH1, OH2 and OH5 (compression flange) get `ng`.
  - `r.gov = FX().govern(r.checks)` for both GS rows and OH rows. `girder()` per-span `put`, `gov` and `govAll` compare with `gr`.
- `engine/rating.js` `girder()`
  - Before: `ok = rows.filter(q => !q.oos && isFinite(q.inv))`, `low` with `isFinite`, which dropped an RF of −∞ (f_ℓ > 0 with f_bu ≥ F_cr)
    and NaN.
  - After: only +∞ (NONE, no live-load effect) is left out. −∞ and NaN govern, and a NaN row is flagged `q.err`.
- `engine/fatigue.js`, `studs.js`, `stiffeners.js`, `splices.js`: the `ckNew` / `add` NaN guard, as GirderDetail's `ckNew` after #485.
  - An item with a NaN ratio (not na) is `err`, never a pass (pass → fail; a warning stays a warning).
  - Within a check it ranks above every finite ratio.
- UIs (`ui/flexure.js`, `constructibility.js`, `rating.js`, `shear.js`, `fatigue.js`, `splices.js`):
  - A non-finite failing ratio is shown with its reason ("∞ (NG: f_bu ≥ F_cr, amplification undefined (6.10.1.6))",
    "error: ratio is NaN", RF "−∞ (NG …)") and in the NG colour.
  - The governing pickers (`govCk`, `stGov`, `gov`, `g17`, `strGov`) include failing items with a non-finite ratio and rank them first.
  - The Flexure check table lists a check with `ng` (before, a non-finite ratio was shown as n/a).
### Problem and decision (engineer's rule of 2026-10-29)
- SB2-R2 is as in the rating entry above, and the same as GirderDetail (fixed in #485, fixlog/Steel Bridge Design.md).
  - f_ℓ = 0: the amplified f_ℓ is 0. Eq. 6.10.1.6-4 multiplies f_ℓ1, so there is nothing to amplify.
  - f_ℓ > 0 with f_bu ≥ F_cr: the amplification is undefined (the compression flange is beyond elastic LTB under the first-order f_ℓ).
    The check is NG with ratio ∞ and governs. In the rating the f_ℓ term makes the RF −∞, which now governs.
  - Provision: AASHTO LRFD 10th Ed. (2024) Art. 6.10.1.6, Eqs. 6.10.1.6-4, -5. No capacity, demand or factor formula changed.
- SB2-R1: with `pedestrianInLL: true` the hand-off LL+IM already includes the pedestrian load (HANDOFF.md §4.9). The Flexure, Shear and
  Fatigue tabs (and the Constructibility and Rating paths through `fromPayload` / `demands`) take it as is, as the Rating tab already did
  (`noDoublePL`). Without the flag, or with `false`, M_PL / V_PL are still added. This is less conservative and correct.
  - The old app has no such double count: ST-Girder uses `llD`, which removes m from the pedestrian part only, and GirderDetail uses its
    own analysis (#485).
### Check cases (tests)
- `flexure.test.mjs` "SB2-R2 hand check", built-in project, this app's analysis, G1, x = 109.99 ft:
  - f_bu = 39.67 ksi. Nonprismatic L_b gives F_e = γ_e f_bu,gov = 0.88119(39.683) = 34.968 ksi = F_cr = F_nc.
  - L_b 279.96 > 110.44 in, so Eq. -4 applies; f_bu/F_cr = 1.134, so AF is undefined.
  - Before: GS7 NaN, not reported; Flexure governing ratio 0.973 (x = 114 ft).
  - After: GS7 = 39.67/34.97 = **1.134 NG**, governing (girder: 1.1345 at x = 249.99 ft). GirderDetail (#485) gives the same ratio at the row.
  - With f_ℓ = 7.5 ksi: ∞ with the reason, governing (before: GS10 7.91 at x = 114 ft).
  - Unit cases: `ampFl(0, …)` = 0; `ampFl(7.5, …)` und; f_bu 20 ksi, AF = 0.85/(1 − 20/34.968) = 1.98575 (unchanged); `govern` with NaN and ∞.
- `flexure.test.mjs` SB2-R1: gd_xsA_CTDOT_G1, pier station x = 109.999.
  - M_LL+IM = −2,278.495 kip-ft (before −2,278.495 − 233.613 = −2,512.108).
- `shear.test.mjs` SB2-R1: at 110 ft, LL+IM shear 104.326 kip (before 104.326 + 9.314 = 113.640).
- `constructibility.test.mjs`: deck placement with L_b = 120 ft, f_bu ≥ F_cr. f_ℓ = 0 gives no NaN; f_ℓ = 5 ksi makes GS14 ∞ NG and governing.
  Overhang L_b = 120 ft: OH1 and OH2 are NG with the reason.
- `rating.test.mjs`: an RF of −∞ or NaN governs Inventory and Operating; +∞ does not.
### How verified (this app's engine before (origin/main) / after, 100 payloads each also with f_ℓ = 7.5, plus the built-in project)
- 588,285 check items and per-location governing ratios compared.
- **Pedestrian (SB2-R1): the 18 payloads with `pedestrianInLL: true`** (xsA; RIDOT G3 and G4 carry none).
  - Changed: 6,678 LL+IM moment stations and 6,534 LL+IM shear stations.
  - Ratios drop in GS6–GS8, GS10, GS12 and GS13.
  - **380 in-use checks flip from fail to pass, 0 from pass to fail**: GS7 and GS8 near the piers, e.g. xsA_AASHTO_G1 x = 109.99 GS8
    1.080 → 1.000.
  - The governing ratio drops on all 18 (e.g. xsA_AASHTO_G1 1.209 → 1.114; xsA_CTDOT_G1 1.010 → 0.965, now passing).
  - 319 GS19 reversal notes change, from the opposite extreme without the doubled pedestrian load.
- **SB2-R2:** no payload reaches f_bu ≥ F_cr (no change).
  - Built-in project, this app's analysis: 10 GS7 items change from NaN to 1.134 (fail). The Flexure governing ratio goes from 0.973 to
    1.134 (GS7). With f_ℓ 7.5, 10 GS7 items become ∞ NG and govern.
  - Rating governing unchanged (Inventory 0.752 / Operating 0.975: f_ℓ = 0, so the term was already 0 there).
- The parity tests with GirderDetail (flexure, constructibility, shear, fatigue, studs, stiffeners, splices) stay identical, with the old
  file after #485. `node tests/engine/run.mjs` passes.
- Headless page load (Rating, Flexure, Shear, Constructibility, Fatigue, Splices tabs, Calculate on each): 0 console errors.
### Saved data
None changed.
### Open items
None. SB2-R1 and SB2-R2 are closed.

## 2026-10-30 — PR: sb2-report — the Report tab: calculation report in the shared viewer (report/data.js, report/builders.js, ui/report.js)
### Where
- New `apps/steel-bridge/report/data.js` (`window.SBDReportData.compute(P, g, { src, pl, plName })`): each module's result from the same
  function its own tab calls, with the same inputs (loads `SBDUiLoads.calc`; analysis `SBDAnalysis.analyzeGirder`; section cards as
  index.html `calc()`, every plate segment, positive region and, where the segment touches a pier, negative; flexure: with this project's
  analysis the flexure of `SBDRatingUI.build` (the Rating tab's locations), with a hand-off file `SBDFlexureUI.build`; shear, fatigue
  `SBDShearUI.build` / `SBDFatigueUI.build` with source 'analysis' or the file; constructibility as `ui/constructibility.js calc()` with
  f_ℓ during deck placement 0 (the tab's default; not saved); framing `SBDFramingUI.build`; splices `SBDSplices.girder` (this project's
  analysis only); rating `SBDRatingUI.build`). The full analysis runs once per report: `analyzeGirder` is memoised for the duration of
  `compute()` (key girder + options), restored after.
- New `apps/steel-bridge/report/builders.js` (`window.SBDReportBuild.model(bundle, { detail, include })`): the report model in the workflow
  order — Summary of governing ratios (first; each row links to the step of its check), Project and owner, Cross-section/loads/LLDF, Analysis
  (SVG moment and shear diagrams, reactions, SA3, SA7; with a file: its station demands), Section properties, Flexure, Shear and stiffeners,
  Fatigue and studs, Constructibility, Framing and cross-frames (framing plan SVG), Field splices (drawings), Load rating. Detail 'gov': the
  governing location of each check group (flexure: of each span and region; constructibility: of each span) worked; 'all': every station,
  its steps opened on demand. Rating capacities are linked to the Flexure section's location when that section shows the same location
  object, else worked in the Rating section ("Capacities used by the rating"). Sections not chosen are still built for the summary; their
  rows lose the link and references into them become "(section not included)".
- New `apps/steel-bridge/ui/report.js` (`window.SBDReportUI.render`): chips per section (as ST-Girder's report), Detail, Demands (this
  project's analysis or a hand-off file), Build report / Rebuild, out-of-date notice; the viewer's Print report button. The chips and detail
  are kept in the page's UI state (`ui.rpt` inside the existing key `sbd2.ui`; additive, no project data); the source and file are not saved.
- `index.html`: four script tags (`../../shared/report.js`, `report/data.js`, `report/builders.js`, `ui/report.js`), the Report tab button
  (`data-otab="rpt"`) and its branch in `drawOut()` (anchor `if (ui.otab === 'rpt')`).
- `ui/flexure.js`: `inputs(ctx)` reads `ctx.src`, `ctx.pl`, `ctx.plName`, `ctx.fl`, `ctx.method` when given (else the tab's own state, as
  before), returns `fl`, `flS`, `frB`; new exported `build(ctx)` (anchor `function build(ctx) {`). `ui/shear.js`, `ui/fatigue.js` `build()`:
  `const src = ctx.src || S.src` (anchor `ctx.src: the demand source chosen by the caller`). The tabs call them as before: no change.
- `engine/stiffeners.js` (SB2-R3): the TS5 spacing-limit step id `p1.st` / `p2.st` → `p1.lim` / `p2.lim` (anchors `id: \`p${i + 1}.lim\``,
  `step: \`ts${r.i}.p${i + 1}.lim\``). Before, it repeated the id of `SH.panelSteps`' "stiffened or unstiffened panel" step in the same list
  (shared/README.md: never reuse an id), so the TS5 item's § link went to the wrong step. Display id only; values unchanged.
### Problem
- New: the in-app Report tab (docs/REBUILD_PLAN.md §5 "the in-app Report tab with a navigation tree"; engineer: part of the app's output,
  not PDF-only, formatted as the Gusset Plate Rating report).
### Governing provision
- None changed. Every value and step is the modules' own (AASHTO LRFD 10th Ed. 2024; MBE for the rating). CLAUDE.md §6 (show the work and
  link to it): every value in the report is a worked step or a link to one ("see §x.y" in print).
### Check case
- Built-in project, G1, this project's analysis, detail 'gov': 12 sections, 62 subsections, 2,740 worked steps, 463 references, all
  resolved. Summary: SA3 0.334 (span 2), Flexure GS7 1.142 NG at x = 110.01 ft (after SB2-R2, #487), panel shear 0.435, GS11 0.437, TS1 0.667, BS1 0.692, FA1 0.706,
  GS17 0.501, SC2 0.959, GS14 0.787 at x = 77 ft, CF3 0.904, splice BF4 0.997 (FS1), Inventory RF 0.739 / Operating 0.957 (negative flexure,
  x = 110.01 ft) — the same numbers (same objects) as each tab. Detail 'all': 74,519 steps, 7,477 references, all resolved.
- 5 payloads (gd_builtin28_AASHTO_G1, gd_xsA_CTDOT_G1, gd_util_MassDOT_G3, gd_curb_RIDOT_G5, gd_builtin_AASHTO_G2), both details: every
  reference resolves; no NaN / undefined in the text.
### How verified
- `node tests/engine/run.mjs` (new `tests/engine/report.test.mjs`: the viewer on a hand-made model; the full report of the built-in project
  and the 5 payloads, both details: no unresolved reference, no duplicate anchor, every "§x.y" a subsection, no NaN / undefined / [object in
  the text, every `$…$` parses in KaTeX, the summary's values are the modules' values, the memoised analysis is unchanged by the modules (JSON
  equal to a fresh run), sections left out leave no dangling link).
- `node tests/smoke/steel-bridge-report.mjs` (headless Chromium): 0 console errors, 0 `.katex-error`, links, collapse, search, every-station
  mode, print emulation (260 Letter pages for the built-in project, governing detail).
### Other copies
- None.
### Open items
- SB2-R2 (merged in #487 before this PR): before it, GS7 was not evaluated (NaN) at 10 pier locations of the built-in project. The
  report never hides such a check: a check whose ratio is not a number (and has no n/a reason) is listed in the Flexure section and the
  summary ("Not evaluated (ratio not a number)") and shown "not evaluated" in its table; `tests/engine/report.test.mjs` fails on any non-finite
  step value (`KNOWN_NAN` is empty).
- The report covers the girder selected on the Girders & plates tab; a report of every girder at once is not offered.

## 2026-10-30 — PR: sb-welds — Welds: flange-to-web welds and shop flange transitions (GirderDetail GM.wt port)
### Where
- New `apps/steel-bridge/engine/welds.js` (`window.SBDWelds`): `compute(p, env)` and `checks(R)` port GirderDetail's Welds and
  transitions module (anchor `GM.wt = {` in "Steel Bridge Design.html") operation for operation, with `WT_FSPEC`, `WT_TSPEC`, `numRows`,
  `secSet`, `rowDk`, `wMinFor`, `modRatio` (engine/sections.js), `gdPLe` (engine/shear.js `plAdjust`), `gdOwnM(OWN_K.wt)`, `gdHP`, `gdUt`.
  - FW1 weld metal, v_u = Σγ VQ/I ≤ R_r = 2(0.6)φ_e2F_exx(0.707w), φ_e2 = 0.80 (Art. 6.13.3.2.4b, Eq. 6.13.3.2.4b-1). DC1 and utilities on
    the steel, DC2 and DW on 3n, LL+IM on n; Q at the top flange includes the transformed slab for the composite stages.
  - FW2 web base metal, φ_vu 0.58F_u t_w, φ_vu = 0.80 (Art. 6.13.5.3). FW3 Category F throat shear, γV_fQ/I/(2(0.707w)) ≤ 8.0 ksi
    (Table 6.6.1.2.3-1, Table 6.6.1.2.5-3). FW4 Table 6.13.3.4-1 minimum.
  - TR1 butt splice fatigue γ(|f+| + |f−|) ≤ 16 ksi (B, ground) / 10 ksi (C) at mid-thickness of the smaller flange (Table 6.6.1.2.3-1,
    Section 5); TR2 thickness slope ≤ 1:2.5, TR3 width taper ≤ 1:2.5 or radius ≥ 24 in (Art. 6.13.6.2); TR4 t_1/t_2 and A_1/A_2 ≥ 0.5
    (practice, warning).
  - The TeX `work` lines are replaced by worked steps (`steps(R, 'fw' | 'tr', i)`), each preceded by the section properties it uses
    (engine/sections.js `steel`, `composite`, `withRebar`: the same arithmetic as `secSet`).
  - New: `fromDemands(D, opt)` builds the module rows of one girder from its demands; `demandsFromPayload(pl)` gives D from a hand-off file.
  - New: optional `p.layers` (the project's two deck reinforcement layers) in the steel + reinforcement section of TR1; without it, one
    layer A_r at d_r as GirderDetail.
- New `apps/steel-bridge/ui/welds.js` (`window.SBDWeldsUI`): the Welds output tab (inputs card, governing table, FW and TR tables, worked
  steps of the selected row), demands from this app's analysis.
- `engine/model.js`: `welds` (optional) and `defaultWelds()`; `validate` checks it. `index.html`: two script tags, the Welds tab.
- Not here: stiffener and connection-plate welds (engine/stiffeners.js TS7, CP1, BS4, BS5, already ported).
### Decisions (engineer's rule of 2026-10-29: accuracy, AASHTO 10th Ed.)
- Weld locations. GirderDetail checks the rows Preliminary sizing sends: one per support, at x = support + 0.01 ft at the first
  abutment and support − 0.01 ft elsewhere (so only the left side of a pier), with the shears of that element. This app checks each
  side of every support (the left and right shears of the analysis, which differ at a pier: e.g. 110- and 140-ft spans) and each side
  of every plate change (Q/I jumps there). More locations, no formula changed. On the built-in project the governing FW1 location is
  Pier 2, left (span 2 side).
- Weld size: the Table 6.13.3.4-1 minimum for the thickest plate at each location (Preliminary sizing's rule), or a size entered.
- Transitions: each flange that changes at a plate change that is not a field splice (Framing tab, within its tolerance), tapers at
  1:2.5 (L_t = 2.5Δt, L_w = 2.5Δb per side, as Preliminary sizing), ground flush unless set otherwise; ΔM± from the analysis fatigue
  moments at the change.
- Deck reinforcement in TR1's negative section: the project's two layers at their own depths (GirderDetail: one A_r at d_r).
  Difference on a two-layer deck: the own-I term of the two bars about their centroid, under 0.1% of I.
- TR1 overlaps the Fatigue tab's FA1 shop-transition row (outer face, Fatigue I or II): kept, because it is GirderDetail's check at
  the butt weld (mid-thickness, threshold); the tab notes it.
- Noncomposite girders: the tab says the checks are for composite girders (GirderDetail's module has no noncomposite path).
### Check cases (tests/engine/welds.test.mjs)
- GirderDetail built-in input (GM.wt.def), Abut. 1 interior, w = 5/16 in, E70:
  - R_r = 2(0.6)(0.80)(70)(0.707)(0.3125) = 67.2 × 0.2209375 = 14.847 kip/in.
  - Web: 0.80(0.58)(70)(0.5625) = 18.27 kip/in.
  - Steel: A = 12 + 33.75 + 18 = 63.75 in²; ȳ = 1798.594/63.75 = 28.2132 in; Q_t = 12(61.5 − 28.2132) = 399.44 in³;
    Q_b = 18(28.2132 − 0.5625) = 497.71 in³.
  - FW4: top 3/4 in → 1/4 in (ratio 0.80); bottom 1 1/8 in → 5/16 in (ratio 1.00).
  - TR1–TR4: bottom 16 × 1 1/8 to 16 × 1 1/2, L_t 1 in: slope 0.375 (TR2 ratio 0.9375); t_1/t_2 = A_1/A_2 = 0.75; Category B 16 ksi.
### How verified
- Parity, GirderDetail's own GM.wt.compute / checks in Node (gd-source.mjs pattern) against this engine:
  - the built-in input and 9 variations (owner η, m and haunch 0; pedestrian part with m = 1.2; utilities; grades, n rounded; Category C,
    radius, steep and missing tapers; row A_r; input errors);
  - the 100 tests/projects/st/gd_*.json payloads: rows from each file's demands (2,200 weld locations, 800 transitions), 174,968 values and
    18,600 check items: 0 differ, largest relative difference 0 (bit-identical).
- `node tests/engine/run.mjs` passes. Headless page load of the Welds tab with Calculate: 0 console errors.
### Saved data (CLAUDE.md §5)
New optional `welds` in the sbd2 project (absent reads as `defaultWelds()`); no existing key or field changed.
### Open items
None.

## 2026-10-30 — PR: sbd2-drawings-3d — drawings (framing plan, girder elevation, typical section; DXF) and the 3D view (new files)
Display and export only: no engineering formula, factor, unit or reference changed; no computed result changes (the engines are only read).
### Where
- `engine/drawings.js` (new, `window.SBDDrawings`): `model(P, opt)` (the geometry: per cross-section girder its plate segments, bearings,
  connection plates, bearing and intermediate stiffeners, stud zones and field splices at its own stations; the frames of engine/framing.js;
  deck and appurtenance footprints from engine/loads.js; the cross-frame type or diaphragm), `plan`, `elevation`, `section`, `all`, `dxf`.
  Ported from GirderDetail ("Steel Bridge Design.html"), anchors `function dxfPlan(D, C) {`, `function dxfElev(D, C) {`,
  `function dxfSection(D, C) {`, `function dxfApp(D, xL, xR, yTop) {`, `function dfFoot(R) {`, `function dfApp(R) {`, `function dxfTable(`,
  `function dxfNotes(`, `function dxfTag(`.
- `ui/drawings.js` (new, `window.SBDDrawingsUI`): the Drawings tab: SVG previews of the three drawings (drawn from the same entities as the file,
  `SharedDxf.toSVG`), girder choice for the elevation, preview zoom, Download DXF (validated before saving), optional stud zones from the analysis.
- `ui/view3d.js` (new, `window.SBD3DUI`): the 3D view tab, ported from GirderDetail's `v3bBuild` / `v3bLabel` (whole-bridge mode): girders and
  plates, haunch and skewed deck, connection plates, bearing and intermediate stiffeners, X / K cross-frames or diaphragms on their work points,
  bearings and support seats, barriers, curbs, railings, sidewalks and median, studs (off by default), field splice markers, labels.
  Orbit, pan and zoom with mouse and touch (one finger rotates, two fingers pinch-zoom and pan); the camera is kept when inputs change and saved
  in `sbd2.ui` (`v3d.cam`); layer toggles (`v3d.lay`) hide groups without a rebuild; Reset view; Save PNG.
- `index.html`: script tags (`../../shared/dxf.js`, `engine/drawings.js`, `ui/drawings.js`, `ui/view3d.js`; three.js r128 from cdnjs and
  OrbitControls from jsdelivr three@0.128.0 with `defer`, the exact URLs GirderDetail loads, CLAUDE.md §2) and two output tabs (Drawings, 3D view).
- `tests/engine/drawings.test.mjs` (new); `tests/libs/MANIFEST.json`: three@0.128.0 "used_by" lists the new app (local copies already there).
### Decisions (SB2-DW1 to DW5)
- SB2-DW1. Plates per girder line: GirderDetail draws one set of plates (Preliminary sizing's) on every girder. Here cross-section girder i takes
  the plates of the plate girder that loads it (`girders[j].line = i`; else the first plate girder of the same position, exterior for G1 and
  G_nb; else the first plate girder), the same rule the analysis uses (engine/analysis.js lineOf, SB2-A7).
- SB2-DW2. Stations: plate, stiffener, stud and splice stations are analysis stations (ft along the centerline spans); each girder's are mapped
  to its own stations with `SBDFraming.toG` (proportionally within each span, the brace-point mapping of the Flexure tab). Equal skews at all
  supports: identical to GirderDetail. Unequal skews: GirderDetail places them unmapped, so its last plate can end short of or past the girder's
  Abut. 2 bearing; mapped, it ends at that bearing (checked in the test).
- SB2-DW3. Stud zones: those entered on the Fatigue & studs input tab; with none, the button "Stud zones from the analysis" takes the zones the
  Fatigue & studs tab makes (span tenths, ~15 s, not saved). GirderDetail draws its Shear connectors module's zones.
- SB2-DW4. Web depth per segment (GirderDetail draws one D); the section is cut at each girder's first segment (GirderDetail: the first
  segment of the one plate set).
- SB2-DW5. Not ported (they need results this display module does not compute, or are GirderDetail sheets outside this PR): splice plate
  outlines and bolts (Field splices tab design), Strength I moment envelope and camber diagram/tables (Analysis tab), weld symbol, quantities,
  paper-space sheets with border and title block, other detail sheets (splice, bearing stiffener, cross-frame, stud, weld details, erection,
  reactions, fatigue, overhang, summary, standard details); in 3D the moment/shear diagram fences and the single-girder close-up mode.
  Sheet references in the tags ("SEE SHEET ...") are left out. The Pyodide download (~10 MB) is gone: no Python runs in the browser.
### Governing provision
- None (drawings and 3D display). The cross-frame layout shown is engine/framing.js (AASHTO LRFD 10th Ed. Art. 6.7.4.2.1, worked on the
  Cross-frames tab); the plates are the inputs; the stiffener layout is engine/stiffeners.js girderBays (Art. 6.10.11.1).
### Check case (built-in project: 110-140-110 ft, 5 girders at 9.5 ft, no skew, cross-frames at most 25 ft, plates change at 88, 128, 232, 272 ft)
- Girder centerlines at y = 0, 114, 228, 342, 456 in, each 0 to 4320 in (360 ft). Plan dimension "4@9'-6"".
- Cross-frames: 4 + 5 + 4 per bay × 4 bays = 52 intermediate, 4 supports × 4 bays = 16 end frames. Span 1 at 110/5 = 22 ft would put a frame on
  the flange transition at 88 ft (within the 2 ft clearance): the layout shifts the grid 2.2 ft: 24.2, 46.2, 68.2, 90.2 ft = 290.4, 554.4, 818.4,
  1082.4 in, as drawn.
- Elevation G2 top flange plates 0–1056 (3/4), 1056–1536 (1 1/2), 1536–2784 (3/4), 2784–3264 (1 1/2), 3264–4320 in (3/4); web "WEB 60 x 9/16".
- Section deck from x = −39 to 495 in (9.5 × 4 + 2 × 3.25 = 44.5 ft = 534 in), y = 2 to 10 in (2 in haunch, 8 in slab).
### How verified
- `node tests/engine/run.mjs drawings`: the built-in project and 5 hand-off payloads (gd_builtin28_AASHTO_G1, gd_builtin_CTDOT_G3,
  gd_curb_MassDOT_G2, gd_util_RIDOT_G4, gd_xsA_AASHTO_G5, each given its own cross-section: 3 to 7 girders, unequal spacings, skews 0° to 40°,
  equal and unequal, 0 to 4 splices): each drawing written as DXF and read back; girder count and spacing, every cross-frame line on its work
  points, every plate break on every girder, bearings, splices, stiffener count, section webs and deck width = the model: 6 projects, 30 girders,
  433 cross-frames, 250 plate segments, largest coordinate difference 4.8e-7 in (the file's 6 decimals). ezdxf 1.4.4 opens every file (R12) with
  no audit error.
- Headless browser (apps/steel-bridge/index.html from file://, CDN libraries from tests/libs): Drawings tab previews, Download DXF (validated),
  3D view (WebGL), one-finger touch orbit moves the camera, two-finger pinch zooms (camera distance 5596 → 1865 in), an input change (span lengths) keeps the camera (shift 1e-4 in, damping residue),
  layer toggle; 0 console errors.
### Saved data (CLAUDE.md §5)
- No project field and no key changed. The page's ui state (`sbd2.ui`, existing key) gains optional fields `dwg` ({ gi, z }) and `v3d`
  ({ lay, cam }); absent = defaults.
### Other copies
- `shared/dxf.js` (fixlog/shared-dxf.md). The old `Steel Bridge Design.html` is unchanged.
### Open items
- SB2-DW5's list (splice plates and bolts on the plan and in 3D once the Field splices results are cached for display; camber and moment
  envelope sheets with the Analysis tab; paper-space sheets).

## 2026-10-30 — PR: sbd2-report-wiring — wiring gaps found by the Report PR (#488): Flexure analysis source, deck-placement f_ℓ saved, every-girder report, default demand source
### Where
- `apps/steel-bridge/ui/flexure.js` `inputs(ctx)`: new branch `if (src === 'analysis') {` (before the anchor `// owner rules as the Section
  properties tab`): `SBDRatingUI.fromAnalysis(P, gi)` → `SBDRating.noDoublePL` → `SBDFlexure.fromPayload(plR, { owner, rebar: P.deck.rebar,
  braces: supports ∪ stiffener-layout frames.at | Lb: frames.Lb || 25, fl: entered if > 0 })`, then `prj.mat`, `prj.deck` (haunch by OWN8),
  `prj.n` (OWN17 w_c), `prj.rebarInPositive` from the project: the same statements as `ui/rating.js build()` (anchor `if (fromAn) { const m =
  P.materials`). `S.src` starts `null`; `srcOf(ctx) = S.src || (SBDAnalysis.ready(P, g).ok ? 'analysis' : 'example')`; the Demands select has
  "This project's analysis (Analysis tab)" first; with it the L_b, C_b and skew inputs are hidden (as with a file).
- `apps/steel-bridge/ui/shear.js`, `ui/fatigue.js`: `S.src: null` and the same `srcOf(ctx)` (anchor `const srcOf = ctx => S.src ||`) in
  `build()`, `key()` and the select. Before: Shear defaulted to 'example', Fatigue to 'analysis' whatever the project.
- `apps/steel-bridge/ui/rating.js`, `ui/constructibility.js`: `S.src: null`, `srcOf() = S.src || 'analysis'` / `'project'` (no example on these
  tabs: unchanged default); the line at the top of the tab.
- `apps/steel-bridge/engine/analysis.js`: new `ready(P, gi)` (anchor `function ready(P, gi) {`): complete = girder with plates, every span > 0,
  valid analysis settings (the three checks of `analyzeGirder`), dead loads and distribution factors not the "none entered" fallback of
  `loadsOf` / `dfOf`. No beam analysis (the loads module only, a few ms); memo of the last answer by `JSON.stringify([P, gi])`.
- `apps/steel-bridge/ui/analysis.js`: new `srcBar(o)` (anchor `function srcBar(o) {`): the line "Demands: <source> (the default: … / as
  chosen below)" at the top of the Flexure, Shear, Fatigue, Constructibility, Rating and Report tabs; `index.html`: its CSS (`.srcBar`, one rule
  after `.alert[hidden]`).
- `apps/steel-bridge/ui/constructibility.js`: f_ℓ during deck placement is `P.constr.flC` (`flOf(P)`; anchor `const flOf = P =>`), written on
  change through `ctx.changed()` (saved); before: `S.flC`, in memory only. `engine/model.js`: `constr.flC` documented (optional, ksi, absent = 0)
  and validated (a number; anchor `// added 2026-10-30 (report wiring PR)`). Additive: an older project reads as 0, the old default; no
  migration needed.
- `apps/steel-bridge/report/data.js`: flexure with this app's analysis from `SBDFlexureUI.build({ P, g, src: 'analysis', fl: 0, method:
  'auto' })` (before: `B.rating.flex`); `linkRating()` checks it equals the rating's own flexure (`sameFlex`: every location's name, x, region,
  M_u, M_s and every check's id, demand, capacity, ratio, `Object.is`) and then points the rating's capacity map at its locations (so the
  rating still links to the Flexure section, `B.flexSame`); constructibility `flC = P.constr.flC` (anchor `const C = W().SBDConstr, FRM =
  W().SBDFraming, flC =`). Analysis cache `analysis(P, gi, o)` (anchor `const CACHE = new Map();`): LRU of at most 2 × girders + 4 results,
  key = JSON of the project without `rating` (the analysis does not read P.rating; checked by grep: only `ui/rating.js` does) | girder | options;
  `compute()`'s memo now draws from it, so it is kept between builds.
- `apps/steel-bridge/report/builders.js`: each summary row gets `grp` (its check group: 'Flexure (Strength I, Service II, Fatigue I)',
  'Shear & stiffeners: Web panels', …, 'Rating: Inventory RF'); the Flexure section's note names the Flexure tab's source; new `govRows(B)`
  (one girder's summary rows as data) and `allModel(P, list)` (the every-girder report: per check group the governing value of each girder, ◆ on
  the controlling girder of the group, the controlling girder of the bridge named, then each girder's governing rows).
- `apps/steel-bridge/ui/report.js`: Scope "Selected girder (detailed report)" (unchanged) / "Every girder (governing ratios)" (`ctx.opts.scope`,
  kept in the existing `ui.rpt` of `sbd2.ui`; additive UI state). The every-girder build runs one girder per timer tick with progress; each
  girder's rows are kept by `JSON.stringify([P, gi])` (`S.rows`), also from the selected girder's report.
### Problem
- The Flexure tab had no "This project's analysis" source; the report and the rating took the rating path's flexure.
- f_ℓ during deck placement was not saved, so the report used 0 whatever the tab showed.
- No view of every girder at once.
- Default sources differed per tab (Shear: example; Flexure: example; Fatigue, Rating, Constructibility: analysis) and were not shown.
### Governing provision
- None changed (no calculation change). Values are the modules' own: AASHTO LRFD 10th Ed. (2024) 6.10 (flexure), 6.10.3 (constructibility,
  f_ℓ in Eq. 6.10.3.2.1-2 and -3 as before, now the saved entry), MBE 6A.4.2 (rating).
- Decision (lead, 2026-10-30, recorded per the engineer's 2026-10-29 rule): with this project's analysis the Flexure tab takes f_ℓ as entered and
  0 when nothing is entered — the Rating tab's value — not the skew-derived f_ℓ the file source uses (C6.10.1). Reason: the task requires the
  Flexure results to equal the rating path, and "no calculation changes"; adding the skew f_ℓ to the analysis path would change the rating's
  capacities. Open item SB2-W1 below.
- Decision: a project is "complete" when the analysis would run on real loads (dead loads and LLDF present). Missing framing, studs or fatigue
  inputs do not make it incomplete: those tabs default them as before.
### Check case
- Built-in project, G1, this project's analysis: Flexure tab 367 locations, 2,406 checks; every demand, capacity and ratio equal to the
  Rating tab's flexure (largest difference 0); governing GS7 ratio 1.142 at x = 110.01 ft (both paths); Inventory RF 0.739 at x = 110.01 ft
  rated on that location. The report: same counts as #488 (gov 2,740 steps, 463 references; all 74,519 / 7,477), all resolved.
- Hand check (built-in project, G1, x = 110.01 ft, negative flexure; the same numbers on the Flexure tab and in the Rating tab's capacity):
  M_u = 1.25(−2538.59) + 1.25(−431.70) + 1.50(−357.56) + 1.75(−2319.41) = −3173.24 − 539.63 − 536.34 − 4058.97 = −8308.17 kip-ft (Table 3.4.1-1);
  f_bu = 39.93 ksi (bottom flange, compression); F_nc = min(F_nc,FLB 50.00, F_nc,LTB 34.97) = 34.97 ksi; f_ℓ = 0;
  GS7 (6.10.8.1.1-1): f_bu + f_ℓ/3 = 39.93 ≤ φ_f F_nc = 1.0 × 34.97 → ratio 39.93 / 34.97 = 1.142 NG — before (rating path) and after
  (Flexure module) identical.
- Constructibility, built-in project G1: f_ℓ = 0 → governing GS14 0.787 (as #488); f_ℓ = 2.5 ksi saved → GS14 1.140 (the report and
  `engine/constructibility.js` with flC 2.5 agree).
- Every girder, built-in project + a second girder G2 (exterior, bottom flanges < 1.5 in thickened 0.25 in): 14 check groups; G1 / G2:
  SA3 0.334 / 0.307, flexure 1.142 / 1.087, FA1 0.706 / 1.007, GS17 0.501 / 0.723, SC2 0.959 / 0.877, GS14 0.787 / 3.114 (overhang brackets
  of the exterior girder), Inventory RF 0.739 / 0.846; controlling girder G2 (constructibility 3.114). First build 24 s in Node (4 analysis
  runs: full and dead-load per girder), again 4 s (0 runs).
### How verified
- `node tests/engine/run.mjs` (new `tests/engine/report-wiring.test.mjs`: flexure analysis source = rating path at every check; report
  Flexure section from the Flexure module with the rating linked to it; default source complete / incomplete (invalid settings; no loads and
  no factors; no plates; entered loads and factors complete it); f_ℓ saved, validated, through export/import, used by the report; the cache
  (same state → same object and no run; rating factors not in the key; a change runs again and equals a fresh analysis; bounded); the
  every-girder model (controlling girder per group, rows equal each girder's report, every reference resolves, KaTeX parses, no NaN, second
  build runs no analysis). `tests/engine/report.test.mjs` unchanged and passing.
- `node tests/smoke/steel-bridge-wiring.mjs` (headless Chromium, one run): each of the five tabs opens on "This project's analysis (the
  default …)"; the Flexure tab calculates 367 locations with it; choosing Example says "as chosen below"; f_ℓ 1.5 written to
  `sbd2.project.current` (`constr.flC`); the every-girder report builds; 0 console errors, 0 KaTeX errors.
### Other copies
- None.
### Open items
- SB2-W1 (for the engineer): with this project's analysis, Flexure and Rating take f_ℓ = 0 unless entered; the file source takes the skew
  f_ℓ of C6.10.1 (1.25 × 10/7.5 ksi where a support is skewed > 20°). Whether the analysis path should take the skew f_ℓ too (it would change
  the rating's flexure capacities on skewed bridges) is not decided here. Closed 2026-10-30 (sb2-paths-consistent): the skew f_ℓ on every path.
- SB2-W2: the analysis-source flexure (as the rating) takes its brace points from the stiffener layout's cross-frames (`P.stiffeners.layout
  .frames`), the file source from the Framing tab (`SBDFraming.forGirder`). Same as the rating before this PR; noted for a later alignment. Closed 2026-10-30 (sb2-paths-consistent): the Framing tab on every path.
- The output tabs still run their own analysis (the report's cache is used by the Report tab only). Closed 2026-10-30 (sb2-paths-consistent): one cache for every tab.
- Display fix found by this PR's f_ℓ test (first test with flC > 0 where the amplification is undefined): `engine/constructibility.js` step
  `cn.fl` (anchor `sub: r.amC.req ?`) wrote `—(0.00)` (a KaTeX parse error) when AF = ∞ (SB2-R2); now `\infty(0.00)`, as `engine/flexure.js`
  step `fl`. Before: `${n3(r.amC.AF)}(…)`; after: `${isFinite(r.amC.AF) ? n3(r.amC.AF) : '\\infty'}(…)`. Text of the step only; the value
  and the check are unchanged.

## 2026-10-30 — PR: sb-import — import of old projects (GirderDetail / Steel Bridge Design, Preliminary sizing, ST-Girder, old autosaves)
### Where
- New `apps/steel-bridge/engine/legacy.js` (`window.SBDLegacy`): `importLegacy(obj)`, `fromParts({ gd, pl, st })`, `fromStorage(storage)`,
  `ownMigrate(pl)`, `summaryText(summary)`.
- `engine/model.js`: `importLegacy(obj)` is no longer a stub. It calls `SBDLegacy.importLegacy` (anchor `function importLegacy(obj, opt)`).
  `importJSON` routes old files there, as before. Schema comment: new optional `legacy` field.
- New `apps/steel-bridge/ui/legacy.js` (`window.SBDLegacyUI.show`): the import summary panel.
- `index.html`:
  - two script tags;
  - "Import JSON…" now also takes old files and shows their summary;
  - new header button "From old app", which reads the old autosaves.
### What is read
- Steel Bridge Design project file (SBD4): `{ app: 'SteelBridgeDesign', v: 1, name, data (the modules; also accepted as gd), pl: { app:
  'PlateLine', data }, st: { …, _schema: 'stgirder' } }`.
  - A version above 1 is refused, as the old app refuses it.
- The older formats: `{ app: 'GirderDetail', data }`, `{ app: 'PlateLine', data }`, ST-Girder `{ _schema: 'stgirder', … }`.
- The old autosaves, **read only** (never written or deleted): `girderdetail_autosave_v1`, `plateline_autosave_v1`, `stgirder.session`.
- Refused with a message: hand-off files (`stgirder-external-demands`) and PlateLine splice exports. These are demands, not projects.
### Mapping
- **Preliminary sizing** (the bridge):
  - spans and continuity; girder count, spacing (equal, variable, exterior), overhangs, skews;
  - deck edges: GirderDetail's XS9 edges when present; otherwise the barrier, or the curb and railing;
  - deck t_s, haunch, t_sac (gives tdeck), f′c, w_c, w_c for E_c; flange and web grades;
  - plates: every breakpoint of the top, bottom and web lists becomes one segment, for each of the n_b girders (one layout, as the old app);
  - b_eff tributary (exterior S/2 + overhang, interior the mean of the adjacent bays), as GirderDetail's Structural analysis does;
  - owner and η inputs; crack model; L/… deflection limit;
  - framing: spacing, pier spacing and length, orientation, arrangement, clearances, tolerance, skew f_ℓ, field splices;
  - stiffener layout (stiffened web, d_o/D, per-bay list); stiffener, connection-plate and bearing-stiffener plates; the minimum
    cross-frame depth;
  - wearing surface, SIP, detail allowance; project information.
- **Preliminary sizing's own load-time migration** (`ownMigrate`, anchor `function migrateOwnDef(p)` / `function ownApply(`).
  - Applies to a project saved without the owner defaults (no `ownDef`, or `ownDef.v` < 4).
  - Each OWN14 default input still at its generic value moves to the owner's value, as the old app does when it opens the project.
    Example: MassDOT f′c 4 → 5 ksi, grades 50W → 50.
  - The moves are listed in the summary.
- **GirderDetail** (the modules):
  - LLDF and DLs (the inverse of `engine/loads.js fromModel`): sidewalks, pedestrian load, median, appurtenance w_c, fences, wearing
    surface by thickness, added loads, overlays, edges, overrides, beam classes, method, gap, K_g, skew corrections;
  - Structural analysis: crack, IM, fatigue IM, L/…, pour sequence;
  - Girder section: deck rebar layers, F_yr, K_1, n rule, rebar in M_p, flange categories;
  - Fatigue: limit, ADTT, p, life, γ, negative section, distortion details;
  - studs: d, h, s_t, F_u, Q_n, γ, F_rc, w, splice entries;
  - stiffener types and grades, F_EXX, bearing end distance;
  - cross-frames: type, grades, primary, diaphragm, wind, members, connection, user forces, category, stability bracing;
  - splice bolts, load factors, clearances; overhang brackets (to constructibility); welds F_EXX and γ.
  - Without a Preliminary sizing part, the bridge comes from `df.bridge` (what Preliminary sizing last sent).
- **ST-Girder**:
  - with other parts: the rating factors φ_c, φ_s;
  - alone: one simple span of one girder (plates or plate segments, grades from F_y/F_u, deck, rebar, cross-frame spacing, stiffeners,
    studs, fatigue, rating).
- **Not mapped, kept** under `project.legacy.unmapped.{gd,pl,st}` at their own paths, and listed in the summary:
  - the module rows (location rows, stud zones, splice plates, overhang rows): this app makes them from its analysis;
  - Preliminary sizing's sizing, cost and Suggest settings; the view state;
  - GirderDetail's single-splice data;
  - LLDF/DL fields this app does not have (e.g. util's cross-frame weight settings `xf, xfAllow, …`, noted);
  - ST-Girder's own load inputs.
  - Nothing is dropped: a reader records every path it reads; the rest is copied as is.
### Decisions
- Studs: an imported project keeps this app's default of b_eff per girder (SB2-F1). GirderDetail's single bridge-wide value is in
  `legacy.unmapped.gd.sc`.
- Weld size: the Table 6.13.3.4-1 minimum (the welds PR default). GirderDetail's weld rows are kept unmapped.
- Old cross-frame members are GirderDetail's Cross-frames module inputs. These are the members the old app checked; its dead load
  used Preliminary sizing's suggested frame (see the differences).
### Check (tests/engine/legacy.test.mjs)
- The 20 recorded projects were imported as Steel Bridge Design files: built-in, builtin28, xsA, curb, util × AASHTO, RIDOT, MassDOT, CTDOT.
  - Parts: Preliminary sizing from `DEFAULT` after the page's own `migrateOwner`, or from the seeds; GirderDetail's built-in module
    inputs, or the seeds; the owner set as the recorders do.
  - Model against the 100 hand-off payloads: spans, plates, b_eff, position, skews, owner, t_s, haunch and f′c are exact.
- Computed with this app (analysis; flexure on its framing, with the owner factors η and m applied in the test) for G1 and G2, against
  GirderDetail's own results. Largest difference per quantity:

| Quantity | Largest | Where | Cause |
|---|---|---|---|
| M_DC1 | 0.76 % (−2424.4 vs −2406.1 kip-ft) | builtin AASHTO G2 | Cross-frame point loads: GirderDetail weighed Preliminary sizing's suggested K-frame (L3x3x3/8 bottom chord and diagonals, 2.80 kip on G1); this app weighs the imported Cross-frames members (X, L5x5x3/8 × 3, 4.73 kip). Steel at 490/144 (SB2-A2, +0.08 % of the steel part) |
| M_DC2, M_DW | 0.006 % | curb CTDOT / AASHTO | Hand-off round-off (0.001) and the station grids |
| M_LL+IM, M_FAT (±) | 0.000 % | — | (pedestrian part of the hand-off taken out) |
| Negative flexure GS7/GS9, GS8 | 0.26 % / 0.32 % | builtin CTDOT G2 span 1 | The M_DC1 above through f_bu; L_b and C_b from this app's framing |
| Same, xsA (sidewalks) | 10.4 % / 9.6 % | xsA RIDOT G1 span 3 (1.040 vs 1.160) | GirderDetail adds the 75 psf pedestrian load to LL+IM; this app's analysis has no pedestrian load yet (engine/analysis.js warns) |

- Further tests:
  - Nothing dropped: GirderDetail's fatigue rows and stud zones are found unchanged under `legacy.unmapped`.
  - Round trip: export, import, export gives the same text.
  - The old autosaves are imported through a storage stand-in that throws on any write or delete; the result equals the file import.
  - ST-Girder alone gives one simple span (φ_c and b_eff kept; `rateVeh` kept unmapped).
  - Refusals: a hand-off file, and a file version above 1.
- Headless smoke: Import JSON with the xsA project file shows the summary (MassDOT defaults applied: f′c 4 → 5, grades 50W → 50),
  22 GirderDetail groups are kept unmapped, Welds Calculate runs, and "From old app" imports. The old keys are unchanged.
  0 console errors.
### Saved data (CLAUDE.md §5)
- The old app's keys are read only. This app writes only its own `sbd2.project.current`, as before.
- New optional field `legacy` in the sbd2 project. No existing key or format changed.
### Open items (for the engineer)
- Pedestrian load: this app's analysis does not have it. On bridges with sidewalks, negative flexure is up to 10 % lower than in
  GirderDetail (xsA). Already warned on the Analysis tab.
- Owner factors η and m (OWN6/OWN7): `engine/flexure.js` does not apply them yet (its header, "Not ported"). The test applied them to
  compare. Without them the Flexure ratios of RIDOT projects (m = 1.2) are lower than GirderDetail's.
- Cross-frame weight in DC1: map Preliminary sizing's suggested frame (`analysis.xf`, K-frame areas) into the cross-frame members on
  import, or keep the Cross-frames module's members (now)?
## 2026-10-30 — PR: sb2-dw5-sheets — the drawing set (every GirderDetail sheet, border and title block), splice plates, moment envelope and camber, weld symbols and quantities; 3D diagrams, splice plates and single-girder close-up (SB2-DW5)
Display and export only: no engineering formula, factor, unit or reference changed; no computed result changes (the engines are only read).
### Where
- `engine/sheets.js` (new, `window.SBDSheets`): `results(P, G)` (per plate girder used by a girder line: report/data.js `compute` (analysis,
  field splices, fatigue, …), report/builders.js summary rows, ui/welds.js `build`; analyzeGirder memoised for the call, as report/data.js),
  `build(G, RS, opt)` (the sheet set), `sheet` (scale search, border, title block), `env` (Strength I envelopes), `quantities`, `weld`.
  Ported from GirderDetail ("Steel Bridge Design.html"), anchors `function dxfSheet(D, S, drawFn, ctx, ox) {`, `function dxfBuild(lay) {`,
  `function dxfCover(D, C) {`, `function dxfErect(D, C) {`, `function dxfElev(D, C) {` (moment band, plate schedule, camber tables and
  diagram), `function dxfSection(D, C) {` (weld symbols, notes, quantities), `function dxfSplice(D, C) {`, `function dxfPlot(`,
  `function dxfLab(`, `function dxfDiag(D, C) {`, `function dxfSummary(D, C) {`, `function dxfReac(D, C) {`, `function dxfFat(D, C) {`,
  `function dxfOH(D, C) {`, `function dxfBS(D, C) {`, `function dxfCF(D, C) {` (with `const cfCPpts =`), `function dxfTS(D, C) {`,
  `function dxfSC(D, C) {`, `function dxfStd(D, C) {`, `function dxfWT(D, C) {`, `function dxfWeld(`.
- Sheets (GirderDetail's list and order, `dxfBuild`): 1 cover and sheet index (with "drawings not in this set" and revisions), framing plan,
  erection diagram and girder layout (piece marks, shipping pieces, steel by girder, work points), girder elevation and camber (all
  girders), one elevation per girder line, typical section and notes (weld symbols, estimated quantities, weld quantities), field splice
  (one sheet per splice and plate girder), analysis diagrams (one per plate girder), design summary, bearing reactions, fatigue and fracture,
  deck overhang, bearing stiffener details, cross-frame or diaphragm details, stiffener and connection plate details, shear connector
  details, standard details and staging notes, flange transition details. Paper D 34 × 22 in (or B 17 × 11), drawing area 31.75 × 17.45 in,
  the smallest scale of GirderDetail's list not below the sheet's minimum (cover 1, plan / erection / elevations / diagrams 48, section 12,
  overhang / stiffeners / cross-frames 4, splice / studs / standard / transitions 3) at which the sheet fits; title block cells PROJECT,
  PROJECT NO., SHEET TITLE, SCALE, DESIGNED / CHECKED, SHEET n OF N from the project (`P.project`: name, number, designer, checker).
- `engine/drawings.js`: `plan(G, D, opt)`, `elevation(G, D, gi, opt)`, `section(G, D, opt)` take `opt.k` (a plot scale chosen by the sheet;
  default the old automatic choice) and `opt.RS`; new `splR` (the Field splices design of a girder's splice k) and `splElev`: top splice
  plates on the plan (GirderDetail `dxfPlan`, layer S-SPLC-PLAT) and, new, the flange and web splice plates with every web bolt and the flange
  bolt rows on the elevation; the cross-frame location table wraps at 12 locations per row (a long row could not fit any sheet); girder
  model `splX` (the splice stations on the centerline). Exports `TXT, segAt, splR, brgType, tsType, bwName`.
- `ui/drawings.js` (rewritten): the sheet set: Calculate results (one analysis per plate girder, kept until the project changes, not saved),
  paper, sheet choice and preview (the sheet with its border, drawn from the file's entities), Download DXF (all sheets, validated), the sheet
  index with the tab where each sheet's content is worked (link), the "not in this set" list, and the quantities with the weld metal worked
  (w²/2 × L × γ, values substituted). `results(P)`, `calc(P)` for the 3D view. The "Stud zones from the analysis" button is replaced by the
  results (the Fatigue & studs tab's zones, used when none are entered).
- `ui/view3d.js`: GirderDetail `v3bSeries`, the diagram fences and `V3B.focus` of `v3bBuild`: View (whole bridge / girder Gi close-up), Diagram
  (Strength I, Service II, LL+IM, DC1, DC2 + DW, fatigue moments; Strength I, LL+IM, dead-load shears), scale, "+ moment down", zoom to each
  splice or bearing (close-up), the value under the pointer; splice plates of the design (every bolt in the close-up); layer "Diagram".
  ui state `sbd2.ui` `v3d` gains optional `mode`, `dg`, `dsc`, `eng` (absent = whole bridge, Strength I moment, 1, on).
- `index.html`: one script tag (`engine/sheets.js`). `tests/engine/sheets.test.mjs` (new), `tests/smoke/steel-bridge-drawings.mjs` (new).
### Decisions (SB2-DW6 to DW13; engineer's rule of 2026-10-29)
- SB2-DW6. Sheets in model space, each with its border and title block at its plot scale: GirderDetail's R12 sheet format (`dxfSheet`
  without `lay`). GirderDetail's default "layouts" format (one paper-space layout per sheet with a locked viewport) was written by ezdxf
  running in the browser (Pyodide, ~10 MB), which this app does not load (SB2-DW5 of #491); DXF R12 has a single paper space, so true
  layouts need a DXF R2000+ writer (open item).
- SB2-DW7. Results per plate girder: each girder line shows the moment envelope, camber and splice plates of the plate girder that loads it
  (SB2-DW1), at the girder's own stations (SBDFraming.toG, SB2-DW2). The "all girders" camber table lists each girder at the tenth points of
  the centerline spans (the same fraction of its own span). GirderDetail analysed each girder line G1…Gn.
- SB2-DW8. Analysis diagrams: moments, shears and dead-load deflections as GirderDetail; shears drawn just left and right of every station
  (the jumps at supports and point loads; GirderDetail plotted element midpoints). The flange-stress plots are left out: this app works the
  flange stresses at its check locations (Flexure, Rating tabs), not along the girder; adding them would be a new calculation (CLAUDE.md §4).
- SB2-DW9. Bearing reactions: DC1, DC2, DW, LL+IM max / min (Analysis tab) and the service sums DC1 + DC2 + DW + LL+IM. GirderDetail's jacking
  (RIDOT OWN40 / 1.3 × permanent) and seismic horizontal (3.10.9.2) columns are left out: not worked in this app.
- SB2-DW10. Quantities from this project (GirderDetail: Design all's cost list): plate steel Σ L(b_t t_t + b_b t_b + D t_w) × 490/1728
  lb/in³ (no detail allowance), connection plates, stiffeners, bearing stiffener plates, field splices, splice bolts (4 n_rows n_lines per
  flange + 2 × web bolts per splice), studs (⌊L/p + 1⌋ × n per zone on each girder's own length, GirderDetail `dxfSC`), shop CJP flange
  splices (Welds tab transitions); weld quantities: flange-to-web 4 lines over each girder (size as the Welds tab: entered, else
  Table 6.13.3.4-1 for the thickest plate), connection plates (D − 2c to the web, b − c to each flange), intermediate stiffeners (D − c − gap),
  bearing stiffeners (D − 2c; + b − c to the bottom flange when welded), weld metal w²/2 × L × 490/1728 lb/in³.
- SB2-DW11. Strength I envelope on the elevation, the diagram sheet and in 3D: engine/flexure.js `envelopeStrI` with `factors()` (1.25 / 0.90 DC,
  1.50 / 0.65 DW, 1.75 LL+IM; AASHTO LRFD 10th Ed. Table 3.4.1-1, -2), the Flexure tab's combination; Service II 1.0 DC + 1.0 DW + 1.30 LL+IM
  (`factors().sll`). GirderDetail's Strength I carried the owner η and m (OWN6/OWN7, gdLF); the drawings use the Flexure tab's combination
  (one combination everywhere in this app); identical for η = m = 1 (AASHTO). Not a change to any check.
- SB2-DW12. Shipping pieces: "with detail allowance" uses the Analysis tab's steel detail allowance (GirderDetail: a fixed 5 %); steel
  490/1728 lb/in³ (the analysis's 3.4028 lb/ft per in², SB2-A2; GirderDetail 0.2836).
- SB2-DW13. Design summary: the Report tab's summary of governing ratios (report/builders.js) of each plate girder (GirderDetail: its Girder
  section checks and Design all status). Fatigue sheet: the Fatigue & studs tab's detail rows (detail description from engine/fatigue.js DET).
### Governing provision
- None (drawings and 3D display). Values shown are those of their tabs: analysis (Analysis tab), Strength I (Table 3.4.1-1 as the Flexure
  tab), splices (6.13.6.1, Field splices tab), welds (6.13.3, Welds tab), studs (6.10.10, Fatigue & studs tab), cross-frames (6.7.4).
### Check case (built-in project: 110-140-110 ft, 5 girders at 9.5 ft, one plate girder)
- 25 sheets (15 without results: the 7 needing them listed as not generated).
- FS1 at 82 ft (Field splices tab design): top flange 3 rows × 2 lines each side: 2 × 3 × 4 = 24 bolts; bottom 4 × 2: 32; web 11 × 2 per
  side: 44; 100 bolts, 7/8 in bolts in 15/16 in holes (circles r = 0.46875 in); top outer plate 19.5 × 16 in. Quantities: 20 splices, 2000 bolts.
- Flange-to-web welds 5/16 in (thicker part > 3/4 in, Table 6.13.3.4-1): 4 × 5 × 360 ft = 7200 ft = 86,400 in; weld metal
  (0.3125)²/2 × 86,400 × 0.283565 = 1196.3 lb.
- Strength I envelope on each elevation = 1.25(DC1 + DC2) + 1.50 DW + 1.75 LL+IM (0.90 / 0.65 where the dead load relieves), recomputed in
  the test at every one of 361 stations.
### How verified
- `node tests/engine/run.mjs sheets`: the built-in project and the 5 payloads of #491 (3 to 7 girders, skews 0° to 40° equal and unequal,
  0 to 4 splices), each with its results: 140 sheets; the sheet list; every sheet inside its drawing area, its border 34 × 22 in × k and its
  title block (project, title, scale, n OF N); the cover index; 1560 splice bolts and the plate sizes against the Field splices design;
  68 plan splice plates and the elevation plates and web bolts at each girder's own splice stations; 21,660 envelope points against the
  envelope recomputed from the analysis; 10,830 camber points against the analysis camber; reactions, summary rows, transition locations,
  flange-to-web weld length and studs against the results; largest coordinate difference 5.0e-7 in (the file's 6 decimals); ezdxf 1.4.4 opens
  the 6 sets (R12, up to 2.5 MB) with no audit error and the same entity counts. `node tests/engine/run.mjs drawings` (#491) unchanged.
- Headless browser (`tests/smoke/steel-bridge-drawings.mjs`, three.js from tests/libs): Drawings tab 15 → 25 sheets after Calculate results,
  FS1 preview 100 bolt circles, Download DXF 2.5 MB (validated); 3D view 10 moment fences (5 girders × max / min), close-up G2 with its 9 zoom
  targets, zoom to FS1, shear diagram; 0 console errors.
### Saved data (CLAUDE.md §5)
- No project field and no key changed. `sbd2.ui` (existing key): `dwg` gains optional `paper`, `sheet` (`gi` no longer read); `v3d` gains
  optional `mode`, `dg`, `dsc`, `eng`, and `lay.dg`; absent = defaults. Results are not saved.
### Other copies
- None. The old `Steel Bridge Design.html` is unchanged.
### Open items
- Paper-space layouts (one layout per sheet with a viewport) need a DXF R2000+ writer in shared/dxf.js (SB2-DW6).
- Flange-stress plots along the girder and the jacking / seismic reaction columns would be new calculations here (SB2-DW8, DW9).

## 2026-10-30 — PR: sb-ped-owner — pedestrian load in the analysis, counted once in every module; owner η and m in Flexure (gaps found by the import PR #493)
### Where
- `engine/analysis.js`
  - `loadsOf()`: before `o.PL = M && isNum(M.PL) ? M.PL : 0;` (read only for a warning). After: explicit `girder.loads.PL`, else the loads
    module's share, else `loadsManual.PL`; `o.src.PL`.
  - `analyzeGirder()`, live-load block: `pick(R, get)` takes an optional effect getter. New, after `llR = …`: when `LD.PL > 0`, `area(ei)`
    integrates each effect's influence line (`RH.IL` / `RH.ends`, the HL-93 run's mesh, live-load stiffness) over its positive and
    negative parts, as `shared/moving-load.js` does for the lane load; `ped = { w, Mpos, Mneg, VRpos, VRneg, VLpos, VLneg, R }` = w_PL × the
    areas. Result field `pl: ped` (null without a pedestrian load). `R.ll` stays HL-93 only.
  - The warning "Pedestrian load … not in this analysis yet" removed.
  - `steps()`: new `M.PL.s<k>`, `M.PL.p<k>`, `M.LLPL.p<k>` (LL+IM + PL at the pier, as the modules use it), `R.PL.<k>`.
  - New `llPL(R)` (exported): LL+IM + PL per station and reaction, the pedestrian load once, with `pl: R.pl`.
- Every module that takes this app's analysis now builds LL+IM from `llPL` and carries the pedestrian part:
  - `ui/rating.js fromAnalysis` (Rating and Flexure): `M_LL…`, `V_LL…` include PL; `M_PL…`, `V_PL…` its part; `pedestrianInLL: true`
    (GirderDetail's hand-off format: SB2-R1 keeps flexure and shear from adding it again).
  - `ui/shear.js fromAnalysis`: the same for the stations; `reactions[k].LL` = R_LL+IM + R_PL, `reactions[k].PL`; bearing rows
    `pl: { RLL: [R_PL, R_LL] }`; web-panel shears `pl.VLLp`.
  - `ui/fatigue.js fromAnalysis`: LL+IM + PL only in the Strength I envelope that places the stud regions; M_FAT, V_FAT unchanged (no PL).
  - `ui/welds.js input`: `V.L/R.LL` from LL+IM + PL, `V.L/R.PL` its part (the welds engine tags `row.pl`).
  - `engine/splices.js arraysFromAnalysis`: Mp, Mn, Vp, Vn from `llPL`; `PMp, PMn, PVp, PVn` its part; `demandsAt` builds
    `dem.pl = { MLLp, MLLn, VLL: [part, value] }` as Preliminary sizing's spliceExport (GD45).
  - Constructibility and cross-frames use `analyzeGirder(…, { ll: false })`: no live load, so no PL (deck placement, Table 3.4.1-1 / 3.4.2.1).
  - LL deflection (`R.lld`): HL-93 only (2.5.2.6.2), as GirderDetail SA3.
- `engine/shear.js demands()`: `Qp, Qn` = V_PLpos / V_PLneg (the pedestrian part, in LL or added); `pack()` returns `plLL` (the part of the
  largest |V_LL|, GirderDetail V_PLq); `VuE` keeps m off it; `reaction()` returns `PL`; `fromPayload` sets `loc.pl = { VLL: [plLL, LL] }`.
  `worked()`: step `pl.VLL` / `pl.VLLp`.
- `engine/stiffeners.js`: `stiffenerRows` rows carry `pl: { VLL, VLLb, VLLc }`; `transverseSteps` / `bearingSteps` show the adjustment.
- `engine/welds.js demandsFromPayload`: with `pedestrianInLL` the pedestrian part is now tagged too (before: 0, so m was applied to it).
- `engine/flexure.js`
  - New `factorsOwner(lf, over)` (exported): GirderDetail `gdOwnM(OWN_K.gs)`.
  - `location()`: before `MLLp = num(M.LLp), MLLn = num(M.LLn)`; after `plU('LLp', …)`, `plU('LLn', …)`: with `loc.pl` and m ≠ 1,
    `v − q + q/m` (GirderDetail gdPLe), recorded in `r.plAdj`. `worked()`: steps `own.ll`, `own.sll`, `pl.LLp` / `pl.LLn`.
  - `fromPayload(pl, opt)`: `opt.lf` → `G = factorsOwner(opt.lf, opt.G)`; the Strength I envelope (C_b, region) and `fBotN` take LL+IM with
    m off M_PL (`env.MnE`, as GirderDetail's row builder); locations get `pl: { LLp, LLn }` from M_PLpos / M_PLneg.
- `ui/flexure.js`: analysis source passes `A.pl` as it is (not `noDoublePL`) with `lf`; file source takes the file's `ownerRules`
  (eta.max, eta.min, llMultiplier.m); example source `G = factorsOwner(lf)`. Note line on the tab.
- `ui/fatigue.js`: `fromAnalysis` exported (for the single-count test).
- `engine/sheets.js` (drawing set, #492; coordinator request): `env(A)` → `env(A, P)`. Before: `G = FX.factors()` and `ll = A.ll`. After:
  `G = FX.factorsOwner(SBDOwners.loadFactors(owner, eta, nb))`; LL+IM from `SBDAnalysis.llPL(A)` (pedestrian load once), with m off the
  pedestrian part for the combinations (`v − q + q/m`); the unfactored LL+IM columns show LL+IM + PL. The diagram title states η and m
  when they are not 1. Callers `gelev` and `diag` pass `C.P`. `tests/engine/sheets.test.mjs` recomputes the envelope the same way
  (γ η (m LL + PL)), with the util RIDOT payload run under RIDOT rules (m = 1.2) and the xsA payload with its pedestrian load.
- `tests/engine/splices.test.mjs` app path: compared with the payload's demands including the pedestrian load (was: taken out).
- `engine/autodesign.js` (#494, merged meanwhile) `payloadOf`: the same change as `ui/fatigue.js fromAnalysis` (it is its copy:
  `llPL`, `M_PL…`, `pedestrianInLL`), and its flexure `fromPayload` call passes `lf` (owner η, m) as the Flexure tab. Auto design's
  candidates are checked with the same demands and factors as the tabs.

### Problem (both unconservative)
1. The analysis had no pedestrian load. On bridges with sidewalks every Strength and Service demand lacked it: negative flexure up to
   10.4 % lower than GirderDetail's (xsA RIDOT G1 span 3, 1.040 vs 1.160).
2. `engine/flexure.js` did not apply the owner load modifier η or the design load multiplier m (OWN6/OWN7). RIDOT (m = 1.2) Flexure ratios
   were lower than GirderDetail's. Shear, stiffeners, bearings, splices, welds and cross-frames already applied them (each checked against
   OWN_K: splice, bstf, ts, wt, gs); but where the demand carried a pedestrian part, m was applied to it too (more conservative than
   GirderDetail) or the part was missing.

### Governing provisions (AASHTO LRFD 10th Ed.)
- 3.6.1.6 pedestrian load (the loads module's 75 psf × walkable width, distributed to the girders); applied simultaneously with the vehicular
  live load, no IM (3.6.2.1 applies to vehicles); Table 3.4.1-1: PL takes the LL factor at Strength I, Service I, Service II; not in
  Fatigue I/II (fatigue truck only, 3.6.1.4.1) nor in deck placement (3.4.2.1); not in the LL deflection (2.5.2.6.2: the vehicular load).
- 1.3.2.1 (Eq. 1.3.2.1-2, -3): η on the maximum Strength factors, 1/η on the minimum ones; η = 1 at Service and Fatigue.
- Owner multiplier m (RIDOT BDM 3.4.1.2, OWN6): on HL-93 LL+IM at Strength I and Service (I, II); not on PL (GirderDetail GD45, engineer
  decision 2026-10-15), fatigue, deck placement, LL deflection or the load rating.
- Load rating (MBE): unchanged: GirderDetail's GS20 rates with AASHTO factors without η or m, and with PL in LL+IM (its hand-off's
  `pedestrianInLL`); this app's rating keeps that (`noDoublePL`, no `lf`).

### Formulas (before → after)
- M_PL(x) = w_PL ∫(+ part of the M influence line), and the − part for the minimum (V_PL, R_PL alike). Before: none.
- Strength I, LL term: before 1.75 M_LL+IM (flexure; shear already 1.75ηm V_LL+IM). After 1.75ηm M_LL+IM + 1.75η M_PL, written as
  1.75ηm (M_LL+IM+PL − M_PL + M_PL/m). Service II: 1.30m M_LL+IM + 1.30 M_PL. DC, DW: × η (max), × 1/η (min).

### Check case (hand): xsA RIDOT G1, pier 1, x = 109.99 ft (this app's analysis; RIDOT m = 1.2, η = 1.0)
- M_DC1 = −2030.40, M_DC2 = −1243.04, M_DW = −640.84 kip-ft; HL-93 M_LL+IM = −2047.93 (g_M 0.6421 × −3190.48 per lane, at 110.00);
  w_PL = 0.31974 klf on G1; M_PL = −623.29 kip-ft.
- Before: M_u = 1.25(−2030.40) + 1.25(−1243.04) + 1.50(−640.84) + 1.75(−2047.93) = −2538.00 − 1553.79 − 961.25 − 3583.88 = −8636.93 kip-ft;
  GS7 (compression flange) 41.565/43.263 = 0.961; GS8 0.848.
- After: M_LL+IM+PL = −2047.93 − 623.29 = −2671.22; used = −2671.22 + 623.29 − 623.29/1.2 = −2567.34; γ_LL = 1.75(1.0)(1.2) = 2.10;
  M_u = −5053.05 + 2.10(−2567.34) = −5053.05 − 5391.41 = −10444.46 kip-ft (= −5053.05 + 2.10(−2047.93) + 1.75(−623.29)).
  GS7 50.107/43.328 = 1.157 (GirderDetail 1.160); GS8 50.511/50.000 = 1.010. A pass → fail flip: the point of the fix.
- Synthetic version in `tests/engine/ped-owner.test.mjs` (M_u −7875.0 → −9082.5 kip-ft).

### How verified
- `tests/engine/analysis.test.mjs`: PL against the payloads (M_PL ±, V_PL ±) and against GirderDetail's own `plRow` / `vSec` (added to
  `gd-sa-ref.mjs`), the sample now includes gd_xsA_RIDOT_G1. All 18 payloads with a pedestrian load (scratch run): against GirderDetail's
  functions M_PL 0.004 %, V_PL 0.0001 %, R_PL 0.0006 % (exact vs lumped loads, difference 1); against the payloads 0.21 % (xsA RIDOT G2:
  w_PL rounded to 0.0178 klf in the payload, difference 7).
- `tests/engine/legacy.test.mjs` (the 20 recorded projects, G1–G5, this app's analysis, the Flexure tab's own owner path): LL+IM including PL
  0.000 %, M_PL 0.001 %; negative flexure xsA 0.31 % / 0.26 % (before 10.4 % / 9.6 %), others 0.26 % / 0.32 % (the M_DC1 cross-frame
  difference, unchanged). RIDOT ratios agree including m. Bounds for xsA tightened from 12 % to 0.5 %.
- New `tests/engine/ped-owner.test.mjs`: single count across flexure, rating, shear, bearing reactions, splices, welds, fatigue/studs (none),
  constructibility/cross-frames (no live load), LL deflection (HL-93 only); η, m and the PL part in flexure, shear, transverse and bearing
  stiffeners, welds, splice demands; the hand check.
- Changed ratios and flips: see the PR description (before = the files at 6097439, after = this PR; 20 projects, G1 and G2, every module).

### Decision (engineer, 2026-10-30): cross-frame weight on import
- Keep the actual Cross-frames members (the frame the Cross-frames module checks) for the DC1 point loads. Preliminary sizing's suggested
  frame is not mapped. More accurate; the 0.76 % M_DC1 difference to GirderDetail stays as documented (import entry).

### Saved data (CLAUDE.md §5)
- No key or format changed. New optional `girder.loads.PL` / `loadsManual.PL` (klf), read only when present.

### Other copies
- None (GirderDetail unchanged).

## 2026-10-30 — PR: sb2-dwg-panzoom — Drawings tab: pan and zoom in the sheet preview (engineer's request)
Display only: no computed value changes.
### Where
- `ui/drawings.js` `render`: the sheet preview uses `SharedDxf.viewer` (fixlog/shared-dxf.md) in a box 72vh high.
  - Navigation: wheel zoom about the cursor, drag pan, pinch, double-click or double-tap to fit, and on-canvas +, − and Fit buttons.
  - The Preview drop-down (Fit, 200, 400, 800 %) sets the zoom and follows the wheel, drag and buttons; other levels show as a "N %" entry.
  - `ui.dwg.z` (existing) keeps the drop-down choice.
  - Before: the preview was zoomed by widening the SVG inside a scrolling box.
- `SBDDrawingsUI.viewer()` returns the preview's controller (for tests).
### Check case / How verified
- `tests/smoke/steel-bridge-drawings.mjs`: wheel zoom to about 400 %, the page not scrolled, the point under the cursor fixed, drag, +, the 200 % drop-down entry and double-click fit back to the original viewBox; 0 console errors.
### Saved data
- No change (`sbd2.ui` `dwg.z` as before).
## 2026-10-30 — PR: sbd2-autodesign-1 — Auto design: engine and basic tab (engine/autodesign.js, Auto design tab; new files)
### Where
- New `apps/steel-bridge/engine/autodesign.js` (`window.SBDAutoDesign`): Auto design, which replaces Preliminary sizing's Suggest
  (quick suggestion, Full design `suggestFull`), its Alternatives study and ST-Girder's Optimize (`OptimizeTab`) in the new app.
  Modes New design / Refine current design / Check one change; objectives lightest steel / shallowest depth / lowest cost (price list:
  $/lb, $ per flange transition, field splice, intermediate stiffener). Functions: `settings`, `layoutOf`, `segmentsOf`, `projectWith`,
  `lineWeight`, `costOf`, `proportions` (6.10.2 and the depth rule, as steps), `boltFitWidth` (DT10), `payloadOf` (a copy of
  ui/fatigue.js `fromAnalysis`, the analysis passed in), `evaluate` (screen / full), `sizeFlanges` (Preliminary sizing `sizeFlanges`
  on required areas at the check locations), `design`, `trim`, `run` (generator), `runChunked`, `apply`, `undo`.
- New `apps/steel-bridge/ui/autodesign.js` (`window.SBDAutoDesignUI`): the Auto design output tab (inputs, Run / Stop with progress,
  ranked list, plates and worked steps of a candidate, Apply, one-step Undo, the dropped and blocked lists).
- `engine/model.js`: header only (the optional `autodesign` field). `apps/steel-bridge/index.html`: two script tags, the tab button,
  the drawOut hook. No storage key or saved format changed; `P.autodesign` is optional (absent = the defaults).
- New tests: `tests/engine/autodesign.test.mjs`, `autodesign-parity.mjs` (parity run), `record-autodesign-legacy.mjs` (legacy runs in
  Node), `ad-fixture.mjs`, `legacy-closure.mjs` (loads a legacy function with every top-level declaration it names, before running it),
  `st-legacy.mjs` (ST-Girder's page text, `stDecl`, `stAdopt`: gdCheck and gdAdopt of "Pull from GirderDetail").
  Recorded results: `tests/projects/sbd2-autodesign/`.
### Problem
- New module (docs/REBUILD_PLAN.md §5: "Preliminary sizing, Suggest and Optimize run on the same engine"; Auto design spec approved 2026-10-29).
### Governing provision
- No new check: every check is the module's own (AASHTO LRFD 10th Ed. (2024): 6.10.1–6.10.9, 6.10.3, 6.10.4, 6.10.5, 6.10.7, 6.10.8,
  App. A6, 6.6.1.2, 6.10.10, 6.10.11, 6.7.4, 6.13.6.1). Sizing rules, worked as steps on each candidate: 6.10.2.1.1 (D/t_w ≤ 150),
  6.10.2.2 (b_f/2t_f ≤ 12, b_f ≥ D/6, t_f ≥ 1.1t_w, 0.1 ≤ I_yc/I_yt ≤ 10), Table 2.5.2.6.3-1 (minimum depth 0.027L continuous /
  0.033L simple, the optional criterion Preliminary sizing applies), 4.6.2.6.1 (b_eff = tributary width when the girder count changes).
  Owner plate rules (engine/owners.js, OWN14): def.minTw, def.minTf, def.minBf, def.incD, def.incBf, def.thk, def.sLo; flange.weld
  (MassDOT 1300 lb, RIDOT 800 lb minimum saving per transition), flange.sizes (MassDOT ≤ 3 sizes between bolted splices), spl.ovs
  (CTDOT 2 in edge distance in the bolt-fit width).
- No formula, factor, unit or code reference of any module changed.
### Check case (hand, in tests/engine/autodesign.test.mjs)
- Layout 100 ft, D = 60, t_w = 1/2, top 16 × 1, bottom 18 × 1 1/2, 5 girders: A = 16 + 27 + 30 = 73 in²;
  W_line = 73 × 490/144 × 100 = 24,840.3 lb; W = 124,201.4 lb; cost with 4 stiffeners = 3.00(124,201.4) + 5(150)(4) = $375,604.
- 6.10.2: D/t_w = 120 (0.800 of 150); b/2t = 8.0 / 6.0; D/6 = 10 ≤ 16; 1.1t_w = 0.55 ≤ 1; I_yc/I_yt = 341.33/729.0 = 0.468;
  depth 0.033(100)(12) = 39.6 ≤ 62.5 in.
- Bolt fit (7/8 in bolts, t_w 9/16, web splice plate 1/2, c_w 1/2, C_1 1.5, g 3 in): AASHTO e_min 1.125: g0 = ⌈2.406⌉¼ = 2.5,
  two lines 2(2.5 + 3 + 1.125) = 13.25 in; CTDOT edge 2 in: g0 = ⌈3.281⌉¼ = 3.5, two lines 2(3.5 + 3 + 2) = 17.0 in (> 16 in: the DT10
  note, SB2-SP7), one line 2(3.5 + 2) = 11.0 in.
### How verified
- `node tests/engine/run.mjs autodesign`: hand checks; the full-check payload equals the Fatigue & studs tab's own (every FA, SC and
  GS17 ratio identical); a Refine run on the built-in project where every candidate is re-checked by the tabs' own builders (Fatigue &
  studs with its own analysis, Cross-frames, Field splices) and passes; CTDOT: DT3/DT7/DT10 never fail on a design (the bolt fit held),
  CF11 and DT4 reported as blockers; Apply / Undo.
- Legacy runs in Node (`record-autodesign-legacy.mjs`, page text of "Steel Bridge Design.html"): Preliminary sizing's Full design
  (`suggestFull`) on all 20 recorded projects (about 11 to 45 min each), and ST-Girder's Optimize sweep on each girder hand-off.
- Parity (`autodesign-parity.mjs`; every design, legacy and new, judged by this app's full check on the same sbd2 project; weight =
  all girders, plates only). Done for 6 of the 21 projects; the other 15 are pending (PR 2):
  | project | Auto design | Full design (legacy) | ST-Girder Optimize | current |
  |---|---|---|---|---|
  | builtin_AASHTO | 406,234 lb, D 70, passes all | 406,113 lb, fails BS6 (pier flanges narrower than 2b_t + t_w) | 432,170, fails FA1 | 436,032, fails FA1 |
  | builtin_RIDOT | 421,153, D 62, passes all | 406,113, fails BS6 | no passing sweep point (Deck −M fails at every t_fb) | fails FA1 |
  | builtin28_AASHTO | 406,413, D 72, blocked (SC1, CF3) | 401,136, fails BS6 | 436,032, fails SC1 | fails SC1, CF3 |
  | builtin28_RIDOT | 427,046, D 65, blocked (SC1, CF3) | 401,136, fails BS6 | no passing sweep point | fails SC1, CF3 |
  | util_AASHTO | 417,449, D 70, passes all | 397,206, fails GS7 at the piers | 436,032, fails FA1 | fails FA1 |
  | util_RIDOT | 424,548, D 65, passes all | 397,206, fails GS7 | no passing sweep point | fails MT1 (splice) |
  No legacy design passes this app's full check on these projects, so none is a weight to beat; the closest, builtin_AASHTO, is
  0.03 % lighter than Auto design and fails BS6. Blocked: SC1 (stud fatigue pitch with the skew radial term at 28°; the auto pitch
  zones omit it) and CF3 (cross-frame members) fail whatever the plates. RIDOT ST-Girder: its deck design check (Deck −M) fails at
  every swept size, so Optimize has no answer. ST-Girder was run without the GirderDetail host functions (loadShedRbG, webFcrw) that
  the embedded page supplies; PR 2 re-runs it through tests/engine/st-source.mjs (stEngine, merged meanwhile).
### Other copies
- `payloadOf` is a copy of ui/fatigue.js `fromAnalysis` (the analysis passed in instead of run again); the test compares them.
### Decisions (made here, per the engineer's rule of 2026-10-29)
- SB2-AD1. Splice bolt fit (DT10) is a sizing constraint: the flange of each field piece next to a splice is at least the bolt-fit width
  of `splices.bolts.minLines` gage lines (the formula of engine/splices.js autoDesign `needB`, the owner's edge distance). Where that
  rule raised a width, the same design is also sized with one gage line each side of the web (splices.bolts.minLines = 1 on Apply), and
  the objective picks (lightest steel: usually one line, since the splice plates are not in the girder weight; lowest cost: the same,
  as the price list has no splice-plate term). Recorded as the engineer asked (task note of 2026-10-30).
- SB2-AD2. Screen live load: the per-lane live-load envelopes (the moving-load run, 5 to 8 s a girder) are taken from one run on the
  current stiffness for every screened trial; the distribution factors, dead loads and every check are each trial's own. The full check
  of a finalist runs the live load on its own stiffness. Accuracy is kept by the full check (a finalist that fails drops out).
- SB2-AD3. Flexure in Auto design runs on this app's analysis through engine/flexure.js `fromPayload` (the path the Fatigue tab uses for
  GS17), with the project's deck rebar (two layers), modular ratio (w_c for E_c, K_1, the n rule), grades and f_ℓ from the skew
  (C6.10.1, as the Flexure tab's file path); the Flexure tab itself still runs the example or a hand-off file.
- SB2-AD4. One layout for every plate girder of the project (Suggest's "envelope"), checked girder by girder.
- SB2-AD5. A new girder count spaces the girders equally over the same out-to-out girder width and sets b_eff to the tributary width
  (4.6.2.6.1); the overhangs are kept.
- SB2-AD6. Blocked designs: a finalist whose every failing check also fails in the current design (module and check id; detail inputs
  the plates do not change, e.g. CTDOT CF11 bolts per cross-frame member end, splice end distances DT4) is listed apart as "blocked by
  detail checks", never as a passing candidate, with those checks named.
- SB2-AD9. Bearing stiffener fit (BS6, 6.10.11.2.1: b_t ≤ (b_f,min − t_w)/2) is a sizing rule: the flanges of a field piece over a bearing are at
  least 2b_t + t_w (the Stiffeners tab's bearing types: A at the abutments and simple-span ends, B at the piers). Without it the lighter
  designs failed BS6 on the full check (found on the recorded projects; Preliminary sizing's Full design fails it the same way).
- SB2-AD10. A finalist that fails a plate-controlled check on the full check (flexure, shear, constructibility, GS17, FA1, BS6, splice DT3/DT7/
  DT10) is resized from where it is, with the screen's live load re-run on its own stiffness, and checked again (up to twice).
- SB2-AD7. Required areas are carried at the check locations themselves (both sides of a plate change), so a zone's resizing uses only
  its own side's ratios. Area update per trial: A f(r), f = min(1.02r, 1.35) above 1, max(r/0.97, 0.8) below (Preliminary sizing's Full
  design). Fatigue details FA1 are in the screen (they depend on the flange areas).
### Open items
- SB2-AD8. engine/splices.js autoDesign keeps the default end distances e_f, e_p (1.75 in) under CTDOT's 2 in edge rule (DT4 fails on
  every auto-designed CTDOT splice, as in GirderDetail); and the built-in cross-frame connection has 2 bolts per member end against
  CTDOT's 4 (CF11). Both block every Auto design candidate of a CTDOT project until the detail inputs change. Engineer to decide whether
  the splice auto-design should set the end distances to the owner's edge distance.
- PR 2: side-by-side compare, locks, the full price-list editor, links from the governing check into the module's steps; the 15 pending
  parity projects; the Rating and Welds modules (merged meanwhile) in the full check.
## 2026-10-30 — PR: sb2-paths-consistent — every demand path takes the same brace points and f_ℓ (SB2-W1, SB2-W2 closed); one analysis cache for every tab; Welds demand source and report section
### Decisions (engineer, 2026-10-30; recorded with the reasoning)
- SB2-W1 (f_ℓ). The skew f_ℓ of C6.10.1 is the default on every path (this project's analysis and a hand-off file) for Flexure,
  Constructibility and Rating: 1.25 × 10 ksi on an interior girder and 1.25 × 7.5 ksi on an exterior girder where any support is skewed
  more than 20°, else 0 (engine/framing.js flSkew, as GirderDetail and Preliminary sizing). An f_ℓ entered overrides it: on the Flexure
  tab for Flexure and Rating (saved, `P.flexure.fl`), on the Constructibility tab for deck placement (`P.constr.flC`, as before).
  Reasoning: C6.10.1 gives these values as the estimate to use in the absence of a refined analysis of the cross-frame forces on a skewed
  bridge. Taking f_ℓ = 0 on one path and the estimate on another gave two answers for the same girder, and the 0 was unconservative on
  skewed bridges. The C6.10.1 value is one unfactored total with no split by load, applied with γ = 1.25 at Strength I (SB2-O11, kept), the
  same value at Service II, and the same value during deck placement. Deck placement is where the cross-frame forces from differential
  deflection on a skewed bridge arise, so the C6.10.1 value applies there too. An entry of 0 or a blank means "none entered" and takes the
  skew value, as the file path did before; to model a refined analysis that gives a very small f_ℓ, enter that value (> 0).
- SB2-W2 (brace points). The Framing tab's stations (engine/framing.js forGirder: the girder's own bearings and cross-frames, its own
  unbraced lengths) are the brace points on every path. This was already so for Constructibility and for the Flexure file path. It is new
  for the Flexure analysis path and for Rating on both paths. Reasoning: the framing is the real framing (Preliminary sizing's layout, with
  splice and shop-transition clearances and skewed-support rules, parity-tested in framing.test.mjs). The stiffener layout's
  `frames.Lb` fallback (cross-frames evenly ≤ 25 ft) was not the framing the girder is built with. Fallback when the project has no framing
  (version 1 projects) or the layout has errors: the stiffener layout's cross-frames, as before, said so on the tab. A file of another
  bridge keeps the file's own spacing (SB2-O9, unchanged).
- Flexure file path and owner rules (decided here, engineer's rule of 2026-10-29: accuracy). The Flexure tab's file path now takes the
  file's owner (`pl.ownerRules.owner`; OWN8: haunch 0 in the section properties for RIDOT and MassDOT), as the Rating file path did.
  Reasoning: GirderDetail computed the file's results with its owner's rules, and Rating takes its flexure from the Flexure tab now, so
  one rule is needed. Keeping the owner keeps the Rating file results unchanged on this point.
- One source. `engine/framing.js design(P, gi, o)` (new; anchor `function design(P, gi, o) {`) returns the brace points and f_ℓ. ui/flexure.js
  (every source, including the example's f_ℓ), ui/constructibility.js and, through ui/flexure.js, ui/rating.js take them from there. The
  Rating tab's flexure is now ui/flexure.js `build()` itself (`SBDFlexureUI.build(fromAn ? { P, g, src: 'analysis', an: { pl, R: AR },
  method: 'auto' } : { P, g, src: 'file', pl, … })`; before, its own copy of the payload set-up). So the Rating, Flexure and Report flexure
  cannot differ.
- Shared cache. `report/data.js install()` (new; called once by index.html) puts every `SBDAnalysis.analyzeGirder` call through the
  report's analysis cache (#490). That covers the Analysis, Flexure, Shear, Fatigue, Constructibility, Cross-frames, Splices, Rating and
  Welds tabs and the report. The key is the project JSON without `rating` and `flexure` (the analysis reads neither; grep) | girder | options.
- Welds. The demand source selector ("This project's analysis" / hand-off file, as the Rating tab) and the "Demands: …" line
  (`SBDAnalysisUI.srcBar`). The file path uses `engine/welds.js demandsFromPayload` (unchanged engine) with this tab's F_EXX, weld size,
  load factors and grinding (P.welds). Report: new section `wd` "Welds (flange-to-web, shop transitions)", after Splices, before Rating.
  It has the governing FW and TR rows in the summary (groups "Welds: flange-to-web (FW1–FW4)", "Welds: shop flange transitions (TR1–TR4)",
  so the every-girder scope has them too), the check table and the worked steps of the governing locations (all locations with detail
  "all"). The engine's notes "see §sec.s" (a group of steps) are linked in the report to that section's ȳ step (`sec.s.yb`, `sec.c3.yb`,
  `sec.cn.yb`, `sec.cr.yb`).
### Where (anchor text; before → after)
- `engine/framing.js`: new `design()` (anchor above), exported. `flSkew` step strings: before `sym: 'f_{\ell}', eq: … '\gamma f_{\ell,skew}'`
  (single backslash in a JS string: shown as "f_{ell}", "gamma f_{ell,skew}"); after `'f_{\\ell}'`, `'\\gamma f_{\\ell,skew}'`. Display only.
- `ui/flexure.js` `inputs(ctx)`: file branch `const D = FRM.design(P, ctx.g, { sup, line, skews, ext, fl: flIn })` (before: forGirder + flSkew
  inline, same values). Analysis branch: before `const fr = ((P.stiffeners || {}).layout || {}).frames …; if (flIn > 0) fopt.fl = flIn;` →
  after `const D = window.SBDFraming.design(P, gi, { fl: flIn }), fopt = { owner: own, rebar: d.rebar, fl: D.fl }; if (D.br) { fopt.braces =
  D.braces; fopt.lenOf = D.lenOf; } else { …stiffener layout as before… }`. Example branch: `fl: S.fl` → `fl: DX.fl` (DX = design on the
  project). `flIn = ctx.fl != null ? ctx.fl : S.fl` → `… : flEntered(P)` (P.flexure.fl). The input `#fx_fl` writes `P.flexure.fl` through
  `ctx.changed()` (blank/0 removes it). `build(ctx)` takes `ctx.an` (a fromAnalysis result already run) and returns `D`.
- `ui/rating.js build()`: the block from `// flexure: the Flexure tab's locations` to `const Gr = FX.girder(…)` → `const Gr =
  window.SBDFlexureUI.build(…)` (above). `what` names the brace points and f_ℓ.
- `ui/constructibility.js`: new `build(ctx)` (the old `calc()` body, now also used by the report); `flOf(P)` returns only an entry > 0;
  `flC: flOf(P)` → `flC: D.fl` with `D = FRM.design(P, g, { fl: flOf(P) })` (file: `{ sup, line, skews, ext, fl }`); braces from `D.br` (same
  as before). Input: blank or 0 removes `P.constr.flC`; the placeholder shows the skew value.
- `engine/constructibility.js` step `cn.fl` note: "First-order f_ℓ during deck placement as entered;" → "… as entered, else from skew
  (C6.10.1; Constructibility tab);". Text only.
- `ui/welds.js`: `S.src`, `srcOf()`, `input(P, gi, pl)` (file branch), `build(ctx)` with `src`, `pl`, `plName`, `what`; the selector, file
  input and `srcBar` line in `render`.
- `report/data.js`: `install()`, `RAW`; flexure without `fl: 0`, and with the analysis taken from `B.rating.flex` (the same build);
  constructibility from `SBDConstrUI.build` (the local `constr()` copy removed); `B.wd` from `SBDWeldsUI.build`; `pkOf` leaves out `flexure`.
- `report/builders.js`: `SECTIONS` gains `['wd', 'Welds']`; new `wd(B, X)`; `flNote`, `brNote`. The Flexure note's "f_ℓ = 0" and
  "cross-frame stations of the stiffener layout" are replaced by the actual source. The Constructibility note's "f_ℓ during deck placement
  0 (the tab's default)" was wrong since #490 when an f_ℓ was saved; it now gives the value used.
- `engine/model.js`: `flexure: { fl }` documented and validated (number ≥ 0; anchor `// added 2026-10-30 (paths PR, SB2-W1)`);
  `constr.flC` doc updated.
- `index.html`: `SBDReportData.install()` after the store set-up; the Flexure tab's ctx gains `changed`.
### Governing provisions (AASHTO LRFD 10th Ed. 2024)
- C6.10.1 (f_ℓ in lieu of a refined analysis: 10 ksi interior, 7.5 ksi exterior, total unfactored); 6.10.1.6 (f_ℓ ≤ 0.6F_yf, Eq.
  6.10.1.6-1; amplification Eq. 6.10.1.6-4/-5); 6.10.3.2 (deck placement, Eqs. 6.10.3.2.1-1, -2, 6.10.3.2.2-1); 6.10.4.2.2 (Service II,
  Eq. 6.10.4.2.2-2); 6.10.7.1 (Eq. 6.10.7.1.1-1, composite compact); 6.10.8.1 (Eqs. 6.10.8.1.1-1, 6.10.8.1.2-1, 6.10.8.1.3-1); 6.10.8.2.3
  (L_b); 6.7.4.2.1 (cross-frame layout); MBE 6A.4.2 (rating). No equation, factor or unit changed: the inputs f_ℓ and L_b change.
### §4 callout: before → after
- Inputs before → after:
  - f_ℓ (Strength I, Service II; Flexure and Rating, analysis path): before = entered, else 0; after = entered, else
    1.25 × (10 interior / 7.5 exterior) ksi where max |support skew| > 20°, else 0.
  - f_ℓ during deck placement (Constructibility, both paths): before = `P.constr.flC`, else 0; after = `P.constr.flC` if > 0, else the
    same skew value.
  - f_ℓ, Rating file path: before 0; after as the Flexure tab (entered, else the skew value).
  - L_b (Flexure analysis path; Rating, both paths): before = the stiffener layout's `frames.at`, else every span divided evenly at
    ≤ `frames.Lb` (25 ft default); a file used its own `bracing.Lb` evenly. After = the Framing tab's stations of that girder
    (`forGirder`; own lengths via `lenOf`).
  - Flexure file path, owner rules: before none (the payload's haunch in the section properties); after the file's owner
    (`pl.ownerRules.owner`): OWN8, haunch 0 in the section properties for RIDOT and MassDOT. This is how GirderDetail stored the file and how
    the Rating file path already took it; without it, Rating could not take its flexure from the Flexure tab and stay unchanged there.
- Counts, this project's analysis. The built-in project plus the 100 girders of the 20 recorded projects (tests/projects/st/gd_*.json:
  builtin, builtin28, curb, util, xsA × AASHTO, CTDOT, MassDOT, RIDOT × G1–G5). Each is an sbd2 project with its own cross-section
  (n_b, spacing, skews), default framing settings and the file's field splices. Same project object before/after, in Node:
  - f_ℓ changed at 7,420 of 37,467 locations: the 20 builtin28 girders (28° skew; 9.38 ksi exterior, 12.50 ksi interior). Every other
    project is skewed 15° (≤ 20°) or 0°, so f_ℓ stays 0.
  - L_b changed at 7,051 of 37,467 locations.
    - built-in: 91 of 367;
    - builtin28: 1,855 per owner (RIDOT 1,395); at 28° the frames are normal to the girders and staggered;
    - all 15° projects: 0 (the framing equals the evenly spaced fallback).
  - Flexure check ratios: 7,459 of 155,590 changed, plus 14,877 GS10 rows (Eq. 6.10.1.6-1, f_ℓ ≤ 0.6F_yf; the engine lists GS10 only
    when f_ℓ > 0) on the skewed girders. Largest change: built-in, x = 251.00 ft GS7 0.769 → 1.184 (L_b 22.00 → 24.20 ft at the span 3
    side of pier 2).
    - Pass/fail flips: 13 location checks. 5 on the built-in (GS7 near pier 2; the girder already governed NG, 1.142 → 1.229) and 4 each on
      builtin28 RIDOT G1/G5 (governing GS7 0.911 → 1.066, now NG; explained below).
  - Constructibility ratios: 22,260 of 187,335 changed, all on the builtin28 girders. 0 flips.
    - Governing, interior girders: 0.435–0.535 → 0.685–0.940 (CTDOT G3 0.535 → 0.940);
    - Governing, exterior girders: the overhang brackets govern (OH, unchanged): 0.576 → 0.576, RIDOT 0.526 → 0.552.
  - Rating RFs (Inventory and Operating): 29,832 of 350,384 changed.
    - Flips: 15 RF values: built-in 7 (pier 2; the governing Inventory RF 0.739 → 0.608 was already < 1), RIDOT G1/G5 4 each.
    - Governing Inventory RF on builtin28: AASHTO G1/G5 1.146 → 1.042, G3 1.288 → 1.117; CTDOT G1 1.231 → 1.118, G5 1.231 → 1.043;
      MassDOT G1/G5 1.130 → 1.021; RIDOT G1/G5 1.177 → 0.873 (flip), G2–G4 1.305 → 1.139; interior G2/G4 at most −0.002.
- Counts, file path (the same 100 payloads, each with its own project, so the file is "of this bridge" and the framing applies):
  - Flexure tab: f_ℓ and brace points unchanged (already the framing and the skew f_ℓ).
    - 81,255 of 168,756 ratios changed, all on MassDOT and RIDOT payloads (OWN8 haunch 0); governing +0.005 to +0.008.
    - 18 local flips at GS7/GS8 near the piers of xsA MassDOT/RIDOT girders (0.988–0.998 → 1.001–1.009); those girders already
      governed NG at 1.05–1.13.
  - Rating: 39,504 of 346,944 RFs changed.
    - Causes: f_ℓ on builtin28 (governing Inventory RF as on the analysis path, e.g. RIDOT G1 1.177 → 0.873); brace points everywhere.
    - Brace points: the file's L_b = 23.33 ft divided span 2 (140 ft) into ⌈140/23.33⌉ = ⌈6.0009⌉ = 7 panels of 20.00 ft. The framing has
      6 panels of 23.33 ft, the girder's real cross-frames.
    - 56 RF flips: negative flexure at x = 111/112/248/249 ft of the xsA girders, e.g. AASHTO G2 x = 111 ft Inventory 1.157 → 0.846. They
      are not the governing values (governing Inventory RF on xsA unchanged, 0.743–1.081).
  - Rating's flexure = the Flexure tab's flexure on all 100 payloads (every ratio identical).
- The RIDOT G1/G5 flip, explained (builtin28_RIDOT_G1, this project's analysis, governing GS7 Eq. 6.10.8.1.1-1 at x = 249.99 ft):
  - before (L_b 22.00 ft evenly, f_ℓ = 0): f_bu = 39.326 ksi ≤ φ_fF_nc = 43.156 → 0.911;
  - the framing alone (L_b 24.52 ft: span 3's first frame 24.52 ft from pier 2): F_nc 41.960 → 39.322/41.960 = 0.937;
  - f_ℓ alone (9.38 ksi exterior, amplified 1.480 by Eq. 6.10.1.6-4 → 13.88): (39.326 + 13.88/3)/43.156 = 1.019;
  - after, both: f_ℓ = 9.38 × 0.85/(1 − f_bu/F_cr) = 9.38 × 1.725 = 16.18 ksi; (39.322 + 16.18/3)/41.960 = 44.715/41.960 = 1.066 NG.
    Inventory RF 1.177 → 0.873.
  - Both inputs now are what the engineer decided (the real framing, the C6.10.1 estimate on a 28° skew), and the arithmetic is the
    unchanged 6.10.8 / 6.10.1.6 path. No unexplained difference.
### Check case (tests/engine/paths.test.mjs "Hand check (SB2-W1)")
- Built-in project with every support skewed 28°, G1 (interior), x = 44 ft (span 1, positive flexure), this project's analysis.
  f_ℓ = 1.25(10.00) = 12.50 ksi (largest skew 28° > 20°); before 0.
  - GS12 Service II bottom flange (Eq. 6.10.4.2.2-2): f_f = 26.692 ksi, 0.95R_hF_yf = 0.95(1.0)(50) = 47.50 ksi.
    Before: (26.692 + 0/2)/47.50 = 0.5619. After: (26.692 + 12.50/2)/47.50 = 32.942/47.50 = 0.6935.
  - GS6 composite compact (Eq. 6.10.7.1.1-1): M_u = 4,998.44 kip-ft, S_xt = 1,775.29 in³, φ_fM_n = 9,616.14 kip-ft.
    Before: 4,998.44/9,616.14 = 0.5198. After: (4,998.44 + 12.50(1,775.29)/3/12)/9,616.14 = (4,998.44 + 616.42)/9,616.14 = 5,614.86/9,616.14 = 0.5839.
  - GS10 (Eq. 6.10.1.6-1): 12.50 ≤ 0.6(50) = 30 ksi, ratio 0.4167 (before 0).
- Brace points (SB2-W2), built-in project (no skew), G1, x = 250.01 ft (pier 2, span 3 side): the Framing tab puts span 3's first frame
  at 274.2 ft (spans 1 and 3 shifted 0.1 panel = 2.2 ft, because the frames at 88 and 272 ft would fall on the shop flange transitions at
  88 and 272 ft). Before: the evenly spaced stiffener-layout fallback had it at 272 ft. L_b 22.00 → 24.20 ft. GS7 (Eq. 6.10.8.1.1-1, f_ℓ = 0):
  F_nc = F_cr 34.968 → 32.499 ksi, ratio 1.1345 → 1.2207. The governing Flexure location of the girder moves from x = 110.01 ft
  (1.142) to x = 249.99 ft (1.229). Inventory RF 0.739 → 0.608 (already < 1; GS7 was already NG: no flip).
### How verified
- `node tests/engine/run.mjs` (full suite). New `tests/engine/paths.test.mjs`:
  - one source, analysis path: f_ℓ and brace points equal across Flexure, Constructibility and Rating, interior and exterior girders,
    entries override, 0 returns to skew;
  - one source, file path: the same;
  - the cache: two analysis runs for six tabs, then none on switching; the report hits the cache; the cached result is unmodified; a
    project change runs again; P.flexure is not in the key;
  - the Welds report section: both detail levels, every girder, file; all references resolve, KaTeX parses;
  - the hand check above.
  Updated: report.test.mjs (13 sections, 10 with three left out), report-wiring.test.mjs (the report's flexure is now the rating's
  object), flexure/rating tests load ui/flexure.js and engine/framing.js.
- Before/after in Node: origin/main vs this branch, report/data.js compute on the same project object (scratch script, not committed).
- `node tests/smoke/steel-bridge-paths.mjs` (headless Chromium, one run): Flexure calculates (one analysis); Rating, Shear, Fatigue and Welds then calculate in 3.6 s with no new analysis (cache size 1); Constructibility adds the dead-load run (2); back to Flexure, and the Report: still 2. The Welds tab shows "Demands: This project's analysis of G1 (the default: …)" and the selector [analysis, file]. f_ℓ 2.5 is written to `sbd2.project.current` (`flexure.fl`). The report (selected girder) has 13 sections, Welds among them. 0 console errors, 0 KaTeX errors.
### Saved data (CLAUDE.md §5)
- Additive: `P.flexure.fl` (optional; absent = none entered). `P.constr.flC` keeps its key and format; its meaning when absent or 0
  changes from "0" to "the skew value" (the decision above). No migration is needed: an older project reads as "none entered". No
  localStorage key changed.
### Other copies
- None. GirderDetail (`Steel Bridge Design.html`) is not changed: its Girder section already takes the skew f_ℓ from Preliminary sizing.
### Open items
- The governing Welds rows are the largest ratio of each group, as the tab shows them; on the built-in project that is FW4 (minimum
  fillet size, ratio 1.000: the minimum size is used) and TR2 (taper 1:2.5, ratio 1.000). A strength-only governing row may read
  better in the summary; not changed (display choice for the engineer).
- The analysis cache key leaves out `rating` and `flexure`. Any other change to the project, even one the analysis does not read
  (e.g. `constr.oh`, `welds`), runs the analysis again (safe, slower).
- f_ℓ = 0 cannot be entered as an override on a skewed bridge (0 means "none entered", as on the file path before); enter a small
  positive value if a refined analysis gives about 0.
- The engineer asked for the skew f_ℓ "from crossframes.js". It lives in engine/framing.js (`flSkew`, added with the cross-frames PR #479);
  that function is used, unchanged.
- Auto design (engine/autodesign.js, #494, merged while this PR was open; not changed here, another module's file): its trial checks take
  the skew f_ℓ for flexure (as decided), but not an f_ℓ entered on the Flexure tab (`P.flexure.fl`), and `flC: 0` during deck placement
  (SB2-W1: the skew value, or `P.constr.flC`). Suggested follow-up: take both from `SBDFraming.design(P, gi, { fl })`.

## 2026-10-30 — PR: sb2-gfx-helper — graphics helper for the output tabs in the Drawings-tab format (ui/graphics.js, window.SBDGraphics)
Display and export only: no computed value changes, no saved-data change. Engineer (2026-10-30): "I love the format of the drawing in the Drawings output tab. Use that for graphics on the other tabs."
### Where
- New `ui/graphics.js` (script tag after `ui/drawings.js` in `index.html`). Not a shared library: one app file, API in its header comment.
  - Every graphic is a `SharedDxf.drawing` (layers `S-GRDR`, `S-GRDR-PLAT`, `S-BRNG`, `S-DIMS`, `S-ANNO-TEXT`, `S-XFRM`, `S-SPLC`, text height h with `D.k = h / 0.10`, so the linetypes are the Drawings tab's), drawn by `SharedDxf.toSVG` and `SharedDxf.viewer` (wheel zoom at the cursor, drag, pinch, double-click fit, + / − / Fit).
  - `elevation(P, gi, opts)`: girder `gi` from `SBDDrawings.model(P)` (supports, plate segments of `P.girders[gi]`, cross-frame stations of the first section girder loaded by it, splices) in analysis stations (ft × 12 in), with plate sizes, span dimensions and a stations axis (ticks at a 1-2-2.5-5 step, grid on layer `S-GRID`). Vertical exaggeration `vex` (auto, up to 6, labelled by the tab) so the girder reads. Returns the drawing, `X(ft)`, `Yweb(ft)`, `alloc(height)` (a new row under it), `pick(x, y)` (station) and `selMark(ft)`.
  - `ratioLayer(E, items, opts)`: layers `S-RATIO-OK` (green, < 0.8), `S-RATIO-WARN` (amber, 0.8 to 1.0), `S-RATIO-NG` (red, > 1.0 or not ok): vertical hatching in the web, a row of bands with the values, a legend. Each location takes the stretch to the mid-points of its neighbours. `ratioColor(ratio, ok)`.
  - `chart(opts)`: drafted XY plot (axes `S-AXIS`, grid `S-GRID`, series `S-CHART-S1…`, limit line `S-CHART-LIMIT`, vertical lines, bars with categories); `X`, `Y`, `pick`. Can draw into an existing drawing at a given origin and width (so a diagram can sit under an elevation on the same x scale, x = ft × 12 in).
  - `mount(el, build, opts)`: title, readout, Download DXF (validated first), the viewer. Click (not a drag) calls `opts.onSelect(pick(x, y))` and moves a live highlight (overlay, not in the DXF); `H.select(v)` moves it from the tab's selector without rebuilding; hover shows `readout(v)`; `opts.key` keeps the zoom and pan across re-draws of the same view (restored by zooming about a computed point; the viewer has no pan call). Print: the box grows to its content and the buttons hide.
### Check case / How verified
- `tests/engine/graphics.test.mjs`: the built-in project and the 5 hand-off payloads (as drawings.test.mjs): every coordinate finite, expected layers, supports on the model's stations, plate rectangles on the segment stations, one CF line per cross-frame station, valid DXF R12; ratio colours at 0.79, 0.8, 1.0, 1.0001, not ok, NaN; bands tile the girder; chart mapping X / Y / pick inverse and the RF = 1.0 line at Y(1). Hand check, built-in project: supports 0, 1320, 3000, 4320 in; plate breaks 88, 128, 232, 272 ft; axis step 50 ft (36 → 3.6 → 5 × 10), labels 0, 50 … 350; text height 2 % × 4320 in = 86.4 in.
- `tests/smoke/steel-bridge-graphics.mjs`: wheel zoom, click-select, drag pans without selecting, `H.select`, double-click fit, DXF download; 0 console errors.
### Decisions (engineer's rule: decide small questions, log them)
- Ratio colours: green < 0.8, amber 0.8 to 1.0 (a ratio of exactly 1.0 is amber, the check passes), red above 1.0 or NG (as requested).
- The elevation is in analysis stations (the stations of the results), not in a girder's own stations, so a click gives the station the tab's tables use.
### Saved data
- No change. The zoom memory (`opts.key`) is in memory only.
### Open items
- Tabs use the helper in the next PR (Section properties, Loads & LLDF, Analysis, Flexure, Constructibility); the other tabs are another agent's.

## 2026-10-30 — PR: sb2-gfx-a-tabs — graphics on the Section properties, Loads & LLDF, Analysis, Flexure and Constructibility tabs, in the Drawings-tab format (ui/gfxa.js)
Display and export only: no computed value, formula, factor, unit or saved-data change. Each graphic is drawn from the results the tab's own tables use (the tab's calc / build output); nothing is recomputed. Every graphic is a SharedDxf drawing with a Download DXF button (ui/graphics.js, PR sb2-gfx-helper).
### Where
- New `ui/gfxa.js` (`window.SBDGfxA`), script tag after `ui/graphics.js` in `index.html`. Additive hooks, anchor texts:
  - `index.html` `drawOut()`: a card "Section graphic" (`<div id="gfx_sec">`) before the "Section properties" card, and after `$('out').innerHTML = h;` `SBDGfxA.section(...)`; the Loads tab: `UL.after(...)` after the output's innerHTML.
  - `ui/loads.js`: `<div id="gfx_ld">` in `output()` and the function `after(el, P, R, ui)` (exported).
  - `ui/analysis.js` `resultsHtml` (`<div id="gfx_an">` before the Diagrams card) and `draw` (mount after `el.innerHTML = h`).
  - `ui/flexure.js` `render` (`<div id="gfx_fx">` before "Flexure results by location"; mount after `host.innerHTML = h`; a click on the graphic sets `S.sel` and redraws, as a click on the table row does).
  - `ui/constructibility.js` `render`: the same (`gfx_cn`).
- Graphics:
  - Section properties: scaled cross-section (plates, haunch, deck over b_eff, rebar layers) with the neutral axes at the table's values (steel, 3n, n ȳ; PNA y_p) and a stress diagram for the chosen load case (DC1 steel, DC2/DW 3n, LL n).
  - Loads & LLDF: cross-section with the appurtenance footprints of the Drawings tab, girders (selected one highlighted), lane bands, traffic faces, wheel positions of the case chosen (one-lane lever rule, multi-lane lever rule, rigid cross-section: the positions the LLDF steps use) and the lever-rule influence line of the girder.
  - Analysis: girder elevation (supports, plate breaks, cross-frames CF, splices FS), moments and dead-load deflection (camber) aligned on the same stations, a station selector, click and hover readout.
  - Flexure: elevation coloured by the governing ratio of each location (green below 0.8, amber 0.8 to 1.0, red above 1.0 or NG), demand and capacity bars (ksi checks) and the ratios of every check of the selected location with 1.0 marked, and an unbraced-length sketch (L_b, L_p, L_r, C_b, F_nc from the row).
  - Constructibility: pour sequence over the elevation, M_DCc envelope against M_DC1, the governing deck-placement ratio per location, and the overhang-bracket sketch from the tab's bracket inputs.
### Decisions (engineer's rule: decide small questions and log them)
- Stress diagram of the Section properties tab: the tab has no moments, so it shows the stress per 1000 kip-ft of unit moment on the section the load case acts on, f = M(y − ȳ)/I with the table's I and ȳ (deck stress ÷ n or 3n). It is labelled as a unit-moment diagram; no design stress is shown. Hand check, built-in project, steel section (I = 37,472 in⁴, ȳ = 28.213 in, d = 61.875 in): top of steel 1000 × 12 × (61.875 − 28.213)/37,472 = 10.78 ksi (compression), bottom 1000 × 12 × (0 − 28.213)/37,472 = −9.04 ksi, the figures on the drawing.
- Rigid-cross-section lane and wheel positions are laid out from the traffic face of the governing side using the rule the engine states (outer wheel 2 ft and inner wheel 8 ft from the lane edge, lane width N_L's), because the engine returns only the lane eccentricities.
- The selected-station highlight is a live overlay (not in the DXF); the zoom and pan are kept across re-draws (key per view).
### Check case / How verified
- `tests/engine/gfxa.test.mjs`: the built-in project and 5 payloads: finite coordinates and valid DXF R12 for every graphic (Section: both regions and all three load cases, axes at the table's ȳ; Loads: every girder, region and case, wheels = lever1.wheels × 12 in; Analysis: supports and station readout/pick; Flexure: bands per ratio colour equal the table rows' colours; Constructibility: one rectangle per pour at the pour stations).
- `tests/smoke/steel-bridge-graphics.mjs`: each tab's graphic appears, wheel zoom, the Loads and Section case selectors, click on the Analysis graphic moves the station selector, click on the Flexure graphic changes the selected row, phone width (390 px) with no horizontal scroll, screen and print screenshots; 0 console errors.
### Saved data
- No change.
### Open items
- Section properties, Loads, Analysis, Flexure, Constructibility are done; the other tabs' graphics are agent B's PR.
- A 3D extruded section view (optional in the spec) is not added.
- The grouped worked steps (spec section A) are a later job: the graphics sit in their own blocks above the step lists.

## 2026-10-30 — PR: sb2-gfx-b — graphics on Shear & stiffeners, Fatigue & studs, Cross-frames, Welds, Field splices, Rating and the Report summary
Display only: no computed value, load factor, resistance or saved-data change; every graphic draws the tab's own build() result (no recomputation); the graphics do not change the results they read (tests compare the JSON before and after).
### Where
- New `engine/tabgraphics-b.js` (window.SBDTabGfxB, pure: drawing entities of the Drawings pipeline, regions = click areas), `ui/tabgraphics-b.js` (mounts through `SBDGraphics.mount`; a click sets the tab's own selection `S.sel` and redraws, deferred 350 ms so a double-click still fits). Script tags after `ui/graphics.js` in `index.html`.
- Hooks (one placeholder `<div data-gfxb="...">` in the tab's results and one call after `host.innerHTML`): `ui/shear.js`, `ui/fatigue.js`, `ui/framing.js`, `ui/welds.js`, `ui/splices.js`, `ui/rating.js`; `report/builders.js` summary(): a static `figure` item (SVG, same entities) above the summary table.
- Graphics: shear = elevation (`SBDGraphics.elevation`) with panels hatched by V_u/φV_n, stiffeners (solid connection plate, dashed intermediate), bearing stiffeners, station strip, governing marks; shear-detail = plan sections and broken elevations of the transverse (type A/B) and bearing stiffeners from `P.stiffeners` types. fatigue = details at station and height coloured by FA1, stud zones (rows @ pitch, count = (⌊L/p⌋+1)×rows as the Drawings quantities) coloured by SC1; fatigue-chart = γ(Δf) and (ΔF)n along the girder (`SBDGraphics.chart`). crossframe = X/Kb/Kt frame of `R.N`, members numbered with a table (section, L, largest T/C), governing group (step `cf.top|bot|diag`) on S-GOV. welds = weld runs (orange) and FW/TR locations coloured by their largest ratio; weld-detail = T joint at 6× with sizes dimensioned and the Table 6.13.3.4-1 minimum. splice = top flange plan, web elevation, bottom flange plan with the largest strength-ratio group (rule of `ui/splices.js` strGov) on S-GOV (the existing plain SVGs stay). rating = RF along the girder (Inv/Opr, flexure/shear), RF = 1.0 limit line, governing rows circled; click selects the row with the least Inventory RF at that station. summary = elevation, governing check of each group at its location, span bands by `ratioLayer`.
### Check case
- `tests/engine/tabgraphics-b.test.mjs`: built-in project + 5 payloads (demands from the file): 58 graphics, finite coordinates, valid DXF R12, expected layers, every panel's rectangle on the layer of its ratio over exactly [p, q], each fatigue detail's marker and each (ΔF)n/γ(Δf) chart point, weld markers, the rating series equal the min RF of the rows at each station and the RF = 1.0 line at RF 1.0, one summary band per span with data, regions for every panel/station/detail/weld/transition, the Report summary carries the figure. `tests/smoke/steel-bridge-tabgraphics-b.mjs`: each tab, wheel zoom, double-click fit, click selects the table row, DXF, print emulation, phone width, 0 console errors.
### Decisions (engineer's rule: decide small questions, log them)
- Ratio bands are `SBDGraphics.ratioColor`'s (green < 0.8, amber 0.8 to 1.0, red above 1.0 or NG) so every tab graphic agrees; the tables' own classes use 0.9 for amber. One-line change in `rcls` if the engineer wants them equal.
- Panels are hatched by this file (78 panels do not fit `ratioLayer`'s one value text per cell); `ratioLayer` is used for the Report summary spans. Station strips/panels use the same layer names and colours.
- Geometry (plates, supports) is the project's (`SBDGraphics.elevation(P, gi)`) even when demands come from a hand-off file; results are in analysis stations.
- Text is ASCII upper case like the Drawings (TeX and Greek of check titles are flattened: φ to PHI, ≤ to <=).
### Saved data
- No change.

## 2026-10-30 — PR: sb2-gfx-polish — polish of the output-tab graphics (fit to the drawing, text hierarchy, label overlaps, colour bands at 0.9, capped rating scale, markers) and one stale-state bug
Display only: no engineering formula, load or resistance factor, unit, code reference, result or saved-data format changes. Every graphic still draws the results its tab's own tables show. The ratio colour bands now use the tables' own classes (below).
### Where
- `ui/graphics.js` (SBDGraphics):
  - `mount()`: the view is fitted to the extents the browser measures (`measureFit`, `getBBox` of the drawn SVG, text as drawn) plus 1.5 %, instead of the shared `bbox()` estimate of 0.9 of the text height per character (which left a wide empty margin round long thin elevations); the frame height comes from that aspect, between 200 px and 88 % of the window (62 % on a phone).
  - `newDrawing(h)`: no text is smaller than `MINTXT` = 0.72 h; dimension text is `TXT.dim` = 0.72 h (it was h, larger than the labels) with its ticks and extension lines scaled with it (wrapper of `D.dim`; the `D.text` and `D.dim` of shared/dxf.js are untouched). `G.TXT` = { title 1.3, note 0.85, label 0.8, small 0.72, dim 0.72 } x h is the one hierarchy.
  - `elevation()`: text height `ELEVH` = 2.4 % of the length (was 2 %); subtitle wrapped to the girder width and title block 4.2 h above the drawing (was 9.8 to 12 h); plate-size labels set in the widest stretch clear of the bearings, turned, staggered or left out when they do not fit their segment (adjacent short plates used to print over each other); station-axis caption shortened; `E.freeze()` limits the selected-station line to the part above it.
  - New: `textW` (Arial advance widths), `wrap`, `stack` (rows for left-aligned flags so that no label touches another and no leader crosses a label), `declutter`, `mergeBands`, `tightSvg` (static SVG cut to the drawn extents, for the Report figure).
  - `ratioColor`: amber from 0.9 (was 0.8), 1.0 exactly stays amber, above 1.0 or NG red. Legends: "< 0.90", "0.90 TO 1.00".
  - `ratioLayer`: legend laid out with real text widths (the "WORST CHECK OF THE SPAN:" caption overlapped its swatches); `opts.flag`: the governing band carries a flag "GOVERNS (ROW n): ratio".
  - `chart()`: legend in rows under long plots (`legend: 'below'`, automatic) or at the right of short ones, `legendExtra` entries; tick labels at least 1.7 label heights apart; a line that leaves the scale is cut at the top edge and shown by a dashed cap with an arrow (it was a flat run along the edge); `vlabel: 'bottom'`.
- `engine/tabgraphics-b.js`: `rcls` amber from 0.9; labels as flags in stacked rows on leaders (Fatigue, Welds, Shear governing marks, Report summary), `declutter` for the Fatigue chart and the Rating governing labels; one marker per location (Fatigue detail one circle, Welds one circle or diamond, no marker for every stiffener, no node circles in Cross-frames) with the marker kinds in each legend (governing, selected, exempt); stiffener lines are the click targets (thin regions, bearing stiffeners ahead of the connection plate at the same x); legends end at the girder end (they ran past it); Rating: legend below the plot, capped scale in the legend; Cross-frames: diagonal number circles beside the member, G labels inside the bay; Splice: two columns (web at the left, flange plans at the right), annotations wrapped; stiffener and weld sketches: larger text, wrapped captions, titles wrapped; text sizes of the sketches raised.
- `ui/gfxa.js`: Loads & LLDF: notes above the dimension chain with clear spacing, notes wrapped to the deck width, the influence line in its own band under the girder labels (baseline, sloped line, 1.0 at the girder and 0 at the adjacent girder, dashed projection lines from the baseline up to the ordinate at each wheel, ordinates stacked where they would touch) so nothing crosses a girder label; Section properties: text enlarged, shorter axis labels, t_s dimension moved to the right of the deck, rebar labels separated, stress values kept a line apart; Flexure and Constructibility: neighbouring locations of one colour class merged into one band (345 hairline bars become a few wide bands), the governing band flagged; Constructibility: pour boxes numbered by sequence, a sequence table (order, from, to, length) under the diagram, the selected-station line stops above the table; Flexure checks: the two bar charts stacked, larger text; Analysis and Constructibility charts: full width, legends under the plots, larger axis text.
- `report/builders.js`: the Report summary figure uses `tightSvg`.
- `ui/tabgraphics-b.js`: click priority for the thin stiffener regions.
- `index.html`: `drawInputs()` also calls `window.SBDRatingUI.ensure(P)` (bug below).
### The bug: results "out of date" after a viewport resize
A viewport resize does not change anything: it was reproduced to be the visit of the Rating tab. `ui/rating.js render()` calls `ensure(P)` which adds `P.rating = defaultRating()` the first time the tab is drawn; the other tabs' freshness key is `JSON.stringify([P, ...])`, so every result calculated before that visit (Shear, Fatigue, Welds, Splices, Flexure ...) read as out of date. The smoke test had been tripped by this at 390 px (it visited Rating before resizing). Fix: `drawInputs()` creates the same default at load, like the other tabs' `ensure` calls (Shear, Fatigue, Framing, Splices). The project gets the `rating` object it would get on the first Rating visit; no key or format is new. Verified: bug6c script (every tab visited, Shear stays current), and the smoke test now asserts that no calculated tab is out of date after the resize.
### Check case / How verified
- `tests/engine/graphics-overlap.test.mjs` (new, `tests/engine/overlap.mjs`): every graphic of every output tab for the built-in project and the 5 payloads (413 graphics, 10,000 texts): finite coordinates, and no text box (Arial widths x height, rotated as drawn, dimension texts included) overlaps another text or a legend swatch. `OVL_ONLY=built-in node tests/engine/run.mjs graphics-overlap` runs one project; `OVL_LIST=1` lists the overlaps.
- `graphics.test.mjs`: colours at 0.8 and 0.8999 green, 0.9 and 1.0 amber, 1.0001 red, NG red; `stack`, `declutter`, `mergeBands`, `textW` ("ABC" = 20.56 at 10), minimum text 0.72 h, dimension text 0.72 h, `tightSvg`; text height of the built-in elevation 2.4 % x 4320 in = 103.68 in. `tabgraphics-b.test.mjs`: the Rating chart check follows the cut-and-cap drawing (an in-range value is a vertex, a value above the scale an arrow) and the legend text "SCALE CAPPED AT RF". `gfxa.test.mjs`: Flexure bands equal the merged bands.
- Smoke: `tests/smoke/steel-bridge-graphics.mjs` now clicks the Constructibility graphic (the table row follows, the blue line is drawn, a second click selects another row, the readout shows M_c); `steel-bridge-tabgraphics-b.mjs`: no tab is out of date after the phone resize. At 1000 px page width the smallest text is 7.7 px and the median 8.5 to 14 px on every graphic (measured on the rendered SVG; at 390 px the text is 4 to 8 px: use the zoom).
### Decisions
- Two stacked halves of a long elevation were not needed: with the tight fit, 2.4 % text and a compact title block the text is 8 to 11 px at a 614 px frame.
- Amber from 0.9 everywhere, as decided by the lead.
- Selecting a stiffener or detail draws a ring and a short text label (TS5, BS2, ...); governing items keep their ring and flag.
### Open items (need the engineer)
- Constructibility: the first "pour" `0.0 TO 1.0 FT` (pour 4) is not a display artefact. `engine/analysis.js` (deck placement sequence, `reg.push` at the sign change of `MD[i]`) splits the girder where the sign of M_DC1 changes; at the abutment M_DC1(0) = -1.6e-11 kip-ft (round-off, should be 0), which is "negative", so [0, 1 ft] becomes a negative-moment pour placed after the positive pours (order 1, 5, 2, 6, 3 on the picture is the same effect). The values drawn are the engine's (the sequence table lists them). Whether GirderDetail has the same 1-ft pour was not compared (calculation, left unchanged per CLAUDE.md section 4); suggested fix: treat |M| below a small tolerance as zero in the sign test. Needs the engineer's decision.
- The Loads & LLDF dimension extension lines run from the deck up to the chain dimension through the traffic-face note; thin lines through text, not text over text.

## 2026-10-30 — PR: sb2-gfx-fixup — selected-station line per band, Loads note clear of extension lines, lighter Shear hatching, phone reading scale
Display only: no engineering formula, load or resistance factor, unit, code reference, result or saved-data format changes. Every number a graphic shows is the one its tab's tables show (the Loads notes keep their text; the right-hand note now reads "d_e = 1.75 FT").
### Where
- `ui/graphics.js`:
  - `elevation()`: `E.selMark(ft)` now returns `segs` (one `[y0, y1]` per band: the elevation from the stations axis up to 1.7 h above the deck line, and each plot registered with the new `E.band(y0, y1)`); `y0`/`y1` stay as the overall extent. `mark()` and the live overlay in `mount()` draw one line per segment (a `selMark` without `segs`, as in `ui/tabgraphics-b.js`, draws one line as before). The line no longer runs through the pour table, the legend, the band row or the text between the plots.
  - `mount()`: at a window narrower than 700 px the view starts at a reading scale (the 15th-percentile text at 9 px or more, at most 8 x, zoomed about the top-left of the drawing, then pan/pinch); the print restores the full view (`beforeprint`/`afterprint`); a hint "Pinch or double-tap to zoom; drag to pan." under the frame, shown only at max-width 700 px and not in print. Desktop sizes unchanged.
- `ui/gfxa.js`: Analysis and Constructibility register their plots with `E.band` (Flexure's elevation has no plot under it; its other charts are separate graphics). Loads & LLDF: the two traffic-face notes move to the next gap clear of the extension lines of the girder-spacing chain (lines at x = 0, the first and last girder or any change of spacing, and the deck width).
- `engine/tabgraphics-b.js` `shear()`: the panel colour is one rectangle and light hatch (spacing the smaller of (w + d)/4 and 1.5 d) per run of neighbouring panels of the same colour class and web depth, not an outline and hatch per panel (the built-in project has hundreds of narrow panels: a wall of lines behind "60 x 9/16 WEB" and the BS labels). The station strip likewise one cell per run, hatch spacing 1.2 h (was 0.4 h). Colour classes (green < 0.90, amber 0.90 to 1.00, red > 1.00 or NG) and the legend swatches unchanged; the click regions, the selection rectangles and the values on the notable panels are still per panel.
- `tests/engine/tabgraphics-b.test.mjs` `hasRect`: a panel must lie inside a rectangle of its class layer (was: a rectangle exactly its width).
### Check case / How verified
- Screenshots at 1280 (screen, print) and 390 px of Loads, Analysis, Flexure, Constructibility, Shear.
- Built-in project, Shear (browser): the panels and the station strip of the green class draw as a few rectangles (runs) instead of 442 outlined cells; 486 panels and 2178 stations of 6 projects are still checked against the results by `tabgraphics-b.test.mjs`.
- Tests run (graphics files only, not the full suite): `graphics`, `gfxa`, `tabgraphics-b`, `graphics-overlap` (413 graphics, 10,153 texts, no overlap); smoke `steel-bridge-graphics.mjs` (Constructibility now expects 2 selected-location segments: elevation and plot), `steel-bridge-tabgraphics-b.mjs`.
## 2026-10-30 — PR: sb2-pour-sign — deck placement sequence: the sign of M_DC1 with a round-off tolerance (no sliver pour at an abutment)
Calculation change (CLAUDE.md §4): the pour limits and order of the deck placement sequence, and through them M_DCc and the GS14/GS15 constructibility ratios. No formula, factor, unit, code reference or saved-data format changes. Closes the open item of sb2-gfx-polish ("pour 4" 0.0 to 1.0 ft).
### Where
- `apps/steel-bridge/engine/analysis.js`, new function `pourRegions(xs, MD)` (above `analyzeGirder`, exported as `SBDAnalysis.pourRegions` for the tests), called from the deck placement sequence block of `analyzeGirder` (anchor `else pours = pourRegions(xs, MD);`, ~line 325).
- Before (in `analyzeGirder`):
```js
      else { const reg = []; let s = 0; for (let i = 1; i < N; i++) if (Math.sign(MD[i] || 1e-9) !== Math.sign(MD[i - 1] || 1e-9) || i === N - 1) { reg.push({ a: xs[s], b: xs[i], pos: MD[Math.floor((s + i) / 2)] >= 0 }); s = i; }
        pours = [...reg.filter(r => r.pos), ...reg.filter(r => !r.pos)].map(r => ({ a: r.a, b: r.b })); }
```
- After:
```js
      else pours = pourRegions(xs, MD);
  …
  function pourRegions(xs, MD) {
    const N = xs.length, tol = 1e-6 * Array.from(MD).reduce((a, v) => Math.max(a, Math.abs(v)), 0), sg = v => v < -tol ? -1 : 1, reg = []; let s = 0;
    for (let i = 1; i < N; i++) if (sg(MD[i]) !== sg(MD[i - 1]) || i === N - 1) { reg.push({ a: xs[s], b: xs[i], pos: sg(MD[Math.floor((s + i) / 2)]) > 0 }); s = i; }
    return [...reg.filter(r => r.pos), ...reg.filter(r => !r.pos)].map(r => ({ a: r.a, b: r.b }));
  }
```
### Problem
The pours are the regions of one sign of M_DC1 (deck at once), positive regions first, then negative (Art. 6.10.3.4.1; SA7). At an abutment M_DC1 is 0 in theory, but the beam solution gives round-off of either sign (built-in project G1: M_DC1(0) = −1.597e-11 kip-ft). `Math.sign(−1.6e-11)` is −1, so [0, 1 ft] became a negative-moment "pour" cast after the positive pours, and the first pour started at 1 ft. Effect: in the first pour the girder carried 1 ft less wet deck at the end of span 1 (M_DCc there slightly low, unconservative by up to 0.023 % of the largest M_DCc), and the sequence table and drawing showed a 1-ft pour that does not exist.
### Decision (rule chosen)
- |M_DC1| ≤ 1e-6 × max |M_DC1| of the girder counts as zero, and zero counts as positive, which is what an exact 0 already did (`MD[i] || 1e-9`). One relative tolerance, no minimum pour length: a minimum length would also merge short real pours (a short negative region over a short end span is real) and needs a length to be chosen; the relative tolerance only touches values that are round-off. 1e-6 is 2,500 times smaller than any real node moment met next to a sign change in the 141 girders (built-in G1: 2.5e-3 kip-ft against |M_DC1| ≥ 13.2 kip-ft at the nodes next to the contraflexure points) and far above round-off (1e-11).
- A real contraflexure point splits exactly as before (the region boundaries are still the first node of the new sign). A node within the tolerance of zero at a contraflexure point joins the positive side, as an exact zero always did.
- Custom pour lists (`seqCustom`) are unchanged.
- GirderDetail (`saSeq` in "Steel Bridge Design.html") has the same code and the same sliver on every payload (its M_DC1(0) is a negative round-off, e.g. −3.3e-12); it is not changed here (old file, one tool per PR). With the same tolerance rule applied to GirderDetail's own M_DC1, its pours equal this app's on 101 of 101 (built-in + 100 payloads). Suggested follow-up: the same one-line rule in GirderDetail's `saSeq`.
### Governing provision
AASHTO LRFD 10th Ed. Art. 6.10.3.4.1 (deck placement: the moments of the sequence of casting) and C6.10.3.4.1. Unchanged; only the region test.
### Check case (built-in project, G1, spans 110 + 140 + 110 ft, nodes every 1 ft, DC1wet = 1.16521 klf, max |M_DC1| = 2498.84 kip-ft, tolerance 2.499e-3 kip-ft)
- M_DC1 at the splitting stations: x = 0: −1.597e-11 (round-off, now "zero"), x = 1: +53.460; x = 77: +40.571, x = 78: −13.228; x = 143: −20.426, x = 144: +30.418; x = 216: +30.418, x = 217: −20.426; x = 282: −13.228, x = 283: +40.571; x = 360: −6.1e-12.
- Before: pours in order 1-78, 144-217, 283-360, 0-1, 78-144, 217-283 ft (6 pours; pour 4 is the sliver).
- After: 0-78, 144-217, 283-360, 78-144, 217-283 ft (5 pours). The contraflexure splits (78, 144, 217, 283) are unchanged.
- M_DCc at x = 1 ft: before 59.457, after 60.033 kip-ft (the largest change on the girder, +0.576 kip-ft = 0.023 % of max). Hand check: pour 1 now carries the wet deck on 0-1 ft; on the noncomposite span 1 (simple-span estimate) R_A = w a (L − a/2)/L = 1.16521 × 1 × 109.5/110 = 1.15991 kips, ΔM(1) = R_A × 1 − w × 1 × 0.5 = 1.15991 − 0.58260 = 0.577 kip-ft (engine 0.576; the difference is the continuity over the pier). Largest deck tension 0.17597 → 0.17600 ksi (φf_r = 0.432 ksi).
### How verified (Node)
- Census, before (origin/main `analysis.js`) vs after, all girders, `ll: false`: built-in (2 girders) + 100 payloads + 20 recorded projects (2 girders each) = 141 girders, all with a pour sequence. Sliver end pour before: 45 girders (the 0-1 ft pour at the left abutment, every time; the sign of the round-off decides, so the other 96 had none); after: 0. No other pour changed (the 96 others identical). 11,642 M_DCc node values changed, largest 0.023 % of max |M_DCc| (built-in G1, x = 1 ft).
- GirderDetail (`gdSA`, its own `saSeq`, built-in steel only + 100 payloads): GirderDetail has the sliver on 101 of 101; this app's pours equal GirderDetail's except the sliver (equal to GirderDetail's pours with the same tolerance rule on its own M_DC1) on 101 of 101. The analysis parity bound on M_DCc (SB2-A1, GirderDetail's double-counted boundary node) passes unchanged.
- Downstream (Auto design `evaluate`, level 'full', every module, every girder: built-in + 20 recorded projects): 220,137 check ratios; 44,078 changed, all GS14/GS15 (GS16 and every other module identical); largest change 1.66e-4 (built-in G1, GS14 at x = 1 ft, 0.01733 → 0.01750); no pass/fail flip, no change of the governing check or ratio of any project. The report, the Analysis card and the Constructibility graphic's sequence table list `seq.pours` (one pour fewer); no drawing sheet shows the pour sequence.
- Tests: `tests/engine/analysis.test.mjs` "sb2-pour-sign" (−1e-11 and −1.6e-11 at the ends: no sliver; exact 0 and +1e-11 the same; −1e-3 at an end still splits; a real contraflexure node within the tolerance joins the positive side like an exact 0). `tests/smoke/steel-bridge-report.mjs`: 13 report sections (load rating added earlier), test only.
### Open items
- GirderDetail `saSeq` keeps the sliver pour (see Decision); its hand-off M_DCc includes it (≤ 0.023 % of max).
## 2026-10-31 — PR: sbd-stiffener-tab — Shear & stiffeners tab: solid ratio fills, to-scale stiffener details, grouped worked steps (trial of presentation spec A)
Presentation only: no engineering formula, load or resistance factor, unit, code reference, computed result or saved-data format changes (CLAUDE.md §4, §5). The steps, their ids and values are the engines' own; grouping only sorts them into topics.
### Where
- `shared/steps.js` (anchor `/* ---------- topics: grouped worked steps`): new `SharedSteps.group(steps, topics, opt)`, `summary(t, html)`, `groupsHTML(groups, o)`, `wire(root, o)`, `groupCss`; a `beforeprint` hook opens every closed topic for printing and closes it again after. Reusable by any tab; applied to this tab only.
- `apps/steel-bridge/ui/shear.js`: `TOPICS` (ts, bs, pan, loc; ids matched without the work prefix; order: geometry, demands, one topic per AASHTO sub-article, resistance, check), `groups(kind, list)`; the "Worked steps" section renders `SharedSteps.groupsHTML` (topics closed by default, Expand all / Collapse all, open topics kept in `S.open` across selections). A `§id` in a step note is now a link to that step (`noteHtml`); a link to a step opens its topic; the Demands topic links to the Analysis tab when the analysis is the source (CLAUDE.md §6).
- `apps/steel-bridge/report/builders.js`: `gsteps(kind, scope, list, o)` for the panel, station, transverse and bearing items of section 7: steps in topic order with `topics: [{ title, ref, n, cls, chip, res }]`. Step keys are unchanged, so every `[[key]]` / "see §" resolves (test).
- `shared/report.js`: steps item `topics` → a sub-heading per topic (number, title, reference, chip, one-line result) in screen, print and text; nav tree entries down to the topics for items that are not lazy (`rp-l3`, `rp-l4`).
- `shared/dxf.js`: new entity `D.solid(l, pts)` (DXF R12 SOLID, corner order 1, 2, 4, 3); `toSVG` draws solids first (behind all lines and text), translucent (`opt.fill`, default 0.4).
- `apps/steel-bridge/engine/tabgraphics-b.js`:
  - `shear()`: panel runs and the station strip are solid fills (`ratioSolid`) instead of 45° hatching; legend swatches solid; stiffener-kind legend (CP solid, TS dashed, BS pair of lines, as GirderDetail's `dxfElev`); spacing dimensions above the girder per run of equal d_o, text `n @ d_o (d_o/D)` where it fits inside the run; BS tags and the governing / selected flags on leaders above (the rotated BS labels left the web).
  - `shearDetail()` rewritten after GirderDetail's `tsElevSVG`: A the two web panels beside the selected (else governing) transverse stiffener, elevation TO SCALE, each panel filled in the colour of its TS4 ratio V_u/(φ_v V_n) (the row's own p1/p2 values), d_o1/d_o2 dimensioned with d_o/D, D, the weld cutoff g; B plan section through the plate (enlarged, sizes in true inches). `opt.i` row; `opt.ts` type letter.
  - new `shearBearing()` after `bsSectionSVG` / `bsPlanSVG`: C section at the bearing to scale, plates filled in the colour of the row's largest ratio (as the table); D effective column plan at mid-depth from the result (9t_w, s_end, L_tot, A), filled in the colour of R_u/P_r.
- `apps/steel-bridge/ui/tabgraphics-b.js`: the details follow the tab selection (`sel.k === 'ts'` / `'bs'`); new mount `shear-bearing`.
- Tests: new `tests/engine/steps-groups.test.mjs`; `tabgraphics-b.test.mjs` (every bearing and sampled transverse rows draw, solid fills on the ratio layers, no hatching); `graphics-overlap.test.mjs` (the bearing details added).
### Check case / How verified
- Values unchanged: a Node dump of every step (id, value, ok, sub, eq, label, ref, note) of every panel, station, transverse stiffener and bearing, the check items and ratios of TS1–CP2 and BS1–BS7, and the report's step ids and values, for the built-in project (analysis and example sources) and five hand-off payloads: identical JSON before and after (sha256 equal).
- 19,076 steps of the built-in project and the RIDOT payload sorted into topics, none left over, each in its original order (test).
- `node tests/engine/run.mjs`: all pass. Playwright screenshots at 1280 (screen, print) and 390 px; Report tab with topic headings and nav; 0 console errors.
### Other copies
- None. The grouping helper is in `shared/steps.js` only; other tabs can adopt it with their own topic lists.
### Open items
- Other tabs: apply the topics (spec A) tab by tab.
- The layout elevation keeps its vertical exaggeration (a 360 ft girder at true scale is a thin line at fit); the details are to scale.
## 2026-10-31 — PR: sbd-grouping-rest — grouped worked steps (topics) on the remaining output tabs (presentation spec A)
Presentation only: no engineering formula, load or resistance factor, unit, code reference, computed result or saved-data format changes (CLAUDE.md §4, §5). The steps, their ids and values are the engines' own; grouping only sorts them into topics, as the Shear & stiffeners tab (#504).
### Where
- Tabs and topic counts (the topics a step list can have; a list shows the ones it holds): Section properties 9 (`SBDFlexureUI.TOPICS.sec`), Flexure 23 (`TOPICS.x`), Loads & LLDF 15 (`ui/loads.js`), Fatigue & studs 28 (`ui/fatigue.js`), Constructibility 23 (`ui/constructibility.js`), Cross-frames 17 (`ui/framing.js`), Field splices 16 (`ui/splices.js`), Rating 5, plus the Flexure or Shear topics for the capacity work of a location (`ui/rating.js`), Welds 15 (`ui/welds.js`), Analysis 14 (`ui/analysis.js`; only its worked steps, its tables are unchanged).
- Each UI file: `TOPICS`, `groups(kind, list)` (exported), a `stepLi` (the former step row markup, unchanged), `stepsHtml` now `SharedSteps.groupsHTML(groups(…), { open: OPEN, item: stepLi })` (topics closed by default, Expand all / Collapse all, open topics kept in a module `OPEN` set), and `SharedSteps.wire(host, …)` after the page is written. Order of topics: inputs (owner rules, modular ratio), section properties, demands, one topic per AASHTO sub-article in article order, resistance, check. Ids are matched whole (`group(…, { strip: false })`), since a list mixes the ids of several works.
- `apps/steel-bridge/ui/flexure.js` (anchor `topics of the worked steps`): `TP`, the topic definitions the other tabs share (owner rules, n, steel / 3n / n / steel+rebar, M_p positive and negative, web depth and R_h, demands, web bend-buckling, Service II, fatigue, lateral bending, yield and compactness, M_n and ductility, R_b, FLB, LTB, F_nc, 6.10.8 check, App. A6). Fragments are shared by reference, not copied.
- `apps/steel-bridge/index.html` (Section properties, `stepsHtml`, `drawOut`): grouped through `SBDFlexureUI.groups('sec', …)`; a "§" link on the Loads & LLDF tab opens the topic of the step (`SharedSteps.reveal`).
- `shared/steps.js` (anchor `topics: grouped worked steps`): `group(…, { strip: false })` (match the whole id), topic option `info` (steps whose ok flag only says which case applies, e.g. the Table D6.1-1 cases, App. A6 "permitted", compactness: shown, not counted in the topic's status chip), `reveal(root, id)` (open the topic that holds a step), and `wire()` adds the topics' CSS once and opens the topic of any `a[href^="#st-"]` link clicked inside root (bound once per root), so a "§" link on a grouped tab lands on a visible step.
- `apps/steel-bridge/report/builders.js`: `gsteps('UiName:kind', …)` for the worked-step items of Section properties, Loads & LLDF, Analysis, Flexure, Fatigue & studs, Constructibility, Cross-frames, Field splices, Welds and Rating (the shear items keep their bare kinds). Steps are written in topic order with sub-headings (`item.topics`); step keys are unchanged, so every "see §" resolves; the contents tree goes down to the topics for non-lazy items, as #504.
- `shared/report.js` `noteOf` and `.rp-seen`: a note that already says "See §x" (engine notes) no longer gets the "see " of `.rp-see` in front of its link a second time ("See see §3.2" → "See §3.2").
### Check case / How verified
- Values unchanged: a Node dump of every step (id, value, unit, ok, label, ref, note, eq, sub, sym, rendered text) reachable from the report bundle of every tab (loads, analysis, sections, rating, flexure, shear, fatigue, constructibility, framing, splices, welds) and of the report model with every location (steps sorted per item) for the built-in project and two hand-off payloads (`gd_util_RIDOT_G4`, `gd_builtin28_AASHTO_G1`): identical sha1 for every tab and case before and after (the list is in the PR).
- 288,774 steps of 12,136 report step items sorted into topics, none in "Other steps" (`tests/engine/steps-groups-tabs.test.mjs`); every cross-reference resolves; no doubled "see".
- `node tests/engine/run.mjs`: all pass. Playwright screenshots of each tab at 1280 and 390 px.
### Other copies
- None. Topic lists are per tab; the shared fragments live in `ui/flexure.js` (`TP`).
### Open items
- Rating topics carry no article reference (the MBE provisions are cited inside the steps).
- Topic chips follow the steps' own ok flags: a topic with a failing check shows NG, as the check tables.

## 2026-10-31 — PR: sbd-gfx-touchups — graphics touch-ups: Fatigue & studs stud zones in solid ratio colours, selected-station label clear of the FS tag, BARRIER label clear of the extension line
Presentation only: no engineering formula, load or resistance factor, unit, code reference, computed result or saved-data format changes (CLAUDE.md §4, §5). The ratio classes (green below 0.90, amber 0.90 to 1.00, red above 1.00 or NG) are the existing `ratioClass`; only how a rectangle is drawn changes.
### Where
- `apps/steel-bridge/engine/tabgraphics-b.js`, `fatigue()` (anchor `SHEAR STUD PITCH ZONES (6.10.10)`): `ratioFill(D, L, r, a, yS, b, yS + 2 * h, 0.7 * h)` → `ratioSolid(D, L, r, a, yS, b, yS + 2 * h)` (outline plus a solid on the class layer, as the Shear & stiffeners panels); the legend call `legend(D, L, 0, yL, h, RLEG(L), { right: X(G.L) })` → `{ right: X(G.L), solid: true }` (solid swatches). `hatch` and `ratioFill` stay (exported helper; `ratioFill` now unused).
- `apps/steel-bridge/ui/graphics.js`, `elevation()` (anchor `E.selMark = ft =>`): the line, marker and the "STA x FT" label of the selected station are carried up above any field-splice tag "FSk" that lies under the label (same x range), so the two no longer touch. Used by the Analysis, Flexure and Constructibility elevations (the Shear & stiffeners elevation draws no STA label).
- `apps/steel-bridge/ui/gfxa.js`, `loadsGraphic()` (anchor `const al = a.k === 'sw'`): the appurtenance label (BARRIER, SIDEWALK, CURB, MEDIAN) stays centred unless a girder or deck-edge extension line of the spacing chain would touch it; then it moves to the nearer clear side of that line (left- or right-aligned, 0.5 h off the line).
### Check case / How verified
- Values unchanged: a Node dump of the Fatigue tab build (`SBDFatigueUI.build`, built-in project, splice at 82 ft: every row, check item and step with value, unit, ok, ref, text; 31,274,901 bytes, 103,763 step refs) is identical before and after (md5 09374418fc52e9bbe905642691058ac5 both).
- Other tabs that still hatch (not changed): `SBDGraphics.ratioLayer` draws vertical web hatching on the Flexure and Constructibility (deck placement) elevations (the Report summary already passes `hatch: false`; Shear & stiffeners does not use it); the Welds legend swatches use hatch (`legend` without `solid`).
- `tests/engine/graphics-overlap.test.mjs` and `node tests/engine/run.mjs`: pass. Playwright screenshots at 1280 px of the Fatigue, Analysis (STA 77.0 FT with FS1) and Loads tabs.
### Other copies
- None.
### Open items
- Flexure / Constructibility web hatching and the Welds legend swatches could be made solid too (presentation only), if wanted.

## 2026-10-31 — PR: sbd-spans-framing-tab — Spans and Framing input tabs combined into "Spans & framing" (UI only)
### Where
- `apps/steel-bridge/index.html`: `TABS` (`['spans', 'Spans']` -> `['spans', 'Spans & framing']`; `['fr', 'Framing']` removed), `panes()` (the `spans:` value is now the Spans card `+ window.SBDFramingUI.inputs(P, { num, sel, card, esc }, ui)`; the `fr:` entry removed), `markErrors()` `tabOf` (`framing.*` / `crossframes.*` now return `'spans'`, as `spans.*` did), and after the `ui` load from `M.KEYS.ui`: `if (ui.itab === 'fr') ui.itab = 'spans';`.
- `apps/steel-bridge/ui/analysis.js`: the output-tab link `data-goto="fr"` -> `data-goto="spans"`.
- Wording "Framing tab" -> "Spans & framing tab" in `ui/{welds,splices,shear,flexure,constructibility,rating,analysis,drawings}.js` (as `&amp;`), `report/{builders,data}.js`, `engine/{framing,owners,splices}.js` (comments and message text only); `tests/engine/paths.test.mjs` regex follows. `ui/gfxa.js` (a note string) left for the graphics PR.
### Before / after
- Before: two input tabs, `spans` (Spans card) and `fr` (framing cards). After: one tab key `spans` holding the Spans card, then the framing cards, in their existing layout.
- Saved data: the `M.KEYS.ui` key and format are unchanged; a stored `itab: 'fr'` is mapped to `'spans'` on load (the stored key is not deleted or renamed). No project field, path, or localStorage key changed.
### Governing provision / check
- None: no calculation, factor, unit or code reference changed. Check: `node tests/engine/run.mjs` unchanged results; the paths `data-path` of every framing input are identical, so edits flow to the same `P.framing.*`.

## 2026-10-31 — PR: sbd-autodesign-ll — Auto design: shear and stiffeners with LL+IM, f_ℓ and brace points from the tabs' one source (C-1, C-16)
**Calculation change (CLAUDE.md §4).** Auto design's full check (`evaluate`) ran the shear (GS11, GS16, GS18), transverse-stiffener and
bearing-stiffener checks with no live load, and deck placement (GS14–GS16) with f_ℓ = 0; its flexure ignored an f_ℓ entered on the Flexure
tab. The tabs were right; only Auto design's inputs to the same check functions change. Governing provisions (AASHTO LRFD 10th Ed.):
3.4.1 (Strength I, 1.75 LL+IM), 6.10.9 (shear resistance), 6.10.11.1 / 6.10.11.2 (transverse and bearing stiffeners, R_u), 6.10.3.2
(deck placement, f_bu + f_ℓ), 6.10.1.6 and C6.10.1 (f_ℓ, skew value in lieu of a refined analysis).
### Where
- `apps/steel-bridge/engine/autodesign.js`, `evaluate()`, anchor `// shear and stiffeners (ui/shear.js build on this analysis)`:
  - before: `const SB = window.SBDShearUI.build({ P, g: gi, pl }); mods['shear' + gi] = SB;` (pl = `payloadOf`: stations with M_LL and V_FAT but no V_LLpos/V_LLneg, no V_PL, no `reactions`)
  - after: `const SA = window.SBDShearUI.fromAnalysis(P, gi, R);` (error → a failing 'shear input' item and the girder is skipped) then `const SB = window.SBDShearUI.build({ P, g: gi, pl: SA.pl });` — the Shear tab's own payload of the same analysis R (V_LL+IM, V_PL, the support reactions R_LL+IM, the split stations at interior supports).
- same function, anchor `const pl = payloadOf(P, gi, R), Fr =`:
  - before: `Fr = FRM() && P.framing ? FRM().forGirder(P, { gi }, null) : null;` and, after the flexure payload, `const flS = FRM() ? FRM().flSkew(((P.xs || {}).skews) || [0], P.girders[gi].position === 'exterior', P.framing) : { fl: 0 }; d.locs.forEach(L => { L.fl = flS.fl || 0; });`
  - after: `DF = FRM().design(P, gi, { fl: P.flexure.fl if > 0 })`, `DC = FRM().design(P, gi, { fl: P.constr.flC if > 0 })` (engine/framing.js `design`, as ui/flexure.js and ui/constructibility.js); `Fr = DF.br`; `d.locs.forEach(L => { L.fl = DF ? DF.fl || 0 : 0; });`
- same function, constructibility: before `Cn.fromAnalysis(P, gi, R, { flC: 0, …, ...(Fr ? { braces: Fr.braces } : {}) })`; after `{ flC: DC ? DC.fl : 0, …, ...(DC && DC.br ? { braces: DC.braces } : {}) }`.
- `apps/steel-bridge/ui/shear.js`, `fromAnalysis(P, gi)` → `fromAnalysis(P, gi, R0)`: optional analysis already run (`let R = R0; if (!R) try { R = AN.analyzeGirder(P, gi); } …`). The tab's own calls pass no R0: unchanged.
- `payloadOf` is unchanged (the flexure, fatigue and stud checks still use it; its fatigue parity test is unchanged).
### Before / after (Node, Auto design full check vs the tabs' builders on the same project)
| Project, girder | V_u,max kip (AD before → after; tab) | V_LL+IM | shear ratio | R_LL+IM at supports, kip (before: 0) | deck placement f_ℓ ksi (before: 0) |
|---|---|---|---|---|---|
| built-in, G1 | 172.96 → 395.97; 395.97 | 0 → 129.16 | 0.271 → 0.437 | 107.8/215.3/215.3/107.8 | 0 (skew 0°); 2 with P.constr.flC = 2 |
| builtin28_AASHTO, G2 / G1 | 166.86 → 414.79 / 155.19 → 374.23 | 0 → 142.20 / 125.55 | 0.279 → 0.459 / 0.269 → 0.409 | 118.1/236.5/… / 104.3/208.8/… | 0 → 12.5 / 9.38 (GS14–16 max 0.497 → 0.732 / 0.413 → 0.556) |
| builtin_RIDOT, G2 / G1 | 154.08 → 438.50 / 146.15 → 397.41 | 0 → 135.85 / 119.94 | 0.252 → 0.478 / 0.251 → 0.433 | 113.0/226.0/… / 99.8/199.5/… | 0 (skew 15°) |
| util_AASHTO, G2 / G1 | 166.73 → 430.21 / 155.03 → 364.25 | 0 → 135.84 / 119.93 | 0.264 → 0.469 / 0.259 → 0.397 | 113.0/225.9/… / 99.8/199.4/… | 0 (skew 15°) |
After the fix every value above equals the tab's (Shear tab src 'analysis', Flexure tab src 'analysis', Constructibility tab), per girder, including the governing TS/BS ratios and the flexure and deck-placement maxima. Built-in with f_ℓ entered (P.flexure.fl = 3, P.constr.flC = 2): Auto design before took 0 / 0 (flexure max 1.229, deck placement 0.787); after 3 / 2 (4.166, 1.069), the tabs' values.
### Check case (built-in project G1, AASHTO, η = 1)
- Largest V_u, x = 110.01 ft (just right of Pier 1): V_u = 1.25(V_DC1 + V_DC2) + 1.50 V_DW + 1.75 V_LL+IM = 1.25(100.980 + 17.537) + 1.50(14.525) + 1.75(129.164) = 148.146 + 21.787 + 226.037 = **395.97 kip**; GS11 395.97 / 905.41 = 0.437. Before: no V_LL; the largest V_u was at 249.99 ft, 1.25(103.069 + 17.705) + 1.50(14.664) = **172.96 kip**; governing shear item GS18 0.271.
- Bearing stiffener, Abut. 1: R_u = 1.25(R_DC1 + R_DC2) + 1.50 R_DW + 1.75 R_LL+IM = 1.25(55.360 + 9.853) + 1.50(8.161) + 1.75(107.842) = 81.516 + 12.241 + 188.724 = **282.48 kip** (before: R_LL+IM = 0 and the dead-load jump in shear, R_u = 93.08 kip).
- Test: `tests/engine/autodesign.test.mjs` "The full check's shear, stiffeners, flexure and deck placement equal the Shear, Flexure and Constructibility tabs" (fails on the old code: R_LL+IM 0 vs 107.84).
### Other copies
- None.
### Open items
- With no framing on the Spans & framing tab, the Flexure tab falls back to the stiffener layout's cross-frame stations and Auto design's flexure to the payload's L_b (frames.Lb, 25 ft). Not changed here (every recorded project has framing).
- The recorded Auto design parity (tests/projects/sbd2-autodesign/ad_*.json) was not re-run (minutes to ~26 min per project). Instead the 6 recorded
  Auto designs were re-checked with `evaluate(level 'full')` before and after: builtin_AASHTO and util_AASHTO pass both ways (largest shear ratio
  0.42 → 0.58 and 0.45 → 0.61); builtin28_AASHTO (skews 28°) gains a deck placement failure, GS14 1.194 with f_ℓ = 12.5 ksi (C-16), so its design
  would change; builtin28_RIDOT, builtin_RIDOT and util_RIDOT fail the same flexure items (GS7/GS8/GS9, 1.05–1.08) before and after: those
  records are already stale on main before this change (not caused here). No recorded design gains a shear or stiffener failure. Auto design
  does not size stiffener plates (F-6), so the stiffener count is unchanged.

## 2026-10-31 — PR: sbd-autodesign-vars — Auto design: design variables (Lock / Range / Auto) for every sizable input, the overhang, detail sizing on the tabs' checks, Rating and Welds in the full check, the no-framing brace points
**Calculation change (CLAUDE.md §4).** No formula, load or resistance factor, unit or code reference of any check module changed. What changes is
which inputs Auto design sizes, which checks its full check counts, and the brace points it uses on a project without framing. Items 1 to 4 below
change Auto design results; each has its before / after and a hand check. Governing provisions (AASHTO LRFD 10th Ed. (2024) unless noted):
6.10.1.6, 6.10.8.2.3 (L_b), 6.10.9 and 6.10.11.1 (transverse stiffeners), 6.10.11.2 (bearing stiffeners), 6.10.10 (studs), 6.7.4 and 6.9.4.4,
6.8.2 (cross-frames), 6.13.3 and Table 6.13.3.4-1 (fillet welds), 6.13.6.2 (transitions), 4.6.2.2.2d and 4.6.2.6.1 (exterior girder LLDF, b_eff),
C6.10.1 and 6.10.3.4 (overhang brackets), MBE 3rd Ed. 6A.4.2.1 (rating factor), RIDOT BDM 9.4.1.4, CTDOT BRSDM V2 9.7.1.5 (overhang limits).

### Where
- `apps/steel-bridge/engine/autodesign.js`:
  - `VARS`, `varsOf(P, s)` (new; anchor `const VARS = [`), read by `settings()` as `s.V` and `s.ohSym`. Saved as `P.autodesign.vars` (optional; absent = each
    variable's default), `P.autodesign.ohSym` ('sym' default | 'asym'). No storage key changed (`sbd2.project.current` as before).
  - `sizeFlanges`: anchor `// the design variables of each piece (Lock / Range / Auto` (width and thickness per field piece: Lock keeps the piece's current
    width or zones, Range clamps, the width grows when a thickness range caps the area); `reclamp()` after the bolt-fit, bearing-width, top-constant and
    width-change rules.
  - `webVars` (new), `design()` (`zLock`: the transitions locked keep the current cut points; `ohJ`: the overhang of the girder count; stop when no
    plate can change), `trim()` (skips locked plates and values outside a range), `depthList` / `nbList` (Lock and Range).
  - `sizeDetails(Q, S, ctx)` (new; anchor `function* sizeDetails`): cross-frame angles, stiffener spacing, stiffener plates, bearing stiffeners, stud
    pitch zones, flange-to-web weld, splice plates. Run on every finalist before its full check (`run()`, anchor `sizing the details`).
  - `ohLimit`, `ohCands`, `pickOh` (new; anchor `the overhang variable`); `projectWith(P, L, det)` (the overhangs, the candidate's details; anchor
    `const ohCh =`); `apply` / `undo` keep `APPLY_KEYS` (girders, xs, framing, splices, stiffeners, crossframes, studs, welds, constr).
  - `evaluate()`: the Rating and Welds tabs' builders (anchor `// load rating (ui/rating.js build`), the per-module governing item `modGov`, the
    no-framing brace points (anchor `const frIn =`), a failing item without a numeric ratio counted (anchor `const take = (o) =>`), the Cross-frames
    build on a copy when the project has no framing (anchor `P.framing ? P : clone(P)`).
  - `run()`: the infeasible note (anchor `const lk = lockText(S)`), the current design's full check always (the compare view).
- `apps/steel-bridge/engine/model.js`: header only (the `autodesign.vars` and `ohSym` fields).
- `apps/steel-bridge/ui/autodesign.js`: Apply / Undo write `['autodesign', ...SBDAutoDesign.APPLY_KEYS]` (before: girders, xs, framing, splices, autodesign), so the
  candidate's details and overhangs reach the project. The variable table and the compare view are the next PR (sbd-autodesign-ui).
- `tests/engine/autodesign-vars.test.mjs` (new), `tests/engine/autodesign.test.mjs` (the test window loads Rating and Welds; the re-check uses the
  candidate's details), `tests/engine/autodesign-parity.mjs` (records the details and the overhang), `tests/projects/sbd2-autodesign/ad_*.json`, `parity.json`.

### The variables (each Lock / Range / Auto unless noted; default Auto)
| id | variable | Auto (how it is sized) | Range | notes |
|---|---|---|---|---|
| nb | girder count | New design: current ± 1 within the spacing limits (or the counts listed) | min … max | Refine / Check: held by the mode |
| oh | deck overhang | the pair (symmetric by default) on 0.5 ft from 1.5 ft to the limit below whose screen of the starting design has the lowest governing ratio | min … max, step; the owner's shall-limit (RIDOT) still applies | N_b, S and the overhangs close to the same out-to-out deck width; Lock only without an exterior plate girder |
| D | web depth | L/36 … L/18 (or the limits entered), the depth rule | min … max, step | |
| tw, bt, tt, bb, tb | web thickness, flange widths and thicknesses, per field piece (an entry `id#k` per piece overrides) | as PR 1 (required areas, owner minimums, 6.10.2) | clamped; a thickness cap widens the flange | Lock: the piece's width, or its zones (cut points and thicknesses) |
| trans | flange transition locations | as PR 1 | — | Lock: the current cut points |
| spl | field splice locations | — | — | **Lock only**: choosing splice locations needs shipping-length and erection rules the engine does not have |
| splPl | splice plates and bolts | the Field splices tab's auto-design | — | default Lock when that tab's auto-design is off |
| tsSp | stiffener spacing d_o/D | widest of 3.0 … 0.5 passing the shear checks, TS4, TS5 | min … max | Lock only with per-bay spacing or an unstiffened web |
| tsA_b/t, tsB_b/t | intermediate stiffener, connection plate | least b_t·t_p passing TS1–TS3, TS6–TS8 (B: and CP1); welds the least passing | min … max | the web weld the Table 6.13.3.4-1 minimum, the cutoff moved into 4t_w … 6t_w |
| bsA_n/b/t, bsB_n/b/t | bearing stiffeners (pairs, b_t, t_p) | least n_p·b_t·t_p passing BS1–BS3, BS6 (width), BS7; then the least weld passing BS4, BS5 | min … max | a fillet-only flange connection (BS6) fails whatever the size |
| scP, scN | stud pitch, studs per row | the analysis zones (span tenths), pitch the largest on 1/2 in passing SC1–SC3; one more stud per row only below the SC3 minimum | min … max | default Lock when zones are entered |
| cf | cross-frames | the current frame type and bolts per member end first, then X / K and more bolts where CF4, CF10 or CF11 need them; the lightest angle of the Cross-frames list passing CF1–CF11 (one angle for every member) | leg size | Lock only with diaphragms (no shape list). Implements C-24 (CTDOT CF11, 4 bolts) and RIDOT's X or K by S/d |
| weld | flange-to-web fillet weld | the Table 6.13.3.4-1 minimum, else the least size passing FW1–FW4 | min … max | default Lock when a size is entered |

### 1. Rating and Welds in the full check
- Before: `evaluate(level 'full')` ran flexure, fatigue, shear, stiffeners, constructibility, studs, cross-frames, splices. After: also `SBDRatingUI.build`
  (RT1: the HL-93 inventory rating factor ≥ 1.0, ratio 1/RF; the owner's target (RIDOT 1.10, CTDOT 1.20) a warning, as engine/owners.js `rate.*`
  says: "reported, the girder is not resized for it") and `SBDWeldsUI.build` (FW1–FW4, TR1–TR4 as the Welds tab).
- Check case (built-in project, G1, as the Rating tab): the lowest inventory RF is 0.6085 (flexure, negative, x = 249.99 ft) → RT1 = 1/0.6085 = 1.644,
  fails (the same section fails GS7, 1.229). A design that passes the Strength I and Service II checks at φ_c = φ_s = 1 rates RF ≥ 1 (refine candidate:
  RT1 0.745, RF = 1.342).

### 2. A failing check item without a numeric ratio now fails the full check
- `evaluate` `take()`: before `if (!isFinite(o.r)) return;` (an item whose status is fail but has no ratio, such as BS6 "bottom flange connection",
  TS8 "side of the web", an analysis or input error with r = Infinity, was dropped: the design could pass Auto design and fail on the tab);
  after: such an item is a failure (`if (o.fail && o.r === Infinity) { fails.push(o); … }`). More conservative; matches the tabs.
- Check case: built-in project with the abutment bearing stiffeners "fillet welds only": Shear & stiffeners tab BS6 fails at Abut. 1 and Abut. 2
  (no ratio); Auto design before: 0 BS6 failures (15 in all); after: 2 (18 in all, with RT1).

### 3. No framing: the stiffener layout's cross-frames as brace points (the Flexure tab's fallback)
- `evaluate`: before, with no framing the flexure took `bracing.Lb = frames.Lb` (evenly spaced) even where the Stiffeners tab lists the cross-frame
  stations (`frames.at`); after `braces = [...new Set([...R.sup, ...frames.at])]` as ui/flexure.js build. With `frames.at` empty nothing changes.
- `projectWith`: before, a default framing was added to every candidate (`Q.framing = Q.framing || defaultFraming()`), which moved its brace
  points to the framing module's; after, only when the layout has field splices.
- The Cross-frames builder's `ensure()` added a default framing to the project being checked, so the next girder's flexure saw framing; it now
  runs on a copy when the project has none.
- Check case (built-in 110-140-110 ft, no framing, frames.at = 30, 60, 90, 130, 170, 210, 250, 290, 330 ft): x = 44 ft L_b before 110/⌈110/25⌉ =
  22.00 ft, after 60 − 30 = 30.00 ft; x = 249.99 ft L_b before 140/⌈140/25⌉ = 23.33 ft, after 250 − 210 = 40.00 ft; largest flexure ratio GS7 at
  249.99 ft 1.134 → 3.335 (the Flexure tab: 3.335; every flexure ratio now equals the tab's). Test "No framing: …".

### 4. The detail and overhang variables (new sizing; the defaults change what Auto design returns)
- The finalists' details are sized before their full check (table above), so a candidate carries its own stiffener spacing and plates, bearing
  stiffeners, stud zones, cross-frame angles, flange-to-web weld and splice auto-design; Apply writes them (Undo puts them back).
- The overhang (New design): `projectWith` keeps W_deck = oh_L + Σ bays + oh_R and spaces the girders equally between the overhangs; b_eff
  (4.6.2.6.1) interior S, exterior S/2 + oh; the exterior girder's LLDF (lever rule, d_e) and dead loads follow through the loads module;
  the overhang brackets' deck width (P.constr.oh.wOH, entered or GirderDetail's 30 in) moves by 12Δoh of the larger overhang.
  Hand check (built-in cross-section, W_deck = 3.25 + 4(9.5) + 3.25 = 44.50 ft, oh = 3.5 ft, N_b = 5): S = (44.50 − 7.00)/4 = 9.375 ft;
  b_eff interior 112.50 in, exterior 12(4.6875 + 3.5) = 98.25 in; w_OH = 30 + 12(0.25) = 33.00 in.
- Refine, the built-in project (all defaults): spacing d_o/D 1.0 → 1.75 (fewer stiffeners), intermediate stiffeners and connection plates 6 × 1/2 →
  5 1/2 × 3/8 in, bearing stiffeners abutments 1 pair 7 × 7/8 → 5 1/2 × 1/2 in, piers 2 pairs 8 × 1 → 1 pair 8 × 3/4 in, cross-frames L5x5x3/8 (kept,
  the lightest passing), the studs explicit zones (pitch 7 1/2 to 18 1/2 in, 4 per row), weld the minimum; every module passes.

### Parity re-run (tests/projects/sbd2-autodesign; every design judged by this app's full check, now with Rating and Welds)
| project | before (record on main) | after (re-run) | details sized (cross-frames; d_o/D; pier bearing stiffeners; studs) | s |
|---|---|---|---|---|
| builtin_AASHTO | 406,234 lb, D 70, passes | 406,234 lb, D 70, passes (governing TS7 1.000) | X L5x5x3/8, 2 bolts; 1.75; 1 pair 8 × 3/4; pitch 7–18 in | 615 |
| util_AASHTO | 417,449, D 70, passes | 417,449, D 70, passes (TS2 1.000) | X L5x5x3/8; 1.75; 1 pair 8 × 3/4; 7.5–18 in | 748 |
| builtin28_AASHTO | 406,413, D 72, blocked (SC1, CF3) | 422,682, D 60, passes (TS2 1.000) | X L6x6x3/8; 1.75; 1 pair 6.5 × 1; 6–15.5 in | 694 |
| builtin_RIDOT | 421,153, D 62, passes (stale) | 426,394, D 70, passes (TS7 1.000) | K L5x5x3/8, 2 bolts; 1.75; 1 pair 7.5 × 7/8; 7–18 in | 591 |
| util_RIDOT | 424,548, D 65, passes (stale) | 439,003, D 75, passes (TS7 1.000) | X L5x5x3/8; 1.75; 1 pair 7.5 × 7/8; 7.5–19 in | 610 |
| builtin28_RIDOT | 427,046, D 65, blocked (SC1, CF3) | 440,207, D 62, passes (TS7 1.000) | K L5x5x3/8; 1.5; 1 pair 8 × 7/8; 6.5–16 in | 600 |
- Match-legacy settings now also lock the overhang (Suggest and Full design keep it): `legacySettings` `vars: { oh: { mode: 'lock' } }`.
- Why they changed. AASHTO built-in and util: the same plates (the details now sized do not change the plates). builtin28_AASHTO and
  builtin28_RIDOT were blocked by SC1 (stud fatigue pitch with the skew term at 28°) and CF3 (cross-frame slenderness): the stud zones and the
  cross-frame angles are now sized, so both pass; the plates differ because the old blocked designs also failed deck placement (GS14 1.194 with
  f_ℓ = 12.5 ksi, C-16, sbd-autodesign-ll). The RIDOT records were stale on main: their designs failed GS7–GS9 (1.05–1.08) since the C-1 / C-16
  fixes; the re-run designs pass every module, heavier (+1.2 % and +3.4 %). On builtin_RIDOT the first re-run (before the cross-frame type was a
  variable) was blocked by CF11 (RIDOT X or K by S/d, a failing item without a ratio that the full check did not count before, item 2); with the
  type in the cross-frame search it takes K-frames and passes. Every legacy design still fails this app's full check (BS6, SC2, GS7/GS8, FA1:
  parity.json), so no legacy weight is a weight to beat.
- Run time per project 10 to 12.5 min (before 9 to 27 min). Memory: about 4 GB per run (the live-load cache); 3 runs at a time on this machine.
- Still pending (not run here, the engineer's usage limit): the 15 projects of K-5 (builtin/builtin28 MassDOT, CTDOT; curb, xsA × 4; util
  MassDOT, CTDOT; builtin_app).

### How verified
- `node tests/engine/run.mjs autodesign` (autodesign.test.mjs, autodesign-vars.test.mjs): saved data round trip; locks and ranges honoured;
  candidate re-checked from scratch; Apply → the tabs' builders (Flexure, Shear & stiffeners, Fatigue & studs, Constructibility, Cross-frames,
  Field splices, Rating, Welds) give the candidate's governing ratio per module exactly; the infeasible note; the no-framing L_b hand check;
  the overhang hand check, limits and pickOh; the re-run parity designs re-checked from scratch with their details.
- The full engine suite `node tests/engine/run.mjs`: 38 files, 204 passed, 0 failed (38 min 44 s).

### Decisions (engineer's rule of 2026-10-29: accurate, not over-conservative)
- SB2-AD10. Rating in the full check: RT1 HL-93 inventory RF ≥ 1.0 is a failure (it is the design load rating; at φ_c = φ_s = 1 it agrees with
  the Strength I / Service II checks); the owner's higher targets (RIDOT 1.10, CTDOT 1.20) are warnings, as the owner rules themselves say
  ("reported, the girder is not resized for it").
- SB2-AD11. Defaults: Auto for every variable Auto design sizes, except where the tab's own automatic choice is off (stud zones entered, a weld size
  entered, splice auto-design off): Lock, so a deliberate entry is not replaced unasked.
- SB2-AD12. Overhang Auto limits: 1.5 ft (Preliminary sizing ws.ohMin) to min(0.40S, 4.0 ft) (Preliminary sizing Limits ohFrac, ohMax, its G6
  practice check) on 0.5 ft (ws.ohS); the owner rule in its place (RIDOT 9.4.1.4 shall: min(d, S/2, 4 ft; 3 ft if d < 5 ft), applied in a
  Range too; CTDOT 9.7.1.5 should: min(4 ft, d), Auto only); d = D + t_ft + t_fb of the shallowest section. **For the engineer to confirm.**
  Seen in a study run (New design, overhang Auto, otherwise the parity settings): builtin_AASHTO took 1.5 ft (the lower limit; 398,740 lb, D = 57 in)
  and util_AASHTO 2.0 ft (409,788 lb, D = 65 in), against 3.25 ft and 3.0 ft as entered: where the fascia girder governs, Auto moves the girders
  outward to the lowest overhang allowed. The 1.5 ft minimum (the old app's) puts the girder line under a 1.5 ft barrier; a minimum tied to the barrier
  (for example barrier width + 1 ft) may be wanted. The parity runs keep the project's overhangs (match legacy: Suggest does not change them).
- SB2-AD13. Overhang choice: the lowest screen governing ratio of the starting design (the current plates at that girder count), once per girder
  count; a plain search over the screen's own checks, not a new rule. Asymmetric: the right overhang only when a plate girder stands on the right
  fascia line.
- SB2-AD14. One cross-frame angle for every member; the frame type and the bolt count change only where a check fails at the current ones (RIDOT
  then takes K-frames on the built-in and builtin28 projects, CTDOT 4 bolts per end); the detail checks counted as the full check counts them (a warning with a ratio above 1, such
  as TS5, counts as a failure in sizing too).
- Not changed, recorded: paper-space DXF later; the "Example" demand source kept; imported cross-frame DC1 weight stays from the Cross-frames
  module's members (Auto design's angle choice feeds it through that module).

### Lock only (Auto design cannot size these yet; the UI says so)
- Field splice locations (shipping length, erection and contraflexure rules are not in the engine).
- Diaphragms (rolled shapes): no shape list to search; cross-frame angles are sized when diaphragms are off.
- Stiffener spacing with per-bay spacing or an unstiffened web (the per-bay table is the engineer's layout).
- The overhang without an exterior plate girder.

### Other copies
- None (ui/autodesign.js reads `VARS` from the engine).

## 2026-10-31 — PR: sbd-autodesign-ui — Auto design tab: the design-variable table, the compare view, the details of a candidate
No calculation change: display and inputs only (the engine is the sbd-autodesign-vars PR).
### Where
- `apps/steel-bridge/ui/autodesign.js`:
  - `varsHtml(P, s)`, `curVal(P, id, k)` (new; anchor `function varsHtml`): one row per variable of `SBDAutoDesign.VARS` (grouped: girders and web,
    flanges, details) with the mode (Auto / Lock / Range; a variable Auto design cannot size shows "Lock" with the reason), min / max / step for a
    Range, the project's current value ("Now": what Lock keeps) and how it is sized; per field piece rows for the web and flange plates in a
    collapsible list ("as all pieces" removes the piece's own entry). The overhang option (symmetric / left and right apart). Inputs saved in
    `P.autodesign.vars` and `P.autodesign.ohSym` (handler `[data-adv]`; no new storage key).
  - `runBar(P)` (Run / Stop / Undo and the progress, split out of `inputsHtml`).
  - `compareHtml(P, R)` (new; anchor `compare view`): any two of the current design and the candidates side by side: N_b, overhangs, D, weight,
    cost, transitions, stiffeners, governing ratio and what governs, the governing ratio of each module (links to the tab with its steps), the
    sized details, the plates; the better of each pair green, the worse red. Selection in memory (`S.cmp`).
  - The candidate's details (`c.det.rows`, notes) under its plates; the overhang column in the ranked list.
  - Apply / Undo: the parts of the project `SBDAutoDesign.APPLY_KEYS` (the engine PR made these two lines use it).
- `docs/steel-bridge-comparison.md`: rows F-5, F-6, F-7, F-14, K-5.
### How verified
- Playwright (Chromium, `file://`) at 1280 and 390 px: the variable table, a Refine run on the built-in project (43 s), the ranked list, the
  candidate's details, the compare view (current vs candidate 1: weight 435,385 → 437,829 lb, cost $1,532,656 → $1,487,487, 8 → 4 transitions,
  62 → 32 stiffeners per girder, every module below 1.0 after; current GS7 1.229, RT1 1.644), Apply then Undo shown; no horizontal page scroll at
  390 px (scrollWidth 390); console errors: none from the page (two 404s are the test's blocked three.js CDN requests).
- `node tests/engine/run.mjs autodesign` (unchanged engine).
### Other copies
- None.

## 2026-10-31 — PR: sbd-owner-on-project — "Bridge owner (DOT) rules" card moved to the Project input tab; owner text in the title block and report (UI only)
### What changed (no computed value, saved path, project format or storage key)
- `apps/steel-bridge/ui/loads.js`: the card `h.card('Bridge owner (DOT) rules', …)` moved out of `inputs(P, h)` into a new function `ownerCard(P, h)` (exported on `window.SBDUiLoads`). Its code is the same (paths `ownerRules.owner`, `ownerRules.eta.*`, button `data-xsact="ownDef"`, handled by the same `onClick`); only the selector label changed from `'Owner'` to `'Client / owner (DOT)'`. `inputs()` now starts with `return h.card('Girders and deck', …` (the `x`, `tf` locals stay; `own, o, rI, rD, rR, yn, defs` went with the card).
- `apps/steel-bridge/index.html`, `panes()` anchor `proj: card('Project',`: the `owner` field is labelled `Client name (title block, optional)` (path `project.owner` unchanged) with the note "blank = the selected DOT's name is used"; the Project card is followed by `+ UL.ownerCard(P, { num, sel, card, esc })`.
- `index.html` `tabOf`: before `p.startsWith('xs') || p.startsWith('ownerRules') || … ? 'xs' : p.startsWith('project') ? 'proj'`; after `p.startsWith('xs') || … ? 'xs' : p.startsWith('project') || p.startsWith('ownerRules') ? 'proj'` (a validation error on `ownerRules.*` now badges the Project tab).
- `engine/model.js`: new `clientName(P)` (exported on `SBDModel`): `project.owner` trimmed if not blank, else `ownerRules.owner` when not AASHTO, else `''`. Display text only.
- `report/builders.js`: the report's Project card row "Owner" is now "Client / owner" = `clientName(P) || '—'`; the two `info` header rows `['Owner', p.owner]` use `clientName(P)`.
- `engine/sheets.js`, cover sheet (anchor `D.text(l, 0, -6.5 * h, h,`): one added line `CLIENT / OWNER: <text>` at y = -8.3h, only when `clientName(P)` is not blank (AASHTO with a blank client: the sheet and DXF are byte-identical to before). The per-sheet title block cells are unchanged.
- `ui/splices.js` note: "(Cross-section & loads tab)" for the owner η and LL multiplier is now "(set on the Project tab)".
### Governing provision
- None changed. The owner rules (AASHTO LRFD 10th Ed. Art. 1.3, 3.4.1 with each manual) are computed exactly as before.
### Check case
- Built-in project, `SBDLoads.fromModel` + `compute` for girder 0 with owner AASHTO, RIDOT, MassDOT, CTDOT: the complete result object (every step and value, 1.9 MB of JSON) from origin/main and from this branch is byte-identical.
### How verified
- `node tests/engine/run.mjs owners paths report report-wiring model sheets drawings`; Playwright at 1280 and 390 px (see the PR).
### Other copies
- None.
### Open items
- "Apply <DOT> defaults" still changes values on the Cross-section & loads and Materials & deck tabs (as before); it now sits on the Project tab. The per-sheet title block has no owner cell (not added: it would move the existing cells).

## 2026-11-01 — PR: sbd-project-library — saved-project list in the browser, Undo / Redo, "Apply <DOT> defaults" message (UI and storage only; no calculation change)
### What changed (no computed value, no formula, no existing storage key or saved format)
- New `apps/steel-bridge/engine/library.js` (`window.SBDLibrary`, classic script, no DOM) and `ui/library.js` (`window.SBDLibraryUI`, the "Saved projects" dialog). Script tags added in `index.html` right after `engine/model.js` (anchor `<script src="engine/legacy.js"></script>`).
- `engine/model.js`, anchor `const KEYS = {`: three keys added after `ui: 'sbd2.ui'`: `libIndex: 'sbd2.lib.index'`, `libItem: 'sbd2.lib.p.'` (+ item id), `libCur: 'sbd2.lib.current'`. `current` (`sbd2.project.current`, the autosave), `backup` and `ui` are unchanged.
- Saved formats (new, versioned): `sbd2.lib.index` = `{ schema: 'sbd2.library', version: 1, items: [{ id, name, number, saved (ISO UTC), size }] }`; `sbd2.lib.p.<id>` = the project file text exactly as Export JSON writes it (schema `sbd2.project` v1, read back through `SBDModel.importJSON`, so the migration path is the same); `sbd2.lib.current` = `{ id }`. A lost or unreadable index is kept under `sbd2.lib.index.unreadable.<time>` and rebuilt from the items.
- Page (`index.html`): header buttons Save, Save as…, Saved projects…, Undo, Redo; a status text after the project name ("Saved", "Unsaved changes", "Not saved to the project list", or the autosave-failed message); Ctrl+S, Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z. The autosave (`M.save` on every change) and Export / Import JSON are unchanged. Opening a saved project, importing a file, replaces the open project only after a confirm when it has changes not saved to the list.
- Undo / Redo: whole-project JSON snapshots taken in `changed()` (one step per input change, up to 100, session only, nothing stored). Starts again when a different project is opened, imported or started with New. Typing inside a field keeps the browser's own undo for that field until the field is committed.
- Quota: every library write is wrapped; a refused write (QuotaExceededError or private mode) returns a message, restores the previous item text and index, and the open project is never touched (message shown, project still open and still autosaved). The dialog shows the characters held by every key of the origin against the ~5 M character (about 10 MB) Chrome / Edge quota, since all file:// pages share it.
- `ui/loads.js`, anchor `else if (a === 'ownDef')`: before `O().defaults(P.ownerRules.owner).forEach(d => { if (d.path === 'deck.tsac') P.deck.tdeck = P.deck.ts + d.value; else { setp(P, d.path, d.value); if (d.path === 'xs.ws.psf') P.xs.ws.mode = 'psf'; } });`; after `lastOwnDef = applyOwnerDefaults(P);` where `applyOwnerDefaults` makes the same assignments in the same order and records, per input, tab, field, old and new (and which were already at the default). The page shows them in a message with an Undo button (`takeOwnerDefaults()`), and the click is one undo step. No default value, owner rule or citation changed.
### Governing provision
- None. Owner defaults are the OWN14 rows of `engine/owners.js` (CTDOT BRSDM V2 3.5.1, 9.7.1.1, 5.4.2.4, 4.6.2.2.1; MassDOT Bridge Manual Part I 4.2.2.3; RIDOT BDM 3.3.1, 9.4.7), applied as before.
### Check case
- `tests/engine/ownerdef-msg.test.mjs`: for AASHTO, MassDOT, CTDOT and RIDOT the project left by `applyOwnerDefaults` is byte-identical (JSON) to the project left by a copy of the previous inline code. CTDOT on the built-in project: Future wearing surface 25 → 38.75 psf, w_c for E_c only (blank) → 0.145 kcf, Dead load distribution MassDOT 3.5.3 → Typical AASHTO; total deck thickness 8 + 0.5 = 8.5 in and weight mode were already set (listed as "already at the default"). MassDOT: Concrete f′c 4 → 5 ksi.
### How verified
- `node tests/engine/run.mjs library ownerdef model` (save / open / list / rename / duplicate / delete round trip; keys outside `sbd2.lib.*` byte-identical after every operation; quota and refused-write paths; index rebuild; the old autosave loads as before; Eastern-time text EST / EDT); `node tests/smoke/steel-bridge-library.mjs` (Playwright at 1280 and 390: save, Save as, list, unsaved-changes warning, rename, duplicate, delete with confirm, quota error with the setItem patched to throw, reload keeps the link, an old autosave with no library keys still opens, 60 input changes then Ctrl+Z x55 / Ctrl+Y, the Apply defaults message and its Undo; 0 console errors).
### Other copies
- None (the pattern follows the project lists of Spread Footing, Base Plate and Pile Designer, which each keep their own copy).
### Open items
- A saved project is stored in addition to the autosave, so each project uses about twice its size in the shared ~5 MB; the dialog shows the use. Duplicate names are not allowed on Save as (the engineer is asked to replace); Rename and Duplicate allow them.
## 2026-11-01 — PR: sbd-custom-demands (1 of n) — "Custom (entered)" demand source: the shared table, Flexure, Shear & stiffeners
Engineer's request: "Each module should allow me to enter forces directly ... I may want to check flexural against manually entered moments."
### What changed (a new demand source only: no formula, factor, unit or reference changed; every other source computes as before)
- New `apps/steel-bridge/ui/demands.js` (`window.SBDCustomDemands`, loaded before `ui/flexure.js` in `index.html`): one table component for every
  module. `SPECS[mod]` lists the columns (the hand-off station fields: `M_DC1`, `M_DC2`, `M_DW`, `M_LLpos`, `M_LLneg`, `M_PLpos`, `M_PLneg`, `M_UT`,
  `M_UF`, `M_FATpos`, `M_FATneg` for Flexure; the `V_*` fields and `V_CL` for Shear, with a support reactions table `DC1, DC2, DW, LL, PL, UT, UF`;
  Flexure also a factored set `Mu_s, Mu_l, Mu_n, Ms_s, Ms_l, Ms_n, Mf_p, Mf_n`). `payload(P, g, mod)` puts the rows in the shape of a hand-off
  (schema `sbd2-custom`) with the project's supports, plates (`section.zones` from the girder's segments), deck, materials, skews and owner, as
  `fromAnalysis` of ui/rating.js / ui/fatigue.js does; a single row is doubled 0.001 ft beside it (the engines interpolate between stations).
  `card` / `wire`: the table (cell edits, paste from Excel into any cell: tab-separated, a header row skipped, `1,450` and `(25)` read; Add row,
  Sort by x, Clear rows; the cell with the focus keeps it after the redraw). `rowsOf`: x inside the girder, no two rows at one x, numbers only.
  `step(mod, C, x, o)`: the worked step `cd.src` "Demands: entered (Custom)" with the entered values. `report(P, mod, g)`: the entered table.
- `ui/flexure.js` `inputs()`: anchor `if (src === 'analysis' || src === 'custom') {` — the custom rows go through the analysis branch unchanged
  (`FX.fromPayload`, the project's deck, materials, owner factors, framing brace points, f_ℓ), then `cust(locs, C, pl)` keeps the locations at the
  entered stations (`keepAt`, ±0.011 ft: both sides of a support or plate change there). C_b: the engine's (`bracing()`, from the entered moments
  linear between rows) where the rows reach both brace points of the location's unbraced length (min x ≤ x_a + 0.25 ft and max x ≥ x_b − 0.25 ft),
  else 1.0 with the nonprismatic γ_e from the local stress (`npr.geA`, `npr.gov` cleared). Factored rows (`mode: 'fac'`): `facPl` gives
  `fromPayload` M_DC1 = M_u,steel, M_DC2 = M_u,long-term, both LL+IM = M_u,short-term with every factor 1 (`FAC1`, no η, m), so region and C_b come
  from the entered Strength I M_u; each location then gets `loc.factored = { str, svc, fat }` (engine/flexure.js's existing factored path).
  `stepsOf(R, r)` (exported) puts the custom step first; the "Demands" topic matches `cd.` ids.
- `ui/shear.js` `build()`: `src === 'custom'` takes `CD.payload(P, g, 'shear')` on the file / analysis path; kept: stations at the entered x
  (`keepAt`), panels holding an entered row (`inPan`; re-indexed, `stations[].pan` remapped), transverse stiffeners whose two panels hold one,
  bearings at supports with reactions entered (`rxn[k]` not null; none: `BS = { rows: [], errors: [], none: true }`, no error). `stepsOf(R, kind, o)` (exported).
- The source choice is saved: `P.demandSrc.flex`, `P.demandSrc.shear` (`CD.srcSet`; a hand-off file stays for the page view only). `srcOf` reads
  `S.src` (file) → `P.demandSrc` → the old default. `index.html` passes `changed` to the Shear tab (as to Flexure).
- `ui/analysis.js` `srcBar`: the source 'custom' ("Custom (entered on this tab, G1)").
- `report/data.js`: `compute(P, g, { src: 'tabs' })` builds a module whose tab is on Custom with its rows, the rest with the analysis; the
  analysis cache key `pkOf` leaves out `custom` and `demandSrc` (editing rows does not rerun the analysis). `report/builders.js`: the sub-section
  "Custom demands entered on the … tab" (`cdSub`), the custom step in the worked steps, the Demands lines of the project card and summary.
  `ui/report.js`: the Demands option "Each tab's choice (Custom where entered; else this project's analysis)".
- `engine/model.js`: documented `custom` and `demandSrc` (optional; absent = as before); `validate` checks their shape only.
### Saved data (CLAUDE.md §5)
- New optional fields `P.custom = { flex | shear: { <girder id>: { mode, rows, sup } } }` and `P.demandSrc = { <module>: 'analysis' | 'example' |
  'project' | 'custom' }`, no new storage key. A project without them loads, validates and computes as before (test "Saved data").
### Decisions (recorded per the engineer's 2026-10-29 rule)
- C_b with custom rows: computed from the entered moments where they span the unbraced length, else 1.0 (6.10.8.2.3 permits 1.0; the gradient
  is unknown). A station beside a support or plate change (±0.01 ft) is interpolated between the entered rows, as the analysis path does.
- Factored entry only where the engine takes factored demands: Flexure (engine/flexure.js `loc.factored`). Shear takes unfactored rows only (V_u,
  deck placement and special fatigue loading combine the loads differently). With factored rows GS19 (moment reversal) is not made.
### Check cases (tests/engine/custom-demands.test.mjs)
- Flexure, built-in G1, x = 44 ft, M_DC1 1450, M_DC2 210, M_DW 240, M_LL+IM +1650 / −400 kip-ft: M_u = 1.25(1660) + 1.50(240) + 1.75(1650) =
  5322.5 kip-ft; M_s = 1900 + 1.30(1650) = 4045 kip-ft; GS6 = 5322.5/9305.2 = 0.5720. RIDOT (η = 1, m = 1.2): M_u = 2075 + 360 + 1.2(2887.5) = 5900.0.
  Pier 1 (x = 109.995 and 110.005): M_u = 1.25(−2630) + 1.50(−380) + 1.75(−2400) = −8057.5 kip-ft, C_b = 1.0 (rows do not reach the brace points).
- Shear, x = 44 ft, V_DC1 20, V_DC2 3, V_DW 3, V_LL+IM 40, V_CL 3, V_FAT 25 kip: V_u = 1.25(23) + 1.50(3) + 1.75(40) = 103.25 kip; deck placement
  1.25(20) + 1.50(3) = 29.5 kip; special fatigue 26 + 1.75(25) = 69.75 kip. Abut. 1 R_DC1 100, R_DC2 15, R_DW 17, R_LL+IM 120: R_u = 379.25 kip.
- Proof of path: rows = this project's analysis at all 363 stations (built-in G1; RIDOT + sidewalk G1 with the pedestrian load): Flexure 367
  locations, 2369 checks and every worked step equal to the 'analysis' source (largest difference 0); Shear 363 stations, 78 panels, 77 stiffeners,
  4 bearings equal (largest difference 0). Factored rows = the unfactored rows × the Table 3.4.1-1 factors by hand: every check ratio equal.
### How verified
- `node tests/engine/run.mjs custom-demands` (9 tests) and `report-wiring report.test model static steps-groups flexure shear.test paths ped-owner
  rating.test tex` (69 passed, unchanged). Playwright (file://, 1280 and 390 px): Flexure and Shear Custom tables, paste, Tab keeps the focus,
  reload keeps the choice and rows, report with "each tab's choice"; 0 console errors; no horizontal page scroll at 390 px.
### Other copies
- None.

## 2026-11-01 — PR: sbd-custom-demands-2 (2 of n) — "Custom (entered)" demands: Constructibility, Fatigue & studs, Rating
### What changed (a new demand source only: no formula, factor, unit or reference changed; the other sources compute as before)
- `ui/demands.js` `SPECS`: `cn` (M_DC1, M_DCc, M_CL; V_DC1 and V_CL just left and just right of the row, a blank right = left), `fat`
  (M_FAT ±, V_FAT ±, M_DC1, M_DC2, M_DW, M_LL+IM ±, M_PL ±, M_UT, M_UF, V_DC1, V_DC2, V_DW), `rt` (no table of its own: `uses: ['flex', 'shear']`).
  `step()`: a step with no station (the studs) lists the row count.
- `ui/constructibility.js`: `arOf(P, g)` (new) gives the entered rows in the shape `SBDConstr.fromAnalysis` reads of an analysis (`x, sup, Lt,
  cont, st.DC1 / st.CL { M, VL, VR }, seq.MDCc` only where M_DCc is entered); `build()` branch `src === 'custom'` runs `fromAnalysis` on it,
  keeps the entered stations (`keepAt`) and places the overhang rows among them (`ohRowsAt`). `srcOf(P)` reads `P.demandSrc.cn`. `stepsOf` (exported).
- `ui/fatigue.js`: `studsOf(P, gi, stations, sup, spans, h0, cont)` split out of `fromAnalysis` unchanged (the auto pitch zones and strength
  regions; `fromAnalysis` now calls it: identical payload, proved by the analysis tests and the custom = analysis test). `build()` branch
  `src === 'custom'`: the payload of the rows with `studsOf` details; the framing lookup treats `sbd2-custom` as this project (`{ gi }`, as
  `sbd2-analysis`); the fatigue details between the first and last row; GS17 at the entered stations. `stepsOf` (exported). `index.html`
  passes `changed` to the Fatigue tab.
- `ui/rating.js`: `buildCustom(ctx)` (new): the Flexure module's custom build and the Shear module's custom build (their tables), rated as
  `build()` rates the analysis (RT.flexure, RT.service, RT.shear with `RT.shearCases` of the shear rows, the owner's fatigue target); the tab
  shows both tables (edited there or on their own tabs, saved once). Factored flexure rows: an error (the rating needs DC, DW and LL+IM apart).
  The capacity steps shown take the custom step (`stepsOf` of Flexure / Shear).
- `report/data.js` ("each tab's choice"): `cn`, `fat`, `rt` too; the Flexure section takes the rating's flexure only when the rating is not on
  Custom. `report/builders.js`: the entered tables (`cdSub`) in the Constructibility, Fatigue and Rating sections (the Rating section: both).
### Decisions
- Fatigue details between the first and last entered row are checked with moments linear between rows (as the hand-off/analysis path
  interpolates); outside that range they are not checked. Studs: the project's pitch zones when entered, else zones made from the rows by span
  tenths (a tenth with no row: V_f = 0, as with no analysis station).
- Rating on Custom takes the Shear tab's rows as entered. Its 'analysis' path takes one station per analysis station (the side with the larger
  permanent shear, ui/rating.js fromAnalysis) while the Shear tab takes both sides of a support (x ± 0.005 ft); with the Shear tab's own
  analysis rows the support stations differ from the Rating tab's analysis by that choice (an existing difference between the two tabs, not
  changed here).
### Check cases (tests/engine/custom-demands.test.mjs)
- Constructibility, x = 44 ft: M_DC1 1200, M_DCc 1350, M_CL 60 kip-ft, V_DC1 30, V_CL 2 kip: M_c = 1.25(1350) + 1.50(60) = 1777.5 kip-ft;
  V_u = 1.25(30) + 1.50(2) = 40.5 kip.
- Fatigue GS17, x = 44 ft, M_FAT +620 / −150 kip-ft: Δf bottom = 770(12)(55.100)/106168.0 = 4.795 ksi; γ = 1.75 (Fatigue I): 8.392 ksi.
- Proofs (rows = this project's analysis): Constructibility 367 locations (+3 overhang rows on an exterior G1), 1835–1853 ratios equal;
  Fatigue 23 details, 367 GS17 locations, 30 stud zones, 6 regions, 1250 values equal; Rating (the rating's own analysis rows in both tables)
  1720 rows, 3440 RF equal; RIDOT + sidewalk the same; largest difference 0 in every case.
### How verified
- `node tests/engine/run.mjs custom-demands` (15 tests) and the module tests listed in the PR; Playwright at 1280 and 390 px (Constructibility,
  Fatigue, Rating Custom tables and results), 0 console errors, no horizontal page scroll.
### Other copies
- None.

## 2026-11-01 — PR: sbd-custom-demands-3 (3 of 3) — "Custom (entered)" demands: Field splices and Welds
### What changed (a new demand source only: no formula, factor, unit or reference changed; the analysis and file sources compute as before)
- `ui/demands.js` `SPECS`: `spl` (one row per splice station: M_DC1, M_DC2, M_DW, M_LL+IM ±, M_PL ±, M_CL, M_UT, M_UF, M_FAT ±, V_DC1,
  V_DC2, V_DW, V_LL+IM, V_PL, V_CL, V_UT, V_UF) and `wt` (V_DC1, V_DC2, V_DW, V_LL+IM, V_PL, V_UT, V_UF, ΔV_FAT, M_FAT ±).
- `engine/splices.js` (plumbing, no calculation): `inputsAt(P, gi, AR, x, opt)` anchor `const p = clone(DEF), dm =`: before
  `A = arraysFromAnalysis(AR), dm = demandsAt(A, x)`; after `dm = opt.dem ? opt.dem(x) : demandsAt(arraysFromAnalysis(AR), x)`. `girder()`:
  with `opt.dem`, a splice whose `opt.dem(x)` is null is listed in `errors` ("no demands entered at this station") and not checked; AR then
  only needs `{ Lt, sup, cont }`. Without `opt.dem` the code path is the one before (same calls in the same order).
- `ui/splices.js`: a Demands choice on the Field splices tab (this project's analysis, the default / Custom; saved in `P.demandSrc.spl`);
  `build(ctx)` (new, exported; `calc` calls it), `demOf(row)` (an entered row as `p.dem`: LL+IM with the pedestrian load, its part in `dem.pl`
  as demandsAt gives it; shears as magnitudes; dMp ≥ 0, dMn ≥ 0); the row within 0.01 ft of each splice station; `stepsOf` (exported). The
  demand note says "as entered (Custom), row x = …".
- `ui/welds.js`: `custD(P, gi)` (new): the rows as `fromDemands`' arrays at the weld points themselves (each side of every support and plate
  change): left = the row at x or just left (≤ 0.011 ft), right = at x or just right; a side without a row is dropped from `p.fw`, a
  transition without a row on either side from `p.tr`. `input(P, gi, pl, cu)`: the analysis is not run with `cu`. `srcOf(P)` reads
  `P.demandSrc.wt`; `stepsOf` (exported).
- `report/data.js` / `report/builders.js` ("each tab's choice"): Field splices and Welds on Custom, with their entered tables and steps.
### Cross-frames
- Not changed: the Cross-frames tab already takes entered forces ("Member forces from a refined analysis (optional)": factored Strength I,
  constructibility and fatigue-range member forces, added to the wind and brace forces; and the stability-bracing M_u, `crossframes.sb.Mu`).
### Check cases (tests/engine/custom-demands.test.mjs)
- Splice FS1 (82 ft): M_DC1 100, M_DC2 20, M_DW 25, M_LL+IM +800 / −300 kip-ft, V 20 / 3 / 3 / 40 kip: Strength I + 1.25(120) + 1.50(25) +
  1.75(800) = 1587.5 kip-ft; Strength I − 0.90(120) + 0.65(25) + 1.75(−300) = −400.75 kip-ft; V 1.25(23) + 1.50(3) + 1.75(40) = 103.25 kip;
  Service II + 145 + 1.30(800) = 1185 kip-ft.
- Welds, Pier 1 one row (both sides): top shear flow from DC1 1.25(95)(909.99)/69,424 = 1.557 kip/in.
- Proofs (rows = this project's analysis demands): Field splices 4 splices, the same auto-designed plates and bolts, 464 check ratios equal;
  Welds 14 locations and 8 transitions, 122 ratios equal (built-in; RIDOT + sidewalk the same); largest difference 0.
### Other copies
- None.
- Display fix found by the custom tests (`engine/studs.js`, the SC1 step `scz<i>.ok`, anchor `label: 'Fatigue pitch (SC1)'`): a pitch zone with
  no fatigue shear (V_f = 0: p_req = ∞) wrote its substitution as `24.00 \le —`, which KaTeX cannot parse. Before
  `${n2(z.preq)}`; after `${isFinite(z.preq) ? n2(z.preq) : '\\infty'}`. The value, ratio (0) and pass state are unchanged.

## 2026-11-01 — PR: sbd-welds-overhang — Welds tab uses the project's load factors; strength check headlines the welds summary; Auto design minimum overhang (engineer-approved)
### 1. Welds tab load factors (calculation input change, §4)
- `apps/steel-bridge/ui/welds.js`, `input(P, gi, pl)`: anchor `gam: { ...Wd.gam }` (two places: the hand-off file branch `gen = { ...d.gen, Fexx: Wd.Fexx, gam: { ...Wd.gam } }`
  and the analysis branch `const gen = { gF: m.steel.top, gW: m.steel.web, Fexx: Wd.Fexx, gam: { ...Wd.gam }, `). Before: `gam: { ...Wd.gam }` (the tab's own inputs
  `P.welds.gam`). After: `gam: projGam(P)`, new function
  `function projGam(P) { const G = window.SBDShear && window.SBDShear.factors ? window.SBDShear.factors() : { dc: 1.25, dw: 1.50, ll: 1.75 }, F = ((P.fatigue || {}).gam || {}).fI; return { dc: G.dc, dw: G.dw, ll: G.ll, fat: F != null && F !== '' ? +F : 1.75 }; }`
  Strength I γ_DC 1.25, γ_DW 1.50, γ_LL 1.75 (AASHTO LRFD 10th Ed. Table 3.4.1-1, the Shear tab's `SBDShear.factors()`); Fatigue I γ from the Fatigue & studs
  input `fatigue.gam.fI` (Table 3.4.1-1, default 1.75). The Custom (entered) demand source of #522 takes the same `projGam(P)` (its branch shares
  the analysis branch's `gen`; merged 2026-11-01 keeping both). Owner η and m (Project tab; a file: its owner factors) are applied by engine/welds.js as before (unchanged).
- `render()`: the four inputs `nIn('wt_dc' …) … nIn('wt_fat' …)` and their handler `['dc', 'dw', 'll', 'fat'].forEach(k => on('wt_' + k, …))` removed; replaced by
  `gamHtml(P, file)`: the four factors read-only, links to the Flexure tab (Table 3.4.1-1 note), the Project input tab (η, m) and the Fatigue & studs input
  (`data-goin="fs" data-gofld="fatigue.gam.fI"`, which opens that input tab and focuses the field). `oldGam(P)`: each saved `P.welds.gam` value that differs from
  the project's factor is listed in a warning ("no longer used", with the value now used).
- Saved data (§5): `P.welds.gam` stays in the project file unchanged (defaultWelds() still writes it; GirderDetail import still fills it); unused.
  `engine/model.js` validate: the line `['dc', 'dw', 'll', 'fat'].forEach(k => pos((Q.gam || {})[k], `welds.gam.${k}`, `Load factor ${k}`));` removed (an unused value
  that can no longer be edited must not block the calculation).
- Decision (coordinator, engineer's "one source" rule): Fatigue I from the Fatigue & studs input. Follow-ups, not changed here: the Shear tab (transverse
  stiffener welds, `gam: { dc: 1.25, dw: 1.50, ll: 1.75, fat: 1.75 }`) and the Flexure engine (`factors()`) hard-code Fatigue I 1.75; the Splices tab keeps its own
  load factor inputs `splices.gam`.
- Check case (default project, G1, Node, engine modules as tests/engine/welds.test.mjs loads them), FW1 governing at Pier 2 left, top, w = 5/16 in:
  LL+IM term v = γ_LL V Q/I = 1.75(129.164)(2549.405)/162131.93 = 3.5543 kip/in; DC1 1.6324, DC2 0.3300, DW 0.3280 kip/in;
  v_u = 1.6324 + 0.3300 + 0.3280 + 3.5543 = 5.8446 kip/in; R_r = 2(0.6)(0.80)(70)(0.707)(0.3125) = 14.847 kip/in; FW1 = 0.3937.
  - Default factors: before = after, every check item identical (FW1 0.3937, FW2 0.3199, FW3 0.3927, TR1 0.4326).
  - An old project with `welds.gam = { dc: 1.25, dw: 1.50, ll: 1.50, fat: 1.50 }`: before (the saved factors used) LL term 1.50(129.164)(2549.405)/162131.93 = 3.0465,
    v_u = 5.3369 kip/in, FW1 0.3595, FW2 0.2921, FW3 0.3366, TR1 0.3708; after (the project's 1.75 / 1.75) FW1 0.3937, FW2 0.3199, FW3 0.3927, TR1 0.4326
    (more conservative; the tab shows the warning "γ_LL (Strength I) 1.5 (now 1.75), γ Fatigue I 1.5 (now 1.75)").
  - Fatigue & studs γ Fatigue I = 1.50: FW3 and TR1 × 1.50/1.75; FW1, FW2 unchanged.
- Note (browser vs Node, not a code difference): in the page G1's FW1 is 0.3951 at Pier 1 right; in the Node test 0.3937 at Pier 2 left. Same project, same
  LL+IM, DC2, DW; DC1 differs (100.980 vs 99.631 kip) because the page loads engine/crossframes.js and the analysis adds the cross-frame weights as point loads
  (analysis.js `SBDCrossframes.pointLoads`); the welds Node test does not load it. Pier 1 right and Pier 2 left are a symmetric near-tie (5.86670 vs 5.86665 kip/in).
### 2. Welds summary (display only)
- `ui/welds.js` `results(B)`: the governing table is grouped (`SUM`): Strength (FW1, FW2), Fatigue (FW3, TR1), Detailing limits (FW4, TR2, TR3, TR4), with the
  headline "Governing strength check: <FW1|FW2>, <location>: ratio" (`strengthGov(C)`) and a status line counting every item of every check. `defaultSel(R)`:
  the worked steps open on the strength-governing location (before: the largest ratio of any check, often FW4 at 1.000).
- `report/builders.js` `wd(B, X)`: anchor `[[/^FW/, 'Welds: flange-to-web (FW1–FW4)'], [/^TR/, 'Welds: shop flange transitions (TR1–TR4)']]` → three summary
  groups `[[/^FW[12]$/, 'Welds: strength (FW1, FW2)'], [/^(FW3|TR1)$/, 'Welds: fatigue (FW3, TR1)'], [/^(FW4|TR[234])$/, 'Welds: detailing limits (FW4, TR2–TR4)']]`;
  the governing table in the order FW1, FW2, FW3, TR1, FW4, TR2, TR3, TR4 with a strength headline note. No check, ratio or status changed.
### 3. Auto design minimum overhang (engineer decision 2026-11-01)
- `engine/autodesign.js`: `const OH_MIN = 2.5;` and in `settings(P)`: `s.ohMin = a.ohMin !== '' && a.ohMin != null && isFinite(+a.ohMin) && +a.ohMin >= 0 ? +a.ohMin : OH_MIN;`
  `ohCands`: before `lo = q.mode === 'range' && q.min != null ? q.min : 1.5`; after `lo = Math.max(S.ohMin, q.mode === 'range' && q.min != null ? q.min : S.ohMin)`.
  Lock unchanged; the Range max, the spacing limits and the owner's limits (RIDOT BDM 9.4.1.4, CTDOT BRSDM V2 9.7.1.5, `ohLimit`) still apply on top.
- `ui/autodesign.js`: input "Minimum overhang" (`data-ad="ohMin"`, ft) next to "Overhangs". Saved as `P.autodesign.ohMin` (new optional field; absent = 2.5 ft).
  An old project's Auto design result can change where an overhang below 2.5 ft was chosen.
- Governing provision: practice / owner limits, not an AASHTO article (the old 1.5 ft was Preliminary sizing's ws.ohMin).
- Check case (Auto design study, Node, scratch script; builtin_AASHTO of tests/engine/ad-fixture.mjs, the match-legacy settings of
  autodesign-parity.mjs but the overhang Auto (the SB2-AD12 study run); N_b = 5, W_deck = 3.25 + 4(9.5) + 3.25 = 44.50 ft):
  - Before (origin/main): overhangs tried 1.5, 2.0, 2.5, 3.0, 3.5 ft; chosen 1.5 ft (S = (44.50 − 2(1.5))/4 = 10.375 ft); best candidate 398,740 lb (all girders),
    D = 57 in, governing ratio 1.000 (stiffeners TS7 minimum fillet weld size). Same as the earlier study.
  - After: overhangs tried 2.5, 3.0, 3.5 ft; chosen 2.5 ft (S = (44.50 − 2(2.5))/4 = 9.875 ft); best candidate 419,822 lb, D = 62 in, governing ratio 1.000
    (stiffeners TS2 projecting width b_f/4). +21,082 lb (+5.3 %) for the 2.5 ft minimum.
  - Hand check of the candidate list: seq(max(2.5, —), min(4.0, …), 0.5) = 2.5, 3.0, 3.5 (4.0 out: S = 9.125 ft, 0.40S = 3.65 ft < 4.0 ft).
### How verified
- See the PR (tests, Playwright at 1280 and 390 px).
### Other copies
- None.

## 2026-11-01 — PR: sbd-ext-demands — Demand files: GirderDetail hand-offs only, checked as ST-Girder checks them; selfWeightExcluded (B1)
### Finding (the task's premise corrected)
- The task asked to port the old app's readers of MCT Generator / MIDAS, PS-Beam (`psbeam-external-demands`) and steel-beam
  (`steelbeam-external-demands`) envelopes and its `selfWeightExcluded` flag. The old app no longer reads them: since the engineer's
  decision DISC (2026-10-19, fixlog/stgirder.md "DISC"), ST-Girder's Import (`const importJSON=` in the `st-src` block of
  "Steel Bridge Design.html") takes a demands file only when it is GirderDetail's (`_schema === 'stgirder-external-demands'` and
  `extFromGD(p)`: `producer === 'GirderDetail'` with a `girderDetail` block) and then applies it through `gdAdopt` after `gdCheck`; any
  other demands file (the three schemas, or any JSON with a top-level `stations` array) is refused with "ST-Girder now takes demands
  only from GirderDetail; this file is from <producer> and was not loaded. Nothing was changed." GirderDetail always writes
  `selfWeightExcluded: false` (its M_DC1 includes the girder self-weight). The `swExcl` / `swContinuous` code in ST-Girder's compute
  path is only reachable by a hand-edited GirderDetail file. docs/steel-bridge-comparison.md F-8 read the compute-path schema lists
  (`extActive`, st-src) and missed the Import refusal.
- The new app's tabs took any file with `_schema === 'stgirder-external-demands'` and a `stations` array, from any producer, and ignored
  `selfWeightExcluded`: an MCT/MIDAS envelope written in that schema with the self-weight excluded would have under-counted DC1 (the
  F-8 risk). This PR closes that by doing what the old app does.
### Change
- New `engine/demandfile.js` (`window.SBDDemandFile.check(j)`): ST-Girder's `extFromGD`, `gdCheck`, `gdLoadsCheck` and `externalSpans`
  ported operation for operation, and the Import's refusal branch with its message (naming this app's choices instead of "Pull from
  GirderDetail"). New here: a GirderDetail file with `selfWeightExcluded: true` is refused (ST-Girder would add its own continuous
  self-weight, SW-CONT, on top of GirderDetail's M_DC1, which already holds it: see the check case).
- The seven hand-off file readers (ui/flexure.js `fx_file`, ui/shear.js, ui/fatigue.js, ui/constructibility.js, ui/rating.js,
  ui/welds.js, ui/report.js): before
  `pl = j.payload || j; if (!pl || pl._schema !== 'stgirder-external-demands' || !Array.isArray(pl.stations)) throw new Error('not a GirderDetail → ST-Girder hand-off file (schema stgirder-external-demands)');`
  after `ck = window.SBDDemandFile.check(j); if (!ck.ok) throw new Error(ck.error); const pl = ck.pl;`; and on an error the previous
  file stays (before: `S.pl = null; S.plName = '';`), as ST-Girder's "Nothing was changed".
- index.html: one script tag `engine/demandfile.js` after engine/model.js.
### §4 callout
- No formula, factor, unit or code reference changed. Results change only for files that are now refused (no result instead of a
  result): non-GirderDetail demand files, GirderDetail files that fail ST-Girder's gdCheck (units other than ft / ft-kip / kip,
  factored, a non-numeric station value, bad ownerRules, an invalid span layout), and `selfWeightExcluded: true`. All 112 recorded
  GirderDetail hand-offs (tests/projects/st) pass and are used unchanged (the same object as before), so every result on them is
  unchanged. Governing provision for DC1 completeness: AASHTO LRFD 10th Ed. Art. 3.5.1 (DC includes the structural components' weight).
- Check case (def15_AASHTO_G2, span 1 = 110 ft, x = 66 ft): the file's M_DC1 = 524.167 kip-ft, of which M_DC1steel = 88.124 kip-ft;
  the new app takes 524.167 (Flexure `fromPayload` env.MDC1, nothing added): the self-weight counted once. The same file marked
  `selfWeightExcluded: true` in ST-Girder gives M_DC1 = 602.223 kip-ft (+78.056, its own continuous self-weight 0.233 klf added on top:
  the steel twice); in the new app it is refused. The MCT fixture (tests/projects/ext/mct_psbeam_selfweight_excluded.json, M_DC1 at
  x = 66 = 524.167 − 88.124 = 436.043 kip-ft, no self-weight) is refused by both apps.
### Fixtures and tests
- tests/projects/ext: `mct_psbeam_selfweight_excluded.json` (MCT Generator export shape of index.html "Organize for PS-Beam tool",
  def15 G2 stations every 6 ft with the steel removed from DC1), `mct_stgirder_schema.json` (same in the stgirder schema), 
  `steelbeam_envelope.json` (60 ft simple span), `midas_bare_stations.json` (a bare station list).
- tests/engine/demandfile.test.mjs: the 112 hand-offs taken unchanged (ST-Girder's gdAdopt takes a sample too); the four fixtures
  refused with the producer named, and ST-Girder's refusal condition read from its source; eight gdCheck failures refused with
  gdCheck's reason, each refused by ST-Girder's gdAdopt too; the selfWeightExcluded check case above.
### Open (engineer)
- If MIDAS / MCT envelopes are wanted in the new app after all, that reverses DISC for the new app and needs the self-weight addition
  (SW-CONT) ported; not done here (CLAUDE.md §9).
### Other copies
- None (ST-Girder's code is read only, not changed).

## 2026-11-01 — PR: sbd-handoffs — Cross-tool hand-offs: projectMeta, lldf pull, superReactions (B2)
### What GirderDetail does, and what this app now does (HANDOFF.md §4.1, §4.3, §4.4; keys and formats unchanged, CLAUDE.md §5)
- projectMeta: GirderDetail's `Shared project info` script ("Use shared project info" / "Share project info"). Ported in `ui/handoffs.js`
  (`pmFields`, `pmPayload`, `pmPlan`); fields projectName → project.name, jobNo → number, client → owner (Client name), preparedBy →
  designer, checkedBy → checker, date → date; bridgeId and location: no field here, sent blank.
- lldf: GirderDetail `gdLldfPlan` / `gdLldfDialog` / `gdLldfApply` (anchor `const GD_LLDF =`) ported as `lldfPlan`, a `<dialog>` and
  `lldfApply`: the same refusals (unit, span count, perFootStrip, beam basis with another girder count, missing gM/gV), warnings (span
  lengths > 0.5 ft, girder count, cross-section type, skew > 0.5°, no fatigue factors, no negative factors) and mapping (governingBySpan[i]
  to span i when complete for every span, else governing; governingNeg.gM to every pier). Receiver id `steelbridge` (new adoption key
  `bridgeSuite.v1.lldf.adopted.steelbridge`, same format). GirderDetail writes its manual factors (sa.dfm, sa.dfSrc = 'manual'); here:
  new optional field `girders[i].dfPull` (engine/model.js header), read by `engine/analysis.js dfOf`.
- superReactions: GirderDetail `gdSrPayload` (anchor `const GD_SR =`) ported as `srPayload`; the same envelope, supports (Abut. 1, Pier k,
  Abut. 2), girders G1…Gn with position, DC1/DC2/DW (and UT/UF), allGirders, ownerRules, utilities, notes; channel key plus the copy
  `superReactions.by.girderdetail`. producer "Steel Bridge Design", producerFile "apps/steel-bridge/index.html".
- Not ported: girderDemands (GirderDetail → ST-Girder inside the old app; this app has both roles) and the PlateLine → GirderDetail inbox
  (`girderdetail_inbox_v1`, internal to the old app; this app is one model).
### §4 callout (calculation path: distribution factors)
- `engine/analysis.js dfOf(P, g, ns, mod)`: before, the factors came from (1) girder.df, (2) the loads module, (3) girder.dfManual
  (now `dfBase`, unchanged). After: `dfOf` = `dfBase`, then, only when `girders[i].dfPull` exists with `use !== false` and as many spans,
  each of gM, gV, fatM, fatV per span and gM per pier is the pulled value where the payload had it (positive number), else the
  `dfBase` value; gDef always `dfBase`. Source text: "pulled from LL & DL Distribution (lldf.html), produced …; for G2, LL & DL interior
  envelope, per span[; fatM, fatV not in the hand-off: from …]; deflection factor from …" (Analysis tab card and report "Distribution
  factors"). No formula, factor or unit changed; a project without dfPull computes exactly as before (test: dfOf deep-equal).
- Governing provisions: AASHTO LRFD 10th Ed. Art. 4.6.2.2 (distribution factors, computed by lldf.html), 3.6.1.4.3b (fatigue one lane
  ÷ 1.2), 3.6.1.1.2 (multiple presence, in lldf's gM/gV).
- Check case (built-in project, plate girder G1 = cross-section girder G2, interior; spans 110-140-110 ft): span 2 g moment pulled as
  0.800, module 0.6639; at x = 180 ft (span 2 midspan) M_LL+IM = g_M × M_per lane: the per-lane envelope is unchanged and M_LL+IM
  scales by 0.800 / 0.6639 = 1.20500 (tests/engine/handoffs.test.mjs). Proof of path: LL & DL factors equal to the module's (to 4
  decimals) give the module's factors (|Δ| < 5e-5).
- superReactions hand checks: G2 (own line) reactions = its analysis' stage reactions to 0.001 kip; Σ DW reactions = w_DW × 360 ft for
  every girder; G3 (borrowed plates) DC1/DC2/DW and LL+IM reactions equal a full run of that line. Built-in project, kip (DC1/DC2/DW):
  Abut. 1 G1 46.19/13.41/8.16, G2 55.36/9.85/8.16, G3 55.36/6.29/8.16; Pier 1 G2 204.68/35.24/29.19.
- Speed: a cross-section girder that borrows a plate girder's plates takes the HL-93 per-lane reactions (and pedestrian influence areas)
  from that plate girder's full run × its own g_V (larger of adjacent spans, as analysis llR) and its own w_PL, and its dead loads from
  its own run without live load (opt.ll = false): the same values as a full run (tested), without one moving-load run (~20 s) per girder.
### Decisions recorded (CLAUDE.md §9; decided, not engineering formulas)
- A cross-section girder with no plate girder of its own uses the plates of the first plate girder of its position, else the first plate
  girder (GirderDetail had per-type plates from Preliminary sizing); the notes name each borrowed line.
- The copy key is `by.girderdetail` (Substructure Loading lists only psbeam, mct, girderdetail); during the transition the old and the new
  app overwrite each other's copy there. Producer text says which app sent it.
### Files
- New: `ui/bridgexfer.js` (BridgeXfer v1, verbatim HANDOFF.md §5 copy), `ui/handoffs.js`, `tests/engine/handoffs.test.mjs`.
- Changed: `engine/analysis.js` (dfOf/dfBase), `engine/model.js` (header comment), `index.html` (two script tags, the Project-tab card,
  click hook, init), HANDOFF.md (§4 table, §4.1, §4.3, §4.4 notes).
### Other copies
- BridgeXfer v1: `apps/steel-bridge/ui/bridgexfer.js` joins the existing verbatim copies (HANDOFF.md §5).

## 2026-11-01 — PR: shared-lldf-steps (LLST) — the LLDF worked-step writer moved to shared/lldf.js (SharedLLDF.steps); no output change
### Where
- `apps/steel-bridge/engine/lldf.js`: `geometrySteps`, `skewSteps`, `empSteps`, `leverSteps`, `rigidSteps`, `member`, `memberSteps`,
  `extSteps`, `finalSteps`, `withC` moved to `shared/lldf.js` (`SharedLLDF.steps`); the adapter calls them (`SS()`). Details, the
  exact before → after and the verification: `fixlog/shared-lldf.md` (LLST).
### Check case / How verified
- 1,920 LLDF cases (every sbd2-loads fixture × geometry variants × options), 2,227,456 steps: full outputs hash identically before and
  after; `node tests/engine/run.mjs lldf loads report steps tex static paths girderdetail` pass.
## 2026-11-01 — PR: claude/sbd-scroll — scroll check: the Spread Footing "won't let me scroll up" bug (SFSC) is not present here; regression test added (SBSC; test only, no change to the app)

### What was checked
- Spread Footing (PR #524, fixlog SFSC in `fixlog/Spread Footing.md`): with `html,body{overflow:hidden}` and two scrolling panels, KaTeX's hidden
  `span.katex-mathml` (`position:absolute`) escaped the unpositioned panels and made the document taller than the window, so `scrollIntoView` /
  `focus()` / link jumps scrolled the page itself and it could not be scrolled back.
- `apps/steel-bridge/index.html` has the same frame (`html,body{overflow:hidden}` at ≥ 900 px, `#inputPanel` and `#outputPanel` with `overflow-y:auto`),
  but both panels are already `position:relative` (anchor `#inputPanel{flex:0 0 33%;…overflow-y:auto;position:relative;` and
  `#outputPanel{flex:1 1 67%;…overflow-y:auto;position:relative;`), so they contain and clip the MathML spans. Measured with the real KaTeX 0.16.9 and
  three.js r128 (tests/libs): on every output tab, calculated, with the Report built, the document is exactly the window height (overflow 0 px) and its
  scroll stays 0 after every scripted scroll.
- Proof the test catches the bug: a scratch copy with `position:relative` removed from both panels fails it (the Section properties tab 576 px taller than
  the window; a "see work" link scrolls the page 282 px with the header off screen and not recoverable by the wheel; Constructibility 2147 px, …).

### Change
- New `tests/smoke/steel-bridge-scroll.mjs` (no app file changed). Headless Chromium, `file://`, 1280×800, 1366×768, 1920×1080: every output tab
  (calculated with its own button, Report built), every input tab, up to two of each kind of script-scrolling link on every tab (grouped-steps "see §" /
  "see work", the step links of Fatigue, Cross-frames, Rating, Welds, Shear, Auto design and Drawings, input-tab and output-tab links, Report "see §" and
  contents links), `scrollIntoView` of the panel bottom and of the last report step, `focus()` on the last input, `window.scrollTo(0,400)`, a 3D canvas
  drag, touch swipes; the document stays at 0, the panels wheel back to 0 with the header on screen; below 900 px the page still scrolls.
- Saved data: none. Calculations: none.
## 2026-11-01 — PR: claude/sbd-cf-replace — Cross-frames: entered member forces "Add to computed" (default) or "Replace computed", per group (CFRM; calculation change only when "Replace" is chosen; old projects identical)

Line numbers are approximate; search for the anchor text. Every code site is tagged `CFRM`.

### What changed
- Engineer's request (approved 2026-11-01): the Cross-frames card "Member forces from a refined analysis" adds the entered factored forces to the
  computed ones; add a choice per force group: "Add to computed" (today, default) or "Replace computed" (the entered forces alone).
- What "computed" is, per group (today's arithmetic, `engine/crossframes.js` `compute`, anchor `const combos = [{ id: 'StrI'`): Strength I takes the
  entered forces only (nothing is computed for Strength I); Strength III and V take the computed wind forces f_w F_w only (4.6.2.7.1); Constructibility
  takes the entered forces plus the stability bracing force |f_br M_br| (6.7.4.2.2). Each member is designed for the largest over the four cases.
- **Decision (recorded, engineer's "decide yourself" rule):** the groups with a computed part are Strength (I, III, V) and Constructibility.
  - Strength, Replace: the entered forces are the Strength design forces; the computed Strength III and V wind cases are not used (`cb.off`, their
    member forces 0, the table shows "not used"). Reason: a refined analysis that gives the member forces is taken to cover the wind cases; otherwise the
    engineer keeps "Add".
  - Constructibility, Replace: the brace force is not added (`cb.rep`); CF7 (stability bracing strength, which only re-states the members under the
    brace force) is not applicable with a reason; CF8 (stiffness, independent of the forces) still checked.
  - Fatigue ranges ΔP: no choice; nothing is computed for fatigue (a line-girder analysis gives no cross-frame force range): the entered ranges are used
    alone, as before; the card says so.
  - The diaphragm option (CFD, CFE) does not use the entered angle-member forces in either mode (unchanged).
- Code:
  - `engine/crossframes.js`: new `userModes(p)` (`p.userMode` absent → `{ StrI: 'add', Con: 'add' }`), exported. In `compute`, before:
    `const w = Math.abs(e.unit * cb.wind) + Math.abs(e.ubr * (cb.Mbr || 0))`; after: `const w = cb.off || cb.rep ? 0 : Math.abs(e.unit * cb.wind) + Math.abs(e.ubr * (cb.Mbr || 0))`
    (`cb.off` on StrIII/StrV when Strength is Replace; `cb.rep` on Con when Constructibility is Replace). `R.UM` = the modes. `checks` CF7: `naWhy` when
    Con is Replace. `steps`: new steps `cf.user.StrI`, `cf.user.Con` (the entered forces, which mode, what it means) when a force is entered or Replace is
    chosen; `cf.<member>.forces` gets a note on the modes then. `defaults()`: `userMode: { StrI: 'add', Con: 'add' }`.
  - `engine/model.js`: `defaultCrossframes()` `userMode: { StrI: 'add', Con: 'add' }`; `validate` accepts absent, 'add', 'replace'.
  - `ui/framing.js`: `ensure` adds the default `userMode` to an older project (no result change); the input card has a "With the computed forces"
    choice under Strength I and Constructibility and a note on what each means; the member-forces table shows "not used"; the governing card and the
    table note say which mode applies, with a link to the Spans & framing input tab and to the worked step; new topic "Member forces entered from a
    refined analysis" (`/^cf\.user\./`).
  - `report/builders.js` `frm`: the member-forces table shows "not used" for the Strength III and V columns under Strength Replace.
- Saved data: new optional field `P.crossframes.userMode`; absent = Add (today's results). No key or format changed.

### Custom (entered) demand source on this tab (ui/demands.js): not added — reason
- The Cross-frames tab takes one demand from the girder analysis: the factored deck-placement M_u for the stability bracing (6.7.4.2.2), and it already
  has an input for it ("Factored deck-placement M_u (blank: analysis)"). The member forces themselves are not girder demands (they are not in the
  hand-off station format the shared table writes); entering them is this card, now with Add / Replace. A Custom table of M_DC1 / M_CL rows would only
  feed that one M_u, which is entered directly already. Raised for the engineer in the PR.

### Check case (GirderDetail's built-in Cross-frames inputs `CF.DEF`, X-frame, h = 48 in, S = 114 in; entered Strength I {top 6, bot −8, diag 12}, Constructibility {top 2, bot −1.5, diag 3} kip)
- M_br = 389.226 kip-in; f_br (top chord) = 1/h = 0.020833 per kip-in → |f_br M_br| = 389.226/48 = 8.1089 kip.
- Constructibility, top chord: Add (before = after at the default): T = 2 + 8.1089 = 10.109 kip, C = −(2 − 8.1089) = 6.109 kip → top chord T_u 10.109 (Con),
  C_u 6.109 (Con), CF1 top 6.109/52.71 = 0.1159, CF2 top 0.1254. Replace: T = 2, C = 0 → T_u = 6.00 (Strength I governs), C_u = 0; CF1 top 0.0000,
  CF2 top 0.0744; CF7 not applicable; CF8 unchanged (0.0367, 0, 0.0838, 0.1205).
- Strength, diagonal: Add: C_u = |−0.69511 × 3.6617| = 2.545 kip (Strength III), CF1 diag 0.0514. Replace: Strength III and V not used, C_u = 0, T_u = 12.00
  (Strength I), CF1 diag 0.0000; CF3 diag 0.8927 → 0.5207 (the tension limit 240 applies when the member has no compression, the existing rule).
- Governing articles: AASHTO LRFD 10th Ed. Arts. 4.6.2.7.1 (wind load distribution), 6.7.4.2.2 (stability bracing), Table 3.4.1-1 (the combinations).
  No formula, factor or resistance changed.

### Proof nothing else changes
- `tests/engine/crossframes.test.mjs` (parity with GirderDetail's own GM.cf in Node): 2041 cases, 793,205 values, 58,248 check items, largest relative
  difference 0; weight 27,480 point loads identical. New test (CFRM): absent = Add bit for bit; the hand check above; the steps; the diaphragm unchanged.
- Scratch comparison origin/main vs this branch (126 cases: the 63 recorded GirderDetail cross-frame states of tests/projects/sbd2-fat and sbd2-stiff,
  each also with entered forces, and 6 variations): checks, members, combos and every worked step other than the new `cf.user.*` steps and the
  `.forces` note identical.
- `tests/engine/model.test.mjs`: default add / add, absent valid, unknown value an error.

### Other copies
- None.

## 2026-11-01 — PR: claude/sbd-fatigue-gamma — Fatigue I γ from one source: Flexure, Shear & stiffeners and Cross-frames take it from the Fatigue & studs input (FGAM; calculation change only for a non-default γ; at 1.75 identical)

Line numbers are approximate; search for the anchor text. Every code site is tagged `FGAM`.

### What changed (engineer-approved 2026-11-01, "one source", as Welds in #525)
- New helper in `ui/flexure.js` and `ui/shear.js`: `const fatI = P => { const v = +(((P && P.fatigue) || {}).gam || {}).fI; return v > 0 ? v : 1.75; };`
- `ui/flexure.js` `build`:
  - hand-off file: `FX.fromPayload(pl, { fl, lf: lfF, ...` → `FX.fromPayload(pl, { fl, lf: lfF, G: { fat: fatI(P) }, ...`
  - analysis / Custom: `fopt = { owner: own, rebar: d.rebar, fl: D.fl, lf }` → `fopt = { owner: own, rebar: d.rebar, fl: D.fl, lf, G: { fat: fatI(P) } }`
    (a factored Custom table still sets `fopt.G = FAC1`: the entered values are factored, γ 1)
  - example: `G: lf ? FX.factorsOwner(lf) : FX.factors()` → `G: lf ? FX.factorsOwner(lf, { fat: fatI(P) }) : FX.factors({ fat: fatI(P) })`
  - note: "Fatigue I 1.75" → "Fatigue I <γ> (Fatigue & studs inputs link; a factored Custom table: as entered)".
- `ui/shear.js` `build`: `G = SH.factorsOwner(lf)` → `G = SH.factorsOwner(lf, { fat: fatI(P) })` (special fatigue requirement GS18, 6.10.5.3:
  V_u = V_DC1 + V_DC2 + V_DW + V_UT + V_UF + γ V_fat); transverse stiffeners `gam: { dc: 1.25, dw: 1.50, ll: 1.75, fat: 1.75 }` →
  `gam: { dc: 1.25, dw: 1.50, ll: 1.75, fat: fatI(P) }` (CP2, γ(Δf) at the stiffener weld toes); note: "permanent shear + 1.75 V_fat" → "Fatigue I γ <γ> (link),
  permanent shear + γV_fat".
- `engine/crossframes.js`: `compute` `gF = 1.75 * 0.65` → `gFI = nm(p.gFI) > 0 ? nm(p.gFI) : 1.75, gF = gFI * 0.65` (CF9; `R.gFI`); `inputsOf` sets
  `p.gFI` from `P.fatigue.gam.fI` (1.75 without one; GirderDetail's own inputs have none, so the parity runs are at 1.75); CF9 note and step `cf.<m>.fat`
  show γ (eq `γ_{Fat I}(0.65)ΔP/A_g`, sub `<γ>(0.65)ΔP/A_g`).
- Fatigue II: none of these modules uses it (the Fatigue & studs module reads `gam.fII` itself already).
- Governing provisions: AASHTO LRFD 10th Ed. Table 3.4.1-1 (Fatigue I γ), Art. 6.10.5.3 (special fatigue requirement for webs), Art. 6.6.1.2 (load-induced
  fatigue: flexure stress ranges, stiffener weld toes, cross-frame members with the 0.65 factor). No formula changed; the factor's source changed.

### Check case (default project, G1, this project's analysis; P.fatigue.gam.fI = 1.50; before = the hard-coded 1.75)
- Flexure, x = 60.00 ft, bottom of steel: (Δf) = γ(|f(505.29)| + |f(−230.47)|) = 1.75(4.5822) = 8.019 ksi → 1.50(4.5822) = 6.873 ksi (top 0.986 → 0.845 ksi).
  Every location scales by 1.50/1.75.
- Shear GS18, x = 109.99 ft: V_u = 103.157 + 17.705 + 14.664 + 0 + 0 + γ(45.226) = 214.671 kip → 203.365 kip; V_cr = 786.63 kip; ratio 0.2729 → 0.2585.
- Stiffener weld toes CP2: γ(Δf) with γ = 1.50 (no stiffener row has Δf > 0 in the default project, so no CP2 item changes there).
- Cross-frames CF9 (diagonal, ΔP = 3 kip, A_g = 3.609 in²): 1.75(0.65)(3)/3.609375 = 0.9455 ksi → 1.50(0.65)(3)/3.609375 = 0.8104 ksi; ratio 0.0591 → 0.0506 (Category B 16 ksi).
- At the default 1.75: identical (below).

### Proof nothing else changes at the default
- Scratch comparison (Node, the page's modules) before (claude/sbd-cf-replace) vs after, default project: Flexure (analysis, example), Shear (analysis,
  example) build results identical; Cross-frames identical except the CF9 note text (now names the source).
- `tests/engine/fatigue-gamma.test.mjs` (new): no fatigue inputs = 1.75 = before for Flexure, Shear and Cross-frames; the 1.50 case above.
- `crossframes.test.mjs` parity with GirderDetail: 2041 cases, largest relative difference 0. `node tests/engine/run.mjs flexure shear stiffeners
  custom-demands welds rating`: 7 files, 58 passed.

### Other hard-coded load factors found (not changed here; listed for the engineer)
- Rating (`engine/rating.js` `factors()`): MBE Table 6A.4.2.2-1 γ_DC 1.25, γ_DW 1.50, γ_P 1.00, γ_LL 1.75 / 1.35, Service II 1.30 / 1.00: specification
  values of the design-load rating, no project input; the rating fatigue target uses `P.fatigue` already.
- Constructibility (`engine/constructibility.js` `factors()`; also `engine/shear.js` `cdc`, `ccl`): deck placement 1.25 on DC, 1.50 on the construction LL
  (3.4.2.1); no project input.
- Shear & stiffeners (`ui/shear.js`): transverse stiffener `gam: { dc: 1.25, dw: 1.50, ll: 1.75 }` and bearing stiffener `gam: { dc: 1.25, dw: 1.50, ll: 1.75 }`
  passed to engine/stiffeners.js without the owner's η and m (the Shear tab's own G has them).
- Field splices: its own `splices.gam` inputs (next PR).
- Auto design (`engine/autodesign.js`): stud pitch sizing `p_req = n_rZ_r/(1.75 V_f Q/I)` (also in `ui/fatigue.js` doc), and `FX_.factors()` (no owner
  η, m) for the Strength I M_u that places the stud regions; Cross-frames `inputsOf` deck-placement M_u = 1.25M_DC1 + 1.5M_CL.
- Studs: `studs.gamFat` is a second "γ Fatigue I (studs)" input on the Fatigue & studs tab (GirderDetail's sc.gam.fat); `engine/studs.js` hand-off
  path `gam: { fI: 1.75, fII: … }`. Question for the engineer: should the studs also take `fatigue.gam.fI`?
- Cross-frames wind γ_WS = 1.0η (OWN7).

### Other copies
- None.

## 2026-11-01 — PR: claude/sbd-splices-gamma — Field splices use the project's load factors (SPGAM; identical at the defaults; an old project's differing saved factors no longer used, shown); stale "demand choice is not saved" notes (WDNS)

Line numbers are approximate; search for the anchor text. Code sites are tagged `SPGAM`.

### 1. Splices: the project's load factors (engineer-approved 2026-11-01, "one source", the Welds pattern of #525)
- `engine/splices.js`: new `projGam(P)` = `{ dcMax, dcMin, dwMax, dwMin, llS, llSv }` from `SBDFlexure.factors()` (`dc, dcMin, dw, dwMin, ll, sll`:
  1.25, 0.90, 1.50, 0.65, 1.75, 1.30, Tables 3.4.1-1, -2, the Flexure tab's), `fat` = `P.fatigue.gam.fI` (1.75 without one), `{ dc1C, clC }` from
  `SBDConstructibility.factors()` (`cdc, ccl`: 1.25, 1.50, 3.4.2.1, the Constructibility tab's); without those modules loaded, the same numbers.
  `settings(P)`: before `gam: { ...d.gam, ...(s.gam || {}) }`; after `gam: projGam(P)`. The owner's η and m are applied on top by the engine (env), as before.
  Exported `projGam`. Every caller goes through `settings` (the Splices tab, the Report, Auto design).
- `engine/model.js` `validate`: before `Object.entries(Q.gam || {}).forEach(([k, v]) => pos(v, `splices.gam.${k}`, …))`; after: not checked (comment), so a
  saved value that can no longer be edited cannot block the calculation. `P.splices.gam` stays in the file unchanged (CLAUDE.md §5); doc comment notes it is unused.
- `ui/splices.js`: the nine `splices.gam.*` inputs of the "Load factors and clearances" card are replaced by a read-only table of the project's factors
  with links (Tables 3.4.1-1, -2 → Flexure tab; γ Fatigue I → the Fatigue & studs input field; deck placement → Constructibility tab; η, m → Project tab;
  `onClick` handles `[data-splgo]`, no input change); `oldGam(P)` lists saved values that differ ("no longer used … (now …)") on the input card and
  on the output tab. Exported `projGam`, `oldGam`.
- Governing provisions: AASHTO LRFD 10th Ed. Tables 3.4.1-1, 3.4.1-2, Art. 3.4.2.1, Art. 6.13.6.1.4 (design forces). No factor value of a new
  project changed (GirderDetail's module defaults = the project's factors).
- Check case (default project, G1, FS1 at 82.00 ft, Strength I maximum positive flexure, bottom flange; Node, the page's modules):
  - At the defaults: before = after (all 4 splices of G1, every check, every design, identical).
  - An old project with saved `splices.gam.llS = 1.5`, `fat = 1.5`: f_b = 0.9(−2.17653) + 0.9(−0.26600) + 0.65(−0.22024) + γ_LL(6.63643) ksi
    = −2.34144 + γ_LL(6.63643): before γ_LL = 1.5 → 7.6132 ksi; after 1.75 → 9.2723 ksi. Strength I max negative f_b −16.6145 → −18.8197 ksi.
    Governing strength item unchanged (BF4, P_fy net fracture 397.89/399 = 0.997: the 10th Ed. design force P_fy does not depend on γ); auto-designed
    plates and bolts unchanged; the tab shows "γ_LL Strength I 1.5 (now 1.75); γ Fatigue I 1.5 (now 1.75)".
- Tests: `tests/engine/splices.test.mjs` new test (defaults = DEF.gam; saved values kept and unused; Fatigue I from the input; validate no longer blocks).

### 2. Stale "The demand choice is not saved" (WDNS; text only)
- `ui/welds.js` `render`, the inputs note: "Two fillet welds per flange. The demand choice is not saved." → "… The demand choice is saved with the project
  (a hand-off file is not)." (saved since #522, `P.demandSrc.wt`).
- The same stale sentence in the header comments of `ui/welds.js`, `ui/fatigue.js`, `ui/shear.js` corrected (comments only). Every other tab's note
  checked: Shear, Rating, Splices, Constructibility, Fatigue say "saved" correctly; the Report tab's source is not saved (correct).

### Other copies
- None.

## 2026-11-01 — PR: sbd-gs1-4 — Cross-section proportion limits and minimum deck reinforcement GS1–GS4, GS22 on the Flexure tab, in the report and in Auto design's full check (B3)
### Change (calculation: new checks)
- New `engine/proportions.js` (`window.SBDProportions`): GirderDetail Girder section `checks()` GS1, GS2, GS3, GS4 and GS22 (anchor
  `id: 'GS1', grp: P1` in "Steel Bridge Design.html"), operation for operation, as check items of each flexure location, with worked steps
  (ids fx.gs1.ok, fx.gs2.<flange>.bt|bD|tt, fx.gs3.Iy / .ok, fx.gs4.req / .ok / .top, fx.gs22) and `summary(rows)` (largest ratio of each
  over the girder, warnings).
- `engine/flexure.js location()`: before `r.checks = checksOf(r, prj);` after
  `const PR = window.SBDProportions; r.checks = (PR ? PR.items(r, prj) : []).concat(checksOf(r, prj));` and the steps getter
  `worked(r, prj).concat(PR ? PR.steps(r, prj) : [])`. The header's "Not ported … proportions GS1 to GS4" is updated.
- `ui/flexure.js`: topic `prop` "Cross-section proportions and minimum deck reinforcement (GS1–GS4)" (ids /^fx\.gs(1|2|3|4|22)(\.|$)/)
  after "Web depth in compression and hybrid factor"; a line under "Governing" with the largest ratio of each over the girder (links
  select the location) and the warnings.
- `report/builders.js flex()`: a sub-section "Cross-section proportions (6.10.2) and minimum deck reinforcement (6.10.1.7)" (table of
  the largest ratio of each with a link to the location's steps; those locations are detailed), and a line in the governing summary.
- `engine/autodesign.js partOf`: GS4 and GS22 map to 'deck' (no plate is sized from the deck reinforcement or the A6 method). The full
  check takes every flexure item in use, so GS1–GS4 now count there (in the page; the Node autodesign tests do not load proportions.js).
- `index.html`: script tag `engine/proportions.js` before engine/flexure.js.
### §4 callout
- New checks, AASHTO LRFD 10th Ed.:
  - GS1 Art. 6.10.2.1.1, Eq. 6.10.2.1.1-1: D/t_w ≤ 150 (no longitudinal stiffeners); ratio (D/t_w)/150.
  - GS2 Art. 6.10.2.2, Eqs. 6.10.2.2-1, -2, -3 for each flange: b_f/2t_f ≤ 12.0, b_f ≥ D/6, t_f ≥ 1.1t_w.
  - GS3 Eq. 6.10.2.2-4: 0.1 ≤ I_yc/I_yt ≤ 10 (compression flange by the region); ratio max(0.1/v, v/10).
  - GS4 Art. 6.10.1.7: A_r = A_top + A_bot ≥ 0.01 b_eff t_deck at every negative-flexure location (GirderDetail applies it there, not
    only where the deck stress exceeds φf_r); the top-layer share ≥ 2/3 a warning ("should"). MassDOT Bridge Manual Part I 3.5.1.4
    (OWN17) cited. Noncomposite: not applicable.
  - GS22 MassDOT Part I 3.5.1.7 (OWN23): Appendix A6 should not be used: a warning where A6 is the method in use.
- Before: no such checks in the new app (the limits existed only as Auto design sizing rules). After: as GirderDetail. Results change:
  each flexure location has these items; a location's governing check and the girder's governing flexure ratio can now be one of them
  (e.g. GS4 0.989 at the piers of the built-in project, below its flexure governing 1.229 GS7, so the governing ratio is unchanged there).
- Check case (GirderDetail's built-in rows; tests/engine/proportions.test.mjs): Span 1, D = 60, t_w = 0.5625, top 16 × 0.75, bottom
  16 × 1.125: GS1 60/0.5625 = 106.67, ratio 0.7111; GS2 top 16/(2·0.75) = 10.667 (0.8889), 16 ≥ 10 (0.625), 0.75 ≥ 0.61875 (0.825);
  GS3 I_yc = 0.75(16³)/12 = 256, I_yt = 1.125(16³)/12 = 384, 0.667 → ratio 0.15. Pier 1, top 18 × 1.5, bottom 18 × 2, b_eff 114 in,
  t_deck 8.5 in, A_r = 6.6 + 3.2 = 9.8 in²: GS3 972/729 = 1.333 → 0.1333; GS4 0.01(114)(8.5) = 9.69 ≤ 9.8, ratio 0.98878; top share
  0.673 ≥ 0.667.
- Hand-off file as the demand source (no project rebar given to `fromPayload`): GS4 is not evaluated (n/a with the reason): the hand-off's
  A_r is GirderDetail's Structural analysis input (rebarPct % of b_eff t_s at mid-depth, e.g. 1 % × 96 × 8 = 7.68 in² on builtin G1), not
  the deck bars that GirderDetail's Girder section checks (its module inputs), so 0.01 b_eff t_deck with t_deck = t_s + 0.5 would always
  fail (8.16/7.68 = 1.063). `engine/flexure.js fromPayload` marks such a deck `arHandoff: true`; GS1–GS3 are evaluated as usual.
### Parity
- 100 gd_*.json payloads + GirderDetail's built-in rows (5 variants: as is, MassDOT with A6, MassDOT 6.10.8, top share 0.5, A_r 5 in²):
  105 cases, 37,110 locations, 635,819 values (GS1 37,110, GS2 222,660, GS3 37,110, GS4 25,882, GS22 3,236 items): 0 differences,
  largest relative difference 0 (ratios bit-identical).
### Other copies
- None.

## 2026-11-01 — PR: sbd-ad8 — Field splice auto-design: end distances at least the owner's edge distance (SB2-AD8; B4); CF11 verified
### Change (calculation: splice auto-design inputs)
- `engine/splices.js autoDesign(p0, env)`, after `const undo = clone({ top: P.top, bot: P.bot, web: P.web });`, added:
  `const eMin = R0.emin, upE = (o, f) => { if (!(parseDim(o[f]) >= eMin - 1e-9)) o[f] = eMin; };`
  `['top', 'bot'].forEach(k => { upE(P[k], 'ef'); upE(P[k], 'ep'); }); upE(P.web, 'ew'); upE(P.web, 'ewp');`
  i.e. the flange and web end distances e_f, e_p, e_w, e_wp are raised to DT4's e_min = max(Table 6.13.2.6.6-1 value for the bolt and
  edge, the owner's edge distance) before the search; a larger entered value is kept. When the search ends "not changed" (DT10, flange
  too narrow) the entered values are restored with the rest, as before. Used by the Field splices tab (auto mode) and by Auto design's
  full check (`girder()` auto-designs every splice without entered plates).
- Decision: SB2-AD8 (lead, 2026-10-30): the splice auto-design uses the owner's edge distance for the end distances (CTDOT 2 in).
### §4 callout
- Provision: AASHTO LRFD 10th Ed. Art. 6.13.2.6.5 (end distance ≥ the Table 6.13.2.6.6-1 edge distance); owner CTDOT BRSDM V2 6.13.6.1
  (2 in edge distance, rule spl.ovs, OWN25).
- Before (GirderDetail autoDesignSplice and this app): e = 1.75 in as entered; every CTDOT splice the search designs fails DT4
  (1.75 < 2.00). After: CTDOT e = 2.00 in; AASHTO / RIDOT / MassDOT unchanged (e_min = 1.125 in for 7/8 in bolts, cut edges ≤ 1.75).
- Check case (built-in splice, 7/8 in A325 bolts, cut edges, flanges widened to 20 in, CTDOT): e_min = max(1.125, 2) = 2.00 in;
  after: top 2 lines × 4 rows each side (32 bolts), outer PL 20 × 1/2, 2 inner PL 8 1/2 × 5/8; bottom 2 × 5 (40), PL 20 × 5/8 + 2 × 8 1/2 × 3/4;
  web 2 PL 57 × 9/16, 9 × 2 each side (36); 108 bolts; DT4 2.00 ≥ 2.00 at all six ends (pass); top splice plate length 25.5 → 26.5 in.
  The same plates with 1.75 in end distances: DT4 fails. GirderDetail's autoDesignSplice on the same input: DT4 fails.
  The built-in 16 in flanges under CTDOT stay "not changed" (DT10: too narrow for 2 gage lines with 2 in edges), end distances 1.75 as entered.
### Tests
- tests/engine/splices.test.mjs: the auto-design parity now runs GirderDetail on the input with the same end distances (AD8 applied by
  hand) and compares every plate, bolt and check: 0 differences (built-in every owner; 136 auto-designed splices of the payloads).
  New test "AD8": end distances 2.00 (CTDOT) / 1.75 (others), DT4 passes for every owner; GirderDetail's search fails DT4 under CTDOT.
### Auto design (CTDOT, built-in project)
- Before: no candidate; every design "blocked" by DT4 (1.75 in < 2 in, a detail input the plates do not change).
- After: DT4 passes in the candidates and is no longer a blocker; still no candidate: a candidate's splice fails TF3 (slip resistance,
  Service II, negative moment, oversized holes K_h = 0.85) at 1.076 on the full check, although the same splice auto-design passes
  every check on the built-in demands with 17 in or 18 in flanges. Open item (Auto design: the splice demands at design time vs the
  candidate's own analysis); not changed here. tests/engine/autodesign.test.mjs (CTDOT test) updated to this outcome.
### CF11 (verify only)
- Auto design's cross-frame sizing rule for the bolts per member end (CF10 / CF11; CTDOT 4 bolts) is in `engine/autodesign.js`
  (sizeDetails, ids CF1–CF11, "the current type and bolt count first, then the others"), merged in #511. Not changed here.

## 2026-11-01 — PR: claude/sbd-cf-note — Cross-frames member-force note: Strength I and Strength III / V are separate load combinations (CFNOTE; text only, no calculation change)

Line numbers are approximate; search for the anchor text.

### What changed (engineer decision 2026-11-01: fix the note text only)
- `ui/framing.js` `render`, the "Member forces (truss model)" card note. Before:
  `Analysis force ± |wind force| (Strength III, V) and ± brace force (Constructibility); the top chord work points are held by the deck.`
  After: `Each load combination is a separate case (AASHTO LRFD 10th Ed. Table 3.4.1-1), checked on its own; each member is designed for the largest.
  Strength I: the entered member forces (nothing is computed for Strength I); Strength III and V: ± |wind force| f_wF_w alone (not added to the Strength I
  forces); Constructibility: the entered forces ± brace force f_brM_br. The top chord work points are held by the deck.` (followed by `umNote(R)` as before).
- `engine/crossframes.js` `steps`, step `cf.<m>.forces` label (same misstatement, text only). Before: `<member>: largest tension and compression (analysis force ±
  wind and brace forces)`; after: `<member>: largest tension and compression of the separate combinations (Strength I: the entered forces; Strength III, V: ± wind
  force alone; Constructibility: the entered forces ± brace force)`.
- What the code does (unchanged, `compute`, `combos`): Strength I T = max(0, u), C = max(0, −u) with u the entered Strength force; Strength III and V
  T = C = |f_w F_w| (u = 0); Constructibility T = max(0, u + |f_br M_br|), C = max(0, −u + |f_br M_br|); T_u, C_u the largest over the four (AASHTO LRFD
  10th Ed. Table 3.4.1-1: Strength I, III and V are separate load combinations).
- Governing provision: AASHTO LRFD 10th Ed. Table 3.4.1-1, Art. 4.6.2.7.1, 6.7.4.2. No formula, factor or value changed.
- Check case: default project, G1, Cross-frames tab; before = after for every member force, T_u, C_u, check and ratio (Node, `SBDFramingUI.build`
  at the default and with RIDOT η = 1.05, m = 1.2: 0 differences other than the step label).

### Other copies
- None.

## 2026-11-01 — PR: claude/sbd-studs-gamma — Studs: Fatigue I γ from one source, the Fatigue & studs input γ Fatigue I (SCGAM; identical at the default; an old project's differing studs.gamFat no longer used, shown)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SCGAM`.

### What changed (engineer decision 2026-11-01, item 2: "one source", the Welds #525 / Splices #545 pattern)
- `ui/fatigue.js`:
  - new helpers after `ensure`: `const fatI = P => { const v = +(((P && P.fatigue) || {}).gam || {}).fI; return v > 0 ? v : 1.75; };` and
    `oldGamFat(P)` (`{ was, now }` when the saved `studs.gamFat` differs from `fatI(P)`, else null); both exported.
  - `inputs`, the "Shear connectors: studs (6.10.10)" card: before `${h.num('studs.gamFat', 'γ Fatigue I (studs)', '')}`; after a read-only row
    "γ Fatigue I (studs) <fatI(P)>" with the link `<a href="#" data-fsgo="fatigue.gam.fI">γ Fatigue I above</a>` (one source, Table 3.4.1-1) and,
    when `oldGamFat(P)`, the warning "… saved from this tab's former input … no longer used: <was> (now <now>). It stays in the project file unchanged."
  - `onClick`: `[data-fsgo]` focuses the `fatigue.gam.fI` field (no input change, returns false).
  - `build`: before `Object.assign(scIn, { … gam: { fat: Q.gamFat }, … })`; after `gam: { fat: fatI(P) }` (every demand path: analysis, hand-off file,
    Custom, example). `SC.fromPayload(pl, { beffMode: Q.beffMode })` → `SC.fromPayload(pl, { beffMode: Q.beffMode, fI: fatI(P) })`. Result `oldFat: oldGamFat(P)`.
  - `studsOf` (the analysis / Custom payload): `results: { …, gamI: Q.gamFat, … }` → `gamI: fatI(P)`.
  - output tab, studs note: "; γ Fatigue I = <γ> (the Fatigue & studs input, one source)." and, with `R.oldFat`, the "no longer used" alert.
- `engine/studs.js` `fromPayload(pl, opt)` (the hand-off path): `gam: { fat: q.gamI || 1.75 }` → `gam: { fat: opt.fI > 0 ? +opt.fI : q.gamI || 1.75 }`;
  the fatigue settings `gam: { fI: 1.75, … }` → `gam: { fI: opt.fI > 0 ? +opt.fI : 1.75, … }`. Without `opt.fI` (the ST-Girder parity tests) as before.
- `engine/autodesign.js` (payload of each candidate): `gamI: Q.gamFat` → `gamI: (v => v > 0 ? v : 1.75)(+((P.fatigue || {}).gam || {}).fI)`.
  (Auto design checks the studs through `SBDFatigueUI.build`, so it takes `fatI(P)` already through `scIn`.)
- `engine/model.js` `validate`: the line `pos(Q.gamFat, 'studs.gamFat', 'γ Fatigue I');` removed (comment): a value that can no longer be edited must
  not block the calculation. Doc comment: gamFat not used since 2026-11-01, kept.
- `index.html` (one-line, additive): the input-change redraw regex also matches `fatigue\.gam\.fI$`, so the studs' read-only γ on the same input tab
  updates when γ Fatigue I is changed.
- Saved data (CLAUDE.md §5): `P.studs.gamFat` stays in the file unchanged (defaultStuds() still writes 1.75; the GirderDetail import still fills it from
  sc.gam.fat); unused. No key or format changed.
- Governing provision: AASHTO LRFD 10th Ed. Table 3.4.1-1 (Fatigue I γ), Art. 6.10.10.2 (V_sr = √(V_fat² + F_fat²), V_fat = γ V_f Q/I, p ≤ n Z_r/V_sr),
  Art. 6.6.1.2 (Fatigue I where ADTT_SL ≥ the infinite-life equivalent; that decision already used `fatigue.gam.fI`). Fatigue I takes neither the owner's
  η (Art. 1.3.3–1.3.5: 1.00 at limit states other than Strength) nor m (the owner's multiplier is on HL-93 at Strength and Service), so an owner with η
  or m ≠ 1 gives the same studs before and after.

### Check case (default project, G1, analysis; Fatigue limit state "Fatigue I for every detail" so that γ_I acts; Node, the page's modules)
Zone "Span 2, 0.1L to 0.2L": V_f = 45.8 kip, Q = 1714.009 in³, I = 106168.02 in⁴, n_r = 4, Z_r = 4.2092 kip, p = 13 in, F_fat = 0.
- Default (fatigue.gam.fI = 1.75, studs.gamFat = 1.75): before = after. V_fat = 1.75(45.8)(1714.009)/106168.02 = 1.2940 kip/in;
  p_req = 4(4.2092)/1.2940 = 13.012 in; SC1 = 13/13.012 = 0.9991.
- Old project with studs.gamFat = 1.50 (fI 1.75): before V_fat = 1.50(45.8)(1714.009)/106168.02 = 1.1091 kip/in, p_req = 15.181 in, SC1 = 0.8564;
  after 1.2940 kip/in, 13.012 in, 0.9991 (the input tab and the output tab show "1.5 … no longer used (now 1.75)").
- fatigue.gam.fI = 1.50 (studs.gamFat 1.75): before 1.2940 / 13.012 / 0.9991 (the studs ignored the project's γ); after 1.1091 / 15.181 / 0.8564.
- Owner RIDOT (η = 1.05 with η_I, m = 1.2), governing zone "Span 1, 0.4L to 0.5L" (V_f 33.6 kip, Q 1627.578, I 99484.85, p 17.5 in): at the defaults
  before = after (V_fat = 1.75(33.6)(1627.578)/99484.85 = 0.9620 kip/in, p_req = 4(4.2092)/0.9620 = 17.503 in, SC1 = 0.9999); with studs.gamFat = 1.50:
  before V_fat 0.8245, p_req 20.420, SC1 0.8570 → after 0.9620, 17.503, 0.9999.
- With the default "By ADTT" limit state the default project's zones are all Fatigue II (γ_II used), so only `SR.gf` changes there.

### Proof nothing else changes
- Node, every tab's build (Flexure, Shear, Fatigue, Cross-frames, Constructibility, Splices, Rating, Welds), origin/main vs this branch, default project
  and RIDOT η 1.05 m 1.2: 0 differences; an old project with studs.gamFat = 1.5: only Fatigue `SR.gf` 1.5 → 1.75.
- `tests/engine/studs-gamma.test.mjs` (new): the check case, old value kept and flagged, validate, payload gamI, fromPayload opt.fI.

### Other copies
- None.

## 2026-11-01 — PR: sbd-final-compare — final comparison new vs old app (B5; no app change)
- New `tests/engine/final-compare.mjs` (not part of the suite, about 22 min): the 20 recorded projects imported through "From old app", every
  girder, every module new (this app's analysis) vs old (GirderDetail's hand-off demands through the parity-tested engines, the project's
  deck rebar), plus GirderDetail's recorded negative flexure and deck placement per span and the analysis envelopes.
- Result and classification: docs/steel-bridge-comparison.md §(d). New-app blockers found: D-1 construction live load not imported / 0 by
  default (GS14–GS16 11–19 % low), D-2 stud zones and regions not imported (SC2 fails on 8 xsA exterior girders). No app code changed.
### Other copies
- None.

## 2026-11-01 — PR: claude/sbd-factors-onesource — The remaining hard-coded load factors from one source (FONE): stiffeners, deck placement, Auto design / analysis stud sizing; owner η and m as the owner load rules apply them

Line numbers are approximate; search for the anchor text. Code sites are tagged `FONE`.

### Decisions (engineer decision 2026-11-01, item 3; recorded here)
- One source, no new copies: Strength I base factors `SBDShear.factors()` / `SBDFlexure.factors()` (+ `factorsOwner(lf)` where η, m belong), deck placement
  `SBDConstr.factors()` (engine/constructibility.js), Fatigue I `fatigue.gam.fI`, owner `SBDOwners.loadFactors(P.ownerRules…)`.
- η and m "applied consistently" = the owner load rules already in force (OWN6–OWN8, engineer's decisions of 2026-10-15, GirderDetail plLF): η on the
  Strength limit-state factors (max × η, min × η_N), m on HL-93 LL+IM at Strength and Service; neither on Fatigue nor on deck placement
  (constructibility). So: stiffeners η, m (unchanged, see 1); deck placement 1.25 / 1.50 without η, m (unchanged values, one source, see 2);
  stud regions on the owner's Strength I envelope (changed, see 3); pitch sizing with Fatigue I γ (no η, m; see 3). Open question for the engineer:
  AASHTO LRFD 10th Ed. Art. 3.4.2.1 calls the construction check an evaluation at the Strength limit state, where Art. 1.3.2.1 would apply η; the
  2026-10-15 rule keeps η off deck placement. Not changed here.
- Rating's MBE Table 6A.4.2.2-1 factors stay (specification values, engineer). The Constructibility tab's deck overhang bracket factors
  (`P.constr.oh.gam` dc 1.25 / cl 1.50) are inputs (GirderDetail's Deck overhang module), not hard-coded: not changed; listed for the engineer.

### 1. Shear & stiffeners: stiffener Strength I factors (no value change)
- `ui/shear.js` `build`: `G = SH.factorsOwner(lf, { fat: fatI(P) })` → `…, G0 = SH.factors()`; transverse `gam: { dc: 1.25, dw: 1.50, ll: 1.75, fat: fatI(P) }` →
  `gam: { dc: G0.dc, dw: G0.dw, ll: G0.ll, fat: fatI(P) }`; bearing `gam: { dc: 1.25, dw: 1.50, ll: 1.75 }` → `gam: { dc: G0.dc, dw: G0.dw, ll: G0.ll }`.
- The premise "without η, m" did not hold: engine/stiffeners.js applies the owner's η, m to these base factors (`gO`, OWN_K.ts / bstf: dc, dw × η; ll × η m)
  from `env.lf` (the Shear tab's `loadFactors`). Base factors before η, m are passed (G, already × η, would apply η twice).
- Check: default TS.g = { dc 1.25, dw 1.50, ll 1.75, fat 1.75 }; RIDOT η = 1.05 (η_I yes), m = 1.2: dc 1.25(1.05) = 1.3125, dw 1.50(1.05) = 1.575,
  ll 1.75(1.05)(1.2) = 2.205, before = after (every Shear build identical, Node).

### 2. Deck placement 1.25 / 1.50 (Art. 3.4.2.1): one source SBDConstr.factors() (no value change)
- `engine/constructibility.js` `bracingC`: `Mc = env.Mc || xs.map((_, k) => 1.25 * env.MDC1[k] + 1.5 * env.MCL[k])` → `C0 = factors(), Mc = env.Mc || xs.map((_, k) =>
  C0.cdc * env.MDC1[k] + C0.ccl * env.MCL[k])`; `ohRowsAt`: `Mc = env.xs.map((_, i) => 1.25 * env.MDC1[i] + 1.5 * env.MCL[i])` → `C0.cdc * … + C0.ccl * …`;
  comment on `factors()` (the one source; no η, m).
- `engine/shear.js` `factors(over)`: `cdc: 1.25, ccl: 1.50` → `cdc: C.cdc, ccl: C.ccl` with `C = window.SBDConstr.factors()` (literal fallback when the
  module is not loaded). `factorsOwner` unchanged (no η, m on cdc, ccl).
- `engine/crossframes.js` `inputsOf` (stability bracing M_u): `Mc = xs.map((_, i) => 1.25 * A.st.DC1.M[i] + 1.5 * (A.st.CL ? …))` → `C0.cdc * … + C0.ccl * …`
  (`C0 = SBDConstr.factors()`); its source text names the factors' origin.
- `engine/splices.js` `projGam`: `W.SBDConstructibility` → `W.SBDConstr` (the module's global is `SBDConstr`; before, the literal fallback 1.25 / 1.50
  was always used: same values).
- `ui/constructibility.js` overhang note: "the largest 1.25M_DC1 + 1.5M_CL" → `${fmt(SBDConstr.factors().cdc, 2)}M_DC1 + ${fmt(…ccl, 2)}M_CL` (display "1.50").
- Check: default and RIDOT, Constructibility, Shear, Cross-frames, Splices builds identical before / after (Node), except the Cross-frames `I.src.Mu` text.
  `tests/engine/factors-onesource.test.mjs` replaces `SBDConstr.factors` and sees Shear and Splices follow.

### 3. Stud sizing: pitch with Fatigue I γ, regions on the owner's Strength I envelope (calculation change for an owner with η or m ≠ 1, or γ_FatI ≠ 1.75)
- `ui/fatigue.js` `studsOf` (analysis / Custom payload when no pitch zones are entered) and `engine/autodesign.js` `payloadOf` (each candidate):
  - pitch: `preq = vr > 0 ? nr * Zr / (1.75 * vr * Qs / c.I) : 48` → `fatI(P)` / `gFI` (= `fatigue.gam.fI`, 1.75 without one) in place of 1.75
    (Art. 6.10.10.1.2, Table 3.4.1-1; no η, m on Fatigue I).
  - regions: `const G = FX.factors(), Mup = stations.map(s => FX.envelopeStrI({ … LLp: s.M_LLpos, LLn: s.M_LLneg … }, G).max)` →
    `G = FX.factorsOwner(SBDOwners.loadFactors(own.owner, own.eta, nb))`, LL+IM with m kept off the pedestrian part where LL+IM includes it
    (`pe(v, q) = v − q + q/m`, GD45, as engine/flexure.js fromPayload; `studsOf(…, pedIn)`, new optional 8th argument: the Custom path passes
    `pl.pedestrianInLL === true` (false): its rows carry M_PL in their own column, so there `pe = v + q/m`, M_PL added as the Flexure tab adds it
    (before, the Custom path left M_PL out of the region envelope; the full suite's custom-demands test, Custom rows = this project's analysis for
    RIDOT + sidewalk, found it: SC2 Abut. 1 region 0.9301 vs 0.9028 until both paths took the pedestrian part the same way)). Strength I Table 3.4.1-1 with η (Eq. 1.3.2.1-2, -3) and m (owner rule ld.mult).
- Check case A (default project with RIDOT η_I yes: η = 1.05, m = 1.2; G1, analysis; no pitch zones entered), the Span 1 point of maximum positive moment:
  - before (1.25 / 1.50 / 1.75): 43 ft 1.25(1059.355 + 191.730) + 1.50(158.802) + 1.75(1817.753) = 4983.13 > 44 ft 4981.45 kip-ft → region Abut. 1 0–43 ft;
  - after (1.3125 / 1.575 / 2.205): 43 ft 1.3125(1251.085) + 1.575(158.802) + 2.205(1817.753) = 1642.05 + 250.11 + 4008.14 = 5900.31 < 44 ft
    1.3125(1243.719) + 1.575(157.930) + 2.205(1822.803) = 1632.38 + 248.74 + 4019.28 = 5900.40 kip-ft → 0–44 ft (and Pier 1 region 44–110 ft).
  - SC2 Abut. 1 region: n required 122.78 (unchanged), provided 132 → 136, ratio 0.9301 → 0.9028; governing SC2 0.9301 (the Span 3 abutment region,
    unchanged); SC1 max 0.7409 unchanged. Default (AASHTO): identical.
- Check case B (default project, γ Fatigue I 1.50): zone Span 1, 0–0.1L: V_f = 46.4 kip, Q = 1714.009 in³, I = 106168.02 in⁴, n_r = 4, Z_r = 7.0π(0.875)²/4 = 4.2092 kip;
  p_req = 4(4.2092)/(γ(46.4)(1714.009)/106168.02): 1.75 → 12.844 in, p = ⌊2(12.844)⌋/2 = 12.5 in (before); 1.50 → 14.984 in, p = 14.5 in (after).
- Auto design, recorded project builtin_RIDOT (tests/projects/sbd2-autodesign, sbd2FromPL, match-legacy settings as autodesign-parity.mjs; owner RIDOT,
  η = 1.00, m = 1.2), Node: before = after (best candidate 426,394 lb, D = 70 in, ratio 1.000 stiffeners TS7; stud regions 0–44, 44–110, … 316–360 ft;
  SC1 0.7065, SC2 0.9358 identical). The same project with η_I yes (η = 1.05, m = 1.2): best candidate identical before / after (439,866 lb, D = 65 in,
  ratio 1.000 stiffeners TS7, every plate and stud pitch the same; SC1 0.7097, SC2 0.8379); the only change is the Span 3 stud region boundary
  (Pier 2 to max. positive 250–317 → 250–316 ft, Abut. 2 317–360 → 316–360 ft), the owner's envelope placing the maximum positive moment 1 ft away.

### 4. Cross-frames wind γ_WS = 1.0η (checked, no change)
- `engine/crossframes.js` `compute`: `gWS = 1.0 * E.lf.eta`, `E.lf` from `envOf(P)` = `SBDOwners.loadFactors(P.ownerRules.owner, P.ownerRules.eta, P.xs.nb)`:
  the project's η source, the same as every other tab (Project tab). RIDOT η_I yes: γ_WS = 1.05. No m (not HL-93). Table 3.4.1-1, Eq. 1.3.2.1-2.

### Proof nothing else changes
- Node, every tab's build (Flexure, Shear, Fatigue, Cross-frames, Constructibility, Splices, Rating, Welds; analysis and example), origin/main vs this
  branch: default project 0 differences except the Cross-frames `I.src.Mu` text; RIDOT η 1.05 m 1.2: the same, plus the Fatigue tab's stud regions (3A).
- `tests/engine/factors-onesource.test.mjs` (new), and the full `node tests/engine/run.mjs` (see the PR).

### Other hard-coded factors left (for the engineer)
- `ui/handoffs.js` superReactions meta `{ treatAs: 'DW', strMax: 1.50, strMin: 0.65 }`, `{ treatAs: 'DC', strMax: 1.25, strMin: 0 }`: descriptive fields
  of the hand-off (the receiver applies its own factors), not used in a calculation here.
- `engine/flexure.js` `envelopeStrI` UF factor `1.25 * G.dc / 1.25` (= G.dc, with η): already from G.

### Other copies
- None.

## 2026-11-01 — PR: sbd-import-cll — Construction live load on import (D-1 of docs/steel-bridge-comparison.md §d)
### Change (calculation input on import)
- `engine/legacy.js fromParts`, before `if (P.__dlRest) {`: the old project's construction live load cll (psf; GirderDetail's
  `df.bridge.cll`, else Preliminary sizing's `suggest.cll`) becomes each girder's `girders[i].loadsManual.CL = cll/1000 × b_eff/12` (klf), as
  GirderDetail's Structural analysis (`GM.sa.compute`: `wCL = (nm(b.cll) || 0) / 1000 * beffFt`). An entered CL is kept; a file without cll is
  unchanged. Import note: "Construction live load <cll> psf (<source>) × each girder's b_eff …". Before: not read (kept under
  legacy.unmapped), so M_CL = V_CL = 0 on every imported project.
- No other deck-placement input was missing: the pour sequence (sa.seqOn, seqMod, seqCustom) and f_ℓ were already imported;
  GirderDetail's Girder section γ_cdc 1.25 / γ_ccl 1.50 equal this app's constructibility factors (gd.gs.gam stays unmapped, unused).
### §4 callout
- Provisions: AASHTO LRFD 10th Ed. Art. 3.4.2.1 (construction loads, γ 1.5 on CL), 6.10.3.4 (deck placement), 6.10.3.2 (GS14, GS15),
  6.10.3.3 (GS16).
- Before: CL = 0 → GS14/GS15 11–15 % and GS16 16–19 % below GirderDetail's recorded deck-placement results on every unskewed project
  (comparison §d). After: GS14 within +0.67 / −0.80 %, GS15 within −0.95 % (C-3 pour boundaries, C-5 cross-frame weight); GS16 up to
  −5.8 % (capacity: V_cr with the panel d_o of this project's stiffener layout, 52.8 in at Pier 2 of curb G1, vs GirderDetail's 60 in rows;
  V_u 119.7 vs 118.8 kip, C-7).
- Hand check (builtin, cll = 20 psf): G2 b_eff = 114 in = 9.5 ft → w_CL = 0.020 × 9.5 = 0.190 klf; G1 b_eff 96 in = 8.0 ft → 0.160 klf.
  M_CL max G2 334.953 kip-ft vs GirderDetail 334.934 (0.006 %); V_CL 13.495 vs 13.400 kip (C-7).
### Tests
- tests/engine/legacy.test.mjs: new test (CL per girder, the note, cll read, M_CL/V_CL vs GirderDetail on builtin G2 and curb MassDOT G1,
  a file without cll unchanged); the 20-project import test unchanged.

### Other copies
- None.

## 2026-11-01 — PR: sbd-import-studs — Stud pitch zones on import; the app's own stud layout meets SC1 and SC2 (D-2 of docs/steel-bridge-comparison.md §d)
### 1. Import (saved data, no formula)
- `engine/legacy.js fromGD`, after `r.mark('sc.skew')`: GirderDetail's `sc.zones` ({x1, x2, nr, p}) become `P.studs.zones` (entered zones: the
  Fatigue & studs tab checks them as given). GirderDetail's built-in example zones (GM.sc.def: 0–22 ft 3 @ 9 in, 22–55 ft 3 @ 12 in, span 1
  only) are left out (note), so the app lays out its own. `sc.regions` stay under legacy.unmapped: the strength regions are made from the
  project's analysis (as Preliminary sizing made them for GirderDetail). Before: zones never imported.
- The 20 recorded seeds hold the built-in example zones (the zones the recordings used came from Preliminary sizing's inbox, not saved
  in the seeds), so the comparison's stud differences on them are the app's own layout against those inbox zones.
### 2. The app's own stud layout (calculation change, §4)
- Cause of SC2 failing (xsA G1, 1.372): `ui/fatigue.js studsOf` is Preliminary sizing's rule (pl-src: `preq = nr * Zr / (1.75 * vr * c.Q / c.I)`,
  p = max(6d, min(24, ⌊2p_req⌋/2)) per 0.1L), a fatigue-only pitch; neither app checks SC2 (n ≥ P/Q_r, 6.10.10.4) when laying out. An exterior
  girder with a sidewalk has little fatigue shear, so pitches reach 24 in and the end region gets too few studs. Also SC1 could fail because
  the layout's Q, Z_r and γ (bridge b_eff of the exterior girder, Fatigue I 1.75) differ from the check's (this girder's b_eff, the fatigue
  limit state and γ of the Fatigue & studs inputs, F_fat on skews).
- Change: `ui/fatigue.js build`, for the app's own zones only (analysis or Custom source, no zones entered): after `SC.compute`, a zone with
  p > p_req (SC1) takes ⌊2p_req⌋/2; the zones of a region with n_prov < n_req (SC2) take ⌊2·p·n_prov/n_req⌋/2 (at least 1/2 in less), both
  ≥ 6d (6.10.10.1.2); repeated until nothing changes (≤ 40 passes). Entered zones and hand-off files are checked as given.
- Provisions: AASHTO LRFD 10th Ed. Art. 6.10.10.1.2 (pitch limits), 6.10.10.2 (fatigue), 6.10.10.4 (strength).
- Before/after: layouts that passed are unchanged (built-in project G1: SC1 0.742, SC2 0.959, 1,240 studs, identical; xsA G2, builtin
  CTDOT G1 identical). xsA AASHTO G1: SC2 1.372 → 0.988, SC1 0.736 → 0.699, studs 888 → 1,108 (pitches 17–24 in → 8–20.5 in).
- Hand check (one step of the rule): a region with n_prov = 100, n_req = 137.2 and a zone at 24 in → p = ⌊2 × 24 × 100/137.2⌋/2 = ⌊34.98⌋/2 = 17.0 in.
### Tests
- tests/engine/legacy.test.mjs: new test (built-in example zones left out; loaded zones imported and checked as given, SC2 0.956 as
  GirderDetail's; the app's layout on xsA G1 SC2 0.988, pitches on 1/2 in, ≥ 6d); the "nothing dropped" test now keeps sc.regions.

### Other copies
- None.

## 2026-11-01 — PR: sbd-sidewalk-override — Owner sidewalk override for the LL deflection limits (C-32, engineer decision 2026-11-01)
### Change
- `engine/analysis.js`: `DEF.deflSidewalk = 'auto'`; `deflOwner`: before `on = ['L', 'R'].some(k => sw[k] && +sw[k].w > 0)`; after
  `ov = S && S.deflSidewalk, on = ov === 'yes' ? true : ov === 'no' ? false : <the same cross-section test>`, plus `swHow` for the steps
  and the Analysis tab note ("entered (Analysis settings)" / "cross-section sidewalks").
- `ui/analysis.js` Analysis settings: select "Sidewalk or pedestrians, owner LL deflection limit (OWN19)": Automatic (default) / Yes / No.
- `engine/legacy.js fromPL`: Preliminary sizing `limits.sidewalk` 'yes' / 'no' → `analysis.deflSidewalk` (GirderDetail's swOwn came from
  it, plSidewalk); 'auto' or absent: not set. `engine/model.js` header: the new optional field.
### §4 callout
- Provisions: RIDOT BDM 2.4.2.6 (L/800; L/1000 with pedestrians), MassDOT LRFD Bridge Manual Part I 3.5.6.1 (L/1000 with sidewalks; L/800,
  preferably L/1000, without), AASHTO LRFD 10th Ed. Art. 2.5.2.6.2. AASHTO and CTDOT: no owner rule, the override has no effect.
- Before: the cross-section's sidewalks decided (no override). After: the same by default ('auto', or the field absent): every project
  computes identically unless the override is set.
- Check case (built-in project, interior girder, span 1 = 110 ft, MassDOT): auto (no sidewalk) L/800 → Δ_lim = 12(110)/800 = 1.650 in,
  preferred L/1000; 'yes' → L/1000 = 1.320 in, no preferred limit; a 6 ft sidewalk with 'no' → 1.650 in. RIDOT: 'yes' L/1000, 'no' L/800.
### Tests
- tests/engine/sidewalk-override.test.mjs (2 tests): auto = before (deep-equal), yes / no for MassDOT, RIDOT, AASHTO; import of limits.sidewalk.

### Other copies
- None.

## 2026-11-01 — PR: sbd-ad-adv — Auto design: advisory module items are warnings, not failures (the CTDOT TF3 open item of sbd-ad8)
### Finding
- The open item of sbd-ad8 (CTDOT built-in project: no Auto design candidate, "splices TF3 Slip resistance — SvN 1.076") is not a splice
  search limit: the splice auto-design passes every check (design ok), and TF3 at FS4 (278 ft) has status 'adv' in engine/splices.js:
  under the 10th Ed. the flange slip force above the slip resistance is advisory, the excess moment goes to the web (WS3, C6.13.6.1.3b),
  which is checked. Auto design's full check (`evaluate`, `lists`) took the item's ratio 1.076 > 1 as a failure regardless of its status.
### Change
- `engine/autodesign.js evaluate`, `lists`: an item with status 'adv' and a ratio above 1 is added to the warnings (`adv: true`) and not
  counted (before: `take(o)` pushed it to the failures because `o.r > 1`). Items 'adv' with ratio ≤ 1, and every other status, as before.
### §4 callout
- Provision: AASHTO LRFD 10th Ed. Art. 6.13.6.1.3b and C6.13.6.1.3b (flange slip; the excess flange force to the web), 6.13.2.8 (slip).
  Auto design's acceptance now follows each module's own status, as the Field splices tab does.
- Before: CTDOT built-in, Refine: 0 candidates ("governing splices TF3 … 1.076"). After: 1 candidate, which passes the full check
  (every module, every splice without a 'fail'; DT4 passes, AD8). Other projects: the tests' candidates are unchanged (no 'adv' item above 1).
### Tests
- tests/engine/autodesign.test.mjs (CTDOT test): candidates ≥ 1, each passes the full check, splices without failures, DT4 passing, bolt fit
  held; the current design still fails DT3/DT7 (narrow flanges).

## 2026-11-01 — PR: claude/sbd-eta-constr — The owner's η on deck placement / construction (ETAC; engineer decision 2026-11-01, calculation change for η ≠ 1); overhang bracket factors from the same source (read-only, old values kept and flagged)

Line numbers are approximate; search for the anchor text. Code sites are tagged `ETAC`.

### Decision (engineer, 2026-11-01; supersedes the 2026-10-15 owner rule for η only)
- AASHTO LRFD 10th Ed. Art. 3.4.2.1 evaluates construction at the Strength limit state, so the load modifier of Art. 1.3.2.1 applies:
  γ_DC = 1.25η, γ_CL = 1.50η (both maximum factors: η = max(η_D η_R η_I, 0.95), Eq. 1.3.2.1-2). What is applied: η (the Project tab's,
  `SBDOwners.loadFactors`); NOT m (the owner's design load multiplier is on HL-93 LL+IM only: RIDOT BDM 3.4.1.2; no owner rule puts it on
  construction loads); η_N is not used (no minimum factor in deck placement).
- Carrier: new field `etaC` of `SBDOwners.loadFactors()` (= eta; `LF_ONE.etaC = 1`). A load-factor object without it (a GirderDetail file's
  bridge.lf, the GirderDetail parity tests) gives 1 on construction, as GirderDetail computes; so the parity tests are unchanged.

### What changed
- `engine/owners.js` `loadFactors`: `etaC: Math.max(pr, 0.95)` added to L; LF_ONE `etaC: 1`; the η step's note says it is also on deck placement.
- `engine/constructibility.js`: new `factorsOwner(lf, over)` = `{ ...factors(over), cdc: cdc × lf.etaC, ccl: ccl × lf.etaC, eta, base }`, `lfOf(P)`,
  `projFactors(P)` (= `factorsOwner(lfOf(P))`), exported. `fromAnalysis`: before `prj = { mat, G: factors(opt.G) }`; after `G: opt.G ? factors(opt.G) :
  projFactors(P)`. `fromPayload`: `G: opt.lf ? factorsOwner(opt.lf, opt.G) : factors(opt.G)` (the tab passes the project's lf). Overhang brackets:
  `fromAnalysis` oh.p before `opt.oh || P.constr.oh || {}`; after `{ ...(that), gam: { dc: prj.G.cdc, cl: prj.G.ccl } }`; `fromPayload` the same when
  `opt.oh` is given or the file has no stored overhang inputs (a file's stored w_u, F_ℓ, P_ℓ are used as given, as before). Worked steps: the
  factors shown to 4 decimals when × η (`nf`), and the M_c and V_u steps say "Owner η = … on both: γ_DC = 1.25(η) = …, γ_CL = 1.50(η) = …";
  the bracket w_u step says the factors are the deck placement factors.
- `engine/shear.js` `factorsOwner(lf)`: `cdc: G.cdc * eC, ccl: G.ccl * eC` with `eC = lf.etaC || 1` (GS16, V_u = γ_DC V_DC1 + γ_CL V_CL; Shear tab
  and Rating's shear); the VuC step shows 4 decimals when × η.
- `engine/crossframes.js` `inputsOf` (stability bracing M_u): `SBDConstr.factors()` → `SBDConstr.projFactors(P)`; source text names η.
- `engine/splices.js`: `OWN_K.cn = ['dc1C', 'clC']`, `ownM` × `L.etaC` (1 when absent): the deck placement combination of the splice design forces.
- Auto design: every module above is reached through the tabs' own code (`SBDConstr.fromAnalysis` without opt.G, `SBDShearUI.build`,
  `CF.inputsOf`, the Splices env), so it takes η there with no change of its own.
- `ui/constructibility.js` (overhang card, exterior girder): the two inputs `γ_DC / γ construction` (`data-ohg`) and their handler are replaced by a
  read-only row `${γ_DC} / ${γ_CL}` (the deck placement factors, × η, link to the Project tab, `data-cngoin`); `ohOldGam(P)` lists saved
  `P.constr.oh.gam` values that differ from what is now used ("no longer used … (now …)"; kept in the file). The demands note shows
  `M_c = γ_DC M_DCc + γ_CL M_CL` with the project's values and η; the overhang-rows note likewise. File path passes `lf: C.lfOf(P)`.
- `engine/model.js`: doc comment, `constr.oh.gam` not used since 2026-11-01 (kept). Saved data (§5): no key or format changed.

### Check case (default project, G1, analysis; RIDOT with η_I yes: η = 1.05, m = 1.2; before = origin/main, Node)
- GS14 (flange buckling) at x = 77.00 ft, the governing deck placement location: M_DCc = 548.020 kip-ft, M_CL = 0 (no construction LL entered):
  M_c = 1.25(548.020) = 685.02 → 1.3125(548.020) = 719.28 kip-ft; f_bu = 7.3845 → 7.7537 ksi; φF_nc = 9.3877 ksi; ratio 0.7866 → 0.8259.
  Largest GS14 / GS15 / GS16: 0.7866 / 0.3936 / 0.1556 → 0.8259 / 0.4133 / 0.1634.
- Overhang brackets (G1 exterior): w_u = γ_DC(0.28125) + γ_CL(0.025 + 0.085 + 0.025 + 0.125 + 0.050) = 1.25(0.28125) + 1.50(0.310) = 0.81656 →
  1.3125(0.28125) + 1.575(0.310) = 0.85739 kip/ft; P_ℓ = γ_CL P_fm a/h_b = 1.50(3)(36/54) = 3.000 → 3.150 kip; largest OH ratio 0.4848 → 0.5125.
- Shear GS16 at x = 0.01 ft: V_u = 1.25(54.821) + 1.50(0) = 68.53 → 1.3125(54.821) = 71.95 kip; ratio 0.0861 → 0.0904.
- Cross-frames stability bracing: M_u = 1.25M_DC1 + 1.5M_CL at x = 321.0 ft = 1339.7 → 1406.7 kip-ft (× 1.05, rounded to 0.1); M_br 117.00 → 129.00 kip-in.
- Splices, FS1 deck placement combination: γ_DC 1.25 → 1.3125, γ_CL 1.50 → 1.575; M = −307.25 → −322.61 kip-ft.
- Default (AASHTO, η = 1): every value identical (only the new metadata fields etaC, G.eta, G.base appear). Rating (MBE factors): RF identical.
- `tests/engine/eta-constr.test.mjs` (new) holds these numbers.
- Auto design, recorded project builtin_RIDOT (tests/projects/sbd2-autodesign, sbd2FromPL, match-legacy settings as autodesign-parity.mjs), Node:
  - as recorded (η = 1.00, m = 1.2): η is 1 on construction, so before = after by construction (etaC = 1).
  - with η_I yes (η = 1.05, m = 1.2): before 439,866 lb, D = 65 in; after 437,046 lb, D = 70 in (both ratio 1.000, stiffeners TS7). Cross-check:
    every candidate of each run was evaluated with the other code: the after design (437,046 lb, D = 70) also passes every module with the
    BEFORE code, and the before design (439,866 lb, D = 65) still passes with the after code. So η on deck placement makes no candidate fail
    here; the lighter result is the search taking another path (the sizing and trim steps follow the governing ratios, which moved), not
    a lighter requirement. Auto design is a heuristic search, not a proven optimum.

### Other copies
- None.

## 2026-11-01 — PR: sbd-fat-support-shear — Fatigue shear range at interior supports from one side (found in the final comparison)
### Finding
- After D-2 (#579) the imported stud zones of the curb and util seeds failed SC1 (1.285, 1.298) in the new app; GirderDetail's own zone rows
  say V_f = 60.6 kip there, the new app 109.9 kip. Cause: `ui/fatigue.js fromAnalysis` (and its copy `engine/autodesign.js payloadOf`) set a
  station's `V_FATpos = max(VRpos, VLpos)`, `V_FATneg = min(VRneg, VLneg)`; at an interior support that is the right side's + and the left
  side's −, a range across the support no section sees (curb G1, x = 110 ft: 55.13 − (−54.77) = 109.90 kip; one side: 55.13 − (−1.73) =
  56.86 kip). The stud zones (SC1 V_f = the largest V_FAT,pos − V_FAT,neg in the zone) and the app's own pitch layout took it.
### Change
- Both functions: at an interior support station (R.supIdx without the ends) V_FATpos and V_FATneg are taken from the side with the larger
  range (`vf(i)`); every other station unchanged.
### §4 callout
- Provision: AASHTO LRFD 10th Ed. Art. 6.10.10.1.2 and 6.10.10.2 (fatigue pitch, V_sr from the fatigue shear range at the section),
  3.6.1.4 (fatigue load).
- Before → after (imported projects, G1, the zone ending at the 110 ft pier): curb V_f 109.90 → 61.07 kip, SC1 1.285 → 0.729 (GirderDetail's
  stored V_f 60.6); util SC1 1.298 → 0.731; built-in project, the app's own layout: pier-zone pitch 6.5 → 12 in, SC2 0.853 → 0.885 (fewer
  studs, still passing); xsA pier-zone pitch 8 → 12.5 in. Fatigue details (FA) unchanged on these girders.
- Hand check (curb G1, x = 110 ft): left side V+ = 1.73, V− = −54.77 → range 56.50; right side V+ = 55.13, V− = −1.73 → 56.86; the larger,
  56.86 kip, is the station's range (before 109.90).
### Other copies
- `engine/autodesign.js payloadOf` (kept the same as ui/fatigue.js fromAnalysis): changed alike.

## 2026-11-02 — PR: sbd-final-compare-2 — Final comparison re-run and the engineer's decisions (documentation only)
### Change
- docs/steel-bridge-comparison.md: §d gets a re-run after #576, #579, #585, #586 and #615 (100 girders, `tests/engine/final-compare.mjs`)
  and a new readiness verdict (ready for the engineer's approval; the redirect is not done). §(a) blocker list: D-1 and D-2 marked done.
  Decision rows recorded: C-3 and C-4 (the old app is never fixed), C-5 (keep the module's members), C-32 (done, #586), C-33 (keep the
  button), F-12 (later), W-4 (keep the Example source).
### §4 callout
- None: no code, formula or computed result changes. Numbers quoted are from the re-run (deck placement unskewed GS14 −0.81..+0.69 %,
  GS15 −0.95..−0.29 %, GS16 −5.82..−2.76 %; before −11..−19 %).
### Tests
- `node tests/engine/final-compare.mjs` re-run on main after #615.
### Other copies
- None.

## 2026-11-02 — PR #643: https://github.com/mlococo88/All-Structural/pull/643 (claude/sbd-3d-details) — 3D detail views of the field splice and the bearing stiffener (display only)
### Request
- Engineer: "The old app has 3D graphics of the splice connection and the bearing stiffener, do we have them in the new app? If not we
  should add." GirderDetail ("Steel Bridge Design.html", reference only, not changed) has them in its Field splice module
  (`function draw3D(R, host) {`, `function render3D() {`) and its Bearing stiffener module (`function draw3DB(R, host) {`,
  `function bsRender3D() {`). The new app only had the whole-bridge 3D view tab (ui/view3d.js) and its single-girder close-up.
### Change
- New `apps/steel-bridge/ui/detail3d.js` (window.SBDDetail3D): `splice(host, ctx, R, sel, onSel)` and `bearing(host, ctx, R, sel, onSel)`
  fill a `<div data-d3="splice">` / `<div data-d3="bearing">` card (three.js r128 + OrbitControls, the files index.html already loads).
  - Field splice (the selected splice; a Splice list in the card selects it in the tab): both girder ends with their own flanges and
    webs (thickness change shown, flanges flush on the inside faces as GirderDetail), outer and inner flange splice plates, fillers on the
    thinner side, the two web plates, every bolt (shank, heavy-hex head, nut, washer; typical proportions, display only) at the designed
    gage, pitch, edge distances and web bolt pattern; labels with the plate sizes and both sides' plates. Reads `s.R` of the tab's
    result (engine/splices.js compute: fl.top/bot, web, bolt, gap, secL/secR); nothing recomputed.
  - Bearing stiffener (the selected `bs` row of the tab, else the governing bearing; a Bearing list in the card selects it in the tab):
    the girder over the bearing (top flange at the bearing as the 2D drawing), every pair of stiffener plates with their clips, the
    fillet welds to the web, the effective column of 6.10.11.2.4 in orange (web strips `strip9` and `sEnd` of the result, a section cut at
    mid-depth), the girder end at e_d at the abutments, a sole plate / bearing / pedestal schematic, and the support cross-frame stubs on
    the side(s) with an adjacent girder (the bearing stiffener is the connection plate at the supports, engine/crossframes.js `cfCP`).
  - Controls in both cards: View (3D, elevation, plan, section; the orthogonal views use a 6° field of view from far away), Reset view,
    Save PNG, layer check boxes, girder transparency; orbit / pan / zoom (mouse and touch). Choices kept for the page view only (no
    storage key). Without three.js the card says so; without WebGL it shows the error.
- Hooks: `ui/splices.js` `splice()` (anchor `h += '<div data-gfxb="splice"></div>';`) adds `<div data-d3="splice"></div>`, and `render()`
  after `window.SBDTabGfxBUI.splice(host, ctx, S.R.list[S.sel]);` adds
  `if (S.R && !stale && !S.err && window.SBDDetail3D) window.SBDDetail3D.splice(host, ctx, S.R, S.sel, i => { S.sel = i; redraw(); });`.
  `ui/shear.js` `results()` (anchor `<div data-gfxb="shear-bearing"></div>`) adds `<div data-d3="bearing"></div>` after it, and `render()`
  after the `window.SBDTabGfxBUI.shear(...)` line adds
  `if (S.R && !stale && !S.err && window.SBDDetail3D) window.SBDDetail3D.bearing(host, ctx, S.R, S.sel, v => { S.sel = v; redraw(); });`.
  `index.html`: `<script src="ui/detail3d.js"></script>` after ui/view3d.js.
### §4 callout
- None: display only. No formula, factor, unit, reference or saved-data change; the views read the tabs' results and never write them.
### Check case
- Built-in project, G1, FS1 at 82 ft: the tab reports 50 bolts each side; the 3D view draws 100 bolts (56 flange + 44 web), 8 plates
  (2 outer, 4 inner, 2 web), no filler. Splice at 88 ft (16 × 3/4 / 16 × 1 1/8 to 18 × 1 1/2 / 18 × 2): 62 bolts each side → 124 drawn,
  fillers 3/4 in (top, 1.5 − 0.75) and 7/8 in (bottom, 2 − 1.125) on the left side.
- Bearing, Pier 1 G1 (Type B): 2 pairs 8 × 1 at 12 in, effective column 9(0.5625) = 5.06 in each side + 13 in = 23.13 in, as the tab.
### How verified
- Results hash before/after (Node, ui/splices.js and ui/shear.js build on the built-in project; splices at 82, 145, 215, 278 ft and at
  88 ft): identical. `node tests/engine/run.mjs splices shear stiffeners tabgraphics-b`; `node tests/check-syntax.mjs`.
- Browser (Playwright, 1280 and 390 px): both cards draw, 0 console errors, no horizontal scroll; three.js removed → the message.
### Other copies
- None.

## 2026-11-02 — PR #644: https://github.com/mlococo88/All-Structural/pull/644 (claude/sbd-ad-splices) — Auto design: field splice locations as a design variable (Lock / Range / Auto), with the old app's placement rule and stated shipping and clearance rules
**Calculation change (CLAUDE.md §4), limited to Auto design when the user chooses Auto or Range.** No formula, load or resistance factor, unit
or code reference of any check module changed. New: Auto design may now choose the field splice stations (before: Lock only, "placing splices
needs shipping-length and erection rules the engine doesn't have"). The variable defaults to **Lock** for every project, old and new, so a
project's Auto design result is unchanged unless the user picks Auto or Range (tested against origin/main, below).
Governing provisions: AASHTO LRFD 10th Ed. (2024) Art. 6.13.6.1.3a (splices of continuous spans at or near the points of dead load
contraflexure; the old app cited 6.13.6.1.1, the 9th Ed. numbering); RIDOT BDM (April 2026) 6.4 (hauling-permit pieces) and 6.7.2 (splice
location; pieces over 150 ft need a field splice); CTDOT BRSDM V2 2.3.5.1CT, 2.3.5.2CT (permit route length and weight); MassDOT Bridge Manual
Part I 3.6.5.3 (simple spans at the quarter point) and 3.6.5.5 (stiffeners clear of the splice plates). Cited, not quoted.

### The rule ported (the reference, read in "Steel Bridge Design.html"; the old app is unchanged)
- Preliminary sizing (pl-src) `spliceLocations(R, extra, shifts)`: continuous units, a splice at each permanent-load point of contraflexure
  next to each interior support (`R.cf`, from `Mperm = MDC1 + MDC2 + MDW + MUT`), rounded to the foot, ends within 0.5 ft dropped; simple spans,
  the girder ends at the piers (not field splices); splices closer than `limits.minSeg` merged (the first kept); a piece longer than
  `limits.shipLen` divided into ceil(L/L_ship) equal pieces, an odd number in a simple span (no splice at midspan), or, with the owner rule
  `spl.simple` (OWN30, MassDOT 3.6.5.3), a whole simple span at its quarter points when the middle half fits; a symmetric bridge (spans and
  |skews| mirror, `isSym`) placed on its left half and mirrored. And `sizeForDepth`'s shipping loop: a piece heavier than `limits.shipWt`
  (plates × (1 + allow/100), 1-ft steps) split at its middle, at its third point in a simple span when the middle is within L/8 of midspan.
  Note: the engineer's "simple spans at the quarter point" is the MassDOT owner rule in the old app; for AASHTO, RIDOT and CTDOT a simple
  span longer than the shipping length is cut into an odd number of equal pieces. Ported as written.
- GirderDetail (gd-src) `spLocSuggest()` ("Suggest splice", Splice tab): the same contraflexure points from the Structural analysis (DC1 +
  DC2 + DW of G2, the scan from each pier outward to the first station whose moment changes sign, linear between it and its neighbour), and
  no splice closer than `spl.minSup` (10 ft) to a support (moved out to it).
- Here: `apps/steel-bridge/engine/splplace.js` (new, `window.SBDSplicePlace`): `contraflexure(R)` (spLocSuggest's scan; M_UT added when the
  project has utilities, as Preliminary sizing), `reference(P, cf, Ru, segs, allow)` (spliceLocations + the weight split + spLocSuggest's
  support distance), `rules(P, lim)`, `check(P, spl, Ru, o)`, `layouts(P, o)`, `placeSteps(…)`, `transitions(segs, spl)`, `pieceWt(…)`.
  The points of contraflexure are taken from the analysis of the current design (the first interior plate girder), not re-derived for each
  candidate depth (the dead-load moment diagram moves by a fraction of a foot; the stations are rounded to the foot).

### Rules and defaults (inputs on the Auto design tab, saved as `P.autodesign.splRules`; blank = the default)
| input | default | source |
|---|---|---|
| maximum shipping piece length L_ship | RIDOT 100 ft; CTDOT 120 ft; **AASHTO and MassDOT 120 ft (no owner limit: the old app's default, for the engineer to confirm)** | RIDOT BDM 6.4 (engine/owners.js `ship`); CTDOT BRSDM V2 2.3.5.1CT (`ship`); MassDOT Part I 3.6.1.7 leaves it to the designer (no number) |
| maximum shipping piece weight W_ship | RIDOT 150 kip; CTDOT 120 kip; AASHTO, MassDOT 90 kip (the old default) | the same rows |
| RIDOT: a piece over 150 ft fails whatever L_ship | 150 ft | RIDOT BDM 6.7.2 (`ship.splice`) |
| minimum piece length | the Auto design limit "Shortest flange zone" (minSeg, 10 ft) | the old merge rule |
| minimum distance from a bearing | 10 ft | GirderDetail `spl.minSup` |
| minimum distance from an intermediate cross-frame / connection plate (every girder line, own stations) | the Spans & framing splice clearance (framing.spliceClear, 2 ft) | Preliminary sizing `limits.spliceClear`; MassDOT 3.6.5.5 cited (new owners.js row `spl.xf`) |
| minimum distance from a shop flange transition | minSeg (10 ft): a splice nearer leaves a flange zone shorter than allowed | Auto design limits |
| location (continuous) | the permanent-load points of contraflexure | AASHTO 6.13.6.1.3a; RIDOT BDM 6.7.2 (new owners.js row `spl.loc`) |
A splice that breaks the cross-frame or transition distance is moved by 1 ft steps (up to 5 ft each way, the nearer first; its mirror too on a
symmetric bridge) to a station that keeps every rule. engine/owners.js: two rows appended (`spl.loc` RIDOT 6.7.2, `spl.xf` MassDOT 3.6.5.5,
`dv: 5`, paraphrased); the existing `ship`, `ship.splice`, `spl.simple` rows are read, unchanged (loads.test.mjs row count 125 → 127).

### The variable `spl` (engine/autodesign.js `VARS`, anchor `{ id: 'spl', grp: 'Flanges'`)
- **Lock** (default; also forced in Refine and Check one change): the stations entered; nothing above runs; the trial list is exactly as before.
- **Auto** (New design): up to three layouts: the rule's (`reference`), the stations entered when they meet every rule, and the fewest-splice
  layout the rules allow (per span the rule's count or one fewer; on a symmetric bridge only symmetric layouts).
- **Range**: min … max splices in every span (`vars.spl`) or per span (`vars['spl#k']`, which may also Lock one span), station windows
  (`vars.spl.win`, "70-90, 135-150": a splice outside every window moves to the nearest window station of its span); up to four layouts.
- Each layout is a dimension of the trial list (`run()`, anchor `the field splice variable (New design, Auto or Range`): `relayout(L0, spl)`
  cuts the current web pieces and flange zones at the new splices (per-piece variables `id#k` then mean piece k of that layout); `design()`
  sizes the plates per field piece (flange widths, transitions ≥ minSeg from the splices, L/85 of the piece, the splice bolt fit) and a layout
  whose piece weights or transition distances fail on its plates does not pass; the full check of a finalist adds the rules with its own
  cross-frames (`splCheck`, a failure listed as "splice placement SPn"); `sizeDetails` turns the Field splices tab's auto-design on at moved
  stations even with the plates Locked (plates entered at an unchanged station are still used as entered); the cost model counts the layout's
  splices (`costOf`: $ per field splice × splices × N_b, unchanged). Apply writes `framing.splices`, which the Field splices tab, the
  framing, the drawings, the DXF and the 3D view read (tested). No layout meeting the rules: the run says so and stops.
- The worked steps of the placement (each contraflexure point, the rule's stations with the reasons, every rule per piece and per splice) are
  in the candidate's worked steps; the candidate's details list the rules with their ratios; the compare view adds the stations and the count.

### Hand check: the placement rule on the built-in 110-140-110 ft unit (app's default project, G1, `tests/engine/autodesign-splices.test.mjs`)
- Pier 1 (110 ft), back span: M(77) = 41.919 + 15.981 + 13.236 = 71.137 kip-ft (DC1 + DC2 + DW), M(78) = −12.832 + 6.418 + 5.316 = −1.098:
  x = 77 + (78 − 77)(71.137)/(71.137 + 1.098) = 77.985 → **78 ft**.
- Pier 1, ahead span: M(143) = −21.882 + 10.429 + 8.638 = −2.815, M(144) = 29.772 + 19.573 + 16.212 = 65.557: x = 143 + 2.815/68.372 =
  143.041 → **143 ft**; pier 2 by symmetry 216.960 → **217 ft**, 282.019 → **282 ft**.
- From M_DC1 alone (the engineer's request): 77 + 41.919/(41.919 + 12.832) = 77.766 and 143 + 21.882/(21.882 + 29.772) = 143.424 ft: rounded,
  the same 78 and 143 ft (217 and 282 ft by symmetry). The rule uses the permanent load (DC + DW), as both old functions do.
- Pieces 78, 65, 74, 65, 78 ft ≤ 120 ft (none split); weights ≤ 90 kip (piece 1: 63.75 in² × 3.403 lb/ft × 78 ft × 1.05 = 17.8 kip);
  32 and 33 ft from the nearest pier ≥ 10 ft; symmetric. Stations entered: 82, 145, 215, 278 ft (they also meet every rule).
- Other branches (hand inputs in the test): simple 130 + 130 ft, AASHTO: 3 equal pieces → 43, 87, 173, 217 ft; MassDOT 3.6.5.3: quarter points
  → 33, 98, 162, 227 ft (32.5 rounds to 33, mirrored); one 100 ft span at W_ship = 20 kip: 248.4 lb/ft × 100 × 1.05 = 26.08 kip > 20 → split
  at the third points 33, 67 ft (the middle is within L/8 of midspan); a contraflexure point 4 ft from a pier → moved to 10 ft.

### Before / after (Node, the parity settings of tests/engine/autodesign-parity.mjs: New design, N_b and overhang locked, lightest steel, the project's Preliminary sizing limits)
| project | splice variable | weight (lb) | D (in) | field splices (ft) | transitions | cost ($) | governing (full check) | s |
|---|---|---|---|---|---|---|---|---|
| builtin_AASHTO | Lock (before; = the recorded parity design on main) | 406,234 | 70 | 82, 145, 215, 278 | 8 | 1,419,703 | TS7 1.000 | 617 |
| builtin_AASHTO | Auto | 404,856 (−0.34 %) | 62 | 78, 142, 218, 282 (the rule) | 10 | 1,433,568 | TS2 1.000 | 710 |
| util_RIDOT | Lock (before; = the recorded parity design on main) | 439,003 | 75 | 82, 145, 215, 278 | 5 | 1,494,759 | TS7 1.000 | 626 |
| util_RIDOT | Auto | 437,672 (−0.30 %) | 65 | 78, 143, 217, 282 (the rule) | 8 | 1,520,015 | TS7 1.000 | 841 |
- Module governing ratios, builtin_AASHTO Lock → Auto: flexure GS7 0.967 → 0.978, fatigue FA1 0.972 → 0.988, shear GS11 0.750 → 0.724,
  constructibility GS15 0.531 → 0.500, stiffeners TS7 1.000 → TS2 1.000, studs SC2 0.947 → SC4 0.875, cross-frames CF3 0.937 → 0.910,
  splices DT2 1.000 → 1.000, rating RT1 0.940 → 0.960, welds FW4 1.000 → 1.000.
  util_RIDOT Auto: flexure GS8 0.956, fatigue FA1 0.994, shear GS11 0.739, constructibility OH1 0.461, stiffeners TS7 1.000, studs SC2 0.985,
  cross-frames CF6 0.875, splices DT2 1.000, rating RT1 0.756, welds FW4 1.000.
  util_RIDOT Lock (before): flexure GS7 0.984, fatigue FA1 0.944, shear GS11 0.886, constructibility OH4 0.486, stiffeners TS7 1.000, studs SC2
  0.983, cross-frames CF3 0.954, splices DT2 1.000, rating RT1 0.808, welds FW4 1.000.
- The fixture projects' contraflexure (their own loads): builtin_AASHTO 78.10, 142.38, 217.62, 281.90 → 78, 142, 218, 282 ft; util_RIDOT
  (with its utilities, M_UT) 78.01, 142.52, 217.48, 281.99 → 78, 143, 217, 282 ft. Auto sized the rule's layout and the stations entered;
  the rule's was lighter on both (the objective is weight; on cost both Auto designs are dearer: builtin_AASHTO +2 transitions, +$13,865;
  util_RIDOT +3 transitions, +$25,256 — choose the cost objective to weigh them).
- Lock = before: the quick Lock runs (New design with N_b and overhang locked, D 66–70 in, and Refine; screen only) give byte-identical
  results on origin/main (69a382b) and this branch (`tests/projects/sbd2-autodesign/splvar_lock_ref.json`, recorded on main; test "Saved
  data …"); the full Lock run of builtin_AASHTO equals the recorded parity design (406,234.24 lb, D 70, ad_builtin_AASHTO.json).

### Saved data (CLAUDE.md §5)
- New optional fields: `P.autodesign.vars.spl.win`, `P.autodesign.vars['spl#k']`, `P.autodesign.splRules` (engine/model.js header). Absent =
  Lock and the defaults. No key or format changed. A `vars.spl` saved before this PR could only be absent (the table showed no selector for a
  Lock-only variable), so every saved project reads Lock.

### Where
- `apps/steel-bridge/engine/splplace.js` (new); `apps/steel-bridge/index.html` (its script tag before engine/autodesign.js).
- `apps/steel-bridge/engine/autodesign.js`: `SPP`, `settings()` (`s.splR`), `VARS` spl, `varsOf` (span entries, `win`, Refine / Check lock),
  `relayout`, `framesOf`, `splCheck`, `splPlan`, `design()` (`base.L0`, `sc`), `run()` (layouts as jobs, the stage-2 rules, `R.spl`),
  `sizeDetails` (anchor `the splice variable moved the stations`), `cand()` (`spl`, the placement steps).
- `apps/steel-bridge/ui/autodesign.js`: the variable row (Range: min / max per span, station windows; "each span on its own"), the placement
  rules box (`splRulesBox`), the layouts sized (results), the candidate's placement rules table, the compare rows (stations, count).
- `apps/steel-bridge/engine/owners.js` (two rows), `engine/model.js` (header), `docs/steel-bridge-comparison.md` (row F-22).
- Tests: `tests/engine/autodesign-splices.test.mjs` (new), `autodesign.test.mjs` / `autodesign-vars.test.mjs` (load splplace.js; the saved
  `spl: auto` entry now reads Auto), `loads.test.mjs` (row count), `tests/projects/sbd2-autodesign/splvar_lock_ref.json` (new).

### Decisions (engineer's rule of 2026-10-29: accurate, not over-conservative) and open questions
- SB2-AD15. Default Lock (the design changes only when the user chooses Auto or Range).
- SB2-AD16. Auto offers the rule's layout, the stations entered (when they meet the rules) and the fewest-splice layout; the objective picks.
  So Auto is never worse than Lock on the objective where the entered stations meet the rules.
- SB2-AD17. Contraflexure from DC + DW (+ UT), the reference's load, not M_DC1 alone (same stations on the built-in after rounding).
- **Open (engineer):** the shipping length where no owner limit exists (AASHTO, MassDOT: 120 ft, the old default) and the weight (90 kip);
  RIDOT: 100 ft is used (6.4, one-piece permit length), though 6.7.2 allows 100–150 ft pieces with an optional splice shown: use 150 ft?;
  a minimum piece of 10 ft (the old merge rule) is short for a shipping piece: raise it?; the cross-frame clearance (2 ft) is measured from the
  frame's work point, not the connection plate's edge.

### How verified
- `node tests/engine/run.mjs autodesign splices model loads ownerdef`; the full suite once before merge (below).
- Playwright (Chromium, file://) at 1280 and 390 px: the variable table (Auto, Range with windows and per span, the rules box), an Auto run
  on the built-in project (N_b, D locked: 2 layouts sized, 48 s), the candidate list, the candidate's rules, the compare view; no horizontal
  page scroll at 390 px; 0 console errors.

### Other copies
- None (the old app is unchanged).

## 2026-11-02 — PR #645: https://github.com/mlococo88/All-Structural/pull/645 (claude/sbd-splice-minpiece) — Auto design: default minimum shipping piece length 30 ft (engineer decision)
**Calculation change (CLAUDE.md §4), Auto and Range splice layouts only.** The engineer's answers to the #644 open questions (2026-11-02):
AASHTO / MassDOT 120 ft and 90 kip kept; RIDOT 100 ft kept; the cross-frame clearance from the work point and the contraflexure from the
current design's analysis accepted; **the minimum shipping piece length raised from 10 ft to 30 ft** (editable, `P.autodesign.splRules.minLen`).
### Where
- `apps/steel-bridge/engine/splplace.js` `rules()`: before
  `pick('minLen', true, null, minSeg, 'the shortest flange zone of the Auto design limits (the old app merges splices closer than it)');`
  after `pick('minLen', true, null, DFLT.minLen, 'default 30 ft (engineer decision 2026-11-02; was the shortest flange zone, 10 ft, the old app\'s merge rule)');`
  with `DFLT = { shipLen: 120, shipWt: 90, minLen: 30, minSup: 10, minXf: 2 }` (minLen added); the header comment.
- Used by `reference()` (splices closer than L_min merged; a heavy piece split only when longer than 2 L_min) and `check()` SP2.
### Governing provision
- No code limit (AASHTO LRFD 10th Ed. 6.13.6.1.3a governs the location only): owner practice, the engineer's decision.
### Check case
- Splices at 78 and 100 ft (a 22 ft piece): SP2 before 10/22 = 0.455 (passes), after 30/22 = 1.364 (fails). `tests/engine/autodesign-splices.test.mjs`.
- Lock (the default): the rules are not applied; unchanged (the test "Saved data …" still matches main's record byte for byte).
### Before / after (Auto runs, the #644 parity settings)
- builtin_AASHTO: 404,856 lb, D 62 in, splices 78, 142, 218, 282 ft, TS2 1.000 — identical (plates and every module ratio); 716 s.
- util_RIDOT: 437,672 lb, D 65 in, splices 78, 143, 217, 282 ft, TS7 1.000 — identical; 829 s.
- Why: every piece of those layouts is at least 64 ft; the fewer-splice layouts were already ruled out by the shipping length.
### How verified
- `node tests/engine/run.mjs autodesign-splices` (6 passed); the two Auto runs above compared with #644's.

## 2026-11-02 — PR #646: https://github.com/mlococo88/All-Structural/pull/646 (claude/sbd-splice-gfx) — Field splices tab: one set of graphics, sized like the other tabs (SPLGFX; display only)
### Why
- Engineer: "The field [splice] graphics seem to be out of place. They are very large in scale and duplicative of other graphics that are on the sheet."
- Inventory before (built-in project, FS1, card 804 px wide at 1280): (1) the Drawings-style detail (flange plans + web elevation), frame 822 px
  high with a band of empty space under it (the bolt note at y = −8h); (2) the 3D card, open, 554 px; (3) a plain SVG plan of the bottom flange
  splice (engine/splices.js `svg()`), 536 px high, 46 px text cut off at both sides; (4) a plain SVG web elevation, 1,293 px high, 46 px text.
  (3) and (4) repeated (1) at about 4× scale; (1) also has the notes running over the girder flanges and plate-size dimension text wider than
  the plate. Report: the same plain SVGs as one figure per splice, 2,858 px high in print. No graphic showed where the splice is on the girder.
### What changed
- `ui/splices.js` `splice()` (anchor `h += '<div data-gfxb="splice"></div>';`): the two plain SVGs (`X.svg(R)`, `.sp-dwg`) are no longer shown;
  now `<div data-gfxb="splice-strip"></div><div data-gfxb="splice"></div>` and the 3D card inside `<details class="sp-3d">` (collapsed by default;
  open / closed kept in `S.d3` for the page view only, no storage). `render()`: `SBDTabGfxBUI.splice(host, ctx, S.R.list[S.sel], S.R.list, S.sel, onSel)`;
  `SBDDetail3D.splice(...)` only when the card is open (on its `toggle`), so the 3D view starts framed at its real size. CSS: `.sp-dwg` rule replaced
  by `details.sp-3d…`, and the strip hides its +/−/Fit buttons (wheel, pinch, double-click still work).
- `ui/tabgraphics-b.js` `put(..., extra)`: extra mount options; `splice(host, ctx, s, list, sel, onSel)` mounts the strip (`minPx: 60`, `phoneZoom: false`;
  a click selects the splice in the tab) and the detail (`maxVh: 60`).
- `ui/graphics.js` `mount()`: two optional options, `minPx` (smallest frame height, default 200 px as before) and `phoneZoom: false` (no reading-scale
  start at phone width). Defaults unchanged for every other graphic.
- `engine/tabgraphics-b.js`: new `spliceStrip(list, P, opt)` (girder line, supports S1…, each FS marker in the colour of its governing ratio `s.gov`,
  labels staggered, selected one boxed; regions `{ k: 'fs', i }`). `splice()`: flange notes start past the girder ends (`xEnd`) and name the outer plate
  (the plate dimension now shows the length only, `<>`); web plate length dimensioned; the gap dimension (text wider than the gap) replaced by
  "GAP … BETWEEN THE GIRDER ENDS" in the bottom note; bottom note at `webY0 − 5.6h` (was −8h); plans 8h apart (was 12h); title 2.4h above the note (was 3.8h).
- `report/builders.js` `spl()`: `splFig()` — the strip once in "Splices of …" and the detail per splice (`tightSvg`, width set for about 11 px text,
  max 100 %); the plain `SP.svg` figure stays only as the fallback when the graphics modules are not loaded. 3D is screen only.
- `tests/engine/graphics-overlap.test.mjs`: the strip of every splice, wide and narrow, added.
- engine/splices.js not changed (`svg()` kept for the fallback).
### §4 callout
- None: display only. No formula, factor, unit, reference, key or saved format changed.
### Check case
- Built-in project, splices 82, 145, 215, 278 ft, G1: strip shows FS1–FS4 between S1–S4, amber markers (FS1 governing BF4, 0.997); detail of FS1:
  web 2 PL 57 × 7/16, 11 rows × 2 col., plate 1'-1 1/2"; top outer PL 16 × 7/16 × 1'-7 1/2"; bottom outer PL 16 × 5/8 × 2'-1 1/2", as the tab text.
  At 1280: strip 134 px, detail 570 px (text 11–12 px), 3D card 27 px closed (was 822 + 554 + 536 + 1,293 px).
### How verified
- Results and worked steps hash (Node, `SBDSplicesUI.build` + `stepsOf`, 4 splices, 748 steps), origin/main vs branch: identical sha256.
- `node tests/engine/run.mjs splices tabgraphics-b graphics-overlap report report-wiring graphics gfxa`; `node tests/check-syntax.mjs`.
- Browser (Playwright, 1280 and 390): 0 console errors, no horizontal scroll; 3D card opens framed and stays open on another splice.
### Other copies
- None.

## 2026-11-02 — PR #695: https://github.com/mlococo88/All-Structural/pull/695 (claude/sb-nb-one-input) — Auto design: one girder-count input (the N_b variable row); "Candidates to keep" renamed "Designs to list"
### Why
- Engineer: two inputs set the girder counts studied ("Girder counts to study", `P.autodesign.nbList`, and the "Girder count N_b" row of the
  design variables, `P.autodesign.vars.nb`); keep the row only. Rename "Candidates to keep" (`topN`) and say what it does.
### What changed
- `engine/autodesign.js` `nbList(P, S)`: the list is no longer read. Before:
  `const xs = P.xs || {}, nb0 = xs.nb || 0, W = …, lst = String(S.nbList || '').split(/[\s,;]+/).map(Number).filter(n => n >= 2 && Number.isInteger(n));`
  … `if (lst.length) return [...new Set(lst)];` (between the Range line and the Auto ± 1 line). After: `lst` and that line removed. Lock = `[nb0]`,
  Range = min … max, Auto = nb0 − 1, nb0, nb0 + 1 within the spacing limits (unchanged lines). `VARS` nb note: "(or the counts listed)" removed;
  now "Auto (New design): the current count ± 1 within the spacing limits; Lock: the current count; Range: every count from min to max; …".
  `DEF.nbList` kept ('' ; not read) with a comment; header comment of the 'new' mode updated.
- `engine/model.js` new `migrateNbList(p)` (exported), called by `importJSON` after `migrate()` (anchor `const notes = [migrateNbList(p)]`);
  `importJSON` and `load` now also return `notes` (one-line notices). The migration, on a non-blank `autodesign.nbList` only:
  the whole counts ≥ 2 in it (as the old reader), sorted, de-duplicated; `nbList` set to ''; if `vars.nb.mode` is not 'lock' or 'range'
  (absent or 'auto', where the list replaced the ± 1 rule) and the list held a count: `vars.nb = { mode: 'range', min: smallest, max: largest }`;
  if counts were skipped (e.g. "5, 7"): notice "Auto design: the girder counts listed ("5, 7") are now the girder count Range 5 to 7, which also studies 6."
  Header doc of `autodesign` updated.
- **Kept or cleared:** cleared (`nbList: ''`). Nothing reads it now, so neither choice can change a result; but a kept list would make the
  migration run again on every load and overwrite a later choice of the nb row (e.g. set back to Auto). The list's content is in the Range min
  and max; only the gaps are not kept, and the notice names them.
- `engine/library.js` `open()`: passes `notes`. `index.html`: `loadNotes(notes)` toast after the autosave load (the migrated project is written
  to the autosave once, so the notice shows once), after opening a saved project and after Import JSON.
- `ui/autodesign.js` `inputsHtml()`: the "Girder counts to study" box removed; `num('topN', 'Candidates to keep', …)` → `num('topN', 'Designs to list', …)`;
  new note under the grid: "Designs to list: Auto design ranks every trial by the objective, then runs the full check on the best ones until this many
  pass every module; pick one and Apply." plus, in New design, "The girder counts studied are set by the Girder count N_b row … (now 5, 6)". Header comment.
- Saved field `topN` unchanged. `tests/engine/autodesign-parity.mjs` `legacySettings`: `nbList: String(Ppl.bridge.nb)` → `vars.nb: { mode: 'lock' }`
  (the same single count: `xs.nb = round(bridge.nb)`, ad-fixture.mjs).
### §4 callout
- None: no formula, factor, unit or reference changed. The counts studied for a saved project are the same after the migration, except a list with
  a gap, which now also studies the counts between (stated on screen).
### Check case (default project: N_b = 5, bays 4 × 9.5 = 38 ft, spacing limits 6 … 12 ft)
- Blank list, nb Auto: 4 → 38/3 = 12.67 ft > 12 (out), 5, 6 → 38/5 = 7.6 ft → counts [5, 6] before and after.
- "4, 5, 6" (nb Auto) → Range 4 … 6 → [4, 5, 6] before and after. "4, 6" → before [4, 6], after [4, 5, 6] + notice.
  "4, 6" with nb Lock → before [5] (Lock read first), after [5], list cleared, no notice.
### How verified
- New test in `tests/engine/autodesign-vars.test.mjs` (migration cases, once-only, load path).
- Full New design runs (Node, default project, `AD.run(P, { maxIt: 3, trimTries: 1 })`, topN 2; the saved project passed through `importJSON`;
  sha256 of every candidate (layout, details, cost, module ratios), the screened list, the rejected and the note), origin/main vs branch:
  - blank list, nb Auto: counts [5, 6], 27 trials, best N_b 5, D 55 in, 424,535 lb — identical (8b2eb99a78008e30).
  - "4, 5, 6": main [4, 5, 6] / branch Range 4 … 6 → [4, 5, 6], 42 trials, best N_b 4, D 57 in, 396,846 lb — identical (a8f4a6ea23c90850).
  - "4,5" with nb explicitly Auto: [4, 5] both, 29 trials — identical (998469cd4966c622).
  - "4, 6" with nb Lock: [5] both, 14 trials — identical (75b1b81cdb067e4d).
  - "4, 6" (gap): main [4, 6], 30 trials (a248f732f214f80d); branch [4, 5, 6], 42 trials + the notice (= the "4, 5, 6" run). Same
    candidates (N_b 4, D 57 in, 396,846 lb); N_b 5 is now screened too (intended).
- `node tests/engine/run.mjs autodesign` (3 files, 22 passed), `model.test library.test projects.test report-wiring` (29 passed), `node tests/check-syntax.mjs` (all pass).
- Browser (Playwright, a saved project with "4, 6"): the notice shows once (not after reload), the autosave holds vars.nb Range 4 … 6 and
  nbList '', the box is gone, "Designs to list" and its note shown; 0 console errors.
### Other copies
- None.

## 2026-11-02 — PR #697: https://github.com/mlococo88/All-Structural/pull/697 (claude/sb-dup-designs) — Auto design list: "Differs from #1 in" column (the 1-gage-line twin explained; display only)
### Why
- Engineer: with Designs to list = 2, the default project lists two designs with the same N_b, D and weight. Are they duplicates?
### Finding
- Not true duplicates. Default project, New design, nb Auto, topN 2 (the runs of PR #695, Node, maxIt 3):
  #1 and #2 are both N_b 5, D 55 in, 424,535 lb, the same cost, splices (82, 145, 215, 278 ft), web and flange plates, transitions, overhang,
  sized details (`det.rows`) and module ratios. They differ only in the field-splice gage lines: #1 `L.minLines` null (the Splices tab's bolt
  lines, 2), `boltRaised` true; #2 `L.minLines` 1 (one gage line each side of the web; Apply sets `splices.bolts.minLines = 1`), `boltRaised` false.
- Why the search makes them: `engine/autodesign.js` `run()` (anchor `if (oneLine) { const best = out.filter(o => o.pass && o.L.boltRaised`) adds a
  1-gage-line variant of the two best designs whose splice flange widths the bolt fit (DT10) raised, so the objective can choose the lighter one.
  The pool's de-duplication (`sigOf`) includes `minLines`, so both stay. Here the 1-line variant ends at the same plates as the 2-line design
  (the raised width is what the design needs anyway), so it saves nothing and ties on weight, cost and ratio. The same twin is listed in
  the other runs of #695 (N_b 4, D 57 in, 396,846 lb, twice).
- The list already had a "Gage lines" column ("as set" / "1"), but nothing said the rows are otherwise the same.
### What changed
- `ui/autodesign.js`: new `diffFrom(c, c1)` (after `const ohT = …`; exported as `SBDAutoDesignUI.diffFrom` for the test). It names what candidate c changes
  against #1: N_b, D, overhang, splice stations, splice gage lines, web plates, each flange's transitions (cut points) or plates, and each sized
  detail by its label; otherwise "nothing listed here (same plates and details)". The candidate list gets a last column "Differs from #1 in"
  (`—` for #1, blank for the "now" row). Before: `…<th class="lft">What governs</th></tr>`; after: `…<th class="lft">What governs</th><th class="lft">Differs from #1 in</th></tr>`,
  and each row `<td class="lft">${i ? esc(diffFrom(c, R.cands[0])) : '—'}</td>`.
- No engine change: which designs are listed, their order and their checks are unchanged.
### §4 callout
- None: display only. Before / after list (default project, topN 2): see the PR (same rows; #2 now reads "gage lines at the splices (1 vs as set)").
### Check case
- Default project, Designs to list 2, run in the app (Playwright, full settings), origin/main vs branch: the rows are identical apart from the new
  column. #1 N_b 5, D 67 in, 409,784 lb, $1,427,351, 7 transitions, 4 splices, gage lines "as set", TS2 1.000, Differs "—";
  #2 the same numbers, gage lines 1, Differs "gage lines at the splices (1 vs as set)". 0 console errors both sides.
### Note (saved-project list, from PR #695; left as is by the engineer)
- A project kept in the saved-project list (engine/library.js) with an old "Girder counts to study" list stays in the old text until it is saved
  again; it is migrated the same way on every open (engine/model.js migrateNbList), so a gap notice repeats on each open until the project is saved.
  The autosave copy is rewritten once on load, so it does not repeat there.
### How verified
- `tests/engine/autodesign.test.mjs`: new test of `diffFrom` (the twin, identical, D + plates + a detail, N_b + transitions); `node tests/check-syntax.mjs`.
- The app run above, main vs branch (the list read from the page; screenshot checked).
### Other copies
- None.

## 2026-11-02 — PR: claude/list-input-steelbridge, PR #708: https://github.com/mlococo88/All-Structural/pull/708 — the list inputs are tables, one box per value (one per column for x:P and from–to) (LIST)   [display only]
- **Why:** engineer decision 2026-11-02: no comma-separated inputs (`shared/list-input.js`, `fixlog/shared-list-input.md`, #681).
  `nbList` (girder counts) is not touched: #695 replaced it with one input.
- **New file `ui/lists.js`** (`window.SBDListsUI`): a table of the list inputs (selector → table name, columns, the module's own text
  format) and a MutationObserver that binds a table (`SharedListInput.bindInput`) to each of those inputs whenever a module draws
  it. The input stays, hidden, with its id, data attributes and value text, so every module's own `change` handler reads it
  unchanged; a table edit writes the rows back in the module's format and fires `input`; when the focus leaves the table the
  input's `change` fires (the commit), as the old box did on blur. CSS: `.bad + [data-sli="host"] .sli{outline:…}` shows the
  module's error mark (e.g. `#i_spans.bad`) on the table.

  | Input (module) | Table | Format written | Field (unchanged) |
  |---|---|---|---|
  | `#i_spans` (index.html, Spans) | L (ft) | "a, b" | `P.spans.lengths` (array) |
  | `#i_xs.bays` (ui/loads.js) | S (ft) | "a, b" | `P.xs.bays` (array) |
  | `#i_xs.skews` (ui/loads.js) | Skew (°) | "a, b" | `P.xs.skews` (array) |
  | `#fr_spl` (ui/framing.js) | Station (ft) | "a, b" | `P.framing.splices` (array) |
  | `#i_splx` (ui/splices.js) | Station (ft) | "a, b" | `P.framing.splices` (array) |
  | `#i_studs.splX` (ui/fatigue.js) | Station (ft) | "a, b" | `P.studs.splX` (text) |
  | `#an_l_xf` (ui/analysis.js) | x (ft), P (kip) | "20:1.5, 40:1.5" | `girders[i].loadsManual.xf` (array of {x, P}) |
  | `#an_a_seqCustom` (ui/analysis.js) | From, To (ft) | "0-80, 140-220" | `P.analysis.seqCustom` (text) |
  | `#ad_win` (ui/autodesign.js) | From, To (ft) | "70-90, 135-150" (reads "70 to 90" too) | `P.autodesign.vars[…].win` (text) |
- **index.html:** `<script src="../../shared/list-input.js"></script>` after `shared/steps.js`; `<script src="ui/lists.js"></script>` after
  `ui/handoffs.js`; Spans card: unit text "ft, comma separated" → "" and the note starts "One span per row (Enter adds a row)."
- **Unit texts** (the unit is in the column header now): ui/loads.js bays "ft, left to right" → "left to right", skews
  "°, one per support line" → "one per support line"; ui/framing.js "ft, comma separated" → ""; ui/splices.js "ft from the left
  end, comma separated (also on …)" → "from the left end (also on …)"; ui/analysis.js pours "ft, e.g. 0-80, 140-220 (blank:
  automatic)" → "from–to per row (none: automatic)", loads "x:P (ft:kip), comma separated" → "one load per row";
  ui/autodesign.js "ft; blank: anywhere in the span" → "none: anywhere in the span"; ui/fatigue.js studs.splX unit "ft" → "".
- **Saved data:** no field, key or format changed (table above). The modules' readers are unchanged; `tests/engine/list-input.test.mjs`
  (readers copied verbatim) shows each text written by a table reads the same values, and that the forms the modules draw
  ("a, b", "x:P, …", "a-b, …") come back byte for byte.
- **Check case:** built-in project: spans 110 / 140 / 110, spacings 9 / 9.5 / 9 / 9.5, skews 10 ×4 (tables), and on the Analysis tab
  cross-frame loads 20:1.5 and 45:2 and pours 0-80 and 140-220 (pasted into the two-column tables) → the saved project has
  `spans.lengths` [110, 140, 110], `xs.bays` [9, 9.5, 9, 9.5], `xs.skews` [10, 10, 10, 10], `loadsManual.xf`
  [{x:20, P:1.5}, {x:45, P:2}], `analysis.seqCustom` "0-80, 140-220" — identical to typing the same text in the old boxes on
  origin/main.
- **How verified:** `node tests/smoke/list-input.mjs --part sbridge`: origin/main vs this branch (the whole app folder), built-in
  project and the case above: the stored project `sbd2.project.current`, the Section properties, Loads & LLDF and Analysis tab text
  and the Spans & framing, Cross-section & loads, Fatigue & studs and Splices input text (tables, units and notes removed)
  identical; 0 console errors; 390 px no sideways scroll; screenshots at 1400 and 390 px looked at.
  `node tests/smoke/steel-bridge-wiring.mjs` passes. `node tests/check-syntax.mjs` passes. Station windows checked in the browser:
  Auto design → Field splice locations → Range, "70 ↹ 90 / 135 ↹ 150" pasted into the table → `vars.spl.win` = "70-90, 135-150", 0 console errors.
- **Formulas, factors, units, code references:** none (§4 does not apply).

## 2026-11-02 — PR #713: https://github.com/mlococo88/All-Structural/pull/713 (claude/sb-drop-twin) — Auto design: the 1-gage-line twin that saves nothing is not listed (engineer decision)
### Why
- PR #697 found that the second listed design on the default project is the first one with one gage line at the field splices: the same
  plates, transitions and splices, the same weight and cost. The engineer chose to drop such a twin, so the next distinct design moves up, and
  to keep a 1-gage-line design whenever it actually saves something.
### What changed
- `engine/autodesign.js` `run()`, stage 2 (anchor `const cands = [], rejected = [], blocked = [], twins = []`):
  - new `plSig(L)` (N_b, D, overhangs, splice stations, web plates, flange zones with cut points, widths and thicknesses: everything but the
    gage lines) and `twinOf(c)`: the listed candidate with the same `plSig`, one of the two `minLines` 1 and the other null ("as set"), and the
    same objective value (`key`) and cost within 1e-6 (relative).
  - Before: `if (E.pass && pr.ok) { cands.push({ ...cand(o, E, S, P, det), polished: o.polished || 0 }); continue; }`
  - After: `if (E.pass && pr.ok) { const c = { ...cand(o, E, S, P, det), polished: o.polished || 0 }, k = twinOf(c);`
    `if (k < 0) cands.push(c); else if (c.L.minLines === 1) twins.push(c); else { twins.push(cands[k]); cands[k] = c; } continue; }`
    A twin does not count toward Designs to list (topN), so the loop full-checks the next design of the pool. Whichever of the two passed first,
    the "as set" one is kept. `run()` returns `twins` as well.
- `ui/autodesign.js`: the note under the list says how many 1-gage-line designs were not listed and why (N_b, D of each).
- The "Differs from #1 in" column (#697) is kept.
### §4 callout
- No check, formula or factor changed; the designs listed change (a design that saves nothing is left out). Before / after (Node, `AD.run(P, {})`
  = the app's options, topN 2; the best design's full record hashed):
  - Default project (nb Auto: 5, 6): before #1 N_b 5, D 55 in, 399,699 lb, $1,397,096, as set, TS2 1.000; #2 the same with 1 gage line.
    After #1 the same (hash 445c6bc380cf7a8d both); #2 N_b 5, D 60 in, 399,792 lb, $1,395,877, as set, TS2 1.000; twin left out: N_b 5, D 55, 1 line.
  - "4, 5, 6" (nb Range 4 … 6): before #1 N_b 4, D 72 in, 381,467 lb, $1,301,600, as set, TS7 1.000; #2 the same with 1 gage line.
    After #1 the same (hash dc030090087e4a84 both); #2 N_b 4, D 57 in, 386,042 lb, $1,342,925, as set, TS2 1.000; twin left out: N_b 4, D 72, 1 line.
  - The app (Playwright, the page's own project and options; #697 recorded main's list): before #1 N_b 5, D 67 in, 409,784 lb, $1,427,351, 7 transitions,
    as set, TS2 1.000; #2 the same with 1 gage line. After #1 the same; #2 N_b 5, D 65 in, 411,683 lb, $1,420,299, 6 transitions, as set,
    TS7 1.000, "Differs from #1 in: D 65.00 in; web plates; top flange transitions; bottom flange transitions; transverse stiffener spacing; …";
    the note "1 one-gage-line design not listed … (N_b 5, D 67.00 in)". 0 console errors. (The Node runs start from the bare default project, the
    page from its project after the tabs fill their defaults, hence D 55 there and D 67 here; each compared like with like.)
  - When no other design passes, the list is shorter than Designs to list: Refine on the built-in project, topN 2, now lists 1 (its twin left out).
### Check case
- Default project, Designs to list 2: the list holds two different designs; the note says one 1-gage-line design was not listed.
### How verified
- The runs above, origin/main vs branch. `node tests/engine/run.mjs autodesign` (3 files, 23 passed). `tests/engine/autodesign.test.mjs` "Every candidate passes …" (Refine, topN 2) now also asserts that no
  two listed designs differ only in the gage lines and that each left-out twin has its "as set" design listed. `node tests/check-syntax.mjs`.
### Other copies
- None.

## 2026-11-03 — PR #736: https://github.com/mlococo88/All-Structural/pull/736 (claude/lists-js-node-safe) — `ui/lists.js` loads without a page (Node test harness); fixes the steps-groups-tabs regression from #708   [test/robustness only]
### Why
- On main, `node tests/engine/run.mjs steps-groups` failed 2 tests in `steps-groups-tabs.test.mjs` ("worked steps of every output tab are in
  topics …" and "a report note that says "See §x" does not get a second "see" …"). Both loaded the app's scripts in a Node `vm` context with no
  `document`; `ui/lists.js` (added by #708) touched `document.readyState` at load time and threw `ReferenceError: document is not defined`.
  Same cause for both. The other ui/*.js files (`demands.js`, `graphics.js`) already guard with `typeof document`.
### What changed
- `ui/lists.js`, the last lines of the IIFE (anchor `document.readyState === 'loading'`):
  - Before: `if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();`
  - After: `if (typeof document === 'undefined') { /* no page (Node test harness): nothing to bind */ }`
    `else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();`
  - `window.SBDListsUI` is still exported in both cases. In a browser `document` always exists, so the page behaves as before.
- **Formulas, factors, units, code references, saved data:** none (§4, §5 do not apply).
### Check case
- `node tests/engine/run.mjs report steps steps-groups report-wiring`: before 12 passed, 2 failed; after 14 passed, 0 failed.
### How verified
- The run above; `node tests/check-syntax.mjs`; `node tests/smoke/steel-bridge-report.mjs`; `node tests/smoke/list-input.mjs --part sbridge`.
### Other copies
- None.

## 2026-11-03 — PR: claude/dxf-sheet-inset (PR #754: https://github.com/mlococo88/All-Structural/pull/754) — Drawings: the sheet's outer border 0.25 in inside the paper edge (SBPS-1; display only, no result change)
### Where
- `engine/sheets.js` `sheet()` (anchor `X_().sheetBorder(D, bd, ox, W, H, k);`): before `D.rect(bd, ox, 0, ox + W, H);`, after
  `X_().sheetBorder(D, bd, ox, W, H, k);` (shared/dxf.js: rect 0.25 k inside the sheet's edge). Inner border, title block, drawing area,
  every drawn object and the plot scales are unchanged.
### Governing provision
- None (drawing output).
### Check case
- Default project, papers D and B: 4014 entities, 15 sheets each; origin/main vs branch identical except one entity per sheet, the outer border,
  0.25 k inward (e.g. D sheet at k = 240: (0, 0)-(8160, 5280) → (60, 60)-(8100, 5220) model in).
- `tests/engine/sheets.test.mjs`: the outer-border check changed from 34 k × 22 k to (34 − 0.5) k × (22 − 0.5) k, starting at ox + 0.25 k.
### How verified
- `node tests/engine/run.mjs sheets drawings`, `node tests/smoke/steel-bridge-drawings.mjs`, the display-list comparison (PR).
### Other copies
- shared/dxf.js sheetBorder (fixlog/shared-dxf.md).

## 2026-11-03 — PR: claude/sbd-print-half (PR #755: https://github.com/mlococo88/All-Structural/pull/755) — Drawings: Print sheet / Print all sheets; paper D prints half size on 11 × 17 (SBPS-3; display only, no result change)
Engineer's decisions: print the Drawings sheets from the app (as Spread Footing, Light Pole, #749/#750); for the D sheets (34 × 22), half size on
11 × 17, and the print must say so visibly.
### Where
- `ui/drawings.js` `render()`:
  - Bar, anchor `<button type="button" class="primary" id="dwg_dxf">Download DXF (${sh.length} sheets)</button>`: two buttons follow it,
    `id="dwg_print1"` (Print sheet) and `id="dwg_printAll"` (Print all sheets (n)), then a note: `SharedDxf.PRINT_NOTE` and, on paper D,
    "the sheets print half size on 11 × 17, each at half its stated scale …; choose paper B for 11 × 17 sheets at full scale".
  - Handlers (anchor `/* SBPS-3 (2026-11-03)`): paper B → the previewed B set, `SharedDxf.printSheets(… sheetSVG …, { paper: [17, 11] })`
    (true scale); paper D → `SBDSheets.build(G, RS, { paper: 'D', half: true })`, the 34 × 22 sheets fitted to 17 × 11 (exactly 1/2: same
    proportions).
- `engine/sheets.js`:
  - `sheet()`: SCALE cell before `[24, 'SCALE', scaleName(k)]`, after `[24, 'SCALE', scaleName(k) + (S.half ? ' (HALF SIZE)' : '')]`; the footer
    note gets, with `S.half`, ` HALF-SIZE PRINT ON 11 X 17: THE SCALES SHOWN ARE FOR THE FULL-SIZE ${pw} X ${ph} SHEET; THIS PRINT IS AT 1:${2 * k}.`
  - `build()`: `half: !!opt.half` passed to each sheet. Without `opt.half` (the preview and Download DXF) nothing changes.
### Governing provision
- None (drawing output).
### Check case
- Default project, TYPICAL SECTION AND NOTES on paper D at 3/8" = 1'-0" (k = 32): deck slab 534 × 8 in (girders 0 to 38 ft, overhangs 3.25 ft)
  → full size 16.6875 × 0.25 in; half size 8.3438 × 0.125 in = 600.75 × 9.00 pt. Measured on the printed PDF: 600.75 × 9.00 pt. The scale
  cell reads `3/8" = 1'-0" (HALF SIZE)`. Print all sheets: 15 pages, 17 × 11 in, each with the half-size note.
- `half: true` vs without, paper D: 4014 entities each, same scales; 30 entities differ = the SCALE cell and the footer note of each of 15 sheets.
- Paper B: DECK OVERHANG prints at 3/4" = 1'-0" (1:16), no half-size text.
### How verified
- `node tests/smoke/dxf-print-sheets.mjs --tool sbd` (new entry; the test now opens a tool's Report tab first where the tool prints the open tab:
  `reportOpen`): Report print 317 letter pages, no sheet. `node tests/engine/run.mjs sheets drawings`, `node tests/smoke/steel-bridge-drawings.mjs`,
  `node tests/check-syntax.mjs`.
### Other copies
- None (the print code is shared/dxf.js printSheets, sheetSVG).
### Open items
- On the half-size print the outer border (0.25 in inside the D sheet's edge, #754) is 0.125 in inside the page edge; the inner border 0.25 in
  (0.375 in on the left). The footer note is 0.04 in text at half size (small); the SCALE cell's "(HALF SIZE)" is the readable marker.

## 2026-11-03 — PR: claude/half-print-no-outer-border (PR #756: https://github.com/mlococo88/All-Structural/pull/756) — Drawings: no outer border on the half-size print (SBPS-4; display only, no result change)
Engineer's decision: on the half-size print of the D sheets (paper D, Print sheet / Print all sheets, #755) the outer border (0.25 in inside
the 34 × 22 sheet's edge, #754) lands 0.125 in from the 11 × 17 page edge and printers clip it. Leave it out of the half-size print only;
the inner border (0.25 in from the page edge, 0.375 in on the left) is the visible frame. The D preview, the DXF and paper B are unchanged.
### Where
- `engine/sheets.js` `sheet()` (anchor `X_().sheetBorder(D, bd, ox, W, H, k);`): before
  `X_().sheetBorder(D, bd, ox, W, H, k); D.rect(bd, ox + 0.75 * k, 0.5 * k, ox + W - 0.5 * k, H - 0.5 * k);`, after
  `if (!S.half) X_().sheetBorder(D, bd, ox, W, H, k); D.rect(bd, ox + 0.75 * k, 0.5 * k, ox + W - 0.5 * k, H - 0.5 * k);`.
  `S.half` is set only by `build(G, RS, { half: true })`, which only the Drawings tab's Print buttons on paper D call (ui/drawings.js, SBPS-3).
- `build()` header comment: `opt.half` also leaves the outer border out.
- `tests/smoke/dxf-print-sheets.mjs`, `sbd` entry: `border: 9` (outer border expected at 9 pt) replaced by `frame: { absent: 9, inner: [27, 18, 1206, 774] }`;
  new `frameCheck()` checks every page of Print sheet and of Print all sheets: no rectangle 9 pt from the page edges, the inner border at
  (27, 18)-(1206, 774) pt. Other tools keep the 18 pt outer-border check.
### Governing provision
- None (drawing output).
### Check case
- Half-size print of a D sheet at plot scale k: the page is the sheet scaled 1/2, so 1 sheet inch = 36 pt. Inner border: left 0.75 in × 36 = 27 pt,
  other sides 0.5 in × 36 = 18 pt → (27, 18)-(1224 − 18, 792 − 18) = (27, 18)-(1206, 774) pt. Outer border before: 0.25 × 36 = 9 pt → (9, 9)-(1215, 783) pt; after: none.
- TYPICAL SECTION AND NOTES (default project, k = 32): deck slab 534 × 8 in → 534 / 32 / 2 × 72 = 600.75 pt, 8 / 32 / 2 × 72 = 9.00 pt; measured
  on the printed PDF 600.75 × 9.00 pt (unchanged from #755).
- Display lists origin/main vs branch (default project, no results): paper D 4014 entities, paper B 4014: DXF text, preview SVG and print SVG
  byte-identical. Half-size (paper D, `half: true`): 4014 → 3999 entities (one outer border per sheet, 15 sheets); sheet ids, scales,
  offsets and sizes identical.
### How verified
- `node tests/smoke/dxf-print-sheets.mjs` (all tools; sbd: outer border absent on 1 of 1 and 15 of 15 pages, inner border found on each; the same
  check run against origin/main's sheets.js fails, 2 FAILED), the PDFs rendered and looked at (corner at 300 dpi: one frame line 0.375 in from
  the left and 0.25 in from the top). `node tests/engine/run.mjs sheets drawings`, `node tests/smoke/steel-bridge-drawings.mjs`,
  `node tests/check-syntax.mjs`.
### Other copies
- None. shared/dxf.js sheetBorder is unchanged (the other tools' sheets keep their outer border).
### Open items
- None.

## 2026-11-05 — PR: claude/ghsync-sbapp (PR #823: https://github.com/mlococo88/All-Structural/pull/823) (GHS2: saved projects copied to a private GitHub repository; storage only, no result change)
- **Engineer:** extend GitHub sync (`shared/github-sync.js`; setup `docs/github-sync-setup.md`; own-dialog hooks from PR #815) to the tools with their own project lists.
- **Where:**
  - `index.html`: after `<script src="ui/library.js"></script>`, new `../../shared/projects.js`, `../../shared/projects-ui.js` (only for the settings dialog's style, `SharedProjectsUI.css()`, and the time format) and `../../shared/github-sync.js`. Before `window.SBDLibraryUI.init({`: new `ghIds`, `ghStore`, `GH = SharedGitHubSync.attach({ store: ghStore, storage: LS, open, changed, cloud: { tool: 'steel-bridge-app', label: 'Steel Bridge Design (new app)', toFile: t => t, fromFile } })`, `GH_UI`, `ghCloud`; the init call gets `cloud: ghCloud || null` (anchor `GHS2 (2026-11-05): GitHub sync of the saved-project list`). `GH` is null when browser storage is not available (`store` null).
  - `ui/library.js`: optional `ctx.cloud`. `draw()`: new `gh = !!(C.cloud && C.cloud.on())`; a `GitHub` header cell and `<td>${C.cloud.cell(i)}</td>` per row **only while sync is set up**; at the end `if (C.cloud) C.cloud.after($b())`. `show()`: then `C.cloud.shown()`. Rename: then `C.cloud.renamed(old, new)`; Delete: `say(LIB().remove(...))` → `const r = LIB().remove(...); say(r); … if (r.ok && C.cloud) C.cloud.deleted(it.name);`. New `close()` exported.
- **By-name view (`ghStore`):** `engine/library.js` keeps items by id (`sbd2.lib.index` + `sbd2.lib.p.<id>`, unchanged); the sync works by name, so each name is its newest item (`LIB.list`, newest first). An older item with the same name is not synced; its GitHub cell says "not synced: a newer saved project has the same name". `ghStore.save(name, project)` = `LIB.save` (a new item, or the newest item of that name); `duplicate` = `LIB.duplicate` (conflict copies). Delete / Rename ask about the GitHub copy only when no other item keeps that name.
- **File on GitHub:** `projects/steel-bridge-app/<name>.json` = the stored item text (`M.exportJSON(project)`, the same text as Export JSON; no time stamp in it). **Download (fromFile):** `M.importJSON` (the Import JSON path, legacy files included), `project.name` = the name. **Open** from GitHub: `openSaved(id)` (asks first when the open project has unsaved changes).
- **Home page:** `shared/project-registry.js` entry `steel-bridge-app` with a read-only by-name `view` of the same list (fix log `shared-project-registry.md`).
- **Saved data:** `sbd2.*` keys unchanged. New keys only while sync is set up: `bridgeSuite.v1.githubSync`, `bridgeSuite.v1.githubSync.tool.steel-bridge-app`. With sync off nothing is written and no request is made.
- **How verified:** `node tests/check-syntax.mjs` (all files): pass. `node tests/engine/run.mjs library`: 8 / 8. `node tests/smoke/steel-bridge-library.mjs` (save, save as, open, rename, duplicate, delete, quota, undo): ok, 0 console errors. `node tests/smoke/steel-bridge-wiring.mjs`: ok. `node tests/smoke/github-sync-tools.mjs --tool sbapp`: ALL PASS (Save → file; update with sha; "synced"; a GitHub-only copy opened → the project (without its name) and the output tab text identical; settings button; first-sync offer; Delete asks; sync off: no request, no key; no console errors). origin/main vs branch (sync off), after Save and Export JSON: export text and file name identical; the library item texts, `sbd2.lib.index`, `sbd2.lib.current`, `sbd2.project.current` identical (saved times and ids normalised); 0 requests. `tests/smoke/home-projects.mjs` and `tests/smoke/home-sync.mjs`: ALL PASS with the app included. Screenshot of the dialog with sync on checked.
- **Formulas, factors, units, code references:** none.
- **Other copies:** none.

## 2026-11-06 — PR: claude/sbapp-stds (PR #855: https://github.com/mlococo88/All-Structural/pull/855) (STDS-B) — the standard save: header chip + Undo + Redo + Save + Saved projects…, "Save and open" card, standard dialog, Save as, Ctrl+S (storage and display only, no result change)
- **Engineer:** the standard save (approved 2026-11-05; pattern #836 / #837): header chip · Undo · Redo · Save (Ctrl+S) · Saved projects…; the Project tab's first card "Save and open"; Save as offers This browser and GitHub / This browser only / File; plain Save never prompts; deletes only through the standard dialog; Save as blocks a new duplicate name (existing duplicates are kept).
- **Where (`index.html`):**
  - Script tags: `<script src="ui/library.js"></script>` removed (the app's own dialog is no longer loaded; the file is kept unchanged). The GHS2 comment above `../../shared/projects.js` replaced by the STDS-B comment.
  - Header `#hdrBtns`: before `Save · Save as… · Saved projects… · Undo · Redo · New · Import JSON… · From old app · Export JSON` (+ `#fImport`); after `Undo · Redo` (+ `#fImport`), and projectBar adds the chip before Undo and Save / Saved projects… after Redo. Export JSON, Import JSON (label without "…") and From old app are in `<div id="pbMove" hidden>` and are moved into the card at start-up (`fileButtons`, `extras`); New is projectBar's own. Byline: `AASHTO LRFD 10th Ed. (2024) · <span id="projName"></span> · <span id="saveState">` → `AASHTO LRFD 10th Ed. (2024) <span id="saveState">` (`#saveState` now only shows the autosave failure: `· Autosave failed: browser storage is full. Export JSON now.`; the saved / unsaved state is the chip). `#projName` and its two `textContent` writes removed.
  - `panes()` `proj:` now starts with `card('Save and open', '<div id="pbHost"></div>')`; `drawInputs()` calls `if (pb) pb.mount($('pbHost'));` after the panes are drawn.
  - `syncBar()`: the `#saveState` lines above; `if (window.SBDLibraryUI) window.SBDLibraryUI.refresh();` → `if (pb) { pb.refresh(); pb.dialog.refresh(); }`.
  - `doSave(asNew)`, `guard()`, `openSaved(id)`, the GHS2 `GH` / `GH_UI` / `ghCloud` objects, `SBDLibraryUI.init(…)` and the `bSave` / `bSaveAs` / `bLib` / `bNew` handlers replaced by the STDS-B block (anchor `/* STDS-B (2026-11-06): the standard save`): `ghIds` / `ghStore` (unchanged, the sync's by-name list), `view()`, `vStore`, `pbSave(v)`, `pb = SPUI.projectBar({…})`.
  - Keys: the app's Ctrl+S line removed (projectBar's Ctrl+S / Ctrl+Shift+S); `if (document.getElementById('libDlg').open) return;` → `if (document.querySelector('dialog[open]')) return;` (Undo / Redo keys).
  - Export JSON: the handler body became `function exportFile(Q)` (same download; `Q` = the project; Save as > File passes a copy with the typed name). Import JSON: `B_IM` → `pb.importJSON()` (asks first on unsaved changes), and the file handler's own `guard('import the file')` is removed (asked already).
  - CSS: `body dialog.spLib,#hdrBtns button.spChip[data-sp]{font-family:var(--font-ui);}` (the shared dialogs and chip in the app's UI font).
- **By-name view of the id-keyed list (`vStore`, the dialog's list):** every item of `sbd2.lib.index` is a row. The newest item of a name is listed under the name; an older item with the same name under `<name> (older, saved <Eastern time>)` (`(older copy)` when the index has no time; `#2`… if that text is taken). That text is a list name only: nothing is stored or renamed. Open / Rename / Duplicate / Export / Delete act on that item's id (`LIB.open / rename / duplicate / text / remove`). Rename / Duplicate to a name in use ask "Replace it" (the dialog's question) and then remove the item listed under that name. `keys()` = the index + every item key (storage meter).
- **Save (`pbSave`):** Save on the open project = `LIB.save(LS, P, cur.id)` as before (the project's name field is its list name, as before). If that field now holds the name of another saved project, nothing is saved and the message says to change the name or use Save as (no new duplicate). Save as: a new name = a new item; a name in the list (after "Replace it") = that item, with the project's name set to it. Returns `{ ok, name }` (the list name it saved under).
- **GitHub sync (GHS2, unchanged rules):** `cloud: { tool: 'steel-bridge-app', label, toFile: t => t, fromFile, store: ghStore }`: the sync still works on the newest item of each name (`ghStore`), file = the stored item text. An older same-name row shows "not synced: a newer saved project has the same name (Rename this one to sync it)" in the GitHub column (`ghNote`). Delete / Rename offer to delete the GitHub file only when no other item keeps that name (shared change, `cloud.store`).
- **Unsaved work:** `askUnsaved: 'always'`: Open / New / Import ask whenever the inputs differ from the open saved project (as the app did), also for unsaved work restored from the autosave.
- **Saved data:** no key or format changed (`sbd2.lib.index`, `sbd2.lib.p.<id>`, `sbd2.lib.current`, `sbd2.project.current`, `sbd2.ui`). Old saves (duplicate names included) open. With sync off nothing is written to sync keys and no request is made.
- **Decision (pending engineer review):** (1) the dialog's "Project no." column is gone (standard dialog columns); the number stays in the project. (2) duplicate names already saved are listed with "(older, saved …)" and synced only after Rename. (3) Save with the name field changed to another saved project's name is refused with a message (plain Save never asks).
- **Check case:** two items "Dup" (saved Oct 1 and Oct 2, 2026): dialog rows "Dup" (Oct 2) and "Dup (older, saved Oct 1, 2026, 11:00 AM EDT)"; with sync on only the Oct 2 item is uploaded (`projects/steel-bridge-app/Dup.json`, checker "new"); Rename of the older to "Dup B" uploads `Dup B.json` (checker "old").
- **How verified:** `node tests/smoke/steel-bridge-library.mjs` (rewritten for the standard controls; + duplicate-name and sync step): ok, 0 console errors. `node tests/smoke/github-sync-tools.mjs --tool sbapp`: ALL PASS. `node tests/smoke/steel-bridge-wiring.mjs`: ok. origin/main vs branch (default project, three output tabs, one input change, Save as "AB", Export JSON): output texts, export file name and text, library item text, index (ids / times normalised), `sbd2.lib.current`, autosave and key list identical. Screenshots 1400 / 390 px looked at; no sideways scroll at 390 px.
- **Formulas, factors, units, code references:** none.
- **Other copies:** none.

## 2026-11-06 — PR: claude/sb-remove-ui-library (PR #872: https://github.com/mlococo88/All-Structural/pull/872) (UILIB-DEL) — `ui/library.js` deleted (not loaded since #855; no result change)
- **Engineer:** delete `apps/steel-bridge/ui/library.js` (approved 2026-11-06).
- **What:** the app's own "Saved projects" dialog (`window.SBDLibraryUI`: `init`, `show`, `refresh`, `close`; 57 lines). STDS-B (#855) took its `<script src="ui/library.js"></script>` tag out of `index.html` and kept the file unchanged; the standard dialog of `shared/projects-ui.js` replaced it. The saved list itself is `engine/library.js` (`SBDLibrary`, unchanged).
- **Where:** `apps/steel-bridge/ui/library.js` removed (git history has it: last version as of `9ea00c1`). `index.html`, comments only: the STDS-B comment above `../../shared/projects.js` "ui/library.js (the app's own dialog) is no longer loaded." → "… is no longer loaded and was deleted (2026-11-06)."; `/* ---------- saved projects (engine/library.js, ui/library.js) ---------- */` → `/* ---------- saved projects (engine/library.js) ---------- */`.
- **References checked (grep, whole repo):** no `<script>` tag, test, `shared/README.md` row or doc loads it, and no code reads `SBDLibraryUI`. What remains: older fixlog entries (history), and a comment in `shared/projects-ui.js` ("pattern: apps/steel-bridge/ui/library.js"), left unchanged so that this PR does not touch a shared file. `docs/prestressed-rebuild-plan.md` names a planned `ui/library.js` of the prestressed rebuild, a different file.
- **Saved data (§5):** none; no key read or written by it is used any more (the standard dialog uses the same `sbd2.lib.*` keys through `engine/library.js`).
- **Formulas, factors, units, code references:** none.
- **Check case:** the app opens with 0 console errors; Save as, Saved projects… (Open / Rename / Duplicate / Delete) work as before (steel-bridge-library smoke).
- **How verified:** `node tests/check-syntax.mjs` (94 files): pass. `node tests/engine/run.mjs` parts library, project-registry, model, report-wiring, legacy, handoffs, paths, demandfile. `node tests/smoke/steel-bridge-library.mjs`, `node tests/smoke/steel-bridge-wiring.mjs` (results in the PR).
- **Other copies:** none.
## 2026-11-06 — PR: claude/hdrs-sbapp (PR #905: https://github.com/mlococo88/All-Structural/pull/905) (HDRS) — header: Save and Saved projects… removed (in the "Save and open" card only); the chip opens the Project tab   [display only; no result change]
- **Why:** engineer 2026-11-06: every app's header as in Spread Footing (#884): no Save (Ctrl+S) and Saved projects… buttons in the header; they stay in the "Save and open" card. The header keeps the project chip (click = the Project tab), Undo, Redo, the app's other global actions and Print. Ctrl+S and Ctrl+Shift+S work from anywhere. No "Recent projects" start strip (Spread Footing only).
- **Where:** the `SharedProjectsUI.projectBar({...})` call, right after the line `header: $('hdrBtns'), chipBefore: $('bUndo'), card: true,` (a comment `/* HDRS (2026-11-06, …) */` and one line).
  Before: nothing. After:
  `headerSave: false, chipClick: () => { const t = document.querySelector('#inTabs [data-itab="proj"]'); if (t) t.click(); const c = $('pbHost'); if (c) c.scrollIntoView({ block: 'nearest' }); }, chipHint: 'the Project tab (Save and open)',`
  Uses the projectBar options of `shared/projects-ui.js` (HDRS, #884; `fixlog/shared-projects.md`): `headerSave:false` (the chip only in the header), `chipClick`, `chipHint` (the chip tooltip's "Click: …").
- **Header before:** chip · Undo · Redo · Save · Saved projects…; chip click = Saved projects… dialog. **After:** chip · Undo · Redo; chip click = the Project input tab (its tab button `#inTabs [data-itab="proj"]` clicked; the "Save and open" card first in it, brought into view). The card's buttons are unchanged.
- **Problem:** none (layout request). **Governing provision:** none (§4 does not apply).
- **Check case:** default project, another tab open: click the chip → the Project tab, the "Save and open" card on screen, no dialog; Ctrl+S on another tab (nothing saved yet) → Save as dialog; Ctrl+Shift+S → Save as dialog.
- **How verified:** main vs branch on the default project: every localStorage key (0), page text (33433 chars), Export JSON (7958 chars identical) and the printed report text (print media, 13402 chars) identical (clock times normalised); 0 console errors; chip click → card on screen, no dialog; Ctrl+S / Ctrl+Shift+S → Save as; header at 1280 / 1400 / 1920 / 390 px (390: no sideways scroll), screenshots looked at. `node tests/check-syntax.mjs "apps/steel-bridge/index.html"`; `node tests/smoke/steel-bridge-library.mjs`; `node tests/smoke/github-sync-tools.mjs --tool sbapp`; `node tests/smoke/home-projects.mjs --tool sbapp`: pass. Tests: `steel-bridge-library.mjs` (header = chip · Undo · Redo; new check: the chip opens the Project tab with the card; Save by Ctrl+S; Saved projects… through the chip and the card) and `github-sync-tools.mjs` (sbapp: chip, then the card's Saved projects…).
- **Saved data:** no key or format changed (§5).
- **Other copies:** none. **Open items:** none.

## 2026-11-07 — PR: fix/report-plaintext-tex (PR #1138: https://github.com/mlococo88/All-Structural/pull/1138) — the plain text this tool compares keeps its pre-TXP form (shared/steps.js TXP; no change on screen or in print)
### Where
- `engine/sheets.js` `plain()` (check titles on the drawing sheets). Anchor text: `legacy` next to the call below.
- Before: `oText ? String(s || '').replace(/\$([^$]*)\$/g, (m, q) => S.toText(q)) : String(s || ''); return t.replace(/\$/g, ''); };`
- After: `oText ? String(s || '').replace(/\$([^$]*)\$/g, (m, q) => S.toText(q, { legacy: true })) : String(s || ''); return t.replace(/\$/g, ''); };`
### Problem
- shared/steps.js `toText` (and so `SharedReport.text`) now writes TeX outside the notation subset as readable text (TXP, `fixlog/shared-steps.md`).
  This tool uses that plain text internally (to decide what to copy into its Report, or as a label / note / sheet text); `{ legacy: true }`
  keeps that text exactly as before, so the Report, the labels and the sheets stay as they were.
### Governing provision
- None (display only; no computed value changes).
### Check case
- Default project, origin/main vs this branch, headless: the Report's rendered text (`.rp-doc` textContent) and the page text are identical.
### How verified
- `node tests/check-syntax.mjs`; `node tests/engine/run.mjs`; the headless comparison listed in the PR.

## 2026-11-09 — PR: claude/sb-bracing-dropdown (PR #1254: https://github.com/mlococo88/All-Structural/pull/1254) (BRSEL) — one "Intermediate bracing" drop-down on the Spans & framing tab (input display only; no result change)
- **Engineer (2026-11-09):** "The cross frame input on the Spans & framing tab doesn't allow for a simple rolled diaphragm. There should be a drop-down, and only the input for the cross-frame or the diaphragm should be visible."
- **Where (`ui/framing.js`):**
  - New before `function inputs(P, h) {` (anchor `/* BRSEL (2026-11-09)`): `BRACE` (the options), `isCh(shape)`, `SHP` (WeakMap, session memory of the last shape per family), `braceOf(C)`, `setBrace(P, v)`. Exported: `window.SBDFramingUI = { ensure, braceOf, setBrace, inputs, … }`.
  - `inputs()`: the line `const shapes = [...CF.CF_DIA…, ['custom', 'Custom W']];` replaced by `const br = braceOf(C), dOn = br === 'w' || br === 'ch';` and `const conn = …` (bolt diameter, grade, threads: used by both).
  - Before: card `'Cross-frames: geometry and members'` (`h.sel('crossframes.type', 'Type', [['X', 'X-frame'], ['Kb', 'K-frame, diagonals meet at the bottom chord'], ['Kt', 'K-frame, diagonals meet at the top chord']])`, h, dMinXF, primary, grades, angles, end connections) and card `'Diaphragm in place of the cross-frame'` (`h.sel('crossframes.dia.on', 'Intermediate bracing used', [['no', 'Cross-frame (angles)'], ['yes', 'Diaphragm: channel or rolled W']])` + shape (W, channels, custom), custom d/bf/tf/tw, grade, nb, pitch, ecc, jacking end/Rj/aj).
    After: one card `'Intermediate bracing (6.7.4.2)'`: `h.sel('crossframes.type', 'Intermediate bracing', BRACE, br)` (200 px wide), dMinXF, then for a diaphragm: shape (`CF_CH` only for a channel; `CF_DIA` + Custom W for a rolled W), custom dimensions, grade, End connections (`conn` + nb, pitch, ecc), End diaphragms (bearing lines) (jacking end, R_j, a_j); for a frame: h, primary, grades, angles, End connections (`conn` + n, s, e, tg), note as before.
  - Card `'Member forces from a refined analysis (optional)'`: wrapped in `(dOn ? '' : h.card(…))` (frame only).
  - `onChange()`: first line `if (el.dataset && el.dataset.path === 'crossframes.type' && el.dataset.kind === 'sel') { setBrace(P, el.value); return true; }`.
- **Mapping (saved data, §5: no key or format change):** shown = `dia.on === 'yes'` ? (`dia.shape` in `CF_CH` ? Channel : Rolled W) : `type`. Written: X / Kb / Kt → `type = v`, `dia.on = 'no'`; Rolled W / Channel → `dia.on = 'yes'` (`type` untouched); if the shape's family changes, `dia.shape` = the shape last used in that family in this session, else `cfTypeRec(...).ch` / `.w` (CF10's recommendation), else `MC18x42.7` / `W21x44`. Nothing else is written. Old saves with `dia.on = 'yes'` and any `type` open as the diaphragm, `type` kept.
- **Decision (pending engineer review):** (1) the other family's shape is remembered for the session only (one saved field `dia.shape`); (2) default channel MC18x42.7 when nothing is remembered or recommended; (3) the tab has no `dia.eShape` / `dia.eNb` inputs and none were added; (4) refined-analysis member forces hidden for a diaphragm (used only by CF1–CF9).
- **Formulas, factors, units, code references:** none (§4). No engine file changed.
- **Check case:** default project → drop-down "X-frame"; choose "Rolled W diaphragm" → `dia.on 'yes'`, shape W21x44, `type 'X'` kept, CFD / CFE listed on the Cross-frames tab, CF1–CF9 not; choose "Channel diaphragm" → MC18x42.7 (d = 61.88 in: no channel ≥ 0.75 d is recommended); choose "K-frame (diagonals to the bottom)" → `type 'Kb'`, `dia.on 'no'`, the angles as before. Results identical to origin/main for the same saved data.
- **How verified:** `node tests/check-syntax.mjs`: pass. origin/main vs branch, headless, 7 saves (default X, Kb, Kt, W24x55, C15x33.9, custom W 22 × 7 × 0.5 × 0.4, ambiguous Kt + W21x44): Cross-frames tab text, `SBDFramingUI.build` per girder (checks, DC1 point loads, steps), Report text, saved `crossframes`: identical; 0 console errors. UI script (choices, family round trip W27x84 ↔ C12x20.7, angles kept, Undo / Redo, output tab cards): pass. `node tests/engine/run.mjs` on the 42 steel-bridge engine test files: 243 passed, 0 failed. Smoke steel-bridge-report, -library, -drawings, -graphics, -scroll, -wiring, phone-layout, project-library: pass; steel-bridge-paths and steel-bridge-tabgraphics-b fail the same way on origin/main (pre-existing). Screenshots 1440 / 390 px of each choice, before and after.
- **Other copies:** GirderDetail (`Steel Bridge Design.html`, Cross-frames module) has the same split inputs; not changed (one tool per PR).
- **Open items:** with a diaphragm the Cross-frames tab elevation still draws the angle frame (titled "diaphragm in use") and the truss member-force table (as on main).

## 2026-11-09 — PR: claude/sb-input-tabs (PR #1255: https://github.com/mlococo88/All-Structural/pull/1255) (TABR) — input tabs reorganised (display only; no result, saved key or format change)
- **Engineer (2026-11-09, approved):** reorganise the input tabs; the support skews were on Cross-section & loads and could not be found.
- **New input tabs, in order (`index.html` `TABS`):** Project (`proj`) · Bridge layout (`layout`) · Cross-section (`xsec`) · Girders & plates (`gird`) · Materials (`mat`) · Framing & bracing (`framing`) · Loads (`loads`) · Stiffeners (`stf`) · Fatigue & studs (`fs`) · Splices (`spl`).
  - Bridge layout: card Spans (`spans.continuity`, `#i_spans`); card Support skews (`xs.skews`, moved from Cross-section & loads); card Plan (the framing plan SVG of `ui/framing.js plan()`, drawn by the new `SBDFramingUI.layoutPlan(P)`).
  - Cross-section: card "Girders and overhangs" (was "Girders and deck": `xs.nb`, `xs.bays`, `xs.ohL`, `xs.ohR`); new card Deck (`deck.composite`, `deck.ts`, `deck.tdeck`, `deck.haunch`, `deck.rebar.top/bot.A/c`, `deck.rebarInPositiveMp`, moved from Materials & deck); Deck edges; Sidewalks and median.
  - Materials: Steel (ASTM A709); "Deck concrete and reinforcement" now `materials.concrete.fc`, `wc`, `wcE` (moved from Cross-section & loads), `K1`, `nRule`, `materials.rebar.Fyr`.
  - Framing & bracing: `SBDFramingUI.inputs` without the wind card; card order: Cross-frame layout (with the plan), Intermediate bracing (BRSEL drop-down, end diaphragms, primary members), Flange lateral bending from skew (moved after the bracing card), Stability bracing, Member forces, Weight in DC1.
  - Loads: Wearing surface, forms and steel; Utilities and other line loads; Distribution (`xs.dlMethod`, `xs.lldf.*`); Wind (`crossframes.wind.*`, the new `SBDFramingUI.windCard(P, h)`).
- **Where:**
  - `ui/loads.js`: `function inputs(P, h)` → `function parts(P, h)`, same helpers; `return h.card('Girders and deck', … + … )` → `return { girders, edges, sidewalks, ws, extra, dist, skews, wcE }` (each the same HTML as before; skews and wcE as rows). Exported `parts` in place of `inputs`. `OD_LABEL` (Apply DOT defaults message): tab names Materials (f′c, w_c for E_c), Cross-section (total deck thickness), Loads (wearing surface, dead load distribution).
  - `ui/framing.js`: card `'Flange lateral bending from skew (C6.10.1)'` moved after `'Intermediate bracing (6.7.4.2)'`; card `'Wind on the exterior girder …'` moved to the new `windCard(P, h)`; new `layoutPlan(P)`; exported `windCard, layoutPlan`. Note "Girders, spacings and support skews: Cross-section & loads tab" → "Girders and spacings: Cross-section tab; support skews: Bridge layout tab"; `data-goto="spans"` → `data-goto="framing"`.
  - `index.html`: `TABS`; `panes()` (keys `layout`, `xsec`, `mat`, `framing`, `loads`; `const xsp = UL.parts(…)`); `tabOf` moved out of `markErrors()` and rewritten: the pane that draws the `data-path`, else `TAB_RULES` (`crossframes.wind` → loads, `framing|crossframes` → framing, `spans|xs.skews` → layout, `xs.(ws|overlays|sip|allow|extra|dlMethod|lldf)` → loads, `xs|deck` → xsec, `project|ownerRules` → proj, `girders` → gird, else mat); `data-itgo` links between input tabs (inPanes click handler); "w_c for E_c" alert now names the Materials input tab.
  - Saved UI state (`sbd2.ui`, key unchanged): before `if (ui.itab === 'fr') ui.itab = 'spans';`; after `{ const IT_OLD = { fr: 'framing', spans: 'layout', xs: 'xsec' }; … }` and an unknown value opens Project. `mat`, `gird`, `stf`, `fs`, `spl`, `proj` keep their ids.
  - Text that names an input tab: "Spans & framing" → "Framing & bracing", "Cross-section & loads tab" → "Cross-section tab" in `ui/` (analysis, constructibility, drawings, flexure, gfxa, rating, shear, splices, view3d, welds), `engine/` (framing X4 / no-framing message, constructibility overhang messages, splplace clearance cite; comments in autodesign, splices, tabgraphics-b) and `report/` (builders `brNote`, data comment). `engine/owners.js` "Preliminary sizing: Spans & framing tab" (the old app's tab) and the report section title "Cross-section & loads" are unchanged.
  - Tests: `tests/engine/ownerdef-msg.test.mjs` expects the new tab names ('Loads', 'Materials'), `tests/engine/paths.test.mjs` 'Framing & bracing tab'; `tests/smoke/phone-layout.mjs` gains an `sbapp` entry (the input tabs at 390 and 768 px).
- **Decision (pending engineer review):** (1) an old saved `ui.itab` 'spans' opens Bridge layout (the old tab's first card was Spans), not Framing & bracing; (2) the pedestrian load and the barrier / railing weights stay with the sidewalks and edges on Cross-section; the cross-frame weight in DC1 stays on Framing & bracing (crossframes.*); (3) Field splices (`framing.splices`) stay on Framing & bracing (and on Splices); (4) the plan is drawn on both Bridge layout and Framing & bracing; (5) the tab bar wraps (3 rows at 390 px, 92 px high) as before rather than scrolling sideways.
- **Formulas, factors, units, code references:** none (§4). Pure display reorganisation.
- **Check case:** default project → Bridge layout shows spans 110, 140, 110 ft and skews 0, 0, 0, 0°; Cross-section shows N_b 5, spacings 9.5 ft, overhangs 3.25 ft, deck t_s 8 in; Materials shows f′c, w_c, w_c for E_c; Loads ends with wind V 130 mph. Every result as on main.
- **How verified:** headless origin/main (with BRSEL) vs branch, 3 projects (default; rolled W diaphragm with jacking; skews 30/25/25/30°): every input value and the data-path sets equal (246 paths; each drawn exactly once on the branch), autosaved and exported project JSON byte-identical, every output tab and the built Report: the numbers identical, text differing only in the tab names above. Every input-tab link (`data-itgo`, `data-goto`, `data-goin`, `data-splgo`, `data-cngoin`) lands on its tab; error dots on Materials, Cross-section, Girders & plates and Bridge layout; old `ui.itab` values fr / spans / xs / unknown open framing / layout / xsec / proj; 0 console errors. `node tests/check-syntax.mjs`: pass; `node tests/engine/run.mjs` with the steel-bridge test files: pass; smoke steel-bridge-report, -library, -wiring, -graphics, -drawings: pass; steel-bridge-paths (`#fx_calc` not visible on the second Flexure visit) and steel-bridge-tabgraphics-b (`[data-gfxb="shear"] svg`) fail the same way on origin/main (not changed here); `phone-layout.mjs --tool sbapp`: pass.
- **Open items:** the Report output tab scrolls 91 px sideways at 390 px (on main too; not changed here), so the phone-layout entry covers the input tabs only. (Closed 2026-11-09 by QAP below.)

## 2026-11-09 — PR: claude/sb-autodesign-input (PR #1256: https://github.com/mlococo88/All-Structural/pull/1256) (ADIN) — Auto design input tab (display only; no result, saved key or format change)
- **Engineer (2026-11-09, approved):** move the Auto design SETTINGS out of the Auto design output tab onto a new input tab; the output tab keeps the results; a link between the two.
- **Input tab "Auto design" (`ad`, last in `TABS`):** link "Results: Auto design output tab"; card "Auto design: inputs" (mode, objective, designs to list, change to check, price list, limits, the owner's plate rules note); card "Auto design: design variables" (every sizable input with Auto / Lock / Range, its range / step / station windows, overhang rule and minimum, field splice placement rules); Run / Stop with the progress bar.
- **Output tab "Auto design" (`ad`):** link "Settings: Auto design input tab"; Stop and the progress bar while a run is going; Undo the last Apply; the candidate table and ranking, the selected candidate's plates, details, splice placement table, warnings, Apply, worked steps; Compare; blocked / dropped lists.
- **Where (`ui/autodesign.js`):**
  - Before `render(host, ctx)` drew `inputsHtml(P) + varsHtml(P, AD().settings(P)) + runBar(P)` and the results, and bound every handler. After: `inputs(P)` (input tab HTML: link, `inputsHtml`, `varsHtml`, `runBar`, the run error) and `wire(host, ctx)` (the `[data-ad]`, `[data-adv]`, `#ad_run`, `#ad_stop`, `[data-adout]` handlers, unchanged bodies; a settings change now calls `ctx.changed(true)` so the input tab is drawn again, as the output tab was); `render(host, ctx)` keeps the results and the `[data-adcmp]`, `[data-adsel]`, `[data-adgo]`, `#ad_apply`, `#ad_undo` handlers, plus `[data-adin]` and `#ad_stop2`. `runBar`: Undo moved to the output tab, the progress bar via `bar()`. Exported `{ inputs, wire, render, diffFrom }`.
  - Run (`#ad_run`) also opens the Auto design output tab (`ctx.showOut`); when the run ends both tabs are drawn again (`ctx.done`). Progress updates every `.ad-bar` on the page.
- **Where (`index.html`):** `TABS` + `['ad', 'Auto design']`; `panes()` `ad:` (drawn only while the tab is open); `drawInputs()` calls `SBDAutoDesignUI.wire(…)`; `TAB_RULES` + `[/^autodesign\b/, 'ad']`.
- **Saved data (§5):** unchanged: the settings stay in `P.autodesign` (same fields); `ui.itab` 'ad' is new (an older page never saved it). The result stays in memory for the page view, as before.
- **Decision (pending engineer review):** (1) Run opens the output tab so the progress and the candidates are in view; (2) "Undo the last Apply" is on the output tab, next to Apply; (3) the Auto design input tab is drawn only while it is open (its settings table is long to build).
- **Formulas, factors, units, code references:** none (§4).
- **Check case:** default project, mode Check one change, D = 60 in: the same candidate list and numbers on main (Run on the output tab) and on the branch (Run on the input tab), and the same project after Apply.
- **How verified:** headless origin/main vs branch: all 81 Auto design settings (`data-ad` / `data-adv`) with the same values on the branch's input tab as on main's output tab; the numbers on main's tab = those of the branch's input + output tabs; a full run (Check one change) gives identical result text and the same project after Apply; the Settings / Results links land on the right tabs; plus the PR (a) checks (inputs, project JSON, every output tab) on the default, diaphragm and skewed projects; 0 console errors; a New design run (default project) also gives identical result text and the same project after Apply. `node tests/check-syntax.mjs`: pass; `node tests/engine/run.mjs autodesign` (4 files, 27 tests): pass; smoke steel-bridge-wiring, -library, -scroll --quick (11 input tabs, 73 links), `phone-layout.mjs --tool sbapp`: pass.
- **Open items:** none.

## 2026-11-09 — PR: claude/sb-autodesign-warn (PR #1257: https://github.com/mlococo88/All-Structural/pull/1257) (ADWN) — Auto design: span-to-depth guidance and 6.10.2 proportion limits "as warning only" (changes which candidates Auto design returns; no check result changes)
- **Engineer (2026-11-09):** two checkboxes on the Auto design input tab: "Span-to-depth guidance (AASHTO 2.5.2.6.3) as warning only" (default ON: optional guidance in the code) and "6.10.2 proportion limits as warning only (D/t_w, b_f/2t_f, b_f ≥ D/6, t_f ≥ 1.1t_w, I_yc/I_yt)" (default OFF: mandatory provisions). A ticked limit no longer rejects a candidate; the candidate is ranked and shows an amber WARNING flag naming the limit and the ratio. The Flexure tab's GS1–GS3 are not changed. The governing ratio must not hide the warning.
- **§4 callout — what changes:** which candidates Auto design returns (the search and its rejection rule). No check, formula, factor, unit or code reference changes: AASHTO LRFD 10th Ed. Table 2.5.2.6.3-1 (d_min = 0.033L simple, 0.027L continuous, steel I-beam portion) and Art. 6.10.2.1.1 / 6.10.2.2 (Eq. 6.10.2.1.1-1, 6.10.2.2-1 to -4) are worked and reported exactly as before; the Flexure tab still reports GS1–GS3 FAIL for a 6.10.2 violation.
  - Before: `proportions()` returned `ok: out.every(q => q.ok)`: any proportion limit or the depth rule not met rejected the design (screen, trim and full check); the depth search started at max(L/36 or D_min, 0.027/0.033·L·12 − 2t_f,min) when "Minimum depth" was Applied; a flexure GS1–GS3 ratio > 1.0 in the full check was a failure (dropped).
  - After: `ok: out.every(q => q.ok || q.warn)`, where `warn` = not met and the limit is set to warning only (`S.lim.depthWarn` for `depth`, `S.lim.propWarn` for the 6.10.2 items); `warns` lists them `{ id, label, r, ref }`; the depth search starts at L/36 (or D_min) when the guidance is a warning only (`if (lim.depthRule && !lim.depthWarn) lo = …`); with `propWarn`, `evaluate()` keeps a flexure GS1–GS3 item over 1.0 out of `fails` and out of the governing ratio, in `propW` (and in `modGov`, as the Flexure tab reports it). The candidate's `propWarns` (proportions warns + the worst GS1–GS3 of each id) are shown as the amber flag next to the governing ratio (with the largest warned ratio, so it is not hidden), in the What governs column, and as an amber alert in the candidate's details.
  - Settings (`engine/autodesign.js` DEF.limits, `settings()`): new optional fields `P.autodesign.limits.depthWarn` (absent = true) and `limits.propWarn` (absent = false); no key change; old saves get the defaults. "Minimum depth (Table 2.5.2.6.3-1): Not applied" still skips the depth check altogether.
  - **Worked check case (hand):** simple span L = 100 ft, D = 30 in, flanges 16 × 1 and 18 × 1.5: d_min = 0.033(100)(12) = 39.6 in; D + t_ft + t_fb = 30 + 1 + 1.5 = 32.5 in; ratio 39.6 / 32.5 = 1.218 > 1. Before: rejected. After (default): ok, WARNING "Minimum depth … 1.218"; with the box unticked: rejected as before. Top flange 30 × 1: b_f/2t_f = 30/2 = 15 > 12, ratio 1.25: default (enforced) rejected as before; ticked: listed with WARNING 1.25.
  - **Before/after example (Auto design run):** built-in project (110-140-110 ft continuous, 5 girders), mode Check one change, web depth D = 40 in. d_min = 0.027(140)(12) = 45.36 in > 40 + t_ft + t_fb of the candidate's thinnest pair (42.125 in): ratio 1.077. Before (guidance enforced): "No candidate passes the screen within the limits" (0 candidates). After (default, warning only): 1 candidate, N_b 5, D 40.00 in, 513,301 lb, governing ratio 1.000 (stiffeners TS2) with the amber "WARNING 1.077" and "Minimum depth of the steel I-beam portion … 1.077" in its row and details.
- **Where:** `engine/autodesign.js`: DEF.limits (`depthWarn: true, propWarn: false`), `settings()` s.lim (`depthWarn: L.depthWarn !== false, propWarn: L.propWarn === true`), `proportions()` (`add`: `wo`, the step note, `warn` in the items; return `warns`), `depthList()` (`lim.depthRule && !lim.depthWarn`), `evaluate()` (`PW`, `propW`, the first line of `take`), new `propWOf(E)`, `cand()` (`propWarns`). `ui/autodesign.js`: the two checkboxes under Limits (with the note that the Flexure tab still reports FAIL and the engineer is responsible), checkbox values in the `[data-ad]` handler (`e.target.type === 'checkbox' ? String(e.target.checked) : …`), `wFlag(c)`, `wTxt(c)`, the amber alert in the candidate details, CSS `.ad-warn`, `.alert.ad-wn`, `.ad-ck`.
- **Decision (pending engineer review):** (1) with the span-to-depth guidance a warning only (the default), the depth search is no longer floored by it (else a warned candidate could hardly arise); in New design on the built-in continuous project L/36 = 46.67 in already exceeds the guidance's floor, so its runs are unchanged; on simple spans shallower depths are now searched and may rank first with the WARNING; (2) a warned candidate's governing ratio is that of the enforced checks, and the flag beside it shows the largest warned ratio; (3) settings stored under `P.autodesign.limits` (the Auto design settings object's limits).
- **How verified:** `node tests/engine/run.mjs autodesign-warn` (new: defaults and old saves, proportions hand checks, evaluate with and without propWarn, the D = 40 in before/after run): 4 passed; `node tests/engine/run.mjs autodesign` (the existing autodesign tests, including the recorded parity summary and the built-in New design / Refine runs: 27 passed, results as before); `node tests/check-syntax.mjs`; headless page: checkboxes default on/off, saved on change, a Check one change D = 40 in run shows the WARNING flag (1.077) in the row and the details, 0 console errors.
- **Open items:** none.
## 2026-11-09 — PR: claude/sb-analysis-inputs (PR #1258: https://github.com/mlococo88/All-Structural/pull/1258) (AIN) — analysis inputs moved from the Analysis output tab to the Loads input tab; "Override calculated value" per group; loads and factors used shown read-only on the Analysis tab   [no result change]
- **Engineer:** 2026-11-09: "The Analysis output tab has a lot of inputs that should be moved to an input tab." Decisions A, B, D of the request.
- **Where (UI):** `ui/analysis.js`: `settingsHtml()` (anchor `/* ---------- settings ---------- */`) replaced by `inputs(P, gi)` (Loads input tab cards: Analysis settings `#an-settings`, Dead loads `#an-dead`, Construction live load `#an-cl`, Distribution factors `#an-df`), `onInputChange(el, P, gi)` and `usedHtml(P, gi)` (Analysis tab: girder-line selector `#an_g_line` and the read-only card `#an-used`, each load linked to where it is worked: Loads &amp; LLDF tab (`data-gotab="loads"`), Cross-frames tab, the Analysis steps `an.wst0`, or the Loads input tab). `draw()`: `h += settingsHtml(P, gi);` → `h += usedHtml(P, gi);`; links `[data-gotab]` wired. Input ids and `data-an` / `data-k` attributes are the same as before (ui/lists.js still finds `#an_l_xf`, `#an_a_seqCustom`).
- **Where (page):** `index.html` `panes()`: `loads: … + window.SBDFramingUI.windCard(…)` → `… + window.SBDAnalysisUI.inputs(P, …)`; `#inPanes` change: `SBDAnalysisUI.onInputChange` first; `#inPanes` click: `[data-gotab]` (a link to an output tab); `TAB_RULES`: `analysis.*` and `girders.N.(loadsManual|dfManual|loadsOverride|dfOverride|clOverride)` → `loads`.
- **IM:** shown as entered (blank when not entered) with the placeholder and the source "blank: 33 % (AASHTO LRFD 10th Ed. Table 3.6.2.1-1)", fatigue 15 %. The defaults themselves (`engine/analysis.js` `DEF.im = 33`, `DEF.imf = 15`) are unchanged.
- **Where (engine):** `engine/analysis.js` `loadsOf()`: before `if (A …) girder; else if (M …) module; else if (B …) manual; else none` for DC1wet, DC2, DW, CL, UT, UF and the same for PL; after, for DC1wet, DC2, DW, UT, UF, PL: `if (A …) girder; else if (ov && B …) manual; else if (M …) module; else none` with `ov = deadOverride(g, M)`; CL: `A`, else `B`, else none (unchanged). `dfBase()`: the entered factors `g.dfManual` are used only when `dfOverride(g, rgOk)`; with the module and the override on, an entered factor (> 0) replaces the module's for every span (pier g_M: entered, else the entered span g_M, else the module's). New `deadOverride(g, M)`, `dfOverride(g, modOk)`: the saved flag, else (absent) `!M && some entered value`. Explicit girder factors (`g.df`) keep the entered g_Δ as before.
- **Saved data (§5):** paths unchanged (`P.analysis.*`, `girders[i].loadsManual`, `girders[i].dfManual`). New optional `girders[i].loadsOverride`, `girders[i].dfOverride` (true | false). Migration default (absent): on exactly when the loads module gives none and a value is entered, so every saved project computes as before. Cross-frame point loads: always from the framing; a stored `loadsManual.xf` stays (shown, with a note) only while the project has no framing, as before. `engine/model.js` header documents the fields.
- **Text only:** warnings / reasons that said "Analysis settings" now say "Loads tab" (`engine/analysis.js`, `engine/legacy.js` note, `deflOwner` `swHow` 'entered (Loads tab, Analysis settings)'; `tests/engine/sidewalk-override.test.mjs` updated to the text).
- **Formulas, factors, units, code references:** none changed (§4 does not apply).
- **Check case:** default project, G1 (cross-section G2): Loads tab, Dead loads: tick "Override calculated value", DC2 = 0.4 → Analysis: DC2 0.4000 klf "entered (override)", DC1 wet 1.1652 and DW 0.2075 klf "calculated"; untick → DC2 0.2505 klf (module). A project whose loads module gives none (no girder spacing) with DC1wet 1.1, DC2 0.25 entered opens with the box ticked and the same results.
- **How verified:** main vs branch (`analyzeGirder` every station array, reactions, LL/fatigue envelopes, camber, M_DCc, and the Constructibility ratios): default project, a skewed (35°) 4-span 100-130-120-90 ft project with two girders, the default project with stored manual loads/factors (module works: ignored, as before), and one with manual loads/factors where the loads module gives none and no framing: all identical. New `tests/engine/analysis-overrides.test.mjs`. 0 console errors.
- **Other copies:** none.

## 2026-11-09 — PR: claude/sb-construction-ll (PR #1259: https://github.com/mlococo88/All-Structural/pull/1259) (CLC) — construction live load calculated, w_CL = q_CL × b_trib; optional finishing machine; old projects unchanged   [RESULT CHANGE for new projects: §4 callout]
- **Engineer:** 2026-11-09, decision C: "There is a lot of input on loading that the app should be able to calculate itself." The construction live load was the only analysis load entered by hand.
- **Where:** `engine/analysis.js`:
  - `loadsOf()` CL: before `A.CL`, else `loadsManual.CL`, else 0. After: `A.CL`; else `loadsManual.CL` when `girder.clOverride` is on (absent: on when a value is entered); else `clOf(P, M).w` when `P.analysis.clCalc === true`; else 0.
  - New `clOf(P, M)`: q_CL = `P.analysis.qCL`, else the owner rule `cll` (CTDOT BDM V2 3.17CT, 50 psf), else `CL_PSF` = 20 psf. b_trib = `SBDLoads.girder().trib`. w_CL = q_CL/1000 × b_trib.
  - New `fmOf(P, mod, j)`: the finishing machine, a pair of P_fm loads at e_fm from each deck edge. The lever-rule share is P_j. In `analyzeGirder()`, a moving point load P_j on I_s (`ML().analyze`, one 1-kip axle, no lane, no IM). At each station the sign that adds to M_DC1 + M_CL,u (V likewise) is added to `st.CL`, and the largest reaction is added. `st.CLu` keeps the uniform part for its statics check. `pick()` was hoisted out of the live-load block, unchanged.
  - Steps added: `an.CL.q`, `an.CL.w`, `an.fm.Pj`, `an.fm.M.s<k>`. Warning when q_CL is below the owner minimum (`cll.min`).
- **Other files:**
  - `engine/model.js`: `defaultProject()` gets `analysis: { clCalc: true }`. The header documents `clCalc`, `qCL`, `fm` and `girders[i].clOverride`.
  - `ui/analysis.js`: the Construction live load card (Calculate box, q_CL, the derivation, Override box, entered klf) and the Finishing machine card. The Analysis tab shows the CL source and links to the steps.
  - `ui/constructibility.js`: the demand line shows the calculated w_CL and links to its derivation.
- **§4 callout:**
  - **Load:** construction live load on the girder line, used in the deck placement checks GS14–GS16 (γ construction 1.50 × η).
  - **Before:** w_CL = 0 unless entered.
  - **After (new projects):** w_CL = q_CL/1000 × b_trib.
  - **Basis:** AASHTO LRFD 10th Ed. Art. 3.4.2.1 requires construction loads at the Strength limit state but gives **no specific value**. q_CL = 20 psf is a *Decision (pending engineer review)*: this app's existing overhang-bracket construction load (`OH_DEF.qCL` 0.020 ksf, from GirderDetail's Deck overhang module). CTDOT BDM V2 3.17CT gives 50 psf (owner rule `cll`) and its minimum (`cll.min`).
  - **Distribution:** b_trib is the tributary deck width (loads module, step `dl.Gj.trib`).
  - **Finishing machine:** lever rule, AASHTO LRFD 4.6.2.2.1.
- **Check case (default project, G1 on cross-section girder G2, interior):**
  - b_trib = (9.5 + 9.5)/2 = 9.50 ft. w_CL = 20/1000 × 9.50 = **0.190 klf** (before 0). Statics ΣR = 0.190 × 360 = 68.40 kip.
  - M_CL max 0 → 338.1 kip-ft.
  - Constructibility: the governing GS14 at x = 77 ft goes 0.7866 → 0.7579. f_bu + f_ℓ/3 rises 7.384 → 7.461 ksi and φF_nc rises 9.388 → 9.844 ksi: the nonprismatic unbraced length (6.10.8.2.3c) sets F_e from the governing section's stress.
  - Pier region (x = 250 ft, bottom flange): 0.4807 → 0.5570. x = 110 ft: 0.4719 → 0.5441.
  - Exterior girder (G1): b_trib = 3.25 + 9.5/2 = 8.00 ft, w_CL = 0.160 klf, GS14 0.6204 → 0.5987.
  - CTDOT: q = 50 psf, w = 0.475 klf (interior).
- **Finishing machine check:** P = 3 kip each, e = 1 ft:
  - a = 3.25 − 1 = 2.25 ft outside G1. G1 takes 3(1 + 2.25/9.5) = 3.7105 kip and G2 takes −0.7105 kip.
  - Simple span 100 ft, G1: M = 3.7105 × 25 = 92.76 kip-ft added at midspan (plus wL²/8 = 0.16 × 100²/8 = 200.0).
- **Saved data (§5):** new optional `analysis.clCalc`, `analysis.qCL`, `analysis.fm`, `girders[i].clOverride`.
  - A project saved before has no `clCalc`, so it is not calculated: w_CL stays 0, or the entered `loadsManual.CL`, which stays as the override. Results are identical (checked below).
  - A legacy import (`engine/legacy.js` `fromParts`) resets `P.analysis` as before. GirderDetail's construction LL arrives as `loadsManual.CL`, as before.
- **Decisions (pending engineer review):**
  1. 20 psf default when the owner gives none.
  2. Old projects are not switched to calculated (the box is on the Loads tab).
  3. The finishing machine is a pair of equal loads, one per overhang, moving together. Lever-rule shares include the uplift share on the first interior girder. The effect is taken with the sign that adds to the deck placement effect.
  4. The overhang bracket checks (OH1–OH5) keep their own q_CL and P_fm inputs on the Constructibility tab. They are not fed from these to keep their saved values. To unify on request.
  5. DC2, DW and utilities were already calculated by the loads module (barriers/curbs, wearing surface, cross-section added loads) whenever the cross-section is complete. Where it gives none, the cross-section is incomplete and nothing can be calculated, so no new DC2/DW/UT calculation was added.
- **How verified:** main vs branch on the projects listed in the PR:
  - identical for every project saved before (default and skewed 4-span without `clCalc`; the manual projects);
  - for new projects, only M_CL / V_CL / R_CL and the constructibility ratios that use them differ.
  - New `tests/engine/construction-ll.test.mjs` (hand checks above). 0 console errors.
- **Other copies:** none.

## 2026-11-09 — PR: claude/sb-autorun (PR #1260: https://github.com/mlococo88/All-Structural/pull/1260) (AUTO) — an output tab runs itself when selected; inputs changed while open re-run it after 600 ms; Re-run button; Drawings calculated girder by girder   [display only; no result change]
- **Engineer:** 2026-11-09: "Whenever I select a new output tab I have to press the button to re-run. Can it just be set up so that when an output tab is selected it just automatically re-runs?"
- **Where:** `index.html`:
  - The block `/* AUTO (2026-11-09 … */` before `drawOut()`: `AUTO_BTN` (each tab's own Calculate button: sec/loads `#bCalc`, flex `#fx_calc`, shear `#sh_calc`, an `#anCalc`, fat `#fa_calc`, cn `#cn_calc`, spl `#sp_calc`, rt `#rt_calc`, wt `#wt_calc`, dwg `#dwg_calc`), `autoRun()`, `autoWatch()` and `autoMsg()`.
  - The old `drawOut()` was renamed `drawOut0()`; the new `drawOut()` = `drawOut0(); autoRun();`.
  - A MutationObserver on `#out` handles a tab's own redraws.
  - `#autoBar` holds the status (spinner, "Inputs changed — updating…", "Calculating…") and the **Re-run** button `#bRerun`.
  - The tab bar and the `goto` links set `autoNow` (run at once).
- **Rule:**
  - When the tab draws itself as out of date (its own check: the project, girder and its choices against its last run), its button is pressed for the user. This happens at once on selecting the tab, and after 600 ms of quiet after an input change.
  - A tab that is up to date is not re-run.
  - A run that leaves the tab out of date (an error) is not repeated until the project or the tab's choices change (`autoLast`, the content key).
  - **Manual:** Auto design (its Run on the Auto design input tab) and the Report (Build). The 3D view has no calculation.
- **Drawings:** `engine/sheets.js` gets `resultsAsync(P, G, onStep)`: `results()` one plate girder at a time, with a timer between girders. It makes the same calls, in the same order, with the same memo. `ui/drawings.js` calculates through it (`calcAsync`) and shows "Calculating… girder i of n".
- **Slow tabs (> 2 s on the default project):** Flexure 6.0 s, Shear 6.2, Fatigue 6.4, Analysis 6.1, Field splices 6.2, Rating 6.2, Welds 6.0, Drawings 6.7, when it is the first tab to run the girder analysis. The others then take it from the shared analysis cache, 0.1–0.7 s. Constructibility takes 0.4 s; Section and Loads under 0.1 s.
  - A spinner is painted before the run starts.
  - The one girder analysis is a single computation and cannot yield inside it without an engine change. The Drawings yield between plate girders.
- **Tests (app right, tests stale):**
  - `tests/smoke/steel-bridge-paths.mjs` failed on main: it pressed `#fx_calc` on the second Flexure visit, when the tab is up to date and the button hidden (the app correctly runs nothing). It also expected the Welds sources `['analysis', 'file']`, but the custom-demands PR (2026-11-01) added 'custom'. Now: select the tab and wait (`settle()`); the options are `['analysis', 'custom', 'file']`.
  - `tests/smoke/steel-bridge-tabgraphics-b.mjs` failed on main: its double-click "fit" at the graphic's top-left landed on the sticky output tab bar (two rows of tabs since the Auto design and 3D tabs), which opened the Field splices tab, so the shear graphic was gone. Now: double-click below the tab bar.
  - `steel-bridge-graphics`, `-wiring`, `-drawings` wait for the tab to run instead of pressing its button.
- **Formulas, factors, units, code references, saved data:** none changed. The same results come from the same button and code path. The Drawings results from `resultsAsync` equal those of `results()` (default project, JSON compared, identical).
- **Check case:** default project.
  - Open Flexure: "Calculating…" appears, then the results, with no button press (6.0 s).
  - Open Shear: results in 0.5 s.
  - Back to Flexure: nothing runs (one analysis in the cache).
  - Change f′c to 4.5 on Materials: "Inputs changed — updating…", then Flexure runs again (6.2 s).
  - Re-run: runs again.
## 2026-11-09 — PR: claude/sb-advars-dialog (PR #1262: https://github.com/mlococo88/All-Structural/pull/1262) (ADVD) — Auto design input tab: the design variables (and the field splice placement rules) open in a dialog; the panel shows a summary   [display only; no result or saved-data change]
- **Engineer:** 2026-11-09: "Can the auto design design variables open in a pop-up window? It currently doesn't fit in the available width of the input panel."
- **Where:** `ui/autodesign.js`.
  - `varsHtml(P, s)` was split. `rowsHtml(P, s)` holds the former row-building code, unchanged. `varsTableHtml(P, s)` is the table plus `splRulesBox()`, drawn in the dialog. `summaryHtml(P, s)` is in the panel: one line per group ("Flanges: 5 Auto, 1 Locked"), a chip per variable that opens the dialog at its row, "Edit design variables…" (`#ad_vars_edit`), and the splice-rules line with "Edit…".
  - New `dlg()`, `fill()`, `openVars(go)` (exported). `CUR` holds the last `{ P, ctx }` of `wire()`. `wire()` refreshes an open dialog after every redraw (an edit, Undo, Redo) and wires `[data-advgo]`.
  - CSS: `.ad-sum`, `.ad-chips`, `.ad-chip`, `dialog#adVarsDlg` (min(1100 px, 90vw), 90vh, scrolling inside; full screen at ≤ 700 px), `#adVarsDlg .ad-vars{min-width:760px}` (the table scrolls sideways inside the dialog on a phone).
- **Dialog:** a native `<dialog>` opened with `showModal()`. Escape closes it, the page behind is inert (focus trapped), Close returns the focus to the Edit button. The inputs keep their `data-adv` / `data-ad` attributes, and `setAdv` / `setAd` write `P.autodesign.vars` / `.splRules` exactly as the panel's handlers did. Each change calls `ctx.changed(true)` (one Undo step), live, with no Apply.
- **Links to a variable:** each chip (`data-advgo="<id>"`) opens the dialog with that row highlighted and its mode focused. "Edit…" of the splice rules (`#spr`) opens the rules. Today `SBDModel.validate` reports no error at `autodesign.vars.*` (checked), so there is no error marker to point there; `openVars(id)` is exported for one.
- **Check case:** default project, Auto design input tab.
  - Chip "Web thickness t_w: Auto" → the dialog opens with that row highlighted and its select focused.
  - In the dialog: t_w Lock; D Range 54–72; shipping piece length 110 ft. Project JSON (localStorage) byte-identical to the same edits made in the panel on main (8274 chars).
  - Undo removes the last edit in both.
  - At 390 px the dialog is full screen (390 × 844) with no page horizontal scroll; at 1440 px it is 1100 px wide.
- **Formulas, results, saved data:** none changed (§4, §5).
- **How verified:** `node tests/check-syntax.mjs`; smoke `phone-layout` (input tabs at 390 px), `steel-bridge-*`; screenshots in the PR.
## 2026-11-09 — PR: claude/geomxfer-sender (GXF-2) — "Send to Substructure Loading" with Geometry and Reactions: the new superGeometry hand-off and per-project copies of both channels   [no result change; saved data: new hand-off keys only]
- **Why:** engineer decisions 2026-11-09 (new channel `superGeometry`, Steel Bridge app → Substructure Loading; "All hand-offs should be per
  project"; sent copies through GitHub when Cloud sync is on). Spec: HANDOFF.md §4.14 and §5.1 (PR GXF-1, `shared/handoff-store.js`).
- **Where:**
  - `ui/handoffs.js`: new `sgSection(P, X)` and `sgPayload(P)` (anchor `function sgPayload(P) {`), exported on `window.SBDHandoffs` with `GEO`.
    The card's row (anchor before: `data-ho="srSend">Send reactions to Substructure Loading</button>`) is now
    `data-ho="subSend">Send to Substructure Loading</button>` with the boxes `data-ho-opt="geo"` (Geometry) and `data-ho-opt="rx"`
    (Reactions), both ticked by default (kept while the page is open, not saved), and `data-ho="subFile"` Export hand-off (JSON).
    `onClick` before: `if (a === 'srSend' || a === 'srFile') { const r = srPayload(P); … }` (publish `superReactions`, copy
    `.by.girderdetail`, alert); after: `if (a === 'subSend' || a === 'subFile') { subSend(P, a === 'subFile'); return false; }`.
    New `subSend(P, file)` (anchor `async function subSend(P, file) {`): builds every ticked channel first (nothing is sent when one
    fails), adds the optional envelope field `device` (the Cloud sync device name, when set), publishes each with `BridgeXfer.publish`,
    writes its `.by.<id>` copy (`superGeometry.by.steelbridge`; `superReactions.by.girderdetail`, as before), then
    `SharedHandoffStore.send` (per-project copy `bridgeSuite.v1.<channel>.by.steelbridge.<project id>` and, with Cloud sync, the upload to
    `handoffs/<channel>/steelbridge/<project id>.json`). Export: one file per ticked channel (each with `producedAt`).
  - `index.html`: `<script src="../../shared/handoff-store.js"></script>` after `shared/github-sync.js`.
- **Payload (`sgPayload`, inputs only, no analysis):** spans and continuity; per support `id`, `x`, `skew` (as entered: + = the right end of
  the support line, looking ahead station, is ahead; from `engine/framing.js` `xb = sup + (y_i − y_c)·tan θ` with y from G1 to Gn),
  `joint` (abutments `end`; piers `continuous`, or `joint` for simple spans), `depth` (deepest segment touching the station on any plate
  girder); `girders` { count = `xs.nb`, `xs.bays`, `xs.ohL`, `xs.ohR` }; `edges` through `SBDLoads.edgeIn` (width = the traffic-face
  distance the live load uses); `deck` { ts, total = tdeck, haunch }; `section` { largest total depth D + t_top + t_bot, largest b_f, t_f,
  t_w (each on its own), `atSupports`, `spanMax` }; `ownerRules` (as the reactions); `contentHash` = `SharedHandoffStore.geometryHash`;
  checked with `SharedHandoffStore.checkGeometry` before sending.
- **Check case (default project):** spans 110–140–110 ft continuous; supports Abut. 1 (0 ft, end, 61.875 in), Pier 1 (110, continuous,
  63.5), Pier 2 (250, continuous, 63.5), Abut. 2 (360, end, 61.875); skews 0; 5 girders at 9.5 ft, overhangs 3.25 / 3.25 ft; barriers
  1.5 ft (traffic face 1.5 ft), height not sent; deck 8 in (total 8.5), haunch 2 in; section: positive region 60 + 0.75 + 1.125 =
  61.875 in, pier region 60 + 1.5 + 2 = 63.5 in → depth 63.5, b_f max(16, 18) = 18, t_f 2, t_w 0.5625. Picker summary "3 spans,
  110–140–110 ft, 5 girders". Project id `~New steel bridge`.
- **Results:** none change: `sgPayload` reads the inputs only (Node test: the project JSON and the DC1 reactions are identical after it);
  the reactions payload is built by `srPayload` exactly as before.
- **Saved data (CLAUDE.md §5):** the project format is unchanged. New hand-off keys only: `bridgeSuite.v1.superGeometry`,
  `.updatedAt`, `.by.steelbridge`, `bridgeSuite.v1.superGeometry.by.steelbridge.<project id>`, `bridgeSuite.v1.superReactions.by.steelbridge.<project id>`
  (and `bridgeSuite.v1.handoffStore.pending` while sync is set up). The keys written before (`superReactions`, `.updatedAt`,
  `.by.girderdetail`) are written as before, so Substructure Loading's current Pull keeps working.
- **Decisions (pending engineer review):**
  1. `project.bridgeId` is blank (the app has no Bridge ID field); the per-project id is then the project name alone.
  2. Barrier height is not sent (the app has no barrier height input; the drawings' 34 in is a drawing default). Curb height and the
     railing load point are sent for a curb edge, not as a barrier height.
  3. No project name → no per-project copy (only the latest hand-off, listed by the receiver as "earlier hand-off (no project)").
  4. Geometry and Reactions boxes are not saved with the project (both ticked each time the page opens).
- **How verified:** `node tests/engine/run.mjs` (3 new tests in `handoffs.test.mjs`: default bridge hand values; curb edge, simple spans,
  signed skews, a deeper pier segment, refusals; no change to the project or its results); new `tests/smoke/geometry-handoff.mjs`
  (sender: nothing on load, both boxes ticked, both channels' keys and per-project copies identical to the published payload, Geometry
  alone, no project name → no per-project copy; 0 console errors); steel-bridge smoke tests.
- **Other copies:** none.

## 2026-11-09 — PR: claude/sb-splice-custom (PR #1263: https://github.com/mlococo88/All-Structural/pull/1263) (SPERR) — Field splices: a Calculate that ends in an error shows the message instead of leaving the tab "out of date"   [display only; no result change]
- **Engineer:** 2026-11-09: "I tried entering custom values in the field splice tab but nothing happened when I press Calculate."
- **Where:** `ui/splices.js`, `render()`, anchor `stale = !S.R || S.key !== key(ctx)`.
- **Before:**
  `const P = ensure(ctx.P), g = P.girders[ctx.g] || P.girders[0], stale = !S.R || S.key !== key(ctx);`
- **After:**
  `const P = ensure(ctx.P), g = P.girders[ctx.g] || P.girders[0], stale = (!S.R && !S.err) || S.key !== key(ctx);   // SPERR: …`
- **Problem:** `calc()` sets `S.err` and leaves `S.R = null` when `build()` returns an error. `render()` counted every state without `S.R` as out of date, and shows `S.err` only when not out of date, so the error never showed: the "out of date … Calculate" bar stayed and pressing Calculate changed nothing on screen. With the output-tab auto re-run (#1260) the status also stayed on "Calculating…". It happened for every error that `build()` returns for the whole girder:
  - Demands "Custom (entered)" with an empty table ("No rows entered") or a row error (a row without x, two rows at one x, x outside the girder, a cell that is not a number);
  - no field splice stations;
  - an analysis error;
  - a calculation exception.
  The error is now shown under the bar. Present since the Field splices tab was added (the same line since #616); not caused by #1255–#1260.
- **Not changed (inputs checked, all bound and used):** every entered plate field (top / bottom flange: lines, g, g₀, rows, s, e_f, e_p, b_o, t_o, inner, b_i, t_i; web: h, t, rows, s_v, cols, s_h, e_w, e_wp), the design basis, bolts and clearances, and the Custom demand cells each change the result after Calculate and are saved.
- **Governing provision:** none (display); AASHTO LRFD 10th Ed. 6.13.6.1 calculations unchanged.
- **Check case:** default project, Field splices tab, Demands "Custom (entered)", table empty, Calculate.
  - Before: the bar "Splice results are out of date … Calculate" stays and nothing else is shown.
  - After: "Custom demands: No rows entered: enter the Field splices demands in the Custom table (or paste them from Excel)."
  - Then a row x = 82, M_DC1 = 500, V_DC1 = 50, M_LL+ = 1000, M_LL− = −1000, V_LL = 80: FS1 checked, governing DT3 1.000, the same before and after. With M_DC1 = 2500: governing TF3 (Con) 1.315, the same before and after.
- **How verified:** new `tests/smoke/steel-bridge-splices.mjs`:
  - On main it fails at the first Calculate: the tab stays out of date.
  - With the fix it passes: the error messages are shown; M_DC1 changes FS1; each of the 44 entered plate / bolt / basis fields changes the FS1 result and is saved. 0 console errors.
  - Also `tests/check-syntax.mjs`; engine tests `splices`, `custom-demands`, `handoffs`; smoke `steel-bridge-wiring`, `-paths`, `-tabgraphics-b`, `-report`.
- **Other copies:** the same `stale = !S.R || S.key !== key(ctx)` line with `if (S.err && !stale)` is in `ui/flexure.js`, `ui/shear.js`, `ui/fatigue.js`, `ui/rating.js`, `ui/welds.js` and `ui/constructibility.js`. Not changed here (open item 1).
- **Open items:**
  1. The same hidden-error pattern on the other output tabs listed above. To fix on request.
  2. With "Plates and bolts: Entered below", a station without an entry is **not** auto-designed: `engine/splices.js` `girder()` runs `autoDesign` only when `S.auto && !I.own`. Such a station uses the module's built-in plates (`DEF`), and the list labels it "auto". The Splices tab note says "A station without an entry is auto-designed". Changing either changes results or wording; engineer to decide.
  3. With "Entered below", the Splices tab gives no way to add a row except "Keep these plates" on the output tab ("None entered.").
  4. The entered plate inputs have no `data-kind="num"`, so they are saved as text ("4", not 4). The engine reads both the same (`num()` / `+`; checked in Node on every field: the same checks and ratios). Left as is; no saved-format change.

## 2026-11-09 — PR: claude/sb-splice-addrow (PR #1269: https://github.com/mlococo88/All-Structural/pull/1269) (SPADD) — Splices input tab: "+ Add splice station" for entered plates   [input only; no result change; no saved-format change]
- **Follows:** SPERR (PR #1263), open item 3: with "Plates and bolts: Entered below" the Splices tab showed "None entered." and a row could only come from "Keep these plates" on the Field splices output tab.
- **Where:** `ui/splices.js`:
  - new helpers before `function inputs(`: `AD` (a WeakMap, girder object → Map(x → auto-designed p), page memory only), `near`, `girderOf`, `hasRow`, `platesAt`;
  - `inputs(P, h)` → `inputs(P, h, ui)` (index.html already passes `ui`); under the entered-plates table, anchor `${rows || '<tr><td colspan="34">None entered.</td></tr>'}</tbody></table></div>`, the new `${add}` control: a station select `#i_spladd` (the stations of the girder chosen on the Girders tab without an entry) and the button `+ Add splice station` (`data-spladd`); the × button of each row (`data-spldel`, unchanged) gets a title "Remove this row"; the card's note names both controls (its last sentences unchanged);
  - `onClick(e, P)` → `onClick(e, P, ui)` (index.html already passes `ui`): `[data-spladd]` pushes `{ x, g: gi, top, bot, web }` to `P.splices.plates`;
  - `calc()`: after a run without error, `if (R.girder) { … if (q.design && q.p) m.set(+q.x, q.p); … AD.set(R.girder, m); }` (remembers the plates the tab auto-designed).
- **Before:** `function inputs(P, h) {` … `${rows || '<tr><td colspan="34">None entered.</td></tr>'}</tbody></table></div>`);` and `function onClick(e, P) {` with only `[data-splgo]` and `[data-spldel]`.
- **After:** see the code at the anchors (comment `SPADD`). The new row's prefill, in order: the plates the Field splices tab last auto-designed for that station of that girder (this page view); else the plates of the tab's last run of that girder; else GirderDetail's built-in plates (`engine/splices.js` `DEF.top`, `DEF.bot`, `DEF.web`).
- **Saved data:** the row is the format "Keep these plates" already writes (`engine/model.js`: `plates: [ { x, g, top, bot, web } ]`, numbers and `inner` true/false). No new key, field or format.
- **Not changed:**
  - A station without an entry is calculated as before (SPERR open item 2: with "Entered below" it uses the built-in plates; the note's "A station without an entry is auto-designed" and the list's "auto" label are unchanged, for the engineer to decide).
  - The entered plate inputs keep no `data-kind` (saved as text when edited, SPERR open item 4). With `data-kind="num"` an edited plate field of an existing project would be saved as a number (4, not "4") and a cleared field as null instead of "": a change to the saved format of existing projects, so it is left as is. The engine reads text and numbers the same (`num()` / `parseDim`).
- **Governing provision:** none (input control); AASHTO LRFD 10th Ed. 6.13.6.1 calculations unchanged.
- **Check case:** default project (auto-design on).
  - Field splices tab: FS1 at 82.00 ft auto-designed, "auto: 50 bolts each side".
  - Splices input tab, "Plates and bolts: Entered below": "None entered." and "Add a row for G1 [FS1 at 82.00 ft]  + Add splice station".
  - + Add splice station: the row "82.00, G1" with the auto-designed plates; saved `{ x: 82, g: 0, top, bot, web }`; Field splices FS1: "entered: 50 bolts each side", the same governing check and ratio as the auto-design; FS1 no longer offered in the select.
  - × on the row: "None entered." again; FS1 back on the built-in plates, as before.
  - New page, no run yet: + Add splice station gives the built-in plates (top: 2 lines, g 3, g₀ 3, 3 rows, s 3, e_f 1.75, e_p 1.75, outer 16 × 0.5, inner 6.5 × 0.625).
- **How verified:** new `tests/smoke/steel-bridge-splice-addrow.mjs` (the steps above, the saved row's keys and types, an edited t_o saved and changing FS1, 0 console errors). Also `tests/check-syntax.mjs`; engine tests `splices`, `autodesign-splices`, `custom-demands`, `handoffs`, `report`, `paths`, `tabgraphics-b`; smoke `steel-bridge-splices`, `-paths`, `-tabgraphics-b`, `-wiring`, `-report`.
- **Open items:** SPERR open items 2 and 4 stand.

## 2026-11-09 — PR: claude/sb-tab-errors (PR #1268: https://github.com/mlococo88/All-Structural/pull/1268) (SPERR2) — Flexure, Shear & stiffeners, Fatigue & studs, Rating, Welds and Constructibility: a Calculate that ends in an error shows the message instead of leaving the tab "out of date"   [display only; no result change]
- **Follows:** SPERR (PR #1263), open item 1: the same hidden-error line on the other output tabs.
- **Where:** `render()` of `ui/flexure.js`, `ui/shear.js`, `ui/fatigue.js`, `ui/rating.js`, `ui/welds.js`, `ui/constructibility.js`, anchor `stale = !S.R || S.key !== key(ctx)`; and `ui/flexure.js` `calc()`, anchor `const I = inputs(ctx); if (I.err) { S.err = I.err;`.
- **Before (each of the six files):**
  `stale = !S.R || S.key !== key(ctx)`
- **After (each of the six files):**
  `stale = (!S.R && !S.err) || S.key !== key(ctx)` with the comment `// SPERR2: a run that ended in an error is current (its message shows), not out of date` at the end of that line.
- **Before (`ui/flexure.js` `calc()`):**
  `const I = inputs(ctx); if (I.err) { S.err = I.err; return; }`
- **After:**
  `const I = inputs(ctx); if (I.err) { S.err = I.err; S.key = key(ctx); return; }   // SPERR2: the key of the run, so its error shows`
- **Problem:** as SPERR: each tab's Calculate sets `S.err` and leaves `S.R = null` when the run returns an error, and `render()` counted every state without `S.R` as out of date and shows `S.err` only when not out of date. The error never showed; the "out of date … Calculate" bar stayed, and with the output-tab auto-run (#1260) the status stayed on "Calculating…" / "Inputs changed — updating…". On the Flexure tab the input errors (`inputs()`: Custom table errors, no hand-off file, a missing script) also returned before `S.key` was set, so that tab needed the key as well. Cases: Demands "Custom (entered)" with an empty table or a row error; "Hand-off file" with no file chosen; an analysis error; a calculation exception; the Rating tab's errors from the Flexure / Shear Custom tables.
- **Results:** unchanged. The new condition differs from the old one only when `S.R` is null and `S.err` is set (a run that ended in an error); with valid inputs `S.R` is set and `S.err` is empty, so `stale`, the results and the graphics are drawn exactly as before. `S.key` is used only for `stale`.
- **Governing provision:** none (display).
- **Check case:** default project; on each tab, Demands "Custom (entered)", Custom table empty, Calculate (or the auto-run).
  - Before: the bar "… results are out of date … Calculate" stays and nothing else is shown.
  - After:
    - Flexure: "Custom demands: No rows entered: enter the Flexure demands in the Custom table (or paste them from Excel)."
    - Shear & stiffeners: "Custom demands: No rows entered: enter the Shear & stiffeners demands in the Custom table (or paste them from Excel)."
    - Fatigue & studs: "Custom demands: No rows entered: enter the Fatigue & studs demands in the Custom table (or paste them from Excel)."
    - Rating: "Flexure (Custom table of the Flexure tab): Custom demands: No rows entered: enter the Flexure demands in the Custom table (or paste them from Excel)."
    - Welds: "Custom demands: No rows entered: enter the Welds demands in the Custom table (or paste them from Excel)."
    - Constructibility: "Custom demands: No rows entered: enter the Constructibility demands in the Custom table (or paste them from Excel)."
  - Back to the tab's first demand source: the same results as before.
- **How verified:** new `tests/smoke/steel-bridge-taberrors.mjs` (each tab: default results, empty Custom table → message shown, not out of date, status not "Calculating…", back to results; 0 console errors). On main it fails at the first tab (Flexure stays out of date); with the fix it passes. Also `tests/check-syntax.mjs`; engine tests `flexure`, `shear`, `fatigue`, `rating`, `welds`, `constructibility`, `splices`, `custom-demands`, `handoffs`, `report`, `paths`, `gfxa`, `tabgraphics-b`; smoke `steel-bridge-splices`, `-paths`, `-tabgraphics-b`, `-wiring`, `-report`.
- **Other copies:** none left in `apps/steel-bridge/ui/` (`ui/splices.js` was fixed in SPERR).
- **Open items:** SPERR open items 2 and 4 stand (open item 3 was fixed in SPADD, PR #1269).
## 2026-11-09 — PR: claude/sb-summary-tab (PR #1271: https://github.com/mlococo88/All-Structural/pull/1271) (SUMT) — Summary output tab, first in the output tab bar   [display only; no result or saved-data change]
- **Engineer:** 2026-11-09: "There is no Summary output tab, we need to add one."
- **Where:**
  - New `report/summary.js` (`window.SBDSummary`, no DOM): `MODS` (run order), `COLS` (the columns), `run(P, gi, k)` (one module of one girder: `SBDReportData.compute(P, gi, { src: 'tabs', want: { [k]: true } })`), `cells(P, gi, parts)` (the module results through `SBDReportBuild.model(B, { detail: 'gov' })`, the Report's own governing rows; each column = the governing row of its group(s)), `overall(P, list)` (counts, governing check), `grpStat`, `weight(an)`.
  - New `ui/summary.js` (`window.SBDSummaryUI`): the tab (`render`), the run (`start`: one module of one girder per timer tick, progress "Running Flexure and rating, G1 (2/8)…"), the links (`gotoCell`, `focus`: the tab's own row-selection attribute from the Report key's scope, then `SharedSteps.reveal` of the step, the card and the step flashed).
  - `index.html`: the tab button `data-otab="sum"` first in `#tabBar`; the two `<script>` tags; `drawOut0()` branch `if (ui.otab === 'sum')` (anchor `Summary tab (ui/summary.js, 2026-11-09`), with `goto(tab, gi)` (sets `ui.g`, redraws the inputs) and `report()` (Report tab, scope "Every girder").
  - `ui/autodesign.js`: new export `lastWarns(P)` (the WARNING flags `c.propWarns` of the last run not applied), read only.
  - `report/builders.js` `summary()` and `allModel()`: one note each, "…: the [[tab:sum|Summary tab]]" (the Report already had a Summary section first, so it links to the tab; brief item 6).
- **Columns (each the module's own governing value, exactly):** Flexure Strength I (GS5–GS10), Service II (GS12, GS13), proportions (GS1–GS4, GS22): the Flexure tab's checks over every location split by id, the same rule as `engine/flexure.js` `govern()`; their largest is the Flexure tab's governing ratio. Shear (web panels; GS11, GS16, GS18), Stiffeners (transverse, bearing), Fatigue (FA, GS17), Studs, Constructibility, Cross-frames, Field splices, Welds, LL deflection (SA3), Rating Inventory / Operating RF: the Report's governing groups.
- **Status:** FAIL: ratio > 1.0 or RF < 1.0. REVIEW: a ratio that is not a number, or a module item with a Warning status (Welds TR4, a cross-frame warning, deflection over the owner's preferred limit). The governing check: the largest ratio that is a number (cells whose ratio is not a number listed apart as "Not evaluated").
- **Decisions (pending engineer review):**
  - Demands: this project's analysis, or Custom where a tab has "Custom (entered)" chosen (saved, `P.demandSrc`). A hand-off file or the Example chosen on a tab for the page view, and the Flexure tab's "6.10.8 only" choice, are page-view choices private to those tabs and are not used (said on the tab).
  - Flexure split into three columns (Strength I, Service II, proportions) so that a GS1–GS4 governing ratio is not hidden in "Strength".
  - Rating: RF < 1.0 counts as FAIL (Inventory and Operating).
  - Welds / cross-frames: a Warning item makes the cell REVIEW; its value stays the governing ratio.
  - The default output tab of a new browser stays Section properties (a first open does not start the full run); Summary is first in the bar.
  - "Re-run all" runs every module again from the shared analysis cache (keyed by the project state, so it cannot be out of date).
  - Girder steel: Σw_s ℓ of each plate girder from its analysis (DC1 girder steel with the detail allowance; the same expression as the Analysis tab's step `eq.DC1steel`, linked §); the total is the sum of the plate girders listed.
  - Girder elevation: the Report's summary figure (`engine/tabgraphics-b.js` `summary`, plate segments and the governing checks), for the girder selected on the Girders & plates tab.
- **Formulas, factors, units, code references, saved data:** none changed (§4, §5). UI state only: `ui.otab` may be `'sum'`; old values open their tab.
- **Check case:** default project, Summary tab: 7–9 s to "Up to date"; FAIL; 3 FAIL, 1 REVIEW, 10 PASS; governing Flexure Strength I, G1, x = 249.99 ft, GS7 1.229 (the Flexure tab's governing ratio); Inventory RF 0.61, Operating RF 0.79 (Rating tab). Cell "Shear" 0.437 → Shear & stiffeners tab, station x = 110.01 ft selected, step `sh.ok` flashed.
- **How verified:** `tests/engine/sb-summary.test.mjs` (default project and a skewed three-span two-girder project: every cell `Object.is` the module's own value from each tab's `build()`); `tests/smoke/steel-bridge-summary.mjs` (links, cache, re-run, the Report link, old `ui.otab`, 390 px, 0 console errors); `node tests/check-syntax.mjs`; smoke `steel-bridge-*`, `phone-layout`, `project-library`.
- **Other copies:** none.
## 2026-11-09 — PR: claude/sb-deflection-tab (PR #1274: https://github.com/mlococo88/All-Structural/pull/1274) (DEFL) — Deflection output tab: the live-load deflection check and the dead-load deflections and camber gathered on one tab after Analysis; Report "Deflection" section; Analysis keeps a one-line summary   [display only; no result, saved key or format change]
- **Engineer:** 2026-11-09: "The Steel Bridge Design app should have an output tab for deflection."
- **Where:**
  - New `apps/steel-bridge/ui/deflection.js` (`window.SBDDeflectionUI = { render, model, summary }`): the whole tab. `model(R)` takes the analysis result `R` (engine/analysis.js `analyzeGirder`): `R.lld` per span, `R.camber` components, the tenth points by `SBDSheets.tenths` / `SBDSheets.at` (as the Drawings' camber table), the largest total per span (as step `an.camber.s<k>`). Nothing is calculated except D/C = Δ_LL / Δ_lim (the ratio the Analysis tab already showed).
  - `index.html`:
    - `<script src="ui/deflection.js"></script>` after `ui/analysis.js`;
    - tab button `<button type="button" role="tab" aria-selected="false" data-otab="defl">Deflection</button>` right after `data-otab="an">Analysis</button>`;
    - `AUTO_BTN`: `an: '#anCalc',` → `an: '#anCalc', defl: '#df_calc',` (the #1260 auto-run presses the tab's Calculate; the analysis comes from the shared cache, `report/data.js install()`);
    - `drawOut0()`, after the `ui.otab === 'an'` line: `if (ui.otab === 'defl') { window.SBDDeflectionUI.render($('out'), { P, g: ui.g, setG: gi => { ui.g = gi; ui.seg = 0; saveUi(); drawInputs(); markStale(); } }); return; }` (the girder selector sets `ui.g`, as the Girders & plates tab's `i__g`).
  - `ui/analysis.js` `resultsHtml()`:
    - Diagrams: the "Dead-load deflections" chart (`Dser`) removed (now on the Deflection tab).
    - The card `Live load deflection (SA3, …)` (anchor `if (R.lld) { const O = R.lld[0] && R.lld[0].own, ST = {`) replaced by a card "Deflection" (`id="an-defl"`) with one line: largest Δ_LL/Δ_lim, largest camber, link `data-gotab="defl"` (`SBDDeflectionUI.summary(R)`).
    - Station table: the "Dead-load deflections" view (`D: [['Δ steel', …`) removed; a note links to the Deflection tab.
    - Worked steps: `groups('x', R.steps)` → `groups('x', R.steps.filter(q => !/^an\.(defl\.|camber)/.test(q.id)))` (those steps are on the Deflection tab, same ids).
    - Export: `window.SBDAnalysisUI = { …, chart }` (the tab's diagram reuses the Analysis chart).
    - Loads input tab, Analysis settings note: "…; the LL deflection limit, the sidewalk choice and the cracked zones also by the Deflection tab."
  - `report/builders.js`: `SECTIONS` gets `['defl', 'Deflection']` after `['an', 'Analysis']`; new `defl(B, X)` (LL deflection table by span with g_Δ, per-lane value, governing case, Δ_LL, limit, D/C, status; the limit and loading notes; the dead-load diagram; the largest total per span; the tenth-point table, every station with detail "all"; the `an.defl.*` / `an.camber.*` worked steps). The SA3 summary row (`X.gov.push(… 'an.defl.LL' …)`, unchanged text, group "Analysis: SA3 live-load deflection") moved from `an()` into `defl()`, so its place in the summary is unchanged. `an()`: the sub "Live load deflection (SA3, 2.5.2.6.2)" replaced by a note linking `[[an.defl.LL1]] [[an.camber.s1]]` and the Deflection tab; its worked steps without `an.defl.*` / `an.camber.*`. With a hand-off file: "Not in this report" (as Field splices). Without `ui/deflection.js` / `engine/sheets.js` loaded (some Node tests), no Deflection section and Analysis keeps every step.
  - `report/builders.js` `govLL(A, X)`: the SA3 summary row (the old line, unchanged) made once, by `defl()`, or by `an()` when `ui/deflection.js` / `engine/sheets.js` are not loaded (then `an()` also keeps its old "Live load deflection (SA3, 2.5.2.6.2)" table: some Node tests load only part of the app).
  - `report/data.js` `compute()`: `on('an') ||` → `on('an') || on('defl') ||` (the analysis is run for the Deflection section alone).
- **What the tab shows (girder selector at the top):**
  1. Live load deflection, per span: L, x of the largest value, g_Δ, Δ per lane, governing case (truck alone or 25 % truck + lane, as the engine keeps it), Δ_LL+IM, Δ_lim = L/r, D/C, PASS / FAIL (or the owner's preferred-limit warning, or "reported, not checked" for an exterior girder under the owner rule). The limit and why (owner rule OWN19 with the sidewalk choice and where it comes from — Cross-section sidewalks or the Loads tab override — or, with no owner rule, the entered L/… of 2.5.2.6.2). The g_Δ source with a link to the Loads & LLDF tab (or the Loads input tab when entered or pulled). Per span: Δ_lim, Δ_LL and D/C worked symbolically → substituted → result, each § linking to the engine step on the tab.
  2. Dead-load deflections and camber: diagram (steel + cross-frames, wet deck, DC2 + DW, utilities when present, total), the largest total per span (§ to `an.camber.s<k>`), table at the tenth points of each span or at every analysis station.
  3. What is included / not included (stiffness of each stage, cracked zones per the Loads setting, haunch in the stiffness; not: deck placement sequence, future utility allowance, construction loads, pedestrian load, creep/shrinkage, settlements, vertical profile, CTDOT OWN33 extra camber).
  4. Worked steps: the engine's `an.defl.*` and `an.camber.*` steps (same ids, same values), in the Analysis topics.
- **Formulas, factors, units, code references, saved data:** none changed. `engine/analysis.js` is not touched. `ui.otab` gets one more value, `'defl'` (the existing key `sbd2.ui`); old values open as before; a page from before this change shown `'defl'` falls back to Section properties. No project field added.
- **Decisions (pending engineer review):**
  1. Tenth points that fall between analysis stations (spans whose rounded length is not a multiple of 10 ft, e.g. 105 ft) show the value linear between the two stations, as the Drawings' camber table (`SBDSheets.at`), marked "*"; "Every analysis station" lists the engine values. On the default project every tenth point is a station (exact engine values).
  2. The two LL deflection cases (truck alone; 25 % truck + lane) are not shown side by side: the shared engine (`shared/moving-load.js deflection()`) keeps only the larger at each section with its label. Showing both needs an engine output change (not done).
  3. With no owner rule (AASHTO), the sidewalk choice does not switch the limit to L/1000 (the engine uses the entered L/…, 2.5.2.6.2 optional criterion); the tab says so and tells the user to enter 1000. Not changed (§4/§9).
  4. The vertical profile: this app has no profile input; the tab says the camber excludes it. CTDOT's extra camber (OWN33) is listed as not applied.
  5. The girder selector changes the app's girder (`ui.g`), the same as the Girders & plates tab selector (there is no per-tab girder elsewhere in this app).
  6. The SA3 summary row keeps module "Analysis" and group "Analysis: SA3 live-load deflection" (the every-girder summary groups by it).
- **Coordination:** the Summary tab (#1271, SUMT) merged first. Here, `report/summary.js` `COLS`: `{ id: 'defl', …, tab: 'an', what: 'SA3' }` → `tab: 'defl'`, so the Summary's "LL deflection" column and the left panel's Deflection chip open this tab, and its focus finds the step `an.defl.LL<k>` here (same id). The Summary value is unchanged: the SA3 row comes from the report model as before (now built in `defl()`; without `ui/deflection.js` loaded, `an()` makes it as before). `SBDDeflectionUI.summary(R)` gives `{ top (largest D/C span row), cm (largest camber), ok }` for other callers. The tab shows a Calculate error under the bar (the SPERR pattern: `stale = (!S.R && !S.err) || S.key !== key`).
- **Check case:** default project (AASHTO, 110-140-110 ft continuous, girder G1, cross-section girder G2), Deflection tab:
  - LL: g_Δ = 0.510 every span. Span 1: Δ_lim = 12(110.00)/800 = 1.650 in; Δ_LL = 0.510 × 1.004 = 0.512 in at x = 49.5 ft (HL93-Truck s=14); D/C = 0.512/1.650 = 0.310, PASS. Span 2: 12(140.00)/800 = 2.100 in; 0.510 × 1.373 = 0.700 in at 180.0 ft; D/C 0.334, PASS. Span 3 as span 1 (x = 310.5 ft).
  - Camber at midspan (0.5L): span 1 x = 55 ft 0.254 + 1.127 + 0.220 = 1.601 in; span 2 x = 180 ft 0.280 + 1.332 + 0.287 = 1.899 in; span 3 1.601 in. Largest per span: 1.702 in at 45 ft, 1.899 in at 180 ft, 1.702 in at 315 ft (steps an.camber.s1–s3).
  - The same numbers before and after: the Analysis tab before showed span 1 Δ_LL 0.512, L/800 1.650, ratio 0.31; span 2 0.700, 2.100, 0.33 (same engine values).
- **How verified:**
  - New `tests/engine/deflection-tab.test.mjs`: on the default project and a skewed (35°) three-span project (105-150-105 ft, RIDOT, sidewalk "yes": L/1000; cracked zones 15 %) every tab value equals the engine's (`R.lld` fields, `R.camber` arrays, `SBDSheets.at` at every tenth point and the engine value where it is a station, the `an.camber.s<k>` and `an.defl.*` step values); the report's Deflection section follows Analysis, its values are the engine's, every analysis step appears once (Deflection or Analysis), every reference resolves (also with Deflection or Analysis left out).
  - New `tests/smoke/steel-bridge-deflection.mjs`: the tab after Analysis runs on selection; every table number equals `SBDAnalysis.analyzeGirder` of the page's project; one diagram line per component + total; every § link has its step; the Analysis one-line summary and link; the girder selector; saved `ui.otab` 'an', 'sec', an unknown value and 'defl' (reload); the Report section; 390 px: no page-level sideways scroll, tables scroll in their cards; 0 console errors.
  - `tests/engine/report.test.mjs`, `report-wiring.test.mjs`: the files list gets `engine/sheets.js`, `ui/deflection.js`; section count 13 → 14 (and 10 → 11 with three left out).
  - Also `tests/check-syntax.mjs`; engine tests `deflection-tab`, `report`, `report-wiring`, `steps-groups-tabs`, `tex`, `gfxa`, `drawings`, `sheets`, `paths`, `analysis-overrides`, `ped-owner`, `sidewalk-override`, `simple-span`; smoke `steel-bridge-deflection`, `-paths`, `-tabgraphics-b`, `-wiring`, `-graphics`, `-drawings`, `-report` (its section count 13 → 14), `-library`, `-scroll --quick` (16 output tabs), `-taberrors`, `-splice-addrow`, `phone-layout`, `project-library`: all pass, 0 console errors. After merging the Summary tab (#1271): `sb-summary`, `deflection-tab`, `report`, `steps-groups-tabs`; smoke `steel-bridge-summary`, `-deflection`, `-report`, `phone-layout` pass. `steel-bridge-wiring` fails at the Constructibility f_ℓ step (`{"shown":""}`, `undefined !== 1.5`) on origin/main 1d9670b as well (not this change; it passed here before that merge): open item for the Summary tab PR.
- **Open items:** decisions 1–3 above.
## 2026-11-09 — PR: claude/sb-summary-dash (PR #1272: https://github.com/mlococo88/All-Structural/pull/1272) (DASH) — left check summary column, from 1200 px   [display only; no result or saved-data change]
- **Engineer:** 2026-11-09: "Maybe it's a left-justified summary panel with links to the sections each card is summarizing." Built after the Summary tab (SUMT), with the same data.
- **Where:**
  - New `ui/dash.js` (`window.SBDDashUI`: `init(o)`, `refresh()`): the column `#sbDashCol`.
  - `index.html`: `<aside id="sbDashCol">` first in `#main` (anchor `DASH (2026-11-09): the check summary column`); its CSS (anchor `DASH (2026-11-09): the left check summary column`); `<script src="ui/dash.js">`; `drawOut()` also calls `SBDDashUI.refresh()`; new `gotoOut(tab, gi)` (was the Summary tab's inline `goto`, unchanged); `SBDDashUI.init({ el, store, getP, ui, goto: gotoOut })` after the first `calc()`.
  - `ui/summary.js`: `sync()` keeps the last results (`S.prev`, shown out of date by the column) and notifies; `state().prev`; `start()` returns while a run is in progress (the run covers every module not yet run); `gotoCell(gi, id, cx)` takes the caller's `{ P, goto }`; a chip of a module not run focuses its card once run (`S.pendFocus`); `focus()` stops when another tab was chosen since; new export `sync`.
- **Layout:** from 1200 px the column is at the far left (left of the input panel), 240 px wide (280 px from 1500 px); the input panel keeps a third of the rest: `calc((100% - 240px)*.33)`, as Light Pole. At 1200 px: column 240, input panel 317, output 643 px; at 1440 px: 240 / 396 / 804 px. « shrinks it to a 42 px strip (vertical title and counts). Below 1200 px nothing changes (`display:none`; the input panel 33 %). Not printed.
- **Content:** header: verdict (FAIL / REVIEW / PASS), counts, "max D/C", the governing check (a link). One chip per module group (Flexure, Shear, Stiffeners, Fatigue, Studs, Constructibility, Cross-frames, Field splices, Welds, Deflection, Rating): governing value and girder over every girder, PASS / FAIL / REVIEW; ▸ the value of each girder and column. A chip opens its output tab with that girder selected and scrolls to and flashes the card (and step) that works the value. A module not run shows "not run"; its chip runs it and opens its tab (which runs itself, #1260). "Run all" runs every module.
- **Decisions (pending engineer review):**
  - Collapse key `sbd2.dashCollapsed_v1` ('1' shrunk, '0' open): the app's own `sbd2.*` prefix (engine/model.js: "localStorage keys sbd2.* only") rather than `steelbridge_…`; UI state only, not in the project or the export.
  - After an input change the column keeps the last values, marked "out of date" (italic, faded), with "Run all"; it does not re-run everything after each edit (the girder analysis blocks the page for several seconds per girder). The Summary tab, when open, re-runs as before.
  - The column is placed at the far left as in the other apps (the input panel stays next to the output); the output area at 1200–1440 px is 643–804 px.
  - The Deflection chip opens the Deflection tab (DEFL, #1274), through the Summary column's tab.
- **Formulas, factors, units, code references, saved data:** none changed (§4, §5). New UI key only (above).
- **Check case:** default project, 1440 px: 11 chips "not run"; Shear chip → Shear & stiffeners tab, G1, station x = 110.01 ft card flashed, chip 0.437 · G1 PASS; Run all → header "FAIL · max D/C 1.229", Governing: Flexure, Strength I, G1: D/C 1.229; Rating chip RF 0.61 · G1 FAIL.
- **How verified:** `tests/smoke/steel-bridge-dash.mjs` (layout at 1199/1200/1440/1600 px, chips equal the Summary's data, links and flash, out of date, collapse key across a reload, print, 0 console errors); `tests/smoke/steel-bridge-summary.mjs`; `node tests/check-syntax.mjs`; smoke `steel-bridge-*`, `phone-layout`, `project-library`.
- **Other copies:** none.



## 2026-11-09 — PR: claude/sb-equal-spacing (PR #1270: https://github.com/mlococo88/All-Structural/pull/1270) (EQSP) — Cross-section: "Equal spacing" option, girders equally spaced from the exterior girder spacing   [new input mode; no result change for existing projects; saved data: two optional fields]
- **Engineer (2026-11-09):** "I want a quicker way to space the girders. Rather than typing in each spacing, allow an option to set the exterior girder spacing and then allow the girders to be equally spaced."
- **Engineer's definition (2026-11-09, not a pending decision):** the input is the exterior girder spacing W_cc, centreline to centreline of the two exterior girders (ft); S = W_cc / (N_b − 1), N_b − 1 = the number of bays. The overhang / deck-edge inputs stay as they are. (The old Preliminary sizing had the same "exterior" mode, `bridge.Wcc`, read by `engine/legacy.js fromPL`.)
- **Saved data (CLAUDE.md §5):** two optional fields in `xs`, no key change, no migration needed:
  - `xs.spMode`: `'individual'` | `'equal'`; absent = `'individual'` (every existing project, and a new project, which does not write it);
  - `xs.Wcc` (ft), used only in `'equal'`.
  In Equal mode the page writes S into every entry of `xs.bays`, the array the engine, framing, drawings, hand-off and report already read, so nothing computed reads the new fields (except the report's worked S).
- **Where:**
  1. `engine/model.js`: new `equalSpacing(xs)` (anchor `function equalSpacing(xs)`), exported on `window.SBDModel`; `validate()` after the anchor `nn(x.ohL, \`${xp}.ohL\`, 'Left overhang'); nn(x.ohR, \`${xp}.ohR\`, 'Right overhang');` adds:
     `if (x.spMode != null && !['individual', 'equal'].includes(x.spMode)) E(\`${xp}.spMode\`, …);`
     `if (x.spMode === 'equal') pos(x.Wcc, \`${xp}.Wcc\`, 'Exterior girder spacing (℄ to ℄ of the exterior girders)');`
     `equalSpacing`: `S = ok && isFinite(Wcc) ? Wcc / (nb - 1) : NaN`, `bays: new Array(nb - 1).fill(S)`, step id `xs.eqS`, `S = \frac{W_{cc}}{N_{b} \minus 1}`.
  2. `ui/loads.js` `parts()`, card "Girders and overhangs". Before:
     `${h.num('xs.nb', 'Number of girders N<sub>b</sub>', '')}${list('xs.bays', 'Girder spacings', 'left to right')}`
     After:
     `${h.sel('xs.spMode', 'Girder spacing', [['individual', 'Individual spacings'], ['equal', 'Equal spacing']], x.spMode === 'equal' ? 'equal' : 'individual')}${h.num('xs.nb', …)}${x.spMode === 'equal' ? equalRows(P, h) : list('xs.bays', 'Girder spacings', 'left to right')}`
     New `equalRows(P, h)`: the W_cc input, the worked step (symbolic → substituted → result), "S must be positive" alert, the LLDF range warning (reuses `SBDLldf.RANGE.S`, 3.5 ≤ S ≤ 16.0 ft, Table 4.6.2.2.2b-1, the Loads & LLDF tab's existing range check; no new check), the deck width out to out oh_L + W_cc + oh_R.
  3. `ui/loads.js` `onChange()`: `xs.spMode` (to Equal: `W_cc = Σ bays` rounded to 1e-6 ft, then the bays recomputed; to Individual: the bays kept as editable entries), `xs.Wcc` (recompute), `xs.nb` (after its existing resize: recompute in Equal mode), `xs.ohL` / `xs.ohR` in Equal mode only (set as the page does, then redraw the deck width shown). Individual mode: unchanged.
  4. `report/builders.js` `loads()`: in Equal mode only, a first sub-section "Girder spacing (girders equally spaced)": N_b, W_cc, overhangs, deck width and the worked step `xs.eqS`.
- **Governing provision:** none (geometry input). No formula, factor, unit or code reference changed. The LLDF range limit shown is the existing one (AASHTO LRFD 10th Ed. Table 4.6.2.2.2b-1, `engine/lldf.js RANGE.S`).
- **Check case (hand):** N_b = 4, W_cc = 40 ft, overhangs 3.25 ft: S = 40 / (4 − 1) = 13.333 ft; bays 13.333, 13.333, 13.333 ft; deck width = 3.25 + 40 + 3.25 = 46.50 ft (the same as before the change for that geometry). Built-in cross-section: N_b = 5, Σ bays = 4 × 9.5 = 38 ft → switching to Equal gives W_cc = 38, S = 38 / 4 = 9.5 ft, the bays unchanged. W_cc = 60 ft, N_b = 4: S = 20 ft > 16 ft → the LLDF range warning.
- **Readers of the spacings (all read `xs.bays`, unchanged):** loads / LLDF (`engine/loads.js fromModel`), framing and cross-frames (`engine/framing.js modelOf`), the cross-section drawing and graphics, the geometry hand-off to Substructure Loading (`ui/handoffs.js`: `spacings: xs.bays`, `ohL`, `ohR`), auto design (`engine/autodesign.js projectWith`: keeps the out-to-out width, so an Equal project stays consistent), the report and the summary.
- **How verified:**
  - new `tests/engine/equal-spacing.test.mjs`: hand cases; `validate()` gives the same result with and without the new fields; the loads / LLDF / range results of an Equal project = those of an Individual project with the same spacings entered (deep equal).
  - new `tests/smoke/steel-bridge-equal-spacing.mjs`: default Individual; Equal from Σ bays; N_b and W_cc recompute; worked S and deck width on screen; the Loads & LLDF, Analysis, Flexure and Cross-frames tab texts identical to an Individual project with the same spacings; back to Individual keeps the bays; W_cc = 0 error; S > 16 ft warning; 0 console errors.
  - main-vs-branch probe (every output tab text incl. the report, three projects: built-in, unequal bays, N_b = 6 with 25° skews): identical; the built-in project saves identical text.
  - `tests/check-syntax.mjs`; steel-bridge engine and smoke suites (see the PR).
- **Other copies:** none.
- **Open items:** none.
## 2026-11-09 — PR: claude/sb-summary-gfx (PR #1275: https://github.com/mlococo88/All-Structural/pull/1275) (GFXS) — Summary tab: cross-section and framing plan graphics   [display only; no result or saved-data change]
- **Engineer:** 2026-11-09: "the Summary output tab must also show the cross-section graphic and the framing plan graphic", reusing the app's own drawing functions, near the top, side by side from about 1200 px and stacked on a phone, each with a link to the tab where it is drawn and edited. This is a follow-up to #1271.
- **Where:** `ui/summary.js`:
  - New `xsSvg(P)` and `gfxCard(P)` (anchor `GFXS (2026-11-09`), called in `paint()` after the verdict card (anchor `h += gfxCard(P);`).
  - The click handler takes `[data-sumin]` and the plan's own `[data-itgo]` links: input tabs, through `ctx.inTab`.
  - New CSS: `.sum-gfx`, `.sum-g1`, `.sum-gbox`.
  - `index.html`: the Summary ctx gets `inTab(t)` (selects an input tab).
- **Drawing functions called (no drawing code copied):**
  - Cross-section: `SBDDrawings.model(P)` + `SBDDrawings.section(G, D, { k })`, the typical cross-section that `engine/sheets.js` draws on its Drawings sheet. It is previewed with `SBDGraphics.tightSvg` (as the Report's figures), with the drawing scale for a figure about 10 in wide (`scaleFor(width × 1.3, 10)`; the sheet uses 30 in) so its text reads at the figure's size.
  - Framing plan: `SBDFramingUI.layoutPlan(P)`, the plan of the Bridge layout input tab, with its own link to the Framing & bracing tab.
- **Links:**
  - Cross-section: edited on the Cross-section input tab, drawn on the Drawings tab.
  - Framing plan: edited on the Framing & bracing input tab, drawn on the Bridge layout input tab and the Cross-frames tab.
- **Layout:**
  - Two columns at screens of 1200 px and wider; one column below that (stacked; each SVG `max-width:100%`).
  - At 390 px there is no page-level horizontal scroll and no graphic wider than the window.
  - Each graphic is on a white box with dark ink (`color-scheme: light`). The app has no dark theme today; the box keeps the drawings legible if a browser or OS forces dark colours.
  - Print: side by side, `break-inside: avoid`, colours kept.
- **Also:** while the first run waits after the page opens on the Summary tab, the run status reads "Starting…" instead of "Inputs changed — updating…" (`S.first`).
- **Decisions (pending engineer review):**
  - The typical section is drawn with its sheet's general-notes block. That block is part of `section()`, and copying the drawing to leave it out is not allowed by the request.
  - The framing plan is the Bridge layout tab's (`layoutPlan`), not the Cross-frames output tab's checks.
- **Formulas, factors, units, code references, saved data:** none changed (§4, §5).
- **Check case:** default project, Summary tab, 1440 px: "Cross-section and framing plan" card after the verdict, two figures side by side (TYPICAL CROSS-SECTION, 5 girders at 9'-6"; plan with 3 spans, 5 girders). At 390 px they are stacked; page width 390 px.
- **How verified:** `tests/smoke/steel-bridge-summary.mjs` block 7 (side by side / stacked, links, print, 0 console errors); `node tests/check-syntax.mjs`.
- **Test fix (tests/smoke/steel-bridge-wiring.mjs, Constructibility step; regression report 2026-11-09):** "f_ℓ is not saved (undefined !== 1.5)" on origin/main.
  - Root cause: a race in the test, present since #1260 (output tabs run themselves when selected). It was not caused by #1271. On 5e52138 (before #1271) the test failed 2 of 4 runs; on 1d9670b, 1 of 4.
  - Mechanism: the test clicked the Constructibility tab and at once ran `fill('#cn_flC', '1.5')` and `dispatchEvent('change')`. The tab's own auto-run presses Calculate one frame later, which redraws the card. When that redraw fell between the fill and the change event, the typed value was lost with the old input. The change event then reached the new, empty input, and the handler (correctly) deleted `P.constr.flC`.
  - App behaviour is right: a change event with an empty field means "from skew".
  - Fix: wait for the tab to settle, fill, blur (the browser's own change event), wait for the saved value, settle again.
  - Proof the app saves f_ℓ: 4 of 4 runs "constructibility f_ℓ saved 1.5", read from `sbd2.project.current` and from the input after the re-run.



## 2026-11-09 — PR: report-search-ux (PR #1273: https://github.com/mlococo88/All-Structural/pull/1273) — list-input observer skips the report viewer (RSX; display only)
- **Where:** `ui/lists.js`, `start()`, anchor `new MutationObserver(ms =>`.
  - Before: `new MutationObserver(ms => { if (ms.some(m => m.addedNodes.length)) upgrade(document); }).observe(document.body, { childList: true, subtree: true });`
  - After: `new MutationObserver(ms => { if (ms.some(m => m.addedNodes.length && !(m.target.closest && m.target.closest('.rp')))) upgrade(document); }).observe(document.body, { childList: true, subtree: true });`
- **Problem:** the shared report search (RSX, `fixlog/shared-report.md`, same PR) adds `<mark>` nodes inside the report text on each keystroke;
  every added node made this observer re-scan the whole page (`upgrade(document)`, ~80–90 ms on a 380,000-element report). Nodes added inside
  the report viewer (`.rp`: marks, the search status, lazy step lists) never hold a list input, so they are skipped. Mounting the report
  (nodes added to its host, outside `.rp`) and every input tab still upgrade as before.
- **Governing provision:** none (display only).
- **Check case:** Report, governing detail, type `flange stress`: before ~100–200 ms per keystroke (callback + next frame); after ~35–90 ms.
  The list inputs (Bridge layout spans, Girders & plates segments) still bind: `tests/smoke/list-input.mjs` / phone-layout `sbapp` (PR).
- **Other copies:** none.

## 2026-11-09 — PR: sb-cache-bust (PR #1276: https://github.com/mlococo88/All-Structural/pull/1276) — scripts load with ?v=<page Last-Modified> (CBUST; loading only)
- **Problem:** GitHub Pages serves each file with `max-age=600`. After #1270 a browser loaded the new `index.html` with a stale cached `ui/loads.js`, so the "Girder spacing" drop-down (`[data-path="xs.spMode"]`) was missing. Any deploy could mix versions across the ~67 separate script tags.
- **Where:** `index.html` `<head>`, anchor `CBUST (2026-11-09)`.
  - Before: 57 static tags from `<script src="../../shared/units.js"></script>` to `<script src="ui/lists.js"></script>`, then (after the three.js CDN tags) 10 tags from `<script src="../../shared/dxf.js"></script>` to `<script src="ui/detail3d.js"></script>`.
  - After: in both places, an inline script holding the same paths, in the same order, as a list (the tags' HTML comments are kept as `//` comments):
    ```js
    (function () {
      var v = Date.parse(document.lastModified) || Date.now();
      [ '../../shared/units.js', /* … same list … */ 'ui/lists.js' ]
        .forEach(function (s) { document.write('<script src="' + s + '?v=' + v + '"><\/script>'); });
    })();
    ```
  - Also added, after the viewport meta: `<meta http-equiv="Cache-Control" content="no-cache">`. This is best effort only: Chrome, Edge and Firefox ignore it.
  - KaTeX and three.js CDN tags: unchanged.
- **Why `document.write`:** the written tags are parser-blocking classic scripts. They run in order, before the later inline app script and before DOMContentLoaded, exactly as the static tags did. `createElement` + `async=false` would not block the parser.
- **Stamp:**
  - Pages: `document.lastModified` is index.html's `Last-Modified`, i.e. the deploy time, so there is no manual bump.
  - `file://`: the stamp is the file's date, and the query is ignored.
  - No `Last-Modified` header: the browser reports the current time, so the scripts are fetched fresh.
- **Tests changed:** `tests/engine/deflection-tab.test.mjs` and `tests/engine/steps-groups-tabs.test.mjs` read the script list with `/(?:<script src="|^ *')((?!http)[^"'?]+\.js)["']/gm` (before: `/<script src="((?!http)[^"]+)"/g`). They get the same 67 files in the same order.
- **Governing provision:** none (loading only; no formula, factor, unit, code reference or saved data changed).
- **Check case:** open `apps/steel-bridge/index.html` from `file://`, then in the console: `[...document.scripts].filter(s=>s.src&&!/^https/.test(s.src)).length` → 67, every `src` ending in `?v=<number>`.
  - `window.SBD*` / `Shared*` keys: identical to origin/main, 67 = 67, including insertion order.
  - 0 console errors.
- **How verified:**
  - Headless Chromium, main vs branch, on `file://` and over HTTP (a local server sending Last-Modified).
  - `node tests/check-syntax.mjs`.
  - Smoke tests: steel-bridge wiring, paths, report, graphics, drawings, summary, dash, deflection, equal-spacing, splice-addrow, taberrors, library, tabgraphics-b; phone-layout `sbapp`; project-library.
- **Other copies:** none.
- **Open items:** other folder tools, and single-file tools that load `shared/*.js`, could get the same loader (follow-up).

## 2026-11-09 — PR: claude/sb-wide-splitter (PR #1277: https://github.com/mlococo88/All-Structural/pull/1277) (SBW) — full screen width and a draggable splitter between the input and output panels   [display only; no result or saved-data change]
- **Engineer:** 2026-11-09: "There is a lot of blank space on the sides of the app, we should fill the entire screen width. Also maybe it would be good to have the input/output panel width adjustable with a grab bar or something."
- **Where:**
  - `index.html` CSS, `#app` (anchor `#app{max-width:`): before `#app{max-width:1500px;margin:0 auto;` → after `#app{max-width:none;margin:0 auto;`.
  - `index.html` CSS, `#inputPanel`: before `flex:0 0 33%;max-width:33%;` → after `flex:0 0 calc(100% * var(--sbIn,.33));max-width:calc(100% * var(--sbIn,.33));`; and in the DASH rules (anchor `DASH (2026-11-09): the left check summary column`) each `*.33)` → `*var(--sbIn,.33))` (e.g. `calc((100% - 240px)*.33)` → `calc((100% - 240px)*var(--sbIn,.33))`).
  - `index.html` CSS: new block (anchor `SBW (2026-11-09): the full screen width`): `#sbSplit` hidden by default, shown as a 7 px flex bar with a dotted grip and `cursor:col-resize` at `min-width:900px`; `#main:has(#sbSplit) #inputPanel{border-right:none}`; `body.sbSplitDrag` cursor; `@media print{#sbSplit{display:none!important}}`.
  - `index.html` HTML: `<div id="sbSplit" role="separator" aria-orientation="vertical" … tabindex="0">` between `#inputPanel` and `<main id="outputPanel">`.
  - `index.html` CBUST loader (second list, after `'ui/detail3d.js'`): `'ui/splitter.js'`.
  - New `ui/splitter.js` (`window.SBDSplitUI`: `KEY, DEF, MIN_IN, MIN_OUT, reset(), apply(), setPx(px)`): sets `--sbIn` on `#main` = clamped input width / (`#main` width − summary column width); pointer events with pointer capture; keys Left/Right 16 px (Shift 64), PageUp/PageDown 80, Home/End limits, Enter reset; double-click reset; ResizeObserver on `#main` and `#sbDashCol` re-clamps; after a user change (rAF) a window `resize` and a `sbd2:panelresize` event ({ input, output } px).
- **Layout:** default share .33 (as before; no `--sbIn` set while no key). Minimums: input ≥ 300 px, output ≥ 480 px (for a dragged / keyed width; if the window is too narrow for both, the input keeps 300). At 1920 px: before app 1500 / summary 280 / input 403 / output 817 px; after 1920 / 280 / 541 / 1092 px. At 1440 px: 240 / 396 / 797 px (output 7 px less: the bar). Below 900 px (stacked): no bar, unchanged.
- **Saved data:** new per-browser UI key `sbd2.splitRatio_v1` (the input share, 4 decimals; removed on reset); the app's `sbd2.` UI prefix as `sbd2.dashCollapsed_v1`. Not in the project, the autosave or the export. No existing key or format changed.
- **Decisions (pending engineer review):** the default (no key) keeps the old layout exactly (no clamp, so 297 px at 900 px as before); no extra outer gutter (the panels' padding is the gutter); prose not line-length capped; SVG frames keep their drawn height until the tab redraws (the drawing re-fits by its viewBox).
- **Formulas, factors, units, code references:** none changed (§4).
- **Check case:** 1920×1080, default project: input 541 px (= .33 × (1920 − 280) = 541.2); drag +200 → 741 px, key ≈ 0.452 (741 / 1640); drag far right → output 480 px; far left → input 300 px; reload keeps the width; double-click → 541 px, key removed.
- **How verified:** new `tests/smoke/steel-bridge-splitter.mjs` (32 checks); `tests/check-syntax.mjs`; `phone-layout --tool sbapp` (390, 768); smoke steel-bridge wiring, paths, report, graphics, drawings, scroll, summary, tabgraphics-b, deflection, dash; project-library; engine deflection-tab and steps-groups-tabs after the CBUST merge; 0 console errors.

## 2026-11-09 — PR: sbqa-form-layout (PR #1278: https://github.com/mlococo88/All-Structural/pull/1278) — form rows: long labels wrap in their own column, drop-downs show their choice (QAF; display only)
- **Problem (visual QA pass, engineer request 2026-11-09):** in `.fRow` form rows (every input tab and the option rows at the top of the
  output tabs) the label kept its full one-line width, so a label longer than about 200 px pushed its input or its unit onto a line of its
  own (Cross-section: "ft" under "Left overhang (girder ℄ to deck edge)", "in" under the deck rebar centroid inputs; 30 rows over the input
  tabs at 1440 px, 32 at 390 px). Every drop-down was a fixed 110 px, so most choices were cut ("Individual sp", "Lightest stee",
  "This project'", "AASHTO LRF"; 57 drop-downs at 1440 px).
- **Where:** `apps/steel-bridge/index.html` `<style>`, right after `.fRow label{min-width:170px;font-size:10pt;}`, anchor `QAF (2026-11-09)`.
  - Before: (no rule)
  - After:
    ```css
    .fRow>label:first-child{flex:0 1 auto;max-width:calc(100% - 150px);}
    .fRow>select{flex:1 1 110px;width:110px;min-width:110px;max-width:max-content;}
    ```
  - The first label of a row may take the row width less 150 px (a 110 px input, the gaps and a short unit) and wraps inside that; short
    labels keep the 170 px minimum, so inputs stay where they were. A drop-down starts at 110 px and grows into the free space of its row,
    never wider than its longest choice.
- **Result:** rows with the input or unit on a line of its own 30 → 4 at 1440 px and 32 → 4 at 390 px. The 4 left are units wider than the
  reserved space ("kip-ft", "trucks/day", "ft apart", "(2.5.2.6.2)"). Drop-downs with their choice cut 57 → 22 (1440 px): those with a very
  long choice in a full row.
- **Governing provision:** none (display only; no formula, factor, unit, code reference, key or saved data changed).
- **Check case:** Cross-section tab at 1440 px: "Left overhang (girder ℄ to deck edge)" wraps to two lines and its input and "ft" sit on
  the same line; Girder spacing shows "Individual spacings" in full.
- **How verified:** headless Chromium, origin/main vs branch: the digit sequences of every input tab, every output tab and the built
  Report are identical (default project); before/after screenshots; `node tests/check-syntax.mjs`; steel-bridge smoke tests; phone-layout
  `sbapp`; project-library.
- **Other copies:** none.
## 2026-11-09 — PR: claude/sb-defl-per-girder (PR #1279: https://github.com/mlococo88/All-Structural/pull/1279) (DFG) — Deflection tab: every cross-section girder G1…Gn selectable, each with its own dead loads; camber of every girder (tenth points) on the tab and in the Report   [display only; no formula change; no saved-data change]
- **Engineer:** 2026-11-09 (follow-up on #1274): "Deflections should also include camber; the camber is inclusive of DL deflections, so we need to be able to look at each girder individually. Right now it only allows me to look at G1."
- **Root cause (reproduced):**
  - The tab's girder selector listed `P.girders`. These are **plate girders** (sets of plates), not cross-section girders.
  - The default project has one plate girder, labelled "G1", position interior. `engine/analysis.js lineOf` analyses it on cross-section girder **G2**. So the selector showed only "G1", and those results were in fact the interior girder G2's.
  - With more plate girders (tested with an added exterior plate girder "GE" on line G1), the selector listed them and switching worked (`ui.g`, analysis cache keyed per girder).
  - Cross-section girders without a plate girder of their own could not be shown. The engine analyses one cross-section line per plate girder.
- **What exists in the engine (no STOP needed):**
  - The loads module (`engine/loads.js`, via `SBDAnalysis.moduleOf`) already gives every cross-section girder its own dead loads: DC1 deck/haunch/SIP with the overhang for exterior girders, DC2 and DW shares by the chosen method, cross-frame point loads.
  - `analyzeGirder` uses the line in the plate girder's "Cross-section girder" field (`girder.line`, an existing saved field, the Analysis tab's selector).
  - g_Δ is one value for the bridge (all lanes, all girders, 2.5.2.6.2), the same for every line.
- **Where:**
  - `ui/deflection.js`, new block `/* ---------- girder lines (DFG …`:
    - `nbOf(P)`.
    - `plateOf(P, j)`: `SBDDrawings.plateGirderOf`, the Drawings' rule SB2-DW1. A line takes the plate girder whose `line` is j; else the first plate girder of the same position without a `line`; else the first.
    - `lineRun(P, j, opt)`: the analysis of line j. On the plate girder's own line it is the plain `analyzeGirder(P, pg, opt)`. Otherwise it is `analyzeGirder(Q, pg, opt)`, where Q is a JSON copy of P with `Q.girders[pg].line = j`. These are the same engine calls with that line's inputs; P is not changed.
    - `allLines(P)`: every line with `{ ll: false }`. The camber is computed before the live load, so it is the same (checked).
    - `lineSel()` replaces `girderSel()`. The selector `#df_line` lists G1…Gn as "G1 (exterior) — plates of G1 (no plate girder of its own)". Choosing a line whose plate girder differs sets `ui.g` through `ctx.setG` (as before). The chosen line is kept in memory, reset when `ui.g` changes elsewhere (Girders & plates tab, Summary).
    - `allHtml()`: new card "Camber of every girder (total dead-load deflection, tenth points)", `id="df-all"`. Girders are columns and tenth points are rows, plus the largest per girder. Each girder heading (`data-dfline`) opens that girder.
  - `render()`: key `keyOf(P, gi) + '|' + j`. Calculate runs `lineRun(P, j)` and `allLines(P)`. An alert shows when the line has no plate girder of its own. It names the plate girder and b_eff used; when the positions differ (exterior line on an interior plate girder) it says the exterior b_eff and stiffness differ, and to add an exterior plate girder. A second alert shows when entered dead-load overrides of that plate girder apply to this line too.
  - `dlHtml()`: "Camber = the total dead-load deflection = the sum of its components", with each span at 0.5L worked as components summed = total.
  - `report/data.js`: `B.cam = SBDDeflectionUI.allLines(P)` when the Deflection section is wanted (this project's analysis). The LRU analysis cache gets room for every line: `2 × (plate girders + nb) + 4`, was `2 × plate girders + 4`.
  - `report/builders.js` `defl()`: new sub "Camber of every girder (tenth points)", girders as columns.
- **Formulas, factors, units, code references, saved data:** none changed. `engine/` and `shared/` are not touched. The extra lines are analysed by the same `analyzeGirder` with the existing per-line inputs. No new saved key or field. The project copy for a line is never saved.
- **Main vs this branch:** plate girder G1 on its own line (G2) is unchanged. `SBDDeflectionUI.model`, `lld` and `camber` JSON on the default project are identical, main 196de67 vs this branch (probe script, 64,405 characters equal).
- **Check case:** default project, camber at midspan (in, downward +), steel + wet deck + DC2/DW = total.

  | Girder | DC1 wet (klf) | DC2 (klf) | DW (klf) | Span 1 (x = 55 ft) | Span 2 (x = 180 ft) | Span 3 (x = 305 ft) |
  |---|---|---|---|---|---|---|
  | G1 exterior | 0.9446 | 0.3411 | 0.2075 | 1.418 | 1.691 (= 0.268 + 1.080 + 0.344) | 1.418 |
  | G2 interior (plate girder G1's own line; unchanged) | 1.1652 | 0.2505 | 0.2075 | 1.601 | 1.899 (= 0.280 + 1.332 + 0.287) | 1.601 |
  | G3 | 1.1652 | 0.1600 | 0.2075 | — | 1.842 | — |

  - G4 = G2 and G5 = G1 by symmetry.
  - LL deflection: g_Δ 0.510 for every line, Δ_LL 0.512 / 0.700 / 0.512 in for each, because it does not depend on the dead loads (cracked zones "none").
- **Decisions (pending engineer review):**
  1. A line without a plate girder of its own takes that plate girder's plates **and its entered b_eff** (SB2-DW1). For the exterior lines of the default project, that is the interior b_eff of 114 in; the tab says so in an alert. The app has no exterior b_eff unless an exterior plate girder is added. Computing one would be a new calculation (§4), not done.
  2. Dead loads or factors entered as overrides on a plate girder apply to every line that takes its plates (an alert says so). A plate girder with hand-off loads (`girder.loads`/`df`) cannot be moved to another line: that line shows an error.
  3. The Summary tab and the Report summary rows stay per plate girder: the SA3 check is one per plate girder. Δ_LL does not depend on the line except with cracked zones "dl". The Summary's Deflection column opens this tab on that plate girder's own line.
  4. The chosen line is kept for the page view only (not saved: no new `sbd2.ui` field).
  5. As before: no vertical profile, no CTDOT OWN33 extra camber.
- **How verified:**
  - `tests/engine/deflection-tab.test.mjs`, new test, on the default project and a project with an added exterior plate girder (b_eff 96 in, line G1):
    - every line's `lineRun` equals `analyzeGirder` with that line;
    - its loads are the loads module's for that line (`mod.j === j`, DC1, DC2, DW);
    - the overview camber equals each line's full analysis;
    - exterior and interior cambers differ;
    - the own line equals `analyzeGirder(P, 0)`;
    - the Report table equals the tab.
  - `tests/smoke/steel-bridge-deflection.mjs`, at 1440 px:
    - 5 options, default G2;
    - 5 overview columns;
    - G1 and G3 selected (by the selector and by the overview link): each one's table, overview column and LL values equal `lineRun` in the page;
    - G1 ≠ G2;
    - 390 px layout.
  - Browser probe with two plate girders: the options name each plate girder; choosing G1 sets `ui.g` to GE and G5 back to G1; the b_eff alert. 0 console errors.
  - Updated for the extra dead-load runs (the Report's camber of every girder adds one `{ ll: false }` analysis per other girder line, cached):
    - `tests/engine/report-wiring.test.mjs`: run counts, and the cache bound with the new formula;
    - `tests/smoke/steel-bridge-paths.mjs`: cache size after the Report, 2 → 2 + 4.
  - A bug the tests caught while editing was fixed before commit: a comment in `report/data.js` had swallowed the cache's pruning loop.
  - After merging origin/main (#1275, #1270, #1276: the script loader; `ui/deflection.js` is in its list, no new file in this PR):
    - `tests/check-syntax.mjs` passes;
    - engine tests `deflection-tab`, `report`, `report-wiring`, `sb-summary`, `steps-groups-tabs`, `paths`, `equal-spacing` pass;
    - smoke tests `steel-bridge-deflection`, `-report`, `-summary`, `phone-layout`, `-wiring`, `-drawings`, `-paths`, `-scroll --quick` pass, with 0 console errors.
  - After merging #1277 (full width, splitter): `steel-bridge-deflection`, `phone-layout` and `steel-bridge-splitter` pass again.

## 2026-11-09 — PR: sbqa-output-format (PR #1280: https://github.com/mlococo88/All-Structural/pull/1280) — output tabs and Report: station not said twice, f_ℓ subscript, plain "2,000", graphic buttons above the title (QAO; display only)
Visual QA pass (engineer request 2026-11-09). Display only: no formula, factor, unit, code reference, key or saved data changed. Digit
sequences of every tab and the built Report, origin/main vs branch, default project and a 3-span 30° skewed 6-girder project: identical
except the duplicated stations removed by fix 1 (listed there) and the Summary's "last run … s" timing.
1. **Station said twice.** An analysis location is named "x = 249.99 ft", and the headings added ", x = <same> ft" again.
   - `ui/flexure.js`: governing line `Governing: <b>${esc(gv.name)}</b>${gv.x != null ? ` (x = …)` : ''}` → `${gv.x != null && !/x = /.test(gv.name) ? … : ''}`;
     the checks card heading `${esc(r.name)}${r.x != null ? `, x = …` : ''}: checks` → same test.
   - `report/builders.js`: new `const at = (r, d) => r.x == null || /x = /.test(r.name) ? r.name : `${r.name}, x = ${f(r.x, d)} ft`;` (anchor `QAO`),
     used in the Flexure proportions table location, the proportions summary row, the Flexure location sub-section titles and lazy titles,
     and the Constructibility location sub-section titles and lazy titles (before: `${r.name}, x = ${f(r.x, 2)} ft` or the `r.x != null` form).
     The Flexure summary row already did this (`/x = /.test(Gr.gov.name)`).
   - Before: "Governing: x = 249.99 ft (x = 249.99 ft), GS7 …", card "x = 249.99 ft, x = 249.99 ft: checks", Report "7.3 x = 0.01 ft, x = 0.01 ft",
     "10.2 x = 77.00 ft, x = 77.00 ft (governing)". After: "Governing: x = 249.99 ft, GS7 …", "x = 249.99 ft: checks", "7.3 x = 0.01 ft",
     "10.2 x = 77.00 ft (governing)". A named location (the Example's "Pier 1") keeps ", x = 109.99 ft". Only these repeated digits change.
2. **f_ℓ in check titles.** The title subscript helper `tt()` took `_` + `[A-Za-z0-9,]` only, so "f_ℓ/3" showed a raw underscore next to
   "f<sub>bu</sub>". `ℓ` added to the class in `ui/flexure.js`, `ui/shear.js`, `ui/splices.js`, `ui/constructibility.js` and `report/builders.js`
   (Report: `${}_{ℓ}$`, KaTeX's ℓ). After: "f<sub>bu</sub> + f<sub>ℓ</sub>/3 ≤ φ<sub>f</sub>F<sub>nc</sub>".
3. **"2{,}000" in plain text.** `engine/fatigue.js` `setText` (the settings line of the Fatigue & studs tab and the Report) used the TeX
   thousands formatter: "ADTT_SL = 0.85 × 2{,}000 = 1{,}700 trucks/day". New `const tx = q => String(q).replace(/\{,\}/g, ',')` (anchor `QAO`)
   around `n0(s.ADTT)` and `n0(s.ADTTSL)`. After: "0.85 × 2,000 = 1,700 trucks/day". Same digits.
4. **Rating table unit.** "kip-ft" broke over two lines in the narrow Unit column (`ui/rating.js`): `<td>${esc(q.unit || '')}</td>` →
   `<td style="white-space:nowrap">…`.
5. **Graphic buttons over the title.** The + − Fit buttons (shared/dxf.js viewer, top right) covered the end of titles that run to the right
   edge ("GIRDER G1: FATIGUE STRESS RANGE gamma(Df) vs NOMINAL RESISTAN…", Welds "BOTTOM FLANGE-TO-WE…"). `index.html`: `#out .sdx-view{padding-top:34px;}`
   (anchor `QAO`): the buttons sit in a 34 px strip above the drawing. Shared file unchanged.
6. **"−0.0" readout.** The Analysis elevation readout showed "M_DC1 -0.0" at x = 0 (a moment of −0.00004 kip-ft). `ui/gfxa.js`: new
   `nz = (v, d) => nf(v, d).replace(/^-(0(\.0+)?)$/, '$1')` for the readout's moments and camber. After: "M_DC1 0.0". Same digits.
- **Governing provision:** none (display only).
- **Check case:** default project, Flexure tab: governing line "Governing: x = 249.99 ft, GS7 Compression flange, f<sub>bu</sub> + f<sub>ℓ</sub>/3 …:
  ratio 1.229"; Fatigue & studs governing card "ADTT_SL = 0.85 × 2,000 = 1,700 trucks/day".
- **How verified:** headless Chromium main vs branch digit probe (above); before/after screenshots; `node tests/check-syntax.mjs`;
  steel-bridge smoke tests; phone-layout `sbapp`; project-library.
- **Other copies:** none (the `tt()` copies are the five files listed).

## 2026-11-09 — PR: sbqa-phone-report (PR #1281: https://github.com/mlococo88/All-Structural/pull/1281) — Report tab fits a phone screen; phone-layout test covers the output tabs (QAP; display only)
- **Problem (visual QA pass, engineer request 2026-11-09; open item of TABR):** at 390 px the Report tab scrolled the whole page 91 px
  sideways: its "Demands" drop-down (`#rp_src`, `shared/report.js` `.rp-bar select{width:auto!important}`) is as wide as its longest choice
  (454 px). The Drawings tab's sheet drop-down (376 px) was cut by its card at 390 px.
- **Where:** `apps/steel-bridge/index.html`, inside `@media screen and (max-width:899.98px)`, after `.inTabs{top:0;}`, anchor `QAP (2026-11-09)`.
  - Before: (no rule)
  - After: `#out .rp-bar select,#out .dwg-bar select{max-width:calc(100vw - 48px);}`
  - Shared file unchanged (the rule is scoped to this app's output panel).
- **Test:** `tests/smoke/phone-layout.mjs`, tool `sbapp`: tabs `'#inTabs [data-itab]'` → `'#inTabs [data-itab], #tabBar [data-otab]'`, tabWait 900 → 1500:
  every output tab is now opened and checked at 390 and 768 px too (29 views; on origin/main the Report fails at 390 px).
- **Governing provision:** none (display only).
- **Check case:** 390 × 844 px, Report tab: `document.scrollingElement.scrollWidth - clientWidth` 91 → 0; Drawings card 30 px clipped → 0.
- **How verified:** headless Chromium main vs branch digit probe of every tab and the Report (identical); before/after screenshots;
  `node tests/check-syntax.mjs`; steel-bridge smoke tests; phone-layout `sbapp`; project-library.
- **Other copies:** none.

## 2026-11-09 — PR: sbqa2-display-leftovers (PR #1282: https://github.com/mlococo88/All-Structural/pull/1282) — the visual QA pass's reported leftovers on every tab (QA2; display only)
Engineer request (2026-11-09): every tab looks correct and professional. Display only: no formula, factor, unit, code reference, key or saved-data
format changed. Anchor text `QA2` marks each change. New file `ui/sub.js` (in the first `document.write` loader of `index.html`, before the
`ui/` files).
1. **Flexure "Stress checks at x" chart** (`ui/gfxa.js` `flexure()`, mount `fxb`). Before: chart width `Math.max(150, 32 * n)` per chart (32 units =
   5.3 text heights per check; 14 checks → 448 units: text ~7 px in a 765 px frame), the check key on the id's line (`q.id + ' ' + key`), title wrapped
   at 42 characters. After: both charts on one width `w = Math.max(150, 3 * h * Math.max(nKsi, nRatio))`, the key on a second line under the id
   (`keys()`), the gap between the charts 17 h → 13 h, the title wrapped to the chart width. Same values and order (the text ~13 px at 1440 px).
2. **Constructibility overhang sketch, interior girder** (`ui/gfxa.js` `constr()`): before, `R.F.oh` null drew a frame with "OVERHANG BRACKETS: EXTERIOR
   GIRDER, PROJECT SOURCE ONLY (INPUTS ABOVE)". After: no frame, a note "Overhang brackets apply to exterior girders; select G1 or Gn." (an exterior
   plate girder with a GirderDetail file: "Overhang brackets are checked with the project as the source (not a GirderDetail file).").
3. **Fatigue & studs graphics** (`engine/tabgraphics-b.js`, `ui/graphics.js`):
   - Detail labels: `SBDGraphics.stack(items, o)` gets `o.leaders`: a flag goes further out than every flag placed before it (to its right) whose
     leader x lies inside it, so no leader crosses a label (before: "F19 EXEMPT", "F2 0.70" were crossed). `fatigue()` `rowsOf` passes `leaders: true`.
     Other callers of `stack()` unchanged.
   - Chart text: "gamma(Df) vs NOMINAL RESISTANCE (DF)n" → "GAMMA(DELTA f) VS NOMINAL RESISTANCE (DELTA F)n"; legend "(DF)n RESISTANCE",
     "gamma(Df) < 0.9 (DF)n", "0.9 TO 1.0 (DF)n" → "(DELTA F)n …", "GAMMA(DELTA f) < 0.9 (DELTA F)n", "0.9 TO 1.0 (DELTA F)n"; readout "GAMMA(DF) … (DF)n"
     → "GAMMA(DELTA f) … (DELTA F)n". Display choice (notation only, no engineering meaning, so no in-app note under CLAUDE.md §6): the CAD-capital style of the elevation's own note ("GAMMA(DELTA f) /
     (DELTA F)_n"), not Greek letters: the graphics' SVG preview (shared/dxf.js) prints a Greek letter as its DXF escape "\U+03B3".
4. **Rating chart** (`engine/tabgraphics-b.js` `ratingChart()`): the support names drawn in a row above the plot (before: at the plot's top edge, over
   the arrows of capped values), shifted beside a governing leader at the same station; the INV / OPR governing labels above that row on leaders from
   their circles (before: beside the circle, over the curves); the title in two lines (wrapped at 30 characters) above them, so the phone view's
   reading zoom shows it whole at 390 px. Same texts and values.
5. **Underscores in screen text → subscripts.** `ui/sub.js` `SBDSub.html(t)`: escaped text with `X_ab` → `X<sub>ab</sub>` (regex
   `/([A-Za-zΑ-Ωα-ωℓ)])_\{?([A-Za-z0-9ℓ]+(?:[,+][A-Za-z0-9ℓ]+)*)\}?/g`: "M_LL+IM", "f_ℓ,skew" whole; "P_fy, inner" without the comma). Used for:
   the step labels and notes of every tab (`class="lbl">${esc(s.label)}` / `<div class="nt">${esc(s.note)}` → `SBDSub.html(...)`, 13 places), the
   Analysis station-table headers (`<th>${esc(c[0])}</th>`) and chart legend, check titles and locations in the Cross-frames, Fatigue, Shear, Splices,
   Welds and Rating tables (`esc(x.title)` / `esc(x.it.loc)`), the Flexure n/a cells, the Fatigue settings line, the Cross-frames M_u note, the Auto
   design chips, the graphics' notes and readouts (`ui/graphics.js` `mount()`: `read.innerHTML = SBDSub.html(t)`). The topic result lines of the
   worked steps ("Flange local buckling (λ_f = b_fc/2t_fc …)") are written by shared/steps.js: `SBDSub.fix()` (a MutationObserver on `#out`) puts
   the subscripts into their own text nodes (never inside KaTeX). shared/steps.js unchanged. Summary `txt()` (ui/summary.js): `ℓ` added to the class
   (as QAO did in the tabs). Report (`report/builders.js`): `tt()` no longer takes a trailing comma; applied to the Fatigue / studs and Cross-frames
   governing titles and the Cross-frames and Field-splice governing locations ("n ≥ P/Q_r", "P_fy, Inner"). Not changed: drop-down choices
   (`<option>` cannot hold a subscript) and the CAD graphics (capitals, SVG / DXF).
6. **Cross-frames check table** (`ui/framing.js`): new `big = x => Math.abs(x) >= 10000 ? SharedUnits.fmtInt(x) : fmt(x, 2)` for the Demand and Capacity
   cells; an infinite capacity shows "∞" (before: the cell fell back to `cells[1]`, the demand "16,528"). **Digits changed (CF8, default project):**
   β_br 16527.87 / 1215374.92 → 16,528 / 1,215,375; β_sec 16527.87 / 16,528 → 16,528 / ∞; β_g 16527.87 / 471576.58 → 16,528 / 471,577;
   β_T 16527.87 / 339750.34 → 16,528 / 339,750 (rounding to whole kip-in/rad; the engine's own cell text, unchanged, already had 16,528).
7. **Drawings quantities** (`engine/sheets.js` `quantities()`): new `n0 = v => (Math.round(+v) || 0).toLocaleString('en-US')` for every quantity (the
   table on the Drawings tab and on the Typical section sheet): "435385 LB" → "435,385 LB", "2000" → "2,000", "6080" → "6,080" (same digits).
   `tests/engine/sheets.test.mjs` expects the separators.
8. **Report tab** (`index.html`, CSS only; shared/report.js unchanged):
   - `#out .rp-host{container-type:inline-size}`; on screen `#out .rp-doc{max-width:11in}` and, where the output panel is under 1000 px wide
     (`@container`), the contents list above the report (`.rp-body` one column, `.rp-toc` static, 220 px) and the doc padding 0.3 in / 0.35 in.
     At 1440 px: report 519 → 765 px wide.
   - `@media print`: with the Report tab selected (`body:has(#tabBar [data-otab="rpt"][aria-selected="true"])`), `#hdr` and `#out .rp-host>:not(.rp)`
     (the Demands bar) are not printed: Ctrl+P prints the report only, as Print report does.
9. **Summary** (`ui/summary.js`, `ui/dash.js`): Owner row with no owner "—; load rules AASHTO" → "none entered; load rules AASHTO"; "Lowest rating
   factor" and "Not evaluated" on their own lines in the line's font (`.sum-low`, was `.note` run on); a ratio that is not a finite number shows
   "∞" for Infinity ("−∞" for −Infinity) and keeps "NaN" only for a true NaN (before: "NaN" for every one): `nfTxt(r)`. Each such cell is a link
   to its tab (as every cell) and its tooltip gives the reason (`NF_WHY`), e.g. for ∞: "Ratio ∞: the demand / capacity ratio is infinite (the
   capacity, or a factor in it such as the 6.10.1.6 flange lateral bending amplification, is zero or has no finite value for this demand). The work
   is on its tab (click). (Counted as REVIEW.)". The "Not evaluated" line now reads "(ratio not finite, REVIEW): <group>, <girder> <location link>:
   <check> — ratio ∞" (before: "(ratio not a number, REVIEW): <group>, <girder> <location link>"). The check summary column (`ui/dash.js` `vOf`)
   the same (∞ / −∞ / NaN). Per CLAUDE.md §6 (2026-11-10), the Summary's "Counts" note adds: "A ratio cell showing ∞ (or −∞ / NaN): that check's
   demand / capacity ratio has no finite value (∞: infinite, e.g. a capacity, or a factor in it such as the 6.10.1.6 amplification, that is zero or
   not finite for the demand; NaN: not a number, e.g. 0 / 0); it is counted as REVIEW, and its tooltip and link give the reason and the work on its tab." The Report's summary is unchanged: it already writes "not evaluated (ratio not a number)". Counting unchanged (report/summary.js). The cause of the
   Constructibility ratio (F_nc = 0.91 ksi at 60° skew) is pending the engineer, not touched. `tests/smoke/steel-bridge-summary.mjs` expects ∞ / −∞ / NaN.
10. **3D view** drop-downs: `#out .v3d-bar select{width:auto;max-width:100%}` (were cut at 110 px: "Whole bridg", "Moment: Stre").
11. **Header at 390 px:** Undo and Redo in `<span id="hdrUR">` (inline-flex, nowrap); the save chip goes before it (`chipBefore: $('hdrUR')`).
    Before: the chip and Undo on one line, Redo alone on the next; after: the chip, then Undo Redo together.
12. **Input rows** with a short unit on a line of its own at a 350 px panel (Framing "Factored deck-placement M_u" kip-ft, Stiffeners "Intermediate
    cross-frames at most" ft apart, Fatigue "ADTT, one direction" trucks/day, Loads "LL deflection limit L/" (2.5.2.6.2)): for these four rows
    (`.fRow:has(>[data-path=…])`), the label max 170 px, the input 84 px, the unit `nowrap`.
- **Governing provision:** none (display only).
- **Check case:** default project, 1440 px. Cross-frames tab, CF8 row "Web distortion, β_sec": Demand 16,528, Capacity ∞, ratio 0.000. Drawings tab,
  Quantities: girder plates 435,385 LB. Default project with every support skew 60°: Summary, Constructibility cell "∞" (was "NaN"), tooltip as above.
- **How verified:** headless Chromium probe, origin/main vs branch, default project, text of every input and output tab (with the graphics' SVG
  text) and the built Report: digit sequences identical except item 6 (listed), the "1" of "G1 or Gn" (item 2, new note) and the "6.10.1.6" and "0 / 0" of the Summary's new
  Counts note (item 9); the Summary probe waits for
  "Up to date". Before/after screenshots. `node tests/check-syntax.mjs`; engine tests; smoke tests steel-bridge-wiring, -paths, -report,
  -graphics (updated: the interior-girder note, readout "Mc"), -drawings, -summary (updated), -dash, -deflection, -equal-spacing, -splice-addrow,
  -taberrors, -library, -tabgraphics-b, -scroll --quick, -splitter; phone-layout `sbapp`; project-library: pass, 0 console errors.
- **Other copies:** none (the tabs' `tt()` copies are unchanged; `ui/sub.js` is the app's one subscript helper for the new uses).

## 2026-11-10 — PR: sb-invalid-input (PR #1283: https://github.com/mlococo88/All-Structural/pull/1283) — invalid inputs are marked and block every result (SBINV)
- **Problem (QA, engineer decision 2026-11-09: "Invalid input should be highlighted so the user can fix; results should not be displayed"):** with a
  sidewalk fence load entered and its position left blank, the loads module refused its input (engine/loads.js `xsIn`), but every other tab still
  ran with zero dead loads and unit LLDF (engine/analysis.js `loadsOf` / `dfOf`: "Nothing entered: loads 0 and factors 1") and showed a full
  verdict ("FAIL … 32 PASS"); the only sign was a note inside each tab. Unconservative: dead loads and distribution were silently missing.
- **Where / what (display and gating only; no formula, factor, unit, code reference, key or saved format changed):**
  - `engine/inputcheck.js` (new, `window.SBDInputCheck`): `collect(P)` → `{ errors: [{ path, msg, src, cell?, host? }], warnings }`, cached by the
    project text. Sources: `SBDModel.validate` (paths as before; `demandSrc` split per module; list rows of spans, bays and skews in `cell`); the
    loads module's own input checks (`SBDLoads.compute(fromModel(P, { girder: 0 }))`, each message given its field by `loadsPath`, e.g.
    "Left sidewalk railing or fence: its position …" → `xs.sidewalks.L.fenceX`; "The bridge is incomplete …" only when the model checks have no
    error); the analysis settings checks of `analyzeGirder` (IM, IM fatigue, L/…, cracked zones); the stiffener type checks of
    `SBDStiffeners.transverse` / `bearing` not in the model; the entered cross-frame members, connection, d_min and user forces of
    `SBDCrossframes.compute`; the entered splice plates of `SBDSplices.compute` (entries a station uses). Engine messages are used verbatim.
  - `ui/inputcheck.js` (new, `window.SBDInputCheckUI`): `mark` (field `input.bad`/`select.bad` red outline, message beside it in `.alert.err`;
    list rows `input.sli-in.ic-cell`; table cells: message under the table), `banner`, `blocked`, `dash`, `fieldsOf`, `focus`.
  - `index.html`: both added to the first `document.write` loader (anchor `SBINV`). `markErrors()` before:
    `const v = M.validate(P), bad = new Set(v.errors.map(e => e.path)); … b.classList.toggle('has-err', errTabs.has(b.dataset.itab))`; after:
    `const v = IC().collect(P); icErr = v.errors; ICU().mark(v.errors, icO()); …` with a count in each input tab's `.inDot`. New `gotoErr(e)`
    (banner link: the input tab, the girder/segment of the field, focus). `drawOut0()` is now the gate: with errors, every output tab shows
    `ICU().blocked(...)`; the old body is `drawTab()`; `hostFix(t, E)` for a tab that holds an errored field (Calculate off, no results).
    `autoRun()`: `if (IC().blocked(P)) { $('autoBar').hidden = true; return; }`. `#out` click: `[data-icgo]` → `gotoErr`.
  - `ui/dash.js` `draw()`: the error list instead of the verdict while errors exist; `init(o)` takes `fix(i)`, `errUi()`.
  - `ui/handoffs.js` `subSend()`: "Nothing was sent / exported: N inputs need fixing first" while errors exist.
  - `ui/autodesign.js` `runBar()` / `#ad_run`: Run off with `#ad_blocked` "Auto design cannot run: N inputs need fixing first"; the click refuses too.
- **Classification of the existing messages (blocking error / warning):**
  - Blocking: every `errors` entry of `SBDModel.validate`; the loads module input checks (truck gap, added line loads, sidewalk / median /
    pedestrian, appurtenance w_c, sidewalk fences, wearing surface by thickness, overlays, deck edges, load overrides, incomplete bridge);
    the analysis settings checks; the stiffener type checks; the entered cross-frame checks; the entered splice plate checks.
  - Warnings (unchanged, not blocking): model `warnings` (D/t_w > 150, N_b = 3); LLDF range of applicability and the equal-spacing S range
    note; proportion limits; analysis warnings (loads module message, no dead loads, manual factors, construction LL notes, finishing machine);
    Auto design warnings; owner-rule notices.
  - Left in their tab (the module refuses its own results, as before): Custom demand table rows (ui/demands.js `rowsOf`; the table is on the
    output tab), Constructibility overhang bracket inputs (on the output tab), stiffener plate thinner than the sacrificial thickness (owner
    rule), the hand-off file sources, derived values (S, d_g, L_b of the cross-frames; splice demands at a station).
- **Decisions (pending engineer review):**
  1. New blocking checks: an entered construction live load q_CL < 0 (clOf would take the owner's / 20 psf default) and an entered
     finishing machine load P_fm < 0 (fmOf would apply none).
  2. Inputs that live on an output tab (Flexure and Constructibility f_ℓ, Rating φ, the Welds inputs, the Custom demand tables' shape, the
     demand source choices): that tab is drawn for the fix, with the banner, out of date and its Calculate off; every other tab is blocked.
  3. Graphics: every output tab is blocked, the Drawings and the 3D view included (they carry dimensions and values); the geometry graphics on
     the input tabs (Bridge layout plan, Framing & bracing plan) stay, with their own error when their inputs are invalid.
  4. Custom demand table row errors stay in their tab (see above).
  5. "Share project info" (names only) and the pulls (receiving) still work; the Substructure Loading send and export are refused.
  6. Errors clear when the entry is committed (Enter, Tab, leaving the field), as every input of the app; then the open tab re-runs (#1260).
  7. The Loads input tab's "Calculated / Used" dead-load lines (input panel) stay; with a loads error they say "none (the loads module gives none: …)".
  8. Entered splice plates with auto-design on are still used by the engine (inputsAt `own`), so they block; the message says to show them with
     "Entered below". Stiffener types are checked whether the web is stiffened or not, as the model already did.
- **Notes in the app (engineer rule 2026-11-10: every assumption or decision is noted in the app and the Report):** one text,
  `SBDInputCheck.NOTE` ("Input check: results are shown only while no blocking input error exists. … Warnings (LLDF range, proportion limits,
  D/t_w > 150, N_b = 3, Auto design) do not block. A Custom demand table and the Constructibility bracket inputs are checked on their own tab …
  An entered q_CL or finishing machine load below zero blocks (decision pending engineer review)."), shown as a `.note` on the Project input
  tab (after the Client name note), under the blocked output view, and in the Report's Project section (`report/builders.js`, after
  `p.notes ? note(p.notes) : null,`). A tab drawn for the fix of its own field adds "This tab is shown so that the field marked on it can be
  fixed; its results stay withheld until every input error is fixed." `ui/analysis.js`: the construction live load and finishing machine
  cards' notes end with "… below zero is an input error and withholds every result (decision pending engineer review)." These are the only
  text changes to valid projects' pages and Report.
- **Governing provision:** none (no calculation changed).
- **Check case:** default project; Cross-section tab, left sidewalk width 6 ft, railing / fence 0.05 klf, position blank. Before: every tab
  computed (DC2 without sidewalk and fence, LLDF 1), Summary verdict shown. After: banner "1 input needs fixing before results can be shown —
  Cross-section › Left fence from deck edge: … (0 < x ≤ 6 ft)", the field outlined, "Cross-section 1", no verdict anywhere. Position 3 ft:
  results identical to the same three values entered validly in a fresh page.
- **How verified:** main vs branch probe of every output tab's text, the left column and the built Report (default project and a skewed
  three-span two-girder project): identical except the Summary's "last run … s"; the built Report's full text (collapsed sections included)
  identical except the added input check note in §2.1; `tests/smoke/steel-bridge-invalid.mjs` (new);
  `node tests/check-syntax.mjs`; the steel-bridge smoke tests; phone-layout `sbapp`; project-library `sbapp`; 0 console errors.
- **Saved data:** no key or format changed; a saved project with an invalid field loads unchanged and shows its errors.
- **Other copies:** none.
## 2026-11-10 — PR: claude/sb-assume-notes (PR #1285: https://github.com/mlococo88/All-Structural/pull/1285) (SBASM) — assumptions and decisions stated as notes on the tabs and in the Report (CLAUDE.md §6, engineer's rule 2026-11-10)   [display / text only; no result, saved key or format change]
- **Engineer (2026-11-10, #1284):** every assumption or decision is stated in the tool where it applies (the tab card and the matching Report section), saying what the code does and citing the provision, without "pending engineer review".
- **Audit:** every "Decision (pending engineer review)" and engineer's decision / definition of the entries #1254–#1281 above, and the PR bodies of #1254 onward, checked against the app's notes and the code. The table is in the PR. Items already stated were left as they are; UI-only items (storage keys, splitter, tab order, which tab opens) need no note.
- **Where (each a note or a note sentence; the anchor is the text before the change, all before → after in the PR diff):**
  1. `ui/splices.js` `inputs()`, card "Entered plates and bolts (per station)". Before: `A station without an entry is auto-designed.` After: `A station without an entry is not auto-designed: it is checked with GirderDetail's built-in splice plates and bolts (listed as "built-in" on the Field splices tab); add a row for it, or choose Auto-design above.` (**wrong wording corrected to what the code does**: `engine/splices.js girder()` auto-designs only when `S.auto && !I.own`; otherwise `inputsAt()` keeps `clone(DEF)`. SPERR open item 2, closed.)
  2. `ui/splices.js` `render()` list and `report/builders.js` `spl()` list: the plates label. Before: `${s.own ? 'entered' : 'auto'}`. After: `${s.own ? 'entered' : s.design ? 'auto' : 'built-in'}` (`s.design` is set only when the station was auto-designed). Plus a note under each list: "Plates and bolts (Splices input tab): auto-designed at each station, fewest bolts and then least plate ("auto"), except where an entry exists for that station and girder ("entered")" or, with "Entered below", "as entered …; a station without an entry is not auto-designed: it is checked with GirderDetail's built-in splice plates and bolts ("built-in")". AASHTO LRFD 10th Ed. Art. 6.13.6.1.
  3. `ui/loads.js` Loads & LLDF tab, dead-load card. Before: `the cross-frames (not in this version; GirderDetail adds them as point loads from its Cross-frames module).` After: `the cross-frames (point loads from the framing and the cross-frame weights, Framing & bracing tab); both are added in the analysis (Analysis tab).` (**stale note corrected**: the cross-frame point loads have entered DC1 in the analysis since SB2-A6; the Report already said so.)
  4. `ui/loads.js` distribution-factor card, after the note `Span regions: …`; `report/builders.js` `loads()` sub "Live-load distribution factors": a Basis list / note: skews as |θ| (Tables 4.6.2.2.2e-1, 4.6.2.2.3c-1; SB2-O23); moment skew reduction judged per span, none in a span whose support lines differ by more than 10° and none in a pier region where either adjacent span's do (Art. 4.6.2.2.2e; SB2-O19); exterior fatigue factor not less than the rigid cross-section value, one lane ÷ 1.2 (Art. 4.6.2.2.2d, Eq. C4.6.2.2.2d-1, Art. 3.6.1.4.3b). The Report note also gives the span / pier region rule the tab already had.
  5. `ui/analysis.js` Loads input tab, card "Construction live load", last note: + `AASHTO LRFD 10th Ed. Art. 3.4.2.1 requires construction loads but gives no value: q_CL left blank is the owner's value, else 20 psf (this app's default, the overhang bracket construction load). A project saved before this calculation (2026-11-09) is not switched to it: tick the box above. The overhang bracket checks keep their own q_CL (Constructibility tab, OH inputs).` Card "Finishing machine": `Each girder takes its lever-rule share and` → `Each girder takes its lever-rule share (AASHTO LRFD 10th Ed. Art. 4.6.2.2.1): with a load outside the exterior girder, P(1 + a/S) on it and the uplift −Pa/S on the first interior girder; the share moves …` (CLC decisions 1–4).
  6. `report/builders.js`: new `clNote(A)` (anchor `the construction live load basis (CLC, 2026-11-09)`), the last item of the Analysis sub "Settings and loads": the source of w_CL (calculated with q_CL and its source, § an.CL.w; entered; hand-off; or none, "not calculated: a project saved before the calculation was added"), the finishing machine basis (§ an.fm.Pj, only when there is one) and the bracket checks' own q_CL and P_fm.
  7. `ui/deflection.js` `allHtml()` (card "Camber of every girder") and `report/builders.js` `defl()` sub "Camber of every girder": a girder with no plate girder of its own takes that plate girder's plates **and b_eff** (exterior on interior: the interior b_eff); dead-load / factor overrides of a plate girder apply to every girder that takes its plates; a tenth point between two stations is linear between them; (tab) SA3 is reported once per plate girder in the Summary and the Report summary (DFG decisions 1–3).
  8. `report/builders.js` `defl()`: the no-owner-rule limit note + "2.5.2.6.2 gives L/800 for vehicular load and L/1000 for vehicular and pedestrian load; with no owner rule the sidewalk setting does not change the limit, so L/1000 applies only when entered." (DEFL decision 3); the loading note + "the larger of the two cases is kept at each section and named (Governing case); the two are not listed side by side." (DEFL decision 2); the dead-load note, CTDOT only, + "The CTDOT extra camber of L/100 on simple spans (owner rule OWN33, BRSDM V1B) is not applied." (DEFL decision 4; the tab already said these three).
  9. `ui/autodesign.js` output tab, note under the candidate list: `its details sized first)` + (when a candidate has a WARNING) `, except the limits set to "as warning only" …: its governing ratio is that of the checks enforced, and the flag gives the largest warned ratio` (ADWN decision 2; span-to-depth AASHTO LRFD 10th Ed. Art. 2.5.2.6.3).
  10. `ui/framing.js` diaphragm note: + `and member forces entered from a refined analysis do not apply` and + `On a change between a rolled W and a channel, the shape starts at the one last used in that family on this page, else the shape that check CF10 recommends for the girder depth, else W21x44 / MC18x42.7: a starting choice, checked by CFD like any other.` (BRSEL decisions 2, 4.) `report/builders.js` `frm()`: with a diaphragm, a note in the checks sub (CFD / CFE; CF1–CF9 and entered member forces do not apply).
  11. `report/builders.js` `frm()` sub "Framing plan": a note: the orientation (automatic: parallel where both supports ≤ 20°, else normal, 6.7.4.2.1; an owner rule xf.orient decides for the whole bridge), the first normal frame at least max(clear, 4b_f, 0.4s) from a support skewed > 20° (C6.7.4.2.1), half of each frame's weight on each girder it connects, on the steel section (DC1) — as the Framing & bracing tab states.
  12. `report/builders.js` `summary()` and `allModel()`: the Summary-tab note + "There a rating factor RF < 1.0 counts as FAIL, and a check with a Warning status (welds, cross-frames, deflection over the owner's preferred limit) as REVIEW." (SUMT decisions.)
  13. `ui/fatigue.js` Fatigue & studs input, studs card. Before: `"Each girder its own b<sub>eff</sub>" is an option, off by default;` After: `This app's default is "Each girder its own b<sub>eff</sub>": the pitch (AASHTO LRFD 10th Ed. Art. 6.10.10.1.2) and the strength (Art. 6.10.10.4.2) take the girder's own b<sub>eff</sub> (in its composite section); "Bridge-wide" is GirderDetail's envelope.` (**note contradicted the code**: `engine/model.js defaultStuds()` has `beffMode: 'girder'` since SB2-F1, and the drop-down says "default".)
- **Test text:** `tests/smoke/steel-bridge-splice-addrow.mjs`: after the row is removed with "Entered below", FS1 is labelled `built-in:` (was `auto:`).
- **Formulas, factors, units, code references, saved data:** none changed (§4, §5). No engine file changed.
- **Check case:** default project. Splices input, "Entered below", no row: Field splices FS1 "built-in: 50 bolts each side" (was "auto: …"), the same ratios. Loads & LLDF tab: "… cross-frames (point loads from the framing …)". Report, Analysis "Settings and loads": "Construction live load (3.4.2.1 …): calculated, w_CL = q_CL × b_trib §, q_CL = 20.0 psf (this app's default …)".
- **How verified:** main (644a27c, same app as origin/main 1c3fd15) vs branch, headless, four projects (default; "Entered below"; CTDOT with a W24x55 diaphragm, skews 30/25/25/30°, finishing machine 3 kip at 1 ft; a project without `clCalc`): every input tab, every output tab except Report / Auto design / 3D / Drawings, and the built Report (governing detail): the digit sequences identical except the inserted note text (article numbers, 20 psf, 2026-11-09, L/800 / L/1000, W21x44 / MC18x42.7, 20°, 4b_f, 0.4s, 1.0; listed in the PR); 0 unresolved Report references; 0 console errors. The Summary tab compared after "Up to date": identical digits. `node tests/check-syntax.mjs`; engine `report`, `steps-groups-tabs`, `report-wiring`, `deflection-tab`, `sb-summary` (pass; they fail on origin/main too at `ui/splitter.js` in Node, so they were run with that one line made Node-safe in the working copy only, not committed); smoke as in the PR.
- **Other copies:** none.
- **Open items:** (1) `ui/splitter.js` touches `document` at load, so the Node engine tests `report`, `steps-groups-tabs`, `deflection-tab` fail on origin/main (since #1277); not changed here. (2) With a diaphragm the Cross-frames tab elevation still draws the angle frame (BRSEL open item). (3) Constructibility notes left to the Constructibility PR in progress (CLC decision 4 is stated on the Loads tab and in the Report Analysis section).

## 2026-11-10 — PR: fix/sbapp-splitter-node-guard (PR #1286: https://github.com/mlococo88/All-Structural/pull/1286) — `ui/splitter.js` a no-op without a page (Node engine tests); input-check notes say what the app does   [display / load guard only; no result, saved key or format change]
- **Problem 1:** `ui/splitter.js` (#1277) runs `document.readyState` at load, so the Node engine tests that load the app's scripts from `index.html` failed on origin/main (365dfb8): `ReferenceError: document is not defined` at `ui/splitter.js:102` (`steps-groups-tabs`, `deflection-tab`; SBASM open item 1).
- **Where 1:** `apps/steel-bridge/ui/splitter.js`, the IIFE, anchor `'use strict';` followed by `const KEY = 'sbd2.splitRatio_v1'`.
  - Before: `  'use strict';` / `  const KEY = 'sbd2.splitRatio_v1', …`
  - After: `  'use strict';` / `  if (typeof document === 'undefined') return;   // loaded without a page (the Node engine tests): nothing to do (2026-11-10)` / `  const KEY = …`
  - In a browser `document` always exists: the guard never fires, the splitter is unchanged (`window.SBDSplitUI` is not defined under Node; nothing there reads it).
- **Problem 2:** the input-check notes of #1283 said "(decision pending engineer review)" in the app and the Report; CLAUDE.md §6 (#1284) says a note states what the code does, without that phrase.
- **Where 2 (text only):**
  1. `ui/analysis.js`, card "Construction live load" (`'an-cl'`). Before: `An entered q<sub>CL</sub> below zero is an input error and withholds every result (decision pending engineer review).` After: `An entered q<sub>CL</sub> below zero is an input error: every result is withheld until q<sub>CL</sub> is zero, positive or blank.`
  2. `ui/analysis.js`, card "Finishing machine" (`'an-fm'`). Before: `A load P<sub>fm</sub> below zero is an input error and withholds every result (decision pending engineer review).` After: `A load P<sub>fm</sub> below zero is an input error: every result is withheld until P<sub>fm</sub> is zero, positive or blank.`
  3. `engine/inputcheck.js` `NOTE` (Project input tab, the blocked output view, Report §1 Project), last sentence. Before: `An entered q_CL or finishing machine load below zero blocks (decision pending engineer review).` After: `An entered q_CL or finishing machine load below zero is a blocking input error.`
  - Code comments with the phrase (`engine/inputcheck.js` header and the q_CL check, `engine/analysis.js` `CL_PSF`) are not shown in the app and are unchanged. The decision itself (a negative q_CL / P_fm blocks every result) is recorded in the sb-invalid-input entry above, wording unchanged.
- **Governing provision:** none changed (AASHTO LRFD 10th Ed. Art. 3.4.2.1 is cited as before).
- **Formulas, factors, units, code references, saved data:** none changed (§4, §5).
- **Check case:** default project, Loads input tab, enter q_CL = −5 psf and P_fm = −2 kip: the check summary lists both fields and every output tab shows "Results not shown", as before; the Project tab note ends "… below zero is a blocking input error."; no number anywhere changes.
- **How verified:** main (365dfb8) vs branch, headless (`tests/lib.mjs openPage`): built-in project, every input and output tab and the built Report (`.rp-doc` text): 158,740 digit groups each side, identical; the same project with q_CL −5 and P_fm −2 (blocked), 28 views: 1,885 digit groups each side, identical; the only differing lines are the 3 sentences above (and the Summary run-time display); 0 console errors. `node tests/check-syntax.mjs`; engine tests, every steel-bridge file by name (54 files): origin/main 4 failed (`deflection-tab` 2, `steps-groups-tabs` 2, all `document is not defined` at `ui/splitter.js`), branch 324 passed, 0 failed (`report`, `report-wiring`, `sb-summary` pass on both); smoke `steel-bridge-splitter` (32 checks, 0 failed), `steel-bridge-invalid`, `steel-bridge-report`, `phone-layout --tool sbapp`: pass, 0 console errors.
- **Other copies:** none.
- **Open items:** none new.

## 2026-11-10 — PR: claude/sb-constr-mdcc-pr1 (PR #1287: https://github.com/mlococo88/All-Structural/pull/1287) — Constructibility: C_b, the compression flange and the nonprismatic γ_e from the M_DCc the check uses (SBCON; engineer decision 2026-11-10; changes computed values)
- **Problem:** with the pour sequence on (M_DCc ≠ M_DC1), `bracingC()` built the deck-placement LTB data (the flange in compression,
  C_b,C by Eq. 6.10.8.2.3b-1, and for a nonprismatic L_b the ratio K = f_max/f_x of the conservative γ_e bound) from 1.25M_DC1 + 1.5M_CL,
  while `location()` checks 1.25M_DCc + 1.5M_CL. γ_e = F_e,s/(K f_s) then mixes two moment diagrams. Near an M_DC1 inflection f_x → 0,
  K → ∞ and F_nc collapses (skewed 100-130-100 project G1 x = 130.00: F_nc 0.91 ksi, GS14 ∞, "NaN" on the Summary). Unconservative in
  prismatic bays where the flatter M_DCc envelope lowers C_b; overly conservative (and non-finite) at nonprismatic L_b near inflections.
- **Where:** `apps/steel-bridge/engine/constructibility.js`, `bracingC`, anchor `C0 = factors(), dcc = xs.map(`.
  - Before: `Mc = env.Mc || xs.map((_, k) => C0.cdc * env.MDC1[k] + C0.ccl * env.MCL[k]);`
  - After: `dcc = xs.map((_, k) => !env.Mc && !!env.MDCc && useDCc(env.MDCc[k]));`
    `Mc = env.Mc || xs.map((_, k) => C0.cdc * (dcc[k] ? +env.MDCc[k] : env.MDC1[k]) + C0.ccl * env.MCL[k]);`
  - Also (display, no value changes): `bracingC` returns `cbParts` (M_max, M_A, M_B, M_C), `kParts` (f_max, f_x) and `mSrc`
    ('DCc' | 'DC1'); `fromPayload` / `fromAnalysis` pass them on; `location()` keeps them (`r.seg`, `r.cbParts`, `r.kParts`, `r.mSrc`);
    `worked()` works C_b (cn.Cb: 12.5M_max/(2.5M_max + 3M_A + 4M_B + 3M_C) with values), states the moments used in cn.Cb, cn.gov and
    cn.ge (K = f_max/f_x with values). New `SBDConstr.notes(seq)`: the assumptions, shown as notes on the Constructibility tab
    (`ui/constructibility.js`, after the M_c note) and in Report §Constructibility, "Governing ratio of each span" (`report/builders.js` cn()).
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.8.2.3c (Eqs. 6.10.8.2.3c-1 to -3) and C6.10.8.2.3c (γ_e scales the design
  stresses at the governing section), App. D6.6; 6.10.8.2.3b (Eq. 6.10.8.2.3b-1, C_b from the factored moments that compress the
  flange); 6.10.3.2.1 (GS14); 6.10.1.6 (Eq. 6.10.1.6-4, amplification); 6.10.3.4.1 (pour sequence).
- **Check case:** skewed project of tests/smoke/steel-bridge-summary.mjs, G1 x = 130.00 ft (bottom flange 18 × 1.25, L_b = 15.47 ft =
  185.64 in, segment 115.47–130.94 ft): f_s = 3.302 ksi, F_e,s = π²(29,000)/(185.64/4.7231)² = 185.27 ksi, f_bu,gov = 7.043 ksi (x = 120).
  Before: K = 432.55, γ_e = 185.27/(432.55 × 3.302) = 0.1297, F_e = 0.913 ksi, r_t = 0.332 in, F_nc = 0.91 ksi, AF ∞, GS14 ∞.
  After: K = 9.368/3.302 = 2.837, γ_e = 185.27/(2.837 × 3.302) = 19.776, F_e = 19.776 × 7.043 = 139.28 ksi, r_t = (185.64/π)√(139.28/29,000)
  = 4.0951 in, L_p = 108.48 in, L_r = 370.32 in, F_nc = [1 − 0.3(185.64 − 108.48)/(370.32 − 108.48)](50) = 45.58 ksi, AF 1.0,
  GS14 buckling (3.302 + 9.38/3)/45.58 = 0.141, yielding (3.302 + 9.38)/50 = 0.254.
  Default project: Constructibility governing 0.758 (x = 77.00, F_nc 9.84) → 0.557 (x = 249.99, unchanged row).
  Skewed G2 x = 70.00 (top flange): K 599.8 → 1.222, γ_e 0.0200 → 9.797, F_nc 0.16 → 41.91 ksi, ratio ∞ → 0.368 (GS14 yielding).
  Same project with no skew, G2 x = 200.00: K 148.0 → 1.396, γ_e 0.113 → 11.970, F_nc 0.78 → 42.41 ksi, GS14 6.114 (false FAIL) → 0.112.
  Prismatic bays (C_b by Eq. 6.10.8.2.3b-1 from the flatter M_DCc envelope): skewed G2 x = 171–188 (segment 170.49–193.00 ft, top flange),
  1.25M + 1.5M_CL M_max, M_A, M_B, M_C = 1236.2, 1138.1, 974.8, 746.6 (M_DC1) → 1379.1, 1337.0, 1229.7, 1057.6 kip-ft (M_DCc);
  C_b = 12.5(1236.2)/[2.5(1236.2) + 3(1138.1) + 4(974.8) + 3(746.6)] = 1.222 → 12.5(1379.1)/[2.5(1379.1) + 3(1337.0) + 4(1229.7) + 3(1057.6)]
  = 1.109; F_nc 46.74 → 43.44 ksi; GS14 yielding at x = 171 0.5597 → 0.5676, largest +0.013 at x = 186 (0.4812 → 0.4942). Default project
  x = 47–67: C_b 1.198 → 1.103, F_nc 46.74 → 43.80, GS14 at x = 47 0.4320 → 0.4609 (+0.029, the largest increase on the projects probed).
  Rows changed (any GS14–GS16 ratio): default 184 of 367; skewed G1 136, G2 146 of 337; no skew G1 147, G2 148 of 337. Pour sequence off:
  0 rows changed on every project.
- **How verified:** probe of every location (default, skewed, same with no skew; pour sequence on and off) main vs branch; pour sequence
  off: identical. Re-baselined tests/engine/eta-constr.test.mjs (x = 77.00 hand values) and constructibility.test.mjs cases 3 and 4;
  `node tests/check-syntax.mjs`; steel-bridge engine tests; smoke summary, dash, wiring, report, paths, taberrors, deflection.
- **Other copies:** GirderDetail ("Steel Bridge Design.html") Preliminary sizing T.Mc builds C_b,C and nprC from 1.25M_DC1 + 1.5M_CL;
  **not changed, a deliberate difference (engineer decision 2026-11-10: fix in the new app only)**. Parity test case 3 now compares both
  bases (M_DC1 basis: 606 of 1200 governing items as GirderDetail's, as before; this app: 452 of 1200).
- **Open items:** (1) M_DCc is a per-station envelope; near M_DC1 inflections its sign jumps (skewed G2 x = 70/71/72: +565.8 / −73.8 /
  −488.3 kip-ft), so the opposite-sign pour moment is never checked there. (2) `feCb` takes |M| at the quarter points even where the
  flange is in tension, so C_b can be < 1.0 (0.83–0.90 seen). (3) K = 1 fallback when f_x ≤ 0 (follow-up PR, γ_e passed directly).
  In-app notes (Constructibility tab, after the M_c note, and Report §Constructibility, "Governing ratio of each span", from `SBDConstr.notes`):
  C_b and γ_e from the moments checked; the M_DCc envelope (items 1); C_b by Eq. 6.10.8.2.3b-1 can be below 1.0 (item 2); the difference from GirderDetail.
  Decision (pending engineer review): C_b and γ_e from the per-station M_DCc envelope (not one load case); Eq. 6.10.8.2.3b-1 refers
  to the envelope values that compress the flange, which this follows.

## 2026-11-10 — PR: claude/sb-constr-gamma-e-v2 (PR #1288: https://github.com/mlococo88/All-Structural/pull/1288) — Constructibility: γ_e of a nonprismatic deck-placement unbraced length passed directly, not rebuilt from K (SBGE; engineer decision 2026-11-10; changes computed values)
- **Problem:** `location()` rebuilt the conservative-bound γ_e at each location as F_e,s/(K f_s), K = f_max/f_x at the analysis station
  nearest the location (from `bracingC`). (a) Where M_c = 0 at that station (f_x ≤ 0: e.g. a station at a bearing or an inflection point),
  K was blank and taken as 1, so γ_e = F_e,s/f_s with the small stress at the location: γ_e and F_nc far too high (unconservative).
  (b) f_s and F_e,s were for a mixed section (the compression flange of the governing section j, the rest of the location's section), so
  γ_e differed from F_e,j/f_max,j of section j (up to −6 % on the default project: unconservative) and varied from location to location
  within one unbraced length.
- **Where:** `apps/steel-bridge/engine/constructibility.js`.
  - `bracingC`, anchor `// SBGE (2026-11-10): the bound γ_e itself`: new `nprC.gB = { ge: +G.g.toFixed(4), Fe, fm, rt, x0, x1 }` from
    `feGe` (min over the sections j of F_e,j/f_max,j). `C0 = opt.G || factors()` (was `factors()`), and `fromPayload` / `fromAnalysis`
    pass `G: prj.G`, so that γ_e is on the same factored basis (the owner's η) as f_bu,gov.
  - `location()`, anchor `const gB = !gA && nC.gB`:
    - Before: `const K = +nC.k > 0 ? Math.max(1, +nC.k) : 1, ..., ge = gA ? +gA.ge : fS > 0 ? FeS / (K * fS) : null`
    - After: `K = +nC.k > 0 ? Math.max(1, +nC.k) : null`, `fmx = Math.max(fbu, fS)`,
      `gm = gA ? 'A' : gB ? 'bound' : K && fS > 0 ? 'K' : fmx > 0 ? 'fmax' : 'none'`,
      `ge = A: gA.ge | bound: gB.ge | K: FeS/(K fS) | fmax: FeS/fmx | none: null` (F_e = γ_e f_bu,gov as before).
  - `worked()` cn.ge: the bound worked as min_j F_e,j/f_max,j with values and the rule; `SBDConstr.notes()`: the γ_e rule as a note
    (Constructibility tab and Report §Constructibility).
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.8.2.3c (Eqs. 6.10.8.2.3c-1 to -3) and C6.10.8.2.3c (γ_e is one constant for the
  unbraced length by which the design stresses at the governing section are scaled to the elastic LTB level); App. D6.6.1, D6.6.2
  (Method A with C_be = 1.0 and χ = 1 bounds it); 6.10.1.6 (amplification uses F_cr from this); 6.10.3.2.1 (GS14).
- **Rule for f_x ≤ 0 or near 0:** γ_e is computed once for the unbraced length (the bound above) and passed to every location in it, so
  the stress at the location or its nearest station does not enter. A row given without γ_e (a hand-made row): K as given where K ≥ 1
  and f_s > 0; otherwise f_max = max(f_bu,gov, f_s), the largest stress known in the unbraced length (conservative; was K = 1).
  Decision (pending engineer review): the conservative bound (each section prismatic over the whole L_b at its largest stress) is kept
  as the method where Method A does not apply; this PR only passes it on unchanged.
- **Check case 1 (regression, tests/engine/constr-gamma-e.test.mjs):** L_b 0–20 ft, section change at 10 ft, M_DC1 = 4x(80 − x)/2, M_CL = 0.
  Small section top 12 × 0.625, web 60 × 0.5, bottom 16 × 1.0: f_max = 3000(12)(35.497)/29,507 = 43.31 ksi, r_t = 2.6002 in,
  F_e,j = π²(29,000)/(240/2.6002)² = 33.59 ksi, γ_e = 33.59/43.31 = 0.7757; f_bu,gov = 25.50 ksi (large section, x = 20);
  F_e = 0.7757(25.50) = 19.78 ksi, r_t = 1.9951 in, L_r = 180.4 in < 240 in: F_nc = 19.78 ksi at x = 0.30, 5.00 and 19.70 ft.
  Before: x = 0.30 (nearest station x = 0, M = 0, K = 1): γ_e = 33.59/0.863 = 38.93, F_e = 992.7, F_nc = 49.03 ksi; x = 19.70: γ_e 0.7946,
  F_nc 20.26 ksi.
- **Check case 2 (default project, G1 x = 249.99 ft, the governing Constructibility row):** L_b 250.00–274.20 ft = 290.4 in, bottom flange.
  Section j (272.00–274.20 ft): r_t,j = 4.0790 in, F_e,j = π²(29,000)/(290.4/4.079)² = 56.47 ksi, f_max,j = 33.423 ksi, γ_e = 1.6895.
  f_bu,gov = 18.573 ksi; F_e = 31.379 ksi; r_t = (290.4/π)√(31.379/29,000) = 3.0407 in; L_p = 80.55, L_r = 274.97 in < 290.4:
  F_nc = 31.38 ksi; GS14 = 18.566/31.38 = 0.592. Before: F_e,s/(K f_s) = 53.650/(1 × 29.896) = 1.7946 (mixed section), F_nc 33.33, 0.557.
- **Changes on the probed projects:** default G1 101 of 367 rows (pour sequence on or off); governing Constructibility 0.557 → 0.592
  (x = 249.99/250.01). Largest decrease −0.003 (x = 68: γ_e 4.321 → 4.513, now one γ_e for the L_b). Skewed 100-130-100: 76–78 rows
  with a new γ_e, no ratio changed (G1 x = 130: γ_e 19.776 → 19.772, F_nc 45.58 ksi). Same with no skew: 97–98 rows, largest +0.007
  (G2 x = 99.99, F_nc 38.24 → 37.64 ksi).
- **Parity tests:** `tests/engine/constructibility.test.mjs` feeds the GirderDetail parity rows without `gB` (`gdBasis`), so the K path is
  still compared exactly (0 differences); rows on the f_max rule are counted and must not have F_nc above GirderDetail's.
- **How verified:** probe of every location, PR 1 vs this branch (default, skewed, no skew; pour sequence on and off); `node tests/check-syntax.mjs`;
  `node tests/engine/run.mjs`; steel-bridge smoke tests.
- **Other copies:** GirderDetail ("Steel Bridge Design.html") keeps F_e,s/(K f_s) with K = 1 where k is blank; not changed (engineer
  decision 2026-11-10: new app only; a deliberate difference).
- **Open items:** the M_DCc envelope sign jump near M_DC1 inflections and C_b < 1.0 from `feCb` (see the SBCON entry).

## 2026-11-10 — PR: claude/sb-constr-twosign (PR #1289: https://github.com/mlococo88/All-Structural/pull/1289) — Constructibility: both signs of the pour envelope checked; C_b and γ_e per sign case from its own side of the envelope (SBTS; engineer decision 2026-11-10, items 1 and 3; changes computed values)
- **Problem:** (1) With the pour sequence on, the M_DCc envelope (`engine/analysis.js` `seq.MDCc`) takes the positive side where M_DC1 ≥ 0 and
  the negative side elsewhere. Near an inflection of M_DC1 the pour stages give large moments of the other sign that were never checked
  (skewed 100-130-100 G2 x = 71 ft: only M_c = −73.81 kip-ft was checked; the pour stages give M_DCc+ = 408.45 kip-ft, M_c = +499.86).
  (2) C_b and γ_e came from that station-by-station envelope, which switches side between adjacent stations: not one load case.
- **Where:** `apps/steel-bridge/engine/constructibility.js`.
  - `engine/analysis.js`, anchor `// SBTS (2026-11-10): envPr / envNr`: new fields `seq.envPr`, `seq.envNr` (the pour-stage envelopes before the clip
    at 0; `envP`, `envN`, `MDCc` unchanged).
  - `fromAnalysis`, anchor `// SBTS (engineer decision 2026-11-10, items 1 and 3`: `env.MDCp = max(M_DC1, seq.envPr)`, `env.MDCn = min(M_DC1, seq.envNr)`
    at every station (`F.sides`; at a station equal to `seq.MDCc` on the side of M_DC1). Unclipped, so that where a flange is never in compression
    the diagram has the least tension (6.10.8.2.3b, M_A, M_B, M_C). Each location: `side` = sign of M_DC1 there, `M.DCc` = that side (was `at(seq.MDCc)(x)`; identical at a
    station), and `alt = { side: −side, DCc: other side, ...bracingC(x, env, { side: −side }) }` where the other side has the opposite sign by more
    than 0.01 kip-ft (`SIDE0`).
  - `bracingC(x, env, opt)`: `opt.side` = ±1 takes `Mc = γ_DC·MDCp|MDCn + γ_CL·M_CL` (was `γ_DC·(useDCc(MDCc[k]) ? MDCc[k] : MDC1[k]) + γ_CL·M_CL`);
    `govRec` records the side's M_DCc with `side`; `gsGovC` uses a side's M_DCc as recorded (0 included). Returns `side`.
  - `location(L, prj)`: the former body is `locCase`; with `L.alt` both cases are computed (`locCase(L)`, `locCase({ ...L, ...L.alt, M.DCc: alt.DCc })`),
    the larger governing ratio is returned (`L.side` on a tie) with `.cases` and `.alt`. Without `L.alt`: unchanged.
  - `girder()`: the span results take the checks of both cases (`o.cs` = the case).
  - `worked()` cn.Mc names the case and both cases' M_c and ratios; cn.Cb / cn.ge name the side diagram. `notes(seq, sides)`: the two-sign
    note and the basis note replace the open-item note; a file / entered rows (one M_DCc per station): a note that one case is checked.
  - `ui/constructibility.js`: the location list names the case; the detail shows the other case's checks with its § links and a button for
    its worked steps. `report/builders.js` §Constructibility: the other case's checks and worked steps (scope `cn@i~`), span cells name the case.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.3.4.1 (the girder is checked for the moments of the deck placement sequence);
  6.10.3.2.1, 6.10.3.2.2 (GS14, GS15); 6.10.1.6 (f_ℓ amplification, per case); 6.10.8.2.3 and C6.10.8.2.3 (C_b, Eq. 6.10.8.2.3b-1, from the
  moment gradient of the unbraced length; its M_max, M_A, M_B, M_C from the envelope values with the largest compression in the flange considered,
  or the least tension where never in compression: the side envelope of that flange); 6.10.8.2.3c and C6.10.8.2.3c, App. D6.6 (γ_e scales the design stresses of the moments checked).
- **Basis (item 3):** each sign case takes C_b and γ_e from its own side of the envelope over the whole unbraced length. Decision (pending
  engineer review): the diagram of the governing single pour stage was not used, because no single stage gives the largest moment of either
  sign at every station of an unbraced length; the side envelope is the one used by the check at each station of that sign case.
- **Decision (pending engineer review):** M_CL is taken as given at the location in both cases (as before); a case's M_c can then take the
  other sign where M_CL outweighs a small pour moment, and its flange in compression follows M_c. A side smaller than 0.01 kip-ft is zero.
- **Check case (skewed 100-130-100, G2 x = 71.00 ft, tests/engine/constr-twosign.test.mjs):** positive case M_c = 1.25(408.45) + 1.50(−7.14) =
  499.86 kip-ft; steel section ȳ = 26.495 in, I = 40,759 in⁴: f_bu = 499.86(12)(62.000 − 26.495)/40,759 = 5.225 ksi (top flange); f_ℓ = 12.50 ksi;
  GS14 yielding (5.225 + 12.50)/50 = **0.3545** (governs); F_nc = 41.91 ksi (γ_e 9.7961). Negative case as before: M_c = −73.81, GS15 tension
  0.2654. Before: 0.2654 (only the negative case).
- **Other stations:** skewed G2 x = 131: negative case M_c = −504.92 kip-ft, top flange in tension 5.278 ksi, GS15 (5.278 + 12.50)/50 = 0.3556
  (was 0.2639, M_DC1 only); default x = 78: positive case M_c = 620.89, GS14 6.693/40.00 = 0.167 (was 0.096). Unchanged: skewed G2 x = 70 (0.3683)
  and x = 72 (0.3521, positive case 0.3404 also checked); skewed G1 x = 130 (0.2761); no skew G2 x = 200 (0.1124); default x = 47–67.
- **Rows changed (reported row):** default 18 of 367 (145 with two cases); skewed G1 18 / G2 15 of 337; no skew G1 18 / G2 20 of 337. Governing
  Constructibility unchanged on all five (0.592, 0.513, 0.639, 0.544 OH1, 0.437). Largest decrease −0.011 (no skew G1 x = 75, item 3).
- **Other projects / stations:** see PR. Pour sequence off: 0 rows changed (byte-identical probe). A hand-off file or Custom demands
  (one M_DCc per station): unchanged.
- **Other copies:** GirderDetail ("Steel Bridge Design.html") not changed (engineer decision: new app only); it checks one M_DCc per station.

## 2026-11-10 — PR: claude/sb-constr-cb-min (PR #1290: https://github.com/mlococo88/All-Structural/pull/1290) — Constructibility: C_b not taken below 1.0 (SBCB; engineer decision 2026-11-10, item 2; changes computed values)
- **Open-item note removed:** the SBCON entry's open item 2 (C_b < 1.0 from `feCb`) is resolved here; PR #1289 resolved items 1 and 3.
- **Problem:** Eq. 6.10.8.2.3b-1 as applied (`feCb`: M_max the largest moment compressing the flange, M_A, M_B, M_C the absolute values at the
  quarter points) gives C_b < 1.0 where the flange is in tension over part of the unbraced length (0.217 at skewed G1 x = 153, negative case;
  0.525–0.90 with the pour sequence off). It was used as computed, so F_nc dropped below the uniform-moment value.
- **Where:** `apps/steel-bridge/engine/constructibility.js` (`const CB_MIN = 1.0`).
  - `bracingC`, anchor `// SBCB (2026-11-10): Cb = max(1.0, Eq. 6.10.8.2.3b-1)`: before `Cb: n2_.kind === 'ge' ? 1 : feCb_(xs, Mc, p0, p1, sgC)`;
    after `Cb: n2_.kind === 'ge' ? 1 : Math.max(CB_MIN, feCb_(...))`, `Cb0` the unbounded value (also in `cbParts.Cb0`). The segment choice
    (largest L/C_b) uses the bounded value.
  - `locCase` (C_b of a row): before `r.CbCu = r.CbC > 0 ? r.CbC : r.Cb`; after `r.CbRaw = r.CbC > 0 ? r.CbC : r.Cb; r.CbCu = Math.max(CB_MIN, r.CbRaw)`
    (F_nc, and the 6.10.1.6 amplification limit 1.2L_p√(C_bR_b/(f_bu/F_yc)) through `ampFl`).
  - `overhang()`: before `Cb = +q.Cb`; after `Cb = Math.max(CB_MIN, +q.Cb)` (an entered value below 1.0 is raised; the worked LTB label says so).
  - `worked()` cn.Cb: `max(1.0, 12.5M_max/(…) = value)`, and the note gives the unbounded value where the bound applies. `notes()`: the
    "used as computed" note is replaced by the bound and its basis.
  - `engine/flexure.js` `feCb` is not changed (the Flexure tab's own C_b is out of scope).
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.8.2.3b (Eq. 6.10.8.2.3b-1, definitions of M_max, M_A, M_B, M_C); C6.10.8.2.3b (C_b has a
  base value of 1.0 for a constant moment and may be taken as 1.0 conservatively in all but the unusual cases named); 6.10.8.2.3 (F_nc,LTB);
  6.10.1.6 (amplification limit with C_b).
- **Check case (skewed G1 x = 153.00 ft, negative case, tests/engine/constr-cb-min.test.mjs):** L_b 130.94–153.46 ft = 270.12 in, top flange 16 × 0.75
  (M_c = 1.25(−85.21) + 1.50(86.01) = +22.52 kip-ft). Eq. 6.10.8.2.3b-1 = 12.5(28.30)/[2.5(28.30) + 3(266.35) + 4(150.83) + 3(52.58)] = 0.217 →
  C_b = 1.0. r_t = 3.7183 in, L_p = 98.50, L_r = 336.24 in: F_nc = [1 − 0.3(171.62/237.74)](50) = 39.172 ksi; GS14 (0.235 + 9.38/3)/39.172 = 0.0858.
  Before: F_nc = 0.217(39.172) = 8.50 ksi, 0.3955 (governed the location). The location now reports the positive case, 0.3837 (GS14 yield).
- **Rows changed:** pour sequence on: the reported row changes at 1 location (skewed G1 x = 153); a non-governing case changes at 2 (default),
  5 (skewed G1), 1 (skewed G2), 5 (no skew G1) locations. Governing Constructibility unchanged on all five projects.
- **Pour sequence off (not unchanged, listed):** GS14 buckling ratios drop at default 0, skewed G1 3 (x = 70–72: C_b 0.525 → 1.0, F_nc 23.42 → 44.61),
  skewed G2 5 (x = 126–130: 0.88 → 1.0), no skew G1 12 and G2 12 (x = 70–75, 255–260: 0.89–0.90 → 1.0) locations; no governing ratio of a location
  or of a project changes.
- **Other copies:** GirderDetail ("Steel Bridge Design.html") uses C_b as computed; not changed (new app only; a deliberate difference).

## 2026-11-10 — PR: secgfx-optionc (PR #1291: https://github.com/mlococo88/All-Structural/pull/1291) — Section properties graphic in the data-viz style (mockup option C, engineer decision 2026-11-10); new `ui/vizkit.js` (SECC)   [display only; no computed value, formula, saved key or format change]
- **Request:** replace the Section properties tab's "Section graphic" (a SharedDxf line drawing in the zoom / pan viewer) with mockup option C: a filled section (slate steel, warm-grey deck and haunch, brown bars), a y ruler with every neutral axis as a tick, only the selected case's ENA drawn across and labelled, a segmented control for the load case, six stat tiles, a stress diagram with a gradient through zero at ȳ and value badges, chips for the other axes, a hover / tap read-out. Engineer follow-up (same day): build the pieces as a reusable module for the other CAD-style graphics later (not changed here).
- **Where:**
  - `apps/steel-bridge/ui/vizkit.js` (new, `window.SBDVizKit`; API at the top of the file): palette and CSS (classes `vk-*`, scoped to an element of class `vk`), print grey + hatch (`@media print`), forced-colours rules and `color-scheme: only light`, segmented control and chips (buttons with `aria-pressed`), stat tiles, `wire` (their clicks), SVG primitives, hatch `defs`, `grad` (gradient through zero), `stack`, `niceStep`, `ruler`, `diagram` (area split at zero, gradient on screen, grey / hatched in print, profile, badges), `readout` (hover with the mouse; a tap or click shows the same and keeps it), `fit` (redraw when the element's width changes: window `resize` and `sbd2:panelresize`; stops when the element leaves the page), `print` (beforeprint / afterprint hooks), `DXF_NOTE`.
  - `apps/steel-bridge/ui/gfxa.js`: `function section(slot, o)` rewritten (anchor `/* ================= Section properties: the screen graphic (SECC`); new `SEC_CASES`, `secModel(P, R, cs)`, `secSvg(m, W, show)`, `sgnF`; `secModel` exported on `SBDGfxA`. Before: `section()` built `block()` (a `<select id="gfx_sec_c">` "Stress diagram, load case") and `GR().mount(host, () => secGraphic(o.P, o.R, cur, o.seg), { key: 'sec' })`. After: the option C card; Download DXF calls `GR().download(secGraphic(o.P, o.R, m.key, o.seg))`. `secGraphic` (the DXF drawing model) is **unchanged**. File header: the API line of `section` and the "Needs" line.
  - `apps/steel-bridge/index.html`: `'ui/vizkit.js'` added to the second loader list, before `'ui/gfxa.js'`.
  - Tests: `tests/engine/gfxa.test.mjs` new test (secModel = secGraphic's stresses and axes, every case, both regions, 6 projects; built-in steel case +10.78 / −9.04); `tests/smoke/steel-bridge-graphics.mjs` Section properties part rewritten for the new card (below).
- **Numbers (CLAUDE.md §4):** no new calculation. Every number is one the tab already shows (ȳ, I, S_top, S_bot, A of the table; n; y_p, M_p; deck t_s, haunch per `SBDOwners.haunchInProps` as `secGraphic`, b_eff, bar areas) or the stress per 1000 kip-ft that `secGraphic` already drew, with the same expression: `ff = y => M * 12 * (y - sc.yb) / sc.I` (M = 1000), steel from y = 0 to d, deck from d + h_h to d + h_h + t_s times `1 / K.f` (K.f = 1, 3n or n), shown to 2 decimals with the same `toFixed` digits (a sign added: + compression, − tension, as the old "C + / T −"). Checked: engine test (every stress string of the DXF = the screen value) and the main-vs-branch tab probe (PR description).
- **Check case:** built-in project, G1 segment 1, positive region. DC1 steel: ȳ = 28.213 in, I = 37,472 in⁴: f top = 1000 × 12 (61.875 − 28.213) / 37,472 = +10.78 ksi, f bottom = 1000 × 12 (0 − 28.213) / 37,472 = −9.04 ksi (old drawing: "10.78 KSI", "-9.04 KSI"). LL+IM n: ȳ = 55.100 in, I = 106,168 in⁴, n = 6.798: +0.77 / −6.23 ksi steel, deck bottom 1000 × 12 (63.875 − 55.100) / 106,168 / 6.798 = +0.15, deck top (71.875) = +0.28 ksi. DC2, DW 3n: ȳ = 44.565, I = 79,056, 3n = 20.393: +2.63 / −6.76, deck +0.14 / +0.20 ksi.
- **Show the work (§6):** the stress tiles' § link to the worked lines under the graphic (each badge value as `1000 × 12 (y − ȳ) / I [/ n or 3n] = f`); the ȳ, I, S and A tiles' § link to their worked steps (`sec.<s|c3|cn>.yb|I|St|A`). Notes (#1284): sign convention and unit moment of 1000 kip-ft on the selected case's section (as the old note), y from the bottom of the steel, haunch not in the composite section (no stress drawn), bars at a schematic spacing, the negative-region diagram is the same positive unit moment; and that Download DXF is the line drawing.
- **Print:** grey steel, white deck, black bars, compression grey, tension hatched, black badges (no colour); controls, chips and read-out hidden; the caption lists all four (composite) neutral axes with their names and values. A page narrower than 760 px redraws the wide layout for printing. The Report has no section figure (report/builders.js `sec()` prints tables and steps only), so nothing to change there.
- **Saved data (§5):** none. The selected case (`S.secCase`, default steel, as before) and the chips (`S.secShow`) are page-session state in `ui/gfxa.js`; no storage key.
- **Decisions (pending engineer review):**
  1. The +/−/Fit zoom buttons are removed: the graphic fits its card at every width (redrawn on resize and on the splitter's `sbd2:panelresize`).
  2. For the steel case the sixth tile is A (as in mockup C), since the deck is not stressed under DC1; the composite cases show f top of deck.
  3. Load-case default stays DC1 steel (the old selector's default; the mockup opened on n).
  4. Layout: the drawing is at most 360 px tall (250 px at phone width) and centred in the card; the deck is drawn broken (mockup break lines) when b_eff does not fit beside the stress diagram; tiles 3 across below 860 px of card width; the phone layout (card below 600 px) drops the ruler's axis names (the chips list them).
  5. Hover read-out is also written as text under the graphic (`aria-live`); the tiles carry the key stresses for keyboard and screen-reader users.
- **Raised, not changed (§4):** in the negative-flexure region the diagram (old and new) still uses the n and 3n composite sections and a positive unit moment; the tab's negative-region R_h and D_c use the steel + rebar section (`c.cr`, `rh.cr.Rh`, `dc.steelrebar`). Should the negative-region graphic show the steel + rebar section (and a negative unit moment)? Not changed here: it would change the stresses shown.
- **Other copies:** none.
- **How verified:** main (9b8942e) vs branch, headless, Section properties tab, pos / neg × steel / 3n / n: tab text outside the graphic card identical (97 / 96 digit groups); the graphic's only digits not elsewhere on the main tab are the ruler scale (0–70), 12 (in/ft), the haunch 2.00 in and the y values 0.000 / 63.875 / 71.875 of the worked lines; 0 console errors. check-syntax, engine gfxa (6/6) and graphics-overlap, smoke graphics (new section checks), tabgraphics-b, report, phone-layout sbapp, scroll and 8 other steel-bridge smoke tests pass.

## 2026-11-10 — PR: claude/sbd-famb-viz (PR #1292: https://github.com/mlococo88/All-Structural/pull/1292) — Along-girder graphics in the data-viz style (option C), part 1: new `ui/vizalong.js` and `ui/alonggfx.js`; Analysis, Flexure (elevation and stress checks) and Constructibility graphics (SBVZB)   [display only; no computed value, formula, saved key, format or DXF change]
- **Request:** engineer decision 2026-11-10: restyle every on-screen CAD-style graphic of the Steel Bridge app in the "option C" style of the Section properties graphic (#1291). Rules: Download DXF exports the old SharedDxf drawing byte for byte; the Drawings tab sheets stay CAD; shared/ unchanged. This entry: family (b), the graphics along the girder, part 1: #3 Analysis, #4 Flexure elevation, #5 Flexure stress checks, #7 Constructibility.
- **Where:**
  - `apps/steel-bridge/ui/vizalong.js` (new, `window.SBDVizAlong`; API at the top): `render(spec, W)` (rows on one station scale: `elev` girder elevation with ratio fills, marks, stiffeners, welds, flags / dims / boxes / cells above and below; `band`; `chart` with gridlines, support lines, series, cap, limits, labels; station axis; selected-station line), `hbars(spec, W)` (category bars), `staticSvg(spec, W)` (style inside the SVG), `mount(slot, o)` (the card: title, Download DXF, fitted figure redrawn on `resize` / `sbd2:panelresize` and at ≥ 760 px for print, hover / tap read-out, click select, chips, legend, caption, notes, DXF note), `legend`, `swatch`, `sub`; style sheet `SVGCSS` (svg.va) with the print grey / hatch rules and forced colours.
  - `apps/steel-bridge/ui/alonggfx.js` (new, `window.SBDAlongGfx`): `geo(P, gi)` (the girder of `SBDGraphics.elevation`), `plates`, `platesCap`, `analysis(slot, o, A)`, `flexure(slot, o, A)`, `flexChecks(slot, o, A)`, `constr(slot, o, A)`.
  - `apps/steel-bridge/ui/gfxa.js`:
    - `function analysis(slot, o)`: before `const opts = R.x.map((x, i) => [String(i), ...` added `if (window.SBDAlongGfx && window.SBDVizAlong && window.SBDVizKit) return window.SBDAlongGfx.analysis(slot, o, { build, getSel: () => S.anSel, setSel: k => { S.anSel = k; } });`.
    - `function flexure(slot, o)`: before `const H = G.mount(A, bld, { key: 'fx', ... });` after `const viz = window.SBDVizAlong && window.SBDVizKit && window.SBDAlongGfx; const H = viz ? viz.flexure(A, o, { build: bld }) : G.mount(A, bld, { ... });`. The stress-check builder: before `G.mount(B, () => { ... }, { key: 'fxb' });` after `const bldB = () => { ... }; if (viz) viz.flexChecks(B, o, { build: bldB }); else G.mount(B, bldB, { key: 'fxb' });` (the builder's body unchanged).
    - `function constr(slot, o)`: before `const H = G.mount(A, () => { ... }, { key: 'cn', selected: sel, onSelect: ... });` after `const bldA = () => { ... }; const viz = ...; const H = viz ? viz.constr(A, o, { build: bldA }) : G.mount(A, bldA, { key: 'cn', selected: sel, onSelect: ... });` (body unchanged).
  - `apps/steel-bridge/index.html`: `'ui/vizalong.js'` and `'ui/alonggfx.js'` added to the second loader list before `'ui/gfxa.js'`.
  - Tests: `tests/smoke/steel-bridge-dxf-unchanged.mjs` (new): Download DXF of each family (b) graphic (with and without a table selection) from `origin/main` (git archive) and from the working tree, byte for byte; `tests/smoke/steel-bridge-graphics.mjs`: the Analysis, Flexure and Constructibility parts rewritten for the card (no zoom buttons, read-out, click-select, chips, resize, pour table).
- **Numbers (CLAUDE.md §4):** no new calculation. Each number is one the tab already has, with the old drawing's or the table's digits: Analysis moments and camber (`nz(…, 1 / 0 / 3)` as the old read-out), Flexure bands (`SBDGraphics.mergeBands` of the same items, `nf(ratio, 2)`, classes of `ratioColor`), stress-check bars (`nf(v, 0)` ksi, `nf(ratio, 2)`, read-out `SharedUnits.fmt(…, 2 / 3)` as the table), Constructibility (`nf(Mc, 1)`, ratios `nf(…, 3)`, pours `nf(…, 1)`), plate sizes `SharedDxf.frac`, span lengths `SharedDxf.fmtFtIn`.
- **Check case:** built-in project with one field splice at 82 ft, G1. Flexure: governing row 255 (x = 249.99 ft), ratio 1.23 (old flag "GOVERNS (ROW 255): 1.23", new "Governs (row 255): 1.23"); stress checks at x = 249.99 ft: GS7 fnc demand 40 / capacity 32 ksi (bars), ratio 1.23. Constructibility: governing GS14 0.592 at x = 249.99 ft; band 0.59 (old "0.59"); pours 1 0.0–78.0, 2 144.0–217.0, 3 283.0–360.0, 4 78.0–144.0, 5 217.0–283.0 ft (old table in the drawing). DXF: 18 / 18 graphics byte-identical to origin/main (7463141).
- **Show the work (§6, #1284):** notes in the cards: the elevation is not to scale vertically (S, FS, cross-frames; plate sizes in the read-out and in the plate-segment line); deflection drawn downward (camber upward); band merging and ratio classes; rounding of the bars; the source of the pours and M_DCc; Download DXF is the CAD line drawing.
- **Saved data (§5):** none; chips (`SBDAlongGfx._S.hide`) and the selections are page-session state.
- **Decisions (pending engineer review):**
  1. The along-girder pieces are a new file `ui/vizalong.js` (`SBDVizAlong`) beside `ui/vizkit.js`, not inside it, so that the section and along-girder pieces stay separate.
  2. The elevation has a fixed web height (56 px; 40 px on a phone), flanges and deck at a legible thickness, instead of the old vertical exaggeration; the flange sizes moved from the drawing into the read-out and the plate-segment line under the graphic.
  3. A general DXF note for these graphics (vizkit's names the section).
  4. Analysis keeps its Station selector; Flexure and Constructibility select by click on the graphic or the table.
  5. Series colours from the C palette; dashed series as before; in print each series is black with its own dash pattern.
- **Other copies:** none.
- **How verified:** main (7463141) vs branch, headless, built-in project with one splice: tab text outside the graphic cards identical (Analysis 5891, Flexure 5040, Constructibility 3244 digit groups); digits new in the graphics: tick values (2.0, 0.5), the plate-segment x values, span lengths; 0 console errors. check-syntax; engine gfxa 6/6, graphics-overlap, tabgraphics-b, report; smoke graphics, dxf-unchanged (18 / 18), report, summary, phone-layout sbapp, tabgraphics-b.

## 2026-11-10 — PR: claude/sbd-famb-viz-2 (PR #1296: https://github.com/mlococo88/All-Structural/pull/1296) — Along-girder graphics in the data-viz style (option C), part 2: Shear, Fatigue (details and chart), Welds, Rating and the Report / Summary figure (SBVZB)   [display only; no computed value, formula, saved key, format or DXF change]
- **Request:** engineer decision 2026-11-10 (as part 1, #1292): family (b) part 2: #9 Shear and stiffener layout, #12 Fatigue details and stud zones, #13 Fatigue stress range chart, #15 Weld locations, #19 Rating factor chart, #21 Report summary figure (also on the Summary tab).
- **Where:**
  - `apps/steel-bridge/ui/vizalong.js`: `placeFlags` (anchor `/* ---------- label placement`): leaders at one x share their line (two details at one station could not be placed: `y` NaN) and an item that finds no row takes the next one; `KIND.elev`: `yAt(x, 'top')`, marks `dx` / `small`, `row.areas` (click areas over the web), `row.webLabels`, below-the-girder parts start 30 px (was 26) under the flange; `parts 'cells'`: one ring round the strip when every cell is selected; `KIND.band`: `areas`, `selBox`; `KIND.chart`: `rings`, `regs` with a value range (`y0v`, `y1v`), the automatic range no longer adds a step under zero (`Math.floor(lo / st0 + 1e-9)`, was `- 1e-9`); new `KIND.text`.
  - `apps/steel-bridge/ui/alonggfx.js`: new `shear`, `fatigue`, `fatigueChart`, `welds`, `rating`, `summarySpec`, `summarySvg` (anchor `/* ================= family (b), second half`), from the same data as `engine/tabgraphics-b.js` `shear()`, `fatigue()`, `fatigueChart()`, `welds()`, `ratingChart()`, `summary()` (copies of its small helpers `FLOC` without exaggeration, `maxRatio`, `rfSeries`, `MODS`, `sumLabel`, marked "as engine/tabgraphics-b.js").
  - `apps/steel-bridge/ui/tabgraphics-b.js`: new `putC(host, name, ctx, make, viz, o2)`; `shear()`, `fatigue()`, `welds()`, `rating()` call it for `shear`, `fatigue`, `fatigue-chart`, `welds`, `rating` and fall back to `put()` without the new files. Download DXF exports `wrap(make(TX), file).D` (the old drawing, the same selection passed in).
  - `apps/steel-bridge/ui/summary.js` `figure(P, Gs)` and `apps/steel-bridge/report/builders.js` `summaryFig(B, X)`: `SBDAlongGfx.summarySvg(...)` first (a static SVG with its style sheet inside), the old `tightSvg` drawing otherwise; the Report caption adds the colour classes and "not to scale vertically".
  - Tests: `tests/engine/vizalong.test.mjs` (new): render() in Node at 1400 / 390 px; the summary figure's flags, band values and list against the old drawing's texts (built-in and four payloads, 69 flags); `tests/smoke/steel-bridge-tabgraphics-b.mjs`: shear, fatigue, fatigue-chart, welds, rating checked as cards (click areas in px, no zoom buttons, Download DXF captured).
- **Numbers (CLAUDE.md §4):** no new calculation; the old drawings' digits: shear ratios `f2` / `f3`, spacing `SharedDxf.fmtFtIn` and `f2(d_o / D)`, fatigue `f2` / `f3`, stud counts `SBDTabGfxB.studCount`, weld sizes `SharedDxf.frac`, RF `f2`, stations `f1`, the rating scale cap `max(2, ceil(1.05 min(max RF, 5) × 2) / 2)` as before, summary `f3` / `RF f2` / bands `nf(r, 2)`.
- **Check case:** built-in project with one field splice at 82 ft, G1: Shear: BS1 governs 0.692, TS1 governs 0.667, panel governs 0.435, GS11 0.437; spacing 15 @ 4'-4 3/4" (0.88D), 30 @ 4'-8" (0.93D) (old drawing the same texts in capitals). Rating: Inventory RF 0.61 and Operating RF 0.79 at 250.0 ft, scale capped at RF 5.5. Summary: span 2 NG (RATING INV RF 0.61), span 3 0.71. DXF 18 / 18 byte-identical to origin/main (78a8609), hashes equal to the part-1 run against 7463141.
- **Show the work (§6, #1284):** notes in each card (what the colours and labels are, the station row, the stud zone labels, the weld marks, the RF of a station = the smallest of its rows and the capped scale, not to scale vertically, the plate segments) and the DXF note; the Report caption gives the colour classes.
- **Saved data (§5):** none.
- **Decisions (pending engineer review):**
  1. The Report / Summary figure is drawn at 760 px and scaled to the page (static SVG, its style inside, prints grey / hatched); its flag texts keep the old abbreviations in capitals (FLEX GS7, RATING INV …) since they are labels of the table rows.
  2. Shear: the stiffener spacing runs are drawn just above the deck, the flags above them; the panel ratio is written in the panel where it is not green or governs (as before).
  3. Fatigue chart: resistance hollow, demand filled in its FA1 class colour; chips switch either set off. Fatigue details at one station share one leader.
  4. Rating: Inventory solid, Operating dashed, flexure navy and shear teal (old: blue and green); the governing labels are flags above the plot.
- **Other copies:** `FLOC`, `maxRatio`, `rfSeries`, `MODS`, `sumLabel` copied from `engine/tabgraphics-b.js` into `ui/alonggfx.js` (keep in step).
- **How verified:** main (78a8609) vs branch, headless, built-in project with one splice: tab text outside the graphic cards identical (Shear 4929, Fatigue 12426, Welds 1739, Rating 15218, Summary 229, Report 61866 digit groups); digits new in the graphics: the plate-segment x values only; digits of the old drawings no longer printed: the scale-bar 30 / vertical exaggeration 5.0, the fatigue chart's old ticks 13.5 / 14.5 / 16.5, the summary legend 0.90 / 1.00 (now in the Report caption); 0 console errors. check-syntax; engine gfxa, graphics-overlap, tabgraphics-b, report, vizalong; smoke graphics, tabgraphics-b, dxf-unchanged (18 / 18), report, summary, phone-layout sbapp.

## 2026-11-10 — PR: claude/secgfx-neg (PR #1293: https://github.com/mlococo88/All-Structural/pull/1293) — Section properties graphic, negative-flexure region: the steel and steel + rebar sections under a negative unit moment (SECN; engineer decision 2026-11-10)   [display only: the graphic's stresses change; no engine value, formula, saved key or format change]
- **Request (engineer decision 2026-11-10, raised in SECC #1291):** in the negative-flexure region the section graphic shows the section the tab's negative-region checks use, steel + longitudinal deck rebar (deck concrete not effective in tension), under a NEGATIVE unit moment; before, it showed the n / 3n composite sections with a positive unit moment there.
- **Which sections the engine uses in the negative region (found, not changed):** `engine/flexure.js` `location()`: `secs = ... : { DC1: s, DC2: cr, DW: cr, LL: cr }` (composite, negative), stresses `fAt = -M·12(y − ȳ)/I` (tension +); `engine/sections.js` `card()`: `rh = hybrid(p, pos ? cn : cr, ...)` (R_h, `rh.cr.Rh`), `dcR = dc(p, cr, 'bot', 'steel + rebar')` (D_c, `dc.steelrebar.bot.Dc`); `withRebar()` (`sec.cr`: A, ȳ, I, S_top, S_bot, y_rt, y_rb; Art. 6.10.1.1.1c). Noncomposite: the steel section for every stage. Every property drawn is the card's own (`R.c.s`, `R.c.cr`); nothing new is computed.
- **Where:** `apps/steel-bridge/ui/gfxa.js` (anchor `/* ================= Section properties: the screen graphic (SECC`):
  - new `SEC_CASES_NEG` (anchor `const SEC_CASES_NEG = {`): `steel` "Steel (DC1)" (`c.s`), `cr` "Steel + rebar (DC2, DW, LL)" (`c.cr`); `S.secCaseNeg = 'steel'` (page session, no storage; the positive region keeps `S.secCase`).
  - `secModel()`: before `const key = comp && SEC_CASES[cs] ? cs : 'steel', f = key === 'steel' ? 1 : key === '3n' ? 3 * R.nr.n : R.nr.n, sc = key === 'steel' ? c.s : key === '3n' ? c.c3 : c.cn, M = 1000;` after `neg = c.region === 'neg', CS = neg ? SEC_CASES_NEG : SEC_CASES; const key = comp && CS[cs] ? cs : 'steel', f = key === 'steel' || key === 'cr' ? 1 : ..., sc = key === 'steel' ? c.s : key === 'cr' ? c.cr : ..., M = neg ? -1000 : 1000;` (same `ff = y => M * 12 * (y - sc.yb) / sc.I`). New `rebar` (case `cr` only): `{ w, A, y: c.cr.yRt | c.cr.yRb, f: ff(y) }` per layer with A > 0. Negative axes: PNA (neg), ENA steel + rebar (`c.cr.yb`, `sec.cr.yb`), ENA steel; no n / 3n ticks. Returns `neg, M, rebar, CS` too.
  - `secSvg()`: gradient from the bottom up when `m.neg` (`VK.grad('vk-sgr', Y(0), Y(H), m.sc.yb / H)`); deck and haunch with `style="fill:url(#vk-sgh);stroke-dasharray:4 3;opacity:.75"` (local hatch pattern `vk-sgh`) and 2–8 crack lines (`crk`) from the top face; b_eff label "· concrete not effective (cracked)" (phone: "· cracked"); bar stresses as `pts` of `VK.diagram`; read-out "deck concrete: not effective in negative flexure" and, within 0.5 in of a layer, "top / bottom rebar · f".
  - `section()`: the region's buttons (`m.CS`); sixth tile "f top rebar" (first layer) in case `cr`, A otherwise; worked lines `(−1000) × 12 (y − ȳ) / I` plus one line per bar layer linked to `sec.cr.yRt` / `sec.cr.yRb`; header "stress per −1000 kip-ft (negative flexure)"; negative caption; negative in-app note (sign convention, −1000 kip-ft, sections per stage, the bars' stress, "concrete not effective in negative flexure", AASHTO LRFD 10th Ed. Art. 6.10.1.1.1c paraphrased; noncomposite: steel section, 6.10.1.1.1a); the former sentence "Negative-flexure region: the same positive unit moment is drawn ..." removed. Download DXF: `secGraphic(o.P, o.R, m.key === 'cr' ? 'steel' : m.key, o.seg)`; `secGraphic` itself unchanged (engineer: do not change the DXF), so the negative-region DXF is still the earlier basis (positive unit moment, steel case); the note says so.
- `apps/steel-bridge/ui/vizkit.js`: `diagram()` takes optional `pts: [{ y, f }]` (a stem `gpc` / `gpt` and a dot `gpcd` / `gptd`, badged and stacked with the segments' badges); CSS for those classes (screen colours, print black via the variables, forced colours). Additive; no change for callers without `pts`.
- **Displayed values that change (§4), built-in project, G1 segment 1, Flexure region = Negative** (per unit moment; compression +):
  - Buttons: before "DC1 · steel", "DC2, DW · long-term 3n", "LL+IM · short-term n"; after "Steel (DC1)", "Steel + rebar (DC2, DW, LL)".
  - DC1 steel: ȳ 28.213, I 37,472 (unchanged); f top +10.78 → −10.78 ksi, f bottom −9.04 → +9.04 ksi (M = +1000 → −1000).
  - DC2, DW (before 3n: ȳ 44.565, I 79,056, S 4,567 / 1,774, f top steel +2.63, bottom −6.76, deck +0.14 / +0.20, tile "f top of deck" +0.20) → steel + rebar: ȳ 33.535, I 51,050, S 1,801 / 1,522, f top −6.66, bottom +7.88, top rebar −8.42, bottom rebar −7.54 ksi, no deck stress, tile "f top rebar" −8.42.
  - LL+IM (before n: ȳ 55.100, I 106,168, S 15,670 / 1,927, +0.77 / −6.23, deck +0.15 / +0.28) → the same steel + rebar values as DC2, DW.
  - Ruler ticks: before PNA 36.245, n 55.100, 3n 44.565, steel 28.213; after PNA 36.245, s+r 33.535, steel 28.213.
  - Positive region: unchanged (main vs branch, Section properties card innerHTML, steel / 3n / n at 1440 and 390 px: byte-identical).
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Art. 6.10.1.1.1c (negative flexure: steel section plus longitudinal reinforcement within b_eff for short- and long-term moments); 6.10.1.1.1a (noncomposite: steel section). No engine change.
- **Check case (hand):** built-in project, G1 seg. 1, negative region, steel + rebar (`sec.cr`): A = 63.75 + 6.60 + 3.20 = 73.55 in²; y_rt = 61.875 + 2.00 + 8.00 − 2.50 = 69.375 in, y_rb = 61.875 + 2.00 + 1.75 = 65.625 in; ȳ = (63.75 × 28.213 + 6.60 × 69.375 + 3.20 × 65.625) / 73.55 = 33.535 in; I = 51,050 in⁴. M = −1000 kip-ft: f top of steel = −1000 × 12 (61.875 − 33.535) / 51,050 = −6.66 ksi (tension); f bottom = −1000 × 12 (0 − 33.535) / 51,050 = +7.88 ksi (compression); f top rebar = −1000 × 12 (69.375 − 33.535) / 51,050 = −8.42 ksi; f bottom rebar = −1000 × 12 (65.625 − 33.535) / 51,050 = −7.54 ksi. Steel (DC1): −1000 × 12 (61.875 − 28.213) / 37,472 = −10.78, −1000 × 12 (0 − 28.213) / 37,472 = +9.04 ksi. The flexure engine's stage stresses for −1000 kip-ft (`location()`, tension +) are the same numbers with the sign reversed (DC2.top +6.66, DC2.bot −7.88).
- **Saved data (§5):** none (`S.secCaseNeg` is page-session state).
- **Tests:** `tests/engine/gfxa.test.mjs`: the secModel = DXF test is the positive region only; new negative-region test: every project, buttons `steel`, `cr`; each case's section is the card's `s` / `cr`; segment and bar stresses = −1000 · 12 (y − ȳ)/I from the card's own ȳ, I, y_rt, y_rb; top flange and bars in tension, bottom in compression; no deck segment; axes; and the flexure engine's `location()` puts DC1 on `card.s`, DC2 / DW / LL on `card.cr` with the same stresses (sign reversed); hand-check values above. `tests/smoke/steel-bridge-graphics.mjs`: negative region (buttons, tiles, badges, hatch, cracks, bar stems, note with 6.10.1.1.1c, DXF download).
- **How verified:** check-syntax; engine run (all); smoke graphics, phone-layout --tool sbapp, tabgraphics-b; browser probe 1440 / 390 px, 0 console errors, no horizontal scroll; positive-region card byte-identical to main.
- **Other copies:** none.
- **Open items:** the DXF (secGraphic) still draws the earlier basis in the negative region (engineer: leave the DXF unchanged).

## 2026-11-10 — PR: sbd-gfx-details (PR #1295: https://github.com/mlococo88/All-Structural/pull/1295) — detail drawings in the option C style: Flexure LTB sketch, overhang bracket, transverse and bearing stiffeners, cross-frame elevation, weld size detail, field splice (also the Report figure); `ui/vizkit.js` detail block; new `ui/gfxdet.js` (DETC)   [display only; no computed value, formula, saved key or format change; every Download DXF byte-identical]
- **Request:** engineer decision 2026-11-10: restyle every on-screen CAD-style graphic of the Steel Bridge app to option C (the style of the Section properties graphic, #1291). This PR is family (c), details: #6, #8, #10, #11, #14, #16, #18 of the rollout plan. Download DXF keeps exporting the existing SharedDxf drawing, byte for byte; the Drawings tab sheets stay CAD; no `shared/` file changes.
- **Where:**
  - `apps/steel-bridge/ui/vizkit.js`: a second, separate block appended after the SECC block (anchor `/* ---------- detail drawings and plans (DETC`), adding to `window.SBDVizKit`: `DPAL` (slate steel, light plate, warm-grey concrete, brown bars, one bolt / weld colour `#B45309`, load navy, ratio fills ok / hi / ng in the tables' classes, governing = C's accent `#2563EB`), `detCss()` (classes `dt-*`; print grey + hatch: steel grey with black outline, concrete white, bolts and welds black, ratio ok white / hi grey / ng hatched, governing black and thicker; forced colours), `st()` (SVG text with the `_` subscripts of ui/sub.js), `scene()` (model units, y up; `rect / poly / pline / line / circ / dot / text / dimH / dimV / callout / arrow / region / raw`; `render({ W, maxH })` finds the largest scale at which the drawing and every text at its px size fit W, by bisection), `detRead()` (hover / tap read-out of the regions), `detCard()` (header with Download DXF, optional segmented control, figure redrawn with `VK.fit` on resize and `sbd2:panelresize`, print at 760 px when narrower, read-out, caption, notes, `DXF_NOTE_D`). The SECC block is unchanged.
  - `apps/steel-bridge/ui/gfxdet.js` (new, `window.SBDGfxDet`; API at the top): `ltb`, `bracket`, `stiff`, `bear`, `crossframe`, `weld`, `splice`, `spliceFigure` (Report), each with its `…Model`; `_svg` (the SVG builders, tests).
  - `apps/steel-bridge/ui/gfxa.js`: `flexure()`: the LTB `G.mount(C, () => { … }, { key: 'fxc' })` became `function ltbGraphic(r)` (the same body, moved; exported) and the call `SBDGfxDet.ltb(C, { r, dxf: () => ltbGraphic(r) })` (fallback: the old mount). `constr()`: the bracket `G.mount(B, () => { … }, { key: 'cnb' })` became `function ohGraphic(P, gi, R)` (same body; exported) and `SBDGfxDet.bracket(B, { P, gi, oh, dxf })`.
  - `apps/steel-bridge/ui/tabgraphics-b.js`: new `putDet(host, name, ctx, make, det, args)` (anchor `DETC (2026-11-10): the detail drawings`); `shear()` (shear-detail, shear-bearing), `crossframe()`, `welds()` (weld-detail), `splice()` (splice) call it, falling back to `put()`. `handles[name]` keeps `{ el, graphic, dxf() }`. The engine builders (`engine/tabgraphics-b.js`) are not changed.
  - `apps/steel-bridge/report/builders.js` `spl()`: the splice figure is `SBDGfxDet.spliceFigure(s, 760)` (static, the same drawing), else `splFig(…)` as before.
  - `apps/steel-bridge/index.html`: `'ui/gfxdet.js'` after `'ui/vizkit.js'`.
  - Tests: new `tests/engine/dxf-detc.test.mjs` + `tests/baselines/dxf-detc.json` (SHA-256 of 1362 DXF texts recorded on origin/main 7463141); new `tests/engine/gfxdet.test.mjs`; `tests/smoke/steel-bridge-tabgraphics-b.mjs` (`commonDet`: the card, no zoom buttons, Download DXF = `handles[name].dxf()`; shear-bearing added).
- **Numbers (CLAUDE.md §4):** none computed. Each label is the CAD drawing's value by the same expression and format (`toFixed` digits, `SharedDxf.frac` sizes, `SharedDxf.fmtFtIn` for the measured dimensions `<>`); only the case changes (sentence case, `in` / `kip` / `ksi`, `×` for `x`, subscripts). Checked: `gfxdet.test.mjs`: for 169 cards (6 graphics × 4 projects, rows sampled) every number token of the CAD drawing's TEXT and DIM strings is in the card at 900 and 380 px (4630 checks); main-vs-branch probe of the graphic's text (below).
- **Check case:** built-in project, splice at 82 ft. Transverse stiffener TS1 (G1, 4.84 ft, type A): d_o1 = d_o2 = 58.08 in (0.97D), D = 60 in, panel 1 V_u/φ_v V_n = 0.318, panel 2 0.253, g = 2 3/4 in, I_t = 36.00 in⁴, I_req = 6.91 in⁴ (old: `d_o1 = 58.08" (0.97D)`, `V_u/PHI_v V_n = 0.318`, …). Cross-frame: S = 9'-6", h = 4'-4", CF3 diagonals ratio 0.904, member 3 L 125.3 in, T 2.5, C 2.5 kip. FS1: web PL 4'-9", 1'-1 1/2"; bottom flange plate 2'-1 1/2", BF4 ratio 0.997 (highlighted).
- **Digits (main vs branch, the graphic's text, tooltips excluded):** identical except added labels: LTB `249.99` (location in the card subtitle), `6.10.8.2.3` (note); bracket: the sketch's a 36.0, h_b 56.0, w_OH 30.0, t_OH 9.0, γ_DC 1.25, P_fm 3.0, OH1–OH5 (main drew only its "inputs above" note, see decision 1); stiffener `4.84` (subtitle), ratio legend `0.90`, `1.00`, and `in⁴` no longer a digit `4`; bearing `1` (Abut. 1 in the subtitle), legend; weld `1` (Pier 1 in the subtitle); cross-frame and splice: none.
- **Show the work (§6):** every value is the tab's, worked in its tables and steps (unchanged); the notes of each CAD drawing are in the card (caption / notes), with the ratio colour legend.
- **Saved data (§5):** none.
- **Decisions (pending engineer review):**
  1. Overhang bracket: the CAD sketch reads `R.F.oh.a` (and `hb`, `wOH`, `tOH`, `Pfm`, `gam`), which do not exist (the inputs are in `R.F.oh.p`), so on main it has only ever drawn "OVERHANG BRACKETS: … (INPUTS ABOVE)". The screen sketch reads `R.F.oh.p` (the tab's own inputs) and draws. Its Download DXF is kept byte-identical (the rollout's rule), so it still exports that note. Raised: fix `ohGraphic` to read `oh.p` (would change that DXF)?
  2. The +/−/Fit buttons and the zoom / pan viewer are removed: each graphic fits its card at every width (two-view details: the views side by side, stacked below 640 px; one scale for the views of a drawing, so "enlarged ×k" stays true).
  3. Colours: ratio fills are the tables' classes (below 0.90, 0.90 to 1.00, above 1.00 or NG) in light green / amber / red with a legend; the governing group is C's accent blue (the CAD magenta S-GOV); bolts and welds one amber-brown.
  4. Cross-frame members table is an HTML table under the figure (was drawn in the drawing); the governing line is a caption above the figure.
  5. The bottom flange-to-web weld is drawn with the flange under the web (the CAD draws both joints flange-up); sizes unchanged.
  6. Long titles and notes of the CAD drawings are the card header / caption, in sentence case.
- **Raised, not changed (§4):** decision 1 (bracket DXF).
- **Other copies:** none.
- **How verified:** before / after screenshots at 1440, 390 px and print for each graphic (scratchpad `secgfx/famCD/`); `tests/check-syntax.mjs`; engine dxf-detc (1362 DXF texts identical to main), gfxdet, gfxa (6/6), tabgraphics-b (4/4), graphics-overlap, report (9/9); smoke graphics, tabgraphics-b (12 graphics), report (0 console errors), phone-layout `--tool sbapp` (390, 768 px).

## 2026-11-10 — PR: claude/sb-diaphragm-gating (PR #1297: https://github.com/mlococo88/All-Structural/pull/1297) — Diaphragm bracing: diaphragm output only; no cross-frame (truss) output (SBDIA)   [display only; no computed value, formula, saved key, format or DXF change]
- **Request:** engineer report 2026-11-10: "I have channel diaphragm selected and there is still a lot of output and failures related to cross frames. All cross frame checks should be removed/replaced with diaphragm checks."
- **Found (default project, channel MC18x42.7 and rolled W21x44 selected):** the engine already left out CF1 to CF9 and made the diaphragm checks CFD (intermediate) and CFE (end diaphragms), and the DC1 weight was already the diaphragm's (`xfModel` kind `'dia'`). Still shown: the tab name and card titles "Cross-frames", the X-frame elevation graphic (with "DIAPHRAGM IN USE"), the "Member forces (truss model)" table, the truss worked steps (members CF1–CF6/CF9 values, truss unit forces, CF6 geometry, the X brace stiffness β_br and its β_T), "Checks (CF1 to CF11, CFD, CFE)", the Summary column / left chip "Cross-frames" ("X-frames", "CF1–CF11"), the Report section "Framing and cross-frames" with the truss member forces, the plan captions, the Auto design module name, the 3D layer name. The Summary verdict counted only CF10, CF11, CFD, CFE (no truss check), so no FAIL came from a truss check: the FAIL is CFD, torsional brace system stiffness.
- **Where:**
  - `apps/steel-bridge/engine/crossframes.js`: before `function steps(R) {` added `const TRUSS = /^cf\.(tr\d+|user\.|top\.|bot\.|diag\.|geo$|sb\.bbr$|sb\.bT$)/;`; in `steps(R)` `const w = St().work('cf'), p = R.p, W = R.W;` → `const w = St().work('cf'), p = R.p, W = R.W, dOn = cfDiaOn(p), brN = dOn ? 'diaphragm' : 'cross-frame';`; labels `'Cross-frame spacing (the largest …)'` → `` `${dOn ? 'Diaphragm' : 'Cross-frame'} spacing (the largest …)` ``, `` `Wind force at the bottom flange per cross-frame, ${l}` `` → `` `… per ${brN}, ${l}` ``, `'cross-frame ≥ 0.8 of the web depth …'` → `` `${brN} ≥ 0.8 …` ``; at the end `return w.steps;` → `return dOn ? w.steps.filter(s => !TRUSS.test(s.id)) : w.steps;`. Labels are unchanged for a cross-frame (brN = 'cross-frame').
  - `apps/steel-bridge/ui/framing.js`: new `isDia(q)` (`SBDCrossframes.cfDiaOn(q.crossframes || q)`), `ckHead(C, dOn)` (with a diaphragm `Checks (<ids made>)`, else the old `Checks (CF1 to CF11[, CFD, CFE])`), `diaSvg(B)` (simple inline SVG elevation of the diaphragm: girders, connection plates, shape centred on the girder depth, bolt rows, S and d; style of `plan()`), exported. `results(B)`: `dOn = isDia(I.p)`; secHeads "Diaphragms: governing", "Diaphragms: elevation" (`diaSvg`, no `data-gfxb="crossframe"` host), the brace-point note and the DC1 line say diaphragm(s), checks heading `ckHead`, `if (R.frames) …Member forces (truss model)` → `if (R.frames && !dOn)`. `render`: `SBDTabGfxBUI.crossframe(...)` only when `!isDia(S.R.I.p)`. `umNote`: '' with a diaphragm. `TOPICS.x`: topics `dia` (`/^cf\.cfd(\.|$)/`) and `diae` (`/^cf\.cfe(\.|$)/`) (the steps were under "Other steps"). `plan(L, dOn)` caption / aria label; `inputs`: card titles "Diaphragm layout (6.7.4.2.1)", "Diaphragm spacing s, at most", "Diaphragm weight in DC1" (input paths unchanged); `layoutPlan` note.
  - `apps/steel-bridge/report/builders.js` `function frm(B, X)`: `dOn` from `SBDFramingUI.isDia(I.p)`; gov row `mod: dOn ? 'Diaphragms' : 'Cross-frames'` (grp 'Cross-frames' unchanged); plan caption, notes, `fl` title and point-load label; checks title `FUI.ckHead(C, dOn)`; `if (R.frames)` member forces → `if (R.frames && !dOn)`; title `dOn ? 'Framing and diaphragms' : 'Framing and cross-frames'`.
  - `apps/steel-bridge/report/summary.js`: new `isDia(P)`, `label(c, P)` (column 'cf' with a diaphragm: head 'Diaphragms', short 'Diaphr.', what 'CF10, CF11, CFD, CFE'), `grpLabel(grp, P)`, exported; warnings `Cross-frames: …` → `Diaphragms: …` and `errOf` 'No diaphragm check with a ratio.' with a diaphragm. Column id 'cf', group key 'Cross-frames' (data-sdgrp, GRP) unchanged.
  - `apps/steel-bridge/ui/summary.js` `paint`: `COLS = SM().COLS` → `SM().COLS.map(c => SM().label(c, P))`, governing / not-evaluated heads through `LB`; the plan figure's tab link text. `apps/steel-bridge/ui/dash.js`: chip name `SM().grpLabel(gp, P)`, governing link and chip title through `SM().label`.
  - `apps/steel-bridge/index.html` `drawOut0()`: the `[data-otab="cf"]` button text 'Diaphragms' / 'Cross-frames'.
  - `apps/steel-bridge/ui/autodesign.js`: `DIA` set in `render`; `govTxt` and the compare table show "diaphragms" for module 'cross-frames'; tab title. `apps/steel-bridge/ui/view3d.js`: layer label 'Diaphragms'. `apps/steel-bridge/engine/tabgraphics-b.js` `MODS` (summary elevation): `Diaphragms: 'DIA'` added (no drawing change).
  - Tests: `tests/engine/sb-diaphragm.test.mjs` (new), `tests/smoke/steel-bridge-diaphragm.mjs` (new).
- **Numbers (CLAUDE.md §4):** no calculation changed. CF1 to CF9 were already not made with a diaphragm (GirderDetail 2026-10-13); the truss is still computed by `compute` (R.frames, R.mem) but neither checked nor shown.
- **Check case (MC18x42.7, GirderDetail built-in inputs; tests/engine/sb-diaphragm.test.mjs test 5):** I_x = 3.95(18)³/12 − 3.50(16.75)³/12 = 1919.70 − 1370.67 = 549.04 in⁴; S_x = 2(549.04)/18 = 61.00 in³; h_w/t_w = 37.22 ≤ 1.12√(29000·5/50) = 60.31 → C = 1, φ_vV_n = 0.58(50)(16.75)(0.45) = 218.59 kip; β_br = 6EI_x/S. DC1 (test 3): A = 2(3.95)(0.625) + 16.75(0.45) = 12.475 in², frame 9.5 ft: W = 12.475(114 − 2·2.0)(0.2836)/1000(1.10) = 0.428 kip, half to each girder. Default project (channel): CFD brace moment 234.81 kip-in ≤ φ_fM_n = 1157.74 kip-in (0.203), shear 2(234.81)/114 = 4.12 kip ≤ 218.59 (0.019), wind M_w = 3.51(61.88) = 217.2 kip-in (0.188); torsional system stiffness β_T = 15,432 < β_T,req = 32,848 kip-in/rad: 2.129 FAIL (unchanged; a diaphragm check).
- **Show the work (§6, #1284):** the CFD / CFE steps are grouped under their own topics; notes on the tab and in the Report state that CFD / CFE replace the angle checks and that the truss is not used with a diaphragm; the elevation's note says nominal dimensions, centred on the girder depth.
- **Saved data (§5):** none (display only; no key, no format).
- **Decisions (pending engineer review):**
  1. CF10 (bracing type for the girder depth) and CF11 (owner details) stay listed with a diaphragm: they check the choice of a diaphragm, not truss members.
  2. The framing layout steps (engine/framing.js: "Cross-frame spacing and orientation", "Target cross-frame spacing") are the brace-point layout for either bracing and keep their names.
  3. The diaphragm elevation is a simple inline SVG in ui/framing.js (the graphics restyle is separate work); the Drawings tab and DXF are unchanged (the DIAPHRAGM DETAILS sheet already draws the diaphragm).
  4. The CFD / CFE titles (engine) keep "… in place of the cross-frame".
- **Raised, not changed (§4):** (a) no axial check of the diaphragm under the wind force F_w (Strength III / V) — the bolts take H = F_w; (b) channels use the 6.10.8 I-section lateral-torsional buckling resistance as an approximation (note on CFD), not a channel-specific provision; (c) the fatigue rows name the connection plate "at cross-frame" (engine/fatigue.js renames only analysis rows when `env.dia`, and no caller passes it). Not changed: each would change a check or a computed row.
- **Other copies:** none.
- **How verified:** main (570234a) vs branch, headless, default project as X, K (bottom), K (top) with 30° skews: checks, worked step values, DC1 point loads, DIA, truss forces, DC1 moments, Cross-frames tab text, Summary cells and Report text identical (Summary text differs only in the run time); channel and rolled W: checks, step values kept, point loads, DIA, analysis identical, display text as intended. check-syntax; engine sb-diaphragm (6), framing, crossframes, sb-summary, report; smoke steel-bridge-diaphragm, tabgraphics-b, summary, dash, report, phone-layout --tool sbapp; 0 console errors.

## 2026-11-10 — PR: sbsum-fullwidth (PR #1303: https://github.com/mlococo88/All-Structural/pull/1303) — Summary tab: cross-section and framing plan stacked, each the full card width (SBSF)   [display only; no computed value, formula, saved key, format or DXF change]
- **Request:** engineer 2026-11-10: "The summary should show the cross section and framing plan in full width, not side by side. When it's side by side it's very small to see."
- **Where:** `apps/steel-bridge/ui/summary.js`
  - `css()`: `.sum-gfx{display:grid;grid-template-columns:minmax(0,1fr);gap:12px} @media screen and (min-width:1200px){.sum-gfx{grid-template-columns:repeat(2,minmax(0,1fr))}}` → `.sum-gfx{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}`; `.sum-gbox svg{display:block;max-width:100%;height:auto}` → `.sum-gbox svg{display:block;width:100%;max-width:100%;height:auto;margin:0 auto}`; print `.sum-gfx{grid-template-columns:repeat(2,minmax(0,1fr))}` → `.sum-gfx{grid-template-columns:minmax(0,1fr)}` plus `.sum-gbox svg{width:100%!important}`.
  - New before `function paint(host, ctx) {`: `GFX_CAP()` = max(360, min(760, 0.8 × innerHeight)); `sizeGfx(el)`: for each `.sum-gbox > svg`, from its viewBox w/h, width = min(box width − 8, GFX_CAP × w/h), set as inline px only when narrower than the box (else cleared); `fitGfx(host)`: sizeGfx now, then again (rAF-throttled) on window `resize`, `sbd2:panelresize` and a ResizeObserver on `#sum-gfx` (the left column's collapse fires no window event).
  - `paint`: `host.innerHTML = h;` → `host.innerHTML = h; fitGfx(host);   // SBSF`.
  - Test: `tests/smoke/steel-bridge-summary.mjs` test 7 (stacked, full width at 1200 / 1440 / 1920 px, left column open / collapsed, splitter at both limits, 390 px, print).
- **Numbers (CLAUDE.md §4):** none. SVG markup unchanged; only the CSS width of the `<svg>`.
- **Check case (default project, 1000 px window height, cap 760 px):** 1440 px: card 743 px, cross-section 733 × 746 (under the cap: full width), plan 733 × 204. 1920 px: cross-section 746 × 759 (capped, centred in a 1038 px card), plan 1028 × 286. Before: 356 × 362 and 356 × 100 side by side at 1440 px.
- **Show the work (§6):** captions and links unchanged.
- **Saved data (§5):** none.
- **Other copies:** none.
- **How verified:** `tests/check-syntax.mjs`; smoke steel-bridge-summary, steel-bridge-dash, phone-layout --tool sbapp (0 console errors); before / after screenshots at 1440 and 1920 px.

## 2026-11-10 — PR: sbd-gfx-plans (PR #1305: https://github.com/mlococo88/All-Structural/pull/1305) — plans in the option C style: Loads & LLDF cross-section, splice location strip (also the Report figure); the diaphragm elevation of the Cross-frames tab (SBDIA, #1297) restyled with them (DETC, part 2)   [display only; no computed value, formula, saved key or format change; every Download DXF byte-identical]
- **Request:** engineer decision 2026-11-10 (option C rollout), family (d) plans: #2 LLDF cross-section with lanes and wheel positions, #17 splice location strip. Coordinator (same day): restyle the diaphragm elevation added by #1297 with the cross-frame elevation (#14, done in #1295).
- **Where:**
  - `apps/steel-bridge/ui/gfxdet.js`: new `lldf`, `lldfModel`, `lldfSvg` (anchor `/* ================= (d) plans`), `strip`, `stripModel`, `stripSvg`, `stripFigure` (Report), `diaphragm(B)` (anchor `diaphragm in use (SBDIA, #1297)`); API lines in the header.
  - `apps/steel-bridge/ui/gfxa.js` `loads()`: calls `SBDGfxDet.lldf(slot, { P, R, lg, lr, cs: S.loadCase, onCase, dxf: use => loadsGraphic(…, use) })` before the former `block()` + `GR().mount()` path (kept as the fallback). The case `<select id="gfx_ld_c">` is now a segmented control on the same state `S.loadCase`. `loadsGraphic` is unchanged.
  - `apps/steel-bridge/ui/tabgraphics-b.js` `splice()`: the strip through `putDet(…, 'strip', { list, P, sel, onSel })`, else `put()` as before; a click on a splice calls the tab's `onSel(i)`.
  - `apps/steel-bridge/report/builders.js` `spl()`: the strip figure is `SBDGfxDet.stripFigure(G.list, B.P, 760)`, else `splFig(…)` as before.
  - `apps/steel-bridge/ui/framing.js` `diaSvg(B)`: returns `SBDGfxDet.diaphragm(B)` when the kit is loaded; the former inline sketch stays below as the fallback (no DXF: it never had one).
  - Tests: `tests/engine/gfxdet.test.mjs` second test (every girder, region and case of the LLDF; the strip; 187 cards); `tests/smoke/steel-bridge-graphics.mjs` Loads part (segmented control, wheels, influence line, Download DXF); `tests/smoke/steel-bridge-tabgraphics-b.mjs` (strip click-select, card, DXF).
- **Numbers (§4):** none computed. LLDF: the cases, wheels, lanes, traffic faces (`d_e`), influence-line ordinates (`f(x)` of loadsGraphic, the same function), `g = m R` lines and g_M, g_V are the CAD drawing's by the same expressions; the girder-spacing chain is taken from a SharedDxf `chainH` of the same stations (its own text: `3'-3"`, `4@9'-6"`). Strip: stations `f2(s.x)` (`82.00 ft` for `82.00'`), the governing ratio class. Diaphragm: the numbers of diaSvg (SharedUnits.fmt). Checked: gfxdet test (every CAD number shown, every LLDF case); main-vs-branch probe.
- **Check case:** built-in project, G1, span 1, lever rule one lane: g = m R = 1.20 × 0.6579 = 0.7895, wheel ordinates 0.974 and 0.342, 1.0 at G1 and 0.0 at G2, d_e = 1.75 ft, N_L = 3 lanes of 12.00 ft, g_M = g_V = 0.8105; rigid cross-section 2 lanes 0.8105. Strip: FS1 at 82.00 ft, BF4 ratio 0.997 (amber). Diaphragm (dia on, W21x44): d = 20.70 in, S = 114.00 in, girder depth 61.88 in, 4 bolts at 3.00 in, 3.50 in from the web, φ_f M_n = 3144 kip-in, φ_v V_n = 200.97 kip.
- **Digits (main vs branch, the graphic's text, tooltips excluded):** LLDF identical (the same multiset of digits); strip: the legend's `0.90`, `1.00` added; diaphragm: identical in the drawing shown (the narrow copy of the figure, hidden at desktop width, repeats them).
- **Saved data (§5):** none (`S.loadCase` stays page-session state).
- **Decisions (pending engineer review):**
  1. The LLDF case selector is a segmented control (the old `<select>`); the selected girder is blue; wheel arrows end on the deck (the CAD ends them above the appurtenances); the spacing chain sits under the girders and the influence-line band under it.
  2. The strip's labels read `FS1 82.00 ft` (CAD `FS1 82.00'`), the selected splice a blue pill; markers in the ratio classes with a legend.
  3. The diaphragm figure is a static HTML string (the tab writes it as HTML): a wide and a narrow drawing, chosen by a container query on the card width; print shows the wide one.
  4. The framing plan (`ui/framing.js plan`, already a non-CAD sketch in a similar palette) is not changed in this PR.
- **Other copies:** none.
- **How verified:** before / after screenshots at 1440, 390 px and print (scratchpad `secgfx/famCD/`: lldf, strip, dia); check-syntax; engine dxf-detc (1362 DXF texts identical to main), gfxdet (2/2), gfxa (7/7), tabgraphics-b (4/4), graphics-overlap, report (9/9); smoke graphics, tabgraphics-b (13 graphics), splices, report (0 console errors), phone-layout `--tool sbapp`.

## 2026-11-10 — PR: claude/sb-diaphragm-checks (PR #1306: https://github.com/mlococo88/All-Structural/pull/1306) — Diaphragms: channel flexure per 6.12.2.2.5, axial checks under the wind force F_w, fatigue row wording (SBDX)   [CALCULATION CHANGE, approved by the engineer 2026-11-10: "yes do all three"]
- **Request:** the three items raised in #1297: (1) an axial check of the diaphragm under F_w (compression 6.9, tension 6.8; the member's own length and K, basis stated); (2) channels: the channel flexural provisions in place of the 6.10.8 I-section approximation (W diaphragms keep 6.10.8); (3) fatigue rows: "connection plate at cross-frame" in diaphragm wording when a diaphragm is selected.
- **Article numbering note:** in the 10th Edition the channel provisions are Art. **6.12.2.2.5** (Channels); 6.12.2.2.4 is Tees and Double Angles. 6.12.2.2.5 is used.
- **Where:**
  - `apps/steel-bridge/engine/crossframes.js`: new `function chFlex(X, Fy, Lb, Sx, Iy, ry)` and `function diaAxial(X, q, Fy, Fu, Ix, Iy, S, db, primary)` before `function cfDiaChecks(`. In `cfDiaChecks`: `const lt = FX().ltbFnc({...}), Mn = lt.Fnc * Sx;` → `const lt = FX().ltbFnc({...}); const CH = chS ? chFlex(X, Fy, S, Sx, Iy, ry) : null, Mn = CH ? CH.Mn : lt.Fnc * Sx;`. `ref` lists 6.12.2.2.5 (channel) or 6.10.8 (W) and 6.9.2.2, 6.9.3, 6.9.4.1, 6.9.4.2.2, 6.8.2.1; `note` states the new bases (old text: "Channel: the 6.10.8 lateral-torsional buckling model is for I-sections and is used as an approximation …; its axial force is not combined with the flexure (assumption to verify)"). After the item `Wind, Strength ${wk}: shear 2M_w/S` four items (flag `sbdx`): axial compression P = F_w, axial tension P = F_w, slenderness Kℓ/r_min, axial and flexure (6.9.2.2). Items that use M_n carry `mn`; the brace-moment, jacking-flexure and wind-flexure items link to `cf.cfd.Mn` / `cf.cfd.Mw` (were `cf.cfd`). `R.DIA` adds `bf, tf, tw, hw, CH, AX, MnI` (the 6.10.8 value), `Fy`. `diaSteps`: a W keeps step `cfd.Mn` (6.10.8); a channel gets `ch.Zx`, `ch.Mp`, `ch.JCw`, `ch.rts`, `ch.Lp`, `ch.Lr` and `cfd.Mn` (6.12.2.2.5, with the before value in its note); every diaphragm gets `ax.L`, `ax.Pe`, (channel) `ax.ft`, `ax.Pcr`, `ax.Aeff`, `ax.Pr`, `ax.Pt`, `ax.sl`, `ax.ia` (same for `cfe.`).
  - `apps/steel-bridge/ui/fatigue.js` `build`: `FA.compute(faIn, { owner: own.owner, lf })` → `FA.compute(faIn, { owner: own.owner, lf, dia: !!(window.SBDCrossframes && P.crossframes && window.SBDCrossframes.cfDiaOn(P.crossframes)) })` (engine/fatigue.js already renames the analysis rows' "cross-frame" to "diaphragm" when `env.dia`; wording only).
  - Tests: `tests/engine/crossframes.test.mjs` (GirderDetail parity: the `sbdx` items and, for a channel, the items using M_n are left out of the parity; the channel's 6.10.8 value `MnI` is still compared with GirderDetail's M_n); `tests/engine/sb-diaphragm.test.mjs` tests 6 to 10 (hand checks below); `tests/smoke/steel-bridge-diaphragm.mjs` (the new items and their § steps on the tab, KaTeX, Report).
- **Provisions (paraphrased; AASHTO LRFD 10th Ed., 2024):**
  - Channel flexure, Art. 6.12.2.2.5: M_n = the lesser of yielding M_p = F_yZ_x (Eq. 6.12.2.2.5-1) and LTB: L_b ≤ L_p no LTB; L_p < L_b ≤ L_r linear from M_p to 0.7F_yS_x times C_b, ≤ M_p (-2); L_b > L_r F_crS_x ≤ M_p (-3) with F_cr = C_bπ²E/(L_b/r_ts)² √(1 + 0.078 Jc/(S_xh_o) (L_b/r_ts)²) (-4); c = (h_o/2)√(I_y/C_w) (-5); C_w (-6); L_p = 1.76r_y√(E/F_y) (-7); L_r (-8); r_ts² = √(I_yC_w)/S_x (-9). Rolled channels are compact (C6.12.2.2.5). φ_f = 1.0.
  - Compression: 6.9.4.1.1 (modes; P_n from P_e and P_o, Eqs. -1, -2), 6.9.4.1.2 (flexural), 6.9.4.1.3 (flexural–torsional, singly symmetric, Eqs. -2 to -6), 6.9.4.2.2 (effective area of slender elements, Eqs. 6.9.4.2.2a-1 to -3, 6.9.4.2.2b-1, -2, Table 6.9.4.2.2b-1), 6.9.2.1 (φ_c = 0.95), 6.9.3 (Kℓ/r ≤ 120 primary, 140 secondary), 4.6.2.5 (K).
  - Tension: 6.8.2.1 (0.95F_yA_g; 0.80F_uA_nR_pU), 6.8.2.2 (U not less than the connected element's gross area over A_g). Combined: 6.9.2.2 (Eqs. -1, -2).
- **Assumptions (stated as step notes on the tab and in the Report, #1284):** P = F_w of the governing Strength III / V wind case, either sign; K = 1.0 and ℓ = S − 2e (bolt line to bolt line), K_zℓ_z = ℓ (single row of web bolts: little end restraint; the 0.75 of 4.6.2.5 for frame members not used); nominal dimensions, fillets neglected, J and C_w thin-walled centerline (the channel's flexure uses the same J, C_w); L_b = S and C_b = 1.0 for flexure, as before; U = A_web/A_g (one transverse bolt row has no connection length for Table 6.8.2.2-1 Case 2); holes drilled, R_p = 1.0; M_u not amplified (P_u/P_e shown in the step).
- **Before / after, default project (S = 114 in, d = 61.88 in, F_w = 3.509 kip Strength III, M_w = 217.16 kip-in, M_br = 234.81 kip-in):**
  - MC18x42.7: φ_fM_n 1157.74 → 2706.02 kip-in; brace moment 0.2028 → 0.0868; wind flexure 0.1876 → 0.0802 (CFD and CFE); new: compression 3.509/46.16 = 0.0760, tension 3.509/338.93 = 0.0104, Kℓ/r 95.43/140 = 0.682, axial + flexure 0.0760/2 + 0.0802 = 0.1183. Governing diaphragm result unchanged: CFD torsional brace system stiffness 2.129 FAIL.
  - W21x44: flexure unchanged (6.10.8, φ_fM_n = 3143.73 kip-in); new: compression 3.509/335.83 = 0.0104, tension 3.509/323.35 = 0.0109, Kℓ/r 84.14/140 = 0.601, axial + flexure 0.0104/2 + 0.0691 = 0.0743. Governing unchanged: 2.117 FAIL (stiffness).
- **Check case MC18x42.7 (grade 50; nominal 18 × 3.95 × 0.625 × 0.45):** A = 12.475 in², I_x = 549.04, S_x = 61.004 in³, I_y = 15.683 in⁴, r_y = 1.1212 in. Z_x = 3.95(0.625)(17.375) + 0.45(16.75)²/4 = 74.458 in³, M_p = 3722.89 kip-in; b = 3.725, h_o = 17.375; J = (2(3.725)(0.625)³ + 17.375(0.45)³)/3 = 1.1340 in⁴; C_w = 843.82 in⁶; c = 1.1844; r_ts = 1.3732 in; L_p = 1.76(1.1212)√580 = 47.53 in; L_r = 151.32 in; L_b = 114: M_n = 3722.89 − (3722.89 − 0.7(50)(61.004))(114 − 47.53)/(151.32 − 47.53) = 2706.02 kip-in (before: F_nc S_x = 18.978(61.004) = 1157.74). Axial: ℓ = 114 − 2(3.5) = 107 in; P_ey = π²(29000)(12.475)/(107/1.1212)² = 392.07 kip; shear center e = 3b²t_f/(6bt_f + h_ot_w) = 1.1941 in from the web centerline, centroid 0.6926 in: x_o = 1.8868 in; r_o² = 48.828 in²; H = 0.92709; P_ez = (π²(29000)(843.82)/107² + 11165(1.1340))/(12.475(48.828)) = 55.42 kip; P_e,FT = 55.40 kip (governs); P_o = 623.75, P_e/P_o = 0.089 < 0.44: P_cr = 0.877(55.40) = 48.59 kip, F_cr = 3.895 ksi; web λ = 37.22 > λ_r = 35.88 but ≤ λ_r√(F_y/F_cr) = 128.6: fully effective; φ_cP_n = 0.95(48.59) = 46.16 kip. Tension: A_n = 12.475 − 4(0.9375)(0.45) = 10.7875, U = 16.75(0.45)/12.475 = 0.6042: min(592.56, 0.80(65)(10.7875)(0.6042) = 338.93) = 338.93 kip.
- **Check case W21x44 (nominal 20.7 × 6.5 × 0.45 × 0.35):** A = 12.78, r_y = 1.2717; P_ey = π²(29000)(12.78)/(107/1.2717)² = 516.68 kip; P_o = 639, P_e/P_o = 0.809 ≥ 0.44: P_cr = 0.658^(639/516.68)(639) = 380.80 kip, F_cr = 29.796 ksi; web λ = 19.8/0.35 = 56.57 > 35.88√(50/29.796) = 46.48: F_el = (1.31(35.88)/56.57)²(50) = 34.52 ksi, b_e = 19.8(1 − 0.18√1.1587)√1.1587 = 17.183 in; A_eff = 12.78 − (19.8 − 17.183)(0.35) = 11.864 in²; φ_cP_n = 0.95(29.796)(11.864) = 335.83 kip. Tension: A_n = 12.78 − 4(0.9375)(0.35) = 11.4675, U = 19.8(0.35)/12.78 = 0.5423: min(607.05, 0.80(65)(11.4675)(0.5423) = 323.35) = 323.35 kip.
- **Show the work (§6):** every new item links (§) to its step on the tab and in the Report (topics "Diaphragm (intermediate bracing), CFD" / "End diaphragms, CFE"); the Summary column and the left chip take the CFD / CFE ratios as before (the governing value is unchanged on the default project).
- **Saved data (§5):** none.
- **Decisions (pending engineer review):** K = 1.0 (not 0.75 of 4.6.2.5); U = A_web/A_g; R_p = 1.0; the 6.9.2.2 interaction uses the compressive resistance and M_w without amplification; thin-walled J and C_w (the AISC tabulated values, which C6.12.2.2.5 allows, are not in the app's shape table); the end diaphragms (CFE) get the same axial items.
- **Other copies:** none (GirderDetail's own diaphragm checks are not changed; the parity test documents the difference).
- **How verified:** main (b2eccd4) vs branch, headless: X, K (bottom), K (top) with 30° skews: checks, worked step values, DC1 point loads, truss forces, DC1 moments, tab text, Summary cells and Report text identical (Summary text differs only in the run time); channel and W: values above. check-syntax; engine sb-diaphragm (11), crossframes, framing, sb-summary, report, tex; smoke steel-bridge-diaphragm, summary, report, phone-layout --tool sbapp; 0 console errors.

## 2026-11-10 — PR: fix/sb-bracket-dxf (PR #1321: https://github.com/mlococo88/All-Structural/pull/1321) — Constructibility: the overhang bracket Download DXF draws the bracket (SBBDXF; drawing only, engineer decision 2026-11-10)
- **Request:** engineer decision 2026-11-10: fix the overhang bracket DXF. The CAD builder `ohGraphic` read `R.F.oh.a` (absent; the inputs are `R.F.oh.p`), so its Download DXF only ever held the note "OVERHANG BRACKETS: EXTERIOR GIRDER, PROJECT SOURCE ONLY (INPUTS ABOVE)". It now draws the girder, overhang slab, bracket, the dimensions a, h_b, w_OH, t_OH and the two load arrows, from the values the on-screen sketch uses (`ui/gfxdet.js bracketModel`: `R.F.oh.p`). An explicit exception to the earlier "don't change the DXF" rule, approved by the engineer.
- **Where:** `apps/steel-bridge/ui/gfxa.js` `function ohGraphic(P, gi, R)`:
  - `const G = GR(), oh = R.F && R.F.oh; {` → `const G = GR(), oh = R.F && R.F.oh, p = (oh && oh.p) || {}; {`
  - `a = +(oh || {}).a, hb = +(oh || {}).hb, wOH = +(oh || {}).wOH, tOH = +(oh || {}).tOH;` → `a = +p.a, hb = +p.hb, wOH = +p.wOH, tOH = +p.tOH;`
  - `` `DECK AND FORMS (GAMMA_DC ${nf(((oh || {}).gam || {}).dc, 2)})` `` → `` `DECK AND FORMS (GAMMA_DC ${nf((p.gam || {}).dc, 2)})` ``
  - `` `FINISHING MACHINE ${nf(oh.Pfm, 1)} KIP; `` → `` `FINISHING MACHINE ${nf(p.Pfm, 1)} KIP; ``
  - comments: the header of `ohGraphic`, the DETC line in `constr` ("Download DXF is ohGraphic, unchanged" → "... is ohGraphic"), and the bracket block comment in `ui/gfxdet.js`.
  - Geometry and layers of the drawing are as they were written (never reached before): layers GRDR, DECK, BRACKET, LOAD, DIMS, ANNO-TEXT.
- **Provisions:** none; no formula, factor, unit or reference changes. No computed value changes (the bracket checks OH1–OH5 do not use this builder).
- **Check case (built-in project, G1 exterior; R.F.oh.p: a = 36, h_b = 54, w_OH = 30, t_OH = 9 in, γ_DC = 1.25, P_fm = 3.0 kip; haunch 2 in):** before: DXF text = the one note (1752 chars). After: `a = 36.0 IN`, `h_b = 56.0 IN` (54 + haunch 2, as the screen sketch), `w_OH = 30.0 IN`, `t_OH = 9.0 IN`, `DECK AND FORMS (GAMMA_DC 1.25)`, `FINISHING MACHINE 3.0 KIP; ...` (8051 chars).
- **Baseline:** `tests/baselines/dxf-detc.json`: only the three `|oh` entries re-recorded (`8e9b6ba5ad010a684cc9b1f1` → `c15f728d84e9214e60c5ee86`); every other entry unchanged. New test in `tests/engine/dxf-detc.test.mjs` (the dimension and load texts, the five layers, no note).
- **Saved data (§5):** none.
- **Decisions (pending engineer review):** the CAD layout is kept as originally written (the load arrows at mid w_OH and at the slab edge; no girder centre line), not re-laid-out to the screen sketch.
- **Other copies:** none.

## 2026-11-10 — PR: claude/sb-skew-xsec (PR #1343: https://github.com/mlococo88/All-Structural/pull/1343) — Framing plan at true scale with θ labels (SKP); typical cross-section re-laid out with no overlaps (SBXS). Display and the section sheet's DXF only.
- **Request:** engineer report 2026-11-10: "The bearing line skew seems off" (the framing plan of the Framing & bracing tab) and "The cross section graphic dimension lines are overlapping a lot and doesn't look good" (the typical section of the Drawings tab and the Summary).
- **Problem (SKP):** `ui/framing.js plan()` stretched or squeezed the width to `Hp = clamp(60, 2.2·W·s_x, 260)` px. The drawn angle was `atan(tan θ·s_x/s_y)`. On 11 girders at 4 ft with θ = 30°: 13.33° on 110-140-110 ft, 23.90° at 100 ft, 33.29° at 60 ft and 40.84° at 40 ft. After: 30.00° in every case. The engine is correct: `xb(k, i) = sup_k + (y_i − y_c) tan θ_k`, so Δx G1→G11 = 40 tan 30° = 23.094 ft. Nothing was changed in `engine/framing.js`.
- **Where:** `ui/framing.js` `function plan(L, dOn, opt)` (new `planSvg`, `PLAN`, the document change listener for `[data-fpex]`); its callers `plan(L, dOn, { ui: true })` in `inputs`, `layoutPlan` and `results`. `ui/summary.js` `sizeGfx` and its CSS. `index.html` CSS `.fp-sc` / `.fp-ex`. `engine/drawings.js` `function section(G, D, opt)`, `function appDraw(G, D, xL, xR, yTop)`, new `tW`, `runsOf`, `hitX`, `chainFit`, `segBox` and `vdim`. `engine/sheets.js` `function weld(...)` (new optional `o`) and the weld calls in `function section(D, C)`.
- **Before / after (exact; re-apply with `git apply` or by hand):**
```diff
diff --git a/apps/steel-bridge/engine/drawings.js b/apps/steel-bridge/engine/drawings.js
index 2f1bfbc..f64549d 100644
--- a/apps/steel-bridge/engine/drawings.js
+++ b/apps/steel-bridge/engine/drawings.js
@@ -258,25 +258,85 @@
   }
 
   /* ---------- 3: typical cross-section (GirderDetail dxfSection + dxfApp) ---------- */
+  /* SBXS (2026-11-10, engineer: "the cross section graphic dimension lines are overlapping a lot and doesn't look good"): laid out again so
+     that no text overlaps another text and no line (extension line, dimension line, leader, outline) crosses a text. Display and DXF only
+     (the engineer asked for this drawing to be fixed: its DXF changes; every other drawing is unchanged). The same quantities are dimensioned:
+       - left of the deck edge, in four columns 3 text heights apart, inside out: web depth D, girder depth, haunch, deck (slab) thickness
+         (were: girder and haunch on the left, web between G1 and G2, deck on the right). A text longer than its dimension (less 0.8 h) is
+         written beyond the end of the dimension, its dimension line extended to it: below the girder (web, girder) or above the deck
+         (haunch, deck), where no extension line of the other columns reaches;
+       - girder spacing and the out-to-out width under the girders (were above the deck, where their extension lines ran through the
+         appurtenance callouts): the spacing chain from the deck edges and below the girder labels (the centerline is the extension line),
+         the out-to-out under it; the bottom flange dimension under those, its plate size written beside it, past its right extension line,
+         where it is wider than the flange (it was centred across both extension lines);
+       - the deck-edge chain over the barriers, sidewalks and railings: a text that does not fit its piece goes on a row above the chain
+         with a leader to the piece (rows 1.5 h apart, no two texts on a row closer than 0.6 h, no leader through a text);
+       - the appurtenance callouts above the chain zone, fanned out: each leader drops to a point of its item clear of the chain's texts and
+         extension lines and at least 1.6 h from the other leaders, the rows 1.9 h apart (text 0.7 h), the items nearest the middle lowest.
+     h = the text height of the drawing (0.1 in plotted × the scale). Text widths are estimated at 0.68 h per character (Arial-like). */
+  const tW = (s, hh) => X_().str(s).length * 0.68 * hh;
+  const runsOf = v => { const s = [...new Set(v.map(q => +q.toFixed(4)))].sort((a, b) => a - b), out = []; let i = 0;   // as SharedDxf chainH (n@s)
+    while (i < s.length - 1) { const d = s[i + 1] - s[i]; let j = i + 1; while (j < s.length - 1 && Math.abs((s[j + 1] - s[j]) - d) < 1e-3) j++; out.push([s[i], s[j], j - i, d]); i = j; } return out; };
+  const hitX = (a0, a1, xs) => xs.some(x => Array.isArray(x) ? a1 > x[0] && a0 < x[1] : x > a0 && x < a1);   // xs: x or [x0, x1]
+  /* chainFit(D, l, pts, y, dir, o): a horizontal chain through y of the points pts = [[x, yref], …] (n@s runs as chainH), each run's text
+     inside its run where it fits (its width + 0.8 h, clear of o.obst, the x or [x0, x1] of lines and texts crossing the text band), else on a row beyond the
+     chain (dir +1 above, −1 below) with a leader. o.txt(a, b, n, d): the text of a run (default the measured length or n@s). Returns
+     { edge (the outermost y used), boxes [[x0, y0, x1, y1]] (texts), lines [x] (extension lines and leaders) } */
+  function chainFit(D, l, pts, y, dir, o) {
+    o = o || {}; const h = D.h, k = D.k, ref = new Map(pts.map(p => [+p[0].toFixed(4), p[1]])), obst = o.obst || [], boxes = [], lines = [], out = [];
+    runsOf(pts.map(p => p[0])).forEach(([a, b, n, d]) => { const t = o.txt ? o.txt(a, b, n, d) : n > 1 ? `${n}@${D.fmt(d)}` : D.fmt(b - a), w = tW(t, h), mid = (a + b) / 2;
+      lines.push(a, b); const fits = w + 0.8 * h <= b - a && !hitX(mid - w / 2 - 0.3 * h, mid + w / 2 + 0.3 * h, obst);
+      D.dim(l, [a, ref.get(+a.toFixed(4))], [b, ref.get(+b.toFixed(4))], [a, y], 0, fits ? t : ' ');
+      if (fits) boxes.push([mid - w / 2, y + 0.06 * k, mid + w / 2, y + 0.07 * k + 0.82 * h]); else out.push({ t, w, mid }); });
+    let edge = dir > 0 ? y + 0.12 * k : y - 0.12 * k; const rows = [];
+    out.forEach(q => { for (let r = 0; r < 40; r++) {
+      const yb = dir > 0 ? y + 1.6 * h + 1.5 * h * r : y - 2.4 * h - 1.5 * h * r, ly = yb + (dir > 0 ? -0.15 * h : 0.95 * h);   // text baseline (its box 0.1 h below to 0.82 h above); leader end
+      for (const off of [0, 1, -1, 2, -2, 3, -3, 4, -4, 6, -6, 8, -8]) { const c = q.mid + off * 0.5 * q.w, B = { x0: c - q.w / 2, x1: c + q.w / 2, y0: yb - 0.1 * h, y1: yb + 0.82 * h };
+        if (hitX(B.x0 - 0.3 * h, B.x1 + 0.3 * h, obst) || rows.some(p => (p.r === r && B.x0 < p.x1 + 0.6 * h && B.x1 > p.x0 - 0.6 * h) || (p.r < r && segBox(q.mid, y, c, ly, p)) || (p.r > r && segBox(p.lx, y, p.c, p.ly, B)))) continue;
+        rows.push({ r, ...B, lx: q.mid, c, ly }); D.line(l, q.mid, y, c, ly); D.text(l, c, yb, h, q.t, 1); boxes.push([B.x0, B.y0, B.x1, B.y1]); lines.push(q.mid);
+        edge = dir > 0 ? Math.max(edge, B.y1) : Math.min(edge, B.y0); return; } } });
+    return { edge, boxes, lines };
+  }
+  // does the segment (x0, y0)-(x1, y1) pass through the box b (x0, x1, y0, y1)?
+  function segBox(ax, ay, bx, by, b) {
+    const n = 24; for (let i = 0; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return true; } return false;
+  }
+  /* vdim(D, l, p1, p2, x, txt, out): a vertical dimension in the column x; its text inside where it fits (width + 0.8 h), else beyond the
+     end out ('lo': below p1, the text ending 0.8 h under yOut; 'hi': above p2, starting 0.8 h over yOut) with the dimension line extended */
+  function vdim(D, l, p1, p2, x, txt, out, yOut) {
+    const h = D.h, k = D.k, t = X_().str(txt.replace('<>', D.fmt(Math.abs(p2[1] - p1[1])))), w = tW(t, h);
+    if (w + 0.8 * h <= Math.abs(p2[1] - p1[1])) { D.dim(l, p1, p2, [x, p1[1]], 90, txt); return; }
+    D.dim(l, p1, p2, [x, p1[1]], 90, ' ');
+    if (out === 'lo') { const ye = yOut - 0.8 * h; D.line(l, x, p1[1], x, ye - w); D.text(l, x - 0.07 * k, ye, h, t, 2, 90); }
+    else { const ye = yOut + 0.8 * h; D.line(l, x, p2[1], x, ye + w); D.text(l, x - 0.07 * k, ye, h, t, 0, 90); }
+  }
   function section(G, D, opt) {
     opt = opt || {}; const dk = G.deck, nb = G.nb, xg = G.ys.map(y => y * 12), W = xg[nb - 1], xL = -dk.ohL * 12, xR = W + dk.ohR * 12;
     D.k = opt.k || scaleFor((xR - xL) * 1.3, 30); D.h = TXT * D.k; const h = D.h, i0 = D.mark();
     const ly = { g: D.layer('GRDR', 5), dk: D.layer('DECK', 7), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), c: D.layer('CNTR', 8) }, cl = D.ltype('CENTER');
-    const ts = dk.ts, hh = dk.haunch, sec = G.girders.map(g => g.segs[0]), tTop = Math.max(...sec.map(s => s.topT)), yT = 0;
-    D.rect(ly.dk, xL, yT + hh, xR, yT + hh + ts);
-    const yA = appDraw(G, D, xL, xR, yT + hh + ts), yDk = yT + hh + ts + yA;
+    const ts = dk.ts, hh = dk.haunch, sec = G.girders.map(g => g.segs[0]), tTop = Math.max(...sec.map(s => s.topT)), yT = 0, yDT = yT + hh + ts;
+    D.rect(ly.dk, xL, yT + hh, xR, yDT);
+    const yA = appDraw(G, D, xL, xR, yDT), yDk = yDT + yA;
     let yBot = 0;
     xg.forEach((x, i) => { const s = sec[i], yt = yT - (tTop - s.topT), yb = yt - s.topT - s.D - s.botT; yBot = Math.min(yBot, yb);
       D.rect(ly.g, x - s.topB / 2, yt - s.topT, x + s.topB / 2, yt); D.rect(ly.g, x - s.tw / 2, yt - s.topT - s.D, x + s.tw / 2, yt - s.topT); D.rect(ly.g, x - s.botB / 2, yb, x + s.botB / 2, yt - s.topT - s.D);
       D.line(ly.dk, x - s.topB / 2, yt, x - s.topB / 2, yT + hh); D.line(ly.dk, x + s.topB / 2, yt, x + s.topB / 2, yT + hh); });
-    xg.forEach((x, i) => { D.line(ly.c, x, yT + hh + ts + 2 * h, x, yBot - 2 * h, cl); D.text(ly.t, x, yBot - 3.8 * h, h, G.girders[i].label, 1); });
-    D.chainH(ly.d, [xL, ...xg, xR], yDk + 4 * h, yT + hh + ts); D.dimH(ly.d, xL, xR, yDk + 7 * h, yT + hh + ts, '<> OUT-TO-OUT OF DECK');
-    D.dimV(ly.d, yT + hh, yT + hh + ts, xR + 3 * h, xR, 'DECK <>'); if (hh > 0) D.dimV(ly.d, yT, yT + hh, xL - 3 * h, -sec[0].topB / 2, 'HAUNCH <>');
-    const s0 = sec[0], yb0 = yT - (tTop - s0.topT) - s0.topT - s0.D - s0.botT;
-    D.dimV(ly.d, yb0, yT - (tTop - s0.topT), -s0.topB / 2 - 4 * h, -s0.botB / 2, 'GIRDER <>'); D.dimV(ly.d, yb0 + s0.botT, yb0 + s0.botT + s0.D, s0.topB / 2 + 3 * h, s0.tw / 2, 'WEB <>');
-    D.dimH(ly.d, -s0.botB / 2, s0.botB / 2, yBot - 7.5 * h, yb0, `BOT. FL. ${dIn(s0.botB)} x ${dIn(s0.botT)}`);
-    D.text(ly.t, xL, yDk + 11 * h, h * 1.6, 'TYPICAL CROSS-SECTION');
-    D.text(ly.t, xL, yDk + 9.3 * h, h * 0.8, `SECTION AT CL BRG. ABUT. 1 (FIRST PLATE SEGMENT OF EACH GIRDER); SEE THE PLATE SCHEDULE FOR OTHER PLATES. SCALE ${SCALE_NAME[D.k]} WHEN PLOTTED.`);
+    // girder centerlines and labels; under them the girder spacing (from the deck edges), the out-to-out width and the bottom flange
+    xg.forEach((x, i) => { D.line(ly.c, x, yDT + 2 * h, x, yBot - h, cl); D.text(ly.t, x, yBot - 2.3 * h, h, G.girders[i].label, 1); });
+    const s0 = sec[0], yt0 = yT - (tTop - s0.topT), yb0 = yt0 - s0.topT - s0.D - s0.botT, fl = [-s0.botB / 2, s0.botB / 2];
+    const x0 = Math.min(xL, -Math.max(s0.topB, s0.botB) / 2), col = j => x0 - (3 + 3 * j) * h, cols = [[col(3) - 0.2 * D.k, col(0) + 0.05 * D.k]];   // the left columns (their texts below the girder)
+    const yS = yBot - 4.6 * h, C1 = chainFit(D, ly.d, [[xL, yT + hh], ...xg.map(x => [x, yBot - 2.8 * h]), [xR, yT + hh]], yS, -1, { obst: [...fl, xL, xR, ...cols] });   // the out-to-out extension lines (xL, xR) and the bottom flange's (fl) pass through its rows
+    const yO = C1.edge - 1.9 * h, C2 = chainFit(D, ly.d, [[xL, yT + hh], [xR, yT + hh]], yO, -1, { obst: [...fl, ...cols], txt: () => `${D.fmt(xR - xL)} OUT-TO-OUT OF DECK` });
+    const yF = C2.edge - 1.9 * h, bt = `BOT. FL. ${dIn(s0.botB)} x ${dIn(s0.botT)}`, bw = tW(bt, h);
+    if (bw + 0.8 * h <= s0.botB) D.dimH(ly.d, fl[0], fl[1], yF, yb0, bt);
+    else { D.dimH(ly.d, fl[0], fl[1], yF, yb0, ' '); D.line(ly.d, fl[1], yF, fl[1] + 1.2 * h + bw, yF); D.text(ly.t, fl[1] + 1.2 * h, yF + 0.07 * D.k, h, bt); }
+    // left of the deck edge: web, girder, haunch and deck in four columns
+    vdim(D, ly.d, [-s0.botB / 2, yb0 + s0.botT], [-s0.topB / 2, yt0 - s0.topT], col(0), 'WEB <>', 'lo', yb0);
+    vdim(D, ly.d, [-s0.botB / 2, yb0], [-s0.topB / 2, yt0], col(1), 'GIRDER <>', 'lo', yb0);
+    if (hh > 0) vdim(D, ly.d, [-s0.topB / 2, yT], [xL, yT + hh], col(2), 'HAUNCH <>', 'hi', yDT);
+    vdim(D, ly.d, [xL, yT + hh], [xL, yDT], col(3), 'DECK <>', 'hi', yDT);
+    D.text(ly.t, xL, yDk + 4 * h, h * 1.6, 'TYPICAL CROSS-SECTION');
+    D.text(ly.t, xL, yDk + 2.3 * h, h * 0.8, `SECTION AT CL BRG. ABUT. 1 (FIRST PLATE SEGMENT OF EACH GIRDER); SEE THE PLATE SCHEDULE FOR OTHER PLATES. SCALE ${SCALE_NAME[D.k]} WHEN PLOTTED.`);
     // general notes (GirderDetail dxfSection; the data of this project)
     const P = G.P, bo = (P.splices || {}).bolts || {}, sc = P.studs || {};
     const lines = ['DESIGN SPECIFICATION: AASHTO LRFD BRIDGE DESIGN SPECIFICATIONS, 10TH EDITION (2024). LIVE LOAD: HL-93.',
@@ -288,33 +348,59 @@
       'WELDING: AASHTO/AWS D1.5 BRIDGE WELDING CODE. FLANGE BUTT SPLICES CJP, GROUND FLUSH AND SMOOTH IN THE DIRECTION OF STRESS.',
       'ALL DIMENSIONS TO BE VERIFIED AGAINST THE CONTRACT DRAWINGS. GENERATED BY STEEL BRIDGE DESIGN (NEW).'];
     if (G.app && G.app.items.some(a => a.sch)) lines.push('BARRIER, RAILING AND FENCE SHAPES AND HEIGHTS ARE SCHEMATIC.');
-    notes(D, ly.t, xL, yBot - 12 * h, 'GENERAL NOTES', lines, 90);
+    notes(D, ly.t, xL, yF - 4.5 * h, 'GENERAL NOTES', lines, 90);
     return { id: 'sec', title: 'Typical cross-section', i0, i1: D.mark(), k: D.k, h: D.h };
   }
-  /* appurtenances on the section (GirderDetail dxfApp); returns the height used above the deck top */
+  /* appurtenances on the section (GirderDetail dxfApp); returns the height used above the deck top. SBXS: the deck-edge chain with chainFit;
+     the callouts fanned out above it (see section) */
   function appDraw(G, D, xL, xR, yTop) {
     const A = G.app ? G.app.items : []; if (!A.length) return 0;
     const h = D.h, X = x => xL + x * 12, ly = { b: D.layer('DECK-BARR', 8), c: D.layer('DECK-CURB', 8), r: D.layer('DECK-RAIL', 1), s: D.layer('DECK-SDWK', 9), m: D.layer('DECK-MEDN', 9), w: D.layer('DECK-WSRF', 3), t: D.layer('ANNO-TEXT', 7), d: D.layer('DIMS', 7) };
-    const kl = L => L ? ` (${f3(L.plf)} KLF ${L.cat}${L.ovr ? ', OVERRIDE' : ''})` : '', labs = []; let top = 0, ovY = 0, nW = 0;
+    const kl = L => L ? ` (${f3(L.plf)} KLF ${L.cat}${L.ovr ? ', OVERRIDE' : ''})` : '', labs = []; let top = 0, ovY = 0;
+    // labs: { s, y (anchor height), a0, a1 (the anchor may be anywhere from a0 to a1 on the item's top), pt (a railing: the anchor at its post) }
     A.forEach(a => { const y0 = yTop + a.y0;
       if (a.k === 'sw' || a.k === 'med' || a.k === 'curb') { D.rect(a.k === 'sw' ? ly.s : a.k === 'med' ? ly.m : ly.c, X(a.x0), y0, X(a.x1), y0 + a.h);
         if (a.k === 'med' && a.joint) D.line(ly.m, X((a.x0 + a.x1) / 2), y0 + a.h + h, X((a.x0 + a.x1) / 2), yTop - 1.5 * h, D.ltype('HIDDEN'));
-        labs.push({ x: X((a.x0 + a.x1) / 2), y: y0 + a.h, s: a.k === 'sw' ? `${a.sd === 'L' ? 'LEFT' : 'RIGHT'} SIDEWALK ${dFI((a.x1 - a.x0) * 12)} x ${dIn(a.h)}${kl(a.L)}` : a.k === 'med' ? `RAISED MEDIAN ${dFI((a.x1 - a.x0) * 12)} x ${dIn(a.h)}${kl(a.L)}${a.joint ? ', LONGIT. JOINT' : ''}` : `CURB ${dIn((a.x1 - a.x0) * 12)} x ${dIn(a.h)}${kl(a.L)}` }); }
+        labs.push({ a0: X(a.x0), a1: X(a.x1), y: y0 + a.h, s: a.k === 'sw' ? `${a.sd === 'L' ? 'LEFT' : 'RIGHT'} SIDEWALK ${dFI((a.x1 - a.x0) * 12)} x ${dIn(a.h)}${kl(a.L)}` : a.k === 'med' ? `RAISED MEDIAN ${dFI((a.x1 - a.x0) * 12)} x ${dIn(a.h)}${kl(a.L)}${a.joint ? ', LONGIT. JOINT' : ''}` : `CURB ${dIn((a.x1 - a.x0) * 12)} x ${dIn(a.h)}${kl(a.L)}` }); }
       else if (a.k === 'bar') { const w = (a.x1 - a.x0) * 12, s = a.sd === 'L' ? 1 : -1, x0 = a.sd === 'L' ? X(a.x0) : X(a.x1), P_ = (f, g) => [x0 + s * f * w, y0 + g * a.h];
         D.pline(ly.b, [P_(0, 0), P_(0, 1), P_(0.42, 1), P_(0.62, 0.3), P_(1, 0.12), P_(1, 0)], true);
-        labs.push({ x: X((a.x0 + a.x1) / 2), y: y0 + a.h, s: `BARRIER ${dFI(w)} AT DECK${kl(a.L)}, SHAPE AND HEIGHT SCHEMATIC` }); }
+        labs.push({ a0: Math.min(x0, x0 + s * 0.42 * w), a1: Math.max(x0, x0 + s * 0.42 * w), y: y0 + a.h, s: `BARRIER ${dFI(w)} AT DECK${kl(a.L)}, SHAPE AND HEIGHT SCHEMATIC` }); }
       else if (a.k === 'rail' || a.k === 'fence') { const x = X(a.x); D.line(ly.r, x, y0, x, y0 + a.h); D.line(ly.r, x - 3, y0 + a.h - 1.5, x + 3, y0 + a.h - 1.5); D.line(ly.r, x - 3, y0 + a.h * 0.55, x + 3, y0 + a.h * 0.55);
-        labs.push({ x, y: y0 + a.h, s: `${a.k === 'rail' ? 'RAILING' : 'SIDEWALK RAILING OR FENCE'} AT ${dFI((a.sd === 'L' ? a.x : G.app.Wd - a.x) * 12)} FROM DECK EDGE${kl(a.L)}, HEIGHT SCHEMATIC` }); }
+        labs.push({ a0: x, a1: x, pt: true, y: y0 + a.h, s: `${a.k === 'rail' ? 'RAILING' : 'SIDEWALK RAILING OR FENCE'} AT ${dFI((a.sd === 'L' ? a.x : G.app.Wd - a.x) * 12)} FROM DECK EDGE${kl(a.L)}, HEIGHT SCHEMATIC` }); }
       else { const t = a.h > 0 ? a.h : 0, yb = yTop + ovY, x0 = X(a.x0), x1 = X(a.x1), q = a.L && a.L.q != null ? a.L.q : a.L ? a.L.plf * 1000 / (a.x1 - a.x0) : 0;
         if (t > 0) { D.rect(ly.w, x0, yb, x1, yb + t); ovY += t; } else { D.line(ly.w, x0, yb + 0.5, x1, yb + 0.5, D.ltype('HIDDEN')); ovY += 0.5; }
-        labs.push({ x: x0 + (0.2 + 0.06 * nW++) * (x1 - x0), y: yb + Math.max(t, 0.5), s: `${a.k === 'ws' ? 'FUTURE WEARING SURFACE' : X_().str(a.L.desc).toUpperCase()} ${t > 0 ? `${dIn(t)} x ${f0(a.L.gam * 1000)} PCF = ` : ''}${Math.abs(q - Math.round(q)) < 0.05 ? f0(q) : q.toFixed(1)} PSF${kl(a.L)}${t > 0 ? '' : ', THICKNESS NOT SET (LINE ONLY)'}` }); }
+        labs.push({ a0: x0, a1: x1, y: yb + Math.max(t, 0.5), ws: true, s: `${a.k === 'ws' ? 'FUTURE WEARING SURFACE' : X_().str(a.L.desc).toUpperCase()} ${t > 0 ? `${dIn(t)} x ${f0(a.L.gam * 1000)} PCF = ` : ''}${Math.abs(q - Math.round(q)) < 0.05 ? f0(q) : q.toFixed(1)} PSF${kl(a.L)}${t > 0 ? '' : ', THICKNESS NOT SET (LINE ONLY)'}` }); }
       top = Math.max(top, a.y0 + (a.h || 0)); });
+    // the deck-edge chain: deck edges, item edges, railings
     const xs = [xL, xR]; A.forEach(a => { if (a.x0 != null && a.k !== 'ws' && a.k !== 'ovl') xs.push(X(a.x0), X(a.x1)); else if (a.x != null) xs.push(X(a.x)); });
-    const yC = yTop + top + 1.5 * h; D.chainH(ly.d, xs, yC, yTop);
-    const th = h * 0.7, mid = (xL + xR) / 2, Lh = labs.filter(q => q.x < mid).sort((p, q) => p.x - q.x), Rh = labs.filter(q => q.x >= mid).sort((p, q) => q.x - p.x), tw = q => q.s.length * th * 0.95 + th;
-    const clash = Lh.length && Rh.length && Math.max(...Lh.map(q => q.x + tw(q))) > Math.min(...Rh.map(q => q.x - tw(q))), off = clash ? Lh.length : 0, nr = clash ? Lh.length + Rh.length : Math.max(Lh.length, Rh.length);
-    [Lh, Rh].forEach((Gr, s) => Gr.forEach((q, i) => { const yl = yC + 2.2 * h + (Gr.length - 1 - i + (s ? off : 0)) * 2.1 * th; D.line(ly.t, q.x, q.y, q.x, yl + 0.4 * th); D.line(ly.t, q.x, yl + 0.4 * th, q.x + (s ? -0.6 : 0.6) * th, yl + 0.4 * th); D.text(ly.t, q.x + (s ? -0.8 : 0.8) * th, yl, th, q.s, s ? 2 : 0); }));
-    return top + 1.5 * h + 2.2 * h + nr * 2.1 * th + h;
+    const yC = yTop + top + 1.5 * h, C = chainFit(D, ly.d, xs.map(x => [x, yTop]), yC, 1, {});
+    // the callouts. Leaders: each clear of the chain's texts (0.3 h), its extension lines and leaders (0.6 h), the deck edges and the other
+    // callouts' leaders (1.6 h apart); on the item's top where it can be (nearest its middle), else the nearest free point, reached by a
+    // sloped leg under the chain; the wearing surface and overlays (any point along the deck, not through a barrier, sidewalk, curb or
+    // median) last. Texts: rows 1.9 h apart above the chain zone (text 0.7 h); the callouts nearest the middle of the deck lowest, each on
+    // the lowest row where its text clears the texts on that row and the leaders passing through it, and its leader clears the texts
+    // below; texts towards the middle (left of the middle: written to the right of the leader). Where that cannot be done, every text to
+    // the right of its leader, the leftmost highest (always possible).
+    const th = h * 0.7, mid = (xL + xR) / 2, yK = yC - 0.6 * h, yR = C.edge + 1.6 * h, gap = 1.9 * h;
+    const clr = x => !C.boxes.some(b => x > b[0] - 0.3 * h && x < b[2] + 0.3 * h) && !C.lines.some(v => Math.abs(x - v) < 0.6 * h) && x > xL + 0.6 * h && x < xR - 0.6 * h;
+    const own = A.filter(a => a.k !== 'ws' && a.k !== 'ovl' && a.x0 != null).map(a => [X(a.x0), X(a.x1)]), taken = [];
+    [...labs.filter(q => !q.ws).sort((p, q) => (p.a0 + p.a1) - (q.a0 + q.a1)), ...labs.filter(q => q.ws)].forEach(q => {
+      const c = (q.a0 + q.a1) / 2, st = 0.25 * h, cand = [], ok = x => clr(x) && taken.every(t => Math.abs(t - x) >= 1.6 * h) && (!q.ws || !own.some(([u, v]) => x > u - 0.3 * h && x < v + 0.3 * h));
+      for (let x = q.a0 + (q.pt ? 0 : 0.4 * h); x <= q.a1 - (q.pt ? 0 : 0.4 * h) + 1e-9; x += st) cand.push(x);
+      cand.sort((u, v) => Math.abs(u - c) - Math.abs(v - c)); for (let d = st; d <= xR - xL; d += st) cand.push(q.a0 - d, q.a1 + d);
+      q.xf = cand.find(ok); if (q.xf == null) q.xf = c; taken.push(q.xf); q.ax = Math.min(q.a1, Math.max(q.a0, q.xf)); q.w = tW(q.s, th); });
+    const place = (list, leftOf) => { const put = [];
+      for (const q of list) { const left = leftOf(q), x0 = left ? q.xf + 0.8 * th : q.xf - 0.8 * th - q.w, o = { xf: q.xf, left, x0, x1: x0 + q.w }; let r = 0;
+        for (; r < 60; r++) if (put.every(p => p.r === r ? (o.x1 + 0.6 * h < p.x0 || o.x0 - 0.6 * h > p.x1) : p.r < r ? !(o.xf > p.x0 - 0.3 * h && o.xf < p.x1 + 0.3 * h) : !(p.xf > o.x0 - 0.3 * h && p.xf < o.x1 + 0.3 * h))) break;
+        if (r === 60) return null; put.push({ q, ...o, r }); }
+      return put; };
+    const put = place(labs.slice().sort((p, q) => Math.abs(p.xf - mid) - Math.abs(q.xf - mid)), q => q.xf <= mid ? q.xf + 0.8 * th + q.w <= xR || q.xf - 0.8 * th - q.w < xL : q.xf - 0.8 * th - q.w < xL && q.xf + 0.8 * th + q.w <= xR)
+      || place(labs.slice().sort((p, q) => q.xf - p.xf), () => true);
+    put.forEach(p => { const q = p.q, yl = yR + p.r * gap;
+      if (Math.abs(q.ax - q.xf) < 1e-6) D.line(ly.t, q.xf, q.y, q.xf, yl + 0.4 * th); else { D.line(ly.t, q.ax, q.y, q.xf, yK); D.line(ly.t, q.xf, yK, q.xf, yl + 0.4 * th); }
+      D.line(ly.t, q.xf, yl + 0.4 * th, q.xf + (p.left ? 0.6 : -0.6) * th, yl + 0.4 * th); D.text(ly.t, p.left ? p.x0 : p.x1, yl, th, q.s, p.left ? 0 : 2); });
+    const nr = put.length ? Math.max(...put.map(q => q.r)) + 1 : 0;
+    return (yR - yTop) + nr * gap + h;
   }
 
   /* all(G, opt): the three drawings in one model space (plan at the origin, the elevation of girder opt.gi below it, the section below
diff --git a/apps/steel-bridge/engine/sheets.js b/apps/steel-bridge/engine/sheets.js
index 24f5269..10a32fd 100644
--- a/apps/steel-bridge/engine/sheets.js
+++ b/apps/steel-bridge/engine/sheets.js
@@ -137,13 +137,17 @@
   }
 
   /* ---------- weld symbol (GirderDetail dxfWeld): leader to (x, y), reference line, fillet triangle(s) or CJP groove, size ---------- */
-  function weld(D, l, x, y, size, both, type, note, dir) {
-    type = type || 'fillet'; dir = dir || 1; const h = D.h, rx = x + dir * 3 * h, ry = y + 3 * h, L = 5 * h, x1 = rx + dir * L;
-    D.line(l, x, y, rx, ry); D.line(l, rx, ry, x1, ry); D.line(l, x, y, x + dir * 0.6 * h, y + 0.3 * h); D.line(l, x, y, x + dir * 0.3 * h, y + 0.6 * h);
+  /* SBXS (2026-11-10): o (optional; the typical section only): { rise (the reference line's height above y; negative: below; default 3 h),
+     wrap (the note on a second line under the reference line, from the leader's end) }. Without o: as before. */
+  function weld(D, l, x, y, size, both, type, note, dir, o) {
+    o = o || {}; type = type || 'fillet'; dir = dir || 1; const h = D.h, rx = x + dir * 3 * h, ry = y + (o.rise == null ? 3 * h : o.rise), L = 5 * h, x1 = rx + dir * L;
+    const sg = ry >= y ? 1 : -1;   // the arrowhead along the leader
+    D.line(l, x, y, rx, ry); D.line(l, rx, ry, x1, ry); D.line(l, x, y, x + dir * 0.6 * h, y + sg * 0.3 * h); D.line(l, x, y, x + dir * 0.3 * h, y + sg * 0.6 * h);
     const mx = rx + dir * L * 0.55, s = 0.8 * h;
     const sym = up => type === 'cjp' ? D.pline(l, [[mx - s / 2, ry + up * s], [mx, ry], [mx + s / 2, ry + up * s]], false) : D.pline(l, [[mx, ry], [mx, ry + up * s], [mx + s, ry]], true);
-    sym(-1); if (both) sym(1); if (size) D.text(l, mx - (dir > 0 ? 1.2 : -1.2) * h, ry - 1.2 * h, h * 0.75, size, 2);
-    if (note) D.text(l, dir > 0 ? x1 + 0.4 * h : x1 - 0.4 * h, ry - 0.35 * h, h * 0.7, note, dir > 0 ? 0 : 2);
+    sym(-1); if (both) sym(1); if (size) D.text(l, o.rise != null && dir < 0 ? mx - 0.4 * h : mx - (dir > 0 ? 1.2 : -1.2) * h, ry - 1.2 * h, h * 0.75, size, 2);   // SBXS (with o): leftwards, the size left of the fillet, not on it
+    if (note && o.wrap) D.text(l, rx, ry - 2.4 * h, h * 0.7, note, dir > 0 ? 0 : 2);
+    else if (note) D.text(l, dir > 0 ? x1 + 0.4 * h : x1 - 0.4 * h, ry - 0.35 * h, h * 0.7, note, dir > 0 ? 0 : 2);
   }
   const sheetNo = (C, pre) => { const i = C.list.findIndex(t => t.startsWith(pre)); return i >= 0 ? `SHEET ${i + 1}` : ''; };
 
@@ -220,7 +224,16 @@
     const G = C.G, h = D.h, i0 = D.mark(); DW().section(G, D, { k: D.k });
     const lt = D.layer('ANNO-TEXT', 7), sec = G.girders.map(g => g.segs[0]), tTop = Math.max(...sec.map(s => s.topT)), j = Math.min(1, G.nb - 1), s = sec[j], x = G.ys[j] * 12;
     const yt = -(tTop - s.topT), w = fwSize(C.P, s);
-    weld(D, lt, x + s.tw / 2, yt - s.topT, dIn(w), true, 'fillet', 'FLANGE-TO-WEB, TOP'); weld(D, lt, x + s.tw / 2, yt - s.topT - s.D, dIn(w), true, 'fillet', 'FLANGE-TO-WEB, BOT.');
+    /* SBXS: the two weld symbols in the bays either side of the girder (top: to the right, leader down from the top flange; bottom: to
+       the left, leader up from the bottom flange), so they cannot overlap each other, inside the web depth and clear of the girder
+       labels; the note under the reference line where the bay is too narrow for it at the end (was: both to the right, leaders up, the
+       top one into the deck, the notes across the next girder) */
+    const yTj = yt - s.topT, yBj = yTj - s.D, yLo = Math.min(...sec.map(q => -(tTop - q.topT) - q.topT - q.D - q.botT)) - 2.9 * h;   // the lowest point: clear of the girder spacing texts
+    const nT = 'FLANGE-TO-WEB, TOP', nB = 'FLANGE-TO-WEB, BOT.', tl = n => n.length * 0.68 * 0.7 * h;
+    const room = d => { const i = j + d; if (i < 0 || i >= G.nb) return Infinity; const q = sec[i]; return Math.abs(G.ys[i] * 12 - x) - Math.max(q.topB, q.botB) / 2 - s.tw / 2 - 0.6 * h; };
+    const wT = 8.4 * h + tl(nT) > room(1), wB = 8.4 * h + tl(nB) > room(-1);
+    const rT = -Math.max(1.0 * h, Math.min(3 * h, yTj - yLo - (wT ? 2.5 : 1.3) * h)), rB = Math.max(1.0 * h, Math.min(3 * h, s.D - 1.0 * h));
+    weld(D, lt, x + s.tw / 2, yTj, dIn(w), true, 'fillet', nT, 1, { rise: rT, wrap: wT }); weld(D, lt, x - s.tw / 2, yBj, dIn(w), true, 'fillet', nB, -1, { rise: rB, wrap: wB });
     const b = D.bbox(i0), Q = quantities(G, C.RS), T = DW().table, tb = D.layer('TABL', 7);
     const T1 = T(D, tb, b[2] + 8 * h, b[3], ['ITEM', 'QUANTITY', 'UNIT'], Q.rows, 'ESTIMATED QUANTITIES (WHOLE BRIDGE)');
     T(D, tb, b[2] + 8 * h, T1.y - 2 * h, ['WELD', 'SIZE', 'LINES', 'LENGTH (FT)', 'WELD METAL (LB)'], Q.welds.map(q => [q.k, dIn(q.w), String(q.lines), f0(q.Lft), f0(q.wt)]).concat([['TOTAL', '', '', f0(Q.welds.reduce((a, q) => a + q.Lft, 0)), f0(Q.welds.reduce((a, q) => a + q.wt, 0))]]),
diff --git a/apps/steel-bridge/index.html b/apps/steel-bridge/index.html
index 3246f62..8a3a20a 100644
--- a/apps/steel-bridge/index.html
+++ b/apps/steel-bridge/index.html
@@ -205,6 +205,7 @@
   table.tbl td input{width:62px;font-size:9pt;padding:1px 3px;text-align:right;}
   table.tbl tr.sel{background:#eef4fb;}
   .tscroll{overflow-x:auto;}
+  .fp-sc{overflow-x:auto;max-width:100%;} .fp-ex{display:block;font-family:var(--font-ui);font-size:9pt;margin:2px 0 4px;} @media print{.fp-sc svg{min-width:0!important;}}   /* SKP: the framing plan (ui/framing.js plan) */
   /* this app */
   .note{font-size:9pt;color:#475569;margin:4px 0;}
   .alert{border:1px solid var(--color-border);border-left:4px solid var(--warn);background:#FFFBEB;padding:6px 9px;margin:8px 0;font-family:var(--font-ui);font-size:9pt;}
diff --git a/apps/steel-bridge/ui/framing.js b/apps/steel-bridge/ui/framing.js
index b2c9360..ee0740d 100644
--- a/apps/steel-bridge/ui/framing.js
+++ b/apps/steel-bridge/ui/framing.js
@@ -23,20 +23,56 @@
   function ensure(P) { const M = window.SBDModel; if (!P.framing) P.framing = M.defaultFraming(); if (!P.crossframes) P.crossframes = M.defaultCrossframes();
     if (!P.crossframes.userMode) P.crossframes.userMode = { StrI: 'add', Con: 'add' };   // CFRM (2026-11-01): absent in older projects = 'add', today's behaviour
     return P; }
-  /* plan(L): the framing plan as SVG: girders (blue), support lines (skewed), end and intermediate cross-frames, field splices (ticks) */
-  function plan(L, dOn) {   // dOn (SBDIA): the bracing is a diaphragm: the caption and label say so (the drawing is the same)
-    const FR = L.FR, m = L.m, W = 720, pad = 34, ys = FR.ys, yMax = ys[ys.length - 1];
-    const xs0 = Math.min(...FR.girders.map(g => g.x0)), xs1 = Math.max(...FR.girders.map(g => g.x0 + g.bear[g.bear.length - 1])), sx = (W - 2 * pad) / Math.max(xs1 - xs0, 1);
-    const Hp = Math.max(60, Math.min(260, yMax * sx * 2.2)), sy = Hp / Math.max(yMax, 1), X = x => pad + (x - xs0) * sx, Y = y => 22 + y * sy;
+  /* plan(L, dOn, opt): the framing plan as SVG: girders (blue), support lines (skewed), end and intermediate cross-frames, field splices (ticks).
+     dOn (SBDIA): the bracing is a diaphragm: the caption and label say so (the drawing is the same).
+     SKP (2026-11-10, engineer: "the bearing line skew seems off"): the plan was drawn to scale along the bridge only, its width stretched to
+     a height of 60 to 260 px (2.2 times the length scale, less when capped), so a support line's drawn angle was not the skew (a 30° skew
+     drew at 13° on the 360 ft built-in bridge and at 41° on a 40 ft span). Now one scale in both directions, so the bearing lines are drawn
+     at the true skew, measured from the normal to the girders as engine/framing.js places the bearings (x = x_support + (y − y_c) tan θ),
+     each labelled θ; the support lines run through the end bearings (extended along the line, not vertically). Display only.
+     The scale: the plan 720 units wide, or wider so that the girder lines are at least 14 units apart (labels 9 units), or narrower so
+     that it is at most 560 units tall. vex > 1: the width exaggerated vex times (angles not to scale; θ labels the true skew).
+     opt.ui (screens): the plan in a box that scrolls sideways, at least 82 % of its drawn width (its text at least 7.4 px), and, where the
+     true-scale plan is long and thin (length over width > 5), a check box "Exaggerate the width" (the choice kept for the session, not
+     saved). Without opt.ui (the Report): the true-scale SVG alone, as wide as its frame. */
+  const PLAN = { ex: false };
+  function planSvg(L, dOn, vex, ui) {
+    const FR = L.FR, m = L.m, pad = 34, ys = FR.ys, nb = ys.length, yMax = ys[nb - 1];
+    const xs0 = Math.min(...FR.girders.map(g => g.x0)), xs1 = Math.max(...FR.girders.map(g => g.x0 + g.bear[g.bear.length - 1])), Lx = Math.max(xs1 - xs0, 1);
+    const bayMin = nb > 1 ? Math.min(...ys.slice(1).map((y, i) => y - ys[i])) : 1;
+    let sx = Math.max((720 - 2 * pad) / Lx, nb > 1 ? 14 / Math.max(bayMin * vex, 1e-6) : 0);
+    if (yMax * sx * vex > 560) sx = Math.max(560 / (yMax * vex), 1e-6);
+    const sy = sx * vex, W = Math.max(2 * pad + Lx * sx, 240), t0 = 30, X = x => pad + (x - xs0) * sx, Y = y => t0 + y * sy, E = 8;
+    const f1 = v => (Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v)) : v.toFixed(2).replace(/0$/, '')).replace('-', '−');
     let o = '';
-    m.sup.forEach((_, k) => o += `<line x1="${X(FR.xb(k, 0)).toFixed(1)}" y1="${(Y(0) - 8).toFixed(1)}" x2="${X(FR.xb(k, ys.length - 1)).toFixed(1)}" y2="${(Y(yMax) + 8).toFixed(1)}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 3"/><text x="${X(FR.xb(k, 0)).toFixed(1)}" y="12" font-size="9" text-anchor="middle" fill="#475569">${k === 0 ? 'Abut. 1' : k === m.sup.length - 1 ? 'Abut. 2' : 'Pier ' + k}</text>`);
+    const ends = m.sup.map((_, k) => { const ax = X(FR.xb(k, 0)), ay = Y(0), bx = X(FR.xb(k, nb - 1)), by = Y(yMax), len = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / len, uy = (by - ay) / len;
+      return { k, ax: ax - ux * E, ay: ay - uy * E, bx: bx + ux * E, by: by + uy * E }; });
+    // θ labels under the lower ends; where two would be closer than 56 units, every other one a line lower
+    let low = 0; ends.forEach((q, i) => { q.row = i && Math.abs(q.bx - ends[i - 1].bx) < 56 && !ends[i - 1].row ? 1 : 0; if (q.row) low = 1; });
+    ends.forEach(q => { const k = q.k, nm = k === 0 ? 'Abut. 1' : k === m.sup.length - 1 ? 'Abut. 2' : 'Pier ' + k;
+      o += `<line x1="${q.ax.toFixed(1)}" y1="${q.ay.toFixed(1)}" x2="${q.bx.toFixed(1)}" y2="${q.by.toFixed(1)}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 3"/><text x="${q.ax.toFixed(1)}" y="${(q.ay - 5).toFixed(1)}" font-size="9" text-anchor="middle" fill="#475569">${nm}</text>`
+        + `<text x="${q.bx.toFixed(1)}" y="${(q.by + 11 + q.row * 11).toFixed(1)}" font-size="9" text-anchor="middle" fill="#0F172A" data-skew="${k}">θ = ${f1(+m.skews[k] || 0)}°</text>`; });
     FR.frames.forEach(f => o += `<line x1="${X(f.xa).toFixed(1)}" y1="${Y(ys[f.bay]).toFixed(1)}" x2="${X(f.xc).toFixed(1)}" y2="${Y(ys[f.bay + 1]).toFixed(1)}" stroke="${f.type === 'sup' ? '#B45309' : '#16304F'}" stroke-width="${f.type === 'sup' ? 2.2 : 1.3}"/>`);
     FR.girders.forEach(g => { o += `<line x1="${X(g.x0).toFixed(1)}" y1="${Y(g.y).toFixed(1)}" x2="${X(g.x0 + g.bear[g.bear.length - 1]).toFixed(1)}" y2="${Y(g.y).toFixed(1)}" stroke="#2563EB" stroke-width="2.4"/><text x="${(pad - 6)}" y="${(Y(g.y) + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="#1E3A5F">G${g.i + 1}</text>`;
       m.splices.forEach(s => { const xg = g.x0 + s; o += `<line x1="${X(xg).toFixed(1)}" y1="${(Y(g.y) - 4).toFixed(1)}" x2="${X(xg).toFixed(1)}" y2="${(Y(g.y) + 4).toFixed(1)}" stroke="#DC2626" stroke-width="1.6"/>`; }); });
-    const H = Y(yMax) + 26;
-    return `<svg viewBox="0 0 ${W} ${H.toFixed(0)}" style="width:100%;height:auto;background:#fff;border:1px solid #e4e7eb;border-radius:4px" role="img" aria-label="Framing plan: girders, supports and ${dOn ? 'diaphragms' : 'cross-frames'}">${o}
-      <text x="${pad}" y="${(H - 6).toFixed(0)}" font-size="9" fill="#475569">Plan, to scale along the bridge (vertical scale exaggerated). Blue: girders; brown: end ${dOn ? 'diaphragms' : 'cross-frames'} on the bearing lines; navy: intermediate ${dOn ? 'diaphragms' : 'cross-frames'}; red ticks: field splices.</text></svg>`;
+    const yc = Math.max(Y(yMax) + E, ...ends.map(q => q.by)) + 11 + low * 11, H = yc + 30, bw = dOn ? 'diaphragms' : 'cross-frames';
+    const cap1 = vex > 1 ? `Plan, width exaggerated ×${f1(vex)}: the angles are not to scale; θ is the true skew of each support line.` : 'Plan, true scale in both directions: each support line is drawn at its skew θ from the normal to the girders.';
+    return `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" style="width:100%;${ui ? `min-width:${Math.round(0.82 * W)}px;` : ''}height:auto;background:#fff;border:1px solid #e4e7eb;border-radius:4px${ui ? `;display:${(vex > 1) === PLAN.ex ? 'block' : 'none'}` : ''}" role="img" aria-label="Framing plan: girders, supports and ${bw}"${ui ? ` data-fpv="${vex > 1 ? 'x' : 't'}"` : ''}>${o}
+      <text x="${pad}" y="${(yc + 12).toFixed(0)}" font-size="9" fill="#475569">${cap1}</text>
+      <text x="${pad}" y="${(yc + 23).toFixed(0)}" font-size="9" fill="#475569">Blue: girders; brown: end ${bw} on the bearing lines; navy: intermediate ${bw}; red ticks: field splices.</text></svg>`;
   }
+  function plan(L, dOn, opt) {
+    if (!(opt && opt.ui)) return planSvg(L, dOn, 1, false);
+    const FR = L.FR, ys = FR.ys, wid = ys[ys.length - 1], Lx = Math.max(...FR.girders.map(g => g.x0 + g.bear[g.bear.length - 1])) - Math.min(...FR.girders.map(g => g.x0));
+    const r = wid > 0 ? Lx / wid : 0, vex = r > 5 ? Math.min(4, Math.round(r / 5 * 2) / 2 + 0.5) : 1;   // offered for a long, thin plan: about a fifth of the length tall, at most ×4
+    return `<div class="fp-plan">${vex > 1 ? `<label class="fp-ex"><input type="checkbox" data-fpex${PLAN.ex ? ' checked' : ''}> Exaggerate the width ×${String(vex)} (long bridge; the angles are then not to scale)</label>` : ''}
+      <div class="fp-sc">${planSvg(L, dOn, 1, true).replace('display:none', vex > 1 ? 'display:none' : 'display:block')}${vex > 1 ? planSvg(L, dOn, vex, true) : ''}</div></div>`;
+  }
+  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('change', e => {   // SKP: the "Exaggerate the width" check box, every plan on the page
+    const c = e.target; if (!c || !c.matches || !c.matches('[data-fpex]')) return; PLAN.ex = !!c.checked;
+    document.querySelectorAll('[data-fpex]').forEach(q => { q.checked = PLAN.ex; });
+    document.querySelectorAll('svg[data-fpv]').forEach(s => { s.style.display = (s.dataset.fpv === 'x') === PLAN.ex ? 'block' : 'none'; });
+  });
   /* BRSEL (2026-11-09): the "Intermediate bracing" drop-down. braceOf(C): the choice shown for the saved fields: a diaphragm when
      dia.on = 'yes' (type kept underneath), 'ch' when its shape is one of CF_CH, else 'w' (CF_DIA or custom W); otherwise the frame type.
      setBrace(P, v): writes the choice back: a frame sets type and dia.on = 'no'; a diaphragm sets dia.on = 'yes' and leaves type alone;
@@ -73,7 +109,7 @@
         <div class="fRow"><label for="fr_spl">Field splices</label><input type="text" id="fr_spl" data-fr="splices" value="${esc((F.splices || []).join(', '))}" style="width:180px"><span class="unit"></span></div>
         ${h.num('framing.spliceClear', 'Frames clear of splices and transitions', 'ft')}
         <p class="note">Girders and spacings: Cross-section tab; support skews: Bridge layout tab. The plates of every girder give the shop transitions. Frames normal to the girders at a support skewed more than 20° start at least max(clear, 4b<sub>f</sub>, 0.4s) from the obtuse bearing (C6.7.4.2.1); corner frames close longer panels. Owner rule xf.orient applies with the automatic orientation.</p>
-        ${L && !L.errors.length ? plan(L, dOn) : `<div class="alert err">${esc((L && L.errors || []).join(' '))}</div>`}`)
+        ${L && !L.errors.length ? plan(L, dOn, { ui: true }) : `<div class="alert err">${esc((L && L.errors || []).join(' '))}</div>`}`)
       + h.card('Intermediate bracing (6.7.4.2)', `${h.sel('crossframes.type', 'Intermediate bracing', BRACE, br).replace('<select ', '<select style="width:200px;max-width:100%" ')}
         ${h.num('crossframes.dMinXF', 'Minimum girder depth for cross-frames', 'in')}${dOn ? `${h.sel('crossframes.dia.shape', 'Shape', br === 'ch' ? CF.CF_CH.map(s => [s[0], s[0]]) : [...CF.CF_DIA.map(s => [s[0], s[0]]), ['custom', 'Custom W']])}
         ${C.dia.shape === 'custom' ? `${h.num('crossframes.dia.d', 'Depth d', 'in')}${h.num('crossframes.dia.bf', 'Flange width', 'in')}${h.num('crossframes.dia.tf', 'Flange thickness', 'in')}${h.num('crossframes.dia.tw', 'Web thickness', 'in')}` : ''}
@@ -108,7 +144,7 @@
   function layoutPlan(P) {
     ensure(P); let L = null; try { L = window.SBDFraming.compute(P); } catch (e) { L = { errors: [e.message] }; }
     const dOn = isDia(P);
-    return (L && !L.errors.length ? plan(L, dOn) : `<div class="alert err">${esc((L && L.errors || []).join(' '))}</div>`)
+    return (L && !L.errors.length ? plan(L, dOn, { ui: true }) : `<div class="alert err">${esc((L && L.errors || []).join(' '))}</div>`)
       + `<p class="note">${dOn ? 'Diaphragms' : 'Cross-frames'}, their spacing and orientation, and the field splices: <a href="#" data-itgo="framing">Framing &amp; bracing tab</a>.</p>`;
   }
   function onChange(el, P) {
@@ -199,7 +235,7 @@
     h += dOn ? `<section class="sec"><div class="secHead">Diaphragms: elevation</div><div class="secBody">${diaSvg(B)}</div></section>`   // SBDIA: the diaphragm, not the X / K truss
       : `<section class="sec"><div class="secHead">Cross-frames: elevation</div><div class="secBody"><div data-gfxb="crossframe"></div></div></section>`;   // drawn by ui/tabgraphics-b.js from the results below
     // layout
-    h += `<section class="sec"><div class="secHead">Framing (6.7.4.2.1)</div><div class="secBody">${plan(L, dOn)}
+    h += `<section class="sec"><div class="secHead">Framing (6.7.4.2.1)</div><div class="secBody">${plan(L, dOn, { ui: true })}
       <div class="tscroll"><table class="tbl"><thead><tr><th>Span</th><th>Skew θ (°)</th><th class="lft">Orientation</th><th>Frames</th><th>Spacing (ft)</th><th>Conflicts</th><th></th></tr></thead><tbody>
       ${FR.orient.map(o => `<tr><td>${o.k + 1}</td><td>${fmt(o.th, 2)}</td><td class="lft">${o.o === 'normal' ? `normal, ${o.flat ? 'contiguous' : esc(o.arr)}` : 'parallel to the skew'}</td><td>${o.n}</td><td>${fmt(o.s, 3)}</td><td class="${o.conflicts ? 'fx-hi' : ''}">${o.conflicts || 0}</td><td>${wk(`fr.k${o.k}.s`)}</td></tr>`).join('')}</tbody></table></div>
       <div class="tscroll"><table class="tbl"><thead><tr><th>Girder</th><th>Intermediate frames</th><th>Largest L<sub>b</sub> (ft)</th><th class="lft">Brace points (own stations, ft)</th><th></th></tr></thead><tbody>
diff --git a/apps/steel-bridge/ui/summary.js b/apps/steel-bridge/ui/summary.js
index 2650570..15de47e 100644
--- a/apps/steel-bridge/ui/summary.js
+++ b/apps/steel-bridge/ui/summary.js
@@ -55,8 +55,8 @@ details.sum-g>summary{cursor:pointer;font-family:var(--font-ui);font-size:9.5pt;
 @media screen and (max-width:600px){table.sum-ov th{white-space:normal;width:auto;min-width:90px}}
 .sum-gfx{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
 .sum-g1{margin:0;min-width:0} .sum-g1 figcaption{font-family:var(--font-ui);font-size:8.5pt;color:#475569;margin:0 0 4px} .sum-g1 .note{font-size:8.5pt}
-.sum-gbox{background:#fff;color:#0F172A;border:1px solid #e4e7eb;border-radius:4px;padding:4px;color-scheme:light;overflow:hidden} .sum-gbox svg{display:block;width:100%;max-width:100%;height:auto;margin:0 auto}
-@media print{.sum-gfx{grid-template-columns:minmax(0,1fr)} .sum-g1{break-inside:avoid} .sum-gbox{-webkit-print-color-adjust:exact;print-color-adjust:exact} .sum-gbox svg{width:100%!important}}
+.sum-gbox{background:#fff;color:#0F172A;border:1px solid #e4e7eb;border-radius:4px;padding:4px;color-scheme:light;overflow:hidden} .sum-gbox svg{display:block;width:100%;max-width:100%;height:auto;margin:0 auto} .sum-gbox .fp-sc svg{max-width:none}
+@media print{.sum-gfx{grid-template-columns:minmax(0,1fr)} .sum-g1{break-inside:avoid} .sum-gbox{-webkit-print-color-adjust:exact;print-color-adjust:exact} .sum-gbox svg{width:100%!important;min-width:0!important}}
 @media print{.sum-run button{display:none}}`;
     document.head.appendChild(st);
   }
@@ -209,7 +209,7 @@ details.sum-g>summary{cursor:pointer;font-family:var(--font-ui);font-size:9.5pt;
      (window resize, the splitter's 'sbd2:panelresize', and a ResizeObserver on the card for the left column's collapse; rAF-throttled). Print: full page width (CSS). Display only. */
   const GFX_CAP = () => Math.max(360, Math.min(760, 0.8 * (window.innerHeight || 900)));
   function sizeGfx(el) {
-    el.querySelectorAll('.sum-gbox > svg').forEach(s => { const vb = (s.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number), bx = s.parentNode.clientWidth - 8;
+    el.querySelectorAll('.sum-gbox > svg, .sum-gbox .fp-sc > svg').forEach(s => { const vb = (s.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number), bx = s.closest('.sum-gbox').clientWidth - 8;   // SKP: the framing plan in its scroll box
       if (!(vb[2] > 0 && vb[3] > 0) || !(bx > 0)) { s.style.width = ''; return; }
       const w = Math.min(bx, GFX_CAP() * vb[2] / vb[3]); s.style.width = w < bx - 1 ? Math.floor(w) + 'px' : ''; });
   }
```
- **Provisions:** none. No formula, factor, unit, reference or computed value changes.
- **Check case:** 11 girders at 4 ft, a 40 ft span, θ = 30°. The Abut. 1 line runs from (X(−11.547), Y(0)) to (X(11.547), Y(40)) with s_x = s_y, so atan(23.094/40) = 30.00° (before: 40.84°). Typical section, built-in and 11-girder projects, sheet 1:32 and Summary 1:96: 0 texts over texts and 0 lines through a text (before: 6 to 24). The section sheet's plot scale is unchanged (1:32 and 1:24).
- **Baseline:** new `tests/baselines/dxf-sheets.json` (each sheet as its own DXF, recorded on origin/main 122e4f5's parent afa735f). Only the 10 `|sec` entries were re-recorded (engineer-requested exception); the other 148 sheets and all plot scales are unchanged.
- **How verified:** new tests `tests/engine/framing-plan.test.mjs` and `tests/engine/dxf-sheets.test.mjs`; the engine tests drawings, sheets, dxf-detc, framing, graphics, report and crossframes; the smoke tests steel-bridge-drawings, -summary, -graphics, -dxf-unchanged and phone-layout --tool sbapp; check-syntax.
- **Saved data (§5):** none (the exaggeration toggle is not stored).
- **Decisions (pending engineer review):** the girder spacing and out-to-out dimensions below the girders; the deck dimension on the left; a scrolling plan box; the exaggerated view offered only when L/W > 5.
- **Open items:** (a) the DXF framing plan has G1 at the bottom (y up), the mirror of the SVG plan, 3D view and section; the skew angle itself is right; not changed. (b) On paper B the section sheet does not fit at any scale (k = 1200, on main too).
## 2026-11-10 — PR: claude/handoffs-card-steel-bridge (PR #1346: https://github.com/mlococo88/All-Structural/pull/1346) — Project tab: the hand-off card becomes "Hand-offs" with "Receive from other tools" and "Send to other tools" (HOC; engineer request 2026-11-10 "the push/pull should probably all be in the Project tab")   [display only; no computed value, payload, storage key or saved-data format change]
- **Where:** `apps/steel-bridge/ui/handoffs.js` `function card(P, ui)` (anchor `/* ---------- UI: one card on the Project tab ---------- */`): rewritten. Same buttons and `data-ho` actions (`pmUse`, `pmShare`, `lldfPull`, `lldfFile`, `lldfInput`, `lldfDrop`, `subSend`, `subFile`, `goAn`), same `data-ho-opt` boxes, same `onClick`, confirms and the LL & DL review dialog; `id="sbdHo"` kept. Card title "Other tools (hand-offs)" → "Hand-offs". Rows: Receive — Shared project info (from any tool), Live load distribution factors (from LL & DL Distribution); Send — Shared project info (to every tool), Geometry and reactions (to Bridge Substructure Loading). New helpers `lastSent(P, ch)` (reads this browser's per-project copy `SharedHandoffStore.copyKey(ch, 'steelbridge', pid)`, read only) and `lldfAt()` (reads `bridgeSuite.v1.lldf.updatedAt`, read only).
  - LL & DL row: a plate-girder select `id="i__gHo"` (shown when the project has more than one plate girder) next to the button; it sets the same `ui.g` as the Girders & plates tab's `i__g`. `apps/steel-bridge/index.html`: `if (el.id === 'i__g') {` → `if (el.id === 'i__g' || el.id === 'i__gHo') {`.
  - Status (LL & DL): "new data available" (`BridgeXfer.isNew('lldf', 'steelbridge')`), else "no new data since the last pull" (an `lldf.updatedAt` exists), else "nothing available (LL & DL has not published)". "Last received for <girder>": the existing `girders[i].dfPull.source` line (unchanged text), or "none".
  - Send row: "Last sent: Geometry <time>; Reactions <time> (project "<name>", from this browser)" from the per-project copies; "nothing sent yet …" or "not kept per project until the project has a name".
  - §6 note at the top of the card: "Nothing is applied until you click and confirm: each pull shows what changes first. Each send is kept for this project …" (the card's existing wording, gathered).
  - CSS in `index.html`: `#sbdHo .hoGrp`, `.hoRow`, `.hoWho`, `.hoTool`, `#sbdHo .fRow label{min-width:0;}`.
- **HANDOFF.md** §4.1 and §4.14: the card's name.
- **Provisions:** none. **Check case:** main vs branch probe (two plate girders; Use shared project info, Share project info, Pull from LL & DL for G2 → Apply, Send to Substructure Loading): all 15 localStorage keys byte-identical after normalising ISO times (incl. `sbd2.project.current`, `superGeometry*`, `superReactions*`, `projectMeta`, `lldf.adopted.steelbridge`); every alert / confirm text and the review pane text identical; `girders[1].dfPull` set in both.
- **Saved data (§5):** none (the `ui.g` choice is the existing UI state).
- **Decisions (pending engineer review):** (1) the per-girder LL & DL pull keeps a plate-girder selector in the card (the same choice as the Girders & plates tab), rather than a link back to that tab. (2) "Last sent" is read from this browser's per-project copies (no new record is stored); another browser's sends are not shown. (3) No other tab of this app had hand-off controls, so no "Project tab → Hand-offs" link was needed.
- **Other copies:** none.

## 2026-11-10 — PR: claude/sb-plan-flip (PR #1348: https://github.com/mlococo88/All-Structural/pull/1348) — Drawings: framing plan and erection diagram sheets drawn with G1 at the top (SBFLIP; drawing only, engineer decision 2026-11-10)
- **Problem:** the DXF framing plan (`engine/drawings.js plan()`, sheet "FRAMING PLAN") and the erection diagram (`engine/sheets.js erect()`, sheet "ERECTION DIAGRAM AND GIRDER LAYOUT") drew G1 at the bottom (Y = y·12, y up). With stations increasing to the right, that is the mirror image of the screen plan (Framing tab, Summary, Report), the 3D view and the typical section, which all show G1 on top (found in #1343, open item (a)). Engineer decision 2026-11-10: G1 at the top, G_nb at the bottom, stations to the right, on the sheet and its DXF.
- **Change (drawing only; no computed value, saved data or tab-graphic DXF changes):**
  - `plan()`: `Y = y => y * 12` → `Y = y => (wid - y) * 12` (wid = y of G_nb), with `yT = Y(G.ys[0])` (G1, top) and `yB = Y(wid)` (G_nb, bottom). The x of every point is unchanged (`FR.xb(k, i) = sup_k + (y_i − y_c) tan θ_k`), so a + skew puts the G_nb (lower) end ahead-station, as the screen plan.
  - Annotations moved to keep the drawing a true mirror with readable text (no text is mirrored; all rotation 0): G1's cross-frame chain `Y(0) − 3h` → `yT + 3h`; spans "SPAN k = … (G1)" `Y(0) − 6h` → `yT + 6h`; G_nb's chain `Y(wid) + 3h` → `yB − 3h`; field-splice chain `Y(wid) + 6h` → `yB − 6h`, FS labels `Y(wid) + 8.4h` → `yB − 9.2h` (under the splice extension lines); support-line leader and "CL BRG. ABUT. 1 / CL PIER k / CL BRG. ABUT. 2" from the G_nb end up to `Y(wid) + 10h` → from the G1 end up to `yT + 10h`; "SKEW θ°" from beyond the G1 end → beyond the G_nb end (below the plan); title, scale note and RIDOT note `Y(wid) + 14h / 12.4h / 16h` → `yT + …`; framing tables `Y(0) − 10h` → `yB − 11h`; the out-to-out dimension `dimV(Y(0), Y(wid))` → `dimV(yB, yT)`.
  - Kept on the same side of each girder as before (toward the next girder): connection plates `gy + q.side·(b_t + 0.3)` → `gy − q.side·(b_t + 0.3)`; intermediate stiffeners `sg = i === 0 ? 1 : -1` → `i === 0 ? -1 : 1`; the G1 top-flange labels `Y(g0.y) + b_f/2 + 0.8h` → `Y(g0.y) − b_f/2 − 1.5h`; the X and E tags `dy = 1` → `dy = −1`.
  - `erect()`: `Y = y => y * 12` → `Y = y => (G.ys[nb − 1] − y) * 12`; FS labels (along G_nb) `Y(g.y) + 2h` → `Y(g.y) − 2.9h`; title and note above G1 (`Y(G.ys[0]) + 7h / 5.3h`); tables `Y(0) − 6h` → `Y(G.ys[nb − 1]) − 6h`. The work-point table (X along the girders, Y toward G_nb, in ft) is data and is unchanged.
  - `erect()` support lines: before, they ran on 2h past G1 and G_nb in y only, `line(xb(k,0), Y(y_1) − 2h, xb(k,nb−1), Y(y_nb) + 2h)`, which drew a skewed line at less than its skew (11-girder bridge at 30°: 16.10°). After: extended 2h along the line itself, so the drawn angle is the skew. **Decision (pending engineer review):** fixed here because the task asks for the skew to be drawn correctly on every plan sheet; it is drawing geometry only.
- **Exact code:** before / after (`git diff` of the two engine files):
```diff
diff --git a/apps/steel-bridge/engine/drawings.js b/apps/steel-bridge/engine/drawings.js
index f64549d..fdc291a 100644
--- a/apps/steel-bridge/engine/drawings.js
+++ b/apps/steel-bridge/engine/drawings.js
@@ -157,17 +157,23 @@
   const brgType = (G, k) => { const B = ((G.stf || {}).bearing || {}).types || {}; return (k === 0 || k === G.sup.length - 1 ? B.A : B.B) || { np: 1, bt: 7, tp: 0.75, sp: 0 }; };
   const tsType = (G, r) => (((G.stf || {}).transverse || {}).types || {})[r] || { bt: 6, tp: 0.5 };
 
-  /* ---------- 1: framing plan (GirderDetail dxfPlan) ---------- */
+  /* ---------- 1: framing plan (GirderDetail dxfPlan) ----------
+     SBFLIP (2026-11-10, engineer): G1 at the top, G_nb at the bottom, stations increasing to the right, as the screen plan, the 3D view and
+     the cross-section: the plan is mirrored about the bridge axis, Y(y) = (y_nb − y)·12 (G1 at y = y_nb·12, G_nb at 0). The x of every point
+     is unchanged, so a + skew still puts the G_nb (lower) end of a support line ahead-station. Text is placed, never mirrored; the
+     annotations along G1 (its cross-frame chain, the spans, the support labels) are above the plan, those along G_nb (its chain, the
+     field splices, the skew labels) below it, and the connection plates, stiffeners, top-flange labels and tags stay on the same side of
+     each girder as before (toward the next girder). */
   function plan(G, D, opt) {
     opt = opt || {};
     const FR = G.FR, nb = G.nb, wid = G.ys[nb - 1], Lx = Math.max(...G.girders.map(g => g.x0 + g.bear[g.bear.length - 1])) - Math.min(...G.girders.map(g => g.x0));
     D.k = opt.k || scaleFor(Lx * 12 * 1.15, 30); D.h = TXT * D.k; const h = D.h, i0 = D.mark();
     const ly = { g: D.layer('GRDR', 5), b: D.layer('BRNG-CNTR', 8), x: D.layer('XFRM', 3), xe: D.layer('XFRM-END', 6), s: D.layer('SPLC', 1), d: D.layer('DIMS', 7), t: D.layer('ANNO-TEXT', 7), tb: D.layer('TABL', 7) };
-    const cl = D.ltype('CENTER'), X = x => x * 12, Y = y => y * 12, sup = G.sup, BW = bwName(G);
-    sup.forEach((xs, k) => { const ax = X(FR.xb(k, 0)), ay = Y(G.ys[0]), bx = X(FR.xb(k, nb - 1)), by = Y(wid), L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L, ex = 3 * h;
+    const cl = D.ltype('CENTER'), X = x => x * 12, Y = y => (wid - y) * 12, yT = Y(G.ys[0]), yB = Y(wid), sup = G.sup, BW = bwName(G);   // SBFLIP: yT = G1 (top), yB = G_nb (bottom)
+    sup.forEach((xs, k) => { const ax = X(FR.xb(k, 0)), ay = yT, bx = X(FR.xb(k, nb - 1)), by = yB, L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L, ex = 3 * h;
       D.line(ly.b, ax - ux * ex, ay - uy * ex, bx + ux * ex, by + uy * ex, cl);
-      D.line(ly.b, bx + ux * ex, by + uy * ex, bx + ux * ex, Y(wid) + 10 * h, cl); D.text(ly.t, bx + ux * ex, Y(wid) + 10.6 * h, h, k === 0 ? 'CL BRG. ABUT. 1' : k === sup.length - 1 ? 'CL BRG. ABUT. 2' : `CL PIER ${k}`, 1);
-      D.text(ly.t, ax - ux * ex * 1.6, ay - uy * ex * 1.6 - 1.2 * h, h * 0.8, `SKEW ${f2(G.skews[k])}%%d`, 1); });
+      D.line(ly.b, ax - ux * ex, ay - uy * ex, ax - ux * ex, yT + 10 * h, cl); D.text(ly.t, ax - ux * ex, yT + 10.6 * h, h, k === 0 ? 'CL BRG. ABUT. 1' : k === sup.length - 1 ? 'CL BRG. ABUT. 2' : `CL PIER ${k}`, 1);
+      D.text(ly.t, bx + ux * ex * 1.6, by + uy * ex * 1.6 - 1.2 * h, h * 0.8, `SKEW ${f2(G.skews[k])}%%d`, 1); });
     FR.frames.forEach(f => D.line(f.type === 'sup' ? ly.xe : ly.x, X(f.xa), Y(G.ys[f.bay]), X(f.xc), Y(G.ys[f.bay + 1])));
     // RIDOT stepped (GirderDetail 2026-10-19): CL roadway, W.P.s, the intermediate lines parallel to CL of bearings, spacing along CL roadway
     if (FR.orient && FR.orient.some(o => o.stp)) { const yc = Y(FR.yc), lxl = D.layer('XFRM-LINE', 3);
@@ -176,35 +182,35 @@
       FR.orient.forEach(o => { if (!o.stp) return; const k = o.k, Lc = o.stp.Lc, at = (t, i) => { const f = t / Lc; return (1 - f) * FR.xb(k, i) + f * FR.xb(k + 1, i); };
         o.stp.ln.forEach(t => D.line(lxl, X(at(t, 0)), Y(G.ys[0]), X(at(t, nb - 1)), Y(G.ys[nb - 1]), cl));
         D.chainH(ly.d, [sup[k], ...o.stp.ln.map(t => sup[k] + t), sup[k + 1]].map(X), yc + 2 * h, yc); });
-      D.text(ly.t, Math.min(...sup.map((_, k) => Math.min(X(FR.xb(k, 0)), X(FR.xb(k, nb - 1))))), Y(wid) + 16 * h, h * 0.75, `INTERMEDIATE ${BW} LINES PARALLEL TO CL OF BEARINGS (TYP.), ONE NORMAL TO THE GIRDERS IN EACH BAY. SPACING MEASURED ALONG CL ROADWAY. W.P. = CL ROADWAY ON CL BEARING.`); }
+      D.text(ly.t, Math.min(...sup.map((_, k) => Math.min(X(FR.xb(k, 0)), X(FR.xb(k, nb - 1))))), yT + 16 * h, h * 0.75, `INTERMEDIATE ${BW} LINES PARALLEL TO CL OF BEARINGS (TYP.), ONE NORMAL TO THE GIRDERS IN EACH BAY. SPACING MEASURED ALONG CL ROADWAY. W.P. = CL ROADWAY ON CL BEARING.`); }
     const lf = D.layer('GRDR-FLNG', 5), lst = D.layer('GRDR-STIF', 30), lbr = D.layer('BRNG', 8), gcl = D.layer('GRDR-CNTR', 8), cp = tsType(G, 'B'), ts = tsType(G, 'A');
     G.girders.forEach((g, i) => { const gy = Y(g.y), S = g.segs;
       S.forEach((s, k) => { const x0 = X(g.x0 + s.s0), x1 = X(g.x0 + s.s1), hb = s.topB / 2; D.line(lf, x0, gy - hb, x1, gy - hb); D.line(lf, x0, gy + hb, x1, gy + hb);
         const bj = k ? Math.max(hb, S[k - 1].topB / 2) : hb; D.line(lf, x0, gy - bj, x0, gy + bj); if (k === S.length - 1) D.line(lf, x1, gy - hb, x1, gy + hb); });
-      g.cps.forEach(q => { const x = X(g.x0 + q.s); D.rect(lst, x - cp.tp / 2, gy, x + cp.tp / 2, gy + q.side * (cp.bt + 0.3)); });
+      g.cps.forEach(q => { const x = X(g.x0 + q.s); D.rect(lst, x - cp.tp / 2, gy, x + cp.tp / 2, gy - q.side * (cp.bt + 0.3)); });   // SBFLIP: G(i+1) is below
       g.bear.forEach((b, k) => { const bs = brgType(G, k), xc = X(g.x0 + b), sp = +bs.sp || 0, np = Math.max(1, Math.round(+bs.np || 1)), grp = (np - 1) * sp;
         for (let q = 0; q < np; q++) { const x = xc - grp / 2 + q * sp; [-1, 1].forEach(sg => D.rect(lst, x - bs.tp / 2, gy, x + bs.tp / 2, gy + sg * (bs.bt + 0.3))); }
         D.rect(lbr, xc - 0.6 * h, gy - 0.6 * h, xc + 0.6 * h, gy + 0.6 * h); });
-      const sg = i === 0 ? 1 : -1; g.stiff.forEach(s => D.rect(lst, X(g.x0 + s) - ts.tp / 2, gy, X(g.x0 + s) + ts.tp / 2, gy + sg * (ts.bt + 0.3)));
+      const sg = i === 0 ? -1 : 1; g.stiff.forEach(s => D.rect(lst, X(g.x0 + s) - ts.tp / 2, gy, X(g.x0 + s) + ts.tp / 2, gy + sg * (ts.bt + 0.3)));
       D.line(gcl, X(g.x0), gy, X(g.x0 + g.bear[g.bear.length - 1]), gy, cl); D.text(ly.t, X(g.x0 + g.bear[g.bear.length - 1]) + 2 * h, gy - h / 2, h, g.label);
       g.spl.forEach(s => D.line(ly.s, X(g.x0 + s), gy - h * 0.8, X(g.x0 + s), gy + h * 0.8));
       g.spl.forEach((s, k) => { const R = splR(opt.RS, g, k); if (R) D.rect(D.layer('SPLC-PLAT', 1), X(g.x0 + s) - R.fl.top.Lpl / 2, gy - R.fl.top.bo / 2, X(g.x0 + s) + R.fl.top.Lpl / 2, gy + R.fl.top.bo / 2); }); });
     // dimensions: girder spacing, cross-frames along G1 and Gn, splices along Gn, spans along G1
     const xMin = Math.min(...sup.map((_, k) => Math.min(X(FR.xb(k, 0)), X(FR.xb(k, nb - 1))))), g0 = G.girders[0], gN = G.girders[nb - 1];
-    D.chainV(ly.d, G.ys.map(Y), xMin - 4 * h, X(g0.x0) - h); D.dimV(ly.d, Y(0), Y(wid), xMin - 8 * h, null, '<> CL-CL EXT. GIRDERS');
-    D.chainH(ly.d, [...g0.bear.map(b => X(g0.x0 + b)), ...g0.cps.filter(q => q.side > 0).map(q => X(g0.x0 + q.s))], Y(0) - 3 * h, Y(0));
-    D.chainH(ly.d, [...gN.bear.map(b => X(gN.x0 + b)), ...gN.cps.filter(q => q.side < 0).map(q => X(gN.x0 + q.s))], Y(wid) + 3 * h, Y(wid));
-    if (gN.spl.length) { D.chainH(ly.d, [X(gN.x0 + gN.bear[0]), ...gN.spl.map(s => X(gN.x0 + s)), X(gN.x0 + gN.bear[gN.bear.length - 1])], Y(wid) + 6 * h, Y(wid));
-      gN.spl.forEach((s, k) => D.text(ly.t, X(gN.x0 + s), Y(wid) + 8.4 * h, h * 0.8, `FS${k + 1}`, 1)); }
-    G.spans.forEach((_, k) => D.dimH(ly.d, X(g0.x0 + g0.bear[k]), X(g0.x0 + g0.bear[k + 1]), Y(0) - 6 * h, Y(0), `SPAN ${k + 1} = <> (G1)`));
+    D.chainV(ly.d, G.ys.map(Y), xMin - 4 * h, X(g0.x0) - h); D.dimV(ly.d, yB, yT, xMin - 8 * h, null, '<> CL-CL EXT. GIRDERS');
+    D.chainH(ly.d, [...g0.bear.map(b => X(g0.x0 + b)), ...g0.cps.filter(q => q.side > 0).map(q => X(g0.x0 + q.s))], yT + 3 * h, yT);
+    D.chainH(ly.d, [...gN.bear.map(b => X(gN.x0 + b)), ...gN.cps.filter(q => q.side < 0).map(q => X(gN.x0 + q.s))], yB - 3 * h, yB);
+    if (gN.spl.length) { D.chainH(ly.d, [X(gN.x0 + gN.bear[0]), ...gN.spl.map(s => X(gN.x0 + s)), X(gN.x0 + gN.bear[gN.bear.length - 1])], yB - 6 * h, yB);
+      gN.spl.forEach((s, k) => D.text(ly.t, X(gN.x0 + s), yB - 9.2 * h, h * 0.8, `FS${k + 1}`, 1)); }
+    G.spans.forEach((_, k) => D.dimH(ly.d, X(g0.x0 + g0.bear[k]), X(g0.x0 + g0.bear[k + 1]), yT + 6 * h, yT, `SPAN ${k + 1} = <> (G1)`));
     { const f = FR.frames.find(q => q.type !== 'sup' && q.bay === 0), fe = FR.frames.find(q => q.type === 'sup' && q.bay === 0);
-      if (f) tag(D, ly.t, X((f.xa + f.xc) / 2), Y((G.ys[0] + G.ys[1]) / 2), 'X', `INTERMEDIATE ${BW}`);
-      if (fe) tag(D, ly.t, X((fe.xa + fe.xc) / 2), Y((G.ys[0] + G.ys[1]) / 2), 'E', `END ${BW}`, -1, 1); }
-    D.text(ly.t, xMin, Y(wid) + 14 * h, h * 1.6, 'FRAMING PLAN');
-    D.text(ly.t, xMin, Y(wid) + 12.4 * h, h * 0.75, `TOP FLANGES, CONNECTION PLATES, BEARING STIFFENERS AND INTERMEDIATE STIFFENERS SHOWN TO SCALE. SQUARE = BEARING. SCALE ${SCALE_NAME[D.k]} WHEN PLOTTED.`);
-    g0.segs.forEach(s => D.text(ly.t, X(g0.x0 + (s.s0 + s.s1) / 2), Y(g0.y) + s.topB / 2 + 0.8 * h, h * 0.7, `TOP FL. ${frac(s.topB)} x ${frac(s.topT)}`, 1));
+      if (f) tag(D, ly.t, X((f.xa + f.xc) / 2), Y((G.ys[0] + G.ys[1]) / 2), 'X', `INTERMEDIATE ${BW}`, 1, -1);
+      if (fe) tag(D, ly.t, X((fe.xa + fe.xc) / 2), Y((G.ys[0] + G.ys[1]) / 2), 'E', `END ${BW}`, -1, -1); }
+    D.text(ly.t, xMin, yT + 14 * h, h * 1.6, 'FRAMING PLAN');
+    D.text(ly.t, xMin, yT + 12.4 * h, h * 0.75, `TOP FLANGES, CONNECTION PLATES, BEARING STIFFENERS AND INTERMEDIATE STIFFENERS SHOWN TO SCALE. SQUARE = BEARING. SCALE ${SCALE_NAME[D.k]} WHEN PLOTTED.`);
+    g0.segs.forEach(s => D.text(ly.t, X(g0.x0 + (s.s0 + s.s1) / 2), Y(g0.y) - s.topB / 2 - 1.5 * h, h * 0.7, `TOP FL. ${frac(s.topB)} x ${frac(s.topT)}`, 1));
     // framing data tables
-    const y = Y(0) - 10 * h, rows = G.girders.map(g => [g.label, ...G.spans.map((_, k) => dFI(X(g.bear[k + 1] - g.bear[k]))), dFI(X(g.bear[g.bear.length - 1] - g.bear[0])), ...g.spl.map(s => dFI(X(s - g.bear[0]))), String(g.cps.length)]);
+    const y = yB - 11 * h, rows = G.girders.map(g => [g.label, ...G.spans.map((_, k) => dFI(X(g.bear[k + 1] - g.bear[k]))), dFI(X(g.bear[g.bear.length - 1] - g.bear[0])), ...g.spl.map(s => dFI(X(s - g.bear[0]))), String(g.cps.length)]);
     const t1 = table(D, ly.tb, xMin, y, ['GIRDER', ...G.spans.map((_, k) => `SPAN ${k + 1}`), 'TOTAL', ...G.splices.map((_, k) => `FS${k + 1} FROM BRG.`), BW === 'DIAPHRAGM' ? 'INT. DIAPHRAGMS' : 'INT. X-FRAMES'], rows, 'GIRDER LENGTHS ALONG GIRDER CL (CL BRG. TO CL BRG.) AND FIELD SPLICE LOCATIONS');
     table(D, ly.tb, xMin, t1.y - h, ['GIRDER', `INTERMEDIATE ${BW} LOCATIONS FROM CL BRG. ABUT. 1, ALONG GIRDER`], G.girders.flatMap(g => { const L = g.cps.map(q => dFI(X(q.s - g.bear[0]))), out = []; for (let i = 0; i < Math.max(1, L.length); i += 12) out.push([i ? '' : g.label, L.slice(i, i + 12).join(', ')]); return out; }), `${BW} LOCATIONS`);
     return { id: 'plan', title: 'Framing plan', i0, i1: D.mark(), k: D.k, h: D.h };
diff --git a/apps/steel-bridge/engine/sheets.js b/apps/steel-bridge/engine/sheets.js
index 10a32fd..16f867d 100644
--- a/apps/steel-bridge/engine/sheets.js
+++ b/apps/steel-bridge/engine/sheets.js
@@ -164,19 +164,22 @@
 
   /* ---------- erection diagram, shipping pieces, girder layout (dxfErect) ---------- */
   const wtAt = (S, a, b) => S.reduce((v, s) => v + Math.max(0, Math.min(b, s.s1) - Math.max(a, s.s0)) * 12 * (s.topB * s.topT + s.botB * s.botT + s.D * s.tw), 0) * GAM / 1000;
+  /* SBFLIP (2026-11-10, engineer): drawn as the framing plan (DW.plan), G1 at the top, G_nb at the bottom, stations to the right:
+     Y(y) = (y_nb − y)·12; the support lines run past G1 and G_nb by 2h, the FS marks below G_nb, the title above G1, the tables below */
   function erect(D, C) {
-    const G = C.G, FR = G.FR, h = D.h, ly = { g: D.layer('GRDR-CNTR', 8), b: D.layer('BRNG-CNTR', 8), s: D.layer('SPLC', 1), t: D.layer('ANNO-TEXT', 7), tb: D.layer('TABL', 7) }, cl = D.ltype('CENTER'), X = x => x * 12, Y = y => y * 12, nb = G.nb, T = DW().table;
-    G.sup.forEach((_, k) => D.line(ly.b, X(FR.xb(k, 0)), Y(G.ys[0]) - 2 * h, X(FR.xb(k, nb - 1)), Y(G.ys[nb - 1]) + 2 * h, cl));
+    const G = C.G, FR = G.FR, h = D.h, ly = { g: D.layer('GRDR-CNTR', 8), b: D.layer('BRNG-CNTR', 8), s: D.layer('SPLC', 1), t: D.layer('ANNO-TEXT', 7), tb: D.layer('TABL', 7) }, cl = D.ltype('CENTER'), X = x => x * 12, nb = G.nb, Y = y => (G.ys[nb - 1] - y) * 12, T = DW().table;
+    G.sup.forEach((_, k) => { const ax = X(FR.xb(k, 0)), ay = Y(G.ys[0]), bx = X(FR.xb(k, nb - 1)), by = Y(G.ys[nb - 1]), L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L, ex = 2 * h;   // SBFLIP: run on past G1 and G_nb along the line (true skew)
+      D.line(ly.b, ax - ux * ex, ay - uy * ex, bx + ux * ex, by + uy * ex, cl); });
     const allow = +(window.SBDAnalysis ? window.SBDAnalysis.settings(C.P).steelAllowPct : 0) || 0, Lc = n => String.fromCharCode(65 + n), pcs = [];
     G.girders.forEach((g, i) => { const S = g.segs, beg = S[0].s0, end = S[S.length - 1].s1, cuts = [beg, ...g.spl, end];
       D.line(ly.g, X(g.x0 + beg), Y(g.y), X(g.x0 + end), Y(g.y));
       for (let q = 0; q < cuts.length - 1; q++) { const mk = `${g.label}-${Lc(q)}`, w = wtAt(S, cuts[q], cuts[q + 1]); pcs.push([mk, g.label, dFI(X(cuts[q] - beg)), dFI(X(cuts[q + 1] - beg)), dFI(X(cuts[q + 1] - cuts[q])), f2(w), f2(w * (1 + allow / 100))]);
         D.text(ly.t, X(g.x0 + (cuts[q] + cuts[q + 1]) / 2), Y(g.y) + 0.5 * h, h * 0.9, mk, 1); }
-      g.spl.forEach((s, k) => { D.line(ly.s, X(g.x0 + s), Y(g.y) - h, X(g.x0 + s), Y(g.y) + h); if (i === nb - 1) D.text(ly.t, X(g.x0 + s), Y(g.y) + 2 * h, h * 0.9, `FS${k + 1}`, 1); }); });
+      g.spl.forEach((s, k) => { D.line(ly.s, X(g.x0 + s), Y(g.y) - h, X(g.x0 + s), Y(g.y) + h); if (i === nb - 1) D.text(ly.t, X(g.x0 + s), Y(g.y) - 2.9 * h, h * 0.9, `FS${k + 1}`, 1); }); });
     const xr = Math.min(...G.sup.map((_, k) => Math.min(X(FR.xb(k, 0)), X(FR.xb(k, nb - 1))))), BW = DW().bwName(G);
-    D.text(ly.t, xr, Y(G.ys[nb - 1]) + 7 * h, 1.6 * h, 'ERECTION DIAGRAM');
-    D.text(ly.t, xr, Y(G.ys[nb - 1]) + 5.3 * h, 0.8 * h, `PIECE MARKS SHOWN. SUGGESTED SEQUENCE: SET THE PIECES OF ADJACENT GIRDERS IN PAIRS, INSTALL ${BW}S BETWEEN THEM, AND COMPLETE FIELD SPLICES BEFORE RELEASING THE CRANE; ERECTION PLAN BY THE CONTRACTOR.`);
-    const y = Y(0) - 6 * h, heavy = Math.max(...pcs.map(p => +p[5]));
+    D.text(ly.t, xr, Y(G.ys[0]) + 7 * h, 1.6 * h, 'ERECTION DIAGRAM');
+    D.text(ly.t, xr, Y(G.ys[0]) + 5.3 * h, 0.8 * h, `PIECE MARKS SHOWN. SUGGESTED SEQUENCE: SET THE PIECES OF ADJACENT GIRDERS IN PAIRS, INSTALL ${BW}S BETWEEN THEM, AND COMPLETE FIELD SPLICES BEFORE RELEASING THE CRANE; ERECTION PLAN BY THE CONTRACTOR.`);
+    const y = Y(G.ys[nb - 1]) - 6 * h, heavy = Math.max(...pcs.map(p => +p[5]));
     const T1 = T(D, ly.tb, xr, y, ['MARK', 'GIRDER', 'FROM', 'TO', 'LENGTH', 'PLATES (KIP)', `WITH ${f0(allow)}% DETAIL ALLOWANCE (KIP)`], pcs.map(p => +p[5] === heavy ? [...p.slice(0, 6), p[6] + ' (HEAVIEST)'] : p), 'SHIPPING PIECES (STATIONS FROM GIRDER END; STEEL AT 490 PCF; ALLOWANCE OF THE ANALYSIS TAB)');
     const tot = G.girders.map(g => [g.label, f2(pcs.filter(p => p[1] === g.label).reduce((a, p) => a + +p[5], 0))]);
     const T2 = T(D, ly.tb, xr + T1.w + 8 * h, y, ['GIRDER', 'PLATE WEIGHT (KIP)'], [...tot, ['TOTAL', f2(tot.reduce((a, r) => a + +r[1], 0))]], 'STEEL BY GIRDER');
```
- **Governing provision:** none (drawing presentation; no AASHTO value involved).
- **Check case (built-in project, 5 girders at 9.5 ft, plot scale 1" = 20', h = 24 in):**
  - 0° skew: girder centerlines G1…G5 at y = 0, 114, 228, 342, 456 in → 456, 342, 228, 114, 0 in. Abut. 1 support line (0, −72)–(0, 528) → (0, 528)–(0, −72). Tag G1 at (4368, −12) → (4368, 444); G5 at (4368, 444) → (4368, −12).
  - 30° skew: G1 to G5 = 4 × 9.5 = 38 ft = 456 in; x of the Abut. 1 line at G1 = (0 − 19) tan 30° × 12 = −131.64 in, at G5 = +131.64 in (Δx = 456 tan 30° = 263.27 in). Before: line (−167.64, −62.35)–(167.64, 518.35), G1 end at the bottom. After: (−167.64, 518.35)–(167.64, −62.35), G1 end at the top, G5 end at the bottom and 263.27 in ahead; angle from the normal to the girders atan(263.27 / 456) = 30.00°, + with the lower (G5) end ahead, as the screen plan.
- **How verified:** new test in `tests/engine/dxf-sheets.test.mjs` (SBFLIP: the plan and erection sheets of 10 projects, skews 0, ±30, 45, mixed 10/−20/30/0 and the dxf-sheets projects: G1's centerline above G_nb's with the bay spacings, girder tags in order, support labels above G1 and skew labels below G_nb, every text unrotated, each of 80 support lines at its entered skew with the sign, hand-check values; it fails on origin/main). `tests/engine/drawings.test.mjs`: the plan coordinates checked at (y_nb − y)·12. `tests/baselines/dxf-sheets.json`: only the `|plan` and `|erect` entries re-recorded (`RECORD_DXF=plan,erect`; a full re-record differs from origin/main in those 20 entries only; every plot scale unchanged). check-syntax; engine drawings, sheets, dxf-sheets (the section overlap test: 0 overlaps), dxf-detc, framing-plan; smoke steel-bridge-drawings, steel-bridge-dxf-unchanged (every tab-graphic DXF byte-identical to origin/main). Text/line crossings on the plan sheet (tests/engine/overlap.mjs, built-in with 2 splices): 0°: 18 line-through-text and 1 text-over-text after vs 28 and 1 on origin/main; 30°: 19 and 1 vs 21 and 1 (all present before the change: dimension ends at the skew labels, cross-frames through the tags and top-flange labels); erection sheet 0 and 0.
- **Saved data (§5):** none.
- **Open items:** the plan sheet's existing crossings above (skew labels on the chain-dimension ends, cross-frame lines through the tags and top-flange labels) are unchanged in kind; not fixed here.
- **Other copies:** none (GirderDetail `dxfPlan` in `Steel Bridge Design.html` is the old tool and is not changed).
