/* apps/ps-bridge/engine/pierblock.js — PS-34: the thickness the pier section's compression block is checked against, per girder family
   (window.PSBPierBlock). Classic script, no DOM. Created 2026-11-14 (engineer decision PS-34; fixlog/ps-bridge.md). WARNING ONLY: no
   capacity value changes.

   The moved engine (pbd-compute.js, continuity on: the negative moment at the pier, a rectangular block a = A_s f_y / (0.85 f′c b_bf) in the
   girder bottom) checks a ≤ t_bf with t_bf = g.isNext ? next.ft : g.d[2] (cont.tbf, cont.aOK) and warns "Negative-moment compression block
   a = … exceeds the bottom-flange thickness (…″) — rectangular-block assumption is unconservative; refine." when not. d[2] is the bottom
   flange of an I-girder / bulb tee; for the other families that is the wrong thickness:
     NEXT F       ft = the TOP (deck) flange; the block is in the two stems (b_bf = 2B): t = the stem depth h − ft
     box beam     girderGrossBase returns d = [0, 0, 0, 0], so t_bf = 0 and every continuous box warned: t = the bottom slab (box.wall)
     voided slab  t = the concrete below the voids (the lowest void bottom of sectionVoids, e.g. (h − D)/2)
     solid slab   t = h (the whole section is the rectangle b_bf × h)
     I-girder / bulb tee / Custom: unchanged (d[2]).
   apply(inp, R): for those three families, R.ps34 = { t, what, aN, aOK, engT, engOK } and the engine's warning replaced (removed when a ≤ t,
   else the same warning with the family's thickness named). cont.tbf and cont.aOK (the engine's values) are kept unchanged. Nothing else. */
(function () {
  'use strict';
  const RE = /^Negative-moment compression block a = /;
  const f1 = v => (typeof fmt === 'function' ? fmt(v, 1) : (+v).toFixed(1));
  /* family(g): { t, what } for NEXT, box beams and deck slabs; null for I-girders, bulb tees and Custom (unchanged) */
  function family(g) {
    if (!g) return null;
    if (g.isNext && g.next) return { t: g.h - g.next.ft, what: 'the stem depth h − t_f' };
    if (g.isBox && g.box) return { t: +g.box.wall, what: 'the bottom slab' };
    if (g.isDeck && g.box) {
      const vs = typeof sectionVoids === 'function' ? sectionVoids(g) : [];
      if (!vs.length) return { t: +g.h, what: 'the slab depth h' };
      return { t: Math.min(...vs.map(v => v.type === 'rect' ? v.y - v.h / 2 : v.y - v.d / 2)), what: 'the concrete below the voids' };
    }
    return null;
  }
  function apply(inp, R) {
    if (!R || R.error || !R.cont || !R.g || typeof R.cont.aN !== 'number') return R;
    const f = family(R.g); if (!f) return R;
    const c = R.cont, aOK = c.aN <= f.t;
    R.ps34 = { t: f.t, what: f.what, aN: c.aN, aOK, engT: c.tbf, engOK: c.aOK };
    const i = (R.warns || []).findIndex(w => RE.test(w));
    const w = `Negative-moment compression block a = ${f1(c.aN)}″ exceeds ${f.what} (${f1(f.t)}″, PS-34) — rectangular-block assumption is unconservative; refine.`;
    if (i >= 0) { if (aOK) R.warns.splice(i, 1); else R.warns[i] = w; }
    else if (!aOK) R.warns.push(w);
    return R;
  }
  window.PSBPierBlock = { apply, family };
})();
