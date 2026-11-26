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
  // Engineer's answer 2026-11-26 (Q3): in case 2 the pedestrian load counts as a loaded lane for m on G1 and G2 (they take w_PL), so the rigid
  // cross-section takes m for n + 1 lanes: 2 lanes 0.85(0.27013) = 0.22961 (before: 1.00(0.27013) = 0.27013, which governed). The e-factor
  // (m built into the equation) now governs: d_e = 2.5 − 6.5 = −4.0 → −1.0 ft (4.6.2.2.2d), e = 0.77 − 1.0/9.1 = 0.66011, × g_M,2,int 0.39028 = 0.25763.
  const R2 = 2 / 10 + 17.5 * (8.5 - 3.5) / sx2; close(R2, 0.27013, 'case 2 rigid R, two lanes', 1e-4);
  const rg2 = s2[0].rig.trials.find(t => t.n === 2); close(rg2.m, 0.85, 'm, 2 lanes + the pedestrian lane'); close(rg2.g, 0.85 * R2, 'case 2 rigid g, two lanes'); assert.equal(rg2.mLanes, 3);
  close(s2[0].rig.trials[0].m, 1.0, 'm, 1 lane + the pedestrian lane'); close(s2[0].eM, 0.77 - 1.0 / 9.1, 'e'); close(s2[0].mE, (0.77 - 1.0 / 9.1) * s2[1].emp.mom2, 'e g_int');
  close(s2[0].gM, s2[0].mE, 'case 2 g_M G1 (e-factor governs)'); close(s2[0].gM, 0.25763, 'case 2 g_M G1', 1e-4);
  // fatigue: one truck, no pedestrian load: unchanged by Q3 (max(lever 1 lane, rigid 1 lane with m 1.2)/1.2 = R_1)
  close(s2[0].fatM, s2[0].rig.trials[0].R, 'case 2 g_fat G1 (one lane, no pedestrian lane)', 1e-12); close(s2[0].fatM, 0.21922, 'case 2 g_fat G1', 1e-4);
  assert.deepEqual(J(C.c2.pedJ), [true, true, false, false, false, false, false, false, true, true]);
  assert.ok(C.steps.find(q => q.id === 'xs.case.pedm'), 'the pedestrian-lane step');
  assert.match(s2[0].steps.find(q => q.id === 'df.s0.G1.rig2.g').label, /pedestrian load as one more loaded lane \(m for 3 lanes\)/);
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
  // case 2 after Q3 (2026-11-26): 1.2(0.25763)(1226.96) + 89.84 = 469.15 (before: 1.2(0.27013)(1226.96) + 89.84 = 487.57); case 1 governs before and after
  const C = Rx.cases, v2 = 1.2 * C.c[1].ll.Mpos[ix] + C.p[1].Mpos[ix]; close(C.c[1].ll.Mpos[ix], C.dfs[1].spans[0].gM * 1226.96, 'case 2 M_LL+IM', 1e-5); close(v2, 469.154, 'case 2', 1e-5); assert.ok(1.2 * Rx.ll.Mpos[ix] > v2);
  const MuX = Mu(Rx, ix, 1.2); close(MuX, 1.25 * (268.103 + 169.650) + 1.50 * 26.325 + 1.75 * 1.2 * 546.874, 'M_u G1 after', 1e-5); close(MuX, 1735.13, 'M_u G1 after', 1e-5);
  // before (main): case 1's lanes with case 2's pedestrian load: + 1.75(89.84) = 1,892.35
  close(MuX + 1.75 * 89.8393, 1892.35, 'M_u G1 before', 1e-5);
  // interior G2 (under the left sidewalk): the same g in both cases, so case 2 (with M_PL 56.41) governs: M_u as before
  const ii = iMax(Ri); close(Ri.x[ii], 26, 'x'); assert.equal(Ri.cases.pick.Mpos[ii], 2); close(Ri.pl.Mpos[ii], 56.4107, 'M_PL G2', 1e-5);
  close(Mu(Ri, ii, 1.2), 1.25 * (255.984 + 106.136) + 1.50 * 26.325 + 1.75 * (1.2 * 478.854 + 56.411), 'M_u G2', 1e-5); close(Mu(Ri, ii, 1.2), 1596.45, 'M_u G2', 1e-5);
  // fatigue and deflection: case 1 (more lanes: g_Δ 0.255 > 0.200; the exterior fatigue g 0.3714 > 0.2192)
  assert.equal(Rx.lld[0].cs, 1); close(Rx.lld[0].gD, 0.255, 'g_Δ used'); assert.ok(Rx.cases.n2['fat.Mpos'] === 0);
  // the worked steps name both cases and the one taken
  const st = Rx.steps.find(s => s.id === 'an.case.M.s1'); assert.ok(st); assert.match(st.label, /case 1 governs/); assert.match(st.sub, /^\\max\(1\.20\(0\.4457\)\(1227\.0\),\\ 1\.20\(0\.2576\)\(1227\.0\) \+ \(89\.8\)\)$/);
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

// ---- Engineer's answers 2026-11-26 (#1730 Q1, Q2, Q3) ----
test('Q1: RIDOT judges Automatic by the mountable curb height xs.sidewalks.mountH (default 8 in); other owners keep the 12 in rule', () => {
  assert.equal(LD.MOUNT_H, 8);
  close(loads(proj('RIDOT')).ll.L.r, 1.5, '8 in: mountable (≤ 8 in)'); assert.ok(loads(proj('RIDOT')).cases);
  const R9 = loads(proj('RIDOT', { t: 9 })); assert.equal(R9.cases, undefined, '9 in: not mountable, one case'); close(R9.ll.L.r, 6.5, '9 in: the curb face');
  assert.match(R9.ll.L.by, /9\.00 in > 8\.00 in, the mountable curb height/);
  const P10 = proj('RIDOT', { t: 9 }); P10.xs.sidewalks.mountH = 10; const R10 = loads(P10); assert.ok(R10.cases, '9 in with a 10 in setting: mountable'); close(R10.ll.L.r, 1.5, 'face');
  // AASHTO, MassDOT, CTDOT: the 12 in rule, the setting not read
  for (const ow of ['AASHTO', 'MassDOT', 'CTDOT']) { const Pa = proj(ow, { t: 9 }), Pb = proj(ow, { t: 9 }); Pb.xs.sidewalks.mountH = 4;
    close(loads(Pa).ll.L.r, 1.5, `${ow} 9 in: mountable (< 12 in)`); for (const gi of [0, 1]) assert.deepEqual(llOf(an(Pa, gi)), llOf(an(Pb, gi)), `${ow}: the setting not read`); }
  // 'yes' / 'no' still as entered
  close(loads(proj('RIDOT', { t: 9, mount: 'yes' })).ll.L.r, 1.5, '9 in, yes');
  // validation; saved data: absent stays absent, an entered value round-trips
  const Pe = proj('RIDOT'); Pe.xs.sidewalks.mountH = -1; assert.ok(loads(Pe).errors.some(e => /^Mountable sidewalk curb height must be positive/.test(e)));
  const r0 = M.importJSON(M.exportJSON(proj('RIDOT'))); assert.ok(r0.ok); assert.equal('mountH' in r0.project.xs.sidewalks, false);
  const r1 = M.importJSON(M.exportJSON(P10)); assert.ok(r1.ok); assert.equal(r1.project.xs.sidewalks.mountH, 10);
});

test('Q2: case 1 ignores a railing or fence on the mountable sidewalk (the whole roadway); the base faces and the fence weight stay', () => {
  const P = proj('RIDOT'); ['L', 'R'].forEach(sd => { P.xs.sidewalks[sd].fence = 0.05; P.xs.sidewalks[sd].fenceX = 5.0; });
  const RL = loads(P), C = RL.cases; assert.ok(C);
  close(RL.ll.L.r, 5.0, 'base face: the fence (as before)'); close(C.c1.ll.L.r, 1.5, 'case 1 face: the barrier'); close(C.c1.ll.R.r, 1.5, 'case 1 face R'); assert.equal(C.c1fence, true);
  assert.deepEqual(J(C.NL), [3, 2]); close(C.w[0], 37, 'case 1 roadway (before: 40 − 5 − 5 = 30 ft, N_L 2)'); close(RL.regions[0].geo.roadway, 30, 'base roadway');
  assert.deepEqual(J(C.c1.dead.dc2), J(RL.dead.dc2), 'the fence weight in DC2, unchanged');
  assert.ok(C.steps.find(q => q.id === 'xs.case.fence1')); assert.ok(LD.caseSteps(RL, [0]).some(q => q.id === 'c1.df.s0.G1.gM'), 'case 1 factors worked (c1.*)');
  // the analysis takes case 1's factors from case 1's own faces
  const R = an(P, 1); close(R.cases.dfs[0].spans[0].gM, C.c1.regions[0].members[0].gM, 'case 1 g_M used', 1e-12); close(R.cases.dfs[0].spans[0].gM, 0.44571, 'case 1 g_M G1', 1e-4);
  // without a fence case 1 is the base result: c1fence false
  assert.equal(loads(proj('RIDOT')).cases.c1fence, false);
});

test('Q3: the pedestrian lane is used only in case 2, on the girders that take w_PL, and only where m is explicit; other owners unchanged', () => {
  const C = loads(proj('RIDOT')).cases;
  C.c1.regions.forEach(rg => rg.members.forEach(m => { if (m.rig) assert.ok(m.rig.trials.every(t => !t.mLanes)); assert.ok(!m.pedLane); }));
  const s2 = C.c2.regions[0].members; assert.ok(s2[0].pedLane && s2[1].pedLane && s2[9].pedLane); assert.ok(!s2[4].pedLane);
  // interior G2 (equations, m built in): unchanged by the pedestrian lane
  close(s2[1].gM, C.c1.regions[0].members[1].gM, 'G2 g_M', 1e-12);
  // deflection factor: no pedestrian load, m for N_L lanes as before
  close(C.c2.regions[0].gDef, 0.200, 'g_Δ case 2');
  // AASHTO with a non-mountable sidewalk and the pedestrian load: no RIDOT cases, no pedestrian lane (as before)
  const Ra = loads(proj('AASHTO', { mount: 'no' })); Ra.regions.forEach(rg => rg.members.forEach(m => { assert.ok(!m.pedLane); if (m.rig) assert.ok(m.rig.trials.every(t => !t.mLanes)); }));
});

test('Q6 (engineer\'s answer 2026-11-26): the load rating takes case 1\'s factors at every station, no pedestrian load (SBDAnalysis.rateView)', () => {
  for (const gi of [0, 1]) { const R = an(proj('RIDOT'), gi), V = AN.rateView(R), c1 = R.cases.c[0];
    assert.equal(V.ll, c1.ll); assert.equal(V.fat, c1.fat); assert.equal(V.llR, c1.llR); assert.equal(V.pl, null); assert.equal(V.rateCase.case, 1);
    assert.equal(V.st, R.st, 'dead loads as the design'); assert.equal(R.ll === c1.ll, false, 'the design keeps the envelope');
    // where case 2 governs the design (G2 at x = 26 ft: M_PL 56.41), the rating has case 1's LL+IM and no pedestrian load
    if (gi === 0) { const i = iMax(R); assert.equal(R.cases.pick.Mpos[i], 2); close(V.ll.Mpos[i], c1.ll.Mpos[i], 'case 1 M_LL+IM'); assert.ok(R.pl.Mpos[i] > 50); } }
  // other owners, no two cases: the analysis itself
  const Ra = an(proj('AASHTO'), 1); assert.equal(AN.rateView(Ra), Ra);
});
