/* apps/steel-bridge/engine/model.js — the Steel Bridge Design project data model, schema v1 (window.SBDModel).
   Classic script, no DOM: save/load take the storage object (window.localStorage on the page, a stand-in in tests).
   Created 2026-10-29 (docs/REBUILD_PLAN.md §5, "Project files: one versioned format").

   Saved-data rules (CLAUDE.md §5): every key this app writes starts with 'sbd2.' (KEYS below); no key of another tool
   or of the old Steel Bridge Design is read or written. A stored project that cannot be read is never overwritten:
   load() copies it to a backup key first. A later schema version adds a step to MIGRATIONS (v -> v+1) and keeps the
   old reader; nothing is discarded.

   Units: span lengths and stations ft; plates, deck and b_eff in; areas in^2; strengths ksi; unit weight kcf.

   Project (schema 'sbd2.project', version 1):
   {
     schema: 'sbd2.project', version: 1,
     project:   { name, number, owner, designer, checker, date, notes },      text
     spans:     { lengths: [ft, …], continuity: 'continuous' | 'simple' },
     materials: { steel: { top, bot, web } (grade keys of GRADES), Es (ksi),
                  concrete: { fc (ksi), wc (kcf), K1, nRule: 'exact' | 'round' }, rebar: { Fyr (ksi) } },
     deck:      { composite: true | false, ts (structural slab), tdeck (total), haunch (top of steel to bottom of slab),
                  rebar: { top: { A (in^2 per girder, within b_eff), c (centroid below top of slab) },
                           bot: { A, c (centroid above bottom of slab) } },
                  rebarInPositiveMp: false (App. D6.1: count the deck rebar in the positive plastic moment) },
     girders:   [ { id, label, position: 'interior' | 'exterior', beff (in),
                    segments: [ { x0, x1 (ft from the left end), D, tw, topB, topT, botB, botT (in) } ] } ]
   } */
(function () {
  'use strict';
  const SCHEMA = 'sbd2.project', VERSION = 1;
  const KEYS = { current: 'sbd2.project.current', backup: 'sbd2.project.unreadable.', ui: 'sbd2.ui' };   // backup + ISO time; ui: the page's tab choices
  // steel grades: F_y, F_u (ksi), as GirderDetail's GD_GR (ASTM A709)
  const GRADES = { '36': { Fy: 36, Fu: 58 }, '50': { Fy: 50, Fu: 65 }, '50W': { Fy: 50, Fu: 70 }, 'HPS50W': { Fy: 50, Fu: 70 }, 'HPS70W': { Fy: 70, Fu: 85 } };

  /* defaultProject(): a new project — 3-span continuous 110-140-110 ft, one interior girder with GirderDetail's built-in
     Girder section plates (positive region 16 × 3/4 top, 60 × 9/16 web, 16 × 1 1/8 bottom; pier region 18 × 1 1/2,
     18 × 2) and its deck (8 in slab, 2 in haunch, b_eff 114 in, A_r 6.6 / 3.2 in^2). */
  function defaultProject() {
    const pos = { D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125 }, neg = { D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 };
    return {
      schema: SCHEMA, version: VERSION,
      project: { name: 'New steel bridge', number: '', owner: '', designer: '', checker: '', date: '', notes: '' },
      spans: { lengths: [110, 140, 110], continuity: 'continuous' },
      materials: { steel: { top: '50W', bot: '50W', web: '50W' }, Es: 29000, concrete: { fc: 4, wc: 0.150, K1: 1.0, nRule: 'exact' }, rebar: { Fyr: 60 } },
      deck: { composite: true, ts: 8, tdeck: 8.5, haunch: 2, rebar: { top: { A: 6.6, c: 2.5 }, bot: { A: 3.2, c: 1.75 } }, rebarInPositiveMp: false },
      girders: [{ id: 'G1', label: 'G1', position: 'interior', beff: 114, segments: [
        { x0: 0, x1: 88, ...pos }, { x0: 88, x1: 128, ...neg }, { x0: 128, x1: 232, ...pos }, { x0: 232, x1: 272, ...neg }, { x0: 272, x1: 360, ...pos }] }]
    };
  }

  const isNum = v => typeof v === 'number' && isFinite(v);
  /* validate(p): { errors: [{ path, msg }], warnings: [{ path, msg }] }. Errors stop the calculation; warnings do not. */
  function validate(p) {
    const errors = [], warnings = [], E = (path, msg) => errors.push({ path, msg }), W = (path, msg) => warnings.push({ path, msg });
    const pos = (v, path, what) => { if (!(isNum(v) && v > 0)) E(path, `${what} must be a positive number.`); };
    const nn = (v, path, what) => { if (!(isNum(v) && v >= 0)) E(path, `${what} must be zero or a positive number.`); };
    if (!p || typeof p !== 'object') { E('', 'No project.'); return { errors, warnings }; }
    if (p.schema !== SCHEMA) E('schema', `Not a ${SCHEMA} file.`);
    if (p.version !== VERSION) E('version', `Schema version ${p.version} is not version ${VERSION}.`);
    const sp = p.spans || {}, L = Array.isArray(sp.lengths) ? sp.lengths : [];
    if (!L.length) E('spans.lengths', 'Enter at least one span.');
    L.forEach((v, i) => pos(v, `spans.lengths.${i}`, `Span ${i + 1} length`));
    if (!['continuous', 'simple'].includes(sp.continuity)) E('spans.continuity', 'Continuity must be "continuous" or "simple".');
    const total = L.reduce((a, b) => a + (isNum(b) ? b : 0), 0);
    const m = p.materials || {}, st = m.steel || {}, c = m.concrete || {};
    ['top', 'bot', 'web'].forEach(k => { if (!GRADES[st[k]]) E(`materials.steel.${k}`, `Unknown steel grade "${st[k]}".`); });
    pos(m.Es, 'materials.Es', 'E_s');
    pos(c.fc, 'materials.concrete.fc', "f'c"); pos(c.wc, 'materials.concrete.wc', 'w_c'); pos(c.K1, 'materials.concrete.K1', 'K_1');
    if (!['exact', 'round'].includes(c.nRule)) E('materials.concrete.nRule', 'Modular ratio rule must be "exact" or "round".');
    pos((m.rebar || {}).Fyr, 'materials.rebar.Fyr', 'F_yr');
    const d = p.deck || {};
    if (typeof d.composite !== 'boolean') E('deck.composite', 'Composite must be true or false.');
    pos(d.ts, 'deck.ts', 'Structural slab thickness'); pos(d.tdeck, 'deck.tdeck', 'Total deck thickness'); nn(d.haunch, 'deck.haunch', 'Haunch');
    if (isNum(d.ts) && isNum(d.tdeck) && d.tdeck < d.ts) E('deck.tdeck', 'The total deck thickness is less than the structural thickness.');
    const rb = d.rebar || {};
    ['top', 'bot'].forEach(k => { const r = rb[k] || {}; nn(r.A, `deck.rebar.${k}.A`, `${k === 'top' ? 'Top' : 'Bottom'} rebar area`); pos(r.c, `deck.rebar.${k}.c`, `${k === 'top' ? 'Top' : 'Bottom'} rebar cover to centroid`);
      if (isNum(r.c) && isNum(d.ts) && r.c >= d.ts) E(`deck.rebar.${k}.c`, 'Rebar layers must lie within the structural slab.'); });
    const G = Array.isArray(p.girders) ? p.girders : [];
    if (!G.length) E('girders', 'Enter at least one girder.');
    const ids = new Set();
    G.forEach((g, gi) => {
      const gp = `girders.${gi}`;
      if (!g || typeof g !== 'object') { E(gp, 'Girder is not an object.'); return; }
      if (!g.id || ids.has(g.id)) E(`${gp}.id`, 'Each girder needs its own id.'); ids.add(g.id);
      if (!['interior', 'exterior'].includes(g.position)) E(`${gp}.position`, 'Position must be "interior" or "exterior".');
      if (d.composite) pos(g.beff, `${gp}.beff`, 'Effective flange width');
      const S = Array.isArray(g.segments) ? g.segments : [];
      if (!S.length) E(`${gp}.segments`, `${g.label || g.id}: enter at least one plate segment.`);
      S.forEach((s, si) => {
        const sp2 = `${gp}.segments.${si}`;
        ['D', 'tw', 'topB', 'topT', 'botB', 'botT'].forEach(k => pos(s[k], `${sp2}.${k}`, `${g.label || g.id} segment ${si + 1}: ${k}`));
        if (!(isNum(s.x0) && isNum(s.x1) && s.x1 > s.x0)) E(`${sp2}.x1`, `${g.label || g.id} segment ${si + 1}: x1 must be greater than x0.`);
        const x0 = si ? S[si - 1].x1 : 0;
        if (isNum(s.x0) && isNum(x0) && Math.abs(s.x0 - x0) > 1e-6) E(`${sp2}.x0`, `${g.label || g.id} segment ${si + 1} starts at ${s.x0} ft, not at ${x0} ft (segments must be contiguous from 0).`);
        if (isNum(s.D) && isNum(s.tw) && s.D / s.tw > 150) W(`${sp2}.tw`, `${g.label || g.id} segment ${si + 1}: D/t_w = ${(s.D / s.tw).toFixed(1)} > 150 (6.10.2.1.1).`);
      });
      const last = S[S.length - 1];
      if (last && isNum(last.x1) && total > 0 && Math.abs(last.x1 - total) > 1e-6) E(`${gp}.segments`, `${g.label || g.id}: the segments end at ${last.x1} ft; the girder is ${total} ft long.`);
    });
    return { errors, warnings };
  }

  /* migrate(obj): an older sbd2.project brought to VERSION (none yet: version 1 is the first). Returns the object. */
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

  /* legacyKind(obj): which older tool wrote obj, or '' (GirderDetail / Steel Bridge Design, PlateLine, ST-Girder). */
  function legacyKind(obj) {
    if (!obj || typeof obj !== 'object') return '';
    if (obj._schema === 'stgirder' || obj._schema === 'stgirder-external-demands') return 'ST-Girder';
    if (obj.app === 'SteelBridgeDesign' || obj.app === 'GirderDetail') return 'GirderDetail';
    if (obj.app === 'PlateLine' || obj.app === 'PlateLine-splices') return 'Preliminary sizing (PlateLine)';
    return '';
  }
  /* importLegacy(obj): STUB. Importing old GirderDetail, Preliminary sizing and ST-Girder projects comes in a later PR
     (docs/REBUILD_PLAN.md §5, "Project files"). Until then it reports that and changes nothing. */
  function importLegacy(obj) {
    const k = legacyKind(obj);
    return { ok: false, legacy: k, error: `${k || 'This'} project files cannot be imported yet: importing old GirderDetail, Preliminary sizing and ST-Girder projects comes in a later version of this app. The file was not changed.` };
  }

  /* exportJSON(p): the file text (pretty-printed). importJSON(text): { ok, project, errors, warnings } or { ok: false, error }. */
  function exportJSON(p) { return JSON.stringify(p, null, 2); }
  function importJSON(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: `Not a JSON file: ${e.message}` }; }
    if (legacyKind(obj)) return importLegacy(obj);
    if (!obj || obj.schema !== SCHEMA) return { ok: false, error: 'Not a Steel Bridge Design (sbd2) project file.' };
    let p; try { p = migrate(obj); } catch (e) { return { ok: false, error: e.message }; }
    const v = validate(p);
    return { ok: true, project: p, errors: v.errors, warnings: v.warnings };
  }

  /* save(storage, p): writes the project to KEYS.current. Returns true, or false if storage refused (quota, privacy mode). */
  function save(storage, p) {
    try { storage.setItem(KEYS.current, exportJSON(p)); return true; } catch (e) { return false; }
  }
  /* load(storage): { project, errors, warnings, source: 'saved' | 'default', note, noAutosave }. A stored text that cannot be read
     is copied to KEYS.backup + time before the default project is returned, so the next save does not lose it. */
  function load(storage, now) {
    let raw = null;
    try { raw = storage.getItem(KEYS.current); } catch (e) { raw = null; }
    if (raw == null) { const p = defaultProject(); return { project: p, ...validate(p), source: 'default', note: '' }; }
    const r = importJSON(raw);
    if (r.ok) return { project: r.project, errors: r.errors, warnings: r.warnings, source: 'saved', note: '' };
    const bk = KEYS.backup + (now || new Date().toISOString());
    let kept = true; try { storage.setItem(bk, raw); } catch (e) { kept = false; }
    const p = defaultProject();
    // kept false (storage full): the original key is still untouched; the page must not autosave over it (noAutosave)
    return { project: p, ...validate(p), source: 'default', noAutosave: !kept,
      note: kept ? `The saved project could not be read (${r.error}). It was kept under "${bk}"; a new project was started.`
        : `The saved project could not be read (${r.error}) and could not be backed up (storage full). It is left as it was; autosave is off until you export or save.` };
  }

  window.SBDModel = { SCHEMA, VERSION, KEYS, GRADES, defaultProject, validate, migrate, legacyKind, importLegacy, exportJSON, importJSON, save, load };
})();
