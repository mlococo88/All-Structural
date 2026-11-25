/* apps/ps-bridge/ui/nomen.js — the Nomenclature output tab (window.PSBUiNomen): the old app's "Nomenclature — Live Variable Reference"
   (O:8815-8960), about 90 symbols of the design with the engine's value for the girder type and line shown, the unit, the AASHTO LRFD 10th
   Ed. article and a § link to the worked step where the value is worked (CLAUDE.md §6); a search box filters the rows (symbol, description,
   article). Created 2026-11-15 (batch G6) in the Steel Bridge app's table style. Classic script; display only: every value is the engine's
   (R at its path, as the result tabs' data-ev) or an input; nothing is calculated or saved (the search text lives in this page view).
     output(ctx) -> HTML; after(el, ctx) wires the search box. ctx = { P, inp, R, W, ui } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit;
  const S = { q: '' };
  const TAB = { sec: 'sec', ld: 'lds', an: 'an', ls: 'loss', st: 'str', fx: 'flex', sh: 'shear', ez: 'end', cb: 'camb', rt: 'rt' };
  /* rows: [symbol (HTML), description, unit, value (R path | { inp: path } | null), step id (§ link) | { goin: tab }, AASHTO LRFD 10th Ed. article, div] */
  const GROUPS = [
    ['Geometry: girder and composite section', [
      ['L', 'Design span length (℄ bearing to ℄ bearing)', 'ft', 'L', { goin: 'layout' }, ''],
      ['h', 'Girder depth', 'in', 'g.h', { goin: 'gird@card-shape' }, ''],
      ['A<sub>g</sub>', 'Gross girder area', 'in²', 'g.A', { goin: 'gird@card-shape' }, ''],
      ['I<sub>g</sub>', 'Gross girder moment of inertia', 'in⁴', 'g.I', { goin: 'gird@card-shape' }, ''],
      ['y<sub>b</sub>', 'Girder centroid above the soffit', 'in', 'g.yb', { goin: 'gird@card-shape' }, ''],
      ['y<sub>t</sub>', 'Girder centroid to the top', 'in', 'g.yt', 'sec.g.yt', ''],
      ['S<sub>b</sub>', 'Girder section modulus, bottom', 'in³', 'g.Sb', 'sec.g.Sb', ''],
      ['S<sub>t</sub>', 'Girder section modulus, top', 'in³', 'g.St', 'sec.g.St', ''],
      ['b<sub>w</sub>', 'Web width (shear)', 'in', 'g.bw', { goin: 'gird@card-shape' }, ''],
      ['w<sub>g</sub>', 'Girder self-weight', 'klf', 'g.wsw', 'sec.g.wsw', '3.5.1'],
      ['b<sub>eff</sub>', 'Effective flange width of the deck', 'in', 'cp.beff', 'sec.beff', '4.6.2.6.1'],
      ['A<sub>c</sub>', 'Composite area (transformed)', 'in²', 'cp.Ac', 'sec.Ac', '4.6.2.6'],
      ['I<sub>c</sub>', 'Composite moment of inertia', 'in⁴', 'cp.Ic', 'sec.Ic', '4.6.2.6'],
      ['y<sub>bc</sub>', 'Composite centroid above the soffit', 'in', 'cp.ybc', 'sec.ybc', ''],
      ['h<sub>c</sub>', 'Composite depth', 'in', 'cp.hc', 'sec.hc', ''],
      ['S<sub>bc</sub>', 'Composite modulus, girder bottom', 'in³', 'cp.Sbc', 'sec.Sbc', ''],
      ['S<sub>tg</sub>', 'Composite modulus, girder top', 'in³', 'cp.Stg', 'sec.Stg', ''],
      ['S<sub>td</sub>', 'Composite modulus, deck top (÷ n)', 'in³', 'cp.Std', 'sec.Std', ''],
      ['n', 'Modular ratio E<sub>c,d</sub> / E<sub>c</sub>', '—', 'cp.n', 'sec.n', '4.6.2.6']]],
    ['Materials and moduli', [
      ['f′<sub>c</sub>', 'Girder concrete strength, 28 days', 'ksi', { inp: 'mat.fc' }, { goin: 'mat' }, '5.4.2.1'],
      ['f′<sub>ci</sub>', 'Girder concrete strength at release', 'ksi', { inp: 'mat.fci' }, { goin: 'mat' }, '5.4.2.1'],
      ['f′<sub>c,d</sub>', 'Deck concrete strength', 'ksi', { inp: 'mat.fcd' }, { goin: 'mat' }, '5.4.2.1'],
      ['E<sub>ci</sub>', 'Girder modulus at release', 'ksi', 'lo.Eci', 'ls.Eci', '5.4.2.4'],
      ['E<sub>c</sub>', 'Girder modulus, final', 'ksi', 'cp.Ecg', 'sec.Ecg', '5.4.2.4'],
      ['E<sub>c,d</sub>', 'Deck modulus', 'ksi', 'cp.Ecd', 'sec.Ecd', '5.4.2.4'],
      ['E<sub>p</sub>', 'Strand modulus', 'ksi', { inp: 'str.Ep' }, { goin: 'mat' }, '5.4.4.2'],
      ['f<sub>pu</sub>', 'Strand tensile strength', 'ksi', { inp: 'str.fpu' }, { goin: 'mat' }, 'Table 5.4.4.1-1']]],
    ['Loads and distribution', [
      ['η', 'Load modifier (Strength I)', '—', 'own.eta', 'ld.eta', '1.3.2.1'],
      ['w<sub>DC1</sub>', 'DC1 on the bare girder (deck, haunch, additional)', 'klf', 'wDk', 'ld.wDC1', '3.5.1'],
      ['w<sub>DC2</sub>', 'DC2 on the composite girder (barriers, …)', 'klf', 'wBar', 'ld.wDC2', '3.5.1'],
      ['w<sub>DW</sub>', 'DW on the composite girder (wearing surface)', 'klf', 'wDW', 'ld.wDW', '3.5.1'],
      ['DF<sub>M</sub>', 'Live-load distribution factor, moment', '—', 'dfm', 'ld.dfm', '4.6.2.2.2'],
      ['DF<sub>V</sub>', 'Live-load distribution factor, shear', '—', 'dfv', 'ld.dfv', '4.6.2.2.3'],
      ['M<sub>LL+IM</sub>', 'Live-load moment at midspan (× IM × DF)', 'kip-ft', 'MLL', 'ld.MLL', '3.6.1.3'],
      ['V<sub>LL+IM</sub>', 'Live-load shear at the support (× IM × DF)', 'kip', 'VLL', 'ld.VLL', '3.6.1.3'],
      ['M<sub>u</sub>', 'Factored moment at midspan, Strength I', 'kip-ft', 'MuMid', 'fx.Mu', 'Table 3.4.1-1', 12]]],
    ['Prestressing strands', [
      ['N', 'Number of strands', '—', 'ss.Ntot', 'sec.N', ''],
      ['n<sub>h</sub>', 'Number of draped strands', '—', 'ss.nh', { goin: 'gird@base.harp.n' }, ''],
      ['A<sub>ps</sub>', 'Area of prestressing steel', 'in²', 'ss.Aps', 'sec.Aps', ''],
      ['y<sub>ps</sub>', 'Strand centroid above the soffit, midspan', 'in', 'ss.cgsMid', 'sec.cgsMid', ''],
      ['e<sub>m</sub>', 'Strand eccentricity at midspan', 'in', 'ss.eMid', 'sec.eMid', ''],
      ['e<sub>end</sub>', 'Strand eccentricity at the end', 'in', 'ss.eEnd', { goin: 'gird@card-rows' }, ''],
      ['ℓ<sub>t</sub>', 'Transfer length', 'in', 'ss.lt', 'sec.lt', '5.9.4.3.1'],
      ['ℓ<sub>d</sub>', 'Development length, bonded strand', 'in', 'ldBonded', 'sh.ldB', '5.9.4.3.2'],
      ['ℓ<sub>d,db</sub>', 'Development length, debonded strand', 'in', 'ldDebond', 'sh.ldD', '5.9.4.3.3'],
      ['f<sub>pbt</sub>', 'Strand stress immediately before transfer', 'ksi', 'fpbt', 'ls.fpbt', 'Table 5.9.2.2-1']]],
    ['Prestress losses and gains', [
      ['Δf<sub>pES</sub>', 'Elastic shortening loss', 'ksi', 'lo.dfES', 'ls.dfES', '5.9.3.2.3a'],
      ['f<sub>cgp</sub>', 'Concrete stress at the strand centroid at transfer', 'ksi', 'lo.fcgp', 'ls.fcgp', '5.9.3.2.3a'],
      ['Δf<sub>pSR</sub>', 'Shrinkage loss, transfer to deck', 'ksi', 'lo.ref.dfSR', 'ls.ref.dfSR', '5.9.3.4.2a'],
      ['Δf<sub>pCR</sub>', 'Creep loss, transfer to deck', 'ksi', 'lo.ref.dfCR', 'ls.ref.dfCR', '5.9.3.4.2b'],
      ['Δf<sub>pR1</sub>', 'Relaxation loss, transfer to deck', 'ksi', 'lo.ref.dfR1', 'ls.ref.dfR1', '5.9.3.4.2c'],
      ['Δf<sub>pSD</sub>', 'Shrinkage loss, deck to final', 'ksi', 'lo.ref.dfSD', 'ls.ref.dfSD', '5.9.3.4.3a'],
      ['K<sub>id</sub>', 'Transformed-section factor, transfer to deck', '—', 'lo.ref.Kid', 'ls.ref.Kid', '5.9.3.4.2a'],
      ['K<sub>df</sub>', 'Transformed-section factor, deck to final', '—', 'lo.ref.Kdf', 'ls.ref.Kdf', '5.9.3.4.3a'],
      ['ψ<sub>b</sub>(t<sub>f</sub>, t<sub>i</sub>)', 'Girder creep coefficient, final', '—', 'lo.ref.psiBIF', 'ls.ref.psiBIF', '5.4.2.3.2'],
      ['Δf<sub>pLT</sub>', 'Long-term loss', 'ksi', 'LT', 'ls.LT', '5.9.3.4'],
      ['Δf<sub>pT</sub>', 'Total loss (ES + LT)', 'ksi', 'totalLoss', 'ls.total', '5.9.3.1'],
      ['f<sub>pe</sub>', 'Effective prestress after all losses', 'ksi', 'fpe', 'ls.fpe', '5.9.3'],
      ['Δf<sub>p,gain</sub>', 'Elastic gains under the permanent loads', 'ksi', 'gains.permanent', 'ls.gain.perm', ''],
      ['f<sub>pe,gain</sub>', 'Effective prestress with the elastic gains', 'ksi', 'fpeGain', 'ls.gain.fpe', '']]],
    ['Stress limits', [
      ['f<sub>ci,lim</sub>', 'Compression limit at release', 'ksi', 'lim.relC', 'st.lim.relC', '5.9.2.3.1a'],
      ['f<sub>ti,lim</sub>', 'Tension limit at release', 'ksi', 'lim.relT', 'st.lim.relT', 'Table 5.9.2.3.1b-1'],
      ['f<sub>c,lim</sub> (perm.)', 'Service compression limit, permanent loads', 'ksi', 'lim.srvC1', 'st.lim.srvC1', 'Table 5.9.2.3.2a-1'],
      ['f<sub>c,lim</sub> (total)', 'Service compression limit, permanent + transient', 'ksi', 'lim.srvC2', 'st.lim.srvC2', 'Table 5.9.2.3.2a-1'],
      ['f<sub>t,lim</sub>', 'Service III tension limit', 'ksi', 'lim.srvT', 'st.lim.srvT', 'Table 5.9.2.3.2b-1']]],
    ['Flexure (midspan)', [
      ['β<sub>1</sub>', 'Stress block factor', '—', 'fMid.b1', 'fx.b1', '5.6.2.2'],
      ['d<sub>p</sub>', 'Depth to the strand centroid', 'in', 'fMid.dp', 'fx.dp', '5.6.3.1.1'],
      ['c', 'Neutral axis depth', 'in', 'fMid.c', 'fx.c', '5.6.3.1.1'],
      ['a', 'Stress block depth', 'in', 'fMid.a', 'fx.a', '5.6.3.2.2'],
      ['f<sub>ps</sub>', 'Strand stress at nominal flexural resistance', 'ksi', 'fMid.fps', 'fx.fps', '5.6.3.1.1'],
      ['ε<sub>t</sub>', 'Net tensile strain', '—', 'fMid.et', 'fx.et', '5.5.4.2'],
      ['φ', 'Resistance factor, flexure', '—', 'fMid.phi', 'fx.phi', '5.5.4.2'],
      ['φM<sub>n</sub>', 'Factored flexural resistance', 'kip-ft', 'fMid.phiMn', 'fx.phiMn', '5.6.3.2', 12],
      ['f<sub>r</sub>', 'Modulus of rupture', 'ksi', 'fr', 'fx.fr', '5.4.2.6'],
      ['M<sub>cr</sub>', 'Cracking moment', 'kip-ft', 'Mcr', 'fx.Mcr', '5.6.3.3', 12]]],
    ['Shear (critical section)', [
      ['d<sub>v</sub>', 'Effective shear depth', 'in', 'shear.1.dv', 'sh.dv', '5.7.2.8'],
      ['V<sub>u</sub>', 'Factored shear', 'kip', 'shear.1.Vu', 'sh.Vu', 'Table 3.4.1-1'],
      ['ε<sub>s</sub>', 'Longitudinal strain', '—', 'shear.1.es', 'sh.es', '5.7.3.4.2'],
      ['β', 'Concrete tensile stress factor', '—', 'shear.1.beta', 'sh.beta', '5.7.3.4.2'],
      ['θ', 'Angle of the diagonal compressive stresses', '°', 'shear.1.theta', 'sh.theta', '5.7.3.4.2'],
      ['V<sub>c</sub>', 'Concrete shear resistance', 'kip', 'shear.1.Vc', 'sh.Vc', '5.7.3.3'],
      ['V<sub>s</sub>', 'Stirrup shear resistance', 'kip', 'shear.1.Vs', 'sh.Vs', '5.7.3.3'],
      ['V<sub>p</sub>', 'Vertical component of the prestress', 'kip', 'shear.1.Vp', 'sh.Vp', '5.7.3.3']]],
    ['End zone', [
      ['P<sub>r</sub>', 'Splitting demand (4 % of the prestress at transfer)', 'kip', 'splitDem', 'ez.Pr', '5.9.4.4.1'],
      ['A<sub>s,split</sub>', 'Splitting steel required within h/4', 'in²', 'AsSplit', 'ez.AsReq', '5.9.4.4.1'],
      ['h/4', 'Splitting zone length', 'in', 'splitZone', 'ez.h4', '5.9.4.4.1']]],
    ['Camber and deflection', [
      ['Δ<sub>ps</sub>', 'Camber from the prestress (release)', 'in', 'cam.dPS', 'cb.dPS', ''],
      ['Δ<sub>g</sub>', 'Deflection under the girder self-weight', 'in', 'cam.dSW', 'cb.dSW', ''],
      ['Δ<sub>deck</sub>', 'Deflection under the deck and haunch', 'in', 'cam.dDK', 'cb.dDK', ''],
      ['Δ<sub>SD</sub>', 'Deflection under DC2 + DW (composite)', 'in', 'cam.dSD', 'cb.dSD', ''],
      ['Δ<sub>erect</sub>', 'Camber at erection', 'in', 'cam.erect', 'cb.erect', ''],
      ['Δ<sub>after deck</sub>', 'Camber after the deck is placed', 'in', 'cam.afterDeck', 'cb.deck', ''],
      ['Δ<sub>seat</sub>', 'Camber for the bearing seats (all dead load)', 'in', 'cam.seat', 'cb.seat', ''],
      ['Δ<sub>final</sub>', 'Final long-term camber', 'in', 'cam.final', 'cb.final', ''],
      ['Δ<sub>LL</sub>', 'Live-load deflection', 'in', 'cam.dLL', 'cb.dLL', '2.5.2.6.2']]],
    ['Load rating (HL-93)', [
      ['RF<sub>inv</sub>', 'Inventory rating factor, flexure', '—', 'rating.RFinv', 'rt.RFinv', 'MBE 6A.4.2.1'],
      ['RF<sub>opr</sub>', 'Operating rating factor, flexure', '—', 'rating.RFopr', 'rt.RFopr', 'MBE 6A.4.2.1'],
      ['RF<sub>V,inv</sub>', 'Inventory rating factor, shear', '—', 'shrRating.RFinv', 'rt.RFvInv', 'MBE 6A.4.2.1'],
      ['RF<sub>Srv III</sub>', 'Rating factor, Service III', '—', 'svcRating.RF', 'rt.RFs3', 'MBE 6A.4.2.1']]]];
  const at = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const dOf = v => (typeof v !== 'number' || !isFinite(v) ? 0 : Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 3);   // the old tab's rule
  const plainTx = h => String(h).replace(/<[^>]+>/g, '');
  const rowText = e => `${plainTx(e[0])} ${plainTx(e[1])} ${e[5]}`.toLowerCase();
  /* the R path of a row: the path of its worked step when the tab's steps give one (the step's value = R there), else the row's own */
  const pathOf = (ctx, e) => { for (const w of Object.values(ctx.W || {})) if (w && w.paths && typeof e[4] === 'string' && w.paths[e[4]]) return w.paths[e[4]]; return e[3]; };
  const stepOf = (ctx, id) => { if (typeof id !== 'string') return null; for (const w of Object.values(ctx.W || {})) { const s = w && w.steps && w.steps.find(q => q.id === id); if (s) return s; } return null; };
  function cell(ctx, e) {
    const k = K(), { R, inp } = ctx, src = e[3] && e[3].inp ? e[3] : pathOf(ctx, e), div = e[6] || 0;
    if (src && src.inp) { const v = +at(inp, src.inp); return `${k.fx(v, dOf(v))}`; }
    const v0 = at(R, src), v = typeof v0 === 'number' && div ? v0 / div : v0;
    if (typeof v0 === 'number' && isFinite(v0)) return k.ev(R, src, dOf(v), '', div || undefined);
    const st = stepOf(ctx, e[4]);   // a value R does not hold (e.g. η = 1 without an owner rule): its worked step's value
    return st && typeof st.value === 'number' && isFinite(st.value) ? k.fx(st.value, dOf(st.value)) : '—';
  }
  function link(ctx, e) {
    const k = K(), w = e[4]; if (!w) return '';
    if (w.goin) return `<a href="#" data-goin="${w.goin}" title="Entered on that input tab">input</a>`;
    const tab = TAB[String(w).split('.')[0]]; if (!tab) return '';
    return stepOf(ctx, w) ? k.wk(w, '§', tab) : '';
  }
  function output(ctx) {
    const k = K();
    let n = 0;
    const body = GROUPS.map(([g, rows]) => `<tbody class="nm-g"><tr class="nm-h"><th colspan="6" class="lft">${k.esc(g)}</th></tr>${rows.map(e => { n++;
      return `<tr data-nm="${k.esc(rowText(e))}"><td class="lft nm-s">${e[0]}</td><td class="lft">${e[1]}</td><td class="lft">${e[2]}</td><td>${cell(ctx, e)}</td><td class="lft">${e[5] ? k.esc(e[5]) : '—'}</td><td>${link(ctx, e)}</td></tr>`; }).join('')}</tbody>`).join('');
    return k.card('Nomenclature: the symbols of the design with their values', `<div class="fRow"><label for="o_nmQ">Search</label><input type="search" id="o_nmQ" placeholder="symbol, description or article" value="${k.esc(S.q)}" autocomplete="off"><span class="note" id="nmCount"></span></div>
      <div class="tscroll"><table class="tbl" id="nmTbl"><thead><tr><th class="lft">Symbol</th><th class="lft">Description</th><th class="lft">Unit</th><th>Value</th><th class="lft">Article</th><th>Worked</th></tr></thead>${body}</table></div>
      <p class="note">${n} symbols. Every value is the engine's for the girder type and line chosen above (or the entered input) and follows the inputs. Articles: AASHTO LRFD 10th Ed. (2024) unless marked MBE (the Manual for Bridge Evaluation, as the Rating tab). "§" opens the worked step on its result tab; "input" the input tab where the value is entered. Moments kip-ft, shears kip. Flexure at the engine's midspan station; shear at the station the Shear tab works (the critical section).</p>`, 'card-nom');
  }
  function filter(el) {
    const q = S.q.trim().toLowerCase(), rows = el.querySelectorAll('#nmTbl tr[data-nm]'); let shown = 0;
    rows.forEach(r => { const on = !q || r.getAttribute('data-nm').includes(q); r.hidden = !on; if (on) shown++; });
    el.querySelectorAll('#nmTbl tbody.nm-g').forEach(b => { b.hidden = ![...b.querySelectorAll('tr[data-nm]')].some(r => !r.hidden); });
    const c = el.querySelector('#nmCount'); if (c) c.textContent = q ? `${shown} of ${rows.length} shown` : '';
  }
  function after(el) {
    const i = el.querySelector('#o_nmQ'); if (!i) return;
    i.addEventListener('input', () => { S.q = i.value; filter(el); }); filter(el);
  }
  window.PSBUiNomen = { output, after, GROUPS, state: S };
})();
