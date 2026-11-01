# tests/ — headless test kit (developer tooling only)

The tools stay single, self-contained HTML files with no build step and no npm (CLAUDE.md §1). Nothing in this folder is loaded by any tool. It exists so that a change can be checked the same way every time: open a tool headless, offline, on two versions (usually `origin/main` and the working tree), wait until it has finished its automatic work, and compare every computed result.

**Engine tests (Node only, no browser):** `node tests/engine/run.mjs` loads the classic scripts in `shared/` into a Node `vm` context and runs every `tests/engine/*.test.mjs` (add a name fragment to run some: `node tests/engine/run.mjs moving-load`). See `shared/README.md`.

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

# ST-Girder (since the cut-over, 2026-10-22: the Design & Rating view of Steel Bridge Design.html, read in its frame): built-in example (no hand-off), then a
# GirderDetail hand-off payload applied (by message, the same gdAdopt path as Send to ST-Girder); every result and the text of every tab
node tests/compare.mjs --tool st --payload builtin,def15_AASHTO_G2,def15_RIDOT_Iyes_G2,xsA_RIDOT_Iyes_G1
node tests/compare.mjs --tool st --payload all                               # built-in + every payload in projects/st

# Steel Bridge Design (merged tool, from PR 1 of the merge): its ST-Girder view (frame) for every girder vs stgirder.html (by default the last copy in the repository history) with the same payloads
node tests/compare.mjs --tool sbd --project builtin,xsA --owner AASHTO,RIDOT

# Baselines: record A's section hashes (A = origin/main), later compare B against them without running A
node tests/compare.mjs --tool gd --project builtin --owner AASHTO --record-baseline tests/baselines/gd.json
node tests/compare.mjs --tool gd --project builtin --owner AASHTO --baseline tests/baselines/gd.json --b "Steel Bridge Design.html"

# Regenerate the per-girder hand-off payloads in projects/st from GirderDetail (B) for the projects and owners of the run
node tests/compare.mjs --tool gd --project builtin,builtin28,xsA,curb,util --owner AASHTO,RIDOT,MassDOT,CTDOT --save-st

# Any tool: smoke load (console errors) + page text and localStorage after load
node tests/compare.mjs --tool page --file lldf.html

# Two versions other than main / working tree
node tests/compare.mjs --tool gd --a 3ef3506 --b my-branch                  # git refs (same file name)
node tests/compare.mjs --tool st --a a8bf5e7:stgirder.html --payload all      # the old stand-alone page (a ref; read as a page) vs the view (read in its frame)

# Steel Bridge (apps/steel-bridge) Report tab: browser smoke test with print emulation (0 console errors, 0 KaTeX errors, links, print)
node tests/smoke/steel-bridge-report.mjs

# Spread Footing: the page itself never scrolls in the two-panel layout (links, scrollIntoView, focus, wheel, touch; 3 window sizes)
node tests/smoke/spread-footing-scroll.mjs [--libs <folder with the pinned katex, plotly, three>]

# Light Pole and Sign Post: every computed result, every cable value, tab text and drawings, origin/main vs the working tree (13 cases)
node tests/lightpole-compare.mjs [--cases default,sign1] [--old-saves] [--tol 1e-12]

# Syntax check (Tier 0): every inline script; JSX transpiled with the offline Babel; GirderDetail's embedded Preliminary sizing page included
node tests/check-syntax.mjs "Steel Bridge Design.html"                        # the merged tool includes its embedded pages (pl-src, st-src)
```

Options of `compare.mjs`: `--tool gd|st|sbd|page`, `--a` (default `origin/main`; for `sbd` the last `stgirder.html` in the repository history, removed at the cut-over), `--b` (default the working-tree file), `--file` (tool file; default per tool), `--project` (`builtin`, `builtin28` = built-in with all skews 28°, `xsA`, `curb`, `util`, or a path to a localStorage JSON), `--owner`, `--skew`, `--mode pl|mod`, `--payload` (`builtin` = no hand-off, a name in `projects/st`, a path, or `all`; default `builtin,def15_AASHTO_G2`), `--quiet` (ms the project data must stay unchanged; default 8000), `--jobs N` (cases run N at a time, each in its own browsers; default the number of CPUs; each case's report is printed whole, in case order; added 2026-10-22), `--max-diffs` (values listed per section; default 25), `--out` (folder for the raw readouts; default `<tmp>/allstruct-tests/out`), `--wait` (page tool, ms), `--save-st [dir]` (gd: write B's per-girder payloads as `gd_<project>_<owner>_G<n>.json` to `projects/st` or `dir`), `--record-baseline FILE` (write A's section hashes per case), `--baseline FILE` (use those hashes as A; A is not run, so differing values are not listed: rerun with `--a <ref>` for them).

A git ref is written with `git show` to `<tmp>/allstruct-tests/<sha>/` and opened from there (`file://`). Fetch first (`git fetch origin main`) so `origin/main` is current.

## Steel Bridge Design: checks beyond compare.mjs (`sbd-verify.mjs`, `a610-prop.mjs`)

```bash
node tests/sbd-verify.mjs     # redirect, saved data, the Design & Rating (ST-Girder) view, live link and Update banner, Design all summary,
                              # title block, Girder report chapter and Print appendix, one project file (export, import, versions)
node tests/a610-prop.mjs      # the SBD-SHARED block and its placeholder in pl-src; A610 functions bit-identical to the expressions they replaced (10,000 random inputs each)
```

Both exit 0 when every check passes. The A610 references in `a610-prop.mjs` are the expressions as written before they were shared (main at cb584ac); never edit them to make the test pass.

## ST-Girder on interior spans (`st-span.mjs`, added 2026-10-22)

Every payload in `projects/st` is a whole 3-span girder (spans 110/140/110 ft), and ST-Girder applies a hand-off on span 1 (`gdAdopt` takes the first span and overwrites any `_selSpan` in the payload). Another span is chosen only with the "Span n" buttons on its Inputs tab (`pickSpan`). So `compare.mjs --tool st` covers end span 1 only, and the span cannot be put in a payload file. `st-span.mjs` applies a payload as `compare.mjs --tool st` does (publish, then `#gdpull`), clicks "Span n", waits until the saved session holds that span, and reads the same `st.*` sections. Each span runs in a fresh browser.

```bash
node tests/st-span.mjs                                         # every gd_* payload, spans 2 and 3, origin/main vs the working tree
node tests/st-span.mjs --payload gd_xsA_RIDOT_G2 --span 2
node tests/st-span.mjs --baseline tests/baselines/st_interior.json --b stgirder.html             # B only, against the baseline
node tests/st-span.mjs --target sbd --baseline tests/baselines/st_interior.json                 # the merged tool's ST-Girder frame (gd-st)
node tests/st-span.mjs --a origin/main --record-baseline tests/baselines/st_interior.json        # A only
```

Options: `--target st|sbd` (`sbd`: "Steel Bridge Design.html" opens the project, owner and girder named by the payload `gd_<project>_<owner>_G<n>`, `window.gdStOpen(n)` loads the frame, and the span button is clicked in the frame), `--payload` (names in `projects/st`, comma list, or `all` = every `gd_*` payload; default `all`), `--span` (default `2,3`), `--jobs` (default 2), `--timeout` (page default timeouts, ms; default 120000), `--tries` (attempts per span after a timeout or a closed browser; default 3), `--resume` (with `--record-baseline`: skip the spans already in the file), `--a`, `--b`, `--file`, `--baseline`, `--record-baseline`, `--out`, `--max-diffs`. Case names are `payload <name> / span <n>`. `baselines/st_interior.json` holds spans 2 and 3 of the 100 `gd_*` payloads (200 cases), recorded on `origin/main` `stgirder.html` (cb584ac and 0fc31d9, the same `stgirder.html`); since S2-1 (2026-10-22) re-recorded in full from the Steel Bridge Design frame (`--target sbd`, the default), every section. The readout code is a copy of `compare.mjs`'s (the header of `st-span.mjs` lists it); keep the two in step.

## Base Plate & Anchor Designer: PROFIS export (`bpad-profis.mjs`)

```bash
node tests/bpad-profis.mjs        # origin/main vs working tree results + export to PROFIS (.pe) checks
```

Compares `computeAll()`, the governing combination, every combination's capacities, the validation messages and the print-report text between `--a` (default `origin/main`) and `--b` (default the working tree) on the default project and every built-in `VALIDATION_CASES` project. Then, on `--b`: exports a design that reproduces `projects/bpad/profis-example.pe` (the engineer's PROFIS file, also the template embedded in the tool) and compares every XML leaf field with it, listing the expected differences; exports a design with no known catalog IDs and checks the "select in PROFIS" list; clicks the dialog's Download button and parses the file. The tool's CDN libraries are not in `libs/` and are blocked; the tool runs without them (KaTeX falls back to plain text, the same on both sides).

## Base Plate & Anchor Designer: bolt circle, circular pier, torsion (`bpad-circle.mjs`)

```bash
node tests/bpad-circle.mjs        # origin/main vs working tree on 31 rectangular projects + bolt-circle / round-pier / torsion / hand-off checks
```

Section 1 compares `computeAll()`, every combination's capacities, `allChecks()`, the validation messages, the print-report text and the Report-tab model between `--a` (default `origin/main`; its `shared/` folder is extracted next to it) and `--b` on 31 rectangular projects (default, the PROFIS validation cases, the anchor comparison's C1/C3/C4/C5 in four force-model variants, eleven reinforcement / stand-off / option variants) and, on the computed results only, 2 round-pier projects with the pier cage: any difference fails. Section 2, on `--b`: 4 bolts at 45° on BC = 12√2 must equal the 2×2 grid (≤ 1e-9 relative, 16 cases), hand checks H1 (8-bolt elastic group), H2 (circular plate, LRFDLTS bending line), H3 (round pier: A_Nc by clipping, ψ factors, φN_cbg with and without §17.6.2.1.2), H4 (torsion, vector-sum anchor shear), H5 (`anchorGroup` import with the `lightPole-v1` sign mapping, the anchor-group picker, the `anchorGroupResult` payload), and every worked line of those designs must typeset in KaTeX (the test kit's KaTeX 0.16.9 is injected when the tool's version is not in `libs/`).

## Anchor parity, Light Pole vs Base Plate (`anchor-parity.mjs`)

```bash
node tests/anchor-parity.mjs      # Light Pole anchorBolts() in Node vs the Base Plate & Anchor Designer, 38 pole anchor groups
```

The Light Pole tool's own `anchorBolts()` (`engine/lp-source.mjs`) and the Base Plate & Anchor Designer (bolt circle, circular plate, double nut, elastic group, V/n per anchor) on the comparison cases C1–C6 and 4 / 6 / 8 / 12 bolts × round / square shaft × T 0 / 6 kip·ft × clear stand-off 0 / 1.5 in. Fails unless T_max and ΣT agree to 1e-9, φN_sa / φN_pn / φV_sa to 0.1 % (A_se table vs formula), the Base Plate shear per bolt equals the vector sum and does not exceed the Light Pole's sum of magnitudes, and no design has a validation error. The concrete modes are listed with their known causes.

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

For each case, one line per section with the hash of A and B and `same` or `DIFFERENT`, then for each different section the values that differ (path, A, B), then console errors, dialogs, blocked requests and how long the idle wait took. The exit code is 0 when every section is identical, 1 on a difference, 2 on an error (including console errors). Not counted as console errors: "Failed to load resource" and Babel's size note "[BABEL] Note: The code generator has deoptimised the styling …" (ST-Girder's JSX script passed 500 KB with SBD stage 2, S2-6; the note concerns only the formatting of Babel's output; `compare.mjs`, `st-span.mjs`, `sbd-verify.mjs`, as `ps-compare.mjs` already did). Raw readouts (JSON) are saved in `--out`.

Volatile values are normalized before comparing: ISO time stamps and dates (`2026-10-22`), local date/time text (`10/22/2026, 10:05:19 AM`), millisecond time stamps under `ts`/`savedAt`/`producedAt`/`updatedAt`/`seenAt`-like keys, the `file://` folder a page was opened from, and GirderDetail's file name (`Steel Bridge Beam Modules.html` and `Steel Bridge Design.html` both read `(GirderDetail file)`, so the rename of the merge compares equal).

## Baselines (`baselines/`)

`baselines/gd.json` (and `st.json`) hold the section hashes of every case of the standard matrix, recorded on `origin/main` (the commit is in each case's `a`) with `--record-baseline`. `--baseline FILE` compares B against them without running A. A case passes when every section hash is the same; the values are in the raw readouts of the recording run, not in the repository. Re-record after a change to the tool on main that is meant to change a result.

### Sections

- **gd** (`Steel Bridge Design.html`, named `Steel Bridge Beam Modules.html` until 2026-10-22; a git ref older than the rename is read under the old name): `gd.project` (GirderDetail project data without `ui`), `pl.project` (Preliminary sizing project data), `pl.checks` (every Preliminary sizing check item: location, status, ratio, cells), `pl.analysis` (envelopes, deflections, reactions per girder type), `gd.stPayloads` (the "Send to ST-Girder" payload of every girder, `gdStPayload(g, true)`), `mod.<id>` for df, sa, gs, cf, oh, fa, ts, sc, wt, bstf, splice (every check item after Get demands from Preliminary sizing for the detail modules), `rpt.<id>` (that module's calculation report as text lines, every section, every item worked: the Girder report options; plot images and MathJax rendering are not compared, the TeX source is), `sa.girder1` (Structural analysis of girder 1), `gd.dxf` (DXF export as built in the browser before Pyodide/ezdxf runs: the sheet list with scales, sheets not generated, title block cells, layers, entity count and a hash of every entity; and the R12 writer's sheet list, layers and entity count).
- **st** (ST-Girder: the Design & Rating view of `Steel Bridge Design.html`, frame `gd-st`, read after the tool is idle so its title block is in place; a stand-alone `stgirder.html` given with `--a`/`--b` is read as a page): `st.session` (the inputs after the hand-off was applied, or the built-in example), `st.status`, `st.checks`, `st.rating`, `st.governing`, `st.sections`, `st.stations`, `st.R` (the full computed state `computeAll(session)`, functions stripped), `st.tab.<tab>` (the visible text of every tab, as lines, once it stops changing), `st.report.all` (the Report tab with every section chip on and detail "every station tabulated").
- **sbd** (merged tool vs `stgirder.html`, by default the last copy in the repository history): the **st** sections per girder, prefixed `G1 `, `G2 `, … B opens the case's project in the merged tool (as **gd**), then for each girder calls `window.gdStOpen(g)` (the "Design & Rating (ST-Girder)" view: sends `gdStPayload(g)` to the ST-Girder frame named `gd-st` by message and resolves with the payload once the frame applied it) and reads the frame. A opens `stgirder.html` once and applies the same payloads one after the other with `#gdpull` (G1, then G2, …, as the user does today with "Send to ST-Girder"). The time to open the ST view of each girder is printed (`B: ST view open … ms`).
- **page**: `page.text`, `page.storage`.

## Waiting for GirderDetail to be idle

Opening a project can start automatic work: the bridge is published from Preliminary sizing, demands are refreshed, cross-frames are auto-designed, and a second pass may follow. This takes 20–50 s. Never read results at a fixed time. GirderDetail has `window.gdIdle({ quiet, max, step })` (since 2026-10-15). It returns a Promise that resolves when no demand request is in flight or waiting, no second pass is pending, Preliminary sizing is loaded and ready, and the project data has been unchanged for `quiet` ms (default 8000). It rejects after `max` ms (default 150000). Call `plEnsure()` first if Preliminary sizing may not be loaded yet. `compare.mjs` uses `gdIdle` when the page has it, and the same logic from outside when it doesn't (copies older than 2026-10-15).

## Test projects (`projects/`)

- `gd/xsA.json`, `gd/curb.json`: localStorage seeds (keys `plateline_autosave_v1`, `girderdetail_autosave_v1`, and for curb `girderdetail_inbox_v1`). Both were saved by older versions (2026-10-13), before newer features existed, so they trigger the automatic refresh and migrations on open. These are the standard "xsA" and "curb" projects of the verification matrix. The built-in project (`builtin`) is the app's own example with empty storage; `builtin28` sets all support skews to 28° in Preliminary sizing.
- `gd/util.json` (added 2026-10-15): the built-in project (15° skews) under **MassDOT** with two utility rows in LLDF and DLs: existing utility (UT) 0.30 klf and future utility bay (UF) 0.25 klf at x = 17.5 ft, two adjacent beams, so G2 and G3 carry 0.150 klf existing and 0.125 klf future (OWN16, GD54b/GD54c). Use `--project util --owner MassDOT`.
- `st/util_MassDOT_G2.json` (added 2026-10-15): the "Send to ST-Girder" payload of `gd/util.json`, girder G2, made by the branch claude/gd-st-utilities (GD54c): it carries `M_UT`/`V_UT`/`M_UF`/`V_UF` and `girderDetail.utilities`. Main's ST-Girder ignores the utility fields; the branch applies them (`--payload util_MassDOT_G2`).
- `st/def15_AASHTO_G2_loads.json`, `st/util_MassDOT_G2_loads.json` (added 2026-10-19): the same two cases (built-in 15° under AASHTO, G2; `gd/util.json` under MassDOT, G2) sent by the branch claude/gd-stgirder-load-inputs (GDL): they also carry `girderDetail.loads`, the load inputs ST-Girder shows on its Inputs tab (display only). Main's ST-Girder ignores the field; every result is the same either way.
- `st/def15_AASHTO_G2_gdx.json`, `st/util_MassDOT_G2_gdx.json` (added 2026-10-19): the same two cases sent by the branch claude/gd-stgirder-import-all (GDX): they also carry `girderDetail.details` (stiffeners, studs, fatigue). Updated 2026-10-19 by claude/gd-stgirder-gd70 (GD70): `details` now also has `rowsBy`, `supports` and `cyclesBy`, from which ST-Girder takes the governing d_o, bearing stiffener type, stud zone and n. ST-Girder takes the transferred inputs from them, so against a main older than GDX the constructibility, live load deflection, deck overhang, transverse stiffener, fatigue and stud fatigue checks differ (fixlog/stgirder.md GDX); the `_loads` payloads (loads, no details) change only the first three.
- `st/gd_<project>_<owner>_G<n>.json` (added 2026-10-22, for the merge of GirderDetail and ST-Girder): the "Send to ST-Girder" payload of every girder of `builtin`, `builtin28`, `xsA`, `curb` and `util` under each owner (AASHTO, RIDOT, MassDOT, CTDOT), made by main at the commit in `baselines/gd.json` with `--save-st` (pedestrian load added to LL+IM, the checkbox default). `--tool st --payload all` runs them all. Regenerated 2026-10-22 with `--save-st` by the SBD stage 2 branch claude/sbd-s2-6-studs-per-zone (S2-6): they now carry `girderDetail.details.studs.results` (GirderDetail's Shear connectors results, which ST-Girder checks per zone); the only other difference from the first version is `producerFile` ("Steel Bridge Design.html"). The other payloads (`def15_*`, `util_*`, `xsA_*`) are older and keep ST-Girder's own single-zone stud check.
- `st/s29_builtin28_RIDOT_G2.json`, `st/s29_xsA_MassDOT_G1.json` (added 2026-10-22, S2-9): two `gd_*` hand-offs regenerated by the S2-9 branch, which carry `girderDetail.checks.negFlex` (GirderDetail's negative-flexure result, HANDOFF.md §4.9), so `--tool st` covers ST-Girder's Neg flex / Neg tens taken from GirderDetail (a pass → fail and a fail → pass of the change).
- `st/*.json` (the others): GirderDetail "Send to ST-Girder" payloads (`{ payload }`, channel `girderDemands`, HANDOFF.md §4.9), made by main at 4193ddc: built-in 15° under AASHTO, girder 2; built-in under RIDOT with η_I = yes, girder 2; xsA under RIDOT with η_I = yes, girder 1.

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
- Running A and B in parallel roughly doubles CPU load. GirderDetail cases take about 2 min each; with `--jobs` (default: one case per CPU) a matrix takes about as long as its slowest cases. Use `--jobs 1` on a slow machine if idle waits time out.
- Never commit licensed references (owner manuals, AASHTO text) here or anywhere in the repo.
