/* apps/ps-bridge/engine/handoffs.js — the cross-tool hand-off payloads of the PS Bridge app (window.PSBHandoffs). Classic script, no DOM,
   no storage: the page (ui/handoffs.js) reads and writes the keys; this file builds and reads the payloads, so Node tests can check them.
   Created 2026-11-14 (docs/ps-bridge-plan.md hand-offs, planned item 12: "the same bridgeSuite.v1.* hand-offs as the old app").

   Every payload is the old app's ("Prestressed Bridge Design.html", frozen at the pin of tests/engine/psbridge-source.mjs), built by the
   same expressions from the same engine inputs and results, so a receiving tool cannot tell the two apps apart (CLAUDE.md §5: no key,
   schema or field changed). inp: the engine inputs of the girder type and line shown on the output tabs (engine/design.js inputs(P));
   R: the engine result of those inputs (computeAll; on the page PSBHoldDown.compute, whose additions none of these payloads reads).
   now: the producedAt timestamp (the page passes new Date().toISOString(); tests a fixed text).

     srPayload(inp, R)        superReactions (HANDOFF.md §4.4, bridge-super-reactions): the moved engine's own bxSuperRxPayload (engine/
                              pbd-external.js, verbatim) → { payload } | { error }. The page stamps it with the old app's producer
                              'PS-Beam' and the copy key superReactions.by.psbeam, as the old app's BXSuperRx.send.
     psSection(inp, R, now)   psSection (AUDIT.md §1.3, bridge-ps-section; read by the MCT generator and LL & DL): port of the old app's
                              standing publisher (anchor `const cp=R.cp, g=R.g;`), the same core fields, order and rounding. null when
                              the design has an error (the old app published nothing then).
     capacity(inp, R, now, ce) capacity (AUDIT.md §1.3, bridge-design-capacity; read by the MCT rating): port of the old app's
                              publishCapacity (anchor `const publishCapacity=(silent)=>{`) → { payload, warns, spans } | { error }.
                              ce: the engine's computeAll (used only for an imported MIDAS member, as the old app).
     lldfGeom(inp, R, now)    lldfGeom (HANDOFF.md §4.2, bridge-lldf-geometry; read by LL & DL): port of the old app's sendLLDF (anchor
                              `const sendLLDF=(silent)=>{`) → { payload } | { error }.
     lldfResolve(inp, raw, db) the lldf channel (HANDOFF.md §4.3) as the old app reads it: port of lldfResolveFor (anchor
                              `function lldfResolveFor(inp){`) with the stored text raw and the design beam db ({ index, label, clsLabel }
                              or null) passed in → the same object, or { why }.
     lldfTheirs(inp, r)       port of lldfTheirsFor: the input fields and values the pull writes.
     dlResolve(raw)           the dlLoads channel as the old app reads it: port of dlResolveFor → the same object, or { why }.
     dlTheirs(r)              port of dlTheirsFor.
     pmFields(P), pmPlan(P, payload), PM   projectMeta (HANDOFF.md §4.1): the shared fields of this app's title block (projectName → Name,
                              jobNo → Number, client → Client name, preparedBy → Designer, checkedBy → Checker, date → Date; bridgeId and
                              location: no such field here, sent blank as the old app's BXProject.share) and what "Use shared project
                              info" would change (the old app's BXProject.use rule: never blank a field, only the fields that differ).
     srAll(P, cells), sgPayload(P, cells), secDims(g)   batch F (2026-11-15): Bridge Substructure Loading in the Steel Bridge app's
                              formats: superReactions of every girder line (allGirders, HANDOFF.md §4.4) from each cell's srPayload,
                              summed at the piers; superGeometry (§4.14) from the inputs and each girder type's section.
     dbState(P, get)          batch F3: the shared design beam and its roster (the old app's chip), read only.
   No engineering value is computed here beyond what the old app's code computed for the same payload (batch F: the sum of the two spans'
   end reactions at a pier, and the largest of the section dimensions). */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const PRODUCER = 'PS-Beam', SR_ID = 'psbeam', RX = 'psbridge';

  /* ---- superReactions: the moved engine's function (verbatim slice of the old page) ---- */
  function srPayload(inp, R) {
    if (typeof W.bxSuperRxPayload !== 'function') return { error: 'the engine is not loaded' };
    const b = W.bxSuperRxPayload(inp, R);
    // SRP (2026-11-23): the pedestrian and utility reactions of the line as separate OPTIONAL items (srParts below); a girder with none
    // (every project saved before PL-A / UT-N): the old app's payload, byte for byte
    const q = b && b.payload ? srParts(inp, R) : null;
    if (q) { const p = b.payload;
      p.supports.forEach((s, k) => { const o = sepAt(q, k); if (o) s.girders[0].separate = o; });
      const any = Object.keys(q.has).length > 0; if (any) p.separate = sepInfo(q.has);
      p.notes = p.notes.concat(sepNotes(q, any ? [`${p.girderLine.label}: ${sepTxt(q)}`] : [])); }
    return b;
  }

  /* ---- SRP (2026-11-23, engineer-approved): the pedestrian reaction and the utility reactions sent as SEPARATE OPTIONAL items of
     superReactions (HANDOFF.md §4.4 "Separate items"), so that the receiver can factor each by its own load type ----
     WHAT THE EXISTING FIELDS HOLD (unchanged, CLAUDE.md §5): DC1 = everything on the non-composite girder, which since UT-N includes the
     utilities on the noncomposite section (UTN) and the future utility allowance (UF) (both in w_NC); DW = the line's DW, which since
     PL-A includes the utilities on the composite section (UT); the pedestrian load is in no field (liveLoad is the HL-93 lane value or
     null). The new items therefore say where each is: girders[].separate = { UT, UF (kip, ALREADY INSIDE DC1), UTc (kip, ALREADY INSIDE
     DW), PL, PLmin (kip, in NO other field) }, only the keys the girder has, and the top-level separate = sepInfo() describes each
     (includedIn, treatAs, the load factors this app uses). A receiver that does not read them is unaffected and counts nothing twice.
     srParts(inp, R) -> null | { has: { PL, UT, UF, UTc }, L, w: { PL, UT, UF, UTc } (klf), PL: [left, right], PLmin, UT, UF, UTc (kip, + up,
     the two ends of the span), plBasis, plExt, utcExt }:
       UT, UF   w L / 2 at each end (on the simple non-composite span, as DC1; inputs.ut, engine/ut.js);
       UTc      as DW: w L / 2, or with continuity the end shears of the span on the continuous unit, w V_w(0) and −w V_w(L) (R.fe);
                with imported demands the DW reactions are the file's, which this app does not add the utility to: not sent;
       PL       the pedestrian live load w_PL (inputs.pl, engine/pl.js; no DF, no IM, unfactored): simple span w L / 2 (PLmin 0); with
                continuity the + and − areas of the end-shear influence lines of the span (PSBPL.areas: the engine's lane rows / 0.64):
                left end w A+ / w A−, right end −w A− / −w A+ (max / min, + up); with imported demands PL is not computed here (the imported
                live load is assumed to include it, IMP-N): not sent. */
  const UTF = { strMax: 1.50, strMin: 0.65, service: 1.0 };
  function srParts(inp, R) {
    if (!inp || !R || R.error) return null;
    const L = +R.L, ext = !!(R.useExt && inp.external), fe = !ext && R.fe && R.fe.Vw ? R.fe : null;
    const wPL = inp.pl && +inp.pl.w > 0 ? +inp.pl.w : 0, u = inp.ut || {}, wUT = isN(+u.wUT) ? +u.wUT : 0, wUF = isN(+u.wUF) ? +u.wUF : 0, wUTc = isN(+inp.utc) ? +inp.utc : 0;
    if (!(L > 0) || (!wPL && !wUT && !wUF && !wUTc)) return null;
    const half = w => [w * L / 2, w * L / 2];
    const q = { L, w: { PL: wPL, UT: wUT, UF: wUF, UTc: wUTc }, has: {}, plExt: ext && wPL > 0, utcExt: ext && wUTc !== 0 };
    if (wUT) { q.UT = half(wUT); q.has.UT = true; }
    if (wUF) { q.UF = half(wUF); q.has.UF = true; }
    if (wUTc && !ext) { q.UTc = fe ? [wUTc * fe.Vw(0), -wUTc * fe.Vw(L)] : half(wUTc); q.has.UTc = true; }
    if (wPL && !ext) {
      if (fe && W.PSBPL && W.PSBPL.areas && W.PBD && W.PBD.contFE) { const E = endAreas(fe.spans, fe.s), a = E[0], z = E[1];
        q.PL = [wPL * a.Vp, -wPL * z.Vn]; q.PLmin = [wPL * a.Vn, -wPL * z.Vp]; q.plBasis = 'cont'; }
      else { q.PL = half(wPL); q.PLmin = [0, 0]; q.plBasis = 'simple'; }
      q.has.PL = true;
    }
    q.anyPlExt = q.plExt; q.anyUtcExt = q.utcExt;
    return q.has.PL || q.has.UT || q.has.UF || q.has.UTc || q.plExt || q.utcExt ? q : null;
  }
  /* endAreas(spans, s): the + and − areas (ft) of the shear influence lines at the two ends of span s of the continuous unit: the engine's
     own analysis of that span (PBD.contFE, as computeAll runs it; R.fe keeps only its summary) read by engine/pl.js areas(); kept per unit */
  const EA = new Map();
  function endAreas(spans, s) { const k = spans.join(',') + '|' + s; if (!EA.has(k)) { const N = W.PSBPL.areas(W.PBD.contFE(spans, s)); EA.set(k, [N[0], N[N.length - 1]]); if (EA.size > 40) EA.delete(EA.keys().next().value); } return EA.get(k); }
  const SEPK = ['PL', 'PLmin', 'UT', 'UF', 'UTc'];
  /* sepAt(q, k): girders[].separate of end k (0 left, 1 right) of one line, or null */
  function sepAt(q, k) { const o = {}; SEPK.forEach(f => { if (q[f]) o[f] = r3(q[f][k]); }); return Object.keys(o).length ? o : null; }
  /* sepInfo(has): the top-level descriptor of the separate items that the payload carries */
  function sepInfo(has) {
    const o = { note: 'Optional separate items under supports[].girders[].separate (kip, unfactored, + up). includedIn names the existing field that ALREADY contains the item (carry it on its own only after taking it out of that field); includedIn null: the item is in no other field.' };
    if (has.PL) o.pedestrian = { field: 'PL', fieldMin: 'PLmin', includedIn: null, loadType: 'PL', cite: 'AASHTO LRFD 10th Ed. 3.6.1.6', imIncluded: false, dfIncluded: false, basis: 'pedestrian live load of the sidewalks, the girder line\'s share; no dynamic load allowance, no distribution factor' };
    if (has.UT || has.UF || has.UTc) { o.utilities = { cite: 'AASHTO LRFD 10th Ed. 3.5.1, Tables 3.4.1-1, 3.4.1-2; the noncomposite stage and the future allowance as the Steel Bridge app (MassDOT LRFD Bridge Manual Part I 3.5.5.2, 3.5.5.4)',
      existing: has.UT ? Object.assign({ field: 'UT', includedIn: 'DC1', section: 'noncomposite (precast girder)', treatAs: 'DW' }, UTF) : null,
      future: has.UF ? { field: 'UF', includedIn: 'DC1', section: 'noncomposite (precast girder)', treatAs: 'DC', strMax: 1.25, strMin: 0, service: 1.0, serviceRelieving: 0 } : null,
      composite: has.UTc ? Object.assign({ field: 'UTc', includedIn: 'DW', section: 'composite', treatAs: 'DW' }, UTF) : null }; }
    return o;
  }
  const sepTxt = q => SEPK.filter(f => q[f]).map(f => `${f} ${f3(q[f][0])} / ${f3(q[f][1])}`).join(', ') + ' (left / right end)';
  /* sepNotes(q, rows): the notes of the separate items (q: any line's parts with the bridge's has; rows: the values in words) */
  function sepNotes(q, rows) {
    const has = q.has, n = [];
    if (has.PL || has.UT || has.UF || has.UTc) n.push('Separate items (optional fields girders[].separate; unfactored, kip, + up; described in the top-level "separate"): the totals DC1, DC2 and DW are unchanged and still contain the utilities, so a receiver that carries a utility on its own takes it out of the field named below first (no double count).'
      + (has.UT ? ' UT = utilities on the noncomposite section: ALREADY INSIDE DC1; this app factors them as DW (Strength 1.50 where they add, 0.65 where they relieve; Service 1.0).' : '')
      + (has.UF ? ' UF = future utility allowance (noncomposite): ALREADY INSIDE DC1; this app takes it present (Strength 1.25, Service 1.0) or absent (0), whichever governs.' : '')
      + (has.UTc ? ' UTc = utilities on the composite section: ALREADY INSIDE DW (DW factors).' : '')
      + (has.PL ? ' PL = pedestrian live load reaction (AASHTO LRFD 10th Ed. 3.6.1.6; no IM, no distribution factor), max (PLmin: the uplift part, 0 on a simple span): in NO other field; a live load (it takes the live-load factor).' : ''));
    if (rows && rows.length) n.push('Separate items, kip: ' + rows.join('; ') + '.');
    if (q.anyPlExt) n.push('Pedestrian load: a girder type on imported demands does not get a PL item (the imported live load is assumed to include the pedestrian load; this app does not compute it there).');
    if (q.anyUtcExt) n.push('Utilities on the composite section: a girder type on imported demands does not get a UTc item (its DW reactions are the imported ones, which this app does not add the utility to).');
    return n;
  }

  /* ---- psSection: the old app's standing publisher (its useEffect), the payload part ---- */
  function psSection(inp, R, now) {
    if (!R || R.error || !R.cp || !R.g) return null;
    const cp = R.cp, g = R.g;
    const wj = W.weakAxisAndJ(g);
    const core = { project: (inp.proj && inp.proj.name) || '', memberKey: (inp.proj && inp.proj.girderId) || '',
      fc: +inp.mat.fc, Ecg: +cp.Ecg,
      Ag: +g.A, Ig: +g.I, ybg: +g.yb, hg: +g.h,
      Ac: +cp.Ac, Ic: +cp.Ic, ybc: +cp.ybc, ytc: +cp.ytc, hc: +cp.hc,
      Iweak: +wj.Iweak, J: +wj.J,
      wsw: +g.wsw, wdk: +cp.wdk,
      eg: +((+g.h + (+inp.th) + (+inp.ts) / 2) - g.yb).toFixed(2),
      n: +(cp.Ecg / Math.max(+cp.Ecd || 0, 1e-6)).toFixed(3),
      boxB: Math.round(+g.w || +g.btf || 0), isBoxLike: !!(g.isBox || g.isDeck),
      shape: W.shapePayload(inp, g, cp) };
    return Object.assign({ _schema: 'bridge-ps-section', schemaVersion: 1, producer: 'PS-Beam',
      producedAt: now, units: { length: 'in', area: 'in2', inertia: 'in4', modulus: 'ksi' },
      note: 'Composite section transformed to girder concrete; Ecg pairs with Ic. Strong-axis (Ix)=Ic. J & weak-axis I not computed (line-girder model).' }, core);
  }

  /* ---- capacity: the old app's publishCapacity, the payload part (no storage, no message) ---- */
  function capacity(inp, R, now, ce) {
    try {
      if (R.error) return { error: 'Fix the inputs first — the compute engine reported: ' + R.error };
      const computeAll = ce || W.computeAll, externalSpans = W.externalSpans;
      const ext = inp.external;
      const extOk = !!(ext && Array.isArray(ext.stations) && ext.stations.length);
      const spansAll = extOk ? externalSpans(ext) : [{ idx: 1, x0: 0, x1: +inp.L, len: +inp.L }];
      const stationsOut = [], warns = [];
      spansAll.forEach(sp => {
        const R2 = extOk ? computeAll(Object.assign({}, inp, { external: Object.assign({}, ext, { _selSpan: sp }), L: sp.len })) : R;
        if (R2.error) { warns.push('Span ' + sp.idx + ' could not be evaluated: ' + R2.error); return; }
        const phiMnNeg = (R2.cont && R2.cont.phiMnN) ? -R2.cont.phiMnN / 12 : 0;
        if (!phiMnNeg && spansAll.length > 1) warns.push('Span ' + sp.idx + ': continuity is off — −φMn published as 0. Turn on continuity (Inputs) for the pier capacity.');
        const vAt = (x) => { const d = R2.shearDiag || []; if (!d.length) return 0;
          if (x <= d[0].x) return d[0].phiVn; if (x >= d[d.length - 1].x) return d[d.length - 1].phiVn;
          for (let i = 0; i < d.length - 1; i++) { if (x >= d[i].x && x <= d[i + 1].x) { const t = (x - d[i].x) / Math.max(d[i + 1].x - d[i].x, 1e-9);
            return d[i].phiVn + (d[i + 1].phiVn - d[i].phiVn) * t; } } return d[d.length - 1].phiVn; };
        (R2.flexFull || []).forEach(fr => {
          stationsOut.push({ x: +(sp.x0 + fr.x).toFixed(3), span: sp.idx,
            phiMn_pos: +(fr.phiMn / 12).toFixed(1), phiMn_neg: +phiMnNeg.toFixed(1),
            phiVn: +vAt(fr.x).toFixed(1),
            Sx_pos: 0, Sx_neg: 0,
            phi: +fr.phi.toFixed(3), basis: 'approx-fps' });
        });
      });
      if (!stationsOut.length) return { error: 'No capacity stations could be computed.' };
      const supports = extOk && ext.member ? ext.member.supports : [0, +inp.L];
      const payload = { _schema: 'bridge-design-capacity', schemaVersion: 1,
        producer: 'PS-Beam', producedAt: now,
        project: inp.proj.name || '', memberKey: inp.proj.girderId || '',
        units: { force: 'kip', length: 'ft', moment: 'ft-kip' },
        phiIncluded: true, phiFlex: 'per-station: 0.75–1.0 from the net tensile strain εt (Art. 5.5.4.2), with c from the approximate fps method (Art. 5.6.3.1.1)', phiShear: 0.9,
        member: { supports, spans: spansAll.map(s => s.len), totalLength: supports[supports.length - 1] },
        designSpanIdx: (R.useExt && R.ext && R.ext.sel) ? R.ext.sel.idx : 1,
        basis: CAP_BASIS,
        psService: { Sb_comp: (R.cp && R.cp.Sbc) ? +R.cp.Sbc.toFixed(0) : null, fpe: R.fpe ? +R.fpe.toFixed(1) : null, fc: +inp.mat.fc,
          note: 'For a future PS Service III stress rating in MCT — not used by the strength rating.' },
        stationCount: stationsOut.length, stations: stationsOut, warnings: warns };
      return { payload, warns, spans: spansAll.length };
    } catch (e) { return { error: 'Capacity publish failed: ' + (e && e.message || e) }; }
  }
  // the old app's basis text, verbatim (publishCapacity, the payload's basis field)
  const CAP_BASIS = 'AASHTO LRFD 10th Ed. — φMn per 5.6.3.2 with fps by the approximate Eq. 5.6.3.1.1-1 (c by Eq. 5.6.3.1.1-3 flanged / 5.6.3.1.1-4 rectangular; not a strain-compatibility analysis), strand force limited by development along the transfer/development length (5.9.4.3.2); φ per 5.5.4.2 from the net tensile strain; φVn per 5.7.3 MCFT general procedure with trial stirrups; −φMn = deck-reinforced continuity section at the pier (constant).';

  /* ---- lldfGeom: the old app's sendLLDF, the payload part (no storage, no navigation) ---- */
  function lldfGeom(inp, R, now) {
    try {
      const g = R && !R.error ? R.g : null, ext = inp.external;
      const gg = g || W.girderGross(inp);
      const Ecg = W.Ec(inp.mat.fc, inp.mat.wc), Ecd = W.Ec(inp.mat.fcd, inp.mat.wcd);
      const nEI = Ecg / Math.max(Ecd, 1e-6);
      const egv = (gg.h + (+inp.th) + (+inp.ts) / 2) - gg.yb;
      const Nb = Math.max(2, Math.round(+inp.nGirders || 4));
      const spansOut = (ext && ext.member && Array.isArray(ext.member.spans) && ext.member.spans.length) ? ext.member.spans.map(Number) : [+inp.L];
      const rawG = (typeof GIRDERS !== 'undefined' && GIRDERS[inp.girder]) || {};   // the moved engine's library (a top-level const of engine/pbd-library.js, not a window property)
      const typ = rawG.box ? 'g' : rawG.next ? 'e' : rawG.deck ? 'g' : 'k';
      const isBoxLike = !!(rawG.box || rawG.deck);
      const IcComp = (R && R.cp && isFinite(R.cp.Ic) && R.cp.Ic > 0) ? Math.round(R.cp.Ic) : Math.round(gg.I);
      const wj = (typeof W.weakAxisAndJ === 'function') ? W.weakAxisAndJ(gg) : null;
      const boxW = Math.round(+gg.w || +gg.btf || 0);
      const boxProps = isBoxLike ? {
        boxB: boxW > 0 ? boxW : undefined,
        boxI: IcComp,
        boxJ: (wj && isFinite(wj.J) && wj.J > 0) ? Math.round(wj.J) : undefined,
        boxIsComposite: true
      } : {};
      const payload = { _schema: 'bridge-lldf-geometry', schemaVersion: 1, producer: 'PS-Beam',
        producedAt: now, project: inp.proj.name || '',
        position: inp.loads.pos || 'interior', memberLabel: inp.proj.girderId || '',
        Nb, de: (inp.loads.de != null ? +inp.loads.de : null),
        inputs: Object.assign({ type: typ, spans: spansOut, spacings: Array(Math.max(1, Nb - 1)).fill(+inp.S),
          ts: +inp.ts, skew: +inp.loads.skew || 0, depth: +gg.h || undefined,
          I: Math.round(gg.I), A: Math.round(gg.A), eg: +egv.toFixed(2), n: +nEI.toFixed(3) },
          boxProps) };
      return { payload };
    } catch (e) { return { error: 'Could not send geometry: ' + (e && e.message || e) }; }
  }

  /* ---- lldf (receive): the old app's lldfResolveFor / lldfTheirsFor ---- */
  const extActiveOf = inp => { const e = inp && inp.external; return !!(e && e._schema === 'psbeam-external-demands'); };
  function lldfResolve(inp, raw, dbeam) {
    if (!raw) return { why: 'No distribution-factor results found.\n\nOpen the LL & DL Distribution app, compute the factors, and click "Send DFs to Design Apps" — then pull here.' };
    let d; try { d = JSON.parse(raw); } catch (e) { return { why: 'Could not read LLDF data: ' + (e && e.message || e) }; }
    if ((d.schemaVersion || 1) > 1) return { why: 'LL & DL Distribution data is v' + d.schemaVersion + '; this app supports v1. Update PS-Beam.' };
    if (d.perFootStrip === true) return { why: 'The published distribution factors are for a cast-in-place slab: they are per 1-ft strip of slab width (AASHTO LRFD 4.6.2.3), not per girder. PS-Beam needs girder factors, so nothing was applied.\n\nRecompute in LL & DL Distribution with the girder cross-section type, then send again.' };
    const want = (inp.loads.pos === 'exterior') ? 'exterior' : 'interior';
    const bkey = dbeam ? String(dbeam.index) : null;
    const byB = d.governing && d.governing.byBeam, byBn = d.governingNeg && d.governingNeg.byBeam;
    const perBeam = !!(bkey && byB && byB[bkey] && byB[bkey].gM != null);
    const src = perBeam ? (dbeam.label + ' — ' + (dbeam.clsLabel || want)) : ('governing ' + want + ' girder');
    const gov = perBeam ? byB[bkey] : (d.governing && d.governing[want]);
    if (!gov || gov.gM == null) return { why: 'The published LLDF results have no ' + want + '-girder values.' };
    const govN = perBeam ? (byBn && byBn[bkey]) : (d.governingNeg && d.governingNeg[want]);
    const gMpos = +(+gov.gM).toFixed(4);
    const gMneg = (govN && govN.gM != null) ? +(+govN.gM).toFixed(4) : gMpos;
    const gV = +(+gov.gV).toFixed(4);
    const fatM = (gov.fatM != null) ? +(+gov.fatM).toFixed(4) : 0;
    return { d, src, gMpos, gMneg, gV, fatM, hasNeg: !!govN, at: d.producedAt || '', project: d.project || '' };
  }
  function lldfTheirs(inp, r) {
    return extActiveOf(inp)
      ? { extDFpos: r.gMpos, extDFneg: r.gMneg, extDFv: r.gV, extLLmpf: 1.0, fatM: r.fatM }
      : { dfm: r.gMpos, dfv: r.gV, fatM: r.fatM };
  }
  /* lldfFields(inp, r): the loads fields the old app's applyLLDFTo writes (the same two shapes) */
  function lldfFields(inp, r) {
    const t = lldfTheirs(inp, r);
    return extActiveOf(inp) ? { extDFpos: t.extDFpos, extDFneg: t.extDFneg, extDFv: t.extDFv, extLLmpf: t.extLLmpf, fatM: t.fatM }
      : { llAuto: true, dfAuto: false, dfm: t.dfm, dfv: t.dfv, fatM: t.fatM };
  }

  /* ---- dlLoads (receive): the old app's dlResolveFor / dlTheirsFor ---- */
  function dlResolve(raw) {
    if (!raw) return { why: 'No dead-load distribution found.\n\nOpen the LL & DL Distribution app, run the dead-load distribution, and click "Send DL to MCT Loads" — then pull here.' };
    let d; try { d = JSON.parse(raw); } catch (e) { return { why: 'Could not read dead-load data: ' + (e && e.message || e) }; }
    if ((d.schemaVersion || 1) > 1) return { why: 'LL & DL dead-load data is v' + d.schemaVersion + '; this app supports v1. Update PS-Beam.' };
    const by = {}; (d.cases || []).forEach(function (c) { by[c.key] = +c.udl || 0; });
    if (by.DC2 == null && by.DW == null) return { why: 'The published dead-load cases contain no DC2 or DW.' };
    const b = d.beam || {};
    const src = b.label ? (b.label + (b.clsLabel ? (' — ' + b.clsLabel) : '')) : 'LL & DL Distribution';
    return { d, src: src, hasBar: by.DC2 != null, hasDW: by.DW != null,
      cases: (d.cases || []), Nb: +d.Nb || 0, method: d.method || '', selfWeightNote: d.selfWeightNote || '',
      wBar: +(+(by.DC2 || 0)).toFixed(4), wDW: +(+(by.DW || 0)).toFixed(4),
      dc1: +(+(by.DC1 || 0)).toFixed(4), pl: +(+(by.PL || 0)).toFixed(4),
      selfWt: +d.selfWt || 0, trib: +b.trib || 0, at: d.producedAt || '', project: d.project || '' };
  }
  function dlTheirs(r) { const o = {}; if (r.hasBar) o.wBar = r.wBar; if (r.hasDW) o.wDW = r.wDW; return o; }

  /* ---- applying a pull to the project ----
     applyLoads(P, cell, fields): the loads fields of a pull written to the girder type shown (cell = { k } of PSBBridge.shown: its
     overrides, as an edit of that type on the Girders & strands / Loads tabs, PSBBridge.setOvr), or to the base design when the project
     has no girder types. P is changed in place. dlBlocked(P, g): true when the project distributes DC2 and DW to the girder lines itself
     (Cross-section tab, engine/bridge-dl.js line(P, g) not null): the entered DC2 / DW a pull writes would not be used. */
  function applyLoads(P, cell, fields) {
    const BR = W.PSBBridge;
    if (cell && BR && BR.hasTypes(P)) { const eff = BR.effBase(P, cell.k); eff.loads = Object.assign({}, eff.loads, fields); BR.setOvr(P, cell.k, eff); }
    else P.base.loads = Object.assign({}, P.base.loads, fields);
    return P;
  }
  function dlBlocked(P, g) { const DL = W.PSBBridgeDL; return !!(DL && DL.line(P, g)); }

  /* ---- projectMeta ---- */
  const PM = { projectName: 'name', bridgeId: null, jobNo: 'number', client: 'owner', location: null, preparedBy: 'designer', checkedBy: 'checker', date: 'date' };
  const PM_LABELS = { projectName: 'Project name', bridgeId: 'Bridge ID', jobNo: 'Number', client: 'Client name', location: 'Location', preparedBy: 'Designer', checkedBy: 'Checker', date: 'Date' };
  const str = v => v == null ? '' : String(v);
  function pmFields(P) { const f = {}, pr = (P && P.project) || {}; Object.keys(PM).forEach(k => { f[k] = PM[k] ? str(pr[PM[k]]) : ''; }); return f; }
  /* pmPlan(P, payload): { upd: { <project field>: value }, lines: ['Name: "a" → "b"', …] }: the shared values that are not blank and differ */
  function pmPlan(P, payload) {
    const f = (payload && payload.fields) || {}, pr = (P && P.project) || {}, upd = {}, lines = [];
    Object.keys(PM).forEach(k => { if (!PM[k]) return; const v = str(f[k]); if (!v.trim()) return; const c = str(pr[PM[k]]); if (v === c) return;
      upd[PM[k]] = v; lines.push('  ' + PM_LABELS[k] + ': "' + (c || '(blank)') + '" → "' + v + '"'); });
    return { upd, lines };
  }

  /* ---- MCT demands (batch D3, 2026-11-15): the old app's receiver of the MCT Generator's hand-off (its checkHandoff / adoptHandoff,
     "Prestressed Bridge Design.html" O:9211-9290, and BridgeHandoff, O:592-660), read here from the stored texts the page passes in.
     Keys (the old app's, unchanged; HANDOFF.md, AUDIT.md §1.3): bridgeSuite.v1.handoffs (map id → payload, schema psbeam-external-demands),
     bridgeSuite.v1.latestId, bridgeSuite.v1.updatedAt; this app's adoption marker bridgeSuite.v1.adopted.psbridge (the old app's own,
     .adopted.psbeam, is not read or written: the old app keeps its own banner). Load is by click only: the old app's lock (auto-adopt,
     BridgeLocks 'demands') is not here (engineer decision HO-D2 pending). ---- */
  const MCT_VERSION = 1;   // the old app's HANDOFF_SUPPORTED_VERSION
  const MCT_K = { map: 'bridgeSuite.v1.handoffs', latest: 'bridgeSuite.v1.latestId', updated: 'bridgeSuite.v1.updatedAt', adopted: 'bridgeSuite.v1.adopted.' + RX,
    geom: 'bridgeSuite.v1.geometryChanges', geomAt: 'bridgeSuite.v1.geometryChanges.updatedAt', geomAdopted: 'bridgeSuite.v1.geometryChanges.adopted.' + RX };
  const verOf = p => (p && p.schemaVersion != null) ? p.schemaVersion : ((p && p._version != null) ? p._version : 1);   // BridgeHandoff verOf
  const tokenOf = p => p ? ((p.handoffId || '') + '@' + (p.producedAt || '')) : '';                                    // BridgeHandoff tokenOf
  /* mctPending(get): the hand-off waiting for this app, or null (none, unreadable, or already adopted / dismissed here): the old app's
     checkHandoff with BridgeHandoff.readOne(latestId()). get(key) returns the stored text. → { id, version, token, payload, supported } */
  function mctPending(get) {
    const id = get(MCT_K.latest); if (!id) return null;
    let map; try { map = JSON.parse(get(MCT_K.map) || '{}') || {}; } catch (e) { return null; }
    const p = map[id]; if (!p || typeof p !== 'object') return null;
    const r = { id, version: verOf(p), token: tokenOf(p), payload: p };
    if (get(MCT_K.adopted) === r.token) return null;
    r.supported = r.version <= MCT_VERSION;
    return r;
  }
  /* mctDescribe(p): the banner's text parts (the old app's: producer, project, member key, stations, LL type) */
  function mctDescribe(p) {
    return { producer: (p && p.producer) || 'MCT Generator', project: (p && p.project) || '', member: (p && p.member && p.member.key) || '',
      n: (p && Array.isArray(p.stations)) ? p.stations.length : 0, ll: (p && p.liveLoadType) || 'HL-93' };
  }
  /* mctPlan(P, T, payload): what Load changes for girder type T (the old app's adoptHandoff for one design): the demands of T = the payload
     (engine/demands.js setFile; a payload the file reader refuses is refused here too), the span of the member used = T's span when the
     member has it (the old app took span 1 of a new member; here each type keeps its own span), and the bridge questions the page asks:
     spans (the member's lengths when the count is the bridge's and they differ: the old app set L to the span) and continuity (a continuous
     member on a bridge of simple spans: the old app turned its continuity on). → { ok, error | file, spans, setSpans, makeCont, lines } */
  function mctPlan(P, T, payload) {
    const DM = W.PSBDemands; if (!DM) return { ok: false, error: 'the demand module is not loaded' };
    const r = DM.parse(JSON.stringify(payload), 'the MCT hand-off'); if (!r.ok) return { ok: false, error: r.error };
    const own = ((P.spans && P.spans.lengths) || []).map(Number), fl = r.spans.map(q => +q.len), m = payload.member || {};
    const continuous = (Array.isArray(m.spans) && m.spans.length > 1) || (Array.isArray(m.supports) && m.supports.length > 2) || r.spans.length > 1;   // the old app's rule
    const setSpans = fl.length === own.length && fl.some((v, j) => Math.abs(v - own[j]) > 0.005) ? fl : null;
    const makeCont = continuous && own.length >= 2 && P.spans.continuity !== 'composite';
    const lines = [`${T.label}: demands from the MCT hand-off (${r.file.stations.length} stations, ${fl.length} span${fl.length > 1 ? 's' : ''} ${fl.map(v => v.toFixed(2)).join(', ')} ft)${T.span <= fl.length ? `, span ${T.span} of the member` : ''}.`].concat(r.notes);
    return { ok: true, file: r.file, spans: r.spans, setSpans, makeCont, continuous, lines };
  }
  /* geomPending(get): the MCT geometry-change record waiting for this app, or null (the old app's checkGeometryChanges, O:9291-9318:
     BridgeGeometryChanges.readGeometryChanges against .adopted.<app>) → { producedAt, producer, changes: [{ field, detail, oldVal, newVal }] } */
  function geomPending(get) {
    let g; try { g = JSON.parse(get(MCT_K.geom) || 'null'); } catch (e) { return null; }
    if (!g || typeof g !== 'object' || !Array.isArray(g.changes)) return null;
    if (get(MCT_K.geomAdopted) === g.producedAt) return null;
    return g;
  }

  /* ---- batch F (2026-11-15): Bridge Substructure Loading, every girder line and the bridge geometry, in the Steel Bridge app's
     formats (apps/steel-bridge/ui/handoffs.js srPayload / sgPayload; HANDOFF.md §4.4 "Optional fields", §4.14). The old app's one-line
     superReactions payload (srPayload above) is unchanged and still sent by its own button.
     cells: PSBBridge.results(P, resOf).cells ([{ k, s, g, inp, R }], every girder type on every line; the page's cache of the engine). ---- */
  const r3 = v => Math.round(v * 1000) / 1000, r4 = v => Math.round(v * 1e4) / 1e4;
  const isN = v => typeof v === 'number' && isFinite(v);
  const f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);
  const FILE = 'apps/ps-bridge/index.html', GEO_ID = 'psbridge';
  const supId = (k, ns) => k === 0 ? 'Abut. 1' : k === ns ? 'Abut. 2' : 'Pier ' + k;
  /* srAll(P, cells): superReactions for every girder line G1 … G<nb> (allGirders: true), the Steel Bridge app's shape: each line's
     unfactored DC1, DC2 and DW at every support (kip, + up). Each span of a line is its girder type's engine run on that line (the cell),
     its two end reactions the engine's own bxSuperRxPayload (srPayload above: the Analysis tab's "Reactions (unfactored, kip)" of that type
     and line, the old app's numbers); at a pier the reaction is the sum of the end reactions of the two spans on it (one support point per
     support, as the Steel Bridge app sends; each span's share is listed in the notes). No other arithmetic. → { ok, payload, sum, shares }
     or { error } (a line with no type in a span, or a girder with an input error: nothing is sent). */
  function srAll(P, cells) {
    const spans = ((P && P.spans && P.spans.lengths) || []).map(Number), ns = spans.length, nb = Math.round(+(P && P.xs && P.xs.nb));
    if (!ns || !spans.every(v => isN(v) && v > 0)) return { error: 'Enter the span lengths (Bridge layout tab).' };
    if (!(nb >= 1)) return { error: 'Define the cross-section (number of girders, Cross-section tab).' };
    const at = {}; (cells || []).forEach(c => { if (!at[c.s + '.' + c.g]) at[c.s + '.' + c.g] = c; });
    const miss = [], bad = [];
    for (let s = 1; s <= ns; s++) for (let g = 1; g <= nb; g++) if (!at[s + '.' + g]) miss.push(`G${g}/S${s}`);
    if (miss.length) return { error: `Every girder line of every span needs a girder type (Girders & strands tab, Girder types): none on ${miss.join(', ')}.` };
    // sh[k][g-1]: the end reactions on support k of line g: [{ s, end: 'left' | 'right', DC1, DC2, DW, basis }]
    const sh = Array.from({ length: ns + 1 }, () => Array.from({ length: nb }, () => [])), pos = [], basis = {}, sepHas = {}, sepExt = {};
    for (let s = 1; s <= ns; s++) for (let g = 1; g <= nb; g++) {
      const c = at[s + '.' + g], b = srPayload(c.inp, c.R);
      if (!b || b.error || !b.payload) { bad.push(`G${g}, span ${s} (${c.label || 'type ' + (c.k + 1)}): ${(b && b.error) || 'no result'}`); continue; }
      const p = b.payload, q = p.supports; if (!Array.isArray(q) || q.length !== 2) { bad.push(`G${g}, span ${s}: not two end reactions`); continue; }
      if (s === 1 || pos[g - 1] == null) pos[g - 1] = p.girderLine.position;
      basis[p.girderLine.source] = (basis[p.girderLine.source] || []).concat([`G${g}/S${s}`]);
      [[s - 1, 'left', q[0]], [s, 'right', q[1]]].forEach(([k, end, r]) => { const x = r.girders[0]; sh[k][g - 1].push({ s, end, DC1: x.DC1, DC2: x.DC2, DW: x.DW, sep: x.separate || null }); });
      // SRP: the line's separate items (srParts), summed at a pier as DC1 / DC2 / DW are
      const pq = srParts(c.inp, c.R); if (pq) { Object.keys(pq.has).forEach(f => { sepHas[f] = true; }); if (pq.plExt) sepExt.pl = true; if (pq.utcExt) sepExt.utc = true; }
    }
    if (bad.length) return { error: `The reactions cannot be built: ${bad.join('; ')}. Fix the inputs first.` };
    const X = [0]; spans.forEach(v => X.push(r3(X[X.length - 1] + v)));
    const sum = (a, f) => r3(a.reduce((t, x) => t + x[f], 0));
    // SRP: girders[].separate of a support = the sum of the spans' end values (only the keys a span of the line has; none: no field)
    const sepSum = a => { const o = {}; SEPK.forEach(f => { if (a.some(x => x.sep && x.sep[f] != null)) o[f] = r3(a.reduce((t, x) => t + ((x.sep && x.sep[f]) || 0), 0)); }); return Object.keys(o).length ? { separate: o } : {}; };
    const supports = X.map((x, k) => ({ id: supId(k, ns), x, girders: sh[k].map((a, i) => ({ label: 'G' + (i + 1), position: pos[i] || (i === 0 || i === nb - 1 ? 'exterior' : 'interior'),
      DC1: sum(a, 'DC1'), DC2: sum(a, 'DC2'), DW: sum(a, 'DW'), ...sepSum(a) })) }));
    const cont = !!(P.spans && P.spans.continuity === 'composite') && ns > 1;
    const piers = []; for (let k = 1; k < ns; k++) piers.push(k);
    const shareTxt = k => `${supId(k, ns)} (span ${k} right end + span ${k + 1} left end), DC1 / DC2 / DW kip: ` + sh[k].map((a, i) => {
      const L = a.find(x => x.end === 'right'), R = a.find(x => x.end === 'left');
      return `G${i + 1} ${f3(L.DC1)} + ${f3(R.DC1)}, ${f3(L.DC2)} + ${f3(R.DC2)}, ${f3(L.DW)} + ${f3(R.DW)}`; }).join('; ');
    const notes = [
      `Whole bridge: every girder line (G1 to G${nb}) of every span from this app (PS Bridge, apps/ps-bridge): each span of a line is the girder type on that line, its own engine run; its two end reactions are the ones the Analysis tab shows for that type and line ("Reactions (unfactored, kip)"; the old app's bxSuperRxPayload). Each girder is labelled by its line number, left to right.`,
      'Unfactored, kip, + up. DC1 = girder self-weight + deck / haunch and other non-composite DC + diaphragm point loads, on the simple non-composite span (R = wL/2 for each uniform load, the diaphragms by statics). DC2 = barrier / SIDL. DW = wearing surface.',
      cont ? `Continuity for composite loads on (spans ${spans.map(f2).join(', ')} ft): DC2 and DW are each span's end shears on the continuous unit, as reactions (+ up); DC1 is on the simple span.` : `Simple spans (${spans.map(f2).join(', ')} ft): R = wL/2 for each uniform load at each end of each span.`,
      ...Object.keys(basis).filter(k => /MIDAS/.test(k)).map(k => `${basis[k].join(', ')}: DC2 and DW are the imported MIDAS shears at the two ends of the span used (the girder type's demands file), sign-corrected to reactions (+ up).`),
      ...(piers.length ? [`At a pier the reaction is the sum of the end reactions of the two spans on it (one support point per pier, as the Steel Bridge app sends).${cont ? '' : ' Simple spans: split it between the back and ahead bearing rows by hand where needed, with the shares below.'}`].concat(piers.map(shareTxt)) : []),
      'Live load is not sent (liveLoad null): Substructure Loading computes its own.'];
    const anySep = Object.keys(sepHas).length > 0;
    if (anySep || sepExt.pl || sepExt.utc) {   // SRP: the separate items in words (per support and line)
      const rows = supports.map(s => { const t = s.girders.filter(g => g.separate).map(g => `${g.label} ${SEPK.filter(f => g.separate[f] != null).map(f => `${f} ${f3(g.separate[f])}`).join(' ')}`); return t.length ? `${s.id}: ${t.join(', ')}` : ''; }).filter(Boolean);
      sepNotes({ has: sepHas, anyPlExt: !!sepExt.pl, anyUtcExt: !!sepExt.utc }, rows).forEach(t => notes.push(t));
      if (sepHas.PL && piers.length) notes.push('Pedestrian load at a pier: the sum of the two spans\' end values (PL: each span\'s largest end reaction, an upper bound of the pier reaction when the spans are continuous; PLmin: the sum of the uplift parts).');
    }
    const pr = (P && P.project) || {};
    const payload = { _schema: 'bridge-super-reactions', schemaVersion: 1, producer: PRODUCER, producerFile: FILE, project: { name: String(pr.name || ''), bridgeId: '' },
      units: { force: 'kip', length: 'ft' }, factored: false, imIncluded: false, dfIncluded: false, perGirder: true,
      allGirders: true, span: { index: null, length: r3(X[ns]) }, supports, liveLoad: null, ...(anySep ? { separate: sepInfo(sepHas) } : {}), notes };
    return { ok: true, payload, shares: sh, sum: supports.map(s => `  ${s.id} (x = ${f2(s.x)} ft): ${s.girders.map(g => `${g.label} ${f2(g.DC1)} / ${f2(g.DC2)} / ${f2(g.DW)}`).join(', ')}`).join('\n')
      + (anySep ? '\n  Separate items (optional fields; UT and UF are inside DC1, UTc inside DW, PL in no other field), kip:\n' + supports.map(s => { const t = s.girders.filter(g => g.separate).map(g => `${g.label} ${SEPK.filter(f => g.separate[f] != null).map(f => `${f} ${f2(g.separate[f])}`).join(' ')}`); return t.length ? `  ${s.id}: ${t.join(', ')}` : ''; }).filter(Boolean).join('\n') : '') };
  }
  /* secDims(g): the girder section in the §4.14 terms from the engine's own section (girderGross / R.g, in): depth = h (the girder's total
     depth); bf = the larger flange width (btf, bbf); tw = bw (the engine's web width: both webs of a box, both stems of a NEXT beam); tf =
     the thickest horizontal part of the outline: I-girders and bulb tees the larger of the top and bottom flange thicknesses (d1, d3 of the
     library), NEXT the flange thickness, a box the larger of the bottom slab (wall) and the top slab (h − wall − void height), a voided slab
     (h − void diameter) / 2, a solid box or slab h. */
  function secDims(g) {
    let tf;
    if (g.isNext && g.next) tf = +g.next.ft;
    else if (g.isBox && g.box) tf = g.box.voidH > 0 ? Math.max(+g.box.wall, g.h - g.box.wall - g.box.voidH) : +g.h;
    else if (g.isDeck && g.box) tf = g.box.voids > 0 && g.box.voidD > 0 ? (g.h - g.box.voidD) / 2 : +g.h;
    else { const d = Array.isArray(g.d) ? g.d.map(Number) : []; tf = Math.max(d[0] || 0, d[2] || 0); }
    return { d: +g.h, bf: Math.max(+g.btf || 0, +g.bbf || 0), tf, tw: +g.bw };
  }
  /* sgPayload(P, cells): superGeometry (HANDOFF.md §4.14) from the inputs and each girder type's section (no analysis): spans and
     continuity, each support's station, skew (as entered) and joint, the girder layout, the deck edges (the traffic-face width,
     PSBBridgeDL.edgeFace, the Steel Bridge app's edgeIn), the deck, and the girder section (the largest of each dimension over every
     girder type on its lines; the deepest at each support and in each span), section.material 'prestressed concrete' (optional, §4.14).
     → { ok, payload, sum } or { error } */
  function sgPayload(P, cells) {
    const errs = [], spans = ((P && P.spans && P.spans.lengths) || []).map(Number), ns = spans.length, xs = (P && P.xs) || {}, nb = Math.round(+xs.nb);
    if (!ns || !spans.every(v => isN(v) && v > 0)) errs.push('Enter the span lengths (Bridge layout tab).');
    if (!(nb >= 1)) errs.push('Define the cross-section (number of girders, Cross-section tab).');
    const skews = (xs.skews || []).map(Number);
    if (ns && (skews.length !== ns + 1 || !skews.every(isN))) errs.push(`Enter one skew for each of the ${ns + 1} supports (Bridge layout tab).`);
    const DL = W.PSBBridgeDL, q = xs.dl;
    const Ed = DL && q ? { L: DL.edgeFace(P, 'L'), R: DL.edgeFace(P, 'R') } : null;
    if (!Ed || !isN(Ed.L.f) || !isN(Ed.R.f)) errs.push('Define the deck edges (barrier or curb, Cross-section tab, DC2 and DW).');
    const cs = (cells || []).filter(c => c.inp && c.s >= 1 && c.s <= ns);
    if (ns && !cs.length) errs.push('No girder line has a girder type (Girders & strands tab, Girder types).');
    if (errs.length) return { error: errs.join(' ') };
    const D = cs.map(c => { let g = c.R && !c.R.error && c.R.g ? c.R.g : null; if (!g) { try { g = W.girderGross(c.inp); } catch (e) { g = null; } }
      return g ? Object.assign({ s: c.s, g: c.g, name: c.inp.girder }, secDims(g)) : null; });
    if (D.some(x => !x)) return { error: 'A girder section cannot be computed: fix the inputs first.' };
    const mx = (a, k) => a.length ? Math.max(...a.map(x => x[k])) : null;
    const spanMax = spans.map((_, i) => mx(D.filter(x => x.s === i + 1), 'd'));
    if (spanMax.some(v => v == null)) return { error: `Every span needs a girder type on its lines (none in span ${spanMax.findIndex(v => v == null) + 1}).` };
    const atSupports = skews.map((_, k) => Math.max(k > 0 ? spanMax[k - 1] : 0, k < ns ? spanMax[k] : 0));
    const cont = !!(P.spans && P.spans.continuity === 'composite') && ns > 1, X = [0]; spans.forEach(v => X.push(r3(X[X.length - 1] + v)));
    // the deck: t_s, the dead-load thickness and the haunch of the girder types (one value each in a project; the largest when types differ)
    const one = f => { const v = [...new Set(cs.map(c => +f(c.inp)))]; return { v: Math.max(...v), many: v.length > 1 }; };
    const ts = one(i => +i.ts), tot = one(i => i.tsSeparate ? +i.tsDL : +i.ts), th = one(i => +i.th);
    const edge = sd => { const e = Ed[sd], b = q['bar' + sd] || {}, curb = e.type === 'curb', o = v => (v == null || v === '' || !isN(+v)) ? null : r4(+v);
      return { type: curb ? 'curb' : 'barrier', width: r4(e.f), faceBasis: e.by, barrierWidth: curb ? null : o(b.bw), curbWidth: curb ? o(b.cw) : null, curbHeight: curb ? o(b.ch) : null, height: null,
        railing: curb ? { loadPoint: o(b.rp), trafficFace: o(b.rf) } : null }; };
    const supports = X.map((x, k) => ({ id: supId(k, ns), x, skew: skews[k], joint: k === 0 || k === ns ? 'end' : cont ? 'continuous' : 'joint', depth: r4(atSupports[k]) }));
    const pr = (P && P.project) || {}, sec = { depth: mx(D, 'd'), bf: mx(D, 'bf'), tf: mx(D, 'tf'), tw: mx(D, 'tw') };
    const names = [...new Set(D.map(x => x.name))];
    const payload = { _schema: 'bridge-super-geometry', schemaVersion: 1, producer: PRODUCER, producerFile: FILE, project: { name: String(pr.name || ''), bridgeId: '' },
      units: { length: 'ft', skew: 'deg', deck: 'in', section: 'in', curb: 'in', height: 'in' },
      spans: spans.slice(), continuity: cont ? 'continuous' : 'simple', supports,
      girders: { count: nb, spacings: (xs.bays || []).map(Number), ohL: +xs.ohL, ohR: +xs.ohR },
      edges: { L: edge('L'), R: edge('R') },
      deck: { ts: ts.v, total: tot.v, haunch: th.v },
      section: { depth: r4(sec.depth), bf: r4(sec.bf), tf: r4(sec.tf), tw: r4(sec.tw), atSupports: atSupports.map(r4), spanMax: spanMax.map(r4), material: 'prestressed concrete',
        definition: 'precast prestressed concrete girders: total depth = the girder depth h (deck and haunch not included); bf = the larger flange width (top, bottom); tw = the web width bw (both webs of a box, both stems of a NEXT beam); tf = the thickest flange or slab of the section; each the largest over every girder type (each on its own)' },
      basis: { skew: 'as entered in this app (Bridge layout tab): the bearing of girder line i is at x = x_support + (z_i - z_mid) tan(skew), z from G1 toward Gn (left to right looking ahead station), so + = the right end of the support line is ahead station',
        spans: 'span lengths of the girder design, bearing to bearing; stations x from the first support' },
      notes: [
        `From the PS Bridge app (apps/ps-bridge) inputs: spans and continuity (Bridge layout), support skews (Bridge layout), girders, spacings and overhangs (Cross-section), deck edges (Cross-section, DC2 and DW; width = deck edge to the traffic face: ${['L', 'R'].map(sd => `${sd === 'L' ? 'left' : 'right'} ${f2(Ed[sd].f)} ft, ${Ed[sd].by}`).join('; ')}), deck thickness and haunch (Cross-section, Deck and haunch${ts.many || tot.many || th.many ? '; the girder types differ: the largest sent' : ''}), girder sections of the girder types (${names.join(', ')}).`,
        `Girder section (in), precast prestressed concrete: largest over every girder type: depth ${f3(sec.depth)}, flange width ${f3(sec.bf)}, flange thickness ${f3(sec.tf)}, web width ${f3(sec.tw)}. Deepest at each support: ${supports.map(s => `${s.id} ${f3(s.depth)}`).join(', ')}. Deepest in each span: ${spanMax.map((v, i) => `span ${i + 1} ${f3(v)}`).join(', ')}.`,
        'Skew: as entered here, + when the right end of the support line (looking ahead station) is ahead station.',
        `Supports: ${cont ? 'continuous for composite loads over the piers (5.12.3.3)' : 'simple spans (an expansion joint at each pier)'}; the abutments are deck ends. Bearing fixity is not defined in this app and is not sent. Elevations and the substructure are not carried.`,
        'Barrier height: not an input of this app (not sent). Curb height and the railing load point are sent for a curb edge.'] };
    const HS = W.SharedHandoffStore;
    if (HS) payload.contentHash = HS.geometryHash(payload);
    const chk = HS ? HS.checkGeometry(payload) : { ok: true, errors: [] };
    if (!chk.ok) return { error: chk.errors.join('; ') };
    return { ok: true, payload, sum: `${HS ? HS.summary('superGeometry', payload) : ns + ' spans'}; skews ${skews.map(f2).join(', ')} deg; overhangs ${f2(+xs.ohL)} / ${f2(+xs.ohR)} ft; deck ${f2(ts.v)} in, haunch ${f2(th.v)} in; girder depth ${f3(sec.depth)} in (largest)` };
  }

  /* ---- batch F3 (2026-11-15): the old app's "Design beam" chip (O:8962-8984 BeamChip, BridgeBeam O:515-565), read only ----
     dbState(P, get): the shared design beam of LL & DL Distribution (bridgeSuite.v1.designBeam, schema bridge-design-beam) and its beam
     roster (bridgeSuite.v1.beamRoster, bridge-beam-roster), read as BridgeBeam.rd reads them (schema, version <= 1), and what they mean
     here: mismatch (the old app's BridgeBeam.mismatch: the roster's Nb against this bridge's xs.nb), the line of the same number (the old
     app's beam numbers are the girder lines; only when the counts match), its girder type in the span shown, and whether LL & DL's
     interior / exterior class of that beam agrees with the line's position here (G1 and G<nb> exterior). get(key) returns the stored
     text. -> null (nothing published) | { sel, roster, nb, mismatch: { mine, roster } | null, g, k, s, pos, theirs, posWarn } */
  const DB_K = { sel: 'bridgeSuite.v1.designBeam', ros: 'bridgeSuite.v1.beamRoster' };
  function dbRead(get, k, sch) { try { const raw = get(k); if (!raw) return null; const o = JSON.parse(raw); if (!o || o._schema !== sch || (o.schemaVersion || 1) > 1) return null; return o; } catch (e) { return null; } }
  function dbState(P, get) {
    const sel = dbRead(get, DB_K.sel, 'bridge-design-beam'), roster = dbRead(get, DB_K.ros, 'bridge-beam-roster');
    if (!sel && !roster) return null;
    const nb = Math.round(+(P && P.xs && P.xs.nb)) || null, BRm = W.PSBBridge;
    const mismatch = roster && roster.Nb && nb && +nb !== +roster.Nb ? { mine: +nb, roster: +roster.Nb } : null;
    const o = { sel, roster, nb, mismatch, g: null, k: -1, s: null, pos: '', theirs: '', posWarn: false };
    const i = sel ? Math.round(+sel.index) : NaN;
    if (!mismatch && nb && i >= 1 && i <= nb) {
      const d = BRm && BRm.sel ? BRm.sel(P) : { s: 1 }; o.g = i; o.s = d.s;
      o.k = BRm && BRm.hasTypes(P) ? BRm.typeAt(P, d.s, i) : -1;
      o.pos = i === 1 || i === nb ? 'exterior' : 'interior';
      const t = sel.type || (roster && (roster.beams || []).find(b => +b.i === i) || {}).type;
      o.theirs = t === 'ext' ? 'exterior' : t === 'int' ? 'interior' : '';
      o.posWarn = !!o.theirs && o.theirs !== o.pos;
    }
    return o;
  }

  W.PSBHandoffs = { PRODUCER, SR_ID, RX, applyLoads, dlBlocked, srPayload, srParts, sepInfo, SEPK, psSection, capacity, CAP_BASIS, lldfGeom, lldfResolve, lldfTheirs, lldfFields, dlResolve, dlTheirs,
    PM, PM_LABELS, pmFields, pmPlan, MCT_VERSION, MCT_K, verOf, tokenOf, mctPending, mctDescribe, mctPlan, geomPending,
    GEO_ID, srAll, secDims, sgPayload, DB_K, dbState };   // batch F (2026-11-15)
})();
