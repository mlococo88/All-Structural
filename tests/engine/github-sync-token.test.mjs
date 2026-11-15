// shared/github-sync.js TOKX (2026-11-15): token expiry warning. The pure decision (tokenNotice), the header parse, the stored date
// (tokenExpiry / saveTokenExpiry), and the engine noting GitHub's expiry header, a 401 (refused) and the next success (cleared).
// Node only, fetch mocked (tests/engine/gh-mock.mjs).
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';
import { makeGitHubMock } from './gh-mock.mjs';

const W = loadShared('projects.js', 'github-sync.js'), SP = W.SharedProjects, G = W.SharedGitHubSync;
const KEY = 'sfd_projects', TOKEN = 'github_pat_TESTTOKEN0123456789abcd', EXP = 'bridgeSuite.v1.githubSync.tokenExpiry';
function mem(init) {
  const m = new Map(Object.entries(init || {}));
  return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } };
}
const SETUP = { owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN };
const plain = o => JSON.parse(JSON.stringify(o));   // objects from the loaded module are another realm's
const NOW = Date.parse('2026-11-15T17:00:00Z');   // 12:00 US Eastern, 2026-11-15

test('token: tokenNotice — off, refused, expired, soon (14 days), snoozed today, unknown, ok', () => {
  const n = x => G.tokenNotice({ configured: true, date: '2027-01-15', refusedAt: 0, snooze: '', now: NOW, ...x });
  assert.equal(n({ configured: false }).level, 'none');
  assert.equal(n({ refusedAt: NOW }).level, 'refused');               // a 401 wins over any date
  assert.equal(n({ date: '' }).level, 'unknown');
  assert.equal(n({}).level, 'ok'); assert.equal(n({}).days, 61);
  assert.equal(n({ date: '2026-11-29' }).level, 'soon'); assert.equal(n({ date: '2026-11-29' }).days, 14);
  assert.equal(n({ date: '2026-11-30' }).level, 'ok');                 // 15 days: no banner yet
  assert.equal(n({ date: '2026-11-15' }).days, 0);                     // expires today: still 'soon'
  assert.equal(n({ date: '2026-11-15' }).level, 'soon');
  assert.equal(n({ date: '2026-11-14' }).level, 'expired');
  assert.equal(n({ date: '2026-11-20', snooze: '2026-11-15' }).level, 'snoozed');   // "Remind me tomorrow" pressed today
  assert.equal(n({ date: '2026-11-20', snooze: '2026-11-14' }).level, 'soon');      // snoozed yesterday: back today
  assert.equal(n({ date: '2026-11-14', snooze: '2026-11-15' }).level, 'expired');   // a snooze never hides an expired token
});

test('token: parseExpiryHeader takes the date part of GitHub\'s header', () => {
  assert.equal(G.parseExpiryHeader('2027-02-01 00:00:00 UTC'), '2027-02-01');
  assert.equal(G.parseExpiryHeader('2027-02-01 12:00:00 -0500'), '2027-02-01');
  assert.equal(G.parseExpiryHeader(''), ''); assert.equal(G.parseExpiryHeader(null), ''); assert.equal(G.parseExpiryHeader('soon'), '');
});

test('token: saveTokenExpiry merges fields, refuses a bad date, and an entered date is kept over GitHub\'s', () => {
  const s = mem();
  assert.deepEqual(plain(G.tokenExpiry(s)), { date: '', src: '', refusedAt: 0, snooze: '' });
  assert.equal(G.saveTokenExpiry(s, { date: '2027-03-01' }), true);
  assert.deepEqual(plain(G.tokenExpiry(s)), { date: '2027-03-01', src: 'entered', refusedAt: 0, snooze: '' });
  assert.equal(G.saveTokenExpiry(s, { refusedAt: 123 }), true);
  assert.deepEqual(plain(G.tokenExpiry(s)), { date: '2027-03-01', src: 'entered', refusedAt: 123, snooze: '' });
  assert.equal(G.saveTokenExpiry(s, { refusedAt: 0, snooze: '' }), true);
  assert.equal(JSON.parse(s.getItem(EXP)).refusedAt, undefined);
  assert.equal(G.saveTokenExpiry(s, { date: '03/01/2027' }), false);   // not YYYY-MM-DD: nothing written
  assert.equal(G.tokenExpiry(s).date, '2027-03-01');
});

/* the mock answers with GitHub's expiry header added */
const withHeader = (gh, h) => async (url, init) => {
  const r = await gh.fetch(url, init); const hd = new Headers(r.headers); hd.set('github-authentication-token-expiration', h);
  return new Response(r.status === 204 ? null : await r.text(), { status: r.status, headers: hd });
};

test('token: the engine notes GitHub\'s expiry date (src github), but never replaces an entered date', async () => {
  const gh = makeGitHubMock({ token: TOKEN }), s = mem(); assert.equal(G.saveSettings(s, SETUP).ok, true);
  const e = G.engine({ tool: 'spread-footing', label: 'Spread Footing', store: SP.mapStore(s, KEY), storage: s, fetch: withHeader(gh, '2027-02-01 00:00:00 UTC') });
  e.init(); const r = await e.refreshCloud(); assert.equal(r.ok, true);
  assert.deepEqual(plain(G.tokenExpiry(s)), { date: '2027-02-01', src: 'github', refusedAt: 0, snooze: '' });
  G.saveTokenExpiry(s, { date: '2027-01-31', src: 'entered' });
  await e.refreshCloud();
  assert.equal(G.tokenExpiry(s).date, '2027-01-31');   // the engineer's date stands
});

test('token: a 401 records refused (sync paused, saves wait); the next success clears it; nothing local is lost', async () => {
  const gh = makeGitHubMock({ token: TOKEN }), s = mem(); assert.equal(G.saveSettings(s, SETUP).ok, true);
  const store = SP.mapStore(s, KEY);
  const e = G.engine({ tool: 'spread-footing', label: 'Spread Footing', store, storage: s, fetch: gh.fetch });
  e.init();
  gh.token = 'github_pat_SOMEOTHERTOKEN000000000';   // the saved token no longer works (expired / revoked)
  store.save('Pier 3', { a: 1 }); e.scan(); const r = await e.flush(true, true);
  assert.equal(G.tokenExpiry(s).refusedAt > 0, true);
  assert.equal(G.tokenNotice({ configured: true, now: Date.now(), ...G.tokenExpiry(s) }).level, 'refused');
  assert.equal(store.has('Pier 3'), true);                                     // still in this browser
  assert.equal(e.rows().find(x => x.name === 'Pier 3').status, 'pending');     // waiting to upload
  assert.equal([...gh.files.keys()].length, 0);
  gh.token = TOKEN;                                                             // a new token pasted (same text here)
  e.scan(); await e.flush(true, true);
  assert.equal(G.tokenExpiry(s).refusedAt, 0);
  assert.equal(gh.files.has('projects/spread-footing/Pier 3.json'), true);      // the waiting save went up by itself
  void r;
});

test('token: with sync off nothing is written and no notice is shown', () => {
  const s = mem();
  assert.equal(G.tokenNotice({ configured: G.configured(G.settings(s)), now: NOW, ...G.tokenExpiry(s) }).level, 'none');
  assert.equal(s.getItem(EXP), null);
  assert.equal(G.tokenBanner(s), null);   // no document in Node: draws nothing
});
