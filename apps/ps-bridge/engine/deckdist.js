/* apps/ps-bridge/engine/deckdist.js — DD: the deck distribution reinforcement on the effective span length (window.PSBDeckDist).
   Classic script, no DOM. Created 2026-11-24 (engineer request 2026-11-24: "Please fix the deck distribution steel"; fixlog/ps-bridge.md DD).

   Code (cited, not copied): AASHTO LRFD 10th Ed. (2024)
     Art. 9.7.3.2   the bottom distribution reinforcement, for primary reinforcement perpendicular to traffic, is 220/sqrt(S) percent of the
                    primary positive-moment reinforcement, not more than 67 percent, with S the effective span length of Art. 9.7.2.3 (ft);
     Art. 9.7.2.3   for a slab supported on steel or concrete girders, the effective length is the distance between the flange tips plus the
                    flange overhang, taken from the extreme flange tip to the face of the web, fillets disregarded (for a slab monolithic with
                    walls or beams: the face-to-face distance).
   The moved engine (pbd-handling-deck.js deckCalc) takes S = the girder spacing (inputs.S, ft): a longer span, a smaller percentage above
   S = (220/67)^2 = 10.78 ft (unconservative there). Below that both give the 67 % upper limit.

   AN ENGINE CORRECTION MADE APP-SIDE (CLAUDE.md §4): the moved engine (engine/pbd-*.js, verbatim, frozen) is NOT edited. As engine/holddown.js
   and engine/rating-along.js apply(), apply(inp, R) runs after computeAll (the last step of PSBHoldDown.compute) and replaces R.deck.distPct
   with the percentage on the effective span (the calculation is shared/deck.js distEff, the same code as the Steel Bridge app). Nothing else
   of R changes: R.deck.distPct is used by no check (no ratio or verdict); it is shown on the Deck tab, the worked steps, the sheets, the
   Report and the deck bars of the bill of materials. The engine's own value is kept as R.deck.dd.pct0.
   Guard (no silent fallback): the engine's deckCalc must still contain the anchors below (S read from inputs.S; distPct = min(220/sqrt(S), 67)),
   and the R.deck.distPct it returned must equal that expression on inputs.S exactly; else an error is thrown, so that a later engine change
   is not silently corrected twice or on the wrong S.

   The girder families (R.g, the engine's gross section; inputs.S the spacing of the design girder line, engine/design.js lineS):
     I-girders and bulb tees (AASHTO, PCI, NEBT, state and custom shapes: no isNext / isBox / isDeck): S_eff = S - b_tf/12 + (b_tf - b_w)/24,
       b_tf the top flange width, b_w the web width (in; the web of the library shapes is of constant width: the face of the web);
     NEXT beams (double tees), adjacent and spread box beams, voided deck slabs (isNext, isBox, isDeck): the 67 % upper limit, the largest
       percentage the article allows. Decision (pending engineer review): the slab of these sections is a topping on the precast flange or on
       beams side by side, not a slab spanning between flange tips, and the families carry no flange overhang to the web face (the box and
       slab outlines are rectangles; NEXT stems are within the flange): the conservative value is used instead of a span the article does not
       define for them. A spread box's S_eff would be S - w/12 or more, which never gives more than 67 %.
     A section without a valid flange and web width (b_tf, b_w not positive, or b_w > b_tf) or with S_eff <= 0: 67 %.

   apply(inp, R) -> R; with a deck design (R.deck) R.deck.distPct = the corrected percentage and R.deck.dd = { S, bf, tw, ok, clear, ohF, Seff,
     pct, pct0 (the engine's value on the girder spacing), capped, why, kind: 'I' | 'next' | 'box' | 'deck' | 'none', changed }.
   anchors() -> the anchor texts checked in the engine's deckCalc (for the tests). */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const ANCHORS = ['const D=inp.deck, S=inp.S, ts=inp.ts, m=inp.mat;',
    'const distPct=Math.min(220/Math.sqrt(S*12)*0+ 220/Math.sqrt(S),67); // S in ft per legacy; clamp',
    'pos,neg,oh,bBar,Pbar,Xoh,SWoh,MohDC,MohDW,MohDL,MohLL,Mu_oh,ohCap,distPct,fcd,fy,ts,'];
  let checked = false;
  function checkEngine() {
    if (checked) return;
    const f = W.deckCalc; if (typeof f !== 'function') throw new Error('PSBDeckDist: the engine function deckCalc is not loaded.');
    const t = Function.prototype.toString.call(f);
    ANCHORS.forEach(a => { const n = t.split(a).length - 1; if (n !== 1) throw new Error(`PSBDeckDist: anchor found ${n} times in deckCalc (expected once): ${a}`); });
    checked = true;
  }
  const kindOf = g => (!g ? 'none' : g.isNext ? 'next' : g.isBox ? 'box' : g.isDeck ? 'deck' : 'I');
  function apply(inp, R) {
    if (!R || R.error || !R.deck) return R;
    checkEngine();
    const SD = W.SharedDeck; if (!SD || !SD.distEff) throw new Error('PSBDeckDist: shared/deck.js (SharedDeck.distEff) is not loaded.');
    const D = R.deck, S = inp.S;
    if (D.dd) return R;   // already applied (the same result object)
    const pct0 = Math.min(220 / Math.sqrt(S * 12) * 0 + 220 / Math.sqrt(S), 67);   // the engine's expression (anchor 2), to compare exactly
    if (!Object.is(D.distPct, pct0)) throw new Error(`PSBDeckDist: the engine's distribution percentage ${D.distPct} is not min(220/sqrt(S), 67) = ${pct0} on S = ${S} ft (the engine changed?).`);
    const g = R.g, kind = kindOf(g);
    const E = kind === 'I' ? SD.distEff({ S, bf: +g.btf, tw: +g.bw }) : Object.assign(SD.distEff({ S, bf: NaN, tw: NaN }), { why: 'family' });
    D.dd = Object.assign({}, E, { pct0: D.distPct, kind, changed: !Object.is(E.pct, D.distPct) });
    D.distPct = E.pct;
    return R;
  }
  W.PSBDeckDist = { apply, anchors: () => ANCHORS.slice(), kindOf };
})();
