/* apps/ps-bridge/ui/strands.js — the strand-pattern graphic (window.PSBStrandGfx). Classic script; display only. Created 2026-11-12 (PR 2c-1,
   docs/ps-bridge-plan.md §2.2 / §2.3: the strand pattern redrawn in the steel style, PS-5 / PS-13). Drawn with the steel app's detail kit
   (PSBVizKit.scene / detCard, a copy). Every dimension is the engine's (computeAll R: R.ss strand system, R.g girder, R.L span); nothing
   is calculated here except drawing positions.
     Elevation (vertical scale exaggerated): ℄ bearings, girder ends (overhang opt.endOh), the straight rows (debonded lengths dashed),
       the draped strands labelled "draped" with the two hold-down points at frac × L_span from ℄ bearing (PS-13), dimensioned.
     Cross-sections at the girder end (℄ bearing) and at midspan: the outline and voids of the shape library, straight strands on a 2 in grid
       (debonded ones hollow at the end), draped strands as pairs on a 2 in grid about their centroid (y_end at the end, y_mid at midspan).
   mount(slot, ctx, o) -> the detCard; ctx = { R, inp }; o = { id, title, compact } (compact: the input panel). */
(function () {
  'use strict';
  const VK = () => window.PSBVizKit;
  const BAR = '#8A5A44', DRP = '#B45309', DB = '#DC6B2F';
  const fx = (v, d) => VK().fx(v, d);
  /* positions of the strands of the section at the end (end true) or at midspan: [{ x, y, kind: 's' | 'd' (debonded at the end) | 'h' (draped) }] */
  function pattern(R, end) {
    const ss = R.ss, out = [];
    ss.rows.forEach(r => { const nd = end && r.dbnd > 0 ? r.nd : 0;
      for (let i = 0; i < r.n; i++) out.push({ x: (i - (r.n - 1) / 2) * 2, y: r.y, kind: nd > 0 && debondedSlot(i, r.n, nd) ? 'd' : 's' }); });
    if (ss.nh > 0) { const yc = end ? +ss.hp.yEnd : +ss.hp.yMid, np = Math.ceil(ss.nh / 2);
      for (let j = 0; j < np; j++) { const y = yc + (j - (np - 1) / 2) * 2, two = 2 * j + 1 < ss.nh; out.push({ x: two ? -1 : 0, y, kind: 'h' }); if (two) out.push({ x: 1, y, kind: 'h' }); } }
    return out;
  }
  /* the debonded strands of a row drawn symmetrically from the outside in (display; the engine needs only their number) */
  function debondedSlot(i, n, nd) { const ord = []; for (let k = 0; ord.length < n; k++) { ord.push(k); if (n - 1 - k !== k && ord.length < n) ord.push(n - 1 - k); } return ord.slice(0, nd).indexOf(i) >= 0; }
  function section(R, end, W) {
    const V = VK(), S = V.scene(), G = R.g, ss = R.ss;
    const half = halfPolygon(G), poly = half.concat(half.slice().reverse().map(p => [-p[0], p[1]]));
    S.poly(poly, 'dt-cc');
    sectionVoids(G).forEach(v => { if (v.type === 'rect') S.rect(v.x - v.w / 2, v.y - v.h / 2, v.x + v.w / 2, v.y + v.h / 2, 'dt-cc', { fill: '#fff' }); else S.circ(v.x, v.y, v.d / 2, 'dt-cc', { fill: '#fff' }); });
    const rr = Math.max(ss.st.db / 2, 0.25), pts = pattern(R, end);
    pts.forEach(p => S.circ(p.x, p.y, rr, 'dt-bar', p.kind === 'h' ? { fill: DRP } : p.kind === 'd' ? { fill: '#fff', stroke: DB, sw: 1.2 } : {}));
    const xr = Math.max(G.bbf || 0, G.btf || 0) / 2;
    ss.rows.forEach(r => S.region(-r.n - 1, r.y - 1, r.n + 1, r.y + 1, `${r.n} straight strands at y = ${fx(r.y, 2)} in${r.nd && r.dbnd ? `, ${r.nd} debonded ${fx(r.dbnd, 2)} ft from each end` : ''}`));
    if (ss.nh > 0) {
      const yc = end ? +ss.hp.yEnd : +ss.hp.yMid, np = Math.ceil(ss.nh / 2), top = yc + (np - 1);
      S.callout(1.2, top, 34, -14, [`draped (${ss.nh})`, `${end ? 'y_end' : 'y_mid'} = ${fx(yc, 2)} in`], { sz: 11 });
      S.region(-2, yc - np, 2, yc + np, `${ss.nh} draped strands, centroid at ${end ? '℄ bearing y_end' : 'midspan y_mid'} = ${fx(yc, 2)} in`);
    }
    const nDb = end ? ss.rows.reduce((a, r) => a + (r.dbnd > 0 ? r.nd : 0), 0) : 0;
    S.dimV(0, G.h, -xr, -14, `h = ${fx(G.h, 1)} in`, { sz: 11 });
    const at = ss.at(end ? 0.001 : R.L / 2);
    S.text(0, 0, end ? `At ℄ bearing${nDb ? `: ${nDb} debonded (hollow)` : ''}` : 'At midspan', { a: 'middle', dy: 18, sz: 11, cls: 'dt-m' });
    S.text(0, 0, `strand centroid ${fx(end ? at.cgs : ss.cgsMid, 2)} in`, { a: 'middle', dy: 32, sz: 11, cls: 'dt-m' });
    const r = S.render({ W, maxH: Math.min(340, Math.max(220, W * 0.75)), label: `Strand pattern at ${end ? 'the end' : 'midspan'}` });
    return r.svg;
  }
  function elevation(R, inp, W, compact) {
    const V = VK(), S = V.scene(), G = R.g, ss = R.ss, L = R.L, nar = W < 520, oh = (+((inp.opt && inp.opt.endOh) || 0)) / 12, H = 0.16 * L * (compact ? 1.4 : 1), Y = y => y / G.h * H;
    const x0 = -Math.max(oh, 0), x1 = L + Math.max(oh, 0);
    S.rect(x0, 0, x1, H, 'dt-cc');
    [0, L].forEach(x => { S.line(x, -0.09 * L, x, H + 0.03 * L, 'dt-cl'); S.poly([[x, 0], [x - 0.012 * L, -0.03 * L], [x + 0.012 * L, -0.03 * L]], 'dt-brg'); });
    S.text(0, H, '℄ brg', { a: 'middle', dy: -0.03 * L * 0 - 16, sz: 10.5, cls: 'dt-m' }); S.text(L, H, '℄ brg', { a: 'middle', dy: -16, sz: 10.5, cls: 'dt-m' });
    ss.rows.forEach(r => {
      S.line(x0, Y(r.y), x1, Y(r.y), 'dt-ol', { stroke: BAR, sw: 1.3 });
      if (r.dbnd > 0 && r.nd > 0) { [[x0, r.dbnd], [L - r.dbnd, x1]].forEach(([a, b]) => S.line(a, Y(r.y), b, Y(r.y), 'dt-hid', { stroke: DB, sw: 2.4, dash: '5 3' }));
        S.region(0, Y(r.y) - 0.01 * L, r.dbnd, Y(r.y) + 0.01 * L, `${r.nd} of ${r.n} strands at y = ${fx(r.y, 2)} in debonded ${fx(r.dbnd, 2)} ft from each end`); }
      S.region(r.dbnd || 0, Y(r.y) - 0.01 * L, L - (r.dbnd || 0), Y(r.y) + 0.01 * L, `${r.n} straight strands at y = ${fx(r.y, 2)} in`);
    });
    const rowsTxt = ss.rows.map(r => `${r.n} @ ${fx(r.y, 1)}`).join(', ');
    if (!nar) S.text(L * 0.5, Y(Math.min(...ss.rows.map(r => r.y).concat([G.h]))), `${ss.Nbond} straight (n @ y in: ${rowsTxt})`, { a: 'middle', dy: 14, sz: 10.5, cls: 'dt-m' });
    if (ss.nh > 0) {
      const a = +ss.hp.frac * L, ye = Y(+ss.hp.yEnd), ym = Y(+ss.hp.yMid), sl = (ym - ye) / a;
      S.pline([[x0, ye + sl * x0], [0, ye], [a, ym], [L - a, ym], [L, ye], [x1, ye - sl * (x1 - L)]], 'dt-ol', { stroke: DRP, sw: 2 });
      [a, L - a].forEach(x => { S.dot(x, ym, 4.5, 'dt-bolt'); S.line(x, ym, x, -0.06 * L, 'dt-ext', { stroke: DRP, dash: '3 3' }); });
      S.text(a * 0.5, (ye + ym) / 2, `draped (n_h = ${ss.nh})`, { a: 'start', dx: 6, dy: 4, sz: 11, fill: DRP, halo: true });
      if (!nar) { S.text(a, ym, 'hold-down', { a: 'middle', dy: -8, sz: 10.5, fill: DRP, halo: true }); S.text(L - a, ym, 'hold-down', { a: 'middle', dy: -8, sz: 10.5, fill: DRP, halo: true }); }
      S.text(0, ye, `y_end = ${fx(+ss.hp.yEnd, 1)} in`, { a: 'start', dx: 5, dy: -6, sz: 10.5, fill: DRP, halo: true });
      S.region(0, ym - 0.02 * L, L, ye + 0.02 * L, `${ss.nh} draped strands: centroid y_end = ${fx(+ss.hp.yEnd, 2)} in at ℄ bearing, y_mid = ${fx(+ss.hp.yMid, 2)} in between the hold-down points; slope ${fx(ss.slope, 4)}`);
      const lab = nar ? `hold-down ${fx(+ss.hp.frac, 3)} L = ${fx(a, 2)} ft` : compact ? `hold-down at ${fx(+ss.hp.frac, 3)} L = ${fx(a, 2)} ft` : `frac × L_span = ${fx(+ss.hp.frac, 3)} × ${fx(L, 2)} = ${fx(a, 2)} ft from ℄ bearing`;
      S.dimH(0, a, -0.06 * L, -14, lab, { sz: 10.5 }); S.dimH(L - a, L, -0.06 * L, nar ? -30 : -14, compact ? `${fx(a, 2)} ft` : `${fx(a, 2)} ft from ℄ bearing`, { sz: 10.5 });
    }
    S.dimH(0, L, -0.06 * L, ss.nh > 0 ? (nar ? -50 : -36) : -14, `L = ${fx(L, 2)} ft (℄ bearing to ℄ bearing)${oh > 0 ? `; girder ${fx(oh * 12, 1)} in past each ℄ bearing` : ''}`, { sz: 10.5 });
    S.dimV(0, H, x1, 12, `h = ${fx(G.h, 1)} in`, { sz: 10.5 });
    const r = S.render({ W, maxH: compact ? 230 : 300, label: 'Strand profile along the girder (vertical scale exaggerated)' });
    return r.svg;
  }
  function draw(ctx, W, compact) {
    const { R, inp } = ctx, two = !compact && W >= 620, sw = two ? Math.floor((W - 14) / 2) : W;
    return { html: `<div class="vk-figs" style="flex-direction:column"><div style="width:${W}px;max-width:100%">${elevation(R, inp, W, compact)}</div></div><div class="vk-figs"><div style="width:${sw}px">${section(R, true, sw)}</div><div style="width:${sw}px">${section(R, false, sw)}</div></div>`, nar: W < 560 };
  }
  function mount(slot, ctx, o) {
    o = o || {}; const V = VK(); if (!slot || !V || !V.detCard) return null;
    const { R } = ctx, ss = R.ss, dr = ss.nh > 0;
    return V.detCard(slot, { id: o.id || 'strandFig', title: o.title || 'Strand pattern', sub: `${ctx.inp.girder}: ${ss.Ntot} strands (${ss.Nbond} straight${ss.Ndebond ? `, ${ss.Ndebond} debonded` : ''}${dr ? `, ${ss.nh} draped` : ''}), ${ctx.inp.str.size}`,
      draw: W => draw(ctx, W, !!o.compact), hint: 'Point at (or tap) a strand row or the draped strands for their values.',
      cap: `<p class="vk-cap">Elevation: vertical scale exaggerated. ${dr ? `Draped strands: straight from ℄ bearing (y<sub>end</sub>) to the two hold-down points at frac × L<sub>span</sub> = ${fx(+ss.hp.frac, 3)} × ${fx(R.L, 2)} ft = ${fx(ss.hp.frac * R.L, 2)} ft from ℄ bearing (PS-13), level between them (y<sub>mid</sub>). ` : 'No draped strands. '}Sections: straight strands on a 2 in grid; ${dr ? 'draped strands as pairs on a 2 in grid about their centroid; ' : ''}debonded strands hollow at the end (which strands of a row are debonded is not an input: drawn from the outside in). Display only.</p>` });
  }
  window.PSBStrandGfx = { mount, pattern, draw };
})();
