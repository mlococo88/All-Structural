// apps/ps-bridge PR 3a-1: girder types on the girder lines of each span (engine/bridge.js, window.PSBBridge; docs/ps-bridge-plan.md §5 PR 3a;
//   engineer decision PS-8; the Steel Bridge app's girder types SB-2, SB-14, SB-15 as the pattern).
//   1. A project saved before PR 3a (no types) is migrated on load: its design girder = type T1 on that line, no override; the engine inputs
//      of every saved design (the 18 harness B designs, each girder line of each) are byte-identical to PR 2b's (PSBDesign.one) and so is
//      computeAll (independent exact comparison).
//   2. A new project: Interior and Exterior per span; each cell = the old app's 'pl' design of that girder × span (PSBDesign.one).
//   3. Overrides (effBase / diffOvr / setOvr / resetKey), the same shape per span (PS-8), assignments (setLines, addType, deleteType, fill),
//      the girder count (renumber, SB-14) and span count (syncSpans) changes, the input checks (two types on a line, SB-15; shapes; a type's
//      own field errors), malformed stored types kept (typesBad).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared(...PBDF, ...['sections', 'model', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'fields', 'inputcheck', 'legacy'].map(n => path.join(APP, `engine/${n}.js`)));
const M = W.PSBModel, D = W.PSBDesign, B = W.PSBBridge;
const J = v => JSON.parse(JSON.stringify(v));
// an independent exact comparison (Object.is per number: NaN, ±∞, −0 kept; functions left out)
const C = v => typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : v === null || typeof v !== 'object' ? (typeof v === 'function' ? '' : JSON.stringify(v))
  : Array.isArray(v) ? '[' + v.map(C).join(',') + ']' : '{' + Object.keys(v).filter(k => typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + C(v[k])).join(',') + '}';
const errs = P => W.PSBInputCheck.collect(P).errors;
const load = P => M.importJSON(M.exportJSON(P)).project;   // what the page opens (load = importJSON of the stored text)

test('a project saved before PR 3a: migrated on load to type T1 on its design line; engine inputs byte-identical (18 designs), computeAll identical', () => {
  const cases = TAB_CASES(() => M.defaultProject());
  let n = 0;
  for (const [name, P0] of Object.entries(cases)) {
    assert.equal(P0.types, undefined, name);
    const P = load(P0), d = D.sel(P0);
    assert.ok(B.hasTypes(P), name + ': migrated');
    assert.deepEqual(J(P.types), [{ id: 'T1', label: `${d.g === 1 || d.g === P.xs.nb ? 'Exterior' : 'Interior'} S${d.s}`, span: d.s, lines: [d.g], ovr: {} }], name);
    assert.deepEqual(J(P.design), J({ g: d.g, s: d.s }), name);
    const a = D.inputs(P), b = D.one(P0);
    assert.equal(JSON.stringify(a), JSON.stringify(b), name + ': engine inputs (text, key order)');
    assert.equal(C(W.computeAll(J(a))), C(W.computeAll(J(b))), name + ': computeAll');
    assert.equal(C(W.PSBHoldDown.compute(J(a))), C(W.PSBHoldDown.compute(J(b))), name + ': + PS-10');
    assert.deepEqual(J(errs(P)), J(errs(P0)), name + ': input errors');
    // the stored text after the migration: the old fields unchanged, types added
    const o = J(P0), q = J(P); delete q.types; assert.deepEqual(q, Object.assign(o, { design: q.design }), name + ': nothing else changed');
    n++;
  }
  assert.equal(n, 18);
});

test('every girder line of every span of the 18 designs as a type: cell inputs = the PR 2b design of that girder × span (PSBDesign.one)', () => {
  const cases = TAB_CASES(() => M.defaultProject());
  let cells = 0;
  for (const [name, P0] of Object.entries(cases)) {
    const P = load(P0); B.fill(P);
    assert.equal(B.unassigned(P).length, 0, name);
    for (const c of B.cells(P)) {
      const a = D.cellInputs(P, c.k, c.g), b = D.one(Object.assign({}, P0, { design: { g: c.g, s: c.s } }));
      assert.equal(JSON.stringify(a), JSON.stringify(b), `${name}: G${c.g}/S${c.s}`); cells++;
    }
  }
  assert.ok(cells > 100, `${cells} cells`);
});

test('new project: Interior S1 on G2–G4, Exterior S1 on G1, G5; the shown cell = the old default design; no input error', () => {
  const P = M.newProject();
  assert.deepEqual(J(P.types), [{ id: 'T1', label: 'Interior S1', span: 1, lines: [2, 3, 4], ovr: {} }, { id: 'T2', label: 'Exterior S1', span: 1, lines: [1, 5], ovr: {} }]);
  assert.deepEqual(J(errs(P)), []);
  assert.equal(JSON.stringify(D.inputs(P)), JSON.stringify(D.one(M.defaultProject())));
  assert.deepEqual(J(B.cells(P).map(c => [c.label, c.g])), [['Interior S1', 2], ['Interior S1', 3], ['Interior S1', 4], ['Exterior S1', 1], ['Exterior S1', 5]]);
  const e5 = D.cellInputs(P, 1, 5); assert.equal(e5.loads.pos, 'exterior'); assert.equal(e5.proj.girderId, 'G5 (Exterior)'); assert.equal(e5.deck.oh, 3);
  // the stored text reads back the same (no migration of a project with types)
  assert.deepEqual(J(load(P)), J(P));
  // load() with nothing stored: newProject
  const st = { getItem: () => null, setItem: () => {} }; assert.deepEqual(J(M.load(st).project.types), J(P.types));
  // 2 girders: Exterior only; 3 spans: a pair per span
  const Q = M.defaultProject(); Q.xs = { nb: 2, bays: [8], ohL: 3, ohR: 3, skews: [0, 0, 0] }; Q.spans = { lengths: [80, 90], continuity: 'composite' };
  assert.deepEqual(J(B.newTypes(Q)), [{ id: 'T1', label: 'Exterior S1', span: 1, lines: [1, 2], ovr: {} }, { id: 'T2', label: 'Exterior S2', span: 2, lines: [1, 2], ovr: {} }]);
});

test('overrides: a type\'s own inputs = base ⊕ ovr; setOvr keeps only differences; a shape entered for one type goes to every type of its span (PS-8); reset', () => {
  const P = M.newProject();
  const V = B.effBase(P, 1); V.mat.fc = 9; V.rows = [{ n: 12, y: 2, dbnd: 0, nd: 0 }]; V.harp.n = 8;
  B.setOvr(P, 1, V);
  assert.deepEqual(J(P.types[1].ovr), { 'mat.fc': 9, rows: [{ n: 12, y: 2, dbnd: 0, nd: 0 }], 'harp.n': 8 });
  const e = D.cellInputs(P, 1, 1); assert.equal(e.mat.fc, 9); assert.equal(e.harp.n, 8); assert.equal(e.rows.length, 1);
  assert.equal(JSON.stringify(Object.keys(e)), JSON.stringify(Object.keys(D.one(M.defaultProject()))), 'key order kept');
  assert.equal(D.cellInputs(P, 0, 2).mat.fc, P.base.mat.fc, 'the other type unchanged');
  // a value set back to the base's: no longer an override
  const V2 = B.effBase(P, 1); V2.mat.fc = P.base.mat.fc; B.setOvr(P, 1, V2); assert.equal('mat.fc' in P.types[1].ovr, false);
  // shape: PS-8
  const V3 = B.effBase(P, 1); V3.girder = 'PCI BT-63'; B.setOvr(P, 1, V3);
  assert.equal(P.types[0].ovr.girder, 'PCI BT-63'); assert.deepEqual(J(errs(P)), []);
  P.types[0].ovr.girder = 'PCI BT-72';
  assert.ok(errs(P).some(x => /different girder shapes/.test(x.msg) && x.path === 'types.1.ovr.girder'));
  B.resetKey(P, 0, 'girder'); assert.equal('girder' in P.types[1].ovr, false, 'reset a shape key: every type of the span');
  B.resetKey(P, 1, 'rows'); assert.equal('rows' in P.types[1].ovr, false);
  assert.equal(B.ovrKeyOf('base.rows.0.n'), 'rows'); assert.equal(B.ovrKeyOf('base.loads.diaph.1.a'), 'loads.diaph'); assert.equal(B.ovrKeyOf('base.mat.fc'), 'mat.fc');
});

test('a type\'s own field errors: named for the type, scope = its id; the base not blocked by them twice', () => {
  const P = M.newProject();
  P.types[1].ovr['mat.fc'] = '';
  const E = errs(P);
  assert.equal(E.length, 1); assert.equal(E[0].path, 'base.mat.fc'); assert.equal(E[0].scope, 'T2'); assert.match(E[0].msg, /^Girder type Exterior S1: /);
  P.base.mat.fc = ''; const E2 = errs(P); assert.equal(E2.filter(x => x.path === 'base.mat.fc').length, 1, 'the same error once (the base)');
});

test('assignments: setLines moves a line (SB-2), two types on one line an input error (SB-15), addType / deleteType, fill', () => {
  const P = M.newProject();
  B.assignLine(P, 1, 3);
  assert.deepEqual(J(B.typeLines(P, 0)), [2, 4]); assert.deepEqual(J(B.typeLines(P, 1)), [1, 3, 5]);
  P.types[0].lines.push(3);
  const E = errs(P); assert.ok(E.some(x => x.path === 'types.1.lines' && /line G3 has 2 girder types \(Interior S1, Exterior S1\)/.test(x.msg)), J(E));
  P.types[0].lines = [2, 4];
  const k = B.addType(P, 0, { label: 'G4 own', lines: [4] });
  assert.deepEqual(J(B.typeLines(P, 0)), [2]); assert.deepEqual(J(P.types[k]), { id: 'T3', label: 'G4 own', span: 1, lines: [4], ovr: {} });
  assert.equal(B.deleteType(P, k, 0), true); assert.deepEqual(J(B.typeLines(P, 0)), [2, 4]);
  P.types[0].lines = [2]; assert.deepEqual(J(B.unassigned(P)), [{ s: 1, g: 4 }]);
  assert.match(errs(P).length ? 'x' : '', /^$/, 'a line with no type is not an error');
  assert.ok(W.PSBInputCheck.collect(P).warnings.some(w => /G4\/S1/.test(w.msg)));
  assert.deepEqual(J(B.fill(P)), [{ s: 1, g: 4, label: 'Interior S1', created: false }]);
});

test('girder count change (SB-14): outer lines keep the exterior types, inner lines Interior; beyond N_b removed; span count change: copies', () => {
  const P = M.newProject(), LT = B.snapshot(P);
  P.xs.nb = 6; P.xs.bays = [9, 9, 9, 9, 9];
  const ch = B.renumber(P, 5, LT);
  assert.deepEqual(J(B.typeLines(P, 0)), [2, 3, 4, 5]); assert.deepEqual(J(B.typeLines(P, 1)), [1, 6]);
  assert.deepEqual(J(ch), [{ s: 1, g: 5, from: 'Exterior S1', to: 'Interior S1' }, { s: 1, g: 6, from: null, to: 'Exterior S1' }]);
  const Q = M.newProject(), LQ = B.snapshot(Q); Q.xs.nb = 3; Q.xs.bays = [9, 9];
  B.renumber(Q, 5, LQ); assert.deepEqual(J(B.typeLines(Q, 0)), [2]); assert.deepEqual(J(B.typeLines(Q, 1)), [1, 3]); assert.deepEqual(J(Q.types[0].lines), [2]);
  // 2 → 4 girders: no interior type yet: a new one, a copy of the exterior
  const R = M.defaultProject(); R.xs = { nb: 2, bays: [8], ohL: 3, ohR: 3, skews: [0, 0] }; R.types = B.newTypes(R); R.types[0].ovr = { 'mat.fc': 9 };
  const LR = B.snapshot(R); R.xs.nb = 4; R.xs.bays = [8, 8, 8]; B.renumber(R, 2, LR);
  assert.deepEqual(J(R.types.map(t => [t.label, t.lines, t.ovr])), [['Exterior S1', [1, 4], { 'mat.fc': 9 }], ['Interior S1', [2, 3], { 'mat.fc': 9 }]]);
  // spans 1 → 3: the new spans copy span 1's types; back to 1: kept, not checked
  const S = M.newProject(); S.spans.lengths = [120, 100, 100]; S.xs.skews = [0, 0, 0, 0];
  assert.deepEqual(J(B.syncSpans(S)), [{ s: 2, labels: ['Interior S2', 'Exterior S2'] }, { s: 3, labels: ['Interior S3', 'Exterior S3'] }]);
  assert.equal(B.cells(S).length, 15); assert.deepEqual(J(errs(S)), []);
  S.spans.lengths = [120]; S.xs.skews = [0, 0]; assert.equal(B.cells(S).length, 5); assert.equal(S.types.length, 6, 'kept');
  assert.deepEqual(J(B.syncSpans(S)), []);
});

test('stored types that cannot be read are kept (typesBad), the design girder made type T1; validate', () => {
  const P = M.defaultProject(); P.types = [{ id: 'T1', span: 'one', lines: [1] }];
  const r = M.importJSON(M.exportJSON(P));
  assert.equal(r.ok, true); assert.deepEqual(J(r.project.typesBad), J(P.types)); assert.equal(r.project.types.length, 1); assert.equal(r.notes.length, 1);
  assert.ok(M.validate(Object.assign(J(r.project), { types: 'x' })).errors.some(e => e.path === 'types'));
});

// ---------- PR 3a-2: every type on every line; unequal bays; different end skews ----------
test('3a-2 unequal bays: S per line = the exterior bay / the mean of the two bays; an interior line with mean 9 ft = the 9 ft equal-bay design exactly', () => {
  const P = M.newProject(); P.xs.bays = [8, 10, 10, 8];
  assert.deepEqual(J(errs(P)), []);
  assert.deepEqual([1, 2, 3, 4, 5].map(g => D.lineS(P, g)), [8, 9, 10, 9, 8]);
  const Q = M.newProject();   // equal 9 ft bays
  const a = D.cellInputs(P, 0, 2), b = D.cellInputs(Q, 0, 2);
  assert.equal(a.S, 9); assert.equal(JSON.stringify(a), JSON.stringify(b), 'G2 of 8-10-10-8 = G2 of 9-9-9-9 (inputs)');
  assert.equal(C(W.computeAll(J(a))), C(W.computeAll(J(b))));
  const g3 = W.computeAll(J(D.cellInputs(P, 0, 3))), r3 = W.computeAll(J(Object.assign(D.cellInputs(Q, 0, 3), { S: 10 })));
  assert.equal(C(g3), C(r3), 'G3: the 10 ft design');
  const e = D.cellInputs(P, 1, 1); assert.equal(e.S, 8); assert.equal(e.loads.pos, 'exterior');
});

test('3a-2 different skews at a span\'s supports: the larger |θ|; ≥ 30° with the DF computed an input error, entered DF allowed', () => {
  const P = M.newProject(); P.xs.skews = [10, 20];
  assert.deepEqual(J(errs(P)), []); assert.equal(D.inputs(P).loads.skew, 20);
  const Q = M.newProject(); Q.xs.skews = [20, 20]; assert.equal(C(W.computeAll(J(D.inputs(P)))), C(W.computeAll(J(D.inputs(Q)))), 'below 30°: = the 20° design');
  P.xs.skews = [20, 35];
  assert.ok(errs(P).some(x => x.path === 'xs.skews' && /larger is 30° or more/.test(x.msg)));
  P.base.loads.dfAuto = false; P.base.loads.dfm = 0.7; P.base.loads.dfv = 0.8;
  assert.deepEqual(J(errs(P)), []);
  P.base.loads.dfAuto = true; P.types.forEach(t => { t.ovr['loads.dfAuto'] = false; t.ovr['loads.dfm'] = 0.7; t.ovr['loads.dfv'] = 0.8; });
  assert.deepEqual(J(errs(P)), [], 'every type of the span with its DF entered');
});

test('3a-2 results: every type on every line, each check\'s worst line, weights per line and the bridge total', () => {
  const P = M.newProject(); P.xs.bays = [8, 10, 10, 8];
  const A = B.results(P, i => W.PSBHoldDown.compute(J(i)));
  assert.equal(A.n, 5); assert.equal(A.types.length, 2);
  A.cells.forEach(c => assert.equal(C(c.R), C(W.PSBHoldDown.compute(J(D.cellInputs(P, c.k, c.g)))), `G${c.g}`));
  const I = A.types[0];
  for (const [n, v] of Object.entries(I.gov)) {
    const rs = I.cells.map(c => c.R.checks.find(q => q.n === n)).filter(Boolean), mx = Math.max(...rs.map(q => q.r));
    assert.equal(v.c.r, mx, n); assert.equal(v.cell.R.checks.find(q => q.n === n).r, mx);
  }
  assert.equal(I.gov['Flexure'].g, 3, 'interior flexure governs on G3 (S = 10 ft)');
  const w = A.cells[0].R.g.wsw * 120; A.cells.forEach(c => assert.ok(Math.abs(c.W - w) < 1e-9));
  assert.ok(Math.abs(A.W - 5 * w) < 1e-9); assert.ok(Math.abs(I.W - 3 * w) < 1e-9);
});
