/* shared/report-review.js — review tools of a Report tab built on shared/report.js (window.SharedReportReview). Classic script; no app
   code here. Moved 2026-11-23 from apps/steel-bridge/ui/rpreview.js (2026-11-19, PR #1646) so that Steel Bridge Design and Prestressed
   Bridge Design use one copy (CLAUDE.md §3); the code is that file's, its two storage keys and the title of the reviewed copy now given by
   the app. Works on the mounted report (.rp > .rp-bar, .rp-body > nav.rp-toc + article.rp-doc) and its print box; display and review
   only: nothing calculated, the report and the project unchanged.

   create({ key, tocKey, title }) -> the tools of one app: { attach(host, ctx), KEY, TOC_KEY, projKey, load, save, esc, reviewedCopy }
     key     localStorage key of the comments, prefixed per app (CLAUDE.md §5), e.g. 'sbd2.reportReview.v1', 'psb2.reportReview.v1':
             { <project key>: [{ id, where, quote, text, author, ts, status }] }; the project key is the project's number and name (or
             "untitled"), so each project has its own list. Nothing is written into the project file.
     tocKey  localStorage key of the contents sidebar per viewer ({ hidden, compact, w }); tocKey + '.author' keeps the last author name.
     title   the app's name, for the title of the reviewed copy where the project has no name.
   Each app keeps its own state (markup mode on / off, "Print comments appendix"), so two apps never share comments or settings.

   1. Contents sidebar: a strip at the top of the contents (nav.rp-toc) with "Hide contents" (the report takes the full width; "Show contents"
      in the bar brings it back), "Sections only" / "All entries" (the contents collapsed to the section headings, or every entry) and a drag
      handle at its right edge that resizes it (160 to 520 px). Not printed (shared/report.js hides the contents in print; the strip and the
      handle are hidden too).
   2. Markup mode ("Markup" in the bar): a click on a report item (a worked step, a table, a note, a heading: the nearest element with an id,
      or its subsection) or a text selection then "Comment on selection" opens a form (author, comment); the comment is anchored to that
      item (its id and subsection title; the selected text quoted, up to 300 characters). A numbered marker is shown at the item. The
      comments panel lists them (open / resolved, author, time; Resolve / Reopen, Delete, Go to). Every text is HTML-escaped (esc), never
      inserted as markup.
   3. "Save reviewed copy": downloads one standalone HTML file of the report (its own styles inline; KaTeX's stylesheet from its pinned CDN
      for the equations' fonts) with the comments numbered in place and listed in an appendix. Made in the page (Blob, a[download]): works
      from file://, no fetch.
   4. Print: the markup UI (markers, panel, strip, handle) is hidden; "Print comments appendix" (checkbox in the panel) adds the comments
      as an appendix to the printed report (shared/report.js print box, #rp-print, filled on beforeprint; without that box, e.g. Ctrl+P on
      the tab, the appendix is put at the end of the report on screen for the print and removed after it).
   API of the tools: attach(host, ctx) after SharedReport.mount (the app's ui/report.js render; ctx.P = the project); KEY, TOC_KEY,
   projKey(P), load(P), save(P, list), esc, reviewedCopy(root, P). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = { get: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } } };
  const projKey = P => { const p = (P && P.project) || {}; const k = [p.number, p.name].map(v => String(v || '').trim()).filter(Boolean).join(' | '); return k || 'untitled'; };
  const CSS = `
.sbr-strip{display:flex;gap:4px;flex-wrap:wrap;padding:2px 6px 6px;border-bottom:1px solid #E4E7EB;margin-bottom:4px;position:sticky;top:0;background:#fff;z-index:1}
.sbr-strip button,.sbr-bar button{font-size:8.5pt;padding:2px 6px}
.rp-body.sbr-hide{grid-template-columns:minmax(0,1fr)!important}.rp-body.sbr-hide>.rp-toc,.rp-body.sbr-hide>.sbr-grip{display:none}
.rp-toc.sbr-compact a.rp-l2,.rp-toc.sbr-compact a.rp-l3,.rp-toc.sbr-compact a.rp-l4{display:none}
.rp-body{position:relative}.sbr-grip{position:absolute;top:0;bottom:0;width:8px;cursor:col-resize;z-index:2}.sbr-grip:hover,.sbr-grip.on{background:rgba(37,99,235,.18)}
.sbr-on .rp-doc [id]:hover{outline:1px dashed #2563EB;cursor:copy}
.sbr-mk{display:inline-block;min-width:16px;padding:0 4px;margin:0 2px;border:1px solid #000;border-radius:8px;font:700 8pt Arial,sans-serif;background:#FFF7D6;color:#000;cursor:pointer;vertical-align:super}
.sbr-mk.res{background:#ECFDF5;text-decoration:line-through}
.sbr-panel{border:1px solid #E4E7EB;border-radius:8px;padding:8px;margin:8px 0;background:#fff;font:9.5pt -apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.sbr-panel ol{margin:4px 0 0 18px;padding:0}.sbr-panel li{margin:4px 0}.sbr-panel .sbr-meta{color:#475569;font-size:8.5pt}
.sbr-panel .sbr-res{color:#475569;text-decoration:line-through}
.sbr-form{border:1px solid #2563EB;border-radius:8px;padding:8px;margin:6px 0;background:#F8FAFC}
.sbr-form textarea{width:100%;min-height:60px;box-sizing:border-box}.sbr-form input{max-width:100%}
.sbr-apx{break-before:page;font:10pt "Times New Roman",Times,serif}
@media print{.sbr-strip,.sbr-grip,.sbr-mk,.sbr-panel,.sbr-form,.sbr-bar{display:none!important}}`;
  function css() { if (document.getElementById('sbr-css')) return; const st = document.createElement('style'); st.id = 'sbr-css'; st.textContent = CSS; document.head.appendChild(st); }
  // the nearest element with an id (a step, a heading, a table with an anchor), else the heading of the subsection (a note, a table cell)
  const anchorOf = el => { if (!el || !el.closest || !el.closest('.rp-doc')) return null; const sub0 = el.closest('.rp-sub,.rp-sec'), a = el.closest('.rp-doc [id]') || (sub0 && sub0.querySelector('.rp-h2[id],.rp-h1[id]'));
    if (!a) return null; const sub = a.closest('.rp-sub,.rp-sec'), h = sub && sub.querySelector('.rp-h2,.rp-h1');
    return { id: a.id, where: h ? h.textContent.trim().slice(0, 160) : '' }; };
  const fmtT = t => { try { return new Date(t).toLocaleString(); } catch (e) { return String(t); } };

  const CSS_ESC = s => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&'));

  /* create(cfg): the tools of one app (its keys, its own state) */
  function create(cfg) {
  const KEY = String(cfg.key), TOC_KEY = String(cfg.tocKey), TITLE = String(cfg.title || 'Report');
  if (!/^[a-z0-9]+\.\w/.test(KEY) || !/^[a-z0-9]+\.\w/.test(TOC_KEY)) throw new Error('SharedReportReview.create: key and tocKey must be prefixed per app (CLAUDE.md §5)');
  const load = P => { const all = ls.get(KEY) || {}, L = all[projKey(P)]; return Array.isArray(L) ? L.filter(c => c && typeof c === 'object') : []; };
  const save = (P, list) => { const all = ls.get(KEY) || {}; all[projKey(P)] = list; return ls.set(KEY, all); };
  const S = { mark: false, print: false, ctx: null, root: null };
  /* ---------- 1. contents sidebar ---------- */
  function sidebar(root) {
    const body = root.querySelector('.rp-body'), nav = root.querySelector('.rp-toc'); if (!body || !nav) return;
    const st = Object.assign({ hidden: false, compact: false, w: 230 }, ls.get(TOC_KEY) || {}), keep = () => ls.set(TOC_KEY, st);
    const apply = () => { body.classList.toggle('sbr-hide', !!st.hidden); nav.classList.toggle('sbr-compact', !!st.compact);
      if (!st.hidden && innerWidth > 1000) body.style.gridTemplateColumns = `${Math.max(160, Math.min(520, +st.w || 230))}px minmax(0,1fr)`; else body.style.gridTemplateColumns = '';
      grip.style.left = (nav.offsetWidth + 4) + 'px'; const sb = root.querySelector('[data-sbr="show"]'); if (sb) sb.hidden = !st.hidden;
      const cb = nav.querySelector('[data-sbr="compact"]'); if (cb) cb.textContent = st.compact ? 'All entries' : 'Sections only'; };
    nav.insertAdjacentHTML('afterbegin', `<div class="sbr-strip"><button type="button" data-sbr="hide" title="Hide the contents">Hide contents</button><button type="button" data-sbr="compact"></button></div>`);
    const grip = document.createElement('div'); grip.className = 'sbr-grip'; grip.title = 'Drag to resize the contents'; grip.setAttribute('role', 'separator'); grip.setAttribute('aria-orientation', 'vertical'); body.appendChild(grip);
    root.querySelector('.rp-bar').insertAdjacentHTML('afterbegin', `<span class="sbr-bar"><button type="button" data-sbr="show" hidden>Show contents</button></span>`);
    root.addEventListener('click', e => { const b = e.target.closest('[data-sbr]'); if (!b) return; const a = b.dataset.sbr;
      if (a === 'hide') { st.hidden = true; } else if (a === 'show') { st.hidden = false; } else if (a === 'compact') { st.compact = !st.compact; } else return; keep(); apply(); });
    grip.addEventListener('pointerdown', e => { e.preventDefault(); grip.classList.add('on'); const x0 = e.clientX, w0 = nav.offsetWidth;
      const mv = ev => { st.w = Math.max(160, Math.min(520, w0 + ev.clientX - x0)); apply(); }, up = () => { grip.classList.remove('on'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); keep(); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); });
    apply();
  }

  /* ---------- 2. markup mode and the comments panel ---------- */
  function marks(root, P) {
    root.querySelectorAll('.sbr-mk').forEach(m => m.remove());
    load(P).forEach((c, i) => { const el = root.querySelector('.rp-doc #' + CSS_ESC(c.id)); if (!el) return;
      el.insertAdjacentHTML('afterbegin', `<span class="sbr-mk${c.status === 'resolved' ? ' res' : ''}" data-sbrgo="${i}" title="${esc(c.text)}">${i + 1}</span>`); });
  }
  function panel(root, P) {
    let box = root.querySelector('.sbr-panel'); if (!box) { box = document.createElement('div'); box.className = 'sbr-panel'; root.querySelector('.rp-bar').after(box); }
    const L = load(P), nO = L.filter(c => c.status !== 'resolved').length;
    box.hidden = !S.mark && !L.length;
    box.innerHTML = `<b>Review comments</b> (${L.length}: ${nO} open, ${L.length - nO} resolved; project "${esc(projKey(P))}", saved in this browser)
      ${S.mark ? '<div class="sbr-meta">Markup mode: click a step, table, note or heading of the report to comment on it, or select text and use "Comment on selection".</div>' : ''}
      <div><button type="button" data-sbrc="sel"${S.mark ? '' : ' hidden'}>Comment on selection</button> <button type="button" data-sbrc="save">Save reviewed copy</button>
      <label><input type="checkbox" data-sbrc="print"${S.print ? ' checked' : ''}> Print comments appendix</label></div>
      ${L.length ? `<ol>${L.map((c, i) => `<li class="${c.status === 'resolved' ? 'sbr-res' : ''}"><span class="sbr-meta">${esc(c.author || 'anonymous')}, ${esc(fmtT(c.ts))}, ${c.status === 'resolved' ? 'resolved' : 'open'}; ${esc(c.where || c.id)}</span><br>${c.quote ? `“${esc(c.quote)}” ` : ''}${esc(c.text)}
        <br><button type="button" data-sbrc="go" data-i="${i}">Go to</button> <button type="button" data-sbrc="tog" data-i="${i}">${c.status === 'resolved' ? 'Reopen' : 'Resolve'}</button> <button type="button" data-sbrc="del" data-i="${i}">Delete</button></li>`).join('')}</ol>` : ''}`;
  }
  function form(root, P, a, quote) {
    root.querySelectorAll('.sbr-form').forEach(f => f.remove());
    const el = root.querySelector('.rp-doc #' + CSS_ESC(a.id)); if (!el) return;
    const f = document.createElement('div'); f.className = 'sbr-form';
    f.innerHTML = `<div class="sbr-meta">Comment on: ${esc(a.where || a.id)}${quote ? ` — “${esc(quote)}”` : ''}</div><label>Author <input type="text" class="sbr-au" maxlength="80"></label>
      <textarea class="sbr-tx" maxlength="4000" aria-label="Comment"></textarea><button type="button" class="primary" data-sbrf="ok">Add comment</button> <button type="button" data-sbrf="no">Cancel</button>`;
    el.after(f); const au = f.querySelector('.sbr-au'); au.value = (ls.get(TOC_KEY + '.author') || ''); f.querySelector('.sbr-tx').focus();
    f.addEventListener('click', e => { const b = e.target.closest('[data-sbrf]'); if (!b) return; e.stopPropagation();
      if (b.dataset.sbrf === 'ok') { const tx = f.querySelector('.sbr-tx').value.trim(); if (!tx) return; const L = load(P);
        L.push({ id: a.id, where: a.where, quote: quote ? quote.slice(0, 300) : '', text: tx, author: au.value.trim().slice(0, 80), ts: new Date().toISOString(), status: 'open' });
        save(P, L); ls.set(TOC_KEY + '.author', au.value.trim().slice(0, 80)); }
      f.remove(); refresh(root, P); });
  }
  function refresh(root, P) { marks(root, P); panel(root, P); }
  /* the report as one HTML file: the styles of the page's report (shared/report.js CSS), KaTeX's pinned stylesheet, the document with the markers, the appendix */
  function appendix(P) { const L = load(P); return L.length ? `<section class="sbr-apx"><h2>Review comments</h2><ol>${L.map((c, i) => `<li><b>[${i + 1}]</b> ${esc(c.where || c.id)} — ${esc(c.author || 'anonymous')}, ${esc(fmtT(c.ts))}, ${c.status === 'resolved' ? 'resolved' : 'open'}<br>${c.quote ? `“${esc(c.quote)}” ` : ''}${esc(c.text)}</li>`).join('')}</ol></section>` : ''; }
  function reviewedCopy(root, P) {
    const art = root.querySelector('.rp-doc'); if (!art) return null;
    const cl = art.cloneNode(true); cl.querySelectorAll('.sbr-form').forEach(x => x.remove()); cl.querySelectorAll('details').forEach(d => d.setAttribute('open', ''));
    cl.querySelectorAll('.sbr-mk').forEach(m => { m.removeAttribute('data-sbrgo'); });
    const rpCss = (document.getElementById('rp-css') || {}).textContent || '', kx = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href).filter(h => /katex/.test(h));
    const title = `${(P.project && P.project.name) || TITLE}: calculation report (reviewed copy)`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>${kx.map(h => `<link rel="stylesheet" href="${esc(h)}">`).join('')}
<style>${rpCss}${CSS.replace(/@media print\{[^}]*\}\}?/, '')} body{background:#fff;margin:16px;font-family:"Times New Roman",Times,serif} .rp-doc{margin:0 auto}</style></head>
<body><p class="sbr-meta">Reviewed copy saved ${esc(new Date().toLocaleString())}; ${load(P).length} comment(s), numbered in place and listed at the end.</p><div class="rp">${cl.outerHTML}</div>${appendix(P)}</body></html>`;
  }
  function download(root, P) {
    const h = reviewedCopy(root, P); if (!h) return;
    const a = document.createElement('a'), b = new Blob([h], { type: 'text/html' }), nm = (projKey(P).replace(/[^\w.-]+/g, '_') || 'report') + '_reviewed.html';
    a.href = URL.createObjectURL(b); a.download = nm; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function attach(host, ctx) {
    const root = host.querySelector('.rp'); if (!root || !root.querySelector('.rp-doc')) return;
    css(); S.ctx = ctx; S.root = root; const P = ctx.P;
    sidebar(root);
    root.querySelector('.rp-bar').insertAdjacentHTML('beforeend', `<span class="sbr-bar"><button type="button" data-sbrm="1" aria-pressed="${S.mark}">${S.mark ? 'Markup: on' : 'Markup'}</button></span>`);
    root.classList.toggle('sbr-on', S.mark);
    root.addEventListener('click', e => {
      const m = e.target.closest('[data-sbrm]'); if (m) { S.mark = !S.mark; m.textContent = S.mark ? 'Markup: on' : 'Markup'; m.setAttribute('aria-pressed', S.mark); root.classList.toggle('sbr-on', S.mark); panel(root, P); return; }
      const g = e.target.closest('[data-sbrgo]'); if (g) { e.preventDefault(); e.stopPropagation(); const c = load(P)[+g.dataset.sbrgo]; if (c) alert(`${c.author || 'anonymous'}, ${fmtT(c.ts)}${c.quote ? `\n“${c.quote}”` : ''}\n${c.text}`); return; }
      const b = e.target.closest('[data-sbrc]'); if (b) { const a = b.dataset.sbrc, i = +b.dataset.i, L = load(P);
        if (a === 'save') download(root, P);
        else if (a === 'sel') { const s = getSelection(), t = s && String(s).trim(); const n0 = s && s.rangeCount ? s.getRangeAt(0).startContainer : null, an = n0 ? anchorOf(n0.nodeType === 1 ? n0 : n0.parentElement) : null; if (an && t) form(root, P, an, t); else alert('Select some text of the report first.'); }
        else if (a === 'go') { const el = root.querySelector('.rp-doc #' + CSS_ESC(L[i].id)); if (el) { let p = el.closest('.rp-closed'); while (p) { p.classList.remove('rp-closed'); p = p.parentElement && p.parentElement.closest('.rp-closed'); } el.scrollIntoView({ block: 'center' }); } else alert('That item is not in this report (the report changed since the comment).'); }
        else if (a === 'tog') { L[i].status = L[i].status === 'resolved' ? 'open' : 'resolved'; save(P, L); refresh(root, P); }
        else if (a === 'del') { if (confirm('Delete this comment?')) { L.splice(i, 1); save(P, L); refresh(root, P); } }
        return; }
      if (!S.mark || e.target.closest('.sbr-form,.sbr-panel,a,button,input,textarea,select,summary')) return;
      const sel = getSelection(); if (sel && String(sel).trim()) return;   // a selection: "Comment on selection"
      const an = anchorOf(e.target); if (an && e.target.closest('.rp-doc')) { e.preventDefault(); e.stopPropagation(); form(root, P, an, ''); }
    }, true);
    root.addEventListener('change', e => { if (e.target.matches('[data-sbrc="print"]')) S.print = e.target.checked; });
    refresh(root, P);
  }
  /* print: the comments appendix in the print box when chosen (shared/report.js fills #rp-print, then window.print → beforeprint) */
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('beforeprint', () => {
    if (!S.print || !S.ctx || !S.root || !S.root.isConnected) return; const box = document.getElementById('rp-print'), tgt = box && box.querySelector('.rp-doc') ? box.querySelector('.rp-doc') : S.root.querySelector('.rp-doc');
    if (!tgt || tgt.querySelector('.sbr-apx')) return; tgt.insertAdjacentHTML('beforeend', appendix(S.ctx.P).replace('class="sbr-apx"', 'class="sbr-apx" data-sbrtmp="1"'));
  });
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('afterprint', () => { document.querySelectorAll('[data-sbrtmp]').forEach(x => x.remove()); });

  return { attach, KEY, TOC_KEY, projKey, load, save, esc, reviewedCopy };
  }

  window.SharedReportReview = { create, esc, projKey };
})();
