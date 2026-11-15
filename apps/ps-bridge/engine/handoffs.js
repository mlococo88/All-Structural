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
   No engineering value is computed here beyond what the old app's code computed for the same payload. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const PRODUCER = 'PS-Beam', SR_ID = 'psbeam', RX = 'psbridge';

  /* ---- superReactions: the moved engine's function (verbatim slice of the old page) ---- */
  function srPayload(inp, R) {
    if (typeof W.bxSuperRxPayload !== 'function') return { error: 'the engine is not loaded' };
    return W.bxSuperRxPayload(inp, R);
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

  W.PSBHandoffs = { PRODUCER, SR_ID, RX, applyLoads, dlBlocked, srPayload, psSection, capacity, CAP_BASIS, lldfGeom, lldfResolve, lldfTheirs, lldfFields, dlResolve, dlTheirs,
    PM, PM_LABELS, pmFields, pmPlan, MCT_VERSION, MCT_K, verOf, tokenOf, mctPending, mctDescribe, mctPlan, geomPending };
})();
