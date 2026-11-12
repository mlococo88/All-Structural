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

## 2026-11-05 — PR: claude/retire-aci-rebar, PR #804: https://github.com/mlococo88/All-Structural/pull/804 (RBRT; home page only)

- **Where:** `tools.html`. Anchors: the card `<div class="name">Rebar Development &amp; Splices</div>` in "Members & detailing", and `<li><b>Concrete Beam ASD:</b> retired (2026-11-01)` in "Open engineer checks" → "Checks (your own action)".
- **Before:** `<a class="card" href="ACI%20Rebar%20Development%20Length.html" target="_blank"><div class="name">Rebar Development &amp; Splices</div><div class="desc">Development, hooks, compression and lap splices.</div>…`
- **After:** `<a class="card" href="Concrete%20Beam%20Capacity.html#dev" target="_blank"><div class="name">Rebar Development &amp; Splices</div><div class="desc">Development, hooks, compression and lap splices. Part of the Concrete Beam Design Suite: opens its Development &amp; Splice tab.</div>…` (tags unchanged), and a new line after the Concrete Beam ASD note: `<li><b>ACI Rebar Development Length:</b> retired (2026-11-05); it now opens the Development &amp; Splice tab of Concrete Beam Capacity (the same calculator). Projects saved in the browser are listed there; old project files (.json) open with its Import JSON.</li>`. The same status line is added to `ENGINEER_CHECKS.md`.
- **Problem:** engineer decision (2026-11-05): the standalone "ACI Rebar Development Length.html" is retired (now a redirect page, see `fixlog/ACI Rebar Development Length.md`); the card is kept and opens the suite tab directly.
- **Governing provision:** none (navigation only).
- **Check case:** the card opens `Concrete Beam Capacity.html#dev` on the Development & Splice tab (headless, file://).
- **How verified:** diff (1 card line changed, 1 line added); `node tests/smoke/rebar-redirect.mjs` (the suite opens on the tab for `#dev`).
- **Other copies:** none.
- **Open items:** none.

## 2026-11-05 — PR: claude/home-saved-projects, PR #818: https://github.com/mlococo88/All-Structural/pull/818 (HSP PR 1: "Saved projects" panel, the projects saved in this browser across the apps; home page only, no result change)

- **Where:** `tools.html`. New `<details class="projects" id="projects">` just before `<details class="checks" open>`; new CSS rules after `details.checks li{…}` (classes `projects`, `spTools`, `spBar`, `spMsg`, `spG`, `spL`, `spD`, `spSt`, `spNote`); `<script src="shared/projects.js">` and `<script src="shared/project-registry.js">` before `</head>`; a new script before `</body>` (anchor `HSP (2026-11-05): "Saved projects" panel`).
- **Before:** the home page listed tools only.
- **After:** a closed panel **Saved projects (N in this browser, M apps)** above the open engineer checks. Opened (or with `tools.html#projects`), it lists every project saved in this browser by each app of `shared/project-registry.js`, grouped by app in the card order, with the saved time where the app records one (US Eastern, as in the app's own dialog), a search box and an app filter. Clicking a project or an app's name opens the app in a new tab (no project is loaded automatically: engineer answer 3, 2026-11-05). An app's list that cannot be read is reported and left as it is. The existing cards, filter and layout are unchanged (the panel is not a `<section>`, so the tool filter does not touch it).
- **Problem:** engineer request (2026-11-05): see the saved projects of all apps from the home page.
- **Saved data (CLAUDE.md §5):** read only. The panel reads each app's own list key through `SharedProjectRegistry.list` (`SharedProjects.mapStore.read/list`); it writes nothing (no key of its own: the panel's open state is not remembered) and makes no network request.
- **Governing provision:** none (navigation and display only; no calculation, no tool file changed).
- **Check case:** each of the 16 apps saves "HSP A" and `HSP <b>bold</b> & "q" ü` with its own Save button → the home page lists both under that app, in the order and with the saved times of the app's own Saved projects dialog; the second name shows as text (no bold); search "hsp a" leaves one per app; at 390 px the page does not scroll sideways.
- **How verified:** `node tests/smoke/home-projects.mjs` (ALL PASS: names / order / times equal to each tool's dialog for all 16 apps (the Abutment Calculator and Elastomeric Bearing, own Projects dialogs: names and order, and a time shown), storage byte-identical before / after the home page's load, search, filter and refresh, no request, no console errors, 390 px); `node tests/engine/run.mjs project-registry`; `node tests/check-syntax.mjs tools.html`; screenshots at 1280 and 390 px looked at.
- **Other copies:** none.
- **Open items:** GitHub status and "Sync all" follow in HSP PR 2.

## 2026-11-05 — PR: claude/home-sync-all, PR #821: https://github.com/mlococo88/All-Structural/pull/821 (HSP PR 2: GitHub status and "Sync all to GitHub" in the Saved projects panel; home page only, storage only, no result change)

- **Where:** `tools.html`. The panel script (anchor `HSP (2026-11-05): "Saved projects" panel`) is replaced by a version with sync (new header lines `HSP PR 2:`); `<script src="shared/github-sync.js">` added before `shared/project-registry.js` in `<head>`. CSS unchanged (the `spSt` status classes were added in PR 1).
- **Before:** the panel listed this browser's projects only.
- **After (sync off):** as before, plus a line in the bar: "Cloud sync (GitHub): off. To set it up, open any app with Saved projects…, then Cloud sync (GitHub)…". No request, nothing written.
- **After (sync on, the shared setting `bridgeSuite.v1.githubSync`):** opening the panel (once per page load) or **Check GitHub** reads the repository's file list. It is ONE `GET …/git/trees/<branch>?recursive=1`, shared by every app's engine within one check (`ghFetch` memo). Each project then shows its status, with the apps' own labels: synced / waiting to upload / this browser only / not on GitHub (deleted there) / GitHub newer / conflict / on GitHub only. Each status has a hint (title) saying what to do in the app. GitHub-only projects are listed under their app. **Sync all to GitHub…** asks first, then runs `uploadAll()` of each app's engine (`SharedProjectRegistry.engine`) one app at a time and reports the files uploaded, the conflicts kept (the engine's notices) and any app busy in another tab or not finished; it then checks GitHub again. Getting a GitHub version, choosing after a conflict, opening / downloading a GitHub-only project and deleting stay in the app (clicking opens the app).
- **Problem:** engineer answers 1 and 2 (2026-11-05): GitHub status on the home page, and one action that syncs every app.
- **Saved data (CLAUDE.md §5):** no new key. While only looking, nothing is written. Sync all writes what the app's own "Upload all" writes: the app's bookkeeping key `bridgeSuite.v1.githubSync.tool.<tool>` (same format: `asked`, `seen`, `base`, `queue`, `conflicts`, `lock`), and on a conflict the copy `<name> (conflict <device> <date>)` in the app's own list (`mapStore.duplicate`, item unchanged), exactly as the app does. Apps with no saved project are skipped (no bookkeeping key made for them). Nothing is deleted. The home page never downloads into an app's list.
- **Governing provision:** none (storage and display only; no calculation, no tool file changed).
- **Check case:** 17 apps (with Bridge Geometry, whose sync merged in #819 during this PR; its 5 example bridges are uploaded too), each saving "HSP A" and `HSP <b>bold</b> & "q" ü` with sync off (0 requests). GitHub already holds a different Spread Footing "HSP A" and a "HSP remote". The panel then shows "this browser only" for every project, Spread Footing "HSP A" as conflict and "HSP remote" as on GitHub only; this takes 1 request and storage is unchanged. Sync all uploads every project (33 test files plus Bridge Geometry's examples) and the conflict copy "HSP A (conflict Home <date>)"; GitHub's "HSP A" is unchanged; no DELETE. Each app opened afterwards shows "synced" in its own dialog, no first-sync offer, and makes 0 writes after its 3 s check. A file then changed on GitHub shows "GitHub newer"; Sync all again makes 0 writes.
- **How verified:**
  - `node tests/smoke/home-sync.mjs` (ALL PASS, 17 apps);
  - `node tests/smoke/home-projects.mjs` (ALL PASS);
  - `node tests/engine/run.mjs project-registry github-sync projects`;
  - `node tests/check-syntax.mjs`;
  - screenshots at 1280 and 390 px looked at.
- **Other copies:** none (the status labels repeat `LABEL` of `shared/github-sync.js`, which does not export it).
- **Open items:** none.

## 2026-11-08 — PR: claude/tools-notes-split (PR #1235: https://github.com/mlococo88/All-Structural/pull/1235) (TLNL: long notes on the tools list as a lead and a short list; display only)

### TLNL. Long notes split into a lead and a list   [display only] [no result change]
- **Request (engineer, 2026-11-07, approved for all apps):** "There are some sections that just have this block of text. Can we split this up into a numbered list or bullets or some other way so it's not just a text that will likely get overlooked because it's too long." Pattern of Spread Footing SFNL-1 (#1167). The left summary panel (Part B of the same request) does not apply: this page lists the tools and has no checks.
- **CSS** (after `.spNote{…}`), page-scoped, no new colours (dark and light use the page's variables), anchor `/* TLNL (2026-11-08`:
  ```css
  ul.nlU{margin:2px 0 0;padding-left:18px}ul.nlU>li{margin:1px 0}
  .desc ul.nlU{margin:2px 0 0}.spNote ul.nlU{margin:2px 0 0}
  ```
- **Notes changed (anchor = the old opening text).** Each is now its first sentence (or bold name) followed by `<ul class="nlU">` with one item per sentence or per decision. Every word, number, link and citation is kept in the same order, except "(see ENGINEER_CHECKS.md)", which moves up into the lead of the Gusset item (it has no digits). Exact before / after: the PR diff.
  1. Saved projects, `<p class="spNote">Click a project…` → `<div class="spNote">How to use this list:` + Open / Where they are kept / A file you can keep.
  2. Checks, "Concrete Beam ASD: retired (2026-11-01); …" → two items.
  3. Checks, "ACI Rebar Development Length: retired (2026-11-05); …" → three items.
  4. Checks, "Cloud sync (GitHub), in the tools with a Saved projects dialog: …" → four steps.
  5. Results changed, "Gusset: 2026-11-07 review decisions to confirm: …" → seven decisions.
  6. Results changed, "Pile: 2026-11-07 decisions to confirm: …" → six decisions.
  7. Results changed, "SubLoads: 2026-11-07 review decisions to confirm: …" → six decisions.
  8. Results changed, "Steel Beam: … Timber: … Moving Load: …" → lead "Steel Beam, Timber, Moving Load:" and one item per tool.
  9. Card "Steel Bridge Design (GirderDetail)" description → Includes / Sends.
  10. Card "Steel Bridge Design (new, in development)" description → So far / Not for design use yet.
  11. Card "Light Pole & Sign Post" description → Anchor groups / Not for.
  12. Card "Base Plate & Anchor Designer" description → Also / Hand-off / Report tab.
- **Not changed:** the Saved projects status bar (generated with its Refresh button), the short card descriptions, the page subtitle and footer, and the tool filter script. The filter still matches the same text, because a card's `textContent` keeps every word.
- **Formulas, factors, units, code references:** none (§4 does not apply). **Saved data:** none (§5).
- **Check case:** the Gusset item. Before: one 436-character line. After: a lead and seven items; "23.8 ksi" and "1.403 → 1.165" are unchanged.
- **How verified:** headless Chromium, origin/main vs the branch, at 1440 and 390 px: the digit sequence of the page text is identical; the filter "anchor" shows the same two cards; no sideways scroll at 390 px; 0 console errors. Tests: check-syntax, home-projects, home-sync (ALL PASS).
- **Other copies:** none. **Open items:** none.

## 2026-11-08 — PR: claude/sf-display-rename (PR #1236: https://github.com/mlococo88/All-Structural/pull/1236) (SFNM) — Spread Footing card renamed   [display only]
- **Where:** Foundations section, card `href="Spread%20Footing.html"`.
- **Before:** `<div class="name">Spread Footing</div><div class="desc">Spread and combined footings: bearing, stability, flexure, shear, pedestals.</div>`
- **After:** `<div class="name">Shallow Foundation Design</div><div class="desc">Spread, combined and wall footings: bearing, stability, flexure, shear, pedestals.</div>`
- The Saved projects panel heading comes from `shared/project-registry.js` `name` (changed in the same PR). Link target unchanged.
- **Formulas, factors, units, code references:** none. **Saved data:** none.
- **How verified:** home-projects, home-sync: pass. **Other copies:** none.

## 2026-11-12 — PR: ps-bridge-skeleton, PR #1444: https://github.com/mlococo88/All-Structural/pull/1444 (PSB1) — card for the new Prestressed Bridge Design app (in development)   [navigation only]
- **Where:** "Bridge suite (linked apps)" section, after the card `href="Prestressed%20Bridge%20Design.html"` (anchor `Formerly psbeam.html.</div>`).
- **Before:** no card for `apps/ps-bridge/index.html`.
- **After:** `<a class="card" href="apps/ps-bridge/index.html" target="_blank"><div class="name">Prestressed Bridge Design (new, in development)</div>…<li><b>Not for design use yet:</b> use the card above.</li>…<span class="tag">AASHTO LRFD 10th</span></a>` (the Steel Bridge app's precedent, #465).
- **Formulas, factors, units, code references:** none. **Saved data:** none.
- **How verified:** home-projects pass; the card opens the app (file://). **Other copies:** none. **Open items:** none.
