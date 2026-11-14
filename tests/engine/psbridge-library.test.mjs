// apps/ps-bridge/engine/library.js (PS Bridge PR 5, saved projects): the saved-project list kept in the browser (window.PSBLibrary), an
// adapted copy of apps/steel-bridge/engine/library.js. Round trip save / open / rename / duplicate / delete; keys psb2.lib.* only (the
// autosave psb2.project.current, psb2.ui, the unreadable backups, the old app's psbeam.* / bridgeSuite.* keys and the steel app's sbd2.*
// keys are never touched); quota and refused writes; index rebuild; the open project's autosave still loading as before; and CLAUDE.md §5:
// the Export JSON text of every fixture design (the 19 result-tab designs, the new and default projects, an old-app import) is unchanged
// by export -> import -> export and is byte-identical to the stored library item and to the item opened again.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, plain, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared(...PBDF, ...['sections', 'model', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'library'].map(n => path.join(APP, `engine/${n}.js`)));
const M = W.PSBModel, LIB = W.PSBLibrary;
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
const proj = (name, number) => { const p = M.newProject(); p.project.name = name; p.project.number = number || ''; return p; };
const OTHER = { 'psbeam.inputs.v1': '{"girder":"PCI BT-72"}', 'psbeam.bridge.v1': '{"mode":"pl"}', 'bridgeSuite.v1.projects': '{"a":1}', 'sbd2.lib.index': '{"schema":"sbd2.library","version":1,"items":[]}', 'sbd2.project.current': '{}', 'psb2.ui': '{"itab":"proj"}' };
const load = P => M.importJSON(M.exportJSON(P)).project;   // what the page opens (load = importJSON of the stored text)

test('keys: the library keys are the ones model.js KEYS reserved, all psb2.; the autosave key unchanged', () => {
  assert.equal(M.KEYS.libIndex, 'psb2.lib.index'); assert.equal(M.KEYS.libItem, 'psb2.lib.p.'); assert.equal(M.KEYS.libCur, 'psb2.lib.current');
  assert.equal(M.KEYS.current, 'psb2.project.current'); assert.equal(M.KEYS.ui, 'psb2.ui');
  Object.values(M.KEYS).forEach(k => assert.ok(k.startsWith('psb2.'), k));
  assert.equal(LIB.SCHEMA, 'psb2.library');
  // the library's code names no key other than through PSBModel.KEYS and its own 'psb2.lib.' prefix
  const src = fs.readFileSync(path.join(APP, 'engine/library.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  [...src.matchAll(/'([a-z0-9]+\.[\w.]*)'/gi)].forEach(m => assert.ok(m[1].startsWith('psb2.'), m[1]));
  assert.ok(!/sbd2|SBD/.test(src));
});

test('save / open / list round trip; other keys untouched; only psb2.lib.* added', () => {
  const s = store({ ...OTHER }), p = proj('Route 2 over the Pawcatuck', '2026-014');
  s.setItem(M.KEYS.current, M.exportJSON(p));   // the autosave
  const before = new Map(s.m);
  const r = LIB.save(s, p, null, { now: '2026-11-14T15:30:00.000Z', rnd: 0.5 }); assert.equal(r.ok, true);
  assert.equal(r.text, M.exportJSON(p), 'the item text is the Export JSON text');
  const l = LIB.list(s); assert.equal(l.length, 1); assert.equal(l[0].name, 'Route 2 over the Pawcatuck'); assert.equal(l[0].number, '2026-014'); assert.equal(l[0].saved, '2026-11-14T15:30:00.000Z');
  const o = LIB.open(s, r.id); assert.equal(o.ok, true); assert.deepEqual(plain(o.project), plain(p)); assert.equal(M.exportJSON(o.project), r.text);
  for (const [k, v] of before) assert.equal(s.getItem(k), v, k + ' changed');   // autosave, ui, other tools, the old app: byte-identical
  const added = [...s.m.keys()].filter(k => !before.has(k)).sort(); assert.deepEqual(added, ['psb2.lib.index', 'psb2.lib.p.' + r.id].sort());
  added.forEach(k => assert.ok(k.startsWith('psb2.'), k));
  // saving again with the same id overwrites, no second row
  p.spans.lengths[0] = 110; const r2 = LIB.save(s, p, r.id, { now: '2026-11-14T16:00:00.000Z' }); assert.equal(r2.id, r.id); assert.equal(LIB.list(s).length, 1);
  assert.equal(LIB.open(s, r.id).project.spans.lengths[0], 110); assert.equal(LIB.list(s)[0].saved, '2026-11-14T16:00:00.000Z');
  LIB.setCur(s, r.id); assert.equal(LIB.getCur(s), r.id); assert.equal(s.getItem('psb2.lib.current'), JSON.stringify({ id: r.id }));
  for (const [k, v] of before) if (k !== M.KEYS.current) assert.equal(s.getItem(k), v, k + ' changed');
});

test('list: newest saved first; rename, duplicate, delete (with the current pointer)', () => {
  const s = store({ ...OTHER });
  const a = LIB.save(s, proj('A'), null, { now: '2026-11-14T10:00:00.000Z', rnd: 0.1 }), b = LIB.save(s, proj('B'), null, { now: '2026-11-14T11:00:00.000Z', rnd: 0.2 });
  assert.deepEqual([...LIB.list(s).map(i => i.name)], ['B', 'A']);
  const rn = LIB.rename(s, a.id, '  A renamed '); assert.equal(rn.ok, true);
  assert.equal(LIB.list(s).find(i => i.id === a.id).name, 'A renamed');
  assert.equal(LIB.open(s, a.id).project.project.name, 'A renamed');
  assert.equal(LIB.list(s).find(i => i.id === a.id).saved, '2026-11-14T10:00:00.000Z', 'rename keeps the saved date');
  { const q = plain(LIB.open(s, a.id).project), w = plain(proj('A')); q.project.name = w.project.name = ''; assert.deepEqual(q, w, 'rename changes the name only'); }
  assert.equal(LIB.rename(s, a.id, '   ').ok, false);
  const d = LIB.duplicate(s, b.id, '', { now: '2026-11-14T12:00:00.000Z', rnd: 0.3 }); assert.equal(d.ok, true); assert.notEqual(d.id, b.id);
  assert.deepEqual([...LIB.list(s).map(i => i.name)], ['B (copy)', 'B', 'A renamed']);
  assert.deepEqual(plain({ ...LIB.open(s, d.id).project, project: 0 }), plain({ ...LIB.open(s, b.id).project, project: 0 }), 'the copy equals the original apart from the name');
  LIB.setCur(s, b.id); assert.equal(LIB.getCur(s), b.id);
  assert.equal(LIB.remove(s, b.id).ok, true);
  assert.deepEqual([...LIB.list(s).map(i => i.name)], ['B (copy)', 'A renamed']); assert.equal(s.getItem('psb2.lib.p.' + b.id), null); assert.equal(LIB.getCur(s), null);
  assert.equal(LIB.open(s, b.id).ok, false);
  for (const k of Object.keys(OTHER)) assert.equal(s.getItem(k), OTHER[k], k);
});

test('quota: a failed save returns a message, keeps what was stored, and the project in memory is untouched', () => {
  const p = proj('Big'), one = M.exportJSON(p).length, s = store({ ...OTHER }, one * 2 + 1500);
  const a = LIB.save(s, p, null, { rnd: 0.1 }); assert.equal(a.ok, true);
  const pj = JSON.stringify(p);
  const b = LIB.save(s, proj('Second'), null, { rnd: 0.2 }); const c = LIB.save(s, proj('Third'), null, { rnd: 0.3 });
  const bad = [b, c].find(r => !r.ok); assert.ok(bad, 'the quota was hit');
  assert.equal(bad.error, 'quota'); assert.match(bad.message, /storage is full/); assert.match(bad.message, /Export JSON/);
  assert.equal(LIB.open(s, a.id).ok, true); assert.equal(JSON.stringify(p), pj);
  const names = LIB.list(s).map(i => i.name); assert.ok(names.includes('Big'));
  const items = [...s.m.keys()].filter(k => k.startsWith('psb2.lib.p.')); assert.equal(items.length, names.length, 'no orphan item without a list row');
  const big = proj('Big'); big.project.notes = 'x'.repeat(one * 3);
  const o = LIB.save(s, big, a.id); assert.equal(o.ok, false); assert.equal(o.error, 'quota'); assert.deepEqual(plain(LIB.open(s, a.id).project), plain(p));
  for (const k of Object.keys(OTHER)) assert.equal(s.getItem(k), OTHER[k], k);
});

test('refused writes (private mode): not saved, nothing thrown', () => {
  const s = store(); s.refuse = true;
  const r = LIB.save(s, proj('X'), null); assert.equal(r.ok, false); assert.equal(r.error, 'storage'); assert.match(r.message, /not available/);
  assert.equal(LIB.list(s).length, 0);
});

test('unreadable index: kept, list rebuilt from the items', () => {
  const s = store(), a = LIB.save(s, proj('Keep me', '77'), null, { rnd: 0.1 });
  s.setItem('psb2.lib.index', '{broken');
  const l = LIB.list(s); assert.equal(l.length, 1); assert.equal(l[0].name, 'Keep me'); assert.equal(l[0].id, a.id);
  const kept = [...s.m.keys()].filter(k => k.startsWith('psb2.lib.index.unreadable.')); assert.equal(kept.length, 1, 'the unreadable index text is kept');
  assert.equal(s.getItem(kept[0]), '{broken'); assert.equal(LIB.open(s, a.id).ok, true);
});

test('the open project\'s autosave (psb2.project.current) still loads exactly as before, with and without a library', () => {
  const p = load(proj('Autosaved before PR 5')), s = store({ ...OTHER }), t = M.exportJSON(p);
  s.setItem(M.KEYS.current, t);
  const r = M.load(s); assert.equal(r.source, 'saved'); assert.equal(M.exportJSON(r.project), t, 'the same project, byte for byte');
  assert.equal(LIB.getCur(s), null); assert.equal(LIB.list(s).length, 0, 'no saved list yet: the page shows it as "not saved"');
  LIB.save(s, proj('Other'), null); LIB.setCur(s, 'nothing');
  const r2 = M.load(s); assert.equal(r2.source, 'saved'); assert.equal(M.exportJSON(r2.project), t); assert.equal(s.getItem(M.KEYS.current), t, 'the library never writes the autosave');
});

test('§5: Export JSON text unchanged by export -> import -> export, and byte-identical through the library, for every fixture design', () => {
  const fx = { ...TAB_CASES(() => M.defaultProject()), 'newProject': M.newProject(), 'defaultProject': M.defaultProject() };
  // an old-app design imported with "From the old app" (engine/legacy.js), as the page stores it
  const dir = path.join(ROOT, 'tests/projects/ps'), f = fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()[0];
  const lr = W.PSBLegacy.fromText(fs.readFileSync(path.join(dir, f), 'utf8'), f); assert.equal(lr.ok, true, lr.error);
  const c = W.PSBLegacy.convert(lr.src); assert.equal(c.ok, true, c.error); fx['old-app import ' + f] = c.project;
  const s = store({ ...OTHER }); let n = 0;
  for (const [name, P0] of Object.entries(fx)) {
    const P = load(P0), t = M.exportJSON(P);
    assert.equal(t, JSON.stringify(P, null, 2), name + ': exportJSON is JSON.stringify(p, null, 2) as before');
    const r = M.importJSON(t); assert.equal(r.ok, true, name); assert.equal(M.exportJSON(r.project), t, name + ': export -> import -> export');
    const sv = LIB.save(s, P, null, { now: `2026-11-14T10:${String(n).padStart(2, '0')}:00.000Z`, rnd: n / 100 }); assert.equal(sv.ok, true, name);
    assert.equal(s.getItem('psb2.lib.p.' + sv.id), t, name + ': the stored item = the Export JSON text');
    const o = LIB.open(s, sv.id); assert.equal(o.ok, true, name); assert.equal(o.text, t); assert.equal(M.exportJSON(o.project), t, name + ': opened again');
    const rn = LIB.rename(s, sv.id, 'Renamed ' + n); assert.equal(rn.ok, true);
    const q = JSON.parse(t); q.project.name = 'Renamed ' + n; assert.equal(rn.text, M.exportJSON(q), name + ': rename changes only project.name');
    n++;
  }
  assert.ok(n >= 20, String(n));
  for (const k of Object.keys(OTHER)) assert.equal(s.getItem(k), OTHER[k], k);
});

test('usage counts every key of the origin; Eastern time text', () => {
  const s = store({ ...OTHER }); LIB.save(s, proj('U'), null);
  const u = LIB.usage(s); assert.equal(u.counted, true); assert.ok(u.chars > u.ofLibrary && u.ofLibrary > 2000); assert.ok(u.frac > 0 && u.frac < 1);
  assert.equal(LIB.etTime('2026-11-14T15:30:00.000Z'), 'Nov 14, 2026, 10:30 AM EST');
});
