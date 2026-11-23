/* shared/handoff-stale.js — the hand-off stale check, the part every app shares (window.SharedHandoffStale). Classic script, no DOM, no
   storage. Created 2026-11-23 from apps/ps-bridge/engine/hostale.js (HO-D2, engineer decision 2026-11-21: the hand-offs stay click only; a
   banner names a channel whose data changed since this project last sent or loaded it), when the Steel Bridge app got the same banner.
   The functions are the PS Bridge app's, moved unchanged (same text, same results: tests/engine/psbridge-hostale.test.mjs runs on them).
   Display only: no value of a design is computed here.

   Loaded by: apps/ps-bridge/index.html (engine/hostale.js, PSBHoStale, takes these and adds its channels),
              apps/steel-bridge/index.html (engine/hostale.js, SBDHoStale).

   The record (what a project last sent / loaded) is an optional project field:
     P.handoffs = { sent: { <id>: { sig, at, … } }, loaded: { <id>: { sig, at, … } } }
     sig = sig(payload): a short hash of the payload's JSON with its stamp fields left out (producedAt, updatedAt, device), so a re-send
           of the same values has the same sig (an app may record another text it can rebuild cheaply, e.g. a hash of the inputs);
     at  = the payload's producedAt (the existing envelope field, HANDOFF.md §2), as sent / as loaded.
   A project without the record (every project saved before the record was kept) is 'unknown' on that channel: no banner. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const VOL = ['producedAt', 'updatedAt', 'device'];
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  /* canon(v): JSON text with the object keys sorted (a stable text for the hash) */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (isObj(v)) return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  /* hash(s): FNV-1a 32-bit of the text, hex, with the text length (not a security hash: a change detector) */
  function hash(s) {
    let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8) + ':' + s.length;
  }
  /* sig(payload): the hash of the payload without its stamp fields; null for no payload */
  function sig(payload) {
    if (payload == null) return null;
    const o = isObj(payload) ? Object.assign({}, payload) : payload;
    if (isObj(o)) VOL.forEach(k => { delete o[k]; });
    return hash(canon(o));
  }

  /* the record */
  const recs = P => (P && isObj(P.handoffs)) ? P.handoffs : null;
  const sentOf = (P, id) => { const r = recs(P); return r && isObj(r.sent) && isObj(r.sent[id]) ? r.sent[id] : null; };
  const loadedOf = (P, id) => { const r = recs(P); return r && isObj(r.loaded) && isObj(r.loaded[id]) ? r.loaded[id] : null; };
  function put(P, part, id, rec) {
    const r = isObj(P.handoffs) ? P.handoffs : {}; r[part] = Object.assign({}, isObj(r[part]) ? r[part] : {}, { [id]: rec }); P.handoffs = r; return P;
  }
  const setSent = (P, id, rec) => put(P, 'sent', id, rec), setLoaded = (P, id, rec) => put(P, 'loaded', id, rec);
  /* carrySent(from, to): the sent records of from on to (Undo / Redo: a send happened and stays sent; the loaded records follow the
     project text, since they say what the design uses). Returns to. */
  function carrySent(from, to) {
    const s = recs(from) && recs(from).sent;
    if (s) { to.handoffs = Object.assign({}, isObj(to.handoffs) ? to.handoffs : {}, { sent: s }); }
    else if (isObj(to.handoffs)) { delete to.handoffs.sent; if (!Object.keys(to.handoffs).length) delete to.handoffs; }
    return to;
  }

  /* the states: 'unknown' (no record: nothing sent / loaded from this project, or before the record was kept), 'current', 'stale',
     'unchecked' (cannot be compared now: input errors, results still running, the payload cannot be built), 'none' (the incoming data is
     no longer in this browser) */
  function outState(rec, cur) {
    if (!rec || !rec.sig) return 'unknown';
    if (cur == null) return 'unchecked';
    return cur === rec.sig ? 'current' : 'stale';
  }
  /* inState(rec, cur): cur = { at, sig } of the stored payload (null: none stored; { bad: true }: unreadable) */
  function inState(rec, cur) {
    if (!rec || (!rec.at && !rec.sig)) return 'unknown';
    if (!cur) return 'none';
    if (cur.bad) return 'unchecked';
    if (rec.at && cur.at === rec.at) return 'current';
    if (rec.sig && cur.sig && cur.sig === rec.sig) return 'current';   // published again with the same values
    return 'stale';
  }

  W.SharedHandoffStale = { VOL, canon, hash, sig, sentOf, loadedOf, setSent, setLoaded, carrySent, outState, inState };
})();
