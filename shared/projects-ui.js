/* shared/projects-ui.js — the "Saved projects" dialog and the Undo / Redo buttons and keys (window.SharedProjectsUI). Classic script.
   Needs shared/projects.js (window.SharedProjects) loaded first. Added 2026-11-02 (pattern: apps/steel-bridge/ui/library.js).
   Every element this file adds carries the attribute data-sp (the tests strip them before comparing a tool's page text).
   Nothing here is stored: storage work is the tool's mapStore (shared/projects.js); names are asked with prompt / confirm,
   as the tools already do.

   libraryDialog(ctx) -> { show, refresh, el }
     ctx = { store (a SharedProjects.mapStore), storage (window.localStorage or a stand-in), title ('Saved projects'),
             current() -> name of the open project in the list, or null,
             open(name) -> true when the tool opened it (the tool asks about unsaved changes itself),
             renamed(old, new) (optional: after a rename; the tool updates its "current" name),
             deleted(name) (optional: after a delete),
             changed() (optional: after any change to the list, e.g. the tool's own drop-down is redrawn),
             save() (optional: a "Save the open project…" button at the top of the dialog, for a tool with no Save of its own;
               it asks for the name itself and returns the mapStore result, or nothing when cancelled), saveLabel (its text),
             note (optional HTML under the table) }
   undoRedo(h, { undo, redo, keys }) wires a SharedProjects.history to two buttons and (keys !== false) to Ctrl+Z / Ctrl+Y /
     Ctrl+Shift+Z. While text is being typed in a field (not yet committed), the browser's own undo of that field is left alone.
   button(text, title, o) -> a <button type="button" data-sp> with the tool's class o.cls. */
(function () {
  'use strict';
  const SP = () => window.SharedProjects;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let cssDone = false;
  function css() {
    if (cssDone || typeof document === 'undefined') return; cssDone = true;
    const s = document.createElement('style'); s.setAttribute('data-sp', 'css');
    s.textContent = [
      'dialog.spLib{position:fixed;inset:0;margin:auto;height:fit-content;box-sizing:border-box;border:1px solid #94a3b8;border-radius:8px;padding:12px 16px;width:min(780px,94vw);max-height:86vh;overflow:auto;font:inherit;font-size:10pt;color:#0f172a;background:#fff;}',
      'dialog.spLib::backdrop{background:rgba(15,23,42,.45);}',
      '.spLib .spHead{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;font-size:12pt;}',
      '.spLib table{border-collapse:collapse;width:100%;font-size:9.5pt;} .spLib th,.spLib td{border-bottom:1px solid #e2e8f0;padding:4px 6px;text-align:left;vertical-align:middle;}',
      '.spLib th{background:#f1f5f9;font-weight:600;} .spLib tr.spCur td{background:#eff6ff;} .spLib td.spAct{white-space:nowrap;text-align:right;}',
      '.spLib button{font:inherit;font-size:9pt;padding:2px 8px;margin-left:4px;border:1px solid #94a3b8;border-radius:4px;background:#fff;color:#0f172a;cursor:pointer;}',
      '.spLib button:hover{background:#f1f5f9;} .spLib button.spDel{color:#b91c1c;border-color:#fca5a5;}',
      '.spLib .spNote{color:#475569;font-size:9pt;margin:6px 0;} .spLib .spErr{color:#b91c1c;font-size:9pt;margin:6px 0;font-weight:600;}',
      '.spLib .spUse{display:flex;gap:10px;align-items:center;font-size:9pt;color:#475569;margin:8px 0;} .spLib .spBar{flex:0 0 140px;height:10px;border-radius:5px;background:#e2e8f0;overflow:hidden;}',
      '.spLib .spBar i{display:block;height:100%;background:#16a34a;} .spLib .spBar.high i{background:#b45309;} .spLib .spBar.full i{background:#b91c1c;}',
      '.spLib .spScroll{overflow-x:auto;}',
      '@media (max-width:560px){.spLib td.spAct{white-space:normal;text-align:left;} .spLib td.spAct button{margin:2px 4px 2px 0;} .spLib .spUse{flex-wrap:wrap;} .spLib .spBar{flex:1 1 100%;}}',
      'button[data-sp]:disabled{opacity:.45;cursor:default;}',
      '@media print{dialog.spLib{display:none!important;}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function button(text, title, o) {
    o = o || {}; const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-sp', o.sp || '1');
    if (o.id) b.id = o.id; if (o.cls) b.className = o.cls; if (title) b.title = title; b.textContent = text; if (o.disabled) b.disabled = true;
    if (o.style) b.style.cssText = o.style; return b;
  }

  function libraryDialog(ctx) {
    css();
    const dlg = document.createElement('dialog'); dlg.className = 'spLib'; dlg.setAttribute('data-sp', 'dialog'); dlg.id = ctx.id || 'spLibDlg';
    dlg.innerHTML = `<div class="spHead"><strong>${esc(ctx.title || 'Saved projects')}</strong><span>${ctx.save ? `<button type="button" data-spa="save">${esc(ctx.saveLabel || 'Save the open project…')}</button>` : ''}<button type="button" data-spa="close">Close</button></span></div><div class="spBody"></div>`;
    document.body.appendChild(dlg);
    const body = dlg.querySelector('.spBody');
    let msg = '';
    dlg.addEventListener('click', e => {
      if (e.target === dlg) { dlg.close(); return; }
      const b = e.target.closest('[data-spa]'); if (!b) return;
      if (b.dataset.spa === 'close') { dlg.close(); return; }
      if (b.dataset.spa === 'save') { const r = ctx.save(); if (r && r.ok === false && r.message) msg = r.message; else msg = ''; if (ctx.changed) ctx.changed(); draw(); return; }
      act(b.dataset.spa, decodeURIComponent(b.dataset.n || ''));
    });
    function usageHtml() {
      const u = SP().usage(ctx.storage, [ctx.store.key]);
      if (!u.counted) return '<p class="spNote">Storage use cannot be read in this browser.</p>';
      const mb = x => (x * 2 / 1048576).toFixed(2), pct = Math.min(100, Math.round(u.frac * 100)), cls = u.frac > 0.9 ? 'full' : u.frac > 0.7 ? 'high' : '';
      return `<div class="spUse"><div class="spBar ${cls}"><i style="width:${pct}%"></i></div><span>Browser storage: ${mb(u.chars)} MB of about ${mb(u.quota)} MB used (${pct}%); this tool's saved projects use ${mb(u.of)} MB. Every tool opened from a file in this browser shares this space.</span></div>`
        + (u.frac > 0.9 ? '<p class="spErr">Storage is almost full. Delete saved projects you no longer need, or use Export JSON.</p>' : '');
    }
    function draw() {
      const r = ctx.store.read(), items = ctx.store.list(), cur = ctx.current ? ctx.current() : null, enc = n => encodeURIComponent(n), hasT = items.some(i => i.saved != null);
      body.innerHTML = (msg ? `<p class="spErr">${esc(msg)}</p>` : '')
        + (!r.ok ? '<p class="spErr">The saved-project list in this browser could not be read. It is left as it is; nothing in it is changed.</p>' : '')
        + (items.length ? `<div class="spScroll"><table><thead><tr><th>Name</th>${hasT ? '<th>Last saved (Eastern)</th>' : ''}<th>Size</th><th></th></tr></thead><tbody>${
          items.map(i => `<tr class="${i.name === cur ? 'spCur' : ''}"><td>${esc(i.name)}${i.name === cur ? ' <span class="spNote">(open now)</span>' : ''}</td>${hasT ? `<td>${esc(SP().etTime(i.saved) || '—')}</td>` : ''}<td>${Math.max(1, Math.round(i.size / 1024))} KB</td>`
            + `<td class="spAct"><button type="button" data-spa="open" data-n="${enc(i.name)}">Open</button><button type="button" data-spa="rename" data-n="${enc(i.name)}">Rename</button>`
            + `<button type="button" data-spa="dup" data-n="${enc(i.name)}">Duplicate</button><button type="button" class="spDel" data-spa="del" data-n="${enc(i.name)}">Delete</button></td></tr>`).join('')}</tbody></table></div>`
          : '<p class="spNote">No saved projects yet. Use Save to keep the open project in this browser.</p>')
        + usageHtml() + (ctx.note || '<p class="spNote">Saved projects stay in this browser only. Export JSON makes a file you can back up or move to another computer.</p>');
    }
    function done(r) { msg = r && !r.ok ? (r.message || r.error) : ''; if (ctx.changed) ctx.changed(); draw(); return r && r.ok; }
    function act(a, name) {
      if (!ctx.store.has(name)) { msg = 'That saved project is not in this browser any more.'; draw(); return; }
      if (a === 'open') { msg = ''; if (ctx.open(name) !== false) dlg.close(); else draw(); return; }
      if (a === 'rename') {
        const n = prompt(`Rename the saved project "${name}" to:`, name); if (n == null) return;
        let r = ctx.store.rename(name, n);
        if (!r.ok && r.error === 'exists') { if (!confirm(`A saved project named "${n.trim()}" already exists. Replace it with "${name}"?`)) return; r = ctx.store.rename(name, n, { replace: true }); }
        if (done(r) && ctx.renamed) ctx.renamed(name, r.name); draw(); return;
      }
      if (a === 'dup') {
        const n = prompt('Name for the copy:', ctx.store.copyName(name)); if (n == null) return;
        let r = ctx.store.duplicate(name, n);
        if (!r.ok && r.error === 'exists') { if (!confirm(`A saved project named "${n.trim()}" already exists. Replace it with a copy of "${name}"?`)) return; r = ctx.store.duplicate(name, n, { replace: true }); }
        done(r); return;
      }
      if (a === 'del') {
        const isCur = ctx.current && ctx.current() === name;
        if (!confirm(`Delete the saved project "${name}"? This cannot be undone${isCur ? ' (the project open now stays open, but it will no longer be in this list)' : ''}.`)) return;
        if (done(ctx.store.remove(name)) && ctx.deleted) ctx.deleted(name); draw();
      }
    }
    function show() { msg = ''; draw(); if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); } }
    function refresh() { if (dlg.open) draw(); }
    return { show, refresh, el: dlg };
  }

  let typingWired = false;
  function wireTyping() {
    if (typingWired) return; typingWired = true;
    const mark = e => { const t = e.target; if (t && t.dataset && /^(INPUT|TEXTAREA)$/.test(t.tagName)) t.dataset.spTyping = '1'; };
    const clear = e => { const t = e.target; if (t && t.dataset) delete t.dataset.spTyping; };
    document.addEventListener('input', mark, true); document.addEventListener('change', clear, true); document.addEventListener('blur', clear, true);
  }
  function undoRedo(h, o) {
    o = o || {}; css();
    const sync = () => { if (o.undo) o.undo.disabled = !h.canUndo(); if (o.redo) o.redo.disabled = !h.canRedo(); };
    h.onChange(sync); sync();
    if (o.undo) o.undo.addEventListener('click', () => { h.undo(); if (o.after) o.after('undo'); });
    if (o.redo) o.redo.addEventListener('click', () => { h.redo(); if (o.after) o.after('redo'); });
    if (o.keys !== false) {
      wireTyping();
      document.addEventListener('keydown', e => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return; const k = (e.key || '').toLowerCase(); if (k !== 'z' && k !== 'y') return;
        const t = e.target; if (t && t.dataset && t.dataset.spTyping) return;   // text being typed: the browser's own undo for that field
        if (t && t.isContentEditable) return;
        if (document.querySelector('dialog[open]')) return;
        e.preventDefault();
        if (k === 'z' && !e.shiftKey) { h.undo(); if (o.after) o.after('undo'); } else { h.redo(); if (o.after) o.after('redo'); }
      });
    }
    return { sync };
  }

  window.SharedProjectsUI = { libraryDialog, undoRedo, button, css };
})();
