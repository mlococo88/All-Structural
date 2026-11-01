/* apps/steel-bridge/report/data.js — the results the calculation report shows (window.SBDReportData). Classic script, no DOM.
   Created 2026-10-30 (Report tab, docs/REBUILD_PLAN.md §5). Nothing is calculated here: each module's result is taken from the same
   function its own output tab calls, with the same inputs, so the report shows the tab's numbers and steps:
     loads        ui/loads.js calc(P, g)                                   (Loads & LLDF tab)
     analysis     engine/analysis.js analyzeGirder(P, g)                   (Analysis tab)
     sections     engine/sections.js card() per plate segment, as index.html calc() (Section properties tab)
     flexure      ui/flexure.js build() (the Flexure tab): this app's analysis (its "This project's analysis" source, Appendix A6 where
                  permitted; since 2026-10-30, report wiring PR: before, the flexure of ui/rating.js build()), or the hand-off file. f_ℓ and
                  the brace points are the tab's (paths PR, 2026-10-30: f_ℓ entered on the Flexure tab, else from skew, C6.10.1; the
                  Spans & framing tab's brace points; engine/framing.js design; before: f_ℓ = 0). Since the paths PR the rating's flexure IS this
                  module's build (ui/rating.js), so with the analysis the report takes the rating's result (flexSame, checked here) and
                  the rating's capacity links point at the Flexure section's locations
     shear        ui/shear.js build() with the demand source 'analysis' or the file (Shear & stiffeners tab)
     fatigue      ui/fatigue.js build() likewise (Fatigue & studs tab)
     constr       ui/constructibility.js build() (Constructibility tab; since the paths PR, 2026-10-30: before, a copy of its calc() here),
                  f_ℓ during deck placement P.constr.flC (saved with the project since 2026-10-30), else from skew (C6.10.1; paths PR)
     framing      ui/framing.js build() (Cross-frames tab)
     splices      engine/splices.js girder() on the analysis, as ui/splices.js calc() (Field splices tab); this app's analysis only
     rating       ui/rating.js build() (Rating tab)
     welds        ui/welds.js build() (Welds tab; added 2026-10-30, paths PR), this app's analysis or the hand-off file
   The full analysis (live load, a few seconds) is run once and shared by the modules for this build (analyzeGirder is memoised for
   the duration of compute(), keyed by girder and options; the modules only read its result: tests/engine/report.test.mjs checks it).
   Since 2026-10-30 (report wiring PR, every-girder report) the memo is kept between builds: analysis(P, gi, o) caches each girder's
   analysis by the project's state (its JSON without the rating factors, which the analysis does not read), girder and options, so a
   girder's report after the every-girder summary (or a rebuild) does not run its analysis again; any change to the project is a new key.
   install() (added 2026-10-30, paths PR; called once by index.html) puts every caller of SBDAnalysis.analyzeGirder through that cache:
   the output tabs (Analysis, Flexure, Shear, Fatigue, Constructibility, Cross-frames, Splices, Rating, Welds) and the report share one
   analysis per project state, girder and options, so switching tabs does not run the analysis again.

   compute(P, g, opt) -> bundle; opt = { src: 'analysis' (default) | 'file' | 'tabs' (each module's tab choice: Custom where chosen, else 'analysis'), pl (hand-off payload, src 'file'), plName, want: { key: true }
   (the sections to compute; default all) }. Each module's failure is caught and reported in bundle.err[key]; the rest still build. */
(function () {
  'use strict';
  const W = () => window;
  /* the analysis cache (LRU, at most 2 entries per girder + 4): key = project state | girder | options */
  const CACHE = new Map();
  const pkOf = P => JSON.stringify({ ...P, rating: undefined, flexure: undefined, custom: undefined, demandSrc: undefined });   // the rating factors (P.rating), the f_ℓ entered on the Flexure tab (P.flexure), the custom demands and the demand choices (P.custom, P.demandSrc) are not read by the analysis
  let RAW = null;   // engine/analysis.js analyzeGirder itself, once install() has put the cache in front of it
  function analysis(P, gi, o, pk, orig) {
    const AN = W().SBDAnalysis, run = orig || RAW || AN.analyzeGirder, k = (pk || pkOf(P)) + '|' + gi + '|' + JSON.stringify(o || {});
    if (CACHE.has(k)) { const v = CACHE.get(k); CACHE.delete(k); CACHE.set(k, v); return v; }
    const v = run(P, gi, o); CACHE.set(k, v);
    const max = 2 * ((P.girders || []).length || 1) + 4; while (CACHE.size > max) CACHE.delete(CACHE.keys().next().value);
    return v;
  }
  /* install(): every call of SBDAnalysis.analyzeGirder goes through the cache (once; returns false when already installed or no engine) */
  function install() {
    const AN = W().SBDAnalysis; if (!AN || RAW) return false;
    RAW = AN.analyzeGirder; const cached = (P, gi, o) => analysis(P, gi, o, null, RAW); cached.cached = true; AN.analyzeGirder = cached; return true;
  }
  function compute(P, g, opt) {
    opt = opt || {}; g = g || 0;
    const src = opt.src === 'file' ? 'file' : 'analysis', pl = src === 'file' ? opt.pl : null, want = opt.want || null, on = k => !want || !!want[k];
    // opt.src 'tabs' (custom demands PR, 2026-11-01): a module whose tab has "Custom (entered)" chosen (P.demandSrc) takes its entered rows,
    // the rest this project's analysis
    const CD = W().SBDCustomDemands, cu = k => opt.src === 'tabs' && !!CD && CD.srcGet(P, k) === 'custom';
    const B = { P, g, src, pl, plName: opt.plName || '', err: {}, girder: P.girders[g] || P.girders[0], t: {}, custom: ['flex', 'shear'].filter(cu).length ? { flex: cu('flex'), shear: cu('shear') } : null };
    if (src === 'file' && !pl) { B.err.all = 'Choose a hand-off file (GirderDetail → ST-Girder demands, .json).'; return B; }
    const AN = W().SBDAnalysis, orig = AN && AN.analyzeGirder, memo = new Map();
    const pk = AN ? pkOf(P) : '';
    if (AN) AN.analyzeGirder = (P_, gi, o) => { if (P_ !== P) return orig(P_, gi, o); const k = gi + '|' + JSON.stringify(o || {}); if (!memo.has(k)) memo.set(k, analysis(P_, gi, o, pk, RAW || orig)); return memo.get(k); };
    B.memo = memo;
    const run = (k, f) => { const t0 = Date.now(); try { const r = f(); if (r && r.err) { B.err[k] = r.err; return null; } return r; } catch (e) { B.err[k] = 'Calculation error: ' + (e && e.message); return null; } finally { B.t[k] = Date.now() - t0; } };
    try {
      const sup0 = [0]; P.spans.lengths.forEach(L => sup0.push(sup0[sup0.length - 1] + +L));
      if (on('loads') || on('proj')) B.loads = run('loads', () => { const R = W().SBDUiLoads.calc(P, g); return R.errors && R.errors.length ? { err: R.errors.map(e => e.msg || e).join(' ') } : R; });
      if (src === 'analysis' && (on('an') || on('spl') || on('flex') || on('rt') || on('shear') || on('fat') || on('sum'))) B.an = run('an', () => { const A = AN.analyzeGirder(P, g); return A.errors && A.errors.length ? { err: 'Analysis: ' + A.errors.map(e => e.msg || e).join(' ') } : A; });
      if (on('sec')) B.sec = run('sec', () => sections(P, g, B.an ? B.an.sup : pl ? (pl.member || {}).supports : sup0));
      if (on('rt') || on('flex') || on('sum')) B.rating = run('rt', () => W().SBDRatingUI.build(src === 'file' ? { P, g, pl } : { P, g, src: 'analysis' }));
      // flexure: the Flexure module (f_ℓ and brace points as the tab: engine/framing.js design); with the analysis the rating's flexure is
      // that module's build already (ui/rating.js, paths PR): the same object, not built twice
      if (on('flex') || on('sum')) B.flex = cu('flex') ? run('flex', () => W().SBDFlexureUI.build({ P, g, src: 'custom', method: 'auto' })) : src === 'file' ? run('flex', () => W().SBDFlexureUI.build({ P, g, src: 'file', pl, plName: B.plName, method: 'auto' }))
        : run('flex', () => (B.rating && B.rating.flex ? B.rating.flex : W().SBDFlexureUI.build({ P, g, src: 'analysis', method: 'auto' })));
      if (src === 'analysis' && B.flex && B.rating) B.flexSame = linkRating(B.rating, B.flex);
      if (on('shear') || on('sum')) B.shear = run('shear', () => W().SBDShearUI.build(cu('shear') ? { P, g, src: 'custom' } : src === 'file' ? { P, g, pl } : { P, g, src: 'analysis' }));
      if (on('fat') || on('sum')) B.fat = run('fat', () => W().SBDFatigueUI.build(src === 'file' ? { P, g, pl } : { P, g, src: 'analysis' }));
      if (on('cn') || on('sum')) B.cn = run('cn', () => W().SBDConstrUI.build(src === 'file' ? { P, g, src: 'file', pl, plName: B.plName } : { P, g, src: 'project' }));
      if (on('frm') || on('sum')) B.frm = run('frm', () => W().SBDFramingUI.build({ P, g }));
      if ((on('spl') || on('sum')) && src === 'analysis') B.spl = run('spl', () => { if (!((P.framing || {}).splices || []).length) return { err: 'No field splice stations: enter them on the Splices tab.' };
        if (!B.an) return { err: B.err.an || 'No analysis.' }; return W().SBDSplices.girder(P, g, B.an, { env: W().SBDSplicesUI.envOf(P) }); });
      if (on('wd') || on('sum')) B.wd = run('wd', () => W().SBDWeldsUI.build(src === 'file' ? { P, g, src: 'file', pl, plName: B.plName } : { P, g, src: 'analysis' }));
    } finally { if (AN) AN.analyzeGirder = orig; }
    B.sup = B.an ? B.an.sup : pl ? ((pl.member || {}).supports || []).map(Number) : null;
    return B;
  }

  /* sameFlex(a, b): two engine/flexure.js girder() results with the same locations, demands, capacities and ratios (every check) */
  function sameFlex(a, b) {
    const eq = (x, y) => Object.is(x, y) || (typeof x === 'number' && typeof y === 'number' && x === y);
    if (!a || !b || a.rows.length !== b.rows.length) return false;
    return a.rows.every((r, i) => { const q = b.rows[i]; return r.name === q.name && eq(r.x, q.x) && r.pos === q.pos && eq(r.Mu, q.Mu) && eq(r.Ms, q.Ms) && r.checks.length === q.checks.length
      && r.checks.every((c, j) => { const d = q.checks[j]; return c.id === d.id && eq(c.demand, d.demand) && eq(c.capacity, d.capacity) && eq(c.ratio, d.ratio); }); });
  }
  /* linkRating(R, F): when the Flexure module's result F equals the rating's own flexure (R.flex), the rating's capacity map points at
     F's locations (the Flexure section of the report works them; the rating links there). Returns whether they are equal. */
  function linkRating(R, F) {
    if (!sameFlex(R.flex, F)) return false;
    const at = new Map(R.flex.rows.map((r, i) => [r, F.rows[i]]));
    R.cap.forEach((r, q) => { if (at.has(r)) R.cap.set(q, at.get(r)); });
    return true;
  }

  /* section properties of every plate segment (index.html calc(): owner rules OWN8 haunch, OWN17 w_c for E_c); the positive region for
     every segment, the negative region too where the segment touches an interior support */
  function sections(P, g, sup) {
    const M = W().SBDModel, SEC = W().SBDSections, OWN = W().SBDOwners, G = M.GRADES, m = P.materials, d = P.deck, gd = P.girders[g] || P.girders[0];
    const lf = OWN.loadFactors(P.ownerRules.owner, P.ownerRules.eta, (P.xs || {}).nb);
    const nr = SEC.modularRatio(m.concrete.fc, m.concrete.wcE > 0 ? m.concrete.wcE : m.concrete.wc, m.concrete.K1, m.concrete.nRule);
    const deck = { composite: d.composite, ts: d.ts, haunch: OWN.haunchInProps(d.haunch, lf), beff: gd.beff, rebar: d.rebar };
    const mat = { Fyt: G[m.steel.top].Fy, Fyb: G[m.steel.bot].Fy, Fyw: G[m.steel.web].Fy, Fyr: m.rebar.Fyr, fc: m.concrete.fc };
    const piers = (sup || []).slice(1, -1), cont = P.spans.continuity !== 'simple' && piers.length > 0;
    const cards = [];
    gd.segments.forEach((s, i) => {
      const plates = { D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT };
      const regs = ['pos']; if (cont && piers.some(x => x >= s.x0 - 1e-6 && x <= s.x1 + 1e-6)) regs.push('neg');
      regs.forEach(region => cards.push({ i, seg: s, region, c: SEC.card(plates, deck, mat, nr.n, { region, rebarInPositive: d.rebarInPositiveMp }) }));
    });
    return { nr, lf, cards };
  }

  window.SBDReportData = { compute, analysis, install, sameFlex, cache: CACHE };
})();
