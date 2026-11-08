// shared/github-sync.js LIVE (2026-11-08): auto-save decision, the open project's GitHub check (poll / compare / Load it / Undo) and
// presence (heartbeat files of the devices that have a project open). Node only, fetch mocked (tests/engine/gh-mock.mjs), fake time.
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';
import { makeGitHubMock } from './gh-mock.mjs';

const W = loadShared('projects.js', 'github-sync.js'), SP = W.SharedProjects, G = W.SharedGitHubSync;
const KEY = 'sfd_projects', TOKEN = 'github_pat_TESTTOKEN0123456789abcd';
function mem(init) {
  const m = new Map(Object.entries(init || {}));
  return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } };
}
const SETUP = { owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN };
const T0 = Date.parse('2026-11-08T19:32:00Z');
// one device = one browser storage; several engines on one storage = several tabs of that browser
function device(gh, name, { on = true, clock } = {}) {
  const s = mem(); if (on) assert.equal(G.saveSettings(s, { ...SETUP, device: name }).ok, true);
  const t = clock || { v: T0 };
  const tab = () => G.engine({ tool: 'spread-footing', label: 'Spread Footing', store: SP.mapStore(s, KEY), storage: s, fetch: gh.fetch, now: () => t.v });
  const e = tab();
  return { s, e, tab, store: SP.mapStore(s, KEY), t, tick: ms => { t.v += ms; } };
}
const P = n => `projects/spread-footing/${G.safeName(n)}.json`;
const ex = st => JSON.stringify(st, null, 1);
const puts = gh => gh.log.filter(l => l.method === 'PUT');
const trees = gh => gh.log.filter(l => /\/git\/trees\//.test(l.url));

test('live: autoSaveDue — only a named, saved, edited project whose inputs changed, after 5 s quiet and 30 s since the last save', () => {
  const base = { configured: true, on: true, name: 'Pier 3', inList: true, dirty: true, edited: true, snap: 'B', lastSnap: 'A', changedAt: 1000, lastAt: 0, now: 40000 };
  const why = x => G.autoSaveDue({ ...base, ...x }).why;
  assert.equal(why({}), 'due'); assert.equal(G.autoSaveDue(base).due, true);
  assert.equal(why({ configured: false }), 'off');
  assert.equal(why({ on: false }), 'disabled');
  assert.equal(why({ name: '' }), 'unnamed'); assert.equal(why({ inList: false }), 'unnamed');   // a brand-new unnamed project: never
  assert.equal(why({ dirty: false }), 'clean');
  assert.equal(why({ edited: false }), 'not-edited');   // e.g. unsaved work restored from the tool's autosave, not touched on this page
  assert.equal(why({ snap: 'A' }), 'same');             // this exact text was auto-saved already (a tool that never compares equal)
  assert.equal(why({ changedAt: 36000 }), 'typing');    // changed 4 s ago
  assert.equal(why({ changedAt: 35000 }), 'due');       // 5 s quiet
  assert.equal(why({ lastAt: 15000 }), 'wait');         // saved 25 s ago
  assert.equal(why({ lastAt: 10000 }), 'due');          // 30 s
});

test('live: pollDue / beatDue — hidden tab, sync off, watch off, unnamed, cadence, idle', () => {
  const b = { configured: true, on: true, name: 'X', inList: true, hidden: false, now: 100000, lastAt: 69000 };
  assert.equal(G.pollDue(b).why, 'due'); assert.equal(G.pollDue({ ...b, lastAt: 71000 }).why, 'wait');
  assert.equal(G.pollDue({ ...b, hidden: true }).why, 'hidden'); assert.equal(G.pollDue({ ...b, configured: false }).why, 'off');
  assert.equal(G.pollDue({ ...b, on: false }).why, 'disabled'); assert.equal(G.pollDue({ ...b, inList: false }).why, 'unnamed');
  const c = { ...b, lastAt: 39000, activeAt: 90000 };
  assert.equal(G.beatDue(c).why, 'due'); assert.equal(G.beatDue({ ...c, lastAt: 41000 }).why, 'wait');
  assert.equal(G.beatDue({ ...c, hidden: true }).why, 'hidden'); assert.equal(G.beatDue({ ...c, activeAt: 100000 - 600001 }).why, 'idle');
  assert.equal(G.LIVE.every, 30000); assert.equal(G.LIVE.poll, 30000); assert.equal(G.LIVE.beat, 60000); assert.equal(G.LIVE.stale, 150000);
});

test('live: presenceFresh — 150 s from the heartbeat; a device whose clock is wrong still goes stale once it stops', () => {
  const now = 1000000;
  assert.equal(G.presenceFresh({ at: now - 60000, seenAt: now - 20000, changed: false }, now), true);
  assert.equal(G.presenceFresh({ at: now - 151000, seenAt: now - 1000, changed: false }, now), false);   // an old file found now: stale
  assert.equal(G.presenceFresh({ at: now - 140000, seenAt: now - 140000, changed: true }, now), true);
  assert.equal(G.presenceFresh({ at: now + 3600000, seenAt: now - 151000, changed: true }, now), false);   // clock 1 h ahead, stopped writing
  assert.equal(G.presenceFresh({ at: now - 3600000, seenAt: now - 30000, changed: true }, now), true);    // clock 1 h behind, still writing
  assert.equal(G.presenceFresh({ at: now - 3600000, seenAt: now - 30000, changed: false }, now), false);  // ... but its first sighting is not trusted
  assert.equal(G.presenceFresh(null, now), false);
});

test('live: settings — both on by default; new keys only; nothing written while sync is off', async () => {
  const gh = makeGitHubMock();
  const off = device(gh, 'Laptop', { on: false });
  assert.deepEqual({ ...G.live(off.s) }, { autoSave: true, watch: true });
  off.store.save('A', { x: 1 });
  for (const r of [await off.e.poll('A'), await off.e.beat('A'), await off.e.leave('A'), await off.e.others('A')]) assert.ok(r.ok === false || (r.list && !r.list.length));
  assert.equal(gh.log.length, 0); assert.deepEqual([...off.s.m.keys()], [KEY]);   // only the tool's own key
  assert.equal(G.deviceId(off.s, false), ''); assert.deepEqual([...off.s.m.keys()], [KEY]);
  const d = device(gh, 'Laptop');
  assert.equal(G.saveLive(d.s, { autoSave: false }), true); assert.deepEqual({ ...G.live(d.s) }, { autoSave: false, watch: true });
  assert.equal(d.s.getItem('bridgeSuite.v1.githubSync.live'), '{"v":1,"autoSave":false,"watch":true}');
  assert.equal(JSON.parse(d.s.getItem('bridgeSuite.v1.githubSync')).autoSave, undefined);   // the settings key keeps its format
  const id = G.deviceId(d.s, true); assert.match(id, /^[a-z0-9]{12}$/); assert.equal(G.deviceId(d.s, true), id);   // stable
  G.saveLive(d.s, { watch: false }); d.store.save('A', { x: 1 }); const n0 = gh.log.length;
  assert.equal((await d.e.poll('A')).kind, 'disabled'); assert.equal((await d.e.beat('A')).kind, 'disabled'); assert.equal(gh.log.length, n0);
});

test('live: auto-save path — an unchanged file text is not uploaded again (no commit spam); the commit names the device', async () => {
  const gh = makeGitHubMock(); const A = device(gh, 'Laptop');
  A.e.scan(); A.store.save('Pier 3', { B: 10 }); A.e.scan(); assert.equal((await A.e.flush()).done, 1);
  assert.equal(puts(gh).length, 1); assert.match(gh.commits.at(-1).message, /save "Pier 3" \(from Laptop\)$/);
  A.store.save('Pier 3', { B: 10 }); assert.equal(A.e.scan(), 0); await A.e.flush(); assert.equal(puts(gh).length, 1);   // same content: nothing sent
  A.store.save('Pier 3', { B: 11 }); assert.equal(A.e.scan(), 1); await A.e.flush(); assert.equal(puts(gh).length, 2);
});

test('live: poll — same / changed / both / gone / none / held; the tree is reused for 25 s; backoff is respected', async () => {
  const gh = makeGitHubMock(); gh.clock = () => A.t.v; const A = device(gh, 'Laptop');
  A.e.scan(); A.store.save('J', { a: 1 }); A.e.scan(); await A.e.flush();
  const t0 = trees(gh).length;
  assert.equal((await A.e.poll('J')).state, 'same'); assert.equal(trees(gh).length, t0);   // the upload's tree is reused
  A.tick(26000); assert.equal((await A.e.poll('J')).state, 'same'); assert.equal(trees(gh).length, t0 + 1);
  gh.setRemote(P('J'), ex({ a: 'desk' }), 'Spread Footing: save "J" (from Desktop)');
  A.tick(30000); const r = await A.e.poll('J'); assert.equal(r.state, 'changed'); assert.equal(r.cloudSha, gh.log && G.gitSha(ex({ a: 'desk' })));
  const who = await A.e.changeInfo('J', r.cloudSha); assert.equal(who.device, 'Desktop'); assert.equal(who.at, A.t.v - 30000);
  const nC = gh.log.length; await A.e.changeInfo('J', r.cloudSha); assert.equal(gh.log.length, nC);   // one request per new sha
  A.store.save('J', { a: 2 }); A.tick(30000); assert.equal((await A.e.poll('J')).state, 'both');
  A.store.save('Loc', { a: 1 }); A.e.hold('Loc', true); A.tick(30000); assert.equal((await A.e.poll('Loc')).state, 'held');
  A.e.hold('Loc', false); A.tick(30000); assert.equal((await A.e.poll('Loc')).state, 'none');
  A.store.save('K', { k: 1 }); A.e.scan(); await A.e.flush(true, true); gh.files.delete(P('K')); A.tick(30000); assert.equal((await A.e.poll('K')).state, 'gone');
  gh.rate = true; A.tick(30000); const rr = await A.e.poll('K'); assert.equal(rr.kind, 'rate');
  A.t.v = A.e.nextTry() - 1000; const n0 = gh.log.length; assert.equal((await A.e.poll('K')).waiting, true); assert.equal(gh.log.length, n0);   // backoff until the reset GitHub gave
  gh.rate = false; assert.equal((await A.e.poll('K', { force: true })).ok, true);
  gh.offline = true; A.tick(30000); assert.equal((await A.e.poll('K', { maxAge: 0 })).kind, 'offline'); gh.offline = false;
  A.tick(31000); assert.equal((await A.e.poll('K')).ok, true); assert.equal(A.e.lastError(), null);   // reachable again
});

test('live: Load it then Undo (no unsaved edits here) — the previous version back, nothing uploaded, status as before', async () => {
  const gh = makeGitHubMock(); const A = device(gh, 'Laptop');
  A.e.scan(); A.store.save('J', { a: 1 }); A.e.scan(); await A.e.flush();
  gh.setRemote(P('J'), ex({ a: 'desk' }), 'Spread Footing: save "J" (from Desktop)');
  A.tick(30000); assert.equal((await A.e.poll('J')).state, 'changed');
  const nPut = puts(gh).length;
  const L = await A.e.loadCloud('J'); assert.equal(L.ok, true); assert.equal(L.copy, undefined);
  assert.deepEqual(JSON.parse(A.s.getItem(KEY)).J, { a: 'desk' }); assert.equal(A.e.statusOf('J'), 'synced');
  assert.equal(Object.keys(JSON.parse(A.s.getItem(KEY))).length, 1);   // the previous version was synced: no copy needed
  const U = A.e.undoLoad(L.undo); assert.equal(U.ok, true);
  assert.deepEqual(JSON.parse(A.s.getItem(KEY)).J, { a: 1 });
  await A.e.refreshCloud(); assert.equal(A.e.statusOf('J'), 'cloud-newer');
  assert.equal(A.e.scan(), 0); await A.e.flush(); assert.equal(puts(gh).length, nPut);   // nothing uploaded
  assert.equal(gh.files.get(P('J')), ex({ a: 'desk' }));
  A.tick(30000); assert.equal((await A.e.poll('J')).state, 'changed');   // the banner can be offered again
});

test('live: simultaneous edits on two devices — conflict copy, nothing lost; Load it then Undo keeps every version', async () => {
  const gh = makeGitHubMock(); const A = device(gh, 'Laptop'), B = device(gh, 'Desktop', { clock: A.t });
  A.e.scan(); A.store.save('J', { a: 0 }); A.e.scan(); await A.e.flush();
  B.e.scan(); assert.equal((await B.e.download('J')).ok, true);
  B.store.save('J', { a: 'B' }); B.e.scan(); await B.e.flush();          // B auto-saves first
  A.store.save('J', { a: 'A' }); A.e.scan(); await A.e.flush();          // then A: GitHub changed since A's sync -> both kept
  const cn = Object.keys(JSON.parse(A.s.getItem(KEY))).find(n => n.startsWith('J (conflict Laptop'));
  assert.ok(cn); assert.equal(gh.files.get(P(cn)), ex({ a: 'A' })); assert.equal(gh.files.get(P('J')), ex({ a: 'B' }));
  A.tick(30000); assert.equal((await A.e.poll('J')).state, 'both');
  const L = await A.e.loadCloud('J'); assert.equal(L.ok, true);
  assert.deepEqual(JSON.parse(A.s.getItem(KEY)).J, { a: 'B' }); assert.equal(Object.keys(JSON.parse(A.s.getItem(KEY))).filter(n => /conflict/.test(n)).length, 1);   // no second copy
  assert.equal(A.e.undoLoad(L.undo).ok, true);
  assert.deepEqual(JSON.parse(A.s.getItem(KEY)).J, { a: 'A' }); assert.equal(A.e.statusOf('J'), 'conflict');
  A.e.scan(); await A.e.flush(true);
  const all = [...gh.files.values()].concat(Object.values(JSON.parse(A.s.getItem(KEY))).map(ex));
  for (const v of ['A', 'B']) assert.ok(all.includes(ex({ a: v })), v);   // every version is somewhere
  assert.equal(gh.files.get(P('J')), ex({ a: 'B' }));   // GitHub's J was never overwritten
});

test('live: a commit refused because the branch moved (file unchanged) is sent once more — no false conflict copy', async () => {
  const gh = makeGitHubMock(); const A = device(gh, 'Laptop');
  A.e.scan(); A.store.save('J', { a: 1 }); A.e.scan(); await A.e.flush();
  const h0 = gh.handle; let once = true;
  gh.handle = (mth, url, hd, body) => { if (mth === 'PUT' && once && /J\.json/.test(url)) { once = false; return { status: 409, headers: { 'content-type': 'application/json' }, body: '{"message":"is at abc but expected def"}' }; } return h0(mth, url, hd, body); };
  A.store.save('J', { a: 2 }); A.e.scan(); const r = await A.e.flush();
  assert.equal(r.done, 1); assert.equal(gh.files.get(P('J')), ex({ a: 2 }));
  assert.equal(Object.keys(JSON.parse(A.s.getItem(KEY))).filter(n => /conflict/.test(n)).length, 0);
});

test('live: presence — the heartbeat file, once a minute per browser, seen by the other device, stale after 150 s, deleted on close', async () => {
  const gh = makeGitHubMock(); const A = device(gh, 'Work laptop'), B = device(gh, 'Work laptop', { clock: A.t });   // same device name, two browsers
  A.store.save('Pier 3', { B: 10 }); B.store.save('Pier 3', { B: 10 });
  const w = await A.e.beat('Pier 3'); assert.equal(w.ok, true);
  const idA = G.deviceId(A.s, false), path = `projects/spread-footing/.presence/Pier 3.${idA}.json`;
  assert.equal(w.path, path); assert.ok(gh.files.has(path));
  const f = JSON.parse(gh.files.get(path));
  assert.deepEqual(Object.keys(f), ['v', 'app', 'tool', 'project', 'device', 'id', 'since', 'at']);
  assert.equal(f.device, 'Work laptop'); assert.equal(f.id, idA); assert.equal(f.since, new Date(T0).toISOString()); assert.equal(f.app, 'presence');
  assert.ok(!gh.files.get(path).includes(TOKEN));
  assert.match(gh.commits.at(-1).message, /"Pier 3" open on Work laptop \(presence\)/);
  // a second tab of the same browser: no second file, no second write within the minute
  const A2 = A.tab(); const n0 = puts(gh).length; assert.equal((await A2.beat('Pier 3')).skipped, 'recent'); assert.equal(puts(gh).length, n0);
  A.tick(20000); assert.equal((await A.e.beat('Pier 3')).skipped, 'recent');
  // device B (another browser) sees A; its own id differs although the device name is the same
  B.e.scan(); await B.e.refreshCloud();
  const idB = G.deviceId(B.s, true); assert.notEqual(idB, idA);
  let p = await B.e.poll('Pier 3', { force: true, maxAge: 0 }); assert.equal(p.presence.length, 1);
  assert.equal(p.presence[0].fresh, true); assert.equal(p.presence[0].device, 'Work laptop'); assert.equal(p.presence[0].since, T0);
  assert.equal((await B.e.others('Pier 3')).list.length, 1);
  // the listing and Download ignore .presence/
  await B.e.refreshCloud(); assert.deepEqual([...B.e.cloud().keys()], []); assert.ok(B.e.rows().every(r => !/presence/.test(r.name)));
  // A writes again after a minute (update with the file's sha); B sees the sha change
  A.tick(41000); const w2 = await A.e.beat('Pier 3'); assert.equal(w2.ok, true); assert.equal(JSON.parse(gh.files.get(path)).since, new Date(T0).toISOString());
  assert.equal(JSON.parse(puts(gh).at(-1).body).sha, w.sha);
  A.tick(30000); p = await B.e.poll('Pier 3', { maxAge: 0 }); assert.equal(p.presence[0].fresh, true);
  // A stops (hidden tab / crash): stale after 150 s
  A.tick(100000); p = await B.e.poll('Pier 3', { maxAge: 0 }); assert.equal(p.presence[0].fresh, true);
  A.tick(60000); p = await B.e.poll('Pier 3', { maxAge: 0 }); assert.equal(p.presence[0].fresh, false);
  assert.equal((await B.e.others('Pier 3', { maxAge: 0 })).list.length, 0);
  // close: tab A2 still has it open -> kept; the last tab -> deleted
  A.tick(1000); await A2.beat('Pier 3'); await A.e.beat('Pier 3');
  assert.equal((await A.e.leave('Pier 3')).kept, true); assert.ok(gh.files.has(path));
  const d = await A2.leave('Pier 3'); assert.equal(d.ok, true); assert.ok(!gh.files.has(path));
  assert.ok(gh.log.filter(l => l.method === 'DELETE').every(l => !l.url.includes(TOKEN) && l.auth === `Bearer ${TOKEN}`));
  // the device's own heartbeat never counts as "another device"
  await B.e.beat('Pier 3'); A.tick(1000); assert.equal((await B.e.poll('Pier 3', { maxAge: 0 })).presence.length, 0);
});

test('live: presence file names never collide with project files or with other projects', async () => {
  const gh = makeGitHubMock(); const A = device(gh, 'Laptop'), B = device(gh, 'Desk', { clock: A.t });
  for (const n of ['A', 'A.b', '.presence', 'x/y']) { A.store.save(n, { n }); B.store.save(n, { n }); }
  await A.e.beat('A'); await A.e.beat('A.b', { force: true }); await A.e.beat('.presence', { force: true });
  assert.ok(gh.files.has(`projects/spread-footing/%2Epresence.json`) === false);
  A.e.scan(); await A.e.uploadAll(); assert.ok(gh.files.has('projects/spread-footing/%2Epresence.json'));   // the project, not the folder
  const pA = await B.e.poll('A', { force: true, maxAge: 0 }), pAb = await B.e.poll('A.b', { maxAge: 0 }), pX = await B.e.poll('x/y', { maxAge: 0 });
  assert.equal(pA.presence.length, 1); assert.equal(pAb.presence.length, 1); assert.equal(pX.presence.length, 0);
  await B.e.refreshCloud(); assert.deepEqual([...B.e.cloud().keys()].sort(), ['.presence', 'A', 'A.b', 'x/y']);
});
