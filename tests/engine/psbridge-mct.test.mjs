// apps/ps-bridge batch D3 (2026-11-15): the MCT Generator's demands hand-off and geometry changes in the new app (engine/handoffs.js
//   mctPending / mctPlan / geomPending; ui/handoffs.js banners, Load by click). The old app's keys and formats, unchanged (bridgeSuite.v1.handoffs,
//   .latestId, .updatedAt, .geometryChanges); this app's own adoption markers (.adopted.psbridge, .geometryChanges.adopted.psbridge).
//   (1) what is pending: the latest payload unless this app adopted / dismissed its token (id@producedAt), its version against v1, the old
//   app's marker (.adopted.psbeam) not read; (2) Load into the type of span 1 gives the engine inputs of the old app's adoptHandoff for its
//   design (external = the payload with the member's span 1, L = that span, continuity on for a continuous member), so every result is the
//   same; a type of span 2 takes span 2 of the member; a payload the file reader refuses is refused; (3) the geometry record.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'handoffs'].map(n => path.join(APP, `engine/${n}.js`)));
const M = W.PSBModel, D = W.PSBDesign, B = W.PSBBridge, H = W.PSBHandoffs, DM = W.PSBDemands;
const J = v => JSON.parse(JSON.stringify(v));
const C = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v === null || typeof v !== 'object' ? (typeof v === 'function' ? '' : JSON.stringify(v))
  : Array.isArray(v) ? '[' + v.map(C).join(',') + ']' : '{' + Object.keys(v).filter(k => typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + C(v[k])).join(',') + '}';
const MCT = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/ext/mct_psbeam_selfweight_excluded.json'), 'utf8'));
// the MCT Generator's publish (the old app's BridgeHandoff.stamp, O:599-611): handoffId = slug(project)__slug(member key), producer, producedAt
const stamp = (p, at) => Object.assign({}, p, { _schema: 'psbeam-external-demands', schemaVersion: p.schemaVersion != null ? p.schemaVersion : (p._version != null ? p._version : 1),
  producer: p.generatedBy || 'MCT Generator', producedAt: at, handoffId: 'fixture-110-140-110-continuous__g2' });
const store = o => k => (k in o ? o[k] : null);

test('MCT demands pending: the latest payload until this app adopts or dismisses its token; a newer schema flagged; the old app\'s marker not read', () => {
  const p = stamp(MCT, '2026-11-15T10:00:00.000Z'), K = H.MCT_K;
  assert.equal(K.adopted, 'bridgeSuite.v1.adopted.psbridge'); assert.equal(K.geomAdopted, 'bridgeSuite.v1.geometryChanges.adopted.psbridge');
  const S = { [K.map]: JSON.stringify({ [p.handoffId]: p }), [K.latest]: p.handoffId, [K.updated]: p.producedAt };
  const r = H.mctPending(store(S)); assert.equal(r.id, p.handoffId); assert.equal(r.token, p.handoffId + '@' + p.producedAt); assert.equal(r.supported, true); assert.equal(r.version, 1);
  assert.deepEqual(J(H.mctDescribe(r.payload)), { producer: 'MCT Generator', project: 'Fixture 110-140-110 continuous', member: 'G2', n: 62, ll: 'HL-93' });
  assert.equal(H.mctPending(store(Object.assign({}, S, { 'bridgeSuite.v1.adopted.psbeam': r.token }))).id, p.handoffId, 'the old app\'s marker is its own');
  assert.equal(H.mctPending(store(Object.assign({}, S, { [K.adopted]: r.token }))), null, 'adopted here');
  const p2 = stamp(MCT, '2026-11-15T11:00:00.000Z');   // re-published: a new token, flagged again
  assert.ok(H.mctPending(store(Object.assign({}, S, { [K.map]: JSON.stringify({ [p.handoffId]: p2 }), [K.adopted]: r.token }))));
  const v2 = Object.assign({}, p, { schemaVersion: 2 });
  assert.equal(H.mctPending(store(Object.assign({}, S, { [K.map]: JSON.stringify({ [p.handoffId]: v2 }) }))).supported, false);
  assert.equal(H.mctPending(store({})), null); assert.equal(H.mctPending(store({ [K.latest]: 'x', [K.map]: '{bad' })), null); assert.equal(H.mctPending(store({ [K.latest]: 'x', [K.map]: '{}' })), null);
});

test('Load into the type of span 1 = the old app\'s adoptHandoff for its design (external with the member\'s span 1, L, continuity on): the same engine inputs and results', () => {
  const P = M.newProject(); P.spans = { lengths: [100, 100, 100], continuity: 'simple' }; P.xs.skews = [0, 0, 0, 0]; B.syncSpans(P);
  const p = stamp(MCT, '2026-11-15T10:00:00.000Z');
  const k = P.types.findIndex(t => t.span === 1 && /Interior/.test(t.label)), T = P.types[k], g = B.typeLines(P, k)[0];
  // the old app: its design = this cell's inputs before; adoptHandoff (O:9234-9262, not silent): external = { ...payload, _selSpan: spans[0] },
  // L = spans[0].len, cont.on = true for a continuous member. Its bridge bar then holds the member's spans (PBD.fromInputs with extActive).
  const before = D.cellInputs(P, k, g), sp = W.PBD.extSpans(p);
  const old = Object.assign(J(before), { external: Object.assign({}, J(p), { _selSpan: sp[0] }), L: sp[0].len, cont: Object.assign({}, before.cont, { on: true }) });
  // this app: the plan, the two bridge questions answered yes (as the page's confirm), the file to the type
  const q = H.mctPlan(P, T, p); assert.equal(q.ok, true); assert.deepEqual(J(q.setSpans), [110, 140, 110]); assert.equal(q.makeCont, true);
  DM.setFile(P, T.id, q.file, 'MCT hand-off ' + p.handoffId); P.spans.lengths = q.setSpans.slice(); P.spans.continuity = 'composite';
  const now = D.cellInputs(P, k, g);
  const strip = o => { const c = J(o); delete c.cont.spans; delete c.cont.span; return c; };   // the old bridge bar's cont.spans: the engine reads the member's (contUnit with ext)
  assert.equal(C(strip(now)), C(strip(old)), 'the engine inputs');
  const Rn = W.computeAll(J(now)), Ro = W.computeAll(J(old)); assert.equal(C(Rn), C(Ro), 'every result'); assert.equal(Rn.useExt, true); assert.equal(Rn.ext.sel.idx, 1);
  // a type of span 2 takes span 2 of the member
  const k2 = P.types.findIndex(t => t.span === 2), T2 = P.types[k2]; DM.setFile(P, T2.id, q.file, 'MCT');
  assert.equal(D.cellInputs(P, k2, B.typeLines(P, k2)[0]).external._selSpan.idx, 2);
  // refused: a factored payload
  assert.match(H.mctPlan(P, T, Object.assign({}, p, { factored: true })).error, /factored demands/);
  // the plan asks nothing when the bridge already has the member's spans and continuity
  const q2 = H.mctPlan(P, T, p); assert.equal(q2.setSpans, null); assert.equal(q2.makeCont, false);
});

test('MCT geometry changes: pending until this app dismisses its producedAt; unreadable records ignored', () => {
  const K = H.MCT_K, g = { schemaVersion: 1, producer: 'MCT Generator', producedAt: '2026-11-15T10:00:00.000Z', changes: [{ field: 'Span 2 length', oldVal: '130 ft', newVal: '140 ft' }] };
  const S = { [K.geom]: JSON.stringify(g), [K.geomAt]: g.producedAt };
  assert.deepEqual(J(H.geomPending(store(S))), J(g));
  assert.equal(H.geomPending(store(Object.assign({}, S, { [K.geomAdopted]: g.producedAt }))), null);
  assert.ok(H.geomPending(store(Object.assign({}, S, { 'bridgeSuite.v1.geometryChanges.adopted.psbeam': g.producedAt }))), 'the old app\'s marker is its own');
  assert.equal(H.geomPending(store({ [K.geom]: '{bad' })), null); assert.equal(H.geomPending(store({ [K.geom]: '{"changes":3}' })), null);
});
