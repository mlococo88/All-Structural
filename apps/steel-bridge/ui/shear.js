/* apps/steel-bridge/ui/shear.js — the "Stiffeners" input tab and the "Shear & stiffeners" output tab (window.SBDShearUI), from
   engine/shear.js and engine/stiffeners.js. Classic script; needs SharedSteps, SharedUnits, SBDModel, SBDOwners, SBDShear, SBDStiffeners.

   Inputs (saved in the project, P.stiffeners): the stiffener layout (stiffened or unstiffened web; uniform d_o/D or per cross-frame bay;
   the cross-frame spacing, until the framing module exists), the transverse stiffener and connection plate types, the bearing
   stiffener types.
   Demands (until the analysis module lands), as the Flexure tab: either
     - "Example": GirderDetail's built-in Girder section shears (two locations), Transverse stiffeners rows and Bearing stiffeners rows,
       with this project's stiffener types; the layout's panels are listed with their resistance only (no shear envelope); or
     - a hand-off file (schema stgirder-external-demands, GirderDetail → ST-Girder): its stations, plates and shears, the project's layout
       on its supports: every panel (largest V_u in the panel), every station (GS11, GS16, GS18), every intermediate stiffener and
       connection plate (TS1–TS8, CP1), every bearing (BS1–BS7; reactions from the shears, see the note); or
     - "This project's analysis" (added 2026-10-29, SB2-O16): engine/analysis.js for this girder (Analysis tab settings and loads), its
       stations as a hand-off-shaped object (fromAnalysis), the same paths as a file; the bearing stiffeners take the analysis support
       reactions (DC1, DC2, DW, UT, UF and the LL+IM reaction envelope g_V R_HL93) instead of the upper bound from the shears.
   The default (2026-10-30, report wiring PR): this project's analysis when the project is complete (SBDAnalysis.ready), else the
   example; the line at the top of the tab names the source in use. The demand choice is not saved.

   inputs(P, h) / onClick(e, P, ui) for the input tab; render(host, ctx) for the output tab, ctx = { P, g } */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const S = { src: null, pl: null, plName: '', R: null, key: '', err: '', sel: null, view: 'pan', open: new Set() };   // open: the worked-step topics open (kept across selections)
  /* the demand source (added 2026-10-30, report wiring PR): the one chosen (S.src), else the default: this project's analysis when the
     project is complete (SBDAnalysis.ready), else the example */
  const rdOf = ctx => (window.SBDAnalysis && window.SBDAnalysis.ready ? window.SBDAnalysis.ready(ctx.P, ctx.P.girders[ctx.g] ? ctx.g : 0) : { ok: false, why: ['The analysis module is not loaded.'] });
  // the choice made on the tab is saved with the project (P.demandSrc.shear, custom demands PR 2026-11-01; a hand-off file only for the page view)
  const srcOf = ctx => S.src || (window.SBDCustomDemands && window.SBDCustomDemands.srcGet(ctx.P, 'shear')) || (rdOf(ctx).ok ? 'analysis' : 'example');
  // GirderDetail's built-in Girder section rows (GM.gs.def.rows): shears, unfactored, kip
  const EX = [{ name: 'Span 1, max. positive moment', x: 44, V: { DC1: 20, DC2: 3, DW: 3, LL: 40, CL: 3, f: 25, UT: 0, UF: 0 } },
    { name: 'Pier 1', x: 109.99, V: { DC1: 95, DC2: 14, DW: 16, LL: 105, CL: 12, f: 55, UT: 0, UF: 0 } }];
  const tt = t => esc(t).replace(/_\{?([A-Za-z0-9,]+)\}?/g, '<sub>$1</sub>');
  const cls = r => Number.isNaN(r) || r === Infinity ? 'fx-ng' : !isFinite(r) ? '' : r > 1 + 1e-9 ? 'fx-ng' : r >= 0.9 ? 'fx-hi' : 'fx-ok';
  const rt3 = v => Number.isNaN(v) ? 'error: ratio is NaN' : v === Infinity ? '∞' : fmt(v, 3);   // SB2-R2

  /* ---------- input tab ---------- */
  function ensure(P) { if (!P.stiffeners) P.stiffeners = window.SBDModel.defaultStiffeners(); return P.stiffeners; }
  function inputs(P, h, ui) {
    const st = ensure(P), M = window.SBDModel, grades = Object.keys(M.GRADES).map(k => [k, `${k} (F_y ${M.GRADES[k].Fy} ksi)`]), ly = st.layout, g = (ui && ui.g) || 0;
    const tsT = k => `${h.num(`stiffeners.transverse.types.${k}.name`, 'Name', '', { text: true })}${h.sel(`stiffeners.transverse.types.${k}.sides`, 'Plates', [['1', 'One side of the web'], ['2', 'Pair (both sides)']])}
      ${h.num(`stiffeners.transverse.types.${k}.bt`, 'Width b<sub>t</sub>', 'in')}${h.num(`stiffeners.transverse.types.${k}.tp`, 'Thickness t<sub>p</sub>', 'in')}${h.num(`stiffeners.transverse.types.${k}.w`, 'Fillet weld to web', 'in')}
      ${k === 'A' ? h.num(`stiffeners.transverse.types.${k}.gap`, 'Weld cutoff at the tension flange', 'in') : `${h.num(`stiffeners.transverse.types.${k}.wf`, 'Fillet weld to flanges', 'in')}${h.num(`stiffeners.transverse.types.${k}.c`, 'Clip', 'in')}${h.num(`stiffeners.transverse.types.${k}.Fcp`, 'Lateral force F', 'kip')}`}`;
    const bsT = k => `${h.num(`stiffeners.bearing.types.${k}.name`, 'Name', '', { text: true })}${h.sel(`stiffeners.bearing.types.${k}.np`, 'Pairs', [[1, '1 pair'], [2, '2 pairs'], [3, '3 pairs']])}
      ${h.num(`stiffeners.bearing.types.${k}.bt`, 'Width b<sub>t</sub> (each plate)', 'in')}${h.num(`stiffeners.bearing.types.${k}.tp`, 'Thickness t<sub>p</sub>', 'in')}${h.num(`stiffeners.bearing.types.${k}.c`, 'Clip c', 'in')}
      ${h.num(`stiffeners.bearing.types.${k}.sp`, 'Pair spacing (c-c)', 'in')}${h.num(`stiffeners.bearing.types.${k}.w`, 'Fillet weld to web', 'in')}
      ${h.sel(`stiffeners.bearing.types.${k}.conn`, 'Bottom flange connection', [['milled', 'Milled to bear'], ['cjp', 'CJP groove weld'], ['fillet', 'Fillet welds only']])}`;
    const bays = (ly.bays || []).map((q, i) => [q, i]).filter(([q]) => q.g === g + 1);
    return h.card('Stiffener layout (6.10.9.1)', `${h.sel('stiffeners.layout.web', 'Web', [['stiffened', 'Stiffened (transverse stiffeners)'], ['unstiffened', 'Unstiffened (connection plates only)']])}
        ${h.sel('stiffeners.layout.mode', 'Stiffener spacing', [['uniform', 'Uniform d_o/D in every bay'], ['bays', 'Per cross-frame bay (table below)']])}${h.num('stiffeners.layout.doRatio', 'd<sub>o</sub>/D (uniform; bays without an entry)', '')}
        ${h.num('stiffeners.layout.frames.Lb', 'Intermediate cross-frames at most', 'ft apart')}
        <p class="note">A bay is the girder between consecutive bearings and intermediate cross-frames; the connection plates at the cross-frames act as stiffeners. Uniform: in each bay ⌈L/(d<sub>o</sub>/D·D)⌉ − 1 stiffeners, evenly spaced (Preliminary sizing). End panels (next to an abutment, or any bearing of a simple span) use V<sub>n</sub> = CV<sub>p</sub> (6.10.9.3.3); pier panels are interior panels with tension-field action (S2-4). Cross-frames: this girder's own frames from the Spans &amp; framing tab (engine/framing.js; mapped to the analysis stations proportionally within each span); without framing, evenly at most the spacing below in each span.</p>`)
      + h.card(`Per-bay stiffeners, ${esc((P.girders[g] || {}).label || 'G' + (g + 1))}`, `${bays.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th>Bay (ft)</th><th>n</th><th>e<sub>0</sub> (in)</th><th>e<sub>1</sub> (in)</th></tr></thead><tbody>
          ${bays.map(([q, i]) => `<tr><td>${fmt(q.a, 2)}–${fmt(q.b, 2)}</td>${['n', 'e0', 'e1'].map(k => `<td><input type="number" step="${k === 'n' ? 1 : 'any'}" data-path="stiffeners.layout.bays.${i}.${k}" data-kind="num" value="${esc(q[k] == null ? '' : q[k])}" aria-label="bay ${i + 1} ${k}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="note">No per-bay entries for this girder.</p>'}
        <button type="button" id="stf_fill">${bays.length ? 'Reset' : 'Set'} this girder's bays from the uniform d<sub>o</sub>/D</button>
        <p class="note">n intermediate stiffeners in the bay; e<sub>0</sub> / e<sub>1</sub> (optional): an end stiffener at that distance from the bay's start / end, the rest evenly spaced. Used when the spacing is "per cross-frame bay"; a bay without an entry takes the uniform d<sub>o</sub>/D.</p>`)
      + h.card('Transverse stiffeners and connection plates (6.10.11.1)', `${h.sel('stiffeners.transverse.gS', 'Plate grade', grades)}${h.num('stiffeners.transverse.Fexx', 'Electrode F<sub>EXX</sub>', 'ksi')}
        <h4 class="sub">Type A, intermediate stiffener</h4>${tsT('A')}<h4 class="sub">Type B, connection plate</h4>${tsT('B')}`)
      + h.card('Bearing stiffeners (6.10.11.2)', `${h.sel('stiffeners.bearing.gS', 'Plate grade', grades)}${h.num('stiffeners.bearing.Fexx', 'Electrode F<sub>EXX</sub>', 'ksi')}${h.num('stiffeners.bearing.ed', 'Bearing ℄ to the girder end (abutments)', 'in')}
        <h4 class="sub">Type A, abutments</h4>${bsT('A')}<h4 class="sub">Type B, piers</h4>${bsT('B')}
        <p class="note">Stiffeners normal to the web, on both sides, full depth.</p>`);
  }
  /* the layout's geometry for girder g: supports, cross-frames, plates (from the model, or from a hand-off file) */
  /* the intermediate cross-frame stations of one girder: the project's framing (SB2-O17; a hand-off file only when its supports are this
     project's, girder sel.line), else the stations entered, else evenly at most L_b in each span */
  function framesOf(P, sel, sup, ly) { const FRM = window.SBDFraming, b = FRM && P.framing ? FRM.forGirder(P, sel, sup) : null;
    return b ? b.ints : (ly.frames && ly.frames.at) || window.SBDStiffeners.framesDefault(sup, (ly.frames && ly.frames.Lb) || 25); }
  function geom(P, g, pl) {
    const st = ensure(P), SB = window.SBDStiffeners, ly = st.layout;
    if (pl) { const sup = (pl.member || {}).supports || [], zones = (pl.section || {}).zones || [], dem = window.SBDShear.demands(pl);
      return { sup, cont: sup.length > 2, zAt: dem.zAt, chg: zones.slice(0, -1).map(z => z.endX), D: Math.max(...zones.map(z => z.web.depth)), gNo: +((pl.girderDetail || {}).girder) || g + 1, dem, frames: framesOf(P, { line: (+((pl.girderDetail || {}).girder) || g + 1) - 1 }, sup, ly) }; }
    const sup = [0]; P.spans.lengths.forEach(L => sup.push(+(sup[sup.length - 1] + +L).toFixed(6)));
    const G = P.girders[g] || P.girders[0], segAt = x => G.segments.find(s => x >= s.x0 - 1e-9 && x < s.x1) || G.segments[G.segments.length - 1];
    return { sup, cont: P.spans.continuity === 'continuous' && sup.length > 2, zAt: x => { const s = segAt(x); return { D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }; },
      chg: G.segments.slice(0, -1).map(s => s.x1), D: Math.max(...G.segments.map(s => s.D)), gNo: g + 1, dem: null, frames: framesOf(P, { gi: g }, sup, ly) };
  }
  function onClick(e, P, ui) {
    if (e.target.id !== 'stf_fill') return false;
    const st = ensure(P), SB = window.SBDStiffeners, gm = geom(P, ui.g, null), uni = SB.girderBays({ ...st.layout, mode: 'uniform' }, gm.D, gm.sup, gm.cont, gm.sup, gm.frames, ui.g + 1);
    st.layout.bays = (st.layout.bays || []).filter(q => q.g !== ui.g + 1).concat(uni.map(B => ({ g: ui.g + 1, a: B.a, b: B.b, n: B.n })));
    return true;
  }

  /* ---------- demands from this app's analysis (engine/analysis.js; SB2-O16) ---------- */
  /* fromAnalysis(P, gi): the analysis of girder gi as a hand-off-shaped object (schema 'sbd2-analysis'): one station per analysis station
     with the shears just right of it in the hand-off file's (MIDAS) sign, the opposite of this app's (the checks use magnitudes and the
     sign of each load against the others); at an interior support two stations 0.005 ft either side with the shears just left and just right; at
     the girder ends the inside shear. reactions[k] per support (kip, up +): DC1, DC2, DW, UT, UF (the stage reactions) and LL (the LL+IM
     reaction envelope with the larger g_V of the adjacent spans, an.R.LL.k). R0 (optional): SBDAnalysis.analyzeGirder(P, gi) already run
     (Auto design's evaluate, so that its shear checks take this tab's payload; added 2026-10-31). Returns { pl, R } or { err }. */
  function fromAnalysis(P, gi, R0) {
    const AN = window.SBDAnalysis, M = window.SBDModel;
    if (!AN) return { err: 'The analysis module is not loaded.' };
    let R = R0; if (!R) try { R = AN.analyzeGirder(P, gi); } catch (e) { return { err: 'Analysis: ' + (e && e.message) }; }
    if (R.errors && R.errors.length) return { err: 'Analysis: ' + R.errors.join(' ') };
    if (!R.ll || !R.fat || !R.llR) return { err: 'Analysis: no live load results.' };
    // LL+IM with the pedestrian load added once (SBDAnalysis.llPL), V_PL its part (pedestrianInLL, as GirderDetail's hand-off; sb-ped-owner PR)
    const g = P.girders[gi], st = R.st, ll = AN.llPL ? AN.llPL(R) : R.ll, q = R.pl, ft = R.fat, N = R.x.length, z = o => (o ? o : null);
    // the hand-off (MIDAS) sign, opposite to this app's: V = −V_app, and the positive envelope is −(the app's negative one)
    const at = (i, side) => { const k = side === 'L' ? 'VL' : 'VR', o = q => q ? -q[k][i] : 0;
      return { V_DC1: -st.DC1[k][i], V_DC2: -st.DC2[k][i], V_DW: -st.DW[k][i], V_UT: o(z(st.UT)), V_UF: o(z(st.UF)), V_CL: -st.CL[k][i],
        V_LLpos: -ll[k + 'neg'][i], V_LLneg: -ll[k + 'pos'][i], V_FATpos: -ft[k + 'neg'][i], V_FATneg: -ft[k + 'pos'][i], ...(q ? { V_PLpos: -q[k + 'neg'][i], V_PLneg: -q[k + 'pos'][i] } : {}) }; };
    const inner = new Set(R.supIdx.slice(1, -1)), stations = [];
    R.x.forEach((x, i) => { if (inner.has(i)) { stations.push({ x: x - 0.005, ...at(i, 'L') }, { x: x + 0.005, ...at(i, 'R') }); } else stations.push({ x, ...at(i, i === N - 1 ? 'L' : 'R') }); });
    const zones = g.segments.map(s => ({ startX: s.x0, endX: s.x1, web: { depth: s.D, thickness: s.tw }, topFlange: { width: s.topB, thickness: s.topT }, botFlange: { width: s.botB, thickness: s.botT } }));
    const reactions = R.sup.map((_, k) => ({ DC1: st.DC1.R[k], DC2: st.DC2.R[k], DW: st.DW.R[k], UT: st.UT ? st.UT.R[k] : 0, UF: st.UF ? st.UF.R[k] : 0, LL: R.llR[k].max + (q ? q.R[k].max : 0), PL: q ? q.R[k].max : 0, gV: R.llR[k].gV, LLlane: R.llR[k].perLane.max }));
    const pl = { _schema: 'sbd2-analysis', pedestrianInLL: !!q, stations, reactions, member: { supports: R.sup.slice(), spans: R.spans.slice() }, section: { zones },
      girderDetail: { label: g.label || g.id, girder: gi + 1, position: g.position, materials: { Fyw: M.GRADES[P.materials.steel.web].Fy } } };
    return { pl, R };
  }

  /* ---------- calculation ---------- */
  /* inPan(xs, q): an entered station within the panel q (p..q, ft) */
  const inPan = (xs, q) => xs.some(x => x >= Math.min(q.p, q.q) - 1e-6 && x <= Math.max(q.p, q.q) + 1e-6);
  /* fatI(P): Fatigue I γ of the Fatigue & studs inputs (P.fatigue.gam.fI), the one source for every module (FGAM, 2026-11-01); 1.75 without one */
  const fatI = P => { const v = +(((P && P.fatigue) || {}).gam || {}).fI; return v > 0 ? v : 1.75; };
  function build(ctx) {
    const P = ctx.P, M = window.SBDModel, SH = window.SBDShear, SB = window.SBDStiffeners, OW = window.SBDOwners, st = ensure(P), ly = st.layout, g = ctx.g || 0;
    const own = P.ownerRules || { owner: 'AASHTO', eta: {} }, lf = OW.loadFactors(own.owner, own.eta, (P.xs && P.xs.nb) || 0), env = { owner: own.owner, lf };
    const src = ctx.src || srcOf(ctx);   // ctx.src: the demand source chosen by the caller (the Report tab), else the tab's own choice
    let pl = ctx.pl !== undefined ? ctx.pl : src === 'file' ? S.pl : null, AR = null;   // ctx.pl: a payload given directly (tests)
    const Fyw = M.GRADES[P.materials.steel.web].Fy, G = SH.factorsOwner(lf, { fat: fatI(P) });
    if (ctx.pl === undefined && src === 'file' && !pl) return { err: 'Choose a hand-off file (GirderDetail → ST-Girder demands, .json).' };
    if (ctx.pl === undefined && src === 'analysis') { const A = fromAnalysis(P, g); if (A.err) return A; pl = A.pl; AR = A.R; }
    // custom (added 2026-11-01, custom demands PR): the rows and reactions entered on this tab (ui/demands.js payload), the same path as a
    // file or the analysis; only the stations, panels, stiffeners and bearings that the entered rows reach are checked (custom() below)
    let C = null; if (ctx.pl === undefined && src === 'custom') { if (!window.SBDCustomDemands) return { err: 'ui/demands.js is not loaded.' }; C = window.SBDCustomDemands.payload(P, g, 'shear'); if (C.err) return { err: C.err }; pl = C.pl; }
    const gm = geom(P, g, pl), D = gm.D;
    // sections along a range: both sides of every plate change inside (Preliminary sizing tsSecFns)
    const pts = (p, q) => { const xs = [p, q]; gm.chg.forEach(x => { if (x > p && x < q) xs.push(x - 1e-6, x + 1e-6); }); const Lt = gm.sup[gm.sup.length - 1]; return xs.map(x => Math.min(Math.max(x, 1e-6), Lt - 1e-6)); };
    const twAt = (p, q) => Math.min(...pts(p, q).map(x => gm.zAt(x).tw)), rat = (p, q) => Math.max(...pts(p, q).map(x => { const s = gm.zAt(x); return 2 * s.D * s.tw / (s.topB * s.topT + s.botB * s.botT); }));
    const bays = SB.girderBays(ly, D, gm.sup, gm.cont, gm.sup, gm.frames, gm.gNo), pans = bays.flatMap(SB.bayPanels);
    const panels = SH.panels(pans, { D, Fyw, twAt, rat, vu: gm.dem ? gm.dem.vu : null });
    const panAt = x => { const c = panels.rows.filter(q => x >= q.p - 0.05 && x <= q.q + 0.05); return c.length ? c.reduce((a, q) => (gm.dem ? q.r > a.r : q.d > a.d) ? q : a) : null; };
    let locs;
    if (pl) locs = SH.fromPayload(pl, { G }).locs;
    else locs = EX.filter(e => gm.cont || e.x < gm.sup[1]).map(e => ({ name: e.name, x: e.x, plates: gm.zAt(e.x), V: e.V }));
    if (C) locs = window.SBDCustomDemands.keepAt(locs, C.xs);   // the entered stations (both sides, ±0.01 ft, of a support there)
    locs = locs.map(L => { const q = panAt(L.x), on = ly.web !== 'unstiffened', Vp = q && gm.dem ? gm.dem.inPanel(q.p, q.q) : null;
      const plT = { ...(L.pl || {}), ...(Vp && Vp.plLL ? { VLLp: [Vp.plLL, Vp.LL] } : {}) };   // GD45: the pedestrian part of the panel's V_LL+IM (sb-ped-owner PR)
      return { ...L, do: q && on ? q.d : 0, end: !!(q && q.end && on), Vpan: Vp, pan: q ? q.i : null, ...(Object.keys(plT).length ? { pl: plT } : {}) }; });
    const stations = locs.map(L => { const r = SH.location(L, { mat: { Fyw }, G }); r.pan = L.pan; return r; });
    // transverse stiffeners: every intermediate stiffener and connection plate of the layout (file), GirderDetail's built-in rows (example)
    let tsRows = gm.dem ? SB.stiffenerRows(bays, gm.zAt, gm.dem, { label: `G${gm.gNo}` }) : JSON.parse(JSON.stringify(SB.TS_DEFAULT.rows));
    if (C) tsRows = tsRows.filter(r => { const a = pans.find(q => Math.abs(q.q - r.x) <= 0.01), b = pans.find(q => Math.abs(q.p - r.x) <= 0.01); return a && b && inPan(C.xs, a) && inPan(C.xs, b); });   // both panels reached
    const TS = tsRows.length ? SB.transverse({ gW: P.materials.steel.web, gS: st.transverse.gS, Fexx: st.transverse.Fexx, gam: { dc: 1.25, dw: 1.50, ll: 1.75, fat: fatI(P) }, types: st.transverse.types, rows: tsRows }, env) : null;
    // bearings: one per support
    let bsRows;
    // reactions: the analysis support reactions where the demands come from this app's analysis (SB2-O16); from a file, the jump in shear
    // (DC, DW) and the sum of the two LL+IM shear envelopes (an upper bound, SB2-O16 interim; the file path is kept as it is)
    const rxn = pl && Array.isArray(pl.reactions) && pl.reactions.length === gm.sup.length ? pl.reactions : null;
    if (gm.dem) bsRows = gm.sup.map((x, k) => { const end = k === 0 || k === gm.sup.length - 1 || !gm.cont, s = gm.zAt(Math.min(Math.max(x + (k === gm.sup.length - 1 ? -0.01 : 0.01), 0), gm.sup[gm.sup.length - 1])), R = rxn ? rxn[k] || { DC1: 0, DC2: 0, DW: 0, LL: 0 } : gm.dem.reaction(x);   // custom: a support without reactions entered is dropped below
      return { name: `${k === 0 ? 'Abut. 1' : k === gm.sup.length - 1 ? 'Abut. 2' : 'Pier ' + k}, G${gm.gNo}`, type: end ? 'A' : 'B', tw: s.tw, bft: s.topB, bfb: s.botB, tfb: s.botT, ed: end ? st.bearing.ed : 0,
        RDC1: R.DC1, RDC2: R.DC2, RDW: R.DW, RLL: R.LL, ...(R.UT || R.UF ? { ut: { VUT: R.UT, VUF: R.UF } } : {}), ...(R.PL ? { pl: { RLL: [R.PL, R.LL] } } : {}) }; });   // GD45: R_PL part (sb-ped-owner PR)
    else bsRows = JSON.parse(JSON.stringify(SB.BS_DEFAULT.rows));
    if (C) bsRows = bsRows.filter((r, k) => rxn && rxn[k]);   // the supports with reactions entered
    if (C) { const keep = panels.rows.filter(q => inPan(C.xs, q)), mp = new Map(keep.map((q, j) => [q.i, j])); keep.forEach((q, j) => { q.i = j; }); stations.forEach(r => { r.pan = mp.has(r.pan) ? mp.get(r.pan) : null; });   // the panels with an entered station
      panels.rows = keep; panels.gov = keep.reduce((b, q) => (!b || (isFinite(q.r) || q.r == null ? q.r : Infinity) > (isFinite(b.r) || b.r == null ? b.r : Infinity) ? q : b), null); }   // as SH.panels gov (SB2-R2)
    const BS = C && !bsRows.length ? { rows: [], errors: [], none: true } : SB.bearing({ D, gW: P.materials.steel.web, gS: st.bearing.gS, Fexx: st.bearing.Fexx, gam: { dc: 1.25, dw: 1.50, ll: 1.75 }, types: st.bearing.types, rows: bsRows }, env);   // none: custom, no reactions entered
    const tsC = TS && !TS.errors.length ? SB.transverseChecks(TS) : null, bsC = BS.none ? [] : !BS.errors.length ? SB.bearingChecks(BS) : null;
    // governing ratio of each list
    const govCk = (C, rowIdx) => { let b = null; (C || []).forEach(c => c.items.forEach(it => { if ((isFinite(it.r) || (typeof it.r === 'number' && it.st === 'fail')) && (it.st === 'pass' || it.st === 'fail') && (!b || (x => isFinite(x) ? x : Infinity)(it.r) > (x => isFinite(x) ? x : Infinity)(b.r))) b = { c, it, i: rowIdx(it) }; })); return b; };
    const tsRowOf = it => TS.rows.findIndex(r => it.loc.startsWith(`${r.name} (Type ${r.type})`)), bsRowOf = it => { const k = BS.rows.findIndex(r => it.loc.startsWith(`${r.name} (Type ${r.type})`)); if (k >= 0) return k; const m = /^Type (\w+),/.exec(it.loc); return m ? Math.max(0, BS.rows.findIndex(r => r.type === m[1])) : 0; };   // BS1 is per stiffener type: its first bearing
    const stGov = stations.reduce((b, r) => (r.gov && (!b || (x => isFinite(x) ? x : Infinity)(r.gov.ratio) > (x => isFinite(x) ? x : Infinity)(b.gov.ratio)) ? r : b), null);
    return { gm, D, Fyw, G, lf, bays, panels, stations, stGov, TS, tsC, tsGov: tsC ? govCk(tsC, tsRowOf) : null, BS, bsC, bsGov: bsC ? govCk(bsC, bsRowOf) : null, rxn: !!rxn, AR,
      custom: C, what: C ? `Demands: entered (Custom), unfactored by load case, with the Strength I factors and the owner's η and m of this project: ${C.rows.length} row(s) on ${esc((P.girders[g] || {}).label || '')}, ${stations.length} station(s), ${panels.rows.length} panel(s), ${TS ? TS.rows.length : 0} stiffener(s) / connection plate(s) and ${bsRows.length} bearing(s) reached by the entered rows; the project's plates and stiffener layout.`
        : pl && pl._schema === 'sbd2-analysis' ? `This project's analysis of ${esc((P.girders[g] || {}).label || '')} (Analysis tab: settings, loads, factors): ${pl.stations.length} stations, ${gm.sup.length - 1} span(s); the project's plates, stiffener layout and plates.${AR && AR.warnings && AR.warnings.length ? '<br>' + AR.warnings.map(esc).join('<br>') : ''}`
        : pl ? `${esc(S.plName)}: ${pl.stations.length} stations, ${gm.sup.length - 1} span(s), G${gm.gNo}; plates and shears from the file; the project's stiffener layout and plates.` : `Example: GirderDetail's built-in shears (Girder section, Transverse stiffeners and Bearing stiffeners rows) with this project's plates (${esc((P.girders[g] || {}).label || '')}) and stiffener inputs. Load a hand-off file for the shear in every panel.` };
  }
  const key = ctx => JSON.stringify([ctx.P, ctx.g, srcOf(ctx), S.plName]);

  /* ---------- output tab ---------- */
  function css() {
    if (document.getElementById('fx-css') && document.getElementById('sh-css')) return;
    const st = document.createElement('style'); st.id = 'sh-css';
    st.textContent = `.fx-ok{background:#e7f4ec;} .fx-hi{background:#fdf3d8;} .fx-ng{background:#fbe1dd;font-weight:600;} tr.fx-gov td:first-child{box-shadow:inset 4px 0 0 #b23a2a;}
      .fx-list{max-height:300px;overflow:auto;} .fx-list tr{cursor:pointer;} .fx-na{color:#64748b;font-style:italic;} h4.sub{margin:8px 0 2px;font-size:10pt;}` + window.SharedSteps.groupCss;
    document.head.appendChild(st);
  }
  function render(host, ctx) {
    css();
    const stale = !S.R || S.key !== key(ctx), opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${t}</option>`;
    const AUI = window.SBDAnalysisUI, gl = ctx.P.girders[ctx.g] || ctx.P.girders[0] || {}, src = srcOf(ctx);
    let h = (AUI && AUI.srcBar ? AUI.srcBar({ src, auto: !S.src && !(window.SBDCustomDemands && window.SBDCustomDemands.srcGet(ctx.P, 'shear')), rd: rdOf(ctx), g: gl.label || gl.id, plName: S.plName, example: 'GirderDetail built-in shears' }) : '')
      + `<section class="sec"><div class="secHead">Shear &amp; stiffeners: demands</div><div class="secBody">
      <div class="fRow"><label for="sh_src">Demands</label><select id="sh_src">${opt('analysis', 'This project\'s analysis (Analysis tab)', src)}${opt('example', 'Example (GirderDetail built-in shears)', src)}${opt('file', 'Hand-off file (GirderDetail → ST-Girder)', src)}${window.SBDCustomDemands ? opt('custom', 'Custom (entered)', src) : ''}</select></div>
      ${src === 'file' ? `<div class="fRow"><label for="sh_file">File</label><input type="file" id="sh_file" accept=".json,application/json"><span class="unit">${esc(S.plName)}</span></div>` : ''}
      <p class="note">Strength I γ<sub>DC</sub> 1.25, γ<sub>DW</sub> 1.50, LL+IM 1.75 (shears are magnitudes: the maximum factors; with the owner's η and m, Loads &amp; LLDF tab); special fatigue loading 6.10.5.3 and the stiffener weld toes (CP2): Fatigue I γ ${fmt(fatI(ctx.P), 2)} (<a href="#" data-goto="fs">Fatigue &amp; studs inputs</a>), permanent shear + γV<sub>fat</sub>; deck placement 1.25 V<sub>DC1</sub> + 1.50 V<sub>CL</sub>. φ<sub>v</sub> = 1.0. Stiffener inputs: Stiffeners tab. The demand source is saved with the project (a hand-off file is not).</p></div></section>`;
    if (src === 'custom' && window.SBDCustomDemands) h += window.SBDCustomDemands.card(ctx.P, 'shear', ctx.g);   // the entered rows and reactions (ui/demands.js)
    h += `<div class="alert stale"${stale ? '' : ' hidden'}><span>Shear results are out of date: inputs changed or nothing calculated yet.</span><button type="button" class="primary" id="sh_calc">Calculate</button></div>`;
    if (S.err && !stale) h += `<div class="alert err">${esc(S.err)}</div>`;
    else if (S.R && !stale) h += results(S.R);
    host.innerHTML = h;
    const on = (id, ev, f) => { const el = host.querySelector('#' + id); if (el) el.addEventListener(ev, f); }, redraw = () => render(host, ctx);
    on('sh_src', 'change', e => { const v = e.target.value; S.src = v === 'file' ? 'file' : null;   // saved with the project (P.demandSrc.shear), a file for the page view
      if (window.SBDCustomDemands) window.SBDCustomDemands.srcSet(ctx.P, 'shear', v === 'file' ? null : v); if (ctx.changed && v !== 'file') ctx.changed(); else redraw(); });
    if (src === 'custom' && window.SBDCustomDemands) window.SBDCustomDemands.wire(host, ctx.P, 'shear', ctx.g, () => (ctx.changed ? ctx.changed() : redraw()));
    on('sh_calc', 'click', () => { S.err = ''; S.R = null; try { const R = build(ctx); if (R.err) S.err = R.err; else { S.R = R; S.sel = defaultSel(R); } } catch (er) { S.err = 'Calculation error: ' + (er && er.message); } S.key = key(ctx); redraw(); });
    on('sh_file', 'change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { try { const j = JSON.parse(String(rd.result)), ck = window.SBDDemandFile.check(j); if (!ck.ok) throw new Error(ck.error); const pl = ck.pl;   // B1: GirderDetail hand-offs only (engine/demandfile.js)
        S.pl = pl; S.plName = f.name; S.err = ''; } catch (er) { alert('Cannot read this file: ' + er.message); /* nothing changed: the previous file, if any, stays */ } redraw(); };
      rd.readAsText(f); });
    host.querySelectorAll('.fx-list').forEach(el => el.addEventListener('click', e => { const tr = e.target.closest('[data-sh]'); if (!tr) return; const [k, i] = tr.dataset.sh.split(':'); S.sel = { k, i: +i }; redraw(); }));
    // a link to a step opens its topic (the topics start closed)
    const show = id => { const t = host.querySelector('#st-' + String(id || '').replace(/[^\w.-]/g, '').replace(/\./g, '\\.')); if (!t) return; const d = t.closest('details.sg-t'); if (d) { d.open = true; S.open.add(d.dataset.sgk); } t.scrollIntoView({ block: 'center' }); };
    host.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const [k, i, id] = a.dataset.go.split(':'); S.sel = { k, i: +i }; redraw(); show(id); }));
    host.querySelectorAll('[data-step]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); show(a.dataset.step); }));
    host.querySelectorAll('[data-gotab]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const b = document.querySelector(`#tabBar [data-otab="${a.dataset.gotab}"]`); if (b) b.click(); }));
    window.SharedSteps.wire(host, { onToggle: (k, open) => { if (open) S.open.add(k); else S.open.delete(k); } });
    if (S.R && !stale && !S.err && window.SBDTabGfxBUI) window.SBDTabGfxBUI.shear(host, ctx, S.R, S.sel, v => { S.sel = v; redraw(); });   // the graphics (ui/tabgraphics-b.js): a click selects the same row
  }
  function defaultSel(R) {
    const c = [];
    if (R.panels.gov && R.gm.dem) c.push({ k: 'pan', i: R.panels.gov.i, r: R.panels.gov.r });
    if (R.stGov) c.push({ k: 'loc', i: R.stations.indexOf(R.stGov), r: R.stGov.gov.ratio });
    if (R.tsGov) c.push({ k: 'ts', i: R.tsGov.i, r: R.tsGov.it.r });
    if (R.bsGov) c.push({ k: 'bs', i: R.bsGov.i, r: R.bsGov.it.r });
    return c.reduce((a, b) => (!a || b.r > a.r ? b : a), null) || { k: 'pan', i: 0 };
  }
  const stepsHtml = list => `<ol class="steps">${list.map(s => stepLi(s, list)).join('')}</ol>`;
  /* one worked step; a "§id" in its note (engine/shear.js "See §p1.Vn.") becomes a link to that step of the same list (CLAUDE.md §6) */
  const stepLi = (s, list) => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${noteHtml(s.note, list)}</div>` : ''}</li>`;
  const noteHtml = (t, list) => esc(t).replace(/§([A-Za-z](?:[\w.]*\w)?)/g, (m, id) => { const q = (list || []).find(x => x.id === id || String(x.id).endsWith('.' + id)); return q ? `<a class="wk" href="#st-${esc(q.id)}" data-step="${esc(q.id)}">§${esc(id)}</a>` : m; });

  /* ---------- topics of the worked steps (presentation spec A, trial on this tab, 2026-10-31) ----------
     SharedSteps.group sorts each list into topics in the standard order (inputs and geometry, section, demands, one topic per AASHTO
     sub-article, resistance, check); ids are matched without their work prefix (ts3., bs0., bsTA., pn., sh.). Presentation only: the steps,
     ids and values are the engines'. The Report tab uses the same topics (report/builders.js). */
  const A = '10th Ed. Art. ';
  const TOPICS = {
    ts: [{ key: 'geo', title: 'Projecting width of the plate', ref: A + '6.10.11.1.2', ids: /^(bmin|bmax|bf4)$/ },
      { key: 'dem', title: 'Demands: Strength I shear at the stiffener', ref: 'Tables 3.4.1-1, -2', ids: /^(pl\.|Vu|src$|cd\.src$)/, res: /^Vu$/ },
      { key: 'lim', title: 'Panel spacing limits', ref: A + '6.10.9.1', ids: /^p[12]\.lim$/ },
      { key: 'pan', title: 'Web shear resistance of the two adjacent panels', ref: A + '6.10.9.3', ids: /^p[12]\./ },
      { key: 'It', title: 'Moment of inertia of the stiffener', ref: A + '6.10.11.1.3', ids: /^(It|J|It1|Fcrs|rhot|It2|rhow|Ireq)$/ },
      { key: 'weld', title: 'Welds and weld cutoff', ref: A + '6.10.11.1.1, 6.13.3.4, 6.13.3.2.4b', ids: /^(gap|wW|wF|cp)$/ },
      { key: 'fat', title: 'Fatigue at the stiffener weld toes', ref: A + '6.6.1.2', ids: /^fat$/ },
      { key: 'own', title: 'Owner requirements', ref: '', ids: /^own$/ }],
    bs: [{ key: 'geo', title: 'Projecting width of the plates', ref: A + '6.10.11.2.2', ids: /^b$/ },
      { key: 'det', title: 'Plate width and flange connection', ref: A + '6.10.11.2.1', ids: /^(bw|conn)$/ },
      { key: 'dem', title: 'Demands: Strength I reaction', ref: 'Tables 3.4.1-1, -2', ids: /^(pl\.|Ru$|src$|cd\.src$)/, res: /^Ru$/ },
      { key: 'brg', title: 'Bearing resistance', ref: A + '6.10.11.2.3', ids: /^(bEff|Apn|Rsb|Rsb\.ok)$/ },
      { key: 'sec', title: 'Effective column section', ref: A + '6.10.11.2.4', ids: /^(strip|sEnd|Lw|A|I|rs)$/ },
      { key: 'col', title: 'Axial resistance of the effective column', ref: A + '6.10.11.2.4, 6.9.4.1.1, 6.9.2.1', ids: /^(sl|Po|Pe|Pn|Pr|Pr\.ok)$/ },
      { key: 'weld', title: 'Stiffener-to-web welds', ref: A + '6.13.3.2.4b, 6.13.3.4', ids: /^(weld|weld\.ok|wmin)$/ },
      { key: 'own', title: 'Owner requirements', ref: '', ids: /^own$/ }],
    pan: [{ key: 'geo', title: 'Panel geometry', ref: '', ids: /^d$/ },
      { key: 'dem', title: 'Demand: Strength I shear in the panel', ref: A + '6.10.9.3.1', ids: /^(Vu|src|cd\.src)$/ },
      { key: 'res', title: 'Nominal shear resistance', ref: A + '6.10.9.2, 6.10.9.3', ids: /^v\./ },
      { key: 'chk', title: 'Check', ref: A + '6.10.9.1', ids: /^ok$/ }],
    loc: [{ key: 'sec', title: 'Section: flange areas', ref: '', ids: /^flgA$/ },
      { key: 'dem', title: 'Demands: Strength I shear', ref: 'Tables 3.4.1-1, -2', ids: /^(Vu|VuPan|VuP|src|cd\.src)$/, res: /^VuP$/ },
      { key: 'res', title: 'Nominal shear resistance of the panel', ref: A + '6.10.9.2, 6.10.9.3', ids: /^pan\./ },
      { key: 'chk', title: 'Check, Strength I', ref: A + '6.10.9.1', ids: /^ok$/ },
      { key: 'cn', title: 'Deck placement (constructibility)', ref: A + '6.10.3.3', ids: /^(VuC|okC)$/ },
      { key: 'fat', title: 'Special fatigue requirement for webs', ref: A + '6.10.5.3', ids: /^(VuF|okF)$/ }]
  };
  const groups = (kind, list) => window.SharedSteps.group(list, TOPICS[kind]);
  const go = (k, i, id, txt) => `<a class="wk" href="#st-${esc(id)}" data-go="${k}:${i}:${esc(id)}">${txt || '§'}</a>`;
  function results(R) {
    let h = '';
    const gl = [];
    if (R.panels.gov && R.gm.dem) gl.push([R.panels.gov.r, `Panel ${fmt(R.panels.gov.p, 2)}–${fmt(R.panels.gov.q, 2)} ft${R.panels.gov.end ? ' (end panel)' : ''}: V<sub>u</sub> ≤ φ<sub>v</sub>V<sub>n</sub> (6.10.9)`, go('pan', R.panels.gov.i, 'pn.ok'), 'Web panels']);
    if (R.stGov) gl.push([R.stGov.gov.ratio, `${esc(R.stGov.name)}: ${esc(R.stGov.gov.id)} ${tt(R.stGov.gov.title)}`, go('loc', R.stations.indexOf(R.stGov), R.stGov.gov.step), 'Stations']);
    if (R.tsGov) gl.push([R.tsGov.it.r, `${esc(R.tsGov.it.loc)}: ${esc(R.tsGov.c.id)} ${tt(R.tsGov.c.title)}`, go('ts', R.tsGov.i, R.tsGov.it.step), 'Transverse stiffeners']);
    if (R.bsGov) gl.push([R.bsGov.it.r, `${esc(R.bsGov.it.loc)}: ${esc(R.bsGov.c.id)} ${tt(R.bsGov.c.title)}`, go('bs', R.bsGov.i, R.bsGov.it.step), 'Bearing stiffeners']);
    const top = gl.reduce((a, b) => (!a || b[0] > a[0] ? b : a), null);
    h += `<section class="sec"><div class="secHead">Shear &amp; stiffeners: governing</div><div class="secBody"><p class="note">${R.what}</p>
      ${top ? `<p>Governing ratio <b class="${cls(top[0])}">${fmt(top[0], 3)}</b>: ${top[1]} ${top[2]}</p>` : ''}
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Group</th><th class="lft">Governing item</th><th>Ratio</th><th></th></tr></thead><tbody>
      ${gl.map(q => `<tr><td class="lft">${q[3]}</td><td class="lft">${q[1]}</td><td class="${cls(q[0])}">${rt3(q[0])}</td><td>${q[2]}</td></tr>`).join('')}</tbody></table></div>
      ${R.TS && R.TS.errors && R.TS.errors.length ? `<div class="alert err">Transverse stiffeners: ${R.TS.errors.map(esc).join('; ')}</div>` : ''}${R.BS.errors && R.BS.errors.length ? `<div class="alert err">Bearing stiffeners: ${R.BS.errors.map(esc).join('; ')}</div>` : ''}</div></section>`;
    h += `<section class="sec"><div class="secHead">Shear &amp; stiffeners: graphics</div><div class="secBody"><div data-gfxb="shear"></div><div data-gfxb="shear-detail"></div><div data-gfxb="shear-bearing"></div></div></section>`;   // drawn by ui/tabgraphics-b.js (engine/tabgraphics-b.js) from the results below
    // panels
    h += `<section class="sec"><div class="secHead">Web panels of the layout (G${R.gm.gNo}, D = ${fmt(R.D, 2)} in, F<sub>yw</sub> = ${fmt(R.Fyw, 0)} ksi)</div><div class="secBody">
      <p class="note">${R.bays.length} bays, ${R.panels.rows.length} panels. V<sub>u</sub>: the largest Strength I shear in the panel (6.10.9.3.1)${R.gm.dem ? '' : ' (needs a hand-off file)'}; t<sub>w</sub> the thinnest web and 2Dt<sub>w</sub>/(b<sub>fc</sub>t<sub>fc</sub> + b<sub>ft</sub>t<sub>ft</sub>) the largest in the panel.</p>
      <div class="tscroll fx-list"><table class="tbl"><thead><tr><th>Panel (ft)</th><th>d<sub>o</sub> (in)</th><th>Type</th><th>k</th><th>C</th><th>φV<sub>n</sub> (kip)</th><th>Eq.</th><th>V<sub>u</sub> (kip)</th><th>Ratio</th></tr></thead><tbody>
      ${R.panels.rows.map((q, i) => `<tr data-sh="pan:${i}" class="${S.sel && S.sel.k === 'pan' && S.sel.i === i ? 'sel' : ''}${q === R.panels.gov && R.gm.dem ? ' fx-gov' : ''}"><td>${fmt(q.p, 2)}–${fmt(q.q, 2)}</td><td>${fmt(q.d, 2)}</td><td>${q.end ? 'end' : q.stiff ? 'interior' : 'unstiffened'}</td><td>${fmt(q.k, 3)}</td><td>${fmt(q.C, 4)}</td><td>${fmt(q.phVn, 1)}</td><td>${esc(q.eq.replace(/,.*$/, ''))}</td><td>${R.gm.dem ? fmt(q.Vu, 1) : '—'}</td><td class="${R.gm.dem ? cls(q.r) : ''}">${R.gm.dem ? fmt(q.r, 3) : '—'}</td></tr>`).join('')}
      </tbody></table></div></div></section>`;
    // stations
    h += `<section class="sec"><div class="secHead">Shear at the stations (GS11, GS16, GS18)</div><div class="secBody"><p class="note">d<sub>o</sub> and the end-panel flag from the layout panel containing the station (of two, the one with the larger V<sub>u</sub>/φV<sub>n</sub>); V<sub>u</sub> the larger of the shear at the station and the largest in its panel.</p>
      <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Station</th><th>d<sub>o</sub> (in)</th><th>V<sub>u</sub> (kip)</th><th>φV<sub>n</sub> (kip)</th><th>GS11</th><th>GS16</th><th>GS18</th></tr></thead><tbody>
      ${R.stations.map((r, i) => { const c = id => r.checks.find(q => q.id === id); const cell = q => q && (q.inUse || q.ng) ? `<td class="${cls(q.ratio)}">${q.ng ? esc(q.ng) : rt3(q.ratio)}</td>` : '<td class="fx-na">n/a</td>';
        return `<tr data-sh="loc:${i}" class="${S.sel && S.sel.k === 'loc' && S.sel.i === i ? 'sel' : ''}${r === R.stGov ? ' fx-gov' : ''}"><td class="lft">${esc(r.name)}${r.end ? ' (end panel)' : ''}</td><td>${r.do > 0 ? fmt(r.do, 2) : '—'}</td><td>${fmt(r.VuP != null ? r.VuP : r.Vu, 1)}</td><td>${fmt(r.sh.Vn, 1)}</td>${cell(c('GS11'))}${cell(c('GS16'))}${cell(c('GS18'))}</tr>`; }).join('')}
      </tbody></table></div></div></section>`;
    // transverse stiffeners
    if (R.TS && !R.TS.errors.length) { const byRow = R.TS.rows.map(() => ({ r: -1, id: '' })); R.tsC.forEach(c => c.items.forEach(it => { const k = R.TS.rows.findIndex(r => it.loc.startsWith(`${r.name} (Type ${r.type})`)); if (k >= 0 && isFinite(it.r) && it.r > byRow[k].r) byRow[k] = { r: it.r, id: c.id, st: it.st }; }));
      h += `<section class="sec"><div class="secHead">Transverse stiffeners and connection plates (6.10.11.1)</div><div class="secBody"><p class="note">${R.gm.dem ? 'Every intermediate stiffener (Type A) and cross-frame connection plate (Type B) of the layout, with its two panels.' : 'GirderDetail\'s built-in rows.'} Checks: ${R.tsC.map(c => `${esc(c.id)} ${tt(c.title)}${c.naWhy ? ' (n/a)' : ''}`).join('; ')}.</p>
        <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Location</th><th>d<sub>o1</sub> / d<sub>o2</sub> (in)</th><th>I<sub>t</sub> / I<sub>req</sub> (in⁴)</th><th>Governing</th><th>Ratio</th></tr></thead><tbody>
        ${R.TS.rows.map((r, i) => `<tr data-sh="ts:${i}" class="${S.sel && S.sel.k === 'ts' && S.sel.i === i ? 'sel' : ''}${R.tsGov && R.tsGov.i === i ? ' fx-gov' : ''}"><td class="lft">${esc(r.name)} (Type ${esc(r.type)})${r.end === 'yes' ? ', end panel 1' : ''}</td><td>${fmt(r.do1, 2)} / ${fmt(r.do2, 2)}</td><td>${fmt(r.It, 2)} / ${fmt(r.Ireq, 2)}</td><td>${esc(byRow[i].id)}</td><td class="${byRow[i].st === 'fail' ? 'fx-ng' : cls(byRow[i].r)}">${fmt(byRow[i].r, 3)}</td></tr>`).join('')}
        </tbody></table></div></div></section>`; }
    // bearing stiffeners
    if (!R.BS.errors.length) h += `<section class="sec"><div class="secHead">Bearing stiffeners (6.10.11.2)</div><div class="secBody"><p class="note">${R.custom ? (R.BS.none ? 'No support reactions entered in the Custom table: the bearing stiffeners are not checked.' : 'The supports with reactions entered in the Custom table (Type A at the abutments, Type B at the piers).') : R.rxn ? `One bearing per support (Type A at the abutments, Type B at the piers). Reactions: the support reactions of this project's analysis (DC1, DC2, DW${R.AR && R.AR.st.UT ? ', UT' : ''}${R.AR && R.AR.st.UF ? ', UF' : ''}; LL+IM the reaction envelope g<sub>V</sub>R<sub>HL93</sub>, the larger g<sub>V</sub> of the adjacent spans), worked on the Analysis tab (an.R.LL.k, an.eq.*).`
      : R.gm.dem ? 'One bearing per support (Type A at the abutments, Type B at the piers). Reactions from the hand-off shears: DC, DW the jump in shear; LL+IM the sum of the two shear envelopes beside the support, an upper bound of the reaction envelope (GirderDetail uses the reaction envelope of its analysis). Choose "This project\'s analysis" for the analysis reactions.' : 'GirderDetail\'s built-in rows.'}</p>
      <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Bearing</th><th>R<sub>u</sub> (kip)</th><th>(R<sub>sb</sub>)<sub>r</sub> (kip)</th><th>P<sub>r</sub> (kip)</th><th>Welds R<sub>r</sub> (kip)</th><th>Ratio</th></tr></thead><tbody>
      ${R.BS.rows.map((r, i) => { const q = Math.max(r.Ru / r.Rsb, r.Ru / r.Pr, r.Ru / r.Rweld); return `<tr data-sh="bs:${i}" class="${S.sel && S.sel.k === 'bs' && S.sel.i === i ? 'sel' : ''}${R.bsGov && R.bsGov.i === i ? ' fx-gov' : ''}"><td class="lft">${esc(r.name)} (Type ${esc(r.type)})</td><td>${fmt(r.Ru, 1)}</td><td>${fmt(r.Rsb, 1)}</td><td>${fmt(r.Pr, 1)}</td><td>${fmt(r.Rweld, 1)}</td><td class="${cls(q)}">${fmt(q, 3)}</td></tr>`; }).join('')}
      </tbody></table></div><p class="note">Checks: ${R.bsC.map(c => `${esc(c.id)} ${tt(c.title)} (${esc(c.status)})`).join('; ')}.</p></div></section>`;
    // worked steps of the selection
    const sel = S.sel || { k: 'pan', i: 0 }; let title = '', list = [];
    if (sel.k === 'pan' && R.panels.rows[sel.i]) { const q = R.panels.rows[sel.i]; title = `panel ${fmt(q.p, 2)}–${fmt(q.q, 2)} ft`; list = stepsOf(R, 'pan', q); }
    else if (sel.k === 'loc' && R.stations[sel.i]) { const r = R.stations[sel.i]; title = r.name; list = stepsOf(R, 'loc', r); }
    else if (sel.k === 'ts' && R.TS && R.TS.rows[sel.i]) { const r = R.TS.rows[sel.i]; title = `${r.name} (Type ${r.type})`; list = stepsOf(R, 'ts', r); }
    else if (sel.k === 'bs' && R.BS.rows[sel.i]) { const r = R.BS.rows[sel.i]; title = `${r.name} (Type ${r.type})`; list = stepsOf(R, 'bs', r); }
    if (list.length) { const SS = window.SharedSteps, an = R.AR ? ' <a href="#" class="sg-see" data-gotab="an">worked on the Analysis tab</a>' : '';
      // "see" links (CLAUDE.md §6): the shears and reactions of the demand topics are worked on the Analysis tab when the analysis is the source
      h += `<section class="sec"><div class="secHead">Worked steps, ${esc(title)}</div><div class="secBody"><p class="note">Click a row above, or a location on the graphic, to show its work. AASHTO LRFD 10th Ed. (2024); E = 29,000 ksi. Topics in the order of the check: geometry, demands, intermediate values by sub-article, resistance, ratio.</p>
        ${SS.groupsHTML(groups(sel.k, list), { open: S.open, item: s => stepLi(s, list), see: t => (t.key === 'dem' && (sel.k === 'ts' || sel.k === 'bs' || sel.k === 'loc') ? an : '') })}</div></section>`; }
    return h;
  }

  /* stepsOf(R, kind, o): the worked steps of a panel ('pan'), station ('loc'), transverse stiffener ('ts') or bearing ('bs'); with custom
     demands the step that names them first ("Demands: entered (Custom)", custom demands PR) */
  function stepsOf(R, kind, o) {
    const SB = window.SBDStiffeners, list = kind === 'ts' ? SB.transverseSteps(R.TS, o) : kind === 'bs' ? SB.bearingSteps(R.BS, o) : o.steps;
    if (!R.custom) return list;
    const CD = window.SBDCustomDemands, sup = R.gm.sup, k = kind === 'bs' ? sup.findIndex(x => (o.name || '').startsWith((x === 0 ? 'Abut. 1' : x === sup[sup.length - 1] ? 'Abut. 2' : `Pier ${sup.indexOf(x)}`) + ',')) : -1;
    return [CD.step('shear', R.custom, kind === 'pan' ? (o.p + o.q) / 2 : o.x != null ? o.x : 0, kind === 'bs' ? { sup: k } : kind === 'pan' ? { range: [o.p, o.q] } : null)].concat(list);
  }

  window.SBDShearUI = { fromAnalysis, ensure, inputs, onClick, render, build, TOPICS, groups, stepsOf };
})();
