# Plan: a leaner All-Structural (draft for discussion, 2026-10-29)

Nothing in the repo changes until you approve this.

## 1. Goal
Make each change to a tool a short session, not hours or days.
- **Cheaper to read:** small files.
- **One copy of each piece of shared logic:** fix once, fixed everywhere.
- **Fast tests:** calculation tests run in Node in seconds; browser tests are kept to a small smoke set.

It must still open by double-click from `file://` on the work laptop, with no install and no build step.

## 2. One repo or several?
**One repo.** The point of the change is shared code: one truck library, one moving-load engine, one LLDF, one report viewer.

With separate repos, each shared file would have to be copied into every repo, which is the duplication we're removing. The alternative is git submodules, which are fiddly to download and keep in step.

With one repo:
- one ZIP download gives you every tool;
- tools find shared files by relative path;
- one test run covers every tool that uses a changed shared file.

`Structural_References` stays a separate private repo, as today.

## 3. New layout
```
tools.html                         ← the launcher, as today
shared/                            ← loaded with <script src="../../shared/…">
  units.js          one place for unit conversions and formatting
  vehicles.js       one verified truck library (HL-93, HS20, legal SU4–SU7, 3S2, 3-3, EV2/EV3, E80…)
  moving-load.js    beam analysis: influence lines, LL envelopes, DL stages, variable EI, any span count
  lldf.js           distribution factors (lldf.html's verified engine)
  aisc-shapes.js    one shapes table (Steel Beam, Base Plate, Gusset, Section Properties…)
  rebar.js          ACI development length (today embedded in Concrete Beam Capacity too)
  report.js         Gusset-style calc report: in-app Report tab, navigation tree, print, "see §x.y" links
  ui.js / ui.css    the common layout: input and output panels, tabs, cards, touch support
  storage.js        project save/load, versioned format with migrations, per-tool key prefixes
  handoff.js        bridgeSuite.v1.* cross-tool handoff (keys unchanged)
  dxf.js            one DXF R12 writer (Base Plate, Gusset, Section Properties, Bridge Geometry, Steel Bridge)
  draw.js           SVG drawing and chart helpers
apps/
  steel-bridge/     index.html + engine/*.js + ui/*.js
  moving-load/      …
  (other tools move here when they are next worked on)
tests/
  engine/           Node tests: hand-check cases plus comparison with the old tools' results
  smoke/            a few browser tests per app
```
Old file names (`Steel Bridge Design.html`, `lldf.html`, `index.html`, …) stay as small redirect pages, so existing links and bookmarks keep working.

**What `file://` still rules out** (I handle these; nothing changes for you):
- browsers block JavaScript modules and loading data files from `file://`, so tools use plain `<script src>` tags and data lives in `.js` files;
- all tools still share one localStorage origin in Chrome/Edge, so keys stay prefixed per tool.

**Copying to the work laptop:** copy the whole repo folder (or ZIP) and open from `tools.html`. A single tool file copied on its own will no longer work; that's the one habit to change.

## 4. Where splitting pays off, tool by tool
| Tool | Size | What to do | Why |
|---|---|---|---|
| Steel Bridge Design | 2.9 MB | Full rebuild (§5) | Three apps in one file; slow changes and tests |
| Moving Load Generator | 0.2 MB | Pilot: becomes the user of `shared/moving-load.js` and `vehicles.js` | One analysis engine for every tool |
| lldf | 1.0 MB | Engine moves to `shared/lldf.js`; the page stays | Steel Bridge, index and Prestressed duplicate it today |
| Concrete Beam Capacity + ACI Rebar | 1.2 + 0.75 MB | `shared/rebar.js` | The rebar app is embedded twice today |
| index, Stone Arch, Substructure Loading | 1.4 / 0.8 / 0.5 MB | Switch to `shared/vehicles.js` | The audit found wrong legal-truck data in index and the arch tool |
| All 17 tools getting a Report tab | — | `shared/report.js`, one viewer | Not 17 copies of the Gusset pattern |
| Pile Designer, Base Plate, abutment, Prestressed | 0.8–1.8 MB | Split into `apps/<tool>/` when each is next worked on | Large, actively edited |
| Small or stable tools (Timber, S&M, elastomeric, Concrete Beam ASD, Spread Footing…) | under 0.5 MB | Leave alone unless they gain a shared engine | Low benefit |

**Hybrid path:** an existing single-file tool can load a shared file with one `<script src>` line, without being restructured. So the shared truck library, LLDF and report viewer can reach every tool quickly; full restructuring happens only where it pays.

## 5. Steel Bridge Design rebuild
**Scope:** every current feature except the deck slab design and the deck overhang design. The overhang-bracket effect on the exterior girder (f_ℓ in constructibility) is kept, because it's a girder check.

**Engine** (`apps/steel-bridge/engine/`): one engine, a pure function per check. Each check returns:
- value, capacity and ratio;
- the AASHTO article (10th Ed.);
- the worked steps: equation, substituted values, result.

The screen, the printed report and the tests all render those same steps, so "show the work and link to it" (§6) is built in.

**Workflow:** Project → Cross-section & loads → Analysis → Girder design (every girder and span, rating included) → Details (splices, stiffeners, cross-frames, studs, welds) → Report.
- Preliminary sizing, Suggest and Optimize run on the same engine at a lower detail level, so there are no more mismatches.
- MIDAS/MCT envelopes stay, as an "external demands" input.

**User interface:**
- the Base Plate layout (two scrolling panels with tabs) and works on a tablet;
- a results grid of every girder × every check, colored by ratio, where clicking a cell opens its derivation;
- outdated results are marked when inputs change, instead of recalculating on every keystroke;
- the in-app Report tab with a navigation tree.

**Libraries:**
- React and Babel are dropped;
- one equation renderer instead of two;
- Plotly is replaced by simple SVG charts;
- the Python-in-browser DXF export (a very large download) is replaced by `shared/dxf.js`;
- three.js stays for 3D.

**Project files:** one versioned format. It imports old GirderDetail, Preliminary sizing and ST-Girder projects and autosaves; nothing is discarded (§5).

**Accuracy gate:** a module is done only when:
- its hand-check cases pass, and
- it matches today's app on the 108 test girders.

Any difference comes to you with its cause before it's accepted. The current app stays untouched and in use until the switch-over.

## 6. Order of work
| Phase | Work | PRs (rough) |
|---|---|---|
| 0 | Update CLAUDE.md for the new structure; set up the folder layout, Node test runner, `units.js`, `storage.js` | 1–2 |
| 1 | **Pilot:** `shared/moving-load.js` (Moving Load Generator's engine, extended with DL stages, construction and pour cases, span count as needed) + `vehicles.js`; Moving Load Generator switched to them, results unchanged | 3–4 |
| 2 | `shared/report.js` + `ui.js`; this replaces the queued "Report tab in 17 apps" work with one viewer | 2–3, then 1 small PR per app |
| 3 | Steel Bridge rebuild: engine module by module, with the UI and report as each lands | 20–30 |
| 4 | Switch-over: `Steel Bridge Design.html` becomes a redirect, old projects import | 1–2 |
| later | `shared/lldf.js`, `rebar.js`, `aisc-shapes.js`; split the big tools when next worked on | as needed |

Phase 1 is the trial. If the new way isn't clearly faster and cheaper there, we stop and reconsider before the big rebuild.

## 7. Rule changes for CLAUDE.md (needs your OK)
- **§1:** tools may be a folder of plain HTML/JS/CSS files. Still no build step, still opens by double-click from `file://`, still CDN libraries only.
- **§3:** shared logic lives once in `shared/`. A PR that changes a shared file runs the tests of every tool that uses it and lists those tools.
- **§7:** a PR may change one shared file plus the tools that consume it.
- **§8:** fixlogs per app (`fixlog/<app>.md`) and per shared file (`fixlog/shared-<name>.md`).
- **§4, §5, §6, §9 are unchanged:** change control on calculations, saved data, showing the work, asking when unsure.

## 8. Decisions (approved 2026-10-29)

**Approved 2026-10-29** by the engineer, all five as recommended: one repo with `shared/` and `apps/`; the §7 rule changes (merged in #460); Steel Bridge scope drops deck slab and overhang design and keeps the f_ℓ girder check; start with the Phase 1 pilot; the Report tabs wait for `shared/report.js`.

1. Approve one repo and the folder layout above.
2. Approve the CLAUDE.md changes in §7.
3. Confirm the scope: drop deck slab and overhang design, keep the f_ℓ girder check.
4. Start with the Phase 1 pilot (Moving Load Generator plus the shared engine)?
5. Do you still want the 17 Report tabs next week, or shall they wait for `shared/report.js` (Phase 2)? Waiting saves most of that work.
