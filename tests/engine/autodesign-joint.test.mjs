// SBJD (2026-11-13; engineer decisions SB-4 and SB-11): apps/steel-bridge engine/autodesign.js jointRun, lockD, applyJoint — several girder
// types sized together with one common web depth D (the deepest of the types' own best D), the runs repeated with it until no type's plates
// change, one Apply for every type (Undo puts every type back). Refine runs (the plates of the current layout) keep the test short.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = p => path.join(ROOT, 'apps/steel-bridge', p);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/constructibility.js', 'engine/splices.js',
  'engine/rating.js', 'engine/welds.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/splices.js', 'ui/flexure.js', 'ui/rating.js', 'ui/welds.js', 'engine/splplace.js', 'engine/autodesign.js'].map(E));
const AD = W.SBDAutoDesign, M = W.SBDModel, J = o => JSON.parse(JSON.stringify(o)); W.setTimeout = setTimeout;   // runChunked yields with setTimeout (a page global)
const RO = { settings: { mode: 'refine', topN: 1 }, maxIt: 5, trimTries: 2 };

test('lockD: the type\'s copies at D_c, the D variable locked, the other types kept', () => {
  const P = M.newProject(); P.girders[1].segments.forEach(s => { s.D = 54; }); const Q = AD.lockD(AD.typeProject(P, 1), 60);
  Q.girders.forEach(g => g.segments.forEach(s => assert.equal(s.D, 60)));   // Interior (adFixed) is 60 already; Exterior's copies set to 60
  assert.deepEqual(J(Q.autodesign.vars.D), { mode: 'lock' });
  const R = AD.lockD(AD.typeProject(M.newProject(), 0), 66); assert.ok(R.girders.filter(g => g.adFixed).every(g => g.segments.every(s => s.D === 60)), 'the other type keeps its D');
});

test('jointRun (Refine): Exterior 54 in, Interior 60 in → Interior fails CF8 as set (the 46 in frames of G1–G2), D_c = 54 in for both; converged; applyJoint writes both, Undo puts both back', async () => {
  const P = M.newProject(); P.girders[1].segments.forEach(s => { s.D = 54; }); const t0 = JSON.stringify(P);
  const msgs = []; const Jr = await AD.jointRun(P, p => msgs.push(p.msg), null, { runOpt: RO, maxIt: 3 });
  assert.equal(JSON.stringify(P), t0, 'P not changed');
  assert.deepEqual(J(Jr.D0), [null, 54]); assert.equal(Jr.Dc, 54);
  Jr.G.forEach(g => g.segments.forEach(s => assert.equal(s.D, 54)));
  Jr.RT.forEach(q => { assert.ok(q.R.cands[0], `type ${q.t} has a candidate`); assert.equal(q.R.cands[0].L.D, 54); });
  assert.equal(Jr.converged, true, Jr.note); assert.ok(Jr.passes.length >= 2); const last = Jr.passes[Jr.passes.length - 1]; assert.ok(!last.changed.length || last.verified === true, "no change, or verified");
  assert.ok(msgs.some(m => /Pass 1 \(common D = 54 in\)/.test(m)));
  const A = AD.applyJoint(P, Jr); assert.deepEqual(J(A.undo.girders), J(P.girders));
  A.girders.forEach((g, t) => { assert.deepEqual(J(g.segments), J(Jr.G[t].segments)); assert.deepEqual(J(g.lines), J(P.girders[t].lines)); assert.equal(g.label, P.girders[t].label); });
  // the project's Undo restores every type (autodesign.undo = { girders })
  const Q = J(P); Q.girders = A.girders; Q.autodesign = { ...(Q.autodesign || {}), undo: A.undo, applied: {} }; const U = AD.undo(Q); assert.deepEqual(J(U.girders), J(P.girders));
});

test('jointRun: stopped returns null', async () => {
  const P = M.newProject(); assert.equal(await AD.jointRun(P, null, () => true, { runOpt: RO }), null);
});

test('SB-16: in a run, a type\'s copy names its stiffener rows by the line it stands for (not the run\'s girder number)', () => {
  const P = M.newProject(), Q = AD.typeProject(P, 1), AN = W.SBDAnalysis, SU = W.SBDShearUI;
  [[1, 'G1'], [2, 'G5']].forEach(([k, lab]) => { const R = AN.analyzeGirder(Q, k), SA = SU.fromAnalysis(Q, k, R), B = SU.build({ P: Q, g: k, pl: SA.pl });
    const names = B.TS.rows.map(r => r.name); assert.ok(names.length && names.every(n => n.startsWith(lab + ',')), `${lab}: ${names[0]}`); });
  const R0 = AN.analyzeGirder(P, 0), B0 = SU.build({ P, g: 0, pl: SU.fromAnalysis(P, 0, R0).pl }); assert.ok(B0.TS.rows[0].name.startsWith('G1,'), 'outside a run: the girder number, as before');
});
