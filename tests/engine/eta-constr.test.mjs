// The owner's η on deck placement / construction (ETAC, engineer decision 2026-11-01; AASHTO LRFD 10th Ed. 3.4.2.1 at the Strength limit
// state with Eq. 1.3.2.1-2; m not applied): every user of SBDConstr.factors() (Constructibility GS14–GS16 and the overhang brackets OH1–OH5,
// the Shear tab's GS16, the Cross-frames bracing M_u, the Splices tab's deck placement combination) takes γ_DC 1.25η, γ_CL 1.50η; the overhang
// bracket factors are these (one source; the saved P.constr.oh.gam kept and flagged). A GirderDetail lf (no etaC) gives η = 1 on construction.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'ui/demands.js', 'ui/flexure.js', 'ui/shear.js', 'ui/framing.js', 'ui/splices.js', 'ui/constructibility.js'].map(E)));
const J = v => JSON.parse(JSON.stringify(v)), near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);
const proj = (ridot, ext) => { const P = W.SBDModel.defaultProject(); if (ridot) P.ownerRules = { owner: 'RIDOT', eta: { D: 'no', R: 'auto', I: 'yes' } }; if (ext) P.girders[0].position = 'exterior'; return P; };

test('Deck placement factors × the owner\'s η (not m): Constructibility, overhang brackets, Shear GS16, Cross-frames M_u, Splices (ETAC)', () => {
  const C = W.SBDConstr, L = W.SBDOwners.loadFactors('RIDOT', { I: 'yes' }, 5); assert.equal(L.etaC, 1.05); assert.equal(L.m, 1.2);
  const G = C.factorsOwner(L); near(G.cdc, 1.3125, 1e-12, 'γ_DC'); near(G.ccl, 1.575, 1e-12, 'γ_CL');
  assert.equal(C.factorsOwner({ eta: 1.05, m: 1.2 }).cdc, 1.25);   // a GirderDetail lf (no etaC): as GirderDetail, no η on construction
  assert.equal(W.SBDShear.factorsOwner({ eta: 1.05, etaN: 1, m: 1.2 }).cdc, 1.25); near(W.SBDShear.factorsOwner(L).ccl, 1.575, 1e-12, 'shear γ_CL');
  // GS14 at x = 77.00 ft: M_c = γ_DC M_DCc + γ_CL M_CL = 1.25(548.020) + 1.50(0) = 685.02 → 1.3125(548.020) = 719.28 kip-ft; f_bu 7.3845 → 7.7537 ksi;
  // F_nc 9.3877 ksi: 0.7866 → 0.8259
  const a = W.SBDConstrUI.build({ P: J(proj(false)), g: 0, src: 'project' }), b = W.SBDConstrUI.build({ P: J(proj(true)), g: 0, src: 'project' });
  const ra = a.rows.find(r => /77\.00/.test(r.name)), rb = b.rows.find(r => /77\.00/.test(r.name)), gs = r => r.checks.find(c => c.id === 'GS14' && c.key === 'buckling');
  near(ra.Mc, 685.02, 0.01, 'M_c AASHTO'); near(rb.Mc, 719.28, 0.01, 'M_c RIDOT'); near(gs(ra).ratio, 0.7866, 1e-4, 'GS14 AASHTO'); near(gs(rb).ratio, 0.8259, 1e-4, 'GS14 RIDOT');
  // overhang brackets, exterior: w_u = γ_DC(0.28125) + γ_CL(0.025 + 0.085 + 0.025 + 0.125 + 0.050) = 0.81656 (η 1) → 1.3125(0.28125) + 1.575(0.31) = 0.85739 kip/ft
  const oa = W.SBDConstrUI.build({ P: J(proj(false, true)), g: 0, src: 'project' }).oh, ob = W.SBDConstrUI.build({ P: J(proj(true, true)), g: 0, src: 'project' }).oh;
  near(oa.wu, 0.81656, 1e-5, 'w_u'); near(ob.wu, 0.85739, 1e-5, 'w_u η'); near(ob.Pl, 1.575 * 3 * 36 / 54, 1e-9, 'P_ℓ');
  // saved bracket factors: kept, unused, flagged
  const P = proj(true, true); P.constr = { oh: { ...C.OH_DEF, gam: { dc: 1.25, cl: 1.5 } } };
  assert.equal(JSON.stringify(W.SBDConstrUI.ohOldGam(P).map(q => q.k)), '["dc","cl"]'); near(W.SBDConstrUI.build({ P: J(P), g: 0, src: 'project' }).oh.wu, 0.85739, 1e-5, 'saved γ not used');
  assert.equal(W.SBDConstrUI.ohOldGam(proj(false, true)).length, 0);
  // Shear GS16 at x = 0.01 ft: V_u = 1.25(54.821) = 68.53 → 1.3125(54.821) = 71.95 kip
  near(W.SBDShearUI.build({ P: J(proj(true)), g: 0, src: 'analysis' }).stations[0].VuC, 71.952, 1e-3, 'V_u deck placement');
  // Cross-frames: bracing M_u = 1.25M_DC1 + 1.5M_CL = 1339.7 → × 1.05 = 1406.7 kip-ft (x = 321.0 ft)
  assert.equal(W.SBDFramingUI.build({ P: J(proj(false)), g: 0 }).I.p.sb.Mu, 1339.7); assert.equal(W.SBDFramingUI.build({ P: J(proj(true)), g: 0 }).I.p.sb.Mu, 1406.7);
  // Splices, deck placement combination: γ × η in the engine (OWN_K.cn), the factors shown unchanged
  const sp = W.SBDSplicesUI.build({ P: J(proj(true)), g: 0, src: 'analysis' }), con = sp.list[0].R.combos.find(c => c.type === 'con');
  near(con.fac.DC1, 1.3125, 1e-12, 'splice γ_DC'); near(con.fac.CL, 1.575, 1e-12, 'splice γ_CL'); near(con.M, -322.6125, 1e-6, 'splice M (−307.25 × 1.05)');
});
