/* apps/ps-bridge/engine/fields.js — the input fields of the girder design (window.PSBFields): for every engine input the old Prestressed
   Bridge Design app exposes, its input tab and card, label, unit, tooltip and input rule. Classic script, no DOM. Created 2026-11-12 (PR 2b,
   docs/ps-bridge-plan.md §2.2: Project · Bridge layout · Cross-section · Girders & strands · Materials · Diaphragms / deck · Loads · Owner rules).
   ui/inputs.js draws the cards from this list; engine/inputcheck.js checks every shown field against its rule. Nothing is computed here.

   Paths are project paths: 'base.<engine input path>' (the base design, the old app's inputs object, engine/model.js) or a bridge-level field.
   The labels, units and tooltips follow the old app's input cards ("Prestressed Bridge Design.html" InputsTab, frozen at 8fe8650), with the
   draped-strand wording of MassDOT / CTDOT (PS-5) and the hold-down location as frac × L_span from ℄ bearing (PS-13).
   Field: { p (path), l (label, HTML), u (unit), t (tooltip, plain text), k ('num' | 'opt' (blank allowed, kept as '') | 'sel' | 'bool'),
            o ([[value, text]] for sel), v (rule: 'pos' > 0, 'nn' >= 0, 'any' a number, 'i0' whole >= 0, 'i1' whole >= 1), min / max (inclusive
            limits), minX / maxX (exclusive), when(b, P) (shown and checked only when true; b = P.base) }
   Card: { tab, id, title, ref, fields, note(b, P) (HTML), when(b, P) }. Table inputs (strand rows, diaphragms, rating vehicles) are drawn by
   ui/inputs.js and checked by engine/inputcheck.js (TABLES below). */
(function () {
  'use strict';
  const YN = [['true', 'Yes'], ['false', 'No']];
  const F = (p, l, u, t, k, o) => Object.assign({ p, l, u: u || '', t: t || '', k: k || 'num', v: 'pos' }, o || {});
  const distOff = (b, P) => !(window.PSBBridgeDL && window.PSBBridgeDL.on(P));   // PR 3a-3: DC2 / DW entered per girder (not distributed)
  const cont = (b, P) => P && P.spans && P.spans.continuity === 'composite' && P.spans.lengths.length >= 2;
  // PS-35: a box beam or voided slab of the library (types (f) / (g) live-load distribution, engine/lldf-fg.js)
  const fgShape = b => { const G = b && typeof GIRDERS !== 'undefined' ? GIRDERS[b.girder] : null; return !!G && (!!G.box || (!!G.deck && (!!G.solid || (+G.voids > 0 && +G.voidD > 0)))); };   // PS-36: the solid slabs too
  const CARDS = [
    // ---- Bridge layout ----
    { tab: 'layout', id: 'cont', title: 'Continuity for composite loads', ref: 'AASHTO LRFD 10th Ed. 5.12.3.3', when: cont, fields: [
      F('base.cont.restraint', 'Restraint moments (creep and shrinkage)', '', 'Compute the restraint moments of girder creep and deck shrinkage after continuity (5.12.3.3.2, C5.12.3.3.2). Owner defaults: MassDOT and RIDOT off.', 'bool', { o: [['true', 'Computed'], ['false', 'Not computed']] }),
      F('base.cont.As', 'Deck reinforcement A<sub>s</sub> over the pier, in b<sub>eff</sub>', 'in²', 'Longitudinal deck bars resisting the negative moment over the interior support, within the effective flange width (5.12.3.3.7).'),
      F('base.cont.dTop', 'Top of deck to the bar centroid', 'in', 'Depth from the top of the deck to the centroid of the negative-moment deck bars.'),
      F('base.cont.fy', 'Deck bar yield strength f<sub>y</sub>', 'ksi', 'Yield strength of the negative-moment deck reinforcement.'),
      F('base.cont.AsPos', 'Positive moment connection steel A<sub>s,pos</sub>', 'in²', 'Steel of the positive moment connection at the interior support (5.12.3.3.8a, f_s ≤ 36 ksi). Blank: the required area is reported.', 'opt', { v: 'nn' }),
      F('base.cont.topRC', 'Top of girder near interior supports', '', 'Service design of the girder top near the pier: the stress limit of Table 5.9.2.3.1b-1, or designed as reinforced concrete at the strength limit state (5.12.3.3.5).', 'bool', { o: [['false', 'Stress limit (Table 5.9.2.3.1b-1)'], ['true', 'Reinforced concrete at strength']] })],
      note: () => 'Girder and DC1 on the simple span; DC2, DW and live load on the continuous unit (5.12.3.3, PS-7). Age at continuity = the deck age t<sub>d</sub> (<a href="#" data-goin="mat">Materials tab</a>, 5.12.3.3.4). Bonded top bars near the pier: <a href="#" data-goin="gird">Girders &amp; strands tab</a>.' },
    // ---- Cross-section ----
    { tab: 'xsec', id: 'deck', title: 'Deck and haunch', ref: 'AASHTO LRFD 10th Ed. 4.6.2.6', fields: [
      F('base.ts', 'Deck thickness, structural t<sub>s</sub>', 'in', 'Structural deck thickness: composite section, capacity and deck weight (unless a separate dead-load thickness is entered). 0 = no composite topping (box, deck and NEXT beams).', 'num', { v: 'nn' }),
      F('base.th', 'Haunch / build-up height', 'in', 'Haunch between the top of the girder and the deck soffit. Its weight is always carried (DC1); it is in the composite stiffness only when included below.', 'num', { v: 'nn' }),
      F('base.beffAuto', 'Effective flange width b<sub>eff</sub>', '', 'Automatic: the tributary width, S for an interior girder, S/2 + overhang for an exterior girder (4.6.2.6.1); box and deck beams: the beam width; NEXT: the flange width.', 'bool', { o: [['true', 'Automatic (tributary width)'], ['false', 'Entered']] }),
      F('base.beff', 'b<sub>eff</sub>, entered', 'in', 'Effective flange width used for the composite section (the deck weight stays on the tributary width).', 'num', { when: b => !b.beffAuto }),
      F('base.haunchInProps', 'Haunch in the composite section properties', '', 'Typical practice excludes the haunch (the deck is modelled bearing on the top flange). Its weight is carried either way.', 'bool', { o: [['false', 'Excluded'], ['true', 'Included']] }),
      F('base.tsSeparate', 'Separate deck thickness for the dead load', '', 'For example a sacrificial or integral wearing course: weight from this thickness, section and capacity from t_s.', 'bool', { o: YN }),
      F('base.tsDL', 'Deck thickness, dead load', 'in', 'Deck thickness used for the DC1 deck weight only.', 'num', { when: b => !!b.tsSeparate })] },
    { tab: 'xsec', id: 'extll', title: 'Exterior girder live load', ref: 'AASHTO LRFD 10th Ed. 4.6.2.2.2d', fields: [
      F('base.loads.de', 'd<sub>e</sub>: exterior web to the inside face of the barrier', 'ft', 'Distance from the centreline of the exterior web to the inside face of the curb or barrier (positive inside the barrier), for e = 0.77 + d_e/9.1 and the lever rule.', 'num', { v: 'any', when: (b, P) => !(P && P.xs && P.xs.dl) }),
      F('base.loads.NL', 'Design lanes N<sub>L</sub> (rigid cross-section check)', '', 'Number of design lanes loaded in the rigid cross-section special analysis of an exterior girder (C4.6.2.2.2d), 1 to 4.', 'num', { v: 'i1', max: 4 })],
      note: (b, P) => P && P.xs && P.xs.dl && window.PSBDesign ? `d<sub>e</sub> from the cross-section for each exterior line (PS-20): G1 ${(+window.PSBDesign.deOf(P, 1)).toFixed(3)} ft (left overhang − barrier face), G${P.xs.nb} ${(+window.PSBDesign.deOf(P, P.xs.nb)).toFixed(3)} ft (right); the barriers are in the card below. Used for an exterior girder (G1 or the last girder).`
        : 'Used when the design girder is an exterior girder (G1 or the last girder). Entered: the project has no cross-section barriers (saved before PR 3a-3).' },
    // ---- Girders & strands ----
    { tab: 'gird', id: 'shape', title: 'Girder shape', ref: 'PCI / AASHTO shapes (the old app\'s library)', fields: [
      F('base.girder', 'Girder section', '', 'Girder shape from the library (gross properties per PCI / AASHTO). The library of the engineer\'s standard sheets (NEBT, NEDBT, NEXT, boxes) comes in PR 4 (PS-2).', 'sel', { o: () => Object.keys(typeof GIRDERS !== 'undefined' ? GIRDERS : {}).map(k => [k, k]) }),
      F('base.cust.h', 'Overall depth h', 'in', 'Custom section: overall girder depth.', 'num', { when: b => b.girder === 'Custom' }),
      F('base.cust.A', 'Gross area A', 'in²', 'Custom section: gross area.', 'num', { when: b => b.girder === 'Custom' }),
      F('base.cust.I', 'Moment of inertia I', 'in⁴', 'Custom section: gross moment of inertia about the centroid.', 'num', { when: b => b.girder === 'Custom' }),
      F('base.cust.yb', 'Centroid from the bottom y<sub>b</sub>', 'in', 'Custom section: centroid height above the soffit.', 'num', { when: b => b.girder === 'Custom' }),
      F('base.cust.bw', 'Web width b<sub>w</sub>', 'in', 'Custom section: web width (shear).', 'num', { when: b => b.girder === 'Custom' }),
      F('base.cust.btf', 'Top flange width', 'in', 'Custom section: top flange width.', 'num', { when: b => b.girder === 'Custom' }),
      F('base.cust.bbf', 'Bottom flange width', 'in', 'Custom section: bottom flange width.', 'num', { when: b => b.girder === 'Custom' }),
      F('base.ovr.on', 'Override section properties', '', 'Use your own A, I, y_b, S_b, S_t or self-weight instead of the shape values; every check then uses the overridden section.', 'bool', { o: YN }),
      F('base.ovr.A', 'Area A (override)', 'in²', 'Blank keeps the shape value.', 'opt', { when: b => b.ovr && b.ovr.on }),
      F('base.ovr.I', 'Moment of inertia I<sub>x</sub> (override)', 'in⁴', 'Blank keeps the shape value.', 'opt', { when: b => b.ovr && b.ovr.on }),
      F('base.ovr.yb', 'y<sub>b</sub> (override)', 'in', 'Blank keeps the shape value.', 'opt', { when: b => b.ovr && b.ovr.on }),
      F('base.ovr.Sb', 'S<sub>b</sub> (override)', 'in³', 'Blank: I / y_b.', 'opt', { when: b => b.ovr && b.ovr.on }),
      F('base.ovr.St', 'S<sub>t</sub> (override)', 'in³', 'Blank: I / y_t.', 'opt', { when: b => b.ovr && b.ovr.on }),
      F('base.ovr.wsw', 'Self-weight (override)', 'klf', 'Blank: A × w_c (dead load).', 'opt', { when: b => b.ovr && b.ovr.on })] },
    { tab: 'gird', id: 'draped', title: 'Draped strands', ref: 'two hold-down points (PS-5, PS-13)', fields: [
      F('base.harp.n', 'Number of draped strands n<sub>h</sub>', '', 'Strands draped (harped) between two hold-down points; 0 = all strands straight. MassDOT / CTDOT: "draped strands".', 'num', { v: 'i0' }),
      F('base.harp.yEnd', 'Draped strand centroid at the girder end, y<sub>end</sub>', 'in', 'Height of the centroid of the draped strands above the soffit at the end of the span.', 'num', { when: b => +b.harp.n > 0 }),
      F('base.harp.yMid', 'Draped strand centroid between the hold-down points, y<sub>mid</sub>', 'in', 'Height of the centroid of the draped strands above the soffit between the two hold-down points.', 'num', { when: b => +b.harp.n > 0 }),
      F('base.harp.frac', 'Hold-down point from ℄ bearing, frac × L<sub>span</sub>', '× L', 'Each of the two hold-down points is frac × L from the centreline of bearing at its end (PS-13), 0 < frac ≤ 0.5. Default 0.40 (PS-5).', 'num', { minX: 0, max: 0.5, when: b => +b.harp.n > 0 })],
      note: b => `Two hold-down points at ${(+b.harp.frac || 0).toFixed(2)} L from each ℄ bearing. The hold-down force check (MassDOT 3.7.2.2, CTDOT 5.9.1.6; AASHTO / RIDOT option, PS-10) is on the Owner rules tab.` },
    { tab: 'gird', id: 'stirrups', title: 'Shear reinforcement (stirrups)', ref: 'AASHTO LRFD 10th Ed. 5.7.2', fields: [
      F('base.opt.stirAv', 'A<sub>v</sub> per stirrup set (2 legs)', 'in²', 'Area of shear reinforcement in one stirrup set.'),
      F('base.opt.fy', 'Stirrup yield strength f<sub>y</sub>', 'ksi', 'Yield strength of the stirrups.'),
      F('base.opt.sEnd', 'End-zone spacing', 'in', 'Stirrup spacing near the ends.'),
      F('base.opt.endZoneLen', 'End-zone length', '× L', 'Fraction of the span, from each end, over which the end spacing runs (0 to 0.5).', 'num', { v: 'nn', max: 0.5 }),
      F('base.opt.sInt', 'Interior spacing', 'in', 'Stirrup spacing between the end zones.')] },
    { tab: 'gird', id: 'tie', title: 'Longitudinal reinforcement (5.7.3.5 tie)', ref: 'AASHTO LRFD 10th Ed. 5.7.3.5', fields: [
      F('base.opt.longAsBot', 'Bottom mild steel A<sub>s</sub> (end region)', 'in²', 'Bottom longitudinal bars in the end region, added to the strand tie capacity where developed.', 'num', { v: 'nn' }),
      F('base.opt.longFy', 'f<sub>y</sub> of the bottom bars', 'ksi', 'Yield strength of the bottom longitudinal bars.'),
      F('base.opt.endOh', 'Girder end past the bearing ℄', 'in', 'Girder length beyond the centreline of bearing; strand development starts at the girder end.', 'num', { v: 'nn' }),
      F('base.opt.Lpad', 'Bearing pad length', 'in', 'Pad length along the girder; the tie is checked at the inside edge of the pad, L_pad/2 from the bearing ℄.', 'num', { v: 'nn' })] },
    { tab: 'gird', id: 'rel', title: 'Release tension steel', ref: 'AASHTO LRFD 10th Ed. 5.9.2.3.1b', fields: [
      F('base.opt.relBondedReinf', 'Bonded reinforcement at release tension', '', 'Yes claims the 0.24√f′ci release tension limit (the provided steel must carry the tension force at 0.5 f_y ≤ 30 ksi); No uses min(0.0948√f′ci, 0.2 ksi).', 'bool', { o: [['true', 'Yes (0.24√f′ci)'], ['false', 'No']] }),
      F('base.opt.relAs', 'Provided A<sub>s</sub> in the tension zone', 'in²', 'Bonded steel provided in the release tension zone.', 'num', { v: 'nn', when: b => !!b.opt.relBondedReinf }),
      F('base.opt.relFy', 'f<sub>y</sub> of that steel', 'ksi', 'Yield strength of the release tension steel.', 'num', { when: b => !!b.opt.relBondedReinf }),
      F('base.cont.AsTop', 'Bonded steel, girder top near the pier', 'in²', 'Bonded steel in the top of the girder near an interior support, made continuous with the stress-limit design (5.12.3.3.5). Blank: the required area is reported.', 'opt', { v: 'nn', when: (b, P) => cont(b, P) && !b.cont.topRC && !!b.opt.relBondedReinf })] },
    { tab: 'gird', id: 'split', title: 'Splitting and confinement steel', ref: 'AASHTO LRFD 10th Ed. 5.9.4.4', fields: [
      F('base.opt.splitAv', 'Splitting steel: area per leg', 'in²', 'Anchorage-zone (splitting) steel within h/4 of the end: area of one leg (#5 ≈ 0.31 in²).', 'num', { v: 'nn' }),
      F('base.opt.splitN', 'Splitting steel: number of legs within h/4', '', 'Legs provided within h/4 of the end (stress limited to 20 ksi in the check).', 'num', { v: 'i0' }),
      F('base.opt.confBar', 'Confinement bar size (No.)', '', 'Bars enclosing the strands in the bottom flange within 1.5d of the end, not less than No. 3 (5.9.4.4.2).', 'num', { v: 'i1' }),
      F('base.opt.confS', 'Confinement bar spacing', 'in', 'Spacing of the confinement bars (≤ 6 in, 5.9.4.4.2).'),
      F('base.opt.confN', 'Confinement bars from the end', '', 'Number of confinement bars from each end.', 'num', { v: 'i0' })] },
    // ---- Materials ----
    { tab: 'mat', id: 'conc', title: 'Concrete', ref: 'AASHTO LRFD 10th Ed. 5.4.2', fields: [
      F('base.mat.fci', 'f′<sub>ci</sub>, girder at release', 'ksi', 'Girder concrete strength at transfer of prestress.'),
      F('base.mat.fc', 'f′<sub>c</sub>, girder at 28 days', 'ksi', 'Girder design concrete strength.'),
      F('base.mat.fcd', 'f′<sub>c</sub>, deck', 'ksi', 'Deck (and continuity diaphragm) concrete strength.'),
      F('base.mat.wc', 'Unit weight, girder (for E<sub>c</sub>)', 'kcf', 'Feeds E_c only (5.4.2.4), typically the plain-concrete density, e.g. 0.145 kcf. Normal-weight concrete only (≥ 0.135 kcf).'),
      F('base.mat.wcLoad', 'Unit weight, girder (dead load)', 'kcf', 'Drives the girder self-weight; usually higher, for the reinforcement (e.g. 0.150–0.155 kcf).'),
      F('base.mat.wcd', 'Unit weight, deck (for E<sub>c</sub>)', 'kcf', 'Feeds the deck E_c only (5.4.2.4).'),
      F('base.mat.wcdLoad', 'Unit weight, deck (dead load)', 'kcf', 'Drives the deck and haunch weight.')] },
    { tab: 'mat', id: 'strand', title: 'Prestressing strand', ref: 'AASHTO LRFD 10th Ed. 5.4.4, 5.9.2.2', fields: [
      F('base.str.size', 'Strand size (270 ksi, low relaxation)', '', 'Seven-wire strand, f_pu = 270 ksi, low relaxation.', 'sel', { o: () => Object.keys(typeof STRANDS !== 'undefined' ? STRANDS : {}).map(k => [k, k]) }),
      F('base.str.jack', 'Jacking stress f<sub>pj</sub> / f<sub>pu</sub>', '× f_pu', '0.75 f_pu is the Table 5.9.2.2-1 limit for low-relaxation strand.', 'num', { maxX: 1 }),
      F('base.str.Ep', 'Strand modulus E<sub>p</sub>', 'ksi', 'Modulus of elasticity of the strand (5.4.4.2: 28,500 ksi).')],
      note: () => 'f<sub>pu</sub> = 270 ksi, low relaxation (the old app\'s fixed values).' },
    { tab: 'mat', id: 'time', title: 'Time-dependent effects and losses', ref: 'AASHTO LRFD 10th Ed. 5.4.2.3, 5.9.3', fields: [
      F('base.mat.H', 'Relative humidity H', '%', 'Average annual ambient relative humidity (5.4.2.3). RIDOT default 80 %.', 'num', { max: 100 }),
      F('base.mat.VS', 'Volume / surface ratio V/S', 'in', 'Girder volume-to-surface ratio (5.4.2.3.2).'),
      F('base.mat.ti', 'Age at release t<sub>i</sub>', 'days', 'Girder age at strand transfer.'),
      F('base.mat.td', 'Age at deck placement t<sub>d</sub>', 'days', 'Girder age when the deck is placed; also the age at continuity (5.12.3.3.4).'),
      F('base.mat.tfin', 'Final age t<sub>f</sub>', 'days', 'End of service life for the long-term losses (e.g. 20,000 days).'),
      F('base.opt.lossMethod', 'Loss method', '', 'Refined time-step estimate (5.9.3.4) or the approximate lump-sum estimate (5.9.3.3).', 'sel', { o: [['refined', 'Refined (5.9.3.4)'], ['approx', 'Approximate (5.9.3.3)']] }),
      F('base.opt.dfpSSauto', 'Deck shrinkage gain Δf<sub>pSS</sub>', '', 'The deck shrinking against the composite section relieves strand stress (5.9.3.4.3d): computed, or entered.', 'bool', { o: [['true', 'Computed (5.9.3.4.3d)'], ['false', 'Entered']] }),
      F('base.opt.dfpSS', 'Δf<sub>pSS</sub>, entered', 'ksi', 'Deck shrinkage gain (positive = gain).', 'num', { v: 'any', when: b => !b.opt.dfpSSauto })] },
    { tab: 'mat', id: 'mult', title: 'Camber multipliers (PCI)', ref: 'PCI Design Handbook', fields: [
      F('base.opt.mult.psE', 'Prestress at erection', '', 'PCI long-term multiplier on the prestress camber at erection.'),
      F('base.opt.mult.swE', 'Self-weight at erection', '', 'PCI multiplier on the self-weight deflection at erection.'),
      F('base.opt.mult.psF', 'Prestress, final', '', 'PCI multiplier on the prestress camber, final.'),
      F('base.opt.mult.swF', 'Self-weight, final', '', 'PCI multiplier on the self-weight deflection, final.'),
      F('base.opt.mult.dkF', 'Deck, final', '', 'PCI multiplier on the deck deflection, final.'),
      F('base.opt.mult.sdF', 'Superimposed dead load, final', '', 'PCI multiplier on the superimposed dead load deflection, final.')] },
    // ---- Diaphragms / deck ----
    { tab: 'dd', id: 'deckd', title: 'Deck design (strip method)', ref: 'AASHTO LRFD 10th Ed. 4.6.2.1, 9.7.3', fields: [
      F('base.deck.on', 'Deck design', '', 'Transverse deck design (interior bays and overhang) by the equivalent-strip method, as the old app (PS-14).', 'bool', { o: [['false', 'Off'], ['true', 'On']] }),
      F('base.deck.wsFut', 'Future wearing surface', 'ksf', 'DW on the deck, factored at 1.50 separately from the slab.', 'num', { v: 'nn', when: b => !!b.deck.on }),
      F('base.deck.bBar', 'Barrier base width', 'in', 'Sets where the design wheel lands: 1 ft clear of the railing face.', 'num', { v: 'nn', when: b => !!b.deck.on }),
      F('base.deck.wBar', 'Barrier weight', 'klf', 'Barrier weight at the deck edge (overhang design).', 'num', { v: 'nn', when: b => !!b.deck.on }),
      F('base.deck.xnegAuto', 'Negative-moment design section', '', 'Distance from the girder ℄ to the design section for negative moment (4.6.2.1.6): automatic (b_tf/3 ≤ 15 in for a precast I), or entered.', 'bool', { o: [['true', 'Automatic (4.6.2.1.6)'], ['false', 'Entered']], when: b => !!b.deck.on }),
      F('base.deck.xneg', 'Design section from the girder ℄', 'in', 'Table A4-1 tabulates 0 to 24 in; values between are interpolated.', 'num', { v: 'nn', when: b => !!b.deck.on && b.deck.xnegAuto === false }),
      F('base.deck.fyd', 'Deck bar yield strength f<sub>y</sub>', 'ksi', 'Yield strength of the transverse deck bars.', 'num', { when: b => !!b.deck.on }),
      F('base.deck.barTop', 'Top bar area', 'in²', 'Area of one top transverse bar.', 'num', { when: b => !!b.deck.on }),
      F('base.deck.sTop', 'Top bar spacing', 'in', 'Spacing of the top transverse bars.', 'num', { when: b => !!b.deck.on }),
      F('base.deck.barBot', 'Bottom bar area', 'in²', 'Area of one bottom transverse bar.', 'num', { when: b => !!b.deck.on }),
      F('base.deck.sBot', 'Bottom bar spacing', 'in', 'Spacing of the bottom transverse bars.', 'num', { when: b => !!b.deck.on }),
      F('base.deck.coverT', 'Top cover', 'in', 'Clear cover to the top bars (5.10.1).', 'num', { when: b => !!b.deck.on }),
      F('base.deck.coverB', 'Bottom cover', 'in', 'Clear cover to the bottom bars (5.10.1).', 'num', { when: b => !!b.deck.on })],
      note: () => 'Deck thickness: <a href="#" data-goin="xsec">Cross-section tab</a>; the overhang is the deck overhang on the design girder\'s side (Cross-section tab). Interior-bay live load from Table A4-1.' },
    // ---- Loads ----
    { tab: 'loads', id: 'dead', title: 'Dead loads (per girder)', ref: 'AASHTO LRFD 10th Ed. 3.5.1', fields: [
      F('base.loads.wNC', 'DC1 additional, non-composite (forms, …)', 'klf', 'Added to the computed girder self-weight and deck + haunch, on the bare girder (stay-in-place forms, utilities carried before the deck cures).', 'num', { v: 'nn' }),
      F('base.loads.wBar', 'DC2 barrier / superimposed dead load', 'klf', 'Per girder, on the composite section. Shown when DC2 and DW are entered per girder (Cross-section tab: "Entered per girder type"); else distributed to each line (PR 3a-3, PS-9).', 'num', { v: 'nn', when: distOff }),
      F('base.loads.wDW', 'DW wearing surface and utilities', 'klf', 'Per girder, on the composite section. Shown when DC2 and DW are entered per girder; else distributed to each line (PR 3a-3, PS-9).', 'num', { v: 'nn', when: distOff })],
      note: (b, P) => 'Girder self-weight and the deck + haunch weight are computed from the section (Loads &amp; LLDF output tab). Diaphragm point loads: <a href="#" data-goin="dd">Diaphragms / deck tab</a>. '
        + (distOff(b, P) ? 'DC2 and DW entered per girder type (Cross-section tab: dead load distribution).' : 'DC2 and DW are distributed to each girder line from the barriers, sidewalks and wearing surface of the <a href="#" data-goin="xsec">Cross-section tab</a> (the Steel Bridge app\'s method, PS-9; PR 3a-3), shown per line on the Loads &amp; LLDF tab.') },
    { tab: 'loads', id: 'll', title: 'Live load (HL-93)', ref: 'AASHTO LRFD 10th Ed. 3.6.1, 4.6.2.2', fields: [
      F('base.loads.llAuto', 'Live load moment and shear', '', 'Automatic: HL-93 (truck or tandem with IM = 33 %, plus lane) × the distribution factor; Entered: your M_LL+IM and V_LL+IM per girder (simple span).', 'bool', { o: [['true', 'HL-93 × distribution factor'], ['false', 'Entered']] }),
      F('base.loads.MLL', 'M<sub>LL+IM</sub> at midspan (per girder)', 'k-ft', 'Entered live load moment including impact and distribution.', 'num', { v: 'nn', when: b => !b.loads.llAuto }),
      F('base.loads.VLL', 'V<sub>LL+IM</sub> at the support (per girder)', 'kip', 'Entered live load shear including impact and distribution.', 'num', { v: 'nn', when: b => !b.loads.llAuto }),
      F('base.loads.dfAuto', 'Distribution factors', '', 'AASHTO equations (Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1; exterior 4.6.2.2.2d), or entered.', 'bool', { o: [['true', 'AASHTO equations (type k; box beams and deck slabs types f / g)'], ['false', 'Entered']], when: b => !!b.loads.llAuto }),
      F('base.loads.dfm', 'DF moment, entered', 'lanes', 'Live load distribution factor for moment (lanes per girder, multiple presence included).', 'num', { when: b => !!b.loads.llAuto && !b.loads.dfAuto }),
      F('base.loads.dfv', 'DF shear, entered', 'lanes', 'Live load distribution factor for shear.', 'num', { when: b => !!b.loads.llAuto && !b.loads.dfAuto }),
      F('base.loads.fatM', 'Fatigue DF (single lane), entered', 'lanes', 'Single-lane fatigue distribution factor without multiple presence; 0 = from the design DF (÷ 1.2).', 'num', { v: 'nn' })],
      note: () => 'Skew and the exterior / interior position come from the bridge (Bridge layout and Cross-section tabs); d<sub>e</sub> and N<sub>L</sub>: <a href="#" data-goin="xsec">Cross-section tab</a>. Imported MIDAS demands (by file) come in a later PR.' },
    // PS-35 (2026-11-14): adjacent box beams and voided slabs, types (f) / (g): the J override (saved per girder type) and the range notice
    { tab: 'loads', id: 'fglldf', title: 'Box beam / deck slab live load distribution (types f / g)', ref: 'AASHTO LRFD 10th Ed. Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1; Eqs. C4.6.2.2.1-2, C4.6.2.2.1-3', when: fgShape, fields: [
      F('base.loads.Jfg', 'St. Venant torsional constant J (override)', 'in⁴', 'Blank: J from the library (a DOT value, where one is listed) or computed from the drawn outline (box / voided slab: a closed thin-walled cell, Eq. C4.6.2.2.1-3; solid slab: A⁴ / 40 I_p, Eq. C4.6.2.2.1-2). Enter a value (e.g. from the DOT sheets) to use it for this girder type: labelled "user/DOT value".', 'opt', { v: 'pos' })],
      note: (b, P) => (window.PSBLldfFG && window.PSBLldfFG.inputNote ? window.PSBLldfFG.inputNote(b, P) : '') },
    { tab: 'loads', id: 'stress', title: 'Service stress analysis', ref: 'AASHTO LRFD 10th Ed. 5.9.2.3, Table 3.4.1-1', fields: [
      F('base.opt.useTrans', 'Release stress section', '', 'Gross girder section, or transformed for the strands, at release.', 'bool', { o: [['false', 'Gross'], ['true', 'Transformed']] }),
      F('base.opt.gLLs3', 'γ<sub>LL</sub> for Service III', '', '1.0 only with refined losses taking the elastic gains; 0.8 otherwise (Table 3.4.1-4).')] },
    { tab: 'loads', id: 'rate', title: 'Load rating factors', ref: 'MBE 6A.4.2.3, 6A.4.2.4', fields: [
      F('base.opt.rtPhiC', 'Condition factor φ<sub>c</sub>', '', '1.00 good or satisfactory, 0.95 fair, 0.85 poor (MBE Table 6A.4.2.3-1).'),
      F('base.opt.rtPhiS', 'System factor φ<sub>s</sub>', '', '1.00 multi-girder (MBE Table 6A.4.2.4-1).')],
      note: () => 'φ<sub>c</sub>·φ<sub>s</sub> ≥ 0.85 (MBE Eq. 6A.4.2.1-3). Legal and permit vehicles: the table below.' },
    { tab: 'loads', id: 'hand', title: 'Handling (lifting and hauling)', ref: 'release stage; stability screening only (not PCI 2016 / Mast)', fields: [
      F('base.handling.on', 'Handling checks', '', 'Stresses at the lifting and hauling support points and a simplified lateral-stability screening (not the PCI / Mast method).', 'bool', { o: [['false', 'Off'], ['true', 'On']] }),
      F('base.handling.aLift', 'Lift point from the girder end', 'ft', 'Distance of the lifting loops from each end.', 'num', { v: 'nn', when: b => !!b.handling.on }),
      F('base.handling.aHaul', 'Haul support (bunk) from the end', 'ft', 'Distance of the truck / trailer supports from each end.', 'num', { v: 'nn', when: b => !!b.handling.on }),
      F('base.handling.ei', 'Initial sweep e<sub>i</sub>', 'in', 'Lateral straightness tolerance of the girder centre of gravity.', 'num', { v: 'nn', when: b => !!b.handling.on }),
      F('base.handling.hr', 'Roll centre height (haul)', 'in', 'Height of the roll centre of the hauling rig above the road.', 'num', { v: 'nn', when: b => !!b.handling.on }),
      F('base.handling.theta_i', 'Road cross slope θ<sub>i</sub>', 'rad', 'Superelevation / cross slope during hauling.', 'num', { v: 'nn', when: b => !!b.handling.on })] },
    // ---- Owner rules ----
    // PS-10 (PR 2d-3, engine/holddown.js): the hold-down force limit for an owner without its own rule (AASHTO, RIDOT)
    { tab: 'own', id: 'hd', title: 'Hold-down force limit (PS-10)', ref: 'MassDOT 3.7.2.2 / CTDOT V2 5.9.1.6 rule as an option; AASHTO LRFD sets none',
      when: b => !(window.PBD && window.PBD.ownRule && window.PBD.ownRule(window.PBD.ownerOf(b), 'hd.max')), fields: [
      F('base.opt.hdCheck', 'Check the hold-down force', '', 'Total hold-down force of the draped strands at jacking, F_hd = 2 n_h f_pbt A_b sin α, against a fraction of the beam weight (PS-10, engineer 2026-11-12: on by default for AASHTO and RIDOT projects).', 'bool', { o: [['true', 'Check (default)'], ['false', 'Do not check']] }),
      F('base.opt.hdFrac', 'Limit, × the beam weight W', '× W', 'F_hd ≤ this fraction × W, W = w_sw × the girder length. 0.75 is the MassDOT 3.7.2.2 / CTDOT V2 5.9.1.6 value (default); enter the precaster\'s or owner\'s value if different.', 'num', { when: b => b.opt.hdCheck !== false })],
      note: () => 'AASHTO LRFD sets no limit on the hold-down force; MassDOT and CTDOT require F<sub>hd</sub> ≤ 0.75 W and the engine checks that for those owners whatever this box says. Worked on the End zone &amp; hold-down output tab.' },
    { tab: 'own', id: 'limits', title: 'Stress limits', ref: 'AASHTO LRFD 10th Ed. 5.9.2.3', fields: [
      F('base.opt.relCfac', 'Release compression limit, × f′<sub>ci</sub>', '× f′ci', '0.65 per 5.9.2.3.1a (0.70 at component extremities where lateral bending is included); some owners require 0.60. Blank = 0.65.', 'opt'),
      F('base.opt.corrosion', 'Corrosion exposure (Service III tension limit)', '', 'Table 5.9.2.3.2b-1, λ = 1.0: moderate 0.19√f′c ≤ 0.6 ksi; severe 0.0948√f′c ≤ 0.3 ksi. Owner defaults: RIDOT, CTDOT, MassDOT severe.', 'sel', { o: [['normal', 'Moderate'], ['severe', 'Severe']] })] }
  ];
  /* the table inputs: { path, tab, cols: [[key, label, unit, rule, tip]] } (rule as a field's v; 'text' = free text) */
  const TABLES = {
    'base.rows': { tab: 'gird', title: 'Straight strand rows', cols: [['n', 'Strands', '', 'i0', 'Number of strands in the row'], ['y', 'y from soffit', 'in', 'pos', 'Height of the row above the soffit'],
      ['nd', 'Debonded', '', 'i0', 'Number of debonded (sheathed) strands in the row'], ['dbnd', 'Debond length each end', 'ft', 'nn', 'Debonded length from each end']] },
    'base.loads.diaph': { tab: 'dd', title: 'Diaphragms (DC1 point loads)', cols: [['P', 'P', 'kip', 'nn', 'Diaphragm weight on this girder'], ['a', 'a from the left bearing', 'ft', 'nn', 'Location along the span, from the left ℄ bearing']] },
    'base.rateVeh': { tab: 'loads', title: 'Legal / permit vehicles (factored forces)', cols: [['name', 'Vehicle', '', 'text', 'Name, e.g. Type 3S2'], ['M', 'Factored M', 'k-ft', 'any', 'Fully factored live-load moment (DF, IM, MPF and the LRFR live-load factor applied)'],
      ['V', 'Factored V', 'kip', 'any', 'Fully factored live-load shear'], ['W', 'Weight', 'ton', 'nn', 'Gross vehicle weight (for the rated tons)']] }
  };
  const get = (o, path) => path.split('.').reduce((a, k) => a == null ? a : a[k], o);
  const ALL = () => CARDS.reduce((a, c) => a.concat(c.fields.map(f => Object.assign({ card: c }, f))), []);
  const byPath = {}; ALL().forEach(f => { byPath[f.p] = f; });
  /* tabOf(path): the input tab of a project path (fields, tables, bridge-level fields), or '' */
  function tabOf(path) {
    const p = String(path || '');
    if (/^project\b/.test(p)) return 'proj';
    if (/^(spans|xs\.skews)\b/.test(p)) return 'layout';
    if (/^xs\b/.test(p)) return 'xsec';
    if (/^(design|types)\b/.test(p)) return 'gird';   // types: PR 3a-1 (the girder types card)
    if (/^base\.(owner|opt\.eta[DRI]|opt\.llMult|opt\.sidewalk)\b/.test(p)) return 'own';
    for (const t in TABLES) if (p === t || p.indexOf(t + '.') === 0) return TABLES[t].tab;
    let q = p; while (q) { if (byPath[q]) return byPath[q].card.tab; q = q.replace(/\.?[^.]*$/, ''); }
    return '';
  }
  const plain = s => String(s || '').replace(/<sub>(.*?)<\/sub>/g, '_$1').replace(/<[^>]+>/g, '');
  window.PSBFields = { CARDS, TABLES, ALL, byPath, tabOf, get, plain };
})();
