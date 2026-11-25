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

## 2026-11-25 — Existing-house outline on its own toggle

- **Problem:** The red MassGIS roof outline of the existing house is drawn at grade around the foundation. It was grouped with "Labels & lidar points", so it read as a stray pink line along the top of the foundation.
- **Where:** `apps/loma-drive/index.html`, site context block. Anchor text: `exInfo, 'exo'`.
- **Before:** `member(..., M({ color: 0xc8102e }), SG, exInfo, 'lbl');`
- **After:** `member(..., M({ color: 0xc8102e }), SG, exInfo, 'exo');` plus a new "Existing house outline" checkbox (`data-g="exo"`, off by default) and `exoOn` in `applyMode()`.
- **Governing provision:** n/a (display only; no computed values).
- **How verified:** rendered headless; no console errors; outline hidden by default and shown when checked.

## 2026-11-25 — Aerial photo draped on the terrain

- **What:** New "Aerial photo" toggle (on by default). It loads MassGIS 2023 orthoimagery tiles from `tiles.arcgis.com/.../orthos2023/MapServer/tile/{z}/{y}/{x}` (public tile service, no use restrictions per MassGIS) into canvas textures. They are draped on the lidar-fit ground in three nested layers (z17 / z19 / z20). Each terrain vertex is mapped plan → ENU → lat/lon → Web Mercator pixel using the same site transform as the rest of the model (`SITE.geo`).
- **Where:** `apps/loma-drive/index.html`, block `AERIAL PHOTO`. Anchor text: `orthos2023/MapServer/tile/`.
- **Behaviour:** While the photo is shown, the neighbour massing and road ribbons (kind `ctx`) are hidden, because the photo shows the real buildings and streets. Inside the claude.ai viewer, outside images are blocked, so the tool shows a note and keeps the plain ground.
- **No library added:** plain `Image` loads, with no new CDN dependency.
- **Governing provision:** n/a (display only).
- **How verified:** headless render with stand-in tiles that draw the MassGIS building outlines at their true lat/lon. The outlines land on the modelled neighbour footprints, and #3's outline lands under the new house. No console errors.

## 2026-11-25 — Basement finishing: finishes, layout presets, wall & furniture editor

- **What:** A new "Basement finishing" panel section with:
  - presets: Unfinished, Rec & media room, Guest suite, Gym & office;
  - finish choices: floor (LVP, carpet, tile, sealed concrete, rubber), ceiling (drywall, 2×2 drop, exposed) and wall colour;
  - an editor ("Edit layout"): draw walls that snap square to the house on a 6" grid, add furniture and fixtures from a library of about 30 items, drag, rotate 90°, delete and undo, plus Copy/Paste layout to share as JSON;
  - basement ceiling lights tied into the night-lighting control.
- **Where:** `apps/loma-drive/index.html`, block `BASEMENT FINISHING` (`const BSM = (() => {`). Panel markup `#bPresets`, `#bFloor`, `#bCeil`, `#bWall`, `#bEdit`; editor bar `#bed`.
- **Saved data:** a new localStorage key `lomaDrive.basement.v1`, prefixed per §5. No existing keys changed. Reads and writes are wrapped in try/catch.
- **Assumptions (also stated in the tool's info text):** the finished floor sits on the 4" slab; partitions are 2×4 plus drywall, running from the floor to a ceiling under the existing joists; the perimeter is furred, insulated and drywalled. Headroom and code clearance are not checked (engineer's instruction, 2026-11-25).
- **Governing provision:** n/a (display only; no computed engineering values).
- **How verified:** headless: each preset rendered top-down; editor adds an item, drags it (position saved), draws a wall (saved as `[13,5,27,5]`); no page errors.
