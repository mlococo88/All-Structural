/* shared/project-registry.js — where each tool keeps its saved-project list (window.SharedProjectRegistry). Classic script, no DOM.
   Added 2026-11-05 (HSP: "Saved projects" on the home page tools.html; engineer request 2026-11-05).

   One small entry per tool, so a page that is not the tool (the home page) can list the tool's saved projects without running the
   tool's code. Read only: nothing here writes, and it never chooses or changes a key or a stored format (CLAUDE.md §5). Each entry
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
            sort    the tool's mapStore `sort` option ('saved' = newest first; default by name) }
   Order: the order of the cards on the home page.

   Adding a tool: one entry with the same key / time / sort / tool / label as the tool's own mapStore and ctx.cloud.

   API: all() -> the entries; get(tool) -> one entry or null; store(entry, storage) -> SharedProjects.mapStore (projects.js loaded
   first); list(entry, storage) -> { ok, error?, items: [{ name, saved, size }] } (an unreadable list is reported, never changed). */
(function () {
  'use strict';
  const t_ = i => i && i.t || null;   // { t, d } items (Section Property, Shear & Moment, Steel Beam, Timber)
  const TOOLS = [
    { tool: 'moving-load-generator', label: 'Moving Load Generator', name: 'Moving Load Generator', href: 'Moving%20Load%20Generator.html',
      key: 'movingLoadGen.projects.v1', time: d => d && d.savedAt || null, sort: 'saved' },
    { tool: 'bridge-substructure-loading', label: 'Bridge Substructure Loading', name: 'Bridge Substructure Loading', href: 'Bridge%20Substructure%20Loading.html',
      key: 'subloads_projects_v1' },
    { tool: 'asce7-load-generator', label: 'ASCE7-16 Load Generator', name: 'ASCE 7-16 Load Generator', href: 'ASCE7-16%20Load%20Generator.html',
      key: 'asce7bldg.projects' },
    { tool: 'shear-moment-diagrams', label: 'Shear and Moment Diagrams', name: 'Shear & Moment Diagrams', href: 'Shear%20and%20Moment%20Diagrams.html',
      key: 'smd_saves_v1', time: t_, sort: 'saved' },
    { tool: 'stone-arch-rating', label: 'Stone Masonry Arch Load Rating', name: 'Stone Masonry Arch Load Rating', href: 'Stone%20Masonry%20Arch%20Load%20Rating.html',
      key: 'stoneArchLR.projects', time: i => i && (i.saved || i.ts) || null },
    { tool: 'gusset-plate-rating', label: 'Gusset Plate Rating', name: 'Gusset Plate Rating', href: 'Gusset%20Plate%20Rating.html',
      key: 'gussetRating.projects.v1' },
    { tool: 'abutment-calculator', label: 'Abutment Calculator', name: 'Abutment Calculator', href: 'abutment_calculator.html',
      key: 'abutcalc_v1_projects', time: i => i && i.ts || null, sort: 'saved' },   // its own Projects dialog: newest first by ts
    { tool: 'retaining-wall-designer', label: 'Retaining Wall Designer', name: 'Retaining Wall Designer', href: 'Retaining%20Wall%20Designer.html',
      key: 'retaincalcpro.projects.v1', time: i => i && i.ts || null },
    { tool: 'spread-footing', label: 'Spread Footing', name: 'Spread Footing', href: 'Spread%20Footing.html',
      key: 'sfd_projects' },
    { tool: 'light-pole-sign-post', label: 'Light Pole and Sign Post', name: 'Light Pole & Sign Post', href: 'Light%20Pole%20and%20Sign%20Post.html',
      key: 'lpp_projects_v1' },
    { tool: 'base-plate-anchor', label: 'Base Plate & Anchor Designer', name: 'Base Plate & Anchor Designer', href: 'BasePlateAnchorDesigner.html',
      key: 'bpad_projects_v1' },
    { tool: 'steel-beam-aisc', label: 'Steel Beam Design', name: 'Steel Beam Design', href: 'Steel%20Beam%20Design%20-%20AISC%2015th.html',
      key: 'sbd_projects_v1', time: t_, sort: 'saved' },
    { tool: 'timber-beam-check', label: 'Timber Beam Check', name: 'Timber Beam Check', href: 'Timber%20Beam%20Check.html',
      key: 'tbc_projects_v1', time: t_, sort: 'saved' },
    { tool: 'section-property-calculator', label: 'Section Property Calculator', name: 'Section Property Calculator', href: 'Section%20Property%20Calculator.html',
      key: 'spc_projects_v1', time: t_, sort: 'saved' },
    { tool: 'aci-rebar-development', label: 'ACI Rebar Development Length', name: 'Rebar Development & Splices (Concrete Beam Design Suite)', href: 'Concrete%20Beam%20Capacity.html#dev',
      key: 'rebar_aci_projects_v1' }
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
  window.SharedProjectRegistry = { all, get, store, list };
})();
