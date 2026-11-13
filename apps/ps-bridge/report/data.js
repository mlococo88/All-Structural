/* apps/ps-bridge/report/data.js — the results the calculation report shows (window.PSBReportData). Classic script, no DOM.
   Created 2026-11-13 (PR 2e). As apps/steel-bridge/report/data.js (window.SBDReportData) the report takes each result from the same
   function its output tab uses, with the same inputs; here they are the page's own result (index.html result(): R = PSBHoldDown.compute
   of the design inputs, i.e. computeAll + the PS-10 check, and the worked steps of every tab) when the page passes it, else the same
   calls made here (tests, or a page without its result). Nothing is calculated here.

   compute(P, rc) -> bundle { P, inp, R, W, sel, err }; rc = { inp, R, W } (index.html result()) or null.
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
  function compute(P, rc) {
    const sel = W().PSBDesign.sel(P), B = { P, sel, inp: null, R: null, W: null, err: '' };
    const E = W().PSBInputCheck.collect(P).errors;
    if (E.length) { B.err = `${E.length} input error${E.length > 1 ? 's' : ''} to fix first (listed on the output panel).`; return B; }
    if (rc && rc.R && rc.W && !rc.R.error) { B.inp = rc.inp; B.R = rc.R; B.W = rc.W; return B; }
    try { B.inp = W().PSBDesign.inputs(P); B.R = W().PSBHoldDown.compute(JSON.parse(JSON.stringify(B.inp))); } catch (e) { B.err = 'The engine could not compute this design: ' + (e && e.message); return B; }
    if (B.R.error) { B.err = 'The engine could not compute this design: ' + B.R.error; return B; }
    try { B.W = worked(B.inp, B.R); } catch (e) { B.err = 'Worked steps: ' + (e && e.message); }
    return B;
  }
  window.PSBReportData = { compute, worked };
})();
