# AUDIT.md — Review of the single-file HTML engineering tools

**Scope.** This is a read-only review of all 24 HTML files on `main` as of 2026-10-03. No tool file was changed.
**Method.**
- **Reading.** Each file was read in full, except embedded base64, inlined libraries and other blobs, which were identified but not dumped. Calculation code was checked against the code provisions the tool cites.
- **Running.** Several engines were run outside the browser (in Node) to reproduce results numerically: the moving-load engine, the geometry/alignment engine, the concrete flexure solver, and the DF formulas.
- **Lead-reviewer spot checks.** The highest-impact findings were re-checked by reading the source directly. They are marked **[spot-checked]**.
- **CDN dependencies.** File availability and version metadata were checked against the npm registry; the CDNs themselves are not reachable from the review environment.

**How to read the confidence levels**
- **High:** the code clearly does something different from the cited provision, or the behaviour was reproduced.
- **Medium:** likely wrong, but it depends on the edition, an owner (MassDOT) rule, or an interpretation the engineer should confirm.
- **Low:** worth a look; it may be intentional.

Where a finding depends on recollection of a code provision rather than the text, it says **verify**. Nothing in this document has been fixed. Line numbers are 1-based and refer to the files as committed on `main`.

> **Important context for every finding:** in Chromium-based browsers (Chrome/Edge), *all* pages opened from `file://` share **one** localStorage origin. Every tool can read and overwrite every other tool's keys. Several findings below depend on this.

---

## Contents

1. [Inventory](#1-inventory)
2. [Overlap and grouping](#2-overlap-and-grouping)
3. [Possible calculation issues](#3-possible-calculation-issues)
4. [Bugs and robustness](#4-bugs-and-robustness)
5. [Consistency](#5-consistency)
6. [Outdated / risky dependencies](#6-outdated--risky-dependencies)
7. [Recommended work plan](#7-recommended-work-plan)

---

## 1. Inventory

Sizes are on-disk bytes rounded. "Blob" means embedded base64 images, inlined libraries or embedded apps that make up much of the size.

### 1.1 Summary table

| File | What it does (one line) | Codes / specs referenced (edition as stated in file) | CDN libraries (version) | Storage keys | Size |
|---|---|---|---|---|---|
| `index.html` | **MIDAS Civil MCT generator.** Builds girder-line or girder–floorbeam–stringer models, post-processes MIDAS results, and does AASHTO MBE (LRFR/LFR) and AREMA Ch. 15 ratings. Hub of the "bridgeSuite" (frames `lldf`/`psbeam`/`stgirder`). | AASHTO LRFD / MBE / AREMA Ch. 15 / MassDOT §3.5.3, cited by article only. **No edition stated.** Fatigue factors match the 7th Ed. or earlier. | React 18.2.0 + ReactDOM (prod), Babel-standalone 7.23.5, Chart.js 4.4.1, Plotly 2.26.0, three r128, KaTeX 0.16.9 (all cdnjs) | `mct_cfg_v3`, `mct_cfg_v2` (legacy), `mct_results_v1` (legacy), `mct_results_combos_v1`, `mct_cap_zones_v1`, `mct_results_snap_v1`, `mct_saves_v1`; IndexedDB `mct_idb_v1`/`kv`; shared `bridgeSuite.v1.*` (see 1.3) | 1.31 MB (all JSX source) |
| `lldf.html` | **Live-load and dead-load distribution factors per girder** (AASHTO 4.6.2.2 beam-slab, box, slab), with MassDOT pile-cap dead-load distribution. Publishes to the suite. | AASHTO LRFD 4.6.2.2 / MassDOT §3.5.3. **No edition stated** (matches 7th–9th). | **KaTeX 0.17.0 inlined** (works offline); Google Fonts | `lldf_projects_v1`, `lldf_autosave_v1`; shared `bridgeSuite.v1.*` | 0.99 MB (≈700 KB KaTeX + scanned AASHTO table images) |
| `psbeam.html` | **Prestressed concrete girder design** (AASHTO LRFD Sec. 5). Part of the suite. | AASHTO LRFD "9th Ed. article numbering" (:6603), no year; MBE 6A for rating | React 18.2.0, Babel 7.23.5, Plotly 2.27.0, KaTeX 0.16.9 (cdnjs) | `psbeam.inputs.v1`, `psbeam.ui.v1`, `psbeam.projects.v1`, `psbeam.fold.*`; shared `bridgeSuite.v1.*` | 621 KB (58 KB base64 image) |
| `stgirder.html` | **Steel plate girder design** (AASHTO LRFD Sec. 6). Part of the suite. | AASHTO LRFD "10th Ed." (footer :4750, unverified); MBE for rating | React 18.2.0, Babel 7.23.5, Plotly 2.27.0, KaTeX 0.16.9 (cdnjs) | `stgirder.session`, `stgirder.projects`, `stgirder.lastproj`, `stgirder.ui.v1`; shared `bridgeSuite.v1.*` | 326 KB |
| `Steel Bridge Beam Modules.html` | **"GirderDetail":** 12 composite steel I-girder detail modules (splice, stiffeners, studs, cross-frames, overhang, welds, section, fatigue, DFs, staged FE analysis). Embeds a 2nd app, **"PlateLine"** (preliminary sizing). | AASHTO LRFD **10th Ed. (2024)** in most modules; **9th Ed.** in the bearing-stiffener module header and PlateLine's references; 8th Ed. splice method as an option; NSBA splice v2.04; AISC Manual 16th; MBE "current"; MassDOT §3.5.3 | MathJax `@3` (major only), three r128 + OrbitControls 0.128, Plotly 2.27.0 (loaded twice), Pyodide 0.26.4 + **unpinned** `ezdxf` (DXF layouts only), Google Fonts | `girderdetail_autosave_v1`, `girderdetail_projects_v1`, `girderdetail_inbox_v1`, `__gd`; PlateLine: `plateline_autosave_v1`, `plateline_projects_v1`, `plateline_profiles_v1`, `plateline_undo_v1`, `plateline_last_v1` (unused), `__pl` | 1.52 MB (556 KB base64 PlateLine app on line 2229) |
| `Moving Load Generator.html` | **"BridgeLoad Pro":** continuous-beam (1–4 spans) moving-load envelopes by influence lines; HL-93, HS20/H20, fatigue, Cooper E80 and other rail. | AASHTO LRFD by article; **no edition stated** (fatigue factors match 8th Ed. and later); AREMA Ch. 15 | **None** (fully offline) | **None** (inputs lost on reload) | 131 KB |
| `Bridge Substructure Loading.html` | **"SubLoads":** whole-bridge substructure load generator: DC/DW, LL by influence lines, BR, CE, WS/WL, TU, water, ice, EQ, CV/CT, combinations. | AASHTO LRFD **10th Ed. (2024)**; MassDOT Bridge Manual Pt I Ch. 3 (**Jan 2025**) option; USGS AASHTO-2009 hazard | three r128 (cdnjs) + OrbitControls 0.128 (jsdelivr); on demand: Pyodide 0.26.4 + ezdxf, SheetJS xlsx 0.18.5; USGS web services; Google Fonts | `subloads_v1` | 410 KB |
| `abutment_calculator.html` | **Cantilever abutment design:** earth loads, γp permutations, stability, piles, stem/backwall/footing structural checks. | AASHTO LRFD **10th Ed. (2024)**; MassDOT LRFD Bridge Manual Pt I | KaTeX 0.16.11, Plotly 2.35.2, three 0.128.0 + OrbitControls + CSS2DRenderer (unpkg) | `abutcalc_v1_autosave`, `abutcalc_v1_projects` | 324 KB |
| `elastomeric_design_module.html` | **Elastomeric bearing design** (Method A/B; steel-reinforced/plain). Opened from the abutment tool. | AASHTO LRFD **10th Ed. (2024)** 14.7.5/14.7.6; MassDOT §3.5.7 | KaTeX 0.16.11, Plotly 2.35.2 | `edm_v1_autosave`, `edm_v1_projects` | 55 KB |
| `Retaining Wall Designer.html` | **"RetainCalc Pro":** cantilever retaining wall stability and structural design. | **ACI 318-19 / IBC 2021** (ASD stability) or **AASHTO LRFD 10th Ed. (2024)**; ASCE 7-22 (seismic and column combos); MassDOT §3.3.2 | three r128 + OrbitControls 0.128, Plotly 2.35.2 (3-CDN fallback), MathJax `@3` (major only), Google Fonts | `retaincalcpro.projects.v1`, `retaincalcpro.autosave.v1`, `retaincalcpro.lastproject.v1`, `rcp_input_tab`, `__rcp_test__` | 522 KB |
| `Spread Footing.html` | **Spread or combined footing** (≤10 pedestals): biaxial bearing, Vesić capacity, stability, ACI flexure, shear, punching, pedestal. | **ACI 318-19 / ASCE 7-16 / IBC 2021**; AASHTO 10.6.3.3 / 11.6.3.3 eccentricity options (no edition) | KaTeX 0.16.11, Plotly 2.35.2, three 0.160.0 | `sfd_auto`, `sfd_projects` | 379 KB |
| `Pile Designer.html` | **Micropile LRFD designer**, plus driven H-pile and integral-abutment-pile modes; nonlinear p-y solver; LPILE import. | "AASHTO LRFD BDS **10th Ed (2024)** [relabelled from 9th Ed; article numbers to be confirmed]" (:661); FHWA NHI-05-039; FHWA-NHI-16-009; MassDOT §3.10 (no edition) | Tailwind Play CDN **3.4.5**, React 18.3.1 (prod, unpkg), three r128, KaTeX 0.16.9, Plotly 2.32.0; pdf.js 3.11.174 on demand | `micropile_lrfd_inputs_v1`, `micropile_lrfd_lpile_v1`; IndexedDB `micropile_lrfd_db`/`projects` | 1.15 MB (61 KB HTML manual embedded as base64, :5290) |
| `Light Pole and Sign Post.html` | **Drilled-shaft foundation designer** for cabled light masts and one- or two-post signs; pole/post, anchors, shaft P–M, IBC embedment. | **IBC 2021 §1807.3 / ASCE 7-22 / AISC 360-16 / ACI 318-19**; "AASHTO LTS C13.6.1.1" for the Broms check only. **Not** an AASHTO LRFDLTS tool. | KaTeX 0.16.9 + auto-render | `lpp_projects_v1`, `lpp_session_v1`, `__lpp_test`, **`activeTab` (generic!)** | 441 KB |
| `Stone Masonry Arch Load Rating.html` | **Masonry arch Inventory rating** by allowable stress on an elastic frame with influence lines. Not MEXE and not mechanism analysis. | MassDOT BM Pt I §7.2.7; AASHTO MBE 6A.9.1; AASHTO Std. Spec. 6.4 / 3.8.2.3 (matches 17th Ed.); AREMA Ch. 8. **No editions stated.** | KaTeX 0.16.9, Plotly 2.27.0 (SVG fallback) | `stoneArchLR.autosave`, `stoneArchLR.projects`, `stoneArchLR.probe` | 751 KB |
| `Concrete Beam Capacity.html` | **"Concrete Beam Design Suite":** 3-tab shell with `srcdoc` iframes: (1) RC beam capacity (ACI 318-19 / AASHTO), (2) ASD rating (AASHTO 8.15), (3) a copy of the rebar development app. | ACI 318-19; AASHTO LRFD **9th Ed.**; AASHTO Std. Spec. 8.15 | Capacity: KaTeX 0.16.11, Plotly 2.32.0, three 0.160.0. ASD: KaTeX 0.16.11. Dev: KaTeX 0.16.9 + Plotly 2.27.0 (**two Plotly builds per page**) | `rcbeam_v2_auto`, `rcbeam_v2_projects`, `asd_v1_auto`, `asd_v1_projects`, **`rebar_aci_autosave_v1`, `rebar_aci_projects_v1` (shared with standalone)** | 1.06 MB (625 KB base64) |
| `ACI Rebar Development Length.html` | **Rebar development and splice calculator** (tension, hook, compression, lap). | **ACI 318-19**; AASHTO LRFD **9th Ed.** §5.10.8 | KaTeX 0.16.9 + auto-render, Plotly 2.27.0 | **`rebar_aci_autosave_v1`, `rebar_aci_projects_v1`** (shared with the suite's Dev tab) | 712 KB (625 KB base64) |
| `Concrete Beam ASD.html` | **"Universal ASD Bridge Rater":** working-stress RC beam capacity and Inv/Op rating factor. | "AASHTO Std. Specs / MassDOT", 8.15. **No edition.** | **Tailwind Play CDN (unpinned)**, **@phosphor-icons/web (unpinned)**, KaTeX 0.16.9 | None (file save/load only) | 41 KB |
| `Steel Beam Design - AISC 15th.html` | **Steel beam designer:** multi-span direct-stiffness analysis plus AISC 360-16 LRFD checks, composite, torsion, batch. | **AISC 360-16**, Manual 15th, Shapes DB v16.0, Design Examples v15.0; DG9; ASCE 7 (edition "verify") | KaTeX 0.16.11, plotly-basic 2.35.2; ExcelJS 4.4.0 on demand | `sbd_autosave_v1`, `sbd_projects_v1` | 766 KB (shape DB inline) |
| `Timber Beam Check.html` | **Sawn-lumber simple-span beam check** (bending, shear, bearing, deflection). | **NDS 2018**, ASD only | **Tailwind Play CDN (unpinned)**, **@babel/standalone (unpinned)**, **lucide@latest**, React 18.2 + lucide-react 0.292 via **esm.sh**, Google Fonts | None (file save/load only) | 58 KB |
| `Shear and Moment Diagrams.html` | **"Multi-Span Beam Pro":** continuous-beam V/M/deflection diagrams with load cases, combinations, envelope. | No design code; "ASCE 7" combination presets (no edition) | KaTeX 0.16.9, plotly-basic 2.27.0 | **`beamProSaves`, `beamProAuto` (generic names)** | 126 KB |
| `BasePlateAnchorDesigner.html` | **Column base plate** (AISC DG1) plus **cast-in anchors** (ACI 318-19 Ch. 17), anchor reinforcement, PROFIS PDF import. | **ACI 318-19 Ch. 17**; AISC **DG1 2nd Ed.**; ASCE 7-22 §2.3 combination generator; AISC 360 (J3.10, E3; edition not stated) | KaTeX 0.16.11, three 0.160.0, Plotly 2.32.0, **pdf.js 3.11.174** | `bpad_autosave_v1`, `bpad_projects_v1`, `bpad_lastproject_v1` | 1.07 MB (341 KB base64 figures) |
| `Concrete Anchor.html` | **"Structural Anchor Pro":** simple 1- or 4-anchor cast-in anchor check plus a crude plate check. | "ACI 318-19 Ch. 17" | **React 18 *development* builds (unpinned `@18`)**, **@babel/standalone (unpinned)**, **Tailwind Play CDN**, KaTeX 0.16.9 | None (file save/load only) | 45 KB |
| `ASCE7-16 Load Generator.html` | **ASCE 7-16 building loads:** snow, wind (Ch. 27 Pt 1, Ch. 29), seismic ELF, combinations; built-in Massachusetts town hazard table. | **ASCE 7-16**; 780 CMR (MA State Building Code **10th Ed.**) | KaTeX 0.16.9; Plotly 2.35.2 and ExcelJS 4.4.0 on demand | `asce7bldg.projects`, `asce7bldg.autosave` | 376 KB |
| `Bridge Geometry.html` | **Bridge geometry engine:** horizontal (tangent/curve/clothoid) and vertical alignment, cross-slope, top-of-deck and beam-seat elevations, State Plane map. | None (geometry only) | three r128, proj4js 2.11.0 (cdnjs), Leaflet 1.9.4, **plotly-basic 3.7.0** (unpkg); OSM / Esri tiles | `bridgeGeomEngine.project.v1`, `bridgeGeomEngine.library.v1`, `bridgeGeomEngine.examplesSeeded.v1`, `__bge_probe__` | 309 KB |

### 1.2 Links between files

| From | To | How | Notes |
|---|---|---|---|
| `index.html` | `lldf.html`, `psbeam.html`, `stgirder.html` | `<iframe>` (:21106) whose `src` comes from `bridgeSuite.v1.appPaths` (defaults at :300) | All three exist. **File names are load-bearing:** renaming or moving breaks the default paths. |
| `lldf.html`, `psbeam.html`, `stgirder.html` | each other and `index.html` | `bridgeNav()` / `BridgeApps.href` (e.g. lldf :3454-3462; defaults lldf :673, psbeam :644, stgirder :547) | Same shared bootstrap code in all four files (see §2.1). |
| `abutment_calculator.html` | `elastomeric_design_module.html` | `window.open("elastomeric_design_module.html","edm")` (:4249) plus postMessage `app:"abutment-edm"` | Both must stay in the same folder. |
| `Concrete Beam Capacity.html` | (embedded copy of) `ACI Rebar Development Length.html` | `srcdoc` iframe, verbatim copy (suite line = standalone line + 5048 after ~line 187) | Only two CSS hunks differ. |
| `Steel Bridge Beam Modules.html` | (embedded) PlateLine | base64 `srcdoc` (:2229) | No standalone PlateLine file exists. |
| `Pile Designer.html` | "Micropile-LRFD-Designer-Manual.html" | **Not a link.** A download of the manual embedded at :5290 (`downloadManual()` :5291-5302). | The missing file is expected; the feature works. |
| `Steel Beam Design - AISC 15th.html` | `Shear and Moment Diagrams.html` | JSON import of the S&M export format (`importLegacy` :587, detection :2272) | Data link only. |
| `Bridge Substructure Loading.html` | `abutment_calculator.html` | exports `subloads-abutment-v1` JSON | **No importer exists** in the abutment tool. |
| `index.html` | `handoff-data-format-spec.md` | comment at :118 | **File not in repo.** |

The following files are **not reachable from `index.html`** and have no links in or out:

- `Steel Bridge Beam Modules.html`
- `Moving Load Generator.html`
- `Stone Masonry Arch Load Rating.html`
- `Pile Designer.html`
- `BasePlateAnchorDesigner.html`
- `Concrete Anchor.html`
- `Bridge Geometry.html`
- all the building tools

### 1.3 The `bridgeSuite.v1.*` hand-off protocol (index / lldf / psbeam / stgirder)

| Key | Producer | Consumers | Schema check on read? |
|---|---|---|---|
| `.handoffs`, `.latestId`, `.updatedAt`, `.adopted.<app>` | index (MCT demands) | psbeam, stgirder | `_schema` is `psbeam-external-demands` for **both** the PS and steel flavours (index :132); the two share one `handoffId` (see §4.1) |
| `.lldf`, `.lldf.updatedAt` | lldf | index, psbeam, stgirder | index checks version only, **not `_schema`** (index :6596) |
| `.dlLoads` | lldf | index, psbeam, stgirder | yes (`bridge-dl-loads`) |
| `.lldfGeom`, `.lldfGeom.seen` (+ `.updatedAt`, `.adopted.lldf` from Bridge Geometry) | index (also psbeam/stgirder, Bridge Geometry) | lldf | yes (`bridge-lldf-geometry`, version, every number; HANDOFF.md §4.2) — index always sends `type:'a'` (steel) even for PS girders (index :19958) |
| `.psSection`, `.psSection.updatedAt` | psbeam | index, lldf | **no `_schema`/version check** (index :6024-6027, :6139) |
| `.capacity`, `.capacity.updatedAt`, `.capacity.adopted.mct` | psbeam, stgirder | index | yes (`bridge-design-capacity`) |
| `.designBeam`, `.beamRoster` | lldf / chip UI | all | yes |
| `.geometryChanges` (+ `.updatedAt`, `.adopted.<app>`) | index, stgirder | others | — (human-readable diff only) |
| `.locks`, `.syncLog.<app>`, `.lockSnap.<app>`, `.projects`, `.currentProjectId`, `.migrated.<app>`, `.appPaths`, `.demandsKind`, `.materials`, `.projectMeta` | shared | shared | — |

`Bridge Geometry.html` takes part only as a sender on `.lldfGeom` ("Send to LL & DL", HANDOFF.md §4.2). It reads no `bridgeSuite.*` key except `.projectMeta` (for the project name in the envelope).

---

## 2. Overlap and grouping

### 2.1 Tools that overlap

| Topic | Tools | What overlaps / differs | Recommendation |
|---|---|---|---|
| **Truck / vehicle libraries** (legal SU4–SU7, 3S2, 3-3, EV2/EV3, HL-93, HS20, Cooper E80) | `index.html` (:1250-1319), `Stone Masonry Arch Load Rating.html` (:2412-2423), `Moving Load Generator.html` (:262-271), `Bridge Substructure Loading.html`, `Steel Bridge Beam Modules.html` | **Each file has its own copy, and they disagree.** index overstates SU5/6/7 and EV2/EV3 and has wrong 3S2/3-3/SU4 layouts; the arch tool has wrong SU6/SU7 axle sums. HL-93 is correct everywhere it was checked. | Make one verified vehicle table (with MBE/FHWA references) and copy it into each file, keeping it duplicated per CLAUDE.md. |
| **Moving-load analysis / LL envelopes** | `Moving Load Generator.html`, `Steel Bridge Beam Modules.html` (FE + HL-93 envelopes), `Bridge Substructure Loading.html` (LL reactions), `index.html` (via MIDAS) | The Moving Load Generator and GirderDetail engines were both verified correct, including the 90% two-truck case. index's MCT HL-93 uses a **fixed 14 ft rear axle and no 90% two-truck case**. | Treat Moving Load Generator / GirderDetail as the reference when checking index. |
| **Live-load distribution factors** | `lldf.html`, `Steel Bridge Beam Modules.html` (DF module), PlateLine (preliminary), `Moving Load Generator.html` (manual entry) | lldf and GirderDetail both verified against Tables 4.6.2.2.2b/3a. lldf is missing the exterior fatigue rigid-section floor. | lldf is the reference. GirderDetail's DF module duplicates it. |
| **Steel I-girder design** | `stgirder.html`, `Steel Bridge Beam Modules.html` (GirderDetail section module + PlateLine), `index.html` (rating capacities) | Three implementations of 6.10 at different depths. index uses Mp/compact assumptions. | Pick stgirder or GirderDetail as the design tool of record; keep index capacities as rating approximations only, with a warning. |
| **RC beam / ASD rating** | `Concrete Beam Capacity.html` (Capacity + ASD tabs), `Concrete Beam ASD.html`, `psbeam.html` | `Concrete Beam ASD.html` is an **older, different app** from the suite's ASD tab. They share the calculation engine but have different bugs (the standalone's Save is broken). | Retire the standalone ASD file in favour of the suite tab, or at least label it as superseded. |
| **Rebar development length** | `ACI Rebar Development Length.html` + embedded copy in `Concrete Beam Capacity.html`; private versions inside `BasePlateAnchorDesigner.html` (:2579-2592), `Retaining Wall Designer.html` (:1469-1505), `Spread Footing.html` (:2391-2398) | **Five implementations, and their ψg handling differs:** Rebar app = correct 1.0/1.15/1.3; BasePlate = 1.15 for Gr 100 (wrong); Retaining Wall = always 1.0; Spread Footing = ignored, with (cb+Ktr)/db fixed at 2.5. | Use the Rebar app as the reference snippet; copy its ψ logic into the others (one PR each). |
| **Concrete anchors (ACI 318 Ch. 17)** | `BasePlateAnchorDesigner.html`, `Concrete Anchor.html`, `Light Pole and Sign Post.html` | BasePlate is the most complete. Concrete Anchor has several unconservative errors (side-by-side table in §3.6). Light Pole skips shear breakout and side-face blowout. | Mark `Concrete Anchor.html` "do not use for design" until fixed, or retire it. |
| **Earth-retaining / abutment** | `Retaining Wall Designer.html`, `abutment_calculator.html`, `Bridge Substructure Loading.html` (abutment earth tab) | Same Ka/h_eq/γp logic. SubLoads says it "follows" the abutment calculator, but they differ on seismic connection force (0.15/0.25 vs 0.10), support-length H, wind per limit state, and Strength IV. | Align the abutment calculator to SubLoads on those four items. |
| **Beam analysis engines** | `Shear and Moment Diagrams.html`, `Steel Beam Design - AISC 15th.html`, `Timber Beam Check.html`, `Moving Load Generator.html` | The Steel tool's engine is a corrected successor of S&M: per-span deflection limit, load-point stations, cantilever deflection. Timber has its own simplistic engine (left reaction only). | Port the Steel engine's three fixes back into S&M. |
| **Building load combinations / wind** | `ASCE7-16 Load Generator.html` (ASCE 7-16), `Light Pole and Sign Post.html` (ASCE 7-22), `Spread Footing.html` (7-16), `Retaining Wall Designer.html` (7-22 for column combos), `BasePlateAnchorDesigner.html` (7-22 generator), `Steel Beam Design` (7-16 basics), `Shear and Moment Diagrams.html` (unstated) | **Mixed ASCE 7 editions across tools.** A project could combine 7-16 and 7-22 results. | Decide which edition each tool targets and state it in the UI. |
| **Bridge wind / seismic connection** | `Bridge Substructure Loading.html`, `abutment_calculator.html`, `Steel Bridge Beam Modules.html` (cross-frames) | See the earth-retaining row above. | — |

### 2.2 Proposed folder organisation (do **not** move anything yet)

```
/                              ← keep README/CLAUDE.md/AUDIT.md here
bridge-suite/                  ← MUST stay together, file names unchanged
    index.html  (MCT generator — consider a separate launcher later)
    lldf.html
    psbeam.html
    stgirder.html
loads/
    ASCE7-16 Load Generator.html
    Moving Load Generator.html
    Bridge Substructure Loading.html
analysis/
    Shear and Moment Diagrams.html
superstructure/
    Steel Bridge Beam Modules.html
    Concrete Beam Capacity.html
    Concrete Beam ASD.html          (or retire — see §2.1)
rating/
    Stone Masonry Arch Load Rating.html
substructure/
    abutment_calculator.html        ← must stay with elastomeric_design_module.html
    elastomeric_design_module.html
    Retaining Wall Designer.html
foundations/
    Pile Designer.html
    Spread Footing.html
    Light Pole and Sign Post.html   (it is mainly a drilled-shaft designer)
connections-anchorage/
    BasePlateAnchorDesigner.html
    Concrete Anchor.html
components/                   ← general building members and detailing
    Steel Beam Design - AISC 15th.html
    Timber Beam Check.html
    ACI Rebar Development Length.html
survey-geometry/
    Bridge Geometry.html
```

**Reasoning**

- **Discipline first.** Grouping follows how an engineer looks for a tool: loads → analysis → superstructure → substructure → foundations, plus geometry and connections.
- **The bridge suite is one unit.** The four suite files load each other by relative file name (`appPaths` defaults) and share storage. They must live in one folder with their names unchanged.
- **Hard-linked pairs stay together.** `abutment_calculator.html` opens `elastomeric_design_module.html` by bare file name, so they must share a folder.
- **Rating.** Rating tools (arch, the ASD rater) are separated from design tools because their codes and editions differ (Std. Spec. / MBE vs LRFD).
- **Project management.** There are currently **no** project-management tools in the repo, so that folder is not proposed.

**Before moving anything**

- **Storage survival.** In Chrome/Edge all `file://` pages share one storage origin, so saved data survives a move. In Firefox, `file://` storage is scoped differently and may **not** survive a move. Export each tool's JSON first.
- **Suite folder memory.** `bridgeSuite.v1.appPaths` remembers per-folder file locations. After a move, the suite will re-learn paths, but the old entries remain.
- **One move per PR**, then verify the suite links and the abutment ↔ EDM hand-off by opening the files.

---

## 3. Possible calculation issues

Severity tags: **[U]** = unconservative (could pass something that should fail); **[C]** = conservative but not per code; **[?]** = depends on interpretation or edition.

### 3.0 Top 26 (highest priority, across all tools)

| # | File : line | Issue | Conf. |
|---|---|---|---|
| 1 | `abutment_calculator.html:1446-1465, 1477, 1689, 1886` **[spot-checked]** | `e = B/2 − x̄` is never taken as absolute. A resultant on the **heel side** gives negative D/C (always "passes"), **B′ > B** (soil pressure under-estimated) and rock q_max at the wrong toe. **[U]** | High |
| 2 | `Concrete Anchor.html:156` | Steel tension/shear uses **gross** bolt area 0.7854d² instead of A_se (~+30%). **[U]** | High |
| 3 | `Concrete Anchor.html:476` | Plate check uses the **anchor rod Fy** as plate Fy (F1554-105 → 105 ksi plate). **[U]** | High |
| 4 | `Concrete Anchor.html:533` **[spot-checked]** | "Cond. B" checkbox bound to `conditionB`; the calculation reads `condB` (default true). The control is dead. | High |
| 5 | `Pile Designer.html:7787-7791` **[spot-checked]** | Grade 150 thread bars set **fy = 150 ksi**. That is fpu; fy = 120 ksi. Bar tension, CFST and test-bar checks are 25% high. **[U]** | High |
| 6 | `Pile Designer.html:5359-5367` vs `:2187, 2827-2876, 1223` | H-pile φ inputs are **printed in the report but not used**. The calculation uses hardcoded different φ. | High |
| 7 | `Pile Designer.html:1721-1741` | Casing flexure has **no slender branch** (0.31–0.45 E/Fy gets Fy·Z, about 2× too high); above 0.45 E/Fy, Mn is undefined. **[U]** | High |
| 8 | `Spread Footing.html:2984` **[spot-checked]** | `gfX = 1-(1-gvX)` evaluates to **γv, not γf**. The flexural-transfer moment is about 33% low for a square column. **[U]** | High |
| 9 | `Concrete Beam Capacity.html:569, 577` **[spot-checked]** | Displaced-concrete correction for compression steel has the **wrong sign** (compression force overstated by 2·0.85f'c·A's). Shifts c, εt and φ. **[U]** | High |
| 10 | `Concrete Beam Capacity.html:607-616` | Tension-controlled limit fixed at 0.005, not εty + 0.003 (ACI 318-19 21.2.2). Unconservative for Gr 80/100. **[U]** | High |
| 11 | `Retaining Wall Designer.html:7811-7841` | **US/SI toggle overwrites inputs with SI numbers, and the engine still treats them as US.** All results become meaningless; autosave stores SI values that reload as US. | High |
| 12 | `index.html:1510-1545` | `ROLLED_SHAPES` has wrong tf (often equal to tw) and some wrong bf, e.g. W21X55 tf 0.375 vs 0.522. AREMA "rolled" capacities are wrong. **[U]** | High |
| 13 | `index.html:1250-1286, 9697-9701` | Legal/posting/EV trucks wrong: SU5/6/7 = 70/87/105 k (should be 62/69.5/77.5 k); 3S2/3-3/SU4 layouts wrong; EV2/EV3 not FHWA. **Posting tons overstated.** **[U]** | High |
| 14 | `index.html:10783-10790, 11448` | `mctCarriesImpact` ignores grillage mode. GFS MCT writes no IM, but the rating assumes it did, so **highway ratings in GFS lose the 33% IM**. **[U]** | High |
| 15 | `index.html:11645-11779, 11794-11884` | Service II, Fatigue and PS Service III use raw MIDAS LL with **no DF/IM scaling** and one section modulus for all load stages. | High |
| 16 | `index.html:7230-7231, 9736-9737` **[spot-checked]** | Fatigue I/II = **1.50/0.75**; current AASHTO is 1.75/0.80. **[U]** | High |
| 17 | `ASCE7-16 Load Generator.html:960-961` | C_vx uses level **elevation** instead of height above the base when `baseElev ≠ 0`. | High |
| 18 | `ASCE7-16 Load Generator.html:399-403` | For H/Lh > 0.5, **Lh is not replaced by 2H** in K2/K3 (Fig. 26.8-1 note 2). **[U]** | High |
| 19 | `Light Pole and Sign Post.html:3558-3580` | Anchor and shaft demands come only from the max-moment combination, so **0.9D + W never governs bolt tension**. **[U]** | High |
| 20 | `Light Pole and Sign Post.html:2639, 3154` | Pole/post checked at segment mid-heights only. **The base section is never checked.** **[U]** | High |
| 21 | `Steel Bridge Beam Modules.html:2441-2442, 4838` | ~~Stud pitch check passes at 4d (6d required)~~ **Withdrawn (2026-10-04):** AASHTO LRFD **10th Ed.** reduced the 6.10.10.1.2 minimum pitch from 6d to 4d, so the tool is correct under the 10th Ed. Only the work string and plan drawing mislabelled it (fixed in PR #2). | — |
| 22 | `Steel Beam Design - AISC 15th.html:1698` **[spot-checked]** | E7 effective width for I-shape **webs** uses 0.22/1.49; Table E7.1 case (a) gives 0.18/1.31. **[U]** | High |
| 23 | `Timber Beam Check.html:412, 371-373` | Flat-use applies Cfu but keeps the **edgewise** S and I. Grossly unconservative. **[U]** | High |
| 24 | `Timber Beam Check.html:439-440, 462-464, 477` | Shear and bearing use **only the left reaction**. **[U]** for unsymmetric point loads. | High |
| 25 | `stgirder.html:1606-1608, 2008-2018` **[spot-checked]** | Imported MIDAS DC2/DW shears are not sign-flipped (psbeam does flip them), so they partly cancel the app's own DC1 shear. **Vu at supports is under-stated.** **[U]** | Med-High |
| 26 | `Bridge Geometry.html:756-765` | Crown → superelevation transition **jumps** (0.96 ft in 2 ft at a 12 ft edge offset) at the midpoint between controls. No runout/runoff. | High |

The per-tool detail follows. "Verified OK" lists what was checked and found correct.

### 3.1 `index.html` (MCT generator / rating)

| Location | What the code does | Why it may be wrong | Conf. |
|---|---|---|---|
| :1510-1545 | `ROLLED_SHAPES` e.g. `W21X55 tf:0.375 tw:0.315`, `W24X76 tf:0.440`, `W36X150 tf:0.625`, `W14X26 bf:5.73 tf:0.255` | AISC values: W21X55 tf 0.522 / tw 0.375; W24X76 tf 0.680; W36X150 tf 0.940; W14X26 bf 5.03 / tf 0.420. These feed `convertRolledToBuiltUp` (:4580-4593) and AREMA rolled capacities. (`W_SHAPE_PROPS` at :9300 is correct.) **[U]** | High |
| :1250-1274, :9697-9701 | Legal/posting trucks: SU5 = 70 k, SU6 = 87 k, SU7 = 105 k; 3S2 axles 0/15/19/43/47; Type 3-3 and SU4 layouts | MBE App. D6A: SU5 62 k, SU6 69.5 k, SU7 77.5 k; 3S2 10/15.5×4 @ 11', 4', 22', 4'; 3-3 and SU4 layouts differ. Posting tonnage = RF × tons is overstated. **[U]** | High |
| :1277-1286 | EV2 = 108 k, EV3 = 147 k | FHWA FAST Act: EV2 57.5 k, EV3 86 k. | Med-High |
| :9697 | `'HL-93TDM':27.5` t | The tandem is 50 k = 25 t (display only). | Medium |
| :7230-7231, :9736-9737, :9797, :11725 | Fatigue I/II γ = 1.50/0.75 | 8th/9th/10th Ed. Table 3.4.1-1: 1.75/0.80. **[U]** | High |
| :11729-11779 | Fatigue rating uses the raw MIDAS moment range ×12/Sx | No fatigue truck in the library, IM 33% instead of 15%, and **no distribution factor** (should be g/1.2). | High |
| :11645-11718 | Service II `fLL = M·12/Sx` with no ratingLLScale; one Sx for DC1, DC2/DW and LL; 0.95RhFyf for all; LL factor 1.3 at Operating | LRFD 6.10.4.2 needs staged section moduli (noncomposite / 3n / n). Strength applies g and IM but Service II doesn't. MBE Operating Service II LL factor is 1.0. | High / Med |
| :11794-11884 | PS Service III uses one Sb; `fr = 0.19√f'c` labelled modulus of rupture | DC1 is on the girder alone, DC2/DW/LL on the composite section. 0.19√f'c is a tension limit, not fr (mislabelled). No DF/IM applied to LL. | High |
| :10783-10790, :11448-11452 | `mctCarriesImpact` is true if any vehicle has DLA > 0; ignores geomMode | In GFS mode the MCT has no IM (:4085-4087), so the rating silently drops IM. In beam mode, a DLA-0 legal truck analysed with HL-93 also loses IM. **[U]** | High |
| :3108-3175 | MCT HL-93 truck axles fixed at 0/14/28; no 0.9 × (two trucks + lane) | LRFD 3.6.1.2.2 (14–30 ft variable) and 3.6.1.3.1 (negative moment / pier reactions). The default model is 4-span continuous. **[U]** | High |
| :4060-4087 | GFS MCT: no HL-93 lane load, no IM, fixed 0.5 scale | Lane load silently missing in GFS mode. | Medium |
| :9724-9731, :10770-10772 | Permit γLL = 1.10 flat | MBE Table 6A.4.5.4.2a-1 varies by permit type and ADTT (up to 1.30/1.50). **[U]** | Med-High |
| :11576-11578, :12463-12465 | `C = φc·φs·φ·Mn` with no floor | MBE Eq. 6A.4.2.1-3 requires φc·φs ≥ 0.85. **[C]** | High |
| :9745-9751 | φs "bolted two-girder 0.85"; table numbers swapped | MBE Table 6A.4.2.4-1: riveted two-girder 0.90, welded 0.85. | Medium |
| :11075, :13442, :19188 | η shown in RF formula, never applied | Misleading display. | Medium |
| :11228-11239 | Quick-calc `Mn = Fy·Zx`, `Vn = 0.6Fy·Aw` | Assumes compact section, no LTB, C = 1. **[U]** for noncompact or slender webs. | Medium |
| :9894-9918 | Composite Mn⁺ = Mp | Missing Mn = Mp(1.07 − 0.7Dp/Dt) when Dp > 0.1Dt (6.10.7.1.2); ductility check only in UI. **[U]** | Medium |
| :9923-9948, :11238 | Optional composite Mn⁻ = plastic | 6.10.8 flange-stress limits normally govern unless App. A6 applies. **[U]** | Medium |
| :11245 | `MnNeg: … ‖ MnPos*0.7` | Arbitrary placeholder hogging capacity for PS zones. | High |
| :9950-9978 | PS fps uses the ACI approximate equation with mixed γp/k; labelled AASHTO 5.6.3.1.1; `bw` unused | AASHTO uses fps = fpu(1 − k·c/dp) with T-section behaviour. Overstates Mn when a > hf. **[U]** | Medium |
| :10391-10392 | AREMA `Fb = max(formula, 0.10Fy)` | AREMA has no floor; the floor raises the allowable for slender girders. **[U]** | Medium |
| :12077-12079 | AREMA impact capped at 16% for L > 175 ft | AREMA 16 + 600/(L − 30) has no 175 ft cut-off. **[U]** | Medium |
| :12119 + DEFAULT_CFG | `Math.max(1, R2.arema_long_L_ref ?? span)` with default 0 → 1 ft | Longitudinal force scaled about 2.3× (bug; conservative). | High |
| :9800 | `AREMA_SFT = {A:14,B:10,C:8,D:6,E:4,F:3}` | Does not match current AREMA Table 15-1-10 thresholds; source unknown. **verify** | Low-Med |
| :12113-12118, :12096-12101, :10403 | AREMA wind on LL 0.200 k/ft; rocking 0.94/S; Max-rating Fs 0.60Fy | **verify** against AREMA Ch. 15 (from memory: 300 lb/ft, 1.0/S, possibly 0.45Fy). | Low |
| :11249-11258 | "arema" cap-zone used in LRFR mixes ASD allowables with LRFR factors | Mixed philosophies; positive capacity ignores compression-flange LTB. | Medium |
| :19958 | `lldfGeom.inputs.type:'a'` always | A PS girder is sent to LL&DL as steel type (a), not (k). | Medium |

**Verified OK:**
- composite plastic-moment layer solver; β1;
- LRFR/LFR Strength factors; legal γLL interpolation; φc table; RF equation;
- fatigue A constants and thresholds; N = 365·75·n·ADTT_SL;
- HL-93 axle and lane values, lane without IM;
- Cooper E80;
- AREMA Fb (Normal) formula and the braking, traction and centrifugal equations;
- unit conversions to MIDAS;
- `W_SHAPE_PROPS`.

### 3.2 `lldf.html`

| Location | What | Why | Conf. |
|---|---|---|---|
| :1834 | Exterior fatigue DF = one-lane lever rule / 1.2 only | Art. 4.6.2.2.2d: the exterior DF may not be less than the rigid-section value. The one-lane rigid value is computed (:1781) but unused. **[U]** | Medium |
| :1816, :1845, :1870, :1891 | d_e clamped to its range (beam-slab ≥ −1.0; adjacent box ≤ 2.0; spread box 0–4.5; multicell −2.0–5.0) **without any warning**; no check above 5.5 ft for beam-slab | Range-of-applicability limits are not instructions to clamp. Clamping at the upper bound lowers e. **[U]** | High (missing warning) |
| :1690 | θ > 60° silently capped for shear as well as moment | The cap is in the moment table only; shear at very high skew is understated. **[U]** | Medium |
| :1753 | Lever-rule scan on a 0.25 ft grid | Up to about 0.6% low for interior girders. **[U]** (small) | Medium |
| :1802-1804 | S > 16 ft fallback tries only 1 and 2 trucks | A third truck can fit. | Low-Med |
| :3755 | "Two adjacent beams" DL option gives exactly P to the exterior beam for overhang loads | Lever action would give P(1 + a/S). **[U]** for the exterior beam. | Medium |
| :2321-2323, :483 | Defaults: Type IV concrete properties labelled "Steel I-girder", n = 1 | Labelling/default risk. Concrete picks hard-set n = 1 (:2308). | Medium |
| :1823-1824 | Nb = 3 exterior: `min(e·g_int, lever_ext)` | Order differs from AASHTO's note. **verify** intended interpretation. | Low |

**Verified OK:**
- every Table 4.6.2.2.2b-1/2d-1/2e-1/3a-1/3b-1/3c-1 equation, all girder types;
- MPF applied only to lever and rigid methods;
- fatigue ÷1.2;
- N_L with the 20–24 ft rule;
- skew factors;
- continuous-span L per Table C4.6.2.2.1-2;
- deck and wearing-surface DL.

### 3.3 `Moving Load Generator.html`

The engine was run in Node and matches hand values: truck M at midspan of a 100 ft span = 1,520 k-ft, end shear 65.28 k, lane M = 800 k-ft. It matches the FHWA 2 × 120 ft example within about 2%. The 90% two-truck case, IM on axles only, fatigue truck with fixed 30 ft spacing, and AREMA impact are all verified.

| Location | What | Why | Conf. |
|---|---|---|---|
| :494, :1054-1060, :1252-1258 | The same DF table (with MPF) and LLF are applied to **every** vehicle, including the fatigue truck and "All presets" report | Fatigue needs the one-lane DF ÷ 1.2 and γ = 1.75/0.80. There is no warning. | Medium |
| :269 | HS20/H20: constant impact 1.30 and no Std. Spec. lane loading | HS20 lane load (0.64 klf + 18/26 k) can govern long spans. **[U]** for Std. Spec. work. | Medium |
| :137 | Service III/IV missing from the limit-state list | — | Low |
| :494 | dfNeg applied to all negative moments, including reversal | Minor. | Low |

### 3.4 `Steel Bridge Beam Modules.html` (GirderDetail + PlateLine)

| Location | What | Why | Conf. |
|---|---|---|---|
| :2441-2442, :4838 | SC3 `ge(z.p, 4*d)`, displayed as "6(d) = 4d" | **Withdrawn:** the 10th Ed. minimum pitch is 4d, so the check is correct; only the label was wrong (fixed). Under the 9th Ed. it would be 6d. | — |
| :1222, :1242, :1313, :1340, :2647 | Net area deducts the standard hole size (bolt + 1/16 in) | AASHTO 6.8.3 deducts the hole size + 1/16 in (bolt + 1/8 in). **[U]** for fracture and block shear. **verify** wording in your edition. | Medium |
| :1104 etc. | Ec uses wc = 0.150 kcf (the dead-load unit weight) | Table 3.5.1-1 / 5.4.2.4: use plain-concrete wc (0.145) for Ec. n is about 7% low. | Medium |
| :2777, :3003, :3107, :3327, PL:2177 | Lp = **1.1** rt√(E/Fyc), labelled 10th Ed. | 9th Ed. uses 1.0rt. **verify** the 10th Ed. change. PlateLine cites the 9th Ed. **[U]** if the 9th governs. | Low-Med |
| :2409 | Qn defaults to the 9th Ed. equation (Qn10 = 0) | The suite is labelled 10th Ed.; the tool itself warns. | Medium |
| :3055 | Section module uses only max permanent-load factors | Reversal near contraflexure not checked (disclosed). | Medium |
| :1176 | Splice: stiffener spacing d_o not validated | Blank → NaN "fail"; 0 → k = ∞ → C = 1 → V_n = V_p. **[U]** | High |
| :3196 | Service II flange check omits f_ℓ/2 | Eq. 6.10.4.2.2-2. | Low |
| :4155 | Saved `crack:'15'` silently changed to `'none'` on load | Analysis changes on reload. | Low |
| PL:2204 | PlateLine noncompact top-flange check uses DC1 only | Preliminary tool only. | Low-Med |
| :1093 vs :1684, :2646 | φc = 0.90 in splices, 0.95 elsewhere | Inconsistent (conservative). | Low |

**Verified OK (long list):**
- bolt Pt / Rn / slip / filler / bearing / block shear;
- the 8th Ed. splice method;
- web shear C and k with tension field;
- bearing and transverse stiffeners;
- stud Zr, pitch and Qn;
- overhang;
- D6.1 plastic moment cases;
- App. A6;
- fatigue 1.75/0.80 with ADTT infinite-life;
- all DF equations;
- HL-93 envelopes with the 90% two-truck case;
- cross-frame wind, U and slenderness;
- built-in `feVerify()` closed-form checks.

### 3.5 `Pile Designer.html`

| Location | What | Why | Conf. |
|---|---|---|---|
| :5359-5367 vs :2187, :2827, :2837, :2876, :1223-1226 | H-pile φ inputs (φc 0.53, φgeo 0.45, …) appear only in the report; the calculation uses hardcoded 0.60/0.70/0.95/0.80 and a fixed geotech φ table | A sealed report would show factors that were not used. No severe-driving φc = 0.50 option (6.5.4.2). | High |
| :1721-1741 | Casing Mn: no slender branch for 0.31E/Fy ≤ D/t ≤ 0.45E/Fy (uses Fy·Z); undefined above 0.45E/Fy | AASHTO 6.12.2.2.3: Fcr = 0.33E/(D/t)·S. The joint-doubled D/t makes thin casings hit this. **[U** ~2×**]** | High |
| :7787-7791 | Grade 150 bars fy = 150 | A722: fpu = 150, fy = 120 ksi. Tension, CFST and test-bar checks are 25% high. **[U]** | High |
| :2085-2090 | Punching perimeter `bo1 = π(OD + d_edge)` uses the pile-to-edge distance; φ = `phiV`, which presets set to 1.00 | 5.12.8.6.3 uses dv/2 from the face. The φ presets make punching about 11% unconservative. **[U]** | Med / High |
| :11063 | Envelope "D/C comb" shows `R.comb.ratio` (Po/Pe) instead of `.interaction` | The wrong number is printed in the summary table. | High |
| :2209-2215, :8943 | Davisson fixity reads hidden `nh`/`kh` defaults (60/150); the soil importer deletes them, giving NaN | Buckling ignores the actual soil, and is NaN after an import. | High |
| :1660-1671 | Uncased `fy = min(fyb, fyc)`, no 87 ksi cap, extra outer 0.85 | Not FHWA/AASHTO 10.9.3.10.2 as written. **[C]** but undisclosed in the report. | Medium |
| :774-777, :829-834 | "φc = 0.90 (6.5.4.2)" cited for steel-only compression | 8th Ed.+: 0.95. (Default 0.80 is conservative.) | Medium |
| :2147-2153 | Tension counts the full casing area through threaded joints | FHWA advises neglecting casing in tension unless the joint is qualified. **[U]** | Medium |
| :2701-2706 | Uncased flexure checked only at the casing tip | Larger moments below the tip are missed when typed-in LPILE values are used. **[U]** | Medium |
| :1861 vs :10577 | CFST Cp not capped at 0.9 in `computeAll`; `EI_aashto` uses cap f'c and the ACI Ec | Inconsistent. | Low-Med |
| :1224, :1290 | Clay tip φ 0.35 | Table 10.5.5.2.3-1 gives 0.40. **[C]** | Medium |
| :1587 | SVL entered but never checked | No service axial check. | Medium |
| :5555, :5641-5647 | LPILE import takes only load case 1 | Multi-case output is not handled. | Medium |
| :661 | Edition "relabelled from 9th Ed; article numbers to be confirmed" | All citations are 9th-Ed. based. | — |

**Verified OK:**
- grout-to-ground bond;
- pile-head bearing;
- tube compact/noncompact flexure;
- column curve;
- P-M interaction;
- CFST Po;
- Matlock / Welch-Reese / API / Reese sand / weak-rock p-y curves;
- Davisson closed forms;
- H-pile SPT/α/tip equations;
- Converse-Labarre;
- p-multipliers at 3B/5B.

### 3.6 `BasePlateAnchorDesigner.html` and `Concrete Anchor.html`

**BasePlateAnchorDesigner.html**

| Location | What | Why | Conf. |
|---|---|---|---|
| :1637-1638 | Pryout φ = 0.75 when shear rebar is present | Table 17.5.3: pryout is always Condition B (0.70). **[U]** about 7% | High |
| :1210-1213 | A_Nc built from **all** anchors; demand from tension anchors only | §17.6.2.1: projected area of the tension anchors. Example 2×2: +33%. **[U]** | High |
| :1306-1336 | Side-face blowout lacks the corner factor (1 + c_a2/c_a1)/4 | §17.6.4.1.1. Up to 2× high near corners. **[U]** | High |
| :1502-1505 | Plain-rod V_b uses Eq. (a) only | §17.7.2.2.1: the lesser of (a) and (b). **[U]** about 18% | Med-High |
| `shearBreakout` :1456-1630 | Narrow-member c_a1 limit §17.7.2.1.2 not implemented | **[U]** in narrow, thin pedestals | High (missing) |
| :555-570 | Seismic/Ω0 combinations generated, but no §17.10 (0.75 factor, ductility) | Disclosed in the manual only. **[U]** | High |
| :1238, :1320, :1486 | Condition A φ granted whenever rebar is "present" | Should require that the intercept check passes. **[U]** | Medium |
| :2227-2228 | Round HSS m/n use 0.95D | DG1: 0.8D for round. **[U]** | Med-High |
| :1038-1048 | Small-eccentricity bearing uses a trapezoid | DG1 uses a uniform block with Y = N − 2e. Unconservative for e > N/3. **[U]** | Medium |
| :1078-1092 | Large-eccentricity bearing DCR ≡ 1.00; `disc < 0` (plate too small) silently treated as OK | DG1 requires enlarging the plate. **[U]** | Med-High |
| :2579 | ψg = 1.15 for fy ≥ 80 | Table 25.4.2.5: 1.3 for Gr 100. **[U]** about 12% | High |
| :235 | A449 Fy/Fu fixed at 81/105 | Strength depends on diameter (92/120 ≤ 1 in; 58/90 > 1.5 in). | Med-High |
| :2312-2313 | Tearout assumes a standard hole | Anchor-rod holes are oversized (DG1 Table 2.3). **[U]** | Medium |
| :1104 | A2 ignores plate offset (not concentric) | ACI 22.8.3.2 / AISC J8. | Medium |

**Verified OK:**
- steel N_sa/V_sa with f_uta cap and 0.80 grout factor;
- pullout;
- N_b with alternate h_ef^5/3;
- ψ factors;
- h_ef reduction;
- shear breakout (a)/(b), A_Vco, ψ_ed,V, ψ_h,V;
- DG1 large-e equilibrium;
- t_p Eqs. 3.3.14/3.3.15;
- λ, X;
- hook development.

**Concrete Anchor.html**

This tool is weaker throughout:

| Location | What | Conf. |
|---|---|---|
| :156 | Gross area instead of A_se **[U ~30%]** | High |
| :476 | Plate Fy = rod Fy **[U]** | High |
| :533 | Dead Condition B checkbox (`conditionB` vs `condB`) | High |
| :206, :245 | Pullout/pryout φ would become 0.75 under Condition A (should stay 0.70) | High |
| :477 | Breakout demand = total N_ua, not Σ tension-anchor forces **[U]** | High |
| :101 | e'_N = M/N (not the ACI definition) | High |
| :222-234 | Shear breakout: Eq. (a) only; no ψ_ed,V / ψ_h,V / ψ_ec,V; A_Vc not clipped **[U]** | High |
| :211-220 | Side-face blowout: no corner or group factor **[U]** | High |
| :160-163, :232, :246 | Seismic 0.75 applied to steel and shear (318-11 rule, not 318-19) **[C]** | Med-High |
| — | Missing: f'c ≤ 10 ksi cap; h_ef reduction; alternate N_b; A_Nc ≤ nA_Nco | High |
| :479-480 | Interaction N + V ≤ 1.2 with no 0.2 cutoffs and no individual ≤ 1.0 gate on the headline | Medium |

A side-by-side comparison of the two anchor tools is in the reviewer notes; the main differences are captured in the table above.

### 3.7 `Concrete Beam Capacity.html` (suite), `ACI Rebar Development Length.html`, `Concrete Beam ASD.html`

**Capacity tab** (suite lines 53–4005)

| Location | What | Why | Conf. |
|---|---|---|---|
| :569, :577 | `f -= As·0.85fc` on compression steel inside the stress block (fs is negative) | The displaced concrete should *reduce* the compression force: `f += …`. Example: b = 10, h = 24, As = 5.0, A's = 1.24 @ 2.5 in, f'c = 4, fy = 60 → code εt = 0.00517 (φ 0.90), correct 0.00491 (φ ≈ 0.89). **[U]** | High |
| :607-616 | Tension-controlled limit 0.005 | ACI 318-19 Table 21.2.2: εty + 0.003. **[U]** Gr 80/100 | High |
| :945 | εt ≥ 0.004 beam check cites "ACI 9.3.3.1" / "AASHTO 5.6.2.1" | 318-19 9.3.3.1 — **verify** (believed εty + 0.003). AASHTO has no such limit. | Medium |
| :789 | AASHTO `Ec = 33000·wc^1.5·√f'c` | 8th/9th Ed. Eq. 5.4.2.4-1: 120,000·K1·wc²·f'c^0.33 (+9% at 4 ksi). | Med-High |
| :636 | β = 4.8/(1 + 750εs) always | Eq. 5.7.3.4.2-2: ×51/(39 + sxe) without Av,min. **[U]** | Med-High |
| :634 | εs does not enforce \|Mu\| ≥ \|Vu\|·dv | 5.7.3.4.2. **[U]** near supports | Medium |
| :631, :639, :999, :1037 | AASHTO Vc, Av,min and φ omit λ / lightweight | Matters if λ < 1. | Medium |
| :629, :658, :686-687 | √f'c not capped at 100 psi (ACI Vc without Av,min, torsion) | 22.5.3.1, 22.7.2.1. **[U]** for f'c > 10 ksi | Medium |
| — | fyt not limited to 60 ksi for shear/torsion | Table 20.2.2.4(a). **[U]** | Medium |
| :719-720 | `AtsFloor = 0.175·bw/(fyt·1000)` (SI coefficient with psi) | In.-lb form is 25·bw/fyt; about 143× too small. | High (units) |
| :1869 | γ3 = 0.67 hardcoded | 0.75 for A706. | Low |

**Rebar development** (standalone and embedded; identical code)

| Location | What | Conf. |
|---|---|---|
| — | Headed bars (25.4.4) not implemented | High (gap) |
| :392-393 | Compression ld omits ψr = 0.75 **[C]** | Low |
| :367 | AASHTO hook lightweight ×1.3 instead of ÷λ | Medium |
| — | No Ktr ≥ 0.5db check for fy ≥ 80 ksi; #14/#18 lap splices not blocked (25.5.1.1) | Medium |
| :518-520 | ψo option labels read backwards; two options share value 1.25 | Low |
| :1073-1077 | Dashboard checks that can never fail | Low |

**Verified OK:**
- 25.4.2.4a with ψt, ψe, ψs, **ψg 1.0/1.15/1.3**;
- 318-19 hook equation (db^1.5 form) with ψc;
- splices Class A/B;
- AASHTO 5.10.8 tension, hook and compression.

**Concrete Beam ASD** (standalone) and the suite ASD tab

| Location | What | Why | Conf. |
|---|---|---|---|
| :143-146, :132/:406 | Allowables (1200/20000/1900/28000) are fixed inputs; **fy input never used** | 8.15.2: fc = 0.40f'c; fs by grade. Correct only for 3,000 psi / Gr 40. Same in suite :4405. | High |
| :143 | Operating fc = 1,900 psi = 0.633f'c | MBE 6B: 0.60f'c (1,800). **[U]** unless MassDOT says otherwise. **verify** | Medium |
| :429-430 | n not floored at 6 (8.15.3.4) | — | Medium |
| — | Compression steel and ASD shear not modelled; not stated | — | Medium |

### 3.8 `Steel Beam Design - AISC 15th.html`, `Timber Beam Check.html`, `Shear and Moment Diagrams.html`

**Steel Beam Design**

The shape DB was spot-checked and matches AISC v16.0 exactly (W24X68, W14X90, W8X10 and four more). Material grades and E/G are correct.

| Location | What | Why | Conf. |
|---|---|---|---|
| :1698 | Web effective width uses c1/c2 = 0.22/1.49 | Table E7.1 case (a): 0.18/1.31. **[U]** with axial compression | High |
| :1415-1438, :389 | Built-up flag doesn't change λr (kc) | Table B4.1a/b cases 2/11. **[U]** for welded sections | Medium |
| :5366-5380 | H3.3 omits the buckling limit state; one torque applied to all combinations | **[U]** where LTB governs | Medium |
| :1902, :4407 | Axial tension ignored (no D2, no H1.2) | — | Medium |
| :4417 | A blocked flexure check becomes 0 in H1-1 (member mode) | — | Low |
| :1817-1829 | Calculated-Cb window clipped to the moment-sign region | Default Cb = 1 is conservative. | Low |

**Verified OK:**
- F2–F8;
- G2/G4/G5/G6 incl. φv = 1.0 rule and kv;
- E3/E4/E7 flanges;
- H1, H3.1;
- J10 WLY/WLC;
- Cb F1-1;
- composite Qn, Rg/Rp, plastic Mn, ILB;
- ASCE 7-16 basic combinations;
- stiffness analysis with load-point stations and per-span deflection.

**Timber Beam Check** (NDS 2018, ASD)

| Location | What | Conf. |
|---|---|---|
| :67-79, :381-382 | Base values are already No. 2, and a grade multiplier is applied on top; E/Emin don't vary with grade (Stud stiffness **[U]**) | High |
| :414 | CF uses the Beams & Stringers formula, not tabulated dimension-lumber CF | High |
| :408, :433-436 | CM = 0.85 on everything: Fc⊥ should be 0.67 (**[U]** about 27%) | High |
| :409, :420, :435 | Ct = 0.7 for all: wet 125–150 °F should be 0.5 (**[U]**) | Medium |
| :410 | Ci 0.80 applied to E, Emin, Fc⊥ **[C]** | High |
| :412, :371-373 | Flat use: Cfu applied, but edgewise S/I kept **[U]** | High |
| :413, :436 | Bearing-area factor Cb applied at an end support (NDS 3.10.4 forbids) **[U]** | High |
| :439-440, :462-464, :477 | Shear and bearing use the left reaction only **[U]** | High |
| :467-470, :482, :355 | Deflection ignores point loads; L/360 LL limit never applied | High |
| :332, :391, :565 | "D + Lr" offered but there is no Lr input (analyses D only with CD 1.25) **[U]** | High |
| :417-421 | le = 1.63lu + 3d always; RB ≤ 50 not checked | Medium |
| :675-680 | Headline DCR excludes bearing | Medium |
| :760-763 | Report moment shown 12× too small | High (display) |

**Shear and Moment Diagrams**

| Location | What | Conf. |
|---|---|---|
| :646, :1363 | Deflection limit uses total beam length, not span length **[U]** | High |
| :569-576 | No deflection for a cantilever (single fixed support) | High |
| :498, :638-639 | 401-point grid can clip peaks under point loads (small) **[U]** | Medium |
| :1360 | τ = 1.5V/A used with W-shape presets (about 35% low) **[U]** | High |
| :549, :628 | Envelope reports max reactions only (uplift missed) | Medium |
| :599-611 | Changing units relabels without converting | Medium |
| :1344 | "ΣR = ΣF ✓" is static text | Low |

The stiffness solver, fixed-end forces, couple sign convention, indeterminate beams and double-integration deflection were all verified correct.

### 3.9 `Retaining Wall Designer.html` and `Spread Footing.html`

**Retaining Wall Designer**

| Location | What | Why | Conf. |
|---|---|---|---|
| :7811-7841 | SI toggle overwrites inputs; engine is US-only | All results are meaningless in SI mode. | High |
| :1624-1626 | Coulomb Kp uses the backfill β and the back-face batter at the toe | Example: β = 20° raises Kp from 3.0 to about 5.7. **[U]** (passive off by default) | High |
| :1668-1669 | Coulomb thrust inclined at β, not δ | Example: δ = 0, β = 20° gives horizontal 6% low plus a spurious vertical credit. **[U]** | Medium |
| :1864, :1890, :1900 | Vertical EH component factored as EV (1.00 min) | Table 3.4.1-2 EH min 0.90. **[U]** | Med-Low |
| :1918-1956, :1815-1831 | Footing structural design and AASHTO bearing use the max-vertical case only | Strength Ia (min DC/EV) and ACI 0.9D + 1.6H are not checked. **[U]** | Medium |
| :1934-1935 | Default `q_n = 3·q_a`, φb 0.55 | Back-calculated nominal resistance. **[U]** if q_a is settlement-controlled. | Medium |
| :2193 | ACI As,min `max(0.0014, 0.0018·60000/fy)` | **verify** 318-19 Table 24.4.3.2 (believed 0.0018 flat). | Medium |
| :1471, :2295 | ψg = 1.0 hardcoded; cb ignores s/2 | 25.4.2.5, 25.4.2.4. **[U]** | Medium |
| :1539 | M-O fallback `Ka(1 + 1.5kh)` when φ − θ − β ≤ 0 | That condition means the backfill is unstable; should be an error. **[U]** | Med-Low |
| :1763 | Shear-key passive given a resisting overturning moment | The key is below the pivot. **[U]** | Low-Med |
| :1972-2015 | Collision CT defaults are MassDOT-specific (γ = 1.0 for DC/EV in EE II) | AASHTO γp min 0.90. **[U]** for non-MassDOT work. | Medium |
| :782 | Cohesion input unused | — | Low |

**Verified OK:**
- Rankine/Coulomb Ka, K0;
- h_eq table;
- load factors;
- sliding, eccentricity and B′ bearing;
- ACI and AASHTO Vc;
- Mcr minimum;
- crack control;
- T&S;
- ℓd and hooks (except ψg);
- interface shear;
- IBC 1807.2.3 FS.

**Spread Footing**

| Location | What | Why | Conf. |
|---|---|---|---|
| :2984 | `gfX = 1-(1-gvX)` = γv | Should be `1 − γv`. MfX/MfY about 33% low. **[U]** | High |
| :830, :849 | A live surcharge alone never activates L in combinations | It silently drops out. **[U]** | Med-High |
| :2913-2914 | Punching Vu doesn't add back self-weight/EV inside the perimeter | A few percent low. **[U]** | Medium |
| :920-922 | Sliding checked per axis, not on √(Hx² + Hy²) | Up to √2. **[U]** | Medium |
| :2391-2398 | ℓd fixes (cb + Ktr)/db = 2.5; ignores λ, ψg, ψe, √f'c cap | **[U]** | Medium |
| :2406 | √f'c not capped at 100 psi in Vc/vc | — | Low-Med |
| — | No mat max-spacing check | — | Low-Med |

**Verified OK:**
- Vesić Nq/Nc/Nγ with shape, depth and inclination factors;
- groundwater;
- B′/L′;
- biaxial no-tension bearing;
- ACI one-way Vc with λs and ρw;
- two-way vc;
- Jc;
- γv;
- concrete bearing;
- dowels;
- pedestal;
- rigidity criterion.

### 3.10 `abutment_calculator.html`, `Bridge Substructure Loading.html`, `elastomeric_design_module.html`

**abutment_calculator**

| Location | What | Why | Conf. |
|---|---|---|---|
| :1446-1478, :1689-1694, :1886-1890 | `e = B/2 − x̄` not absolute (see Top-26 #1) | 11.6.3.3 / 10.6.1.3 use \|e\|. **[U]** | High |
| :1557 | Seismic connection force 0.10(DC + DW), cited as AASHTO 3.10.9.2 | 3.10.9.2: 0.15 (As < 0.05) / 0.25. SubLoads uses 0.15/0.25. **[U]** | Med-High |
| :1616-1618, :2767, :2856 | T&S Eq. 5.10.6-1 with b = 12 in | b = least component width. Result almost always 0.11 in²/ft vs about 0.5. **[U]** | High |
| :1350-1354, :466 | One WS/WL set for Str III, Str V, Svc I at γ 1.0 | Wind speed differs by limit state (8th Ed.+). | Med-High |
| :1686-1688 | Toe/heel structural design uses uniform Meyerhof pressure | 10.6.5: trapezoidal/triangular for structural design. About 25% low at e = B/6. **[U]** | Medium |
| :1701-1705 | Heel demand mixes combinations | **[U]** | Medium |
| :1210, :1229 | Sloping backfill: no height increase or soil wedge over the heel | **[U]** | Medium |
| :1606-1608 | β = 2.0 on a thick stem without stirrups | 5.7.3.4.1 eligibility. **[U]** | Medium |
| :1804 | "Roughened" shear friction c/K1/K2 = 0.28/0.30/1.8 (slab-on-girder values) | General: 0.24/0.25/1.5. **[U]** | Med-High |
| :1350-1356 | No Strength IV | — | Medium |
| :1460-1462 | Bearing ignores transverse eccentricity | — | Low-Med |
| :1574 | `Ec = 1820√f'c` | Use the 10th Ed. equation (small effect). | Low |

**Verified OK:**
- h_eq;
- LS;
- Ka;
- γp max/min permutations;
- BR;
- eccentricity limits;
- sliding;
- pile distribution;
- flexure;
- crack control;
- punching;
- seat bearing;
- support length;
- M-O;
- TU pad shear.

**Bridge Substructure Loading (SubLoads)**

| Location | What | Why | Conf. |
|---|---|---|---|
| :1944 | Support-length % for Zone 2 = 100 | Table 4.7.4.4-1: 150% for Zones 2–4. **[U]** | Med-High |
| :2486, :2568, :2720 | At-rest earth pressure uses EH 1.50/0.90 | Table 3.4.1-2: at-rest 1.35/0.90. **[C]** | Medium |
| :1728 | Ice F = min(Fb, Fc) without the w/t ≤ 6 condition | **[U]** for wide piers | Low-Med |
| :1760, :2722 | γSH = 1.0 | 0.5 with gross stiffness. **[C]** | Low |
| :1449 | Service IV wind 0.75V with γ 1.0 | Believed consistent; **verify** (listed as an open item in the file). | Low |

**Verified OK:**
- lanes;
- MPF;
- HL-93 with the 90% two-truck case;
- BR;
- CE;
- wind Pz/Kz/skew tables;
- WL;
- vertical wind;
- temperature;
- stream flow;
- ice equations;
- seismic site factors;
- R;
- 100/30;
- connection force;
- combinations.

**elastomeric_design_module**

| Location | What | Why | Conf. |
|---|---|---|---|
| :349-355, :380-384 | Method B: γa,st ≤ 3.0 never checked | 14.7.5.3.3. **[U]** | High |
| :186, :349 | Da = 1.4 for circular | 1.0 for circular. **[C]** (+40%) | Med-High |
| :357 | Circular stability uses 0.886D square | 14.7.5.3.4: 0.8D. **[U]** | Medium |
| :350-351 | Method B rotation ignores transverse rotation | **[U]** | Medium |
| :369 | Method A σ ≤ 1.0GS (1.25GS if fixed) with 1.25 ksi cap | Current: 1.25GS ≤ 1.25 ksi. Mixed editions. | Med-High |
| :376, :477-478 | Plain pad: no G·S limit and no rotation check | **[U]** | Med-High |
| :371 | Method A circular uplift coefficient 0.375 | **verify**, believed 0.75. **[U]** | Medium |
| :186 | Method A uses G = 0.150 (not the least favourable) | **[U]** about 15% | Medium |
| :179, :293 | Construction rotation tolerance 0.03 rad | AASHTO 14.4.2.1: 0.005. **verify** MassDOT. | Low |
| — | Missing: cover ≤ 0.7hri, anchorage, Hbu report | — | Medium |

**Verified OK:**
- shape factors;
- hrt;
- Method B strain equations;
- stability A/B;
- reinforcement thickness;
- hrt ≥ 2Δs;
- Method A stability;
- thermal movement.

### 3.11 Other tools

**`Stone Masonry Arch Load Rating.html`**

| Location | What | Why | Conf. |
|---|---|---|---|
| :2419-2420 | SU6 axles sum to 72.5 k (label 34.75 t = 69.5 k); SU7 to 83.5 k (label 38.75 t = 77.5 k); axle order differs from MBE | Applied load ≠ nominal vehicle; tonnage output is inconsistent. | High |
| :1797, :1856 | Fill ≥ 2 ft: spread = tire patch + 1.75H | Std. Spec. 6.4.2: a square of 1.75H. About 30% less pressure at 3 ft. **[U]** | Med-High |
| :1797-1803 | One truck transversely; no adjacent-lane overlap | **[U]** for multi-lane barrels | Medium |
| :2016 | Rail impact `(1 − (H − 1.5)/8.5)·0.60` | **verify** against AREMA Ch. 8. | Low |
| :1187 | Barrel width 0 → SDL silently dropped | — | Medium |

**Verified OK:**
- kern / no-tension stress function;
- the bisection rating (convex);
- unit conversions;
- Timoshenko element;
- hinge/spring condensation;
- H20/HS20/Type 3/3S2/SU4/SU5/EV2/EV3/E-80 data;
- Std. Spec. 3.8.2.3 impact.

**`ASCE7-16 Load Generator.html`**

| Location | What | Conf. |
|---|---|---|
| :960-961 | C_vx uses elevation, not height above the base | High |
| :399-403 | Kzt: Lh not replaced by 2H when H/Lh > 0.5 **[U]**; 26.8.1 applicability not checked | High |
| :983 | Combination 3 missing "(L or 0.5W)" | High |
| :281 | Ce Roughness D sheltered = 1.2 (table: 1.0) **[C]** | Med-High |
| :357-358 | Concrete shear wall R values are building-frame values, not labelled (bearing wall R lower) **[U]** | Medium |
| :953 | `min(…, CsBase)` lets Cs drop below the 0.01 floor | Medium |
| :332-336, :917-927 | 11.4.3 default-D Fa ≥ 1.2 and Site B unmeasured rules not enforced; 11.4.8 exception only warned | Medium |
| :632-640 | Adjacent-roof drift extent 4hd (should be 6hd); no windward drift | Medium |
| :296-303, :722 | Roof Cp 45°–60° not interpolated **[U]** | Medium |
| :838 | Ch. 29 octagonal Kd 0.95 (table 1.00) **[U]** | Low-Med |

**Verified OK:**
- α/zg, Kz, Ke, qz, Kd, G, GCpi;
- wall and roof Cp, CN, Cf;
- snow pf, pm, Ct, Cs, unbalanced, drift;
- Fa/Fv tables;
- SDS, SDC, Ta, Cs limits, k;
- LRFD combinations 1, 2 and 4–7.

**`Light Pole and Sign Post.html`**

| Location | What | Conf. |
|---|---|---|
| :3558-3580 | Bolt and shaft demands only from the max-M combination (0.9D + W never used); bearing uses that combination's axial **[U]** | High |
| :2639, :3154 | No base-section check **[U]** | High |
| :1221-1255 | Sign Case C double-counts the 3s–10s strip for B/s ≥ 13 **[C]**, distorts eccentricity | High |
| :1137-1147 | Cable transverse wind reaction wh·L/2 omitted **[U]** | Med-High |
| :1180-1188 | Mast wind single resultant at qz(H/2) | Medium |
| :2562 | Monopost Case B/C torsion ignored (disclosed) **[U]** | Medium |
| :369 | Kd = 0.85 recommended for round masts (Table 26.6-1 round 1.0) **[U]** | Medium |
| — | No D/t ≤ 0.45E/Fy check; no E7 slender reduction; no P-δ / B1 **[U]** | Medium |
| :3033-3042, :3022, :3007 | No anchor shear breakout or side-face blowout; φ 0.75 labelled "Condition B"; A_Nc over all bolts **[U]** | Medium |
| :1113, :1190 | Wind-on-ice omits G **[C]** | Medium |

**Scope warning:** this tool is not an AASHTO LRFDLTS tool. It should not be used for highway signs, luminaires or signal supports.

**`Bridge Geometry.html`**

| Location | What | Conf. |
|---|---|---|
| :756-765 | Crown ↔ super transition jumps; no runout/runoff; controls only at substructure stations | High |
| :767, :4448-4453 | +rate raises the right side (undocumented); Example 4 is adverse | High |
| :3144 vs :1093-1133 | "Skew from alignment normal" is actually measured from the abutment-to-abutment chord normal (10.7° off radial for R = 800 / 300 ft) | High |
| :1113-1121 | `supportChordT` uses linear offset interpolation (0.78 ft pier error at R = 800 / 300 ft; 2.6 ft at 450 ft) | Med-High |
| :886-918 | Whole bridge is one straight chord (no curved or span-chorded girders) | High (behaviour) |
| :1069-1088 | Seat stack: gross camber; no flange-width cross-slope, VC ordinate or midspan haunch check | Medium |
| :3493-3502 | "meters" map units also rescale feet geometry by 3.28× | High (map only) |
| :519-527 | EPSG labels: 32111 is NJ metres (ftUS = 3424); 2802 should be 2250 (MA Island ftUS); parameters are correct | High / Med-High |

**Verified OK:**
- circular curves;
- clothoid (matches series to 1e-8 ft);
- vertical curves, high/low point, K;
- stations;
- DMS and quadrant parsing;
- US survey foot / international foot conversions;
- five proj4 zone strings.

### 3.12 `psbeam.html` and `stgirder.html`

**Editions.** psbeam states "AASHTO LRFD BDS (9th Ed. article numbering)" (:6603), with no year or interims. stgirder's footer says "10th Ed." (:4750), and the rest of the file cites articles only. The 10th Ed. Section 6 changes were **not** verified, so treat the stgirder label as unverified.

**psbeam.html**

| Location | What | Why | Conf. |
|---|---|---|---|
| :2002 (also :2609, :3067, :3087) | `ktd = t/(61 − 4f'ci + t)` | 2015 Interims and later (8th/9th Ed.) Eq. 5.4.2.3.2-5: `t/[12(100 − 4f'ci)/(f'ci + 20) + t]`. Small effect at typical f'ci. | Med-High |
| :2048-2049 **[spot-checked]** | Reversed fatigue truck `[[xm,32],[xm+14,32],[xm+44,8]]` puts the two 32 k axles 14 ft apart | Should be 32 (30 ft) 32 (14 ft) 8. Example: L = 120 ft gives Mfat +12%. **[C]** | High |
| :2975 | Interface-shear minimum Avf waived when vui/φ ≤ c (≈ 0.25 ksi) | 5.7.4.2 waives it only below 0.210 ksi. **[U]** | Med-High |
| :2961 | Interface shear checked only at the first three stations (bearing, dv, 0.1L) | Beyond the end zone (s = 18 in by default) the default design fails Avf,min but is never checked. **[U]** | Med-High |
| :2782, :2853, :3148 | Shear stations stop at 0.5L | The pier end of a continuous (MIDAS-imported) span is never checked. **[U]** | Med-High |
| :3208-3209, :3105 | Strength flexure, min reinforcement and rating are checked at midspan only (`flexFull` computed but unused for checks) | Harp/debond points and the continuous-span peak near 0.4L are missed. **[U]** | Medium |
| :2278-2283 | NEXT F DFs drop the Kg term and the skew c1 term; no exterior case | **[U]** | Medium |
| :1865, :1880-1881 | Effective width and deck DL use S·12 for exterior girders | 4.6.2.6.1: S/2 + overhang. (stgirder has the same issue.) | Medium |
| :3009 | Fatigue DF uses the interior one-lane formula for exterior girders | Use lever/rigid ÷ 1.2. | Medium |
| :3017-3024 | Strand fatigue Δf at the bottom fibre, ×1.5 if cracked; no 5.5.3.1 concrete fatigue check | Simplified. | Medium |
| :2593 | Refined-loss Δfcd omits the transfer-to-deck loss term **[C]** | — | Medium |
| :3104, :3115 | Rating φc·φs = 1.0 hard-coded; "HL-93 tons = RF × 36" | MBE has no HL-93 tonnage. | Medium |
| :2101-2108 | Lifting/hauling stability is a simplified FS, not PCI/Mast | — | Medium |
| :2678, :2810 | No λ anywhere; no 0.3 ksi cap on 0.0948√f'c | Normal-weight only. | Low |
| :2675 | Release compression 0.65f'ci | Correct for 8th/9th Ed. (0.60 before 2017). Make it an input if an owner requires 0.60. | Info |

**Verified OK (psbeam):**
- Ec (5.4.2.4);
- elastic shortening;
- approximate lump-sum losses with γh and γst;
- refined loss factors except ktd;
- stress limits;
- fps = fpu(1 − kc/dp) with the T-section test, and φ transition;
- Mcr with γ1/γ2/γ3;
- MCFT β, θ, Vc, Vn cap, smax, Av,min;
- longitudinal tie;
- splitting and confinement;
- HL-93 with the 90% two-truck case;
- I-girder DFs;
- Strength I and Service III factors;
- MIDAS shear sign flip (:2408-2418).

**stgirder.html**

| Location | What | Why | Conf. |
|---|---|---|---|
| :1606-1608, :2008-2018 **[spot-checked]** | Imported MIDAS `V_DC2`/`V_DW` (and `V_DC1`) are used **without** the sign flip psbeam applies, then summed with the app's own self-weight/DC1 shear | Opposite sign conventions partly cancel, so **Vu at supports is under-stated**. Also affects constructibility shear (:2201), web fatigue `Vperm` (:2283) and the shear rating (:2370). **[U]** | Med-High |
| :1950, :2098, :2126 | With the deck off, positive flexure is checked against Rb·Rh·Fyc (no LTB) | A noncomposite girder needs 6.10.8.2 Fnc (FLB/LTB with Lb). **[U]** | Med-High |
| :2266 | Infinite/finite-life crossover ignores the 1.75/0.80 ratio | Switches at ~161 instead of ~1,680 trucks/day (Cat. C). **[C]** | High |
| :2357 **[spot-checked]** | Infinite-life stud Zr = 5.5d²/2 with γ = 1.75 | Since the Fatigue I/II split, 6.10.10.2 gives Zr = 5.5d² for Fatigue I. About 2× the studs required. **[C]** | Med-High |
| :2359, :2284 | Stud and web fatigue use the **moment** one-lane DF and the HL-93 truck at the support | Use the shear DF (often ~1.5× larger) and the fatigue truck. **[U]** | Medium |
| :2278 | Fatigue range always from the simple-span fatigue truck, even with continuous demands | Negative-moment details not checked. | Medium |
| :1941 | No Mn ≤ 1.3RhMy cap for continuous spans (6.10.7.1.2) | **[U]** | Medium |
| :2412 | Ductility Dp ≤ 0.42Dt checked only for compact sections | 6.10.7.3 applies to all composite sections. | Medium |
| :1769 | rt uses D instead of Dc **[C]** | — | Medium |
| :1766, :1549, :1939 | Fyr ignores Fyw; Rh always uses the top flange as Afn; Rb uses short-term Dc | Hybrid-girder details. **[U]** (small) | Low |
| — | Flange lateral bending fℓ ignored everywhere (constructibility overhang brackets, Service II, Strength) | Acceptable only for straight, low-skew girders; not flagged. | Medium |
| :2342-2344 | Strength stud count ignores the 6.10.10.4.2 continuous-span requirement | — | Medium |
| :2366-2383 | No Service II rating; φc·φs = 1.0; RF mixes capacity and demand locations | — | Medium |
| :3065, :1455 | `shored` checkbox has no effect | Dead input. | Medium |
| :2183, :2325, :2330 | Stiffener width / end-panel spacing checks computed but never pushed to `checks` (never FAIL) | — | Medium |
| :2299 | Stiffener Fys = 50 hard-coded | Should be an input. | Low |

**Verified OK (stgirder):**
- proportion limits;
- transformed and cracked sections, staged stresses;
- D6.1 plastic moment, Dp/Dt reduction;
- Rh and Rb formulas;
- web bend-buckling;
- FLB and LTB equations;
- Service II 0.95/0.80RhFyf;
- constructibility;
- shear C/Vn/Vp;
- fatigue constants, N, p, γ 1.75/0.80, IM 15%, fatigue-truck layouts;
- stiffener rules;
- bearing stiffener;
- stud Qn and P;
- LL deflection.

---

## 4. Bugs and robustness

### 4.1 Cross-tool storage and data-flow issues

| # | Issue | Files / lines | Impact |
|---|---|---|---|
| S1 | **Same storage keys used by two copies of one app.** The suite's Dev tab and the standalone rebar app both use `rebar_aci_autosave_v1` / `rebar_aci_projects_v1`. The `srcdoc` iframes inherit the parent's origin. | `Concrete Beam Capacity.html:5274-5275`; `ACI Rebar Development Length.html:226-227` | The two overwrite each other's autosave. Two open tabs saving projects race (last writer wins). |
| S2 | **Generic, unprefixed keys** | `Light Pole and Sign Post.html:5553, 5624` (`activeTab`); `Shear and Moment Diagrams.html:1641` (`beamProSaves`, `beamProAuto`); `Spread Footing.html` (`sfd_auto`, `sfd_projects` — prefixed but short) | No collision today. Any future tool writing `activeTab` would **blank the Light Pole results area** (a foreign value hides every tab). |
| S3 | **stgirder's `BridgeApps` block is an old version** (no per-folder `at` map, no self-link guard); its header claims it is byte-identical to the others | `stgirder.html:525-614` vs `psbeam.html:616-761` / `index.html:298-417` | Each time ST-Girder opens it erases the per-folder app-path memory, re-creating the cross-folder mis-link the newer code fixed. Diffs: `BridgeBeam`, `BridgeProjects`, `BridgeLocks`, `BridgeGeometryChanges` are identical in all files that have them; `BridgeHandoff` differs only in comments (index). |
| S4 | **Steel and PS demand hand-offs share `_schema` and `handoffId`** | `index.html:132, 138, 145` | Publishing one flavour overwrites the other. ST-Girder can adopt a payload with no `section` block. |
| S5 | **Hand-off payload does not state whether IM and/or DF are included** | `index.html:1630-1874`, `:3164-3171`, `:7326` | Design apps must assume. psbeam's combo note says "DF and IM applied", but the MCT applies IM only. |
| S6 | `psSection` and `lldf` read without a `_schema` check | `index.html:6024-6027, 6139, 6596` | Malformed data is accepted. |
| S7 | `psbeam` publishes `psSection` on every recompute, without a lock | `psbeam.html:7297-7324` | A second psbeam tab overwrites what MCT and LL&DL follow. |
| S8 | **Quota.** `bridgeSuite.v1.projects` stores full MIDAS envelopes per app; `handoffs` is never pruned; GirderDetail, ASCE7 (3-D image data URL) and Bridge Geometry (overlay images) also store large blobs. Chromium gives all `file://` pages **one ~5 MB quota**. | psbeam :489-490, :7578; stgirder :4572; Steel Bridge :6440; ASCE7 :4197, :4259; Bridge Geometry :4243 | Autosave failures are **swallowed silently** in several tools. Once the quota fills, *every* tool's autosave stops. |
| S9 | Unwrapped `localStorage.setItem` (throws on quota or blocked storage) | ACI Rebar :1262, :1276; elastomeric :601; abutment :4157; ASCE7 :4221; PlateLine PL:4179-4180 | Uncaught error on Save. |
| S10 | Unchecked `postMessage` origin (`'*'` targets, no `e.origin` / `e.source` check) | index :407, :20046; lldf :768, :780; abutment :4253, :4258; elastomeric; GirderDetail :6578, :6587 (can trigger "Design all"); Concrete Beam Capacity relay :6470-6480 | Low risk on `file://`, but any framed page can push values. |
| S11 | **Abutment ↔ elastomeric hand-off mismatches**: circular pad returns `padL/padW = null`, so the abutment keeps its old rectangular area but takes the new G/hrt; rectangular dims sent in are ignored because `padType` stays circular; `thermalFactor` is sent as NaN | elastomeric :654, :660; abutment :1124, :4244, :4258 | Inconsistent bearing shear force. |
| S12 | `subloads-abutment-v1` export has no importer | SubLoads :2381-2470 | Manual re-entry. |
| S13 | Suite ASD tab receives As/d from the governing LRFD combo (possibly hogging) while defaulting to positive moment; it also overwrites the ASD title block | `Concrete Beam Capacity.html:3969-3980, 5031` | Wrong section passed. |

### 4.2 Per-tool runtime bugs and broken features

| File | Bug | Line(s) | Severity |
|---|---|---|---|
| `Retaining Wall Designer.html` | US/SI toggle corrupts inputs (§3.9) | 7811-7841 | High |
| `Concrete Beam ASD.html` | **Save JSON throws** (`getElementById('calc-name')` doesn't exist) | 727 | High |
| `Concrete Beam ASD.html` | Load JSON: no try/catch; selects and checkboxes not restored | 738 | Medium |
| `Concrete Beam ASD.html` | Malformed SVG `<line>` (missing `/>`) swallows the "Steel" label | 711 | Low |
| `Concrete Anchor.html` | Dead Condition B checkbox | 533 | High |
| `Concrete Anchor.html` | JSON load without try/catch, so a bad file **blanks the page** | 465 | Medium |
| `Timber Beam Check.html` | Save drops point loads, bearing, unbraced length, all factor toggles, notch, custom size, creep; `wWind` saved but not restored | 497-516 | High |
| `Timber Beam Check.html` | Inputs with no UI (`wRoofLive`, `deflLimitTL/LL`, `selfWeight`, `manualProps`); `addMaterial` copies DF-L with no edit | 332, 355, 495 | Medium |
| `Timber Beam Check.html` | Point-load location not limited to the span | 440, 449 | Medium |
| `elastomeric_design_module.html` | Thermal "Span length" input dead (`.replace('data-path','data-path data-rot')` empties the path) | 534 | High |
| `elastomeric_design_module.html` | Thermal inputs lose focus on every keystroke | 441, 615 | Medium |
| `elastomeric_design_module.html` | `includeIM`, `thermalFactor` toggles and `VALID` table unused | 205-220, 295 | Low |
| `stgirder.html` | Optimize tab **crashes** (TypeError) when a swept size fails `computeAll` | 4153-4166 | Medium |
| `stgirder.html` | Report shows φMn = 0 for noncompact sections | 4209 | Low |
| `psbeam.html` | No strands → NaN everywhere; sp = 0 → As = ∞; imported DF of 0 becomes 1.0 | 2332, 2786, 2234, 2510-2512 | Medium |
| `index.html` | RIDOT vehicles have **no axles**, so the MCT is malformed | 1290-1305, 3138-3146 | High |
| `index.html` | Blank lane name **silently drops all PS-Beam LL combos** from the MCT | 7319, 2817, 3215 | High |
| `index.html` | Blank engineer name / material grade **crashes** MCT download | 20472, 2997 | Medium |
| `index.html` | MIDAS result parser drops empty cells, so columns shift silently | 9176-9198 | Medium |
| `index.html` | Combo names truncated to 20 chars can collide | 2795-2802 | Medium |
| `index.html` | `nidOf` returns node 101 when x is not found | 2919-2922 | Medium |
| `index.html` | `DEFAULT_CFG` hard-codes `projectUser:'HDR'`, a date and a MIDAS version | 18791-18793 | Low |
| `Pile Designer.html` | Envelope "D/C comb" column shows the wrong field; `tenR` reads non-existent fields | 11063, 11065 | High |
| `Pile Designer.html` | Soil JSON import deletes `nh/kh`, so buckling becomes NaN | 8943, 2209-2215 | High |
| `Pile Designer.html` | Blank field → NaN saved as `null`, which overrides defaults on reload | 3395, 5775-5778 | Medium |
| `Pile Designer.html` | `revokeObjectURL` immediately after `click()` can cancel the manual download | 5300 | Low |
| `Spread Footing.html` | Same immediate-revoke pattern on export | 2341-2344 | Low |
| `Spread Footing.html` | Stale note says structural design is "not yet checked" | 1175 | Low |
| `Steel Bridge Beam Modules.html` | Splice d_o not validated; 1-bolt web group gives NaN; 1-bolt cross-frame gives U = 0; stud 1 in option not in selector | 1176, 1333, 2647, 4921 | Medium |
| `Bridge Geometry.html` | Switching a row to Curve leaves R = 0, so all output becomes NaN; spiral L = 0 gives NaN; duplicate PVI stations divide by zero | 2889, 4093, 737 | Medium |
| `Bridge Geometry.html` | No CSV or print for the Top-of-Deck / Beam-Seat tables (the deliverables) | — | Medium |
| `Shear and Moment Diagrams.html` | Blank E or I silently becomes **1**; rollers silently converted to pins | 602, 522 | Medium |
| `Moving Load Generator.html` | **No persistence at all**; E ≤ 0 unguarded; several functions redefined later in the file (dead code) | 376, 868-1388 | Medium |
| `Steel Beam Design - AISC 15th.html` | About 15 functions defined more than once; only the last runs (maintenance trap) | see §3.8 | Low |
| `Bridge Substructure Loading.html` | `combine` redefined four times by later patches (order-dependent) | 1556, 1756, 2565, 2744 | Low |
| `Stone Masonry Arch Load Rating.html` | Span/rise not validated (rise = 0 gives NaN geometry); user-facing storage note says Chrome isolates each file (wrong) | 9534, ~11985 | Low |
| `lldf.html` | Slab type publishes per-foot strip factors in the same `gM/gV` fields as per-girder factors | 1908, 3108 | Medium |

### 4.3 Input validation (zero / negative / blank)

Most tools convert a blank input to `0` (or `NaN`) silently. The worst patterns:

- **Blank shown as a plausible result.** `Light Pole and Sign Post.html:869` `fmt()` prints NaN/∞ as **"0.00"**, so a broken result looks like zero. **Fix first.**
- **`|| default` hides legitimate input or bad input:**
  - Retaining Wall :2956-2988 cannot accept 0 for η, φτ, φep, φb or γe (0 becomes 1.0).
  - Timber `bearingLen||3.5`.
  - S&M E/I `||1`.
  - psbeam DF `||1`.
- **Silent substitution:** `Concrete Beam ASD.html:425-426` replaces f'c ≤ 0 with 3,000 and d ≤ 0 with 20 without telling the user.
- **Divide-by-zero → NaN/∞ reaches the output with no message:**
  - lldf (span, t_s, bay spacing, depth);
  - Pile (OD, φgeo, tc ≤ corrosion);
  - Base plate (C.H = 0 drops shear breakout from the governing scan via `isFinite` filtering, :4300, :4416);
  - Concrete Anchor (sx = 0, f'c ≤ 0);
  - Light Pole (H, bolt qty, b, post spacing);
  - elastomeric (hri, G, n, tSteel);
  - Retaining Wall (fy, f'c blank);
  - Moving Load (E ≤ 0).
- **Good examples to copy:**
  - `Spread Footing.html:747-790` (range checks with errors and warnings);
  - `abutment_calculator.html:510-571` (hard and soft VALID ranges);
  - `Concrete Beam Capacity.html:1305-1325` (blocking errors);
  - `Steel Beam Design` span/mechanism checks.

### 4.4 Offline / locked-down laptop behaviour

The CLAUDE.md requirement is "runs by double-clicking on a locked-down work laptop". Every tool except `Moving Load Generator.html` (no dependencies) and `lldf.html` (KaTeX inlined; fonts optional) needs **internet access to CDNs**. If the work network blocks a CDN, the behaviour varies:

| Behaviour without CDN | Tools |
|---|---|
| **Blank page** (React/Babel apps) | `index.html`, `psbeam.html`, `stgirder.html`, `Pile Designer.html`, `Concrete Anchor.html`, `Timber Beam Check.html` |
| **Layout collapses** (Tailwind Play CDN) | `Concrete Anchor.html`, `Concrete Beam ASD.html`, `Timber Beam Check.html`, `Pile Designer.html` |
| Calculations run; equations and/or charts degrade | Arch, abutment, elastomeric, SubLoads, Spread Footing, Retaining Wall, Steel Beam, S&M, ASCE7, Light Pole, Base Plate, Concrete Beam Capacity, Rebar, Bridge Geometry (no map) |

**Recommendation (needs your decision):** confirm which CDN hosts the work laptop can reach. cdnjs, jsdelivr, unpkg, cdn.plot.ly, esm.sh, cdn.tailwindcss.com and fonts.googleapis.com are all used today. Limiting new work to one or two of these would reduce risk. Inlining libraries (as lldf.html does with KaTeX) is the only way to be fully offline, and it costs file size.

---

## 5. Consistency

| Area | Current state | Worth standardising |
|---|---|---|
| **Code edition labelling** | Ranges from explicit and correct ("AASHTO LRFD 10th Ed. (2024)") to absent (index, lldf, Moving Load, arch, ASD, S&M). Several files **mix** editions (GirderDetail 9th/10th; Pile "relabelled from 9th"; Light Pole ASCE 7-22 vs ASCE7 tool 7-16). | One visible "Basis" line per tool naming spec + edition + owner manual, printed on every report. |
| **Load factors that changed across editions** | Fatigue I/II: 1.75/0.80 in Moving Load, GirderDetail, stgirder, psbeam; **1.50/0.75 in index.html**. | Align index.html. |
| **Units** | All tools are US customary. Retaining Wall has a broken SI toggle. S&M relabels units without converting. Concrete Anchor uses lb/psi while BasePlate uses kip/ksi. The Dev/ASD frames use psi while the Capacity frame uses ksi. | Stay US-only. Remove or fix the RW toggle. Make S&M convert or lock units. |
| **Math rendering** | KaTeX 0.16.9 (12 files), 0.16.11 (6; Concrete Beam Capacity loads both), 0.17.0 inlined (lldf); **MathJax 3** (Retaining Wall, GirderDetail). | KaTeX at one pinned version. |
| **Charting** | Plotly 2.26.0 / 2.27.0 / 2.32.0 / 2.35.2 / basic 2.27 / basic 2.35.2 / **basic 3.7.0**; Chart.js 4.4.1 (index). Concrete Beam Capacity loads two Plotly builds. | One pinned Plotly 2.35.2 build (full or basic). |
| **3D** | three r128 / 0.128.0 (7 files, incl. legacy `examples/js` controls) vs 0.160.0 (3 files). OrbitControls loaded from jsdelivr while three comes from cdnjs (SubLoads, RW, GirderDetail). | Leave pinned. Don't bump without testing (`examples/js` is gone in newer three). |
| **UI framework** | Vanilla JS (most); React + in-browser Babel (index, psbeam, stgirder, Concrete Anchor, Timber); React precompiled (Pile); Tailwind Play CDN (4 files). | No change needed, but avoid in-browser Babel and Tailwind Play in new work. |
| **Save / load** | localStorage autosave + named projects + JSON (most). File-only (Concrete Anchor, ASD, Timber). **None** (Moving Load). IndexedDB (index, Pile). | Every tool: autosave + JSON export/import with a `_schema`/`_version` tag. |
| **Storage key naming** | `x_v1_y`, `x.y.v1`, `x_y_v1`, `xY`, `activeTab`, `sfd_auto`, `stgirder.session` (unversioned). | Convention for *new* keys only: `<toolprefix>.<thing>.v<N>`. **Do not rename existing keys** (CLAUDE.md §5). |
| **Import validation** | Some check `_schema` / `app` (SubLoads, bridgeSuite, Bridge Geometry `version`); many accept any JSON (Spread Footing, abutment, BasePlate, Pile ignores `_version`). | Check a format tag on import and warn on mismatch. |
| **Print / report** | Popup report window (index, RW, Moving Load, arch); `window.print()` with print CSS (most); print CSS but **no button** (stgirder, Timber); **no print at all** (Bridge Geometry). | Each tool: a Print button and a print stylesheet including the title block and basis line. |
| **Title block** | Many have project/by/checked/date blocks; ASD, Concrete Anchor, Timber, Moving Load do not. Hard-coded defaults exist: "HDR" (index), "MBTA — Mini-Highs" (Concrete Beam Capacity), author names (Steel Beam, GirderDetail). | Common title-block fields; neutral defaults. |
| **Pass/fail display** | D/C ratios with colour mostly. Several tools hide NaN (`fmt`) or show "—". Light Pole shows NaN as 0.00. | NaN/∞ must display as an error, never as 0 or blank-pass. |
| **Default friction / min steel** | RW ACI default μ = tan φ vs Spread Footing tan(⅔φ). As,min 0.0018·60/fy (RW) vs 0.0018 flat (SF). | Align after confirming the 318-19 values. |
| **Naming** | File names vs app titles differ: "Steel Bridge Beam Modules" = GirderDetail + PlateLine; "Moving Load Generator" = BridgeLoad Pro; "Timber Beam Check" = Universal Timber Design Studio; `index.html` = MCT generator, not an index. | A README listing file ↔ app name. Rename files only with an explicit decision (links depend on names). |

---

## 6. Outdated / risky dependencies

Package metadata was checked against the npm registry on 2026-10-03.

| Library / source | Used in | Version | Concern | Risk |
|---|---|---|---|---|
| **Tailwind Play CDN** (`cdn.tailwindcss.com`) | Concrete Anchor, Concrete Beam ASD, Timber (**unpinned**); Pile (3.4.5) | — | Officially "not for production"; compiles CSS at runtime; the unpinned URL can change under the page; needs network. | **High** |
| **`@babel/standalone` (unpinned)** | Concrete Anchor, Timber (unpkg) | resolves to latest 7.x (7.29.9 today) | An unpinned URL will follow a future Babel 8 and could break JSX. In-browser compile is slow. | **High** |
| **React 18 *development* UMD, `react@18` unpinned** | Concrete Anchor | latest 18.x | Dev build (slow, console warnings). React 19 removed UMD builds, so the `@18` pin must not be loosened. | Medium |
| **esm.sh** (React 18.2 + lucide-react 0.292) | Timber | — | Less established CDN that transforms modules on the fly. | Medium |
| **`lucide@latest`** | Timber | latest (1.51 today) | Unpinned and apparently unused. | Medium |
| **`@phosphor-icons/web` (unpinned)** | Concrete Beam ASD | latest | Unpinned. | Medium |
| **pdf.js 3.11.174** | BasePlateAnchorDesigner (jsdelivr), Pile Designer (cdnjs) | 2023-09 (current 6.4) | **CVE-2024-4367:** arbitrary JS execution when opening a crafted PDF, fixed in 4.2.67. Neither file sets `isEvalSupported:false` (the documented mitigation). Exposure only when importing a PDF from an untrusted source. | **Medium** |
| **SheetJS `xlsx` 0.18.5 (cdnjs)** | Bridge Substructure Loading | 2022 | Last version on public CDNs; known prototype-pollution / ReDoS advisories when **parsing** untrusted files (fixed only on SheetJS's own CDN). Used here for export, so low exposure. | Low |
| **MathJax `@3` (major-only pin)** | Retaining Wall, Steel Bridge Beam Modules | floats within 3.x | Minor updates could change rendering. | Low |
| **Pyodide 0.26.4 + `micropip.install('ezdxf')` (unpinned)** | SubLoads, Steel Bridge Beam Modules (DXF layouts only) | — | Downloads about 10 MB+ plus an unpinned PyPI package at run time; fails behind proxies. An R12 fallback exists. | Low-Med |
| **three.js r128** (incl. `examples/js/...`) | index, Bridge Geometry, SubLoads, RW, Pile, GirderDetail, abutment (0.128.0) | 2021 (current 0.186) | Old but pinned. `examples/js` UMD files no longer exist in modern three, so the version **cannot** be bumped without rewriting to ES modules. Fine to leave. | Low |
| **three.js 0.160.0 `build/three.min.js`** | BasePlate, Spread Footing, Concrete Beam Capacity | 2023-12 | **The file exists** (verified in the npm tarball; a reviewer's concern that it 404s is unfounded). It is the deprecated UMD build: do not bump past 0.160 without switching to ES modules. | Low |
| **KaTeX 0.16.9** | 12 files | 2023-10 (current 0.19) | Security advisories fixed in 0.16.10 concern untrusted TeX input with `trust` options; not relevant here, since input is author-controlled. Mixed 0.16.9/0.16.11/0.17.0 across files. | Low |
| **Plotly** 2.26.0–2.35.2, plotly-basic **3.7.0** | many | 2023–2026 | Fine, but five different versions. Bridge Geometry is the only file on Plotly 3 (a major version with API changes). | Low |
| **proj4js 2.11.0**, **Leaflet 1.9.4**, **Chart.js 4.4.1**, **ExcelJS 4.4.0**, **React 18.2/18.3.1 prod** | various | — | Current or stable, pinned. | Low |
| **USGS `aashto-2009` design-maps web services** | Bridge Substructure Loading :2016, :2035 | — | Legacy endpoints that USGS has been retiring; manual entry is the fallback. The 2023 AASHTO dataset is not offered (the file's own open item). | Medium |
| **Google Fonts** | 9 files | — | Non-critical; falls back to system fonts. | Low |
| **Map tiles** (OSM, Esri World Imagery) | Bridge Geometry | — | Network; usage-policy limits for heavy use. | Low |
| **No Subresource Integrity (SRI)** on any CDN tag | all | — | A compromised CDN file would run in the tool. Adding `integrity=` hashes for pinned versions is cheap. | Low-Med |

---

## 7. Recommended work plan

Each item is one PR touching one tool (per CLAUDE.md), unless noted. The order is: calculation correctness first, with unconservative, high-confidence items before conservative ones; then bugs; then consistency; then nice-to-haves.

**Risk** is the chance the change itself introduces a problem or alters results you rely on:
- **L:** a local, obvious fix.
- **M:** touches a shared calculation path; needs before/after check cases.
- **H:** broad behavioural change, or needs an engineering decision first.

Items marked **❓** need your decision on the provision, edition or owner rule before work starts.

### Phase A — Calculation correctness (unconservative first)

| # | Tool | Task | Risk |
|---|---|---|---|
| A1 | `abutment_calculator.html` | Use \|e\| for eccentricity, B′, and rock q_max side (mirror the pressure diagram) | M |
| A2 | `Spread Footing.html` | `gfX = 1 − γv` (one-line fix) | L |
| A3 | `Concrete Beam Capacity.html` (Capacity tab) | Fix displaced-concrete sign for compression steel (:569, :577) | M |
| A4 | `Concrete Beam Capacity.html` (Capacity tab) | ACI εt,tension-controlled = εty + 0.003; ❓ confirm 318-19 9.3.3.1 beam strain limit | M |
| A5 | `Pile Designer.html` | Grade 150 bars fy = 120 ksi (catalog only) | L |
| A6 | `Pile Designer.html` | Casing flexure slender branch (0.33E/(D/t)·S) and a hard error above 0.45E/Fy | M |
| A7 | `Pile Designer.html` | Wire the H-pile φ inputs into the calculation (or remove them from the report); add φc 0.50 severe driving ❓ | M |
| A8 | `Pile Designer.html` | Envelope "D/C comb" shows the interaction ratio; fix `tenR` field names | L |
| A9 | `Concrete Anchor.html` | ❓ Decide: fix (A_se, plate Fy input, `condB` binding, pryout/pullout φ 0.70, breakout demand, shear (b) + ψ factors, side-face factors) **or** retire in favour of BasePlateAnchorDesigner. Recommend: add a "not for design" banner now (L), then decide. | L / H |
| A10 | `BasePlateAnchorDesigner.html` | Pryout φ always 0.70; ψg 1.3 for Gr 100 | L |
| A11 | `BasePlateAnchorDesigner.html` | Side-face blowout corner factor; A_Nc from tension anchors only | M |
| A12 | `BasePlateAnchorDesigner.html` | Round HSS 0.8D; plate-too-small (`disc<0`) as a blocking error; plain-rod V_b min(a,b) | M |
| A13 | `BasePlateAnchorDesigner.html` | Narrow-member c_a1 limit §17.7.2.1.2; seismic banner when Ω0/seismic combos are on | M |
| A14 | `Steel Bridge Beam Modules.html` | d_o validation in the splice module (the stud-pitch item was withdrawn: 4d is correct under the 10th Ed.) | L |
| A15 | `stgirder.html` | Negate imported MIDAS shears (match psbeam :2408-2418); add a check case with a MIDAS file | M |
| A16 | `stgirder.html` | Noncomposite (deck-off) positive flexure uses 6.10.8.2 Fnc; 1.3RhMy cap for continuous spans; ductility for all sections | M |
| A17 | `stgirder.html` | Shear DF and fatigue truck for stud and web fatigue; replace the old `BridgeApps` block with the current copy (sync snippet, list the four files) | M |
| A18 | `psbeam.html` | Interface shear along the full span and the 0.21 ksi waiver; shear stations to the full span; flexure check over `flexFull` | M |
| A19 | `index.html` | Correct `ROLLED_SHAPES` tf/bf/tw from the AISC DB | L |
| A20 | `index.html` | Correct legal/posting/EV vehicles (MBE App. D6A, FHWA EV) ❓ (confirm MassDOT vehicle set) | M |
| A21 | `index.html` | `mctCarriesImpact` aware of GFS mode / per vehicle | M |
| A22 | `index.html` | Fatigue I/II 1.75/0.80; fatigue truck in the library; DF ÷ 1.2 and IM 15% in the fatigue rating | M |
| A23 | `index.html` | Service II / PS Service III: apply DF·IM; staged section moduli ❓ (scope) | H |
| A24 | `index.html` | HL-93 variable rear axle and the 90% two-truck case in the MCT ❓ (MIDAS modelling approach) | H |
| A25 | `index.html` | φc·φs ≥ 0.85 floor; permit γLL table; remove the 0.7·Mn+ placeholder or flag it | M |
| A26 | `Light Pole and Sign Post.html` | `fmt()` shows NaN as an error (do first); check all combinations for bolt tension / shaft P-M (0.9D + W); add a base-section check | M |
| A27 | `Light Pole and Sign Post.html` | Cable transverse wind reaction; Case C double count; anchor shear breakout and side-face blowout; φ label | M |
| A28 | `Retaining Wall Designer.html` | Disable the SI toggle (or convert in `getInputs`) with a migration for SI-autosaved values ❓ | M |
| A29 | `Retaining Wall Designer.html` | Coulomb thrust inclination (δ, not β); passive Kp with level toe; EH vertical factor; Strength Ia / 0.9D footing case; M-O unstable → error | M |
| A30 | `ASCE7-16 Load Generator.html` | C_vx height above base; Kzt 2H substitution; combination 3 "(L or 0.5W)"; Cs floor logic; roof Cp interpolation | M |
| A31 | `Timber Beam Check.html` | ❓ Decide: rewrite factor tables (grades, CF, CM, Ct, Ci, Cfu, Cb) and the reaction/deflection logic, **or** retire. Recommend a "not for design" banner first. | L / H |
| A32 | `elastomeric_design_module.html` | γa,st ≤ 3.0 check; plain-pad G·S and rotation; 0.8D stability; Da by shape; Method A limits per current edition ❓ | M |
| A33 | `abutment_calculator.html` | T&S b = least width; seismic connection 0.15/0.25 (align with SubLoads); roughened shear-friction values; trapezoidal pressure for toe/heel | M |
| A34 | `abutment_calculator.html` | Wind per limit state; Strength IV; sloping-backfill height/wedge | M |
| A35 | `Bridge Substructure Loading.html` | Zone 2 support length 150%; at-rest EH 1.35 | L |
| A36 | `Stone Masonry Arch Load Rating.html` | SU6/SU7 axle data; ❓ wheel-spread basis (tire patch vs 1.75H square) | L / M |
| A37 | `Spread Footing.html` | Live surcharge activates L; punching body-weight add-back; resultant sliding; ℓd per 25.4.2.4 | M |
| A38 | `Concrete Beam Capacity.html` (Capacity tab) | AASHTO β 51/(39+sxe) and Mu ≥ Vu·dv; Ec 9th Ed.; √f'c ≤ 100 caps; fyt ≤ 60; torsion At/s coefficient | M |
| A39 | `ACI Rebar Development Length.html` **and** the embedded copy | AASHTO hook ÷λ; Ktr ≥ 0.5db for Gr 80+; block #14/#18 laps (sync both copies in one PR, by your exception to one-tool-per-PR ❓) | M |
| A40 | `Concrete Beam ASD.html` / suite ASD tab | Allowables from f'c/fy; n ≥ 6 ❓ (MassDOT operating fc) | M |
| A41 | `Steel Beam Design - AISC 15th.html` | E7 web c1/c2 = 0.18/1.31; built-up λr | L |
| A42 | `Shear and Moment Diagrams.html` | Port per-span deflection limit, load-point stations and cantilever deflection from the Steel tool; correct τ for W shapes | M |
| A43 | `lldf.html` | Exterior fatigue rigid floor; warnings for d_e / θ clamps | L |
| A44 | `Moving Load Generator.html` | Warn when the fatigue truck is used with strength DF/LLF; label HS20 "truck only" | L |
| A45 | `Bridge Geometry.html` | Superelevation transition (continuous linear rotation, runout/runoff stations); document the sign; fix Example 4; skew datum label or engine ❓ | H |
| A46 | `Bridge Geometry.html` | `supportChordT` exact intersection; "meters" map scaling; EPSG labels | M |

**Conservative-but-not-per-code items** (lower priority; they change results in the less-conservative direction, so each needs your sign-off):
- stgirder fatigue crossover and stud Zr = 5.5d²;
- psbeam fatigue truck layout and ktd;
- SubLoads γSH;
- elastomeric Da;
- Pile clay tip φ;
- index AREMA L_ref default;
- Light Pole ice G.

### Phase B — Bugs and robustness

| # | Tool | Task | Risk |
|---|---|---|---|
| B1 | `Concrete Beam ASD.html` | Fix Save JSON (`calc-name`), Load try/catch, SVG tag | L |
| B2 | `index.html` | RIDOT vehicles without axles (block or define); lane-name mismatch; guard `projectUser`/`materialGrade`; parser column shift; combo-name collisions | M |
| B3 | `elastomeric_design_module.html` | Dead thermal span input; focus loss; abutment hand-off (circular `D`, `padType`, `thermalFactor`) — coordinate with an abutment PR | M |
| B4 | `stgirder.html` | Optimize tab crash; stiffener width/spacing checks to FAIL; `shored` input wired or removed | L |
| B5 | `Pile Designer.html` | Keep `nh/kh` on import (or compute from soil); NaN-as-null on reload; defer `revokeObjectURL` | L |
| B6 | `Timber Beam Check.html` | Save/load all inputs (if the tool is kept) | L |
| B7 | `Bridge Geometry.html` | Guard R = 0 / L = 0 / duplicate PVI; CSV + print for the elevation tables | M |
| B8 | `Concrete Beam Capacity.html` | Storage collision with the standalone rebar app. ❓ Options: migrate the embedded copy to new keys with a one-time copy (preserves data), or accept shared data and document it. | M |
| B9 | `Light Pole and Sign Post.html` | `activeTab` → keep reading the old key but validate the value (ignore unknown tab names). Don't rename the key without a migration. | L |
| B10 | each tool listed in §4.1 S9 | Wrap `setItem` in try/catch and show a visible "autosave failed (storage full)" banner | L each |
| B11 | `index.html` / `psbeam.html` / `stgirder.html` | Add `imIncluded` / `dfIncluded` flags to the demands payload (additive field, backward compatible); separate `_schema` for steel | M (multi-file — needs your OK) |
| B12 | all tools with blank → 0 inputs | Visible input errors for zero/negative/blank where they cause ∞/NaN (one tool per PR; start with Light Pole, lldf, Concrete Anchor, elastomeric) | L each |
| B13 | `Moving Load Generator.html` | Add autosave + JSON save/load | L |
| B14 | tools with postMessage | Check `e.source` against the expected frame or window | L each |

### Phase C — Consistency

| # | Task | Risk |
|---|---|---|
| C1 | Add a visible "Basis: spec / edition / owner manual" line to every tool and its print output (one PR per tool; no calculation changes) | L |
| C2 | Remove unpinned URLs: pin `@babel/standalone`, React, `lucide`, `@phosphor-icons/web`, Tailwind Play; pin MathJax to an exact 3.x | L |
| C3 | Converge on a single KaTeX version (0.16.11) and Plotly version (2.35.2), tool by tool, with visual checks | L-M |
| C4 | Print button + print CSS for stgirder, Timber and Bridge Geometry | L |
| C5 | Import validation via a format tag on JSON import, warning on mismatch (Spread Footing, abutment, BasePlate, Pile `_version`) | L |
| C6 | Neutral default title-block values (remove "HDR", "MBTA — Mini-Highs", etc.) ❓ | L |
| C7 | Retire or label `Concrete Beam ASD.html` as superseded by the suite ASD tab ❓ | L |
| C8 | Align ASCE 7 edition per tool, and make combos consistent where tools overlap ❓ | M |

### Phase D — Nice-to-haves

| # | Task | Risk |
|---|---|---|
| D1 | README with a file ↔ app-name table, what each tool is for, and the bridge-suite relationships | L |
| D2 | A launcher page (a new file, e.g. `tools.html`) linking every tool by discipline. Do **not** repurpose `index.html`, which is the MCT generator and is referenced by name. | L |
| D3 | Folder reorganisation per §2.2, one group per PR, after D1/D2, with a storage note | M |
| D4 | One verified vehicle table, copied into each tool that has vehicles (index, arch, Moving Load, SubLoads, GirderDetail) | M |
| D5 | SRI `integrity=` hashes on CDN tags | L |
| D6 | pdf.js: set `isEvalSupported:false` (BasePlate, Pile), or upgrade to ≥ 4.2.67 | L |
| D7 | Moving Load Generator ↔ lldf hand-off (read `bridgeSuite.v1.lldf`) | M |
| D8 | SubLoads `subloads-abutment-v1` importer in the abutment calculator | M |
| D9 | Bridge Geometry: degree-of-curve input, spiral elements report, station equations, curved/per-span girder chords | H |
| D10 | Offline packaging decision: which libraries (if any) to inline, as lldf does with KaTeX ❓ | H |

### Questions for you before Phase A starts

1. **Editions.** Which editions govern your work today? AASHTO LRFD 9th or 10th; MBE edition; ACI 318-19 or a later version; ASCE 7-16 vs 7-22 (building tools); and any MassDOT manual dates. Several findings flip between "bug" and "fine" depending on this (e.g. Lp = 1.1rt, Method A bearing limits, Fatigue I/II).
2. **Retire or fix.** `Concrete Anchor.html` and `Timber Beam Check.html` have the most fundamental problems. Retire, banner, or fix?
3. **Shared-snippet PRs.** May syncing a shared snippet (the rebar app + embedded copy; the `bridgeSuite` bootstrap) be done in one PR across the files that contain it, as an exception to one-tool-per-PR?
4. **CDN reachability.** Which CDN hosts are reachable from the locked-down work laptop?
5. **MassDOT-specific values** that look non-standard and should be confirmed:
   - operating fc 1,900 psi (ASD);
   - elastomeric construction rotation 0.03 rad and combined-strain limit 4.75;
   - collision CT distribution and γ in Extreme Event II (Retaining Wall);
   - abutment seismic connection force 0.10.
