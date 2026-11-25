// Steel Bridge: RIDOT BDM 3.4.1.1.1 two live-load cases with a mountable sidewalk (sb-ridot-curb PR, 2026-11-25; CLAUDE.md §4, §5).
//
// AASHTO LRFD 10th Ed. Art. 3.6.1.6: where vehicles can mount the sidewalk, the pedestrian load does not act with the vehicle load.
// RIDOT BDM 3.4.1.1.1: with a sidewalk, the more severe of (1) the lanes from the whole roadway (sidewalk included), no pedestrian load and
// (2) the lanes from the curb-to-curb width, the pedestrian load on the sidewalks. Before this PR a RIDOT project with a mountable sidewalk took
// the lanes of case 1 and the pedestrian load of case 2 together.
//
// 1. Hand check, a made-up bridge built here: 40 ft deck, 10 girders at 35/9 = 3.889 ft, 2.5 ft overhangs, 1.5 ft barriers, 6.5 ft sidewalks
//    8 in thick (mountable) each side, so 27 ft curb to curb; 56 ft simple span; 75 psf; RIDOT (m = 1.2, η = 1). Lanes, factors, w_PL and the
//    governing M_u of the exterior line G1 and the interior line G2 (under the sidewalk), before and after.
// 2. Unchanged: the same bridge under AASHTO, MassDOT, CTDOT; RIDOT with the sidewalks set "not mountable"; RIDOT without sidewalks.
// 3. Saved data: the new field xs.sidewalks.<side>.mount is optional; a project without it (every project saved before) gives exactly the
//    results of 'auto'; an import / export round trip keeps the project as it was (no field added).
// 4. The entered flag: 'yes' makes a 12 in sidewalk mountable (two cases), 'no' an 8 in one not mountable (one case, curb faces).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/lldf.js',
  'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/constructibility.js'].map(E));
const M = W.SBDModel, AN = W.SBDAnalysis, LD = W.SBDLoads, J = o => JSON.parse(JSON.stringify(o));
const close = (a, b, what, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

function proj(owner, o = {}) {
  const P = M.newProject();
  P.spans = { lengths: [56], continuity: 'simple' };
  P.xs.nb = 10; P.xs.bays = new Array(9).fill(35 / 9); P.xs.ohL = 2.5; P.xs.ohR = 2.5; P.xs.skews = [0, 0]; P.xs.dlMethod = owner === 'RIDOT' ? 'ridot' : 'aashto';
  const sw = sd => ({ w: o.noSw ? 0 : 6.5, t: o.t != null ? o.t : 8, fence: null, fenceX: null, ...(o.mount ? { mount: o.mount } : {}) });
  P.xs.sidewalks = { L: sw('L'), R: sw('R'), ped: o.ped != null ? o.ped : 75 };
  P.ownerRules = { owner, eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } }; P.project.owner = owner;
  const segs = [{ x0: 0, x1: 56, D: 24, tw: 0.5, topB: 14, topT: 0.875, botB: 16, botT: 1.25 }];
  P.girders = [{ id: 'G1', label: 'Interior', position: 'interior', beff: 46.5, segments: J(segs), line: 1, lines: [1, 2, 3, 4, 5, 6, 7, 8] },
    { id: 'G2', label: 'Exterior', position: 'exterior', beff: 53, segments: J(segs), line: 0, lines: [0, 9] }];
  P.stiffeners.layout = { web: 'unstiffened', mode: 'uniform', doRatio: 1, bays: [], frames: { Lb: 14 } };
  P.framing.splices = []; P.framing.spacing = 14;
  return P;
}
const memo = new Map(), an = (P, gi) => { const k = JSON.stringify([P, gi]); if (!memo.has(k)) { const R = AN.analyzeGirder(P, gi); assert.deepEqual([...R.errors], []); memo.set(k, R); } return memo.get(k); };
const loads = P => { const { b, p } = LD.fromModel(P, { girder: 0 }); return LD.compute(b, p); };
// the live-load results every module reads, as numbers
const llOf = R => J({ ll: ['Mpos', 'Mneg', 'VRpos', 'VRneg', 'VLpos', 'VLneg'].map(k => R.ll[k]), pl: R.pl ? ['Mpos', 'Mneg', 'VRpos', 'VRneg', 'VLpos', 'VLneg'].map(k => R.pl[k]) : null,
  fat: ['Mpos', 'Mneg', 'VRpos', 'VRneg'].map(k => R.fat[k]), R: R.llR.map(r => [r.max, r.min]), plR: R.pl ? R.pl.R.map(r => [r.max, r.min]) : null, lld: R.lld.map(q => [q.gD, q.d]), st: R.st.DC2.M });
const iMax = R => R.x.reduce((b, x, i) => (R.ll.Mpos[i] > R.ll.Mpos[b] ? i : b), 0);
const Mu = (R, i, m) => 1.25 * (R.st.DC1.M[i] + R.st.DC2.M[i]) + 1.50 * R.st.DW.M[i] + 1.75 * (m * R.ll.Mpos[i] + (R.pl ? R.pl.Mpos[i] : 0));

test('hand check: lanes, faces and factors of the two cases (RIDOT, 8 in mountable sidewalks, 40 ft deck, 27 ft curb to curb)', () => {
  const RL = loads(proj('RIDOT')), C = RL.cases; assert.ok(C, 'two cases');
  assert.deepEqual(J(C.sides), ['L', 'R']); assert.deepEqual(J(C.NL), [3, 2]); close(C.w[0], 37, 'case 1 roadway'); close(C.w[1], 27, 'case 2 roadway');
  close(C.c1.ll.L.r, 1.5, 'case 1 face (barrier)'); close(C.c2.ll.L.r, 6.5, 'case 2 face (curb)'); assert.match(C.c2.ll.L.by, /case 2 of RIDOT BDM 3\.4\.1\.1\.1/);
  // the base result is the module's result as before (deck, drawings, .lga and the Loads tables read it): case 1's faces, the pedestrian load as entered
  close(RL.ll.L.r, 1.5, 'base face'); close(RL.dead.pl[0], 0.375 * (35 / 9 + 2.5 - 4.0) / (35 / 9), 'base w_PL G1');
  // exterior G1, span: case 1 lever rule, one lane: wheel 2 ft from the barrier face (x = 3.5 ft), G1 at 2.5, G2 at 6.389 ft: 1.2 × 0.5 × (6.389 − 3.5)/3.889
  const S = 35 / 9, s1 = C.c1.regions.find(r => r.id === 's0').members, s2 = C.c2.regions.find(r => r.id === 's0').members;
  close(s1[0].gM, 1.2 * 0.5 * (2.5 + S - 3.5) / S, 'case 1 g_M G1 (lever rule, one lane)'); close(s1[0].gM, 0.44571, 'case 1 g_M G1', 1e-4);
  // case 2: rigid cross-section, two lanes (trucks 2 ft from the curb: e = 8.5 and −3.5 ft), Σx² = 2(1.944² + 5.833² + 9.722² + 13.611² + 17.5²)
  let sx2 = 0; for (let k = 0; k < 10; k++) { const x = 2.5 + k * S - 20; sx2 += x * x; }
  close(s2[0].gM, 2 / 10 + 17.5 * (8.5 - 3.5) / sx2, 'case 2 g_M G1 (rigid, two lanes)'); close(s2[0].gM, 0.27013, 'case 2 g_M G1', 1e-4);
  // interior girders: the equations do not depend on N_L (two or more lanes): the same g in both cases
  for (let j = 1; j < 9; j++) close(s2[j].gM, s1[j].gM, `interior g_M G${j + 1}`, 1e-12);
  // deflection: g_Δ = m N_L / N_b: 0.85(3)/10 = 0.255 (case 1), 1.00(2)/10 = 0.200 (case 2)
  close(C.c1.regions[0].gDef, 0.255, 'g_Δ case 1'); close(C.c2.regions[0].gDef, 0.200, 'g_Δ case 2');
  // case 2 pedestrian load: 75 psf on the walkable 5 ft (1.5 to 6.5 ft), 0.375 klf at x = 4.0 ft, RIDOT "two adjacent girders" (lever rule)
  close(C.c2.dead.pl[0], 0.375 * (2.5 + S - 4.0) / S, 'w_PL G1'); close(C.c2.dead.pl[1], 0.375 * (4.0 - 2.5) / S, 'w_PL G2'); close(C.c1.dead.pl[0], 0, 'case 1: no pedestrian load');
});

test('hand check: governing M_u of the exterior line G1 (case 1 governs: no pedestrian load) and the interior line G2 (case 2 governs: as before)', () => {
  const P = proj('RIDOT'), Rx = an(P, 1), Ri = an(P, 0);
  // exterior G1: at x = 30 ft the per-lane HL-93 moment 1,226.96 kip-ft; case 1: 1.2(0.4457)(1226.96) = 656.25; case 2: 1.2(0.2701)(1226.96) + M_PL 89.84 = 487.57
  const ix = iMax(Rx); close(Rx.x[ix], 30, 'x'); close(Rx.ll.perLane.Mmax[ix], 1226.96, 'M_HL93 per lane', 1e-5);
  assert.equal(Rx.cases.pick.Mpos[ix], 1); close(Rx.ll.Mpos[ix], 546.874, 'M_LL+IM', 1e-5); assert.equal(Rx.pl.Mpos[ix], 0, 'no pedestrian moment where case 1 governs');
  const C = Rx.cases, v2 = 1.2 * C.c[1].ll.Mpos[ix] + C.p[1].Mpos[ix]; close(v2, 1.2 * 331.4386 + 89.8393, 'case 2', 1e-6); assert.ok(1.2 * Rx.ll.Mpos[ix] > v2);
  const MuX = Mu(Rx, ix, 1.2); close(MuX, 1.25 * (268.103 + 169.650) + 1.50 * 26.325 + 1.75 * 1.2 * 546.874, 'M_u G1 after', 1e-5); close(MuX, 1735.13, 'M_u G1 after', 1e-5);
  // before (main): case 1's lanes with case 2's pedestrian load: + 1.75(89.84) = 1,892.35
  close(MuX + 1.75 * 89.8393, 1892.35, 'M_u G1 before', 1e-5);
  // interior G2 (under the left sidewalk): the same g in both cases, so case 2 (with M_PL 56.41) governs: M_u as before
  const ii = iMax(Ri); close(Ri.x[ii], 26, 'x'); assert.equal(Ri.cases.pick.Mpos[ii], 2); close(Ri.pl.Mpos[ii], 56.4107, 'M_PL G2', 1e-5);
  close(Mu(Ri, ii, 1.2), 1.25 * (255.984 + 106.136) + 1.50 * 26.325 + 1.75 * (1.2 * 478.854 + 56.411), 'M_u G2', 1e-5); close(Mu(Ri, ii, 1.2), 1596.45, 'M_u G2', 1e-5);
  // fatigue and deflection: case 1 (more lanes: g_Δ 0.255 > 0.200; the exterior fatigue g 0.3714 > 0.2192)
  assert.equal(Rx.lld[0].cs, 1); close(Rx.lld[0].gD, 0.255, 'g_Δ used'); assert.ok(Rx.cases.n2['fat.Mpos'] === 0);
  // the worked steps name both cases and the one taken
  const st = Rx.steps.find(s => s.id === 'an.case.M.s1'); assert.ok(st); assert.match(st.label, /case 1 governs/); assert.match(st.sub, /^\\max\(1\.20\(0\.4457\)\(1227\.0\),\\ 1\.20\(0\.2701\)\(1227\.0\) \+ \(89\.8\)\)$/);
  ['an.case.w1', 'an.case.NL1', 'an.case.w2', 'an.case.NL2', 'an.case.PL2', 'an.case.g'].forEach(id => assert.ok(Rx.steps.find(s => s.id === id), id));
});

test('the case envelope: every station and effect takes the larger factored live load m·LL+IM + PL of the two cases', () => {
  for (const gi of [0, 1]) { const R = an(proj('RIDOT'), gi), C = R.cases, m = 1.2;
    ['Mpos', 'VRpos', 'VLpos'].forEach(k => R.x.forEach((_, i) => { const v = [0, 1].map(c => m * C.c[c].ll[k][i] + (C.p[c] ? C.p[c][k][i] : 0)), u = m * R.ll[k][i] + (R.pl ? R.pl[k][i] : 0);
      close(u, Math.max(...v), `${k} ${i}`, 1e-12); }));
    ['Mneg', 'VRneg', 'VLneg'].forEach(k => R.x.forEach((_, i) => { const v = [0, 1].map(c => m * C.c[c].ll[k][i] + (C.p[c] ? C.p[c][k][i] : 0)), u = m * R.ll[k][i] + (R.pl ? R.pl[k][i] : 0);
      close(u, Math.min(...v), `${k} ${i}`, 1e-12); }));
    R.llR.forEach((r, k) => close(m * r.max + (R.pl ? R.pl.R[k].max : 0), Math.max(...[0, 1].map(c => m * C.c[c].llR[k].max + (C.p[c] ? C.p[c].R[k].max : 0))), `R ${k}`, 1e-12)); }
});

test('unchanged: AASHTO, MassDOT, CTDOT (the same bridge), RIDOT with the sidewalks not mountable, RIDOT without sidewalks: one case, as before', () => {
  for (const [ow, o] of [['AASHTO', {}], ['MassDOT', {}], ['CTDOT', {}], ['RIDOT', { mount: 'no' }], ['RIDOT', { noSw: true }], ['RIDOT', { t: 12 }]]) {
    const P = proj(ow, o), RL = loads(P); assert.equal(RL.cases, undefined, `${ow} ${JSON.stringify(o)}: no cases`);
    for (const gi of [0, 1]) { const R = an(P, gi); assert.equal(R.cases, null); } }
  // a 12 in sidewalk (not mountable by the 12 in rule): its curb face bounds the roadway, as before
  close(loads(proj('RIDOT', { t: 12 })).ll.L.r, 6.5, 'curb face');
});

test('an analysis without the live load (deck placement, constructibility: opt.ll false) runs as before: no cases, no live load', () => {
  const P = proj('RIDOT'); for (const gi of [0, 1]) { const R = AN.analyzeGirder(P, gi, { ll: false }); assert.deepEqual([...R.errors], []); assert.equal(R.cases, null); assert.equal(R.ll, null);
    assert.deepEqual(J(R.st.DC2.M), J(an(P, gi).st.DC2.M)); }
});

test('saved data: xs.sidewalks.<side>.mount absent = "auto" exactly; the round trip adds no field', () => {
  const P0 = proj('RIDOT'), Pa = proj('RIDOT', { mount: 'auto' });
  assert.equal('mount' in P0.xs.sidewalks.L, false);
  for (const gi of [0, 1]) assert.deepEqual(llOf(an(P0, gi)), llOf(an(Pa, gi)));
  // an AASHTO project without the field: the results of 'auto' and of 'yes' / 'no' where they agree with the 12 in rule
  for (const gi of [0, 1]) assert.deepEqual(llOf(an(proj('AASHTO'), gi)), llOf(an(proj('AASHTO', { mount: 'yes' }), gi)));
  const r = M.importJSON(M.exportJSON(P0)); assert.ok(r.ok, r.error); assert.equal('mount' in r.project.xs.sidewalks.L, false); assert.deepEqual(J(r.project.xs.sidewalks), J(P0.xs.sidewalks));
  const r2 = M.importJSON(M.exportJSON(proj('RIDOT', { mount: 'no' }))); assert.ok(r2.ok); assert.equal(r2.project.xs.sidewalks.L.mount, 'no');
});

test('the entered flag: "yes" makes a 12 in sidewalk mountable (two cases); "no" makes an 8 in one not mountable (curb faces, one case)', () => {
  const Ry = loads(proj('RIDOT', { t: 12, mount: 'yes' })); assert.ok(Ry.cases); close(Ry.ll.L.r, 1.5, 'face'); assert.match(Ry.cases.c2.ll.L.by, /case 2/);
  const Rn = loads(proj('RIDOT', { mount: 'no' })); assert.equal(Rn.cases, undefined); close(Rn.ll.L.r, 6.5, 'face'); assert.match(Rn.ll.L.by, /not mountable: entered/);
  // AASHTO with "no": the lanes curb to curb (2), the pedestrian load with them (no RIDOT cases)
  const Ra = loads(proj('AASHTO', { mount: 'no' })); assert.equal(Ra.regions[0].geo.NL, 2); assert.ok(Ra.dead.pl[0] > 0);
});
