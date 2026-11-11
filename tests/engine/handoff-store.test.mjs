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

/* a §4.14 payload of the Steel Bridge app's default bridge (3 spans 110-140-110 ft, 5 girders at 9.5 ft) */
function geo() {
  const p = { _schema: 'bridge-super-geometry', schemaVersion: 1, producer: 'Steel Bridge Design', producerFile: 'apps/steel-bridge/index.html', producedAt: '2026-11-09T10:00:00.000Z',
    project: { name: 'New steel bridge', bridgeId: '' }, units: { length: 'ft', skew: 'deg', deck: 'in', section: 'in', curb: 'in', height: 'in' }, notes: [],
    spans: [110, 140, 110], continuity: 'continuous',
    supports: [0, 110, 250, 360].map((x, k) => ({ id: k === 0 ? 'Abut. 1' : k === 3 ? 'Abut. 2' : `Pier ${k}`, x, skew: 0, joint: k === 0 || k === 3 ? 'end' : 'continuous', depth: k === 0 || k === 3 ? 61.875 : 63.5 })),
    girders: { count: 5, spacings: [9.5, 9.5, 9.5, 9.5], ohL: 3.25, ohR: 3.25 },
    edges: { L: { type: 'barrier', width: 1.5, height: null }, R: { type: 'barrier', width: 1.5, height: null } },
    deck: { ts: 8, total: 8.5, haunch: 2 }, section: { depth: 63.5, bf: 18, tf: 2, tw: 0.5625, atSupports: [61.875, 63.5, 63.5, 61.875], spanMax: [63.5, 63.5, 63.5] } };
  p.contentHash = H.geometryHash(p); return p;
}
test('handoff-store: checkGeometry accepts a §4.14 payload and refuses bad units, counts and numbers; summary lines', () => {
  const p = geo(), ok = H.checkGeometry(p); assert.equal(ok.ok, true, ok.errors.join('; ')); assert.deepEqual(J(ok.warnings), []);
  assert.equal(H.summary('superGeometry', p), '3 spans, 110–140–110 ft, 5 girders');
  const bad = (f, rx) => { const q = geo(); f(q); const r = H.checkGeometry(q); assert.equal(r.ok, false); assert.match(r.errors.join('; '), rx); };
  bad(q => { q.units.length = 'm'; }, /unit of length is "m"; expected ft/);
  bad(q => { q.spans[1] = -5; }, /every span must be a positive/);
  bad(q => { q.supports.pop(); }, /expected 4 \(one more than the spans\), got 3/);
  bad(q => { q.supports[1].skew = 'x'; }, /Pier 1: skew must be a number/);
  bad(q => { q.supports[1].joint = 'hinge'; }, /joint must be end, continuous or joint/);
  bad(q => { q.supports[2].bearings = { long: 'fixed', trans: 'guided' }; }, /bearings must be/);
  bad(q => { q.girders.spacings.pop(); }, /expected 4 positive spacings/);
  bad(q => { q.edges.R.width = null; }, /edges.R.width/);
  bad(q => { q.deck.ts = 0; }, /deck.ts/);
  bad(q => { q.section.tw = NaN; }, /section.tw/);
  bad(q => { q._schema = 'bridge-super-reactions'; }, /wrong data type/);
  bad(q => { q.schemaVersion = 2; }, /newer format/);
  const q = geo(); q.supports[1].bearings = { long: 'fixed', trans: 'fixed' }; q.contentHash = H.geometryHash(q); assert.equal(H.checkGeometry(q).ok, true);
  const e = geo(); e.spans[0] = 111; const r = H.checkGeometry(e); assert.equal(r.ok, true); assert.match(r.warnings.join(''), /content hash does not match/);
  assert.equal(H.summary('superReactions', { supports: [{ girders: [{ label: 'G1' }, { label: 'G2' }] }, { girders: [{ label: 'G1' }, { label: 'G2' }] }], span: { length: 120 }, allGirders: true }), 'reactions at 2 supports, 120 ft, 2 girders');
  assert.equal(H.summary('superGeometry', {}), '');
});

/* FPU (2026-11-11): per-unit copies (.by.<producer>.<pid>.<unit id>), unitKey / pickDefault / newerOfUnit, and their GitHub path */
const fpay = (name, bridgeId, at, unitIndex, label, producer) => ({ _schema: 'bridge-foundation-loads', schemaVersion: 1, producer: producer || 'Bridge Substructure Loading',
  producedAt: at, project: { name, bridgeId }, units: { force: 'kip' }, notes: [], element: { type: 'pier', label, ...(unitIndex == null ? {} : { unitIndex }) }, cases: [] });
const FO = (s, extra) => ({ storage: s, channel: 'foundationLoads', schema: 'bridge-foundation-loads', maxVersion: 1, producers: null, sync: G, ...(extra || {}) });
test('handoff-store: per-unit copies listed as their own entries in the project group; unit copy before the project copy of the same send', () => {
  const s = mem();
  assert.equal(H.unitId('support-2'), 'support-2'); assert.equal(H.unitId(' Abut.  1 '), 'Abut%2E 1'); assert.ok(!/[./~]/.test(H.unitId('a.b/c~d')));
  const lu = H.unitId('x'.repeat(100)); assert.equal(lu.length, 50 + 2 + 8); assert.match(lu, /_h[0-9a-f]{8}$/);
  assert.equal(H.copyKey('foundationLoads', 'subloads', 'B-1~A', 'support-2'), 'bridgeSuite.v1.foundationLoads.by.subloads.B-1~A.support-2');
  assert.equal(H.cloudPath('foundationLoads', 'subloads', 'B-1~A', 'support-2'), 'handoffs/foundationLoads/subloads/B-1~A.support-2.json');
  const p1 = fpay('A', 'B-1', '2026-11-11T10:00:00.000Z', 1, 'Pier 1'), p2 = fpay('A', 'B-1', '2026-11-11T11:00:00.000Z', 2, 'Pier 2'), p1b = fpay('A', 'B-1', '2026-11-11T09:00:00.000Z', 1, 'Pier 1');
  assert.equal(H.write(s, 'foundationLoads', 'subloads', p1b, 'support-2').key, 'bridgeSuite.v1.foundationLoads.by.subloads.B-1~A.support-2');
  const w1 = H.write(s, 'foundationLoads', 'subloads', p1, 'support-2'); assert.deepEqual([w1.pid, w1.unit], ['B-1~A', 'support-2']);   // replaces p1b
  H.write(s, 'foundationLoads', 'subloads', p2, 'support-3'); H.write(s, 'foundationLoads', 'subloads', p2);   // + the project copy (last unit), same payload
  assert.equal(H.write(s, 'foundationLoads', 'subloads', p2, 'bad.unit').ok, false);
  const L = H.local(FO(s)); assert.equal(L.entries.length, 3);
  const gs = H.group(L.entries); assert.equal(gs.length, 1);
  assert.deepEqual(J(gs[0].entries.map(e => [e.unit, e.payload.element.label])), [['support-3', 'Pier 2'], ['support-2', 'Pier 1']]);   // the project copy of p2 listed once (as the unit copy)
  // unitKey: producer + unitIndex, else label; works on a receiver's saved record too
  assert.equal(H.unitKey(p1), 'Bridge Substructure Loading|#1'); assert.equal(H.unitKey({ producer: 'Abutment Calculator', element: { label: ' Br  A ' } }), 'Abutment Calculator|Lbr a'); assert.equal(H.unitKey({}), '');
  // pickDefault: the unit last pulled into the open project, else its newest; newerOfUnit per unit
  assert.equal(H.pickDefault(gs, { name: 'A', bridgeId: 'B-1' }, { producer: p1.producer, project: p1.project, element: p1.element }).entry.payload.element.label, 'Pier 1');
  assert.equal(H.pickDefault(gs, { name: 'A', bridgeId: 'B-1' }, { producer: p1.producer, project: p1.project, element: p1.element }).how, 'unit');
  const d = H.pickDefault(gs, { name: 'A', bridgeId: '' }, null); assert.equal(d.how, 'project'); assert.equal(d.entry.payload.element.label, 'Pier 2');
  assert.equal(H.pickDefault(gs, { name: 'A', bridgeId: 'B-1' }, { producer: p1.producer, project: { name: 'Other' }, element: p1.element }).how, 'project');   // last pull was another project
  assert.equal(H.pickDefault(gs, { name: 'Z' }, null), null);
  assert.equal(H.newerOfUnit(gs, gs[0].entries[1]), null);   // Pier 1 is not "older" than Pier 2
  const old = { ...gs[0].entries[1], payload: p1b }; assert.equal(H.newerOfUnit(gs, old).payload.producedAt, p1.producedAt);
});
test('handoff-store: per-unit copies upload to <pid>.<unit>.json, queue by copy id, merge from GitHub with their unit', async () => {
  const s = mem(), gh = makeGitHubMock(); assert.equal(G.saveSettings(s, SETUP).ok, true);
  const o = { storage: s, channel: 'foundationLoads', producer: 'subloads', fetch: gh.fetch, sync: G };
  const p1 = fpay('A', 'B-1', '2026-11-11T10:00:00.000Z', 1, 'Pier 1');
  const r1 = await H.send({ ...o, payload: p1, unit: 'support-2' }); assert.deepEqual(J(r1.cloud), { ok: true }); assert.equal(r1.unit, 'support-2');
  assert.equal(gh.files.get('handoffs/foundationLoads/subloads/B-1~A.support-2.json'), H.fileText(p1));
  gh.offline = true; const p2 = fpay('A', 'B-1', '2026-11-11T11:00:00.000Z', 2, 'Pier 2');
  assert.equal((await H.send({ ...o, payload: p2, unit: 'support-3' })).cloud.queued, true);
  assert.deepEqual(J(H.pending(s)), [{ channel: 'foundationLoads', producer: 'subloads', pid: 'B-1~A.support-3' }]);
  gh.offline = false;
  const pr = fpay('A', 'B-1', '2026-11-11T12:00:00.000Z', null, 'A', 'Abutment Calculator');
  gh.setRemote('handoffs/foundationLoads/abutment/B-1~A.Abut%2E 1.json', H.fileText(pr));
  const l = await H.list(FO(s, { fetch: gh.fetch }));
  assert.equal(l.cloud, 'ok'); assert.deepEqual(J(H.pending(s)), []); assert.equal(gh.files.get('handoffs/foundationLoads/subloads/B-1~A.support-3.json'), H.fileText(p2));
  assert.equal(l.groups.length, 1);
  assert.deepEqual(J(l.groups[0].entries.map(e => [e.source, e.producer, e.unit])), [['github', 'abutment', 'Abut%2E 1'], ['local', 'subloads', 'support-3'], ['local', 'subloads', 'support-2']]);
  assert.ok(l.groups[0].entries.slice(1).every(e => e.synced));
});
