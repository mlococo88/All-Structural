/* apps/steel-bridge/ui/nomen.js — the Nomenclature output tab (window.SBDNomenUI). Added 2026-11-23 (NOM; engineer 2026-11-23: the
   Steel Bridge app gets the Prestressed Bridge app's Nomenclature tab, apps/ps-bridge/ui/nomen.js). Classic script; display only.

   The list is built from the symbols the app's worked steps actually use, for the girder type and line shown (the choice above the output
   tabs): every worked step of this girder's calculation report (report/data.js compute + report/builders.js model, detail 'gov': the
   governing location of each check; the same steps the output tabs and the Report show) gives its symbol (the step's sym), description
   (its label), unit, value, article (its ref) and the module that works it. Nothing is calculated here and nothing is saved: a value is the
   step's own value, formatted as the step is (SharedSteps.fmt with the step's decimals); the search text lives in this page view.

   A symbol is a step whose sym is a quantity (a name, with subscripts): a step whose sym is a comparison or a ratio of two quantities
   (a check: "P / R_r", "e ≥ e_min", "limit state") is a check, not a symbol, and is left out; so is a step without a sym.
   One row per symbol and module (the same letter can mean another quantity in another module: each module's row says what it is there).
   Where a symbol is worked at several places of the module (segments, locations, spans), the row shows the first, in the report's order
   (the governing location first where the module lists one), and "+ n more" opens the list of every use with its value.
   The § link of a row opens the output tab that works the symbol (CLAUDE.md §6: an in-app link to the tab where the value is worked).

     collect(model) -> { groups: [{ id, tab, title, rows: [{ sym, uses: [{ label, value, unit, d, ref, where, id }] }] }], n, steps }   (no DOM)
     arts(ref) -> the article text of a step's ref, the specification's name shortened ('AASHTO LRFD 10th Ed. Art. 6.10.9.1' -> '6.10.9.1')
     match(row, q) -> the search: every word of q is in the symbol (its TeX and plain text), a description, a unit, an article or the module
     render(host, ctx), ctx = { P, g, goto(tab) } */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const ST = () => W.SharedSteps;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* the report sections that hold worked steps, their output tab and name (the order of the list) */
  const MODS = [['proj', 'loads', 'Owner load rules'], ['loads', 'loads', 'Loads & LLDF'], ['an', 'an', 'Analysis'], ['defl', 'defl', 'Deflection'], ['sec', 'sec', 'Section properties'], ['flex', 'flex', 'Flexure'],
    ['shear', 'shear', 'Shear & stiffeners'], ['fat', 'fat', 'Fatigue & studs'], ['cn', 'cn', 'Constructibility'], ['frm', 'cf', 'Cross-frames'], ['spl', 'spl', 'Field splices'], ['wd', 'wt', 'Welds'], ['dk', 'dk', 'Deck slab'], ['rt', 'rt', 'Rating']];   // dk (DK, 2026-11-23): only a project with the deck design on has that section
  /* isSym(sym): a quantity's name, not a check (comparison, ratio, text) */
  const isSym = t => { const s = String(t || '').trim(); return !!s && s.length <= 40 && !/[=<>≤≥]|\\(le|ge|leq|geq|lt|gt|ne|neq|approx|frac|dfrac|tfrac|text|sum|times|cdot|div|to|rightarrow)\b|\/|\+|,\s/.test(s) && !/^\d/.test(s); };
  const arts = ref => String(ref || '').replace(/AASHTO LRFD 10th Ed\.?( \(2024\))?\s*/g, '').replace(/AASHTO MBE 4th Ed\.?( \(2026\))?\s*/g, 'MBE ').replace(/\bArts?\.\s*/g, '').replace(/\s*\(p\. [^)]*\)/g, '').trim();
  function collect(model) {
    const groups = [], by = new Map(); let steps = 0, n = 0;
    ((model && model.sections) || []).forEach((sc, i) => {
      const m = MODS.find(q => q[0] === sc.id); if (!m) return;
      (sc.subs || []).forEach(sub => (sub.items || []).forEach(it => { if (!it || it.type !== 'steps') return;
        (it.steps || []).forEach(t => { steps++; if (!isSym(t.sym)) return;
          let G = by.get(m[0]); if (!G) { G = { id: m[0], tab: m[1], title: m[2], sec: i + 1, rows: [], idx: new Map() }; by.set(m[0], G); groups.push(G); }
          let r = G.idx.get(t.sym); if (!r) { r = { sym: t.sym, uses: [] }; G.idx.set(t.sym, r); G.rows.push(r); n++; }
          r.uses.push({ label: String(t.label || ''), value: t.value, unit: t.unit || '', d: t.d, ref: String(t.ref || ''), where: String(sub.title || ''), id: t.id }); }); }));
    });
    groups.forEach(G => { delete G.idx; });
    return { groups, n, steps };
  }
  const TABN = { loads: 'Loads & LLDF', an: 'Analysis', defl: 'Deflection', sec: 'Section properties', flex: 'Flexure', shear: 'Shear & stiffeners', fat: 'Fatigue & studs', cn: 'Constructibility', cf: 'Cross-frames', spl: 'Field splices', wt: 'Welds', rt: 'Rating' };   // the output tabs' names
  const plain = t => { try { return ST().toText(t); } catch (e) { return String(t); } };
  function match(G, r, q) {
    const ws = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); if (!ws.length) return true;
    const hay = [r.sym, plain(r.sym), G.title].concat(...r.uses.map(u => [u.label, plain(u.unit), arts(u.ref), u.where])).join(' \u0001 ').toLowerCase();
    return ws.every(w => hay.includes(w));
  }

  /* ---------- the tab ---------- */
  const S = { key: '', D: null, err: '', busy: false, q: '' };
  const keyOf = ctx => JSON.stringify([ctx.P, ctx.g]);
  const tex = t => { try { return ST().toHTML(t); } catch (e) { return esc(t); } };
  const val = u => (typeof u.value === 'number' ? (isFinite(u.value) ? ST().fmt(u.value, u.d == null ? 3 : u.d) : '—') : u.value == null || String(u.value).trim() === '' ? '—' : esc(String(u.value)));   // a step without a single value (worked in its equation): —
  const unit = u => (u.unit ? tex(ST().unitTeX(u.unit)) : '');
  function css() {
    if (document.getElementById('sbdNomCss')) return; const st = document.createElement('style'); st.id = 'sbdNomCss';
    st.textContent = `.nm-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:0 0 8px;font-family:var(--font-ui);font-size:9.5pt;} .nm-bar input{flex:1 1 220px;min-width:0;max-width:420px;font:inherit;padding:5px 8px;}
      .nm-t{width:100%;border-collapse:collapse;font-size:9.5pt;} .nm-t th,.nm-t td{border-bottom:1px solid var(--line);padding:3px 6px;vertical-align:top;text-align:left;} .nm-t th{font-family:var(--font-ui);font-size:8.5pt;font-weight:600;color:#334155;}
      .nm-t td.nm-v{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;} .nm-t td.nm-s,.nm-t td.nm-go{white-space:nowrap;} .nm-t td.nm-go{font-family:var(--font-ui);font-size:8.5pt;} .nm-t td.nm-a{font-family:var(--font-ui);font-size:8.5pt;color:#475569;} .nm-t .nm-w{display:block;font-family:var(--font-ui);font-size:8.5pt;color:#64748B;}
      .nm-t details{font-family:var(--font-ui);font-size:8.5pt;} .nm-t details summary{cursor:pointer;color:var(--accent);} .nm-t details ul{margin:2px 0 2px 16px;padding:0;} .nm-wrap{overflow-x:auto;} .nm-none{font-family:var(--font-ui);font-size:9.5pt;color:#64748B;}
      @media (max-width:700px){ .nm-t td.nm-s{white-space:normal;} }`;
    document.head.appendChild(st);
  }
  function rowHtml(G, r) {
    const u = r.uses[0], more = r.uses.length - 1, a = arts(u.ref);
    return `<tr data-nm><td class="nm-s">${tex(r.sym)}</td><td>${tex2(u.label)}${u.where && !/^Worked steps$/i.test(u.where) && u.where !== G.title ? `<span class="nm-w">${tex2(u.where)}</span>` : ''}${more > 0 ? `<details><summary>+ ${more} more in ${esc(G.title)}</summary><ul>${r.uses.slice(1, 41).map(x => `<li>${tex2(x.label)}${x.where && x.where !== u.where ? ` (${tex2(x.where)})` : ''}: <b>${val(x)}</b> ${unit(x)}${arts(x.ref) && arts(x.ref) !== a ? ` · ${esc(arts(x.ref))}` : ''}</li>`).join('')}${more > 40 ? `<li>… and ${more - 40} more (the ${esc(G.title)} tab lists every one)</li>` : ''}</ul></details>` : ''}</td>
      <td class="nm-v">${val(u)}</td><td>${unit(u)}</td><td class="nm-a">${esc(a)}</td><td class="nm-go"><a href="#" data-nmgo="${G.tab}" title="Open the ${esc(TABN[G.tab] || G.title)} tab, where this value is worked">§ ${esc(TABN[G.tab] || G.title)}</a></td></tr>`;
  }
  /* a step label or a subsection title: plain text with the report's notation ($…$ and the engines' _x subscripts) */
  const tex2 = t => esc(String(t == null ? '' : t)).replace(/\$([^$]+)\$/g, (m, a) => tex(a.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))).replace(/([A-Za-zΑ-ωφγηΔ′']+)_\{?([A-Za-z0-9ℓ]+(?:,[A-Za-z0-9ℓ]+)*)\}?/g, '$1<sub>$2</sub>');
  function listHtml(D, q) {
    let shown = 0;
    const h = D.groups.map(G => { const rows = G.rows.filter(r => match(G, r, q)); if (!rows.length) return ''; shown += rows.length;
      return `<section class="sec" data-nmgrp="${G.id}"><div class="secHead">${esc(G.title)} <span style="font-weight:400">(${rows.length} symbol${rows.length === 1 ? '' : 's'})</span></div><div class="secBody"><div class="nm-wrap"><table class="nm-t"><thead><tr><th>Symbol</th><th>Description (first use; where)</th><th>Value</th><th>Unit</th><th>Article</th><th>Worked in</th></tr></thead><tbody>${rows.map(r => rowHtml(G, r)).join('')}</tbody></table></div></div></section>`; }).join('');
    return { h: h || `<p class="nm-none">No symbol matches "${esc(q)}".</p>`, shown };
  }
  function render(host, ctx) {
    css();
    const P = ctx.P, g = P.girders[ctx.g] || P.girders[0], name = esc(g.label || g.id), stale = !S.D || S.key !== keyOf(ctx);
    const head = `<div class="alert stale"${stale && !S.busy ? '' : ' hidden'}><span>${S.D ? 'The list is out of date: inputs changed.' : 'The list has not been built.'} It takes its symbols and values from the worked steps of ${name} (this project's analysis, every module as on its own tab; a few seconds).</span><button type="button" class="primary" id="nm_calc">Calculate</button></div>`;
    if (S.busy) { host.innerHTML = `${head}<div class="alert">Calculating… the worked steps of ${name}.</div>`; return; }
    if (stale || S.err) { host.innerHTML = `${head}${S.err ? `<div class="alert err">${esc(S.err)}</div>` : ''}`; host.querySelector('#nm_calc').addEventListener('click', () => build(host, ctx)); return; }
    const L = listHtml(S.D, S.q);
    host.innerHTML = `${head}<section class="sec"><div class="secHead">Nomenclature</div><div class="secBody">
      <p class="note">The symbols of the worked steps of <b>${name}</b>, by module: what each means there, its value at its first use (the governing location of a check where the module lists one), its unit and the article the step cites. "§" opens the tab that works it. A check (a comparison or a demand / capacity ratio) is not a symbol and is not listed. AASHTO LRFD 10th Ed. (2024); MBE 4th Ed. (2026) for the rating.</p>
      <div class="nm-bar"><label for="nm_q">Search</label><input type="search" id="nm_q" value="${esc(S.q)}" placeholder="symbol, description, unit or article (e.g. D_c, web, 6.10.9)" autocomplete="off"><span id="nm_n" role="status" aria-live="polite">${L.shown} of ${S.D.n} symbols</span></div></div></section><div id="nm_list">${L.h}</div>`;
    const inp = host.querySelector('#nm_q');
    inp.addEventListener('input', () => { S.q = inp.value; const R = listHtml(S.D, S.q); host.querySelector('#nm_list').innerHTML = R.h; host.querySelector('#nm_n').textContent = `${R.shown} of ${S.D.n} symbols`; });
    host.querySelector('#nm_calc').addEventListener('click', () => build(host, ctx));
    host.querySelector('#nm_list').addEventListener('click', e => { const a = e.target.closest('[data-nmgo]'); if (!a) return; e.preventDefault(); if (ctx.goto) ctx.goto(a.dataset.nmgo); });
  }
  function build(host, ctx) {
    S.busy = true; S.err = ''; render(host, ctx);
    setTimeout(() => {
      try {
        const B = W.SBDReportData.compute(ctx.P, ctx.g, { src: 'analysis' }); if (B.err && B.err.all) throw new Error(B.err.all);
        const M = W.SBDReportBuild.model(B, { detail: 'gov', include: { exec: false, basis: false, sum: false, bom: false, sign: false } });
        S.D = collect(M); const er = Object.entries(B.err || {}).filter(([k]) => k !== 'all');
        if (er.length) S.D.miss = er.map(([k, v]) => `${(MODS.find(q => q[0] === k) || [0, 0, k])[2]}: ${v}`);
      } catch (e) { S.D = null; S.err = 'The list could not be built: ' + (e && e.message); }
      S.key = keyOf(ctx); S.busy = false; render(host, ctx);
      if (S.D && S.D.miss && S.D.miss.length) host.insertAdjacentHTML('beforeend', `<div class="alert">Not calculated, so their symbols are not listed: ${S.D.miss.map(esc).join('; ')}.</div>`);
    }, 30);
  }

  W.SBDNomenUI = { render, collect, isSym, arts, match, MODS, TABN, state: S };
})();
