/* apps/ps-bridge/ui/handling.js — the Handling output tab (window.PSBUiHandling). Classic script; display only. Created 2026-11-13
   (PR 2d-2, docs/ps-bridge-plan.md §2.3). As the old app's Handling tab (the stresses at the lifting and hauling points, the release
   limits, the weak-axis I_y, the lateral deflection z_o and the cracking factors of safety of the simplified screening, which is not the
   PCI 2016 / Mast method), in the steel app's layout. Every number is the engine's (computeAll R.handling and its checks), worked in
   engine/worked-hdr.js handling(). The graphics: the fibre stresses and the check ratios (the steel bar chart, PSBVizAlong.hbars) and the
   girder on its lifting or hauling supports with its moment (the steel detail kit; the moment shape drawn from the engine's w and a).
   The module is optional (Loads tab, Handling): when it is off the tab says so and links to the input.
     output(ctx) -> HTML; after(el, ctx). ctx = { P, inp, R, W, ui, redraw } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong, VK = () => window.PSBVizKit;
  const OPEN = new Set(['lift']);
  const A = 'AASHTO LRFD 10th Ed. ';
  const TOPICS = [
    { key: 'lift', title: 'Lifting: moments and fibre stresses', ref: 'release stage', ids: /^hn\.(w|lift\.(Ls|Msup|Mmid|f\w+)|limC|limT|lift\.r)$/, res: /^hn\.lift\.r$/ },
    { key: 'haul', title: 'Hauling: moments and fibre stresses', ref: 'release stage', ids: /^hn\.haul\./ },
    { key: 'stab', title: 'Lateral stability (screening, not PCI / Mast)', ref: 'PCI / Mast (screening)', ids: /^hn\.(Iy|zo|FSl|FSl\.r|zoH|yrH|FSh|FSh\.r)$/, res: /^hn\.(FSl|FSh)\.r$/ }];
  const ckOf = (R, nm) => { const i = R.checks.findIndex(c => c.n === nm); return i < 0 ? null : { i, c: R.checks[i] }; };
  const pf = ok => ok ? 'PASS' : '<b class="ngt" style="color:var(--fail)">FAIL</b>';
  const ST = { stage: 'lift' };
  function output(ctx) {
    const { R, inp } = ctx, k = K();
    if (!R.handling) return k.card('Handling (lifting and hauling)', '<p class="note">The Handling checks are off for this design. Turn them on (<a href="#" data-goin="loads">Loads tab</a>, Handling) for the stresses at the lifting and hauling points and the lateral-stability screening.</p>', 'card-hnoff');
    const ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, H = R.handling;
    const qL = ckOf(R, 'Lifting stress'), qFL = ckOf(R, 'Lifting FS (crack, screening)'), qFH = ckOf(R, 'Hauling FS (crack, screening)');
    let h = '<div id="gfx_hn"></div>';
    const tbl = (key, nm, use) => { const P = `handling.${key}.`;
      return `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Location</th><th>M<br>kip-ft</th><th>Top fibre<br>ksi</th><th>Bottom fibre<br>ksi</th><th></th></tr></thead><tbody>
        <tr><td class="lft">Support (${ev(P + 'a', 1)} ft from the end, cantilever)</td><td>${ev(P + 'Msup', 1)} ${wk(`hn.${key}.Msup`)}</td><td>${ev(P + 'fSupTop', 3)} ${wk(`hn.${key}.fSupTop`)}</td><td>${ev(P + 'fSupBot', 3)} ${wk(`hn.${key}.fSupBot`)}</td><td></td></tr>
        <tr><td class="lft">Midspan (clear span L<sub>s</sub> = ${ev(P + 'Ls', 1)} ft ${wk(`hn.${key}.Ls`)})</td><td>${ev(P + 'Mmid', 1)} ${wk(`hn.${key}.Mmid`)}</td><td>${ev(P + 'fMidTop', 3)} ${wk(`hn.${key}.fMidTop`)}</td><td>${ev(P + 'fMidBot', 3)} ${wk(`hn.${key}.fMidBot`)}</td><td></td></tr>
        <tr><td class="lft">Limits (release): compression / tension</td><td></td><td colspan="2">${ev('handling.limC', 2)} ${wk('hn.limC')} / −${ev('handling.limT', 3)} ${wk('hn.limT')}</td><td></td></tr></tbody></table></div><p class="note">${use}</p>`; };
    h += k.card(`Lifting: stresses at the lifting points (a = ${ev('handling.aLift', 1)} ft)`, tbl('lift', 'Lifting', `+ compression, − tension; P = A<sub>ps</sub> f<sub>pi</sub> at release (<a href="#" data-gotab="loss">Losses tab</a>), girder self-weight w = ${ev('handling.w', 4, 'klf')} ${wk('hn.w')}. The engine checks the largest tension against 0.24√f′<sub>ci</sub> (bonded reinforcement, 5.9.2.3.1b): ratio <b>${ev(`checks.${qL.i}.r`, 3)}</b> ${pf(qL.c.pass)} ${wk('hn.lift.r')}. The compression limit is shown for comparison (no engine check).`), 'card-hnlift');
    h += k.card(`Hauling: stresses at the truck supports (a = ${ev('handling.aHaul', 1)} ft)`, tbl('haul', 'Hauling', 'The same release-stage expressions with the supports at the haul bunks. Shown for comparison: the engine reports no hauling stress check (as the old app); impact during transport is not included.'), 'card-hnhaul');
    h += k.card('Lateral stability (simplified screening)', k.kv([['Weak-axis I<sub>y</sub> (approximate, section outline)', `${ev('handling.Iy', 0, 'in⁴')} ${wk('hn.Iy')}`], ['Initial sweep e<sub>i</sub>', ev('handling.ei', 3, 'in')],
      ['Lateral CG deflection, lifting z<sub>o</sub>', `${ev('handling.zo', 3, 'in')} ${wk('hn.zo')}`], ['FS against cracking, lifting y<sub>t</sub> / (z<sub>o</sub> + e<sub>i</sub>)', `<b>${ev('handling.FScrLift', 2)}</b> (1.0 required): ratio ${ev(`checks.${qFL.i}.r`, 3)} ${pf(qFL.c.pass)} ${wk('hn.FSl')}`],
      ['Lateral CG deflection, hauling z<sub>o,h</sub>', `${ev('handling.zoH', 3, 'in')} ${wk('hn.zoH')}`], ['FS against cracking, hauling', `<b>${ev('handling.FScrHaul', 2)}</b> (1.0 required): ratio ${ev(`checks.${qFH.i}.r`, 3)} ${pf(qFH.c.pass)} ${wk('hn.FSh')}`]])
      + `<div class="alert"><b>Screening only: not the PCI (2016) / Mast method.</b> Simplified factors of safety against cracking: lifting y<sub>r</sub>/(z<sub>o</sub> + e<sub>i</sub>) with the roll axis at the top of the girder; hauling with no truck roll stiffness K<sub>θ</sub>, no tilt equilibrium, and no factor of safety against failure or rollover. I<sub>y</sub> is approximated from the section outline. For long or slender girders, confirm with the full PCI stability procedure and the hauler's roll stiffness and bunk geometry (as the old app).</div>`, 'card-hnstab');
    h += '<div id="gfx_hnel"></div>';
    h += k.card('Worked steps: handling', `<p class="note">Release-stage stresses (${A}5.9.2.3.1) and the simplified lateral-stability screening. Every result is the engine's value (the moved Prestressed Bridge Design engine). Inputs: <a href="#" data-goin="loads">Loads tab</a> (Handling).</p>${k.steps(ctx.W.handling.steps, TOPICS, OPEN)}`);
    return h;
  }
  /* the girder on its two supports (lifting loops or haul bunks) and its moment, half the girder depth exaggerated */
  function elevFig(R, W, key) {
    const V = VK(), S = V.scene(), H = R.handling, s = H[key], L = R.L, a = s.a, w = H.w, h = Math.max(0.05 * L, 2.4), lift = key === 'lift';
    S.rect(0, 0, L, h, 'dt-cc');
    S.region(0, 0, L, h, `${lift ? 'Lifting' : 'Hauling'}: supports ${V.fx(a, 2)} ft from each end, clear span ${V.fx(s.Ls, 2)} ft; w = ${V.fx(w, 4)} klf`);
    [a, L - a].forEach(x => { if (lift) { S.line(x, h, x, h + 0.9 * h, 'dt-ld'); S.dot(x, h + 0.9 * h, 4, 'dt-ldh'); } else S.poly([[x, 0], [x - 0.35 * h, -0.6 * h], [x + 0.35 * h, -0.6 * h]], 'dt-brg'); });
    S.dimH(0, a, lift ? 0 : -0.6 * h, -16, `a = ${V.fx(a, 2)} ft`, { sz: 10.5 });
    S.dimH(a, L - a, lift ? 0 : -0.6 * h, -16, `L_s = ${V.fx(s.Ls, 2)} ft`, { sz: 10.5 });
    // the moment of the stage (shape from w and a; the labels are the engine's values)
    const Mmax = Math.max(Math.abs(s.Mmid), Math.abs(s.Msup), 1e-6), yb = -1.6 * h - 0.16 * L * 0.9, sc = 0.16 * L / Mmax, M = x => { const R_ = w * L / 2; return -w * x * x / 2 + (x > a ? R_ * (x - a) : 0) + (x > L - a ? R_ * (x - L + a) : 0); };
    const pts = []; for (let i = 0; i <= 80; i++) { const x = i * L / 80; pts.push([x, yb - M(x) * sc]); }
    S.line(0, yb, L, yb, 'dt-ext');
    S.pline(pts, 'dt-ol', { stroke: '#1D4ED8', sw: 1.8 });
    S.text(L / 2, yb - s.Mmid * sc, `M_mid = ${V.fx(s.Mmid, 1)} kip-ft`, { a: 'middle', dy: 14, sz: 10.5, fill: '#1D4ED8', halo: true });
    S.text(a, yb - s.Msup * sc, `M_sup = ${V.fx(s.Msup, 1)}`, { a: 'start', dx: 6, dy: -6, sz: 10.5, fill: '#1D4ED8', halo: true });
    S.region(0, yb - 0.17 * L, L, yb + 0.02 * L, `Moment: ${V.fx(s.Msup, 1)} kip-ft at the supports, ${V.fx(s.Mmid, 1)} kip-ft at midspan`);
    S.text(0, h, lift ? 'lifting loops' : 'haul bunks', { a: 'start', dy: lift ? -46 : -8, sz: 10.5, cls: 'dt-m' });
    return S.render({ W, maxH: Math.min(320, Math.max(200, W * 0.36)), label: `Girder ${lift ? 'lifting' : 'hauling'}: supports and moment` }).svg;
  }
  function after(el, ctx) {
    K().after(el, OPEN);
    const { R, inp } = ctx, k = K(), H = R.handling; if (!H) return;
    const ev = (p, d) => k.ev(R, p, d), qL = ckOf(R, 'Lifting stress'), qFL = ckOf(R, 'Lifting FS (crack, screening)'), qFH = ckOf(R, 'Hauling FS (crack, screening)');
    const slot = el.querySelector('#gfx_hn');
    if (slot && VA() && VA().mount) {
      const fib = { label: 'Fibre stresses, lifting / hauling (ksi; orange tension)', unit: 'ksi', items: [['Support', 'top', 'fSupTop'], ['Support', 'bottom', 'fSupBot'], ['Midspan', 'top', 'fMidTop'], ['Midspan', 'bottom', 'fMidBot']].map(([id, key2, p]) => ({ id, key: key2,
        bars: ['lift', 'haul'].map(st => { const v = H[st][p]; return { v: Math.abs(v), ci: v < 0 ? 1 : 0, text: `${st} ${v < 0 ? '−' : '+'}${k.fx(Math.abs(v), 3)}` }; }),
        lab: [`${id}, ${key2}`, `lifting ${k.fx(H.lift[p], 3)}, hauling ${k.fx(H.haul[p], 3)} ksi (limits ${k.fx(H.limC, 2)} / −${k.fx(H.limT, 3)})`] })) };
      const rat = [[qL, 'Lift tension', 'stress'], [qFL, 'Lift FS', '1 / FS'], [qFH, 'Haul FS', '1 / FS']].map(([q, id, key]) => ({ id, key, bars: [{ v: Math.min(q.c.r, 3), cls: q.c.r > 1.0001 ? 'ng' : q.c.r >= 0.9 ? 'hi' : 'ok', text: k.fx(q.c.r, 3) }], lab: [q.c.n, `${k.fx(q.c.r, 3)} ${q.c.pass ? 'PASS' : 'FAIL'}`] }));
      VA().mount(slot, { key: 'hn', title: 'Handling checks', sub: `${k.esc(inp.girder)}, L = ${k.fx(R.L, 2)} ft; release stage`,
        controls: VK().tiles([{ label: 'Lifting, top at midspan', value: ev('handling.lift.fMidTop', 3), unit: 'ksi' }, { label: 'Lift ratio', value: ev(`checks.${qL.i}.r`, 3), unit: qL.c.pass ? 'PASS' : 'FAIL', tone: qL.c.pass ? 'c' : 't' },
          { label: 'FS lift', value: ev('handling.FScrLift', 2), unit: '≥ 1.0', tone: qFL.c.pass ? '' : 't' }, { label: 'FS haul', value: ev('handling.FScrHaul', 2), unit: '≥ 1.0', tone: qFH.c.pass ? '' : 't' },
          { label: 'I<sub>y</sub>', value: ev('handling.Iy', 0), unit: 'in⁴' }, { label: 'z<sub>o</sub>', value: ev('handling.zo', 3), unit: 'in (lifting)' }]),
        draw: W => VA().hbars({ aria: 'Handling fibre stresses and check ratios', panels: [{ label: 'Check ratios (D/C)', unit: 'D/C', limit: { v: 1, label: '1.0' }, items: rat }, fib] }, W),
        hint: 'Point at (or tap) a bar for its value.', legend: VA().legend('ratio'),
        caption: '<p class="vk-cap">The engine\'s values (tables below): blue compression, orange tension. Ratios: the lifting tension against 0.24√f′<sub>ci</sub> and 1/FS of the two screening factors of safety. Display only.</p>' });
    }
    const s2 = el.querySelector('#gfx_hnel');
    if (s2 && VK() && VK().detCard) {
      const card = VK().detCard(s2, { id: 'hnElFig', title: 'Girder on its supports', sub: 'elevation, depth exaggerated; moment below',
        seg: { label: 'Stage', items: [['lift', 'Lifting'], ['haul', 'Hauling']], cur: ST.stage, on: key => { ST.stage = key; card.el.querySelectorAll('[data-vkseg]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.vkseg === key))); card.redraw(); } },
        draw: W => ({ html: elevFig(R, W, ST.stage), nar: W < 560 }), hint: 'Point at (or tap) the girder or the moment for its values.',
        cap: '<p class="vk-cap">The girder (span L, the engine\'s length) on two supports a from each end, its self-weight moment drawn to scale (shape from w and a; the values written are the engine\'s). Display only.</p>' });
    }
  }
  window.PSBUiHandling = { output, after, TOPICS };
})();
