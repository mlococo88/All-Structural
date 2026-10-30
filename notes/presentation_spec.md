# Output presentation spec (engineer feedback, 2026-10-30)

"There aren't as many graphics and 3D renderings for each of the output tabs. The level of detail in the output calculations is great but it seems quite unorganized. Group the calculations by topic, so it's less of a stacked mess."

## A. Grouped worked steps: one framework, applied to every tab
- Extend `shared/steps.js` with groups. A step list becomes topics, and each topic contains sub-steps. Give each topic:
  - a title, e.g. "Section properties at this location", "Demands (Strength I)", "Compression flange slenderness", "Nominal resistance F_nc", "Check";
  - a one-line result summary;
  - its governing value and status chip;
  - a collapsed/expanded state.
- **Standard order for every check:**
  1. Inputs and geometry
  2. Section properties used
  3. Demands
  4. Intermediate quantities, one topic per AASHTO sub-article
  5. Resistance
  6. Check ratio, with status
- **Default view:** each check card opens with only the topic headers and their one-line results. Click a topic to see its full worked steps. Add "Expand all" / "Collapse all".
- **Per tab layout:**
  1. Results summary at the top (a governing-ratio table and the girder graphic).
  2. A location or station selector.
  3. The selected location's checks as grouped cards.
- **Report (`shared/report.js`):** use the same grouping, with sub-headings in print and the nav tree going down to topic level.
- No value changes. Step ids keep working, and every "see §" link still resolves; update the tests.

## B. Graphics on each output tab: plain SVG, plus a small three.js view where it adds value
| Tab | Graphics |
|---|---|
| Section properties | Scaled cross-section (deck, haunch, rebar layers, plates) with the ENA/PNA lines for steel, 3n and n, and a stress diagram for the selected load case |
| Loads & LLDF | Cross-section with appurtenances and lane and wheel positions for the governing LLDF case: lever-rule sketch, rigid-section truck positions |
| Analysis | Already has diagrams. Add the girder elevation over the diagrams with supports, plate breaks and cross-frames, a deflection/camber diagram, and a hover readout |
| Flexure | Girder elevation colored by ratio, plus the governing location's stress block / f_bu-vs-F_nc bar chart and an LTB unbraced-length sketch |
| Shear & stiffeners | Elevation with the stiffener layout and each panel colored by shear ratio; a stiffener detail sketch (transverse and bearing) |
| Fatigue & studs | Elevation with fatigue details marked and colored; stud zones with pitch and count drawn; a Δf vs (ΔF)_n chart along the girder |
| Constructibility | Deck pour-sequence diagram (pours drawn on the elevation), M_DCc envelope, overhang-bracket sketch |
| Framing & cross-frames | Plan view (already exists), plus a cross-frame elevation sketch (X/K type, members labelled) and the governing member highlighted |
| Splices | Already has drawings; show the governing bolt/plate highlighted |
| Welds | Weld locations on the elevation, plus a weld-size detail |
| Rating | RF along the girder (Inventory/Operating, flexure and shear), with RF = 1.0 marked |
| Report summary | Small girder elevation with the governing check per region |

- A small embedded 3D view (reusing `ui/view3d.js`) is optional on Section properties, as an extruded section, and on Framing. No new libraries.
- All graphics are drawn from the same results as the tables; never recompute.
- Each graphic must:
  - be readable in print;
  - work at phone width;
  - support click-to-select a location, so the tab's station selector syncs with the graphic.

## Order
A first (framework plus all tabs), then B, split across agents by tab.

## Graphic style (engineer, 2026-10-30): use the Drawings tab format for every new graphic
"I love the format of the drawing in the drawing output tab. Use that for graphics on the other tabs."
- Build every tab graphic with the same drawing pipeline as the Drawings tab: `engine/drawings.js` and the `shared/dxf.js` entities, rendered to SVG by the same preview renderer. That keeps the same look on every tab:
  - line weights, layers and colours;
  - text style, dimensions and leaders;
  - title, scale bar and zoom/pan behaviour.
- Every tab graphic can also be downloaded as DXF, for free, since it's the same entity model.
- Ratio colouring and highlights are extra layers on top of that style. Don't switch to a different charting look for elevations, sections or details.
- Plots (moment/shear diagrams, RF along girder, Δf vs (ΔF)_n) also use the drawing style: drafted axes, gridlines on their own layer, and the same fonts.
- Navigation on every graphic, from the shared SVG preview renderer (engineer, 2026-10-30):
  - wheel zoom at the cursor;
  - drag to pan;
  - pinch and drag on touch;
  - double-click to fit;
  - on-canvas +, − and Fit buttons;
  - sharp vector text at any zoom.
