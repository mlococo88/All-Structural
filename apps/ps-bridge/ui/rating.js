/* apps/ps-bridge/ui/rating.js — the Rating output tab (window.PSBUiRating). Classic script; display only. Created 2026-11-13 (PR 2d-2,
   docs/ps-bridge-plan.md §2.3). As the old app's Rating tab (the LRFR rating of the HL-93 design load: flexure at the governing station,
   shear at the governing shear section, Service III; φ_c φ_s; the entered legal / permit vehicles), in the steel app's layout. Every number
   is the engine's (computeAll R.rating, R.shrRating, R.svcRating, R.vehRatings), worked in engine/worked-hdr.js rating(). The graphics: the
   rating factors against 1.0 (the steel bar chart, PSBVizAlong.hbars) and the rated sections along the span (the steel detail kit).
   The MBE citations are the old app's labels (article numbers, no edition) so that the tab matches the old app (harness B); the MBE 4th
   Ed. (2026) labels come in their own PR (plan §5 PR 6, PS-14 e). The old tab's "Send capacity to MCT Rating" hand-off is not carried here
   (the cross-tool connections move with the switch-over, plan §5). φ_c, φ_s and the vehicles are inputs on the Loads tab.
     output(ctx) -> HTML; after(el, ctx). ctx = { P, inp, R, W, ui, redraw } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong, VK = () => window.PSBVizKit;
  const OPEN = new Set(['flex']);
  const TOPICS = [
    { key: 'cs', title: 'Condition and system factors', ref: 'MBE 6A.4.2.3, 6A.4.2.4', ids: /^rt\.phiCS$/ },
    { key: 'flex', title: 'Flexure rating at the governing station', ref: 'MBE 6A.4 · Strength I', ids: /^rt\.(Rn|MDC|MDW|MLL|RFinv|RFopr|RFmid)$/, res: /^rt\.RFinv$/ },
    { key: 'shear', title: 'Shear rating at the governing shear section', ref: 'MBE 6A.5.6 · Strength I', ids: /^rt\.(phiVn|VDC|VDW|VLL|RFvInv|RFvOpr)$/, res: /^rt\.RFvInv$/ },
    { key: 's3', title: 'Service III rating (prestressed concrete)', ref: 'MBE 6A.5.4.1', ids: /^rt\.(fPS|fDC|fDW|fLL|fr|RFs3)$/, res: /^rt\.RFs3$/ },
    { key: 'veh', title: 'Legal / permit vehicles (entered factored forces)', ref: 'MBE 6A.4.4 / 6A.4.5', ids: /^rt\.veh\d+\./ }];
  const rfs = v => v >= 99 ? '—' : null;
  const okT = (ok, v) => v >= 99 ? '<td class="lft">n/a</td>' : `<td class="${ok ? 'ok' : 'ngt'}">${ok ? '≥ 1.0' : '< 1.0'}</td>`;
  function output(ctx) {
    const { R, inp } = ctx, k = K(), ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, rt = R.rating, sh = R.shrRating, sv = R.svcRating, md = rt.mid;
    const evRF = (p, v) => rfs(v) || ev(p, 3);
    let h = '<div id="gfx_rt"></div>';
    h += `<p class="note">LRFR load rating (MBE; article labels as the old app: the MBE 4th Ed. (2026) labels come in their own PR). Screening of the design girder: a complete rating also covers the negative-moment region over the piers and the restraint moments.</p>`;
    h += k.card('Condition and system factors (MBE 6A.4.2.3 / 6A.4.2.4)', k.kv([['φ<sub>c</sub> × φ<sub>s</sub> entered', `${ev('rating.phiC', 2)} × ${ev('rating.phiS', 2)} <a href="#" data-goin="loads">Loads tab</a>`],
      ['φ<sub>c</sub>φ<sub>s</sub> used (not less than 0.85, MBE Eq. 6A.4.2.1-3; not more than 1.00)', `<b>${ev('rating.phiCS', 3)}</b>${rt.phiCSfloor ? ' (floored at 0.85)' : rt.phiCScap ? ' (capped at 1.00)' : ''} ${wk('rt.phiCS')}`]])
      + '<p class="note">Applied to the flexure and shear strength ratings and to the vehicles; not to the Service III rating. A blank box is taken as 1.00.</p>', 'card-rtcs');
    h += k.card(`Flexure (HL-93), x = ${ev('rating.x', 2)} ft: the station with the lowest inventory RF`, k.kv([['φM<sub>n</sub>', `${ev('rating.Rn', 1, 'kip-ft')} ${wk('rt.Rn')} <a href="#" data-gotab="flex">Flexure tab</a>`],
      ['M<sub>DC</sub> / M<sub>DW</sub>', `${ev('rating.MDC', 1)} ${wk('rt.MDC')} / ${ev('rating.MDW', 1, 'kip-ft')} ${wk('rt.MDW')}`], ['M<sub>LL+IM</sub>', `${ev('rating.MLL', 1, 'kip-ft')} ${wk('rt.MLL')}`],
      ['Inventory RF (γ<sub>LL</sub> = 1.75)', `<b>${ev('rating.RFinv', 3)}</b> ${rt.okInv ? '≥ 1.0' : '<b style="color:var(--fail)">&lt; 1.0</b>'} ${wk('rt.RFinv')}`], ['Operating RF (γ<sub>LL</sub> = 1.35)', `<b>${ev('rating.RFopr', 3)}</b> ${rt.okOpr ? '≥ 1.0' : '<b style="color:var(--fail)">&lt; 1.0</b>'} ${wk('rt.RFopr')}`],
      ['At midspan (comparison)', `φM<sub>n</sub> ${ev('rating.mid.Rn', 1)}, M<sub>DC</sub> ${ev('rating.mid.MDC', 1)}, M<sub>DW</sub> ${ev('rating.mid.MDW', 1)}, M<sub>LL+IM</sub> ${ev('rating.mid.MLL', 1, 'kip-ft')}: RF<sub>inv</sub> ${ev('rating.mid.RFinv', 3)}, RF<sub>opr</sub> ${ev('rating.mid.RFopr', 3)} ${wk('rt.RFmid')}`]])
      + '<p class="note">RF = (φ<sub>c</sub>φ<sub>s</sub>φM<sub>n</sub> − 1.25 M<sub>DC</sub> − 1.50 M<sub>DW</sub>) / (γ<sub>LL</sub> M<sub>LL+IM</sub>) (MBE Eq. 6A.4.2.1-1), at the station of the strength-check grid with the lowest inventory RF (positive live-load moment), with the same φM<sub>n</sub> as the strength check. No tonnage for HL-93 (a notional load with no gross weight).</p>', 'card-rtflex');
    h += k.card(`Shear (HL-93), x = ${ev('shrRating.x', 2)} ft: the governing shear section`, k.kv([['φV<sub>n</sub> (general procedure)', `${ev('shrRating.phiVn', 1, 'kip')} ${wk('rt.phiVn')} <a href="#" data-gotab="shear">Shear tab</a>`],
      ['V<sub>DC</sub> / V<sub>DW</sub>', `${ev('shrRating.VDC', 1)} ${wk('rt.VDC')} / ${ev('shrRating.VDW', 1, 'kip')} ${wk('rt.VDW')}`], ['V<sub>LL+IM</sub>', `${ev('shrRating.VLL', 1, 'kip')} ${wk('rt.VLL')}`],
      ['Inventory RF', `<b>${evRF('shrRating.RFinv', sh.RFinv)}</b> ${sh.RFinv >= 99 ? 'no live-load shear' : sh.okInv ? '≥ 1.0' : '<b style="color:var(--fail)">&lt; 1.0</b>'} ${wk('rt.RFvInv')}`], ['Operating RF', `<b>${evRF('shrRating.RFopr', sh.RFopr)}</b> ${wk('rt.RFvOpr')}`]])
      + '<p class="note">At the section where V<sub>u</sub>/φV<sub>n</sub> is greatest (the bearing face excluded), with the design\'s MCFT φV<sub>n</sub>. For prestressed girders shear can govern the operating rating.</p>', 'card-rtshear');
    h += k.card(`Service III (prestressed concrete), x = ${ev('svcRating.x', 2)} ft: the governing bottom-tension section`, k.kv([['f<sub>ps</sub> prestress compression, bottom', `${ev('svcRating.fPS', 3, 'ksi')} ${wk('rt.fPS')}`],
      ['f<sub>DC</sub> / f<sub>DW</sub> bottom tension', `${ev('svcRating.fDC', 3)} ${wk('rt.fDC')} / ${ev('svcRating.fDW', 3, 'ksi')} ${wk('rt.fDW')}`], ['f<sub>LL</sub> (unfactored, γ<sub>LL</sub> = 0.8)', `${ev('svcRating.fLL', 3, 'ksi')} ${wk('rt.fLL')}`],
      ['Allowable tension f<sub>r</sub>', `${ev('svcRating.fr', 3, 'ksi')} (${inp.opt.corrosion === 'severe' ? '0.0948√f′<sub>c</sub> ≤ 0.3 ksi, severe corrosion' : '0.19√f′<sub>c</sub> ≤ 0.6 ksi, moderate corrosion'}) ${wk('rt.fr')}`],
      ['Service III RF', `<b>${evRF('svcRating.RF', sv.RF)}</b> ${sv.RF >= 99 ? 'net compression: live load never governs tension (n/a)' : sv.ok ? '≥ 1.0' : '<b style="color:var(--fail)">&lt; 1.0</b>'} ${wk('rt.RFs3')}`]])
      + '<p class="note">MBE 6A.5.4.1, mandatory for prestressed members: RF = (f<sub>r</sub> + f<sub>ps</sub> − f<sub>DC</sub> − f<sub>DW</sub>) / (0.8 f<sub>LL</sub>), γ<sub>DC</sub> = γ<sub>DW</sub> = 1.0 (MBE Table 6A.4.2.2-1); f<sub>pe</sub> without the elastic gains.</p>', 'card-rts3');
    const V = R.vehRatings || [];
    h += k.card('Legal / permit vehicles (entered factored forces, MBE 6A.4.4 / 6A.4.5)', (V.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Vehicle</th><th>Factored M<br>kip-ft</th><th>Factored V<br>kip</th><th>Weight<br>ton</th><th>RF flexure</th><th>RF shear</th><th>RF</th><th>Rated<br>ton</th><th>Status</th><th></th></tr></thead><tbody>
      ${V.map((v, i) => { const P = `vehRatings.${i}.`; return `<tr><td class="lft">${k.esc(v.name)}</td><td>${ev(P + 'M', 1)}</td><td>${ev(P + 'V', 1)}</td><td>${ev(P + 'W', 1)}</td><td>${evRF(P + 'RFm', v.RFm)}</td><td>${evRF(P + 'RFv', v.RFv)}</td><td><b>${evRF(P + 'RF', v.RF)}</b></td><td>${v.RT != null && v.RF < 99 ? ev(P + 'RT', 1) : '—'}</td>${okT(v.ok, v.RF)}<td>${wk(`rt.veh${i}.RF`)}</td></tr>`; }).join('')}</tbody></table></div>`
      : '<p class="note">No vehicles entered. Add a legal truck (Type 3, 3S2, 3-3) or a permit vehicle on the <a href="#" data-goin="loads">Loads tab</a>.</p>')
      + `<p class="note">Your factored live-load moment and shear (DF, IM, multiple presence and the LRFR live-load factor applied); the app supplies φ<sub>c</sub>φ<sub>s</sub>φM<sub>n</sub> at midspan (${ev('rating.mid.Rn', 1, 'kip-ft')}) and φ<sub>c</sub>φ<sub>s</sub>φV<sub>n</sub> at the governing shear section (${ev('shrRating.phiVn', 1, 'kip')}), with 1.25 DC and 1.50 DW (M<sub>DC</sub> ${ev('rating.mid.MDC', 1)}, M<sub>DW</sub> ${ev('rating.mid.MDW', 1, 'kip-ft')}; V<sub>DC</sub> ${ev('shrRating.VDC', 1)}, V<sub>DW</sub> ${ev('shrRating.VDW', 1, 'kip')}). The governing RF is the lower of flexure and shear; the rated tons = RF × weight where a weight is entered.</p>`, 'card-rtveh');
    h += '<div id="gfx_rtx"></div>';
    h += k.card('Worked steps: load rating', `<p class="note">LRFR, MBE (article labels as the old app); resistances from AASHTO LRFD 10th Ed. (2024). Every result is the engine's value (the moved Prestressed Bridge Design engine).</p>${k.steps(ctx.W.rating.steps, TOPICS, OPEN)}`);
    void md;
    return h;
  }
  /* the span with the rated sections (flexure, shear, Service III) */
  function xFig(R, W) {
    const V = VK(), S = V.scene(), L = R.L, h = Math.max(0.06 * L, 3), rt = R.rating, sh = R.shrRating, sv = R.svcRating;
    S.rect(0, 0, L, h, 'dt-cc');
    [0, L].forEach(x => S.poly([[x, 0], [x - 0.3 * h, -0.55 * h], [x + 0.3 * h, -0.55 * h]], 'dt-brg'));
    const mk = [[rt.x, `flexure x = ${V.fx(rt.x, 2)} ft: RF_inv ${V.fx(rt.RFinv, 3)}`, '#1D4ED8', 0], [sh.x, `shear x = ${V.fx(sh.x, 2)} ft: RF_inv ${sh.RFinv >= 99 ? '—' : V.fx(sh.RFinv, 3)}`, '#B45309', 1], [sv.x, `Service III x = ${V.fx(sv.x, 2)} ft: RF ${sv.RF >= 99 ? '—' : V.fx(sv.RF, 3)}`, '#15803D', 2]];
    mk.forEach(([x, t, c, i]) => { S.line(x, -0.2 * h, x, h + 0.2 * h, 'dt-gov', { stroke: c }); S.text(x, h, t, { a: x > L * 0.6 ? 'end' : 'start', dx: x > L * 0.6 ? -4 : 4, dy: -10 - 16 * i, sz: 10.5, fill: c, halo: true });
      S.region(x - L * 0.01, 0, x + L * 0.01, h, t); });
    S.dimH(0, L, -0.55 * h, -14, `L = ${V.fx(L, 2)} ft`, { sz: 10.5 });
    return S.render({ W, maxH: 200, label: 'Rated sections along the span' }).svg;
  }
  function after(el, ctx) {
    K().after(el, OPEN);
    const { R } = ctx, k = K(), ev = (p, d) => k.ev(R, p, d), rt = R.rating, sh = R.shrRating, sv = R.svcRating;
    const bar = (v, ci) => ({ v: v >= 99 ? 0 : Math.min(v, 4), cls: v >= 99 ? undefined : v < 1 ? 'ng' : v < 1.1 ? 'hi' : 'ok', text: v >= 99 ? 'n/a' : k.fx(v, 3) });
    const items = [{ id: 'Flexure', key: 'inv / opr', bars: [bar(rt.RFinv), bar(rt.RFopr)], lab: ['Flexure (HL-93)', `inventory ${k.fx(rt.RFinv, 3)}, operating ${k.fx(rt.RFopr, 3)} at x = ${k.fx(rt.x, 2)} ft`] },
      { id: 'Shear', key: 'inv / opr', bars: [bar(sh.RFinv), bar(sh.RFopr)], lab: ['Shear (HL-93)', `inventory ${sh.RFinv >= 99 ? 'n/a' : k.fx(sh.RFinv, 3)}, operating ${sh.RFopr >= 99 ? 'n/a' : k.fx(sh.RFopr, 3)}`] },
      { id: 'Service III', key: 'inventory', bars: [bar(sv.RF)], lab: ['Service III', sv.RF >= 99 ? 'n/a (net compression)' : k.fx(sv.RF, 3)] },
      ...(R.vehRatings || []).map(v => ({ id: v.name, key: v.gov, bars: [bar(v.RF)], lab: [v.name, v.RF >= 99 ? 'n/a' : `${k.fx(v.RF, 3)} (${v.gov})`] }))];
    const gov = Math.min(rt.RFinv, sh.RFinv, sv.RF >= 99 ? 99 : sv.RF);
    const slot = el.querySelector('#gfx_rt');
    if (slot && VA() && VA().mount) VA().mount(slot, { key: 'rt', title: 'Load rating factors (LRFR)', sub: 'HL-93 design load and the entered vehicles; RF ≥ 1.0 (bars capped at 4.0)',
      controls: VK().tiles([{ label: 'Flexure inv', value: ev('rating.RFinv', 3), unit: `opr ${k.fx(rt.RFopr, 3)}`, tone: rt.okInv ? 'c' : 't' }, { label: 'Shear inv', value: sh.RFinv >= 99 ? '—' : ev('shrRating.RFinv', 3), unit: `opr ${sh.RFopr >= 99 ? '—' : k.fx(sh.RFopr, 3)}`, tone: sh.okInv ? '' : 't' },
        { label: 'Service III', value: sv.RF >= 99 ? '—' : ev('svcRating.RF', 3), unit: sv.RF >= 99 ? 'no LL tension' : `x = ${k.fx(sv.x, 1)} ft`, tone: sv.ok ? '' : 't' }, { label: 'Governing (inventory)', value: gov >= 99 ? '—' : k.fx(gov, 3), unit: 'lowest of the three', tone: gov < 1 ? 't' : '' },
        { label: 'φ<sub>c</sub>φ<sub>s</sub>', value: ev('rating.phiCS', 3), unit: rt.phiCSfloor ? 'floored' : '' }, { label: 'Vehicles', value: String((R.vehRatings || []).length), unit: 'entered' }]),
      draw: W => VA().hbars({ aria: 'Rating factors', panels: [{ label: 'Rating factor (inventory, then operating)', unit: 'RF', limit: { v: 1, label: '1.0' }, items }] }, W),
      hint: 'Point at (or tap) a bar for its value.',
      caption: '<p class="vk-cap">The engine\'s rating factors (cards below). Red below 1.0, amber 1.0 to 1.1, green above. Display only.</p>' });
    const s2 = el.querySelector('#gfx_rtx');
    if (s2 && VK() && VK().detCard) VK().detCard(s2, { id: 'rtXFig', title: 'Rated sections along the span', sub: 'elevation, depth exaggerated',
      draw: W => ({ html: xFig(R, W), nar: W < 560 }), hint: 'Point at (or tap) a section line for its rating.',
      cap: '<p class="vk-cap">Where each HL-93 rating is taken: the flexure station with the lowest inventory RF, the governing shear section, the governing Service III bottom-tension section. Display only.</p>' });
  }
  window.PSBUiRating = { output, after, TOPICS };
})();
