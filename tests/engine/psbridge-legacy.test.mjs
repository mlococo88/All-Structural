// apps/ps-bridge PR 2f: "From the old app" (engine/legacy.js, window.PSBLegacy; docs/ps-bridge-plan.md §5 PR 2f, §2.4).
//   The converter over every harness case: the 658 cases of parity harness A (tests/engine/psbridge-cases.mjs: 38 recorded old saved designs,
//   600 seeded, 20 edge) as the old app saved them, and the 18 designs of harness B (tests/engine/psbridge-tab-cases.mjs) as the old app's
//   inputs. For each: the imported project's engine inputs computed = the old saved inputs computed (the moved engine, proven identical to
//   the old page by harness A), checked here independently of PSBLegacy.verify; where they differ the summary names why. Edge cases: missing
//   fields, the old app's own migrations (mergeInputs, opt.longAs, the older project list, a bridge model without inputs), unknown fields
//   kept and reported, MIDAS demands kept and not used, positions the girder count cannot give, one-span continuity. Storage read only.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { recordedCases, seededCases, edgeCases } from './psbridge-cases.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared(...PBDF, ...['sections', 'model', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'fields', 'inputcheck', 'legacy'].map(n => path.join(APP, `engine/${n}.js`)));
const LG = W.PSBLegacy, M = W.PSBModel, D = W.PSBDesign;
const J = v => JSON.parse(JSON.stringify(v));
// an independent exact comparison (Object.is per number: NaN, ±∞, −0 kept; functions left out)
const C = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v === null || typeof v !== 'object' ? (typeof v === 'function' ? '' : JSON.stringify(v))
  : Array.isArray(v) ? '[' + v.map(C).join(',') + ']' : '{' + Object.keys(v).filter(k => typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + C(v[k])).join(',') + '}';
const vals = R => { const o = Object.assign({}, R); delete o.warns; if (o.cont && o.cont.unit) o.cont = Object.assign({}, o.cont, { unit: Object.assign({}, o.cont.unit, { src: 0, assumed: 0, Lbridge: 0 }) }); return o; };
function store(init) {
  const m = new Map(Object.entries(init || {}));
  return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: () => { throw new Error('write to the old storage'); }, removeItem: () => { throw new Error('remove from the old storage'); }, clear: () => { throw new Error('clear'); } };
}
const kinds = (r, k) => J(r.summary.items.filter(i => i.kind === k).map(i => i.text));

test('harness B designs (18) as the old app\'s inputs: imported, the engine inputs and every value identical (results.same), PS-10 the only addition', () => {
  const cases = TAB_CASES(() => M.defaultProject());
  assert.equal(Object.keys(cases).length, 18);   // 18: PR A added the passing BIII-36 design
  for (const [name, P0] of Object.entries(cases)) {
    const old = D.inputs(P0), raw = J(old);   // what the old app saves (psbeam.inputs.v1) for this design
    const r = LG.convert({ inputs: raw, kind: 'autosave', key: 'psbeam.inputs.v1' });
    assert.equal(r.ok, true, name);
    const inp = D.inputs(r.project), a = J(inp), b = J(old);
    [a, b].forEach(o => { delete o.proj; if (o.opt) { delete o.opt.hdCheck; delete o.opt.hdFrac; } });
    assert.deepEqual(a, b, name + ': engine inputs');
    assert.equal(inp.proj.girderId, old.proj.girderId, name + ': girder label');
    assert.equal(r.project.base.opt.hdCheck, old.opt.hdCheck, name + ': PS-10 box kept'); assert.equal(r.project.base.opt.hdFrac, old.opt.hdFrac, name);
    const Ro = W.computeAll(J(old)), Rn = W.computeAll(J(inp));
    assert.equal(C(Rn), C(Ro), name + ': computeAll');
    const H = W.PSBHoldDown.compute(J(inp)), H0 = W.PSBHoldDown.compute(J(old));
    assert.equal(C(H.checks), C(H0.checks), name + ': checks with PS-10');
    const v = LG.verify(r); assert.equal(v.same, true, name); assert.equal(v.nChecks, Ro.checks.length);
    assert.deepEqual(kinds(r, 'diff'), [], name); assert.deepEqual(kinds(r, 'err'), [], name);
    assert.deepEqual(J(r.project.legacy.inputs), raw, name + ': kept as read');
    assert.deepEqual(J(M.validate(r.project).errors), [], name);
  }
});

test('harness A cases (658 old saved designs): every value identical, or the difference named in the summary (MIDAS demands not used; one-span continuity recorded)', () => {
  const cases = [...recordedCases(), ...seededCases(), ...edgeCases()];
  assert.equal(cases.length, 658);
  const tally = { same: 0, midas: 0, oneSpan: 0, inputDiff: 0, inputErr: 0 };
  for (const c of cases) {
    const raw = c.saved == null ? {} : J(c.saved), r = LG.convert({ inputs: raw, kind: 'file', label: c.name });
    assert.equal(r.ok, true, c.name);
    const old = J(W.mergeInputs(J(raw))), inp = D.inputs(r.project), WL = f => W.PSBSections.withLegacy(f), Ro = WL(() => W.computeAll(J(old))), Rn = WL(() => W.computeAll(J(inp)));   // PS-31: the old box / voided slab names with the old entries (as verify)
    const vs = C(vals(Ro)) === C(vals(Rn)), all = C(Ro) === C(Rn), v = LG.verify(r);
    assert.equal(v.same, all, c.name + ': verify'); assert.equal(v.values, vs, c.name + ': verify values');
    if (kinds(r, 'err').length) tally.inputErr++;
    if (all) { tally.same++; assert.deepEqual(kinds(r, 'diff'), [], c.name); continue; }
    if (r.extOn) { tally.midas++; assert.ok(kinds(r, 'diff').some(t => /MIDAS demands .* NOT used/.test(t)), c.name); assert.equal(r.project.base.external, null); assert.deepEqual(J(r.project.legacy.external), J(old.external)); continue; }
    // an input the imported project cannot hold as the old app saved it (blank text where the bridge needs a number): named, with its input error
    if (kinds(r, 'diff').length) { tally.inputDiff++; assert.ok(kinds(r, 'diff').every(t => /^Input /.test(t)), c.name); assert.ok(kinds(r, 'err').length, c.name); continue; }
    // the only other difference: one span entered with continuity on (the old app assumed [L, L]): every value the same
    assert.equal(vs, true, c.name + ': values'); tally.oneSpan++;
    assert.ok(kinds(r, 'note').some(t => /assumed two equal spans|the old app used L and warned/.test(t)), c.name);
    assert.deepEqual(J(r.project.spans.lengths.length >= 2), true);
  }
  assert.equal(tally.same + tally.midas + tally.oneSpan + tally.inputDiff, 658); console.log('       ' + JSON.stringify(tally));
  assert.ok(tally.midas >= 50 && tally.oneSpan >= 40 && tally.same >= 500, JSON.stringify(tally));
});

test('storage is read only: scan lists the design on screen, the shared projects and the older list; returned objects are copies', () => {
  const inp = J(W.mergeInputs(null)); inp.proj.name = 'Old A'; inp.L = 100;
  const b2 = J(inp); b2.L = 90; b2.proj.name = 'Shared B';
  const bridge = { v: 1, mode: 'pl', title: {}, spans: [90, 110], nGirders: 5, S: 9, sel: { g: 3, s: 1 }, designs: { 'G3/S1': b2, 'G1/S2': J(b2) }, projId: 'bp_1' };
  const reg = { bp_1: { name: 'Shared B', savedAt: '2026-11-01T10:00:00Z', slices: { psbeam: b2, psbeamBridge: bridge, mct: {} } },
    bp_2: { name: 'Bridge only', savedAt: '2026-11-03T10:00:00Z', slices: { psbeamBridge: Object.assign(J(bridge), { sel: { g: 1, s: 2 } }) } },
    bp_3: { name: 'Steel only', savedAt: '2026-11-04T10:00:00Z', slices: { girderdetail: {} } } };
  const lib = { p1: { name: 'Older C', savedAt: '2026-10-01T00:00:00Z', inp: Object.assign(J(inp), { L: 80 }) }, p2: { name: 'no design' } };
  const init = { 'psbeam.inputs.v1': JSON.stringify(inp), 'psbeam.bridge.v1': JSON.stringify(Object.assign(J(bridge), { projId: 'other' })), 'bridgeSuite.v1.projects': JSON.stringify(reg),
    'bridgeSuite.v1.currentProjectId': 'bp_1', 'psbeam.projects.v1': JSON.stringify(lib), 'psbeam.ui.v1': '{"tab":"x"}' };
  const s = store(init), before = new Map(s.m);
  const r = LG.scan(s);
  assert.deepEqual(J(r.items.map(i => i.id)), ['autosave', 'reg:bp_2', 'reg:bp_1', 'lib:p1']);
  // the design on screen: psbeam.bridge.v1 belongs to another project, so the open project's bridge slice (the old App() rule)
  assert.match(r.items[0].key, /psbeam\.inputs\.v1 \+ bridgeSuite\.v1\.projects › "Shared B" \(slice psbeamBridge\)/);
  assert.equal(r.items[0].bridge.projId, 'bp_1'); assert.equal(r.items[2].current, true);
  assert.equal(r.items[1].inputs, null); assert.equal(LG.designOf(r.items[1].bridge).L, 90);   // a project with only its bridge slice: the selected cell
  // the stored bridge model belongs to the open project: it is used
  const s2 = store(Object.assign({}, init, { 'psbeam.bridge.v1': JSON.stringify(bridge) })); assert.equal(LG.scan(s2).items[0].key, 'psbeam.inputs.v1 + psbeam.bridge.v1');
  r.items.forEach(i => { if (i.inputs) i.inputs.L = -1; });   // copies: the storage text is not changed
  assert.deepEqual(s.m, before);
  // each converts; nothing written (the store throws on a write)
  r.items.forEach(i => { const c = LG.convert(i); assert.equal(c.ok, true, i.id); LG.verify(c); });
  const c = LG.convert(LG.scan(s).items[2]);
  assert.equal(c.project.project.name, 'Shared B'); assert.deepEqual(J(c.project.spans.lengths), [90]); assert.equal(c.project.design.g, 3);
  assert.ok(kinds(c, 'kept').some(t => /1 other girder × span design \(G1\/S2\) kept in the project and restored as girder types on their lines/.test(t)));
  assert.ok(kinds(c, 'note').some(t => /old bridge bar's spans \(90, 110 ft\) are not the spans the design was computed with/.test(t)));
  assert.deepEqual(J(c.project.legacy.bridge), bridge);
  assert.deepEqual(s.m, before);
  // unreadable and missing keys: reported, nothing else
  const bad = LG.scan(store({ 'psbeam.inputs.v1': '{not json', 'bridgeSuite.v1.projects': '[1]' }));
  assert.deepEqual(J(bad.items), []); assert.match(bad.notes[0], /psbeam\.inputs\.v1 could not be read/);
  assert.deepEqual(J(LG.scan(store({}))), { items: [], notes: [] });
  const thrower = { getItem: () => { throw new Error('denied'); } }; assert.deepEqual(J(LG.scan(thrower)), { items: [], notes: [] });
});

test('old-app files: Export JSON (inputs), a bridge model; MIDAS demands, psb2 and other files refused', () => {
  const inp = J(W.mergeInputs(null)); inp.proj.name = 'File A';
  const a = LG.fromText(JSON.stringify(inp, null, 1), 'File_A.json');
  assert.equal(a.ok, true); assert.equal(a.src.kind, 'file'); assert.match(a.src.key, /File_A\.json.*Export JSON/);
  const c = LG.convert(a.src); assert.equal(c.ok, true); assert.equal(LG.verify(c).same, true); assert.equal(c.project.legacy.source.fileName, 'File_A.json');
  const br = { v: 1, mode: 'mod', title: {}, spans: [120], nGirders: 5, S: 9, sel: { g: 2, s: 1 }, designs: { 'G2/S1': inp } };
  const b = LG.fromText(JSON.stringify(br), 'bridge.json'); assert.equal(b.ok, true); assert.equal(b.src.inputs, null);
  const cb = LG.convert(b.src); assert.equal(cb.ok, true); assert.ok(kinds(cb, 'kept').some(t => /"Design modules"/.test(t)));
  assert.match(LG.fromText(JSON.stringify({ _schema: 'psbeam-external-demands', stations: [] })).error, /MIDAS demands file/);
  assert.match(LG.fromText(M.exportJSON(M.defaultProject())).error, /Import JSON/);
  assert.match(LG.fromText('{"a":1}').error, /Not a Prestressed Bridge Design/);
  assert.match(LG.fromText('nope').error, /Not a JSON file/);
  assert.equal(LG.convert({ inputs: null, bridge: null }).ok, false);
  // the page's Import JSON: an old file is refused by the model with the "From the old app" pointer (the page then imports it here)
  const m = M.importJSON(JSON.stringify(inp)); assert.equal(m.ok, false); assert.equal(m.legacy, 'Prestressed Bridge Design');
});

test('edge cases: missing fields filled as the old app does; opt.longAs; unknown fields kept and reported; label; positions and skews the bridge cannot give', () => {
  // an old, partial saved design (fields added to the old app later are missing): mergeInputs fills them, as the old app does
  const part = { girder: 'AASHTO Type IV', L: 90, S: 8, nGirders: 4, mat: { fc: 7 }, opt: { longAs: 4.5 }, rows: [{ n: 12, y: 2 }], loads: { pos: 'interior', skew: 15 }, proj: { name: 'Partial', girderId: 'Beam B' }, myNote: 'x', loads2: { a: 1 } };
  const r = LG.convert({ inputs: J(part), kind: 'file' }), v = LG.verify(r);
  assert.equal(v.same, true);
  assert.ok(kinds(r, 'mig').some(t => /take the old app's default/.test(t) && /cust\.h/.test(t)));
  assert.ok(kinds(r, 'mig').some(t => /opt\.longAs = 4\.5 read as the bottom tie steel opt\.longAsBot/.test(t)));
  assert.equal(r.project.base.opt.longAsBot, 4.5);
  assert.ok(kinds(r, 'kept').some(t => /myNote, loads2\.a/.test(t))); assert.equal(r.project.base.myNote, 'x');
  assert.ok(kinds(r, 'note').some(t => /Girder label: old "Beam B", now "G2 \(Interior\)"/.test(t)));
  assert.deepEqual(J(r.project.xs), { nb: 4, bays: [8, 8, 8], ohL: 3, ohR: 3, skews: [15, 15] });
  // a position two girders cannot give (interior with 2 girders) and a negative skew: imported, the differences listed, results differ
  const two = J(W.mergeInputs(null)); two.nGirders = 2; two.loads.pos = 'interior'; two.loads.skew = -20;
  const t = LG.convert({ inputs: two }), tv = LG.verify(t);
  assert.ok(kinds(t, 'diff').some(x => /position \(interior \/ exterior\): old "interior", imported "exterior" \(with 2 girders every girder is exterior\)/.test(x)));
  assert.ok(kinds(t, 'diff').some(x => /skew θ: old -20, imported 20/.test(x)));
  assert.equal(tv.values, false);
  // girder label G4 of 5, exterior → G1 (the label disagrees with the position); G5 exterior kept on the right
  const g = J(W.mergeInputs(null)); g.loads.pos = 'exterior'; g.proj.girderId = 'G4 (Exterior)'; assert.equal(LG.convert({ inputs: g }).project.design.g, 1);
  g.proj.girderId = 'G5 (Exterior)'; const g5 = LG.convert({ inputs: g }); assert.equal(g5.project.design.g, 5); assert.equal(LG.verify(g5).same, true);
  // one span with continuity on: two equal spans, every value the same, the old warning and record named
  const one = J(W.mergeInputs(null)); one.cont.on = true; const o = LG.convert({ inputs: one }), ov = LG.verify(o);
  assert.deepEqual(J(o.project.spans), { lengths: [120, 120], continuity: 'composite' }); assert.equal(ov.values, true); assert.equal(ov.same, false);
  assert.deepEqual(J(ov.recDiffs), ['cont.unit.src', 'cont.unit.assumed', 'cont.unit.Lbridge']);
  // an empty object: the old app's defaults; an input error is reported
  const e = LG.convert({ inputs: {} }); assert.equal(LG.verify(e).same, true);
  const bad = J(W.mergeInputs(null)); bad.S = -2; const be = LG.convert({ inputs: bad }); assert.ok(kinds(be, 'err').some(x => /Bay 1 spacing must be a positive number/.test(x)));
  // a project read back from its own JSON keeps the import record
  const back = M.importJSON(M.exportJSON(r.project)); assert.equal(back.ok, true); assert.deepEqual(J(back.project.legacy), J(r.project.legacy)); assert.deepEqual(J(back.project.base), J(r.project.base));
});

test('MIDAS demands: kept in the import record, not in the base design; spans from the imported member', () => {
  const rec = recordedCases().find(c => c.name === 'midas_3span');
  const r = LG.convert({ inputs: J(rec.saved) }), ext = rec.saved.external;
  assert.equal(r.project.base.external, null); assert.deepEqual(J(r.project.legacy.external), J(ext));
  assert.deepEqual(J(r.project.spans.lengths), J(W.PBD.extSpans(ext).map(q => q.len)).map((x, i) => i === r.project.design.s - 1 ? rec.saved.L : x));
  assert.equal(LG.verify(r).values, false);
});

// PR 3a-4 (PS-17): an old bridge model's other girder × span designs restored as girder types
test('3a-4 restore: the other cells of an old bridge model become girder types on their lines; each computed = the old app\'s cell (pl and mod)', () => {
  const B = W.PSBBridge, base = J(W.mergeInputs(null));
  const mk = (o) => Object.assign(J(base), o);
  // three spans, 5 girders: on screen G2/S1; stored G1/S1 (same inputs: exterior), G3/S1 (same), G4/S1 (f′c 9: its own type), G2/S2 (12 more ft? no: span from the bridge),
  // G5/S2 (shape AASHTO Type IV with y_end 44 → a shape different from G2/S2's type in span 2: input error PS-8), G7/S1 (beyond 5 girders), 'notes' (not a cell)
  const on = mk({ L: 100, S: 8, nGirders: 5, proj: { name: 'Old multi', girderId: 'G2 (Interior)' }, cont: Object.assign(J(base.cont), { on: false }) });
  const br = { v: 1, mode: 'pl', title: { name: 'Old multi' }, spans: [100, 110, 100], nGirders: 5, S: 8, sel: { g: 2, s: 1 },
    designs: { 'G2/S1': on, 'G1/S1': J(on), 'G3/S1': J(on), 'G4/S1': mk(Object.assign({}, J(on), { mat: Object.assign(J(base.mat), { fc: 9 }) })), 'G2/S2': J(on), 'G7/S1': J(on), notes: { a: 1 } } };
  const c = LG.convert({ inputs: J(on), bridge: J(br), kind: 'autosave', key: 'psbeam.inputs.v1 + psbeam.bridge.v1' });
  assert.equal(c.ok, true);
  const P = c.project; P.spans.lengths = [100, 110, 100]; P.xs.skews = [0, 0, 0, 0];   // the bridge of the old model (the import takes the design's spans)
  const text = LG.restore(P, '2026-11-13T12:00:00Z');
  assert.match(text, /Restored from the old app's bridge model \(PS-17\): 4 more girder × span designs/);
  assert.match(text, /G7\/S1 \(beyond this bridge/); assert.match(text, /notes \(not a girder × span cell\)/);
  const lab = P.types.map(t => `${t.label}:${t.span}:${t.lines.join('')}:${Object.keys(t.ovr).join(',')}`);
  assert.deepEqual(J(lab), ['Interior S1:1:23:', 'Exterior S1 (old G1):1:1:', 'Interior S1 (old G4):1:4:mat.fc', 'Interior S2 (old G2):2:2:']);
  // each restored cell = the old app's 'pl' cell (PBD.applyBridge on the old model), every value
  P.legacy.restored.cells.forEach(q => assert.equal(q.same, true, `${q.key}: ${q.why}`));
  const k = B.typeAt(P, 1, 4), a = W.computeAll(J(D.cellInputs(P, k, 4))), b = W.computeAll(J(W.PBD.applyBridge(br, J(W.mergeInputs(J(br.designs['G4/S1']))), 4, 1)));
  assert.equal(LG.canon(Object.assign({}, a, { warns: 0 })), LG.canon(Object.assign({}, b, { warns: 0 })));
  // the design on screen unchanged
  assert.equal(B.shown(P).g, 2); assert.equal(P.legacy.restored.cells.length, 4);
  // not twice; the old data as read untouched
  assert.equal(LG.restore(P), ''); assert.deepEqual(J(P.legacy.bridge), J(br));
  // opened from a saved file (an import made before 3a-4): restored on load, with the notice
  const Q = c.project; delete Q.legacy.restored; Q.types = undefined; delete Q.types;
  const r = M.importJSON(M.exportJSON(Object.assign(J(c.project), { types: undefined, legacy: Object.assign(J(c.project.legacy), { restored: undefined }) })));
  assert.equal(r.ok, true); assert.ok(r.notes.some(n => /Restored from the old app's bridge model/.test(n))); assert.ok(r.project.types.length >= 3);
  // 'mod' (Design modules): each cell keeps its own L / S: restored on this bridge's values, the difference named
  const brm = Object.assign(J(br), { mode: 'mod', designs: { 'G2/S1': on, 'G3/S1': Object.assign(J(on), { S: 9.5 }) } });
  const cm = LG.convert({ inputs: J(on), bridge: brm, kind: 'autosave', key: 'k' }); cm.project.spans.lengths = [100, 110, 100]; cm.project.xs.skews = [0, 0, 0, 0];
  const tm = LG.restore(cm.project); assert.match(tm, /0 of 1 compute the same as the old app; different: G3\/S1 \(girder spacing S old 9\.5, here 8/);
});
