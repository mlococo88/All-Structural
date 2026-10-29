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
//      ≤ 0.02 % (DC2), 0.005 % (LL).
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

test('hand check 1: two equal spans 100 ft, girder steel only (w = 62 in² × 3.4 lb/ft/in² = 0.2108 klf)', () => {
  const R = AN.analyzeGirder(proj([100, 100], true), 0, { ll: false });
  assert.deepEqual([...R.errors], []);
  // w_s = A_s (3.4)(1 + 0)/1000 = 62 × 3.4 / 1000 = 0.2108 klf
  close(R.wSteel[0], 0.2108, 1e-12, 'w_s');
  const i = x => R.x.findIndex(v => Math.abs(v - x) < 1e-9);
  // pier moment −wL²/8 = −0.2108 × 100² / 8 = −263.5 kip-ft; reactions 0.375wL = 7.905, 1.25wL = 26.35 kips
  close(R.st.DC1steel.M[i(100)], -263.5, 1e-9, 'M pier'); close(R.st.DC1steel.R[0], 7.905, 1e-9, 'R_A'); close(R.st.DC1steel.R[1], 26.35, 1e-9, 'R_B');
  // shear just left of the pier −0.625wL = −13.175 kips; just right +13.175
  close(R.st.DC1steel.VL[i(100)], -13.175, 1e-9, 'V left of pier'); close(R.st.DC1steel.VR[i(100)], 13.175, 1e-9, 'V right of pier');
  // deflection at x = L/2 (each span a propped cantilever): wL⁴/(192 EI); EI = 29,000 × 38,770.667 / 144 = 7,807,982 kip-ft²
  //   = 0.2108 × 100⁴ / (192 × 7,807,982) = 0.0140619 ft = 0.168743 in
  const EI = 29000 * (38770 + 2 / 3) / 144;
  close(R.camber.steel[i(50)], 12 * 0.2108 * 1e8 / (192 * EI), 1e-7, 'deflection at L/2'); close(R.camber.steel[i(50)], 0.168743, 1e-5, 'deflection (rounded)');
  // the statics step: ΣR = Σ w ℓ = 0.2108 × 200 = 42.16 kips
  const s = R.steps.find(q => q.id === 'an.eq.DC1steel'); close(s.value, 42.16, 1e-9, 'ΣR'); assert.equal(s.ok, true);
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

/* ---------- parity ---------- */
const files = payloadFiles(), sample = ALL ? files : files.filter((_, i) => i % 10 === 0);
// bounds: largest |difference| / largest |value| of the quantity on the girder (causes in the header)
const BOUND_P = { M_DC1steel: 0.004, M_DC1wet: 2e-4, M_DC1: 1e-3, M_DC2: 4e-4, M_DW: 2e-4, M_CL: 2e-4, V_DC1: 0.012, V_DC2: 0.012, V_DW: 0.012, V_CL: 0.012, 'V_DC1 left of piers': 0.012,
  D_DC1steel: 0.005, D_DC1wet: 0.002, D_DC2DW: 0.003, M_DCc: 0.015, M_LLpos: 2e-4, M_LLneg: 2e-4, M_FATpos: 2e-4, M_FATneg: 2e-4, 'V_LL max': 2e-4, 'V_LL min': 2e-4,
  'V_FAT max': 2e-4, 'V_FAT min': 2e-4, 'V_LL max left of piers': 2e-4, 'V_LL min left of piers': 2e-4, 'LL deflection per span': 0.002 };
const BOUND_G = { ...BOUND_P, R_DC1: 3e-4, R_DC2: 1e-5, R_DW: 1e-5, R_CL: 1e-5, 'R_LL max': 1e-5, 'R_LL min': 1e-5 };
const cache = {};
function run(f, o = {}) {
  const key = f + JSON.stringify(o); if (cache[key]) return cache[key];
  const p = readPayload(f), P = projectFromPayload(p, o), G = gdNodes(p), R = AN.analyzeGirder(P, 0, { ll: o.ll !== false });
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
  const Mp = D.MDC1.map((v, i) => v + D.MDC2[i] + D.MDW[i]), sc = Math.max(...Mp.map(Math.abs));
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
  const P = W.SBDModel.defaultProject(), R = AN.analyzeGirder(P, 0, {}), D = gdSA(P, 0, R.n), S = {};
  assert.deepEqual([...R.errors], []); assert.ok(R.warnings.length >= 2, 'warns: no loads, no factors');
  diffStats(pairsGD(R, D), S, 'built-in', D.xs);
  check(S, { ...BOUND_G, M_DCc: 0.03 }, 'built-in project');
});
