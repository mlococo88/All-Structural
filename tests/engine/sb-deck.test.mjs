// apps/steel-bridge DK (2026-11-23): the deck design module, engine/deck.js (window.SBDDeck) on shared/deck.js. Made-up bridges only.
//   1. optional and off: a project without P.deckDesign (every project saved before) calculates nothing and is not changed;
//   2. the values come from the project (spacings, overhangs, slab, materials, wearing surface, traffic face, narrowest top flange);
//   3. the default bridge: hand check of the three checks through the app's engine;
//   4. unequal bays: each spacing designed, the largest M_u governs each check;
//   5. a sidewalk, a curb with a railing, overlays and pedestrians on the overhang: hand check;
//   6. owner rules: RIDOT's m = 1.2 on HL-93 and eta;
//   7. input errors are reported, not calculated; the worked steps carry the result's own values.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'lldf.js', 'deck.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js', 'engine/deck.js'].map(E)));
const M = W.SBDModel, DK = W.SBDDeck;
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs hand ${b}`);
const on = (P, o) => { P.deckDesign = { on: true, ...(o || {}) }; return P; };

test('off by default: no P.deckDesign in the default or a new project; calc() returns off and does not touch the project', () => {
  [M.defaultProject(), M.newProject()].forEach(P => {
    assert.equal('deckDesign' in P, false); const t = JSON.stringify(P);
    const R = DK.calc(P); assert.equal(R.on, false); assert.equal(R.checks, undefined); assert.equal(DK.isOn(P), false);
    assert.equal(JSON.stringify(P), t, 'project unchanged');
    assert.equal(JSON.stringify(DK.inputs(P)), JSON.stringify(DK.DEF));
  });
  const P = M.defaultProject(); P.deckDesign = { on: false, sTop: 5 }; assert.equal(DK.calc(P).on, false);
  P.deckDesign = { on: 'yes' }; assert.equal(DK.isOn(P), false, 'only true switches it on');
});

test('saved data: P.deckDesign survives export / import; an old project file (no field) imports without it', () => {
  const P = on(M.newProject(), { sTop: 5, barTop: 0.44 }), back = M.importJSON(M.exportJSON(P));
  assert.equal(back.ok, true); assert.deepEqual(JSON.parse(JSON.stringify(back.project.deckDesign)), { on: true, sTop: 5, barTop: 0.44 });
  const old = M.importJSON(M.exportJSON(M.newProject())); assert.equal(old.ok, true); assert.equal('deckDesign' in old.project, false);
});

test('default bridge (5 girders at 9.5 ft, 3.25 ft overhangs, 8 in slab + 0.5 in, 16 in flange): the values used and a hand check', () => {
  const P = on(M.newProject(), { sBot: 8 }), t = JSON.stringify(P), R = DK.calc(P);
  assert.equal(JSON.stringify(P), t, 'calc does not change the project'); assert.equal(R.err, undefined);
  assert.equal(R.in.ts, 8); assert.equal(R.in.tL, 8.5); assert.equal(R.in.wc, 0.15); assert.equal(R.in.fc, 4); assert.equal(R.in.fy, 60); assert.equal(R.in.wDW, 0.025); assert.equal(R.in.bf, 16); assert.equal(R.in.xneg, 4);
  assert.equal(R.bays.length, 1); assert.equal(R.bays[0].S, 9.5); assert.deepEqual([...R.bays[0].lines], [0, 1, 2, 3]);
  const I = R.bays[0].I;
  // w_DC = 8.5/12(0.150) = 0.10625; M_DC+ = 0.10625(90.25)/11 = 0.871733; M_DW+ = 0.025(90.25)/11 = 0.205114; Table A4-1 at 9.5 ft: +6.59
  // M_u+ = 1.25(0.871733) + 1.50(0.205114) + 1.75(6.59) = 1.089666 + 0.307670 + 11.5325 = 12.929837
  near(I.Mu_pos, 12.929837, 2e-6, 'M_u+');
  // x = 4 in: 6.31 + (5.46 - 6.31)(1/3) = 6.026667; M_DC- = 0.958906; M_DW- = 0.225625
  // M_u- = 1.198633 + 0.338438 + 10.546667 = 12.083737
  near(I.MLL_neg, 6.026667, 1e-6, 'M_LL-'); near(I.Mu_neg, 12.083737, 2e-6, 'M_u-');
  // bottom #5 at 8: A_s 0.465, d 6.685873, a 0.683824, M_n = 27.9(6.343961)/12 = 14.74971, phi M_n 13.27474: 0.97402
  // top #5 at 6 (hand check 1 of deck.test.mjs): phi M_n 13.19667: 12.083737/13.19667 = 0.91567
  near(R.checks[0].r, 0.97402, 2e-5, 'DK1'); near(R.checks[1].r, 0.91567, 2e-5, 'DK2');
  // overhang: X = 3.25 - 1.5 - 1 = 0.75 ft, strip 52.5 in, M_LL = 25.536(0.75)/4.375 = 4.3776
  // M_DC = 0.10625(3.25)^2/2 + 0.4(2.5) = 0.561133 + 1.0 = 1.561133; M_DW = 0.025(1.75)^2/2 = 0.038281
  // M_u = 1.951416 + 0.057422 + 7.6608 = 9.669638; ratio 9.669638/13.19667 = 0.73273
  const O = R.oh.L.O; assert.equal(O.Xoh, 0.75); assert.equal(O.SWoh, 52.5); near(O.MohDC, 1.561133, 1e-6, 'M_DC,oh'); near(O.MohDW, 0.038281, 1e-6, 'M_DW,oh'); near(O.Mu_oh, 9.669638, 2e-6, 'M_u,oh');
  near(R.checks[2].r, 0.73273, 2e-5, 'DK3'); assert.ok(Object.is(R.oh.R.O.Mu_oh, O.Mu_oh), 'symmetric');
  assert.deepEqual([...R.checks.map(c => c.id)], ['DK1', 'DK2', 'DK3']); assert.ok(R.checks.every(c => c.ok)); assert.equal(R.warn.length, 0);
  assert.equal(R.dist.pct, 67); near(R.dist.As, 0.31155, 1e-9, 'A_s,d');
  // the same numbers as the shared strip() with the Prestressed-style inputs (barrier 18 in, 0.40 klf)
  const Sx = W.SharedDeck.strip({ S: 9.5, ts: 8, tsLoad: 8.5, fc: 4, fy: 60, wc: 0.15, wsFut: 0.025, xneg: 4, barTop: 0.31, sTop: 6, coverT: 2.5, barBot: 0.31, sBot: 8, coverB: 1, oh: 3.25, bBar: 18, wBar: 0.4 });
  assert.ok(Object.is(Sx.Mu_pos, I.Mu_pos) && Object.is(Sx.Mu_neg, I.Mu_neg) && Object.is(Sx.Mu_oh, O.Mu_oh) && Object.is(Sx.pos.dc, R.checks[0].r) && Object.is(Sx.ohCap.dc, R.checks[2].r));
});

test('with the default bars (#5 at 6 top and bottom) the default bridge passes', () => {
  const R = DK.calc(on(M.newProject())); assert.ok(R.checks.every(c => c.ok && c.r < 1)); near(R.checks[0].r, 12.929837 / R.checks[0].phiMn, 1e-6);
});

test('unequal bays: each spacing is designed; the governing bay of each check; the smallest spacing sets the distribution steel', () => {
  const P = on(M.newProject()); P.xs.bays = [7, 11, 11, 7.5];
  const R = DK.calc(P); assert.equal(R.bays.length, 3); assert.deepEqual([...R.bays.map(q => q.S)], [7, 11, 7.5]); assert.deepEqual([...R.bays[1].lines], [1, 2]);
  assert.equal(R.gp, 1); assert.equal(R.gn, 1); assert.match(R.checks[0].loc, /S = 11\.00 ft \(bays G2–G3, G3–G4\)/);
  assert.ok(R.bays[1].I.Mu_pos > R.bays[0].I.Mu_pos && R.bays[1].I.Mu_neg > R.bays[2].I.Mu_neg);
  assert.equal(R.dist.S, 7); assert.equal(R.dist.pct, 67);
  assert.ok(R.steps.some(s => s.id === 'dk.b3.Mup') && R.steps.some(s => s.id === 'dk.b1.pos.r') && !R.steps.some(s => s.id === 'dk.b2.pos.r'), 'the other bays show their own ratio');
  assert.equal(new Set(R.steps.map(s => s.id)).size, R.steps.length);
});

test('the narrowest top flange of every girder type sets the design section; an entered design section', () => {
  const P = on(M.newProject()); P.girders[1].segments[0].topB = 12;
  let R = DK.calc(P); assert.equal(R.in.bf, 12); assert.equal(R.in.xneg, 3); assert.match(R.in.bfAt, /Exterior, segment 1/);
  P.deckDesign.xnegAuto = false; P.deckDesign.xneg = 9; R = DK.calc(P); assert.equal(R.in.xneg, 9); near(R.bays[0].I.MLL_neg, 4.66, 1e-9, 'Table A4-1 at 9 in');
  P.deckDesign.xneg = 30; R = DK.calc(P); assert.equal(R.in.xneg, 24); assert.ok(R.warn.some(w => /24 in/.test(w)));
});

test('sidewalk, curb with railing, overlay and pedestrians on the overhangs: hand check from the Loads module values', () => {
  const P = on(M.newProject()); P.xs.ohL = 4; P.xs.ohR = 4;
  P.xs.sidewalks.L.w = 5; P.xs.sidewalks.L.t = 9; P.xs.sidewalks.ped = 75;
  P.xs.edges.R = { type: 'curb', bw: 1.5, bwt: 0.4, cw: 18, ch: 12, rw: 0.05, rp: 0.5, rf: null, face: null };
  P.xs.overlays = [{ name: 'Overlay', mode: 'psf', psf: 10 }];
  const R = DK.calc(P); assert.equal(R.err, undefined);
  // left: 9 in sidewalk (mountable, under 12 in): the traffic face stays the barrier face 1.5 ft; X = 4 - 1.5 - 1 = 1.5 ft; strip 60 in
  //   M_DC = 0.10625(16)/2 + 0.4(4 - 0.75) + [5(9/12)(0.150)/5 = 0.1125 ksf](4^2 - 0)/2 = 0.85 + 1.3 + 0.9 = 3.05
  //   wearing surface and overlay start at the sidewalk edge (5 ft, inside the girder): M_DW = 0
  //   M_LL = 25.536(1.5)/5 = 7.6608; pedestrians 0.075 ksf from 1.5 to 5 ft: 0.075(2.5^2)/2 = 0.234375
  //   M_u = 1.25(3.05) + 1.75(7.6608 + 0.234375) = 3.8125 + 13.816556 = 17.629056
  const L = R.oh.L.O; assert.equal(L.face, 1.5); assert.equal(L.Xoh, 1.5);
  near(L.MohDC, 3.05, 1e-9, 'left M_DC'); assert.equal(L.MohDW, 0); near(L.MohLL, 7.6608, 1e-9, 'left M_LL'); near(L.MohPL, 0.234375, 1e-9, 'left M_PL'); near(L.Mu_oh, 17.629056, 2e-6, 'left M_u');
  assert.deepEqual([...L.DC.map(q => q.id)], ['barL', 'swL']); assert.deepEqual([...L.PL.map(q => q.id)], ['pedL']);
  // right: 18 x 12 in curb (0.225 klf at 0.75 ft), railing 0.05 klf at 0.5 ft; curb face 1.5 ft: X = 1.5 ft
  //   M_DC = 0.85 + 0.225(3.25) + 0.05(3.5) = 0.85 + 0.73125 + 0.175 = 1.75625
  //   M_DW = (0.025 + 0.010)(4 - 1.5)^2/2 = 0.109375
  //   M_u = 1.25(1.75625) + 1.50(0.109375) + 1.75(7.6608) = 2.195313 + 0.164063 + 13.4064 = 15.765775
  const Rt = R.oh.R.O; assert.equal(Rt.face, 1.5); near(Rt.MohDC, 1.75625, 1e-9, 'right M_DC'); near(Rt.MohDW, 0.109375, 1e-9, 'right M_DW'); near(Rt.Mu_oh, 15.765775, 2e-6, 'right M_u');
  assert.equal(R.go, 'L'); assert.equal(R.checks[2].loc, 'Left overhang'); near(R.in.wDW, 0.035, 1e-12, 'w_DW');
  assert.ok(R.warn.some(w => /Left sidewalk slab/.test(w)), 'the sidewalk inside the exterior girder is named as not in the interior strip');
  assert.ok(R.steps.find(s => s.id === 'dk.ohL.MohPL') && !R.steps.find(s => s.id === 'dk.ohR.MohPL'));
});

test('owner rules: RIDOT m = 1.2 on HL-93 and eta on Strength I, as the other modules', () => {
  const P = on(M.newProject()); P.ownerRules.owner = 'RIDOT';
  const lf = W.SBDOwners.loadFactors('RIDOT', P.ownerRules.eta, 5), R = DK.calc(P), I = R.bays[0].I;
  assert.equal(lf.m, 1.2); assert.equal(R.in.mLL, 1.2); assert.equal(R.in.eta, lf.eta);
  near(I.Mu_pos, lf.eta * (1.25 * I.MDC_pos + 1.5 * I.MDW_pos + 1.75 * 1.2 * I.MLL_pos), 1e-12, 'M_u+');
  assert.ok(R.steps.find(s => s.id === 'dk.b1.Mup').eq.includes('m\\,'));
});

test('input errors are reported and nothing is calculated', () => {
  const P = on(M.newProject(), { sTop: 0 }); let R = DK.calc(P); assert.match(R.err, /Top bar spacing/); assert.equal(R.checks, undefined);
  P.deckDesign = { on: true, coverB: NaN }; R = DK.calc(P); assert.match(R.err, /Bottom cover/);
  P.deckDesign = { on: true }; P.materials.rebar.Fyr = 0; assert.match(DK.calc(P).err, /F_yr/);
});

test('worked steps: each check links to a step with its ratio; topics group every step; references cite the 10th Edition', () => {
  const R = DK.calc(on(M.newProject()));
  R.checks.forEach(c => { const s = R.steps.find(q => q.id === c.step); assert.ok(s, c.step); assert.ok(Object.is(s.value, c.r)); assert.equal(s.ok, c.ok); assert.match(c.ref, /^AASHTO LRFD 10th Ed\. /); });
  const G = W.SharedSteps.group(R.steps, DK.topics(DK.metaOf(R.steps)), { strip: /^dk\./ });
  assert.deepEqual([...G.map(g => g.key)], ['b1', 'pos', 'neg', 'ohL', 'ohR', 'dist']); assert.equal(G.reduce((a, g) => a + g.steps.length, 0), R.steps.length);
  R.steps.forEach(s => { if (/AASHTO/.test(s.ref)) assert.match(s.ref, /^AASHTO LRFD 10th Ed\. /); });
});

test('Table A4-1 limits (Appendix A4): warnings for fewer than three girders, under 14 ft between the exterior girders, a long or a short overhang; still calculated', () => {
  const R0 = DK.calc(on(M.newProject())); assert.ok(!R0.warn.some(w => /Appendix A4/.test(w)), 'the default bridge is within the limits');
  const P = on(M.newProject()); P.xs.nb = 4; P.xs.bays = [6, 6, 6]; P.xs.ohL = 3.9; P.xs.ohR = 3.75;
  const R = DK.calc(P), a = R.warn.filter(w => /Appendix A4/.test(w));
  assert.equal(a.length, 1, JSON.stringify(R.warn)); assert.match(a[0], /^Left overhang 3\.90 ft is more than the smaller of 0\.625 S = 3\.75 ft and 6\.0 ft/);
  const P2 = on(M.newProject()); P2.xs.nb = 2; P2.xs.bays = [9.5]; const R2 = DK.calc(P2);
  assert.equal(R2.err, undefined, R2.err); { const b = R2.warn.filter(w => /Appendix A4/.test(w)); assert.ok(b.some(w => /^2 girders: Table A4-1 is for decks on at least three/.test(w)) && b.some(w => /^9\.50 ft between the exterior girder centrelines/.test(w)), JSON.stringify(b)); }
  assert.ok(R.checks.every(c => isFinite(c.r)), 'still calculated');
  const P3 = on(M.newProject()); P3.xs.ohR = 1.5; const a3 = DK.calc(P3).warn.filter(w => /Appendix A4/.test(w));
  assert.equal(a3.length, 1, JSON.stringify(a3)); assert.match(a3[0], /^Right overhang 1\.50 ft is less than the 21\.0 in \(1\.75 ft\) of Table A4-1/);
});
