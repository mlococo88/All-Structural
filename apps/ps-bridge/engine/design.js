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
   Needs the moved engine (window.PBD, DEFAULTS) loaded first. */
(function () {
  'use strict';
  const isNum = v => typeof v === 'number' && isFinite(v);
  const DRIVEN = ['L', 'S', 'nGirders', 'loads.pos', 'loads.posAuto', 'loads.skew', 'deck.oh', 'cont.on', 'cont.spans', 'cont.span', 'proj'];
  const nSpans = P => ((P && P.spans && P.spans.lengths) || []).length;
  /* sel(P): the design girder and span, defaults filled in (nothing written) */
  function sel(P) {
    const nb = P && P.xs && Number.isInteger(P.xs.nb) ? P.xs.nb : 0, d = (P && P.design) || {};
    return { g: Number.isInteger(d.g) ? d.g : Math.min(2, Math.max(1, nb)), s: Number.isInteger(d.s) ? d.s : 1 };
  }
  const isExt = (P, g) => g === 1 || g === P.xs.nb;
  const label = (P, g) => `G${g} (${isExt(P, g) ? 'exterior' : 'interior'})`;
  /* bridge(P): the old app's bridge model { v, mode 'pl', title, spans, nGirders, S, sel, designs } for PBD.applyBridge */
  function bridge(P) {
    const p = P.project || {}, d = sel(P);
    return { v: 1, mode: 'pl', title: { name: p.name || '', by: p.designer || '', date: p.date || '', job: p.number || '' },
      spans: P.spans.lengths.slice(), nGirders: P.xs.nb, S: (P.xs.bays || [])[0], sel: { g: d.g, s: d.s }, designs: {} };
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
    const B = (P.xs.bays || []).filter(isNum);
    if (B.length >= 2 && B.some(b => Math.abs(b - B[0]) > 1e-9))
      E('xs.bays', 'Unequal bays are designed from the bridge-level PR 3a (PS-9). Until then the one girder design uses one spacing S: enter equal bays.');
    const k = skewOf(P, d.s);
    if (isNum(k[0]) && isNum(k[1]) && Math.abs(Math.abs(k[0]) - Math.abs(k[1])) > 1e-9)
      E('xs.skews', `The supports of design span ${d.s} have different skews (${k[0]}° and ${k[1]}°). The girder design uses one skew angle (4.6.2.2.2e, 4.6.2.2.3c) until PR 3a: enter the same skew at both supports of span ${d.s}.`);
    return { errors };
  }
  /* inputs(P): the engine inputs of the design girder (a new object; P is not changed) */
  function inputs(P) {
    const PBD = window.PBD, d = sel(P), b = bridge(P);
    let o = PBD.applyBridge(b, JSON.parse(JSON.stringify(P.base)), d.g, d.s);
    o.cont = Object.assign({}, o.cont, { on: P.spans.continuity === 'composite' && nSpans(P) >= 2 });
    const k = skewOf(P, d.s);
    o.loads = Object.assign({}, o.loads, { skew: Math.abs(+k[0] || 0) });
    o.deck = Object.assign({}, o.deck, { oh: d.g === P.xs.nb && d.g !== 1 ? +P.xs.ohR : +P.xs.ohL });
    return o;
  }
  /* driven(P): the bridge values of the design, for display: [{ key, label, value, unit, where }] (where = the input tab that holds them) */
  function driven(P) {
    const i = inputs(P), d = sel(P);
    return [
      { key: 'L', label: `Span length L (span ${d.s}, ℄ to ℄ bearings)`, value: i.L, unit: 'ft', where: 'layout' },
      { key: 'S', label: 'Girder spacing S', value: i.S, unit: 'ft', where: 'xsec' },
      { key: 'nGirders', label: 'Number of girders', value: i.nGirders, d: 0, unit: '', where: 'xsec' },
      { key: 'loads.pos', label: 'Position', value: i.loads.pos, unit: '', where: 'gird' },
      { key: 'deck.oh', label: `Deck overhang (${d.g === P.xs.nb && d.g !== 1 ? 'right' : 'left'}), girder ℄ to deck edge`, value: i.deck.oh, unit: 'ft', where: 'xsec' },
      { key: 'loads.skew', label: `Skew θ (supports of span ${d.s})`, value: i.loads.skew, d: 1, unit: 'deg', where: 'layout' },
      { key: 'cont.on', label: 'Made continuous for composite loads', value: i.cont.on ? 'yes' : 'no', unit: '', where: 'layout' }
    ];
  }
  window.PSBDesign = { DRIVEN, sel, isExt, label, bridge, checks, inputs, driven };
})();
