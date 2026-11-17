/* apps/crane-pick/ui/manual.js — the Manual output tab (window.CranePickManual). Engineer request 2026-11-17: "We should also add a manual
   or a tab that explains how to use the app." Built like the suite's other manuals (Spread Footing "User Manual", Timber "Method & Manual"):
   the text lives in this file (it versions with the code), the tab has a filter box and prints on its own; the Report takes it as an
   optional appendix (the "Include this manual in the Report" box, off by default, as Spread Footing's Include box).
   Content: PARTS (parts → topics → blocks). Blocks: { p: text } | { ul: [text…] } | { ol: [text…] } | { key: text } (a highlighted note) |
   { tbl: { head: […], rows: [[…]…] } }. Inline: **bold**; links [[target|label]] with target
     in:<input tab id>[>card heading | #element id]   an input tab (and the card whose heading starts with that text, or the element)
     out:<output tab id>[>card heading | #element id] an output tab (and card)
     rpt:<report key>                                the Report section / subsection where the value is worked (shared/report.js jump)
     man:<topic id>                                  another topic of this manual
   Every target is checked by tests/smoke/crane-manual.mjs (tab, card and Report key resolve). No calculation here: the methods are
   summarised and link to the Report section where each is worked (CLAUDE.md §6). */
(function () {
  'use strict';
  const A = window.CranePickApp, esc = A.esc;

  const PARTS = [
    { id: 'start', title: '1. Quick start', topics: [
      { id: 'qs', title: 'Quick start: a lift in ten steps', blocks: [
        { p: 'The app is a lift-planning aid: you draw the site, place cranes from your crane library and drag the crane, the pick and the set. Every number follows live and is worked in the Report. The crane manufacturer\'s chart for the machine, the lift plan and the site checks govern.' },
        { ol: [
          '**New project.** [[in:proj>Save and open|Project tab → Save and open]]: **New**, then fill the [[in:proj>Title block|title block]] (printed at the top of the Report). **Save as…** names it in this browser\'s list.',
          '**State Plane zone.** [[in:site>Coordinate system|Site & map tab → Coordinate system]]: choose the zone of the project (MA Mainland ftUS or m, Connecticut, Rhode Island). Positions are State Plane grid coordinates; changing the zone later keeps every item at the same place on the ground. Use [[in:site>Go to|Go to]] with a latitude / longitude or a State Plane coordinate to find the site (there is no address search).',
          '**Base map or plan sheet.** [[in:site>Base map|Base map]]: Satellite (Esri), Street (OpenStreetMap) or None. For a drawing, open [[in:sheets>Plan sheets|Plan sheets → Add plan sheet…]] (PNG, JPG or a PDF page).',
          '**Align to map (2 points).** On the sheet\'s card press **Align to map…** and click point A on the sheet, the same point A on the map, then point B on the sheet and B on the map. The sheet is scaled, rotated and placed; check the scale and rotation shown, then **Done**. See [[man:wf-sheets|Plan sheets]].',
          '**Draw the site.** [[in:draw>Draw|Site items tab]] (the same tools are on the Draw bar above the map): obstructions (with height or top elevation), power lines (enter the **voltage** and the lowest wire height), buried utilities / culverts / walls (depth to top or top elevation), exclusion zones, labels and dimensions.',
          '**Cloud sync token (crane library access).** The crane library is read from the engineer\'s private GitHub repository with the Cloud sync token: [[in:proj>Save and open|Project tab → Save and open]] → **Saved projects…** → **Cloud sync (GitHub)…**: paste a token that can read the private library repository (Structural_References) as well as write your projects repository. See [[man:tr-notfound|GitHub "Not found"]].',
          '**Load the library, add a crane.** [[in:cranes>Crane library|Cranes tab]]: **Load crane library from GitHub** (or **Load crane file(s)…**). In the library list press **Add to project**; the crane card appears under [[in:cranes>Cranes in this project|Cranes in this project]]. Read its source document, revision and terms.',
          '**Place the crane, the pick and the set.** On the crane card press **Place on the map** (or [[in:lifts>Crane setups|Lifts tab → Place at the map centre]]). Drag ✥ to move the crane and ↻ to turn it; drag **P** (pick) and **S** (set). In the setup card choose the chart, the boom length and enter the crane pad elevation; in the pick card enter the load, rigging, hook block and other deductions.',
          '**Read the results.** The live card on the [[in:lifts|Lifts tab]] and the labels on the map show R, the chart capacity C and the % of chart at the pick, the set and the governing point. The [[out:picks|Picks tab]] lists every pick (with heights and the closest 3D clearance), the [[out:summary|Summary tab]] every lift, the [[out:crane|Crane tab]] the crane as the analysis uses it; the elevation / 3D dock under the [[out:plan#elevDock|map]] shows the boom and clearances.',
          '**Ground, then issue.** [[in:ground>Ground and supports|Ground tab]]: the allowable bearing pressure and the mat under each float (the crane\'s weights and CGs on its card for "entered data" loads). Then the [[out:rpt|Report]] (Print report), the [[out:dwg|Drawings]] (Download DXF, Print sheets) and **Save** / **Export JSON** on the [[in:proj>Save and open|Project tab]].'
        ] },
        { key: 'Every change is one Undo step (header, Ctrl+Z / Ctrl+Y). The project is autosaved in this browser while you work, but autosave is not a saved project: use Save or Export JSON.' }
      ] }
    ] },
    { id: 'work', title: '2. Workflows', topics: [
      { id: 'wf-single', title: 'A single pick', blocks: [
        { ol: [
          'Add the crane to the project ([[in:cranes>Cranes in this project|Cranes tab]]) and check the configurations, their rating basis (% of tipping; enter it where the chart notes do not state it) and the working-area zones (over-front / over-rear half-angles, from the chart\'s working-area diagram; not set = the 360° or over-side chart is used).',
          '**Place on the map**. In the [[in:lifts>Crane setups|setup card]]: the **Chart** (configuration group), **Boom length** (the tabulated lengths are listed: a length between them reads the next longer column), **Crane pad elevation**, heading and rotation point (or drag ✥ / ↻).',
          'In the pick card: **Load**, **Rigging (slings, spreader…)**, **Hook block** (from the crane\'s list or entered) and **Other deductions** with what they are. The chart\'s deduction notes are shown beside them: deduct everything they require. **Swing**: shortest, clockwise or counter-clockwise.',
          '**Heights** (for hook reach and 3D clearances): ground elevation and load bottom at the pick and the set, load height / length / width, rigging height (hook to load top), hook block height, and the load bottom during the swing.',
          '**Add a pick** adds another pick to the same setup. Drag P and S on the map: the live card shows the pick, the set and the governing point along the swing, the thresholds and every flag. [[in:lifts>Lift settings|Lift settings]] hold the caution / critical / limit % and the path model.',
          'Check the [[out:picks|Picks tab]] (worked steps under each row), the elevation / 3D dock and the [[out:ground|Ground tab]]; the [[out:crane|Crane tab]] draws the crane with every value the analysis uses and where it comes from (file, entered or assumed — assumed in amber). The Report has the pick in [[rpt:lifts|§Lifts]].'
        ] }
      ] },
      { id: 'wf-tandem', title: 'A tandem girder lift', blocks: [
        { p: 'A girder (or two girders with cross-frames, lifted as one object) carried by two cranes from the truck to the bearings, or by one crane.' },
        { ol: [
          '[[in:tandem>Girder lifts|Girder lifts tab]]: **New tandem lift** (or **New one-crane girder lift**). For crane 1 and crane 2 choose a crane setup, or **Place for crane 1** / **Place for crane 2** to place a new one; each setup\'s chart, boom and position are edited on the Lifts tab.',
          '**Girder**: length L, weight, **CG from end A**, the CG offset across (it shifts the hooks in plan) and the CG height (information only), depth H, width in plan. Tick **Paired girders with cross-frames** for two girders lifted as one object (each girder\'s weight and CG, the cross-frame weight and the spacing).',
          '**Hook 1 / Hook 2**: the **lifting point from end A**, spreader length (drawn), rigging weight, hook block, other deductions, rigging height and hook block height. The load share follows from the CG and the lifting points with plumb hooks.',
          '**Path**: the pick pose on the truck and the set pose on the bearings (centre E / N, heading A→B, girder bottom elevation), the travel elevation and **Add a waypoint** for a path around obstacles. On the map drag P / S, ↻ (turn), ◆ (CG), H1 / H2 (lifting points) and W1… (waypoints).',
          'Read the result: load share, the governing step of each crane (% of chart against the **tandem limit**, set in [[in:tandem>Girder lift settings|Girder lift settings]], default 75 % per crane), heights, crane–crane distance, girder level, clearances and ground per crane. The **scrubber** (step slider and **Play**) moves the girder along the path on the map, in the elevation and in 3D.',
          'The girder lift is listed on the [[out:picks>Girder lifts|Picks tab]] and in [[rpt:tandem|Report §Tandem lifts]].'
        ] }
      ] },
      { id: 'wf-route', title: 'A trucking route', blocks: [
        { ol: [
          '[[in:route>Draw|Route tab → Draw]], one of three ways to give the path of the tractor\'s **steer-axle centre**: **Snap to road (OpenStreetMap)**: click a start point, any via points and an end point near the roads, then Enter or **Finish**: the app gets the OpenStreetMap roads of the area (Overpass API, cached in this browser) and the route follows the roads by the shortest path (one-way roads are a warning only: escorted convoys). **Trace**: press and drag along the road on the aerial. **Route**: click points; double-click or Enter ends it.',
          'The line is then fitted with an **alignment** of tangents and circular curves: a gentle road curve is **one curve with its real radius**, a corner (e.g. a junction) is an **intersection turn** with the route\'s default radius. The route card\'s **Alignment** shows the line\'s source and road names, the curve table (No., kind, R, Δ, L, PC / PT stations, off-tracking), the smallest radius against the vehicle\'s minimum and the largest deviation of the line from the alignment. Type a radius or change a kind in the table; on the map drag a **PI**, a curve\'s round **radius handle** or a "+" handle (adds an intersection turn); **Add intersection turn** then a click adds one where a true turn happens; **Refit from the line** starts again; **Fit settings** (tolerance, detection window, …) refit. For an OpenStreetMap route, tick the right-hand travel lane to offset the road centreline by half a lane width.',
          'Routes saved before 2026-11-17 keep **Each vertex is a turn with the radius entered (legacy)** (Curves list) and compute exactly as before; choose **Fitted alignment** to fit them.',
          'In the route card: the default radius (intersection turns; legacy: the vertices), the **Vehicle** (tractor + semi-trailer, stretch trailer, steerable rear dolly, or jeep + dolly; wheelbases, overhangs, widths, minimum turning radius, deck height), **Weights and axles**, and the **Load on the trailer**: link a **Girder lift** (its girder gives the load) or enter the load; or **Delivers to pick** for a single pick.',
          'Drag the PIs (legacy: the route\'s points): the **swept path** (off-tracking of the trailer, the load\'s swing-out at turns) is re-simulated live against obstructions, exclusion zones, crane footprints and power-line buffers.',
          'Draw the **marks**: **Overhead clearance (point)** or **Overhead clearance (line)** (with its clearance height above the road), **Haul road / mats** (width, allowable bearing, mats), **Posted bridge** (postings in tons). Overhead power lines are checked with the travel clearance (OSHA Table T).',
          '**Staging**: the girder on the truck at the stop is compared with the girder lift\'s pick pose (tolerance 2 ft, 2°); **Move the girder lift\'s pick pose to the girder on the truck** aligns them.',
          'Results on the [[out:route|Route output tab]] (the alignment and curve table, curves / turns, conflicts, overheads, axle loads, haul road, posted bridges, staging) and in [[rpt:route|Report §Route]].'
        ] }
      ] },
      { id: 'wf-terrain', title: 'Terrain (preliminary, USGS 3DEP)', blocks: [
        { ol: [
          '[[in:terrain>Terrain (USGS 3DEP)|Terrain tab]]: choose the **Area** (the map view or the site extent) and the **Grid spacing** (5 ft default), then **Fetch terrain for this site**. The browser asks the USGS 3DEP service directly (internet needed); the grid is kept in this browser only.',
          '**Use terrain for ground elevations** (turned on by a fetch): the crane pad (the levelling datum under the crane), the pick and set ground and the depth of buried items come from the terrain when not entered. An entered value always overrides; elevations are then NAVD 88, US survey feet.',
          '**Levelness**: per crane, the **Level tolerance** (enter the crane manual\'s requirement; default 1 %), **Blocking limit** (default 24 in) and **Levelling datum**. A badge on the map follows each crane as you drag it.',
          '**Pad grading**: pad length, width and elevation → cut / fill estimate. **Route profile**: maximum grade (default 8 %), grade base length, the load / deck underside height and the ground clearance margin.',
          '[[in:terrain>Map|Map]]: contours (interval) and slope colours; the cursor box shows the ground elevation. Results on the [[out:terrain|Terrain output tab]] and in [[rpt:terrain|Report §Terrain]].'
        ] },
        { key: 'Preliminary terrain (USGS 3DEP, about 1–3 m data): not adequate to certify crane levelness or grades. Survey data governs.' }
      ] },
      { id: 'wf-sheets', title: 'Plan sheets (image or PDF)', blocks: [
        { ol: [
          '[[in:sheets>Plan sheets|Plan sheets tab]] → **Add plan sheet…**: a PNG or JPG, or a PDF (choose the page and the resolution: 3,000 / 5,000 / 7,000 px on the long side; a lower resolution is usually enough). The sheet is placed at the map centre.',
          '**Align to map (2 points)** (the main way): **Align to map…**, then four clicks: A on the sheet → A on the map → B on the sheet → B on the map (the sheet fades so the map shows). The card shows the scale, the rotation and A–B on the sheet against the map; a warning appears when the points are too close or the scale is more than 2 % off a calibration. Until **Done** you can drag the markers; Esc / Cancel leaves the sheet as it was.',
          'Alternatives: **Scale calibration** (**Pick two points…** a known distance apart, then the distance) and **Georeference** (**Pick two points…** with their State Plane coordinates). On an aligned or georeferenced sheet a calibration is kept as a check only.',
          '**Replace image…** swaps the drawing (a new revision) and keeps its ground size. **Opacity**, **show**, **lock**; move and rotate handles while the Plan sheets tab is open. **Move the items drawn on this sheet with it** (on by default): items lying wholly on the sheet follow an alignment or georeference.',
          'The images stay in this browser (IndexedDB), not in the saved-project list or on GitHub. [[in:sheets>Images in this browser|Images in this browser]]: tick **Include the plan-sheet images in Export JSON** to carry them in the file; **Clean up unused images…** frees space. The worked scale steps are on the [[out:site|Site tab]] and in [[rpt:sheets|Report §Plan sheets]].'
        ] }
      ] },
      { id: 'wf-aerial', title: 'Crane symbols and the aerial site plan', blocks: [
        { p: 'Every crane is drawn as a schematic plan symbol from its crane file (the same on the [[out:plan|map]], the [[out:dwg|Drawings]], the DXF and the [[out:crane|Crane tab]]): carrier with axles and wheels, or carbody and tracks with tumblers; outrigger beams and floats (true size) at the chart\'s spread; the upperworks, operator cab and counterweight (rear corners on the tail-swing radius) turned to the pick; the boom (telescopic sections or lattice chords) to the hook, the hook block and the load L × W. Dimensions the file does not give are assumed and listed on the crane card ([[in:cranes|Cranes tab]]). Drawing only: the checks use the engine footprint, radii and heights.' },
        { p: 'The [[out:dwg|Drawings]] add **SITE PLAN - AERIAL** sheets (tick **Aerial site-plan sheets**): one for the whole site and one per lift, with the Esri World Imagery under the site items, cranes, booms, swing paths, girder poses, routes and power-line buffers, and the imagery attribution. Offline or blocked, the sheet says "aerial not available" and prints without it. The DXF (R12) holds no image: **Download aerial image (PNG + world file)** gives the PNG and a .pgw in the DXF\'s coordinates (attach it in CAD); **World file in State Plane coordinates** places the same PNG in grid coordinates. The [[out:plan|Plan tab]]\'s ⎙ button prints the current map view the same way. Imagery date varies; not a survey.' }
      ] }
    ] },
    { id: 'tabs', title: '3. What each tab does', topics: [
      { id: 'tab-in', title: 'Input tabs (left; below the map on a phone)', blocks: [
        { ul: [
          '[[in:proj|Project]]: Save and open (Save, Save as…, Saved projects…, New, Export / Import JSON, Cloud sync), the title block, notes.',
          '[[in:site|Site & map]]: the State Plane zone, the base map, Go to a coordinate, Show all items.',
          '[[in:sheets|Plan sheets]]: add, align, calibrate and georeference drawings; opacity, lock; the images kept in this browser.',
          '[[in:draw|Site items]]: the drawing tools and the list of site items; the selected item\'s properties and vertex coordinates (computed values such as the OSHA clearance, with a link to where they are worked).',
          '[[in:cranes|Cranes]]: the crane library (GitHub, files, or a pasted chart), the cranes in this project (source, terms, configurations, rating basis, zones, plan and elevation geometry, weights for outrigger loads), the sync-repository warning.',
          '[[in:lifts|Lifts]]: the lift settings (thresholds, interpolation, path model, obstruction clearance), the crane setups and their picks, and the live result card with worked steps.',
          '[[in:ground|Ground]]: per crane setup the allowable bearing pressure and the mat / plate; per buried item an optional allowable stress; the map layer of ground pressures.',
          '[[in:tandem|Girder lifts]]: the tandem limit, girder lifts (cranes, girder, hooks, path), the scrubber and the live result.',
          '[[in:route|Route]]: route and mark drawing tools (Snap to road from OpenStreetMap, Trace, Route by clicks), the fitted alignment (curve table, PIs, radius handles, intersection turns), the vehicle and load, the live route card.',
          '[[in:terrain|Terrain]]: fetch the USGS 3DEP terrain, use it for ground elevations, contours / slopes, levelness, pad grading and route-profile inputs.'
        ] }
      ] },
      { id: 'tab-out', title: 'Output tabs (right)', blocks: [
        { ul: [
          '[[out:plan|Plan]]: the map with the Draw bar, every item, crane, swing path and label; the elevation / 3D dock underneath (▾ Elevation; Elevation or 3D; at the pick, the set, the capacity governing point or the closest 3D clearance).',
          '[[out:summary|Summary]]: every lift and route in one table (governing % of chart, status, closest clearance, largest float / track load, bearing ratio, level, flags) with links: map · worked · Report · drawing.',
          '[[out:crane|Crane]]: the crane as the analysis uses it, for the crane / setup and the lift and point you choose (pick, set or governing; for a girder lift its first, last or governing step): plan to scale, side elevation along the boom, the load chart with the operating points and the threshold lines, the weights and CGs of the outrigger / track loads, and a table of every crane input with its source (file and page, entered, derived or assumed) and links to where it is used. The same figures are in [[rpt:cranes|Report §Cranes]] and on a Crane drawing sheet per setup.',
          '[[out:picks|Picks]]: one row per pick (radius, capacity, % of chart, heights, hook reach, closest 3D) with its worked steps; the girder lifts per crane.',
          '[[out:ground|Ground]]: per pick the largest load on each float / track along the swing, bearing under the mat, mat checks, stress at depth, worked steps.',
          '[[out:route|Route]]: per route the turns, conflicts, overhead clearances, axle loads, haul road, posted bridges, staging, worked steps.',
          '[[out:terrain|Terrain]]: levelness and blocking per crane, slopes, pad cut / fill, the route profile with crests / sags and the long-load clearance.',
          '[[out:site|Site]]: the project, the coordinate system, the plan sheets and the site items with their worked values.',
          '[[out:dwg|Drawings]]: the lift-plan drawing set (cover, general notes, a lift plan per pick and per girder lift, rigging / load share, ground, route, a Crane sheet per setup, and the SITE PLAN - AERIAL sheets); paper D or B; Download DXF; Download aerial image (PNG + world file); Print sheet / Print all sheets.',
          '[[out:man|Manual]]: this manual (filter box, Print manual, and the box that adds it to the Report).',
          '[[out:rpt|Report]]: the calculation report: §1 Summary, §2 Basis, then Site, Plan sheets, Site items, Cranes, Lifts, Tandem lifts, Ground, Route, Terrain, Elevations, 3D view — each value worked (equation, values, result). Search, Expand / Collapse all, Print report.'
        ] }
      ] }
    ] },
    { id: 'meth', title: '4. Methods and limits', topics: [
      { id: 'm-lookup', title: 'Chart capacity (lookup rule)', blocks: [
        { p: 'No interpolation (the default, conservative): C is the chart cell at the **next longer tabulated boom length** and the **next larger tabulated radius**. Not permitted: a radius below the smallest or above the largest tabulated radius, a boom longer than the longest column, a blank cell, or a cell the file marks "special equipment". When the boom lies between two tabulated lengths and the next shorter length gives a lower value at that radius, the lower value is used; repeated columns at one length (telescoping modes) give the lowest unless a mode is chosen on the setup. Linear interpolation between tabulated radii is offered only where the chart notes permit it (Lift settings). Total load W = load + rigging + hook block + other deductions (the charts are gross); %chart = W / C × 100. Worked in [[rpt:lift-rule|Report §Lifts › Basis]] and for each pick in [[rpt:lifts|§Lifts]].' }
      ] },
      { id: 'm-thresh', title: 'Thresholds and the tandem limit', blocks: [
        { p: 'Single-crane lifts: caution ≥ 75 %, critical lift ≥ 75 %, limit 100 % of chart (project inputs, [[in:lifts>Lift settings|Lift settings]]). Tandem lifts: each crane is flagged at or above the **tandem limit** (default 75 % of chart, [[in:tandem>Girder lift settings|Girder lift settings]]); at the limit counts as over; a one-crane girder lift uses the single-crane thresholds. The chart\'s rating basis (% of tipping) is shown with them; it is not used in a calculation. See [[rpt:basis-notes|Report §2 Basis]] and [[rpt:tandem-basis|§Tandem lifts › Basis]].' }
      ] },
      { id: 'm-3d', title: '3D clearances and OSHA Tables A / T', blocks: [
        { p: 'Along the path (hoisting at the pick, every degree of the swing, lowering at the set) the boom, the load line, the load (a vertical cylinder) and the counterweight (the tail-swing cylinder) are checked in 3D against power lines (a prism per span, lowered by the sag and widened by the sway allowance), obstructions (contact red, closer than the obstruction clearance — 2 ft default — amber) and exclusion zones (any component over them, amber). A power line without a wire height is checked as a vertical plane (plan distance). Path model: uniform (the radius changes evenly with the swing; default) or luff at the pick, then swing. Worked in [[rpt:lift-rule|Report §Lifts › Basis]] and per pick.' },
        { p: 'Power lines, cranes working: **29 CFR 1926.1408 Table A** minimum clearance D_min by voltage (up to 50 kV 10 ft; over 50 to 200 kV 15 ft; over 200 to 350 kV 20 ft; over 350 to 500 kV 25 ft; over 500 to 750 kV 35 ft; over 750 to 1,000 kV 45 ft; over 1,000 kV as set by the utility or a registered professional engineer). Voltage not known: 50 ft, or 20 ft when the utility says 350 kV or less. Trucking: **29 CFR 1926.1411 Table T** travel clearance (up to 0.75 kV 4 ft; over 0.75 to 50 kV 6 ft; over 50 to 345 kV 10 ft; over 345 to 750 kV 16 ft; over 750 to 1,000 kV 20 ft), applied to the haul vehicle and its load; unknown voltage 20 ft; a spotter within 20 ft. See [[rpt:items-power|Report §Site items › Power line]] and [[rpt:route|§Route]].' },
        { key: 'The OSHA table values were checked against secondary copies of the regulation: verify them against the current eCFR text before relying on them.' }
      ] },
      { id: 'm-outrig', title: 'Outrigger and track loads', blocks: [
        { p: 'Every 1° of the swing, rigid-body statics with the crane\'s weights and CGs (carrier / carbody, upperworks, boom, counterweight, the hook load): **"entered data"** when they are all entered on the crane card ([[in:cranes>Cranes in this project|Cranes tab]]). Otherwise, with the gross operating weight, a stated conservative **bounding estimate** (the crane\'s CG anywhere it could stand), labelled "estimate — verify with the manufacturer\'s outrigger calculator". Neither entered: not computed. Floats: plane of loads (three floats when one lifts off; not stable is red); tracks: eccentric bearing statics. Worked in [[rpt:ground-basis|Report §Ground › Basis]] and per pick in [[rpt:ground|§Ground]].' }
      ] },
      { id: 'm-mats', title: 'Mats and ground bearing', blocks: [
        { p: 'The float spreads k : 1 (default 1 : 1) through the timber mat or steel plate to an effective area; q_g = P / A_e + the mat\'s own weight, against the entered **allowable bearing pressure** (psf or ksf). The mat is checked for bending and shear as a cantilever beyond the float (timber with the entered adjusted F_b\', F_v\'; steel plate to AISC 360-16 ASD). Without a mat the float bears on its own area. Worked in [[rpt:ground-basis|Report §Ground › Basis]].' }
      ] },
      { id: 'm-bouss', title: 'Stress at depth (Boussinesq)', blocks: [
        { p: 'The vertical stress increase at buried utilities, culverts and walls drawn with a depth: Boussinesq, uniform rectangles by corner superposition (Newmark; FHWA GEC 6, 2002, §5.3.2), track pressures integrated, summed over the supports at the governing slew angles, the pick and the set; for a tandem lift both cranes are summed at the same step. Compared with the item\'s allowable when one is entered on the Ground tab. Worked in [[rpt:ground-basis|Report §Ground › Basis]].' }
      ] },
      { id: 'm-offtrack', title: 'Off-tracking and the swept path', blocks: [
        { p: 'Low-speed kinematic off-tracking of the drawn steer-axle path (each unit\'s rear axle group moves along its own axis; SAE J695, NCHRP Report 505, AASHTO Green Book 7th Ed. §2.1.4), integrated every 0.25 ft; a steerable rear dolly by a proportional steering ratio k (enter the dolly maker\'s). The outlines of the tractor, trailer and load every foot form the swept path; per turn the largest off-tracking, inside and outside radii and swept width. Axle loads by statics (or entered weigh tickets). Worked in [[rpt:route|Report §Route]].' }
      ] },
      { id: 'm-align', title: 'Fitted route alignment and OpenStreetMap roads', blocks: [
        { p: 'The route line (clicks, a trace or an OpenStreetMap path) is simplified (Douglas–Peucker, tolerance 1.5 ft), resampled, and its heading-change rate over a detection window (50 ft) marks the curves (radius under 5,000 ft); curves of the same direction less than a window apart are merged, curves under 3° dropped; a heading change within 12 ft is an intersection turn. Tangents are least-squares lines through the points between curves; each curve\'s radius is the least-squares arc tangent to both tangents (the free least-squares circle is shown beside it as a check). The swept path and the route profile (Terrain) follow this alignment, not the raw vertices. Worked per curve in [[rpt:route|Report §Route]].' },
        { p: 'Road geometry from OpenStreetMap (Overpass API) is **from OpenStreetMap — not survey**: centrelines drawn by volunteers, no curb returns or widths; check curves and clear widths on site. Data © OpenStreetMap contributors, Open Database License (ODbL): the attribution is shown on the map, the route card, the Route tab and the Report. One-way roads travelled against their direction are flagged (escort / permit), not avoided.' }
      ] },
      { id: 'm-terrain', title: 'Terrain', blocks: [
        { p: 'USGS 3DEP elevations on a grid, bilinear interpolation between nodes. Levelness from the four support points\' plane (slope along, across and the steepest, against the level tolerance) and the blocking under each float to the levelling datum; pad cut / fill by the grid method (bank volumes, no slopes); route grades over a base length, crests / sags, and the long-load ground clearance. **Preliminary only — not for certifying levelness.** Worked in [[rpt:terrain-basis|Report §Terrain › Basis]].' }
      ] },
      { id: 'm-assumed', title: 'ASSUMED defaults and how to replace them', blocks: [
        { p: 'Where an input is missing the app uses a stated default, shows it as a placeholder or an "assumed" note, and lists it on the crane card, in the flags and in the Report. Replace each by entering the value where it is listed:' },
        { tbl: { head: ['Default used', 'Where to replace it'], rows: [
          ['Power-line voltage not known: 50 ft (20 ft when "the utility says 350 kV or less" is ticked); trucking: 20 ft', 'Site items: the power line\'s **Voltage** (from the utility)'],
          ['Wire height not entered: the line is a vertical plane (plan distance)', 'Site items: **Lowest wire above grade**, grade elevation, sag and sway'],
          ['Crane geometry not in the file: boom-foot pin 0 ft high on the rotation centre, head allowance 0, boom width 0, counterweight bottom 0', 'Cranes tab: **Elevation geometry** on the crane card (or Edit…)'],
          ['Plan dimensions not in the file (carrier centred, gauge, …): listed on the card', 'Cranes tab: Edit… → Plan dimensions'],
          ['Rating basis not stated in the chart notes', 'Cranes tab: the configuration\'s rating basis'],
          ['Working-area zones not set: the 360° / over-side chart', 'Cranes tab: over-front / over-rear half-angles'],
          ['Crane pad elevation not entered: datum 0.00; pick / set ground = the pad; load bottom 0', 'Lifts tab: Crane pad elevation and the pick\'s Heights (or Terrain: use terrain)'],
          ['Obstruction clearance 2 ft; path model uniform', 'Lifts tab: Lift settings'],
          ['Outrigger loads without the weights and CGs: bounding estimate; boom CG at 0.5 of foot-to-tip; counterweight CG at the tail-swing radius; mat spread 1 : 1', 'Cranes tab: the weights and CGs on the crane card; Ground tab: the mat'],
          ['Girder CG not entered: L / 2; travel elevation = the higher of pick and set; girder elevations = crane 1\'s pad', 'Girder lifts tab: Girder and Path'],
          ['Route: radius 50 ft at intersection turns (legacy: at the vertices); alignment fit tolerance 1.5 ft, window 50 ft, straight over R 5,000 ft, curves under 3° ignored, corner within 12 ft; lane width 12 ft; vehicle (tractor wheelbase 20 ft, trailer 40 ft, deck 5 ft, minimum turning radius 45 ft …, shown as placeholders); overhead margin 1 ft; staging 2 ft / 2°; tyre area 100 in²', 'Route tab: the route card and the vehicle'],
          ['Terrain: level tolerance 1 %, blocking limit 24 in, maximum grade 8 %, grade base 20 ft, clearance margin 0.5 ft', 'Terrain tab: per crane and per route']
        ] } },
        { p: 'The general notes of the drawings and [[rpt:basis-notes|Report §2 Basis]] repeat the governing assumptions with a § link to each.' }
      ] }
    ] },
    { id: 'data', title: '5. Crane data', topics: [
      { id: 'd-source', title: 'Where the crane data come from', blocks: [
        { p: 'The crane files (one JSON file per crane, extracted from the manufacturers\' official load charts) are in the engineer\'s **private** GitHub repository Structural_References, branch **crane-charts**, folder "Crane Load Charts/library/" — the defaults under [[in:cranes#crSrc|Cranes tab → Library settings (GitHub)]]. **Load crane library from GitHub** reads them with the Cloud sync token (nothing is written there); **Load crane file(s)…** reads files you have. The library is kept in this browser; a project carries its own copy of each crane it uses (the card shows a fingerprint, and **Use the library copy** when the library\'s chart data differ).' },
        { p: 'Each crane card shows the source document, revision, date, pages, the file and where it was loaded from, PRELIMINARY when the document is marked so, and the **terms** stated in the file: the library\'s charts are for reference in planning only. [[rpt:cranes|Report §Cranes]] lists the same for every crane.' },
        { key: 'The load chart in the cab for the specific crane (serial number, configuration and counterweight as rigged) governs. Check every value the lift depends on against it.' }
      ] },
      { id: 'd-paste', title: 'Adding a crane by pasting a chart', blocks: [
        { ol: [
          '[[in:cranes>Crane library|Cranes tab]] → **New crane (paste a chart)…**: the crane data (make, model, source document, revision, terms), plan dimensions and elevation geometry.',
          'For each configuration, paste the chart from Excel: first row a label cell, then the boom lengths in ft; each next row the radius in ft, then the capacities. Blank, - or — = no rating (never interpolated). Tick **kip (× 1,000)** if the chart is in kips. Press **Read the chart** and check the preview (a capacity higher than at the smaller radius above it is marked).',
          '**Save to the project** (tick **also keep in this browser\'s library**), or **Add to the library and the project**. An edited chart is marked "edited here" on the card and in the Report.'
        ] }
      ] },
      { id: 'd-public', title: 'Never put chart data in a public repository', blocks: [
        { p: 'Manufacturer chart data must stay private. Once a crane is in a project, its chart data travel with that project: this browser, Export JSON files, and the Cloud sync copy of every saved project. The Cranes tab checks the Cloud sync repository and **warns when it is PUBLIC** (or not checked yet, or named All-Structural); Save then asks first. Use a private repository for Cloud sync, or Save as → "This browser only" for projects with cranes. Never commit crane files or exported projects to the public All-Structural repository.' }
      ] }
    ] },
    { id: 'trouble', title: '6. Troubleshooting', topics: [
      { id: 'tr-notfound', title: 'GitHub "Not found" when loading the crane library', blocks: [
        { p: 'GitHub answers "Not found" when the repository, branch or folder is wrong **or when the token has no access to the private repository** (GitHub does not say which). Check [[in:cranes#crSrc|Library settings (GitHub)]] (Defaults restores them), then the token in Cloud sync ([[in:proj>Save and open|Project tab → Saved projects… → Cloud sync (GitHub)…]]):' },
        { ul: [
          '**Fine-grained token** (the kind the dialog asks for, github_pat_…): Repository access → Only select repositories → add **Structural_References** as well as your projects repository; Permissions → Contents: **Read and write** (sync writes your projects; the library is only read). Paste the new token and Save.',
          '**Classic token**: the **repo** scope (it covers private repositories).',
          'Branch: crane-charts; folder: Crane Load Charts/library/. "GitHub refused the token" means it expired, was revoked or was mistyped.'
        ] }
      ] },
      { id: 'tr-tiles', title: 'Map tiles do not load', blocks: [
        { p: 'Tiles need the internet. **Street (OpenStreetMap)** often refuses tiles to a page opened from a file (file://), because the browser sends no Referer: use **Satellite (Esri)** or None. Offline, or when a network blocks the tile servers, the map says "Map tiles are not loading" with **Use no base map**: work on a plan sheet; every drawing tool and check works without tiles. If the map itself is missing, the map libraries (Leaflet, proj4js) could not load from the CDN the first time. [[in:site>Base map|Site & map → Base map]].' }
      ] },
      { id: 'tr-usgs', title: 'USGS terrain fetch errors', blocks: [
        { p: '"Could not reach the USGS 3DEP elevation service": offline, blocked by the network, or no answer. Terrain is optional; everything else works. Try again later or from another network. "NoData" points are left out (shown as no terrain under a support). A large area is fetched at a coarser spacing (at most 10,000 points; the app says so). The grid is cached in this browser only: another computer fetches it again. [[in:terrain>Terrain (USGS 3DEP)|Terrain tab]].' }
      ] },
      { id: 'tr-osm', title: 'Snap to road (OpenStreetMap) errors', blocks: [
        { p: '"Could not get the OpenStreetMap roads": offline, blocked by the network, or no answer from the Overpass API (overpass-api.de). The first snap in an area needs the internet; the roads are then cached in this browser. "Too many requests (HTTP 429)" or "busy (HTTP 504)": the public server is limiting; wait a minute and try again. "Point N is … ft from the nearest OpenStreetMap road": click nearer a road (within 150 ft). "Do not connect": the roads in the area are not joined in the data; add a via point or draw that part with **Trace** or **Route**, which work offline.' }
      ] },
      { id: 'tr-sheets', title: 'Plan sheet image missing on another computer', blocks: [
        { p: 'Sheet images are kept per browser. A project opened from GitHub, from a file without images, or on another computer shows each sheet\'s outline with "image missing": on the [[in:sheets>Plan sheets|Plan sheets tab]] press **Reload image…** and choose the same file again; the placement and the alignment are kept. To move a project with its images, Export JSON with **Include the plan-sheet images** ticked.' }
      ] },
      { id: 'tr-large', title: 'Large projects and full storage', blocks: [
        { p: 'This browser\'s localStorage (about 5 MB, shared by every tool of the suite opened from files) holds the autosave, the saved-project list and the crane library; each crane is roughly 15–20 kB and is copied into every project that uses it. When it is full the app says "Autosave failed": Export JSON, remove saved projects you no longer need (Saved projects…), and remove library cranes not in use. Plan-sheet images are in IndexedDB: use a lower PDF resolution and [[in:sheets>Images in this browser|Clean up unused images…]]. A very long girder path is checked in at most 2,000 steps per leg (the app warns).' }
      ] }
    ] },
    { id: 'keys', title: '7. Keyboard and mouse', topics: [
      { id: 'k-all', title: 'Keyboard and mouse', blocks: [
        { tbl: { head: ['Action', 'How'], rows: [
          ['Zoom / pan the map', 'mouse wheel / drag (pinch on a touch screen)'],
          ['Draw a line or area', 'click the points; double-click or Enter ends it; Backspace removes the last point; Esc cancels'],
          ['Edit an item', 'click it; drag its points, its ✥ handle or the item; drag "+" to add a point; double-click a point to remove it; Delete removes the selected item or route; Esc deselects'],
          ['Move / turn a crane', 'drag ✥ / drag ↻; drag P and S for the pick and the set'],
          ['Girder lift on the map', 'drag P / S, ↻ (turn at the pick / set), ◆ (CG), H1 / H2 (lifting points), W1… (waypoints)'],
          ['Scrubber (girder lifts)', 'drag the step slider or press Play: the girder, both booms and the elevation / 3D follow'],
          ['Align to map', 'four clicks; Backspace or Ctrl+Z takes back the last click; Enter or Done finishes after four; Esc / Cancel leaves the sheet unchanged; drag a marker to adjust before Done'],
          ['Undo / Redo', 'Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z (header buttons); each finished drag is one step'],
          ['Save / Save as…', 'Ctrl+S / Ctrl+Shift+S'],
          ['3D view', 'drag to orbit, right-drag to pan, wheel to zoom'],
          ['Drawings preview', 'wheel zooms about the cursor, drag pans, double-click fits'],
          ['Report search', 'type in the search box; ▲ ▼, Enter / Shift+Enter step through the matches; Esc clears'],
          ['This manual', 'type in the filter box; Esc clears it']
        ] } }
      ] }
    ] }
  ];

  /* ---------- markup ---------- */
  const LINK = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
  function inline(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (m, t, l) => `<a href="#" class="manGo" data-go="${t}">${l}</a>`);
  }
  const plain = s => String(s).replace(LINK, '$2').replace(/\*\*([^*]+)\*\*/g, '$1');
  function blockHtml(b) {
    if (b.p != null) return `<p class="manP">${inline(b.p)}</p>`;
    if (b.key != null) return `<p class="manKey">${inline(b.key)}</p>`;
    if (b.ul) return `<ul class="manList">${b.ul.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`;
    if (b.ol) return `<ol class="manList">${b.ol.map(x => `<li>${inline(x)}</li>`).join('')}</ol>`;
    if (b.tbl) return `<div class="manTblW"><table class="manTbl"><thead><tr>${b.tbl.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.tbl.rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return '';
  }
  const blockText = b => b.p != null ? plain(b.p) : b.key != null ? plain(b.key) : (b.ul || b.ol) ? (b.ul || b.ol).map(plain).join(' ') : b.tbl ? b.tbl.head.concat(...b.tbl.rows).map(plain).join(' ') : '';
  /* every link target of the manual (tests) */
  function links() {
    const out = []; const add = s => { String(s).replace(LINK, (m, t, l) => { out.push({ target: t, label: l }); return m; }); };
    PARTS.forEach(p => p.topics.forEach(t => t.blocks.forEach(b => { [b.p, b.key].forEach(x => x != null && add(x)); (b.ul || b.ol || []).forEach(add); if (b.tbl) b.tbl.rows.forEach(r => r.forEach(add)); })));
    return out;
  }
  const topics = () => PARTS.reduce((a, p) => a.concat(p.topics.map(t => Object.assign({ part: p.id }, t))), []);

  /* ---------- the tab ---------- */
  let el = null, q = '';
  function css() {
    if (document.getElementById('man-css')) return; const s = document.createElement('style'); s.id = 'man-css';
    s.textContent = `.manBar{position:sticky;top:0;z-index:5;background:var(--paper);padding:8px 0 6px;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;}
      .manBar input[type=search]{flex:1 1 220px;min-width:0;max-width:420px;font-size:10pt;padding:4px 7px;}
      .manBar label{font-size:9pt;white-space:nowrap;} #manCount{font-size:9pt;color:#475569;}
      .manNav{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 4px;} .manNav a{font-size:9pt;border:1px solid var(--slate-400);border-radius:3px;padding:2px 7px;text-decoration:none;color:var(--navy-800);background:var(--slate-100);}
      .manBody{max-width:880px;} .manPart>h2{font-size:12.5pt;color:var(--navy-900);border-bottom:2px solid var(--navy-800);margin:18px 0 6px;padding-bottom:3px;}
      .manTopic>h3{font-size:10.5pt;color:var(--navy-800);margin:14px 0 4px;} .manP,.manList{font-size:9.5pt;line-height:1.5;margin:5px 0;} .manList{padding-left:22px;} .manList li{margin:3px 0;}
      .manKey{background:#eef4ff;border-left:4px solid var(--navy-800);padding:6px 10px;font-size:9.5pt;line-height:1.45;margin:8px 0;}
      .manTblW{overflow-x:auto;max-width:100%;} .manTbl{border-collapse:collapse;font-size:9pt;margin:6px 0;} .manTbl th,.manTbl td{border:1px solid var(--line);padding:3px 6px;text-align:left;vertical-align:top;} .manTbl th{background:var(--slate-100);}
      .manGo{color:var(--blue-600);} mark.manHit{background:#FDE68A;color:inherit;padding:0;}
      .manFlash{outline:3px solid #F59E0B;outline-offset:2px;transition:outline-color 1.2s;} .manNote{font-size:8.5pt;color:#64748b;margin:18px 0 0;}
      @media print{ body.manPrinting #inputPanel,body.manPrinting #hdr,body.manPrinting .manBar,body.manPrinting .manNav{display:none!important;}
        body.manPrinting #main,body.manPrinting #outputPanel,body.manPrinting #out{display:block;overflow:visible!important;height:auto!important;}
        body.manPrinting .manTopic{break-inside:avoid;} body.manPrinting a.manGo{color:inherit;text-decoration:none;} }`;
    document.head.appendChild(s);
  }
  function build(p) {
    el = p; css();
    p.innerHTML = `<div class="manBar noprint"><input type="search" id="manQ" placeholder="Filter the manual (e.g. token, mats, Align)" aria-label="Filter the manual">
        <span id="manCount" role="status" aria-live="polite"></span><button type="button" id="manPrint">Print manual</button>
        <label><input type="checkbox" id="manRpt"> Include this manual in the Report (appendix)</label></div>
      <nav class="manNav" aria-label="Manual parts">${PARTS.map(x => `<a href="#" data-mpart="${x.id}">${esc(x.title)}</a>`).join('')}</nav>
      <div class="manBody">${PARTS.map(x => `<section class="manPart" id="man-${x.id}" data-part="${x.id}"><h2>${esc(x.title)}</h2>${x.topics.map(t =>
        `<div class="manTopic" id="man-${t.id}" data-topic="${t.id}"><h3>${esc(t.title)}</h3>${t.blocks.map(blockHtml).join('')}</div>`).join('')}</section>`).join('')}
      <p class="manNote">This manual is part of the application files: it versions with the code. Where it and the app disagree, the disagreement is a defect — report it. Lift-planning aid: the crane manufacturer's charts, the lift plan and the site checks govern.</p></div>`;
    p.querySelector('#manQ').addEventListener('input', e => filter(e.target.value));
    p.querySelector('#manQ').addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; filter(''); } });
    p.querySelector('#manPrint').addEventListener('click', print);
    const cb = p.querySelector('#manRpt'); cb.checked = !!A.ui.manRpt;
    cb.addEventListener('change', () => { A.ui.manRpt = cb.checked; A.saveUi(); if (window.CranePickReportUI) window.CranePickReportUI.redraw(); });
    p.addEventListener('click', e => {
      const n = e.target.closest('[data-mpart]'); if (n) { e.preventDefault(); const s = document.getElementById('man-' + n.dataset.mpart); if (s) s.scrollIntoView({ block: 'start' }); return; }
      const a = e.target.closest('a.manGo'); if (a) { e.preventDefault(); go(a.dataset.go); }
    });
    filter('');
  }
  /* filter(text): topics whose title or text holds every word typed; the words are marked */
  function filter(s) {
    q = String(s || '').trim(); if (!el) return 0;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    el.querySelectorAll('mark.manHit').forEach(m => { m.replaceWith(document.createTextNode(m.textContent)); });
    el.querySelectorAll('.manTopic').forEach(t => t.normalize());
    let shown = 0, all = 0;
    el.querySelectorAll('.manTopic').forEach(t => { all++; const txt = t.textContent.toLowerCase(), hit = words.every(w => txt.includes(w)); t.hidden = !hit; if (hit) shown++; if (hit && words.length) mark(t, words); });
    el.querySelectorAll('.manPart').forEach(s => { s.hidden = !s.querySelector('.manTopic:not([hidden])'); });
    el.querySelector('#manCount').textContent = words.length ? (shown ? `${shown} of ${all} topics` : `No topic contains "${q}"`) : `${all} topics`;
    return shown;
  }
  function mark(root, words) {
    const rx = new RegExp('(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(n => { if (!rx.test(n.nodeValue)) return; rx.lastIndex = 0; const f = document.createDocumentFragment(); let last = 0;
      n.nodeValue.replace(rx, (m, g, i) => { f.appendChild(document.createTextNode(n.nodeValue.slice(last, i))); const k = document.createElement('mark'); k.className = 'manHit'; k.textContent = m; f.appendChild(k); last = i + m.length; return m; });
      f.appendChild(document.createTextNode(n.nodeValue.slice(last))); n.replaceWith(f); });
  }
  function print() {
    const keep = q; if (q) { el.querySelector('#manQ').value = ''; filter(''); }
    if (A.ui.otab !== 'man') A.showOTab('man');
    document.body.classList.add('manPrinting');
    let over = false; const done = () => { if (over) return; over = true; document.body.classList.remove('manPrinting'); window.removeEventListener('afterprint', done); if (keep) { el.querySelector('#manQ').value = keep; filter(keep); } };
    window.addEventListener('afterprint', done); window.print(); setTimeout(() => { if (!window.matchMedia || !window.matchMedia('print').matches) done(); }, 1000);
  }
  /* ---------- links ---------- */
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  function findIn(pane, spec) {
    if (!pane || !spec) return null;
    if (spec[0] === '#') return pane.querySelector('#' + CSS.escape(spec.slice(1)));
    const want = norm(spec);
    return [...pane.querySelectorAll('.secHead, summary, h4')].find(h => norm(h.textContent).startsWith(want)) || null;
  }
  function flash(x) { document.querySelectorAll('.manFlash').forEach(y => y.classList.remove('manFlash')); void x.offsetWidth; x.classList.add('manFlash'); setTimeout(() => x.classList.remove('manFlash'), 1600); }
  /* go(target) -> { ok, kind, tab, found }: opens the tab and brings the card (or the Report section) into view */
  function go(target) {
    const m = /^(in|out|rpt|man):([^>#]+)(?:([>#])(.+))?$/.exec(String(target || '')); if (!m) return { ok: false };
    const [, kind, id, sep, rest] = m, spec = sep ? (sep === '#' ? '#' + rest : rest) : null;
    if (kind === 'man') { if (q) { el.querySelector('#manQ').value = ''; filter(''); } const t = document.getElementById('man-' + id); if (t) { t.scrollIntoView({ block: 'start' }); flash(t); } return { ok: !!t, kind, tab: 'man', found: !!t }; }
    if (kind === 'rpt') {
      A.showOTab('rpt'); const v = window.CranePickReportUI && window.CranePickReportUI.view, has = !!(v && v.doc && v.doc.index.get(id));
      if (has) { const j = () => { const w = window.CranePickReportUI.view; if (w && w.jump) w.jump(id); }; j(); setTimeout(j, 160); setTimeout(j, 420); }
      else A.notice('That Report section is not in this report yet: it appears once the project has what it reports (a pick, a girder lift, a route, a power line, fetched terrain …). The Report is open at the top.', '', { id: 'manRptMiss' });
      return { ok: true, kind, tab: 'rpt', found: has };
    }
    const tabs = kind === 'in' ? [...document.querySelectorAll('#inTabs [data-itab]')].map(b => b.dataset.itab) : [...document.querySelectorAll('#tabBar [data-otab]')].map(b => b.dataset.otab);
    if (!tabs.includes(id)) return { ok: false, kind, tab: id, found: false };
    if (kind === 'in') A.showITab(id); else A.showOTab(id);
    const pane = kind === 'in' ? document.querySelector(`#inPanes [data-pane="${id}"]`) : document.querySelector(`#out [data-opane="${id}"]`);
    const x = spec ? findIn(pane, spec) : null;
    if (x) { for (let d = x.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true; const box = x.closest('.sec') || x.closest('details') || x; box.scrollIntoView({ block: 'start' }); flash(box); }
    else if (kind === 'in') { const ip = document.getElementById('inputPanel'); if (ip && window.matchMedia && window.matchMedia('(max-width: 899.98px)').matches) ip.scrollIntoView({ block: 'start' }); }
    return { ok: true, kind, tab: id, found: spec ? !!x : true };
  }

  /* ---------- the Report appendix (only with "Include this manual in the Report" ticked) ---------- */
  function rptText(s) {
    return String(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(LINK, (m, t, l) => {
      const k = /^(in|out|rpt|man):([^>#]+)/.exec(t); if (!k) return l;
      if (k[1] === 'rpt') return `${l} ([[${k[2]}]])`;
      if (k[1] === 'out' && k[2] !== 'man') return `[[tab:${k[2]}|${l}]]`;
      if (k[1] === 'in') return `[[tab:in:${k[2]}|${l}]]`;
      return l; });
  }
  window.CranePickReport && window.CranePickReport.add(() => {
    if (!A.ui.manRpt) return [];
    return [{ id: 'manual', key: 'manual', title: 'Appendix: User manual', subs: topics().map(t => ({ id: 'm-' + t.id, title: t.title, items: t.blocks.reduce((out, b) => {
      if (b.tbl) out.push({ type: 'table', head: b.tbl.head, rows: b.tbl.rows.map(r => r.map(c => plain(c))) });
      else if (b.ul || b.ol) (b.ul || b.ol).forEach((x, i) => out.push({ type: 'note', text: (b.ol ? (i + 1) + '. ' : '• ') + rptText(x) }));
      else out.push({ type: 'note', warn: b.key != null, text: rptText(b.p != null ? b.p : b.key) });
      return out; }, []) })) }];
  });

  A.outTab({ id: 'man', label: 'Manual', before: 'rpt', build });
  window.CranePickManual = { PARTS, links, topics, go, filter, text: () => topics().map(t => t.title + ' ' + t.blocks.map(blockText).join(' ')).join('\n') };
})();
