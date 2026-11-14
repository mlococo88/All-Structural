/* apps/ps-bridge/ui/stresses.js — the Stresses output tab (window.PSBUiStresses). Classic script; display only. Created 2026-11-12 (PR 2c-1,
   docs/ps-bridge-plan.md §2.3). As the old app's Stresses tab (stresses at transfer and in service along the girder, the governing stress
   summary, the stress distribution on the cross-section, the fibre stresses worked at the governing stations, Fatigue I, crack control, the
   stresses at the tenth points), plus the service checks at the interior supports of a span made continuous (5.12.3.3.5), in the steel app's
   layout. Every number is the engine's (computeAll R: R.grid stations, R.lim, R.checks, R.cont.svc, R.fat, R.crack), worked in
   engine/worked-stress.js stresses(); the graphics: the stresses along the girder (the steel along-girder chart, PSBVizAlong) and the stress
   diagram on the section at a station (the steel detail style, PSBVizKit.scene / detCard).
     output(ctx) -> HTML; after(el, ctx); onOutChange(e, ui). ctx = { P, inp, R, W, ui, redraw }; ui.stSel (station index), ui.stStage. */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong, VK = () => window.PSBVizKit;
  const OPEN = new Set(['rel', 'srv']);
  const A = 'AASHTO LRFD 10th Ed. ';
  const TOPICS = [
    { key: 'lim', title: 'Stress limits', ref: A + '5.9.2.3', ids: /^st\.lim\./ },
    { key: 'rel', title: 'Stresses at transfer (governing stations)', ref: A + '5.9.2.3.1', ids: /^st\.(rc|rt|rtb)(\.|$)/, res: /^st\.rc$/ },
    { key: 'srv', title: 'Service stresses (governing stations)', ref: A + '5.9.2.3.2', ids: /^st\.(s1|s2|s2t|s3|dk)(\.|$)/, res: /^st\.s3$/ },
    { key: 'pier', title: 'Interior supports of a span made continuous', ref: A + '5.12.3.3.5', ids: /^st\.pier\./ },
    { key: 'fat', title: 'Fatigue I', ref: A + '5.5.3', ids: /^st\.fat\./, res: /^st\.fat\.dfs$/ },
    { key: 'crk', title: 'Crack control', ref: A + '5.6.7', ids: /^st\.crk\./ }];
  /* the stress checks of R.checks shown here, the step that works each (engine/worked-stress.js) */
  const CHECKS = [['Release comp', 'st.rc', 'Release, bottom compression'], ['Release tens', 'st.rt', 'Release, top tension'], ['Release tens (+M, bot)', 'st.rtb', 'Release, bottom tension'],
    ['Srv comp (perm)', 'st.s1', 'Service, top compression (permanent)'], ['Srv comp (full)', 'st.s2', 'Service I, top compression (full)'], ['Srv tens (top)', 'st.s2t', 'Service, top tension'],
    ['Srv III tens', 'st.s3', 'Service III, bottom tension'], ['Deck comp', 'st.dk', 'Deck compression'],
    ['Srv III top tens (pier, 5.12.3.3.5)', 'st.pier.s3TopN', 'Interior support, top tension (Service III)'], ['Top tens. steel (pier, 5.12.3.3.5)', 'st.pier.AsTop', 'Interior support, top bonded steel'],
    ['Srv comp (bot, −M, 5.12.3.3.5)', 'st.pier.fBot', 'Interior support, bottom compression'], ['Fatigue I (strand)', 'st.fat.dfs', 'Fatigue I, strand stress range'], ['Fatigue I (concrete, 5.5.3.1)', 'st.fat.cTop', 'Fatigue I, concrete compression']];
  const STAGES = [['rel', 'Release'], ['s1', 'Service, permanent'], ['s2', 'Service, full']];
  const ckOf = (R, nm) => { const i = R.checks.findIndex(c => c.n === nm); return i < 0 ? null : { i, c: R.checks[i] }; };
  const near = (R, x) => R.grid.reduce((b, r, i) => Math.abs(r.x - x) < Math.abs(R.grid[b].x - x) ? i : b, 0);
  const govOf = (R, st) => { const c = ckOf(R, st === 'rel' ? 'Release comp' : st === 's1' ? 'Srv comp (perm)' : 'Srv III tens'); return c ? near(R, c.c.loc) : near(R, R.L / 2); };
  const stageOf = ui => STAGES.some(s => s[0] === ui.stStage) ? ui.stStage : 'rel';
  const selOf = (ui, R) => ui.stSel == null || !(ui.stSel >= 0 && ui.stSel < R.grid.length) ? govOf(R, stageOf(ui)) : ui.stSel;
  /* the two fibres drawn for a stage at grid row r: [top key, bottom key] (the old app's pairs: the bottom in service is Service III) */
  const FIB = { rel: ['relTop', 'relBot'], s1: ['s1Top', 's3Bot'], s2: ['s2Top', 's3Bot'] };
  function output(ctx) {
    const { R, inp, ui } = ctx, k = K(), ev = (p, d, u, div) => k.ev(R, p, d, u, div), wk = k.wk, G = R.grid, sel = selOf(ui, R), lim = R.lim;
    let h = '<div id="gfx_st"></div>';
    // the governing stress summary
    const rows = CHECKS.map(([nm, st, lab]) => { const q = ckOf(R, nm); if (!q) return ''; const p = `checks.${q.i}.`, u = q.c.u === 'in²' ? 'in²' : q.c.u;
      return `<tr class="${q.c.pass ? '' : 'ng'}"><td class="lft">${k.esc(lab)}</td><td>${ev(p + 'loc', 2)}</td><td>${ev(p + 'v', 3)}</td><td>${ev(p + 'lim', 3)}</td><td>${k.esc(u)}</td><td><b>${ev(p + 'r', 3)}</b></td><td class="${q.c.pass ? 'ok' : 'ngt'}">${q.c.pass ? 'PASS' : 'FAIL'}</td><td>${wk(st)}</td></tr>`; }).join('');
    h += k.card('Governing stresses (+ compression, − tension)', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Check</th><th>x<br>ft</th><th>Actual</th><th>Limit</th><th>Unit</th><th>Ratio</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Searched over the engine's ${G.length} stations (61 points plus the transfer-length stations). Ratio = actual / limit for compression, |tension| / tension limit (0 in compression). Release: ${R.useT ? 'transformed section with P at f<sub>pbt</sub> (elastic shortening implicit)' : 'gross section with P<sub>i</sub> after elastic shortening'} (5.9.2.3.1); service: gross / composite section with f<sub>pe</sub> (no elastic gains); Service III γ<sub>LL</sub> = ${k.fx(+inp.opt.gLLs3, 2)} (Table 3.4.1-4)${R.cont ? '; continuity on: the stations of the half span next to an interior support are checked by 5.12.3.3.5 for top tension (card below)' : ''}.</p>`, 'card-stgov');
    // the selected station
    const r = G[sel], p = `grid.${sel}.`;
    h += k.card(`Stresses at the selected station x = ${k.fx(r.x, 2)} ft`, `<div class="fRow"><label for="o_stSel">Station</label><select id="o_stSel">${G.map((q, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>x = ${k.fx(q.x, 2)} ft (${k.fx(q.x / R.L, 3)} L)</option>`).join('')}</select><button type="button" id="o_stGov">Governing station of the stage</button></div>`
      + k.kv([['e (strand eccentricity)', ev(p + 'e', 3, 'in')], ['A<sub>ps</sub> effective', ev(p + 'Aps', 3, 'in²')], ['M<sub>g</sub> / M<sub>DC1</sub>', `${ev(p + 'Mg', 1, '', 12)} / ${ev(p + 'Mdk', 1, 'kip-ft', 12)}`], ['M<sub>DC2+DW</sub> / M<sub>LL+IM</sub>', `${ev(p + 'Msd', 1, '', 12)} / ${ev(p + 'Mll', 1, 'kip-ft', 12)}`],
        ['Release top / bottom', `${ev(p + 'relTop', 3)} / ${ev(p + 'relBot', 3, 'ksi')}`], ['Service top, permanent', ev(p + 's1Top', 3, 'ksi')], ['Service I top, full', ev(p + 's2Top', 3, 'ksi')], ['Service III bottom', ev(p + 's3Bot', 3, 'ksi')], ['Deck top', ev(p + 'dkC', 3, 'ksi')],
        ...(r.s3TopN != null ? [['Service III top, negative LL', ev(p + 's3TopN', 3, 'ksi')], ['Service I bottom, negative LL (perm / full)', `${ev(p + 's1BotN', 3)} / ${ev(p + 's2BotN', 3, 'ksi')}`]] : [])])
      + '<div id="gfx_stsec"></div>', 'card-stsel');
    // the tenth points
    const tenth = G.map((q, i) => i).filter(i => Math.abs(G[i].x * 10 / R.L - Math.round(G[i].x * 10 / R.L)) < 1e-6 || i === sel);
    h += k.card('Stresses at the tenth points (ksi, + compression; moments kip-ft)', `<div class="tscroll"><table class="tbl"><thead><tr><th>x<br>ft</th><th>e<br>in</th><th>A<sub>ps</sub><br>in²</th><th>M<sub>g</sub></th><th>M<sub>DC1</sub></th><th>M<sub>DC2+DW</sub></th><th>M<sub>LL+IM</sub></th><th>Release top</th><th>Release bottom</th><th>Service top perm</th><th>Service I top</th><th>Service III bottom</th></tr></thead><tbody>
      ${tenth.map(i => { const q = `grid.${i}.`; return `<tr${i === sel ? ' class="sel"' : ''}><td>${ev(q + 'x', 1)}</td><td>${ev(q + 'e', 2)}</td><td>${ev(q + 'Aps', 2)}</td><td>${ev(q + 'Mg', 0, '', 12)}</td><td>${ev(q + 'Mdk', 0, '', 12)}</td><td>${ev(q + 'Msd', 0, '', 12)}</td><td>${ev(q + 'Mll', 0, '', 12)}</td><td>${ev(q + 'relTop', 3)}</td><td>${ev(q + 'relBot', 3)}</td><td>${ev(q + 's1Top', 3)}</td><td>${ev(q + 's2Top', 3)}</td><td>${ev(q + 's3Bot', 3)}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="note">The governing search runs over every station of the engine (the table shows the tenth points and the selected station). M<sub>LL+IM</sub>: the positive envelope (it maximises the bottom tension and the top compression); the negative envelope enters the interior-support checks.</p>`, 'card-sttab');
    // the interior supports (5.12.3.3.5)
    const v = R.cont && R.cont.svc;
    if (v) {
      const t = ckOf(R, 'Srv III top tens (pier, 5.12.3.3.5)'), b = ckOf(R, 'Srv comp (bot, −M, 5.12.3.3.5)'), s = ckOf(R, 'Top tens. steel (pier, 5.12.3.3.5)');
      h += k.card('Interior supports of the span made continuous (5.12.3.3.5)', k.kv([
        ...(v.topRC ? [['Top of the girder', 'designed as reinforced concrete at the strength limit state (Flexure tab, pier section)']] : [['Top tension limit (f′<sub>c</sub> for f′<sub>ci</sub>)', `${ev('cont.svc.topLim', 3, 'ksi')} ${wk('st.pier.topLim')}`],
          ['Service III top, negative LL', `${ev('cont.svc.wT.s3TopN', 3, 'ksi')} at x = ${ev('cont.svc.wT.x', 2, 'ft')} ${wk('st.pier.s3TopN')}`], ...(t ? [['Ratio', `<b>${ev(`checks.${t.i}.r`, 3)}</b> ${t.c.pass ? 'PASS' : 'FAIL'}`]] : []),
          ...(v.Ttop > 0 ? [['Tension force T / bonded steel needed', `${ev('cont.svc.Ttop', 1, 'kip')} / ${ev('cont.svc.AsTop', 2, 'in²')} ${wk('st.pier.AsTop')}`], ['Steel entered (girder top near the pier)', v.AsTopProv > 0 ? `${ev('cont.svc.AsTopProv', 2, 'in²')}${s ? ` (ratio ${ev(`checks.${s.i}.r`, 3)})` : ''}` : 'none entered: required area reported']] : [])]),
        [`Bottom compression (${v.bPerm ? 'permanent' : 'full'} governs)`, `${ev('cont.svc.fBot', 3, 'ksi')} vs ${ev('cont.svc.limBot', 3, 'ksi')} at x = ${ev('cont.svc.wB.x', 2, 'ft')} ${wk('st.pier.fBot')}`], ...(b ? [['Ratio', `<b>${ev(`checks.${b.i}.r`, 3)}</b> ${b.c.pass ? 'PASS' : 'FAIL'}`]] : [])])
        + `<p class="note">The stations of the half span next to an interior support, with the negative LL+IM envelope of the continuous unit and a negative restraint moment where it adds (5.12.3.3.2). Bonded reinforcement setting and its f<sub>y</sub>: <a href="#" data-goin="loads">Loads tab</a> (release stress options); steel in the girder top near the pier: <a href="#" data-goin="gird">Girders &amp; strands tab</a>.</p>`, 'card-stpier');
    }
    // Fatigue I and crack control
    const F = R.fat, C = F.conc, fs = ckOf(R, 'Fatigue I (strand)'), fcq = ckOf(R, 'Fatigue I (concrete, 5.5.3.1)');
    h += k.card('Fatigue I (5.5.3)', k.kv([['M<sub>fat</sub> per lane / DF<sub>fat</sub>', `${ev('fat.Mfat', 1, 'kip-ft')} / ${ev('fat.dfFat', 4)} ${wk('st.fat.df')}`], ['M<sub>fat</sub> per girder with IM', `${ev('fat.Mfat1', 1, 'kip-ft')} ${wk('st.fat.M1')}`],
      ['Bottom fibre, permanent / under Fatigue I', `${ev('fat.fbPerm', 3)} / ${ev('fat.fbMinFat', 3, 'ksi')} ${wk('st.fat.fbMin')}`], ['Cracking trigger 0.095√f′<sub>c</sub>', `${ev('fat.frFat', 3, 'ksi')}: ${F.cracksFat ? 'cracked' : 'uncracked'} ${wk('st.fat.fr')}`],
      ['Strand stress range / limit', `${ev('fat.dfStrand', 2)} / ${ev('fat.fatLimit', 1, 'ksi')} ${wk('st.fat.dfs')}`], ...(fs ? [['Ratio (strand)', `<b>${ev(`checks.${fs.i}.r`, 3)}</b> ${fs.c.pass ? 'PASS' : 'FAIL'}`]] : []),
      ['Concrete, top / bottom', `${ev('fat.conc.top', 3)} / ${ev('fat.conc.bot', 3, 'ksi')} ${wk('st.fat.cTop')}`], ['Limit 0.40 f′<sub>c</sub>', ev('fat.conc.lim', 3, 'ksi')], ...(fcq ? [['Ratio (concrete)', `<b>${ev(`checks.${fcq.i}.r`, 3)}</b> ${fcq.c.pass ? 'PASS' : 'FAIL'}`]] : [])])
      + `<p class="note">Fatigue truck (30 ft rear axle spacing, one lane, IM = 15 %, γ = 1.75), the moment at midspan, f<sub>pe</sub> without gains. Strand limit 18 ksi for a radius of curvature ≥ 30 ft (10 ksi applies at sharp deviations, 5.5.3.3). Concrete: ½(f<sub>pe</sub> + permanent) + Fatigue I ≤ 0.40 f′<sub>c</sub>; top at midspan, bottom the largest over the span (x = ${k.fx(C.xBot, 2)} ft).</p>`, 'card-stfat');
    const cr = R.crack;
    h += k.card('Crack control (5.6.7)', cr.cracked ? k.kv([['Service III bottom tension', `${ev('crack.fssBot', 3, 'ksi')}`], ['β<sub>s</sub>', `${ev('crack.betaCr', 3)} ${wk('st.crk.beta')}`], ['Maximum spacing of the bonded reinforcement', `<b>${ev('crack.sMaxCrack', 1, 'in')}</b> ${wk('st.crk.s')}`]]) + '<p class="note">The Service III bottom fibre is in tension: provide bonded reinforcement at no more than this spacing (γ<sub>e</sub> = 0.75, d<sub>c</sub> = 2.0 in assumed).</p>'
      : `<p class="note">${k.esc(cr.note)}: the 5.6.7 spacing limit is not triggered. Provide nominal bonded reinforcement per detailing practice. ${wk('st.crk.none')}</p>`, 'card-stcrk');
    h += k.card('Worked steps: stresses', `<p class="note">AASHTO LRFD 10th Ed. (2024). Every result is the engine's value; the stresses at the station where each check governs. f<sub>pi</sub>, f<sub>pe</sub>: <a href="#st-ls.fpe" data-gotab="loss">Losses tab</a>; section moduli: <a href="#st-sec.Sbc" data-gotab="sec">Section properties tab</a>; moments: <a href="#st-an.MuS" data-gotab="an">Analysis tab</a>.</p>${k.steps(ctx.W.stresses.steps, TOPICS, OPEN)}`);
    void lim;
    return h;
  }
  /* the stress diagram on the girder section at grid row i for the stage */
  function secFig(R, inp, i, stage, W) {
    const V = VK(), S = V.scene(), G = R.g, ss = R.ss, r = R.grid[i], [kt, kb] = FIB[stage], fT = r[kt], fB = r[kb], h = G.h, lim = R.lim;
    const half = halfPolygon(G), poly = half.concat(half.slice().reverse().map(p => [-p[0], p[1]]));
    S.poly(poly, 'dt-cc'); sectionVoids(G).forEach(v => { if (v.type === 'rect') S.rect(v.x - v.w / 2, v.y - v.h / 2, v.x + v.w / 2, v.y + v.h / 2, 'dt-cc', { fill: '#fff' }); else S.circ(v.x, v.y, v.d / 2, 'dt-cc', { fill: '#fff' }); });
    // strands at the station (straight rows; the draped strands at their centroid at x)
    const xm = Math.min(r.x, R.L - r.x), a = +ss.hp.frac * R.L, yh = ss.nh > 0 ? (xm >= a ? +ss.hp.yMid : +ss.hp.yEnd + (+ss.hp.yMid - +ss.hp.yEnd) * xm / a) : 0;
    // the drawn positions of the strand-pattern graphic (PSBStrandGfx.xy, the old app's strandXY; NEXT: in the two stems, PS-27), the draped ones about yh
    const pts = window.PSBStrandGfx.xy(R, yh);
    pts.forEach(q => S.circ(q.x, q.y, q.h ? ss.st.db / 2 : Math.max(ss.st.db / 2, 0.25), 'dt-bar', q.h ? { fill: '#B45309' } : undefined));
    if (ss.nh > 0) { const [, dx1, , dy1] = window.PSBStrandGfx.drapedBox(pts); S.callout(dx1 + 0.2, dy1 - 1, 30, -12, [`draped (${ss.nh})`], { sz: 10.5 }); }
    // the stress profile beside the section (linear between the two fibres; + compression to the right)
    const lims = stage === 'rel' ? [[lim.relC, `${V.fx(lim.relCfac, 2)} f′_ci`], [-lim.relT, 'tension limit']] : stage === 's1' ? [[lim.srvC1, '0.45 f′_c'], [-lim.srvT, 'tension limit']] : [[lim.srvC2, '0.60 f′_c'], [-lim.srvT, 'tension limit']];
    const fmax = Math.max(Math.abs(fT), Math.abs(fB), ...lims.map(q => Math.abs(q[0])), 0.05), xr = Math.max(G.bbf || 0, G.btf || 0) / 2, X0 = xr + 0.55 * h, kx = 0.28 * h / fmax, X = f => X0 + kx * f;
    const tri = (y0, f0, y1, f1, c) => S.poly([[X0, y0], [X(f0), y0], [X(f1), y1], [X0, y1]], 'dt-ol', { fill: c ? '#DBEAFE' : '#FDE7DA', stroke: c ? '#2563EB' : '#DC6B2F', sw: 1.2 });
    if (fT * fB >= 0) tri(0, fB, h, fT, fT + fB >= 0);
    else { const yNA = h * (0 - fB) / (fT - fB); tri(0, fB, yNA, 0, fB > 0); tri(yNA, 0, h, fT, fT > 0);
      S.line(-xr - 4, yNA, X0 + 2, yNA, 'dt-hid', { stroke: '#15803D' }); S.text(-xr - 4, yNA, `N.A. ${V.fx(yNA, 1)} in`, { a: 'end', dx: -3, vc: true, sz: 10.5, fill: '#15803D' }); }
    S.line(X0, -4, X0, h + 4, 'dt-ol', { sw: 1 });
    lims.forEach(([f, t], j) => { S.line(X(f), -2, X(f), h + 2, 'dt-hid', { stroke: f < 0 ? '#B45309' : '#B91C1C' }); S.text(X(f), h, t, { a: 'middle', dy: -24 - 13 * j, sz: 10, fill: f < 0 ? '#B45309' : '#B91C1C', halo: true }); });
    S.text(X(fT), h, `${V.fx(fT, 3)} ksi`, { a: fT >= 0 ? 'start' : 'end', dx: fT >= 0 ? 5 : -5, vc: true, sz: 11, w: true });
    S.text(X(fB), 0, `${V.fx(fB, 3)} ksi`, { a: fB >= 0 ? 'start' : 'end', dx: fB >= 0 ? 5 : -5, vc: true, sz: 11, w: true });
    S.text(X0, 0, 'σ, ksi (+ compression)', { a: 'middle', dy: 18, sz: 10.5, cls: 'dt-m' });
    S.region(X0 - kx * fmax, 0, X0 + kx * fmax, h, `x = ${V.fx(r.x, 2)} ft: top ${V.fx(fT, 3)} ksi, bottom ${V.fx(fB, 3)} ksi (${kt}, ${kb})`);
    S.dimV(0, h, -xr, -14, `h = ${V.fx(h, 1)} in`, { sz: 10.5 });
    return { html: S.render({ W, maxH: Math.min(380, Math.max(240, W * 0.6)), label: 'Stress distribution on the girder section' }).svg, nar: W < 560 };
  }
  const HIDE = {};
  function after(el, ctx) {
    K().after(el, OPEN);
    const { R, inp, ui } = ctx, k = K(), ev = (p, d) => k.ev(R, p, d), G = R.grid, xs = G.map(r => r.x), sel = selOf(ui, R), stage = stageOf(ui), lim = R.lim;
    const nearX = x => xs.reduce((b, v, i) => Math.abs(v - x) < Math.abs(xs[b] - x) ? i : b, 0);
    const slot = el.querySelector('#gfx_st');
    if (slot && VA() && VA().mount) {
      const tile = (nm, lab, tone) => { const q = ckOf(R, nm); return q ? { label: lab, value: ev(`checks.${q.i}.v`, 3), unit: `ksi · ${k.fx(q.c.r, 2)}`, tone: q.c.pass ? tone : 't' } : null; };
      const REL = [{ key: 'rt', html: 'top', ci: 0, f: 'relTop' }, { key: 'rb', html: 'bottom', ci: 1, f: 'relBot' }];
      const SRV = [{ key: 's1', html: 'top, permanent', ci: 2, f: 's1Top' }, { key: 's2', html: 'top, Service I', ci: 0, f: 's2Top' }, { key: 's3', html: 'bottom, Service III', ci: 1, f: 's3Bot' }, ...(G[0].s3TopN != null ? [{ key: 'tn', html: 'top, Service III −LL', ci: 3, dash: '5 3', f: 's3TopN' }] : [])];
      const ser = Ls => Ls.map(q => ({ key: q.key, ci: q.ci, dash: q.dash, pts: G.map(r => [r.x, r[q.f]]) }));
      const gov = nms => nms.map(nm => ckOf(R, nm)).filter(Boolean).map(q => ({ x: q.c.loc, y: q.c.v }));
      const grp = (g, label, Ls) => ({ label, items: Ls.map(q => ({ key: g + ':' + q.key, html: `${VA().swatch(q.ci, q.dash)} ${q.html}`, on: !(HIDE[g] || {})[q.key] })) });
      const at = x => { const r = G[nearX(x)]; return [`x = ${k.fx(r.x, 2)} ft`, `release ${k.fx(r.relTop, 3)} / ${k.fx(r.relBot, 3)}; service top ${k.fx(r.s1Top, 3)} (perm), ${k.fx(r.s2Top, 3)} (I); bottom ${k.fx(r.s3Bot, 3)} (III) ksi`]; };
      VA().mount(slot, { key: 'st', title: 'Girder stresses along the span', sub: `+ compression, − tension (ksi); ${G.length} stations`,
        controls: VK().tiles([tile('Release comp', 'Release, bottom', 'c'), tile('Release tens', 'Release, top', ''), tile('Srv comp (perm)', 'Top, permanent', 'c'), tile('Srv comp (full)', 'Top, Service I', 'c'), tile('Srv III tens', 'Bottom, Service III', ''), tile('Deck comp', 'Deck', 'c')].filter(Boolean)),
        draw: W => VA().render({ L0: 0, L1: R.L, sup: [0, R.L], sel: xs[sel], selLabel: `x = ${k.fx(xs[sel], 2)} ft`, axisTitle: 'Station x, ft (from ℄ bearing, left)', aria: 'Girder stresses along the span', rows: [
          { kind: 'chart', key: 'rel', label: `At transfer (${R.useT ? 'transformed section, P at f_pbt' : 'gross section, P_i'})`, unit: 'ksi', series: ser(REL), hidden: HIDE.rel, limits: [{ y: lim.relC, label: `${k.fx(lim.relCfac, 2)} f′_ci = ${k.fx(lim.relC, 3)}` }, { y: -lim.relT, label: `tension limit −${k.fx(lim.relT, 3)}` }], gov: gov(['Release comp', 'Release tens', 'Release tens (+M, bot)']), h: W < 600 ? 130 : 170 },
          { kind: 'chart', key: 'srv', label: `In service (f_pe, γ_LL = ${k.fx(+inp.opt.gLLs3, 2)} for Service III)`, unit: 'ksi', series: ser(SRV), hidden: HIDE.srv, limits: [{ y: lim.srvC1, label: `0.45 f′_c = ${k.fx(lim.srvC1, 3)}` }, { y: lim.srvC2, label: `0.60 f′_c = ${k.fx(lim.srvC2, 3)}` }, { y: -lim.srvT, label: `tension limit −${k.fx(lim.srvT, 3)}` }], gov: gov(['Srv comp (perm)', 'Srv comp (full)', 'Srv tens (top)', 'Srv III tens']), h: W < 600 ? 150 : 200 }] }, W),
        at, pickX: x => nearX(x), snap: x => xs[nearX(x)], onSelect: i => { ui.stSel = i; if (ctx.redraw) ctx.redraw(); },
        chips: () => [grp('rel', 'Transfer', REL), grp('srv', 'Service', SRV)], onChip: key => { const [g, s] = key.split(':'), o = HIDE[g] = HIDE[g] || {}; o[s] = !o[s]; },
        legend: VA().legend('marks'), hint: 'Point at (or tap) the chart to read the station; click or tap to select it.',
        caption: '<p class="vk-cap">The engine\'s fibre stresses at its stations; circles: the governing stations of the checks. Click a station to select it. Display only.</p>' });
    }
    const s2 = el.querySelector('#gfx_stsec');
    if (s2 && VK() && VK().detCard) {
      const [kt, kb] = FIB[stage];
      VK().detCard(s2, { id: 'stSecFig', title: 'Stress distribution on the girder section', sub: `x = ${k.fx(G[sel].x, 2)} ft; top: ${kt}, bottom: ${kb}`,
        seg: { label: 'Stage', items: STAGES, cur: stage, on: key => { ui.stStage = key; ui.stSel = null; if (ctx.redraw) ctx.redraw(); } },
        draw: W => secFig(R, inp, sel, stage, W), hint: 'Point at (or tap) the stress diagram for its values.',
        cap: `<p class="vk-cap">Linear between the two fibres (plane sections); ${stage === 'rel' ? 'at release, the top and bottom fibres of the girder' : `in service the bottom fibre is Service III and the top fibre ${stage === 's1' ? 'the permanent loads' : 'Service I (full)'}, as the old app's stress map`}. Strands at the station (draped strands at their centroid there). Stage buttons select the stage and its governing station. Display only.</p>` });
    }
    const ge = el.querySelector('#o_stGov'); if (ge) ge.addEventListener('click', () => { ui.stSel = null; if (ctx.redraw) ctx.redraw(); });
  }
  function onOutChange(e, ui) { if (e.target.id === 'o_stSel') { ui.stSel = +e.target.value; return true; } return false; }
  window.PSBUiStresses = { output, after, onOutChange, TOPICS, CHECKS, secFig };   // secFig: also for tests/engine/psbridge-strandgfx.test.mjs (PS-27)
})();
