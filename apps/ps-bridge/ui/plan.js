/* apps/ps-bridge/ui/plan.js — the framing plan of the bridge (window.PSBPlan). Classic script; display only: nothing here feeds a result.
   Created 2026-11-14 (PS Bridge catch-up to the Steel Bridge app, item 3: "a true-scale skewed framing Plan card replaces the placeholder";
   the Steel Bridge app's framing plan, apps/steel-bridge/ui/framing.js planSvg / layoutPlan, is the reference: one scale in both
   directions so a support line is drawn at its true skew, and a width exaggeration offered).

   model(P) (no DOM; tests/engine/psbridge-plan.test.mjs): every position from PSB3DUI.geom(P), the 3D view's geometry (the same numbers):
     girders: each girder type × line, ℄ bearing to ℄ bearing (xa … xb) and the girder ends (x0 … x1, opt.endOh past the bearing at the
       abutments), at z = the line's offset from G1 (the bays, unequal allowed); a line with no type in a span: listed (absent);
     supports: the skewed bearing lines (x = support station + (z − z_mid) tan θ; the Steel Bridge app's framing rule), from the left
       to the right deck edge, named Abut. 1, Pier 1 …, Abut. 2, with θ;
     diaphragms: as the 3D view: at a from each line's left ℄ bearing in each bay next to a line whose type has one (parallel to the
       supports; none between adjacent units), the continuity diaphragms on the pier lines of spans made continuous (5.12.3.3);
     deck outline: left and right deck edges between the skewed end lines.
   Units: inches (x along the bridge from Abut. 1 at the line midway between G1 and G<nb>, z across from G1), as geom.
   svg(P, W, o) -> { svg, m }: the plan at width W px, o = { vex: 1 | 2 (the width exaggerated: the angles not to scale; θ labels the
     true skew; the bay dimensions stay the true values) }. legend(m, vex) -> the caption. card(P) -> HTML: the Bridge layout tab's card (a
     slot #gfx_plan and the links to the related tabs); mount(slot, P, o) draws it there as a detail card with the True scale / Width ×2
     choice, kept for the page session only (not saved, as the Steel Bridge app's "Exaggerate the width"). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d == null ? 2 : d) : '—';
  const STATE = { vex: 1 };

  function model(P) {
    const G = window.PSB3DUI && window.PSB3DUI.geom(P), out = { errors: [], girders: [], missing: [], supports: [], dia: [], cont: [] };
    if (!G) { out.errors.push('No project.'); return out; }
    if (!G.girders.length) { out.errors = G.errors.length ? G.errors.slice() : ['No girder type on any line.']; return out; }
    const nb = G.nb, ns = G.ns, ys = G.ys.map(y => y * 12), zL = -G.ohL * 12, zR = (G.ys[nb - 1] + G.ohR) * 12;
    out.girders = G.girders.map(q => ({ s: q.s, g: q.g, k: q.k, label: q.label, z: q.z, xa: q.xa, xb: q.xb, x0: q.x0, x1: q.x1, col: q.col, girder: q.girder, L: q.L }));
    for (let s = 1; s <= ns; s++) for (let g = 1; g <= nb; g++) if (!out.girders.some(q => q.s === s && q.g === g)) out.missing.push({ s, g, z: ys[g - 1], xa: G.xb(s - 1, G.ys[g - 1]), xb: G.xb(s, G.ys[g - 1]) });
    out.supports = G.sup.map((st, k) => ({ k, name: k === 0 ? 'Abut. 1' : k === ns ? 'Abut. 2' : 'Pier ' + k, skew: G.skews[k], st: st * 12,
      a: [G.xb(k, -G.ohL), zL], b: [G.xb(k, G.ys[nb - 1] + G.ohR), zR] }));
    out.dia = G.dia.map(d => ({ s: d.s, bay: d.bay, a: d.a, p: [d.xa, d.za], q: [d.xc, d.zc] }));
    out.cont = G.cont.map(c => ({ k: c.k, p: [c.xa, c.za], q: [c.xc, c.zc] }));
    out.deck = [[G.deck.x[0], zL], [G.deck.x[1], zL], [G.deck.x[2], zR], [G.deck.x[3], zR]];
    Object.assign(out, { nb, ns, ys, zL, zR, spans: G.spans, cont0: P.spans.continuity === 'composite', types: G.types, bays: (P.xs.bays || []).map(Number), ohL: G.ohL, ohR: G.ohR });
    return out;
  }

  function svg(P, W, o) {
    o = o || {}; const vex = o.vex > 1 ? o.vex : 1, V = window.PSBVizKit, S = V.scene(), m = model(P), nar = W < 560, sz = nar ? 9.5 : 10.5;
    if (m.errors.length) return { svg: `<p class="note">${esc(m.errors.join(' '))}</p>`, m };
    const Y = z => -z * vex, pt = p => [p[0], Y(p[1])];   // plan: x right along the bridge, G1 at the top
    // deck outline
    S.poly(m.deck.map(pt), 'dt-cc', { op: 0.55 });
    // support lines (dashed), their names above and θ below
    m.supports.forEach(q => { const a = pt(q.a), b = pt(q.b); S.line(a[0], a[1], b[0], b[1], 'dt-hid', { sw: 1.2 });
      S.text(a[0], a[1], q.name, { a: 'middle', dy: -6, sz, cls: 'dt-m', halo: true }); S.text(b[0], b[1], `θ = ${f2(q.skew, 1)}°`, { a: 'middle', dy: sz + 4, sz });
      S.region(Math.min(a[0], b[0]) - 6, b[1], Math.max(a[0], b[0]) + 6, a[1], `${q.name}: skew θ = ${f2(q.skew, 2)}°, station ${f2(q.st / 12, 2)} ft on the bridge centreline`); });
    // continuity diaphragms on the pier lines (made continuous for composite loads)
    m.cont.forEach(c => { const a = pt(c.p), b = pt(c.q); S.line(a[0], a[1], b[0], b[1], 'xs-cd', { stroke: '#B45309', sw: 4 });
      S.region(Math.min(a[0], b[0]) - 4, b[1], Math.max(a[0], b[0]) + 4, a[1], `Continuity diaphragm on Pier ${c.k} (spans made continuous for composite loads, 5.12.3.3)`); });
    // intermediate diaphragms
    m.dia.forEach(d => { const a = pt(d.p), b = pt(d.q); S.line(a[0], a[1], b[0], b[1], 'xs-dia', { stroke: '#16304F', sw: 1.4 });
      S.region(Math.min(a[0], b[0]) - 3, b[1], Math.max(a[0], b[0]) + 3, a[1], `Diaphragm, span ${d.s}, bay G${d.bay}–G${d.bay + 1}, ${f2(d.a, 2)} ft from the left ℄ bearing`); });
    // girders: ℄ bearing to ℄ bearing in the type's colour, the ends past the bearings thinner; a line with no type dashed
    m.girders.forEach(q => { const y = Y(q.z);
      if (q.x0 < q.xa) S.line(q.x0, y, q.xa, y, 'xs-ge', { stroke: q.col, sw: 1.5 }); if (q.x1 > q.xb) S.line(q.xb, y, q.x1, y, 'xs-ge', { stroke: q.col, sw: 1.5 });
      S.line(q.xa, y, q.xb, y, 'xs-gl', { stroke: q.col === '#a9b4c2' ? '#64748B' : q.col, sw: 3 });
      S.region(q.xa, y - 4, q.xb, y + 4, `G${q.g}, span ${q.s}: ${q.label} (${q.girder}), ℄ bearing to ℄ bearing ${f2((q.xb - q.xa) / 12, 2)} ft (span ${f2(q.L, 2)} ft)`); });
    m.missing.forEach(q => { const y = Y(q.z); S.line(q.xa, y, q.xb, y, 'dt-cl'); S.region(q.xa, y - 4, q.xb, y + 4, `G${q.g}, span ${q.s}: no girder type (not checked)`); });
    // line names at the left
    const xL = Math.min(...m.supports.map(q => Math.min(q.a[0], q.b[0])));
    // each line's name where the lines are far enough apart for it, else G1 and the last line only
    S.raw(T => { const gap = m.nb > 1 ? Math.min(...m.ys.slice(1).map((z, i) => Math.abs(T.Y(Y(z)) - T.Y(Y(m.ys[i]))))) : 99, all = gap >= sz;
      return m.ys.map((z, i) => (all || i === 0 || i === m.nb - 1) ? `<text x="${T.X(xL) - 8}" y="${T.Y(Y(z)) + sz * 0.35}" text-anchor="end" class="dt-t" style="font-size:${sz}px" fill="#0F172A">G${i + 1}</text>` : '').join(''); },
      T => [[T.X(xL) - 8 - V.TW('G00', sz), T.Y(Y(m.zL))], [T.X(xL), T.Y(Y(m.zR))]]);
    // spans along the centreline, above the plan
    const yTop = Y(m.zL), zc = (m.ys[0] + m.ys[m.nb - 1]) / 2;
    m.spans.forEach((L, i) => { const a = m.supports[i].st, b = m.supports[i + 1].st; S.dimH(a, b, yTop, sz + 22, `Span ${i + 1}: ${f2(L, 2)} ft`, { yr: Y(zc), sz }); });
    // bays and overhangs at the right end (true values; exaggerated drawing)
    const xR = Math.max(...m.supports.map(q => Math.max(q.a[0], q.b[0])));
    const chain = [[m.zL, 0], ...m.ys.slice(1).map((z, i) => [m.ys[i], z]), [m.ys[m.nb - 1], m.zR]];
    // each bay where its drawn height takes its label, else the deck width only (the bays: the Cross-section tab)
    const dsz = nar ? 9 : 10, segs = chain.filter(([a, b]) => b - a > 1e-6);
    S.raw(T => { const px = T.X(xR) + 16, hpx = ([a, b]) => Math.abs(T.Y(Y(a)) - T.Y(Y(b))), bays = segs.slice(1, -1), roomy = bays.length > 0 && bays.every(q => hpx(q) >= dsz + 2), list = roomy ? segs : [[m.zL, m.zR]], o = [];
      list.forEach(([a, b]) => { const y0 = T.Y(Y(a)), y1 = T.Y(Y(b)), t = !roomy ? `${f2((b - a) / 12, 2)} ft deck` : hpx([a, b]) >= dsz + 2 ? f2((b - a) / 12, 2) : '';   // an overhang too short for its label: the tick only
        o.push(`<line x1="${px}" y1="${y0}" x2="${px}" y2="${y1}" stroke="#64748B" stroke-width="0.7"/><line x1="${px - 3}" y1="${y0 + 3}" x2="${px + 3}" y2="${y0 - 3}" stroke="#64748B"/><line x1="${px - 3}" y1="${y1 + 3}" x2="${px + 3}" y2="${y1 - 3}" stroke="#64748B"/>`,
          `<text x="${px + 5}" y="${(y0 + y1) / 2 + dsz * 0.35}" class="dt-t halo" style="font-size:${dsz}px" fill="#0F172A">${t}</text>`); });
      return o.join(''); }, T => { const px = T.X(xR) + 16, w = 5 + V.TW('00.00 ft deck', dsz); return [[px - 4, T.Y(Y(m.zL)) - dsz], [px + w, T.Y(Y(m.zR)) + dsz]]; });
    const r = S.render({ W, maxH: o.maxH || (nar ? 340 : 420), label: `Framing plan: girder lines, skewed supports and diaphragms${vex > 1 ? ', width exaggerated ×' + vex : ''}` });
    return { svg: r.svg, m };
  }
  function legend(m, vex) {
    if (!m || m.errors.length) return '';
    const sw = t => `<span style="display:inline-block;width:14px;height:4px;background:${t.col === '#a9b4c2' ? '#64748B' : t.col};vertical-align:2px;margin:0 3px 0 8px"></span>${esc(t.label)} (span ${t.span})`;
    return `<p class="vk-cap">${vex > 1 ? `Width exaggerated ×${vex}: the angles are not to scale; θ is the true skew of each support line; the dimensions are the true values.` : 'True scale in both directions: each support line is drawn at its skew θ from the normal to the girders.'} `
      + `Girder lines ℄ bearing to ℄ bearing in the type's colour${m.girders.some(q => q.x0 < q.xa - 1e-9) ? ' (thin: the girder end past the bearing)' : ''}:${m.types.map(sw).join('')}${m.missing.length ? `; dashed: no type (${m.missing.map(q => `G${q.g}/S${q.s}`).join(', ')})` : ''}. `
      + `Navy: diaphragms at their entered a from each line's left ℄ bearing (none between adjacent units)${m.cont.length ? '; brown: continuity diaphragms on the pier lines (made continuous, 5.12.3.3)' : ''}. Dashed grey: the bearing lines.</p>`;
  }
  /* card(P): the Bridge layout tab's Plan card (a slot; after() draws it at the panel's width) */
  function card(P) {
    if (!window.PSBVizKit) return '';
    return `<section class="sec" id="psbPlan"><div class="secHead">Plan</div><div class="secBody"><div id="gfx_plan"></div>
      <p class="note">Spans and skews: this tab. Girder lines, bays and overhangs: <a href="#" data-goin="xsec">Cross-section tab</a>. Girder types on the lines: <a href="#" data-goin="gird">Girders &amp; strands tab</a>. Diaphragms: <a href="#" data-goin="dd">Diaphragms / deck tab</a>. In 3D: <a href="#" data-gotab="3d">3D view</a>; the cross-section: <a href="#" data-gotab="lds">Loads &amp; LLDF</a>.</p></div></section>`;
  }
  /* mount(slot, P, o): the plan as a detail card (PSBVizKit.detCard: drawn at the slot's width, hover read-out, print width), with the
     True scale / Width ×2 choice (STATE.vex, the page session only); o = { id, title, seg (default true), maxH (px) } */
  function mount(slot, P, o) {
    const V = window.PSBVizKit; if (!slot || !V || !V.detCard) return null; o = o || {};
    let m = null; const H = V.detCard(slot, { id: o.id || 'planFig', title: o.title || 'Framing plan', sub: 'girder lines, supports and diaphragms',
      seg: o.seg === false ? null : { label: 'Width', items: [['1', 'True scale'], ['2', 'Width ×2']], cur: String(STATE.vex), on: k => { STATE.vex = +k > 1 ? 2 : 1; slot.querySelectorAll('[data-vkseg]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vkseg === String(STATE.vex)))); H.redraw(); const c = slot.querySelector('.vk-cap[data-plancap]'); if (c && m) c.outerHTML = cap(); } },
      draw: W => { const q = svg(P, W, { vex: o.seg === false ? 1 : STATE.vex, maxH: o.maxH }); m = q.m; return { html: q.svg, nar: W < 560 }; }, hint: 'Point at a girder, a support or a diaphragm to read it.' });
    const cap = () => legend(m, o.seg === false ? 1 : STATE.vex).replace('<p class="vk-cap">', '<p class="vk-cap" data-plancap>');
    if (H && m) H.el.insertAdjacentHTML('beforeend', cap());
    return H;
  }
  window.PSBPlan = { model, svg, legend, card, mount, STATE };
})();
