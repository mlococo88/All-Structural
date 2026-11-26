/* apps/ps-bridge/engine/haunch.js — HP: the haunch along the girder from the camber at deck placement (window.PSBHaunch).
   Classic script, no DOM. Created 2026-11-25 (engineer decision 2026-11-25: t_h is the MINIMUM haunch, at midspan, at the girder centreline;
   fixlog/ps-bridge.md HP).

   AN ENGINE CORRECTION MADE APP-SIDE (CLAUDE.md §4): the moved engine (engine/pbd-*.js, verbatim, frozen) is NOT edited. Its computeAll
   tabulates the haunch at the tenth points as
       buildup(x) = max(t_h + Δ_deck ψ(x), 0.5),   ψ(x) = 4x(L − x)/L² (0 at the bearings, 1 at midspan),
   i.e. t_h at the bearings and t_h + Δ_deck at midspan. For a deck soffit on a straight grade the haunch is thinnest where the girder top is
   highest: with Δ_deck > 0 (camber up at deck placement) that is midspan. With t_h the minimum haunch at midspan the profile is
       t_h(x) = max(t_h + Δ_deck (1 − ψ(x)), 0.5):  t_h at midspan, t_h + Δ_deck at the bearings.
   Δ_deck < 0 (the girder sags at deck placement): decided by the engineer 2026-11-26: t_h stays at MIDSPAN always, so the same expression
   holds and the haunch at the bearings is max(t_h + Δ_deck, 0.5), thinner than t_h ("I don't want this sag case"). A sag warning is added
   (below) and the page shows it as a banner above every output tab. The 0.5 in floor is the engine's own (it binds for t_h + Δ_deck < 0.5 in,
   or t_h < 0.5 in). No vertical curve and no cross slope: the grade is taken straight along the girder.
   apply(inp, R) runs after computeAll (the last step of PSBHoldDown.compute) and replaces R.haunch[i].buildup with t_h(x_i); the engine's
   value is kept as R.haunch[i].buildup0. Nothing else of R changes: R.haunch is used by no check, load or ratio (it is shown on the Camber &
   deflection tab, its worked steps, the DXF camber sheet and the Report). The only additions are two warnings (below).
   RIDOT (owner RIDOT only; the other owners' rules are not added, fixlog HP): RIDOT BDM (April 2026) 9.4.6 requires a haunch thicker than
   4 in to be reinforced over the length where it is thicker than 4 in. When the largest t_h(x) of the girder exceeds 4 in, one warning is
   added to R.warns (I-girders and NEXT beams; box beams and deck slabs carry no haunch in this engine).
   Sag (every owner; engineer 2026-11-26): when Δ_deck < 0 on a section with a haunch, one warning is added to R.warns (SAG_RE) and kept as
   R.hp.sag: the girder sags at deck placement, and the haunch at the bearings t_h + Δ_deck is thinner than the entered t_h.
   Guard (no silent fallback): computeAll must still contain the anchor below once, and every R.haunch[i].buildup it returned must equal the
   engine's expression on inp.th and R.cam.afterDeck exactly; else an error is thrown, so that a later engine change is not corrected twice.

   apply(inp, R) -> R; R.hp = { th, d (Δ_deck), neg (Δ_deck < 0), mid, brg (t_h(x) at midspan and at the left bearing), min, max, xMax,
     owner, lim (4 for RIDOT, else null), warn (the warning text or null), sag (the sag warning text or null) }.
   R.hp.tol: HCT (camber tolerance, below; null when none is entered).
   profile(th, d, psi) -> t_h(x).   anchors() -> the anchor texts (for the tests).   WARN_RE: matches the RIDOT warning; SAG_RE: the sag warning. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const ANCHORS = ['const buildup=Math.max(inp.th + cam.afterDeck*par,0.5); // haunch needed to hold grade',
    'haunch.push({x:xf,par,camErect:cam.erect*par,camDeck:cam.afterDeck*par,camSeat:cam.seat*par,buildup});'];
  const RIDOT_MAX = 4, WARN_RE = /^RIDOT BDM 9\.4\.6: haunch /, SAG_RE = /^Girder sags at deck placement: /;
  let checked = false;
  function checkEngine() {
    if (checked) return;
    const f = W.computeAll; if (typeof f !== 'function') throw new Error('PSBHaunch: the engine function computeAll is not loaded.');
    const t = Function.prototype.toString.call(f);
    ANCHORS.forEach(a => { const n = t.split(a).length - 1; if (n !== 1) throw new Error(`PSBHaunch: anchor found ${n} times in computeAll (expected once): ${a}`); });
    checked = true;
  }
  // t_h at midspan for every Δ_deck (engineer 2026-11-26; was, pending review: t_h kept at the bearings when Δ_deck < 0)
  const profile = (th, d, psi) => Math.max(th + d * (1 - psi), 0.5);
  const f2 = v => (+v).toFixed(2);
  /* HCT (engineer 2026-11-26, "camber tolerance: YES, as a Settings input (± % of predicted camber), showing haunch at bearings and midspan
     for high and low camber"; §4 review; a reported value only, no check, load or ratio): base.opt.camTol = p, ± % of the predicted camber
     (optional field; blank or 0: none, the result as before). The predicted camber C = R.cam.erect (the girder's camber at deck placement
     before the deck load, PCI erection multipliers): the fabricated camber may be C ± p C (Decision (pending engineer review): the tolerance
     on the erection camber, not on the deck deflection). dC = p |C| / 100. For each of high (+dC) and low (−dC) camber:
       d        = Δ_deck ± dC                       the camber at deck placement
       mid      = t_h ∓ dC                          the haunch at midspan when the seats and the haunch at the bearings are set for the predicted
                                                    camber (t_h + Δ_deck at the bearings): high camber thins it (below 0: the girder top is
                                                    above the deck soffit); no floor (a geometric value)
       brgKeep  = max(t_h + Δ_deck ± dC, 0.5)       the haunch at the bearings that keeps t_h at midspan (the #1722 rule with that camber)
     → null, or { p, C, dC, hi: { d, mid, brgKeep }, lo: { d, mid, brgKeep } } */
  function tolOf(inp, R, th, d) {
    const v = inp && inp.opt ? inp.opt.camTol : null, p = v === '' || v == null ? 0 : +v;
    if (!(p > 0) || !R.cam || !isFinite(+R.cam.erect)) return null;
    const C = +R.cam.erect, dC = p * Math.abs(C) / 100, one = s => ({ d: d + s * dC, mid: th - s * dC, brgKeep: Math.max(th + d + s * dC, 0.5) });
    return { p, C, dC, hi: one(1), lo: one(-1) };
  }
  function apply(inp, R) {
    if (!R || R.error || !Array.isArray(R.haunch) || !R.haunch.length || !R.cam) return R;
    if (R.hp) return R;   // already applied (the same result object)
    checkEngine();
    const d = R.cam.afterDeck, th = +inp.th;
    R.haunch.forEach(r => {
      const b0 = Math.max(inp.th + d * r.par, 0.5);   // the engine's expression (anchor 1), to compare exactly
      if (!Object.is(r.buildup, b0)) throw new Error(`PSBHaunch: the engine's haunch ${r.buildup} at x = ${r.x} is not max(t_h + Δ_deck ψ, 0.5) = ${b0} (the engine changed?).`);
    });
    R.haunch.forEach(r => { r.buildup0 = r.buildup; r.buildup = profile(th, d, r.par); });
    const H = R.haunch, mid = H[Math.floor(H.length / 2)], vals = H.map(r => r.buildup), max = Math.max(...vals), min = Math.min(...vals);
    const P_ = W.PBD, owner = P_ && P_.ownerOf ? P_.ownerOf(inp) : (inp.owner || 'AASHTO'), g = R.g || {};
    const lim = owner === 'RIDOT' ? RIDOT_MAX : null, hasH = !(g.isBox || g.isDeck);
    const xMax = H[vals.indexOf(max)].x;
    const warn = lim != null && hasH && max > lim + 1e-9
      ? `RIDOT BDM 9.4.6: haunch up to ${f2(max)} in (${d >= 0 ? `at the bearings; t_h = ${f2(th)} in + the camber at deck placement ${f2(d)} in` : `at midspan; t_h = ${f2(th)} in, the girder sags at deck placement`}) is thicker than 4 in: reinforce the haunch where it is thicker than 4 in (Camber & deflection tab).`
      : null;
    const brg = H[0].buildup, sag = hasH && d < 0
      ? `Girder sags at deck placement: Δ_deck = ${f2(d)} in (the camber at deck placement is downward). t_h stays the haunch at midspan, so the haunch at the bearings is ${brg > th + d + 1e-9 ? `the 0.5 in floor (t_h + Δ_deck = ${f2(th + d)} in)` : `t_h + Δ_deck = ${f2(brg)} in`}, thinner than the entered t_h = ${f2(th)} in. Review the prestress, the camber and the haunch (Camber & deflection tab).`
      : null;
    R.hp = { th, d, neg: d < 0, mid: mid.buildup, brg, min, max, xMax, owner, lim, warn, sag, tol: tolOf(inp, R, th, d) };
    if (warn && Array.isArray(R.warns)) R.warns.push(warn);
    if (sag && Array.isArray(R.warns)) R.warns.push(sag);
    return R;
  }
  W.PSBHaunch = { apply, profile, anchors: () => ANCHORS.slice(), RIDOT_MAX, WARN_RE, SAG_RE };
})();
