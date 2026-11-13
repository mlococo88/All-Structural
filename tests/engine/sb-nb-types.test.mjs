// SBNB / SBTT / SB-13 (2026-11-13; engineer's directions SB-14, SB-15, SB-13 "use judgment"): apps/steel-bridge engine/model.js renumberLines
// (N_b changed: the outer lines take the old outer lines' types, the inner lines keep theirs or take the Interior type, assignments beyond
// N_b dropped), engine/inputcheck.js (two girder types on one line: an input error naming the line), ui/handoffs.js (the SB-13 assumption note).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = p => path.join(ROOT, 'apps/steel-bridge', p);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/inputcheck.js'].map(E));
const M = W.SBDModel, IC = W.SBDInputCheck, J = o => JSON.parse(JSON.stringify(o));
const setNb = (P, nb) => { P.xs.nb = nb; P.xs.bays = new Array(nb - 1).fill(9.5); };

test('N_b 5 → 6: G1 Exterior, G6 Exterior (the old G5\'s), G2–G4 kept Interior, G5 (old outer, now inner) Interior; the change list', () => {
  const P = M.newProject(), LT0 = M.lineTypes(P); setNb(P, 6); const ch = M.renumberLines(P, LT0);
  assert.deepEqual(J(M.lineTypes(P)), [[1], [0], [0], [0], [0], [1]]); assert.equal(ch.I, 0);
  assert.deepEqual(J(ch.map(c => [c.j, c.from, c.to])), [[4, [1], 0], [5, [], 1]]);
  assert.equal(P.girders[0].line, 1); assert.equal(P.girders[1].line, 0);
});
test('N_b 5 → 3: G3 takes the old G5\'s type (Exterior), G2 Interior; lines beyond N_b dropped', () => {
  const P = M.newProject(), LT0 = M.lineTypes(P); setNb(P, 3); const ch = M.renumberLines(P, LT0);
  assert.deepEqual(J(M.lineTypes(P)), [[1], [0], [1]]); assert.deepEqual(J(P.girders.map(g => g.lines)), [[1], [0, 2]]);
  assert.deepEqual(J(ch.map(c => [c.j, c.from, c.to])), [[2, [0], 1]]);
});
test('three types; a project saved before girder types is not re-assigned (null)', () => {
  const P = M.newProject(); const c = M.addType(P, 0, { label: 'Core', lines: [2] }); const LT0 = M.lineTypes(P); setNb(P, 7); M.renumberLines(P, LT0);
  assert.deepEqual(J(M.lineTypes(P)), [[1], [0], [c], [0], [0], [0], [1]], 'G2–G4 kept (Interior, Core, Interior), new G5, G6 Interior (most old inner lines)');
  const D = M.defaultProject(), L0 = M.lineTypes(D); setNb(D, 6); assert.equal(M.renumberLines(D, L0), null); assert.ok(!('lines' in D.girders[0]));
});
test('two girder types on one line: an input error naming the line (blocks results and hand-offs); none otherwise', () => {
  const P = M.newProject(); assert.equal(IC.collect(P).errors.filter(e => /girder types/.test(e.msg)).length, 0);
  P.girders[0].lines = [1, 2, 3, 4];   // G5 on Interior and Exterior
  const e = IC.collect(P).errors.filter(q => /girder types/.test(q.msg)); assert.equal(e.length, 1); assert.match(e[0].msg, /^Line G5 has 2 girder types \(Interior, Exterior\)/); assert.equal(e[0].path, 'girders.1.lines');
});
