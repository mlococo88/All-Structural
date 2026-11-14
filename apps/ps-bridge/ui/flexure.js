/* apps/ps-bridge/ui/flexure.js — the Flexure output tab (window.PSBUiFlexure). Classic script; display only. Created 2026-11-12 (PR 2c-2,
   docs/ps-bridge-plan.md §2.3). As the old app's Flexure tab (moments against the resistance along the girder, midspan flexure, minimum
   reinforcement, the flexure stations, the negative moment at the pier for a span made continuous) plus the positive moment connection
   (5.12.3.3.8a; in the old app on its Continuity input card and in the report), in the steel app's layout. Every number is the engine's
   (computeAll R: R.fMid, R.flexFull, R.flexGov, R.minGov, R.Mcr, R.cont), worked in engine/worked-strength.js flexure(); the graphics: the
   moments and resistances along the girder (the steel along-girder chart) and the pier section (the steel detail style).
     output(ctx) -> HTML; after(el, ctx). ctx = { P, inp, R, W, ui, redraw } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong, VK = () => window.PSBVizKit;
  const OPEN = new Set(['mid']);
  const A = 'AASHTO LRFD 10th Ed. ';
  const TOPICS = [
    { key: 'mid', title: 'Strength I flexure at midspan', ref: A + '5.6.3', ids: /^fx\.(Mu|b1|dp|c|a|fps|Mn|et|phi|phiMn|gov)$/, res: /^fx\.gov$/ },
    { key: 'min', title: 'Minimum reinforcement', ref: A + '5.6.3.3', ids: /^fx\.(fr|fcpe|Mcr|minMr|min\.req|min\.r)$/, res: /^fx\.min\.r$/ },
    { key: 'pier', title: 'Negative moment at the pier (made continuous)', ref: A + '5.12.3.3', ids: /^fx\.pier\./, res: /^fx\.pier\.r$/ },
    { key: 'conn', title: 'Positive moment connection', ref: A + '5.12.3.3.8a', ids: /^fx\.conn\./ }];
  const ckOf = (R, nm) => { const i = R.checks.findIndex(c => c.n === nm); return i < 0 ? null : { i, c: R.checks[i] }; };
  const pf = q => q ? `<b>${q.c.pass ? 'PASS' : 'FAIL'}</b>` : '';
  function output(ctx) {
    const { R, inp } = ctx, k = K(), ev = (p, d, u, div) => k.ev(R, p, d, u, div), wk = k.wk, f = R.fMid, L = R.L, c = R.cont;
    const qF = ckOf(R, 'Flexure'), qM = ckOf(R, 'Min reinf'), qP = ckOf(R, 'Neg flexure (pier)'), qC = ckOf(R, 'Pos. moment connection (5.12.3.3.8)');
    let h = '<div id="gfx_fx"></div>';
    h += k.card('Strength I flexure (positive moment)', k.kv([
      ['Governing M<sub>u</sub> / φM<sub>n</sub>', `<b>${ev(`checks.${qF.i}.r`, 3)}</b> at x = ${ev('flexGov.x', 2, 'ft')} ${pf(qF)} ${wk('fx.gov')}`], ['M<sub>u</sub> / φM<sub>n</sub> there', `${ev('flexGov.Mu', 0, '', 12)} / ${ev('flexGov.phiMn', 0, 'kip-ft', 12)}`],
      ['M<sub>u</sub> at midspan', `${ev('MuMid', 0, 'kip-ft', 12)} ${wk('fx.Mu')}`], ['k', `${inp.str.lowlax ? '0.28' : '0.38'} (${inp.str.lowlax ? 'low-relaxation' : 'stress-relieved'})`], ['β<sub>1</sub>', `${ev('fMid.b1', 3)} ${wk('fx.b1')}`],
      ['d<sub>p</sub>', `${ev('fMid.dp', 2, 'in')} ${wk('fx.dp')}`], ['c / a', `${ev('fMid.c', 2)} / ${ev('fMid.a', 2, 'in')} (${f.rect ? 'rectangular' : 'flanged'}) ${wk('fx.c')}`], ['f<sub>ps</sub>', `${ev('fMid.fps', 1, 'ksi')} ${wk('fx.fps')}`],
      ['M<sub>n</sub>', `${ev('fMid.Mn', 0, 'kip-ft', 12)} ${wk('fx.Mn')}`], ['ε<sub>t</sub> / φ', `${ev('fMid.et', 5)} / ${ev('fMid.phi', 3)} ${wk('fx.phi')}`], ['φM<sub>n</sub> at midspan', `<b>${ev('fMid.phiMn', 0, 'kip-ft', 12)}</b> ${wk('fx.phiMn')}`]])
      + `<p class="note">Compression block in the ${+inp.ts > 0 ? 'deck (f′<sub>c</sub> deck, b<sub>eff</sub>)' : 'girder top flange'}; a flanged section when a exceeds the flange (deck + haunch). The ratio governs over every station with a positive M<sub>u</sub> (strands developed per 5.9.4.3.2; the table below). φ by 5.5.4.2 from ε<sub>t</sub>.${f.et < 0.005 ? ' <b>Not tension-controlled at midspan</b> (warning of the engine).' : ''}</p>`, 'card-fxmid');
    h += k.card('Minimum reinforcement (5.6.3.3)', k.kv([['f<sub>r</sub> = 0.24√f′<sub>c</sub>', `${ev('fr', 3, 'ksi')} ${wk('fx.fr')}`], ['f<sub>cpe</sub> (bottom, midspan)', `${ev('fcpe', 3, 'ksi')} ${wk('fx.fcpe')}`],
      ['M<sub>cr</sub> (γ<sub>1</sub> = 1.6, γ<sub>2</sub> = 1.1, γ<sub>3</sub> = 1.0)', `${ev('Mcr', 0, 'kip-ft', 12)} ${wk('fx.Mcr')}`], ['min(M<sub>cr</sub>, 1.33 M<sub>u</sub>) at midspan', `${ev('minMr', 0, 'kip-ft', 12)} ${wk('fx.minMr')}`],
      ['Governing ratio', `<b>${ev(`checks.${qM.i}.r`, 3)}</b> at x = ${ev('minGov.x', 2, 'ft')} ${pf(qM)} ${wk('fx.min.r')}`]]), 'card-fxmin');
    // stations
    const fg = R.flexFull, idx = fg.map((r, i) => i).filter(i => fg[i].x <= L / 2 + 0.01 && Math.abs(fg[i].x * 20 / L - Math.round(fg[i].x * 20 / L)) < 1e-6);
    h += k.card('Flexure stations (to midspan)', `<div class="tscroll"><table class="tbl"><thead><tr><th>x<br>ft</th><th>M<sub>u</sub><br>kip-ft</th><th>c<br>in</th><th>a<br>in</th><th>f<sub>ps</sub><br>ksi</th><th>ε<sub>t</sub></th><th>φ</th><th>φM<sub>n</sub><br>kip-ft</th><th>M<sub>u</sub>/φM<sub>n</sub></th></tr></thead><tbody>
      ${idx.map(i => { const p = `flexFull.${i}.`, r = fg[i]; return `<tr><td>${ev(p + 'x', 1)}</td><td>${ev(p + 'Mu', 0, '', 12)}</td><td>${ev(p + 'c', 2)}</td><td>${ev(p + 'a', 2)}</td><td>${ev(p + 'fps', 1)}${r.devGov ? ' †' : ''}</td><td>${ev(p + 'et', 5)}</td><td>${ev(p + 'phi', 3)}</td><td>${ev(p + 'phiMn', 0, '', 12)}</td><td>${r.phiMn > 0 ? k.fx(r.Mu / r.phiMn, 3) : '—'}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="note">† The strand is not fully developed at the station (5.9.4.3.2): f<sub>ps</sub> is the section-average developed stress and φM<sub>n</sub> is solved from that tension. Every station of the engine is searched for the governing ratio; the table shows the twentieth points.</p>`, 'card-fxtab');
    if (c) {
      const pr = c.pier;
      h += k.card('Negative moment at the pier (5.12.3.3)', `<div id="gfx_fxpier"></div>` + k.kv([
        ['Continuous unit, spans / design span', `${c.unit.spans.map(v => k.fx(+v, 1)).join(', ')} ft / span ${c.unit.s}`], ...(pr ? [['Interior support', pr.side === 'left' ? 'left end, x = 0' : `right end, x = ${k.fx(L, 2)} ft`],
          ['LL per lane: truck or tandem + lane / two trucks', `${ev('cont.pier.nd.ll.neg', 0)} / ${ev('cont.pier.nd.ll.neg2', 0, 'kip-ft')} ${wk('fx.pier.neg')}`]] : []),
        ['M<sub>DC2</sub> / M<sub>DW</sub> at the pier', `${ev('cont.MDC2n', 0)} / ${ev('cont.MDWn', 0, 'kip-ft')} <a href="#st-an.pier.MDC2" data-gotab="an" class="wk">§</a>`], [`M<sub>LL+IM</sub> (× DF<sub>M</sub> = ${k.fx(R.dfm, 3)})`, `${ev('cont.MLLn', 0, 'kip-ft')} ${wk('fx.pier.MLL')}`],
        ...(c.MrnPier > 0 ? [['Negative restraint moment (γ = 1.0)', ev('cont.MrnPier', 0, 'kip-ft')]] : []), ['M<sub>u</sub> (Strength I)', `<b>${ev('cont.MuN', 0, 'kip-ft', 12)}</b> ${wk('fx.pier.Mu')}`],
        ['Deck A<sub>s</sub> in b<sub>eff</sub> / f<sub>y</sub>', `${ev('cont.As', 2, 'in²')} / ${ev('cont.fyr', 0, 'ksi')}`], ['d (deck bars to the girder bottom)', `${ev('cont.dN', 2, 'in')} ${wk('fx.pier.d')}`],
        ['a / c (girder f′<sub>c</sub>, b = b<sub>bf</sub>)', `${ev('cont.aN', 2)} / ${ev('cont.cN', 2, 'in')} ${wk('fx.pier.a')}`], ['a against the bottom flange t<sub>bf</sub>', `${ev('cont.aN', 2)} vs ${ev('cont.tbf', 2, 'in')}: ${c.aOK ? 'OK' : '<b>exceeds</b>'}`],
        ['ε<sub>t</sub> / φ', `${ev('cont.etN', 5)} / ${ev('cont.phiN', 3)} ${wk('fx.pier.phi')}`], ['φM<sub>n</sub>', `<b>${ev('cont.phiMnN', 0, 'kip-ft', 12)}</b> ${wk('fx.pier.phiMn')}`], ['M<sub>u</sub> / φM<sub>n</sub>', `<b>${ev('cont.dc', 3)}</b> ${pf(qP)} ${wk('fx.pier.r')}`]])
        + `<p class="note">Deck bars in tension at d = h<sub>c</sub> − d<sub>top</sub>, a rectangular block in the girder bottom flange (girder f′<sub>c</sub>); the strands near the pier are neglected. Demands from the continuous unit (<a href="#" data-gotab="an">Analysis tab</a>); restraint moments ${c.restr ? 'computed: a negative one is added' : 'not computed'} (5.12.3.3.2). Inputs: <a href="#" data-goin="layout">Bridge layout tab</a>, continuity card. Service at the pier (5.12.3.3.5): <a href="#" data-gotab="str">Stresses tab</a>.</p>`, 'card-fxpier');
      const q = c.conn, cr = R.own && R.own.contReq;
      if (q) h += k.card('Positive moment connection (5.12.3.3.8a)', k.kv([['Support', `${q.x === 0 ? 'left' : 'right'} end of the span (x = ${k.fx(q.x, 2)} ft)`], ['M<sub>res</sub> + M<sub>DC2</sub> + M<sub>DW</sub> + m M<sub>LL+</sub>', `${ev('cont.conn.mr', 0)} + ${ev('cont.conn.mdc2', 0)} + ${ev('cont.conn.mdw', 0)} + ${ev('cont.conn.mll', 0)} = <b>${ev('cont.conn.M', 0, 'kip-ft')}</b> ${wk('fx.conn.M')}`],
        ...(q.M > 0 ? [['T = 0.9 M / (0.9 h<sub>c</sub>)', `${ev('cont.conn.T', 1, 'kip')} ${wk('fx.conn.T')}`], ['A<sub>s,req</sub> = T / 36 ksi', `<b>${ev('cont.conn.AsReq', 2, 'in²')}</b> ${wk('fx.conn.As')}`],
          ['A<sub>s,pos</sub> entered', q.AsProv > 0 ? `${ev('cont.conn.AsProv', 2, 'in²')}: f<sub>s</sub> = ${ev('cont.conn.fs', 1, 'ksi')}, ratio <b>${ev('cont.conn.dc', 3)}</b> ${pf(qC)} ${wk('fx.conn.r')}` : 'none: the required area is reported']] : [['Result', 'no positive moment at the connection: detail it per 5.12.3.3.8 and the owner']]),
        ...(cr ? [[`${k.esc(cr.cite)}: required φM<sub>n</sub> ≥ ${k.fx(cr.f, 1)} M<sub>cr</sub>`, `M<sub>cr</sub> = f<sub>r</sub> S<sub>bc</sub> = ${ev('own.contReq.Mcr', 0, 'kip-ft')}; required ${ev('own.contReq.req', 0, 'kip-ft')} (reported)`]] : [])])
        + '<p class="note">Service moment after continuity at the girder end over the interior support (C5.12.3.3.2, γ = 1.0); f<sub>s</sub> ≤ 36.0 ksi in the connection steel; axial restraint not computed (bearings free longitudinally). A<sub>s,pos</sub>: <a href="#" data-goin="layout">Bridge layout tab</a>, continuity card. The old app shows this on its Continuity input card and in its report.</p>', 'card-fxconn');
    }
    h += k.card('Worked steps: flexure', `<p class="note">AASHTO LRFD 10th Ed. (2024). Every result is the engine's value. f<sub>pe</sub>: <a href="#st-ls.fpe" data-gotab="loss">Losses tab</a>; h<sub>c</sub>, b<sub>eff</sub>: <a href="#st-sec.hc" data-gotab="sec">Section properties tab</a>; moments: <a href="#st-an.MuS" data-gotab="an">Analysis tab</a>.</p>${k.steps(ctx.W.flexure.steps, TOPICS, OPEN)}`);
    return h;
  }
  /* the pier section: girder, deck with the bars in tension, the compression block in the bottom flange.
     NEXT (2026-11-14, display only): the block is drawn at the bottom of each of the two stems, B wide each (x = ±stemCC/2 ± B/2), the
     width the engine uses for the compression zone (pbd-compute.js: a = A_s f_y / (0.85 f′c b_bf), b_bf = 2B for NEXT, girderGrossBase);
     before, one block 2B wide centred on the girder ℄, i.e. in the gap between the stems. blocks(G): [[x0, x1]] of the block(s). */
  const blocks = G => (G.isNext && G.next ? [-1, 1].map(s => [s * G.next.stemCC / 2 - G.next.B / 2, s * G.next.stemCC / 2 + G.next.B / 2]) : [[-G.bbf / 2, G.bbf / 2]]);
  function pierFig(R, inp, W) {
    const V = VK(), S = V.scene(), G = R.g, cp = R.cp, c = R.cont, ts = +inp.ts, th = (G.isBox || G.isDeck) ? 0 : +inp.th, bE = Math.min(cp.beff, Math.max(G.btf, G.bbf) * 2.2);
    const half = halfPolygon(G), poly = half.concat(half.slice().reverse().map(p => [-p[0], p[1]]));
    S.poly(poly, 'dt-cc'); sectionVoids(G).forEach(v => { if (v.type === 'rect') S.rect(v.x - v.w / 2, v.y - v.h / 2, v.x + v.w / 2, v.y + v.h / 2, 'dt-cc', { fill: '#fff' }); else S.circ(v.x, v.y, v.d / 2, 'dt-cc', { fill: '#fff' }); });
    if (th > 0) S.rect(-G.btf / 2, G.h, G.btf / 2, G.h + th, 'dt-cc', { op: 0.85 });
    if (ts > 0) S.rect(-bE / 2, G.h + th, bE / 2, G.h + th + ts, 'dt-cc');
    const yb = c.dN, nb = 9; for (let i = 0; i < nb; i++) S.circ(-bE / 2 + 2 + i * (bE - 4) / (nb - 1), yb, 0.45, 'dt-bar');
    S.callout(bE / 2 - 2, yb, 26, -16, [`deck bars A_s = ${V.fx(c.As, 2)} in², f_y = ${V.fx(c.fyr, 0)} ksi`], { sz: 10.5 });
    const bk = blocks(G), xr = bk[bk.length - 1][1];
    bk.forEach(([x0, x1]) => S.rect(x0, 0, x1, Math.min(c.aN, G.h), 'dt-ng', { op: 0.9 }));
    S.callout(xr, c.aN / 2, 26, 10, [`compression block a = ${V.fx(c.aN, 2)} in${G.isNext ? ` in each stem (b = 2 × ${V.fx(G.next.B, 2)} in)` : ''} (t_bf = ${V.fx(c.tbf, 1)} in)`], { sz: 10.5, gov: !c.aOK });
    S.dimV(0, yb, -Math.max(G.bbf, G.btf) / 2, -16, `d = ${V.fx(c.dN, 2)} in`, { sz: 10.5 });
    if (cp.beff > bE + 0.01) S.text(0, G.h + th + ts, `deck drawn ${V.fx(bE, 0)} in wide (b_eff = ${V.fx(cp.beff, 1)} in)`, { a: 'middle', dy: -8, sz: 10, cls: 'dt-m' });
    bk.forEach(([x0, x1]) => S.region(x0, 0, x1, Math.max(c.aN, 1), `a = A_s f_y / (0.85 f'c b_bf) = ${V.fx(c.aN, 3)} in, c = ${V.fx(c.cN, 3)} in${G.isNext ? `; b_bf = 2 stems × B = 2 × ${V.fx(G.next.B, 2)} = ${V.fx(G.bbf, 2)} in` : ''}`));
    return { html: S.render({ W: Math.min(W, 640), maxH: 330, label: 'Pier section, negative moment' }).svg, nar: W < 560 };
  }
  const HIDE = { cmp: { sw: true, dc1: true, dc2: true, dw: true, llp: true, lln: true } };
  function after(el, ctx) {
    K().after(el, OPEN);
    const { R } = ctx, k = K(), ev = (p, d, u, div) => k.ev(R, p, d, u, div), fg = R.flexFull, L = R.L, c = R.cont, xs = fg.map(r => r.x);
    const nearX = x => xs.reduce((b, v, i) => Math.abs(v - x) < Math.abs(xs[b] - x) ? i : b, 0);
    const slot = el.querySelector('#gfx_fx');
    if (slot && VA() && VA().mount) {
      const qF = ckOf(R, 'Flexure'), qM = ckOf(R, 'Min reinf'), qP = ckOf(R, 'Neg flexure (pier)');
      const ST = [{ key: 'mup', html: 'M<sub>u</sub> +', ci: 2, pts: fg.map(r => [r.x, r.Mu / 12]) }, { key: 'phi', html: 'φM<sub>n</sub> +', ci: 0, pts: fg.map(r => [r.x, r.phiMn / 12]) },
        ...(c ? [{ key: 'mun', html: 'M<sub>u</sub> −', ci: 2, dash: '5 3', pts: R.diagrams.map(r => [r.x, r.M_StrI_neg]) }, { key: 'phin', html: '−φM<sub>n</sub> (pier)', ci: 3, dash: '2 3', pts: [[0, -c.phiMnN / 12], [L, -c.phiMnN / 12]] }] : [])];
      const CP = [{ key: 'sw', html: 'girder', ci: 0, f: 'mSW' }, { key: 'dc1', html: 'DC1', ci: 1, f: 'mDC1' }, { key: 'dc2', html: 'DC2', ci: 4, f: 'mDC2' }, { key: 'dw', html: 'DW', ci: 5, f: 'mDW' }, { key: 'llp', html: 'LL+IM +', ci: 2, f: 'mLLpos' }, ...(c ? [{ key: 'lln', html: 'LL+IM −', ci: 2, dash: '5 3', f: 'mLLneg' }] : [])]
        .map(q => ({ ...q, pts: fg.map(r => [r.x, r[q.f]]) }));
      const grp = (g, label, Ls) => ({ label, items: Ls.map(q => ({ key: g + ':' + q.key, html: `${VA().swatch(q.ci, q.dash)} ${q.html}`, on: !(HIDE[g] || {})[q.key] })) });
      const at = x => { const r = fg[nearX(x)]; return [`x = ${k.fx(r.x, 2)} ft`, `M_u ${k.fx(r.Mu / 12, 0)}, φM_n ${k.fx(r.phiMn / 12, 0)} kip-ft${r.phiMn > 0 ? `, ratio ${k.fx(r.Mu / r.phiMn, 3)}` : ''}`]; };
      VA().mount(slot, { key: 'fx', title: 'Moments and flexural resistance along the girder', sub: `kip-ft per girder, sagging up; ${fg.length} stations`,
        controls: VK().tiles([{ label: 'M<sub>u</sub> / φM<sub>n</sub>', value: ev(`checks.${qF.i}.r`, 3), unit: qF.c.pass ? 'PASS' : 'FAIL', tone: qF.c.pass ? 'c' : 't' }, { label: 'φM<sub>n</sub> midspan', value: ev('fMid.phiMn', 0, '', 12), unit: 'kip-ft' }, { label: 'f<sub>ps</sub>', value: ev('fMid.fps', 1), unit: 'ksi' },
          { label: 'φ', value: ev('fMid.phi', 3), unit: '' }, { label: 'Minimum reinf.', value: ev(`checks.${qM.i}.r`, 3), unit: qM.c.pass ? 'PASS' : 'FAIL', tone: qM.c.pass ? '' : 't' }, ...(qP ? [{ label: 'Pier −M<sub>u</sub> / −φM<sub>n</sub>', value: ev('cont.dc', 3), unit: qP.c.pass ? 'PASS' : 'FAIL', tone: qP.c.pass ? '' : 't' }] : [])]),
        draw: W => VA().render({ L0: 0, L1: L, sup: [0, L], axisTitle: 'Station x, ft (from ℄ bearing, left)', aria: 'Moments and flexural resistance along the girder', rows: [
          { kind: 'chart', key: 'st', label: 'Strength I: M_u against φM_n', unit: 'kip-ft', series: ST, hidden: HIDE.st, gov: [{ x: R.flexGov.x, y: R.flexGov.Mu / 12 }], h: W < 600 ? 160 : 220 },
          { kind: 'chart', key: 'cmp', label: 'Components (unfactored; LL with DF and IM): select them below', unit: 'kip-ft', series: CP, hidden: HIDE.cmp, h: W < 600 ? 110 : 140 }] }, W),
        at, snap: x => xs[nearX(x)], chips: () => [grp('st', 'Strength I', ST), grp('cmp', 'Components', CP)], onChip: key => { const [g, s] = key.split(':'), o = HIDE[g] = HIDE[g] || {}; o[s] = !o[s]; },
        legend: VA().legend('marks'), hint: 'Point at (or tap) the chart to read the station.',
        caption: `<p class="vk-cap">The engine's M<sub>u</sub> and φM<sub>n</sub> at its stations (φM<sub>n</sub> drops near the ends where the strands are not developed)${c ? '; −M<sub>u</sub> from the continuous unit and the deck-reinforced −φM<sub>n</sub> of the pier section, drawn along the span as the old app' : ''}. Circle: the governing station. Display only.</p>` });
    }
    const sp = el.querySelector('#gfx_fxpier');
    if (sp && c && VK() && VK().detCard) VK().detCard(sp, { id: 'fxPierFig', title: 'Pier section (negative moment)', sub: `${k.esc(ctx.inp.girder)} with the deck; girder f′c ${k.fx(+ctx.inp.mat.fc, 2)} ksi`, draw: W => pierFig(R, ctx.inp, W), hint: 'Point at the compression block for its values.',
      cap: `<p class="vk-cap">Deck bars (A<sub>s</sub> within b<sub>eff</sub>) in tension, the rectangular compression block in the girder bottom flange${R.g.isNext ? ' (NEXT: at the bottom of each of the two stems, b<sub>bf</sub> = 2B, the width the engine uses)' : ''}; bar positions drawn for display. Display only.</p>` });
  }
  window.PSBUiFlexure = { output, after, TOPICS, pierFig, blocks };   // pierFig, blocks: also for tests/engine/psbridge-pierfig.test.mjs
})();
