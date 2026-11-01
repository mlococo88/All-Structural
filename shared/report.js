/* shared/report.js — calculation report viewer (window.SharedReport). Classic script.
   Created 2026-10-30 (docs/REBUILD_PLAN.md §3, §6 Phase 2): the Gusset Plate Rating style calc-sheet report (in-app Report tab with a
   navigation tree, collapse / expand, search, print with a running header and page numbers) as one shared viewer, so each app supplies
   only a report model. Look and behaviour follow "Gusset Plate Rating.html" (crv-*, cr-*) and BasePlateAnchorDesigner.html (RPT-2/3);
   the code is new. No app-specific code here. Needs window.SharedSteps (shared/steps.js) at call time: every worked step is rendered by
   SharedSteps (KaTeX when the page has loaded it, the built-in renderer otherwise), the same strings as on the app's own tabs.

   Report model (plain data; the app builds it):
     { title, subtitle, code,                       cover lines ('Steel Bridge Design', 'Girder G1', 'AASHTO LRFD 10th Ed. (2024)')
       info: [[label, value], …],                   title block (project, number, computed / checked by, dates), three per row
       head: { left, right, foot },                 running header / footer text in print (strings; optional)
       sections: [ { id, title, note?, part?, subs: [ { id, title, items: [item, …] } ] } ] }
   part (2026-11-01, optional): a chapter heading shown before that section (screen, nav tree, contents, print, text), for a
   report that joins the reports of several tabs (Concrete Beam Capacity.html: one chapter per tab). Section numbers run on
   through the chapters. A model without part renders exactly as before.
   Items:
     { type: 'steps', scope, steps: [step…], title?, lazy? }   worked steps (shared/steps.js format). Each step's anchor key is
                                                             scope + '/' + step.id (step.id alone when scope is ''); the first
                                                             occurrence of a key is its derivation. lazy: rendered when opened
                                                             (<details>), so a report of every station stays fast; print fills them.
                                                             topics? (2026-10-31, presentation spec A): [{ title, ref, n, cls, chip, res }]
                                                             in step order (n steps each; res: the topic's result step, SharedSteps.group):
                                                             a sub-heading with the one-line result before each topic's steps (screen,
                                                             print, text), and, for an item that is not lazy, nav-tree entries down to
                                                             the topics.
     { type: 'table', caption?, head: [cell…], rows: [[cell…] | { cells, cls }], wide? }
     { type: 'figure', svg, caption? }                       an SVG string (made by the app)
     { type: 'note', text, warn? }
     { type: 'kv', rows: [[label, value, key?], …] }          key: a § link to that derivation
   Text everywhere (titles, notes, cells): plain text, with $…$ for equation notation (SharedSteps.toHTML / toText) and
   [[key]] for a cross-reference to a step ("§x.y", a link in the app, "§x.y" in print), [[tab:name|text]] for an in-app link to
   the app's tab (opt.onGoto; plain text in print). A cell is a string, or { t, key, cls: 'ok' | 'hi' | 'ng' | 'na', n: true }
   (key adds a § link; n right-aligns).

   API:
     build(model)               -> doc: numbering (§n, §n.m), the anchor index, refs, unresolved refs, duplicate keys
     html(doc, { lazy })        -> the document HTML (title block, cover, contents, sections); lazy=false fills every lazy item
     text(doc)                  -> plain text of the whole report (tests: NaN / undefined scan, "see §" check)
     mount(host, model, opt)    -> the viewer in host: bar (opt.controls HTML + search, Expand all, Collapse all, Print), nav tree, doc.
                                   opt.onGoto(name) for [[tab:…]] links; opt.stick: the height of the host page's own sticky header
                                   above the viewer (the bar sticks below it); opt.closed (a Set of closed heading ids, kept between mounts).
                                   Returns { doc, print(), jump(key) }.
     print(doc)                 -> prints the whole report (every section open, lazy items filled), alone on the page
     ref(doc, key)              -> '§x.y' or null
     css()                      -> injects the viewer's styles (mount and print do it themselves)
   Styles: injected once (style#rp-css), class prefix rp-. */
(function () {
  'use strict';
  const ST = () => window.SharedSteps;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const keyOf = (scope, id) => (scope ? scope + '/' + id : String(id));

  /* ---------- numbering and the anchor index ---------- */
  function build(model) {
    const doc = { model, toc: [], index: new Map(), lazy: [], refs: [], unresolved: [], dup: [] };
    let nSt = 0;
    (model.sections || []).forEach((s, i) => {
      const n = i + 1, sec = { n: String(n), id: 'rp-s' + n, title: s.title, subs: [] };
      if (s.part) sec.part = { title: s.part, id: 'rp-p' + n };
      doc.toc.push(sec);
      (s.subs || []).forEach((q, j) => {
        const num = `${n}.${j + 1}`, sub = { n: num, id: `rp-s${n}-${j + 1}`, title: q.title };
        sec.subs.push(sub);
        (q.items || []).forEach(it => {
          if (it.type !== 'steps') return;
          if (it.lazy) { it._lz = doc.lazy.length; doc.lazy.push(it); }
          it._anc = (it.steps || []).map(st => {
            const k = keyOf(it.scope, st.id), a = 'rp-st' + (++nSt);
            if (doc.index.has(k)) { doc.dup.push(k); return a; }
            doc.index.set(k, { n: num, anchor: a, sub: sub.id, lz: it.lazy ? it._lz : null });
            return a;
          });
          if (it.topics && it.topics.length && !it.lazy) { let j0 = 0; const tops = it.topics.map(t => { const q = { title: t.title, anchor: it._anc[j0] }; j0 += t.n; return q; });   // nav: the item, then its topics
            (sub.items || (sub.items = [])).push({ title: it.title || 'Worked steps', anchor: it._anc[0], tops }); }
        });
      });
    });
    // every cross-reference in the model, resolved or not (text() and html() use the same scan)
    const scan = (t, where) => { String(t == null ? '' : t).replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (m, k) => { if (!k.startsWith('tab:')) note(k, where); return m; }); };
    const note = (k, where) => { doc.refs.push({ key: k, where }); if (!doc.index.has(k)) doc.unresolved.push({ key: k, where }); };
    const cell = (c, where) => { if (c && typeof c === 'object') { scan(c.t, where); if (c.key) note(c.key, where); } else scan(c, where); };
    (model.sections || []).forEach((s, i) => {
      scan(s.title, `§${i + 1}`); scan(s.note, `§${i + 1}`);
      (s.subs || []).forEach((q, j) => {
        const w = `§${i + 1}.${j + 1} ${q.title}`; scan(q.title, w);
        (q.items || []).forEach(it => {
          if (it.type === 'note') scan(it.text, w);
          else if (it.type === 'figure') scan(it.caption, w);
          else if (it.type === 'kv') (it.rows || []).forEach(r => { scan(r[0], w); scan(r[1], w); if (r[2]) note(r[2], w); });
          else if (it.type === 'table') { scan(it.caption, w); (it.head || []).forEach(c => cell(c, w)); (it.rows || []).forEach(r => (Array.isArray(r) ? r : r.cells).forEach(c => cell(c, w))); }
          else if (it.type === 'steps') { scan(it.title, w); (it.steps || []).forEach(st => String(st.note || '').replace(SEE, (m, id) => { note(seeKey(doc, it, id), w); return m; })); }
        });
      });
    });
    return doc;
  }
  /* a step note may name another step as "§<step id>" (engine/shear.js "See §pan.Vn.", engine/rating.js "see §fx.Mn"): it becomes a
     cross-reference to that step in item.see (the scope that holds the other work, when given) or else in the item's own scope */
  const SEE = /§([A-Za-z](?:[\w.]*\w)?)/g;
  const seeKey = (doc, it, id) => {
    const a = it.see ? keyOf(it.see, id) : null; if (a && doc.index.has(a)) return a;
    if (doc.index.has(keyOf(it.scope, id))) return keyOf(it.scope, id);
    const m = (it.steps || []).find(t => String(t.id).endsWith('.' + id));   // an id relative to the engine's work prefix ('v.Vn' of 'pn.v.Vn')
    return keyOf(it.scope, m ? m.id : id);
  };
  const noteOf = (doc, it, t, html) => { const ps = String(t).split(SEE);   // a note that already says "See §x" does not get the "see " of .rp-see in front a second time (class rp-seen)
    return ps.map((p, i) => i % 2 ? (a => html && /\bsee\s*$/i.test(ps[i - 1]) ? a.replace('class="rp-see"', 'class="rp-see rp-seen"') : a)(rich(doc, `[[${seeKey(doc, it, p)}]]`, html)) : html ? esc(p) : p).join(''); };
  const ref = (doc, key) => { const e = doc.index.get(key); return e ? '§' + e.n : null; };

  /* ---------- rich text: $tex$, [[key]], [[tab:name|text]] ----------
     Notation in running text, titles and table cells is set by SharedSteps' built-in renderer (subscripts, Greek, fractions in the
     text font), not KaTeX: a report of every station has thousands of cells, and KaTeX markup there made it slow and large. The worked
     steps themselves are set by KaTeX when the page has it. Cached by string. */
  const LITE = new Map();
  const lite = t => { let h = LITE.get(t); if (h != null) return h; const w = typeof window !== 'undefined' ? window : null, K = w && w.katex;
    try { if (K) w.katex = undefined; h = ST().toHTML(t); } finally { if (K) w.katex = K; } if (LITE.size < 20000) LITE.set(t, h); return h; };
  function rich(doc, s, html) {
    const parts = String(s == null ? '' : s).split(/(\[\[[^\]]+\]\]|\$[^$]+\$)/);
    return parts.map(p => {
      if (!p) return '';
      if (p.startsWith('[[') && p.endsWith(']]')) {
        const [k, lab] = p.slice(2, -2).split('|');
        if (k.startsWith('tab:')) return html ? `<a href="#" class="rp-go" data-rpgoto="${esc(k.slice(4))}">${esc(lab || k.slice(4))}</a>` : (lab || k.slice(4));
        const e = doc.index.get(k), t = e ? '§' + e.n : '§?';
        return html ? (e ? `<a href="#${e.anchor}" class="rp-see" data-rpjump="${esc(k)}">${t}</a>` : `<span class="rp-bad" title="${esc(k)}">${t}</span>`) : t;
      }
      if (p.length > 2 && p[0] === '$' && p[p.length - 1] === '$') return html ? lite(p.slice(1, -1)) : ST().toText(p.slice(1, -1));
      return html ? esc(p) : p;
    }).join('');
  }

  /* ---------- HTML ---------- */
  const stepVal = s => {   // the result column: value and unit (and OK / NG of a test step), through SharedSteps
    const v = typeof s.value === 'number' || (s.value != null && s.value !== '') ? ST().line({ value: s.value, unit: s.unit, d: s.d }, true) : '';
    return v + (s.ok === true ? ' <span class="rp-okt">OK</span>' : s.ok === false ? ' <span class="rp-ngt">NG</span>' : '');
  };
  /* the sub-heading of a topic (item.topics): number, title, reference, one-line result, status */
  const topHtml = (t, k) => `<div class="rp-top${t.cls ? ' rp-top-' + t.cls : ''}"><span class="rp-tn">${k + 1}.</span> <span class="rp-tt">${esc(t.title)}</span>${t.ref ? ` <span class="rp-ref">${esc(t.ref)}</span>` : ''}${t.chip ? ` <span class="rp-tchip">${esc(t.chip)}</span>` : ''}${t.res ? `<div class="rp-tsum">${ST().summary(t, true)}</div>` : ''}</div>`;
  const topAt = it => { const m = new Map(); let j = 0; (it.topics || []).forEach((t, k) => { m.set(j, topHtml(t, k)); j += t.n; }); return m; };
  function stepsHtml(doc, it) {
    const T = topAt(it);
    return (it.steps || []).map((s, i) => `${T.get(i) || ''}<div class="rp-step${s.ok === false ? ' rp-ng' : ''}" id="${it._anc[i]}"><div class="rp-d">${esc(s.label)}${s.ref ? `<span class="rp-ref">${esc(s.ref)}</span>` : ''}</div>
      <div class="rp-m">${ST().line({ ...s, value: null, unit: '' }, true)}</div><div class="rp-r">${stepVal(s)}</div>${s.note ? `<div class="rp-nt">${noteOf(doc, it, s.note, true)}</div>` : ''}</div>`).join('');
  }
  function cellHtml(doc, c, th) {
    const o = c && typeof c === 'object' ? c : { t: c }, tag = th ? 'th' : 'td', cl = [o.cls ? 'rp-' + o.cls : '', o.n ? 'rp-n' : ''].filter(Boolean).join(' ');
    const lk = o.key ? ' ' + rich(doc, `[[${o.key}]]`, true) : '';
    return `<${tag}${cl ? ` class="${cl}"` : ''}${o.span ? ` colspan="${o.span}"` : ''}>${rich(doc, o.t, true)}${lk}</${tag}>`;
  }
  function itemHtml(doc, it, lazy) {
    if (it.type === 'steps') {
      const body = () => `<div class="rp-steps">${stepsHtml(doc, it)}</div>`;   // not made for a lazy item until it is opened
      if (it.lazy) return `<details class="rp-lz" data-rplz="${it._lz}"${lazy ? '' : ' open data-filled="1"'}><summary>${rich(doc, it.title || 'Worked steps', true)} <span class="rp-cnt">(${(it.steps || []).length} steps)</span></summary>${lazy ? '' : body()}</details>`;
      return (it.title ? `<h4 class="rp-h3">${rich(doc, it.title, true)}</h4>` : '') + body();
    }
    if (it.type === 'table') return `${it.caption ? `<p class="rp-cap">${rich(doc, it.caption, true)}</p>` : ''}<div class="rp-tw"><table class="rp-tbl${it.wide ? ' rp-wide' : ''}"><thead><tr>${(it.head || []).map(c => cellHtml(doc, c, true)).join('')}</tr></thead><tbody>
      ${(it.rows || []).map(r => { const cells = Array.isArray(r) ? r : r.cells, cl = Array.isArray(r) ? '' : r.cls; return `<tr${cl ? ` class="rp-${cl}"` : ''}>${cells.map(c => cellHtml(doc, c, false)).join('')}</tr>`; }).join('')}</tbody></table></div>`;
    if (it.type === 'figure') return `<figure class="rp-fig">${it.svg || ''}${it.caption ? `<figcaption>${rich(doc, it.caption, true)}</figcaption>` : ''}</figure>`;
    if (it.type === 'note') return `<p class="rp-note${it.warn ? ' rp-warn' : ''}">${rich(doc, it.text, true)}</p>`;
    if (it.type === 'kv') return `<table class="rp-kv">${(it.rows || []).map(r => `<tr><td>${rich(doc, r[0], true)}</td><td>${rich(doc, r[1], true)}${r[2] ? ' ' + rich(doc, `[[${r[2]}]]`, true) : ''}</td></tr>`).join('')}</table>`;
    return '';
  }
  function titleBlock(doc) {
    const m = doc.model, I = m.info || [], rows = [];
    for (let i = 0; i < I.length; i += 3) rows.push(I.slice(i, i + 3));
    return `<table class="rp-tb">${rows.map(r => `<tr>${r.map(([l, v]) => `<td><span>${esc(l)}</span>${esc(v == null || v === '' ? '—' : v)}</td>`).join('')}</tr>`).join('')}</table>
      <section class="rp-cover"><h1>${esc(m.title || 'Calculation report')}</h1>${m.subtitle ? `<p>${esc(m.subtitle)}</p>` : ''}${m.code ? `<p class="rp-cp">${esc(m.code)}</p>` : ''}</section>
      <section class="rp-ptoc"><h2 class="rp-h1x">Contents</h2><ol>${doc.toc.map(s => `${s.part ? `<li class="rp-tp">${esc(s.part.title)}</li>` : ''}<li>${s.n}. ${esc(s.title)}${s.subs.length ? `<ol>${s.subs.map(q => `<li>${q.n} ${rich(doc, q.title, true)}</li>`).join('')}</ol>` : ''}</li>`).join('')}</ol></section>`;
  }
  function html(doc, opt) {
    const lazy = !opt || opt.lazy !== false, closed = (opt && opt.closed) || new Set();
    return titleBlock(doc) + (doc.model.sections || []).map((s, i) => { const T = doc.toc[i];
      return `${T.part ? `<h1 class="rp-part" id="${T.part.id}">${esc(T.part.title)}</h1>` : ''}<section class="rp-sec${closed.has(T.id) ? ' rp-closed' : ''}" data-rpsec="${T.id}"><h2 class="rp-h1" id="${T.id}">${T.n}. ${esc(s.title)}</h2>${s.note ? `<p class="rp-note">${rich(doc, s.note, true)}</p>` : ''}
        ${(s.subs || []).map((q, j) => { const Q = T.subs[j];
          return `<div class="rp-sub${closed.has(Q.id) ? ' rp-closed' : ''}"><h3 class="rp-h2" id="${Q.id}">${Q.n} ${rich(doc, q.title, true)}</h3>${(q.items || []).map(it => itemHtml(doc, it, lazy)).join('')}</div>`; }).join('')}</section>`; }).join('');
  }

  /* ---------- plain text ---------- */
  function text(doc) {
    const m = doc.model, L = [], T = s => rich(doc, s, false);
    L.push(m.title || '', m.subtitle || '', m.code || '');
    (m.info || []).forEach(([l, v]) => L.push(`${l}: ${v == null || v === '' ? '—' : v}`));
    (m.sections || []).forEach((s, i) => {
      if (s.part) L.push('', String(s.part).toUpperCase());
      L.push('', `${i + 1}. ${s.title}`); if (s.note) L.push(T(s.note));
      (s.subs || []).forEach((q, j) => {
        L.push('', `${i + 1}.${j + 1} ${T(q.title)}`);
        (q.items || []).forEach(it => {
          if (it.type === 'steps') { if (it.title) L.push(T(it.title)); const tp = new Map(); { let j = 0; (it.topics || []).forEach((t, k) => { tp.set(j, `  ${k + 1}. ${t.title}${t.ref ? ' [' + t.ref + ']' : ''}${t.chip ? ' (' + t.chip + ')' : ''}${t.res ? ' — ' + ST().summary(t, false) : ''}`); j += t.n; }); }
            (it.steps || []).forEach((st, i) => { if (tp.has(i)) L.push(tp.get(i)); L.push(`  ${st.label}${st.ref ? ' [' + st.ref + ']' : ''}: ${ST().line(st, false)}${st.ok === true ? ' OK' : st.ok === false ? ' NG' : ''}${st.note ? ' (' + noteOf(doc, it, st.note, false) + ')' : ''}`); }); }
          else if (it.type === 'table') { if (it.caption) L.push(T(it.caption)); const c = x => { const o = x && typeof x === 'object' ? x : { t: x }; return T(o.t) + (o.key ? ' ' + T(`[[${o.key}]]`) : ''); };
            L.push((it.head || []).map(c).join(' | ')); (it.rows || []).forEach(r => L.push((Array.isArray(r) ? r : r.cells).map(c).join(' | '))); }
          else if (it.type === 'figure') L.push('[Figure] ' + T(it.caption));
          else if (it.type === 'note') L.push(T(it.text));
          else if (it.type === 'kv') (it.rows || []).forEach(r => L.push(`${T(r[0])}: ${T(r[1])}${r[2] ? ' ' + T(`[[${r[2]}]]`) : ''}`));
        });
      });
    });
    return L.join('\n');
  }

  /* ---------- styles ---------- */
  const CSS = `
.rp{font-family:"Times New Roman",Times,serif;color:#000;}
.rp-bar{position:sticky;top:var(--rp-stick,0px);z-index:6;display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin:8px 0 12px;padding:8px 10px;background:#fff;border:1px solid #E4E7EB;border-radius:8px;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:9.5pt;}
.rp-chips{display:flex;flex-wrap:wrap;gap:6px;}
.rp-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border:1px solid #cbd5e1;border-radius:5px;cursor:pointer;background:#F8FAFC;font-size:9pt;}
.rp-chip:has(input:checked){background:#e8eef6;border-color:#64748b;}
.rp-sp{flex:1;}
.rp-q{width:150px!important;} .rp-bar select{width:auto!important;}
.rp-body{display:grid;grid-template-columns:230px minmax(0,1fr);gap:16px;align-items:start;}
.rp-toc{position:sticky;top:calc(var(--rp-stick,0px) + var(--rp-top,64px));max-height:calc(100vh - 150px - var(--rp-stick,0px) - var(--rp-top,64px));overflow:auto;border:1px solid #E4E7EB;border-radius:8px;padding:6px 2px;font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;scrollbar-width:thin;background:#fff;}
.rp-toc a{display:block;padding:2px 9px;border-left:2px solid transparent;color:#475569;text-decoration:none;font-size:9pt;line-height:1.35;}
.rp-toc a.rp-l1{font-weight:600;color:#0F172A;margin-top:5px;}
.rp-toc a.rp-l0{font-weight:700;color:#0F172A;margin-top:9px;text-transform:uppercase;font-size:8.5pt;letter-spacing:.3px;border-bottom:1px solid #E4E7EB;}
.rp-part{font:700 15pt Arial,Helvetica,sans-serif;margin:22pt 0 4pt;padding:0 0 4pt;border-bottom:1.5pt solid #000;scroll-margin-top:calc(var(--rp-stick,0px) + var(--rp-top,64px) + 8px);} .rp-ptoc li.rp-tp{font-weight:700;margin-top:6pt;}
.rp-toc a.rp-l2{padding-left:20px;font-size:8.5pt;}
.rp-toc a.rp-l3{padding-left:30px;font-size:8pt;font-style:italic;} .rp-toc a.rp-l4{padding-left:40px;font-size:8pt;}
.rp-top{margin:8pt 0 2pt;padding:2pt 0 2pt 6pt;border-left:2.5pt solid #64748b;break-after:avoid;page-break-after:avoid;} .rp-top .rp-tn,.rp-top .rp-tt{font-weight:700;} .rp-tsum{font-size:9.5pt;}
.rp-tchip{font-size:8.5pt;font-weight:700;padding:0 5pt;border:0.6pt solid #64748b;border-radius:6pt;} .rp-top-ok{border-left-color:#1a8a3a;} .rp-top-hi{border-left-color:#d9a400;} .rp-top-ng{border-left-color:#c62828;}
.rp-toc a:hover,.rp-toc a.on{color:#0F172A;border-left-color:#1E3A5F;background:#eef4fb;}
.rp-doc{display:block;max-width:8.5in;padding:0.5in 0.6in 0.7in;border:1px solid #E4E7EB;border-radius:2px;background:#fff;font-size:10.5pt;line-height:1.3;}
.rp-tb{width:100%;border-collapse:collapse;margin:0 0 18pt;font-size:10pt;} .rp-tb td{border-bottom:0.6pt solid #000;padding:3pt 8pt 3pt 0;vertical-align:bottom;} .rp-tb span{display:block;font-size:8pt;font-style:italic;}
.rp-cover{padding:0 0 12pt;margin:0 0 14pt;border-bottom:1pt solid #000;} .rp-cover h1{font:700 21pt/1.2 Arial,Helvetica,sans-serif;margin:0 0 6pt;} .rp-cover p{font:700 12pt Arial,Helvetica,sans-serif;margin:0 0 4pt;} .rp-cover .rp-cp{font-weight:400;}
.rp-ptoc{display:none;} .rp-ptoc ol{list-style:none;margin:0;padding:0;} .rp-ptoc ol ol{padding-left:18pt;font-size:10pt;}
.rp-h1x{font:700 12pt "Times New Roman",Times,serif;text-decoration:underline;text-transform:uppercase;margin:10pt 0 6pt;}
.rp-h1{font:700 12pt "Times New Roman",Times,serif;text-decoration:underline;text-transform:uppercase;margin:16pt 0 8pt;cursor:pointer;scroll-margin-top:calc(var(--rp-stick,0px) + var(--rp-top,64px) + 8px);}
.rp-h2{font:700 11pt "Times New Roman",Times,serif;margin:12pt 0 5pt;cursor:pointer;scroll-margin-top:calc(var(--rp-stick,0px) + var(--rp-top,64px) + 8px);}
.rp-h1::after,.rp-h2::after{content:'▾';display:inline-block;margin-left:6pt;font-size:9pt;color:#777;text-decoration:none;}
.rp-closed>.rp-h1::after,.rp-closed>.rp-h2::after{content:'▸';}
.rp-sub{content-visibility:auto;contain-intrinsic-size:auto 800px;}
.rp-sec.rp-closed>:not(.rp-h1){display:none;} .rp-sub.rp-closed>:not(.rp-h2){display:none;}
.rp-hide{display:none!important;}
.rp-h3{font:italic 700 10.5pt "Times New Roman",Times,serif;margin:8pt 0 2pt;}
.rp-note{font-size:9.5pt;font-style:italic;margin:3pt 0 7pt;}
.rp-warn{font-style:normal;border-left:3px solid #B45309;padding-left:6pt;}
.rp-cap{font-size:9.5pt;font-weight:700;margin:8pt 0 2pt;}
.rp-step{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"d r" "m r" "n n";gap:1pt 12pt;padding:4pt 0 3pt;border-top:0.4pt solid #bbb;break-inside:avoid;scroll-margin-top:calc(var(--rp-stick,0px) + var(--rp-top,64px) + 8px);}
.rp-step .rp-d{grid-area:d;font-size:10pt;} .rp-step .rp-m{grid-area:m;padding-left:0.25in;overflow-x:auto;} .rp-step .rp-r{grid-area:r;align-self:center;text-align:right;white-space:nowrap;} .rp-step .rp-nt{grid-area:n;padding-left:0.25in;font-size:9pt;font-style:italic;color:#7a4a00;}
.rp-ref{font-size:8.5pt;font-style:italic;color:#444;margin-left:8pt;}
.rp-ng .rp-r,.rp-ngt{font-weight:700;text-decoration:underline;} .rp-okt{font-size:8.5pt;} .rp-ngt{font-size:8.5pt;}
.rp-step:target,.rp-flash{animation:rpflash 1.6s ease-out;}
@keyframes rpflash{from{background:#FFF1B8;}to{background:transparent;}}
@media (prefers-reduced-motion:reduce){.rp-step:target,.rp-flash{animation:none;background:#FFF7D6;}}
.rp-tw{overflow-x:auto;}
.rp-tbl{border-collapse:collapse;margin:3pt 0 8pt;font-size:9.5pt;} .rp-wide{width:100%;}
.rp-tbl th,.rp-tbl td{border:0.6pt solid #000;padding:2pt 5pt;text-align:left;vertical-align:top;} .rp-tbl th{background:#e9e9e9;text-align:center;}
.rp-tbl td.rp-n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}
.rp-tbl tr{break-inside:avoid;} .rp-tbl tr.rp-gov td{font-weight:700;}
.rp-tbl td.rp-ok{background:#e7f4ec;} .rp-tbl td.rp-hi{background:#fdf3d8;} .rp-tbl td.rp-ng{background:#fbe1dd;font-weight:700;} .rp-tbl td.rp-na{color:#64748b;font-style:italic;}
.rp-kv{border-collapse:collapse;margin:3pt 0 8pt;font-size:10pt;} .rp-kv td{padding:1pt 14pt 1pt 0;vertical-align:top;border-bottom:0.4pt dotted #bbb;}
.rp-fig{margin:6pt 0;break-inside:avoid;} .rp-fig svg{max-width:100%;height:auto;} .rp-fig figcaption{font-size:9.5pt;font-style:italic;}
.rp-see,.rp-go{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-size:8.5pt;white-space:nowrap;}
.rp-bad{color:#DC2626;font-weight:700;}
details.rp-lz{border-top:0.4pt solid #bbb;padding:2pt 0;} details.rp-lz>summary{cursor:pointer;font-size:10pt;font-weight:700;padding:2pt 0;} .rp-cnt{font-weight:400;font-size:9pt;color:#555;}
.rp-doc .katex{font-size:1.05em;} .rp-doc .katex .katex-error{color:#DC2626;}
.st-frac{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:92%;margin:0 2px;} .st-frac>.st-num{border-bottom:1px solid currentColor;padding:0 2px;} .st-frac>.st-den{padding:0 2px;} .st-bar{text-decoration:overline;}
#rp-print{display:none;}
@media (max-width:1000px){.rp-body{grid-template-columns:minmax(0,1fr);} .rp-toc{position:static;max-height:220px;} .rp-doc{padding:14px;}}
@media print{
  body.rp-printing>*:not(#rp-print){display:none!important;}
  html:has(body.rp-printing),body.rp-printing{height:auto!important;overflow:visible!important;background:#fff!important;}
  body.rp-printing #rp-print{display:block!important;}
  .rp-bar,.rp-toc,.rp-go{display:none!important;}
  .rp-body{display:block;} .rp-sub{content-visibility:visible;}
  .rp-doc{border:0;padding:0;max-width:none;box-shadow:none;}
  .rp-ptoc{display:block;break-after:page;}
  .rp-sec{break-before:page;} .rp-part{break-before:page;break-after:avoid;} .rp-part+.rp-sec{break-before:auto;} .rp-sec.rp-closed>*,.rp-sub.rp-closed>*{display:revert!important;} .rp-hide{display:revert!important;}
  .rp-h1::after,.rp-h2::after{content:none!important;}
  .rp-h1,.rp-h2,.rp-h3,.rp-cap{break-after:avoid;}
  .rp-see{font-family:"Times New Roman",Times,serif;font-size:inherit;color:#000;text-decoration:none;}
  .rp-see::before{content:"see ";} .rp-seen::before{content:none;}
  details.rp-lz>summary{list-style:none;} details.rp-lz>summary::-webkit-details-marker{display:none;}
  .rp-tbl td.rp-ok,.rp-tbl td.rp-hi,.rp-tbl td.rp-ng,.rp-tbl th{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .rp-step .rp-m{overflow:visible;}
  .katex,.katex *{-webkit-print-color-adjust:exact;print-color-adjust:exact;} .katex .frac-line{border-bottom-color:#000!important;min-height:1px;}
}`;
  function css() {
    if (typeof document === 'undefined' || document.getElementById('rp-css')) return;
    const st = document.createElement('style'); st.id = 'rp-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  const cssStr = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
  function pageCss(doc) {
    const h = doc.model.head || {}, box = 'font: 9pt "Times New Roman", Times, serif; color: #000; white-space: pre;';
    return `@page { size: letter portrait; margin: 0.85in 0.6in 0.7in 0.6in;
      @top-left { content: "${cssStr(h.left || doc.model.title)}"; ${box} vertical-align: bottom; padding-bottom: 6pt; text-align: left; }
      @top-right { content: "${cssStr(h.right || '')}"; ${box} vertical-align: bottom; padding-bottom: 6pt; text-align: right; }
      @bottom-left { content: "${cssStr(h.foot || doc.model.title)}"; ${box} vertical-align: top; padding-top: 6pt; }
      @bottom-right { content: "Page " counter(page) " of " counter(pages); ${box} vertical-align: top; padding-top: 6pt; } }`;
  }
  function setPage(doc) { let st = document.getElementById('rp-page'); if (!st) { st = document.createElement('style'); st.id = 'rp-page'; document.head.appendChild(st); } st.textContent = doc ? pageCss(doc) : ''; }

  /* ---------- the viewer ---------- */
  let LIVE = null;   // the mounted viewer (for Ctrl+P from the Report tab: running header, lazy items filled)
  function fillLazy(root, doc) {
    root.querySelectorAll('details.rp-lz').forEach(d => { if (!d.dataset.filled) { const it = doc.lazy[+d.dataset.rplz]; d.insertAdjacentHTML('beforeend', `<div class="rp-steps">${stepsHtml(doc, it)}</div>`); d.dataset.filled = '1'; } d.open = true; });
  }
  function mount(host, model, opt) {
    css(); opt = opt || {};
    const doc = build(model), closed = opt.closed || new Set();
    host.innerHTML = `<div class="rp"><div class="rp-bar">${opt.controls || ''}<span class="rp-sp"></span><input type="search" class="rp-q" placeholder="Search the report" aria-label="Search the report">
      <button type="button" data-rpact="exp">Expand all</button><button type="button" data-rpact="col">Collapse all</button><button type="button" class="primary" data-rpact="print">Print report</button></div>
      <div class="rp-body"><nav class="rp-toc" aria-label="Report contents">${doc.toc.map(s => `${s.part ? `<a href="#${s.part.id}" data-rpto="${s.part.id}" class="rp-l0">${esc(s.part.title)}</a>` : ''}<a href="#${s.id}" data-rpto="${s.id}" class="rp-l1">${s.n}. ${esc(s.title)}</a>${s.subs.map(q => `<a href="#${q.id}" data-rpto="${q.id}" class="rp-l2">${q.n} ${rich(doc, q.title, true)}</a>${(q.items || []).map(it => `<a href="#${it.anchor}" data-rpto="${it.anchor}" class="rp-l3">${rich(doc, it.title, true)}</a>${it.tops.map((t, k) => `<a href="#${t.anchor}" data-rpto="${t.anchor}" class="rp-l4">${k + 1}. ${esc(t.title)}</a>`).join('')}`).join('')}`).join('')}`).join('')}</nav>
      <article class="rp-doc">${html(doc, { lazy: true, closed })}</article></div></div>`;
    const root = host.querySelector('.rp'); if (opt.stick) root.style.setProperty('--rp-stick', opt.stick + 'px');
    const bar = root.querySelector('.rp-bar'), art = root.querySelector('.rp-doc');
    const size = () => { if (bar.offsetHeight) root.style.setProperty('--rp-top', (bar.offsetHeight + 8) + 'px'); }; size();
    const open = el => { let p = el.closest('.rp-closed'); while (p) { p.classList.remove('rp-closed'); closed.delete((p.querySelector('.rp-h1,.rp-h2') || {}).id); p = p.parentElement && p.parentElement.closest('.rp-closed'); } };
    const flash = el => { el.classList.remove('rp-flash'); void el.offsetWidth; el.classList.add('rp-flash'); setTimeout(() => el.classList.remove('rp-flash'), 1700); };
    const go = id => { const el = root.querySelector('#' + id); if (!el) return false; open(el); el.scrollIntoView({ block: 'start' }); flash(el); return true; };
    function jump(key) {
      const e = doc.index.get(key); if (!e) return false;
      if (e.lz != null) { const d = art.querySelector(`details.rp-lz[data-rplz="${e.lz}"]`); if (d) { if (!d.dataset.filled) { d.insertAdjacentHTML('beforeend', `<div class="rp-steps">${stepsHtml(doc, doc.lazy[e.lz])}</div>`); d.dataset.filled = '1'; } d.open = true; } }
      return go(e.anchor);
    }
    root.addEventListener('click', e => {
      const t = e.target;
      const j = t.closest('[data-rpjump]'); if (j) { e.preventDefault(); jump(j.dataset.rpjump); return; }
      const to = t.closest('[data-rpto]'); if (to) { e.preventDefault(); go(to.dataset.rpto); return; }
      const g = t.closest('[data-rpgoto]'); if (g) { e.preventDefault(); if (opt.onGoto) opt.onGoto(g.dataset.rpgoto); return; }
      const h = t.closest('.rp-h1,.rp-h2'); if (h && !t.closest('a')) { const box = h.parentElement; box.classList.toggle('rp-closed'); if (box.classList.contains('rp-closed')) closed.add(h.id); else closed.delete(h.id); return; }
      const a = t.closest('[data-rpact]'); if (!a) return;
      if (a.dataset.rpact === 'exp') { art.querySelectorAll('.rp-closed').forEach(x => x.classList.remove('rp-closed')); closed.clear(); }
      else if (a.dataset.rpact === 'col') art.querySelectorAll('.rp-sec').forEach(x => { x.classList.add('rp-closed'); closed.add(x.querySelector('.rp-h1').id); });
      else if (a.dataset.rpact === 'print') print(doc);
    });
    art.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details.rp-lz') && d.open && !d.dataset.filled) { d.insertAdjacentHTML('beforeend', `<div class="rp-steps">${stepsHtml(doc, doc.lazy[+d.dataset.rplz])}</div>`); d.dataset.filled = '1'; } }, true);
    // search: hides the subsections (and sections) whose text does not contain every word typed
    let qT = 0;
    root.querySelector('.rp-q').addEventListener('input', e => { clearTimeout(qT); const v = e.target.value; qT = setTimeout(() => search(v), 150); });
    function search(v) {
      const w = String(v || '').toLowerCase().split(/\s+/).filter(Boolean), has = el => { const t = (el._rpq || (el._rpq = el.textContent.toLowerCase())); return w.every(x => t.includes(x)); };
      art.querySelectorAll('.rp-sec').forEach(sec => {
        const h1 = sec.querySelector('.rp-h1'), secHit = !w.length || has(h1); let any = false;
        sec.querySelectorAll('.rp-sub').forEach(sub => { const hit = !w.length || secHit || has(sub); sub.classList.toggle('rp-hide', !hit); any = any || hit;
          const a = root.querySelector(`.rp-toc [data-rpto="${sub.querySelector('.rp-h2').id}"]`); if (a) a.classList.toggle('rp-hide', !hit); });
        const show = !w.length || secHit || any; sec.classList.toggle('rp-hide', !show);
        const a = root.querySelector(`.rp-toc [data-rpto="${h1.id}"]`); if (a) a.classList.toggle('rp-hide', !show);
        if (w.length && show) sec.classList.remove('rp-closed');
      });
    }
    LIVE = { host, doc, art };
    return { doc, print: () => print(doc), jump };
  }
  /* print(doc): the whole report alone on the page (every section open, every lazy item filled), the running header and page numbers
     as @page margin boxes (Chromium-based browsers print them; others print the page without). */
  function print(doc) {
    css();
    let box = document.getElementById('rp-print'); if (!box) { box = document.createElement('div'); box.id = 'rp-print'; document.body.appendChild(box); }
    box.innerHTML = `<div class="rp"><article class="rp-doc">${html(doc, { lazy: false })}</article></div>`;
    setPage(doc); document.body.classList.add('rp-printing');
    if (typeof window.print === 'function') setTimeout(() => window.print(), 50);
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('beforeprint', () => { if (document.body.classList.contains('rp-printing')) return;   // Ctrl+P while the Report tab shows
      if (LIVE && LIVE.host.isConnected && LIVE.host.querySelector('.rp') && LIVE.host.offsetParent !== null) { fillLazy(LIVE.art, LIVE.doc); setPage(LIVE.doc); } });
    window.addEventListener('afterprint', () => { document.body.classList.remove('rp-printing'); setPage(null); const b = document.getElementById('rp-print'); if (b) b.innerHTML = ''; });
  }

  window.SharedReport = { build, html, text, mount, print, ref, keyOf, css };
})();
