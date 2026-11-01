/* apps/steel-bridge/engine/library.js — the saved-project list kept in the browser (window.SBDLibrary). Classic script, no DOM:
   every function takes the storage object (window.localStorage on the page, a stand-in in tests). Added 2026-11-01.

   Saved-data rules (CLAUDE.md §5): new keys only, all in SBDModel.KEYS and all starting 'sbd2.'; the autosave key
   (KEYS.current), the unreadable-project backups and the ui key are never read as a library item and never written here.
     KEYS.libIndex  'sbd2.lib.index'      { schema: 'sbd2.library', version: 1, items: [ { id, name, number, saved (ISO UTC), size (characters) } ] }
     KEYS.libItem   'sbd2.lib.p.' + id    the project file text (SBDModel.exportJSON), the same text as Export JSON
     KEYS.libCur    'sbd2.lib.current'    { id }: the library item the open project was last saved to / opened from (absent: none)
   A failed write (quota, privacy mode) returns { ok: false, error, message }; whatever was stored before the call is left as it was.
   The index can be rebuilt from the items (rebuild) if it is lost or unreadable; the unreadable text is kept under KEYS.libIndex + '.unreadable.'. */
(function () {
  'use strict';
  const M = () => window.SBDModel, K = () => M().KEYS;
  const SCHEMA = 'sbd2.library', VERSION = 1;
  const QUOTA_CHARS = 5 * 1024 * 1024;   // Chrome / Edge: about 10 MB of UTF-16 per origin = 5 M characters; every file:// page shares it
  const fail = (e, what) => {
    const q = e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014 || /quota/i.test(String(e && e.message)));
    return { ok: false, error: q ? 'quota' : 'storage', message: q
      ? `${what} Browser storage is full (all tools opened from files share about 5 MB). Nothing was changed and the open project is still open. Use Export JSON to keep it, delete saved projects you no longer need, or clear other tools' saved data.`
      : `${what} Browser storage is not available or refused the write (private window or blocked site data?). Nothing was changed and the open project is still open. Use Export JSON to keep it.` };
  };
  const newId = (now, rnd) => 'p' + (now ? new Date(now).getTime() : Date.now()).toString(36) + Math.floor((rnd == null ? Math.random() : rnd) * 36 ** 4).toString(36).padStart(4, '0');
  const meta = (id, p, saved, text) => ({ id, name: String((p.project || {}).name || '').trim() || 'Untitled', number: String((p.project || {}).number || ''), saved, size: text.length });

  function readIndex(storage, now) {
    let raw = null; try { raw = storage.getItem(K().libIndex); } catch (e) { return { items: [], ok: false }; }
    if (raw == null) return { items: [], ok: true };
    try { const o = JSON.parse(raw); if (o && o.schema === SCHEMA && Array.isArray(o.items)) return { items: o.items.filter(i => i && typeof i.id === 'string'), ok: true }; } catch (e) { /* rebuilt below */ }
    // unreadable index: keep its text, rebuild the list from the items
    try { storage.setItem(K().libIndex + '.unreadable.' + (now || new Date().toISOString()), raw); } catch (e) { /* storage full: the index key itself is left as it was */ }
    return { items: rebuild(storage, true), ok: true, rebuilt: true };
  }
  /* rebuild(storage, noWrite): the index from the stored items (needs storage.length / storage.key; a stand-in without them gives []). */
  function rebuild(storage, noWrite) {
    const items = [], pre = K().libItem;
    try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (!k || k.indexOf(pre) !== 0) continue;
      const text = storage.getItem(k), r = M().importJSON(text); if (!r.ok) continue;
      items.push(meta(k.slice(pre.length), r.project, new Date(0).toISOString(), text)); } } catch (e) { /* no listing */ }
    if (!noWrite) writeIndex(storage, items);
    return items;
  }
  function writeIndex(storage, items) { try { storage.setItem(K().libIndex, JSON.stringify({ schema: SCHEMA, version: VERSION, items })); return true; } catch (e) { return false; } }

  /* list(storage): the saved projects, newest first: [ { id, name, number, saved, size } ] */
  function list(storage) { return readIndex(storage).items.slice().sort((a, b) => a.saved < b.saved ? 1 : a.saved > b.saved ? -1 : 0); }
  function text(storage, id) { try { return storage.getItem(K().libItem + id); } catch (e) { return null; } }

  /* save(storage, project, id, o): writes the project as item id (null: a new item). o: { now (ISO), rnd }. { ok, id, saved, text } or a failure. */
  function save(storage, project, id, o) {
    o = o || {}; const when = o.now || new Date().toISOString(), body = M().exportJSON(project), idx = readIndex(storage, o.now), items = idx.items.slice();
    const isNew = !id || !items.some(i => i.id === id); id = isNew ? (id || newId(o.now, o.rnd)) : id;
    const key = K().libItem + id; let prev = null; try { prev = storage.getItem(key); } catch (e) { /* none */ }
    try { storage.setItem(key, body); } catch (e) { return fail(e, 'The project was not saved.'); }
    const m = meta(id, project, when, body), at = items.findIndex(i => i.id === id); if (at >= 0) items[at] = m; else items.push(m);
    if (!writeIndex(storage, items)) {
      try { if (prev == null) storage.removeItem(key); else storage.setItem(key, prev); } catch (e) { /* the item text is in place; the index is rebuilt on the next read */ }
      return fail({ name: 'QuotaExceededError' }, 'The project was not saved (the project list could not be updated).');
    }
    return { ok: true, id, saved: when, text: body, item: m };
  }
  /* open(storage, id): { ok, project, errors, warnings, text } (text: the stored file text) or { ok: false, error } */
  function open(storage, id) {
    const t = text(storage, id); if (t == null) return { ok: false, error: 'That saved project is not in this browser any more.' };
    const r = M().importJSON(t); if (!r.ok) return { ok: false, error: `That saved project could not be read: ${r.error}` };
    return { ok: true, project: r.project, errors: r.errors, warnings: r.warnings, text: t };
  }
  /* rename(storage, id, name): changes the list name and project.name inside the stored file. The saved date is not changed. */
  function rename(storage, id, name, o) {
    name = String(name == null ? '' : name).trim(); if (!name) return { ok: false, error: 'empty', message: 'Enter a name.' };
    const t = text(storage, id), items = readIndex(storage, (o || {}).now).items.slice(), at = items.findIndex(i => i.id === id);
    if (t == null || at < 0) return { ok: false, error: 'missing', message: 'That saved project is not in this browser any more.' };
    const r = M().importJSON(t); if (!r.ok) return { ok: false, error: 'unreadable', message: r.error };
    r.project.project.name = name; const body = M().exportJSON(r.project);
    try { storage.setItem(K().libItem + id, body); } catch (e) { return fail(e, 'The project was not renamed.'); }
    items[at] = { ...items[at], name, size: body.length };
    if (!writeIndex(storage, items)) { try { storage.setItem(K().libItem + id, t); } catch (e) { /* unchanged text kept */ } return fail({ name: 'QuotaExceededError' }, 'The project was not renamed.'); }
    return { ok: true, id, name, text: body };
  }
  /* duplicate(storage, id, name, o): a new item with the same project under `name` (default "<name> (copy)"). */
  function duplicate(storage, id, name, o) {
    const r = open(storage, id); if (!r.ok) return { ok: false, error: 'missing', message: r.error };
    r.project.project.name = String(name || '').trim() || `${r.project.project.name || 'Untitled'} (copy)`;
    return save(storage, r.project, null, o);
  }
  /* remove(storage, id): deletes the item and its list row. The library pointer KEYS.libCur is cleared if it named this item. */
  function remove(storage, id) {
    const items = readIndex(storage).items.filter(i => i.id !== id);
    if (!writeIndex(storage, items)) { /* storage refused even a smaller index: still try removing the item text below */ }
    try { storage.removeItem(K().libItem + id); } catch (e) { return fail(e, 'The project was not deleted.'); }
    if (getCur(storage) === id) setCur(storage, null);
    return { ok: true };
  }
  function getCur(storage) { try { const o = JSON.parse(storage.getItem(K().libCur)); return o && typeof o.id === 'string' ? o.id : null; } catch (e) { return null; } }
  function setCur(storage, id) { try { if (id == null) storage.removeItem(K().libCur); else storage.setItem(K().libCur, JSON.stringify({ id })); return true; } catch (e) { return false; } }

  /* usage(storage): { chars, ofLibrary, quota, frac, shared }: characters held by every key of this origin (storage.length / key; a stand-in
     without them counts the sbd2.* keys it was given through `keys`), and by this library alone. UTF-16 storage: bytes = 2 × chars. */
  function usage(storage) {
    let chars = 0, lib = 0, counted = false;
    try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i), v = storage.getItem(k) || ''; const n = k.length + v.length; chars += n; counted = true;
      if (k.indexOf('sbd2.lib.') === 0) lib += n; } } catch (e) { /* not countable */ }
    return { chars, ofLibrary: lib, quota: QUOTA_CHARS, frac: chars / QUOTA_CHARS, counted };
  }
  /* etTime(iso): 'Nov 1, 2026, 3:45 PM ET' in US Eastern time (daylight or standard as in force on that date) */
  function etTime(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    try { const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
      const z = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).formatToParts(d).find(p => p.type === 'timeZoneName');
      return `${s} ${z ? z.value : 'ET'}`; } catch (e) { return d.toISOString(); }
  }
  window.SBDLibrary = { SCHEMA, VERSION, QUOTA_CHARS, list, save, open, rename, duplicate, remove, rebuild, getCur, setCur, text, usage, etTime };
})();
