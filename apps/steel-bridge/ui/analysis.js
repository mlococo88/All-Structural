/* apps/steel-bridge/ui/analysis.js — the Analysis card of Steel Bridge Design (window.SBDAnalysisUI).
   Classic script. Needs window.SBDAnalysis (engine/analysis.js), SharedSteps, SharedUnits.
   inputs(P, gi) / onInputChange(el, P, gi) (AIN, 2026-11-09): the analysis inputs on the Loads input tab (project.analysis, girder.loadsManual,
   girder.dfManual and the "Override calculated value" boxes girder.loadsOverride / girder.dfOverride), moved there from this tab.
   draw(el, ctx): renders the girder line and the loads and factors used (read-only, linked to where each is worked), the Calculate button, the diagrams (plain SVG), the station table, the reactions, the LL deflection
   check (SA3), the deck placement sequence and the worked steps. ctx = { P, gi, changed() }. Results are kept until the
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
  const chk = (id, label, on) => `<div class="fRow"><label for="${id}">${label}</label><input type="checkbox" id="${id}" data-an="ov" data-k="${id === 'an_ov_l' ? 'loadsOverride' : 'dfOverride'}"${on ? ' checked' : ''}><span class="unit">off: the calculated value is used</span></div>`;
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
      <p class="note">Used by the <a href="#" data-gotab="an">Analysis tab</a> (moved here from it; saved as before).</p>`, 'an-settings');
    // dead loads: the calculated values, the override box, the entered values
    const rowsL = [['DC1wet', 'DC1 wet deck (deck, haunch, SIP, other)'], ['DC2', 'DC2 (barriers, curbs, …)'], ['DW', 'DW (wearing surface)'], ['UT', 'Existing utilities (steel section)']];
    const xfStored = Array.isArray(Lm.xf) && Lm.xf.length, xfShow = xfStored && LD.src.xf !== 'module' && LD.src.xf !== 'girder';
    h += card(`Dead loads for the analysis, girder ${gl}`, `<p class="note">Calculated: <b>${C.M ? `loads module, cross-section girder G${line + 1}` : 'none (the loads module gives none: ' + esc(C.mod && C.mod.errors ? C.mod.errors[0] : 'the cross-section is not complete') + ')'}</b>${C.M ? `, worked on the ${see} (girder G${line + 1})` : ''}. Used: <b>${esc(LD.source)}</b>.</p>
      ${chk('an_ov_l', 'Override calculated value', C.ovL)}
      ${C.ovL ? rowsL.map(([k, t]) => numIn('l', k, t, 'klf', Lm[k], isFinite(calcL(C, k)) ? f(calcL(C, k), 4) : '')).join('') + `<p class="note">Blank: the calculated value (in grey)${C.M ? '' : '; none here, so blank = 0'}.</p>` : `<p class="note">${rowsL.map(([k, t]) => `${t}: ${kf(LD[k])} klf`).join('; ')}.</p>`}
      ${xfShow ? `<div class="fRow"><label for="an_l_xf">Cross-frame point loads (stored entry)</label><input type="text" id="an_l_xf" data-an="l" data-k="xf" value="${esc((Lm.xf || []).map(q => `${q.x}:${q.P}`).join(', '))}" style="width:180px"><span class="unit">one load per row</span></div>
        <p class="note">Kept because this project stored it and has no framing: it is used until the framing is set (<a href="#" data-itgo="framing">Framing &amp; bracing tab</a>); then the frames give the point loads.</p>`
        : `<p class="note">Cross-frame point loads: ${LD.src.xf === 'module' && LD.xfInfo ? `${LD.xfInfo.n} frames, ${LD.xfInfo.tot.toFixed(2)} kip in all, from the framing and the cross-frame weights (<a href="#" data-itgo="framing">Framing &amp; bracing tab</a>)` : LD.src.xf === 'girder' ? 'from the girder loads' : 'none (the project has no framing: <a href="#" data-itgo="framing">Framing &amp; bracing tab</a>)'}.</p>`}`, 'an-dead');
    h += card(`Construction live load, girder ${gl}`, numIn('l', 'CL', 'Construction live load', 'klf', Lm.CL)
      + '<p class="note">Entered per girder (not calculated yet); blank: 0. Used in the deck placement checks (Constructibility tab).</p>', 'an-cl');
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
    if (sc === 'a') { P.analysis = P.analysis || {}; const v = el.value; P.analysis[k] = el.tagName === 'SELECT' ? (v === 'true' ? true : v === 'false' ? false : v === '' ? null : v) : k === 'seqCustom' ? v : (v === '' ? null : Number(v)); }
    else if (sc === 'ov') g[k] = !!el.checked;
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
    const SRC = { girder: 'girder loads (hand-off)', module: 'calculated', manual: 'entered (override)', none: 'none' };
    const j = C.mod && C.mod.j != null ? C.mod.j : line, G = `G${j + 1}`;
    const where = (k, sid) => LD.src[k] === 'module' ? `<a href="#" data-gotab="loads" title="Loads &amp; LLDF tab, girder ${G}, step dl.${G}.${sid}">Loads &amp; LLDF, ${G} §</a>` : LD.src[k] === 'manual' || LD.src[k] === 'none' ? '<a href="#" data-goto="loads">Loads input tab</a>' : '';
    const rows = [['DC1wet', 'DC1 wet deck (deck, haunch, SIP)', 'DC1'], ['DC2', 'DC2', 'DC2'], ['DW', 'DW', 'DW'], ['UT', 'Existing utilities', 'UT'], ['UF', 'Future utility allowance', 'UF'], ['PL', 'Pedestrian live load', 'PL'], ['CL', 'Construction live load', null]]
      .filter(([k]) => k !== 'UF' && k !== 'PL' && k !== 'UT' || LD[k]);
    const tr = (t, v, s, w) => `<tr><td class="lft">${t}</td><td>${v}</td><td class="lft">${s}</td><td class="lft">${w}</td></tr>`;
    const xfTxt = LD.xf.length ? `${LD.xf.length} loads, ${f(LD.xf.reduce((a, q) => a + q.P, 0), 2)} kip in all` : 'none';
    return card(`Loads and factors used, girder ${esc(g.label || g.id)} (read-only)`, `${lineSel}
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Load (per girder)</th><th>w (klf)</th><th class="lft">Source</th><th class="lft">Worked</th></tr></thead><tbody>
      ${rows.map(([k, t, sid]) => tr(t, kf(LD[k]), SRC[LD.src[k]] || LD.src[k], k === 'CL' ? (LD.src.CL === 'manual' || LD.src.CL === 'none' ? '<a href="#" data-goto="loads">Loads input tab</a>' : '') : where(k, sid))).join('')}
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
    { key: 'seq', title: 'Deck placement sequence', ref: A + '6.10.3.4.1', ids: /^an\.seq\./ }] };
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
    const Dser = [{ name: 'Steel + cross-frames', y: R.camber.steel }, { name: 'Wet deck', y: R.camber.wet }, { name: 'DC2 + DW', y: R.camber.sd }];
    if (R.camber.ut) Dser.push({ name: 'Utilities', y: R.camber.ut });
    Dser.push({ name: 'Total (camber)', y: R.camber.total, c: '#0F172A', w: 2 });
    h += '<div id="gfx_an"></div>';   // graphic (ui/gfxa.js)
    h += card('Diagrams', `${chart(x, Mser, { title: 'Moments (unfactored, per girder; LL+IM with g)', unit: 'kip-ft', sup })}${chart(x, Vser, { title: 'Shears (V = sum of forces to the left, up +)', unit: 'kip', sup })}
      ${chart(x, Dser, { title: 'Dead-load deflections (downward +, drawn down)', unit: 'in', sup, invert: true })}
      <p class="note">Stations: GirderDetail's grid, ${N} points. ${R.cont ? 'Continuous' : 'Simple spans'}; ${R.crack.length ? `cracked zones ${R.crack.map(([a, b]) => `${f(a, 1)}–${f(b, 1)} ft`).join(', ')} ${wk('an.crack')}` : 'no cracked zones'}. Engine: shared beam elements (stiffness method), loads applied exactly.</p>`, 'an-diag');
    // reactions
    const rr = (k, o) => o.R[k];
    h += card('Reactions (unfactored, kip)', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Support</th><th>DC1</th><th>DC2</th><th>DW</th><th>Constr. LL</th>${ll ? '<th>LL+IM max</th><th>LL+IM min</th>' : ''}</tr></thead><tbody>
      ${sup.map((v, k) => `<tr><td class="lft">${k === 0 ? 'Abut. 1' : k === sup.length - 1 ? 'Abut. 2' : 'Pier ' + k} (x = ${f(v, 1)})</td><td>${f(rr(k, s.DC1), 2)}</td><td>${f(rr(k, s.DC2), 2)}</td><td>${f(rr(k, s.DW), 2)}</td><td>${f(rr(k, s.CL), 2)}</td>
        ${ll ? `<td>${f(R.llR[k].max, 2)} ${wk('an.R.LL.' + k)}${R.llR[k].two ? ' *' : ''}</td><td>${f(R.llR[k].min, 2)}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      <p class="note">${ll ? '* 90 % of two design trucks + lane governs (3.6.1.3.1; on simple spans the summed pier reaction, engineer\'s decision 2026-10-29). ' : ''}Statics: ${['DC1steel', 'DC1wet', 'DC2', 'DW', 'CL'].map(k => wk('an.eq.' + k, k)).join(', ')}.</p>`);
    if (R.lld) { const O = R.lld[0] && R.lld[0].own, ST = { pass: ['--pass', 'OK'], fail: ['--fail', 'Exceeds'], warn: ['--warn', 'Exceeds the preferred limit (warning)'], na: ['--warn', 'Reported, not checked (exterior)'] };
      h += card(`Live load deflection (SA3, ${O ? esc(O.cite) + ', mandatory; ' : ''}2.5.2.6.2)`, `<table class="tbl"><thead><tr><th>Span</th><th>x (ft)</th><th>Δ<sub>LL</sub> (in)</th><th>L/${R.lld[0] ? R.lld[0].ratio : R.settings.deflLimit} (in)</th>${O && O.pref ? `<th>L/${O.pref} preferred (in)</th>` : ''}<th>Ratio</th><th></th></tr></thead><tbody>
      ${R.lld.map(q => `<tr><td>${q.k + 1}</td><td>${f(q.x, 1)}</td><td>${f(q.d, 3)} ${wk('an.defl.LL' + (q.k + 1))}</td><td>${f(q.lim, 3)} ${wk('an.defl.lim' + (q.k + 1))}</td>${O && O.pref ? `<td>${f(q.limP, 3)} ${wk('an.defl.pref' + (q.k + 1))}</td>` : ''}<td>${f(q.d / q.lim, 2)}</td><td style="color:var(${ST[q.status][0]})">${ST[q.status][1]}</td></tr>`).join('')}</tbody></table>
      <p class="note">${O ? `Owner rule ${esc(O.cite)} (OWN19): ${esc(O.rule.text)}. Sidewalk or pedestrians: ${O.sw ? 'yes' : 'no'} (${O.swHow === 'cross-section sidewalks' ? 'Cross-section tab' : 'entered on the Loads tab (Analysis settings)'}), so L/${O.req}${O.uR > O.req ? `; the entered L/${O.uR} is stricter and is used` : ''}.` : 'Optional criterion (2.5.2.6.2): the L/… entered above.'} Truck axles that do not add to the deflection are neglected (3.6.1.3.1).</p>`); }
    if (R.seq) { const Q = R.seq, fd = Math.max(...Q.fdk);
      h += card('Deck placement sequence (SA7, 6.10.3.4.1)', `<p class="note">Pours in order: ${Q.pours.map((q, k) => `${k + 1}: ${f(q.a, 1)}–${f(q.b, 1)} ft`).join('; ')}. Largest noncomposite moment M<sub>DCc</sub> ${f(Math.max(...Q.MDCc), 1)} kip-ft ${wk('an.seq.MDCc')}
        (deck at once ${f(Math.max(...R.st.DC1.M), 1)}). Deck tension in hardened pours ${f(fd, 3)} ksi vs φf<sub>r</sub> ${f(Q.phifr, 3)} ksi ${wk('an.seq.fdk')}.</p>`); }
    // station table
    const cols = {
      M: [['M_DC1 steel', s.DC1steel.M], ['M_DC1 wet', s.DC1wet.M], ['M_DC1', s.DC1.M], ['M_DC2', s.DC2.M], ['M_DW', s.DW.M], ...(ll ? [['M_LL+IM max', ll.Mpos], ['M_LL+IM min', ll.Mneg], ['M_FAT max', ft.Mpos], ['M_FAT min', ft.Mneg], ['g_M', ll.gM, 3]] : []), ['M_CL', s.CL.M], ...(R.seq ? [['M_DCc', R.seq.MDCc]] : [])],
      V: [['V_DC1', Vr(s.DC1)], ['V_DC2', Vr(s.DC2)], ['V_DW', Vr(s.DW)], ...(ll ? [['V_LL+IM max', Vx(ll, 'pos')], ['V_LL+IM min', Vx(ll, 'neg')], ['V_FAT max', Vx(ft, 'pos')], ['V_FAT min', Vx(ft, 'neg')]] : []), ['V_CL', Vr(s.CL)]],
      D: [['Δ steel', R.camber.steel, 3], ['Δ wet deck', R.camber.wet, 3], ['Δ DC2 + DW', R.camber.sd, 3], ...(R.camber.ut ? [['Δ utilities', R.camber.ut, 3]] : []), ['Δ total (camber)', R.camber.total, 3]] }[view];
    const unit = { M: 'kip-ft', V: 'kip (just right of the station; at a support also just left, below; at the end just left)', D: 'in, downward +' }[view];
    const supSet = new Set(R.supIdx.slice(1, -1));
    h += card('Station table', `<div class="fRow"><label for="an_view">Show</label><select id="an_view"><option value="M"${view === 'M' ? ' selected' : ''}>Moments</option><option value="V"${view === 'V' ? ' selected' : ''}>Shears</option><option value="D"${view === 'D' ? ' selected' : ''}>Dead-load deflections</option></select><span class="unit">${unit}</span></div>
      <div class="tscroll" style="max-height:420px;overflow-y:auto"><table class="tbl"><thead><tr><th>x (ft)</th>${cols.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>
      ${x.map((v, i) => `<tr${R.region[i] >= 1 ? ' style="background:#F8FAFC"' : ''}><td>${f(v, 2)}</td>${cols.map(c => `<td>${f(c[1][i], c[2] || (view === 'D' ? 3 : 1))}</td>`).join('')}</tr>${view === 'V' && supSet.has(i) ? `<tr><td>${f(v, 2)} left</td>${[['V', s.DC1.VL], ['', s.DC2.VL], ['', s.DW.VL], ...(ll ? [['', ll.VLpos], ['', ll.VLneg], ['', ft.VLpos], ['', ft.VLneg]] : []), ['', s.CL.VL]].map(c => `<td>${f(c[1][i], 1)}</td>`).join('')}</tr>` : ''}`).join('')}
      </tbody></table></div><p class="note">Shaded rows: pier regions (negative permanent-load moment), where the pier g<sub>M</sub> and the 90 % two-truck case apply (3.6.1.3.1). Each key value is worked in the steps below.</p>`);
    h += card('Worked steps', `<p class="note">AASHTO LRFD 10th Ed. (2024). Moments and shears are stiffness-method results of the shared beam engine on the stiffness of each stage; their checks are the statics steps and, for LL+IM, the per-lane envelope × g.</p>${ST().groupsHTML(groups('x', R.steps), { open: OPEN, item: q => `<li id="st-${esc(q.id)}"${q.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(q.label)}${q.ref ? `<span class="ref">${esc(q.ref)}</span>` : ''}</div><div>${ST().line(q, true)}</div>${q.note ? `<div class="nt">${esc(q.note)}</div>` : ''}</li>` })}`);
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
  window.SBDAnalysisUI = { draw, srcBar, TOPICS, groups, inputs, onInputChange };
})();
