/* apps/steel-bridge/engine/proportions.js — cross-section proportion limits and the minimum negative-flexure deck reinforcement of a
   steel I-girder location (window.SBDProportions). Classic script, no DOM. Needs window.SharedSteps; window.SBDOwners optional (owner
   rules). Called by engine/flexure.js location() for every flexure location (its result r: plates, region, compression and tension
   flanges, b_eff) so that they appear with the flexure checks, in the governing ratio and in Auto design's full check.

   Ported 2026-11-01 from GirderDetail ("Steel Bridge Design.html"), Girder section module GM.gs, checks() (anchor `id: 'GS1', grp: P1`),
   operation for operation:
     GS1  web proportions, D/t_w ≤ 150 (AASHTO LRFD 10th Ed. Art. 6.10.2.1.1, webs without longitudinal stiffeners); ratio (D/t_w)/150;
     GS2  flange proportions (Art. 6.10.2.2), each flange: b_f/2t_f ≤ 12.0 (Eq. 6.10.2.2-1), b_f ≥ D/6 (Eq. 6.10.2.2-2), t_f ≥ 1.1t_w
          (Eq. 6.10.2.2-3); ratios (b/2t)/12, (D/6)/b_f, 1.1t_w/t_f;
     GS3  0.1 ≤ I_yc/I_yt ≤ 10 (Eq. 6.10.2.2-4), I_y = t b³/12 of the compression and the tension flange (top / bottom by the region);
          ratio max(0.1/(I_yc/I_yt), (I_yc/I_yt)/10);
     GS4  minimum negative-flexure deck reinforcement (Art. 6.10.1.7), at every negative-flexure location: A_r = A_top + A_bot ≥
          0.01 b_eff t_deck (ratio required/provided); the top-layer share A_top/A_r ≥ 2/3 is a "should" provision: a warning, not in the
          ratio (GirderDetail: st 'warn'). Owner MassDOT (deck.rebar1, OWN17): the owner's citation is added (required regardless of the
          deck stress, as applied here at every negative-flexure location);
     GS22 owner MassDOT (rule a6, OWN23): Appendix A6 should not be used: at every negative-flexure location, a warning when A6 is the
          method in use (not in the ratio).
   Not in GirderDetail and not here: the 6.10.1.7 bar size and spacing limits (no bar input).
   Warning items carry warn: true, inUse: false and no ratio (as GirderDetail's 'warn' items, which no ratio governs). The worked steps
   have the ids fx.gs1.ok, fx.gs2.<flange>.<k>, fx.gs3.ok, fx.gs4.req / .ok / .top, fx.gs22.
   Units: in, in². */
(function () {
  'use strict';
  const ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3);
  const ck = o => ({ ratio: o.demand / o.capacity, ok: o.capacity >= o.demand - 1e-9, inUse: true, ...o });   // engine/flexure.js ck
  const ownerOf = (r, prj) => (prj && prj.owner) || (r.G && r.G.own && r.G.own.o) || '';
  const rule = (o, id) => (window.SBDOwners && o && o !== 'AASHTO' ? window.SBDOwners.rule(o, id) : null);
  const cite = q => (q && window.SBDOwners ? window.SBDOwners.cite(q) : '');
  const flanges = r => [['top', r.topB, r.topT], ['bottom', r.botB, r.botT]];
  const deckOf = prj => { const dk = (prj && prj.deck) || {}, rb = dk.rebar || {}; return { nc: dk.composite === false, hand: !!dk.arHandoff, tdeck: dk.tdeck, Art: (rb.top && rb.top.A) || 0, Arb: (rb.bot && rb.bot.A) || 0 }; };

  /* items(r, prj): the GS1–GS4 (and GS22) check items of a flexure location r (engine/flexure.js location) */
  function items(r, prj) {
    const out = [], D = r.D, tw = r.tw;
    { const v = D / tw; out.push(ck({ id: 'GS1', key: 'web', title: 'Web proportions, D/t_w ≤ 150', ref: `${ED} Eq. 6.10.2.1.1-1`, demand: v, capacity: 150, unit: '', step: 'fx.gs1.ok' })); }
    flanges(r).forEach(([f, b, t]) => {
      out.push(ck({ id: 'GS2', key: f[0] + 'bt', title: `Flange proportions, ${f} flange, b_f/2t_f ≤ 12.0`, ref: `${ED} Eq. 6.10.2.2-1`, demand: b / (2 * t), capacity: 12, unit: '', step: `fx.gs2.${f}.bt` }));
      out.push(ck({ id: 'GS2', key: f[0] + 'bD', title: `Flange proportions, ${f} flange, b_f ≥ D/6`, ref: `${ED} Eq. 6.10.2.2-2`, demand: D / 6, capacity: b, unit: 'in', step: `fx.gs2.${f}.bD` }));
      out.push(ck({ id: 'GS2', key: f[0] + 'tt', title: `Flange proportions, ${f} flange, t_f ≥ 1.1t_w`, ref: `${ED} Eq. 6.10.2.2-3`, demand: 1.1 * tw, capacity: t, unit: 'in', step: `fx.gs2.${f}.tt` }));
    });
    { const Iyc = r.cF.t * r.cF.b ** 3 / 12, Iyt = r.tF.t * r.tF.b ** 3 / 12, v = Iyc / Iyt, ratio = Math.max(0.1 / v, v / 10);
      out.push({ id: 'GS3', key: 'iy', title: 'Flange moment of inertia ratio, 0.1 ≤ I_yc/I_yt ≤ 10', ref: `${ED} Eq. 6.10.2.2-4`, demand: v, capacity: v >= 1 ? 10 : 0.1, ratio, ok: v >= 0.1 && v <= 10, inUse: true, unit: '', step: 'fx.gs3.ok' }); }
    const own = ownerOf(r, prj), dk = deckOf(prj);
    if (!r.pos) {
      const rM = rule(own, 'deck.rebar1'), ref = `${ED} Art. 6.10.1.7${rM ? '; ' + cite(rM) : ''}`;
      if (dk.nc) out.push({ id: 'GS4', key: 'ar', title: 'Minimum negative-flexure deck reinforcement', ref, na: 'Not applicable: noncomposite section (no deck reinforcement in the section).', inUse: false, ratio: NaN, step: 'fx.gs4.req' });
      else if (dk.hand) out.push({ id: 'GS4', key: 'ar', title: 'Minimum negative-flexure deck reinforcement', ref, na: 'Not checked on a hand-off file: its A_r is GirderDetail\'s Structural analysis input (a percentage of b_eff t_s at mid-depth), not the deck bars. Checked with this project\'s deck reinforcement on its analysis (Flexure tab, This project\'s analysis).', inUse: false, ratio: NaN, step: 'fx.gs4.req' });
      else { const req = 0.01 * r.beff * dk.tdeck, Ar = dk.Art + dk.Arb, sh = Ar > 0 ? dk.Art / Ar : 0;
        out.push(ck({ id: 'GS4', key: 'ar', title: 'Minimum negative-flexure deck reinforcement, A_r ≥ 0.01b_eff t_deck', ref, demand: req, capacity: Ar, unit: 'in²', step: 'fx.gs4.ok' }));
        out.push({ id: 'GS4', key: 'top', title: 'Deck reinforcement, top-layer share ≥ 2/3 (should)', ref: `${ED} Art. 6.10.1.7`, demand: sh, capacity: 2 / 3, unit: '', ratio: NaN, inUse: false, warn: !(sh >= 2 / 3 - 1e-3), ok: sh >= 2 / 3 - 1e-3,
          na: sh >= 2 / 3 - 1e-3 ? `Top layer ${n3(sh)} of A_r (≥ 0.667).` : `Warning: top layer ${n3(sh)} of A_r (target ≥ 0.667; a "should" provision).`, step: 'fx.gs4.top' }); }
      const rA = rule(own, 'a6');
      if (rA) out.push({ id: 'GS22', key: 'a6own', title: 'Appendix A6 not used (owner)', ref: cite(rA), inUse: false, ratio: NaN, ok: !r.useA6, warn: !!r.useA6,
        na: r.useA6 ? 'Warning: Appendix A6 is the method in use; the owner says it should not be used. Set Negative flexure to "6.10.8 only".' : 'Article 6.10.8 (Appendix A6 not used).', step: 'fx.gs22' });
    }
    return out;
  }

  /* steps(r, prj): the worked steps of items(r, prj) (SharedSteps) */
  function steps(r, prj) {
    const w = St().work('fx'), D = r.D, tw = r.tw, okv = (dem, cap) => cap >= dem - 1e-9 ? 'OK' : 'NG';
    { const v = D / tw; w.add({ id: 'gs1.ok', label: 'Web proportions (no longitudinal stiffeners)', sym: '\\frac{D}{t_{w}}', eq: '\\le 150', sub: `\\frac{${n2(D)}}{${n3(tw)}} = ${n2(v)} \\le 150`, value: okv(v, 150), unit: '', ref: `${ED} Eq. 6.10.2.1.1-1`, ok: v <= 150 + 1e-9 }); }
    flanges(r).forEach(([f, b, t]) => { const bt = b / (2 * t);
      w.add({ id: `gs2.${f}.bt`, label: `Flange proportions, ${f} flange: slenderness`, sym: '\\frac{b_{f}}{2t_{f}}', eq: '\\le 12.0', sub: `\\frac{${n2(b)}}{2(${n3(t)})} = ${n2(bt)} \\le 12.0`, value: okv(bt, 12), unit: '', ref: `${ED} Eq. 6.10.2.2-1`, ok: bt <= 12 + 1e-9 });
      w.add({ id: `gs2.${f}.bD`, label: `Flange proportions, ${f} flange: width`, sym: 'b_{f}', eq: '\\ge \\frac{D}{6}', sub: `${n2(b)} \\ge \\frac{${n2(D)}}{6} = ${n2(D / 6)}`, value: okv(D / 6, b), unit: '', ref: `${ED} Eq. 6.10.2.2-2`, ok: b >= D / 6 - 1e-9 });
      w.add({ id: `gs2.${f}.tt`, label: `Flange proportions, ${f} flange: thickness`, sym: 't_{f}', eq: '\\ge 1.1t_{w}', sub: `${n3(t)} \\ge 1.1(${n3(tw)}) = ${n3(1.1 * tw)}`, value: okv(1.1 * tw, t), unit: '', ref: `${ED} Eq. 6.10.2.2-3`, ok: t >= 1.1 * tw - 1e-9 }); });
    { const Iyc = r.cF.t * r.cF.b ** 3 / 12, Iyt = r.tF.t * r.tF.b ** 3 / 12, v = Iyc / Iyt, ok = v >= 0.1 && v <= 10;
      w.add({ id: 'gs3.Iy', label: `Flange moments of inertia about the web axis (compression: ${r.cF.lab}, tension: ${r.tF.lab} flange)`, sym: 'I_{yc},\\ I_{yt}', eq: '\\frac{t_{f}b_{f}^{3}}{12}', sub: `\\frac{${n3(r.cF.t)}(${n2(r.cF.b)})^{3}}{12} = ${n2(Iyc)},\\ \\frac{${n3(r.tF.t)}(${n2(r.tF.b)})^{3}}{12} = ${n2(Iyt)}`, value: Iyc, unit: 'in^{4}', d: 2, ref: `${ED} Art. 6.10.2.2` });
      w.add({ id: 'gs3.ok', label: 'Flange moment of inertia ratio', sym: '\\frac{I_{yc}}{I_{yt}}', eq: '0.1 \\le \\frac{I_{yc}}{I_{yt}} \\le 10', sub: `\\frac{${n2(Iyc)}}{${n2(Iyt)}} = ${n3(v)}`, value: ok ? 'OK' : 'NG', unit: '', ref: `${ED} Eq. 6.10.2.2-4`, ok }); }
    if (!r.pos) {
      const own = ownerOf(r, prj), dk = deckOf(prj), rM = rule(own, 'deck.rebar1');
      if (dk.nc) w.add({ id: 'gs4.req', label: 'Minimum negative-flexure deck reinforcement', sym: 'A_{r}', eq: '', sub: '', value: 'n/a (noncomposite)', unit: '', ref: `${ED} Art. 6.10.1.7` });
      else if (dk.hand) w.add({ id: 'gs4.req', label: 'Minimum negative-flexure deck reinforcement', sym: 'A_{r}', eq: '', sub: '', value: 'not checked (hand-off file)', unit: '', ref: `${ED} Art. 6.10.1.7`, note: 'The hand-off\'s A_r is GirderDetail\'s Structural analysis input (rebarPct % of b_eff t_s at mid-depth), not the deck bars.' });
      else { const req = 0.01 * r.beff * dk.tdeck, Ar = dk.Art + dk.Arb, sh = Ar > 0 ? dk.Art / Ar : 0;
        w.add({ id: 'gs4.req', label: 'Minimum longitudinal deck reinforcement, negative flexure (1 % of the deck area)', sym: 'A_{r,min}', eq: '0.01\\,b_{eff}\\,t_{deck}', sub: `0.01(${n2(r.beff)})(${n2(dk.tdeck)})`, value: req, unit: 'in^{2}', d: 2, ref: `${ED} Art. 6.10.1.7${rM ? '; ' + cite(rM) : ''}`,
          note: (rM ? `${cite(rM)}: ${rM.text}. ` : '') + 'Applied at every negative-flexure location (GirderDetail GS4). Bars F_y ≥ 60 ksi, not larger than No. 6, at no more than 12 in: not checked (no bar input).' });
        w.add({ id: 'gs4.ok', label: 'Deck reinforcement provided (top + bottom layers)', sym: 'A_{r}', eq: 'A_{top} + A_{bot} \\ge A_{r,min}', sub: `${n2(dk.Art)} + ${n2(dk.Arb)} = ${n2(Ar)} \\ge ${n2(req)}`, value: okv(req, Ar), unit: '', ref: `${ED} Art. 6.10.1.7`, ok: Ar >= req - 1e-9 });
        w.add({ id: 'gs4.top', label: 'Top-layer share of the deck reinforcement (should be two-thirds or more)', sym: '\\frac{A_{top}}{A_{r}}', eq: '\\ge 0.667', sub: `\\frac{${n2(dk.Art)}}{${n2(Ar)}} = ${n3(sh)}`, value: sh >= 2 / 3 - 1e-3 ? 'OK' : 'warning', unit: '', ref: `${ED} Art. 6.10.1.7`, ok: sh >= 2 / 3 - 1e-3, note: 'A "should" provision: a warning, not a failure.' }); }
      const rA = rule(own, 'a6');
      if (rA) w.add({ id: 'gs22', label: `Owner: Appendix A6 not used (${cite(rA)})`, sym: '\\text{method}', eq: '', sub: '', value: r.useA6 ? 'App. A6 used (warning)' : 'Article 6.10.8', unit: '', ref: cite(rA), ok: !r.useA6, note: `${rA.text}. Negative flexure method: the Flexure tab (Negative flexure).` });
    }
    return w.steps;
  }

  /* summary(rows): over the locations of a girder (engine/flexure.js girder().rows), per check id GS1, GS2, GS3, GS4, GS22: the item with the
     largest ratio and its location ({ id, row, c }), and the warnings ({ id, row, c }) */
  const IDS = ['GS1', 'GS2', 'GS3', 'GS4', 'GS22'];
  function summary(rows) {
    const gov = [], warn = [];
    IDS.forEach(id => { let b = null; rows.forEach(row => (row.checks || []).forEach(c => { if (c.id !== id) return; if (c.warn) warn.push({ id, row, c });
      if (isFinite(c.ratio) && (!b || c.ratio > b.c.ratio)) b = { id, row, c }; })); if (b) gov.push(b); });
    return { gov, warn };
  }
  window.SBDProportions = { IDS, items, steps, summary };
})();
