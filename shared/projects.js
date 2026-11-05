/* shared/projects.js — saved-project list and undo / redo for the tools (window.SharedProjects). Classic script, no DOM.
   Added 2026-11-02 (engineer-approved: every tool gets a saved-project list with Open / Rename / Duplicate / Delete and Undo / Redo,
   following the Steel Bridge app, apps/steel-bridge/engine/library.js).

   Saved data (CLAUDE.md §5): this file never chooses a key and never changes a stored format. Each tool passes its OWN existing
   key and the shape of one stored item, so a list the tool kept before opens unchanged and the tool's old version still reads
   what this file writes:
     mapStore(storage, key, o)   one localStorage value holding a JSON object { "<project name>": item, ... } (the format most
                                 tools already use: rebar_aci_projects_v1, asce7bldg.projects, bpad_projects_v1, ...).
                                 o.pack(state, name, oldItem) -> item   (default: the state itself)
                                 o.unpack(item, name)        -> state  (default: the item itself)
                                 o.time(item)                -> saved time (ms or ISO) for the list, or null (default: none)
   Rename moves the stored item to the new name unchanged (byte for byte); Duplicate copies it unchanged. Neither touches the
   project data inside the item.
   A refused write (quota, privacy mode) returns { ok: false, error: 'quota' | 'storage', message } and leaves storage as it was
   (the whole list is one setItem: it either happens or it does not). A list whose stored text cannot be read is never
   overwritten: every write returns { ok: false, error: 'unreadable' } and the text stays in storage for recovery.

   history({ get, set, max }) is the undo / redo stack: whole-state snapshots (strings from get()), session only, nothing stored. */
(function () {
  'use strict';
  const QUOTA_CHARS = 5 * 1024 * 1024;   // Chrome / Edge: about 10 MB of UTF-16 per origin = 5 M characters; every file:// page shares it

  const isQuota = e => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014 || /quota/i.test(String(e.message)));
  function fail(e, what) {
    const q = isQuota(e);
    return { ok: false, error: q ? 'quota' : 'storage', message: q
      ? `${what} Browser storage is full (all tools opened from files share about 5 MB). Nothing was changed and the open project is still open. Use Export JSON to keep it, delete saved projects you no longer need, or clear other tools' saved data.`
      : `${what} Browser storage is not available or refused the write (private window or blocked site data?). Nothing was changed and the open project is still open. Use Export JSON to keep it.` };
  }
  const UNREADABLE = what => ({ ok: false, error: 'unreadable', message: `${what} The saved-project list in this browser could not be read, so it was not changed (its text is kept as it is). Use Export JSON to keep the open project.` });
  const clean = n => String(n == null ? '' : n).trim();

  function mapStore(storage, key, o) {
    function read() {
      let raw = null;
      try { raw = storage ? storage.getItem(key) : null; } catch (e) { return { map: {}, ok: false, error: 'storage' }; }
      if (raw == null || raw === '') return { map: {}, ok: true };
      try { const m = JSON.parse(raw); if (m && typeof m === 'object' && !Array.isArray(m)) return { map: m, ok: true }; } catch (e) { /* below */ }
      return { map: {}, ok: false, error: 'unreadable' };
    }
    const stamp = () => { try { return storage ? storage.getItem(key) : null; } catch (e) { return null; } };
    return core(key, read, map => { storage.setItem(key, JSON.stringify(map)); }, stamp, o);
  }

  /* listStore(o) (STDS, 2026-11-05): the same list interface as mapStore over a list the tool keeps some other way (an id-keyed list
     shown by name, an IndexedDB store with an in-memory copy, two keys under one name...). o = { key (a name for the list: used for
     the storage meter and the GitHub-sync change check; may be a real storage key), readMap() -> { map: { name: item }, ok, error? }
     (synchronous), writeMap(map) (stores the whole by-name map; throws on a refused write, as setItem does), stamp() (optional: a
     text that changes whenever the list changes; default the map's JSON), pack, unpack, time, sort } (as mapStore).
     Every store (mapStore or listStore) has: key, read, list, has, get, item, save, rename, duplicate, remove, copyName, stamp. */
  function listStore(o) {
    const read = () => { try { const r = o.readMap(); return r && r.map ? { map: r.map, ok: r.ok !== false, error: r.error } : { map: {}, ok: false, error: 'unreadable' }; } catch (e) { return { map: {}, ok: false, error: 'storage' }; } };
    const stamp = o.stamp || (() => { try { return JSON.stringify(read().map); } catch (e) { return null; } });
    return core(o.key, read, map => o.writeMap(map), stamp, o);
  }

  function core(key, read, writeRaw, stamp, o) {
    o = o || {};
    const pack = o.pack || (s => s), unpack = o.unpack || (i => i), time = o.time || (() => null);
    function write(map, what) {
      try { writeRaw(map); return { ok: true }; } catch (e) { return fail(e, what); }
    }
    function sizeOf(v) { try { return JSON.stringify(v).length; } catch (e) { return 0; } }
    /* list(): [{ name, saved (ms or ISO, or null), size (characters) }], sorted by name (o.sort === 'saved': newest first) */
    function list() {
      const m = read().map, out = Object.keys(m).map(name => ({ name, saved: (() => { try { return time(m[name]); } catch (e) { return null; } })(), size: sizeOf(m[name]) }));
      const tms = t => t == null ? -Infinity : typeof t === 'number' ? t : (Date.parse(t) || -Infinity);
      if (o.sort === 'saved') out.sort((a, b) => tms(b.saved) - tms(a.saved) || a.name.localeCompare(b.name));
      else out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      return out;
    }
    const has = name => Object.prototype.hasOwnProperty.call(read().map, name);
    /* get(name): the project state (o.unpack of the stored item), or null */
    function get(name) { const m = read().map; return Object.prototype.hasOwnProperty.call(m, name) ? unpack(m[name], name) : null; }
    function item(name) { const m = read().map; return Object.prototype.hasOwnProperty.call(m, name) ? m[name] : undefined; }
    /* save(name, state): adds or replaces the item. */
    function save(name, state) {
      name = clean(name); if (!name) return { ok: false, error: 'empty', message: 'Enter a project name.' };
      const r = read(); if (!r.ok) return r.error === 'unreadable' ? UNREADABLE('The project was not saved.') : fail({}, 'The project was not saved.');
      const m = r.map; m[name] = pack(state, name, m[name]);
      const w = write(m, 'The project was not saved.'); return w.ok ? { ok: true, name } : w;
    }
    /* rename(from, to, { replace }): the stored item moves to the new name unchanged; the list keeps its place. */
    function rename(from, to, ro) {
      to = clean(to); if (!to) return { ok: false, error: 'empty', message: 'Enter a name.' };
      const r = read(); if (!r.ok) return r.error === 'unreadable' ? UNREADABLE('The project was not renamed.') : fail({}, 'The project was not renamed.');
      const m = r.map; if (!Object.prototype.hasOwnProperty.call(m, from)) return { ok: false, error: 'missing', message: 'That saved project is not in this browser any more.' };
      if (to === from) return { ok: true, name: to };
      if (Object.prototype.hasOwnProperty.call(m, to) && !(ro && ro.replace)) return { ok: false, error: 'exists', message: `A saved project named "${to}" already exists.` };
      const n = {}; Object.keys(m).forEach(k => { if (k === from) n[to] = m[from]; else if (k !== to) n[k] = m[k]; });
      const w = write(n, 'The project was not renamed.'); return w.ok ? { ok: true, name: to } : w;
    }
    /* duplicate(from, to, { replace }): a copy of the stored item under the new name (default "<name> (copy)"). */
    function duplicate(from, to, ro) {
      const r = read(); if (!r.ok) return r.error === 'unreadable' ? UNREADABLE('The project was not duplicated.') : fail({}, 'The project was not duplicated.');
      const m = r.map; if (!Object.prototype.hasOwnProperty.call(m, from)) return { ok: false, error: 'missing', message: 'That saved project is not in this browser any more.' };
      to = clean(to) || copyName(from, m);
      if (Object.prototype.hasOwnProperty.call(m, to) && !(ro && ro.replace)) return { ok: false, error: 'exists', message: `A saved project named "${to}" already exists.` };
      m[to] = JSON.parse(JSON.stringify(m[from]));
      const w = write(m, 'The project was not duplicated.'); return w.ok ? { ok: true, name: to } : w;
    }
    /* remove(name) */
    function remove(name) {
      const r = read(); if (!r.ok) return r.error === 'unreadable' ? UNREADABLE('The project was not deleted.') : fail({}, 'The project was not deleted.');
      const m = r.map; if (!Object.prototype.hasOwnProperty.call(m, name)) return { ok: true };
      delete m[name]; return write(m, 'The project was not deleted.');
    }
    function copyName(from, m) { m = m || read().map; let n = `${from} (copy)`, i = 2; while (Object.prototype.hasOwnProperty.call(m, n)) n = `${from} (copy ${i++})`; return n; }
    return { key, read, list, has, get, item, save, rename, duplicate, remove, copyName: f => copyName(f), stamp };
  }

  /* usage(storage, keys): characters held by every key of this origin, and by the given keys (the tool's list); bytes = 2 x chars. */
  function usage(storage, keys) {
    let chars = 0, of = 0, counted = false; const mine = new Set(keys || []);
    try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i), v = storage.getItem(k) || '', n = k.length + v.length; chars += n; counted = true; if (mine.has(k)) of += n; } } catch (e) { /* not countable */ }
    return { chars, of, quota: QUOTA_CHARS, frac: chars / QUOTA_CHARS, counted };
  }

  /* etTime(t): 'Nov 2, 2026, 3:45 PM EST' in US Eastern time (t: ms or ISO); '' when t is missing */
  function etTime(t) {
    if (t == null || t === '') return '';
    const d = new Date(t); if (isNaN(d)) return '';
    try { const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
      const z = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).formatToParts(d).find(p => p.type === 'timeZoneName');
      return `${s} ${z ? z.value : 'ET'}`; } catch (e) { return d.toISOString(); }
  }

  /* history({ get, set, max, settleMs, now }): undo / redo of whole-state snapshots.
       get() -> string (the tool's state as text), set(text) applies it (the tool's own restore / apply path).
       record() after each input change (it compares with the last snapshot: no step when nothing changed).
       undo() / redo() first record any change not yet recorded. For settleMs after an undo / redo, record() only takes the new
       snapshot (a tool that normalises the applied state on its next redraw does not add a step); default 400 ms.
       reset() when a different project is opened (the history starts again). onChange(fn) is called after every change. */
  function history(o) {
    const max = o.max || 100, settle = o.settleMs == null ? 400 : o.settleMs, now = o.now || (() => Date.now());
    let U = [], R = [], snap = null, busy = false, quietUntil = 0; const subs = [];
    const cur = () => { try { const t = o.get(); return t == null ? null : String(t); } catch (e) { return null; } };
    const emit = () => subs.forEach(f => { try { f(api); } catch (e) { /* listener error ignored */ } });
    function reset() { U = []; R = []; snap = cur(); quietUntil = 0; emit(); }
    function record() {
      if (busy) return false; const t = cur(); if (t == null) return false;
      if (snap == null || now() < quietUntil) { const ch = snap !== t; snap = t; if (ch) emit(); return false; }
      if (t === snap) return false;
      U.push(snap); if (U.length > max) U.shift(); R.length = 0; snap = t; emit(); return true;
    }
    function step(from, to) {
      if (busy) return false; if (now() >= quietUntil) record(); if (!from.length) return false;
      const t = from.pop(); to.push(snap); busy = true;
      try { o.set(t); } finally { busy = false; }
      snap = cur(); if (snap == null) snap = t; quietUntil = now() + settle; emit(); return true;
    }
    const api = { record, reset, undo: () => step(U, R), redo: () => step(R, U), canUndo: () => U.length > 0, canRedo: () => R.length > 0,
      sizes: () => ({ undo: U.length, redo: R.length }), busy: () => busy, onChange: f => { subs.push(f); } };
    return api;
  }

  /* canon(v, omit): JSON text with object keys sorted (and the top-level keys in omit left out), so two states that differ only in
     key order compare equal (STDS: the "unsaved changes" check of projectBar). */
  function canon(v, omit) {
    const skip = new Set(omit || []);
    return JSON.stringify(v, function (k, x) {
      if (x && typeof x === 'object' && !Array.isArray(x)) { const top = this === undefined || (this && this[''] === x); const o = {}; Object.keys(x).sort().forEach(kk => { if (!(top && skip.has(kk))) o[kk] = x[kk]; }); return o; }
      return x;
    });
  }

  window.SharedProjects = { QUOTA_CHARS, isQuota, fail, mapStore, listStore, usage, etTime, history, canon };
})();
