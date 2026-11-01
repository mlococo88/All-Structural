// Studs: Fatigue I γ from one source (SCGAM, 2026-11-01): the Fatigue & studs tab's studs take γ Fatigue I from the Fatigue & studs input
// fatigue.gam.fI (the Welds #525 / Splices #545 pattern); the saved studs.gamFat stays in the file, is no longer used and is flagged when it
// differs; model.validate no longer checks it. At the default 1.75 every result is what studs.gamFat = 1.75 gave.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'ui/demands.js', 'ui/flexure.js', 'ui/fatigue.js'].map(E)));
const J = v => JSON.parse(JSON.stringify(v));
const proj = (fI, gamFat) => { const P = W.SBDModel.defaultProject(); P.fatigue.limit = 'I'; if (fI != null) P.fatigue.gam.fI = fI; if (gamFat !== undefined) P.studs.gamFat = gamFat; return P; };
const zone = R => R.SR.zones.find(z => z.name === 'Span 2, 0.1L to 0.2L');

test('Studs γ Fatigue I = fatigue.gam.fI; saved studs.gamFat kept, unused, flagged; validate does not block on it (SCGAM)', () => {
  const FU = W.SBDFatigueUI, d = FU.build({ P: J(proj()), g: 0, src: 'analysis' }), o = FU.build({ P: J(proj(null, 1.5)), g: 0, src: 'analysis' }), q = FU.build({ P: J(proj(1.5)), g: 0, src: 'analysis' });
  // default 1.75: V_fat = γV_fQ/I = 1.75(45.8)(1714.009)/106168.02 = 1.2940 kip/in; p_req = n_rZ_r/V_sr = 4(4.2092)/1.2940 = 13.012 in; SC1 = 13/13.012 = 0.9991
  const z = zone(d); assert.equal(d.SR.gf, 1.75); assert.ok(Math.abs(z.Vfat - 1.29397) < 1e-4 && Math.abs(z.preq - 13.0119) < 1e-3, `${z.Vfat} ${z.preq}`);
  // an old project with studs.gamFat = 1.5 (before: used, V_fat 1.1091, p_req 15.181, SC1 0.8564): now the project's 1.75, the same as the default
  assert.equal(o.SR.gf, 1.75); assert.equal(JSON.stringify(zone(o)), JSON.stringify(z)); assert.equal(JSON.stringify(o.oldFat), '{"was":1.5,"now":1.75}'); assert.equal(d.oldFat, null);
  // fatigue.gam.fI = 1.5: V_fat = 1.5(45.8)(1714.009)/106168.02 = 1.1091 kip/in, p_req = 15.181 in, SC1 = 13/15.181 = 0.8564
  const r = zone(q); assert.equal(q.SR.gf, 1.5); assert.ok(Math.abs(r.Vfat - 1.10911) < 1e-4 && Math.abs(r.preq - 15.1806) < 1e-3, `${r.Vfat} ${r.preq}`);
  // the saved value stays in the file; validate does not block on it (a value that can no longer be edited)
  const P = proj(null, -1); assert.equal(P.studs.gamFat, -1); const v = W.SBDModel.validate(P); assert.ok(!v.errors.some(e => e.path === 'studs.gamFat'), JSON.stringify(v.errors).slice(0, 300));
  // the analysis payload sends the project's γ (gamI) and the hand-off path takes it (opt.fI)
  const A = FU.fromAnalysis(J(proj(1.6)), 0); assert.equal(A.pl.girderDetail.details.studs.results.gamI, 1.6);
  const F = W.SBDStuds.fromPayload(A.pl, { fI: 1.6 }); assert.equal(F.p.gam.fat, 1.6); assert.equal(F.env.fat.set.gI, 1.6);
  const F0 = W.SBDStuds.fromPayload(A.pl); assert.equal(F0.p.gam.fat, 1.6); assert.equal(F0.env.fat.set.gI, 1.75);   // without opt: as before (the file's gamI, γ_I 1.75)
});
