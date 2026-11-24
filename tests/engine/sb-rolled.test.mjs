// Steel Bridge Design, rolled-beam (W-shape) girder segments (ROLL, 2026-11-23): engine/rolled.js with shared/aisc-w.js.
// A rolled segment = the optional field segments[i].shape + the shape's equivalent three plates in the segment's plate fields.
//   1. the three plates of a shape; a segment's state (plate / rolled / unknown name / plates edited); apply and clear; save and reopen;
//   2. HAND CHECK, a made-up simple span: L = 60 ft, 5 girders at 8 ft, W36X135 (d 35.6, b_f 12.0, t_f 0.790, t_w 0.600 in, 135 lb/ft),
//      Grade 50W, 8 in slab, 2 in haunch, b_eff 96 in, f'c 4 ksi, deck rebar not in M_p:
//        three plates: D = 35.6 - 2(0.79) = 34.02 in; A = 2(12)(0.79) + 34.02(0.6) = 39.372 in^2;
//          I = 2[12(0.79)^3/12 + 12(0.79)(17.405)^2] + 0.6(34.02)^3/12 = 2[0.4930 + 2871.8146] + 1968.6701 = 7713.29 in^4 (98.9 % of 7800)
//        n = 29000 / (120000 (0.15)^2 4^0.33) = 29000 / 4266.2 = 6.798
//        short-term composite: slab 96(8)/n = 112.98 in^2 at 35.6 + 2 + 4 = 41.6 in; ybar = (39.372(17.8) + 112.98(41.6)) / 152.35 = 35.45 in;
//          I = 7713.3 + 39.372(17.65)^2 + 112.98(64)/12 + 112.98(6.15)^2 = 24 854 in^4 (computed below to the last figure)
//        plastic moment (App. D6.1): P_s = 0.85(4)(96)(8) = 2611.2 kip; P_t = P_c = 12(0.79)(50) = 474 kip; P_w = 34.02(0.6)(50) = 1020.6 kip;
//          P_s > P_c + P_w + P_t = 1968.6 kip: plastic neutral axis in the slab, Ybar = 8(1968.6)/2611.2 = 6.03125 in below the top of slab;
//          M_p = Ybar^2 P_s / (2 t_s) + P_c(4.36375) + P_w(21.76875) + P_t(39.17375), with the arms from the PNA:
//            top flange 8 - 6.03125 + 2 + 0.395 = 4.36375 in; web 1.96875 + 2 + 0.79 + 17.01 = 21.76875 in; bottom flange 1.96875 + 2 + 0.79 + 34.02 + 0.395 = 39.17375 in
//            = 5936.56 + 2068.42 + 22217.19 + 18568.36 = 48 790.5 kip-in = 4065.9 kip-ft
//        FLEXURE (Strength I, compact, 6.10.7.1.2): D_p = 6.03125 in > 0.1 D_t = 0.1(35.6 + 2 + 8) = 4.56 in:
//          M_n = M_p (1.07 - 0.7 D_p / D_t) = 4065.9 (1.07 - 0.7(6.03125)/45.6) = 4065.9 (0.97742) = 3974.0 kip-ft; check M_u / (phi_f M_n), phi_f = 1.0
//        SHEAR (6.10.9): D / t_w = 34.02 / 0.6 = 56.7 <= 1.12 sqrt(E k / F_yw) = 1.12 sqrt(29000(5)/50) = 60.3 (k = 5, the least k): C = 1.0;
//          V_n = V_p = 0.58 F_yw D t_w = 0.58(50)(34.02)(0.6) = 591.9 kip; check V_u / (phi_v V_n), phi_v = 1.0
//        weight: w_s = 135 lb/ft (tabulated) x 1.05 (5 % detail allowance) = 0.14175 klf (three plates at 490 pcf: 39.372(3.4028) = 134.0 lb/ft);
//          M of the steel weight at midspan = 0.14175 (60)^2 / 8 = 63.79 kip-ft
//   3. old projects (no shape field): the same results, to the last bit, with and without engine/rolled.js loaded;
//   4. a shape name that is not in the list, or plates changed after the pick: plate girder with the stored plates, a warning, no data lost;
//   5. one steel grade; no flange-to-web welds on a rolled segment; the W-shape search (lightest that passes).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const BASE = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'];
const APP = ['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/splplace.js', 'engine/autodesign.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/lga.js', 'report/data.js', 'report/builders.js', 'report/summary.js'];
const W = loadShared(...BASE, 'aisc-w.js', E('engine/rolled.js'), ...APP.map(E));   // the app, with the rolled-beam files
W.SBDReportData.install();
const M = W.SBDModel, RL = W.SBDRolled, SEC = W.SBDSections;
const J = o => JSON.parse(JSON.stringify(o));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

/* the hand-check bridge (made up) */
function simple(shape) {
  const P = M.defaultProject();
  P.project.name = 'Rolled beam test: 60 ft simple span';
  P.spans = { lengths: [60], continuity: 'simple' };
  P.xs = M.defaultXs(P); P.xs.nb = 5; P.xs.bays = [8, 8, 8, 8]; P.xs.ohL = 3; P.xs.ohR = 3;
  P.girders = [{ id: 'G1', label: 'G1', position: 'interior', beff: 96, segments: [{ x0: 0, x1: 60, D: 30, tw: 0.5, topB: 12, topT: 0.75, botB: 12, botT: 0.75 }] }];
  if (shape) assert.equal(RL.apply(P.girders[0].segments[0], shape), true);
  P.framing.splices = [];
  ['A', 'B'].forEach(k => { P.stiffeners.bearing.types[k].bt = 5.5; });   // bearing stiffeners within the 12 in flange: (12 - 0.6)/2 = 5.7 in
  return P;
}

test('three plates of a shape; state, apply, clear; save and reopen keep the shape', () => {
  const pl = RL.plates(W.SharedAiscW.get('W36X135'));
  assert.deepEqual(J(pl), { D: 34.02, tw: 0.6, topB: 12, topT: 0.79, botB: 12, botT: 0.79 });
  const s = { x0: 0, x1: 60, D: 30, tw: 0.5, topB: 12, topT: 0.75, botB: 12, botT: 0.75 };
  assert.equal(RL.state(s).status, 'plate'); assert.equal(RL.isRolled(s), false); assert.equal(RL.label(s), ''); assert.equal(RL.wtA(s), null); assert.equal(RL.steps(s).length, 0);
  assert.equal(RL.apply(s, 'w36x135'), true);
  assert.deepEqual(J(s), { x0: 0, x1: 60, D: 34.02, tw: 0.6, topB: 12, topT: 0.79, botB: 12, botT: 0.79, shape: 'W36X135' });
  assert.equal(RL.state(s).status, 'rolled'); assert.equal(RL.label(s), 'W36X135'); assert.equal(RL.plf(s), 135);
  near(RL.wtA(s) * 490 / 144, 135, 1e-9, 'weight area x 490/144 = W');
  assert.equal(RL.apply(s, 'W99X999'), false); assert.equal(s.shape, 'W36X135');   // unknown name: unchanged
  RL.clear(s); assert.equal('shape' in s, false); assert.equal(s.D, 34.02);          // plate girder again, the plates stay
  // project file: the shape is an optional field of the segment, kept through export and import
  const P = simple('W36X135'), r = M.importJSON(M.exportJSON(P));
  assert.equal(r.ok, true); assert.equal(r.errors.length, 0); assert.equal(r.warnings.length, 0);
  assert.equal(r.project.girders[0].segments[0].shape, 'W36X135'); assert.equal(M.exportJSON(r.project), M.exportJSON(P));
  assert.equal(RL.anyRolled(P), true); assert.equal(RL.anyRolled(simple()), false);
});

test('HAND CHECK W36X135, 60 ft simple span: section properties, M_p, flexure (M_n) and shear (V_n), steel weight', () => {
  const P = simple('W36X135'); assert.equal(M.validate(P).errors.length, 0, JSON.stringify(M.validate(P).errors));
  const s = P.girders[0].segments[0], m = P.materials, d = P.deck;
  // three plates
  const A3 = 2 * 12 * 0.79 + 34.02 * 0.6, I3 = 2 * (12 * 0.79 ** 3 / 12 + 12 * 0.79 * 17.405 ** 2) + 0.6 * 34.02 ** 3 / 12;
  near(A3, 39.372, 1e-9, 'A_3 by hand'); near(I3, 7713.29, 0.01, 'I_3 by hand');
  const st = SEC.steelCore(RL.plates(W.SharedAiscW.get('W36X135')));
  near(st.A, A3, 1e-9, 'steel A'); near(st.I, I3, 1e-6, 'steel I'); near(st.yb, 17.8, 1e-9, 'steel ybar'); near(st.d, 35.6, 1e-9, 'steel depth = d');
  const q = RL.props(W.SharedAiscW.get('W36X135')); near(q.A3, A3, 1e-9, 'props A3'); near(q.I3, I3, 1e-6, 'props I3'); near(q.rA, 0.98677, 1e-5, 'A_3/A'); near(q.rI, 0.98888, 1e-5, 'I_3/I_x');
  // modular ratio and short-term composite section
  const Ec = 120000 * 1 * 0.15 ** 2 * 4 ** 0.33, n = 29000 / Ec; near(Ec, 4266.2, 0.1, 'E_c'); near(n, 6.798, 1e-3, 'n');
  const nr = SEC.modularRatio(m.concrete.fc, m.concrete.wc, m.concrete.K1, m.concrete.nRule); near(nr.n, n, 1e-12, 'n (engine)');
  const As = 96 * 8 / n, ys = 35.6 + 2 + 4, yb = (A3 * 17.8 + As * ys) / (A3 + As), Ic = I3 + A3 * (yb - 17.8) ** 2 + As * 8 ** 2 / 12 + As * (ys - yb) ** 2;
  near(As, 112.98, 0.01, 'transformed slab'); near(yb, 35.45, 0.01, 'composite ybar'); near(Ic, 24855, 5, 'composite I');
  const G = M.GRADES, mat = { Fyt: G[m.steel.top].Fy, Fyb: G[m.steel.bot].Fy, Fyw: G[m.steel.web].Fy, Fyr: m.rebar.Fyr, fc: m.concrete.fc };
  const c = SEC.card({ D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }, { composite: true, ts: d.ts, haunch: d.haunch, beff: 96, rebar: d.rebar }, mat, nr.n, { region: 'pos', rebarInPositive: false });
  near(c.cn.A, A3 + As, 1e-9, 'A_n'); near(c.cn.yb, yb, 1e-9, 'ybar_n'); near(c.cn.I, Ic, 1e-6, 'I_n');
  // plastic moment
  const Ps = 0.85 * 4 * 96 * 8, Pf = 12 * 0.79 * 50, Pw = 34.02 * 0.6 * 50, Y = 8 * (2 * Pf + Pw) / Ps;
  near(Ps, 2611.2, 1e-9, 'P_s'); near(Pf, 474, 1e-9, 'P_c = P_t'); near(Pw, 1020.6, 1e-9, 'P_w'); near(Y, 6.03125, 1e-9, 'Ybar');
  const Mp = (Y * Y * Ps / (2 * 8) + Pf * (8 - Y + 2 + 0.395) + Pw * (8 - Y + 2 + 0.79 + 17.01) + Pf * (8 - Y + 2 + 0.79 + 34.02 + 0.395)) / 12;
  near(Mp, 4065.88, 0.01, 'M_p by hand'); near(c.Mp, Mp, 1e-6, 'M_p (engine)'); near(c.Dp, Y, 1e-9, 'D_p');
  // flexure at midspan (Flexure tab's build)
  const FB = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis' }); assert.ok(!FB.err, FB.err);
  const r = FB.rows.find(x => Math.abs(x.x - 30) < 1e-6); assert.ok(r, 'midspan row');
  assert.equal(r.compact, true); near(r.Dt, 45.6, 1e-9, 'D_t'); near(r.Dp, 6.03125, 1e-9, 'D_p');
  const Mn = Mp * (1.07 - 0.7 * 6.03125 / 45.6); near(Mn, 3974.0, 0.1, 'M_n by hand'); near(r.Mn, Mn, 1e-6, 'M_n (engine)');
  near(r.Mu, 1.25 * (r.MDC1 + r.MDC2) + 1.5 * r.MDW + 1.75 * r.MLL, 1e-6, 'M_u = 1.25 DC + 1.5 DW + 1.75 LL');
  const mn = r.checks.find(k => k.key === 'mn'); assert.ok(mn, 'the M_u <= phi_f M_n check'); near(mn.ratio, r.Mu / Mn, 1e-9, 'flexure ratio'); assert.ok(mn.ratio < 1);
  // shear at the abutment (Shear tab's build)
  const SB = W.SBDShearUI.build({ P, g: 0, src: 'analysis' }); assert.ok(!SB.err, SB.err);
  const v = SB.stations[0]; near(v.sh.lam, 56.7, 1e-9, 'D/t_w'); assert.ok(56.7 < 1.12 * Math.sqrt(29000 * 5 / 50)); assert.equal(v.sh.C, 1);
  near(v.sh.Vp, 0.58 * 50 * 34.02 * 0.6, 1e-9, 'V_p'); near(v.sh.Vn, 591.948, 1e-9, 'V_n = 591.9 kip');
  const vc = v.checks.find(k => k.id === 'GS11'); near(vc.ratio, v.Vu / 591.948, 1e-12, 'shear ratio'); assert.ok(vc.ratio < 1);
  // steel weight: tabulated 135 lb/ft with the 5 % allowance; midspan moment of the steel alone
  const R = W.SBDAnalysis.analyzeGirder(P, 0); assert.equal(R.errors.length, 0);
  near(R.wSteel[0], 0.135 * 1.05, 1e-12, 'w_s'); assert.equal(R.segs[0].shape, 'W36X135');
  const sw = W.SBDLoads.steelWeight(P.girders[0].segments, 5); near(sw.avg, 0.14175, 1e-12, 'Loads tab steel weight');
  // the same plates entered as a plate girder (no shape): the three plates at 490 pcf (39.372 x 3.4028 = 133.97 lb/ft), everything else equal
  const Q = J(P); delete Q.girders[0].segments[0].shape;
  const R2 = W.SBDAnalysis.analyzeGirder(Q, 0); near(R2.wSteel[0], 39.372 * 490 / 144 / 1000 * 1.05, 1e-12, 'plate girder weight');
  // midspan moment of the steel: w L^2/8 = 0.14175(60)^2/8 = 63.79 kip-ft against 0.140672(60)^2/8 = 63.30 kip-ft as plates (the cross-frame weights, equal in both, are in the same DC1 case)
  const i = R.x.findIndex(x => Math.abs(x - 30) < 1e-6); near(R.st.DC1steel.M[i] - R2.st.DC1steel.M[i], (0.14175 - 39.372 * 490 / 144 / 1000 * 1.05) * 60 * 60 / 8, 1e-6, 'M of the steel at midspan, rolled less plates');
  assert.ok(R.wSteel[0] > R2.wSteel[0]); assert.equal(R.segs[0].Is, R2.segs[0].Is); assert.equal(R.segs[0].Inu, R2.segs[0].Inu);
  const FB2 = W.SBDFlexureUI.build({ P: Q, g: 0, src: 'analysis' }), r2 = FB2.rows.find(x => Math.abs(x.x - 30) < 1e-6);
  assert.equal(r2.Mn, r.Mn); assert.equal(W.SBDShearUI.build({ P: Q, g: 0, src: 'analysis' }).stations[0].sh.Vn, v.sh.Vn);   // resistances: the same plates, the same values
  // worked steps: the shape, its tabulated values and the three plates
  const S = RL.steps(s), id = k => S.find(x => x.id === 'rolled.' + k);
  assert.equal(id('A').value, 39.9); assert.equal(id('Ix').value, 7800); assert.equal(id('W').value, 135); assert.equal(id('D').value, 34.02);
  near(id('A3').value, 39.372, 1e-9, 'step A3'); near(id('I3').value, I3, 1e-6, 'step I3'); near(id('rI').value, I3 / 7800, 1e-12, 'step ratio');
  assert.match(id('d').label, /W36X135/); assert.match(id('d').ref, /AISC Shapes Database v16\.0, W36X135/);
});

test('a project without a shape: the same results, bit for bit, with and without engine/rolled.js', () => {
  const W0 = loadShared(...BASE, ...APP.map(E));   // the app as before 2026-11-23: no aisc-w.js, no rolled.js
  W0.SBDReportData.install(); assert.equal(W0.SBDRolled, undefined);
  const strip = (k, v) => (typeof v === 'function' ? undefined : typeof v === 'number' && !Number.isFinite(v) ? String(v) : v);
  const run = (Wx, P) => { const out = { val: Wx.SBDModel.validate(P), an: Wx.SBDAnalysis.analyzeGirder(P, 0), sw: Wx.SBDLoads.steelWeight(P.girders[0].segments, 5, 'G1') };
    const F = Wx.SBDFlexureUI.build({ P, g: 0, src: 'analysis' }); out.flex = F.rows.map(r => [r.x, r.Mu, r.Mn, r.checks.map(k => [k.id, k.ratio]), r.steps]);
    const S = Wx.SBDShearUI.build({ P, g: 0, src: 'analysis' }); out.shear = [S.stations.map(q => [q.x, q.Vu, q.sh, q.checks.map(k => [k.id, k.ratio])]), S.tsC, S.bsC];
    const Wd = Wx.SBDWeldsUI.build({ P, g: 0, src: 'analysis' }); out.welds = [Wd.err || null, Wd.C, Wd.R && Wd.R.fw, Wd.R && Wd.R.tr];
    return JSON.stringify(out, strip); };
  for (const P of [M.defaultProject(), simple()]) {
    const a = run(W, J(P)), b = run(W0, J(P));
    assert.ok(a.length > 50000); assert.equal(a, b, `${P.project.name}: results with rolled.js loaded = results without`);
  }
  // the whole evaluation (every module, as Auto design runs it) of the built-in project: the same governing values
  const ev = Wx => { const R = Wx.SBDAutoDesign.evaluate(J(M.defaultProject()), { level: 'full' }); return JSON.stringify({ pass: R.pass, ratio: R.ratio, gov: R.gov, fails: R.fails, warns: R.warns, nStiff: R.nStiff }, strip); };
  assert.equal(ev(W), ev(W0));
});

test('a shape that is not in the list, or plates changed after the pick: plate girder with the stored plates, a warning, nothing lost', () => {
  const P = simple('W36X135'), s = P.girders[0].segments[0];
  // not in the list
  const U = J(P); U.girders[0].segments[0].shape = 'W37X999';
  const vu = M.validate(U); assert.equal(vu.errors.length, 0); assert.equal(vu.warnings.length, 1);
  assert.match(vu.warnings[0].msg, /G1 segment 1: the rolled shape "W37X999" is not in the W-shape list .* The stored plate sizes are used, as a plate girder/); assert.equal(vu.warnings[0].path, 'girders.0.segments.0.shape');
  assert.equal(RL.state(U.girders[0].segments[0]).status, 'unknown'); assert.equal(RL.isRolled(U.girders[0].segments[0]), false);
  const r = M.importJSON(M.exportJSON(U)); assert.equal(r.ok, true); assert.deepEqual(J(r.project.girders[0].segments[0]), J(U.girders[0].segments[0]));   // name and plates kept
  const Q = J(P); delete Q.girders[0].segments[0].shape;   // = the stored plates as a plate girder
  const pick = R => JSON.stringify([R.wSteel, R.st.DC1.M, R.segs.map(q => [q.As, q.Is, q.Inu])]);
  assert.equal(pick(W.SBDAnalysis.analyzeGirder(U, 0)), pick(W.SBDAnalysis.analyzeGirder(Q, 0)));
  // plates edited after the pick (a file edited by hand, or plates written by another function)
  const X = J(P); X.girders[0].segments[0].botT = 1.0;
  assert.equal(RL.state(X.girders[0].segments[0]).status, 'edited'); assert.equal(RL.isRolled(X.girders[0].segments[0]), false);
  const vx = M.validate(X); assert.equal(vx.errors.length, 0); assert.match(vx.warnings[0].msg, /the stored plate sizes are not those of W36X135 .* The stored plate sizes are used, as a plate girder/);
  const RX = W.SBDAnalysis.analyzeGirder(X, 0); near(RX.wSteel[0], (12 * 0.79 + 12 * 1.0 + 34.02 * 0.6) * 490 / 144 / 1000 * 1.05, 1e-12, 'edited: three plates at 490 pcf');
  // a shape that is not text: an input error
  const B = J(P); B.girders[0].segments[0].shape = 36; assert.match(M.validate(B).errors.map(e => e.msg).join(' '), /rolled shape must be a designation/);
  assert.equal(s.shape, 'W36X135');
});

test('one steel grade with a rolled shape; no flange-to-web welds; the LGA export writes the three plates', () => {
  const P = simple('W36X135');
  const H = J(P); H.materials.steel.web = '36';
  const e = M.validate(H).errors; assert.equal(e.length, 1); assert.equal(e[0].path, 'materials.steel.web'); assert.match(e[0].msg, /A rolled shape is one grade of steel/);
  const Hp = J(H); delete Hp.girders[0].segments[0].shape; assert.equal(M.validate(Hp).errors.length, 0);   // the same plates as a plate girder: hybrid allowed
  // welds: a girder of one rolled shape has nothing to check
  const Wd = W.SBDWeldsUI.build({ P, g: 0, src: 'analysis' }); assert.equal(Wd.na, true); assert.match(Wd.err, /not applicable to G1.*W36X135.*no flange-to-web welds/);
  // rolled 0-40 ft, plate girder 40-60 ft: weld locations only on the plate side
  const X = J(P); X.girders[0].segments = [{ ...X.girders[0].segments[0], x1: 40 }, { x0: 40, x1: 60, D: 34, tw: 0.625, topB: 12, topT: 1, botB: 12, botT: 1 }];
  assert.equal(M.validate(X).errors.length, 0);
  const Wx = W.SBDWeldsUI.build({ P: X, g: 0, src: 'analysis' }); assert.ok(!Wx.err, Wx.err);
  assert.deepEqual(Array.from(Wx.R.fw, r => r.name), ['x = 40.00 ft, right of the plate change', 'Abut. 2']);
  const Xp = J(X); delete Xp.girders[0].segments[0].shape;
  assert.deepEqual(Array.from(W.SBDWeldsUI.build({ P: Xp, g: 0, src: 'analysis' }).R.fw, r => r.name), ['Abut. 1', 'x = 40.00 ft, left of the plate change', 'x = 40.00 ft, right of the plate change', 'Abut. 2']);
  // MIDAS .lga: the plate schedule holds the equivalent three plates, and the export says so
  const LG = W.SBDLga, calc = LG.exportCalc(P); assert.deepEqual(J(calc.errors), []);
  const out = LG.toLga(P, {}, calc); assert.equal(out.ok, true);
  const seg = out.file.project ? out.file.project.segments[0][0] : JSON.parse(out.text).project.segments[0][0];
  assert.deepEqual([seg.tf_w, seg.tf_t, seg.web_d, seg.web_t, seg.bf_w, seg.bf_t], [12, 0.79, 34.02, 0.6, 12, 0.79]);
  assert.match(JSON.stringify(out.summary), /Rolled shapes \(W36X135\) are written as their equivalent three plates/);
});

test('W-shape search: lightest first, stops at the first that passes; the quick check only leaves shapes out', () => {
  const P = simple('W36X135');
  const C = RL.candidates({ nomMin: 30, nomMax: 36 });
  assert.ok(C.length > 20 && C.every((s, i) => s.nom >= 30 && s.nom <= 36 && (!i || s.W >= C[i - 1].W)));
  assert.equal(RL.candidates().length, 289);
  // a stand-in for the full check: passes when I_x of the three plates is at least 7000 in^4
  const seen = [], passes = Q => { const s = Q.girders[0].segments[0], I = SEC.steelCore(s).I; seen.push(s.shape); return { pass: I >= 7000, ratio: 7000 / I, gov: { id: 'I', title: 'stand-in' } }; };
  const drain = it => { let r; while (!(r = it.next()).done); return r.value; };
  const a = drain(RL.lightest(P, 0, passes, { nomMin: 30, nomMax: 36 }));
  assert.ok(a.found); assert.equal(a.found.project.girders[0].segments[0].shape, a.found.name); assert.equal(RL.isRolled(a.found.project.girders[0].segments[0]), true);
  assert.equal(P.girders[0].segments[0].shape, 'W36X135');   // the project given is not changed
  assert.ok(a.tried.slice(0, -1).every(q => !q.pass) && a.tried[a.tried.length - 1].pass);
  assert.ok(C.filter(s => s.W < a.found.W).every(s => SEC.steelCore(RL.plates(s)).I < 7000), 'no lighter shape of the range passes');
  assert.deepEqual(seen, J(a.tried.map(q => q.name)));
  // with a quick check: the same shape found, fewer full checks; a quick ratio above the limit is never taken as a pass
  const b = drain(RL.lightest(P, 0, passes, { nomMin: 30, nomMax: 36, skipAbove: 1.25, screen: Q => 7000 / SEC.steelCore(Q.girders[0].segments[0]).I }));
  assert.equal(b.found.name, a.found.name); assert.ok(b.nSkip > 0 && b.nFull + b.nSkip === a.tried.length && b.nFull < a.nFull);
  assert.equal(drain(RL.lightest(P, 0, () => ({ pass: false, ratio: 2 }), { nomMin: 36, nomMax: 36 })).found, null);
  // the real full check (Auto design's evaluation of the project) on the hand-check bridge: W36X135 passes; it counts the Welds tab as
  // not applicable, not as a failure
  const Ev = W.SBDAutoDesign.evaluate(J(P), { level: 'full' });
  assert.equal(Ev.pass, true, JSON.stringify(Ev.fails.slice(0, 3))); assert.ok(Ev.ratio <= 1 + 1e-9);
  assert.equal(Ev.fails.some(f => f.mod === 'welds'), false);
});
