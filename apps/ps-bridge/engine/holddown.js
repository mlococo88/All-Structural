/* apps/ps-bridge/engine/holddown.js — the optional hold-down force check for AASHTO and RIDOT projects (window.PSBHoldDown).
   Classic script, no DOM. Created 2026-11-13 (PR 2d-3, docs/ps-bridge-plan.md §4 and §6 PS-10, engineer 2026-11-12: "hold-down limit for
   AASHTO / RIDOT projects: an optional box, default on, limit 75 % of the beam weight, editable").
   AN ENGINE ADDITION (CLAUDE.md §4; fixlog/ps-bridge.md, PR 2d-3): the moved engine (engine/pbd-*.js, verbatim, frozen) checks the hold-down
   force only where an owner rule sets it (MassDOT 3.7.2.2, CTDOT V2 5.9.1.6: R.own.hd and the check "Hold-down force (MassDOT 3.7.2.2)" /
   "(CTDOT 5.9.1.6)"). AASHTO LRFD sets no limit on the hold-down force; the 75 % comes from those two owner manuals. This file adds the same
   check, with the same expressions as the engine's owner check (pbd-compute.js computeAll, "Hold-down force of all draped strands"), after
   computeAll, for an owner without that rule (AASHTO, RIDOT), when the project's box is on:
     α = atan(tan α) (ss.slope: (y_end − y_mid) / (12 frac L)),  F_str = f_pbt A_b sin α (at jacking, before transfer),  F_hd = 2 n_h F_str,
     L_g = L + 2 e_end / 12,  W = w_sw L_g,  limit = f W  (f = base.opt.hdFrac, default 0.75),  ratio F_hd / limit (PASS ≤ 1.0001, as checksF).
   The moved files are not changed, so the verbatim and parity tests (harness A) still hold; computeAll's own result is unchanged except that
   this adds R.ps10 and one check at the end of R.checks.
   Inputs (psb2 project, base.opt; optional within schema version 1, filled by engine/model.js baseInputs for new and existing projects):
     hdCheck (true / false, default true), hdFrac (the limit as a fraction of the beam weight, default 0.75).
   apply(inp, R) -> R (with R.ps10 = { nh, slope, alpha, Ab, Fstr, Ftot, Lg, wsw, W, frac, lim, owner } when checked, or { off: true, owner }
   when the box is off; nothing when the owner has its own rule, when there are no draped strands or when R has an error);
   compute(inp) = apply(inp, computeAll(inp)): what the page, its tests and harness B use. */
(function () {
  'use strict';
  const NAME = 'Hold-down force (PS-10)', FRAC = 0.75;
  const fracOf = o => { const f = o && o.hdFrac; return typeof f === 'number' && isFinite(f) && f > 0 ? f : FRAC; };
  function apply(inp, R) {
    if (!R || R.error || !R.ss || !(R.ss.nh > 0)) return R;
    if (R.own && R.own.hd) return R;   // the owner's rule (MassDOT, CTDOT) is checked by the engine itself
    const P_ = window.PBD, owner = P_ && P_.ownerOf ? P_.ownerOf(inp) : (inp.owner || 'AASHTO');
    if (P_ && P_.ownRule && P_.ownRule(owner, 'hd.max')) return R;
    const o = inp.opt || {};
    if (o.hdCheck === false) { R.ps10 = { off: true, owner }; return R; }
    const ss = R.ss, L = R.L, frac = fracOf(o);
    const alpha = Math.atan(ss.slope), Fstr = R.fpbt * ss.st.Ab * Math.sin(alpha), Ftot = 2 * ss.nh * Fstr;
    const Lg = L + 2 * (+o.endOh || 0) / 12, W = R.g.wsw * Lg, lim = frac * W, r = lim > 0 ? Ftot / lim : Infinity;
    R.ps10 = { nh: ss.nh, slope: ss.slope, alpha, Ab: ss.st.Ab, Fstr, Ftot, Lg, wsw: R.g.wsw, W, frac, lim, owner };
    R.checks.push({ n: NAME, v: Ftot, lim, r, loc: ss.hp.frac * L, u: 'kip', pass: r <= 1.0001 });
    return R;
  }
  const compute = inp => apply(inp, computeAll(inp));
  window.PSBHoldDown = { NAME, FRAC, apply, compute, fracOf };
})();
