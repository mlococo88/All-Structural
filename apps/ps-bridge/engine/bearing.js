/* apps/ps-bridge/engine/bearing.js — the bearingLoads hand-off of the PS Bridge app (window.PSBBearing): the unfactored reactions of every
   girder line at every bearing line, for the Elastomeric Bearing Design Module (HANDOFF.md §4.17). Classic script, no DOM, no storage.
   Added 2026-11-24 (engineer-approved task "bearing hand-off from both bridge tools", BRG-HO; fixlog/ps-bridge.md). The page
   (ui/handoffs.js) publishes it; Node tests: tests/engine/psbridge-bearing.test.mjs.

   blPayload(P, cells) -> { ok, payload, sum } | { error }
     cells = PSBBridge.results(...).cells (each span of each girder line: its girder type's engine inputs inp and result R).
     A bearing line is one girder END: Abut. 1 = span 1 left end; Pier k back = span k right end, Pier k ahead = span k+1 left end;
     Abut. 2 = the last span's right end (a precast girder end sits on its own bearing, also over a pier with continuity, so the two
     spans' reactions are NOT summed, unlike superReactions).
     Per girder (kip, unfactored, + up), with no arithmetic beyond reading the engine's own values:
       DC1, DC2, DW, separate { PL, PLmin, UT, UF, UTc }   the girder end's values of PSBHandoffs.srPayload (the Analysis tab's
                                                           "Reactions (unfactored, kip)"; superReactions §4.4 and its "Separate items")
       LL { max, min, maxIM, minIM }   the HL-93 live load reaction per girder at the end, × the girder's shear distribution factor
                                       (R.dfv, multiple presence as in the DF), without and with IM:
         simple span, automatic LL: maxIM = R.VLL = DF_v (1.33 max(V_truck, V_tandem) + V_lane) (the engine's support shear),
           max = DF_v (max(V_truck, V_tandem) + V_lane) (R.hl, the same terms without the 1.33), min = minIM = 0;
         simple span, entered LL: maxIM = the entered V_LL+IM (R.VLL); max = null (not known without IM); min = minIM = 0;
         continuity on (R.fe): the end-shear rows of the engine's own continuous-unit model (PBD.sgBeam, the rows PBD.contFE takes):
           left end  maxIM = DF_v pos, minIM = DF_v neg; max = DF_v (max(truckMax, tanMax) + lanePos), min = DF_v (min(truckMin, tanMin) + laneNeg)
           right end (reaction = − shear) maxIM = − DF_v neg, minIM = − DF_v pos, max / min likewise;
         imported demands (MIDAS file or custom table): not sent (LL null): the imported live load's basis (IM, DF) is the file's.
       service { Pdl, Pll, PllIM, Pmin }   SharedBearingLoads.service (shared/bearing-loads.js), the sums the bearing module uses.
     movement: { material: 'prestressed concrete', continuity, units: [{ spans, length }], fixity: null } (no thermal coefficient input
       here; bearing fixity is not defined in this app). No end rotations: the engine computes none (only midspan deflections).
     Refused (nothing sent) as srAll: a line of a span with no girder type, or a girder with an input error.
   No load factor, no new formula: every value is read from the engine result or is a sum the notes spell out. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const PRODUCER = 'PS-Beam', FILE = 'apps/ps-bridge/index.html', ID = 'psbridge';
  const isN = v => typeof v === 'number' && isFinite(v);
  const r3 = v => Math.round(v * 1000) / 1000;
  const f2 = v => (+v).toFixed(2);
  const supId = (k, ns) => k === 0 ? 'Abut. 1' : k === ns ? 'Abut. 2' : 'Pier ' + k;
  const extOn = (inp, R) => !!(R && R.useExt && inp && inp.external);

  /* llEnds(inp, R): the live load reactions at the two ends of the span ([left, right]), or null (imported demands / not computed) */
  function llEnds(inp, R) {
    if (!R || R.error || extOn(inp, R)) return null;
    const dfv = +R.dfv;
    if (R.fe && W.PBD && W.PBD.sgBeam) {
      if (!isN(dfv)) return null;
      const beam = W.PBD.sgBeam(R.fe.spans, false), s = R.fe.s, i0 = beam.sup[s - 1], i1 = beam.sup[s];
      const a = beam.VLLr[i0], b = beam.VLL[i1 - 1];   // the shear rows PBD.contFE takes at its first and last node
      if (!a || !b) return null;
      const noIM = v => ({ hi: Math.max(v.truckMax, v.tanMax) + v.lanePos, lo: Math.min(v.truckMin, v.tanMin) + v.laneNeg });
      const A = noIM(a), B = noIM(b);
      return { basis: 'cont', ends: [
        { max: r3(dfv * A.hi), min: r3(dfv * A.lo), maxIM: r3(dfv * a.pos), minIM: r3(dfv * a.neg) },
        { max: r3(-dfv * B.lo), min: r3(-dfv * B.hi), maxIM: r3(-dfv * b.neg), minIM: r3(-dfv * b.pos) }] };
    }
    if (!isN(+R.VLL)) return null;
    const auto = !!(inp && inp.loads && inp.loads.llAuto), hl = R.hl;
    const max = auto && hl && isN(hl.Vtr) && isN(hl.Vtd) && isN(hl.Vln) && isN(dfv) ? r3(dfv * (Math.max(hl.Vtr, hl.Vtd) + hl.Vln)) : null;
    const e = { max, min: 0, maxIM: r3(+R.VLL), minIM: 0 };
    return { basis: auto ? 'simple' : 'entered', ends: [e, Object.assign({}, e)] };
  }

  function blPayload(P, cells) {
    const H = W.PSBHandoffs, SB = W.SharedBearingLoads;
    if (!H || !SB) return { error: 'the hand-off engine is not loaded' };
    const spans = ((P && P.spans && P.spans.lengths) || []).map(Number), ns = spans.length, nb = Math.round(+(P && P.xs && P.xs.nb));
    if (!ns || !spans.every(v => isN(v) && v > 0)) return { error: 'Enter the span lengths (Bridge layout tab).' };
    if (!(nb >= 1)) return { error: 'Define the cross-section (number of girders, Cross-section tab).' };
    const at = {}; (cells || []).forEach(c => { if (!at[c.s + '.' + c.g]) at[c.s + '.' + c.g] = c; });
    const miss = [], bad = [];
    for (let s = 1; s <= ns; s++) for (let g = 1; g <= nb; g++) if (!at[s + '.' + g]) miss.push(`G${g}/S${s}`);
    if (miss.length) return { error: `Every girder line of every span needs a girder type (Girders & strands tab, Girder types): none on ${miss.join(', ')}.` };
    const X = [0]; spans.forEach(v => X.push(r3(X[X.length - 1] + v)));
    const cont = !!(P.spans && P.spans.continuity === 'composite') && ns > 1;
    // the bearing lines: two per span (its left and right girder ends), in station order
    const lines = [];
    for (let s = 1; s <= ns; s++) {
      lines.push({ support: supId(s - 1, ns), side: 'ahead', span: s, end: 'left', x: X[s - 1], unit: cont ? 0 : s - 1, girders: [] });
      lines.push({ support: supId(s, ns), side: 'back', span: s, end: 'right', x: X[s], unit: cont ? 0 : s - 1, girders: [] });
    }
    const basis = {}, sepHas = {}, ext = [], entered = [];
    for (let s = 1; s <= ns; s++) for (let g = 1; g <= nb; g++) {
      const c = at[s + '.' + g], b = H.srPayload(c.inp, c.R);
      if (!b || b.error || !b.payload) { bad.push(`G${g}, span ${s} (${c.label || 'type ' + (c.k + 1)}): ${(b && b.error) || 'no result'}`); continue; }
      const q = b.payload.supports; if (!Array.isArray(q) || q.length !== 2) { bad.push(`G${g}, span ${s}: not two end reactions`); continue; }
      const ll = llEnds(c.inp, c.R);
      if (!ll) ext.push(`G${g}/S${s}`); else { basis[ll.basis] = true; if (ll.basis === 'entered') entered.push(`G${g}/S${s}`); }
      [0, 1].forEach(k => {
        const x = q[k].girders[0], e = { label: 'G' + g, position: x.position, type: String(c.label || ''), DC1: x.DC1, DC2: x.DC2, DW: x.DW };
        if (x.separate) { e.separate = Object.assign({}, x.separate); Object.keys(x.separate).forEach(f => { if (f !== 'PLmin') sepHas[f] = true; }); }
        e.LL = ll ? ll.ends[k] : null;
        e.service = SB.service(e);
        lines[2 * (s - 1) + k].girders.push(e);
      });
    }
    if (bad.length) return { error: `The bearing loads cannot be built: ${bad.join('; ')}. Fix the inputs first.` };
    const units = cont ? [{ spans: spans.map((_, i) => i + 1), length: X[ns] }] : spans.map((v, i) => ({ spans: [i + 1], length: r3(v) }));
    const pr = (P && P.project) || {};
    const sepD = Object.keys(sepHas).length ? H.sepInfo(sepHas) : null;
    const notes = [
      `Bearing loads of every girder line (G1 to G${nb}) at every bearing line from the PS Bridge app (apps/ps-bridge): one bearing line per girder end (Abut. 1 = span 1 left end; Pier k "back" = span k right end, Pier k "ahead" = span k+1 left end; Abut. 2 = the last span's right end). The two spans' reactions at a pier are not added together: each girder end has its own bearing.`,
      'Unfactored, kip, + up, per girder (one bearing per girder end: divide by the number of bearings per girder end where there are more). DC1, DC2, DW (and the separate items) are the girder end\'s values of the Analysis tab, "Reactions (unfactored, kip)" (the same values as the superReactions hand-off of that girder type and line).',
      cont ? `Continuity for composite loads on (spans ${spans.map(f2).join(', ')} ft): DC2, DW and the live load are each span's end shears on the continuous unit (as reactions, + up); DC1 is on the simple non-composite span.` : `Simple spans (${spans.map(f2).join(', ')} ft): R = wL/2 for each uniform load at each end; the live load is the support shear of the simple span.`,
      'Live load LL: HL-93 (design truck or tandem, plus the lane load) per girder, × the girder\'s shear distribution factor DF_v (multiple presence as in the distribution factor): "max" / "min" without the dynamic load allowance, "maxIM" / "minIM" with IM = 33 % on the truck or tandem (3.6.2.1). The two-truck reaction case of 3.6.1.3.1 (90 % of two trucks plus the lane at an interior pier) is not included: the end shear envelope of one truck or tandem plus the lane is sent. The owner\'s design load multiplier (if any) is not included.',
      'Service totals (load factor 1.0, the sums the bearing module uses): Pdl = DC1 + DC2 + DW; Pll = LL max + PL; PllIM = LL maxIM + PL; Pmin = DC1 + DC2 − UT − UF (permanent DC load only for the slip check: no DW, no utilities, no future utility allowance).',
      `Movement: material prestressed concrete; ${cont ? `one continuous unit of ${f2(X[ns])} ft` : 'each span its own unit (an expansion joint at each pier)'}; bearing fixity is not defined in this app (the point of zero movement is not known) and no coefficient of thermal expansion is an input here: neither is sent. End rotations are not computed by this app and are not sent.`];
    if (ext.length) notes.push(`${ext.join(', ')}: imported demands (a custom table, or demands kept from an earlier version): the live load reaction is not sent (LL null); the entered live load's IM and DF are as entered. Enter P_LL in the bearing module.`);
    if (entered.length) notes.push(`${entered.join(', ')}: live load entered (V_LL+IM per girder): maxIM is the entered value; the value without IM is not known (max null).`);
    if (sepD) notes.push('Separate items (girders[].separate, as in superReactions): UT and UF are ALREADY INSIDE DC1, UTc ALREADY INSIDE DW, PL (pedestrian live load, 3.6.1.6, no IM, no DF) in NO other field.');
    const payload = { _schema: SB.SCHEMA, schemaVersion: 1, producer: PRODUCER, producerFile: FILE, project: { name: String(pr.name || ''), bridgeId: '' },
      units: { force: 'kip', length: 'ft' }, factored: false, perGirder: true,
      liveLoad: { vehicle: 'HL-93', dfIncluded: true, multiplePresence: 'as in the distribution factor', im: 0.33, fields: { noIM: ['max', 'min'], withIM: ['maxIM', 'minIM'] } },
      spans: spans.slice(), continuity: cont ? 'continuous' : 'simple',
      lines, ...(sepD ? { separate: sepD } : {}),
      movement: { material: 'prestressed concrete', continuity: cont ? 'continuous' : 'simple', units, length: X[ns], fixity: null },
      notes };
    const g2 = l => l.girders.map(g => `${g.label} ${f2(g.service.Pdl)}/${g.service.Pll == null ? '—' : f2(g.service.Pll)}`).join(', ');
    return { ok: true, payload, sum: lines.map(l => `  ${SB.lineName(l)}: ${g2(l)}`).join('\n') };
  }

  W.PSBBearing = { PRODUCER, FILE, ID, llEnds, blPayload };
})();
