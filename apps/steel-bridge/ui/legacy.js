/* apps/steel-bridge/ui/legacy.js — the import summary of an old Steel Bridge Design project (window.SBDLegacyUI), from engine/legacy.js.
   Classic script. show(summary, opt): a panel over the page listing what was imported, the notes, and every field that could not be
   mapped (kept in the project under legacy.unmapped; nothing is dropped). opt.onClose: called when the panel is closed.
   hasOld(storage): true when the old app's autosaves are in this browser (read only). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function hasOld(storage) { try { return Object.values(window.SBDLegacy.OLD_KEYS).some(k => storage && storage.getItem(k) != null); } catch (e) { return false; } }
  function show(S, opt) {
    opt = opt || {};
    const old = document.getElementById('lgSum'); if (old) old.remove();
    const d = document.createElement('div'); d.id = 'lgSum'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Import summary');
    d.style.cssText = 'position:fixed;inset:6% 8% auto 8%;max-height:84vh;overflow:auto;z-index:50;background:#fff;border:2px solid #1E3A5F;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.25);padding:14px 18px;font-family:var(--font-ui);font-size:9.5pt;';
    const byPart = {}; S.unmapped.forEach(u => (byPart[u.label] = byPart[u.label] || []).push(u));
    d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><b style="font-size:11pt">Import summary</b><button type="button" id="lgClose">Close</button></div>
      <p>Imported from ${esc(S.source)}: ${S.parts.map(q => `${esc(q.label)} (${q.mapped} fields mapped)`).join('; ')}. Check the inputs on each tab, then Calculate.</p>
      ${S.notes.length ? `<p><b>Notes</b></p><ul>${S.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      ${S.unmapped.length ? `<p><b>Not mapped</b>: kept in the project file under <code>legacy.unmapped</code> (nothing was dropped; Export JSON keeps it).</p>
        ${Object.entries(byPart).map(([p, L]) => `<p style="margin:6px 0 2px">${esc(p)}</p><table class="tbl"><tbody>${L.map(u => `<tr><td class="lft" style="width:22%"><code>${esc(u.field)}</code></td><td class="lft">${esc(u.what)}</td></tr>`).join('')}</tbody></table>`).join('')}` : '<p>Every field was mapped.</p>'}`;
    document.body.appendChild(d);
    d.querySelector('#lgClose').addEventListener('click', () => { d.remove(); if (opt.onClose) opt.onClose(); });
    return d;
  }
  window.SBDLegacyUI = { show, hasOld };
})();
