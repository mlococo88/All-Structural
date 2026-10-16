# tests/ — headless test kit (developer tooling only)

The tools stay single, self-contained HTML files with no build step and no npm (CLAUDE.md §1). Nothing in this folder is loaded by any tool. It exists so that a change can be checked the same way every time: open a tool headless, offline, on two versions (usually `origin/main` and the working tree), wait until it has finished its automatic work, and compare every computed result.

## Requirements

- Node 18 or later (tested on Node 22).
- The `playwright` npm package, either in a local `node_modules` or installed globally (`npm i -g playwright`; it is preinstalled globally in the Claude Code cloud container). The scripts find it in either place.
- A Chromium. The scripts use `/opt/pw-browsers/chromium` when it exists (the preinstalled one), or the path in the `PW_CHROMIUM` environment variable, else Playwright's own browser. **No browser is downloaded.**
- No network. Every CDN library the bridge-suite tools load is served from `tests/libs` (see below). Google Fonts requests get an empty answer. Any other request is blocked and listed in the output as `blocked`.

## Commands (run from the repository root)

```bash
# GirderDetail: origin/main vs the working tree, built-in project, owner AASHTO (Tier 1)
node tests/compare.mjs --tool gd

# GirderDetail: several projects and owners (each combination is one case; A and B run in parallel)
node tests/compare.mjs --tool gd --project builtin,builtin28,xsA,curb --owner AASHTO,RIDOT,MassDOT,CTDOT
node tests/compare.mjs --tool gd --project xsA --owner RIDOT --mode mod      # Design modules mode (button click)

# ST-Girder: apply a GirderDetail hand-off payload (#gdpull, as "Send to ST-Girder" does) and compare every result
node tests/compare.mjs --tool st --payload def15_AASHTO_G2,def15_RIDOT_Iyes_G2,xsA_RIDOT_Iyes_G1

# Any tool: smoke load (console errors) + page text and localStorage after load
node tests/compare.mjs --tool page --file lldf.html

# Two versions other than main / working tree
node tests/compare.mjs --tool gd --a 3ef3506 --b my-branch                  # git refs (same file name)
node tests/compare.mjs --tool st --a origin/main --b /path/to/stgirder.html  # a file anywhere

# Syntax check (Tier 0): every inline script; JSX transpiled with the offline Babel; GirderDetail's embedded Preliminary sizing page included
node tests/check-syntax.mjs "Steel Bridge Beam Modules.html" stgirder.html
```

Options of `compare.mjs`: `--tool gd|st|page`, `--a` (default `origin/main`), `--b` (default the working-tree file), `--file` (tool file; default per tool), `--project` (`builtin`, `builtin28` = built-in with all skews 28°, `xsA`, `curb`, or a path to a localStorage JSON), `--owner`, `--skew`, `--mode pl|mod`, `--payload` (name in `projects/st` or a path), `--quiet` (ms the project data must stay unchanged; default 8000), `--max-diffs` (values listed per section; default 25), `--out` (folder for the raw readouts; default `<tmp>/allstruct-tests/out`), `--wait` (page tool, ms).

A git ref is written with `git show` to `<tmp>/allstruct-tests/<sha>/` and opened from there (`file://`). Fetch first (`git fetch origin main`) so `origin/main` is current.

## Suggest panel checks (`suggest.mjs`)

```bash
# default settings: the panel's Quick suggestion and Full design give the same results as origin/main's Suggest tab (quick suggestion, then Full design)
node tests/suggest.mjs same --project builtin,xsA --owner AASHTO,RIDOT      # add --full no to skip Full design (about 80 s per case)
# modes honoured (web depth Range/List/Locked, girder count List/Range, overhangs Locked, spacing near piers Locked), Cancel, Apply and module sync,
# saved data both ways (main opens a project with the new fields; an older project opens in the branch), Design modules hides the button
node tests/suggest.mjs locks
# girder count varying: the panel objective chooses which counts the study designs in full (SGF-a); Locked: the study's own objective
node tests/suggest.mjs objpicks
# objectives (cost, steel weight, shallowest), maximum structure depth, the short list of options, Show the work and Apply of an option (part 2)
node tests/suggest.mjs options
```

Each `same` case opens A (`--a`, default `origin/main`) and B (`--b`, default the working tree) in parallel, waits for idle, sets the owner like `compare.mjs`, and compares the Suggest results (web depth and type, plates, splices, stiffeners, cross-frame spacing, cost, the fast-sizing candidates, the quick check or Full design candidates and ratios) exactly. Exit code 0 when everything passes.

## Output

For each case, one line per section with the hash of A and B and `same` or `DIFFERENT`, then for each different section the values that differ (path, A, B), then console errors, dialogs, blocked requests and how long the idle wait took. The exit code is 0 when every section is identical, 1 on a difference, 2 on an error (including console errors). Raw readouts (JSON) are saved in `--out`.

Volatile values are normalized before comparing: ISO time stamps, millisecond time stamps under `ts`/`savedAt`/`producedAt`/`updatedAt`/`seenAt`-like keys, and the `file://` folder a page was opened from.

### Sections

- **gd** (`Steel Bridge Beam Modules.html`): `gd.project` (GirderDetail project data without `ui`), `pl.project` (Preliminary sizing project data), `pl.checks` (every Preliminary sizing check item: location, status, ratio, cells), `pl.analysis` (envelopes, deflections, reactions per girder type), `mod.<id>` for df, sa, gs, cf, oh, fa, ts, sc, wt, bstf, splice (every check item after Get demands from Preliminary sizing for the detail modules), `sa.girder1` (Structural analysis of girder 1).
- **st** (`stgirder.html`): `st.session` (the inputs after the hand-off was applied), `st.status`, `st.checks`, `st.rating`, `st.governing`, `st.sections`, `st.stations`.
- **page**: `page.text`, `page.storage`.

## Waiting for GirderDetail to be idle

Opening a project can start automatic work: the bridge is published from Preliminary sizing, demands are refreshed, cross-frames are auto-designed, and a second pass may follow. This takes 20–50 s. Never read results at a fixed time. GirderDetail has `window.gdIdle({ quiet, max, step })` (since 2026-10-15). It returns a Promise that resolves when no demand request is in flight or waiting, no second pass is pending, Preliminary sizing is loaded and ready, and the project data has been unchanged for `quiet` ms (default 8000). It rejects after `max` ms (default 150000). Call `plEnsure()` first if Preliminary sizing may not be loaded yet. `compare.mjs` uses `gdIdle` when the page has it, and the same logic from outside when it doesn't (copies older than 2026-10-15).

## Test projects (`projects/`)

- `gd/xsA.json`, `gd/curb.json`: localStorage seeds (keys `plateline_autosave_v1`, `girderdetail_autosave_v1`, and for curb `girderdetail_inbox_v1`). Both were saved by older versions (2026-10-13), before newer features existed, so they trigger the automatic refresh and migrations on open. These are the standard "xsA" and "curb" projects of the verification matrix. The built-in project (`builtin`) is the app's own example with empty storage; `builtin28` sets all support skews to 28° in Preliminary sizing.
- `gd/util.json` (added 2026-10-15): the built-in project (15° skews) under **MassDOT** with two utility rows in LLDF and DLs: existing utility (UT) 0.30 klf and future utility bay (UF) 0.25 klf at x = 17.5 ft, two adjacent beams, so G2 and G3 carry 0.150 klf existing and 0.125 klf future (OWN16, GD54b/GD54c). Use `--project util --owner MassDOT`.
- `st/util_MassDOT_G2.json` (added 2026-10-15): the "Send to ST-Girder" payload of `gd/util.json`, girder G2, made by the branch claude/gd-st-utilities (GD54c): it carries `M_UT`/`V_UT`/`M_UF`/`V_UF` and `girderDetail.utilities`. Main's ST-Girder ignores the utility fields; the branch applies them (`--payload util_MassDOT_G2`).
- `st/*.json`: GirderDetail "Send to ST-Girder" payloads (`{ payload }`, channel `girderDemands`, HANDOFF.md §4.9), made by main at 4193ddc: built-in 15° under AASHTO, girder 2; built-in under RIDOT with η_I = yes, girder 2; xsA under RIDOT with η_I = yes, girder 1.

None of these contain personal data; they are the tools' own examples.

## Libraries (`libs/`)

`libs/MANIFEST.json` maps each CDN URL the bridge-suite tools load (index, lldf, psbeam, stgirder, GirderDetail and its Preliminary sizing page) to a local copy at the **exact pinned version**. The copies were taken from the npm package of the same version (`npm pack`). A CDN copy can differ from the npm copy in a header comment or source-map line, but not in code. Total ≈ 14 MB.

| Folder | npm package | License | Used by |
|---|---|---|---|
| `react@18.2.0`, `react-dom@18.2.0` | react, react-dom 18.2.0 | MIT | index, psbeam, stgirder |
| `babel-standalone@7.23.5` | @babel/standalone 7.23.5 | MIT | index, psbeam, stgirder (also `check-syntax.mjs`) |
| `plotly.js@2.26.0` | plotly.js-dist-min 2.26.0 | MIT | index |
| `plotly.js@2.27.0` | plotly.js-dist-min 2.27.0 | MIT | psbeam, stgirder, GirderDetail |
| `three@0.128.0` | three 0.128.0 (r128 + OrbitControls) | MIT | index, GirderDetail |
| `mathjax@3.2.2` | mathjax 3.2.2 (`es5/tex-svg.js`) | Apache-2.0 | GirderDetail, Preliminary sizing |
| `katex@0.16.9` | katex 0.16.9 (js, css, woff2 fonts) | MIT | index, psbeam, stgirder |
| `chart.js@4.4.1` | chart.js 4.4.1 (`dist/chart.umd.js`) | MIT | index |

Each folder has the package's `LICENSE`. Not included: Pyodide and ezdxf (GirderDetail's DXF export only; very large), and libraries of tools outside the bridge suite. To test another tool offline, add its libraries the same way (`npm pack <pkg>@<exact version>`, copy the file, add a route) and keep the version identical to the tool's tag.

## Notes

- Results are compared exactly (no rounding). A pure refactor must give `all sections identical`. A deliberate result change shows up as the listed values. Put those in the PR's §4 callout with a hand check.
- Running A and B in parallel roughly doubles CPU load. GirderDetail cases take about 2 min each.
- Never commit licensed references (owner manuals, AASHTO text) here or anywhere in the repo.
