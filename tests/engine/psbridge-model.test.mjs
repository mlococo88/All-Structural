// apps/ps-bridge/engine/model.js (schema psb2.project v1, PR 1 skeleton, docs/ps-bridge-plan.md §2.4): defaults valid, validation by path,
// save/load with a stand-in storage (keys psb2.* only; no psbeam.* key read or written; an unreadable saved project kept under a backup key,
// never overwritten), JSON export/import round trip, newer versions refused, old Prestressed Bridge Design files recognised and refused
// (import comes in PR 2f), the page's file list (classic scripts, relative paths, psb2.* keys only in the app's code).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, plain, test, ROOT } from './harness.mjs';

const J = v => JSON.parse(JSON.stringify(v));
const APP = path.join(ROOT, 'apps/ps-bridge');
const W = loadShared(path.join(APP, 'engine/model.js')), M = W.PSBModel;
function store(init) { const m = new Map(Object.entries(init || {})); return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }

test('default project: valid, schema psb2.project v1, every key prefixed psb2.', () => {
  const p = M.defaultProject(), v = M.validate(p);
  assert.equal(v.errors.length, 0, JSON.stringify(v.errors)); assert.equal(v.warnings.length, 0, JSON.stringify(v.warnings));
  assert.equal(p.schema, 'psb2.project'); assert.equal(p.version, 1);
  Object.values(M.KEYS).forEach(k => assert.ok(k.startsWith('psb2.'), k));
  assert.deepEqual(J(p.spans), { lengths: [120], continuity: 'simple' });
  assert.deepEqual(J(p.xs), { nb: 5, bays: [9, 9, 9, 9], ohL: 3, ohR: 3, skews: [0, 0] });
  assert.equal(M.totalLength(p), 120); assert.deepEqual(J(M.girderOffsets(p)), [3, 12, 21, 30, 39]);
});

test('validation: bad inputs are reported with their path; unequal bays are valid', () => {
  const ok = M.defaultProject(); ok.xs.bays = [8, 9.5, 10, 8.25]; ok.spans = { lengths: [100, 125, 100], continuity: 'composite' }; ok.xs.skews = [15, 15, 15, 15];
  assert.equal(M.validate(ok).errors.length, 0, JSON.stringify(M.validate(ok).errors));
  const p = M.defaultProject();
  p.spans.lengths = [120, -5]; p.spans.continuity = 'continuous'; p.xs.nb = 4.5; p.xs.ohL = -1; p.xs.skews = [0, 95];
  const paths = M.validate(p).errors.map(e => e.path);
  ['spans.lengths.1', 'spans.continuity', 'xs.nb', 'xs.ohL', 'xs.skews', 'xs.skews.1'].forEach(k => assert.ok(paths.includes(k), k));
  const q = M.defaultProject(); q.xs.bays = [9, 9, 0]; const qp = M.validate(q).errors.map(e => e.path);
  assert.ok(qp.includes('xs.bays') && qp.includes('xs.bays.2'), qp.join());   // 5 girders need 4 bays; a zero bay
  const s = M.defaultProject(); s.spans.continuity = 'composite'; assert.equal(M.validate(s).warnings[0].path, 'spans.continuity');   // one span made continuous: a warning only
  assert.equal(M.validate(null).errors[0].msg, 'No project.');
});

test('save / load round trip; nothing written outside psb2.*; psbeam.* keys untouched', () => {
  const old = { 'psbeam.inputs.v1': '{"girder":"PCI BT-72"}', 'psbeam.bridge.v1': '{"mode":"pl"}', 'sbd2.project.current': '{}' };
  const s = store(old), p = M.defaultProject(); p.project.name = 'Test PS bridge';
  assert.equal(M.save(s, p), true);
  assert.deepEqual([...s.m.keys()].sort(), ['psb2.project.current', 'psbeam.bridge.v1', 'psbeam.inputs.v1', 'sbd2.project.current']);
  Object.entries(old).forEach(([k, v]) => assert.equal(s.getItem(k), v, k));
  const r = M.load(s); assert.equal(r.source, 'saved'); assert.deepEqual(plain(r.project), plain(p));
  const d = M.load(store(old)); assert.equal(d.source, 'default'); assert.deepEqual(plain(d.project), plain(M.defaultProject()));   // the old app's data is not read as a project
});

test('an unreadable saved project is kept under a backup key, not lost; storage full: autosave off', () => {
  const s = store({ 'psb2.project.current': '{not json' }), r = M.load(s, '2026-11-12T00:00:00.000Z');
  assert.equal(r.source, 'default'); assert.match(r.note, /could not be read/); assert.ok(!r.noAutosave);
  assert.equal(s.getItem('psb2.project.unreadable.2026-11-12T00:00:00.000Z'), '{not json');
  assert.equal(s.getItem('psb2.project.current'), '{not json');   // untouched until the user's next change
  const full = store({ 'psb2.project.current': JSON.stringify({ schema: 'psb2.project', version: 9 }) }); full.setItem = () => { throw new Error('QuotaExceededError'); };
  const f = M.load(full); assert.equal(f.source, 'default'); assert.equal(f.noAutosave, true); assert.match(f.note, /could not be backed up/);
  assert.equal(M.save(full, M.defaultProject()), false);
});

test('JSON export / import; newer versions refused; old Prestressed Bridge Design files recognised and refused (no change)', () => {
  const p = M.defaultProject(), r = M.importJSON(M.exportJSON(p));
  assert.equal(r.ok, true); assert.deepEqual(plain(r.project), plain(p));
  assert.match(M.importJSON(JSON.stringify({ ...p, version: 2 })).error, /reads up to version 1/);
  assert.equal(M.importJSON('nope').ok, false);
  assert.match(M.importJSON(JSON.stringify({ schema: 'sbd2.project', version: 1 })).error, /Not a PS Bridge/);
  const inp = { girder: 'PCI BT-72', mat: { fci: 6.8 }, str: { size: '0.6 in' }, rows: [{ n: 10, y: 2 }] }, br = { mode: 'pl', spans: [120], designs: {} };
  [inp, br].forEach(o => { const t = JSON.stringify(o), a = M.importJSON(t); assert.equal(a.ok, false); assert.equal(a.legacy, 'Prestressed Bridge Design'); assert.match(a.error, /From the old app/); assert.equal(t, JSON.stringify(o)); });
  assert.equal(M.migrate(p), p);   // version 1: nothing to migrate
});

test('the page: classic scripts by relative path (file://), no modules or fetch, pinned CDN libraries as the steel app, psb2.* keys only', () => {
  const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8'), steel = fs.readFileSync(path.join(ROOT, 'apps/steel-bridge/index.html'), 'utf8');
  assert.ok(!/type\s*=\s*["']module["']|\bimport\s*\(|\bfetch\s*\(|XMLHttpRequest|text\/babel/.test(html));
  const list = [...html.matchAll(/^\s*'([^']+\.js)',?/gm)].map(m => m[1]);
  const pbd = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => `engine/pbd-${n}.js`);
  assert.deepEqual(list, [...pbd, 'engine/model.js', 'engine/rigid.js', 'engine/holddown.js', 'engine/design.js', 'engine/bridge.js', 'engine/bridge-dl.js', 'engine/fields.js', 'engine/inputcheck.js', 'engine/legacy.js', 'engine/worked.js', 'engine/worked-stress.js', 'engine/worked-strength.js', 'engine/worked-end.js', 'engine/worked-hdr.js', '../../shared/steps.js', '../../shared/report.js', 'report/fromtab.js', 'report/data.js', 'report/builders.js', 'ui/inputs.js', 'ui/bridgedl.js', 'ui/types.js', 'ui/legacy.js', 'ui/inputcheck.js', 'ui/vizkit.js', 'ui/vizalong.js', 'ui/outkit.js', 'ui/section.js', 'ui/loads.js', 'ui/analysis.js', 'ui/strands.js', 'ui/losses.js', 'ui/stresses.js', 'ui/flexure.js', 'ui/shear.js', 'ui/endzone.js', 'ui/camber.js', 'ui/handling.js', 'ui/deck.js', 'ui/rating.js', 'ui/report.js', 'ui/dash.js', 'ui/splitter.js']);   // PR 3a-1: engine/bridge.js, ui/types.js; PR 2a: the moved engine first; PR 2b: the inputs and three result tabs; PR 2c-1: Losses, Stresses; PR 2c-2: Flexure, Shear; PR 2d: End zone, Camber, Handling, Deck, Rating; PR 2f: legacy (From the old app)
  list.forEach(f => { assert.ok(!f.startsWith('/') && !/^\w+:/.test(f), f); assert.ok(fs.existsSync(path.join(APP, f)), f); });
  const cdn = s => [...s.matchAll(/(?:src|href)="(https:[^"]+)"/g)].map(m => m[1]).sort();
  const ours = cdn(html); assert.equal(ours.length, 4); ours.forEach(u => assert.ok(cdn(steel).includes(u), u));   // KaTeX 0.16.9, three r128 + OrbitControls 0.128.0
  // the code (comments removed): no sbd2.* key and no window.SBD* namespace of the steel app is used; every storage key literal is psb2.*
  const code = t => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  // the moved engine files (verbatim, PR 2a) are left out of the key check: they name the old app's keys (PBD.KEY psbeam.bridge.v1, its
  // load/save) as on the old page; this app never calls PBD.load / PBD.save (checked below), so it reads and writes no psbeam.* key
  for (const f of ['index.html', ...list.filter(f => !pbd.includes(f))]) {
    const c = code(fs.readFileSync(path.join(APP, f), 'utf8'));
    assert.ok(!/sbd2[.:]|window\.SBD|\bSBD[A-Z]/.test(c), `${f}: a steel key or namespace is used`);
    // PR 2f: engine/legacy.js reads the old app's keys (psbeam.*, bridgeSuite.v1.projects / currentProjectId) and never writes a key
    if (f === 'engine/legacy.js') assert.ok(!/\.\s*(setItem|removeItem|clear)\s*\(/.test(c), `${f}: writes storage`);
    else [...c.matchAll(/'((?:psb2|psbeam)\.[\w.]+)'/g)].forEach(m => assert.ok(m[1].startsWith('psb2.'), `${f}: ${m[1]}`));
    if (f !== 'engine/legacy.js') assert.ok(!/'bridgeSuite\./.test(c), `${f}: a Bridge Suite key`);
    assert.ok(!/PBD\s*\.\s*(load|save|select|edit)\b|bridgeNav\s*\(/.test(c), `${f}: calls the old app's storage or navigation`);
  }
});

// PR 2a: the base girder design (plan §2.4): model.base = mergeInputs(DEFAULTS shape) of the moved engine, loaded before model.js
test('base design (PR 2a): a new project carries the old app\'s defaults; a PR 1 project without base reads with them; base is merged onto DEFAULTS', () => {
  const files = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge']
    .map(n => path.join(APP, `engine/pbd-${n}.js`));
  const E = loadShared(...files, path.join(APP, 'engine/model.js')), ME = E.PSBModel, D = J(E.mergeInputs(null));
  D.opt.hdCheck = true; D.opt.hdFrac = 0.75;   // PR 2d-3 (PS-10): the two fields model.js baseInputs adds to the old app's DEFAULTS (check on, 75 % W)
  const p = ME.defaultProject(); assert.equal(ME.validate(p).errors.length, 0);
  assert.deepEqual(J(p.base), D); assert.equal(p.base.girder, 'PCI BT-72'); assert.equal(p.base.L, 120); assert.equal(p.base.S, 9);   // = PR 1's default span and spacing
  assert.notEqual(p.base, E.mergeInputs(null));   // a copy, not the engine's DEFAULTS object
  const pr1 = M.defaultProject(); assert.equal(pr1.base, undefined);   // model.js alone (PR 1 shape)
  const s = store({ 'psb2.project.current': M.exportJSON(pr1) }), r = ME.load(s);
  assert.equal(r.source, 'saved'); assert.deepEqual(J(r.project.base), D); assert.deepEqual(J(r.project.xs), J(pr1.xs));
  assert.equal(s.getItem('psb2.project.current'), M.exportJSON(pr1));   // reading changes nothing stored
  const q = ME.defaultProject(); q.base = { girder: 'AASHTO Type IV', L: 85, mat: { fc: 7 } };
  const b = ME.importJSON(ME.exportJSON(q)).project.base;
  assert.equal(b.girder, 'AASHTO Type IV'); assert.equal(b.L, 85); assert.equal(b.mat.fc, 7); assert.equal(b.mat.fci, D.mat.fci); assert.deepEqual(J(b.rows), D.rows);
  const bad = ME.defaultProject(); bad.base = [1]; assert.equal(ME.validate(bad).errors[0].path, 'base');
  const R = E.computeAll(J(p.base)); assert.equal(R.error, null); assert.ok(R.checks.length > 10);   // the engine computes the base design
});
