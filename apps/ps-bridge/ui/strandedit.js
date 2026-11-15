/* apps/ps-bridge/ui/strandedit.js — strand editing by clicking the section (window.PSBStrandEdit): the old app's Live Geometry editing
   (O:4936-5024, 6051-6066): "+ add strands" on the 2 in grid, a strand clicked to debond (cycle), move its row ±1 in or remove one; the
   edit log ("Strand edits from the graphic"), "↺ Revert strand edits" back to the layout before the first edit of this page view. Created
   2026-11-15 (batch G5). Classic script; an INPUT editor: it changes only the straight strand rows (base.rows, or a girder type's rows in
   its scope), as the table does; every edit is one change of the project (one step of the header's Undo). The draped strands are not
   edited here (as the old app). Nothing is calculated.

   Rules (the old app's, O:4943-4968): add = one strand (NEXT: a pair) to the row at that height, or a new row there; remove = one strand
   (NEXT: a pair) from the row, the row dropped at 0 (one row always stays: the engine's mergeInputs reads an empty list as its default
   rows); debond = the next strand (NEXT: pair) of the row debonded, cycling back to none (a row with no debonded length gets 10 % of the
   span, rounded to 1 ft, as the old app; the length is edited in the table); move = the row's y ± 1 in (≥ 1 in), rows sorted by y.
   Unlike the old app, an edit whose strands would not fit (the input check's strand fit, PS-28 / PS-33 / PS-39: inside the concrete,
   2 in from its edges, 1.25 in from a void) is refused with the reason, and the add grid shows only the slots of rows that would fit.

   Pure: apply(rows, op, o) -> { rows, msg } | { err }  (op: 'add' (o.y), 'remove' | 'debond' | 'up' | 'down' | 'clear' (o.i), o.next, o.L);
         slots(g, rows, o) -> [{ x, y }] the add targets (o.misfit(q) the input check's, o.fits(rows) the whole check).
   Page: card(label) (HTML) and mount(host, ctx), ctx = { R, rows (the scope's rows), scopeKey, commit(rows, msg) -> { err }, fits, fitWhy (fitCtx) }. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fx = (v, d) => (typeof v === 'number' && isFinite(v) ? (+v.toFixed(d)).toString() : '—');
  const copy = rows => (rows || []).map(r => Object.assign({}, r));
  const S = { add: false, sel: null, view: 'end', start: {}, log: {} };   // page view only: start layout and log per scope key

  function apply(rows0, op, o) {
    o = o || {}; const inc = o.next ? 2 : 1, rows = copy(rows0), w = o.next ? 'a pair of strands' : '1 strand';
    if (op === 'add') {
      const y = Math.round(+o.y), i = rows.findIndex(r => Math.abs(+r.y - y) < 1);
      if (i >= 0) rows[i].n = (+rows[i].n || 0) + inc; else { rows.push({ n: inc, y, dbnd: 0, nd: 0 }); rows.sort((a, b) => +a.y - +b.y); }
      return { rows, msg: `Added ${w} at y = ${y} in` };
    }
    const i = o.i, r = rows[i]; if (!r) return { err: 'No such row.' };
    if (op === 'remove') {
      const n = Math.max(0, (+r.n || 0) - inc);
      if (n === 0 && rows.length === 1) return { err: 'One straight strand row stays (the engine reads an empty list as its default rows): add a strand elsewhere first, or edit the row in the table.' };
      if (n === 0) rows.splice(i, 1); else { r.n = n; if ((+r.nd || 0) > n) r.nd = n; }
      return { rows, msg: `Removed ${w} from y = ${fx(+r.y, 2)} in` };
    }
    if (op === 'debond') {
      if (!(+r.dbnd > 0)) r.dbnd = Math.max(+r.dbnd || 0, Math.round((+o.L || 0) * 0.1));
      const cur = Math.min(+r.nd || 0, +r.n || 0);
      r.nd = cur + inc <= +r.n ? cur + inc : 0; if (r.nd === 0) r.dbnd = 0;
      return { rows, msg: r.nd > 0 ? `Debonded ${r.nd} of ${r.n} strands at y = ${fx(+r.y, 2)} in (${fx(+r.dbnd, 2)} ft)` : `Cleared the debonding at y = ${fx(+r.y, 2)} in` };
    }
    if (op === 'clear') { r.nd = 0; r.dbnd = 0; return { rows, msg: `Cleared the debonding at y = ${fx(+r.y, 2)} in` }; }
    if (op === 'up' || op === 'down') {
      const y = Math.max(1, Math.round(+r.y + (op === 'up' ? 1 : -1))); if (y === +r.y) return { err: 'The row is at the lowest height (1 in).' };
      r.y = y; rows.sort((a, b) => +a.y - +b.y);
      return { rows, msg: `Moved the row to y = ${y} in` };
    }
    return { err: 'Unknown edit.' };
  }
  /* slots(g, rows, o): the empty 2 in grid positions of the add mode (the old app's: y = 2, 4, … up to min(0.4 h, 16) in, the bottom flange
     width), only at heights where one more strand keeps the row inside the input check's fit (o.fits(rows) true) and each slot itself fits
     (o.misfit(q) ''); occupied positions (o.occ: Set of 'x,y') left out */
  function slots(g, rows, o) {
    const out = [], bw = +g.bbf || +g.w || 0, maxCols = Math.floor((bw - 4) / 2) + 1, top = Math.min(g.h * 0.4, 16);
    for (let y = 2; y <= top + 1e-9; y += 2) {
      const r = apply(rows, 'add', { y }); if (r.err || (o.fits && !o.fits(r.rows))) continue;
      for (let c = 0; c < maxCols; c++) { const x = (c - (maxCols - 1) / 2) * 2, q = { x, y };
        if (o.occ && o.occ.has(`${x.toFixed(1)},${y.toFixed(1)}`)) continue; if (o.misfit && o.misfit(q)) continue; out.push(q); }
    }
    return out;
  }

  /* fitErrs(P, sk, rows): the input check's strand-fit errors (paths base.rows… / base.harp…) of the inputs in scope (sk ≥ 0: girder type sk,
     on its first line and span; else the base design) with these straight rows: the page's PSBInputCheck.collect, as engine/autodesign.js */
  function fitErrs(P, sk, rows) {
    const BR = window.PSBBridge, IC = window.PSBInputCheck; if (!IC) return [];
    const typed = sk >= 0 && BR && BR.hasTypes(P), b = JSON.parse(JSON.stringify(typed ? BR.effBase(P, sk) : P.base)); b.rows = copy(rows);
    const g = typed ? BR.typeLines(P, sk)[0] : null, design = typed && g ? { g, s: P.types[sk].span } : P.design;
    try { return IC.collect(Object.assign({}, P, { base: b, types: undefined, design })).errors.filter(e => /^base\.(rows|harp)(\.|$)/.test(e.path)).map(e => e.msg); } catch (e) { return []; }
  }
  /* fitCtx(P, sk, rows0): fits(rows) = no more strand-fit errors than the rows as they are (an edit may not add one); fitWhy(rows): the first new message */
  function fitCtx(P, sk, rows0) {
    const n0 = fitErrs(P, sk, rows0).length, memo = new Map(), errs = rows => { const k = JSON.stringify(rows); if (!memo.has(k)) memo.set(k, fitErrs(P, sk, rows)); return memo.get(k); };
    return { fits: rows => errs(rows).length <= n0, fitWhy: rows => { const e = errs(rows), e0 = fitErrs(P, sk, rows0); return (e.find(m => !e0.includes(m)) || e[0] || '').replace(/^Straight strand rows, /, ''); } };
  }

  /* ---------- the page ---------- */
  function card(label) {
    return `<section class="sec" id="card-strandEdit"><div class="secHead">Edit strands on the section${label ? ` of ${esc(label)}` : ''}</div><div class="secBody" id="strandEditHost"><p class="note">Shown when the inputs have no error.</p></div></section>`;
  }
  function svg(ctx, W) {
    const { R, rows } = ctx, g = R.g, ss = R.ss, SG = window.PSBStrandGfx, end = S.view === 'end';
    const half = halfPolygon(g), poly = half.concat(half.slice().reverse().map(p => [-p[0], p[1]]));
    const bmax = Math.max(+g.bbf || 0, +g.btf || 0, +g.w || 0), pad = 16, sc = Math.min((W - 2 * pad) / bmax, 300 / g.h), H = g.h * sc + 2 * pad, cx = W / 2;
    const X = x => cx + x * sc, Y = y => pad + (g.h - y) * sc;
    const ssLike = { rows: rows.map(r => ({ n: +r.n || 0, y: +r.y, nd: +r.nd || 0, dbnd: +r.dbnd || 0 })), nh: ss.nh, hp: ss.hp };
    const cg = ss.nh > 0 ? (end ? +ss.hp.yEnd : +ss.hp.yMid) : 0, pts = SG.xy({ g, ss: ssLike }, cg), rad = Math.max(3, (ss.st.db / 2) * sc);
    let h = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Strand pattern at ${end ? 'the end' : 'midspan'}: click a strand to edit its row" style="max-width:100%;touch-action:manipulation">`;
    h += `<polygon points="${poly.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="#F2F5F8" stroke="#16212E" stroke-width="1.4"/>`;
    sectionVoids(g).forEach(v => { h += v.type === 'rect' ? `<rect x="${X(v.x - v.w / 2)}" y="${Y(v.y + v.h / 2)}" width="${v.w * sc}" height="${v.h * sc}" fill="#fff" stroke="#16212E" stroke-dasharray="4 2"/>`
      : `<circle cx="${X(v.x)}" cy="${Y(v.y)}" r="${v.d / 2 * sc}" fill="#fff" stroke="#16212E" stroke-dasharray="4 2"/>`; });
    if (S.add && !g.isNext) {
      const IC = window.PSBInputCheck, occ = new Set(pts.filter(p => !p.h).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`));
      slots(g, rows, { occ, misfit: IC && IC.misfit ? q => IC.misfit(g, poly, q) : null, fits: ctx.fits }).forEach(q => {
        h += `<circle class="se-slot" data-se="add" data-y="${q.y}" cx="${X(q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="${(rad * 0.85).toFixed(1)}" fill="rgba(28,79,196,.08)" stroke="#1C4FC4" stroke-dasharray="2 2" stroke-width="0.8" style="cursor:pointer"><title>Add ${g.isNext ? 'a pair' : 'a strand'} at y = ${q.y} in</title></circle>`; });
    }
    pts.forEach(p => { const sel = !p.h && S.sel === p.ri, db = !p.h && end && p.db;
      h += `<circle${p.h ? '' : ` class="se-str" data-se="pick" data-ri="${p.ri}" style="cursor:pointer"`} cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${(sel ? rad + 1.5 : rad).toFixed(1)}" fill="${p.h ? '#B45309' : db ? '#fff' : '#8A5A44'}" stroke="${sel ? '#16212E' : db ? '#DC6B2F' : '#fff'}" stroke-width="${sel ? 1.8 : db ? 1.4 : 0.6}"><title>${p.h ? `draped strand (edit the draped strands in the table)` : `row ${p.ri + 1}: ${rows[p.ri].n} strands at y = ${fx(+rows[p.ri].y, 2)} in${+rows[p.ri].nd > 0 && +rows[p.ri].dbnd > 0 ? `, ${rows[p.ri].nd} debonded ${fx(+rows[p.ri].dbnd, 2)} ft` : ''}`}</title></circle>`; });
    return h + '</svg>';
  }
  function body(ctx) {
    const { rows, R } = ctx, g = R.g, key = ctx.scopeKey, log = S.log[key] || [], dirty = !!S.start[key] && JSON.stringify(S.start[key]) !== JSON.stringify(rows), r = S.sel != null ? rows[S.sel] : null, pr = g.isNext ? 'pair' : 'strand';
    let h = `<div class="fRow" style="gap:6px;flex-wrap:wrap"><button type="button" data-se="mode" aria-pressed="${S.add}"${g.isNext ? ' disabled title="NEXT beams: add strands in the table (the stems are filled in pairs)"' : ''}>${S.add ? '● Adding: click a grid slot' : '+ Add strands'}</button>
      <button type="button" data-se="revert"${dirty ? '' : ' disabled'} title="Put the straight rows back as they were before the first edit on this graphic in this page view (one Undo step)">↺ Revert strand edits</button>
      <span role="group" aria-label="Section">${[['end', 'At ℄ bearing'], ['mid', 'At midspan']].map(([v, t]) => `<button type="button" data-se="view" data-v="${v}" aria-pressed="${S.view === v}"${S.view === v ? ' style="font-weight:700;border-color:#1E3A5F"' : ''}>${t}</button>`).join('')}</span></div>
      <div id="seFig"></div>`;
    if (r) h += `<div class="alert" id="seRow" style="background:#F7FAFF;border-color:#2563EB"><b>Row ${S.sel + 1}: ${r.n} strands at y = ${fx(+r.y, 2)} in</b>${+r.nd > 0 && +r.dbnd > 0 ? ` · ${r.nd} debonded ${fx(+r.dbnd, 2)} ft` : ''}
      <div class="fRow" style="gap:6px;flex-wrap:wrap;margin-top:6px"><button type="button" data-se="debond">${+r.nd > 0 ? '↻ Debond the next ' + pr + ' (cycles to none)' : '⌁ Debond a ' + pr}</button><button type="button" data-se="up">↑ Row +1 in</button><button type="button" data-se="down">↓ Row −1 in</button>
      <button type="button" data-se="remove">✕ Remove a ${pr}</button>${+r.nd > 0 || +r.dbnd > 0 ? '<button type="button" data-se="clear">Clear debonding on this row</button>' : ''}<button type="button" data-se="done">Done</button></div>
      <p class="note">Debonding takes the outermost strands of the row first; a row with no debonded length gets 10 % of the span, rounded to 1 ft (edit it in the table). Hollow: debonded (at ℄ bearing).</p></div>`;
    h += `<p class="note">Click a strand to debond, move or remove strands of its row; "+ Add strands" shows the 2 in grid slots where one more strand still fits (the input check: inside the concrete, 2 in from its edges, 1.25 in from a void). Each edit changes the table above and is one step of Undo. The draped strands are edited in the table.</p>`;
    if (ctx.msg) h += `<div class="alert err" role="alert" id="seErr">${esc(ctx.msg)}</div>`;
    if (log.length) h += `<div id="seLog" style="margin-top:8px;border:1px solid #CBD5E1;border-radius:5px"><div style="display:flex;justify-content:space-between;align-items:center;background:#F0FBF3;padding:4px 8px"><b style="font-size:9pt;color:#15803D">Strand edits from the graphic (${log.length})</b><button type="button" data-se="clearlog">Clear log</button></div>
      <div style="max-height:120px;overflow-y:auto;font-size:9pt">${log.map((e, i) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 8px${i ? '' : ';font-weight:600;color:#15803D'}"><span>${esc(e.msg)}</span><span style="color:#64748B">${esc(e.t)}</span></div>`).join('')}</div></div>`;
    return h;
  }
  function mount(host, ctx) {
    if (!host) return;
    if (S.sel != null && !ctx.rows[S.sel]) S.sel = null;
    const draw = () => { host.innerHTML = body(ctx); const f = host.querySelector('#seFig'); if (f) f.innerHTML = svg(ctx, Math.max(260, Math.min(520, (host.clientWidth || 420) - 4))); };
    draw();
    host.onclick = e => {
      const b = e.target.closest('[data-se]'); if (!b) return; e.preventDefault(); const a = b.dataset.se, key = ctx.scopeKey; ctx.msg = '';
      if (a === 'mode') { S.add = !S.add; S.sel = null; draw(); return; }
      if (a === 'view') { S.view = b.dataset.v; draw(); return; }
      if (a === 'done') { S.sel = null; draw(); return; }
      if (a === 'pick') { const ri = +b.dataset.ri; S.sel = S.sel === ri ? null : ri; S.add = false; draw(); return; }
      if (a === 'clearlog') { S.log[key] = []; draw(); return; }
      if (a === 'revert') { const st = S.start[key]; if (!st) return; if (typeof confirm === 'function' && !confirm('Revert every strand edit made on the graphic back to the starting layout?')) return;
        const log0 = S.log[key] || []; S.log[key] = [{ msg: 'Reverted the strand edits', t: new Date().toLocaleTimeString() }].concat(log0); delete S.start[key]; S.sel = null; S.add = false;
        const res = ctx.commit(copy(st), 'Reverted the strand edits'); if (res && res.err) { S.log[key] = log0; S.start[key] = st; ctx.msg = res.err; draw(); } return; }
      const op = { add: 'add', remove: 'remove', debond: 'debond', up: 'up', down: 'down', clear: 'clear' }[a]; if (!op) return;
      const r = apply(ctx.rows, op, { y: +b.dataset.y, i: S.sel, next: !!ctx.R.g.isNext, L: ctx.R.L });
      if (r.err) { ctx.msg = r.err; draw(); return; }
      if (ctx.fits && !ctx.fits(r.rows)) { ctx.msg = `Not changed: ${r.msg.replace(/^./, c => c.toLowerCase())} would put a strand outside the input check's strand fit (${ctx.fitWhy ? ctx.fitWhy(r.rows) : 'see the table'}).`; draw(); return; }
      if (!S.start[key]) S.start[key] = copy(ctx.rows);
      if (op === 'remove' && S.sel != null && !r.rows.some((q, j) => j === S.sel && Math.abs(+q.y - +ctx.rows[S.sel].y) < 1e-9)) S.sel = null;
      if (op === 'up' || op === 'down') { const y = r.rows.findIndex(q => q !== undefined && Math.abs(+q.y - Math.max(1, Math.round(+ctx.rows[S.sel].y + (op === 'up' ? 1 : -1)))) < 1e-9); S.sel = y >= 0 ? y : null; }
      const log0 = S.log[key] || []; S.log[key] = [{ msg: r.msg, t: new Date().toLocaleTimeString() }].concat(log0).slice(0, 50);   // before the commit: the page redraws this card
      const res = ctx.commit(r.rows, r.msg); if (res && res.err) { S.log[key] = log0; ctx.msg = res.err; draw(); }
    };
  }
  window.PSBStrandEdit = { apply, slots, card, mount, fitErrs, fitCtx, state: S };
})();
