/* apps/steel-bridge/ui/splices.js — the "Splices" input tab and the "Field splices" output tab (window.SBDSplicesUI), from
   engine/splices.js (bolted field splices, AASHTO LRFD 10th Ed. 6.13.6.1). Classic script; needs SharedSteps, SharedUnits, SBDModel,
   SBDOwners, SBDSections, SBDStiffeners, SBDAnalysis, SBDSplices.

   Inputs (saved in the project, P.splices; engine/model.js): the field splice stations (every girder), the bolts, the edition of the
   design forces, the load factors and clearances, auto-design on or off, and entered plates per station (and girder).
   Output: for the girder chosen on the Girders tab, each splice: the demands at the splice from this project's analysis
   (engine/analysis.js; the Analysis tab), the auto-designed (or entered) plates and bolts, every check TF1–TF6, BF1–BF6, MT1, WS1–WS5,
   DT1–DT11 with its items, the drawing and the worked steps. Results are calculated on demand (Calculate): the auto-design tries about
   1,000 splices per station.

   render(host, ctx): ctx = { P (project), g (girder index), changed() (an input written to the project) } */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const SP = () => window.SBDSplices;
  const S = { R: null, key: '', sel: 0, err: '', open: {} };
  const tt = t => esc(t).replace(/_\{?([A-Za-z0-9,]+)\}?/g, '<sub>$1</sub>');
  const cls = (r, st) => st === 'fail' ? 'sp-ng' : st === 'warn' ? 'sp-hi' : st === 'adv' ? 'sp-adv' : !isFinite(r) ? '' : r >= 0.9 ? 'sp-hi' : 'sp-ok';
  const ST = { pass: 'OK', fail: 'NG', warn: 'warning', adv: 'advisory', na: 'n/a' };

  function ensure(P) { if (!P.splices) P.splices = window.SBDModel.defaultSplices(); return P; }
  /* the owner env: load factors (OWN6–OWN8) and the Owner standards minimum plate (OWN14 def.minPlate; GirderDetail's 3/8 in otherwise) */
  function envOf(P) {
    const OW = window.SBDOwners, own = P.ownerRules || { owner: 'AASHTO', eta: {} }, lf = OW ? OW.loadFactors(own.owner, own.eta, (P.xs && P.xs.nb) || 0) : null;
    const r = OW && own.owner && own.owner !== 'AASHTO' ? OW.rule(own.owner, 'def.minPlate') : null;
    return { owner: own.owner || 'AASHTO', lf, minPlate: r && +r.gvalue > 0 ? +r.gvalue : 0.375, minPlateCite: r ? OW.cite(r) : '' };
  }

  /* ---------- input tab ---------- */
  const PL_F = [['nl', 'lines'], ['g', 'g'], ['g0', 'g₀'], ['nr', 'rows'], ['s', 's'], ['ef', 'e_f'], ['ep', 'e_p'], ['bo', 'b_o'], ['to', 't_o'], ['bi', 'b_i'], ['ti', 't_i']];
  const WB_F = [['h', 'h'], ['t', 't'], ['nr', 'rows'], ['sv', 's_v'], ['nc', 'cols'], ['sh', 's_h'], ['ew', 'e_w'], ['ewp', 'e_wp']];
  function inputs(P, h) {
    ensure(P); const Q = P.splices, gr = Object.keys(window.SBDModel.GRADES).map(k => [k, k]);
    const yn = [['incl', 'Included'], ['excl', 'Neglected']];
    let s = h.card('Field splice stations (every girder)', `<div class="fRow"><label for="i_splx">Stations</label><input type="text" id="i_splx" data-kind="splx" value="${esc((Q.x || []).join(', '))}" style="width:200px"><span class="unit">ft from the left end, comma separated</span></div>
      <p class="note">AASHTO LRFD 6.13.6.1.1: at or near the points of permanent-load contraflexure in continuous spans. Each splice is designed for the section on each side (0.01 ft left and right of the station) and the demands of this project's analysis there.</p>`)
      + h.card('Design basis', `${h.sel('splices.code', 'Design forces', [['10', 'AASHTO LRFD 10th Ed. (P_fy, flange couple, V_r)'], ['8', '8th Ed. method (controlling / noncontrolling flange, V_uw)']])}
        ${h.sel('splices.auto', 'Plates and bolts', [['true', 'Auto-design each splice (fewest bolts, then least plate)'], ['false', 'Entered below (per station)']])}
        ${h.sel('splices.gP', 'Splice plate grade', [['', 'Same as the top flange'], ...gr])}${h.sel('splices.prs', 'Deck reinforcement in the negative couple', [['no', 'Not included (conservative)'], ['yes', 'Included, P_rs = F_yr A_r']])}`)
      + h.card('Bolts (6.13.2)', `${h.sel('splices.bolts.d', 'Diameter', [['0.875', '7/8 in'], ['1', '1 in'], ['1.125', '1 1/8 in']])}${h.sel('splices.bolts.gr', 'Grade', [['A325', 'A325 (F3125 Gr. 120)'], ['A490', 'A490 (F3125 Gr. 150)']])}
        ${h.sel('splices.bolts.thr', 'Threads', [['excl', 'Excluded from the shear planes'], ['incl', 'Included in the shear planes']])}${h.sel('splices.bolts.cls', 'Faying surface', [['B', 'Class B (K_s = 0.50)'], ['A', 'Class A (K_s = 0.30)']])}
        ${h.sel('splices.bolts.prep', 'Holes', [['drilled', 'Drilled or subpunched and reamed (R_p = 1.0)'], ['punched', 'Punched full size (R_p = 0.90)']])}${h.sel('splices.bolts.edge', 'Plate edges', [['cut', 'Rolled or gas cut'], ['sh', 'Sheared']])}
        ${h.num('splices.bolts.gap', 'Gap between girder ends', 'in')}${h.num('splices.bolts.minLines', 'Minimum bolt lines each side of the web', '')}${h.num('splices.bolts.c1', 'Wrench clearance C₁ (blank: AISC table)', 'in')}
        ${h.sel('splices.bolts.long', '0.83 long-joint reduction', [['flange', 'Flange bolts only'], ['both', 'Flange and web bolts']])}${h.sel('splices.bolts.eccS', 'Web eccentricity, strength', yn)}${h.sel('splices.bolts.eccV', 'Web eccentricity, slip', yn)}
        ${h.sel('splices.bolts.stitch', 'Stitch bolt limits (6.13.2.6.3)', [['req', 'Required'], ['adv', 'Advisory']])}`)
      + h.card('Load factors and clearances', `${[['dcMax', 'γ_DC max'], ['dcMin', 'γ_DC min'], ['dwMax', 'γ_DW max'], ['dwMin', 'γ_DW min'], ['llS', 'γ_LL Strength I'], ['llSv', 'γ_LL Service II'], ['fat', 'γ Fatigue I'], ['dc1C', 'γ_DC deck placement'], ['clC', 'γ construction LL']].map(([k, l]) => h.num(`splices.gam.${k}`, tt(l), '')).join('')}
        ${h.num('splices.clr.cw', 'Inner plate clearance to the web plate', 'in')}${h.num('splices.clr.cv', 'Web plate clearance to each flange', 'in')}
        <p class="note">AASHTO LRFD 10th Ed. Tables 3.4.1-1, 3.4.1-2 and 3.4.2.1; the owner's η and LL multiplier are applied on top (Cross-section &amp; loads tab).</p>`);
    if (Q.auto === false) {
      const rows = (Q.plates || []).map((q, i) => `<tr><td>${fmt(+q.x, 2)}${q.g != null ? `, G${+q.g + 1}` : ''}</td>${['top', 'bot'].map(k => PL_F.map(([f]) => `<td><input type="number" step="any" data-path="splices.plates.${i}.${k}.${f}" value="${esc((q[k] || {})[f])}"></td>`).join('')
        + `<td><select data-path="splices.plates.${i}.${k}.inner" data-kind="sel"><option value="true"${(q[k] || {}).inner ? ' selected' : ''}>yes</option><option value="false"${(q[k] || {}).inner ? '' : ' selected'}>no</option></select></td>`).join('')}${WB_F.map(([f]) => `<td><input type="number" step="any" data-path="splices.plates.${i}.web.${f}" value="${esc((q.web || {})[f])}"></td>`).join('')}<td><button type="button" data-spldel="${i}">×</button></td></tr>`).join('');
      s += h.card('Entered plates and bolts (per station)', `<p class="note">Use "Keep these plates" on the Field splices output tab to copy a design here, then edit it. A station without an entry is auto-designed. Inches; lines and rows each side of the web / joint.</p>
        <div class="tscroll"><table class="tbl"><thead><tr><th rowspan="2">x (ft)</th><th colspan="12">Top flange</th><th colspan="12">Bottom flange</th><th colspan="8">Web (each of 2 plates)</th><th rowspan="2"></th></tr>
        <tr>${[0, 1].map(() => PL_F.map(([, l]) => `<th>${tt(l)}</th>`).join('') + '<th>inner</th>').join('')}${WB_F.map(([, l]) => `<th>${tt(l)}</th>`).join('')}</tr></thead><tbody>${rows || '<tr><td colspan="34">None entered.</td></tr>'}</tbody></table></div>`);
    }
    return s;
  }
  function onChange(el, P) {
    if (el.dataset.kind !== 'splx') return false;
    ensure(P); P.splices.x = el.value.split(/[,;\s]+/).filter(Boolean).map(Number); return true;
  }
  function onClick(e, P) {
    const d = e.target.closest && e.target.closest('[data-spldel]'); if (!d) return false;
    ensure(P); P.splices.plates.splice(+d.dataset.spldel, 1); return true;
  }

  /* ---------- output tab ---------- */
  function css() {
    if (document.getElementById('sp-css')) return;
    const st = document.createElement('style'); st.id = 'sp-css';
    st.textContent = `.sp-ok{background:#e7f4ec;} .sp-hi{background:#fdf3d8;} .sp-adv{background:#eef4fb;} .sp-ng{background:#fbe1dd;font-weight:600;} tr.sp-sel{background:#eef4fb;} .sp-list tr[data-spsel]{cursor:pointer;}
      details.sp-ck{border-bottom:1px dotted var(--line);padding:2px 0;} details.sp-ck summary{cursor:pointer;font-family:var(--font-ui);font-size:9pt;} .sp-dwg{border:1px solid var(--line);margin:6px 0;padding:4px;background:#fff;}`;
    document.head.appendChild(st);
  }
  const key = ctx => JSON.stringify([ctx.P, ctx.g]);
  function calc(ctx) {
    S.err = ''; S.R = null;
    const P = ensure(ctx.P), g = ctx.g || 0, AN = window.SBDAnalysis;
    try {
      if (!(P.splices.x || []).length) { S.err = 'No field splice stations: enter them on the Splices tab.'; S.key = key(ctx); return; }
      const AR = AN.analyzeGirder(P, g);
      if (AR.errors && AR.errors.length) { S.err = 'Analysis: ' + AR.errors.join(' '); S.key = key(ctx); return; }
      const env = envOf(P), G = SP().girder(P, g, AR, { env });
      S.R = { ...G, AR, env, girder: P.girders[g] };
      S.sel = Math.min(S.sel, Math.max(0, G.list.length - 1));
    } catch (e) { S.err = 'Calculation error: ' + (e && e.message); }
    S.key = key(ctx);
  }
  const stepsHtml = list => `<ol class="steps">${list.map(s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}</li>`).join('')}</ol>`;
  /* the largest ratio among the strength checks (bolts, plates, web: TF1–TF5, BF1–BF5, WS1, WS2, WS4, WS5) */
  const strGov = CK => { let b = null; (CK || []).filter(c => /^(TF|BF)[1245]$|^WS[1245]$/.test(c.id)).forEach(c => c.items.forEach(it => { if (it.r != null && isFinite(it.r) && (!b || it.r > b.it.r)) b = { c, it }; })); return b; };
  const plTxt = F => `${F.nl} line${F.nl > 1 ? 's' : ''} each side × ${F.nr} rows; outer PL ${SP().frac(F.bo)} × ${SP().frac(F.to)}${F.inner ? `, 2 inner PL ${SP().frac(F.bi)} × ${SP().frac(F.ti)}` : ''}`;

  function render(host, ctx) {
    css();
    const P = ensure(ctx.P), g = P.girders[ctx.g] || P.girders[0], stale = !S.R || S.key !== key(ctx);
    let h = `<section class="sec"><div class="secHead">Field splices (bolted, AASHTO LRFD 10th Ed. 6.13.6.1)</div><div class="secBody">
      <p class="note">${esc(g.label || g.id)}: splices at ${(P.splices.x || []).map(x => fmt(x, 2) + ' ft').join(', ') || '(none entered)'} (Splices tab). Demands: this project's analysis (<a href="#" data-gotab="an">Analysis tab</a>), moments at the analysis station nearest the splice and shears the largest of the element containing it and its neighbours (GirderDetail's rule). Sections 0.01 ft each side; the smaller one (6.13.6.1.1) carries the design forces.</p></div></section>`;
    h += `<div class="alert stale"${stale ? '' : ' hidden'}><span>Splice results are out of date: inputs changed or nothing calculated yet. The auto-design takes a few seconds per splice.</span><button type="button" class="primary" id="sp_calc">Calculate</button></div>`;
    if (S.err && !stale) h += `<div class="alert err">${esc(S.err)}</div>`;
    else if (S.R && !stale) {
      const R = S.R;
      if (R.errors.length) h += `<div class="alert err">${R.errors.map(esc).join('<br>')}</div>`;
      h += `<section class="sec"><div class="secHead">Splices of ${esc(g.label || g.id)}</div><div class="secBody"><div class="tscroll"><table class="tbl sp-list"><thead><tr><th class="lft">Splice</th><th>Left / right (top, bottom)</th><th>Plates and bolts</th><th class="lft">Governing</th><th>Ratio</th><th class="lft">Largest strength ratio</th><th>Status</th></tr></thead><tbody>
        ${R.list.map((s, i) => { const fl = s.R && s.R.fl, gv = s.gov, bad = s.CK ? s.CK.filter(c => c.status === 'fail').length : 0;
          return `<tr data-spsel="${i}" class="${i === S.sel ? 'sp-sel' : ''}"><td class="lft">${esc(s.name)}</td><td>${s.p ? `${fmt(s.p.sec.L.topB, 2)}×${fmt(s.p.sec.L.topT, 3)}, ${fmt(s.p.sec.L.botB, 2)}×${fmt(s.p.sec.L.botT, 3)} / ${fmt(s.p.sec.R.topB, 2)}×${fmt(s.p.sec.R.topT, 3)}, ${fmt(s.p.sec.R.botB, 2)}×${fmt(s.p.sec.R.botT, 3)}` : ''}</td>
            <td>${fl ? `${s.own ? 'entered' : 'auto'}: ${fl.top.n + fl.bot.n + s.R.web.nw} bolts each side` : '—'}</td><td class="lft">${gv ? `${esc(gv.c.id)} ${esc(gv.it.loc)}` : s.R && s.R.errors.length ? esc(s.R.errors[0]) : ''}</td>
            <td class="${gv ? cls(gv.it.r, gv.it.st) : ''}">${gv ? fmt(gv.it.r, 3) : '—'}</td><td class="lft">${(q => q ? `${esc(q.c.id)} ${esc(q.it.loc)}: <span class="${cls(q.it.r, q.it.st)}">${fmt(q.it.r, 3)}</span>` : '—')(strGov(s.CK))}</td><td>${s.CK ? (bad ? `<b>${bad} check${bad > 1 ? 's' : ''} NG</b>` : 'OK') : 'input error'}</td></tr>`; }).join('')}</tbody></table></div>
        <p class="note">Click a splice for its checks, drawing and worked steps. Owner: ${esc(R.env.owner)}${R.env.minPlateCite ? `; minimum plate ${fmt(R.env.minPlate, 4)} in (${esc(R.env.minPlateCite)})` : ''}.</p></div></section>`;
      const s = R.list[S.sel];
      if (s) h += splice(s, R);
    }
    host.innerHTML = h;
    const on = (sel, ev, f) => host.querySelectorAll(sel).forEach(el => el.addEventListener(ev, f));
    const redraw = () => render(host, ctx);
    on('#sp_calc', 'click', () => { calc(ctx); redraw(); });
    on('[data-spsel]', 'click', e => { S.sel = +e.currentTarget.dataset.spsel; redraw(); });
    on('[data-gotab]', 'click', e => { e.preventDefault(); const b = document.querySelector(`#tabBar [data-otab="${e.currentTarget.dataset.gotab}"]`); if (b) b.click(); });
    on('#sp_keep', 'click', () => { const q = S.R && S.R.list[S.sel]; if (!q) return; const Q = P.splices, gi = ctx.g || 0;
      Q.plates = (Q.plates || []).filter(z => !(Math.abs(+z.x - q.x) < 1e-6 && (z.g == null || +z.g === gi)));
      Q.plates.push({ x: q.x, g: gi, top: { ...q.p.top }, bot: { ...q.p.bot }, web: { ...q.p.web } }); Q.auto = false; if (ctx.changed) ctx.changed(true); else redraw(); });
  }
  function splice(s, Rg) {
    const R = s.R, X = SP();
    let h = `<section class="sec"><div class="secHead">${esc(s.name)}: demands and design</div><div class="secBody">`;
    if (s.warn && s.warn.length) h += `<div class="alert">${s.warn.map(esc).join('<br>')}</div>`;
    const d = s.p.dem, dm = s.dm;
    h += `<div class="kv">${[['M<sub>DC1</sub>', d.MDC1, 'kip-ft'], ['M<sub>DC2</sub>', d.MDC2, 'kip-ft'], ['M<sub>DW</sub>', d.MDW, 'kip-ft'], ['M<sub>LL+IM</sub><sup>+</sup>', d.MLLp, 'kip-ft'], ['M<sub>LL+IM</sub><sup>−</sup>', d.MLLn, 'kip-ft'], ['M<sub>CL</sub>', d.MCL, 'kip-ft'],
      ['V<sub>DC1</sub>', d.VDC1, 'kip'], ['V<sub>DC2</sub>', d.VDC2, 'kip'], ['V<sub>DW</sub>', d.VDW, 'kip'], ['V<sub>LL+IM</sub>', d.VLL, 'kip'], ['V<sub>CL</sub>', d.VCL, 'kip'], ['ΔM<sub>fat</sub> +/−', `${fmt(d.dMp, 1)} / ${fmt(d.dMn, 1)}`, 'kip-ft']]
      .map(([k, v, u]) => `<div><span>${k}</span><span>${typeof v === 'number' ? fmt(v, 1) : v} ${u}</span></div>`).join('')}</div>
      <p class="note">Unfactored, per girder (LL+IM with the distribution factors); moments at the analysis station x = ${fmt(dm.xi, 2)} ft, shears the largest magnitude of elements ${dm.e} ± 1. ${d.ut ? `Utilities: M<sub>UT</sub> ${fmt(d.ut.MUT, 1)}, M<sub>UF</sub> ${fmt(d.ut.MUF, 1)} kip-ft.` : ''}</p>`;
    if (s.design) h += `<p class="note"><b>Auto-design${s.design.ok ? '' : ' (not every check passes)'}:</b> ${esc(s.design.msg)}</p>`;
    if (R && !R.errors.length) {
      h += `<p class="note">Top flange: ${plTxt(R.fl.top)}. Bottom flange: ${plTxt(R.fl.bot)}. Web: 2 PL ${X.frac(R.web.hw)} × ${X.frac(R.web.twp)}, ${R.web.nrw} rows × ${R.web.ncw} column${R.web.ncw > 1 ? 's' : ''} each side. Bolts ${X.frac(R.bolt.d)} in ${esc(s.p.bolts.gr)}; plates ${esc(s.p.sec.gP)}. <button type="button" id="sp_keep" title="Copy these plates and bolts to the Splices tab as entered values (auto-design off)">Keep these plates</button></p>`;
      const dw = X.svg(R); if (dw) h += `<div class="sp-dwg">${dw.flange}</div><div class="sp-dwg">${dw.web}</div><p class="note">Plan of the bottom flange splice (outer plate, bolt pattern) and elevation of the web splice; to scale.</p>`;
    } else if (R) h += `<div class="alert err">${R.errors.map(esc).join('<br>')}</div>`;
    h += '</div></section>';
    if (!s.CK) return h;
    h += `<section class="sec"><div class="secHead">${esc(s.name)}: checks</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th>ID</th><th class="lft">Check</th><th class="lft">Governing item</th><th>Ratio</th><th>Status</th><th class="lft">AASHTO LRFD 10th Ed.</th><th></th></tr></thead><tbody>
      ${s.CK.map(c => { const it = c.gov >= 0 ? c.items[c.gov] : null; return `<tr><td>${c.id}</td><td class="lft">${tt(c.title)}</td><td class="lft">${it ? esc(it.loc) : esc(c.naWhy || '')}</td><td class="${it ? cls(it.r, it.st) : ''}">${it && it.r != null ? fmt(it.r, 3) : '—'}</td><td>${ST[c.status]}</td><td class="lft">${esc(String(c.ref).replace('AASHTO LRFD 10th Ed. ', ''))}</td><td>${it ? `<a class="wk" href="#st-${esc(it.step)}">§</a>` : ''}</td></tr>`; }).join('')}</tbody></table></div>
      ${s.CK.map(c => `<details class="sp-ck"><summary>${c.id} ${tt(c.title)}: ${c.items.length} item${c.items.length === 1 ? '' : 's'}, ${ST[c.status]}</summary>${c.note ? `<p class="note">${tt(c.note)}</p>` : ''}
        <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Item</th><th>Demand</th><th>Resistance / limit</th><th>Ratio</th><th>Status</th><th></th></tr></thead><tbody>${c.items.map(it => `<tr><td class="lft">${esc(it.loc)}</td><td>${it.dem != null ? fmt(it.dem, 2) : ''} ${esc(it.unit || '')}</td><td>${it.cap != null ? fmt(it.cap, 2) : ''} ${esc(it.unit || '')}</td><td class="${cls(it.r, it.st)}">${it.r != null ? fmt(it.r, 3) : '—'}</td><td>${ST[it.st]}</td><td><a class="wk" href="#st-${esc(it.step)}">§</a></td></tr>`).join('')}</tbody></table></div></details>`).join('')}
      <p class="note">Advisory items (MT1, TF3/BF3 under the 10th Ed.): the excess moment goes to the web splice (WS1, WS3, WS5) instead of failing the splice.</p></div></section>`;
    h += `<section class="sec"><div class="secHead">Worked steps, ${esc(s.name)}</div><div class="secBody"><p class="note">AASHTO LRFD 10th Ed. (2024); y up from the bottom of the steel; tension +. The analysis moments and shears are worked on the Analysis tab.</p>${stepsHtml(X.steps(R).concat(s.CK.steps))}</div></section>`;
    return h;
  }

  window.SBDSplicesUI = { ensure, inputs, onChange, onClick, render, envOf };
})();
