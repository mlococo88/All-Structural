/* apps/ps-bridge/ui/shear.js — the Shear output tab (window.PSBUiShear). Classic script; display only. Created 2026-11-12 (PR 2c-2,
   docs/ps-bridge-plan.md §2.3). As the old app's Shear tab (shear demand against the resistance, the section-by-section design by the
   general procedure, the longitudinal reinforcement tie, strand development, the critical section worked, interface shear), in the steel
   app's layout. Every number is the engine's (computeAll R: R.shear, R.shearDiag, R.wShear, R.wLong, R.iface, R.rv.tie, R.ldBonded, …),
   worked in engine/worked-strength.js shear(); the graphic: the shear demand and resistance along the girder (the steel along-girder chart).
     output(ctx) -> HTML; after(el, ctx). ctx = { P, inp, R, W, ui, redraw } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong, VK = () => window.PSBVizKit;
  const OPEN = new Set(['crit']);
  const A = 'AASHTO LRFD 10th Ed. ';
  const TOPICS = [
    { key: 'crit', title: 'Shear at the critical section (general procedure)', ref: A + '5.7.3', ids: /^sh\.(x|dp|dv|Vu|Vp|Mu|esRaw|es|beta|theta|Vc|Vs|Vn|dc|gov)$/, res: /^sh\.gov$/ },
    { key: 'sp', title: 'Stirrup spacing limits', ref: A + '5.7.2.5, 5.7.2.6', ids: /^sh\.(vu|sMax|sMinR|sGov)$/, res: /^sh\.sGov$/ },
    { key: 'tie', title: 'Longitudinal reinforcement (tension tie)', ref: A + '5.7.3.5', ids: /^sh\.(Tdem|Tcap|Tr)$/, res: /^sh\.Tr$/ },
    { key: 'if', title: 'Interface shear (girder / deck)', ref: A + '5.7.4', ids: /^sh\.(vui|Avfreq|Avfmin|Avfprov|ifr)$/, res: /^sh\.ifr$/ },
    { key: 'dev', title: 'Strand transfer and development lengths', ref: A + '5.9.4.3', ids: /^sh\.(lt|ldB|ldD)$/ }];
  const ckOf = (R, nm) => { const i = R.checks.findIndex(c => c.n === nm); return i < 0 ? null : { i, c: R.checks[i] }; };
  const st = ok => `<td class="${ok ? 'ok' : 'ngt'}">${ok ? 'PASS' : 'FAIL'}</td>`;
  function output(ctx) {
    const { R, inp } = ctx, k = K(), ev = (p, d, u, div) => k.ev(R, p, d, u, div), wk = k.wk, S = R.shear;
    const qS = ckOf(R, 'Shear'), qL = ckOf(R, 'Long. reinf (5.7.3.5)'), qI = ckOf(R, 'Interface shear (5.7.4)');
    let h = '<div id="gfx_sh"></div>';
    h += k.card('Shear (governing values)', k.kv([['Worst V<sub>u</sub> / φV<sub>n</sub>', `<b>${ev(`checks.${qS.i}.r`, 3)}</b> at x = ${ev('wShear.x', 2, 'ft')} ${qS.c.pass ? 'PASS' : 'FAIL'} ${wk('sh.gov')}`],
      ['Longitudinal tie T / T<sub>r</sub>', `<b>${ev(`checks.${qL.i}.r`, 3)}</b> at x = ${ev('wLong.x', 2, 'ft')} ${qL.c.pass ? 'PASS' : 'FAIL'} ${wk('sh.Tr')}`], ['Interface shear', `<b>${ev(`checks.${qI.i}.r`, 3)}</b> at x = ${ev('wIface.x', 2, 'ft')} ${qI.c.pass ? 'PASS' : 'FAIL'} ${wk('sh.ifr')}`],
      ['Stirrups (trial)', `${k.fx(+inp.opt.stirAv, 2)} in² at ${k.fx(+inp.opt.sEnd, 1)} in (end zone, ${k.fx(+inp.opt.endZoneLen, 2)} L each end) / ${k.fx(+inp.opt.sInt, 1)} in, f<sub>y</sub> ${k.fx(+inp.opt.fy, 0)} ksi <a href="#" data-goin="gird">Girders &amp; strands</a>`]])
      + `<p class="note">V<sub>u</sub> = η(|1.25 V<sub>DC</sub> + 1.50 V<sub>DW</sub>| + 1.75 m V<sub>LL+IM</sub>), the live-load shear with DF<sub>V</sub> = ${k.fx(R.dfv, 3)} and IM. The shear check starts at the critical section (d<sub>v</sub> from the inside face of the bearing, 5.7.3.2); the bearing row is for the longitudinal tie only (5.7.3.5).</p>`, 'card-shgov');
    h += k.card('Section-by-section design (β = 4.8/(1 + 750ε<sub>s</sub>), θ = 29 + 3500ε<sub>s</sub>, φ = 0.90)', `<div class="tscroll"><table class="tbl"><thead><tr><th>x<br>ft</th><th>d<sub>v</sub><br>in</th><th>V<sub>u</sub><br>kip</th><th>V<sub>p</sub><br>kip</th><th>ε<sub>s</sub></th><th>β</th><th>θ<br>°</th><th>V<sub>c</sub><br>kip</th><th>φV<sub>n</sub><br>kip</th><th>V<sub>s,req</sub><br>kip</th><th>s<sub>req</sub><br>in</th><th>s<sub>max</sub><br>in</th><th>s<sub>prov</sub><br>in</th><th>V<sub>u</sub>/φV<sub>n</sub></th><th>Status</th></tr></thead><tbody>
      ${S.map((r, i) => { const p = `shear.${i}.`, bad = r.stirReq && r.sProv > r.sMaxGov + 1e-3; return `<tr${r.isBearing ? ' class="sel"' : ''}><td>${r.isBearing ? 'brg ' : ''}${ev(p + 'x', 2)}</td><td>${ev(p + 'dv', 1)}</td><td>${ev(p + 'Vu', 1)}</td><td>${ev(p + 'Vp', 1)}</td><td>${ev(p + 'es', 6)}</td><td>${ev(p + 'beta', 2)}</td><td>${ev(p + 'theta', 1)}</td><td>${ev(p + 'Vc', 1)}</td><td>${ev(p + 'phiVn', 1)}</td><td>${ev(p + 'VsReq', 1)}</td><td>${ev(p + 'sReq', 1)}</td><td${bad ? ' class="ngt"' : ''}>${ev(p + 'sMaxGov', 1)}</td><td${bad ? ' class="ngt"' : ''}>${ev(p + 'sProv', 1)}</td><td><b>${ev(p + 'dc', 3)}</b></td>${r.isBearing ? '<td>tie only</td>' : st(r.dc <= 1.0001 && r.vuMaxOK && r.spOK)}</tr>`; }).join('')}</tbody></table></div>
      <p class="note">φV<sub>n</sub> = φ min(V<sub>c</sub> + V<sub>s</sub> + V<sub>p</sub>, 0.25 f′<sub>c</sub> b<sub>v</sub> d<sub>v</sub> + V<sub>p</sub>). A spacing above the maximum (the smaller of 5.7.2.6 and the A<sub>v,min</sub> spacing of 5.7.2.5) fails the section wherever stirrups are required (V<sub>u</sub> &gt; 0.5φ(V<sub>c</sub> + V<sub>p</sub>), 5.7.2.3), even when φV<sub>n</sub> ≥ V<sub>u</sub> (red). ε<sub>s</sub> by Eq. 5.7.3.4.2-4 with f<sub>po</sub> = 0.7 f<sub>pu</sub> ramped over the transfer length; a negative value recomputed with E<sub>c</sub>A<sub>ct</sub> and limited to −0.40 × 10⁻³. "—": no stirrups needed for strength.</p>`, 'card-shtab');
    h += k.card('Longitudinal reinforcement: the shear–flexure tie (5.7.3.5)', `<div class="tscroll"><table class="tbl"><thead><tr><th>x<br>ft</th><th>T demand<br>kip</th><th>T strands<br>kip</th><th>T mild<br>kip</th><th>T<sub>r</sub><br>kip</th><th>T/T<sub>r</sub></th><th>Status</th></tr></thead><tbody>
      ${S.map((r, i) => `<tr${r.isBearing ? ' class="sel"' : ''}><td>${r.isBearing ? 'brg ' : ''}${ev(`shear.${i}.x`, 2)}</td><td>${ev(`shear.${i}.Tdem`, 0)}</td><td>${ev(`rv.tie.${i}.Tps`, 0)}</td><td>${ev(`shear.${i}.TsMild`, 0)}</td><td>${ev(`shear.${i}.Tcap`, 0)}</td><td><b>${ev(`rv.tie.${i}.dc`, 2)}</b></td>${st(r.longOK)}</tr>`).join('')}</tbody></table></div>
      <p class="note">T = |M<sub>u</sub>|/(φ<sub>f</sub> d<sub>v</sub>) + (|V<sub>u</sub>|/φ<sub>v</sub> − 0.5 V<sub>s</sub> − |V<sub>p</sub>|) cot θ; at the inside edge of the bearing ("brg") the shear term only (Eq. 5.7.3.5-2). The strands supply their developed stress (transfer and development lengths from the girder end), so near the bearing the tie relies on the bottom mild steel (A<sub>s</sub> f<sub>y</sub> = ${ev('shear.0.TsMild', 0, 'kip')}; <a href="#" data-goin="gird">Girders &amp; strands tab</a>). Worked at the critical section ${wk('sh.Tdem')}.</p>`, 'card-shtie');
    h += k.card('Strand development (5.9.4.3.2)', k.kv([['Transfer length ℓ<sub>t</sub> = 60 d<sub>b</sub>', `${ev('ss.lt', 1, 'in')} ${wk('sh.lt')}`], ['ℓ<sub>d</sub> bonded = 1.6(f<sub>ps</sub> − ⅔f<sub>pe</sub>)d<sub>b</sub>', `${ev('ldBonded', 1, 'in')} (${ev('ldBonded', 2, 'ft', 12)}) ${wk('sh.ldB')}`],
      ['ℓ<sub>d</sub> debonded = 2.0(f<sub>ps</sub> − ⅔f<sub>pe</sub>)d<sub>b</sub>', `${ev('ldDebond', 1, 'in')} (${ev('ldDebond', 2, 'ft', 12)}) ${wk('sh.ldD')}`], ['f<sub>ps</sub> (midspan) / f<sub>pe</sub>', `${ev('fMid.fps', 1)} / ${ev('fpe', 1, 'ksi')}`]])
      + '<p class="note">The strand stress available for flexure and for the tie is reduced inside ℓ<sub>d</sub>; debonded strands start their transfer and development at the end of the debonded length (5.9.4.3.3).</p>', 'card-shdev');
    h += k.card('Interface shear, girder / deck (5.7.4; roughened, c = 0.28 ksi, μ = 1.0)', `<div class="tscroll"><table class="tbl"><thead><tr><th>x<br>ft</th><th>v<sub>ui</sub><br>ksi</th><th>A<sub>vf,req</sub><br>in²/ft</th><th>A<sub>vf,min</sub><br>in²/ft</th><th>A<sub>vf,prov</sub><br>in²/ft</th><th>Ratio</th><th>Status</th></tr></thead><tbody>
      ${R.iface.map((r, i) => `<tr><td>${ev(`iface.${i}.x`, 2)}</td><td>${ev(`iface.${i}.vui`, 3)}</td><td>${ev(`iface.${i}.AvfReq`, 3)}</td><td>${r.minWaived ? 'waived' : ev(`iface.${i}.AvfMin`, 3)}</td><td>${ev(`iface.${i}.AvfProv`, 3)}</td><td><b>${ev(`iface.${i}.r`, 3)}</b></td>${st(r.ok)}</tr>`).join('')}</tbody></table></div>
      <p class="note">At every shear station. The minimum A<sub>vf</sub> (0.05 A<sub>cv</sub>/f<sub>y</sub>) is waived only where v<sub>ui</sub> &lt; 0.210 ksi (5.7.4.2: a roughened interface with all the vertical shear steel extended into the deck). Ratio: the largest of the resistance, the upper limit (5.7.4.3-4, -5) and the minimum steel.</p>`, 'card-shif');
    h += k.card('Worked steps: shear', `<p class="note">AASHTO LRFD 10th Ed. (2024). Every result is the engine's value; worked at the critical section (x = ${k.fx(S.find(r => !r.isBearing).x, 2)} ft) and where each check governs. The end-zone checks (splitting, confinement, release steel, hold-down) are on the End zone &amp; hold-down tab (PR 2d).</p>${k.steps(ctx.W.shear.steps, TOPICS, OPEN)}`);
    return h;
  }
  const HIDE = {};
  function after(el, ctx) {
    K().after(el, OPEN);
    const { R, inp } = ctx, k = K(), ev = (p, d) => k.ev(R, p, d), D = R.shearDiag, xs = D.map(r => r.x), L = R.L;
    const nearX = x => xs.reduce((b, v, i) => Math.abs(v - x) < Math.abs(xs[b] - x) ? i : b, 0);
    const slot = el.querySelector('#gfx_sh'); if (!slot || !VA() || !VA().mount) return;
    const qS = ckOf(R, 'Shear'), qL = ckOf(R, 'Long. reinf (5.7.3.5)'), qI = ckOf(R, 'Interface shear (5.7.4)');
    const SER = [{ key: 'vu', html: 'V<sub>u</sub>', ci: 2, pts: D.map(r => [r.x, r.Vu]) }, { key: 'pvn', html: 'φV<sub>n</sub> (trial stirrups)', ci: 0, pts: D.map(r => [r.x, r.phiVn]) }, { key: 'pvc', html: 'φ(V<sub>c</sub> + V<sub>p</sub>)', ci: 1, dash: '3 3', pts: D.map(r => [r.x, r.phiVcp]) },
      { key: 'st', html: 'design stations (φV<sub>n</sub>)', ci: 0, kind: 'points', hollow: true, pts: R.shear.filter(r => !r.isBearing).map(r => [r.x, r.phiVn]) }];
    const grp = (label, Ls) => ({ label, items: Ls.map(q => ({ key: q.key, html: q.kind === 'points' ? q.html : `${VA().swatch(q.ci, q.dash)} ${q.html}`, on: !HIDE[q.key] })) });
    const at = x => { const r = D[nearX(x)]; return [`x = ${k.fx(r.x, 2)} ft`, `V_u ${k.fx(r.Vu, 1)}, φV_n ${k.fx(r.phiVn, 1)}, φ(V_c + V_p) ${k.fx(r.phiVcp, 1)} kip`]; };
    VA().mount(slot, { key: 'sh', title: 'Shear demand and resistance along the girder', sub: `kip per girder; general procedure (MCFT), ${k.fx(+inp.opt.stirAv, 2)} in² stirrups at ${k.fx(+inp.opt.sEnd, 1)} / ${k.fx(+inp.opt.sInt, 1)} in`,
      controls: VK().tiles([{ label: 'V<sub>u</sub> / φV<sub>n</sub>', value: ev(`checks.${qS.i}.r`, 3), unit: qS.c.pass ? 'PASS' : 'FAIL', tone: qS.c.pass ? 'c' : 't' }, { label: 'at x', value: ev('wShear.x', 2), unit: 'ft' },
        { label: 'Long. tie', value: ev(`checks.${qL.i}.r`, 3), unit: qL.c.pass ? 'PASS' : 'FAIL', tone: qL.c.pass ? '' : 't' }, { label: 'Interface', value: ev(`checks.${qI.i}.r`, 3), unit: qI.c.pass ? 'PASS' : 'FAIL', tone: qI.c.pass ? '' : 't' },
        { label: 'ℓ<sub>d</sub> bonded', value: ev('ldBonded', 1), unit: 'in' }, { label: 'DF<sub>V</sub>', value: ev('dfv', 3), unit: '' }]),
      draw: W => VA().render({ L0: 0, L1: L, sup: [0, L], axisTitle: 'Station x, ft (from ℄ bearing, left)', aria: 'Shear demand and resistance along the girder', rows: [
        { kind: 'chart', key: 'v', label: 'V_u against φV_n', unit: 'kip', series: SER, hidden: HIDE, gov: [{ x: R.wShear.x, y: R.wShear.phiVn }], h: W < 600 ? 160 : 220 }] }, W),
      at, snap: x => xs[nearX(x)], chips: () => [grp('Show', SER)], onChip: key => { HIDE[key] = !HIDE[key]; },
      legend: VA().legend('marks'), hint: 'Point at (or tap) the chart to read the station.',
      caption: '<p class="vk-cap">The engine\'s V<sub>u</sub> and φV<sub>n</sub> over the span (every station) and at the design stations of the table; circle: the governing station. Display only.</p>' });
  }
  window.PSBUiShear = { output, after, TOPICS };
})();
