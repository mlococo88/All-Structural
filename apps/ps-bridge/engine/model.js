/* apps/ps-bridge/engine/model.js — the PS Bridge project data model, schema v1 (window.PSBModel).
   Classic script, no DOM: save/load take the storage object (window.localStorage on the page, a stand-in in tests).
   Created 2026-11-12 (docs/ps-bridge-plan.md §2.4, PR 1 skeleton). Pattern: apps/steel-bridge/engine/model.js (SBDModel):
   the same validate / migrate / importJSON / exportJSON / save / load contract, written for this app (not a copy of its fields).

   Saved-data rules (CLAUDE.md §5): every key this app writes starts with 'psb2.' (KEYS below; 'psb2.' is used by no other tool).
   No key of another tool, and no key of the old Prestressed Bridge Design (psbeam.*), is read or written here. A stored project
   that cannot be read is never overwritten: load() copies it to a backup key first. A later schema version adds a step to
   MIGRATIONS (v -> v+1) and keeps the old reader; nothing is discarded. Fields added later within version 1 are optional:
   a version 1 project without them reads with their defaults (as sbd2 did).

   Units: span lengths, bays and overhangs ft; skews degrees.

   Project (schema 'psb2.project', version 1):
   {
     schema: 'psb2.project', version: 1,
     project: { name, number, owner, designer, checker, date, notes },          text
     spans:   { lengths: [ft, …], continuity: 'simple' | 'composite' },        'composite': simple for the girder and DC1, made
                                                                               continuous for DC2, DW and LL (AASHTO 5.12.3.3; today's cont.on, PS-7)
     xs:      { nb (girders), bays: [ft, …] (nb − 1 girder spacings, left to right, unequal allowed, PS-9),
                ohL, ohR (deck overhang from the exterior girder centreline, ft), skews: [deg, …] (one per support: abutment, piers, abutment) },
     xs.spMode, xs.Wcc  added 2026-11-14 (the Steel Bridge app's equal spacing, EQSP), optional within version 1: spMode 'individual' | 'equal'
                      (absent = individual: every project saved before, unchanged), Wcc (ft; 'equal' only: ℄ to ℄ of the two exterior girders).
                      In 'equal' the page writes S = Wcc / (nb − 1) into every xs.bays entry (applyEqual); everything computed reads xs.bays
                      as before, so spMode and Wcc change no result by themselves.
     base:    { … }   added 2026-11-12 (PR 2a, plan §2.4), optional within version 1: the base girder design, an inputs object of the old
                      app's format (its DEFAULTS shape), always stored as mergeInputs(base) of the moved engine (engine/pbd-merge.js), so a
                      field added to DEFAULTS later is filled in. A project without it (saved by PR 1) reads with the old app's defaults.
                      base.opt.hdCheck, base.opt.hdFrac: added 2026-11-13 (PR 2d-3, PS-10), optional within version 1: the optional hold-down
                      force check for AASHTO / RIDOT (engine/holddown.js), on (true) and 0.75 (× the beam weight) by default. Not in the old
                      app's DEFAULTS: baseInputs() fills them, so a new project and every existing psb2 project read without them get the
                      check ON at 0.75 (the engineer's default); a value saved by the user is kept.
     legacy:  { from, source, importedAt, inputs, bridge, external, summary }  added 2026-11-13 (PR 2f, plan §2.4), optional within version 1:
                      the import record of a design imported from the old app (engine/legacy.js): the old data exactly as read (the inputs object,
                      the old bridge model with every girder × span design, the MIDAS demands not used yet) and the import summary. Kept as it is;
                      nothing reads it for a calculation.
     design:  { g, s }  added 2026-11-12 (PR 2b), optional within version 1: the design girder line and span of the one girder design until the
                      bridge level (PR 3a); absent: G2 (G1 with one girder) in span 1. Read and checked by engine/design.js (not validated here).
     xs.dl:   { mode, method, barL, barR, swL, swR, fws, extra }  added 2026-11-13 (PR 3a-3, PS-9), optional within version 1: DC2 and DW
                      distributed to each girder line by the Steel Bridge app's method (engine/bridge-dl.js). Absent (every project saved
                      before) = 'entered': the values entered per girder type, as before (no migration needed: absence keeps the results).
                      A new project (newProject) has it 'distributed' with the defaults of PSBBridgeDL.defaults.
                      2026-11-14 (PR 9, the Steel Bridge app's cross-section load items), optional within it: barL / barR type ('barrier'
                      | 'curb'), cw, ch, rw, rp, rf, face; swL / swR fence, fenceX; med { w, t, joint }; wcA; wsMode, wsThk, wsGam; ovl [];
                      extra[i].dist and category 'DC1' (engine/bridge-dl.js). Absent = as before (no migration needed; no result changes).
     types:   [{ id, label, span, lines: [g, …], ovr: { '<engine path>': value } }]  added 2026-11-13 (PR 3a-1, plan §2.4 "groups", PS-8), optional
                      within version 1: the girder types of each span on its girder lines (engine/bridge.js): each type is the base design with
                      its own overrides (ovr), checked on every line in lines (1-based, of nb). A project saved without it is migrated on load
                      (importJSON → PSBBridge.migrate): its design girder becomes type T1 on that one line with no override (results unchanged);
                      malformed stored types are kept as typesBad (never discarded). A new project (newProject) has Interior and Exterior types.
     legacySection: { decision, items: [{ where, label, from, to, old: { h, w, A, I, yb }, now }] }  added 2026-11-14 (PS-31), optional within
                      version 1: written when a project that uses one of the old library's box beams or voided deck slabs is opened (importJSON,
                      engine/sections.js migrate): base.girder / types[].ovr.girder become the corrected standard section of the same name (to;
                      null for 'Deck slab 27×48 (voided)': no standard within ±3 in, left as it is and an input error) and the old library
                      values are kept here (old). Nothing reads it for a calculation; the page's notice and the Report's §2 state it.
                      2026-11-14 (PS-38 / PS-40): items { kind: 'rev', rev: 'PS-38' | 'PS-40', where, label, from, to (the same name), old, now }
                      record a section whose library values changed since the project was saved (NEXT 28F I at 144 in; a CTDOT voided slab's
                      void spacing): written once on open when secLib is below the library's (below).
     secLib:  number  added 2026-11-14 (PS-38 / PS-40), optional within version 1: the section library revision (engine/sections.js LIB, 2)
                      of a project that uses a revised section (the NEXT 28F, a CTDOT voided slab). Absent (every project saved before): the
                      open-time check above runs once and writes it; written also when such a project is written (exportJSON: the section
                      chosen with today's library); a new project (newProject) has it. Any other project's stored text is not changed by
                      opening it. Nothing reads it for a calculation.
   }
   Needs the moved engine (engine/pbd-*.js) loaded first for base; without it (a test of this file alone) base is left as it is.
   From PR 2b the engine computes the design girder from base and the bridge values (engine/design.js). */
(function () {
  'use strict';
  const SCHEMA = 'psb2.project', VERSION = 1;
  const KEYS = { current: 'psb2.project.current', backup: 'psb2.project.unreadable.', ui: 'psb2.ui',   // backup + ISO time; ui: the page's tab choices
    libIndex: 'psb2.lib.index', libItem: 'psb2.lib.p.', libCur: 'psb2.lib.current',   // the saved-project list (engine/library.js, PR 5; reserved in PR 1)
    split: 'psb2.splitRatio_v1', dash: 'psb2.dashCollapsed_v1' };   // per-browser UI keys (ui/splitter.js, ui/dash.js); not in the project
  const CONTINUITY = ['simple', 'composite'];
  const isNum = v => typeof v === 'number' && isFinite(v);
  /* baseInputs(saved): the old app's mergeInputs(saved) (DEFAULTS when saved is not an object), as a plain copy (mergeInputs shares
     DEFAULTS' objects); undefined when the moved engine is not loaded. */
  const engineLoaded = () => typeof mergeInputs === 'function';
  function baseInputs(saved) {
    if (!engineLoaded()) return undefined;
    const b = JSON.parse(JSON.stringify(mergeInputs(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : null)));
    if (b.opt && typeof b.opt === 'object') { if (b.opt.hdCheck === undefined) b.opt.hdCheck = true; if (b.opt.hdFrac === undefined) b.opt.hdFrac = 0.75; }   // PS-10 (PR 2d-3): default on, 75 % W
    return b;
  }

  /* defaultProject(): a new project — one 120 ft simple span, 5 girders at 9.0 ft, 3.0 ft overhangs, no skew
     (the old app's default design: L 120 ft, S 9.0 ft, 5 girders, deck overhang 3.0 ft). */
  function defaultProject() {
    return {
      schema: SCHEMA, version: VERSION,
      project: { name: 'New prestressed bridge', number: '', owner: '', designer: '', checker: '', date: '', notes: '' },
      spans: { lengths: [120], continuity: 'simple' },
      xs: { nb: 5, bays: [9, 9, 9, 9], ohL: 3, ohR: 3, skews: [0, 0] },
      ...(engineLoaded() ? { base: baseInputs(null) } : {})
    };
  }

  /* newProject(): the project the page starts a NEW project with (PR 3a-1, engineer decision PS-8, as the steel app's newProject, SB-2):
     defaultProject() with an Interior and an Exterior girder type per span (engine/bridge.js newTypes) and the design girder shown G2 in
     span 1. defaultProject() itself is unchanged (the tests and harnesses use it). Without engine/bridge.js loaded: defaultProject(). */
  function newProject() {
    const p = defaultProject(), B = typeof window !== 'undefined' && window.PSBBridge;
    if (typeof window !== 'undefined' && window.PSBSections && p.base) p.secLib = window.PSBSections.LIB;   // PS-38 / PS-40: today's section library
    if (!B || !p.base) return p;
    p.types = B.newTypes(p); p.design = { g: Math.min(2, p.xs.nb), s: 1 };
    if (window.PSBBridgeDL) p.xs.dl = window.PSBBridgeDL.defaults(p);   // PR 3a-3: DC2 / DW distributed (PS-9)
    // PS-24 (engineer decision 2026-11-13): the entered d_e (loads.de) of every girder type = the d_e computed from this default cross-section
    // (PSBDesign.deOf, PS-20: overhang 3.0 − barrier 1.5 = 1.5 ft; equal overhangs, so G1's value), so a fresh project shows no PS-23 notice.
    // A new project only: saved projects are not changed; the results are the same (the exterior lines already use the computed d_e).
    const D = window.PSBDesign, de = D && p.xs.dl ? D.deOf(p, 1) : null;
    if (de != null && isFinite(de)) { p.base.loads.de = de; p.types.forEach(t => { if (t.ovr && 'loads.de' in t.ovr) t.ovr['loads.de'] = de; }); }
    return p;
  }

  /* validate(p): { errors: [{ path, msg }], warnings: [{ path, msg }] }. Errors block results; nothing is changed. */
  function validate(p) {
    const errors = [], warnings = [], E = (path, msg) => errors.push({ path, msg }), W = (path, msg) => warnings.push({ path, msg });
    const pos = (v, path, what) => { if (!(isNum(v) && v > 0)) E(path, `${what} must be a positive number.`); };
    const nn = (v, path, what) => { if (!(isNum(v) && v >= 0)) E(path, `${what} must be zero or a positive number.`); };
    if (!p || typeof p !== 'object') { E('', 'No project.'); return { errors, warnings }; }
    if (p.schema !== SCHEMA) E('schema', `Not a ${SCHEMA} file.`);
    if (p.version !== VERSION) E('version', `Schema version ${p.version} is not version ${VERSION}.`);
    if (!p.project || typeof p.project !== 'object') E('project', 'Project information is missing.');
    const sp = p.spans || {}, L = Array.isArray(sp.lengths) ? sp.lengths : [];
    if (!L.length) E('spans.lengths', 'Enter at least one span.');
    L.forEach((v, i) => pos(v, `spans.lengths.${i}`, `Span ${i + 1} length`));
    if (!CONTINUITY.includes(sp.continuity)) E('spans.continuity', 'Continuity must be "simple" or "composite".');
    if (L.length === 1 && sp.continuity === 'composite') W('spans.continuity', 'One span: made continuous has no effect.');
    const x = p.xs || {};
    if (!(Number.isInteger(x.nb) && x.nb >= 1)) E('xs.nb', 'Number of girders must be a whole number, 1 or more.');
    const B = Array.isArray(x.bays) ? x.bays : [];
    if (Number.isInteger(x.nb) && x.nb >= 1 && B.length !== x.nb - 1) E('xs.bays', `Enter ${x.nb - 1} girder spacing${x.nb - 1 === 1 ? '' : 's'} (one per bay) for ${x.nb} girders.`);
    B.forEach((v, i) => pos(v, `xs.bays.${i}`, `Bay ${i + 1} spacing`));
    nn(x.ohL, 'xs.ohL', 'Left overhang'); nn(x.ohR, 'xs.ohR', 'Right overhang');
    // 2026-11-14 (equal spacing, the Steel Bridge app's EQSP): optional xs.spMode / xs.Wcc; absent = individual bays (as before)
    if (x.spMode != null && !['individual', 'equal'].includes(x.spMode)) E('xs.spMode', 'Girder spacing: choose individual spacings or equal spacing.');
    if (x.spMode === 'equal') { pos(x.Wcc, 'xs.Wcc', 'Exterior girder spacing W_cc (℄ to ℄ of the exterior girders)'); if (Number.isInteger(x.nb) && x.nb < 2) E('xs.spMode', 'Equal spacing needs 2 girders or more.'); }
    const S = Array.isArray(x.skews) ? x.skews : [];
    if (L.length && S.length !== L.length + 1) E('xs.skews', `Enter ${L.length + 1} support skews (abutment, piers, abutment) for ${L.length} span${L.length === 1 ? '' : 's'}.`);
    S.forEach((v, i) => { if (!(isNum(v) && Math.abs(v) < 90)) E(`xs.skews.${i}`, `Skew at support ${i + 1} must be a number of degrees between −90 and 90.`); });
    if (p.base !== undefined && (!p.base || typeof p.base !== 'object' || Array.isArray(p.base))) E('base', 'The base girder design is not an inputs object.');
    const BR = typeof window !== 'undefined' && window.PSBBridge;   // PR 3a-1: the girder types (engine/bridge.js), when present
    if (p.types !== undefined && BR && !BR.validTypes(p.types)) E('types', 'The girder types cannot be read (each needs an id, a span, its lines and its overrides).');
    return { errors, warnings };
  }

  /* migrate(obj): an older psb2.project brought to VERSION (none yet: version 1 is the first). Returns the object. */
  const MIGRATIONS = {};   // e.g. MIGRATIONS[1] = p => { …; p.version = 2; return p; }
  function migrate(obj) {
    let p = obj;
    while (p && p.schema === SCHEMA && typeof p.version === 'number' && p.version < VERSION) {
      const f = MIGRATIONS[p.version]; if (!f) throw new Error(`No migration from version ${p.version}.`);
      p = f(JSON.parse(JSON.stringify(p)));
    }
    if (p && p.schema === SCHEMA && p.version > VERSION) throw new Error(`This file is schema version ${p.version}; this app reads up to version ${VERSION}. Use a newer copy of the app.`);
    return p;
  }

  /* legacyKind(obj): 'Prestressed Bridge Design' for a file of the old app (its Export JSON: a psbeam inputs object, or a
     psbeam.bridge.v1 bridge), else ''. importJSON refuses such a file (nothing changed); the page then imports it with engine/legacy.js
     ("From the old app", PR 2f). */
  function legacyKind(obj) {
    if (!obj || typeof obj !== 'object' || obj.schema === SCHEMA) return '';
    if (obj.girder != null && obj.mat && obj.str && Array.isArray(obj.rows)) return 'Prestressed Bridge Design';   // psbeam.inputs.v1 shape (DEFAULTS)
    if (obj.designs && typeof obj.designs === 'object' && (obj.mode === 'pl' || obj.mode === 'mod')) return 'Prestressed Bridge Design';   // psbeam.bridge.v1 shape
    return '';
  }

  /* exportJSON(p): the file text (pretty-printed). importJSON(text): { ok, project, errors, warnings, notes } or { ok: false, error }. */
  function exportJSON(p) {
    if (typeof window !== 'undefined' && window.PSBSections && window.PSBSections.stamp) window.PSBSections.stamp(p);   // PS-38 / PS-40: secLib on a project that uses a revised section (chosen with today's library)
    return JSON.stringify(p, null, 2);
  }
  function importJSON(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: `Not a JSON file: ${e.message}` }; }
    const k = legacyKind(obj);
    if (k) return { ok: false, legacy: k, error: `${k} (old app) file: import it with "From the old app" on the Project tab. The file was not changed.` };
    if (!obj || obj.schema !== SCHEMA) return { ok: false, error: 'Not a PS Bridge (psb2) project file.' };
    let p; try { p = migrate(obj); } catch (e) { return { ok: false, error: e.message }; }
    if (engineLoaded() && (p.base === undefined || (p.base && typeof p.base === 'object' && !Array.isArray(p.base)))) p.base = baseInputs(p.base);   // filled / merged onto DEFAULTS
    const notes = [], BR = typeof window !== 'undefined' && window.PSBBridge;
    if (BR && p.base && typeof p.base === 'object') { const n = BR.migrate(p); if (n) notes.push(n); }   // PR 3a-1: girder types (a project saved before: its design girder = type T1)
    if (BR && typeof window !== 'undefined' && window.PSBLegacy && p.legacy) { const n = window.PSBLegacy.restore(p); if (n) notes.push(n); }   // PR 3a-4 (PS-17): an old bridge model's other designs as girder types
    if (typeof window !== 'undefined' && window.PSBSections) { const n = window.PSBSections.migrate(p); if (n) notes.push(n); }   // PS-31: an old box / voided slab name -> the corrected standard section (P.legacySection)
    const v = validate(p);
    return { ok: true, project: p, errors: v.errors, warnings: v.warnings, notes };
  }

  /* save(storage, p): writes the project to KEYS.current. Returns true, or false if storage refused (quota, privacy mode). */
  function save(storage, p) {
    try { storage.setItem(KEYS.current, exportJSON(p)); return true; } catch (e) { return false; }
  }
  /* load(storage, now): { project, errors, warnings, source: 'saved' | 'default', note, notes, noAutosave }. No saved project: newProject()
     (PR 3a-1; before: defaultProject(), the same design with no girder types). A stored text that cannot be
     read is copied to KEYS.backup + time before the default project is returned, so the next save does not lose it; if that copy fails
     (storage full) noAutosave is true and the page must not autosave over the original key. */
  function load(storage, now) {
    let raw = null;
    try { raw = storage.getItem(KEYS.current); } catch (e) { raw = null; }
    if (raw == null) { const p = newProject(); return { project: p, ...validate(p), source: 'default', note: '', notes: [] }; }
    const r = importJSON(raw);
    if (r.ok) return { project: r.project, errors: r.errors, warnings: r.warnings, source: 'saved', note: '', notes: r.notes };
    const bk = KEYS.backup + (now || new Date().toISOString());
    let kept = true; try { storage.setItem(bk, raw); } catch (e) { kept = false; }
    const p = newProject();
    return { project: p, ...validate(p), source: 'default', noAutosave: !kept, notes: [],
      note: kept ? `The saved project could not be read (${r.error}). It was kept under "${bk}"; a new project was started.`
        : `The saved project could not be read (${r.error}) and could not be backed up (storage full). It is left as it was; autosave is off until you export.` };
  }

  /* totalLength(p), girderOffsets(p): display helpers (ft) — the bridge length and each girder's distance from the left deck edge. */
  const totalLength = p => ((p && p.spans && p.spans.lengths) || []).reduce((a, b) => a + (isNum(b) ? b : 0), 0);
  /* equalSpacing(xs): COPY of apps/steel-bridge/engine/model.js equalSpacing (EQSP, 2026-11-09), to move to shared/ later (CLAUDE.md §3):
     the equal girder spacing S = W_cc / (N_b − 1) of xs.Wcc (exterior girder spacing, ℄ to ℄ of G1 and G<nb>) and xs.nb, written by the
     page into every xs.bays entry when xs.spMode = 'equal' (applyEqual). -> { nb, Wcc, S (ft; NaN when nb < 2 or W_cc is not a number),
     bays: [S × (nb − 1)], step (SharedSteps form, id 'xs.eqS') }. */
  function equalSpacing(xs) {
    const x = xs || {}, nb = Math.round(+x.nb), Wcc = x.Wcc == null || x.Wcc === '' ? NaN : +x.Wcc, ok = Number.isInteger(nb) && nb >= 2 && nb < 100;
    const S = ok && isFinite(Wcc) ? Wcc / (nb - 1) : NaN, fm = (v, d) => isFinite(v) ? (+v).toFixed(d) : '\\text{—}';
    const step = { id: 'xs.eqS', label: 'Girder spacing, girders equally spaced', sym: 'S', eq: '\\frac{W_{cc}}{N_{b} \\minus 1}', sub: `\\frac{${fm(Wcc, 3)}}{${ok ? nb : '\\text{—}'} \\minus 1}`,
      value: S, unit: 'ft', d: 3, ref: '', note: 'W_cc: exterior girder spacing, centreline to centreline of the two exterior girders; N_b − 1 bays, all at S.' };
    return { nb, Wcc, S, bays: ok ? new Array(nb - 1).fill(S) : [], step };
  }
  /* applyEqual(P): in equal spacing, every bay = S (the Steel Bridge app's applyEqual, ui/loads.js); individual (or absent): nothing */
  const applyEqual = P => { if (P && P.xs && P.xs.spMode === 'equal') { const Q = equalSpacing(P.xs); if (Q.bays.length) P.xs.bays = Q.bays; } };
  function girderOffsets(p) {
    const x = (p && p.xs) || {}, out = [isNum(x.ohL) ? x.ohL : 0];
    (x.bays || []).forEach(b => out.push(out[out.length - 1] + (isNum(b) ? b : 0)));
    return out;
  }

  window.PSBModel = { SCHEMA, VERSION, KEYS, CONTINUITY, defaultProject, newProject, validate, migrate, legacyKind, exportJSON, importJSON, save, load, totalLength, girderOffsets, baseInputs, equalSpacing, applyEqual };
})();
