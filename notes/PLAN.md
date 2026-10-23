# Plan: merge GirderDetail + ST-Girder into one Steel Bridge Design tool (2026-10-22)

## Key facts
- GirderDetail ("Steel Bridge Beam Modules.html", vanilla JS, MathJax/three/Plotly) already embeds the Preliminary sizing app (PlateLine) as text in `<script type="text/plain" id="pl-src">` (l.1267–8005), run in a srcdoc iframe (plSrc/plShow 16023–16031), postMessage bridge (gdFromPL, GD_PLQ/GD_RQ). This is the house pattern for a second app in one file.
- ST-Girder (stgirder.html) is one babel/JSX script (543–5345); engine computeAll 1499–2297; App 5060; 16 tabs (inputs, section, construct, stresses, flexure, shear, diagrams, camber, deck, fatigue, stiff, conn, rating, optimize, nomen, report).
- Direct mounting would clash on 9 global names (CR_OPTS CR_REFS GRADES SG crEsc crJump crOpts crPageCSS crTitleBlock) + CSS.
- GD already holds 3 6.10 implementations (PL runChecks 2637, GM.gs 10431, FE engine duplicated in frame 3155–3359 and host 12195–12399; host feCb unused).

## Inventory
GD: owner selector, Design all, Girder report, 3D, DXF (Pyodide+ezdxf), Print, mode Preliminary/Design modules, Suggest, title block; modules pl, df, sa, gs, fa, splice, bstf, ts, sc, cf, oh, wt; per-module tabs Summary/Combos/Capacity/Stress/Checks/Drawings/3D/Geometry/Manual/Report; calc report (buildCalcReport 14902); auto-design (runAutoDesign 13741).
PL: Summary, Checks, Schedule, Analysis, Alternatives, Suggest, Drawings, Manual; report; undo; profiles.
ST: 16 tabs; built-in HL-93/LLDF (hl93 1247, distFactorsSteel 1265, loadsCalc 1299); deck slab design (deckDesign 1444, GD has none); LRFR Inventory/Operating incl. Service II rating (~2150–2215; GD only GS20); Optimize; Camber; Nomenclature; CalcDoc report (ReportTab 4859); PNA-below-web handling; owner rules/utilities/GDL/GDX overlays from GD payload (gdXfer 1110, gdOverlay 1175); export/import JSON; undo/redo; DISC notice.
Hand-offs: GD reads projectMeta, lldf; writes projectMeta, girderDemands (GD_ST 12881, gdStPayload 12960), superReactions(+.by.girderdetail, GD_SR 13053). ST reads girderDemands; writes appPaths['stgirder'] (425–466) read by gdStHref 13039. index/lldf/psbeam/SubLoads refuse ST-produced payloads.
Keys: GD girderdetail_autosave_v1 / _projects_v1 / _inbox_v1; PL plateline_autosave_v1 / _projects_v1 / _profiles_v1 / _last_v1 / plateline_undo_v1; ST stgirder.session, stgirder.ui.v1, stgirder.inputTab.v1, stgirder.disconnect.v1 (+ legacy bridgeSuite.v1.projects slices; stgirder.projects/lastproj unused).
Links: tools.html 69–70; text mentions in index, lldf, psbeam, SubLoads 3306/3484, Gusset 2892, abutment 870; docs; tests compare.mjs 17/73/75, lib.mjs 62, suggest.mjs 19.

## Overlap matrix (GD vs ST)
Ec same (K1=1); modular ratio n DIFFER (GD exact/round option vs ST max(6,round)); Mp+ agree when rebar excluded & same flange grade; Mp−/A6 GD only; Rh same form (GD per-flange Fy); Rb possibly differ; Fnc identical (GD adds γe nonprismatic, per-location Cb/Lb); Fcrw differ only Dc/D<0.05; shear C/Vp/k identical but basis DIFFERS (GD tension field interior panels, ST Vcr conservative); load factors DIFFER (GD max/min by sign, ST max only); studs Qn identical; stud Zr likely same (verify); LLDF verify; constructibility DIFFERS (continuous Con vs 1.5w simple span); fatigue same when imported; Service II agree; deflection/camber different sources; stiffeners different scope.
Unique: ST deck design, LRFR rating, Optimize, Nomenclature. GD splices, cross-frames, welds, overhang, DF, FE, DXF, 3D, Suggest, Design all.

## Recommended architecture
GD host; ST embedded verbatim as a third frame (`st-src`, lazy srcdoc iframe, same pattern as PL), new "Design & rating (ST-Girder)" view in the Girder group with girder selector; in-memory payload via postMessage (same gdAdopt path → identical results); keep all keys (srcdoc shares origin). Shims: host file name for BridgeXfer.stamp/appPaths; #gdpull replaced by message; check print in frame. Keep file name "Steel Bridge Beam Modules.html", title "Steel Bridge Design". stgirder.html → small redirect/notice page at cut-over (needs engineer OK).

## Efficiency (within single-file rule)
Module registry (GM+MODS → one registry incl. frame modules); frameBus(name) generalising gdPlPost/GD_PLQ/gdFromPL; section banners; one project file {app:'SteelBridgeDesign',v:1,gd,pl,st} with numbered migrations (import still accepts all old formats); A610 namespace for proven-identical functions only (property test ~10k sections, exact equality); one FE engine copy; remove dead code (host feCb, ST LS_PROJ/LS_LAST); one deriv() helper; tests: compare --tool st full R + tab text; new --tool sbd.

## PR plan (0–6 change no engineering result)
0 tests/baselines; 1 embed ST in GD (verify sbd == stgirder.html on all payloads; gd unchanged); 2 in-memory link + girder selector + "Update" banner; 3 one title block + combined report/print; 4 one project file + migrations; 5 efficiency (FE dedupe, A610 identical-only, registry/frameBus, dead code); 6 cut-over (stgirder.html redirect, tools.html one card, docs, tests); 7 optional: KaTeX→MathJax in ST, then tab-by-tab vanilla port to drop React/Babel. Unifying any differing calc = separate §4 PR after engineer decision.

## Decisions
1 file name (default keep, retitle); 2 stgirder.html after cut-over (default redirect page); 3 known calc differences (default keep each, unify later item by item); 4 GD changes → ST (default "Update" banner); 5 vanilla port (default later).
