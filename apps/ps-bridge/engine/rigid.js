/* apps/ps-bridge/engine/rigid.js — the exterior girder's rigid cross-section live-load distribution (AASHTO LRFD 10th Ed. Eq. C4.6.2.2.2d-1)
   from the ACTUAL girder positions (window.PSBRigid). Classic script, no DOM. Created 2026-11-13 (engineer decision PS-19, 2026-11-13: "the
   exterior rigid-section check uses the actual girder positions from the bays (Σx², X_ext from real positions); identical for equal bays").

   AN ENGINE ADDITION (CLAUDE.md §4; fixlog/ps-bridge.md PR PS-19), made app-side as engine/holddown.js: the moved engine (engine/pbd-*.js,
   verbatim, frozen) is NOT edited. Its distFactors (pbd-lldf-flexure.js) places N_b girders at an equal spacing S:
       X_ext = (N_b − 1) S / 2,  Σx² = Σ (−X_ext + i S)²,  R = m (N_L / N_b + X_ext Σe / Σx²),  e_j = X_ext + d_e − 5 − 12 j  (ft).
   With unequal bays this file gives the same expression on the real girder lines (x_i from the bays, x̄ their mean):
       X_ext = |x_ext − x̄|,  Σx² = Σ (x_i − x̄)²,  e_j = X_ext + d_e − 5 − 12 j,  R = m (N_L / N_b + X_ext Σe / Σx²)
   and the exterior factors that use R (g_M = max(e_M g_M2, g_lever, R), g_V = max(e_V g_V2, g_lever, R), × the skew factors, and the one-lane
   R for the fatigue DF) exactly as the engine's lines that follow it.
   How: engine/design.js adds inputs.rigidX = { x: [ft from G1, every girder], g } ONLY when the bays are unequal (equal bays: the inputs, and
   so every result, are byte-identical to before); run(inp) calls computeAll with the global distFactors wrapped for that one call (the
   engine's own distFactors first, then its exterior rigid terms recomputed here), restored after. PSBHoldDown.compute uses run().
   run(inp) -> computeAll result; adjust(df, inp) -> df; rigidOf(x, g, de, NL, Nb) -> { R, NL, R1, Xext, sumX2, xbar, trials }. */
(function () {
  'use strict';
  const MPF = [1.2, 1.0, 0.85, 0.65];
  const clampI = (v, a, b) => Math.min(Math.max(v, a), b);
  /* rigidOf(x, g, de, NLin): the rigid-section factor of girder g (1-based) on the girder lines x (ft), the engine's loop on real positions */
  function rigidOf(x, g, de, NLin) {
    const Nb = x.length, xbar = x.reduce((a, v) => a + v, 0) / Nb, Xext = Math.abs(x[g - 1] - xbar);
    const sumX2 = x.reduce((a, v) => a + (v - xbar) * (v - xbar), 0), NLmax = clampI(Math.round(+NLin || 1), 1, 4);
    let R = 0, RNL = 0, R1 = 0; const trials = [];
    for (let NL = 1; NL <= NLmax; NL++) {
      let sumE = 0; for (let j = 0; j < NL; j++) sumE += Xext + de - 5 - 12 * j;
      const rr = MPF[NL - 1] * (NL / Nb + Xext * sumE / sumX2); trials.push({ NL, sumE, r: rr });
      if (NL === 1) R1 = rr;
      if (rr > R) { R = rr; RNL = NL; }
    }
    return { R, NL: RNL, R1, Xext, sumX2, xbar, trials };
  }
  /* adjust(df, inp): the engine's distFactors result with the rigid-section terms on the real girder lines (exterior I-girder only) */
  function adjust(df, inp) {
    const q = inp && inp.rigidX; if (!df || !df.ext || df.isNext || df.fg || !q || !Array.isArray(q.x)) return df;   // df.fg (PS-35): types (f) / (g) have no rigid-section check
    const r = rigidOf(q.x, q.g, +inp.loads.de || 0, inp.loads.NL);
    const dfmRaw = Math.max(df.eM * df.m2, df.lever, r.R), dfvRaw = Math.max(df.eV * df.v2, df.lever, r.R);
    return Object.assign({}, df, { rigid: r.R, rigidNL: r.NL, rigid1: r.R1, dfmRaw, dfvRaw, dfm: dfmRaw * df.skM, dfv: dfvRaw * df.skV,
      rigidX: { Xext: r.Xext, sumX2: r.sumX2, xbar: r.xbar, x: q.x.slice(), g: q.g, trials: r.trials, engine: { rigid: df.rigid, rigidNL: df.rigidNL, dfm: df.dfm, dfv: df.dfv } } });
  }
  /* run(inp): computeAll(inp), with the rigid section on the real girder lines when inp.rigidX is given */
  function run(inp) {
    const W = typeof window !== 'undefined' ? window : globalThis;
    if (!inp || !inp.rigidX) return computeAll(inp);
    const orig = W.distFactors;
    W.distFactors = function (i, g, cp) { return adjust(orig(i, g, cp), i); };
    try { return computeAll(inp); } finally { W.distFactors = orig; }
  }
  window.PSBRigid = { rigidOf, adjust, run };
})();
