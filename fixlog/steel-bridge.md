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
