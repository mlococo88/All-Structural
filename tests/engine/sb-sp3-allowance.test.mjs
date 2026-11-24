// SBALLOW2 (2026-11-24): Steel Bridge Design's splice shipping weight check SP3 (engine/splplace.js check, called from engine/autodesign.js
// splCheck) and the old app's placement rule (splPlan → reference) weigh a piece with the girder steel detail allowance the analysis uses,
// SBDAnalysis.allowOf (the girder loads of a hand-off, else xs.allow of the loads module, else the Analysis setting); before, xs.allow
// directly. The Report's steel bill of materials states the same value.
// 1. Normal projects (the loads module runs, no hand-off allowance): allowOf = xs.allow, so SP3 is unchanged (the weights are
//    (1 + xs.allow/100) × the plates).
// 2. Hand check: the loads module fails (xs.nb = 0) so the analysis uses the setting 5 % while xs.allow is 3 %: a piece of 30.00 kip of
//    plates, before 30.00 × 1.03 = 30.90 kip, after 30.00 × 1.05 = 31.50 kip.
// 3. A hand-off girder allowance (girder.loads.steelAllowPct 5 %, xs.allow 2 %): SP3 at 5 %; two plate girders 5 % and 8 %: the larger, 8 %.
// 4. The SP3 step note says where a comes from; the BOM note quotes the analysis's allowance.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const E = p => path.join(ROOT, 'apps/steel-bridge', p);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', 'report.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/constructibility.js', 'engine/splices.js',
  'engine/rating.js', 'engine/welds.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/splices.js', 'ui/flexure.js', 'ui/rating.js', 'ui/welds.js', 'engine/splplace.js', 'engine/autodesign.js'].map(E));
const AD = W.SBDAutoDesign, M = W.SBDModel, AN = W.SBDAnalysis, SP = W.SBDSplicePlace;
const J = o => JSON.parse(JSON.stringify(o));
// the SP3 items of the current layout: [{ wt, w0 }] from the worked step (value = with the allowance; the plates from its substitution)
const sp3 = P => { const S = AD.settings(P), L0 = AD.layoutOf(P), C = AD.splCheck(P, S, L0, null), st = C.steps.filter(s => /^spl\.SP3\./.test(s.id));
  assert.ok(st.length >= 2, `SP3 steps: ${st.length}`); return st.map(s => ({ wt: s.value, a: +/\\frac\{([\d.]+)\}\{100\}/.exec(s.sub)[1], w0: +/\)\(([\d.]+)\)/.exec(s.sub)[1], note: s.note })); };
const payload = () => { const P = projectFromPayload(readPayload('gd_builtin28_AASHTO_G1.json')); P.xs = M.defaultXs(P); Object.assign(P.xs, { nb: 5, bays: [9.5, 9.5, 9.5, 9.5], skews: [28, 28, 28, 28] });
  P.framing = { ...M.defaultFraming(), splices: [82, 145, 215, 278] }; P.stiffeners = M.defaultStiffeners(); P.crossframes = M.defaultCrossframes();
  P.ownerRules = P.ownerRules || { owner: 'AASHTO', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } }; return P; };

test('SBALLOW2: normal projects: SP3 uses xs.allow as before (allowOf = xs.allow)', () => {
  const cases = [['default', P => P], ['xs.allow 3', P => { P.xs.allow = 3; }], ['xs.allow 8, setting 2', P => { P.xs.allow = 8; P.analysis = { ...(P.analysis || {}), steelAllowPct: 2 }; }],
    ['xs.allow blank, setting 7', P => { P.xs.allow = null; P.analysis = { ...(P.analysis || {}), steelAllowPct: 7 }; }]];
  for (const [name, f] of cases) { const P = J(M.defaultProject()); f(P); const x = +P.xs.allow || 0;
    assert.equal(AN.allowOf(P, 0).src, 'module', name);
    sp3(P).forEach(q => { assert.equal(q.a, x, `${name}: a`); assert.ok(Math.abs(q.wt - q.w0 * (1 + x / 100)) <= 0.006, `${name}: ${q.wt} vs ${q.w0}`); }); }
});

test('SBALLOW2: loads module fails (xs.nb 0), setting 5 %, xs.allow 3 %: SP3 at 5 % (hand check 30.90 → 31.50 kip)', () => {
  const P = J(M.defaultProject()); P.xs.allow = 3; P.xs.nb = 0; P.analysis = { ...(P.analysis || {}), steelAllowPct: 5 };
  assert.deepEqual(J(AN.allowOf(P, 0)), { pct: 5, src: 'setting' });
  const Q = sp3(P); Q.forEach(q => { assert.equal(q.a, 5); assert.ok(Math.abs(q.wt - q.w0 * 1.05) <= 0.006, `${q.wt} vs ${q.w0} x 1.05`); assert.match(q.note, /a = 5 %.*the Analysis setting/); });
  // the hand check: 30.00 kip of plates
  const segs = [{ x0: 0, x1: 100, D: 60, tw: 0.5, topB: 16, topT: 1, botB: 18, botT: 1.25 }], w0 = SP.pieceWt ? SP.pieceWt(segs, 0, 100, 0) : null;
  if (w0 != null) { const L = 30 / w0 * 100, b = SP.pieceWt(segs, 0, L, 3), a = SP.pieceWt(segs, 0, L, AN.allowOf(P, 0).pct);
    assert.equal(b.toFixed(2), '30.90'); assert.equal(a.toFixed(2), '31.50'); }
  assert.equal((30 * 1.03).toFixed(2), '30.90'); assert.equal((30 * 1.05).toFixed(2), '31.50');
  console.log(`       ${Q.length} pieces at 1.05 x plates (${Q.map(q => `${q.w0} -> ${q.wt.toFixed(1)}`).join(', ')})`);
});

test('SBALLOW2: hand-off girder allowance 5 % (xs.allow 2 %): SP3 at 5 %; two plate girders 5 % and 8 %: 8 %', () => {
  { const P = payload(); P.xs.allow = 2; assert.equal(AN.allowOf(P, 0).src, 'girder'); sp3(P).forEach(q => { assert.equal(q.a, 5); assert.match(q.note, /hand-off/); }); }
  { const P = payload(), g2 = J(P.girders[0]); g2.id = 'G2x'; g2.label = 'EXT'; g2.position = 'exterior'; g2.loads.steelAllowPct = 8; P.girders[0].position = 'interior'; P.girders.push(g2);
    sp3(P).forEach(q => { assert.equal(q.a, 8); assert.match(q.note, /the largest of the plate girders/); }); }
  // an adFixed girder (not given the layout) is left out
  { const P = payload(), g2 = J(P.girders[0]); g2.id = 'G2x'; g2.label = 'EXT'; g2.position = 'exterior'; g2.loads.steelAllowPct = 8; g2.adFixed = true; P.girders[0].position = 'interior'; P.girders.push(g2);
    sp3(P).forEach(q => assert.equal(q.a, 5)); }
});

test('SBALLOW2: splPlan reference uses the same allowance', () => {
  const P = J(M.defaultProject()); P.xs.allow = 3; P.xs.nb = 0; P.analysis = { ...(P.analysis || {}), steelAllowPct: 5 }; P.autodesign = { mode: 'new', vars: { spl: { mode: 'auto' } } };
  const S = AD.settings(P); let seen = null; const ref0 = SP.reference; SP.reference = (...a) => { seen = a[4]; return ref0(...a); };
  try { AD.splPlan(P, S, { ll: new Map(), L0: AD.layoutOf(P) }, AD.layoutOf(P)); } catch (e) { /* the analysis may stop the plan; the allowance is read before */ } finally { SP.reference = ref0; }
  if (seen !== null) assert.equal(seen, 5);
  const P2 = J(M.defaultProject()); P2.autodesign = { mode: 'new', vars: { spl: { mode: 'auto' } } }; seen = null; SP.reference = (...a) => { seen = a[4]; return ref0(...a); };
  try { AD.splPlan(P2, AD.settings(P2), { ll: new Map(), L0: AD.layoutOf(P2) }, AD.layoutOf(P2)); } finally { SP.reference = ref0; }
  assert.equal(seen, +P2.xs.allow || 0, 'normal project: xs.allow');
});
