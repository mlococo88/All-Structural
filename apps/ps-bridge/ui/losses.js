/* apps/ps-bridge/ui/losses.js — the Losses output tab (window.PSBUiLosses). Classic script; display only. Created 2026-11-12 (PR 2c-1,
   docs/ps-bridge-plan.md §2.3). As the old app's Losses tab (elastic shortening, long-term losses by the refined and the approximate method,
   elastic gains, strand force and stress by row and stage), in the steel app's layout. Every number is the engine's (computeAll R: R.lo,
   R.refFin, R.gains, R.strandStages, …), worked in engine/worked-stress.js losses(); the graphics: the loss components and the strand
   stress through the stages (the steel bar chart, PSBVizAlong.hbars) and the strand pattern (ui/strands.js).
     output(ctx) -> HTML; after(el, ctx). ctx = { P, inp, R, W, ui } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong, VK = () => window.PSBVizKit;
  const OPEN = new Set(['tot']);
  const A = 'AASHTO LRFD 10th Ed. ';
  const TOPICS = [
    { key: 'es', title: 'Elastic shortening', ref: A + '5.9.3.2.3a', ids: /^ls\.(fpbt|Eci|Mg|X1|dfES|fpt|Pi|fcgp)$/, res: /^ls\.dfES$/ },
    { key: 'apx', title: 'Long-term losses, approximate method', ref: A + '5.9.3.3', ids: /^ls\.apx\./, res: /^ls\.apx\.total$/ },
    { key: 'ref', title: 'Long-term losses, refined method', ref: A + '5.9.3.4', ids: /^ls\.(ref|ss)\./, res: /^ls\.ref\.total$/ },
    { key: 'tot', title: 'Total loss and effective prestress', ref: A + '5.9.3.1', ids: /^ls\.(LT|total|pct|fpe|Pe)$/, res: /^ls\.fpe$/ },
    { key: 'gain', title: 'Elastic gains', ref: A + 'C5.9.3.4.3', ids: /^ls\.gain\./, res: /^ls\.gain\.fpe$/ },
    { key: 'row', title: 'Strand stress by row and stage (row 1; the table covers every row)', ref: A + '5.9.3', ids: /^ls\.row\./ }];
  function output(ctx) {
    const { R, inp } = ctx, k = K(), ev = (p, d, u, div) => k.ev(R, p, d, u, div), wk = k.wk, lo = R.lo, rf = lo.ref, fin = R.refFin, gn = R.gains, ss = R.ss, refd = inp.opt.lossMethod === 'refined';
    let h = '<div id="gfx_loss"></div>';
    h += k.card('Prestress losses', k.kv([
      ['Stress before transfer f<sub>pbt</sub>', `${ev('fpbt', 2, 'ksi')} ${wk('ls.fpbt')}`], ['Elastic shortening Δf<sub>pES</sub>', `${ev('lo.dfES', 2, 'ksi')} ${wk('ls.dfES')}`],
      ['After transfer f<sub>pi</sub> = f<sub>pt</sub>', `${ev('fpi', 2, 'ksi')} ${wk('ls.fpt')}`], ['P<sub>i</sub> (all strands, midspan)', `${ev('lo.Pi', 0, 'kip')} ${wk('ls.Pi')}`],
      ['f<sub>cgp</sub>', `${ev('lo.fcgp', 3, 'ksi')} ${wk('ls.fcgp')}`], [`Long-term Δf<sub>pLT</sub> (${refd ? 'refined' : 'approximate'})`, `${ev('LT', 2, 'ksi')} ${wk('ls.LT')}`],
      ['Total loss Δf<sub>pT</sub>', `${ev('totalLoss', 2, 'ksi')} (${ev('pctLoss', 1)} %) ${wk('ls.total')}`], ['Effective prestress f<sub>pe</sub>', `<b>${ev('fpe', 2, 'ksi')}</b> ${wk('ls.fpe')}`],
      ['P<sub>e</sub> = A<sub>ps</sub> f<sub>pe</sub>', `${k.fx(ss.Aps * R.fpe, 0)} kip ${wk('ls.Pe')}`]])
      + `<p class="note">The ${refd ? 'refined' : 'approximate'} method is used for every check (loss method: <a href="#" data-goin="mat">Materials tab</a>); losses computed at midspan and applied along the girder, as the old app. f<sub>pe</sub> without elastic gains (the service checks' value, <a href="#" data-gotab="str">Stresses tab</a>).</p>`, 'card-loss');
    const gRow = (lab, sec, key, type, step) => `<tr><td class="lft">${lab}</td><td class="lft">${sec}</td><td>${ev('gains.' + key, 2)}</td><td>${k.fx(gn[key] * ss.Aps, 0)}</td><td class="lft">${type}</td><td>${wk(step)}</td></tr>`;
    const dss = Math.abs(gn.deckShr) > 0.005;
    h += k.card('Elastic gains (C5.9.3.4.3)', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Source</th><th class="lft">Section</th><th>Δf<sub>p</sub><br>ksi</th><th>ΔP<sub>e</sub><br>kip</th><th class="lft">Type</th><th></th></tr></thead><tbody>
      ${gRow('DC1 (deck, haunch, diaphragms)', 'girder', 'precast', 'permanent', 'ls.gain.pc')}${gRow('DC2 + DW', 'composite', 'composite', 'permanent', 'ls.gain.cmp')}${gRow('LL + IM', 'composite', 'live', 'transient', 'ls.gain.ll')}
      ${dss ? gRow(`Deck shrinkage (${inp.opt.dfpSSauto ? 'computed' : 'entered'})`, 'composite', 'deckShr', refd ? 'in Δf<sub>pLT</sub> (refined)' : 'not in Δf<sub>pLT</sub> (approximate)', 'ls.ss.dfSS') : ''}
      <tr><td class="lft"><b>Permanent gains (DC1 + DC2 + DW)</b></td><td></td><td><b>${ev('gains.permanent', 2)}</b></td><td>${k.fx(gn.permanent * ss.Aps, 0)}</td><td></td><td>${wk('ls.gain.perm')}</td></tr></tbody></table></div>
      <p class="note">Δf<sub>p</sub> = (E<sub>p</sub>/E<sub>c</sub>) M e / I on the section that carries each load; + = a gain. f<sub>pe</sub> with the permanent gains credited = ${ev('fpe', 2)} + ${ev('gains.permanent', 2)} = <b>${ev('fpeGain', 2, 'ksi')}</b> ${wk('ls.gain.fpe')}. The live-load gain applies only in combinations with live load. The checks use f<sub>pe</sub> without gains (conservative); the gains show the margin. <span id="gain-ss-note">${refd
        ? `Δf<sub>pSS</sub> = ${ev('gains.deckShr', 2, 'ksi')} is already in the long-term loss Δf<sub>pLT</sub> (refined method, 5.9.3.4.3: it reduces the loss) ${wk('ls.ss.dfSS')}, so it is not added again here.`
        : `Δf<sub>pSS</sub> (${ev('gains.deckShr', 2, 'ksi')}) is not credited: the approximate method (5.9.3.3) has no deck shrinkage term, and it is not added as a gain here.`}</span></p>`, 'card-gain');
    const S = R.strandStages;
    h += k.card('Strand force and stress by row and stage', `<div class="tscroll"><table class="tbl"><thead><tr><th rowspan="2">Row y<br>in</th><th rowspan="2">e<br>in</th><th rowspan="2">n</th><th colspan="2">At release</th><th colspan="2">Transfer to deck</th><th colspan="2">Permanent (final)</th></tr>
      <tr><th>f<sub>pt</sub> ksi</th><th>P kip</th><th>f<sub>pD</sub> ksi</th><th>P kip</th><th>f<sub>pe</sub> ksi</th><th>P kip</th></tr></thead><tbody>
      ${S.rows.map((r, i) => { const p = `strandStages.rows.${i}.`; return `<tr><td>${ev(p + 'y', 1)}${r.harped ? ' <b class="drp">draped</b>' : ''}</td><td>${ev(p + 'e', 1)}</td><td>${ev(p + 'n', 0)}</td><td>${ev(p + 'fpt', 1)}</td><td>${ev(p + 'Ppt', 0)}</td><td>${ev(p + 'fpDeck', 1)}</td><td>${ev(p + 'PpDeck', 0)}</td><td>${ev(p + 'fpe', 1)}</td><td>${ev(p + 'Ppe', 0)}</td></tr>`; }).join('')}
      <tr><td class="lft"><b>Total</b></td><td></td><td>${ev('strandStages.tot.n', 0)}</td><td></td><td>${ev('strandStages.tot.Ppt', 0)}</td><td></td><td>${ev('strandStages.tot.PpDeck', 0)}</td><td></td><td><b>${ev('strandStages.tot.Ppe', 0)}</b></td></tr></tbody></table></div>
      <p class="note">Each row at its own eccentricity: elastic shortening, creep and the gains scale with the concrete stress at the row (factor r<sub>i</sub>); shrinkage and relaxation do not. "draped": the draped strands at their midspan centroid. Permanent stage without elastic gains. Worked for row 1 ${wk('ls.row.fac')}; force = stress × n × A<sub>b</sub> (A<sub>b</sub> = ${ev('strandStages.Ab', 3, 'in²')}).</p>`, 'card-rows');
    const tr = (lab, stage, path, step) => `<tr><td class="lft">${lab}</td><td class="lft">${stage}</td><td>${ev(path, 3)}</td><td>${wk(step)}</td></tr>`;
    h += k.card(`Refined estimate (5.9.3.4)${refd ? ': used' : ': not used'}`, `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Component</th><th class="lft">Stage</th><th>Δf<sub>p</sub> ksi</th><th></th></tr></thead><tbody>
      ${tr('Shrinkage Δf<sub>pSR</sub>', 'transfer to deck', 'lo.ref.dfSR', 'ls.ref.dfSR')}${tr('Creep Δf<sub>pCR</sub>', 'transfer to deck', 'lo.ref.dfCR', 'ls.ref.dfCR')}${tr('Relaxation Δf<sub>pR1</sub>', 'transfer to deck', 'lo.ref.dfR1', 'ls.ref.dfR1')}
      ${tr('Shrinkage Δf<sub>pSD</sub>', 'deck to final', 'lo.ref.dfSD', 'ls.ref.dfSD')}${tr('Creep Δf<sub>pCD</sub>', 'deck to final', 'refFin.dfCD', 'ls.ref.dfCD')}${tr('Relaxation Δf<sub>pR2</sub>', 'deck to final', 'refFin.dfR2', 'ls.ref.dfR2')}
      ${tr('Deck shrinkage gain Δf<sub>pSS</sub> (subtracted)', 'deck to final', 'refFin.dfSS', 'ls.ss.dfSS')}<tr><td class="lft"><b>Σ long-term</b></td><td></td><td><b>${ev('refFin.total', 3)}</b></td><td>${wk('ls.ref.total')}</td></tr></tbody></table></div>
      <p class="note">k<sub>s</sub> = ${ev('lo.ref.ks', 3)}, k<sub>hs</sub> = ${ev('lo.ref.khs', 3)}, k<sub>hc</sub> = ${ev('lo.ref.khc', 3)}, k<sub>f</sub> = ${ev('lo.ref.kf', 3)}, ψ<sub>b</sub>(t<sub>f</sub>, t<sub>i</sub>) = ${ev('lo.ref.psiBIF', 3)}, K<sub>id</sub> = ${ev('lo.ref.Kid', 3)}, K<sub>df</sub> = ${ev('lo.ref.Kdf', 3)}, Δf<sub>cd</sub> = ${ev('dfcd', 3, 'ksi')}, f<sub>cgp</sub> = ${ev('lo.fcgp', 3, 'ksi')} ${wk('ls.ref.ks')}.</p>`, 'card-ref')
      + k.card(`Approximate estimate (5.9.3.3)${refd ? ': not used' : ': used'}`, `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Component</th><th>Δf<sub>p</sub> ksi</th><th></th></tr></thead><tbody>
      <tr><td class="lft">Creep + shrinkage 10 f<sub>pi</sub>A<sub>ps</sub>/A<sub>g</sub> γ<sub>h</sub>γ<sub>st</sub> + 12 γ<sub>h</sub>γ<sub>st</sub></td><td>${ev('lo.apx.SH_CR', 3)}</td><td>${wk('ls.apx.shcr')}</td></tr><tr><td class="lft">Relaxation Δf<sub>pR</sub></td><td>${ev('lo.apx.R', 3)}</td><td>${wk('ls.apx.R')}</td></tr>
      <tr><td class="lft"><b>Σ long-term</b></td><td><b>${ev('lo.apx.total', 3)}</b></td><td>${wk('ls.apx.total')}</td></tr></tbody></table></div><p class="note">γ<sub>h</sub> = ${ev('rv.gh', 3)}, γ<sub>st</sub> = ${ev('rv.gst', 3)}.</p>`, 'card-apx');
    h += '<div id="gfx_loss_str"></div>';
    h += k.card('Worked steps: losses', `<p class="note">AASHTO LRFD 10th Ed. (2024). Every result is the engine's value (the moved Prestressed Bridge Design engine); both long-term methods are worked, the ${refd ? 'refined' : 'approximate'} one is used.</p>${k.steps(ctx.W.losses.steps, TOPICS, OPEN)}`);
    return h;
  }
  function after(el, ctx) {
    K().after(el, OPEN);
    const { R, inp } = ctx, k = K(), lo = R.lo, rf = lo.ref, fin = R.refFin, refd = inp.opt.lossMethod === 'refined', ev = (p, d) => k.ev(R, p, d);
    const slot = el.querySelector('#gfx_loss');
    if (slot && VA() && VA().mount) {
      const comp = refd ? [['ES', 'elastic shortening', lo.dfES], ['SR', 'shrinkage to deck', rf.dfSR], ['CR', 'creep to deck', rf.dfCR], ['R1', 'relaxation to deck', rf.dfR1], ['SD', 'shrinkage, deck to final', rf.dfSD], ['CD', 'creep, deck to final', fin.dfCD], ['R2', 'relaxation, deck to final', fin.dfR2], ['−SS', 'deck shrinkage gain', -fin.dfSS]]
        : [['ES', 'elastic shortening', lo.dfES], ['CR+SR', 'creep + shrinkage', lo.apx.SH_CR], ['R', 'relaxation', lo.apx.R]];
      const stg = [['f_pbt', 'before transfer', R.fpbt], ['f_pi', 'after transfer', R.fpi], ['f_pe', 'after all losses', R.fpe], ['f_pe,gain', 'with permanent gains', R.fpeGain]];
      VA().mount(slot, { key: 'loss', title: 'Prestress losses', sub: `${refd ? 'refined (5.9.3.4)' : 'approximate (5.9.3.3)'} method; ${R.ss.Ntot} strands, ${k.esc(inp.str.size)}`,
        controls: VK().tiles([{ label: 'Δf<sub>pES</sub>', value: ev('lo.dfES', 2), unit: 'ksi' }, { label: 'Δf<sub>pLT</sub>', value: ev('LT', 2), unit: 'ksi' }, { label: 'Total loss', value: ev('totalLoss', 2), unit: 'ksi' },
          { label: 'Share of f<sub>pbt</sub>', value: ev('pctLoss', 1), unit: '%' }, { label: 'f<sub>pe</sub>', value: ev('fpe', 2), unit: 'ksi', tone: 't' }, { label: 'f<sub>pe</sub> with gains', value: ev('fpeGain', 2), unit: 'ksi' }]),
        draw: W => VA().hbars({ aria: 'Loss components and strand stress', panels: [
          { label: 'Loss components Δf_p (ksi)', unit: 'ksi', items: comp.map(([id, key, v]) => ({ id, bars: [{ v: Math.abs(v), ci: v < 0 ? 1 : 0, text: k.fx(v, 2) }], lab: [`${id}: ${key}`, `${k.fx(v, 3)} ksi${v < 0 ? ' (a gain)' : ''}`] })) },
          { label: 'Strand stress (ksi)', unit: 'ksi', items: stg.map(([id, key, v]) => ({ id, bars: [{ v, ci: 0, text: k.fx(v, 1) }], lab: [`${id}: ${key}`, `${k.fx(v, 2)} ksi`] })) }] }, W),
        hint: 'Point at (or tap) a bar for its value.', caption: `<p class="vk-cap">The engine's values (tables below). ${refd ? 'ES elastic shortening; SR, CR, R1 shrinkage, creep and relaxation from transfer to deck placement; SD, CD, R2 from deck placement to final; −SS the deck shrinkage gain (subtracted). ' : 'ES elastic shortening; CR+SR creep and shrinkage; R relaxation. '}Strand stress: before transfer, after transfer, after all losses, with the permanent elastic gains. Display only.</p>` });
    }
    const s2 = el.querySelector('#gfx_loss_str'); if (s2 && window.PSBStrandGfx) window.PSBStrandGfx.mount(s2, ctx, { id: 'lossStrandFig', title: 'Strand pattern (the rows of the table above)' });
  }
  window.PSBUiLosses = { output, after, TOPICS };
})();
