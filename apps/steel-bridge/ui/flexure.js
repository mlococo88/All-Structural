/* apps/steel-bridge/ui/flexure.js — the Flexure output tab (window.SBDFlexureUI): girder flexure, Strength I and Service II,
   at every location, from engine/flexure.js. Classic script; needs SharedSteps, SharedUnits, SBDSections, SBDFlexure.

   Demands: one of
     - "This project's analysis" (added 2026-10-30, report wiring PR; the default when the project is complete, SBDAnalysis.ready):
       engine/analysis.js for this girder at every analysis station, put in the shape of a hand-off by ui/rating.js fromAnalysis, with
       the project's plates, deck, materials and the stiffener layout's cross-frames (L_b), exactly as the Rating tab takes its flexure
       capacities (tests/engine/report-wiring.test.mjs: equal);
     - "Example" (the default while the project is not complete): GirderDetail's built-in Girder section moments at two locations
       (max. positive in span 1, pier 1), on the selected girder of this project (its plates at those stations, its deck and materials); or
     - a hand-off file (schema stgirder-external-demands, GirderDetail → ST-Girder): its stations, plates and deck, every
       station GirderDetail's "Check at any location" checks.
   Brace points (L_b, C_b) and f_ℓ (added 2026-10-30, paths PR; engineer's decisions SB2-W1, SB2-W2): one source for every path,
   engine/framing.js design(): the brace points of the Framing tab (the girder's bearings and cross-frames; a project without framing keeps
   the stiffener layout's cross-frames, a file of another bridge its own spacing), and f_ℓ as entered on this tab (saved in the project,
   P.flexure.fl) or else from skew (C6.10.1: 1.25 × 10 / 7.5 ksi interior / exterior where a support is skewed more than 20°). The Rating tab
   takes its flexure from build() here, and the Constructibility tab the same brace points and skew f_ℓ (its own entry, P.constr.flC).
   Before, the analysis path took the stiffener layout's cross-frames and f_ℓ = 0 unless entered (the file path: framing and skew f_ℓ).
   The demand source and the other choices live in memory for this page view; f_ℓ entered is saved with the project.

   render(host, ctx): ctx = { P (project), g (girder index), changed() (f_ℓ entered, written to the project) } */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { src: null, pl: null, plName: '', Lb: 20, Cb: 1, flT: 0, skew: 0, method: 'auto', R: null, key: '', sel: null, err: '' };
  /* f_ℓ entered for the girder design (ksi; saved in the project, P.flexure.fl; 0 or blank: none, the skew value is used) */
  const flEntered = P => { const v = +((P && P.flexure) || {}).fl; return isFinite(v) && v > 0 ? v : 0; };
  /* the sentence that states f_ℓ and where it comes from (equation, values, result: C6.10.1, engine/framing.js flSkew) */
  const flText = D => D.flSrc === 'entered' ? `f<sub>ℓ</sub> = ${fmt(D.fl, 2)} ksi as entered on the Flexure tab`
    : `f<sub>ℓ</sub> from skew (C6.10.1, in lieu of a refined analysis): largest support skew ${fmt(D.flS.skMax, 1)}° ${D.flS.skMax > 20 + 1e-9 ? `&gt; 20°: f<sub>ℓ</sub> = γf<sub>ℓ,skew</sub> = ${esc(D.flS.steps[0].sub)} = ${fmt(D.fl, 2)} ksi` : '≤ 20°: f<sub>ℓ</sub> = 0'} (worked on the <a href="#" data-gotab="cf">Cross-frames tab</a>)`;
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  /* the demand source: the one chosen (S.src), else the default: this project's analysis when the project is complete, else the example */
  const rdOf = ctx => (window.SBDAnalysis && window.SBDAnalysis.ready ? window.SBDAnalysis.ready(ctx.P, ctx.P.girders[ctx.g] ? ctx.g : 0) : { ok: false, why: ['The analysis module is not loaded.'] });
  const srcOf = ctx => S.src || (rdOf(ctx).ok ? 'analysis' : 'example');
  // GirderDetail's built-in Girder section rows (GM.gs.def.rows), unfactored, kip-ft
  const EX = [{ name: 'Span 1, max. positive moment', x: 44, region: 'pos', M: { DC1: 1450, DC2: 210, DW: 240, LLp: 1650, LLn: -400, UT: 0, UF: 0, FATp: 620, FATn: -150 } },
    { name: 'Pier 1', x: 109.99, region: 'neg', M: { DC1: -2300, DC2: -330, DW: -380, LLp: 250, LLn: -2400, UT: 0, UF: 0, FATp: 120, FATn: -520 } }];

  function css() {
    if (document.getElementById('fx-css')) return;
    const st = document.createElement('style'); st.id = 'fx-css';
    st.textContent = `.fx-ok{background:#e7f4ec;} .fx-hi{background:#fdf3d8;} .fx-ng{background:#fbe1dd;font-weight:600;} tr.fx-gov td:first-child{box-shadow:inset 4px 0 0 #b23a2a;}
      .fx-list{max-height:340px;overflow:auto;} .fx-list tr{cursor:pointer;} .fx-na{color:#64748b;font-style:italic;}`;
    document.head.appendChild(st);
  }
  const tt = t => esc(t).replace(/_\{?([A-Za-z0-9]+)\}?/g, '<sub>$1</sub>');   // check titles: f_bu -> f<sub>bu</sub>
  const cls = r => Number.isNaN(r) || r === Infinity ? 'fx-ng' : !isFinite(r) ? '' : r > 1 + 1e-9 ? 'fx-ng' : r >= 0.9 ? 'fx-hi' : 'fx-ok';
  /* SB2-R2: the ratio of a check as shown; a non-finite ratio that is not "not applicable" carries its reason (c.ng: NG or error) */
  const rtx = c => !c ? '—' : isFinite(c.ratio) ? fmt(c.ratio, 3) : c.ng ? (Number.isNaN(c.ratio) ? esc(c.ng) : `∞ (${esc(c.ng)})`) : '—';

  function inputs(ctx) {
    const P = ctx.P, M = window.SBDModel, G = M.GRADES, m = P.materials, d = P.deck, g = P.girders[ctx.g] || P.girders[0], SEC = window.SBDSections, FX = window.SBDFlexure;
    // ctx.src / ctx.pl / ctx.plName / ctx.fl / ctx.method: the caller's choices (the Report tab, build()), else the tab's own (S)
    const src = ctx.src || srcOf(ctx), plIn = ctx.pl !== undefined ? ctx.pl : S.pl, plName = ctx.plName != null ? ctx.plName : S.plName, flIn = ctx.fl != null ? ctx.fl : flEntered(P), meth = ctx.method || S.method;
    if (src === 'file') {
      if (!plIn) return { err: 'Choose a hand-off file (GirderDetail → ST-Girder demands, .json).' };
      // brace points: this project's framing when the file is of this bridge (its supports), girder = the file's girder (SB2-O9); else every ≤ L_b
      // f_ℓ: the value entered, else from the file's skews as GirderDetail takes it (C6.10.1: 1.25 × 10 / 7.5 ksi where a support is skewed > 20°)
      const pl = plIn, gd = pl.girderDetail || {}, FRM = window.SBDFraming;
      const D = FRM.design(P, ctx.g, { sup: (pl.member || {}).supports, line: (+gd.girder || 1) - 1, skews: (gd.skew || {}).bySupport || [0], ext: gd.position === 'exterior', fl: flIn }), frB = D.br, fl = D.fl;
      const F = FX.fromPayload(pl, { fl, ...(frB ? { braces: frB.braces, lenOf: frB.lenOf } : {}) });   // the payload's haunch as stated (the file does not say its owner)
      F.prj.a6.method = meth;
      return { prj: F.prj, locs: F.locs, supports: F.supports, fl, flS: D.flS, frB, D, what: `${esc(plName)}: ${F.locs.length} stations (every station GirderDetail checks); plates, deck and skews from the file; L<sub>b</sub>, C<sub>b</sub> ${frB ? `from this project's framing, girder G${frB.line + 1} (its own bearings and cross-frames; Cross-frames tab)` : `from its cross-frame spacing ${fmt(F.Lb, 2)} ft (the file is not of this project's bridge, or the project has no framing)`}; ${flText(D)}.` };
    }
    if (src === 'analysis') {
      // as ui/rating.js build() with this app's analysis (the Rating tab's flexure capacities): the same payload, options and project overrides
      const RUI = window.SBDRatingUI, RT = window.SBDRating, OW = window.SBDOwners, gi = P.girders[ctx.g] ? ctx.g : 0;
      if (!RUI || !RUI.fromAnalysis) return { err: 'ui/rating.js is not loaded (it puts the analysis in the shape of a hand-off).' };
      const A = ctx.an || RUI.fromAnalysis(P, gi); if (A.err) return { err: A.err };   // ctx.an: the caller's fromAnalysis (the Rating tab: one analysis)
      const plR = RT ? RT.noDoublePL(A.pl) : A.pl, sup = (plR.member || {}).supports || [], own = (P.ownerRules || {}).owner || 'AASHTO';
      // brace points and f_ℓ: engine/framing.js design() (SB2-W1, SB2-W2): the Framing tab, f_ℓ entered or from skew
      const D = window.SBDFraming.design(P, gi, { fl: flIn }), fopt = { owner: own, rebar: d.rebar, fl: D.fl };
      let bTxt;
      if (D.br) { fopt.braces = D.braces; fopt.lenOf = D.lenOf; bTxt = `the Framing tab: G${D.br.line + 1}'s bearings and cross-frames (${D.braces.length} brace points; Cross-frames tab)`; }
      else { const fr = ((P.stiffeners || {}).layout || {}).frames || {};   // no framing (Framing tab) or its layout has errors: the stiffener layout's cross-frames, as before
        if (Array.isArray(fr.at) && fr.at.length) fopt.braces = [...new Set([...sup, ...fr.at.map(Number)])].sort((a, b) => a - b); else fopt.Lb = +fr.Lb || 25;
        bTxt = `the cross-frames of the stiffener layout (the project has no framing on the Framing tab, or its layout has errors: ${fopt.braces ? `${fopt.braces.length} brace points` : `L<sub>b</sub> = ${fmt(fopt.Lb, 2)} ft`})`; }
      const F = FX.fromPayload(plR, fopt), lf = OW.loadFactors(own, (P.ownerRules || {}).eta, (P.xs || {}).nb);
      F.prj.mat = { Fyt: G[m.steel.top].Fy, Fyb: G[m.steel.bot].Fy, Fyw: G[m.steel.web].Fy, Fyr: m.rebar.Fyr, fc: m.concrete.fc };
      F.prj.deck = { composite: d.composite !== false, ts: d.ts, tdeck: d.tdeck, haunch: OW.haunchInProps(d.haunch, lf), rebar: d.rebar };
      F.prj.n = SEC.modularRatio(m.concrete.fc, m.concrete.wcE > 0 ? m.concrete.wcE : m.concrete.wc, m.concrete.K1, m.concrete.nRule).n;
      F.prj.rebarInPositive = !!d.rebarInPositiveMp;
      F.prj.a6.method = meth;
      const AR = A.R;
      return { prj: F.prj, locs: F.locs, supports: F.supports, fl: D.fl, flS: D.flS, frB: D.br, D,
        what: `This project's analysis of ${esc(P.girders[gi].label || P.girders[gi].id)} (Analysis tab: settings, loads, factors): ${F.locs.length} locations on ${plR.stations.length} stations, ${sup.length - 1} span(s); the project's plates, deck and materials; L<sub>b</sub>, C<sub>b</sub> from ${bTxt}; ${flText(D)}. The same locations and capacities as the Rating tab.${AR && AR.warnings && AR.warnings.length ? '<br>' + AR.warnings.map(esc).join('<br>') : ''}` };
    }
    // owner rules as the Section properties tab (index.html calc()): OWN8 haunch 0 in the section properties, OWN17 w_c for E_c
    const OW = window.SBDOwners, own = P.ownerRules || {}, lf = OW ? OW.loadFactors(own.owner, own.eta, P.xs && P.xs.nb) : null, hP = OW ? OW.haunchInProps(d.haunch, lf) : d.haunch;
    const nr = SEC.modularRatio(m.concrete.fc, m.concrete.wcE > 0 ? m.concrete.wcE : m.concrete.wc, m.concrete.K1, m.concrete.nRule);
    const nc = d.composite === false;   // noncomposite: 6.10.8 / App. A6 in both regions, steel section alone (engine/flexure.js)
    const prj = { deck: { composite: !nc, ts: d.ts, tdeck: d.tdeck, haunch: hP, rebar: d.rebar }, mat: { Fyt: G[m.steel.top].Fy, Fyb: G[m.steel.bot].Fy, Fyw: G[m.steel.web].Fy, Fyr: m.rebar.Fyr, fc: m.concrete.fc },
      n: nr.n, rebarInPositive: !!d.rebarInPositiveMp, G: FX.factors(), a6: { method: S.method, skews: [S.skew], curved: false } };
    const segAt = x => g.segments.find(s => x >= s.x0 && x < s.x1) || g.segments[g.segments.length - 1];
    const DX = window.SBDFraming.design(P, ctx.g, { fl: flIn });   // f_ℓ entered, else from the project's skews (SB2-W1); L_b, C_b as entered here
    const cont = P.spans.continuity === 'continuous' && P.spans.lengths.length > 1;
    const locs = EX.filter(e => cont || e.region === 'pos').map(e => { const s = segAt(e.x); return { name: e.name, x: e.x, region: e.region, cont, plates: { D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }, beff: g.beff, Lb: S.Lb, Cb: S.Cb, fl: DX.fl, flT: nc ? S.flT : 0, M: e.M }; });
    return { prj, locs, supports: null, fl: DX.fl, flS: DX.flS, frB: null, D: DX, what: `Example demands: GirderDetail's built-in Girder section moments, on ${esc(g.label || g.id)} (its plates at x = 44 and 109.99 ft). L<sub>b</sub> = ${fmt(S.Lb, 2)} ft, C<sub>b</sub> = ${fmt(S.Cb, 2)} as entered; ${flText(DX)}.`
      + (lf && lf.h0 && !nc ? ` Haunch taken as 0 in the section properties (${esc(lf.cite.h)}; owner rule OWN8), as on the Section properties tab.` : '')
      + (nc ? ' <b>Noncomposite girder:</b> every load on the steel section alone, no deck rebar; 6.10.8 or App. A6 (6.10.6.2.3) in both regions, top flange in compression in positive flexure; Service II Eq. 6.10.4.2.2-3.' : '') };
  }
  function calc(ctx) {
    S.err = ''; S.R = null;
    const I = inputs(ctx); if (I.err) { S.err = I.err; return; }
    try { const R = window.SBDFlexure.girder(I.locs, I.prj, { supports: I.supports }); S.R = { ...R, what: I.what }; S.sel = R.gov ? R.rows.indexOf(R.gov) : 0; }
    catch (e) { S.err = 'Calculation error: ' + (e && e.message); }
    S.key = key(ctx);
  }
  const key = ctx => JSON.stringify([ctx.P, ctx.g, srcOf(ctx), S.plName, S.Lb, S.Cb, S.flT, S.skew, S.method]);   // f_ℓ entered is in ctx.P (P.flexure.fl)
  /* build(ctx): the tab's calculation without the page (the Report tab, the Rating tab): ctx = { P, g, src, pl, plName, fl, method, an }
     (each optional, else the tab's own choice; fl: an f_ℓ to use instead of the project's entry; an: ui/rating.js fromAnalysis(P, g),
     already run); returns engine/flexure.js girder() { rows, gov, … } plus { prj, what, fl, flS, frB, D (engine/framing.js design) } or
     { err }. */
  function build(ctx) {
    const I = inputs(ctx); if (I.err) return { err: I.err };
    return { ...window.SBDFlexure.girder(I.locs, I.prj, { supports: I.supports }), prj: I.prj, what: I.what, fl: I.fl, flS: I.flS, frB: I.frB, D: I.D };
  }

  function render(host, ctx) {
    css();
    const stale = !S.R || S.key !== key(ctx), src = srcOf(ctx), rd = rdOf(ctx);
    const nc = ctx.P.deck.composite === false && src === 'example';
    const opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${t}</option>`;
    const AUI = window.SBDAnalysisUI, gl = ctx.P.girders[ctx.g] || ctx.P.girders[0] || {};
    let h = (AUI && AUI.srcBar ? AUI.srcBar({ src, auto: !S.src, rd, g: gl.label || gl.id, plName: S.plName, example: 'GirderDetail built-in moments at two locations' }) : '')
      + `<section class="sec"><div class="secHead">Flexure: demands and options</div><div class="secBody">
      <div class="fRow"><label for="fx_src">Demands</label><select id="fx_src">${opt('analysis', 'This project\'s analysis (Analysis tab)', src)}${opt('example', 'Example (GirderDetail built-in moments)', src)}${opt('file', 'Hand-off file (GirderDetail → ST-Girder)', src)}</select></div>
      ${src === 'file' ? `<div class="fRow"><label for="fx_file">File</label><input type="file" id="fx_file" accept=".json,application/json"><span class="unit">${esc(S.plName)}</span></div>`
        : src === 'analysis' ? '' : `<div class="fRow"><label for="fx_Lb">L<sub>b</sub>, ${nc ? 'both flanges' : 'bottom flange'}</label><input type="number" step="any" id="fx_Lb" value="${S.Lb}"><span class="unit">ft</span></div>
           <div class="fRow"><label for="fx_Cb">C<sub>b</sub></label><input type="number" step="any" id="fx_Cb" value="${S.Cb}"><span class="unit"></span></div>
           <div class="fRow"><label for="fx_skew">Largest support skew</label><input type="number" step="any" id="fx_skew" value="${S.skew}"><span class="unit">° (6.10.6.2.3)</span></div>`}
      <div class="fRow"><label for="fx_fl">f<sub>ℓ</sub>, discretely braced flange (first order; blank or 0: from skew, C6.10.1; also used by the Rating tab; saved)</label><input type="number" step="any" min="0" id="fx_fl" value="${flEntered(ctx.P) || ''}" placeholder="${fmt(window.SBDFraming.design(ctx.P, ctx.g).fl, 2)} (skew)"><span class="unit">ksi</span></div>
      ${nc ? `<div class="fRow"><label for="fx_flT">f<sub>ℓ</sub>, top flange (first order)</label><input type="number" step="any" id="fx_flT" value="${S.flT}"><span class="unit">ksi (noncomposite)</span></div>` : ''}
      <div class="fRow"><label for="fx_m">${nc ? 'Flexure (noncomposite)' : 'Negative flexure'}</label><select id="fx_m">${opt('auto', 'Appendix A6 where permitted, else 6.10.8', S.method)}${opt('6108', '6.10.8 only', S.method)}</select></div>
      <p class="note">Load factors AASHTO LRFD 10th Ed. Tables 3.4.1-1, -2: Strength I γ<sub>DC</sub> 1.25/0.90, γ<sub>DW</sub> 1.50/0.65 by the sign of each moment, LL+IM 1.75; Service II 1.30; Fatigue I 1.75. φ<sub>f</sub> = 1.0. Choices here are not saved.</p>
      <p class="note">Constructibility (deck placement, 6.10.3: GS14–GS16, overhang brackets OH1–OH5) is checked with the construction-stage loads on the <a href="#" data-gotab="cn">Constructibility tab</a>.</p></div></section>`;
    h += `<div class="alert stale"${stale ? '' : ' hidden'}><span>Flexure results are out of date: inputs changed or nothing calculated yet.</span><button type="button" class="primary" id="fx_calc">Calculate</button></div>`;
    if (S.err && !stale) h += `<div class="alert err">${esc(S.err)}</div>`;
    else if (S.R && !stale) {
      const R = S.R, rows = R.rows, gv = R.gov;
      h += `<section class="sec"><div class="secHead">Flexure results by location</div><div class="secBody"><p class="note">${R.what}</p>
        ${gv ? `<p>Governing: <b>${esc(gv.name)}</b>${gv.x != null ? ` (x = ${fmt(gv.x, 2)} ft)` : ''}, ${esc(gv.gov.id)} ${tt(gv.gov.title)}: ratio <b>${rtx(gv.gov)}</b>.</p>` : ''}
        ${R.oos ? '<div class="alert">A positive-flexure location has its plastic neutral axis below the web (outside Table D6.1-1): GS5 and GS6 are not reported for that span.</div>' : ''}
        <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Location</th><th>x (ft)</th><th>Region</th><th>Method (6.10.8 / A6)</th><th class="lft">Governing check</th><th>Ratio</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr data-fx="${i}" class="${i === S.sel ? 'sel' : ''}${r === gv ? ' fx-gov' : ''}"><td class="lft">${esc(r.name)}</td><td>${r.x != null ? fmt(r.x, 2) : ''}</td><td>${r.pos ? 'positive' : 'negative'}</td>
          <td>${r.p7 ? '' : r.useA6 ? 'App. A6' : '6.10.8'}</td><td class="lft">${r.gov ? esc(r.gov.id) + ' ' + tt(r.gov.title) : ''}</td><td class="${r.gov ? cls(r.gov.ratio) : ''}">${r.gov ? rtx(r.gov) : '—'}</td></tr>`).join('')}
        </tbody></table></div></div></section>`;
      const r = rows[S.sel] || rows[0];
      if (r) {
        h += `<section class="sec"><div class="secHead">${esc(r.name)}${r.x != null ? `, x = ${fmt(r.x, 2)} ft` : ''}: checks</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Check</th><th>Demand</th><th>Capacity</th><th>Ratio</th><th class="lft">AASHTO LRFD 10th Ed.</th><th></th></tr></thead><tbody>
          ${r.checks.map(c => isFinite(c.ratio) || c.ng ? `<tr${r.gov === c ? ' class="fx-gov"' : ''}><td class="lft">${esc(c.id)} ${tt(c.title)}${c.inUse ? '' : ' <span class="fx-na">(not the method in use)</span>'}</td><td>${fmt(c.demand, 2)} ${esc(c.unit)}</td><td>${fmt(c.capacity, 2)} ${esc(c.unit)}</td><td class="${c.inUse || c.ng ? cls(c.ratio) : ''}">${rtx(c)}</td><td class="lft">${esc(c.ref.replace('AASHTO LRFD 10th Ed. ', ''))}</td><td><a class="wk" href="#st-${esc(c.step)}">§</a></td></tr>`
            : `<tr><td class="lft">${esc(c.id)} ${tt(c.title)}</td><td colspan="3" class="lft fx-na">${esc(c.na || '')}</td><td class="lft">${esc(c.ref.replace('AASHTO LRFD 10th Ed. ', ''))}</td><td>${c.step ? `<a class="wk" href="#st-${esc(c.step)}">§</a>` : ''}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="kv"><div><span>M<sub>u</sub> / M<sub>s</sub></span><span>${fmt(r.Mu, 1)} / ${fmt(r.Ms, 1)} kip-ft <a class="wk" href="#st-fx.Mu">§</a></span></div>
          ${r.p7 ? `<div><span>Section</span><span>${r.below ? 'PNA below the web' : r.compact ? 'compact' : 'noncompact'} <a class="wk" href="#st-fx.cmp">§</a></span></div>` : `<div><span>F<sub>nc</sub> (FLB / LTB)</span><span>${fmt(r.lt.FLB, 2)} / ${fmt(r.lt.LTB, 2)} ksi <a class="wk" href="#st-fx.Fnc">§</a></span></div><div><span>App. A6</span><span>${r.A6.ok ? (r.useA6 ? 'permitted, used' : 'permitted, not selected') : 'not permitted'} <a class="wk" href="#st-fx.a6.ok">§</a></span></div>`}
          <div><span>D<sub>c</sub> (Service II)</span><span>${fmt(r.DcS, 3)} in <a class="wk" href="#st-fx.DcS">§</a></span></div><div><span>Fatigue I Δf top / bottom</span><span>${fmt(r.dfT, 2)} / ${fmt(r.dfB, 2)} ksi <a class="wk" href="#st-fx.fatT">§</a></span></div></div></div></section>`;
        h += `<section class="sec"><div class="secHead">Worked steps, ${esc(r.name)}</div><div class="secBody"><p class="note">Flexure steps first, then the section properties of this location (also on the Section properties tab). AASHTO LRFD 10th Ed. (2024); y up from the bottom of the steel; tension +.</p>
          <ol class="steps">${r.steps.map(s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}</li>`).join('')}</ol></div></section>`;
      }
    }
    host.innerHTML = h;
    const on = (id, ev, f) => { const el = host.querySelector('#' + id); if (el) el.addEventListener(ev, f); };
    const redraw = () => render(host, ctx);
    on('fx_src', 'change', e => { S.src = e.target.value; redraw(); });
    on('fx_m', 'change', e => { S.method = e.target.value; redraw(); });
    ['Lb', 'Cb', 'flT', 'skew'].forEach(k => on('fx_' + k, 'change', e => { const v = Number(e.target.value); if (isFinite(v)) S[k] = v; redraw(); }));
    on('fx_fl', 'change', e => { const t = e.target.value, v = t === '' ? 0 : Number(t); if (!(isFinite(v) && v >= 0)) return;   // f_ℓ entered: saved in the project (SB2-W1)
      const P = ctx.P; if (v > 0) P.flexure = { ...(P.flexure || {}), fl: v }; else if (P.flexure) delete P.flexure.fl; if (ctx.changed) ctx.changed(); else redraw(); });
    on('fx_calc', 'click', () => { calc(ctx); redraw(); });
    host.querySelectorAll('[data-gotab]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); const b = document.querySelector(`#tabBar [data-otab="${el.dataset.gotab}"]`); if (b) b.click(); }));   // link to another tab (Constructibility, SB2-O10)
    on('fx_file', 'change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { try { const j = JSON.parse(String(rd.result)), pl = j.payload || j; if (!pl || pl._schema !== 'stgirder-external-demands' || !Array.isArray(pl.stations)) throw new Error('not a GirderDetail → ST-Girder hand-off file (schema stgirder-external-demands)');
        S.pl = pl; S.plName = f.name; S.err = ''; } catch (er) { S.pl = null; S.plName = ''; alert('Cannot read this file: ' + er.message); } redraw(); };
      rd.readAsText(f); });
    const list = host.querySelector('.fx-list'); if (list) list.addEventListener('click', e => { const tr = e.target.closest('[data-fx]'); if (!tr) return; S.sel = +tr.dataset.fx; redraw(); });
  }

  window.SBDFlexureUI = { render, build };
})();
