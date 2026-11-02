# Agent brief: how work is done in this repository

For coding agents (and people) making changes to the tools. **`CLAUDE.md` is binding and comes first.** This brief explains how to follow it day to day, and adds what was learned the hard way. Also read `AUDIT.md` (inventory, known issues), `HANDOFF.md` (cross-tool data), `ENGINEER_CHECKS.md` (open checks and decisions) and `fixlog/README.md`.

## 1. Workflow

1. **Branch from the latest main:** `git fetch origin main`, then branch from `origin/main` (name `claude/<short-topic>`). Never work on a stale base: other PRs land between tasks.
2. **One tool per PR** (CLAUDE.md §7): change only the tool file and `fixlog/<tool>.md`. The exception is a cross-tool connection (HANDOFF.md), where the sender, receiver and `HANDOFF.md` change in one PR. Small requests that touch the same tool are batched into one PR (10–15 items is fine), with one commit per logical item.
3. **Minimal diffs.** No drive-by reformatting, renaming or "while I'm here" calculation fixes. Raise those instead (CLAUDE.md §4, §9).
4. **Fix log** (CLAUDE.md §8, `fixlog/README.md`): one entry per change, in the same PR. Each entry has: where (function + anchor text; line numbers are approximate), the exact before/after code, the problem, the governing provision with edition, a check case, how it was verified, other copies, and open items. New entries go at the end of the file, headed `## <date> — PR: claude/<branch> (...)`. After the PR is created, add its link to the heading (`PR #N: <url>`) in a follow-up commit on the same branch before merging, so no placeholder is left. Old entries are history: never rewrite them. If something they describe has changed, add a note.
5. **§4 callouts.** Any change to a formula, a load or resistance factor, units, a unit conversion, a code reference, a default that feeds a result, or a check's pass/fail logic is called out in the PR body. Give the before and after, the governing section with its edition (AASHTO LRFD 10th Ed. (2024) unless stated), and a worked check case the engineer can do by hand. A refactor must not change any computed result. Say how you proved it (see §3, Tier 1 hashes).
6. **ENGINEER_CHECKS.md:** things only the engineer can do or decide (printed-spec checks, CAD round trips, real-browser checks, policy decisions) go there. The same list is mirrored in `tools.html` ("Open engineer checks"). When an item is done, remove it from both places and record the outcome in the fix log.
7. **PR body:** what changed, §4 callouts (or "no result change"), the verification tier and its evidence, saved-data impact, and the tools that contain a duplicated snippet when one was synced (§3). End with the attribution lines from the session. Commit messages end with the session's `Co-Authored-By` / `Claude-Session` lines.
8. **Merge:** only when the engineer has approved merge-as-you-go for the task. Squash-merge with `expectedHeadSha` (so nothing pushed in between is merged unseen), and only when GitHub reports the PR as clean. Otherwise push, open the PR and report. After merging, the next PR branches from the updated main.
9. **Ask when unsure** (CLAUDE.md §9): an edition, a provision, intended behaviour, or a manual's wording you cannot see.

## 2. Saved data and storage (CLAUDE.md §5)

- Never rename localStorage keys or change saved formats without a migration that reads the old form. GirderDetail: `girderdetail_autosave_v1`, `girderdetail_projects_v1`, `girderdetail_inbox_v1`. Preliminary sizing: `plateline_autosave_v1`, `plateline_projects_v1`, `plateline_profiles_v1`, `plateline_undo_v1`. Cross-tool: `bridgeSuite.v1.*`. ST-Girder: `stgirder.session`.
- All `file://` pages share **one** localStorage origin in Chrome/Edge. New keys must have a tool prefix.
- Migrations run once, change only values the user has not touched, and say what they did (a notice). Existing user values are never overwritten.

## 3. Verification tiers (engineer decision 2026-10-15)

Pick the lowest tier that honestly covers the change and state it in the PR body.

| Tier | When | What |
|---|---|---|
| 0 | Wording, labels, notes, citations (no computed value) | `node tests/check-syntax.mjs <tool>` (JSX transpiled for psbeam/index and for ST-Girder inside Steel Bridge Design, st-src) + one headless smoke load of the default project (no console errors): `node tests/compare.mjs --tool page --file <tool>` or `--tool gd` |
| 1 | Display-only features | Tier 0 + main vs branch result hashes on the built-in project only, one owner (AASHTO): `node tests/compare.mjs --tool gd` → `all sections identical`; one screenshot of the changed display |
| 2 | A result change limited to ONE owner or ONE module | §4 callout + hand check; main vs branch on the built-in under the affected owner (both modes only if mode-specific) + ONE AASHTO project to prove nothing else moved; save/load once |
| 3 | Shared code: loads, analysis, framing, L_b, section properties, demands/hand-offs, migrations | The full matrix: `--project builtin,builtin28,xsA,curb --owner AASHTO,RIDOT,MassDOT,CTDOT` (× `--mode pl` / `mod` where relevant), ST-Girder payloads (`--tool st`), saved data both directions |

Screenshots: save them in the session scratchpad and look at them before claiming a display is right.

## 4. The test kit (`tests/`)

Run from the repo root (details in `tests/README.md`):

```bash
git fetch origin main
node tests/check-syntax.mjs "Steel Bridge Design.html"
node tests/compare.mjs --tool gd                                      # Tier 1
node tests/compare.mjs --tool gd --project builtin,builtin28,xsA,curb --owner AASHTO,RIDOT,MassDOT,CTDOT   # Tier 3
node tests/compare.mjs --tool st --payload def15_AASHTO_G2,def15_RIDOT_Iyes_G2,xsA_RIDOT_Iyes_G1
```

It uses the globally installed `playwright` package and `/opt/pw-browsers/chromium`. It downloads nothing and needs no network: libraries are routed to `tests/libs`. It prints per-section hashes and every value that differs. The exit code is 0 only when everything is identical and there are no console errors.

## 5. GirderDetail architecture notes (`Steel Bridge Design.html`, named `Steel Bridge Beam Modules.html` until 2026-10-22)

- **Two apps in one file.** GirderDetail (the main page) and **Preliminary sizing** (the PlateLine app). Preliminary sizing runs in an iframe whose `srcdoc` is built from the plain-text block `<script type="text/plain" id="pl-src">` (since 2026-10-15; before that, the one-line base64 string `PL_B64`). Edit the page in place. Inside the block, write closing script tags as `<\/script>` and HTML comment openers as `<\!--`; `plSrc()` removes that one backslash (fixlog PLSRC). The owner rules table (`OWN_RULES`) is injected into the frame as `window.GD_OWN_RULES` before its scripts run. Both apps have a global `P` (project), so check which frame you are in.
- **Messages.** The frame and the main page talk by `postMessage`, and the main page accepts messages only from the frame (`gdFromPL`). Preliminary sizing publishes the **bridge record** (`gd-bridge`: geometry, girders, owner, load factors…, stored in GirderDetail `P.df.bridge`). GirderDetail sends model settings, fatigue, cross-frame weights, title block and mode (`gd-an`, `gd-xs`, `gd-dfx`, `gd-owner`, `gd-mode`, `gd-tb`). Demands come back as `gd-inbox` (stored in `girderdetail_inbox_v1`) and sections as `gd-gs`.
- **Requests, request IDs and the second pass.** Get demands, Design all and the automatic refresh are requests. Requests made before the frame is ready wait in `GD_PLQ` and go out in order (XR1). Each request has an ID (`rid`) echoed in the reply. `GD_RQ` holds the outstanding ones, and a reply to a replaced request is ignored (XR2). After importing, the cross-frames are auto-designed. If that changes the frame weights, the same request is made once more as a **second pass** ("DC1 recomputed with the designed cross-frame sizes"; XF2). Pending second passes are in `GD_XF_PEND` / `GD_XF_T`, and a newer user request does not drop them (XR3).
- **Settle / idle.** Projects saved before newer features (e.g. xsA) trigger an automatic refresh on open (bridge re-publish → demands → cross-frame auto-design → second pass). This takes 20–50 s. Never read results at fixed times. Use `window.gdIdle()` (resolves when nothing is in flight or pending, Preliminary sizing is ready and the project data has been stable for 8 s). The test kit does this for you.
- **Owner rules infrastructure.** `OWN_RULES` (owners RIDOT, MassDOT, CTDOT; AASHTO = none) lists rows `{ owner, id, dv, kind: 'shall-check' | 'should-warning' | 'pending-reference', sec, value, where, text }`. Text is a short paraphrase: no manual text is reproduced. Lookups go through `gdOwnR(id)` in GirderDetail; Preliminary sizing has its own lookup. The owner is chosen in Preliminary sizing (or the header pill → `gd-owner`) and arrives with the bridge. Owner **defaults** move only untouched inputs, once per version: `OWN_DEF_V` in Preliminary sizing, `GD_DEF_V` and `P.ownDefG` in GirderDetail, rule field `dv`. Every owner change to a result is a §4 change and cites the manual section.
- **Mode toggle** (`P.gdMode`). `'pl'` = "Preliminary designer": every module takes its demands from Preliminary sizing and is kept in sync (automatic refresh always on, sync note `#gd-sync`). `'mod'` = "Design modules": each module keeps its own demand source, as before. Older projects get a mode inferred on open (`gdModeInit`). Switching to `'pl'` with modules fed from elsewhere asks for confirmation.
- **Hand-off to ST-Girder** (`girderDemands`, HANDOFF.md §4.9): "Send to ST-Girder" publishes one girder's line-girder results (`gdStPayload`) and offers to open the embedded **Design & Rating (ST-Girder)** view (`stgirder.html` verbatim in `<script type="text/plain" id="st-src">`, a srcdoc frame named `gd-st`), which applies them by message through ST-Girder's own `gdAdopt` (the `#gdpull` path; SBD1, 2026-10-22).

## 6. Pitfalls learned

- **The one encoded line.** Every Preliminary sizing edit used to mean decoding and re-encoding `PL_B64`, and any two PRs touching it conflicted on that single line. This is gone: the page is plain text now, and conflicts are ordinary line conflicts. Re-check `node tests/check-syntax.mjs` after resolving one inside the `pl-src` block.
- **xsA auto-refresh on open.** Older projects change on open (migrations, refresh, second pass). Reading results right after load compares half-finished states. Always wait for idle, on both sides.
- **Parallel runs share nothing.** Each comparison side gets its own browser profile. The tools still share one localStorage origin per profile, so seed only the keys the case needs.
- **Time stamps** (`ts`, `producedAt`, `seenAt`) differ between any two runs. Normalize them before declaring a difference (`compare.mjs` does).
- **Scratchpad loss.** The session scratchpad and container can be reset on restart. Anything needed later (test projects, payloads, scripts) belongs in `tests/` or in the PR, not only in the scratchpad. Push work in progress to the branch.
- **Licensed references must never be committed.** Owner manuals, AASHTO/AISC text and other licensed PDFs used for checking stay outside the repo (and out of fix logs and PR bodies beyond short citations and paraphrases).
- **Do not trust fixed line numbers.** Files are large (GirderDetail ≈ 2.2 MB). Anchor on unique text.
- **Library versions are pinned** (CLAUDE.md §2). Don't change them unless asked. The test kit's copies must match the tags.
