// apps/steel-bridge/engine/analysis.js: the construction live load calculated, w_CL = q_CL/1000 × b_trib (clOf), its override, the
// migration (a project saved before: not calculated), and the finishing machine (fmOf): CLC, 2026-11-09. Hand checks in each test.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const ENG = p => path.join(ROOT, 'apps/steel-bridge/engine', p);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', ENG('model.js'), ENG('sections.js'), ENG('owners.js'), 'lldf.js', ENG('lldf.js'), ENG('loads.js'), ENG('analysis.js'));
const M = W.SBDModel, AN = W.SBDAnalysis;
const close = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);
const LDof = P => AN.loadsOf(P, P.girders[0], AN.moduleOf(P, 0));

test('CLC: new project: w_CL = 20/1000 × 9.5 ft = 0.190 klf (interior G2, bays 9.5 ft); statics ΣR = 0.190 × 360 = 68.40 kip', () => {
  const P = M.defaultProject(); assert.equal(P.analysis.clCalc, true);
  const LD = LDof(P); assert.equal(LD.src.CL, 'calc'); assert.equal(LD.cl.q, 20); assert.equal(LD.cl.qSrc, 'default'); close(LD.cl.trib, 9.5, 1e-9, 'b_trib'); close(LD.CL, 0.19, 1e-12, 'w_CL');
  const R = AN.analyzeGirder(P, 0, { ll: false }); close(R.st.CL.R.reduce((a, b) => a + b, 0), 68.4, 1e-6, 'ΣR');
  const s = R.steps.find(q => q.id === 'an.CL.w'); assert.ok(s); close(s.value, 0.19, 1e-12, 'step');
});
test('CLC: exterior G1: b_trib = 3.25 + 9.5/2 = 8.00 ft, w_CL = 0.160 klf; CTDOT: q = 50 psf (BDM V2 3.17CT), w = 0.400 klf; entered 30 psf below the CTDOT minimum warns', () => {
  const P = M.defaultProject(); P.girders[0].position = 'exterior';
  close(LDof(P).CL, 0.16, 1e-12, 'G1');
  P.ownerRules.owner = 'CTDOT'; const L2 = LDof(P); assert.equal(L2.cl.qSrc, 'owner'); assert.equal(L2.cl.q, 50); close(L2.CL, 0.4, 1e-12, 'CTDOT');
  P.analysis.qCL = 30; const R = AN.analyzeGirder(P, 0, { ll: false }); close(R.loads.CL, 0.24, 1e-12, 'entered'); assert.ok(R.warnings.some(w => /below the owner's minimum 50 psf/.test(w)));
});
test('CLC: a project saved before (no clCalc): 0 without an entry, the entry with one (as before); override off: calculated', () => {
  const P = M.defaultProject(); delete P.analysis; let LD = LDof(P); assert.equal(LD.src.CL, 'none'); assert.equal(LD.CL, 0);
  P.girders[0].loadsManual = { CL: 0.25 }; LD = LDof(P); assert.equal(LD.src.CL, 'manual'); assert.equal(LD.CL, 0.25);
  P.analysis = { clCalc: true }; LD = LDof(P); assert.equal(LD.src.CL, 'manual', 'an entered value stays an override');
  P.girders[0].clOverride = false; LD = LDof(P); assert.equal(LD.src.CL, 'calc'); close(LD.CL, 0.19, 1e-12, 'calc');
});
test('CLC: finishing machine, lever rule and a simple-span hand check', () => {
  // default cross-section: overhang 3.25 ft, bays 9.5 ft; P = 3 kip each at e = 1 ft from each edge: a = 3.25 − 1 = 2.25 ft outside G1:
  // G1 3(1 + 2.25/9.5) = 3.7105 kip, G2 −3(2.25/9.5) = −0.7105 kip
  const P = M.defaultProject(); P.analysis.fm = { P: 3, e: 1 };
  const mod = AN.moduleOf(P, 0); close(AN.fmOf(P, mod, 0).Pj, 3.710526, 1e-6, 'G1'); close(AN.fmOf(P, mod, 1).Pj, -0.710526, 1e-6, 'G2');
  // one simple span 100 ft, exterior G1: the uniform w_CL = 0.160 klf gives wL²/8 = 200.0 kip-ft at midspan; the machine P_j L/4 = 3.7105(25) = 92.76 kip-ft
  const Q = M.defaultProject(); Q.spans.lengths = [100]; Q.xs = M.defaultXs(Q); Q.analysis.fm = { P: 3, e: 1 }; Q.girders[0].position = 'exterior';
  Q.girders[0].segments = [{ x0: 0, x1: 100, D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125 }];
  const R = AN.analyzeGirder(Q, 0, { ll: false }), i = R.x.findIndex(x => Math.abs(x - 50) < 1e-9);
  close(R.st.CLu.M[i], 200, 1e-3, 'uniform'); close(R.fm.M[i], 3.710526 * 25, 1e-4, 'machine'); close(R.st.CL.M[i], 200 + 92.763, 1e-2, 'M_CL');
  close(R.st.CL.R[0], 0.16 * 50 + 3.710526, 1e-4, 'end reaction: wL/2 + P_j');
  assert.ok(R.steps.find(s => s.id === 'an.eq.CL').ok, 'statics of the uniform part');
});
