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

## 2026-11-05 — PR: claude/retire-aci-rebar (RBRT; home page only)

- **Where:** `tools.html`. Anchors: the card `<div class="name">Rebar Development &amp; Splices</div>` in "Members & detailing", and `<li><b>Concrete Beam ASD:</b> retired (2026-11-01)` in "Open engineer checks" → "Checks (your own action)".
- **Before:** `<a class="card" href="ACI%20Rebar%20Development%20Length.html" target="_blank"><div class="name">Rebar Development &amp; Splices</div><div class="desc">Development, hooks, compression and lap splices.</div>…`
- **After:** `<a class="card" href="Concrete%20Beam%20Capacity.html#dev" target="_blank"><div class="name">Rebar Development &amp; Splices</div><div class="desc">Development, hooks, compression and lap splices. Part of the Concrete Beam Design Suite: opens its Development &amp; Splice tab.</div>…` (tags unchanged), and a new line after the Concrete Beam ASD note: `<li><b>ACI Rebar Development Length:</b> retired (2026-11-05); it now opens the Development &amp; Splice tab of Concrete Beam Capacity (the same calculator). Projects saved in the browser are listed there; old project files (.json) open with its Import JSON.</li>`. The same status line is added to `ENGINEER_CHECKS.md`.
- **Problem:** engineer decision (2026-11-05): the standalone "ACI Rebar Development Length.html" is retired (now a redirect page, see `fixlog/ACI Rebar Development Length.md`); the card is kept and opens the suite tab directly.
- **Governing provision:** none (navigation only).
- **Check case:** the card opens `Concrete Beam Capacity.html#dev` on the Development & Splice tab (headless, file://).
- **How verified:** diff (1 card line changed, 1 line added); `node tests/smoke/rebar-redirect.mjs` (the suite opens on the tab for `#dev`).
- **Other copies:** none.
- **Open items:** none.
