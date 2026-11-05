// shared/projects.js: the saved-project list over a tool's own key (mapStore) and the undo / redo stack (history). Added 2026-11-02.
// Checks: round trip in the tool's existing format, rename / duplicate keep the stored item byte for byte, other keys untouched,
// quota and refused writes leave storage as it was, an unreadable list is never overwritten, history steps / redo / settle / max.
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';

const plain = v => JSON.parse(JSON.stringify(v));
const W = loadShared('projects.js'), SP = W.SharedProjects;
function store(init, quota) {
  const m = new Map(Object.entries(init || {}));
  const used = () => [...m].reduce((a, [k, v]) => a + k.length + v.length, 0);
  const s = { m, refuse: false, getItem: k => m.has(k) ? m.get(k) : null,
    setItem(k, v) { v = String(v); if (s.refuse) { const e = new Error('blocked'); e.name = 'SecurityError'; throw e; }
      const old = m.has(k) ? k.length + m.get(k).length : 0; if (quota != null && used() - old + k.length + v.length > quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } m.set(k, v); },
    removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } };
  return s;
}
const KEY = 'tool_projects_v1', OTHER = { tool_autosave_v1: '{"a":1}', 'bridgeSuite.v1.projectMeta': '{"name":"X"}' };

test('mapStore: save / get / list in the tool format; other keys untouched', () => {
  const s = store({ ...OTHER }), L = SP.mapStore(s, KEY), before = new Map(s.m);
  assert.equal(L.save('Bridge B', { span: 40 }).ok, true); assert.equal(L.save('bridge a', { span: 30 }).ok, true);
  assert.deepEqual(plain(JSON.parse(s.getItem(KEY))), { 'Bridge B': { span: 40 }, 'bridge a': { span: 30 } });   // the format the tool already wrote
  assert.deepEqual(plain(L.list().map(i => i.name)), ['bridge a', 'Bridge B']);
  assert.deepEqual(plain(L.get('Bridge B')), { span: 40 }); assert.equal(L.get('nope'), null);
  for (const [k, v] of before) assert.equal(s.getItem(k), v, k);
  assert.equal(L.save('  ', {}).ok, false);
});

test('mapStore: pack / unpack / time (Steel Beam style {t, d})', () => {
  const s = store(), L = SP.mapStore(s, KEY, { pack: (st) => ({ t: 1762100000000, d: st }), unpack: i => i.d, time: i => i.t, sort: 'saved' });
  L.save('A', { x: 1 }); assert.deepEqual(plain(JSON.parse(s.getItem(KEY))), { A: { t: 1762100000000, d: { x: 1 } } });
  assert.deepEqual(plain(L.get('A')), { x: 1 }); assert.equal(L.list()[0].saved, 1762100000000);
  assert.match(SP.etTime(1762100000000), /Nov 2, 2025, 11:13 AM EST/);
});

test('mapStore: rename and duplicate keep the stored item byte for byte, order kept', () => {
  const raw = '{"one":{"a":1.10,"b":[1,2]},"two":{"c":"x"},"three":3}';
  const s = store({ [KEY]: raw }), L = SP.mapStore(s, KEY);
  const itemText = n => JSON.stringify(JSON.parse(s.getItem(KEY))[n]);
  const two0 = itemText('two');
  assert.equal(L.rename('two', 'deux').ok, true);
  assert.deepEqual(Object.keys(JSON.parse(s.getItem(KEY))), ['one', 'deux', 'three']); assert.equal(itemText('deux'), two0);
  const r = L.rename('one', 'three'); assert.equal(r.ok, false); assert.equal(r.error, 'exists');
  assert.equal(L.rename('one', 'three', { replace: true }).ok, true); assert.deepEqual(Object.keys(JSON.parse(s.getItem(KEY))), ['three', 'deux']);
  assert.equal(L.duplicate('deux').name, 'deux (copy)'); assert.equal(L.duplicate('deux').name, 'deux (copy 2)'); assert.equal(itemText('deux (copy)'), two0);
  assert.equal(L.duplicate('deux', 'three').error, 'exists');
  assert.equal(L.rename('gone', 'x').error, 'missing'); assert.equal(L.rename('deux', ' ').error, 'empty');
  assert.equal(L.remove('deux').ok, true); assert.equal(L.has('deux'), false); assert.equal(L.remove('deux').ok, true);
});

test('mapStore: quota and refused writes change nothing', () => {
  const s = store({ ...OTHER, [KEY]: '{"A":{"x":1}}' }, 120), L = SP.mapStore(s, KEY), before = new Map(s.m);
  const r = L.save('Big', { pad: 'x'.repeat(200) }); assert.equal(r.ok, false); assert.equal(r.error, 'quota'); assert.match(r.message, /storage is full/);
  assert.deepEqual([...s.m], [...before]);
  s.refuse = true; for (const f of [() => L.save('B', {}), () => L.rename('A', 'C'), () => L.duplicate('A'), () => L.remove('A')]) { const q = f(); assert.equal(q.ok, false); assert.equal(q.error, 'storage'); }
  assert.deepEqual([...s.m], [...before]);
});

test('mapStore: an unreadable list is never overwritten', () => {
  const s = store({ [KEY]: '{not json' }), L = SP.mapStore(s, KEY);
  assert.equal(L.read().ok, false); assert.deepEqual(plain(L.list()), []);
  for (const f of [() => L.save('B', {}), () => L.remove('A')]) assert.equal(f().error, 'unreadable');
  assert.equal(s.getItem(KEY), '{not json');
});

test('usage: counts every key and the list key', () => {
  const s = store({ a: '12345', [KEY]: '{}' }), u = SP.usage(s, [KEY]);
  assert.equal(u.chars, 1 + 5 + KEY.length + 2); assert.equal(u.of, KEY.length + 2); assert.equal(u.counted, true);
});

test('history: record / undo / redo, a new change clears redo, max kept', () => {
  let state = 'a', t = 0; const set = v => { state = v; };
  const h = SP.history({ get: () => state, set, max: 3, now: () => t });
  h.reset(); assert.equal(h.canUndo(), false);
  state = 'b'; assert.equal(h.record(), true); state = 'b'; assert.equal(h.record(), false);   // no change: no step
  state = 'c'; h.record();
  assert.equal(h.undo(), true); assert.equal(state, 'b'); assert.equal(h.undo(), true); assert.equal(state, 'a'); assert.equal(h.undo(), false);
  t += 1000; assert.equal(h.redo(), true); assert.equal(state, 'b');
  t += 1000; state = 'x'; h.record(); assert.equal(h.canRedo(), false);
  ['1', '2', '3', '4', '5'].forEach(v => { t += 1000; state = v; h.record(); }); assert.equal(h.sizes().undo, 3);
});

test('history: undo records a pending change first; normalising redraw within settleMs adds no step', () => {
  let state = 'a', t = 0; const h = SP.history({ get: () => state, set: v => { state = v; }, now: () => t });
  h.reset(); state = 'b';   // changed but not recorded yet (debounced autosave)
  t = 100; h.undo(); assert.equal(state, 'a'); assert.equal(h.canRedo(), true);
  state = 'a '; t = 200; assert.equal(h.record(), false); assert.equal(h.canRedo(), true);   // the tool normalised the applied state
  t = 2000; h.redo(); assert.equal(state, 'b');
});

// STDS (2026-11-05): listStore = the mapStore interface over a list the tool keeps some other way (here: an id-keyed list shown by
// name, as apps/steel-bridge and Pile Designer keep theirs). mapStore is the same core over one localStorage value (unchanged).
test('listStore: by-name view over an id-keyed list; rename / duplicate / remove; refused write leaves it as it was', () => {
  const rows = [{ id: 'a1', name: 'Pier 1', data: { h: 20 } }, { id: 'b2', name: 'Pier 2', data: { h: 25 } }];
  let refuse = false;
  const L = SP.listStore({ key: 'tool.lib',
    readMap: () => ({ ok: true, map: Object.fromEntries(rows.map(r => [r.name, r.data])) }),
    writeMap: m => { if (refuse) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      const keep = rows.filter(r => r.name in m); rows.length = 0; keep.forEach(r => { rows.push({ ...r, data: m[r.name] }); });
      Object.keys(m).forEach(n => { if (!rows.some(r => r.name === n)) rows.push({ id: 'n' + rows.length, name: n, data: m[n] }); }); } });
  assert.deepEqual(plain(L.list().map(i => i.name)), ['Pier 1', 'Pier 2']);
  assert.equal(L.save('Pier 3', { h: 30 }).ok, true); assert.deepEqual(plain(L.get('Pier 3')), { h: 30 });
  assert.equal(L.rename('Pier 1', 'Pier 1A').ok, true); assert.ok(!L.has('Pier 1') && L.has('Pier 1A'));
  assert.equal(L.rename('Pier 2', 'Pier 3').error, 'exists');
  assert.equal(L.duplicate('Pier 2').name, 'Pier 2 (copy)');
  const st0 = L.stamp(); refuse = true; const r = L.save('Pier 9', { h: 1 }); refuse = false;
  assert.equal(r.ok, false); assert.equal(r.error, 'quota'); assert.equal(L.stamp(), st0);
  assert.equal(L.remove('Pier 2').ok, true); assert.ok(!L.has('Pier 2'));
  assert.equal(typeof L.stamp(), 'string'); assert.equal(L.key, 'tool.lib');
});

test('mapStore: stamp() is the stored text (the GitHub-sync change check)', () => {
  const s = store({}), L = SP.mapStore(s, KEY); L.save('A', { x: 1 });
  assert.equal(L.stamp(), s.getItem(KEY));
});
