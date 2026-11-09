// EQSP (2026-11-09): equal girder spacing from the exterior girder spacing (apps/steel-bridge engine/model.js equalSpacing).
// Engineer's definition (2026-11-09): S = W_cc / (N_b − 1), W_cc = exterior girder spacing, ℄ to ℄ of the two exterior girders.
// 1. Hand cases. 2. validate(): the new fields are optional (a project without them gives the same errors and warnings), Equal mode needs
// W_cc > 0. 3. The loads / LLDF engine gives identical results for an Equal-mode project and an Individual-mode project entered with the
// same spacings (the engine reads xs.bays only).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', ENG('model.js'), ENG('sections.js'), ENG('owners.js'), 'lldf.js', ENG('lldf.js'), ENG('loads.js'));
const M = W.SBDModel, LD = W.SBDLoads;
const clone = o => JSON.parse(JSON.stringify(o)), J = o => JSON.parse(JSON.stringify(o));   // J: compare across the vm context
const close = (a, b, t = 1e-12) => assert.ok(Math.abs(a - b) <= t, `${a} vs ${b}`);

test('hand case: W_cc = 40 ft, N_b = 4 -> S = 40 / (4 - 1) = 13.333 ft in 3 bays', () => {
  const Q = M.equalSpacing({ nb: 4, Wcc: 40 });
  close(Q.S, 13.333333333333334); assert.equal(Q.bays.length, 3); Q.bays.forEach(v => close(v, 40 / 3));
  assert.equal(Q.step.id, 'xs.eqS'); assert.equal(Q.step.eq, '\\frac{W_{cc}}{N_{b} \\minus 1}'); assert.equal(Q.step.sub, '\\frac{40.000}{4 \\minus 1}'); assert.equal(Q.step.unit, 'ft');
  assert.match(W.SharedSteps.line(W.SharedSteps.step(Q.step), false), /13\.333 ft/);
});
test('hand case: the built-in cross-section, W_cc = 4 × 9.5 = 38 ft, N_b = 5 -> S = 9.5 ft (the built-in spacings, exactly)', () => {
  const Q = M.equalSpacing({ nb: 5, Wcc: 38 }); assert.deepEqual(J(Q.bays), J(M.defaultXs().bays));
});
test('no S without N_b >= 2 or W_cc', () => {
  assert.ok(Number.isNaN(M.equalSpacing({ nb: 1, Wcc: 40 }).S)); assert.deepEqual(J(M.equalSpacing({ nb: 1, Wcc: 40 }).bays), []);
  assert.ok(Number.isNaN(M.equalSpacing({ nb: 4, Wcc: null }).S));
});
test('validate: optional fields; Equal mode needs W_cc > 0', () => {
  const P = M.defaultProject(), v0 = M.validate(P);
  assert.equal(P.xs.spMode, undefined, 'a new project has no spMode (Individual)');
  const Q = clone(P); Q.xs.spMode = 'individual'; assert.deepEqual(J(M.validate(Q)), J(v0));
  Q.xs.spMode = 'equal'; Q.xs.Wcc = 38; assert.deepEqual(J(M.validate(Q)), J(v0));
  Q.xs.Wcc = 0; assert.ok(M.validate(Q).errors.some(e => e.path === 'xs.Wcc'));
  Q.xs.Wcc = NaN; assert.ok(M.validate(Q).errors.some(e => e.path === 'xs.Wcc'));
  Q.xs.spMode = 'other'; assert.ok(M.validate(Q).errors.some(e => e.path === 'xs.spMode'));
});
test('engine: Equal mode = Individual mode entered with the same spacings (loads, LLDF, ranges)', () => {
  const ind = M.defaultProject(); ind.xs.nb = 4; ind.xs.bays = [13.333333333333334, 13.333333333333334, 13.333333333333334];
  const eq = clone(ind); eq.xs.spMode = 'equal'; eq.xs.Wcc = 40; eq.xs.bays = J(M.equalSpacing(eq.xs).bays);
  assert.deepEqual(eq.xs.bays, ind.xs.bays);
  const run = P => { const { b, p } = LD.fromModel(P, { girder: 0 }), R = LD.compute(b, p); R.ranges = W.SBDLldf.ranges(R, b.tsDeck, b.nb); return R; };
  const a = run(ind), c = run(eq);
  assert.equal(a.errors.length, 0); assert.deepEqual(J(c), J(a));
  assert.ok(a.regions[0].members.length === 4);
});
