/* apps/ps-bridge/ui/xsfig.js — the whole-bridge cross-section figure (window.PSBXsFig). Classic script; display only: nothing here feeds a
   result. Created 2026-11-14 (PS Bridge catch-up to the Steel Bridge app, item 2: "real girder sections in the Loads & LLDF sketch and the
   Report figure"; the Steel Bridge app's LLDF cross-section, apps/steel-bridge/ui/gfxdet.js lldfSvg, is the reference for the style).

   model(P, s) (no DOM; tests/engine/psbridge-xsfig.test.mjs): span s of the bridge across the girder lines, every dimension read from the
   project and the moved engine's own geometry, no calculation result:
     girders: each girder type on each of its lines in span s (PSB3DUI.geom: girderGross → halfPolygon, sectionVoids; I-girders, bulb-tees,
       NEXT (both stems), box beams and voided slabs with their voids, solid slabs) at the line's offset from the left deck edge
       (PSBModel.girderOffsets: the bays, unequal allowed); a line with no type in span s: listed in missing (drawn as a dashed ℄ only);
     deck t_s (the largest of the span's types) from the left to the right deck edge, its soffit on the deepest girder + haunch; the haunch
       t_h over each girder's top width (not for box and deck beams, as the engine);
     barriers and sidewalks of the Cross-section tab (P.xs.dl; without it the base design's barrier width): the barrier at the deck edge,
       width bw (= the traffic face), height schematic (BAR_H, Decision XS-D1); a sidewalk slab w × t from the deck edge (the convention of
       engine/bridge-dl.js dead(): x0 = 0, x1 = w), the barrier on it;
     traffic faces and d_e of the two exterior lines: PSBDesign.deOf (PS-20: the overhang − the barrier / curb face) when the project has
       the cross-section barriers, else the d_e entered for the type on that line (base.loads.de, as the engine takes it).
   Units: inches; x from the left deck edge, y up (0 = the soffit of the deepest girder).
   svg(P, s, W, o) -> { svg, nar, m }: the drawing at width W px, true scale (one scale across and up), o = { shown: line g outlined,
     label }. legend(m) -> HTML: the type colours. */
(function () {
  'use strict';
  const BAR_H = 32;   // in, the barrier height drawn (schematic; Decision XS-D1)
  const TCOL = ['#a9b4c2', '#c9a27e', '#9fb89a', '#c2a3c4', '#d1c38a', '#8fb3c9', '#c79494', '#a6a6a6'];   // the 3D view's type colours
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d == null ? 2 : d) : '—';
  const KIND = { i: 'I-girder', next: 'NEXT', box: 'box beam', deck: 'deck slab' };

  function model(P, s) {
    const out = { errors: [], girders: [], missing: [], haunch: [], app: [], faces: [], s };
    const G = window.PSB3DUI && window.PSB3DUI.geom(P), M = window.PSBModel, DS = window.PSBDesign, BR = window.PSBBridge;
    if (!G || !M) { out.errors.push('No project.'); return out; }
    if (G.errors.length && !G.girders.length) { out.errors = G.errors.slice(); return out; }
    const nb = G.nb, off = M.girderOffsets(P).map(x => x * 12), Wd = off[nb - 1] + (+P.xs.ohR || 0) * 12;
    const gs = G.girders.filter(q => q.s === s);
    if (!gs.length) { out.errors.push(`No girder type on any line of span ${s}.`); return out; }
    const yD = Math.max(...gs.map(q => q.h + q.th)), ts = Math.max(...gs.map(q => q.ts)), yTop = yD + ts;
    gs.forEach(q => {
      const x = off[q.g - 1], yb = yD - q.th - q.h, half = q.half, sideR = half.map(p => [x + p[0], yb + p[1]]), sideL = half.slice().reverse().map(p => [x - p[0], yb + p[1]]);
      const kind = q.kind === 'deck' && q.gg && q.gg.box && q.gg.box.solid ? 'solid' : q.kind;
      out.girders.push({ g: q.g, k: q.k, label: q.label, girder: q.girder, kind, x, yBot: yb, yTop: yb + q.h, h: q.h, th: q.th, top: q.top, bot: q.bot,
        poly: sideR.concat(sideL), voids: (q.voids || []).map(v => Object.assign({}, v, { x: x + v.x, y: yb + v.y })), col: TCOL[q.k % TCOL.length] });
      if (q.th > 0) out.haunch.push({ g: q.g, x0: x - q.top / 2, x1: x + q.top / 2, y0: yb + q.h, y1: yD });
    });
    for (let g = 1; g <= nb; g++) if (!gs.some(q => q.g === g)) out.missing.push({ g, x: off[g - 1] });
    // barriers and sidewalks (Cross-section tab, P.xs.dl; without it the base design's barrier base width, in)
    const dl = P.xs.dl;
    ['L', 'R'].forEach(sd => {
      const bw = dl ? (+((dl['bar' + sd] || {}).bw) || 0) * 12 : (+((P.base && P.base.deck && P.base.deck.bBar) || 0));
      const sw = dl ? (dl['sw' + sd] || {}) : {}, w = (+sw.w || 0) * 12, t = w > 0 ? (+sw.t || 0) : 0;
      const at = d => sd === 'L' ? d : Wd - d;   // a distance from this side's deck edge → x
      if (w > 0 && t > 0) out.app.push({ kind: 'sw', side: sd, x0: Math.min(at(0), at(w)), x1: Math.max(at(0), at(w)), y0: yTop, y1: yTop + t, w, t });
      if (bw > 0) { const yb = yTop + (w > 0 && t > 0 && w >= bw ? t : 0); out.app.push({ kind: 'bar', side: sd, x0: Math.min(at(0), at(bw)), x1: Math.max(at(0), at(bw)), y0: yb, y1: yb + BAR_H, bw, edge: at(0), inner: at(bw) }); }
    });
    // traffic faces and d_e of the exterior lines (PS-20 deOf; else the entered d_e of the type on that line)
    [[1, 'L'], [nb, 'R']].forEach(([g, sd]) => {
      if (sd === 'R' && nb === 1) return;
      let de = DS && DS.deOf ? DS.deOf(P, g) : null, src = 'cross-section (PS-20)';
      if (de == null) { const q = gs.find(z => z.g === g); de = q ? +q.inp.loads.de : NaN; src = 'entered (Loads tab)'; }
      if (!isFinite(de)) return;
      const xg = off[g - 1], xf = sd === 'L' ? xg - de * 12 : xg + de * 12;
      out.faces.push({ g, side: sd, de, x: xf, xg, src });
    });
    Object.assign(out, { nb, off, Wd, yD, ts, yTop, ohL: (+P.xs.ohL || 0) * 12, ohR: (+P.xs.ohR || 0) * 12, bays: (P.xs.bays || []).map(b => +b * 12),
      types: (BR ? BR.types(P) : []).map((t, k) => ({ k, label: t.label, span: t.span, col: TCOL[k % TCOL.length] })).filter(t => t.span === s && gs.some(q => q.k === t.k)) });
    return out;
  }

  function svg(P, s, W, o) {
    o = o || {}; const V = window.PSBVizKit, S = V.scene(), m = model(P, s), nar = W < 560;
    if (m.errors.length) return { svg: `<p class="note">${esc(m.errors.join(' '))}</p>`, nar, m };
    const ft = v => `${f2(v / 12, 2)} ft`, sz = nar ? 10 : 11;
    // deck and haunches
    S.rect(0, m.yD, m.Wd, m.yTop, 'dt-cc');
    S.region(0, m.yD, m.Wd, m.yTop, `Deck: t_s = ${f2(m.ts, 2)} in, ${ft(m.Wd)} wide`);
    m.haunch.forEach(q => S.rect(q.x0, q.y0, q.x1, q.y1, 'dt-cc', { op: 0.85 }));
    // barriers (schematic profile: the traffic face sloped, Decision XS-D1) and sidewalks
    m.app.filter(a => a.kind === 'sw').forEach(a => { S.rect(a.x0, a.y0, a.x1, a.y1, 'dt-cc'); S.region(a.x0, a.y0, a.x1, a.y1, `${a.side === 'L' ? 'Left' : 'Right'} sidewalk ${ft(a.w)} × ${f2(a.t, 1)} in`); });
    m.app.filter(a => a.kind === 'bar').forEach(a => {
      const e = a.edge, i = a.inner, d = i - e, H = a.y1 - a.y0, y0 = a.y0;
      S.poly([[e, y0], [i, y0], [i - 0.25 * d, y0 + 0.25 * H], [e + 0.45 * d, y0 + H], [e, y0 + H]], 'dt-cc');
      S.region(a.x0, a.y0, a.x1, a.y1, `${a.side === 'L' ? 'Left' : 'Right'} barrier: ${ft(a.bw)} wide at the deck (the traffic face); height drawn ${BAR_H} in (schematic)`);
    });
    // girders: the library outline at the line's offset, voids white
    m.girders.forEach(q => {
      const on = o.shown === q.g;
      S.poly(q.poly, 'xs-g', { fill: q.col, stroke: on ? V.DPAL.gov : '#475569', sw: on ? 2 : 0.8 });
      q.voids.forEach(v => { if (v.type === 'rect') S.rect(v.x - v.w / 2, v.y - v.h / 2, v.x + v.w / 2, v.y + v.h / 2, 'xs-v', { fill: '#fff', stroke: '#475569', sw: 0.6 }); else S.circ(v.x, v.y, v.d / 2, 'xs-v', { fill: '#fff', stroke: '#475569', sw: 0.6 }); });
      S.region(q.x - Math.max(q.top, q.bot) / 2, q.yBot, q.x + Math.max(q.top, q.bot) / 2, q.yTop, `G${q.g}: ${q.label}, ${q.girder} (${KIND[q.kind] || q.kind}), h = ${f2(q.h, 2)} in, at ${ft(q.x)} from the left deck edge${on ? ' (shown on the output tabs)' : ''}`);
    });
    const yMin = Math.min(...m.girders.map(q => q.yBot));
    m.missing.forEach(q => { S.line(q.x, yMin, q.x, m.yD, 'dt-cl'); S.region(q.x - 6, yMin, q.x + 6, m.yD, `G${q.g}: no girder type in span ${s} (not checked)`); });
    // line names under the girders
    m.off.forEach((x, i) => S.text(x, yMin, `G${i + 1}`, { a: 'middle', dy: sz + 4, sz, w: o.shown === i + 1, cls: o.shown === i + 1 ? 'dt-g' : 'dt-t' }));
    // the chain under the girders: overhangs and bays (true values)
    const ch = [[0, m.off[0]], ...m.off.slice(1).map((x, i) => [m.off[i], x]), [m.off[m.nb - 1], m.Wd]];
    ch.forEach(([a, b]) => { if (b - a > 1e-6) S.dimH(a, b, yMin, -(sz + 30), f2((b - a) / 12, 2), { yr: yMin, sz }); });
    // traffic faces (dashed) and d_e of each exterior line, above the barriers
    const yA = Math.max(m.yTop, ...m.app.map(a => a.y1));
    m.faces.forEach(f => { S.line(f.x, m.yTop, f.x, yA + 6, 'dt-tf');
      const a = Math.min(f.x, f.xg), b = Math.max(f.x, f.xg), lab = `d_e = ${f2(f.de, 2)} ft`;
      S.dimH(a, b, yA, 16, lab, { yr: m.yTop, sz });
      S.region(a, m.yTop, b, yA, `G${f.g}: d_e = ${f2(f.de, 3)} ft, ${f.side === 'L' ? 'left' : 'right'} traffic face (${f.src}); positive when the girder ℄ is inside the face`); });
    // the deck width over all
    S.dimH(0, m.Wd, yA, nar ? 44 : 46, `Deck ${ft(m.Wd)}`, { yr: m.yTop, sz });
    // deck thickness and haunch: a callout at the right deck edge
    const hq = m.haunch[0];
    S.callout(m.Wd, (m.yD + m.yTop) / 2, 14, -18, [`t_s = ${f2(m.ts, 2)} in`].concat(hq ? [`haunch ${f2(hq.y1 - hq.y0, 2)} in`] : []), { sz: nar ? 9.5 : 10.5 });
    const r = S.render({ W, maxH: o.maxH || (nar ? 300 : 340), label: o.label || `Bridge cross-section, span ${s}: the girder sections at their offsets, deck, barriers, traffic faces and d_e` });
    return { svg: r.svg, nar, m };
  }
  /* the type colours, the scale and the schematic items (the figure's caption) */
  function legend(m) {
    if (!m || m.errors.length) return '';
    const sw = t => `<span style="display:inline-block;width:11px;height:11px;border:1px solid #475569;background:${t.col};vertical-align:-1px;margin:0 3px 0 8px"></span>${esc(t.label)}`;
    return `<p class="vk-cap">Span ${m.s}, looking ahead. Girder types: ${m.types.map(sw).join('')}${m.missing.length ? `; no type on ${m.missing.map(q => 'G' + q.g).join(', ')} (dashed ℄, not checked)` : ''}. `
      + `Drawn to scale (one scale across and up; dimensions in ft); the girder outlines and voids are the library's; the barrier height (${BAR_H} in) and its profile are schematic. `
      + `Traffic faces dashed; d<sub>e</sub> from the exterior girder ℄ to the face (${m.faces.map(f => `G${f.g}: ${esc(f.src)}`).join('; ')}).</p>`;
  }
  window.PSBXsFig = { model, svg, legend, BAR_H, TCOL };
})();
