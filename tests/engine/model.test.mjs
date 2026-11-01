// apps/steel-bridge/engine/model.js (schema v1) and shared/units.js: defaults valid, validation, save/load with a
// stand-in storage (keys sbd2.* only; an unreadable saved project is kept, never overwritten), JSON export/import
// round trip, old GirderDetail / ST-Girder files refused without engine/legacy.js (the import itself: legacy.test.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, plain, test, ROOT } from './harness.mjs';

const W = loadShared('units.js', path.join(ROOT, 'apps/steel-bridge/engine/model.js')), M = W.SBDModel, U = W.SharedUnits;
function store(init) { const m = new Map(Object.entries(init || {})); return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }

test('default project: valid, schema v1, keys prefixed sbd2.', () => {
  const p = M.defaultProject(), v = M.validate(p);
  assert.equal(v.errors.length, 0, JSON.stringify(v.errors));
  assert.equal(p.schema, 'sbd2.project'); assert.equal(p.version, 1);
  Object.values(M.KEYS).forEach(k => assert.ok(k.startsWith('sbd2.'), k));
  const last = p.girders[0].segments.at(-1); assert.equal(last.x1, p.spans.lengths.reduce((a, b) => a + b, 0));
});

test('validation: bad inputs are reported with their path', () => {
  const p = M.defaultProject();
  p.spans.lengths[1] = -5; p.girders[0].segments[1].x0 = 90; p.girders[0].segments[2].tw = 0; p.deck.rebar.top.c = 9; p.materials.steel.web = 'A992';
  const paths = M.validate(p).errors.map(e => e.path);
  ['spans.lengths.1', 'girders.0.segments.1.x0', 'girders.0.segments.2.tw', 'deck.rebar.top.c', 'materials.steel.web'].forEach(k => assert.ok(paths.includes(k), k));
});

test('save / load round trip; nothing written outside sbd2.*', () => {
  const s = store({ 'stgirder.session': 'x' }), p = M.defaultProject(); p.project.name = 'Test bridge';
  assert.equal(M.save(s, p), true);
  assert.deepEqual([...s.m.keys()].sort(), ['sbd2.project.current', 'stgirder.session']);
  const r = M.load(s); assert.equal(r.source, 'saved'); assert.deepEqual(plain(r.project), plain(p));
  assert.equal(M.load(store()).source, 'default');
});

test('an unreadable saved project is kept under a backup key, not lost', () => {
  const s = store({ 'sbd2.project.current': '{not json' }), r = M.load(s, '2026-10-29T00:00:00.000Z');
  assert.equal(r.source, 'default'); assert.match(r.note, /could not be read/);
  assert.equal(s.getItem('sbd2.project.unreadable.2026-10-29T00:00:00.000Z'), '{not json');
  assert.equal(s.getItem('sbd2.project.current'), '{not json');   // untouched until the user's next save
});

test('JSON export / import; newer versions refused; old GirderDetail and ST-Girder files refused without engine/legacy.js', () => {
  const p = M.defaultProject(), r = M.importJSON(M.exportJSON(p));
  assert.equal(r.ok, true); assert.deepEqual(plain(r.project), plain(p));
  assert.equal(M.importJSON(JSON.stringify({ ...p, version: 2 })).ok, false);
  assert.equal(M.importJSON('nope').ok, false);
  const gd = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/st/gd_builtin_AASHTO_G1.json'), 'utf8')).payload;
  const a = M.importJSON(JSON.stringify(gd)); assert.equal(a.ok, false); assert.equal(a.legacy, 'ST-Girder'); assert.match(a.error, /legacy\.js is not loaded/);   // without engine/legacy.js (tests/engine/legacy.test.mjs loads it)
  const b = M.importJSON(JSON.stringify({ app: 'SteelBridgeDesign', P: {} })); assert.equal(b.legacy, 'GirderDetail');
});

test('units: conversions and formatting', () => {
  assert.equal(U.ftToIn(10), 120); assert.equal(U.kipInToKipFt(71300), 71300 / 12); assert.equal(U.kcfToPcf(0.15), 150);
  assert.equal(U.fmt(-0.001, 2), '0.00'); assert.equal(U.fmt(NaN), '—'); assert.equal(U.fmtInt(38770.67), '38,771');
  assert.equal(U.fmtSig(0.0123456, 3), '0.0123');
  assert.equal(U.frac(1.125), '1 1/8'); assert.equal(U.frac(0.5625), '9/16'); assert.equal(U.frac(60), '60'); assert.equal(U.frac(0.3), '0.300');
  assert.equal(U.parseDim('1 1/8'), 1.125); assert.equal(U.parseDim('1-1/8"'), 1.125); assert.equal(U.parseDim('3/4'), 0.75); assert.ok(Number.isNaN(U.parseDim('x')));
});

test('crossframes.userMode (CFRM, 2026-11-01): default add / add; absent (older projects) is valid; an unknown value is an error', () => {
  const p = M.defaultProject(); assert.equal(JSON.stringify(p.crossframes.userMode), '{"StrI":"add","Con":"add"}');
  delete p.crossframes.userMode; assert.equal(M.validate(p).errors.length, 0);
  p.crossframes.userMode = { StrI: 'replace', Con: 'add' }; assert.equal(M.validate(p).errors.length, 0);
  p.crossframes.userMode.Con = 'both'; assert.equal(M.validate(p).errors.map(e => e.path).join(), 'crossframes.userMode.Con');
});
