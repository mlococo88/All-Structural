# loma-drive — 3 Loma Drive 3D model

Folder app: `apps/loma-drive/index.html` (single file; three.js r147 + OrbitControls from jsdelivr, pinned).
Not an engineering calculation tool: no formulas, load or resistance factors, units or code references are computed. No localStorage/sessionStorage keys are used.

## 2026-11-24 — Initial version

- **What:** Interactive 3D model of the addition & renovation at 3 Loma Drive, Gloucester MA, built from the Taormina Architects record building permit set (May 13, 2026; sheets A1–A7, E1, S1–S3, EX1–EX2).
- **Geometry source:** wall layout traced from the PDF vector fills (A1, 1/4" = 1'-0", 18.096 pt/ft); levels from A3–A6 (1st floor 29.20', 2nd floor +9'-2 5/8", plate 8'-2", peak 29'-2" above avg. grade 27.50'); 8:12 main and cross gables, 3:12 porch/mudroom hips (A2, A5, S3); window/door tags per A2 schedules.
- **Site placement (stated in the tool's notes):**
  - House placed on the MassGIS Building Structures roof outline of the existing house (≈40.9' × 38.2' with the rear deck notch). From that outline, plan north ≈ 28.1° east of true north. The address was confirmed with the Esri World Geocoder rooftop point.
  - Terrain: thin-plate fit to 22 USGS 3DEP bare-earth spot elevations (EPQS, NAVD88), on a 5' grid, blended into the plan grade at the house. The lidar gives 27.1' at the house against the 27.50' average existing grade on the plans, so the plan datum is taken as NAVD88. Approximate, not a survey.
  - Streets: US Census TIGER/Line centerlines, 20' wide assumed. Neighbouring buildings: MassGIS outlines extruded as generic 1-story massing.
- **Features:** finished, framing and x-ray modes; section cuts; 3D floor isolate; plan views; sun and shadow study with true north; finish swatches and presets; night lighting; walk-through; site map (north up) and neighbourhood view; tap-for-info on every element.
- **How verified:** rendered headless (Chrome/SwiftShader) for each view; walk-mode stair climb tested.
- **Open items:** lot lines, driveway, utilities and the existing-house comparison are not modelled. A topo survey would replace the lidar fit.
