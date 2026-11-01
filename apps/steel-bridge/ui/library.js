/* apps/steel-bridge/ui/library.js — the "Saved projects" panel (window.SBDLibraryUI). Classic script. Added 2026-11-01.
   The page (index.html) calls init(ctx) once; ctx = { store, name() (project name), dirty() -> bool, curId() -> id | null,
   open(id) (the page's guarded open), saved(id, name, text) (after a rename of the open project), note(msg) } and show() to open the panel.
   All storage work is engine/library.js (window.SBDLibrary); this file only draws the list and asks for names (prompt / confirm,
   as the other tools do). Keys: sbd2.lib.* only (engine/model.js KEYS). */
(function () {
  'use strict';
  const LIB = () => window.SBDLibrary;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let C = null, dlg = null;

  function init(ctx) {
    C = ctx;
    dlg = document.createElement('dialog'); dlg.id = 'libDlg';
    dlg.innerHTML = '<div class="libHead"><strong>Saved projects</strong><button type="button" id="libClose" aria-label="Close">Close</button></div><div id="libBody"></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', e => {
      if (e.target === dlg || e.target.id === 'libClose') { dlg.close(); return; }
      const b = e.target.closest('[data-lib]'); if (!b) return; act(b.dataset.lib, b.dataset.id); });
  }
  function usageHtml() {
    const u = LIB().usage(C.store);
    if (!u.counted) return '<p class="note">Storage use cannot be read in this browser.</p>';
    const mb = x => (x * 2 / 1048576).toFixed(2), pct = Math.min(100, Math.round(u.frac * 100)), cls = u.frac > 0.9 ? 'full' : u.frac > 0.7 ? 'high' : '';
    return `<div class="libUse"><div class="libBar ${cls}"><i style="width:${pct}%"></i></div><span>Browser storage: ${mb(u.chars)} MB of about ${mb(u.quota)} MB used (${pct}%); saved projects use ${mb(u.ofLibrary)} MB. `
      + 'Every tool opened from a file in this browser shares this space.</span></div>' + (u.frac > 0.9 ? '<p class="alert err">Storage is almost full. Delete saved projects you no longer need, or use Export JSON.</p>' : '');
  }
  function draw() {
    const items = LIB().list(C.store), cur = C.curId();
    $b().innerHTML = (items.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Name</th><th>Project no.</th><th>Last saved (Eastern)</th><th>Size</th><th></th></tr></thead><tbody>${
      items.map(i => `<tr class="${i.id === cur ? 'sel' : ''}"><td class="lft">${esc(i.name)}${i.id === cur ? ' <span class="note">(open now)</span>' : ''}</td><td>${esc(i.number)}</td><td>${esc(i.saved && i.saved > '1971' ? LIB().etTime(i.saved) : '—')}</td><td>${(i.size / 1024).toFixed(0)} KB</td>`
        + `<td class="libAct"><button type="button" data-lib="open" data-id="${esc(i.id)}">Open</button><button type="button" data-lib="rename" data-id="${esc(i.id)}">Rename</button>`
        + `<button type="button" data-lib="dup" data-id="${esc(i.id)}">Duplicate</button><button type="button" data-lib="del" data-id="${esc(i.id)}">Delete</button></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="note">No saved projects yet. Use Save in the header to keep the open project in this browser.</p>')
      + usageHtml() + '<p class="note">Saved projects stay in this browser only. Export JSON makes a file you can back up or move to another computer.</p>';
  }
  const $b = () => dlg.querySelector('#libBody');
  function show() { if (!dlg) return; draw(); if (!dlg.open) dlg.showModal(); }
  function refresh() { if (dlg && dlg.open) draw(); }
  function say(r) { if (!r.ok) alert(r.message || r.error); return r.ok; }
  function act(a, id) {
    const it = LIB().list(C.store).find(i => i.id === id); if (!it) { draw(); return; }
    if (a === 'open') { if (C.open(id)) dlg.close(); }
    else if (a === 'rename') { const n = prompt('Rename the saved project "' + it.name + '" to:', it.name); if (n == null) return;
      const r = LIB().rename(C.store, id, n); if (say(r) && C.curId() === id) C.renamed(id, r.name, r.text); draw(); }
    else if (a === 'dup') { const n = prompt('Name for the copy:', it.name + ' (copy)'); if (n == null) return;
      const r = LIB().duplicate(C.store, id, n); say(r); draw(); }
    else if (a === 'del') { if (!confirm('Delete the saved project "' + it.name + '"? This cannot be undone' + (C.curId() === id ? ' (the project open now stays open and is kept by the autosave, but it will no longer be in this list).' : '.'))) return;
      say(LIB().remove(C.store, id)); if (C.curId() === id) C.unlinked(); draw(); }
  }
  window.SBDLibraryUI = { init, show, refresh };
})();
