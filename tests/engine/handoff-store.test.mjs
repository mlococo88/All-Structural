// shared/handoff-store.js (2026-11-09, HANDOFF.md §5.1): per-project copies of the hand-offs, uploaded to GitHub when Cloud sync is set up.
// Node only; GitHub is the in-memory mock (tests/engine/gh-mock.mjs) through fetch.
// Checks: project ids (safe, reversible, no '.', '/', '~' of their own, '' with no project, long names cut with a hash); write / local list
// (producer filter, legacy keys, corrupt and foreign copies reported, not listed); grouping newest first, duplicates once, "earlier hand-off
// (no project)"; match (bridgeId first, else name); sync off: no request and no new key; sync on: upload to handoffs/<channel>/<producer>/
// <project id>.json, update with the file's sha, offline -> queued and sent later; list merges a copy sent from another device and does not
// download a copy identical to this browser's.
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';
import { makeGitHubMock } from './gh-mock.mjs';

const W = loadShared('github-sync.js', 'handoff-store.js'), H = W.SharedHandoffStore, G = W.SharedGitHubSync;
const TOKEN = 'github_pat_TESTTOKEN0123456789abcd', SETUP = { owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: 'Laptop' };
function mem(init) {
  const m = new Map(Object.entries(init || {}));
  return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } };
}
const J = v => JSON.parse(JSON.stringify(v));
const pay = (name, bridgeId, at, extra) => ({ _schema: 'bridge-super-geometry', schemaVersion: 1, producer: 'Steel Bridge Design', producerFile: 'apps/steel-bridge/index.html',
  producedAt: at, project: { name, bridgeId }, units: { length: 'ft' }, notes: [], spans: [100], ...(extra || {}) });
const O = (s, extra) => ({ storage: s, channel: 'superGeometry', schema: 'bridge-super-geometry', maxVersion: 1, producers: null, sync: G, ...(extra || {}) });

test('handoff-store: project ids are safe and reversible; blank project -> no id; long names cut with a hash', () => {
  assert.equal(H.pidOf({ name: '  Route 9  over  Mill Brook ', bridgeId: 'B-12-034' }), 'B-12-034~Route 9 over Mill Brook');
  assert.equal(H.pidOf({ name: 'A.b/c~d', bridgeId: '' }), '~A%2Eb%2Fc%7Ed');
  assert.equal(decodeURIComponent('A%2Eb%2Fc%7Ed'), 'A.b/c~d');
  for (const n of ['ünïcødé ✓ 🌉', 'x (copy) 100%', 'a.b.c']) { const id = H.pidOf({ name: n }); assert.ok(!/[./]/.test(id) && id.split('~').length === 2, id); assert.equal(decodeURIComponent(id.split('~')[1]), n); }
  assert.equal(H.pidOf({ name: '', bridgeId: '  ' }), ''); assert.equal(H.pidOf(null), '');
  const long = H.pidOf({ name: 'x'.repeat(200) }); assert.equal(long.length, 100 + 2 + 8); assert.match(long, /~h[0-9a-f]{8}$/);
  assert.notEqual(H.pidOf({ name: 'x'.repeat(200) + 'a' }), long);
  assert.equal(H.copyKey('superGeometry', 'steelbridge', '~A'), 'bridgeSuite.v1.superGeometry.by.steelbridge.~A');
  assert.equal(H.cloudPath('superReactions', 'girderdetail', 'B1~A'), 'handoffs/superReactions/girderdetail/B1~A.json');
  assert.deepEqual(J(H.projectOf({ project: 'Old string project' })), { name: 'Old string project', bridgeId: '' });
  assert.equal(H.contentHash({ a: 1, b: [2, 3] }), H.fnv('{"a":1,"b":[2,3]}')); assert.match(H.fnv(''), /^811c9dc5$/);
});

test('handoff-store: write + local list; legacy keys; grouping newest first; duplicates once; no-project group; match', () => {
  const s = mem();
  const a1 = pay('Mill Brook', 'B-1', '2026-11-09T10:00:00.000Z'), a2 = pay('Mill Brook', 'B-1', '2026-11-09T12:00:00.000Z'), b = pay('Elm St', '', '2026-11-09T11:00:00.000Z');
  assert.equal(H.write(s, 'superGeometry', 'steelbridge', a1).pid, 'B-1~Mill Brook');
  H.write(s, 'superGeometry', 'girderdetail', a2); H.write(s, 'superGeometry', 'steelbridge', b);
  const old = pay('', '', '2026-11-01T09:00:00.000Z');
  s.setItem('bridgeSuite.v1.superGeometry', JSON.stringify(a2));                  // legacy channel key: the same payload as a per-project copy
  s.setItem('bridgeSuite.v1.superGeometry.by.steelbridge', JSON.stringify(old));  // legacy copy without a project
  s.setItem('bridgeSuite.v1.superGeometry.by.steelbridge.~Bad', '{not json');
  s.setItem('bridgeSuite.v1.superGeometry.by.steelbridge.~Other', JSON.stringify({ _schema: 'bridge-super-reactions', schemaVersion: 1 }));
  s.setItem('bridgeSuite.v1.superGeometry.adopted.subloads', 'x'); s.setItem('bridgeSuite.v1.superGeometry.updatedAt', 'x');
  const legacy = [{ key: 'bridgeSuite.v1.superGeometry', via: 'latest hand-off' }, { key: 'bridgeSuite.v1.superGeometry.by.steelbridge', via: 'copy from steelbridge' }];
  const L = H.local(O(s, { legacy }));
  assert.equal(L.entries.length, 5); assert.equal(L.errors.length, 2); assert.match(L.errors.join(';'), /corrupt/); assert.match(L.errors.join(';'), /wrong data type/);
  const gs = H.group(L.entries);
  assert.deepEqual(J(gs.map(g => g.label)), ['B-1 — Mill Brook', 'Elm St', 'earlier hand-off (no project)']);
  assert.deepEqual(J(gs[0].entries.map(e => [e.producer, e.payload.producedAt, e.source])), [['girderdetail', a2.producedAt, 'local'], ['steelbridge', a1.producedAt, 'local']]);   // legacy duplicate of a2 dropped
  assert.equal(gs[2].noProject, true); assert.equal(gs[2].newest.source, 'legacy');
  assert.equal(H.local(O(s, { producers: ['girderdetail'] })).entries.length, 1);
  assert.equal(H.match(gs, { name: 'elm st', bridgeId: '' }), '~Elm St');
  assert.equal(H.match(gs, { name: 'Elm St', bridgeId: 'b-1' }), 'B-1~Mill Brook');   // bridgeId first
  assert.equal(H.match(gs, { name: 'Mill Brook', bridgeId: 'B-9' }), 'B-1~Mill Brook'); // no bridgeId match: the name
  assert.equal(H.match(gs, { name: 'Nowhere' }), null); assert.equal(H.match(gs, {}), null);
  // a payload without a project: no per-project copy
  const w = H.write(s, 'superGeometry', 'steelbridge', pay('', '', '2026-11-09T13:00:00.000Z')); assert.equal(w.pid, ''); assert.equal(w.key, null);
  assert.equal(H.write(s, 'super.Geometry', 'steelbridge', a1).ok, false);
});

test('handoff-store: sync off -> no request, no GitHub key; send writes only the per-project copy', async () => {
  const s = mem(), gh = makeGitHubMock();
  const r = await H.send({ storage: s, channel: 'superGeometry', producer: 'steelbridge', payload: pay('Mill Brook', 'B-1', '2026-11-09T10:00:00.000Z'), fetch: gh.fetch, sync: G });
  assert.equal(r.ok, true); assert.equal(r.cloud.skipped, true); assert.equal(gh.log.length, 0);
  assert.deepEqual(J([...s.m.keys()]), ['bridgeSuite.v1.superGeometry.by.steelbridge.B-1~Mill Brook']);
  const l = await H.list(O(s, { fetch: gh.fetch })); assert.equal(l.cloud, 'off'); assert.equal(l.groups.length, 1); assert.equal(gh.log.length, 0);
  assert.equal(H.deviceName(s, G), '');
});

test('handoff-store: sync on -> upload, update with sha, offline queued then sent; another device\'s copy merged; identical copy not downloaded', async () => {
  const s = mem(), gh = makeGitHubMock(); assert.equal(G.saveSettings(s, SETUP).ok, true); assert.equal(H.deviceName(s, G), 'Laptop');
  const p1 = pay('Mill Brook', 'B-1', '2026-11-09T10:00:00.000Z', { device: 'Laptop' }), o = { storage: s, channel: 'superGeometry', producer: 'steelbridge', fetch: gh.fetch, sync: G };
  const r1 = await H.send({ ...o, payload: p1 }); assert.deepEqual(J(r1.cloud), { ok: true });
  const path = 'handoffs/superGeometry/steelbridge/B-1~Mill Brook.json';
  assert.equal(gh.files.get(path), H.fileText(p1)); assert.match(gh.commits.at(-1).message, /^Hand-off superGeometry from steelbridge: "Mill Brook" \(from Laptop\)$/);
  const p2 = { ...p1, producedAt: '2026-11-09T11:00:00.000Z', spans: [120] };
  assert.deepEqual(J((await H.send({ ...o, payload: p2 })).cloud), { ok: true }); assert.equal(gh.files.get(path), H.fileText(p2));
  assert.ok(gh.log.every(x => x.url.indexOf(TOKEN) < 0));
  // offline: kept here, queued, sent at the next send / list
  gh.offline = true; const p3 = { ...p2, producedAt: '2026-11-09T12:00:00.000Z', spans: [130] };
  const r3 = await H.send({ ...o, payload: p3 }); assert.equal(r3.ok, true); assert.equal(r3.cloud.queued, true);
  assert.deepEqual(J(H.pending(s)), [{ channel: 'superGeometry', producer: 'steelbridge', pid: 'B-1~Mill Brook' }]);
  gh.offline = false;
  // another device sent project "Elm St" (and an unrelated file in the folder)
  const pe = pay('Elm St', '', '2026-11-09T12:30:00.000Z', { device: 'Office PC' });
  gh.setRemote('handoffs/superGeometry/steelbridge/~Elm St.json', H.fileText(pe)); gh.setRemote('handoffs/superGeometry/readme.txt', 'x');
  const n0 = gh.log.length;
  const l = await H.list(O(s, { fetch: gh.fetch }));
  assert.equal(l.cloud, 'ok'); assert.deepEqual(J(l.errors), []);
  assert.equal(gh.files.get(path), H.fileText(p3)); assert.deepEqual(J(H.pending(s)), []);   // the queued copy went first
  assert.deepEqual(J(l.groups.map(g => [g.label, g.newest.source, g.newest.payload.device])), [['Elm St', 'github', 'Office PC'], ['B-1 — Mill Brook', 'local', 'Laptop']]);   // newest first
  assert.equal(l.groups[1].newest.synced, true);
  const raws = gh.log.slice(n0).filter(x => /\/contents\//.test(x.url) && x.method === 'GET').map(x => decodeURIComponent(x.url));
  assert.equal(raws.length, 1); assert.match(raws[0], /~Elm St\.json/);   // this browser's identical copy is not downloaded
  // a corrupt GitHub file is reported, not listed
  gh.setRemote('handoffs/superGeometry/girderdetail/~Bad.json', '{x');
  const l2 = await H.list(O(s, { fetch: gh.fetch })); assert.equal(l2.groups.length, 2); assert.match(l2.errors.join(';'), /girderdetail\/~Bad: not valid JSON/);
  // producers filter applies to GitHub too
  const l3 = await H.list(O(s, { fetch: gh.fetch, producers: ['girderdetail'] })); assert.equal(l3.groups.length, 0);
});
