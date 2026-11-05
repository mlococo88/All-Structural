/* shared/project-registry.js — where each tool keeps its saved-project list (window.SharedProjectRegistry). Classic script, no DOM.
   Added 2026-11-05 (HSP: "Saved projects" on the home page tools.html; engineer request 2026-11-05).

   One small entry per tool, so a page that is not the tool (the home page) can list the tool's saved projects without running the
   tool's code. Listing only reads; it never chooses or changes a key or a stored format (CLAUDE.md §5). engine() (HSP PR 2) is the
   tool's own GitHub sync engine (shared/github-sync.js) over the same list, bookkeeping key and file text, so the home page and the
   tool agree on the status and never upload two different files for one project. Each entry
   repeats what the tool itself passes to shared/projects.js mapStore (its own key and its `time` / `sort` options) and to
   shared/projects-ui.js libraryDialog ctx.cloud (`tool`, `label`); tests/smoke/home-projects.mjs checks the home page lists what each
   tool's own Saved projects dialog lists.

   Entry: { tool    the tool's GitHub sync folder (its ctx.cloud.tool),
            label   its ctx.cloud.label,
            name    the name shown on the home page,
            href    the page to open (relative to the repository root, URL-encoded),
            key     the tool's own saved-project list key (a mapStore: one JSON object { "<project name>": item }),
            time    item -> saved time (ms or ISO) or null: the tool's own mapStore `time` option (none: no date); for a tool with
                    its own Projects dialog, the time and order that dialog shows,
            sort    the tool's mapStore `sort` option ('saved' = newest first; default by name),
            space   its ctx.cloud.space (JSON indent of the GitHub file; default 1, as shared/github-sync.js),
            toFile  its ctx.cloud.toFile(item, name) (the GitHub file = the tool's Export JSON; default: the stored item itself),
            sync    false: list only on the home page (the tool's file cannot be made safely outside the tool; "open the app to
                    sync"); default true: the home page may upload this tool's projects with the same file text as the tool }
   toFile is a copy of the tool's own one-line wrapper (no calculation). tests/smoke/home-sync.mjs proves, for every entry with sync,
   that after the home page uploads, the tool itself finds the GitHub file byte-identical to its own file ("synced", no upload).
   Order: the order of the cards on the home page.

   Adding a tool: one entry with the same key / time / sort / tool / label / space / toFile as the tool's own mapStore and ctx.cloud,
   and its key in tests/smoke/home-projects.mjs FOLDER (the tests then cover it). When its toFile calls the tool's own code (more than
   wrapping the stored item), give sync: false instead of a toFile.

   API: all() -> the entries; get(tool) -> one entry or null; store(entry, storage) -> SharedProjects.mapStore (projects.js loaded
   first); list(entry, storage) -> { ok, error?, items: [{ name, saved, size }] } (an unreadable list is reported, never changed);
   fileText(entry, item, name) -> the text of the GitHub file (null when the entry has sync: false);
   engine(entry, storage, fetch, o) -> SharedGitHubSync.engine for this tool (github-sync.js loaded; o: onNotice, now, device), or null
   for sync: false. It never downloads into the tool's list (fromFile refuses: "open the app"); uploads follow the tool's rules. */
(function () {
  'use strict';
  const t_ = i => i && i.t || null;   // { t, d } items (Section Property, Shear & Moment, Steel Beam, Timber)
  const TOOLS = [
    { tool: 'moving-load-generator', label: 'Moving Load Generator', name: 'Moving Load Generator', href: 'Moving%20Load%20Generator.html',
      key: 'movingLoadGen.projects.v1', time: d => d && d.savedAt || null, sort: 'saved', space: 1 },
    { tool: 'bridge-substructure-loading', label: 'Bridge Substructure Loading', name: 'Bridge Substructure Loading', href: 'Bridge%20Substructure%20Loading.html',
      key: 'subloads_projects_v1', space: 1 },
    { tool: 'asce7-load-generator', label: 'ASCE7-16 Load Generator', name: 'ASCE 7-16 Load Generator', href: 'ASCE7-16%20Load%20Generator.html',
      key: 'asce7bldg.projects', space: 2 },
    { tool: 'shear-moment-diagrams', label: 'Shear and Moment Diagrams', name: 'Shear & Moment Diagrams', href: 'Shear%20and%20Moment%20Diagrams.html',
      key: 'smd_saves_v1', time: t_, sort: 'saved', space: 1, toFile: i => i.d },
    { tool: 'stone-arch-rating', label: 'Stone Masonry Arch Load Rating', name: 'Stone Masonry Arch Load Rating', href: 'Stone%20Masonry%20Arch%20Load%20Rating.html',
      key: 'stoneArchLR.projects', time: i => i && (i.saved || i.ts) || null, space: 2 },
    { tool: 'gusset-plate-rating', label: 'Gusset Plate Rating', name: 'Gusset Plate Rating', href: 'Gusset%20Plate%20Rating.html',
      key: 'gussetRating.projects.v1', space: 2,
      // the tool: toFile: i => { const e = GPR.exportProject(i); delete e.savedAt; return e; }, exportProject(P) = { _schema: SCHEMA, version: (P.members || []).some(m => m.pattern === 'custom') ? 2 : 1, app, savedAt, data: P }
      toFile: i => ({ _schema: 'gusset-rating-project', version: (i.members || []).some(m => m.pattern === 'custom') ? 2 : 1, app: 'Gusset Plate Rating', data: i }) },
    { tool: 'abutment-calculator', label: 'Abutment Calculator', name: 'Abutment Calculator', href: 'abutment_calculator.html',
      key: 'abutcalc_v1_projects', time: i => i && i.ts || null, sort: 'saved', space: 2, toFile: i => i.state },   // its own Projects dialog: newest first by ts
    { tool: 'elastomeric-bearing', label: 'Elastomeric Bearing Design', name: 'Elastomeric Bearing Design', href: 'elastomeric_design_module.html',
      key: 'edm_v1_projects', time: i => i && i.ts || null, sort: 'saved', space: 2, toFile: i => i.state },   // its own Projects dialog: newest first by ts
    { tool: 'retaining-wall-designer', label: 'Retaining Wall Designer', name: 'Retaining Wall Designer', href: 'Retaining%20Wall%20Designer.html',
      key: 'retaincalcpro.projects.v1', time: i => i && i.ts || null, space: 2,
      toFile: (i, n) => ({ format: 'RetainCalcPro.project', version: 1, name: n, fields: i.fields }) },
    { tool: 'spread-footing', label: 'Spread Footing', name: 'Spread Footing', href: 'Spread%20Footing.html',
      key: 'sfd_projects' },
    { tool: 'light-pole-sign-post', label: 'Light Pole and Sign Post', name: 'Light Pole & Sign Post', href: 'Light%20Pole%20and%20Sign%20Post.html',
      key: 'lpp_projects_v1', space: 1,
      toFile: (i, n) => ({ tool: 'Light Pole and Sign Post', format: 'lpp-project', version: 1, name: n, state: i }) },
    { tool: 'base-plate-anchor', label: 'Base Plate & Anchor Designer', name: 'Base Plate & Anchor Designer', href: 'BasePlateAnchorDesigner.html',
      key: 'bpad_projects_v1', space: 2, toFile: i => Object.assign({ _bpad: 'project', _bpadVersion: 1 }, i) },
    { tool: 'steel-beam-aisc', label: 'Steel Beam Design', name: 'Steel Beam Design', href: 'Steel%20Beam%20Design%20-%20AISC%2015th.html',
      key: 'sbd_projects_v1', time: t_, sort: 'saved', space: 1, toFile: i => i.d },
    { tool: 'timber-beam-check', label: 'Timber Beam Check', name: 'Timber Beam Check', href: 'Timber%20Beam%20Check.html',
      key: 'tbc_projects_v1', time: t_, sort: 'saved', space: 2, toFile: i => i.d },
    { tool: 'section-property-calculator', label: 'Section Property Calculator', name: 'Section Property Calculator', href: 'Section%20Property%20Calculator.html',
      key: 'spc_projects_v1', time: t_, sort: 'saved', space: 2, toFile: i => i.d },
    { tool: 'aci-rebar-development', label: 'ACI Rebar Development Length', name: 'Rebar Development & Splices (Concrete Beam Design Suite)', href: 'Concrete%20Beam%20Capacity.html#dev',
      key: 'rebar_aci_projects_v1', space: 2 }
  ];
  const all = () => TOOLS.slice();
  const get = tool => TOOLS.find(e => e.tool === tool) || null;
  function store(e, storage) {
    const P = window.SharedProjects; if (!P || !P.mapStore) throw new Error('project-registry: load shared/projects.js first');
    const o = {}; if (e.time) o.time = e.time; if (e.sort) o.sort = e.sort;
    return P.mapStore(storage, e.key, o);
  }
  function list(e, storage) {
    let s; try { s = store(e, storage); } catch (x) { return { ok: false, error: 'storage', items: [] }; }
    const r = s.read(); if (!r.ok) return { ok: false, error: r.error, items: [] };
    return { ok: true, items: s.list() };
  }
  /* fileText(e, item, name): exactly what shared/github-sync.js engine fileText() makes for the tool (deep copy, toFile, JSON indent) */
  function fileText(e, item, name) {
    if (e.sync === false || item === undefined) return null;
    const it = JSON.parse(JSON.stringify(item)), f = e.toFile ? e.toFile(it, name) : it;
    return typeof f === 'string' ? f : JSON.stringify(f, null, e.space == null ? 1 : e.space);
  }
  function engine(e, storage, fetchFn, o) {
    const G = window.SharedGitHubSync; if (!G || e.sync === false) return null;
    o = o || {};
    return G.engine({ tool: e.tool, label: e.label, store: store(e, storage), storage, fetch: fetchFn, toFile: e.toFile, space: e.space,
      fromFile: () => { throw new Error(`open ${e.name} to bring a GitHub version into this browser`); },
      now: o.now, device: o.device, onNotice: o.onNotice });
  }
  window.SharedProjectRegistry = { all, get, store, list, fileText, engine };
})();
