/* apps/ps-bridge/ui/analysis.js — the Analysis output tab (window.PSBUiAnalysis): moment and shear envelopes along the design girder, the
   continuity for composite loads and the restraint moments (5.12.3.3, PS-7). Classic script; display only. Created 2026-11-12 (PR 2b-2,
   docs/ps-bridge-plan.md §2.3). Every number is the engine's (computeAll R.diagrams at its stations, R.cont, R.fe), worked in
   engine/worked.js analysis(); the graphic is the steel app's along-girder chart (PSBVizAlong, a copy).
     output(ctx) -> HTML; after(el, ctx); onOutChange(e, ui) (the station choice, ui.anSel; true = redraw). ctx = { P, inp, R, W, ui } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong;
  const OPEN = new Set(['mid']);
  const A = 'AASHTO LRFD 10th Ed. ';
  const TOPICS = [
    { key: 'mid', title: 'Moments at midspan', ref: A + 'Table 3.4.1-1', ids: /^an\.(Mg|Mdc1|Mw|Mdc2|Mdw|Mll|Mdc|MuS|MsI|MsIII)$/, res: /^an\.MuS$/ },
    { key: 'sup', title: 'Shears at the support', ref: A + 'Table 3.4.1-1', ids: /^an\.(Vg|Vdc|VuS)$/, res: /^an\.VuS$/ },
    { key: 'pier', title: 'Interior support (made continuous)', ref: A + '5.12.3.3', ids: /^an\.pier\./, res: /^an\.pier\.Mu$/ },
    { key: 'restr', title: 'Restraint moments (creep and shrinkage)', ref: A + '5.12.3.3.2', ids: /^an\.restr\./ }];
  const COLS = [['M_g', 'M<sub>g</sub>'], ['M_DC1', 'M<sub>DC1</sub>'], ['M_DC2', 'M<sub>DC2</sub>'], ['M_DW', 'M<sub>DW</sub>'], ['M_LLpos', 'M<sub>LL+</sub>'], ['M_LLneg', 'M<sub>LL−</sub>'], ['M_StrI_pos', 'M<sub>u</sub> +'], ['M_StrI_neg', 'M<sub>u</sub> −'],
    ['V_DC', 'V<sub>DC</sub>'], ['V_DW', 'V<sub>DW</sub>'], ['V_LLpos', 'V<sub>LL+</sub>'], ['V_LLneg', 'V<sub>LL−</sub>'], ['V_StrI_pos', 'V<sub>u</sub> +'], ['V_StrI_neg', 'V<sub>u</sub> −']];
  const midOf = R => R.diagrams.reduce((b, r, i) => Math.abs(r.x - R.L / 2) < Math.abs(R.diagrams[b].x - R.L / 2) ? i : b, 0);
  const selOf = (ui, R) => Math.max(0, Math.min(R.diagrams.length - 1, ui.anSel == null ? midOf(R) : ui.anSel));
  function output(ctx) {
    const { R, inp, ui } = ctx, k = K(), ev = (p, d, u, div) => k.ev(R, p, d, u, div), wk = k.wk, D = R.diagrams, sel = selOf(ui, R), c = R.cont;
    const simple = !R.fe && !R.useExt;
    let h = '<div id="gfx_an"></div>';
    // the station table: every sixth station of the engine's and the selected one
    const idx = D.map((r, i) => i).filter(i => i % 6 === 0 || i === sel);
    h += k.card('Force effects along the girder (per girder; moments kip-ft, shears kip)', `<div class="fRow"><label for="o_anSel">Station</label><select id="o_anSel">${D.map((r, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>x = ${k.fx(r.x, 2)} ft (${k.fx(r.x / R.L, 3)} L)</option>`).join('')}</select></div>
      <div class="tscroll"><table class="tbl"><thead><tr><th>x<br>ft</th>${COLS.map(q => `<th>${q[1]}</th>`).join('')}</tr></thead><tbody>
      ${idx.map(i => `<tr${i === sel ? ' class="sel"' : ''}><td>${ev(`diagrams.${i}.x`, 2)}</td>${COLS.map(q => `<td>${ev(`diagrams.${i}.${q[0]}`, q[0][0] === 'M' ? 0 : 1)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note">Sagging moment positive; shear signed. M<sub>u</sub> = η(1.25 M<sub>DC</sub> + 1.50 M<sub>DW</sub> + 1.75 m M<sub>LL+IM</sub>), DC = girder + DC1 + DC2 (Table 3.4.1-1)${R.cont && R.cont.restr ? '; the restraint moments are added in the stress and flexure checks where they increase the effect (5.12.3.3.2), not in these envelopes' : ''}. Girder and DC1 on the simple span${simple ? '; DC2, DW and live load on the simple span' : R.fe ? '; DC2, DW and live load on the continuous unit (5.12.3.3)' : '; DC2, DW and live load from the imported demands'}. Live load ${simple ? (inp.loads.llAuto ? 'HL-93 envelope × DF<sub>M</sub> / DF<sub>V</sub> (<a href="#" data-gotab="lds">Loads &amp; LLDF</a>)' : 'entered (parabola / linear along the span)') : 'HL-93 on the continuous unit'}. Worked at midspan and at the support below ${wk('an.MuS')}.</p>`);
    h += k.card(`At the selected station x = ${k.fx(D[sel].x, 2)} ft`, k.kv([['M<sub>DC</sub> (girder + DC1 + DC2)', ev(`diagrams.${sel}.M_DC`, 1, 'kip-ft')], ['M<sub>DW</sub>', ev(`diagrams.${sel}.M_DW`, 1, 'kip-ft')], ['M<sub>LL+IM</sub> + / −', `${ev(`diagrams.${sel}.M_LLpos`, 1)} / ${ev(`diagrams.${sel}.M_LLneg`, 1, 'kip-ft')}`],
      ['Strength I M<sub>u</sub> + / −', `${ev(`diagrams.${sel}.M_StrI_pos`, 1)} / ${ev(`diagrams.${sel}.M_StrI_neg`, 1, 'kip-ft')}`], ['Service I M + / −', `${ev(`diagrams.${sel}.M_SrvI_pos`, 1)} / ${ev(`diagrams.${sel}.M_SrvI_neg`, 1, 'kip-ft')}`], ['Service III M + / −', `${ev(`diagrams.${sel}.M_SrvIII_pos`, 1)} / ${ev(`diagrams.${sel}.M_SrvIII_neg`, 1, 'kip-ft')}`],
      ['V<sub>DC</sub>', ev(`diagrams.${sel}.V_DC`, 2, 'kip')], ['V<sub>DW</sub>', ev(`diagrams.${sel}.V_DW`, 2, 'kip')], ['V<sub>LL+IM</sub> + / −', `${ev(`diagrams.${sel}.V_LLpos`, 2)} / ${ev(`diagrams.${sel}.V_LLneg`, 2, 'kip')}`], ['Strength I V<sub>u</sub> + / −', `${ev(`diagrams.${sel}.V_StrI_pos`, 2)} / ${ev(`diagrams.${sel}.V_StrI_neg`, 2, 'kip')}`]]));
    if (c) {
      const u = c.unit, rr = c.restr;
      let body = k.kv([['Continuous unit, spans', `${u.spans.map(v => k.fx(+v, 1)).join(', ')} ft${u.assumed ? ' (assumed: two equal spans)' : ''}`], ['Design span', `span ${u.s}`],
        ...(R.fe ? [['M<sub>w</sub> at midspan per klf on all spans', `${k.fx(R.fe.Mw(R.L / 2), 3)} kip-ft/klf ${wk('an.Mw')}`]] : []),
        ['M<sub>DC2</sub> at the pier', `${ev('cont.MDC2n', 1, 'kip-ft')} ${wk('an.pier.MDC2')}`], ['M<sub>DW</sub> at the pier', `${ev('cont.MDWn', 1, 'kip-ft')}`], ['M<sub>LL+IM</sub> at the pier (negative)', `${ev('cont.MLLn', 1, 'kip-ft')} (${k.esc(c.llSrc)}) ${wk('an.pier.MLL')}`],
        ['Restraint moment added at the pier', `${rr ? ev('cont.MrnPier', 1, 'kip-ft') : '0 (not computed)'}`], ['Strength I M<sub>u</sub> at the pier', `<b>${ev('cont.MuN', 1, 'kip-ft', 12)}</b> ${wk('an.pier.Mu')}`]]);
      if (rr) {
        const ends = [['A', rr.A, u.s > 1, 'Left support'], ['B', rr.B, u.s < u.spans.length, 'Right support']].filter(q => q[2]);
        const tr = (lab, key) => `<tr><td class="lft">${lab}</td>${ends.map(([e]) => `<td>${ev(`cont.restr.${e}.${key}`, 1)}</td>`).join('')}</tr>`;
        body += `<p class="note">Restraint moments (k-ft, + sagging; δ<sub>1</sub> = ${ev('cont.restr.d1', 3)}, δ<sub>2</sub> = ${ev('cont.restr.d2', 3)} ${wk('an.restr.d1')}; age at continuity t<sub>d</sub> = ${k.fx(rr.td, 0)} days):</p>
          <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Support moment</th>${ends.map(q => `<th>${q[3]} of span ${u.s}</th>`).join('')}</tr></thead><tbody>
          ${tr('M<sub>g</sub>: girder weight as if continuous', 'Mg')}${tr('M<sub>ps</sub>: prestress at transfer as if continuous', 'Mps')}${tr('M<sub>deck</sub>: deck weight as if continuous', 'Mdk')}
          ${tr('M<sub>rc</sub> = δ<sub>1</sub>(M<sub>g</sub> + M<sub>ps</sub>) + δ<sub>2</sub> M<sub>deck</sub>', 'Mrc')}${tr('M<sub>sh</sub>: differential shrinkage', 'Msh')}${tr('<b>M<sub>res</sub> = M<sub>rc</sub> + M<sub>sh</sub></b>', 'Mres')}</tbody></table></div>`;
      } else body += `<p class="note">Restraint moments not computed (Bridge layout tab, continuity card${inp.owner === 'MassDOT' || inp.owner === 'RIDOT' ? `; ${k.esc(inp.owner)} default off` : ''}).</p>`;
      body += '<p class="note">The pier section\'s resistance (negative moment, deck bars) and the positive moment connection are worked on the Flexure tab (PR 2c).</p>';
      h += k.card('Continuity for composite loads (5.12.3.3)', body);
    } else h += k.card('Continuity', `<p class="note">${R.L && ctx.P.spans.lengths.length > 1 ? 'Simple spans for all loads' : 'One span'} (Bridge layout tab). Made continuous: girder and DC1 on the simple span; DC2, DW and live load on the continuous unit; restraint moments switchable (5.12.3.3, PS-7).</p>`);
    h += k.card('Worked steps: analysis', `<p class="note">AASHTO LRFD 10th Ed. (2024). Every result is the engine's value; midspan = the engine's station at x = ${k.fx(D[midOf(R)].x, 2)} ft (${D.length} stations).</p>${k.steps(ctx.W.analysis.steps, TOPICS, OPEN)}`);
    return h;
  }
  const HIDE = {};
  function after(el, ctx) {
    K().after(el, OPEN);
    const slot = el.querySelector('#gfx_an'); if (!slot || !VA() || !VA().mount) return;
    const { R, ui } = ctx, D = R.diagrams, xs = D.map(r => r.x), near = x => xs.reduce((b, v, i) => Math.abs(v - x) < Math.abs(xs[b] - x) ? i : b, 0), k = K();
    const MS = [{ key: 'dc', html: 'M<sub>DC</sub>', ci: 0, f: 'M_DC' }, { key: 'dw', html: 'M<sub>DW</sub>', ci: 3, f: 'M_DW' }, { key: 'llp', html: 'M<sub>LL+IM</sub> +', ci: 1, f: 'M_LLpos' }, { key: 'lln', html: 'M<sub>LL+IM</sub> −', ci: 1, dash: '5 3', f: 'M_LLneg' },
      { key: 'up', html: 'M<sub>u</sub> +', ci: 2, f: 'M_StrI_pos' }, { key: 'un', html: 'M<sub>u</sub> −', ci: 2, dash: '5 3', f: 'M_StrI_neg' }];
    const VS = [{ key: 'dc', html: 'V<sub>DC</sub>', ci: 0, f: 'V_DC' }, { key: 'llp', html: 'V<sub>LL+IM</sub> +', ci: 1, f: 'V_LLpos' }, { key: 'lln', html: 'V<sub>LL+IM</sub> −', ci: 1, dash: '5 3', f: 'V_LLneg' },
      { key: 'up', html: 'V<sub>u</sub> +', ci: 2, f: 'V_StrI_pos' }, { key: 'un', html: 'V<sub>u</sub> −', ci: 2, dash: '5 3', f: 'V_StrI_neg' }];
    const ser = L => L.map(q => ({ key: q.key, ci: q.ci, dash: q.dash, pts: D.map(r => [r.x, r[q.f]]) }));
    const grp = (g, label, L) => ({ label, items: L.map(q => ({ key: g + ':' + q.key, html: `${VA().swatch(q.ci, q.dash)} ${q.html}`, on: !(HIDE[g] || {})[q.key] })) });
    const at = x => { const r = D[near(x)]; return [`x = ${k.fx(r.x, 2)} ft`, `M_DC ${k.fx(r.M_DC, 0)}, M_DW ${k.fx(r.M_DW, 0)}, M_LL+IM ${k.fx(r.M_LLneg, 0)} / ${k.fx(r.M_LLpos, 0)}, M_u ${k.fx(r.M_StrI_neg, 0)} / ${k.fx(r.M_StrI_pos, 0)} kip-ft; V_u ${k.fx(r.V_StrI_neg, 1)} / ${k.fx(r.V_StrI_pos, 1)} kip`]; };
    let H = null;
    H = VA().mount(slot, { key: 'an', title: 'Moment and shear envelopes along the design girder', sub: `span L = ${k.fx(R.L, 2)} ft, ${D.length} stations${R.fe ? ', continuous unit for DC2, DW and LL' : ''}`,
      draw: W => VA().render({ L0: 0, L1: R.L, sup: [0, R.L], sel: xs[selOf(ui, R)], selLabel: `x = ${k.fx(xs[selOf(ui, R)], 2)} ft`, axisTitle: 'Station x, ft (from ℄ bearing, left)', aria: 'Moment and shear envelopes along the girder', rows: [
        { kind: 'chart', key: 'M', label: 'Moments, kip-ft (per girder; sagging up)', unit: 'kip-ft', series: ser(MS), hidden: HIDE.M },
        { kind: 'chart', key: 'V', label: 'Shears, kip (per girder)', unit: 'kip', series: ser(VS), hidden: HIDE.V, h: W < 600 ? 110 : 140 }] }, W),
      at, pickX: x => near(x), snap: x => xs[near(x)], onSelect: i => { ui.anSel = i; if (ctx.redraw) ctx.redraw(); },
      chips: () => [grp('M', 'Moments', MS), grp('V', 'Shears', VS)], onChip: key => { const [g, s] = key.split(':'), o = HIDE[g] = HIDE[g] || {}; o[s] = !o[s]; },
      hint: 'Point at (or tap) the chart to read the station; click or tap to select it.',
      caption: '<p class="vk-cap">The engine\'s force effects at its stations (the table above); click a station to select it. Display only.</p>' });
    return H;
  }
  function onOutChange(e, ui) { if (e.target.id === 'o_anSel') { ui.anSel = +e.target.value; return true; } return false; }
  window.PSBUiAnalysis = { output, after, onOutChange, TOPICS };
})();
