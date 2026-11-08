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
             note (optional HTML under the table),
             cloud (optional, 2026-11-05: { tool, label, toFile, fromFile, space, settle }: GitHub sync of this list through
               shared/github-sync.js when the page loads it; without that file, or without ctx.cloud, nothing changes),
             standard (optional, STDS 2026-11-05: the standard dialog: title "Saved projects — <label>", a filter box, "Save the
               open project…" / "Import JSON…" at the top, ONE table with the GitHub-only projects in it, columns Name / Last saved
               (Eastern) / Size / This browser / GitHub / Open Rename Duplicate Export Delete; without it the dialog is drawn
               exactly as before), label (the tool's name, for the title), exportOne(name) (the row's Export: a .json download;
               default the stored item, or ctx.cloud.toFile of it, as JSON), importFile() (the "Import JSON…" button),
             ghNote(name) (optional, STDS-B 2026-11-06: HTML for the GitHub cell of a row the sync has no status for, e.g. "not
               synced: a newer saved project has the same name"); store.keys() (optional: every storage key of the list, for the
               storage meter; default [store.key]),
             startPref (optional, START 2026-11-06: { get() -> bool, set(bool) }: a "Show this when the app opens" box under the
               standard table; projectBar passes it when ctx.start is on) }
   projectBar(ctx) (STDS, 2026-11-05) -> the standard save controls (see the comment above that function).
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
      /* STDS (2026-11-05): standard dialog, Save as, header chip and the "Save and open" card */
      '.spLib.spStd{width:min(960px,96vw);} .spLib .spTools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px;} .spLib .spTools input{flex:1 1 200px;min-width:0;font:inherit;font-size:10pt;padding:3px 8px;border:1px solid #94a3b8;border-radius:4px;}',
      '.spLib .spTools button{margin-left:0;} .spLib button.spPri,button.spPri[data-sp]{background:#1d4ed8;border-color:#1d4ed8;color:#fff;} .spLib button.spPri:hover,button.spPri[data-sp]:hover{background:#1e40af;}',
      '.spLib .spYes{display:inline-block;font-size:8.5pt;padding:0 7px;border-radius:9px;border:1px solid #86efac;background:#dcfce7;color:#166534;} .spLib .spNo{display:inline-block;font-size:8.5pt;padding:0 7px;border-radius:9px;border:1px solid #cbd5e1;background:#f1f5f9;color:#334155;}',
      '.spLib.spSave{width:min(520px,94vw);} .spLib .spOpt{display:flex;gap:8px;align-items:flex-start;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin:6px 0;cursor:pointer;} .spLib .spOpt.on{border-color:#93c5fd;background:#eff6ff;} .spLib .spOpt.off{opacity:.55;cursor:default;}',
      '.spLib .spField{display:block;font-weight:600;font-size:9.5pt;margin:6px 0 3px;} .spLib input.spName{width:100%;box-sizing:border-box;font:inherit;font-size:10.5pt;padding:4px 8px;border:1px solid #94a3b8;border-radius:4px;}',
      '.spLib .spBtns{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;margin-top:10px;} .spLib .spBtns button{margin-left:0;} .spLib .spWarn{background:#fef3c7;border:1px solid #fcd34d;color:#92400e;border-radius:6px;padding:6px 8px;font-size:9pt;margin:6px 0;}',
      'kbd.spKbd{font:8pt ui-monospace,Consolas,monospace;border:1px solid currentColor;border-radius:3px;padding:0 3px;margin-left:5px;opacity:.75;}',
      'button.spChip[data-sp]{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;border-radius:14px;padding:2px 10px;background:#f8fafc;color:#0f172a;font:inherit;font-size:9.5pt;cursor:pointer;max-width:100%;min-width:0;}',
      'button.spChip[data-sp] b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:22ch;} .spDot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;flex:0 0 8px;} .spDot.dirty{background:#d97706;}',
      '.spGhMini{font-size:8pt;padding:0 6px;border-radius:9px;border:1px solid #cbd5e1;background:#f1f5f9;color:#334155;white-space:nowrap;} .spGhMini.synced{background:#dcfce7;border-color:#86efac;color:#166534;} .spGhMini.conflict{background:#fef3c7;border-color:#fcd34d;color:#92400e;} .spGhMini.cloud-newer{background:#e0f2fe;border-color:#7dd3fc;color:#075985;}',
      '.spCard .spStat{font-size:9.5pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:5px 8px;margin:0 0 6px;} .spCard .spRow{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;} .spCard .spRow > *{margin:0;}',
      '.spCard .spLbl{font-size:8.5pt;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.04em;margin-top:8px;} .spCard .spHint{font-size:9pt;color:#475569;margin:4px 0;}',
      '.spStat .spGhSt,.spCard .spGhSt{display:inline-block;font-size:8.5pt;padding:0 6px;border-radius:9px;border:1px solid #cbd5e1;}',
      '@media (max-width:560px){.spLib.spStd table,.spLib.spStd tbody,.spLib.spStd tr,.spLib.spStd td{display:block;width:auto;} .spLib.spStd thead{display:none;} .spLib.spStd tr{border-bottom:1px solid #cbd5e1;padding:4px 0;} .spLib.spStd td{border:0;padding:2px 4px;} .spLib.spStd td[data-l]::before{content:attr(data-l) ": ";font-weight:600;color:#475569;} .spLib .spTools button{flex:1 1 auto;}}',
      /* START (trial, 2026-11-06): the "Recent projects" strip under the header, and the dialog's start setting */
      '.spStart[data-sp]{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;box-sizing:border-box;max-width:100%;margin:0 0 6px;padding:4px 8px;border:1px solid #bfdbfe;border-radius:6px;background:#eff6ff;color:#0f172a;font-size:9.5pt;}',
      '.spStart button{font:inherit;font-size:9pt;padding:2px 8px;margin:0;border:1px solid #94a3b8;border-radius:4px;background:#fff;color:#0f172a;cursor:pointer;max-width:100%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.spStart button:hover{background:#f1f5f9;} .spStart button.spPri{background:#1d4ed8;border-color:#1d4ed8;color:#fff;} .spStart button.spPri:hover{background:#1e40af;} .spStart .spStLbl{font-weight:600;color:#1e3a8a;} .spStart .spStNote{color:#475569;font-size:8.5pt;} .spStart .spStList{display:contents;}',
      '.spStart button.spStX{margin-left:auto;border-color:transparent;background:transparent;font-size:11pt;line-height:1;padding:0 6px;} .spStart button.spStX:hover{background:#dbeafe;}',
      '.spStart button .spGhMini{margin-left:4px;} .spLib .spStartPref{display:flex;gap:6px;align-items:center;font-size:9pt;color:#334155;margin:8px 0 2px;}',
      '@media (max-width:560px){.spStart button{max-width:calc(100vw - 60px);}}',
      /* LIVE (2026-11-08): the chip's auto-save / upload status and the open project's banners (GitHub sync only) */
      '.spLiveSt{font-size:8pt;color:#475569;white-space:nowrap;} .spLiveSt.warn{color:#92400e;}',
      '.spLive[data-sp]{position:fixed;left:12px;bottom:12px;z-index:2147482000;display:flex;flex-direction:column;gap:6px;max-width:min(480px,calc(100vw - 24px));font:13px/1.35 system-ui,sans-serif;}',
      '.spLive .spLvB{position:relative;background:#eff6ff;color:#0f172a;border:1px solid #93c5fd;border-radius:6px;padding:7px 28px 7px 10px;box-shadow:0 4px 14px rgba(0,0,0,.15);}',
      '.spLive .spLvB.warn{background:#fffbeb;border-color:#f59e0b;color:#78350f;} .spLive .spLvB.info{background:#f8fafc;border-color:#cbd5e1;}',
      '.spLive .spLvB button{font:inherit;font-size:12px;padding:2px 9px;margin:4px 6px 0 0;border:1px solid #94a3b8;border-radius:4px;background:#fff;color:#0f172a;cursor:pointer;}',
      '.spLive .spLvB button.spPri{background:#1d4ed8;border-color:#1d4ed8;color:#fff;} .spLive .spLvB button.spLvX{position:absolute;top:3px;right:3px;margin:0;border:0;background:none;font-size:14px;line-height:1;padding:2px 5px;}',
      '.spLive .spLvB .spLvN{display:block;font-size:11.5px;color:#475569;margin-top:2px;}',
      '@media print{dialog.spLib{display:none!important;} .spStart[data-sp]{display:none!important;} .spLive[data-sp]{display:none!important;}}'
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
    const std = !!ctx.standard;
    const dlg = document.createElement('dialog'); dlg.className = std ? 'spLib spStd' : 'spLib'; dlg.setAttribute('data-sp', 'dialog'); dlg.id = ctx.id || 'spLibDlg';
    dlg.innerHTML = std
      ? `<div class="spHead"><strong>${esc(ctx.title || ('Saved projects' + (ctx.label ? ' — ' + ctx.label : '')))}</strong><span><button type="button" data-spa="close">Close</button></span></div>`
        + `<div class="spTools"><input type="search" class="spFilter" placeholder="Filter by name…" aria-label="Filter saved projects by name">${ctx.save ? `<button type="button" class="spPri" data-spa="save">${esc(ctx.saveLabel || 'Save the open project…')}</button>` : ''}${ctx.importFile ? '<button type="button" data-spa="import">Import JSON…</button>' : ''}</div><div class="spBody"></div>`
      : `<div class="spHead"><strong>${esc(ctx.title || 'Saved projects')}</strong><span>${ctx.save ? `<button type="button" data-spa="save">${esc(ctx.saveLabel || 'Save the open project…')}</button>` : ''}<button type="button" data-spa="close">Close</button></span></div><div class="spBody"></div>`;
    if (std && ctx.startPref) {   // START (trial): "Show this when the app opens" (projectBar ctx.start only)
      const l = document.createElement('label'); l.className = 'spStartPref';
      l.innerHTML = '<input type="checkbox" class="spStartChk"> Show this when the app opens';
      l.title = 'On: this list opens every time the app starts (instead of the Recent projects strip). Remembered in this browser.';
      dlg.appendChild(l);
      const c = l.querySelector('input'); c.addEventListener('change', () => ctx.startPref.set(c.checked));
    }
    document.body.appendChild(dlg);
    const body = dlg.querySelector('.spBody');
    let msg = '';
    const cloud = ctx.cloud && window.SharedGitHubSync ? window.SharedGitHubSync.attach(ctx) : null;   // GHS (2026-11-05)
    const cui = { redraw: () => draw(), close: () => dlg.close() };
    dlg.addEventListener('click', e => {
      if (e.target === dlg) { dlg.close(); return; }
      const b = e.target.closest('[data-spa]'); if (!b) return;
      if (b.dataset.spa === 'close') { dlg.close(); return; }
      if (b.dataset.spa === 'save') { const r = ctx.save(); if (r && r.ok === false && r.message) msg = r.message; else msg = ''; if (ctx.changed) ctx.changed(); draw(); return; }
      if (b.dataset.spa === 'import') { dlg.close(); ctx.importFile(); return; }
      act(b.dataset.spa, decodeURIComponent(b.dataset.n || ''));
    });
    function usageHtml() {
      const u = SP().usage(ctx.storage, ctx.store.keys ? ctx.store.keys() : [ctx.store.key]);   // store.keys() (STDS-B): a list kept under several keys
      if (!u.counted) return '<p class="spNote">Storage use cannot be read in this browser.</p>';
      const mb = x => (x * 2 / 1048576).toFixed(2), pct = Math.min(100, Math.round(u.frac * 100)), cls = u.frac > 0.9 ? 'full' : u.frac > 0.7 ? 'high' : '';
      return `<div class="spUse"><div class="spBar ${cls}"><i style="width:${pct}%"></i></div><span>Browser storage: ${mb(u.chars)} MB of about ${mb(u.quota)} MB used (${pct}%); this tool's saved projects use ${mb(u.of)} MB. Every tool opened from a file in this browser shares this space.</span></div>`
        + (u.frac > 0.9 ? '<p class="spErr">Storage is almost full. Delete saved projects you no longer need, or use Export JSON.</p>' : '');
    }
    const filt = std ? dlg.querySelector('.spFilter') : null;
    function applyFilter() {
      if (!filt) return; const q = filt.value.trim().toLowerCase();
      body.querySelectorAll('tbody tr[data-name]').forEach(tr => { tr.style.display = !q || decodeURIComponent(tr.dataset.name).toLowerCase().indexOf(q) >= 0 ? '' : 'none'; });
    }
    if (filt) filt.addEventListener('input', applyFilter);
    /* STDS: the standard table: this browser's projects and (sync on) the GitHub-only ones, one row each */
    function drawStd() {
      const r = ctx.store.read(), items = ctx.store.list(), cur = ctx.current ? ctx.current() : null, enc = n => encodeURIComponent(n);
      const on = !!(cloud && cloud.engine.configured()), gh = on ? cloud.engine.rows() : [], ghBy = new Map(gh.map(x => [x.name, x]));
      const rows = items.map(i => ({ name: i.name, saved: i.saved, size: i.size, local: true }));
      gh.forEach(x => { if (x.status === 'cloud') rows.push({ name: x.name, local: false }); });
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      const B = (a, n, t, c) => `<button type="button" data-spa="${a}" data-n="${enc(n)}"${c ? ` class="${c}"` : ''}>${t}</button>`, G = (a, n, t, c) => `<button type="button" data-ghx="${a}" data-n="${enc(n)}"${c ? ` class="${c}"` : ''}>${t}</button>`;
      body.innerHTML = (msg ? `<p class="spErr">${esc(msg)}</p>` : '')
        + (!r.ok ? '<p class="spErr">The saved-project list in this browser could not be read. It is left as it is; nothing in it is changed.</p>' : '')
        + (rows.length ? `<div class="spScroll"><table><thead><tr><th>Name</th><th>Last saved (Eastern)</th><th>Size</th><th>This browser</th>${on ? '<th>GitHub</th>' : ''}<th></th></tr></thead><tbody>${
          rows.map(i => { const g = ghBy.get(i.name);
            return `<tr data-name="${enc(i.name)}" class="${i.name === cur && i.local ? 'spCur' : ''}"><td>${i.name === cur && i.local ? `<b>${esc(i.name)}</b> <span class="spNote">(open now)</span>` : esc(i.name)}</td>`
              + `<td data-l="Last saved">${i.local ? esc(SP().etTime(i.saved) || '—') : '—'}</td><td data-l="Size">${i.local ? Math.max(1, Math.round(i.size / 1024)) + ' KB' : '—'}</td>`
              + `<td data-l="This browser">${i.local ? '<span class="spYes" title="Saved in this browser">✓</span>' : '<span class="spNo" title="Not in this browser">—</span>'}</td>`
              + (on ? `<td data-l="GitHub">${cloud.cell(i.name, g ? g.status : null, g && g.conflict) || (ctx.ghNote && ctx.ghNote(i.name)) || ''}</td>` : '')
              + `<td class="spAct">${i.local ? B('open', i.name, 'Open') + B('rename', i.name, 'Rename') + B('dup', i.name, 'Duplicate') + B('export', i.name, 'Export') + B('del', i.name, 'Delete', 'spDel')
                : G('open', i.name, 'Open') + G('get', i.name, 'Download') + G('delcloud', i.name, 'Delete from GitHub', 'spDel')}</td></tr>`; }).join('')}</tbody></table></div>`
          : '<p class="spNote">No saved projects yet. Use Save to keep the open project in this browser.</p>')
        + usageHtml() + (ctx.note || `<p class="spNote">Open asks first when the project on screen has unsaved changes. Delete removes the browser copy${on ? ' and asks whether to delete the GitHub copy too' : ''}. Export makes a .json file of one saved project.</p>`);
      if (cloud) cloud.decorate(body, cui, { rows: false, only: false });
      applyFilter();
    }
    function exportOne(name) {
      if (ctx.exportOne) { ctx.exportOne(name); return; }
      const it = ctx.store.item(name); if (it === undefined) return;
      const cfg = ctx.cloud || {}; let f = JSON.parse(JSON.stringify(it)); if (cfg.toFile) f = cfg.toFile(f, name);
      const text = typeof f === 'string' ? f : JSON.stringify(f, null, cfg.space == null ? 1 : cfg.space);
      download(name.replace(/[\\/:*?"<>|]+/g, '_') + '.json', text);
    }
    function draw() {
      if (std) { drawStd(); return; }
      const r = ctx.store.read(), items = ctx.store.list(), cur = ctx.current ? ctx.current() : null, enc = n => encodeURIComponent(n), hasT = items.some(i => i.saved != null);
      body.innerHTML = (msg ? `<p class="spErr">${esc(msg)}</p>` : '')
        + (!r.ok ? '<p class="spErr">The saved-project list in this browser could not be read. It is left as it is; nothing in it is changed.</p>' : '')
        + (items.length ? `<div class="spScroll"><table><thead><tr><th>Name</th>${hasT ? '<th>Last saved (Eastern)</th>' : ''}<th>Size</th><th></th></tr></thead><tbody>${
          items.map(i => `<tr class="${i.name === cur ? 'spCur' : ''}"><td>${esc(i.name)}${i.name === cur ? ' <span class="spNote">(open now)</span>' : ''}</td>${hasT ? `<td>${esc(SP().etTime(i.saved) || '—')}</td>` : ''}<td>${Math.max(1, Math.round(i.size / 1024))} KB</td>`
            + `<td class="spAct"><button type="button" data-spa="open" data-n="${enc(i.name)}">Open</button><button type="button" data-spa="rename" data-n="${enc(i.name)}">Rename</button>`
            + `<button type="button" data-spa="dup" data-n="${enc(i.name)}">Duplicate</button><button type="button" class="spDel" data-spa="del" data-n="${enc(i.name)}">Delete</button></td></tr>`).join('')}</tbody></table></div>`
          : '<p class="spNote">No saved projects yet. Use Save to keep the open project in this browser.</p>')
        + usageHtml() + (ctx.note || (cloud && cloud.note()) || '<p class="spNote">Saved projects stay in this browser only. Export JSON makes a file you can back up or move to another computer.</p>');
      if (cloud) cloud.decorate(body, cui);
    }
    function done(r) { msg = r && !r.ok ? (r.message || r.error) : ''; if (ctx.changed) ctx.changed(); draw(); return r && r.ok; }
    function act(a, name) {
      if (!ctx.store.has(name)) { msg = 'That saved project is not in this browser any more.'; draw(); return; }
      if (a === 'open') { msg = ''; if (ctx.open(name) !== false) dlg.close(); else draw(); return; }
      if (a === 'export') { exportOne(name); return; }
      if (a === 'rename') {
        const n = prompt(`Rename the saved project "${name}" to:`, name); if (n == null) return;
        let r = ctx.store.rename(name, n);
        if (!r.ok && r.error === 'exists') { if (!confirm(`A saved project named "${n.trim()}" already exists. Replace it with "${name}"?`)) return; r = ctx.store.rename(name, n, { replace: true }); }
        if (done(r)) { if (ctx.renamed) ctx.renamed(name, r.name); if (cloud) cloud.renamed(name, r.name); } draw(); return;
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
        if (done(ctx.store.remove(name))) { if (ctx.deleted) ctx.deleted(name); if (cloud) cloud.deleted(name); } draw();
      }
    }
    function show() { msg = ''; if (filt) filt.value = ''; draw(); if (std && ctx.startPref) { const c = dlg.querySelector('.spStartChk'); if (c) c.checked = !!ctx.startPref.get(); } if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); } if (cloud) cloud.shown(cui).catch(() => {}); }
    function refresh() { if (dlg.open) draw(); }
    return { show, refresh, el: dlg, cloud };
  }

  /* download(file name, text): a .json download (Blob + link); the URL is revoked later (an immediate revoke can cancel it). */
  function download(file, text) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = file;
    a.setAttribute('data-sp', 'dl'); document.body.appendChild(a); a.click(); a.remove(); const h = a.href; setTimeout(() => URL.revokeObjectURL(h), 60000);
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


  /* projectBar(ctx) (STDS, 2026-11-05; engineer-approved standard save, mock-ups in the save survey of that date)
     The standard save controls of a tool, over the tool's own list (a mapStore / listStore: key and format unchanged):
       header: "Project: <name> ● saved / unsaved changes" chip (a small GitHub badge while sync is on; click = Saved projects…),
               Save (Ctrl+S), Saved projects…  (the tool keeps its own Undo / Redo / Print buttons in the header)
       card ("Save and open", first card of the Project tab): status line; Save (Ctrl+S) · Save as… (Ctrl+Shift+S) ·
               Saved projects… · New; "File on this computer": Export JSON · Import JSON; two hint lines; extras (tool-specific).
     Save saves to the open name and never asks; with no open name it is Save as. Save as asks for the name and where:
     "This browser and GitHub (cloud)" (default when sync is set up) / "This browser only" (not uploaded until Upload) /
     "File on this computer (.json)" (the tool's Export JSON; the list is not changed). A name already in the list (or on GitHub
     only) is not overwritten without "Replace it". Opening another project, New and Import ask first when there are unsaved
     changes. Nothing is stored by this function: the open project's name lives in the tool (ctx.current / ctx.setCurrent) or in
     this page only; after a reload it is found again by content (the saved project whose data equals the inputs on screen).
     ctx = { store, storage, label (tool name), cloud (as libraryDialog), id,
             snapshot() -> text of the inputs on screen (compared with snapOf(name) for "unsaved changes"; default
               SharedProjects.canon(getState(), omit)), snapOf(name) -> the same text for a saved project (default canon(store.get(name),
               omit)), omit ([top-level fields that are view only, e.g. the open tab: left out of the comparison]),
             save(name) -> the tool's own save into the list ({ ok, message } or true / false; default store.save(name, getState())),
             getState() (for the default save), open(name) -> false when it did not open (the tool's own open / load path),
             current() / setCurrent(name) (optional: where the tool keeps the open name), displayName() (optional: shown in the chip
               when the open project is not saved yet, e.g. the title block's project name),
             newProject() (optional: the tool's own New / Reset path; it asks nothing itself), exportFile(name) (the tool's Export
               JSON), importFile() (the tool's Import JSON), fileButtons ([elements]: the tool's own Export / Import buttons, moved
               into the card instead), extras ([elements]: a third row), header (element for the chip / Save / Saved projects…),
             card (element, or true + mount(el) later),
             headerBefore (optional element in it: Save and Saved projects… go before it, e.g. Print), chipBefore (the chip goes
               before it, e.g. Undo; default headerBefore), card (element the card body goes into), keys (default true),
             renamed / deleted / changed / note / exportOne (passed to the dialog), afterSave(name), afterOpen(name),
             start (optional, START trial 2026-11-06, off unless given; see startChooser below),
             HDRS (2026-11-06, TRIAL in Spread Footing only; both off unless given, so every other tool is unchanged):
             headerSave (default true; false: the header gets the chip only, no Save / Saved projects… buttons: they stay in the card,
               and Ctrl+S / Ctrl+Shift+S still work from anywhere), chipClick() (optional: what a click on the chip does instead of
               opening Saved projects…, e.g. open the Project tab), chipHint (the chip tooltip's "Click: …" text with chipClick),
             STDS-B (2026-11-06, for a list that is not a mapStore, e.g. items by id with duplicate names shown under unique names):
             askUnsaved ('always': Open / New / Import ask on unsaved changes even when the inputs on screen are not a saved project
               and were not edited on this page, e.g. unsaved work restored from the autosave), ghNote(name) (passed to the dialog:
               the GitHub cell of a row the sync has no status for), and save(name) may return { ok: true, name } when the list name
               it stored the project under differs from the name asked (the tool's own name field) }
     Returns { dialog, save, saveAs, newProject, importJSON (both ask first on unsaved changes), refresh, dirty, current, setCurrent,
       el: { chip, save, lib, card } } */
  const bars = [];   // every projectBar of the page (tests drive Save as through it)
  function projectBar(ctx) {
    css();
    const store = ctx.store, clean = n => String(n == null ? '' : n).trim();
    const C = v => SP().canon ? SP().canon(v, ctx.omit) : JSON.stringify(v);   // keys sorted; ctx.omit: view-only top-level fields
    const snapOf = ctx.snapOf || (n => { try { return C(store.get(n)); } catch (e) { return null; } });
    const snapshot = () => { try { return ctx.snapshot ? ctx.snapshot() : C(ctx.getState()); } catch (e) { return null; } };
    let cur = null, touched = false; const savedAt = {};   // touched: inputs changed on this page since the last open / save / New
    function getCur() { if (ctx.current) { const n = clean(ctx.current()); return n || null; } return cur; }
    let live = null;   // LIVE (2026-11-08): liveBar below (GitHub sync only)
    function setCur(n) { cur = n; touched = false; if (ctx.setCurrent) ctx.setCurrent(n || ''); if (live) live.reset(); }
    /* on load: the tool's open name if it is in the list, else the saved project whose data equals what is on screen */
    (function find() {
      const n = getCur(); if (n && store.has(n)) { cur = n; return; }
      const s = snapshot(); if (s == null) return;
      const hit = store.list().find(i => snapOf(i.name) === s); if (hit) setCur(hit.name);
    })();
    const dirty = () => { const n = getCur(); if (!n || !store.has(n)) return true; return snapshot() !== snapOf(n); };
    const inList = () => { const n = getCur(); return !!(n && store.has(n)); };
    const guard = what => !dirty() || (!inList() && !touched && ctx.askUnsaved !== 'always') ? true
      : confirm(`The project on screen has unsaved changes${getCur() && store.has(getCur()) ? ` (since "${getCur()}" was last saved)` : ' and is not in the saved list'}. ${what} anyway? (Cancel, then Save, keeps them.)`);
    let st = null;   // START: the start-of-session chooser (ctx.start), else null
    /* the dialog's Open (and the strip's): asks first on unsaved changes, then the tool's own open path */
    const openNow = n => { if (!guard(`Open "${n}"`)) return false; const r = ctx.open(n); if (r === false) return false; setCur(n); if (ctx.afterOpen) ctx.afterOpen(n); if (st) st.opened(n); later(); return true; };
    /* LIVE PR 3 (presence): another device has the project open -> "Open on <device> since <time>" first (Open anyway / Cancel) */
    const openNamed = n => live && live.openCheck ? live.openCheck(n, openNow) : openNow(n);
    const dialog = libraryDialog({ store, storage: ctx.storage, standard: true, label: ctx.label, id: ctx.id, cloud: ctx.cloud, note: ctx.note, exportOne: ctx.exportOne, ghNote: ctx.ghNote,
      current: () => { const n = getCur(); return n && store.has(n) ? n : null; },
      open: openNamed,
      renamed: (a, b) => { if (getCur() === a) setCur(b); if (savedAt[a]) { savedAt[b] = savedAt[a]; delete savedAt[a]; } if (st) st.renamed(a, b); if (ctx.renamed) ctx.renamed(a, b); later(); },
      deleted: n => { if (st) st.deleted(n); if (ctx.deleted) ctx.deleted(n); later(); },
      startPref: ctx.start ? { get: () => !!(st && st.pref()), set: v => { if (st) st.setPref(v); } } : null,
      changed: () => { if (ctx.changed) ctx.changed(); later(); },
      save: () => { saveAs(); return null; }, saveLabel: 'Save the open project…',
      importFile: ctx.importFile ? () => importJSON() : null });
    const eng = () => dialog.cloud && dialog.cloud.engine && dialog.cloud.engine.configured() ? dialog.cloud.engine : null;
    const kbd = k => `<kbd class="spKbd">${k}</kbd>`;
    const mk = (html, title, o) => { const b = button('', title, o); b.innerHTML = html; return b; };
    /* header */
    const chip = mk('', 'The project open now: open Saved projects…', { cls: 'spChip', sp: 'chip' });
    const hSave = mk('Save' + kbd('Ctrl+S'), 'Save the open project in this browser’s list (and to GitHub when Cloud sync is on). Ctrl+S', { cls: 'spPri', sp: 'hsave' });
    const hLib = button('Saved projects…', 'The projects saved in this browser (and on GitHub): open, rename, duplicate, export, delete', { sp: 'hlib' });
    chip.addEventListener('click', () => { if (ctx.chipClick) ctx.chipClick(); else dialog.show(); }); hSave.addEventListener('click', () => save()); hLib.addEventListener('click', () => dialog.show());   // HDRS: ctx.chipClick
    if (ctx.header) {   // standard order: chip · (Undo · Redo) · Save · Saved projects… · (Print)
      const at = x => x && x.parentNode === ctx.header ? x : null;
      ctx.header.insertBefore(chip, at(ctx.chipBefore) || at(ctx.headerBefore));
      if (ctx.headerSave !== false) [hSave, hLib].forEach(b => ctx.header.insertBefore(b, at(ctx.headerBefore)));   // HDRS: headerSave false = chip only
    }
    /* card */
    let card = null, stat = null;
    if (ctx.card) {   // an element (the card goes first in it), or true: built now, placed later with mount(el) (a tab drawn again)
      card = document.createElement('div'); card.className = 'spCard'; card.setAttribute('data-sp', 'card');
      card.innerHTML = '<div class="spStat" role="status"></div><div class="spRow" data-r="1"></div><div class="spLbl">File on this computer</div><div class="spRow" data-r="2"></div>'
        + '<p class="spHint">Save keeps the project in this browser’s list and, with Cloud sync on, copies it to GitHub. Export JSON makes a .json file you can keep, e-mail or open on another computer (Import JSON).</p>'
        + '<p class="spHint">Autosave: the inputs on screen are kept in this browser while you work and come back when you reopen the tool. Autosave is not a saved project and is not synced.</p>';
      stat = card.querySelector('.spStat');
      const r1 = card.querySelector('[data-r="1"]'), r2 = card.querySelector('[data-r="2"]');
      const cSave = mk('Save' + kbd('Ctrl+S'), 'Save the open project (Ctrl+S)', { cls: 'spPri', sp: 'save' }), cAs = mk('Save as…' + kbd('Ctrl+Shift+S'), 'Save under a new name, or to a file (Ctrl+Shift+S)', { sp: 'saveas' });
      const cLib = button('Saved projects…', 'The projects saved in this browser (and on GitHub)', { sp: 'lib' });
      cSave.addEventListener('click', () => save()); cAs.addEventListener('click', () => saveAs()); cLib.addEventListener('click', () => dialog.show());
      r1.append(cSave, cAs, cLib);
      if (ctx.newProject) { const nb = button('New', 'Start a new project (the default inputs); saved projects are kept', { sp: 'new' }); nb.addEventListener('click', () => newProject()); r1.append(nb); }
      if (ctx.fileButtons && ctx.fileButtons.length) ctx.fileButtons.forEach(b => r2.append(b));
      else {
        if (ctx.exportFile) { const b = button('Export JSON', 'Save the inputs on screen as a .json file', { sp: 'export' }); b.addEventListener('click', () => ctx.exportFile(getCur())); r2.append(b); }
        if (ctx.importFile) { const b = button('Import JSON', 'Open a .json file of this tool', { sp: 'import' }); b.addEventListener('click', () => importJSON()); r2.append(b); }
      }
      if (ctx.extras && ctx.extras.length) { const r3 = document.createElement('div'); r3.className = 'spRow'; r3.setAttribute('data-r', '3'); ctx.extras.forEach(b => r3.append(b)); r2.after(r3); }
      if (ctx.card !== true) ctx.card.insertBefore(card, ctx.card.firstChild);
    }
    function mount(el) { if (card && el && card.parentNode !== el) el.insertBefore(card, el.firstChild); refresh(); }
    const LBL = { synced: 'synced', pending: '↑ waiting', local: 'this browser only', removed: 'not on GitHub', unknown: 'not checked yet', 'cloud-newer': 'GitHub newer', conflict: 'conflict' };
    const timeOf = n => { const i = store.list().find(x => x.name === n); const t = i && i.saved != null ? i.saved : savedAt[n]; if (t == null) return ''; const d = new Date(t); return isNaN(d) ? '' : d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }); };
    function refresh() {
      const n = getCur(), inList = !!(n && store.has(n)), d = dirty(), e = eng(), stt = e && inList ? e.statusOf(n) : null, t = inList ? timeOf(n) : '';
      const shown = inList ? n : (n || (ctx.displayName && clean(ctx.displayName())) || 'not saved yet');
      chip.innerHTML = `<span class="spDot${d ? ' dirty' : ''}"></span><span>Project:</span> <b>${esc(shown)}</b> <span>· ${!inList ? 'not saved' : d ? 'unsaved changes' : 'saved'}</span>`
        + (e ? ` <span class="spGhMini ${stt || ''}" title="Cloud sync (GitHub): ${esc(stt ? LBL[stt] || stt : 'not saved')}">GitHub ${stt === 'synced' ? '✓' : stt === 'pending' ? '↑' : stt === 'conflict' ? '!' : '·'}</span>` : '')
        + (e && live ? live.chipHtml(n, inList) : '');   // LIVE: "auto-saved 14:32" / "uploading" / "pending (offline)"
      chip.title = (inList ? `"${n}" ${d ? 'has unsaved changes' : 'is saved'} in this browser` : 'The inputs on screen are not a saved project yet') + '. Click: ' + (ctx.chipClick ? ctx.chipHint || 'open the project' : 'Saved projects…');
      if (stat) stat.innerHTML = `<span class="spDot${d ? ' dirty' : ''}"></span> ` + (inList
        ? `<b>${esc(n)}</b> — ${d ? 'changed since it was saved' : 'saved'}${t ? ` (${esc(t)})` : ''}. In this browser ✓${e ? ` · GitHub (cloud) <span class="spGhSt ${stt || ''}">${esc(LBL[stt] || stt || '')}</span>` : ''}`
        : `<b>${esc(shown === 'not saved yet' ? 'Not saved yet' : shown)}</b> — not in the saved list. Use Save as… to keep it in this browser${e ? ' and on GitHub' : ''}.`);
    }
    let tmr = 0; function later() { clearTimeout(tmr); tmr = setTimeout(refresh, 250); }
    const edit = ev => { const t = ev.target; if (!(t && t.closest && t.closest('[data-sp]'))) touched = true; later(); };
    document.addEventListener('input', edit, true); document.addEventListener('change', edit, true); document.addEventListener('click', later, true);
    setInterval(refresh, 3000);
    function done(r, name, quiet, auto) {   // auto (LIVE): an auto-save: no message, the background upload sends it (with the tool's settle time)
      if (r && r.ok && typeof r.name === 'string' && r.name) name = r.name;   // STDS-B: the name the tool's save stored it under (the list name follows the project's own name field)
      const ok = r !== false && !(r && r.ok === false) && store.has(name);   // the tool's save may return nothing
      if (!ok) { if (!quiet) alert((r && r.message) || 'The project was not saved.'); later(); return false; }
      setCur(name); savedAt[name] = Date.now(); if (st && !auto) st.opened(name); if (ctx.changed) ctx.changed(); dialog.refresh();
      if (!auto && dialog.cloud && dialog.cloud.tick) dialog.cloud.tick(true).catch(() => {});   // true (BSS): sent now even with a settle time
      if (ctx.afterSave) ctx.afterSave(name); refresh(); return true;
    }
    const doSave = name => done(ctx.save ? ctx.save(name) : store.save(name, ctx.getState()), name);
    /* Save: to the open name, no question; no open name: Save as */
    function save() { const n = getCur(); if (n && store.has(n)) return doSave(n); return saveAs(); }
    /* Save as dialog */
    let sd = null;
    function saveAs() {
      if (!sd) { sd = document.createElement('dialog'); sd.className = 'spLib spSave'; sd.setAttribute('data-sp', 'saveas'); sd.id = (ctx.id || 'spLibDlg') + 'SaveAs'; document.body.appendChild(sd); }
      const e = eng(), s = e ? e.settings() : null, repo = s ? `${s.owner}/${s.repo}` : '';
      const opt = (v, t, h, on, off) => `<label class="spOpt${on ? ' on' : ''}${off ? ' off' : ''}"><input type="radio" name="spLoc" value="${v}"${on ? ' checked' : ''}${off ? ' disabled' : ''}><span><b>${t}</b><br><span class="spNote">${h}</span></span></label>`;
      sd.innerHTML = `<div class="spHead"><strong>Save as</strong><span><button type="button" data-sa="close">Close</button></span></div>`
        + `<label class="spField" for="${sd.id}N">Project name</label><input id="${sd.id}N" class="spName" autocomplete="off" value="${esc(getCur() || (ctx.displayName && clean(ctx.displayName())) || '')}">`
        + `<div class="spField" style="margin-top:10px">Save to</div>`
        + opt('cloud', 'This browser and GitHub (cloud)', e ? `In this browser’s saved projects; copied to ${esc(repo)} within a few seconds. Opens on every device with sync set up.` : 'Cloud sync (GitHub) is not set up in this browser (Saved projects…, Cloud sync (GitHub)…).', !!e, !e)
        + opt('local', 'This browser only', e ? 'Not uploaded (you can Upload it later from Saved projects).' : 'In this browser’s saved projects.', !e, false)
        + (ctx.exportFile ? opt('file', 'File on this computer (.json)', 'The same file as Export JSON. Not added to the browser list.', false, false) : '')
        + `<div class="spMsg"></div><div class="spBtns"><button type="button" data-sa="cancel">Cancel</button><button type="button" class="spPri" data-sa="ok">Save</button></div>`;
      const inp = sd.querySelector('.spName'), msgEl = sd.querySelector('.spMsg'); let replaceOk = '';
      const loc = () => { const r = sd.querySelector('input[name=spLoc]:checked'); return r ? r.value : 'local'; };
      sd.onchange = () => { sd.querySelectorAll('.spOpt').forEach(l => l.classList.toggle('on', l.querySelector('input').checked)); sd.querySelector('[data-sa=ok]').textContent = 'Save'; replaceOk = ''; msgEl.innerHTML = ''; };
      inp.oninput = () => { replaceOk = ''; msgEl.innerHTML = ''; sd.querySelector('[data-sa=ok]').textContent = 'Save'; };
      inp.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } };
      function go() {
        const n = clean(inp.value), where = loc(); if (!n) { msgEl.innerHTML = '<p class="spErr">Enter a project name.</p>'; inp.focus(); return; }
        if (where === 'file') { sd.close(); ctx.exportFile(n); return; }
        const cl = e && e.cloud ? e.cloud() : null, onGh = !!(cl && cl.has(n)) && !store.has(n);
        if ((store.has(n) || onGh) && replaceOk !== n && n !== getCur()) {
          msgEl.innerHTML = `<div class="spWarn">${store.has(n) ? `A saved project named “${esc(n)}” already exists in this browser.` : `A project named “${esc(n)}” is on GitHub (saved on another device). Saving under this name keeps both: yours is uploaded as a conflict copy.`} Type another name, or press Replace it.</div>`;
          sd.querySelector('[data-sa=ok]').textContent = 'Replace it'; replaceOk = n; inp.focus(); return;
        }
        const wasHeld = !!(e && e.held(n)); if (e) e.hold(n, where === 'local');
        sd.close(); if (doSave(n) && e && where === 'cloud' && wasHeld) e.upload(n).catch(() => {});
      }
      sd.onclick = ev => { if (ev.target === sd) { sd.close(); return; } const b = ev.target.closest('[data-sa]'); if (!b) return; if (b.dataset.sa === 'ok') go(); else sd.close(); };
      if (!sd.open) { if (sd.showModal) sd.showModal(); else sd.setAttribute('open', ''); }
      inp.focus(); inp.select();
    }
    function newProject() { if (!guard('Start a new project')) return; ctx.newProject(); setCur(null); refresh(); }
    function importJSON() { if (!guard('Import a file')) return; ctx.importFile(); }
    if (ctx.keys !== false) document.addEventListener('keydown', ev => {
      if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || (ev.key || '').toLowerCase() !== 's') return;
      ev.preventDefault();   // never the browser's "Save page as"
      if (document.querySelector('dialog[open]')) return;
      if (ev.shiftKey) saveAs(); else save();
    });
    st = ctx.start ? startChooser(ctx, { store, dialog, eng, openNamed, getCur, setCur, snapshot, snapOf, refresh, clean, dirty }) : null;
    /* LIVE: after a Load it / Undo the tool has opened the name: the same bookkeeping as the dialog's Open */
    const opened = n => { setCur(n); if (ctx.afterOpen) ctx.afterOpen(n); if (st) st.opened(n); if (ctx.changed) ctx.changed(); dialog.refresh(); refresh(); };
    live = liveBar(ctx, { store, dialog, eng, getCur, snapshot, dirty, refresh, opened, autoSave: n => { let r; try { r = ctx.save ? ctx.save(n) : store.save(n, ctx.getState()); } catch (x) { r = { ok: false, message: x && x.message }; } return done(r, n, true, true); } });
    refresh();
    const api = { dialog, save, saveAs, newProject, importJSON, mount, refresh, dirty, current: getCur, setCurrent: n => { setCur(n); refresh(); }, el: { chip, save: hSave, lib: hLib, card }, start: st, live };
    bars.push(api); return api;
  }

  /* liveBar(ctx, b) (LIVE, 2026-11-08; engineer request). Called by projectBar for every tool; does NOTHING (no timer work, no request,
     no key) while Cloud sync (GitHub) is not set up in this browser or shared/github-sync.js is not loaded. With sync set up:
     A. Auto-save ("Auto-save open project every 30 s" in the Cloud sync dialog; on unless unticked): while a NAMED project of the list
        is open, its inputs were changed on this page and differ from the saved copy, they are saved into it through the tool's own
        Save (ctx.save: the same path, list key and format as Save) about every 30 s, once they have been unchanged for 5 s
        (SharedGitHubSync.autoSaveDue). A project not saved under a name yet is never auto-saved (the tool's own autosave key is
        untouched). The upload is the existing background upload (with the tool's settle time, e.g. 30 s in the Bridge Suite), and
        only a changed file text is uploaded (the file's sha). The chip shows "auto-saved 14:32" / "uploading" / "pending (offline)".
     B. The open project's GitHub check ("Check GitHub every 30 s for changes to the open project"; on unless unticked): every 30 s
        while the tab is visible (paused while it is hidden), one tree request (SharedGitHubSync engine poll). When GitHub's file
        changed since this browser last synced it, a banner "Updated on <device> at <time> — Load it / Keep mine". Load it: the
        GitHub version into the list (a version of this browser that GitHub does not have is kept first as a conflict copy; unsaved
        inputs on screen are first saved into the project, so they end up in that copy) and the tool's own open path; the banner then
        offers Undo (this browser's previous version back, nothing changed on GitHub). Keep mine: the banner closes for that GitHub
        version; nothing is loaded or uploaded (a later save of this project keeps both, as a conflict copy). Nothing on screen is
        ever replaced without Load it.
     C. Presence (LIVE PR 3): see "presence" below.
     b = { store, dialog, eng, getCur, snapshot, dirty, refresh, opened(name), autoSave(name) } (projectBar internals) */
  function liveBar(ctx, b) {
    if (typeof document === 'undefined' || typeof window === 'undefined') return null;
    const G = () => window.SharedGitHubSync && window.SharedGitHubSync.autoSaveDue ? window.SharedGitHubSync : null;
    const now = () => Date.now();
    const lv = { name: undefined, ref: null, snap: null, changedAt: 0, lastAt: now(), autoSnap: null, autoAt: 0, fail: null, pollAt: 0, polling: false,
      loading: false, dismissed: {}, upd: null, undo: null, msg: null,
      beatAt: 0, beatName: null, activeAt: now(), others: [] };   // presence (LIVE PR 3)
    const hm = t => { try { return new Date(t).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch (e) { return ''; } };
    const hidden = () => { try { if (document.visibilityState === 'hidden') return true; const f = window.frameElement; return !!(f && !f.getClientRects().length); } catch (e) { return false; } };   // a tab in the background, or a frame that is not shown
    let box = null;
    /* reset(): a project was opened, saved or started (projectBar setCur): the inputs now are the reference for "edited on this page" */
    function reset() {
      const n = b.getCur(), other = n !== lv.name;
      lv.name = n; lv.ref = lv.snap = b.snapshot(); lv.changedAt = lv.lastAt = now(); lv.autoSnap = null; lv.fail = null;
      if (other) { lv.pollAt = 0; lv.autoAt = 0; lv.others = []; lv.beatAt = 0; leave(); if (lv.upd && lv.upd.name !== n) lv.upd = null; if (lv.undo && lv.undo.u.name !== n) lv.undo = null; draw(); }
    }
    function tick() {
      const g = G(), e = g && b.eng();
      if (!e) { if (box) { lv.upd = lv.undo = lv.msg = null; draw(); } return; }
      const L = g.live(ctx.storage), n = b.getCur(), inList = !!(n && b.store.has(n)), t = now(), s = b.snapshot();
      if (n !== lv.name) reset();
      if (s !== lv.snap) { lv.snap = s; lv.changedAt = t; if (lv.undo && s !== lv.undo.after) { lv.undo = null; draw(); } }
      const d = g.autoSaveDue({ configured: true, on: L.autoSave, name: n, inList, dirty: inList && b.dirty(), edited: lv.ref !== s, snap: s, lastSnap: lv.autoSnap, changedAt: lv.changedAt, lastAt: lv.lastAt, now: t });
      if (d.due && !lv.loading && !document.querySelector('dialog[open]')) {
        lv.lastAt = t; lv.autoSnap = s;
        if (b.autoSave(n)) { lv.autoAt = now(); lv.fail = null; } else { lv.fail = 'not saved'; }
        b.refresh();
      }
      if (!L.watch && (lv.beatName || lv.others.length)) { leave(); lv.others = []; draw(); }
      const bd = g.beatDue({ configured: true, on: L.watch, name: n, inList, hidden: hidden(), now: t, lastAt: lv.beatAt, activeAt: lv.activeAt });
      if (bd.due && e.statusOf(n) != null) { lv.beatAt = t; lv.beatName = n; e.beat(n).catch(() => {}); }   // presence: this device's heartbeat (LIVE PR 3)
      const pd = g.pollDue({ configured: true, on: L.watch, name: n, inList, hidden: hidden(), now: t, lastAt: lv.pollAt });
      if (pd.due && !lv.polling && !lv.loading) {
        lv.pollAt = t; lv.polling = true;
        e.poll(n).then(r => onPoll(e, n, r)).catch(() => {}).then(() => { lv.polling = false; });
      }
    }
    async function onPoll(e, n, r) {
      if (n !== b.getCur() || !r || !r.ok || r.waiting) return;
      const oth = (r.presence || []).filter(x => x.fresh), was = JSON.stringify(lv.others);
      lv.others = oth; if (JSON.stringify(oth) !== was) draw();   // presence: "Also open on <device>"
      if (r.state === 'changed' || r.state === 'both') {
        if (lv.dismissed[n + '\n' + r.cloudSha]) { if (lv.upd) { lv.upd = null; draw(); } return; }
        if (lv.upd && lv.upd.sha === r.cloudSha) { lv.upd.both = r.state === 'both'; draw(); return; }
        const who = await e.changeInfo(n, r.cloudSha);
        if (n !== b.getCur()) return;
        lv.upd = { name: n, sha: r.cloudSha, device: who.device, at: who.at, both: r.state === 'both' };
      } else if (lv.upd) lv.upd = null;
      draw();
    }
    async function loadIt() {
      const u = lv.upd, e = b.eng(); if (!u || !e || lv.loading) return;
      lv.loading = true; lv.msg = null; draw();
      try {
        if (b.dirty() && b.store.has(u.name)) {   // the inputs on screen first into the project, so they are kept (as the conflict copy) below
          if (!b.autoSave(u.name)) { lv.msg = { warn: true, text: 'Your changes on screen could not be saved first, so nothing was loaded. Save them (or Export JSON), then try again.' }; return; }
        }
        const r = await e.loadCloud(u.name);
        if (!r.ok) { lv.msg = { warn: true, text: 'Not loaded: ' + (r.message || r.error || 'GitHub could not be reached.') }; return; }
        if (ctx.open(u.name) === false) { e.undoLoad(r.undo); lv.msg = { warn: true, text: 'The tool did not open the GitHub version; your version was put back.' }; return; }
        b.opened(u.name);
        lv.undo = { u: r.undo, after: b.snapshot(), device: u.device, at: u.at, copy: r.copy || null };
        lv.upd = null;
      } finally { lv.loading = false; b.refresh(); draw(); }
    }
    function undo() {
      const x = lv.undo, e = b.eng(); if (!x || !e) return;
      const r = e.undoLoad(x.u);
      if (!r.ok) { lv.msg = { warn: true, text: r.message || 'Not undone.' }; draw(); return; }
      ctx.open(x.u.name); b.opened(x.u.name);
      lv.dismissed[x.u.name + '\n' + (x.u.cloudSha || '')] = true;   // not offered again for this GitHub version
      lv.undo = null; lv.msg = { text: `Your previous version of “${x.u.name}” is back. The version on GitHub is not changed (Saved projects… shows it).` };
      b.refresh(); draw();
    }
    function keepMine() { const u = lv.upd; if (!u) return; lv.dismissed[u.name + '\n' + u.sha] = true; lv.upd = null; draw(); }
    const who = (dev, at) => `<b>${esc(dev || 'another device')}</b>${at ? ` at ${esc(hm(at))}` : ''}`;
    function draw() {
      const parts = [];
      if (lv.upd) {
        const u = lv.upd, both = u.both || (b.getCur() === u.name && b.dirty());
        parts.push(`<div class="spLvB" data-lv="upd" role="status">Updated on ${who(u.device, u.at)} — <button type="button" class="spPri" data-lva="load"${lv.loading ? ' disabled' : ''}>Load it</button><button type="button" data-lva="keep">Keep mine</button>`
          + `<span class="spLvN">“${esc(u.name)}” was saved on GitHub from another device.${both ? ' You have changes here too: both are kept (yours as a conflict copy).' : ' Load it replaces the inputs on screen (Undo brings them back).'}</span>`
          + `<button type="button" class="spLvX" data-lva="keep" title="Keep mine" aria-label="Close">×</button></div>`);
      }
      if (lv.undo) {
        const x = lv.undo;
        parts.push(`<div class="spLvB info" data-lv="undo" role="status">Loaded the version from ${who(x.device, x.at)}. <button type="button" data-lva="undo">Undo</button>`
          + (x.copy ? `<span class="spLvN">Your previous version is also kept as “${esc(x.copy)}”.</span>` : '')
          + `<button type="button" class="spLvX" data-lva="noundo" aria-label="Close">×</button></div>`);
      }
      if (lv.msg) parts.push(`<div class="spLvB${lv.msg.warn ? ' warn' : ' info'}" data-lv="msg" role="status">${esc(lv.msg.text)}<button type="button" class="spLvX" data-lva="nomsg" aria-label="Close">×</button></div>`);
      extra.forEach(f => { const h = f(); if (h) parts.push(h); });
      if (!parts.length) { if (box) { box.remove(); box = null; } return; }
      if (!box) {
        box = document.createElement('div'); box.className = 'spLive'; box.setAttribute('data-sp', 'live');
        box.addEventListener('click', ev => {
          const t = ev.target.closest('[data-lva]'); if (!t) return; const a = t.dataset.lva;
          if (a === 'load') loadIt(); else if (a === 'keep') keepMine(); else if (a === 'undo') undo();
          else if (a === 'noundo') { lv.undo = null; draw(); } else if (a === 'nomsg') { lv.msg = null; draw(); }
          else acts.forEach(f => f(a, t));
        });
        document.body.appendChild(box);
      }
      box.innerHTML = parts.join('');
    }
    const extra = [], acts = [];   // more banners / actions
    /* ---- presence (LIVE PR 3, 2026-11-08) ----
       While a named project is open (sync and the "Check GitHub…" box on): this device's heartbeat file
       projects/<tool>/.presence/<safe name>.<device id>.json is written when the project is opened and then once a minute, only while
       the tab is visible and the page had an input, click or key in the last 10 min (SharedGitHubSync.beatDue); one file per browser
       (tabs share it). It is deleted when another project is opened, New is used, the box is unticked, or the page closes (pagehide,
       keepalive). Not deleted when the tab is hidden (it goes stale after 2.5 min; deleting and re-adding would double the commits).
       Banner "Also open on <device> (since <time>)" while another device's heartbeat is fresh (from the 30 s check). Opening a
       project (Saved projects, Recent projects strip) that another device has open: "Open on <device> since <time> — edits on both
       may conflict" with Open anyway / Cancel. */
    function leave(ko) { const e = b.eng(), n = lv.beatName; lv.beatName = null; if (e && n) e.leave(n, ko).catch(() => {}); }
    extra.push(() => {
      if (!lv.others.length) return '';
      const list = lv.others.map(x => `<b>${esc(x.device || 'another device')}</b>${x.since ? ` (since ${esc(hm(x.since))})` : ''}`).join(', ');
      return `<div class="spLvB warn" data-lv="pres" role="status">Also open on ${list}<span class="spLvN">“${esc(lv.name || '')}” is open there too. Edits on both devices may conflict; if they do, both versions are kept.</span></div>`;
    });
    const mark = () => { lv.activeAt = now(); };
    ['input', 'pointerdown', 'keydown'].forEach(k => document.addEventListener(k, mark, { capture: true, passive: true }));
    window.addEventListener('pagehide', () => { leave({ keepalive: true }); });
    let pw = null;
    function warnOpen(n, list, go) {
      if (!pw) { pw = document.createElement('dialog'); pw.className = 'spLib spSave'; pw.setAttribute('data-sp', 'presence'); document.body.appendChild(pw); }
      const who = list.map(x => `<b>${esc(x.device || 'another device')}</b>${x.since ? ` since ${esc(hm(x.since))}` : ''}`).join(', ');
      pw.innerHTML = `<div class="spHead"><strong>“${esc(n)}” is open on another device</strong></div>`
        + `<p>Open on ${who} — edits on both may conflict.</p><p class="spNote">If both are saved, both versions are kept (one as a conflict copy). Nothing is lost.</p>`
        + `<div class="spBtns"><button type="button" data-pw="cancel">Cancel</button><button type="button" class="spPri" data-pw="open">Open anyway</button></div>`;
      pw.onclick = ev => { const t = ev.target.closest('[data-pw]'); if (ev.target === pw) { pw.close(); return; } if (!t) return; pw.close(); if (t.dataset.pw === 'open') go(); };
      if (!pw.open) { if (pw.showModal) pw.showModal(); else pw.setAttribute('open', ''); }
    }
    /* openCheck(n, open): the dialog's / strip's Open. At once when sync or the box is off, when it is the open project, or when the
       last tree this page read (less than a minute ago) has no other device's heartbeat for it; else after one check (the tree,
       reused when recent, and the heartbeat files new to this page): returns false at first and opens (or warns) when the answer comes. */
    function openCheck(n, open) {
      const g = G(), e = g && b.eng();
      if (!e || !g.live(ctx.storage).watch || n === b.getCur() || e.presenceHint(n) === 'none') return open(n);
      const go = () => { if (open(n) !== false) { const d = b.dialog && b.dialog.el; if (d && d.open) d.close(); } };
      e.others(n).then(r => { const list = r && r.ok ? r.list : []; if (list.length) warnOpen(n, list, go); else go(); }, go);
      return false;
    }
    /* the chip's text: "auto-saved 14:32" / "uploading" / "pending (offline)" (only with sync set up and a project in the list) */
    function chipHtml(n, inList) {
      const e = b.eng(); if (!e || !inList) return '';
      const v = e.state(), q = !!(v && v.queue.indexOf(n) >= 0), le = e.lastError();
      let t = '', warn = false;
      if (q) { if (le && le.kind === 'offline') { t = 'pending (offline)'; warn = true; } else if (le && le.kind === 'rate') { t = 'pending (rate limit)'; warn = true; } else if (le && le.kind === 'auth') { t = 'pending (token refused)'; warn = true; } else t = 'uploading'; }
      else if (lv.fail && lv.name === n) { t = 'auto-save failed'; warn = true; }
      else if (lv.autoAt && lv.name === n) t = 'auto-saved ' + hm(lv.autoAt);
      return t ? ` <span class="spLiveSt${warn ? ' warn' : ''}" data-sp-live="${esc(t)}">${esc(t)}</span>` : '';
    }
    setInterval(() => { try { tick(); } catch (e) { /* the tool works without it */ } }, 3000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(() => { try { tick(); } catch (e) { /* next tick */ } }, 300); });
    return { reset, tick, chipHtml, draw, state: () => lv, extra, acts, hidden, loadIt, undo, keepMine, openCheck, presence: true };
  }

  /* startChooser(ctx, bar) (START, 2026-11-06: TRIAL in Spread Footing only, pending engineer review). Called by projectBar when
     ctx.start is given (true or an object); without ctx.start nothing below runs, so every other tool is unchanged.
     When the app opens (DOMContentLoaded, after the tool's own start-up scripts):
       - autosave in this browser and at least one saved project: a "Recent projects" strip right after ctx.start.after (normal page
         flow, never over the page): "Continue: <name> (autosaved <time, US Eastern>)", up to 5 saved projects as Open buttons (most
         recently saved / opened first; with GitHub sync on, the GitHub-only ones once the background listing is back, marked
         "GitHub only"), "All saved projects…" (the standard dialog) and ×. It closes on the first input edit, on Open and on ×.
         Open = the dialog's Open (openNamed: asks first on unsaved changes, then the tool's own open).
       - no autosave (first use on this device) and at least one saved project (here or on GitHub): the standard dialog opens instead.
       - no project at all: nothing.
       - "Show this when the app opens" (in the dialog; off by default): the dialog opens at every start instead of the strip.
       - never when the page came with incoming data (ctx.start.incoming() true, a URL #hash or ?query unless start.url === false),
         inside a frame, or while printing.
     ctx.start = { tool (default ctx.cloud.tool), autosaveKey (the tool's autosave key, read only), hasAutosave() (optional, instead of
       autosaveKey), incoming() (optional), after / before (where the strip goes; default first in <body>), url (default true) }
     Storage (CLAUDE.md §5: new keys only, per tool; no existing key or format is touched; nothing is written while ctx.start is off):
       bridgeSuite.v1.projectsUI.<tool>.startDialog  '1' = "Show this when the app opens" (absent = off)
       bridgeSuite.v1.projectsUI.<tool>.start        { v:1, auto:{ at (ISO), h (hash of the autosave text it belongs to) },
                                                       recent:[{ n (name), t (ms) }] (Save / Open order, newest first, at most 30) } */
  function startChooser(ctx, b) {
    if (typeof document === 'undefined' || typeof window === 'undefined') return null;
    const so = ctx.start === true ? {} : (ctx.start || {});
    const tool = String(so.tool || (ctx.cloud && ctx.cloud.tool) || '');
    if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(tool)) return null;
    const S = ctx.storage, K = 'bridgeSuite.v1.projectsUI.' + tool, KD = K + '.startDialog', KS = K + '.start';
    const get = k => { try { return S ? S.getItem(k) : null; } catch (e) { return null; } };
    const put = (k, v) => { try { if (S) { if (v == null) S.removeItem(k); else S.setItem(k, v); } return true; } catch (e) { return false; } };
    const readS = () => { try { const v = JSON.parse(get(KS) || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } };
    const writeS = f => { const v = readS(); f(v); v.v = 1; put(KS, JSON.stringify(v)); };
    const hash = t => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8) + ':' + t.length; };
    const autoRaw = () => so.autosaveKey ? get(so.autosaveKey) : null;
    const raw0 = autoRaw(), hadAuto = so.hasAutosave ? !!so.hasAutosave() : !!raw0;
    const s0 = readS(), autoAt = raw0 && s0.auto && s0.auto.h === hash(raw0) ? s0.auto.at : null;
    /* the time of the autosave: noted when the tool rewrites its autosave (checked every 3 s and when the page is left) */
    let lastRaw = raw0;
    function stamp() { const r = autoRaw(); if (r == null || r === lastRaw) return; lastRaw = r; writeS(v => { v.auto = { at: new Date().toISOString(), h: hash(r) }; }); }
    if (so.autosaveKey) {
      setInterval(stamp, 3000); window.addEventListener('pagehide', stamp);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stamp(); });
    }
    const pref = () => get(KD) === '1';
    const setPref = v => put(KD, v ? '1' : null);
    function opened(n) { if (n) writeS(v => { const r = Array.isArray(v.recent) ? v.recent.filter(x => x && x.n !== n) : []; r.unshift({ n, t: Date.now() }); v.recent = r.slice(0, 30); }); close(); }
    function renamed(a, c) { const v0 = readS(); if (!Array.isArray(v0.recent) || !v0.recent.some(x => x && x.n === a)) return; writeS(v => { v.recent = v.recent.filter(x => x && x.n !== c).map(x => x.n === a ? { n: c, t: x.t } : x); }); if (strip) drawStrip(); }
    function deleted(n) { const v0 = readS(); if (Array.isArray(v0.recent) && v0.recent.some(x => x && x.n === n)) writeS(v => { v.recent = v.recent.filter(x => x && x.n !== n); }); if (strip) drawStrip(); }
    const ghOnly = () => { const e = b.eng(), cl = e ? e.cloud() : null; return cl ? [...cl.keys()].filter(n => !b.store.has(n)) : []; };
    /* up to max projects, most recently saved / opened first (the list's own saved time, else this file's note of Save / Open, else
       the list's order, last added first); then the GitHub-only ones (no time known) */
    function recent(max) {
      const rt = new Map(); (readS().recent || []).forEach(x => { if (x && typeof x.n === 'string' && !rt.has(x.n)) rt.set(x.n, +x.t || 0); });
      let ord = []; try { ord = Object.keys(b.store.read().map); } catch (e) { /* none */ }
      const tm = t => t == null ? -Infinity : typeof t === 'number' ? t : (Date.parse(t) || -Infinity);
      const rows = b.store.list().map(i => ({ name: i.name, local: true, t: Math.max(tm(i.saved), rt.has(i.name) ? rt.get(i.name) : -Infinity), o: ord.indexOf(i.name) }));
      rows.sort((x, y) => (y.t - x.t) || (y.o - x.o));
      ghOnly().sort((x, y) => x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' })).forEach(n => rows.push({ name: n, local: false }));
      return rows.slice(0, max);
    }
    let strip = null, closed = false, edited = false, why = null, auto = false;
    function close() { closed = true; if (strip) { strip.remove(); strip = null; } }
    function drawStrip() {
      if (closed) return;
      if (!strip) {
        strip = document.createElement('div'); strip.className = 'spStart'; strip.setAttribute('data-sp', 'start'); strip.setAttribute('role', 'region'); strip.setAttribute('aria-label', 'Recent projects');
        if (so.after && so.after.parentNode) so.after.after(strip); else if (so.before && so.before.parentNode) so.before.before(strip); else document.body.insertBefore(strip, document.body.firstChild);
        strip.addEventListener('click', onStrip);
      }
      const n = b.getCur(), saved = !!(n && b.store.has(n)), dn = ctx.displayName ? b.clean(ctx.displayName()) : '';
      const name = saved ? n : dn ? `${dn} (unsaved work)` : 'unsaved work', enc = x => encodeURIComponent(x);
      const rows = recent(hadAuto && saved && !b.dirty() ? 6 : 5).filter(r => !(hadAuto && saved && !b.dirty() && r.local && r.name === n)).slice(0, 5);   // the project Continue names is not listed again
      strip.innerHTML = '<span class="spStLbl">Recent projects</span>'
        + (hadAuto ? `<button type="button" class="spPri" data-st="continue" title="Keep working on the inputs that were on screen last time (this browser’s autosave)">Continue: <b>${esc(name)}</b></button>`
          + `<span class="spStNote">(${autoAt ? 'autosaved ' + esc(SP().etTime(autoAt)) : 'autosaved in this browser'})</span>` : '')
        + rows.map(r => `<button type="button" data-st="${r.local ? 'open' : 'ghopen'}" data-n="${enc(r.name)}" title="Open “${esc(r.name)}”${r.local ? '' : ' from GitHub (not in this browser yet)'}">${esc(r.name)}${r.local ? '' : ' <span class="spGhMini">GitHub only</span>'}</button>`).join('')
        + '<button type="button" data-st="all" title="The standard Saved projects dialog">All saved projects…</button>'
        + '<button type="button" class="spStX" data-st="close" title="Close" aria-label="Close the Recent projects strip">×</button>';
    }
    function onStrip(ev) {
      const t = ev.target.closest('[data-st]'); if (!t) return; const a = t.dataset.st, nm = decodeURIComponent(t.dataset.n || '');
      if (a === 'continue' || a === 'close') { close(); return; }
      if (a === 'all') { b.dialog.show(); return; }
      if (a === 'open') { if (!b.store.has(nm)) { drawStrip(); return; } b.openNamed(nm); return; }
      if (a === 'ghopen') {   // as the dialog's GitHub-only Open: download into this browser's list, then the same Open
        const e = b.eng(); if (!e) return; t.disabled = true;
        e.download(nm, false).then(r => { if (r && r.ok) { if (ctx.changed) ctx.changed(); b.openNamed(nm); b.dialog.refresh(); } else { t.disabled = false; alert((r && (r.message || r.error)) || 'The project could not be downloaded from GitHub.'); } }, () => { t.disabled = false; });
      }
    }
    const onEdit = ev => { if (!ev.isTrusted) return; const t = ev.target; if (t && t.closest && t.closest('[data-sp]')) return; edited = true; close(); };
    document.addEventListener('input', onEdit, true); document.addEventListener('change', onEdit, true);
    function suppressed() {
      try { if (so.incoming && so.incoming()) return 'incoming'; } catch (e) { return 'incoming'; }
      try { if (so.url !== false && (location.hash.length > 1 || location.search.length > 1)) return 'url'; } catch (e) { /* none */ }
      try { if (window.self !== window.top) return 'frame'; } catch (e) { return 'frame'; }
      try { if (window.matchMedia && window.matchMedia('print').matches) return 'print'; } catch (e) { /* none */ }
      return '';
    }
    function show() {   // the strip (autosave) or the dialog (no autosave); never after an edit
      if (edited || closed) return;
      if (hadAuto) { drawStrip(); return; }
      if (auto || document.querySelector('dialog[open]')) return; auto = true; b.dialog.show();
    }
    function decide() {
      why = suppressed(); if (why) return;
      /* the open project, found again by its content now that the tool has restored its inputs (the chip and "Continue: <name>") */
      if (!b.getCur()) { const s = b.snapshot(); if (s != null) { const hit = b.store.list().find(i => b.snapOf(i.name) === s); if (hit) { b.setCur(hit.name); b.refresh(); } } }
      if (pref()) { auto = true; b.dialog.show(); return; }
      const e = b.eng(), nLocal = b.store.list().length;
      if (nLocal) show();
      if (e && !auto) e.refreshCloud().then(() => { if (strip) drawStrip(); else if (!nLocal && ghOnly().length) show(); }, () => {});   // background; never waited for
    }
    const go = () => setTimeout(() => { try { decide(); } catch (e) { /* the page works without the chooser */ } }, 0);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    return { pref, setPref, opened, renamed, deleted, close, strip: () => strip, why: () => why, keys: { dialog: KD, state: KS } };
  }

  window.SharedProjectsUI = { libraryDialog, undoRedo, button, css, projectBar, download, bars };
})();
