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
  const RAIL_H = 42, POST = 3;   // in, a railing or fence post drawn (schematic; PR 9, Decision XS9-D4)
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
    out.girders.sort((a, b) => a.g - b.g);
    for (let g = 1; g <= nb; g++) if (!gs.some(q => q.g === g)) out.missing.push({ g, x: off[g - 1] });
    // barriers and sidewalks (Cross-section tab, P.xs.dl; without it the base design's barrier base width, in)
    const dl = P.xs.dl;
    ['L', 'R'].forEach(sd => {
      const bw = dl ? (+((dl['bar' + sd] || {}).bw) || 0) * 12 : (+((P.base && P.base.deck && P.base.deck.bBar) || 0));
      const sw = dl ? (dl['sw' + sd] || {}) : {}, w = (+sw.w || 0) * 12, t = w > 0 ? (+sw.t || 0) : 0;
      const at = d => sd === 'L' ? d : Wd - d;   // a distance from this side's deck edge → x
      if (w > 0 && t > 0) out.app.push({ kind: 'sw', side: sd, x0: Math.min(at(0), at(w)), x1: Math.max(at(0), at(w)), y0: yTop, y1: yTop + t, w, t });
      const e = dl ? (dl['bar' + sd] || {}) : {}, onSw = d => w > 0 && t > 0 && d <= w + 1e-9 ? t : 0;   // on the sidewalk slab where it is under
      if (e.type === 'curb') {   // PR 9: a curb (c_w × c_h) and its railing at its load point (the post drawn schematic: RAIL_H)
        const cw = +e.cw || 0, ch = +e.ch || 0, rp = (+e.rp || 0) * 12, y = yTop + onSw(cw);
        if (cw > 0 && ch > 0) out.app.push({ kind: 'curb', side: sd, x0: Math.min(at(0), at(cw)), x1: Math.max(at(0), at(cw)), y0: y, y1: y + ch, cw, ch });
        if (+e.rw > 0) { const yr = yTop + Math.max(onSw(rp), rp <= cw + 1e-9 ? onSw(cw) + ch : 0); out.app.push({ kind: 'rail', side: sd, x0: at(rp) - POST / 2, x1: at(rp) + POST / 2, y0: yr, y1: yr + RAIL_H, rp, rw: +e.rw }); }
      } else if (bw > 0) { const yb = yTop + (w > 0 && t > 0 && w >= bw ? t : 0); out.app.push({ kind: 'bar', side: sd, x0: Math.min(at(0), at(bw)), x1: Math.max(at(0), at(bw)), y0: yb, y1: yb + BAR_H, bw, edge: at(0), inner: at(bw) }); }
      const fx = (+sw.fenceX || 0) * 12;   // PR 9: a railing or fence on the sidewalk
      if (w > 0 && fx > 0 && (+sw.fence > 0 || sw.fence == null)) out.app.push({ kind: 'fence', side: sd, x0: at(fx) - POST / 2, x1: at(fx) + POST / 2, y0: yTop + t, y1: yTop + t + RAIL_H, fx });
    });
    const md = dl && dl.med; if (md && +md.w > 0 && +md.t > 0) out.app.push({ kind: 'med', x0: Wd / 2 - md.w * 6, x1: Wd / 2 + md.w * 6, y0: yTop, y1: yTop + +md.t, w: md.w * 12, t: +md.t, joint: !!md.joint });   // PR 9: the raised median
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

  /* lldf(P, s, g, inp, df): 2026-11-14 (PS Bridge catch-up, item 7; the Steel Bridge app's LLDF cross-section, apps/steel-bridge/ui/gfxdet.js
     lldfModel): the lanes, wheels and lever-rule influence line of line g's live-load distribution case, placed as the moved engine places
     them (engine/pbd-lldf-flexure.js distFactors, which returns only the values). No DOM; tests/engine/psbridge-lldffig.test.mjs.
       Lever rule (exterior I-girder, one lane, m = 1.2; 4.6.2.2.2d): wheels 6 ft apart, the outer one 2 ft inboard of the traffic face:
         x_w = d_e − 2 and d_e − 8 ft outboard of the exterior girder ℄; reaction ordinate (S + x_w) / S (1.0 at the exterior girder, 0 at
         the next girder S away), counted where x_w > −S; g_lever = 1.2 Σ 0.5 (S + x_w) / S. S, d_e: the engine's inputs of line g (inp.S,
         inp.loads.de).
       Rigid cross-section (C4.6.2.2.2d): N_L lanes of 12 ft from the traffic face (N_L = the engine's governing count, rigidNL), the lane
         resultant 5 ft inboard of the face plus 12 j; e_j its distance from the girder centroid toward the exterior girder (= X_ext + d_e − 5
         − 12 j); R = m (N_L / N_b + X_ext Σe / Σx²) with m = 1.2, 1.0, 0.85, 0.65; the girder positions the engine uses (equal bays: the
         lines; unequal bays: df.rigidX, PS-19).
       None: an interior girder (the equations), NEXT (types (i) / (j): no lever rule in the engine), box beams and slabs (types (f) / (g),
         PS-35: no lever rule and no rigid-section check). Returns { kind: 'ext' | 'int' | 'next' | 'fg', note, cases: [...] } (positions in
         inches from the left deck edge, as model()). */
  const MPF = [1.2, 1.0, 0.85, 0.65];
  function lldf(P, s, g, inp, df) {
    const m = model(P, s), out = { kind: 'int', note: '', cases: [], m };
    if (m.errors.length || !df) { out.note = m.errors.join(' '); return out; }
    if (df.fg) { out.kind = 'fg'; out.note = `Box beams and slabs, cross-section type (${df.fg.type}) (PS-35): the distribution factors are the AASHTO equations of Tables 4.6.2.2.2b-1, 4.6.2.2.2d-1 and 4.6.2.2.3a-1 with the multiple presence in them; no lever rule and no rigid-section check, so no wheels are placed.`; return out; }
    if (df.isNext) { out.kind = 'next'; out.note = 'NEXT beams, cross-section types (i) / (j): the engine uses the AASHTO equations on the beam width; it applies no lever rule and no rigid-section check, so no wheels are placed.'; return out; }
    if (!df.ext) { out.note = `G${g} is an interior girder: the distribution factors are the AASHTO equations (Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1); no lever rule or rigid-section check, so no wheels are placed.`; return out; }
    out.kind = 'ext';
    const nb = m.nb, side = g === nb && g !== 1 ? 'R' : 'L', dir = side === 'L' ? 1 : -1;   // dir: inboard (+x for the left girder)
    const S = +inp.S, de = +inp.loads.de || 0, xg = m.off[g - 1], xf = xg - dir * de * 12, xa = xg + dir * S * 12;   // girder, traffic face, the next girder (S away)
    const xOut = x => dir * (xg - x) / 12;   // ft outboard of the exterior girder ℄
    const ord = x => { const xo = xOut(x); return xo > -S ? (S + xo) / S : 0; };
    const roadL = Math.min(...m.faces.map(f => f.x)), roadR = Math.max(...m.faces.map(f => f.x));
    // lever rule, one lane
    const wl = [2, 8].map(d => xf + dir * d * 12), terms = wl.map(x => ({ x, xo: xOut(x), ord: ord(x), on: xOut(x) > -S }));
    const lever = 1.2 * terms.reduce((a, t) => a + (t.on ? 0.5 * t.ord : 0), 0);
    out.cases.push({ key: 'lever', label: 'Lever rule, one lane', m: 1.2, lanes: [[xf, xf + dir * 144].sort((a, b) => a - b)], wheels: wl, terms, value: lever, engine: df.lever, S, de, xg, xa, xf, side, dir, il: true });
    // rigid section, the governing number of lanes
    const NL = Math.max(1, +df.rigidNL || 1), X = df.rigidX ? df.rigidX.x.map(v => (v + (+P.xs.ohL || 0)) * 12) : m.off.slice();
    const xbar = X.reduce((a, v) => a + v, 0) / nb, Xext = Math.abs(xg - xbar) / 12, sumX2 = X.reduce((a, v) => a + ((v - xbar) / 12) ** 2, 0);
    const lanes = [], wheels = [], res = [];
    for (let j = 0; j < NL; j++) { const a = xf + dir * 144 * j, b = a + dir * 144; lanes.push([a, b].sort((p, q) => p - q)); wheels.push(a + dir * 24, a + dir * 96); res.push(a + dir * 60); }
    const e = res.map(x => dir * (xbar - x) / 12), sumE = e.reduce((a, v) => a + v, 0), mp = MPF[NL - 1], rigid = mp * (NL / nb + Xext * sumE / sumX2);
    out.cases.push({ key: 'rigid', label: `Rigid section, ${NL} lane${NL > 1 ? 's' : ''}`, m: mp, NL, nb, lanes, wheels, res, e, sumE, Xext, sumX2, xbar, value: rigid, engine: df.rigid, side, dir, xg, xf, unequal: !!df.rigidX });
    out.road = [roadL, roadR];
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
    // PR 9: curbs, railings, fences, the median (schematic heights of the posts)
    m.app.filter(a => a.kind === 'curb' || a.kind === 'med').forEach(a => { S.rect(a.x0, a.y0, a.x1, a.y1, 'dt-cc');
      S.region(a.x0, a.y0, a.x1, a.y1, a.kind === 'curb' ? `${a.side === 'L' ? 'Left' : 'Right'} curb ${f2(a.cw, 1)} × ${f2(a.ch, 1)} in` : `Raised median ${ft(a.w)} × ${f2(a.t, 1)} in${a.joint ? ', longitudinal joint' : ''}`); });
    m.app.filter(a => a.kind === 'rail' || a.kind === 'fence').forEach(a => { S.rect(a.x0, a.y0, a.x1, a.y1, 'xs-post', { fill: '#64748b', stroke: '#334155', sw: 0.6 });
      S.region(a.x0, a.y0, a.x1, a.y1, a.kind === 'rail' ? `${a.side === 'L' ? 'Left' : 'Right'} railing at ${ft(a.rp)} from the deck edge, ${f2(a.rw, 3)} klf (height drawn ${RAIL_H} in, schematic)` : `${a.side === 'L' ? 'Left' : 'Right'} sidewalk railing or fence at ${ft(a.fx)} from the deck edge (height drawn ${RAIL_H} in, schematic)`); });
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
    // traffic faces (dashed) and d_e of each exterior line, above the barriers (with a live-load case: above its lanes and wheels)
    const yA = Math.max(m.yTop, ...m.app.map(a => a.y1)), C = o.ll || null, up = C ? 64 : 0;
    m.faces.forEach(f => { S.line(f.x, m.yTop, f.x, yA + 6, 'dt-tf');
      const a = Math.min(f.x, f.xg), b = Math.max(f.x, f.xg), lab = `d_e = ${f2(f.de, 2)} ft`;
      if (b - a >= 1) S.dimH(a, b, yA, 16 + up, lab, { yr: m.yTop, sz });
      else S.text(f.x, yA, lab, { a: f.side === 'L' ? 'start' : 'end', dx: f.side === 'L' ? 4 : -4, dy: -10 - up, sz });   // d_e ≈ 0: the face at the girder ℄
      S.region(a, m.yTop, b, yA, `G${f.g}: d_e = ${f2(f.de, 3)} ft, ${f.side === 'L' ? 'left' : 'right'} traffic face (${f.src}); positive when the girder ℄ is inside the face`); });
    // the deck width over all
    S.dimH(0, m.Wd, yA, (nar ? 44 : 46) + up, `Deck ${ft(m.Wd)}`, { yr: m.yTop, sz });
    if (C) drawLL(S, m, C, yA, yMin, sz, nar);
    // deck thickness and haunch: a callout at the right deck edge
    const hq = m.haunch[0];
    S.callout(m.Wd, (m.yD + m.yTop) / 2, 14, -18, [`t_s = ${f2(m.ts, 2)} in`].concat(hq ? [`haunch ${f2(hq.y1 - hq.y0, 2)} in`] : []), { sz: nar ? 9.5 : 10.5 });
    const r = S.render({ W, maxH: o.maxH || (nar ? 300 : 340), label: o.label || `Bridge cross-section, span ${s}: the girder sections at their offsets, deck, barriers, traffic faces and d_e` });
    return { svg: r.svg, nar, m };
  }
  /* drawLL(S, m, C, yA, yMin, sz, nar): a live-load case of lldf() on the cross-section: the lanes (12 ft) and wheels (arrows to the deck) above
     the barriers, the traffic faces carried up; the lever rule's influence line of the exterior girder under the chain, its ordinates under
     the wheels (the Steel Bridge app's lldfSvg layout). */
  function drawLL(S, m, C, yA, yMin, sz, nar) {
    const V = window.PSBVizKit, r2 = v => +(+v).toFixed(2), txt = (x, y, t, a, cls, w) => `<text x="${r2(x)}" y="${r2(y)}"${a ? ` text-anchor="${a}"` : ''} class="${cls || 'dt-t'} halo" style="font-size:${sz}px"${w ? ' font-weight="600"' : ''} fill="${cls === 'dt-m' ? '#475569' : '#0F172A'}">${esc(t)}</text>`;
    const rL = 46, rW = 26;   // px above yA: the lane row, the wheel row
    m.faces.forEach(f => S.raw(T => `<line x1="${r2(T.X(f.x))}" y1="${r2(T.Y(yA))}" x2="${r2(T.X(f.x))}" y2="${r2(T.Y(yA) - rL - 10)}" class="dt-tf" fill="none" stroke="#15803D" stroke-width="1" stroke-dasharray="6 3"/>`, T => [[T.X(f.x) - 1, T.Y(yA) - rL - 10], [T.X(f.x) + 1, T.Y(yA)]]));
    C.lanes.forEach(([a, b], i) => S.raw(T => { const x0 = T.X(a), x1 = T.X(b), y = T.Y(yA) - rL; return `<rect x="${r2(x0 + 1)}" y="${r2(y - 9)}" width="${r2(Math.max(2, x1 - x0 - 2))}" height="18" rx="3" class="dt-lane" fill="#EEF2F7" stroke="#CBD5E1"/>` + txt((x0 + x1) / 2, y + 4, C.e ? (nar ? `e = ${f2(C.e[i], 2)}` : `Lane ${i + 1}: e = ${f2(C.e[i], 2)} ft`) : (nar ? `L${i + 1}` : `Lane ${i + 1}`), 'middle', 'dt-m')
      + `<rect x="${r2(x0)}" y="${r2(y - 9)}" width="${r2(x1 - x0)}" height="18" class="dt-reg" fill="transparent" data-dtr="${esc(`Lane ${i + 1}: 12 ft from ${i ? 'the lane before it' : 'the traffic face'}`)}"/>`; }, T => [[T.X(a), T.Y(yA) - rL - 10], [T.X(b), T.Y(yA) - rL + 10]]));
    C.wheels.forEach((x, i) => S.raw(T => { const px = T.X(x), py = T.Y(m.yTop), yt = T.Y(yA) - rW; return `<circle cx="${r2(px)}" cy="${r2(yt)}" r="5" class="dt-wh xs-wh" fill="#0F172A"/><line x1="${r2(px)}" y1="${r2(yt + 5)}" x2="${r2(px)}" y2="${r2(py - 7)}" class="dt-ld" stroke="#1E3A5F" stroke-width="1.4"/><polygon points="${r2(px)},${r2(py)} ${r2(px - 3.5)},${r2(py - 7)} ${r2(px + 3.5)},${r2(py - 7)}" class="dt-ldh" fill="#1E3A5F"/>`
      + `<rect x="${r2(px - 6)}" y="${r2(yt - 6)}" width="12" height="${r2(py - yt + 6)}" class="dt-reg" fill="transparent" data-dtr="${esc(`Wheel ${i + 1}: ${f2(Math.abs(x - C.xf) / 12, 2)} ft inboard of the traffic face${C.terms ? `; ordinate ${f2(C.terms[i].ord, 3)}` : ''}`)}"/>`; },
      T => [[T.X(x) - 6, T.Y(yA) - rW - 6], [T.X(x) + 6, T.Y(m.yTop)]]));
    if (C.res) C.res.forEach((x, j) => S.raw(T => { const px = T.X(x), y = T.Y(yA) - rW; return `<line x1="${r2(px)}" y1="${r2(y - 8)}" x2="${r2(px)}" y2="${r2(y + 8)}" class="xs-res" stroke="#B45309" stroke-width="1.6"/><rect x="${r2(px - 5)}" y="${r2(y - 8)}" width="10" height="16" class="dt-reg" fill="transparent" data-dtr="${esc(`Lane ${j + 1} resultant: 5 ft inside the lane edge, e = ${f2(C.e[j], 3)} ft from the girder centroid`)}"/>`; }, T => [[T.X(x) - 5, T.Y(yA) - rW - 8], [T.X(x) + 5, T.Y(yA) - rW + 8]]));
    if (!C.il) return;
    // the lever rule's influence line of the exterior girder: 1.0 at it, 0 at the next girder (S away), linear, 0 beyond; ordinates at the wheels
    const ilx = x => { const xo = C.dir * (C.xg - x) / 12; return xo > -C.S ? (C.S + xo) / C.S : 0; };
    const edge = C.dir > 0 ? 0 : m.Wd, far = C.dir > 0 ? m.Wd : 0, pts = [edge, C.xg, C.xa, far], vmax = Math.max(1, ilx(edge)), U = nar ? 34 : 42;
    S.raw(T => { const y0 = T.Y(yMin) + sz + 30 + 34 + vmax * U, Yv = v => y0 - v * U, o = [];
      o.push(`<polygon points="${pts.map(x => r2(T.X(x)) + ',' + r2(Yv(ilx(x)))).join(' ')} ${r2(T.X(far))},${r2(y0)} ${r2(T.X(edge))},${r2(y0)}" class="dt-ilf" fill="#F3EEFF"/>`,
        `<line x1="${r2(T.X(0))}" y1="${r2(y0)}" x2="${r2(T.X(m.Wd))}" y2="${r2(y0)}" class="dt-ext" stroke="#CBD5E1"/>`, `<polyline points="${pts.map(x => r2(T.X(x)) + ',' + r2(Yv(ilx(x)))).join(' ')}" class="dt-il" fill="none" stroke="#7C3AED" stroke-width="1.4"/>`);
      [[C.xg, 1, `1.0 (G${C.side === 'L' ? 1 : m.nb})`], [C.xa, 0, '0']].forEach(([x, v, t]) => o.push(`<circle cx="${r2(T.X(x))}" cy="${r2(Yv(v))}" r="3.5" class="dt-pl" fill="#fff" stroke="#7C3AED"/>`, txt(T.X(x) + C.dir * 6, Yv(v) - 6, t, C.dir > 0 ? 'start' : 'end', 'dt-m')));
      C.terms.forEach((q, i) => { const px = T.X(q.x), py = Yv(q.ord); o.push(`<line x1="${r2(px)}" y1="${r2(y0)}" x2="${r2(px)}" y2="${r2(py)}" class="dt-il" stroke="#7C3AED" stroke-width="1" stroke-dasharray="3 2"/><circle cx="${r2(px)}" cy="${r2(py)}" r="3" fill="#7C3AED" class="dt-band"/>`,
        txt(px + C.dir * 5, py + 14 + i * 12, q.on ? f2(q.ord, 3) : '0 (beyond the next girder)', C.dir > 0 ? 'start' : 'end', 'dt-t', true), `<rect x="${r2(px - 7)}" y="${r2(py - 7)}" width="14" height="14" class="dt-reg" fill="transparent" data-dtr="${esc(`Wheel ${i + 1}: x = ${f2(q.xo, 3)} ft outboard of the girder ℄, ordinate (S + x) / S = ${f2(q.ord, 4)}${q.on ? '' : ' (not counted: beyond the next girder)'}`)}"/>`); });
      o.push(txt(T.X(0), T.Y(yMin) + sz + 30 + 24, nar ? `Lever-rule influence line (S = ${f2(C.S, 3)} ft)` : `Influence line of the exterior girder (lever rule about the next girder, S = ${f2(C.S, 3)} ft); ordinates under the wheels`, 'start', 'dt-m'));
      return o.join(''); }, T => { const y0 = T.Y(yMin) + sz + 30 + 34 + vmax * U; return [[T.X(0), T.Y(yMin) + sz + 30 + 10], [T.X(m.Wd), y0 + 2 * 12 + 14]]; });
  }
  /* the type colours, the scale and the schematic items (the figure's caption) */
  function legend(m) {
    if (!m || m.errors.length) return '';
    const sw = t => `<span style="display:inline-block;width:11px;height:11px;border:1px solid #475569;background:${t.col};vertical-align:-1px;margin:0 3px 0 8px"></span>${esc(t.label)}`;
    return `<p class="vk-cap">Span ${m.s}, looking ahead. Girder types: ${m.types.map(sw).join('')}${m.missing.length ? `; no type on ${m.missing.map(q => 'G' + q.g).join(', ')} (dashed ℄, not checked)` : ''}. `
      + `Drawn to scale (one scale across and up; dimensions in ft); the girder outlines and voids are the library's; the barrier height (${BAR_H} in) and its profile are schematic${m.app.some(a => a.kind === 'rail' || a.kind === 'fence') ? `, as are the railing and fence posts (${RAIL_H} in)` : ''}. `
      + `Traffic faces dashed; d<sub>e</sub> from the exterior girder ℄ to the face (${m.faces.map(f => `G${f.g}: ${esc(f.src)}`).join('; ')}).</p>`;
  }
  window.PSBXsFig = { model, svg, legend, lldf, BAR_H, TCOL };
})();
