// Steel Bridge (apps/steel-bridge), engineer's approvals of 2026-11-19 (made-up bridges only: the app's built-in example, changed where stated):
//  N2  stud radial fatigue shear F_fat = F_rc / w with w = 24.0 in at end supports, 48.0 in elsewhere (AASHTO LRFD 10th Ed. Art. 6.10.10.1.2, p. 6-224);
//  A2  haunch and SIP form dead loads with each plate segment's top flange width (engine/analysis.js wetCorr);
//  A3  a flexure point next to a brace point takes the unbraced segment on its own side (engine/flexure.js bracing);
//  N5  computing the Report / the Cross-frames tab does not write default framing into a project that has none (ui/framing.js build).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/welds.js', 'engine/autodesign.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js',
  'ui/splices.js', 'ui/constructibility.js', 'ui/welds.js', 'report/data.js', 'report/builders.js'].map(E));
const W = loadShared(...FILES);
const M = W.SBDModel, near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`), J = o => JSON.parse(JSON.stringify(o));

test('N2: F_fat = F_rc/(w/2) in a zone at an end support, F_rc/w elsewhere (6.10.10.1.2, p. 6-224); hand check', () => {
  const p = J(W.SBDStuds.DEFAULT); p.skew = 'yes';
  const R = W.SBDStuds.compute(p, { fat: { B: W.SBDFatigue.supports({ ok: true, spans: [110], cont: false }) } }); assert.equal(R.errors.length, 0, R.errors.join(' '));
  const [z1, z2] = R.zones;
  // zone 1 (0 to 22 ft) reaches the abutment at x = 0: w = 48/2 = 24 in, F_fat = 25/24 = 1.0417 kip/in (before 25/48 = 0.5208)
  assert.equal(z1.end, true); near(z1.Ffat, 25 / 24, 1e-12, 'F_fat end'); near(z2.Ffat, 25 / 48, 1e-12, 'F_fat interior'); assert.equal(z2.end, false);
  // V_sr = √(V_fat² + F_fat²): after √(V_fat² + 1.0417²), before √(V_fat² + 0.5208²); p_max = n Z_r / V_sr
  near(z1.Vsr, Math.hypot(z1.Vfat, 25 / 24), 1e-12, 'V_sr'); near(z1.preq, z1.nr * z1.Zr / z1.Vsr, 1e-9, 'p_max');
  const before = z1.nr * z1.Zr / Math.hypot(z1.Vfat, 25 / 48); assert.ok(z1.preq < before, 'more studs needed at the end support');
  // right end (x = 110 ft) too
  const q = J(p); q.zones = [{ ...q.zones[0], name: 'end 2', x1: 88, x2: 110 }]; const R2 = W.SBDStuds.compute(q, { fat: { B: W.SBDFatigue.supports({ ok: true, spans: [110], cont: false }) } });
  assert.equal(R2.zones[0].end, true);
  // not skewed: F_fat = 0 everywhere (unchanged)
  const s = W.SBDStuds.compute(J(W.SBDStuds.DEFAULT), {}); assert.ok(s.zones.every(z => z.Ffat === 0));
});

test('A2: haunch and SIP with each segment\'s top flange (built-in example: pier segments b_f = 18 in, b_f,0 = 16 in); hand check', () => {
  const P = M.defaultProject(), R = W.SBDAnalysis.analyzeGirder(P, 0, { ll: false }); assert.ok(!R.errors.length, R.errors.join(' '));
  // Δb_f = (18 − 16)/12 = 0.16667 ft; haunch 2/12 × 0.16667 × 0.150 = 0.0041667 klf; SIP −15/1000 × 2 bays × 0.16667/2 = −0.0025 klf; Δw = +0.0016667 klf
  assert.equal(R.wetCorr.length, 2); R.wetCorr.forEach(c => { near(c.dh, 0.0041667, 1e-6, 'haunch'); near(c.ds, -0.0025, 1e-9, 'SIP'); near(c.w, 0.0016667, 1e-6, 'Δw'); });
  assert.equal(JSON.stringify(R.wetCorr.map(c => [c.x0, c.x1])), JSON.stringify([[88, 128], [232, 272]]));
  // equilibrium: ΣR = w L + ΣΔw ℓ = w(360) + 0.0016667(40 + 40)
  const sR = R.st.DC1wet.R.reduce((a, b) => a + b, 0); near(sR, R.loads.DC1wet * 360 + 0.0016667 * 80, 1e-4, 'ΣR');
  // equal flanges: no correction, w as before
  const Q = M.defaultProject(); Q.girders[0].segments.forEach(s => { s.topB = 16; }); assert.equal(W.SBDAnalysis.analyzeGirder(Q, 0, { ll: false }).wetCorr.length, 0);
});

test('A3: the row just left of an interior support takes the left unbraced segment (built-in example: braces 90.20 | 110 | 133.33 ft)', () => {
  const P = M.defaultProject(), F = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', method: 'auto' }); assert.ok(!F.err, F.err);
  const L = F.rows.find(r => Math.abs(r.x - 109.99) < 1e-6), Rr = F.rows.find(r => Math.abs(r.x - 110.01) < 1e-6);
  // left: L_b = 110 − 90.20 = 19.80 ft (its own girder length, lenOf); right: 133.33 − 110 = 23.33 ft. Before, 109.99 took the governing of both.
  near(L.Lb, 110 - F.D.braces.filter(x => x < 110 - 0.25).pop(), 0.05, 'left L_b'); near(Rr.Lb, F.D.braces.find(x => x > 110 + 0.25) - 110, 0.05, 'right L_b'); assert.ok(L.Lb < Rr.Lb);
});

test('N5: the Report and the Cross-frames tab compute a project without framing read-only', () => {
  const P = M.defaultProject(); delete P.framing; delete P.crossframes; const s0 = JSON.stringify(P);
  const B = W.SBDFramingUI.build({ P, g: 0 }); assert.ok(!B.err, B.err); assert.equal(B.dflt, true);
  W.SBDReportData.compute(P, 0, { want: { frm: true } });
  assert.equal(JSON.stringify(P), s0, 'nothing written into the project'); assert.equal(P.framing, undefined);
  const Q = M.defaultProject(); assert.equal(W.SBDFramingUI.build({ P: Q, g: 0 }).dflt, false);
});
