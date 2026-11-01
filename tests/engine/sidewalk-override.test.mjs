// C-32 (engineer 2026-11-01): the owner sidewalk override for the live load deflection limits (OWN19; GirderDetail / Preliminary sizing
// limits.sidewalk, plSidewalk): analysis.deflSidewalk 'auto' (default: the cross-section's sidewalks) | 'yes' | 'no'.
// Hand check (built-in project, interior plate girder, span 1 = 110 ft): MassDOT 3.5.6.1 without sidewalk L/800, preferably L/1000:
// Δ_lim = 12(110)/800 = 1.650 in; with a sidewalk (or 'yes') L/1000: 12(110)/1000 = 1.320 in. RIDOT 2.4.2.6: L/800, L/1000 with pedestrians.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', ...['engine/model.js', 'engine/legacy.js', 'engine/sections.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js', 'engine/analysis.js'].map(E));
const M = W.SBDModel, AN = W.SBDAnalysis, J = o => JSON.parse(JSON.stringify(o));

test('deflSidewalk: auto = the cross-section (as before); yes / no override it; MassDOT and RIDOT limits', () => {
  const P = M.defaultProject(); P.ownerRules.owner = 'MassDOT'; const g = P.girders[0];
  const D = () => AN.deflOwner(P, g, AN.settings(P));
  // absent and 'auto': identical to before (no sidewalk in the built-in cross-section)
  const a0 = J(D()); assert.equal(a0.sw, false); assert.equal(a0.req, 800); assert.equal(a0.pref, 1000); assert.equal(a0.swHow, 'cross-section sidewalks');
  P.analysis = { ...(P.analysis || {}), deflSidewalk: 'auto' }; assert.deepEqual(J(D()), a0);
  P.analysis.deflSidewalk = 'yes'; let o = D(); assert.equal(o.sw, true); assert.equal(o.req, 1000); assert.equal(o.pref, 0); assert.equal(o.swHow, 'entered (Analysis settings)');
  assert.ok(Math.abs(12 * 110 / o.rq - 1.32) < 1e-12);
  // a sidewalk in the cross-section, overridden 'no'
  P.xs.sidewalks.L = { w: 6, t: 8, fence: null, fenceX: null }; P.analysis.deflSidewalk = 'auto'; assert.equal(D().sw, true);
  P.analysis.deflSidewalk = 'no'; o = D(); assert.equal(o.sw, false); assert.equal(o.req, 800); assert.ok(Math.abs(12 * 110 / o.rq - 1.65) < 1e-12);
  // RIDOT
  P.ownerRules.owner = 'RIDOT'; P.analysis.deflSidewalk = 'yes'; P.xs.sidewalks.L = { w: 0, t: 8, fence: null, fenceX: null }; assert.equal(D().req, 1000);
  P.analysis.deflSidewalk = 'no'; assert.equal(D().req, 800);
  // AASHTO / CTDOT: no owner rule, the override does not matter
  P.ownerRules.owner = 'AASHTO'; P.analysis.deflSidewalk = 'yes'; assert.equal(D(), null);
  assert.deepEqual(J(M.validate(P).errors.filter(e => /analysis/.test(e.path))), []);
});

test('deflSidewalk imported from the old app (Preliminary sizing limits.sidewalk)', () => {
  const pl = { bridge: { spans: [100], nb: 4, S: 8 }, limits: { dot: 'MassDOT', sidewalk: 'yes' } };
  for (const [v, want] of [['yes', 'yes'], ['no', 'no'], ['auto', undefined]]) {
    pl.limits.sidewalk = v; const r = W.SBDLegacy.importLegacy({ app: 'PlateLine', data: J(pl) });
    assert.ok(r.ok, r.error);
    assert.equal((r.project.analysis || {}).deflSidewalk, want, v);
  }
});
