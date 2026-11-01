// apps/steel-bridge/engine/library.js: the saved-project list (2026-11-01). Round trip save / open / rename / duplicate / delete,
// keys sbd2.lib.* only (the autosave, ui, unreadable backups and other tools' keys are never touched), quota and refused writes,
// index rebuild, Eastern-time text, and the old autosave (KEYS.current) still loading as before.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, plain, test, ROOT } from './harness.mjs';

const W = loadShared('units.js', path.join(ROOT, 'apps/steel-bridge/engine/model.js'), path.join(ROOT, 'apps/steel-bridge/engine/library.js')), M = W.SBDModel, LIB = W.SBDLibrary;
// stand-in storage with key() / length, an optional character quota (like the browser's) and an optional refuse-all switch
function store(init, quota) {
  const m = new Map(Object.entries(init || {}));
  const used = () => [...m].reduce((a, [k, v]) => a + k.length + v.length, 0);
  const s = { m, refuse: false, getItem: k => m.has(k) ? m.get(k) : null,
    setItem(k, v) { v = String(v); if (s.refuse) { const e = new Error('blocked'); e.name = 'SecurityError'; throw e; }
      const old = m.has(k) ? k.length + m.get(k).length : 0; if (quota != null && used() - old + k.length + v.length > quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } m.set(k, v); },
    removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } };
  return s;
}
const proj = (name, number) => { const p = M.defaultProject(); p.project.name = name; p.project.number = number || ''; return p; };
const OTHER = { 'stgirder.session': 'x', 'girderdetail_autosave_v1': '{"a":1}', 'sbd2.ui': '{"itab":"proj"}' };

test('keys: library keys are in KEYS and start with sbd2.', () => {
  ['libIndex', 'libItem', 'libCur'].forEach(k => assert.ok(M.KEYS[k] && M.KEYS[k].startsWith('sbd2.'), k));
  assert.equal(M.KEYS.current, 'sbd2.project.current');   // the autosave key is unchanged
});

test('save / open / list round trip; other keys untouched', () => {
  const s = store({ ...OTHER }), p = proj('Bridge A', '2026-001');
  s.setItem(M.KEYS.current, M.exportJSON(p));   // the autosave
  const before = new Map(s.m);
  const r = LIB.save(s, p, null, { now: '2026-11-01T15:30:00.000Z', rnd: 0.5 }); assert.equal(r.ok, true);
  const l = LIB.list(s); assert.equal(l.length, 1); assert.equal(l[0].name, 'Bridge A'); assert.equal(l[0].number, '2026-001'); assert.equal(l[0].saved, '2026-11-01T15:30:00.000Z');
  const o = LIB.open(s, r.id); assert.equal(o.ok, true); assert.deepEqual(plain(o.project), plain(p));
  for (const [k, v] of before) assert.equal(s.getItem(k), v, k + ' changed');   // autosave, ui, other tools: byte-identical
  const added = [...s.m.keys()].filter(k => !before.has(k)).sort(); assert.deepEqual(added, ['sbd2.lib.index', 'sbd2.lib.p.' + r.id].sort());
  // saving again with the same id overwrites, no second row
  p.spans.lengths[0] = 120; const r2 = LIB.save(s, p, r.id, { now: '2026-11-01T16:00:00.000Z' }); assert.equal(r2.id, r.id); assert.equal(LIB.list(s).length, 1);
  assert.equal(LIB.open(s, r.id).project.spans.lengths[0], 120); assert.equal(LIB.list(s)[0].saved, '2026-11-01T16:00:00.000Z');
});

test('list: newest saved first; rename, duplicate, delete', () => {
  const s = store({ ...OTHER });
  const a = LIB.save(s, proj('A'), null, { now: '2026-11-01T10:00:00.000Z', rnd: 0.1 }), b = LIB.save(s, proj('B'), null, { now: '2026-11-01T11:00:00.000Z', rnd: 0.2 });
  assert.equal(JSON.stringify(LIB.list(s).map(i => i.name)), JSON.stringify(['B', 'A']));
  const rn = LIB.rename(s, a.id, '  A renamed '); assert.equal(rn.ok, true);
  assert.equal(LIB.list(s).find(i => i.id === a.id).name, 'A renamed');
  assert.equal(LIB.open(s, a.id).project.project.name, 'A renamed');
  assert.equal(LIB.list(s).find(i => i.id === a.id).saved, '2026-11-01T10:00:00.000Z', 'rename keeps the saved date');
  assert.equal(LIB.rename(s, a.id, '   ').ok, false);
  const d = LIB.duplicate(s, b.id, '', { now: '2026-11-01T12:00:00.000Z', rnd: 0.3 }); assert.equal(d.ok, true); assert.notEqual(d.id, b.id);
  assert.equal(JSON.stringify(LIB.list(s).map(i => i.name)), JSON.stringify(['B (copy)', 'B', 'A renamed']));
  assert.deepEqual(plain({ ...LIB.open(s, d.id).project, project: 0 }), plain({ ...LIB.open(s, b.id).project, project: 0 }), 'the copy equals the original apart from the name');
  LIB.setCur(s, b.id); assert.equal(LIB.getCur(s), b.id);
  assert.equal(LIB.remove(s, b.id).ok, true);
  assert.equal(JSON.stringify(LIB.list(s).map(i => i.name)), JSON.stringify(['B (copy)', 'A renamed'])); assert.equal(s.getItem('sbd2.lib.p.' + b.id), null); assert.equal(LIB.getCur(s), null);
  assert.equal(LIB.open(s, b.id).ok, false);
  for (const k of Object.keys(OTHER)) assert.equal(s.getItem(k), OTHER[k], k);
});

test('quota: a failed save returns a message, keeps what was stored, and the project in memory is untouched', () => {
  const p = proj('Big'), one = M.exportJSON(p).length, s = store({ ...OTHER }, one * 2 + 900);
  const a = LIB.save(s, p, null, { rnd: 0.1 }); assert.equal(a.ok, true);
  const snapshot = new Map(s.m), pj = JSON.stringify(p);
  const b = LIB.save(s, proj('Second'), null, { rnd: 0.2 }); const c = LIB.save(s, proj('Third'), null, { rnd: 0.3 });
  const bad = [b, c].find(r => !r.ok); assert.ok(bad, 'the quota was hit');
  assert.equal(bad.error, 'quota'); assert.match(bad.message, /storage is full/); assert.match(bad.message, /Export JSON/);
  // after the refused save, the first project is intact and no half-written item is left behind
  assert.equal(LIB.open(s, a.id).ok, true); assert.equal(JSON.stringify(p), pj);
  const names = LIB.list(s).map(i => i.name); assert.ok(names.includes('Big'));
  const items = [...s.m.keys()].filter(k => k.startsWith('sbd2.lib.p.')); assert.equal(items.length, names.length, 'no orphan item without a list row');
  // overwrite failing keeps the old text
  s.setItem('pad', 'x'.repeat(0)); const big = proj('Big'); big.notes = 'x'.repeat(one * 3);
  const o = LIB.save(s, big, a.id); assert.equal(o.ok, false); assert.equal(o.error, 'quota'); assert.equal(LIB.open(s, a.id).ok, true); assert.deepEqual(plain(LIB.open(s, a.id).project), plain(p));
  void snapshot;
});

test('refused writes (private mode): not saved, nothing thrown', () => {
  const s = store(); s.refuse = true;
  const r = LIB.save(s, proj('X'), null); assert.equal(r.ok, false); assert.equal(r.error, 'storage'); assert.match(r.message, /not available/);
  assert.equal(LIB.list(s).length, 0);
});

test('unreadable index: kept, list rebuilt from the items', () => {
  const s = store(), a = LIB.save(s, proj('Keep me', '77'), null, { rnd: 0.1 });
  s.setItem('sbd2.lib.index', '{broken');
  const l = LIB.list(s, '2026-11-01T00:00:00.000Z'); assert.equal(l.length, 1); assert.equal(l[0].name, 'Keep me'); assert.equal(l[0].id, a.id);
  assert.ok([...s.m.keys()].some(k => k.startsWith('sbd2.lib.index.unreadable.')), 'the unreadable index text is kept');
  assert.equal(LIB.open(s, a.id).ok, true);
});

test('old autosave still loads exactly as before, with and without a library', () => {
  const p = proj('Old autosave'), s = store();
  s.setItem(M.KEYS.current, M.exportJSON(p));
  const r = M.load(s); assert.equal(r.source, 'saved'); assert.deepEqual(plain(r.project), plain(p));
  LIB.save(s, proj('Other'), null); LIB.setCur(s, 'nothing');
  const r2 = M.load(s); assert.equal(r2.source, 'saved'); assert.deepEqual(plain(r2.project), plain(p)); assert.equal(s.getItem(M.KEYS.current), M.exportJSON(p));
  assert.equal(M.save(s, p), true);
});

test('usage counts every key of the origin; Eastern time text', () => {
  const s = store({ ...OTHER }); LIB.save(s, proj('U'), null);
  const u = LIB.usage(s); assert.equal(u.counted, true); assert.ok(u.chars > u.ofLibrary && u.ofLibrary > 5000); assert.ok(u.frac > 0 && u.frac < 1);
  assert.equal(LIB.etTime('2026-11-01T15:30:00.000Z'), 'Nov 1, 2026, 10:30 AM EST');   // Nov 1 2026 is EST (DST ended that morning)
  assert.equal(LIB.etTime('2026-07-04T15:30:00.000Z'), 'Jul 4, 2026, 11:30 AM EDT');
});
