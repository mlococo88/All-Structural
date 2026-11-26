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

   HDC (below): run(inp, chain) carries the haunch weight (DC1) from the average of this profile.
   apply(inp, R) -> R; R.hp = { th, d (Δ_deck), neg (Δ_deck < 0), mid, brg (t_h(x) at midspan and at the left bearing), min, max, xMax,
     owner, lim (4 for RIDOT, else null), warn (the warning text or null), sag (the sag warning text or null) }.
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
    R.hp = { th, d, neg: d < 0, mid: mid.buildup, brg, min, max, xMax, owner, lim, warn, sag };
    if (warn && Array.isArray(R.warns)) R.warns.push(warn);
    if (sag && Array.isArray(R.warns)) R.warns.push(sag);
    return R;
  }
  /* ---------- HDC (2026-11-25, engineer decision "Both, two PRs": DC1 from the average haunch; §4) ----------
     The moved engine carries the haunch weight as w_h = b t_h / 144 w_c,d,DL (pbd-section.js compositeProps: wdkHaunch, in wdk, in w_DC1),
     i.e. the minimum t_h over the whole span. The haunch profile above averages, over the span, to
         t̄_h = t_h + Δ_deck/3            (the mean of 1 − ψ is 1/3)
     and DC1 takes at least t_h (engineer 2026-11-26, the sag case): w_h = b max(t_h + Δ_deck/3, t_h) / 144 w_c,d,DL, i.e. Δ_deck < 0 (the
     girder sags at deck placement, with the sag warning of apply): t_h, the engine's own w_h. DC1 uses w_h = b t̄_h / 144 w_c,d,DL (b = the engine's haunch width: the top flange b_tf, a NEXT beam's flange width b_eff;
     box beams and deck slabs: no haunch, nothing changes). The section properties, e_g and the haunch-in-properties option keep t_h.
     Two passes, because the haunch weight lowers Δ_deck: pass 1 is the page's result as before (Δ_0); the camber at deck placement is linear in
     w_DC1 (Δ_dk = 5 w_DC1 L⁴ / (384 E_c I_g), the other terms do not depend on it), so with k = 5 L⁴ / (12 · 384 E_c I_g) (in per klf) and
     β = b w_c / 144 (klf per in) the self-consistent Δ_deck solves Δ = Δ_0 − k β (t̄_h − t_h):
         Δ = Δ_0 / (1 + k β / 3)  (Δ_0 > 0; Δ keeps the sign of Δ_0, so t̄_h > t_h);
     pass 2 is the whole chain again with compositeProps giving w_h from t̄_h(Δ) (the engine function wrapped for the call and restored, as
     engine/rigid.js does with distFactors). Pass 2's own Δ_deck must equal Δ (relative 1e-9); else an error is thrown.
     run(inp, chain) -> R (pass 2) with R.hdc = { th, d0, d, tavg, add (t̄_h − t_h), b, wc, beta, k, w0 (pass 1 w_h), w (w_h), neg };
       R from pass 1 unchanged when there is no haunch width (box, deck slab), when R has an error, or when Δ_0 ≤ 0 (then R.hdc.same = true;
       Δ_0 < 0: R.hdc.neg = true, t̄_h = t_h). The case Δ_0 < 0 with no balance (formerly a decision pending review, 2kβ/3 ≥ 1 under the
       t_h + 2|Δ|/3 rule) cannot arise: with t̄_h = t_h for a sag, pass 1 is the answer (engineer 2026-11-26). */
  function run(inp, chain) {
    const R0 = chain(inp);
    if (!R0 || R0.error || !R0.cp || !R0.cam || !R0.g || !(+R0.cp.wdkHW > 0)) return R0;
    const cp = R0.cp, th = +inp.th, wc = +inp.mat.wcdLoad || +inp.mat.wcd, b = +cp.wdkHW, Lin = R0.L * 12;
    const k = 5 * Math.pow(Lin, 4) / (12 * 384 * cp.Ecg * R0.g.I), beta = b * wc / 144, d0 = R0.cam.afterDeck;
    // Δ_0 ≤ 0: t̄_h = max(t_h + Δ_0/3, t_h) = t_h (engineer 2026-11-26: at least t_h; the sag warning is apply's), so pass 1 is the answer
    if (!(d0 > 0)) { R0.hdc = { th, d0, d: d0, tavg: th, add: 0, b, wc, beta, k, w0: cp.wdkHaunch, w: cp.wdkHaunch, neg: d0 < 0, same: true }; return R0; }
    const neg = false, d = d0 / (1 + k * beta / 3), add = Math.max(d / 3, 0), tavg = th + add;
    const orig = W.compositeProps; if (typeof orig !== 'function') throw new Error('PSBHaunch: the engine function compositeProps is not loaded.');
    W.compositeProps = function (i, g) {
      const c = orig(i, g); if (!c || !(+c.wdkHW > 0)) return c;
      const wh = (c.wdkHW * tavg / 144) * wc;   // the engine's (b t_h / 144) w_c with t̄_h
      return Object.assign({}, c, { wdkHaunch: wh, wdk: c.wdkDeck + wh, hdcT: tavg });
    };
    let R; try { R = chain(inp); } finally { W.compositeProps = orig; }
    if (!R || R.error) return R;
    if (!(Math.abs(R.cam.afterDeck - d) <= 1e-9 * Math.max(1, Math.abs(d)))) throw new Error(`PSBHaunch: pass 2 camber at deck placement ${R.cam.afterDeck} is not the solved ${d} (the engine changed?).`);
    R.hdc = { th, d0, d, tavg, add, b, wc, beta, k, w0: cp.wdkHaunch, w: R.cp.wdkHaunch, neg };
    return R;
  }
  W.PSBHaunch = { apply, run, profile, anchors: () => ANCHORS.slice(), RIDOT_MAX, WARN_RE, SAG_RE };
})();
