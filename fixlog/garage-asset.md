# Fix log — apps/garage-asset/ (Garage Asset Model)

A new folder app (engineer request 2026-11-25): BIM-style asset management for a parking garage. A 3D model of the garage where each
member can be clicked to open a details window with its information, NBI condition rating, inspection history and linked photos.
One file, `index.html`; classic scripts, opens from `file://`. No engineering calculations.

## 2026-11-25 — first version (prototype)

**What it does**
- Example garage (not a real structure): 300 ft × 300 ft, Level 1 slab on grade, framed Levels 2–6 (6 = roof), 10.5 ft floor to floor.
  Grid lines 1–6 at 60 ft (double tee span), A–L at 30 ft (I skipped). 330 columns (24 in square encasement around a W14 core),
  240 inverted tees (lines 2–5), 60 L-spandrels (lines 1 and 6), 625 12DT30 double tees. Member sizes are example values.
- Component IDs: `L<level>-<grid><line>-COL` (column standing on that level), `L<level>-<line>-<from><to>-IT|SP` (girder),
  `L<level>-<bay>-DT<nn>` (double tee nn of 25 counted from line A). Each ID is also the page's `#hash`, so a link opens that member.
- Click a member: details window (current NBI rating with its description, member data, photos, rating trend, inspection history,
  Add inspection form with a defects checklist per member type and a recommended action). Floor plan per level; 3D with one level
  isolated; colour by member type or by NBI rating (7–9, 5–6, 4, 0–3, not inspected); Needs attention list (NBI ≤ 4); CSV export.
- Rating scale: NBI 0–9 general condition ratings, descriptions paraphrased from the FHWA Recording and Coding Guide. The latest
  inspection by date sets a member's current rating.

**Storage (how records and photos are kept)**
- Working copy in this browser: IndexedDB `garageAsset.v1` (stores `inspections`, `photos`, `blobs`). New keys only (CLAUDE.md §5).
- Photos are resized in the browser to 2400 px on the long side (JPEG, quality 0.85) before they are stored.
- With Cloud sync set up (the same `bridgeSuite.v1.githubSync` settings as the other tools, read only), records are copied to the
  private projects repository:
  - `garage-assets/example-garage/inspections/<id>.json` — one file per inspection, never edited (append-only), so two devices
    cannot conflict;
  - `garage-assets/example-garage/photos/<component id>/<photo id>.jpg` and `<photo id>.json` (caption, date, inspection id).
  Sync runs after each save, every 2 minutes while the page is visible, and on **Sync now**. Other devices' records are downloaded;
  photos are downloaded when first viewed, then kept in the browser.
- **Load example inspections** adds 96 example records (marked "Example record") to this browser only; they are never uploaded.

**How verified**: `node tests/check-syntax.mjs`; Playwright run from `file://` with a stand-in GitHub API: inspection plus photo
saved on device A uploaded 3 files; device B (empty browser) downloaded the inspection and showed the photo (2400 px); without
sync, records persist across a reload.

**Open items**
- Replace the example layout with the real garage from the drawings (grid, levels, ramps, member sizes).
- One project name (`example-garage`) for now; a project picker when there is more than one garage.
- No edit or delete of a synced inspection (append-only by design); a correction is a new inspection.
- Microsoft 365 (SharePoint / Excel) storage instead of GitHub, if wanted.
- Offline use on a tablet beyond the browser's own storage (no service worker: not possible from `file://`).
