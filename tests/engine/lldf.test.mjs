// shared/lldf.js (window.SharedLLDF, the engine of lldf.html) and apps/steel-bridge/engine/lldf.js (the adapter, window.SBDLldf).
// 1. The move out of lldf.html is bit-identical: tests/engine/lldf-hash.mjs runs ~1,600 cases (every girder type, interior and
//    exterior, moment and shear, fatigue, skews, N_b = 3, S > 16 ft, lever rule and rigid section, the page's defaults and its
//    catalog presets, continuous regions, input errors) through the page's engine before the move and shared/lldf.js + the
//    page's remaining code after it, and compares SHA-256 hashes of every output.
// 2. Hand checks of the four places where the steel-bridge app now follows lldf.html instead of GirderDetail (engineer's decision
//    2026-10-29, fixlog/steel-bridge.md SB2-O15), with the arithmetic in the comments.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { run as hashRun } from './lldf-hash.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', 'lldf.js', ENG('model.js'), ENG('sections.js'), ENG('owners.js'), ENG('lldf.js'), ENG('loads.js'));
const SL = W.SharedLLDF, LD = W.SBDLoads;
const fx = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/sbd2-loads', name + '.json'), 'utf8'));
const c = (a, b, w, tol = 2e-6) => assert.ok(Math.abs(a - b) < tol, `${w}: ${a} vs ${b}`);
const variant = (name, fn) => { const f = fx(name), df = JSON.parse(JSON.stringify(f.df)); fn(df.bridge, df); return LD.compute(df.bridge, df); };

test('shared/lldf.js = lldf.html\'s engine before the move: every output of ~1,600 cases hashes identically', () => {
  const r = hashRun();
  console.log(`       ${r.cases} cases, ${r.members} girders, ${r.steps} worked steps, ${r.outputs} outputs; sha256 ${r.hashAfter.slice(0, 16)}…; ${r.diffs.length} differ`);
  assert.ok(r.cases > 1000 && r.members > 5000);
  assert.deepEqual(r.diffs, []); assert.equal(r.hashAfter, r.hashBefore);
});

test('SharedLLDF: no DOM, one namespace; the per-span skew rule (4.6.2.2.2e)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'shared/lldf.js'), 'utf8');
  assert.ok(!/document\.|localStorage|sessionStorage|\bstate\./.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
  assert.equal(SL.momentSkewNoReduction(20, 35), true); assert.equal(SL.momentSkewNoReduction(35, 35), false);
  assert.equal(SL.momentSkewNoReduction(30, 40), false, 'exactly 10°: the reduction applies'); assert.equal(SL.momentSkewNoReduction(-6, 6), true, 'signed, as Bridge Geometry');
  // the simplified K_g option is off for lldf.html's inputs and gives Table 4.6.2.2.1-3's constants when set
  assert.equal(SL.empiricalInterior(869918.955, 110, 8, 9.5).kterm, Math.pow(869918.955 / (12 * 110 * 512), 0.1)); assert.equal(SL.empiricalInterior(1, 110, 8, 9.5, true).kterm, 1.02);
});

test('item 1, exterior fatigue floor (4.6.2.2.2d): xsA, span 1, G1: g_fat,M 0.2763 → 0.4474', () => {
  // xsA: 5 girders at 9.5 ft, overhangs 3.25 ft, live-load traffic face 5.5 ft from the left deck edge (sidewalk), L = 110 ft, skew 15°.
  // d_e = 3.25 − 5.5 = −2.25 ft. Lever rule, one truck: wheels at 5.5 + 2 = 7.5 and 13.5 ft; G1 at 3.25, G2 at 12.75 ft:
  //   c = (12.75 − 7.5)/9.5 = 0.552632, the second wheel is past G2 (0); R = 0.5(0.552632) = 0.276316; g = 1.2 × 0.276316 = 0.331579.
  // Rigid cross-section, one lane: X_ext = 19 ft, Σx² = 2(19² + 9.5²) = 902.5 ft², e = 19 + (−2.25) − 5 = 11.75 ft;
  //   R = 1/5 + 19(11.75)/902.5 = 0.2 + 0.247368 = 0.447368; g = 1.2 × 0.447368 = 0.536842.
  // Before (GirderDetail): g_fat,M = 0.331579/1.2 = 0.276316. After: max(0.331579, 0.536842)/1.2 = 0.447368 (r_M = 1, 15° < 30°).
  // Shear: r_V = 1.049681 (15°): before 0.276316 × 1.049681 = 0.290044; after 0.447368 × 1.049681 = 0.469594.
  const r = LD.compute(fx('xsA_AASHTO').df.bridge, fx('xsA_AASHTO').df), m = r.regions[0].members[0];
  c(m.lever1.df, 0.331579, 'lever, one lane'); c(m.rig1, 0.536842, 'rigid, one lane'); c(m.fat1, 0.536842, 'one-lane basis');
  c(m.fatM, 0.447368, 'g_fat,M'); c(m.fatV, 0.469594, 'g_fat,V'); c(m.lever1.df / 1.2, 0.276316, 'before (GirderDetail)');
  assert.ok(m.steps.some(s => s.id.endsWith('.fat1') && s.value === m.fat1));
});

test('item 2, moment skew per span (4.6.2.2.2e): support skews 20 / 35 / 35 / 50°, span 3, G2: g_M 0.6711 → 0.7034', () => {
  // Built-in bridge (3 spans 110 / 140 / 110 ft, 5 girders at 9.5 ft, t_s = 8 in), span 3: support lines 35° and 50° differ by 15° > 10°.
  // K_g = 869,919 in⁴; (K_g/12Lt_s³) = 1.287167; interior two-lane equation 0.703391 (as the loads hand check).
  // Before (GirderDetail): θ = min(35, 50) = 35°: c_1 = 0.25(1.287167)^0.25(9.5/110)^0.5 = 0.25 × 1.065137 × 0.293877 = 0.078255;
  //   r_M = 1 − 0.078255(tan 35°)^1.5 = 1 − 0.078255 × 0.585934 = 0.954148; g_M = 0.703391 × 0.954148 = 0.671139.
  // After: no reduction, r_M = 1, g_M = 0.703391. Span 2 (35° / 35°) and the piers (one support line each) keep the reduction.
  const r = variant('builtin_AASHTO', b => { const sk = [20, 35, 35, 50]; b.skews = sk; b.regions.forEach(q => { if (q.kind === 'span') { q.skA = sk[q.i]; q.skB = sk[q.i + 1]; } else q.skA = q.skB = sk[q.i]; }); });
  const s2 = r.regions.find(q => q.id === 's2'), s1 = r.regions.find(q => q.id === 's1');
  assert.equal(s2.sk.noRed, true); assert.equal(s2.sk.scfM, 1); c(s2.members[1].gM, 0.703391, 'span 3 G2 g_M');
  c(0.703391 * (1 - 0.078255 * Math.pow(Math.tan(35 * Math.PI / 180), 1.5)), 0.671139, 'before');
  assert.equal(s1.sk.noRed, false); assert.ok(s1.sk.scfM < 1, 'span 2 keeps the reduction');
  assert.ok(s2.steps.some(s => s.id === 'df.s2.noRed'));
});

test('item 3, S > 16 ft: governing of 2 … N_L trucks: N_b = 4 at 18 ft, G2: g_M 1.4444 → 1.4639', () => {
  // 4 girders at 18 ft, overhangs 4 ft, faces 1.5 ft: deck 62 ft, roadway 59 ft, N_L = 4; G1 … G4 at 4, 22, 40, 58 ft.
  // Interior G2 (between 4 and 40 ft), lever rule:
  //   2 trucks, wheels 12, 18, 22, 28 ft: c = 8/18, 14/18, 1, 12/18 → R = 0.5(2.888889) = 1.444444; m = 1.00 → 1.444444 (GirderDetail).
  //   3 trucks, wheels 6, 12, 16, 22, 26, 32 ft: c = 2/18, 8/18, 12/18, 1, 14/18, 8/18 → R = 0.5(3.444444) = 1.722222; m = 0.85 → 1.463889.
  //   4 trucks: R = 1.833333, m = 0.65 → 1.191667. Governing: 3 trucks, g_M = 1.463889 (+1.3 %).
  const r = variant('builtin_AASHTO', b => { b.nb = 4; b.S = 18; b.bays = [18, 18, 18]; b.ohL = 4; b.ohR = 4; }), rg = r.regions[0], m = rg.members[1];
  const L = N => rg.lever[1].cfgs.find(q => q.N === N);
  c(L(2).df, 1.444444, '2 trucks'); c(L(3).df, 1.463889, '3 trucks'); c(L(4).df, 1.191667, '4 trucks'); c(m.gM, 1.463889, 'g_M'); assert.equal(m.alt.l2.N, 3);
});

test('item 4, lever rule at the exact kink / end positions: overhangs 3.3 ft, G5: one-lane lever 0.7832 → 0.7958', () => {
  // Built-in bridge with 3.3 ft overhangs: deck 44.6 ft, faces 1.5 ft; G4 at 31.8, G5 at 41.3 ft. One truck, right end of travel:
  //   s_max = 44.6 − 1.5 − 2 − 6 = 35.1 ft (wheels 35.1 and 41.1 ft). The 0.25 ft grid from 3.5 ft stops at 35.0 ft.
  //   Before (grid): c = (35.0 − 31.8)/9.5 = 0.336842, (41.0 − 31.8)/9.5 = 0.968421 → R = 0.652632, g = 1.2R = 0.783158.
  //   After (end of travel tested): c = 3.3/9.5 = 0.347368, 9.3/9.5 = 0.978947 → R = 0.663158, g = 0.795789.
  // g_M is governed by the rigid section (0.8126, unchanged); g_fat,M = max(0.795789, 0.639158)/1.2 = 0.663158 (before 0.652632).
  const r = variant('builtin_AASHTO', b => { b.ohL = 3.3; b.ohR = 3.3; }), m = r.regions[0].members[4];
  c(m.lever1.wheels[0], 35.1, 'position'); c(m.lever1.df, 0.795789, 'lever, one lane'); c(m.fatM, 0.663158, 'g_fat,M'); c(m.gM, 0.812632, 'g_M (rigid)');
});
