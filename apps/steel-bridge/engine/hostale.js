/* apps/steel-bridge/engine/hostale.js — the hand-off stale check of the Steel Bridge app (window.SBDHoStale). Classic script, no DOM, no
   storage writes. Added 2026-11-23 (SHO; engineer 2026-11-23: the Steel Bridge app gets the Prestressed Bridge app's hand-off stale banner,
   apps/ps-bridge/engine/hostale.js, its decision HO-D2 of 2026-11-21): the hand-offs stay click only (nothing is sent or loaded on its own);
   when the data on a channel has changed since this project last sent or loaded it, the page shows a banner naming the channel with a
   one-click Send / Load that runs the existing click action (ui/handoffs.js). Display only: no value of the design is computed here.
   The hash, the record helpers and the states are shared/handoff-stale.js (SharedHandoffStale; the PS Bridge app's, moved there unchanged).

   The record (what this project last sent / loaded):
     P.handoffs = { sent:   { superGeometry: { sig, at }, superReactions: { sig, at }, projectMeta: { sig, at } },
                    loaded: { projectMeta: { sig: 'same', at } } }
       sig: superGeometry, projectMeta: the hash of the payload sent, its stamp fields left out (SharedHandoffStale.sig);
            superReactions: 'inp:' + the hash of the inputs its analysis reads (rxInputs): rebuilding that payload runs the moving-load
            analysis of every girder line (10 s and more), so it is not rebuilt on a redraw (as the PS app's capacity with MIDAS demands);
       at:  the payload's producedAt (the envelope field, HANDOFF.md §2), as sent / as loaded.
     An optional field of the project file (schema sbd2.project version 1 unchanged), written only by a Send / "Use shared project info"
     click. On the open project it is a hidden (non-enumerable) property (engine/model.js hideRec / exportJSON / carryRec): it goes with
     Export JSON, the autosave and the saved projects, but the page's own project text (JSON.stringify(P): the Undo steps, each tab's
     "results out of date" key, the analysis cache) does not hold it, so a Send is no Undo step and puts no result out of date.
     The LL & DL pull needs no new field: girders[i].dfPull.source (and a line's own girders[i].lineOv[j].dfPull.source) already holds the
     payload's producedAt, the basis chosen and the time pulled; since this PR it also holds via ('shared browser storage' / 'file <name>'),
     which marks a pull made since the record is kept.
   A project without the record (every project saved before; a dfPull without source.via) is 'unknown' on that channel: no banner. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const S = () => W.SharedHandoffStale;
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

  /* the channels: id -> { ch (the bridgeSuite.v1 channel), dir, label, to / from (the banner text) } */
  const CH = {
    superGeometry: { ch: 'superGeometry', dir: 'out', label: 'Bridge geometry', to: 'Substructure Loading' },
    superReactions: { ch: 'superReactions', dir: 'out', label: 'Reactions of every girder line', to: 'Substructure Loading' },
    projectMeta: { ch: 'projectMeta', dir: 'out', label: 'Project info', to: 'the other tools' },
    lldf: { ch: 'lldf', dir: 'in', label: 'Distribution factors', from: 'LL & DL Distribution' },
    projectMetaIn: { ch: 'projectMeta', dir: 'in', label: 'Shared project info', from: 'another tool', rec: 'projectMeta' }
  };
  const OUT_IDS = ['superGeometry', 'superReactions', 'projectMeta'];

  /* rxInputs(P): the inputs the reactions hand-off depends on: the project text the analysis cache is keyed by (report/data.js pkOf: the
     project without the rating factors, the f_l entered on the Flexure tab, the custom demands and the demand choices, which the analysis
     does not read), with the title block reduced to the name (the payload's project.name). A change of any other input counts, also one
     that leaves the reactions as they were (the banner then offers a Send of the same values). */
  function rxInputs(P) {
    const o = Object.assign({}, P, { rating: undefined, flexure: undefined, custom: undefined, demandSrc: undefined, handoffs: undefined });
    o.project = { name: String(((P || {}).project || {}).name || '') };
    return o;
  }
  const rxSig = P => { try { return 'inp:' + S().hash(S().canon(JSON.parse(JSON.stringify(rxInputs(P))))); } catch (e) { return null; } };
  /* geoSig(H, P): the sig of the superGeometry payload this project would send now (H = SBDHandoffs); null when it cannot be built */
  function geoSig(H, P) { try { const r = H.sgPayload(P); return r && r.ok && r.payload ? S().sig(r.payload) : null; } catch (e) { return null; } }
  const pmSig = (H, P) => S().sig({ _schema: 'bridge-project-meta', fields: H.pmFields(P) });
  /* pmCur(H, P, raw): the shared project info as { at, sig }: sig 'same' when it would change nothing here (the pull's own plan) */
  function pmCur(H, P, raw) {
    if (!raw) return null;
    let p; try { p = JSON.parse(raw); } catch (e) { return { bad: true }; }
    if (!p || p._schema !== 'bridge-project-meta' || !p.fields) return { bad: true };
    return { at: p.producedAt || '', sig: H.pmPlan(P, p).length ? 'differs' : 'same' };
  }

  /* the LL & DL pulls of the project: [{ gi, j (null: the girder type; a number: that line's own pull), u (the dfPull), label }] for every
     pull in use that was made since the record is kept (source.via) */
  function lldfPulls(P) {
    const out = [];
    (P.girders || []).forEach((g, gi) => {
      const lab = g.label || g.id || `girder ${gi + 1}`, ok = u => isObj(u) && u.use !== false && isObj(u.source) && !!u.source.via;
      if (ok(g.dfPull)) out.push({ gi, j: null, u: g.dfPull, label: lab });
      if (isObj(g.lineOv)) Object.keys(g.lineOv).forEach(k => { const o = g.lineOv[k]; if (isObj(o) && ok(o.dfPull)) out.push({ gi, j: +k, u: o.dfPull, label: `${lab}, line G${+k + 1} only` }); });
    });
    return out;
  }
  const pullSig = u => S().sig({ spans: u.spans || [], piers: u.piers || [] });
  /* lldfCur(H, M, P, q, raw): the stored LL & DL payload as { at, sig } for the pull q (lldfPulls): sig = the factors the same pull (the
     recorded basis) would take from it now. { bad: true } when it cannot be compared: unreadable, refused by the pull's own checks (another
     span count, slab factors, …), for another project by name, or with other span lengths (another bridge: no banner). */
  function lldfCur(H, M, P, q, raw) {
    if (!raw) return null;
    let pl; try { pl = JSON.parse(raw); } catch (e) { return { bad: true }; }
    if (!pl || pl._schema !== H.LLDF.schema || !(Number(pl.schemaVersion || 1) <= H.LLDF.ver)) return { bad: true };
    try {
      const src = q.u.source, V = q.j == null ? P : M.atLine(P, q.gi, q.j), plan = H.lldfPlan(V, q.gi, pl, src.basis === 'beam' ? 'beam' : 'type');
      if (plan.err.length || !plan.pull) return { bad: true };
      const pn = pl.project && typeof pl.project === 'object' ? String(pl.project.name || '') : String(pl.project || '');
      if (pn && src.project && pn !== src.project) return { bad: true };
      const sp = ((P.spans || {}).lengths || []).map(Number);
      if ((pl.spans || []).some((L, i) => Math.abs(L - sp[i]) > 0.5)) return { bad: true };
      return { at: String(pl.producedAt || ''), sig: pullSig(plan.pull) };
    } catch (e) { return { bad: true }; }
  }

  /* items(H, M, P, get): every channel this project has a record of, with its state (SharedHandoffStale.outState / inState):
     [{ id, dir, state, rec, head, msg, btn, gi?, j? }]; get(channel) = the stored text of bridgeSuite.v1.<channel> ('' when none).
     errs: the project has a blocking input error (the outgoing payloads cannot be built: 'unchecked'). */
  function items(H, M, P, get, errs) {
    const St = S(), it = []; if (!St || !H || !P) return it;
    const atOf = raw => { try { const p = raw ? JSON.parse(raw) : null; return (p && p.producedAt) || ''; } catch (e) { return ''; } };
    OUT_IDS.forEach(id => {
      const rec = St.sentOf(P, id); if (!rec) return;
      const C = CH[id], cur = errs ? null : id === 'superGeometry' ? geoSig(H, P) : id === 'superReactions' ? rxSig(P) : pmSig(H, P);
      const sh = atOf(get(C.ch));
      it.push({ id, dir: 'out', state: St.outState(rec, cur), rec, later: sh && rec.at && sh !== rec.at ? sh : '', head: `${C.label} (${C.ch})`,
        msg: id === 'superReactions' ? `the inputs its analysis reads changed since last sent to ${C.to}` : `changed since last sent to ${C.to}`, btn: 'Send' });
    });
    lldfPulls(P).forEach(q => {
      const rec = { at: q.u.source.producedAt || '', sig: pullSig(q.u), via: q.u.source.via, pulled: q.u.source.adoptedAt || '' };
      it.push({ id: 'lldf', gi: q.gi, j: q.j, dir: 'in', state: St.inState(rec, lldfCur(H, M, P, q, get('lldf'))), rec, head: `${CH.lldf.label} (lldf) of ${q.label}`,
        msg: 'LL & DL Distribution has newer data than this design uses', btn: 'Load' });
    });
    const pr = St.loadedOf(P, 'projectMeta');
    if (pr) it.push({ id: 'projectMetaIn', dir: 'in', state: St.inState(pr, pmCur(H, P, get('projectMeta'))), rec: pr, head: `${CH.projectMetaIn.label} (projectMeta)`,
      msg: 'another tool has shared newer project info than this project uses', btn: 'Load' });
    return it;
  }

  W.SBDHoStale = { CH, OUT_IDS, rxInputs, rxSig, geoSig, pmSig, pmCur, lldfPulls, pullSig, lldfCur, items };
})();
