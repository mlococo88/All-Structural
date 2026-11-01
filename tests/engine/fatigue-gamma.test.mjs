// Fatigue I γ from one source (FGAM, 2026-11-01): the Flexure tab (fatigue stress ranges), the Shear & stiffeners tab (special fatigue
// requirement 6.10.5.3, stiffener weld toes CP2) and the Cross-frames tab (CF9, γ × 0.65) take γ Fatigue I from the Fatigue & studs inputs
// (P.fatigue.gam.fI), as the Welds tab does (#525). At the default 1.75 every result is what the hard-coded 1.75 gave.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/demands.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js',
  'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js'].map(E)));
const J = v => JSON.parse(JSON.stringify(v));
const strip = o => JSON.stringify(o, (k, v) => typeof v === 'function' || k === 'steps' || k === 'what' || k === 'src' || k === 'note' ? undefined : v);
const proj = fI => { const P = W.SBDModel.defaultProject(); if (fI === null) delete P.fatigue; else P.fatigue.gam.fI = fI; P.crossframes.user.Fat = { top: 0, bot: 1.2, diag: 3 }; return P; };
const run = P => ({ fx: W.SBDFlexureUI.build({ P: J(P), g: 0, src: 'analysis' }), sh: W.SBDShearUI.build({ P: J(P), g: 0, src: 'analysis' }), cf: W.SBDFramingUI.build({ P: J(P), g: 0 }) });

test('Fatigue I γ: the default 1.75 = no fatigue inputs = the old hard-coded 1.75; a non-default value reaches Flexure, Shear, stiffener welds and CF9 (FGAM)', () => {
  const d = run(proj(1.75)), n = run(proj(null)), q = run(proj(1.5));
  for (const k of ['fx', 'sh', 'cf']) assert.equal(strip(n[k]), strip(d[k]), `${k}: no fatigue inputs = 1.75`);
  // Flexure, x = 60.00 ft: (Δf)_bottom = γ(|f(505.29)| + |f(−230.47)|) = 1.75(4.5822) = 8.019 ksi → 1.50(4.5822) = 6.873 ksi
  d.fx.rows.forEach((r, i) => { const s = q.fx.rows[i]; assert.equal(r.gfat, 1.75); assert.equal(s.gfat, 1.5); assert.ok(Math.abs(s.dfB - r.dfB * 1.5 / 1.75) < 1e-9 && Math.abs(s.dfT - r.dfT * 1.5 / 1.75) < 1e-9); });
  const r60 = d.fx.rows.find(r => /60\.00/.test(r.name)); assert.ok(Math.abs(r60.dfB - 8.0188) < 1e-3, r60.dfB);
  // Shear GS18 at x = 109.99 ft: V_u = 103.157 + 17.705 + 14.664 + γ(45.226) = 214.671 kip (1.75) → 203.365 kip (1.50); V_cr = 786.63 kip
  const i = d.sh.stations.findIndex(r => /109\.99/.test(r.name)), a = d.sh.stations[i], b = q.sh.stations[i];
  assert.ok(Math.abs(a.VuF - 214.671) < 1e-3 && Math.abs(b.VuF - 203.365) < 1e-3, `${a.VuF} ${b.VuF}`);
  assert.ok(Math.abs(b.VuF - (a.VDC1 + a.VDC2 + a.VDW + a.VUT + a.VUF + 1.5 * a.Vf)) < 1e-9);
  assert.equal(d.sh.TS.g.fat, 1.75); assert.equal(q.sh.TS.g.fat, 1.5);   // CP2: γ(Δf) at the stiffener weld toes
  // CF9, diagonal: γ(0.65)ΔP/A_g = 1.75(0.65)(3)/3.609375 = 0.9455 ksi → 1.50(0.65)(3)/3.609375 = 0.8104 ksi
  assert.ok(Math.abs(d.cf.R.mem.diag.df - 0.94545) < 1e-4 && Math.abs(q.cf.R.mem.diag.df - 0.81039) < 1e-4);
  assert.equal(q.cf.R.gFI, 1.5); assert.ok(/1\.50 × 0\.65/.test(q.cf.C.find(c => c.id === 'CF9').note));
});
