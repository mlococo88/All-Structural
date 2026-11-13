/* apps/ps-bridge/ui/endzone.js — the End zone & hold-down output tab (window.PSBUiEndZone). Classic script; display only. Created 2026-11-12
   (PR 2d-1, docs/ps-bridge-plan.md §2.3). As the old app's Anchorage Zone tab (splitting / bursting steel, confinement, the bonded release-tension
   steel), plus the draped strands with the hold-down force against its limit (the owner check of the moved engine, MassDOT 3.7.2.2 / CTDOT
   V2 5.9.1.6; PS-1) and the debonding (5.9.4.3.3: the strand table, ℓ_d, the engine's warnings, the owner share), in the steel app's layout.
   Every number is the engine's (computeAll R: R.splitDem, R.AsSplit, R.conf, R.relSteel, R.ss, R.own.hd, R.own.db, R.ldDebond, …), worked
   in engine/worked-end.js endzone(). The graphics: the end-zone checks against 1.0 (the steel bar chart, PSBVizAlong.hbars), the girder-end
   elevation (splitting steel within h/4, confinement over 1.5d, ℄ bearing, transfer length, the strands; the steel detail kit) and the draped
   strands with the hold-down points (and forces, where the owner check applies).
   AASHTO and RIDOT have no hold-down limit in the moved engine: the optional check (PS-10: a box, default on, 75 % of the beam weight) is
   added by PR 2d-3; until then the tab says so.
     output(ctx) -> HTML; after(el, ctx). ctx = { P, inp, R, W, ui, redraw } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong, VK = () => window.PSBVizKit;
  const OPEN = new Set(['split']);
  const A = 'AASHTO LRFD 10th Ed. ';
  const TOPICS = [
    { key: 'split', title: 'Splitting / bursting resistance', ref: A + '5.9.4.4.1', ids: /^ez\.(Pi|Pr|AsReq|h4|AsProv|PrProv|nNeed|dc)$/, res: /^ez\.dc$/ },
    { key: 'conf', title: 'Confinement reinforcement', ref: A + '5.9.4.4.2', ids: /^ez\.conf\./, res: /^ez\.conf\.gov$/ },
    { key: 'rel', title: 'Bonded release-tension steel', ref: A + '5.9.2.3.1b', ids: /^ez\.rel\./, res: /^ez\.rel\.dc$/ },
    { key: 'hd', title: 'Draped strands and the hold-down force', ref: 'PS-1, PS-10, PS-13', ids: /^ez\.(slope|hd\.)/, res: /^ez\.hd\.r$/ },
    { key: 'db', title: 'Debonded strands', ref: A + '5.9.4.3.3', ids: /^ez\.db\./, res: /^ez\.db\.r$/ }];
  const ckOf = (R, re) => { const i = R.checks.findIndex(c => typeof re === 'string' ? c.n === re : re.test(c.n)); return i < 0 ? null : { i, c: R.checks[i] }; };
  const st = ok => `<td class="${ok ? 'ok' : 'ngt'}">${ok ? 'PASS' : 'FAIL'}</td>`;
  const pf = ok => ok ? 'PASS' : '<b class="ngt" style="color:var(--fail)">FAIL</b>';
  /* the engine's warnings of a topic (text as the engine wrote it) */
  const warnsOf = (R, re) => R.warns.filter(w => re.test(w));
  const HD_RE = /Hold-down|Harp slope|Harped CG/, DB_RE = /debond|5\.9\.4\.3\.3/i;
  function output(ctx) {
    const { R, inp } = ctx, k = K(), ev = (p, d, u, div) => k.ev(R, p, d, u, div), wk = k.wk, o = inp.opt, G = R.g, ss = R.ss, cf = R.conf, rs = R.relSteel;
    const qS = ckOf(R, 'Splitting steel (5.9.4.4)'), qC = ckOf(R, 'Confinement steel (5.9.4.4.2)'), qR = ckOf(R, 'Release tens. steel (5.9.2.3.1b)'), qH = ckOf(R, /^Hold-down force/), qD = ckOf(R, /^Debonded strands/);
    let h = '<div id="gfx_ez"></div>';
    h += k.card('Splitting / bursting resistance (5.9.4.4.1)', k.kv([['P<sub>i</sub> at transfer (all strands)', `${ev('rv.terms.Pi', 1, 'kip')} ${wk('ez.Pi')}`], ['Required P<sub>r</sub> = 0.04 P<sub>i</sub>', `${ev('splitDem', 1, 'kip')} ${wk('ez.Pr')}`],
      ['A<sub>s,req</sub> = 0.04 P<sub>i</sub> / 20 ksi', `${ev('AsSplit', 2, 'in²')} ${wk('ez.AsReq')}`], [`Within h/4 (h = overall ${k.esc(R.splitDir)} ${ev('splitH', 1, 'in')})`, `${ev('splitZone', 1, 'in')} of the member end ${wk('ez.h4')}`],
      ['A<sub>s,prov</sub> (legs × area)', `${k.fx(+o.splitN || 0, 0)} × ${k.fx(+o.splitAv || 0, 2)} = ${ev('AsSplitProv', 2, 'in²')} ${wk('ez.AsProv')}`], ['P<sub>r</sub> provided = 20 A<sub>s,prov</sub>', `${ev('splitPr', 1, 'kip')} ${wk('ez.PrProv')}`],
      ['Legs needed at this area', `${+o.splitAv > 0 ? ev('splitN_need', 0) : '—'}${+o.splitAv > 0 ? ' ' + wk('ez.nNeed') : ''}`], ['Ratio 0.04 P<sub>i</sub> / P<sub>r</sub>', `<b>${ev(`checks.${qS.i}.r`, 3)}</b> ${pf(qS.c.pass)} ${wk('ez.dc')}`]])
      + `<p class="note">The splitting steel is placed within h/4 of the member end, ${R.splitDir === 'width' ? 'horizontal (solid or voided slab: h = the overall width)' : 'vertical (I-girder, bulb tee, box or tub: h = the overall height)'}, at a stress of at most 20 ksi (5.9.4.4.1). Inputs: <a href="#" data-goin="gird">Girders &amp; strands tab</a> (Splitting and confinement steel).</p>`, 'card-ezsplit');
    h += k.card('Confinement reinforcement (5.9.4.4.2)', cf.exempt ? `<p class="note">Not required for this section: ${k.esc(cf.why)}. No check is reported (as the old app).</p>`
      : `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Requirement</th><th>Value<br>in</th><th>Limit<br>in</th><th>Ratio</th><th>Status</th><th></th></tr></thead><tbody>
        ${cf.parts.map((q, i) => `<tr><td class="lft">${k.esc(q.lbl)}</td><td>${ev(`conf.parts.${i}.v`, 3)}</td><td>${ev(`conf.parts.${i}.lim`, 3)}</td><td><b>${ev(`conf.parts.${i}.r`, 3)}</b></td>${st(q.ok)}<td>${wk(['ez.conf.size', 'ez.conf.sp', 'ez.conf.ext'][i])}</td></tr>`).join('')}</tbody></table></div>`
        + k.kv([['Bar provided', `No. ${ev('conf.barNo', 0)} at ${ev('conf.s', 2, 'in')}, ${ev('conf.n', 0)} bars from each end`], ['A<sub>b</sub> per bar', ev('conf.Ab', 2, 'in²')], ['Extent required 1.5d', `${ev('conf.reqExt', 1, 'in')} ${wk('ez.conf.req')}`],
          ['Extent provided (n − 1)s', `${ev('conf.provExt', 1, 'in')} ${wk('ez.conf.prov')}`], ['Bars to cover 1.5d at this spacing', cf.s > 0 ? `${ev('conf.nNeed', 0)} ${wk('ez.conf.nNeed')}` : '—'], ['Governing', `${k.esc(cf.gov.lbl)}: <b>${ev(`checks.${qC.i}.r`, 3)}</b> ${pf(qC.c.pass)} ${wk('ez.conf.gov')}`]])
        + '<p class="note">A prescriptive detailing rule (bar size, spacing, extent), not a force check. That the bars are shaped to enclose the strands is a detail the app cannot verify: confirm it on the reinforcement detail.</p>', 'card-ezconf');
    h += k.card('Bonded release-tension steel (5.9.2.3.1b)', o.relBondedReinf
      ? k.kv([['Stress in the bonded steel f<sub>s</sub> = min(0.5 f<sub>y</sub>, 30 ksi)', `${ev('relSteel.fs', 1, 'ksi')} ${wk('ez.rel.fs')}`], ['Tensile force, top tension', `${ev('relSteel.Ttop', 1, 'kip')} ${wk('ez.rel.Ttop')}`], ['Tensile force, bottom tension', `${ev('relSteel.Tbot', 1, 'kip')} ${wk('ez.rel.Tbot')}`],
        ['Governing', `${k.esc(rs.where)}, x = ${ev('relSteel.x', 2, 'ft')}`], ['A<sub>s,req</sub> = T / f<sub>s</sub>', `${ev('relSteel.AsReq', 2, 'in²')} ${wk('ez.rel.As')}`], ['A<sub>s,prov</sub>', `${ev('relSteel.AsProv', 2, 'in²')} <a href="#" data-goin="gird">Girders &amp; strands</a>`],
        ['Ratio A<sub>s,req</sub> / A<sub>s,prov</sub>', `<b>${ev(`checks.${qR.i}.r`, 3)}</b> ${pf(qR.c.pass)} ${wk('ez.rel.dc')}`]])
        + '<p class="note">Claimed for the higher release tension limit 0.24√f′<sub>ci</sub> (Stresses tab): the bonded steel carries the concrete tensile force of the uncracked section at f<sub>s</sub>.</p>'
      : '<p class="note">The bonded-steel option is off: the release tension limit is min(0.0948√f′<sub>ci</sub>, 0.2 ksi) (5.9.2.3.1b) and no end-region tension steel is needed for it. Turn it on (<a href="#" data-goin="gird">Girders &amp; strands tab</a>) to claim 0.24√f′<sub>ci</sub> and check the steel here.</p>', 'card-ezrel');
    // draped strands and the hold-down force
    const hd = R.own && R.own.hd, wH = warnsOf(R, HD_RE), owner = R.own ? R.own.owner : (inp.owner || 'AASHTO');
    let hb = '';
    if (ss.nh > 0) {
      hb += k.kv([['Draped strands n<sub>h</sub>', `${ev('ss.nh', 0)} (centroid y<sub>end</sub> = ${ev('ss.hp.yEnd', 2, 'in')} at ℄ bearing, y<sub>mid</sub> = ${ev('ss.hp.yMid', 2, 'in')})`],
        ['Hold-down points', `two, at frac × L = ${ev('ss.hp.frac', 3)} × ${ev('L', 2)} = ${k.fx(ss.hp.frac * R.L, 2)} ft from ℄ bearing (PS-13)`], ['Slope tan α', `${ev('ss.slope', 4)} ${wk('ez.slope')}`]]);
      if (hd) hb += k.kv([['α', `${ev('own.hd.alpha', 5, 'rad')} ${wk('ez.hd.alpha')}`], ['Force per strand and point F<sub>str</sub> = f<sub>pbt</sub> A<sub>b</sub> sin α', `${ev('own.hd.Fstr', 3, 'kip')} ${wk('ez.hd.Fstr')}`],
        ['Hold-down force F<sub>hd</sub> = 2 n<sub>h</sub> F<sub>str</sub>', `<b>${ev('own.hd.Ftot', 1, 'kip')}</b> ${wk('ez.hd.F')}`], ['Girder length L<sub>g</sub>', `${ev('own.hd.Lg', 2, 'ft')} ${wk('ez.hd.Lg')}`], ['Beam weight W = w<sub>sw</sub> L<sub>g</sub>', `${ev('own.hd.W', 1, 'kip')} ${wk('ez.hd.W')}`],
        [`Limit ${ev('own.hd.frac', 2)} W`, `${ev('own.hd.lim', 1, 'kip')} ${wk('ez.hd.lim')}`], [`Ratio (${k.esc(qH.c.n.replace(/^Hold-down force \(|\)$/g, ''))})`, `<b>${ev(`checks.${qH.i}.r`, 3)}</b> ${pf(qH.c.pass)} ${wk('ez.hd.r')}`]])
        + `<p class="note">${k.esc(owner)}: the total hold-down force of all draped strands of a beam, at jacking (f<sub>pbt</sub>), shall not exceed 75 % of the beam weight (the owner rule of the moved engine). Each strand bends at two hold-down points, F<sub>str</sub> at each.</p>`;
      else hb += `<p class="note"><b>Hold-down limit: not checked for ${k.esc(owner)}.</b> AASHTO LRFD sets no limit on the hold-down force; the moved engine checks the 75 % of beam weight rule only for MassDOT (3.7.2.2) and CTDOT (V2 5.9.1.6). The optional check for AASHTO and RIDOT projects (PS-10: a box on the Owner rules tab, default on, limit 75 % of the beam weight, editable) comes in PR 2d-3.</p>`;
      hb += '<div id="gfx_ezhd"></div>';
    } else hb += '<p class="note">No draped strands: no hold-down force (straight strands only).</p>';
    if (wH.length) hb += `<div class="alert"><b>Engine warnings (draped strands)</b><ul>${wH.map(w => `<li>${k.esc(w)}</li>`).join('')}</ul></div>`;
    h += k.card('Draped strands and the hold-down force', hb, 'card-ezhd');
    // debonding
    const wD = warnsOf(R, DB_RE), db = R.own && R.own.db;
    let dbh = '';
    if (ss.Ndebond > 0) {
      dbh += `<div class="tscroll"><table class="tbl"><thead><tr><th>Row</th><th>y<br>in</th><th>n</th><th>Debonded</th><th>Share of the row<br>%</th><th>Length from each end<br>ft</th></tr></thead><tbody>
        ${ss.rows.map((r, i) => `<tr${r.dbnd > 0 && r.nd > 0 ? ' class="sel"' : ''}><td>${i + 1}</td><td>${ev(`ss.rows.${i}.y`, 2)}</td><td>${ev(`ss.rows.${i}.n`, 0)}</td><td>${r.dbnd > 0 ? ev(`ss.rows.${i}.nd`, 0) : '—'}</td><td>${r.dbnd > 0 && r.nd > 0 ? k.fx(100 * r.nd / r.n, 0) : '—'}</td><td>${r.dbnd > 0 && r.nd > 0 ? ev(`ss.rows.${i}.dbnd`, 2) : '—'}</td></tr>`).join('')}</tbody></table></div>`
        + k.kv([['Debonded strands', `${ev('ss.Ndebond', 0)} of ${ev('ss.Ntot', 0)} ${wk('ez.db.pct')}`], ['ℓ<sub>d</sub> of a debonded strand (κ = 2.0)', `${ev('ldDebond', 1, 'in')} (${ev('ldDebond', 2, 'ft', 12)}) ${wk('ez.db.ld')}`],
          ...(db ? [[`Share of all strands (${k.esc(qD.c.n.replace(/^Debonded strands \(|\)$/g, ''))}, max ${k.fx(100 * db.max, 0)} %)`, `${ev('own.db.pct', 3)}: <b>${ev(`checks.${qD.i}.r`, 3)}</b> ${pf(qD.c.pass)} ${wk('ez.db.r')}`]] : []),
          ...(!(inp.cont && inp.cont.on) ? [['Longest debond length, simple span', `min(0.20 L, L/2 − ℓ<sub>d</sub>) = ${k.fx(Math.min(0.2 * R.L, R.L / 2 - R.ldDebond / 12), 2)} ft ${wk('ez.db.max')}`]] : [])])
        + `<p class="note">5.9.4.3.3 is checked by the engine as warnings (no computed value depends on it): (A) ≤ 45 % of a row, (B) terminations per section, (C) 60 d<sub>b</sub> between terminations, (D) symmetry, (G) the length limit on a simple span, (I) flanged sections. Which strands of a row are debonded is not an input. ${wD.length ? 'The warnings for this design are listed below.' : 'No debonding warning for this design.'}</p>`;
    } else dbh += '<p class="note">No debonded strands.</p>';
    if (wD.length) dbh += `<div class="alert"><b>Engine warnings (debonding)</b><ul>${wD.map(w => `<li>${k.esc(w)}</li>`).join('')}</ul></div>`;
    h += k.card('Debonded strands (5.9.4.3.3)', dbh, 'card-ezdb');
    h += '<div id="gfx_ezend"></div>';
    h += k.card('Worked steps: end zone and hold-down', `<p class="note">AASHTO LRFD 10th Ed. (2024); the owner rules as cited. Every result is the engine's value (the moved Prestressed Bridge Design engine).</p>${k.steps(ctx.W.endzone.steps, TOPICS, OPEN)}`);
    return h;
  }
  /* the girder-end elevation (true scale, inches from the girder end): concrete, ℄ bearing, the splitting zone h/4 with its legs, the
     confinement bars over their extent and the 1.5d requirement, the transfer length, the straight rows (debonded lengths dashed) and the
     draped strands; drawing positions only (the bars are spread evenly over the zone: their positions are not inputs) */
  function endFig(R, inp, W) {
    const V = VK(), S = V.scene(), G = R.g, ss = R.ss, cf = R.conf, o = inp.opt, h = G.h, oh = +o.endOh || 0, zone = R.splitZone, nar = W < 520;
    const lt = ss.lt, xv = Math.max(1.5 * h * 1.18, zone * 1.6, lt * 1.15, (cf.provExt || 0) * 1.1, 48);
    S.rect(0, 0, xv, h, 'dt-cc');
    S.line(xv, -2, xv, h + 2, 'dt-cl');
    S.rect(0, 0, zone, h, 'dt-sel', { op: 0.55 });
    S.region(0, 0, zone, h, `Splitting zone h/4 = ${V.fx(zone, 1)} in from the member end: ${+o.splitN || 0} legs of ${V.fx(+o.splitAv || 0, 2)} in² = ${V.fx(R.AsSplitProv, 2)} in² (required ${V.fx(R.AsSplit, 2)} in²)`);
    const nS = Math.max(0, Math.round(+o.splitN || 0)), x0 = Math.min(1.5, zone / 4);
    for (let i = 0; i < Math.min(nS, 40); i++) { const x = nS > 1 ? x0 + i * (zone - 2 * x0) / (nS - 1) : zone / 2; S.line(x, 1.5, x, h - 1.5, 'dt-ol', { stroke: '#1D4ED8', sw: 1.6 }); }
    if (!cf.exempt) {
      const bf = G.d ? (G.d[2] || 0) + (G.d[3] || 0) : h * 0.25, yT = Math.min(h - 2, Math.max(bf + 2, 8));
      for (let i = 0; i < Math.min(cf.n, 60); i++) { const x = i * cf.s + 0.75; if (x > xv) break; S.line(x, 0.75, x, yT, 'dt-ol', { stroke: '#8A5A44', sw: 1.3 }); }
      S.region(0, 0, Math.max(cf.provExt, 2), yT, `Confinement: ${cf.n} No. ${cf.barNo} at ${V.fx(cf.s, 2)} in, extent ${V.fx(cf.provExt, 1)} in (1.5d = ${V.fx(cf.reqExt, 1)} in required)`);
      S.dimH(0, Math.min(cf.reqExt, xv), 0, -16, `1.5d = ${V.fx(cf.reqExt, 1)} in (required)`, { sz: 10.5 });
      S.dimH(0, Math.min(Math.max(cf.provExt, 0.5), xv), 0, -32, `confinement ${V.fx(cf.provExt, 1)} in (provided)`, { sz: 10.5 });
    }
    ss.rows.forEach(r => { const dl = r.dbnd > 0 && r.nd > 0 ? Math.min(r.dbnd * 12 - oh, xv) : 0;
      S.line(0, r.y, xv, r.y, 'dt-ol', { stroke: '#8A5A44', sw: 1 });
      if (dl > 0) S.line(0, r.y, dl, r.y, 'dt-hid', { stroke: '#DC6B2F', sw: 2.2, dash: '5 3' }); });
    if (ss.nh > 0) { const sl = ss.slope, ye = +ss.hp.yEnd, yAt = x => ye - sl * (x - oh); const xe = Math.min(xv, oh + (ye - +ss.hp.yMid) / Math.max(sl, 1e-9));
      S.line(0, yAt(0), xe, yAt(xe), 'dt-ol', { stroke: '#B45309', sw: 1.8 }); S.text(xe, yAt(xe), `draped (${ss.nh})`, { a: 'end', dx: -4, dy: -6, sz: 10.5, fill: '#B45309', halo: true }); }
    if (oh > 0) { S.line(oh, -4, oh, h + 6, 'dt-cl'); S.text(oh, h, '℄ brg', { a: 'middle', dy: -36, sz: 10.5, cls: 'dt-m' }); }
    else S.text(0, h, '℄ brg = girder end', { a: 'start', dy: -36, sz: 10.5, cls: 'dt-m' });
    S.line(lt, h * 0.2, lt, h * 0.8, 'dt-hid', { stroke: '#64748B' }); S.text(lt, h * 0.8, `ℓ_t = ${V.fx(lt, 1)} in`, { a: 'middle', dy: -6, sz: 10.5, cls: 'dt-m', halo: true });
    S.dimH(0, zone, h, 14, nar ? `h/4 = ${V.fx(zone, 1)} in` : `h/4 = ${V.fx(zone, 1)} in: ${nS} legs (splitting)`, { sz: 10.5 });
    S.dimV(0, h, 0, -12, `h = ${V.fx(h, 1)} in`, { sz: 10.5 });
    return S.render({ W, maxH: Math.min(360, Math.max(220, W * 0.42)), label: 'Girder end: splitting and confinement steel' }).svg;
  }
  /* the draped strands from ℄ bearing to midspan (vertical scale exaggerated) with the hold-down points and, where the owner check applies,
     the force n_h F_str at each */
  function hdFig(R, W) {
    const V = VK(), S = V.scene(), ss = R.ss, L = R.L, a = ss.hp.frac * L, G = R.g, H = 0.16 * L, Y = y => y / G.h * H, hd = R.own && R.own.hd, ye = Y(+ss.hp.yEnd), ym = Y(+ss.hp.yMid);
    S.rect(0, 0, L / 2 * 1.06, H, 'dt-cc');
    S.line(L / 2, -0.04 * L, L / 2, H + 0.02 * L, 'dt-cl'); S.text(L / 2, H, '℄ span', { a: 'middle', dy: -8, sz: 10.5, cls: 'dt-m' });
    S.line(0, -0.04 * L, 0, H + 0.02 * L, 'dt-cl'); S.text(0, H, '℄ brg', { a: 'middle', dy: -8, sz: 10.5, cls: 'dt-m' });
    S.pline([[0, ye], [a, ym], [L / 2 * 1.06, ym]], 'dt-ol', { stroke: '#B45309', sw: 2.2 });
    S.dot(a, ym, 4.5, 'dt-bolt');
    S.arrow(a, ym, 34, {});
    S.text(a, ym, hd ? `n_h F_str = ${V.fx(hd.nh * hd.Fstr, 1)} kip` : 'hold-down point', { a: 'start', dx: 6, dy: -22, sz: 10.5, halo: true, fill: '#1E3A5F' });
    S.text(a / 2, (ye + ym) / 2, `tan α = ${V.fx(ss.slope, 4)}`, { a: 'start', dx: 8, dy: -6, sz: 10.5, fill: '#B45309', halo: true });
    S.region(0, ym - 0.02 * L, a, ye + 0.02 * L, `${ss.nh} draped strands: y_end = ${V.fx(+ss.hp.yEnd, 2)} in at ℄ bearing to y_mid = ${V.fx(+ss.hp.yMid, 2)} in at the hold-down point; slope ${V.fx(ss.slope, 4)}`);
    S.dimH(0, a, 0, -14, `frac × L = ${V.fx(+ss.hp.frac, 3)} × ${V.fx(L, 2)} = ${V.fx(a, 2)} ft`, { sz: 10.5 });
    return S.render({ W, maxH: 230, label: 'Draped strands and the hold-down point (half span; vertical scale exaggerated)' }).svg;
  }
  function after(el, ctx) {
    K().after(el, OPEN);
    const { R, inp } = ctx, k = K(), ev = (p, d) => k.ev(R, p, d), ss = R.ss, cf = R.conf, o = inp.opt;
    const items = [], push = (id, key, q, lab) => { if (q) items.push({ id, key, bars: [{ v: Math.min(q.c.r, 3), cls: q.c.r > 1.0001 ? 'ng' : q.c.r >= 0.9 ? 'hi' : 'ok', text: k.fx(q.c.r, 3) }], lab: [lab, `${k.fx(q.c.r, 3)} ${q.c.pass ? 'PASS' : 'FAIL'}`] }); };
    push('Splitting', '5.9.4.4.1', ckOf(R, 'Splitting steel (5.9.4.4)'), 'Splitting: 0.04 P_i / P_r');
    if (!cf.exempt) { cf.parts.forEach((q, i) => items.push({ id: ['Bar size', 'Spacing', 'Extent'][i], key: 'confinement', bars: [{ v: Math.min(q.r, 3), cls: q.r > 1.0001 ? 'ng' : q.r >= 0.9 ? 'hi' : 'ok', text: k.fx(q.r, 3) }], lab: [`Confinement: ${q.lbl}`, k.fx(q.r, 3)] })); }
    push('Release steel', '5.9.2.3.1b', ckOf(R, 'Release tens. steel (5.9.2.3.1b)'), 'Bonded release-tension steel');
    push('Hold-down', 'owner', ckOf(R, /^Hold-down force/), 'Hold-down force / limit');
    push('Debonded', 'owner', ckOf(R, /^Debonded strands/), 'Debonded share / owner limit');
    const slot = el.querySelector('#gfx_ez');
    if (slot && VA() && VA().mount) {
      const qS = ckOf(R, 'Splitting steel (5.9.4.4)'), qH = ckOf(R, /^Hold-down force/);
      VA().mount(slot, { key: 'ez', title: 'End-zone checks', sub: `${k.esc(inp.girder)}; ratios against 1.0 (bars capped at 3.0)`,
        controls: VK().tiles([{ label: 'Splitting', value: ev(`checks.${qS.i}.r`, 3), unit: qS.c.pass ? 'PASS' : 'FAIL', tone: qS.c.pass ? 'c' : 't' }, { label: 'A<sub>s,req</sub>', value: ev('AsSplit', 2), unit: 'in²' }, { label: 'h/4', value: ev('splitZone', 1), unit: 'in' },
          { label: 'Confinement', value: cf.exempt ? 'n/a' : ev('conf.dc', 3), unit: cf.exempt ? 'box / slab' : (cf.pass ? 'PASS' : 'FAIL'), tone: cf.exempt || cf.pass ? '' : 't' },
          { label: 'Draped n<sub>h</sub>', value: ev('ss.nh', 0), unit: ss.nh ? `tan α ${k.fx(ss.slope, 4)}` : 'none' },
          qH ? { label: 'Hold-down', value: ev(`checks.${qH.i}.r`, 3), unit: qH.c.pass ? 'PASS' : 'FAIL', tone: qH.c.pass ? '' : 't' } : { label: 'Hold-down', value: '—', unit: ss.nh ? 'no limit (PR 2d-3)' : 'no draped strands' }]),
        draw: W => VA().hbars({ aria: 'End-zone check ratios', panels: [{ label: 'Demand / capacity (D/C)', unit: 'D/C', limit: { v: 1, label: '1.0' }, items }] }, W),
        hint: 'Point at (or tap) a bar for its value.', legend: VA().legend('ratio'),
        caption: '<p class="vk-cap">The engine\'s ratios (cards below). Confinement: the three detailing limits of 5.9.4.4.2; hold-down and debonded share: the owner rules where they apply. Display only.</p>' });
    }
    const s2 = el.querySelector('#gfx_ezend');
    if (s2 && VK() && VK().detCard) VK().detCard(s2, { id: 'ezEndFig', title: 'Girder end: splitting and confinement steel', sub: `${k.esc(inp.girder)}, h = ${k.fx(R.g.h, 1)} in; true scale`,
      draw: W => ({ html: endFig(R, inp, W), nar: W < 560 }), hint: 'Point at (or tap) the splitting zone or the confinement bars for their values.',
      cap: `<p class="vk-cap">Side elevation of the girder end, true scale. Blue: the ${k.fx(+o.splitN || 0, 0)} splitting legs within h/4 (spread evenly over the zone: their positions are not inputs); brown in the bottom flange: the confinement bars at their spacing${cf.exempt ? ' (not required for this section)' : ''}; the strand rows (debonded lengths dashed orange), the draped strands, the transfer length ℓ<sub>t</sub> = 60 d<sub>b</sub>. Display only.</p>` });
    const s3 = el.querySelector('#gfx_ezhd');
    if (s3 && VK() && VK().detCard && ss.nh > 0) VK().detCard(s3, { id: 'ezHdFig', title: 'Draped strands and the hold-down point', sub: 'half span, vertical scale exaggerated',
      draw: W => ({ html: hdFig(R, W), nar: W < 560 }), hint: 'Point at (or tap) the draped strands for their values.',
      cap: `<p class="vk-cap">${R.own && R.own.hd ? 'The arrow: the hold-down force of the draped strands at one hold-down point, n<sub>h</sub> F<sub>str</sub> (two points per beam: F<sub>hd</sub> = 2 n<sub>h</sub> F<sub>str</sub>).' : 'No hold-down force is computed for this owner (PS-10 check in PR 2d-3).'} The other half of the span is symmetric. Display only.</p>` });
  }
  window.PSBUiEndZone = { output, after, TOPICS };
})();
