// Load factors from one source (FONE, 2026-11-01, engineer's decision item 3): the stiffeners' Strength I γ from SBDShear.factors() (η, m applied
// by engine/stiffeners.js, as before), the deck placement γ from SBDConstr.factors() (engine/shear.js, the Cross-frames bracing M_u, the
// Splices tab), the stud pitch sizing with the Fatigue I γ of the inputs and the stud regions on the Strength I envelope with the owner's η, m.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'ui/demands.js', 'ui/flexure.js', 'ui/shear.js', 'ui/fatigue.js'].map(E)));
const J = v => JSON.parse(JSON.stringify(v));
const ridot = P => { P.ownerRules = { owner: 'RIDOT', eta: { D: 'no', R: 'auto', I: 'yes' } }; return P; };

test('Deck placement γ: one source (SBDConstr.factors) for the Shear factors, the Splices factors and the Cross-frames bracing M_u (FONE)', () => {
  const C = W.SBDConstr.factors(); assert.equal(C.cdc, 1.25); assert.equal(C.ccl, 1.5);
  assert.equal(W.SBDShear.factors().cdc, 1.25); assert.equal(W.SBDShear.factors().ccl, 1.5);
  assert.equal(W.SBDShear.factorsOwner({ eta: 1.05, etaN: 1 / 1.05, m: 1.2 }).cdc, 1.25);   // no η, m on deck placement (OWN6–OWN8, 2026-10-15)
  const keep = W.SBDConstr.factors; try {
    W.SBDConstr.factors = o => ({ cdc: 1.3, ccl: 1.6, ...(o || {}) });   // a changed source reaches every user
    assert.equal(W.SBDShear.factors().cdc, 1.3); assert.equal(W.SBDShear.factors().ccl, 1.6);
    const g = W.SBDSplices.projGam(W.SBDModel.defaultProject()); assert.equal(g.dc1C, 1.3); assert.equal(g.clC, 1.6);   // was W.SBDConstructibility (not a global)
  } finally { W.SBDConstr.factors = keep; }
});

test('Stiffeners: Strength I γ from SBDShear.factors(), × the owner\'s η, m in the engine (unchanged values) (FONE)', () => {
  const d = W.SBDShearUI.build({ P: J(W.SBDModel.defaultProject()), g: 0, src: 'analysis' }), r = W.SBDShearUI.build({ P: J(ridot(W.SBDModel.defaultProject())), g: 0, src: 'analysis' });
  assert.equal(JSON.stringify(d.TS.g), JSON.stringify({ dc: 1.25, dw: 1.5, ll: 1.75, fat: 1.75 }));
  // RIDOT, η = η_I = 1.05, m = 1.2: γ_DC = 1.25(1.05) = 1.3125, γ_DW = 1.50(1.05) = 1.575, γ_LL = 1.75(1.05)(1.2) = 2.205
  assert.ok(Math.abs(r.TS.g.dc - 1.3125) < 1e-12 && Math.abs(r.TS.g.dw - 1.575) < 1e-12 && Math.abs(r.TS.g.ll - 2.205) < 1e-12 && r.TS.g.fat === 1.75);
  assert.ok(Math.abs(r.BS.g.dc - 1.3125) < 1e-12 && Math.abs(r.BS.g.ll - 2.205) < 1e-12);
});

test('Stud regions on the owner\'s Strength I envelope; pitch sizing with γ Fatigue I of the inputs (FONE)', () => {
  const reg = P => W.SBDFatigueUI.fromAnalysis(J(P), 0).pl.girderDetail.details.studs;
  // default: Span 1 maximum positive at 43 ft: 1.25(1059.355 + 192.059) + 1.50(159.074) + 1.75(1830.608) = 5006.44 > 5004.88 kip-ft at 44 ft
  assert.equal(reg(W.SBDModel.defaultProject()).results.regions[0].x2, 43);
  // RIDOT (η 1.05, m 1.2): 1.3125(1059.355 + 191.730) + 1.575(158.802) + 2.205(1817.753) = 5900.31 at 43 ft < 1.3125(1053.042 + 190.677)
  //   + 1.575(157.930) + 2.205(1822.803) = 5900.40 kip-ft at 44 ft: the region ends at 44 ft (before, with 1.25 / 1.50 / 1.75: 43 ft)
  assert.equal(reg(ridot(W.SBDModel.defaultProject())).results.regions[0].x2, 44);
  // γ Fatigue I 1.5: p_req × 1.75/1.5; first zone 12.5 in → 14.5 in (p = ⌊2p_req⌋/2)
  const P = W.SBDModel.defaultProject(); P.fatigue.gam.fI = 1.5; const z = reg(P).zones, z0 = reg(W.SBDModel.defaultProject()).zones;
  assert.equal(z0[0].p, 12.5); assert.equal(z[0].p, 14.5);
});
