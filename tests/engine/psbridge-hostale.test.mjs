// apps/ps-bridge HO-D2 (engineer decision 2026-11-21): the hand-off stale check (engine/hostale.js, PSBHoStale), pure functions.
//   The hand-offs stay click only; a banner names a channel whose data changed since this project last sent / loaded it. Here: the payload
//   signature (stamp fields left out, key order free); the states (unknown without a record, current, stale, unchecked, gone, none); the
//   record in P.handoffs and its Undo rules (a send is no step and stays sent; a load follows the project text); on real designs: a send's
//   recorded sig = the check's sig on the same girder (psSection, lldfGeom, superReactions, and every line: superGeometry,
//   superReactions allGirders), an input change makes it stale; incoming lldf / dlLoads / projectMeta (re-published with the same values:
//   current; other values: stale); an old project (no record) has no state at all. NOMCT (2026-11-25): the capacity channel and the MCT
//   demands / geometry-change states are removed (tests/engine/psbridge-nomct.test.mjs checks they are gone).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'handoff-stale.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'handoffs', 'hostale'].map(n => path.join(APP, `engine/${n}.js`)));
const M = W.PSBModel, D = W.PSBDesign, BR = W.PSBBridge, H = W.PSBHandoffs, S = W.PSBHoStale;
const J = v => JSON.parse(JSON.stringify(v));
const deq = (a, b, m) => assert.deepEqual(a === undefined ? a : J(a), b === undefined ? b : J(b), m);   // values of the vm context (another realm)
const run = P => { const inp = D.inputs(P); return { inp, R: W.PSBHoldDown.compute(J(inp)) }; };
const cellOf = (P, k, g) => { const inp = D.cellInputs(P, k, g); return { inp, R: W.PSBHoldDown.compute(J(inp)) }; };

test('sig: the stamp fields (producedAt, updatedAt, device) and the key order do not count; a value does', () => {
  const a = { _schema: 'x', producedAt: '2026-11-21T10:00:00.000Z', v: 1, o: { b: 2, a: [1, 2] } };
  const b = { o: { a: [1, 2], b: 2 }, v: 1, _schema: 'x', producedAt: '2026-11-22T00:00:00.000Z', device: 'laptop' };
  assert.equal(S.sig(a), S.sig(b));
  assert.notEqual(S.sig(a), S.sig(Object.assign({}, a, { v: 1.0001 })));
  assert.notEqual(S.sig(a), S.sig(Object.assign({}, a, { o: { b: 2, a: [2, 1] } })), 'array order counts');
  assert.equal(S.sig(null), null);
  assert.match(S.sig(a), /^[0-9a-f]{8}:\d+$/);
});

test('states: no record = unknown (no banner); current / stale / unchecked / none', () => {
  assert.equal(S.outState(null, 'x'), 'unknown'); assert.equal(S.outState({ at: 't' }, 'x'), 'unknown');
  assert.equal(S.outState({ sig: 'a' }, null), 'unchecked'); assert.equal(S.outState({ sig: 'a' }, 'a'), 'current'); assert.equal(S.outState({ sig: 'a' }, 'b'), 'stale');
  assert.equal(S.inState(null, { at: 't2' }), 'unknown'); assert.equal(S.inState({}, { at: 't2' }), 'unknown');
  assert.equal(S.inState({ at: 't1', sig: 'a' }, null), 'none');
  assert.equal(S.inState({ at: 't1', sig: 'a' }, { bad: true }), 'unchecked');
  assert.equal(S.inState({ at: 't1', sig: 'a' }, { at: 't1', sig: 'b' }), 'current', 'the same payload (its time)');
  assert.equal(S.inState({ at: 't1', sig: 'a' }, { at: 't2', sig: 'a' }), 'current', 're-published with the same values');
  assert.equal(S.inState({ at: 't1', sig: 'a' }, { at: 't2', sig: 'b' }), 'stale');
});

test('the record: P.handoffs (sent / loaded), a send is no Undo step and stays through Undo; a load follows the project text', () => {
  const P = M.newProject(); assert.equal(P.handoffs, undefined, 'a new project has no record'); assert.equal(S.sentOf(P, 'psSection'), null);
  const t0 = JSON.stringify(P);
  S.setSent(P, 'psSection', { sig: 's1', at: 'T1', cell: { id: 'x', g: 2, label: 'Interior' } });
  deq(S.sentOf(P, 'psSection'), { sig: 's1', at: 'T1', cell: { id: 'x', g: 2, label: 'Interior' } });
  assert.equal(S.noStep(t0, JSON.stringify(P)), true, 'a send only: no Undo step');
  const Pd = J(P); Pd.design = { g: 1, s: 1 }; assert.equal(S.noStep(JSON.stringify(P), JSON.stringify(Pd)), true, 'the design shown only: no step (as before)');
  const Pl = J(P); S.setLoaded(Pl, 'lldf', { at: 'L1', sig: 'f' }); assert.equal(S.noStep(JSON.stringify(P), JSON.stringify(Pl)), false, 'a load is part of a step');
  const Pi = J(P); Pi.xs.ohL = 2.5; assert.equal(S.noStep(JSON.stringify(P), JSON.stringify(Pi)), false, 'an input change is a step');
  // Undo after a send: the old project text with the send kept
  const back = S.carrySent(P, JSON.parse(t0)); deq(back.handoffs, { sent: P.handoffs.sent }); assert.equal(back.xs.ohL, P.xs.ohL);
  // Undo of a load: the load record goes with the text (the design no longer uses that data)
  const Q = J(Pl), R0 = S.carrySent(Q, J(P)); assert.equal(S.loadedOf(R0, 'lldf'), null); deq(S.sentOf(R0, 'psSection'), S.sentOf(P, 'psSection'));
  // no send: nothing added
  const N = S.carrySent(M.newProject(), JSON.parse(t0)); assert.equal(JSON.stringify(N), t0, 'a project without a record is the same text');
  assert.equal(S.designText(P), S.designText(JSON.parse(t0)), 'designText leaves the record out');
});

test('girder hand-offs: the sig recorded at a send = the check on the same girder; an input change of that girder type makes it stale', () => {
  const P = M.newProject(), c = BR.shown(P), { inp, R } = run(P);
  const sent = {
    psSection: S.sig(H.psSection(inp, R, '2026-11-21T10:00:00.000Z')),
    lldfGeom: S.sig(H.lldfGeom(inp, R, '2026-11-21T10:00:00.000Z').payload),
    superReactions: S.sig(H.srPayload(inp, R).payload)
  };
  const same = cellOf(P, c.k, c.g);
  for (const id of Object.keys(sent)) { assert.ok(sent[id], id); assert.equal(S.cellSig(H, id, same.inp, same.R), sent[id], `${id}: current right after the send`); }
  // f'c of the type shown 8 -> 8.5 ksi: every girder hand-off of that girder changes
  const eff = BR.effBase(P, c.k); eff.mat = Object.assign({}, eff.mat, { fc: +eff.mat.fc + 0.5 }); BR.setOvr(P, c.k, eff);
  const ch = cellOf(P, c.k, c.g);
  for (const id of ['psSection', 'lldfGeom']) assert.equal(S.outState({ sig: sent[id] }, S.cellSig(H, id, ch.inp, ch.R)), 'stale', id);
  // the project name is in the section / geometry payloads: a rename is a change of what was sent
  const P2 = M.newProject(), a = run(P2), s2 = S.sig(H.psSection(a.inp, a.R, 'T')); P2.project.name = 'Route 9 over Mill Brook'; const b = run(P2);
  assert.notEqual(S.cellSig(H, 'psSection', b.inp, b.R), s2);
  // an engine error: cannot check (no banner)
  assert.equal(S.cellSig(H, 'psSection', a.inp, { error: 'x' }), null);
});

test('every girder line: superGeometry and superReactions (allGirders) sig at the send = the check; a span length change makes both stale', () => {
  const P = M.newProject(), cells = BR.results(P, inp => W.PSBHoldDown.compute(J(inp))).cells;
  const g0 = S.sig(H.sgPayload(P, cells).payload), r0 = S.sig(H.srAll(P, cells).payload);
  assert.equal(S.allSig(H, 'superGeometry', P, cells), g0); assert.equal(S.allSig(H, 'superReactionsAll', P, cells), r0);
  assert.equal(S.allSig(H, 'superGeometry', P, null), null, 'results still running: unchecked');
  const Q = J(P); Q.spans.lengths = [118]; const cq = BR.results(Q, inp => W.PSBHoldDown.compute(J(inp))).cells;
  assert.equal(S.outState({ sig: g0 }, S.allSig(H, 'superGeometry', Q, cq)), 'stale');
  assert.equal(S.outState({ sig: r0 }, S.allSig(H, 'superReactionsAll', Q, cq)), 'stale');
  // projectMeta: the title block fields
  const pm = S.pmSig(H, P); Q.project.checker = 'JQ'; assert.notEqual(S.pmSig(H, Q), pm); assert.equal(S.pmSig(H, J(P)), pm);
});

const LLDF = (at, gM) => JSON.stringify({ _schema: 'bridge-lldf-factors', schemaVersion: 1, producer: 'LL & DL Distribution', producedAt: at, project: 'Route 9', Nb: 7,
  governing: { interior: { gM, gV: 0.701234, fatM: 0.41234 }, exterior: { gM: 0.7123, gV: 0.6633, fatM: 0.5 } } });
const DLP = (at, dw) => JSON.stringify({ _schema: 'bridge-dl-loads', schemaVersion: 1, producedAt: at, project: 'Route 9', Nb: 5, cases: [{ key: 'DC2', udl: 0.123456 }, { key: 'DW', udl: dw }] });

test('incoming lldf / dlLoads / projectMeta: newer with other values = stale; re-published with the same values = current', () => {
  const P = M.newProject(), c = BR.shown(P), { inp } = run(P), raw1 = LLDF('2026-11-21T09:00:00.000Z', 0.612345);
  const r = H.lldfResolve(inp, raw1, S.lldfBeam(P, c, inp, raw1)), rec = { at: r.at, sig: S.sig(H.lldfFields(inp, r)) };
  // after the pull (the type's loads written), the same stored payload: current
  H.applyLoads(P, c, H.lldfFields(inp, r)); const after = cellOf(P, c.k, c.g).inp;
  assert.equal(S.inState(rec, S.lldfCur(H, P, c, after, raw1)), 'current');
  assert.equal(S.inState(rec, S.lldfCur(H, P, c, after, LLDF('2026-11-21T11:00:00.000Z', 0.612345))), 'current', 'LL & DL re-sent the same factors');
  assert.equal(S.inState(rec, S.lldfCur(H, P, c, after, LLDF('2026-11-21T11:00:00.000Z', 0.65))), 'stale', 'new factors');
  assert.equal(S.inState(rec, S.lldfCur(H, P, c, after, '')), 'none');
  assert.equal(S.inState(rec, S.lldfCur(H, P, c, after, '{')), 'unchecked', 'unreadable');
  // the design beam rule of the pull (HO-D5): the line shown when LL & DL has the bridge's girder count
  assert.equal(S.lldfBeam(P, c, inp, raw1), null, 'Nb 7 != 5'); deq(S.lldfBeam(P, c, inp, raw1.replace('"Nb":7', '"Nb":5')), { index: c.g, label: 'G' + c.g, clsLabel: inp.loads.pos === 'exterior' ? 'exterior' : 'interior' });
  // dlLoads
  const d1 = DLP('2026-11-21T09:10:00.000Z', 0.2345678), dr = H.dlResolve(d1), drec = { at: dr.at, sig: S.sig(H.dlTheirs(dr)) };
  assert.equal(S.inState(drec, S.dlCur(H, d1)), 'current');
  assert.equal(S.inState(drec, S.dlCur(H, DLP('2026-11-21T12:00:00.000Z', 0.2345678))), 'current');
  assert.equal(S.inState(drec, S.dlCur(H, DLP('2026-11-21T12:00:00.000Z', 0.25))), 'stale');
  // projectMeta: newer shared info that would change this project's title block
  const pm = (at, name) => JSON.stringify({ _schema: 'bridge-project-meta', schemaVersion: 1, producedAt: at, fields: Object.assign(H.pmFields(P), { projectName: name }) });
  const prec = { at: '2026-11-21T08:00:00.000Z', sig: 'same' };
  assert.equal(S.inState(prec, S.pmCur(H, P, pm('2026-11-21T08:00:00.000Z', P.project.name))), 'current');
  assert.equal(S.inState(prec, S.pmCur(H, P, pm('2026-11-21T13:00:00.000Z', P.project.name))), 'current', 'newer, nothing to change');
  assert.equal(S.inState(prec, S.pmCur(H, P, pm('2026-11-21T13:00:00.000Z', 'Another name'))), 'stale');
});

test('a project saved before (no P.handoffs): no record on any channel, so no banner', () => {
  const P = M.importJSON(M.exportJSON(M.newProject())).project;
  for (const id of S.OUT_IDS) assert.equal(S.outState(S.sentOf(P, id), 'anything'), 'unknown', id);
  for (const id of S.IN_IDS) assert.equal(S.inState(S.loadedOf(P, S.CH[id].rec || id), { at: 'x', sig: 'y' }), 'unknown', id);
  // the record survives Export / Import JSON (a project field)
  S.setSent(P, 'psSection', { sig: 'a', at: 'T' }); deq(M.importJSON(M.exportJSON(P)).project.handoffs, P.handoffs);
  deq(M.importJSON(M.exportJSON(P)).errors, []);
});
