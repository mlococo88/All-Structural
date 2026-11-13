/* apps/ps-bridge/ui/loads.js — the Loads & LLDF output tab (window.PSBUiLoads). Classic script; display only. Created 2026-11-12 (PR 2b-2,
   docs/ps-bridge-plan.md §2.3). Every number is the engine's (computeAll R: wG, wDk, wBar, wDW, Pdia, cp.wdk*, hl (HL-93 per lane), df (the
   distribution factor terms), dfm, dfv, MLL, VLL, own), worked in engine/worked.js loads(). The graphic (the cross-section of the girder lines
   with the design girder, the steel app's detail style) draws the bridge's entered geometry. The Steel Bridge DC2 / DW distribution to every
   girder (unequal bays, PS-9) comes with PR 3a; DC2 and DW are entered per girder until then.
     output(ctx) -> HTML; after(el, ctx). ctx = { P, inp, R, W, ui } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VK = () => window.PSBVizKit;
  const OPEN = new Set(['df']);
  const A = 'AASHTO LRFD 10th Ed. ';
  const TOPICS = [
    { key: 'own', title: 'Owner load rules (η, m)', ref: A + '1.3.2.1', ids: /^ld\.(eta|mLL)$/, res: /^ld\.eta$/ },
    { key: 'dl', title: 'Dead loads per girder (DC1, DC2, DW)', ref: A + '3.5.1', ids: /^ld\.(wg|wdeck|whaunch|wDC1|Pdia|wDC2|wDW)$/, res: /^ld\.wDC1$/ },
    // PR 3a-3: the Steel Bridge app's DC2 / DW distribution to each line (engine/bridge-dl.js, steps dl.*; only when distributed)
    { key: 'dld', title: 'DC2 and DW distributed to the girder lines (the Steel Bridge app\'s method)', ref: A + '3.5.1, 4.6.2.2.1; MassDOT BDM 3.5.3; RIDOT BDM 3.3.1', ids: /^dl\./, res: /^dl\.G\d+\.DC2$/ },
    { key: 'hlm', title: 'HL-93 moment per lane (simple span)', ref: A + '3.6.1.2, 3.6.1.3', ids: /^ld\.(Mtr|Mtd|Mln|M)$/, res: /^ld\.M$/ },
    { key: 'hlv', title: 'HL-93 shear per lane (simple span)', ref: A + '3.6.1.2, 3.6.1.3', ids: /^ld\.(Vtr|Vtd|Vln|V)$/, res: /^ld\.V$/ },
    { key: 'kg', title: 'Stiffness parameter', ref: A + '4.6.2.2.1', ids: /^ld\.(Sf|eg|Kg)$/, res: /^ld\.Kg$/ },
    { key: 'int', title: 'Interior girder equations', ref: A + 'Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1', ids: /^ld\.(m1|m2|v1|v2)$/ },
    { key: 'ext', title: 'Exterior girder: lever rule, e, rigid section', ref: A + '4.6.2.2.2d, 4.6.2.2.3b', ids: /^ld\.(lever|eM|eV|rigid|rigXbar|rigXext|rigSx2)$/ },
    { key: 'df', title: 'Distribution factors used', ref: A + '4.6.2.2.2e, 4.6.2.2.3c', ids: /^ld\.(dfmRaw|dfvRaw|c1|skM|skV|dfm|dfv)$/, res: /^ld\.dfm$/ },
    { key: 'll', title: 'Live load per girder', ref: A + '3.6.1.3, 4.6.2.2', ids: /^ld\.(MLL|VLL)$/, res: /^ld\.MLL$/ }];
  function output(ctx) {
    const { R, inp, P } = ctx, k = K(), ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, df = R.df, cp = R.cp, own = R.own;
    const simple = !R.fe && !R.useExt, DL = window.PSBBridgeDL, dist = !!(DL && DL.on(P)), dg = window.PSBDesign.sel(P).g;   // PR 3a-3
    let h = '<div id="gfx_ld"></div>';
    h += k.card('Owner load rules', k.kv([['Owner', k.esc(own ? own.owner : 'AASHTO')], ['Load modifier η (Strength I)', `${own ? ev('own.eta', 4) : '1.0000'} ${wk('ld.eta')}`],
      ['HL-93 design load multiplier m', `${own ? ev('own.mLL', 2) : '1.00'} ${wk('ld.mLL')}`]]) + '<p class="note">Owner and its questions: <a href="#" data-goin="own">Owner rules tab</a>.</p>');
    const row = (lab, how, v, link) => `<tr><td class="lft">${lab}</td><td class="lft">${how}</td><td>${v}</td><td>${link || ''}</td></tr>`;
    h += k.card('Dead loads on the design girder', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Load</th><th class="lft">Section and source</th><th>Value</th><th></th></tr></thead><tbody>
      ${row('DC1 girder self-weight w<sub>g</sub>', 'non-composite; from the section', ev('wG', 4, 'klf'), wk('sec.g.wsw', '§', 'sec'))}
      ${row('DC1 deck slab', `non-composite; ${cp.extG ? 'exterior: (S/2 + overhang)' : 'tributary'} width`, ev('cp.wdkDeck', 4, 'klf'), cp.wdkDeck > 0 || +inp.ts > 0 ? wk('ld.wdeck') : '')}
      ${cp.wdkHaunch > 0 ? row('DC1 haunch', 'non-composite; top flange width × haunch', ev('cp.wdkHaunch', 4, 'klf'), wk('ld.whaunch')) : ''}
      ${row('DC1 additional (forms, …)', 'non-composite; entered (Loads tab)', `${k.fx(+inp.loads.wNC, 4)} klf`, '')}
      ${row('DC1 distributed (deck + haunch + additional)', 'on the bare girder', ev('wDk', 4, 'klf'), wk('ld.wDC1'))}
      ${R.nDiaph ? row(`DC1 diaphragms (${R.nDiaph} point loads)`, 'non-composite simple span; entered (Diaphragms / deck tab)', ev('Pdia', 2, 'kip'), wk('ld.Pdia')) : ''}
      ${row('DC2 barrier / superimposed', `composite${R.fe ? ', continuous unit' : ''}; ${dist ? `distributed to G${dg} (Cross-section tab)` : 'entered per girder'}`, ev('wBar', 4, 'klf'), dist ? wk(`dl.G${dg}.DC2`) : wk('ld.wDC2'))}
      ${row('DW wearing surface', `composite${R.fe ? ', continuous unit' : ''}; ${dist ? `distributed to G${dg} (Cross-section tab)` : 'entered per girder'}`, ev('wDW', 4, 'klf'), dist ? wk(`dl.G${dg}.DW`) : wk('ld.wDW'))}
      </tbody></table></div><p class="note">${dist ? 'DC2 and DW: the Steel Bridge app\'s distribution of the barriers, sidewalks and wearing surface to each girder line (PS-9; table below).' : 'DC2 and DW are entered per girder type (Loads tab); the Cross-section tab can distribute them to each girder line (PS-9).'}</p>`);
    if (dist) h += window.PSBBridgeDLUI.lineTable(P, dg, k);
    h += k.card('HL-93 per lane (simple span L = ' + k.fx(R.L, 2) + ' ft)', k.kv([['Truck M<sub>tr</sub> (midspan)', `${ev('hl.Mtr', 1, 'kip-ft')} ${wk('ld.Mtr')}`], ['Tandem M<sub>td</sub>', `${ev('hl.Mtd', 1, 'kip-ft')} ${wk('ld.Mtd')}`], ['Lane M<sub>ln</sub>', `${ev('hl.Mln', 1, 'kip-ft')} ${wk('ld.Mln')}`],
      ['M<sub>LL+IM</sub> per lane', `${ev('hl.M', 1, 'kip-ft')} ${wk('ld.M')}`], ['Truck V<sub>tr</sub> (support)', `${ev('hl.Vtr', 2, 'kip')} ${wk('ld.Vtr')}`], ['Tandem V<sub>td</sub>', `${ev('hl.Vtd', 2, 'kip')} ${wk('ld.Vtd')}`], ['Lane V<sub>ln</sub>', `${ev('hl.Vln', 2, 'kip')} ${wk('ld.Vln')}`],
      ['V<sub>LL+IM</sub> per lane', `${ev('hl.V', 2, 'kip')} ${wk('ld.V')}`], ['Fatigue truck M (one lane, no IM)', ev('hl.Mfat', 1, 'kip-ft')]])
      + `<p class="note">IM = 33 % on the truck and tandem (3.6.2.1).${simple ? '' : ' The continuous unit is analysed with the same vehicles on its influence lines (Analysis tab); these simple-span values are for reference.'}</p>`);
    const ext = df.ext, dfr = [['K<sub>g</sub>', df.isNext && df.kgOmitted ? 'not used (no topping)' : `${ev('df.Kg', 0, 'in⁴')} ${wk('ld.Kg')}`], ['e<sub>g</sub>', df.isNext && df.kgOmitted ? '—' : `${ev('df.eg', 3, 'in')} ${wk('ld.eg')}`],
      ['g<sub>M</sub>: one lane / two or more', `${ev('df.m1', 4)} / ${ev('df.m2', 4)} ${wk('ld.m1')}`], ['g<sub>V</sub>: one lane / two or more', `${ev('df.v1', 4)} / ${ev('df.v2', 4)} ${wk('ld.v1')}`],
      ...(ext ? [['Lever rule (one lane, m = 1.2)', `${ev('df.lever', 4)} ${wk('ld.lever')}`], ['e<sub>M</sub> / e<sub>V</sub>', `${ev('df.eM', 4)} / ${ev('df.eV', 4)} ${wk('ld.eM')}`], ['Rigid cross-section', `${ev('df.rigid', 4)} (${df.rigidNL} lane${df.rigidNL === 1 ? '' : 's'}) ${wk('ld.rigid')}`]] : []),
      ['Skew θ', ev('df.th', 1, '°')], ['Moment skew reduction r<sub>M</sub>', `${ev('df.skM', 4)} ${wk('ld.skM')}`], ['Shear skew correction', `${ev('df.skV', 4)} ${wk('ld.skV')}`],
      ['DF<sub>M</sub> used', `<b>${ev('dfm', 4, 'lanes')}</b> ${wk('ld.dfm')}`], ['DF<sub>V</sub> used', `<b>${ev('dfv', 4, 'lanes')}</b> ${wk('ld.dfv')}`],
      ['M<sub>LL+IM</sub> per girder, midspan', `<b>${ev('MLL', 1, 'kip-ft')}</b> ${wk('ld.MLL')}`], ['V<sub>LL+IM</sub> per girder, support', `<b>${ev('VLL', 2, 'kip')}</b> ${wk('ld.VLL')}`]];
    h += k.card(`Live load distribution factors: ${ext ? 'exterior' : 'interior'} girder${df.isNext ? ' (NEXT)' : ''}`, k.kv(dfr)
      + `<p class="note">${inp.loads.dfAuto ? `AASHTO equations, cross-section type ${df.isNext ? '(i)/(j)' : '(k)'}; S = ${k.fx(df.isNext ? df.Sf : inp.S, 3)} ft, L = ${k.fx(R.L, 2)} ft, N<sub>b</sub> = ${inp.nGirders}.` : 'Distribution factors entered on the Loads tab.'}${(R.g.isBox || R.g.isDeck) && inp.loads.dfAuto ? ' <b>Adjacent box / deck beams use other equations (types f/g with J); this engine applies type (k): enter the factors for these beams.</b>' : ''} Position and skew from the bridge (<a href="#" data-goin="gird">Design girder card</a>).</p>`);
    h += k.card('Worked steps: loads and distribution factors', `<p class="note">AASHTO LRFD 10th Ed. (2024). Every result is the engine's value.</p>${k.steps(ctx.W.loads.steps, TOPICS, OPEN)}`);
    return h;
  }
  /* the cross-section: deck, girder lines (rectangles), the design girder highlighted; display only (ft) */
  function figure(ctx, W) {
    const { P, inp } = ctx, V = VK(), S = V.scene(), off = window.PSBModel.girderOffsets(P), Wd = off[off.length - 1] + (+P.xs.ohR || 0), d = window.PSBDesign.sel(P);
    const t = 0.7, hg = 3;
    S.rect(0, 0, Wd, t, 'dt-cc');
    off.forEach((x, i) => { S.rect(x - 0.6, -hg, x + 0.6, 0, i + 1 === d.g ? 'dt-govf' : 'dt-pl'); S.text(x, -hg, `G${i + 1}`, { a: 'middle', dy: 14, sz: 11, w: i + 1 === d.g });
      S.region(x - 0.8, -hg, x + 0.8, t, `G${i + 1} at ${V.fx(x, 2)} ft from the left deck edge${i + 1 === d.g ? ' (design girder)' : ''}`); });
    for (let i = 0; i + 1 < off.length; i++) S.dimH(off[i], off[i + 1], t, 16, `${V.fx(off[i + 1] - off[i], 2)} ft`);
    S.dimH(0, off[0], t, 16, `${V.fx(off[0], 2)}`); S.dimH(off[off.length - 1], Wd, t, 16, `${V.fx(Wd - off[off.length - 1], 2)}`);
    S.text(off[d.g - 1], t, `design girder (${inp.loads.pos})`, { a: 'middle', dy: -44, sz: 11, cls: 'dt-g' });
    const r = S.render({ W, maxH: 220, label: 'Bridge cross-section with the design girder' });
    return { html: r.svg, nar: W < 560 };
  }
  function after(el, ctx) {
    K().after(el, OPEN);
    const slot = el.querySelector('#gfx_ld'); if (!slot || !VK() || !VK().detCard) return;
    const { R } = ctx, k = K(), ev = (p, d) => k.ev(R, p, d);
    VK().detCard(slot, { id: 'ldFig', title: 'Cross-section and design girder', sub: 'girder lines from the left deck edge',
      top: VK().tiles([{ label: 'DC1 w<sub>DC1</sub>', value: ev('wDk', 3), unit: 'klf' }, { label: 'DC2', value: ev('wBar', 3), unit: 'klf' }, { label: 'DW', value: ev('wDW', 3), unit: 'klf' },
        { label: 'DF<sub>M</sub>', value: ev('dfm', 3), unit: 'lanes', tone: 'c' }, { label: 'DF<sub>V</sub>', value: ev('dfv', 3), unit: 'lanes', tone: 'c' }, { label: 'M<sub>LL+IM</sub>', value: ev('MLL', 0), unit: 'k-ft', tone: 't' }]),
      draw: W => figure(ctx, W), hint: 'Point at a girder for its location.', cap: '<p class="vk-cap">Entered bridge cross-section (Cross-section tab); the design girder outlined. Display only.</p>' });
  }
  window.PSBUiLoads = { output, after, TOPICS };
})();
