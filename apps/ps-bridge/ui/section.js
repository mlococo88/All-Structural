/* apps/ps-bridge/ui/section.js — the Section properties output tab (window.PSBUiSection). Classic script; display only. Created 2026-11-12 (PR 2b-2,
   docs/ps-bridge-plan.md §2.3). Every number is the engine's (computeAll R: R.g gross girder, R.cp composite section, R.ss strands), worked in
   engine/worked.js section(); the graphic (the composite section with the strands, the steel app's detail style, PSBVizKit.scene / detCard)
   draws the shape the engine uses (halfPolygon, sectionVoids of engine/pbd-section.js) with the engine's centroids.
     output(ctx) -> HTML; after(el, ctx) mounts the graphic and wires the steps. ctx = { P, inp, R, W: { section, loads, analysis }, ui } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VK = () => window.PSBVizKit;
  const OPEN = new Set(['comp']);
  const TOPICS = [
    { key: 'gross', title: 'Gross girder section', ref: 'shape library; 3.5.1', ids: /^sec\.g\./ },
    { key: 'ec', title: 'Moduli of elasticity and modular ratio', ref: 'AASHTO LRFD 10th Ed. 5.4.2.4', ids: /^sec\.(Ecg|Ecd|n)$/, res: /^sec\.n$/ },
    { key: 'comp', title: 'Composite section (transformed deck)', ref: 'AASHTO LRFD 10th Ed. 4.6.2.6', ids: /^sec\.(beff|Ad|yd|Ah|Ac|ybc|Ic|hc|Sbc|Stg|Std)$/, res: /^sec\.Ic$/ },
    { key: 'str', title: 'Prestressing strands', ref: 'AASHTO LRFD 10th Ed. 5.9.4.3.1', ids: /^sec\./, res: /^sec\.eMid$/ }];
  /* voidNote(G): 2026-11-14 (decision pending engineer review, PS28/void note): where the void of a box beam or a voided deck slab is, as the
     engine places it (sectionVoids, pbd-section.js) and every graphic draws it; '' for a shape without voids. The old app's section graphic
     centred the box void on the depth; the engine (and so every value that uses the void position) puts it on the bottom wall (with the old library's 5 in wall and no top-wall input).
     PS-30 / PS-32 (2026-11-14): a standard box beam or voided slab of the CTDOT plates (engine/sections.js): where its void(s) are (the box
     cell centred: its 5½ in bottom slab is the engine's wall and voidH = h − 11), the plate it comes from, and the drawn outline's A, I, y_b
     against the plate's. */
  function voidNote(G) {
    const b = G && G.box, f = v => K().fx(v, 1); if (!b) return '';
    const SC = window.PSBSections, st = SC && SC.stdOf ? SC.stdOf(G) : null;
    if (st) {
      const [, e] = st, s = e.src, o = SC.outline(e), pc = (a, q) => `${(a / q - 1) * 100 >= 0 ? '+' : '−'}${K().fx(Math.abs(a / q - 1) * 100, 1)} %`;
      const chk = `the drawn outline (the shear keys and the ¾ in corner chamfers${G.isBox ? ' and the plate\'s 3 × 3 in void chamfers' : ''} not drawn) gives A = ${f(o.A)} in² (${pc(o.A, e.A)}), I = ${K().fx(o.I, 0)} in⁴ (${pc(o.I, e.I)}), y<sub>b</sub> = ${K().fx(o.yb, 2)} in (${pc(o.yb, e.yb)})`;
      const use = `The voids are used for the concrete area on the tension side A<sub>ct</sub> (shear, 5.7.3.4.2, when ε<sub>s</sub> &lt; 0), the strand fit of the input check (PS-28) and the graphics.`;
      if (G.isBox) return `Void: one ${f(b.voidW)} × ${f(b.voidH)} in cell, y = ${f(b.wall)} to ${f(b.wall + b.voidH)} in above the soffit, centred between the ${f(s.slab)} in top and bottom slabs; webs ${f(s.web)} in; actual width ${f(G.w)} in (nominal ${s.wNom} in) (CTDOT BDM plate ${s.outline}, PDF p. ${s.outlinePage}). Drawn and used as a rectangle where the engine places it (sectionVoids). A, I and y<sub>b</sub> above are the plate's values (AASHTO ${s.beam}, CTDOT BDM plate ${s.plate}, PDF p. ${s.page}); ${chk}. ${use}`;
      return `Voids: ${s.voids.map(v => `Ø${f(v.d)} in at x = ${f(v.x)} in`).join(', ')}, on mid-depth (y = ${f(G.h / 2)} in); actual width ${f(G.w)} in (nominal ${s.wNom} in) (CTDOT BDM plate ${s.outline}, PDF p. ${s.outlinePage}; the void spacing is not dimensioned on the plate: scaled from its drawing). A, I and y<sub>b</sub> above are the plate's values (AASHTO ${s.beam}, CTDOT BDM plate ${s.plate}, PDF p. ${s.page}); ${chk}. ${use}`;
    }
    if (G.isBox && b.voidW > 0 && b.voidH > 0) return `Void: one ${f(b.voidW)} × ${f(b.voidH)} in cell on the bottom wall, y = ${f(b.wall)} to ${f(b.wall + b.voidH)} in above the soffit (bottom wall ${f(b.wall)} in, top wall h − wall − void = ${f(G.h - b.wall - b.voidH)} in), where the engine places it (sectionVoids) and as drawn here; the old app's section graphic centred it on the depth. A, I and y<sub>b</sub> above are the library's published values, not computed from the outline: the void position is used for the concrete area on the tension side A<sub>ct</sub> (shear, 5.7.3.4.2, when ε<sub>s</sub> &lt; 0), the strand fit of the input check (PS-28) and the graphics.`;
    if (G.isDeck && b.voids > 0 && b.voidD > 0) return `Voids: ${b.voids} round voids of ${f(b.voidD)} in diameter on mid-depth (y = ${f(G.h / 2)} in), evenly spaced across the width, where the engine places them (sectionVoids) and as drawn here. A, I and y<sub>b</sub> above are the library's published values, not computed from the outline: the void positions are used for A<sub>ct</sub> (shear, 5.7.3.4.2, when ε<sub>s</sub> &lt; 0), the strand fit of the input check (PS-28) and the graphics.`;
    return '';
  }
  /* stdSrc(G): PS-30 / PS-32: the plate a standard box beam or voided slab's A, I, y_b come from ('' for any other shape) */
  function stdSrc(G) {
    const SC = window.PSBSections, st = SC && SC.stdOf ? SC.stdOf(G) : null; if (!st) return '';
    const s = st[1].src; return `AASHTO ${s.beam}: A, I, y<sub>b</sub> from CTDOT Bridge Design Manual plate ${s.plate} (PDF p. ${s.page}), an app-side correction of the old library (PS-30 / PS-32); S<sub>b</sub>, S<sub>t</sub> and the self-weight computed from them below`;
  }
  function output(ctx) {
    const { R, inp } = ctx, k = K(), ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, G = R.g, ss = R.ss;
    const kind = G.isNext ? 'NEXT F double tee' : G.isBox ? 'adjacent box beam' : G.isDeck ? 'adjacent deck beam' : 'I-girder / bulb tee';
    let h = '<div id="gfx_sec"></div>';
    h += k.card(`Gross girder section: ${k.esc(inp.girder)}`, k.kv([
      ['Shape', `${k.esc(inp.girder)} (${kind})${G.ovr && G.ovr.any ? ', with overrides' : ''}`], ['Depth h', ev('g.h', 2, 'in')], ['Area A', ev('g.A', 1, 'in²')], ['Moment of inertia I', ev('g.I', 0, 'in⁴')],
      ['y<sub>b</sub> (centroid above the soffit)', ev('g.yb', 3, 'in')], ['y<sub>t</sub>', `${ev('g.yt', 3, 'in')} ${wk('sec.g.yt')}`], ['S<sub>b</sub>', `${ev('g.Sb', 0, 'in³')} ${wk('sec.g.Sb')}`], ['S<sub>t</sub>', `${ev('g.St', 0, 'in³')} ${wk('sec.g.St')}`],
      ['Web width b<sub>w</sub>', ev('g.bw', 2, 'in')], ['Top / bottom flange width', `${ev('g.btf', 2)} / ${ev('g.bbf', 2, 'in')}`], ['Self-weight w<sub>g</sub>', `${ev('g.wsw', 4, 'klf')} ${wk('sec.g.wsw')}`]])
      + `<p class="note">Gross properties of the shape library (${stdSrc(G) || `the old app's GIRDERS${G.isNext ? '; NEXT: interpolated on the flange width' : ''}`})${G.ovr && G.ovr.any ? '; overridden values as entered (Girders &amp; strands tab)' : ''}.</p>`
      + (voidNote(G) ? `<p class="note" id="sec-void-note">${voidNote(G)}</p>` : ''), 'card-gross');
    h += k.card('Composite section', k.kv([
      ['E<sub>c</sub> girder', `${ev('cp.Ecg', 0, 'ksi')} ${wk('sec.Ecg')}`], ['E<sub>c</sub> deck', `${ev('cp.Ecd', 0, 'ksi')} ${wk('sec.Ecd')}`], ['Modular ratio n', `${ev('cp.n', 4)} ${wk('sec.n')}`],
      ['Effective flange width b<sub>eff</sub>', `${ev('cp.beff', 2, 'in')} ${wk('sec.beff')}`], ['A<sub>c</sub>', `${ev('cp.Ac', 1, 'in²')} ${wk('sec.Ac')}`], ['y<sub>bc</sub>', `${ev('cp.ybc', 3, 'in')} ${wk('sec.ybc')}`],
      ['I<sub>c</sub>', `${ev('cp.Ic', 0, 'in⁴')} ${wk('sec.Ic')}`], ['Composite depth h<sub>c</sub>', `${ev('cp.hc', 2, 'in')} ${wk('sec.hc')}`], ['S<sub>bc</sub> (girder bottom)', `${ev('cp.Sbc', 0, 'in³')} ${wk('sec.Sbc')}`],
      ['S<sub>tg</sub> (girder top)', `${ev('cp.Stg', 0, 'in³')} ${wk('sec.Stg')}`], ['S<sub>td</sub> (deck top, ÷ n)', `${ev('cp.Std', 0, 'in³')}${+inp.ts > 0 ? ' ' + wk('sec.Std') : ''}`]])
      + `<p class="note">Deck t<sub>s</sub> = ${k.fx(+inp.ts, 2)} in, haunch ${k.fx(+inp.th, 2)} in (${R.cp.incHaunch ? 'included in' : 'excluded from'} the section properties; its weight is in DC1, <a href="#" data-gotab="lds">Loads &amp; LLDF tab</a>). Inputs: <a href="#" data-goin="xsec">Cross-section tab</a>.</p>`, 'card-comp');
    const dr = ss.nh > 0;
    h += k.card('Prestressing strands', k.kv([
      ['Strands N (straight + draped)', `${ev('ss.Ntot', 0)} (${ev('ss.Nbond', 0)} + ${ev('ss.nh', 0)}) ${wk('sec.N')}`], ['A<sub>ps</sub>', `${ev('ss.Aps', 3, 'in²')} ${wk('sec.Aps')}`],
      ['Straight strand centroid y<sub>s</sub>', `${ev('ss.cgsStraight', 3, 'in')}${ss.Nbond > 0 ? ' ' + wk('sec.ycs') : ''}`], ['Debonded strands', ev('ss.Ndebond', 0)],
      ...(dr ? [['Draped strands: y<sub>end</sub> / y<sub>mid</sub>', `${k.fx(+ss.hp.yEnd, 2)} / ${k.fx(+ss.hp.yMid, 2)} in`], ['Hold-down points from ℄ bearing', `${k.fx(ss.hp.frac * R.L, 2)} ft (${k.fx(+ss.hp.frac, 3)} L) ${wk('sec.aHd')}`],
        ['Slope of the draped strands', `${ev('ss.slope', 4)} ${wk('sec.slope')}`]] : []),
      ['Strand centroid at midspan y<sub>ps</sub>', `${ev('ss.cgsMid', 3, 'in')} ${wk('sec.cgsMid')}`], ['Eccentricity at midspan e<sub>m</sub>', `${ev('ss.eMid', 3, 'in')} ${wk('sec.eMid')}`],
      ['Eccentricity at the end e<sub>end</sub>', ev('ss.eEnd', 3, 'in')], ['Transfer length ℓ<sub>t</sub>', `${ev('ss.lt', 1, 'in')} ${wk('sec.lt')}`]])
      + '<p class="note">Strand rows and draped strands: <a href="#" data-goin="gird">Girders &amp; strands tab</a>. The strands are drawn in the section figure above and in the strand-pattern graphic of the Losses tab.</p>', 'card-str');
    h += k.card('Worked steps: section properties', `<p class="note">AASHTO LRFD 10th Ed. (2024). Every result is the engine's value (the moved Prestressed Bridge Design engine).</p>${k.steps(ctx.W.section.steps, TOPICS, OPEN)}`);
    return h;
  }
  /* the composite section graphic (display only; in): the girder outline, voids, haunch, deck, strands, centroids */
  function figure(ctx, W) {
    const { R, inp } = ctx, G = R.g, cp = R.cp, ss = R.ss, V = VK(), S = V.scene(), th = (G.isBox || G.isDeck) ? 0 : +inp.th, ts = +inp.ts;
    const half = halfPolygon(G), poly = half.concat(half.slice().reverse().map(p => [-p[0], p[1]]));
    S.poly(poly, 'dt-cc');
    sectionVoids(G).forEach(v => { if (v.type === 'rect') S.rect(v.x - v.w / 2, v.y - v.h / 2, v.x + v.w / 2, v.y + v.h / 2, 'dt-cc', { fill: '#fff' }); else S.circ(v.x, v.y, v.d / 2, 'dt-cc', { fill: '#fff' }); });
    if (th > 0) S.rect(-G.btf / 2, G.h, G.btf / 2, G.h + th, 'dt-cc', { op: 0.85 });
    if (ts > 0) { S.rect(-cp.beff / 2, G.h + th, cp.beff / 2, G.h + th + ts, 'dt-cc'); S.region(-cp.beff / 2, G.h + th, cp.beff / 2, G.h + th + ts, `Deck: b_eff = ${V.fx(cp.beff, 1)} in, t_s = ${V.fx(ts, 2)} in, n = ${V.fx(cp.n, 3)}`); }
    // straight strands on a 2 in grid (display), the draped strands at midspan: the positions of the strand-pattern graphic (PSBStrandGfx.xy, the
    // old app's strandXY; NEXT: in the two stems, PS-27)
    const SG = window.PSBStrandGfx, pts = SG.pattern(R, false);
    pts.forEach(q => S.circ(q.x, q.y, ss.st.db / 2, q.kind === 'h' ? 'dt-bolt' : 'dt-bar'));
    ss.rows.forEach((r, ri) => { const [x0, x1] = SG.rowBox(pts, ri); S.region(x0, r.y - 1, x1, r.y + 1, `${r.n} strands at y = ${r.y} in${r.nd ? `, ${r.nd} debonded ${r.dbnd} ft` : ''}`); });
    if (ss.nh > 0) { const [x0, x1, y0, y1] = SG.drapedBox(pts);
      S.region(x0, y0, x1, y1, `${ss.nh} draped strands, centroid y_mid = ${ss.hp.yMid} in at midspan (y_end = ${ss.hp.yEnd} in)`); }
    const xr = Math.max(G.bbf || 0, G.btf || 0, cp.beff || 0) / 2 + 4;
    const cl = (y, txt, cls) => { S.line(-xr, y, xr, y, cls || 'dt-cl'); S.text(xr, y, txt, { dx: 4, vc: true, sz: 11 }); };
    cl(G.yb, `y_b = ${V.fx(G.yb, 2)} in (girder)`); cl(cp.ybc, `y_bc = ${V.fx(cp.ybc, 2)} in (composite)`, 'dt-hid'); cl(ss.cgsMid, `y_ps = ${V.fx(ss.cgsMid, 2)} in (strands, midspan)`, 'dt-tf');
    S.dimV(0, G.h, -Math.max(G.bbf || 0, G.btf || 0) / 2, -16, `h = ${V.fx(G.h, 1)} in`);
    if (ts > 0) S.dimH(-cp.beff / 2, cp.beff / 2, G.h + th + ts, 14, `b_eff = ${V.fx(cp.beff, 1)} in`);
    const r = S.render({ W, maxH: Math.min(520, Math.max(300, W * 0.6)), label: 'Composite section with the strands' });
    return { html: r.svg, nar: W < 560 };
  }
  function after(el, ctx) {
    K().after(el, OPEN);
    const slot = el.querySelector('#gfx_sec'); if (!slot || !VK() || !VK().detCard) return;
    const { R } = ctx, k = K(), ev = (p, d) => k.ev(R, p, d);
    VK().detCard(slot, { id: 'secFig', title: 'Composite section and strands', sub: `${k.esc(ctx.inp.girder)}, design girder ${k.esc(R.rv ? ctx.inp.proj.girderId : '')}`,
      top: VK().tiles([{ label: 'A (girder)', value: ev('g.A', 1), unit: 'in²' }, { label: 'I (girder)', value: ev('g.I', 0), unit: 'in⁴' }, { label: 'y<sub>b</sub>', value: ev('g.yb', 2), unit: 'in' },
        { label: 'I<sub>c</sub> (composite)', value: ev('cp.Ic', 0), unit: 'in⁴', tone: 'c' }, { label: 'y<sub>bc</sub>', value: ev('cp.ybc', 2), unit: 'in', tone: 'c' }, { label: 'A<sub>ps</sub>', value: ev('ss.Aps', 3), unit: 'in²', tone: 't' }]),
      draw: W => figure(ctx, W), hint: 'Point at the deck or a strand row for its values.',
      cap: '<p class="vk-cap">Shape as the engine uses it (outline and voids of the shape library); straight strands drawn on a 2 in grid, draped strands at midspan. Display only.</p>' });
  }
  window.PSBUiSection = { output, after, TOPICS, figure, voidNote };   // figure: also for tests/engine/psbridge-strandgfx.test.mjs (PS-27); voidNote: the Report §2 assumptions
})();
