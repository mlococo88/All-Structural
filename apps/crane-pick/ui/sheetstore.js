/* apps/crane-pick/ui/sheetstore.js — the plan-sheet images of the Crane Pick Analyzer (window.CranePickSheetStore). C1-2 (2026-11-16).
   A plan sheet's pixels are too big for localStorage (about 5 MB shared by every tool opened from file://), so a project keeps only the
   sheet's placement and calibration (engine/model.js) and the image is kept here, in IndexedDB database "crane.sheets.v1", object store
   "img", one record per sheet id: { id, blob, type, name, w, h, size, at }. The same image serves every saved project that has the sheet.
   Without IndexedDB (a private window, blocked site data) the images are kept for this page only, and the page says so.
   Images are never deleted on their own: "Clean up" (Plan sheets tab) removes the ones no saved project, autosave or open project uses. */
(function () {
  'use strict';
  const DB = 'crane.sheets.v1', ST = 'img';
  let dbp = null, mem = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(res => {
      let req; try { req = window.indexedDB && window.indexedDB.open(DB, 1); } catch (e) { req = null; }
      if (!req) { mem = new Map(); res(null); return; }
      req.onupgradeneeded = () => { const d = req.result; if (!d.objectStoreNames.contains(ST)) d.createObjectStore(ST, { keyPath: 'id' }); };
      req.onsuccess = () => res(req.result);
      req.onerror = () => { mem = new Map(); res(null); };
      req.onblocked = () => { /* another tab holds an old version: wait */ };
    });
    return dbp;
  }
  const tx = (d, mode, fn) => new Promise((res, rej) => { const t = d.transaction(ST, mode), s = t.objectStore(ST); const r = fn(s); t.oncomplete = () => res(r && 'result' in r ? r.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted')); });
  async function put(rec) { const d = await open(); if (!d) { mem.set(rec.id, rec); return { ok: true, memory: true }; } try { await tx(d, 'readwrite', s => s.put(rec)); return { ok: true }; } catch (e) { return { ok: false, error: e && e.name, message: String(e && e.message || e) }; } }
  async function get(id) { const d = await open(); if (!d) return mem.get(id) || null; try { return (await tx(d, 'readonly', s => s.get(id))) || null; } catch (e) { return null; } }
  async function del(id) { const d = await open(); if (!d) { mem.delete(id); return; } try { await tx(d, 'readwrite', s => s.delete(id)); } catch (e) { /* kept */ } }
  async function list() {
    const d = await open(); if (!d) return [...mem.values()].map(r => ({ id: r.id, name: r.name, size: r.size, at: r.at }));
    try { return (await tx(d, 'readonly', s => s.getAll())).map(r => ({ id: r.id, name: r.name, size: r.size, w: r.w, h: r.h, at: r.at })); } catch (e) { return []; }
  }
  const memoryOnly = async () => { await open(); return !!mem; };
  window.CranePickSheetStore = { DB, put, get, del, list, memoryOnly };
})();
