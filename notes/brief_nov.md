# Common brief for agents (Nov 2026)

Repo: /home/user/All-Structural (GitHub mlococo88/All-Structural). Read CLAUDE.md (binding) and docs/AGENT_BRIEF.md first, plus fixlog/README.md.

- Work in your OWN git worktree: `git -C /home/user/All-Structural fetch origin main && git -C /home/user/All-Structural worktree add /home/user/wt-<topic> -b claude/<topic> origin/main`. Remove the worktree when done (`git worktree remove`).
- Calculation changes: §4 callout in the PR body (before/after, article + edition, hand check with inputs, intermediate values, result before and after).
- Saved data: keys/formats unchanged (§5). A changed default must not alter a saved project's stored choice; old saves without the field may need an explicit migration that keeps their old behaviour — say which you did and why.
- Fixlog entry per tool (§8), with PR link added to the heading in a follow-up commit before merging.
- NEVER copy AASHTO / owner / spec text into the repo, PR or fixlog. Cite article/equation/table and paraphrase. Licensed PDFs are at /home/user/structural_references (read-only; never commit them).
- No model identifiers in commits, PRs, code or docs.
- Commit trailer (end of every commit message):
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ERyVKJvXwkCLfDxubWUdbh
- PR body ends with:
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01ERyVKJvXwkCLfDxubWUdbh
- Times in US Eastern if you state any.
- Other agents are working in parallel on the same files. Immediately before opening the PR, and again before merging, `git fetch origin main && git merge origin/main`; resolve conflicts keeping both sides' intent, then re-run the tests.
- Tests: `node tests/check-syntax.mjs` (no args = all files), relevant `tests/engine/run.mjs`, smoke/compare scripts per docs/AGENT_BRIEF.md and tests/README.md. Prove that results outside the intended change did not move.
- The engineer has approved merge-as-you-go for this task.

## MERGE SAFETY (mandatory)
Merge ONLY the PR number returned by YOUR OWN create_pull_request call. Before merging, read that PR and confirm head.ref equals your branch name; squash-merge with expectedHeadSha = your pushed head SHA. Never merge, close or edit any other PR. Do not use the gh CLI (use mcp__github__* tools; load via ToolSearch).

## Report back
PR number + URL, merged or not, the §4 callouts in short (before/after numbers), and any question for the engineer that you did not resolve.
