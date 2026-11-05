# tools.html — fix log

## 2026-11-05 — PR #803: https://github.com/mlococo88/All-Structural/pull/803 (TLCB; home page only)

- **Where:** `tools.html`, the tool cards. Anchors: `<section><h2>Superstructure &amp; rating</h2>` and `<section><h2>Members &amp; detailing</h2>`.
- **Before:** "Superstructure & rating" listed two cards: `Concrete Beam Design Suite` (`href="Concrete%20Beam%20Capacity.html"`) and `Concrete Beam ASD Rater` (`href="Concrete%20Beam%20Capacity.html#asd"`).
- **After:** the `Concrete Beam ASD Rater` card is removed (the ASD rating is a tab of the suite). The `Concrete Beam Design Suite` card line is moved unchanged to the first card of "Members & detailing".
- **Problem:** engineer request (2026-11-05): the ASD rater duplicated the suite's ASD tab, and the suite is a member-design tool, not a superstructure/rating tool.
- **Governing provision:** none (navigation only).
- **Check case:** home page shows the suite once, under "Members & detailing"; "Superstructure & rating" shows Stone Masonry Arch and Gusset Plate. The `Concrete Beam Capacity.html#asd` deep link still opens the ASD tab (used by the retired `Concrete Beam ASD.html` redirect, unchanged).
- **How verified:** diff (1 line moved, 1 removed); page opened headless, no console errors.
- **Other copies:** none.
- **Open items:** none.
