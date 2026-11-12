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
     base:    { … }   added 2026-11-12 (PR 2a, plan §2.4), optional within version 1: the base girder design, an inputs object of the old
                      app's format (its DEFAULTS shape), always stored as mergeInputs(base) of the moved engine (engine/pbd-merge.js), so a
                      field added to DEFAULTS later is filled in. A project without it (saved by PR 1) reads with the old app's defaults.
   }
   Needs the moved engine (engine/pbd-*.js) loaded first for base; without it (a test of this file alone) base is left as it is.
   Nothing in the project is used by a calculation yet (the input tabs are wired to base in PR 2b, docs/ps-bridge-plan.md §5). */
(function () {
  'use strict';
  const SCHEMA = 'psb2.project', VERSION = 1;
  const KEYS = { current: 'psb2.project.current', backup: 'psb2.project.unreadable.', ui: 'psb2.ui',   // backup + ISO time; ui: the page's tab choices
    libIndex: 'psb2.lib.index', libItem: 'psb2.lib.p.', libCur: 'psb2.lib.current',   // reserved for the saved-project list (a later PR)
    split: 'psb2.splitRatio_v1', dash: 'psb2.dashCollapsed_v1' };   // per-browser UI keys (ui/splitter.js, ui/dash.js); not in the project
  const CONTINUITY = ['simple', 'composite'];
  const isNum = v => typeof v === 'number' && isFinite(v);
  /* baseInputs(saved): the old app's mergeInputs(saved) (DEFAULTS when saved is not an object), as a plain copy (mergeInputs shares
     DEFAULTS' objects); undefined when the moved engine is not loaded. */
  const engineLoaded = () => typeof mergeInputs === 'function';
  function baseInputs(saved) {
    if (!engineLoaded()) return undefined;
    return JSON.parse(JSON.stringify(mergeInputs(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : null)));
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
    const S = Array.isArray(x.skews) ? x.skews : [];
    if (L.length && S.length !== L.length + 1) E('xs.skews', `Enter ${L.length + 1} support skews (abutment, piers, abutment) for ${L.length} span${L.length === 1 ? '' : 's'}.`);
    S.forEach((v, i) => { if (!(isNum(v) && Math.abs(v) < 90)) E(`xs.skews.${i}`, `Skew at support ${i + 1} must be a number of degrees between −90 and 90.`); });
    if (p.base !== undefined && (!p.base || typeof p.base !== 'object' || Array.isArray(p.base))) E('base', 'The base girder design is not an inputs object.');
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
     psbeam.bridge.v1 bridge), else ''. The import itself ("From old app", read only) comes in PR 2f; until then such a file is refused
     with that message and nothing is changed. */
  function legacyKind(obj) {
    if (!obj || typeof obj !== 'object' || obj.schema === SCHEMA) return '';
    if (obj.girder != null && obj.mat && obj.str && Array.isArray(obj.rows)) return 'Prestressed Bridge Design';   // psbeam.inputs.v1 shape (DEFAULTS)
    if (obj.designs && typeof obj.designs === 'object' && (obj.mode === 'pl' || obj.mode === 'mod')) return 'Prestressed Bridge Design';   // psbeam.bridge.v1 shape
    return '';
  }

  /* exportJSON(p): the file text (pretty-printed). importJSON(text): { ok, project, errors, warnings, notes } or { ok: false, error }. */
  function exportJSON(p) { return JSON.stringify(p, null, 2); }
  function importJSON(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: `Not a JSON file: ${e.message}` }; }
    const k = legacyKind(obj);
    if (k) return { ok: false, legacy: k, error: `${k} (old app) files are imported in a later version of this app. The file was not changed.` };
    if (!obj || obj.schema !== SCHEMA) return { ok: false, error: 'Not a PS Bridge (psb2) project file.' };
    let p; try { p = migrate(obj); } catch (e) { return { ok: false, error: e.message }; }
    if (engineLoaded() && (p.base === undefined || (p.base && typeof p.base === 'object' && !Array.isArray(p.base)))) p.base = baseInputs(p.base);   // filled / merged onto DEFAULTS
    const v = validate(p);
    return { ok: true, project: p, errors: v.errors, warnings: v.warnings, notes: [] };
  }

  /* save(storage, p): writes the project to KEYS.current. Returns true, or false if storage refused (quota, privacy mode). */
  function save(storage, p) {
    try { storage.setItem(KEYS.current, exportJSON(p)); return true; } catch (e) { return false; }
  }
  /* load(storage, now): { project, errors, warnings, source: 'saved' | 'default', note, notes, noAutosave }. A stored text that cannot be
     read is copied to KEYS.backup + time before the default project is returned, so the next save does not lose it; if that copy fails
     (storage full) noAutosave is true and the page must not autosave over the original key. */
  function load(storage, now) {
    let raw = null;
    try { raw = storage.getItem(KEYS.current); } catch (e) { raw = null; }
    if (raw == null) { const p = defaultProject(); return { project: p, ...validate(p), source: 'default', note: '', notes: [] }; }
    const r = importJSON(raw);
    if (r.ok) return { project: r.project, errors: r.errors, warnings: r.warnings, source: 'saved', note: '', notes: r.notes };
    const bk = KEYS.backup + (now || new Date().toISOString());
    let kept = true; try { storage.setItem(bk, raw); } catch (e) { kept = false; }
    const p = defaultProject();
    return { project: p, ...validate(p), source: 'default', noAutosave: !kept, notes: [],
      note: kept ? `The saved project could not be read (${r.error}). It was kept under "${bk}"; a new project was started.`
        : `The saved project could not be read (${r.error}) and could not be backed up (storage full). It is left as it was; autosave is off until you export.` };
  }

  /* totalLength(p), girderOffsets(p): display helpers (ft) — the bridge length and each girder's distance from the left deck edge. */
  const totalLength = p => ((p && p.spans && p.spans.lengths) || []).reduce((a, b) => a + (isNum(b) ? b : 0), 0);
  function girderOffsets(p) {
    const x = (p && p.xs) || {}, out = [isNum(x.ohL) ? x.ohL : 0];
    (x.bays || []).forEach(b => out.push(out[out.length - 1] + (isNum(b) ? b : 0)));
    return out;
  }

  window.PSBModel = { SCHEMA, VERSION, KEYS, CONTINUITY, defaultProject, validate, migrate, legacyKind, exportJSON, importJSON, save, load, totalLength, girderOffsets, baseInputs };
})();
