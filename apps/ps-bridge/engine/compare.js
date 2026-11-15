/* apps/ps-bridge/engine/compare.js — the Compare tab's design sweep (window.PSBCompare). Classic script, no DOM. Created 2026-11-15
   (batch G4: the old app's Compare tab, O:8009-8034, "Design Comparison Sweep": the full design re-run over a range of spans, girder
   sections or girder spacings, everything else held as entered, and the governing demand / capacity of each).

   The old tab called the moved engine's sweepDesign (engine/pbd-optimize.js, frozen) with its presets. sweepDesign calls the global
   computeAll, not this app's engine call PSBHoldDown.compute (computeAll + the rigid section on the real girder lines PS-19, the type (f) /
   (g) distribution factors of box beams and voided slabs PS-35, the hold-down check PS-10, the pier block PS-34): with it a candidate would
   be judged by other numbers than the app's own result tabs show. So run() repeats sweepDesign's body (the same input changes, the same
   "core" checks: every check but Deck / Lifting / Hauling / FS, the same fields) on the page's engine call; nothing is calculated here.
   Decision (pending engineer review; recorded in the PR and the fix log only): the sweep uses the app's engine call, not the raw computeAll.
   tests/engine/psbridge-compare-tab.test.mjs: for a design the app's additions do not touch, run() = sweepDesign() field by field.

   presets(inp, mode) -> values   the old tab's presets (O:8012-8016): span L − 20 … L + 20 by 10 (> 20 ft), every library girder but Custom,
                                  spacing S − 1 … S + 1 by 0.5 (> 3 ft)
   inputsOf(inp, mode, v) -> inp  a copy with L, girder or S set (spacing: equal bays at S, so inputs.rigidX of unequal bays is dropped)
   one(inp, mode, v, compute) -> row  { v, pass, maxDC, flex, s3, rel, shear, camber, nPass, nTot, gov, fails } or { v, error }
   run(inp, mode, values, compute) -> rows;  MODES: [[key, label, unit]] */
(function () {
  'use strict';
  const NOT_CORE = /Deck|Lifting|Hauling|FS/;   // sweepDesign's filter (pbd-optimize.js)
  const MODES = [['span', 'Span', 'ft'], ['girder', 'Girder section', ''], ['spacing', 'Girder spacing', 'ft']];
  function presets(inp, mode) {
    if (mode === 'span') return [inp.L - 20, inp.L - 10, inp.L, inp.L + 10, inp.L + 20].filter(v => v > 20);
    if (mode === 'girder') return Object.keys(GIRDERS).filter(k => k !== 'Custom');
    if (mode === 'spacing') return [inp.S - 1, inp.S - 0.5, inp.S, inp.S + 0.5, inp.S + 1].filter(v => v > 3);
    return [];
  }
  function inputsOf(inp, mode, v) {
    const i = JSON.parse(JSON.stringify(inp));
    if (mode === 'span') i.L = v;
    else if (mode === 'girder') i.girder = v;
    else if (mode === 'spacing') { i.S = v; delete i.rigidX; }
    return i;
  }
  const engine = () => (window.PSBHoldDown ? window.PSBHoldDown.compute : computeAll);
  function one(inp, mode, v, compute) {
    let R; try { R = (compute || engine())(inputsOf(inp, mode, v)); } catch (e) { R = { error: e.message }; }
    if (R.error) return { v, error: R.error };
    const core = R.checks.filter(c => !NOT_CORE.test(c.n)), r = n => { const c = R.checks.find(q => q.n === n); return c ? c.r : NaN; };
    const gov = core.reduce((b, c) => (c.r > b.r ? c : b), core[0] || { n: '', r: -Infinity });
    return { v, pass: core.every(c => c.pass), maxDC: Math.max(...core.map(c => c.r)), flex: r('Flexure'), s3: r('Srv III tens'), rel: r('Release comp'), shear: r('Shear'),
      camber: R.cam.final, nPass: core.filter(c => c.pass).length, nTot: core.length, gov: gov.n, fails: core.filter(c => !c.pass).map(c => c.n) };
  }
  const run = (inp, mode, values, compute) => values.map(v => one(inp, mode, v, compute));
  window.PSBCompare = { MODES, NOT_CORE, presets, inputsOf, one, run };
})();
