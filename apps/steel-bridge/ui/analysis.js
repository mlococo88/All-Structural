/* apps/steel-bridge/ui/analysis.js — the Analysis card of Steel Bridge Design (window.SBDAnalysisUI).
   Classic script. Needs window.SBDAnalysis (engine/analysis.js), SharedSteps, SharedUnits.
   draw(el, ctx): renders the analysis settings (written to the project: project.analysis, girder.loadsManual,
   girder.dfManual), the Calculate button, the diagrams (plain SVG), the station table, the reactions, the LL deflection
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

  /* ---------- settings ---------- */
  function settingsHtml(P, gi) {
    const S = AN().settings(P), g = P.girders[gi], Lm = g.loadsManual || {}, Dm = g.dfManual || {};
    const num = (scope, k, label, unit, v) => `<div class="fRow"><label for="an_${scope}_${k}">${label}</label><input type="number" step="any" id="an_${scope}_${k}" data-an="${scope}" data-k="${k}" value="${v == null || v === '' || Number.isNaN(v) ? '' : esc(v)}"><span class="unit">${unit}</span></div>`;
    const sel = (k, label, opts) => `<div class="fRow"><label for="an_a_${k}">${label}</label><select id="an_a_${k}" data-an="a" data-k="${k}">${opts.map(([v, t]) => `<option value="${v}"${String(S[k] == null ? '' : S[k]) === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
    const mod = g.loads && g.df ? null : AN().moduleOf(P, gi), LD = AN().loadsOf(P, g, mod), DF = AN().dfOf(P, g, P.spans.lengths.length, mod);
    const nb = P.xs ? Math.round(P.xs.nb) : 0, line = AN().lineOf(P, g);
    const lineSel = nb > 0 ? `<div class="fRow"><label for="an_g_line">Cross-section girder (loads, factors)</label><select id="an_g_line" data-an="g" data-k="line">${[...Array(nb)].map((_, j) => `<option value="${j}"${j === line ? ' selected' : ''}>G${j + 1}${j === 0 || j === nb - 1 ? ' (exterior)' : ''}</option>`).join('')}</select></div>` : '';
    return card('Analysis settings', `
      ${num('a', 'im', 'IM, truck and tandem', '% (Table 3.6.2.1-1)', S.im)}${num('a', 'imf', 'IM, fatigue truck', '%', S.imf)}
      ${sel('crack', 'Cracked zones (6.10.1.5)', [['none', 'None: deck effective over the whole length'], ['15', '15 % of the spans either side of each pier'], ['dl', 'Negative dead-load moment region']])}
      ${num('a', 'deflLimit', 'LL deflection limit L/', '(2.5.2.6.2)', S.deflLimit)}
      ${sel('seq', 'Deck placement sequence (6.10.3.4.1)', [['on', 'On'], ['off', 'Off']])}${sel('seqMod', 'Hardened pours act with', [['n', 'n'], ['3n', '3n']])}
      <div class="fRow"><label for="an_a_seqCustom">Pours (optional)</label><input type="text" id="an_a_seqCustom" data-an="a" data-k="seqCustom" value="${esc(S.seqCustom)}" style="width:180px"><span class="unit">ft, e.g. 0-80, 140-220 (blank: automatic)</span></div>
      ${num('a', 'steelAllowPct', 'Girder steel detail allowance', '%', S.steelAllowPct)}
      ${sel('haunchInStiffness', 'Haunch in the composite stiffness', [['', 'As the owner rule (OWN8)'], ['true', 'Yes'], ['false', 'No']])}`)
      + card(`Dead loads, girder ${esc(g.label || g.id)}`, `${lineSel}<p class="note">Source: <b>${esc(LD.source)}</b>${LD.src.DC2 === 'module' ? ' (worked on the Loads &amp; LLDF tab)' : ''}. The values entered below are used only where the loads module gives none; the construction live load and the cross-frame point loads are entered here (not in the loads module yet).</p>
      ${num('l', 'DC1wet', 'DC1 wet deck (deck, haunch, SIP, other)', 'klf', Lm.DC1wet)}${num('l', 'DC2', 'DC2 (barriers, curbs, …)', 'klf', Lm.DC2)}${num('l', 'DW', 'DW (wearing surface, utilities)', 'klf', Lm.DW)}
      ${num('l', 'CL', 'Construction live load', 'klf', Lm.CL)}${num('l', 'UT', 'Existing utilities (steel section)', 'klf', Lm.UT)}
      <div class="fRow"><label for="an_l_xf">Cross-frame point loads</label><input type="text" id="an_l_xf" data-an="l" data-k="xf" value="${esc((Lm.xf || []).map(q => `${q.x}:${q.P}`).join(', '))}" style="width:180px"><span class="unit">x:P (ft:kip), comma separated</span></div>`)
      + card(`Live load distribution factors, girder ${esc(g.label || g.id)}`, `<p class="note">Source: <b>${esc(DF.src)}</b> (lanes per girder, multiple presence included; fatigue: one lane ÷ 1.2, 3.6.1.4.3b). ${DF.manual ? 'One value for every span; blank = 1.' : 'Worked on the Loads &amp; LLDF tab; the values below are used only when the loads module gives none.'}</p>
      ${num('d', 'gM', 'g moment (spans)', '', Dm.gM)}${num('d', 'gMpier', 'g moment (pier regions)', 'blank = spans', Dm.gMpier)}${num('d', 'gV', 'g shear', '', Dm.gV)}
      ${num('d', 'fatM', 'g fatigue moment', '', Dm.fatM)}${num('d', 'fatV', 'g fatigue shear', '', Dm.fatV)}${num('d', 'gDef', 'g deflection (all lanes, all girders)', '', Dm.gDef)}`);
  }
  function onInput(e, ctx) {
    const el = e.target, sc = el.dataset.an, k = el.dataset.k; if (!sc) return;
    const P = ctx.P, g = P.girders[ctx.gi];
    if (sc === 'a') { P.analysis = P.analysis || {}; const v = el.value; P.analysis[k] = el.tagName === 'SELECT' ? (v === 'true' ? true : v === 'false' ? false : v === '' ? null : v) : k === 'seqCustom' ? v : (v === '' ? null : Number(v)); }
    else if (sc === 'g') { g.line = Number(el.value); }
    else if (sc === 'l') { g.loadsManual = g.loadsManual || {};
      if (k === 'xf') g.loadsManual.xf = el.value.split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => s.split(':').map(Number)).filter(q => q.length === 2 && q.every(isFinite)).map(([x, P_]) => ({ x, P: P_ }));
      else g.loadsManual[k] = el.value === '' ? null : Number(el.value); }
    else if (sc === 'd') { g.dfManual = g.dfManual || {}; g.dfManual[k] = el.value === '' ? null : Number(el.value); }
    ctx.changed();
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
    h += card('Diagrams', `${chart(x, Mser, { title: 'Moments (unfactored, per girder; LL+IM with g)', unit: 'kip-ft', sup })}${chart(x, Vser, { title: 'Shears (V = sum of forces to the left, up +)', unit: 'kip', sup })}
      ${chart(x, Dser, { title: 'Dead-load deflections (downward +, drawn down)', unit: 'in', sup, invert: true })}
      <p class="note">Stations: GirderDetail's grid, ${N} points. ${R.cont ? 'Continuous' : 'Simple spans'}; ${R.crack.length ? `cracked zones ${R.crack.map(([a, b]) => `${f(a, 1)}–${f(b, 1)} ft`).join(', ')} ${wk('an.crack')}` : 'no cracked zones'}. Engine: shared beam elements (stiffness method), loads applied exactly.</p>`, 'an-diag');
    // reactions
    const rr = (k, o) => o.R[k];
    h += card('Reactions (unfactored, kip)', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Support</th><th>DC1</th><th>DC2</th><th>DW</th><th>Constr. LL</th>${ll ? '<th>LL+IM max</th><th>LL+IM min</th>' : ''}</tr></thead><tbody>
      ${sup.map((v, k) => `<tr><td class="lft">${k === 0 ? 'Abut. 1' : k === sup.length - 1 ? 'Abut. 2' : 'Pier ' + k} (x = ${f(v, 1)})</td><td>${f(rr(k, s.DC1), 2)}</td><td>${f(rr(k, s.DC2), 2)}</td><td>${f(rr(k, s.DW), 2)}</td><td>${f(rr(k, s.CL), 2)}</td>
        ${ll ? `<td>${f(R.llR[k].max, 2)} ${wk('an.R.LL.' + k)}${R.llR[k].two ? ' *' : ''}</td><td>${f(R.llR[k].min, 2)}</td>` : ''}</tr>`).join('')}</tbody></table></div>
      <p class="note">${ll ? '* 90 % of two design trucks + lane governs (3.6.1.3.1; on simple spans the summed pier reaction, engineer\'s decision 2026-10-29). ' : ''}Statics: ${['DC1steel', 'DC1wet', 'DC2', 'DW', 'CL'].map(k => wk('an.eq.' + k, k)).join(', ')}.</p>`);
    if (R.lld) h += card('Live load deflection (SA3, 2.5.2.6.2)', `<table class="tbl"><thead><tr><th>Span</th><th>x (ft)</th><th>Δ<sub>LL</sub> (in)</th><th>L/${R.settings.deflLimit} (in)</th><th>Ratio</th><th></th></tr></thead><tbody>
      ${R.lld.map(q => `<tr><td>${q.k + 1}</td><td>${f(q.x, 1)}</td><td>${f(q.d, 3)} ${wk('an.defl.LL' + (q.k + 1))}</td><td>${f(q.lim, 3)}</td><td>${f(q.d / q.lim, 2)}</td><td style="color:var(${q.ok ? '--pass' : '--fail'})">${q.ok ? 'OK' : 'Exceeds'}</td></tr>`).join('')}</tbody></table>`);
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
    h += card('Worked steps', `<p class="note">AASHTO LRFD 10th Ed. (2024). Moments and shears are stiffness-method results of the shared beam engine on the stiffness of each stage; their checks are the statics steps and, for LL+IM, the per-lane envelope × g.</p><ol class="steps">${R.steps.map(q => `<li id="st-${esc(q.id)}"${q.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(q.label)}${q.ref ? `<span class="ref">${esc(q.ref)}</span>` : ''}</div><div>${ST().line(q, true)}</div>${q.note ? `<div class="nt">${esc(q.note)}</div>` : ''}</li>`).join('')}</ol>`);
    return h;
  }

  function draw(el, ctx) {
    const P = ctx.P, gi = Math.min(ctx.gi, P.girders.length - 1), key = keyOf(P, gi), stale = !res || resKey !== key;
    let h = `<div class="alert stale"${stale && !busy ? '' : ' hidden'}><span>${res ? 'Analysis results are out of date: inputs changed.' : 'The analysis has not been run.'} Live load takes a few seconds.</span><button type="button" class="primary" id="anCalc">Run analysis</button></div>`;
    if (busy) h += '<div class="alert">Calculating…</div>';
    h += `<p class="note">Girder <b>${esc(P.girders[gi].label || P.girders[gi].id)}</b> (choose the girder on the Girders &amp; plates tab). Unfactored effects per girder: DC1 (steel, then the wet deck) on the steel section, DC2 and DW on 3n, LL+IM on n (AASHTO LRFD 10th Ed. 4.6.2, 6.10.1.1.1, 6.10.1.5).</p>`;
    h += settingsHtml(P, gi);
    if (res && !stale) h += resultsHtml(res);
    el.innerHTML = h;
    el.oninput = null; el.onchange = e => { if (e.target.id === 'an_view') { view = e.target.value; draw(el, ctx); return; } onInput(e, ctx); };
    el.onclick = e => { if (e.target.id !== 'anCalc') return; busy = true; draw(el, ctx);
      setTimeout(() => { try { res = AN().analyzeGirder(P, gi); } catch (err) { res = { errors: [String(err && err.message || err)] }; } resKey = keyOf(P, gi); busy = false; draw(el, ctx); }, 30); };
  }
  window.SBDAnalysisUI = { draw };
})();
