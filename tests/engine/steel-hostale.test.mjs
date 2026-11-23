// apps/steel-bridge SHO (2026-11-23; the PS Bridge app's HO-D2 banner in the Steel Bridge app): the hand-off stale check
// (shared/handoff-stale.js SharedHandoffStale; apps/steel-bridge/engine/hostale.js SBDHoStale; engine/model.js hideRec / carryRec), pure
// functions. The hand-offs stay click only; a banner names a channel whose data changed since this project last sent / loaded it. Here:
//   1. the shared part: sig (stamp fields and key order do not count), the states, the record helpers;
//   2. the record on the project: a hidden property (the project's own JSON text is unchanged by a send: no Undo step, no tab or analysis
//      key changes), written by exportJSON as the last field, read back by importJSON, carried by carryRec; a project without it exports
//      byte for byte as before;
//   3. outgoing: superGeometry (the payload's sig), projectMeta (the title block fields), superReactions (the hash of the analysis inputs:
//      a rating factor or a title-block field other than the name does not count, a span or a plate does); input errors: unchecked;
//   4. incoming lldf: a pull made before the record (no source.via) has no state; the same factors re-published later: current; other
//      factors: stale; another span count / other span lengths / another project name: unchecked; a line's own pull; projectMeta;
//   5. a project saved before (no record): no item at all; no computed value changes (the payload builders give the same payloads).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'handoff-store.js', 'handoff-stale.js', ...['engine/model.js', 'engine/sections.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/analysis.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/hostale.js', 'ui/handoffs.js'].map(E));
const M = W.SBDModel, H = W.SBDHandoffs, S = W.SBDHoStale, SH = W.SharedHandoffStale;
const J = v => JSON.parse(JSON.stringify(v));
const put = (P, part, id, rec) => { if (!P.handoffs) M.setRec(P, {}); (part === 'sent' ? SH.setSent : SH.setLoaded)(P, id, rec); };
const st = (it, id) => { const q = it.find(x => x.id === id); return q ? q.state : undefined; };
const lldf = (P, at, gM, o) => JSON.stringify(Object.assign({ _schema: 'bridge-lldf-factors', schemaVersion: 1, producer: 'LL & DL Distribution', producerFile: 'lldf.html', producedAt: at, project: '', bridgeType: 'a',
  spans: P.spans.lengths.map(Number), skew: 0, Nb: Math.round(P.xs.nb), units: { df: 'lanes per girder (dimensionless)' },
  governing: { interior: { gM, gV: 0.8123, fatM: 0.4321, fatV: 0.5432 }, exterior: { gM: gM + 0.02, gV: 0.7633, fatM: 0.5, fatV: 0.51 } },
  governingNeg: { interior: { gM: 0.6789 }, exterior: { gM: 0.7001 } } }, o || {}));
const store = o => c => o[c] || '';

test('shared/handoff-stale.js: sig ignores the stamp fields and the key order; the states; the record helpers', () => {
  const a = { _schema: 'x', producedAt: '2026-11-21T10:00:00.000Z', v: 1, o: { b: 2, a: [1, 2] } };
  const b = { o: { a: [1, 2], b: 2 }, v: 1, _schema: 'x', producedAt: '2026-11-22T00:00:00.000Z', device: 'laptop', updatedAt: 'z' };
  assert.equal(SH.sig(a), SH.sig(b)); assert.notEqual(SH.sig(a), SH.sig({ ...a, v: 1.0001 })); assert.equal(SH.sig(null), null); assert.match(SH.sig(a), /^[0-9a-f]{8}:\d+$/);
  assert.equal(SH.outState(null, 'x'), 'unknown'); assert.equal(SH.outState({ sig: 'a' }, null), 'unchecked'); assert.equal(SH.outState({ sig: 'a' }, 'a'), 'current'); assert.equal(SH.outState({ sig: 'a' }, 'b'), 'stale');
  assert.equal(SH.inState(null, { at: 't' }), 'unknown'); assert.equal(SH.inState({ at: 't1', sig: 'a' }, null), 'none'); assert.equal(SH.inState({ at: 't1', sig: 'a' }, { bad: true }), 'unchecked');
  assert.equal(SH.inState({ at: 't1', sig: 'a' }, { at: 't1', sig: 'b' }), 'current'); assert.equal(SH.inState({ at: 't1', sig: 'a' }, { at: 't2', sig: 'a' }), 'current'); assert.equal(SH.inState({ at: 't1', sig: 'a' }, { at: 't2', sig: 'b' }), 'stale');
  const P = {}; SH.setSent(P, 'k', { sig: 's', at: 't' }); SH.setLoaded(P, 'q', { at: 'u' });
  assert.deepEqual(J(P.handoffs), { sent: { k: { sig: 's', at: 't' } }, loaded: { q: { at: 'u' } } }); assert.equal(SH.sentOf(P, 'k').sig, 's'); assert.equal(SH.loadedOf(P, 'k'), null);
  const Q = SH.carrySent(P, { handoffs: { loaded: { z: { at: 'w' } } } }); assert.deepEqual(J(Q.handoffs), { loaded: { z: { at: 'w' } }, sent: { k: { sig: 's', at: 't' } } });
});

test('the record on the project: hidden from the project\'s own text, the last field of the file, read back, carried; no record = the file as before', () => {
  const P = M.newProject(), t0 = JSON.stringify(P), f0 = M.exportJSON(P);
  assert.equal(f0, JSON.stringify(P, null, 2), 'a project without the record: the file text as before, byte for byte');
  put(P, 'sent', 'superGeometry', { sig: 'abc:1', at: '2026-11-23T10:00:00.000Z' });
  assert.equal(JSON.stringify(P), t0, 'the project\'s own text (Undo steps, tab keys, the analysis cache key) does not hold the record');
  assert.ok(!Object.keys(P).includes('handoffs')); assert.equal(P.handoffs.sent.superGeometry.sig, 'abc:1');
  const f1 = M.exportJSON(P), o1 = JSON.parse(f1);
  assert.equal(Object.keys(o1).at(-1), 'handoffs'); assert.deepEqual(o1.handoffs, { sent: { superGeometry: { sig: 'abc:1', at: '2026-11-23T10:00:00.000Z' } } });
  delete o1.handoffs; assert.equal(JSON.stringify(o1, null, 2), f0, 'the rest of the file is unchanged');
  const r = M.importJSON(f1); assert.equal(r.ok, true);
  assert.equal(JSON.stringify(r.project), t0); assert.equal(r.project.handoffs.sent.superGeometry.sig, 'abc:1'); assert.equal(M.exportJSON(r.project), f1, 'round trip');
  // save / load (the autosave)
  const mem = {}, ls = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  assert.equal(M.save(ls, P), true); assert.equal(M.load(ls).project.handoffs.sent.superGeometry.at, '2026-11-23T10:00:00.000Z');
  // carryRec: Undo / Redo and the saved-state text (a JSON copy loses the hidden property)
  const c = J(P); assert.equal(c.handoffs, undefined); M.carryRec(P, c); assert.equal(c.handoffs.sent.superGeometry.sig, 'abc:1'); assert.equal(JSON.stringify(c), t0);
  c.handoffs.sent.superGeometry.sig = 'zzz'; assert.equal(P.handoffs.sent.superGeometry.sig, 'abc:1', 'a copy, not the same object');
  const d = M.carryRec(M.newProject(), c); assert.equal(d.handoffs, undefined, 'from a project without a record: none');
  // a file that holds the field in any place reads the same
  const o2 = { handoffs: { sent: { projectMeta: { sig: 'q', at: 't' } } }, ...JSON.parse(f0) }, r2 = M.importJSON(JSON.stringify(o2));
  assert.equal(r2.ok, true); assert.equal(r2.project.handoffs.sent.projectMeta.sig, 'q'); assert.equal(JSON.stringify(r2.project), t0);
});

test('outgoing: superGeometry and projectMeta by the payload, superReactions by the analysis inputs; input errors: unchecked', () => {
  const P = M.newProject(); P.project.name = 'Made-up Creek Bridge';
  assert.deepEqual(J(S.items(H, M, P, store({}), false)), [], 'no record: no item');
  const g = H.sgPayload(P); assert.equal(g.ok, true);
  put(P, 'sent', 'superGeometry', { sig: SH.sig(g.payload), at: '2026-11-23T10:00:00.000Z' });
  put(P, 'sent', 'superReactions', { sig: S.rxSig(P), at: '2026-11-23T10:00:05.000Z' });
  put(P, 'sent', 'projectMeta', { sig: S.pmSig(H, P), at: '2026-11-23T10:00:09.000Z' });
  assert.match(S.rxSig(P), /^inp:[0-9a-f]{8}:\d+$/);
  let it = S.items(H, M, P, store({}), false);
  assert.deepEqual(J(it.map(q => [q.id, q.state])), [['superGeometry', 'current'], ['superReactions', 'current'], ['projectMeta', 'current']]);
  // the device field and the time of a send do not count
  assert.equal(SH.sig({ ...g.payload, device: 'laptop', producedAt: 'later' }), P.handoffs.sent.superGeometry.sig);
  // inputs the reactions do not read: the rating factors, the f_l of the Flexure tab, custom demands, the title block but the name
  P.rating = { phiC: 0.95, phiS: 1 }; P.flexure = { fl: 2 }; P.demandSrc = { flex: 'custom' }; P.project.designer = 'A. B.';
  it = S.items(H, M, P, store({}), false);
  assert.equal(st(it, 'superReactions'), 'current'); assert.equal(st(it, 'superGeometry'), 'current'); assert.equal(st(it, 'projectMeta'), 'stale', 'the designer is a shared title-block field');
  // the slab: geometry and reactions (dead load)
  const ts = P.deck.ts; P.deck.ts = ts + 0.5; it = S.items(H, M, P, store({}), false);
  assert.equal(st(it, 'superGeometry'), 'stale'); assert.equal(st(it, 'superReactions'), 'stale'); assert.match(it.find(q => q.id === 'superReactions').msg, /the inputs its analysis reads changed since last sent to Substructure Loading/);
  P.deck.ts = ts; it = S.items(H, M, P, store({}), false); assert.equal(st(it, 'superGeometry'), 'current'); assert.equal(st(it, 'superReactions'), 'current', 'back to the values sent: current again');
  // a plate: the reactions (steel weight); the geometry only when it is the largest
  P.girders[0].segments[0].tw += 0.0625; it = S.items(H, M, P, store({}), false); assert.equal(st(it, 'superReactions'), 'stale');
  P.girders[0].segments[0].tw -= 0.0625;
  // the project name is in both payloads
  P.project.name = 'Made-up Creek Bridge 2'; it = S.items(H, M, P, store({}), false); assert.equal(st(it, 'superReactions'), 'stale'); assert.equal(st(it, 'superGeometry'), 'stale');
  P.project.name = 'Made-up Creek Bridge';
  // input errors (the page passes errs): cannot be checked, no banner
  it = S.items(H, M, P, store({}), true); assert.ok(it.filter(q => q.dir === 'out').every(q => q.state === 'unchecked'));
  // a later send on the shared key by another project is noted (later), not a state
  it = S.items(H, M, P, store({ superGeometry: JSON.stringify({ producedAt: '2026-11-24T00:00:00.000Z' }) }), false);
  assert.equal(it.find(q => q.id === 'superGeometry').later, '2026-11-24T00:00:00.000Z'); assert.equal(st(it, 'superGeometry'), 'current');
});

test('incoming lldf: a pull before the record has no state; same factors later: current; other factors: stale; another bridge: unchecked; a line\'s own pull', () => {
  const P = M.newProject(), pl0 = JSON.parse(lldf(P, '2026-11-21T09:00:00.000Z', 0.7));
  const plan = H.lldfPlan(P, 0, pl0, 'type'); assert.deepEqual(J(plan.err), []);
  H.lldfApply(P, 0, plan, '2026-11-21T09:30:00.000Z');   // as before this PR: no via
  assert.equal(P.girders[0].dfPull.source.via, undefined); assert.deepEqual(J(S.lldfPulls(P)), []);
  assert.deepEqual(J(S.items(H, M, P, store({ lldf: lldf(P, '2026-11-22T09:00:00.000Z', 0.9) }), false)), [], 'a pull made before the record: no state, no banner');
  H.lldfApply(P, 0, plan, '2026-11-21T09:30:00.000Z', null, 'shared browser storage');
  assert.equal(P.girders[0].dfPull.source.via, 'shared browser storage');
  const at = raw => st(S.items(H, M, P, store({ lldf: raw }), false), 'lldf');
  assert.equal(at(lldf(P, '2026-11-21T09:00:00.000Z', 0.7)), 'current', 'the payload pulled');
  assert.equal(at(lldf(P, '2026-11-22T09:00:00.000Z', 0.7)), 'current', 're-published with the same factors');
  assert.equal(at(lldf(P, '2026-11-22T09:00:00.000Z', 0.7555)), 'stale');
  assert.equal(at(''), 'none');
  assert.equal(at('{nope'), 'unchecked');
  assert.equal(at(lldf(P, '2026-11-22T09:00:00.000Z', 0.7555, { spans: P.spans.lengths.concat([60]) })), 'unchecked', 'another span count');
  assert.equal(at(lldf(P, '2026-11-22T09:00:00.000Z', 0.7555, { spans: P.spans.lengths.map(L => L + 3) })), 'unchecked', 'other span lengths');
  assert.equal(at(lldf(P, '2026-11-22T09:00:00.000Z', 0.7555, { perFootStrip: true })), 'unchecked', 'refused by the pull');
  P.girders[0].dfPull.source.project = 'Bridge A';
  assert.equal(at(lldf(P, '2026-11-22T09:00:00.000Z', 0.7555, { project: 'Bridge B' })), 'unchecked', 'another project by name');
  assert.equal(at(lldf(P, '2026-11-22T09:00:00.000Z', 0.7555, { project: 'Bridge A' })), 'stale');
  P.girders[0].dfPull.use = false; assert.deepEqual(J(S.lldfPulls(P)), [], 'a pull not in use: no state');
  delete P.girders[0].dfPull;
  // a line's own pull (SBLO: girders[gi].lineOv[j].dfPull)
  const gi = 0, j = M.typeLines(P, gi)[0], V = M.atLine(P, gi, j), pl2 = H.lldfPlan(V, gi, pl0, 'type'); assert.deepEqual(J(pl2.err), []);
  H.lldfApply(P, gi, pl2, '2026-11-21T09:30:00.000Z', j, 'file made-up.json');
  const q = S.lldfPulls(P); assert.equal(q.length, 1); assert.equal(q[0].j, j); assert.match(q[0].label, new RegExp(`line G${j + 1} only$`));
  let it = S.items(H, M, P, store({ lldf: lldf(P, '2026-11-22T09:00:00.000Z', 0.7555) }), false);
  assert.equal(it[0].state, 'stale'); assert.equal(it[0].gi, gi); assert.equal(it[0].j, j); assert.equal(it[0].rec.via, 'file made-up.json');
  it = S.items(H, M, P, store({ lldf: lldf(P, '2026-11-22T09:00:00.000Z', 0.7) }), false); assert.equal(it[0].state, 'current');
});

test('incoming projectMeta: stale only when the shared info would change a field here; a project saved before: no item', () => {
  const P = M.newProject(); P.project.name = 'Made-up Creek Bridge';
  const pm = (at, f) => JSON.stringify({ _schema: 'bridge-project-meta', schemaVersion: 1, producedAt: at, fields: f });
  assert.deepEqual(J(S.items(H, M, P, store({ projectMeta: pm('2026-11-22T09:00:00.000Z', { projectName: 'Other' }), lldf: lldf(P, 't', 0.9), superGeometry: '{"producedAt":"x"}' }), false)), [], 'no record: nothing, whatever the channels hold');
  put(P, 'loaded', 'projectMeta', { at: '2026-11-21T09:00:00.000Z', sig: 'same' });
  const at = raw => st(S.items(H, M, P, store({ projectMeta: raw }), false), 'projectMetaIn');
  assert.equal(at(pm('2026-11-21T09:00:00.000Z', { projectName: 'Other' })), 'current', 'the payload loaded');
  assert.equal(at(pm('2026-11-22T09:00:00.000Z', { projectName: 'Made-up Creek Bridge', jobNo: '' })), 'current', 'newer, nothing to change here');
  assert.equal(at(pm('2026-11-22T09:00:00.000Z', { projectName: 'Made-up Creek Bridge', jobNo: 'J-17' })), 'stale');
  assert.equal(at('{"_schema":"other"}'), 'unchecked'); assert.equal(at(''), 'none');
});
