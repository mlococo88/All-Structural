# Steel Bridge Design: old app vs new app (comparison, 2026-10-31)

- **Old app:** `Steel Bridge Design.html`. Three apps in one file: GirderDetail (the modules), Preliminary sizing (PlateLine, `pl-src`) and ST-Girder (`st-src`). It is still the engineer's working tool.
- **New app:** `apps/steel-bridge/` (engine/, ui/, report/), with `shared/*.js`.
- **Basis:** origin/main at `cb8ae2a` (#508). The sources are `fixlog/steel-bridge.md`, `fixlog/Steel Bridge Design.md`, `docs/REBUILD_PLAN.md`, AUDIT.md, PENDING.md, ENGINEER_CHECKS.md, `tests/engine/*`, and the notes on branch `claude/sbd-s2-notes`. I also grepped both codebases and ran one targeted Node check (item C-1).
- **Scope:** analysis only. No app code, formula, test or saved data changed in this PR.
- **Code references:** AASHTO LRFD 10th Ed. (2024) articles unless stated; MBE = AASHTO MBE 3rd Ed. Articles are cited, not quoted.
- **Legend:**
  - **Better:** the app that does it better (*old*, *new*, *equal*, or *?* where the engineer decides).
  - **Action:** *port* (to the new app), *fix-old*, *fix-new*, *keep*, or *ENG* (the engineer's decision, CLAUDE.md §9).
  - Rows marked **[CALC]** are differences in computed values.

---

## (a) One-page summary

**Where the two apps stand.** The new app has every girder check of the old app except the 6.10.2 proportion limits and the minimum deck reinforcement (GS1 to GS4, see C-2). On the 100 hand-off payloads and the 20 recorded projects it matches GirderDetail exactly or to round-off. The differences that remain are documented and each has a known cause. The largest are:

| Difference | Size | More correct |
|---|---|---|
| Deck-pour boundary double count in the old app (SB2-A1) | M_DCc up to 1.04 % near piers, ratio ≤ 0.004 | New |
| Cross-frame weight in DC1 | M_DC1 0.76 % | New: it weighs the members actually checked |
| Dead-load shears (SB2-A3) | V_DC 0.72 % | New: exact station shear, not element shear |
| Steel weight (SB2-A2) | Steel part 0.08 %, DC1 ≤ 0.018 % | New: 490/144, not 3.4 |
| DL deflection | ≤ 0.26 % | New |
| LL deflection (SB2-A8) | ≤ 0.11 % | Old reads more stations |
| Negative flexure on imported projects | ≤ 0.32 % | Follows the M_DC1 and framing differences above |
| Old first-pour sliver | ≤ 0.023 % of max M_DCc | New (fixed in #503) |

The LLDF, c_rw, pier skew rule, |θ|, 6.10.1.6 amplification and pedestrian-load items were aligned in **both** apps (#470–#472, #478, #480, #485/#487, #496). No difference remains there.

**Where the new app is ahead:**
- **One model and one engine per check.** The tabs, report, drawings and Auto design all run the same functions.
- **Show the work (§6).** Every value has KaTeX worked steps, grouped by topic, with in-app links and "see §" links in the report.
- **Accuracy.** Per-girder plate girders and b_eff; real support reactions for bearing stiffeners; brace points and f_ℓ consistent on every path; rating over the whole girder.
- **Drawings and libraries.** Drawings-style graphics on every tab; a light dependency set (no React, Babel, Plotly, MathJax or Pyodide).
- **Tests.** Node tests with parity against the old code.

**Where the old app is still ahead:**
- **Cross-tool hand-offs.** The new app has none.
- **Saved-project library and undo.**
- **External-demand files.** The old app reads MIDAS/MCT, PS-Girder and SteelBeam envelopes, including a self-weight-excluded flag. The new app reads only `stgirder-external-demands`.
- **Helpers not yet ported:**
  - the GS1–GS4 proportion and minimum-reinforcement checks on the design tabs;
  - Preliminary sizing's framing checks X1–X4;
  - cross-frame and stiffener-plate auto-design;
  - flange-stress plots;
  - jacking and seismic reaction columns;
  - paper-space DXF layouts;
  - the per-module user manuals.
- **Proven in use.** The old app is used on real projects.
- **One file.** It is a single file the engineer can copy alone; the new app needs its folder.
- **Deck slab and overhang design** were dropped from the new app on purpose (REBUILD_PLAN §8).

**Bugs found or confirmed.** **Auto design runs its shear, transverse-stiffener and bearing-stiffener checks with no live load.**
- **Code:** `engine/autodesign.js` `payloadOf` writes no `V_LLpos`/`V_LLneg` (or `V_PL*`) to its stations.
- **Node check, built-in project G1:**
  - largest V_u 172.96 kip in Auto design vs 395.97 kip on the Shear tab's analysis path;
  - V_LL+IM 0 vs 129.16 kip;
  - governing shear ratio 0.27 vs 0.44;
  - bearing R_LL+IM 0 at every support vs 107.8 / 215.3 / 215.3 / 107.8 kip.
- **Also:** Auto design takes f_ℓ = 0 during deck placement on skewed bridges (`flC: 0`) and ignores an entered Flexure f_ℓ.
- **Consequence:** Auto design is not yet fit to approve a design.

**Switch-over blockers** (detail in §c):
1. the Auto design live-load and f_ℓ bugs;
2. GS1–GS4 missing from the design checks;
3. cross-tool hand-offs (lldf pull, superReactions, projectMeta, girderDemands);
4. external-demand imports (MIDAS/MCT and the self-weight flag);
5. a final full comparison on the recorded projects, done through the import path;
6. the engineer's decisions listed in §(b) and §(c).

---

## (b) Differences, by area

### 1. Calculations and code provisions

| # | Area | Old behaviour | New behaviour | Better | Why / evidence | Action |
|---|---|---|---|---|---|---|
| C-1 | **[CALC] Auto design: shear demands** | Suggest / Full design (PL) and Optimize (ST) check shear with LL+IM | `payloadOf` (engine/autodesign.js:163) builds stations with M_LL and V_FAT but **no V_LL** and no V_PL. `SBDShearUI.build({pl})` reads `V_LLpos`/`V_LLneg` as 0. So the shear checks (GS11, GS16, GS18), the transverse stiffeners (the panel V_u) and the bearing stiffeners (R_LL = 0) run without LL+IM | **old** | **Verified now (Node, built-in project G1):** V_u,max 172.96 vs 395.97 kip; V_LL 0 vs 129.16 kip; shear ratio 0.271 vs 0.437; bearing R_LL 0 vs 107.8/215.3/215.3/107.8 kip. The governing TS/BS ratios were equal (0.667 / 0.692) only because geometric items govern them on this project. 3.4.1, 6.10.9, 6.10.11.2 | **fix-new, blocker.** Build the payload from `ui/shear.js fromAnalysis` (it has V_LL, V_PL and the reactions), or add the V fields. Add a test that the Auto design and Shear tab ratios agree |
| C-2 | **[CALC] 6.10.2 proportions, 6.10.1.7 minimum deck reinforcement (GS1–GS4)** | GirderDetail Girder section has GS1 web proportions, GS2 flange proportions, GS3 I_yc/I_yt, GS4 minimum negative-flexure deck rebar, and GS22 (owner: App. A6 not used) | Not ported. engine/flexure.js header: "Not ported … GS1 to GS4". The 6.10.2 limits exist only as Auto design sizing rules (`proportions`). The Analysis tab notes the 1 % rebar need as text only | **old** | grep: no GS1–GS4 in ui/, report/ or flexure. A girder entered by hand is never checked against 6.10.2 | **port, blocker** (calculation model) |
| C-3 | **[CALC] Deck placement sequence: pour boundaries (SB2-A1)** | `saSeq` loads a node on a pour boundary in both pours (inclusive ends), so about 1 ft of deck is counted twice per boundary | Each pour loaded exactly | **new** | M_DCc up to 1.04 % larger in old near piers (gd_builtin28_MassDOT_G4, x = 250 ft: −2452.4 vs −2426.0 kip-ft); largest GS14/15 ratio change 0.0040 (0.4308 → 0.4268). The engineer chose exact loads for the new app. 6.10.3.4.1 | **keep** new; **ENG**: fix old? (small, conservative) |
| C-4 | **[CALC] First-pour sliver at an abutment** | `saSeq` treats M_DC1(0) = −3e-12 (round-off) as negative, creating a 0–1 ft "pour" placed after the positive pours | Fixed in #503: relative tolerance 1e-6·max\|M_DC1\| | **new** | Effect ≤ 0.023 % of max M_DCc (built-in G1 x = 1 ft: 59.457 → 60.033 kip-ft); GS14/GS15 ratios change ≤ 1.66e-4; the sliver occurs on 45 of 141 girders | **ENG**: one-line fix in old (own PR), or leave until switch-over |
| C-5 | **[CALC] Cross-frame/diaphragm weight in DC1** | DC1 point loads from Preliminary sizing's *suggested* K-frame (e.g. L3x3x3/8; 2.80 kip on G1) | Weighs the cross-frame members actually checked (imported Cross-frames inputs, e.g. X with L5x5x3/8 × 3; 4.73 kip) | **new** (consistent) | M_DC1 0.76 % (−2424.4 vs −2406.1 kip-ft, builtin AASHTO G2); negative flexure GS7/GS9/GS8 then 0.26 % / 0.32 % (import entry, fixlog). 3.5.1 | **ENG**: on import, map PL's suggested frame or keep the module members (now)? |
| C-6 | **[CALC] Steel unit weight (SB2-A2)** | `SA_PLF = 3.4` lb/ft per in² | 490/144 = 3.4028 | **new** | Table 3.5.1-1; girder-steel part +0.0817 %, M_DC1 +0.014 to 0.018 % | **fix-old** optional (ENG); trivial |
| C-7 | **[CALC] Uniform DL and station shears (SB2-A3)** | Loads lumped at 1-ft nodes; the hand-off V is element shear (about 0.5 ft away) | Consistent loads; exact shear at the station (VL/VR) | **new** | M_DC1steel ≤ 0.2 %, other M ≤ 0.012 %, V_DC 0.72 to 0.84 % (wh/2) | keep |
| C-8 | **[CALC] DL deflection / camber** | Virtual work by the nodal rule | Exact | **new** | ≤ 0.26 % (D_DC1steel); ≤ 0.055 % for the others | keep |
| C-9 | **[CALC] LL deflection (SB2-A4, A8)** | LL8: axles that do not add are neglected; read at every second node (~2 ft) | LL8 applied (#483); read at the 1/20 points | **old** (denser stations) | New is ≤ 0.11 % lower; 2.5.2.6.2, 3.6.1.3.2 | port: a denser-station option in shared/moving-load.js (small) |
| C-10 | **[CALC] LLDF** | GirderDetail DF module (now follows lldf.html: DFL1–DFL6) | shared/lldf.js (lldf.html's engine) | **equal** | Parity exact on 33,032 values after DFL5/DFL6; 4.6.2.2.2d/e, lever rule, pier rule (O24), \|θ\| (O23) | keep. Open: SB2-O21 (the LLDF section taken at mid-span vs the station of max +M; same plate on every recorded case); SB2-O25 (lldf.html / Bridge Geometry bridge-wide θ) |
| C-11 | **[CALC] c_rw in R_b and App. A6 (SB2-O6)** | Changed to c_rw√(E/F_yc) (#470) | Same (#471) | **equal** | 6.10.1.10.2, A6.2.2 | none |
| C-12 | **[CALC] 6.10.1.6 amplification, f_bu ≥ F_cr (SB2-R2)** | Fixed (#485) | Fixed (#487) | **equal** | — | none |
| C-13 | **[CALC] Pedestrian load** | 75 psf in LL+IM; m not on the PL part (GD45) | Added in #496, once in every module | **equal** | Negative flexure on xsA within 0.31 % / 0.26 % (was 10.4 %); 3.6.1.6 | none |
| C-14 | **[CALC] Owner η and m (OWN6/7)** | All modules | Flexure and drawings since #496; shear via `factorsOwner` | **equal** (verify on all tabs) | RIDOT m = 1.2 ratios agree in the import test | final comparison should cover every module |
| C-15 | **[CALC] f_ℓ, skewed bridges (SB2-W1)** | Skew estimate in PL / GirderDetail | C6.10.1 skew estimate the default on every path (Flexure, Constructibility, Rating); an entry overrides it | **new** (one answer per girder) | fixlog sb2-paths-consistent; 6.10.1.6, C6.10.1 | keep. **fix-new** (small UI): an explicit f_ℓ = 0 override is impossible today (0 = "none entered") |
| C-16 | **[CALC] Auto design f_ℓ** | n/a | `evaluate` sets the skew f_ℓ for flexure but ignores `P.flexure.fl`. Constructibility uses `flC: 0` (deck placement without f_ℓ on skewed bridges, unconservative) | **—** | engine/autodesign.js:233, :245; the paths PR open item | **fix-new, blocker.** Take f_ℓ and brace points from `SBDFraming.design(P, gi, { fl })` (framing.js:397) |
| C-17 | **[CALC] Brace points (SB2-W2)** | Its own framing | Framing tab stations on every path (constructibility parity: L_b/C_b differed at 246 of 1,200 before) | **new** (one framing) | — | keep. Auto design already passes `Fr.braces` when framing exists; the payload fallback `Lb = frames.Lb \|\| 25` remains |
| C-18 | **[CALC] Bearing-stiffener reactions (SB2-O16)** | Reaction envelope from the analysis | Analysis source: real reactions (R_LL = g_V R_HL93). File source: the sum of the two shear envelopes (upper bound, +18.6 %) | **new** = old on the analysis path; file path conservative | Built-in pier R_u 786.3 → 716.2 kip; 6.10.11.2 | keep; the file path stays interim |
| C-19 | **[CALC] Transverse-stiffener panels, uniform spacing (SB2-O15)** | Rows use d_o = (d_o/D)·D | The panels of the actual layout (≤ d_o) | **new** (the as-built layout) | The engineer accepted it 2026-10-29; V_n never lower; I_t1 can be larger. 6.10.9.3, 6.10.11.1 | keep |
| C-20 | **[CALC] Studs b_eff (SB2-F1)** | One bridge-wide b_eff (the girder with the largest fatigue shear) | Each girder's own b_eff (default) | **new** | Interior b_eff 96 → 114 in; SC1 0.8746 → 0.8915; no pass/fail change; 6.10.10.1.2, 4.6.2.6 | keep |
| C-21 | **[CALC] Rating (LRFR design load)** | ST-Girder: the selected span; −M at one station, bottom flange, 6.10.8 only. GirderDetail GS20 (girder section locations) | Every location of the whole girder; both flanges; A6 or 6.10.8 by the method in use; Service II both flanges plus web F_crw; shear by direction | **new** (more complete) | 300 spans: −M RF 1.02 to 1.07 × ST-Girder (unified F_nc with γ_e, D6.6.2); +M, shear and SII ≈ 1.000; no RF crosses 1.0. MBE 6A.4.2, 6A.6 | keep. Both lack legal and permit vehicles (owner rows "pending") |
| C-22 | **[CALC] Splice demands (app path)** | Lumped-load element shear | Consistent loads | **new** | Moments within 0.1 %, shears within 1.3 % at the splice. 6.13.6.1. Splice formulas: parity 0 differences | keep |
| C-23 | **[CALC] Splices under CTDOT (SB2-SP7, AD8)** | Every CTDOT splice fails DT10 (16 in flanges, 2 in edge) and DT4 with the 1.75 in default end distance | Same; Auto design adds a bolt-fit sizing rule (AD1). DT4 still blocks: the end distances are not set to the owner's 2 in | **new** (partly) | Decision SB2-AD8 (lead, 2026-10-30): splice auto-design uses the owner's edge distance | **fix-new** (implement AD8) |
| C-24 | **[CALC] Cross-frame bolts, CTDOT (CF11)** | Warning (CTDOT 4 bolts, PENDING #6) | Check; the built-in connection has 2 bolts per member end, so it blocks every CTDOT Auto design candidate | **?** | Decision: Auto design treats CF11 as a sizing rule | **fix-new** (implement as decided) |
| C-25 | **[CALC] Auto design vs Suggest / Optimize** | PL Full design (`suggestFull`, 11–45 min/project); ST Optimize sweeps t_fb | Two-stage screen plus full check on every module; owner plate rules; BS6 and bolt fit as sizing rules (AD9, AD1) | **new** (once C-1 and C-16 are fixed) | 6 of 21 projects compared: no legacy design passes the new full check (BS6, GS7 at piers, FA1). builtin_AASHTO legacy 0.03 % lighter but fails BS6. **Note:** the passing new designs were judged without LL shear (C-1) | re-run the parity after the C-1 fix; the 15 pending projects; Rating and Welds in the full check |
| C-26 | **[CALC] Noncomposite girders (SB2-O7, O10, O13)** | Composite only in Girder section | 6.10.8 + App. A6 noncomposite paths; constructibility shown as information | **new** | O13 (LTB of both flanges in reverse curvature) open | ENG on O10/O13 when needed |
| C-27 | **[CALC] Deck rebar layers (SB2-O3/O8)** | Detail modules use one layer A_r | Two layers (top/bot) in flexure; own-I term < 0.1 % of I | **new** | — | keep |
| C-28 | **[CALC] Overhang bracket f_ℓ (constructibility OH1–OH5)** | GirderDetail GM.oh module | engine/constructibility.js, "Fill from cross-section" (XS11 / SB2-C2) | **equal** | Parity exact (`GM.oh` in Node). 6.10.3, C6.10.3.4 | none |
| C-29 | **[CALC] Fatigue (6.6.1, MBE 7) and welds** | GM.fa, GM.wt | engine/fatigue.js (FA1–FA7, MBE 7.2.4/7.2.5), engine/welds.js | **equal** | Parity exact on 20 recordings + 304 variations; welds bit-identical (18,600 items) | none |
| C-30 | **[CALC] Distortion-induced fatigue CP2 Δf from the layout (SB2-O18)** | Its own fatigue rows | The rows from the layout had Δf = 0 until the fatigue PR | **?** | Status after #474 not re-verified here | verify in the final comparison |
| C-31 | **Uncoated weathering steel sacrificial thickness (SB2-O18)** | GirderDetail input | The engine supports `env.ws`; no model input | **old** | grep: no "weathering" in model.js / index.html | port (small) |
| C-32 | **Owner sidewalk override for LL deflection (SB2-A9, OWN19)** | Limits-tab yes/no override | The cross-section's sidewalks decide; no override | **old** (flexibility) | — | ENG: needed? |
| C-33 | **Owner defaults on owner change (SB2-O22)** | Untouched inputs move to the owner values automatically (OWN14) | Applied by a button; user values kept | **?** | Import runs PL's `ownMigrate` | ENG: confirm |
| C-34 | **Simple spans** | Supported (GirderDetail `sgBeam(spans, !cont)`, PL "Simple spans") | Supported (shared/moving-load.js `m.simple`) | **equal** | Not a new-only feature, contrary to earlier notes | none |

### 2. Features present in only one app

| # | Feature | Old | New | Better | Evidence | Action |
|---|---|---|---|---|---|---|
| F-1 | Deck slab design (transverse) and deck overhang design | ST-Girder Deck tab ("Deck design (transverse)/(overhang)", Deck −M) | Dropped | old (feature) | REBUILD_PLAN §5/§8 (approved): out of scope | keep dropped |
| F-2 | Flange-stress plots along the girder | ST-Girder "Stresses" tab; DXF plot sheets | Not drawn (stresses at check locations only) | old | SB2-DW8 | port if wanted (medium, new calc display) |
| F-3 | Jacking / seismic columns in the bearing-reaction table | GirderDetail SA "Bearing and connection design forces" | Left out of the sheets (SB2-DW9). The jacking check of end diaphragms exists in crossframes (3.4.3.1, `dia.Rj`) | old | sheets.js header | port (small–medium; §4 callout) |
| F-4 | Preliminary sizing framing checks X1–X4 and owner skew warnings | `framingChecks` | Not ported (SB2-X2); the layout lists unresolved splice conflicts | old | grep `framingChecks`: 5 old / 0 new | port (medium, calc) |
| F-5 | Cross-frame auto-design (Suggest) | Yes | Auto design variable `cf`: the lightest angle of the list passing CF1–CF3, CF5–CF9 (one angle for every member); diaphragms Lock only | new (2026-10-31) | sbd-autodesign-vars | done (diaphragm shapes: open) |
| F-6 | Stiffener-plate auto-design (AD.ts / AD.bstf), per-bay design (tsDesignBay) | Yes | Auto design variables: uniform d_o/D, intermediate stiffener, connection plate, bearing stiffeners (pairs, b_t, t_p, welds) on the TS/CP/BS checks; per-bay spacing Lock only | new (2026-10-31) | sbd-autodesign-vars | done (per-bay design: open) |
| F-7 | TS&L alternatives study | PL "alts" | Auto design ranked list and compare view (any two of the current design and the candidates) | new | autodesign_spec | done |
| F-8 | MIDAS/MCT and other external demand envelopes | ST-Girder accepts `psbeam-`, `stgirder-`, `steelbeam-external-demands`; `selfWeightExcluded` (app adds self-weight) | Accepts `stgirder-external-demands` only; does not read `selfWeightExcluded` | old | grep: no `selfWeightExcluded` in apps/steel-bridge. **Risk:** a MIDAS file without self-weight would under-count DC1. Unverified whether such files reach the new app | **port, blocker** (calc: DC1 completeness) |
| F-9 | Cross-tool hand-offs (HANDOFF.md) | `bridgeSuite.v1.lldf` pull, `superReactions` send (Substructure Loading), `projectMeta`, `girderDemands`, `appPaths`, inbox | None (grep: no `bridgeSuite` in apps/steel-bridge) | old | — | **port, blocker** (same keys, CLAUDE.md §5) |
| F-10 | Saved-project library, undo | `girderdetail_projects_v1`, `plateline_projects_v1`, `stgirder.projects`, `plateline_undo_v1` | One autosaved project (`sbd2.project.current`) + Export/Import JSON; one-step Undo in Auto design only | old | model.js KEYS | port (small–medium; new `sbd2.*` keys) |
| F-11 | Per-module user manual / design basis | Each GirderDetail module has a "User manual (design basis)" report tab | None (the worked steps carry the article references) | old | `MODS[...].rpt` | port as a report appendix (Sonnet, medium) |
| F-12 | Paper-space DXF layouts (one per sheet with a viewport) | Pyodide + ezdxf (unpinned), in the browser | Model space with borders, R12 (shared/dxf.js) | old (format) / new (no 10+ MB download) | SB2-DW6 | needs an R2000+ writer in shared/dxf.js (medium–large); ENG: needed? |
| F-13 | Plotly charts (zoom, hover) | Plotly 2.27 | SVG/DXF graphics in the Drawings style with wheel zoom, pan, pinch | new (consistent, printable) | #498–#502, #507 | keep |
| F-14 | Auto design (New / Refine / Check one change; weight, depth, cost) | Suggest + Optimize (separate engines) | engine/autodesign.js on the same check modules; Lock / Range / Auto for every sizable input incl. the overhang; Rating and Welds in the full check | new | #494, sbd-autodesign-vars | done; 15 parity projects pending |
| F-15 | Several plate girders, a girder line picks its plate girder (SB2-A7) | One layout for every girder | Per plate girder | new | legacy.js mapping ("one layout, as the old app") | keep |
| F-16 | Report: one calculation report of every girder, nav tree, grouped steps, "see §" links | Per-module reports + combined report (#412) | shared/report.js viewer, 13 sections, every girder | new | #488, #490, #505 | keep |
| F-17 | Drawing set with title blocks (every GirderDetail sheet) | dxfSheet/dxfBuild sheet set | Ported (SB2-DW5): cover, erection, elevation + envelope + camber, typical section, splice, diagrams, summary, reactions, fatigue, overhang, bearing stiffeners, CF, TS, SC, standard details, transitions, welds | equal (+ per-girder elevation and camber in new) | sheets.js header; ezdxf opens every file | keep |
| F-18 | 3D view | three r128 | three r128 + diagrams, splice plates, single-girder close-up | new | #491, #492 | keep |
| F-19 | Rating vehicles beyond HL-93 | None (owner pending) | None (owner pending) | equal | — | ENG: future |
| F-20 | Graphics on every output tab | Partial (module drawings) | Every tab (Drawings format) | new | #498–#507 | keep |
| F-21 | Import of old projects | n/a | GirderDetail, Preliminary sizing, ST-Girder, old autosaves (read only); unmapped data kept under `legacy.unmapped` | new | #493, legacy.test.mjs (round trip, nothing dropped) | keep |

### 3. Inputs and workflow

| # | Item | Old | New | Better | Action |
|---|---|---|---|---|---|
| W-1 | Structure | Three apps with their own inputs; data passed by payloads ("Send to ST-Girder", embedded frames); the same quantity can differ between apps (e.g. GD4) | One project model (`sbd2.project` v1): input tabs Project, Spans & framing, Materials & deck, Girders & plates, Cross-section & loads, Stiffeners, Fatigue & studs, Splices; 15 output tabs | new | keep |
| W-2 | Recalculation | On every keystroke (React) | "Results are out of date" banner; Calculate. One analysis cache for every tab (#497) | new (for large projects) | keep |
| W-3 | Validation | Per module | `M.validate`: field errors marked on input tabs (dot), errors block Calculate | new | keep |
| W-4 | Demand source per tab | Each module its own | Example / this project's analysis / hand-off file; default = analysis when ready (#490) | new | Retire the "Example" source at switch-over? (ENG) |
| W-5 | Saved data | Many keys (see F-10); SBD4 project file | `sbd2.*` keys only; versioned schema with `migrate()` (v1 is the first); old keys read only | new (§5-clean) | keep; add a project library under `sbd2.*` |
| W-6 | Per-girder vs bridge-wide | Fatigue, studs b_eff and one plate layout bridge-wide | b_eff and plates per plate girder; fatigue settings bridge-wide | new | keep |
| W-7 | Units | US customary | US customary (shared/units.js) | equal | — |
| W-8 | Copying to the work laptop | One file | The whole repo folder (tools.html) | old | Document at switch-over (REBUILD_PLAN §3) |

### 4. Outputs

| # | Item | Old | New | Better | Action |
|---|---|---|---|---|---|
| O-1 | Worked steps (§6) | Most modules show work; MathJax + KaTeX | Every value through SharedSteps (equation, substitution, result, article), KaTeX; grouped by topic on every tab (#504, #505) | new | keep |
| O-2 | In-app links | Partial | Links from the summary and governing rows to the steps; `data-gotab` cross-tab links; report "see §" | new | Auto design → module step links (PR2) |
| O-3 | Printed report | Per module and combined; header/footer, Page X of Y | One report, every girder, nav tree, print | new (single document); old has per-module manuals | port the manuals (F-11) |
| O-4 | DXF | R12 sheets + Pyodide layouts | R12 sheets with title blocks, every tab graphic exports DXF | new (no Pyodide) except paper space | F-12 |
| O-5 | Phone width | Not designed for it | Works; graphic text 4–8 px at 390 px, so the phone relies on zoom | new | small polish |
| O-6 | Ratio colours | Per module | Graphics amber from 0.90; tables use 0.9 | new | — |

### 5. Non-functional

| # | Item | Old | New | Better |
|---|---|---|---|---|
| N-1 | Size | 3.0 MB HTML (three embedded apps) | ≈ 1.64 MB app JS/HTML + 0.16 MB shared, in 40+ files | new |
| N-2 | Dependencies | React 18.2, ReactDOM, Babel standalone 7.23.5 (JSX transpiled at load), Plotly 2.27, MathJax 3.2.2, KaTeX 0.16.9, three r128, Pyodide 0.26.4 + unpinned ezdxf (on DXF layout export) | KaTeX 0.16.9, three r128 only | **new** (faster load, nothing unpinned) |
| N-3 | Tests | Browser compares (compare.mjs, sbd-verify.mjs; heavy, flock), check-syntax | ~275 Node engine tests with parity against GirderDetail's own code (gd-source.mjs); 6 browser smoke tests. The full suite is slow (~30 min, the parity runs) | new (coverage); speed should improve (tag the slow parity runs) |
| N-4 | Ease of change | 3 MB file; three copies of 6.10 logic | One pure function per check, small files | new |
| N-5 | Maturity | In use on real projects | Not yet used on a project | **old** |

### 6. Known open items and bugs

| # | Side | Item | Severity | Action |
|---|---|---|---|---|
| K-1 | new | C-1 Auto design shear without LL+IM (verified) | High (blocker) | fix-new (calc) |
| K-2 | new | C-16 Auto design f_ℓ = 0 in deck placement, ignores the entered Flexure f_ℓ | High (blocker) | fix-new: `SBDFraming.design` |
| K-3 | new | C-2 GS1–GS4 not checked | High (blocker) | port |
| K-4 | new | AD8 splice end distances = owner edge distance; CF11 as a sizing rule (decided, not built) | Medium | fix-new |
| K-5 | new | Auto design PR2: done (compare view, locks generalised to Lock / Range / Auto, cost editor, Rating and Welds in the full check); still open: the 15 pending parity projects, ST re-run via st-source.mjs | Medium | build (parity) |
| K-6 | new | f_ℓ = 0 override impossible on skewed bridges | Low–medium | UI (small) |
| K-7 | new | Paper-space DXF needs an R2000+ writer (SB2-DW6) | Low | ENG |
| K-8 | new | The analysis cache key leaves out `rating`/`flexure`, so unrelated edits re-run the analysis (safe, slower) | Low | optional |
| K-9 | new | Welds governing row shows FW4/TR2 at 1.000 (minimum size / taper); a strength-only row may read better | Low | ENG (display) |
| K-10 | old | C-4 first-pour sliver | Negligible | ENG: one-line PR or leave |
| K-11 | old | C-3 pour-boundary double count | Small, conservative | ENG |
| K-12 | old | AUDIT A14: splice d_o not validated; a 1-bolt web group gives NaN; a 1-bolt cross-frame gives U = 0; stud 1 in option missing (status not re-checked here) | Medium (input edge cases) | Check the new app handles them; fix-old only if switch-over slips |
| K-13 | old | MathJax `@3` major-only (now 3.2.2 in the tag), ezdxf unpinned | Low | none (retiring) |
| K-14 | both | Legal/permit rating vehicles; refined analysis for CTDOT > 30° skew (warning only) | — | future |

---

## (c) Proposed Phase-4 roadmap (new app)

**Model fit:** Opus for anything that touches a calculation (§4 callouts, parity); Sonnet for presentation, UI and plumbing. Size: S ≈ one short PR, M ≈ one PR with tests, L ≈ several PRs.

### Switch-over blockers (do first, in this order)
1. **Auto design live load and f_ℓ** (Opus, S–M).
   - Build `payloadOf` from `SBDShearUI.fromAnalysis` (V_LL, V_PL, reactions).
   - Take f_ℓ and the brace points from `SBDFraming.design(P, gi, { fl })`, including deck placement.
   - Test: the Auto design ratios equal the tabs' ratios for every module.
   - Re-run the 6 recorded parity rows.
   - §4 callout with the built-in numbers above.
2. **GS1–GS4 (and GS22) on the Flexure tab and in the report** (Opus, M). A port of GirderDetail Girder section, with parity on the 100 payloads.
3. **External demands** (Opus, M).
   - Accept ST-Girder's MIDAS-style files, including `selfWeightExcluded`, and the psbeam/steelbeam schemas if the engineer uses them.
   - Parity against ST-Girder's import on a recorded MIDAS file. A file needs recording first; there is none in tests/projects that I know of.
4. **Cross-tool hand-offs** (Sonnet with an Opus review, M).
   - The `bridgeSuite.v1.lldf` pull, the `superReactions` send, `projectMeta` and `girderDemands`, with the existing keys and schemas (HANDOFF.md, CLAUDE.md §5).
   - One cross-tool PR (the 2026-10-04 exception).
5. **AD8 and CF11 as decided** (Opus, S).
6. **Final full comparison** (Opus, M–L).
   - Import each of the 20 recorded projects, run every module, and compare with GirderDetail's own results.
   - Include shear and stiffeners, fatigue, splices, rating and constructibility, not only flexure.
   - List every difference larger than round-off with its cause.
7. **Engineer's decisions before the redirect.**
   - C-3 and C-4: fix the old app or not.
   - C-5: the cross-frame weight on import.
   - C-32 and C-33: the owner sidewalk override and owner defaults.
   - F-12: paper space.
   - W-4: the Example source.
8. **Switch-over plumbing** (Sonnet, S).
   - `Steel Bridge Design.html` becomes a redirect that keeps reading the old autosaves through "From old app".
   - Update tools.html and the docs.
   - Update the copy-the-folder note.

### After switch-over (priority order)
9. Auto design PR2: compare view, locks, cost editor, the 15 parity projects, Rating and Welds in the full check (Sonnet for the UI, Opus for the parity; M–L).
10. Project library and undo under `sbd2.*` keys (Sonnet, S–M).
11. Stiffener-plate and cross-frame auto-design inside Auto design (F-5, F-6), and the framing checks X1–X4 (F-4) (Opus, M each).
12. Jacking and seismic reaction columns (F-3), and the weathering-steel input (C-31) (Opus, S each, with §4 callouts).
13. LL deflection with denser stations (C-9, shared/moving-load.js option) (Opus, S).
14. Flange-stress plots (F-2) (Sonnet, M; values from the existing flexure rows).
15. Design-basis appendix in the report (F-11) (Sonnet, M).
16. Paper-space DXF (R2000+ writer in shared/dxf.js), only if the engineer needs it (Opus or Sonnet, L).
17. Test speed: tag the long parity runs so the default suite runs in minutes (Sonnet, S).
18. Later: legal and permit rating vehicles from shared/vehicles.js (Opus, M–L).

### Uncertainty
- Only C-1 was run in this review. The other numbers come from the fixlog and test records. They were not re-run here.
- C-30 (the CP2 Δf from the layout) and SB2-O21 were not re-verified on the current main.
- C-14 (owner m on every module) needs the final comparison.
- The status of the AUDIT A14 items in the old app was not re-checked.
- F-8 (self-weight-excluded files) is a code-reading finding. No such file was run.
