/* shared/bridge-suite-projects.js — the standard save of the Bridge Suite (window.SharedBridgeSuite). Classic script.
   Added 2026-11-06 (BSS; engineer-approved standard save, 2026-11-05, and the engineer's Bridge Suite decisions of 2026-11-06).
   Used by index.html (MIDAS MCT generator), lldf.html (LL & DL Distribution) and Prestressed Bridge Design.html; read (the toFile and
   the by-name view, copied) by shared/project-registry.js for the home page.

   The three apps share ONE project list, kept by the duplicated BridgeProjects bootstrap at the top of each of them (CLAUDE.md §3):
     bridgeSuite.v1.projects          { "<id>": { name, savedAt (ISO), slices: { mct, lldf, psbeam, psbeamBridge, ... }, demands? } }
     bridgeSuite.v1.currentProjectId  the id of the project open in the suite (every app follows it)
   This file never changes either format (CLAUDE.md §5): every write goes through window.BridgeProjects (saveSlice, rename, del,
   setCurrent), except Duplicate and a project brought from GitHub, which add one entry of the same shape { name, savedAt, slices,
   demands? } with a new id of the same form (bp_<time>_<rand>). Ids stay; duplicate names stay as they are (they are allowed in the
   list): the dialog lists every entry, the newest of a name under the name itself and an older one under
   "<name> (older, saved <Eastern time>)" (a name for the list only: nothing is stored or renamed). Save as does not make a new
   duplicate name (a name in use asks "Replace it": this app's part is saved into that project, the other apps' parts in it are kept).

   GitHub (shared/github-sync.js, off until set up): tool 'bridge-suite' for all three pages (one bookkeeping key
   bridgeSuite.v1.githubSync.tool.bridge-suite and its lock: two open tabs never upload at once). One file per project name (the newest
   entry of the name): projects/bridge-suite/<name>.json = toFile(entry, name) = { app: 'BridgeSuite', v: 1, name, savedAt, slices }
   (every app's part; WITHOUT the MIDAS demands: they come back from the MCT run). Uploaded after the edits pause SETTLE ms (the apps
   save their part on every change), and at once on Save, Sync now and when the page is hidden.

   API: store(o) -> { vStore (the dialog's list), ghStore (the sync's list), view(), vName(id), vItem(name) }
        projectBar(o) -> the shared projectBar (shared/projects-ui.js) over the suite list, or null (no BridgeProjects / projectBar)
          o = { app ('mct' | 'lldf' | 'psbeam': the slice that holds this app's inputs), label, id (dialog id), storage,
                parts(id) -> { <slice>: data, ... } (this app's parts to save; id = the project they go into),
                cmp() -> text of the inputs on screen, cmpOf(entry) -> the same text for a saved entry ("unsaved changes"),
                open(id) -> false when not opened (the app's own open path; it sets the current project),
                afterWrite(id, isNew) (after this app's parts were written: e.g. MCT bundles the demands),
                changed() (the list or the open project changed: the app redraws its own labels),
                displayName(), newProject(), exportFile(name), importFile(), fileButtons, extras, header, chipBefore, headerBefore,
                chipClick() (HDRS: what a chip click does: open the view with the "Save and open" card), chipHint (its tooltip text) }
          The header gets the chip only (headerSave false, HDRS 2026-11-06): Save and Saved projects… are in the card; Ctrl+S / Ctrl+Shift+S.
        toFile(entry, name), fromFile(obj, name), SETTLE, TOOL, LABEL */
(function () {
  'use strict';
  const TOOL = 'bridge-suite', LABEL = 'Bridge Suite (MCT, LL & DL, Prestressed)', SETTLE = 30000;
  const K_PROJ = 'bridgeSuite.v1.projects';
  const clean = n => String(n == null ? '' : n).trim();
  const BP = () => window.BridgeProjects || null;
  const etTime = t => window.SharedProjects && window.SharedProjects.etTime ? window.SharedProjects.etTime(t) : String(t || '');
  /* the GitHub file of one project (the newest entry of its name): every app's part, without the MIDAS demands */
  function toFile(e, name) { return { app: 'BridgeSuite', v: 1, name: name, savedAt: e && e.savedAt || null, slices: e && e.slices || {} }; }
  function fromFile(j, name) {
    if (!j || typeof j !== 'object' || j.app !== 'BridgeSuite' || !j.slices || typeof j.slices !== 'object' || Array.isArray(j.slices)) throw new Error('not a Bridge Suite project file');
    return { name: name, savedAt: typeof j.savedAt === 'string' ? j.savedAt : null, slices: j.slices };
  }
  const newId = () => 'bp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);   // the bootstrap's own form
  const nowIso = () => { try { return new Date().toISOString(); } catch (e) { return ''; } };

  function store(o) {
    o = o || {};
    const S = o.storage;
    function readRaw() {   // { map: id -> entry, ok }
      let t = null; try { t = S ? S.getItem(K_PROJ) : null; } catch (e) { return { map: {}, ok: false, error: 'storage' }; }
      if (t == null || t === '') return { map: {}, ok: true };
      try { const m = JSON.parse(t); if (m && typeof m === 'object' && !Array.isArray(m)) return { map: m, ok: true }; } catch (e) { /* below */ }
      return { map: {}, ok: false, error: 'unreadable' };
    }
    /* entries newest first (the bootstrap's list() order: savedAt descending) */
    function entries() { const m = readRaw().map; return Object.keys(m).filter(id => m[id] && typeof m[id] === 'object').map(id => ({ id, e: m[id] }))
      .sort((a, b) => String(b.e.savedAt || '').localeCompare(String(a.e.savedAt || ''))); }
    function view() {   // { byV: list name -> { id, e }, vOf: id -> list name, byName: name -> newest { id, e } }
      const items = entries(), used = new Set(items.map(i => clean(i.e.name))), byV = new Map(), vOf = new Map(), byName = new Map();
      items.forEach(i => {
        const n = clean(i.e.name) || 'Untitled'; let v = n;
        if (byName.has(n)) { const t = i.e.savedAt ? etTime(i.e.savedAt) : '', base = `${n} (older${t ? ', saved ' + t : ' copy'})`; v = base; let k = 2; while (used.has(v) || byV.has(v)) v = `${base} #${k++}`; }
        else byName.set(n, i);
        byV.set(v, i); vOf.set(i.id, v);
      });
      return { byV, vOf, byName };
    }
    const vItem = v => view().byV.get(v), vName = id => id ? view().vOf.get(id) || null : null;
    const sizeOf = x => { try { return JSON.stringify(x).length; } catch (e) { return 0; } };
    const MISS = { ok: false, error: 'missing', message: 'That saved project is not in this browser any more.' };
    const EXISTS = n => ({ ok: false, error: 'exists', message: `A saved project named "${n}" already exists.` });
    const QUOTA = what => (window.SharedProjects ? window.SharedProjects.fail({ name: 'QuotaExceededError' }, what) : { ok: false, error: 'quota', message: what });
    /* put(id, entry): one entry added or replaced, the rest of the list unchanged (same JSON as the bootstrap's writeReg) */
    function put(id, entry, what) {
      const r = readRaw(); if (!r.ok) return { ok: false, error: 'unreadable', message: `${what} The Bridge Suite project list in this browser could not be read, so it was not changed.` };
      r.map[id] = entry;
      try { S.setItem(K_PROJ, JSON.stringify(r.map)); return { ok: true }; } catch (e) { return window.SharedProjects ? window.SharedProjects.fail(e, what) : QUOTA(what); }
    }
    const stamp = () => { try { return S ? S.getItem(K_PROJ) : null; } catch (e) { return null; } };
    const copyOf = e => JSON.parse(JSON.stringify(e));
    const vStore = { key: K_PROJ, keys: () => [K_PROJ],
      read: () => { const r = readRaw(); return { ok: r.ok, error: r.error, map: {} }; },
      list: () => [...view().byV].map(([v, i]) => ({ name: v, saved: i.e.savedAt || null, size: sizeOf(i.e) })),
      has: v => view().byV.has(v),
      item: v => { const i = vItem(v); return i ? i.e : undefined; },
      get: v => { const i = vItem(v); return i ? i.e : null; },
      save: v => (o.save ? o.save(v) : { ok: false, message: 'Not saved.' }),
      rename: (v, to, ro) => { const { byV } = view(), i = byV.get(v); if (!i) return MISS; to = clean(to); if (!to) return { ok: false, error: 'empty', message: 'Enter a name.' };
        if (to === v) return { ok: true, name: to };
        const t = byV.get(to); if (t && t.id !== i.id && !(ro && ro.replace)) return EXISTS(to);
        if (!BP() || !BP().rename(i.id, to)) return QUOTA('The project was not renamed.');   // the bootstrap's rename: the entry keeps its id, parts and time
        if (t && t.id !== i.id) BP().del(t.id);   // "Replace it" (confirmed in the dialog): the project listed under that name
        return { ok: true, name: vName(i.id) }; },
      duplicate: (v, to, ro) => { const { byV } = view(), i = byV.get(v); if (!i) return MISS; to = clean(to) || vStore.copyName(v);
        const t = byV.get(to); if (t && !(ro && ro.replace)) return EXISTS(to);
        const c = copyOf(i.e); c.name = to; const id = newId(), w = put(id, c, 'The project was not duplicated.'); if (!w.ok) return w;   // the same parts, demands and saved time
        if (t && BP()) BP().del(t.id); return { ok: true, name: vName(id) }; },
      remove: v => { const i = vItem(v); if (!i) return { ok: true }; if (!BP() || !BP().del(i.id)) return QUOTA('The project was not deleted.'); return { ok: true }; },
      copyName: v => { const m = view().byV, base = clean((m.get(v) || { e: { name: v } }).e.name) || v; let n = `${base} (copy)`, k = 2; while (m.has(n)) n = `${base} (copy ${k++})`; return n; },
      stamp };
    /* the sync's list: the newest entry of each name; a file from GitHub goes into that entry (its demands, if any, are kept) or a new one */
    const ghStore = { key: K_PROJ, read: () => { const r = readRaw(); return { ok: r.ok, error: r.error, map: {} }; },
      list: () => [...view().byName.keys()].map(name => ({ name })),
      has: n => view().byName.has(n),
      item: n => { const i = view().byName.get(n); return i ? i.e : undefined; },
      save: (n, q) => { const i = view().byName.get(n), e = { name: n, savedAt: q && q.savedAt || nowIso(), slices: q && q.slices || {} };
        if (i && i.e.demands !== undefined) e.demands = i.e.demands;
        const w = put(i ? i.id : newId(), e, 'The project from GitHub was not saved.'); return w.ok ? { ok: true, name: n } : w; },
      duplicate: (n, to) => { const i = view().byName.get(n); if (!i) return MISS; const c = copyOf(i.e); c.name = to; const w = put(newId(), c, 'The project was not duplicated.'); return w.ok ? { ok: true, name: to } : w; },
      stamp };
    return { vStore, ghStore, view, vName, vItem, entries, readRaw };
  }

  function projectBar(o) {
    const SPUI = window.SharedProjectsUI;
    if (!BP() || !SPUI || !SPUI.projectBar || !o.storage) return null;
    let ready = false, pb = null;
    const st = store({ storage: o.storage, save: v => save(v) });
    const { vStore, ghStore, vItem, vName } = st;
    /* save(v): Save (v = the open project's list name: this app's parts into it) or Save as (another name: the project listed under it,
       after "Replace it", else a new project holding this app's parts). The project becomes the open project of the suite. */
    function save(v) {
      const i = vItem(v), isNew = !i; let id = i ? i.id : null;
      const fail = { ok: false, message: 'The project was not saved: browser storage is not available or is full. Use Export JSON to keep it.' };
      if (!id) { const p0 = o.parts(null), k0 = Object.keys(p0)[0]; id = BP().saveSlice(null, clean(v) || 'Untitled', k0, p0[k0]); if (!id) return fail; }
      const pr = o.parts(id);
      for (const k of Object.keys(pr)) if (!BP().saveSlice(id, undefined, k, pr[k])) return fail;
      BP().setCurrent(id);
      if (o.afterWrite) { try { o.afterWrite(id, isNew); } catch (e) { /* the parts are saved */ } }
      if (o.changed) o.changed();
      return { ok: true, name: vName(id) };
    }
    const curName = () => vName(BP().current()) || '';
    const SYNC = { cloud: { tool: 'bridge-suite', label: 'Bridge Suite (MCT, LL & DL, Prestressed)', toFile: toFile, fromFile: fromFile, store: ghStore, settle: SETTLE } };   // = TOOL, LABEL (tests/engine/project-registry.test.mjs checks this line)
    const cloud = window.SharedGitHubSync ? SYNC.cloud : undefined;
    pb = SPUI.projectBar({ store: vStore, storage: o.storage, label: o.label, id: o.id, askUnsaved: 'always',
      snapshot: () => o.cmp(),
      snapOf: v => { const i = vItem(v); return i ? o.cmpOf(i.e) : null; },
      current: curName,
      setCurrent: v => { if (!ready) return;   // not while the bar is made: opening a page never changes the suite's open project
        if (!v) { BP().setCurrent(null); if (o.changed) o.changed(); return; }
        const i = vItem(v); if (i && i.id !== BP().current()) { BP().setCurrent(i.id); if (o.changed) o.changed(); } },
      displayName: o.displayName,
      save,
      open: v => { const i = vItem(v); if (!i) return false; return o.open(i.id); },
      newProject: o.newProject, exportFile: o.exportFile, importFile: o.importFile, fileButtons: o.fileButtons, extras: o.extras,
      header: o.header, chipBefore: o.chipBefore, headerBefore: o.headerBefore, card: true,
      headerSave: false, chipClick: o.chipClick, chipHint: o.chipHint,   // HDRS (2026-11-06): the chip only in the header (Save / Saved projects… in the card); the chip opens the app's card
      renamed: () => { if (o.changed) o.changed(); }, deleted: () => { if (o.changed) o.changed(); }, changed: () => { if (o.changed) o.changed(); },
      note: o.note || '<p class="spNote">One project holds every Bridge Suite app’s part (MCT generator, LL &amp; DL Distribution, Prestressed Bridge Design) and the MIDAS demands. Open makes it the open project in all three apps. Rename, Duplicate and Delete act on the whole project (every app’s part). Export makes one .json of the whole project (the GitHub file: every app’s part, without the MIDAS demands).</p>',
      exportOne: v => { const i = vItem(v); if (!i) return; const n = clean(i.e.name) || 'bridge-suite'; SPUI.download(n.replace(/[^\w.-]+/g, '_') + '.bridge-suite.json', JSON.stringify(toFile(i.e, n), null, 1)); },
      ghNote: v => { const i = vItem(v); return i && v !== clean(i.e.name) ? '<span class="spNote" data-sp="gh-cell">not synced: a newer saved project has the same name (Rename this one to sync it)</span>' : ''; },
      cloud });
    ready = true;
    /* GitHub: Save uploads at once (projects-ui.js done(): tick(true)); here also when the page is hidden */
    const eng = () => pb.dialog.cloud && pb.dialog.cloud.engine && pb.dialog.cloud.engine.configured() ? pb.dialog.cloud.engine : null;
    const now = () => { const e = eng(); if (!e) return; try { e.scan(true); e.flush(true, true).catch(() => {}); } catch (x) { /* next tick */ } };
    window.addEventListener('pagehide', now);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') now(); });
    pb.uploadNow = now;
    pb.suite = st;
    return pb;
  }

  window.SharedBridgeSuite = { TOOL, LABEL, SETTLE, K_PROJ, toFile, fromFile, store, projectBar };
})();
