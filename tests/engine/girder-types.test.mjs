// SB-2 (2026-11-12, engineer: girder types): apps/steel-bridge engine/model.js typeLines, lineTypes, unassigned, setLines, assignLine,
// addType, deleteType, newProject, atLine, tribBeff; engine/drawings.js plateGirderOf with girders[i].lines.
// 1. A saved project (no `lines`) reads as before: one type on its line (or the automatic line); the other lines are unassigned; nothing is
//    written on read. 2. Assignments keep each line on one type. 3. Add / delete keep the stiffener bays and splice plate entries with
//    their type. 4. newProject(): Interior (the default girder unchanged) on G2–G4, Exterior on G1 and G5. 5. atLine: a read view whose
//    girder line reads j; the design line is the project itself; the analysis of the view equals that of a project stored with that line.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', ENG('model.js'), ENG('sections.js'), ENG('owners.js'), ENG('lldf.js'), ENG('loads.js'), ENG('analysis.js'), ENG('framing.js'), ENG('drawings.js'));
const M = W.SBDModel, J = o => JSON.parse(JSON.stringify(o));

test('a saved project (no lines) reads as one type on its line; the other lines unassigned; nothing written', () => {
  const P = M.defaultProject(), t0 = JSON.stringify(P);
  assert.deepEqual(J(M.typeLines(P, 0)), [1]); assert.deepEqual(J(M.unassigned(P)), [0, 2, 3, 4]);
  assert.deepEqual(J(M.lineTypes(P)), [[], [0], [], [], []]);
  P.girders[0].position = 'exterior'; assert.deepEqual(J(M.typeLines(P, 0)), [0]); P.girders[0].position = 'interior';
  P.girders[0].line = 3; assert.deepEqual(J(M.typeLines(P, 0)), [3]); delete P.girders[0].line;
  assert.equal(JSON.stringify(P), t0, 'read only');
  assert.deepEqual(J(M.validate(P).errors), []);
});

test('assignments: each line on one type, the design line kept or the first line', () => {
  const P = M.defaultProject(); const e = M.addType(P, 0, { label: 'Exterior', lines: [0, 4] });
  assert.equal(e, 1); assert.deepEqual(J(M.unassigned(P)), [2, 3]);
  M.setLines(P, 0, [1, 2, 3]); assert.deepEqual(J(M.unassigned(P)), []); assert.equal(P.girders[0].line, 1, 'design line written as the automatic one');
  M.assignLine(P, 1, 1); assert.deepEqual(J(P.girders[0].lines), [2, 3]); assert.equal(P.girders[0].line, 2, 'design line moves to the first remaining line');
  assert.deepEqual(J(M.lineTypes(P)), [[1], [1], [0], [0], [1]]);
  P.xs.nb = 4; P.xs.bays = [9.5, 9.5, 9.5]; assert.deepEqual(J(M.typeLines(P, 1)), [0, 1], 'a line beyond N_b is not read'); assert.deepEqual(J(P.girders[1].lines), [0, 1, 4], '... but kept');
  assert.deepEqual(J(M.validate(P).errors), []);
  const Q = M.defaultProject(); Q.girders[0].lines = [1, 'x']; assert.ok(M.validate(Q).errors.some(x => x.path === 'girders.0.lines'));
});

test('addType copies plates, stiffener bays and splice entries; deleteType moves the lines and renumbers', () => {
  const P = M.defaultProject(); P.stiffeners.layout.bays = [{ g: 1, a: 0, b: 25, n: 1 }];
  P.splices.plates = [{ x: 82, g: 0, top: { nl: 2 } }, { x: 145 }];
  const a = M.addType(P, 0, { label: 'A', lines: [0] }), b = M.addType(P, 0, { label: 'B', lines: [4] });
  assert.deepEqual(J(P.girders.map(g => g.id)), ['G1', 'G2', 'G3']); assert.deepEqual(J(P.girders[a].segments), J(P.girders[0].segments));
  assert.deepEqual(J(P.stiffeners.layout.bays.map(q => q.g)), [1, 2, 3]); assert.deepEqual(J(P.splices.plates.map(q => q.g == null ? null : q.g)), [0, null, 1, 2]);
  assert.ok(!('loadsManual' in P.girders[a]) && !('dfPull' in P.girders[a]), 'loads of the source are not copied');
  assert.equal(M.deleteType(P, a, b), true);
  assert.deepEqual(J(P.girders.map(g => g.label)), ['G1', 'B']); assert.deepEqual(J(M.typeLines(P, 1)), [0, 4]);
  assert.deepEqual(J(P.stiffeners.layout.bays.map(q => q.g)), [1, 2]); assert.deepEqual(J(P.splices.plates.map(q => q.g == null ? null : q.g)), [0, null, 1]);
  const Q = M.defaultProject(); assert.equal(M.deleteType(Q, 0, 0), false, 'the only type stays');
});

test('newProject(): Interior (the default girder) on G2–G4, Exterior (b_eff tributary) on G1 and G5; defaultProject unchanged', () => {
  const P = M.newProject(), D = M.defaultProject();
  assert.deepEqual(J(M.lineTypes(P)), [[1], [0], [0], [0], [1]]); assert.deepEqual(J(M.unassigned(P)), []);
  assert.equal(P.girders[0].label, 'Interior'); assert.equal(P.girders[1].label, 'Exterior'); assert.equal(P.girders[1].position, 'exterior');
  assert.equal(P.girders[1].beff, 96, 'b_eff = 12 (9.5 / 2 + 3.25) = 96 in'); assert.equal(M.tribBeff(P.xs, 2), 114);
  const g = J(P.girders[0]); delete g.label; delete g.line; delete g.lines; const d = J(D.girders[0]); delete d.label; assert.deepEqual(g, d);
  assert.equal(D.girders.length, 1); assert.deepEqual(J(M.validate(P).errors), []);
});

test('atLine: a read view; the design line is the project; the analysis equals a project stored with that line', () => {
  const P = M.newProject(); assert.equal(M.atLine(P, 0, 1), P);
  const V = M.atLine(P, 0, 3); assert.equal(V.girders[0].line, 3); assert.equal(J(V).girders[0].line, 3); assert.equal(P.girders[0].line, 1);
  V.girders[0].beff = 113; assert.equal(P.girders[0].beff, 113, 'writes go to the project'); P.girders[0].beff = 114;
  const S = J(P); S.girders[0].line = 2; const v2 = M.atLine(P, 0, 2), AN = W.SBDAnalysis;
  const m = Q => { const r = AN.moduleOf(Q, 0); return JSON.stringify(J({ j: r.j, G: r.G })); };
  assert.equal(m(v2), m(S), 'line 2 through the view = line 2 stored'); assert.notEqual(m(M.atLine(P, 0, 0)), m(P), 'line G1 differs from the design line G2');
});

test('drawings: the type assigned to a line gives its plates; a project without lines as before', () => {
  const D = W.SBDDrawings, P = M.newProject(); assert.deepEqual([0, 1, 2, 3, 4].map(i => D.plateGirderOf(P, i, 5)), [1, 0, 0, 0, 1]);
  const Q = M.defaultProject(); assert.deepEqual([0, 1, 2, 3, 4].map(i => D.plateGirderOf(Q, i, 5)), [0, 0, 0, 0, 0]);
});

// SB-2 PR 2: report/summary.js units (each type on each of its lines) and merge (each column the governing line)
const W2 = loadShared('units.js', 'steps.js', ENG('model.js'), path.join(ROOT, 'apps/steel-bridge/report/summary.js'));
test('units: a type per line (design line = the project itself); a saved project: one unit per girder, the project itself', () => {
  const M2 = W2.SBDModel, SM = W2.SBDSummary, P = M2.newProject(), U = SM.units(P);
  assert.deepEqual(J(U.map(u => [u.gi, u.j])), [[0, 1], [0, 2], [0, 3], [1, 0], [1, 4]]);
  assert.equal(U[0].P, P, 'Interior on its design line G2: the project'); assert.equal(U[3].P, P, 'Exterior on its design line G1: the project');
  assert.equal(U[1].P.girders[0].line, 2); assert.equal(U[4].P.girders[1].line, 4);
  const D = M2.defaultProject(), UD = SM.units(D); assert.equal(UD.length, 1); assert.equal(UD[0].P, D);
});
test('merge: each column the governing line (largest ratio, smallest RF; a run before not run / n/a); one line: unchanged', () => {
  const SM = W2.SBDSummary, P = W2.SBDModel.newProject();
  const G = (r, rf, st) => ({ gi: 1, label: 'Exterior', cells: { flexStr: { st: st || 'pass', r }, rtInv: { st: 'pass', rf }, shear: { st: 'na' } }, warn: ['w1'], err: {} });
  const one = G(0.5, 1.2); assert.equal(SM.merge(P, 1, [{ j: 0, G: one }]), one);
  const m = SM.merge(P, 1, [{ j: 0, G: G(0.8, 1.1) }, { j: 4, G: G(0.9, 1.3) }]);
  assert.equal(m.cells.flexStr.r, 0.9); assert.equal(m.cells.flexStr.ln, 4); assert.equal(m.cells.rtInv.rf, 1.1); assert.equal(m.cells.rtInv.ln, 0);
  assert.equal(m.cells.shear.st, 'na'); assert.deepEqual(J(m.lines), [0, 4]); assert.deepEqual(J(m.warn), ['G1, G5: w1'], 'a warning of both lines listed once');
  const n = SM.merge(P, 1, [{ j: 0, G: G(NaN, 1, 'review') }, { j: 4, G: G(5, 1) }]); assert.equal(n.cells.flexStr.ln, 0, 'a ratio not a number governs');
});
