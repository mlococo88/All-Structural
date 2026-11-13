/* apps/ps-bridge/engine/design.js — the one girder design of PR 2b and the engine inputs it is computed with (window.PSBDesign).
   Classic script, no DOM. Created 2026-11-12 (docs/ps-bridge-plan.md §5, PR 2b: "input tabs wired to base (one design)").

   Until the bridge level (PR 3a: girders × spans, interior / exterior groups, PS-8) one girder of one span is designed: the design girder
   P.design = { g, s } (girder line g = 1 … nb from the left, span s = 1 … number of spans; optional within schema version 1: a project
   without it designs G2 (G1 with one girder) in span 1, the old app's default interior girder). The engine (engine/pbd-*.js, moved
   unchanged) reads one inputs object of the old app's format; inputs(P) builds it from the project:
     1. the base design P.base (every girder input: shape, strands, materials, loads, owner, …; edited on the input tabs);
     2. the bridge values written into it by the old app's own code, PBD.applyBridge (its "Preliminary designer" mode, moved unchanged):
        L = span s, S = the girder spacing, nGirders = nb, loads.pos = exterior for G1 and G<nb> else interior, cont.spans / cont.span
        (PBD.withSpans), proj (title block, girder label);
     3. three bridge values the old app took from its own boxes, set here from the bridge: cont.on = "made continuous for composite loads"
        with two or more spans (5.12.3.3, PS-7); loads.skew = the skew of the design span's supports (|θ|, deg); deck.oh = the deck overhang
        on the design girder's side (G<nb>: right, else left; ft, girder ℄ to deck edge: the exterior girder's b_eff = S/2 + overhang,
        4.6.2.6.1, and the deck design overhang).
   No engineering value is computed here: the values are copied, as the old app's bridge bar copied them. Where the bridge does not give
   one value (unequal bays; different skews at the two supports of the design span) checks(P) returns a blocking input error until
   PR 3a (plan §7 item 3: how the steel distribution maps onto S, DC2/DW and DF is decided there with worked check cases).
   DRIVEN: the base paths the bridge sets (not edited in base; shown read-only on the Girders & strands tab).
   PR 3a-1 (2026-11-13): girder types on the girder lines of each span (engine/bridge.js, PS-8): inputs(P) is the cell the output tabs show
   (P.design = the line and span shown), cellInputs(P, k, g) any type on any of its lines; the code of one design (one()) is unchanged.
   Needs the moved engine (window.PBD, DEFAULTS) loaded first. */
(function () {
  'use strict';
  const isNum = v => typeof v === 'number' && isFinite(v);
  const DRIVEN = ['L', 'S', 'nGirders', 'loads.pos', 'loads.posAuto', 'loads.skew', 'deck.oh', 'cont.on', 'cont.spans', 'cont.span', 'proj'];
  const nSpans = P => ((P && P.spans && P.spans.lengths) || []).length;
  /* sel(P): the design girder and span, defaults filled in (nothing written) */
  function sel(P) {
    const BR = window.PSBBridge;   // PR 3a-1: with girder types, the cell the output tabs show (P.design when a type is on it)
    if (BR && BR.hasTypes(P)) { const c = BR.shown(P); if (c) return { g: c.g, s: c.s }; }
    const nb = P && P.xs && Number.isInteger(P.xs.nb) ? P.xs.nb : 0, d = (P && P.design) || {};
    return { g: Number.isInteger(d.g) ? d.g : Math.min(2, Math.max(1, nb)), s: Number.isInteger(d.s) ? d.s : 1 };
  }
  const isExt = (P, g) => g === 1 || g === P.xs.nb;
  const label = (P, g) => `G${g} (${isExt(P, g) ? 'exterior' : 'interior'})`;
  /* bridge(P): the old app's bridge model { v, mode 'pl', title, spans, nGirders, S, sel, designs } for PBD.applyBridge */
  function bridge(P) {
    const p = P.project || {}, d = sel(P);
    return { v: 1, mode: 'pl', title: { name: p.name || '', by: p.designer || '', date: p.date || '', job: p.number || '' },
      spans: P.spans.lengths.slice(), nGirders: P.xs.nb, S: lineS(P, d.g), sel: { g: d.g, s: d.s }, designs: {} };
  }
  /* lineS(P, g): the girder spacing S of girder line g (ft), PR 3a-2 (PS-9, plan §7 item 3; the rule of shared/lldf.js memberSpacing, which
     the Steel Bridge app uses): an exterior girder the bay next to it, an interior girder the mean of its two bays (= its tributary width,
     AASHTO LRFD 10th Ed. 4.6.2.6.1). Equal bays: the bay (as before: bays[0]). */
  function lineS(P, g) {
    const B = (P.xs && P.xs.bays) || [], nb = P.xs.nb;
    if (!(nb >= 2) || B.length < 1) return B[0];
    if (g <= 1) return B[0]; if (g >= nb) return B[B.length - 1];
    return (B[g - 2] + B[g - 1]) / 2;
  }
  /* skewOf(P, s): the skews at the two supports of span s (deg, as entered) */
  const skewOf = (P, s) => { const k = (P.xs && P.xs.skews) || []; return [k[s - 1], k[s]]; };
  /* checks(P): { errors: [{ path, msg }] } the design selection and the PR 2b limits (one design: one spacing, one skew) */
  function checks(P) {
    const errors = [], E = (path, msg) => errors.push({ path, msg });
    if (!P || !P.xs || !P.spans) return { errors };
    const nb = P.xs.nb, ns = nSpans(P), d = sel(P);
    if (Number.isInteger(nb) && nb < 2) E('xs.nb', 'The girder design needs 2 or more girders (the live-load distribution factors and the girder spacing S, 4.6.2.2).');
    if (Number.isInteger(nb) && nb >= 2 && !(d.g >= 1 && d.g <= nb)) E('design.g', `Choose a design girder G1 to G${nb}.`);
    if (ns && !(d.s >= 1 && d.s <= ns)) E('design.s', `Choose a design span 1 to ${ns}.`);
    // PR 3a-2: unequal bays allowed (S per line, lineS); different skews at the two supports of a span allowed (skewOfSpan: the larger |θ|)
    // except where the engine's one θ would also reduce the moment DF (|θ| ≥ 30°, Table 4.6.2.2.2e-1) with the DF computed: then the
    // smaller θ governs the moment reduction (4.6.2.2.2e: none where they differ by more than 10°) and the larger the shear correction
    // (4.6.2.2.3c), which one θ cannot give: a blocking input error (enter equal skews or the distribution factors).
    const BR = window.PSBBridge, typed = !!(BR && BR.hasTypes(P)), cs = typed ? BR.cells(P) : [{ s: d.s, k: -1 }];
    [...new Set(cs.map(c => c.s))].forEach(s => { const k = skewOf(P, s); if (!(isNum(k[0]) && isNum(k[1]))) return;
      const a = Math.abs(k[0]), b = Math.abs(k[1]); if (Math.abs(a - b) <= 1e-9 || Math.max(a, b) < 30) return;
      const auto = cs.filter(c => c.s === s).some(c => { const lb = c.k >= 0 ? BR.effBase(P, c.k) : P.base; return !!(lb && lb.loads && lb.loads.dfAuto); });
      if (auto) E('xs.skews', `The supports of span ${s} have different skews (${k[0]}° and ${k[1]}°) and the larger is 30° or more: the girder design takes one skew angle for both the moment reduction (4.6.2.2.2e: the smaller skew, none when they differ by more than 10°) and the shear correction (4.6.2.2.3c: the larger), so it cannot compute the distribution factors of span ${s}. Enter the same skew at both supports, or enter the distribution factors (Loads tab).`); });
    return { errors };
  }
  /* inputs(P): the engine inputs of the girder the output tabs show (a new object; P is not changed). PR 3a-1: with girder types
     (engine/bridge.js) the cell shown (P.design when a type is on it, else the first checked cell): cellInputs; without (a project saved
     before PR 3a and not yet migrated, the tests' defaultProject): the one design girder, as before (one() below). */
  function inputs(P) {
    const B = window.PSBBridge;
    if (B && B.hasTypes(P)) { const c = B.shown(P); if (c) return cellInputs(P, c.k, c.g); }
    return one(P);
  }
  /* cellInputs(P, k, g): the engine inputs of girder type k (engine/bridge.js) on girder line g of its span: the type's inputs (the base
     design with the type's overrides, PSBBridge.effBase) with the bridge values of that line and span, by the same code as the one design
     girder (one()). A type with no override on the design girder's line gives exactly one(P). */
  function cellInputs(P, k, g) {
    const B = window.PSBBridge, T = B.types(P)[k];
    return one(Object.assign({}, P, { base: B.effBase(P, k), design: { g, s: T.span }, types: undefined }));
  }
  /* one(P): the engine inputs of the design girder P.design (PR 2b; unchanged) */
  function one(P) {
    const PBD = window.PBD, d = sel(P), b = bridge(P);
    let o = PBD.applyBridge(b, JSON.parse(JSON.stringify(P.base)), d.g, d.s);
    o.cont = Object.assign({}, o.cont, { on: P.spans.continuity === 'composite' && nSpans(P) >= 2 });
    const k = skewOf(P, d.s);
    o.loads = Object.assign({}, o.loads, { skew: Math.max(Math.abs(+k[0] || 0), Math.abs(+k[1] || 0)) });   // PR 3a-2: the larger |θ| of the span's supports (equal: as before)
    o.deck = Object.assign({}, o.deck, { oh: d.g === P.xs.nb && d.g !== 1 ? +P.xs.ohR : +P.xs.ohL });
    // PR 3a-3 (PS-9, §4): DC2 and DW of this girder line from the Steel Bridge app's distribution (engine/bridge-dl.js) when the project
    // distributes them (P.xs.dl.mode 'distributed'); else the values entered per girder (base.loads.wBar / wDW) as before
    const DL = window.PSBBridgeDL, q = DL ? DL.line(P, d.g) : null;
    if (q) o.loads = Object.assign({}, o.loads, { wBar: q.DC2, wDW: q.DW });
    return o;
  }
  /* driven(P): the bridge values of the design, for display: [{ key, label, value, unit, where }] (where = the input tab that holds them) */
  function driven(P) {
    const i = inputs(P), d = sel(P);
    return [
      { key: 'L', label: `Span length L (span ${d.s}, ℄ to ℄ bearings)`, value: i.L, unit: 'ft', where: 'layout' },
      { key: 'S', label: `Girder spacing S (${d.g === 1 || d.g === P.xs.nb ? 'the bay next to the exterior girder' : 'mean of the two bays'})`, value: i.S, d: 3, unit: 'ft', where: 'xsec' },
      { key: 'nGirders', label: 'Number of girders', value: i.nGirders, d: 0, unit: '', where: 'xsec' },
      { key: 'loads.pos', label: 'Position', value: i.loads.pos, unit: '', where: 'gird' },
      { key: 'deck.oh', label: `Deck overhang (${d.g === P.xs.nb && d.g !== 1 ? 'right' : 'left'}), girder ℄ to deck edge`, value: i.deck.oh, unit: 'ft', where: 'xsec' },
      { key: 'loads.skew', label: `Skew θ (supports of span ${d.s}: the larger)`, value: i.loads.skew, d: 1, unit: 'deg', where: 'layout' },
      { key: 'cont.on', label: 'Made continuous for composite loads', value: i.cont.on ? 'yes' : 'no', unit: '', where: 'layout' }
    ];
  }
  window.PSBDesign = { lineS, DRIVEN, sel, isExt, label, bridge, checks, inputs, cellInputs, one, driven };
})();
