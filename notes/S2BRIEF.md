# Brief: SBD stage 2, unify the differing checks (2026-10-22)

Repo mlococo88/All-Structural. Read CLAUDE.md, fixlog/README.md, tests/README.md, HANDOFF.md §4.9 first; CLAUDE.md is binding.
Research and per-item method: scratchpad/sbd-merge/STAGE2.md (Part 1 only; Part 2/3 are NOT in scope).
Full path: /tmp/claude-0/-home-user-All-Structural/9085651c-392a-5333-9756-05df816e0405/scratchpad/sbd-merge/STAGE2.md

## State of main
- stgirder.html was deleted at the cut-over (#422). ST-Girder lives only in "Steel Bridge Design.html" as the `st-src` block (srcdoc frame `gd-st`). STAGE2.md's "ST line" numbers refer to the old file and "+8021" is stale: find code by anchor text (grep), not by line number.
- The frame is same-origin: it can call host functions via `window.parent` (webShear, fcrw, rbFactor, modRatio, GM.gs...). Mechanism per STAGE2.md "Proposed unification mechanism": shims in st-src that call the host (or read additive payload fields from `gdStPayload`), with ST's own code kept as the stand-alone fallback when there is no GirderDetail payload. Payload additions are additive fields, schemaVersion stays 1, old payloads keep today's path (§5).

## Engineer decisions (do not re-ask)
- In every item, the GD method (10th Ed.) becomes the method; the engineer wants accurate, not overly conservative.
- Item 7 F_crw: implement k = 7.2 where both web edges are in compression (Eq. 6.10.1.9.1-2 provision, 10th Ed.) in the host `fcrw` and therefore in ST through the shim. §4 callout.
- Item 4 A6: enforce the 6.10.6.2.3 skew ≤ 20° condition in GD's A6 permission (builtin28 has 28°, so it loses A6 there). Also enforce the other testable 6.10.6.2.3 conditions; list untestable ones (holes) for the engineer as today.
- Stand-alone ST (no payload) keeps its own built-in path unless the item says otherwise.

## Rules
- Cite only: never copy AASHTO/owner text into the repo. 10th Ed. text: scratchpad/aashto/*.txt.
- Each PR: one item group, §4 callout per changed calc (before/after expression, article + edition, worked hand check with numbers shown by the tool), fixlog entry in fixlog/"Steel Bridge Design.md", §6 every new value worked + linked.
- Tests (tests/README.md): `node tests/check-syntax.mjs`; `tests/compare.mjs --tool gd|st|sbd` against tests/baselines/{gd,st}.json; `tests/st-span.mjs` (interior spans, tests/baselines/st_interior.json); tests/sbd-verify.mjs; tests/a610-prop.mjs. Subset per PR (gd builtin/AASHTO, builtin28/MassDOT, util/CTDOT; st: builtin + util/AASHTO girders + 2 interior-span payloads); run the full st + st-span set before merging any PR that changes ST results. Re-record baselines for the keys your item is expected to change, and list every changed key and why in the PR. Any unexpected change = stop and explain.
- Machine is shared by 3–4 agents running browsers. Check `uptime` first; use --jobs 2 max (1 if load > 40). Wait for runs with a Monitor until-loop; never end your turn while your own background run is still going. Never pkill chromium broadly: kill only your own PIDs.
- Parallel agents edit the same file in different regions. Before merging: `git fetch origin main && git merge origin/main`, resolve conflicts (baseline JSON: re-run the affected cases and re-record, never hand-merge numbers), re-run the subset, then `git diff --stat origin/main` shows only intended files.
- Merge-on-pass is authorized by the engineer: squash-merge yourself with mcp__github__merge_pull_request (full 40-char head SHA; load with ToolSearch). If create_pull_request errors, check list_pull_requests before retrying.
- Commit trailer:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ERyVKJvXwkCLfDxubWUdbh
- PR body ends with:
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ERyVKJvXwkCLfDxubWUdbh
- No model identifiers in repo artifacts. Branch names claude/sbd-s2-<n>-<slug>, from origin/main, git worktree.
- Final report: PR URLs + merge SHAs; each §4 change with hand-check numbers; counts of changed results (flips listed); anything genuinely needing the engineer.
