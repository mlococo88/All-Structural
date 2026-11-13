/* apps/ps-bridge/report/data.js — the results the calculation report shows (window.PSBReportData). Classic script, no DOM.
   Created 2026-11-13 (PR 2e). As apps/steel-bridge/report/data.js (window.SBDReportData) the report takes each result from the same
   function its output tab uses, with the same inputs; here they are the page's own result (index.html result(): R = PSBHoldDown.compute
   of the design inputs, i.e. computeAll + the PS-10 check, and the worked steps of every tab) when the page passes it, else the same
   calls made here (tests, or a page without its result). Nothing is calculated here.

   compute(P, rc, mode) -> bundle { P, inp, R, W, sel, err, all, cell, mode, units, multi }; rc = { inp, R, W, all } (index.html result()) or
   null. PR 3a-2: all = every girder type × line (PSBBridge.results), cell = the type and line reported (PSBBridge.shown). PS-25: mode 'gov'
   (default) | 'all', units = the type × line results worked in full (units()), multi = the report works them (not one girder shown).
   worked(inp, R) -> the worked steps of every result tab (the list index.html result() makes). */
(function () {
  'use strict';
  const W = () => window;
  function worked(inp, R) {
    const PW = W().PSBWorked, PS = W().PSBWorkedStress, PG = W().PSBWorkedStrength, PE = W().PSBWorkedEnd, PH = W().PSBWorkedHDR;
    return { section: PW.section(inp, R), loads: PW.loads(inp, R), analysis: PW.analysis(inp, R), losses: PS.losses(inp, R), stresses: PS.stresses(inp, R),
      flexure: PG.flexure(inp, R), shear: PG.shear(inp, R), endzone: PE.endzone(inp, R), camber: PE.camber(inp, R),
      handling: PH.handling(inp, R), deck: PH.deck(inp, R), rating: PH.rating(inp, R) };
  }
  /* units(P, B, mode): PS-25 (engineer decision 2026-11-13): the girder type × line results the Report works in full: each girder type on
     its governing line (mode 'gov', the default: the line whose largest check ratio is the largest; on a tie the next largest ratio
     decides, and so on; a full tie: the first line) or every girder type × line (mode 'all'), in the order of the types and lines; each with its engine inputs and result (the same
     objects as the Summary's, B.all) and its worked steps (worked(), + the DC2 / DW steps of its line). A cell with an engine error is left
     out (§1 lists it). */
  function units(P, B, mode) {
    const SU = W().PSBSummaryUI; if (!B.all || !SU) return null;
    // the governing line of a type: the largest check ratio; on a tie (a check that does not depend on the line, e.g. the hold-down force)
    // the next largest, and so on (the ratios of each line sorted from the largest); a full tie: the first line
    const SM = SU.model(P, B.all), desc = z => z.c.R.checks.map(q => q.r).filter(r => typeof r === 'number' && !isNaN(r)).sort((a, b) => b - a);
    const better = (z, b) => { if (!b) return true; const x = desc(z), y = desc(b); for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
    const cs = mode === 'all' ? [].concat(...SM.types.map(T => T.lines.filter(z => !z.err))) : SM.types.map(T => T.lines.filter(z => !z.err).reduce((b, z) => (better(z, b) ? z : b), null)).filter(Boolean);
    return cs.map(z => { const c = z.c, PV = Object.assign({}, P, { design: { g: c.g, s: c.s } }), Wk = worked(c.inp, c.R);
      if (W().PSBBridgeDL) W().PSBBridgeDL.withSteps(Wk.loads, PV);
      return { k: c.k, g: c.g, s: c.s, label: c.label, P: PV, inp: c.inp, R: c.R, W: Wk }; });
  }
  function compute(P, rc, mode) {
    const sel = W().PSBDesign.sel(P), B = { P, sel, inp: null, R: null, W: null, err: '' };
    const E = W().PSBInputCheck.collect(P).errors;
    if (E.length) { B.err = `${E.length} input error${E.length > 1 ? 's' : ''} to fix first (listed on the output panel).`; return B; }
    // PR 3a-2: every girder type × line (engine/bridge.js results; the page's own when it passes them), for §1's table of every type and line
    const BR = W().PSBBridge;
    B.all = rc && rc.all ? rc.all : (BR && BR.hasTypes(P) ? BR.results(P, inp => W().PSBHoldDown.compute(JSON.parse(JSON.stringify(inp)))) : null);
    B.cell = BR && BR.hasTypes(P) ? BR.shown(P) : null;
    // PS-25: the worked units; several (or one that is not the girder shown): the report works each (report/builders.js multiSecs)
    B.mode = mode === 'all' ? 'all' : 'gov';
    try { B.units = units(P, B, B.mode); } catch (e) { B.units = null; B.err = 'The worked girders of the report: ' + (e && e.message); return B; }
    const one = () => B.units.length === 1 && B.cell && B.units[0].k === B.cell.k && B.units[0].g === B.cell.g;
    B.multi = !!(B.units && B.units.length && !one());
    if (rc && rc.R && rc.W && !rc.R.error) { B.inp = rc.inp; B.R = rc.R; B.W = rc.W; return B; }
    try { B.inp = W().PSBDesign.inputs(P); B.R = W().PSBHoldDown.compute(JSON.parse(JSON.stringify(B.inp))); } catch (e) { B.err = 'The engine could not compute this design: ' + (e && e.message); return B; }
    if (B.R.error) { B.err = 'The engine could not compute this design: ' + B.R.error; return B; }
    try { B.W = worked(B.inp, B.R); if (W().PSBBridgeDL) W().PSBBridgeDL.withSteps(B.W.loads, P); } catch (e) { B.err = 'Worked steps: ' + (e && e.message); }   // PR 3a-3: + the DC2 / DW distribution steps
    return B;
  }
  window.PSBReportData = { compute, worked, units };
})();
