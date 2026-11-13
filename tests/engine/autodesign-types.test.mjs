// SB-2 PR 3 (2026-11-13; engineer decision SB-2, 2026-11-12: Auto design sizes each girder type for its worst assigned line, every type in
// one run or the selected type): apps/steel-bridge engine/autodesign.js typeScope, typeProject, typeOpt, detBack, applyType.
// 1. A project saved before girder types (no girders[i].lines) keeps the Auto design of before ('together': run(P) unchanged); a project
//    with an assigned line is designed per type ('each').
// 2. typeProject(P, t): one plate girder per line of type t (that line's loads and LLDF), the type's stiffener bays and splice entries on
//    each, the other types kept in place (adFixed: not designed, not checked); with more than one type the bridge-wide variables locked; one type: the girder count locked.
// 3. The run project of a type works each line as the Summary does: analyzeGirder(typeProject(P, t), k) = analyzeGirder(atLine(P, t, j), t),
//    with the types' plates different (the other types stay in the run with their own plates: the cross-frame model reads them).
// 4. A run (Refine) for the Exterior type of a new project: every candidate passes the full check on both its lines; applyType writes
//    that type's plates only; the type then computes on its lines what the run checked.
// 5. One type on every line: apply() as before, its details mapped back to the type (detBack).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT, plain } from './harness.mjs';

const E = p => path.join(ROOT, 'apps/steel-bridge', p);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/constructibility.js', 'engine/splices.js',
  'engine/rating.js', 'engine/welds.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/splices.js', 'ui/flexure.js', 'ui/rating.js', 'ui/welds.js', 'engine/splplace.js', 'engine/autodesign.js'].map(E));   // as tests/engine/autodesign.test.mjs adWindow
const AD = W.SBDAutoDesign, M = W.SBDModel, AN = W.SBDAnalysis, J = o => JSON.parse(JSON.stringify(o));
const anKey = R => JSON.stringify({ ...plain(R), girder: { ...plain(R.girder), id: null, label: null, lines: null, adLines: null }, gi: null });   // adLines: SBXF2, the type's lines on a run copy   // the girder's identity (id, label, lines; its index) aside

test('typeScope: a saved project (no lines) as before; a new project per type', () => {
  const P = M.defaultProject(); assert.equal(AD.typeScope(P), 'together');
  const L = M.defaultProject(); M.addType(L, 0, { label: 'B' }); delete L.girders[1].lines; L.girders[1].line = 0; assert.equal(AD.typeScope(L), 'together', 'two girders saved before types');
  assert.equal(AD.typeScope(M.newProject()), 'each');
  assert.deepEqual(J(AD.typeOpt(M.newProject())), { oneLine: false, details: false }); assert.deepEqual(J(AD.typeOpt(M.defaultProject())), {});
});

test('typeProject: a plate girder per line of the type, its bays and splice entries on each, bridge-wide variables locked', () => {
  const P = M.newProject(); P.stiffeners.layout.bays = [{ g: 1, a: 0, b: 25, n: 1 }, { g: 2, a: 0, b: 30, n: 2 }];
  P.splices.plates = [{ x: 82, g: 1, top: { nl: 2 } }, { x: 82, g: 0 }, { x: 145 }];
  P.autodesign = { vars: { nb: { mode: 'range', min: 4, max: 6 }, tw: { mode: 'lock' }, 'bt#2': { mode: 'range', min: 14, max: 18 }, 'spl#1': { mode: 'auto' } } };
  const t0 = JSON.stringify(P), Q = AD.typeProject(P, 1);
  assert.equal(JSON.stringify(P), t0, 'P not changed');
  assert.deepEqual(J(Q.girders.map(g => [g.id, g.line, g.lines, g.position, g.label, !!g.adFixed])), [['G1', 1, [1, 2, 3], 'interior', 'Interior', true], ['G2', 0, [0], 'exterior', 'Exterior on G1', false], ['G2@5', 4, [4], 'exterior', 'Exterior on G5', false]]);
  Q.girders.slice(1).forEach(g => assert.deepEqual(J(g.segments), J(P.girders[1].segments)));
  assert.deepEqual(J(Q.stiffeners.layout.bays), [{ g: 1, a: 0, b: 25, n: 1 }, { g: 2, a: 0, b: 30, n: 2 }, { g: 3, a: 0, b: 30, n: 2 }]);
  assert.deepEqual(J(Q.splices.plates), [{ x: 82, g: 1, top: { nl: 2 } }, { x: 82, g: 2, top: { nl: 2 } }, { x: 82, g: 0 }, { x: 145 }]);
  const V = Q.autodesign.vars; AD.TYPE_LOCK.forEach(id => assert.deepEqual(J(V[id]), { mode: 'lock' }, id));
  assert.ok(!V['spl#1'], 'a per-span entry of a locked variable removed'); assert.deepEqual(J(V.tw), { mode: 'lock' }); assert.deepEqual(J(V['bt#2']), { mode: 'range', min: 14, max: 18 }, 'plate locks and ranges as set');
  const I = AD.typeProject(P, 0); assert.deepEqual(J(I.girders.map(g => [g.line, !!g.adFixed])), [[1, false], [2, false], [3, false], [0, true]]);
  assert.deepEqual(J(AD.layoutOf(Q)), J(AD.layoutOf({ ...P, girders: [P.girders[1]] })), 'the layout is the type\'s');
  const S = AD.varsOf(Q, AD.settings(Q)); assert.equal(S.nb.mode, 'lock'); assert.equal(S.tw.mode, 'lock'); assert.equal(S.bt.mode, 'auto');
  // one type on every line: only the girder count locked
  const O = M.defaultProject(); M.setLines(O, 0, [0, 1, 2, 3, 4]); O.autodesign = { vars: { oh: { mode: 'auto' } } };
  const QO = AD.typeProject(O, 0); assert.equal(QO.girders.length, 5); assert.deepEqual(J(QO.autodesign.vars), { oh: { mode: 'auto' }, nb: { mode: 'lock' } });
  // a type with no line: its design line
  const U = M.defaultProject(); M.addType(U, 0, { label: 'none' }); assert.deepEqual(J(AD.typeProject(U, 1).girders.map(g => [g.line, !!g.adFixed])), [[null, true], [1, false]]);   // the other type as saved (no line field: its automatic line)
});

test('the run project works each line as the Summary does (atLine), the other types kept with their own plates', () => {
  // Interior shallower than Exterior: the cross-frame depth (each bay the shallower of its two girders, SBXF 2026-11-13; before: girders[0]) and
  // layout (every girder) read the other type, so it stays in the run
  const P = M.newProject(); P.girders[0].segments.forEach(s => { s.botT = +s.botT + 0.25; s.D = +s.D - 6; });
  const Q = AD.typeProject(P, 1), QI = AD.typeProject(P, 0);
  [[1, 0], [2, 4]].forEach(([k, j]) => assert.equal(anKey(AN.analyzeGirder(Q, k)), anKey(AN.analyzeGirder(M.atLine(P, 1, j), 1)), `Exterior on G${j + 1}`));
  assert.equal(anKey(AN.analyzeGirder(QI, 2)), anKey(AN.analyzeGirder(M.atLine(P, 0, 3), 0)), 'Interior on G4');
  const Q1 = J(Q); Q1.girders = Q1.girders.slice(1);   // without the other type, Exterior's cross-frame weight would change (the shallower Interior sets the bays' depth)
  assert.notEqual(anKey(AN.analyzeGirder(Q1, 1)), anKey(AN.analyzeGirder(Q, 2)), 'Exterior alone differs');
});

function runAD(P, settings, opt) { const it = AD.run(P, { settings, maxIt: 5, trimTries: 2, ...(opt || {}) }); let s; while (!(s = it.next()).done); return s.value; }

test('Refine for the Exterior type of a new project: candidates pass on both lines; Apply writes that type\'s plates only', () => {
  const P = M.newProject(), Q = AD.typeProject(P, 1), R = runAD(Q, { mode: 'refine', topN: 1 }, AD.typeOpt(P));
  assert.ok(R.cands.length >= 1, `no candidate: ${R.note}`);
  const c = R.cands[0], QC = AD.projectWith(Q, c.L, c.det), E2 = AD.evaluate(QC, { level: 'full', ctx: {} });
  assert.ok(E2.pass, `candidate fails: ${JSON.stringify(E2.fails.slice(0, 3))}`);
  assert.equal(c.L.nb, P.xs.nb); assert.equal(c.L.minLines, null, 'no 1-gage-line variant with several types');
  const G = AD.applyType(P, 1, Q, c).girders;
  assert.deepEqual(J(G[1].segments), J(AD.segmentsOf(c.L))); assert.deepEqual(J(G[0]), J(P.girders[0]), 'Interior not changed');
  assert.deepEqual(J({ ...G[1], segments: null }), J({ ...P.girders[1], segments: null }), 'only the plates of Exterior');
  // the applied type on its lines, as the Summary runs it (atLine), equals the run's full check of the candidate
  const PA = { ...J(P), girders: J(G) };
  [[1, 0], [2, 4]].forEach(([k, j]) => assert.equal(anKey(AN.analyzeGirder(M.atLine(PA, 1, j), 1)), anKey(AN.analyzeGirder(QC, k)), `applied, line G${j + 1}`));
  assert.equal(E2.mods && Object.keys(E2.mods).some(k => /0$/.test(k)), false, 'the other type (index 0) not checked');
  console.log(`       (Exterior on G1, G5: D ${c.D} in, ratio ${c.ratio.toFixed(3)}, governing ${c.gov ? `${c.gov.mod} ${c.gov.id} ${c.gov.gl || ''}` : '—'})`);
});

test('One type on every line: apply() as before, details mapped back to the type (detBack)', () => {
  const det = { inputs: { stiffeners: { layout: { bays: [{ g: 1, a: 0, b: 25, n: 1 }, { g: 2, a: 0, b: 25, n: 1 }] } }, splices: { plates: [{ x: 1 }, { x: 2, g: 0 }, { x: 2, g: 1 }] } }, rows: [], notes: [] };
  assert.deepEqual(J(AD.detBack(det, 2).inputs), { stiffeners: { layout: { bays: [{ g: 3, a: 0, b: 25, n: 1 }] } }, splices: { plates: [{ x: 1 }, { x: 2, g: 2 }] } });
  const P = M.defaultProject(); M.setLines(P, 0, [0, 1, 2, 3, 4]); const Q = AD.typeProject(P, 0), L = AD.layoutOf(Q); L.bot = L.bot.map(z => ({ ...z, t: z.t + 0.125 }));
  const c = { L, cost: AD.costOf(L, AD.settings(Q), 0), det: null }, Wr = AD.applyType(P, 0, Q, c), A = AD.apply(P, c).project;
  assert.deepEqual(J(Object.keys(Wr).sort()), J(['autodesign', ...AD.APPLY_KEYS].sort()));
  AD.APPLY_KEYS.forEach(k => assert.equal(JSON.stringify(Wr[k]), JSON.stringify(A[k]), k)); assert.deepEqual(J(Wr.girders[0].lines), [0, 1, 2, 3, 4]);
  assert.ok(Wr.autodesign.undo, 'one-step undo kept');
});
