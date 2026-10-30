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
