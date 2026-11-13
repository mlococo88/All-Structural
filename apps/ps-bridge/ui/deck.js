/* apps/ps-bridge/ui/deck.js — the Deck output tab (window.PSBUiDeck). Classic script; display only. Created 2026-11-13 (PR 2d-2,
   docs/ps-bridge-plan.md §2.3; PS-14 a: the deck strip method as today). As the old app's Deck tab (the transverse strip design: slab and
   wearing-surface moments, the negative-moment design section 4.6.2.1.6, the live load of Table A4-1, Strength I, the bottom- and top-bar
   capacities, the overhang, the distribution steel), in the steel app's layout. Every number is the engine's (computeAll R.deck and its
   checks), worked in engine/worked-hdr.js deck(). The graphics: the three ratios and the moments (the steel bar chart, PSBVizAlong.hbars)
   and the deck section over the design girder (the steel detail kit: girder spacing, overhang, barrier, the design wheel, the design
   section, the bars). The module is optional (Diaphragms / deck tab, Deck design): when it is off the tab says so and links to the input.
     output(ctx) -> HTML; after(el, ctx). ctx = { P, inp, R, W, ui, redraw } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong, VK = () => window.PSBVizKit;
  const OPEN = new Set(['mom']);
  const A = 'AASHTO LRFD 10th Ed. ';
  const TOPICS = [
    { key: 'mom', title: 'Interior bay: moments (dead load, Table A4-1, Strength I)', ref: A + '4.6.2.1, Table A4-1', ids: /^dk\.(wDC|wDW|MDCp|MDWp|MDCn|MDWn|xneg|MLLp|MLLn|Mup|Mun)$/ },
    { key: 'pos', title: 'Positive moment: bottom bars', ref: A + '5.6.3', ids: /^dk\.pos\./, res: /^dk\.pos\.r$/ },
    { key: 'neg', title: 'Negative moment: top bars', ref: A + '5.6.3', ids: /^dk\.neg\./, res: /^dk\.neg\.r$/ },
    { key: 'oh', title: 'Overhang (gravity and barrier)', ref: A + 'Table 4.6.2.1.3-1', ids: /^dk\.(X|SWoh|MohDC|MohDW|MohLL|Muoh|oh\.phiMn|oh\.r)$/, res: /^dk\.oh\.r$/ },
    { key: 'dist', title: 'Distribution reinforcement', ref: A + '9.7.3.2', ids: /^dk\.dist$/ }];
  const ckOf = (R, nm) => { const i = R.checks.findIndex(c => c.n === nm); return i < 0 ? null : { i, c: R.checks[i] }; };
  const st = ok => `<td class="${ok ? 'ok' : 'ngt'}">${ok ? 'PASS' : 'FAIL'}</td>`;
  function output(ctx) {
    const { R, inp } = ctx, k = K();
    if (!R.deck) return k.card('Deck design (strip method)', '<p class="note">Deck design is off for this design. Turn it on (<a href="#" data-goin="dd">Diaphragms / deck tab</a>, Deck design) for the transverse design of the interior bays and the overhang.</p>', 'card-dkoff');
    const ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, D = R.deck, own = D.own;
    const qP = ckOf(R, 'Deck +M'), qN = ckOf(R, 'Deck −M'), qO = ckOf(R, 'Deck overhang');
    let h = '<div id="gfx_dk"></div>';
    h += k.card('Interior bay: transverse moments per foot of deck', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Moment, kip-ft/ft</th><th>Positive<br>(midbay)</th><th></th><th>Negative<br>(design section)</th><th></th></tr></thead><tbody>
      <tr><td class="lft">Slab DC: w<sub>DC</sub>S²/11, /10 (w<sub>DC</sub> = ${ev('deck.wDLslab', 4, 'ksf')} ${wk('dk.wDC')})</td><td>${ev('deck.MDC_pos', 3)}</td><td>${wk('dk.MDCp')}</td><td>${ev('deck.MDC_neg', 3)}</td><td>${wk('dk.MDCn')}</td></tr>
      <tr><td class="lft">Wearing surface DW (w<sub>DW</sub> = ${ev('deck.wDLws', 4, 'ksf')})</td><td>${ev('deck.MDW_pos', 3)}</td><td>${wk('dk.MDWp')}</td><td>${ev('deck.MDW_neg', 3)}</td><td>${wk('dk.MDWn')}</td></tr>
      <tr><td class="lft">Live load + IM, Table A4-1 (multiple presence and IM included)</td><td>${ev('deck.MLL_pos', 3)}</td><td>${wk('dk.MLLp')}</td><td>${ev('deck.MLL_neg', 3)}</td><td>${wk('dk.MLLn')}</td></tr>
      <tr class="sel"><td class="lft">Strength I M<sub>u</sub>${own ? ` (η = ${ev('deck.own.eta', 3)}, m = ${ev('deck.own.mLL', 2)})` : ''}</td><td><b>${ev('deck.Mu_pos', 3)}</b></td><td>${wk('dk.Mup')}</td><td><b>${ev('deck.Mu_neg', 3)}</b></td><td>${wk('dk.Mun')}</td></tr></tbody></table></div>`
      + k.kv([['Girder spacing S', `${ev('deck.Ls', 3, 'ft')} (Table A4-1 row: S = ${ev('deck.A4.Sused', 3, 'ft')})`], ['Negative-moment design section from the girder ℄', `${ev('deck.xneg', 2, 'in')} (${k.esc(inp.deck.xnegAuto === false ? 'entered' : D.dsRule)}) ${wk('dk.xneg')}`],
        ['Equivalent strip widths (reference only)', `+M ${ev('deck.SWpos', 1, 'in')}, −M ${ev('deck.SWneg', 1, 'in')} (Table 4.6.2.1.3-1; the live load comes from Table A4-1)`]])
      + `<p class="note">Dead load by the continuous-slab coefficients wS²/11 (positive) and wS²/10 (negative), DC at 1.25 and DW at 1.50 (as the old app). Live load from AASHTO Table A4-1, interpolated on S and on the design-section distance; the tabulated values include the multiple presence factors and the 33 % dynamic load allowance.${D.A4.below ? ' <b>S is below 4 ft: the 4 ft row is used.</b>' : ''}${D.A4.above ? ' <b>S is above 15 ft: the 15 ft row is used; a refined analysis is required.</b>' : ''}</p>`, 'card-dkmom');
    const capRow = (key, nm, q, Mu) => { const P = `deck.${key}.`; return `<tr><td class="lft">${nm}</td><td>${ev(P + 'As', 3)}</td><td>${ev(P + 'dEff', 2)}</td><td>${ev(P + 'a', 3)}</td><td>${ev(P + 'c', 3)}</td><td>${ev(P + 'et', 4)}</td><td>${ev(P + 'phi', 3)}</td><td>${ev(P + 'phiMn', 2)}</td><td>${ev(Mu, 2)}</td><td><b>${ev(`checks.${q.i}.r`, 3)}</b></td>${st(q.c.pass)}<td>${wk(key === 'ohCap' ? 'dk.oh.r' : `dk.${key}.r`)}</td></tr>`; };
    h += k.card('Strength I: deck resistance per foot', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Section (bars)</th><th>A<sub>s</sub><br>in²/ft</th><th>d<br>in</th><th>a<br>in</th><th>c<br>in</th><th>ε<sub>t</sub></th><th>φ</th><th>φM<sub>n</sub><br>kip-ft/ft</th><th>M<sub>u</sub><br>kip-ft/ft</th><th>Ratio</th><th>Status</th><th></th></tr></thead><tbody>
      ${capRow('pos', `Positive (bottom: ${k.fx(+inp.deck.barBot, 2)} in² at ${k.fx(+inp.deck.sBot, 2)} in)`, qP, 'deck.Mu_pos')}${capRow('neg', `Negative (top: ${k.fx(+inp.deck.barTop, 2)} in² at ${k.fx(+inp.deck.sTop, 2)} in)`, qN, 'deck.Mu_neg')}${capRow('ohCap', 'Overhang (top bars)', qO, 'deck.Mu_oh')}</tbody></table></div>
      <p class="note">Rectangular section b = 12 in, d to the bar centroid (equivalent bar diameter √(4A<sub>b</sub>/π)); φ from ε<sub>t</sub> (5.5.4.2, 0.75 compression-controlled to 0.90 tension-controlled). f′<sub>c,d</sub> = ${k.fx(+inp.mat.fcd, 2)} ksi, f<sub>y</sub> = ${k.fx(+inp.deck.fyd, 0)} ksi, t<sub>s</sub> = ${k.fx(+inp.ts, 2)} in. Steps: ${wk('dk.pos.As', 'positive')}, ${wk('dk.neg.As', 'negative')}, ${wk('dk.oh.phiMn', 'overhang')}.</p>`, 'card-dkcap');
    h += k.card('Overhang (gravity and barrier)', k.kv([['Overhang o<sub>h</sub> (design girder ℄ to the deck edge)', `${ev('deck.oh', 3, 'ft')} <a href="#" data-goin="xsec">Cross-section tab</a>`], ['Barrier base width / weight', `${ev('deck.bBar', 1, 'in')} / ${ev('deck.Pbar', 3, 'klf')}`],
      ['Wheel to the support X (1 ft from the railing face)', `${ev('deck.Xoh', 3, 'ft')} ${wk('dk.X')}`], ['Strip width 45 + 10X', `${ev('deck.SWoh', 1, 'in')} ${wk('dk.SWoh')}`],
      ['M<sub>DC</sub> (slab + barrier) / M<sub>DW</sub>', `${ev('deck.MohDC', 3)} ${wk('dk.MohDC')} / ${ev('deck.MohDW', 4, 'kip-ft/ft')} ${wk('dk.MohDW')}`], ['M<sub>LL+IM</sub> (16 kip wheel, IM 1.33, multiple presence 1.20)', `${ev('deck.MohLL', 3, 'kip-ft/ft')} ${wk('dk.MohLL')}`],
      ['M<sub>u</sub> / φM<sub>n</sub>', `${ev('deck.Mu_oh', 3)} / ${ev('deck.ohCap.phiMn', 3, 'kip-ft/ft')}: <b>${ev(`checks.${qO.i}.r`, 3)}</b> ${qO.c.pass ? 'PASS' : '<b style="color:var(--fail)">FAIL</b>'} ${wk('dk.oh.r')}`]])
      + '<p class="note">The gravity and barrier-weight case on the 45 + 10X strip only. The Extreme Event II vehicular-collision cases (A13.4) still need a barrier-specific analysis.</p>', 'card-dkoh');
    h += k.card('Distribution reinforcement (9.7.3.2)', k.kv([['Bottom distribution steel, % of the positive-moment steel', `${ev('deck.distPct', 1)} % ${wk('dk.dist')}`]]) + '<p class="note">min(220/√S, 67 %), S in ft, bottom bars parallel to the girders (as the old app).</p>', 'card-dkdist');
    h += '<div id="gfx_dksec"></div>';
    h += k.card('Worked steps: deck', `<p class="note">${A}(2024) 4.6.2.1, Table A4-1, 5.6.3, 9.7. Every result is the engine's value (the moved Prestressed Bridge Design engine). Inputs: <a href="#" data-goin="dd">Diaphragms / deck tab</a>.</p>${k.steps(ctx.W.deck.steps, TOPICS, OPEN)}`);
    return h;
  }
  /* the deck over the design girder (inches; x from the deck edge): the overhang with the barrier and the design wheel, the girder ℄,
     the design section x_neg on each side, the next girder at S, the top and bottom bars at their covers; girder tops schematic */
  function secFig(R, inp, W) {
    const V = VK(), S = V.scene(), D = R.deck, ts = D.ts, oh = D.oh * 12, Sp = D.Ls * 12, bB = D.bBar, Di = inp.deck, G = R.g, btf = +G.btf || 24, x1 = oh + Sp + Math.min(Sp * 0.45, 36);
    const gx = [oh, oh + Sp], hb = 32, nar = W < 560;
    S.rect(0, 0, x1, ts, 'dt-cc');
    S.region(0, 0, x1, ts, `Deck t_s = ${V.fx(ts, 2)} in; top bars ${V.fx(+Di.barTop, 2)} in² at ${V.fx(+Di.sTop, 2)} in, bottom bars ${V.fx(+Di.barBot, 2)} in² at ${V.fx(+Di.sBot, 2)} in`);
    gx.forEach(x => { S.rect(x - btf / 2, -Math.max(4, ts * 0.6), x + btf / 2, 0, 'dt-pl'); S.line(x, -ts * 1.6, x, ts + 10, 'dt-cl'); });
    S.text(gx[0], -ts * 1.6, 'girder ℄', { a: 'start', dx: 4, dy: 30, sz: 10.5, cls: 'dt-m' });
    S.poly([[0, ts], [bB, ts], [bB * 0.62, ts + hb], [0, ts + hb]], 'dt-pl');
    S.text(bB / 2, ts + hb, 'barrier', { a: 'middle', dy: -6, sz: 10, cls: 'dt-m' });
    const xw = bB + 12; if (D.Xoh > 0) { S.arrow(xw, ts, 30, {}); S.text(xw, ts, '16 kip wheel', { a: 'start', dx: 4, dy: -34, sz: 10.5, fill: '#1E3A5F', halo: true }); S.dimH(xw, oh, ts, 12, `X = ${V.fx(D.Xoh, 2)} ft`, { sz: 10.5 }); }
    [gx[0] - D.xneg, gx[0] + D.xneg, gx[1] - D.xneg].forEach(x => S.line(x, -2, x, ts + 4, 'dt-gov'));
    S.text(gx[0] + D.xneg, ts + 4, `design section x = ${V.fx(D.xneg, 2)} in`, { a: 'start', dx: 3, dy: -2, sz: 10.5, cls: 'dt-g', halo: true });
    const dbT = D.neg.dbar, dbB = D.pos.dbar, yT = ts - +Di.coverT - dbT / 2, yB = +Di.coverB + dbB / 2;
    for (let x = 3; x < x1 - 1; x += Math.max(+Di.sTop || 6, 3)) S.circ(x, yT, dbT / 2, 'dt-bar');
    for (let x = bB + 3; x < x1 - 1; x += Math.max(+Di.sBot || 6, 3)) S.circ(x, yB, dbB / 2, 'dt-bar');
    const yG = -Math.max(4, ts * 0.6);
    S.dimH(gx[0], gx[1], yG, -18, `S = ${V.fx(D.Ls, 2)} ft`, { sz: 10.5 });
    S.dimH(0, gx[0], yG, -18, `o_h = ${V.fx(D.oh, 2)} ft`, { sz: 10.5 });
    S.dimV(0, ts, x1, 14, `t_s = ${V.fx(ts, 1)} in`, { sz: 10.5 });
    return S.render({ W, maxH: Math.min(300, Math.max(190, W * 0.3)), label: 'Deck section over the design girder' }).svg;
  }
  function after(el, ctx) {
    K().after(el, OPEN);
    const { R, inp } = ctx, k = K(), D = R.deck; if (!D) return;
    const ev = (p, d) => k.ev(R, p, d), qP = ckOf(R, 'Deck +M'), qN = ckOf(R, 'Deck −M'), qO = ckOf(R, 'Deck overhang');
    const slot = el.querySelector('#gfx_dk');
    if (slot && VA() && VA().mount) {
      const rat = [[qP, '+M', 'bottom bars'], [qN, '−M', 'top bars'], [qO, 'Overhang', 'top bars']].map(([q, id, key]) => ({ id, key, bars: [{ v: Math.min(q.c.r, 3), cls: q.c.r > 1.0001 ? 'ng' : q.c.r >= 0.9 ? 'hi' : 'ok', text: k.fx(q.c.r, 3) }], lab: [q.c.n, `M_u ${k.fx(q.c.v, 2)} / φM_n ${k.fx(q.c.lim, 2)} kip-ft/ft = ${k.fx(q.c.r, 3)}`] }));
      const mom = [['+M', D.Mu_pos, D.pos.phiMn], ['−M', D.Mu_neg, D.neg.phiMn], ['Overhang', D.Mu_oh, D.ohCap.phiMn]].map(([id, mu, pm]) => ({ id,
        bars: [{ v: mu, ci: 1, text: 'M_u ' + k.fx(mu, 2) }, { v: pm, ci: 0, text: 'φM_n ' + k.fx(pm, 2) }], lab: [id, `M_u ${k.fx(mu, 3)}, φM_n ${k.fx(pm, 3)} kip-ft/ft`] }));
      VA().mount(slot, { key: 'dk', title: 'Deck checks', sub: `strip method, per foot; S = ${k.fx(D.Ls, 2)} ft, t<sub>s</sub> = ${k.fx(D.ts, 2)} in`,
        controls: VK().tiles([{ label: '+M ratio', value: ev(`checks.${qP.i}.r`, 3), unit: qP.c.pass ? 'PASS' : 'FAIL', tone: qP.c.pass ? 'c' : 't' }, { label: '−M ratio', value: ev(`checks.${qN.i}.r`, 3), unit: qN.c.pass ? 'PASS' : 'FAIL', tone: qN.c.pass ? '' : 't' },
          { label: 'Overhang', value: ev(`checks.${qO.i}.r`, 3), unit: qO.c.pass ? 'PASS' : 'FAIL', tone: qO.c.pass ? '' : 't' }, { label: 'M<sub>u,+</sub>', value: ev('deck.Mu_pos', 2), unit: 'kip-ft/ft' },
          { label: 'M<sub>u,−</sub>', value: ev('deck.Mu_neg', 2), unit: 'kip-ft/ft' }, { label: 'Distribution', value: ev('deck.distPct', 0), unit: '% of +A<sub>s</sub>' }]),
        draw: W => VA().hbars({ aria: 'Deck check ratios and moments', panels: [{ label: 'Demand / capacity (D/C)', unit: 'D/C', limit: { v: 1, label: '1.0' }, items: rat }, { label: 'M_u (orange) and φM_n (blue), kip-ft/ft', unit: 'kip-ft/ft', items: mom }] }, W),
        hint: 'Point at (or tap) a bar for its value.', legend: VA().legend('ratio'),
        caption: '<p class="vk-cap">The engine\'s values (tables below). Display only.</p>' });
    }
    const s2 = el.querySelector('#gfx_dksec');
    if (s2 && VK() && VK().detCard) VK().detCard(s2, { id: 'dkSecFig', title: 'Deck section over the design girder', sub: 'true scale across; girder tops schematic',
      draw: W => ({ html: secFig(R, inp, W), nar: W < 560 }), hint: 'Point at (or tap) the deck for its bars.',
      cap: '<p class="vk-cap">From the deck edge: the barrier (base width as entered, its shape schematic), the design wheel 1 ft from the railing face (overhang), the design girder ℄ and the next girder at S, the negative-moment design sections (blue) at x from each girder ℄, and the top and bottom bars at their covers and spacings. Display only.</p>' });
  }
  window.PSBUiDeck = { output, after, TOPICS };
})();
