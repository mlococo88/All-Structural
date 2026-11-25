/* apps/ps-bridge/engine/hostale.js — the hand-off stale check of the PS Bridge app (window.PSBHoStale). Classic script, no DOM, no storage
   writes. Added 2026-11-21 (engineer decision HO-D2, 2026-11-21): the hand-offs stay click only (nothing is sent or loaded on its own, no
   locks); when the data on a channel has changed since this project last sent or loaded it, the page shows a banner naming the channel with
   a one-click Send / Load that runs the existing click action (ui/handoffs.js). Display only: no value of the design is computed here.

   The record (what this project last sent / loaded) is the optional project field P.handoffs (engine/model.js header):
     P.handoffs = { sent:   { <id>: { sig, at, cell? } },        id: psSection, lldfGeom, capacity, superReactions (the line shown),
                                                                  superReactionsAll, superGeometry, bearingLoads (BRG-HO,
                                                                  2026-11-24: every girder line), projectMeta
                    loaded: { <id>: { sig, at, cell?, via? } } } id: lldf, dlLoads, projectMeta
     sig  = sig(payload): a short hash of the payload's JSON with its stamp fields left out (producedAt, updatedAt, device), so a re-send of
            the same values has the same sig;
     at   = the payload's producedAt (the existing envelope field, HANDOFF.md §3), as sent / as loaded;
     cell = { id, g, label }: the girder type (its id) and line the girder hand-offs were sent for / loaded into.
   NOMCT (2026-11-25, engineer's request "no MCT input or output"): the capacity send, the MCT demands received and the MCT geometry changes
   are removed (their channels, the capacity sig, mctState, geoState). A record P.handoffs.sent.capacity saved before is kept in the
   project as it is, and no longer shown.
   A project without the record (every project saved before) is "unknown" on that channel: no banner (the card says nothing was sent /
   loaded from this project yet, or before the record was kept). */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  /* 2026-11-23: canon, hash, sig, the record helpers (sentOf, loadedOf, setSent, setLoaded, carrySent) and the states (outState, inState)
     are in shared/handoff-stale.js (window.SharedHandoffStale; moved there unchanged when the Steel Bridge app got the same banner); the
     page loads it before this file. */
  const { canon, hash, sig } = W.SharedHandoffStale;

  /* the channels: id -> { ch (the bridgeSuite.v1 channel), dir, label, to / from (the banner text), cell (per girder type and line) } */
  const CH = {
    psSection: { ch: 'psSection', dir: 'out', label: 'Girder section', to: 'LL & DL', cell: true },
    lldfGeom: { ch: 'lldfGeom', dir: 'out', label: 'Girder geometry', to: 'LL & DL', cell: true },
    superReactions: { ch: 'superReactions', dir: 'out', label: 'Reactions of the girder line', to: 'Substructure Loading', cell: true },
    superReactionsAll: { ch: 'superReactions', dir: 'out', label: 'Reactions of every girder line', to: 'Substructure Loading' },
    superGeometry: { ch: 'superGeometry', dir: 'out', label: 'Bridge geometry', to: 'Substructure Loading' },
    bearingLoads: { ch: 'bearingLoads', dir: 'out', label: 'Bearing loads', to: 'the Elastomeric Bearing module' },   // BRG-HO (2026-11-24)
    projectMeta: { ch: 'projectMeta', dir: 'out', label: 'Project info', to: 'the other tools' },
    lldf: { ch: 'lldf', dir: 'in', label: 'Distribution factors', from: 'the LLDF tool' },
    dlLoads: { ch: 'dlLoads', dir: 'in', label: 'Dead loads DC2 / DW', from: 'the LLDF tool' },
    projectMetaIn: { ch: 'projectMeta', dir: 'in', label: 'Shared project info', from: 'another tool', rec: 'projectMeta' }
  };
  const OUT_IDS = ['psSection', 'lldfGeom', 'superReactions', 'superReactionsAll', 'superGeometry', 'bearingLoads', 'projectMeta'];
  const IN_IDS = ['lldf', 'dlLoads', 'projectMetaIn'];

  const { sentOf, loadedOf, setSent, setLoaded, carrySent, outState, inState } = W.SharedHandoffStale;
  /* noStep(a, b): the two project texts differ only in the design shown (P.design) or the sent records: not an Undo step */
  function noStep(a, b) {
    try {
      const x = JSON.parse(a), y = JSON.parse(b);
      [x, y].forEach(o => { delete o.design; if (isObj(o.handoffs)) { delete o.handoffs.sent; if (!Object.keys(o.handoffs).length) delete o.handoffs; } });
      return JSON.stringify(x) === JSON.stringify(y);
    } catch (e) { return false; }
  }
  /* designText(P): the project text without the hand-off record (the keys that mean "the inputs changed": a send is not an input change) */
  const designText = P => JSON.stringify(Object.assign({}, P, { handoffs: undefined }));

  /* the states (shared/handoff-stale.js outState, inState): 'unknown' (no record: nothing sent / loaded from this project, or before the
     record was kept), 'current', 'stale', 'unchecked' (cannot be compared now: input errors, results still running, the payload cannot be
     built), 'gone' (the girder type or line it was sent for / loaded into is no longer in the project), 'none' (the incoming data is no
     longer in this browser) */

  /* the current sig of a girder hand-off of one girder type x line: H = PSBHandoffs, inp / R = its engine inputs and result */
  const extOn = inp => { const e = inp && inp.external; return !!(e && Array.isArray(e.stations) && e.stations.length); };
  function cellSig(H, id, inp, R) {
    try {
      if (!inp || !R || R.error) return null;
      if (id === 'psSection') return sig(H.psSection(inp, R, ''));
      if (id === 'lldfGeom') { const b = H.lldfGeom(inp, R, ''); return b.error ? null : sig(b.payload); }
      if (id === 'superReactions') { const b = H.srPayload(inp, R); return !b || b.error || !b.payload ? null : sig(b.payload); }
    } catch (e) { return null; }
    return null;
  }
  /* allSig(H, id, P, cells): the bridge-wide sends (every girder line); cells = PSBBridge.results(...).cells */
  function allSig(H, id, P, cells) {
    try {
      if (!cells) return null;
      const r = id === 'superGeometry' ? H.sgPayload(P, cells) : id === 'bearingLoads' ? (W.PSBBearing ? W.PSBBearing.blPayload(P, cells) : null) : H.srAll(P, cells);   // BRG-HO: bearingLoads (engine/bearing.js)
      return r && !r.error && r.payload ? sig(r.payload) : null;
    } catch (e) { return null; }
  }
  const pmSig = (H, P) => sig({ _schema: 'bridge-project-meta', fields: H.pmFields(P) });

  /* lldfBeam(P, cell, inp, raw): the design beam of the lldf pull (the line shown when LL & DL has the same girder count; ui/handoffs.js
     lldfPull, unchanged rule HO-D5) */
  function lldfBeam(P, cell, inp, raw) {
    let nb = null; try { nb = raw ? JSON.parse(raw).Nb : null; } catch (e) { nb = null; }
    return cell && nb != null && +nb === +P.xs.nb ? { index: cell.g, label: 'G' + cell.g, clsLabel: inp.loads.pos === 'exterior' ? 'exterior' : 'interior' } : null;
  }
  /* the stored incoming payload, as { at, sig } (sig: the values this design would take from it) */
  function lldfCur(H, P, cell, inp, raw) {
    if (!raw) return null;
    const r = H.lldfResolve(inp, raw, lldfBeam(P, cell, inp, raw));
    if (r.why) return { bad: true };
    return { at: r.at, sig: sig(H.lldfFields(inp, r)) };
  }
  function dlCur(H, raw) {
    if (!raw) return null;
    const r = H.dlResolve(raw); if (r.why) return { bad: true };
    return { at: r.at, sig: sig(H.dlTheirs(r)) };
  }
  /* pmCur(H, P, raw): the shared project info, sig 'same' when it would change nothing here (the pull's own plan) */
  function pmCur(H, P, raw) {
    if (!raw) return null;
    let p; try { p = JSON.parse(raw); } catch (e) { return { bad: true }; }
    if (!p || p._schema !== 'bridge-project-meta' || !p.fields) return { bad: true };
    return { at: p.producedAt || '', sig: H.pmPlan(P, p).lines.length ? 'differs' : 'same' };
  }

  W.PSBHoStale = { CH, OUT_IDS, IN_IDS, canon, hash, sig, sentOf, loadedOf, setSent, setLoaded, carrySent, noStep, designText, outState, inState,
    extOn, cellSig, allSig, pmSig, lldfBeam, lldfCur, dlCur, pmCur };
})();
