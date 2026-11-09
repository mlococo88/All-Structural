// apps/steel-bridge/engine/autodesign.js (ADWN, 2026-11-09): the two Auto design settings "Span-to-depth guidance (AASHTO 2.5.2.6.3) as
// warning only" (P.autodesign.limits.depthWarn, default true) and "6.10.2 proportion limits as warning only" (limits.propWarn, default false).
//   1. Defaults: a project saved before the settings (no fields) gets depthWarn true, propWarn false.
//   2. proportions(): a limit set to warning only does not make the design fail (ok), is listed in warns with its ratio, its step says so;
//      the same limit enforced makes ok false. Hand-checked ratios.
//   3. evaluate(): with propWarn, a flexure GS2 (b_f/2t_f) over 1.0 is not a failure and does not set the governing ratio; it is in propW and
//      still in modGov (as the Flexure tab reports it: FAIL). Without propWarn: a failure, as before.
//   4. The before/after example of the fixlog (§4): the default project, Check one change D = 40 in: with the guidance enforced no candidate;
//      with the default (warning only) the design is listed, ranked, with the WARNING (span-to-depth 1.077).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

// the scripts of autodesign.test.mjs adWindow(), with engine/proportions.js (the Flexure tab's GS1–GS4, loaded by the page) for test 3
const E = p => path.join(ROOT, 'apps/steel-bridge', p);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', ...['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/welds.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/splices.js', 'ui/flexure.js', 'ui/rating.js',
  'ui/welds.js', 'engine/splplace.js', 'engine/autodesign.js'].map(E));
const AD = W.SBDAutoDesign, M = W.SBDModel;
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

test('ADWN defaults: span-to-depth guidance a warning, 6.10.2 enforced; old saves get the defaults', () => {
  const P = M.defaultProject(); delete P.autodesign; let s = AD.settings(P);
  assert.equal(s.lim.depthWarn, true); assert.equal(s.lim.propWarn, false);
  P.autodesign = { limits: { Dmin: 40 } }; s = AD.settings(P); assert.equal(s.lim.depthWarn, true); assert.equal(s.lim.propWarn, false);
  P.autodesign.limits = { depthWarn: false, propWarn: true }; s = AD.settings(P); assert.equal(s.lim.depthWarn, false); assert.equal(s.lim.propWarn, true);
});

test('ADWN proportions(): warning only lists the limit with its ratio and does not reject; enforced rejects', () => {
  const P = M.defaultProject(); P.spans = { lengths: [100], continuity: 'simple' };
  // depth: D = 30 in, flanges 16 × 1 and 18 × 1.5: 0.033(100)(12) = 39.6 in > 30 + 1 + 1.5 = 32.5 in; ratio 39.6 / 32.5 = 1.2185
  const L = { nb: 5, D: 30, spl: [], web: [{ x0: 0, x1: 100, tw: 0.5 }], top: [{ x0: 0, x1: 100, b: 16, t: 1 }], bot: [{ x0: 0, x1: 100, b: 18, t: 1.5 }], minLines: null };
  P.autodesign = {}; let pr = AD.proportions(L, P, AD.settings(P));
  assert.equal(pr.ok, true, 'default: depth guidance is a warning'); assert.equal(pr.warns.length, 1); assert.equal(pr.warns[0].id, 'depth'); near(pr.warns[0].r, 39.6 / 32.5, 1e-12, 'depth ratio');
  assert.ok(/WARNING only/.test(pr.steps.find(s => /depth$/.test(s.id)).note || ''), 'the step says warning only');
  P.autodesign = { limits: { depthWarn: false } }; pr = AD.proportions(L, P, AD.settings(P));
  assert.equal(pr.ok, false, 'enforced: rejected'); assert.equal(pr.warns.length, 0);
  // 6.10.2: top flange 30 × 1: b_f/2t_f = 15 > 12 (1.25); D = 30: depth guidance a warning too
  const L2 = { ...L, top: [{ x0: 0, x1: 100, b: 30, t: 1 }] };
  P.autodesign = {}; pr = AD.proportions(L2, P, AD.settings(P)); assert.equal(pr.ok, false, 'default: 6.10.2 enforced');
  near(pr.items.find(q => q.id === 'bt1').r, 1.25, 1e-12, 'bf/2tf');
  P.autodesign = { limits: { propWarn: true } }; pr = AD.proportions(L2, P, AD.settings(P));
  assert.equal(pr.ok, true, 'propWarn: listed'); assert.equal(JSON.stringify(pr.warns.map(w => w.id).sort()), JSON.stringify(['bt1', 'depth']));
  P.autodesign = { limits: { propWarn: true, depthWarn: false } }; assert.equal(AD.proportions(L2, P, AD.settings(P)).ok, false, 'depth enforced still rejects');
});

test('ADWN evaluate(): with propWarn a flexure GS2 failure is a warning (not a failure, not the governing ratio), still in modGov', () => {
  const P = M.defaultProject(); P.girders[0].segments.forEach(s => { s.topB = 30; s.topT = 1; });   // b_f/2t_f = 15 > 12 everywhere
  const E0 = AD.evaluate(P, { level: 'screen', propWarn: false }), E1 = AD.evaluate(P, { level: 'screen', propWarn: true });
  assert.ok(E0.fails.some(f => f.mod === 'flexure' && f.id === 'GS2'), 'enforced: GS2 fails');
  assert.ok(!E1.fails.some(f => f.mod === 'flexure' && /^GS[123]$/.test(f.id)), 'warning only: no GS1–GS3 failure');
  assert.ok(E1.propW.some(o => o.id === 'GS2' && o.r > 1), 'kept in propW'); assert.ok(!(E1.gov && /^GS[123]$/.test(E1.gov.id) && E1.gov.r > 1), 'not the governing ratio');
  assert.ok(E1.modGov.flexure && E1.modGov.flexure.r >= Math.max(...E1.propW.map(o => o.r)) - 1e-12, 'the Flexure tab still sees it');
  P.autodesign = { limits: { propWarn: true } }; assert.ok(AD.evaluate(P, { level: 'screen' }).propW.length > 0, 'read from the project when not passed');
});

test('ADWN example (§4): default project, Check one change D = 40 in: rejected before, listed with the WARNING now', () => {
  const runIt = P => { const it = AD.run(P, {}); let s; while (!(s = it.next()).done); return s.value; };
  const P = M.defaultProject(); P.autodesign = { mode: 'check', change: { D: 40 }, limits: { depthWarn: false } };
  const R0 = runIt(P); assert.equal(R0.cands.length, 0, 'enforced (the behaviour before): no candidate');
  P.autodesign.limits = {}; const R1 = runIt(P);
  assert.equal(R1.cands.length, 1, 'warning only (default): the design is listed'); const c = R1.cands[0];
  assert.equal(c.D, 40); assert.ok(c.ratio <= 1 + 1e-9, 'passes every enforced check');
  // 0.027(140)(12) = 45.36 in vs D + t_ft + t_fb of the thinnest pair: ratio 1.077
  const w = c.propWarns.find(q => q.id === 'depth'); assert.ok(w, 'WARNING: span-to-depth'); near(w.r, 1.077, 0.0005, 'span-to-depth ratio');
});
