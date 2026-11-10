/* apps/steel-bridge/ui/analysis.js — the Analysis card of Steel Bridge Design (window.SBDAnalysisUI).
   Classic script. Needs window.SBDAnalysis (engine/analysis.js), SharedSteps, SharedUnits.
   inputs(P, gi) / onInputChange(el, P, gi) (AIN, 2026-11-09): the analysis inputs on the Loads input tab (project.analysis, girder.loadsManual,
   girder.dfManual and the "Override calculated value" boxes girder.loadsOverride / girder.dfOverride), moved there from this tab.
   draw(el, ctx): renders the girder line and the loads and factors used (read-only, linked to where each is worked), the Calculate button, the diagrams (plain SVG), the station table, the reactions, a one-line
   deflection summary (DEFL, 2026-11-09: the LL deflection check SA3, the dead-load deflection diagram, the station table's deflection view
   and the deflection and camber worked steps moved to the Deflection tab, ui/deflection.js), the deck placement sequence and the worked steps. ctx = { P, gi, changed() }. Results are kept until the
   project changes; then they are marked out of date (plan §5: no recalculation on every keystroke). */
(function () {
  'use strict';
  const AN = () => window.SBDAnalysis, ST = () => window.SharedSteps, U = () => window.SharedUnits;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d) => U().fmt(x, d);
  let res = null, resKey = '', busy = false, view = 'M';
  const card = (title, body, id) => `<section class="sec"${id ? ` id="${id}"` : ''}><div class="secHead">${title}</div><div class="secBody">${body}</div></section>`;
  const wk = (id, t) => `<a class="wk" href="#st-${esc(id)}">${t || '§'}</a>`;
  const keyOf = (P, gi) => JSON.stringify([P, gi]);

  /* ---------- inputs: the Loads input tab (AIN, 2026-11-09: moved from this tab; the stored paths are unchanged: project.analysis,
     girder.loadsManual, girder.dfManual; new: girder.loadsOverride, girder.dfOverride, the "Override calculated value" boxes) ---------- */
  const IM_SRC = 'AASHTO LRFD 10th Ed. Table 3.6.2.1-1';
  const blank = v => v == null || v === '' || (typeof v === 'number' && Number.isNaN(v));
  const numIn = (scope, k, label, unit, v, ph) => `<div class="fRow"><label for="an_${scope}_${k}">${label}</label><input type="number" step="any" id="an_${scope}_${k}" data-an="${scope}" data-k="${k}" value="${blank(v) ? '' : esc(v)}"${ph != null && ph !== '' ? ` placeholder="${esc(ph)}"` : ''}><span class="unit">${unit}</span></div>`;
  const chk = (id, label, on, k, sc, unit) => `<div class="fRow"><label for="${id}">${label}</label><input type="checkbox" id="${id}" data-an="${sc || 'ov'}" data-k="${k || (id === 'an_ov_l' ? 'loadsOverride' : 'dfOverride')}"${on ? ' checked' : ''}><span class="unit">${unit || 'off: the calculated value is used'}</span></div>`;
  const kf = v => isFinite(v) ? f(v, 4) : '—';
  /* ctxOf(P, gi): the girder, its loads module result, its loads and factors (engine/analysis.js), and whether each override is on */
  function ctxOf(P, gi) {
    const g = P.girders[gi], mod = g.loads && g.df ? null : AN().moduleOf(P, gi), M = mod && mod.G ? mod.G : null;
    const LD = AN().loadsOf(P, g, mod), DF = AN().dfOf(P, g, P.spans.lengths.length, mod);
    const rgOk = !!(mod && mod.R && mod.R.regions);
    return { g, mod, M, LD, DF, ovL: AN().deadOverride(g, M), ovD: AN().dfOverride(g, rgOk), rgOk };
  }
  /* the calculated value of a dead load (the loads module), for the read-only column and the box's placeholder */
  const calcL = (C, k) => C.M ? ({ DC1wet: C.M.DC1, DC2: C.M.DC2, DW: C.M.DW, UT: C.M.UT, UF: C.M.UF, PL: C.M.PL })[k] : null;
  const calcD = (C, k) => { if (!C.rgOk || !C.mod) return null; const R = C.mod.R, j = C.mod.j, s0 = R.regions.find(r => r.id === 's0'), p1 = R.regions.find(r => r.id === 'p1');
    if (!s0) return null; return k === 'gDef' ? s0.gDef : k === 'gMpier' ? (p1 ? p1.members[j].gM : null) : s0.members[j][k]; };
  function inputs(P, gi) {
    const S = AN().settings(P), A0 = P.analysis || {}, C = ctxOf(P, gi), g = C.g, Lm = g.loadsManual || {}, Dm = g.dfManual || {}, LD = C.LD, gl = esc(g.label || g.id);
    const sel = (k, label, opts) => `<div class="fRow"><label for="an_a_${k}">${label}</label><select id="an_a_${k}" data-an="a" data-k="${k}">${opts.map(([v, t]) => `<option value="${v}"${String(S[k] == null ? '' : S[k]) === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
    const imSrc = (k, d) => blank(A0[k]) ? `blank: ${d} % (${IM_SRC})` : `entered (${IM_SRC}: ${d} %)`;
    const line = C.mod && C.mod.j != null ? C.mod.j : AN().lineOf(P, g), see = '<a href="#" data-gotab="loads">Loads &amp; LLDF tab</a>';
    let h = card('Analysis settings', `
      ${numIn('a', 'im', 'IM, truck and tandem', `% — ${imSrc('im', 33)}`, A0.im, 33)}${numIn('a', 'imf', 'IM, fatigue truck', `% — ${imSrc('imf', 15)}`, A0.imf, 15)}
      ${sel('crack', 'Cracked zones (6.10.1.5)', [['none', 'None: deck effective over the whole length'], ['15', '15 % of the spans either side of each pier'], ['dl', 'Negative dead-load moment region']])}
      ${numIn('a', 'deflLimit', 'LL deflection limit L/', '(2.5.2.6.2)', S.deflLimit)}
      ${sel('deflSidewalk', 'Sidewalk or pedestrians, owner LL deflection limit (OWN19)', [['auto', 'Automatic: a sidewalk on the Cross-section tab'], ['yes', 'Yes'], ['no', 'No']])}
      ${sel('seq', 'Deck placement sequence (6.10.3.4.1)', [['on', 'On'], ['off', 'Off']])}${sel('seqMod', 'Hardened pours act with', [['n', 'n'], ['3n', '3n']])}
      <div class="fRow"><label for="an_a_seqCustom">Pours (optional)</label><input type="text" id="an_a_seqCustom" data-an="a" data-k="seqCustom" value="${esc(S.seqCustom)}" style="width:180px"><span class="unit">from–to per row (none: automatic)</span></div>
      ${numIn('a', 'steelAllowPct', 'Girder steel detail allowance', '%', S.steelAllowPct)}
      ${sel('haunchInStiffness', 'Haunch in the composite stiffness', [['', 'As the owner rule (OWN8)'], ['true', 'Yes'], ['false', 'No']])}
      <p class="note">Used by the <a href="#" data-gotab="an">Analysis tab</a> (moved here from it; saved as before); the LL deflection limit, the sidewalk choice and the cracked zones also by the <a href="#" data-gotab="defl">Deflection tab</a>.</p>`, 'an-settings');
    // dead loads: the calculated values, the override box, the entered values
    const rowsL = [['DC1wet', 'DC1 wet deck (deck, haunch, SIP, other)'], ['DC2', 'DC2 (barriers, curbs, …)'], ['DW', 'DW (wearing surface)'], ['UT', 'Existing utilities (steel section)']];
    const xfStored = Array.isArray(Lm.xf) && Lm.xf.length, xfShow = xfStored && LD.src.xf !== 'module' && LD.src.xf !== 'girder';
    h += card(`Dead loads for the analysis, girder ${gl}`, `<p class="note">Calculated: <b>${C.M ? `loads module, cross-section girder G${line + 1}` : 'none (the loads module gives none: ' + esc(C.mod && C.mod.errors ? C.mod.errors[0] : 'the cross-section is not complete') + ')'}</b>${C.M ? `, worked on the ${see} (girder G${line + 1})` : ''}. Used: <b>${esc(LD.source)}</b>.</p>
      ${chk('an_ov_l', 'Override calculated value', C.ovL)}
      ${C.ovL ? rowsL.map(([k, t]) => numIn('l', k, t, 'klf', Lm[k], isFinite(calcL(C, k)) ? f(calcL(C, k), 4) : '')).join('') + `<p class="note">Blank: the calculated value (in grey)${C.M ? '' : '; none here, so blank = 0'}.</p>` : `<p class="note">${rowsL.map(([k, t]) => `${t}: ${kf(LD[k])} klf`).join('; ')}.</p>`}
      ${xfShow ? `<div class="fRow"><label for="an_l_xf">Cross-frame point loads (stored entry)</label><input type="text" id="an_l_xf" data-an="l" data-k="xf" value="${esc((Lm.xf || []).map(q => `${q.x}:${q.P}`).join(', '))}" style="width:180px"><span class="unit">one load per row</span></div>
        <p class="note">Kept because this project stored it and has no framing: it is used until the framing is set (<a href="#" data-itgo="framing">Framing &amp; bracing tab</a>); then the frames give the point loads.</p>`
        : `<p class="note">Cross-frame point loads: ${LD.src.xf === 'module' && LD.xfInfo ? `${LD.xfInfo.n} frames, ${LD.xfInfo.tot.toFixed(2)} kip in all, from the framing and the cross-frame weights (<a href="#" data-itgo="framing">Framing &amp; bracing tab</a>)` : LD.src.xf === 'girder' ? 'from the girder loads' : 'none (the project has no framing: <a href="#" data-itgo="framing">Framing &amp; bracing tab</a>)'}.</p>`}`, 'an-dead');
    // construction live load (CLC, 2026-11-09): calculated w_CL = q_CL × b_trib, an override per girder, and the finishing machine
    const CL = LD.cl, fm = A0.fm || {}, ovC = LD.clOverride, qPh = CL.qSrc === 'entered' ? '' : String(CL.q);
    h += card(`Construction live load, girder ${gl}`, `${chk('an_a_clCalc', 'Calculate the construction live load', CL.on, 'clCalc', 'a', CL.on ? 'w<sub>CL</sub> = q<sub>CL</sub> × tributary deck width' : 'off: a project saved before 2026-11-09 (0 unless entered below)')}
      ${CL.on ? numIn('a', 'qCL', 'Construction live load on the deck q<sub>CL</sub>', `psf — ${CL.qSrc === 'entered' ? 'entered' : CL.qSrc === 'owner' ? `blank: owner rule ${esc(CL.qCite)}, ${CL.q} psf` : 'blank: 20 psf (AASHTO LRFD 3.4.2.1 gives no value; this app\'s default)'}${CL.own ? `; owner minimum ${CL.own} psf (${esc(CL.ownCite)})` : ''}`, A0.qCL, qPh)
        + `<p class="note">Calculated: w<sub>CL</sub> = q<sub>CL</sub>/1000 × b<sub>trib</sub> = ${f(CL.q, 1)}/1000 × ${isFinite(CL.trib) ? f(CL.trib, 3) : '—'} ft = <b>${isFinite(CL.w) ? f(CL.w, 4) + ' klf' : '— (the tributary width needs a complete cross-section)'}</b> (b<sub>trib</sub>: cross-section girder G${line + 1}, worked on the ${see}; w<sub>CL</sub> worked on the <a href="#" data-gotab="an">Analysis tab</a>, steps an.CL.q, an.CL.w).</p>` : ''}
      ${chk('an_ov_c', 'Override calculated value', ovC, 'clOverride')}
      ${ovC ? numIn('l', 'CL', 'Construction live load w<sub>CL</sub>', `klf${CL.on && isFinite(CL.w) ? ` — calculated ${kf(CL.w)}` : ''}; blank: ${CL.on ? 'calculated' : '0'}`, Lm.CL, CL.on && isFinite(CL.w) ? f(CL.w, 4) : '') : ''}
      <p class="note">Used: <b>${kf(LD.CL)} klf</b> (${{ girder: 'girder loads', manual: 'entered (override)', calc: 'calculated', none: 'none' }[LD.src.CL]}). The construction live load enters the deck placement checks (Constructibility tab, γ construction) on the steel section. AASHTO LRFD 10th Ed. Art. 3.4.2.1 requires construction loads but gives no value: q<sub>CL</sub> left blank is the owner's value, else 20 psf (this app's default, the overhang bracket construction load). A project saved before this calculation (2026-11-09) is not switched to it: tick the box above. The overhang bracket checks keep their own q<sub>CL</sub> (Constructibility tab, OH inputs). An entered q<sub>CL</sub> below zero is an input error and withholds every result (decision pending engineer review).</p>`, 'an-cl');
    h += card('Finishing machine (optional)', `${numIn('fm', 'P', 'Load P<sub>fm</sub>, each of the pair', 'kip (blank: none)', fm.P)}${numIn('fm', 'e', 'Each load from its deck edge e<sub>fm</sub>', 'ft (on the overhang; blank: 0, at the edge)', fm.e)}
      <p class="note">A pair of equal point loads, one on each overhang, moving together along the bridge. Each girder takes its lever-rule share (AASHTO LRFD 10th Ed. Art. 4.6.2.2.1): with a load outside the exterior girder, P(1 + a/S) on it and the uplift −Pa/S on the first interior girder; the share moves along the steel section; the moments and shears are added to M<sub>CL</sub>, V<sub>CL</sub> where they add to the deck placement effects (worked on the <a href="#" data-gotab="an">Analysis tab</a>, steps an.fm.*). The overhang bracket checks keep their own finishing machine load per bracket (Constructibility tab, OH inputs). A load P<sub>fm</sub> below zero is an input error and withholds every result (decision pending engineer review).</p>`, 'an-fm');
    // distribution factors
    const rowsD = [['gM', 'g moment (spans)'], ['gMpier', 'g moment (pier regions)'], ['gV', 'g shear'], ['fatM', 'g fatigue moment'], ['fatV', 'g fatigue shear'], ['gDef', 'g deflection (all lanes, all girders)']];
    const DF = C.DF, s0 = DF.spans[0] || {};
    h += card(`Live load distribution factors for the analysis, girder ${gl}`, `<p class="note">Calculated: <b>${C.rgOk ? `loads module (LLDF), cross-section girder G${line + 1}` : 'none (the loads module gives none)'}</b>${C.rgOk ? `, worked on the ${see}` : ''}. Used: <b>${esc(DF.src)}</b> (lanes per girder, multiple presence included; fatigue: one lane ÷ 1.2, 3.6.1.4.3b).</p>
      ${chk('an_ov_d', 'Override calculated value', C.ovD)}
      ${C.ovD ? rowsD.map(([k, t]) => numIn('d', k, t, C.rgOk ? '' : k === 'gMpier' ? 'blank = spans' : 'blank = 1', Dm[k], C.rgOk && isFinite(calcD(C, k)) ? f(calcD(C, k), 3) : '')).join('') + `<p class="note">One value for every span. ${C.rgOk ? 'Blank: the calculated value (span 1 in grey; the pier g moment: blank = the entered span value, else calculated).' : ''}</p>`
        : `<p class="note">Span 1: g<sub>M</sub> ${f(s0.gM, 3)}, g<sub>V</sub> ${f(s0.gV, 3)}, fatigue ${f(s0.fatM, 3)} / ${f(s0.fatV, 3)}, g<sub>Δ</sub> ${f(s0.gDef, 3)}${DF.piers.length ? `; pier 1 g<sub>M</sub> ${f(DF.piers[0].gM, 3)}` : ''} (every span: <a href="#" data-gotab="an">Analysis tab</a>).</p>`}`, 'an-df');
    return h;
  }
  /* onInputChange(el, P, gi): a change on the Loads input tab; true when it was one of these inputs (the project is changed) */
  function onInputChange(el, P, gi) {
    const sc = el.dataset && el.dataset.an, k = el.dataset && el.dataset.k; if (!sc || !k) return false;
    const g = P.girders[gi];
    if (sc === 'a' && el.type !== 'checkbox') { P.analysis = P.analysis || {}; const v = el.value; P.analysis[k] = el.tagName === 'SELECT' ? (v === 'true' ? true : v === 'false' ? false : v === '' ? null : v) : k === 'seqCustom' ? v : (v === '' ? null : Number(v)); }
    else if (sc === 'a' && el.type === 'checkbox') { P.analysis = P.analysis || {}; P.analysis[k] = !!el.checked; }
    else if (sc === 'ov') g[k] = !!el.checked;
    else if (sc === 'fm') { P.analysis = P.analysis || {}; const F = { ...(P.analysis.fm || {}) }; if (el.value === '') delete F[k]; else F[k] = Number(el.value); if (Object.keys(F).length) P.analysis.fm = F; else delete P.analysis.fm; }
    else if (sc === 'l') { g.loadsManual = g.loadsManual || {};
      if (k === 'xf') g.loadsManual.xf = el.value.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => s.split(':').map(Number)).filter(q => q.length === 2 && q.every(isFinite)).map(([x, P_]) => ({ x, P: P_ }));
      else g.loadsManual[k] = el.value === '' ? null : Number(el.value); }
    else if (sc === 'd') { g.dfManual = g.dfManual || {}; g.dfManual[k] = el.value === '' ? null : Number(el.value); }
    else return false;
    return true;
  }

  /* ---------- this tab: the girder line and the loads and factors used, read-only, each linked to where it is worked (§6) ---------- */
  function usedHtml(P, gi) {
    const C = ctxOf(P, gi), g = C.g, LD = C.LD, DF = C.DF, S = AN().settings(P), A0 = P.analysis || {}, nb = P.xs ? Math.round(P.xs.nb) : 0, line = AN().lineOf(P, g);
    const lineSel = nb > 0 ? `<div class="fRow"><label for="an_g_line">Cross-section girder (loads, factors)</label><select id="an_g_line" data-an="g" data-k="line">${[...Array(nb)].map((_, j) => `<option value="${j}"${j === line ? ' selected' : ''}>G${j + 1}${j === 0 || j === nb - 1 ? ' (exterior)' : ''}</option>`).join('')}</select></div>` : '';
    const SRC = { girder: 'girder loads (hand-off)', module: 'calculated', manual: 'entered (override)', none: 'none', calc: `calculated, q<sub>CL</sub> ${f(LD.cl.q, 0)} psf × b<sub>trib</sub>` };
    const j = C.mod && C.mod.j != null ? C.mod.j : line, G = `G${j + 1}`;
    const where = (k, sid) => LD.src[k] === 'module' ? `<a href="#" data-gotab="loads" title="Loads &amp; LLDF tab, girder ${G}, step dl.${G}.${sid}">Loads &amp; LLDF, ${G} §</a>` : LD.src[k] === 'manual' || LD.src[k] === 'none' ? '<a href="#" data-goto="loads">Loads input tab</a>' : '';
    const rows = [['DC1wet', 'DC1 wet deck (deck, haunch, SIP)', 'DC1'], ['DC2', 'DC2', 'DC2'], ['DW', 'DW', 'DW'], ['UT', 'Existing utilities', 'UT'], ['UF', 'Future utility allowance', 'UF'], ['PL', 'Pedestrian live load', 'PL'], ['CL', 'Construction live load', null]]
      .filter(([k]) => k !== 'UF' && k !== 'PL' && k !== 'UT' || LD[k]);
    const tr = (t, v, s, w) => `<tr><td class="lft">${t}</td><td>${v}</td><td class="lft">${s}</td><td class="lft">${w}</td></tr>`;
    const xfTxt = LD.xf.length ? `${LD.xf.length} loads, ${f(LD.xf.reduce((a, q) => a + q.P, 0), 2)} kip in all` : 'none';
    return card(`Loads and factors used, girder ${esc(g.label || g.id)} (read-only)`, `${lineSel}
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Load (per girder)</th><th>w (klf)</th><th class="lft">Source</th><th class="lft">Worked</th></tr></thead><tbody>
      ${rows.map(([k, t, sid]) => tr(t, kf(LD[k]), SRC[LD.src[k]] || LD.src[k], k === 'CL' ? (LD.src.CL === 'calc' ? wk('an.CL.w') : LD.src.CL === 'manual' || LD.src.CL === 'none' ? '<a href="#" data-goto="loads">Loads input tab</a>' : '') : where(k, sid))).join('')}
      ${(P.analysis || {}).fm && +(P.analysis.fm.P) > 0 ? tr('Finishing machine (moving, added to M<sub>CL</sub>)', (() => { const F = AN().fmOf(P, C.mod, j); return F && isFinite(F.Pj) ? `P<sub>j</sub> = ${f(F.Pj, 3)} kip` : '— (needs the cross-section)'; })(), `pair of ${f(+P.analysis.fm.P, 2)} kip loads, lever rule`, wk('an.fm.Pj')) : ''}
      ${tr('Girder steel', 'by segment', `A<sub>s</sub> × 490 pcf × (1 + ${f(LD.steelAllowPct, 1)} %)`, wk('an.wst0'))}
      ${tr('Cross-frame point loads', xfTxt, LD.src.xf === 'module' ? 'framing and cross-frame weights' : SRC[LD.src.xf] || LD.src.xf, LD.src.xf === 'module' ? '<a href="#" data-gotab="cf">Cross-frames tab</a>' : LD.src.xf === 'manual' ? '<a href="#" data-goto="loads">Loads input tab</a>' : '')}
      </tbody></table></div>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Distribution factor</th>${DF.spans.map((_, i) => `<th>Span ${i + 1}</th>`).join('')}${DF.piers.map((_, k) => `<th>Pier ${k + 1}</th>`).join('')}</tr></thead><tbody>
      ${[['gM', 'g moment'], ['gV', 'g shear'], ['fatM', 'g fatigue moment'], ['fatV', 'g fatigue shear'], ['gDef', 'g deflection']].map(([k, t]) => `<tr><td class="lft">${t}</td>${DF.spans.map(s => `<td>${f(s[k], 3)}</td>`).join('')}${DF.piers.map(p => `<td>${k === 'gM' ? f(p.gM, 3) : ''}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <p class="note">Distribution factors: <b>${esc(DF.src)}</b>; ${C.rgOk && !DF.pulled ? `worked on the <a href="#" data-gotab="loads">Loads &amp; LLDF tab</a> (girder ${G}, regions s1… and p1…)` : 'entered or pulled: <a href="#" data-goto="loads">Loads input tab</a>'}. Dead loads: <b>${esc(LD.source)}</b>.
      Settings: IM ${f(S.im, 0)} % truck and tandem, ${f(S.imf, 0)} % fatigue (${blank(A0.im) && blank(A0.imf) ? `${IM_SRC}, default` : `entered; ${IM_SRC}: 33 %, 15 %`}); cracked zones ${S.crack === 'none' ? 'none' : S.crack === '15' ? '15 % either side of each pier' : 'negative dead-load moment region'}; LL deflection L/${f(S.deflLimit, 0)}; deck placement sequence ${S.seq}.
      Every input here is on the <a href="#" data-goto="loads">Loads input tab</a>.</p>`, 'an-used');
  }
  function onInput(e, ctx) {
    const el = e.target; if (el.dataset.an !== 'g') return;
    ctx.P.girders[ctx.gi].line = Number(el.value); ctx.changed();
  }

  /* ---------- SVG diagrams ---------- */
  const COL = ['#1E3A5F', '#2563EB', '#059669', '#B45309', '#DC2626', '#7C3AED', '#0891B2', '#64748B'];
  function chart(x, series, o) {
    const W = 760, H = 230, l = 58, r = 10, t = 12, b = 30, xs = x, X0 = 0, X1 = xs[xs.length - 1];
    let lo = 0, hi = 0; series.forEach(s => s.y.forEach(v => { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    if (o.invert) { const a = lo; lo = -hi; hi = -a; }
    if (hi - lo < 1e-9) { hi = lo + 1; }
    const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const sx = v => l + (v - X0) / (X1 - X0) * (W - l - r), sy = v => t + (hi - (o.invert ? -v : v)) / (hi - lo) * (H - t - b);
    const tick = (a, b_, n) => { const raw = (b_ - a) / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p, s = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p, out = []; for (let v = Math.ceil(a / s) * s; v <= b_ + 1e-9; v += s) out.push(+v.toFixed(10)); return out; };
    let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.title)}" style="max-width:${W}px;display:block;font-family:var(--font-ui);font-size:10px">`;
    tick(lo, hi, 5).forEach(v => { const y = sy(o.invert ? -v : v); g += `<line x1="${l}" x2="${W - r}" y1="${y}" y2="${y}" stroke="#E4E7EB"/><text x="${l - 4}" y="${y + 3}" text-anchor="end" fill="#475569">${f(o.invert ? -v : v, Math.abs(v) < 10 ? 2 : 0)}</text>`; });
    (o.sup || []).forEach(v => { const X = sx(v); g += `<line x1="${X}" x2="${X}" y1="${t}" y2="${H - b}" stroke="#94A3B8" stroke-dasharray="3 3"/>`; });
    tick(X0, X1, 8).forEach(v => { g += `<text x="${sx(v)}" y="${H - b + 13}" text-anchor="middle" fill="#475569">${f(v, 0)}</text>`; });
    g += `<line x1="${l}" x2="${W - r}" y1="${sy(0)}" y2="${sy(0)}" stroke="#0F172A" stroke-width="0.8"/>`;
    series.forEach((s, k) => { const pts = s.y.map((v, i) => isFinite(v) ? `${sx(xs[i]).toFixed(1)},${sy(v).toFixed(1)}` : null).filter(Boolean).join(' ');
      g += `<polyline fill="none" stroke="${s.c || COL[k % COL.length]}" stroke-width="${s.w || 1.4}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''} points="${pts}"/>`; });
    g += `<text x="${(l + W - r) / 2}" y="${H - 3}" text-anchor="middle" fill="#475569">x (ft)</text><text x="12" y="${(t + H - b) / 2}" transform="rotate(-90 12 ${(t + H - b) / 2})" text-anchor="middle" fill="#475569">${esc(o.unit)}</text></svg>`;
    const leg = series.map((s, k) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px"><svg width="22" height="8" aria-hidden="true"><line x1="0" x2="22" y1="4" y2="4" stroke="${s.c || COL[k % COL.length]}" stroke-width="2"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/></svg>${esc(s.name)}</span>`).join('');
    return `<figure style="margin:6px 0"><figcaption class="note" style="font-weight:600">${esc(o.title)}</figcaption>${g}<div class="note">${leg}</div></figure>`;
  }

  /* ---------- results ---------- */
  const A = '10th Ed. Art. ', OPEN = new Set(), TPX = (...ks) => ks.map(k => window.SBDFlexureUI.TP[k]).filter(Boolean);

  /* ---------- topics of the worked steps (presentation spec A, 2026-10-31; as ui/shear.js): the stiffness inputs, then the results by kind of effect ---------- */
  const TOPICS = { x: () => [window.SBDFlexureUI.TP.n, { key: 'ann', title: 'Modular ratio for the stiffness', ref: A + '6.10.1.1.1b', ids: /^an\.n$/ }, ...TPX('steel', 'c3', 'cn', 'cr'),
    { key: 'wst', title: 'Girder steel weight by segment', ref: A + '3.5.1', ids: /^an\.wst/ },
    { key: 'I', title: 'Stiffness of each segment (steel, 3n, n)', ref: A + '4.6.2.1, 6.10.1.1.1', ids: /^an\.I\d+/ },
    { key: 'eq', title: 'Equilibrium checks of the dead-load analyses', ref: '', ids: /^an\.eq\./ },
    { key: 'dc', title: 'Permanent-load moments (DC1, DC2, DW)', ref: A + '4.6.2.1, 6.10.1.1.1', ids: /^an\.M\.(DC|perm)/ },
    { key: 'll', title: 'Live-load envelopes and reactions (LL+IM)', ref: A + '3.6.1.2, 3.6.1.3.1, 3.6.2.1', ids: /^an\.(M\.LL|R\.LL)/ },
    { key: 'defl', title: 'Live-load deflection', ref: A + '2.5.2.6.2, 3.6.1.3.2', ids: /^an\.defl\./ },
    { key: 'camber', title: 'Dead-load deflection (camber)', ref: A + '6.7.2', ids: /^an\.camber/ },
    { key: 'seq', title: 'Deck placement sequence', ref: A + '6.10.3.4.1', ids: /^an\.seq\./ },
    { key: 'cl', title: 'Construction live load and finishing machine', ref: A + '3.4.2.1', ids: /^an\.(CL|fm)\./ }] };
  const groups = (kind, list) => window.SharedSteps.group(list, TOPICS[kind || 'x'](), { strip: false });
  function resultsHtml(R) {
    if (R.errors && R.errors.length) return `<div class="alert err"><b>Analysis input errors.</b><ul>${R.errors.map(e => `<li>${esc(e.msg || e)}</li>`).join('')}</ul></div>`;
    const x = R.x, N = x.length, s = R.st, ll = R.ll, ft = R.fat, sup = R.sup, Vr = o => x.map((_, i) => i === N - 1 ? o.VL[i] : o.VR[i]), Vx = (o, k) => x.map((_, i) => i === N - 1 ? o['VL' + k][i] : o['VR' + k][i]);
    let h = '';
    if (R.warnings.length) h += `<div class="alert">${R.warnings.map(esc).join('<br>')}</div>`;
    const Mser = [{ name: 'DC1', y: s.DC1.M }, { name: 'DC2', y: s.DC2.M }, { name: 'DW', y: s.DW.M }];
    if (ll) Mser.push({ name: 'LL+IM max', y: ll.Mpos, c: '#DC2626' }, { name: 'LL+IM min', y: ll.Mneg, c: '#DC2626', dash: '4 3' });
    if (R.seq) Mser.push({ name: 'M_DCc (pour sequence)', y: R.seq.MDCc, c: '#7C3AED', dash: '2 2' });
    const Vser = [{ name: 'DC1', y: Vr(s.DC1) }, { name: 'DC2', y: Vr(s.DC2) }, { name: 'DW', y: Vr(s.DW) }];
    if (ll) Vser.push({ name: 'LL+IM max', y: Vx(ll, 'pos'), c: '#DC2626' }, { name: 'LL+IM min', y: Vx(ll, 'neg'), c: '#DC2626', dash: '4 3' });
    h += '<div id="gfx_an"></div>';   // graphic (ui/gfxa.js)
    h += card('Diagrams', `${chart(x, Mser, { title: 'Moments (unfactored, per girder; LL+IM with g)', unit: 'kip-ft', sup })}${chart(x, Vser, { title: 'Shears (V = sum of forces to the left, up +)', unit: 'kip', sup })}
      <p class="note">Stations: GirderDetail's grid, ${N} points. ${R.cont ? 'Continuous' : 'Simple spans'}; ${R.crack.length ? `cracked zones ${R.crack.map(([a, b]) => `${f(a, 1)}–${f(b, 1)} ft`).join(', ')} ${wk('an.crack')}` : 'no cracked zones'}. Engine: shared beam elements (stiffness method), loads applied exactly.</p>`, 'an-diag');
    // reactions
    const rr = (k, o) => o.R[k];
    h += card('Reactions (unfactored, kip)', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Support</th><th>DC1</th><th>DC2</th><th>DW</th><th>Constr. LL</th>${ll ? '<th>LL+IM max</th><th>LL+IM min</th>' : ''}</tr></thead><tbody>
      ${sup.map((v, k) => `<tr><td class="lft">${k === 0 ? 'Abut. 1' : k === sup.length - 1 ? 'Abut. 2' : 'Pier ' + k} (x = ${f(v, 1)})</td><td>${f(rr(k, s.DC1), 2)}</td><td>${f(rr(k, s.DC2), 2)}</td><td>${f(rr(k, s.DW), 2)}</td><td>${f(rr(k, s.CL), 2)}</td>
        ${ll ? `<td>${f(R.llR[k].max, 2)} ${wk('an.R.LL.' + k)}${R.llR[k].two ? ' *' : ''}</td><td>${f(R.llR[k].min, 2)}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      <p class="note">${ll ? '* 90 % of two design trucks + lane governs (3.6.1.3.1; on simple spans the summed pier reaction, engineer\'s decision 2026-10-29). ' : ''}Statics: ${['DC1steel', 'DC1wet', 'DC2', 'DW', 'CL'].map(k => wk('an.eq.' + k, k)).join(', ')}.</p>`);
    // DEFL (2026-11-09): the LL deflection check and the dead-load deflections are on the Deflection tab (ui/deflection.js); one line here
    { const D = window.SBDDeflectionUI && window.SBDDeflectionUI.summary(R);
      if (D) h += card('Deflection', `<p class="note">${D.top ? `Live load: largest Δ<sub>LL</sub> / Δ<sub>lim</sub> = <b>${f(D.top.dc, 3)}</b> (span ${D.top.k + 1}, ${f(D.top.d, 3)} in vs L/${D.top.ratio} = ${f(D.top.lim, 3)} in; ${D.ok ? 'all spans pass' : 'exceeds'}). ` : ''}Dead-load camber: largest <b>${f(D.cm.total, 3)} in</b> (span ${D.cm.k + 1}, x = ${f(D.cm.x, 1)} ft). Worked, by span and at tenth points: <a href="#" data-gotab="defl">Deflection tab</a>.</p>`, 'an-defl'); }
    if (R.seq) { const Q = R.seq, fd = Math.max(...Q.fdk);
      h += card('Deck placement sequence (SA7, 6.10.3.4.1)', `<p class="note">Pours in order: ${Q.pours.map((q, k) => `${k + 1}: ${f(q.a, 1)}–${f(q.b, 1)} ft`).join('; ')}. Largest noncomposite moment M<sub>DCc</sub> ${f(Math.max(...Q.MDCc), 1)} kip-ft ${wk('an.seq.MDCc')}
        (deck at once ${f(Math.max(...R.st.DC1.M), 1)}). Deck tension in hardened pours ${f(fd, 3)} ksi vs φf<sub>r</sub> ${f(Q.phifr, 3)} ksi ${wk('an.seq.fdk')}.</p>`); }
    // station table
    const cols = {
      M: [['M_DC1 steel', s.DC1steel.M], ['M_DC1 wet', s.DC1wet.M], ['M_DC1', s.DC1.M], ['M_DC2', s.DC2.M], ['M_DW', s.DW.M], ...(ll ? [['M_LL+IM max', ll.Mpos], ['M_LL+IM min', ll.Mneg], ['M_FAT max', ft.Mpos], ['M_FAT min', ft.Mneg], ['g_M', ll.gM, 3]] : []), ['M_CL', s.CL.M], ...(R.seq ? [['M_DCc', R.seq.MDCc]] : [])],
      V: [['V_DC1', Vr(s.DC1)], ['V_DC2', Vr(s.DC2)], ['V_DW', Vr(s.DW)], ...(ll ? [['V_LL+IM max', Vx(ll, 'pos')], ['V_LL+IM min', Vx(ll, 'neg')], ['V_FAT max', Vx(ft, 'pos')], ['V_FAT min', Vx(ft, 'neg')]] : []), ['V_CL', Vr(s.CL)]] }[view];
    const unit = { M: 'kip-ft', V: 'kip (just right of the station; at a support also just left, below; at the end just left)' }[view];
    const supSet = new Set(R.supIdx.slice(1, -1));
    h += card('Station table', `<div class="fRow"><label for="an_view">Show</label><select id="an_view"><option value="M"${view === 'M' ? ' selected' : ''}>Moments</option><option value="V"${view === 'V' ? ' selected' : ''}>Shears</option></select><span class="unit">${unit}</span></div>
      <div class="tscroll" style="max-height:420px;overflow-y:auto"><table class="tbl"><thead><tr><th>x (ft)</th>${cols.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>
      ${x.map((v, i) => `<tr${R.region[i] >= 1 ? ' style="background:#F8FAFC"' : ''}><td>${f(v, 2)}</td>${cols.map(c => `<td>${f(c[1][i], c[2] || 1)}</td>`).join('')}</tr>${view === 'V' && supSet.has(i) ? `<tr><td>${f(v, 2)} left</td>${[['V', s.DC1.VL], ['', s.DC2.VL], ['', s.DW.VL], ...(ll ? [['', ll.VLpos], ['', ll.VLneg], ['', ft.VLpos], ['', ft.VLneg]] : []), ['', s.CL.VL]].map(c => `<td>${f(c[1][i], 1)}</td>`).join('')}</tr>` : ''}`).join('')}
      </tbody></table></div><p class="note">Shaded rows: pier regions (negative permanent-load moment), where the pier g<sub>M</sub> and the 90 % two-truck case apply (3.6.1.3.1). Each key value is worked in the steps below. Dead-load deflections at every station: <a href="#" data-gotab="defl">Deflection tab</a>.</p>`);
    h += card('Worked steps', `<p class="note">AASHTO LRFD 10th Ed. (2024). Moments and shears are stiffness-method results of the shared beam engine on the stiffness of each stage; their checks are the statics steps and, for LL+IM, the per-lane envelope × g. The live-load deflection and camber steps are on the <a href="#" data-gotab="defl">Deflection tab</a>.</p>${ST().groupsHTML(groups('x', R.steps.filter(q => !/^an\.(defl\.|camber)/.test(q.id))), { open: OPEN, item: q => `<li id="st-${esc(q.id)}"${q.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(q.label)}${q.ref ? `<span class="ref">${esc(q.ref)}</span>` : ''}</div><div>${ST().line(q, true)}</div>${q.note ? `<div class="nt">${esc(q.note)}</div>` : ''}</li>` })}`);
    return h;
  }

  function draw(el, ctx) {
    const P = ctx.P, gi = Math.min(ctx.gi, P.girders.length - 1), key = keyOf(P, gi), stale = !res || resKey !== key;
    let h = `<div class="alert stale"${stale && !busy ? '' : ' hidden'}><span>${res ? 'Analysis results are out of date: inputs changed.' : 'The analysis has not been run.'} Live load takes a few seconds.</span><button type="button" class="primary" id="anCalc">Run analysis</button></div>`;
    if (busy) h += '<div class="alert">Calculating…</div>';
    h += `<p class="note">Girder <b>${esc(P.girders[gi].label || P.girders[gi].id)}</b> (choose the girder on the Girders &amp; plates tab). Unfactored effects per girder: DC1 (steel, then the wet deck) on the steel section, DC2 and DW on 3n, LL+IM on n (AASHTO LRFD 10th Ed. 4.6.2, 6.10.1.1.1, 6.10.1.5).</p>`;
    h += usedHtml(P, gi);
    if (res && !stale) h += resultsHtml(res);
    el.innerHTML = h;
    ST().wire(el, { onToggle: (k, open) => { if (open) OPEN.add(k); else OPEN.delete(k); } });
    { const sl = el.querySelector('#gfx_an'); if (sl && res && !stale && window.SBDGfxA) window.SBDGfxA.analysis(sl, { P, gi, R: res }); }
    el.querySelectorAll('[data-gotab]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const b = document.querySelector(`#tabBar [data-otab="${a.dataset.gotab}"]`); if (b) b.click(); }));   // AIN: links to the other output tabs
    el.oninput = null; el.onchange = e => { if (e.target.id === 'an_view') { view = e.target.value; draw(el, ctx); return; } onInput(e, ctx); };
    el.onclick = e => { if (e.target.id !== 'anCalc') return; busy = true; draw(el, ctx);
      setTimeout(() => { try { res = AN().analyzeGirder(P, gi); } catch (err) { res = { errors: [String(err && err.message || err)] }; } resKey = keyOf(P, gi); busy = false; draw(el, ctx); }, 30); };
  }
  /* srcBar(o): the line at the top of an output tab that says which demands it shows (added 2026-10-30, report wiring PR).
     o = { src: 'analysis' | 'project' | 'example' | 'file' | 'custom' (entered on the tab; custom demands PR 2026-11-01), auto (the tab's default, not chosen), rd (SBDAnalysis.ready()), g (girder label),
     plName (file name), example (what the example is) }. The default: this project's analysis when the project is complete
     (SBDAnalysis.ready), else the example; a tab without an example keeps the analysis and says what is missing. */
  function srcBar(o) {
    const rd = o.rd || { ok: true, why: [] }, an = o.src === 'analysis' || o.src === 'project';
    const what = an ? `This project's analysis${o.g ? ` of ${esc(o.g)}` : ''}` : o.src === 'custom' ? `Custom (entered on this tab${o.g ? `, ${esc(o.g)}` : ''})` : o.src === 'file' ? `Hand-off file${o.plName ? ' ' + esc(o.plName) : ' (none chosen yet)'}` : `Example${o.example ? ` (${esc(o.example)})` : ''}`;
    const why = o.auto ? (an ? (rd.ok ? 'the default: the project is complete' : `the project is not complete: ${rd.why.map(esc).join(' ')}`) : o.src === 'example' && !rd.ok ? `the default while the project is not complete: ${rd.why.map(esc).join(' ')}` : 'the default') : 'as chosen below';
    return `<div class="srcBar${an && !rd.ok ? ' warn' : o.src === 'example' || o.src === 'custom' ? ' ex' : ''}" role="status"><span>Demands:</span> <b>${what}</b> <span class="srcWhy">(${why})</span></div>`;
  }
  window.SBDAnalysisUI = { draw, srcBar, TOPICS, groups, inputs, onInputChange, chart };   // chart: also the Deflection tab's diagram (DEFL)
})();
