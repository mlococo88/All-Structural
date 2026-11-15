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
    let h = K().gcard('Analysis graphic: girder elevation', 'gfxr_anel') + K().gcard('Analysis graphic: envelopes along the girder', 'gfx_an');   // gfxr_anel (2026-11-15, batch C): screen only
    h += usedCard(ctx);   // 2026-11-15 (batch C): the loads and factors the analysis uses (the steel app's card), each linked to its work
    // the station table: every sixth station of the engine's and the selected one
    const idx = D.map((r, i) => i).filter(i => (ui && ui.every) || i % 6 === 0 || i === sel);   // ui.every: the Report's "every station" detail (2026-11-15)
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
      body += '<p class="note">The pier section\'s resistance (negative moment, deck bars) and the positive moment connection are worked on the <a href="#" data-gotab="flex">Flexure tab</a>.</p>';
      h += k.card('Continuity for composite loads (5.12.3.3)', body);
    } else h += k.card('Continuity', `<p class="note">${R.L && ctx.P.spans.lengths.length > 1 ? 'Simple spans for all loads' : 'One span'} (Bridge layout tab). Made continuous: girder and DC1 on the simple span; DC2, DW and live load on the continuous unit; restraint moments switchable (5.12.3.3, PS-7).</p>`);
    h += reactions(ctx);   // 2026-11-15 (batch C): the unfactored reactions (the steel app's table, ui/analysis.js "Reactions (unfactored, kip)")
    h += k.card('Worked steps: analysis', `<p class="note">AASHTO LRFD 10th Ed. (2024). Every result is the engine's value; midspan = the engine's station at x = ${k.fx(D[midOf(R)].x, 2)} ft (${D.length} stations).</p>${k.steps(ctx.W.analysis.steps, TOPICS, OPEN)}`);
    return h;
  }
  /* usedCard(ctx): the loads and factors of the analysis, each the engine's value linked to the step that works it (Loads & LLDF, Section) */
  function usedCard(ctx) {
    const { R } = ctx, k = K(), ev = (p, d, u) => k.ev(R, p, d, u), L = (id, tab) => k.wk(id, '§', tab), own = R.own;
    return k.card('Loads and factors used', k.kv([['DC1 girder self-weight w<sub>g</sub>', `${ev('wG', 4, 'klf')} ${L('sec.g.wsw', 'sec')}`], ['DC1 on the bare girder w<sub>DC1</sub> (deck, haunch, additional)', `${ev('wDk', 4, 'klf')} ${L('ld.wDC1', 'lds')}`],
      ...(R.nDiaph ? [[`DC1 diaphragms (${R.nDiaph} point loads, simple span)`, `${ev('Pdia', 2, 'kip')} ${L('ld.Pdia', 'lds')}`]] : []),
      ['DC2 (composite)', `${ev('wBar', 4, 'klf')} ${L('ld.wDC2', 'lds')}`], ['DW (composite)', `${ev('wDW', 4, 'klf')} ${L('ld.wDW', 'lds')}`],
      ['DF<sub>M</sub> / DF<sub>V</sub>', `${ev('dfm', 4)} ${L('ld.dfm', 'lds')} / ${ev('dfv', 4)} ${L('ld.dfv', 'lds')}`], ['η (Strength I) / m (HL-93)', `${own ? ev('own.eta', 4) : '1.0000'} / ${own ? ev('own.mLL', 2) : '1.00'} ${L('ld.eta', 'lds')}`],
      ['Load combinations', `Strength I ${k.wk('an.MuS')}, Service I ${k.wk('an.MsI')}, Service III ${k.wk('an.MsIII')} (Table 3.4.1-1)`]])
      + `<p class="note">Girder and DC1 on the simple span${R.fe ? '; DC2, DW and the live load on the continuous unit (Continuity card below)' : ''}; live load HL-93 with IM = 33 % and the distribution factors (<a href="#" data-gotab="lds">Loads &amp; LLDF tab</a>, where each load is worked).</p>`);
  }
  /* reactions(ctx): the unfactored end reactions of this girder line: the engine's own bxSuperRxPayload (engine/handoffs.js srPayload, the
     numbers "Send reactions to Substructure Loading" sends), worked here as that function finds them (no other arithmetic) */
  function reactions(ctx) {
    const { R, inp } = ctx, k = K(), H = window.PSBHandoffs; if (!H || !H.srPayload) return '';
    let b = null; try { b = H.srPayload(inp, R); } catch (e) { b = { error: e.message }; }
    if (!b || b.error || !b.payload) return k.card('Reactions (unfactored, kip)', `<p class="note">Not available: ${k.esc((b && b.error) || 'no result')}.</p>`);
    const p = b.payload, fx = (v, d) => k.fx(v, d), Lf = +R.L, S = p.supports, ll = p.liveLoad;
    const rows = S.map((q, i) => { const g = q.girders[0]; return `<tr><td class="lft">${k.esc(q.id)} (x = ${fx(q.x, 2)} ft)</td><td>${fx(g.DC1, 2)}</td><td>${fx(g.DC2, 2)}</td><td>${fx(g.DW, 2)}</td>${ll ? `<td>${fx(ll.supports[i].Rmax, 2)}</td>` : ''}</tr>`; }).join('');
    const dia = (inp.loads.diaph || []).filter(d => +d.P > 0 && +d.a >= 0 && +d.a <= Lf);
    const wk1 = R.fe ? `DC2 and DW: the end shears of this span on the continuous unit, as reactions (+ up), w × V<sub>w</sub> per klf: DC2 = ${fx(R.wBar, 4)} × ${fx(R.fe.Vw(0), 4)} = ${fx(S[0].girders[0].DC2, 3)} kip at ${k.esc(S[0].id)} (V<sub>w</sub>: the end shear per klf on every span of the engine's model of the continuous unit, whose midspan moment M<sub>w</sub> is worked ${k.wk('an.Mw')}).`
      : `DC2 = w<sub>DC2</sub> L / 2 = ${fx(R.wBar, 4)} (${fx(Lf, 2)}) / 2 = ${fx(S[0].girders[0].DC2, 3)} kip; DW = w<sub>DW</sub> L / 2 = ${fx(R.wDW, 4)} (${fx(Lf, 2)}) / 2 = ${fx(S[0].girders[0].DW, 3)} kip.`;
    const wkDC1 = `DC1 at ${k.esc(S[0].id)} = (w<sub>g</sub> + w<sub>DC1</sub>) L / 2${dia.length ? ' + Σ P (L − a) / L' : ''} = (${fx(R.wG, 4)} + ${fx(R.wDk, 4)})(${fx(Lf, 2)}) / 2${dia.length ? ` + ${dia.map(d => `${fx(+d.P, 2)}(${fx(Lf, 2)} − ${fx(+d.a, 2)}) / ${fx(Lf, 2)}`).join(' + ')}` : ''} = ${fx(S[0].girders[0].DC1, 3)} kip (w<sub>g</sub> ${k.wk('sec.g.wsw', '§', 'sec')}, w<sub>DC1</sub> ${k.wk('ld.wDC1', '§', 'lds')}${dia.length ? `, P ${k.wk('ld.Pdia', '§', 'lds')}` : ''}).`;
    return k.card('Reactions (unfactored, kip)', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Support</th><th>DC1</th><th>DC2</th><th>DW</th>${ll ? '<th>LL per lane (no IM, no DF)</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Worked: ${wkDC1} ${wk1}${ll ? ` LL: max(truck, tandem) + lane, simple span, one lane, no IM, no DF (information only): max(${fx(R.hl.Vtr, 2)}, ${fx(R.hl.Vtd, 2)}) + ${fx(R.hl.Vln, 2)} = ${fx(ll.supports[0].Rmax, 3)} kip (V<sub>tr</sub> ${k.wk('ld.Vtr', '§', 'lds')}, V<sub>td</sub> ${k.wk('ld.Vtd', '§', 'lds')}, V<sub>ln</sub> ${k.wk('ld.Vln', '§', 'lds')}).` : ''}</p>
      <p class="note">This girder line (${k.esc(p.girderLine.label)}, ${k.esc(p.girderLine.position)}), the values the Project tab's "Send reactions to Substructure Loading" sends (bridgeSuite.v1.superReactions).</p>`);
  }
  /* the girder elevation (2026-11-15, batch C; the steel app's elevation strip above its diagrams): the span with its bearings, the
     diaphragm point loads and, made continuous, the continuous ends; drawn from the entered geometry; display only */
  function elevSvg(ctx, W) {
    const { R, inp } = ctx, L = +R.L, l = 16, r = 16, X = x => l + x / L * (W - l - r), yG = 40, hG = 20, H = 110, f2 = v => K().fx(v, 2);
    const dia = (inp.loads.diaph || []).filter(d => +d.P > 0 && +d.a >= 0 && +d.a <= L), c = R.cont && R.cont.unit, s = c ? c.s : 1, n = c ? c.spans.length : 1;
    let h = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Girder elevation" font-family="Arial,sans-serif">`;
    h += `<rect x="${X(0)}" y="${yG}" width="${X(L) - X(0)}" height="${hG}" fill="#E2E8F0" stroke="#475569" data-dtr="Girder, span L = ${f2(L)} ft (℄ bearing to ℄ bearing)"/>`;
    [[0, s > 1], [L, s < n]].forEach(([x, cont]) => { h += cont ? `<line x1="${X(x)}" x2="${X(x)}" y1="${yG - 6}" y2="${yG + hG + 12}" stroke="#1E3A5F" stroke-width="2" stroke-dasharray="4 2"/><text x="${X(x)}" y="${yG - 10}" text-anchor="${x ? 'end' : 'start'}" font-size="10" fill="#1E3A5F">continuous (composite loads)</text>` : '';
      h += `<path d="M${X(x)} ${yG + hG} l-6 10 h12 z" fill="#64748B" data-dtr="℄ bearing at x = ${f2(x)} ft"/>`; });
    dia.forEach(d => { const x = X(+d.a); h += `<line x1="${x}" x2="${x}" y1="${yG - 16}" y2="${yG - 2}" stroke="#A3322A" stroke-width="1.5"/><path d="M${x} ${yG - 1} l-3 -6 h6 z" fill="#A3322A"/><text x="${x}" y="${yG - 19}" text-anchor="middle" font-size="10" fill="#A3322A" data-dtr="Diaphragm P = ${f2(+d.P)} kip at x = ${f2(+d.a)} ft">P ${f2(+d.P)}</text>`; });
    h += `<text x="${(X(0) + X(L)) / 2}" y="${yG + hG + 26}" text-anchor="middle" font-size="11" fill="#475569">Span ${s}${n > 1 ? ` of ${n}` : ''}: L = ${f2(L)} ft</text></svg>`;
    return { html: h, nar: W < 560 };
  }
  const HIDE = {};
  function after(el, ctx) {
    { const se = el.querySelector('#gfxr_anel'), VK = window.PSBVizKit;   // 2026-11-15 (batch C): the girder elevation
      if (se && VK && VK.detCard) VK.detCard(se, { id: 'anElev', title: 'Girder elevation', sub: 'the span analysed: bearings, diaphragm point loads (DC1), continuity for composite loads', draw: W => elevSvg(ctx, W), hint: 'Point at a bearing or a diaphragm load to read it.', file: 'analysis-elevation',
        cap: '<p class="vk-cap">Entered on the Bridge layout tab (span, continuity) and the Diaphragms / deck tab (point loads). Display only.</p>' }); }
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
