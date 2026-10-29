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
