/* apps/steel-bridge/ui/constructibility.js — the Constructibility output tab (window.SBDConstrUI): deck placement checks of the
   steel girder, AASHTO LRFD 10th Ed. Art. 6.10.3, from engine/constructibility.js. Classic script; needs SharedSteps, SharedUnits,
   SBDModel, SBDSections, SBDFlexure, SBDShear, SBDStiffeners, SBDAnalysis, SBDConstr.

   Demands: either
     - "This project": the girder's own analysis (engine/analysis.js, dead loads only: steel and wet deck M_DC1, V_DC1, the deck
       placement sequence M_DCc, the construction live load M_CL, V_CL; settings and loads on the Analysis tab); brace points from the
       cross-frame spacing and the stiffener panels from the Stiffeners tab; or
     - a hand-off file (schema stgirder-external-demands, GirderDetail → ST-Girder, with M_DCc and M_CL: S2-8): its stations.
   Overhang brackets (exterior girder): GirderDetail's Deck overhang module inputs, saved in the project (P.constr.oh) for the
   project source; the hand-off file brings its own stored bracket loads.
   f_ℓ during deck placement is saved in the project (P.constr.flC, ksi; added 2026-10-30, report wiring PR) and used by the Report tab.
   Since 2026-10-30 (paths PR, SB2-W1): blank or 0 (or absent) takes the skew value of C6.10.1 (1.25 × 10 / 7.5 ksi interior / exterior
   where a support is skewed more than 20°; before: 0), from engine/framing.js design(), the one source of the brace points and f_ℓ the
   Flexure and Rating tabs use too; brace points from the Framing tab (as before). build(ctx) is the tab's calculation without the page
   (the Report tab calls it). The demand source lives in memory for this page view (default: this project; the line at the top of the
   tab names the source in use).

   render(host, ctx): ctx = { P (project), g (girder index), changed() (an input written to the project) } */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const S = { src: null, pl: null, plName: '', R: null, key: '', sel: null, ohSel: 0, err: '', busy: false };
  const srcOf = () => S.src || 'project';   // src null: the default, this project (no example on this tab)
  const tt = t => esc(t).replace(/_\{?([A-Za-z0-9,]+)\}?/g, '<sub>$1</sub>');
  const cls = r => Number.isNaN(r) || r === Infinity ? 'cn-ng' : !isFinite(r) ? '' : r > 1 + 1e-9 ? 'cn-ng' : r >= 0.9 ? 'cn-hi' : 'cn-ok';
  /* SB2-R2: the ratio of a check as shown; a non-finite ratio that is not "not applicable" carries its reason (c.ng: NG or error) */
  const rtx = c => !c ? '—' : isFinite(c.ratio) ? fmt(c.ratio, 3) : c.ng ? (Number.isNaN(c.ratio) ? esc(c.ng) : `∞ (${esc(c.ng)})`) : '—';
  const OHF = [['a', 'Bracket horizontal projection a', 'in'], ['hb', 'Bracket vertical projection h<sub>b</sub>', 'in'], ['wOH', 'Deck width carried by the brackets', 'in'], ['tOH', 'Overhang deck thickness', 'in'],
    ['wc', 'w<sub>c</sub>', 'kcf'], ['qForm', 'Overhang forms', 'ksf'], ['wScreed', 'Screed rail', 'k/ft'], ['wRail', 'Railing', 'k/ft'], ['wWalk', 'Walkway', 'k/ft'], ['qCL', 'Construction LL', 'ksf'],
    ['bCL', 'Width with construction LL', 'in'], ['Pfm', 'Finishing machine (per bracket)', 'kip'], ['Rh', 'R<sub>h</sub> (overhang checks)', ''], ['Cb', 'C<sub>b</sub> (overhang checks)', '']];

  function css() {
    if (document.getElementById('cn-css')) return;
    const st = document.createElement('style'); st.id = 'cn-css';
    st.textContent = `.cn-ok{background:#e7f4ec;} .cn-hi{background:#fdf3d8;} .cn-ng{background:#fbe1dd;font-weight:600;} tr.cn-gov td:first-child{box-shadow:inset 4px 0 0 #b23a2a;}
      .cn-list{max-height:340px;overflow:auto;} .cn-list tr, tr[data-cnsel], td[data-cnsel], td[data-ohsel]{cursor:pointer;} .cn-na{color:#64748b;font-style:italic;}`;
    document.head.appendChild(st);
  }
  const ohInputs = P => ({ ...window.SBDConstr.OH_DEF, ...((P.constr && P.constr.oh) || {}) });
  const key = ctx => JSON.stringify([ctx.P, ctx.g, srcOf(), S.plName]);   // f_ℓ is in ctx.P (P.constr.flC)
  /* f_ℓ during deck placement entered (first order, ksi): saved in the project, P.constr.flC; absent, not a number or ≤ 0: none entered
     (the skew value of C6.10.1 is used: engine/framing.js design, SB2-W1) */
  const flOf = P => { const v = P.constr && +P.constr.flC; return isFinite(v) && v > 0 ? v : 0; };
  const flTxt = D => `f<sub>ℓ</sub> during deck placement ${D.flSrc === 'entered' ? `${fmt(D.fl, 2)} ksi as entered` : `from skew (C6.10.1; largest support skew ${fmt(D.flS.skMax, 1)}° ${D.flS.skMax > 20 + 1e-9 ? `&gt; 20°: γf<sub>ℓ,skew</sub> = ${esc(D.flS.steps[0].sub)} = ${fmt(D.fl, 2)} ksi` : '≤ 20°: 0'}; <a href="#" data-gotab="cf">Cross-frames tab</a>)`}`;

  /* build(ctx): the calculation without the page (the tab, the Report tab). ctx = { P, g, src: 'project' | 'file' (else the tab's own),
     pl (hand-off payload; else the tab's file), plName }. Brace points and f_ℓ: engine/framing.js design() (the Framing tab; f_ℓ entered,
     else from skew). Returns engine/constructibility.js girder() plus { what, ext, src, F (fromAnalysis / fromPayload), D (design) } or
     { err }. */
  function build(ctx) {
    const P = ctx.P, g = ctx.g || 0, C = window.SBDConstr, FRM = window.SBDFraming, src = ctx.src || (ctx.pl ? 'file' : srcOf()), pl = ctx.pl !== undefined ? ctx.pl : S.pl, plName = ctx.plName != null ? ctx.plName : S.plName;
    let F, what, D;
    if (src === 'file') {
      if (!pl) return { err: 'Choose a hand-off file (GirderDetail → ST-Girder demands, .json).' };
      const gdF = pl.girderDetail || {};
      D = FRM.design(P, g, { sup: (pl.member || {}).supports, line: (+gdF.girder || 1) - 1, skews: (gdF.skew || {}).bySupport || [0], ext: gdF.position === 'exterior', fl: flOf(P) });   // this bridge's framing (SB2-O9), skew f_ℓ (SB2-W1)
      F = C.fromPayload(pl, { flC: D.fl, ...(D.br ? { braces: D.braces } : {}) });
      what = `${esc(plName)}: ${F.locs.length} stations; plates and materials from the file; M<sub>DCc</sub>${F.locs.some(L => L.M.DCc !== 0) ? ' (GirderDetail\'s pour sequence)' : ' not in the file (M<sub>DC1</sub> used)'}, M<sub>CL</sub>, V<sub>DC1</sub>, V<sub>CL</sub> from the file; L<sub>b</sub> ${D.br ? "from this project's framing (Cross-frames tab)" : `from its cross-frame spacing ${fmt(F.Lb, 2)} ft`}; ${flTxt(D)}.`;
    } else {
      const AR = window.SBDAnalysis.analyzeGirder(P, g, { ll: false });
      if (AR.errors && AR.errors.length) return { err: 'Analysis: ' + AR.errors.join(' ') };
      D = FRM.design(P, g, { fl: flOf(P) });   // the project's framing (SB2-O9), f_ℓ entered or from skew (SB2-W1)
      F = C.fromAnalysis(P, g, AR, { flC: D.fl, oh: ohInputs(P), ...(D.br ? { braces: D.braces } : {}) }); F.AR = AR; F.frA = D.br;
      const gg = P.girders[g];
      what = `${esc(gg.label || gg.id)}: ${F.locs.length} locations from this project's analysis (dead loads; <a href="#" data-gotab="an">Analysis tab</a>): M<sub>DC1</sub>, V<sub>DC1</sub> (steel and the whole wet deck), `
        + (F.seq ? 'M<sub>DCc</sub> = the noncomposite envelope of the deck placement sequence (an.seq.MDCc)' : 'no pour sequence (simple spans, noncomposite, or the sequence off): M<sub>DC1</sub>')
        + `, construction live load M<sub>CL</sub>, V<sub>CL</sub>${AR.loads && AR.loads.CL ? ` (w = ${fmt(AR.loads.CL, 3)} klf)` : ' (not entered: 0)'}. Brace points: ${D.br ? "bearings and this girder's cross-frames from the Framing tab" : `bearings and cross-frames at most ${fmt(F.Lb, 2)} ft apart`}; stiffener panels from the Stiffeners tab; ${flTxt(D)}.`
        + (AR.warnings && AR.warnings.length ? `<br>${AR.warnings.map(esc).join('<br>')}` : '');
    }
    const R = C.girder(F.locs, F.prj, { supports: F.supports, oh: F.oh });
    return { ...R, what, ext: F.ext, src, F, D };
  }
  function calc(ctx) {
    S.err = ''; S.R = null; S.sel = null; S.ohSel = 0;
    try { const R = build(ctx); if (R.err) S.err = R.err; else { S.R = R; S.sel = R.gov ? R.rows.indexOf(R.gov) : 0; } }
    catch (e) { S.err = 'Calculation error: ' + (e && e.message); }
    S.key = key(ctx);
  }

  const stepsHtml = list => `<ol class="steps">${list.map(s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}</li>`).join('')}</ol>`;
  const ckRows = (checks, gov) => checks.map(c => `<tr${gov === c ? ' class="cn-gov"' : ''}><td class="lft">${esc(c.id)} ${tt(c.title)}</td><td>${fmt(c.demand, 2)} ${esc(c.unit)}</td><td>${fmt(c.capacity, 2)} ${esc(c.unit)}</td><td class="${cls(c.ratio)}">${rtx(c)}</td><td class="lft">${esc(c.ref.replace('AASHTO LRFD 10th Ed. ', ''))}</td><td><a class="wk" href="#st-${esc(c.step)}">§</a></td></tr>`).join('');
  const ckHead = '<thead><tr><th class="lft">Check</th><th>Demand</th><th>Capacity</th><th>Ratio</th><th class="lft">AASHTO LRFD 10th Ed.</th><th></th></tr></thead>';

  function render(host, ctx) {
    css();
    const P = ctx.P, g = P.girders[ctx.g] || P.girders[0], stale = !S.R || S.key !== key(ctx), ext = srcOf() === 'file' ? null : g.position === 'exterior', oh = ohInputs(P);
    const opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${t}</option>`;
    const AUI = window.SBDAnalysisUI, AN = window.SBDAnalysis;
    let h = (AUI && AUI.srcBar ? AUI.srcBar({ src: srcOf(), auto: !S.src, rd: AN && AN.ready ? AN.ready(P, P.girders[ctx.g] ? ctx.g : 0) : null, g: g.label || g.id, plName: S.plName }) : '')
      + `<section class="sec"><div class="secHead">Constructibility (deck placement): demands and options</div><div class="secBody">
      <div class="fRow"><label for="cn_src">Demands</label><select id="cn_src">${opt('project', 'This project (analysis, pour sequence)', srcOf())}${opt('file', 'Hand-off file (GirderDetail → ST-Girder)', srcOf())}</select></div>
      ${srcOf() === 'file' ? `<div class="fRow"><label for="cn_file">File</label><input type="file" id="cn_file" accept=".json,application/json"><span class="unit">${esc(S.plName)}</span></div>` : ''}
      <div class="fRow"><label for="cn_flC">f<sub>ℓ</sub> during deck placement (first order; blank or 0: from skew, C6.10.1)</label><input type="number" step="any" min="0" id="cn_flC" value="${flOf(P) || ''}" placeholder="${fmt(window.SBDFraming.design(P, ctx.g).fl, 2)} (skew)"><span class="unit">ksi (GS14, GS15; saved with the project)</span></div>
      <p class="note">M<sub>c</sub> = 1.25M<sub>DCc</sub> + 1.50M<sub>CL</sub> and V<sub>u</sub> = 1.25V<sub>DC1</sub> + 1.50V<sub>CL</sub> on the noncomposite steel section (AASHTO LRFD 10th Ed. 3.4.2.1, 6.10.3.4.1); φ<sub>f</sub> = φ<sub>v</sub> = 1.0.
      GS14: Eqs. 6.10.3.2.1-1, -2 (F<sub>nc</sub> from 6.10.8.2 with R<sub>b</sub> = 1.0); GS15: Eq. 6.10.3.2.1-3 and 6.10.3.2.2-1; GS16: Eq. 6.10.3.3-1.${ext ? ' Exterior girder: OH1–OH5 with the overhang bracket loads below (C6.10.3.4).' : ''} The demand source is not saved; f<sub>ℓ</sub> entered is.</p></div></section>`;
    if (ext) h += `<section class="sec"><div class="secHead">Overhang brackets, exterior girder (saved with the project)</div><div class="secBody">
      ${OHF.map(([k, l, u]) => `<div class="fRow"><label for="cn_oh_${k}">${l}</label><input type="number" step="any" id="cn_oh_${k}" data-oh="${k}" value="${esc(oh[k])}"><span class="unit">${u}</span></div>`).join('')}
      <div class="fRow"><label for="cn_oh_gdc">γ<sub>DC</sub> / γ construction</label><input type="number" step="any" id="cn_oh_gdc" data-ohg="dc" value="${esc(oh.gam.dc)}" style="width:70px"><input type="number" step="any" id="cn_oh_gcl" data-ohg="cl" value="${esc(oh.gam.cl)}" style="width:70px"><span class="unit"></span></div>
      <div class="fRow"><button type="button" id="cn_oh_fill" title="Deck width carried by the brackets, overhang deck thickness and w_c from the Cross-section &amp; loads and Materials &amp; deck tabs">Fill from cross-section</button><span class="unit">${(() => { const F = window.SBDConstr.ohFill(P, ctx.g); return F.err ? esc(F.err) : `from the cross-section: w<sub>OH</sub> ${fmt(F.vals.wOH, 2)} in, t<sub>OH</sub> ${fmt(F.vals.tOH, 2)} in, w<sub>c</sub> ${fmt(F.vals.wc, 3)} kcf <details style="display:inline"><summary class="wk">§ worked</summary>${stepsHtml(F.steps)}</details>`; })()}</span></div>
      <p class="note">GirderDetail's Deck overhang defaults (common planning values; confirm against the contractor's brackets and finishing machine). The deck weight is factored by γ<sub>DC</sub>, all other bracket loads by the construction factor. The deck slab and overhang design are not part of this app; only the girder's flange lateral bending is checked.</p></div></section>`;
    h += `<div class="alert stale"${stale ? '' : ' hidden'}><span>Constructibility results are out of date: inputs changed or nothing calculated yet.</span><button type="button" class="primary" id="cn_calc">Calculate</button></div>`;
    if (S.err && !stale) h += `<div class="alert err">${esc(S.err)}</div>`;
    else if (S.R && !stale) {
      const R = S.R, rows = R.rows, ga = R.govAll;
      const cell = o => !o ? '<td>—</td>' : o.row.checks && o.row.conC ? `<td class="${cls(o.ratio)}" data-cnsel="${rows.indexOf(o.row)}" title="${esc(o.check.id + ' ' + o.check.key + ' at ' + fmt(o.row.x, 2) + ' ft')}">${rtx(o.check)}<br><span class="cn-na">${fmt(o.row.x, 2)} ft</span></td>`
        : `<td class="${cls(o.ratio)}" data-ohsel="${R.oh.rows.indexOf(o.row)}">${rtx(o.check)}<br><span class="cn-na">${esc(o.check.id)}, ${fmt(o.row.x, 2)} ft</span></td>`;
      h += `<section class="sec"><div class="secHead">Constructibility results</div><div class="secBody"><p class="note">${R.what}</p>
        ${ga ? `<p>Governing: <b>${esc(ga.check.id)}</b> ${tt(ga.check.title)} at x = ${fmt(ga.row.x, 2)} ft: ratio <b class="${cls(ga.ratio)}">${rtx(ga.check)}</b>.</p>` : ''}
        ${R.oh && R.oh.errors && R.oh.errors.length ? `<div class="alert err">Overhang brackets: ${esc(R.oh.errors.join(' '))}</div>` : ''}
        <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Span</th><th>Top flange in compression (GS14, GS15 web)</th><th>Bottom flange in compression</th><th>Tension flange (GS15)</th><th>Shear (GS16)</th>${R.oh ? '<th>Overhang OH1–OH4</th><th>f<sub>ℓ</sub> ≤ 0.6F<sub>y</sub> (OH5)</th>' : ''}</tr></thead><tbody>
        ${R.spans.map(s => `<tr><td class="lft">${s.span}</td>${cell(s.top)}${cell(s.bot)}${cell(s.tens)}${cell(s.shear)}${R.oh ? cell(s.oh) + cell(s.ohfl) : ''}</tr>`).join('')}</tbody></table></div>
        <p class="note">Each cell: the largest ratio in the span and the station; click it for the checks and the worked steps.</p>
        <div class="tscroll cn-list"><table class="tbl"><thead><tr><th class="lft">Location</th><th>x (ft)</th><th>M<sub>c</sub> (kip-ft)</th><th>Flange in compression</th><th class="lft">Governing check</th><th>Ratio</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr data-cnsel="${i}" class="${i === S.sel ? 'sel' : ''}${r === R.gov ? ' cn-gov' : ''}"><td class="lft">${esc(r.name)}</td><td>${fmt(r.x, 2)}</td><td>${fmt(r.Mc, 1)}</td><td>${r.conC.lab}</td><td class="lft">${esc(r.gov.id)} ${tt(r.gov.title)}</td><td class="${cls(r.gov.ratio)}">${rtx(r.gov)}</td></tr>`).join('')}
        </tbody></table></div></div></section>`;
      const r = rows[S.sel] || rows[0];
      if (r) {
        h += `<section class="sec"><div class="secHead">${esc(r.name)}: deck placement checks</div><div class="secBody"><div class="tscroll"><table class="tbl">${ckHead}<tbody>${ckRows(r.checks, r.gov)}</tbody></table></div>
          <div class="kv"><div><span>M<sub>c</sub></span><span>${fmt(r.Mc, 1)} kip-ft <a class="wk" href="#st-cn.Mc">§</a></span></div><div><span>L<sub>b</sub> / C<sub>b</sub> (deck placement)</span><span>${fmt(r.LbC, 2)} ft / ${fmt(r.CbCu, 3)}${r.ltC.npr ? ` (nonprismatic, ${r.ltC.npr.kind === 'ge' ? '6.10.8.2.3c' : 'simplification'})` : ''} <a class="wk" href="#st-cn.Cb">§</a></span></div>
          <div><span>F<sub>nc</sub> (FLB / LTB)</span><span>${fmt(r.ltC.FLB, 2)} / ${fmt(r.ltC.LTB, 2)} ksi <a class="wk" href="#st-cn.Fnc">§</a></span></div><div><span>Panel</span><span>${r.do > 0 ? `d<sub>o</sub> = ${fmt(r.do, 1)} in${r.end ? ', end panel' : ''}` : 'unstiffened'}</span></div></div></div></section>
          <section class="sec"><div class="secHead">Worked steps, ${esc(r.name)}</div><div class="secBody"><p class="note">AASHTO LRFD 10th Ed. (2024); y up from the bottom of the steel; tension +. The steel section properties are worked on the Section properties tab (sec.s).</p>${stepsHtml(r.steps)}</div></section>`;
      }
      if (R.oh && !(R.oh.errors && R.oh.errors.length)) { const O = R.oh, q = O.rows[S.ohSel] || O.rows[0];
        h += `<section class="sec"><div class="secHead">Overhang brackets: flange lateral bending (exterior girder, OH1–OH5)</div><div class="secBody">
          <p class="note">One location per span: the largest 1.25M<sub>DC1</sub> + 1.5M<sub>CL</sub> (GirderDetail's placement), with its plates and deck-placement L<sub>b</sub>. w<sub>u</sub> = ${fmt(O.wu, 4)} kip/ft, F<sub>ℓ</sub> = ${fmt(O.Fl, 4)} kip/ft, P<sub>ℓ</sub> = ${fmt(O.Pl, 3)} kip <a class="wk" href="#st-oh.Fl">§</a>${O.given ? ' (as stored in the hand-off file)' : ''}.</p>
          <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Location</th><th>M<sub>u</sub> (kip-ft)</th><th>M<sub>ℓ</sub> (kip-in)</th><th class="lft">Governing</th><th>Ratio</th></tr></thead><tbody>
          ${O.rows.map((o, i) => `<tr data-ohsel="${i}" class="${i === S.ohSel ? 'sel' : ''}"><td class="lft">${esc(o.name)}</td><td>${fmt(o.Mu, 1)}</td><td>${fmt(o.Ml, 1)}</td><td class="lft">${esc(o.gov.id)}</td><td class="${cls(o.gov.ratio)}">${rtx(o.gov)}</td></tr>`).join('')}</tbody></table></div>
          ${q ? `<h4 class="sub">${esc(q.name)}</h4><div class="tscroll"><table class="tbl">${ckHead}<tbody>${ckRows(q.checks, q.gov)}</tbody></table></div>${stepsHtml(q.steps)}` : ''}</div></section>`; }
    }
    host.innerHTML = h;
    const on = (sel, ev, f) => host.querySelectorAll(sel).forEach(el => el.addEventListener(ev, f));
    const redraw = () => render(host, ctx);
    on('#cn_src', 'change', e => { S.src = e.target.value; redraw(); });
    on('#cn_flC', 'change', e => { const t = e.target.value, v = t === '' ? 0 : Number(t); if (!(isFinite(v) && v >= 0)) return; P.constr = P.constr || {}; if (v > 0) P.constr.flC = v; else delete P.constr.flC; if (ctx.changed) ctx.changed(); else redraw(); });
    on('[data-oh]', 'change', e => { const v = Number(e.target.value); if (!isFinite(v)) return; P.constr = P.constr || {}; P.constr.oh = { ...ohInputs(P), ...(P.constr.oh || {}), [e.target.dataset.oh]: v }; if (ctx.changed) ctx.changed(); else redraw(); });
    on('[data-ohg]', 'change', e => { const v = Number(e.target.value); if (!isFinite(v)) return; P.constr = P.constr || {}; const o = { ...ohInputs(P), ...(P.constr.oh || {}) }; o.gam = { ...o.gam, [e.target.dataset.ohg]: v }; P.constr.oh = o; if (ctx.changed) ctx.changed(); else redraw(); });
    on('#cn_calc', 'click', () => { calc(ctx); redraw(); });
    // "Fill from cross-section" (SB2-C2, GirderDetail XS11): with a confirmation, never automatic; the permanent barrier is not a bracket load
    on('#cn_oh_fill', 'click', () => { const F = window.SBDConstr.ohFill(P, ctx.g); if (F.err) { alert('Fill from cross-section\n\n' + F.err); return; }
      const cur = ohInputs(P), K = [['wOH', 'Deck width carried by the brackets', 'in', 2], ['tOH', 'Overhang deck thickness', 'in', 2], ['wc', 'w_c', 'kcf', 3]];
      if (!confirm(`Fill the overhang bracket inputs from the cross-section?\n\n${K.map(([k, l, u, d]) => `${l}: ${cur[k]} → ${fmt(F.vals[k], d)} ${u} (${F.why[k]})`).join('\n')}\n\nThe permanent barrier or railing is not a bracket load (placed after the deck forms are stripped).`)) return;
      P.constr = P.constr || {}; P.constr.oh = { ...cur, ...(P.constr.oh || {}), wOH: F.vals.wOH, tOH: F.vals.tOH, wc: F.vals.wc }; if (ctx.changed) ctx.changed(); else redraw(); });
    on('#cn_file', 'change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { try { const j = JSON.parse(String(rd.result)), pl = j.payload || j; if (!pl || pl._schema !== 'stgirder-external-demands' || !Array.isArray(pl.stations)) throw new Error('not a GirderDetail → ST-Girder hand-off file (schema stgirder-external-demands)');
        S.pl = pl; S.plName = f.name; S.err = ''; } catch (er) { S.pl = null; S.plName = ''; alert('Cannot read this file: ' + er.message); } redraw(); };
      rd.readAsText(f); });
    on('[data-cnsel]', 'click', e => { S.sel = +e.currentTarget.dataset.cnsel; redraw(); const t = host.querySelector('.cn-list tr.sel'); if (t) t.scrollIntoView({ block: 'nearest' }); });
    on('[data-ohsel]', 'click', e => { S.ohSel = +e.currentTarget.dataset.ohsel; redraw(); });
    on('[data-gotab]', 'click', e => { e.preventDefault(); const b = document.querySelector(`#tabBar [data-otab="${e.currentTarget.dataset.gotab}"]`); if (b) b.click(); });
  }

  window.SBDConstrUI = { render, build };
})();
