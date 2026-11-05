// shared/github-sync.js (GHS, 2026-11-05): the saved-project list copied to a private GitHub repository. Node only, fetch mocked
// (tests/engine/gh-mock.mjs, an in-memory GitHub contents API with real git blob shas).
// Checks: nothing happens while sync is off; file names round trip; git blob sha and base64 match node:crypto / Buffer; save and
// update with the file's sha; a change on GitHub and here -> both kept ("<name> (conflict <device> <date>)"), nothing overwritten;
// 409 / 422 from GitHub -> both kept; list / status; cloud-only download; offline queue; rate limit; explicit cloud delete only;
// the token never in a URL, a message, the tool's list or the state key; mask(); the tool's own key and item format unchanged.
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';
import { makeGitHubMock, gitBlobSha } from './gh-mock.mjs';

const W = loadShared('projects.js', 'github-sync.js'), SP = W.SharedProjects, G = W.SharedGitHubSync;
const KEY = 'sfd_projects', TOKEN = 'github_pat_TESTTOKEN0123456789abcd';
function mem(init) {
  const m = new Map(Object.entries(init || {}));
  return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } };
}
const SETUP = { owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: 'Laptop' };
function rig(init, { on = true, gh } = {}) {
  const s = mem(init); gh = gh || makeGitHubMock();
  if (on) assert.equal(G.saveSettings(s, SETUP).ok, true);
  const store = SP.mapStore(s, KEY); let t = Date.parse('2026-11-05T19:32:00Z');
  const notices = [];
  const e = G.engine({ tool: 'spread-footing', label: 'Spread Footing', store, storage: s, fetch: gh.fetch, now: () => t, onNotice: n => notices.push(n) });
  return { s, gh, store, e, notices, tick: ms => { t += ms; } };
}
const J = v => JSON.parse(JSON.stringify(v));
const P = n => `projects/spread-footing/${G.safeName(n)}.json`;
const exportText = state => JSON.stringify(state, null, 1);   // Spread Footing's Export JSON

test('github-sync: off -> no request, no new key, nothing queued', async () => {
  const { s, gh, store, e } = rig({ [KEY]: '{"A":{"x":1}}' }, { on: false });
  const before = new Map(s.m);
  store.save('B', { y: 2 }); assert.equal(e.scan(), 0); assert.deepEqual((await e.flush()).skipped, true);
  assert.equal(gh.log.length, 0);
  assert.deepEqual([...s.m.keys()], [...before.keys()]);   // only the tool's own key
  assert.equal(s.getItem(KEY), '{"A":{"x":1},"B":{"y":2}}');
});

test('github-sync: safe file names round trip; git sha and base64 agree with node:crypto / Buffer', () => {
  for (const n of ['Footing A', 'Br. 12/3 "abut" : x?', 'ünïcødé ✓ 🌉', ' lead', 'trail.', '100%', 'a+b&c (copy 2)']) {
    const f = G.safeName(n) + '.json';
    assert.equal(G.nameOf(f), n, n); assert.doesNotMatch(f, /[\/\\:*?"<>|]/, f);
  }
  assert.equal(G.safeName('Footing A'), 'Footing A'); assert.equal(G.safeName('a/b'), 'a%2Fb'); assert.equal(G.nameOf('README.md'), null);
  for (const t of ['', 'x', '{"a":1}', 'ü✓🌉\n'.repeat(50), 'z'.repeat(70000)]) {
    assert.equal(G.gitSha(t), gitBlobSha(t)); assert.equal(G.b64(t), Buffer.from(t, 'utf8').toString('base64')); assert.equal(G.unb64(G.b64(t)), t);
  }
  assert.equal(G.gitSha(''), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');   // git hash-object of an empty file
});

test('github-sync: settings in one key; token masked; bad input refused; forget token', () => {
  const s = mem();
  assert.equal(G.saveSettings(s, { ...SETUP, owner: 'bad owner' }).ok, false);
  assert.equal(G.saveSettings(s, { ...SETUP, token: 'has space x' }).ok, false);
  assert.equal(G.saveSettings(s, { ...SETUP, branch: '../x' }).ok, false);
  assert.equal(G.saveSettings(s, SETUP).ok, true);
  assert.deepEqual([...s.m.keys()], ['bridgeSuite.v1.githubSync']);
  assert.equal(G.saveSettings(s, { ...SETUP, token: '' }).ok, true); assert.equal(G.settings(s).token, TOKEN);   // blank keeps it
  const mk = G.mask(TOKEN); assert.equal(mk, 'github_pat_••••••••abcd'); assert.ok(!mk.includes('TESTTOKEN'));
  assert.equal(G.forgetToken(s), true); assert.equal(G.settings(s).token, ''); assert.equal(G.configured(G.settings(s)), false);
  assert.equal(G.settings(s).owner, 'mlococo88');
});

test('github-sync: first connect records existing projects; Upload all; save; update with sha; tool format unchanged', async () => {
  const raw0 = '{"Footing A":{"B":8,"L":10},"Footing B":{"B":6,"L":6}}';
  const { s, gh, store, e } = rig({ [KEY]: raw0 });
  assert.equal(e.scan(), 0); assert.equal(e.state().asked, false);   // existing: not uploaded until the user says so
  assert.equal((await e.flush()).done, 0); assert.equal(gh.log.length, 0);
  const r = await e.uploadAll(); assert.equal(r.ok, true); assert.equal(r.done, 2);
  assert.equal(gh.files.get(P('Footing A')), exportText({ B: 8, L: 10 }));   // the tool's Export JSON format
  assert.equal(s.getItem(KEY), raw0);                                          // the tool's list is untouched
  // a new save is uploaded
  store.save('Footing C', { B: 9, L: 9 }); assert.equal(e.scan(), 1); assert.equal((await e.flush()).done, 1);
  assert.match(gh.commits.at(-1).message, /^Spread Footing: save "Footing C"$/);
  // an update goes with the file's sha (PUT body.sha = the blob sha GitHub has)
  const sha0 = gitBlobSha(gh.files.get(P('Footing A')));
  store.save('Footing A', { B: 8.5, L: 10 }); e.scan(); assert.equal((await e.flush()).done, 1);
  const put = gh.log.filter(l => l.method === 'PUT').at(-1); assert.equal(JSON.parse(put.body).sha, sha0);
  assert.equal(gh.files.get(P('Footing A')), exportText({ B: 8.5, L: 10 }));
  await e.refreshCloud();
  assert.deepEqual(J(e.rows().map(x => [x.name, x.status])), [['Footing A', 'synced'], ['Footing B', 'synced'], ['Footing C', 'synced']]);
  assert.equal(s.getItem(KEY), '{"Footing A":{"B":8.5,"L":10},"Footing B":{"B":6,"L":6},"Footing C":{"B":9,"L":9}}');
});

test('github-sync: changed on GitHub AND here -> both kept as "<name> (conflict ...)", nothing overwritten, user told', async () => {
  const { s, gh, store, e, notices } = rig({});
  e.scan(); store.save('Pier 3', { B: 10 }); e.scan(); await e.flush();
  const theirs = exportText({ B: 12, by: 'desktop' }); gh.setRemote(P('Pier 3'), theirs);   // another device saved
  store.save('Pier 3', { B: 11 }); e.scan(); const r = await e.flush();
  assert.equal(r.ok, true);
  assert.equal(gh.files.get(P('Pier 3')), theirs);                                        // GitHub's version not overwritten
  const cn = 'Pier 3 (conflict Laptop 2026-11-05 1432)';
  assert.equal(gh.files.get(P(cn)), exportText({ B: 11 }));                                // ours kept on GitHub
  assert.deepEqual(JSON.parse(s.getItem(KEY))[cn], { B: 11 }); assert.deepEqual(JSON.parse(s.getItem(KEY))['Pier 3'], { B: 11 });   // and here
  assert.equal(notices.at(-1).kind, 'conflict'); assert.match(notices.at(-1).text, /Both are kept/);
  await e.refreshCloud(); assert.equal(e.statusOf('Pier 3'), 'conflict'); assert.equal(e.statusOf(cn), 'synced');
  // no retry loop: another flush does not upload or copy again
  const n0 = gh.log.length; e.scan(); await e.flush(true); assert.equal(gh.log.length, n0);
  // resolve: Use GitHub version (ours is already kept as the copy: no second copy)
  assert.equal((await e.useCloud('Pier 3')).ok, true);
  assert.deepEqual(JSON.parse(s.getItem(KEY))['Pier 3'], { B: 12, by: 'desktop' }); assert.equal(Object.keys(JSON.parse(s.getItem(KEY))).length, 2);
  assert.equal(e.statusOf('Pier 3'), 'synced');
});

test('github-sync: 409 / 422 from GitHub on the PUT itself -> both kept', async () => {
  const { s, gh, store, e } = rig({});
  e.scan(); store.save('W1', { a: 1 }); e.scan(); await e.flush();
  // the file changes between our check and our PUT: GitHub answers 409 to the stale sha
  const h0 = gh.handle; let once = true;
  gh.handle = (mth, url, hd, body) => { if (mth === 'PUT' && once) { once = false; gh.setRemote(P('W1'), exportText({ a: 'remote' })); } return h0(mth, url, hd, body); };
  store.save('W1', { a: 2 }); e.scan(); await e.flush();
  assert.ok(gh.log.some(l => l.method === 'PUT' && JSON.parse(l.body).message.includes('save "W1"')));
  assert.equal(gh.files.get(P('W1')), exportText({ a: 'remote' }));
  const copies = Object.keys(JSON.parse(s.getItem(KEY))).filter(n => n.startsWith('W1 (conflict')); assert.equal(copies.length, 1);
  assert.equal(gh.files.get(P(copies[0])), exportText({ a: 2 }));
  // a file that exists on GitHub but was never synced here (same name made on two devices; 422 "sha wasn't supplied" path is never reached)
  gh.setRemote(P('Same'), exportText({ z: 'there' })); store.save('Same', { z: 'here' }); e.scan(); await e.flush();
  assert.equal(gh.files.get(P('Same')), exportText({ z: 'there' }));
  assert.ok(Object.keys(JSON.parse(s.getItem(KEY))).some(n => n.startsWith('Same (conflict')));
  // the client itself maps 422 "sha wasn't supplied" to a conflict
  const c = G.client(G.settings(s), gh.fetch); const r = await c.put(P('Same'), 'x', null, 'm'); assert.equal(r.ok, false); assert.equal(r.kind, 'conflict');
});

test('github-sync: list / statuses; cloud only -> download in the tool format; GitHub newer', async () => {
  const { s, gh, store, e } = rig({});
  e.scan(); store.save('Local 1', { k: 1 }); e.scan(); await e.flush();
  gh.setRemote(P('Remote job'), exportText({ k: 'r' })); gh.setRemote('projects/spread-footing/notes.txt', 'x'); gh.setRemote('projects/other-tool/X.json', '{}');
  store.save('Offline only', { k: 0 }); e.state();   // not scanned yet -> local
  await e.refreshCloud();
  assert.deepEqual(J(e.rows().map(x => [x.name, x.status])), [['Local 1', 'synced'], ['Offline only', 'local'], ['Remote job', 'cloud']]);
  const d = await e.download('Remote job'); assert.equal(d.ok, true);
  assert.deepEqual(JSON.parse(s.getItem(KEY))['Remote job'], { k: 'r' }); assert.equal(e.statusOf('Remote job'), 'synced');
  assert.equal((await e.download('Remote job')).error, 'exists');   // never replaces without asking
  gh.setRemote(P('Local 1'), exportText({ k: 'newer' })); await e.refreshCloud(); assert.equal(e.statusOf('Local 1'), 'cloud-newer');
  assert.equal((await e.useCloud('Local 1')).ok, true); assert.deepEqual(JSON.parse(s.getItem(KEY))['Local 1'], { k: 'newer' });
  assert.equal(Object.keys(JSON.parse(s.getItem(KEY))).filter(n => /conflict/.test(n)).length, 0);   // local was the synced version: no copy needed
});

test('github-sync: offline saves wait in the queue and go when GitHub is back; rate limit waits', async () => {
  const { gh, store, e, tick } = rig({});
  e.scan(); gh.offline = true;
  store.save('Q1', { a: 1 }); store.save('Q2', { a: 2 }); e.scan();
  const r = await e.flush(); assert.equal(r.ok, false); assert.equal(r.kind, 'offline'); assert.equal(e.pending(), 2);
  assert.match(e.lastError().message, /could not be reached/);
  assert.equal((await e.flush()).waiting, true);            // backoff: no hammering
  gh.offline = false; tick(31000); assert.equal((await e.flush()).done, 2); assert.equal(e.pending(), 0);
  assert.ok(gh.files.has(P('Q1')) && gh.files.has(P('Q2')));
  gh.rate = true; store.save('Q3', { a: 3 }); e.scan(); const rr = await e.flush();
  assert.equal(rr.kind, 'rate'); assert.match(rr.message, /rate limit/); assert.equal(e.pending(), 1); assert.ok(e.nextTry() > Date.now() + 500000);   // the reset time GitHub gave (mock: now + 600 s)
  gh.rate = false; assert.equal((await e.flush(true)).done, 1);
});

test('github-sync: delete is explicit only; rename uploads the new name and keeps the old file', async () => {
  const { s, gh, store, e } = rig({});
  e.scan(); store.save('D1', { a: 1 }); e.scan(); await e.flush();
  store.remove('D1'); e.scan(); await e.flush(true);
  assert.ok(gh.files.has(P('D1'))); await e.refreshCloud(); assert.equal(e.statusOf('D1'), 'cloud');
  assert.equal(gh.log.filter(l => l.method === 'DELETE').length, 0);
  store.save('R1', { a: 2 }); e.scan(); await e.flush(); store.rename('R1', 'R2'); e.scan(); await e.flush();
  assert.ok(gh.files.has(P('R1')) && gh.files.has(P('R2')));
  assert.equal((await e.deleteCloud('D1')).ok, true); assert.ok(!gh.files.has(P('D1')));
  assert.match(gh.commits.at(-1).message, /delete "D1"/);
  assert.equal(JSON.parse(s.getItem(KEY)).R2.a, 2);
});

test('github-sync: the token only in the Authorization header to api.github.com; never in URLs, messages, project files or state', async () => {
  const { s, gh, store, e } = rig({});
  e.scan(); store.save('T', { a: 1 }); e.scan(); await e.flush(); await e.refreshCloud(); await e.download('T', true);
  gh.token = 'github_pat_OTHER000000000000000'; store.save('T', { a: 2 }); e.scan(); const r = await e.flush();
  assert.equal(r.kind, 'auth'); assert.ok(!r.message.includes(TOKEN));
  for (const l of gh.log) { assert.ok(l.url.startsWith('https://api.github.com/repos/mlococo88/structural-projects')); assert.ok(!l.url.includes(TOKEN)); assert.equal(l.auth, `Bearer ${TOKEN}`); if (l.body) assert.ok(!l.body.includes(TOKEN)); }
  for (const [k, v] of s.m) if (k !== 'bridgeSuite.v1.githubSync') assert.ok(!v.includes(TOKEN), k);
  for (const t of gh.files.values()) assert.ok(!t.includes(TOKEN));
  // a non-GitHub address is refused by the client itself
  const seen = []; const c = G.client({ ...G.settings(s), owner: 'x' }, async u => { seen.push(u); throw new Error('no'); });
  await c.repo(); assert.ok(seen.every(u => u.startsWith('https://api.github.com/')));
});

test('github-sync: testConnection reads only; warns on a public repository and a missing branch', async () => {
  const s = mem(); G.saveSettings(s, SETUP);
  const gh = makeGitHubMock(); let t = await G.testConnection(s, gh.fetch); assert.equal(t.ok, true); assert.match(t.message, /private/);
  assert.ok(gh.log.every(l => l.method === 'GET'));
  t = await G.testConnection(s, makeGitHubMock({ isPrivate: false }).fetch); assert.equal(t.ok, false); assert.match(t.message, /PUBLIC/);
  G.saveSettings(s, { ...SETUP, branch: 'dev' }); t = await G.testConnection(s, gh.fetch); assert.equal(t.ok, false); assert.match(t.message, /does not exist/);
  G.saveSettings(s, { ...SETUP, token: 'github_pat_WRONG00000000000000' }); t = await G.testConnection(s, gh.fetch); assert.match(t.message, /refused the token/); assert.ok(!t.message.includes('WRONG'));
});

test('github-sync: toFile / fromFile hooks (a tool whose item wraps the export, e.g. { t, d })', async () => {
  const s = mem(); G.saveSettings(s, SETUP); const gh = makeGitHubMock();
  const store = SP.mapStore(s, 'tool_v1', { pack: st => ({ t: 1762370000000, d: st }), unpack: i => i.d, time: i => i.t });
  const e = G.engine({ tool: 'steel-beam', label: 'Steel Beam', store, storage: s, fetch: gh.fetch, toFile: i => i.d, space: 2 });
  e.scan(); store.save('S', { span: 30 }); e.scan(); await e.flush();
  assert.equal(gh.files.get('projects/steel-beam/S.json'), JSON.stringify({ span: 30 }, null, 2));
  gh.setRemote('projects/steel-beam/R.json', JSON.stringify({ span: 44 }, null, 2)); await e.refreshCloud(); await e.download('R');
  assert.deepEqual(JSON.parse(s.getItem('tool_v1')).R, { t: 1762370000000, d: { span: 44 } }); assert.equal(e.statusOf('R'), 'synced');
});
