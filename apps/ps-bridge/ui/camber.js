/* apps/ps-bridge/ui/camber.js — the Camber & deflection output tab (window.PSBUiCamber). Classic script; display only. Created 2026-11-12
   (PR 2d-1, docs/ps-bridge-plan.md §2.3). As the old app's Camber tab (the elastic components at midspan, the net camber at release,
   erection, deck placement, the beam seats and final with the PCI multipliers, the live-load deflection against its limit, the haunch / screed
   and beam-seat camber at the tenth points), in the steel app's layout. Every number is the engine's (computeAll R: R.cam, R.rv, R.haunch, …),
   worked in engine/worked-end.js camber(). The graphics: the camber by stage and its components (the steel bar chart, PSBVizAlong.hbars) and
   the camber and haunch build-up along the girder (the steel along-girder chart).
     output(ctx) -> HTML; after(el, ctx). ctx = { P, inp, R, W, ui, redraw } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong, VK = () => window.PSBVizKit;
  const OPEN = new Set(['net']);
  const A = 'AASHTO LRFD 10th Ed. ';
  const TOPICS = [
    { key: 'ps', title: 'Prestress camber at midspan', ref: 'PCI Design Handbook', ids: /^cb\.(Ps|eS|d1|Ph|eHm|eHe|aH|d2|dPS)$/, res: /^cb\.dPS$/ },
    { key: 'dl', title: 'Dead-load deflections at midspan', ref: 'PCI Design Handbook', ids: /^cb\.(dSW|dDK|dDia|dSD)$/ },
    { key: 'net', title: 'Net camber by stage (PCI multipliers)', ref: 'PCI Design Handbook', ids: /^cb\.(rel|erect|deck|seat|final|haunch)$/, res: /^cb\.deck$/ },
    { key: 'll', title: 'Live-load deflection', ref: A + '2.5.2.6.2', ids: /^cb\.(dLL|llLim|ll\.r)$/, res: /^cb\.ll\.r$/ }];
  const ckOf = (R, nm) => { const i = R.checks.findIndex(c => c.n === nm); return i < 0 ? null : { i, c: R.checks[i] }; };
  const arrow = v => v >= 0 ? '↑' : '↓';
  function output(ctx) {
    const { R, inp } = ctx, k = K(), ev = (p, d, u, div) => k.ev(R, p, d, u, div), wk = k.wk, c = R.cam, m = inp.opt.mult, qL = ckOf(R, 'LL deflection');
    let h = '<div id="gfx_cb"></div>';
    const stg = [['Release (1.0 / 1.0)', 'Δ<sub>ps</sub> − Δ<sub>sw</sub>', 'cam.rel', 'cb.rel', 'the girder on the bed after transfer'],
      [`Erection (${k.fx(+m.psE, 2)} / ${k.fx(+m.swE, 2)})`, `${k.fx(+m.psE, 2)} Δ<sub>ps</sub> − ${k.fx(+m.swE, 2)} Δ<sub>sw</sub>`, 'cam.erect', 'cb.erect', 'the girder set on the bearings'],
      ['Deck placement', `Δ<sub>erect</sub> − (Δ<sub>dk</sub>${c.dDia > 1e-4 ? ' + Δ<sub>dia</sub>' : ''})`, 'cam.afterDeck', 'cb.deck', '<b>haunch and screed</b>'],
      ['Beam seat (all dead load at 1.0)', 'Δ<sub>deck</sub> − Δ<sub>sd</sub>', 'cam.seat', 'cb.seat', '<b>beam-seat elevations</b>'],
      ['Final (long-term)', `${k.fx(+m.psF, 2)} Δ<sub>ps</sub> − ${k.fx(+m.swF, 2)} Δ<sub>sw</sub> − ${k.fx(+m.dkF, 2)} (Δ<sub>dk</sub>${c.dDia > 1e-4 ? ' + Δ<sub>dia</sub>' : ''}) − ${k.fx(+m.sdF, 2)} Δ<sub>sd</sub>`, 'cam.final', 'cb.final', 'ride and appearance']];
    h += k.card('Net camber at midspan (+ up)', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Stage (PCI multipliers PS / SW)</th><th class="lft">Expression</th><th>Δ<br>in</th><th></th><th class="lft">Used for</th><th></th></tr></thead><tbody>
      ${stg.map(([lab, ex, p, s, use]) => `<tr><td class="lft">${lab}</td><td class="lft">${ex}</td><td><b>${ev(p, 3)}</b></td><td>${arrow(k.val(R, p))}</td><td class="lft">${use}</td><td>${wk(s)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">PCI Design Handbook multipliers (<a href="#" data-goin="mat">Materials tab</a>, Camber multipliers). The wet deck deflects the girder at 1.0 (not aged) at deck placement; the beam-seat camber also takes the superimposed dead load at 1.0, locked in, with no long-term effects (the MassDOT seat method, as the old app). Haunch build-up at midspan ${ev('haunch.5.buildup', 2, 'in')} ${wk('cb.haunch')}.</p>`, 'card-cbnet');
    h += k.card('Elastic components at midspan', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Component</th><th>Δ<br>in</th><th>Direction</th><th class="lft">Section, modulus</th><th></th></tr></thead><tbody>
      <tr><td class="lft">Prestress (straight${R.ss.nh > 0 ? ' + draped' : ''} strands)</td><td>${ev('cam.dPS', 3)}</td><td>↑ up</td><td class="lft">I<sub>g</sub>, E<sub>ci</sub> = ${ev('lo.Eci', 0, 'ksi')}</td><td>${wk('cb.dPS')}</td></tr>
      <tr><td class="lft">Girder self-weight</td><td>${ev('cam.dSW', 3)}</td><td>↓ down</td><td class="lft">I<sub>g</sub>, E<sub>ci</sub></td><td>${wk('cb.dSW')}</td></tr>
      <tr><td class="lft">Deck + haunch (DC1)</td><td>${ev('cam.dDK', 3)}</td><td>↓ down</td><td class="lft">I<sub>g</sub>, E<sub>c</sub> = ${ev('cp.Ecg', 0, 'ksi')}</td><td>${wk('cb.dDK')}</td></tr>
      ${c.dDia > 1e-4 ? `<tr><td class="lft">Diaphragms (point loads, DC1)</td><td>${ev('cam.dDia', 3)}</td><td>↓ down</td><td class="lft">I<sub>g</sub>, E<sub>c</sub></td><td>${wk('cb.dDia')}</td></tr>` : ''}
      <tr><td class="lft">Barrier + wearing surface (DC2 + DW)</td><td>${ev('cam.dSD', 3)}</td><td>↓ down</td><td class="lft">I<sub>c</sub> = ${ev('cp.Ic', 0, 'in⁴')}, E<sub>c</sub></td><td>${wk('cb.dSD')}</td></tr>
      <tr><td class="lft">Live load + IM (estimate)</td><td>${ev('cam.dLL', 3)}</td><td>↓ down</td><td class="lft">I<sub>c</sub>, E<sub>c</sub></td><td>${wk('cb.dLL')}</td></tr></tbody></table></div>
      <p class="note">Simple-span midspan deflections: prestress camber from the straight strands (P<sub>s</sub> e<sub>s</sub> L²/8 E<sub>ci</sub> I<sub>g</sub>)${R.ss.nh > 0 ? ' and from the draped strands (their profile with the hold-down points)' : ''}, uniform loads 5wL⁴/384EI, diaphragms Pa(3L² − 4a²)/48EI. I<sub>g</sub> = ${ev('g.I', 0, 'in⁴')}.${R.cont ? ' The girders are made continuous for composite loads: the composite-load and live-load deflections are simple-span estimates (as the old app).' : ''}</p>`, 'card-cbcomp');
    h += k.card(`Live-load deflection (${c.llDen ? 'MassDOT 3.5.6.1' : '2.5.2.6.2'})`, k.kv([['Δ<sub>LL</sub> ≈ 5 M<sub>LL</sub> L² / 48 E<sub>c</sub> I<sub>c</sub>', `${ev('cam.dLL', 3, 'in')} ${wk('cb.dLL')}`], [`Limit L/${c.llDen || 800}`, `${ev('cam.llLim', 3, 'in')} ${wk('cb.llLim')}`],
      ['Ratio', `<b>${ev(`checks.${qL.i}.r`, 3)}</b> ${qL.c.pass ? 'PASS' : '<b style="color:var(--fail)">FAIL</b>'} ${wk('cb.ll.r')}`]])
      + `<p class="note">The optional deflection criterion: live load with impact and distribution on the composite section, by an equivalent uniform load${c.llDen ? '; MassDOT 3.5.6.1 for an interior girder: L/1000 with sidewalks, else L/800' : ''}.</p>`, 'card-cbll');
    h += '<div id="gfx_cb_along"></div>';
    h += k.card('Haunch / screed and beam-seat camber at the tenth points', `<div class="tscroll"><table class="tbl"><thead><tr><th>x<br>ft</th><th>Shape factor<br>4x(L − x)/L²</th><th>Erection camber<br>in</th><th>Δ<sub>deck</sub>: haunch<br>in</th><th>Δ<sub>seat</sub>: beam seat<br>in</th><th>Haunch build-up<br>in</th></tr></thead><tbody>
      ${R.haunch.map((r, i) => { const p = `haunch.${i}.`; return `<tr${i === 5 ? ' class="sel"' : ''}><td>${ev(p + 'x', 1)}</td><td>${ev(p + 'par', 3)}</td><td>${ev(p + 'camErect', 3)}</td><td>${ev(p + 'camDeck', 3)}</td><td>${ev(p + 'camSeat', 3)}</td><td>${ev(p + 'buildup', 2)}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="note">Haunch build-up = the entered haunch t<sub>h</sub> = ${k.fx(+inp.th, 2)} in + the residual Δ<sub>deck</sub> camber (at least 0.5 in): the deck is screeded to grade before the superimposed dead load. The beam seats use Δ<sub>seat</sub>. Both shaped by 4x(L − x)/L² (zero at the bearings, one at midspan). Check the minimum haunch at midspan and the maximum at the bearings against the fabricator's tolerance.</p>`, 'card-cbhaunch');
    h += k.card('Worked steps: camber and deflection', `<p class="note">PCI Design Handbook method and AASHTO LRFD 10th Ed. (2024) 2.5.2.6.2. Every result is the engine's value (the moved Prestressed Bridge Design engine).</p>${k.steps(ctx.W.camber.steps, TOPICS, OPEN)}`);
    return h;
  }
  const HIDE = {};
  function after(el, ctx) {
    K().after(el, OPEN);
    const { R, inp } = ctx, k = K(), ev = (p, d) => k.ev(R, p, d), c = R.cam, qL = ckOf(R, 'LL deflection');
    const slot = el.querySelector('#gfx_cb');
    if (slot && VA() && VA().mount) {
      const stg = [['Release', 'rel', c.rel], ['Erection', 'erect', c.erect], ['Deck', 'haunch / screed', c.afterDeck], ['Seat', 'beam seats', c.seat], ['Final', 'long-term', c.final]];
      const cmp = [['Prestress', '↑', c.dPS], ['Self-weight', '↓', c.dSW], ['Deck + haunch', '↓', c.dDK], ...(c.dDia > 1e-4 ? [['Diaphragms', '↓', c.dDia]] : []), ['DC2 + DW', '↓', c.dSD], ['LL + IM', '↓', c.dLL]];
      VA().mount(slot, { key: 'cb', title: 'Camber and deflection at midspan', sub: `in, + up; ${k.esc(inp.girder)}, L = ${k.fx(R.L, 2)} ft`,
        controls: VK().tiles([{ label: 'At erection', value: ev('cam.erect', 2), unit: 'in ' + arrow(c.erect) }, { label: 'At deck placement', value: ev('cam.afterDeck', 2), unit: 'in ' + arrow(c.afterDeck), tone: 'c' },
          { label: 'Beam seat', value: ev('cam.seat', 2), unit: 'in ' + arrow(c.seat) }, { label: 'Final', value: ev('cam.final', 2), unit: 'in ' + arrow(c.final) },
          { label: 'Δ<sub>LL</sub>', value: ev('cam.dLL', 2), unit: 'in' }, { label: 'Δ<sub>LL</sub> / limit', value: ev(`checks.${qL.i}.r`, 3), unit: qL.c.pass ? 'PASS' : 'FAIL', tone: qL.c.pass ? '' : 't' }]),
        draw: W => VA().hbars({ aria: 'Camber by stage and its components', panels: [
          { label: 'Net camber by stage (in; orange: downward)', unit: 'in', items: stg.map(([id, key, v]) => ({ id, key, bars: [{ v: Math.abs(v), ci: v < 0 ? 1 : 0, text: (v < 0 ? '↓ ' : '↑ ') + k.fx(Math.abs(v), 2) }], lab: [`${id} (${key})`, `${k.fx(v, 3)} in ${arrow(v)}`] })) },
          { label: 'Elastic components (in)', unit: 'in', items: cmp.map(([id, dir, v]) => ({ id, bars: [{ v: Math.abs(v), ci: dir === '↑' ? 0 : 1, text: `${dir} ${k.fx(v, 3)}` }], lab: [id, `${k.fx(v, 3)} in ${dir}`] })) }] }, W),
        hint: 'Point at (or tap) a bar for its value.', caption: '<p class="vk-cap">The engine\'s midspan values (tables below): blue up, orange down. Display only.</p>' });
    }
    const s2 = el.querySelector('#gfx_cb_along');
    if (s2 && VA() && VA().mount) {
      const Hn = R.haunch, L = R.L, xs = Hn.map(r => r.x);
      const near = x => xs.reduce((b, v, i) => Math.abs(v - x) < Math.abs(xs[b] - x) ? i : b, 0);
      const SER = [{ key: 'er', html: 'erection camber', ci: 0, pts: Hn.map(r => [r.x, r.camErect]) }, { key: 'dk', html: 'Δ<sub>deck</sub> (haunch)', ci: 2, pts: Hn.map(r => [r.x, r.camDeck]) },
        { key: 'st', html: 'Δ<sub>seat</sub> (beam seat)', ci: 1, dash: '4 3', pts: Hn.map(r => [r.x, r.camSeat]) }];
      const HB = [{ key: 'hb', html: 'haunch build-up', ci: 3, pts: Hn.map(r => [r.x, r.buildup]) }];
      const grp = (label, Ls) => ({ label, items: Ls.map(q => ({ key: q.key, html: `${VA().swatch(q.ci, q.dash)} ${q.html}`, on: !HIDE[q.key] })) });
      const at = x => { const r = Hn[near(x)]; return [`x = ${k.fx(r.x, 1)} ft`, `erection ${k.fx(r.camErect, 3)}, deck ${k.fx(r.camDeck, 3)}, seat ${k.fx(r.camSeat, 3)} in; haunch ${k.fx(r.buildup, 2)} in`]; };
      VA().mount(s2, { key: 'cbx', title: 'Camber and haunch along the girder', sub: 'in, at the tenth points (+ up)',
        draw: W => VA().render({ L0: 0, L1: L, sup: [0, L], axisTitle: 'Station x, ft (from ℄ bearing, left)', aria: 'Camber and haunch build-up along the girder', rows: [
          { kind: 'chart', key: 'c', label: 'Net camber, in (+ up)', unit: 'in', series: SER, hidden: HIDE, h: W < 600 ? 130 : 170 },
          { kind: 'chart', key: 'h', label: 'Haunch build-up, in', unit: 'in', series: HB, hidden: HIDE, limits: [{ y: +inp.th, label: `t_h = ${k.fx(+inp.th, 2)} in` }], h: W < 600 ? 90 : 110 }] }, W),
        at, snap: x => xs[near(x)], chips: () => [grp('Show', SER.concat(HB))], onChip: key => { HIDE[key] = !HIDE[key]; },
        hint: 'Point at (or tap) the chart to read the station.',
        caption: '<p class="vk-cap">The engine\'s tenth-point values (the table below): the midspan camber shaped by 4x(L − x)/L². Display only.</p>' });
    }
  }
  window.PSBUiCamber = { output, after, TOPICS };
})();
