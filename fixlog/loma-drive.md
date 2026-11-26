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

## 2026-11-25 — Controls organized into tabs

- **What:** The control panel is split into five tabs: **View** (camera presets, 3D floor isolate, walk-through), **Show** (layers, mode, section cut), **Style** (finishes, lighting, sun and shadows), **Basement** (finishing presets, editor, finishes) and **About** (sources, assumptions, tips). The panel is 370 px wide on desktop and stays a bottom sheet on phones. The basement floor and ceiling options are stacked under their headings.
- **Where:** `apps/loma-drive/index.html`. Markup `#panel .tabs` / `.tabp[data-tab]`; script `showTab()`, anchor text `// ---- control tabs ----`.
- **Saved data:** new key `lomaDrive.ui.tab` (last open tab), prefixed per §5, wrapped in try/catch. No existing keys changed.
- **Governing provision:** n/a (UI only).
- **How verified:** headless screenshots of each tab at 1200×800 and 390×844; no page errors.

## 2026-11-25 — Driveway and front walkway (illustrative)

- **What:** A 12' driveway from Loma Drive along the south side of the house (plan X 44.5–56.5, Z −63 to 20.5), ending at the foot of the side-deck stair, with a flared apron at the street. A 4'-6" walkway leaves the driveway and runs along the front of the porch to the porch steps. Both are draped on the terrain and walkable in walk mode. The earlier straight walk from the steps to the street is removed. Material choices are on the Style tab: driveway in asphalt, pavers, crushed stone or concrete; walkway in bluestone, brick, pavers or concrete.
- **Where:** `apps/loma-drive/index.html`, block `DRIVEWAY & FRONT WALK`, anchor text `const HARD = {};`. The swatch rows are added after `const finState = {};`.
- **Assumptions (also in the tool's info text):** not shown on the permit set. The layout is for visualization only, and no lot lines, setbacks or curb-cut rules are checked. Checked clear of the nearest neighbouring building (about 30' south).
- **Governing provision:** n/a (display only).
- **How verified:** headless renders (aerial, south and site map views); no page errors.

## 2026-11-25 — Aerial photo drew over the driveway and walkway

- **Problem:** The aerial layers used `polygonOffset` (factor −1 to −3) so they would win against the grass terrain and against each other. That pulled them in front of the driveway and walkway, which sit only 0.22–0.25' above grade, so the photo covered them.
- **Where:** `apps/loma-drive/index.html`, block `AERIAL PHOTO`, function `layer()`.
- **Before:** `new T.MeshStandardMaterial({ map: tex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -order, polygonOffsetUnits: -order })`, with nested layers overlapping (`layer(17, …, 1)`, `layer(19, …, 2)`, `layer(20, …, 3)`).
- **After:** no polygon offset. Each layer keeps only the triangles that are not fully inside the next finer layer's box (`layer(17, …, [-330, 370, -350, 380])`, `layer(19, …, [-110, 150, -120, 160])`, `layer(20, …, null)`), so the layers tile without overlapping. The plain grass terrain is hidden while the photo is shown (`applyMode()`: `k === 'site' && o.material === mat.grass`).
- **Governing provision:** n/a (display only).
- **How verified:** headless render with stand-in tiles from the Aerial and Front views. The driveway and walkway are fully visible over the photo, with no flicker between layers.

## 2026-11-25 — More realistic rendering: furniture, materials, sky light and shadows

- **What:** Display-only realism pass. (1) Furniture: the box furniture is replaced by procedural models built in the file (sofas with cushions and pillows, beds with bedding, dining and office chairs, kitchen cabinets with shaker doors and pulls, range, hood, fridge, wall oven, dishwasher, sink and faucet, island with curved quartz top and stools, vanities with basins and mirrors, toilets, showers with glass, fireplace with ledgestone and mantel, rugs, lamps, plants, books, closet clothes, washer/dryer). Each piece gets a soft contact shadow. The basement library uses the same models, and the pool table, ping-pong table, bar, gym and storage pieces are new models. (2) Materials: matching height (bump) maps for siding, shingles, wood floors, tile, slate, decking, beadboard, shakes, CMU and concrete; wood grain, fabric weave, quartz veining, ledgestone and brushed steel textures; anisotropic filtering up to 16×. (3) Lighting: gradient sky dome with a sun disc, a sky-light environment map (PMREM) so metals, glass and counters reflect the sky, warmer low-sun colour, ACES exposure 0.92, sun shadows re-fitted to the view each frame (sharper up close), glass no longer blocks sunlight, lamp shades, bulbs and the fireplace glow after dusk. (4) New "Render quality" setting on the Style tab: High (screen resolution up to 2×, 4096 shadow map) or Standard (up to 1.5×, 2048). Defaults to Standard on touch screens and windows under 900 px wide.
- **Where:** `apps/loma-drive/index.html`. Anchors: `const REAL = (() => {` (new, after the ambient light), `// ---------- textures ----------`, `// ---------- materials ----------`, `const FX = (() => {` and `// =================== FURNITURE ===================` (replaces the old box furniture block), basement `const LIB = {` (same keys, names and sizes), `function applySun()` (`REAL.light(day, el)`), `function applyLights()` (`FX.GLOW`), `id="qualSeg"`, frame loop (`REAL.fit(...)`), startup line (`REAL.finish()`), basement `drawSel()` (selection box ignores the contact shadow).
- **Before:** furniture as plain boxes and cylinders; flat colours; solid-colour sky; fixed 220' × 220' shadow box at 2048; hemisphere + ambient fill only.
- **After:** as above. Furniture stays in the same footprints and orientations; picking, info text, Furniture layer toggle, modes, section cuts, floor isolate, walk, finishes and basement editing work as before.
- **Saved data:** new key `lomaDrive.quality` (`'high'` or `'standard'`). The basement layout format (`lomaDrive.basement.v1`) and item keys are unchanged, so saved layouts load as before.
- **Assumptions (stated in the tool):** furniture, decor and light fixtures are illustrative, not from the permit set (the fireplace breast is drawn to the ceiling and the TV over the mantel, pendants over the island and dining table are placeholders).
- **Governing provision:** n/a (display only; no computed values).
- **How verified:** headless renders (jsdom + headless-gl) of the start, front, aerial, 1st and 2nd floor, kitchen, living, bedroom, bath, mudroom, evening, walk, section-cut and x-ray views, all three basement presets and every basement library item; no page errors. Draw calls in the whole-house view went from 2,856 to 3,063 and triangles from about 246k to 341k. The aerial photo could not be loaded in the test renders.
