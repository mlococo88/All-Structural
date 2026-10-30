/* apps/steel-bridge/report/data.js — the results the calculation report shows (window.SBDReportData). Classic script, no DOM.
   Created 2026-10-30 (Report tab, docs/REBUILD_PLAN.md §5). Nothing is calculated here: each module's result is taken from the same
   function its own output tab calls, with the same inputs, so the report shows the tab's numbers and steps:
     loads        ui/loads.js calc(P, g)                                   (Loads & LLDF tab)
     analysis     engine/analysis.js analyzeGirder(P, g)                   (Analysis tab)
     sections     engine/sections.js card() per plate segment, as index.html calc() (Section properties tab)
     flexure      this app's analysis: the flexure of ui/rating.js build() (engine/flexure.js on the analysis stations, the locations
                  the Rating tab rates); a hand-off file: ui/flexure.js build() (the Flexure tab with that file)
     shear        ui/shear.js build() with the demand source 'analysis' or the file (Shear & stiffeners tab)
     fatigue      ui/fatigue.js build() likewise (Fatigue & studs tab)
     constr       engine/constructibility.js fromAnalysis / fromPayload + girder(), as ui/constructibility.js calc() (Constructibility tab),
                  f_ℓ during deck placement 0 (the tab's default; its entry is not saved)
     framing      ui/framing.js build() (Cross-frames tab)
     splices      engine/splices.js girder() on the analysis, as ui/splices.js calc() (Field splices tab); this app's analysis only
     rating       ui/rating.js build() (Rating tab)
   The full analysis (live load, a few seconds) is run once and shared by the modules for this build (analyzeGirder is memoised for
   the duration of compute(), keyed by girder and options; the modules only read its result: tests/engine/report.test.mjs checks it).

   compute(P, g, opt) -> bundle; opt = { src: 'analysis' (default) | 'file', pl (hand-off payload, src 'file'), plName, want: { key: true }
   (the sections to compute; default all) }. Each module's failure is caught and reported in bundle.err[key]; the rest still build. */
(function () {
  'use strict';
  const W = () => window;
  function compute(P, g, opt) {
    opt = opt || {}; g = g || 0;
    const src = opt.src === 'file' ? 'file' : 'analysis', pl = src === 'file' ? opt.pl : null, want = opt.want || null, on = k => !want || !!want[k];
    const B = { P, g, src, pl, plName: opt.plName || '', err: {}, girder: P.girders[g] || P.girders[0], t: {} };
    if (src === 'file' && !pl) { B.err.all = 'Choose a hand-off file (GirderDetail → ST-Girder demands, .json).'; return B; }
    const AN = W().SBDAnalysis, orig = AN && AN.analyzeGirder, memo = new Map();
    if (AN) AN.analyzeGirder = (P_, gi, o) => { if (P_ !== P) return orig(P_, gi, o); const k = gi + '|' + JSON.stringify(o || {}); if (!memo.has(k)) memo.set(k, orig(P_, gi, o)); return memo.get(k); };
    B.memo = memo;
    const run = (k, f) => { const t0 = Date.now(); try { const r = f(); if (r && r.err) { B.err[k] = r.err; return null; } return r; } catch (e) { B.err[k] = 'Calculation error: ' + (e && e.message); return null; } finally { B.t[k] = Date.now() - t0; } };
    try {
      const sup0 = [0]; P.spans.lengths.forEach(L => sup0.push(sup0[sup0.length - 1] + +L));
      if (on('loads') || on('proj')) B.loads = run('loads', () => { const R = W().SBDUiLoads.calc(P, g); return R.errors && R.errors.length ? { err: R.errors.map(e => e.msg || e).join(' ') } : R; });
      if (src === 'analysis' && (on('an') || on('spl') || on('flex') || on('rt') || on('shear') || on('fat') || on('sum'))) B.an = run('an', () => { const A = AN.analyzeGirder(P, g); return A.errors && A.errors.length ? { err: 'Analysis: ' + A.errors.map(e => e.msg || e).join(' ') } : A; });
      if (on('sec')) B.sec = run('sec', () => sections(P, g, B.an ? B.an.sup : pl ? (pl.member || {}).supports : sup0));
      if (on('rt') || on('flex') || on('sum')) B.rating = run('rt', () => W().SBDRatingUI.build(src === 'file' ? { P, g, pl } : { P, g, src: 'analysis' }));
      if (on('flex') || on('sum')) B.flex = src === 'file' ? run('flex', () => W().SBDFlexureUI.build({ P, g, src: 'file', pl, plName: B.plName, fl: 0, method: 'auto' })) : B.rating ? B.rating.flex : (B.err.flex = B.err.rt, null);
      if (on('shear') || on('sum')) B.shear = run('shear', () => W().SBDShearUI.build(src === 'file' ? { P, g, pl } : { P, g, src: 'analysis' }));
      if (on('fat') || on('sum')) B.fat = run('fat', () => W().SBDFatigueUI.build(src === 'file' ? { P, g, pl } : { P, g, src: 'analysis' }));
      if (on('cn') || on('sum')) B.cn = run('cn', () => constr(P, g, pl));
      if (on('frm') || on('sum')) B.frm = run('frm', () => W().SBDFramingUI.build({ P, g }));
      if ((on('spl') || on('sum')) && src === 'analysis') B.spl = run('spl', () => { if (!((P.framing || {}).splices || []).length) return { err: 'No field splice stations: enter them on the Splices tab.' };
        if (!B.an) return { err: B.err.an || 'No analysis.' }; return W().SBDSplices.girder(P, g, B.an, { env: W().SBDSplicesUI.envOf(P) }); });
    } finally { if (AN) AN.analyzeGirder = orig; }
    B.sup = B.an ? B.an.sup : pl ? ((pl.member || {}).supports || []).map(Number) : null;
    return B;
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

  /* constructibility, as ui/constructibility.js calc() (f_ℓ during deck placement 0) */
  function constr(P, g, pl) {
    const C = W().SBDConstr, FRM = W().SBDFraming;
    let F;
    if (pl) { const gdF = pl.girderDetail || {}, frF = FRM && P.framing ? FRM.forGirder(P, { line: (+gdF.girder || 1) - 1 }, (pl.member || {}).supports) : null;
      F = C.fromPayload(pl, { flC: 0, ...(frF ? { braces: frF.braces } : {}) }); }
    else { const AR = W().SBDAnalysis.analyzeGirder(P, g, { ll: false }); if (AR.errors && AR.errors.length) return { err: 'Analysis: ' + AR.errors.join(' ') };
      const frA = FRM && P.framing ? FRM.forGirder(P, { gi: g }, null) : null;
      F = C.fromAnalysis(P, g, AR, { flC: 0, oh: { ...C.OH_DEF, ...((P.constr && P.constr.oh) || {}) }, ...(frA ? { braces: frA.braces } : {}) }); F.AR = AR; F.frA = frA; }
    const R = C.girder(F.locs, F.prj, { supports: F.supports, oh: F.oh });
    return { ...R, F, ext: F.ext };
  }

  window.SBDReportData = { compute };
})();
