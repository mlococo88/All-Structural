// apps/steel-bridge/engine/analysis.js: hand checks, and parity with GirderDetail's Structural analysis two ways:
//   (a) the station demands stored in the tests/projects/st/gd_*.json hand-off payloads (girderDemands: M and V per stage,
//       M_DCc, M_CL, D_* deflections, the SA3 LL deflection), each payload turned into an sbd2 project (an-fixture.mjs);
//   (b) GirderDetail's own functions run in Node (gd-sa-ref.mjs on gd-source.mjs: sgBeam, feStages, sgLLRow, feIM, saSeq, …)
//       on the same inputs, at full precision; also with the cracked zones '15' and 'dl' and on the built-in project.
// By default a sample of the payloads runs (every 10th, ~2 min); SBD_AN_ALL=1 runs all 100.
//
// Differences found, with their causes (none changed on either side; CLAUDE.md §4/§9; reported in fixlog/steel-bridge.md):
//   1. Uniform loads: exact (consistent loads) here, lumped at GirderDetail's 1-ft nodes there: M within 0.01 % of max |M|.
//   2. Girder steel weight at a plate-zone boundary: GirderDetail gives the boundary node the left zone's weight over its
//      whole tributary length; here each zone's weight ends at the boundary: M_DC1steel up to ~0.2 % of max |M_DC1steel|
//      (under 1 kip-ft). The cause check below feeds GirderDetail's nodal loads to the shared engine: round-off.
//   3. Shear at a node: here the exact shear just right of the station; GirderDetail's is its element's constant shear, which
//      with lumped loads equals the exact shear at the element middle (0.5 ft further): |ΔV| = w h / 2, ~0.7 % of max |V|.
//   4. M_DCc (deck placement sequence): GirderDetail loads a node on a pour boundary in both pours (its whole tributary
//      length each time), so 1 ft of deck is counted twice per boundary; here each pour's wet load ends at the boundary.
//      ~1 % of max |M_DCc| near the piers. With the double count emulated (each pour 0.5 ft longer at both ends), 0.03 %.
//   5. Dead-load deflections: exact beam deflections here; virtual work by GirderDetail's nodal rule: ≤ 0.3 %.
//   6. LL deflection: here the 1/20 points and all axles of the truck; GirderDetail every second node with the axles that
//      add (LL8): ≤ 0.1 %.
//   7. Payload only: the payload rounds the loads and distribution factors to 4 decimals and the results to 0.001:
//      ≤ 0.11 % (M_DC2 of a girder with a small DC2: w 4-decimal rounding), 0.005 % (LL).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { payloadFiles, readPayload, projectFromPayload, gdNodes, pairsPayload, pairsGD, diffStats } from './an-fixture.mjs';
import { gdSA } from './gd-sa-ref.mjs';

const ENG = p => path.join(ROOT, 'apps/steel-bridge/engine', p);
const W = loadShared('steps.js', 'vehicles.js', 'moving-load.js', ENG('model.js'), ENG('sections.js'), ENG('analysis.js'));
const AN = W.SBDAnalysis, ML = W.SharedMovingLoad, STEPS = W.SharedSteps;
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const ALL = !!process.env.SBD_AN_ALL;
const fmt = (s, k) => `${k.padEnd(24)} ${(100 * s.rel).toFixed(4).padStart(8)} %  |d| ${s.abs.toFixed(4).padStart(9)}  at x ${typeof s.at === 'number' ? s.at.toFixed(1) : s.at}  (${String(s.file).replace(/\.json$/, '')})`;

/* ---------- hand checks ---------- */
// A small project: prismatic steel I 16 × 1 / 60 × 1/2 / 16 × 1 (A = 62 in², I_s = 38,770.667 in⁴; tests/engine/sections.test.mjs)
function proj(spans, cont, extra = {}) {
  const P = W.SBDModel.defaultProject(), Lt = spans.reduce((a, b) => a + b, 0);
  P.spans = { lengths: spans, continuity: cont ? 'continuous' : 'simple' };
  P.girders = [{ id: 'G1', label: 'G1', position: 'interior', beff: 96, segments: [{ x0: 0, x1: Lt, D: 60, tw: 0.5, topB: 16, topT: 1, botB: 16, botT: 1 }], ...extra }];
  P.analysis = { im: 33, imf: 15, crack: 'none', deflLimit: 800, seq: 'off', steelAllowPct: 0 };
  return P;
}

test('hand check 1: two equal spans 100 ft, girder steel only (w = 62 in² × 490/144 lb/ft/in² = 0.210972 klf; SB2-A2)', () => {
  const R = AN.analyzeGirder(proj([100, 100], true), 0, { ll: false });
  assert.deepEqual([...R.errors], []);
  // w_s = A_s (490/144)(1 + 0)/1000 = 62 × 3.402778 / 1000 = 0.2109722 klf (before SB2-A2: 62 × 3.4 / 1000 = 0.2108)
  close(R.wSteel[0], 62 * 490 / 144 / 1000, 1e-15, 'w_s'); close(R.wSteel[0], 0.2109722, 1e-7, 'w_s (rounded)');
  const w = 62 * 490 / 144 / 1000, i = x => R.x.findIndex(v => Math.abs(v - x) < 1e-9);
  // pier moment −wL²/8 = −0.2109722 × 100² / 8 = −263.7153 kip-ft; reactions 0.375wL = 7.911458, 1.25wL = 26.37153 kips
  close(R.st.DC1steel.M[i(100)], -w * 1e4 / 8, 1e-9, 'M pier'); close(R.st.DC1steel.M[i(100)], -263.7153, 1e-4, 'M pier (rounded)');
  close(R.st.DC1steel.R[0], 0.375 * w * 100, 1e-9, 'R_A'); close(R.st.DC1steel.R[1], 1.25 * w * 100, 1e-9, 'R_B'); close(R.st.DC1steel.R[0], 7.911458, 1e-6, 'R_A (rounded)');
  // shear just left of the pier −0.625wL = −13.18576 kips; just right +13.18576
  close(R.st.DC1steel.VL[i(100)], -0.625 * w * 100, 1e-9, 'V left of pier'); close(R.st.DC1steel.VR[i(100)], 13.185764, 1e-6, 'V right of pier');
  // deflection at x = L/2 (each span a propped cantilever): wL⁴/(192 EI); EI = 29,000 × 38,770.667 / 144 = 7,807,982 kip-ft²
  //   = 0.2109722 × 100⁴ / (192 × 7,807,982) = 0.0140730 ft = 0.168875 in
  const EI = 29000 * (38770 + 2 / 3) / 144;
  close(R.camber.steel[i(50)], 12 * w * 1e8 / (192 * EI), 1e-7, 'deflection at L/2'); close(R.camber.steel[i(50)], 0.168875, 1e-5, 'deflection (rounded)');
  // the statics step: ΣR = Σ w ℓ = 0.2109722 × 200 = 42.19444 kips
  const s = R.steps.find(q => q.id === 'an.eq.DC1steel'); close(s.value, 42.194444, 1e-6, 'ΣR'); assert.equal(s.ok, true);
  // GirderDetail's 3.4 (opt.steelPlf, parity tests): w = 0.2108, ΣR = 42.16; the ratio is 490/144/3.4 = 1.000817 (+0.0817 %)
  const R0 = AN.analyzeGirder(proj([100, 100], true), 0, { ll: false, steelPlf: 3.4 });
  close(R0.wSteel[0], 0.2108, 1e-12, 'w_s at 3.4'); close(R.st.DC1steel.M[i(100)] / R0.st.DC1steel.M[i(100)], 490 / 144 / 3.4, 1e-12, 'ratio');
});

test('hand check 2: single span 60 ft, HL-93 with g_M = 0.5, g_V = 0.8 (closed forms of tests/engine/simple-span.test.mjs)', () => {
  const R = AN.analyzeGirder(proj([60], false, { df: { spans: [{ gM: 0.5, gV: 0.8, fatM: 0.3, fatV: 0.4 }], piers: [], gDef: 0.6 } }), 0);
  const i = x => R.x.findIndex(v => Math.abs(v - x) < 1e-9);
  // per lane: M_mid = 1.33(18L − 280) + wL²/8 = 1.33(800) + 0.64(3600)/8 = 1064.00 + 288 = 1352.00 kip-ft; × g_M 0.5 = 676.00
  close(R.ll.Mpos[i(30)], 676.0, 1e-7, 'M_LL midspan');
  // end shear 1.33(72 − 672/L) + wL/2 = 1.33(60.8) + 19.2 = 100.064 kips; × g_V 0.8 = 80.0512
  close(R.ll.VRpos[0], 80.0512, 1e-7, 'V_LL end'); close(R.llR[0].max, 80.0512, 1e-7, 'R_LL end');
  // fatigue truck 8-32-32 kip at 14 and 30 ft, IM 15 %, midspan: influence line a/2 (a ≤ 30 ft), (60 − a)/2 (a ≥ 30 ft).
  //   Middle axle at 30 ft: 8 kip at 16 ft (ordinate 8), rear 32 kip at 60 ft (ordinate 0): M = 32(15) + 8(8) = 544 kip-ft
  //   (moving the truck either way lowers it: 544 − 4d or 544 − 12d); × 1.15 = 625.6; × g_fat 0.3 = 187.68 kip-ft
  close(R.fat.Mpos[i(30)], 187.68, 1e-7, 'M_FAT midspan');
  // the step of the largest LL moment of the span (on the 1-ft stations, at x = 28 ft, near the absolute maximum 1359.24
  // per lane at x* = 28.056 ft): M_LL+IM = g_M M_HL93 = 0.500(1359.2) = 679.6 kip-ft
  const s = R.steps.find(q => q.id === 'an.M.LL.s1');
  assert.equal(STEPS.line(s, false), 'M_(LL+IM) = g_M M_(HL93) = 0.500(1359.2) = 679.6 kip-ft'); close(s.value, R.ll.Mpos[i(28)], 0, 'step value');
});

test('SML-O4 (engineer, 2026-10-29): simple spans keep 90 % of two trucks + lane on the summed pier reaction', () => {
  // two simple spans 60 + 110 ft, g = 1 (tests/engine/simple-span.test.mjs): pier R one truck 142.261; 90 % two trucks 0.9[1.33(60.800 + 27.055) + 54.4] = 154.122 kips
  const R = AN.analyzeGirder(proj([60, 110], false, { df: { spans: [{ gM: 1, gV: 1, fatM: 1, fatV: 1 }, { gM: 1, gV: 1, fatM: 1, fatV: 1 }], piers: [{ gM: 1 }], gDef: 1 } }), 0);
  const ip = R.supIdx[1];
  close(R.st.DC1steel.M[ip], 0, 1e-9, 'pier M (dead)'); close(R.ll.Mneg[ip], 0, 1e-9, 'pier M (LL)');
  close(R.llR[1].max, 154.122, 1e-5, 'pier R (rounded)'); assert.equal(R.llR[1].two, true, 'two-truck case governs');
  assert.equal(R.seq, null, 'no deck placement sequence on simple spans');
});

test('steps: format and rendering', () => {
  const P = proj([90, 110], true, { loadsManual: { DC1wet: 1.1, DC2: 0.25, DW: 0.2, CL: 0.19 }, dfManual: { gM: 0.7, gV: 0.9, fatM: 0.4, fatV: 0.6, gDef: 0.5 } }); P.analysis.seq = 'on';
  const R = AN.analyzeGirder(P, 0);
  const ids = R.steps.map(s => s.id); assert.equal(new Set(ids).size, ids.length, 'ids unique');
  R.steps.forEach(s => { assert.ok(!/undefined|NaN/.test(STEPS.line(s, true)), `${s.id}: ${STEPS.line(s, true)}`); assert.match(s.ref || 'Statics', /AASHTO LRFD 10th Ed\.|Statics/, s.id); });
  R.steps.filter(s => /^an\.eq\./.test(s.id)).forEach(s => assert.equal(s.ok, true, `${s.id} equilibrium`));
  assert.ok(R.seq && R.seq.pours.length >= 3, 'pour sequence');
});

test('sb2-pour-sign: a round-off M_DC1 at an abutment makes no sliver pour; a real contraflexure point still splits', () => {
  // Two equal spans L = 10 ft, w = 1 klf, nodes every 1 ft: span 1 M(x) = w(3Lx/8 − x²/2) = 3.75x − x²/2, span 2 its mirror.
  //   zero at x = 0 and 7.5 ft (contraflexure), pier M(10) = 37.5 − 50 = −12.5 kip-ft, largest |M| = M(3.75) region: M(4) = 15 − 8 = 7 … pier 12.5.
  //   nodes: M(7) = 26.25 − 24.5 = +1.75, M(8) = 30 − 32 = −2.00 → the first negative node is x = 8; mirror: M(12) = −2.00, M(13) = +1.75.
  //   tolerance = 1e-6 × 12.5 = 1.25e-5 kip-ft.
  const xs = Array.from({ length: 21 }, (_, i) => i), M = xs.map(x => { const u = x <= 10 ? x : 20 - x; return 3.75 * u - u * u / 2; });
  M[0] = -1e-11; M[20] = -1.6e-11;   // round-off at the abutments, as the engine's M_DC1(0) = −1.6e-11 kip-ft on the built-in project
  const str = ps => ps.map(q => `${q.a}-${q.b}`).join(' ');
  // positive regions first, left to right, then negative: [0, 8], [13, 20], then [8, 13] (before the fix: [1, 8], [13, 20], [0, 1], [8, 13])
  assert.equal(str(AN.pourRegions(xs, M)), '0-8 13-20 8-13');
  M[0] = 0; M[20] = 0; assert.equal(str(AN.pourRegions(xs, M)), '0-8 13-20 8-13', 'exact zero: the same');
  M[0] = 1e-11; assert.equal(str(AN.pourRegions(xs, M)), '0-8 13-20 8-13', 'positive round-off: the same');
  // a negative moment above the tolerance at the end is a real sign change and still splits (−1e-3 > 1.25e-5 kip-ft)
  M[0] = -1e-3; assert.equal(str(AN.pourRegions(xs, M)), '1-8 13-20 0-1 8-13', 'real negative end moment');
  // a real contraflexure point on a node within the tolerance of zero counts as positive, as an exact zero always did: M(8) := −1e-7
  M[0] = 0; const M2 = M.slice(); M2[8] = -1e-7; assert.equal(str(AN.pourRegions(xs, M2)), '0-9 13-20 9-13');
  M2[8] = 0; assert.equal(str(AN.pourRegions(xs, M2)), '0-9 13-20 9-13', 'exact zero on the node: the same');
});

/* ---------- parity ---------- */
const files = payloadFiles(), sample = ALL ? files : files.filter((f, i) => i % 10 === 0 || f === 'gd_xsA_RIDOT_G1.json');   // + one with a pedestrian load (sb-ped-owner PR)
// bounds: largest |difference| / largest |value| of the quantity on the girder (causes in the header)
const BOUND_P = { M_DC1steel: 0.004, M_DC1wet: 2e-4, M_DC1: 1e-3, M_DC2: 2e-3, M_DW: 2e-4, M_CL: 2e-4, V_DC1: 0.012, V_DC2: 0.012, V_DW: 0.012, V_CL: 0.012, 'V_DC1 left of piers': 0.012,
  D_DC1steel: 0.005, D_DC1wet: 0.002, D_DC2DW: 0.003, M_DCc: 0.015, M_LLpos: 2e-4, M_LLneg: 2e-4, M_FATpos: 2e-4, M_FATneg: 2e-4, 'V_LL max': 2e-4, 'V_LL min': 2e-4,
  'V_FAT max': 2e-4, 'V_FAT min': 2e-4, 'V_LL max left of piers': 2e-4, 'V_LL min left of piers': 2e-4, 'LL deflection per span': 0.002,
  M_PLpos: 0.003, M_PLneg: 0.003, 'V_PL max': 0.003, 'V_PL min': 0.003 };   // PL (sb-ped-owner PR): difference 7, w_PL rounded to 4 decimals (xsA RIDOT G2: 0.0178 klf, 0.21 %)
const BOUND_G = { ...BOUND_P, M_DC2: 2e-4, 'f_deck (pour sequence)': 0.05, R_DC1: 1e-3, R_DC2: 1e-5, R_DW: 1e-5, R_CL: 1e-5, 'R_LL max': 1e-5, 'R_LL min': 1e-5, 'R_PL max': 1e-5, 'R_PL min': 1e-5, M_PLpos: 1e-4, M_PLneg: 1e-4, 'V_PL max': 1e-5, 'V_PL min': 1e-5 };
const cache = {};
function run(f, o = {}) {
  const key = f + JSON.stringify(o); if (cache[key]) return cache[key];
  const p = readPayload(f), P = projectFromPayload(p, o), G = gdNodes(p), R = AN.analyzeGirder(P, 0, { ll: o.ll !== false, steelPlf: 3.4 });   // GirderDetail's SA_PLF 3.4 (SB2-A2: the app uses 490/144; see the SB2-A2 test)
  assert.deepEqual([...R.errors], [], f);
  const D = gdSA(P, 0, R.n), skip = new Set(); R.region.forEach((r, i) => { if (r !== D.region[i]) skip.add(i); });
  return (cache[key] = { p, P, G, R, D, skip });
}
// Difference 8: the pier region (negative permanent-load moment, the pier g_M and the two-truck case) can end one node apart
// where the permanent moment is within round-off of zero at a node (lumped vs exact loads). Those nodes are listed and left
// out of the LL moment comparison; the test asserts that the permanent moment there is within 0.1 % of its largest value.
const regionNote = [];
function regionCheck(f, R, D, skip) {
  if (!skip.size) return;
  const Mp = D.Mperm, sc = Math.max(...Array.from(Mp, Math.abs));
  skip.forEach(i => { regionNote.push(`${f}: x = ${D.xs[i]} ft, M_perm ${R.st.DC1.M[i] + R.st.DC2.M[i] + R.st.DW.M[i] + (R.st.UT ? R.st.UT.M[i] : 0) >= 0 ? '+' : ''}${(R.st.DC1.M[i] + R.st.DC2.M[i] + R.st.DW.M[i] + (R.st.UT ? R.st.UT.M[i] : 0)).toFixed(3)} here, ${Mp[i].toFixed(3)} in GirderDetail`);
    assert.ok(Math.abs(Mp[i]) < 1e-3 * sc, `${f}: pier region differs at x = ${D.xs[i]} where M_perm = ${Mp[i]}`); });
}
function check(stats, bounds, title) {
  console.log(`       ${title}: largest difference / largest |value| per quantity`);
  const bad = [];
  for (const [k, s] of Object.entries(stats)) { console.log('       ' + fmt(s, k)); if (!(s.rel <= (bounds[k] ?? 1e-9))) bad.push(`${k}: ${(100 * s.rel).toFixed(4)} % > ${(100 * (bounds[k] ?? 0)).toFixed(4)} %`); }
  assert.deepEqual(bad, [], 'differences beyond the bounds of their known causes');
}

test(`parity with the payloads' station demands (${sample.length} of ${files.length} gd_*.json${ALL ? '' : '; SBD_AN_ALL=1 for all'})`, () => {
  const S = {}; sample.forEach(f => { const { p, G, R, skip } = run(f); diffStats(pairsPayload(R, p, G, skip), S, f, G.xs); });
  check(S, BOUND_P, 'vs payload');
});

test(`parity with GirderDetail's own functions in Node, same inputs (${sample.length} payloads)`, () => {
  const S = {}; sample.forEach(f => { const { G, R, D, skip } = run(f); diffStats(pairsGD(R, D, skip), S, f, G.xs); regionCheck(f, R, D, skip); });
  check(S, BOUND_G, 'vs GirderDetail functions');
  console.log(`       pier regions one node apart (difference 8): ${regionNote.length ? regionNote.join('; ') : 'none'}`);
});

test('cause check (difference 2): GirderDetail\'s lumped node loads through the shared engine agree to round-off', () => {
  const { R, D } = run(sample[0]), xs = D.xs, N = D.N, trib = xs.map((_, k) => ((k < N - 1 ? xs[k + 1] - xs[k] : 0) + (k > 0 ? xs[k] - xs[k - 1] : 0)) / 2);
  const P = run(sample[0]).P, g = P.girders[0], al = g.loads.steelAllowPct;
  const zAt = x => g.segments.find(s => x >= s.x0 - 1e-9 && x <= s.x1 + 1e-9);
  const wSt = xs.map(x => { const s = zAt(x); return (s.topB * s.topT + s.botB * s.botT + s.D * s.tw) * 3.4 / 1000 * (1 + al / 100); });
  const pts = xs.map((x, k) => [x, wSt[k] * trib[k]]); g.loads.xf.forEach(q => pts.push([q.x, q.P]));
  const L = ML.staticAnalysis({ spans: P.spans.lengths, E: 29000, sb: R.sb.s, loads: { P: pts }, stations: xs });
  let mx = 0, sc = 0; L.M.forEach((v, i) => { mx = Math.max(mx, Math.abs(v - D.MS[i])); sc = Math.max(sc, Math.abs(D.MS[i])); });
  console.log(`       ${sample[0]}: M_DC1steel with GirderDetail's node loads: max |d| ${mx.toExponential(2)} kip-ft (max |M| ${sc.toFixed(1)})`);
  assert.ok(mx / sc < 1e-7);
});

test('SB2-A2: steel at 490/144 = 3.4028 lb/ft per in² (GirderDetail 3.4): only the girder-steel load changes, by 490/144/3.4 = 1.000817', () => {
  // Expected difference, nothing else: w_s × 1.000817; the girder-steel part of DC1 (M, V, R, deflection) × 1.000817; the cross-frame
  // point loads, the wet deck, DC2, DW, construction LL unchanged. M_steel(3.4) = M(3.4) − M(steel 0) (the cross-frame part).
  const k = 490 / 144 / 3.4; let worst = 0, dc1 = 0, dc1At = '', st = 0;
  sample.forEach(f => {
    const P = projectFromPayload(readPayload(f)), A = AN.analyzeGirder(P, 0, { ll: false, steelPlf: 3.4 }), B = AN.analyzeGirder(P, 0, { ll: false }), Z = AN.analyzeGirder(P, 0, { ll: false, steelPlf: 0 });
    B.wSteel.forEach((w, i) => close(w / A.wSteel[i], k, 1e-14, `${f} w_s`));
    const sc = Math.max(...A.st.DC1steel.M.map(Math.abs));
    for (const q of ['M', 'VL', 'VR', 'defl', 'R']) A.st.DC1steel[q].forEach((a, i) => { const e = a + (k - 1) * (a - Z.st.DC1steel[q][i]), d = Math.abs(B.st.DC1steel[q][i] - e);
      worst = Math.max(worst, d / Math.max(1, Math.abs(q === 'M' ? sc : a))); });
    for (const s1 of ['DC1wet', 'DC2', 'DW', 'CL']) for (const q of ['M', 'VR', 'R']) assert.deepEqual(Array.from(B.st[s1][q]), Array.from(A.st[s1][q]), `${f} ${s1} ${q} unchanged`);
    assert.deepEqual(Array.from(B.region), Array.from(A.region), `${f} pier regions unchanged`);
    A.st.DC1.M.forEach((a, i) => { if (Math.abs(a) > 0.5 * Math.max(...A.st.DC1.M.map(Math.abs))) { const r = B.st.DC1.M[i] / a - 1; if (r > dc1) { dc1 = r; dc1At = `${f} x = ${A.x[i].toFixed(1)}`; } } });
    A.st.DC1steel.M.forEach((a, i) => { const z = Z.st.DC1steel.M[i]; if (Math.abs(a - z) > 1e-6 * sc) st = Math.max(st, (B.st.DC1steel.M[i] - z) / (a - z) - 1); });
  });
  console.log(`       ${sample.length} payloads (dead loads): girder-steel moment × ${(1 + st).toFixed(6)} (expected ${k.toFixed(6)}); largest M_DC1 rise ${(100 * dc1).toFixed(4)} % (${dc1At}); other stages identical; residual ${worst.toExponential(2)}`);
  assert.ok(worst < 1e-9, 'only the steel part changes, linearly'); assert.ok(Math.abs(st - (k - 1)) < 1e-9); assert.ok(dc1 > 0 && dc1 <= k - 1 + 1e-12);
});

test('parity with GirderDetail\'s functions: cracked zones \'15\' and \'dl\' (6.10.1.5), dead and live load', () => {
  for (const crack of ['15', 'dl']) {
    const S = {}, f = sample[1 % sample.length], { G, R, D, skip } = run(f, { crack });
    assert.ok(R.crack.length >= 2, `${crack}: cracked zones`);
    const ck = []; for (let e = 0; e < D.N - 1; e++) if (D.crack[e]) { const l = ck[ck.length - 1]; if (l && Math.abs(l[1] - D.xs[e]) < 1e-9) l[1] = D.xs[e + 1]; else ck.push([D.xs[e], D.xs[e + 1]]); }
    assert.equal(JSON.stringify(R.crack.map(q => q.map(v => +v.toFixed(6)))), JSON.stringify(ck.map(q => q.map(v => +v.toFixed(6)))), `${crack}: same zones`);
    console.log(`       cracked '${crack}', ${f}: zones ${JSON.stringify(ck)} ft (same as GirderDetail's feStages)`);
    regionCheck(f, R, D, skip); diffStats(pairsGD(R, D, skip), S, f, G.xs); check(S, BOUND_G, `cracked '${crack}', ${f}`);
  }
});

test('parity with GirderDetail\'s functions: the built-in project (no loads entered: girder steel only, g = 1)', () => {
  const P = W.SBDModel.defaultProject(), R = AN.analyzeGirder(P, 0, { steelPlf: 3.4 }), D = gdSA(P, 0, R.n), S = {};   // GirderDetail's 3.4 (SB2-A2)
  assert.deepEqual([...R.errors], []); assert.ok(R.warnings.length >= 2, 'warns: no loads, no factors');
  diffStats(pairsGD(R, D), S, 'built-in', D.xs);
  check(S, { ...BOUND_G, M_DCc: 0.03 }, 'built-in project');
});

test('loads module path (engine/loads.js, engine/lldf.js): the default project takes its dead loads and factors from there', () => {
  const W2 = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', ENG('model.js'), ENG('sections.js'), ENG('owners.js'), 'lldf.js', ENG('lldf.js'), ENG('loads.js'), ENG('analysis.js'));
  const P = W2.SBDModel.defaultProject(), R = W2.SBDAnalysis.analyzeGirder(P, 0, { ll: false }), LDm = W2.SBDLoads;
  const { b, p } = LDm.fromModel(P, { girder: 0 }), C = LDm.compute(b, p), G = LDm.girder(C, 1);
  assert.deepEqual([...R.errors], []); assert.equal(R.line, 1, 'interior plate girder: cross-section girder G2');
  for (const [k, v] of [['DC1wet', G.DC1], ['DC2', G.DC2], ['DW', G.DW]]) { assert.equal(R.loads[k], v, k); assert.equal(R.loads.src[k], 'module', k); }
  assert.equal(R.loads.steelAllowPct, b.allow);
  const rg = id => C.regions.find(r => r.id === id);
  R.spans.forEach((_, i) => { const m = rg('s' + i).members[1]; assert.equal(R.df.spans[i].gM, m.gM); assert.equal(R.df.spans[i].gV, m.gV); assert.equal(R.df.spans[i].fatM, m.fatM); assert.equal(R.df.spans[i].gDef, rg('s' + i).gDef); });
  R.df.piers.forEach((q, k) => assert.equal(q.gM, rg('p' + (k + 1)).members[1].gM));
  console.log(`       default project, G2: DC1 ${G.DC1.toFixed(4)}, DC2 ${G.DC2.toFixed(4)}, DW ${G.DW.toFixed(4)} klf; span 1 g_M ${R.df.spans[0].gM.toFixed(4)}, pier 1 g_M ${R.df.piers[0].gM.toFixed(4)}; M_DC1 at pier 1 ${R.st.DC1.M[R.supIdx[1]].toFixed(1)} kip-ft`);
  // an explicit cross-section girder, and an owner whose rule OWN8 takes the haunch as 0 in the stiffness (MassDOT)
  P.girders[0].line = 0; P.ownerRules = { owner: 'MassDOT', eta: {} };
  const R2 = W2.SBDAnalysis.analyzeGirder(P, 0, { ll: false }), M2 = LDm.fromModel(P, { girder: 0 });
  assert.equal(R2.line, 0); assert.equal(R2.loads.DC2, LDm.girder(LDm.compute(M2.b, M2.p), 0).DC2);
  assert.equal(R2.h0, !!W2.SBDOwners.loadFactors('MassDOT', {}, P.xs.nb).h0, 'OWN8 from the owner rules');
});

test('SB2-A5: owner live load deflection limits (OWN19, engine/owners.js defl.ll), as GirderDetail SA3', () => {
  const W3 = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', ENG('model.js'), ENG('sections.js'), ENG('owners.js'), ENG('analysis.js'));
  const A3 = W3.SBDAnalysis, P = W3.SBDModel.defaultProject(), S = A3.settings(P), g = P.girders[0];   // interior plate girder: cross-section G2
  const own = o => { P.ownerRules = { owner: o, eta: {} }; return A3.deflOwner(P, g, A3.settings(P)); };
  assert.equal(own('AASHTO'), null); assert.equal(own('CTDOT'), null);   // no owner rule: the entered L/… (2.5.2.6.2, optional)
  // RIDOT BDM 2.4.2.6: vehicular only L/800; with pedestrians L/1000
  let o = own('RIDOT'); assert.equal(o.rq, 800); assert.equal(o.pref, 0); assert.equal(o.rep, false);
  // MassDOT 3.5.6.1: no sidewalk L/800, preferably L/1000; interior beam only
  o = own('MassDOT'); assert.equal(o.rq, 800); assert.equal(o.pref, 1000); assert.equal(o.rep, false); assert.equal(o.line, 1);
  g.line = 0; o = own('MassDOT'); assert.equal(o.rep, true, 'exterior cross-section girder: reported, not checked'); delete g.line;
  P.xs.sidewalks.L.w = 6; o = own('MassDOT'); assert.equal(o.rq, 1000); assert.equal(o.pref, 0); o = own('RIDOT'); assert.equal(o.rq, 1000);
  // an entered L/1200 is stricter and governs: rq = max(1000, 1200)
  P.analysis = { ...(P.analysis || {}), deflLimit: 1200 }; o = own('RIDOT'); assert.equal(o.rq, 1200); assert.equal(S.deflLimit, 800);
  // GirderDetail's SA3 status in the payloads: MassDOT exterior 'na', interior 'pass'; RIDOT exterior 'pass'; limit L/800: span 1 (110 ft) 1.65 in
  for (const f of ['gd_builtin_MassDOT_G1.json', 'gd_builtin_MassDOT_G2.json', 'gd_builtin_RIDOT_G1.json']) {
    const p = readPayload(f), Q = projectFromPayload(p); Q.ownerRules = { owner: p.ownerRules.owner, eta: {} };
    const R = A3.analyzeGirder(Q, 0), sp = p.girderDetail.deflection.ll.spans;   // A3: owners.js loaded
    R.lld.forEach((q, k) => { assert.equal(q.status, sp[k].status, `${f} span ${k + 1} status`); assert.equal(q.ratio, sp[k].ratio); close(q.lim, sp[k].lim, 0.005, `${f} limit`);
      assert.ok(Math.abs(q.d - sp[k].d) <= 0.002 * sp[k].d + 0.0006, `${f} span ${k + 1}: Δ ${q.d} vs ${sp[k].d}`); });
    const st = R.steps.find(s => s.id === 'an.defl.lim1'); assert.match(st.ref, p.ownerRules.owner === 'MassDOT' ? /3\.5\.6\.1/ : /2\.4\.2\.6/);
    console.log(`       ${f}: ${R.lld.map(q => `span ${q.k + 1} Δ ${q.d.toFixed(4)} (GirderDetail ${sp[q.k].d}) ≤ L/${q.ratio} = ${q.lim.toFixed(3)} in: ${q.status}`).join('; ')}`);
  }
});
